/**
 * Loredeck registry overlay and virtual-entry normalization helpers.
 */

import {
    addHealthIssue,
    clonePlainObject,
    isPlainObject,
} from './loredeck-health-core.js';

export function buildEmbeddedManifest(registryRecord, packId) {
    if (!isPlainObject(registryRecord?.manifestData)) return null;
    const manifestData = registryRecord.manifestData;
    const id = String(registryRecord.packId || manifestData.id || packId || '').trim();
    if (!id) return null;
    return {
        ...manifestData,
        id,
        type: registryRecord.type || manifestData.type || 'custom',
        title: registryRecord.title || manifestData.title || id,
        description: registryRecord.description || manifestData.description || '',
        fandom: registryRecord.fandom || manifestData.fandom || '',
        era: registryRecord.era || manifestData.era || '',
        author: registryRecord.author || manifestData.author || '',
        version: registryRecord.version || manifestData.version || '',
        source: registryRecord.source || manifestData.source || {},
        tags: Array.isArray(registryRecord.tags) && registryRecord.tags.length ? registryRecord.tags : (manifestData.tags || []),
        stats: registryRecord.stats || manifestData.stats || {},
        derivedFrom: registryRecord.derivedFrom || manifestData.derivedFrom || null,
        disabledEntryIds: Array.isArray(registryRecord.disabledEntryIds) ? registryRecord.disabledEntryIds : [],
    };
}

function normalizeEntryOverrideMap(value) {
    if (!isPlainObject(value)) return new Map();
    const output = new Map();
    for (const [key, raw] of Object.entries(value)) {
        if (!isPlainObject(raw)) continue;
        const id = String(raw.id || key || '').trim();
        if (!id) continue;
        output.set(id, {
            ...clonePlainObject(raw),
            id,
        });
        if (output.size >= 5000) break;
    }
    return output;
}

function normalizeDisabledEntryIdSet(value) {
    if (!Array.isArray(value)) return new Set();
    const output = new Set();
    for (const raw of value) {
        const id = String(raw || '').trim();
        if (id) output.add(id);
        if (output.size >= 1000) break;
    }
    return output;
}

export function isGeneratedRegistryRecord(registryRecord = null) {
    return String(registryRecord?.type || registryRecord?.manifestData?.type || '').trim() === 'generated';
}

export function getAcceptedVirtualRegistryEntries(registryRecord = null, manifest = {}) {
    const overrides = normalizeEntryOverrideMap(registryRecord?.entryOverrides);
    const disabledIds = normalizeDisabledEntryIdSet(registryRecord?.disabledEntryIds);
    const schemaVersion = Number(manifest.entrySchemaVersion || registryRecord?.entrySchemaVersion || registryRecord?.manifestData?.entrySchemaVersion) || 3;
    const entries = [];
    for (const [id, raw] of overrides.entries()) {
        if (disabledIds.has(id)) continue;
        const entry = clonePlainObject(raw) || {};
        entry.id = id;
        entry.schemaVersion = Number(entry.schemaVersion) || Math.max(3, schemaVersion);
        entries.push(entry);
    }
    return entries;
}

export function getAcceptedGeneratedRegistryEntries(registryRecord = null, manifest = {}) {
    if (!isGeneratedRegistryRecord(registryRecord)) return [];
    return getAcceptedVirtualRegistryEntries(registryRecord, manifest);
}

export function buildVirtualEntryFilesFromRegistry(registryRecord = null, manifest = {}) {
    const entries = getAcceptedVirtualRegistryEntries(registryRecord, manifest);
    const schemaVersion = Math.max(3, Number(manifest.entrySchemaVersion || registryRecord?.entrySchemaVersion || registryRecord?.manifestData?.entrySchemaVersion) || 0);
    if (!entries.length) return [];
    return [{
        file: isGeneratedRegistryRecord(registryRecord) ? '__saga_generated_entries__' : '__saga_embedded_entries__',
        url: null,
        ok: true,
        json: {
            schemaVersion,
            entries,
        },
        entries,
        schemaVersion,
    }];
}

export function buildGeneratedEntryFilesFromRegistry(registryRecord = null, manifest = {}) {
    return buildVirtualEntryFilesFromRegistry(registryRecord, manifest);
}

function buildOverrideEntry(override, baseEntry, packId, kind) {
    const entry = {
        ...(baseEntry || {}),
        ...(override || {}),
        content: {
            ...(baseEntry?.content || {}),
            ...(override?.content || {}),
        },
        extensions: {
            ...(baseEntry?.extensions || {}),
            ...(override?.extensions || {}),
            sagaLoredeckOverride: {
                kind,
                packId,
                sourceEntryId: baseEntry?.id || '',
                updatedAt: override?.extensions?.sagaLoredeckOverride?.updatedAt || Date.now(),
            },
        },
        userEditable: override?.userEditable !== false,
        userEdited: true,
    };
    entry.id = String(override?.id || baseEntry?.id || '').trim();
    return entry;
}

export function applyRegistryEntryOverrides(entryFiles = [], registryRecord = null, manifest = {}, health = null) {
    const overrides = normalizeEntryOverrideMap(registryRecord?.entryOverrides);
    const disabledIds = normalizeDisabledEntryIdSet(registryRecord?.disabledEntryIds);
    if (!overrides.size && !disabledIds.size) return entryFiles;

    const packId = String(registryRecord?.packId || manifest.id || '').trim();
    const appliedOverrideIds = new Set();
    let replaced = 0;
    let added = 0;
    let suppressed = 0;

    const nextFiles = entryFiles.map(fileRecord => {
        if (!fileRecord?.ok) return fileRecord;
        const nextEntries = [];
        for (const entry of fileRecord.entries || []) {
            const id = String(entry?.id || '').trim();
            if (id && disabledIds.has(id)) {
                suppressed += 1;
                continue;
            }
            if (id && overrides.has(id)) {
                nextEntries.push(buildOverrideEntry(overrides.get(id), entry, packId, 'override'));
                appliedOverrideIds.add(id);
                replaced += 1;
            } else {
                nextEntries.push(entry);
            }
        }
        return {
            ...fileRecord,
            entries: nextEntries,
        };
    });

    const additions = [];
    for (const [id, override] of overrides.entries()) {
        if (appliedOverrideIds.has(id) || disabledIds.has(id)) continue;
        additions.push(buildOverrideEntry(override, null, packId, 'addition'));
        added += 1;
    }
    if (additions.length) {
        nextFiles.push({
            file: '__saga_entry_overrides__',
            url: null,
            ok: true,
            json: { schemaVersion: manifest.entrySchemaVersion || 2, entries: additions },
            entries: additions,
            schemaVersion: manifest.entrySchemaVersion || 2,
        });
    }

    if (health?.summary) {
        health.summary.entryOverrideCount = replaced;
        health.summary.entryAdditionCount = added;
        health.summary.disabledEntryIdCount = disabledIds.size;
        health.summary.suppressedEntryCount = suppressed;
    }
    if (replaced || added || disabledIds.size) {
        addHealthIssue(health, 'suggestion', 'custom_entry_overrides_applied', `Custom Loredeck applied ${replaced} override(s), ${added} addition(s), and ${suppressed} disabled source Lorecard${suppressed === 1 ? '' : 's'}.`, {
            packId,
            overrideCount: replaced,
            additionCount: added,
            disabledEntryIdCount: disabledIds.size,
            suppressedEntryCount: suppressed,
        });
    }

    return nextFiles;
}
