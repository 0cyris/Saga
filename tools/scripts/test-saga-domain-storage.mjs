import assert from 'node:assert/strict';

const {
  buildSagaDomainPayloadFileName,
  buildSagaDomainPayloadPath,
  createSagaDomainIndex,
  createSagaDomainStorage,
  getSagaDomainIndexFileName,
  getSagaDomainStorageConfig,
  normalizeSagaDomainIndex,
  removeSagaDomainIndexRecord,
  SAGA_DOMAIN_STORAGE_CONFIGS,
  upsertSagaDomainIndexRecord,
} = await import('../../src/storage/saga-domain-storage.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
  SAGA_STORAGE_INDEX_PATH,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');

assert.equal(getSagaDomainStorageConfig('theme').domain, 'themes');
assert.equal(getSagaDomainStorageConfig('icon_sets').domain, 'iconSets');
assert.equal(SAGA_DOMAIN_STORAGE_CONFIGS.themes.indexKind, 'saga_theme_index');
assert.equal(getSagaDomainIndexFileName('themes'), 'saga-theme-index.v1.json');
assert.equal(buildSagaDomainPayloadFileName('themes', 'Custom Theme'), 'saga-theme-pack-custom-theme.v1.json');
assert.equal(buildSagaDomainPayloadPath('iconSets', 'Mystic Tabs'), '/user/files/saga-iconset-mystic-tabs.v1.json');

const themeIndex = createSagaDomainIndex('themes', { now: 1000 });
assert.equal(themeIndex.kind, 'saga_theme_index');
assert.equal(themeIndex.revision, 1);
assert.deepEqual(themeIndex.packs, {});

const normalized = normalizeSagaDomainIndex('themes', {
  kind: 'wrong',
  createdAt: 'bad',
  updatedAt: 2000,
  revision: -1,
  packs: {
    'bad-record': null,
    'Arlong Theme': {
      id: 'Arlong Theme',
      title: 'Arlong Park',
      payloadFile: '/user/files/saga-theme-pack-arlong-theme.v1.json',
      coverFile: '/img/not-owned.png',
      assetFiles: ['/user/files/saga-theme-asset-arlong-cover-a83f21c2.png', '/img/not-owned.png'],
    },
  },
}, { now: 2000 });
assert.equal(normalized.kind, 'saga_theme_index');
assert.equal(normalized.revision, 1);
assert.equal(normalized.packs['arlong-theme'].themeId, 'arlong-theme');
assert.equal(normalized.packs['arlong-theme'].payloadFile, '/user/files/saga-theme-pack-arlong-theme.v1.json');
assert.equal(normalized.packs['arlong-theme'].coverFile, undefined);
assert.deepEqual(normalized.packs['arlong-theme'].assetFiles, ['/user/files/saga-theme-asset-arlong-cover-a83f21c2.png']);

const withRecord = upsertSagaDomainIndexRecord('iconSets', createSagaDomainIndex('iconSets', { now: 1000 }), {
  id: 'Mystic Tabs',
  title: 'Mystic Tabs',
  payloadFile: '/user/files/saga-iconset-mystic-tabs.v1.json',
  icons: {
    loredecks: '/user/files/saga-iconset-asset-mystic-tabs-loredecks-a83f21c2.png',
  },
}, { now: 2000 });
assert.equal(withRecord.revision, 2);
assert.equal(withRecord.iconSets['mystic-tabs'].iconSetId, 'mystic-tabs');
const withoutRecord = removeSagaDomainIndexRecord('iconSets', withRecord, 'Mystic Tabs', { now: 3000 });
assert.equal(withoutRecord.revision, 3);
assert.deepEqual(withoutRecord.iconSets, {});

const calls = [];
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'domain-test' }),
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

    if (method === 'GET') {
      if (!stored.has(url)) return response(false, 404, 'missing');
      return response(true, 200, stored.get(url));
    }

    return response(false, 404, 'unexpected request');
  },
});

let clock = 4000;
const domainStorage = createSagaDomainStorage({ fileApi, now: () => clock });
const payloadWrite = await domainStorage.writePayload('themes', 'Arlong Theme', {
  schemaVersion: 1,
  id: 'arlong-theme',
  title: 'Arlong Park',
  colors: { accent: '#d7b56d' },
});
assert.equal(payloadWrite.fileName, 'saga-theme-pack-arlong-theme.v1.json');
assert.equal(JSON.parse(stored.get('/user/files/saga-theme-pack-arlong-theme.v1.json')).title, 'Arlong Park');
assert(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-theme-pack-arlong-theme.v1.json'], 'Payload write should register in the master storage index.');

clock = 5000;
const indexWrite = await domainStorage.upsertRecord('themes', {
  id: 'Arlong Theme',
  title: 'Arlong Park',
  payloadFile: payloadWrite.path,
});
assert.equal(indexWrite.fileName, 'saga-theme-index.v1.json');
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes)).packs['arlong-theme'].payloadFile, payloadWrite.path);
assert(JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH)).files[SAGA_STORAGE_DOMAIN_INDEX_FILES.themes], 'Domain index write should register in the master storage index.');

const loadedIndex = await domainStorage.readDomainIndex('themes');
assert.equal(loadedIndex.packs['arlong-theme'].title, 'Arlong Park');
const masterIndex = await domainStorage.readMasterIndex();
assert.equal(masterIndex.files[SAGA_STORAGE_DOMAIN_INDEX_FILES.themes].kind, 'theme_index');
assert(calls.some(call => call.url === '/api/files/upload' && call.body.name === 'saga-storage-index.v1.json'), 'Master index must be written through the files API.');

console.log('Saga domain storage tests passed.');
