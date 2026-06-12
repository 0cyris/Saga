/**
 * Pure selection helpers for Loredeck Creator entry drafting.
 */

function cleanId(value = '') {
    return String(value || '').trim();
}

export function getLoredeckCreatorEntryDraftBatchId(draft = {}) {
    return cleanId(draft?.creatorTitleBatchId || 'unbatched') || 'unbatched';
}

export function getLoredeckCreatorEntryDraftTitleId(draft = {}) {
    return cleanId(draft?.titleId || draft?.id || '');
}

export function isLoredeckCreatorEntryDraftUnhandled(draft = {}, blockedIds = new Set()) {
    const titleId = getLoredeckCreatorEntryDraftTitleId(draft);
    return !!titleId && !blockedIds.has(titleId);
}

export function selectLoredeckCreatorEntryDraftBatchId(drafts = [], batchOrder = [], blockedIds = new Set()) {
    const pool = Array.isArray(drafts) ? drafts : [];
    const orderedBatchIds = Array.isArray(batchOrder)
        ? batchOrder.map(cleanId).filter(Boolean)
        : [];
    for (const batchId of orderedBatchIds) {
        if (pool.some(draft => getLoredeckCreatorEntryDraftBatchId(draft) === batchId && isLoredeckCreatorEntryDraftUnhandled(draft, blockedIds))) {
            return batchId;
        }
    }
    const firstUnhandled = pool.find(draft => isLoredeckCreatorEntryDraftUnhandled(draft, blockedIds));
    return firstUnhandled ? getLoredeckCreatorEntryDraftBatchId(firstUnhandled) : '';
}

export function getLoredeckCreatorUnhandledEntryDrafts(drafts = [], blockedIds = new Set()) {
    const pool = Array.isArray(drafts) ? drafts : [];
    return pool.filter(draft => isLoredeckCreatorEntryDraftUnhandled(draft, blockedIds));
}
