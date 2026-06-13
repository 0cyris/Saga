import assert from 'node:assert/strict';

const {
  createCompactedSagaSettingsAfterStorageMigration,
  createSagaStorageMigrationPlan,
  executeSagaStorageMigration,
} = await import('../../src/storage/saga-storage-migration.js');
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
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');

const stored = new Map();
const calls = [];

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'migration-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, body });

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

resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
resetSagaCreatorProjectStorageCache();
resetSagaThemeIconStorageCache();

let clock = 1000;
const now = () => clock;
const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
const legacySettings = {
  themePackId: 'arlong-theme',
  themeIconSetId: 'arlong-icons',
  sagaStorage: {},
  loredeckLibrary: {
    schemaVersion: 1,
    packs: {
      'hp-core': {
        packId: 'hp-core',
        type: 'bundled',
        title: 'Bundled default should compact away',
        entryOverrides: {
          oversized: { id: 'oversized', title: 'Should Not Persist In Settings' },
        },
      },
      'arlong-custom': {
        packId: 'arlong-custom',
        type: 'custom',
        title: 'Arlong Custom',
        description: 'Legacy settings-backed deck.',
        fandom: 'One Piece',
        stats: { entryCount: 1 },
        assets: {
          cover: {
            path: tinyPngDataUrl,
            alt: 'Arlong Park cover',
          },
        },
        entryOverrides: {
          nami: {
            id: 'nami',
            title: 'Nami',
            schemaVersion: 3,
            content: { fact: 'Nami bargains with Arlong.' },
          },
        },
        tagRegistry: {
          schemaVersion: 1,
          tags: {
            nami: { id: 'nami', label: 'Nami' },
          },
        },
      },
    },
    folders: [{ id: 'folder-one-piece', name: 'One Piece' }],
    deckPlacements: [{ deckId: 'arlong-custom', folderId: 'folder-one-piece', order: 1 }],
    activeStack: [{ packId: 'arlong-custom', enabled: true }],
  },
  loredeckCreatorProjects: {
    schemaVersion: 1,
    activeJobId: 'creator_arlong',
    lastJobId: 'creator_arlong',
    jobs: {
      creator_arlong: {
        jobId: 'creator_arlong',
        fandom: 'One Piece',
        scope: 'Arlong Park',
        status: 'draft',
        currentStage: 'lorecards',
        brief: { title: 'Arlong Creator', packId: 'arlong-generated' },
        titleDrafts: [{ titleId: 'title-1', title: 'Arlong Park' }],
        draftChanges: [{ changeId: 'change-1', recordId: 'nami', title: 'Nami' }],
        generationRuns: {},
        generationUnits: {},
      },
    },
  },
  themePackLibrary: {
    schemaVersion: 1,
    packs: {
      'arlong-theme': {
        id: 'arlong-theme',
        title: 'Arlong Theme',
        colors: {
          background: '#120c12',
          surface: '#241018',
          accent: '#d7b56d',
        },
      },
    },
  },
  themeIconSetLibrary: {
    schemaVersion: 1,
    iconSets: {
      'arlong-icons': {
        id: 'arlong-icons',
        title: 'Arlong Icons',
        icons: {
          'tab.loredecks': tinyPngDataUrl,
        },
      },
    },
  },
};

const plan = createSagaStorageMigrationPlan(legacySettings, { now });
assert.equal(plan.needsMigration, true);
assert.equal(plan.counts.libraryPacks, 1);
assert.equal(plan.counts.creatorProjects, 1);
assert.equal(plan.counts.themePacks, 1);
assert.equal(plan.counts.iconSets, 1);
assert(plan.skipped.some(item => item.id === 'hp-core' && item.reason === 'bundled_lorepack'));

const compactPreview = createCompactedSagaSettingsAfterStorageMigration(legacySettings, { migratedAt: 1500 });
assert.equal(compactPreview.sagaStorage.migrationVersion, SAGA_STORAGE_MIGRATION_VERSION);
assert.deepEqual(compactPreview.loredeckLibrary.packs, {});
assert.deepEqual(compactPreview.loredeckCreatorProjects.jobs, {});
assert.deepEqual(compactPreview.themePackLibrary.packs, {});
assert.deepEqual(compactPreview.themeIconSetLibrary.iconSets, {});
assert(!JSON.stringify(compactPreview).includes('Should Not Persist In Settings'));
assert(!JSON.stringify(compactPreview).includes('Nami bargains with Arlong.'));

let savedSettings = null;
let savedState = null;
clock = 2000;
const result = await executeSagaStorageMigration(legacySettings, {
  fileApi,
  now,
  saveSettings: next => {
    savedSettings = next;
  },
  state: {
    loredeckRegistry: {
      schemaVersion: 1,
      packs: {
        'arlong-custom': legacySettings.loredeckLibrary.packs['arlong-custom'],
      },
    },
    loredeckCreator: legacySettings.loredeckCreatorProjects,
    loredeckStack: [{ packId: 'arlong-custom', enabled: true }],
  },
  saveState: next => {
    savedState = next;
  },
});

assert.equal(result.ok, true);
assert.equal(result.integrity.status, 'ok');
assert.equal(savedSettings.sagaStorage.migrationVersion, SAGA_STORAGE_MIGRATION_VERSION);
assert.deepEqual(savedSettings.loredeckLibrary.packs, {});
assert.deepEqual(savedSettings.loredeckCreatorProjects.jobs, {});
assert.deepEqual(savedSettings.themePackLibrary.packs, {});
assert.deepEqual(savedSettings.themeIconSetLibrary.iconSets, {});
assert.equal(savedSettings.themePackId, 'arlong-theme', 'Current theme selection remains compact control-plane settings.');
assert.equal(savedSettings.themeIconSetId, 'arlong-icons', 'Current icon selection remains compact control-plane settings.');
assert.equal(savedState.loredeckRegistry.packs['arlong-custom'], undefined);
assert.equal(savedState.loredeckCreator.jobs.creator_arlong, undefined);
assert.deepEqual(savedState.loredeckStack, [{ packId: 'arlong-custom', enabled: true }], 'Active stack control metadata stays in chat state.');

const libraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(libraryIndex.packs['arlong-custom'].payloadFile, '/user/files/saga-pack-arlong-custom.v1.json');
assert.equal(libraryIndex.packs['arlong-custom'].entryOverrides, undefined);
assert.equal(libraryIndex.folders[0].id, 'folder-one-piece');
assert.equal(libraryIndex.activeStack[0].packId, 'arlong-custom');

const lorepackPayload = JSON.parse(stored.get('/user/files/saga-pack-arlong-custom.v1.json'));
assert.equal(lorepackPayload.entryOverrides.nami.content.fact, 'Nami bargains with Arlong.');
assert.match(lorepackPayload.assets.cover.path, /^\/user\/files\/saga-pack-asset-arlong-custom-cover-[a-f0-9]+\.png$/);
assert.equal(stored.has(lorepackPayload.assets.cover.path), true);

const creatorIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator));
assert.equal(creatorIndex.projects.creator_arlong.projectFile, '/user/files/saga-creator-project-creator_arlong.v1.json');
const creatorPayload = JSON.parse(stored.get(creatorIndex.projects.creator_arlong.projectFile));
assert.equal(creatorPayload.titleDrafts[0].title, 'Arlong Park');
assert.equal(creatorPayload.draftChanges[0].recordId, 'nami');

const themeIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes));
assert.equal(themeIndex.packs['arlong-theme'].payloadFile, '/user/files/saga-theme-pack-arlong-theme.v1.json');
assert.equal(JSON.parse(stored.get(themeIndex.packs['arlong-theme'].payloadFile)).colors.accent, '#d7b56d');

const iconSetIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets));
const iconPayload = JSON.parse(stored.get(iconSetIndex.iconSets['arlong-icons'].payloadFile));
assert.match(iconPayload.icons['tab.loredecks'], /^\/user\/files\/saga-iconset-asset-arlong-icons-tab-loredecks-[a-f0-9]+\.png$/);
assert.equal(stored.has(iconPayload.icons['tab.loredecks']), true);

const masterIndex = JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(masterIndex.files['/user/files/saga-pack-arlong-custom.v1.json'].kind, 'lorepack_payload');
assert.equal(masterIndex.files[creatorIndex.projects.creator_arlong.projectFile].kind, 'creator_project_payload');
assert.equal(masterIndex.files[themeIndex.packs['arlong-theme'].payloadFile].kind, 'theme_pack_payload');
assert.equal(masterIndex.files[iconSetIndex.iconSets['arlong-icons'].payloadFile].kind, 'iconset_payload');
assert(calls.some(call => call.url === '/api/files/verify'), 'Migration should verify uploaded files before compacting settings.');

const alreadyMigratedPlan = createSagaStorageMigrationPlan(savedSettings, { now });
assert.equal(alreadyMigratedPlan.needsMigration, false);
assert.equal(alreadyMigratedPlan.alreadyMigrated, true);

stored.clear();
calls.length = 0;
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
resetSagaCreatorProjectStorageCache();
resetSagaThemeIconStorageCache();

const existingExternalPayloadPath = '/user/files/saga-pack-existing-generated.v1.json';
stored.set(existingExternalPayloadPath, JSON.stringify({
  schemaVersion: 1,
  kind: 'saga_lorepack_payload',
  packId: 'existing-generated',
  type: 'generated',
  title: 'Existing Generated',
  entryOverrides: {
    existing: {
      id: 'existing',
      title: 'Existing Entry',
      schemaVersion: 3,
      content: { fact: 'Existing external payload survives migration.' },
    },
  },
}));
stored.set(SAGA_STORAGE_DOMAIN_INDEX_FILES.library, JSON.stringify({
  schemaVersion: 1,
  kind: 'saga_library_index',
  createdAt: 3000,
  updatedAt: 3000,
  revision: 7,
  packs: {
    'existing-generated': {
      packId: 'existing-generated',
      type: 'generated',
      title: 'Existing Generated',
      payloadFile: existingExternalPayloadPath,
      stats: { entryCount: 1 },
    },
  },
  folders: [],
  deckPlacements: [],
  activeStack: [],
}));
stored.set(SAGA_STORAGE_INDEX_PATH, JSON.stringify({
  schemaVersion: 1,
  kind: 'saga_storage_index',
  createdAt: 3000,
  updatedAt: 3000,
  revision: 7,
  files: {
    [SAGA_STORAGE_INDEX_PATH]: {
      kind: 'storage_index',
      domain: 'storage',
      ownerId: 'storage',
      mime: 'application/json',
      deletion: 'managed',
    },
    [SAGA_STORAGE_DOMAIN_INDEX_FILES.library]: {
      kind: 'library_index',
      domain: 'library',
      ownerId: 'library',
      mime: 'application/json',
      deletion: 'managed',
    },
    [existingExternalPayloadPath]: {
      kind: 'lorepack_payload',
      domain: 'library',
      ownerId: 'existing-generated',
      mime: 'application/json',
      deletion: 'delete_with_owner',
    },
  },
}));

const partialExternalSettings = {
  sagaStorage: {},
  loredeckLibrary: {
    schemaVersion: 1,
    packs: {
      'hp-core': {
        packId: 'hp-core',
        type: 'bundled',
        title: 'Bundled default should compact away after layout migration',
      },
    },
    folders: [{ id: 'user-bundled-folder', title: 'User Bundled Folder' }],
    deckPlacements: [{ deckId: 'hp-core', folderId: 'user-bundled-folder', order: 1 }],
    activeStack: [{ packId: 'hp-core', enabled: true }],
  },
  loredeckCreatorProjects: { schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: {} },
  themePackLibrary: { schemaVersion: 1, packs: {} },
  themeIconSetLibrary: { schemaVersion: 1, iconSets: {} },
};

const partialPlan = createSagaStorageMigrationPlan(partialExternalSettings, { now });
assert.equal(partialPlan.needsMigration, true);
assert.equal(partialPlan.counts.libraryPacks, 0);
assert.equal(partialPlan.counts.libraryLayoutRecords, 3);
assert(partialPlan.skipped.some(item => item.id === 'hp-core' && item.reason === 'bundled_lorepack'));

let partialSavedSettings = null;
clock = 4000;
const partialResult = await executeSagaStorageMigration(partialExternalSettings, {
  fileApi,
  now,
  saveSettings: next => {
    partialSavedSettings = next;
  },
});
assert.equal(partialResult.ok, true);
assert.equal(partialSavedSettings.sagaStorage.migrationVersion, SAGA_STORAGE_MIGRATION_VERSION);
assert.deepEqual(partialSavedSettings.loredeckLibrary.packs, {});

const partialLibraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(partialLibraryIndex.packs['existing-generated'].payloadFile, existingExternalPayloadPath, 'Migration must preserve existing external Library records while importing settings-side layout.');
assert.equal(partialLibraryIndex.folders[0].id, 'user-bundled-folder');
assert.equal(partialLibraryIndex.deckPlacements[0].deckId, 'hp-core');
assert.equal(partialLibraryIndex.activeStack[0].packId, 'hp-core');
assert.equal(JSON.parse(stored.get(existingExternalPayloadPath)).entryOverrides.existing.content.fact, 'Existing external payload survives migration.');

console.log('Saga storage migration tests passed.');
