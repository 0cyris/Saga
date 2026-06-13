/**
 * Pack Health assembly for loaded and in-memory Saga Loredeck data.
 */

import {
    analyzeEntryContextHealth,
    createInMemoryTimelineHealthIndex,
} from './context-health.js';
import {
    addHealthIssue,
    cleanHealthString,
    createHealth,
    entryListFromJson,
    finalizeHealth,
    isPlainObject,
} from './loredeck-health-core.js';
import { applyRegistryEntryOverrides } from './loredeck-normalizer.js';
import { analyzeSchemaV3EntryHealth } from './schema-v3-health.js';
import {
    analyzeEntryTagHealth,
    createEmptyTagRegistryHealthIndex,
    createInMemoryTagRegistryHealthIndex,
    getTagRegistryRef,
} from './tag-registry-health.js';

function normalizeCategoryCounts(value = {}) {
    const input = isPlainObject(value) ? value : {};
    const out = {};
    for (const [key, raw] of Object.entries(input)) {
        const category = cleanHealthString(key, 80);
        const count = Number(raw);
        if (!category || !Number.isFinite(count)) continue;
        out[category] = count;
    }
    return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
}

export function analyzeManifestStatsHealth(health, manifest = {}) {
    const stats = isPlainObject(manifest.stats) ? manifest.stats : {};
    const expectedEntryCount = Number(stats.entryCount);
    if (Number.isFinite(expectedEntryCount) && expectedEntryCount !== health.summary.entryCount) {
        health.summary.manifestStatsMismatchCount += 1;
        addHealthIssue(health, 'warning', 'manifest_entry_count_mismatch', `Manifest stats.entryCount is ${expectedEntryCount}, but Pack Health counted ${health.summary.entryCount} loaded Lorecards.`, {
            expectedEntryCount,
            actualEntryCount: health.summary.entryCount,
        });
    }

    const expectedCategoryCounts = normalizeCategoryCounts(stats.categoryCounts);
    if (Object.keys(expectedCategoryCounts).length) {
        const actualCategoryCounts = normalizeCategoryCounts(health.summary.categoryCounts);
        if (JSON.stringify(expectedCategoryCounts) !== JSON.stringify(actualCategoryCounts)) {
            health.summary.manifestStatsMismatchCount += 1;
            addHealthIssue(health, 'warning', 'manifest_category_counts_mismatch', 'Manifest stats.categoryCounts do not match loaded entry categories.', {
                expectedCategoryCounts,
                actualCategoryCounts,
            });
        }
    }
}

export function analyzeManifestFileListHealth(health, manifest = {}) {
    const files = Array.isArray(manifest.files) ? manifest.files.map(file => cleanHealthString(file, 400)).filter(Boolean) : [];
    const seen = new Set();
    const duplicates = [];
    for (const file of files) {
        const key = file.replace(/\\/g, '/').toLowerCase();
        if (seen.has(key)) duplicates.push(file);
        else seen.add(key);
    }
    if (duplicates.length) {
        addHealthIssue(health, 'warning', 'duplicate_manifest_file', `Loredeck manifest lists duplicate entry file${duplicates.length === 1 ? '' : 's'}: ${duplicates.join(', ')}.`, {
            files: duplicates,
        });
    }
}

function normalizeHealthEntryFileRecord(fileRecord = {}, manifest = {}) {
    const json = fileRecord.json && typeof fileRecord.json === 'object' ? fileRecord.json : null;
    const file = cleanHealthString(fileRecord.file || fileRecord.path || '__memory_entries__', 400);
    const entries = Array.isArray(fileRecord.entries) ? fileRecord.entries : entryListFromJson(json);
    const schemaVersion = Number(fileRecord.schemaVersion ?? json?.schemaVersion ?? manifest.entrySchemaVersion ?? 2);
    return {
        ...fileRecord,
        file,
        ok: fileRecord.ok !== false,
        json,
        entries,
        schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : 2,
    };
}

export function buildLoredeckHealthForData(options = {}) {
    const manifest = isPlainObject(options.manifest) ? options.manifest : {};
    const packId = cleanHealthString(options.packId || manifest.id || 'draft-loredeck', 160);
    const health = createHealth(packId);
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const entryFiles = Array.isArray(options.entryFiles)
        ? options.entryFiles.map(fileRecord => normalizeHealthEntryFileRecord(fileRecord, manifest))
        : [];

    health.summary.fileCount = files.length || entryFiles.length;
    health.summary.loadedFileCount = entryFiles.filter(fileRecord => fileRecord.ok !== false).length;
    health.summary.missingFileCount = entryFiles.filter(fileRecord => fileRecord.ok === false).length;
    analyzeManifestFileListHealth(health, manifest);
    for (const fileRecord of entryFiles) {
        if (fileRecord.ok !== false) continue;
        addHealthIssue(health, 'error', 'missing_entry_file', `Loredeck entry file failed to load: ${fileRecord.file}.`, {
            file: fileRecord.file,
            detail: fileRecord.error || '',
        });
    }

    const finalEntryFiles = options.registryRecord
        ? applyRegistryEntryOverrides(entryFiles, options.registryRecord, manifest, health)
        : entryFiles;
    const timeline = createInMemoryTimelineHealthIndex(manifest, options.timeline, health, options.timelineRegistryRecord || options.registryRecord);
    const tagIndex = createInMemoryTagRegistryHealthIndex(manifest, options.tagRegistry, options.registryRecord, health);
    analyzeEntryContextHealth(health, finalEntryFiles, timeline);
    analyzeEntries(health, finalEntryFiles, manifest, tagIndex);
    return finalizeHealth(health);
}

export function analyzeEntries(health, entryFiles = [], manifest = {}, tagIndex = createEmptyTagRegistryHealthIndex(health?.packId || '', getTagRegistryRef(manifest))) {
    const seenIds = new Map();
    const duplicateIds = new Set();
    let missingEntryIds = 0;
    let entryCount = 0;
    const categoryCounts = {};

    for (const fileRecord of entryFiles) {
        for (const entry of fileRecord.entries || []) {
            entryCount += 1;
            const id = String(entry?.id || '').trim();
            if (!id) {
                missingEntryIds += 1;
                addHealthIssue(health, 'error', 'missing_entry_id', `Entry without id in ${fileRecord.file}.`, { file: fileRecord.file });
            } else if (seenIds.has(id)) {
                duplicateIds.add(id);
                addHealthIssue(health, 'error', 'duplicate_entry_id', `Duplicate entry id: ${id}.`, {
                    entryIds: [id],
                    file: fileRecord.file,
                    firstFile: seenIds.get(id),
                });
            } else {
                seenIds.set(id, fileRecord.file);
            }

            const category = String(entry?.category || 'other').trim() || 'other';
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            analyzeSchemaV3EntryHealth(health, entry, fileRecord);
        }
    }

    health.summary.entryCount = entryCount;
    health.summary.duplicateEntryIdCount = duplicateIds.size;
    health.summary.missingEntryIdCount = missingEntryIds;
    health.summary.categoryCounts = categoryCounts;
    analyzeEntryTagHealth(health, entryFiles, tagIndex, manifest);
    analyzeManifestStatsHealth(health, manifest);
}
