import assert from 'node:assert/strict';
import { MODULE_KEY, SCHEMA_VERSION } from '../../src/state/constants.js';
import { runGenerationUnits } from '../../src/generation/generation-job-runner.js';
import {
  getLoredeckCreatorProjectRegistry,
  updateLoredeckCreatorGenerationRun,
  updateLoredeckCreatorGenerationUnit,
  updateLoredeckCreatorProject,
  upsertLoredeckCreatorJob,
} from '../../src/state/state-manager.js';

let extensionSettings;
let chatMetadata;
let saveSettingsCount = 0;
let saveStateCount = 0;

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings,
      chatMetadata,
      saveSettingsDebounced() {
        saveSettingsCount += 1;
      },
      saveMetadata() {
        saveStateCount += 1;
      },
    };
  },
};

function resetStorage() {
  extensionSettings = {
    [MODULE_KEY]: {},
  };
  chatMetadata = {
    [MODULE_KEY]: {
      _version: SCHEMA_VERSION,
      loreContext: {},
      loreMatrix: [],
      pendingLoreEntries: [],
      loredeckCreator: {
        schemaVersion: 1,
        activeJobId: '',
        lastJobId: '',
        jobs: {},
      },
    },
  };
  saveSettingsCount = 0;
  saveStateCount = 0;
}

function seedJob(jobId = 'creator_phase_11') {
  resetStorage();
  const created = upsertLoredeckCreatorJob({
    jobId,
    fandom: 'One Piece',
    scope: 'Arlong Park Arc',
    granularity: 'focused',
    projectTitle: 'One Piece: Arlong Park Arc',
    currentStage: 'title_pass',
  }, { syncPrompt: false });
  assert.equal(created.ok, true);
  return created.job.jobId;
}

function getStoredJob(jobId) {
  const registry = getLoredeckCreatorProjectRegistry();
  return registry.jobs[jobId];
}

function checkpointCreatorRun(jobId, currentStage = 'titles_drafting') {
  return ({ run }) => {
    const updated = updateLoredeckCreatorGenerationRun(jobId, run, {
      syncPrompt: false,
      currentStage,
      label: `Generating ${run.stage || 'Creator unit'}`,
    });
    assert.equal(updated.ok, true);
  };
}

function checkpointCreatorUnit(jobId, currentStage = 'titles_drafting', statuses = []) {
  return ({ unit }) => {
    statuses.push(`${unit.unitId}:${unit.status}`);
    const updated = updateLoredeckCreatorGenerationUnit(jobId, unit.unitId, unit, {
      syncPrompt: false,
      currentStage,
      label: unit.label || 'Generating Creator unit',
    });
    assert.equal(updated.ok, true);
  };
}

{
  const jobId = seedJob('creator_phase_11_duplicate_clicks');
  let calls = 0;
  const statuses = [];

  const result = await runGenerationUnits({
    runId: 'run_duplicate_title_clicks',
    jobId,
    kind: 'loredeck_creator',
    stage: 'titles',
    units: [
      {
        unitId: 'creator_title_batch:arlong-pressure',
        label: 'Arlong pressure',
        meta: {
          recoveryStage: 'titles',
          titleBatchId: 'arlong-pressure',
          titlePassLimit: 8,
        },
      },
      {
        unitId: 'creator_title_batch:arlong-pressure',
        label: 'Arlong pressure duplicate click',
        meta: {
          recoveryStage: 'titles',
          titleBatchId: 'arlong-pressure',
          titlePassLimit: 8,
        },
      },
    ],
    checkpointRun: checkpointCreatorRun(jobId),
    checkpointUnit: checkpointCreatorUnit(jobId, 'titles_drafting', statuses),
    callUnit: async ({ unit }) => {
      calls += 1;
      return { titleDrafts: [{ titleId: 'arlong-rule', title: unit.label }] };
    },
    validateResult: parsed => Array.isArray(parsed.titleDrafts),
    commitResult: async () => ({
      outputHash: 'hash_duplicate_clicks',
      resultRef: { type: 'creator_title_batch', batchId: 'arlong-pressure', draftCount: 1 },
    }),
  });

  assert.equal(result.status, 'complete');
  assert.equal(calls, 1, 'Duplicate clicks for the same Creator unit should dedupe before provider execution.');
  assert.equal(result.completedUnits, 1);
  const job = getStoredJob(jobId);
  assert.equal(job.generationUnits['creator_title_batch:arlong-pressure'].status, 'complete');
  assert.equal(job.generationUnits['creator_title_batch:arlong-pressure'].meta.titleBatchId, 'arlong-pressure');
  assert.ok(statuses.includes('creator_title_batch:arlong-pressure:running'));
}

{
  const jobId = seedJob('creator_phase_11_late_response');
  let committed = false;
  const statuses = [];

  const result = await runGenerationUnits({
    runId: 'run_late_title_response',
    jobId,
    kind: 'loredeck_creator',
    stage: 'titles',
    units: [{ unitId: 'creator_title_batch:late-response', label: 'Late response' }],
    checkpointRun: checkpointCreatorRun(jobId),
    checkpointUnit: checkpointCreatorUnit(jobId, 'titles_drafting', statuses),
    callUnit: async () => ({ titleDrafts: [{ titleId: 'late-nami', title: 'Late Nami title' }] }),
    isRunCurrent: async () => false,
    validateResult: parsed => Array.isArray(parsed.titleDrafts),
    commitResult: async () => {
      committed = true;
      return { outputHash: 'hash_should_not_commit' };
    },
  });

  assert.equal(result.status, 'superseded');
  assert.equal(committed, false, 'Late superseded Creator responses must not commit parsed output.');
  assert.ok(statuses.includes('creator_title_batch:late-response:superseded'));
  const job = getStoredJob(jobId);
  assert.equal(job.generationUnits['creator_title_batch:late-response'].status, 'superseded');
  assert.equal(job.activeGeneration, undefined, 'A superseded active unit should clear activeGeneration.');
}

{
  const jobId = seedJob('creator_phase_11_interrupted_reopen');
  const runId = 'run_outline_interrupted';
  const unitId = 'creator_outline:approved-brief';

  const runStarted = updateLoredeckCreatorGenerationRun(jobId, {
    runId,
    stage: 'outline',
    status: 'running',
    totalUnits: 1,
    currentUnitId: unitId,
    startedAt: 100,
  }, {
    syncPrompt: false,
    currentStage: 'outline_drafting',
    label: 'Drafting Story Outline',
  });
  assert.equal(runStarted.ok, true);

  const unitStarted = updateLoredeckCreatorGenerationUnit(jobId, unitId, {
    runId,
    stage: 'outline',
    status: 'running',
    label: 'Drafting Story Outline',
    startedAt: 110,
    meta: {
      recoveryStage: 'outline',
      retrySmallerSupported: false,
    },
  }, {
    syncPrompt: false,
    currentStage: 'outline_drafting',
    label: 'Drafting Story Outline',
  });
  assert.equal(unitStarted.ok, true);
  assert.equal(unitStarted.job.activeGeneration.unitId, unitId);

  const runInterrupted = updateLoredeckCreatorGenerationRun(jobId, {
    runId,
    stage: 'outline',
    status: 'interrupted',
    error: 'Previous Creator generation was interrupted before it completed.',
    completedAt: 200,
  }, { syncPrompt: false });
  assert.equal(runInterrupted.ok, true);

  const unitInterrupted = updateLoredeckCreatorGenerationUnit(jobId, unitId, {
    runId,
    stage: 'outline',
    status: 'interrupted',
    error: 'Previous Creator generation was interrupted before this unit completed.',
    failedAt: 201,
  }, { syncPrompt: false });
  assert.equal(unitInterrupted.ok, true);

  const recovered = updateLoredeckCreatorProject(jobId, {
    activeGeneration: null,
    status: 'draft',
    lastGenerationResult: {
      id: 'interrupted_outline_result',
      runId,
      unitId,
      stage: 'outline',
      status: 'interrupted',
      message: 'Story Outline was interrupted before it completed. Review saved batches, then rerun this stage.',
      completedAt: 202,
    },
  }, { syncPrompt: false });
  assert.equal(recovered.ok, true);

  const job = getStoredJob(jobId);
  assert.equal(job.activeGeneration, undefined, 'Interrupted reopen recovery should unlock Creator actions.');
  assert.equal(job.status, 'draft');
  assert.equal(job.generationRuns[runId].status, 'interrupted');
  assert.equal(job.generationUnits[unitId].status, 'interrupted');
  assert.equal(job.generationUnits[unitId].meta.recoveryStage, 'outline');
  assert.equal(job.lastGenerationResult.status, 'interrupted');
}

{
  const jobId = seedJob('creator_phase_11_token_limit_retry');
  let calls = 0;
  const statuses = [];

  const result = await runGenerationUnits({
    runId: 'run_token_limit_retry',
    jobId,
    kind: 'loredeck_creator',
    stage: 'titles',
    retryAttempts: 1,
    units: [{
      unitId: 'creator_title_batch:token-retry',
      label: 'Token retry title batch',
      meta: {
        recoveryStage: 'titles',
        titleBatchId: 'token-retry',
        titlePassLimit: 8,
        retrySmallerSupported: true,
      },
    }],
    isRetryableError: error => /finish_reason|length|token/i.test(String(error?.message || error || '')),
    checkpointRun: checkpointCreatorRun(jobId),
    checkpointUnit: checkpointCreatorUnit(jobId, 'titles_drafting', statuses),
    callUnit: async () => {
      calls += 1;
      if (calls === 1) throw new Error("Provider stopped early with finish_reason: 'length'.");
      return { titleDrafts: [{ titleId: 'nami-hidden-bargain', title: 'Nami hidden bargain' }] };
    },
    validateResult: parsed => Array.isArray(parsed.titleDrafts) && parsed.titleDrafts.length > 0,
    commitResult: async ({ parsedResult }) => ({
      outputHash: 'hash_token_retry_success',
      resultRef: {
        type: 'creator_title_batch',
        batchId: 'token-retry',
        draftCount: parsedResult.titleDrafts.length,
      },
    }),
  });

  assert.equal(result.status, 'complete');
  assert.equal(calls, 2);
  assert.ok(statuses.includes('creator_title_batch:token-retry:retrying'), 'Token-limit failures should checkpoint a retrying state before retry.');
  const job = getStoredJob(jobId);
  const unit = job.generationUnits['creator_title_batch:token-retry'];
  assert.equal(unit.status, 'complete');
  assert.equal(unit.attempts, 2);
  assert.equal(unit.meta.retrySmallerSupported, true);
  assert.equal(unit.resultRef.draftCount, 1);
}

{
  const jobId = seedJob('creator_phase_11_failure_diagnostic');
  const runId = 'run_planning_failed_diagnostic';
  const unitId = 'creator_context_tag_plan:arlong';

  const updated = updateLoredeckCreatorGenerationUnit(jobId, unitId, {
    runId,
    stage: 'context_tag_planning',
    status: 'failed',
    label: 'Context plan: Arlong Park',
    error: 'Valid JSON returned no Context or Tag planning proposals.',
    diagnostic: {
      kind: 'loredeck_creator_generation_failure',
      stage: 'context_tag_planning',
      unitId,
      unitLabel: 'Context plan: Arlong Park',
      providerKind: 'lore',
      resultType: 'object',
      finishReason: 'length',
      parsePhase: 'validation',
      errorCode: 'creator_planning_no_proposals',
      errorName: 'GenerationNoUsableResultError',
      errorMessage: 'Valid JSON returned no Context or Tag planning proposals.',
      visibleContentLength: 16,
      reasoningLength: 0,
      attempt: 1,
      recordedAt: 1234,
      repairAttempted: true,
      sample: '{"proposals":[]}',
      rawResult: { choices: [{ message: { content: 'must not persist' } }] },
      providerHeaders: { Authorization: 'Bearer must-not-persist' },
    },
  }, {
    syncPrompt: false,
    currentStage: 'planning_drafting',
    label: 'Context plan: Arlong Park',
  });

  assert.equal(updated.ok, true);
  const unit = getStoredJob(jobId).generationUnits[unitId];
  assert.equal(unit.status, 'failed');
  assert.equal(unit.diagnostic.errorCode, 'creator_planning_no_proposals');
  assert.equal(unit.diagnostic.finishReason, 'length');
  assert.equal(unit.diagnostic.visibleContentLength, 16);
  assert.equal(unit.diagnostic.parsePhase, 'validation');
  assert.equal(unit.diagnostic.sample, '{"proposals":[]}');
  assert.equal(unit.diagnostic.rawResult, undefined, 'Failed unit diagnostics must not persist raw provider responses.');
  assert.equal(unit.diagnostic.providerHeaders, undefined, 'Failed unit diagnostics must not persist provider headers.');
}

{
  const jobId = seedJob('creator_phase_11_partial_success');
  const committed = [];

  const result = await runGenerationUnits({
    runId: 'run_partial_entry_success',
    jobId,
    kind: 'loredeck_creator',
    stage: 'entries',
    stopOnFailure: false,
    units: [
      {
        unitId: 'creator_entry_micro_batch:nami',
        label: 'Nami',
        meta: { recoveryStage: 'entries', targetTitleIds: ['nami'], batchSize: 1 },
      },
      {
        unitId: 'creator_entry_micro_batch:arlong',
        label: 'Arlong',
        meta: { recoveryStage: 'entries', targetTitleIds: ['arlong'], batchSize: 1 },
      },
      {
        unitId: 'creator_entry_micro_batch:cocoyasi',
        label: 'Cocoyasi',
        meta: { recoveryStage: 'entries', targetTitleIds: ['cocoyasi'], batchSize: 1 },
      },
    ],
    checkpointRun: checkpointCreatorRun(jobId, 'entries_drafting'),
    checkpointUnit: checkpointCreatorUnit(jobId, 'entries_drafting'),
    callUnit: async ({ unit }) => {
      if (unit.unitId.endsWith(':arlong')) throw new Error('No usable Lorecards returned for Arlong.');
      return { entryDrafts: [{ entryId: `${unit.unitId}:entry`, title: unit.label }] };
    },
    validateResult: parsed => Array.isArray(parsed.entryDrafts) && parsed.entryDrafts.length > 0,
    commitResult: async ({ parsedResult, unit }) => {
      committed.push(unit.unitId);
      return {
        outputHash: `hash_${unit.unitId}`,
        resultRef: {
          type: 'creator_entry_micro_batch',
          unitId: unit.unitId,
          draftCount: parsedResult.entryDrafts.length,
        },
      };
    },
  });

  assert.equal(result.status, 'partial');
  assert.deepEqual(committed, [
    'creator_entry_micro_batch:nami',
    'creator_entry_micro_batch:cocoyasi',
  ]);
  assert.equal(result.completedUnits, 2);
  assert.equal(result.failedUnits, 1);
  const job = getStoredJob(jobId);
  assert.equal(job.generationRuns.run_partial_entry_success.status, 'partial');
  assert.equal(job.generationUnits['creator_entry_micro_batch:nami'].status, 'complete');
  assert.equal(job.generationUnits['creator_entry_micro_batch:arlong'].status, 'failed');
  assert.equal(job.generationUnits['creator_entry_micro_batch:cocoyasi'].status, 'complete');
  assert.equal(job.generationUnits['creator_entry_micro_batch:nami'].resultRef.draftCount, 1);
  assert.equal(job.generationUnits['creator_entry_micro_batch:arlong'].meta.targetTitleIds[0], 'arlong');
}

assert.ok(saveSettingsCount > 0, 'Creator recovery tests should write global Creator project settings.');
assert.ok(saveStateCount > 0, 'Creator recovery tests should mirror Creator state into chat metadata.');

console.log('Loredeck Creator generation recovery tests passed.');
