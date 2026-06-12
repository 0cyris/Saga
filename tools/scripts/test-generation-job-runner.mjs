import assert from 'node:assert/strict';
import {
  runGenerationUnits,
  normalizeGenerationUnit,
  isGenerationAbortError,
  GENERATION_ERROR_CODES,
} from '../../src/generation/generation-job-runner.js';
import { extractLoreResponseText } from '../../src/providers/lore-response-normalizer.js';

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
  const result = await runGenerationUnits({
    runId: 'run_parse_failure_code',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'planning',
    units: [{ unitId: 'broken_json_no_repair' }],
    callUnit: async () => '{"proposals":[',
    parseResult: raw => JSON.parse(raw),
    commitResult: async () => {
      throw new Error('Should not commit invalid JSON.');
    },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.failedUnits, 1);
  assert.equal(result.results[0].error.name, 'SyntaxError');
  assert.equal(result.results[0].error.code, GENERATION_ERROR_CODES.JSON_INVALID);
  assert.match(result.results[0].unit.error, /JSON|Unexpected|unterminated/i);
}

{
  const result = await runGenerationUnits({
    runId: 'run_parse_preserves_provider_code',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'planning',
    units: [{ unitId: 'provider_empty_content' }],
    callUnit: async () => '',
    parseResult: () => {
      const error = new Error('Provider returned empty visible content.');
      error.code = 'provider_empty_content';
      throw error;
    },
    commitResult: async () => {
      throw new Error('Should not commit provider parser failure.');
    },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.results[0].error.code, 'provider_empty_content');
  assert.equal(result.results[0].unit.error, 'Provider returned empty visible content.');
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
      assert.equal(error.code, GENERATION_ERROR_CODES.JSON_INVALID);
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
  const result = await runGenerationUnits({
    runId: 'run_commit_failure_code',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'titles',
    units: [{ unitId: 'commit_fails' }],
    callUnit: async () => JSON.stringify({ ok: true }),
    parseResult: raw => JSON.parse(raw),
    commitResult: async () => {
      throw new Error('Commit exploded.');
    },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.failedUnits, 1);
  assert.equal(result.results[0].error.code, GENERATION_ERROR_CODES.COMMIT_FAILED);
  assert.equal(result.results[0].unit.error, 'Commit exploded.');
}

{
  const rawContent = JSON.stringify({ ok: true, unitId: 'chat_object_unit' });
  let parsedText = '';
  let committedText = '';
  const result = await runGenerationUnits({
    runId: 'run_chat_completion_object',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'planning',
    units: [{ unitId: 'chat_object_unit' }],
    callUnit: async () => ({
      id: 'chatcmpl-runner-fixture',
      object: 'chat.completion',
      choices: [{
        message: { role: 'assistant', content: rawContent },
        finish_reason: 'stop',
      }],
    }),
    parseResult: raw => {
      parsedText = extractLoreResponseText(raw);
      return JSON.parse(parsedText);
    },
    commitResult: async ({ rawResult, parsedResult }) => {
      committedText = extractLoreResponseText(rawResult);
      assert.equal(parsedResult.unitId, 'chat_object_unit');
      return {
        outputHash: 'hash_chat_object_unit',
        resultRef: { type: 'creator_context_tag_plan', unitId: parsedResult.unitId },
      };
    },
  });

  assert.equal(result.status, 'complete');
  assert.equal(parsedText, rawContent);
  assert.equal(committedText, rawContent);
  assert.equal(result.results[0].unit.outputHash, 'hash_chat_object_unit');
  assert.equal(result.results[0].commitResult.resultRef.type, 'creator_context_tag_plan');
}

{
  let repaired = false;
  const result = await runGenerationUnits({
    runId: 'run_contract_repair',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'planning',
    units: [{ unitId: 'planning_wrong_actions' }],
    callUnit: async () => JSON.stringify({
      proposals: [{ action: 'upsert_entry', entryId: 'wrong_stage' }],
    }),
    parseResult: raw => JSON.parse(raw),
    validateResult: parsed => {
      const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
      if (proposals.some(proposal => proposal.action === 'upsert_timeline_anchor')) return true;
      return {
        ok: false,
        code: 'creator_planning_no_supported_actions',
        message: 'Valid JSON returned no supported Context or Tag planning proposals.',
      };
    },
    repairResult: async ({ error }) => {
      repaired = true;
      assert.equal(error.code, 'creator_planning_no_supported_actions');
      return JSON.stringify({
        proposals: [{
          action: 'upsert_timeline_anchor',
          timelineAnchor: { id: 'one-piece.arlong.start', label: 'Arlong Park starts' },
        }],
      });
    },
    commitResult: async ({ parsedResult }) => {
      assert.equal(parsedResult.proposals[0].action, 'upsert_timeline_anchor');
      return { outputHash: 'hash_contract_repair' };
    },
  });

  assert.equal(result.status, 'complete');
  assert.equal(repaired, true);
  assert.equal(result.results[0].unit.outputHash, 'hash_contract_repair');
}

{
  const result = await runGenerationUnits({
    runId: 'run_contract_failure',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'planning',
    units: [{ unitId: 'planning_empty' }],
    callUnit: async () => JSON.stringify({ proposals: [] }),
    parseResult: raw => JSON.parse(raw),
    validateResult: () => ({
      ok: false,
      code: 'creator_planning_no_proposals',
      message: 'Valid JSON returned no Context or Tag planning proposals.',
    }),
    commitResult: async () => {
      throw new Error('Should not commit invalid planning output.');
    },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.failedUnits, 1);
  assert.equal(result.results[0].error.code, 'creator_planning_no_proposals');
  assert.equal(result.results[0].unit.error, 'Valid JSON returned no Context or Tag planning proposals.');
}

{
  const unitDiagnostics = [];
  const rawContent = JSON.stringify({ proposals: [] });
  const result = await runGenerationUnits({
    runId: 'run_failure_diagnostic',
    jobId: 'creator_test',
    kind: 'loredeck_creator',
    stage: 'planning',
    units: [{ unitId: 'planning_diagnostic' }],
    checkpointUnit: ({ unit }) => {
      if (unit.status === 'failed') unitDiagnostics.push(unit.diagnostic);
    },
    callUnit: async () => ({
      id: 'chatcmpl-diagnostic-fixture',
      object: 'chat.completion',
      choices: [{
        message: { role: 'assistant', content: rawContent },
        finish_reason: 'length',
      }],
    }),
    parseResult: raw => JSON.parse(extractLoreResponseText(raw)),
    validateResult: () => ({
      ok: false,
      code: 'creator_planning_no_proposals',
      message: 'Valid JSON returned no Context or Tag planning proposals.',
    }),
    diagnoseFailure: ({ rawResult, phase, normalizedError, attempt }) => ({
      stage: 'planning',
      resultType: typeof rawResult,
      finishReason: rawResult?.choices?.[0]?.finish_reason || '',
      visibleContentLength: extractLoreResponseText(rawResult).length,
      parsePhase: normalizedError.code === 'creator_planning_no_proposals' ? 'validation' : phase,
      errorCode: normalizedError.code,
      attempt,
      sample: extractLoreResponseText(rawResult),
    }),
    commitResult: async () => {
      throw new Error('Should not commit invalid planning output.');
    },
  });

  assert.equal(result.status, 'failed');
  assert.equal(result.results[0].unit.diagnostic.errorCode, 'creator_planning_no_proposals');
  assert.equal(result.results[0].unit.diagnostic.finishReason, 'length');
  assert.equal(result.results[0].unit.diagnostic.visibleContentLength, rawContent.length);
  assert.equal(result.results[0].unit.diagnostic.parsePhase, 'validation');
  assert.equal(unitDiagnostics[0].sample, rawContent);
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
