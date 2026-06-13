import assert from 'node:assert/strict';

const {
  runLoredeckHealthModelRepairBatches,
} = await import('../../src/loredecks/loredeck-health-model-repair-runner.js');
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
  buildLargeModelRepairPack,
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-model-repair-runner-test' }),
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

function buildDirectModelResponse({ pack, unit }) {
  return JSON.stringify({
    repairs: unit.entryIds.map((entryId, index) => {
      const entry = cloneRepairFixture(pack.entryOverrides[entryId]);
      entry.content = {
        fact: `Recovered schema v3 fact for ${entry.title || entryId}.`,
        injection: `When ${entry.title || entryId} is relevant, use this recovered compact Lorecard content.`,
      };
      return {
        repairId: `repair_content_${index + 1}`,
        findingIds: unit.findingIds,
        confidence: 0.94,
        risk: 'low',
        applyMode: 'direct',
        patch: {
          operations: [{
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
            entryId,
            fields: ['content'],
            entry,
          }],
        },
        reason: 'Filled missing schema v3 content.',
      };
    }),
    choices: [],
    warnings: [],
    clarifyingQuestions: [],
  });
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

const directPack = retargetPack(buildModelRepairPack(), 'model-runner-direct-pack', 'Model Runner Direct Pack');
const directPayloadFile = await persistExternalPack(directPack);
const choicePack = retargetPack(buildModelRepairPack(), 'model-runner-choice-pack', 'Model Runner Choice Pack');
const choicePayloadFile = await persistExternalPack(choicePack);
const failedPack = retargetPack(buildLargeModelRepairPack({ count: 2, packId: 'model-runner-failed-pack' }), 'model-runner-failed-pack', 'Model Runner Failed Pack');
const failedPayloadFile = await persistExternalPack(failedPack);
const largePack = retargetPack(buildLargeModelRepairPack({ count: 17, packId: 'model-runner-large-pack' }), 'model-runner-large-pack', 'Model Runner Large Pack');
await persistExternalPack(largePack);

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureStorage();

clock = 2000;
const directBefore = await runPackHealth('model-runner-direct-pack', storageOptions);
assert.equal(directBefore.health.summary.errorCount, 1);
const directResult = await runLoredeckHealthModelRepairBatches('model-runner-direct-pack', {
  ...storageOptions,
  maxUnits: 1,
  persistSession: true,
  requestModelRepair: async context => {
    assert.equal(context.promptPayload.targetEntries.length, 1);
    assert.deepEqual(context.promptPayload.allowedFields, ['content']);
    return buildDirectModelResponse(context);
  },
});
assert.equal(directResult.ok, true);
assert.equal(directResult.changed, true);
assert.equal(directResult.finalHealth.summary.errorCount, 0);
assert.equal(directResult.remaining.modelUnits.length, 0);
assert.equal(directResult.remaining.deferredUnits.length, 0);
assert.equal(directResult.appliedPatches.length, 1);
assert.equal(directResult.remaining.modelProgress[0].status, 'complete');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
const directPayload = JSON.parse(stored.get(directPayloadFile));
assert.match(directPayload.entryOverrides['namis-childhood-under-arlongs-rule'].content.fact, /Recovered schema v3 fact/);

clock = 3000;
const choiceResult = await runLoredeckHealthModelRepairBatches('model-runner-choice-pack', {
  ...storageOptions,
  maxUnits: 1,
  persistSession: true,
  requestModelRepair: buildChoiceModelResponse,
});
assert.equal(choiceResult.ok, true);
assert.equal(choiceResult.changed, false);
assert.equal(choiceResult.choiceSets.length, 1);
assert.equal(choiceResult.remaining.choiceSets.length, 1);
assert.equal(choiceResult.remaining.modelUnits.length, 0);
assert.equal(choiceResult.session.status, 'needs_review');
assert.equal(choiceResult.remaining.modelProgress[0].choiceSetIds[0], 'choice_model_content');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
const choicePayload = JSON.parse(stored.get(choicePayloadFile));
assert.equal(choicePayload.entryOverrides['namis-childhood-under-arlongs-rule'].content.fact, '');
assert.equal(choicePayload.entryOverrides['namis-childhood-under-arlongs-rule'].content.injection, '');
const choiceSessionRead = await readLoredeckHealthRepairSession(choiceResult.sessionPath, storageOptions);
assert.equal(choiceSessionRead.ok, true);
assert.equal(choiceSessionRead.session.remaining.choiceSets.length, 1);
assert.equal(choiceSessionRead.session.remaining.modelProgress.length, 1);
assert.equal(choiceSessionRead.session.promptPayload, undefined);
assert.equal(choiceSessionRead.session.rawResponse, undefined);

clock = 4000;
let failedCalls = 0;
const failedResult = await runLoredeckHealthModelRepairBatches('model-runner-failed-pack', {
  ...storageOptions,
  batchLimits: { modelEntryLimit: 1, modelUnitLimit: 2 },
  maxUnits: 2,
  persistSession: true,
  requestModelRepair: async context => {
    failedCalls += 1;
    if (failedCalls === 1) return buildDirectModelResponse(context);
    return JSON.stringify({
      repairs: [],
      choices: [],
      warnings: ['The second unit could not be repaired safely.'],
      clarifyingQuestions: [],
    });
  },
});
assert.equal(failedResult.ok, false);
assert.equal(failedResult.changed, true);
assert.equal(failedResult.finalHealth.summary.errorCount, 1);
assert.equal(failedResult.remaining.modelProgress.length, 2);
assert.equal(failedResult.remaining.modelProgress[0].status, 'complete');
assert.equal(failedResult.remaining.modelProgress[1].status, 'failed');
assert.equal(failedResult.session.status, 'model_pending');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
const failedPayload = JSON.parse(stored.get(failedPayloadFile));
const repairedEntryId = failedResult.selectedUnits[0].entryIds[0];
const failedEntryId = failedResult.selectedUnits[1].entryIds[0];
assert.match(failedPayload.entryOverrides[repairedEntryId].content.fact, /Recovered schema v3 fact/);
assert.equal(failedPayload.entryOverrides[failedEntryId].content.fact, '');
const failedSessionRead = await readLoredeckHealthRepairSession(failedResult.sessionPath, storageOptions);
assert.equal(failedSessionRead.ok, true);
assert.deepEqual(failedSessionRead.session.remaining.modelProgress.map(item => item.status), ['complete', 'failed']);

clock = 5000;
let largeCalls = 0;
const largeResult = await runLoredeckHealthModelRepairBatches('model-runner-large-pack', {
  ...storageOptions,
  batchLimits: { modelEntryLimit: 5, modelUnitLimit: 2 },
  maxUnits: 4,
  persistSession: false,
  requestModelRepair: async context => {
    largeCalls += 1;
    assert.ok(context.promptPayload.targetEntries.length <= 5);
    return buildDirectModelResponse(context);
  },
});
assert.equal(largeResult.ok, true);
assert.equal(largeCalls, 4);
assert.equal(largeResult.finalHealth.summary.errorCount, 0);
assert.equal(largeResult.remaining.modelUnits.length, 0);
assert.equal(largeResult.remaining.deferredUnits.length, 0);
assert.equal(largeResult.appliedPatches.length, 17);

console.log('Loredeck health model repair runner tests passed.');
