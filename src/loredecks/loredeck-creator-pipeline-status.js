/**
 * Pure status helpers for Loredeck Creator pipeline rows.
 */

export function getLoredeckCreatorLorecardsStageState(options = {}) {
    const planningComplete = options.planningComplete === true;
    const generating = options.generating === true;
    const lorecardsComplete = options.lorecardsComplete === true;
    const remainingEntryCount = Math.max(0, Number(options.remainingEntryCount) || 0);
    const draftChangeCount = Math.max(0, Number(options.draftChangeCount) || 0);
    const pendingLorecardCount = Math.max(0, Number(options.pendingLorecardCount) || 0);
    const approvedTitleCount = Math.max(0, Number(options.approvedTitleCount) || 0);

    if (!planningComplete) {
        return {
            status: 'locked',
            detail: 'Locked',
        };
    }
    if (generating) {
        return {
            status: 'generating',
            detail: remainingEntryCount
                ? `${remainingEntryCount} remaining${draftChangeCount ? `, ${draftChangeCount} drafts` : ''}`
                : (draftChangeCount ? `${draftChangeCount} drafts` : (pendingLorecardCount ? `${pendingLorecardCount} pending` : `${approvedTitleCount} remaining`)),
        };
    }
    if (lorecardsComplete) {
        return {
            status: 'approved',
            detail: 'Approved',
        };
    }
    if (!remainingEntryCount && pendingLorecardCount) {
        return {
            status: 'approved',
            detail: `${pendingLorecardCount} pending`,
        };
    }
    if (remainingEntryCount) {
        return {
            status: 'ready',
            detail: `${remainingEntryCount} remaining${draftChangeCount ? `, ${draftChangeCount} drafts` : ''}`,
        };
    }
    if (draftChangeCount) {
        return {
            status: 'needs-review',
            detail: `${draftChangeCount} drafts`,
        };
    }
    return {
        status: 'ready',
        detail: `${approvedTitleCount} remaining`,
    };
}
