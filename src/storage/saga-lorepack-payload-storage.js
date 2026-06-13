/**
 * External Lorepack payload storage.
 */

import { normalizeLoredeckRegistry } from '../state/lore-state-normalizers.js';
import { createSagaDomainStorage, buildSagaDomainPayloadPath } from './saga-domain-storage.js';
import { createSagaFileApi } from './saga-file-api.js';
import { createSagaStorageIndexStore } from './saga-storage-index.js';
import {
    assertSagaUserFilesPath,
    buildSagaAssetStorageFileName,
    normalizeSagaAssetRole,
    normalizeSagaStorageId,
    SAGA_STORAGE_JSON_EXTENSION,
    SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
    toSagaUserFilesPath,
} from './saga-storage-filenames.js';
import {
    assertSagaStorageRevisionFresh,
} from './saga-storage-stale-write.js';

const EMPTY_LIBRARY_REGISTRY = Object.freeze({ schemaVersion: 1, packs: Object.freeze({}) });
const LOREPACK_PAYLOAD_KIND = 'saga_lorepack_payload';

let payloadRuntimeOptions = {};
let payloadCache = new Map();
let payloadCacheSequences = new Map();
let payloadCacheSequence = 0;
let pendingPayloadWrite = Promise.resolve();
let pendingPayloadWriteCount = 0;
let lastPayloadWriteError = '';

export function configureSagaLorepackPayloadStorage(options = {}) {
    payloadRuntimeOptions = { ...payloadRuntimeOptions, ...(options || {}) };
}

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

function resolveStorageOptions(options = {}) {
    return { ...(payloadRuntimeOptions || {}), ...(options || {}) };
}

function getClockNow(options = {}) {
    const merged = resolveStorageOptions(options);
    if (typeof merged.now === 'function') return normalizeTimestamp(merged.now(), Date.now());
    if (merged.now !== undefined) return normalizeTimestamp(merged.now, Date.now());
    return Date.now();
}

function getFileApi(options = {}) {
    const merged = resolveStorageOptions(options);
    return merged.fileApi || createSagaFileApi(merged.fileApiOptions || {});
}

function getStorageIndexStore(options = {}) {
    const merged = resolveStorageOptions(options);
    return merged.storageIndexStore || createSagaStorageIndexStore({
        fileApi: getFileApi(options),
        now: merged.now,
    });
}

function getDomainStorage(options = {}) {
    const merged = resolveStorageOptions(options);
    return merged.domainStorage || createSagaDomainStorage({
        fileApi: getFileApi(options),
        storageIndexStore: getStorageIndexStore(options),
        now: merged.now,
    });
}

function normalizeStoragePath(value = '') {
    try {
        return assertSagaUserFilesPath(value, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    } catch {
        return '';
    }
}

function normalizeAnySagaStoragePath(value = '') {
    try {
        return assertSagaUserFilesPath(value);
    } catch {
        return '';
    }
}

function getPackId(value = {}, fallback = '') {
    const raw = isPlainObject(value) ? value : {};
    return normalizeSagaStorageId(raw.packId || raw.id || fallback, '', 160);
}

function getEntryOverrideCount(pack = {}) {
    return pack.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? Object.keys(pack.entryOverrides).length
        : 0;
}

function getTagCount(pack = {}) {
    const tags = pack.tagRegistry?.tags;
    return tags && typeof tags === 'object' && !Array.isArray(tags) ? Object.keys(tags).length : 0;
}

function getTimelineEventCount(pack = {}) {
    const anchors = Array.isArray(pack.timelineRegistry?.anchors) ? pack.timelineRegistry.anchors.length : 0;
    const windows = Array.isArray(pack.timelineRegistry?.windows) ? pack.timelineRegistry.windows.length : 0;
    return anchors + windows;
}

function parseDataUrl(value = '') {
    const match = String(value || '').trim().match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return null;
    const mime = match[1].trim().toLowerCase();
    const base64 = match[2].replace(/\s+/g, '');
    if (!base64) return null;
    const extension = mime === 'image/png'
        ? 'png'
        : mime === 'image/webp'
            ? 'webp'
            : (mime === 'image/jpeg' || mime === 'image/jpg')
                ? 'jpg'
                : mime === 'image/avif'
                    ? 'avif'
                    : '';
    if (!SAGA_STORAGE_RASTER_ASSET_EXTENSIONS.includes(extension)) return null;
    return { mime, base64, extension };
}

function hashText32(value = '') {
    let hash = 0x811c9dc5;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function getAssetUploadForDataUrl(packId = '', role = '', dataUrl = '') {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return null;
    const cleanRole = normalizeSagaAssetRole(role, 'asset', 48);
    const fileName = buildSagaAssetStorageFileName('pack', packId, cleanRole, parsed.extension, {
        hash: hashText32(parsed.base64).slice(0, 8),
    });
    return {
        fileName,
        path: toSagaUserFilesPath(fileName, { allowedExtensions: SAGA_STORAGE_RASTER_ASSET_EXTENSIONS }),
        role: cleanRole,
        mime: parsed.mime,
        base64: parsed.base64,
    };
}

function collectAssetPaths(value = {}) {
    const paths = new Set();
    const visit = item => {
        if (!item) return;
        if (typeof item === 'string') {
            const path = normalizeAnySagaStoragePath(item);
            if (path) paths.add(path);
            return;
        }
        if (!isPlainObject(item)) return;
        for (const key of ['path', 'storagePath', 'url', 'src']) {
            const path = normalizeAnySagaStoragePath(item[key]);
            if (path) paths.add(path);
        }
        for (const child of Object.values(item)) {
            if (isPlainObject(child)) visit(child);
        }
    };
    visit(value);
    return [...paths].sort();
}

function getCoverAssetPath(pack = {}) {
    const direct = normalizeAnySagaStoragePath(pack.coverFile || pack.coverPath || pack.coverImage || '');
    if (direct) return direct;
    const refCover = normalizeAnySagaStoragePath(pack.assetRefs?.cover || '');
    if (refCover) return refCover;
    const asset = pack.assets?.cover;
    if (typeof asset === 'string') return normalizeAnySagaStoragePath(asset);
    if (isPlainObject(asset)) return normalizeAnySagaStoragePath(asset.path || asset.storagePath || asset.url || asset.src || '');
    const manifestAsset = pack.manifestData?.assets?.cover;
    if (typeof manifestAsset === 'string') return normalizeAnySagaStoragePath(manifestAsset);
    if (isPlainObject(manifestAsset)) return normalizeAnySagaStoragePath(manifestAsset.path || manifestAsset.storagePath || manifestAsset.url || manifestAsset.src || '');
    return '';
}

function materializeAssetMap(packId = '', assets = {}, existingUploads = []) {
    if (!isPlainObject(assets)) return { assets, uploads: existingUploads };
    const next = cloneJson(assets) || {};
    const uploads = [...existingUploads];
    for (const [role, rawAsset] of Object.entries(next)) {
        if (typeof rawAsset === 'string') {
            const upload = getAssetUploadForDataUrl(packId, role, rawAsset);
            if (upload) {
                uploads.push(upload);
                next[role] = upload.path;
            }
            continue;
        }
        if (!isPlainObject(rawAsset)) continue;
        const upload = getAssetUploadForDataUrl(packId, role, rawAsset.path || rawAsset.storagePath || '');
        if (!upload) continue;
        uploads.push(upload);
        rawAsset.path = upload.path;
        rawAsset.storagePath = upload.path;
        rawAsset.mimeType = rawAsset.mimeType || upload.mime;
        rawAsset.updatedAt = rawAsset.updatedAt || getClockNow();
    }
    return { assets: next, uploads };
}

function prepareExternalLorepackPayloadAssets(payload = {}) {
    const packId = normalizeSagaStorageId(payload.packId || payload.id, 'pack', 160);
    let next = cloneJson(payload) || {};
    let uploads = [];
    const materializedAssets = materializeAssetMap(packId, next.assets, uploads);
    next.assets = materializedAssets.assets;
    uploads = materializedAssets.uploads;
    if (isPlainObject(next.manifestData?.assets)) {
        const materializedManifestAssets = materializeAssetMap(packId, next.manifestData.assets, uploads);
        next.manifestData.assets = materializedManifestAssets.assets;
        uploads = materializedManifestAssets.uploads;
    }
    const assetRefs = {
        ...(isPlainObject(next.assetRefs) ? next.assetRefs : {}),
    };
    for (const [role, asset] of Object.entries(isPlainObject(next.assets) ? next.assets : {})) {
        const path = typeof asset === 'string'
            ? normalizeAnySagaStoragePath(asset)
            : normalizeAnySagaStoragePath(asset?.path || asset?.storagePath || '');
        if (path) assetRefs[normalizeSagaAssetRole(role, 'asset', 48)] = path;
    }
    if (Object.keys(assetRefs).length) next.assetRefs = assetRefs;
    uploads = [...new Map(uploads.map(upload => [upload.path, upload])).values()];
    return { payload: next, assetUploads: uploads };
}

function shouldPersistQueuedWrites(options = {}) {
    const merged = resolveStorageOptions(options);
    if (merged.persistWrites === false || merged.persist === false) return false;
    if (merged.fileApi || merged.domainStorage || merged.storageIndexStore) return true;
    return typeof window !== 'undefined' && typeof fetch === 'function';
}

function recordQueuedWriteError(error = {}, options = {}) {
    const merged = resolveStorageOptions(options);
    lastPayloadWriteError = String(error?.message || error || 'Lorepack payload external storage write failed.');
    if (typeof merged.onWriteError === 'function') {
        merged.onWriteError(error);
        return;
    }
    console.warn('[Saga] Lorepack payload external storage write failed:', error);
}

function isMissingStorageFileError(error = {}) {
    return error?.status === 404 || /missing|not found|404/i.test(String(error?.message || error || ''));
}

async function assertLorepackPayloadWriteFresh(fileApi, payload = {}, expectedRevision = 0) {
    if (!expectedRevision) return true;
    const payloadFile = normalizeStoragePath(payload.payloadFile || '');
    if (!payloadFile) return true;
    let latest = null;
    try {
        latest = await fileApi.readJsonFile(payloadFile, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    } catch (error) {
        if (!(error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) throw error;
        latest = { revision: 1 };
    }
    assertSagaStorageRevisionFresh({
        latest,
        expectedRevision,
        domain: 'lorepack',
        path: payloadFile,
        message: 'Loredeck storage changed. Reload this Loredeck before saving.',
    });
    return true;
}

function nextPayloadCacheSequence() {
    payloadCacheSequence += 1;
    return payloadCacheSequence;
}

function setPayloadCache(payload = {}, options = {}, meta = {}) {
    const normalized = normalizeExternalLorepackPayload(payload, options);
    if (!normalized.packId) return null;
    payloadCache.set(normalized.packId, normalized);
    payloadCacheSequences.set(normalized.packId, Number(meta.sequence) || nextPayloadCacheSequence());
    return cloneJson(normalized);
}

function setPayloadCacheIfNotNewer(payload = {}, options = {}, meta = {}) {
    const normalized = normalizeExternalLorepackPayload(payload, options);
    if (!normalized.packId) return null;
    const current = payloadCache.get(normalized.packId);
    const currentSequence = Number(payloadCacheSequences.get(normalized.packId)) || 0;
    const nextSequence = Number(meta.sequence) || 0;
    if (current && nextSequence && currentSequence > nextSequence) return cloneJson(current);
    const currentRevision = normalizeRevision(current?.revision, 1);
    const nextRevision = normalizeRevision(normalized.revision, 1);
    if (current && currentRevision > nextRevision) return cloneJson(current);
    payloadCache.set(normalized.packId, normalized);
    payloadCacheSequences.set(normalized.packId, nextSequence || nextPayloadCacheSequence());
    return cloneJson(normalized);
}

function queueExternalLorepackPayloadWrite(payload = {}, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingPayloadWrite;
    const merged = resolveStorageOptions(options);
    const staleCheck = merged.staleCheck !== false && pendingPayloadWriteCount === 0;
    const prepared = Array.isArray(merged.assetUploads)
        ? { payload: normalizeExternalLorepackPayload(cloneJson(payload), merged), assetUploads: merged.assetUploads }
        : prepareExternalLorepackPayloadAssets(normalizeExternalLorepackPayload(cloneJson(payload), merged));
    const snapshot = normalizeExternalLorepackPayload(prepared.payload, merged);
    const expectedRevision = staleCheck ? normalizeRevision(snapshot.revision, 1) : 0;
    const payloadSnapshot = normalizeExternalLorepackPayload({
        ...snapshot,
        revision: merged.bumpRevision === false ? expectedRevision || normalizeRevision(snapshot.revision, 1) : normalizeRevision((expectedRevision || normalizeRevision(snapshot.revision, 1)) + 1, 2),
        updatedAt: getClockNow(merged),
    }, merged);
    const assetUploads = prepared.assetUploads;
    const cacheSequence = nextPayloadCacheSequence();
    setPayloadCache(payloadSnapshot, merged, { sequence: cacheSequence });
    pendingPayloadWriteCount += 1;
    pendingPayloadWrite = pendingPayloadWrite
        .catch(() => {})
        .then(async () => {
            try {
                const fileApi = getFileApi(merged);
                const storageIndexStore = getStorageIndexStore(merged);
                await assertLorepackPayloadWriteFresh(fileApi, payloadSnapshot, expectedRevision);
                for (const upload of assetUploads) {
                    await fileApi.uploadBase64File(upload.fileName, upload.base64, {
                        allowedExtensions: SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
                    });
                    if (storageIndexStore?.registerFile) {
                        await storageIndexStore.registerFile(upload.path, {
                            kind: 'lorepack_asset',
                            domain: 'library',
                            ownerId: snapshot.packId,
                            mime: upload.mime,
                            deletion: 'delete_with_owner',
                        }, merged);
                    }
                }
                const domainStorage = getDomainStorage(merged);
                await domainStorage.writePayload('library', payloadSnapshot.packId, payloadSnapshot, {
                    ...merged,
                    staleCheck,
                    expectedRevision,
                    kind: 'lorepack_payload',
                    deletion: 'delete_with_owner',
                });
                setPayloadCacheIfNotNewer(payloadSnapshot, merged, { sequence: cacheSequence });
                lastPayloadWriteError = '';
            } catch (error) {
                recordQueuedWriteError(error, merged);
            } finally {
                pendingPayloadWriteCount = Math.max(0, pendingPayloadWriteCount - 1);
            }
        });
    return pendingPayloadWrite;
}

function queueExternalLorepackPayloadDelete(packId = '', payloadFile = '', assetFiles = [], options = {}) {
    if (!shouldPersistQueuedWrites(options) || !payloadFile) return pendingPayloadWrite;
    const merged = resolveStorageOptions(options);
    pendingPayloadWriteCount += 1;
    pendingPayloadWrite = pendingPayloadWrite
        .catch(() => {})
        .then(async () => {
            try {
                const fileApi = getFileApi(merged);
                for (const assetPath of assetFiles) {
                    try {
                        await fileApi.deleteFile(assetPath);
                    } catch (error) {
                        if (!isMissingStorageFileError(error)) throw error;
                    }
                }
                try {
                    await fileApi.deleteFile(payloadFile, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
                } catch (error) {
                    if (!isMissingStorageFileError(error)) throw error;
                }
                const storageIndexStore = getStorageIndexStore(merged);
                if (storageIndexStore?.unregisterFile) {
                    for (const assetPath of assetFiles) {
                        await storageIndexStore.unregisterFile(assetPath, merged);
                    }
                    await storageIndexStore.unregisterFile(payloadFile, merged);
                }
                lastPayloadWriteError = '';
            } catch (error) {
                recordQueuedWriteError(error, merged);
            } finally {
                pendingPayloadWriteCount = Math.max(0, pendingPayloadWriteCount - 1);
            }
        });
    return pendingPayloadWrite;
}

export function normalizeExternalLorepackPayload(value = {}, options = {}) {
    const raw = isPlainObject(value) ? cloneJson(value) : {};
    const packId = getPackId(raw, options.packId || '');
    const cached = packId && payloadCache.has(packId) ? payloadCache.get(packId) : null;
    const registryRecord = {
        ...(isPlainObject(cached) ? cloneJson(cached) : {}),
        ...raw,
        packId,
        id: packId,
    };
    const normalized = normalizeLoredeckRegistry(
        { schemaVersion: 1, packs: { [packId || '']: registryRecord } },
        EMPTY_LIBRARY_REGISTRY,
    );
    const pack = normalized.packs?.[packId] || null;
    if (!pack) {
        return {
            schemaVersion: 1,
            kind: LOREPACK_PAYLOAD_KIND,
            revision: 1,
            packId: '',
            id: '',
            type: 'custom',
            title: '',
            entryOverrides: {},
            disabledEntryIds: [],
        };
    }
    const now = getClockNow(options);
    const createdAt = normalizeTimestamp(raw.createdAt || cached?.createdAt || pack.installedAt, now);
    const updatedAt = normalizeTimestamp(raw.updatedAt || pack.updatedAt || cached?.updatedAt, now);
    const payloadFile = normalizeStoragePath(raw.payloadFile || raw.payloadPath || '')
        || normalizeStoragePath(cached?.payloadFile || cached?.payloadPath || '')
        || buildSagaDomainPayloadPath('library', pack.packId);
    const revision = Math.max(
        normalizeRevision(raw.revision, 1),
        normalizeRevision(cached?.revision, 1),
    );
    const payload = {
        ...pack,
        schemaVersion: 1,
        kind: LOREPACK_PAYLOAD_KIND,
        revision,
        packId: pack.packId,
        id: pack.packId,
        payloadFile,
        createdAt,
        updatedAt,
        installedAt: pack.installedAt || createdAt,
        entryOverrides: pack.entryOverrides || {},
        disabledEntryIds: Array.isArray(pack.disabledEntryIds) ? pack.disabledEntryIds : [],
    };
    if (Object.prototype.hasOwnProperty.call(raw, 'healthIssueStates')) {
        payload.healthIssueStates = isPlainObject(raw.healthIssueStates) ? cloneJson(raw.healthIssueStates) : {};
    }
    delete payload.coverFile;
    delete payload.entryCount;
    delete payload.tagCount;
    delete payload.timelineEventCount;
    delete payload.sourceKind;
    return payload;
}

export function createExternalLorepackLibraryRecord(payload = {}, options = {}) {
    const normalized = normalizeExternalLorepackPayload(payload, options);
    const packId = normalized.packId;
    const source = isPlainObject(normalized.source) ? normalized.source : {};
    const stats = isPlainObject(normalized.stats) ? normalized.stats : {};
    const payloadFile = normalizeStoragePath(normalized.payloadFile)
        || buildSagaDomainPayloadPath('library', packId);
    const record = {
        schemaVersion: 1,
        packId,
        id: packId,
        type: normalized.type === 'bundled' ? 'bundled' : (normalized.type || 'custom'),
        title: normalized.title || packId,
        description: normalized.description || '',
        fandom: normalized.fandom || '',
        era: normalized.era || '',
        author: normalized.author || '',
        version: normalized.version || '',
        entrySchemaVersion: Number(normalized.entrySchemaVersion) || 0,
        manifest: normalized.manifest || '',
        source,
        sourceKind: String(source.kind || '').trim(),
        tags: Array.isArray(normalized.tags) ? normalized.tags : [],
        stats,
        entryCount: Math.max(0, Math.floor(Number(stats.entryCount) || getEntryOverrideCount(normalized))),
        tagCount: getTagCount(normalized),
        timelineEventCount: getTimelineEventCount(normalized),
        healthStatus: normalized.healthStatus || '',
        localModified: normalized.localModified === true,
        installedAt: normalizeTimestamp(normalized.installedAt || normalized.createdAt, getClockNow(options)),
        updatedAt: normalizeTimestamp(normalized.updatedAt, getClockNow(options)),
        payloadFile,
    };
    const coverFile = getCoverAssetPath(normalized);
    if (coverFile) record.coverFile = coverFile;
    if (!record.sourceKind) delete record.sourceKind;
    if (isPlainObject(normalized.derivedFrom)) record.derivedFrom = cloneJson(normalized.derivedFrom);
    return record;
}

export function getCachedExternalLorepackPayload(packId = '') {
    const id = normalizeSagaStorageId(packId, '', 160);
    return id && payloadCache.has(id) ? cloneJson(payloadCache.get(id)) : null;
}

export function hasCachedExternalLorepackPayload(packId = '') {
    const id = normalizeSagaStorageId(packId, '', 160);
    return !!(id && payloadCache.has(id));
}

export function isExternalLorepackPayloadBackedRecord(record = {}) {
    return !!normalizeStoragePath(record?.payloadFile || record?.payloadPath || '');
}

export function isExternalLorepackPayloadHydratedRecord(record = {}) {
    if (!isPlainObject(record)) return false;
    const packId = getPackId(record);
    if (packId && hasCachedExternalLorepackPayload(packId)) return true;
    if (isPlainObject(record.manifestData)) return true;
    if (isPlainObject(record.entryOverrides) && Object.keys(record.entryOverrides).length) return true;
    if (isPlainObject(record.tagRegistry) && Object.keys(record.tagRegistry.tags || {}).length) return true;
    if (isPlainObject(record.timelineRegistry) && ((record.timelineRegistry.anchors || []).length || (record.timelineRegistry.windows || []).length)) return true;
    if (Array.isArray(record.pendingChanges) && record.pendingChanges.length) return true;
    return false;
}

export function isCompactExternalLorepackPayloadRecord(record = {}) {
    return isExternalLorepackPayloadBackedRecord(record) && !isExternalLorepackPayloadHydratedRecord(record);
}

export function hydrateCachedExternalLorepackPayloadRecord(record = {}) {
    const packId = getPackId(record);
    if (!packId) return isPlainObject(record) ? cloneJson(record) : null;
    const cached = getCachedExternalLorepackPayload(packId);
    if (!cached) return cloneJson(record);
    const merged = {
        ...cached,
        ...(isPlainObject(record) ? cloneJson(record) : {}),
        revision: normalizeRevision(cached.revision, record.revision || 1),
        manifestData: cached.manifestData,
        entryOverrides: cached.entryOverrides || {},
        disabledEntryIds: Array.isArray(cached.disabledEntryIds) ? cached.disabledEntryIds : [],
        ...(cached.assets ? { assets: cached.assets } : {}),
        ...(cached.tagRegistry ? { tagRegistry: cached.tagRegistry } : {}),
        ...(cached.timelineRegistry ? { timelineRegistry: cached.timelineRegistry } : {}),
        ...(cached.timelineRegistryIssue ? { timelineRegistryIssue: cached.timelineRegistryIssue } : {}),
        ...(cached.pendingChanges ? { pendingChanges: cached.pendingChanges } : {}),
        ...(cached.healthIssueStates ? { healthIssueStates: cached.healthIssueStates } : {}),
        payloadFile: record.payloadFile || cached.payloadFile,
    };
    const normalizedPack = normalizeLoredeckRegistry(
        { schemaVersion: 1, packs: { [packId]: merged } },
        EMPTY_LIBRARY_REGISTRY,
    ).packs[packId] || {};
    return normalizeExternalLorepackPayload({
        ...merged,
        ...normalizedPack,
        revision: normalizeRevision(cached.revision, record.revision || 1),
        payloadFile: record.payloadFile || cached.payloadFile,
        kind: cached.kind || LOREPACK_PAYLOAD_KIND,
    }, { packId });
}

export async function hydrateExternalLorepackPayloadRecord(record = {}, options = {}) {
    const packId = getPackId(record);
    if (!packId) return hydrateCachedExternalLorepackPayloadRecord(record);
    if (payloadCache.has(packId)) return hydrateCachedExternalLorepackPayloadRecord(record);
    const payloadFile = normalizeStoragePath(record.payloadFile || record.payloadPath || '');
    if (!payloadFile) return hydrateCachedExternalLorepackPayloadRecord(record);
    const raw = await getFileApi(options).readJsonFile(payloadFile, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    setPayloadCache({
        ...raw,
        packId: raw?.packId || packId,
        payloadFile,
    }, options);
    return hydrateCachedExternalLorepackPayloadRecord(record);
}

export function upsertExternalLorepackPayloadSync(packRecord = {}, options = {}) {
    const normalized = normalizeExternalLorepackPayload(packRecord, options);
    const prepared = prepareExternalLorepackPayloadAssets(normalized);
    const payload = setPayloadCache(prepared.payload, options);
    if (!payload?.packId) return { ok: false, error: 'Lorepack payload must include a packId/id.' };
    queueExternalLorepackPayloadWrite(payload, {
        ...options,
        assetUploads: prepared.assetUploads,
    });
    return {
        ok: true,
        payload,
        libraryRecord: createExternalLorepackLibraryRecord(payload, options),
    };
}

export function removeExternalLorepackPayloadSync(packId = '', options = {}) {
    const id = normalizeSagaStorageId(packId, '', 160);
    if (!id) return { ok: false, error: 'Missing Lorepack id.' };
    const cached = getCachedExternalLorepackPayload(id);
    const payloadFile = normalizeStoragePath(options.payloadFile || cached?.payloadFile || '');
    const assetFiles = [...new Set([
        ...collectAssetPaths(cached?.assets || {}),
        ...collectAssetPaths(cached?.manifestData?.assets || {}),
        ...collectAssetPaths(cached?.assetRefs || {}),
        ...(Array.isArray(options.assetFiles) ? options.assetFiles.map(normalizeAnySagaStoragePath).filter(Boolean) : []),
    ])].sort();
    if (!cached && !payloadFile) {
        return { ok: false, notFound: true, error: 'Lorepack payload is not registered in external storage.' };
    }
    payloadCache.delete(id);
    queueExternalLorepackPayloadDelete(id, payloadFile, assetFiles, options);
    return { ok: true, payloadFile, assetFiles };
}

export async function flushSagaLorepackPayloadStorageWrites() {
    await pendingPayloadWrite;
    return {
        ok: !lastPayloadWriteError,
        error: lastPayloadWriteError,
        pendingWrites: pendingPayloadWriteCount,
    };
}

export function getSagaLorepackPayloadStorageStatus() {
    return {
        pendingWrites: pendingPayloadWriteCount,
        lastWriteError: lastPayloadWriteError,
        cachedPayloadCount: payloadCache.size,
    };
}

export function resetSagaLorepackPayloadStorageCache() {
    payloadCache = new Map();
    payloadCacheSequences = new Map();
    payloadCacheSequence = 0;
    pendingPayloadWrite = Promise.resolve();
    pendingPayloadWriteCount = 0;
    lastPayloadWriteError = '';
}

resetSagaLorepackPayloadStorageCache();
