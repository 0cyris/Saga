/**
 * External Lorepack Library index storage.
 */

import { DEFAULT_SETTINGS } from '../state/constants.js';
import {
    isDocumentationFixtureLoredeckPack,
    normalizeLoredeckRegistry,
} from '../state/lore-state-normalizers.js';
import { normalizeLoredeckLibraryIndex } from '../loredecks/loredeck-library-index.js';
import { createSagaFileApi } from './saga-file-api.js';
import { createSagaDomainStorage } from './saga-domain-storage.js';
import { createSagaStorageIndexStore, SAGA_STORAGE_DOMAIN_INDEX_FILES } from './saga-storage-index.js';
import { hydrateCachedExternalLorepackPayloadRecord } from './saga-lorepack-payload-storage.js';

const EMPTY_LIBRARY_REGISTRY = Object.freeze({ schemaVersion: 1, packs: Object.freeze({}) });

let hydratedLibraryRegistry = {
    schemaVersion: 1,
    packs: {},
    folders: [],
    deckPlacements: [],
    activeStack: [],
};
let hydrationStatus = {
    loaded: false,
    loading: false,
    loadedAt: 0,
    error: '',
};
let hydrationPromise = null;
let storageRuntimeOptions = {};
let pendingLibraryWrite = Promise.resolve();
let pendingLibraryWriteCount = 0;
let lastLibraryWriteError = '';

export function configureSagaLorepackLibraryStorage(options = {}) {
    storageRuntimeOptions = { ...storageRuntimeOptions, ...(options || {}) };
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

function resolveStorageOptions(options = {}) {
    return { ...(storageRuntimeOptions || {}), ...(options || {}) };
}

function getClockNow(options = {}) {
    const merged = resolveStorageOptions(options);
    if (typeof merged.now === 'function') return normalizeTimestamp(merged.now(), Date.now());
    if (merged.now !== undefined) return normalizeTimestamp(merged.now, Date.now());
    return Date.now();
}

function normalizeString(value = '', maxLength = 500) {
    return String(value || '').trim().slice(0, Math.max(1, Number(maxLength) || 500));
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
    const path = normalizeString(value, 500);
    return /^\/user\/files\/saga-[a-z0-9_.-]+\.json$/i.test(path) ? path : '';
}

function normalizePackRecord(value = {}, fallbackId = '', options = {}) {
    const raw = isPlainObject(value) ? cloneJson(value) : {};
    const packId = normalizeString(raw.packId || raw.id || fallbackId, 160)
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!packId) return null;
    const now = getClockNow(options);
    const payloadFile = normalizeStoragePath(raw.payloadFile || raw.payloadPath || '');
    const coverFile = normalizeString(raw.coverFile || raw.coverPath || raw.coverImage || '', 500);
    const source = isPlainObject(raw.source) ? raw.source : {};
    if (isDocumentationFixtureLoredeckPack(packId, { ...raw, source })) return null;
    const stats = isPlainObject(raw.stats) ? raw.stats : {};
    const record = {
        schemaVersion: 1,
        packId,
        id: normalizeString(raw.id || packId, 160),
        type: raw.type === 'bundled' ? 'bundled' : normalizeString(raw.type || 'custom', 80),
        title: normalizeString(raw.title || packId, 240),
        description: normalizeString(raw.description || '', 1000),
        fandom: normalizeString(raw.fandom || '', 240),
        era: normalizeString(raw.era || '', 240),
        author: normalizeString(raw.author || '', 240),
        version: normalizeString(raw.version || '', 120),
        entrySchemaVersion: Math.max(0, Math.floor(Number(raw.entrySchemaVersion) || 0)),
        manifest: normalizeString(raw.manifest || '', 500),
        source,
        sourceKind: normalizeString(raw.sourceKind || source.kind || raw.storageMode || '', 120),
        tags: Array.isArray(raw.tags) ? raw.tags.map(tag => normalizeString(tag, 120)).filter(Boolean).slice(0, 64) : [],
        stats,
        payloadFile,
        coverFile,
        entryCount: Math.max(0, Math.floor(Number(raw.entryCount ?? stats.entryCount) || 0)),
        tagCount: Math.max(0, Math.floor(Number(raw.tagCount ?? stats.tagCount) || 0)),
        timelineEventCount: Math.max(0, Math.floor(Number(raw.timelineEventCount ?? stats.timelineEventCount) || 0)),
        healthStatus: normalizeString(raw.healthStatus || '', 120),
        localModified: raw.localModified === true,
        installedAt: normalizeTimestamp(raw.installedAt || raw.createdAt, now),
        updatedAt: normalizeTimestamp(raw.updatedAt, now),
    };
    const derivedFrom = isPlainObject(raw.derivedFrom) ? cloneJson(raw.derivedFrom) : null;
    if (derivedFrom) record.derivedFrom = derivedFrom;
    if (!record.sourceKind) delete record.sourceKind;
    if (!record.payloadFile) delete record.payloadFile;
    if (!record.coverFile) delete record.coverFile;
    if (!Object.keys(record.source || {}).length) delete record.source;
    if (!record.tags.length) delete record.tags;
    if (!Object.keys(record.stats || {}).length) delete record.stats;
    if (!record.healthStatus) delete record.healthStatus;
    return record;
}

function normalizePackMap(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const packs = {};
    for (const [packId, pack] of Object.entries(raw)) {
        const normalized = normalizePackRecord(pack, packId, options);
        if (normalized) packs[normalized.packId] = normalized;
    }
    return Object.fromEntries(Object.entries(packs).sort(([left], [right]) => left.localeCompare(right)));
}

function containsDocumentationFixtureLoredeckPack(registry = {}) {
    const packs = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs)
        ? registry.packs
        : {};
    return Object.entries(packs).some(([packId, pack]) => isDocumentationFixtureLoredeckPack(packId, pack));
}

function getDocumentationFixtureLoredeckPackIds(registry = {}) {
    const packs = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs)
        ? registry.packs
        : {};
    return new Set(Object.entries(packs)
        .filter(([packId, pack]) => isDocumentationFixtureLoredeckPack(packId, pack))
        .map(([packId, pack]) => normalizeString(pack?.packId || pack?.id || packId, 160))
        .filter(Boolean));
}

function shouldPersistQueuedWrites(options = {}) {
    const merged = resolveStorageOptions(options);
    if (merged.persistWrites === false || merged.persist === false) return false;
    if (merged.fileApi || merged.domainStorage || merged.storageIndexStore) return true;
    return typeof window !== 'undefined' && typeof fetch === 'function';
}

function recordQueuedWriteError(error = {}, options = {}) {
    const merged = resolveStorageOptions(options);
    lastLibraryWriteError = String(error?.message || error || 'Lorepack Library external storage write failed.');
    if (typeof merged.onWriteError === 'function') {
        merged.onWriteError(error);
        return;
    }
    console.warn('[Saga] Lorepack Library external storage write failed:', error);
}

function setHydratedLibraryRegistry(library = {}, options = {}) {
    const now = getClockNow(options);
    hydratedLibraryRegistry = normalizeSagaLibraryIndex(library, { now });
    hydrationStatus = {
        loaded: true,
        loading: false,
        loadedAt: now,
        error: '',
    };
    return getExternalLoredeckLibraryRegistry();
}

function queueExternalLoredeckLibraryIndexWrite(library = {}, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingLibraryWrite;
    const merged = resolveStorageOptions(options);
    const now = getClockNow(merged);
    const snapshot = normalizeSagaLibraryIndex(cloneJson(library), { now });
    const staleCheck = merged.staleCheck !== false && pendingLibraryWriteCount === 0;
    const expectedRevision = staleCheck ? Math.max(1, Math.floor(Number(snapshot.revision) || 1)) : undefined;
    pendingLibraryWriteCount += 1;
    pendingLibraryWrite = pendingLibraryWrite
        .catch(() => {})
        .then(async () => {
            try {
                await writeExternalLoredeckLibraryIndex(snapshot, {
                    ...merged,
                    staleCheck,
                    expectedRevision,
                });
                lastLibraryWriteError = '';
            } catch (error) {
                recordQueuedWriteError(error, merged);
            } finally {
                pendingLibraryWriteCount = Math.max(0, pendingLibraryWriteCount - 1);
            }
        });
    return pendingLibraryWrite;
}

export function createSagaLibraryIndex(options = {}) {
    const now = getClockNow(options);
    return {
        schemaVersion: 1,
        kind: 'saga_library_index',
        createdAt: now,
        updatedAt: now,
        revision: 1,
        packs: {},
        folders: [],
        deckPlacements: [],
        activeStack: [],
    };
}

export function normalizeSagaLibraryIndex(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const removedDocumentationFixturePackIds = getDocumentationFixtureLoredeckPackIds(raw);
    const compactPacks = normalizePackMap(raw.packs, options);
    const layoutBase = normalizeLoredeckLibraryIndex({
        schemaVersion: 1,
        folders: Array.isArray(raw.folders) ? raw.folders : [],
        deckPlacements: Array.isArray(raw.deckPlacements) ? raw.deckPlacements : [],
        activeStack: Array.isArray(raw.activeStack) ? raw.activeStack : [],
    }, {
        defaults: { schemaVersion: 1, folders: [], deckPlacements: [], activeStack: [] },
        packs: {
            ...(DEFAULT_SETTINGS.loredeckLibrary?.packs || {}),
            ...compactPacks,
        },
        applySuggestedPaths: false,
    });
    const packs = {};
    for (const [packId, pack] of Object.entries(compactPacks || {})) {
        const compact = compactPacks[packId] || {};
        const normalizedPack = normalizeLoredeckRegistry({
            schemaVersion: 1,
            packs: { [packId]: pack },
        }, EMPTY_LIBRARY_REGISTRY).packs?.[packId] || pack;
        packs[packId] = {
            ...normalizedPack,
            ...pack,
            ...(compact.payloadFile ? { payloadFile: compact.payloadFile } : {}),
            ...(compact.coverFile ? { coverFile: compact.coverFile } : {}),
            sourceKind: compact.sourceKind || normalizedPack.source?.kind || '',
            entryCount: compact.entryCount || normalizedPack.stats?.entryCount || 0,
            tagCount: compact.tagCount || 0,
            timelineEventCount: compact.timelineEventCount || 0,
        };
        if (!packs[packId].sourceKind) delete packs[packId].sourceKind;
        for (const key of [
            'assets',
            'disabledEntryIds',
            'entryOverrides',
            'healthIssueStates',
            'library',
            'manifestData',
            'pendingChanges',
            'tagRegistry',
            'timelineRegistry',
            'timelineRegistryIssue',
        ]) {
            delete packs[packId][key];
        }
    }
    const shouldRemoveFixtureLayoutPackId = packId => (
        removedDocumentationFixturePackIds.has(normalizeString(packId, 160))
        || isDocumentationFixtureLoredeckPack(packId)
    );
    return {
        schemaVersion: 1,
        kind: 'saga_library_index',
        createdAt: normalizeTimestamp(raw.createdAt, options.now || 0),
        updatedAt: normalizeTimestamp(raw.updatedAt, options.now || 0),
        revision: Math.max(1, Math.floor(Number(raw.revision) || 1)),
        packs,
        folders: layoutBase.folders || [],
        deckPlacements: (layoutBase.deckPlacements || []).filter(placement => !shouldRemoveFixtureLayoutPackId(placement.deckId || placement.packId)),
        activeStack: (layoutBase.activeStack || []).filter(item => item.type === 'folder' || !shouldRemoveFixtureLayoutPackId(item.packId || item.deckId)),
    };
}

export function mergeExternalLoredeckLibraryRegistry(settingsRegistry = {}, chatRegistry = {}, options = {}) {
    const settings = normalizeLoredeckRegistry(settingsRegistry || DEFAULT_SETTINGS.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const chat = normalizeLoredeckRegistry(chatRegistry || EMPTY_LIBRARY_REGISTRY, EMPTY_LIBRARY_REGISTRY);
    const external = normalizeSagaLibraryIndex(hydratedLibraryRegistry);
    const hydrateCachedPayloads = options.hydrateCachedPayloads === true;
    const externalPacks = Object.fromEntries(Object.entries(external.packs || {})
        .map(([packId, pack]) => [packId, hydrateCachedPayloads ? hydrateCachedExternalLorepackPayloadRecord(pack) : cloneJson(pack)]));
    return normalizeLoredeckRegistry({
        schemaVersion: 1,
        packs: {
            ...(chat.packs || {}),
            ...(settings.packs || {}),
            ...externalPacks,
        },
        folders: [
            ...(settings.folders || []),
            ...(external.folders || []),
        ],
        deckPlacements: [
            ...(settings.deckPlacements || []),
            ...(external.deckPlacements || []),
        ],
        activeStack: (settings.activeStack || []).length
            ? settings.activeStack
            : (external.activeStack || []),
    }, DEFAULT_SETTINGS.loredeckLibrary);
}

export function getExternalLoredeckLibraryRegistry() {
    return cloneJson(hydratedLibraryRegistry);
}

export function resetSagaLorepackLibraryStorageCache() {
    hydratedLibraryRegistry = createSagaLibraryIndex({ now: 0 });
    hydrationStatus = {
        loaded: false,
        loading: false,
        loadedAt: 0,
        error: '',
    };
    hydrationPromise = null;
    pendingLibraryWrite = Promise.resolve();
    pendingLibraryWriteCount = 0;
    lastLibraryWriteError = '';
}

export function getSagaLorepackLibraryStorageStatus() {
    return {
        ...hydrationStatus,
        pendingWrites: pendingLibraryWriteCount,
        lastWriteError: lastLibraryWriteError,
    };
}

export async function flushSagaLorepackLibraryStorageWrites() {
    await pendingLibraryWrite;
    return {
        ok: !lastLibraryWriteError,
        error: lastLibraryWriteError,
        pendingWrites: pendingLibraryWriteCount,
        library: getExternalLoredeckLibraryRegistry(),
    };
}

export async function hydrateSagaLorepackLibraryStorage(options = {}) {
    if (hydrationPromise && options.force !== true) return hydrationPromise;
    hydrationStatus = { ...hydrationStatus, loading: true, error: '' };
    hydrationPromise = (async () => {
        const domainStorage = getDomainStorage(options);
        const index = await domainStorage.readDomainIndex('library', { allowMissing: true });
        const hadDocumentationFixturePack = containsDocumentationFixtureLoredeckPack(index);
        hydratedLibraryRegistry = normalizeSagaLibraryIndex(index, { now: getClockNow(options) });
        hydrationStatus = {
            loaded: true,
            loading: false,
            loadedAt: getClockNow(options),
            error: '',
        };
        if (hadDocumentationFixturePack) {
            queueExternalLoredeckLibraryIndexWrite(hydratedLibraryRegistry, {
                ...options,
                staleCheck: false,
            });
        }
        return { ok: true, library: getExternalLoredeckLibraryRegistry() };
    })().catch(error => {
        hydrationStatus = {
            loaded: false,
            loading: false,
            loadedAt: 0,
            error: error?.message || String(error || 'Lorepack Library storage hydration failed.'),
        };
        hydrationPromise = null;
        throw error;
    });
    return hydrationPromise;
}

export async function writeExternalLoredeckLibraryIndex(library = {}, options = {}) {
    const domainStorage = getDomainStorage(options);
    const now = getClockNow(options);
    const normalized = normalizeSagaLibraryIndex({
        ...library,
        updatedAt: now,
    }, { now });
    const staleCheck = options.staleCheck !== false;
    const expectedRevision = options.expectedRevision !== undefined
        ? Math.max(1, Math.floor(Number(options.expectedRevision) || 1))
        : (staleCheck ? Math.max(1, Math.floor(Number(normalized.revision) || 1)) : undefined);
    const result = await domainStorage.writeDomainIndex('library', normalized, {
        ...options,
        staleCheck,
        expectedRevision,
        staleMessage: 'Library storage changed. Reload the Library before changing folders.',
        bumpRevision: options.bumpRevision !== false,
    });
    hydratedLibraryRegistry = normalizeSagaLibraryIndex(result.index, { now });
    return {
        ok: true,
        path: SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
        library: getExternalLoredeckLibraryRegistry(),
    };
}

export async function upsertExternalLoredeckLibraryRecord(packRecord = {}, options = {}) {
    const now = getClockNow(options);
    const current = normalizeSagaLibraryIndex(hydratedLibraryRegistry, { now });
    const pack = normalizePackRecord(packRecord, '', { now });
    if (!pack) return { ok: false, error: 'Loredeck record must include a packId/id.' };
    if (DEFAULT_SETTINGS.loredeckLibrary?.packs?.[pack.packId]?.type === 'bundled' && pack.type !== 'bundled') {
        return { ok: false, error: 'A Custom or Generated Loredeck cannot replace a Bundled Loredeck with the same id.' };
    }
    current.packs[pack.packId] = {
        ...(current.packs[pack.packId] || {}),
        ...pack,
        installedAt: current.packs[pack.packId]?.installedAt || pack.installedAt || now,
        updatedAt: now,
    };
    return writeExternalLoredeckLibraryIndex(current, options);
}

export async function removeExternalLoredeckLibraryRecord(packId = '', options = {}) {
    const id = normalizeString(packId, 160);
    const current = normalizeSagaLibraryIndex(hydratedLibraryRegistry, { now: getClockNow(options) });
    if (!id || !current.packs[id]) return { ok: false, notFound: true, error: 'Loredeck is not registered in external storage.' };
    delete current.packs[id];
    current.deckPlacements = (current.deckPlacements || []).filter(placement => placement.deckId !== id && placement.packId !== id);
    current.activeStack = (current.activeStack || []).filter(item => item.packId !== id);
    return writeExternalLoredeckLibraryIndex(current, options);
}

export function replaceExternalLoredeckLibraryIndexSync(library = {}, options = {}) {
    const now = getClockNow(options);
    const next = normalizeSagaLibraryIndex({
        ...(options.replace === true ? createSagaLibraryIndex({ now }) : hydratedLibraryRegistry),
        ...(isPlainObject(library) ? cloneJson(library) : {}),
        updatedAt: now,
    }, { now });
    const external = setHydratedLibraryRegistry(next, { now });
    queueExternalLoredeckLibraryIndexWrite(external, options);
    return { ok: true, library: external };
}

export function updateExternalLoredeckLibraryLayoutSync(layout = {}, options = {}) {
    const now = getClockNow(options);
    const current = normalizeSagaLibraryIndex(hydratedLibraryRegistry, { now });
    const next = {
        ...current,
        updatedAt: now,
        revision: Math.max(1, Number(current.revision) || 1),
    };
    if (Array.isArray(layout.folders)) next.folders = layout.folders.map(item => cloneJson(item));
    if (Array.isArray(layout.deckPlacements)) next.deckPlacements = layout.deckPlacements.map(item => cloneJson(item));
    if (Array.isArray(layout.activeStack)) next.activeStack = layout.activeStack.map(item => cloneJson(item));
    const external = setHydratedLibraryRegistry(next, { now });
    queueExternalLoredeckLibraryIndexWrite(external, options);
    return { ok: true, library: external };
}

export function upsertExternalLoredeckLibraryRecordSync(packRecord = {}, options = {}) {
    const now = getClockNow(options);
    const current = normalizeSagaLibraryIndex(hydratedLibraryRegistry, { now });
    const pack = normalizePackRecord(packRecord, '', { now });
    if (!pack) return { ok: false, error: 'Loredeck record must include a packId/id.' };
    if (DEFAULT_SETTINGS.loredeckLibrary?.packs?.[pack.packId]?.type === 'bundled' && pack.type !== 'bundled') {
        return { ok: false, error: 'A Custom or Generated Loredeck cannot replace a Bundled Loredeck with the same id.' };
    }
    current.packs[pack.packId] = {
        ...(current.packs[pack.packId] || {}),
        ...pack,
        installedAt: current.packs[pack.packId]?.installedAt || pack.installedAt || now,
        updatedAt: now,
    };
    const external = setHydratedLibraryRegistry(current, { now });
    queueExternalLoredeckLibraryIndexWrite(external, options);
    return {
        ok: true,
        pack: getExternalLoredeckLibraryRegistry().packs[pack.packId],
        library: getExternalLoredeckLibraryRegistry(),
    };
}

export function importExternalLoredeckLibraryRegistrySync(registry = {}, options = {}) {
    const now = getClockNow(options);
    const incoming = normalizeSagaLibraryIndex(registry, { now });
    const current = options.replace === true
        ? createSagaLibraryIndex({ now })
        : normalizeSagaLibraryIndex(hydratedLibraryRegistry, { now });
    let importedCount = 0;
    let skippedCount = 0;
    const importedPackIds = [];
    const skippedPackIds = [];
    for (const [packId, pack] of Object.entries(incoming.packs || {})) {
        const bundledDefault = DEFAULT_SETTINGS.loredeckLibrary?.packs?.[packId];
        if (bundledDefault?.type === 'bundled' && pack.type !== 'bundled') {
            skippedCount += 1;
            skippedPackIds.push(packId);
            continue;
        }
        current.packs[packId] = {
            ...(current.packs[packId] || {}),
            ...pack,
            installedAt: current.packs[packId]?.installedAt || pack.installedAt || now,
            updatedAt: now,
        };
        importedCount += 1;
        importedPackIds.push(packId);
    }
    current.folders = [
        ...(current.folders || []),
        ...(incoming.folders || []),
    ];
    current.deckPlacements = [
        ...(current.deckPlacements || []),
        ...(incoming.deckPlacements || []),
    ];
    current.activeStack = (incoming.activeStack || []).length
        ? incoming.activeStack
        : (current.activeStack || []);
    const external = setHydratedLibraryRegistry(current, { now });
    queueExternalLoredeckLibraryIndexWrite(external, options);
    return { ok: true, importedCount, skippedCount, importedPackIds, skippedPackIds, library: external };
}

export function removeExternalLoredeckLibraryRecordSync(packId = '', options = {}) {
    const id = normalizeString(packId, 160).toLowerCase();
    const now = getClockNow(options);
    const current = normalizeSagaLibraryIndex(hydratedLibraryRegistry, { now });
    if (!id || !current.packs[id]) return { ok: false, notFound: true, error: 'Loredeck is not registered in external storage.' };
    delete current.packs[id];
    current.deckPlacements = (current.deckPlacements || []).filter(placement => placement.deckId !== id && placement.packId !== id);
    current.activeStack = (current.activeStack || []).filter(item => item.packId !== id);
    const external = setHydratedLibraryRegistry(current, { now });
    queueExternalLoredeckLibraryIndexWrite(external, options);
    return { ok: true, library: external };
}

resetSagaLorepackLibraryStorageCache();
