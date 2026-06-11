const CONTEXT_PLACEHOLDER_VALUES = Object.freeze(new Set([
    'unset',
    'unset.',
    'no context set',
    'no context set.',
    'unknown',
    'n/a',
    'none',
]));

function hasContextTextValue(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return false;
    return !CONTEXT_PLACEHOLDER_VALUES.has(text.toLowerCase());
}

function hasContextNumberValue(value) {
    if (value === null || value === undefined || value === '') return false;
    return Number.isFinite(Number(value));
}

export function hasSelectedLoredeckContext(context = {}) {
    if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
    if (hasContextTextValue(context.branchId) && String(context.branchId).trim() !== 'main') return true;
    if ([
        context.sceneDate,
        context.subjectiveDate,
        context.stardate,
        context.anchorId,
        context.anchorFrom,
        context.anchorTo,
        context.arc,
        context.phase,
        context.season,
        context.episode,
        context.chapter,
        context.issue,
        context.quest,
        context.gameStage,
        context.alias,
        context.label,
    ].some(hasContextTextValue)) return true;
    if (hasContextNumberValue(context.contextSortKey)) return true;
    if (hasContextNumberValue(context.contextSortKeyFrom)) return true;
    if (hasContextNumberValue(context.contextSortKeyTo)) return true;
    return Array.isArray(context.coordinates)
        && context.coordinates.some(item => item && typeof item === 'object' && Object.values(item).some(hasContextTextValue));
}

export function buildBasicReadinessModel(input = {}) {
    const acceptedCount = Math.max(0, Number(input.acceptedCount) || 0);
    const contextCount = Math.max(0, Number(input.contextCount) || 0);
    const enabledLoredecks = Math.max(0, Number(input.enabledLoredecks) || 0);
    const pendingCount = Math.max(0, Number(input.pendingCount) || 0);
    const selectedLore = Math.max(0, Number(input.selectedLore) || 0);
    const sagaEnabled = input.sagaEnabled !== false;
    const loreInjectionOn = input.loreInjectionOn !== false;
    const providerReady = !!input.providerReady;

    const rows = [
        {
            id: 'active',
            label: 'Saga Active',
            ready: sagaEnabled,
            readyText: 'Saga is active',
            missingText: 'Saga is paused',
            actionLabel: 'Enable Saga',
            actionId: 'enable-saga',
        },
        {
            id: 'loredecks',
            label: 'Loredecks in stack',
            ready: enabledLoredecks > 0,
            readyText: `${enabledLoredecks} loaded`,
            missingText: 'Open Library, expand a folder, and add 1-2 Loredecks',
            actionLabel: 'Open Library',
            targetTab: 'loredecks',
        },
        {
            id: 'context',
            label: 'Browse Context',
            ready: enabledLoredecks > 0 && contextCount > 0,
            readyText: `${contextCount} Context row${contextCount === 1 ? '' : 's'} selected`,
            missingText: enabledLoredecks > 0 ? 'Browse Context before starting' : 'Load a Loredeck first',
            actionLabel: enabledLoredecks > 0 ? 'Browse Context' : 'Open Library',
            targetTab: enabledLoredecks > 0 ? 'context' : 'loredecks',
        },
        {
            id: 'review',
            label: 'Lorecards reviewed',
            ready: acceptedCount > 0,
            readyText: `${acceptedCount} accepted`,
            missingText: pendingCount > 0 ? `${pendingCount} pending review` : 'Nothing accepted yet',
            actionLabel: 'Review Lorecards',
            targetTab: 'lore',
        },
        {
            id: 'lore-ready',
            label: 'Lore ready',
            ready: loreInjectionOn && selectedLore > 0,
            readyText: `${selectedLore} selected`,
            missingText: loreInjectionOn ? 'Nothing selected for prompt' : 'Lore injection is off',
            actionLabel: 'Review Lorecards',
            targetTab: 'lore',
        },
        {
            id: 'provider',
            label: 'Provider optional',
            ready: providerReady,
            optional: true,
            readyText: 'Configured',
            missingText: 'Provider not configured',
            actionLabel: 'Configure Provider',
            targetTab: 'settings',
        },
    ];

    let nextAction = rows.find(row => !row.ready && !row.optional);
    if (!nextAction && pendingCount > 0) nextAction = rows.find(row => row.id === 'review');
    if (!nextAction && selectedLore > 0 && loreInjectionOn) {
        nextAction = {
            id: 'continue',
            label: 'Continue roleplay',
            ready: true,
            readyText: 'Ready',
            missingText: 'Ready',
            actionLabel: '',
            targetTab: '',
        };
    }
    if (!nextAction) nextAction = rows.find(row => row.id === 'provider');

    return {
        acceptedCount,
        contextCount,
        enabledLoredecks,
        loreInjectionOn,
        pendingCount,
        providerReady,
        rows,
        selectedLore,
        nextAction,
    };
}
