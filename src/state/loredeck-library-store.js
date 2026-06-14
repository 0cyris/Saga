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

function saveSettingsCleanup(settings = {}) {
    try {
        saveSettings(settings);
        return { ok: true };
    } catch (error) {
        console.warn('[Saga] Loredeck Library settings cleanup failed:', error);
        return { ok: false, error: getLoredeckLibraryPersistenceErrorMessage(error, 'Loredeck Library settings cleanup failed.') };
    }
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
    const payloadResult = upsertExternalLorepackPayloadSync(nextPack);
    if (!payloadResult.ok) return payloadResult;
    const result = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord);
    if (!result.ok) return result;
    if (cleanupSettingsLoredeckLibraryPack(settings, packId)) saveSettingsCleanup(settings);
    return {
        ok: true,
        pack: hydrateCachedExternalLorepackPayloadRecord(result.pack),
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
    const externalRemoval = removeExternalLoredeckLibraryRecordSync(id);
    if (externalRemoval.ok || payloadRemoval.ok) removed = true;
    if (library.packs[id]) {
        delete library.packs[id];
        settingsChanged = true;
        removed = true;
    }

    if (chatRegistry.packs[id]) {
        delete chatRegistry.packs[id];
        state.loredeckRegistry = normalizeLoredeckRegistry(chatRegistry, { schemaVersion: 1, packs: {} });
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
    for (const jobId of externalProjectRegistryResult.removedJobIds || []) {
        removeExternalLoredeckCreatorProjectSync(jobId);
    }
    if (projectRegistryResult.removedJobIds.length) {
        settings.loredeckCreatorProjects = projectRegistryResult.registry;
        settingsChanged = true;
    }
    if (localRegistryResult.removedJobIds.length) {
        state.loredeckCreator = localRegistryResult.registry;
        stateChanged = true;
    }

    if (!removed && !clearedCreatorJobIds.length) {
        return { ok: false, error: 'Loredeck is not registered.' };
    }
    if (settingsChanged) {
        settings.loredeckLibrary = normalizeLoredeckRegistry(library, DEFAULT_SETTINGS.loredeckLibrary);
        saveSettings(settings);
    }
    if (stateChanged) {
        saveState(state, { syncPrompt: false, sanitize: true });
    }
    return { ok: true, library: getLoredeckLibraryRegistry(state), clearedCreatorJobIds };
}

export function importLoredeckLibraryRegistry(registry = {}, options = {}) {
    const incoming = normalizeLoredeckRegistry(registry, { schemaVersion: 1, packs: {} });
    const settings = getSettings();
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
    for (const packId of importedPackIds) {
        const payloadResult = upsertExternalLorepackPayloadSync(incoming.packs[packId], options);
        if (!payloadResult.ok) return payloadResult;
        payloadPacks[packId] = payloadResult.libraryRecord;
    }
    const result = importExternalLoredeckLibraryRegistrySync({
        ...registry,
        packs: payloadPacks,
    }, options);
    if (!result.ok) return result;
    if (cleanupSettingsLoredeckLibraryPacks(settings, importedPackIds)) saveSettingsCleanup(settings);
    return {
        ...result,
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
    let changed = false;
    for (const [packId, pack] of Object.entries(chatPacks)) {
        const mergedLibrary = mergeExternalLoredeckLibraryRegistry(globalLibrary, { schemaVersion: 1, packs: {} });
        if (!mergedLibrary.packs[packId]) {
            const payloadResult = upsertExternalLorepackPayloadSync(pack);
            if (payloadResult.ok) upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord);
            changed = true;
        }
    }
    if (!changed) return;
}
