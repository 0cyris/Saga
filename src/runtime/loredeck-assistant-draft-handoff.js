function normalizeId(value = '') {
    return String(value || '').trim();
}

function normalizeSelectionIds(values = [], normalizePendingIds = null) {
    if (values instanceof Set) {
        return new Set([...values].map(normalizeId).filter(Boolean));
    }
    if (typeof normalizePendingIds === 'function') {
        return new Set(normalizePendingIds(values || []).map(normalizeId).filter(Boolean));
    }
    return new Set((Array.isArray(values) ? values : [values]).map(normalizeId).filter(Boolean));
}

function isCreatorDraftBatch(cached = {}, changes = []) {
    return normalizeId(cached?.source) === 'loredeck_creator'
        || (changes.length > 0 && changes.every(change => normalizeId(change?.source) === 'loredeck_creator'));
}

function getPackId(pack = {}) {
    return normalizeId(pack?.packId || pack?.id || '');
}

export function createLoredeckAssistantDraftHandoffController(deps = {}) {
    const getDraftChanges = typeof deps.getDraftChanges === 'function' ? deps.getDraftChanges : (() => []);
    const toast = typeof deps.toast === 'function' ? deps.toast : (() => {});
    const warn = typeof deps.warn === 'function' ? deps.warn : (() => {});

    async function queueDraftSelection(pack = {}, selectedIds = new Set()) {
        const packId = getPackId(pack);
        const cached = deps.getDraftCacheForPack?.(packId) || {};
        const draftChanges = getDraftChanges(cached);
        const creatorBatch = isCreatorDraftBatch(cached, draftChanges);
        const idSet = normalizeSelectionIds(selectedIds, deps.normalizePendingIds);
        const selected = draftChanges.filter(change => idSet.has(normalizeId(change?.changeId)));
        if (!selected.length) {
            toast(creatorBatch ? 'Select Deck Maker Lorecard drafts to send to review.' : 'Select assistant draft proposals to queue.', 'warning');
            return false;
        }

        let fresh = deps.getFreshPack?.(packId, pack) || pack;
        try {
            fresh = typeof deps.hydratePayload === 'function' ? await deps.hydratePayload(fresh) : fresh;
        } catch (error) {
            warn('[Saga] Loredeck draft handoff payload hydration failed:', error);
            toast(error?.message || 'Loredeck payload could not be loaded before sending drafts to review.', 'warning');
            return false;
        }

        const queued = deps.queuePendingChanges?.(
            fresh,
            selected,
            creatorBatch
                ? `Sent ${selected.length} Deck Maker Lorecard draft${selected.length === 1 ? '' : 's'} to Pending Review.`
                : `Queued ${selected.length} assistant draft proposal${selected.length === 1 ? '' : 's'} for Pending Review.`,
        );
        if (!queued) return false;

        const queuedPersisted = await deps.confirmStorage?.(
            creatorBatch ? 'Deck Maker draft handoff' : 'Assistant draft handoff',
            { creator: false },
        );
        if (!queuedPersisted) return false;

        deps.updateDraftAfterRemoval?.(packId, new Set(selected.map(change => normalizeId(change?.changeId)).filter(Boolean)), selected.length);
        const draftPersisted = await deps.confirmStorage?.(
            creatorBatch ? 'Deck Maker draft review update' : 'Assistant draft review update',
            { payload: false, library: false, creator: creatorBatch },
        );
        if (!draftPersisted) return false;

        deps.refreshDraftSurfaces?.();
        return true;
    }

    async function dropDraftSelection(pack = {}, selectedIds = new Set()) {
        const packId = getPackId(pack);
        const cached = deps.getDraftCacheForPack?.(packId) || {};
        const draftChanges = getDraftChanges(cached);
        const creatorBatch = isCreatorDraftBatch(cached, draftChanges);
        const idSet = normalizeSelectionIds(selectedIds, deps.normalizePendingIds);
        const selected = draftChanges.filter(change => idSet.has(normalizeId(change?.changeId)));
        if (!selected.length) {
            toast(creatorBatch ? 'Select Deck Maker Lorecard drafts to drop.' : 'Select assistant draft proposals to drop.', 'warning');
            return false;
        }

        deps.updateDraftAfterRemoval?.(packId, new Set(selected.map(change => normalizeId(change?.changeId)).filter(Boolean)), 0);
        const draftPersisted = await deps.confirmStorage?.(
            creatorBatch ? 'Deck Maker draft review update' : 'Assistant draft review update',
            { payload: false, library: false, creator: creatorBatch },
        );
        if (!draftPersisted) return false;

        deps.refreshDraftSurfaces?.();
        toast(creatorBatch
            ? `Dropped ${selected.length} Deck Maker Lorecard draft${selected.length === 1 ? '' : 's'}.`
            : `Dropped ${selected.length} assistant draft proposal${selected.length === 1 ? '' : 's'}.`, 'info');
        return true;
    }

    return {
        queueDraftSelection,
        dropDraftSelection,
    };
}
