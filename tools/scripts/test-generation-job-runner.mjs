import assert from 'node:assert/strict';
import {
  runGenerationUnits,
  normalizeGenerationUnit,
  isGenerationAbortError,
} from '../../src/generation/generation-job-runner.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

{
  const unit = normalizeGenerationUnit({ batchId: 'Title Batch 1', label: 'Characters' });
  assert.equal(unit.unitId, 'Title_Batch_1');
  assert.equal(unit.label, 'Characters');
  assert.equal(unit.status, 'queued');
}

{
  const calls = [];
  const commits = [];
  const progressEvents = [];
  const unitCheckpoints = [];
  const runCheckpoints = [];

  const result = await runGenerationUnits({
    runId: 'run_sequence',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'titles',
    units: [
      { unitId: 'batch_a', label: 'Batch A' },
      { unitId: 'batch_b', label: 'Batch B' },
    ],
    onProgress: event => progressEvents.push(event.type),
    checkpointRun: payload => runCheckpoints.push(payload.run.status),
    checkpointUnit: payload => unitCheckpoints.push(`${payload.unit.unitId}:${payload.unit.status}`),
    callUnit: async ({ unit }) => {
      calls.push(unit.unitId);
      return JSON.stringify({ ok: true, unitId: unit.unitId });
    },
    parseResult: raw => JSON.parse(raw),
    commitResult: async ({ parsedResult, unit }) => {
      commits.push(parsedResult.unitId);
      return {
        outputHash: `hash_${unit.unitId}`,
        resultRef: { type: 'test', unitId: unit.unitId },
      };
    },
  });

  assert.equal(result.status, 'complete');
  assert.deepEqual(calls, ['batch_a', 'batch_b']);
  assert.deepEqual(commits, ['batch_a', 'batch_b']);
  assert.equal(result.completedUnits, 2);
  assert.equal(result.failedUnits, 0);
  assert.ok(progressEvents.includes('run_started'));
  assert.ok(progressEvents.includes('unit_completed'));
  assert.ok(unitCheckpoints.includes('batch_a:complete'));
  assert.ok(runCheckpoints.includes('complete'));
  assert.equal(result.results[0].unit.outputHash, 'hash_batch_a');
}

{
  const calls = [];
  const skipped = [];
  const result = await runGenerationUnits({
    runId: 'run_skip',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'planning',
    units: [
      { unitId: 'already_done' },
      { unitId: 'needs_work' },
      { unitId: 'needs_work' },
    ],
    shouldSkipUnit: ({ unit }) => unit.unitId === 'already_done',
    checkpointUnit: ({ unit }) => {
      if (unit.status === 'skipped') skipped.push(unit.unitId);
    },
    callUnit: async ({ unit }) => {
      calls.push(unit.unitId);
      return { unitId: unit.unitId };
    },
    commitResult: async () => null,
  });

  assert.equal(result.status, 'complete');
  assert.deepEqual(skipped, ['already_done']);
  assert.deepEqual(calls, ['needs_work'], 'Duplicate unit IDs should be deduped before execution.');
  assert.equal(result.skippedUnits, 1);
  assert.equal(result.completedUnits, 1);
}

{
  let callCount = 0;
  const retryStatuses = [];
  const result = await runGenerationUnits({
    runId: 'run_retry',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'outline',
    retryAttempts: 1,
    units: [{ unitId: 'outline' }],
    checkpointUnit: ({ unit }) => retryStatuses.push(unit.status),
    callUnit: async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('Temporary provider failure.');
      return { outline: true };
    },
    commitResult: async () => null,
  });

  assert.equal(result.status, 'complete');
  assert.equal(callCount, 2);
  assert.ok(retryStatuses.includes('retrying'));
  assert.equal(result.completedUnits, 1);
}

{
  let repaired = false;
  const result = await runGenerationUnits({
    runId: 'run_repair',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'titles',
    units: [{ unitId: 'broken_json' }],
    callUnit: async () => '{"titleDrafts":[',
    parseResult: raw => JSON.parse(raw),
    repairResult: async ({ rawResult, error }) => {
      repaired = true;
      assert.equal(rawResult, '{"titleDrafts":[');
      assert.equal(error.name, 'SyntaxError');
      return '{"titleDrafts":[{"titleId":"nami","title":"Nami pressure"}]}';
    },
    validateResult: parsed => Array.isArray(parsed.titleDrafts),
    commitResult: async ({ parsedResult }) => {
      assert.equal(parsedResult.titleDrafts[0].titleId, 'nami');
      return { outputHash: 'hash_repaired' };
    },
  });

  assert.equal(result.status, 'complete');
  assert.equal(repaired, true);
  assert.equal(result.results[0].unit.outputHash, 'hash_repaired');
}

{
  const calls = [];
  const result = await runGenerationUnits({
    runId: 'run_stop_on_failure',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'entries',
    units: [
      { unitId: 'entry_1' },
      { unitId: 'entry_2' },
      { unitId: 'entry_3' },
    ],
    callUnit: async ({ unit }) => {
      calls.push(unit.unitId);
      if (unit.unitId === 'entry_2') throw new Error('Token limit.');
      return { ok: true };
    },
    commitResult: async () => null,
  });

  assert.equal(result.status, 'failed');
  assert.deepEqual(calls, ['entry_1', 'entry_2']);
  assert.equal(result.completedUnits, 1);
  assert.equal(result.failedUnits, 1);
}

{
  const calls = [];
  const result = await runGenerationUnits({
    runId: 'run_continue_after_failure',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'titles',
    stopOnFailure: false,
    units: [
      { unitId: 'title_1' },
      { unitId: 'title_2' },
      { unitId: 'title_3' },
    ],
    callUnit: async ({ unit }) => {
      calls.push(unit.unitId);
      if (unit.unitId === 'title_2') throw new Error('Bad title batch.');
      return { ok: true };
    },
    commitResult: async () => null,
  });

  assert.equal(result.status, 'partial');
  assert.deepEqual(calls, ['title_1', 'title_2', 'title_3']);
  assert.equal(result.completedUnits, 2);
  assert.equal(result.failedUnits, 1);
}

{
  const controller = new AbortController();
  controller.abort();
  const result = await runGenerationUnits({
    runId: 'run_cancelled',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'titles',
    signal: controller.signal,
    units: [{ unitId: 'never_called' }],
    callUnit: async () => {
      throw new Error('Should not run.');
    },
  });

  assert.equal(result.status, 'cancelled');
  assert.equal(result.completedUnits, 0);
  assert.equal(isGenerationAbortError(result.error), true);
}

{
  let committed = false;
  const result = await runGenerationUnits({
    runId: 'run_superseded',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'titles',
    units: [{ unitId: 'late_batch' }],
    callUnit: async () => {
      await sleep(1);
      return { ok: true };
    },
    isRunCurrent: async () => false,
    commitResult: async () => {
      committed = true;
    },
  });

  assert.equal(result.status, 'superseded');
  assert.equal(committed, false, 'Superseded late results must not commit.');
  assert.equal(result.results[0].status, 'superseded');
}

console.log('Generation job runner tests passed.');
