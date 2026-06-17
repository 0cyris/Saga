import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorRetrySmallerConfig,
  buildLoredeckCreatorRetryUnitId,
  buildLoredeckCreatorInterruptedResult,
  findLoredeckCreatorActiveUnitForRecovery,
  formatLoredeckCreatorRecoveryStageLabel,
  getLoredeckCreatorUnitMeta,
  isLoredeckCreatorRecoverableUnit,
  isStaleLoredeckCreatorInterruptedResult,
  recoverLoredeckCreatorInterruptedActiveGeneration,
  selectLoredeckCreatorLatestRecoverableUnit,
} from '../../src/loredecks/loredeck-creator-generation-recovery.js';

const job = {
  generationUnits: {
    explicit: {
      unitId: 'explicit',
      runId: 'run-a',
      status: 'running',
      updatedAt: 20,
    },
    older: {
      unitId: 'older',
      runId: 'run-b',
      status: 'running',
      updatedAt: 10,
    },
    newer: {
      unitId: 'newer',
      runId: 'run-b',
      status: 'retrying',
      updatedAt: 40,
    },
    complete: {
      unitId: 'complete',
      runId: 'run-b',
      status: 'complete',
      updatedAt: 50,
    },
  },
};

assert.equal(
  findLoredeckCreatorActiveUnitForRecovery(job, { unitId: 'explicit', runId: 'run-mismatch' }),
  job.generationUnits.explicit,
  'Recovery should prefer an explicit active unit id.',
);
assert.equal(
  findLoredeckCreatorActiveUnitForRecovery(job, { runId: 'run-b' }),
  job.generationUnits.newer,
  'Recovery should select the newest active unit for the active run.',
);
assert.equal(
  findLoredeckCreatorActiveUnitForRecovery(job, { runId: 'missing' }),
  null,
  'Recovery should return null when no active unit matches the run.',
);
assert.equal(
  findLoredeckCreatorActiveUnitForRecovery({ generationUnits: [] }, { runId: 'run-b' }),
  null,
  'Recovery should ignore malformed generationUnits payloads.',
);

assert.equal(getLoredeckCreatorUnitMeta({ meta: { titlePassLimit: 8 } }).titlePassLimit, 8, 'Recovery should read object metadata from generation units.');
assert.deepEqual(getLoredeckCreatorUnitMeta({ meta: [] }), {}, 'Recovery should ignore malformed unit metadata.');
assert.equal(isLoredeckCreatorRecoverableUnit({ unitId: 'failed', status: 'failed' }), true, 'Failed units should be recoverable.');
assert.equal(isLoredeckCreatorRecoverableUnit({ unitId: 'interrupted', status: 'interrupted' }), true, 'Interrupted units should be recoverable.');
assert.equal(isLoredeckCreatorRecoverableUnit({ unitId: 'complete', status: 'complete' }), false, 'Complete units should not be recoverable.');
assert.equal(isLoredeckCreatorRecoverableUnit({ status: 'failed' }), false, 'Recoverable units must have stable unit ids.');

assert.equal(
  selectLoredeckCreatorLatestRecoverableUnit({
    generationUnits: {
      old: { unitId: 'old', status: 'failed', failedAt: 10 },
      latest: { unitId: 'latest', status: 'interrupted', updatedAt: 40 },
      complete: { unitId: 'complete', status: 'complete', updatedAt: 60 },
    },
  })?.unitId,
  'latest',
  'Recovery should select the latest failed or interrupted unit.',
);
assert.equal(
  selectLoredeckCreatorLatestRecoverableUnit({ generationUnits: { failed: { unitId: 'failed', status: 'failed' } } }, { id: 'active' }),
  null,
  'Recovery should not expose retry controls while a generation is active.',
);

assert.equal(
  isStaleLoredeckCreatorInterruptedResult({
    lastGenerationResult: { status: 'interrupted', unitId: 'unit-complete' },
    generationUnits: {
      complete: { unitId: 'unit-complete', status: 'complete' },
    },
  }),
  true,
  'Interrupted generation results should be stale once the matching unit completed.',
);
assert.equal(
  isStaleLoredeckCreatorInterruptedResult({
    lastGenerationResult: { status: 'interrupted', actionId: 'planning_batch_draft', batchId: 'batch-a' },
    generationUnits: {
      success: {
        unitId: 'unit-success',
        status: 'success',
        meta: { actionId: 'planning_batch_draft', targetPlanningBatchId: 'batch-a' },
      },
    },
  }),
  true,
  'Interrupted generation results should match completed units by action and batch metadata.',
);
assert.equal(
  isStaleLoredeckCreatorInterruptedResult({
    activeGeneration: { status: 'running' },
    lastGenerationResult: { status: 'interrupted', unitId: 'unit-complete' },
    generationUnits: {
      complete: { unitId: 'unit-complete', status: 'complete' },
    },
  }),
  false,
  'Running active generations should not clear interrupted results.',
);
assert.equal(
  isStaleLoredeckCreatorInterruptedResult({
    lastGenerationResult: { status: 'interrupted', unitId: 'unit-failed' },
    generationUnits: {
      failed: { unitId: 'unit-failed', status: 'failed' },
    },
  }),
  false,
  'Recoverable failed units should keep their interrupted result visible.',
);
assert.equal(
  isStaleLoredeckCreatorInterruptedResult({
    lastGenerationResult: { status: 'interrupted', actionId: 'missing-action' },
    generationUnits: {
      complete: { unitId: 'unit-complete', status: 'complete', meta: { actionId: 'other-action' } },
    },
  }),
  false,
  'Interrupted results should not clear when no completed unit matches.',
);

assert.deepEqual(
  buildLoredeckCreatorInterruptedResult({
    id: 'generation-a',
    runId: 'run-a',
    unitId: 'unit-a',
    actionId: 'action-a',
    stage: 'title_batch',
    label: 'Title batch',
    startedAt: 100,
    receivedChars: '42',
    snippet: 'partial response',
    streamSupported: true,
    batchId: 'batch-a',
    batchLabel: 'Batch A',
  }, 250),
  {
    id: 'generation-a',
    runId: 'run-a',
    unitId: 'unit-a',
    actionId: 'action-a',
    stage: 'title_batch',
    label: 'Title batch',
    status: 'interrupted',
    message: 'Title batch was interrupted before it completed. Review any saved batches, then rerun the current stage.',
    completedAt: 250,
    elapsedMs: 150,
    receivedChars: 42,
    snippet: 'partial response',
    streamSupported: true,
    batchId: 'batch-a',
    batchLabel: 'Batch A',
  },
  'Interrupted recovery results should preserve the active generation context.',
);

assert.deepEqual(
  buildLoredeckCreatorInterruptedResult({ unitId: 'unit-fallback', updatedAt: 300, streamSupported: 'unknown' }, 200),
  {
    id: 'unit-fallback',
    runId: '',
    unitId: 'unit-fallback',
    actionId: '',
    stage: '',
    label: 'Deck Maker generation',
    status: 'interrupted',
    message: 'Deck Maker generation was interrupted before it completed. Review any saved batches, then rerun the current stage.',
    completedAt: 200,
    elapsedMs: 0,
    receivedChars: 0,
    snippet: '',
    streamSupported: null,
    batchId: '',
    batchLabel: '',
  },
  'Interrupted recovery results should clamp negative elapsed time and normalize unknown stream support.',
);

const liveRecoveryCalls = [];
const liveRecovery = recoverLoredeckCreatorInterruptedActiveGeneration(
  {
    jobId: 'creator-live',
    activeGeneration: { id: 'live-generation', status: 'running' },
  },
  {},
  {
    isActiveGenerationStillLive: () => true,
    startGenerationTicker: id => liveRecoveryCalls.push(['ticker', id]),
    attachLiveGeneration: jobToAttach => ({ ...jobToAttach, attached: true }),
  },
);
assert.deepEqual(liveRecoveryCalls, [['ticker', 'live-generation']], 'Live recovery should restart the active generation ticker.');
assert.equal(liveRecovery.live, true, 'Live controller-backed generations should not be marked interrupted.');
assert.equal(liveRecovery.job.attached, true, 'Live recovery should attach the current in-memory generation state.');

const recoveryCalls = [];
let persistedPatch = null;
let localRecoveredJob = null;
const interruptedRecovery = recoverLoredeckCreatorInterruptedActiveGeneration(
  {
    jobId: 'creator-interrupted',
    status: 'running',
    currentStage: 'titles_drafting',
    activeGeneration: {
      id: 'generation-interrupted',
      runId: 'run-interrupted',
      unitId: 'unit-interrupted',
      actionId: 'title_batch_draft',
      stage: 'title_batch',
      label: 'Title batch',
      startedAt: 100,
      status: 'running',
      receivedChars: 42,
    },
    generationRuns: {
      'run-interrupted': { runId: 'run-interrupted', status: 'running', stage: 'title_batch' },
    },
    generationUnits: {
      'unit-interrupted': { unitId: 'unit-interrupted', runId: 'run-interrupted', status: 'running', label: 'Title batch unit' },
    },
  },
  { toast: true },
  {
    now: () => 500,
    isActiveGenerationStillLive: () => false,
    updateCreatorProject(jobId, patch, options) {
      persistedPatch = { jobId, patch, options };
      return { ok: true, job: { jobId, ...patch, persisted: true } };
    },
    deleteGenerationController: id => recoveryCalls.push(['delete', id]),
    forgetLiveGeneration: active => recoveryCalls.push(['forget', active.id]),
    stopGenerationTicker: () => recoveryCalls.push(['stopTicker']),
    setCurrentJobLocal: jobToCache => {
      localRecoveredJob = jobToCache;
    },
    toast: (message, tone) => recoveryCalls.push(['toast', tone, message]),
  },
);
assert.equal(interruptedRecovery.recovered, true, 'Interrupted recovery should mark stale running generations as recovered.');
assert.equal(interruptedRecovery.live, false, 'Interrupted recovery should not report a live generation.');
assert.equal(interruptedRecovery.job.persisted, true, 'Interrupted recovery should return the persisted recovered job when storage update succeeds.');
assert.equal(localRecoveredJob, interruptedRecovery.job, 'Interrupted recovery should refresh the current in-memory Creator job.');
assert.equal(persistedPatch.jobId, 'creator-interrupted', 'Interrupted recovery should persist against the recovered job id.');
assert.deepEqual(persistedPatch.options, { syncPrompt: false, syncLocal: true }, 'Interrupted recovery should sync local chat state without prompt injection refresh.');
assert.equal(persistedPatch.patch.activeGeneration, null, 'Interrupted recovery should clear activeGeneration.');
assert.equal(persistedPatch.patch.status, 'draft', 'Interrupted running jobs should return to draft status.');
assert.equal(persistedPatch.patch.currentStage, '', 'Interrupted recovery should force stage reinference on the next render.');
assert.equal(persistedPatch.patch.generationRuns['run-interrupted'].status, 'interrupted', 'Interrupted recovery should close the active generation run.');
assert.equal(persistedPatch.patch.generationUnits['unit-interrupted'].status, 'interrupted', 'Interrupted recovery should close the active generation unit.');
assert.equal(interruptedRecovery.result.status, 'interrupted', 'Interrupted recovery should expose an interrupted result for the UI.');
assert.deepEqual(
  recoveryCalls,
  [
    ['delete', 'generation-interrupted'],
    ['forget', 'generation-interrupted'],
    ['stopTicker'],
    ['toast', 'warning', 'Title batch was interrupted. Saved batches are preserved; rerun the current stage when ready.'],
  ],
  'Interrupted recovery should clean controller state, stop the ticker, and show the concise recovery toast.',
);

assert.equal(formatLoredeckCreatorRecoveryStageLabel({ stage: 'scope_brief' }), 'Scope Brief', 'Recovery labels should name Scope Brief units.');
assert.equal(formatLoredeckCreatorRecoveryStageLabel({ stage: 'story_outline' }), 'Story Outline', 'Recovery labels should name Story Outline units.');
assert.equal(formatLoredeckCreatorRecoveryStageLabel({ stage: 'title_revision' }), 'Title revision', 'Recovery labels should name title revision units.');
assert.equal(formatLoredeckCreatorRecoveryStageLabel({ stage: 'title_batch' }), 'Title batch', 'Recovery labels should name title batch units.');
assert.equal(formatLoredeckCreatorRecoveryStageLabel({ stage: 'context_tag_planning' }), 'Context and Tag plan', 'Recovery labels should name Context and Tag planning units.');
assert.equal(formatLoredeckCreatorRecoveryStageLabel({ stage: 'entry_micro_batch' }), 'Lorecard micro-batch', 'Recovery labels should name Lorecard micro-batch units.');
assert.equal(formatLoredeckCreatorRecoveryStageLabel({ label: 'Custom recovery label' }), 'Custom recovery label', 'Recovery labels should fall back to the unit label.');

assert.deepEqual(
  buildLoredeckCreatorRetrySmallerConfig(
    { stage: 'title_batch', meta: { titlePassLimit: 8 } },
    { titleBatchLimit: 8 },
  ),
  { key: 'titlePassLimitOverride', value: 4, label: '4 titles' },
  'Title retries should halve title-pass size down to the configured lower bound.',
);
assert.deepEqual(
  buildLoredeckCreatorRetrySmallerConfig(
    { stage: 'context_tag_planning', meta: { proposalLimit: 13 } },
    { planningProposalLimit: 12 },
  ),
  { key: 'planningProposalLimitOverride', value: 7, label: '7 proposals' },
  'Planning retries should halve proposal size.',
);
assert.deepEqual(
  buildLoredeckCreatorRetrySmallerConfig(
    { stage: 'entry_micro_batch', meta: { batchSize: 5 } },
    { entryBatchSize: 3 },
    { getEntryBatchLimit: limit => Number(limit) || 3 },
  ),
  { key: 'batchSize', value: 3, label: '3 Lorecards' },
  'Lorecard retries should halve the current micro-batch size.',
);
assert.equal(
  buildLoredeckCreatorRetrySmallerConfig({ stage: 'entry_micro_batch', meta: { batchSize: 1 } }, { entryBatchSize: 1 }),
  null,
  'One-Lorecard retry units cannot be reduced further.',
);
assert.equal(
  buildLoredeckCreatorRetrySmallerConfig({ stage: 'title_batch', meta: { retrySmallerSupported: false, titlePassLimit: 8 } }, { titleBatchLimit: 8 }),
  null,
  'Units can opt out of Retry Smaller.',
);

assert.equal(
  buildLoredeckCreatorRetryUnitId({ unitId: 'creator unit/with spaces' }, 'retry_smaller', 3, 1234),
  'creator_unit_with_spaces:retry_smaller_3_1234',
  'Retry unit ids should be deterministic, namespaced, and safe for storage keys.',
);

console.log('Deck Maker generation recovery helper tests passed.');
