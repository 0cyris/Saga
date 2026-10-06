/**
 * Loredeck Library registry settings store.
 */

import { DEFAULT_SETTINGS, getDefaultState as createDefaultState } from './constants.js';
import { getSettings as readSettings, saveSettings as writeSettings } from './settings-store.js';
import { normalizeLoredeckCreatorRegistry, removeLoredeckCreatorJobsForGeneratedPackId } from './lore-creator-state.js';
import { getLoredeckCreatorProjectRegistry, getLoredeckCreatorSettingsRegistry } from './lore-creator-store.js';
import { normalizeLoredeckRegistry } from './lore-state-normalizers.js';
import {
    importExternalLoredeckLibraryRegistrySync,
    mergeExternalLoredeckLibraryRegistry,
    removeExternalLoredeckLibraryRecordSync,
    replaceExternalLoredeckLibraryIndexSync,
    updateExternalLoredeckLibraryLayoutSync,
    upsertExternalLoredeckLibraryRecordSync,
} from '../storage/saga-lorepack-library-storage.js';
import {
    hydrateCachedExternalLorepackPayloadRecord,
    isExternalLorepackPayloadHydratedRecord,
    removeExternalLorepackPayloadSync,
    upsertExternalLorepackPayloadSync,
} from '../storage/saga-lorepack-payload-storage.js';
import { removeExternalLoredeckCreatorProjectSync } from '../storage/saga-creator-project-storage.js';
import { assertSagaStorageWriteAcknowledged } from '../storage/saga-storage-coordinator.js';

let storeDeps = {};

export function configureLoredeckLibraryStore(deps = {}) {
    storeDeps = { ...deps };
}

function getState() {
    if (typeof storeDeps.getState === 'function') return storeDeps.getState();
    throw new Error('Loredeck Library store is not configured.');
}

function saveState(state, options) {
    if (typeof storeDeps.saveState === 'function') return storeDeps.saveState(state, options);
    throw new Error('Loredeck Library store is not configured.');
}

function getSettings() {
    return typeof storeDeps.getSettings === 'function' ? storeDeps.getSettings() : readSettings();
}

function saveSettings(settings) {
    return typeof storeDeps.saveSettings === 'function' ? storeDeps.saveSettings(settings) : writeSettings(settings);
}

function getDefaultState() {
    return typeof storeDeps.getDefaultState === 'function' ? storeDeps.getDefaultState() : createDefaultState();
}

function getLoredeckLibraryPersistenceErrorMessage(error = {}, fallback = 'Loredeck library persistence failed.') {
    return String(error?.message || error || fallback).trim().replace(/\s+/g, ' ').slice(0, 500) || fallback;
}

function failLoredeckLibraryPersistence(error = {}, fallback = 'Loredeck library persistence failed.') {
    console.warn('[Saga] Loredeck Library persistence failed:', error);
    return {
        ok: false,
        error: getLoredeckLibraryPersistenceErrorMessage(error, fallback),
    };
}

function cleanupSettingsLoredeckLibraryPack(settings = {}, packId = '', options = {}) {
    const id = String(packId || '').trim();
    if (!id || !settings || typeof settings !== 'object') return false;
    const library = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    if (!library.packs?.[id]) return false;
    delete library.packs[id];
    if (options.removeLayout === true) {
        library.deckPlacements = (library.deckPlacements || []).filter(placement => placement.deckId !== id && placement.packId !== id);
        library.activeStack = (library.activeStack || []).filter(item => item.packId !== id);
    }
    settings.loredeckLibrary = normalizeLoredeckRegistry(library, DEFAULT_SETTINGS.loredeckLibrary);
    return true;
}

function cleanupSettingsLoredeckLibraryPacks(settings = {}, packIds = [], options = {}) {
    let changed = false;
    for (const packId of packIds || []) {
        if (cleanupSettingsLoredeckLibraryPack(settings, packId, options)) changed = true;
    }
    return changed;
}

const cloneSettings = settings => JSON.parse(JSON.stringify(settings));

async function completeLibraryWrites(results, cleanup) {
    try {
        let finalResult = { ok: true, persisted: true, queued: false };
        for (const result of results) {
            const persisted = await (result.completion || result);
            if (!persisted?.ok || persisted.persisted !== true) return persisted || { ok: false, persisted: false, error: 'External storage is unavailable.' };
            if (persisted.index) replaceExternalLoredeckLibraryIndexSync(persisted.index, { persist: false });
            finalResult = persisted;
        }
        if (cleanup) await cleanup();
        return finalResult;
    } catch (error) { return failLoredeckLibraryPersistence(error); }
}

export function getLoredeckLibraryRegistry(state = null) {
    const settings = getSettings();
    const globalLibrary = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const chatRegistry = normalizeLoredeckRegistry(
        state?.loredeckRegistry,
        { schemaVersion: 1, packs: {} }
    );
    return mergeExternalLoredeckLibraryRegistry(globalLibrary, chatRegistry);
}

export function upsertLoredeckLibraryPack(packRecord = {}) {
    const clearableOptionalFields = [
        'pendingChanges',
        'tagRegistry',
        'timelineRegistry',
        'healthIssueStates',
        'manifestData',
        'assets',
        'library',
        'derivedFrom',
    ];
    const explicitOptionalFields = new Set(clearableOptionalFields.filter(key => Object.prototype.hasOwnProperty.call(packRecord || {}, key)));
    const normalized = normalizeLoredeckRegistry(
        { schemaVersion: 1, packs: { [packRecord.packId || packRecord.id || '']: packRecord } },
        { schemaVersion: 1, packs: {} }
    );
    const [packId, pack] = Object.entries(normalized.packs || {})[0] || [];
    if (!packId || !pack) {
        return { ok: false, error: 'Loredeck record must include a packId/id.' };
    }
    const bundledDefault = DEFAULT_SETTINGS.loredeckLibrary?.packs?.[packId];
    if (bundledDefault?.type === 'bundled' && pack.type !== 'bundled') {
        return { ok: false, error: 'A Custom or Generated Loredeck cannot replace a Bundled Loredeck with the same id.' };
    }

    const settings = getSettings();
    const library = getLoredeckLibraryRegistry(getState());
    const existing = library.packs[packId] || {};
    if (existing.payloadFile && !isExternalLorepackPayloadHydratedRecord(pack)) {
        return {
            ok: false,
            error: 'Loredeck payload must be loaded before saving changes to this external Loredeck.',
            code: 'payload_not_loaded',
        };
    }
    const nextPack = {
        ...existing,
        ...pack,
        installedAt: existing.installedAt || pack.installedAt || Date.now(),
        updatedAt: Date.now(),
    };
    const payloadRevision = Math.floor(Number(packRecord?.revision) || 0);
    if (payloadRevision > 0) nextPack.revision = payloadRevision;
    for (const key of explicitOptionalFields) {
        if (Object.prototype.hasOwnProperty.call(pack, key)) continue;
        if (key === 'pendingChanges') {
            nextPack.pendingChanges = [];
            continue;
        }
        delete nextPack[key];
    }
    const payloadResult = upsertExternalLorepackPayloadSync(nextPack, { persistOwningIndex: true });
    if (!payloadResult.ok) return payloadResult;
    const result = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, { persist: false });
    if (!result.ok) return result;
    const completion = completeLibraryWrites([payloadResult], async () => {
        const latestSettings = cloneSettings(getSettings());
        if (cleanupSettingsLoredeckLibraryPack(latestSettings, packId)) {
            assertSagaStorageWriteAcknowledged(await saveSettings(latestSettings));
        }
    });
    return {
        ok: true,
        pack: hydrateCachedExternalLorepackPayloadRecord(result.pack),
        queued: payloadResult.queued,
        persisted: false,
        completion,
        library: getLoredeckLibraryRegistry(getState()),
    };
}

export function removeLoredeckLibraryPack(packId, options = {}) {
    const id = String(packId || '').trim();
    if (!id) return { ok: false, error: 'Missing Loredeck id.' };
    if (options.allowBundled !== true && DEFAULT_SETTINGS.loredeckLibrary?.packs?.[id]?.type === 'bundled') {
        return { ok: false, error: 'Bundled Loredecks cannot be removed from the library.' };
    }

    const state = getState();
    const settings = getSettings();
    const library = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const mergedLibrary = getLoredeckLibraryRegistry(state);
    const chatRegistry = normalizeLoredeckRegistry(state?.loredeckRegistry, { schemaVersion: 1, packs: {} });
    let settingsChanged = false;
    let stateChanged = false;
    let removed = false;
    const payloadRemoval = removeExternalLorepackPayloadSync(id, { payloadFile: mergedLibrary.packs[id]?.payloadFile });
    const externalRemoval = removeExternalLoredeckLibraryRecordSync(id, { persist: false });
    if (externalRemoval.ok || payloadRemoval.ok) removed = true;
    if (library.packs[id]) {
        delete library.packs[id];
        settingsChanged = true;
        removed = true;
    }

    if (chatRegistry.packs[id]) {
        delete chatRegistry.packs[id];
        stateChanged = true;
        removed = true;
    }

    const projectRegistryResult = options.clearCreatorProjects === false
        ? { registry: getLoredeckCreatorSettingsRegistry(settings), removedJobIds: [] }
        : removeLoredeckCreatorJobsForGeneratedPackId(settings.loredeckCreatorProjects, id);
    const localRegistryResult = options.clearCreatorProjects === false
        ? { registry: normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator), removedJobIds: [] }
        : removeLoredeckCreatorJobsForGeneratedPackId(state.loredeckCreator || getDefaultState().loredeckCreator, id);
    const externalProjectRegistryResult = options.clearCreatorProjects === false
        ? { registry: getLoredeckCreatorProjectRegistry(), removedJobIds: [] }
        : removeLoredeckCreatorJobsForGeneratedPackId(getLoredeckCreatorProjectRegistry(), id);
    const clearedCreatorJobIds = [
        ...new Set([
            ...(projectRegistryResult.removedJobIds || []),
            ...(localRegistryResult.removedJobIds || []),
            ...(externalProjectRegistryResult.removedJobIds || []),
        ]),
    ];
    const externalWrites = [payloadRemoval, ...(externalProjectRegistryResult.removedJobIds || []).map(jobId => removeExternalLoredeckCreatorProjectSync(jobId))];
    if (projectRegistryResult.removedJobIds.length) {
        settingsChanged = true;
    }
    if (localRegistryResult.removedJobIds.length) {
        stateChanged = true;
    }

    if (!removed && !clearedCreatorJobIds.length) {
        return { ok: false, error: 'Loredeck is not registered.' };
    }
    const completion = completeLibraryWrites(externalWrites, async () => {
        if (settingsChanged) {
            const latest = cloneSettings(getSettings());
            cleanupSettingsLoredeckLibraryPack(latest, id, { removeLayout: true });
            latest.loredeckCreatorProjects = removeLoredeckCreatorJobsForGeneratedPackId(latest.loredeckCreatorProjects, id).registry;
            assertSagaStorageWriteAcknowledged(await saveSettings(latest));
        }
        if (stateChanged) {
            if (getState() !== state) throw new Error('Loredeck removal owner changed before local persistence.');
            const currentChat = normalizeLoredeckRegistry(state.loredeckRegistry, { schemaVersion: 1, packs: {} });
            delete currentChat.packs[id];
            state.loredeckRegistry = currentChat;
            if (options.clearCreatorProjects !== false) state.loredeckCreator = removeLoredeckCreatorJobsForGeneratedPackId(state.loredeckCreator, id).registry;
            assertSagaStorageWriteAcknowledged(await saveState(state, { syncPrompt: false, sanitize: true }));
        }
    });
    return { ok: true, queued: true, persisted: false, completion, library: getLoredeckLibraryRegistry(state), clearedCreatorJobIds };
}

export function importLoredeckLibraryRegistry(registry = {}, options = {}) {
    const incoming = normalizeLoredeckRegistry(registry, { schemaVersion: 1, packs: {} });
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
        importedCount += 1;
        importedPackIds.push(packId);
    }
    const payloadPacks = {};
    const writes = [];
    for (const packId of importedPackIds) {
        const payloadResult = upsertExternalLorepackPayloadSync(incoming.packs[packId], { ...options, persistOwningIndex: true });
        if (!payloadResult.ok) return payloadResult;
        payloadPacks[packId] = payloadResult.libraryRecord;
        writes.push(payloadResult);
    }
    const result = importExternalLoredeckLibraryRegistrySync({
        ...registry,
        packs: payloadPacks,
    }, { ...options, persist: false });
    if (!result.ok) return result;
    const completion = completeLibraryWrites(writes, async () => {
        const layoutResult = updateExternalLoredeckLibraryLayoutSync(incoming, options);
        const persistedLayout = await (layoutResult.completion || layoutResult);
        assertSagaStorageWriteAcknowledged(persistedLayout);
        if (persistedLayout.persisted !== true) throw new Error('Library layout was not durably acknowledged.');
        const latest = cloneSettings(getSettings());
        if (cleanupSettingsLoredeckLibraryPacks(latest, importedPackIds)) assertSagaStorageWriteAcknowledged(await saveSettings(latest));
    });
    return {
        ...result,
        queued: true,
        persisted: false,
        completion,
        importedCount,
        skippedCount,
        importedPackIds,
        skippedPackIds,
        library: getLoredeckLibraryRegistry(getState()),
    };
}

export function persistLoredeckLibraryLayout(registry = {}, options = {}) {
    const layout = {};
    if (Array.isArray(registry.folders)) layout.folders = registry.folders;
    if (Array.isArray(registry.deckPlacements)) layout.deckPlacements = registry.deckPlacements;
    if (Array.isArray(registry.activeStack)) layout.activeStack = registry.activeStack;
    return updateExternalLoredeckLibraryLayoutSync(layout, options);
}

export function promoteChatLoredeckRegistryToSettings(state = {}) {
    const chatRegistry = normalizeLoredeckRegistry(
        state?.loredeckRegistry,
        { schemaVersion: 1, packs: {} }
    );
    const chatPacks = chatRegistry.packs || {};
    if (!Object.keys(chatPacks).length) return;

    const settings = getSettings();
    const globalLibrary = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const writes = [];
    for (const [packId, pack] of Object.entries(chatPacks)) {
        const mergedLibrary = mergeExternalLoredeckLibraryRegistry(globalLibrary, { schemaVersion: 1, packs: {} });
        if (!mergedLibrary.packs[packId]) {
            const payloadResult = upsertExternalLorepackPayloadSync(pack, { persistOwningIndex: true });
            if (!payloadResult.ok) return payloadResult;
            upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, { persist: false });
            writes.push(payloadResult);
        }
    }
    if (!writes.length) return { ok: true, persisted: true, queued: false };
    return { ok: true, persisted: false, queued: true, completion: completeLibraryWrites(writes) };
}
