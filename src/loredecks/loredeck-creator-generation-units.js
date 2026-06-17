function normalizeCreatorTitleId(value = '', fallback = '') {
    const text = String(value || fallback || '')
        .trim()
        .slice(0, 160);
    return text || String(fallback || '').trim();
}

function normalizeCreatorEntryId(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._:-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 140);
}

function normalizeCreatorUnitId(value = '', maxLength = 220) {
    return String(value || '')
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .slice(0, maxLength);
}

export function getLoredeckCreatorGenerationUnitActionId(unit = {}) {
    return String(unit?.meta?.actionId || unit?.actionId || '').trim();
}

export function getLoredeckCreatorGenerationUnitBatchId(unit = {}) {
    return String(unit?.meta?.targetPlanningBatchId || unit?.resultRef?.batchId || unit?.batchId || '').trim();
}

export function buildLoredeckCreatorTitleGenerationUnitId(actionId = '', targetTitleBatch = null, selectedTitleDrafts = []) {
    const action = String(actionId || 'title_batch_draft').trim();
    const batchId = normalizeCreatorTitleId(targetTitleBatch?.id || targetTitleBatch?.label || '', '');
    const selectedIds = Array.isArray(selectedTitleDrafts)
        ? selectedTitleDrafts.map(item => normalizeCreatorTitleId(item?.titleId || item?.id || '', '')).filter(Boolean).sort()
        : [];
    const seed = action === 'title_revision'
        ? (selectedIds.join('_') || 'selected_titles')
        : (batchId || 'next_title_batch');
    return normalizeCreatorUnitId(`creator_${action}:${seed}`);
}

export function getLoredeckCreatorPlanningBatchIdentity(batch = {}) {
    const id = normalizeCreatorTitleId(batch?.id || batch?.label || '', '');
    return {
        id,
        label: String(batch?.label || id || 'Context Set').trim(),
    };
}

export function buildLoredeckCreatorPlanningGenerationUnitId(targetPlanningBatch = null, targetApprovedTitles = []) {
    const batchIdentity = getLoredeckCreatorPlanningBatchIdentity(targetPlanningBatch || {});
    const titleSeed = Array.isArray(targetApprovedTitles)
        ? targetApprovedTitles
            .map(item => normalizeCreatorTitleId(item?.titleId || item?.id || item?.title || '', ''))
            .filter(Boolean)
            .sort()
            .join('_')
        : '';
    const seed = `${batchIdentity.id || 'next_context_set'}:${titleSeed || 'approved_titles'}`;
    return normalizeCreatorUnitId(`creator_planning_batch:${seed}`);
}

export function getLoredeckCreatorEntryTargetIds(targetTitles = []) {
    return new Set((Array.isArray(targetTitles) ? targetTitles : [])
        .map(draft => normalizeCreatorEntryId(draft?.titleId || draft?.id || draft?.targetEntryId || ''))
        .filter(Boolean));
}

export function buildLoredeckCreatorEntryGenerationUnitId(targetPlanningBatch = null, targetTitles = []) {
    const batchId = normalizeCreatorTitleId(targetPlanningBatch?.id || targetPlanningBatch?.label || '', '');
    const titleSeed = [...getLoredeckCreatorEntryTargetIds(targetTitles)].sort().join('_') || 'target_titles';
    return normalizeCreatorUnitId(`creator_entry_micro_batch:${batchId || 'context_set'}:${titleSeed}`);
}

export function createLoredeckCreatorEntryChangeId(change = {}, batch = {}, unitId = '', index = 0) {
    const batchId = normalizeCreatorTitleId(batch?.id || batch?.label || '', '');
    const entryId = normalizeCreatorEntryId((change.affectedEntryIds || [])[0] || Object.keys(change.payload?.entryOverrides || {})[0] || '');
    const seed = [batchId || 'batch', entryId || change.title || index + 1, unitId || 'unit'].filter(Boolean).join('_');
    return normalizeCreatorUnitId(`creator_entry_${seed}`);
}
