import assert from 'node:assert/strict';

const {
  getExternalThemeIconSetLibraryRegistry,
  getExternalThemePackLibraryRegistry,
  hydrateSagaThemeIconStorage,
  importExternalIconSet,
  importExternalIconSetRegistry,
  importExternalIconSetZip,
  importExternalThemePack,
  importExternalThemePackRegistry,
  removeExternalIconSet,
  removeExternalThemePack,
  resetSagaThemeIconStorageCache,
} = await import('../../src/storage/saga-theme-icon-storage.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');
const {
  getIconSetLibrary,
  getIconSetPreset,
  getThemePreset,
  getThemePackLibrary,
  normalizePassiveAssetPath,
} = await import('../../src/theme/runtime-theme.js');
const {
  createStoredZipArchive,
} = await import('../../src/loredecks/loredeck-package-zip.js');

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'theme-icon-test' }),
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
      return response(true, 200, '');
    }

    if (method === 'GET') {
      if (!stored.has(url)) return response(false, 404, 'missing');
      return response(true, 200, stored.get(url));
    }

    return response(false, 404, 'unexpected request');
  },
});

resetSagaThemeIconStorageCache();
let clock = 1000;
const now = () => clock;

const themeResult = await importExternalThemePack({
  id: 'arlong-theme',
  title: 'Arlong Park',
  description: 'Externalized custom theme.',
  author: 'Saga Test',
  version: '1.0.0',
  colors: {
    background: '#120c12',
    surface: '#2b1c1c',
    accent: '#d7b56d',
    chipDanger: '#e1a0a0',
  },
  tags: ['theme:custom'],
  source: { kind: 'local', url: 'arlong.theme.json' },
}, { fileApi, now, sourceFileName: 'arlong.theme.json' });

assert.equal(themeResult.ok, true);
assert.equal(themeResult.payloadFile, '/user/files/saga-theme-pack-arlong-theme.v1.json');
assert.equal(JSON.parse(stored.get(themeResult.payloadFile)).kind, 'saga_theme_pack');
assert.equal(JSON.parse(stored.get(themeResult.payloadFile)).colors.accent, '#d7b56d');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes)).packs['arlong-theme'].payloadFile, themeResult.payloadFile);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[themeResult.payloadFile].kind, 'theme_pack_payload');
assert.equal(getExternalThemePackLibraryRegistry().packs['arlong-theme'].colors.chipDanger, '#e1a0a0');
assert(getThemePackLibrary({ themePackLibrary: { schemaVersion: 1, packs: {} } }).some(pack => pack.id === 'arlong-theme'), 'Runtime Theme Pack library should merge external storage cache.');
assert.equal(getThemePreset('arlong-theme', { themePackId: 'arlong-theme', themePackLibrary: { schemaVersion: 1, packs: {} } }).type, 'custom', 'Active external Theme Pack presets must stay custom so Settings can forget them.');

const originalThemePayload = stored.get(themeResult.payloadFile);
const originalThemeIndexRecord = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes)).packs['arlong-theme'];
const duplicateThemeResult = await importExternalThemePack({
  id: 'arlong-theme',
  title: 'Arlong Park Replacement Attempt',
  colors: {
    accent: '#ffffff',
  },
}, { fileApi, now, sourceFileName: 'arlong-replacement.theme.json' });
assert.equal(duplicateThemeResult.ok, false);
assert.equal(duplicateThemeResult.collision, true);
assert.equal(duplicateThemeResult.code, 'theme_pack_id_collision');
assert.equal(stored.get(themeResult.payloadFile), originalThemePayload, 'Rejected duplicate Theme Pack imports should not overwrite the existing payload.');
assert.deepEqual(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes)).packs['arlong-theme'], originalThemeIndexRecord, 'Rejected duplicate Theme Pack imports should not alter the domain index.');
assert.equal(getExternalThemePackLibraryRegistry().packs['arlong-theme'].title, 'Arlong Park', 'Rejected duplicate Theme Pack imports should not update the runtime cache.');

const duplicateThemeRegistryResult = await importExternalThemePackRegistry({
  schemaVersion: 1,
  packs: {
    'arlong-theme': {
      id: 'arlong-theme',
      title: 'Arlong Park Registry Replacement Attempt',
      colors: {
        accent: '#ffffff',
      },
    },
  },
}, { fileApi, now, sourceFileName: 'arlong-registry.theme.json' });
assert.equal(duplicateThemeRegistryResult.ok, true);
assert.equal(duplicateThemeRegistryResult.importedCount, 0);
assert.equal(duplicateThemeRegistryResult.skippedCount, 1);
assert.equal(duplicateThemeRegistryResult.collisionCount, 1);
assert.equal(stored.get(themeResult.payloadFile), originalThemePayload, 'Skipped duplicate Theme Pack registry imports should not overwrite the existing payload.');

const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
clock = 2000;
const iconSetResult = await importExternalIconSet({
  id: 'mystic-tabs',
  title: 'Mystic Tabs',
  preferredSize: 256,
  icons: {
    'tab.loredecks': tinyPngDataUrl,
    'tab.settings': './assets/iconsets/saga-hero/hero-tab-settings-256.png',
  },
  tags: ['icons:custom'],
}, { fileApi, now, sourceFileName: 'mystic-tabs.iconset.json' });

assert.equal(iconSetResult.ok, true);
assert.equal(iconSetResult.payloadFile, '/user/files/saga-iconset-mystic-tabs.v1.json');
const iconPayload = JSON.parse(stored.get(iconSetResult.payloadFile));
const uploadedIconPath = iconPayload.icons['tab.loredecks'];
assert.match(uploadedIconPath, /^\/user\/files\/saga-iconset-asset-mystic-tabs-tab-loredecks-[a-f0-9]+\.png$/);
assert.equal(normalizePassiveAssetPath(uploadedIconPath), uploadedIconPath);
assert.equal(iconPayload.icons['tab.settings'], './assets/iconsets/saga-hero/hero-tab-settings-256.png');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets)).iconSets['mystic-tabs'].payloadFile, iconSetResult.payloadFile);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[uploadedIconPath].kind, 'iconset_asset');
assert.equal(getExternalThemeIconSetLibraryRegistry().iconSets['mystic-tabs'].icons['tab.loredecks'], uploadedIconPath);
assert(getIconSetLibrary({ themeIconSetLibrary: { schemaVersion: 1, iconSets: {} } }).some(iconSet => iconSet.id === 'mystic-tabs'), 'Runtime Icon Set library should merge external storage cache.');
assert.equal(getIconSetPreset('mystic-tabs', { themeIconSetId: 'mystic-tabs', themeIconSetLibrary: { schemaVersion: 1, iconSets: {} } }).type, 'custom', 'Active external Icon Set presets must stay custom so Settings can forget them.');

const originalIconSetPayload = stored.get(iconSetResult.payloadFile);
const originalIconSetIndexRecord = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets)).iconSets['mystic-tabs'];
const iconUploadCountBeforeDuplicate = calls.filter(call => call.url === '/api/files/upload').length;
const duplicateIconSetResult = await importExternalIconSet({
  id: 'mystic-tabs',
  title: 'Mystic Tabs Replacement Attempt',
  preferredSize: 256,
  icons: {
    'tab.loredecks': tinyPngDataUrl,
  },
}, { fileApi, now, sourceFileName: 'mystic-tabs-replacement.iconset.json' });
assert.equal(duplicateIconSetResult.ok, false);
assert.equal(duplicateIconSetResult.collision, true);
assert.equal(duplicateIconSetResult.code, 'iconset_id_collision');
assert.equal(calls.filter(call => call.url === '/api/files/upload').length, iconUploadCountBeforeDuplicate, 'Rejected duplicate Icon Set imports should not upload replacement assets.');
assert.equal(stored.get(iconSetResult.payloadFile), originalIconSetPayload, 'Rejected duplicate Icon Set imports should not overwrite the existing payload.');
assert.deepEqual(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets)).iconSets['mystic-tabs'], originalIconSetIndexRecord, 'Rejected duplicate Icon Set imports should not alter the domain index.');
assert.equal(getExternalThemeIconSetLibraryRegistry().iconSets['mystic-tabs'].title, 'Mystic Tabs', 'Rejected duplicate Icon Set imports should not update the runtime cache.');

const duplicateIconSetRegistryResult = await importExternalIconSetRegistry({
  schemaVersion: 1,
  iconSets: {
    'mystic-tabs': {
      id: 'mystic-tabs',
      title: 'Mystic Tabs Registry Replacement Attempt',
      preferredSize: 256,
      icons: {
        'tab.loredecks': tinyPngDataUrl,
      },
    },
  },
}, { fileApi, now, sourceFileName: 'mystic-tabs-registry.iconset.json' });
assert.equal(duplicateIconSetRegistryResult.ok, true);
assert.equal(duplicateIconSetRegistryResult.importedCount, 0);
assert.equal(duplicateIconSetRegistryResult.skippedCount, 1);
assert.equal(duplicateIconSetRegistryResult.collisionCount, 1);
assert.equal(calls.filter(call => call.url === '/api/files/upload').length, iconUploadCountBeforeDuplicate, 'Skipped duplicate Icon Set registry imports should not upload replacement assets.');
assert.equal(stored.get(iconSetResult.payloadFile), originalIconSetPayload, 'Skipped duplicate Icon Set registry imports should not overwrite the existing payload.');

const iconRemoval = await removeExternalIconSet('mystic-tabs', { fileApi, now });
assert.equal(iconRemoval.ok, true);
assert.equal(stored.has(iconSetResult.payloadFile), false);
assert.equal(stored.has(uploadedIconPath), false);
assert.equal(getExternalThemeIconSetLibraryRegistry().iconSets['mystic-tabs'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets)).iconSets['mystic-tabs'], undefined);
assert(calls.some(call => call.url === '/api/files/delete' && call.body.path === uploadedIconPath), 'Icon Set removal should delete uploaded icon assets.');

clock = 2500;
const zipBytes = await createStoredZipArchive([
  {
    path: 'saga-iconset.json',
    data: JSON.stringify({
      schemaVersion: 1,
      id: 'zip-tabs',
      title: 'Zip Tabs',
      preferredSize: 256,
      icons: {
        'tab.loredecks': 'icons/tab-loredecks.png',
        'tab.settings': './icons/tab-settings.webp',
      },
    }),
  },
  { path: 'icons/tab-loredecks.png', data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) },
  { path: 'icons/tab-settings.webp', data: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]) },
]);
const zipImport = await importExternalIconSetZip(zipBytes, {
  fileApi,
  now,
  sourceFileName: 'zip-tabs.saga-iconset.zip',
});
assert.equal(zipImport.ok, true);
assert.equal(zipImport.payloadFile, '/user/files/saga-iconset-zip-tabs.v1.json');
const zipPayload = JSON.parse(stored.get(zipImport.payloadFile));
assert.match(zipPayload.icons['tab.loredecks'], /^\/user\/files\/saga-iconset-asset-zip-tabs-tab-loredecks-[a-f0-9]+\.png$/);
assert.match(zipPayload.icons['tab.settings'], /^\/user\/files\/saga-iconset-asset-zip-tabs-tab-settings-[a-f0-9]+\.webp$/);
assert.equal(zipPayload.source.kind, 'local_zip');
assert.equal(zipPayload.source.importedFrom, 'zip-tabs.saga-iconset.zip');

const originalZipPayload = stored.get(zipImport.payloadFile);
const zipUploadCountBeforeDuplicate = calls.filter(call => call.url === '/api/files/upload').length;
const duplicateZipImport = await importExternalIconSetZip(zipBytes, {
  fileApi,
  now,
  sourceFileName: 'zip-tabs-duplicate.saga-iconset.zip',
});
assert.equal(duplicateZipImport.ok, false);
assert.equal(duplicateZipImport.collision, true);
assert.equal(duplicateZipImport.code, 'iconset_id_collision');
assert.equal(calls.filter(call => call.url === '/api/files/upload').length, zipUploadCountBeforeDuplicate, 'Rejected duplicate Icon Set zip imports should not upload replacement assets.');
assert.equal(stored.get(zipImport.payloadFile), originalZipPayload, 'Rejected duplicate Icon Set zip imports should not overwrite the existing payload.');

resetSagaThemeIconStorageCache();
clock = 3000;
await hydrateSagaThemeIconStorage({ fileApi, now, force: true });
assert.equal(getExternalThemePackLibraryRegistry().packs['arlong-theme'].title, 'Arlong Park');
assert.equal(getExternalThemeIconSetLibraryRegistry().iconSets['zip-tabs'].icons['tab.loredecks'], zipPayload.icons['tab.loredecks']);

clock = 4000;
const removal = await removeExternalThemePack('arlong-theme', { fileApi, now });
assert.equal(removal.ok, true);
assert.equal(stored.has(themeResult.payloadFile), false);
assert.equal(getExternalThemePackLibraryRegistry().packs['arlong-theme'], undefined);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes)).packs['arlong-theme'], undefined);
assert(calls.some(call => call.url === '/api/files/delete' && call.body.path === themeResult.payloadFile), 'Theme Pack removal should delete the payload file.');

const failingStored = new Map();
const failingCalls = [];
function createFailingThemeIconFileApi(failingIndexFileName) {
  return createSagaFileApi({
    getRequestHeaders: () => ({ 'X-CSRF-Token': 'theme-icon-failure-test' }),
    fetchImpl: async (url, init = {}) => {
      const method = init.method || 'GET';
      const body = init.body ? JSON.parse(init.body) : null;
      failingCalls.push({ url, method, body });

      if (url === '/api/files/upload' && method === 'POST') {
        if (body.name === failingIndexFileName) {
          return response(false, 500, JSON.stringify({ error: `${failingIndexFileName} write failed` }));
        }
        const path = `/user/files/${body.name}`;
        failingStored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
        return response(true, 200, JSON.stringify({ path }));
      }

      if (url === '/api/files/delete' && method === 'POST') {
        failingStored.delete(body.path);
        return response(true, 200, JSON.stringify({ ok: true }));
      }

      if (url === '/api/files/verify' && method === 'POST') {
        return response(true, 200, JSON.stringify(Object.fromEntries((body.urls || []).map(path => [path, failingStored.has(path)]))));
      }

      if (method === 'GET') {
        if (!failingStored.has(url)) return response(false, 404, 'missing');
        return response(true, 200, failingStored.get(url));
      }

      return response(false, 404, 'unexpected request');
    },
  });
}

resetSagaThemeIconStorageCache();
clock = 5000;
const failingThemeFileApi = createFailingThemeIconFileApi('saga-theme-index.v1.json');
await assert.rejects(
  importExternalThemePack({
    id: 'failed-theme',
    title: 'Failed Theme',
    colors: { accent: '#d7b56d' },
  }, { fileApi: failingThemeFileApi, now }),
  /saga-theme-index\.v1\.json write failed/,
);
assert.equal(failingStored.has('/user/files/saga-theme-pack-failed-theme.v1.json'), false, 'Failed Theme Pack index writes should roll back the payload file.');
let failingMasterIndex = JSON.parse(failingStored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(failingMasterIndex.files['/user/files/saga-theme-pack-failed-theme.v1.json'], undefined, 'Failed Theme Pack cleanup should unregister the payload file from the master index.');
assert.equal(getExternalThemePackLibraryRegistry().packs['failed-theme'], undefined, 'Failed Theme Pack imports should not update the runtime cache.');

resetSagaThemeIconStorageCache();
failingStored.clear();
failingCalls.length = 0;
clock = 6000;
const failingIconFileApi = createFailingThemeIconFileApi('saga-iconset-index.v1.json');
await assert.rejects(
  importExternalIconSet({
    id: 'failed-icons',
    title: 'Failed Icons',
    preferredSize: 256,
    icons: {
      'tab.loredecks': tinyPngDataUrl,
    },
  }, { fileApi: failingIconFileApi, now }),
  /saga-iconset-index\.v1\.json write failed/,
);
const failedIconPayloadPath = '/user/files/saga-iconset-failed-icons.v1.json';
assert.equal(failingStored.has(failedIconPayloadPath), false, 'Failed Icon Set index writes should roll back the payload file.');
const failedUploadedIconPath = failingCalls
  .filter(call => call.url === '/api/files/delete')
  .map(call => call.body.path)
  .find(path => /^\/user\/files\/saga-iconset-asset-failed-icons-tab-loredecks-[a-f0-9]+\.png$/.test(path));
assert.ok(failedUploadedIconPath, 'Failed Icon Set cleanup should delete uploaded raster assets.');
assert.equal(failingStored.has(failedUploadedIconPath), false);
failingMasterIndex = JSON.parse(failingStored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(failingMasterIndex.files[failedIconPayloadPath], undefined, 'Failed Icon Set cleanup should unregister the payload file from the master index.');
assert.equal(failingMasterIndex.files[failedUploadedIconPath], undefined, 'Failed Icon Set cleanup should unregister raster assets from the master index.');
assert.equal(getExternalThemeIconSetLibraryRegistry().iconSets['failed-icons'], undefined, 'Failed Icon Set imports should not update the runtime cache.');

console.log('Saga Theme/Icon external storage tests passed.');
