/**
 * Master index helpers for Saga-owned flat files.
 */

import {
    assertSagaUserFilesPath,
    buildSagaIndexStorageFileName,
    normalizeSagaStorageHash,
    normalizeSagaStorageId,
    SAGA_STORAGE_JSON_EXTENSION,
    toSagaUserFilesPath,
} from './saga-storage-filenames.js';

export const SAGA_STORAGE_INDEX_SCHEMA_VERSION = 1;
export const SAGA_STORAGE_INDEX_KIND = 'saga_storage_index';
export const SAGA_STORAGE_MIGRATION_VERSION = 'external-files-v1';
export const SAGA_STORAGE_INDEX_FILE_NAME = buildSagaIndexStorageFileName('storage');
export const SAGA_STORAGE_INDEX_PATH = toSagaUserFilesPath(SAGA_STORAGE_INDEX_FILE_NAME, {
    allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
});

export const SAGA_STORAGE_DOMAIN_INDEX_STEMS = Object.freeze({
    library: 'library',
    creator: 'creator',
    themes: 'theme',
    iconSets: 'iconset',
});

export const SAGA_STORAGE_DOMAIN_KEYS = Object.freeze(Object.keys(SAGA_STORAGE_DOMAIN_INDEX_STEMS));
export const SAGA_STORAGE_MANAGED_DOMAINS = Object.freeze(['storage', ...SAGA_STORAGE_DOMAIN_KEYS]);
export const SAGA_STORAGE_DELETION_MODES = Object.freeze([
    'managed',
    'delete_with_owner',
    'shared_asset',
    'external_reference',
]);
export const SAGA_STORAGE_INTEGRITY_STATUSES = Object.freeze([
    'unknown',
    'ok',
    'missing_files',
    'errors',
]);

export const SAGA_STORAGE_DOMAIN_INDEX_FILES = Object.freeze(Object.fromEntries(
    Object.entries(SAGA_STORAGE_DOMAIN_INDEX_STEMS).map(([domain, stem]) => [
        domain,
        toSagaUserFilesPath(buildSagaIndexStorageFileName(stem), {
            allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
        }),
    ])
));

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTimestamp(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return Math.max(0, Number(fallback) || 0);
    return Math.floor(numeric);
}

function normalizeRevision(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return Math.max(1, Number(fallback) || 1);
    return Math.floor(numeric);
}

function normalizeString(value = '', maxLength = 240) {
    return String(value || '').trim().slice(0, Math.max(1, Number(maxLength) || 240));
}

function normalizeDomainKey(value = '', fallback = 'storage') {
    const text = normalizeString(value, 80);
    if (SAGA_STORAGE_MANAGED_DOMAINS.includes(text)) return text;
    const lowered = text.toLowerCase().replace(/[_-]+/g, '');
    if (lowered === 'iconsets') return 'iconSets';
    if (lowered === 'themes') return 'themes';
    if (lowered === 'creator') return 'creator';
    if (lowered === 'library') return 'library';
    return SAGA_STORAGE_MANAGED_DOMAINS.includes(fallback) ? fallback : 'storage';
}

function normalizeStoragePath(value = '', fallback = '') {
    try {
        return assertSagaUserFilesPath(value, fallback ? undefined : {});
    } catch {
        if (!fallback) return '';
        try {
            return assertSagaUserFilesPath(fallback);
        } catch {
            return '';
        }
    }
}

function normalizeDeletionMode(value = '', fallback = 'managed') {
    return SAGA_STORAGE_DELETION_MODES.includes(value) ? value : fallback;
}

function normalizeMime(path = '', value = '') {
    const explicit = normalizeString(value, 120);
    if (explicit) return explicit;
    const extension = String(path || '').split('.').pop()?.toLowerCase() || '';
    if (extension === 'json') return 'application/json';
    if (extension === 'png') return 'image/png';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'webp') return 'image/webp';
    if (extension === 'avif') return 'image/avif';
    return 'application/octet-stream';
}

function getClockNow(options = {}) {
    if (typeof options.now === 'function') return normalizeTimestamp(options.now(), Date.now());
    if (options.now !== undefined) return normalizeTimestamp(options.now, Date.now());
    return Date.now();
}

function sortObjectByKey(value = {}) {
    return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)));
}

export function normalizeSagaStorageFileRecord(path = '', value = {}, options = {}) {
    const safePath = normalizeStoragePath(path);
    if (!safePath) return null;
    const raw = isPlainObject(value) ? value : {};
    const now = normalizeTimestamp(options.now, 0);
    const domain = normalizeDomainKey(raw.domain, options.domain || 'storage');
    const createdAt = normalizeTimestamp(raw.createdAt, now);
    const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt || now);
    const record = {
        kind: normalizeSagaStorageId(raw.kind || options.kind || 'storage_file', 'storage_file', 80),
        domain,
        ownerId: normalizeSagaStorageId(raw.ownerId || options.ownerId || domain, domain, 160),
        mime: normalizeMime(safePath, raw.mime || options.mime || ''),
        bytes: normalizeTimestamp(raw.bytes, 0),
        createdAt,
        updatedAt,
        deletion: normalizeDeletionMode(raw.deletion || options.deletion, options.deletion || 'managed'),
    };
    const sha256 = normalizeSagaStorageHash(raw.sha256 || options.sha256 || '', 64);
    if (sha256) record.sha256 = sha256;
    return record;
}

export function normalizeSagaStorageDomainRecord(value = {}, domain = 'library', options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const fallbackIndexFile = options.indexFile || SAGA_STORAGE_DOMAIN_INDEX_FILES[domain] || '';
    return {
        indexFile: normalizeStoragePath(raw.indexFile || fallbackIndexFile, fallbackIndexFile),
        updatedAt: normalizeTimestamp(raw.updatedAt, options.now || 0),
    };
}

export function normalizeSagaStorageDomains(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const domains = {};
    for (const domain of SAGA_STORAGE_DOMAIN_KEYS) {
        domains[domain] = normalizeSagaStorageDomainRecord(raw[domain], domain, {
            now: options.now,
            indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES[domain],
        });
    }
    return domains;
}

export function normalizeSagaStorageFiles(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const files = {};
    for (const [path, record] of Object.entries(raw)) {
        const normalized = normalizeSagaStorageFileRecord(path, record, options);
        if (normalized) files[normalizeStoragePath(path)] = normalized;
    }
    return sortObjectByKey(files);
}

export function normalizeSagaStorageIntegrityCheck(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const missingFiles = Array.isArray(raw.missingFiles)
        ? raw.missingFiles.map(path => normalizeStoragePath(path)).filter(Boolean)
        : [];
    const orphanedFiles = Array.isArray(raw.orphanedFiles)
        ? raw.orphanedFiles.map(path => normalizeStoragePath(path)).filter(Boolean)
        : [];
    const status = SAGA_STORAGE_INTEGRITY_STATUSES.includes(raw.status)
        ? raw.status
        : (missingFiles.length ? 'missing_files' : 'unknown');
    return {
        checkedAt: normalizeTimestamp(raw.checkedAt, options.now || 0),
        missingFiles: [...new Set(missingFiles)].sort(),
        orphanedFiles: [...new Set(orphanedFiles)].sort(),
        status,
    };
}

export function createSagaStorageIndex(options = {}) {
    const now = getClockNow(options);
    const files = {};
    files[SAGA_STORAGE_INDEX_PATH] = normalizeSagaStorageFileRecord(SAGA_STORAGE_INDEX_PATH, {
        kind: 'storage_index',
        domain: 'storage',
        ownerId: 'storage',
        mime: 'application/json',
        createdAt: now,
        updatedAt: now,
        deletion: 'managed',
    }, { now });
    return {
        schemaVersion: SAGA_STORAGE_INDEX_SCHEMA_VERSION,
        kind: SAGA_STORAGE_INDEX_KIND,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        domains: normalizeSagaStorageDomains({}, { now }),
        files,
        lastIntegrityCheck: normalizeSagaStorageIntegrityCheck({}, { now: 0 }),
    };
}

export function normalizeSagaStorageIndex(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const createdAt = normalizeTimestamp(raw.createdAt, options.now || 0);
    const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt);
    const normalized = {
        schemaVersion: SAGA_STORAGE_INDEX_SCHEMA_VERSION,
        kind: SAGA_STORAGE_INDEX_KIND,
        createdAt,
        updatedAt,
        revision: normalizeRevision(raw.revision, 1),
        domains: normalizeSagaStorageDomains(raw.domains, { now: updatedAt }),
        files: normalizeSagaStorageFiles(raw.files, { now: updatedAt }),
        lastIntegrityCheck: normalizeSagaStorageIntegrityCheck(raw.lastIntegrityCheck, { now: 0 }),
    };
    if (options.includeSelfRecord !== false && !normalized.files[SAGA_STORAGE_INDEX_PATH]) {
        normalized.files[SAGA_STORAGE_INDEX_PATH] = normalizeSagaStorageFileRecord(SAGA_STORAGE_INDEX_PATH, {
            kind: 'storage_index',
            domain: 'storage',
            ownerId: 'storage',
            mime: 'application/json',
            createdAt: createdAt || updatedAt || 0,
            updatedAt: updatedAt || createdAt || 0,
            deletion: 'managed',
        }, { now: updatedAt || createdAt || 0 });
        normalized.files = sortObjectByKey(normalized.files);
    }
    return normalized;
}

export function touchSagaStorageIndex(index = {}, options = {}) {
    const now = getClockNow(options);
    const normalized = normalizeSagaStorageIndex(index, { now });
    normalized.updatedAt = now;
    if (options.bumpRevision !== false) normalized.revision = normalizeRevision(normalized.revision + 1, 2);
    return normalized;
}

export function upsertSagaStorageFile(index = {}, path = '', record = {}, options = {}) {
    const now = getClockNow(options);
    const normalized = normalizeSagaStorageIndex(index, { now });
    const safePath = assertSagaUserFilesPath(path);
    const existing = normalized.files[safePath] || {};
    const nextRecord = normalizeSagaStorageFileRecord(safePath, {
        ...existing,
        ...record,
        createdAt: existing.createdAt || record.createdAt || now,
        updatedAt: record.updatedAt || now,
    }, {
        now,
        domain: record.domain || existing.domain || options.domain,
        ownerId: record.ownerId || existing.ownerId || options.ownerId,
        kind: record.kind || existing.kind || options.kind,
        deletion: record.deletion || existing.deletion || options.deletion,
    });
    if (!nextRecord) return normalized;
    normalized.files[safePath] = nextRecord;
    normalized.files = sortObjectByKey(normalized.files);
    return touchSagaStorageIndex(normalized, { now, bumpRevision: options.bumpRevision !== false });
}

export function unregisterSagaStorageFile(index = {}, path = '', options = {}) {
    const now = getClockNow(options);
    const normalized = normalizeSagaStorageIndex(index, { now });
    const safePath = assertSagaUserFilesPath(path);
    if (!normalized.files[safePath]) return normalized;
    delete normalized.files[safePath];
    normalized.files = sortObjectByKey(normalized.files);
    return touchSagaStorageIndex(normalized, { now, bumpRevision: options.bumpRevision !== false });
}

export function setSagaStorageDomainIndexFile(index = {}, domain = '', indexFile = '', options = {}) {
    const now = getClockNow(options);
    const normalized = normalizeSagaStorageIndex(index, { now });
    const domainKey = normalizeDomainKey(domain, '');
    if (!SAGA_STORAGE_DOMAIN_KEYS.includes(domainKey)) return normalized;
    const fallback = SAGA_STORAGE_DOMAIN_INDEX_FILES[domainKey];
    normalized.domains[domainKey] = normalizeSagaStorageDomainRecord({
        indexFile,
        updatedAt: now,
    }, domainKey, { now, indexFile: fallback });
    return touchSagaStorageIndex(normalized, { now, bumpRevision: options.bumpRevision !== false });
}

export function createDefaultSagaStorageSettings(options = {}) {
    return {
        schemaVersion: SAGA_STORAGE_INDEX_SCHEMA_VERSION,
        enabled: options.enabled !== false,
        masterIndexFile: SAGA_STORAGE_INDEX_PATH,
        libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
        creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
        iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
        lastVerifiedAt: normalizeTimestamp(options.lastVerifiedAt, 0),
        lastMigrationAt: normalizeTimestamp(options.lastMigrationAt, 0),
        migrationVersion: normalizeString(options.migrationVersion || '', 80),
    };
}

export function normalizeSagaStorageSettings(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const defaults = createDefaultSagaStorageSettings();
    return {
        schemaVersion: SAGA_STORAGE_INDEX_SCHEMA_VERSION,
        enabled: raw.enabled !== false,
        masterIndexFile: normalizeStoragePath(raw.masterIndexFile, defaults.masterIndexFile),
        libraryIndexFile: normalizeStoragePath(raw.libraryIndexFile, defaults.libraryIndexFile),
        creatorIndexFile: normalizeStoragePath(raw.creatorIndexFile, defaults.creatorIndexFile),
        themeIndexFile: normalizeStoragePath(raw.themeIndexFile, defaults.themeIndexFile),
        iconSetIndexFile: normalizeStoragePath(raw.iconSetIndexFile, defaults.iconSetIndexFile),
        lastVerifiedAt: normalizeTimestamp(raw.lastVerifiedAt, 0),
        lastMigrationAt: normalizeTimestamp(raw.lastMigrationAt, 0),
        migrationVersion: normalizeString(raw.migrationVersion || '', 80),
    };
}

export function createDefaultSagaStorageFallback(options = {}) {
    return {
        libraryIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
        creatorIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        themeIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
        iconSetIndexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
        updatedAt: normalizeTimestamp(options.updatedAt, 0),
    };
}

export function normalizeSagaStorageFallback(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const defaults = createDefaultSagaStorageFallback();
    return {
        libraryIndexFile: normalizeStoragePath(raw.libraryIndexFile, defaults.libraryIndexFile),
        creatorIndexFile: normalizeStoragePath(raw.creatorIndexFile, defaults.creatorIndexFile),
        themeIndexFile: normalizeStoragePath(raw.themeIndexFile, defaults.themeIndexFile),
        iconSetIndexFile: normalizeStoragePath(raw.iconSetIndexFile, defaults.iconSetIndexFile),
        updatedAt: normalizeTimestamp(raw.updatedAt, 0),
    };
}

export function createSagaStorageIndexFromSettings(settings = {}, options = {}) {
    const storage = normalizeSagaStorageSettings(settings.sagaStorage || {});
    const fallback = normalizeSagaStorageFallback(settings.sagaStorageFallback || {});
    const now = getClockNow(options);
    const index = createSagaStorageIndex({ now });
    index.domains.library.indexFile = storage.libraryIndexFile || fallback.libraryIndexFile;
    index.domains.creator.indexFile = storage.creatorIndexFile || fallback.creatorIndexFile;
    index.domains.themes.indexFile = storage.themeIndexFile || fallback.themeIndexFile;
    index.domains.iconSets.indexFile = storage.iconSetIndexFile || fallback.iconSetIndexFile;
    index.updatedAt = now;
    return normalizeSagaStorageIndex(index, { now });
}

export function getSagaStorageBootstrapFromIndex(index = {}, options = {}) {
    const normalized = normalizeSagaStorageIndex(index, options);
    return normalizeSagaStorageSettings({
        masterIndexFile: SAGA_STORAGE_INDEX_PATH,
        libraryIndexFile: normalized.domains.library?.indexFile,
        creatorIndexFile: normalized.domains.creator?.indexFile,
        themeIndexFile: normalized.domains.themes?.indexFile,
        iconSetIndexFile: normalized.domains.iconSets?.indexFile,
        lastVerifiedAt: normalized.lastIntegrityCheck?.checkedAt || 0,
        migrationVersion: options.migrationVersion || '',
    });
}

export function getSagaStorageFallbackFromIndex(index = {}, options = {}) {
    const normalized = normalizeSagaStorageIndex(index, options);
    return normalizeSagaStorageFallback({
        libraryIndexFile: normalized.domains.library?.indexFile,
        creatorIndexFile: normalized.domains.creator?.indexFile,
        themeIndexFile: normalized.domains.themes?.indexFile,
        iconSetIndexFile: normalized.domains.iconSets?.indexFile,
        updatedAt: normalized.updatedAt || 0,
    });
}

export function getSagaStorageFilesForOwner(index = {}, ownerId = '', options = {}) {
    const normalized = normalizeSagaStorageIndex(index, options);
    const cleanOwnerId = normalizeSagaStorageId(ownerId, '', 160);
    if (!cleanOwnerId) return [];
    return Object.entries(normalized.files)
        .filter(([, record]) => record.ownerId === cleanOwnerId)
        .map(([path, record]) => ({ path, ...cloneJson(record) }));
}

export function getSagaStorageDeleteCandidatesForOwner(index = {}, ownerId = '', options = {}) {
    return getSagaStorageFilesForOwner(index, ownerId, options)
        .filter(record => record.deletion !== 'external_reference');
}

const storageIndexMutationQueues = new WeakMap();

function queueSagaStorageIndexMutation(fileApi, action) {
    const previous = storageIndexMutationQueues.get(fileApi) || Promise.resolve();
    const next = previous.catch(() => {}).then(action);
    storageIndexMutationQueues.set(fileApi, next.catch(() => {}));
    return next;
}

export function createSagaStorageIndexStore(options = {}) {
    const fileApi = options.fileApi;
    const now = () => getClockNow({ now: options.now });

    function requireFileApi() {
        if (!fileApi || typeof fileApi !== 'object') {
            throw new Error('Saga storage index requires a file API.');
        }
        return fileApi;
    }

    async function readIndex(readOptions = {}) {
        const api = requireFileApi();
        try {
            const raw = await api.readJsonFile(SAGA_STORAGE_INDEX_PATH);
            return normalizeSagaStorageIndex(raw, { now: now() });
        } catch (error) {
            if (readOptions.allowMissing && (error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) {
                return createSagaStorageIndex({ now: now() });
            }
            throw error;
        }
    }

    async function writeIndex(index = {}, writeOptions = {}) {
        const api = requireFileApi();
        const normalized = writeOptions.bumpRevision !== false
            ? touchSagaStorageIndex(index, { now: now(), bumpRevision: true })
            : normalizeSagaStorageIndex(index, { now: now() });
        const result = await api.writeJsonFile(SAGA_STORAGE_INDEX_FILE_NAME, normalized, {
            pretty: writeOptions.pretty,
        });
        return { ...result, index: normalized };
    }

    async function initializeIndex(initOptions = {}) {
        const index = createSagaStorageIndex({ now: now() });
        return writeIndex(index, { ...initOptions, bumpRevision: false });
    }

    async function registerFile(path = '', record = {}, registerOptions = {}) {
        const api = requireFileApi();
        return queueSagaStorageIndexMutation(api, async () => {
            const index = await readIndex({ allowMissing: true });
            const next = upsertSagaStorageFile(index, path, record, { ...registerOptions, now: now() });
            return writeIndex(next, { pretty: registerOptions.pretty, bumpRevision: false });
        });
    }

    async function unregisterFile(path = '', unregisterOptions = {}) {
        const api = requireFileApi();
        return queueSagaStorageIndexMutation(api, async () => {
            const index = await readIndex({ allowMissing: true });
            const next = unregisterSagaStorageFile(index, path, { ...unregisterOptions, now: now() });
            return writeIndex(next, { pretty: unregisterOptions.pretty, bumpRevision: false });
        });
    }

    async function verifyIndexFiles(index = null, verifyOptions = {}) {
        const api = requireFileApi();
        const current = normalizeSagaStorageIndex(index || await readIndex({ allowMissing: true }), { now: now() });
        const paths = Object.keys(current.files);
        const result = paths.length ? await api.verifyFiles(paths) : {};
        const missingFiles = paths.filter(path => result[path] !== true).sort();
        const next = {
            ...current,
            lastIntegrityCheck: {
                checkedAt: now(),
                missingFiles,
                orphanedFiles: [],
                status: missingFiles.length ? 'missing_files' : 'ok',
            },
        };
        const normalized = touchSagaStorageIndex(next, {
            now: next.lastIntegrityCheck.checkedAt,
            bumpRevision: verifyOptions.bumpRevision === true,
        });
        if (verifyOptions.write) {
            const written = await writeIndex(normalized, {
                pretty: verifyOptions.pretty,
                bumpRevision: false,
            });
            return { ...written, result, missingFiles, status: normalized.lastIntegrityCheck.status };
        }
        return { index: normalized, result, missingFiles, status: normalized.lastIntegrityCheck.status };
    }

    return {
        getIndexPath: () => SAGA_STORAGE_INDEX_PATH,
        initializeIndex,
        readIndex,
        writeIndex,
        registerFile,
        unregisterFile,
        verifyIndexFiles,
    };
}
