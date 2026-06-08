/**
 * loredeck-loader.js -- Saga
 * Minimal Loredeck manifest, entry-file loading, and Deck Health helpers.
 *
 * This module is intentionally data-only: it does not own canon scoring,
 * preprocessing, prompt injection, or UI state.
 */

import { normalizeLoreEntry } from './lore-matrix.js';
import { resolveLoredeckStackItems } from './loredeck-library-index.js';
import { DEFAULT_HP_LOREDECK_ID } from './loredeck-defaults.js';

export const DEFAULT_LOREDECK_ID = DEFAULT_HP_LOREDECK_ID;
export const DEFAULT_LOREDECK_MANIFEST_URL = new URL(`./Loredecks/${DEFAULT_LOREDECK_ID}/loredeck.json`, import.meta.url);
export const LOREDECK_INDEX_URL = new URL('./Loredecks/index.json', import.meta.url);

export async function fetchJson(url, fallback = null) {
    const result = await fetchJsonDetailed(url);
    return result.ok ? result.json : fallback;
}

async function fetchJsonDetailed(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                statusText: response.statusText || '',
                error: `HTTP ${response.status}`,
            };
        }
        try {
            return { ok: true, json: await response.json() };
        } catch (e) {
            return { ok: false, status: response.status, error: e?.message || 'Invalid JSON' };
        }
    } catch (e) {
        return { ok: false, status: 0, error: e?.message || 'Fetch failed' };
    }
}

function createHealth(packId = '') {
    return {
        schemaVersion: 1,
        packId,
        generatedAt: Date.now(),
        status: 'unknown',
        errors: [],
        warnings: [],
        suggestions: [],
        summary: {
            entryCount: 0,
            fileCount: 0,
            loadedFileCount: 0,
            missingFileCount: 0,
            duplicateEntryIdCount: 0,
            missingEntryIdCount: 0,
            entryOverrideCount: 0,
            entryAdditionCount: 0,
            disabledEntryIdCount: 0,
            suppressedEntryCount: 0,
            timelineAnchorCount: 0,
            timelineWindowCount: 0,
            timelineCandidateCount: 0,
            timelineReferencedAnchorCount: 0,
            timelineGatesPerCandidate: 0,
            timelineDensificationSuggestionCount: 0,
            contextGateCount: 0,
            brokenAnchorReferenceCount: 0,
            invalidContextWindowCount: 0,
            unmatchableContextGateCount: 0,
            schemaV3EntryCount: 0,
            schemaV3IssueCount: 0,
            manifestStatsMismatchCount: 0,
            tagRegistryTagCount: 0,
            undefinedTagCount: 0,
            deprecatedTagUsageCount: 0,
            duplicateTagAliasCount: 0,
            orphanedTagCount: 0,
            malformedTagCount: 0,
            categoryCounts: {},
            errorCount: 0,
            warningCount: 0,
            suggestionCount: 0,
        },
    };
}

function addHealthIssue(health, severity, code, message, extra = {}) {
    const issue = {
        code,
        severity,
        message,
        ...extra,
    };
    if (severity === 'error') health.errors.push(issue);
    else if (severity === 'warning') health.warnings.push(issue);
    else health.suggestions.push(issue);
}

function finalizeHealth(health) {
    health.summary.errorCount = health.errors.length;
    health.summary.warningCount = health.warnings.length;
    health.summary.suggestionCount = health.suggestions.length;
    health.status = health.errors.length
        ? 'has_errors'
        : health.warnings.length
            ? 'needs_review'
            : 'good';
    return health;
}

function entryListFromJson(json) {
    if (Array.isArray(json?.entries)) return json.entries;
    if (Array.isArray(json)) return json;
    return [];
}

function cleanHealthString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function normalizeHealthIdList(value = [], limit = 1000, maxLength = 180) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const raw of value) {
        const id = cleanHealthString(raw, maxLength);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        output.push(id);
        if (output.length >= limit) break;
    }
    return output;
}

function cleanHealthNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function cleanTagIdForHealth(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, ' ')
        .slice(0, 96)
        .trim();
}

function cleanTagLabelForHealth(value = '', maxLength = 180) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength).trim();
}

function getTagRegistryRef(manifest = {}) {
    if (!isPlainObject(manifest)) return '';
    const registries = isPlainObject(manifest.registries) ? manifest.registries : {};
    const refs = [
        typeof registries.tags === 'string' ? registries.tags : '',
        typeof manifest.tagRegistry === 'string' ? manifest.tagRegistry : '',
        typeof manifest.tagsRegistry === 'string' ? manifest.tagsRegistry : '',
    ];
    for (const ref of refs) {
        const cleaned = cleanHealthString(ref, 400);
        if (cleaned) return cleaned;
    }
    return '';
}

function normalizeHealthTagList(value, limit = 64, normalizeIds = false) {
    const rawItems = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const out = [];
    const seen = new Set();
    for (const raw of rawItems) {
        const text = normalizeIds ? cleanTagIdForHealth(raw) : cleanTagLabelForHealth(raw, 160);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= limit) break;
    }
    return out;
}

function normalizeTagRegistryDefinitionForHealth(raw = {}, tagId = '') {
    const input = isPlainObject(raw) ? raw : {};
    const id = cleanTagIdForHealth(input.id || tagId);
    return {
        id,
        label: cleanTagLabelForHealth(input.label || '', 180),
        description: cleanHealthString(input.description || '', 1000),
        color: cleanHealthString(input.color || '', 32),
        textColor: cleanHealthString(input.textColor || '', 32),
        aliases: normalizeHealthTagList(input.aliases, 64, false),
        parents: normalizeHealthTagList(input.parents, 64, true),
        sensitive: input.sensitive === true,
        deprecated: input.deprecated === true,
        replacement: cleanTagIdForHealth(input.replacement || ''),
    };
}

function normalizeTagRegistryForHealth(raw = {}) {
    if (!isPlainObject(raw)) return { tags: [] };
    const source = isPlainObject(raw.tags) ? raw.tags : raw;
    const tags = [];
    let count = 0;
    for (const [rawId, rawDef] of Object.entries(source || {})) {
        if (!isPlainObject(rawDef)) continue;
        const id = cleanTagIdForHealth(rawDef.id || rawId);
        if (!id) continue;
        tags.push(normalizeTagRegistryDefinitionForHealth(rawDef, id));
        count += 1;
        if (count >= 2000) break;
    }
    return { tags };
}

function createEmptyTagRegistryHealthIndex(packId = '', tagRegistryRef = '') {
    return {
        packId,
        tagRegistryRef,
        hasSourceRegistry: false,
        hasCustomRegistry: false,
        hasRegistry: false,
        definitions: [],
        definitionById: new Map(),
        sourceDefinitionById: new Map(),
        customDefinitionById: new Map(),
    };
}

function createTagRegistryHealthIndex(options = {}) {
    const packId = cleanHealthString(options.packId, 160);
    const tagRegistryRef = cleanHealthString(options.tagRegistryRef, 400);
    const sourceRegistry = normalizeTagRegistryForHealth(options.sourceRegistry);
    const customRegistry = normalizeTagRegistryForHealth(options.customRegistry);
    const sourceDefinitionById = new Map();
    const customDefinitionById = new Map();
    const definitionById = new Map();

    for (const def of sourceRegistry.tags || []) {
        const id = cleanTagIdForHealth(def.id);
        if (!id || sourceDefinitionById.has(id)) continue;
        sourceDefinitionById.set(id, { ...def, id });
        definitionById.set(id, { ...def, id, sourceDefined: true, customDefined: false });
    }
    for (const def of customRegistry.tags || []) {
        const id = cleanTagIdForHealth(def.id);
        if (!id || customDefinitionById.has(id)) continue;
        customDefinitionById.set(id, { ...def, id });
        definitionById.set(id, {
            ...(definitionById.get(id) || {}),
            ...def,
            id,
            sourceDefined: definitionById.has(id),
            customDefined: true,
        });
    }

    return {
        packId,
        tagRegistryRef,
        hasSourceRegistry: options.hasSourceRegistry === true || sourceDefinitionById.size > 0,
        hasCustomRegistry: customDefinitionById.size > 0,
        hasRegistry: options.hasSourceRegistry === true || sourceDefinitionById.size > 0 || customDefinitionById.size > 0,
        definitions: Array.from(definitionById.values()),
        definitionById,
        sourceDefinitionById,
        customDefinitionById,
    };
}

function addTagHealthIssue(health, severity, code, message, extra = {}) {
    if (code === 'undefined_tag') health.summary.undefinedTagCount += Number(extra.affectedTagCount || 1) || 1;
    if (code === 'deprecated_tag_used') health.summary.deprecatedTagUsageCount += Number(extra.affectedTagCount || 1) || 1;
    if (code === 'duplicate_tag_alias') health.summary.duplicateTagAliasCount += Number(extra.affectedAliasCount || 1) || 1;
    if (code === 'orphaned_tag_definition') health.summary.orphanedTagCount += Number(extra.affectedTagCount || 1) || 1;
    if (['malformed_tag_namespace', 'malformed_tag_id', 'malformed_tag_reference'].includes(code)) {
        health.summary.malformedTagCount += Number(extra.affectedTagCount || 1) || 1;
    }
    addHealthIssue(health, severity, code, message, extra);
}

function getTagIdFormatProblems(tagId = '') {
    const tag = cleanHealthString(tagId, 120);
    const problems = [];
    if (!tag) return ['empty tag id'];
    if (cleanTagIdForHealth(tag) !== tag) problems.push('contains unsupported characters');
    if (/\s/.test(tag)) problems.push('contains whitespace');
    if (tag.includes(':')) {
        const [namespace, ...rest] = tag.split(':');
        const value = rest.join(':');
        if (!namespace || !value) problems.push('has an incomplete namespace');
        if (namespace && !/^[\p{L}\p{N}_.-]+$/u.test(namespace)) problems.push('has an invalid namespace');
    }
    return problems;
}

function isBundledManifest(manifest = {}) {
    return cleanHealthString(manifest.type, 80) === 'bundled';
}

function parseIsoDateSortKey(value = '') {
    const match = cleanHealthString(value, 80).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const epoch = Date.UTC(year, month - 1, day);
    const check = new Date(epoch);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
    return Math.floor(epoch / 86400000);
}

function normalizeTimelineHealthDateRange(value = {}) {
    const input = isPlainObject(value) ? value : {};
    return {
        from: cleanHealthString(input.from || input.start || input.validFrom, 80),
        to: cleanHealthString(input.to || input.end || input.validTo, 80),
    };
}

function getTimelineRegistryRef(manifest = {}) {
    if (!isPlainObject(manifest)) return '';
    const registries = isPlainObject(manifest.registries) ? manifest.registries : {};
    const refs = [
        registries.timeline,
        registries.context,
        manifest.timeline,
        isPlainObject(manifest.context) ? manifest.context.timeline : '',
        manifest.contextIndex,
    ];
    for (const ref of refs) {
        const cleaned = cleanHealthString(ref, 400);
        if (cleaned) return cleaned;
    }
    return '';
}

function getTimelineRegistryWindowList(registry = {}) {
    if (!isPlainObject(registry)) return [];
    return [
        ...(Array.isArray(registry.windows) ? registry.windows : []),
        ...(Array.isArray(registry.arcs) ? registry.arcs : []),
        ...(Array.isArray(registry.phases) ? registry.phases : []),
    ];
}

function mergeTimelineArrayById(sourceItems = [], customItems = [], disabledIds = []) {
    const disabled = new Set(normalizeHealthIdList(disabledIds));
    const map = new Map();
    for (const raw of Array.isArray(sourceItems) ? sourceItems : []) {
        if (!isPlainObject(raw)) continue;
        const id = cleanHealthString(raw.id, 180);
        if (!id || disabled.has(id)) continue;
        map.set(id, clonePlainObject(raw) || { ...raw, id });
    }
    for (const raw of Array.isArray(customItems) ? customItems : []) {
        if (!isPlainObject(raw)) continue;
        const id = cleanHealthString(raw.id, 180);
        if (!id || disabled.has(id)) continue;
        map.set(id, clonePlainObject({ ...raw, id }) || { ...raw, id });
    }
    return Array.from(map.values());
}

export function mergeLoredeckTimelineRegistries(sourceRegistry = null, customRegistry = null) {
    const source = isPlainObject(sourceRegistry) ? sourceRegistry : {};
    const custom = isPlainObject(customRegistry) ? customRegistry : {};
    const hasSource = Object.keys(source).length > 0;
    const hasCustom = Object.keys(custom).length > 0;
    if (!hasSource && !hasCustom) return null;

    const sourceBase = clonePlainObject(source) || {};
    delete sourceBase.anchors;
    delete sourceBase.windows;
    delete sourceBase.arcs;
    delete sourceBase.phases;

    const disabledAnchorIds = normalizeHealthIdList(custom.disabledAnchorIds || custom.disabledAnchors || []);
    const disabledWindowIds = normalizeHealthIdList(custom.disabledWindowIds || custom.disabledWindows || []);
    const merged = {
        ...sourceBase,
        schemaVersion: cleanHealthNumber(custom.schemaVersion) || cleanHealthNumber(source.schemaVersion) || 1,
        timelineMode: cleanHealthString(custom.timelineMode || source.timelineMode || 'hybrid', 80),
        defaultContextType: cleanHealthString(custom.defaultContextType || source.defaultContextType || '', 80),
        sortKeyScale: cleanHealthString(custom.sortKeyScale || source.sortKeyScale || 'pack_local', 160),
        summary: cleanHealthString(custom.summary || source.summary || source.description || '', 1000),
        axes: Array.isArray(custom.axes) && custom.axes.length
            ? (clonePlainObject(custom.axes) || [])
            : (Array.isArray(source.axes) ? (clonePlainObject(source.axes) || []) : []),
        anchors: mergeTimelineArrayById(source.anchors, custom.anchors, disabledAnchorIds),
        windows: mergeTimelineArrayById(getTimelineRegistryWindowList(source), getTimelineRegistryWindowList(custom), disabledWindowIds),
    };
    if (disabledAnchorIds.length) merged.disabledAnchorIds = disabledAnchorIds;
    if (disabledWindowIds.length) merged.disabledWindowIds = disabledWindowIds;
    return merged;
}

function normalizeTimelineHealthAnchor(raw = {}, packId = '', index = 0) {
    if (!isPlainObject(raw)) return null;
    const id = cleanHealthString(raw.id || `${packId || 'pack'}.anchor_${index + 1}`, 180);
    if (!id) return null;
    return {
        id,
        label: cleanHealthString(raw.label || raw.title || id, 240),
        sortKey: cleanHealthNumber(raw.sortKey) ?? index + 1,
        dateRange: normalizeTimelineHealthDateRange(raw.dateRange || raw.date || raw.canonTiming),
        arc: cleanHealthString(raw.arc, 180),
        phase: cleanHealthString(raw.phase, 180),
        season: cleanHealthString(raw.season, 80),
        episode: cleanHealthString(raw.episode, 80),
        chapter: cleanHealthString(raw.chapter, 80),
        issue: cleanHealthString(raw.issue, 80),
        quest: cleanHealthString(raw.quest, 180),
        gameStage: cleanHealthString(raw.gameStage, 180),
    };
}

function normalizeTimelineHealthWindow(raw = {}, packId = '', index = 0) {
    if (!isPlainObject(raw)) return null;
    const id = cleanHealthString(raw.id || `${packId || 'pack'}.window_${index + 1}`, 180);
    if (!id) return null;
    return {
        id,
        label: cleanHealthString(raw.label || raw.title || id, 240),
        anchorFrom: cleanHealthString(raw.anchorFrom || raw.from || raw.validFromAnchor, 180),
        anchorTo: cleanHealthString(raw.anchorTo || raw.to || raw.validToAnchor, 180),
        sortKeyFrom: cleanHealthNumber(raw.sortKeyFrom),
        sortKeyTo: cleanHealthNumber(raw.sortKeyTo),
        dateRange: normalizeTimelineHealthDateRange(raw.dateRange || raw.date),
    };
}

function normalizeTimelineRegistryForHealth(raw = {}, packId = '') {
    const input = isPlainObject(raw) ? raw : {};
    const anchors = Array.isArray(input.anchors)
        ? input.anchors.map((anchor, index) => normalizeTimelineHealthAnchor(anchor, packId, index)).filter(Boolean)
        : [];
    const windows = [
        ...(Array.isArray(input.windows) ? input.windows : []),
        ...(Array.isArray(input.arcs) ? input.arcs : []),
        ...(Array.isArray(input.phases) ? input.phases : []),
    ].map((window, index) => normalizeTimelineHealthWindow(window, packId, index)).filter(Boolean);
    return {
        sortKeyScale: cleanHealthString(input.sortKeyScale, 160),
        anchors,
        windows,
    };
}

function createTimelineHealthIndex(timeline = {}) {
    const anchorById = new Map();
    const duplicateAnchorIds = new Set();
    for (const anchor of timeline.anchors || []) {
        if (!anchor?.id) continue;
        if (anchorById.has(anchor.id)) duplicateAnchorIds.add(anchor.id);
        else anchorById.set(anchor.id, anchor);
    }
    return {
        ...timeline,
        anchorById,
        duplicateAnchorIds,
    };
}

function getAnchorSortKey(timeline = {}, anchorId = '') {
    const anchor = timeline.anchorById?.get(cleanHealthString(anchorId, 180));
    const number = cleanHealthNumber(anchor?.sortKey);
    return number === null ? null : number;
}

function getAnchorRangeEndSortKey(timeline = {}, anchorId = '') {
    const anchor = timeline.anchorById?.get(cleanHealthString(anchorId, 180));
    return parseIsoDateSortKey(anchor?.dateRange?.to || anchor?.dateRange?.from || '') ?? getAnchorSortKey(timeline, anchorId);
}

function addContextHealthIssue(health, severity, code, message, extra = {}) {
    if (code === 'broken_anchor_reference') health.summary.brokenAnchorReferenceCount += 1;
    if (code === 'invalid_context_window') health.summary.invalidContextWindowCount += 1;
    if (code === 'unmatchable_context_gate') health.summary.unmatchableContextGateCount += 1;
    addHealthIssue(health, severity, code, message, extra);
}

function addTimelineDensificationIssue(health, code, message, extra = {}) {
    health.summary.timelineDensificationSuggestionCount = (Number(health.summary.timelineDensificationSuggestionCount) || 0) + 1;
    addHealthIssue(health, 'suggestion', code, message, {
        policy: 'candidate_quality_not_alias_sprawl',
        ...extra,
    });
}

function analyzeTimelineWindowHealth(health, timeline = {}) {
    for (const anchorId of timeline.duplicateAnchorIds || []) {
        addContextHealthIssue(health, 'warning', 'duplicate_timeline_anchor_id', `Timeline defines duplicate anchor id: ${anchorId}.`, {
            anchorId,
            timelineRef: timeline.timelineRef,
        });
    }

    for (const window of timeline.windows || []) {
        const missingAnchors = [
            window.anchorFrom && !timeline.anchorById.has(window.anchorFrom) ? window.anchorFrom : '',
            window.anchorTo && !timeline.anchorById.has(window.anchorTo) ? window.anchorTo : '',
        ].filter(Boolean);
        if (missingAnchors.length) {
            addContextHealthIssue(health, 'warning', 'broken_anchor_reference', `Timeline window ${window.id} references unknown anchor${missingAnchors.length === 1 ? '' : 's'}: ${missingAnchors.join(', ')}.`, {
                anchorIds: missingAnchors,
                contextField: 'timelineWindow',
                timelineWindowId: window.id,
                timelineRef: timeline.timelineRef,
            });
        }

        const fromSort = window.sortKeyFrom ?? getAnchorSortKey(timeline, window.anchorFrom);
        const toSort = window.sortKeyTo ?? getAnchorSortKey(timeline, window.anchorTo);
        if (fromSort !== null && toSort !== null && fromSort > toSort) {
            addContextHealthIssue(health, 'warning', 'invalid_context_window', `Timeline window ${window.id} starts after it ends.`, {
                timelineWindowId: window.id,
                anchorFrom: window.anchorFrom,
                anchorTo: window.anchorTo,
                sortKeyFrom: fromSort,
                sortKeyTo: toSort,
                timelineRef: timeline.timelineRef,
            });
        }
    }
}

function analyzeTimelineDateDerivedSortKeys(health, timeline = {}) {
    if (timeline.sortKeyScale !== 'date-derived-day') return;

    for (const anchor of timeline.anchors || []) {
        const expected = parseIsoDateSortKey(anchor.dateRange?.from || '');
        if (expected === null) continue;
        if (Number(anchor.sortKey) !== expected) {
            addContextHealthIssue(health, 'warning', 'timeline_anchor_sortkey_mismatch', `Timeline anchor ${anchor.id} sortKey should match dateRange.from for date-derived-day timelines.`, {
                anchorId: anchor.id,
                sortKey: anchor.sortKey,
                expectedSortKey: expected,
                timelineRef: timeline.timelineRef,
            });
        }
    }

    for (const window of timeline.windows || []) {
        const expectedFrom = getAnchorSortKey(timeline, window.anchorFrom);
        const expectedTo = getAnchorRangeEndSortKey(timeline, window.anchorTo);
        if (expectedFrom !== null && Number(window.sortKeyFrom) !== expectedFrom) {
            addContextHealthIssue(health, 'warning', 'timeline_window_sortkey_mismatch', `Timeline window ${window.id} sortKeyFrom should match its start anchor for date-derived-day timelines.`, {
                timelineWindowId: window.id,
                anchorFrom: window.anchorFrom,
                sortKeyFrom: window.sortKeyFrom,
                expectedSortKeyFrom: expectedFrom,
                timelineRef: timeline.timelineRef,
            });
        }
        if (expectedTo !== null && Number(window.sortKeyTo) !== expectedTo) {
            addContextHealthIssue(health, 'warning', 'timeline_window_sortkey_mismatch', `Timeline window ${window.id} sortKeyTo should match its end anchor range end for date-derived-day timelines.`, {
                timelineWindowId: window.id,
                anchorTo: window.anchorTo,
                sortKeyTo: window.sortKeyTo,
                expectedSortKeyTo: expectedTo,
                timelineRef: timeline.timelineRef,
            });
        }
    }
}

async function loadTimelineRegistryForHealth(manifest = {}, baseUrl = null, health, registryRecord = null) {
    const packId = cleanHealthString(manifest.id || health?.packId, 160);
    const timelineRef = getTimelineRegistryRef(manifest);
    const empty = {
        packId,
        timelineRef,
        hasTimelineRef: !!timelineRef,
        anchors: [],
        windows: [],
        anchorById: new Map(),
        duplicateAnchorIds: new Set(),
    };
    let sourceRegistry = isPlainObject(manifest.timelineRegistry) ? manifest.timelineRegistry : null;
    let hasTimelineRef = !!timelineRef;

    if (timelineRef && baseUrl) {
        let timelineUrl = null;
        try {
            timelineUrl = new URL(timelineRef, baseUrl);
        } catch (_) {
            addHealthIssue(health, 'warning', 'context_timeline_invalid_ref', `Timeline registry path is invalid: ${timelineRef}.`, {
                timelineRef,
            });
            hasTimelineRef = false;
        }

        if (timelineUrl) {
            const result = await fetchJsonDetailed(timelineUrl);
            if (!result.ok) {
                addHealthIssue(health, 'warning', 'context_timeline_load_failed', `Timeline registry failed to load: ${timelineRef}.`, {
                    timelineRef,
                    status: result.status,
                    detail: result.error || result.statusText || '',
                });
                hasTimelineRef = false;
            } else {
                sourceRegistry = result.json;
                hasTimelineRef = true;
            }
        }
    }

    const mergedRegistry = mergeLoredeckTimelineRegistries(sourceRegistry, registryRecord?.timelineRegistry);
    if (!mergedRegistry) return empty;

    const timeline = createTimelineHealthIndex({
        ...normalizeTimelineRegistryForHealth(mergedRegistry, packId),
        packId,
        timelineRef,
        hasTimelineRef: hasTimelineRef || !!registryRecord?.timelineRegistry,
    });
    health.summary.timelineAnchorCount = timeline.anchors.length;
    health.summary.timelineWindowCount = timeline.windows.length;
    if (!timeline.anchors.length && !timeline.windows.length) {
        addHealthIssue(health, 'suggestion', 'context_timeline_empty', `Timeline registry ${timelineRef} has no anchors or windows.`, {
            timelineRef,
        });
    }
    analyzeTimelineWindowHealth(health, timeline);
    analyzeTimelineDateDerivedSortKeys(health, timeline);
    return timeline;
}

async function loadTagRegistryForHealth(manifest = {}, baseUrl = null, health, registryRecord = null) {
    const packId = cleanHealthString(manifest.id || health?.packId, 160);
    const tagRegistryRef = getTagRegistryRef(manifest);
    let sourceRegistry = isPlainObject(manifest.tagRegistry) ? manifest.tagRegistry : null;
    let hasSourceRegistry = !!sourceRegistry || !!tagRegistryRef;

    if (tagRegistryRef && baseUrl) {
        let tagRegistryUrl = null;
        try {
            tagRegistryUrl = new URL(tagRegistryRef, baseUrl);
        } catch (_) {
            addHealthIssue(health, 'warning', 'tag_registry_invalid_ref', `Tag registry path is invalid: ${tagRegistryRef}.`, {
                tagRegistryRef,
            });
            hasSourceRegistry = false;
        }

        if (tagRegistryUrl) {
            const result = await fetchJsonDetailed(tagRegistryUrl);
            if (!result.ok) {
                addHealthIssue(health, 'warning', 'tag_registry_load_failed', `Tag registry failed to load: ${tagRegistryRef}.`, {
                    tagRegistryRef,
                    status: result.status,
                    detail: result.error || result.statusText || '',
                });
                hasSourceRegistry = false;
            } else {
                sourceRegistry = result.json;
                hasSourceRegistry = true;
            }
        }
    }

    const tagIndex = createTagRegistryHealthIndex({
        packId,
        tagRegistryRef,
        sourceRegistry,
        customRegistry: registryRecord?.tagRegistry,
        hasSourceRegistry,
    });
    health.summary.tagRegistryTagCount = tagIndex.definitions.length;
    analyzeTagRegistryDefinitionHealth(health, tagIndex, manifest);
    return tagIndex;
}

function hasFiniteContextNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function hasContextGate(contextGate = {}, coordinates = []) {
    const fields = [
        'scope',
        'anchorId',
        'validFromAnchor',
        'validToAnchor',
        'arc',
        'arcId',
        'phase',
        'phaseId',
        'season',
        'episode',
        'chapter',
        'issue',
        'quest',
        'gameStage',
        'stardateFrom',
        'stardateTo',
    ];
    if (fields.some(field => cleanHealthString(contextGate[field]))) return true;
    if (hasFiniteContextNumber(contextGate.sortKeyFrom) || hasFiniteContextNumber(contextGate.sortKeyTo)) return true;
    return Array.isArray(coordinates) && coordinates.some(item => isPlainObject(item)
        && [item.axis, item.id, item.from, item.to].some(value => cleanHealthString(value)));
}

function getEntryAnchorReferences(contextGate = {}) {
    return [
        ['anchorId', cleanHealthString(contextGate.anchorId, 180)],
        ['validFromAnchor', cleanHealthString(contextGate.validFromAnchor, 180)],
        ['validToAnchor', cleanHealthString(contextGate.validToAnchor, 180)],
    ].filter(([, anchorId]) => anchorId);
}

function hasOnlyAnchorOrWindowContextGate(contextGate = {}, coordinates = []) {
    const nonAnchorFields = [
        'arc',
        'arcId',
        'phase',
        'phaseId',
        'season',
        'episode',
        'chapter',
        'issue',
        'quest',
        'gameStage',
        'stardateFrom',
        'stardateTo',
    ];
    return getEntryAnchorReferences(contextGate).length > 0
        && !nonAnchorFields.some(field => cleanHealthString(contextGate[field]))
        && (!Array.isArray(coordinates) || coordinates.length === 0);
}

function analyzeEntryContextWindowHealth(health, entry, file, timeline = {}) {
    const contextGate = entry.context || {};
    const entryId = cleanHealthString(entry.id, 180);
    const invalidReasons = [];

    const explicitFromSort = hasFiniteContextNumber(contextGate.sortKeyFrom) ? Number(contextGate.sortKeyFrom) : null;
    const explicitToSort = hasFiniteContextNumber(contextGate.sortKeyTo) ? Number(contextGate.sortKeyTo) : null;
    const anchorFromSort = getAnchorSortKey(timeline, contextGate.validFromAnchor);
    const anchorToSort = getAnchorSortKey(timeline, contextGate.validToAnchor);
    const fromSort = explicitFromSort ?? anchorFromSort;
    const toSort = explicitToSort ?? anchorToSort;

    if (explicitFromSort !== null && explicitToSort !== null && explicitFromSort > explicitToSort) {
        invalidReasons.push(`sortKeyFrom ${explicitFromSort} is after sortKeyTo ${explicitToSort}`);
    } else if (fromSort !== null && toSort !== null && fromSort > toSort) {
        invalidReasons.push(`from anchor/sort ${fromSort} is after to anchor/sort ${toSort}`);
    }

    if (!invalidReasons.length) return [];

    addContextHealthIssue(health, 'warning', 'invalid_context_window', `Entry ${entryId || entry.title} has an invalid Context window: ${invalidReasons.join('; ')}.`, {
        entryIds: entryId ? [entryId] : [],
        file,
        anchorFrom: contextGate.validFromAnchor || '',
        anchorTo: contextGate.validToAnchor || '',
        sortKeyFrom: fromSort,
        sortKeyTo: toSort,
    });
    return invalidReasons;
}

function analyzeEntryAnchorReferenceHealth(health, entry, file, timeline = {}) {
    const entryId = cleanHealthString(entry.id, 180);
    const missing = [];
    for (const [field, anchorId] of getEntryAnchorReferences(entry.context || {})) {
        if (timeline.anchorById?.has(anchorId)) continue;
        missing.push({ field, anchorId });
    }
    if (!missing.length) return [];

    const anchorIds = missing.map(item => item.anchorId);
    addContextHealthIssue(health, 'warning', 'broken_anchor_reference', `Entry ${entryId || entry.title} references unknown Context anchor${anchorIds.length === 1 ? '' : 's'}: ${anchorIds.join(', ')}.`, {
        entryIds: entryId ? [entryId] : [],
        file,
        anchorIds,
        contextFields: missing.map(item => item.field),
    });
    return missing.map(item => `unknown ${item.field} ${item.anchorId}`);
}

function analyzeEntryContextHealth(health, entryFiles = [], timeline = {}) {
    let contextGateCount = 0;
    let anchorReferenceGateCount = 0;
    const noTimelineEntryIds = [];
    const referencedAnchorIds = new Set();

    for (const fileRecord of entryFiles) {
        for (const rawEntry of fileRecord.entries || []) {
            const entry = normalizeLoreEntry(rawEntry);
            const contextGate = entry.context || {};
            const coordinates = Array.isArray(entry.coordinates) ? entry.coordinates : [];
            if (!hasContextGate(contextGate, coordinates)) continue;

            contextGateCount += 1;
            const entryId = cleanHealthString(entry.id, 180);
            const anchorRefs = getEntryAnchorReferences(contextGate);
            if (anchorRefs.length) {
                anchorReferenceGateCount += 1;
                for (const [, anchorId] of anchorRefs) referencedAnchorIds.add(anchorId);
            }
            if (anchorRefs.length && !timeline.hasTimelineRef) {
                if (entryId) noTimelineEntryIds.push(entryId);
                continue;
            }

            const impossibleReasons = [];
            if (timeline.hasTimelineRef) {
                impossibleReasons.push(...analyzeEntryAnchorReferenceHealth(health, entry, fileRecord.file, timeline));
            }
            impossibleReasons.push(...analyzeEntryContextWindowHealth(health, entry, fileRecord.file, timeline));

            if (impossibleReasons.length && hasOnlyAnchorOrWindowContextGate(contextGate, coordinates)) {
                addContextHealthIssue(health, 'warning', 'unmatchable_context_gate', `Entry ${entryId || entry.title} has a Context gate that cannot match known anchors: ${impossibleReasons.join('; ')}.`, {
                    entryIds: entryId ? [entryId] : [],
                    file: fileRecord.file,
                    reasons: impossibleReasons,
                });
            }
        }
    }

    health.summary.contextGateCount = contextGateCount;
    if (anchorReferenceGateCount && !timeline.hasTimelineRef) {
        addHealthIssue(health, 'suggestion', 'context_gates_without_timeline', `${anchorReferenceGateCount} Lorecard${anchorReferenceGateCount === 1 ? ' uses' : 's use'} anchor-based Context gates, but this Loredeck has no timeline registry.`, {
            entryIds: noTimelineEntryIds.slice(0, 50),
            affectedEntryCount: anchorReferenceGateCount,
        });
    }
    analyzeTimelineDensificationHealth(health, {
        timeline,
        contextGateCount,
        anchorReferenceGateCount,
        referencedAnchorIds,
    });
}

function analyzeTimelineDensificationHealth(health, metrics = {}) {
    const timeline = metrics.timeline || {};
    const contextGateCount = Number(metrics.contextGateCount) || 0;
    const anchorReferenceGateCount = Number(metrics.anchorReferenceGateCount) || 0;
    const referencedAnchorIds = metrics.referencedAnchorIds instanceof Set ? metrics.referencedAnchorIds : new Set();
    const anchorCount = Array.isArray(timeline.anchors) ? timeline.anchors.length : 0;
    const windowCount = Array.isArray(timeline.windows) ? timeline.windows.length : 0;
    const candidateCount = anchorCount + windowCount;

    health.summary.timelineCandidateCount = candidateCount;
    health.summary.timelineReferencedAnchorCount = referencedAnchorIds.size;
    health.summary.timelineGatesPerCandidate = candidateCount
        ? Number((contextGateCount / candidateCount).toFixed(2))
        : 0;

    if (!timeline.hasTimelineRef || contextGateCount < 24) return;

    const recommendedMinimum = Math.min(80, Math.max(8, Math.ceil(contextGateCount / 10)));
    const gatesPerCandidate = candidateCount ? contextGateCount / candidateCount : contextGateCount;
    if (candidateCount < 8 || gatesPerCandidate > 14) {
        addTimelineDensificationIssue(
            health,
            'timeline_candidate_sparse',
            `Timeline has ${candidateCount} durable candidate${candidateCount === 1 ? '' : 's'} for ${contextGateCount} Context-gated Lorecards. Add high-value recurring story anchors/windows rather than aliases for every phrase.`,
            {
                contextGateCount,
                timelineCandidateCount: candidateCount,
                timelineAnchorCount: anchorCount,
                timelineWindowCount: windowCount,
                gatesPerCandidate: Number(gatesPerCandidate.toFixed(2)),
                recommendedMinimum,
            }
        );
    }

    if (anchorReferenceGateCount >= 32 && referencedAnchorIds.size > 0 && referencedAnchorIds.size <= 3) {
        addTimelineDensificationIssue(
            health,
            'timeline_anchor_coverage_concentrated',
            `${anchorReferenceGateCount} anchor-based Context gate${anchorReferenceGateCount === 1 ? '' : 's'} reference only ${referencedAnchorIds.size} unique anchor${referencedAnchorIds.size === 1 ? '' : 's'}. Add durable waypoints for major story turns, not exhaustive keyword aliases.`,
            {
                anchorReferenceGateCount,
                referencedAnchorCount: referencedAnchorIds.size,
                anchorIds: [...referencedAnchorIds].slice(0, 20),
            }
        );
    }

    if (windowCount === 0 && anchorCount >= 2 && contextGateCount >= 24) {
        addTimelineDensificationIssue(
            health,
            'timeline_windows_missing',
            `Timeline has ${anchorCount} anchor${anchorCount === 1 ? '' : 's'} but no broad windows for ${contextGateCount} Context-gated Lorecards. Add arc/year/phase windows so users can choose story ranges cleanly.`,
            {
                contextGateCount,
                timelineAnchorCount: anchorCount,
                timelineWindowCount: windowCount,
            }
        );
    }
}

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

const SCHEMA_V3_POSITION_SCOPES = new Set(['anchor', 'window', 'global']);

function addSchemaV3HealthIssue(health, severity, code, message, extra = {}) {
    health.summary.schemaV3IssueCount = (Number(health.summary.schemaV3IssueCount) || 0) + 1;
    addHealthIssue(health, severity, code, message, extra);
}

function isSchemaV3Entry(entry = {}, fileRecord = {}) {
    return Number(entry?.schemaVersion ?? fileRecord?.schemaVersion) >= 3;
}

function hasNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function getSchemaV3EntryLabel(entry = {}) {
    return cleanHealthString(entry.id || entry.title || '(missing id)', 180);
}

function analyzeSchemaV3EntryHealth(health, entry = {}, fileRecord = {}) {
    if (!isSchemaV3Entry(entry, fileRecord)) return;

    health.summary.schemaV3EntryCount = (Number(health.summary.schemaV3EntryCount) || 0) + 1;
    const id = cleanHealthString(entry?.id, 180);
    const label = getSchemaV3EntryLabel(entry);
    const file = fileRecord.file;
    const entryIds = id ? [id] : [];
    const contextGate = isPlainObject(entry.context) ? entry.context : null;
    const retrieval = isPlainObject(entry.retrieval) ? entry.retrieval : null;
    const content = isPlainObject(entry.content) ? entry.content : {};

    const presentLegacyFields = SCHEMA_V3_LEGACY_ENTRY_FIELDS.filter(field => Object.prototype.hasOwnProperty.call(entry || {}, field));
    if (presentLegacyFields.length) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_legacy_timing_fields', `Schema v3 entry ${label} still has legacy timing fields: ${presentLegacyFields.join(', ')}.`, {
            entryIds,
            file,
            fields: presentLegacyFields,
        });
    }

    if (!contextGate) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context', `Schema v3 entry ${label} is missing a Context block.`, {
            entryIds,
            file,
        });
    } else {
        const scope = cleanHealthString(contextGate.scope, 60);
        if (!SCHEMA_V3_POSITION_SCOPES.has(scope)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_invalid_context_scope', `Schema v3 entry ${label} must declare context.scope as anchor, window, or global.`, {
                entryIds,
                file,
                scope,
            });
        }
        if (!hasFiniteContextNumber(contextGate.sortKeyFrom) || !hasFiniteContextNumber(contextGate.sortKeyTo)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context_sort_keys', `Schema v3 entry ${label} must define numeric context.sortKeyFrom and context.sortKeyTo.`, {
                entryIds,
                file,
            });
        }
        if (!hasNonEmptyString(contextGate.precision)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context_precision', `Schema v3 entry ${label} must define context.precision.`, {
                entryIds,
                file,
            });
        }
        if (!hasNonEmptyString(contextGate.label)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_context_label', `Schema v3 entry ${label} must define a human-readable context.label.`, {
                entryIds,
                file,
            });
        }
    }

    if (!retrieval) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_retrieval', `Schema v3 entry ${label} is missing retrieval metadata.`, {
            entryIds,
            file,
        });
    } else {
        const missing = ['activation', 'frequency', 'contextBoost'].filter(field => !hasNonEmptyString(retrieval[field]));
        if (missing.length) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_incomplete_retrieval', `Schema v3 entry ${label} has incomplete retrieval metadata: ${missing.join(', ')}.`, {
                entryIds,
                file,
                fields: missing,
            });
        }
    }

    if (!hasNonEmptyString(content.fact) || !hasNonEmptyString(content.injection)) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_content', `Schema v3 entry ${label} must define content.fact and content.injection.`, {
            entryIds,
            file,
            missingFields: [
                !hasNonEmptyString(content.fact) ? 'content.fact' : '',
                !hasNonEmptyString(content.injection) ? 'content.injection' : '',
            ].filter(Boolean),
        });
    }

    if (contextGate && retrieval) {
        const from = Number(contextGate.sortKeyFrom);
        const to = Number(contextGate.sortKeyTo);
        const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from + 1) : null;
        const wide = contextGate.scope === 'global'
            || ['series', 'wide'].includes(cleanHealthString(contextGate.windowKind, 80))
            || (span !== null && span >= 365);
        if (wide) {
            const expected = {
                activation: 'topic_or_entity',
                frequency: 'low',
                contextBoost: 'low',
            };
            const mismatches = Object.entries(expected)
                .filter(([field, value]) => cleanHealthString(retrieval[field], 80) !== value)
                .map(([field, value]) => `${field}=${value}`);
            if (mismatches.length) {
                addSchemaV3HealthIssue(health, 'warning', 'schema_v3_wide_lore_retrieval', `Schema v3 wide entry ${label} should use conservative retrieval metadata: ${mismatches.join(', ')}.`, {
                    entryIds,
                    file,
                    expected,
                    actual: {
                        activation: cleanHealthString(retrieval.activation, 80),
                        frequency: cleanHealthString(retrieval.frequency, 80),
                        contextBoost: cleanHealthString(retrieval.contextBoost, 80),
                    },
                });
            }
        }
    }
}

function createInMemoryTagRegistryHealthIndex(manifest = {}, tagRegistry = null, registryRecord = null, health) {
    const packId = cleanHealthString(manifest.id || health?.packId, 160);
    const tagRegistryRef = getTagRegistryRef(manifest);
    const sourceRegistry = isPlainObject(tagRegistry)
        ? tagRegistry
        : (isPlainObject(manifest.tagRegistry) ? manifest.tagRegistry : null);
    const tagIndex = createTagRegistryHealthIndex({
        packId,
        tagRegistryRef,
        sourceRegistry,
        customRegistry: registryRecord?.tagRegistry,
        hasSourceRegistry: !!sourceRegistry || !!tagRegistryRef,
    });
    health.summary.tagRegistryTagCount = tagIndex.definitions.length;
    analyzeTagRegistryDefinitionHealth(health, tagIndex, manifest);
    return tagIndex;
}

function analyzeTagIdHealth(health, tagId = '', context = {}) {
    const problems = getTagIdFormatProblems(tagId);
    if (!problems.length) return;
    addTagHealthIssue(health, 'warning', 'malformed_tag_namespace', `Tag ${tagId || '(empty)'} has malformed namespace/id syntax: ${problems.join(', ')}.`, {
        tagIds: tagId ? [tagId] : [],
        entryIds: context.entryId ? [context.entryId] : [],
        file: context.file || '',
        registryTag: context.registryTag === true,
        reasons: problems,
    });
}

function analyzeTagRegistryDefinitionHealth(health, tagIndex = {}, manifest = {}) {
    const aliasMap = new Map();

    for (const def of tagIndex.definitions || []) {
        analyzeTagIdHealth(health, def.id, { registryTag: true });

        for (const parent of def.parents || []) {
            analyzeTagIdHealth(health, parent, { registryTag: true });
            if (tagIndex.definitionById?.has(parent)) continue;
            addTagHealthIssue(health, 'warning', 'tag_parent_missing', `Tag ${def.id} references unknown parent tag ${parent}.`, {
                tagIds: [def.id, parent],
                parentTagId: parent,
            });
        }

        if (def.replacement) {
            analyzeTagIdHealth(health, def.replacement, { registryTag: true });
            if (!tagIndex.definitionById?.has(def.replacement)) {
                addTagHealthIssue(health, 'warning', 'deprecated_tag_replacement_missing', `Deprecated tag ${def.id} references unknown replacement tag ${def.replacement}.`, {
                    tagIds: [def.id, def.replacement],
                    replacementTagId: def.replacement,
                });
            }
        }

        for (const alias of def.aliases || []) {
            const key = alias.toLowerCase();
            if (!key) continue;
            if (!aliasMap.has(key)) aliasMap.set(key, []);
            aliasMap.get(key).push(def.id);
        }

        if (isBundledManifest(manifest) && !def.id.includes(':')) {
            addHealthIssue(health, 'suggestion', 'unnamespaced_bundled_tag', `Bundled tag ${def.id} should use a namespace like namespace:value.`, {
                tagIds: [def.id],
            });
        }
    }

    const duplicates = [];
    for (const [alias, tagIds] of aliasMap.entries()) {
        const unique = Array.from(new Set(tagIds));
        if (unique.length > 1) duplicates.push({ alias, tagIds: unique });
    }
    if (duplicates.length) {
        addTagHealthIssue(health, 'warning', 'duplicate_tag_alias', `${duplicates.length} tag alias${duplicates.length === 1 ? '' : 'es'} resolve to multiple tag definitions.`, {
            affectedAliasCount: duplicates.length,
            aliases: duplicates.slice(0, 25),
        });
    }
}

function getEntryTagIdsForHealth(entry = {}) {
    return normalizeHealthTagList(Array.isArray(entry.tags) ? entry.tags : entry.tags || [], 128, false);
}

function analyzeEntryTagHealth(health, entryFiles = [], tagIndex = {}, manifest = {}) {
    const usageByTag = new Map();
    let entryTagCount = 0;

    for (const fileRecord of entryFiles || []) {
        for (const entry of fileRecord.entries || []) {
            const entryId = cleanHealthString(entry?.id, 180);
            const tags = getEntryTagIdsForHealth(entry);
            for (const tag of tags) {
                entryTagCount += 1;
                analyzeTagIdHealth(health, tag, { entryId, file: fileRecord.file });
                if (!usageByTag.has(tag)) {
                    usageByTag.set(tag, {
                        tag,
                        entryIds: [],
                        files: new Set(),
                    });
                }
                const usage = usageByTag.get(tag);
                if (entryId && usage.entryIds.length < 50) usage.entryIds.push(entryId);
                if (fileRecord.file) usage.files.add(fileRecord.file);
            }
        }
    }

    if (entryTagCount && !tagIndex.hasRegistry) {
        addHealthIssue(health, 'suggestion', 'tag_registry_missing', `${usageByTag.size} Lorecard tag${usageByTag.size === 1 ? ' is' : 's are'} used, but this Loredeck has no tag registry.`, {
            tagIds: Array.from(usageByTag.keys()).slice(0, 50),
            affectedTagCount: usageByTag.size,
        });
        return;
    }

    const undefinedTags = [];
    const deprecatedTags = [];
    for (const [tag, usage] of usageByTag.entries()) {
        const def = tagIndex.definitionById?.get(tag);
        if (!def) {
            undefinedTags.push({
                tag,
                entryIds: usage.entryIds,
                files: Array.from(usage.files).slice(0, 10),
            });
            continue;
        }
        if (def.deprecated) {
            deprecatedTags.push({
                tag,
                replacement: def.replacement || '',
                entryIds: usage.entryIds,
                files: Array.from(usage.files).slice(0, 10),
            });
        }
    }

    if (undefinedTags.length) {
        addTagHealthIssue(health, 'warning', 'undefined_tag', `${undefinedTags.length} used tag${undefinedTags.length === 1 ? ' is' : 's are'} not defined in the active tag registry.`, {
            affectedTagCount: undefinedTags.length,
            tags: undefinedTags.slice(0, 50),
        });
    }

    if (deprecatedTags.length) {
        addTagHealthIssue(health, 'warning', 'deprecated_tag_used', `${deprecatedTags.length} deprecated tag${deprecatedTags.length === 1 ? ' is' : 's are'} still used by entries.`, {
            affectedTagCount: deprecatedTags.length,
            tags: deprecatedTags.slice(0, 50),
        });
    }

    const referencedByRegistry = new Set();
    for (const def of tagIndex.definitions || []) {
        for (const parent of def.parents || []) referencedByRegistry.add(parent);
        if (def.replacement) referencedByRegistry.add(def.replacement);
    }
    const orphaned = (tagIndex.definitions || [])
        .map(def => def.id)
        .filter(tagId => !usageByTag.has(tagId) && !referencedByRegistry.has(tagId));
    if (orphaned.length) {
        addTagHealthIssue(health, 'suggestion', 'orphaned_tag_definition', `${orphaned.length} tag definition${orphaned.length === 1 ? ' is' : 's are'} not used by entries or registry relationships.`, {
            affectedTagCount: orphaned.length,
            tagIds: orphaned.slice(0, 50),
        });
    }
}

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

function analyzeManifestStatsHealth(health, manifest = {}) {
    const stats = isPlainObject(manifest.stats) ? manifest.stats : {};
    const expectedEntryCount = Number(stats.entryCount);
    if (Number.isFinite(expectedEntryCount) && expectedEntryCount !== health.summary.entryCount) {
        health.summary.manifestStatsMismatchCount += 1;
        addHealthIssue(health, 'warning', 'manifest_entry_count_mismatch', `Manifest stats.entryCount is ${expectedEntryCount}, but Deck Health counted ${health.summary.entryCount} loaded Lorecards.`, {
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

function analyzeManifestFileListHealth(health, manifest = {}) {
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

function createEmptyTimelineHealthIndex(packId = '', timelineRef = '') {
    return {
        packId,
        timelineRef,
        hasTimelineRef: false,
        anchors: [],
        windows: [],
        anchorById: new Map(),
        duplicateAnchorIds: new Set(),
    };
}

function createInMemoryTimelineHealthIndex(manifest = {}, timeline = null, health, registryRecord = null) {
    const packId = cleanHealthString(manifest.id || health?.packId, 160);
    const timelineRef = getTimelineRegistryRef(manifest);
    const mergedRegistry = mergeLoredeckTimelineRegistries(
        isPlainObject(timeline) ? timeline : (isPlainObject(manifest.timelineRegistry) ? manifest.timelineRegistry : null),
        registryRecord?.timelineRegistry
    );
    if (!mergedRegistry) return createEmptyTimelineHealthIndex(packId, timelineRef);

    const index = createTimelineHealthIndex({
        ...normalizeTimelineRegistryForHealth(mergedRegistry, packId),
        packId,
        timelineRef,
        hasTimelineRef: true,
    });
    health.summary.timelineAnchorCount = index.anchors.length;
    health.summary.timelineWindowCount = index.windows.length;
    if (!index.anchors.length && !index.windows.length) {
        addHealthIssue(health, 'suggestion', 'context_timeline_empty', `Timeline registry ${timelineRef || '(in-memory)'} has no anchors or windows.`, {
            timelineRef,
        });
    }
    analyzeTimelineWindowHealth(health, index);
    analyzeTimelineDateDerivedSortKeys(health, index);
    return index;
}

function schemaV3ContentFact(entry = {}) {
    const content = isPlainObject(entry.content) ? entry.content : {};
    return String(content.fact || entry.fact || entry.description || entry.detail || entry.text || entry.summary || '').trim();
}

function schemaV3ContentInjection(entry = {}, fact = '') {
    const content = isPlainObject(entry.content) ? entry.content : {};
    return String(content.injection || entry.injection || fact || '').trim();
}

export function normalizeLoredeckEntryForSchemaV3(entry = {}) {
    const next = clonePlainObject(entry) || {};
    const fact = schemaV3ContentFact(next);
    const injection = schemaV3ContentInjection(next, fact);
    next.schemaVersion = 3;
    next.content = {
        ...(isPlainObject(next.content) ? next.content : {}),
        fact,
        injection,
    };
    for (const field of SCHEMA_V3_LEGACY_ENTRY_FIELDS) {
        delete next[field];
    }
    return next;
}

export function repairLoredeckEntryForHealth(entry = {}, options = {}) {
    const forceSchemaV3 = options.forceSchemaVersion === 3 || Number(entry?.schemaVersion) >= 3;
    let next = forceSchemaV3 ? normalizeLoredeckEntryForSchemaV3(entry) : (clonePlainObject(entry) || {});
    if (forceSchemaV3) {
        const contextGate = isPlainObject(next.context) ? next.context : {};
        const from = Number(contextGate.sortKeyFrom);
        const to = Number(contextGate.sortKeyTo);
        const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from + 1) : null;
        const wide = contextGate.scope === 'global'
            || ['series', 'wide'].includes(cleanHealthString(contextGate.windowKind, 80))
            || (span !== null && span >= 365);
        if (wide) {
            next.retrieval = {
                ...(isPlainObject(next.retrieval) ? next.retrieval : {}),
                activation: 'topic_or_entity',
                frequency: 'low',
                contextBoost: 'low',
            };
        }
    }
    return next;
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
    const timeline = createInMemoryTimelineHealthIndex(manifest, options.timeline, health, options.registryRecord);
    const tagIndex = createInMemoryTagRegistryHealthIndex(manifest, options.tagRegistry, options.registryRecord, health);
    analyzeEntryContextHealth(health, finalEntryFiles, timeline);
    analyzeEntries(health, finalEntryFiles, manifest, tagIndex);
    return finalizeHealth(health);
}

function analyzeEntries(health, entryFiles = [], manifest = {}, tagIndex = createEmptyTagRegistryHealthIndex(health?.packId || '', getTagRegistryRef(manifest))) {
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

function sanitizeStackSource(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const type = input.type === 'folder' ? 'folder' : (input.type === 'deck' ? 'deck' : '');
    if (!type) return null;
    const output = { type };
    const stackItemId = String(input.stackItemId || '').trim();
    if (stackItemId) output.stackItemId = stackItemId;
    const folderId = String(input.folderId || '').trim();
    if (folderId) output.folderId = folderId;
    if (Array.isArray(input.folderPath)) {
        const folderPath = input.folderPath.map(item => String(item || '').trim()).filter(Boolean).slice(0, 12);
        if (folderPath.length) output.folderPath = folderPath;
    }
    return output;
}

function buildLoredeckMeta(manifest = {}, stackPriority = 100, stackIndex = 0, stackSource = null) {
    const id = manifest.id || DEFAULT_LOREDECK_ID;
    const sourceInfo = sanitizeStackSource(stackSource);
    return {
        id,
        type: manifest.type || 'bundled',
        title: manifest.title || 'Harry Potter: Core',
        derivedFrom: manifest.derivedFrom || null,
        disabledEntryIds: Array.isArray(manifest.disabledEntryIds) ? manifest.disabledEntryIds.map(id => String(id || '').trim()).filter(Boolean) : [],
        stackPriority,
        stackIndex,
        ...(sourceInfo ? { stackSource: sourceInfo } : {}),
    };
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function clonePlainObject(value) {
    if (!isPlainObject(value)) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return null;
    }
}

function buildEmbeddedManifest(registryRecord, packId) {
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
        if (output.size >= 500) break;
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

function isGeneratedRegistryRecord(registryRecord = null) {
    return String(registryRecord?.type || registryRecord?.manifestData?.type || '').trim() === 'generated';
}

function getAcceptedVirtualRegistryEntries(registryRecord = null, manifest = {}) {
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

function getAcceptedGeneratedRegistryEntries(registryRecord = null, manifest = {}) {
    if (!isGeneratedRegistryRecord(registryRecord)) return [];
    return getAcceptedVirtualRegistryEntries(registryRecord, manifest);
}

function buildVirtualEntryFilesFromRegistry(registryRecord = null, manifest = {}) {
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

function buildGeneratedEntryFilesFromRegistry(registryRecord = null, manifest = {}) {
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

function applyRegistryEntryOverrides(entryFiles = [], registryRecord = null, manifest = {}, health = null) {
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

function getLoredeckManifestUrl(packId, registryRecord = null) {
    const manifest = String(registryRecord?.manifest || '').trim();
    if (manifest) {
        try {
            return new URL(manifest, import.meta.url);
        } catch (_) {
            return null;
        }
    }
    if (registryRecord && isPlainObject(registryRecord.manifestData)) return null;
    const id = String(packId || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) return null;
    return new URL(`./Loredecks/${id}/loredeck.json`, import.meta.url);
}

function getRegistryRecord(registry, packId) {
    const packs = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs)
        ? registry.packs
        : {};
    return packs[String(packId || '').trim()] || null;
}

function buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex, stackSource = null) {
    const id = String(packId || registryRecord?.packId || '').trim();
    const sourceInfo = sanitizeStackSource(stackSource);
    return {
        id,
        type: registryRecord?.type || 'custom',
        title: registryRecord?.title || id,
        stackPriority,
        stackIndex,
        source: registryRecord?.source || {},
        ...(sourceInfo ? { stackSource: sourceInfo } : {}),
    };
}

async function loadEntryFiles(manifest = {}, baseUrl, health, registryRecord = null) {
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const entryFiles = [];
    health.summary.fileCount = files.length;
    analyzeManifestFileListHealth(health, manifest);

    for (const file of files) {
        const url = new URL(file, baseUrl);
        const result = await fetchJsonDetailed(url);
        if (!result.ok) {
            health.summary.missingFileCount += 1;
            addHealthIssue(health, 'error', 'missing_entry_file', `Loredeck entry file failed to load: ${file}.`, {
                file,
                status: result.status,
                detail: result.error || result.statusText || '',
            });
            entryFiles.push({ file, url, ok: false, entries: [], schemaVersion: 0, error: result.error || '' });
            continue;
        }

        const entries = entryListFromJson(result.json);
        health.summary.loadedFileCount += 1;
        entryFiles.push({
            file,
            url,
            ok: true,
            json: result.json,
            entries,
            schemaVersion: result.json?.schemaVersion || manifest.entrySchemaVersion || 2,
        });
    }

    const finalEntryFiles = applyRegistryEntryOverrides(entryFiles, registryRecord, manifest, health);
    const timeline = await loadTimelineRegistryForHealth(manifest, baseUrl, health, registryRecord);
    const tagIndex = await loadTagRegistryForHealth(manifest, baseUrl, health, registryRecord);
    analyzeEntryContextHealth(health, finalEntryFiles, timeline);
    analyzeEntries(health, finalEntryFiles, manifest, tagIndex);
    return finalEntryFiles;
}

export async function loadLoredeckSourceById(packId = DEFAULT_LOREDECK_ID, options = {}) {
    const registryRecord = options.registryRecord || getRegistryRecord(options.registry, packId);
    const generatedWithoutManifest = isGeneratedRegistryRecord(registryRecord) && !String(registryRecord?.manifest || '').trim();
    const manifestUrl = generatedWithoutManifest ? null : getLoredeckManifestUrl(packId, registryRecord);
    const stackPriority = Number.isFinite(Number(options.stackPriority)) ? Number(options.stackPriority) : 100;
    const stackIndex = Number.isFinite(Number(options.stackIndex)) ? Number(options.stackIndex) : 0;
    const stackSource = sanitizeStackSource(options.stackSource);
    const embeddedManifest = buildEmbeddedManifest(registryRecord, packId);
    if (embeddedManifest) {
        if (!manifestUrl) {
            const entryFiles = buildVirtualEntryFilesFromRegistry(registryRecord, embeddedManifest);
            if (isGeneratedRegistryRecord(registryRecord) || entryFiles.length) {
                const health = buildLoredeckHealthForData({
                    packId: embeddedManifest.id || packId,
                    manifest: embeddedManifest,
                    entryFiles,
                    timeline: registryRecord?.timelineRegistry || null,
                    tagRegistry: registryRecord?.tagRegistry || null,
                    registryRecord: null,
                });
                return {
                    manifest: embeddedManifest,
                    baseUrl: null,
                    sourceKind: isGeneratedRegistryRecord(registryRecord) ? 'generated_virtual' : 'custom_virtual',
                    registryRecord,
                    pack: {
                        ...buildLoredeckMeta(embeddedManifest, stackPriority, stackIndex, stackSource),
                        source: embeddedManifest.source || registryRecord?.source || {},
                    },
                    health,
                    entryFiles,
                };
            }
            const health = createHealth(embeddedManifest.id || packId);
            addHealthIssue(health, 'error', 'missing_virtual_loredeck_base_manifest', `Custom Loredeck ${embeddedManifest.id || packId} has embedded manifest metadata but no base manifest path for file resolution.`, {
                packId: embeddedManifest.id || packId,
            });
            return {
                manifest: embeddedManifest,
                baseUrl: null,
                sourceKind: 'virtual',
                registryRecord,
                pack: buildLoredeckMeta(embeddedManifest, stackPriority, stackIndex, stackSource),
                health: finalizeHealth(health),
                entryFiles: [],
            };
        }
        const health = createHealth(embeddedManifest.id || packId);
        const entryFiles = await loadEntryFiles(embeddedManifest, manifestUrl, health, registryRecord);
        return {
            manifest: embeddedManifest,
            baseUrl: manifestUrl,
            sourceKind: 'virtual',
            registryRecord,
            pack: {
                ...buildLoredeckMeta(embeddedManifest, stackPriority, stackIndex, stackSource),
                source: embeddedManifest.source || registryRecord?.source || {},
            },
            health: finalizeHealth(health),
            entryFiles,
        };
    }
    if (!manifestUrl) {
        const health = createHealth(packId);
        addHealthIssue(health, 'error', 'invalid_pack_id', `Loredeck id is not a valid bundled deck id: ${packId}.`, { packId });
        return {
            manifest: null,
            baseUrl: null,
            sourceKind: 'missing',
            registryRecord,
            pack: buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex, stackSource),
            health: finalizeHealth(health),
            entryFiles: [],
        };
    }

    const loredeckResult = await fetchJsonDetailed(manifestUrl);
    if (loredeckResult.ok) {
        const manifest = {
            ...(registryRecord || {}),
            ...(loredeckResult.json || {}),
        };
        const pack = {
            ...buildLoredeckMeta(manifest, stackPriority, stackIndex, stackSource),
            source: manifest.source || registryRecord?.source || {},
        };
        const health = createHealth(pack.id);
        const entryFiles = await loadEntryFiles(manifest, manifestUrl, health, registryRecord);
        return {
            manifest,
            baseUrl: manifestUrl,
            sourceKind: 'loredeck',
            registryRecord,
            pack,
            health: finalizeHealth(health),
            entryFiles,
        };
    }

    const health = createHealth(packId);
    addHealthIssue(health, 'error', 'missing_loredeck_manifest', `Loredeck manifest failed to load for ${packId}.`, {
        packId,
        status: loredeckResult.status,
        detail: loredeckResult.error || loredeckResult.statusText || '',
    });
    return {
        manifest: null,
        baseUrl: manifestUrl,
        sourceKind: 'missing',
        registryRecord,
        pack: buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex, stackSource),
        health: finalizeHealth(health),
        entryFiles: [],
    };
}

function normalizeLoredeckStackInput(stack, options = {}) {
    const input = Array.isArray(stack) && stack.length
        ? stack
        : [{ packId: DEFAULT_LOREDECK_ID, enabled: true, priority: 100, addedAt: 0 }];
    const registry = options.registry && typeof options.registry === 'object' && !Array.isArray(options.registry)
        ? options.registry
        : null;
    if (registry && (Array.isArray(registry.folders) || Array.isArray(registry.deckPlacements))) {
        const resolved = resolveLoredeckStackItems(input, registry, {
            packs: registry.packs || {},
        });
        return (resolved.stack || [])
            .map((item, index) => ({
                packId: String(item?.packId || '').trim(),
                enabled: item?.enabled !== false,
                priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : Math.max(1, 100 - index),
                locked: item?.locked === true,
                addedAt: Number.isFinite(Number(item?.addedAt)) ? Number(item.addedAt) : 0,
                stackIndex: index,
                source: sanitizeStackSource(item?.source),
            }))
            .filter(item => item.packId);
    }
    return input
        .map((item, index) => ({
            packId: String(item?.packId || '').trim(),
            enabled: item?.enabled !== false,
            priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : Math.max(1, 100 - index),
            locked: item?.locked === true,
            addedAt: Number.isFinite(Number(item?.addedAt)) ? Number(item.addedAt) : 0,
            stackIndex: index,
            source: sanitizeStackSource(item?.source),
        }))
        .filter(item => item.packId);
}

export async function loadLoredeckStackSources(stack, options = {}) {
    const normalized = normalizeLoredeckStackInput(stack, options).filter(item => item.enabled);
    const sources = [];
    for (let index = 0; index < normalized.length; index += 1) {
        const item = normalized[index];
        const registryRecord = getRegistryRecord(options.registry, item.packId);
        sources.push(await loadLoredeckSourceById(item.packId, {
            registry: options.registry,
            registryRecord,
            stackPriority: item.priority,
            stackIndex: index,
            stackSource: item.source,
        }));
    }
    return sources;
}

export async function loadDefaultLoredeckSource(options = {}) {
    const getStackPriority = typeof options.getStackPriority === 'function'
        ? options.getStackPriority
        : () => 100;
    return loadLoredeckSourceById(DEFAULT_LOREDECK_ID, {
        stackPriority: getStackPriority(DEFAULT_LOREDECK_ID),
        stackIndex: 0,
    });
}

export function combineLoredeckHealth(sources = []) {
    const health = createHealth('loredeck-stack');
    if (!Array.isArray(sources) || !sources.length) {
        addHealthIssue(health, 'suggestion', 'empty_loredeck_stack', 'No enabled Loredecks are loaded in the current stack.');
        return finalizeHealth(health);
    }

    for (const source of sources) {
        const sourceHealth = source?.health || {};
        const summary = sourceHealth.summary || {};
        health.summary.entryCount += Number(summary.entryCount) || 0;
        health.summary.fileCount += Number(summary.fileCount) || 0;
        health.summary.loadedFileCount += Number(summary.loadedFileCount) || 0;
        health.summary.missingFileCount += Number(summary.missingFileCount) || 0;
        health.summary.duplicateEntryIdCount += Number(summary.duplicateEntryIdCount) || 0;
        health.summary.missingEntryIdCount += Number(summary.missingEntryIdCount) || 0;
        health.summary.entryOverrideCount = (Number(health.summary.entryOverrideCount) || 0) + (Number(summary.entryOverrideCount) || 0);
        health.summary.entryAdditionCount = (Number(health.summary.entryAdditionCount) || 0) + (Number(summary.entryAdditionCount) || 0);
        health.summary.disabledEntryIdCount = (Number(health.summary.disabledEntryIdCount) || 0) + (Number(summary.disabledEntryIdCount) || 0);
        health.summary.suppressedEntryCount = (Number(health.summary.suppressedEntryCount) || 0) + (Number(summary.suppressedEntryCount) || 0);
        health.summary.timelineAnchorCount = (Number(health.summary.timelineAnchorCount) || 0) + (Number(summary.timelineAnchorCount) || 0);
        health.summary.timelineWindowCount = (Number(health.summary.timelineWindowCount) || 0) + (Number(summary.timelineWindowCount) || 0);
        health.summary.timelineCandidateCount = (Number(health.summary.timelineCandidateCount) || 0) + (Number(summary.timelineCandidateCount) || 0);
        health.summary.timelineReferencedAnchorCount = (Number(health.summary.timelineReferencedAnchorCount) || 0) + (Number(summary.timelineReferencedAnchorCount) || 0);
        health.summary.timelineDensificationSuggestionCount = (Number(health.summary.timelineDensificationSuggestionCount) || 0) + (Number(summary.timelineDensificationSuggestionCount) || 0);
        health.summary.contextGateCount = (Number(health.summary.contextGateCount) || 0) + (Number(summary.contextGateCount) || 0);
        health.summary.brokenAnchorReferenceCount = (Number(health.summary.brokenAnchorReferenceCount) || 0) + (Number(summary.brokenAnchorReferenceCount) || 0);
        health.summary.invalidContextWindowCount = (Number(health.summary.invalidContextWindowCount) || 0) + (Number(summary.invalidContextWindowCount) || 0);
        health.summary.unmatchableContextGateCount = (Number(health.summary.unmatchableContextGateCount) || 0) + (Number(summary.unmatchableContextGateCount) || 0);
        health.summary.schemaV3EntryCount = (Number(health.summary.schemaV3EntryCount) || 0) + (Number(summary.schemaV3EntryCount) || 0);
        health.summary.schemaV3IssueCount = (Number(health.summary.schemaV3IssueCount) || 0) + (Number(summary.schemaV3IssueCount) || 0);
        health.summary.manifestStatsMismatchCount = (Number(health.summary.manifestStatsMismatchCount) || 0) + (Number(summary.manifestStatsMismatchCount) || 0);
        health.summary.tagRegistryTagCount = (Number(health.summary.tagRegistryTagCount) || 0) + (Number(summary.tagRegistryTagCount) || 0);
        health.summary.undefinedTagCount = (Number(health.summary.undefinedTagCount) || 0) + (Number(summary.undefinedTagCount) || 0);
        health.summary.deprecatedTagUsageCount = (Number(health.summary.deprecatedTagUsageCount) || 0) + (Number(summary.deprecatedTagUsageCount) || 0);
        health.summary.duplicateTagAliasCount = (Number(health.summary.duplicateTagAliasCount) || 0) + (Number(summary.duplicateTagAliasCount) || 0);
        health.summary.orphanedTagCount = (Number(health.summary.orphanedTagCount) || 0) + (Number(summary.orphanedTagCount) || 0);
        health.summary.malformedTagCount = (Number(health.summary.malformedTagCount) || 0) + (Number(summary.malformedTagCount) || 0);
        for (const [category, count] of Object.entries(summary.categoryCounts || {})) {
            health.summary.categoryCounts[category] = (health.summary.categoryCounts[category] || 0) + (Number(count) || 0);
        }
        for (const issue of sourceHealth.errors || []) {
            health.errors.push({ ...issue, packId: source?.pack?.id || sourceHealth.packId || '' });
        }
        for (const issue of sourceHealth.warnings || []) {
            health.warnings.push({ ...issue, packId: source?.pack?.id || sourceHealth.packId || '' });
        }
        for (const issue of sourceHealth.suggestions || []) {
            health.suggestions.push({ ...issue, packId: source?.pack?.id || sourceHealth.packId || '' });
        }
    }
    health.summary.timelineGatesPerCandidate = health.summary.timelineCandidateCount
        ? Number(((Number(health.summary.contextGateCount) || 0) / health.summary.timelineCandidateCount).toFixed(2))
        : 0;

    return finalizeHealth(health);
}

export const __loredeckLoaderTestHooks = {
    createHealth,
    finalizeHealth,
    normalizeTimelineRegistryForHealth,
    createTimelineHealthIndex,
    normalizeTagRegistryForHealth,
    createTagRegistryHealthIndex,
    analyzeTagRegistryDefinitionHealth,
    analyzeEntryTagHealth,
    analyzeTimelineWindowHealth,
    analyzeTimelineDateDerivedSortKeys,
    analyzeManifestFileListHealth,
    buildLoredeckHealthForData,
    normalizeLoredeckEntryForSchemaV3,
    repairLoredeckEntryForHealth,
    analyzeEntries,
    analyzeSchemaV3EntryHealth,
    analyzeManifestStatsHealth,
    analyzeEntryContextHealth,
};
