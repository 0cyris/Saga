import assert from 'node:assert/strict';

const {
  applyPackRepairPatch,
  applyPackRepairPatches,
  loadPackPayload,
  runPackHealth,
} = await import('../../src/loredecks/loredeck-health-repair-storage-adapter.js');
const {
  buildLoredeckHealthRepairPlan,
} = await import('../../src/loredecks/loredeck-health-fix-planner.js');
const {
  buildLoredeckLocalRepairsForPlan,
} = await import('../../src/loredecks/loredeck-health-local-repairs.js');
const {
  buildRetrievalDefaultsRepairPack,
  cloneRepairFixture,
} = await import('./loredeck-health-repair-test-fixtures.mjs');
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
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-repair-storage-adapter-test' }),
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

configureSagaLorepackLibraryStorage(storageOptions);
configureSagaLorepackPayloadStorage(storageOptions);
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
configureSagaLorepackLibraryStorage(storageOptions);
configureSagaLorepackPayloadStorage(storageOptions);

const pack = buildRetrievalDefaultsRepairPack();
pack.packId = 'stage2-repair-adapter-pack';
pack.id = 'stage2-repair-adapter-pack';
pack.title = 'Stage 2 Repair Adapter Pack';
pack.manifestData.id = 'stage2-repair-adapter-pack';
pack.manifestData.title = 'Stage 2 Repair Adapter Pack';
pack.type = 'custom';
const payloadResult = upsertExternalLorepackPayloadSync(pack, storageOptions);
assert.equal(payloadResult.ok, true);
const libraryResult = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, storageOptions);
assert.equal(libraryResult.ok, true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
assert.equal(stored.has(payloadResult.libraryRecord.payloadFile), true);

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureSagaLorepackLibraryStorage(storageOptions);
configureSagaLorepackPayloadStorage(storageOptions);
clock = 2000;

const loaded = await loadPackPayload('stage2-repair-adapter-pack', storageOptions);
assert.equal(loaded.ok, true);
assert.equal(loaded.pack.packId, 'stage2-repair-adapter-pack');
assert.equal(Object.keys(loaded.pack.entryOverrides || {}).length, 2);

const beforeHealthResult = await runPackHealth('stage2-repair-adapter-pack', storageOptions);
assert.equal(beforeHealthResult.ok, true);
assert.equal(beforeHealthResult.health.summary.errorCount, 2);

const plan = buildLoredeckHealthRepairPlan({ pack: loaded.pack, health: beforeHealthResult.health });
const local = buildLoredeckLocalRepairsForPlan(loaded.pack, plan);
assert.ok(local.patches.length >= 2);

const invalidPatch = cloneRepairFixture(local.patches[0]);
invalidPatch.operations[0].entryId = 'unrelated-entry';
invalidPatch.operations[0].entry.id = 'unrelated-entry';
const invalidResult = await applyPackRepairPatch('stage2-repair-adapter-pack', invalidPatch, storageOptions);
assert.equal(invalidResult.ok, false);
assert.equal(invalidResult.appliedPatches.length, 0);
assert.ok(invalidResult.diagnostics.some(item => String(item.message || '').includes('unrelated entry')));
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
const unchangedPayload = JSON.parse(stored.get(payloadResult.libraryRecord.payloadFile));
assert.equal(Object.hasOwn(unchangedPayload.entryOverrides['arlong-style-entry-01'], 'retrieval'), false);

clock = 3000;
const repairResult = await applyPackRepairPatches('stage2-repair-adapter-pack', local.patches, storageOptions);
assert.equal(repairResult.ok, true);
assert.equal(repairResult.beforeHealth.summary.errorCount, 2);
assert.equal(repairResult.afterHealth.summary.errorCount, 0);
assert.equal(repairResult.summary.healthDelta.resolvedErrorCount, 2);
assert.ok(repairResult.appliedPatches.length >= 1);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const repairedPayload = JSON.parse(stored.get(payloadResult.libraryRecord.payloadFile));
assert.deepEqual(repairedPayload.entryOverrides['arlong-style-entry-01'].retrieval, {
  activation: 'context_or_topic',
  frequency: 'normal',
  contextBoost: 'high',
});
assert.equal(repairedPayload.entryOverrides['namis-childhood-under-arlongs-rule'].retrieval.activation, 'context_or_topic');
assert.equal(repairedPayload.entryOverrides['namis-childhood-under-arlongs-rule'].retrieval.contextBoost, 'high');
assert.equal(repairedPayload.healthStatus, 'good');
assert.equal(repairedPayload.stats.entryCount, 2);

const savedLibraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
const compactRow = savedLibraryIndex.packs['stage2-repair-adapter-pack'];
assert.equal(compactRow.payloadFile, payloadResult.libraryRecord.payloadFile);
assert.equal(compactRow.healthStatus, 'good');
assert.equal(compactRow.entryCount, 2);
assert.equal(compactRow.entryOverrides, undefined);
assert.equal(compactRow.manifestData, undefined);

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureSagaLorepackLibraryStorage(storageOptions);
configureSagaLorepackPayloadStorage(storageOptions);
clock = 4000;
const afterReloadHealth = await runPackHealth('stage2-repair-adapter-pack', storageOptions);
assert.equal(afterReloadHealth.ok, true);
assert.equal(afterReloadHealth.health.summary.errorCount, 0);
assert.equal(afterReloadHealth.health.status, 'good');

console.log('Loredeck health repair storage adapter tests passed.');
