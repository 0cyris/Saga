import assert from 'node:assert/strict';

const {
  DEFAULT_SETTINGS,
  getDefaultState,
} = await import('../../src/state/constants.js');
const {
  configureLoredeckLibraryStore,
  getLoredeckLibraryRegistry,
} = await import('../../src/state/loredeck-library-store.js');
const {
  buildSagaGlobalCleanupPreview,
  removeSagaCustomLoredeckStorage,
  removeSagaCustomThemeIconStorage,
  runSagaTotalStorageCleanup,
} = await import('../../src/storage/saga-global-cleanup.js');
const {
  getExternalThemeIconSetLibraryRegistry,
  getExternalThemePackLibraryRegistry,
  importExternalIconSet,
  importExternalThemePack,
  resetSagaThemeIconStorageCache,
} = await import('../../src/storage/saga-theme-icon-storage.js');
const {
  flushSagaLorepackLibraryStorageWrites,
  getExternalLoredeckLibraryRegistry,
  replaceExternalLoredeckLibraryIndexSync,
  resetSagaLorepackLibraryStorageCache,
  upsertExternalLoredeckLibraryRecordSync,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  createExternalLorepackLibraryRecord,
  flushSagaLorepackPayloadStorageWrites,
  resetSagaLorepackPayloadStorageCache,
  upsertExternalLorepackPayloadSync,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
  writeLoredeckHealthRepairSession,
} = await import('../../src/loredecks/loredeck-health-repair-session-storage.js');
const {
  flushSagaCreatorProjectStorageWrites,
  getExternalLoredeckCreatorIndex,
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
const deleted = [];
const deleteFailures = new Set();

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

configureLoredeckLibraryStore({
  getSettings: () => cloneJson(DEFAULT_SETTINGS),
  getState: () => getDefaultState(),
  saveSettings: () => {},
  saveState: () => {},
});

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'global-cleanup-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;

    if (url === '/api/files/upload' && method === 'POST') {
      const path = `/user/files/${body.name}`;
      stored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
      return response(true, 200, JSON.stringify({ path }));
    }

    if (url === '/api/files/delete' && method === 'POST') {
      deleted.push(body.path);
      if (deleteFailures.has(body.path)) {
        return response(false, 500, `delete failed: ${body.path}`);
      }
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

resetSagaThemeIconStorageCache();
resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
resetSagaCreatorProjectStorageCache();

let clock = 1000;
const now = () => clock;
const options = { fileApi, now };
const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

await importExternalThemePack({
  id: 'cleanup-theme',
  title: 'Cleanup Theme',
  colors: { accent: '#ffffff' },
}, options);
const iconImport = await importExternalIconSet({
  id: 'cleanup-icons',
  title: 'Cleanup Icons',
  icons: {
    'tab.loredecks': tinyPngDataUrl,
  },
}, options);
const iconAsset = JSON.parse(stored.get(iconImport.payloadFile)).icons['tab.loredecks'];

clock = 2000;
const themePreview = await buildSagaGlobalCleanupPreview(options);
assert.equal(themePreview.themePackCount, 1);
assert.equal(themePreview.iconSetCount, 1);

const themeCleanup = await removeSagaCustomThemeIconStorage(options);
assert.equal(themeCleanup.ok, true);
assert.equal(themeCleanup.removedThemePackCount, 1);
assert.equal(themeCleanup.removedIconSetCount, 1);
assert.equal(stored.has('/user/files/saga-theme-pack-cleanup-theme.v1.json'), false);
assert.equal(stored.has('/user/files/saga-iconset-cleanup-icons.v1.json'), false);
assert.equal(stored.has(iconAsset), false);
assert.equal(getExternalThemePackLibraryRegistry().packs['cleanup-theme'], undefined);
assert.equal(getExternalThemeIconSetLibraryRegistry().iconSets['cleanup-icons'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes)).packs['cleanup-theme'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets)).iconSets['cleanup-icons'], undefined);

clock = 3000;
const payloadUpsert = upsertExternalLorepackPayloadSync({
  packId: 'cleanup-loredeck',
  type: 'generated',
  title: 'Cleanup Loredeck',
  source: { kind: 'creator' },
  manifestData: {
    id: 'cleanup-loredeck',
    title: 'Cleanup Loredeck',
    assets: {
      cover: {
        path: tinyPngDataUrl,
        alt: 'Cleanup cover',
      },
    },
  },
  assets: {
    cover: {
      path: tinyPngDataUrl,
      alt: 'Cleanup cover',
    },
  },
  entryOverrides: {
    arlong: { id: 'arlong', title: 'Arlong', schemaVersion: 3, content: { fact: 'Arlong rules the park.' } },
  },
}, options);
assert.equal(payloadUpsert.ok, true);
upsertExternalLoredeckLibraryRecordSync(createExternalLorepackLibraryRecord(payloadUpsert.payload), options);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const storedPayload = JSON.parse(stored.get('/user/files/saga-pack-cleanup-loredeck.v1.json'));
const coverAsset = storedPayload.assets.cover.path;
const repairWrite = await writeLoredeckHealthRepairSession({
  packId: 'cleanup-loredeck',
  sessionId: 'needs-review',
  status: 'needs_review',
  attempt: { summary: { outcome: 'needs_review' } },
  remaining: { choiceSetCount: 1 },
}, options);
assert.equal(repairWrite.ok, true);
assert.equal(stored.has(repairWrite.path), true);

const bundledPackId = Object.entries(DEFAULT_SETTINGS.loredeckLibrary?.packs || {})
  .find(([, pack]) => pack?.type === 'bundled')?.[0];
assert(bundledPackId, 'Fixture requires at least one bundled Loredeck.');
replaceExternalLoredeckLibraryIndexSync({
  ...getExternalLoredeckLibraryRegistry(),
  folders: [
    { id: 'surviving-parent', title: 'Surviving Parent', parentId: '' },
    { id: 'surviving-child', title: 'Surviving Child', parentId: 'surviving-parent' },
    { id: 'custom-only-parent', title: 'Custom Only Parent', parentId: '' },
    { id: 'custom-only-folder', title: 'Custom Only', parentId: 'custom-only-parent' },
    { id: 'unrelated-empty-folder', title: 'Unrelated Empty', parentId: '' },
  ],
  deckPlacements: [
    { deckId: bundledPackId, folderId: 'surviving-child', sortOrder: 100 },
    { deckId: 'cleanup-loredeck', folderId: 'custom-only-folder', sortOrder: 200 },
  ],
  activeStack: [
    { id: 'stack-surviving-parent-folder', type: 'folder', folderId: 'surviving-parent', sortOrder: 50 },
    { id: 'stack-surviving-folder', type: 'folder', folderId: 'surviving-child', sortOrder: 100 },
    { id: 'stack-surviving-bundled', type: 'deck', packId: bundledPackId, sortOrder: 200 },
    { id: 'stack-unrelated-empty-folder', type: 'folder', folderId: 'unrelated-empty-folder', sortOrder: 250 },
    { id: 'stack-custom-folder', type: 'folder', folderId: 'custom-only-folder', sortOrder: 300 },
    { id: 'stack-custom-deck', type: 'deck', packId: 'cleanup-loredeck', sortOrder: 400 },
  ],
}, { ...options, replace: true });
await flushSagaLorepackLibraryStorageWrites();

const lorePreview = await buildSagaGlobalCleanupPreview(options);
assert.equal(lorePreview.loredeckCount, 1);

const loreCleanup = await removeSagaCustomLoredeckStorage(options);
assert.equal(loreCleanup.ok, true);
assert.equal(loreCleanup.removedLoredeckCount, 1);
assert.equal(loreCleanup.repairSessionDeletedCount, 1);
assert.equal(stored.has('/user/files/saga-pack-cleanup-loredeck.v1.json'), false);
assert.equal(stored.has(coverAsset), false);
assert.equal(stored.has(repairWrite.path), false);
assert.equal(getExternalLoredeckLibraryRegistry().packs['cleanup-loredeck'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library)).packs['cleanup-loredeck'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-cleanup-loredeck.v1.json'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[coverAsset], undefined);
const prunedLibrary = getExternalLoredeckLibraryRegistry();
assert(prunedLibrary.folders.some(folder => folder.id === 'surviving-parent'), 'Custom Loredeck cleanup should keep ancestor folders for surviving bundled deck placements.');
assert(prunedLibrary.folders.some(folder => folder.id === 'surviving-child'), 'Custom Loredeck cleanup should keep nested folders that still contain bundled deck placements.');
assert(prunedLibrary.folders.some(folder => folder.id === 'unrelated-empty-folder'), 'Custom Loredeck cleanup should keep unrelated empty Library folders.');
assert(!prunedLibrary.folders.some(folder => folder.id === 'custom-only-parent'), 'Custom Loredeck cleanup should remove parent folders that only contained removed custom Loredecks.');
assert(!prunedLibrary.folders.some(folder => folder.id === 'custom-only-folder'), 'Custom Loredeck cleanup should remove folders that only contained removed custom Loredecks.');
assert(prunedLibrary.deckPlacements.some(placement => placement.deckId === bundledPackId && placement.folderId === 'surviving-child'), 'Custom Loredeck cleanup should keep bundled deck placements stored in the external Library index.');
assert(!prunedLibrary.deckPlacements.some(placement => placement.deckId === 'cleanup-loredeck' || placement.packId === 'cleanup-loredeck'), 'Custom Loredeck cleanup should remove deck placements for deleted custom Loredecks.');
assert(prunedLibrary.activeStack.some(item => item.type === 'folder' && item.folderId === 'surviving-parent'), 'Custom Loredeck cleanup should keep valid parent-folder active-stack items.');
assert(prunedLibrary.activeStack.some(item => item.type === 'folder' && item.folderId === 'surviving-child'), 'Custom Loredeck cleanup should keep valid folder active-stack items.');
assert(prunedLibrary.activeStack.some(item => item.type === 'folder' && item.folderId === 'unrelated-empty-folder'), 'Custom Loredeck cleanup should keep unrelated empty folder active-stack items.');
assert(prunedLibrary.activeStack.some(item => item.packId === bundledPackId || item.deckId === bundledPackId), 'Custom Loredeck cleanup should keep valid bundled deck active-stack items.');
assert(!prunedLibrary.activeStack.some(item => item.folderId === 'custom-only-folder' || item.packId === 'cleanup-loredeck' || item.deckId === 'cleanup-loredeck'), 'Custom Loredeck cleanup should remove active-stack items that only point at deleted custom Loredecks.');

clock = 4000;
const totalTheme = await importExternalThemePack({
  id: 'total-theme',
  title: 'Total Theme',
  colors: { accent: '#d7b56d' },
}, options);
const totalIcon = await importExternalIconSet({
  id: 'total-icons',
  title: 'Total Icons',
  icons: {
    'tab.settings': tinyPngDataUrl,
  },
}, options);
const totalIconAsset = JSON.parse(stored.get(totalIcon.payloadFile)).icons['tab.settings'];
const untrackedReferencedFile = '/user/files/saga-total-untracked-reference.v1.json';
stored.set(untrackedReferencedFile, JSON.stringify({ kind: 'saga_untracked_reference_fixture' }));
const totalPayload = upsertExternalLorepackPayloadSync({
  packId: 'total-loredeck',
  type: 'custom',
  title: 'Total Loredeck',
  assets: {
    cover: {
      path: tinyPngDataUrl,
      alt: 'Total cover',
    },
    untrackedFixture: {
      path: untrackedReferencedFile,
      alt: 'Untracked referenced fixture',
    },
  },
  entryOverrides: {
    nami: { id: 'nami', title: 'Nami', schemaVersion: 3, content: { fact: 'Nami maps the sea.' } },
  },
}, options);
assert.equal(totalPayload.ok, true);
upsertExternalLoredeckLibraryRecordSync(createExternalLorepackLibraryRecord(totalPayload.payload), options);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
const totalStoredPayload = JSON.parse(stored.get('/user/files/saga-pack-total-loredeck.v1.json'));
const totalCoverAsset = totalStoredPayload.assets.cover.path;
const totalRepair = await writeLoredeckHealthRepairSession({
  packId: 'total-loredeck',
  sessionId: 'blocked-review',
  status: 'blocked',
  attempt: { summary: { outcome: 'blocked' } },
  diagnostics: [{ severity: 'error', code: 'fixture', message: 'Fixture issue.' }],
}, options);
assert.equal(totalRepair.ok, true);
const totalCreator = upsertExternalLoredeckCreatorProjectSync({
  jobId: 'total-creator',
  projectTitle: 'Total Creator',
  fandom: 'One Piece',
  scope: 'Arlong Park',
  generatedPackId: 'total-loredeck',
  titleDrafts: [{ id: 'nami', title: 'Nami' }],
}, options);
assert.equal(totalCreator.ok, true);
await flushSagaCreatorProjectStorageWrites();
assert.equal(stored.has('/user/files/saga-creator-project-total-creator.v1.json'), true);

const totalPreview = await buildSagaGlobalCleanupPreview(options);
assert.equal(totalPreview.themePackCount, 1);
assert.equal(totalPreview.iconSetCount, 1);
assert.equal(totalPreview.loredeckCount, 1);
assert.equal(totalPreview.creatorProjectCount, 1);
assert.equal(totalPreview.customThemePackCount, 1);
assert.equal(totalPreview.customIconSetCount, 1);
assert.equal(totalPreview.customLoredeckCount, 1);
assert.equal(totalPreview.repairSessionCount, 1, 'Total cleanup preview should count indexed repair session files.');
assert(totalPreview.trackedFileCount >= 8, 'Total cleanup preview should expose the number of files from the master index.');
assert(totalPreview.knownIndexFileCount >= 5, 'Total cleanup preview should expose known index fallback file count.');
assert(totalPreview.referencedFileCount >= 1, 'Total cleanup preview should expose files discovered from domain records and payload references.');
assert(totalPreview.untrackedReferencedFileCount >= 1, 'Total cleanup preview should count referenced files that are not already tracked by the master index.');
assert.equal(totalPreview.willClearSettings, true);
assert.equal(totalPreview.willClearApiKeys, true);
assert.equal(totalPreview.willResetActiveChat, true);
assert(totalPreview.limitations.some(text => /unknown unindexed orphan files/i.test(text)), 'Total cleanup preview should disclose unknown orphan-file limits.');
assert(totalPreview.totalSagaFileCount >= 8, 'Total cleanup preview should include tracked storage files and known index files.');

const totalCleanup = await runSagaTotalStorageCleanup(options);
assert.equal(totalCleanup.ok, true);
assert.equal(totalCleanup.failedFileCount, 0);
assert.equal(totalCleanup.masterIndexRetained, false);
assert(totalCleanup.deletedFileCount >= 8, 'Total cleanup should delete tracked payloads, assets, indexes, and repair sessions.');
for (const path of [
  totalTheme.payloadFile,
  totalIcon.payloadFile,
  totalIconAsset,
  '/user/files/saga-pack-total-loredeck.v1.json',
  totalCoverAsset,
  totalRepair.path,
  '/user/files/saga-creator-project-total-creator.v1.json',
  untrackedReferencedFile,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
  SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
  SAGA_STORAGE_INDEX_PATH,
]) {
  assert.equal(stored.has(path), false, `${path} should be deleted by Total Saga Cleanup.`);
}
assert.equal(getExternalLoredeckLibraryRegistry().packs['total-loredeck'], undefined);
assert.equal(getExternalLoredeckCreatorIndex().projects['total-creator'], undefined);
const mergedAfterTotalCleanup = getLoredeckLibraryRegistry(getDefaultState());
const bundledDefaultIds = Object.entries(DEFAULT_SETTINGS.loredeckLibrary?.packs || {})
  .filter(([, pack]) => pack?.type === 'bundled')
  .map(([packId]) => packId);
assert(bundledDefaultIds.length > 0, 'Fixture requires bundled Loredecks in default settings.');
for (const packId of bundledDefaultIds) {
  assert.equal(mergedAfterTotalCleanup.packs?.[packId]?.type, 'bundled', `Bundled Loredeck ${packId} should remain visible after Total Saga Cleanup.`);
}
const nonBundledAfterTotalCleanup = Object.entries(mergedAfterTotalCleanup.packs || {})
  .filter(([, pack]) => pack?.type !== 'bundled')
  .map(([packId]) => packId);
assert.deepEqual(nonBundledAfterTotalCleanup, [], 'Merged Library should not show custom Loredecks immediately after Total Saga Cleanup.');

clock = 5000;
const recreatedTheme = await importExternalThemePack({
  id: 'after-total-theme',
  title: 'After Total Theme',
  colors: { accent: '#ffffff' },
}, options);
assert.equal(recreatedTheme.ok, true);
assert.equal(stored.has(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes), true, 'Theme import after Total cleanup should recreate the Theme index.');
assert.equal(stored.has(SAGA_STORAGE_INDEX_PATH), true, 'Theme import after Total cleanup should recreate the master storage index.');

const recreatedPayload = upsertExternalLorepackPayloadSync({
  packId: 'after-total-loredeck',
  type: 'custom',
  title: 'After Total Loredeck',
  entryOverrides: {
    sanji: { id: 'sanji', title: 'Sanji', schemaVersion: 3, content: { fact: 'Sanji cooks at Baratie.' } },
  },
}, options);
assert.equal(recreatedPayload.ok, true);
upsertExternalLoredeckLibraryRecordSync(createExternalLorepackLibraryRecord(recreatedPayload.payload), options);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();
assert.equal(stored.has('/user/files/saga-pack-after-total-loredeck.v1.json'), true, 'Loredeck payload writes should work after Total cleanup.');
assert.equal(stored.has(SAGA_STORAGE_DOMAIN_INDEX_FILES.library), true, 'Loredeck Library writes should recreate the Library index after Total cleanup.');

deleteFailures.add('/user/files/saga-pack-after-total-loredeck.v1.json');
const partialCleanup = await runSagaTotalStorageCleanup(options);
assert.equal(partialCleanup.ok, false, 'Total cleanup should report failure when a tracked file cannot be deleted.');
assert.equal(partialCleanup.failedFileCount, 1);
assert.equal(partialCleanup.masterIndexRetained, true, 'Total cleanup should explicitly report when the master index is retained for retry.');
assert(partialCleanup.failedFiles.some(file => file.path === '/user/files/saga-pack-after-total-loredeck.v1.json'), 'Failed cleanup result should identify the undeleted tracked file.');
assert(partialCleanup.diagnostics.some(item => item.code === 'total_cleanup_master_index_retained'), 'Total cleanup should retain the master index when tracked file deletion fails.');
assert.equal(stored.has('/user/files/saga-pack-after-total-loredeck.v1.json'), true, 'Failed tracked payload should remain for retry.');
assert.equal(stored.has(SAGA_STORAGE_INDEX_PATH), true, 'Master storage index should remain after partial cleanup failure so the retry can find failed files.');

deleteFailures.clear();
const retryCleanup = await runSagaTotalStorageCleanup(options);
assert.equal(retryCleanup.ok, true, 'Total cleanup retry should succeed after the delete failure clears.');
assert.equal(stored.has('/user/files/saga-pack-after-total-loredeck.v1.json'), false, 'Retry should delete the previously failed tracked payload.');
assert.equal(stored.has(SAGA_STORAGE_INDEX_PATH), false, 'Retry should delete the master storage index after all tracked files are gone.');

console.log('Saga global cleanup tests passed.');
