/**
 * Storage-neutral local Pack Health repair patch builders.
 */

import {
    normalizeLoredeckEntryForSchemaV3,
    repairLoredeckEntryForHealth,
} from './schema-v3-health.js';
import {
    repairSchemaV3ContextAnchors,
    repairSchemaV3EntryTags,
} from './loredeck-schema-v3-entry-repair.js';
import {
    LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
    LOREDECK_HEALTH_REPAIR_SOURCES,
    LOREDECK_HEALTH_REPAIR_STRATEGIES,
    cleanRepairString,
    cloneRepairJson,
    compactRepairIdentity,
    hashRepairText,
    isPlainRepairObject,
    normalizeRepairChoiceSet,
    normalizeRepairIdList,
    normalizeRepairPatch,
    normalizeRepairTagId,
    normalizeRepairTagIdList,
    normalizeRepairTimelineId,
} from './loredeck-health-repair-contracts.js';

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

const MANIFEST_REPAIR_CODES = new Set([
    'manifest_entry_count_mismatch',
    'manifest_category_counts_mismatch',
]);

const RETRIEVAL_SCHEMA_REPAIR_CODES = new Set([
    'schema_v3_missing_retrieval',
    'schema_v3_incomplete_retrieval',
]);

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

function getEntryRecordsForStats(pack = {}) {
    return [...getEntryMap(pack).values()];
}

function getPackTagIds(pack = {}) {
    const registry = isPlainRepairObject(pack.tagRegistry) ? pack.tagRegistry : {};
    const source = isPlainRepairObject(registry.tags) ? registry.tags : registry;
    return normalizeRepairTagIdList(Object.keys(source || {}), 5000);
}

function buildCompactTagGroups(pack = {}) {
    const groups = new Map();
    for (const id of getPackTagIds(pack)) {
        const key = compactRepairIdentity(id);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(id);
    }
    for (const [key, values] of groups.entries()) groups.set(key, [...new Set(values)].sort());
    return groups;
}

function getEntryIdsForBucket(pack = {}, bucket = {}) {
    const entryIds = new Set(bucket.affectedEntryIds || []);
    if (!bucket.affectedTagIds?.length) return [...entryIds];
    const wanted = new Set((bucket.affectedTagIds || []).map(normalizeRepairTagId));
    for (const [entryId, entry] of getEntryMap(pack).entries()) {
        const tags = normalizeRepairTagIdList(entry.tags || [], 256);
        if (tags.some(tag => wanted.has(tag))) entryIds.add(entryId);
    }
    return normalizeRepairIdList([...entryIds]);
}

function createPatch(source, strategy, findingIds, operations, diagnostics = [], risk = 'low') {
    return normalizeRepairPatch({
        source,
        strategy,
        findingIds,
        confidence: source === LOREDECK_HEALTH_REPAIR_SOURCES.LOCAL ? 1 : 0,
        risk,
        operations,
        diagnostics,
    });
}

function buildSchemaV3PatchBase(pack = {}, raw = {}) {
    const base = Number(raw.schemaVersion || pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) >= 3
        ? normalizeLoredeckEntryForSchemaV3(raw)
        : cloneRepairJson(raw);
    const tagRepair = repairSchemaV3EntryTags(base, pack, { rejectUnknownTags: false });
    if (tagRepair.changed && !tagRepair.errors.length) {
        base.tags = tagRepair.tags;
    }
    return {
        entry: base,
        tagFieldsChanged: tagRepair.changed && !tagRepair.errors.length,
        tagDiagnostics: tagRepair.warnings || [],
    };
}

function sortPlainCounts(counts = {}) {
    return Object.fromEntries(Object.entries(counts)
        .filter(([key, value]) => key && Number.isFinite(Number(value)))
        .map(([key, value]) => [key, Number(value)])
        .sort((a, b) => a[0].localeCompare(b[0])));
}

function computeManifestStats(pack = {}) {
    const entries = getEntryRecordsForStats(pack);
    const categoryCounts = {};
    for (const entry of entries) {
        const category = cleanRepairString(entry?.category || 'other', 80) || 'other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
    const manifestStats = isPlainRepairObject(pack.manifestData?.stats) ? pack.manifestData.stats : {};
    const packStats = isPlainRepairObject(pack.stats) ? pack.stats : {};
    return {
        ...cloneRepairJson(packStats),
        ...cloneRepairJson(manifestStats),
        entryCount: entries.length,
        categoryCounts: sortPlainCounts(categoryCounts),
    };
}

function getCurrentManifestStats(pack = {}) {
    if (isPlainRepairObject(pack.manifestData?.stats)) return cloneRepairJson(pack.manifestData.stats);
    if (isPlainRepairObject(pack.stats)) return cloneRepairJson(pack.stats);
    return {};
}

function getSchemaRepairFields(raw = {}, repaired = {}, code = '') {
    const fields = [];
    if (code === 'schema_v3_legacy_timing_fields') {
        fields.push('schema_v3_legacy_fields', 'content');
    }
    if (JSON.stringify(raw.content || null) !== JSON.stringify(repaired.content || null) && !fields.includes('content')) {
        fields.push('content');
    }
    if (JSON.stringify(raw.retrieval || null) !== JSON.stringify(repaired.retrieval || null)) {
        fields.push('retrieval');
    }
    return fields.length ? fields : ['entry'];
}

function isWideSchemaV3Entry(entry = {}) {
    const context = isPlainRepairObject(entry.context) ? entry.context : {};
    const from = Number(context.sortKeyFrom);
    const to = Number(context.sortKeyTo);
    const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from + 1) : null;
    return context.scope === 'global'
        || ['series', 'wide'].includes(cleanRepairString(context.windowKind, 80))
        || (span !== null && span >= 365);
}

function buildDefaultSchemaV3Retrieval(entry = {}) {
    const current = isPlainRepairObject(entry.retrieval) ? entry.retrieval : {};
    if (isWideSchemaV3Entry(entry)) {
        return {
            ...current,
            activation: current.activation || 'topic_or_entity',
            frequency: current.frequency || 'low',
            contextBoost: current.contextBoost || 'low',
        };
    }
    return {
        ...current,
        activation: current.activation || 'context_or_topic',
        frequency: current.frequency || 'normal',
        contextBoost: current.contextBoost || 'high',
    };
}

function repairEntryForSchemaHealthCode(pack = {}, raw = {}, entryId = '', code = '') {
    const input = {
        ...cloneRepairJson(raw),
        id: raw.id || entryId,
    };
    if (code === 'schema_v3_wide_lore_retrieval') {
        return buildSchemaV3PatchBase(pack, repairLoredeckEntryForHealth(input, { forceSchemaVersion: 3 })).entry;
    }
    if (RETRIEVAL_SCHEMA_REPAIR_CODES.has(code)) {
        const base = buildSchemaV3PatchBase(pack, input).entry;
        return {
            ...base,
            retrieval: buildDefaultSchemaV3Retrieval(input),
        };
    }
    return buildSchemaV3PatchBase(pack, input).entry;
}

function buildSchemaHealthPatch(pack = {}, bucket = {}) {
    const entryMap = getEntryMap(pack);
    const operations = [];
    for (const entryId of bucket.affectedEntryIds || []) {
        const raw = entryMap.get(entryId);
        if (!raw) continue;
        const repaired = repairEntryForSchemaHealthCode(pack, raw, entryId, bucket.code);
        if (JSON.stringify(repaired) === JSON.stringify(raw)) continue;
        operations.push({
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
            entryId,
            fields: getSchemaRepairFields(raw, repaired, bucket.code),
            entry: repaired,
            before: raw,
            after: repaired,
        });
    }
    if (!operations.length) return null;
    const target = bucket.code === 'schema_v3_wide_lore_retrieval'
        ? 'wide retrieval'
        : 'schema v3 cleanup';
    return createPatch(
        LOREDECK_HEALTH_REPAIR_SOURCES.LOCAL,
        LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
        bucket.findingIds,
        operations,
        [`Prepared ${target} repair for ${operations.length} entr${operations.length === 1 ? 'y' : 'ies'}.`]
    );
}

function buildManifestStatsPatch(pack = {}, bucket = {}) {
    const currentStats = getCurrentManifestStats(pack);
    const computedStats = computeManifestStats(pack);
    if (JSON.stringify(currentStats) === JSON.stringify(computedStats)) return null;
    const operationFields = [
        'stats.entryCount',
        'stats.categoryCounts',
    ];
    return createPatch(
        LOREDECK_HEALTH_REPAIR_SOURCES.LOCAL,
        LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
        bucket.findingIds,
        [{
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS,
            fields: operationFields,
            stats: computedStats,
            before: currentStats,
            after: computedStats,
        }],
        [`Prepared manifest stats refresh for ${computedStats.entryCount} loaded Lorecard${computedStats.entryCount === 1 ? '' : 's'}.`]
    );
}

function buildTagRepairPatch(pack = {}, bucket = {}) {
    const entryMap = getEntryMap(pack);
    const wantedTags = new Set((bucket.affectedTagIds || []).map(normalizeRepairTagId));
    const operations = [];
    const diagnostics = [];
    for (const entryId of getEntryIdsForBucket(pack, bucket)) {
        const raw = entryMap.get(entryId);
        if (!raw) continue;
        const entryTags = normalizeRepairTagIdList(raw.tags || [], 256);
        if (wantedTags.size && !entryTags.some(tag => wantedTags.has(tag))) continue;
        const repair = repairSchemaV3EntryTags(raw, pack, { rejectUnknownTags: false });
        if (!repair.changed || repair.errors.length) continue;
        const base = buildSchemaV3PatchBase(pack, raw).entry;
        const repaired = {
            ...base,
            id: raw.id || entryId,
            tags: repair.tags,
            userEdited: true,
        };
        operations.push({
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
            entryId,
            fields: ['tags'],
            entry: repaired,
            before: raw,
            after: repaired,
        });
        diagnostics.push(...repair.warnings);
    }
    if (!operations.length) return null;
    return createPatch(
        LOREDECK_HEALTH_REPAIR_SOURCES.LOCAL,
        LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
        bucket.findingIds,
        operations,
        [...new Set(diagnostics)]
    );
}

function buildContextRepairPatch(pack = {}, bucket = {}) {
    const entryMap = getEntryMap(pack);
    const wantedAnchors = new Set((bucket.affectedTimelineIds || []).map(normalizeRepairTimelineId));
    const operations = [];
    const diagnostics = [];
    for (const entryId of bucket.affectedEntryIds || []) {
        const raw = entryMap.get(entryId);
        if (!raw) continue;
        const context = isPlainRepairObject(raw.context) ? raw.context : {};
        const rawAnchors = ['anchorId', 'validFromAnchor', 'validToAnchor'].map(field => normalizeRepairTimelineId(context[field]));
        if (wantedAnchors.size && !rawAnchors.some(anchor => wantedAnchors.has(anchor))) continue;
        const repair = repairSchemaV3ContextAnchors(context, pack, { rejectUnknownAnchors: false });
        if (!repair.changed || repair.errors.length) continue;
        const baseResult = buildSchemaV3PatchBase(pack, raw);
        const base = baseResult.entry;
        const repaired = {
            ...base,
            id: raw.id || entryId,
            context: repair.context,
            userEdited: true,
        };
        operations.push({
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
            entryId,
            fields: baseResult.tagFieldsChanged ? ['context', 'tags'] : ['context'],
            entry: repaired,
            before: raw,
            after: repaired,
        });
        diagnostics.push(...repair.warnings, ...baseResult.tagDiagnostics);
    }
    if (!operations.length) return null;
    return createPatch(
        LOREDECK_HEALTH_REPAIR_SOURCES.LOCAL,
        LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
        bucket.findingIds,
        operations,
        [...new Set(diagnostics)]
    );
}

function buildTagChoiceSets(pack = {}, bucket = {}) {
    const entryMap = getEntryMap(pack);
    const compactGroups = buildCompactTagGroups(pack);
    const choices = [];
    for (const rawTag of bucket.affectedTagIds || []) {
        const tag = normalizeRepairTagId(rawTag);
        const candidates = compactGroups.get(compactRepairIdentity(tag)) || [];
        if (candidates.length < 2) continue;
        const affectedEntryIds = getEntryIdsForBucket(pack, { ...bucket, affectedTagIds: [tag] });
        const options = candidates.map((candidate, index) => {
            const operations = [];
            for (const entryId of affectedEntryIds) {
                const raw = entryMap.get(entryId);
                if (!raw) continue;
                const tags = normalizeRepairTagIdList(raw.tags || [], 256);
                if (!tags.includes(tag)) continue;
                const repairedTags = tags.map(value => value === tag ? candidate : value);
                const base = buildSchemaV3PatchBase(pack, raw).entry;
                const repaired = {
                    ...base,
                    id: raw.id || entryId,
                    tags: [...new Set(repairedTags)],
                    userEdited: true,
                };
                operations.push({
                    op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
                    entryId,
                    fields: ['tags'],
                    entry: repaired,
                    before: raw,
                    after: repaired,
                });
            }
            return {
                optionId: String.fromCharCode(65 + index),
                label: candidate,
                confidence: 0.5,
                reason: `Map ${tag} to registry tag ${candidate}.`,
                patch: createPatch(
                    LOREDECK_HEALTH_REPAIR_SOURCES.USER_CHOICE,
                    LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE,
                    bucket.findingIds,
                    operations,
                    [`User selected registry tag ${candidate} for ${tag}.`],
                    'medium'
                ),
            };
        }).filter(option => option.patch.operations.length);
        if (!options.length) continue;
        choices.push(normalizeRepairChoiceSet({
            choiceSetId: `choice_tag_${hashRepairText(`${tag}|${bucket.bucketId}`)}`,
            findingIds: bucket.findingIds,
            severity: bucket.severity,
            code: bucket.code,
            question: `Which registry tag should replace ${tag}?`,
            reason: 'The compact tag ID matches multiple registry tags.',
            options,
        }));
    }
    return choices;
}

function getAnchorCandidateOptions(pack = {}, raw = {}, candidate = {}) {
    const candidates = candidate.to
        ? [candidate.to]
        : Array.isArray(candidate.candidates) ? candidate.candidates : [];
    return candidates.map((anchorId, index) => ({
        optionId: String.fromCharCode(65 + index),
        label: anchorId,
        confidence: candidate.to ? 0.75 : 0.5,
        reason: candidate.reason === 'sort_key_match'
            ? `Use timeline anchor ${anchorId} because it shares sort key ${candidate.sortKey}.`
            : `Use timeline anchor ${anchorId}.`,
        anchorId,
    }));
}

function buildContextChoiceSets(pack = {}, bucket = {}) {
    const entryMap = getEntryMap(pack);
    const choices = [];
    const wantedAnchors = new Set((bucket.affectedTimelineIds || []).map(normalizeRepairTimelineId));
    for (const entryId of bucket.affectedEntryIds || []) {
        const raw = entryMap.get(entryId);
        if (!raw) continue;
        const repair = repairSchemaV3ContextAnchors(raw.context, pack, { rejectUnknownAnchors: false });
        for (const candidate of repair.reviewCandidates || []) {
            if (wantedAnchors.size && !wantedAnchors.has(normalizeRepairTimelineId(candidate.from))) continue;
            const options = getAnchorCandidateOptions(pack, raw, candidate).map(option => {
                const repairedContext = {
                    ...(isPlainRepairObject(raw.context) ? raw.context : {}),
                    [candidate.field]: option.anchorId,
                };
                const baseResult = buildSchemaV3PatchBase(pack, raw);
                const base = baseResult.entry;
                const repaired = {
                    ...base,
                    id: raw.id || entryId,
                    context: repairedContext,
                    userEdited: true,
                };
                return {
                    optionId: option.optionId,
                    label: option.label,
                    confidence: option.confidence,
                    reason: option.reason,
                    patch: createPatch(
                        LOREDECK_HEALTH_REPAIR_SOURCES.USER_CHOICE,
                        LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE,
                        bucket.findingIds,
                        [{
                            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
                            entryId,
                            fields: baseResult.tagFieldsChanged ? [`context.${candidate.field}`, 'tags'] : [`context.${candidate.field}`],
                            entry: repaired,
                            before: raw,
                            after: repaired,
                        }],
                        [`User selected Context anchor ${option.anchorId} for ${entryId}.`],
                        'medium'
                    ),
                };
            });
            if (!options.length) continue;
            choices.push(normalizeRepairChoiceSet({
                choiceSetId: `choice_anchor_${hashRepairText(`${entryId}|${candidate.field}|${candidate.from}|${bucket.bucketId}`)}`,
                findingIds: bucket.findingIds,
                severity: bucket.severity,
                code: bucket.code,
                question: `Which Context anchor should replace ${candidate.from}?`,
                reason: candidate.reason === 'sort_key_match'
                    ? 'Saga found timeline candidates with matching sort keys but should not silently choose story semantics.'
                    : 'Saga found multiple possible Context anchor replacements.',
                options,
            }));
        }
    }
    return choices;
}

export function buildLoredeckLocalRepairForBucket(pack = {}, bucket = {}) {
    const patches = [];
    const choiceSets = [];
    const diagnostics = [];
    if (bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK) {
        let patch = null;
        if (bucket.code === 'schema_v3_legacy_timing_fields'
            || bucket.code === 'schema_v3_wide_lore_retrieval'
            || RETRIEVAL_SCHEMA_REPAIR_CODES.has(bucket.code)
            || bucket.code === 'schema_v3_missing_content') {
            patch = buildSchemaHealthPatch(pack, bucket);
        } else if (MANIFEST_REPAIR_CODES.has(bucket.code)) {
            patch = buildManifestStatsPatch(pack, bucket);
        } else if (TAG_REPAIR_CODES.has(bucket.code)) {
            patch = buildTagRepairPatch(pack, bucket);
        } else if (CONTEXT_REPAIR_CODES.has(bucket.code)) {
            patch = buildContextRepairPatch(pack, bucket);
        }
        if (patch) patches.push(patch);
        else diagnostics.push(`No local patch built for ${bucket.code}.`);
    } else if (bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE) {
        if (TAG_REPAIR_CODES.has(bucket.code)) choiceSets.push(...buildTagChoiceSets(pack, bucket));
        else if (CONTEXT_REPAIR_CODES.has(bucket.code)) choiceSets.push(...buildContextChoiceSets(pack, bucket));
        if (!choiceSets.length) diagnostics.push(`No review choices built for ${bucket.code}.`);
    }
    return { patches, choiceSets, diagnostics };
}

export function buildLoredeckLocalRepairsForPlan(pack = {}, plan = {}) {
    const result = {
        patches: [],
        choiceSets: [],
        diagnostics: [],
    };
    for (const bucket of Array.isArray(plan.buckets) ? plan.buckets : []) {
        if (![
            LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
            LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE,
        ].includes(bucket.strategy)) continue;
        const bucketResult = buildLoredeckLocalRepairForBucket(pack, bucket);
        result.patches.push(...bucketResult.patches);
        result.choiceSets.push(...bucketResult.choiceSets);
        result.diagnostics.push(...bucketResult.diagnostics);
    }
    return result;
}

export const __loredeckHealthLocalRepairsTestHooks = Object.freeze({
    getEntryMap,
    computeManifestStats,
    buildDefaultSchemaV3Retrieval,
    buildSchemaHealthPatch,
    buildManifestStatsPatch,
    buildTagRepairPatch,
    buildContextRepairPatch,
    buildTagChoiceSets,
    buildContextChoiceSets,
});
