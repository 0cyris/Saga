/**
 * loredeck-review-helpers.js - Saga
 * Shared review formatting, quality, risk, health-impact, and diff helpers.
 */

import {
    createStatusPill,
    humanizeScopeKey,
} from '../ui/runtime-ui-kit.js';
import {
    truncateText,
} from './runtime-formatters.js';

let reviewDeps = {};

export function configureLoredeckReviewHelpers(deps = {}) {
    reviewDeps = { ...reviewDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof reviewDeps[name] === 'function' ? reviewDeps[name] : fallback;
}

function getLoredeckEntryPreviewCacheRecord(packId = '') { return dep('getLoredeckEntryPreviewCacheRecord', () => null)(packId); }
function parseLoredeckEntryTags(value = []) { return dep('parseLoredeckEntryTags', input => Array.isArray(input) ? input : [])(value); }
function normalizeLoredeckPendingIdList(value = []) { return dep('normalizeLoredeckPendingIdList', input => Array.isArray(input) ? input.map(String).filter(Boolean) : [])(value); }
function normalizeLoredeckTagId(value = '') { return dep('normalizeLoredeckTagId', input => String(input || '').trim().toLowerCase())(value); }
function getLoredeckEmbeddedTagRegistry(pack = {}) { return dep('getLoredeckEmbeddedTagRegistry', () => ({ tags: {} }))(pack); }
function getLoredeckCachedSourceTagRegistry(packId = '') { return dep('getLoredeckCachedSourceTagRegistry', () => ({ tags: {} }))(packId); }
function normalizeLoredeckTagDefinition(raw = {}, tagId = '') { return dep('normalizeLoredeckTagDefinition', input => input || {})(raw, tagId); }
function normalizeLoredeckTimelineId(value = '') { return dep('normalizeLoredeckTimelineId', input => String(input || '').trim().toLowerCase())(value); }
function getLoredeckEmbeddedTimelineRegistry(pack = {}) { return dep('getLoredeckEmbeddedTimelineRegistry', () => ({ anchors: [], windows: [], disabledAnchorIds: [], disabledWindowIds: [] }))(pack); }
function getLoredeckCachedSourceTimelineRegistry(packId = '') { return dep('getLoredeckCachedSourceTimelineRegistry', () => ({ anchors: [], windows: [] }))(packId); }
function normalizeLoredeckTimelineAnchor(raw = {}, fallbackId = '') { return dep('normalizeLoredeckTimelineAnchor', input => input || null)(raw, fallbackId); }
function normalizeLoredeckTimelineWindow(raw = {}, fallbackId = '') { return dep('normalizeLoredeckTimelineWindow', input => input || null)(raw, fallbackId); }
function normalizeLoredeckTimelineDisabledIds(value = []) { return dep('normalizeLoredeckTimelineDisabledIds', input => Array.isArray(input) ? input.map(String).filter(Boolean) : [])(value); }

export function formatLoredeckPendingActionLabel(action = '') {
    const key = String(action || 'record_patch').trim();
    const known = {
        record_patch: 'Record Patch',
        upsert_entry: 'Upsert Entry',
        assistant_upsert_entry: 'Assistant Upsert Entry',
        assistant_disable_entry: 'Assistant Disable Entry',
        assistant_restore_entry: 'Assistant Restore Entry',
        assistant_upsert_tag_definition: 'Assistant Upsert Tag',
        assistant_upsert_timeline_anchor: 'Assistant Upsert Anchor',
        assistant_upsert_timeline_window: 'Assistant Upsert Window',
        creator_upsert_entry: 'Creator Upsert Entry',
        creator_upsert_tag_definition: 'Creator Upsert Tag',
        creator_upsert_timeline_anchor: 'Creator Upsert Anchor',
        creator_upsert_timeline_window: 'Creator Upsert Window',
        remove_entry_override: 'Remove Override',
        disable_entry: 'Disable Entry',
        restore_entry: 'Restore Entry',
        bulk_context_update: 'Bulk Context Update',
        normalize_malformed_tag_ids: 'Normalize Tag IDs',
        upsert_tag_definition: 'Upsert Tag',
        rename_tag: 'Rename Tag',
        merge_tag: 'Merge Tag',
        remove_tag_definition: 'Remove Tag',
        upsert_timeline_anchor: 'Upsert Anchor',
        upsert_timeline_window: 'Upsert Window',
        disable_timeline_anchor: 'Disable Anchor',
        disable_timeline_window: 'Disable Window',
        restore_timeline_anchor: 'Restore Anchor',
        restore_timeline_window: 'Restore Window',
    };
    return known[key] || humanizeScopeKey(key);
}

export function formatLoredeckPendingTargetKindLabel(targetKind = '') {
    const key = String(targetKind || 'loredeck').trim();
    const known = {
        loredeck: 'Loredeck',
        entry: 'Entry',
        entries: 'Entries',
        tag: 'Tag',
        tags: 'Tags',
        timeline_anchor: 'Timeline Anchor',
        timeline_window: 'Timeline Window',
        timeline: 'Timeline',
    };
    return known[key] || humanizeScopeKey(key);
}

export function formatLoredeckPendingSourceLabel(source = '') {
    const key = String(source || 'manual').trim();
    const known = {
        manual: 'Manual',
        bulk_edit: 'Bulk Edit',
        lore_assistant: 'Lore Assistant',
        loredeck_creator: 'Loredeck Creator',
        safe_repair: 'Safe Repair',
        import: 'Import',
    };
    return known[key] || humanizeScopeKey(key);
}

export function getLoredeckPendingSourceTooltip(source = '') {
    const key = String(source || 'manual').trim();
    if (key === 'lore_assistant') return 'Created by Saga Lore Assistant. Treat as a proposal until reviewed and accepted.';
    if (key === 'loredeck_creator') return 'Created by Saga Loredeck Creator. Treat as a generated planning proposal until reviewed and accepted.';
    if (key === 'bulk_edit') return 'Created by a bulk-edit tool. Review the field diffs before acceptance.';
    if (key === 'safe_repair') return 'Created by an automated Deck Health repair path.';
    return 'Proposal source.';
}

function getLoredeckPendingPreviewMetadata(change = {}) {
    return change?.preview && typeof change.preview === 'object' && !Array.isArray(change.preview) ? change.preview : {};
}

export function getLoredeckPendingConfidence(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const raw = preview.confidence ?? change.confidence;
    if (raw === undefined || raw === null || raw === '') return null;
    let confidence = Number(raw);
    if (!Number.isFinite(confidence)) return null;
    if (confidence > 1 && confidence <= 100) confidence /= 100;
    return Math.max(0, Math.min(1, confidence));
}

export function getLoredeckPendingRisk(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const raw = String(preview.risk || change.risk || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (/critical|severe|high/.test(lower)) return 'high';
    if (/medium|moderate|med/.test(lower)) return 'medium';
    if (/low|minor|minimal/.test(lower)) return 'low';
    return raw.slice(0, 60);
}

export function createLoredeckPendingRiskPill(risk = '') {
    const normalized = String(risk || '').trim();
    const classKey = /high/i.test(normalized)
        ? 'high'
        : (/medium|moderate|med/i.test(normalized) ? 'medium' : (/low|minor|minimal/i.test(normalized) ? 'low' : 'unknown'));
    const tone = classKey === 'high'
        ? 'danger'
        : (classKey === 'medium' ? 'warning' : (classKey === 'low' ? 'success' : 'muted'));
    return createStatusPill(`Risk: ${humanizeScopeKey(normalized)}`, 'Estimated proposal risk. Higher-risk proposals need closer manual review before acceptance.', { tone, kind: 'severity' });
}

function normalizeLoredeckPendingRubricLevel(value = '') {
    const raw = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!raw) return '';
    if (raw === 'n_a' || raw === 'na' || raw === 'none') return 'not_applicable';
    if (raw === 'med' || raw === 'moderate') return 'medium';
    if (raw === 'minor' || raw === 'minimal') return 'low';
    if (raw === 'strong') return 'high';
    return ['high', 'medium', 'low', 'not_applicable'].includes(raw) ? raw : '';
}

function getLoredeckPendingRubric(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const rubric = preview.rubric || preview.qualityRubric || preview.quality;
    return rubric && typeof rubric === 'object' && !Array.isArray(rubric) ? rubric : {};
}

function getLoredeckPendingQualityWarnings(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const warnings = Array.isArray(preview.qualityWarnings)
        ? preview.qualityWarnings
        : (Array.isArray(preview.rubric?.warnings) ? preview.rubric.warnings : []);
    return warnings.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8);
}

function getLoredeckPendingRubricNotes(change = {}) {
    const rubric = getLoredeckPendingRubric(change);
    return Array.isArray(rubric.notes)
        ? rubric.notes.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6)
        : [];
}

function createLoredeckPendingQualityPill(label, level, tooltip) {
    const normalized = normalizeLoredeckPendingRubricLevel(level);
    if (!normalized) return null;
    const tone = normalized === 'high'
        ? 'success'
        : (normalized === 'medium' ? 'warning' : (normalized === 'low' ? 'danger' : 'muted'));
    return createStatusPill(`${label}: ${humanizeScopeKey(normalized)}`, tooltip, { tone, kind: 'metadata' });
}

export function appendLoredeckPendingQualityPills(meta, change = {}) {
    const rubric = getLoredeckPendingRubric(change);
    const sceneUtility = createLoredeckPendingQualityPill('Utility', rubric.sceneUtility, 'Lore Value Rubric: whether this proposal improves scene behavior, tension, characterization, or setting response.');
    if (sceneUtility) meta.appendChild(sceneUtility);
    const behavioralImpact = createLoredeckPendingQualityPill('Behavior', rubric.behavioralImpact, 'Lore Value Rubric: whether this proposal changes what characters do, say, know, hide, avoid, or expect.');
    if (behavioralImpact) meta.appendChild(behavioralImpact);
    const contextFit = createLoredeckPendingQualityPill('Context Fit', rubric.contextFit, 'Lore Value Rubric: whether this proposal fits the intended Context without future leakage.');
    if (contextFit) meta.appendChild(contextFit);
    const wikiRisk = createLoredeckPendingQualityPill('Wiki Risk', rubric.wikiSummaryRisk || rubric.wikiRisk, 'Risk that this proposal reads like generic wiki summary instead of playable Saga lore.');
    if (wikiRisk) meta.appendChild(wikiRisk);
    const warnings = getLoredeckPendingQualityWarnings(change);
    if (warnings.length) {
        meta.appendChild(createStatusPill(`${warnings.length} quality flag${warnings.length === 1 ? '' : 's'}`, warnings.join(' | '), { tone: 'warning', kind: 'severity' }));
    }
}

export function createLoredeckPendingQualityList(change = {}) {
    const warnings = getLoredeckPendingQualityWarnings(change);
    const notes = getLoredeckPendingRubricNotes(change);
    if (!warnings.length && !notes.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-pending-quality-list';
    for (const warning of warnings) {
        const item = document.createElement('div');
        item.className = 'saga-runtime-help saga-warning-text';
        item.textContent = `Quality flag: ${warning}`;
        wrap.appendChild(item);
    }
    for (const note of notes) {
        const item = document.createElement('div');
        item.className = 'saga-runtime-help';
        item.textContent = `Rubric note: ${note}`;
        wrap.appendChild(item);
    }
    return wrap;
}

export function createLoredeckPendingHealthImpactPill() {
    return createStatusPill('Health impact', 'Accepting this proposal changes entries, tags, or timeline data and will mark Deck Health stale until validation reruns.', { tone: 'warning', kind: 'severity' });
}

export function createLoredeckPendingHealthStalePill() {
    return createStatusPill('Health stale', 'Deck Health was computed before the latest accepted Loredeck edits. Rerun validation.', { tone: 'warning', kind: 'severity' });
}

export function isLoredeckHealthStatusStale(pack = {}) {
    return String(pack?.healthStatus || '').trim().toLowerCase() === 'stale';
}

export function doesLoredeckPendingChangeAffectPackHealth(change = {}) {
    const payload = change?.payload && typeof change.payload === 'object' && !Array.isArray(change.payload) ? change.payload : {};
    const hasObjectEntries = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    const hasArrayItems = value => Array.isArray(value) && value.length > 0;
    return hasObjectEntries(payload.entryOverrides)
        || hasArrayItems(payload.disabledEntryIdsAdd)
        || hasArrayItems(payload.disabledEntryIdsRemove)
        || hasObjectEntries(payload.tagDefinitions)
        || hasObjectEntries(payload.timelineAnchors)
        || hasObjectEntries(payload.timelineWindows)
        || hasArrayItems(payload.timelineAnchorIdsDisable)
        || hasArrayItems(payload.timelineAnchorIdsEnable)
        || hasArrayItems(payload.timelineWindowIdsDisable)
        || hasArrayItems(payload.timelineWindowIdsEnable);
}

export function createLoredeckPendingDiffList(pack, change = {}) {
    const diffs = buildLoredeckPendingDiffs(pack, change);
    if (!diffs.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-pending-diff-list';
    for (const diff of diffs.slice(0, 10)) {
        const item = document.createElement('div');
        item.className = 'saga-runtime-help';
        const before = formatLoredeckPendingDiffValue(diff.before);
        const after = formatLoredeckPendingDiffValue(diff.after);
        item.textContent = `${diff.scope ? `${diff.scope} | ` : ''}${diff.field}: ${before} => ${after}`;
        wrap.appendChild(item);
    }
    if (diffs.length > 10) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `+${diffs.length - 10} more field change${diffs.length - 10 === 1 ? '' : 's'}.`;
        wrap.appendChild(more);
    }
    return wrap;
}

function formatLoredeckPendingDiffValue(value) {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (Array.isArray(value)) return truncateText(value.join(', ') || '(empty)', 180);
    if (typeof value === 'object') {
        try {
            return truncateText(JSON.stringify(value), 180);
        } catch (_) {
            return '[object]';
        }
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return truncateText(String(value), 180);
}

function buildLoredeckPendingDiffs(pack, change = {}) {
    const patch = change.payload && typeof change.payload === 'object' && !Array.isArray(change.payload) ? change.payload : {};
    const diffs = [];
    collectLoredeckPendingEntryDiffs(diffs, pack, patch);
    collectLoredeckPendingEntryDisableDiffs(diffs, pack, patch);
    collectLoredeckPendingTagDiffs(diffs, pack, patch);
    collectLoredeckPendingTimelineDiffs(diffs, pack, patch);
    if (!diffs.length && (change.preview?.before || change.preview?.after)) {
        addLoredeckPendingDiff(diffs, 'Preview', 'summary', change.preview?.before || '', change.preview?.after || '');
    }
    return diffs;
}

function addLoredeckPendingDiff(diffs, scope, field, before, after) {
    if (isLoredeckPendingDiffEqual(before, after)) return;
    diffs.push({ scope, field, before, after });
}

function isLoredeckPendingDiffEqual(before, after) {
    return JSON.stringify(normalizeLoredeckPendingDiffComparable(before)) === JSON.stringify(normalizeLoredeckPendingDiffComparable(after));
}

function normalizeLoredeckPendingDiffComparable(value) {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.map(item => normalizeLoredeckPendingDiffComparable(item));
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([, nested]) => nested !== undefined && nested !== null && nested !== '')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, nested]) => [key, normalizeLoredeckPendingDiffComparable(nested)]));
    }
    return value;
}

function getLoredeckPendingCachedSourceEntry(pack, entryId = '') {
    const id = String(entryId || '').trim();
    if (!id) return null;
    const cached = getLoredeckEntryPreviewCacheRecord(String(pack?.packId || '').trim());
    return (cached?.entries || []).find(entry => String(entry?.id || '').trim() === id) || null;
}

function getLoredeckPendingCurrentEntry(pack, entryId = '') {
    const id = String(entryId || '').trim();
    if (!id) return null;
    const overrides = pack?.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? pack.entryOverrides
        : {};
    return overrides[id] || getLoredeckPendingCachedSourceEntry(pack, id) || null;
}

function getLoredeckPendingEntryField(entry = {}, field = '') {
    if (!entry || typeof entry !== 'object') return '';
    const content = entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content) ? entry.content : {};
    const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    const retrieval = entry.retrieval && typeof entry.retrieval === 'object' && !Array.isArray(entry.retrieval) ? entry.retrieval : {};
    if (field === 'fact') return content.fact || entry.fact || '';
    if (field === 'injection') return content.injection || entry.injection || '';
    if (field === 'notes') return content.notes || entry.notes || '';
    if (field === 'canon') return entry.canon || entry.canonStatus || '';
    if (field === 'tags') return parseLoredeckEntryTags(entry.tags || []);
    if (field === 'context.validFromAnchor') return contextGate.validFromAnchor || contextGate.anchorFrom || '';
    if (field === 'context.validToAnchor') return contextGate.validToAnchor || contextGate.anchorTo || '';
    if (field.startsWith('context.')) return contextGate[field.slice('context.'.length)] ?? '';
    if (field.startsWith('retrieval.')) return retrieval[field.slice('retrieval.'.length)] ?? '';
    return entry[field] ?? '';
}

function collectLoredeckPendingEntryDiffs(diffs, pack, patch = {}) {
    const entryOverrides = patch.entryOverrides && typeof patch.entryOverrides === 'object' && !Array.isArray(patch.entryOverrides)
        ? patch.entryOverrides
        : {};
    const fields = [
        ['title', 'title'],
        ['category', 'category'],
        ['canon', 'canon'],
        ['relevance', 'relevance'],
        ['priority', 'priority'],
        ['tags', 'tags'],
        ['context.scope', 'context scope'],
        ['context.anchorId', 'context anchor'],
        ['context.validFromAnchor', 'context from'],
        ['context.validToAnchor', 'context to'],
        ['context.sortKeyFrom', 'sort from'],
        ['context.sortKeyTo', 'sort to'],
        ['context.precision', 'context precision'],
        ['context.windowKind', 'window kind'],
        ['context.label', 'context label'],
        ['retrieval.activation', 'retrieval activation'],
        ['retrieval.frequency', 'retrieval frequency'],
        ['retrieval.contextBoost', 'context boost'],
        ['fact', 'lore text'],
        ['injection', 'injection'],
        ['notes', 'notes'],
    ];
    for (const [rawId, rawEntry] of Object.entries(entryOverrides)) {
        const id = String(rawEntry?.id || rawId || '').trim();
        if (!id) continue;
        const scope = `Entry ${id}`;
        const beforeEntry = getLoredeckPendingCurrentEntry(pack, id);
        if (rawEntry === null) {
            addLoredeckPendingDiff(diffs, scope, 'override', beforeEntry ? 'present' : '(none)', 'removed');
            continue;
        }
        if (!beforeEntry) {
            addLoredeckPendingDiff(diffs, scope, 'entry', '(new)', rawEntry.title || id);
        }
        for (const [field, label] of fields) {
            addLoredeckPendingDiff(
                diffs,
                scope,
                label,
                getLoredeckPendingEntryField(beforeEntry || {}, field),
                getLoredeckPendingEntryField(rawEntry || {}, field)
            );
        }
    }
}

function collectLoredeckPendingEntryDisableDiffs(diffs, pack, patch = {}) {
    const disabled = new Set(Array.isArray(pack?.disabledEntryIds) ? pack.disabledEntryIds : []);
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsAdd || [])) {
        addLoredeckPendingDiff(diffs, `Entry ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'disabled');
    }
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsRemove || [])) {
        addLoredeckPendingDiff(diffs, `Entry ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'active');
    }
}

function getLoredeckPendingCurrentTagDefinition(pack, tagId = '') {
    const id = normalizeLoredeckTagId(tagId);
    if (!id) return null;
    const custom = getLoredeckEmbeddedTagRegistry(pack);
    const source = getLoredeckCachedSourceTagRegistry(pack?.packId);
    return custom.tags?.[id] || source.tags?.[id] || null;
}

function collectLoredeckPendingTagDiffs(diffs, pack, patch = {}) {
    const tagDefinitions = patch.tagDefinitions && typeof patch.tagDefinitions === 'object' && !Array.isArray(patch.tagDefinitions)
        ? patch.tagDefinitions
        : {};
    const fields = ['label', 'description', 'color', 'textColor', 'aliases', 'parents', 'sensitive', 'deprecated', 'replacement'];
    for (const [rawId, rawDef] of Object.entries(tagDefinitions)) {
        const id = normalizeLoredeckTagId(rawDef?.id || rawId);
        if (!id) continue;
        const scope = `Tag ${id}`;
        const beforeDef = getLoredeckPendingCurrentTagDefinition(pack, id);
        const before = beforeDef || {};
        if (rawDef === null) {
            addLoredeckPendingDiff(diffs, scope, 'definition', beforeDef ? 'present' : '(none)', 'removed');
            continue;
        }
        const after = normalizeLoredeckTagDefinition(rawDef, id);
        for (const field of fields) addLoredeckPendingDiff(diffs, scope, field, before[field] ?? '', after[field] ?? '');
    }
}

function getLoredeckPendingCurrentTimelineItem(pack, kind = 'anchor', itemId = '') {
    const id = normalizeLoredeckTimelineId(itemId);
    if (!id) return null;
    const custom = getLoredeckEmbeddedTimelineRegistry(pack);
    const source = getLoredeckCachedSourceTimelineRegistry(pack?.packId);
    const customList = kind === 'window' ? custom.windows : custom.anchors;
    const sourceList = kind === 'window' ? source.windows : source.anchors;
    return (customList || []).find(item => item.id === id) || (sourceList || []).find(item => item.id === id) || null;
}

function collectLoredeckPendingTimelineDiffs(diffs, pack, patch = {}) {
    collectLoredeckPendingTimelineDefinitionDiffs(diffs, pack, patch.timelineAnchors, 'anchor');
    collectLoredeckPendingTimelineDefinitionDiffs(diffs, pack, patch.timelineWindows, 'window');
    collectLoredeckPendingTimelineDisabledDiffs(diffs, pack, patch.timelineAnchorIdsDisable, patch.timelineAnchorIdsEnable, 'anchor');
    collectLoredeckPendingTimelineDisabledDiffs(diffs, pack, patch.timelineWindowIdsDisable, patch.timelineWindowIdsEnable, 'window');
}

function collectLoredeckPendingTimelineDefinitionDiffs(diffs, pack, definitions, kind = 'anchor') {
    if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) return;
    const fields = kind === 'window'
        ? ['label', 'anchorFrom', 'anchorTo', 'sortKeyFrom', 'sortKeyTo', 'dateRange', 'aliases', 'tags', 'notes']
        : ['label', 'sortKey', 'dateRange', 'arc', 'phase', 'season', 'episode', 'chapter', 'aliases', 'tags', 'notes'];
    for (const [rawId, rawDef] of Object.entries(definitions)) {
        const id = normalizeLoredeckTimelineId(rawDef?.id || rawId);
        if (!id) continue;
        const scope = `${kind === 'window' ? 'Timeline window' : 'Timeline anchor'} ${id}`;
        const beforeDef = getLoredeckPendingCurrentTimelineItem(pack, kind, id);
        const before = beforeDef || {};
        if (rawDef === null) {
            addLoredeckPendingDiff(diffs, scope, 'definition', beforeDef ? 'present' : '(none)', 'removed');
            continue;
        }
        const after = kind === 'window'
            ? normalizeLoredeckTimelineWindow(rawDef, id)
            : normalizeLoredeckTimelineAnchor(rawDef, id);
        for (const field of fields) addLoredeckPendingDiff(diffs, scope, field, before[field] ?? '', after?.[field] ?? '');
    }
}

function collectLoredeckPendingTimelineDisabledDiffs(diffs, pack, disableIds = [], enableIds = [], kind = 'anchor') {
    const custom = getLoredeckEmbeddedTimelineRegistry(pack);
    const disabled = new Set(kind === 'window' ? custom.disabledWindowIds : custom.disabledAnchorIds);
    const scopeType = kind === 'window' ? 'Timeline window' : 'Timeline anchor';
    for (const id of normalizeLoredeckTimelineDisabledIds(disableIds || [])) {
        addLoredeckPendingDiff(diffs, `${scopeType} ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'disabled');
    }
    for (const id of normalizeLoredeckTimelineDisabledIds(enableIds || [])) {
        addLoredeckPendingDiff(diffs, `${scopeType} ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'active');
    }
}
