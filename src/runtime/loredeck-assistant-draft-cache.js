function normalizePackId(value = '') {
    return String(value || '').trim();
}

function normalizeDraftChangeIds(values = []) {
    const raw = Array.isArray(values) ? values : [values];
    const seen = new Set();
    const out = [];
    for (const value of raw) {
        const id = String(value || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

export function createLoredeckAssistantDraftCacheController(deps = {}) {
    const cache = deps.cache instanceof Map ? deps.cache : new Map();
    const getDraftChanges = typeof deps.getDraftChanges === 'function' ? deps.getDraftChanges : (() => []);
    const countQualityWarnings = typeof deps.countQualityWarnings === 'function' ? deps.countQualityWarnings : (() => 0);

    function getRecord(packId = '') {
        const id = normalizePackId(packId);
        return id ? (cache.get(id) || {}) : {};
    }

    function setRecord(packId = '', record = {}) {
        const id = normalizePackId(packId);
        if (!id) return record || {};
        cache.set(id, record || {});
        return record || {};
    }

    function deleteRecord(packId = '') {
        const id = normalizePackId(packId);
        return id ? cache.delete(id) : false;
    }

    function getSelectedDraftIds(record = {}) {
        const changes = getDraftChanges(record);
        const validIds = new Set(changes.map(change => String(change?.changeId || '').trim()).filter(Boolean));
        if (!Object.prototype.hasOwnProperty.call(record || {}, 'selectedDraftChangeIds')) {
            return new Set(validIds);
        }
        return new Set(normalizeDraftChangeIds(record.selectedDraftChangeIds || []).filter(id => validIds.has(id)));
    }

    function normalizeMutableRecord(record = {}) {
        const normalized = {
            ...(record || {}),
            draftChanges: getDraftChanges(record || {}),
        };
        if (Object.prototype.hasOwnProperty.call(record || {}, 'selectedDraftChangeIds')) {
            normalized.selectedDraftChangeIds = normalizeDraftChangeIds(record.selectedDraftChangeIds || []);
        } else {
            delete normalized.selectedDraftChangeIds;
        }
        return normalized;
    }

    function normalizeStoredRecord(record = {}) {
        const normalized = normalizeMutableRecord(record);
        if (!normalized.draftChanges.length) {
            delete normalized.draftChanges;
            delete normalized.selectedDraftChangeIds;
        }
        normalized.qualityWarningCount = countQualityWarnings(normalized.draftChanges || []);
        return normalized;
    }

    function updateRecord(packId = '', mutator = null) {
        const id = normalizePackId(packId);
        if (!id || typeof mutator !== 'function') return null;
        const current = normalizeMutableRecord(getRecord(id));
        const next = mutator(current) || current;
        return setRecord(id, normalizeStoredRecord(next));
    }

    function setDraftSelection(packId = '', changeId = '', selected = false) {
        const id = normalizePackId(changeId);
        if (!id) return null;
        return updateRecord(packId, record => {
            const selectedIds = getSelectedDraftIds(record);
            if (selected) selectedIds.add(id);
            else selectedIds.delete(id);
            return { ...record, selectedDraftChangeIds: [...selectedIds] };
        });
    }

    function setDraftSelectionBulk(packId = '', mode = 'all') {
        return updateRecord(packId, record => {
            const changes = getDraftChanges(record);
            return {
                ...record,
                selectedDraftChangeIds: mode === 'all'
                    ? changes.map(change => String(change?.changeId || '').trim()).filter(Boolean)
                    : [],
            };
        });
    }

    return {
        getRecord,
        setRecord,
        deleteRecord,
        getSelectedDraftIds,
        updateRecord,
        setDraftSelection,
        setDraftSelectionBulk,
    };
}
