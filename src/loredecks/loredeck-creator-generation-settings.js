export const LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES = 5;
export const LOREDECK_CREATOR_ENTRY_BATCH_SIZE = 3;
export const LOREDECK_CREATOR_ENTRY_BATCH_MAX = 6;
export const LOREDECK_CREATOR_ENTRY_AUTORUN_BATCHES = 5;

export const LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS = Object.freeze({
    titleBatchLimit: 8,
    planningProposalLimit: 12,
    entryBatchSize: LOREDECK_CREATOR_ENTRY_BATCH_SIZE,
    titleRunRemainingLimit: LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES,
    entryRunRemainingLimit: LOREDECK_CREATOR_ENTRY_AUTORUN_BATCHES,
    retryAttempts: 1,
    retrySmaller: true,
    useUtilityProviderForSplitRetries: false,
    showStreamingProgress: true,
});

export const LOREDECK_CREATOR_GENERATION_SETTING_LIMITS = Object.freeze({
    titleBatchLimit: Object.freeze([4, 12]),
    planningProposalLimit: Object.freeze([6, 24]),
    entryBatchSize: Object.freeze([1, LOREDECK_CREATOR_ENTRY_BATCH_MAX]),
    titleRunRemainingLimit: Object.freeze([1, 10]),
    entryRunRemainingLimit: Object.freeze([1, 10]),
    retryAttempts: Object.freeze([0, 4]),
});

export function clampLoredeckCreatorInteger(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
}

export function normalizeLoredeckCreatorGenerationSettings(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = { ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS };
    for (const [key, limits] of Object.entries(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS)) {
        const [min, max] = limits;
        output[key] = clampLoredeckCreatorInteger(input[key], min, max, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS[key]);
    }
    output.retrySmaller = input.retrySmaller !== false;
    output.useUtilityProviderForSplitRetries = input.useUtilityProviderForSplitRetries === true;
    output.showStreamingProgress = input.showStreamingProgress !== false;
    return output;
}

export function getLoredeckCreatorGenerationSettingsFromCache(cached = {}) {
    return normalizeLoredeckCreatorGenerationSettings(cached?.generationSettings || {});
}

export function hasPersistableLoredeckCreatorProject(cached = {}) {
    return !!(
        cached?.jobId
        || cached?.brief
        || cached?.activeGeneration
        || cached?.status
        || cached?.createdAt
        || cached?.fandom
        || cached?.scope
        || cached?.generatedPackId
        || cached?.outline
        || (Array.isArray(cached?.titleDrafts) && cached.titleDrafts.length)
        || (Array.isArray(cached?.draftChanges) && cached.draftChanges.length)
        || (Array.isArray(cached?.pendingChanges) && cached.pendingChanges.length)
    );
}

export function resolveLoredeckCreatorSplitRetryProvider(settings = {}, validateUtilityProvider = null) {
    const normalized = normalizeLoredeckCreatorGenerationSettings(settings);
    if (normalized.useUtilityProviderForSplitRetries !== true) {
        return {
            providerKind: 'lore',
            label: 'Reasoning Provider',
            fallbackMessage: '',
        };
    }
    const validation = typeof validateUtilityProvider === 'function'
        ? validateUtilityProvider('continuity') || {}
        : {};
    if (validation.ok) {
        return {
            providerKind: 'continuity',
            label: 'Utility Provider',
            fallbackMessage: '',
        };
    }
    return {
        providerKind: 'lore',
        label: 'Reasoning Provider',
        fallbackMessage: validation.message || 'Utility Provider is not configured for split retries.',
    };
}
