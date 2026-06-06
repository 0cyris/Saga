import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorProjectCardModel,
  buildLoredeckCreatorProjectCardModels,
  getLoredeckCreatorProjectCounts,
  getLoredeckCreatorProjectNextAction,
  getLoredeckCreatorProjectStageDescriptor,
  inferLoredeckCreatorProjectStage,
  isLoredeckCreatorProjectUnfinished,
  normalizeLoredeckCreatorProjectStage,
} from '../loredeck-creator-projects.js';

assert.equal(normalizeLoredeckCreatorProjectStage('Title Drafting!'), 'titles_drafting');
assert.equal(normalizeLoredeckCreatorProjectStage('not a stage'), 'intake');

const arlongPack = {
  packId: 'one-piece-arlong-park-generated',
  title: 'One Piece: Arlong Park',
  description: 'Generated Arlong Park draft deck.',
  fandom: 'One Piece',
  era: 'Arlong Park Arc',
  library: { folderId: 'folder_one_piece__east_blue' },
  stats: {
    entryCount: 12,
    fileCount: 2,
  },
  entryOverrides: {
    arlong_pressure: {},
    nami_debt: {},
  },
};

const arlongReadiness = {
  ready: false,
  blockers: [],
  warnings: ['No tag registry is saved yet.'],
  acceptedEntryCount: 2,
  pendingChangeCount: 1,
  draftChangeCount: 3,
  pipeline: {
    titleBatchCount: 2,
    titleBatchDraftedCount: 2,
    approvedTitleCount: 8,
    queuedPlanningBatchCount: 2,
    acceptedPlanningBatchCount: 1,
    remainingEntryCount: 5,
  },
};

const titleJob = {
  jobId: 'creator_one_piece_arlong',
  fandom: 'One Piece',
  scope: 'Arlong Park Arc',
  granularity: 'focused',
  brief: {
    title: 'Arlong Park Arc',
    packId: 'one-piece-arlong-park-generated',
    coverageSummary: 'Arlong, Nami, Cocoyasi Village, and Straw Hat intervention.',
  },
  titleDrafts: [
    { titleId: 'arlong_pressure', title: 'Arlong pressure over Cocoyasi Village' },
    { titleId: 'nami_debt', title: 'Nami debt and map room coercion' },
    { titleId: 'zoro_wound', title: 'Zoro wound pressure' },
  ],
  approvedTitleDraftIds: ['arlong_pressure', 'nami_debt'],
  planningBatchQueuedIds: ['batch_1', 'batch_2'],
  planningBatchAcceptedIds: ['batch_1'],
  generatedPackId: 'one-piece-arlong-park-generated',
  status: 'draft',
  updatedAt: 200,
  createdAt: 100,
};

assert.equal(inferLoredeckCreatorProjectStage(titleJob), 'planning_accepted');

const model = buildLoredeckCreatorProjectCardModel(titleJob, {
  packsById: { [arlongPack.packId]: arlongPack },
  readinessByPackId: { [arlongPack.packId]: arlongReadiness },
});

assert.equal(model.id, 'creator_one_piece_arlong');
assert.equal(model.title, 'Arlong Park Arc');
assert.equal(model.generatedPackId, 'one-piece-arlong-park-generated');
assert.equal(model.folderId, 'folder_one_piece__east_blue');
assert.equal(model.stage.id, 'planning_accepted');
assert.equal(model.unfinished, true);
assert.equal(model.counts.approvedTitleCount, 8);
assert.equal(model.counts.planningAcceptedCount, 1);
assert.equal(model.counts.draftChangeCount, 3);
assert.equal(model.counts.pendingChangeCount, 1);
assert.equal(model.nextAction.label, 'Review Draft Lorecards');
assert.ok(model.chips.some(chip => chip.label === 'Generated'));
assert.ok(model.chips.some(chip => chip.label === '3 drafted'));

const running = {
  ...titleJob,
  status: 'running',
  currentStage: 'entries_drafting',
  activeGeneration: { status: 'running', label: 'Drafting Lorecard Batch' },
};
const runningStage = getLoredeckCreatorProjectStageDescriptor(running);
assert.equal(runningStage.id, 'entries_drafting');
assert.equal(runningStage.label, 'Drafting Lorecard Batch');
assert.equal(runningStage.tone, 'running');
assert.equal(getLoredeckCreatorProjectNextAction(running).disabled, true);

const reattachedRunningStage = getLoredeckCreatorProjectStageDescriptor({
  ...titleJob,
  currentStage: 'outline_drafting',
}, {
  activeGenerationByJobId: new Map([
    [titleJob.jobId, { status: 'running', label: 'Drafting Story Outline' }],
  ]),
});
assert.equal(reattachedRunningStage.id, 'outline_drafting');
assert.equal(reattachedRunningStage.label, 'Drafting Story Outline');
assert.equal(reattachedRunningStage.tone, 'running');

const blocked = {
  jobId: 'creator_broken',
  fandom: 'Naruto',
  scope: 'Chunin Exams',
  status: 'blocked',
  errors: ['The model response could not be parsed.'],
};
assert.equal(getLoredeckCreatorProjectStageDescriptor(blocked).id, 'blocked');
assert.equal(getLoredeckCreatorProjectNextAction(blocked).label, 'Review Error');
assert.equal(isLoredeckCreatorProjectUnfinished(blocked), true);

const complete = {
  jobId: 'creator_complete',
  projectTitle: 'Finished Deck',
  status: 'complete',
  currentStage: 'complete',
  generatedPackId: 'finished-pack',
  updatedAt: 500,
};
const completeReadiness = {
  ready: true,
  blockers: [],
  warnings: [],
  acceptedEntryCount: 6,
  pendingChangeCount: 0,
  draftChangeCount: 0,
};
assert.equal(isLoredeckCreatorProjectUnfinished(complete, {
  packsById: { 'finished-pack': { packId: 'finished-pack', title: 'Finished Deck' } },
  readinessByPackId: { 'finished-pack': completeReadiness },
}), false);

const counts = getLoredeckCreatorProjectCounts(titleJob, {
  generatedPack: arlongPack,
  readiness: arlongReadiness,
});
assert.equal(counts.lorecardCount, 12);
assert.equal(counts.fileCount, 2);
assert.equal(counts.entryRemainingCount, 5);

const registryModels = buildLoredeckCreatorProjectCardModels({
  jobs: {
    older: { jobId: 'older', fandom: 'Bleach', scope: 'Soul Society', updatedAt: 10 },
    active: titleJob,
    complete,
    archived: { jobId: 'archived', archived: true, updatedAt: 999 },
  },
}, {
  packsById: {
    [arlongPack.packId]: arlongPack,
    'finished-pack': { packId: 'finished-pack', title: 'Finished Deck' },
  },
  readinessByPackId: {
    [arlongPack.packId]: arlongReadiness,
    'finished-pack': completeReadiness,
  },
});
assert.deepEqual(registryModels.map(item => item.id), ['creator_one_piece_arlong', 'older']);

const allModels = buildLoredeckCreatorProjectCardModels({
  jobs: {
    active: titleJob,
    complete,
    archived: { jobId: 'archived', archived: true, updatedAt: 999 },
  },
}, {
  includeComplete: true,
  includeArchived: true,
  packsById: {
    [arlongPack.packId]: arlongPack,
    'finished-pack': { packId: 'finished-pack', title: 'Finished Deck' },
  },
  readinessByPackId: {
    [arlongPack.packId]: arlongReadiness,
    'finished-pack': completeReadiness,
  },
});
assert.deepEqual(allModels.map(item => item.id), ['archived', 'creator_complete', 'creator_one_piece_arlong']);

console.log('Loredeck Creator project card model tests passed.');
