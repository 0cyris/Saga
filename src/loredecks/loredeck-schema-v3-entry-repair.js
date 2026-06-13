/**
 * Shared schema v3 Loredeck entry repair helpers.
 */

import { normalizeLoredeckEntryForSchemaV3 } from './schema-v3-health.js';

export const GENERIC_SCHEMA_V3_TAGS = Object.freeze([
    'fact',
    'detail',
    'event',
    'timeline',
    'character',
    'location',
    'relationship',
    'secret',
    'public',
    'other',
]);

export const SCHEMA_V3_LEGACY_ENTRY_FIELDS = Object.freeze([
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

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSchemaV3RepairTagId(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/:+/g, ':')
        .replace(/^[\s:._/-]+|[\s:._/-]+$/g, '')
        .toLowerCase()
        .slice(0, 96)
        .trim();
}

function normalizeSchemaV3RepairTimelineId(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '_')
        .slice(0, 180)
        .trim();
}

function compactIdentity(value = '') {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function normalizeSchemaV3RepairEntryTagList(value = [], limit = 64) {
    const input = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const out = [];
    const seen = new Set();
    for (const raw of input) {
        const tag = normalizeSchemaV3RepairTagId(raw);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
        if (out.length >= limit) break;
    }
    return out;
}

function getPackTagIds(pack = {}) {
    const registry = isPlainObject(pack.tagRegistry) ? pack.tagRegistry : {};
    const source = isPlainObject(registry.tags) ? registry.tags : registry;
    return Object.keys(source || {}).map(normalizeSchemaV3RepairTagId).filter(Boolean);
}

function getPackAnchorIds(pack = {}) {
    return getPackAnchorRecords(pack).map(anchor => anchor.id);
}

function getPackAnchorRecords(pack = {}) {
    const registry = isPlainObject(pack.timelineRegistry) ? pack.timelineRegistry : {};
    return (Array.isArray(registry.anchors) ? registry.anchors : [])
        .map(anchor => {
            const id = normalizeSchemaV3RepairTimelineId(anchor?.id);
            if (!id) return null;
            const sortKey = Number(anchor?.sortKey);
            return {
                id,
                label: String(anchor?.label || anchor?.title || id).trim(),
                sortKey: Number.isFinite(sortKey) ? sortKey : null,
            };
        })
        .filter(Boolean);
}

function buildUniqueCompactMap(ids = []) {
    const grouped = new Map();
    for (const id of ids) {
        const compact = compactIdentity(id);
        if (!compact) continue;
        if (!grouped.has(compact)) grouped.set(compact, new Set());
        grouped.get(compact).add(id);
    }
    const out = new Map();
    for (const [compact, values] of grouped.entries()) {
        if (values.size === 1) out.set(compact, [...values][0]);
    }
    return out;
}

function buildCompactGroupMap(ids = []) {
    const grouped = new Map();
    for (const id of ids) {
        const compact = compactIdentity(id);
        if (!compact) continue;
        if (!grouped.has(compact)) grouped.set(compact, new Set());
        grouped.get(compact).add(id);
    }
    const out = new Map();
    for (const [compact, values] of grouped.entries()) {
        out.set(compact, [...values].sort());
    }
    return out;
}

function getGenericEntryTags(entry = {}) {
    return new Set([
        normalizeSchemaV3RepairTagId(entry.kind),
        normalizeSchemaV3RepairTagId(entry.category),
        ...GENERIC_SCHEMA_V3_TAGS,
    ].filter(Boolean));
}

function listsDiffer(a = [], b = []) {
    if (a.length !== b.length) return true;
    return a.some((item, index) => item !== b[index]);
}

export function hasSchemaV3LegacyEntryFields(entry = {}) {
    return SCHEMA_V3_LEGACY_ENTRY_FIELDS.some(field => Object.prototype.hasOwnProperty.call(entry || {}, field));
}

export function repairSchemaV3EntryTags(entry = {}, pack = {}, options = {}) {
    const rejectUnknownTags = options.rejectUnknownTags === true;
    const registryIds = getPackTagIds(pack);
    const registrySet = new Set(registryIds);
    const compactRegistry = buildUniqueCompactMap(registryIds);
    const compactGroups = buildCompactGroupMap(registryIds);
    const genericTags = getGenericEntryTags(entry);
    const warnings = [];
    const errors = [];
    const unresolved = [];
    const reviewCandidates = [];
    const tags = [];
    const seen = new Set();
    const normalizedInput = normalizeSchemaV3RepairEntryTagList(entry.tags);

    for (const tag of normalizedInput) {
        if (genericTags.has(tag) && !registrySet.has(tag)) {
            warnings.push(`Dropped generic Lorecard tag ${tag}.`);
            continue;
        }
        const mapped = registrySet.has(tag)
            ? tag
            : (compactRegistry.get(compactIdentity(tag)) || tag);
        if (mapped !== tag) warnings.push(`Mapped compacted tag ${tag} to ${mapped}.`);
        if (registrySet.size && !registrySet.has(mapped)) {
            const message = `Unknown tag ${mapped}.`;
            const candidates = compactGroups.get(compactIdentity(tag)) || [];
            if (candidates.length > 1) {
                reviewCandidates.push({
                    kind: 'tag',
                    field: 'tags',
                    from: tag,
                    candidates,
                    reason: 'ambiguous_compact_match',
                });
            }
            if (rejectUnknownTags) {
                errors.push(message);
                continue;
            }
            unresolved.push(message);
        }
        if (!mapped || seen.has(mapped)) continue;
        seen.add(mapped);
        tags.push(mapped);
    }

    return {
        tags,
        warnings,
        errors,
        unresolved,
        reviewCandidates,
        changed: listsDiffer(normalizedInput, tags),
    };
}

function getContextSortKeyForAnchorField(context = {}, field = '') {
    if (field === 'validFromAnchor') {
        const number = Number(context.sortKeyFrom);
        return Number.isFinite(number) ? number : null;
    }
    if (field === 'validToAnchor') {
        const number = Number(context.sortKeyTo);
        return Number.isFinite(number) ? number : null;
    }
    const from = Number(context.sortKeyFrom);
    const to = Number(context.sortKeyTo);
    if (Number.isFinite(from) && Number.isFinite(to) && from === to) return from;
    if (Number.isFinite(from)) return from;
    if (Number.isFinite(to)) return to;
    return null;
}

function getAnchorReviewCandidate(context = {}, field = '', raw = '', anchorRecords = []) {
    const sortKey = getContextSortKeyForAnchorField(context, field);
    if (sortKey === null) return null;
    const matches = anchorRecords.filter(anchor => anchor.sortKey === sortKey);
    if (!matches.length) return null;
    const base = {
        kind: 'context_anchor',
        field,
        from: raw,
        sortKey,
        reason: 'sort_key_match',
    };
    if (matches.length === 1) {
        return {
            ...base,
            to: matches[0].id,
            label: matches[0].label,
        };
    }
    return {
        ...base,
        candidates: matches.map(anchor => anchor.id),
    };
}

export function repairSchemaV3ContextAnchors(context = {}, pack = {}, options = {}) {
    const rejectUnknownAnchors = options.rejectUnknownAnchors === true;
    const anchorRecords = getPackAnchorRecords(pack);
    const anchorIds = anchorRecords.map(anchor => anchor.id);
    const anchorSet = new Set(anchorIds);
    const normalizedAnchorMap = new Map(anchorIds.map(id => [normalizeSchemaV3RepairTimelineId(id), id]));
    const warnings = [];
    const errors = [];
    const unresolved = [];
    const reviewCandidates = [];
    const next = isPlainObject(context) ? { ...context } : {};
    const fields = ['anchorId', 'validFromAnchor', 'validToAnchor'];
    let changed = false;

    for (const field of fields) {
        const raw = String(next[field] || '').trim();
        if (!raw) continue;
        const normalized = normalizeSchemaV3RepairTimelineId(raw);
        const resolved = anchorSet.has(raw) ? raw : normalizedAnchorMap.get(normalized);
        if (resolved && resolved !== raw) {
            next[field] = resolved;
            changed = true;
            warnings.push(`Normalized ${field} ${raw} to ${resolved}.`);
            continue;
        }
        if (anchorSet.size && !anchorSet.has(raw)) {
            const message = `Unknown ${field} ${raw}.`;
            const candidate = getAnchorReviewCandidate(next, field, raw, anchorRecords);
            if (candidate) reviewCandidates.push(candidate);
            if (rejectUnknownAnchors) errors.push(message);
            else unresolved.push(message);
        }
    }
    return { context: next, warnings, errors, unresolved, reviewCandidates, changed };
}

export function validateSchemaV3EntryShape(entry = {}) {
    const errors = [];
    const context = isPlainObject(entry.context) ? entry.context : {};
    const retrieval = isPlainObject(entry.retrieval) ? entry.retrieval : {};
    const content = isPlainObject(entry.content) ? entry.content : {};
    if (!['anchor', 'window', 'global'].includes(context.scope)) errors.push('Missing or invalid context.scope.');
    if (!Number.isFinite(Number(context.sortKeyFrom))) errors.push('Missing context.sortKeyFrom.');
    if (!Number.isFinite(Number(context.sortKeyTo))) errors.push('Missing context.sortKeyTo.');
    if (Number.isFinite(Number(context.sortKeyFrom)) && Number.isFinite(Number(context.sortKeyTo)) && Number(context.sortKeyFrom) > Number(context.sortKeyTo)) {
        errors.push('context.sortKeyFrom is after context.sortKeyTo.');
    }
    if (!String(context.precision || '').trim()) errors.push('Missing context.precision.');
    if (!String(context.label || '').trim()) errors.push('Missing context.label.');
    if (!String(retrieval.activation || '').trim()) errors.push('Missing retrieval.activation.');
    if (!String(retrieval.frequency || '').trim()) errors.push('Missing retrieval.frequency.');
    if (!String(retrieval.contextBoost || '').trim()) errors.push('Missing retrieval.contextBoost.');
    if (!String(content.fact || '').trim()) errors.push('Missing content.fact.');
    if (!String(content.injection || '').trim()) errors.push('Missing content.injection.');
    return errors;
}

export function normalizeSchemaV3EntryOverrideForPack(pack = {}, rawEntry = {}, id = '') {
    const entryId = String(rawEntry?.id || id || '').trim();
    const title = String(rawEntry?.title || rawEntry?.name || entryId || 'Lorecard').trim() || 'Lorecard';
    const priority = Number(rawEntry?.priority);
    const tags = normalizeSchemaV3RepairEntryTagList(rawEntry?.tags);
    const entry = normalizeLoredeckEntryForSchemaV3({
        ...(isPlainObject(rawEntry) ? rawEntry : {}),
        id: entryId,
        title,
        schemaVersion: 3,
        category: String(rawEntry?.category || 'other').trim() || 'other',
        canon: String(rawEntry?.canon || rawEntry?.canonStatus || 'au').trim() || 'au',
        canonStatus: String(rawEntry?.canonStatus || rawEntry?.canon || 'au').trim() || 'au',
        relevance: String(rawEntry?.relevance || 'normal').trim() || 'normal',
        priority: Number.isFinite(priority) ? priority : 50,
        tags,
        userEditable: rawEntry?.userEditable !== false,
        userEdited: true,
    });
    entry.id = entryId;
    entry.title = title;
    entry.tags = normalizeSchemaV3RepairEntryTagList(entry.tags);
    return entry;
}

export function repairSchemaV3EntryForPack(pack = {}, rawEntry = {}, id = '', options = {}) {
    const beforeJson = JSON.stringify(rawEntry || {});
    const entryId = String(rawEntry?.id || id || '').trim();
    const tagRepair = repairSchemaV3EntryTags(rawEntry, pack, options);
    const contextRepair = repairSchemaV3ContextAnchors(rawEntry?.context, pack, options);
    const entry = normalizeSchemaV3EntryOverrideForPack(pack, {
        ...(isPlainObject(rawEntry) ? rawEntry : {}),
        id: entryId,
        tags: tagRepair.tags,
        context: contextRepair.context,
    }, entryId);
    const shapeErrors = options.validateShape === false
        ? []
        : validateSchemaV3EntryShape(entry).map(message => `${entryId}: ${message}`);
    const afterJson = JSON.stringify(entry || {});
    return {
        entry,
        warnings: [...new Set([...tagRepair.warnings, ...contextRepair.warnings])],
        errors: [...new Set([...tagRepair.errors, ...contextRepair.errors, ...shapeErrors])],
        unresolved: [...new Set([...tagRepair.unresolved, ...contextRepair.unresolved])],
        reviewCandidates: [
            ...tagRepair.reviewCandidates,
            ...contextRepair.reviewCandidates,
        ],
        repaired: beforeJson !== afterJson || hasSchemaV3LegacyEntryFields(rawEntry) || tagRepair.changed || contextRepair.changed,
    };
}
