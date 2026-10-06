/** Durable undo/outbox journal for ordered Saga payload and owning-index commits. */
import { assertSagaStorageWriteAcknowledged, queueSagaStorageMutation, verifySagaStorageSnapshot, writeSagaStorageJsonFile } from './saga-storage-coordinator.js';
import { createSagaStorageIndexStore } from './saga-storage-index.js';
import { getSagaUserFilesFileName } from './saga-storage-filenames.js';

export const SAGA_STORAGE_OUTBOX_PATH = '/user/files/saga-storage-outbox.v1.json';
const clone = value => JSON.parse(JSON.stringify(value ?? null));
const isMissing = error => error?.status === 404 || /missing|not found|404/i.test(String(error?.message || error || ''));

export function getSagaStorageRolledBackRevision(error, path) {
    if (error?.rollbackVerified !== true || error?.code === 'storage_changed') return undefined;
    const previous = error.storageOriginals?.[path];
    if (!previous) return undefined;
    if (!previous.exists) return 1;
    try { return Math.max(1, Number((previous.value ?? JSON.parse(previous.text)).revision) || 1); }
    catch { return undefined; }
}

export async function verifySagaStorageFiles(api, paths = []) {
    if (typeof api.verifyFiles === 'function') {
        const verified = await api.verifyFiles(paths);
        if (paths.some(path => verified[path] !== true)) throw new Error('Saga transaction verification failed.');
    } else {
        for (const path of paths) await api.readJsonFile(path);
    }
}

async function readJournal(api) {
    try {
        const value = await api.readJsonFile(SAGA_STORAGE_OUTBOX_PATH);
        if (value?.schemaVersion !== 1 || !value.operations || typeof value.operations !== 'object') throw new Error('Saga recovery outbox is invalid. Export it before retrying.');
        return { ...value, _exists: true };
    } catch (error) {
        if (isMissing(error)) return { schemaVersion: 1, revision: 1, operations: {}, _exists: false };
        throw error;
    }
}

async function saveJournal(api, journal) {
    const revision = journal.revision;
    const existed = journal._exists === true;
    const next = { ...journal, revision: revision + 1 };
    delete next._exists;
    await writeSagaStorageJsonFile(api, getSagaUserFilesFileName(SAGA_STORAGE_OUTBOX_PATH), next, {
        expectedRevision: revision, expectedMissing: !existed, domain: 'recovery', path: SAGA_STORAGE_OUTBOX_PATH,
    });
    Object.assign(journal, next, { _exists: true });
}

async function loadJournal(api) {
    return readJournal(api);
}

async function snapshotFile(api, path) {
    try {
        if (typeof api.readTextFile === 'function') return { exists: true, text: await api.readTextFile(path) };
        return { exists: true, value: clone(await api.readJsonFile(path)) };
    } catch (error) { if (isMissing(error)) return { exists: false }; throw error; }
}

async function restoreOperation(api, operation) {
    const indexStore = createSagaStorageIndexStore({ fileApi: api });
    const errors = [];
    for (const [path, previous] of Object.entries(operation.originals || {}).reverse()) {
        try {
        const current = await snapshotFile(api, path);
        if (JSON.stringify(current) === JSON.stringify(previous)) continue;
        if (previous.exists) {
            const name = getSagaUserFilesFileName(path);
            const result = previous.text !== undefined && typeof api.writeTextFile === 'function'
                ? await api.writeTextFile(name, previous.text)
                : await api.writeJsonFile(name, previous.value ?? JSON.parse(previous.text));
            assertSagaStorageWriteAcknowledged(result);
            await verifySagaStorageSnapshot(api, path, previous);
        } else {
            try { assertSagaStorageWriteAcknowledged(await api.deleteFile(path)); }
            catch (error) { if (!isMissing(error)) throw error; }
            await verifySagaStorageSnapshot(api, path, previous);
            await indexStore.unregisterFile(path);
        }
        } catch (error) { errors.push(error); }
    }
    if (errors.length) throw errors[0];
    await collectOperation(api, { gcPaths: operation.rollbackGcPaths || [] });
    operation.rolledBack = true;
}

async function collectOperation(api, operation) {
    const indexStore = createSagaStorageIndexStore({ fileApi: api });
    for (const path of operation.gcPaths || []) {
        try { assertSagaStorageWriteAcknowledged(await api.deleteFile(path)); }
        catch (error) { if (!isMissing(error)) throw error; }
        await verifySagaStorageSnapshot(api, path, { exists: false });
        await indexStore.unregisterFile(path);
    }
}

async function recoverUnlocked(api, journal) {
    for (const operation of Object.values(journal.operations)) {
        if (operation.state === 'committed') {
            try { await collectOperation(api, operation); delete journal.operations[operation.operationId]; await saveJournal(api, journal); }
            catch (error) { operation.error = String(error?.message || error); await saveJournal(api, journal); throw error; }
        } else if (!operation.rolledBack) {
            await restoreOperation(api, operation);
            operation.state = 'failed';
            operation.error ||= 'Storage operation was interrupted. Retry the retained request.';
            await saveJournal(api, journal);
        }
    }
    return Object.values(journal.operations).map(operation => ({
        operationId: operation.operationId, ownerId: operation.ownerId, operation: operation.operation,
        request: operation.request, domain: operation.domain, error: operation.error || 'Storage operation is pending.', code: 'storage_transaction_pending', retryable: true,
    }));
}

export async function recoverSagaStorageTransactions(fileApi, options = {}) {
    if (options.persistWrites === false) return [];
    return queueSagaStorageMutation(fileApi, SAGA_STORAGE_OUTBOX_PATH, async () => {
        const journal = await loadJournal(fileApi);
        return recoverUnlocked(fileApi, journal);
    }, options);
}

export async function runSagaStorageTransaction(fileApi, transaction, action, options = {}) {
    const observedFailures = transaction.retryOf === undefined && !transaction.operationId
        ? await recoverSagaStorageTransactions(fileApi, options) : [];
    const observedRetryOf = transaction.retryOf || observedFailures
        .filter(item => item.domain === transaction.domain && item.ownerId === transaction.ownerId && item.operation === transaction.operation)
        .map(item => item.operationId);
    return queueSagaStorageMutation(fileApi, SAGA_STORAGE_OUTBOX_PATH, async () => {
        const journal = await loadJournal(fileApi);
        await recoverUnlocked(fileApi, journal);
        const operationId = transaction.operationId || `transaction:${transaction.ownerId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        const retryOf = observedRetryOf.filter(id => {
            const item = journal.operations[id];
            return item && item.domain === transaction.domain && item.ownerId === transaction.ownerId && item.operation === transaction.operation;
        });
        const originals = {};
        for (const path of [...new Set(transaction.paths || [])]) originals[path] = await snapshotFile(fileApi, path);
        const operation = { ...clone(transaction), operationId, retryOf, originals, state: 'prepared', rolledBack: false };
        journal.operations[operationId] = operation;
        try { await saveJournal(fileApi, journal); }
        catch (error) { error.storageOriginals = originals; error.rollbackVerified = true; throw error; }
        let committed = false;
        try {
            const result = assertSagaStorageWriteAcknowledged(await action());
            const paths = transaction.verifyPaths || transaction.paths || [];
            if (paths.length) await verifySagaStorageFiles(fileApi, paths);
            operation.state = 'committed';
            await saveJournal(fileApi, journal);
            committed = true;
            await collectOperation(fileApi, operation);
            delete journal.operations[operationId];
            for (const id of retryOf) delete journal.operations[id];
            await saveJournal(fileApi, journal);
            return { ...result, ok: true, persisted: true, queued: false, operationId };
        } catch (error) {
            operation.error = String(error?.message || error);
            if (!committed) {
                operation.state = 'failed';
                try { await restoreOperation(fileApi, operation); }
                catch (rollbackError) { operation.rollbackError = String(rollbackError?.message || rollbackError); error.rollbackError = rollbackError; }
            }
            error.storageOriginals = originals;
            error.rollbackVerified = !committed && operation.rolledBack === true;
            journal.operations[operationId] = operation;
            try { await saveJournal(fileApi, journal); } catch (journalError) { error.journalError = journalError; }
            throw error;
        }
    }, options);
}
