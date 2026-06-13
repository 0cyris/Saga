import assert from 'node:assert/strict';

const {
  configureSagaLorepackLibraryStorage,
  flushSagaLorepackLibraryStorageWrites,
  getExternalLoredeckLibraryRegistry,
  hydrateSagaLorepackLibraryStorage,
  importExternalLoredeckLibraryRegistrySync,
  mergeExternalLoredeckLibraryRegistry,
  normalizeSagaLibraryIndex,
  removeExternalLoredeckLibraryRecordSync,
  resetSagaLorepackLibraryStorageCache,
  updateExternalLoredeckLibraryLayoutSync,
  upsertExternalLoredeckLibraryRecord,
  upsertExternalLoredeckLibraryRecordSync,
  writeExternalLoredeckLibraryIndex,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  normalizeLoredeckRegistry,
  normalizeLoredeckStack,
} = await import('../../src/state/lore-state-normalizers.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'library-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;

    if (url === '/api/files/upload' && method === 'POST') {
      const path = `/user/files/${body.name}`;
      stored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
      return response(true, 200, JSON.stringify({ path }));
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

resetSagaLorepackLibraryStorageCache();
let clock = 1000;
const now = () => clock;
configureSagaLorepackLibraryStorage({ fileApi, now });

const normalized = normalizeSagaLibraryIndex({
  kind: 'wrong',
  packs: {
    'Arlong Pack': {
      id: 'Arlong Pack',
      title: 'Arlong Park',
      type: 'custom',
      payloadFile: '/user/files/saga-pack-arlong-pack.v1.json',
      entryCount: 56,
      tagCount: 7,
      manifestData: { shouldRemainForNow: true },
    },
  },
  folders: [{ id: 'fishmen', title: 'Fishmen' }],
  deckPlacements: [{ deckId: 'arlong-pack', folderId: 'fishmen' }],
  activeStack: [{ packId: 'arlong-pack', enabled: true }],
}, { now });
assert.equal(normalized.kind, 'saga_library_index');
assert.equal(normalized.packs['arlong-pack'].packId, 'arlong-pack');
assert.equal(normalized.packs['arlong-pack'].payloadFile, '/user/files/saga-pack-arlong-pack.v1.json');
assert.equal(normalized.packs['arlong-pack'].manifestData, undefined, 'Library index rows should not retain payload manifest data.');
assert.equal(normalized.packs['arlong-pack'].entryOverrides, undefined, 'Library index rows should not retain Lorecard payload containers.');
assert.equal(normalized.folders.length, 1);
assert.equal(normalized.deckPlacements.length, 1);

const contaminatedRegistry = normalizeLoredeckRegistry({
  schemaVersion: 1,
  packs: {
    'saga-doc-health-sample': {
      packId: 'saga-doc-health-sample',
      title: 'Documentation Health Sample',
      type: 'custom',
      source: { kind: 'documentation_fixture' },
    },
    'fixture-by-source-kind': {
      packId: 'fixture-by-source-kind',
      title: 'Renderer Fixture',
      type: 'custom',
      source: { kind: 'documentation_fixture' },
    },
  },
  deckPlacements: [{ deckId: 'saga-doc-health-sample', folderId: '' }],
  activeStack: [{ packId: 'saga-doc-health-sample', enabled: true }],
}, { schemaVersion: 1, packs: {} });
assert.equal(contaminatedRegistry.packs['saga-doc-health-sample'], undefined, 'Documentation renderer fixture Loredeck must not survive registry normalization.');
assert.equal(contaminatedRegistry.packs['fixture-by-source-kind'], undefined, 'Documentation fixture source records must not survive registry normalization.');
assert.equal(contaminatedRegistry.deckPlacements.length, 0, 'Documentation fixture placements must be removed with the rejected pack.');
assert.equal(contaminatedRegistry.activeStack.length, 0, 'Documentation fixture stack items must be removed with the rejected pack.');
assert.deepEqual(normalizeLoredeckStack([{ type: 'deck', packId: 'saga-doc-health-sample', enabled: true }]), [], 'Documentation fixture deck stack rows must be dropped from chat state.');

const contaminatedExternal = normalizeSagaLibraryIndex({
  packs: {
    'saga-doc-health-sample': {
      packId: 'saga-doc-health-sample',
      title: 'Documentation Health Sample',
      type: 'custom',
      source: { kind: 'documentation_fixture' },
    },
  },
  deckPlacements: [{ deckId: 'saga-doc-health-sample', folderId: '' }],
  activeStack: [{ packId: 'saga-doc-health-sample', enabled: true }],
}, { now });
assert.equal(contaminatedExternal.packs['saga-doc-health-sample'], undefined, 'External Library index must reject Documentation Health Sample.');
assert.equal(contaminatedExternal.deckPlacements.length, 0, 'External Library fixture placements must be removed.');
assert.equal(contaminatedExternal.activeStack.length, 0, 'External Library fixture stack rows must be removed.');

const writeResult = await writeExternalLoredeckLibraryIndex(normalized, { fileApi, now });
assert.equal(writeResult.ok, true);
assert.equal(stored.has(SAGA_STORAGE_DOMAIN_INDEX_FILES.library), true);
const storedIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(storedIndex.folders[0].id, 'fishmen');
assert.equal(storedIndex.deckPlacements[0].folderId, 'fishmen');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[SAGA_STORAGE_DOMAIN_INDEX_FILES.library].kind, 'library_index');

clock = 2000;
const upsertResult = await upsertExternalLoredeckLibraryRecord({
  packId: 'baratie-pack',
  title: 'Baratie',
  type: 'custom',
  payloadFile: '/user/files/saga-pack-baratie-pack.v1.json',
  entryCount: 12,
}, { fileApi, now });
assert.equal(upsertResult.ok, true);
assert.equal(getExternalLoredeckLibraryRegistry().packs['baratie-pack'].title, 'Baratie');

resetSagaLorepackLibraryStorageCache();
await hydrateSagaLorepackLibraryStorage({ fileApi, now, force: true });
assert.equal(getExternalLoredeckLibraryRegistry().packs['arlong-pack'].title, 'Arlong Park');
assert.equal(getExternalLoredeckLibraryRegistry().packs['baratie-pack'].entryCount, 12);

const merged = mergeExternalLoredeckLibraryRegistry({
  schemaVersion: 1,
  packs: {
    bundled: { packId: 'bundled', title: 'Bundled', type: 'bundled' },
  },
  activeStack: [],
}, {
  schemaVersion: 1,
  packs: {
    chat: { packId: 'chat', title: 'Chat Pack', type: 'custom' },
  },
});
assert.equal(merged.packs.bundled.title, 'Bundled');
assert.equal(merged.packs.chat.title, 'Chat Pack');
assert.equal(merged.packs['arlong-pack'].title, 'Arlong Park');
assert(merged.folders.some(folder => folder.id === 'fishmen'), 'External library folders should merge into the runtime registry.');

clock = 3000;
const syncUpsert = upsertExternalLoredeckLibraryRecordSync({
  packId: 'cocoyasi-pack',
  title: 'Cocoyasi Village',
  type: 'generated',
  payloadFile: '/user/files/saga-pack-cocoyasi-pack.v1.json',
  entryCount: 7,
});
assert.equal(syncUpsert.ok, true);
assert.equal(getExternalLoredeckLibraryRegistry().packs['cocoyasi-pack'].title, 'Cocoyasi Village');

const syncLayout = updateExternalLoredeckLibraryLayoutSync({
  folders: [{ id: 'east-blue', title: 'East Blue' }],
  deckPlacements: [{ deckId: 'cocoyasi-pack', folderId: 'east-blue', sortOrder: 100 }],
});
assert.equal(syncLayout.ok, true);
assert.equal(getExternalLoredeckLibraryRegistry().folders[0].id, 'east-blue');

const syncImport = importExternalLoredeckLibraryRegistrySync({
  schemaVersion: 1,
  packs: {
    'arlong-park-final': {
      packId: 'arlong-park-final',
      title: 'Arlong Park Final',
      type: 'custom',
      payloadFile: '/user/files/saga-pack-arlong-park-final.v1.json',
    },
  },
  folders: [{ id: 'imported-folder', title: 'Imported Folder' }],
  deckPlacements: [{ deckId: 'arlong-park-final', folderId: 'imported-folder', sortOrder: 200 }],
});
assert.equal(syncImport.ok, true);
assert.equal(syncImport.importedCount, 1);
assert.equal(getExternalLoredeckLibraryRegistry().packs['arlong-park-final'].title, 'Arlong Park Final');

const syncRemove = removeExternalLoredeckLibraryRecordSync('cocoyasi-pack');
assert.equal(syncRemove.ok, true);
assert.equal(getExternalLoredeckLibraryRegistry().packs['cocoyasi-pack'], undefined);
assert.ok(!(getExternalLoredeckLibraryRegistry().deckPlacements || []).some(item => item.deckId === 'cocoyasi-pack'));

const flushResult = await flushSagaLorepackLibraryStorageWrites();
assert.equal(flushResult.ok, true);
const flushedIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(flushedIndex.packs['arlong-park-final'].title, 'Arlong Park Final');
assert.equal(flushedIndex.packs['cocoyasi-pack'], undefined);
assert.ok(flushedIndex.folders.some(folder => folder.id === 'imported-folder'));

console.log('Saga Lorepack Library external index tests passed.');
