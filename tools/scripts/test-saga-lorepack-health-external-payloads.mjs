import assert from 'node:assert/strict';

const { MODULE_KEY, SCHEMA_VERSION } = await import('../../src/state/constants.js');
const {
  getLoredeckLibraryRegistry,
} = await import('../../src/state/state-manager.js');
const {
  configureSagaLorepackLibraryStorage,
  flushSagaLorepackLibraryStorageWrites,
  hydrateSagaLorepackLibraryStorage,
  resetSagaLorepackLibraryStorageCache,
  upsertExternalLoredeckLibraryRecordSync,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  configureSagaLorepackPayloadStorage,
  flushSagaLorepackPayloadStorageWrites,
  normalizeExternalLorepackPayload,
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
  configureLoredeckEditorValidation,
  getExpectedLoredeckEntrySchemaVersion,
  validateLoredeckForEditor,
} = await import('../../src/runtime/loredeck-editor-validation.js');
const {
  configureLoredeckEditorActions,
  repairLoredeckSafeHealthIssues,
} = await import('../../src/runtime/loredeck-editor-actions.js');
const {
  upsertLoredeckLibraryPack,
} = await import('../../src/state/state-manager.js');

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-external-payloads-test' }),
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
configureSagaLorepackLibraryStorage({ fileApi, now });
configureSagaLorepackPayloadStorage({ fileApi, now });
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
configureSagaLorepackLibraryStorage({ fileApi, now });
configureSagaLorepackPayloadStorage({ fileApi, now });

let settingsSaveCount = 0;
let metadataSaveCount = 0;
const extensionSettings = {
  [MODULE_KEY]: {},
};
const chatMetadata = {
  [MODULE_KEY]: {
    _version: SCHEMA_VERSION,
    loredeckRegistry: { schemaVersion: 1, packs: {} },
    loredeckStack: [],
  },
};

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings,
      chatMetadata,
      saveSettingsDebounced() {
        settingsSaveCount += 1;
      },
      saveMetadata() {
        metadataSaveCount += 1;
      },
    };
  },
};

const payload = normalizeExternalLorepackPayload({
  packId: 'health-external-pack',
  type: 'custom',
  title: 'Health External Pack',
  description: 'External Pack Health fixture.',
  healthStatus: 'stale',
  stats: { entryCount: 1, categoryCounts: { character: 1 } },
  manifestData: {
    id: 'health-external-pack',
    title: 'Health External Pack',
    entrySchemaVersion: 3,
    files: [],
    stats: { entryCount: 1, categoryCounts: { character: 1 } },
  },
  entryOverrides: {
    nami: {
      id: 'nami',
      schemaVersion: 3,
      title: 'Nami',
      category: 'character',
      context: {
        scope: 'global',
        sortKeyFrom: 0,
        sortKeyTo: 0,
        precision: 'series',
        label: 'Global',
      },
      retrieval: {
        activation: 'topic_or_entity',
        frequency: 'low',
        contextBoost: 'low',
      },
      content: {
        fact: 'Nami maps Arlong Park from inside the crew.',
        injection: 'Nami maps Arlong Park from inside the crew.',
      },
    },
  },
});

const payloadResult = upsertExternalLorepackPayloadSync(payload, { now: 1000 });
assert.equal(payloadResult.ok, true);
const libraryResult = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, { now: 1000 });
assert.equal(libraryResult.ok, true);
assert.equal(payloadResult.libraryRecord.payloadFile, '/user/files/saga-pack-health-external-pack.v1.json');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
assert.equal(stored.has(payloadResult.libraryRecord.payloadFile), true);
assert.equal(stored.has(SAGA_STORAGE_DOMAIN_INDEX_FILES.library), true);

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureSagaLorepackLibraryStorage({ fileApi, now });
configureSagaLorepackPayloadStorage({ fileApi, now });
clock = 2000;
await hydrateSagaLorepackLibraryStorage({ fileApi, now, force: true });

const manifestPreviewCache = new Map();
const entryPreviewCache = new Map();
const timelineRegistryCache = new Map();
const tagRegistryCache = new Map();

function getFreshPack(packId, fallback = null) {
  const registry = getLoredeckLibraryRegistry(chatMetadata[MODULE_KEY]);
  return registry.packs?.[String(packId || '').trim()] || fallback;
}

configureLoredeckEditorValidation({
  getFreshLoredeckLibraryPack: getFreshPack,
  getLoredeckManifestPreviewCacheRecord: packId => manifestPreviewCache.get(String(packId || '').trim()) || null,
  setLoredeckManifestPreviewCacheRecord: (packId, record) => manifestPreviewCache.set(String(packId || '').trim(), record),
  getLoredeckEntryPreviewCacheRecord: packId => entryPreviewCache.get(String(packId || '').trim()) || null,
  setLoredeckEntryPreviewCacheRecord: (packId, record) => entryPreviewCache.set(String(packId || '').trim(), record),
  setLoredeckTimelineRegistryCacheRecord: (packId, record) => timelineRegistryCache.set(String(packId || '').trim(), record),
  setLoredeckTagRegistryCacheRecord: (packId, record) => tagRegistryCache.set(String(packId || '').trim(), record),
  refreshLoredeckSurfaces: () => {},
});

const compactPack = getFreshPack('health-external-pack');
assert.equal(compactPack.payloadFile, payloadResult.libraryRecord.payloadFile);
assert.deepEqual(compactPack.entryOverrides, {}, 'Cold compact Library rows should not contain Lorecard payloads before validation hydrates them.');
assert.equal(compactPack.manifestData, undefined);

const validation = await validateLoredeckForEditor(compactPack, null, { quiet: true, updateLibrary: true });
assert.equal(validation.error, undefined);
assert.equal(validation.health.status, 'good');
assert.equal(validation.health.summary.entryCount, 1);
assert.equal(entryPreviewCache.get('health-external-pack').entryFiles[0].entries[0].id, 'nami');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const savedPayload = JSON.parse(stored.get(payloadResult.libraryRecord.payloadFile));
assert.equal(savedPayload.healthStatus, 'good');
assert.equal(savedPayload.stats.entryCount, 1);
assert.equal(savedPayload.entryOverrides.nami.content.fact, 'Nami maps Arlong Park from inside the crew.');
assert.equal(savedPayload.manifestData.files.length, 0);

const savedLibraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
const compactSavedRow = savedLibraryIndex.packs['health-external-pack'];
assert.equal(compactSavedRow.healthStatus, 'good');
assert.equal(compactSavedRow.entryCount, 1);
assert.equal(compactSavedRow.payloadFile, payloadResult.libraryRecord.payloadFile);
assert.equal(compactSavedRow.entryOverrides, undefined, 'Library index must remain compact after Pack Health saves.');
assert.equal(compactSavedRow.manifestData, undefined, 'Library index must not absorb embedded manifests after Pack Health saves.');

const masterIndex = JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(masterIndex.files[payloadResult.libraryRecord.payloadFile].kind, 'lorepack_payload');
assert.equal(masterIndex.files[SAGA_STORAGE_DOMAIN_INDEX_FILES.library].kind, 'library_index');
assert.equal(JSON.stringify(extensionSettings[MODULE_KEY]).includes('Nami maps Arlong Park'), false, 'Pack Health validation must not write payload content into settings.');
assert.equal(settingsSaveCount, 0, 'Pack Health external payload validation should not write settings for compact external rows.');
assert.equal(metadataSaveCount, 0, 'Pack Health external payload validation should not write chat metadata.');

clock = 3000;
const repairPayload = normalizeExternalLorepackPayload({
  packId: 'health-repair-external-pack',
  type: 'custom',
  title: 'Health Repair External Pack',
  description: 'External safe repair fixture.',
  healthStatus: 'has_errors',
  stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
  manifestData: {
    id: 'health-repair-external-pack',
    title: 'Health Repair External Pack',
    entrySchemaVersion: 3,
    files: [],
    stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
  },
  entryOverrides: {
    'repair-me': {
      id: 'repair-me',
      schemaVersion: 3,
      title: 'Repair Me',
      category: 'knowledge',
      tags: ['fact', 'other'],
      context: {
        scope: 'global',
        sortKeyFrom: 0,
        sortKeyTo: 0,
        precision: 'series',
        label: 'Global',
      },
      retrieval: {
        activation: 'topic_or_entity',
        frequency: 'low',
        contextBoost: 'low',
      },
      content: {
        fact: 'Generic tags should be dropped by deterministic safe repair.',
        injection: 'Generic tags should be dropped by deterministic safe repair.',
      },
    },
  },
});
const repairPayloadResult = upsertExternalLorepackPayloadSync(repairPayload, { now: 3000 });
assert.equal(repairPayloadResult.ok, true);
const repairLibraryResult = upsertExternalLoredeckLibraryRecordSync(repairPayloadResult.libraryRecord, { now: 3000 });
assert.equal(repairLibraryResult.ok, true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureSagaLorepackLibraryStorage({ fileApi, now });
configureSagaLorepackPayloadStorage({ fileApi, now });
clock = 4000;
await hydrateSagaLorepackLibraryStorage({ fileApi, now, force: true });

const repairToasts = [];
configureLoredeckEditorActions({
  getFreshLoredeckLibraryPack: getFreshPack,
  getExpectedLoredeckEntrySchemaVersion,
  validateLoredeckForEditor,
  upsertLoredeckLibraryPack,
  getLoredeckPendingChanges: pack => Array.isArray(pack?.pendingChanges) ? pack.pendingChanges : [],
  clearCanonLoreDatabaseCache: () => {},
  clearContextIndexCache: () => {},
  deleteLoredeckEntryPreviewCacheRecord: () => entryPreviewCache.delete('health-repair-external-pack'),
  refreshLoredeckSurfaces: () => {},
  toast: (message, type = 'info') => repairToasts.push({ message, type }),
});

const compactRepairPack = getFreshPack('health-repair-external-pack');
assert.deepEqual(compactRepairPack.entryOverrides, {}, 'Cold compact repair row should not contain payload entries before safe repair hydrates it.');
const repaired = await repairLoredeckSafeHealthIssues(compactRepairPack);
assert.equal(repaired, true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const repairedPayload = JSON.parse(stored.get(repairPayloadResult.libraryRecord.payloadFile));
const repairedEntry = repairedPayload.entryOverrides['repair-me'];
assert.equal(repairedEntry.content.fact, 'Generic tags should be dropped by deterministic safe repair.');
assert.equal(repairedEntry.content.injection, 'Generic tags should be dropped by deterministic safe repair.');
assert.equal(Object.hasOwn(repairedEntry, 'fact'), false);
assert.deepEqual(repairedEntry.tags, []);
assert.equal(repairedPayload.healthStatus, 'good');
assert.ok(repairToasts.some(toast => toast.type === 'success' && toast.message.includes('1 override repaired')));
const repairedLibraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(repairedLibraryIndex.packs['health-repair-external-pack'].entryOverrides, undefined, 'Safe repair must keep repaired Lorecards in the external payload, not the Library index.');
assert.equal(JSON.stringify(extensionSettings[MODULE_KEY]).includes('Generic tags should be dropped'), false, 'Safe repair must not write repaired payload content into settings.');

console.log('Saga Lorepack Pack Health external payload tests passed.');
