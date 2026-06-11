/**
 * loredeck-package-helpers.js - Saga
 * Data helpers for runtime Loredeck package import/export.
 */

import { normalizePackLibraryMetadata } from '../loredecks/loredeck-library-index.js';
import {
    normalizeLoredeckTagRegistry,
    normalizeLoredeckTimelineRegistry,
} from '../state/lore-state-normalizers.js';
import { sanitizeFileStem } from './runtime-formatters.js';

export function cloneLoredeckJson(value) {
    if (!value || typeof value !== 'object') return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return null;
    }
}

export function entryListFromLoredeckFileJson(json) {
    if (Array.isArray(json?.entries)) return json.entries;
    if (Array.isArray(json)) return json;
    return [];
}

export function buildLoredeckStatsFromEntries(entries = []) {
    const categoryCounts = {};
    for (const entry of Array.isArray(entries) ? entries : []) {
        const category = String(entry?.category || 'other').trim() || 'other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
    return {
        entryCount: Array.isArray(entries) ? entries.length : 0,
        categoryCounts,
    };
}

export function buildEmbeddedCustomManifest(sourceManifest = {}, metadata = {}) {
    const manifest = cloneLoredeckJson(sourceManifest) || {};
    delete manifest.entries;
    const packId = String(metadata.packId || manifest.id || '').trim();
    manifest.id = packId;
    manifest.type = metadata.type === 'generated' ? 'generated' : 'custom';
    manifest.title = String(metadata.title || manifest.title || packId).trim();
    manifest.description = String(metadata.description || manifest.description || '').trim();
    manifest.fandom = String(metadata.fandom || manifest.fandom || '').trim();
    manifest.era = String(metadata.era || manifest.era || '').trim();
    manifest.author = String(metadata.author || manifest.author || '').trim();
    manifest.version = String(metadata.version || manifest.version || '1.0.0').trim();
    if (Number.isFinite(Number(metadata.entrySchemaVersion)) && Number(metadata.entrySchemaVersion) > 0) {
        manifest.entrySchemaVersion = Number(metadata.entrySchemaVersion);
    }
    manifest.tags = Array.isArray(metadata.tags) ? metadata.tags : (Array.isArray(manifest.tags) ? manifest.tags : []);
    manifest.source = metadata.source || manifest.source || {};
    manifest.update = {
        ...(manifest.update || {}),
        checkForUpdates: false,
        url: '',
    };
    if (metadata.derivedFrom) manifest.derivedFrom = metadata.derivedFrom;
    if (metadata.stats) manifest.stats = metadata.stats;
    if (!Array.isArray(manifest.files)) manifest.files = [];
    return manifest;
}

export function parseLoredeckTags(value) {
    const seen = new Set();
    const tags = [];
    for (const raw of String(value || '').split(',')) {
        const tag = String(raw || '')
            .trim()
            .replace(/[\r\n]+/g, ' ')
            .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
            .replace(/\s+/g, ' ')
            .slice(0, 64)
            .trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= 32) break;
    }
    return tags;
}

export function normalizeLoredeckPackId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .slice(0, 96);
}

export function normalizeLoredeckEntryId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._:-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 140);
}

export function getLoredeckTagRegistryCount(registry = {}) {
    const normalized = normalizeLoredeckTagRegistry(registry);
    if (!normalized) return 0;
    return Object.keys(normalized.tags || {}).length;
}

export function getLoredeckTimelineRegistryCount(registry = {}) {
    const normalized = normalizeLoredeckTimelineRegistry(registry);
    if (!normalized) return 0;
    return (normalized.anchors?.length || 0)
        + (normalized.windows?.length || 0)
        + (normalized.disabledAnchorIds?.length || 0)
        + (normalized.disabledWindowIds?.length || 0);
}

export function normalizeLoredeckPackageRelativePath(value = '', fallback = '') {
    const raw = String(value || '').replace(/\\/g, '/').trim();
    const candidate = raw && !/^https?:\/\//i.test(raw) && !raw.startsWith('data:') ? raw : fallback;
    const clean = String(candidate || '')
        .replace(/\\/g, '/')
        .replace(/^\.\/+/, '')
        .replace(/^\/+/, '')
        .trim();
    if (
        !clean
        || clean.includes('\0')
        || /^[A-Za-z]:\//.test(clean)
        || clean.split('/').some(part => !part || part === '.' || part === '..')
        || clean.endsWith('/')
    ) {
        return fallback || '';
    }
    return clean;
}

export function loredeckPackageStringify(value = {}) {
    return JSON.stringify(value, null, 2);
}

export function addLoredeckPackageFile(files, path, data, options = {}) {
    const safePath = normalizeLoredeckPackageRelativePath(path);
    if (!safePath) throw new Error(`Package file path is invalid: ${path}`);
    const existingIndex = files.findIndex(file => file.path === safePath);
    if (existingIndex >= 0) {
        if (options.replace === true) {
            files[existingIndex] = { path: safePath, data };
            return true;
        }
        return false;
    }
    files.push({ path: safePath, data });
    return true;
}

export function getLoredeckPackageEntryPath(fileRecord = {}, index = 0) {
    const raw = String(fileRecord.file || '').trim();
    if (!raw || raw.startsWith('__') || /^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
        const stem = raw.includes('override') ? 'entry-overrides' : (raw.includes('generated') ? 'generated-entries' : `entries-${index + 1}`);
        return `entries/${stem}.json`;
    }
    return normalizeLoredeckPackageRelativePath(raw, `entries/entries-${index + 1}.json`);
}

export function getLoredeckPackageRefPaths(manifest = {}) {
    const refs = [];
    const add = ref => {
        const raw = String(ref || '').trim();
        if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith('data:')) return;
        const clean = normalizeLoredeckPackageRelativePath(raw);
        if (clean && !refs.includes(clean)) refs.push(clean);
    };
    const registries = manifest.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    for (const ref of Object.values(registries)) {
        if (typeof ref === 'string') add(ref);
    }
    add(manifest.resolver);
    return refs;
}

export function getLoredeckPackageAssetExtension(mimeType = '', fallbackPath = '') {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('png')) return 'png';
    const ext = String(fallbackPath || '').toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1] || '';
    return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'png';
}

export function dataUrlToBytes(dataUrl = '') {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?((?:;[^,]+)*),(.*)$/i);
    if (!match) throw new Error('Data URL asset could not be decoded.');
    const meta = match[2] || '';
    const body = match[3] || '';
    if (/;base64/i.test(meta)) {
        const binary = atob(body.replace(/\s+/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return { bytes, mimeType: match[1] || '' };
    }
    return {
        bytes: new TextEncoder().encode(decodeURIComponent(body)),
        mimeType: match[1] || '',
    };
}

export async function fetchLoredeckPackageBytes(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
}

export async function stageLoredeckPackageReferencedFile(files, deckFolder, baseUrl, relativePath) {
    const safeRelative = normalizeLoredeckPackageRelativePath(relativePath);
    if (!safeRelative || !baseUrl) return false;
    const bytes = await fetchLoredeckPackageBytes(new URL(safeRelative, baseUrl));
    addLoredeckPackageFile(files, `${deckFolder}/${safeRelative}`, bytes);
    return true;
}

export async function stageLoredeckPackageAssets(files, pack = {}, manifest = {}, baseUrl = null, deckFolder = '') {
    const assets = manifest.assets && typeof manifest.assets === 'object' && !Array.isArray(manifest.assets)
        ? cloneLoredeckJson(manifest.assets) || {}
        : {};
    const packAssets = pack.assets && typeof pack.assets === 'object' && !Array.isArray(pack.assets)
        ? pack.assets
        : {};
    for (const [key, raw] of Object.entries(packAssets)) {
        if (!assets[key]) assets[key] = cloneLoredeckJson(raw) || raw;
    }
    if (!Object.keys(assets).length) return {};

    const exported = {};
    for (const [key, raw] of Object.entries(assets)) {
        const asset = raw && typeof raw === 'object' && !Array.isArray(raw) ? cloneLoredeckJson(raw) || {} : {};
        const path = String(asset.path || '').trim();
        if (!path) continue;
        try {
            if (path.startsWith('data:')) {
                const decoded = dataUrlToBytes(path);
                const ext = getLoredeckPackageAssetExtension(decoded.mimeType || asset.mimeType, asset.title || key);
                const assetPath = normalizeLoredeckPackageRelativePath(`assets/${sanitizeFileStem(key || 'asset')}.${ext}`);
                addLoredeckPackageFile(files, `${deckFolder}/${assetPath}`, decoded.bytes);
                exported[key] = {
                    ...asset,
                    path: assetPath,
                    mimeType: decoded.mimeType || asset.mimeType || `image/${ext}`,
                };
                continue;
            }
            if (/^https?:\/\//i.test(path)) {
                console.warn('[Saga] Skipping remote Loredeck asset during package export:', path);
                continue;
            }
            const assetPath = normalizeLoredeckPackageRelativePath(path);
            if (!assetPath || !baseUrl) continue;
            await stageLoredeckPackageReferencedFile(files, deckFolder, baseUrl, assetPath);
            exported[key] = { ...asset, path: assetPath };
        } catch (e) {
            console.warn('[Saga] Loredeck asset skipped during package export:', pack.packId, key, e);
        }
    }
    return exported;
}

export function buildLoredeckPackageFolderSubset(selectedPackIds = [], registry = {}) {
    const selected = new Set(selectedPackIds);
    const placements = Array.isArray(registry.deckPlacements)
        ? registry.deckPlacements.filter(placement => selected.has(String(placement.deckId || placement.packId || '').trim()))
        : [];
    const folders = Array.isArray(registry.folders) ? registry.folders : [];
    const byId = new Map(folders.map(folder => [String(folder.id || '').trim(), folder]));
    const needed = new Set();
    const addAncestors = folderId => {
        let current = byId.get(String(folderId || '').trim());
        const seen = new Set();
        while (current?.id && !seen.has(current.id)) {
            seen.add(current.id);
            needed.add(current.id);
            current = current.parentId ? byId.get(current.parentId) : null;
        }
    };
    for (const placement of placements) addAncestors(placement.folderId);
    return {
        folders: folders.filter(folder => needed.has(String(folder.id || '').trim())).map(folder => cloneLoredeckJson(folder) || { ...folder }),
        deckPlacements: placements.map(placement => cloneLoredeckJson(placement) || { ...placement }),
    };
}

export function buildLoredeckPackageIndexRecord(pack = {}, manifest = {}, deckFolderName = '') {
    const source = manifest.source && typeof manifest.source === 'object' && !Array.isArray(manifest.source) ? manifest.source : {};
    const originalType = String(source.originalType || pack.type || manifest.type || 'custom').trim() || 'custom';
    const originalPackId = String(source.originalPackId || pack.packId || manifest.id || deckFolderName).trim();
    return {
        packId: pack.packId || manifest.id || deckFolderName,
        manifest: `${deckFolderName}/loredeck.json`,
        type: 'custom',
        originalType,
        originalPackId,
        source: {
            kind: 'package_export',
            originalType,
            originalPackId,
        },
        title: pack.title || manifest.title || pack.packId || deckFolderName,
        description: pack.description || manifest.description || '',
        fandom: pack.fandom || manifest.fandom || '',
        era: pack.era || manifest.era || '',
        author: pack.author || manifest.author || '',
        version: pack.version || manifest.version || '1.0.0',
        library: normalizePackLibraryMetadata(pack.library || manifest.library || {}),
        assets: manifest.assets || pack.assets || {},
        entrySchemaVersion: Math.max(3, Number(pack.entrySchemaVersion || manifest.entrySchemaVersion) || 0),
        tags: Array.isArray(pack.tags) ? pack.tags : (Array.isArray(manifest.tags) ? manifest.tags : []),
        updatedAt: Date.now(),
        stats: pack.stats || manifest.stats || { entryCount: 0, categoryCounts: {} },
    };
}

export function canonicalizeLoredeckBundleValue(value, key = '') {
    const transientKeys = new Set([
        'contentHash',
        'exportedAt',
        'importedAt',
        'installedAt',
        'updatedAt',
        'loadedAt',
        'localModified',
        'health',
        'healthStatus',
        'exportReadiness',
        'pendingChanges',
        'manifestData',
        'source',
        'derivedFrom',
    ]);
    if (transientKeys.has(key)) return undefined;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        const values = value
            .map(item => canonicalizeLoredeckBundleValue(item))
            .filter(item => item !== undefined);
        return values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    const out = {};
    for (const sourceKey of Object.keys(value).sort()) {
        if (sourceKey === 'update' && key === 'manifest') continue;
        if (sourceKey === 'stats' && (key === 'manifest' || key === 'pack')) continue;
        const clean = canonicalizeLoredeckBundleValue(value[sourceKey], sourceKey);
        if (clean !== undefined) out[sourceKey] = clean;
    }
    return out;
}

export function hashLoredeckBundleJson(value) {
    let text = '';
    try {
        text = JSON.stringify(canonicalizeLoredeckBundleValue(value || {}));
    } catch (_) {
        text = String(value || '');
    }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function isLoredeckZipPackageFile(file = {}) {
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    return name.endsWith('.zip') || name.endsWith('.saga-loredeck.zip') || type.includes('zip');
}

export function getLoredeckPackageMimeType(path = '', fallback = '') {
    const text = String(path || fallback || '').toLowerCase();
    if (/\.webp(?:[?#].*)?$/.test(text)) return 'image/webp';
    if (/\.jpe?g(?:[?#].*)?$/.test(text)) return 'image/jpeg';
    if (/\.gif(?:[?#].*)?$/.test(text)) return 'image/gif';
    if (/\.png(?:[?#].*)?$/.test(text)) return 'image/png';
    return String(fallback || '').includes('/') ? fallback : 'application/octet-stream';
}

export function bytesToBase64(bytes = new Uint8Array()) {
    if (typeof btoa === 'function') {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const chunk = bytes.slice(offset, offset + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    }
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    throw new Error('This runtime cannot encode package assets.');
}

export function resolveLoredeckPackageImportPath(deckRoot = '', ref = '') {
    const raw = String(ref || '').replace(/\\/g, '/').trim();
    if (!raw) return '';
    if (raw.startsWith('loredecks/')) return normalizeLoredeckPackageRelativePath(raw);
    return normalizeLoredeckPackageRelativePath(`${String(deckRoot || '').replace(/\\/g, '/')}${raw}`);
}

export function getLoredeckPackageRegistryRef(manifest = {}, key = '') {
    const registries = manifest.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    if (typeof registries[key] === 'string') return registries[key];
    if (key === 'timeline' && typeof manifest.timeline === 'string') return manifest.timeline;
    if (key === 'tags' && typeof manifest.tagRegistry === 'string') return manifest.tagRegistry;
    return '';
}
