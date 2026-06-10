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
            label: 'Loredeck loaded',
            ready: enabledLoredecks > 0,
            readyText: `${enabledLoredecks} loaded`,
            missingText: 'No Loredeck loaded',
            actionLabel: 'Choose Loredeck',
            targetTab: 'loredecks',
        },
        {
            id: 'context',
            label: 'Story Context set',
            ready: enabledLoredecks > 0 && contextCount > 0,
            readyText: `${contextCount} Context row${contextCount === 1 ? '' : 's'} set`,
            missingText: enabledLoredecks > 0 ? 'Story position missing' : 'Load a Loredeck first',
            actionLabel: enabledLoredecks > 0 ? 'Set Context' : 'Choose Loredeck',
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
