import {
    deleteLoredeckCreatorGenerationController,
    forgetLoredeckCreatorLiveGeneration,
    getAnyActiveLoredeckCreatorLiveGeneration,
    getLoredeckCreatorGenerationJobId,
    getLoredeckCreatorLiveGenerationForJob,
    hasLoredeckCreatorGenerationController,
    rememberLoredeckCreatorLiveGeneration,
} from './loredeck-creator-generation-state.js';
import {
    buildLoredeckCreatorActiveGenerationUpdate,
} from './loredeck-creator-generation-lifecycle.js';

function getClockNow(deps = {}) {
    return typeof deps.now === 'function' ? deps.now() : Date.now();
}

function getGlobalSetInterval() {
    return typeof setInterval === 'function' ? setInterval : null;
}

function getGlobalClearInterval() {
    return typeof clearInterval === 'function' ? clearInterval : null;
}

export function isLoredeckCreatorAbortError(error) {
    return error?.name === 'AbortError' || /aborted|cancelled|canceled/i.test(String(error?.message || error || ''));
}

export function createLoredeckCreatorGenerationProgressController(deps = {}) {
    let ticker = null;
    const getCurrentJob = () => (typeof deps.getCurrentJob === 'function' ? deps.getCurrentJob() : {}) || {};
    const setCurrentJobLocal = job => {
        if (typeof deps.setCurrentJobLocal === 'function') deps.setCurrentJobLocal(job);
        return job;
    };
    const setCurrentJob = (job, options = {}) => {
        if (typeof deps.setCurrentJob === 'function') return deps.setCurrentJob(job, options);
        return setCurrentJobLocal(job);
    };
    const queueWorkbenchRefresh = () => {
        if (typeof deps.queueWorkbenchRefresh === 'function') deps.queueWorkbenchRefresh();
    };
    const refreshGenerationStatusUi = generationId => {
        if (typeof deps.refreshGenerationStatusUi === 'function') deps.refreshGenerationStatusUi(generationId);
    };
    const getGenerationWaitMessage = active => (
        typeof deps.getGenerationWaitMessage === 'function'
            ? deps.getGenerationWaitMessage(active)
            : active?.message || 'Generation running'
    );
    const setIntervalFn = deps.setInterval || getGlobalSetInterval();
    const clearIntervalFn = deps.clearInterval || getGlobalClearInterval();

    function stopTicker() {
        if (!ticker) return false;
        if (clearIntervalFn) clearIntervalFn(ticker);
        ticker = null;
        return true;
    }

    function getActiveGeneration(job = getCurrentJob()) {
        const active = getLoredeckCreatorLiveGenerationForJob(job) || job?.activeGeneration;
        return active && active.status === 'running' ? active : null;
    }

    function isGenerationCurrent(generation = null) {
        if (!generation?.id) return false;
        if (hasLoredeckCreatorGenerationController(generation.id)) return true;
        const jobId = getLoredeckCreatorGenerationJobId(generation);
        if (jobId) {
            const live = getLoredeckCreatorLiveGenerationForJob(jobId);
            if (live?.id === generation.id) return true;
        }
        const active = getActiveGeneration();
        return !!active && active.id === generation.id;
    }

    function ignoreStaleGeneration(generation = null, context = 'Deck Maker generation') {
        if (isGenerationCurrent(generation)) return false;
        if (generation?.id) {
            console.info(`[Saga] Ignored stale ${context} result: ${generation.id}`);
            deleteLoredeckCreatorGenerationController(generation.id);
            forgetLoredeckCreatorLiveGeneration(generation);
        }
        return true;
    }

    function updateActiveGenerationLocal(generationId = '', patch = {}, options = {}) {
        const id = String(generationId || patch?.id || '').trim();
        if (!id) return null;
        const cached = getCurrentJob();
        const active = cached.activeGeneration;
        if (!active || active.id !== id || active.status !== 'running') return null;
        const nextActive = {
            ...active,
            ...(patch || {}),
            id: active.id,
            status: active.status,
            currentStage: patch.currentStage || active.currentStage || cached.currentStage || '',
        };
        const live = rememberLoredeckCreatorLiveGeneration(cached.jobId || getLoredeckCreatorGenerationJobId(nextActive), nextActive);
        const localJob = {
            ...cached,
            status: 'running',
            activeGeneration: live || nextActive,
        };
        setCurrentJobLocal(localJob);
        if (!options.suppressWorkbenchRefresh) {
            if (options.liveStatusOnly) refreshGenerationStatusUi(id);
            else if (options.refreshWorkbench !== false) queueWorkbenchRefresh();
        }
        return localJob;
    }

    function startTicker(generationId = '') {
        stopTicker();
        if (!generationId || !setIntervalFn) return null;
        ticker = setIntervalFn(() => {
            const cached = getCurrentJob();
            const active = cached.activeGeneration;
            if (!active || active.id !== generationId || active.status !== 'running') {
                stopTicker();
                return;
            }
            const now = getClockNow(deps);
            updateActiveGenerationLocal(generationId, {
                elapsedMs: Math.max(0, now - Number(active.startedAt || now)),
                message: getGenerationWaitMessage(active),
                updatedAt: now,
            }, { liveStatusOnly: true });
        }, 1000);
        return ticker;
    }

    function updateGeneration(generation = null, event = {}, options = {}) {
        if (!generation?.id) return null;
        const cached = getCurrentJob();
        const active = cached.activeGeneration;
        if (!active || active.id !== generation.id || active.status !== 'running') return null;
        const activeGeneration = buildLoredeckCreatorActiveGenerationUpdate(active, event, options, getClockNow(deps));
        if (options.persist === false) {
            updateActiveGenerationLocal(generation.id, activeGeneration, { liveStatusOnly: true });
            return activeGeneration;
        }
        setCurrentJob({
            ...cached,
            activeGeneration,
        }, { coalesceStorageWrite: true });
        refreshGenerationStatusUi(generation.id);
        return activeGeneration;
    }

    function makeProgressHandler(generation = null, options = {}) {
        let lastUpdateAt = 0;
        return event => {
            const now = getClockNow(deps);
            const important = ['start', 'stream_start', 'stream_complete', 'complete', 'reasoning', 'phase'].includes(event?.type)
                || event?.phase !== 'receiving';
            if (!important && now - lastUpdateAt < 250) return;
            lastUpdateAt = now;
            const receivedChars = Number(event?.receivedChars || 0);
            const hasVisibleOutput = receivedChars > 0 || !!String(event?.accumulated || '').trim();
            const progressOptions = event?.type === 'reasoning' && !hasVisibleOutput
                ? { ...options, persist: false }
                : options;
            updateGeneration(generation, event || {}, progressOptions);
        };
    }

    return {
        stopTicker,
        getActiveGeneration,
        isGenerationCurrent,
        ignoreStaleGeneration,
        updateActiveGenerationLocal,
        startTicker,
        updateGeneration,
        makeProgressHandler,
        getAnyActiveLiveGeneration: getAnyActiveLoredeckCreatorLiveGeneration,
    };
}
