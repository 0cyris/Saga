import {
    buildLoredeckCreatorActiveGeneration,
    buildLoredeckCreatorCancelledGenerationResult,
    buildLoredeckCreatorGenerationResult,
} from './loredeck-creator-generation-lifecycle.js';
import {
    deleteLoredeckCreatorGenerationController,
    forgetLoredeckCreatorLiveGeneration,
    getAnyActiveLoredeckCreatorLiveGeneration,
    getLoredeckCreatorGenerationController,
    rememberLoredeckCreatorLiveGeneration,
    setLoredeckCreatorGenerationController,
} from './loredeck-creator-generation-state.js';

function getClockNow(deps = {}) {
    return typeof deps.now === 'function' ? deps.now() : Date.now();
}

function getAbortControllerCtor(deps = {}) {
    if (deps.AbortController === false) return null;
    if (typeof deps.AbortController === 'function') return deps.AbortController;
    return typeof AbortController === 'function' ? AbortController : null;
}

export function createLoredeckCreatorGenerationSessionController(deps = {}) {
    const getCurrentJob = () => (typeof deps.getCurrentJob === 'function' ? deps.getCurrentJob() : {}) || {};
    const setCurrentJob = (job, options = {}) => (
        typeof deps.setCurrentJob === 'function' ? deps.setCurrentJob(job, options) : job
    ) || job;
    const setCurrentJobLocal = job => {
        if (typeof deps.setCurrentJobLocal === 'function') deps.setCurrentJobLocal(job);
        return job;
    };
    const getGenerationSettings = job => (
        typeof deps.getGenerationSettings === 'function' ? deps.getGenerationSettings(job) : {}
    ) || {};
    const getActiveGeneration = job => (
        typeof deps.getActiveGeneration === 'function' ? deps.getActiveGeneration(job) : job?.activeGeneration
    ) || null;
    const getAnyActiveLiveGeneration = typeof deps.getAnyActiveLiveGeneration === 'function'
        ? deps.getAnyActiveLiveGeneration
        : getAnyActiveLoredeckCreatorLiveGeneration;
    const inferUiStage = job => (typeof deps.inferUiStage === 'function' ? deps.inferUiStage(job) : job?.currentStage || '');
    const startTicker = generationId => (typeof deps.startTicker === 'function' ? deps.startTicker(generationId) : null);
    const stopTicker = () => (typeof deps.stopTicker === 'function' ? deps.stopTicker() : null);
    const queueWorkbenchRefresh = () => {
        if (typeof deps.queueWorkbenchRefresh === 'function') deps.queueWorkbenchRefresh();
    };
    const toast = (message, tone) => {
        if (typeof deps.toast === 'function') deps.toast(message, tone);
    };
    const warn = (message, error) => {
        if (typeof deps.warn === 'function') deps.warn(message, error);
        else console.warn(message, error);
    };
    const setGenerationController = typeof deps.setGenerationController === 'function'
        ? deps.setGenerationController
        : setLoredeckCreatorGenerationController;
    const getGenerationController = typeof deps.getGenerationController === 'function'
        ? deps.getGenerationController
        : getLoredeckCreatorGenerationController;
    const deleteGenerationController = typeof deps.deleteGenerationController === 'function'
        ? deps.deleteGenerationController
        : deleteLoredeckCreatorGenerationController;
    const rememberLiveGeneration = typeof deps.rememberLiveGeneration === 'function'
        ? deps.rememberLiveGeneration
        : rememberLoredeckCreatorLiveGeneration;
    const forgetLiveGeneration = typeof deps.forgetLiveGeneration === 'function'
        ? deps.forgetLiveGeneration
        : forgetLoredeckCreatorLiveGeneration;

    function startGeneration(actionId = '', label = '', jobPatch = {}, details = {}) {
        const now = getClockNow(deps);
        const current = getCurrentJob();
        const generationSettings = getGenerationSettings(current);
        const active = getActiveGeneration(current) || getAnyActiveLiveGeneration();
        if (active) {
            toast(`${active.label || 'Deck Maker generation'} is still running. Cancel it or wait for it to finish before starting another generation.`, 'warning');
            queueWorkbenchRefresh();
            return { generation: null, job: current, blocked: true };
        }
        const AbortControllerCtor = getAbortControllerCtor(deps);
        const controller = AbortControllerCtor ? new AbortControllerCtor() : null;
        const generation = buildLoredeckCreatorActiveGeneration({
            actionId,
            label,
            jobPatch,
            details,
            generationSettings,
            abortable: !!controller,
            now,
        });
        if (controller) setGenerationController(generation.id, controller);
        const job = setCurrentJob({
            ...(current || {}),
            ...(jobPatch || {}),
            status: 'running',
            activeGeneration: generation,
            lastGenerationResult: null,
            lastAction: actionId || jobPatch.lastAction || current?.lastAction || '',
            lastStartedAt: now,
        }, { refreshWorkbench: true });
        if (job?.jobId) {
            const live = rememberLiveGeneration(job.jobId, {
                ...generation,
                currentStage: job.currentStage || jobPatch.currentStage || current?.currentStage || '',
            });
            if (live && live !== generation) Object.assign(generation, live);
            setCurrentJobLocal({
                ...getCurrentJob(),
                activeGeneration: live || generation,
            });
        }
        startTicker(generation.id);
        return { generation, job };
    }

    function finishGeneration(generation = null, status = 'success', message = '', details = {}) {
        if (!generation?.id) return null;
        const cached = getCurrentJob();
        const currentActive = cached.activeGeneration;
        if (currentActive?.id && currentActive.id !== generation.id) {
            deleteGenerationController(generation.id);
            forgetLiveGeneration(generation);
            return { ignored: true, stale: true };
        }
        const active = currentActive || generation;
        stopTicker();
        deleteGenerationController(generation.id);
        forgetLiveGeneration(generation);
        const now = getClockNow(deps);
        const restoredStage = inferUiStage({
            ...cached,
            activeGeneration: null,
            status: '',
            currentStage: '',
        });
        const result = buildLoredeckCreatorGenerationResult(generation, active, status, message, details, now);
        const job = setCurrentJob({
            ...cached,
            activeGeneration: null,
            lastGenerationResult: result,
            lastCompletedAt: status === 'error' ? cached.lastCompletedAt : now,
            status: status === 'error' ? 'blocked' : (cached.brief ? 'draft' : 'idle'),
            currentStage: restoredStage,
        }, { refreshWorkbench: true });
        return { job, result };
    }

    function cancelGeneration(generationId = '') {
        const cached = getCurrentJob();
        const active = getActiveGeneration(cached);
        if (!active || (generationId && active.id !== generationId)) return false;
        const controller = getGenerationController(active.id);
        try {
            controller?.abort?.();
        } catch (error) {
            warn('[Saga] Could not abort Deck Maker generation:', error);
        }
        stopTicker();
        deleteGenerationController(active.id);
        forgetLiveGeneration(active);
        const now = getClockNow(deps);
        const restoredStage = inferUiStage({
            ...cached,
            activeGeneration: null,
            status: '',
            currentStage: '',
        });
        const result = buildLoredeckCreatorCancelledGenerationResult(active, now);
        setCurrentJob({
            ...cached,
            activeGeneration: null,
            lastGenerationResult: result,
            status: cached.brief ? 'draft' : 'idle',
            currentStage: restoredStage,
        }, { refreshWorkbench: true });
        toast(`${active.label || 'Deck Maker generation'} cancelled.`, 'info');
        return true;
    }

    return {
        startGeneration,
        finishGeneration,
        cancelGeneration,
    };
}
