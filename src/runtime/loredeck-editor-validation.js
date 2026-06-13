/**
 * loredeck-editor-validation.js - Saga
 * Pack Health validation lifecycle for runtime Loredeck editing.
 */

import {
    buildLoredeckHealthForData,
} from '../loredecks/loredeck-loader.js';
import {
    upsertLoredeckLibraryPack,
} from '../state/state-manager.js';
import {
    normalizeLoredeckTagRegistry,
    normalizeLoredeckTimelineRegistry,
} from '../state/lore-state-normalizers.js';
import {
    toast,
} from '../ui/runtime-ui-kit.js';
import { setLoredeckActionButtonBusy } from '../loredecks/loredeck-action-rows.js';
import {
    fetchLoredeckEntryFilesForEditor,
    fetchLoredeckTimelineForEditor,
    loadLoredeckTagRegistryForEditor,
} from './loredeck-editor-loader.js';
import {
    buildEmbeddedCustomManifest,
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
    cloneLoredeckJson,
} from './loredeck-package-helpers.js';
import {
    getDisplayManifestForPack,
    resolveManifestUrlForFetch,
} from './loredeck-manifest-runtime.js';
import {
    buildGeneratedLoredeckEntryCache,
    buildLoredeckStatsFromHealth,
    canUseVirtualLoredeckData,
    canValidateLoredeckInEditor,
    isGeneratedLoredeckPack,
    isVirtualLoredeckPack,
    refreshGeneratedLoredeckDerivedMetadata,
} from './loredeck-virtual-data.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureLoredeckEditorValidation(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function getCachedLoredeckManifest(packId) {
    const getLoredeckManifestPreviewCacheRecord = dep('getLoredeckManifestPreviewCacheRecord', () => null);
    const cached = getLoredeckManifestPreviewCacheRecord(String(packId || '').trim());
    return cached?.manifest && typeof cached.manifest === 'object' && !Array.isArray(cached.manifest)
        ? cached.manifest
        : null;
}

export function getExpectedLoredeckEntrySchemaVersion(pack = {}, manifest = null) {
    const cachedManifest = manifest || getCachedLoredeckManifest(pack.packId);
    const candidates = [
        cachedManifest?.entrySchemaVersion,
        pack.entrySchemaVersion,
        pack.manifestData?.entrySchemaVersion,
    ];
    for (const raw of candidates) {
        const version = Number(raw);
        if (Number.isFinite(version) && version > 0) return version;
    }
    return 2;
}

export function cacheLoredeckValidation(packId, manifest, entryCache, health) {
    const getLoredeckManifestPreviewCacheRecord = dep('getLoredeckManifestPreviewCacheRecord', () => null);
    const getLoredeckEntryPreviewCacheRecord = dep('getLoredeckEntryPreviewCacheRecord', () => null);
    const setLoredeckManifestPreviewCacheRecord = dep('setLoredeckManifestPreviewCacheRecord');
    const setLoredeckEntryPreviewCacheRecord = dep('setLoredeckEntryPreviewCacheRecord');
    const cachedManifest = getLoredeckManifestPreviewCacheRecord(packId) || {};
    setLoredeckManifestPreviewCacheRecord(packId, {
        ...cachedManifest,
        manifest,
        health,
        error: '',
        loadedAt: Date.now(),
    });
    const cachedEntries = getLoredeckEntryPreviewCacheRecord(packId) || {};
    setLoredeckEntryPreviewCacheRecord(packId, {
        ...cachedEntries,
        ...(entryCache || {}),
        health,
        error: '',
        loadedAt: Date.now(),
    });
}

export async function validateLoredeckForEditor(pack, button = null, options = {}) {
    const getFreshLoredeckLibraryPack = dep('getFreshLoredeckLibraryPack', (_packId, fallback) => fallback);
    const setLoredeckTimelineRegistryCacheRecord = dep('setLoredeckTimelineRegistryCacheRecord');
    const setLoredeckTagRegistryCacheRecord = dep('setLoredeckTagRegistryCacheRecord');
    const refreshLoredeckSurfaces = dep('refreshLoredeckSurfaces');
    const restoreBusy = setLoredeckActionButtonBusy(button, 'Validating...', { fallbackLabel: 'Run Pack Health' });
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!canValidateLoredeckInEditor(fresh)) throw new Error('Loredeck needs a fetchable manifest path or accepted generated data to validate.');
        const virtualData = canUseVirtualLoredeckData(fresh);
        const workingPack = isGeneratedLoredeckPack(fresh)
            ? refreshGeneratedLoredeckDerivedMetadata(cloneLoredeckJson(fresh) || { ...fresh })
            : fresh;
        const manifest = await getDisplayManifestForPack(workingPack, { requireFetch: !virtualData });
        const baseUrl = virtualData ? null : resolveManifestUrlForFetch(workingPack.manifest);
        if (!virtualData && !baseUrl) throw new Error('Loredeck manifest path or URL is invalid.');
        const entryCache = virtualData
            ? buildGeneratedLoredeckEntryCache(workingPack, manifest)
            : await fetchLoredeckEntryFilesForEditor(workingPack, manifest, baseUrl);
        let timeline = null;
        let tagRegistry = null;
        if (virtualData) {
            timeline = getLoredeckTimelineRegistryCount(workingPack.timelineRegistry)
                ? normalizeLoredeckTimelineRegistry(workingPack.timelineRegistry)
                : null;
            setLoredeckTimelineRegistryCacheRecord(workingPack.packId, {
                sourceRegistry: normalizeLoredeckTimelineRegistry(timeline),
                error: '',
                missing: !timeline,
                loadedAt: Date.now(),
            });
            tagRegistry = getLoredeckTagRegistryCount(workingPack.tagRegistry)
                ? normalizeLoredeckTagRegistry(workingPack.tagRegistry)
                : { schemaVersion: 1, tags: {} };
            setLoredeckTagRegistryCacheRecord(workingPack.packId, {
                sourceRegistry: tagRegistry,
                error: '',
                missing: !getLoredeckTagRegistryCount(tagRegistry),
                loadedAt: Date.now(),
            });
        } else {
            try {
                timeline = await fetchLoredeckTimelineForEditor(manifest, baseUrl);
                setLoredeckTimelineRegistryCacheRecord(workingPack.packId, {
                    sourceRegistry: normalizeLoredeckTimelineRegistry(timeline),
                    error: '',
                    missing: !timeline,
                    loadedAt: Date.now(),
                });
            } catch (e) {
                console.warn('[Saga] Loredeck timeline failed during editor validation:', e);
                setLoredeckTimelineRegistryCacheRecord(workingPack.packId, {
                    sourceRegistry: normalizeLoredeckTimelineRegistry(null),
                    error: e?.message || 'timeline.json failed to load.',
                    loadedAt: Date.now(),
                });
            }
            tagRegistry = await loadLoredeckTagRegistryForEditor(workingPack, null, { manifest, baseUrl, quiet: true });
        }
        const health = buildLoredeckHealthForData({
            packId: workingPack.packId,
            manifest,
            entryFiles: entryCache.entryFiles,
            timeline,
            tagRegistry,
            registryRecord: virtualData ? null : workingPack,
        });
        cacheLoredeckValidation(workingPack.packId, manifest, entryCache, health);

        if (workingPack.type !== 'bundled' && options.updateLibrary !== false) {
            const record = {
                ...workingPack,
                entrySchemaVersion: getExpectedLoredeckEntrySchemaVersion(workingPack, manifest),
                stats: buildLoredeckStatsFromHealth(health),
                healthStatus: health.status,
                updatedAt: Date.now(),
            };
            if (isGeneratedLoredeckPack(record)) refreshGeneratedLoredeckDerivedMetadata(record);
            else if (isVirtualLoredeckPack(record)) record.manifestData = buildEmbeddedCustomManifest(record.manifestData || manifest, record);
            const result = upsertLoredeckLibraryPack(record);
            if (!result.ok) throw new Error(result.error || 'Pack Health status save failed.');
        }

        if (options.quiet !== true) {
            const summary = health.summary || {};
            toast(`Pack Health: ${health.status} (${summary.errorCount || 0} errors, ${summary.warningCount || 0} warnings).`, health.errors?.length ? 'error' : (health.warnings?.length ? 'warning' : 'success'));
            refreshLoredeckSurfaces();
        }
        return { health, manifest, entryCache };
    } catch (e) {
        if (options.quiet !== true) toast(e?.message || 'Loredeck validation failed.', 'error');
        return { health: null, manifest: null, entryCache: null, error: e?.message || 'Loredeck validation failed.' };
    } finally {
        restoreBusy();
    }
}
