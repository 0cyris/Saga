import assert from 'node:assert/strict';

const {
  createDefaultSagaStorageFallback,
  createDefaultSagaStorageSettings,
  createSagaStorageIndex,
  createSagaStorageIndexFromSettings,
  createSagaStorageIndexStore,
  getSagaStorageBootstrapFromIndex,
  getSagaStorageDeleteCandidatesForOwner,
  getSagaStorageFallbackFromIndex,
  normalizeSagaStorageFallback,
  normalizeSagaStorageIndex,
  normalizeSagaStorageSettings,
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_FILE_NAME,
  SAGA_STORAGE_INDEX_PATH,
  SAGA_STORAGE_VERSION,
  setSagaStorageDomainIndexFile,
  unregisterSagaStorageFile,
  upsertSagaStorageFile,
} = await import('../../src/storage/saga-storage-index.js');

assert.equal(SAGA_STORAGE_INDEX_FILE_NAME, 'saga-storage-index.v1.json');
assert.equal(SAGA_STORAGE_INDEX_PATH, '/user/files/saga-storage-index.v1.json');
assert.deepEqual(SAGA_STORAGE_DOMAIN_INDEX_FILES, {
  library: '/user/files/saga-library-index.v1.json',
  creator: '/user/files/saga-creator-index.v1.json',
  storyOpeners: '/user/files/saga-story-opener-index.v1.json',
  themes: '/user/files/saga-theme-index.v1.json',
  iconSets: '/user/files/saga-iconset-index.v1.json',
});

const index = createSagaStorageIndex({ now: 1000 });
assert.equal(index.schemaVersion, 1);
assert.equal(index.kind, 'saga_storage_index');
assert.equal(index.revision, 1);
assert.equal(index.domains.library.indexFile, SAGA_STORAGE_DOMAIN_INDEX_FILES.library);
assert.equal(index.files[SAGA_STORAGE_INDEX_PATH].kind, 'storage_index');

const normalized = normalizeSagaStorageIndex({
  schemaVersion: 99,
  kind: 'wrong_kind',
  createdAt: 'bad',
  updatedAt: 2000,
  revision: -3,
  domains: {
    library: { indexFile: '/img/not-saga.json', updatedAt: 'bad' },
  },
  files: {
    '/img/not-owned.json': { kind: 'bad' },
    '/user/files/saga-pack-demo.v1.json': {
      kind: 'lorepack_payload',
      domain: 'library',
      ownerId: 'Demo Pack',
      mime: '',
      sha256: 'sha256:cafe',
      bytes: 12,
      createdAt: 1500,
      updatedAt: 1750,
      deletion: 'delete_with_owner',
    },
  },
  lastIntegrityCheck: {
    checkedAt: 3000,
    missingFiles: ['/img/not-owned.json', '/user/files/saga-pack-demo.v1.json'],
    orphanedFiles: ['/user/files/saga-pack-demo.v1.json'],
    status: 'unknown',
  },
}, { now: 2000 });
assert.equal(normalized.schemaVersion, 1);
assert.equal(normalized.kind, 'saga_storage_index');
assert.equal(normalized.revision, 1);
assert.equal(normalized.domains.library.indexFile, SAGA_STORAGE_DOMAIN_INDEX_FILES.library);
assert.equal(normalized.files['/img/not-owned.json'], undefined);
assert.equal(normalized.files['/user/files/saga-pack-demo.v1.json'].ownerId, 'demo-pack');
assert.equal(normalized.files['/user/files/saga-pack-demo.v1.json'].mime, 'application/json');
assert.equal(normalized.lastIntegrityCheck.missingFiles.length, 1);
assert.equal(normalized.files[SAGA_STORAGE_INDEX_PATH].kind, 'storage_index');

const payloadPath = '/user/files/saga-pack-arlong-park.v1.json';
const withPayload = upsertSagaStorageFile(index, payloadPath, {
  kind: 'lorepack_payload',
  domain: 'library',
  ownerId: 'Arlong Park',
  bytes: 4096,
  deletion: 'delete_with_owner',
}, { now: 2000 });
assert.equal(withPayload.revision, 2);
assert.equal(withPayload.files[payloadPath].ownerId, 'arlong-park');
assert.equal(withPayload.files[payloadPath].deletion, 'delete_with_owner');
assert.equal(getSagaStorageDeleteCandidatesForOwner(withPayload, 'arlong park').length, 1);

const withThemeDomain = setSagaStorageDomainIndexFile(
  withPayload,
  'themes',
  '/user/files/saga-theme-index.v1.json',
  { now: 2500 },
);
assert.equal(withThemeDomain.domains.themes.updatedAt, 2500);
assert.equal(withThemeDomain.revision, 3);

const withoutPayload = unregisterSagaStorageFile(withThemeDomain, payloadPath, { now: 3000 });
assert.equal(withoutPayload.files[payloadPath], undefined);
assert.equal(withoutPayload.revision, 4);

assert.deepEqual(createDefaultSagaStorageSettings(), {
  schemaVersion: 1,
  enabled: true,
  masterIndexFile: SAGA_STORAGE_INDEX_PATH,
  libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
  creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
  storyOpenerIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners,
  themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
  iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
  lastVerifiedAt: 0,
  storageVersion: SAGA_STORAGE_VERSION,
});
assert.equal(normalizeSagaStorageSettings({ enabled: false, masterIndexFile: '/img/nope.json' }).enabled, false);
assert.equal(normalizeSagaStorageSettings({ masterIndexFile: '/img/nope.json' }).masterIndexFile, SAGA_STORAGE_INDEX_PATH);
assert.deepEqual(createDefaultSagaStorageFallback(), {
  libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
  creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
  storyOpenerIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners,
  themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
  iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
  updatedAt: 0,
});
assert.equal(normalizeSagaStorageFallback({ iconSetIndexFile: '/img/nope.json', updatedAt: 42 }).iconSetIndexFile, SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets);

const recovered = createSagaStorageIndexFromSettings({
  sagaStorage: { libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library },
  sagaStorageFallback: { creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator },
}, { now: 4000 });
assert.equal(recovered.domains.creator.indexFile, SAGA_STORAGE_DOMAIN_INDEX_FILES.creator);
assert.equal(getSagaStorageBootstrapFromIndex(recovered).masterIndexFile, SAGA_STORAGE_INDEX_PATH);
assert.equal(getSagaStorageFallbackFromIndex(recovered).updatedAt, 4000);

let savedIndex = null;
let savedFileName = '';
const fileApi = {
  async readJsonFile(path) {
    assert.equal(path, SAGA_STORAGE_INDEX_PATH);
    if (!savedIndex) {
      const error = new Error('missing');
      error.status = 404;
      throw error;
    }
    return savedIndex;
  },
  async writeJsonFile(fileName, value) {
    savedFileName = fileName;
    savedIndex = value;
    return { path: SAGA_STORAGE_INDEX_PATH, fileName };
  },
  async verifyFiles(paths) {
    return Object.fromEntries(paths.map(path => [path, path !== payloadPath]));
  },
};

let clock = 5000;
const store = createSagaStorageIndexStore({ fileApi, now: () => clock });
const registered = await store.registerFile(payloadPath, {
  kind: 'lorepack_payload',
  domain: 'library',
  ownerId: 'Arlong Park',
  deletion: 'delete_with_owner',
});
assert.equal(savedFileName, SAGA_STORAGE_INDEX_FILE_NAME);
assert.equal(registered.index.files[payloadPath].ownerId, 'arlong-park');
clock = 6000;
const verified = await store.verifyIndexFiles(registered.index, { write: true });
assert.equal(verified.status, 'missing_files');
assert.deepEqual(verified.missingFiles, [payloadPath]);
assert.equal(savedIndex.lastIntegrityCheck.checkedAt, 6000);

savedIndex = null;
clock = 7000;
const raceStoreA = createSagaStorageIndexStore({ fileApi, now: () => clock });
const raceStoreB = createSagaStorageIndexStore({ fileApi, now: () => clock });
const racePayloadPath = '/user/files/saga-pack-race-a.v1.json';
const raceLibraryPath = SAGA_STORAGE_DOMAIN_INDEX_FILES.library;
await Promise.all([
  raceStoreA.registerFile(racePayloadPath, {
    kind: 'lorepack_payload',
    domain: 'library',
    ownerId: 'race-a',
    deletion: 'delete_with_owner',
  }),
  raceStoreB.registerFile(raceLibraryPath, {
    kind: 'lorepack_library_index',
    domain: 'library',
    ownerId: 'library',
    deletion: 'managed',
  }),
]);
assert.equal(savedIndex.files[racePayloadPath].kind, 'lorepack_payload');
assert.equal(savedIndex.files[raceLibraryPath].kind, 'lorepack_library_index');

const { DEFAULT_SETTINGS } = await import('../../src/state/default-settings.js');
assert.equal(DEFAULT_SETTINGS.sagaStorage.masterIndexFile, SAGA_STORAGE_INDEX_PATH);
assert.equal(DEFAULT_SETTINGS.sagaStorageFallback.libraryIndexFile, SAGA_STORAGE_DOMAIN_INDEX_FILES.library);

let saveCount = 0;
const ctx = {
  extensionSettings: {
    saga: {
      sagaStorage: { masterIndexFile: '/img/nope.json', libraryIndexFile: payloadPath },
      sagaStorageFallback: { updatedAt: 42 },
    },
  },
  saveSettingsDebounced() {
    saveCount += 1;
  },
};
globalThis.SillyTavern = { getContext: () => ctx };
const { getSettings, saveSettings } = await import('../../src/state/settings-store.js');
const settings = getSettings();
assert.equal(settings.sagaStorage.masterIndexFile, SAGA_STORAGE_INDEX_PATH);
assert.equal(settings.sagaStorage.libraryIndexFile, payloadPath);
assert.equal(settings.sagaStorageFallback.updatedAt, 42);
settings.sagaStorage.libraryIndexFile = '/img/not-valid.json';
saveSettings(settings);
assert.equal(saveCount, 1);
assert.equal(ctx.extensionSettings.saga.sagaStorage.libraryIndexFile, SAGA_STORAGE_DOMAIN_INDEX_FILES.library);

console.log('Saga storage index tests passed.');
