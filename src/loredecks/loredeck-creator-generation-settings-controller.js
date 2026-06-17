import {
    LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
    getLoredeckCreatorGenerationSettingsFromCache,
    hasPersistableLoredeckCreatorProject,
    normalizeLoredeckCreatorGenerationSettings,
    resolveLoredeckCreatorSplitRetryProvider,
} from './loredeck-creator-generation-settings.js';

function callOrFallback(fn, fallback, ...args) {
    return typeof fn === 'function' ? fn(...args) : fallback;
}

export function createLoredeckCreatorGenerationSettingsController(deps = {}) {
    const getCurrentJob = () => callOrFallback(deps.getCurrentJob, {}, {}) || {};
    const setCurrentJob = (job, options = {}) => callOrFallback(deps.setCurrentJob, job, job, options);
    const setCurrentJobLocal = job => {
        if (typeof deps.setCurrentJobLocal === 'function') deps.setCurrentJobLocal(job);
        return job;
    };
    const validateProvider = providerKind => callOrFallback(deps.validateProvider, {}, providerKind);

    function getGenerationSettings(cached = getCurrentJob()) {
        return getLoredeckCreatorGenerationSettingsFromCache(cached);
    }

    function getSplitRetryProvider(settings = getGenerationSettings()) {
        return resolveLoredeckCreatorSplitRetryProvider(settings, providerKind => validateProvider(providerKind));
    }

    function setLocalGenerationSettings(cached = {}, generationSettings = {}) {
        const localJob = {
            ...(cached || {}),
            generationSettings: normalizeLoredeckCreatorGenerationSettings(generationSettings),
        };
        return setCurrentJobLocal(localJob);
    }

    function setGenerationSettings(patch = {}) {
        const cached = getCurrentJob();
        const next = normalizeLoredeckCreatorGenerationSettings({
            ...getGenerationSettings(cached),
            ...(patch || {}),
        });
        if (!hasPersistableLoredeckCreatorProject(cached)) {
            return setLocalGenerationSettings(cached, next);
        }
        return setCurrentJob({
            ...cached,
            generationSettings: next,
        }, { suppressWorkbenchRefresh: true });
    }

    function resetGenerationSettings() {
        const cached = getCurrentJob();
        if (!hasPersistableLoredeckCreatorProject(cached)) {
            return setLocalGenerationSettings(cached, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS);
        }
        return setCurrentJob({
            ...cached,
            generationSettings: { ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS },
        }, { suppressWorkbenchRefresh: true });
    }

    return {
        getGenerationSettings,
        getSplitRetryProvider,
        setLocalGenerationSettings,
        setGenerationSettings,
        resetGenerationSettings,
    };
}
