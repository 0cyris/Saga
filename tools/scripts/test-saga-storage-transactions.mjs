import assert from 'node:assert/strict';
import { createSagaFileApi, __sagaFileApiTestHooks } from '../../src/storage/saga-file-api.js';
import * as payload from '../../src/storage/saga-lorepack-payload-storage.js';
import * as library from '../../src/storage/saga-lorepack-library-storage.js';
import * as creator from '../../src/storage/saga-creator-project-storage.js';
import * as story from '../../src/storage/saga-story-opener-storage.js';
import { configureLoredeckLibraryStore, upsertLoredeckLibraryPack, importLoredeckLibraryRegistry, removeLoredeckLibraryPack } from '../../src/state/loredeck-library-store.js';
import { getSettings, saveSettings } from '../../src/state/settings-store.js';
import { importExternalThemePack, resetSagaThemeIconStorageCache } from '../../src/storage/saga-theme-icon-storage.js';
import { createSagaStorageOperationOutcomes } from '../../src/storage/saga-storage-operation-outcomes.js';
import { recoverSagaStorageTransactions } from '../../src/storage/saga-storage-transactions.js';
import { configureLoredeckCreatorStore, upsertLoredeckCreatorJob } from '../../src/state/lore-creator-store.js';
import { saveState } from '../../src/state/state-manager.js';
import { getDefaultState } from '../../src/state/constants.js';

function backend() {
    const files = new Map();
    let fail = () => false;
    let verifyFailure = () => false;
    const response = (ok, status, text) => ({ ok, status, async text() { return text; } });
    const fileApi = createSagaFileApi({ storageBackendIdentity: {}, fetchImpl: async (url, init = {}) => {
        const body = init.body ? JSON.parse(init.body) : null;
        if (url === '/api/files/upload') {
            if (fail(body.name, __sagaFileApiTestHooks.base64ToUtf8(body.data))) return response(false, 500, 'injected failure');
            const path = `/user/files/${body.name}`;
            files.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
            return response(true, 200, JSON.stringify({ path }));
        }
        if (url === '/api/files/delete') { files.delete(body.path); return response(true, 200, '{}'); }
        if (url === '/api/files/verify') return response(true, 200, JSON.stringify(Object.fromEntries(body.urls.map(path => [path, files.has(path) && !verifyFailure(path, body.urls)]))));
        return response(files.has(url), files.has(url) ? 200 : 404, files.get(url) || 'missing');
    } });
    return { fileApi, files, fail: predicate => { fail = predicate; }, failVerification: predicate => { verifyFailure = predicate; } };
}

const cases = [];
const test = (name, run) => cases.push({ name, run });
const outboxPath = '/user/files/saga-storage-outbox.v1.json';

test('Library never commits an owning record after its payload fails', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
    payload.resetSagaLorepackPayloadStorageCache(); library.resetSagaLorepackLibraryStorageCache();
    payload.configureSagaLorepackPayloadStorage(options); library.configureSagaLorepackLibraryStorage(options);
    const settings = { loredeckLibrary: { schemaVersion: 1, packs: { safe: { packId: 'safe', title: 'Inline Safe', type: 'custom' } } } };
    configureLoredeckLibraryStore({ getState: () => ({}), getSettings: () => settings, saveSettings() {}, saveState() {} });
    fixture.fail(name => name === 'saga-pack-safe.v1.json');
    const result = upsertLoredeckLibraryPack({ packId: 'safe', title: 'Unsaved', type: 'custom' });
    assert.equal(result.ok, true);
    await payload.flushSagaLorepackPayloadStorageWrites(); await library.flushSagaLorepackLibraryStorageWrites();
    const index = fixture.files.has('/user/files/saga-library-index.v1.json') ? JSON.parse(fixture.files.get('/user/files/saga-library-index.v1.json')) : { packs: {} };
    assert.equal(index.packs.safe, undefined);
    assert(settings.loredeckLibrary.packs.safe, 'Inline recovery copy must remain after a failed external write.');
    assert(fixture.files.has(outboxPath), 'The failed request must survive reload in a durable outbox.');
});

for (const kind of ['creator', 'story']) {
    test(`${kind} preserves previous payload when owning-index commit fails`, async () => {
        const fixture = backend();
        const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
        let enqueue, flush, hydrate;
        if (kind === 'creator') {
            creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
            enqueue = title => creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: title, currentStage: 'titles' }, options);
            flush = creator.flushSagaCreatorProjectStorageWrites;
            hydrate = () => { creator.resetSagaCreatorProjectStorageCache(); return creator.hydrateSagaCreatorProjectStorage(options); };
        } else {
            story.resetSagaStoryOpenerStorageCache(); story.configureSagaStoryOpenerStorage(options);
            enqueue = title => story.upsertExternalStoryOpenerSessionSync({ sessionId: 'safe', title }, options);
            flush = story.flushSagaStoryOpenerStorageWrites;
            hydrate = () => { story.resetSagaStoryOpenerStorageCache(); return story.hydrateSagaStoryOpenerStorage(options); };
        }
        enqueue('Durable'); assert.equal((await flush()).ok, true);
        const path = kind === 'creator' ? '/user/files/saga-creator-project-safe.v1.json' : '/user/files/saga-story-opener-session-safe.v1.json';
        const original = fixture.files.get(path);
        fixture.fail(name => name === (kind === 'creator' ? 'saga-creator-index.v1.json' : 'saga-story-opener-index.v1.json'));
        enqueue('Unsaved'); assert.equal((await flush()).ok, false);
        assert.equal(fixture.files.get(path), original, 'Failed owning-index replacement must preserve the previous durable payload.');
        fixture.fail(() => false);
        await hydrate();
        const status = await flush();
        assert.equal(status.ok, false, 'Reload must retain the failed operation for an explicit retry.');
        assert.equal(status.failures[0].ownerId, 'safe');
        enqueue('Retried'); assert.equal((await flush()).ok, true);
    });
}

test('settings normalization and unrelated saves retain unmigrated inline registries', async () => {
    const original = { enabled: true, experienceMode: 'advanced', loredeckLibrary: { schemaVersion: 1, packs: { inline: { packId: 'inline', title: 'Inline', entryOverrides: { entry: { id: 'entry', content: { fact: 'Preserve me' } } } } } } };
    const extensionSettings = { saga: structuredClone(original) };
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings, chatMetadata: {}, saveSettingsDebounced() {} }) };
    const settings = getSettings();
    assert.equal(settings.loredeckLibrary.packs.inline.entryOverrides.entry.content.fact, 'Preserve me');
    saveSettings({ ...settings, debugMode: true });
    assert.equal(extensionSettings.saga.loredeckLibrary.packs.inline.entryOverrides.entry.content.fact, 'Preserve me');
});

test('Theme replacement preserves prior contents after owning-index failure', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, collisionPolicy: 'replace' };
    resetSagaThemeIconStorageCache();
    assert.equal((await importExternalThemePack({ id: 'safe', title: 'Durable Theme', colors: { accent: '#123456' } }, options)).ok, true);
    const path = '/user/files/saga-theme-pack-safe.v1.json';
    const original = fixture.files.get(path);
    fixture.fail(name => name === 'saga-theme-index.v1.json');
    await assert.rejects(importExternalThemePack({ id: 'safe', title: 'Unsaved Theme', colors: { accent: '#654321' } }, options), /injected failure/);
    assert.equal(fixture.files.get(path), original);
});

test('restored outcomes cannot overwrite a later failed request for the same owner', async () => {
    const first = createSagaStorageOperationOutcomes();
    const original = first.begin('owner', 'save', { contents: 'Original request' });
    first.fail(original, new Error('first failure'));
    const reloaded = createSagaStorageOperationOutcomes();
    reloaded.restore(first.getFailures());
    const retry = reloaded.begin('owner', 'save', { contents: 'New request' });
    reloaded.fail(retry, new Error('retry failure'));
    assert.notEqual(retry.operationId, original.operationId);
    assert.deepEqual(reloaded.getFailures().map(item => item.request.contents), ['Original request', 'New request']);
});

test('reload recovers a prepared transaction interrupted after payload and index replacement', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
    creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
    creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Durable' }, options);
    assert.equal((await creator.flushSagaCreatorProjectStorageWrites()).ok, true);
    const payloadPath = '/user/files/saga-creator-project-safe.v1.json';
    const indexPath = '/user/files/saga-creator-index.v1.json';
    const originals = Object.fromEntries([payloadPath, indexPath].map(path => [path, { exists: true, text: fixture.files.get(path) }]));
    fixture.files.set(outboxPath, JSON.stringify({ schemaVersion: 1, revision: 50, operations: { interrupted: {
        operationId: 'interrupted', domain: 'creator', ownerId: 'safe', operation: 'write_project', state: 'prepared', rolledBack: false,
        originals, paths: [payloadPath, indexPath], request: { payload: { jobId: 'safe', projectTitle: 'Interrupted request' } },
    } } }));
    fixture.files.set(payloadPath, JSON.stringify({ jobId: 'safe', projectTitle: 'Interrupted request' }));
    fixture.files.set(indexPath, JSON.stringify({ projects: { safe: { jobId: 'safe', projectTitle: 'Interrupted request', projectFile: payloadPath } } }));
    creator.resetSagaCreatorProjectStorageCache();
    await creator.hydrateSagaCreatorProjectStorage(options);
    assert.equal(fixture.files.get(payloadPath), originals[payloadPath].text);
    assert.equal(fixture.files.get(indexPath), originals[indexPath].text);
    const result = await creator.flushSagaCreatorProjectStorageWrites();
    assert.equal(result.ok, false);
    assert.equal(result.failures[0].request.payload.projectTitle, 'Interrupted request');
});

for (const boundary of ['prepare', 'payload', 'payload-verify', 'owning-index', 'index-verify', 'commit-journal']) {
    test(`Creator fault at ${boundary} preserves a complete durable version`, async () => {
        const fixture = backend();
        const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
        creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
        creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Durable' }, options);
        assert.equal((await creator.flushSagaCreatorProjectStorageWrites()).ok, true);
        const path = '/user/files/saga-creator-project-safe.v1.json';
        const original = fixture.files.get(path);
        fixture.fail((name, contents) => (
            (boundary === 'payload' && name === 'saga-creator-project-safe.v1.json')
            || (boundary === 'owning-index' && name === 'saga-creator-index.v1.json')
            || (boundary === 'prepare' && name === 'saga-storage-outbox.v1.json' && Object.values(JSON.parse(contents).operations).some(item => item.state === 'prepared'))
            || (boundary === 'commit-journal' && name === 'saga-storage-outbox.v1.json' && Object.values(JSON.parse(contents).operations).some(item => item.state === 'committed'))
        ));
        fixture.failVerification((checkedPath, paths) => boundary === 'payload-verify' ? paths.length === 1 && checkedPath === path : boundary === 'index-verify' && checkedPath === '/user/files/saga-creator-index.v1.json');
        const queued = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Unsaved' }, options);
        assert.equal((await queued.completion).ok, false);
        assert.equal(fixture.files.get(path), original);
        const index = JSON.parse(fixture.files.get('/user/files/saga-creator-index.v1.json'));
        assert(fixture.files.has(index.projects.safe.projectFile));
    });
}

test('nested Web Locks use distinct transaction, payload and index names', async () => {
    const fixture = backend();
    fixture.fileApi.storageBackendIdentity = 'test-account';
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const held = new Set();
    const visited = new Set();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { async request(name, callback) {
        assert.equal(held.has(name), false, 'Nested acquisition must not request its own lock.');
        held.add(name); visited.add(name);
        try { return await callback(); } finally { held.delete(name); }
    } } } });
    try {
        creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage({ fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} });
        const result = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'locked', projectTitle: 'Locked' });
        assert.equal((await result.completion).ok, true);
        assert([...visited].some(name => name.includes('saga-storage-outbox')));
        assert([...visited].some(name => name.includes('saga-creator-project')));
        assert([...visited].some(name => name.includes('saga-storage-index')));
    } finally {
        if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator;
    }
});

for (const target of ['journal', 'payload', 'owning-index']) {
    test(`successful upload ACK with stale ${target} bytes cannot acknowledge a transaction`, async () => {
        const fixture = backend();
        const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
        creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
        creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Durable' }, options);
        assert.equal((await creator.flushSagaCreatorProjectStorageWrites()).ok, true);
        const payloadPath = '/user/files/saga-creator-project-safe.v1.json';
        const original = fixture.files.get(payloadPath);
        const names = { journal: 'saga-storage-outbox.v1.json', payload: 'saga-creator-project-safe.v1.json', 'owning-index': 'saga-creator-index.v1.json' };
        const originalWrite = fixture.fileApi.writeJsonFile;
        fixture.fileApi.writeJsonFile = async (name, value, writeOptions) => name === names[target]
            ? { path: `/user/files/${name}`, fileName: name }
            : originalWrite(name, value, writeOptions);
        const result = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Unsaved' }, options);
        assert.equal((await result.completion).ok, false);
        assert.equal(fixture.files.get(payloadPath), original);
    });
}

test('unconfirmed rollback keeps prior bytes and the request in durable recovery until reload can restore', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
    creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
    const first = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Durable' }, options);
    assert.equal((await first.completion).ok, true);
    const path = '/user/files/saga-creator-project-safe.v1.json';
    const oldBytes = fixture.files.get(path);
    fixture.fail(name => name === 'saga-creator-index.v1.json');
    const originalRestore = fixture.fileApi.writeTextFile;
    fixture.fileApi.writeTextFile = async () => ({ ok: true });
    const next = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Interrupted' }, options);
    assert.equal((await next.completion).ok, false);
    const pending = Object.values(JSON.parse(fixture.files.get(outboxPath)).operations)[0];
    assert.equal(pending.rolledBack, false);
    assert.equal(pending.originals[path].text, oldBytes);
    fixture.fileApi.writeTextFile = originalRestore; fixture.fail(() => false);
    await recoverSagaStorageTransactions(fixture.fileApi);
    assert.equal(fixture.files.get(path), oldBytes);
});

test('unconfirmed garbage collection keeps a committed removal recoverable through reload', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
    creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
    assert.equal((await creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'safe', projectTitle: 'Durable' }, options).completion).ok, true);
    const path = '/user/files/saga-creator-project-safe.v1.json';
    const originalDelete = fixture.fileApi.deleteFile;
    fixture.fileApi.deleteFile = async () => ({ ok: true });
    assert.equal((await creator.removeExternalLoredeckCreatorProjectSync('safe', options).completion).ok, false);
    assert.equal(JSON.parse(fixture.files.get('/user/files/saga-creator-index.v1.json')).projects.safe, undefined);
    assert.equal(fixture.files.has(path), true);
    assert.equal(Object.values(JSON.parse(fixture.files.get(outboxPath)).operations)[0].state, 'committed');
    fixture.fileApi.deleteFile = originalDelete;
    await recoverSagaStorageTransactions(fixture.fileApi);
    assert.equal(fixture.files.has(path), false);
    assert.deepEqual(JSON.parse(fixture.files.get(outboxPath)).operations, {});
});

for (const operation of ['import', 'remove']) {
    test(`Library ${operation} retains inline recovery through failed payload transaction`, async () => {
        const fixture = backend();
        const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
        payload.resetSagaLorepackPayloadStorageCache(); library.resetSagaLorepackLibraryStorageCache();
        payload.configureSagaLorepackPayloadStorage(options); library.configureSagaLorepackLibraryStorage(options);
        const settings = { loredeckLibrary: { schemaVersion: 1, packs: { safe: { packId: 'safe', title: 'Recovery', type: 'custom' } } }, loredeckCreatorProjects: { schemaVersion: 1, jobs: {} } };
        configureLoredeckLibraryStore({ getState: () => ({}), getSettings: () => settings, saveSettings() {}, saveState() {} });
        fixture.fail(name => name === (operation === 'import' ? 'saga-pack-safe.v1.json' : 'saga-library-index.v1.json'));
        const result = operation === 'import' ? importLoredeckLibraryRegistry(settings.loredeckLibrary) : removeLoredeckLibraryPack('safe', { clearCreatorProjects: false });
        if (result.completion) await result.completion;
        await payload.flushSagaLorepackPayloadStorageWrites(); await library.flushSagaLorepackLibraryStorageWrites();
        assert(settings.loredeckLibrary.packs.safe, 'Inline recovery cannot disappear before the external operation succeeds.');
    });
}

test('Creator completion waits for the actual async state-manager metadata boundary', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
    creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
    let release;
    const pendingMetadata = new Promise(resolve => { release = resolve; });
    const state = getDefaultState();
    const settings = { enabled: true, loredeckCreatorProjects: { schemaVersion: 1, jobs: {} } };
    const ctx = { chatId: 'creator-owner', characterId: 1, chatMetadata: { saga: state }, extensionSettings: { saga: settings }, saveMetadata: () => pendingMetadata, saveSettingsDebounced() {} };
    globalThis.SillyTavern = { getContext: () => ctx };
    configureLoredeckCreatorStore({ getState: () => state, getSettings: () => settings, saveSettings() {}, saveState });
    const result = upsertLoredeckCreatorJob({ jobId: 'async', projectTitle: 'Async host' }, { syncLocal: true });
    assert.equal(result.ok, true);
    await creator.flushSagaCreatorProjectStorageWrites();
    release();
    const completed = await result.completion;
    assert.equal(completed.ok, true, completed.error);
    assert.equal(completed.persisted, true);
    assert.equal(completed.metadataPersisted, false, 'Legacy metadata scheduler cannot attest persistence.');
});

test('successful Library layout cannot publish an unrelated failed optimistic payload', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
    payload.resetSagaLorepackPayloadStorageCache(); library.resetSagaLorepackLibraryStorageCache();
    payload.configureSagaLorepackPayloadStorage(options); library.configureSagaLorepackLibraryStorage(options);
    const settings = { loredeckLibrary: { schemaVersion: 1, packs: {} } };
    configureLoredeckLibraryStore({ getState: () => ({}), getSettings: () => settings, saveSettings() {}, saveState() {} });
    fixture.fail(name => name === 'saga-pack-safe.v1.json');
    const pack = upsertLoredeckLibraryPack({ packId: 'safe', title: 'Pending', type: 'custom' });
    const layout = library.updateExternalLoredeckLibraryLayoutSync({ folders: [{ id: 'folder', title: 'Durable folder' }] });
    assert.equal((await pack.completion).ok, false);
    assert.equal((await layout.completion).ok, true);
    const durable = JSON.parse(fixture.files.get('/user/files/saga-library-index.v1.json'));
    assert.equal(durable.packs.safe, undefined, 'Layout must merge only layout into the durable index.');
    assert.equal(durable.folders[0].title, 'Durable folder');
    assert.equal((await payload.flushSagaLorepackPayloadStorageWrites()).ok, false, 'Layout cannot acknowledge the failed payload owner.');
});

for (const domain of ['creator', 'story', 'payload']) {
    test(`${domain} retries its rolled-back default-stale-check write without accepting an external replacement`, async () => {
        const fixture = backend();
        const options = { fileApi: fixture.fileApi, staleCheck: true, onWriteError() {} };
        let write, indexName, path;
        if (domain === 'creator') {
            creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
            write = title => creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'retry', projectTitle: title }, options);
            indexName = 'saga-creator-index.v1.json'; path = '/user/files/saga-creator-project-retry.v1.json';
        } else if (domain === 'story') {
            story.resetSagaStoryOpenerStorageCache(); story.configureSagaStoryOpenerStorage(options);
            write = title => story.upsertExternalStoryOpenerSessionSync({ sessionId: 'retry', title }, options);
            indexName = 'saga-story-opener-index.v1.json'; path = '/user/files/saga-story-opener-session-retry.v1.json';
        } else {
            payload.resetSagaLorepackPayloadStorageCache(); payload.configureSagaLorepackPayloadStorage(options);
            write = title => payload.upsertExternalLorepackPayloadSync({ packId: 'retry', title, type: 'custom' }, { ...options, persistOwningIndex: true });
            indexName = 'saga-library-index.v1.json'; path = '/user/files/saga-pack-retry.v1.json';
        }
        assert.equal((await write('Durable').completion).ok, true);
        fixture.fail(name => name === indexName);
        assert.equal((await write('Unsaved').completion).ok, false);
        fixture.fail(() => false);
        const retried = await write('Retried').completion;
        assert.equal(retried.ok, true, retried.error);
        fixture.fail(name => name === indexName);
        assert.equal((await write('Unsaved again').completion).ok, false);
        fixture.fail(() => false);
        const external = { ...JSON.parse(fixture.files.get(path)), revision: 99, title: 'External owner' };
        const bytes = JSON.stringify(external); fixture.files.set(path, bytes);
        const conflicted = await write('Must refuse').completion;
        assert.equal(conflicted.ok, false, 'Retry must retain genuine external revision protection.');
        assert.equal(fixture.files.get(path), bytes);
    });
}

test('same-owner success queued before failure cannot discard the durable failed request', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, onWriteError() {} };
    creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
    const originalWrite = fixture.fileApi.writeJsonFile;
    let refuseOnce = true;
    fixture.fileApi.writeJsonFile = async (name, value, writeOptions) => {
        if (name === 'saga-creator-index.v1.json' && refuseOnce) { refuseOnce = false; throw new Error('First owner failure'); }
        return originalWrite(name, value, writeOptions);
    };
    const failed = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'same', projectTitle: 'Failed request' });
    const unobservedRetry = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'same', projectTitle: 'Queued before failure' });
    assert.equal((await failed.completion).ok, false);
    assert.equal((await unobservedRetry.completion).ok, true);
    assert.equal((await creator.flushSagaCreatorProjectStorageWrites()).ok, false);
    creator.resetSagaCreatorProjectStorageCache();
    await creator.hydrateSagaCreatorProjectStorage(options);
    const reloaded = await creator.flushSagaCreatorProjectStorageWrites();
    assert.equal(reloaded.ok, false);
    assert.equal(reloaded.failures[0].request.payload.projectTitle, 'Failed request');
    assert.equal((await creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'same', projectTitle: 'Observed retry' }, options).completion).ok, true);
    assert.deepEqual(JSON.parse(fixture.files.get(outboxPath)).operations, {});
});

test('Creator coalesced completion reports its own durable failure', async () => {
    const fixture = backend();
    const options = { fileApi: fixture.fileApi, staleCheck: false, coalesceWrites: true, onWriteError() {} };
    creator.resetSagaCreatorProjectStorageCache(); creator.configureSagaCreatorProjectStorage(options);
    fixture.fail((name, contents) => name === 'saga-creator-project-coalesced.v1.json' && JSON.parse(contents).projectTitle === 'Failing coalesced request');
    const first = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'coalesced', projectTitle: 'First durable request' }, options);
    const second = creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'coalesced', projectTitle: 'Failing coalesced request' }, options);
    assert.equal((await first.completion).ok, true);
    assert.equal((await second.completion).ok, false, 'The second completion cannot borrow the first successful receipt.');
    assert.equal((await creator.flushSagaCreatorProjectStorageWrites()).ok, false);
});

let failures = 0;
for (const { name, run } of cases) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failures += 1; console.error(`FAIL ${name}: ${error.stack}`); }
}
assert.equal(failures, 0, `${failures} transaction regressions failed.`);
