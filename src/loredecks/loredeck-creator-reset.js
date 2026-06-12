export const LOREDECK_CREATOR_RESET_STEPS = Object.freeze([
    Object.freeze({ id: 'scope', label: 'Scope Brief' }),
    Object.freeze({ id: 'outline', label: 'Story Outline' }),
    Object.freeze({ id: 'titles', label: 'Title Pass' }),
    Object.freeze({ id: 'context', label: 'Context Plan' }),
    Object.freeze({ id: 'lorecards', label: 'Lorecards' }),
    Object.freeze({ id: 'review', label: 'Review Queue' }),
    Object.freeze({ id: 'health', label: 'Deck Health' }),
    Object.freeze({ id: 'finalize', label: 'Finalize' }),
]);

const RESET_STEP_INDEX = new Map(LOREDECK_CREATOR_RESET_STEPS.map((step, index) => [step.id, index]));

const OUTLINE_RESET_FIELDS = {
    outline: null,
    outlineApproved: false,
    outlineDraftedAt: null,
    outlineRevisedAt: null,
    outlineApprovedAt: null,
    outlineSummary: '',
    outlineQuestions: [],
    outlineWarnings: [],
};

const TITLE_RESET_FIELDS = {
    titleDrafts: [],
    selectedTitleDraftIds: [],
    approvedTitleDraftIds: [],
    titleBatchDraftedIds: [],
    titleBatch: null,
    titlePassSummary: '',
    titlePassQuestions: [],
    titlePassWarnings: [],
    approvedTitleDraftAt: null,
    titleDraftedAt: null,
    titleRevisedAt: null,
};

const CONTEXT_RESET_FIELDS = {
    planningSummary: '',
    planningQuestions: [],
    planningWarnings: [],
    planningQueuedCount: 0,
    planningBatchQueuedIds: [],
    planningBatchAcceptedIds: [],
    planningCurrentBatchId: '',
    planningCurrentBatchLabel: '',
    planningQueuedAt: null,
    planningAcceptedAt: null,
    generatedPackId: '',
    generatedPackTitle: '',
};

const LORECARD_RESET_FIELDS = {
    draftChanges: [],
    entryDraftSummary: '',
    entryDraftQuestions: [],
    entryDraftWarnings: [],
    entryDraftCount: 0,
    entryDraftLastBatchCount: 0,
    entryDraftLastTargetCount: 0,
    entryDraftRemainingCount: 0,
    entryDraftBatchSize: 0,
    entryDraftCurrentBatchId: '',
    entryDraftCurrentBatchLabel: '',
    entryDraftedAt: null,
};

const FINALIZE_RESET_FIELDS = {
    coverageFinalizeAcknowledgement: null,
};

const GENERATION_STAGE_BY_ACTION = new Map([
    ['brief_draft', 'scope'],
    ['brief_revision', 'scope'],
    ['outline_draft', 'outline'],
    ['outline_revision', 'outline'],
    ['title_batch_draft', 'titles'],
    ['title_batch_redraft', 'titles'],
    ['title_revision', 'titles'],
    ['planning_batch_draft', 'context'],
    ['planning_batch_redraft', 'context'],
    ['entry_batch_draft', 'lorecards'],
    ['entry_multi_batch_draft', 'lorecards'],
]);

const GENERATION_STAGE_BY_STAGE = [
    ['brief', 'scope'],
    ['scope', 'scope'],
    ['story_outline', 'outline'],
    ['outline', 'outline'],
    ['title', 'titles'],
    ['titles', 'titles'],
    ['title_batch', 'titles'],
    ['planning', 'context'],
    ['context', 'context'],
    ['tag', 'context'],
    ['timeline', 'context'],
    ['entry', 'lorecards'],
    ['entries', 'lorecards'],
    ['lorecard', 'lorecards'],
    ['lorecards', 'lorecards'],
    ['review', 'review'],
    ['health', 'health'],
    ['finalize', 'finalize'],
];

function getStepIndex(stepId = '') {
    const id = String(stepId || '').trim();
    return RESET_STEP_INDEX.has(id) ? RESET_STEP_INDEX.get(id) : -1;
}

export function isLoredeckCreatorResetTarget(stepId = '') {
    const index = getStepIndex(stepId);
    return index >= 0 && stepId !== 'finalize';
}

export function getLoredeckCreatorResetStepLabel(stepId = '') {
    const id = String(stepId || '').trim();
    return LOREDECK_CREATOR_RESET_STEPS.find(step => step.id === id)?.label || id || 'Creator step';
}

export function getLoredeckCreatorResetForwardSteps(stepId = '') {
    const index = getStepIndex(stepId);
    if (index < 0) return [];
    return LOREDECK_CREATOR_RESET_STEPS.slice(index + 1);
}

export function shouldRemoveGeneratedPackForCreatorReset(stepId = '') {
    const index = getStepIndex(stepId);
    return index >= 0 && index < getStepIndex('context');
}

export function buildLoredeckCreatorResetWarning(stepId = '') {
    const label = getLoredeckCreatorResetStepLabel(stepId);
    const forwardLabels = getLoredeckCreatorResetForwardSteps(stepId).map(step => step.label);
    const cleared = forwardLabels.length
        ? forwardLabels.length === 1
            ? forwardLabels[0]
            : `${forwardLabels.slice(0, -1).join(', ')}, and ${forwardLabels[forwardLabels.length - 1]}`
        : 'later Creator progress';
    return `This will permanently erase all Creator data after ${label}, including ${cleared} progress. This cannot be undone.`;
}

function hasText(value) {
    return !!String(value || '').trim();
}

function hasArrayItems(value) {
    return Array.isArray(value) && value.length > 0;
}

function hasPlainObjectItems(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function hasPositiveNumber(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
}

function hasTagRegistryData(registry = null) {
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return false;
    return hasPlainObjectItems(registry.tags)
        || hasPlainObjectItems(registry.definitions)
        || hasArrayItems(registry.entries);
}

function hasTimelineRegistryData(registry = null) {
    if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return false;
    return hasArrayItems(registry.anchors)
        || hasArrayItems(registry.windows)
        || hasPlainObjectItems(registry.anchors)
        || hasPlainObjectItems(registry.windows);
}

function hasCreatorPlanningPendingChanges(pack = null) {
    return (Array.isArray(pack?.pendingChanges) ? pack.pendingChanges : [])
        .some(change => String(change?.source || '').trim() === 'loredeck_creator'
            && ['tag', 'timeline_anchor', 'timeline_window'].includes(String(change?.targetKind || '').trim()));
}

function hasCreatorEntryPendingChanges(pack = null) {
    return (Array.isArray(pack?.pendingChanges) ? pack.pendingChanges : [])
        .some(change => isCreatorEntryPendingChange(change));
}

function isCreatorPlanningPendingChange(change = {}) {
    return String(change?.source || '').trim() === 'loredeck_creator'
        && ['tag', 'timeline_anchor', 'timeline_window'].includes(String(change?.targetKind || '').trim());
}

function isCreatorEntryPendingChange(change = {}) {
    return String(change?.source || '').trim() === 'loredeck_creator'
        && (
            String(change?.targetKind || '').trim() === 'entry'
            || (Array.isArray(change?.affectedEntryIds) ? change.affectedEntryIds.length > 0 : false)
        );
}

function isCreatorEntryOverride(entry = null) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    return !!entry.extensions?.sagaLoredeckCreator
        || String(entry.extensions?.sagaLoredeckOverride?.source || '').trim() === 'loredeck_creator'
        || String(entry.source || '').includes(':creator');
}

function hasCreatorPackEntryData(pack = null) {
    if (!hasPlainObjectItems(pack?.entryOverrides)) return false;
    return Object.values(pack.entryOverrides).some(isCreatorEntryOverride);
}

function hasPackHealthData(pack = null) {
    return hasText(pack?.healthStatus) && String(pack.healthStatus || '').trim() !== 'draft'
        || hasPlainObjectItems(pack?.healthIssueStates);
}

function hasFinalizeData(job = null, pack = null) {
    return hasPlainObjectItems(job?.coverageFinalizeAcknowledgement)
        || String(pack?.source?.kind || '').trim() === 'generated_finalized'
        || String(pack?.library?.status || '').trim() === 'finalized';
}

export function getLoredeckCreatorMaterializedResetStages(job = {}, pack = null) {
    const stages = new Set();
    if (job?.approved || job?.brief || job?.approvedAt) stages.add('scope');
    if (job?.outline || job?.outlineApproved || job?.outlineDraftedAt || job?.outlineApprovedAt || job?.outlineSummary) stages.add('outline');
    if (
        hasArrayItems(job?.titleDrafts)
        || hasArrayItems(job?.selectedTitleDraftIds)
        || hasArrayItems(job?.approvedTitleDraftIds)
        || hasArrayItems(job?.titleBatchDraftedIds)
        || job?.titleBatch
        || job?.titleDraftedAt
        || job?.approvedTitleDraftAt
        || hasText(job?.titlePassSummary)
    ) {
        stages.add('titles');
    }
    if (
        hasText(job?.generatedPackId)
        || hasText(pack?.packId)
        || hasPositiveNumber(job?.planningQueuedCount)
        || hasArrayItems(job?.planningBatchQueuedIds)
        || hasArrayItems(job?.planningBatchAcceptedIds)
        || job?.planningQueuedAt
        || job?.planningAcceptedAt
        || hasText(job?.planningSummary)
        || hasTagRegistryData(pack?.tagRegistry)
        || hasTimelineRegistryData(pack?.timelineRegistry)
        || hasCreatorPlanningPendingChanges(pack)
    ) {
        stages.add('context');
    }
    if (
        hasArrayItems(job?.draftChanges)
        || hasPositiveNumber(job?.entryDraftCount)
        || job?.entryDraftedAt
        || hasText(job?.entryDraftSummary)
    ) {
        stages.add('lorecards');
    }
    if (hasCreatorEntryPendingChanges(pack) || hasCreatorPackEntryData(pack)) stages.add('review');
    if (hasPackHealthData(pack)) stages.add('health');
    if (hasFinalizeData(job, pack)) stages.add('finalize');
    return stages;
}

export function hasLoredeckCreatorResetForwardData(job = {}, pack = null, stepId = '') {
    const index = getStepIndex(stepId);
    if (index < 0) return false;
    const materialized = getLoredeckCreatorMaterializedResetStages(job, pack);
    return LOREDECK_CREATOR_RESET_STEPS
        .slice(index + 1)
        .some(step => materialized.has(step.id));
}

export function getLoredeckCreatorResetAvailability(job = {}, pack = null, stepId = '', options = {}) {
    if (!isLoredeckCreatorResetTarget(stepId)) {
        return { show: false, disabled: false, reason: '', forwardSteps: [] };
    }
    const forwardSteps = getLoredeckCreatorResetForwardSteps(stepId);
    const hasForwardData = hasLoredeckCreatorResetForwardData(job, pack, stepId);
    if (!hasForwardData) {
        return { show: false, disabled: false, reason: '', forwardSteps };
    }
    const activeGeneration = options.activeGeneration || job?.activeGeneration || null;
    if (activeGeneration) {
        return {
            show: true,
            disabled: true,
            reason: 'Cancel or finish the current Creator generation before resetting.',
            forwardSteps,
        };
    }
    return {
        show: true,
        disabled: false,
        reason: 'Reset to this step',
        forwardSteps,
    };
}

function inferGenerationResetStage(item = {}) {
    const action = String(item?.actionId || item?.meta?.actionId || item?.sourceActionId || '').trim();
    if (GENERATION_STAGE_BY_ACTION.has(action)) return GENERATION_STAGE_BY_ACTION.get(action);
    const rawStage = String(item?.stage || item?.currentStage || item?.meta?.stage || '').trim().toLowerCase();
    for (const [needle, stage] of GENERATION_STAGE_BY_STAGE) {
        if (rawStage.includes(needle)) return stage;
    }
    return '';
}

function filterGenerationMapForReset(map = {}, targetStepId = '') {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return {};
    const targetIndex = getStepIndex(targetStepId);
    const out = {};
    for (const [id, item] of Object.entries(map)) {
        const stage = inferGenerationResetStage(item);
        const stageIndex = getStepIndex(stage);
        if (stageIndex < 0 || stageIndex <= targetIndex) out[id] = item;
    }
    return out;
}

function clearJobFieldsAfterStep(next = {}, targetStepId = '', stageId = '', fields = {}) {
    if (getStepIndex(targetStepId) < getStepIndex(stageId)) Object.assign(next, fields);
}

export function resetLoredeckCreatorJobAfterStep(job = {}, targetStepId = '') {
    const targetIndex = getStepIndex(targetStepId);
    if (targetIndex < 0) return { ...(job || {}) };
    const next = {
        ...(job || {}),
        activeGeneration: null,
        lastGenerationResult: null,
        errors: [],
        generationRuns: filterGenerationMapForReset(job?.generationRuns, targetStepId),
        generationUnits: filterGenerationMapForReset(job?.generationUnits, targetStepId),
        status: job?.approved ? 'draft' : (job?.brief ? 'draft' : 'needs_input'),
    };
    clearJobFieldsAfterStep(next, targetStepId, 'outline', OUTLINE_RESET_FIELDS);
    clearJobFieldsAfterStep(next, targetStepId, 'titles', TITLE_RESET_FIELDS);
    clearJobFieldsAfterStep(next, targetStepId, 'context', CONTEXT_RESET_FIELDS);
    clearJobFieldsAfterStep(next, targetStepId, 'lorecards', LORECARD_RESET_FIELDS);
    clearJobFieldsAfterStep(next, targetStepId, 'finalize', FINALIZE_RESET_FIELDS);
    if (targetStepId === 'scope') {
        next.creatorCoverage = job?.brief?.creatorCoverage || null;
    }
    return next;
}

function resetPackEntries(next = {}) {
    const retainedEntries = {};
    for (const [id, entry] of Object.entries(next.entryOverrides || {})) {
        if (!isCreatorEntryOverride(entry)) retainedEntries[id] = entry;
    }
    next.entryOverrides = retainedEntries;
    next.stats = {
        ...(next.stats || {}),
        entryCount: Object.keys(retainedEntries).length,
        categoryCounts: Object.values(retainedEntries).reduce((counts, entry) => {
            const category = String(entry?.category || 'other').trim() || 'other';
            counts[category] = (counts[category] || 0) + 1;
            return counts;
        }, {}),
    };
}

function resetPackReview(next = {}) {
    resetPackEntries(next);
    next.pendingChanges = (Array.isArray(next.pendingChanges) ? next.pendingChanges : [])
        .filter(change => isCreatorPlanningPendingChange(change) || !isCreatorEntryPendingChange(change));
}

function resetPackHealth(next = {}) {
    next.healthStatus = 'draft';
    next.healthIssueStates = {};
}

export function resetGeneratedLoredeckPackAfterStep(pack = null, targetStepId = '') {
    if (!pack || typeof pack !== 'object' || Array.isArray(pack)) return null;
    if (shouldRemoveGeneratedPackForCreatorReset(targetStepId)) return null;
    const next = { ...pack };
    if (getStepIndex(targetStepId) < getStepIndex('review')) resetPackReview(next);
    if (getStepIndex(targetStepId) < getStepIndex('health')) resetPackHealth(next);
    return next;
}
