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

function toIdSet(value = []) {
    if (value instanceof Set) return value;
    if (!Array.isArray(value)) return new Set();
    return new Set(value.map(cleanId).filter(Boolean));
}

function getOrCreateBatchModel(rowsById, rawBatch = {}, fallbackOrder = 0) {
    const id = cleanId(rawBatch?.id || rawBatch?.creatorTitleBatchId || rawBatch?.batchId || 'unbatched') || 'unbatched';
    if (!rowsById.has(id)) {
        rowsById.set(id, {
            id,
            label: cleanId(rawBatch?.label || rawBatch?.creatorTitleBatchLabel || rawBatch?.batchLabel || id),
            summary: cleanId(rawBatch?.summary || rawBatch?.contextRole || ''),
            order: Number.isFinite(Number(rawBatch?.order)) ? Number(rawBatch.order) : fallbackOrder,
            approvedCount: 0,
            handledCount: 0,
            remainingCount: 0,
            remainingTitles: [],
        });
    }
    return rowsById.get(id);
}

export function getLoredeckCreatorEntryDraftBatchModels(options = {}) {
    const batches = Array.isArray(options.batches) ? options.batches : [];
    const drafts = Array.isArray(options.drafts) ? options.drafts : [];
    const remainingIds = toIdSet(
        Array.isArray(options.remainingDrafts)
            ? options.remainingDrafts.map(getLoredeckCreatorEntryDraftTitleId)
            : options.remainingTitleIds
    );
    const rowsById = new Map();
    batches.forEach((batch, index) => {
        getOrCreateBatchModel(rowsById, batch, index + 1);
    });
    for (const draft of drafts) {
        const batch = getOrCreateBatchModel(rowsById, {
            id: getLoredeckCreatorEntryDraftBatchId(draft),
            label: draft.creatorTitleBatchLabel,
        }, rowsById.size + 1);
        const titleId = getLoredeckCreatorEntryDraftTitleId(draft);
        batch.approvedCount += 1;
        if (titleId && remainingIds.has(titleId)) {
            batch.remainingCount += 1;
            batch.remainingTitles.push(draft);
        }
    }
    for (const batch of rowsById.values()) {
        batch.handledCount = Math.max(0, batch.approvedCount - batch.remainingCount);
    }
    return [...rowsById.values()]
        .filter(batch => batch.approvedCount > 0)
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}
