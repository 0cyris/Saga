/**
 * Destructive global cleanup helpers for Saga-owned custom content.
 */

import { DEFAULT_SETTINGS } from '../state/constants.js';
import {
    LOREDECK_HEALTH_REPAIR_SESSION_STORAGE_KIND,
    listLoredeckHealthRepairSessions,
} from '../loredecks/loredeck-health-repair-session-storage.js';
import {
    getExternalThemeIconSetLibraryRegistry,
    getExternalThemePackLibraryRegistry,
    hydrateSagaThemeIconStorage,
    removeExternalIconSet,
    removeExternalThemePack,
    resetSagaThemeIconStorageCache,
} from './saga-theme-icon-storage.js';
import {
    flushSagaLorepackLibraryStorageWrites,
    getExternalLoredeckLibraryRegistry,
    hydrateSagaLorepackLibraryStorage,
    removeExternalLoredeckLibraryRecordSync,
    replaceExternalLoredeckLibraryIndexSync,
    resetSagaLorepackLibraryStorageCache,
} from './saga-lorepack-library-storage.js';
import {
    flushSagaLorepackPayloadStorageWrites,
    hydrateExternalLorepackPayloadRecord,
    removeExternalLorepackPayloadSync,
    resetSagaLorepackPayloadStorageCache,
} from './saga-lorepack-payload-storage.js';
import {
    flushSagaCreatorProjectStorageWrites,
    getExternalLoredeckCreatorIndex,
    hydrateSagaCreatorProjectStorage,
    resetSagaCreatorProjectStorageCache,
} from './saga-creator-project-storage.js';
import {
    flushSagaStoryOpenerStorageWrites,
    getExternalStoryOpenerIndex,
    hydrateSagaStoryOpenerStorage,
    resetSagaStoryOpenerStorageCache,
} from './saga-story-opener-storage.js';
import { createSagaFileApi } from './saga-file-api.js';
import {
    createSagaStorageIndexStore,
    SAGA_STORAGE_DOMAIN_INDEX_FILES,
    SAGA_STORAGE_INDEX_PATH,
} from './saga-storage-index.js';
import {
    SAGA_STORAGE_JSON_EXTENSION,
    SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
} from './saga-storage-filenames.js';

const SAGA_USER_FILES_PATH_PATTERN = /^\/user\/files\/saga-[a-z0-9_.-]+\.(json|png|jpe?g|webp|avif)$/i;
const SAGA_TOTAL_DELETE_ALLOWED_EXTENSIONS = Object.freeze([
    SAGA_STORAGE_JSON_EXTENSION,
    ...SAGA_STORAGE_RASTER_ASSET_EXTENSIONS,
]);
const SAGA_KNOWN_INDEX_PATHS = Object.freeze([
    SAGA_STORAGE_DOMAIN_INDEX_FILES.library,
    SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
    SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners,
    SAGA_STORAGE_DOMAIN_INDEX_FILES.themes,
    SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets,
    SAGA_STORAGE_INDEX_PATH,
]);

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeId(value = '') {
    return String(value || '').trim().toLowerCase().slice(0, 160);
}

function normalizeStoragePath(value = '') {
    const text = String(value || '').trim();
    return SAGA_USER_FILES_PATH_PATTERN.test(text) ? text : '';
}

function isMissingStorageFileError(error = {}) {
    return error?.status === 404 || /missing|not found|404/i.test(String(error?.message || error || ''));
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

function uniqueSorted(values = []) {
    return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))].sort();
}

function makeDiagnostic(severity = 'info', code = '', message = '', detail = {}) {
    return {
        severity,
        code,
        message: String(message || ''),
        ...(isPlainObject(detail) && Object.keys(detail).length ? { detail: cloneJson(detail) } : {}),
    };
}

function hasErrorDiagnostics(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : []).some(item => item?.severity === 'error');
}

function collectStoragePaths(value, output = new Set()) {
    if (!value) return output;
    if (typeof value === 'string') {
        const path = normalizeStoragePath(value);
        if (path) output.add(path);
        return output;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectStoragePaths(item, output);
        return output;
    }
    if (isPlainObject(value)) {
        for (const item of Object.values(value)) collectStoragePaths(item, output);
    }
    return output;
}

function getBundledLoredeckIds() {
    return new Set(Object.entries(DEFAULT_SETTINGS.loredeckLibrary?.packs || {})
        .filter(([, pack]) => pack?.type === 'bundled')
        .map(([packId]) => normalizeId(packId)));
}

function isCustomExternalLoredeck(packId = '', pack = {}) {
    const id = normalizeId(packId || pack.packId || pack.id || '');
    if (!id) return false;
    if (pack?.type === 'bundled') return false;
    return !getBundledLoredeckIds().has(id);
}

function getCustomLoredeckIds(library = getExternalLoredeckLibraryRegistry()) {
    return uniqueSorted(Object.entries(library?.packs || {})
        .filter(([packId, pack]) => isCustomExternalLoredeck(packId, pack))
        .map(([packId]) => normalizeId(packId)));
}

function getThemePackIds(registry = getExternalThemePackLibraryRegistry()) {
    return uniqueSorted(Object.keys(registry?.packs || {}).map(normalizeId));
}

function getIconSetIds(registry = getExternalThemeIconSetLibraryRegistry()) {
    return uniqueSorted(Object.keys(registry?.iconSets || {}).map(normalizeId));
}

function getCreatorProjectCount(index = getExternalLoredeckCreatorIndex()) {
    return Object.keys(index?.projects || {}).length;
}

function getStoryOpenerSessionCount(index = getExternalStoryOpenerIndex()) {
    return Object.keys(index?.sessions || {}).length;
}

export function getSagaGlobalCleanupSnapshot() {
    const themePackIds = getThemePackIds();
    const iconSetIds = getIconSetIds();
    const loredeckIds = getCustomLoredeckIds();
    const creatorProjectCount = getCreatorProjectCount();
    const storyOpenerSessionCount = getStoryOpenerSessionCount();
    return {
        ok: true,
        themePackIds,
        iconSetIds,
        loredeckIds,
        themePackCount: themePackIds.length,
        iconSetCount: iconSetIds.length,
        loredeckCount: loredeckIds.length,
        creatorProjectCount,
        storyOpenerSessionCount,
        totalCustomThemeIconCount: themePackIds.length + iconSetIds.length,
    };
}

async function hydrateGlobalCleanupSources(options = {}) {
    const diagnostics = [];
    for (const task of [
        () => hydrateSagaThemeIconStorage({ ...options, force: true }),
        () => hydrateSagaLorepackLibraryStorage({ ...options, force: true }),
        () => hydrateSagaCreatorProjectStorage({ ...options, force: true }),
        () => hydrateSagaStoryOpenerStorage({ ...options, force: true }),
    ]) {
        try {
            await task();
        } catch (error) {
            diagnostics.push(makeDiagnostic(
                'warning',
                'cleanup_preview_hydration_failed',
                error?.message || error || 'Cleanup preview hydration failed.',
            ));
        }
    }
    return diagnostics;
}

export async function buildSagaGlobalCleanupPreview(options = {}) {
    const diagnostics = await hydrateGlobalCleanupSources(options);
    const total = await collectSagaTotalCleanupPaths(options);
    diagnostics.push(...total.diagnostics);
    const snapshot = getSagaGlobalCleanupSnapshot();
    return {
        ...snapshot,
        ok: diagnostics.every(item => item.severity !== 'error'),
        totalSagaFileCount: total.paths.length,
        totalDeletePaths: total.paths,
        trackedFileCount: total.trackedFileCount,
        knownIndexFileCount: total.knownIndexFileCount,
        referencedFileCount: total.referencedFileCount,
        untrackedReferencedFileCount: total.untrackedReferencedFileCount,
        repairSessionCount: total.repairSessionCount,
        customLoredeckCount: snapshot.loredeckCount,
        customThemePackCount: snapshot.themePackCount,
        customIconSetCount: snapshot.iconSetCount,
        willClearSettings: true,
        willClearApiKeys: true,
        willResetActiveChat: true,
        limitations: [
            'Unknown unindexed orphan files that Saga cannot see through its indexes may remain.',
        ],
        diagnostics,
    };
}

async function flushSagaGlobalStorageWrites(options = {}) {
    const diagnostics = [];
    for (const [code, task] of [
        ['loredeck_payload_flush_failed', () => flushSagaLorepackPayloadStorageWrites()],
        ['loredeck_library_flush_failed', () => flushSagaLorepackLibraryStorageWrites()],
        ['creator_project_flush_failed', () => flushSagaCreatorProjectStorageWrites()],
        ['story_opener_flush_failed', () => flushSagaStoryOpenerStorageWrites()],
    ]) {
        try {
            const result = await task();
            if (!result?.ok) diagnostics.push(makeDiagnostic('error', code, result?.error || 'Saga storage write flush failed.'));
        } catch (error) {
            diagnostics.push(makeDiagnostic('error', code, error?.message || error || 'Saga storage write flush failed.'));
        }
    }
    return diagnostics;
}

function addKnownIndexPaths(paths) {
    for (const path of SAGA_KNOWN_INDEX_PATHS) paths.add(path);
}

function collectReferencedCleanupPaths(value, paths, referencedPaths) {
    collectStoragePaths(value, paths);
    collectStoragePaths(value, referencedPaths);
}

function sortTotalCleanupPaths(paths = []) {
    return uniqueSorted(paths)
        .sort((left, right) => {
            const leftRank = left === SAGA_STORAGE_INDEX_PATH ? 3 : (SAGA_KNOWN_INDEX_PATHS.includes(left) ? 2 : 1);
            const rightRank = right === SAGA_STORAGE_INDEX_PATH ? 3 : (SAGA_KNOWN_INDEX_PATHS.includes(right) ? 2 : 1);
            if (leftRank !== rightRank) return leftRank - rightRank;
            return left.localeCompare(right);
        });
}

async function collectSagaTotalCleanupPaths(options = {}) {
    const diagnostics = [];
    const paths = new Set();
    const trackedPaths = new Set();
    const referencedPaths = new Set();
    let trackedFileCount = 0;
    let repairSessionCount = 0;
    addKnownIndexPaths(paths);

    try {
        const index = await getStorageIndexStore(options).readIndex({ allowMissing: false });
        const indexedFiles = index?.files || {};
        trackedFileCount = Object.keys(indexedFiles).length;
        repairSessionCount = Object.values(indexedFiles)
            .filter(record => record?.kind === LOREDECK_HEALTH_REPAIR_SESSION_STORAGE_KIND)
            .length;
        for (const path of Object.keys(indexedFiles)) {
            const normalized = normalizeStoragePath(path);
            if (normalized) {
                paths.add(normalized);
                trackedPaths.add(normalized);
            }
        }
    } catch (error) {
        if (isMissingStorageFileError(error)) {
            diagnostics.push(makeDiagnostic('info', 'storage_index_missing_for_total_cleanup', 'Saga storage index was already missing.'));
        } else {
            diagnostics.push(makeDiagnostic('warning', 'storage_index_read_failed_for_total_cleanup', error?.message || error || 'Saga storage index could not be read.'));
        }
    }

    for (const pack of Object.values(getExternalThemePackLibraryRegistry().packs || {})) {
        collectReferencedCleanupPaths(pack, paths, referencedPaths);
    }
    for (const iconSet of Object.values(getExternalThemeIconSetLibraryRegistry().iconSets || {})) {
        collectReferencedCleanupPaths(iconSet, paths, referencedPaths);
    }

    for (const record of Object.values(getExternalLoredeckLibraryRegistry().packs || {})) {
        collectReferencedCleanupPaths(record, paths, referencedPaths);
        try {
            const hydrated = await hydrateExternalLorepackPayloadRecord(record, options);
            collectReferencedCleanupPaths(hydrated, paths, referencedPaths);
        } catch (error) {
            diagnostics.push(makeDiagnostic('warning', 'total_cleanup_loredeck_payload_hydration_failed', error?.message || error || 'Loredeck payload could not be read for Total Saga Cleanup.', { packId: record?.packId || record?.id || '' }));
        }
    }

    collectReferencedCleanupPaths(getExternalLoredeckCreatorIndex(), paths, referencedPaths);
    collectReferencedCleanupPaths(getExternalStoryOpenerIndex(), paths, referencedPaths);

    const knownIndexFileCount = [...paths].filter(path => SAGA_KNOWN_INDEX_PATHS.includes(path)).length;
    const untrackedReferencedFileCount = [...referencedPaths]
        .filter(path => paths.has(path) && !trackedPaths.has(path) && !SAGA_KNOWN_INDEX_PATHS.includes(path))
        .length;
    return {
        paths: sortTotalCleanupPaths([...paths]),
        trackedFileCount,
        knownIndexFileCount,
        referencedFileCount: referencedPaths.size,
        untrackedReferencedFileCount,
        repairSessionCount,
        diagnostics,
    };
}

async function deleteSagaStoragePath(path = '', options = {}) {
    const file = normalizeStoragePath(path);
    if (!file) {
        return { ok: false, path: '', error: 'Invalid Saga storage path.' };
    }
    try {
        await getFileApi(options).deleteFile(file, {
            allowedExtensions: SAGA_TOTAL_DELETE_ALLOWED_EXTENSIONS,
        });
        return { ok: true, path: file, missing: false };
    } catch (error) {
        if (isMissingStorageFileError(error)) return { ok: true, path: file, missing: true };
        return {
            ok: false,
            path: file,
            error: error?.message || String(error || 'Saga storage file delete failed.'),
        };
    }
}

function resetSagaGlobalStorageCaches() {
    resetSagaThemeIconStorageCache();
    resetSagaLorepackPayloadStorageCache();
    resetSagaLorepackLibraryStorageCache();
    resetSagaCreatorProjectStorageCache();
    resetSagaStoryOpenerStorageCache();
}

export async function runSagaTotalStorageCleanup(options = {}) {
    const diagnostics = await flushSagaGlobalStorageWrites(options);
    diagnostics.push(...await hydrateGlobalCleanupSources(options));
    const collected = await collectSagaTotalCleanupPaths(options);
    diagnostics.push(...collected.diagnostics);

    const deletedFiles = [];
    const missingFiles = [];
    const failedFiles = [];
    const masterPath = SAGA_STORAGE_INDEX_PATH;
    const nonMasterPaths = collected.paths.filter(path => path !== masterPath);
    let masterIndexRetained = false;

    for (const path of nonMasterPaths) {
        const result = await deleteSagaStoragePath(path, options);
        if (result.ok && result.missing) missingFiles.push(result.path);
        else if (result.ok) deletedFiles.push(result.path);
        else {
            failedFiles.push({ path: result.path || path, error: result.error || 'Delete failed.' });
            diagnostics.push(makeDiagnostic('error', 'total_cleanup_delete_failed', result.error || 'Saga storage file delete failed.', { path: result.path || path }));
        }
    }

    if (failedFiles.length || hasErrorDiagnostics(diagnostics)) {
        masterIndexRetained = collected.paths.includes(masterPath);
        diagnostics.push(makeDiagnostic(
            'warning',
            'total_cleanup_master_index_retained',
            failedFiles.length
                ? 'Saga storage index was retained because one or more tracked files could not be deleted.'
                : 'Saga storage index was retained because cleanup reported storage errors.',
        ));
    } else if (collected.paths.includes(masterPath)) {
        const result = await deleteSagaStoragePath(masterPath, options);
        if (result.ok && result.missing) missingFiles.push(result.path);
        else if (result.ok) deletedFiles.push(result.path);
        else {
            masterIndexRetained = true;
            failedFiles.push({ path: result.path || masterPath, error: result.error || 'Delete failed.' });
            diagnostics.push(makeDiagnostic('error', 'total_cleanup_delete_failed', result.error || 'Saga storage index delete failed.', { path: result.path || masterPath }));
        }
    }

    resetSagaGlobalStorageCaches();

    return {
        ok: failedFiles.length === 0 && diagnostics.every(item => item.severity !== 'error'),
        attemptedFileCount: collected.paths.length,
        deletedFiles: uniqueSorted(deletedFiles),
        deletedFileCount: uniqueSorted(deletedFiles).length,
        missingFiles: uniqueSorted(missingFiles),
        missingFileCount: uniqueSorted(missingFiles).length,
        failedFiles,
        failedFileCount: failedFiles.length,
        masterIndexRetained,
        diagnostics,
    };
}

export async function removeSagaCustomThemeIconStorage(options = {}) {
    const diagnostics = [];
    const deletedFiles = [];
    await hydrateSagaThemeIconStorage({ ...options, force: true });

    const themePackIds = getThemePackIds();
    const iconSetIds = getIconSetIds();
    let removedThemePackCount = 0;
    let removedIconSetCount = 0;
    let skippedCount = 0;

    for (const themeId of themePackIds) {
        try {
            const result = await removeExternalThemePack(themeId, options);
            if (result.ok) {
                removedThemePackCount += 1;
                deletedFiles.push(...(result.deletedFiles || []));
            } else if (result.notFound) {
                skippedCount += 1;
            } else {
                diagnostics.push(makeDiagnostic('error', 'theme_pack_cleanup_failed', result.error || `Theme Pack cleanup failed: ${themeId}`, { themeId }));
            }
        } catch (error) {
            diagnostics.push(makeDiagnostic('error', 'theme_pack_cleanup_failed', error?.message || error || `Theme Pack cleanup failed: ${themeId}`, { themeId }));
        }
    }

    for (const iconSetId of iconSetIds) {
        try {
            const result = await removeExternalIconSet(iconSetId, options);
            if (result.ok) {
                removedIconSetCount += 1;
                deletedFiles.push(...(result.deletedFiles || []));
            } else if (result.notFound) {
                skippedCount += 1;
            } else {
                diagnostics.push(makeDiagnostic('error', 'icon_set_cleanup_failed', result.error || `Icon Set cleanup failed: ${iconSetId}`, { iconSetId }));
            }
        } catch (error) {
            diagnostics.push(makeDiagnostic('error', 'icon_set_cleanup_failed', error?.message || error || `Icon Set cleanup failed: ${iconSetId}`, { iconSetId }));
        }
    }

    resetSagaThemeIconStorageCache();
    await hydrateSagaThemeIconStorage({ ...options, force: true });
    return {
        ok: diagnostics.every(item => item.severity !== 'error'),
        removedThemePackCount,
        removedIconSetCount,
        skippedCount,
        deletedFiles: uniqueSorted(deletedFiles),
        deletedFileCount: uniqueSorted(deletedFiles).length,
        diagnostics,
    };
}

function collectLoredeckAssetFiles(pack = {}) {
    return uniqueSorted([
        normalizeStoragePath(pack.coverFile || pack.coverPath || pack.coverImage || ''),
        ...collectStoragePaths(pack.cover || {}),
        ...collectStoragePaths(pack.coverImage || {}),
        ...collectStoragePaths(pack.assets || {}),
        ...collectStoragePaths(pack.manifestData?.assets || {}),
        ...collectStoragePaths(pack.manifestData?.cover || {}),
        ...collectStoragePaths(pack.manifestData?.coverImage || {}),
        ...collectStoragePaths(pack.assetRefs || {}),
    ]);
}

async function deleteRepairSessionsForLoredeck(packId = '', options = {}) {
    const diagnostics = [];
    const deleted = [];
    const listResult = await listLoredeckHealthRepairSessions(packId, options);
    diagnostics.push(...(listResult.diagnostics || []));
    const indexedPaths = uniqueSorted((listResult.records || []).map(record => record.path));
    for (const session of listResult.sessions || []) {
        const result = await deleteRepairSessionPath(session.sessionFile, options);
        if (result.ok) {
            deleted.push(result.path);
        } else {
            diagnostics.push(...(result.diagnostics || [makeDiagnostic('error', 'repair_session_delete_failed', result.error || 'Repair session delete failed.', { packId })]));
        }
    }
    const deletedSet = new Set(deleted);
    for (const path of indexedPaths) {
        if (deletedSet.has(path)) continue;
        const result = await deleteRepairSessionPath(path, options);
        if (result.ok) {
            deleted.push(result.path);
        } else {
            diagnostics.push(...(result.diagnostics || [makeDiagnostic('error', 'repair_session_delete_failed', result.error || 'Repair session stale record cleanup failed.', { packId, path })]));
        }
    }
    return { deleted, diagnostics };
}

async function deleteRepairSessionPath(path = '', options = {}) {
    const file = normalizeStoragePath(path);
    if (!file) {
        return {
            ok: false,
            path: '',
            error: 'Repair session path is invalid.',
            diagnostics: [makeDiagnostic('error', 'repair_session_invalid_path', 'Repair session path is invalid.')],
        };
    }
    try {
        const fileApi = getFileApi(options);
        try {
            await fileApi.deleteFile(file, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
        } catch (error) {
            if (!isMissingStorageFileError(error)) throw error;
        }
        const storageIndexStore = getStorageIndexStore({ ...options, fileApi });
        if (storageIndexStore?.unregisterFile) await storageIndexStore.unregisterFile(file, options);
        return { ok: true, path: file };
    } catch (error) {
        return {
            ok: false,
            path: file,
            error: error?.message || String(error || 'Repair session delete failed.'),
            diagnostics: [makeDiagnostic('error', 'repair_session_delete_failed', error?.message || error || 'Repair session delete failed.', { path: file })],
        };
    }
}

function getPlacementDeckId(placement = {}) {
    return normalizeId(placement.packId || placement.deckId || '');
}

function collectFolderLineage(folderId = '', folderById = new Map(), output = new Set()) {
    let id = String(folderId || '').trim();
    const seen = new Set();
    while (id && !seen.has(id)) {
        seen.add(id);
        const folder = folderById.get(id);
        if (!folder) break;
        output.add(id);
        id = String(folder.parentId || '').trim();
    }
    return output;
}

function pruneExternalLibraryLayout(options = {}, context = {}) {
    const current = getExternalLoredeckLibraryRegistry();
    const initial = isPlainObject(context.initialLibrary) ? context.initialLibrary : current;
    const removedLoredeckIds = new Set((context.removedLoredeckIds || []).map(normalizeId).filter(Boolean));
    const remainingPackIds = new Set([
        ...getBundledLoredeckIds(),
        ...Object.keys(current.packs || {}).map(normalizeId),
    ]);
    const deckPlacements = (current.deckPlacements || [])
        .filter(placement => remainingPackIds.has(getPlacementDeckId(placement)));
    const folderById = new Map((current.folders || [])
        .map(folder => [String(folder.id || '').trim(), folder])
        .filter(([id]) => id));
    const initialFolderById = new Map((initial.folders || current.folders || [])
        .map(folder => [String(folder.id || '').trim(), folder])
        .filter(([id]) => id));
    const survivingFolderIds = new Set();
    for (const placement of deckPlacements) {
        collectFolderLineage(placement.folderId, folderById, survivingFolderIds);
    }
    const affectedFolderIds = new Set();
    for (const placement of initial.deckPlacements || []) {
        if (!removedLoredeckIds.has(getPlacementDeckId(placement))) continue;
        collectFolderLineage(placement.folderId, initialFolderById, affectedFolderIds);
    }
    const folders = (current.folders || []).filter(folder => {
        const id = String(folder.id || '').trim();
        if (!id) return false;
        if (survivingFolderIds.has(id)) return true;
        return !affectedFolderIds.has(id);
    });
    const keptFolderIds = new Set(folders.map(folder => String(folder.id || '').trim()).filter(Boolean));
    const activeStack = (current.activeStack || [])
        .filter(item => {
            const folderId = String(item.folderId || '').trim();
            if (item.type === 'folder' || folderId) return folderId && keptFolderIds.has(folderId);
            return remainingPackIds.has(normalizeId(item.packId || item.deckId || ''));
        });
    replaceExternalLoredeckLibraryIndexSync({
        ...current,
        folders,
        deckPlacements,
        activeStack,
    }, { ...options, replace: true });
}

export async function removeSagaCustomLoredeckStorage(options = {}) {
    const diagnostics = [];
    const deletedFiles = [];
    const repairSessionFiles = [];

    await flushSagaLorepackPayloadStorageWrites();
    await flushSagaLorepackLibraryStorageWrites();
    await hydrateSagaLorepackLibraryStorage({ ...options, force: true });

    const initialLibrary = getExternalLoredeckLibraryRegistry();
    const loredeckIds = getCustomLoredeckIds(initialLibrary);
    let removedLoredeckCount = 0;
    let skippedCount = 0;

    for (const packId of loredeckIds) {
        const record = initialLibrary.packs?.[packId] || {};
        let hydrated = record;
        try {
            hydrated = await hydrateExternalLorepackPayloadRecord(record, options);
        } catch (error) {
            diagnostics.push(makeDiagnostic('warning', 'loredeck_payload_hydration_failed', error?.message || error || `Loredeck payload hydration failed: ${packId}`, { packId }));
        }

        const payloadFile = normalizeStoragePath(hydrated?.payloadFile || record.payloadFile || '');
        const assetFiles = collectLoredeckAssetFiles({ ...record, ...hydrated });
        const payloadResult = removeExternalLorepackPayloadSync(packId, {
            ...options,
            payloadFile,
            assetFiles,
            staleCheck: false,
        });
        if (payloadResult.ok) {
            deletedFiles.push(...[payloadResult.payloadFile, ...(payloadResult.assetFiles || [])].filter(Boolean));
        } else if (payloadResult.notFound) {
            skippedCount += 1;
        } else {
            diagnostics.push(makeDiagnostic('error', 'loredeck_payload_cleanup_failed', payloadResult.error || `Loredeck payload cleanup failed: ${packId}`, { packId }));
        }

        const repairResult = await deleteRepairSessionsForLoredeck(packId, options);
        repairSessionFiles.push(...repairResult.deleted);
        diagnostics.push(...repairResult.diagnostics);

        const libraryResult = removeExternalLoredeckLibraryRecordSync(packId, {
            ...options,
            staleCheck: false,
        });
        if (libraryResult.ok) {
            removedLoredeckCount += 1;
        } else if (libraryResult.notFound) {
            skippedCount += 1;
        } else {
            diagnostics.push(makeDiagnostic('error', 'loredeck_library_cleanup_failed', libraryResult.error || `Loredeck Library cleanup failed: ${packId}`, { packId }));
        }
    }

    pruneExternalLibraryLayout({ ...options, staleCheck: false }, {
        initialLibrary,
        removedLoredeckIds: loredeckIds,
    });

    const payloadFlush = await flushSagaLorepackPayloadStorageWrites();
    const libraryFlush = await flushSagaLorepackLibraryStorageWrites();
    if (!payloadFlush.ok) diagnostics.push(makeDiagnostic('error', 'loredeck_payload_cleanup_flush_failed', payloadFlush.error || 'Loredeck payload cleanup write failed.'));
    if (!libraryFlush.ok) diagnostics.push(makeDiagnostic('error', 'loredeck_library_cleanup_flush_failed', libraryFlush.error || 'Loredeck Library cleanup write failed.'));

    resetSagaLorepackPayloadStorageCache();
    resetSagaLorepackLibraryStorageCache();
    await hydrateSagaLorepackLibraryStorage({ ...options, force: true });

    return {
        ok: diagnostics.every(item => item.severity !== 'error'),
        removedLoredeckCount,
        skippedCount,
        deletedFiles: uniqueSorted(deletedFiles),
        deletedFileCount: uniqueSorted(deletedFiles).length,
        repairSessionFiles: uniqueSorted(repairSessionFiles),
        repairSessionDeletedCount: uniqueSorted(repairSessionFiles).length,
        diagnostics,
    };
}
