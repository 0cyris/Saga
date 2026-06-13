import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorResetWarning,
  getLoredeckCreatorMaterializedResetStages,
  getLoredeckCreatorResetAvailability,
  getLoredeckCreatorResetForwardSteps,
  hasLoredeckCreatorResetForwardData,
  resetGeneratedLoredeckPackAfterStep,
  resetLoredeckCreatorJobAfterStep,
  shouldRemoveGeneratedPackForCreatorReset,
} from '../../src/loredecks/loredeck-creator-reset.js';
import {
  normalizeLoredeckCreatorJob,
} from '../../src/state/lore-creator-state.js';
import {
  normalizeLoredeckRegistry,
} from '../../src/state/lore-state-normalizers.js';

const fullJob = {
  jobId: 'creator_one_piece_arlong',
  approved: true,
  approvedAt: 100,
  brief: {
    title: 'Arlong Park Arc',
    creatorCoverage: { dimensions: [{ id: 'scope-only' }] },
  },
  outline: { titleBatches: [{ id: 'characters-pressure' }] },
  outlineApproved: true,
  outlineDraftedAt: 200,
  outlineApprovedAt: 220,
  outlineSummary: 'Outline summary',
  titleDrafts: [
    { titleId: 'nami-secret-buyback-bargain', title: 'Nami secret buyback bargain' },
  ],
  selectedTitleDraftIds: ['nami-secret-buyback-bargain'],
  approvedTitleDraftIds: ['nami-secret-buyback-bargain'],
  titleBatchDraftedIds: ['characters-pressure'],
  titlePassSummary: 'Title summary',
  titleDraftedAt: 300,
  approvedTitleDraftAt: 330,
  planningSummary: 'Context summary',
  planningQueuedCount: 1,
  planningBatchQueuedIds: ['characters-pressure'],
  planningBatchAcceptedIds: ['characters-pressure'],
  planningCurrentBatchId: 'characters-pressure',
  planningCurrentBatchLabel: 'Characters and pressure',
  planningQueuedAt: 400,
  planningAcceptedAt: 430,
  generatedPackId: 'generated-one-piece-arlong',
  generatedPackTitle: 'Arlong Park Generated Loredeck',
  draftChanges: [
    {
      changeId: 'draft-nami-secret',
      source: 'loredeck_creator',
      affectedEntryIds: ['nami-secret-buyback-bargain'],
    },
  ],
  entryDraftSummary: 'Lorecard summary',
  entryDraftQuestions: ['Question?'],
  entryDraftWarnings: ['Warning'],
  entryDraftCount: 1,
  entryDraftLastBatchCount: 1,
  entryDraftLastTargetCount: 3,
  entryDraftRemainingCount: 2,
  entryDraftBatchSize: 3,
  entryDraftCurrentBatchId: 'characters-pressure',
  entryDraftCurrentBatchLabel: 'Characters and pressure',
  entryDraftedAt: 500,
  coverageFinalizeAcknowledgement: {
    mode: 'finalize_anyway',
    acknowledgedAt: 600,
  },
  activeGeneration: null,
  lastGenerationResult: { status: 'success', message: 'Done' },
  errors: ['stale downstream error'],
  generationRuns: {
    title: { runId: 'title', actionId: 'title_batch_draft', stage: 'title_batch', status: 'complete' },
    planning: { runId: 'planning', actionId: 'planning_batch_draft', stage: 'planning_batch', status: 'complete' },
    entry: { runId: 'entry', actionId: 'entry_batch_draft', stage: 'entry_micro_batch', status: 'complete' },
  },
  generationUnits: {
    title: { unitId: 'title', meta: { actionId: 'title_batch_draft' }, stage: 'title_batch', status: 'complete' },
    planning: { unitId: 'planning', meta: { actionId: 'planning_batch_draft' }, stage: 'planning_batch', status: 'complete' },
    entry: { unitId: 'entry', meta: { actionId: 'entry_batch_draft' }, stage: 'entry_micro_batch', status: 'complete' },
  },
};

const generatedPack = {
  packId: 'generated-one-piece-arlong',
  type: 'generated',
  title: 'Arlong Park Generated Loredeck',
  entryOverrides: {
    'nami-secret-buyback-bargain': {
      id: 'nami-secret-buyback-bargain',
      category: 'event',
      extensions: { sagaLoredeckCreator: { jobId: 'creator_one_piece_arlong' } },
    },
    'manual-note': {
      id: 'manual-note',
      category: 'knowledge',
      content: 'Manual note added outside Creator.',
    },
  },
  disabledEntryIds: ['obsolete-generated-entry'],
  tagRegistry: {
    schemaVersion: 1,
    tags: {
      'character:nami': { id: 'character:nami', label: 'Nami' },
    },
  },
  timelineRegistry: {
    schemaVersion: 1,
    anchors: [{ id: 'arlong-arrives', label: 'Arlong arrives' }],
    windows: [{ id: 'occupation', label: 'Occupation' }],
  },
  pendingChanges: [
    {
      changeId: 'pending-context',
      source: 'loredeck_creator',
      targetKind: 'tag',
      preview: {
        creatorPlanningBatch: {
          id: 'characters-pressure',
          label: 'Characters and pressure',
        },
      },
    },
    {
      changeId: 'pending-entry',
      source: 'loredeck_creator',
      targetKind: 'entry',
      affectedEntryIds: ['nami-secret-buyback-bargain'],
    },
    {
      changeId: 'pending-entry-legacy',
      source: 'loredeck_creator',
      affectedEntryIds: ['nami-secret-buyback-bargain'],
    },
    {
      changeId: 'manual-pending-entry',
      source: 'manual',
      targetKind: 'entry',
      affectedEntryIds: ['manual-note'],
    },
  ],
  healthStatus: 'warning',
  healthIssueStates: {
    missingTimeline: { status: 'open' },
  },
  stats: {
    entryCount: 2,
    categoryCounts: { event: 1, knowledge: 1 },
  },
};

{
  const forward = getLoredeckCreatorResetForwardSteps('titles').map(step => step.id);
  assert.deepEqual(forward, ['context', 'lorecards', 'review', 'health', 'finalize']);
  const warning = buildLoredeckCreatorResetWarning('titles');
  assert.ok(warning.includes('after Title Pass'));
  assert.ok(warning.includes('Context Plan'));
  assert.ok(warning.includes('Lorecards'));
  assert.ok(warning.includes('Review Queue'));
  assert.ok(warning.includes('Pack Health'));
  assert.ok(warning.includes('Finalize'));
  assert.ok(warning.includes('cannot be undone'));
}

{
  assert.equal(shouldRemoveGeneratedPackForCreatorReset('titles'), true);
  assert.equal(shouldRemoveGeneratedPackForCreatorReset('context'), false);
}

{
  const reset = resetLoredeckCreatorJobAfterStep(fullJob, 'titles');
  assert.equal(reset.outlineApproved, true);
  assert.deepEqual(reset.approvedTitleDraftIds, ['nami-secret-buyback-bargain']);
  assert.deepEqual(reset.planningBatchAcceptedIds, []);
  assert.equal(reset.generatedPackId, '');
  assert.deepEqual(reset.draftChanges, []);
  assert.equal(reset.entryDraftCount, 0);
  assert.equal(reset.coverageFinalizeAcknowledgement, null);
  assert.equal(reset.lastGenerationResult, null);
  assert.deepEqual(Object.keys(reset.generationRuns), ['title']);
  assert.deepEqual(Object.keys(reset.generationUnits), ['title']);

  const persisted = normalizeLoredeckCreatorJob({ ...fullJob, ...reset });
  assert.equal(persisted.currentStage, 'titles_approved');
  assert.equal(Object.hasOwn(persisted, 'generatedPackId'), false);
  assert.equal(Object.hasOwn(persisted, 'planningBatchQueuedIds'), false);
  assert.equal(Object.hasOwn(persisted, 'planningBatchAcceptedIds'), false);
  assert.equal(Object.hasOwn(persisted, 'draftChanges'), false);
  assert.equal(persisted.entryDraftCount, 0);
  assert.equal(Object.hasOwn(persisted, 'lastGenerationResult'), false);
}

{
  const reset = resetLoredeckCreatorJobAfterStep(fullJob, 'context');
  assert.deepEqual(reset.planningBatchAcceptedIds, ['characters-pressure']);
  assert.equal(reset.generatedPackId, 'generated-one-piece-arlong');
  assert.deepEqual(reset.draftChanges, []);
  assert.equal(reset.entryDraftSummary, '');
  assert.equal(reset.entryDraftCount, 0);
  assert.deepEqual(Object.keys(reset.generationRuns), ['title', 'planning']);

  const persisted = normalizeLoredeckCreatorJob({ ...fullJob, ...reset });
  assert.equal(persisted.currentStage, 'planning_queued');
  assert.equal(persisted.generatedPackId, 'generated-one-piece-arlong');
  assert.deepEqual(persisted.planningBatchAcceptedIds, ['characters-pressure']);
  assert.equal(Object.hasOwn(persisted, 'draftChanges'), false);
  assert.equal(persisted.entryDraftCount, 0);
}

{
  const reset = resetLoredeckCreatorJobAfterStep(fullJob, 'scope');
  assert.equal(reset.approved, true);
  assert.equal(reset.outline, null);
  assert.equal(reset.outlineApproved, false);
  assert.deepEqual(reset.titleDrafts, []);
  assert.equal(reset.creatorCoverage, fullJob.brief.creatorCoverage);
}

{
  const reset = resetGeneratedLoredeckPackAfterStep(generatedPack, 'context');
  assert.equal(reset.tagRegistry.tags['character:nami'].label, 'Nami');
  assert.equal(reset.timelineRegistry.anchors[0].id, 'arlong-arrives');
  assert.deepEqual(Object.keys(reset.entryOverrides), ['manual-note']);
  assert.deepEqual(reset.pendingChanges.map(change => change.changeId), ['pending-context', 'manual-pending-entry']);
  assert.equal(reset.healthStatus, 'draft');
  assert.deepEqual(reset.healthIssueStates, {});
  assert.equal(reset.stats.entryCount, 1);
  assert.deepEqual(reset.stats.categoryCounts, { knowledge: 1 });

  const persistedRegistry = normalizeLoredeckRegistry({
    schemaVersion: 1,
    packs: {
      [reset.packId]: reset,
    },
  }, { schemaVersion: 1, packs: {} });
  const persisted = persistedRegistry.packs[reset.packId];
  assert.deepEqual(Object.keys(persisted.entryOverrides), ['manual-note']);
  assert.deepEqual((persisted.pendingChanges || []).map(change => change.changeId), ['pending-context', 'manual-pending-entry']);
  assert.equal(persisted.healthStatus, 'draft');
  assert.equal(Object.hasOwn(persisted, 'healthIssueStates'), false);
  assert.equal(persisted.tagRegistry.tags['character:nami'].label, 'Nami');
  assert.equal(persisted.timelineRegistry.anchors[0].id, 'arlong-arrives');
}

{
  const reset = resetGeneratedLoredeckPackAfterStep(generatedPack, 'lorecards');
  assert.deepEqual(Object.keys(reset.entryOverrides), ['manual-note']);
  assert.deepEqual(reset.pendingChanges.map(change => change.changeId), ['pending-context', 'manual-pending-entry']);
  assert.equal(reset.healthStatus, 'draft');
  assert.equal(reset.tagRegistry.tags['character:nami'].label, 'Nami');
}

{
  const reset = resetGeneratedLoredeckPackAfterStep(generatedPack, 'review');
  assert.equal(reset.entryOverrides['nami-secret-buyback-bargain'].id, 'nami-secret-buyback-bargain');
  assert.deepEqual(reset.pendingChanges.map(change => change.changeId), ['pending-context', 'pending-entry', 'pending-entry-legacy', 'manual-pending-entry']);
  assert.equal(reset.healthStatus, 'draft');
  assert.deepEqual(reset.healthIssueStates, {});
}

{
  const reset = resetGeneratedLoredeckPackAfterStep(generatedPack, 'health');
  assert.equal(reset.healthStatus, 'warning');
  assert.equal(reset.healthIssueStates.missingTimeline.status, 'open');
}

{
  const stages = getLoredeckCreatorMaterializedResetStages(fullJob, generatedPack);
  assert.equal(stages.has('context'), true);
  assert.equal(stages.has('lorecards'), true);
  assert.equal(stages.has('review'), true);
  assert.equal(stages.has('health'), true);
  assert.equal(stages.has('finalize'), true);
  assert.equal(hasLoredeckCreatorResetForwardData(fullJob, generatedPack, 'titles'), true);
  assert.equal(hasLoredeckCreatorResetForwardData(fullJob, generatedPack, 'finalize'), false);
}

{
  const manualOnlyPack = {
    packId: 'generated-manual-only',
    type: 'generated',
    entryOverrides: {
      'manual-note': {
        id: 'manual-note',
        category: 'knowledge',
      },
    },
    pendingChanges: [
      {
        changeId: 'manual-pending-entry',
        source: 'manual',
        targetKind: 'entry',
        affectedEntryIds: ['manual-note'],
      },
    ],
  };
  const stages = getLoredeckCreatorMaterializedResetStages({ approved: true, generatedPackId: manualOnlyPack.packId }, manualOnlyPack);
  assert.equal(stages.has('review'), false, 'Manual pack layers must not make Creator reset controls appear as if later Creator review data exists.');
  assert.equal(hasLoredeckCreatorResetForwardData({ approved: true, generatedPackId: manualOnlyPack.packId }, manualOnlyPack, 'context'), false);
}

{
  const availability = getLoredeckCreatorResetAvailability(
    { ...fullJob, activeGeneration: { status: 'running' } },
    generatedPack,
    'titles'
  );
  assert.equal(availability.show, true);
  assert.equal(availability.disabled, true);
  assert.equal(availability.reason, 'Cancel or finish the current Creator generation before resetting.');
  assert.equal(getLoredeckCreatorResetAvailability(fullJob, generatedPack, 'finalize').show, false);
}

console.log('Loredeck Creator reset tests passed.');
