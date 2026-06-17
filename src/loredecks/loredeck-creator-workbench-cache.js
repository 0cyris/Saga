function normalizeKey(value = '') {
    return String(value || '').trim();
}

function normalizeIdSet(values = []) {
    return new Set((Array.isArray(values) ? values : [values])
        .map(value => normalizeKey(value))
        .filter(Boolean));
}

export function createLoredeckCreatorWorkbenchCacheController(deps = {}) {
    const cache = deps.cache instanceof Map ? deps.cache : new Map();

    function getEntry(key = '') {
        return cache.get(normalizeKey(key));
    }

    function setEntry(key = '', value = {}) {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) return value;
        cache.set(normalizedKey, value);
        return value;
    }

    function deleteEntry(key = '') {
        return cache.delete(normalizeKey(key));
    }

    function getCurrentJobLocal() {
        return getEntry('current') || {};
    }

    function setCurrentJobLocal(job = {}) {
        return setEntry('current', job || {});
    }

    function deleteCurrentJob() {
        return deleteEntry('current');
    }

    function abortActiveGeneration(job = {}) {
        const active = typeof deps.getActiveGeneration === 'function'
            ? deps.getActiveGeneration(job)
            : job?.activeGeneration;
        if (!active?.id) return false;
        try {
            deps.getGenerationController?.(active.id)?.abort?.();
        } catch (_) {}
        deps.deleteGenerationController?.(active.id);
        deps.forgetLiveGeneration?.(active);
        deps.stopGenerationTicker?.();
        return true;
    }

    function clearCurrentCache(options = {}) {
        const cached = getCurrentJobLocal();
        abortActiveGeneration(cached);
        deleteCurrentJob();
        deps.clearDraftInputs?.();
        if (options.refresh !== false) {
            deps.refreshWorkbenchBody?.({ preserveScroll: false });
        }
        return true;
    }

    function clearCurrentCacheForRemovedJobs(jobIds = [], packId = '', options = {}) {
        const cached = getCurrentJobLocal();
        const generatedPackId = typeof deps.getJobGeneratedPackId === 'function'
            ? deps.getJobGeneratedPackId(cached)
            : normalizeKey(cached?.generatedPackId || cached?.brief?.packId || '');
        if (!cached?.jobId && !generatedPackId) return false;
        const ids = normalizeIdSet(jobIds);
        const targetPackId = normalizeKey(packId);
        const cachedJobId = normalizeKey(cached?.jobId);
        const matchesJob = cachedJobId && ids.has(cachedJobId);
        const matchesPack = targetPackId && generatedPackId === targetPackId;
        if (!matchesJob && !matchesPack) return false;
        return clearCurrentCache(options);
    }

    return {
        getEntry,
        setEntry,
        deleteEntry,
        getCurrentJobLocal,
        setCurrentJobLocal,
        deleteCurrentJob,
        clearCurrentCache,
        clearCurrentCacheForRemovedJobs,
    };
}
