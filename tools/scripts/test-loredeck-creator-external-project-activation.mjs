import assert from 'node:assert/strict';

import { MODULE_KEY, SCHEMA_VERSION } from '../../src/state/constants.js';
import {
  configureSagaCreatorProjectStorage,
  flushSagaCreatorProjectStorageWrites,
  getExternalLoredeckCreatorRegistry,
  hydrateSagaCreatorProjectStorage,
  resetSagaCreatorProjectStorageCache,
} from '../../src/storage/saga-creator-project-storage.js';
import {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} from '../../src/storage/saga-file-api.js';
import {
  activateLoredeckCreatorJob,
  activateLoredeckCreatorJobAsync,
  getLoredeckCreatorProjectRegistry,
  getState,
  upsertLoredeckCreatorJob,
} from '../../src/state/state-manager.js';

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'creator-activation-test' }),
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

let extensionSettings;
let chatMetadata;
let saveSettingsCount = 0;
let saveStateCount = 0;

function resetHostState() {
  extensionSettings = { [MODULE_KEY]: {} };
  chatMetadata = {
    [MODULE_KEY]: {
      _version: SCHEMA_VERSION,
      loreContext: {},
      loreMatrix: [],
      pendingLoreEntries: [],
      loredeckCreator: { schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: {} },
    },
  };
  saveSettingsCount = 0;
  saveStateCount = 0;
}

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings,
      chatMetadata,
      saveSettingsDebounced() {
        saveSettingsCount += 1;
      },
      saveMetadata() {
        saveStateCount += 1;
      },
    };
  },
};

resetHostState();
resetSagaCreatorProjectStorageCache();
configureSagaCreatorProjectStorage({ fileApi, now: () => 1000 });

const created = upsertLoredeckCreatorJob({
  jobId: 'creator_cold_reload',
  fandom: 'One Piece',
  scope: 'Arlong Park',
  granularity: 'focused',
  projectTitle: 'One Piece: Arlong Park',
  currentStage: 'titles_drafted',
  titleDrafts: [{ titleId: 'nami-bargain', title: 'Nami hidden bargain' }],
  draftChanges: [
    {
      changeId: 'draft_nami_bargain',
      affectedEntryIds: ['nami-bargain'],
      payload: {
        entryOverrides: {
          'nami-bargain': { title: 'Nami hidden bargain' },
        },
      },
    },
  ],
}, { syncPrompt: false });
assert.equal(created.ok, true);
assert.equal(extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_cold_reload, undefined);

const flush = await flushSagaCreatorProjectStorageWrites();
assert.equal(flush.ok, true);
assert.ok(stored.has('/user/files/saga-creator-project-creator_cold_reload.v1.json'));

resetHostState();
resetSagaCreatorProjectStorageCache();
configureSagaCreatorProjectStorage({ fileApi, now: () => 2000 });
await hydrateSagaCreatorProjectStorage({ fileApi, now: () => 2000, force: true });

const compactRegistry = getExternalLoredeckCreatorRegistry();
assert.equal(compactRegistry.jobs.creator_cold_reload.projectFile, '/user/files/saga-creator-project-creator_cold_reload.v1.json');
assert.equal(compactRegistry.jobs.creator_cold_reload.titleDrafts, undefined);

const syncActivation = activateLoredeckCreatorJob('creator_cold_reload', { syncPrompt: false });
assert.equal(syncActivation.ok, false);
assert.equal(syncActivation.code, 'creator_payload_not_loaded');

const asyncActivation = await activateLoredeckCreatorJobAsync('creator_cold_reload', { syncPrompt: false });
assert.equal(asyncActivation.ok, true);
assert.equal(asyncActivation.job.titleDrafts[0].title, 'Nami hidden bargain');
assert.equal(asyncActivation.job.draftChanges[0].payload.entryOverrides['nami-bargain'].title, 'Nami hidden bargain');
assert.equal(getState().loredeckCreator.activeJobId, 'creator_cold_reload');
assert.equal(getLoredeckCreatorProjectRegistry().jobs.creator_cold_reload.titleDrafts[0].title, 'Nami hidden bargain');
assert.equal(saveSettingsCount, 0, 'Async Creator resume should not rehydrate full projects into settings.');
assert.ok(saveStateCount >= 1, 'Async Creator resume should mirror the loaded project into chat metadata.');

console.log('Loredeck Creator external project activation tests passed.');
