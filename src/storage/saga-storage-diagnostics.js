/**
 * Runtime diagnostics for Saga-owned flat file storage.
 */

import { createSagaFileApi } from './saga-file-api.js';
import {
    createSagaStorageIndexStore,
    normalizeSagaStorageSettings,
    SAGA_STORAGE_DOMAIN_INDEX_FILES,
    SAGA_STORAGE_INDEX_PATH,
} from './saga-storage-index.js';
import { getSagaCreatorProjectStorageStatus } from './saga-creator-project-storage.js';
import {
    flushSagaCreatorProjectStorageWrites,
} from './saga-creator-project-storage.js';
import {
    flushSagaLorepackLibraryStorageWrites,
    getSagaLorepackLibraryStorageStatus,
} from './saga-lorepack-library-storage.js';
import {
    flushSagaLorepackPayloadStorageWrites,
    getSagaLorepackPayloadStorageStatus,
} from './saga-lorepack-payload-storage.js';
import { getSagaThemeIconStorageStatus } from './saga-theme-icon-storage.js';

function normalizeTimestamp(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return Math.max(0, Number(fallback) || 0);
    return Math.floor(numeric);
}

function getClockNow(options = {}) {
    if (typeof options.now === 'function') return normalizeTimestamp(options.now(), Date.now());
    if (options.now !== undefined) return normalizeTimestamp(options.now, Date.now());
    return Date.now();
}

function getFileApi(options = {}) {
    return options.fileApi || createSagaFileApi(options.fileApiOptions || {});
}

function getStorageIndexStore(options = {}) {
    return options.storageIndexStore || createSagaStorageIndexStore({
        fileApi: getFileApi(options),
        now: options.now,
    });
}

function getPendingWrites(status = {}) {
    return Math.max(0, Math.floor(Number(status.pendingWrites) || 0));
}

function collectStatusError(label = '', status = {}) {
    const error = String(status.lastWriteError || status.error || '').trim();
    return error ? { domain: label, error } : null;
}

function summarizeRuntimeStatuses() {
    const library = getSagaLorepackLibraryStorageStatus();
    const payloads = getSagaLorepackPayloadStorageStatus();
    const creator = getSagaCreatorProjectStorageStatus();
    const themeIcon = getSagaThemeIconStorageStatus();
    const statuses = { library, payloads, creator, themeIcon };
    const pendingWrites = Object.values(statuses).reduce((sum, status) => sum + getPendingWrites(status), 0);
    const storageErrors = [
        collectStatusError('library', library),
        collectStatusError('payloads', payloads),
        collectStatusError('creator', creator),
        collectStatusError('themeIcon', themeIcon),
    ].filter(Boolean);
    return { statuses, pendingWrites, storageErrors };
}

export function getSagaStorageDiagnostics(settings = {}, options = {}) {
    const storage = normalizeSagaStorageSettings(settings?.sagaStorage || {});
    const runtime = summarizeRuntimeStatuses();
    return {
        ok: runtime.storageErrors.length === 0,
        checkedAt: normalizeTimestamp(storage.lastVerifiedAt, 0),
        status: runtime.storageErrors.length ? 'storage_errors' : 'not_checked',
        indexFile: storage.masterIndexFile || SAGA_STORAGE_INDEX_PATH,
        domainIndexFiles: { ...SAGA_STORAGE_DOMAIN_INDEX_FILES },
        storageVersion: storage.storageVersion || '',
        pendingWrites: runtime.pendingWrites,
        storageErrors: runtime.storageErrors,
        writeErrors: runtime.storageErrors,
        runtime: runtime.statuses,
        fileCount: 0,
        missingFiles: [],
        missingFileCount: 0,
        lastIntegrityStatus: '',
        now: getClockNow(options),
    };
}

function isMissingFileError(error = {}) {
    return error?.status === 404 || /missing|not found|404/i.test(String(error?.message || error || ''));
}

export async function verifySagaStorageDiagnostics(settings = {}, options = {}) {
    const base = getSagaStorageDiagnostics(settings, options);
    const store = getStorageIndexStore(options);
    let index;
    try {
        index = await store.readIndex({ allowMissing: false });
    } catch (error) {
        if (isMissingFileError(error)) {
            return {
                ...base,
                ok: false,
                status: 'missing_index',
                code: 'storage_index_missing',
                checkedAt: getClockNow(options),
                error: 'Saga storage index is missing.',
            };
        }
        return {
            ...base,
            ok: false,
            status: 'errors',
            code: 'storage_index_read_failed',
            checkedAt: getClockNow(options),
            error: String(error?.message || error || 'Saga storage index could not be read.'),
        };
    }

    try {
        const verified = await store.verifyIndexFiles(index, {
            ...options,
            write: options.write !== false,
            bumpRevision: options.bumpRevision === true,
        });
        const files = Object.keys(verified.index?.files || {});
        const missingFiles = Array.isArray(verified.missingFiles) ? verified.missingFiles : [];
        return {
            ...base,
            ok: verified.status === 'ok' && missingFiles.length === 0 && (base.storageErrors || []).length === 0,
            status: missingFiles.length ? 'missing_files' : ((base.storageErrors || []).length ? 'storage_errors' : 'ok'),
            checkedAt: verified.index?.lastIntegrityCheck?.checkedAt || getClockNow(options),
            fileCount: files.length,
            missingFiles,
            missingFileCount: missingFiles.length,
            lastIntegrityStatus: verified.status,
        };
    } catch (error) {
        return {
            ...base,
            ok: false,
            status: 'errors',
            code: 'storage_verify_failed',
            checkedAt: getClockNow(options),
            error: String(error?.message || error || 'Saga storage index could not be verified.'),
        };
    }
}

function getMissingCleanupCandidates(index = {}, missingFiles = []) {
    const files = index?.files && typeof index.files === 'object' && !Array.isArray(index.files)
        ? index.files
        : {};
    const protectedKinds = new Set([
        'storage_index',
        'library_index',
        'creator_index',
        'theme_index',
        'iconset_index',
    ]);
    return [...new Set(Array.isArray(missingFiles) ? missingFiles : [])]
        .map(path => ({ path, record: files[path] || null }))
        .filter(item => item.path && item.record && !protectedKinds.has(String(item.record.kind || '').trim()))
        .filter(item => String(item.record.deletion || '') !== 'managed');
}

export async function flushSagaStorageWrites(settings = {}, options = {}) {
    const base = getSagaStorageDiagnostics(settings, options);
    const flushes = {
        payloads: await flushSagaLorepackPayloadStorageWrites(),
        library: await flushSagaLorepackLibraryStorageWrites(),
        creator: await flushSagaCreatorProjectStorageWrites(),
    };
    const errors = Object.entries(flushes)
        .map(([domain, result]) => {
            const error = String(result?.error || '').trim();
            return error ? { domain, error } : null;
        })
        .filter(Boolean);
    const verification = await verifySagaStorageDiagnostics(settings, {
        ...options,
        write: options.write !== false,
    });
    return {
        ...verification,
        flushedAt: getClockNow(options),
        flushes,
        writeErrors: [
            ...(verification.writeErrors || []),
            ...errors,
        ],
        storageErrors: [
            ...(verification.storageErrors || verification.writeErrors || []),
            ...errors,
        ],
        ok: verification.ok && errors.length === 0,
        status: errors.length ? 'storage_errors' : verification.status,
        pendingWritesBefore: base.pendingWrites || 0,
    };
}

export async function cleanMissingSagaStorageRecords(settings = {}, options = {}) {
    const store = getStorageIndexStore(options);
    let index;
    try {
        index = await store.readIndex({ allowMissing: false });
    } catch (error) {
        if (isMissingFileError(error)) {
            return {
                ...getSagaStorageDiagnostics(settings, options),
                ok: false,
                status: 'missing_index',
                code: 'storage_index_missing',
                checkedAt: getClockNow(options),
                cleanedFiles: [],
                protectedMissingFiles: [],
                error: 'Saga storage index is missing.',
            };
        }
        return {
            ...getSagaStorageDiagnostics(settings, options),
            ok: false,
            status: 'errors',
            code: 'storage_index_read_failed',
            checkedAt: getClockNow(options),
            cleanedFiles: [],
            protectedMissingFiles: [],
            error: String(error?.message || error || 'Saga storage index could not be read.'),
        };
    }

    const verified = await store.verifyIndexFiles(index, { ...options, write: false });
    const missingFiles = Array.isArray(verified.missingFiles) ? verified.missingFiles : [];
    const cleanupCandidates = getMissingCleanupCandidates(verified.index, missingFiles);
    const cleanupSet = new Set(cleanupCandidates.map(item => item.path));
    const protectedMissingFiles = missingFiles.filter(path => !cleanupSet.has(path));
    const cleanedFiles = [];
    for (const candidate of cleanupCandidates) {
        await store.unregisterFile(candidate.path, {
            ...options,
            bumpRevision: false,
        });
        cleanedFiles.push(candidate.path);
    }

    const after = await verifySagaStorageDiagnostics(settings, {
        ...options,
        write: options.write !== false,
    });
    return {
        ...after,
        cleanedFiles,
        cleanedFileCount: cleanedFiles.length,
        protectedMissingFiles,
        protectedMissingFileCount: protectedMissingFiles.length,
        status: protectedMissingFiles.length ? 'missing_files' : after.status,
        ok: protectedMissingFiles.length ? false : after.ok,
    };
}
