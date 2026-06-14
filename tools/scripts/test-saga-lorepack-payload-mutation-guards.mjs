import assert from 'node:assert/strict';

const { MODULE_KEY, SCHEMA_VERSION, DEFAULT_SETTINGS } = await import('../../src/state/constants.js');
const {
  configureLoredeckLibraryStore,
  getLoredeckLibraryRegistry,
  upsertLoredeckLibraryPack,
} = await import('../../src/state/loredeck-library-store.js');
const {
  resetSagaLorepackLibraryStorageCache,
  upsertExternalLoredeckLibraryRecordSync,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  hydrateExternalLorepackPayloadRecord,
  resetSagaLorepackPayloadStorageCache,
  upsertExternalLorepackPayloadSync,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');

let settings = {
  loredeckLibrary: DEFAULT_SETTINGS.loredeckLibrary,
  loredeckCreatorProjects: DEFAULT_SETTINGS.loredeckCreatorProjects,
};
let state = {
  _version: SCHEMA_VERSION,
  loredeckRegistry: { schemaVersion: 1, packs: {} },
  loredeckCreator: { schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: {} },
};
let saveSettingsCount = 0;
let saveStateCount = 0;

configureLoredeckLibraryStore({
  getState: () => state,
  saveState: next => {
    state = next;
    saveStateCount += 1;
  },
  getSettings: () => settings,
  saveSettings: next => {
    settings = next;
    saveSettingsCount += 1;
  },
  getDefaultState: () => ({
    loredeckCreator: { schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: {} },
  }),
});

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings: { [MODULE_KEY]: settings },
      chatMetadata: { [MODULE_KEY]: state },
      saveSettingsDebounced() {},
      saveMetadata() {},
    };
  },
};

resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();

const payloadResult = upsertExternalLorepackPayloadSync({
  packId: 'payload-guard-pack',
  type: 'custom',
  title: 'Payload Guard Pack',
  manifestData: {
    id: 'payload-guard-pack',
    title: 'Payload Guard Pack',
    entrySchemaVersion: 3,
    files: [],
  },
  entryOverrides: {
    guard: {
      id: 'guard',
      schemaVersion: 3,
      title: 'Guard Entry',
      content: { fact: 'The payload content must survive compact row saves.' },
    },
  },
}, { persistWrites: false, now: 1000 });
assert.equal(payloadResult.ok, true);
const compactRecord = payloadResult.libraryRecord;
assert.equal(compactRecord.entryOverrides, undefined);
assert.equal(compactRecord.payloadFile, '/user/files/saga-pack-payload-guard-pack.v1.json');
upsertExternalLoredeckLibraryRecordSync(compactRecord, { persistWrites: false, now: 1000 });

resetSagaLorepackPayloadStorageCache();
const compactRegistry = getLoredeckLibraryRegistry(state);
assert.equal(compactRegistry.packs['payload-guard-pack'].payloadFile, compactRecord.payloadFile);
assert.deepEqual(compactRegistry.packs['payload-guard-pack'].entryOverrides, {});

const staleSave = upsertLoredeckLibraryPack({
  ...compactRegistry.packs['payload-guard-pack'],
  title: 'Stale Compact Rename',
});
assert.equal(staleSave.ok, false);
assert.equal(staleSave.code, 'payload_not_loaded');

upsertExternalLorepackPayloadSync({
  ...payloadResult.payload,
  title: 'Payload Guard Pack',
}, { persistWrites: false, now: 2000 });
const hydrated = await hydrateExternalLorepackPayloadRecord(compactRecord);
assert.equal(hydrated.entryOverrides.guard.content.fact, 'The payload content must survive compact row saves.');

const hydratedSave = upsertLoredeckLibraryPack({
  ...hydrated,
  title: 'Hydrated Rename',
});
assert.equal(hydratedSave.ok, true);
assert.equal(hydratedSave.pack.title, 'Hydrated Rename');
assert.equal(hydratedSave.pack.entryOverrides.guard.title, 'Guard Entry');

const pendingChange = {
  schemaVersion: 1,
  changeId: 'payload-guard-pending-clear',
  status: 'pending',
  source: 'test',
  action: 'record_patch',
  targetKind: 'entry',
  title: 'Payload guard pending clear',
  description: '',
  affectedEntryIds: ['guard'],
  payload: {
    entryOverrides: {
      guard: hydratedSave.pack.entryOverrides.guard,
    },
  },
  preview: {},
  createdAt: 3000,
  updatedAt: 3000,
};
upsertExternalLorepackPayloadSync({
  ...hydratedSave.pack,
  pendingChanges: [pendingChange],
}, { persistWrites: false, now: 3000 });
const hydratedWithPending = await hydrateExternalLorepackPayloadRecord(compactRecord);
assert.equal(hydratedWithPending.pendingChanges.length, 1);

const clearedPendingSave = upsertLoredeckLibraryPack({
  ...hydratedWithPending,
  pendingChanges: [],
});
assert.equal(clearedPendingSave.ok, true);
assert.deepEqual(clearedPendingSave.pack.pendingChanges, [], 'Explicit empty pendingChanges must clear cached external payload proposals.');
const hydratedAfterClear = await hydrateExternalLorepackPayloadRecord(compactRecord);
assert.deepEqual(hydratedAfterClear.pendingChanges, [], 'Hydrating after a clear must not resurrect cached pending changes.');

assert.equal(saveSettingsCount, 0, 'External payload saves should not write full Loredeck content to settings.');
assert.equal(saveStateCount, 0, 'External payload saves should not require chat metadata writes.');

console.log('Saga Lorepack payload mutation guard tests passed.');
