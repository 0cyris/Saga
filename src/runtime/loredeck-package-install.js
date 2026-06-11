/**
 * loredeck-package-install.js - Saga
 * Runtime Loredeck package import model assembly.
 */

import {
    normalizeLoredeckEntryForSchemaV3,
} from '../loredecks/loredeck-loader.js';
import {
    parseLoredeckZipPackage,
} from '../loredecks/loredeck-package-service.js';
import {
    normalizeLoredeckTagRegistry,
    normalizeLoredeckTimelineRegistry,
} from '../state/lore-state-normalizers.js';
import {
    getState,
} from '../state/state-manager.js';
import {
    getLoredeckDefinition,
    getLoredeckLibrary,
} from './active-stack-panel.js';
import {
    buildEmbeddedCustomManifest,
    buildLoredeckStatsFromEntries,
    bytesToBase64,
    cloneLoredeckJson,
    entryListFromLoredeckFileJson,
    getLoredeckPackageMimeType,
    getLoredeckPackageRegistryRef,
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
    hashLoredeckBundleJson,
    normalizeLoredeckEntryId,
    normalizeLoredeckPackId,
    parseLoredeckTags,
    resolveLoredeckPackageImportPath,
} from './loredeck-package-helpers.js';

function getUniqueLoredeckPackId(baseId, library = getLoredeckLibrary(getState())) {
    const existing = new Set(library.map(pack => pack.packId));
    const base = normalizeLoredeckPackId(baseId) || 'custom-loredeck';
    if (!existing.has(base)) return base;
    for (let index = 2; index < 1000; index += 1) {
        const candidate = `${base}-${index}`;
        if (!existing.has(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
}

export function getLoredeckInstallDuplicateMatches(install = {}) {
    const record = install.record || {};
    const originalPackId = String(install.originalPackId || record.source?.originalPackId || '').trim();
    const contentHash = String(record.source?.contentHash || '').trim();
    const titleKey = String(record.title || '').trim().toLowerCase();
    const versionKey = String(record.version || '').trim().toLowerCase();
    const fandomKey = String(record.fandom || '').trim().toLowerCase();
    const matches = [];
    const seen = new Set();

    for (const pack of getLoredeckLibrary(getState())) {
        if (!pack?.packId || seen.has(pack.packId)) continue;
        const source = pack.source && typeof pack.source === 'object' && !Array.isArray(pack.source) ? pack.source : {};
        const derivedFrom = pack.derivedFrom && typeof pack.derivedFrom === 'object' && !Array.isArray(pack.derivedFrom) ? pack.derivedFrom : {};
        const reasons = [];
        const exactHash = !!(contentHash && source.contentHash === contentHash);
        if (exactHash) reasons.push('same content hash');
        if (originalPackId && pack.packId === originalPackId) reasons.push('same deck ID');
        if (originalPackId && source.originalPackId === originalPackId) reasons.push('same source deck');
        if (originalPackId && derivedFrom.packId === originalPackId) reasons.push('same derived source');
        const sameTitleVersion = titleKey
            && titleKey === String(pack.title || '').trim().toLowerCase()
            && (!versionKey || versionKey === String(pack.version || '').trim().toLowerCase())
            && (!fandomKey || fandomKey === String(pack.fandom || '').trim().toLowerCase());
        if (!reasons.length && sameTitleVersion) reasons.push('same title/version');
        if (!reasons.length) continue;
        seen.add(pack.packId);
        matches.push({
            pack,
            reasons,
            exactHash,
            sameId: originalPackId && pack.packId === originalPackId,
            canReplace: pack.type !== 'bundled',
            localModified: pack.localModified === true,
        });
    }

    return matches.sort((a, b) => {
        if (a.exactHash !== b.exactHash) return a.exactHash ? -1 : 1;
        if (a.sameId !== b.sameId) return a.sameId ? -1 : 1;
        if (a.canReplace !== b.canReplace) return a.canReplace ? -1 : 1;
        return String(a.pack.title || a.pack.packId).localeCompare(String(b.pack.title || b.pack.packId));
    });
}

export async function readLoredeckPackageRegistry(packageModel = {}, deck = {}, key = '') {
    const archive = packageModel.archive;
    const manifest = deck.manifest || {};
    const ref = getLoredeckPackageRegistryRef(manifest, key);
    if (ref) {
        const path = resolveLoredeckPackageImportPath(deck.deckRoot, ref);
        if (path && archive.has(path)) {
            return archive.readJson(path);
        }
    }
    const embeddedKey = key === 'timeline' ? 'timelineRegistry' : 'tagRegistry';
    const embedded = manifest[embeddedKey];
    return embedded && typeof embedded === 'object' && !Array.isArray(embedded) ? embedded : null;
}

export async function buildLoredeckPackageAssetsForInstall(packageModel = {}, deck = {}, warnings = []) {
    const assets = {};
    for (const ref of deck.assetRefs || []) {
        try {
            const bytes = await packageModel.archive.readFileBytes(ref.resolvedPath);
            if (bytes.length > 1024 * 1024) {
                warnings.push(`Skipped oversized asset ${ref.resolvedPath}; imported deck will use a text fallback for that image.`);
                continue;
            }
            const mimeType = ref.asset?.mimeType || getLoredeckPackageMimeType(ref.resolvedPath);
            assets[ref.key || 'cover'] = {
                ...(cloneLoredeckJson(ref.asset) || {}),
                path: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
                mimeType,
                updatedAt: Date.now(),
            };
        } catch (e) {
            warnings.push(`Could not import asset ${ref.resolvedPath}: ${e?.message || 'asset failed'}`);
        }
    }
    return assets;
}

export async function buildLoredeckPackageEntryOverridesForInstall(packageModel = {}, deck = {}, warnings = []) {
    const entryOverrides = {};
    let skipped = 0;
    let duplicates = 0;
    const addEntries = (entries = [], fileRef = '', schemaVersion = 3) => {
        for (const raw of entries || []) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
            const id = normalizeLoredeckEntryId(raw.id || '');
            if (!id) {
                skipped += 1;
                continue;
            }
            if (entryOverrides[id]) {
                duplicates += 1;
                continue;
            }
            const entry = normalizeLoredeckEntryForSchemaV3({
                ...(cloneLoredeckJson(raw) || raw),
                id,
                schemaVersion: Math.max(3, Number(raw.schemaVersion || schemaVersion) || 0),
            });
            entry.extensions = {
                ...(entry.extensions || {}),
                sagaLoredeckSourceFile: String(fileRef || '').replace(String(deck.deckRoot || ''), ''),
            };
            entryOverrides[id] = entry;
        }
    };

    for (const fileRef of deck.fileRefs || []) {
        try {
            const json = await packageModel.archive.readJson(fileRef);
            addEntries(entryListFromLoredeckFileJson(json), fileRef, json?.schemaVersion || deck.manifest?.entrySchemaVersion || 3);
        } catch (e) {
            warnings.push(`Could not import Lorecard file ${fileRef}: ${e?.message || 'file failed'}`);
        }
    }
    addEntries(entryListFromLoredeckFileJson(deck.manifest), 'loredeck.json', deck.manifest?.entrySchemaVersion || 3);

    if (skipped) warnings.push(`Skipped ${skipped} Lorecard${skipped === 1 ? '' : 's'} without IDs.`);
    if (duplicates) warnings.push(`Skipped ${duplicates} duplicate Lorecard ID${duplicates === 1 ? '' : 's'}.`);
    return entryOverrides;
}

export async function buildLoredeckPackageDeckInstall(packageModel = {}, deck = {}, options = {}) {
    const now = Date.now();
    const warnings = [];
    const originalPackId = normalizeLoredeckPackId(deck.originalPackId || deck.manifest?.id || deck.indexRecord?.packId || 'imported-loredeck');
    if (!originalPackId) throw new Error('Package deck is missing a usable ID.');
    const existing = getLoredeckDefinition(originalPackId);
    const packId = existing ? getUniqueLoredeckPackId(`${originalPackId}-custom`) : originalPackId;
    if (existing) warnings.push(`Deck ID ${originalPackId} already exists; install target will be ${packId}.`);
    if (deck.missingFiles?.length) warnings.push(`${deck.missingFiles.length} referenced Lorecard file${deck.missingFiles.length === 1 ? '' : 's'} missing from package.`);
    if (deck.missingAssets?.length) warnings.push(`${deck.missingAssets.length} referenced asset${deck.missingAssets.length === 1 ? '' : 's'} missing from package.`);

    const sourceManifest = cloneLoredeckJson(deck.manifest) || {};
    const indexRecord = cloneLoredeckJson(deck.indexRecord) || {};
    const sourceInfo = sourceManifest.source && typeof sourceManifest.source === 'object' && !Array.isArray(sourceManifest.source)
        ? sourceManifest.source
        : {};
    const originalType = String(sourceInfo.originalType || indexRecord.originalType || indexRecord.type || sourceManifest.type || 'custom').trim() || 'custom';
    const packageTitle = String(packageModel.packageMeta?.title || options.fileName || '').trim();
    const bundledReferenceManifest = existing?.type === 'bundled' && originalType === 'bundled'
        ? String(existing.manifest || existing.source?.url || '').trim()
        : '';

    if (bundledReferenceManifest) {
        const stats = sourceManifest.stats && typeof sourceManifest.stats === 'object' && !Array.isArray(sourceManifest.stats)
            ? cloneLoredeckJson(sourceManifest.stats) || {}
            : (indexRecord.stats && typeof indexRecord.stats === 'object' && !Array.isArray(indexRecord.stats)
                ? cloneLoredeckJson(indexRecord.stats) || {}
                : cloneLoredeckJson(existing.stats) || {});
        const sourceTags = Array.isArray(sourceManifest.tags) ? sourceManifest.tags : [];
        const indexTags = Array.isArray(indexRecord.tags) ? indexRecord.tags : [];
        const contentHash = hashLoredeckBundleJson({
            packageSchemaVersion: packageModel.packageMeta?.packageSchemaVersion || 1,
            packageType: packageModel.packageMeta?.packageType || 'saga_loredeck_package',
            originalPackId,
            manifest: sourceManifest,
            storageMode: 'bundled_manifest_reference',
        });
        const source = {
            ...(sourceManifest.source && typeof sourceManifest.source === 'object' && !Array.isArray(sourceManifest.source) ? sourceManifest.source : {}),
            kind: 'imported_zip',
            storageMode: 'bundled_manifest_reference',
            installedFrom: String(options.fileName || '').trim(),
            bundleType: 'saga_loredeck_zip_package',
            originalPackId,
            contentHash,
            exportedAt: Number.isFinite(Number(packageModel.packageMeta?.exportedAt)) ? Number(packageModel.packageMeta.exportedAt) : 0,
            importedAt: now,
            url: bundledReferenceManifest,
        };
        const record = {
            packId,
            type: 'custom',
            title: String(sourceManifest.title || indexRecord.title || existing.title || packId).trim(),
            description: String(sourceManifest.description || indexRecord.description || existing.description || '').trim(),
            fandom: String(sourceManifest.fandom || indexRecord.fandom || existing.fandom || '').trim(),
            era: String(sourceManifest.era || indexRecord.era || existing.era || '').trim(),
            author: String(sourceManifest.author || indexRecord.author || existing.author || '').trim(),
            version: String(sourceManifest.version || indexRecord.version || existing.version || '1.0.0').trim(),
            entrySchemaVersion: Math.max(3, Number(sourceManifest.entrySchemaVersion || indexRecord.entrySchemaVersion || existing.entrySchemaVersion) || 0),
            manifest: bundledReferenceManifest,
            source,
            tags: parseLoredeckTags([
                ...sourceTags,
                ...indexTags,
                'origin:imported',
                'origin:zip-package',
            ].filter(Boolean).join(', ')),
            stats,
            healthStatus: '',
            localModified: false,
            installedAt: now,
            updatedAt: now,
            derivedFrom: {
                kind: 'imported_loredeck_package',
                packId: originalPackId,
                title: String(sourceManifest.title || indexRecord.title || originalPackId).trim(),
                type: originalType,
                version: String(sourceManifest.version || indexRecord.version || '').trim(),
                packageTitle,
                sourceFile: String(options.fileName || '').trim(),
                importedAt: now,
            },
            entryOverrides: {},
            disabledEntryIds: [],
            pendingChanges: [],
        };
        const manifestSeed = {
            ...sourceManifest,
            id: packId,
            type: 'custom',
            library: {},
            stats,
            source,
        };
        record.manifestData = buildEmbeddedCustomManifest(manifestSeed, record);

        const install = {
            record,
            warnings,
            originalPackId,
            originalType,
            bundleType: 'saga_loredeck_zip_package',
            contentHash,
            declaredContentHash: '',
            contentHashMatches: true,
            embeddedEntryCount: Math.max(0, Number(stats.entryCount || indexRecord.entryCount || 0) || 0),
            pendingDropCount: 0,
            collision: !!existing,
            fileCount: deck.fileRefs?.length || 0,
            assetCount: 0,
            storageMode: 'bundled_manifest_reference',
        };
        const matches = getLoredeckInstallDuplicateMatches(install);
        const exactMatches = matches.filter(match => match.exactHash);
        if (exactMatches.length) {
            install.warnings.unshift(`${exactMatches.length} installed Loredeck${exactMatches.length === 1 ? '' : 's'} already match this package content hash.`);
        } else if (matches.length) {
            install.warnings.unshift(`${matches.length} possible duplicate Loredeck${matches.length === 1 ? '' : 's'} found.`);
        }
        return {
            ...install,
            matches,
        };
    }

    const entryOverrides = await buildLoredeckPackageEntryOverridesForInstall(packageModel, deck, warnings);
    const entries = Object.values(entryOverrides);
    if (!entries.length) throw new Error(`${sourceManifest.title || originalPackId} contains no importable Lorecards.`);
    const stats = buildLoredeckStatsFromEntries(entries);
    const assets = await buildLoredeckPackageAssetsForInstall(packageModel, deck, warnings);
    const timelineRegistry = normalizeLoredeckTimelineRegistry(await readLoredeckPackageRegistry(packageModel, deck, 'timeline'));
    const tagRegistry = normalizeLoredeckTagRegistry(await readLoredeckPackageRegistry(packageModel, deck, 'tags'));
    const contentHash = hashLoredeckBundleJson({
        packageSchemaVersion: packageModel.packageMeta?.packageSchemaVersion || 1,
        packageType: packageModel.packageMeta?.packageType || 'saga_loredeck_package',
        originalPackId,
        manifest: sourceManifest,
        entryOverrides,
        timelineRegistry,
        tagRegistry,
        assets,
    });
    const source = {
        ...(sourceManifest.source && typeof sourceManifest.source === 'object' && !Array.isArray(sourceManifest.source) ? sourceManifest.source : {}),
        kind: 'imported_zip',
        installedFrom: String(options.fileName || '').trim(),
        bundleType: 'saga_loredeck_zip_package',
        originalPackId,
        contentHash,
        exportedAt: Number.isFinite(Number(packageModel.packageMeta?.exportedAt)) ? Number(packageModel.packageMeta.exportedAt) : 0,
        importedAt: now,
    };
    const record = {
        packId,
        type: 'custom',
        title: String(sourceManifest.title || indexRecord.title || packId).trim(),
        description: String(sourceManifest.description || indexRecord.description || '').trim(),
        fandom: String(sourceManifest.fandom || indexRecord.fandom || '').trim(),
        era: String(sourceManifest.era || indexRecord.era || '').trim(),
        author: String(sourceManifest.author || indexRecord.author || '').trim(),
        version: String(sourceManifest.version || indexRecord.version || '1.0.0').trim(),
        entrySchemaVersion: Math.max(3, Number(sourceManifest.entrySchemaVersion || indexRecord.entrySchemaVersion) || 0),
        manifest: '',
        source,
        tags: parseLoredeckTags([
            ...(Array.isArray(sourceManifest.tags) ? sourceManifest.tags : []),
            ...(Array.isArray(indexRecord.tags) ? indexRecord.tags : []),
            'origin:imported',
            'origin:zip-package',
        ].filter(Boolean).join(', ')),
        stats,
        healthStatus: '',
        localModified: false,
        installedAt: now,
        updatedAt: now,
        derivedFrom: {
            kind: 'imported_loredeck_package',
            packId: originalPackId,
            title: String(sourceManifest.title || indexRecord.title || originalPackId).trim(),
            type: originalType,
            version: String(sourceManifest.version || indexRecord.version || '').trim(),
            packageTitle,
            sourceFile: String(options.fileName || '').trim(),
            importedAt: now,
        },
        entryOverrides,
        disabledEntryIds: [],
        pendingChanges: [],
    };
    if (Object.keys(assets).length) record.assets = assets;
    if (getLoredeckTimelineRegistryCount(timelineRegistry)) record.timelineRegistry = timelineRegistry;
    if (getLoredeckTagRegistryCount(tagRegistry)) record.tagRegistry = tagRegistry;

    const manifestSeed = {
        ...sourceManifest,
        id: packId,
        type: 'custom',
        files: [],
        library: {},
        assets: Object.keys(assets).length ? assets : sourceManifest.assets,
        stats,
        source,
    };
    record.manifestData = buildEmbeddedCustomManifest(manifestSeed, record);

    const install = {
        record,
        warnings,
        originalPackId,
        originalType,
        bundleType: 'saga_loredeck_zip_package',
        contentHash,
        declaredContentHash: '',
        contentHashMatches: true,
        embeddedEntryCount: entries.length,
        pendingDropCount: 0,
        collision: !!existing,
        fileCount: deck.fileRefs?.length || 0,
        assetCount: Object.keys(assets).length,
    };
    const matches = getLoredeckInstallDuplicateMatches(install);
    const exactMatches = matches.filter(match => match.exactHash);
    if (exactMatches.length) {
        install.warnings.unshift(`${exactMatches.length} installed Loredeck${exactMatches.length === 1 ? '' : 's'} already match this package content hash.`);
    } else if (matches.length) {
        install.warnings.unshift(`${matches.length} possible duplicate Loredeck${matches.length === 1 ? '' : 's'} found.`);
    }
    return {
        ...install,
        matches,
    };
}

export async function readLoredeckZipPackageInstallFile(file) {
    const fileName = file?.name || 'selected-package.saga-loredeck.zip';
    try {
        const packageModel = await parseLoredeckZipPackage(file);
        const installs = [];
        const failures = [...(packageModel.failures || [])];
        for (const deck of packageModel.decks || []) {
            try {
                installs.push(await buildLoredeckPackageDeckInstall(packageModel, deck, { fileName }));
            } catch (e) {
                failures.push({
                    record: deck.indexRecord || deck.manifest || {},
                    error: e?.message || 'Deck package record could not be installed.',
                });
            }
        }
        return {
            ok: installs.length > 0,
            fileName,
            packageModel,
            installs,
            failures,
            warnings: packageModel.warnings || [],
            error: installs.length ? '' : 'Loredeck package contains no installable decks.',
        };
    } catch (e) {
        return {
            ok: false,
            fileName,
            packageModel: null,
            installs: [],
            failures: [],
            warnings: [],
            error: e?.message || 'Loredeck package import failed.',
        };
    }
}

export function buildLoredeckPackageRegistryForInstall(packageInstall = {}, installs = []) {
    const selected = installs.filter(install => install?.record?.packId);
    const packs = {};
    for (const install of selected) packs[install.record.packId] = install.record;
    return {
        schemaVersion: 1,
        packs,
        folders: [],
        deckPlacements: [],
        activeStack: [],
    };
}
