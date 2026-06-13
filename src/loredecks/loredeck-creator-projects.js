/**
 * loredeck-creator-projects.js -- Saga
 * UI-free card models for resumable Loredeck Creator projects.
 */

const MAX_CHIPS = 8;

const STAGE_DEFINITIONS = [
  { id: 'intake', label: 'Intake', progress: 5, tone: 'neutral', nextLabel: 'Draft Brief', nextStage: 'brief_drafted' },
  { id: 'brief_drafted', label: 'Brief Review', progress: 15, tone: 'review', nextLabel: 'Review Brief', nextStage: 'brief_approved' },
  { id: 'brief_approved', label: 'Brief Approved', progress: 25, tone: 'neutral', nextLabel: 'Draft Outline', nextStage: 'outline_drafted' },
  { id: 'outline_drafting', label: 'Drafting Outline', progress: 30, tone: 'running', nextLabel: 'Generating...', nextStage: 'outline_drafted' },
  { id: 'outline_drafted', label: 'Outline Review', progress: 35, tone: 'review', nextLabel: 'Review Outline', nextStage: 'outline_approved' },
  { id: 'outline_approved', label: 'Outline Approved', progress: 45, tone: 'neutral', nextLabel: 'Draft Titles', nextStage: 'titles_drafted' },
  { id: 'titles_drafting', label: 'Drafting Titles', progress: 50, tone: 'running', nextLabel: 'Generating...', nextStage: 'titles_drafted' },
  { id: 'titles_drafted', label: 'Title Review', progress: 58, tone: 'review', nextLabel: 'Review Titles', nextStage: 'titles_approved' },
  { id: 'titles_approved', label: 'Titles Approved', progress: 66, tone: 'neutral', nextLabel: 'Draft Context & Tags', nextStage: 'planning_queued' },
  { id: 'planning_drafting', label: 'Drafting Context & Tags', progress: 70, tone: 'running', nextLabel: 'Generating...', nextStage: 'planning_queued' },
  { id: 'planning_queued', label: 'Context & Tags Review', progress: 76, tone: 'review', nextLabel: 'Review Context & Tags', nextStage: 'planning_accepted' },
  { id: 'planning_accepted', label: 'Context & Tags Accepted', progress: 82, tone: 'neutral', nextLabel: 'Draft Lorecards', nextStage: 'entries_drafted' },
  { id: 'entries_drafting', label: 'Drafting Lorecards', progress: 88, tone: 'running', nextLabel: 'Generating...', nextStage: 'entries_drafted' },
  { id: 'entries_drafted', label: 'Lorecard Review', progress: 92, tone: 'review', nextLabel: 'Review Lorecards', nextStage: 'health_review' },
  { id: 'health_review', label: 'Health Review', progress: 96, tone: 'review', nextLabel: 'Validate & Finalize', nextStage: 'complete' },
  { id: 'complete', label: 'Ready', progress: 100, tone: 'success', nextLabel: 'Open Loredeck', nextStage: 'complete' },
  { id: 'blocked', label: 'Needs Attention', progress: 0, tone: 'warning', nextLabel: 'Review Error', nextStage: 'blocked' },
];

const STAGE_LOOKUP = new Map(STAGE_DEFINITIONS.map(definition => [definition.id, Object.freeze({ ...definition })]));

const STAGE_ALIASES = Object.freeze({
  title_drafting: 'titles_drafting',
  title_drafted: 'titles_drafted',
  title_approved: 'titles_approved',
  entry_drafting: 'entries_drafting',
  entry_drafted: 'entries_drafted',
  lorecard_drafting: 'entries_drafting',
  lorecard_drafted: 'entries_drafted',
  lorecards_drafting: 'entries_drafting',
  lorecards_drafted: 'entries_drafted',
  context_drafted: 'planning_queued',
  tags_drafted: 'planning_queued',
  planning_drafted: 'planning_queued',
  ready: 'complete',
  finalized: 'complete',
});

export const LOREDECK_CREATOR_PROJECT_STAGE_ORDER = Object.freeze(STAGE_DEFINITIONS.map(definition => definition.id));

export const LOREDECK_CREATOR_PROJECT_STAGE_DEFINITIONS = Object.freeze(
  STAGE_DEFINITIONS.map(definition => STAGE_LOOKUP.get(definition.id))
);

function cleanString(value = '', maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength).trim();
}

function cleanStage(value = '') {
  const stage = cleanString(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (STAGE_ALIASES[stage]) return STAGE_ALIASES[stage];
  return STAGE_LOOKUP.has(stage) ? stage : '';
}

function cleanNumber(value = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value);
  return [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function objectValues(value) {
  return Object.values(asObject(value));
}

function uniqueIdList(value = []) {
  const output = [];
  const seen = new Set();
  for (const raw of asArray(value)) {
    const id = cleanString(raw, 180);
    if (!id) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(id);
  }
  return output;
}

function getMapValue(source, key) {
  if (!key) return null;
  if (source instanceof Map) return source.get(key) || null;
  if (typeof source === 'function') return source(key) || null;
  const object = asObject(source);
  return object[key] || null;
}

function getPackIdForJob(job = {}) {
  return cleanString(job.generatedPackId || job.brief?.packId || job.generatedPack?.packId || '', 180);
}

function getGeneratedPackForJob(job = {}, context = {}) {
  return context.generatedPack || context.pack || getMapValue(context.packsById, getPackIdForJob(job));
}

function getReadinessForPack(pack = null, context = {}) {
  const packId = cleanString(pack?.packId || '', 180);
  return context.readiness || getMapValue(context.readinessByPackId, packId) || null;
}

function getActiveGenerationForJob(job = {}, context = {}) {
  return job.activeGeneration || context.activeGeneration || getMapValue(context.activeGenerationByJobId, job.jobId);
}

function isActiveGenerationRunning(activeGeneration = null) {
  return ['queued', 'running', 'retrying'].includes(String(activeGeneration?.status || '').toLowerCase());
}

function countEntryOverrides(pack = {}) {
  const source = asObject(pack);
  const overrides = asObject(source.entryOverrides);
  return Object.keys(overrides).length;
}

function getPackLorecardCount(pack = {}) {
  const source = asObject(pack);
  return cleanNumber(source.stats?.entryCount || source.entryCount || countEntryOverrides(source));
}

function getPackFileCount(pack = {}) {
  const source = asObject(pack);
  return cleanNumber(source.stats?.fileCount || source.fileCount || asArray(source.files || source.entryFiles).length);
}

function hasErrors(job = {}, readiness = null) {
  return asArray(job.errors).length > 0 || asArray(readiness?.blockers).length > 0;
}

export function normalizeLoredeckCreatorProjectStage(value = '') {
  return cleanStage(value) || 'intake';
}

export function inferLoredeckCreatorProjectStage(job = {}, context = {}) {
  const activeGeneration = getActiveGenerationForJob(job, context);
  if (isActiveGenerationRunning(activeGeneration) && job.currentStage) return normalizeLoredeckCreatorProjectStage(job.currentStage);
  if (job.status === 'running' && job.currentStage) return normalizeLoredeckCreatorProjectStage(job.currentStage);
  if (job.status === 'blocked' || job.blocked === true) return 'blocked';
  if (job.status === 'complete' || job.complete === true) return 'complete';
  const explicit = cleanStage(job.currentStage);
  if (explicit && explicit !== 'intake') return explicit;
  if (job.entryDraftCount || job.entryDraftedAt) return 'entries_drafted';
  if (uniqueIdList(job.planningBatchAcceptedIds).length || job.planningAcceptedAt) return 'planning_accepted';
  if (uniqueIdList(job.planningBatchQueuedIds).length || job.planningQueuedCount || job.planningQueuedAt) return 'planning_queued';
  if (uniqueIdList(job.approvedTitleDraftIds).length || job.approvedTitleDraftAt) return 'titles_approved';
  if (asArray(job.titleDrafts).length || job.titleDraftedAt) return 'titles_drafted';
  if (job.outlineApproved && job.outline) return 'outline_approved';
  if (job.outline || job.outlineDraftedAt) return 'outline_drafted';
  if (job.approved || job.approvedAt) return 'brief_approved';
  if (job.brief) return 'brief_drafted';
  return explicit || 'intake';
}

export function getLoredeckCreatorProjectStageDescriptor(job = {}, context = {}) {
  const readiness = getReadinessForPack(getGeneratedPackForJob(job, context), context);
  const stageId = inferLoredeckCreatorProjectStage(job, context);
  const activeGeneration = getActiveGenerationForJob(job, context);
  const base = STAGE_LOOKUP.get(stageId) || STAGE_LOOKUP.get('intake');
  const running = job.status === 'running' || isActiveGenerationRunning(activeGeneration);
  const blocked = job.status === 'blocked' || stageId === 'blocked' || hasErrors(job, readiness);
  const tone = blocked ? 'warning' : (running ? 'running' : base.tone);
  const stageIndex = Math.max(0, LOREDECK_CREATOR_PROJECT_STAGE_ORDER.indexOf(stageId));
  return {
    id: stageId,
    label: running && activeGeneration?.label ? cleanString(activeGeneration.label, 120) : base.label,
    tone,
    progress: blocked && base.id === 'blocked' ? 0 : base.progress,
    index: stageIndex,
    total: LOREDECK_CREATOR_PROJECT_STAGE_ORDER.length,
    isRunning: running,
    isBlocked: blocked,
    isComplete: stageId === 'complete' && !blocked,
  };
}

export function getLoredeckCreatorProjectCounts(job = {}, context = {}) {
  const pack = getGeneratedPackForJob(job, context);
  const readiness = getReadinessForPack(pack, context);
  const pipeline = asObject(readiness?.pipeline);
  const generationRuns = objectValues(job.generationRuns);
  const generationUnits = objectValues(job.generationUnits);
  const titleDraftCount = asArray(job.titleDrafts).length;
  const approvedTitleCount = cleanNumber(pipeline.approvedTitleCount || uniqueIdList(job.approvedTitleDraftIds).length);
  const planningQueuedCount = cleanNumber(
    pipeline.queuedPlanningBatchCount || uniqueIdList(job.planningBatchQueuedIds).length || job.planningQueuedCount
  );
  const planningAcceptedCount = cleanNumber(
    pipeline.acceptedPlanningBatchCount || uniqueIdList(job.planningBatchAcceptedIds).length
  );
  const entryDraftCount = cleanNumber(job.entryDraftCount || readiness?.draftChangeCount);
  return {
    titleDraftCount,
    approvedTitleCount,
    titleBatchCount: cleanNumber(pipeline.titleBatchCount || asArray(job.batches?.titleBatches || job.titleBatch?.batches).length),
    titleBatchDraftedCount: cleanNumber(pipeline.titleBatchDraftedCount || uniqueIdList(job.titleBatchDraftedIds).length),
    planningQueuedCount,
    planningAcceptedCount,
    entryDraftCount,
    entryRemainingCount: cleanNumber(pipeline.remainingEntryCount || job.entryDraftRemainingCount),
    acceptedEntryCount: cleanNumber(readiness?.acceptedEntryCount || pipeline.approvedTitleAcceptedCount || countEntryOverrides(pack)),
    pendingChangeCount: cleanNumber(readiness?.pendingChangeCount),
    draftChangeCount: cleanNumber(readiness?.draftChangeCount),
    generationRunCount: cleanNumber(generationRuns.length),
    generationUnitCount: cleanNumber(generationUnits.length),
    runningGenerationUnitCount: cleanNumber(generationUnits.filter(unit => ['queued', 'running', 'retrying'].includes(String(unit?.status || '').toLowerCase())).length),
    completedGenerationUnitCount: cleanNumber(generationUnits.filter(unit => String(unit?.status || '').toLowerCase() === 'complete').length),
    failedGenerationUnitCount: cleanNumber(generationUnits.filter(unit => String(unit?.status || '').toLowerCase() === 'failed').length),
    lorecardCount: getPackLorecardCount(pack),
    fileCount: getPackFileCount(pack),
    blockerCount: asArray(readiness?.blockers).length,
    warningCount: asArray(readiness?.warnings).length + asArray(job.warnings).length,
    errorCount: asArray(job.errors).length,
  };
}

function getBriefTitle(job = {}) {
  return cleanString(job.brief?.title || job.brief?.name || '', 160);
}

export function getLoredeckCreatorProjectTitle(job = {}, context = {}) {
  const pack = getGeneratedPackForJob(job, context);
  return cleanString(
    job.projectTitle
      || getBriefTitle(job)
      || job.generatedPackTitle
      || pack?.title
      || (job.fandom && job.scope ? `${job.fandom}: ${job.scope}` : '')
      || job.fandom
      || job.scope
      || job.jobId
      || 'Untitled Creator Project',
    180
  );
}

export function getLoredeckCreatorProjectSubtitle(job = {}, context = {}) {
  const pack = getGeneratedPackForJob(job, context);
  const parts = [];
  if (job.fandom) parts.push(cleanString(job.fandom, 120));
  if (job.scope && cleanString(job.scope, 180).toLowerCase() !== cleanString(job.fandom, 180).toLowerCase()) {
    parts.push(cleanString(job.scope, 180));
  }
  if (!parts.length && pack?.description) return cleanString(pack.description, 220);
  return parts.join(' - ') || 'Generated Loredeck draft';
}

export function getLoredeckCreatorProjectNextAction(job = {}, context = {}) {
  const pack = getGeneratedPackForJob(job, context);
  const readiness = getReadinessForPack(pack, context);
  const stage = getLoredeckCreatorProjectStageDescriptor(job, context);
  const counts = getLoredeckCreatorProjectCounts(job, context);
  const base = STAGE_LOOKUP.get(stage.id) || STAGE_LOOKUP.get('intake');

  if (stage.isRunning) {
    return {
      label: 'Generating...',
      action: 'wait',
      targetStage: stage.id,
      tone: 'running',
      disabled: true,
      tooltip: 'This Creator project already has a generation call in progress.',
    };
  }
  if (stage.isBlocked || counts.errorCount || counts.blockerCount) {
    return {
      label: counts.blockerCount ? 'Review Blockers' : 'Review Error',
      action: 'review_problem',
      targetStage: stage.id,
      tone: 'warning',
      disabled: false,
      tooltip: 'Open the Creator project and resolve the blocking issue before continuing.',
    };
  }
  if (counts.draftChangeCount && counts.entryRemainingCount > 0) {
    return {
      label: 'Draft More Lorecards',
      action: 'draft_lorecards',
      targetStage: 'entries_drafted',
      tone: 'neutral',
      disabled: false,
      tooltip: 'Continue drafting remaining Lorecards; existing draft-review items can stay in review.',
    };
  }
  if (counts.draftChangeCount) {
    return {
      label: 'Review Draft Lorecards',
      action: 'review_drafts',
      targetStage: 'entries_drafted',
      tone: 'review',
      disabled: false,
      tooltip: 'Review the drafted Lorecards before final health and finalization.',
    };
  }
  if (counts.pendingChangeCount) {
    return {
      label: 'Review Pending Lorecards',
      action: 'review_pending',
      targetStage: 'entries_drafted',
      tone: 'review',
      disabled: false,
      tooltip: 'Accept or reject Pending Review Lorecards before finalizing.',
    };
  }
  if (stage.id === 'complete' && readiness?.ready === false) {
    return {
      label: 'Validate & Finalize',
      action: 'finalize',
      targetStage: 'health_review',
      tone: 'review',
      disabled: false,
      tooltip: 'The project was marked ready, but export readiness still has unresolved work.',
    };
  }
  return {
    label: base.nextLabel,
    action: base.nextStage === stage.id ? 'open' : 'continue',
    targetStage: base.nextStage,
    tone: base.tone,
    disabled: false,
    tooltip: `Open this Creator project at ${base.label}.`,
  };
}

export function isLoredeckCreatorProjectUnfinished(job = {}, context = {}) {
  if (!job || typeof job !== 'object' || job.archived === true) return false;
  const pack = getGeneratedPackForJob(job, context);
  const readiness = getReadinessForPack(pack, context);
  const stage = getLoredeckCreatorProjectStageDescriptor(job, context);
  const counts = getLoredeckCreatorProjectCounts(job, context);
  if (stage.isRunning || stage.isBlocked) return true;
  if (counts.draftChangeCount || counts.pendingChangeCount || counts.entryRemainingCount) return true;
  if (readiness?.ready === false) return true;
  return stage.id !== 'complete';
}

function createProjectChipDescriptor(label, tooltip = '', tone = 'neutral') {
  const cleanLabel = cleanString(label, 120);
  if (!cleanLabel) return null;
  return {
    label: cleanLabel,
    tooltip: cleanString(tooltip, 220),
    tone: cleanString(tone, 40) || 'neutral',
  };
}

export function buildLoredeckCreatorProjectChips(job = {}, context = {}) {
  const pack = getGeneratedPackForJob(job, context);
  const stage = getLoredeckCreatorProjectStageDescriptor(job, context);
  const counts = getLoredeckCreatorProjectCounts(job, context);
  const chips = [
    createProjectChipDescriptor(pack ? 'Generated' : 'Draft', pack ? 'This project has a linked Generated Loredeck shell.' : 'This project has not created a Generated Loredeck shell yet.', pack ? 'source' : 'review'),
    createProjectChipDescriptor(stage.label, 'Current Creator stage.', stage.tone),
  ];
  if (counts.approvedTitleCount || counts.titleDraftCount) {
    chips.push(createProjectChipDescriptor(`${counts.approvedTitleCount}/${counts.titleDraftCount} titles`, 'Approved title drafts over total drafted titles.', 'neutral'));
  }
  if (counts.planningQueuedCount || counts.planningAcceptedCount) {
    chips.push(createProjectChipDescriptor(`${counts.planningAcceptedCount}/${counts.planningQueuedCount} Context sets`, 'Accepted Context and Tag planning sets over queued planning sets.', 'neutral'));
  }
  if (counts.acceptedEntryCount || counts.draftChangeCount || counts.pendingChangeCount) {
    chips.push(createProjectChipDescriptor(`${counts.acceptedEntryCount} accepted`, 'Accepted generated Lorecards.', 'success'));
  }
  if (counts.draftChangeCount) chips.push(createProjectChipDescriptor(`${counts.draftChangeCount} drafted`, 'Drafted Lorecards waiting for review.', 'review'));
  if (counts.pendingChangeCount) chips.push(createProjectChipDescriptor(`${counts.pendingChangeCount} pending`, 'Pending Review Lorecards waiting for acceptance or rejection.', 'review'));
  if (counts.blockerCount || counts.errorCount) chips.push(createProjectChipDescriptor(`${counts.blockerCount + counts.errorCount} issue${counts.blockerCount + counts.errorCount === 1 ? '' : 's'}`, 'Blocking Creator or export-readiness issues.', 'warning'));
  return chips.filter(Boolean).slice(0, MAX_CHIPS);
}

export function buildLoredeckCreatorProjectCardModel(job = {}, context = {}) {
  const normalizedJob = asObject(job);
  const pack = getGeneratedPackForJob(normalizedJob, context);
  const readiness = getReadinessForPack(pack, context);
  const stage = getLoredeckCreatorProjectStageDescriptor(normalizedJob, context);
  const counts = getLoredeckCreatorProjectCounts(normalizedJob, context);
  const nextAction = getLoredeckCreatorProjectNextAction(normalizedJob, context);
  const generatedPackId = getPackIdForJob(normalizedJob) || cleanString(pack?.packId || '', 180);
  const updatedAt = cleanNumber(normalizedJob.updatedAt || pack?.updatedAt || normalizedJob.createdAt);
  return {
    kind: 'creator_project',
    id: cleanString(normalizedJob.jobId || generatedPackId || `creator_project_${updatedAt}`, 180),
    jobId: cleanString(normalizedJob.jobId || '', 180),
    generatedPackId,
    folderId: cleanString(normalizedJob.folderId || pack?.library?.folderId || '', 180),
    title: getLoredeckCreatorProjectTitle(normalizedJob, context),
    subtitle: getLoredeckCreatorProjectSubtitle(normalizedJob, context),
    description: cleanString(normalizedJob.summary || normalizedJob.brief?.coverageSummary || pack?.description || normalizedJob.notes || '', 280),
    fandom: cleanString(normalizedJob.fandom || normalizedJob.brief?.fandom || pack?.fandom || '', 160),
    scope: cleanString(normalizedJob.scope || normalizedJob.brief?.scope || pack?.era || '', 240),
    granularity: cleanString(normalizedJob.granularity || normalizedJob.brief?.granularity || '', 80),
    stage,
    progress: stage.progress,
    nextAction,
    chips: buildLoredeckCreatorProjectChips(normalizedJob, context),
    counts,
    hasGeneratedPack: !!pack,
    generatedPack: pack || null,
    readiness: readiness || null,
    archived: normalizedJob.archived === true,
    unfinished: isLoredeckCreatorProjectUnfinished(normalizedJob, context),
    createdAt: cleanNumber(normalizedJob.createdAt),
    updatedAt,
    sortKey: updatedAt || cleanNumber(normalizedJob.createdAt),
  };
}

function getRegistryJobs(registry = {}) {
  if (Array.isArray(registry)) return registry;
  const source = registry?.jobs && typeof registry.jobs === 'object' && !Array.isArray(registry.jobs)
    ? registry.jobs
    : registry;
  return asArray(source).filter(job => job && typeof job === 'object' && !Array.isArray(job));
}

export function buildLoredeckCreatorProjectCardModels(registry = {}, context = {}) {
  const options = asObject(context.options);
  const includeArchived = context.includeArchived === true || options.includeArchived === true;
  const includeComplete = context.includeComplete === true || options.includeComplete === true;
  return getRegistryJobs(registry)
    .map(job => buildLoredeckCreatorProjectCardModel(job, context))
    .filter(model => includeArchived || model.archived !== true)
    .filter(model => includeComplete || model.unfinished)
    .sort((a, b) => (b.sortKey - a.sortKey) || a.title.localeCompare(b.title));
}

export const __loredeckCreatorProjectTestHooks = Object.freeze({
  cleanString,
  getPackIdForJob,
  getGeneratedPackForJob,
  getReadinessForPack,
  uniqueIdList,
});
