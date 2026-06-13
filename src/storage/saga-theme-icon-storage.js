/**
 * External Theme Pack and Icon Set storage adapter.
 */

import {
    BUNDLED_THEME_ICON_SET_IDS,
    BUNDLED_THEME_PACK_IDS,
    normalizeThemeIconSetRegistry,
    normalizeThemePackRegistry,
} from '../state/theme-library-store.js';
import {
    buildSagaAssetStorageFileName,
    SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
} from './saga-storage-filenames.js';
import { createSagaFileApi } from './saga-file-api.js';
import { createSagaDomainStorage } from './saga-domain-storage.js';
import { createSagaStorageIndexStore, getSagaStorageDeleteCandidatesForOwner } from './saga-storage-index.js';
import {
    assertSafeZipEntryPath,
    readZipArchive,
} from '../loredecks/loredeck-package-zip.js';

const EMPTY_THEME_REGISTRY = Object.freeze({ schemaVersion: 1, packs: Object.freeze({}) });
const EMPTY_ICONSET_REGISTRY = Object.freeze({ schemaVersion: 1, iconSets: Object.freeze({}) });
const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp|avif);base64,([a-z0-9+/=\s]+)$/i;
const SAFE_PASSIVE_IMAGE_PATTERN = /\.(png|jpe?g|webp|avif)$/i;

let hydratedThemePackLibrary = { schemaVersion: 1, packs: {} };
let hydratedThemeIconSetLibrary = { schemaVersion: 1, iconSets: {} };
let hydrationStatus = {
    loaded: false,
    loading: false,
    loadedAt: 0,
    error: '',
};
let hydrationPromise = null;

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

function getClockNow(options = {}) {
    if (typeof options.now === 'function') return normalizeTimestamp(options.now(), Date.now());
    if (options.now !== undefined) return normalizeTimestamp(options.now, Date.now());
    return Date.now();
}

function normalizeString(value = '', maxLength = 500) {
    return String(value || '').trim().slice(0, Math.max(1, Number(maxLength) || 500));
}

function createEmptyThemeRegistry() {
    return { schemaVersion: 1, packs: {} };
}

function createEmptyIconSetRegistry() {
    return { schemaVersion: 1, iconSets: {} };
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

function getDomainStorage(options = {}) {
    return options.domainStorage || createSagaDomainStorage({
        fileApi: getFileApi(options),
        storageIndexStore: getStorageIndexStore(options),
        now: options.now,
    });
}

function normalizeImportSource(source = {}, sourceFileName = '') {
    const raw = isPlainObject(source) ? source : {};
    return {
        kind: normalizeString(raw.kind || 'local', 80),
        url: normalizeString(raw.url || '', 500),
        updateUrl: normalizeString(raw.updateUrl || '', 500),
        importedFrom: normalizeString(raw.importedFrom || sourceFileName || '', 240),
    };
}

function getImportCollisionPolicy(options = {}) {
    const policy = normalizeString(options.collisionPolicy, 40).toLowerCase();
    if (policy === 'replace' || policy === 'skip' || policy === 'reject') return policy;
    if (options.replaceExisting === true) return 'replace';
    return 'reject';
}

function buildThemePackCollisionResult(themeId = '') {
    return {
        ok: false,
        collision: true,
        code: 'theme_pack_id_collision',
        id: themeId,
        themeId,
        error: `A custom Theme Pack with id "${themeId}" is already installed. Import with a unique id or forget the existing Theme Pack before replacing it.`,
    };
}

function buildIconSetCollisionResult(iconSetId = '') {
    return {
        ok: false,
        collision: true,
        code: 'iconset_id_collision',
        id: iconSetId,
        iconSetId,
        error: `A custom Icon Set with id "${iconSetId}" is already installed. Import with a unique id or forget the existing Icon Set before replacing it.`,
    };
}

function normalizeThemePackInput(packRecord = {}, options = {}) {
    if (packRecord?.icons || packRecord?.iconSets || packRecord?.type === 'saga_iconset') {
        return { ok: false, error: 'Theme Packs cannot contain Icon Set fields. Import Icon Sets separately.' };
    }
    const normalized = normalizeThemePackRegistry(
        { schemaVersion: 1, packs: { [packRecord.id || packRecord.themeId || packRecord.title || '']: { ...packRecord, type: 'custom' } } },
        EMPTY_THEME_REGISTRY,
    );
    const [themeId, pack] = Object.entries(normalized.packs || {})[0] || [];
    if (!themeId || !pack) return { ok: false, error: 'Theme Pack record must include an id.' };
    if (BUNDLED_THEME_PACK_IDS.includes(themeId)) {
        return { ok: false, error: 'Custom Theme Packs cannot replace a Bundled Theme Pack with the same id.' };
    }
    const now = getClockNow(options);
    return {
        ok: true,
        themeId,
        pack: {
            ...pack,
            schemaVersion: 1,
            kind: 'saga_theme_pack',
            type: 'custom',
            source: normalizeImportSource(pack.source, options.sourceFileName),
            createdAt: pack.createdAt || pack.installedAt || now,
            updatedAt: now,
        },
    };
}

function normalizeIconSetInput(iconSetRecord = {}, options = {}) {
    const rawIcons = extractRawIconMap(iconSetRecord);
    const normalized = normalizeThemeIconSetRegistry(
        { schemaVersion: 1, iconSets: { [iconSetRecord.id || iconSetRecord.iconSetId || iconSetRecord.title || '']: { ...iconSetRecord, type: 'custom' } } },
        EMPTY_ICONSET_REGISTRY,
    );
    const [iconSetId, iconSet] = Object.entries(normalized.iconSets || {})[0] || [];
    if (!iconSetId || !iconSet) return { ok: false, error: 'Icon Set record must include an id and icons.' };
    if (BUNDLED_THEME_ICON_SET_IDS.includes(iconSetId)) {
        return { ok: false, error: 'Custom Icon Sets cannot replace a Bundled Icon Set with the same id.' };
    }
    const now = getClockNow(options);
    return {
        ok: true,
        iconSetId,
        iconSet: {
            ...iconSet,
            schemaVersion: 1,
            kind: 'saga_iconset',
            type: 'custom',
            icons: rawIcons,
            assets: isPlainObject(iconSetRecord.assets) ? cloneJson(iconSetRecord.assets) : {},
            source: normalizeImportSource(iconSet.source, options.sourceFileName),
            createdAt: iconSet.createdAt || iconSet.installedAt || now,
            updatedAt: now,
        },
    };
}

function extractRawIconMap(value = {}) {
    const source = value?.icons && typeof value.icons === 'object' && !Array.isArray(value.icons)
        ? value.icons
        : {};
    const icons = {};
    for (const [rawKey, rawValue] of Object.entries(source)) {
        const key = normalizeString(rawKey, 80);
        const icon = String(rawValue || '').trim();
        if (key && icon) icons[key] = icon;
    }
    return icons;
}

function normalizeExternalThemePackRegistry(registry = {}) {
    return normalizeThemePackRegistry(registry, EMPTY_THEME_REGISTRY);
}

function normalizeExternalIconSetRegistry(registry = {}) {
    return normalizeThemeIconSetRegistry(registry, EMPTY_ICONSET_REGISTRY);
}

function setCachedThemePack(pack = {}) {
    const normalized = normalizeExternalThemePackRegistry({ schemaVersion: 1, packs: { [pack.id || pack.themeId || '']: pack } });
    hydratedThemePackLibrary = normalizeExternalThemePackRegistry({
        schemaVersion: 1,
        packs: {
            ...(hydratedThemePackLibrary.packs || {}),
            ...(normalized.packs || {}),
        },
    });
}

function setCachedIconSet(iconSet = {}) {
    const normalized = normalizeExternalIconSetRegistry({ schemaVersion: 1, iconSets: { [iconSet.id || iconSet.iconSetId || '']: iconSet } });
    hydratedThemeIconSetLibrary = normalizeExternalIconSetRegistry({
        schemaVersion: 1,
        iconSets: {
            ...(hydratedThemeIconSetLibrary.iconSets || {}),
            ...(normalized.iconSets || {}),
        },
    });
}

function removeCachedThemePack(themeId = '') {
    const id = normalizeString(themeId, 160);
    if (!id) return;
    const packs = { ...(hydratedThemePackLibrary.packs || {}) };
    delete packs[id];
    hydratedThemePackLibrary = normalizeExternalThemePackRegistry({ schemaVersion: 1, packs });
}

function removeCachedIconSet(iconSetId = '') {
    const id = normalizeString(iconSetId, 160);
    if (!id) return;
    const iconSets = { ...(hydratedThemeIconSetLibrary.iconSets || {}) };
    delete iconSets[id];
    hydratedThemeIconSetLibrary = normalizeExternalIconSetRegistry({ schemaVersion: 1, iconSets });
}

function normalizeStoredPassiveIconPath(value = '') {
    const path = normalizeString(value, 1000);
    if (!path) return '';
    if (/^https?:\/\//i.test(path) && SAFE_PASSIVE_IMAGE_PATTERN.test(path.split('?')[0] || path)) return path;
    if (/^(?:\.\/)?(?:assets|content)\//i.test(path) && SAFE_PASSIVE_IMAGE_PATTERN.test(path)) return path;
    if (/^\/user\/files\/saga-[a-z0-9_.-]+\.(?:png|jpe?g|webp|avif)$/i.test(path)) return path;
    return '';
}

function getDataImageParts(value = '') {
    const match = DATA_IMAGE_PATTERN.exec(String(value || '').trim());
    if (!match) return null;
    const rawExt = match[1].toLowerCase();
    const extension = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const mime = `image/${rawExt === 'jpg' ? 'jpeg' : rawExt}`;
    const base64 = match[2].replace(/\s+/g, '');
    return base64 ? { extension, mime, base64 } : null;
}

function base64ToBytes(base64 = '') {
    if (typeof Buffer !== 'undefined') return Uint8Array.from(Buffer.from(base64, 'base64'));
    const binary = globalThis.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

function bytesToBase64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let binary = '';
    for (const byte of bytes || []) binary += String.fromCharCode(byte);
    return globalThis.btoa(binary);
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function fallbackHashHex(bytes) {
    let hash = 2166136261;
    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

async function sha256Hex(bytes) {
    if (globalThis.crypto?.subtle?.digest) {
        const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
        return bytesToHex(new Uint8Array(digest));
    }
    return fallbackHashHex(bytes);
}

async function uploadIconDataUrl(iconSetId = '', iconKey = '', dataUrl = '', options = {}) {
    const parts = getDataImageParts(dataUrl);
    if (!parts) return { ok: false, error: `Icon "${iconKey}" is not a supported raster data URL.` };
    if (!SAGA_STORAGE_RASTER_ASSET_EXTENSIONS.includes(parts.extension)) {
        return { ok: false, error: `Icon "${iconKey}" uses an unsupported image extension.` };
    }
    const fileApi = getFileApi(options);
    const storageIndexStore = getStorageIndexStore(options);
    const bytes = base64ToBytes(parts.base64);
    const sha256 = await sha256Hex(bytes);
    const fileName = buildSagaAssetStorageFileName('iconset', iconSetId, iconKey, parts.extension, { hash: sha256 });
    const result = await fileApi.uploadBase64File(fileName, parts.base64, {
        allowedExtensions: SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
    });
    await storageIndexStore.registerFile(result.path, {
        kind: 'iconset_asset',
        domain: 'iconSets',
        ownerId: iconSetId,
        mime: parts.mime,
        sha256,
        bytes: bytes.length,
        deletion: 'delete_with_owner',
    });
    return {
        ok: true,
        path: result.path,
        asset: {
            slot: iconKey,
            mime: parts.mime,
            sha256,
            bytes: bytes.length,
        },
    };
}

function getRasterMimeFromPath(path = '') {
    const clean = String(path || '').toLowerCase().split('?')[0] || '';
    if (clean.endsWith('.png')) return { extension: 'png', mime: 'image/png' };
    if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return { extension: 'jpg', mime: 'image/jpeg' };
    if (clean.endsWith('.webp')) return { extension: 'webp', mime: 'image/webp' };
    if (clean.endsWith('.avif')) return { extension: 'avif', mime: 'image/avif' };
    return null;
}

async function uploadIconBytes(iconSetId = '', iconKey = '', bytes = new Uint8Array(), filePath = '', options = {}) {
    const fileType = getRasterMimeFromPath(filePath);
    if (!fileType) return { ok: false, error: `Icon "${iconKey}" is not a supported raster image.` };
    const fileApi = getFileApi(options);
    const storageIndexStore = getStorageIndexStore(options);
    const sha256 = await sha256Hex(bytes);
    const fileName = buildSagaAssetStorageFileName('iconset', iconSetId, iconKey, fileType.extension, { hash: sha256 });
    const result = await fileApi.uploadBase64File(fileName, bytesToBase64(bytes), {
        allowedExtensions: SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
    });
    await storageIndexStore.registerFile(result.path, {
        kind: 'iconset_asset',
        domain: 'iconSets',
        ownerId: iconSetId,
        mime: fileType.mime,
        sha256,
        bytes: bytes.length,
        deletion: 'delete_with_owner',
    });
    return {
        ok: true,
        path: result.path,
        asset: {
            slot: iconKey,
            mime: fileType.mime,
            sha256,
            bytes: bytes.length,
        },
    };
}

async function rewriteIconSetAssetPaths(iconSetId = '', icons = {}, options = {}) {
    const rewrittenIcons = {};
    const assets = {};
    for (const [rawKey, rawValue] of Object.entries(icons || {})) {
        const key = normalizeString(rawKey, 80);
        if (!key) continue;
        const value = normalizeString(rawValue, 1000000);
        const dataParts = getDataImageParts(value);
        if (dataParts) {
            const uploaded = await uploadIconDataUrl(iconSetId, key, value, options);
            if (!uploaded.ok) return uploaded;
            rewrittenIcons[key] = uploaded.path;
            assets[uploaded.path] = uploaded.asset;
            continue;
        }
        const path = normalizeStoredPassiveIconPath(value);
        if (path) rewrittenIcons[key] = path;
    }
    if (!Object.keys(rewrittenIcons).length) {
        return { ok: false, error: 'Icon Set import did not include any valid icon paths.' };
    }
    return { ok: true, icons: rewrittenIcons, assets };
}

function dirname(path = '') {
    const normalized = String(path || '').replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index >= 0 ? normalized.slice(0, index + 1) : '';
}

function joinZipPath(base = '', child = '') {
    const raw = String(child || '').replace(/\\/g, '/').trim();
    if (!raw || /^[a-z]+:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('/')) return '';
    return assertSafeZipEntryPath(raw.startsWith('./') ? `${base}${raw.slice(2)}` : `${base}${raw}`);
}

async function rewriteIconSetZipAssetPaths(iconSetId = '', icons = {}, archive, manifestPath = 'saga-iconset.json', options = {}) {
    const rewrittenIcons = {};
    const assets = {};
    const base = dirname(manifestPath);
    for (const [rawKey, rawValue] of Object.entries(icons || {})) {
        const key = normalizeString(rawKey, 80);
        if (!key) continue;
        const value = normalizeString(rawValue, 1000);
        const path = normalizeStoredPassiveIconPath(value);
        if (path) {
            rewrittenIcons[key] = path;
            continue;
        }
        const zipPath = joinZipPath(base, value);
        if (!zipPath || !archive.has(zipPath)) continue;
        const uploaded = await uploadIconBytes(iconSetId, key, await archive.readFileBytes(zipPath), zipPath, options);
        if (!uploaded.ok) return uploaded;
        rewrittenIcons[key] = uploaded.path;
        assets[uploaded.path] = uploaded.asset;
    }
    if (!Object.keys(rewrittenIcons).length) {
        return { ok: false, error: 'Icon Set zip did not include any valid icon mappings.' };
    }
    return { ok: true, icons: rewrittenIcons, assets };
}

function buildThemeIndexRecord(pack = {}, payloadFile = '') {
    return {
        themeId: pack.id,
        id: pack.id,
        type: 'custom',
        title: pack.title || pack.id,
        description: pack.description || '',
        author: pack.author || '',
        version: pack.version || '',
        tags: Array.isArray(pack.tags) ? pack.tags : [],
        source: pack.source || {},
        payloadFile,
        createdAt: pack.createdAt || pack.installedAt || 0,
        updatedAt: pack.updatedAt || 0,
    };
}

function buildIconSetIndexRecord(iconSet = {}, payloadFile = '') {
    const assets = isPlainObject(iconSet.assets) ? iconSet.assets : {};
    return {
        iconSetId: iconSet.id,
        id: iconSet.id,
        type: 'custom',
        title: iconSet.title || iconSet.id,
        description: iconSet.description || '',
        author: iconSet.author || '',
        version: iconSet.version || '',
        preferredSize: iconSet.preferredSize || 256,
        iconCount: Object.keys(iconSet.icons || {}).length,
        assetCount: Object.keys(assets).length,
        tags: Array.isArray(iconSet.tags) ? iconSet.tags : [],
        source: iconSet.source || {},
        payloadFile,
        assetFiles: Object.keys(assets),
        createdAt: iconSet.createdAt || iconSet.installedAt || 0,
        updatedAt: iconSet.updatedAt || 0,
    };
}

export function resetSagaThemeIconStorageCache() {
    hydratedThemePackLibrary = createEmptyThemeRegistry();
    hydratedThemeIconSetLibrary = createEmptyIconSetRegistry();
    hydrationStatus = {
        loaded: false,
        loading: false,
        loadedAt: 0,
        error: '',
    };
    hydrationPromise = null;
}

export function getSagaThemeIconStorageStatus() {
    return { ...hydrationStatus };
}

export function getExternalThemePackLibraryRegistry() {
    return cloneJson(hydratedThemePackLibrary);
}

export function getExternalThemeIconSetLibraryRegistry() {
    return cloneJson(hydratedThemeIconSetLibrary);
}

export function mergeExternalThemePackLibraryRegistry(settingsRegistry = {}) {
    const stored = normalizeThemePackRegistry(settingsRegistry || EMPTY_THEME_REGISTRY, EMPTY_THEME_REGISTRY);
    return normalizeExternalThemePackRegistry({
        schemaVersion: 1,
        packs: {
            ...(stored.packs || {}),
            ...(hydratedThemePackLibrary.packs || {}),
        },
    });
}

export function mergeExternalThemeIconSetLibraryRegistry(settingsRegistry = {}) {
    const stored = normalizeThemeIconSetRegistry(settingsRegistry || EMPTY_ICONSET_REGISTRY, EMPTY_ICONSET_REGISTRY);
    return normalizeExternalIconSetRegistry({
        schemaVersion: 1,
        iconSets: {
            ...(stored.iconSets || {}),
            ...(hydratedThemeIconSetLibrary.iconSets || {}),
        },
    });
}

export async function hydrateSagaThemeIconStorage(options = {}) {
    if (hydrationPromise && options.force !== true) return hydrationPromise;
    hydrationStatus = { ...hydrationStatus, loading: true, error: '' };
    hydrationPromise = (async () => {
        const domainStorage = getDomainStorage(options);
        const themePacks = {};
        const iconSets = {};

        const themeIndex = await domainStorage.readDomainIndex('themes', { allowMissing: true });
        for (const record of Object.values(themeIndex.packs || {})) {
            if (!record?.payloadFile) continue;
            try {
                const payload = await getFileApi(options).readJsonFile(record.payloadFile);
                const normalized = normalizeThemePackInput({ ...record, ...payload, id: payload.id || record.themeId }, options);
                if (normalized.ok) themePacks[normalized.themeId] = normalized.pack;
            } catch (error) {
                console.warn('[Saga] Theme Pack payload could not be hydrated:', record.payloadFile, error);
            }
        }

        const iconSetIndex = await domainStorage.readDomainIndex('iconSets', { allowMissing: true });
        for (const record of Object.values(iconSetIndex.iconSets || {})) {
            if (!record?.payloadFile) continue;
            try {
                const payload = await getFileApi(options).readJsonFile(record.payloadFile);
                const normalized = normalizeIconSetInput({ ...record, ...payload, id: payload.id || record.iconSetId }, options);
                if (normalized.ok) iconSets[normalized.iconSetId] = normalized.iconSet;
            } catch (error) {
                console.warn('[Saga] Icon Set payload could not be hydrated:', record.payloadFile, error);
            }
        }

        hydratedThemePackLibrary = normalizeExternalThemePackRegistry({ schemaVersion: 1, packs: themePacks });
        hydratedThemeIconSetLibrary = normalizeExternalIconSetRegistry({ schemaVersion: 1, iconSets });
        hydrationStatus = {
            loaded: true,
            loading: false,
            loadedAt: getClockNow(options),
            error: '',
        };
        return {
            ok: true,
            themePackLibrary: getExternalThemePackLibraryRegistry(),
            themeIconSetLibrary: getExternalThemeIconSetLibraryRegistry(),
        };
    })().catch(error => {
        hydrationStatus = {
            loaded: false,
            loading: false,
            loadedAt: 0,
            error: error?.message || String(error || 'Theme/Icon storage hydration failed.'),
        };
        hydrationPromise = null;
        throw error;
    });
    return hydrationPromise;
}

export async function importExternalThemePack(packRecord = {}, options = {}) {
    const normalized = normalizeThemePackInput(packRecord, options);
    if (!normalized.ok) return normalized;
    const domainStorage = getDomainStorage(options);
    const existingIndex = await domainStorage.readDomainIndex('themes', { allowMissing: true });
    const hadExistingRecord = !!existingIndex.packs?.[normalized.themeId];
    if (hadExistingRecord && getImportCollisionPolicy(options) !== 'replace') {
        return buildThemePackCollisionResult(normalized.themeId);
    }
    let payloadResult = null;
    try {
        payloadResult = await domainStorage.writePayload('themes', normalized.themeId, normalized.pack, {
            ...options,
            kind: 'theme_pack_payload',
            deletion: 'delete_with_owner',
        });
        const indexRecord = buildThemeIndexRecord(normalized.pack, payloadResult.path);
        await domainStorage.upsertRecord('themes', indexRecord, options);
        setCachedThemePack({ ...normalized.pack, payloadFile: payloadResult.path });
        return {
            ok: true,
            pack: { ...normalized.pack, payloadFile: payloadResult.path },
            payloadFile: payloadResult.path,
            library: getExternalThemePackLibraryRegistry(),
        };
    } catch (error) {
        if (!hadExistingRecord) {
            await cleanupFailedExternalInstall('themes', normalized.themeId, options);
        }
        throw error;
    }
}

export async function importExternalThemePackRegistry(registry = {}, options = {}) {
    const incoming = normalizeThemePackRegistry(registry, EMPTY_THEME_REGISTRY);
    const rawPacks = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs) ? registry.packs : {};
    const packs = Object.entries(incoming.packs || {});
    let importedCount = 0;
    let skippedCount = 0;
    let collisionCount = 0;
    const imported = [];
    const skipped = [];
    for (const [themeId, pack] of packs) {
        const raw = rawPacks[themeId] || pack;
        if (BUNDLED_THEME_PACK_IDS.includes(themeId) || raw.icons) {
            skippedCount += 1;
            skipped.push({
                id: themeId,
                code: BUNDLED_THEME_PACK_IDS.includes(themeId) ? 'bundled_theme_pack_id_collision' : 'theme_pack_contains_icon_fields',
            });
            continue;
        }
        const result = await importExternalThemePack(raw, options);
        if (result.ok) {
            importedCount += 1;
            imported.push(result.pack);
        } else {
            skippedCount += 1;
            if (result.collision) collisionCount += 1;
            skipped.push({
                id: themeId,
                code: result.code || 'theme_pack_skipped',
                error: result.error || '',
            });
        }
    }
    return { ok: true, importedCount, skippedCount, collisionCount, imported, skipped, library: getExternalThemePackLibraryRegistry() };
}

export async function importExternalIconSet(iconSetRecord = {}, options = {}) {
    const normalized = normalizeIconSetInput(iconSetRecord, options);
    if (!normalized.ok) return normalized;
    const domainStorage = getDomainStorage(options);
    const existingIndex = await domainStorage.readDomainIndex('iconSets', { allowMissing: true });
    const hadExistingRecord = !!existingIndex.iconSets?.[normalized.iconSetId];
    if (hadExistingRecord && getImportCollisionPolicy(options) !== 'replace') {
        return buildIconSetCollisionResult(normalized.iconSetId);
    }
    const rewritten = options.skipIconRewrite === true
        ? {
            ok: true,
            icons: normalized.iconSet.icons,
            assets: isPlainObject(normalized.iconSet.assets) ? normalized.iconSet.assets : {},
        }
        : await rewriteIconSetAssetPaths(normalized.iconSetId, normalized.iconSet.icons, options);
    if (!rewritten.ok) {
        if (!hadExistingRecord) {
            await cleanupFailedExternalInstall('iconSets', normalized.iconSetId, options);
        }
        return rewritten;
    }
    const iconSet = {
        ...normalized.iconSet,
        icons: rewritten.icons,
        assets: rewritten.assets,
    };
    let payloadResult = null;
    try {
        payloadResult = await domainStorage.writePayload('iconSets', normalized.iconSetId, iconSet, {
            ...options,
            kind: 'iconset_payload',
            deletion: 'delete_with_owner',
        });
        const indexRecord = buildIconSetIndexRecord(iconSet, payloadResult.path);
        await domainStorage.upsertRecord('iconSets', indexRecord, options);
        setCachedIconSet({ ...iconSet, payloadFile: payloadResult.path });
        return {
            ok: true,
            iconSet: { ...iconSet, payloadFile: payloadResult.path },
            payloadFile: payloadResult.path,
            library: getExternalThemeIconSetLibraryRegistry(),
        };
    } catch (error) {
        if (!hadExistingRecord) {
            await cleanupFailedExternalInstall('iconSets', normalized.iconSetId, options);
        }
        throw error;
    }
}

export async function importExternalIconSetZip(input, options = {}) {
    const archive = await readZipArchive(input, {
        limits: {
            maxFileCount: 200,
            maxCompressedBytes: 50 * 1024 * 1024,
            maxUncompressedBytes: 100 * 1024 * 1024,
            maxSingleFileBytes: 10 * 1024 * 1024,
        },
    });
    const manifestPath = archive.has('saga-iconset.json')
        ? 'saga-iconset.json'
        : (archive.entries.find(entry => !entry.isDirectory && entry.path.endsWith('/saga-iconset.json'))?.path || '');
    if (!manifestPath) return { ok: false, error: 'Icon Set zip is missing saga-iconset.json.' };
    const manifest = await archive.readJson(manifestPath);
    const normalized = normalizeIconSetInput({
        ...manifest,
        id: manifest.id || manifest.iconSetId || options.fallbackId || options.sourceFileName || 'custom-icon-set',
        source: {
            ...(manifest.source || {}),
            kind: 'local_zip',
            importedFrom: options.sourceFileName || manifest.source?.importedFrom || '',
        },
    }, options);
    if (!normalized.ok) return normalized;
    const existingIndex = await getDomainStorage(options).readDomainIndex('iconSets', { allowMissing: true });
    if (existingIndex.iconSets?.[normalized.iconSetId] && getImportCollisionPolicy(options) !== 'replace') {
        return buildIconSetCollisionResult(normalized.iconSetId);
    }
    const rewritten = await rewriteIconSetZipAssetPaths(normalized.iconSetId, normalized.iconSet.icons, archive, manifestPath, options);
    if (!rewritten.ok) return rewritten;
    return importExternalIconSet({
        ...normalized.iconSet,
        icons: rewritten.icons,
        assets: rewritten.assets,
    }, {
        ...options,
        skipIconRewrite: true,
    });
}

export async function importExternalIconSetRegistry(registry = {}, options = {}) {
    const incoming = registry?.iconSets && typeof registry.iconSets === 'object' && !Array.isArray(registry.iconSets)
        ? registry.iconSets
        : {};
    let importedCount = 0;
    let skippedCount = 0;
    let collisionCount = 0;
    const imported = [];
    const skipped = [];
    for (const [iconSetId, iconSet] of Object.entries(incoming)) {
        if (BUNDLED_THEME_ICON_SET_IDS.includes(iconSetId)) {
            skippedCount += 1;
            skipped.push({ id: iconSetId, code: 'bundled_iconset_id_collision' });
            continue;
        }
        const result = await importExternalIconSet(iconSet, options);
        if (result.ok) {
            importedCount += 1;
            imported.push(result.iconSet);
        } else {
            skippedCount += 1;
            if (result.collision) collisionCount += 1;
            skipped.push({
                id: iconSetId,
                code: result.code || 'iconset_skipped',
                error: result.error || '',
            });
        }
    }
    return { ok: true, importedCount, skippedCount, collisionCount, imported, skipped, library: getExternalThemeIconSetLibraryRegistry() };
}

async function deleteKnownOwnerFiles(ownerId = '', options = {}) {
    const fileApi = getFileApi(options);
    const storageIndexStore = getStorageIndexStore(options);
    const index = await storageIndexStore.readIndex({ allowMissing: true });
    const candidates = getSagaStorageDeleteCandidatesForOwner(index, ownerId);
    const deleted = [];
    for (const record of candidates) {
        try {
            await fileApi.deleteFile(record.path);
        } catch (error) {
            if (error?.status !== 404 && !/missing|not found|404/i.test(String(error?.message || ''))) throw error;
        }
        await storageIndexStore.unregisterFile(record.path);
        deleted.push(record.path);
    }
    return deleted;
}

async function deleteExplicitStorageFiles(paths = [], options = {}) {
    const fileApi = getFileApi(options);
    const storageIndexStore = getStorageIndexStore(options);
    const deleted = [];
    for (const path of [...new Set((Array.isArray(paths) ? paths : []).filter(Boolean))]) {
        try {
            await fileApi.deleteFile(path);
        } catch (error) {
            if (error?.status !== 404 && !/missing|not found|404/i.test(String(error?.message || ''))) throw error;
        }
        try {
            await storageIndexStore.unregisterFile(path);
        } catch (_) {
            // Cleanup should still succeed if the master index was already missing.
        }
        deleted.push(path);
    }
    return deleted;
}

async function cleanupFailedExternalInstall(domain = '', ownerId = '', options = {}) {
    try {
        await deleteKnownOwnerFiles(ownerId, options);
    } catch (error) {
        console.warn('[Saga] Theme/Icon import cleanup could not delete owner files after failed index write:', ownerId, error);
    }
    try {
        const domainStorage = getDomainStorage(options);
        const index = await domainStorage.readDomainIndex(domain, { allowMissing: true });
        const hasRecord = domain === 'themes'
            ? !!index.packs?.[ownerId]
            : !!index.iconSets?.[ownerId];
        if (!hasRecord) return;
        await domainStorage.removeRecord(domain, ownerId, {
            ...options,
            registerInMaster: false,
        });
    } catch (error) {
        console.warn('[Saga] Theme/Icon import cleanup could not remove failed domain index record:', ownerId, error);
    }
}

export async function removeExternalThemePack(themeId = '', options = {}) {
    const id = normalizeString(themeId, 160);
    if (!id || BUNDLED_THEME_PACK_IDS.includes(id)) {
        return { ok: false, notFound: true, error: 'Theme Pack is not installed in external storage.' };
    }
    const domainStorage = getDomainStorage(options);
    const index = await domainStorage.readDomainIndex('themes', { allowMissing: true });
    if (!index.packs?.[id]) {
        return { ok: false, notFound: true, error: 'Theme Pack is not installed in external storage.' };
    }
    const record = index.packs[id];
    const deletedFiles = await deleteKnownOwnerFiles(id, options);
    const explicitFiles = [
        record.payloadFile,
        ...(Array.isArray(record.assetFiles) ? record.assetFiles : []),
    ].filter(path => path && !deletedFiles.includes(path));
    deletedFiles.push(...await deleteExplicitStorageFiles(explicitFiles, options));
    await domainStorage.removeRecord('themes', id, options);
    removeCachedThemePack(id);
    return { ok: true, deletedFiles, library: getExternalThemePackLibraryRegistry() };
}

export async function removeExternalIconSet(iconSetId = '', options = {}) {
    const id = normalizeString(iconSetId, 160);
    if (!id || BUNDLED_THEME_ICON_SET_IDS.includes(id)) {
        return { ok: false, notFound: true, error: 'Icon Set is not installed in external storage.' };
    }
    const domainStorage = getDomainStorage(options);
    const index = await domainStorage.readDomainIndex('iconSets', { allowMissing: true });
    if (!index.iconSets?.[id]) {
        return { ok: false, notFound: true, error: 'Icon Set is not installed in external storage.' };
    }
    const record = index.iconSets[id];
    const deletedFiles = await deleteKnownOwnerFiles(id, options);
    const explicitFiles = [
        record.payloadFile,
        ...(Array.isArray(record.assetFiles) ? record.assetFiles : []),
    ].filter(path => path && !deletedFiles.includes(path));
    deletedFiles.push(...await deleteExplicitStorageFiles(explicitFiles, options));
    await domainStorage.removeRecord('iconSets', id, options);
    removeCachedIconSet(id);
    return { ok: true, deletedFiles, library: getExternalThemeIconSetLibraryRegistry() };
}

export const __sagaThemeIconStorageTestHooks = {
    getDataImageParts,
    normalizeStoredPassiveIconPath,
    rewriteIconSetAssetPaths,
    rewriteIconSetZipAssetPaths,
};
