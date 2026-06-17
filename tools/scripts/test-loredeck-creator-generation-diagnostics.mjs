import assert from 'node:assert/strict';
import { GENERATION_ERROR_CODES } from '../../src/generation/generation-job-runner.js';
import {
  buildLoredeckCreatorGenerationFailureDiagnostic,
  formatLoredeckCreatorGenerationFailureMessage,
  prepareLoredeckCreatorStageFailure,
  warnLoredeckCreatorGenerationFailure,
} from '../../src/loredecks/loredeck-creator-generation-diagnostics.js';
import { LORE_RESPONSE_ERROR_CODES } from '../../src/providers/lore-response-normalizer.js';

const stageLabel = 'Lorecard Drafting';

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage({ code: LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT }, '', stageLabel),
  'Lorecard Drafting hit the provider output limit before Saga received a usable final JSON response. Retry Smaller or lower the output size for this stage.',
  'Token-limit failures should map to the Retry Smaller guidance.',
);

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage({ code: LORE_RESPONSE_ERROR_CODES.REASONING_ONLY }, '', stageLabel),
  'Lorecard Drafting returned hidden reasoning but no visible JSON. Use a profile that emits a final answer, lower reasoning effort, or retry this stage.',
  'Reasoning-only failures should explain the missing visible final answer.',
);

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage({ code: LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT }, '', stageLabel),
  'Lorecard Drafting returned no visible content. Check the provider output settings and retry this stage.',
  'Empty-content failures should point at provider output settings.',
);

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage({ code: GENERATION_ERROR_CODES.JSON_INVALID }, '', stageLabel),
  'Lorecard Drafting returned malformed JSON that Saga could not repair. Retry Smaller or reduce the stage scope.',
  'Invalid JSON failures should preserve stage-scoped retry guidance.',
);

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage({ code: GENERATION_ERROR_CODES.COMMIT_FAILED }, '', stageLabel),
  'Lorecard Drafting produced usable output, but Saga could not save or queue it. Check the latest Failure Diagnostic before retrying.',
  'Commit failures should distinguish persistence trouble from provider trouble.',
);

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage(
    { code: 'creator_entry_guard_rejected_all', rejectedTargetIds: ['nami', 'arlong', 'usopp', 'zoro', 'luffy', 'sanji'] },
    '',
    stageLabel,
  ),
  'Lorecard Drafting returned valid JSON, but every Lorecard draft in the micro-batch was rejected by schema guardrails. Affected: nami, arlong, usopp, zoro, luffy.',
  'Entry guard failures should expose a bounded affected-target list.',
);

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage({ code: GENERATION_ERROR_CODES.STAGE_CONTRACT_FAILED }, '', stageLabel),
  'Lorecard Drafting returned valid JSON, but it did not contain usable content for this Deck Maker stage. Check the latest Failure Diagnostic or retry with a smaller scope.',
  'Creator stage-contract failures should use the stable Deck Maker contract message.',
);

assert.equal(
  formatLoredeckCreatorGenerationFailureMessage({ message: 'SyntaxError: Unexpected token < in JSON at position 0' }, 'fallback', stageLabel),
  'Lorecard Drafting returned output Saga could not parse. Check the latest Failure Diagnostic or retry with a smaller scope.',
  'Raw JSON parser text should be rewritten to user-facing copy.',
);

{
  const error = new Error('SyntaxError: Unexpected end of JSON input');
  const prepared = prepareLoredeckCreatorStageFailure(error, 'fallback', 'Title Pass');
  assert.equal(prepared, error, 'Object errors should be updated in place for runner compatibility.');
  assert.equal(prepared.sagaRawMessage, 'SyntaxError: Unexpected end of JSON input');
  assert.equal(
    prepared.message,
    'Title Pass returned output Saga could not parse. Check the latest Failure Diagnostic or retry with a smaller scope.',
    'Prepared failures should retain the raw provider/parser message separately.',
  );
}

{
  const visibleSample = '{"entries":[{"id":"nami","content":"visible"}]}';
  const rejectedTargetIds = Array.from({ length: 24 }, (_, index) => `target-${index + 1}`);
  const rejectionDiagnostics = Array.from({ length: 24 }, (_, index) => ({ targetId: `target-${index + 1}`, reason: 'missing_insert' }));
  const diagnostic = buildLoredeckCreatorGenerationFailureDiagnostic(
    {
      phase: 'parse',
      attempt: 2,
      repairAttempted: true,
      rawResult: {
        choices: [{
          finish_reason: 'stop',
          message: { content: visibleSample },
        }],
      },
      normalizedError: {
        code: 'creator_entry_guard_rejected_all',
        name: 'GenerationNoUsableResultError',
        message: 'provider key sk-diagnostic-secret should be redacted',
      },
      error: {
        code: 'creator_entry_guard_rejected_all',
        rejectedTargetIds,
        rejectionDiagnostics,
        rejectionSummary: 'All drafts failed entry guard checks.',
      },
      unit: {
        stage: 'entry_batch_draft',
        unitId: 'entry:micro-batch-1',
        label: 'Entry micro-batch 1',
      },
    },
    {
      stage: 'entry_batch_draft',
      requestOptions: { providerKind: 'continuity' },
    },
    { providerKind: 'lore' },
    {
      redactDiagnostic: value => ({
        ...value,
        errorMessage: value.errorMessage.replace(/sk-[a-z0-9-]+/gi, '<redacted>'),
        sample: '<redacted-sample>',
      }),
    },
  );

  assert.equal(diagnostic.kind, 'loredeck_creator_generation_failure');
  assert.equal(diagnostic.stage, 'entry_batch_draft');
  assert.equal(diagnostic.unitId, 'entry:micro-batch-1');
  assert.equal(diagnostic.unitLabel, 'Entry micro-batch 1');
  assert.equal(diagnostic.providerKind, 'continuity', 'Config request options should win over outer request options.');
  assert.equal(diagnostic.resultType, 'object');
  assert.equal(diagnostic.finishReason, 'stop');
  assert.equal(diagnostic.parsePhase, 'validation', 'Creator parse failures with validation codes should be reported as validation.');
  assert.equal(diagnostic.errorCode, 'creator_entry_guard_rejected_all');
  assert.equal(diagnostic.errorName, 'GenerationNoUsableResultError');
  assert.equal(diagnostic.errorMessage, 'provider key <redacted> should be redacted');
  assert.equal(diagnostic.visibleContentLength, visibleSample.length);
  assert.equal(diagnostic.reasoningLength, 0);
  assert.equal(diagnostic.attempt, 2);
  assert.equal(diagnostic.repairAttempted, true);
  assert.equal(diagnostic.sample, '<redacted-sample>', 'Diagnostics should pass through the injected redactor before persistence.');
  assert.deepEqual(diagnostic.rejectedTargetIds, rejectedTargetIds.slice(0, 20));
  assert.equal(diagnostic.rejectionDiagnostics.length, 20, 'Verbose rejection diagnostics should be bounded.');
  assert.equal(diagnostic.rejectionSummary, 'All drafts failed entry guard checks.');
}

{
  const calls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => calls.push(args);
  try {
    warnLoredeckCreatorGenerationFailure(
      {
        name: 'LoreResponseError',
        message: 'Provider returned no visible content.',
        sagaRawMessage: 'raw parser message',
        diagnostic: {
          stage: 'entry_batch_draft',
          unitId: 'entry:micro-batch-1',
          unitLabel: 'Entry micro-batch 1',
          errorCode: LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT,
          errorName: 'LoreResponseError',
          errorMessage: 'Provider returned no visible content.',
          parsePhase: 'provider',
          finishReason: 'stop',
          visibleContentLength: 0,
          repairAttempted: false,
          sample: 'provider payload should not be logged',
          rawResult: { secret: 'do not log' },
        },
      },
      { stage: 'entry_batch_draft' },
    );
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(calls.length, 1, 'Failure warnings should emit one compact diagnostic log.');
  assert.equal(calls[0][0], '[Saga] Deck Maker generation failed:');
  const warning = calls[0][1];
  assert.equal(warning.stage, 'entry_batch_draft');
  assert.equal(warning.unitId, 'entry:micro-batch-1');
  assert.equal(warning.errorCode, LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT);
  assert.equal(warning.visibleContentLength, 0);
  assert(!Object.hasOwn(warning, 'sample'), 'Failure warnings should not log provider samples.');
  assert(!Object.hasOwn(warning, 'rawResult'), 'Failure warnings should not log raw provider payloads.');
}

console.log('Deck Maker generation diagnostics tests passed.');
