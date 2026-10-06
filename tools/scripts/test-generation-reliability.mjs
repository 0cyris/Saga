import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runGenerationUnits } from '../../src/generation/generation-job-runner.js';
import { runLoredeckCreatorSingleUnitGeneration } from '../../src/loredecks/loredeck-creator-generation-runner.js';
import { recoverLoredeckCreatorInterruptedActiveGeneration } from '../../src/loredecks/loredeck-creator-generation-recovery.js';

for (const mode of ['throw', 'returned_failure', 'false']) {
  test(`completion checkpoint ${mode} retains the commit and reconciles without requesting again`, async () => {
    let calls = 0;
    let commits = 0;
    let checkpointCalls = 0;
    let refuseCheckpoint = true;
    let commitIdentity;
    const options = {
      jobId: 'reliability', runId: `checkpoint_${mode}`, stage: 'titles',
      units: [{ unitId: 'batch', inputHash: 'approved-input-v1' }],
      retryAttempts: 2, checkpointRetryAttempts: 1,
      retryBaseDelayMs: 1, retryMaxDelayMs: 2,
      callUnit: async () => { calls += 1; return '{"title":"Saved"}'; },
      parseResult: JSON.parse,
      commitResult: async ({ idempotencyKey }) => {
        commits += 1;
        commitIdentity = idempotencyKey;
        return { outputHash: 'saved-hash', resultRef: { batchId: 'saved-batch' } };
      },
      checkpointUnit: async ({ unit }) => {
        if (unit.status !== 'complete') return { ok: true };
        checkpointCalls += 1;
        if (!refuseCheckpoint) return { ok: true };
        if (mode === 'throw') throw new Error('disk full');
        return mode === 'false' ? false : { ok: false, error: 'disk full' };
      },
    };
    const pending = await runGenerationUnits(options);
    assert.equal(calls, 1, 'Checkpoint failure must never replay the successful provider request.');
    assert.equal(commits, 1, 'Checkpoint failure must never duplicate the successful commit.');
    assert.equal(pending.status, 'interrupted');
    assert.equal(pending.results[0].status, 'checkpoint_pending');
    assert.equal(pending.results[0].unit.meta.checkpointPending, true);
    assert.equal(pending.results[0].unit.resultRef.batchId, 'saved-batch');
    assert.ok(commitIdentity, 'Commits receive a stable reconciliation identity.');
    assert.equal(checkpointCalls, 2, 'Only the completion checkpoint is retried within its bounded budget.');
    refuseCheckpoint = false;
    const resumed = await runGenerationUnits({ ...options, units: [pending.results[0].unit] });
    assert.equal(resumed.status, 'complete');
    assert.equal(calls, 1);
    assert.equal(commits, 1);
    assert.equal(resumed.results[0].unit.meta.idempotencyKey, commitIdentity);
    const changed = await runGenerationUnits({ ...options, units: [{ unitId: 'batch', inputHash: 'approved-input-v2' }] });
    assert.equal(changed.status, 'complete');
    assert.equal(calls, 2, 'Changed input establishes a new generation identity.');
  });
}

test('durable commit reconciliation prevents provider work after reopening', async () => {
  let providerCalls = 0;
  const result = await runGenerationUnits({
    jobId: 'reliability', runId: 'reopened', units: [{ unitId: 'batch', inputHash: 'v1' }],
    reconcileCommittedResult: async ({ idempotencyKey }) => ({
      committed: true, idempotencyKey, outputHash: 'durable-hash', resultRef: { batchId: 'durable-batch' },
    }),
    callUnit: async () => { providerCalls += 1; return {}; },
    commitResult: async () => { throw new Error('An acknowledged commit must not be repeated.'); },
  });
  assert.equal(result.status, 'complete');
  assert.equal(providerCalls, 0);
  assert.equal(result.results[0].unit.resultRef.batchId, 'durable-batch');
});

for (const mode of ['throw', 'returned_failure']) {
  test(`run completion checkpoint ${mode} retains successful unit output`, async () => {
    let calls = 0;
    let commits = 0;
    const result = await runGenerationUnits({
      jobId: 'reliability', runId: `run_checkpoint_${mode}`, units: [{ unitId: 'batch' }],
      checkpointRetryAttempts: 0,
      callUnit: async () => { calls += 1; return { title: 'Saved' }; },
      commitResult: async () => { commits += 1; return { resultRef: { batchId: 'saved' } }; },
      checkpointRun: ({ run }) => {
        if (run.status !== 'complete') return { ok: true };
        if (mode === 'throw') throw new Error('run checkpoint refused');
        return { ok: false, error: 'run checkpoint refused' };
      },
    });
    assert.equal(result.status, 'interrupted');
    assert.equal(calls, 1);
    assert.equal(commits, 1);
    assert.equal(result.results[0].commitResult.resultRef.batchId, 'saved');
    assert.equal(result.error.code, 'checkpoint_failed');
    assert.equal(result.run.meta.checkpointPending, true);
  });
}

for (const error of [Object.assign(new Error('HTTP 401'), { status: 401 }), Object.assign(new Error('HTTP 403'), { status: 403 }), Object.assign(new Error('Missing API configuration'), { code: 'provider_not_configured' })]) {
  test(`permanent provider failure ${error.status || error.code} is attempted once`, async () => {
    let calls = 0;
    const result = await runGenerationUnits({
      jobId: 'reliability', runId: `permanent_${error.status || error.code}`, units: [{ unitId: 'batch' }],
      retryAttempts: 2, isRetryableError: () => true,
      callUnit: async () => { calls += 1; throw error; },
    });
    assert.equal(result.status, 'failed');
    assert.equal(calls, 1);
    assert.equal(result.results[0].unit.attempts, 1);
  });
}

for (const phase of ['parse', 'commit']) {
  test(`${phase} failures preserve output and do not blindly request again`, async () => {
    let calls = 0;
    let commits = 0;
    const result = await runGenerationUnits({
      jobId: 'reliability', runId: `phase_${phase}`, units: [{ unitId: 'batch' }], retryAttempts: 2,
      callUnit: async () => { calls += 1; return '{"title":"Recoverable"}'; },
      parseResult: raw => { if (phase === 'parse') throw new SyntaxError('Invalid contract'); return JSON.parse(raw); },
      commitResult: async () => { commits += 1; return { ok: false, error: 'commit refused' }; },
      diagnoseFailure: ({ phase: failedPhase }) => ({ parsePhase: failedPhase }),
    });
    assert.equal(result.status, 'failed');
    assert.equal(calls, 1);
    assert.equal(commits, phase === 'parse' ? 0 : 1);
    assert.equal(result.results[0].rawResult, '{"title":"Recoverable"}');
    assert.equal(result.results[0].unit.diagnostic.parsePhase, phase);
  });
}

test('rate limit retry honors Retry-After with bounded backoff', async () => {
  let calls = 0;
  const waits = [];
  const result = await runGenerationUnits({
    jobId: 'reliability', runId: 'rate_limit', units: [{ unitId: 'batch' }], retryAttempts: 1,
    retryBaseDelayMs: 50, retryMaxDelayMs: 2000, retryRandom: () => 0,
    waitForRetry: async ({ delayMs }) => waits.push(delayMs),
    callUnit: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('HTTP 429'), { status: 429, headers: { 'retry-after': '1' } });
      return { title: 'Done' };
    },
  });
  assert.equal(result.status, 'complete');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [1000]);
});

test('abort cancels the rate-limit wait before another provider attempt', async () => {
  const controller = new AbortController();
  let calls = 0;
  const startedAt = Date.now();
  const result = await runGenerationUnits({
    jobId: 'reliability', runId: 'cancel_backoff', units: [{ unitId: 'batch' }], retryAttempts: 2,
    signal: controller.signal, retryBaseDelayMs: 1000,
    onProgress: event => { if (event.type === 'unit_retry_scheduled') setTimeout(() => controller.abort(), 5); },
    callUnit: async () => { calls += 1; throw Object.assign(new Error('Rate limited'), { status: 429 }); },
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(calls, 1);
  assert.ok(Date.now() - startedAt < 500, 'Abort interrupts backoff promptly.');
});

test('Deck adapter exposes a returned checkpoint refusal without duplicating successful work', async () => {
  let calls = 0;
  let commits = 0;
  await assert.rejects(() => runLoredeckCreatorSingleUnitGeneration({
    generation: { id: 'deck_checkpoint', jobId: 'deck' }, stage: 'titles', retryAttempts: 2,
    checkpointRetryAttempts: 0,
    requestResponse: async () => { calls += 1; return '{"summary":"Saved"}'; },
    parseResponse: JSON.parse,
    commitParsedResult: async ({ idempotencyKey }) => { commits += 1; assert.ok(idempotencyKey); return { resultRef: { batchId: 'saved' } }; },
  }, {
    updateGenerationRun: async () => ({ ok: true }),
    updateGenerationUnit: async (_jobId, _unitId, unit) => unit.status === 'complete' ? { ok: false, error: 'disk full' } : { ok: true },
  }), error => {
    assert.equal(error.code, 'checkpoint_failed');
    assert.equal(error.reconciliation.results[0].commitResult.resultRef.batchId, 'saved');
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(commits, 1);
});

test('queued commits wait for a durable completion acknowledgement', async () => {
  let release;
  let settled = false;
  const completion = new Promise(resolve => { release = resolve; });
  const pending = runGenerationUnits({
    jobId: 'reliability', runId: 'queued_commit', units: [{ unitId: 'batch' }],
    callUnit: async () => ({ title: 'Saved' }),
    commitResult: () => ({ ok: true, queued: true, persisted: false, completion, resultRef: { batchId: 'saved' } }),
  }).then(result => { settled = true; return result; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(settled, false);
  release({ ok: true, persisted: true, pendingWrites: 0 });
  assert.equal((await pending).status, 'complete');
});

for (const mode of ['refused', 'thrown', 'rejected', 'queued']) {
  test(`recovery ${mode} update preserves live evidence for retry`, async () => {
    const job = {
      jobId: `recovery_${mode}`, status: 'running',
      activeGeneration: { id: 'active', unitId: 'batch', runId: 'run', label: 'Batch' },
      generationUnits: { batch: { unitId: 'batch', status: 'running' } },
      savedBatches: [{ batchId: 'saved' }],
    };
    const cleaned = [];
    let success = false;
    const deps = {
      isActiveGenerationStillLive: () => false,
      updateCreatorProject: () => {
        if (success) return { ok: true, job: { ...job, activeGeneration: null } };
        if (mode === 'thrown') throw new Error('disk full');
        if (mode === 'rejected') return Promise.reject(new Error('disk full'));
        if (mode === 'queued') return { ok: true, queued: true, persisted: false };
        return { ok: false, error: 'disk full' };
      },
      deleteGenerationController: () => cleaned.push('controller'),
      forgetLiveGeneration: () => cleaned.push('live'),
      stopGenerationTicker: () => cleaned.push('ticker'),
      setCurrentJobLocal: () => cleaned.push('local'),
    };
    const refused = await recoverLoredeckCreatorInterruptedActiveGeneration(job, {}, deps);
    assert.equal(refused.recovered, false);
    assert.equal(refused.pending, true);
    assert.equal(refused.job, job);
    assert.deepEqual(cleaned, []);
    assert.equal(refused.job.savedBatches[0].batchId, 'saved');
    success = true;
    const recovered = await recoverLoredeckCreatorInterruptedActiveGeneration(job, {}, deps);
    assert.equal(recovered.recovered, true);
    assert.deepEqual(cleaned, ['controller', 'live', 'ticker', 'local']);
  });
}

test('recovery keeps runtime evidence until a queued update becomes durable', async () => {
  let acknowledge;
  const completion = new Promise(resolve => { acknowledge = resolve; });
  const cleaned = [];
  const job = { jobId: 'queued_recovery', activeGeneration: { id: 'active' } };
  const pending = recoverLoredeckCreatorInterruptedActiveGeneration(job, {}, {
    isActiveGenerationStillLive: () => false,
    updateCreatorProject: () => ({ ok: true, queued: true, persisted: false, completion }),
    deleteGenerationController: () => cleaned.push('controller'),
    forgetLiveGeneration: () => cleaned.push('live'),
    stopGenerationTicker: () => cleaned.push('ticker'),
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(cleaned, []);
  acknowledge({ ok: true, persisted: true });
  assert.equal((await pending).recovered, true);
  assert.deepEqual(cleaned, ['controller', 'live', 'ticker']);
});
