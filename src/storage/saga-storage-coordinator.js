/** Shared serialization with browser locks and optional server preconditions. */
import { createSagaStorageChangedError } from './saga-storage-stale-write.js';

const objectQueues = new WeakMap();
const namedQueues = new Map();

export function getSagaStorageCoordinationCapabilities(fileApi, options = {}) {
    const identity = options.storageBackendIdentity ?? fileApi.storageBackendIdentity ?? fileApi;
    return {
        processLocal: true,
        crossTabLock: typeof identity === 'string' && typeof globalThis.navigator?.locks?.request === 'function',
        conditionalWrites: typeof fileApi.writeJsonFileConditional === 'function',
        backendIdentityShared: identity !== fileApi,
    };
}

export function queueSagaStorageMutation(fileApi, path, action, options = {}) {
    const identity = options.storageBackendIdentity ?? fileApi.storageBackendIdentity ?? fileApi;
    const registry = identity && (typeof identity === 'object' || typeof identity === 'function') ? objectQueues : namedQueues;
    let paths = registry.get(identity);
    if (!paths) { paths = new Map(); registry.set(identity, paths); }
    const previous = paths.get(path) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => {
        if (getSagaStorageCoordinationCapabilities(fileApi, options).crossTabLock) {
            return globalThis.navigator.locks.request(`saga-storage:${encodeURIComponent(identity)}:${path}`, action);
        }
        return action();
    });
    const settled = next.catch(() => {});
    paths.set(path, settled);
    settled.then(() => { if (paths.get(path) === settled) paths.delete(path); });
    return next;
}

export function assertSagaStorageWriteAcknowledged(result) {
    if (result !== false && result?.ok !== false) return result;
    const error = new Error(String(result?.error || result?.message || 'Saga storage write was refused.'));
    error.code = result?.code || 'storage_write_refused';
    error.result = result;
    throw error;
}

function canonicalJson(value) {
    const normalized = JSON.parse(JSON.stringify(value));
    const sort = item => Array.isArray(item) ? item.map(sort)
        : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
    return JSON.stringify(sort(normalized));
}

export async function verifySagaStorageJsonContents(fileApi, path, expected) {
    const actual = await fileApi.readJsonFile(path);
    if (canonicalJson(actual) !== canonicalJson(expected)) {
        const error = new Error(`Saga storage contents did not match the write: ${path}`);
        error.code = 'storage_verification_failed';
        throw error;
    }
}

export async function verifySagaStorageSnapshot(fileApi, path, expected) {
    if (!expected.exists) {
        try {
            if (typeof fileApi.readTextFile === 'function') await fileApi.readTextFile(path);
            else await fileApi.readJsonFile(path);
        } catch (error) {
            if (error?.status === 404 || /missing|not found|404/i.test(String(error?.message || error))) return;
            throw error;
        }
        throw new Error(`Saga storage deletion was not durable: ${path}`);
    }
    if (expected.text !== undefined && typeof fileApi.readTextFile === 'function') {
        if (await fileApi.readTextFile(path) !== expected.text) throw new Error(`Saga storage rollback contents did not match: ${path}`);
        return;
    }
    await verifySagaStorageJsonContents(fileApi, path, expected.value ?? JSON.parse(expected.text));
}

/** Optional adapter contract: atomic revision/missing precondition plus write. */
export async function writeSagaStorageJsonFile(fileApi, fileName, value, options = {}) {
    try {
        const result = typeof fileApi.writeJsonFileConditional === 'function'
            ? await fileApi.writeJsonFileConditional(fileName, value, options)
            : await fileApi.writeJsonFile(fileName, value, options);
        if (result?.ok === false && (result.code === 'storage_changed' || result.status === 409 || result.status === 412)) {
            const error = new Error(result.error || result.message || 'Storage changed.');
            Object.assign(error, result);
            throw error;
        }
        assertSagaStorageWriteAcknowledged(result);
        await verifySagaStorageJsonContents(fileApi, options.path || `/user/files/${fileName}`, value);
        return result;
    } catch (error) {
        if (error?.status === 409 || error?.status === 412 || error?.code === 'storage_changed') {
            throw createSagaStorageChangedError({
                domain: options.domain,
                path: options.path,
                expectedRevision: options.expectedRevision,
                actualRevision: error.actualRevision,
                message: options.staleMessage,
            });
        }
        throw error;
    }
}
