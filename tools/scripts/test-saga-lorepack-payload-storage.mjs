import assert from 'node:assert/strict';

const {
  configureSagaLorepackPayloadStorage,
  createExternalLorepackLibraryRecord,
  flushSagaLorepackPayloadStorageWrites,
  getCachedExternalLorepackPayload,
  hydrateExternalLorepackPayloadRecord,
  normalizeExternalLorepackPayload,
  removeExternalLorepackPayloadSync,
  resetSagaLorepackPayloadStorageCache,
  upsertExternalLorepackPayloadSync,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
  SAGA_STORAGE_INDEX_PATH,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');
const {
  loadLoredeckSourceById,
} = await import('../../src/loredecks/loredeck-loader.js');

const stored = new Map();
const deleted = [];

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'payload-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;

    if (url === '/api/files/upload' && method === 'POST') {
      const path = `/user/files/${body.name}`;
      stored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
      return response(true, 200, JSON.stringify({ path }));
    }

    if (url === '/api/files/delete' && method === 'POST') {
      deleted.push(body.path);
      stored.delete(body.path);
      return response(true, 200, JSON.stringify({ ok: true }));
    }

    if (method === 'GET') {
      if (!stored.has(url)) return response(false, 404, 'missing');
      return response(true, 200, stored.get(url));
    }

    if (url === '/api/files/verify' && method === 'POST') {
      return response(true, 200, JSON.stringify(Object.fromEntries((body.urls || []).map(path => [path, stored.has(path)]))));
    }

    return response(false, 404, 'unexpected request');
  },
});

resetSagaLorepackPayloadStorageCache();
let clock = 1000;
const now = () => clock;
configureSagaLorepackPayloadStorage({ fileApi, now });

const payload = normalizeExternalLorepackPayload({
  packId: 'Arlong Payload',
  type: 'custom',
  title: 'Arlong Park',
  description: 'External payload fixture.',
  source: { kind: 'imported_zip', originalPackId: 'arlong' },
  stats: { entryCount: 2, categoryCounts: { character: 2 } },
  manifestData: {
    id: 'arlong-payload',
    title: 'Arlong Park',
    entrySchemaVersion: 3,
    stats: { entryCount: 2 },
    assets: {
      cover: {
        path: 'data:image/png;base64,iVBORw0KGgo=',
        alt: 'Arlong Park cover',
      },
    },
  },
  assets: {
    cover: {
      path: 'data:image/png;base64,iVBORw0KGgo=',
      alt: 'Arlong Park cover',
    },
  },
  entryOverrides: {
    nami: { id: 'nami', title: 'Nami', schemaVersion: 3, content: { fact: 'Nami bargains with Arlong.' } },
    arlong: { id: 'arlong', title: 'Arlong', schemaVersion: 3, content: { fact: 'Arlong rules the park.' } },
  },
  tagRegistry: { schemaVersion: 1, tags: { nami: { id: 'nami', label: 'Nami' } } },
  timelineRegistry: { schemaVersion: 1, anchors: [{ id: 'arlong-park', title: 'Arlong Park' }], windows: [] },
});
assert.equal(payload.kind, 'saga_lorepack_payload');
assert.equal(payload.packId, 'arlong-payload');
assert.equal(payload.payloadFile, '/user/files/saga-pack-arlong-payload.v1.json');
assert.equal(Object.keys(payload.entryOverrides).length, 2);

const libraryRecord = createExternalLorepackLibraryRecord(payload);
assert.equal(libraryRecord.payloadFile, '/user/files/saga-pack-arlong-payload.v1.json');
assert.equal(libraryRecord.entryCount, 2);
assert.equal(libraryRecord.tagCount, 1);
assert.equal(libraryRecord.timelineEventCount, 1);
assert.equal(libraryRecord.entryOverrides, undefined, 'Library rows must not retain Lorecard payloads.');
assert.equal(libraryRecord.manifestData, undefined, 'Library rows must not retain embedded manifests.');

const upsert = upsertExternalLorepackPayloadSync(payload);
assert.equal(upsert.ok, true);
assert.equal(getCachedExternalLorepackPayload('arlong-payload').entryOverrides.nami.title, 'Nami');
assert.match(getCachedExternalLorepackPayload('arlong-payload').assets.cover.path, /^\/user\/files\/saga-pack-asset-arlong-payload-cover-[a-f0-9]+\.png$/);
assert.equal(upsert.libraryRecord.coverFile, getCachedExternalLorepackPayload('arlong-payload').assets.cover.path);

const flushed = await flushSagaLorepackPayloadStorageWrites();
assert.equal(flushed.ok, true);
const storedPayload = JSON.parse(stored.get('/user/files/saga-pack-arlong-payload.v1.json'));
assert.equal(storedPayload.entryOverrides.arlong.title, 'Arlong');
assert.match(storedPayload.assets.cover.path, /^\/user\/files\/saga-pack-asset-arlong-payload-cover-[a-f0-9]+\.png$/);
assert.equal(stored.has(storedPayload.assets.cover.path), true, 'Data URL cover asset should be uploaded as a passive file.');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[storedPayload.assets.cover.path].kind, 'lorepack_asset');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-arlong-payload.v1.json'].kind, 'lorepack_payload');

resetSagaLorepackPayloadStorageCache();
configureSagaLorepackPayloadStorage({ fileApi, now });
const hydrated = await hydrateExternalLorepackPayloadRecord(libraryRecord);
assert.equal(hydrated.entryOverrides.nami.content.fact, 'Nami bargains with Arlong.');
assert.equal(hydrated.manifestData.title, 'Arlong Park');

resetSagaLorepackPayloadStorageCache();
configureSagaLorepackPayloadStorage({ fileApi, now });
const loadedSource = await loadLoredeckSourceById('arlong-payload', {
  registry: {
    schemaVersion: 1,
    packs: {
      'arlong-payload': libraryRecord,
    },
  },
});
assert.equal(loadedSource.sourceKind, 'custom_virtual');
assert.equal(loadedSource.entryFiles[0].entries.length, 2);
assert.equal(loadedSource.health.summary.entryCount, 2);

clock = 2000;
const removed = removeExternalLorepackPayloadSync('arlong-payload', { payloadFile: libraryRecord.payloadFile });
assert.equal(removed.ok, true);
const deleteFlush = await flushSagaLorepackPayloadStorageWrites();
assert.equal(deleteFlush.ok, true);
assert.ok(deleted.includes('/user/files/saga-pack-arlong-payload.v1.json'));
assert.ok(deleted.includes(storedPayload.assets.cover.path));
assert.equal(stored.has('/user/files/saga-pack-arlong-payload.v1.json'), false);
assert.equal(stored.has(storedPayload.assets.cover.path), false);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-arlong-payload.v1.json'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[storedPayload.assets.cover.path], undefined);

console.log('Saga Lorepack payload external storage tests passed.');
