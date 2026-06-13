/**
 * Generic storage helpers for Saga domain indexes and payload files.
 */

import {
    assertSagaUserFilesPath,
    buildSagaJsonStorageFileName,
    getSagaUserFilesFileName,
    normalizeSagaStorageId,
    SAGA_STORAGE_JSON_EXTENSION,
    toSagaUserFilesPath,
} from './saga-storage-filenames.js';
import {
    createSagaStorageIndexStore,
    normalizeSagaStorageIndex,
    SAGA_STORAGE_DOMAIN_INDEX_FILES,
} from './saga-storage-index.js';

export const SAGA_DOMAIN_STORAGE_SCHEMA_VERSION = 1;

export const SAGA_DOMAIN_STORAGE_CONFIGS = Object.freeze({
    library: Object.freeze({
        domain: 'library',
        indexKind: 'saga_library_index',
        indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
        collectionKey: 'packs',
        idKey: 'packId',
        payloadFileKind: 'pack',
        payloadRecordKind: 'lorepack_payload',
        indexRecordKind: 'library_index',
        extraArrayKeys: Object.freeze(['folders', 'deckPlacements', 'activeStack']),
    }),
    creator: Object.freeze({
        domain: 'creator',
        indexKind: 'saga_creator_index',
        indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        collectionKey: 'projects',
        idKey: 'projectId',
        payloadFileKind: 'creator-project',
        payloadRecordKind: 'creator_project_payload',
        indexRecordKind: 'creator_index',
    }),
    themes: Object.freeze({
        domain: 'themes',
        indexKind: 'saga_theme_index',
        indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
        collectionKey: 'packs',
        idKey: 'themeId',
        payloadFileKind: 'theme-pack',
        payloadRecordKind: 'theme_pack_payload',
        indexRecordKind: 'theme_index',
    }),
    iconSets: Object.freeze({
        domain: 'iconSets',
        indexKind: 'saga_iconset_index',
        indexFile: SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
        collectionKey: 'iconSets',
        idKey: 'iconSetId',
        payloadFileKind: 'iconset',
        payloadRecordKind: 'iconset_payload',
        indexRecordKind: 'iconset_index',
    }),
});

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
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

function getClockNow(options = {}) {
    if (typeof options.now === 'function') return normalizeTimestamp(options.now(), Date.now());
    if (options.now !== undefined) return normalizeTimestamp(options.now, Date.now());
    return Date.now();
}

function normalizeString(value = '', maxLength = 500) {
    return String(value || '').trim().slice(0, Math.max(1, Number(maxLength) || 500));
}

function normalizeStoragePath(value = '') {
    try {
        return assertSagaUserFilesPath(value);
    } catch {
        return '';
    }
}

function sortObjectByKey(value = {}) {
    return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizePointerFields(record = {}) {
    const next = { ...record };
    for (const key of ['payloadFile', 'payloadPath', 'indexFile', 'coverFile', 'assetFile', 'file']) {
        if (next[key] === undefined) continue;
        const path = normalizeStoragePath(next[key]);
        if (path) next[key] = path;
        else delete next[key];
    }
    if (Array.isArray(next.assetFiles)) {
        next.assetFiles = [...new Set(next.assetFiles.map(path => normalizeStoragePath(path)).filter(Boolean))].sort();
    } else if (isPlainObject(next.assetFiles)) {
        next.assetFiles = sortObjectByKey(Object.fromEntries(
            Object.entries(next.assetFiles)
                .map(([key, path]) => [normalizeString(key, 80), normalizeStoragePath(path)])
                .filter(([key, path]) => key && path)
        ));
    }
    return next;
}

export function getSagaDomainStorageConfig(domain = '') {
    const direct = SAGA_DOMAIN_STORAGE_CONFIGS[domain];
    if (direct) return direct;
    const normalized = String(domain || '').trim().toLowerCase().replace(/[_-]+/g, '');
    if (normalized === 'iconsets') return SAGA_DOMAIN_STORAGE_CONFIGS.iconSets;
    if (normalized === 'theme' || normalized === 'themes') return SAGA_DOMAIN_STORAGE_CONFIGS.themes;
    if (normalized === 'creator') return SAGA_DOMAIN_STORAGE_CONFIGS.creator;
    if (normalized === 'library') return SAGA_DOMAIN_STORAGE_CONFIGS.library;
    throw new Error(`Unknown Saga storage domain: ${domain || '(missing)'}.`);
}

export function getSagaDomainIndexFileName(domain = '') {
    return getSagaUserFilesFileName(getSagaDomainStorageConfig(domain).indexFile);
}

export function buildSagaDomainPayloadFileName(domain = '', ownerId = '', options = {}) {
    const config = getSagaDomainStorageConfig(domain);
    return buildSagaJsonStorageFileName(config.payloadFileKind, ownerId, options);
}

export function buildSagaDomainPayloadPath(domain = '', ownerId = '', options = {}) {
    return toSagaUserFilesPath(buildSagaDomainPayloadFileName(domain, ownerId, options), {
        allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
    });
}

export function createSagaDomainIndex(domain = '', options = {}) {
    const config = getSagaDomainStorageConfig(domain);
    const now = getClockNow(options);
    return {
        schemaVersion: SAGA_DOMAIN_STORAGE_SCHEMA_VERSION,
        kind: config.indexKind,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        [config.collectionKey]: {},
    };
}

export function normalizeSagaDomainIndexRecord(domain = '', value = {}, fallbackId = '', options = {}) {
    const config = getSagaDomainStorageConfig(domain);
    const raw = isPlainObject(value) ? cloneJson(value) : {};
    const id = normalizeSagaStorageId(
        raw[config.idKey] || raw.id || raw.packId || raw.projectId || raw.themeId || raw.iconSetId || fallbackId,
        '',
        160,
    );
    if (!id) return null;
    const createdAt = normalizeTimestamp(raw.createdAt || raw.installedAt, options.now || 0);
    const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt);
    const normalized = normalizePointerFields(raw);
    normalized[config.idKey] = id;
    if (config.idKey !== 'id') normalized.id = normalizeString(normalized.id || id, 160);
    normalized.type = normalizeString(normalized.type || 'custom', 80);
    normalized.title = normalizeString(normalized.title || id, 240);
    normalized.createdAt = createdAt;
    normalized.updatedAt = updatedAt;
    return normalized;
}

export function normalizeSagaDomainIndex(domain = '', value = {}, options = {}) {
    const config = getSagaDomainStorageConfig(domain);
    const raw = isPlainObject(value) ? value : {};
    const createdAt = normalizeTimestamp(raw.createdAt, options.now || 0);
    const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt);
    const sourceRecords = isPlainObject(raw[config.collectionKey]) ? raw[config.collectionKey] : {};
    const records = {};
    for (const [id, record] of Object.entries(sourceRecords)) {
        const normalized = normalizeSagaDomainIndexRecord(config.domain, record, id, { now: updatedAt });
        if (normalized) records[normalized[config.idKey]] = normalized;
    }
    const normalized = {
        schemaVersion: SAGA_DOMAIN_STORAGE_SCHEMA_VERSION,
        kind: config.indexKind,
        createdAt,
        updatedAt,
        revision: normalizeRevision(raw.revision, 1),
        [config.collectionKey]: sortObjectByKey(records),
    };
    for (const key of config.extraArrayKeys || []) {
        normalized[key] = Array.isArray(raw[key]) ? cloneJson(raw[key]) : [];
    }
    return normalized;
}

export function upsertSagaDomainIndexRecord(domain = '', index = {}, record = {}, options = {}) {
    const config = getSagaDomainStorageConfig(domain);
    const now = getClockNow(options);
    const normalized = normalizeSagaDomainIndex(config.domain, index, { now });
    const nextRecord = normalizeSagaDomainIndexRecord(config.domain, record, '', { now });
    if (!nextRecord) return normalized;
    const id = nextRecord[config.idKey];
    const existing = normalized[config.collectionKey][id] || {};
    normalized[config.collectionKey][id] = {
        ...existing,
        ...nextRecord,
        createdAt: existing.createdAt || nextRecord.createdAt || now,
        updatedAt: nextRecord.updatedAt || now,
    };
    normalized[config.collectionKey] = sortObjectByKey(normalized[config.collectionKey]);
    normalized.updatedAt = now;
    if (options.bumpRevision !== false) normalized.revision = normalizeRevision(normalized.revision + 1, 2);
    return normalized;
}

export function removeSagaDomainIndexRecord(domain = '', index = {}, id = '', options = {}) {
    const config = getSagaDomainStorageConfig(domain);
    const now = getClockNow(options);
    const normalized = normalizeSagaDomainIndex(config.domain, index, { now });
    const cleanId = normalizeSagaStorageId(id, '', 160);
    if (!cleanId || !normalized[config.collectionKey][cleanId]) return normalized;
    delete normalized[config.collectionKey][cleanId];
    normalized[config.collectionKey] = sortObjectByKey(normalized[config.collectionKey]);
    normalized.updatedAt = now;
    if (options.bumpRevision !== false) normalized.revision = normalizeRevision(normalized.revision + 1, 2);
    return normalized;
}

export function createSagaDomainStorage(options = {}) {
    const fileApi = options.fileApi;
    const storageIndexStore = options.storageIndexStore || (fileApi ? createSagaStorageIndexStore({
        fileApi,
        now: options.now,
    }) : null);
    const now = () => getClockNow({ now: options.now });

    function requireFileApi() {
        if (!fileApi || typeof fileApi !== 'object') {
            throw new Error('Saga domain storage requires a file API.');
        }
        return fileApi;
    }

    async function registerInMaster(path = '', record = {}, registerOptions = {}) {
        if (registerOptions.registerInMaster === false || !storageIndexStore) return null;
        return storageIndexStore.registerFile(path, record, registerOptions);
    }

    async function readDomainIndex(domain = '', readOptions = {}) {
        const api = requireFileApi();
        const config = getSagaDomainStorageConfig(domain);
        try {
            const raw = await api.readJsonFile(config.indexFile);
            return normalizeSagaDomainIndex(config.domain, raw, { now: now() });
        } catch (error) {
            if (readOptions.allowMissing && (error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) {
                return createSagaDomainIndex(config.domain, { now: now() });
            }
            throw error;
        }
    }

    async function writeDomainIndex(domain = '', index = {}, writeOptions = {}) {
        const api = requireFileApi();
        const config = getSagaDomainStorageConfig(domain);
        const normalized = writeOptions.bumpRevision === false
            ? normalizeSagaDomainIndex(config.domain, index, { now: now() })
            : {
                ...normalizeSagaDomainIndex(config.domain, index, { now: now() }),
                updatedAt: now(),
            };
        if (writeOptions.bumpRevision !== false) {
            normalized.revision = normalizeRevision(normalized.revision + 1, 2);
        }
        const result = await api.writeJsonFile(getSagaDomainIndexFileName(config.domain), normalized, {
            pretty: writeOptions.pretty,
        });
        await registerInMaster(config.indexFile, {
            kind: config.indexRecordKind,
            domain: config.domain,
            ownerId: config.domain,
            mime: 'application/json',
            deletion: 'managed',
        }, writeOptions);
        return { ...result, index: normalized };
    }

    async function writePayload(domain = '', ownerId = '', payload = {}, writeOptions = {}) {
        const api = requireFileApi();
        const config = getSagaDomainStorageConfig(domain);
        const cleanOwnerId = normalizeSagaStorageId(ownerId || payload?.id || payload?.[config.idKey], config.domain, 160);
        const fileName = buildSagaDomainPayloadFileName(config.domain, cleanOwnerId, writeOptions);
        const result = await api.writeJsonFile(fileName, payload, {
            pretty: writeOptions.pretty,
        });
        await registerInMaster(result.path, {
            kind: writeOptions.kind || config.payloadRecordKind,
            domain: config.domain,
            ownerId: cleanOwnerId,
            mime: 'application/json',
            deletion: writeOptions.deletion || 'delete_with_owner',
            bytes: Number(writeOptions.bytes) || 0,
            sha256: writeOptions.sha256 || '',
        }, writeOptions);
        return { ...result, ownerId: cleanOwnerId };
    }

    async function upsertRecord(domain = '', record = {}, upsertOptions = {}) {
        const config = getSagaDomainStorageConfig(domain);
        const index = await readDomainIndex(config.domain, { allowMissing: true });
        const next = upsertSagaDomainIndexRecord(config.domain, index, record, {
            ...upsertOptions,
            now: now(),
        });
        return writeDomainIndex(config.domain, next, {
            ...upsertOptions,
            bumpRevision: false,
        });
    }

    async function removeRecord(domain = '', id = '', removeOptions = {}) {
        const config = getSagaDomainStorageConfig(domain);
        const index = await readDomainIndex(config.domain, { allowMissing: true });
        const next = removeSagaDomainIndexRecord(config.domain, index, id, {
            ...removeOptions,
            now: now(),
        });
        return writeDomainIndex(config.domain, next, {
            ...removeOptions,
            bumpRevision: false,
        });
    }

    async function readMasterIndex(readOptions = {}) {
        if (!storageIndexStore || typeof storageIndexStore.readIndex !== 'function') return null;
        return normalizeSagaStorageIndex(await storageIndexStore.readIndex(readOptions), { now: now() });
    }

    return {
        readDomainIndex,
        writeDomainIndex,
        writePayload,
        upsertRecord,
        removeRecord,
        readMasterIndex,
    };
}
