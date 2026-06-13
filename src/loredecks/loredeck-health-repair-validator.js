/**
 * Storage-neutral repair patch validator.
 */

import {
    LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
    LOREDECK_HEALTH_REPAIR_SOURCES,
    cleanRepairString,
    isPlainRepairObject,
    normalizeRepairChoiceSet,
    normalizeRepairPatch,
    normalizeRepairTagIdList,
    normalizeRepairTimelineId,
} from './loredeck-health-repair-contracts.js';
import {
    validateSchemaV3EntryShape,
} from './loredeck-schema-v3-entry-repair.js';

const MANIFEST_STATS_REPAIR_CODES = new Set([
    'manifest_entry_count_mismatch',
    'manifest_category_counts_mismatch',
]);

const SCHEMA_ENTRY_REPAIR_CODES = new Set([
    'schema_v3_legacy_timing_fields',
    'schema_v3_wide_lore_retrieval',
    'schema_v3_missing_context',
    'schema_v3_invalid_context_scope',
    'schema_v3_missing_context_sort_keys',
    'schema_v3_missing_context_precision',
    'schema_v3_missing_context_label',
    'schema_v3_missing_retrieval',
    'schema_v3_incomplete_retrieval',
    'schema_v3_missing_content',
]);

const TAG_REPAIR_CODES = new Set([
    'undefined_tag',
    'deprecated_tag_used',
    'malformed_tag_namespace',
]);

const CONTEXT_REPAIR_CODES = new Set([
    'broken_anchor_reference',
    'unmatchable_context_gate',
    'invalid_context_window',
]);

const ENTRY_FIELD_ALLOWLIST_BY_CODE = Object.freeze({
    schema_v3_legacy_timing_fields: ['schema_v3_legacy_fields', 'content'],
    schema_v3_wide_lore_retrieval: ['retrieval'],
    schema_v3_missing_context: ['context'],
    schema_v3_invalid_context_scope: ['context'],
    schema_v3_missing_context_sort_keys: ['context'],
    schema_v3_missing_context_precision: ['context'],
    schema_v3_missing_context_label: ['context'],
    schema_v3_missing_retrieval: ['retrieval'],
    schema_v3_incomplete_retrieval: ['retrieval'],
    schema_v3_missing_content: ['content'],
    undefined_tag: ['tags'],
    deprecated_tag_used: ['tags'],
    malformed_tag_namespace: ['tags'],
    broken_anchor_reference: ['context', 'tags'],
    unmatchable_context_gate: ['context', 'tags'],
    invalid_context_window: ['context', 'tags'],
});

const SCHEMA_V3_LEGACY_ENTRY_FIELDS = Object.freeze([
    'date',
    'canonTiming',
    'validFrom',
    'validTo',
    'activeWhen',
    'whoKnowsTruth',
    'whoSuspects',
    'whoBelievesPublicVersion',
    'publicVersion',
    'fact',
]);

export function getAllowedLoredeckRepairOperationNamesForCodes(codes = [], targetHints = {}) {
    const codeSet = new Set(Array.from(codes || []).map(code => cleanRepairString(code, 120)).filter(Boolean));
    if (!codeSet.size) return Object.values(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES);
    const operations = new Set();
    for (const code of codeSet) {
        if (SCHEMA_ENTRY_REPAIR_CODES.has(code)) {
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE);
        } else if (TAG_REPAIR_CODES.has(code)) {
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE);
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TAG_DEFINITION);
        } else if (CONTEXT_REPAIR_CODES.has(code)) {
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE);
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_ANCHOR);
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_WINDOW);
        } else if (MANIFEST_STATS_REPAIR_CODES.has(code)) {
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS);
        }
    }
    if (!operations.size) {
        if ((targetHints.entryIds || targetHints.affectedEntryIds || []).length) {
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE);
        }
        if ((targetHints.tagIds || targetHints.affectedTagIds || []).length) {
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TAG_DEFINITION);
        }
        if ((targetHints.timelineIds || targetHints.affectedTimelineIds || []).length) {
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_ANCHOR);
            operations.add(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_WINDOW);
        }
    }
    return [...operations];
}

export function getAllowedLoredeckRepairEntryFieldsForCodes(codes = []) {
    const codeSet = new Set(Array.from(codes || []).map(code => cleanRepairString(code, 120)).filter(Boolean));
    const fields = new Set();
    for (const code of codeSet) {
        for (const field of ENTRY_FIELD_ALLOWLIST_BY_CODE[code] || []) fields.add(field);
    }
    return [...fields];
}

function getAllowedSets(context = {}) {
    const findings = Array.isArray(context.findings) ? context.findings : [];
    const buckets = Array.isArray(context.buckets) ? context.buckets : [];
    const findingIds = new Set(findings.map(finding => finding.findingId).filter(Boolean));
    const codes = new Set([
        ...findings.map(finding => finding.code).filter(Boolean),
        ...buckets.map(bucket => bucket.code).filter(Boolean),
    ]);
    const entryIds = new Set([
        ...findings.flatMap(finding => finding.entryIds || []),
        ...buckets.flatMap(bucket => bucket.affectedEntryIds || []),
    ]);
    const tagIds = new Set([
        ...findings.flatMap(finding => finding.tagIds || []),
        ...buckets.flatMap(bucket => bucket.affectedTagIds || []),
    ]);
    const timelineIds = new Set([
        ...findings.flatMap(finding => finding.timelineIds || []),
        ...buckets.flatMap(bucket => bucket.affectedTimelineIds || []),
    ]);
    return { findingIds, codes, entryIds, tagIds, timelineIds };
}

function getEntryMap(pack = {}) {
    const entries = new Map();
    const addEntry = entry => {
        const id = cleanRepairString(entry?.id, 180);
        if (id && !entries.has(id)) entries.set(id, entry);
    };
    if (isPlainRepairObject(pack.entryOverrides)) {
        for (const [id, entry] of Object.entries(pack.entryOverrides)) {
            if (isPlainRepairObject(entry)) addEntry({ ...entry, id: entry.id || id });
        }
    }
    for (const entry of Array.isArray(pack.entries) ? pack.entries : []) addEntry(entry);
    for (const file of Array.isArray(pack.entryFiles) ? pack.entryFiles : []) {
        for (const entry of Array.isArray(file.entries) ? file.entries : []) addEntry(entry);
    }
    return entries;
}

function getRegistryTagSet(pack = {}) {
    const registry = isPlainRepairObject(pack.tagRegistry) ? pack.tagRegistry : {};
    const source = isPlainRepairObject(registry.tags) ? registry.tags : registry;
    return new Set(normalizeRepairTagIdList(Object.keys(source || {}), 5000));
}

function getTimelineAnchorSet(pack = {}) {
    const registry = isPlainRepairObject(pack.timelineRegistry) ? pack.timelineRegistry : {};
    return new Set((Array.isArray(registry.anchors) ? registry.anchors : [])
        .map(anchor => normalizeRepairTimelineId(anchor?.id))
        .filter(Boolean));
}

function operationTouchesField(operation = {}, field = '') {
    return (operation.fields || []).some(value => value === field || value.startsWith(`${field}.`));
}

function entryFieldAllowed(field = '', allowedFields = new Set()) {
    if (!field || !allowedFields.size) return true;
    return [...allowedFields].some(allowed => field === allowed || field.startsWith(`${allowed}.`));
}

function isComparableObject(value) {
    return isPlainRepairObject(value);
}

function jsonEqual(a, b) {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function collectChangedEntryPaths(before = {}, after = {}, prefix = '') {
    if (jsonEqual(before, after)) return [];
    const beforeObject = isComparableObject(before);
    const afterObject = isComparableObject(after);
    if (!beforeObject || !afterObject) return [prefix].filter(Boolean);
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const out = [];
    for (const key of keys) {
        const path = prefix ? `${prefix}.${key}` : key;
        const beforeValue = before[key];
        const afterValue = after[key];
        if (jsonEqual(beforeValue, afterValue)) continue;
        if (isComparableObject(beforeValue) && isComparableObject(afterValue)) {
            out.push(...collectChangedEntryPaths(beforeValue, afterValue, path));
        } else {
            out.push(path);
        }
    }
    return out;
}

function repairScopeCoversPath(scope = '', path = '') {
    if (!scope || !path) return false;
    if (scope === path || path.startsWith(`${scope}.`)) return true;
    if (scope === 'schema_v3_legacy_fields') {
        const topLevel = path.split('.')[0];
        return SCHEMA_V3_LEGACY_ENTRY_FIELDS.includes(topLevel);
    }
    return false;
}

function validateModelEntryPayloadScope(out, pack = {}, operation = {}, entryId = '') {
    const before = isPlainRepairObject(operation.before)
        ? operation.before
        : getEntryMap(pack).get(entryId);
    if (!isPlainRepairObject(before)) {
        addDiagnostic(out, 'error', 'repair_missing_current_entry', `Cannot validate model repair payload scope for missing entry ${entryId}.`, { entryId });
        return;
    }
    const scopes = operation.fields || [];
    const changedPaths = collectChangedEntryPaths(before, operation.entry);
    for (const path of changedPaths) {
        if (scopes.some(scope => repairScopeCoversPath(scope, path))) continue;
        addDiagnostic(out, 'error', 'repair_payload_field_not_declared', `Model repair changes ${path} on ${entryId} outside declared field scope.`, { entryId, field: path });
    }
}

function addDiagnostic(out, severity, code, message, extra = {}) {
    out.diagnostics.push({
        severity,
        code,
        message,
        ...extra,
    });
    if (severity === 'error') out.blocking.push(message);
    else out.warnings.push(message);
}

function validateEntryOperation(out, pack = {}, operation = {}, allowed = {}, source = '') {
    const entryId = cleanRepairString(operation.entryId || operation.entry?.id, 180);
    if (!entryId) {
        addDiagnostic(out, 'error', 'repair_missing_entry_id', 'Entry repair operation is missing entryId.');
        return;
    }
    if (allowed.entryIds.size && !allowed.entryIds.has(entryId)) {
        addDiagnostic(out, 'error', 'repair_unrelated_entry', `Repair operation targets unrelated entry ${entryId}.`, { entryId });
    }
    const entry = isPlainRepairObject(operation.entry) ? operation.entry : null;
    if (!entry) {
        addDiagnostic(out, 'error', 'repair_missing_entry_payload', `Entry repair operation for ${entryId} is missing entry payload.`, { entryId });
        return;
    }
    if (cleanRepairString(entry.id || entryId, 180) !== entryId) {
        addDiagnostic(out, 'error', 'repair_entry_id_mismatch', `Entry repair payload id does not match operation id ${entryId}.`, { entryId });
    }
    const allowedFields = new Set(getAllowedLoredeckRepairEntryFieldsForCodes(allowed.codes));
    if (allowed.codes.size && allowedFields.size && !operation.fields.length) {
        addDiagnostic(out, 'error', 'repair_missing_field_scope', `Entry repair operation for ${entryId} is missing field scope.`, { entryId });
    }
    for (const field of operation.fields || []) {
        if (!entryFieldAllowed(field, allowedFields)) {
            addDiagnostic(out, 'error', 'repair_field_not_allowed_for_finding', `Repair field ${field} is not allowed for ${[...allowed.codes].join(', ')}.`, { entryId, field });
        }
    }
    if (source === LOREDECK_HEALTH_REPAIR_SOURCES.MODEL) {
        validateModelEntryPayloadScope(out, pack, operation, entryId);
    }
    const expectedSchema = Number(pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion || entry.schemaVersion) || 0;
    if (expectedSchema >= 3 || Number(entry.schemaVersion) >= 3) {
        const errors = validateSchemaV3EntryShape({ ...entry, schemaVersion: 3 });
        for (const error of errors) {
            addDiagnostic(out, 'error', 'repair_schema_v3_invalid_entry', `${entryId}: ${error}`, { entryId });
        }
    }
    if (operationTouchesField(operation, 'tags')) {
        const registrySet = getRegistryTagSet(pack);
        if (registrySet.size) {
            for (const tag of normalizeRepairTagIdList(entry.tags || [], 256)) {
                if (!registrySet.has(tag)) {
                    addDiagnostic(out, 'error', 'repair_unknown_tag', `Repair operation leaves unknown tag ${tag} on ${entryId}.`, { entryId, tag });
                }
            }
        }
    }
    if (operationTouchesField(operation, 'context')) {
        const anchorSet = getTimelineAnchorSet(pack);
        if (anchorSet.size && isPlainRepairObject(entry.context)) {
            for (const field of ['anchorId', 'validFromAnchor', 'validToAnchor']) {
                const anchor = normalizeRepairTimelineId(entry.context[field]);
                if (anchor && !anchorSet.has(anchor)) {
                    addDiagnostic(out, 'error', 'repair_unknown_context_anchor', `Repair operation leaves unknown Context anchor ${anchor} on ${entryId}.`, { entryId, anchor, field });
                }
            }
        }
    }
}

function validateManifestStatsOperation(out, operation = {}, allowed = {}) {
    if (allowed.codes.size && ![...allowed.codes].some(code => MANIFEST_STATS_REPAIR_CODES.has(code))) {
        addDiagnostic(out, 'error', 'repair_unrelated_manifest_stats', 'Manifest stats repair is not tied to a manifest stats finding.');
    }
    if (!isPlainRepairObject(operation.stats)) {
        addDiagnostic(out, 'error', 'repair_missing_manifest_stats', 'Manifest stats repair is missing stats payload.');
        return;
    }
    const entryCount = Number(operation.stats.entryCount);
    if (!Number.isInteger(entryCount) || entryCount < 0) {
        addDiagnostic(out, 'error', 'repair_invalid_manifest_entry_count', 'Manifest stats repair has invalid entryCount.');
    }
    const categoryCounts = operation.stats.categoryCounts;
    if (categoryCounts !== undefined && !isPlainRepairObject(categoryCounts)) {
        addDiagnostic(out, 'error', 'repair_invalid_manifest_category_counts', 'Manifest stats repair categoryCounts must be an object.');
    } else if (isPlainRepairObject(categoryCounts)) {
        for (const [category, raw] of Object.entries(categoryCounts)) {
            const count = Number(raw);
            if (!cleanRepairString(category, 80) || !Number.isInteger(count) || count < 0) {
                addDiagnostic(out, 'error', 'repair_invalid_manifest_category_count', `Manifest stats repair has invalid category count for ${category || '(blank)'}.`, { category });
            }
        }
    }
}

function validateRepairOperation(out, pack = {}, operation = {}, allowed = {}, source = '') {
    const operationAllowlist = new Set(getAllowedLoredeckRepairOperationNamesForCodes(allowed.codes, {
        entryIds: [...allowed.entryIds],
        tagIds: [...allowed.tagIds],
        timelineIds: [...allowed.timelineIds],
    }));
    if (allowed.codes.size && operationAllowlist.size && !operationAllowlist.has(operation.op)) {
        addDiagnostic(
            out,
            'error',
            'repair_operation_not_allowed_for_finding',
            `Repair operation ${operation.op || '(missing)'} is not allowed for ${[...allowed.codes].join(', ')}.`
        );
    }
    if (operation.requiresConfirmation) {
        addDiagnostic(out, 'error', 'repair_requires_confirmation', 'Repair operation requires explicit confirmation before direct apply.');
    }
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE) {
        validateEntryOperation(out, pack, operation, allowed, source);
        return;
    }
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TAG_DEFINITION) {
        if (allowed.tagIds.size && !allowed.tagIds.has(operation.tagId)) {
            addDiagnostic(out, 'error', 'repair_unrelated_tag', `Repair operation targets unrelated tag ${operation.tagId}.`, { tagId: operation.tagId });
        }
        return;
    }
    if ([LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_ANCHOR, LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_WINDOW].includes(operation.op)) {
        if (allowed.timelineIds.size && !allowed.timelineIds.has(operation.timelineId)) {
            addDiagnostic(out, 'error', 'repair_unrelated_timeline', `Repair operation targets unrelated timeline id ${operation.timelineId}.`, { timelineId: operation.timelineId });
        }
        return;
    }
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS) {
        validateManifestStatsOperation(out, operation, allowed);
        return;
    }
    addDiagnostic(out, 'error', 'repair_unsupported_operation', `Unsupported repair operation ${operation.op || '(missing)'}.`);
}

export function validateLoredeckRepairPatch(pack = {}, patch = {}, context = {}) {
    const normalized = normalizeRepairPatch(patch);
    const out = {
        ok: true,
        directApply: normalized.directApply !== false,
        diagnostics: [],
        warnings: [],
        blocking: [],
        patch: normalized,
    };
    const allowed = getAllowedSets(context);
    if (!normalized.operations.length) {
        addDiagnostic(out, 'error', 'repair_empty_patch', 'Repair patch has no operations.');
    }
    if (allowed.findingIds.size) {
        for (const id of normalized.findingIds || []) {
            if (!allowed.findingIds.has(id)) {
                addDiagnostic(out, 'error', 'repair_unrelated_finding', `Repair patch references unrelated finding ${id}.`, { findingId: id });
            }
        }
    }
    for (const operation of normalized.operations) validateRepairOperation(out, pack, operation, allowed, normalized.source);
    out.ok = out.blocking.length === 0;
    out.directApply = out.directApply && out.ok;
    return out;
}

export function validateLoredeckRepairChoiceSet(pack = {}, choiceSet = {}, context = {}) {
    const normalized = normalizeRepairChoiceSet(choiceSet);
    const allowed = getAllowedSets(context);
    const out = {
        ok: true,
        choiceSet: normalized,
        optionResults: [],
        diagnostics: [],
        warnings: [],
        blocking: [],
    };
    if (!normalized.options.length) {
        addDiagnostic(out, 'error', 'repair_choice_empty', 'Repair choice set has no options.');
    }
    if (allowed.findingIds.size) {
        for (const findingId of normalized.findingIds || []) {
            if (!allowed.findingIds.has(findingId)) {
                addDiagnostic(out, 'error', 'repair_choice_unrelated_finding', `Repair choice set references unrelated finding ${findingId}.`, { findingId });
            }
        }
    }
    const seenOptions = new Set();
    const optionResults = [];
    for (const option of normalized.options) {
        if (seenOptions.has(option.optionId)) {
            addDiagnostic(out, 'error', 'repair_choice_duplicate_option', `Repair choice set has duplicate option ${option.optionId}.`, { optionId: option.optionId });
        }
        seenOptions.add(option.optionId);
        const result = validateLoredeckRepairPatch(pack, option.patch, context);
        optionResults.push({ optionId: option.optionId, result });
        if (!result.ok) {
            out.diagnostics.push(...result.diagnostics);
            out.blocking.push(...result.blocking);
            out.warnings.push(...result.warnings);
        }
    }
    out.optionResults = optionResults;
    out.ok = out.blocking.length === 0 && optionResults.length > 0 && optionResults.every(item => item.result.ok);
    return out;
}
