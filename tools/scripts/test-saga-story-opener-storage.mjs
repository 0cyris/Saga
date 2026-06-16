import assert from 'node:assert/strict';

const {
  flushSagaStoryOpenerStorageWrites,
  getCachedExternalStoryOpenerSession,
  getExternalStoryOpenerIndex,
  hydrateExternalStoryOpenerSessionRecord,
  hydrateSagaStoryOpenerStorage,
  normalizeSagaStoryOpenerIndex,
  removeExternalStoryOpenerSessionSync,
  resetSagaStoryOpenerStorageCache,
  upsertExternalStoryOpenerSessionSync,
} = await import('../../src/storage/saga-story-opener-storage.js');
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'story-opener-storage-test' }),
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

resetSagaStoryOpenerStorageCache();
let clock = 1000;
const now = () => clock;

const normalized = normalizeSagaStoryOpenerIndex({
  kind: 'wrong',
  activeSessionId: 'opener-hp',
  sessions: {
    'opener-hp': {
      sessionId: 'opener-hp',
      title: 'HP opener',
      controls: { userPrompt: 'Open on Hermione.', context: 'Book 6 January' },
      variants: [{ id: 'variant-a', text: 'Payload text should not live in the index.' }],
      sessionFile: '/user/files/saga-story-opener-session-opener-hp.v1.json',
      createdAt: 100,
      updatedAt: 200,
    },
  },
}, { now });
assert.equal(normalized.kind, 'story_opener_index');
assert.equal(normalized.activeSessionId, 'opener-hp');
assert.equal(normalized.sessions['opener-hp'].variantCount, 1);
assert.equal(normalized.sessions['opener-hp'].variants, undefined, 'Story Opener index rows must not retain generated opener bodies.');

const upserted = upsertExternalStoryOpenerSessionSync({
  sessionId: 'opener-hp',
  title: 'HP opener',
  controls: {
    userPrompt: 'Open on Hermione after a difficult library night.',
    context: 'Harry Potter Book 6 - January',
    proseStyle: 'Harry Potter prose style for Half-Blood Prince era',
  },
  sourceIntent: {
    sourceMode: 'loredeck_only',
    context: 'Harry Potter Book 6 - January',
    packIds: ['harry-potter-core'],
    fandoms: ['Harry Potter'],
  },
  variants: [{ id: 'variant-a', label: 'Variant A', text: 'Hermione looked up from the library table.' }],
  createdAt: 100,
  updatedAt: 200,
}, { fileApi, now, activeSessionId: 'opener-hp', lastSessionId: 'opener-hp' });
assert.equal(upserted.ok, true);
assert.equal(getExternalStoryOpenerIndex().sessions['opener-hp'].variantCount, 1);
assert.equal(getExternalStoryOpenerIndex().sessions['opener-hp'].variants, undefined);
assert.equal(getCachedExternalStoryOpenerSession('opener-hp').variants[0].text, 'Hermione looked up from the library table.');

clock = 2000;
const flush = await flushSagaStoryOpenerStorageWrites();
assert.equal(flush.ok, true);
assert.equal(stored.has(SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners), true);
assert.equal(stored.has('/user/files/saga-story-opener-session-opener-hp.v1.json'), true);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners].kind, 'story_opener_index');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-story-opener-session-opener-hp.v1.json'].kind, 'story_opener_session_payload');

resetSagaStoryOpenerStorageCache();
await hydrateSagaStoryOpenerStorage({ fileApi, now, force: true });
const compactIndex = getExternalStoryOpenerIndex();
assert.equal(compactIndex.sessions['opener-hp'].sessionFile, '/user/files/saga-story-opener-session-opener-hp.v1.json');
assert.equal(getCachedExternalStoryOpenerSession('opener-hp'), null, 'Hydrating the opener index alone should not load full opener payloads.');
const payload = await hydrateExternalStoryOpenerSessionRecord(compactIndex.sessions['opener-hp'], { fileApi, now });
assert.equal(payload.variants[0].text, 'Hermione looked up from the library table.');

const removed = removeExternalStoryOpenerSessionSync('opener-hp', { fileApi, now });
assert.equal(removed.ok, true);
clock = 3000;
const deleteFlush = await flushSagaStoryOpenerStorageWrites();
assert.equal(deleteFlush.ok, true);
assert.equal(stored.has('/user/files/saga-story-opener-session-opener-hp.v1.json'), false);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners)).sessions['opener-hp'], undefined);

console.log('Saga Story Opener storage tests passed.');
