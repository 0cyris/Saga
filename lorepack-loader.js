/**
 * lorepack-loader.js -- Saga/Wandlight
 * Minimal Lorepack manifest, entry-file loading, and Pack Health helpers.
 *
 * This module is intentionally data-only: it does not own canon scoring,
 * preprocessing, prompt injection, or UI state.
 */

import { normalizeLoreEntry } from './lore-matrix.js';

export const DEFAULT_LOREPACK_ID = 'hp-golden-trio';
export const DEFAULT_LOREPACK_MANIFEST_URL = new URL('./Lorepacks/hp-golden-trio/lorepack.json', import.meta.url);
export const LOREPACK_INDEX_URL = new URL('./Lorepacks/index.json', import.meta.url);
export const LEGACY_LORE_MANIFEST_URL = new URL('./Lore/manifest.json', import.meta.url);
export const LEGACY_LORE_INDEX_URL = new URL('./Lore/index.json', import.meta.url);

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
            positionGateCount: 0,
            brokenAnchorReferenceCount: 0,
            invalidPositionWindowCount: 0,
            unmatchablePositionGateCount: 0,
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
        registries.storyPosition,
        manifest.timeline,
        isPlainObject(manifest.storyPosition) ? manifest.storyPosition.timeline : '',
        manifest.positionIndex,
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

export function mergeLorepackTimelineRegistries(sourceRegistry = null, customRegistry = null) {
    const source = isPlainObject(sourceRegistry) ? sourceRegistry : {};
    const custom = isPlainObject(customRegistry) ? customRegistry : {};
    const hasSource = Object.keys(source).length > 0;
    const hasCustom = Object.keys(custom).length > 0;
    if (!hasSource && !hasCustom) return null;

    const disabledAnchorIds = normalizeHealthIdList(custom.disabledAnchorIds || custom.disabledAnchors || []);
    const disabledWindowIds = normalizeHealthIdList(custom.disabledWindowIds || custom.disabledWindows || []);
    const merged = {
        ...clonePlainObject(source),
        schemaVersion: cleanHealthNumber(custom.schemaVersion) || cleanHealthNumber(source.schemaVersion) || 1,
        timelineMode: cleanHealthString(custom.timelineMode || source.timelineMode || 'hybrid', 80),
        defaultPositionType: cleanHealthString(custom.defaultPositionType || source.defaultPositionType || '', 80),
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

function addPositionHealthIssue(health, severity, code, message, extra = {}) {
    if (code === 'broken_anchor_reference') health.summary.brokenAnchorReferenceCount += 1;
    if (code === 'invalid_position_window') health.summary.invalidPositionWindowCount += 1;
    if (code === 'unmatchable_position_gate') health.summary.unmatchablePositionGateCount += 1;
    addHealthIssue(health, severity, code, message, extra);
}

function analyzeTimelineWindowHealth(health, timeline = {}) {
    for (const anchorId of timeline.duplicateAnchorIds || []) {
        addPositionHealthIssue(health, 'warning', 'duplicate_timeline_anchor_id', `Timeline defines duplicate anchor id: ${anchorId}.`, {
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
            addPositionHealthIssue(health, 'warning', 'broken_anchor_reference', `Timeline window ${window.id} references unknown anchor${missingAnchors.length === 1 ? '' : 's'}: ${missingAnchors.join(', ')}.`, {
                anchorIds: missingAnchors,
                positionField: 'timelineWindow',
                timelineWindowId: window.id,
                timelineRef: timeline.timelineRef,
            });
        }

        const fromSort = window.sortKeyFrom ?? getAnchorSortKey(timeline, window.anchorFrom);
        const toSort = window.sortKeyTo ?? getAnchorSortKey(timeline, window.anchorTo);
        if (fromSort !== null && toSort !== null && fromSort > toSort) {
            addPositionHealthIssue(health, 'warning', 'invalid_position_window', `Timeline window ${window.id} starts after it ends.`, {
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
            addPositionHealthIssue(health, 'warning', 'timeline_anchor_sortkey_mismatch', `Timeline anchor ${anchor.id} sortKey should match dateRange.from for date-derived-day timelines.`, {
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
            addPositionHealthIssue(health, 'warning', 'timeline_window_sortkey_mismatch', `Timeline window ${window.id} sortKeyFrom should match its start anchor for date-derived-day timelines.`, {
                timelineWindowId: window.id,
                anchorFrom: window.anchorFrom,
                sortKeyFrom: window.sortKeyFrom,
                expectedSortKeyFrom: expectedFrom,
                timelineRef: timeline.timelineRef,
            });
        }
        if (expectedTo !== null && Number(window.sortKeyTo) !== expectedTo) {
            addPositionHealthIssue(health, 'warning', 'timeline_window_sortkey_mismatch', `Timeline window ${window.id} sortKeyTo should match its end anchor range end for date-derived-day timelines.`, {
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
            addHealthIssue(health, 'warning', 'story_position_timeline_invalid_ref', `Timeline registry path is invalid: ${timelineRef}.`, {
                timelineRef,
            });
            hasTimelineRef = false;
        }

        if (timelineUrl) {
            const result = await fetchJsonDetailed(timelineUrl);
            if (!result.ok) {
                addHealthIssue(health, 'warning', 'story_position_timeline_load_failed', `Timeline registry failed to load: ${timelineRef}.`, {
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

    const mergedRegistry = mergeLorepackTimelineRegistries(sourceRegistry, registryRecord?.timelineRegistry);
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
        addHealthIssue(health, 'suggestion', 'story_position_timeline_empty', `Timeline registry ${timelineRef} has no anchors or windows.`, {
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

function hasFinitePositionNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function hasPositionGate(position = {}, coordinates = []) {
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
    if (fields.some(field => cleanHealthString(position[field]))) return true;
    if (hasFinitePositionNumber(position.sortKeyFrom) || hasFinitePositionNumber(position.sortKeyTo)) return true;
    return Array.isArray(coordinates) && coordinates.some(item => isPlainObject(item)
        && [item.axis, item.id, item.from, item.to].some(value => cleanHealthString(value)));
}

function getEntryAnchorReferences(position = {}) {
    return [
        ['anchorId', cleanHealthString(position.anchorId, 180)],
        ['validFromAnchor', cleanHealthString(position.validFromAnchor, 180)],
        ['validToAnchor', cleanHealthString(position.validToAnchor, 180)],
    ].filter(([, anchorId]) => anchorId);
}

function hasOnlyAnchorOrWindowPositionGate(position = {}, coordinates = []) {
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
    return getEntryAnchorReferences(position).length > 0
        && !nonAnchorFields.some(field => cleanHealthString(position[field]))
        && (!Array.isArray(coordinates) || coordinates.length === 0);
}

function analyzeEntryPositionWindowHealth(health, entry, file, timeline = {}) {
    const position = entry.position || {};
    const entryId = cleanHealthString(entry.id, 180);
    const invalidReasons = [];

    const explicitFromSort = hasFinitePositionNumber(position.sortKeyFrom) ? Number(position.sortKeyFrom) : null;
    const explicitToSort = hasFinitePositionNumber(position.sortKeyTo) ? Number(position.sortKeyTo) : null;
    const anchorFromSort = getAnchorSortKey(timeline, position.validFromAnchor);
    const anchorToSort = getAnchorSortKey(timeline, position.validToAnchor);
    const fromSort = explicitFromSort ?? anchorFromSort;
    const toSort = explicitToSort ?? anchorToSort;

    if (explicitFromSort !== null && explicitToSort !== null && explicitFromSort > explicitToSort) {
        invalidReasons.push(`sortKeyFrom ${explicitFromSort} is after sortKeyTo ${explicitToSort}`);
    } else if (fromSort !== null && toSort !== null && fromSort > toSort) {
        invalidReasons.push(`from anchor/sort ${fromSort} is after to anchor/sort ${toSort}`);
    }

    if (!invalidReasons.length) return [];

    addPositionHealthIssue(health, 'warning', 'invalid_position_window', `Entry ${entryId || entry.title} has an invalid Story Position window: ${invalidReasons.join('; ')}.`, {
        entryIds: entryId ? [entryId] : [],
        file,
        anchorFrom: position.validFromAnchor || '',
        anchorTo: position.validToAnchor || '',
        sortKeyFrom: fromSort,
        sortKeyTo: toSort,
    });
    return invalidReasons;
}

function analyzeEntryAnchorReferenceHealth(health, entry, file, timeline = {}) {
    const entryId = cleanHealthString(entry.id, 180);
    const missing = [];
    for (const [field, anchorId] of getEntryAnchorReferences(entry.position || {})) {
        if (timeline.anchorById?.has(anchorId)) continue;
        missing.push({ field, anchorId });
    }
    if (!missing.length) return [];

    const anchorIds = missing.map(item => item.anchorId);
    addPositionHealthIssue(health, 'warning', 'broken_anchor_reference', `Entry ${entryId || entry.title} references unknown Story Position anchor${anchorIds.length === 1 ? '' : 's'}: ${anchorIds.join(', ')}.`, {
        entryIds: entryId ? [entryId] : [],
        file,
        anchorIds,
        positionFields: missing.map(item => item.field),
    });
    return missing.map(item => `unknown ${item.field} ${item.anchorId}`);
}

function analyzeEntryPositionHealth(health, entryFiles = [], timeline = {}) {
    let positionGateCount = 0;
    let anchorReferenceGateCount = 0;
    const noTimelineEntryIds = [];

    for (const fileRecord of entryFiles) {
        for (const rawEntry of fileRecord.entries || []) {
            const entry = normalizeLoreEntry(rawEntry);
            const position = entry.position || {};
            const coordinates = Array.isArray(entry.coordinates) ? entry.coordinates : [];
            if (!hasPositionGate(position, coordinates)) continue;

            positionGateCount += 1;
            const entryId = cleanHealthString(entry.id, 180);
            const anchorRefs = getEntryAnchorReferences(position);
            if (anchorRefs.length) anchorReferenceGateCount += 1;
            if (anchorRefs.length && !timeline.hasTimelineRef) {
                if (entryId) noTimelineEntryIds.push(entryId);
                continue;
            }

            const impossibleReasons = [];
            if (timeline.hasTimelineRef) {
                impossibleReasons.push(...analyzeEntryAnchorReferenceHealth(health, entry, fileRecord.file, timeline));
            }
            impossibleReasons.push(...analyzeEntryPositionWindowHealth(health, entry, fileRecord.file, timeline));

            if (impossibleReasons.length && hasOnlyAnchorOrWindowPositionGate(position, coordinates)) {
                addPositionHealthIssue(health, 'warning', 'unmatchable_position_gate', `Entry ${entryId || entry.title} has a Story Position gate that cannot match known anchors: ${impossibleReasons.join('; ')}.`, {
                    entryIds: entryId ? [entryId] : [],
                    file: fileRecord.file,
                    reasons: impossibleReasons,
                });
            }
        }
    }

    health.summary.positionGateCount = positionGateCount;
    if (anchorReferenceGateCount && !timeline.hasTimelineRef) {
        addHealthIssue(health, 'suggestion', 'position_gates_without_timeline', `${anchorReferenceGateCount} entr${anchorReferenceGateCount === 1 ? 'y uses' : 'ies use'} anchor-based Story Position gates, but this Lorepack has no timeline registry.`, {
            entryIds: noTimelineEntryIds.slice(0, 50),
            affectedEntryCount: anchorReferenceGateCount,
        });
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
    const position = isPlainObject(entry.position) ? entry.position : null;
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

    if (!position) {
        addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_position', `Schema v3 entry ${label} is missing a Story Position block.`, {
            entryIds,
            file,
        });
    } else {
        const scope = cleanHealthString(position.scope, 60);
        if (!SCHEMA_V3_POSITION_SCOPES.has(scope)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_invalid_position_scope', `Schema v3 entry ${label} must declare position.scope as anchor, window, or global.`, {
                entryIds,
                file,
                scope,
            });
        }
        if (!hasFinitePositionNumber(position.sortKeyFrom) || !hasFinitePositionNumber(position.sortKeyTo)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_position_sort_keys', `Schema v3 entry ${label} must define numeric position.sortKeyFrom and position.sortKeyTo.`, {
                entryIds,
                file,
            });
        }
        if (!hasNonEmptyString(position.precision)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_position_precision', `Schema v3 entry ${label} must define position.precision.`, {
                entryIds,
                file,
            });
        }
        if (!hasNonEmptyString(position.label)) {
            addSchemaV3HealthIssue(health, 'error', 'schema_v3_missing_position_label', `Schema v3 entry ${label} must define a human-readable position.label.`, {
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
        const missing = ['activation', 'frequency', 'positionalBoost'].filter(field => !hasNonEmptyString(retrieval[field]));
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

    if (position && retrieval) {
        const from = Number(position.sortKeyFrom);
        const to = Number(position.sortKeyTo);
        const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from + 1) : null;
        const wide = position.scope === 'global'
            || ['series', 'wide'].includes(cleanHealthString(position.windowKind, 80))
            || (span !== null && span >= 365);
        if (wide) {
            const expected = {
                activation: 'topic_or_entity',
                frequency: 'low',
                positionalBoost: 'low',
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
                        positionalBoost: cleanHealthString(retrieval.positionalBoost, 80),
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
        addHealthIssue(health, 'suggestion', 'tag_registry_missing', `${usageByTag.size} entry tag${usageByTag.size === 1 ? ' is' : 's are'} used, but this Lorepack has no tag registry.`, {
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
        addHealthIssue(health, 'warning', 'manifest_entry_count_mismatch', `Manifest stats.entryCount is ${expectedEntryCount}, but Pack Health counted ${health.summary.entryCount} loaded entries.`, {
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
        addHealthIssue(health, 'warning', 'duplicate_manifest_file', `Lorepack manifest lists duplicate entry file${duplicates.length === 1 ? '' : 's'}: ${duplicates.join(', ')}.`, {
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
    const mergedRegistry = mergeLorepackTimelineRegistries(
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
        addHealthIssue(health, 'suggestion', 'story_position_timeline_empty', `Timeline registry ${timelineRef || '(in-memory)'} has no anchors or windows.`, {
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

export function normalizeLorepackEntryForSchemaV3(entry = {}) {
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

export function repairLorepackEntryForHealth(entry = {}, options = {}) {
    const forceSchemaV3 = options.forceSchemaVersion === 3 || Number(entry?.schemaVersion) >= 3;
    let next = forceSchemaV3 ? normalizeLorepackEntryForSchemaV3(entry) : (clonePlainObject(entry) || {});
    if (forceSchemaV3) {
        const position = isPlainObject(next.position) ? next.position : {};
        const from = Number(position.sortKeyFrom);
        const to = Number(position.sortKeyTo);
        const span = Number.isFinite(from) && Number.isFinite(to) ? Math.max(1, to - from + 1) : null;
        const wide = position.scope === 'global'
            || ['series', 'wide'].includes(cleanHealthString(position.windowKind, 80))
            || (span !== null && span >= 365);
        if (wide) {
            next.retrieval = {
                ...(isPlainObject(next.retrieval) ? next.retrieval : {}),
                activation: 'topic_or_entity',
                frequency: 'low',
                positionalBoost: 'low',
            };
        }
    }
    return next;
}

export function buildLorepackHealthForData(options = {}) {
    const manifest = isPlainObject(options.manifest) ? options.manifest : {};
    const packId = cleanHealthString(options.packId || manifest.id || 'draft-lorepack', 160);
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
        addHealthIssue(health, 'error', 'missing_entry_file', `Lorepack entry file failed to load: ${fileRecord.file}.`, {
            file: fileRecord.file,
            detail: fileRecord.error || '',
        });
    }

    const finalEntryFiles = options.registryRecord
        ? applyRegistryEntryOverrides(entryFiles, options.registryRecord, manifest, health)
        : entryFiles;
    const timeline = createInMemoryTimelineHealthIndex(manifest, options.timeline, health, options.registryRecord);
    const tagIndex = createInMemoryTagRegistryHealthIndex(manifest, options.tagRegistry, options.registryRecord, health);
    analyzeEntryPositionHealth(health, finalEntryFiles, timeline);
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

function buildLorepackMeta(manifest = {}, stackPriority = 100, stackIndex = 0) {
    const id = manifest.id || DEFAULT_LOREPACK_ID;
    return {
        id,
        type: manifest.type || 'bundled',
        title: manifest.title || 'Harry Potter: Golden Trio',
        derivedFrom: manifest.derivedFrom || null,
        disabledEntryIds: Array.isArray(manifest.disabledEntryIds) ? manifest.disabledEntryIds.map(id => String(id || '').trim()).filter(Boolean) : [],
        stackPriority,
        stackIndex,
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
            sagaLorepackOverride: {
                kind,
                packId,
                sourceEntryId: baseEntry?.id || '',
                updatedAt: override?.extensions?.sagaLorepackOverride?.updatedAt || Date.now(),
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
        addHealthIssue(health, 'suggestion', 'custom_entry_overrides_applied', `Custom Lorepack applied ${replaced} override(s), ${added} addition(s), and ${suppressed} disabled source entr${suppressed === 1 ? 'y' : 'ies'}.`, {
            packId,
            overrideCount: replaced,
            additionCount: added,
            disabledEntryIdCount: disabledIds.size,
            suppressedEntryCount: suppressed,
        });
    }

    return nextFiles;
}

function getLorepackManifestUrl(packId, registryRecord = null) {
    const manifest = String(registryRecord?.manifest || '').trim();
    if (manifest) {
        try {
            return new URL(manifest, import.meta.url);
        } catch (_) {
            return null;
        }
    }
    const id = String(packId || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) return null;
    return new URL(`./Lorepacks/${id}/lorepack.json`, import.meta.url);
}

function getRegistryRecord(registry, packId) {
    const packs = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs)
        ? registry.packs
        : {};
    return packs[String(packId || '').trim()] || null;
}

function buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex) {
    const id = String(packId || registryRecord?.packId || '').trim();
    return {
        id,
        type: registryRecord?.type || 'custom',
        title: registryRecord?.title || id,
        stackPriority,
        stackIndex,
        source: registryRecord?.source || {},
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
            addHealthIssue(health, 'error', 'missing_entry_file', `Lorepack entry file failed to load: ${file}.`, {
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
    analyzeEntryPositionHealth(health, finalEntryFiles, timeline);
    analyzeEntries(health, finalEntryFiles, manifest, tagIndex);
    return finalEntryFiles;
}

export async function loadLorepackSourceById(packId = DEFAULT_LOREPACK_ID, options = {}) {
    const registryRecord = options.registryRecord || getRegistryRecord(options.registry, packId);
    const manifestUrl = getLorepackManifestUrl(packId, registryRecord);
    const stackPriority = Number.isFinite(Number(options.stackPriority)) ? Number(options.stackPriority) : 100;
    const stackIndex = Number.isFinite(Number(options.stackIndex)) ? Number(options.stackIndex) : 0;
    const embeddedManifest = buildEmbeddedManifest(registryRecord, packId);
    if (embeddedManifest) {
        const health = createHealth(embeddedManifest.id || packId);
        if (!manifestUrl) {
            addHealthIssue(health, 'error', 'missing_virtual_lorepack_base_manifest', `Custom Lorepack ${embeddedManifest.id || packId} has embedded manifest metadata but no base manifest path for file resolution.`, {
                packId: embeddedManifest.id || packId,
            });
            return {
                manifest: embeddedManifest,
                baseUrl: null,
                sourceKind: 'virtual',
                registryRecord,
                pack: buildLorepackMeta(embeddedManifest, stackPriority, stackIndex),
                health: finalizeHealth(health),
                entryFiles: [],
            };
        }
        const entryFiles = await loadEntryFiles(embeddedManifest, manifestUrl, health, registryRecord);
        return {
            manifest: embeddedManifest,
            baseUrl: manifestUrl,
            sourceKind: 'virtual',
            registryRecord,
            pack: {
                ...buildLorepackMeta(embeddedManifest, stackPriority, stackIndex),
                source: embeddedManifest.source || registryRecord?.source || {},
            },
            health: finalizeHealth(health),
            entryFiles,
        };
    }
    if (!manifestUrl) {
        const health = createHealth(packId);
        addHealthIssue(health, 'error', 'invalid_pack_id', `Lorepack id is not a valid bundled pack id: ${packId}.`, { packId });
        return {
            manifest: null,
            baseUrl: null,
            sourceKind: 'missing',
            registryRecord,
            pack: buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex),
            health: finalizeHealth(health),
            entryFiles: [],
        };
    }

    const lorepackResult = await fetchJsonDetailed(manifestUrl);
    if (lorepackResult.ok) {
        const manifest = {
            ...(registryRecord || {}),
            ...(lorepackResult.json || {}),
        };
        const pack = {
            ...buildLorepackMeta(manifest, stackPriority, stackIndex),
            source: manifest.source || registryRecord?.source || {},
        };
        const health = createHealth(pack.id);
        const entryFiles = await loadEntryFiles(manifest, manifestUrl, health, registryRecord);
        return {
            manifest,
            baseUrl: manifestUrl,
            sourceKind: 'lorepack',
            registryRecord,
            pack,
            health: finalizeHealth(health),
            entryFiles,
        };
    }

    if (String(packId || '') !== DEFAULT_LOREPACK_ID || options.allowLegacyFallback === false) {
        const health = createHealth(packId);
        addHealthIssue(health, 'error', 'missing_lorepack_manifest', `Lorepack manifest failed to load for ${packId}.`, {
            packId,
            status: lorepackResult.status,
            detail: lorepackResult.error || lorepackResult.statusText || '',
        });
        return {
            manifest: null,
            baseUrl: manifestUrl,
            sourceKind: 'missing',
            registryRecord,
            pack: buildMissingPackMeta(packId, registryRecord, stackPriority, stackIndex),
            health: finalizeHealth(health),
            entryFiles: [],
        };
    }

    let legacyResult = await fetchJsonDetailed(LEGACY_LORE_MANIFEST_URL);
    let baseUrl = LEGACY_LORE_MANIFEST_URL;
    if (!legacyResult.ok) {
        legacyResult = await fetchJsonDetailed(LEGACY_LORE_INDEX_URL);
        baseUrl = LEGACY_LORE_INDEX_URL;
    }
    if (!legacyResult.ok) {
        const health = createHealth(DEFAULT_LOREPACK_ID);
        addHealthIssue(health, 'error', 'missing_default_lorepack', 'Default Lorepack and legacy Lore manifest both failed to load.', {
            packId: DEFAULT_LOREPACK_ID,
            status: legacyResult.status,
            detail: legacyResult.error || legacyResult.statusText || '',
        });
        return {
            manifest: null,
            baseUrl,
            sourceKind: 'missing',
            registryRecord,
            pack: { id: DEFAULT_LOREPACK_ID, type: 'bundled', title: 'Harry Potter: Golden Trio', stackPriority, stackIndex },
            health: finalizeHealth(health),
            entryFiles: [],
        };
    }

    const manifest = legacyResult.json;
    const health = createHealth(manifest.databaseId || 'legacy-lore');
    const entryFiles = await loadEntryFiles(manifest, baseUrl, health);
    const pack = buildLorepackMeta({
        id: DEFAULT_LOREPACK_ID,
        type: 'bundled',
        title: 'Harry Potter: Golden Trio',
    }, stackPriority, stackIndex);
    return {
        manifest,
        baseUrl,
        sourceKind: 'legacy',
        registryRecord,
        pack,
        health: finalizeHealth(health),
        entryFiles,
    };
}

function normalizeLorepackStackInput(stack) {
    const input = Array.isArray(stack) && stack.length
        ? stack
        : [{ packId: DEFAULT_LOREPACK_ID, enabled: true, priority: 100, addedAt: 0 }];
    return input
        .map((item, index) => ({
            packId: String(item?.packId || '').trim(),
            enabled: item?.enabled !== false,
            priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : Math.max(1, 100 - index),
            locked: item?.locked === true,
            addedAt: Number.isFinite(Number(item?.addedAt)) ? Number(item.addedAt) : 0,
            stackIndex: index,
        }))
        .filter(item => item.packId);
}

export async function loadLorepackStackSources(stack, options = {}) {
    const normalized = normalizeLorepackStackInput(stack).filter(item => item.enabled);
    const sources = [];
    for (let index = 0; index < normalized.length; index += 1) {
        const item = normalized[index];
        const registryRecord = getRegistryRecord(options.registry, item.packId);
        sources.push(await loadLorepackSourceById(item.packId, {
            registry: options.registry,
            registryRecord,
            stackPriority: item.priority,
            stackIndex: index,
            allowLegacyFallback: options.allowLegacyFallback !== false,
        }));
    }
    return sources;
}

export async function loadDefaultLorepackSource(options = {}) {
    const getStackPriority = typeof options.getStackPriority === 'function'
        ? options.getStackPriority
        : () => 100;
    return loadLorepackSourceById(DEFAULT_LOREPACK_ID, {
        stackPriority: getStackPriority(DEFAULT_LOREPACK_ID),
        stackIndex: 0,
        allowLegacyFallback: options.allowLegacyFallback !== false,
    });
}

export function combineLorepackHealth(sources = []) {
    const health = createHealth('lorepack-stack');
    if (!Array.isArray(sources) || !sources.length) {
        addHealthIssue(health, 'suggestion', 'empty_lorepack_stack', 'No enabled Lorepacks are loaded in the current stack.');
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
        health.summary.positionGateCount = (Number(health.summary.positionGateCount) || 0) + (Number(summary.positionGateCount) || 0);
        health.summary.brokenAnchorReferenceCount = (Number(health.summary.brokenAnchorReferenceCount) || 0) + (Number(summary.brokenAnchorReferenceCount) || 0);
        health.summary.invalidPositionWindowCount = (Number(health.summary.invalidPositionWindowCount) || 0) + (Number(summary.invalidPositionWindowCount) || 0);
        health.summary.unmatchablePositionGateCount = (Number(health.summary.unmatchablePositionGateCount) || 0) + (Number(summary.unmatchablePositionGateCount) || 0);
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

    return finalizeHealth(health);
}

export const __lorepackLoaderTestHooks = {
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
    buildLorepackHealthForData,
    normalizeLorepackEntryForSchemaV3,
    repairLorepackEntryForHealth,
    analyzeEntries,
    analyzeSchemaV3EntryHealth,
    analyzeManifestStatsHealth,
    analyzeEntryPositionHealth,
};
