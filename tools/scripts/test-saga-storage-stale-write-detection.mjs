import assert from 'node:assert/strict';

const {
  configureSagaLorepackLibraryStorage,
  flushSagaLorepackLibraryStorageWrites,
  hydrateSagaLorepackLibraryStorage,
  resetSagaLorepackLibraryStorageCache,
  updateExternalLoredeckLibraryLayoutSync,
  writeExternalLoredeckLibraryIndex,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  configureSagaLorepackPayloadStorage,
  flushSagaLorepackPayloadStorageWrites,
  hydrateExternalLorepackPayloadRecord,
  normalizeExternalLorepackPayload,
  resetSagaLorepackPayloadStorageCache,
  upsertExternalLorepackPayloadSync,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
  configureSagaCreatorProjectStorage,
  flushSagaCreatorProjectStorageWrites,
  getExternalLoredeckCreatorIndex,
  hydrateExternalLoredeckCreatorProjectRecord,
  hydrateSagaCreatorProjectStorage,
  resetSagaCreatorProjectStorageCache,
  upsertExternalLoredeckCreatorProjectSync,
} = await import('../../src/storage/saga-creator-project-storage.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');

function response(ok, status, body = '') {
  return {
    ok,
    status,
    async text() {
      return body;
    },
  };
}

function createMemoryFileApi(label = 'stale-write-test') {
  const stored = new Map();
  const fileApi = createSagaFileApi({
    getRequestHeaders: () => ({ 'X-CSRF-Token': label }),
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
  return { fileApi, stored };
}

function readStoredJson(stored, path) {
  return JSON.parse(stored.get(path));
}

function writeStoredJson(stored, path, value) {
  stored.set(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function testLibraryIndexStaleWrite() {
  const { fileApi, stored } = createMemoryFileApi('library-stale-test');
  let clock = 1000;
  const now = () => clock;
  const onWriteError = () => {};
  resetSagaLorepackLibraryStorageCache();
  configureSagaLorepackLibraryStorage({ fileApi, now, onWriteError });

  await writeExternalLoredeckLibraryIndex({
    schemaVersion: 1,
    kind: 'saga_library_index',
    revision: 1,
    packs: {},
    folders: [{ id: 'initial', title: 'Initial' }],
    deckPlacements: [],
    activeStack: [],
  }, { fileApi, now });

  resetSagaLorepackLibraryStorageCache();
  configureSagaLorepackLibraryStorage({ fileApi, now, onWriteError });
  await hydrateSagaLorepackLibraryStorage({ fileApi, now, force: true });

  const latest = readStoredJson(stored, SAGA_STORAGE_DOMAIN_INDEX_FILES.library);
  writeStoredJson(stored, SAGA_STORAGE_DOMAIN_INDEX_FILES.library, {
    ...latest,
    revision: latest.revision + 1,
    folders: [{ id: 'newer-tab', title: 'Newer Tab Folder' }],
  });

  clock = 2000;
  const stale = updateExternalLoredeckLibraryLayoutSync({
    folders: [{ id: 'stale-tab', title: 'Stale Tab Folder' }],
  }, { fileApi, now });
  assert.equal(stale.ok, true, 'Local stale layout mutation should update the in-memory view before persistence reports the conflict.');
  const flush = await flushSagaLorepackLibraryStorageWrites();
  assert.equal(flush.ok, false);
  assert.match(flush.error, /Library storage changed/);
  assert.equal(readStoredJson(stored, SAGA_STORAGE_DOMAIN_INDEX_FILES.library).folders[0].id, 'newer-tab');
}

async function testLorepackPayloadStaleWrite() {
  const { fileApi, stored } = createMemoryFileApi('payload-stale-test');
  let clock = 1000;
  const now = () => clock;
  const onWriteError = () => {};
  resetSagaLorepackPayloadStorageCache();
  configureSagaLorepackPayloadStorage({ fileApi, now, onWriteError });

  const payload = normalizeExternalLorepackPayload({
    packId: 'stale-payload-pack',
    type: 'custom',
    title: 'Original Payload',
    entryOverrides: {
      entry_one: { id: 'entry_one', title: 'Entry One', content: { fact: 'Original.' } },
    },
  }, { now });
  const upsert = upsertExternalLorepackPayloadSync(payload, { fileApi, now });
  assert.equal(upsert.ok, true);
  assert.equal((await flushSagaLorepackPayloadStorageWrites()).ok, true);

  resetSagaLorepackPayloadStorageCache();
  configureSagaLorepackPayloadStorage({ fileApi, now, onWriteError });
  const hydrated = await hydrateExternalLorepackPayloadRecord(upsert.libraryRecord, { fileApi, now });

  const payloadPath = '/user/files/saga-pack-stale-payload-pack.v1.json';
  const latest = readStoredJson(stored, payloadPath);
  writeStoredJson(stored, payloadPath, {
    ...latest,
    revision: latest.revision + 1,
    title: 'Newer Payload',
  });

  clock = 2000;
  const stale = upsertExternalLorepackPayloadSync({
    ...hydrated,
    title: 'Stale Payload',
  }, { fileApi, now });
  assert.equal(stale.ok, true);
  const flush = await flushSagaLorepackPayloadStorageWrites();
  assert.equal(flush.ok, false);
  assert.match(flush.error, /Loredeck storage changed/);
  assert.equal(readStoredJson(stored, payloadPath).title, 'Newer Payload');
}

async function testCreatorProjectStaleWrite() {
  const { fileApi, stored } = createMemoryFileApi('creator-stale-test');
  let clock = 1000;
  const now = () => clock;
  const onWriteError = () => {};
  resetSagaCreatorProjectStorageCache();
  configureSagaCreatorProjectStorage({ fileApi, now, onWriteError });

  const upserted = upsertExternalLoredeckCreatorProjectSync({
    jobId: 'creator_stale_project',
    projectTitle: 'Original Creator Project',
    fandom: 'One Piece',
    scope: 'Arlong Park',
    currentStage: 'titles',
    titleDrafts: [{ titleId: 'arlong', title: 'Arlong' }],
    createdAt: 100,
    updatedAt: 100,
  }, { fileApi, now, activeJobId: 'creator_stale_project', lastJobId: 'creator_stale_project' });
  assert.equal(upserted.ok, true);
  assert.equal((await flushSagaCreatorProjectStorageWrites()).ok, true);

  resetSagaCreatorProjectStorageCache();
  configureSagaCreatorProjectStorage({ fileApi, now, onWriteError });
  await hydrateSagaCreatorProjectStorage({ fileApi, now, force: true });
  const compact = getExternalLoredeckCreatorIndex().projects.creator_stale_project;
  const hydrated = await hydrateExternalLoredeckCreatorProjectRecord(compact, { fileApi, now });

  const projectPath = '/user/files/saga-creator-project-creator_stale_project.v1.json';
  const latestPayload = readStoredJson(stored, projectPath);
  writeStoredJson(stored, projectPath, {
    ...latestPayload,
    revision: latestPayload.revision + 1,
    projectTitle: 'Newer Creator Project',
  });

  clock = 2000;
  const stale = upsertExternalLoredeckCreatorProjectSync({
    ...hydrated,
    projectTitle: 'Stale Creator Project',
    updatedAt: 200,
  }, { fileApi, now, activeJobId: 'creator_stale_project', lastJobId: 'creator_stale_project' });
  assert.equal(stale.ok, true);
  const flush = await flushSagaCreatorProjectStorageWrites();
  assert.equal(flush.ok, false);
  assert.match(flush.error, /Creator project storage changed/);
  assert.equal(readStoredJson(stored, projectPath).projectTitle, 'Newer Creator Project');
}

await testLibraryIndexStaleWrite();
await testLorepackPayloadStaleWrite();
await testCreatorProjectStaleWrite();

console.log('Saga storage stale-write detection tests passed.');
