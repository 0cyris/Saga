/**
 * Loredeck Creator schema v3 entry draft guardrails.
 */

import {
    normalizeSchemaV3EntryOverrideForPack,
    repairSchemaV3EntryForPack,
} from './loredeck-schema-v3-entry-repair.js';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeCreatorSchemaV3EntryOverride(pack = {}, rawEntry = {}, id = '') {
    return normalizeSchemaV3EntryOverrideForPack(pack, rawEntry, id);
}

export function guardLoredeckCreatorEntryDraftChange(pack = {}, change = {}, options = {}) {
    const payload = isPlainObject(change.payload) ? { ...change.payload } : {};
    const entryOverrides = isPlainObject(payload.entryOverrides) ? payload.entryOverrides : {};
    const targetIds = new Set(Array.from(options.targetEntryIds || []).map(id => String(id || '').trim()).filter(Boolean));
    const nextOverrides = {};
    const warnings = [];
    const errors = [];
    let repaired = false;

    for (const [rawId, rawEntry] of Object.entries(entryOverrides)) {
        if (!rawEntry || !isPlainObject(rawEntry)) continue;
        const id = String(rawEntry.id || rawId || '').trim();
        if (!id) continue;
        if (targetIds.size && !targetIds.has(id)) {
            errors.push(`Entry ${id} is outside this Creator micro-batch.`);
            continue;
        }
        const schemaVersion = Math.max(Number(rawEntry.schemaVersion) || 0, Number(pack.entrySchemaVersion) || Number(pack.manifestData?.entrySchemaVersion) || 0);
        if (schemaVersion < 3) {
            nextOverrides[id] = rawEntry;
            continue;
        }
        const repair = repairSchemaV3EntryForPack(pack, rawEntry, id, {
            rejectUnknownAnchors: true,
            rejectUnknownTags: true,
        });
        warnings.push(...repair.warnings);
        errors.push(...repair.errors);
        if (repair.repaired) repaired = true;
        nextOverrides[id] = repair.entry;
    }

    if (errors.length) {
        return {
            change: null,
            warnings: [...new Set(warnings)].slice(0, 20),
            errors: [...new Set(errors)].slice(0, 20),
            repaired,
        };
    }
    return {
        change: {
            ...change,
            affectedEntryIds: Object.keys(nextOverrides),
            payload: {
                ...payload,
                entryOverrides: nextOverrides,
            },
            preview: warnings.length
                ? {
                    ...(change.preview || {}),
                    qualityWarnings: [
                        ...new Set([
                            ...((Array.isArray(change.preview?.qualityWarnings) ? change.preview.qualityWarnings : [])),
                            ...warnings,
                        ]),
                    ].slice(0, 12),
                }
                : change.preview,
        },
        warnings: [...new Set(warnings)].slice(0, 20),
        errors: [],
        repaired,
    };
}
