import assert from 'node:assert/strict';

const {
  attemptLoredeckHealthFixes,
} = await import('../../src/loredecks/loredeck-health-attempt-fixing.js');
const {
  runLoredeckHealthModelRepairBatches,
} = await import('../../src/loredecks/loredeck-health-model-repair-runner.js');
const {
  applyLoredeckHealthRepairChoice,
} = await import('../../src/loredecks/loredeck-health-review-choices.js');
const {
  readLoredeckHealthRepairSession,
} = await import('../../src/loredecks/loredeck-health-repair-session-storage.js');
const {
  runPackHealth,
} = await import('../../src/loredecks/loredeck-health-repair-storage-adapter.js');
const {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
} = await import('../../src/loredecks/loredeck-health-repair-contracts.js');
const {
  configureSagaLorepackLibraryStorage,
  flushSagaLorepackLibraryStorageWrites,
  resetSagaLorepackLibraryStorageCache,
  upsertExternalLoredeckLibraryRecordSync,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  configureSagaLorepackPayloadStorage,
  flushSagaLorepackPayloadStorageWrites,
  resetSagaLorepackPayloadStorageCache,
  upsertExternalLorepackPayloadSync,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');
const {
  buildAmbiguousTagRepairPack,
  buildModelRepairPack,
  cloneRepairFixture,
} = await import('./loredeck-health-repair-test-fixtures.mjs');

const stored = new Map();

function response(ok, status, body = '') {
  return {
    ok,
    status,
    async text() {
      return body;
    },
  };
}

const fileApi = createSagaFileApi({
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-review-choice-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;

    if (url === '/api/files/upload' && method === 'POST') {
      const path = `/user/files/${body.name}`;
      stored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
      return response(true, 200, JSON.stringify({ path }));
    }

    if (url === '/api/files/delete' && method === 'POST') {
      stored.delete(body.path);
      return response(true, 200, JSON.stringify({ ok: true }));
    }

    if (url === '/api/files/verify' && method === 'POST') {
      return response(true, 200, JSON.stringify(Object.fromEntries((body.urls || []).map(path => [path, stored.has(path)]))));
    }

    if (method === 'GET') {
      if (!stored.has(url)) return response(false, 404, 'missing');
      return response(true, 200, stored.get(url));
    }

    return response(false, 404, 'unexpected request');
  },
});

let clock = 1000;
const now = () => clock;
const storageOptions = { fileApi, now };

function configureStorage() {
  configureSagaLorepackLibraryStorage(storageOptions);
  configureSagaLorepackPayloadStorage(storageOptions);
}

function retargetPack(pack, packId, title) {
  pack.packId = packId;
  pack.id = packId;
  pack.title = title;
  pack.type = 'custom';
  if (pack.manifestData) {
    pack.manifestData.id = packId;
    pack.manifestData.title = title;
  }
  return pack;
}

async function persistExternalPack(pack) {
  const payloadResult = upsertExternalLorepackPayloadSync(pack, storageOptions);
  assert.equal(payloadResult.ok, true);
  const libraryResult = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, storageOptions);
  assert.equal(libraryResult.ok, true);
  await flushSagaLorepackPayloadStorageWrites();
  await flushSagaLorepackLibraryStorageWrites();
  return payloadResult.libraryRecord.payloadFile;
}

function buildChoiceModelResponse({ pack, unit }) {
  const entryId = unit.entryIds[0];
  const entry = cloneRepairFixture(pack.entryOverrides[entryId]);
  entry.content = {
    fact: 'Nami hides the buyback plan while Arlong controls Cocoyasi.',
    injection: 'When Arlong Park pressure is relevant, treat Nami as hiding coerced payments from her friends.',
  };
  return JSON.stringify({
    repairs: [],
    choices: [{
      choiceSetId: 'choice_model_content',
      findingIds: unit.findingIds,
      question: 'Which content repair should apply?',
      options: [{
        optionId: 'A',
        label: 'Coerced buyback',
        confidence: 0.82,
        patch: {
          findingIds: unit.findingIds,
          operations: [{
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
            entryId,
            fields: ['content'],
            entry,
          }],
        },
      }],
    }],
    warnings: [],
    clarifyingQuestions: [],
  });
}

configureStorage();
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
configureStorage();

const localChoicePack = retargetPack(buildAmbiguousTagRepairPack(), 'review-choice-local-pack', 'Review Choice Local Pack');
const localChoiceEntry = localChoicePack.entryOverrides['namis-childhood-under-arlongs-rule'];
localChoiceEntry.context.validToAnchor = 'one-piece.arlong.end';
localChoiceEntry.context.sortKeyTo = 30;
delete localChoiceEntry.fact;
delete localChoiceEntry.date;
delete localChoiceEntry.whoKnowsTruth;
localChoiceEntry.tags = ['characternami'];
const localChoicePayloadFile = await persistExternalPack(localChoicePack);
const modelChoicePack = retargetPack(buildModelRepairPack(), 'review-choice-model-pack', 'Review Choice Model Pack');
const modelChoicePayloadFile = await persistExternalPack(modelChoicePack);

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureStorage();

clock = 2000;
const localAttempt = await attemptLoredeckHealthFixes('review-choice-local-pack', {
  ...storageOptions,
  persistSession: true,
});
if (!localAttempt.ok) console.log(JSON.stringify({ localAttemptError: localAttempt.error, diagnostics: localAttempt.diagnostics, initialPlan: localAttempt.initialPlan?.summary }, null, 2));
assert.equal(localAttempt.ok, true);
assert.equal(localAttempt.session.status, 'needs_review');
assert.equal(localAttempt.remaining.choiceSets.length, 1);
const localChoice = localAttempt.remaining.choiceSets[0];
const localOption = localChoice.options.find(option => option.label === 'character:nami');
assert.ok(localOption, 'Expected the local ambiguous tag choice to offer character:nami.');

clock = 2500;
const localChoiceApply = await applyLoredeckHealthRepairChoice('review-choice-local-pack', {
  session: localAttempt.session,
  sessionPath: localAttempt.sessionPath,
  choiceSetId: localChoice.choiceSetId,
  optionId: localOption.optionId,
}, storageOptions);
assert.equal(localChoiceApply.ok, true);
assert.equal(localChoiceApply.changed, true);
assert.equal(localChoiceApply.remaining.choiceSets.length, 0);
assert.notEqual(localChoiceApply.session?.status, 'needs_review');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const localChoicePayload = JSON.parse(stored.get(localChoicePayloadFile));
assert.ok(localChoicePayload.entryOverrides['namis-childhood-under-arlongs-rule'].tags.includes('character:nami'));
assert.ok(!localChoicePayload.entryOverrides['namis-childhood-under-arlongs-rule'].tags.includes('characternami'));
const localSessionRead = await readLoredeckHealthRepairSession(localChoiceApply.sessionPath, storageOptions);
assert.equal(localSessionRead.ok, true);
assert.equal(localSessionRead.session.remaining.choiceSets.length, 0);

clock = 3000;
const modelChoiceResult = await runLoredeckHealthModelRepairBatches('review-choice-model-pack', {
  ...storageOptions,
  maxUnits: 1,
  persistSession: true,
  requestModelRepair: buildChoiceModelResponse,
});
assert.equal(modelChoiceResult.ok, true);
assert.equal(modelChoiceResult.changed, false);
assert.equal(modelChoiceResult.session.status, 'needs_review');
assert.equal(modelChoiceResult.remaining.choiceSets.length, 1);

clock = 3500;
const modelChoiceApply = await applyLoredeckHealthRepairChoice('review-choice-model-pack', {
  session: modelChoiceResult.session,
  sessionPath: modelChoiceResult.sessionPath,
  choiceSetId: 'choice_model_content',
  optionId: 'A',
}, storageOptions);
assert.equal(modelChoiceApply.ok, true);
assert.equal(modelChoiceApply.changed, true);
assert.equal(modelChoiceApply.remaining.choiceSets.length, 0);
assert.equal(modelChoiceApply.finalHealth.summary.errorCount, 0);
assert.equal(modelChoiceApply.deletedSession, false);
assert.equal(modelChoiceApply.session.status, 'manual_remaining');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const modelChoicePayload = JSON.parse(stored.get(modelChoicePayloadFile));
assert.match(modelChoicePayload.entryOverrides['namis-childhood-under-arlongs-rule'].content.fact, /Nami hides/);
const modelSessionRead = await readLoredeckHealthRepairSession(modelChoiceApply.sessionPath, storageOptions);
assert.equal(modelSessionRead.ok, true);
assert.equal(modelSessionRead.session.remaining.choiceSets.length, 0);
assert.equal(modelSessionRead.session.status, 'manual_remaining');
const modelAfter = await runPackHealth('review-choice-model-pack', storageOptions);
assert.equal(modelAfter.health.summary.errorCount, 0);

console.log('Loredeck health review choice application tests passed.');
