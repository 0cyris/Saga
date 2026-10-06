import assert from 'node:assert/strict';
import { createSagaFileApi, __sagaFileApiTestHooks } from '../../src/storage/saga-file-api.js';
import { createSagaDomainStorage } from '../../src/storage/saga-domain-storage.js';
import { createSagaStorageIndexStore, SAGA_STORAGE_INDEX_PATH } from '../../src/storage/saga-storage-index.js';
import * as payload from '../../src/storage/saga-lorepack-payload-storage.js';
import * as library from '../../src/storage/saga-lorepack-library-storage.js';
import * as creator from '../../src/storage/saga-creator-project-storage.js';
import * as story from '../../src/storage/saga-story-opener-storage.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function memoryBackend() {
    const stored = new Map();
    const backendIdentity = {};
    let rejectUpload = () => false;
    let verify = paths => Object.fromEntries(paths.map(path => [path, stored.has(path)]));
    const response = (ok, status, body) => ({ ok, status, async text() { return body; } });
    const fetchImpl = async (url, init = {}) => {
        const body = init.body ? JSON.parse(init.body) : null;
        if (url === '/api/files/upload') {
            if (rejectUpload(body.name)) return response(false, 500, 'disk full');
            const path = `/user/files/${body.name}`;
            stored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
            return response(true, 200, JSON.stringify({ path }));
        }
        if (url === '/api/files/delete') {
            stored.delete(body.path);
            return response(true, 200, '{}');
        }
        if (url === '/api/files/verify') return response(true, 200, JSON.stringify(await verify(body.urls)));
        return response(stored.has(url), stored.has(url) ? 200 : 404, stored.get(url) || 'missing');
    };
    return {
        stored,
        adapter: (defaultIdentity = false) => createSagaFileApi({ fetchImpl, storageBackendIdentity: defaultIdentity ? undefined : backendIdentity }),
        failUploads: predicate => { rejectUpload = predicate; },
        setVerify: action => { verify = action; },
    };
}

const cases = [];
function test(name, run) { cases.push({ name, run }); }

test('failed replacement restores the exact previous payload bytes', async () => {
    const backend = memoryBackend();
    const path = '/user/files/saga-pack-old.v1.json';
    const original = '{ "id": "old", "title": "Durable", "revision": 2 }\n';
    backend.stored.set(path, original);
    backend.failUploads(name => name === 'saga-storage-index.v1.json');
    const store = createSagaDomainStorage({ fileApi: backend.adapter() });
    await assert.rejects(store.writePayload('library', 'old', { id: 'old', title: 'Unsaved', revision: 3 }), /disk full/);
    assert.equal(backend.stored.get(path), original, 'Rollback must leave the previous durable bytes readable.');
});

test('distinct adapters retain concurrent registrations', async () => {
    const backend = memoryBackend();
    const first = createSagaStorageIndexStore({ fileApi: backend.adapter() });
    const second = createSagaStorageIndexStore({ fileApi: backend.adapter() });
    await Promise.all([
        first.registerFile('/user/files/saga-pack-a.v1.json', { ownerId: 'a' }),
        second.registerFile('/user/files/saga-pack-b.v1.json', { ownerId: 'b' }),
    ]);
    const files = JSON.parse(backend.stored.get(SAGA_STORAGE_INDEX_PATH)).files;
    assert(files['/user/files/saga-pack-a.v1.json']);
    assert(files['/user/files/saga-pack-b.v1.json']);
});

test('fresh default adapters share the current backend coordinator', async () => {
    const backend = memoryBackend();
    const stores = [backend.adapter(true), backend.adapter(true)].map(fileApi => createSagaStorageIndexStore({ fileApi }));
    await Promise.all(stores.map((store, index) => store.registerFile(`/user/files/saga-pack-default-${index}.v1.json`, { ownerId: `default-${index}` })));
    const files = JSON.parse(backend.stored.get(SAGA_STORAGE_INDEX_PATH)).files;
    assert(files['/user/files/saga-pack-default-0.v1.json']);
    assert(files['/user/files/saga-pack-default-1.v1.json']);
});

test('Web Locks refusal prevents a backend mutation across tabs', async () => {
    const backend = memoryBackend();
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { async request(name) { assert.match(name, /saga-storage.*saga-storage-index/); throw new Error('lock refused'); } } } });
    try {
        await assert.rejects(createSagaStorageIndexStore({ fileApi: backend.adapter(true) }).registerFile('/user/files/saga-pack-locked.v1.json', { ownerId: 'locked' }), /lock refused/);
        assert.equal(backend.stored.has(SAGA_STORAGE_INDEX_PATH), false);
    } finally {
        if (previous) Object.defineProperty(globalThis, 'navigator', previous);
        else delete globalThis.navigator;
    }
});

test('concurrent registration and unregistration preserve both changes', async () => {
    const backend = memoryBackend();
    const first = createSagaStorageIndexStore({ fileApi: backend.adapter() });
    const second = createSagaStorageIndexStore({ fileApi: backend.adapter() });
    await first.registerFile('/user/files/saga-pack-remove.v1.json', { ownerId: 'remove' });
    await Promise.all([
        first.unregisterFile('/user/files/saga-pack-remove.v1.json'),
        second.registerFile('/user/files/saga-pack-keep.v1.json', { ownerId: 'keep' }),
    ]);
    const files = JSON.parse(backend.stored.get(SAGA_STORAGE_INDEX_PATH)).files;
    assert.equal(files['/user/files/saga-pack-remove.v1.json'], undefined);
    assert(files['/user/files/saga-pack-keep.v1.json']);
});

test('concurrent domain upserts retain both records', async () => {
    const backend = memoryBackend();
    const stores = [backend.adapter(), backend.adapter()].map(fileApi => createSagaDomainStorage({ fileApi }));
    await Promise.all(stores.map((store, index) => store.upsertRecord('themes', { id: `theme-${index}`, title: `Theme ${index}` })));
    const index = JSON.parse(backend.stored.get('/user/files/saga-theme-index.v1.json'));
    assert(index.packs['theme-0']);
    assert(index.packs['theme-1']);
});

test('failed domain-index replacement restores the previous index bytes', async () => {
    const backend = memoryBackend();
    const path = '/user/files/saga-theme-index.v1.json';
    const original = '{ "kind": "saga_theme_index", "revision": 2, "packs": {} }\n';
    backend.stored.set(path, original);
    backend.failUploads(name => name === 'saga-storage-index.v1.json');
    const store = createSagaDomainStorage({ fileApi: backend.adapter() });
    await assert.rejects(store.upsertRecord('themes', { id: 'unsaved' }), /disk full/);
    assert.equal(backend.stored.get(path), original);
});

test('verification cannot overwrite a registration made during verification', async () => {
    const backend = memoryBackend();
    const first = createSagaStorageIndexStore({ fileApi: backend.adapter() });
    const second = createSagaStorageIndexStore({ fileApi: backend.adapter() });
    const seeded = await first.registerFile('/user/files/saga-pack-a.v1.json', { ownerId: 'a' });
    const entered = deferred();
    const release = deferred();
    backend.setVerify(async paths => {
        entered.resolve();
        await release.promise;
        return Object.fromEntries(paths.map(path => [path, true]));
    });
    const verification = first.verifyIndexFiles(seeded.index, { write: true });
    await entered.promise;
    const registration = second.registerFile('/user/files/saga-pack-b.v1.json', { ownerId: 'b' });
    await new Promise(done => setImmediate(done));
    release.resolve();
    await Promise.all([verification, registration]);
    assert(JSON.parse(backend.stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-b.v1.json']);
    await first.verifyIndexFiles(seeded.index, { write: true });
    assert(JSON.parse(backend.stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-b.v1.json'], 'A stale supplied snapshot must not replace the current index.');
});

test('master index refuses a stale direct replacement', async () => {
    const backend = memoryBackend();
    const store = createSagaStorageIndexStore({ fileApi: backend.adapter() });
    const initial = await store.registerFile('/user/files/saga-pack-a.v1.json', { ownerId: 'a' });
    await store.registerFile('/user/files/saga-pack-b.v1.json', { ownerId: 'b' });
    await assert.rejects(store.writeIndex(initial.index, { expectedRevision: initial.index.revision }), error => error.code === 'storage_changed');
    await assert.rejects(store.writeIndex(initial.index), error => error.code === 'storage_changed');
    assert(JSON.parse(backend.stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-b.v1.json']);
});

test('conditional master writes reject a backend change after the freshness read', async () => {
    const backend = memoryBackend();
    const api = backend.adapter();
    const seed = await createSagaStorageIndexStore({ fileApi: api }).initializeIndex();
    let conditionalCalls = 0;
    api.writeJsonFileConditional = async (fileName, value, options) => {
        conditionalCalls += 1;
        const remote = { ...seed.index, revision: seed.index.revision + 1, files: { '/user/files/saga-pack-remote.v1.json': { ownerId: 'remote' } } };
        backend.stored.set(SAGA_STORAGE_INDEX_PATH, JSON.stringify(remote));
        if (options.expectedRevision !== remote.revision) {
            const error = new Error('conditional conflict');
            error.status = 412;
            error.actualRevision = remote.revision;
            throw error;
        }
        return api.writeJsonFile(fileName, value);
    };
    await assert.rejects(createSagaStorageIndexStore({ fileApi: api }).registerFile('/user/files/saga-pack-local.v1.json', { ownerId: 'local' }), error => error.code === 'storage_changed');
    assert.equal(conditionalCalls, 1);
    assert(JSON.parse(backend.stored.get(SAGA_STORAGE_INDEX_PATH)).files['/user/files/saga-pack-remote.v1.json']);
});

test('a refused file write cannot report durable success or register its payload', async () => {
    const backend = memoryBackend();
    const api = backend.adapter();
    api.writeJsonFile = async fileName => ({ ok: false, error: 'write refused', path: `/user/files/${fileName}`, fileName });
    await assert.rejects(createSagaDomainStorage({ fileApi: api }).writePayload('library', 'refused', { id: 'refused' }), /write refused/);
    assert.equal(backend.stored.has(SAGA_STORAGE_INDEX_PATH), false);
    await assert.rejects(createSagaStorageIndexStore({ fileApi: api }).initializeIndex(), /write refused/);
});

test('domain payload conditional writes reject a concurrent backend replacement', async () => {
    const backend = memoryBackend();
    const api = backend.adapter();
    const path = '/user/files/saga-pack-conflict.v1.json';
    backend.stored.set(path, JSON.stringify({ id: 'conflict', revision: 2, title: 'Original' }));
    api.writeJsonFileConditional = async (fileName, value, options) => {
        assert.equal(options.expectedRevision, 2);
        assert.equal(options.expectedMissing, false);
        backend.stored.set(path, JSON.stringify({ id: 'conflict', revision: 3, title: 'Remote' }));
        return { ok: false, status: 412, actualRevision: 3, error: 'conflict' };
    };
    await assert.rejects(createSagaDomainStorage({ fileApi: api }).writePayload('library', 'conflict', { id: 'conflict', revision: 3, title: 'Local' }, { expectedRevision: 2 }), error => error.code === 'storage_changed');
    assert.equal(JSON.parse(backend.stored.get(path)).title, 'Remote');
});

for (const kind of ['creator', 'story']) {
    test(`${kind} refuses a returned index-write failure`, async () => {
        const backend = memoryBackend();
        const fileApi = backend.adapter();
        const write = fileApi.writeJsonFile;
        const indexName = kind === 'creator' ? 'saga-creator-index.v1.json' : 'saga-story-opener-index.v1.json';
        fileApi.writeJsonFile = async (fileName, ...args) => fileName === indexName
            ? { ok: false, error: 'index write refused', path: `/user/files/${fileName}` }
            : write(fileName, ...args);
        const options = { fileApi, staleCheck: false, onWriteError() {} };
        let result;
        if (kind === 'creator') {
            creator.resetSagaCreatorProjectStorageCache();
            creator.configureSagaCreatorProjectStorage(options);
            creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'refused', projectTitle: 'Refused' }, options);
            result = await creator.flushSagaCreatorProjectStorageWrites();
        } else {
            story.resetSagaStoryOpenerStorageCache();
            story.configureSagaStoryOpenerStorage(options);
            story.upsertExternalStoryOpenerSessionSync({ sessionId: 'refused', title: 'Refused' }, options);
            result = await story.flushSagaStoryOpenerStorageWrites();
        }
        assert.equal(result.ok, false);
        assert.match(result.error, /index write refused/);
    });
}

test('library retains a refused domain-index write', async () => {
    const backend = memoryBackend();
    const options = { fileApi: backend.adapter(), staleCheck: false, onWriteError() {}, domainStorage: { async readDomainIndex() { return { packs: {} }; }, async writeDomainIndex() { return { ok: false, error: 'index write refused' }; } } };
    library.resetSagaLorepackLibraryStorageCache();
    library.configureSagaLorepackLibraryStorage(options);
    library.upsertExternalLoredeckLibraryRecordSync({ packId: 'refused', title: 'Refused' }, options);
    try {
        const result = await library.flushSagaLorepackLibraryStorageWrites();
        assert.equal(result.ok, false);
        assert.match(result.error, /index write refused/);
    } finally {
        library.configureSagaLorepackLibraryStorage({ domainStorage: null });
    }
});

for (const kind of ['payload', 'creator', 'story']) {
    test(`${kind} retains a returned delete failure`, async () => {
        const backend = memoryBackend();
        const fileApi = backend.adapter();
        const options = { fileApi, staleCheck: false, onWriteError() {} };
        let flush, remove;
        if (kind === 'payload') {
            payload.resetSagaLorepackPayloadStorageCache();
            payload.configureSagaLorepackPayloadStorage(options);
            payload.upsertExternalLorepackPayloadSync({ packId: 'delete-me', title: 'Delete Me' }, options);
            flush = payload.flushSagaLorepackPayloadStorageWrites;
            remove = () => payload.removeExternalLorepackPayloadSync('delete-me', options);
        } else if (kind === 'creator') {
            creator.resetSagaCreatorProjectStorageCache();
            creator.configureSagaCreatorProjectStorage(options);
            creator.upsertExternalLoredeckCreatorProjectSync({ jobId: 'delete-me', projectTitle: 'Delete Me' }, options);
            flush = creator.flushSagaCreatorProjectStorageWrites;
            remove = () => creator.removeExternalLoredeckCreatorProjectSync('delete-me', options);
        } else {
            story.resetSagaStoryOpenerStorageCache();
            story.configureSagaStoryOpenerStorage(options);
            story.upsertExternalStoryOpenerSessionSync({ sessionId: 'delete-me', title: 'Delete Me' }, options);
            flush = story.flushSagaStoryOpenerStorageWrites;
            remove = () => story.removeExternalStoryOpenerSessionSync('delete-me', options);
        }
        assert.equal((await flush()).ok, true);
        fileApi.deleteFile = async () => ({ ok: false, error: 'delete refused' });
        assert.equal(remove().ok, true);
        const result = await flush();
        assert.equal(result.ok, false);
        assert.match(result.error, /delete refused/);
        assert.equal(result.failures[0].ownerId, 'delete-me');
    });
}

for (const kind of ['payload', 'library', 'creator', 'story']) {
    test(`${kind} retains each owner's failure through unrelated success and retry`, async () => {
        const backend = memoryBackend();
        const fileApi = backend.adapter();
        const options = { fileApi, staleCheck: false, onWriteError() {} };
        let enqueue, flush;
        if (kind === 'payload') {
            payload.resetSagaLorepackPayloadStorageCache();
            payload.configureSagaLorepackPayloadStorage(options);
            enqueue = id => payload.upsertExternalLorepackPayloadSync({ packId: id, title: id }, options);
            flush = payload.flushSagaLorepackPayloadStorageWrites;
        } else if (kind === 'library') {
            library.resetSagaLorepackLibraryStorageCache();
            library.configureSagaLorepackLibraryStorage(options);
            enqueue = id => library.upsertExternalLoredeckLibraryRecordSync({ packId: id, title: id }, options);
            flush = library.flushSagaLorepackLibraryStorageWrites;
        } else if (kind === 'creator') {
            creator.resetSagaCreatorProjectStorageCache();
            creator.configureSagaCreatorProjectStorage(options);
            enqueue = id => creator.upsertExternalLoredeckCreatorProjectSync({ jobId: id, projectTitle: id, currentStage: 'titles' }, options);
            flush = creator.flushSagaCreatorProjectStorageWrites;
        } else {
            story.resetSagaStoryOpenerStorageCache();
            story.configureSagaStoryOpenerStorage(options);
            enqueue = id => story.upsertExternalStoryOpenerSessionSync({ sessionId: id, title: id }, options);
            flush = story.flushSagaStoryOpenerStorageWrites;
        }
        backend.failUploads(() => true);
        assert.equal(enqueue('a').ok, true);
        assert.equal((await flush()).ok, false);
        assert.equal(enqueue('c').ok, true);
        assert.equal((await flush()).ok, false);
        backend.failUploads(() => false);
        assert.equal(enqueue('b').ok, true);
        const failed = await flush();
        assert.equal(failed.ok, false, 'Unrelated success must retain the failed operation.');
        assert.deepEqual(failed.failures.map(item => item.ownerId), ['a', 'c']);
        assert(failed.failures.every(item => item.operationId && item.retryable && item.request));
        assert.equal(enqueue('a').ok, true);
        const retried = await flush();
        assert.equal(retried.ok, false, 'Retry A must leave C unresolved.');
        assert.deepEqual(retried.failures.map(item => item.ownerId), ['c']);
        assert.equal(enqueue('c').ok, true);
        assert.equal((await flush()).ok, true);
    });
}

let failed = 0;
for (const { name, run } of cases) {
    try { await run(); console.log(`PASS ${name}`); }
    catch (error) { failed += 1; console.error(`FAIL ${name}: ${error.stack}`); }
}
assert.equal(failed, 0, `${failed} storage reliability regressions failed.`);
