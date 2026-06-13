import assert from 'node:assert/strict';

const {
  attemptLoredeckHealthFixes,
} = await import('../../src/loredecks/loredeck-health-attempt-fixing.js');
const {
  readLoredeckHealthRepairSession,
} = await import('../../src/loredecks/loredeck-health-repair-session-storage.js');
const {
  runPackHealth,
} = await import('../../src/loredecks/loredeck-health-repair-storage-adapter.js');
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
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');
const {
  buildModelRepairPack,
  buildRetrievalDefaultsRepairPack,
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-attempt-fixing-test' }),
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

configureStorage();
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
configureStorage();

const retrievalPack = retargetPack(buildRetrievalDefaultsRepairPack(), 'attempt-local-repair-pack', 'Attempt Local Repair Pack');
const retrievalPayloadFile = await persistExternalPack(retrievalPack);

const modelPack = retargetPack(buildModelRepairPack(), 'attempt-model-pending-pack', 'Attempt Model Pending Pack');
const modelPayloadFile = await persistExternalPack(modelPack);

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureStorage();
clock = 2000;

const localBefore = await runPackHealth('attempt-local-repair-pack', storageOptions);
assert.equal(localBefore.health.summary.errorCount, 2);
const localAttempt = await attemptLoredeckHealthFixes('attempt-local-repair-pack', storageOptions);
assert.equal(localAttempt.ok, true);
assert.equal(localAttempt.changed, true);
assert.equal(localAttempt.preflightHealth.summary.errorCount, 2);
assert.equal(localAttempt.finalHealth.summary.errorCount, 0);
assert.equal(localAttempt.summary.outcome, 'clean');
assert.equal(localAttempt.summary.healthDelta.resolvedErrorCount, 2);
assert.equal(localAttempt.remaining.modelUnits.length, 0);
assert.equal(localAttempt.remaining.choiceSets.length, 0);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const repairedPayload = JSON.parse(stored.get(retrievalPayloadFile));
assert.deepEqual(repairedPayload.entryOverrides['arlong-style-entry-01'].retrieval, {
  activation: 'context_or_topic',
  frequency: 'normal',
  contextBoost: 'high',
});
assert.equal(repairedPayload.healthStatus, 'good');

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureStorage();
clock = 3000;
const localReload = await runPackHealth('attempt-local-repair-pack', storageOptions);
assert.equal(localReload.health.status, 'good');
assert.equal(localReload.health.summary.errorCount, 0);

const modelBefore = await runPackHealth('attempt-model-pending-pack', storageOptions);
assert.equal(modelBefore.health.summary.errorCount, 1);
const modelAttempt = await attemptLoredeckHealthFixes('attempt-model-pending-pack', {
  ...storageOptions,
  persistSession: true,
});
assert.equal(modelAttempt.ok, true);
assert.equal(modelAttempt.changed, false);
assert.equal(modelAttempt.summary.outcome, 'model_pending');
assert.equal(modelAttempt.remaining.modelUnits.length, 1);
assert.equal(modelAttempt.remaining.deferredUnits.length, 0);
assert.equal(modelAttempt.remaining.manualBuckets.length, 1);
assert.equal(modelAttempt.appliedPatches.length, 0);
assert.equal(modelAttempt.session.status, 'model_pending');
assert.equal(modelAttempt.session.packId, 'attempt-model-pending-pack');
assert.equal(modelAttempt.session.remaining.modelUnits.length, 1);
assert.equal(modelAttempt.session.pack, undefined);
assert.equal(stored.has(modelAttempt.sessionPath), true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const modelPayload = JSON.parse(stored.get(modelPayloadFile));
const modelEntry = modelPayload.entryOverrides['namis-childhood-under-arlongs-rule'];
assert.equal(modelEntry.content.fact, '');
assert.equal(modelEntry.content.injection, '');
assert.equal(modelPayload.healthStatus, 'has_errors');
const modelSessionPayload = JSON.parse(stored.get(modelAttempt.sessionPath));
assert.equal(modelSessionPayload.kind, 'saga_loredeck_health_repair_session');
assert.equal(modelSessionPayload.pack, undefined);
assert.equal(modelSessionPayload.entryOverrides, undefined);
assert.equal(modelSessionPayload.remaining.modelUnits.length, 1);
const modelSessionRead = await readLoredeckHealthRepairSession(modelAttempt.sessionPath, storageOptions);
assert.equal(modelSessionRead.ok, true);
assert.equal(modelSessionRead.session.sessionId, modelAttempt.session.sessionId);
const savedLibraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(savedLibraryIndex.packs['attempt-local-repair-pack'].healthStatus, 'good');
assert.equal(savedLibraryIndex.packs['attempt-model-pending-pack'].healthStatus, 'has_errors');
assert.equal(savedLibraryIndex.packs['attempt-local-repair-pack'].entryOverrides, undefined);
assert.equal(savedLibraryIndex.packs['attempt-model-pending-pack'].entryOverrides, undefined);
const savedMasterIndex = JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(savedMasterIndex.files[modelAttempt.sessionPath].kind, 'loredeck_health_repair_session');
assert.equal(savedMasterIndex.files[modelAttempt.sessionPath].ownerId, 'attempt-model-pending-pack');

console.log('Loredeck health Attempt Fixing tests passed.');
