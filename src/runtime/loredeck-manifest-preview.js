/**
 * loredeck-manifest-preview.js - Saga
 * Manifest preview card for runtime Loredeck details.
 */

import {
    createEmptyMessage,
    createKeyValue,
} from '../ui/runtime-ui-kit.js';
import {
    formatLoredeckCompatibility,
    formatLoredeckManifestContinuity,
} from './loredeck-manifest-formatters.js';
import {
    buildEmbeddedCustomManifest,
    cloneLoredeckJson,
} from './loredeck-package-helpers.js';
import {
    canUseVirtualLoredeckData,
    isGeneratedLoredeckPack,
    isVirtualLoredeckPack,
    refreshGeneratedLoredeckDerivedMetadata,
} from './loredeck-virtual-data.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureLoredeckManifestPreview(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function createLoredeckManifestPreview(pack) {
    const getLoredeckManifestPreviewCacheRecord = dep('getLoredeckManifestPreviewCacheRecord', () => null);
    const createLoredeckHealthRepairPlanner = dep('createLoredeckHealthRepairPlanner', () => null);
    const preview = document.createElement('div');
    preview.className = 'saga-loredeck-manifest-preview';
    const embeddedPreviewManifest = isVirtualLoredeckPack(pack)
        ? buildEmbeddedCustomManifest(pack.manifestData || {}, refreshGeneratedLoredeckDerivedMetadata(cloneLoredeckJson(pack) || { ...pack }))
        : null;
    const cached = getLoredeckManifestPreviewCacheRecord(pack.packId) || (embeddedPreviewManifest
        ? {
            manifest: embeddedPreviewManifest,
            error: '',
            loadedAt: pack.updatedAt || pack.installedAt || 0,
        }
        : null);

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Manifest Preview';
    preview.appendChild(title);

    if (!pack.manifest && !cached?.manifest) {
        preview.appendChild(createEmptyMessage('No manifest path or URL is registered for this Loredeck.'));
        return preview;
    }
    if (!cached) {
        preview.appendChild(createEmptyMessage('Manifest not loaded. Use Inspect Manifest to preview files and schema metadata.'));
        return preview;
    }
    if (cached.error) {
        preview.appendChild(createKeyValue('Status', 'Load failed', 'Manifest preview load status.'));
        preview.appendChild(createKeyValue('Error', cached.error, 'Last manifest fetch error.'));
        return preview;
    }

    const manifest = cached.manifest || {};
    const files = Array.isArray(manifest.files) ? manifest.files.map(file => String(file || '').trim()).filter(Boolean) : [];
    const registries = manifest.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-detail-grid';
    summary.appendChild(createKeyValue('Schema', String(manifest.schemaVersion || 'unset'), 'Loredeck manifest schema version.'));
    summary.appendChild(createKeyValue('Lorecard Schema', String(manifest.entrySchemaVersion || 'unset'), 'Lorecard schema version used by deck files.'));
    summary.appendChild(createKeyValue('Content Kind', manifest.contentKind || 'unset', 'Fandom, original, system, or other pack content kind.'));
    summary.appendChild(createKeyValue('Files', String(files.length), 'Entry JSON files referenced by the manifest.'));
    summary.appendChild(createKeyValue('Registries', Object.keys(registries).join(', ') || 'none', 'Taxonomy, gate, scoring, or other registry files declared by the manifest.'));
    summary.appendChild(createKeyValue('Continuity', formatLoredeckManifestContinuity(manifest.continuity), 'Canon/adaptation/source-boundary metadata.'));
    summary.appendChild(createKeyValue('Compatibility', formatLoredeckCompatibility(manifest.compatibility), 'Saga schema compatibility declared by the pack.'));
    summary.appendChild(createKeyValue('Update URL', manifest.update?.url || pack.source?.updateUrl || 'none', 'Optional update-check source for creator-published packs.'));
    preview.appendChild(summary);

    if (cached.health) {
        const validation = document.createElement('div');
        validation.className = 'saga-loredeck-detail-grid';
        const healthSummary = cached.health.summary || {};
        validation.appendChild(createKeyValue('Validation', cached.health.status || 'unknown', 'Latest Deck Health validation run from the Loredeck editor/export path.'));
        validation.appendChild(createKeyValue('Validation Issues', `${healthSummary.errorCount || 0} errors / ${healthSummary.warningCount || 0} warnings / ${healthSummary.suggestionCount || 0} suggestions`, 'Issue counts from latest validation.'));
        validation.appendChild(createKeyValue('Schema v3', `${healthSummary.schemaV3EntryCount || 0} Lorecards / ${healthSummary.schemaV3IssueCount || 0} issues`, 'Schema v3 conformance count from latest validation.'));
        validation.appendChild(createKeyValue('Stats Drift', String(healthSummary.manifestStatsMismatchCount || 0), 'Manifest stats mismatches from latest validation.'));
        preview.appendChild(validation);
        const repairPanel = createLoredeckHealthRepairPlanner(pack, cached.health);
        if (repairPanel) preview.appendChild(repairPanel);
    }

    const fileList = document.createElement('div');
    fileList.className = 'saga-loredeck-file-list';
    for (const file of files.slice(0, 14)) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-file-item';
        item.textContent = file;
        fileList.appendChild(item);
    }
    if (!files.length && canUseVirtualLoredeckData(pack)) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-file-item saga-loredeck-file-item-muted';
        item.textContent = isGeneratedLoredeckPack(pack)
            ? 'Accepted generated Lorecards are stored in this local Loredeck record.'
            : 'Embedded Lorecards are stored in this installed Custom Loredeck record.';
        fileList.appendChild(item);
    }
    if (files.length > 14) {
        const more = document.createElement('div');
        more.className = 'saga-loredeck-file-item saga-loredeck-file-item-muted';
        more.textContent = `+${files.length - 14} more file${files.length - 14 === 1 ? '' : 's'}`;
        fileList.appendChild(more);
    }
    preview.appendChild(fileList);

    if (cached.loadedAt) {
        const loaded = document.createElement('div');
        loaded.className = 'saga-runtime-help';
        loaded.textContent = `Last inspected ${new Date(cached.loadedAt).toLocaleString()}.`;
        preview.appendChild(loaded);
    }
    return preview;
}
