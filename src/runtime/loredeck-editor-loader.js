/**
 * loredeck-editor-loader.js - Saga
 * Loader/cache lifecycle for runtime Loredeck editor previews.
 */

import {
    normalizeLoredeckTagRegistry,
    normalizeLoredeckTimelineRegistry,
} from '../state/lore-state-normalizers.js';
import {
    toast,
} from '../ui/runtime-ui-kit.js';
import { setLoredeckActionButtonBusy } from '../loredecks/loredeck-action-rows.js';
import {
    entryListFromLoredeckFileJson,
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
} from './loredeck-package-helpers.js';
import {
    getDisplayManifestForPack,
    resolveManifestUrlForFetch,
} from './loredeck-manifest-runtime.js';
import {
    buildGeneratedLoredeckEntryCache,
    canUseVirtualLoredeckData,
    refreshGeneratedLoredeckDerivedMetadata,
} from './loredeck-virtual-data.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureLoredeckEditorLoader(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export async function fetchJsonForLoredeckEditor(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
        return await response.json();
    } catch (e) {
        throw new Error(e?.message || 'Invalid JSON');
    }
}

export async function fetchLoredeckEntryFilesForEditor(pack, manifest = null, baseUrl = null) {
    const displayManifest = manifest || await getDisplayManifestForPack(pack, { requireFetch: !canUseVirtualLoredeckData(pack) });
    if (canUseVirtualLoredeckData(pack) && !baseUrl) {
        return buildGeneratedLoredeckEntryCache(refreshGeneratedLoredeckDerivedMetadata({ ...(pack || {}) }), displayManifest);
    }
    const resolvedBaseUrl = baseUrl || resolveManifestUrlForFetch(pack.manifest);
    if (!resolvedBaseUrl) throw new Error('Loredeck needs a fetchable base manifest path to load entries.');
    const entries = [];
    const entryFiles = [];
    for (const file of Array.isArray(displayManifest.files) ? displayManifest.files : []) {
        const filePath = String(file || '').trim();
        if (!filePath) continue;
        try {
            const json = await fetchJsonForLoredeckEditor(new URL(filePath, resolvedBaseUrl));
            const fileEntries = entryListFromLoredeckFileJson(json)
                .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
                .map(entry => ({
                    ...entry,
                    schemaVersion: entry.schemaVersion || json?.schemaVersion || displayManifest.entrySchemaVersion || 2,
                    extensions: {
                        ...(entry.extensions || {}),
                        sagaLoredeckSourceFile: filePath,
                    },
                }));
            entries.push(...fileEntries);
            entryFiles.push({
                file: filePath,
                url: new URL(filePath, resolvedBaseUrl),
                ok: true,
                json,
                entries: fileEntries,
                schemaVersion: json?.schemaVersion || displayManifest.entrySchemaVersion || 2,
            });
        } catch (e) {
            console.warn('[Saga] Loredeck entry file failed in editor:', filePath, e);
            entryFiles.push({
                file: filePath,
                url: null,
                ok: false,
                json: null,
                entries: [],
                schemaVersion: 0,
                error: e?.message || 'Entry file failed to load.',
            });
        }
    }
    return { manifest: displayManifest, baseUrl: resolvedBaseUrl, entries, entryFiles };
}

export async function fetchLoredeckTimelineForEditor(manifest = {}, baseUrl = null) {
    if (!baseUrl) return null;
    const registries = manifest?.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    const ref = String(registries.timeline || manifest.timeline || '').trim();
    if (!ref) return null;
    return fetchJsonForLoredeckEditor(new URL(ref, baseUrl));
}

export async function loadLoredeckTimelineRegistryForEditor(pack, button = null, options = {}) {
    const getFreshLoredeckLibraryPack = dep('getFreshLoredeckLibraryPack', (_packId, fallback) => fallback);
    const setLoredeckTimelineRegistryCacheRecord = dep('setLoredeckTimelineRegistryCacheRecord');
    const refreshPanelBody = dep('refreshPanelBody');
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Loading...', { fallbackLabel: 'Load Timeline' });
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        const manifest = options.manifest || await getDisplayManifestForPack(fresh, { requireFetch: !canUseVirtualLoredeckData(fresh) });
        const baseUrl = options.baseUrl || resolveManifestUrlForFetch(fresh.manifest);
        if (!baseUrl && canUseVirtualLoredeckData(fresh)) {
            const sourceRegistry = normalizeLoredeckTimelineRegistry(fresh.timelineRegistry);
            setLoredeckTimelineRegistryCacheRecord(fresh.packId, {
                sourceRegistry,
                error: '',
                missing: !getLoredeckTimelineRegistryCount(sourceRegistry),
                loadedAt: Date.now(),
            });
            if (options.quiet !== true) {
                const count = getLoredeckTimelineRegistryCount(sourceRegistry);
                toast(count ? `Loaded ${count} local timeline definition${count === 1 ? '' : 's'}.` : 'This Loredeck does not have local timeline definitions yet.', count ? 'success' : 'info');
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            }
            return sourceRegistry;
        }
        if (!baseUrl) throw new Error('Loredeck needs a fetchable base manifest path to load timeline.json.');
        const registryJson = await fetchLoredeckTimelineForEditor(manifest, baseUrl);
        const sourceRegistry = normalizeLoredeckTimelineRegistry(registryJson);
        setLoredeckTimelineRegistryCacheRecord(fresh.packId, {
            sourceRegistry,
            error: '',
            missing: !registryJson,
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            const count = getLoredeckTimelineRegistryCount(sourceRegistry);
            toast(registryJson ? `Loaded ${count} timeline definition${count === 1 ? '' : 's'} from timeline.json.` : 'This Loredeck does not declare timeline.json yet.', registryJson ? 'success' : 'info');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return sourceRegistry;
    } catch (e) {
        setLoredeckTimelineRegistryCacheRecord(String(pack.packId || '').trim(), {
            sourceRegistry: normalizeLoredeckTimelineRegistry(null),
            error: e?.message || 'timeline.json failed to load.',
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            toast(e?.message || 'timeline.json failed to load.', 'error');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return normalizeLoredeckTimelineRegistry(null);
    } finally {
        restoreBusy();
    }
}

export async function fetchLoredeckTagRegistryForEditor(manifest = {}, baseUrl = null) {
    if (!baseUrl) return null;
    const registries = manifest?.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    const ref = String(
        typeof registries.tags === 'string'
            ? registries.tags
            : (typeof manifest.tagRegistry === 'string' ? manifest.tagRegistry : '')
    ).trim();
    if (!ref) return null;
    return fetchJsonForLoredeckEditor(new URL(ref, baseUrl));
}

export async function loadLoredeckTagRegistryForEditor(pack, button = null, options = {}) {
    const getFreshLoredeckLibraryPack = dep('getFreshLoredeckLibraryPack', (_packId, fallback) => fallback);
    const setLoredeckTagRegistryCacheRecord = dep('setLoredeckTagRegistryCacheRecord');
    const refreshPanelBody = dep('refreshPanelBody');
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Loading...', { fallbackLabel: 'Load Registry' });
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        const manifest = options.manifest || await getDisplayManifestForPack(fresh, { requireFetch: !canUseVirtualLoredeckData(fresh) });
        const baseUrl = options.baseUrl || resolveManifestUrlForFetch(fresh.manifest);
        if (!baseUrl && canUseVirtualLoredeckData(fresh)) {
            const sourceRegistry = normalizeLoredeckTagRegistry(fresh.tagRegistry);
            setLoredeckTagRegistryCacheRecord(fresh.packId, {
                sourceRegistry,
                error: '',
                missing: !getLoredeckTagRegistryCount(sourceRegistry),
                loadedAt: Date.now(),
            });
            if (options.quiet !== true) {
                const count = getLoredeckTagRegistryCount(sourceRegistry);
                toast(count ? `Loaded ${count} local tag definition${count === 1 ? '' : 's'}.` : 'This Loredeck does not have local tag definitions yet.', count ? 'success' : 'info');
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            }
            return sourceRegistry;
        }
        if (!baseUrl) throw new Error('Loredeck needs a fetchable base manifest path to load tags.json.');
        const registryJson = await fetchLoredeckTagRegistryForEditor(manifest, baseUrl);
        const sourceRegistry = normalizeLoredeckTagRegistry(registryJson);
        setLoredeckTagRegistryCacheRecord(fresh.packId, {
            sourceRegistry,
            error: '',
            missing: !registryJson,
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            const count = getLoredeckTagRegistryCount(sourceRegistry);
            toast(registryJson ? `Loaded ${count} tag definition${count === 1 ? '' : 's'} from tags.json.` : 'This Loredeck does not declare tags.json yet.', registryJson ? 'success' : 'info');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return sourceRegistry;
    } catch (e) {
        setLoredeckTagRegistryCacheRecord(String(pack.packId || '').trim(), {
            sourceRegistry: { schemaVersion: 1, tags: {} },
            error: e?.message || 'tags.json failed to load.',
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            toast(e?.message || 'tags.json failed to load.', 'error');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return { schemaVersion: 1, tags: {} };
    } finally {
        restoreBusy();
    }
}

export async function loadLoredeckEntriesForEditor(pack, button = null) {
    const setLoredeckEntryPreviewCacheRecord = dep('setLoredeckEntryPreviewCacheRecord');
    const refreshPanelBody = dep('refreshPanelBody');
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Loading...', { fallbackLabel: 'Load Entries' });
    try {
        const { manifest, baseUrl, entries, entryFiles } = await fetchLoredeckEntryFilesForEditor(pack);
        await loadLoredeckTimelineRegistryForEditor(pack, null, { manifest, baseUrl, quiet: true });
        await loadLoredeckTagRegistryForEditor(pack, null, { manifest, baseUrl, quiet: true });
        setLoredeckEntryPreviewCacheRecord(pack.packId, {
            entries,
            entryFiles,
            error: '',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`${entries.length} entries loaded for ${pack.title || pack.packId}.`, entries.length ? 'success' : 'warning');
        return entries;
    } catch (e) {
        setLoredeckEntryPreviewCacheRecord(pack.packId, {
            entries: [],
            error: e?.message || 'Entry load failed.',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(e?.message || 'Entry load failed.', 'error');
        return [];
    } finally {
        restoreBusy();
    }
}

export async function loadLoredeckManifestPreview(pack, button = null) {
    const setLoredeckManifestPreviewCacheRecord = dep('setLoredeckManifestPreviewCacheRecord');
    const refreshPanelBody = dep('refreshPanelBody');
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Inspecting...', { fallbackLabel: 'Inspect Manifest' });
    try {
        const manifest = await getDisplayManifestForPack(pack, { requireFetch: !canUseVirtualLoredeckData(pack) });
        setLoredeckManifestPreviewCacheRecord(pack.packId, {
            manifest,
            error: '',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`${pack.title || pack.packId} manifest inspected.`, 'success');
        return manifest;
    } catch (e) {
        setLoredeckManifestPreviewCacheRecord(pack.packId, {
            manifest: null,
            error: e?.message || 'Manifest inspection failed.',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(e?.message || 'Manifest inspection failed.', 'error');
        return null;
    } finally {
        restoreBusy();
    }
}
