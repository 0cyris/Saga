/**
 * Storage-neutral Pack Health repair planner.
 */

import {
    normalizeLoredeckEntryForSchemaV3,
} from './schema-v3-health.js';
import {
    validateSchemaV3EntryShape,
} from './loredeck-schema-v3-entry-repair.js';
import {
    LOREDECK_HEALTH_REPAIR_STRATEGIES,
    cleanRepairId,
    cleanRepairString,
    cloneRepairJson,
    compactRepairIdentity,
    createRepairPlanSummary,
    hashRepairText,
    isPlainRepairObject,
    normalizeRepairBucket,
    normalizeRepairFindingsFromHealth,
    normalizeRepairIdList,
    normalizeRepairTagId,
    normalizeRepairTagIdList,
    normalizeRepairTimelineId,
    normalizeRepairTimelineIdList,
} from './loredeck-health-repair-contracts.js';

const LOCAL_SCHEMA_CODES = new Set([
    'schema_v3_legacy_timing_fields',
    'schema_v3_wide_lore_retrieval',
]);

const LOCAL_RETRIEVAL_SCHEMA_CODES = new Set([
    'schema_v3_missing_retrieval',
    'schema_v3_incomplete_retrieval',
]);

const LOCAL_MANIFEST_CODES = new Set([
    'manifest_entry_count_mismatch',
    'manifest_category_counts_mismatch',
]);

const MODEL_SCHEMA_CODES = new Set([
    'schema_v3_missing_context',
    'schema_v3_invalid_context_scope',
    'schema_v3_missing_context_sort_keys',
    'schema_v3_missing_context_precision',
    'schema_v3_missing_context_label',
    'schema_v3_missing_content',
]);

const CONTEXT_CODES = new Set([
    'broken_anchor_reference',
    'unmatchable_context_gate',
    'invalid_context_window',
]);

const MANUAL_DEFAULT_CODES = new Set([
    'orphaned_tag_definition',
    'context_timeline_empty',
    'timeline_candidate_sparse',
    'timeline_anchor_coverage_sparse',
    'timeline_anchor_coverage_concentrated',
    'timeline_windows_missing',
]);

export const DEFAULT_REPAIR_BATCH_LIMITS = Object.freeze({
    modelEntryLimit: 8,
    modelTagLimit: 15,
    modelTimelineLimit: 5,
    modelUnitLimit: 8,
});

function getPackId(pack = {}, health = {}) {
    return cleanRepairId(pack?.packId || health?.packId || health?.databaseId || '', 180);
}

function getPackTagIds(pack = {}) {
    const registry = isPlainRepairObject(pack.tagRegistry) ? pack.tagRegistry : {};
    const source = isPlainRepairObject(registry.tags) ? registry.tags : registry;
    return normalizeRepairTagIdList(Object.keys(source || {}), 5000);
}

function getPackAnchorRecords(pack = {}) {
    const registry = isPlainRepairObject(pack.timelineRegistry) ? pack.timelineRegistry : {};
    return (Array.isArray(registry.anchors) ? registry.anchors : [])
        .map(anchor => {
            const id = normalizeRepairTimelineId(anchor?.id);
            if (!id) return null;
            const sortKey = Number(anchor?.sortKey);
            return {
                id,
                label: cleanRepairString(anchor?.label || anchor?.title || id, 180),
                sortKey: Number.isFinite(sortKey) ? sortKey : null,
            };
        })
        .filter(Boolean);
}

function buildCompactGroups(ids = []) {
    const groups = new Map();
    for (const id of ids) {
        const key = compactRepairIdentity(id);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(id);
    }
    for (const [key, values] of groups.entries()) {
        groups.set(key, [...new Set(values)].sort());
    }
    return groups;
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

function hasNonEmptyRepairString(value = '') {
    return typeof value === 'string' && value.trim().length > 0;
}

function canRepairMissingContentLocally(pack = {}, finding = {}) {
    const entryMap = getEntryMap(pack);
    if (!finding.entryIds?.length) return false;
    return finding.entryIds.every(entryId => {
        const entry = entryMap.get(entryId);
        if (!entry) return false;
        const repaired = normalizeLoredeckEntryForSchemaV3(entry);
        return hasNonEmptyRepairString(repaired.content?.fact)
            && hasNonEmptyRepairString(repaired.content?.injection)
            && JSON.stringify(repaired.content || null) !== JSON.stringify(entry.content || null);
    });
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

function canRepairRetrievalLocally(pack = {}, finding = {}) {
    const entryMap = getEntryMap(pack);
    if (!finding.entryIds?.length) return false;
    return finding.entryIds.every(entryId => {
        const entry = entryMap.get(entryId);
        if (!entry) return false;
        const repaired = {
            ...entry,
            schemaVersion: 3,
            retrieval: buildDefaultSchemaV3Retrieval(entry),
        };
        return JSON.stringify(repaired.retrieval || null) !== JSON.stringify(entry.retrieval || null)
            && validateSchemaV3EntryShape(repaired).length === 0;
    });
}

function collectEntryIdsForTags(pack = {}, tagIds = []) {
    if (!tagIds.length) return [];
    const wanted = new Set(tagIds.map(normalizeRepairTagId));
    const out = [];
    for (const [entryId, entry] of getEntryMap(pack).entries()) {
        const tags = normalizeRepairTagIdList(entry.tags || [], 256);
        if (tags.some(tag => wanted.has(tag))) out.push(entryId);
    }
    return normalizeRepairIdList(out);
}

function getContextFieldsForFinding(finding = {}) {
    const out = [];
    for (const field of finding.fields || []) {
        if (['anchorId', 'validFromAnchor', 'validToAnchor'].includes(field)) out.push(field);
    }
    if (!out.length && finding.timelineIds?.length) out.push('anchorId', 'validFromAnchor', 'validToAnchor');
    return [...new Set(out)];
}

function getRawTimelineIdsForFinding(finding = {}) {
    const raw = isPlainRepairObject(finding.raw) ? finding.raw : {};
    return [
        raw.anchorId || '',
        raw.timelineWindowId || '',
        ...(Array.isArray(raw.anchorIds) ? raw.anchorIds : []),
        ...(Array.isArray(raw.timelineIds) ? raw.timelineIds : []),
    ].map(value => cleanRepairString(value, 180)).filter(Boolean);
}

function classifyTags(pack = {}, finding = {}) {
    const registryIds = getPackTagIds(pack);
    const registrySet = new Set(registryIds);
    const compactGroups = buildCompactGroups(registryIds);
    const direct = [];
    const choices = [];
    const model = [];
    for (const tag of finding.tagIds || []) {
        if (!tag || registrySet.has(tag)) continue;
        const candidates = compactGroups.get(compactRepairIdentity(tag)) || [];
        if (candidates.length === 1) direct.push(tag);
        else if (candidates.length > 1) choices.push(tag);
        else model.push(tag);
    }
    return {
        direct: normalizeRepairTagIdList(direct),
        choices: normalizeRepairTagIdList(choices),
        model: normalizeRepairTagIdList(model),
    };
}

function classifyAnchors(pack = {}, finding = {}) {
    const anchorRecords = getPackAnchorRecords(pack);
    const anchorIds = anchorRecords.map(anchor => anchor.id);
    const normalizedMap = new Map(anchorIds.map(id => [normalizeRepairTimelineId(id), id]));
    const exact = [];
    const choices = [];
    const model = [];
    const rawTimelineIds = getRawTimelineIdsForFinding(finding);
    for (let index = 0; index < (finding.timelineIds || []).length; index += 1) {
        const id = finding.timelineIds[index];
        const rawId = rawTimelineIds[index] || id;
        if (!id) continue;
        if (anchorIds.includes(id) && rawId !== id) {
            exact.push(id);
            continue;
        }
        if (anchorIds.includes(id)) continue;
        const normalized = normalizeRepairTimelineId(id);
        const exactTarget = normalizedMap.get(normalized);
        if (exactTarget && exactTarget !== id) {
            exact.push(id);
            continue;
        }
        const fields = getContextFieldsForFinding(finding);
        const entryMap = getEntryMap(pack);
        let hasCandidate = false;
        for (const entryId of finding.entryIds || []) {
            const entry = entryMap.get(entryId);
            const context = isPlainRepairObject(entry?.context) ? entry.context : {};
            for (const field of fields) {
                const raw = cleanRepairString(context[field] || '', 180);
                if (raw !== id) continue;
                const sortKey = field === 'validToAnchor'
                    ? Number(context.sortKeyTo)
                    : field === 'validFromAnchor'
                        ? Number(context.sortKeyFrom)
                        : Number.isFinite(Number(context.sortKeyFrom)) && Number(context.sortKeyFrom) === Number(context.sortKeyTo)
                            ? Number(context.sortKeyFrom)
                            : null;
                if (Number.isFinite(sortKey) && anchorRecords.some(anchor => anchor.sortKey === sortKey)) {
                    hasCandidate = true;
                }
            }
        }
        if (hasCandidate) choices.push(id);
        else model.push(id);
    }
    return {
        exact: normalizeRepairTimelineIdList(exact),
        choices: normalizeRepairTimelineIdList(choices),
        model: normalizeRepairTimelineIdList(model),
    };
}

function createBucket(raw, findingsById) {
    return normalizeRepairBucket(raw, findingsById);
}

function addBucket(buckets, raw, findingsById) {
    const bucket = createBucket(raw, findingsById);
    if (!bucket.findingIds.length) return;
    buckets.push(bucket);
}

function appendBucketsForFinding(buckets, finding, pack, findingsById) {
    const common = {
        packId: finding.packId,
        code: finding.code,
        severity: finding.severity,
        findingIds: [finding.findingId],
        affectedEntryIds: finding.entryIds,
        affectedTagIds: finding.tagIds,
        affectedTimelineIds: finding.timelineIds,
    };

    if (LOCAL_SCHEMA_CODES.has(finding.code) || LOCAL_MANIFEST_CODES.has(finding.code)) {
        addBucket(buckets, {
            ...common,
            strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
            targetKind: finding.entryIds.length ? 'entry' : 'pack',
            reason: 'Known deterministic local repair.',
        }, findingsById);
        return;
    }

    if (LOCAL_RETRIEVAL_SCHEMA_CODES.has(finding.code)) {
        const canRepairLocally = canRepairRetrievalLocally(pack, finding);
        addBucket(buckets, {
            ...common,
            strategy: canRepairLocally
                ? LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK
                : LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
            targetKind: 'entry',
            reason: canRepairLocally
                ? 'Missing schema v3 retrieval can be filled from deterministic defaults.'
                : 'Missing schema v3 retrieval is blocked by incomplete entry shape.',
        }, findingsById);
        return;
    }

    if (finding.code === 'schema_v3_missing_content') {
        const canRepairLocally = canRepairMissingContentLocally(pack, finding);
        addBucket(buckets, {
            ...common,
            strategy: canRepairLocally
                ? LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK
                : LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
            targetKind: 'entry',
            reason: canRepairLocally
                ? 'Missing schema v3 content can be restored from existing safe alias text.'
                : 'Missing schema v3 content requires reconstruction.',
        }, findingsById);
        return;
    }

    if (MODEL_SCHEMA_CODES.has(finding.code)) {
        addBucket(buckets, {
            ...common,
            strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
            targetKind: 'entry',
            reason: 'Schema shape requires content or Context reconstruction.',
        }, findingsById);
        return;
    }

    if (finding.code === 'undefined_tag' || finding.code === 'deprecated_tag_used' || finding.code === 'malformed_tag_namespace') {
        const classified = classifyTags(pack, finding);
        if (classified.direct.length) {
            addBucket(buckets, {
                ...common,
                affectedEntryIds: normalizeRepairIdList([...finding.entryIds, ...collectEntryIdsForTags(pack, classified.direct)]),
                affectedTagIds: classified.direct,
                strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
                targetKind: 'tag',
                reason: 'Affected tags have one deterministic registry target.',
            }, findingsById);
        }
        if (classified.choices.length) {
            addBucket(buckets, {
                ...common,
                affectedEntryIds: normalizeRepairIdList([...finding.entryIds, ...collectEntryIdsForTags(pack, classified.choices)]),
                affectedTagIds: classified.choices,
                strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE,
                targetKind: 'tag',
                reason: 'Affected tags have multiple plausible registry targets.',
            }, findingsById);
        }
        if (classified.model.length || (!classified.direct.length && !classified.choices.length && !classified.model.length)) {
            addBucket(buckets, {
                ...common,
                affectedEntryIds: normalizeRepairIdList([...finding.entryIds, ...collectEntryIdsForTags(pack, classified.model)]),
                affectedTagIds: classified.model.length ? classified.model : finding.tagIds,
                strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE,
                targetKind: 'tag',
                reason: 'Affected tags do not have a deterministic registry target.',
            }, findingsById);
        }
        return;
    }

    if (CONTEXT_CODES.has(finding.code)) {
        const classified = classifyAnchors(pack, finding);
        if (classified.exact.length) {
            addBucket(buckets, {
                ...common,
                affectedTimelineIds: classified.exact,
                strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
                targetKind: 'timeline',
                reason: 'Broken Context anchor can be normalized to an exact registry ID.',
            }, findingsById);
        }
        if (classified.choices.length) {
            addBucket(buckets, {
                ...common,
                affectedTimelineIds: classified.choices,
                strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE,
                targetKind: 'timeline',
                reason: 'Broken Context anchor has one or more plausible timeline candidates.',
            }, findingsById);
        }
        if (classified.model.length || (!classified.exact.length && !classified.choices.length)) {
            addBucket(buckets, {
                ...common,
                affectedTimelineIds: classified.model.length ? classified.model : finding.timelineIds,
                strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE,
                targetKind: 'timeline',
                reason: 'Context repair requires semantic selection.',
            }, findingsById);
        }
        return;
    }

    addBucket(buckets, {
        ...common,
        strategy: MANUAL_DEFAULT_CODES.has(finding.code)
            ? LOREDECK_HEALTH_REPAIR_STRATEGIES.MANUAL_ONLY
            : LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE,
        targetKind: finding.entryIds.length ? 'entry' : finding.tagIds.length ? 'tag' : finding.timelineIds.length ? 'timeline' : 'pack',
        reason: MANUAL_DEFAULT_CODES.has(finding.code)
            ? 'Finding is advisory or source-sensitive and should not be changed automatically by default.'
            : 'No deterministic local strategy is registered for this finding code.',
    }, findingsById);
}

function mergeBuckets(buckets = [], findingsById = new Map()) {
    const grouped = new Map();
    for (const bucket of buckets) {
        const key = [
            bucket.packId,
            bucket.strategy,
            bucket.code,
            bucket.targetKind,
        ].join('|');
        const current = grouped.get(key) || {
            ...bucket,
            findingIds: [],
            affectedEntryIds: [],
            affectedTagIds: [],
            affectedTimelineIds: [],
            reason: bucket.reason,
        };
        current.findingIds.push(...bucket.findingIds);
        current.affectedEntryIds.push(...bucket.affectedEntryIds);
        current.affectedTagIds.push(...bucket.affectedTagIds);
        current.affectedTimelineIds.push(...bucket.affectedTimelineIds);
        grouped.set(key, current);
    }
    return Array.from(grouped.values()).map(raw => normalizeRepairBucket({
        ...raw,
        findingIds: normalizeRepairIdList(raw.findingIds),
        affectedEntryIds: normalizeRepairIdList(raw.affectedEntryIds),
        affectedTagIds: normalizeRepairTagIdList(raw.affectedTagIds),
        affectedTimelineIds: normalizeRepairTimelineIdList(raw.affectedTimelineIds),
        bucketId: '',
    }, findingsById));
}

function chunkValues(values = [], size = 8) {
    const out = [];
    const limit = Math.max(1, Math.round(Number(size) || 1));
    for (let index = 0; index < values.length; index += limit) {
        out.push(values.slice(index, index + limit));
    }
    return out.length ? out : [[]];
}

function intersects(values = [], wanted = new Set()) {
    return values.some(value => wanted.has(value));
}

function getFindingIdsForUnit(bucket = {}, targets = {}, findingsById = new Map()) {
    const entryIds = new Set(targets.entryIds || []);
    const tagIds = new Set(targets.tagIds || []);
    const timelineIds = new Set(targets.timelineIds || []);
    const scoped = [];
    for (const findingId of bucket.findingIds || []) {
        const finding = findingsById.get(findingId);
        if (!finding) continue;
        if (entryIds.size && intersects(finding.entryIds || [], entryIds)) {
            scoped.push(findingId);
        } else if (!entryIds.size && tagIds.size && intersects(finding.tagIds || [], tagIds)) {
            scoped.push(findingId);
        } else if (!entryIds.size && !tagIds.size && timelineIds.size && intersects(finding.timelineIds || [], timelineIds)) {
            scoped.push(findingId);
        }
    }
    return normalizeRepairIdList(scoped.length ? scoped : bucket.findingIds);
}

function buildUnitsForBucket(bucket = {}, limits = DEFAULT_REPAIR_BATCH_LIMITS, findingsById = new Map()) {
    if (![
        LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
        LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE,
    ].includes(bucket.strategy)) return [];

    const chunks = bucket.affectedEntryIds.length
        ? chunkValues(bucket.affectedEntryIds, limits.modelEntryLimit)
        : bucket.affectedTagIds.length
            ? chunkValues(bucket.affectedTagIds, limits.modelTagLimit)
            : bucket.affectedTimelineIds.length
                ? chunkValues(bucket.affectedTimelineIds, limits.modelTimelineLimit)
                : [[]];

    return chunks.map((chunk, index) => {
        const entryIds = bucket.affectedEntryIds.length ? chunk : bucket.affectedEntryIds;
        const tagIds = bucket.affectedTagIds.length && !bucket.affectedEntryIds.length ? chunk : bucket.affectedTagIds;
        const timelineIds = bucket.affectedTimelineIds.length && !bucket.affectedEntryIds.length && !bucket.affectedTagIds.length ? chunk : bucket.affectedTimelineIds;
        const findingIds = getFindingIdsForUnit(bucket, { entryIds, tagIds, timelineIds }, findingsById);
        const seed = [
            bucket.bucketId,
            index + 1,
            entryIds.join(','),
            tagIds.join(','),
            timelineIds.join(','),
            findingIds.join(','),
        ].join('|');
        return {
            unitId: cleanRepairId(`repair:${bucket.packId || 'pack'}:${bucket.code}:batch_${index + 1}_${hashRepairText(seed)}`, 220),
            stage: 'pack_health_repair',
            strategy: bucket.strategy,
            code: bucket.code,
            bucketId: bucket.bucketId,
            findingIds,
            entryIds,
            tagIds,
            timelineIds,
            inputHash: hashRepairText(seed),
            label: `${bucket.code} batch ${index + 1} of ${chunks.length}`,
        };
    });
}

export function buildLoredeckHealthRepairPlan(options = {}) {
    const pack = isPlainRepairObject(options.pack) ? options.pack : {};
    const health = isPlainRepairObject(options.health) ? options.health : {};
    const packId = getPackId(pack, health);
    const findings = normalizeRepairFindingsFromHealth(health, { packId });
    const findingsById = new Map(findings.map(finding => [finding.findingId, finding]));
    const rawBuckets = [];
    for (const finding of findings) appendBucketsForFinding(rawBuckets, finding, pack, findingsById);
    const buckets = mergeBuckets(rawBuckets, findingsById);
    const limits = {
        ...DEFAULT_REPAIR_BATCH_LIMITS,
        ...(isPlainRepairObject(options.batchLimits) ? options.batchLimits : {}),
    };
    const modelUnitLimit = Math.max(1, Number(limits.modelUnitLimit) || DEFAULT_REPAIR_BATCH_LIMITS.modelUnitLimit);
    const allUnits = buckets.flatMap(bucket => buildUnitsForBucket(bucket, limits, findingsById));
    const units = allUnits.slice(0, modelUnitLimit);
    const deferredUnits = allUnits.slice(modelUnitLimit).map((unit, index) => ({
        ...unit,
        deferred: true,
        deferredIndex: index + 1,
    }));
    for (const bucket of buckets) {
        bucket.estimatedUnits = allUnits.filter(unit => unit.bucketId === bucket.bucketId).length;
    }
    const plan = {
        schemaVersion: 1,
        packId,
        findings: cloneRepairJson(findings),
        buckets: cloneRepairJson(buckets),
        units: cloneRepairJson(units),
        deferredUnits: cloneRepairJson(deferredUnits),
    };
    plan.summary = createRepairPlanSummary(plan);
    return plan;
}

export const __loredeckHealthFixPlannerTestHooks = Object.freeze({
    classifyTags,
    classifyAnchors,
    canRepairMissingContentLocally,
    canRepairRetrievalLocally,
    getFindingIdsForUnit,
    getPackTagIds,
    getPackAnchorRecords,
    getEntryMap,
});
