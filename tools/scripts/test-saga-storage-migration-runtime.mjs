import assert from 'node:assert/strict';

const stored = new Map();
let settingsSaveCount = 0;
let metadataSaveCount = 0;

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

const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
const extensionSettings = {
  saga: {
    themePackId: 'runtime-theme',
    sagaStorage: {},
    loredeckLibrary: {
      schemaVersion: 1,
      packs: {
        'hp-core': {
          packId: 'hp-core',
          type: 'bundled',
          title: 'Bundled default should compact away',
          entryOverrides: {
            bloated: { id: 'bloated', title: 'Bundled payload should not persist.' },
          },
        },
        'runtime-pack': {
          packId: 'runtime-pack',
          type: 'custom',
          title: 'Runtime Pack',
          stats: { entryCount: 1 },
          assets: {
            cover: { path: tinyPngDataUrl },
          },
          entryOverrides: {
            runtime: {
              id: 'runtime',
              title: 'Runtime Entry',
              schemaVersion: 3,
              content: { fact: 'Runtime migration persists through saveSettings.' },
            },
          },
        },
      },
      activeStack: [{ packId: 'runtime-pack', enabled: true }],
    },
    loredeckCreatorProjects: {
      schemaVersion: 1,
      activeJobId: 'runtime_creator',
      lastJobId: 'runtime_creator',
      jobs: {
        runtime_creator: {
          jobId: 'runtime_creator',
          fandom: 'Runtime',
          scope: 'Storage',
          status: 'draft',
          currentStage: 'titles',
          brief: { title: 'Runtime Creator' },
          titleDrafts: [{ titleId: 'runtime-title', title: 'Runtime Storage' }],
          generationRuns: {},
          generationUnits: {},
        },
      },
    },
    themePackLibrary: {
      schemaVersion: 1,
      packs: {
        'runtime-theme': {
          id: 'runtime-theme',
          title: 'Runtime Theme',
          colors: { accent: '#d7b56d' },
        },
      },
    },
    themeIconSetLibrary: {
      schemaVersion: 1,
      iconSets: {},
    },
  },
};
const chatMetadata = {
  saga: {
    _version: 1,
    loredeckRegistry: {
      schemaVersion: 1,
      packs: {
        'runtime-pack': extensionSettings.saga.loredeckLibrary.packs['runtime-pack'],
      },
    },
    loredeckCreator: extensionSettings.saga.loredeckCreatorProjects,
    loredeckStack: [{ packId: 'runtime-pack', enabled: true }],
    stateSafety: { schemaVersion: 1, backups: [], migrationLog: [] },
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
  resetSagaLorepackLibraryStorageCache,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  resetSagaLorepackPayloadStorageCache,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
  resetSagaCreatorProjectStorageCache,
} = await import('../../src/storage/saga-creator-project-storage.js');
const {
  resetSagaThemeIconStorageCache,
} = await import('../../src/storage/saga-theme-icon-storage.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
  SAGA_STORAGE_MIGRATION_VERSION,
} = await import('../../src/storage/saga-storage-index.js');
const {
  getSagaStorageMigrationPlan,
  runSagaStorageMigration,
} = await import('../../src/state/state-manager.js');

const fileApi = createSagaFileApi({
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'runtime-migration-test' }),
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

    if (url === '/api/files/delete' && method === 'POST') {
      stored.delete(body.path);
      return response(true, 200, JSON.stringify({ ok: true }));
    }

    return response(false, 404, 'unexpected request');
  },
});

resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
resetSagaCreatorProjectStorageCache();
resetSagaThemeIconStorageCache();

let clock = 1000;
const now = () => clock;

const plan = getSagaStorageMigrationPlan({ now });
assert.equal(plan.needsMigration, true);
assert.equal(plan.counts.libraryPacks, 1);
assert.equal(plan.counts.creatorProjects, 1);
assert.equal(plan.counts.themePacks, 1);

clock = 2000;
const result = await runSagaStorageMigration({ fileApi, now });
assert.equal(result.ok, true);
assert.equal(result.integrity.status, 'ok');
assert.equal(settingsSaveCount > 0, true);
assert.equal(metadataSaveCount > 0, true);

const savedSettings = extensionSettings.saga;
assert.equal(savedSettings.sagaStorage.migrationVersion, SAGA_STORAGE_MIGRATION_VERSION);
assert.deepEqual(savedSettings.loredeckLibrary.packs, {});
assert.deepEqual(savedSettings.loredeckCreatorProjects.jobs, {});
assert.deepEqual(savedSettings.themePackLibrary.packs, {});
assert.deepEqual(savedSettings.themeIconSetLibrary.iconSets, {});
assert.equal(savedSettings.themePackId, 'runtime-theme');
assert(!JSON.stringify(savedSettings).includes('Runtime migration persists through saveSettings.'));
assert(!JSON.stringify(savedSettings).includes('Bundled payload should not persist.'));

const savedState = chatMetadata.saga;
assert.equal(savedState.loredeckRegistry.packs['runtime-pack'], undefined);
assert.equal(savedState.loredeckCreator.jobs.runtime_creator, undefined);
assert.equal(savedState.loredeckStack[0].packId, 'runtime-pack');
assert.equal(savedState.loredeckStack[0].enabled, true);
assert.equal(savedState.stateSafety.backups[0].reason, 'before_storage_migration');
assert.equal(savedState.stateSafety.migrationLog[0].type, 'storage_migration');
assert.match(savedState.stateSafety.migrationLog[0].message, /Externalized Saga storage/);

const libraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(libraryIndex.packs['runtime-pack'].payloadFile, '/user/files/saga-pack-runtime-pack.v1.json');
const creatorIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator));
assert.equal(creatorIndex.projects.runtime_creator.projectFile, '/user/files/saga-creator-project-runtime_creator.v1.json');
const themeIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes));
assert.equal(themeIndex.packs['runtime-theme'].payloadFile, '/user/files/saga-theme-pack-runtime-theme.v1.json');
const masterIndex = JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(masterIndex.files['/user/files/saga-pack-runtime-pack.v1.json'].kind, 'lorepack_payload');
assert.equal(masterIndex.files['/user/files/saga-creator-project-runtime_creator.v1.json'].kind, 'creator_project_payload');
assert.equal(masterIndex.files['/user/files/saga-theme-pack-runtime-theme.v1.json'].kind, 'theme_pack_payload');

const migratedPlan = getSagaStorageMigrationPlan({ now });
assert.equal(migratedPlan.needsMigration, false);
assert.equal(migratedPlan.alreadyMigrated, true);

console.log('Saga storage runtime migration tests passed.');
