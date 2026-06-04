/**
 * story-position-index.js -- Saga/Wandlight
 * Aggregates pack-local timeline registries for Story Position lookup.
 */

import { getState, getLorepackLibraryRegistry } from './state-manager.js';
import { fetchJson, loadLorepackStackSources, mergeLorepackTimelineRegistries } from './lorepack-loader.js';

export const DEFAULT_STORY_POSITION_INDEX = Object.freeze({
    schemaVersion: 1,
    generatedAt: 0,
    signature: '',
    packs: Object.freeze([]),
    anchors: Object.freeze([]),
    windows: Object.freeze([]),
    issues: Object.freeze([]),
    summary: Object.freeze({
        packCount: 0,
        indexCount: 0,
        anchorCount: 0,
        windowCount: 0,
        issueCount: 0,
    }),
});

let storyPositionIndexCache = null;
let storyPositionIndexPromise = null;
let storyPositionIndexSignature = '';

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function cleanStringArray(value, maxItems = 40, maxLength = 160) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const raw of value) {
        const item = cleanString(raw, maxLength);
        const key = item.toLowerCase();
        if (!item || seen.has(key)) continue;
        seen.add(key);
        output.push(item);
        if (output.length >= maxItems) break;
    }
    return output;
}

function cleanNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function normalizeDateRange(value = {}) {
    const input = isPlainObject(value) ? value : {};
    return {
        from: cleanString(input.from || input.start || input.validFrom, 80),
        to: cleanString(input.to || input.end || input.validTo, 80),
        precision: cleanString(input.precision, 40),
    };
}

function normalizeCoordinates(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(item => isPlainObject(item) ? {
            axis: cleanString(item.axis || item.type, 80),
            value: cleanString(item.value || item.id || item.label, 180),
            sortKey: Number.isFinite(Number(item.sortKey)) ? Number(item.sortKey) : null,
        } : null)
        .filter(item => item && (item.axis || item.value))
        .slice(0, 24);
}

function normalizeTimelineAxis(value = {}) {
    if (!isPlainObject(value)) return null;
    const id = cleanString(value.id || value.type || value.label, 100);
    if (!id) return null;
    return {
        id,
        type: cleanString(value.type || 'custom', 80),
        label: cleanString(value.label || id, 160),
    };
}

function normalizeTimelineAnchor(raw = {}, source = {}, index = 0) {
    if (!isPlainObject(raw)) return null;
    const id = cleanString(raw.id || `${source.packId || 'pack'}.anchor_${index + 1}`, 180);
    if (!id) return null;
    const dateRange = normalizeDateRange(raw.dateRange || raw.date || raw.canonTiming);
    return {
        id,
        label: cleanString(raw.label || raw.title || id, 240),
        positionType: cleanString(raw.positionType || raw.type || 'anchor', 80),
        sortKey: cleanNumber(raw.sortKey, index + 1),
        dateRange,
        book: cleanString(raw.book || raw.sourceInfo?.title || raw.source?.book, 160),
        work: cleanString(raw.work || raw.sourceInfo?.work || raw.source?.work, 160),
        schoolYear: cleanString(raw.schoolYear || raw.date?.schoolYear || raw.canonTiming?.schoolYear, 80),
        arc: cleanString(raw.arc, 180),
        phase: cleanString(raw.phase, 180),
        season: cleanString(raw.season, 80),
        episode: cleanString(raw.episode, 80),
        chapter: cleanString(raw.chapter, 80),
        issue: cleanString(raw.issue, 80),
        quest: cleanString(raw.quest, 180),
        gameStage: cleanString(raw.gameStage, 180),
        aliases: cleanStringArray(raw.aliases || raw.triggers, 40, 160),
        tags: cleanStringArray(raw.tags, 64, 140),
        coordinates: normalizeCoordinates(raw.coordinates),
        packId: source.packId,
        packTitle: source.packTitle,
        packPriority: source.stackPriority,
        packStackIndex: source.stackIndex,
    };
}

function normalizeTimelineWindow(raw = {}, source = {}, index = 0) {
    if (!isPlainObject(raw)) return null;
    const id = cleanString(raw.id || `${source.packId || 'pack'}.window_${index + 1}`, 180);
    if (!id) return null;
    return {
        id,
        label: cleanString(raw.label || raw.title || id, 240),
        positionType: cleanString(raw.positionType || raw.type || 'anchor_window', 80),
        anchorFrom: cleanString(raw.anchorFrom || raw.from || raw.validFromAnchor, 180),
        anchorTo: cleanString(raw.anchorTo || raw.to || raw.validToAnchor, 180),
        sortKeyFrom: Number.isFinite(Number(raw.sortKeyFrom)) ? Number(raw.sortKeyFrom) : null,
        sortKeyTo: Number.isFinite(Number(raw.sortKeyTo)) ? Number(raw.sortKeyTo) : null,
        dateRange: normalizeDateRange(raw.dateRange || raw.date),
        aliases: cleanStringArray(raw.aliases || raw.triggers, 40, 160),
        tags: cleanStringArray(raw.tags, 64, 140),
        packId: source.packId,
        packTitle: source.packTitle,
        packPriority: source.stackPriority,
        packStackIndex: source.stackIndex,
    };
}

function normalizeTimelineRegistry(raw = {}, source = {}) {
    const input = isPlainObject(raw) ? raw : {};
    const axes = Array.isArray(input.axes)
        ? input.axes.map(normalizeTimelineAxis).filter(Boolean).slice(0, 20)
        : [];
    const anchors = Array.isArray(input.anchors)
        ? input.anchors.map((anchor, index) => normalizeTimelineAnchor(anchor, source, index)).filter(Boolean)
        : [];
    const windows = [
        ...(Array.isArray(input.windows) ? input.windows : []),
        ...(Array.isArray(input.arcs) ? input.arcs : []),
        ...(Array.isArray(input.phases) ? input.phases : []),
    ].map((window, index) => normalizeTimelineWindow(window, source, index)).filter(Boolean);

    return {
        schemaVersion: cleanNumber(input.schemaVersion, 1),
        timelineMode: cleanString(input.timelineMode || 'hybrid', 80),
        defaultPositionType: cleanString(input.defaultPositionType || '', 80),
        sortKeyScale: cleanString(input.sortKeyScale || 'pack_local', 160),
        summary: cleanString(input.summary || input.description, 500),
        axes,
        anchors,
        windows,
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
        const cleaned = cleanString(ref, 400);
        if (cleaned) return cleaned;
    }
    return '';
}

function getStackSignature(state = {}, registry = {}) {
    const stack = Array.isArray(state?.lorepackStack) ? state.lorepackStack : [];
    const packs = isPlainObject(registry?.packs) ? registry.packs : {};
    return JSON.stringify(stack.map((item, index) => {
        const packId = cleanString(item?.packId, 160);
        const record = packs[packId] || {};
        return {
            packId,
            enabled: item?.enabled !== false,
            priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : 0,
            index,
            manifest: cleanString(record.manifest, 400),
            version: cleanString(record.version, 80),
            updatedAt: cleanString(record.updatedAt || record.importedAt || record.addedAt, 80),
        };
    }));
}

function createIssue(severity, code, message, extra = {}) {
    return {
        severity,
        code,
        message,
        ...extra,
    };
}

function createEmptyIndex(signature = '') {
    return {
        ...DEFAULT_STORY_POSITION_INDEX,
        generatedAt: Date.now(),
        signature,
        packs: [],
        anchors: [],
        windows: [],
        issues: [],
        summary: { ...DEFAULT_STORY_POSITION_INDEX.summary },
    };
}

async function loadTimelineForSource(source = {}) {
    const packId = cleanString(source?.pack?.id || source?.manifest?.id, 160);
    const packTitle = cleanString(source?.pack?.title || source?.manifest?.title || packId, 240);
    const stackPriority = Number.isFinite(Number(source?.pack?.stackPriority)) ? Number(source.pack.stackPriority) : 0;
    const stackIndex = Number.isFinite(Number(source?.pack?.stackIndex)) ? Number(source.pack.stackIndex) : 0;
    const baseUrl = source?.baseUrl || null;
    const timelineRef = getTimelineRegistryRef(source?.manifest);

    const packRecord = {
        packId,
        title: packTitle,
        type: cleanString(source?.pack?.type || source?.manifest?.type || 'custom', 80),
        stackPriority,
        stackIndex,
        timelineRef,
        hasIndex: false,
        timelineMode: '',
        anchorCount: 0,
        windowCount: 0,
        issueCount: 0,
    };

    if (!packId) {
        return {
            pack: packRecord,
            anchors: [],
            windows: [],
            issues: [createIssue('warning', 'story_position_pack_missing_id', 'A loaded Lorepack source did not expose a pack id.')],
        };
    }
    if ((!timelineRef || !baseUrl) && !source?.registryRecord?.timelineRegistry) {
        return {
            pack: packRecord,
            anchors: [],
            windows: [],
            issues: [],
        };
    }

    let raw = null;
    const issues = [];
    if (timelineRef && baseUrl) {
        let timelineUrl = null;
        try {
            timelineUrl = new URL(timelineRef, baseUrl);
        } catch (_) {
            issues.push(createIssue('warning', 'story_position_timeline_invalid_ref', `Timeline registry path is invalid for ${packTitle}.`, {
                packId,
                timelineRef,
            }));
        }

        if (timelineUrl) {
            raw = await fetchJson(timelineUrl, null);
            if (!raw) {
                issues.push(createIssue('warning', 'story_position_timeline_load_failed', `Timeline registry failed to load for ${packTitle}.`, {
                    packId,
                    timelineRef,
                }));
            }
        }
    }

    const mergedRegistry = mergeLorepackTimelineRegistries(raw || source?.manifest?.timelineRegistry, source?.registryRecord?.timelineRegistry);
    if (!mergedRegistry) {
        packRecord.issueCount = issues.length;
        return { pack: packRecord, anchors: [], windows: [], issues };
    }

    const normalized = normalizeTimelineRegistry(mergedRegistry, { packId, packTitle, stackPriority, stackIndex });
    packRecord.hasIndex = true;
    packRecord.timelineMode = normalized.timelineMode;
    packRecord.defaultPositionType = normalized.defaultPositionType;
    packRecord.sortKeyScale = normalized.sortKeyScale;
    packRecord.axisCount = normalized.axes.length;
    packRecord.anchorCount = normalized.anchors.length;
    packRecord.windowCount = normalized.windows.length;
    packRecord.summary = normalized.summary;

    if (!normalized.anchors.length && !normalized.windows.length) {
        issues.push(createIssue('suggestion', 'story_position_timeline_empty', `Timeline registry for ${packTitle} has no anchors or windows.`, {
            packId,
            timelineRef,
        }));
    }
    packRecord.issueCount = issues.length;
    return {
        pack: packRecord,
        anchors: normalized.anchors,
        windows: normalized.windows,
        issues,
    };
}

function finalizeIndex(index) {
    index.packs.sort((a, b) => (a.stackIndex || 0) - (b.stackIndex || 0));
    index.anchors.sort((a, b) => {
        const packCompare = (a.packStackIndex || 0) - (b.packStackIndex || 0);
        if (packCompare) return packCompare;
        return (a.sortKey || 0) - (b.sortKey || 0);
    });
    index.windows.sort((a, b) => (a.packStackIndex || 0) - (b.packStackIndex || 0));
    index.summary = {
        packCount: index.packs.length,
        indexCount: index.packs.filter(pack => pack.hasIndex).length,
        anchorCount: index.anchors.length,
        windowCount: index.windows.length,
        issueCount: index.issues.length,
    };
    return index;
}

export function clearStoryPositionIndexCache() {
    storyPositionIndexCache = null;
    storyPositionIndexPromise = null;
    storyPositionIndexSignature = '';
}

export function getStoryPositionIndexSync() {
    return storyPositionIndexCache;
}

export async function loadStoryPositionIndex(options = {}) {
    return loadStoryPositionIndexForState(getState(), {
        registry: getLorepackLibraryRegistry(getState()),
        ...options,
    });
}

export async function loadStoryPositionIndexForState(state = getState(), options = {}) {
    const registry = options.registry || getLorepackLibraryRegistry(state);
    const signature = getStackSignature(state, registry);
    if (!options.force && storyPositionIndexCache && storyPositionIndexSignature === signature) {
        return storyPositionIndexCache;
    }
    if (!options.force && storyPositionIndexPromise && storyPositionIndexSignature === signature) {
        return storyPositionIndexPromise;
    }

    storyPositionIndexSignature = signature;
    storyPositionIndexPromise = (async () => {
        const index = createEmptyIndex(signature);
        const sources = await loadLorepackStackSources(state?.lorepackStack || [], {
            registry,
            allowLegacyFallback: options.allowLegacyFallback !== false,
        });
        for (const source of sources) {
            const result = await loadTimelineForSource(source);
            index.packs.push(result.pack);
            index.anchors.push(...result.anchors);
            index.windows.push(...result.windows);
            index.issues.push(...result.issues);
        }
        storyPositionIndexCache = finalizeIndex(index);
        return storyPositionIndexCache;
    })().catch(error => {
        storyPositionIndexCache = finalizeIndex({
            ...createEmptyIndex(signature),
            issues: [createIssue('warning', 'story_position_index_load_failed', error?.message || 'Story Position index failed to load.')],
        });
        return storyPositionIndexCache;
    }).finally(() => {
        storyPositionIndexPromise = null;
    });

    return storyPositionIndexPromise;
}

function getAnchorSearchText(anchor = {}) {
    return [
        anchor.id,
        anchor.label,
        anchor.book,
        anchor.work,
        anchor.schoolYear,
        anchor.arc,
        anchor.phase,
        anchor.season,
        anchor.episode,
        anchor.chapter,
        anchor.issue,
        anchor.quest,
        anchor.gameStage,
        ...(anchor.aliases || []),
        ...(anchor.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();
}

const STORY_POSITION_SEARCH_STOPWORDS = Object.freeze(new Set([
    'a',
    'an',
    'and',
    'as',
    'at',
    'by',
    'for',
    'from',
    'in',
    'into',
    'is',
    'it',
    'of',
    'on',
    'or',
    'the',
    'this',
    'to',
    'with',
]));

function tokenizeAnchorSearchQuery(query = '') {
    return String(query || '')
        .toLowerCase()
        .split(/[^a-z0-9._:-]+/i)
        .map(term => term.trim())
        .filter(term => term && (term.length > 1 || /\d/.test(term)) && !STORY_POSITION_SEARCH_STOPWORDS.has(term))
        .slice(0, 24);
}

function scoreAnchorMatch(anchor = {}, terms = [], query = '') {
    if (!terms.length) return 0;
    const label = String(anchor.label || '').toLowerCase();
    const id = String(anchor.id || '').toLowerCase();
    const aliases = (anchor.aliases || []).map(alias => String(alias || '').toLowerCase());
    const tags = (anchor.tags || []).map(tag => String(tag || '').toLowerCase());
    const searchText = getAnchorSearchText(anchor);
    let score = 0;
    if (label === query || id === query || aliases.includes(query)) score += 120;
    if (label.includes(query)) score += 35;
    if (id.includes(query)) score += 24;
    if (aliases.some(alias => alias.includes(query))) score += 30;
    if (tags.some(tag => tag.includes(query))) score += 12;
    for (const term of terms) {
        if (!term) continue;
        if (label.includes(term)) score += 12;
        if (id.includes(term)) score += 8;
        if (aliases.some(alias => alias.includes(term))) score += 10;
        if (tags.some(tag => tag.includes(term))) score += 5;
        if (searchText.includes(term)) score += 2;
    }
    return score;
}

export function rankStoryPositionAnchors(query = '', options = {}) {
    const index = options.index || storyPositionIndexCache;
    if (!index?.anchors?.length) return [];
    const cleanQuery = String(query || '').trim().toLowerCase();
    const packId = cleanString(options.packId, 160);
    const limit = Math.max(1, Math.min(50, Number(options.limit) || 10));
    const candidates = packId
        ? index.anchors.filter(anchor => anchor.packId === packId)
        : index.anchors.slice();
    if (!cleanQuery) {
        return candidates.slice(0, limit).map(anchor => ({ anchor, score: 0 }));
    }
    const terms = tokenizeAnchorSearchQuery(cleanQuery);
    return candidates
        .map(anchor => ({ anchor, score: scoreAnchorMatch(anchor, terms, cleanQuery) }))
        .filter(item => item.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const packCompare = (a.anchor.packStackIndex || 0) - (b.anchor.packStackIndex || 0);
            if (packCompare) return packCompare;
            return (a.anchor.sortKey || 0) - (b.anchor.sortKey || 0);
        })
        .slice(0, limit);
}

export function findStoryPositionAnchors(query = '', options = {}) {
    return rankStoryPositionAnchors(query, options).map(item => item.anchor);
}
