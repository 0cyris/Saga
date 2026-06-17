function normalizePackId(value = '') {
    return String(value || '').trim();
}

function createRecordCache(initialCache = null) {
    return initialCache instanceof Map ? initialCache : new Map();
}

export function createLoredeckPreviewCacheController(deps = {}) {
    const manifestPreviewCache = createRecordCache(deps.manifestPreviewCache);
    const entryPreviewCache = createRecordCache(deps.entryPreviewCache);
    const timelineRegistryCache = createRecordCache(deps.timelineRegistryCache);
    const tagRegistryCache = createRecordCache(deps.tagRegistryCache);

    function getFrom(cache, packId = '', fallback = null) {
        const id = normalizePackId(packId);
        return id ? (cache.get(id) || fallback) : fallback;
    }

    function setIn(cache, packId = '', record = null) {
        const id = normalizePackId(packId);
        if (!id) return record;
        cache.set(id, record);
        return record;
    }

    function deleteFrom(cache, packId = '') {
        const id = normalizePackId(packId);
        return id ? cache.delete(id) : false;
    }

    function clearPackCaches(packId = '', options = {}) {
        const id = normalizePackId(packId);
        if (!id) return false;
        const removed = [
            deleteFrom(manifestPreviewCache, id),
            deleteFrom(entryPreviewCache, id),
            deleteFrom(timelineRegistryCache, id),
            deleteFrom(tagRegistryCache, id),
        ].some(Boolean);
        if (options.clearDraftCache === true) deps.clearDraftCache?.(id);
        return removed;
    }

    function getManifestPreview(packId = '', fallback = null) {
        return getFrom(manifestPreviewCache, packId, fallback);
    }

    function setManifestPreview(packId = '', record = null) {
        return setIn(manifestPreviewCache, packId, record);
    }

    function deleteManifestPreview(packId = '') {
        return deleteFrom(manifestPreviewCache, packId);
    }

    function getManifestHealth(packId = '') {
        return getManifestPreview(packId, null)?.health || null;
    }

    function getEntryPreview(packId = '', fallback = null) {
        return getFrom(entryPreviewCache, packId, fallback);
    }

    function setEntryPreview(packId = '', record = null) {
        return setIn(entryPreviewCache, packId, record);
    }

    function deleteEntryPreview(packId = '') {
        return deleteFrom(entryPreviewCache, packId);
    }

    function getTimelineRegistry(packId = '', fallback = null) {
        return getFrom(timelineRegistryCache, packId, fallback);
    }

    function setTimelineRegistry(packId = '', record = null) {
        return setIn(timelineRegistryCache, packId, record);
    }

    function deleteTimelineRegistry(packId = '') {
        return deleteFrom(timelineRegistryCache, packId);
    }

    function getTagRegistry(packId = '', fallback = null) {
        return getFrom(tagRegistryCache, packId, fallback);
    }

    function setTagRegistry(packId = '', record = null) {
        return setIn(tagRegistryCache, packId, record);
    }

    function deleteTagRegistry(packId = '') {
        return deleteFrom(tagRegistryCache, packId);
    }

    return {
        clearPackCaches,
        getManifestPreview,
        setManifestPreview,
        deleteManifestPreview,
        getManifestHealth,
        getEntryPreview,
        setEntryPreview,
        deleteEntryPreview,
        getTimelineRegistry,
        setTimelineRegistry,
        deleteTimelineRegistry,
        getTagRegistry,
        setTagRegistry,
        deleteTagRegistry,
    };
}
