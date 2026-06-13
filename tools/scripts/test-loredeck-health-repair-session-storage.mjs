import assert from 'node:assert/strict';

const {
  cleanupLoredeckHealthRepairSessions,
  createLoredeckHealthRepairSession,
  deleteLoredeckHealthRepairSession,
  listLoredeckHealthRepairSessions,
  readLoredeckHealthRepairSession,
  writeLoredeckHealthRepairSession,
} = await import('../../src/loredecks/loredeck-health-repair-session-storage.js');
const {
  SAGA_STORAGE_INDEX_PATH,
} = await import('../../src/storage/saga-storage-index.js');
const {
  __sagaFileApiTestHooks,
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
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'health-repair-session-storage-test' }),
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

const session = createLoredeckHealthRepairSession({
  packId: 'arlong-park-health-session-pack',
  attempt: {
    pack: {
      packId: 'arlong-park-health-session-pack',
      entryOverrides: {
        should_not_be_persisted: { content: { fact: 'large payload' } },
      },
    },
    summary: {
      outcome: 'model_pending',
      finalHealth: {
        status: 'has_errors',
        errorCount: 3,
        warningCount: 0,
        suggestionCount: 0,
      },
      finalPlan: {
        modelUnitCount: 1,
        deferredModelUnitCount: 1,
        totalModelUnitCount: 2,
        manualOnlyCount: 1,
      },
    },
    remaining: {
      modelUnits: [{
        unitId: 'repair:arlong:schema_v3_missing_content:batch_1',
        stage: 'pack_health_repair',
        strategy: 'model_direct',
        code: 'schema_v3_missing_content',
        findingIds: ['health_missing_content_1'],
        entryIds: ['arlong-entry-01'],
        inputHash: 'abc123',
        label: 'schema_v3_missing_content batch 1 of 2',
      }],
      deferredUnits: [{
        unitId: 'repair:arlong:schema_v3_missing_content:batch_2',
        stage: 'pack_health_repair',
        strategy: 'model_direct',
        code: 'schema_v3_missing_content',
        findingIds: ['health_missing_content_2'],
        entryIds: ['arlong-entry-02'],
        inputHash: 'def456',
        label: 'schema_v3_missing_content batch 2 of 2',
        deferred: true,
        deferredIndex: 1,
      }],
      manualBuckets: [{
        bucketId: 'bucket_manual_source_warning',
        strategy: 'manual_only',
        code: 'source_warning',
        severity: 'warning',
        targetKind: 'entry',
        findingIds: ['health_source_warning_1'],
        affectedEntryIds: ['arlong-entry-03'],
        reason: 'Source-sensitive warning.',
      }],
    },
    diagnostics: [{ severity: 'info', code: 'test_diagnostic', message: 'kept compact' }],
    appliedPatches: [{ patchId: 'patch_local_01' }],
  },
}, storageOptions);

assert.equal(session.status, 'model_pending');
assert.match(session.sessionFile, /^\/user\/files\/saga-repair-session-arlong-park-health-session-pack-session_/);
assert.equal(session.pack, undefined);
assert.equal(session.remaining.modelUnits.length, 1);
assert.equal(session.remaining.deferredUnits.length, 1);
assert.equal(session.remaining.manualBuckets.length, 1);
assert.deepEqual(session.appliedPatchIds, ['patch_local_01']);

clock = 2000;
const writeResult = await writeLoredeckHealthRepairSession(session, storageOptions);
assert.equal(writeResult.ok, true);
assert.equal(stored.has(writeResult.path), true);
assert.equal(writeResult.session.sessionFile, writeResult.path);

const storedSession = JSON.parse(stored.get(writeResult.path));
assert.equal(storedSession.kind, 'saga_loredeck_health_repair_session');
assert.equal(storedSession.pack, undefined);
assert.equal(storedSession.entryOverrides, undefined);
assert.equal(storedSession.remaining.modelUnits[0].entryIds[0], 'arlong-entry-01');
assert.equal(storedSession.remaining.deferredUnits[0].deferred, true);

const masterIndex = JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(masterIndex.files[writeResult.path].kind, 'loredeck_health_repair_session');
assert.equal(masterIndex.files[writeResult.path].domain, 'library');
assert.equal(masterIndex.files[writeResult.path].ownerId, 'arlong-park-health-session-pack');
assert.equal(masterIndex.files[writeResult.path].deletion, 'delete_with_owner');

clock = 3000;
const readResult = await readLoredeckHealthRepairSession('arlong-park-health-session-pack', writeResult.session.sessionId, storageOptions);
assert.equal(readResult.ok, true);
assert.equal(readResult.path, writeResult.path);
assert.equal(readResult.session.sessionId, writeResult.session.sessionId);
assert.equal(readResult.session.status, 'model_pending');
assert.equal(readResult.session.remaining.modelUnits.length, 1);
assert.equal(readResult.session.lifecycle.canUserDelete, true);
assert.equal(readResult.session.lifecycle.canAutoDelete, false);

const secondSession = createLoredeckHealthRepairSession({
  packId: 'arlong-park-health-session-pack',
  sessionId: 'needs-review-session',
  status: 'needs_review',
  summary: {
    outcome: 'needs_review',
    finalHealth: { status: 'needs_review', errorCount: 1, warningCount: 0, suggestionCount: 0 },
  },
  remaining: {
    choiceSets: [{
      choiceSetId: 'choice_context_anchor',
      findingIds: ['health_anchor_1'],
      severity: 'warning',
      code: 'broken_anchor_reference',
      question: 'Which Context anchor should be used?',
      options: [],
    }],
  },
}, { ...storageOptions, now: 3500 });
const secondWrite = await writeLoredeckHealthRepairSession(secondSession, { ...storageOptions, now: 3500 });
assert.equal(secondWrite.ok, true);
assert.equal(secondWrite.session.lifecycle.canUserDelete, true);
assert.equal(secondWrite.session.lifecycle.canAutoDelete, false);

const listResult = await listLoredeckHealthRepairSessions('arlong-park-health-session-pack', storageOptions);
assert.equal(listResult.ok, true);
assert.equal(listResult.sessions.length, 2);
assert.equal(listResult.records.length, 2);
assert.deepEqual(listResult.sessions.map(item => item.sessionId), [secondWrite.session.sessionId, writeResult.session.sessionId]);
assert.equal(listResult.sessions[0].status, 'needs_review');
assert.equal(listResult.sessions[1].status, 'model_pending');

stored.set(secondWrite.path, '{bad json');
const partialList = await listLoredeckHealthRepairSessions('arlong-park-health-session-pack', storageOptions);
assert.equal(partialList.ok, false);
assert.equal(partialList.sessions.length, 1);
assert.equal(partialList.sessions[0].sessionId, writeResult.session.sessionId);
assert.ok(partialList.diagnostics.some(item => item.code === 'repair_session_read_failed'));
stored.set(secondWrite.path, JSON.stringify(secondWrite.session));

clock = 4000;
const deleteResult = await deleteLoredeckHealthRepairSession(readResult.session, storageOptions);
assert.equal(deleteResult.ok, true);
assert.equal(stored.has(writeResult.path), false);
const deleteSecondResult = await deleteLoredeckHealthRepairSession(secondWrite.session, storageOptions);
assert.equal(deleteSecondResult.ok, true);
assert.equal(stored.has(secondWrite.path), false);

const cleanCompleteSession = createLoredeckHealthRepairSession({
  packId: 'arlong-park-health-session-pack',
  sessionId: 'clean-complete-session',
  status: 'complete',
  summary: {
    outcome: 'complete',
    finalHealth: { status: 'ok', errorCount: 0, warningCount: 0, suggestionCount: 0 },
  },
  remaining: {},
}, { ...storageOptions, now: 4100 });
const cleanCompleteWrite = await writeLoredeckHealthRepairSession(cleanCompleteSession, { ...storageOptions, now: 4100 });
assert.equal(cleanCompleteWrite.ok, true);
assert.equal(cleanCompleteWrite.session.lifecycle.canUserDelete, true);
assert.equal(cleanCompleteWrite.session.lifecycle.canAutoDelete, true);

const diagnosticCompleteSession = createLoredeckHealthRepairSession({
  packId: 'arlong-park-health-session-pack',
  sessionId: 'diagnostic-complete-session',
  status: 'complete',
  summary: {
    outcome: 'complete',
    finalHealth: { status: 'ok', errorCount: 0, warningCount: 0, suggestionCount: 0 },
  },
  diagnostics: [{ severity: 'warning', code: 'kept_summary', message: 'Completed with saved diagnostic context.' }],
  remaining: {},
}, { ...storageOptions, now: 4200 });
const diagnosticCompleteWrite = await writeLoredeckHealthRepairSession(diagnosticCompleteSession, { ...storageOptions, now: 4200 });
assert.equal(diagnosticCompleteWrite.ok, true);
assert.equal(diagnosticCompleteWrite.session.lifecycle.canUserDelete, true);
assert.equal(diagnosticCompleteWrite.session.lifecycle.canAutoDelete, false);

const defaultCleanup = await cleanupLoredeckHealthRepairSessions('arlong-park-health-session-pack', storageOptions);
assert.equal(defaultCleanup.ok, true);
assert.equal(defaultCleanup.deletedCount, 1);
assert.equal(defaultCleanup.deleted[0].sessionId, 'clean-complete-session');
assert.equal(stored.has(cleanCompleteWrite.path), false);
assert.equal(stored.has(diagnosticCompleteWrite.path), true);

const diagnosticCleanup = await cleanupLoredeckHealthRepairSessions('arlong-park-health-session-pack', {
  ...storageOptions,
  includeDiagnosticSessions: true,
});
assert.equal(diagnosticCleanup.ok, true);
assert.equal(diagnosticCleanup.deletedCount, 1);
assert.equal(diagnosticCleanup.deleted[0].sessionId, 'diagnostic-complete-session');
assert.equal(stored.has(diagnosticCompleteWrite.path), false);

const finalIndex = JSON.parse(stored.get(SAGA_STORAGE_INDEX_PATH));
assert.equal(finalIndex.files[writeResult.path], undefined);
assert.equal(finalIndex.files[secondWrite.path], undefined);
assert.equal(finalIndex.files[cleanCompleteWrite.path], undefined);
assert.equal(finalIndex.files[diagnosticCompleteWrite.path], undefined);
assert.ok(finalIndex.files[SAGA_STORAGE_INDEX_PATH]);

console.log('Loredeck health repair session storage tests passed.');
