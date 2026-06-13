/**
 * loredeck-package-export.js - Saga
 * Runtime Loredeck package export assembly.
 */

import { createLoredeckZipPackage } from '../loredecks/loredeck-package-service.js';
import { loadLoredeckSourceById } from '../loredecks/loredeck-loader.js';
import { normalizePackLibraryMetadata } from '../loredecks/loredeck-library-index.js';
import {
    getLoredeckLibraryRegistry,
    getState,
} from '../state/state-manager.js';
import {
    normalizeLoredeckTagRegistry,
    normalizeLoredeckTimelineRegistry,
} from '../state/lore-state-normalizers.js';
import { toast } from '../ui/runtime-ui-kit.js';
import { withLoredeckActionButtonBusy } from '../loredecks/loredeck-action-rows.js';
import { downloadBytes } from './runtime-downloads.js';
import { sanitizeFileStem } from './runtime-formatters.js';
import {
    addLoredeckPackageFile,
    buildLoredeckPackageFolderSubset,
    buildLoredeckPackageIndexRecord,
    cloneLoredeckJson,
    entryListFromLoredeckFileJson,
    getLoredeckPackageEntryPath,
    getLoredeckPackageRefPaths,
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
    loredeckPackageStringify,
    stageLoredeckPackageAssets,
    stageLoredeckPackageReferencedFile,
} from './loredeck-package-helpers.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureLoredeckPackageExport(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

async function buildLoredeckZipPackageFilesForPack(pack = {}, registry = getLoredeckLibraryRegistry(getState())) {
    const getFreshLoredeckLibraryPack = dep('getFreshLoredeckLibraryPack', (_packId, fallback) => fallback);
    const resolveManifestUrlForFetch = dep('resolveManifestUrlForFetch', () => null);
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack) || pack;
    if (!fresh?.packId) throw new Error('Loredeck is missing packId.');

    const source = await loadLoredeckSourceById(fresh.packId, {
        registry,
        registryRecord: fresh,
    });
    if (!source?.manifest) throw new Error(`${fresh.title || fresh.packId} has no loadable manifest.`);
    const exportPack = {
        ...fresh,
        ...(source.registryRecord || {}),
    };
    const deckFolderName = sanitizeFileStem(exportPack.packId || source.manifest.id || 'loredeck');
    const deckFolder = `loredecks/${deckFolderName}`;
    const files = [];
    const sourceInfo = source.manifest.source && typeof source.manifest.source === 'object' && !Array.isArray(source.manifest.source)
        ? source.manifest.source
        : {};
    const originalType = String(sourceInfo.originalType || fresh.type || source.manifest.type || exportPack.type || '').trim();
    const manifest = {
        ...(cloneLoredeckJson(source.manifest) || {}),
        id: exportPack.packId,
        type: 'custom',
        title: exportPack.title || source.manifest.title || exportPack.packId,
        description: exportPack.description || source.manifest.description || '',
        fandom: exportPack.fandom || source.manifest.fandom || '',
        era: exportPack.era || source.manifest.era || '',
        author: exportPack.author || source.manifest.author || '',
        version: exportPack.version || source.manifest.version || '1.0.0',
        entrySchemaVersion: Math.max(3, Number(exportPack.entrySchemaVersion || source.manifest.entrySchemaVersion) || 0),
        tags: Array.isArray(exportPack.tags) ? exportPack.tags : (Array.isArray(source.manifest.tags) ? source.manifest.tags : []),
        library: normalizePackLibraryMetadata(exportPack.library || source.manifest.library || {}),
        stats: exportPack.stats || source.manifest.stats || { entryCount: 0, categoryCounts: {} },
        source: {
            ...(source.manifest.source || {}),
            kind: 'package_export',
            originalType,
            originalPackId: exportPack.packId,
        },
        update: {
            ...(source.manifest.update || {}),
            checkForUpdates: false,
            url: '',
        },
    };

    const exportedEntryFiles = [];
    const entryFiles = Array.isArray(source.entryFiles) ? source.entryFiles : [];
    if (!entryFiles.length) throw new Error(`${fresh.title || fresh.packId} has no Lorecard files to export.`);
    entryFiles.forEach((fileRecord, index) => {
        if (!fileRecord?.ok) throw new Error(`${fresh.title || fresh.packId} has a missing Lorecard file: ${fileRecord?.file || 'unknown'}`);
        const relativePath = getLoredeckPackageEntryPath(fileRecord, index);
        const schemaVersion = Math.max(3, Number(fileRecord.schemaVersion || manifest.entrySchemaVersion) || 0);
        const entries = Array.isArray(fileRecord.entries) ? fileRecord.entries : entryListFromLoredeckFileJson(fileRecord.json);
        addLoredeckPackageFile(files, `${deckFolder}/${relativePath}`, loredeckPackageStringify({
            schemaVersion,
            entries: cloneLoredeckJson(entries) || [],
        }));
        exportedEntryFiles.push(relativePath);
    });
    manifest.files = exportedEntryFiles;

    const baseUrl = source.baseUrl || (exportPack.manifest ? resolveManifestUrlForFetch(exportPack.manifest) : null);
    const copiedRefs = new Set(manifest.files);
    for (const ref of getLoredeckPackageRefPaths(manifest)) {
        if (copiedRefs.has(ref)) continue;
        if (!baseUrl) continue;
        await stageLoredeckPackageReferencedFile(files, deckFolder, baseUrl, ref);
        copiedRefs.add(ref);
    }
    if (getLoredeckTimelineRegistryCount(exportPack.timelineRegistry)) {
        manifest.registries = { ...(manifest.registries || {}), timeline: 'timeline.json' };
        addLoredeckPackageFile(files, `${deckFolder}/timeline.json`, loredeckPackageStringify(normalizeLoredeckTimelineRegistry(exportPack.timelineRegistry)), { replace: true });
    }
    if (getLoredeckTagRegistryCount(exportPack.tagRegistry)) {
        manifest.registries = { ...(manifest.registries || {}), tags: 'tags.json' };
        addLoredeckPackageFile(files, `${deckFolder}/tags.json`, loredeckPackageStringify(normalizeLoredeckTagRegistry(exportPack.tagRegistry)), { replace: true });
    }
    const exportedAssets = await stageLoredeckPackageAssets(files, exportPack, manifest, baseUrl, deckFolder);
    if (Object.keys(exportedAssets).length) manifest.assets = exportedAssets;
    else delete manifest.assets;

    addLoredeckPackageFile(files, `${deckFolder}/loredeck.json`, loredeckPackageStringify(manifest));
    return {
        files,
        indexRecord: buildLoredeckPackageIndexRecord(exportPack, manifest, deckFolderName),
        manifest,
    };
}

export async function buildLoredeckZipPackageForExport(packs = []) {
    const unique = new Map();
    for (const pack of packs || []) {
        if (pack?.packId && !unique.has(pack.packId)) unique.set(pack.packId, pack);
    }
    const selected = [...unique.values()];
    if (!selected.length) throw new Error('Select one or more Loredecks before exporting.');

    const registry = getLoredeckLibraryRegistry(getState());
    const files = [];
    const indexRecords = [];
    for (const pack of selected) {
        const staged = await buildLoredeckZipPackageFilesForPack(pack, registry);
        for (const file of staged.files) addLoredeckPackageFile(files, file.path, file.data);
        indexRecords.push(staged.indexRecord);
    }

    const selectedIds = selected.map(pack => String(pack.packId || '').trim()).filter(Boolean);
    const folderSubset = buildLoredeckPackageFolderSubset(selectedIds, registry);
    const packageTitle = selected.length === 1
        ? `${selected[0].title || selected[0].packId} Loredeck Package`
        : `Saga Loredeck Package (${selected.length} decks)`;
    addLoredeckPackageFile(files, 'saga-package.json', loredeckPackageStringify({
        packageSchemaVersion: 1,
        packageType: 'saga_loredeck_package',
        title: packageTitle,
        description: selected.length === 1
            ? `Exported Saga Loredeck package for ${selected[0].title || selected[0].packId}.`
            : `Exported Saga Loredeck package containing ${selected.length} Loredecks.`,
        author: 'Saga',
        version: '1.0.0',
        exportedAt: Date.now(),
        deckCount: selected.length,
    }));
    addLoredeckPackageFile(files, 'loredecks/index.json', loredeckPackageStringify({
        schemaVersion: 2,
        packageType: 'saga_loredeck_index',
        loredecks: indexRecords,
        folders: folderSubset.folders,
        deckPlacements: folderSubset.deckPlacements,
    }));

    const zipBytes = await createLoredeckZipPackage(files, { date: new Date() });
    const filenameStem = selected.length === 1
        ? sanitizeFileStem(selected[0].packId || selected[0].title || 'saga-loredeck')
        : `saga-loredecks-${new Date().toISOString().slice(0, 10)}`;
    return {
        zipBytes,
        filename: `${filenameStem}.saga-loredeck.zip`,
        deckCount: selected.length,
        fileCount: files.length,
    };
}

export async function exportSelectedLoredeckBundles(packs = [], button = null) {
    const unique = new Map();
    for (const pack of packs || []) {
        if (pack?.packId && !unique.has(pack.packId)) unique.set(pack.packId, pack);
    }
    const selected = [...unique.values()];
    if (!selected.length) {
        toast('Select one or more Loredecks before exporting.', 'warning');
        return;
    }
    await withLoredeckActionButtonBusy(button, { busyText: 'Exporting...', fallbackLabel: 'Export Selected' }, async () => {
        try {
            const result = await buildLoredeckZipPackageForExport(selected);
            downloadBytes(result.zipBytes, result.filename, 'application/zip');
            toast(`Exported ${result.deckCount} Loredeck${result.deckCount === 1 ? '' : 's'} as ${result.filename}.`, 'success');
        } catch (e) {
            toast(e?.message || 'Loredeck package export failed.', 'error');
            console.warn('[Saga] Loredeck package export failed:', e);
        }
    });
}
