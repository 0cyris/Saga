import assert from 'node:assert/strict';

const {
  assertSagaUserFilesPath,
  buildSagaAssetStorageFileName,
  buildSagaIndexStorageFileName,
  buildSagaJsonStorageFileName,
  getSagaUserFilesFileName,
  toSagaUserFilesPath,
  validateSagaStorageFileName,
  validateSagaUserFilesPath,
} = await import('../../src/storage/saga-storage-filenames.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');

assert.equal(buildSagaIndexStorageFileName('library'), 'saga-library-index.v1.json');
assert.equal(buildSagaJsonStorageFileName('pack', 'One Piece: Arlong Park Custom'), 'saga-pack-one-piece-arlong-park-custom.v1.json');
assert.equal(
  buildSagaAssetStorageFileName('pack', 'one-piece-arlong-park-custom', 'cover', 'png', { hash: 'A83F21C2' }),
  'saga-pack-asset-one-piece-arlong-park-custom-cover-a83f21c2.png',
);
assert.equal(
  buildSagaAssetStorageFileName('iconset', 'Mystic Tabs', 'tab/loredecks', 'webp', { hash: '4db912ee' }),
  'saga-iconset-asset-mystic-tabs-tab-loredecks-4db912ee.webp',
);
assert.equal(toSagaUserFilesPath('saga-library-index.v1.json'), '/user/files/saga-library-index.v1.json');
assert.equal(getSagaUserFilesFileName('/user/files/saga-library-index.v1.json'), 'saga-library-index.v1.json');
assert.equal(assertSagaUserFilesPath('/user/files/saga-library-index.v1.json'), '/user/files/saga-library-index.v1.json');

assert.equal(validateSagaStorageFileName('saga-library-index.v1.json').ok, true);
assert.equal(validateSagaStorageFileName('library-index.v1.json').ok, false, 'storage filenames must be saga-prefixed');
assert.equal(validateSagaStorageFileName('saga/library-index.v1.json').ok, false, 'storage filenames must be flat');
assert.equal(validateSagaStorageFileName('.saga-library-index.v1.json').ok, false, 'storage filenames cannot start with dot');
assert.equal(validateSagaStorageFileName('saga-library-index.v1.js').ok, false, 'storage filenames block executable extensions');
assert.equal(validateSagaUserFilesPath('/img/saga-library-index.v1.json').ok, false, 'storage paths must be under /user/files/');
assert.throws(() => buildSagaAssetStorageFileName('pack', 'deck', 'cover', 'svg'), /not allowed/);

const roundTripText = 'Saga storage round trip';
const encoded = __sagaFileApiTestHooks.utf8ToBase64(roundTripText);
assert.equal(__sagaFileApiTestHooks.base64ToUtf8(encoded), roundTripText);

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

const api = createSagaFileApi({
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'test-token' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method, headers: init.headers || {}, body });

    if (url === '/api/files/upload' && method === 'POST') {
      if (body.name === 'saga-fail.v1.json') {
        return response(false, 500, JSON.stringify({ message: 'upload failed' }));
      }
      stored.set(`/user/files/${body.name}`, __sagaFileApiTestHooks.base64ToUtf8(body.data));
      return response(true, 200, JSON.stringify({ path: `/user/files/${body.name}` }));
    }

    if (url === '/api/files/verify' && method === 'POST') {
      const result = {};
      for (const path of body.urls || []) result[path] = stored.has(path);
      return response(true, 200, JSON.stringify(result));
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

const writeResult = await api.writeJsonFile('saga-library-index.v1.json', { schemaVersion: 1, kind: 'saga_library_index' });
assert.deepEqual(writeResult, {
  path: '/user/files/saga-library-index.v1.json',
  fileName: 'saga-library-index.v1.json',
});
assert.equal(calls[0].url, '/api/files/upload');
assert.equal(calls[0].headers['X-CSRF-Token'], 'test-token');
assert.equal(calls[0].headers['Content-Type'], 'application/json');
assert.equal(JSON.parse(stored.get('/user/files/saga-library-index.v1.json')).kind, 'saga_library_index');

const loaded = await api.readJsonFile('/user/files/saga-library-index.v1.json');
assert.equal(loaded.schemaVersion, 1);
assert.equal(loaded.kind, 'saga_library_index');

const verified = await api.verifyFiles([
  '/user/files/saga-library-index.v1.json',
  '/user/files/saga-library-index.v1.json',
]);
assert.equal(verified['/user/files/saga-library-index.v1.json'], true);
const verifyCall = calls.find(call => call.url === '/api/files/verify');
assert.equal(verifyCall.body.urls.length, 1, 'verify should dedupe paths before calling the API');

await api.deleteFile('/user/files/saga-library-index.v1.json');
const verifiedAfterDelete = await api.verifyFiles(['/user/files/saga-library-index.v1.json']);
assert.equal(verifiedAfterDelete['/user/files/saga-library-index.v1.json'], false);

await assert.rejects(() => api.writeJsonFile('saga-library/index.v1.json', {}), /flat/);
await assert.rejects(() => api.readJsonFile('/img/saga-library-index.v1.json'), /under \/user\/files/);
await assert.rejects(async () => {
  await api.writeJsonFile('saga-fail.v1.json', {});
}, error => {
  assert.equal(error.status, 500);
  assert.equal(error.message, 'upload failed');
  return true;
});

console.log('Saga storage foundation tests passed.');
