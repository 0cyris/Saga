/**
 * Loredeck Library registry settings store.
 */

import { DEFAULT_SETTINGS, getDefaultState as createDefaultState } from './constants.js';
import { getSettings as readSettings, saveSettings as writeSettings } from './settings-store.js';
import { normalizeLoredeckCreatorRegistry, removeLoredeckCreatorJobsForGeneratedPackId } from './lore-creator-state.js';
import { getLoredeckCreatorSettingsRegistry } from './lore-creator-store.js';
import { normalizeLoredeckRegistry } from './lore-state-normalizers.js';

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

export function getLoredeckLibraryRegistry(state = null) {
    const settings = getSettings();
    const globalLibrary = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const chatRegistry = normalizeLoredeckRegistry(
        state?.loredeckRegistry,
        { schemaVersion: 1, packs: {} }
    );
    return normalizeLoredeckRegistry({
        schemaVersion: 1,
        packs: {
            ...(chatRegistry.packs || {}),
            ...(globalLibrary.packs || {}),
        },
        folders: globalLibrary.folders || [],
        deckPlacements: globalLibrary.deckPlacements || [],
        activeStack: globalLibrary.activeStack || [],
    }, DEFAULT_SETTINGS.loredeckLibrary);
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
    const library = normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);
    const existing = library.packs[packId] || {};
    const nextPack = {
        ...existing,
        ...pack,
        installedAt: existing.installedAt || pack.installedAt || Date.now(),
        updatedAt: Date.now(),
    };
    for (const key of explicitOptionalFields) {
        if (!Object.prototype.hasOwnProperty.call(pack, key)) delete nextPack[key];
    }
    library.packs[packId] = nextPack;
    settings.loredeckLibrary = normalizeLoredeckRegistry(library, DEFAULT_SETTINGS.loredeckLibrary);
    saveSettings(settings);
    return { ok: true, pack: settings.loredeckLibrary.packs[packId], library: settings.loredeckLibrary };
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
    const chatRegistry = normalizeLoredeckRegistry(state?.loredeckRegistry, { schemaVersion: 1, packs: {} });
    let settingsChanged = false;
    let stateChanged = false;
    let removed = false;
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
    const clearedCreatorJobIds = [
        ...new Set([
            ...(projectRegistryResult.removedJobIds || []),
            ...(localRegistryResult.removedJobIds || []),
        ]),
    ];
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
    return { ok: true, library: settings.loredeckLibrary, clearedCreatorJobIds };
}

export function importLoredeckLibraryRegistry(registry = {}, options = {}) {
    const incoming = normalizeLoredeckRegistry(registry, { schemaVersion: 1, packs: {} });
    const settings = getSettings();
    const current = options.replace === true
        ? normalizeLoredeckRegistry(DEFAULT_SETTINGS.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary)
        : normalizeLoredeckRegistry(settings.loredeckLibrary, DEFAULT_SETTINGS.loredeckLibrary);

    let importedCount = 0;
    let skippedCount = 0;
    for (const [packId, pack] of Object.entries(incoming.packs || {})) {
        const bundledDefault = DEFAULT_SETTINGS.loredeckLibrary?.packs?.[packId];
        if (bundledDefault?.type === 'bundled' && pack.type !== 'bundled') {
            skippedCount += 1;
            continue;
        }
        current.packs[packId] = {
            ...(current.packs[packId] || {}),
            ...pack,
            installedAt: current.packs[packId]?.installedAt || pack.installedAt || Date.now(),
            updatedAt: Date.now(),
        };
        importedCount += 1;
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

    settings.loredeckLibrary = normalizeLoredeckRegistry(current, DEFAULT_SETTINGS.loredeckLibrary);
    saveSettings(settings);
    return { ok: true, importedCount, skippedCount, library: settings.loredeckLibrary };
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
        if (!globalLibrary.packs[packId]) {
            globalLibrary.packs[packId] = pack;
            changed = true;
        }
    }
    if (!changed) return;
    settings.loredeckLibrary = globalLibrary;
    saveSettings(settings);
}
