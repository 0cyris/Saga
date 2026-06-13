import assert from 'node:assert/strict';

const stored = new Map();
let settingsSaveCount = 0;
let metadataSaveCount = 0;
const extensionSettings = {
  saga: {
    sagaStorage: {},
    loredeckLibrary: { schemaVersion: 1, packs: {} },
    loredeckCreatorProjects: { schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: {} },
    themePackLibrary: { schemaVersion: 1, packs: {} },
    themeIconSetLibrary: { schemaVersion: 1, iconSets: {} },
  },
};
const chatMetadata = {
  saga: {
    _version: 1,
    stateSafety: { schemaVersion: 1, backups: [], migrationLog: [] },
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

function response(ok, status, body = '') {
  return {
    ok,
    status,
    async text() {
      return body;
    },
  };
}

const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');
const {
  createSagaStorageIndexStore,
  SAGA_STORAGE_INDEX_PATH,
} = await import('../../src/storage/saga-storage-index.js');
const {
  verifySagaStorageDiagnostics,
} = await import('../../src/storage/saga-storage-diagnostics.js');
const {
  hydrateSagaThemeIconStorage,
} = await import('../../src/storage/saga-theme-icon-storage.js');
const {
  cleanMissingSagaStorageIndexRecords,
  getSagaStorageDiagnostics,
  verifySagaStorageIntegrity,
} = await import('../../src/state/state-manager.js');

const fileApi = createSagaFileApi({
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'diagnostics-test' }),
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

    if (url === '/api/files/delete' && method === 'POST') {
      stored.delete(body.path);
      return response(true, 200, JSON.stringify({ ok: true }));
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

const missingIndex = await verifySagaStorageDiagnostics(extensionSettings.saga, { fileApi, now });
assert.equal(missingIndex.ok, false);
assert.equal(missingIndex.status, 'missing_index');
assert.equal(missingIndex.code, 'storage_index_missing');

const store = createSagaStorageIndexStore({ fileApi, now });
await fileApi.writeJsonFile('saga-pack-diagnostics.v1.json', { kind: 'diagnostics_fixture' });
await store.registerFile('/user/files/saga-pack-diagnostics.v1.json', {
  kind: 'lorepack_payload',
  domain: 'library',
  ownerId: 'diagnostics-pack',
  deletion: 'delete_with_owner',
});

clock = 2000;
const healthy = await verifySagaStorageDiagnostics(extensionSettings.saga, { fileApi, now, write: true });
assert.equal(healthy.ok, true);
assert.equal(healthy.status, 'ok');
assert.equal(healthy.fileCount >= 2, true);
assert.equal(healthy.missingFileCount, 0);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).lastIntegrityCheck.status, 'ok');

stored.delete('/user/files/saga-pack-diagnostics.v1.json');
clock = 3000;
const missingPayload = await verifySagaStorageDiagnostics(extensionSettings.saga, { fileApi, now, write: true });
assert.equal(missingPayload.ok, false);
assert.equal(missingPayload.status, 'missing_files');
assert.deepEqual(missingPayload.missingFiles, ['/user/files/saga-pack-diagnostics.v1.json']);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).lastIntegrityCheck.status, 'missing_files');

clock = 4000;
const runtimeMissing = await verifySagaStorageIntegrity({ fileApi, now });
assert.equal(runtimeMissing.ok, false);
assert.equal(runtimeMissing.status, 'missing_files');
assert.equal(extensionSettings.saga.sagaStorage.lastVerifiedAt, runtimeMissing.checkedAt);
assert.equal(settingsSaveCount > 0, true);
assert.equal(metadataSaveCount > 0, true);
assert.equal(chatMetadata.saga.stateSafety.migrationLog[0].type, 'storage_integrity_warning');
assert.match(chatMetadata.saga.stateSafety.migrationLog[0].message, /missing file/);

clock = 4500;
const cleanup = await cleanMissingSagaStorageIndexRecords({ fileApi, now });
assert.equal(cleanup.ok, true);
assert.equal(cleanup.status, 'ok');
assert.deepEqual(cleanup.cleanedFiles, ['/user/files/saga-pack-diagnostics.v1.json']);
assert.equal(cleanup.cleanedFileCount, 1);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-diagnostics.v1.json'], undefined);
assert.equal(chatMetadata.saga.stateSafety.migrationLog[0].type, 'storage_cleanup');
assert.match(chatMetadata.saga.stateSafety.migrationLog[0].message, /cleaned 1 missing indexed file record/i);

await fileApi.writeJsonFile('saga-pack-diagnostics.v1.json', { kind: 'diagnostics_fixture_restored' });
clock = 5000;
const runtimeHealthy = await verifySagaStorageIntegrity({ fileApi, now });
assert.equal(runtimeHealthy.ok, true);
assert.equal(runtimeHealthy.status, 'ok');
assert.equal(chatMetadata.saga.stateSafety.migrationLog[0].type, 'storage_integrity_check');
assert.match(chatMetadata.saga.stateSafety.migrationLog[0].message, /verified/);

const syncDiagnostics = getSagaStorageDiagnostics({ now });
assert.equal(syncDiagnostics.checkedAt, runtimeHealthy.checkedAt);
assert.equal(syncDiagnostics.pendingWrites, 0);

const failingHydrationFileApi = createSagaFileApi({
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'diagnostics-test' }),
  fetchImpl: async () => response(false, 500, 'theme index read failed'),
});
await assert.rejects(
  () => hydrateSagaThemeIconStorage({ fileApi: failingHydrationFileApi, force: true, now }),
  /theme index read failed|Could not read/i,
);

const runtimeErrorDiagnostics = getSagaStorageDiagnostics({ now });
assert.equal(runtimeErrorDiagnostics.ok, false);
assert.equal(runtimeErrorDiagnostics.status, 'storage_errors');
assert.equal(runtimeErrorDiagnostics.storageErrors.length, 1);
assert.equal(runtimeErrorDiagnostics.writeErrors.length, 1);

clock = 6000;
const runtimeErrorVerification = await verifySagaStorageIntegrity({ fileApi, now });
assert.equal(runtimeErrorVerification.ok, false);
assert.equal(runtimeErrorVerification.status, 'storage_errors');
assert.match(chatMetadata.saga.stateSafety.migrationLog[0].message, /runtime storage error/);

console.log('Saga storage diagnostics tests passed.');
