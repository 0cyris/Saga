import assert from 'node:assert/strict';

const {
  configureSagaCreatorProjectStorage,
  flushSagaCreatorProjectStorageWrites,
  getCachedExternalLoredeckCreatorProject,
  getExternalLoredeckCreatorIndex,
  getExternalLoredeckCreatorRegistry,
  hydrateSagaCreatorProjectStorage,
  normalizeSagaCreatorIndex,
  removeExternalLoredeckCreatorProjectSync,
  resetSagaCreatorProjectStorageCache,
  upsertExternalLoredeckCreatorProjectSync,
} = await import('../../src/storage/saga-creator-project-storage.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');

const stored = new Map();
const uploadCounts = new Map();

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'creator-storage-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;

    if (url === '/api/files/upload' && method === 'POST') {
      const path = `/user/files/${body.name}`;
      uploadCounts.set(path, (uploadCounts.get(path) || 0) + 1);
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

resetSagaCreatorProjectStorageCache();
let clock = 1000;
const now = () => clock;
configureSagaCreatorProjectStorage({ fileApi, now });

const normalized = normalizeSagaCreatorIndex({
  kind: 'wrong',
  activeProjectId: 'creator_one_piece_arlong',
  projects: {
    creator_one_piece_arlong: {
      jobId: 'creator_one_piece_arlong',
      title: 'One Piece: Arlong Park',
      fandom: 'One Piece',
      scope: 'Arlong Park',
      currentStage: 'entries_drafted',
      titleDrafts: [{ titleId: 'arlong-pressure' }],
      projectFile: '/user/files/saga-creator-project-creator_one_piece_arlong.v1.json',
      progress: { draftChangeCount: 57 },
      createdAt: 100,
      updatedAt: 200,
    },
  },
}, { now });
assert.equal(normalized.kind, 'saga_creator_index');
assert.equal(normalized.activeJobId, 'creator_one_piece_arlong');
assert.equal(normalized.projects.creator_one_piece_arlong.projectFile, '/user/files/saga-creator-project-creator_one_piece_arlong.v1.json');
assert.equal(normalized.projects.creator_one_piece_arlong.titleDrafts, undefined, 'Creator index rows must not retain title draft payloads.');
assert.equal(normalized.projects.creator_one_piece_arlong.progress.draftChangeCount, 57);

const upserted = upsertExternalLoredeckCreatorProjectSync({
  jobId: 'creator_one_piece_arlong',
  fandom: 'One Piece',
  scope: 'Arlong Park',
  projectTitle: 'One Piece: Arlong Park',
  currentStage: 'entries_drafted',
  titleDrafts: [{ titleId: 'arlong-pressure', title: 'Arlong pressure over Cocoyasi Village' }],
  draftChanges: [
    {
      changeId: 'draft_arlong_pressure',
      payload: { entryOverrides: { 'arlong-pressure': { title: 'Arlong pressure' } } },
    },
  ],
  createdAt: 100,
  updatedAt: 200,
}, { activeJobId: 'creator_one_piece_arlong', lastJobId: 'creator_one_piece_arlong' });
assert.equal(upserted.ok, true);
assert.equal(getExternalLoredeckCreatorIndex().projects.creator_one_piece_arlong.title, 'One Piece: Arlong Park');
assert.equal(getExternalLoredeckCreatorIndex().projects.creator_one_piece_arlong.titleDrafts, undefined);
assert.equal(getCachedExternalLoredeckCreatorProject('creator_one_piece_arlong').titleDrafts[0].title, 'Arlong pressure over Cocoyasi Village');
assert.equal(getExternalLoredeckCreatorRegistry().jobs.creator_one_piece_arlong.titleDrafts[0].title, 'Arlong pressure over Cocoyasi Village');

clock = 2000;
const flush = await flushSagaCreatorProjectStorageWrites();
assert.equal(flush.ok, true);
assert.equal(stored.has(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator), true);
assert.equal(stored.has('/user/files/saga-creator-project-creator_one_piece_arlong.v1.json'), true);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[SAGA_STORAGE_DOMAIN_INDEX_FILES.creator].kind, 'creator_index');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-creator-project-creator_one_piece_arlong.v1.json'].kind, 'creator_project_payload');

resetSagaCreatorProjectStorageCache();
await hydrateSagaCreatorProjectStorage({ fileApi, now, force: true });
const compactRegistry = getExternalLoredeckCreatorRegistry();
assert.equal(compactRegistry.jobs.creator_one_piece_arlong.projectFile, '/user/files/saga-creator-project-creator_one_piece_arlong.v1.json');
assert.equal(compactRegistry.jobs.creator_one_piece_arlong.titleDrafts, undefined, 'Hydrating the index alone should not load full project payloads.');

const removed = removeExternalLoredeckCreatorProjectSync('creator_one_piece_arlong');
assert.equal(removed.ok, true);
clock = 3000;
const deleteFlush = await flushSagaCreatorProjectStorageWrites();
assert.equal(deleteFlush.ok, true);
assert.equal(stored.has('/user/files/saga-creator-project-creator_one_piece_arlong.v1.json'), false);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator)).projects.creator_one_piece_arlong, undefined);

uploadCounts.clear();
clock = 4000;
upsertExternalLoredeckCreatorProjectSync({
  jobId: 'creator_write_coalesce',
  fandom: 'One Piece',
  scope: 'Arlong Park',
  projectTitle: 'Write Coalesce',
  currentStage: 'entries_drafting',
  activeGeneration: {
    id: 'entry-draft-1',
    runId: 'entry-draft-1',
    status: 'running',
    phase: 'receiving',
    message: 'Receiving first update...',
    updatedAt: clock,
  },
  createdAt: 4000,
  updatedAt: 4000,
}, { activeJobId: 'creator_write_coalesce', lastJobId: 'creator_write_coalesce', coalesceWrites: true });
clock = 4010;
upsertExternalLoredeckCreatorProjectSync({
  jobId: 'creator_write_coalesce',
  activeGeneration: {
    id: 'entry-draft-1',
    runId: 'entry-draft-1',
    status: 'running',
    phase: 'receiving',
    message: 'Receiving second update...',
    updatedAt: clock,
  },
  updatedAt: 4010,
}, { activeJobId: 'creator_write_coalesce', lastJobId: 'creator_write_coalesce', coalesceWrites: true });
clock = 4020;
upsertExternalLoredeckCreatorProjectSync({
  jobId: 'creator_write_coalesce',
  activeGeneration: {
    id: 'entry-draft-1',
    runId: 'entry-draft-1',
    status: 'running',
    phase: 'receiving',
    message: 'Receiving final update...',
    updatedAt: clock,
  },
  updatedAt: 4020,
}, { activeJobId: 'creator_write_coalesce', lastJobId: 'creator_write_coalesce', coalesceWrites: true });
const coalesceFlush = await flushSagaCreatorProjectStorageWrites();
const coalescedProjectPath = '/user/files/saga-creator-project-creator_write_coalesce.v1.json';
assert.equal(coalesceFlush.ok, true);
assert.equal(JSON.parse(stored.get(coalescedProjectPath)).activeGeneration.message, 'Receiving final update...');
assert.equal(uploadCounts.get(coalescedProjectPath), 2, 'Coalesced progress writes should persist the first update and latest pending update only.');
assert.equal(uploadCounts.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator), 2, 'Coalesced progress writes should avoid one Creator index write per progress update.');

console.log('Saga Deck Maker project external storage tests passed.');
