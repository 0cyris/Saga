import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings: { saga: {} },
      chatMetadata: { saga: {} },
      chat: [],
      saveSettingsDebounced() {},
      saveMetadata() {},
    };
  },
};

const { __contextResolverTestHooks } = await import('../../src/context/context-resolver.js');
const { __continuityScanTestHooks } = await import('../../src/continuity/continuity-scanner.js');
const { __bulkLoreTestHooks } = await import('../../src/lorecards/lore-generator.js');
const { __autoRelevanceTestHooks } = await import('../../src/context/auto-relevance.js');
const { LORE_PARSE_ERROR_CODES } = await import('../../src/providers/lore-response-normalizer.js');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function chatCompletion(content, finishReason = 'stop') {
  return {
    id: 'chatcmpl-generation-shape-fixture',
    object: 'chat.completion',
    choices: [{
      message: { role: 'assistant', content },
      finish_reason: finishReason,
    }],
  };
}

{
  const content = JSON.stringify({
    contexts: [{ packId: 'fixture-pack', status: 'unresolved', reason: 'ambiguous scene text' }],
  });
  const parsed = __contextResolverTestHooks.parseContextModelResponse(chatCompletion(content));
  assert.equal(parsed.contexts.length, 1);
  assert.equal(parsed.contexts[0].packId, 'fixture-pack');
}

{
  const parsed = __contextResolverTestHooks.parseContextModelResponse(chatCompletion('{"contexts":['));
  assert.equal(parsed.contexts.length, 0);
  assert.equal(parsed.errorCode, LORE_PARSE_ERROR_CODES.JSON_INVALID);
  assert.match(parsed.error, /malformed JSON/);
}

{
  const content = JSON.stringify({
    observations: [{
      section: 'scene',
      subject: 'location',
      observation: 'The scene is in the library.',
      actionHint: 'update',
      confidence: 0.9,
      messageRefs: [7],
    }],
  });
  const parsed = __continuityScanTestHooks.parseObservationResponse(chatCompletion(content), {
    startIndex: 7,
    endIndex: 7,
  });
  assert.equal(parsed.observations.length, 1);
  assert.equal(parsed.observations[0].section, 'scene');
}

{
  const content = JSON.stringify({
    summary: 'Scene location updated.',
    changes: {
      scene: {
        location: 'Library',
        currentActivity: 'Researching clues',
      },
    },
  });
  const parsed = __continuityScanTestHooks.parseDeltaResponse(chatCompletion(content));
  assert.equal(parsed.changes.scene.location, 'Library');
}

{
  const failure = __continuityScanTestHooks.buildContinuityReducerParseFailure({ id: 'scene_timeline' });
  assert.equal(failure.status, 'failed_parse');
  assert.equal(failure.errorCode, LORE_PARSE_ERROR_CODES.JSON_INVALID);
  assert.equal(failure.group.id, 'scene_timeline');
}

{
  const content = JSON.stringify({
    chunkSummary: 'Nami hides a map.',
    facts: [{
      category: 'secret',
      subject: 'Nami',
      fact: 'Nami hides a map from Arlong.',
      priorityHint: 'high',
      relevanceHint: 'high',
      messageRefs: [12],
    }],
  });
  const parsed = __bulkLoreTestHooks.parseBulkCandidateResponse(chatCompletion(content), {
    startIndex: 12,
    endIndex: 12,
  });
  assert.equal(parsed.facts.length, 1);
  assert.equal(parsed.facts[0].subject, 'Nami');
}

{
  const failure = __bulkLoreTestHooks.getBulkCandidateParseFailure('{"facts":[');
  assert.equal(failure.errorCode, LORE_PARSE_ERROR_CODES.JSON_INVALID);
  assert.match(failure.error, /malformed JSON/);
  const empty = __bulkLoreTestHooks.getBulkCandidateParseFailure('');
  assert.equal(empty.errorCode, '');
  assert.match(empty.error, /no visible response/);
}

{
  const content = JSON.stringify({
    changes: [{ id: 'nami_secret', relevance: 'high', confidence: 0.91, reason: 'Current scene secret.' }],
  });
  const parsed = __autoRelevanceTestHooks.parseJsonObject(chatCompletion(content));
  assert.equal(parsed.changes.length, 1);
  assert.equal(parsed.changes[0].id, 'nami_secret');
}

{
  const failure = __autoRelevanceTestHooks.buildAutoRelevanceModelParseFailure();
  assert.equal(failure.status, 'failed_parse');
  assert.equal(failure.errorCode, LORE_PARSE_ERROR_CODES.JSON_INVALID);
}

const injectionPreviewPanel = await readFile(path.join(repoRoot, 'src/runtime/injection-preview-panel.js'), 'utf8');
assert(
  injectionPreviewPanel.includes('extractLoreResponseText(text)') && injectionPreviewPanel.includes('function cleanCompressedText(text)'),
  'Compression output cleanup must normalize provider-shaped visible text before validation.'
);

console.log('Generation response shape tests passed.');
