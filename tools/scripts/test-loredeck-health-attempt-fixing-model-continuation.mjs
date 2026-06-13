import assert from 'node:assert/strict';

const {
  attemptLoredeckHealthFixes,
} = await import('../../src/loredecks/loredeck-health-attempt-fixing.js');
const {
  cancelLoredeckHealthRepairRun,
  configureLoredeckEditorActions,
  continueLoredeckHealthModelRepairSession,
  getLoredeckHealthRepairActiveRun,
  repairLoredeckSafeHealthIssues,
} = await import('../../src/runtime/loredeck-editor-actions.js');
const {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
} = await import('../../src/loredecks/loredeck-health-repair-contracts.js');
const {
  configureLoredeckHealthRepairSessionStorage,
  readLoredeckHealthRepairSession,
} = await import('../../src/loredecks/loredeck-health-repair-session-storage.js');
const {
  getExternalLoredeckLibraryRegistry,
  configureSagaLorepackLibraryStorage,
  flushSagaLorepackLibraryStorageWrites,
  hydrateSagaLorepackLibraryStorage,
  resetSagaLorepackLibraryStorageCache,
  upsertExternalLoredeckLibraryRecordSync,
} = await import('../../src/storage/saga-lorepack-library-storage.js');
const {
  configureSagaLorepackPayloadStorage,
  flushSagaLorepackPayloadStorageWrites,
  resetSagaLorepackPayloadStorageCache,
  upsertExternalLorepackPayloadSync,
} = await import('../../src/storage/saga-lorepack-payload-storage.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
  createSagaFileApi,
} = await import('../../src/storage/saga-file-api.js');
const {
  buildModelRepairPack,
  cloneRepairFixture,
} = await import('./loredeck-health-repair-test-fixtures.mjs');

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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-attempt-model-continuation-test' }),
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

let clock = 1000;
const now = () => clock;
const storageOptions = { fileApi, now };

function configureStorage() {
  configureSagaLorepackLibraryStorage(storageOptions);
  configureSagaLorepackPayloadStorage(storageOptions);
  configureLoredeckHealthRepairSessionStorage(storageOptions);
}

function retargetPack(pack, packId, title) {
  pack.packId = packId;
  pack.id = packId;
  pack.title = title;
  pack.type = 'custom';
  if (pack.manifestData) {
    pack.manifestData.id = packId;
    pack.manifestData.title = title;
  }
  return pack;
}

async function persistExternalPack(pack) {
  const payloadResult = upsertExternalLorepackPayloadSync(pack, storageOptions);
  assert.equal(payloadResult.ok, true);
  const libraryResult = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, storageOptions);
  assert.equal(libraryResult.ok, true);
  await flushSagaLorepackPayloadStorageWrites();
  await flushSagaLorepackLibraryStorageWrites();
  return payloadResult.libraryRecord.payloadFile;
}

function getFreshPack(packId, fallback = null) {
  return getExternalLoredeckLibraryRegistry().packs?.[String(packId || '').trim()] || fallback;
}

function buildDirectModelResponse({ pack, unit }) {
  return JSON.stringify({
    repairs: unit.entryIds.map((entryId, index) => {
      const entry = cloneRepairFixture(pack.entryOverrides[entryId]);
      entry.content = {
        fact: `Recovered action-level fact for ${entry.title || entryId}.`,
        injection: `When ${entry.title || entryId} is relevant, use this action-level repaired content.`,
      };
      return {
        repairId: `repair_action_content_${index + 1}`,
        findingIds: unit.findingIds,
        confidence: 0.94,
        risk: 'low',
        applyMode: 'direct',
        patch: {
          operations: [{
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
            entryId,
            fields: ['content'],
            entry,
          }],
        },
      };
    }),
    choices: [],
    warnings: [],
    clarifyingQuestions: [],
  });
}

configureStorage();
resetSagaLorepackLibraryStorageCache();
resetSagaLorepackPayloadStorageCache();
configureStorage();

const pack = retargetPack(buildModelRepairPack(), 'attempt-model-continuation-pack', 'Attempt Model Continuation Pack');
const payloadFile = await persistExternalPack(pack);
const sessionPack = retargetPack(buildModelRepairPack(), 'continue-model-session-pack', 'Continue Model Session Pack');
const sessionPayloadFile = await persistExternalPack(sessionPack);
const cancelPack = retargetPack(buildModelRepairPack(), 'cancel-model-session-pack', 'Cancel Model Session Pack');
const cancelPayloadFile = await persistExternalPack(cancelPack);

resetSagaLorepackPayloadStorageCache();
resetSagaLorepackLibraryStorageCache();
configureStorage();
clock = 2000;
await hydrateSagaLorepackLibraryStorage({ ...storageOptions, force: true });

const toasts = [];
let requestCount = 0;
configureLoredeckEditorActions({
  getFreshLoredeckLibraryPack: getFreshPack,
  clearCanonLoreDatabaseCache: () => {},
  clearContextIndexCache: () => {},
  deleteLoredeckManifestPreviewCacheRecord: () => {},
  deleteLoredeckEntryPreviewCacheRecord: () => {},
  deleteLoredeckTimelineRegistryCacheRecord: () => {},
  deleteLoredeckTagRegistryCacheRecord: () => {},
  refreshLoredeckSurfaces: () => {},
  toast: (message, type = 'info') => toasts.push({ message, type }),
  requestLoredeckHealthModelRepair: async context => {
    requestCount += 1;
    assert.equal(context.promptPayload.allowedFields.includes('content'), true);
    assert.equal(context.promptPayload.targetEntries.length, 1);
    return buildDirectModelResponse(context);
  },
});

const compactPack = getFreshPack('attempt-model-continuation-pack');
assert.equal(compactPack.payloadFile, payloadFile);
assert.equal(Object.keys(compactPack.entryOverrides || {}).length, 0);

const repaired = await repairLoredeckSafeHealthIssues(compactPack);
assert.equal(repaired, true);
assert.equal(requestCount, 1);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const repairedPayload = JSON.parse(stored.get(payloadFile));
assert.equal(repairedPayload.healthStatus, 'good');
assert.match(repairedPayload.entryOverrides['namis-childhood-under-arlongs-rule'].content.fact, /Recovered action-level fact/);

const libraryIndex = JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.library));
assert.equal(libraryIndex.packs['attempt-model-continuation-pack'].healthStatus, 'good');
assert.equal(libraryIndex.packs['attempt-model-continuation-pack'].entryOverrides, undefined);
const repairSessionPath = [...stored.keys()].find(path => path.includes('saga-repair-session-attempt-model-continuation-pack-'));
assert.ok(repairSessionPath, 'Attempt Fixing should keep a session when manual-only findings remain.');
const repairSessionRead = await readLoredeckHealthRepairSession(repairSessionPath, storageOptions);
assert.equal(repairSessionRead.ok, true);
assert.equal(repairSessionRead.session.status, 'manual_remaining');
assert.equal(repairSessionRead.session.remaining.modelUnits.length, 0);
assert.equal(repairSessionRead.session.remaining.manualBuckets.length, 1);
assert.ok(toasts.some(toast => toast.type === 'warning' && toast.message.includes('1 model repair') && toast.message.includes('1 manual group')));
assert.equal(toasts.some(toast => toast.message.includes('Reasoning Provider not ready')), false);

clock = 3000;
const sessionAttempt = await attemptLoredeckHealthFixes('continue-model-session-pack', {
  ...storageOptions,
  persistSession: true,
});
assert.equal(sessionAttempt.ok, true);
assert.equal(sessionAttempt.session.status, 'model_pending');
assert.equal(sessionAttempt.remaining.modelUnits.length, 1);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const compactSessionPack = getFreshPack('continue-model-session-pack');
const concurrentStartCount = requestCount;
const [continued, blockedContinue] = await Promise.all([
  continueLoredeckHealthModelRepairSession(compactSessionPack, sessionAttempt.session),
  continueLoredeckHealthModelRepairSession(compactSessionPack, sessionAttempt.session),
]);
assert.equal(continued.ok, true);
assert.equal(continued.changed, true);
assert.equal(blockedContinue, null);
assert.equal(requestCount, concurrentStartCount + 1);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const continuedPayload = JSON.parse(stored.get(sessionPayloadFile));
assert.equal(continuedPayload.healthStatus, 'good');
assert.match(continuedPayload.entryOverrides['namis-childhood-under-arlongs-rule'].content.fact, /Recovered action-level fact/);
assert.equal(continued.remaining.modelUnits.length, 0);
assert.equal(continued.remaining.manualBuckets.length, 1);
const continuedSessionRead = await readLoredeckHealthRepairSession(continued.sessionPath, storageOptions);
assert.equal(continuedSessionRead.ok, true);
assert.equal(continuedSessionRead.session.status, 'manual_remaining');
assert.ok(toasts.some(toast => toast.type === 'warning' && toast.message.includes('Continue Model Batches applied 1 model repair')));
assert.ok(toasts.some(toast => toast.type === 'info' && toast.message.includes('already running for this Loredeck')));

clock = 4000;
const cancelAttempt = await attemptLoredeckHealthFixes('cancel-model-session-pack', {
  ...storageOptions,
  persistSession: true,
});
assert.equal(cancelAttempt.ok, true);
assert.equal(cancelAttempt.session.status, 'model_pending');
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

let cancelRequestStarted = null;
const cancelRequestStartedPromise = new Promise(resolve => { cancelRequestStarted = resolve; });
configureLoredeckEditorActions({
  getFreshLoredeckLibraryPack: getFreshPack,
  clearCanonLoreDatabaseCache: () => {},
  clearContextIndexCache: () => {},
  deleteLoredeckManifestPreviewCacheRecord: () => {},
  deleteLoredeckEntryPreviewCacheRecord: () => {},
  deleteLoredeckTimelineRegistryCacheRecord: () => {},
  deleteLoredeckTagRegistryCacheRecord: () => {},
  refreshLoredeckSurfaces: () => {},
  toast: (message, type = 'info') => toasts.push({ message, type }),
  requestLoredeckHealthModelRepair: async context => {
    requestCount += 1;
    cancelRequestStarted();
    assert.ok(context.signal, 'Model repair continuation should pass an abort signal to the provider request.');
    return await new Promise((_resolve, reject) => {
      context.signal.addEventListener('abort', () => {
        try {
          reject(new DOMException('Cancelled by test.', 'AbortError'));
        } catch (_error) {
          const abortError = new Error('Cancelled by test.');
          abortError.name = 'AbortError';
          reject(abortError);
        }
      }, { once: true });
    });
  },
});

const compactCancelPack = getFreshPack('cancel-model-session-pack');
const cancelRunPromise = continueLoredeckHealthModelRepairSession(compactCancelPack, cancelAttempt.session);
await cancelRequestStartedPromise;
const activeRun = getLoredeckHealthRepairActiveRun('cancel-model-session-pack');
assert.equal(activeRun.label, 'Continue Model Batches');
assert.equal(activeRun.cancellable, true);
assert.equal(cancelLoredeckHealthRepairRun('cancel-model-session-pack'), true);
const cancelledResult = await cancelRunPromise;
assert.equal(cancelledResult.ok, true);
assert.equal(cancelledResult.changed, false);
assert.equal(cancelledResult.runResult.status, 'cancelled');
assert.equal(cancelledResult.remaining.modelUnits.length, 1);
assert.equal(getLoredeckHealthRepairActiveRun('cancel-model-session-pack'), null);
await flushSagaLorepackPayloadStorageWrites();
await flushSagaLorepackLibraryStorageWrites();

const cancelledPayload = JSON.parse(stored.get(cancelPayloadFile));
assert.equal(cancelledPayload.healthStatus, 'has_errors');
assert.equal(cancelledPayload.entryOverrides['namis-childhood-under-arlongs-rule'].content.fact, '');
assert.ok(toasts.some(toast => toast.type === 'info' && toast.message.includes('cancellation requested')));

console.log('Loredeck health Attempt Fixing model continuation tests passed.');
