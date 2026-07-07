import assert from 'node:assert/strict';

const {
  buildLoredeckHealthReport,
  configureLoredeckHealthPanel,
} = await import('../../src/loredecks/loredeck-health-panel.js');
const {
  configureSagaLorepackPayloadStorage,
  flushSagaLorepackPayloadStorageWrites,
  resetSagaLorepackPayloadStorageCache,
  upsertExternalLorepackPayloadSync,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-panel-test' }),
  fetchImpl: async (url, init = {}) => {
    const method = init.method || 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    if (url === '/api/files/upload' && method === 'POST') {
      const path = `/user/files/${body.name}`;
      stored.set(path, __sagaFileApiTestHooksBase64ToUtf8(body.data));
      return response(true, 200, JSON.stringify({ path }));
    }
    if (url === '/api/files/delete' && method === 'POST') {
      stored.delete(body.path);
      return response(true, 200, JSON.stringify({ ok: true }));
    }
    if (method === 'GET') {
      if (!stored.has(url)) return response(false, 404, 'missing');
      return response(true, 200, stored.get(url));
    }
    if (url === '/api/files/verify' && method === 'POST') {
      return response(true, 200, JSON.stringify(Object.fromEntries((body.urls || []).map(path => [path, stored.has(path)]))));
    }
    return response(false, 404, 'unexpected request');
  },
});

function __sagaFileApiTestHooksBase64ToUtf8(data) {
  return Buffer.from(String(data || ''), 'base64').toString('utf8');
}

resetSagaLorepackPayloadStorageCache();
configureSagaLorepackPayloadStorage({ fileApi, now: () => 1000 });

const withOverrides = upsertExternalLorepackPayloadSync({
  packId: 'arlong-duplicate',
  type: 'custom',
  title: 'Arlong Duplicate',
  derivedFrom: { packId: 'arlong-park-core' },
  manifestData: { id: 'arlong-duplicate', title: 'Arlong Duplicate', entrySchemaVersion: 3, files: [] },
  entryOverrides: {
    nami: { id: 'nami', title: 'Nami', schemaVersion: 3, content: { fact: 'Nami bargains with Arlong.' } },
  },
});
assert.equal(withOverrides.ok, true);
assert.equal(withOverrides.libraryRecord.entryOverrides, undefined, 'Compact library record must not retain inline entryOverrides.');

const empty = upsertExternalLorepackPayloadSync({
  packId: 'arlong-empty-duplicate',
  type: 'custom',
  title: 'Arlong Empty Duplicate',
  derivedFrom: { packId: 'arlong-park-core' },
  manifestData: { id: 'arlong-empty-duplicate', title: 'Arlong Empty Duplicate', entrySchemaVersion: 3, files: [] },
});
assert.equal(empty.ok, true);

await flushSagaLorepackPayloadStorageWrites();

const state = {
  loredeckStack: [
    { packId: 'arlong-duplicate', enabled: true, priority: 100, addedAt: 0 },
    { packId: 'arlong-empty-duplicate', enabled: true, priority: 90, addedAt: 0 },
  ],
};
const library = [withOverrides.libraryRecord, empty.libraryRecord];

configureLoredeckHealthPanel({
  getState: () => state,
  getLoredeckLibrary: () => library,
  getLoredeckStack: s => s.loredeckStack.filter(item => item.enabled),
  getLoredeckLibraryIndexForPacks: () => ({ folders: [], packs: {} }),
  resolveLoredeckStackItems: stackItems => ({ stack: stackItems }),
  getLoredeckTypeLabel: () => 'Custom',
});

const report = buildLoredeckHealthReport(state, { loredecks: [] }, null);

assert.ok(
  !report.insights.some(issue => issue.code === 'custom_duplicate_has_no_entry_changes' && issue.packId === 'arlong-duplicate'),
  'A payload-backed duplicate with real overrides should not be flagged as having no entry changes.',
);
assert.ok(
  report.insights.some(issue => issue.code === 'custom_duplicate_has_no_entry_changes' && issue.packId === 'arlong-empty-duplicate'),
  'A genuinely empty payload-backed duplicate should still be flagged as having no entry changes.',
);

console.log('Loredeck health panel duplicate payload hydration tests passed.');
