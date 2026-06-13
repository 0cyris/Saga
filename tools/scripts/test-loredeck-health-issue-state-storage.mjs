import assert from 'node:assert/strict';

const {
  persistLoredeckHealthIssueState,
} = await import('../../src/loredecks/loredeck-health-issue-state-storage.js');
const {
  configureSagaLorepackLibraryStorage,
  flushSagaLorepackLibraryStorageWrites,
  getExternalLoredeckLibraryRegistry,
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-issue-state-storage-test' }),
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

configureStorage();
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
configureStorage();

const payload = normalizeExternalLorepackPayload({
  packId: 'issue-state-external-pack',
  type: 'custom',
  title: 'Issue State External Pack',
  entrySchemaVersion: 3,
  manifestData: {
    id: 'issue-state-external-pack',
    title: 'Issue State External Pack',
    type: 'custom',
    entrySchemaVersion: 3,
    files: [],
    stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
  },
  entryOverrides: {
    'entry-1': {
      id: 'entry-1',
      schemaVersion: 3,
      title: 'Entry One',
      category: 'knowledge',
      tags: ['fact'],
      context: { scope: 'global', precision: 'series', label: 'Global' },
      retrieval: { activation: 'topic_or_entity', frequency: 'normal', contextBoost: 'normal' },
      content: {
        fact: 'Fact content.',
        injection: 'Injection content.',
      },
    },
  },
});

const payloadResult = upsertExternalLorepackPayloadSync(payload, storageOptions);
assert.equal(payloadResult.ok, true);
const libraryResult = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, storageOptions);
assert.equal(libraryResult.ok, true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureStorage();
clock = 2000;
await hydrateSagaLorepackLibraryStorage({ ...storageOptions, force: true });

const compactPack = getExternalLoredeckLibraryRegistry().packs['issue-state-external-pack'];
assert.ok(compactPack.payloadFile, 'Fixture should reload as a compact external payload row.');
assert.equal(compactPack.entryOverrides, undefined);

const stateRecord = {
  issueKey: 'health_issue_fixture',
  status: 'ignored',
  code: 'schema_v3_missing_content',
  severity: 'error',
  title: 'Missing schema v3 content',
  note: 'Accepted as-is by user.',
  updatedAt: 2000,
};
const saveResult = await persistLoredeckHealthIssueState(compactPack, 'health_issue_fixture', stateRecord, '', storageOptions);
assert.equal(saveResult.ok, true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const savedPayload = JSON.parse(stored.get(payloadResult.libraryRecord.payloadFile));
assert.equal(savedPayload.healthIssueStates.health_issue_fixture.status, 'ignored');
assert.equal(savedPayload.entryOverrides['entry-1'].content.fact, 'Fact content.');
const savedLibraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(savedLibraryIndex.packs['issue-state-external-pack'].healthIssueStates, undefined);
assert.equal(savedLibraryIndex.packs['issue-state-external-pack'].entryOverrides, undefined);

clock = 3000;
const clearResult = await persistLoredeckHealthIssueState(compactPack, 'health_issue_fixture', null, '', storageOptions);
assert.equal(clearResult.ok, true);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const clearedPayload = JSON.parse(stored.get(payloadResult.libraryRecord.payloadFile));
assert.deepEqual(clearedPayload.healthIssueStates || {}, {});

console.log('Loredeck health issue state external payload tests passed.');
