/**
 * context-index.js -- Saga/Wandlight
 * Aggregates pack-local timeline registries for Context lookup.
 */

import { getState, getLoredeckLibraryRegistry } from './state-manager.js';
import { fetchJson, loadLoredeckStackSources, mergeLoredeckTimelineRegistries } from './loredeck-loader.js';

export const DEFAULT_CONTEXT_INDEX = Object.freeze({
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

let contextIndexCache = null;
let contextIndexPromise = null;
let contextIndexSignature = '';

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
        contextType: cleanString(raw.contextType || raw.type || 'anchor', 80),
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
        contextType: cleanString(raw.contextType || raw.type || 'anchor_window', 80),
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
        defaultContextType: cleanString(input.defaultContextType || '', 80),
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
        registries.context,
        manifest.timeline,
        isPlainObject(manifest.context) ? manifest.context.timeline : '',
        manifest.positionIndex,
    ];
    for (const ref of refs) {
        const cleaned = cleanString(ref, 400);
        if (cleaned) return cleaned;
    }
    return '';
}

function getStackSignature(state = {}, registry = {}) {
    const stack = Array.isArray(state?.loredeckStack) ? state.loredeckStack : [];
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
        ...DEFAULT_CONTEXT_INDEX,
        generatedAt: Date.now(),
        signature,
        packs: [],
        anchors: [],
        windows: [],
        issues: [],
        summary: { ...DEFAULT_CONTEXT_INDEX.summary },
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
            issues: [createIssue('warning', 'context_pack_missing_id', 'A loaded Loredeck source did not expose a pack id.')],
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
            issues.push(createIssue('warning', 'context_timeline_invalid_ref', `Timeline registry path is invalid for ${packTitle}.`, {
                packId,
                timelineRef,
            }));
        }

        if (timelineUrl) {
            raw = await fetchJson(timelineUrl, null);
            if (!raw) {
                issues.push(createIssue('warning', 'context_timeline_load_failed', `Timeline registry failed to load for ${packTitle}.`, {
                    packId,
                    timelineRef,
                }));
            }
        }
    }

    const mergedRegistry = mergeLoredeckTimelineRegistries(raw || source?.manifest?.timelineRegistry, source?.registryRecord?.timelineRegistry);
    if (!mergedRegistry) {
        packRecord.issueCount = issues.length;
        return { pack: packRecord, anchors: [], windows: [], issues };
    }

    const normalized = normalizeTimelineRegistry(mergedRegistry, { packId, packTitle, stackPriority, stackIndex });
    packRecord.hasIndex = true;
    packRecord.timelineMode = normalized.timelineMode;
    packRecord.defaultContextType = normalized.defaultContextType;
    packRecord.sortKeyScale = normalized.sortKeyScale;
    packRecord.axisCount = normalized.axes.length;
    packRecord.anchorCount = normalized.anchors.length;
    packRecord.windowCount = normalized.windows.length;
    packRecord.summary = normalized.summary;

    if (!normalized.anchors.length && !normalized.windows.length) {
        issues.push(createIssue('suggestion', 'context_timeline_empty', `Timeline registry for ${packTitle} has no anchors or windows.`, {
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

export function clearContextIndexCache() {
    contextIndexCache = null;
    contextIndexPromise = null;
    contextIndexSignature = '';
}

export function getContextIndexSync() {
    return contextIndexCache;
}

export async function loadContextIndex(options = {}) {
    return loadContextIndexForState(getState(), {
        registry: getLoredeckLibraryRegistry(getState()),
        ...options,
    });
}

export async function loadContextIndexForState(state = getState(), options = {}) {
    const registry = options.registry || getLoredeckLibraryRegistry(state);
    const signature = getStackSignature(state, registry);
    if (!options.force && contextIndexCache && contextIndexSignature === signature) {
        return contextIndexCache;
    }
    if (!options.force && contextIndexPromise && contextIndexSignature === signature) {
        return contextIndexPromise;
    }

    contextIndexSignature = signature;
    contextIndexPromise = (async () => {
        const index = createEmptyIndex(signature);
        const sources = await loadLoredeckStackSources(state?.loredeckStack || [], {
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
        contextIndexCache = finalizeIndex(index);
        return contextIndexCache;
    })().catch(error => {
        contextIndexCache = finalizeIndex({
            ...createEmptyIndex(signature),
            issues: [createIssue('warning', 'context_index_load_failed', error?.message || 'Context index failed to load.')],
        });
        return contextIndexCache;
    }).finally(() => {
        contextIndexPromise = null;
    });

    return contextIndexPromise;
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
    ].filter(Boolean).join(' ');
}

const CONTEXT_SEARCH_STOPWORDS = Object.freeze(new Set([
    'a',
    'about',
    'an',
    'and',
    'are',
    'around',
    'as',
    'at',
    'back',
    'be',
    'been',
    'being',
    'by',
    'for',
    'from',
    'go',
    'goes',
    'going',
    'gone',
    'had',
    'has',
    'have',
    'he',
    'her',
    'here',
    'him',
    'his',
    'in',
    'into',
    'is',
    'it',
    'just',
    'of',
    'on',
    'or',
    'right',
    'she',
    'that',
    'the',
    'their',
    'them',
    'then',
    'there',
    'these',
    'they',
    'this',
    'those',
    'time',
    'to',
    'was',
    'we',
    'went',
    'were',
    'when',
    'where',
    'while',
    'with',
    'you',
]));

const CONTEXT_DIRECTION_WORDS = Object.freeze(new Set([
    'after',
    'before',
    'during',
    'following',
    'near',
    'post',
    'pre',
    'prior',
]));

const CONTEXT_ORDINAL_WORDS = Object.freeze(new Map([
    ['first', 'first'],
    ['second', '2'],
    ['third', '3'],
    ['fourth', '4'],
    ['fifth', '5'],
    ['sixth', '6'],
    ['seventh', '7'],
    ['eighth', '8'],
    ['ninth', '9'],
    ['tenth', '10'],
]));

const CONTEXT_TOKEN_NORMALIZATIONS = Object.freeze(new Map([
    ['began', 'start'],
    ['begin', 'start'],
    ['begins', 'start'],
    ['begun', 'start'],
    ['came', 'return'],
    ['cedrick', 'cedric'],
    ['comeback', 'return'],
    ['come', 'return'],
    ['comes', 'return'],
    ['coming', 'return'],
    ['date', 'date'],
    ['dated', 'date'],
    ['dates', 'date'],
    ['dating', 'date'],
    ['dead', 'death'],
    ['died', 'death'],
    ['dies', 'death'],
    ['die', 'death'],
    ['killed', 'death'],
    ['killing', 'death'],
    ['kills', 'death'],
    ['met', 'meet'],
    ['meets', 'meet'],
    ['returned', 'return'],
    ['returns', 'return'],
    ['started', 'start'],
    ['starting', 'start'],
    ['starts', 'start'],
]));

const CONTEXT_TOKEN_VARIANTS = Object.freeze(new Map([
    ['date', ['date', 'dated', 'dates', 'dating', 'relationship', 'romance', 'girlfriend', 'boyfriend', 'kiss', 'kisses']],
    ['death', ['death', 'dead', 'died', 'dies', 'die', 'kill', 'killed', 'killing']],
    ['meet', ['meet', 'meets', 'met', 'encounter', 'confront', 'confrontation']],
    ['return', ['return', 'returns', 'returned', 'comeback', 'comes back', 'came back', 'come back', 'regains a body', 'restored']],
    ['start', ['start', 'starts', 'started', 'starting', 'begin', 'begins', 'began']],
]));

export function normalizeContextSearchText(value = '') {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’‘]/g, "'")
        .toLowerCase()
        .replace(/[^a-z0-9._:'-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanSearchToken(value = '') {
    let token = normalizeContextSearchText(value)
        .replace(/^[._:'-]+|[._:'-]+$/g, '');
    if (token.endsWith("'s")) token = token.slice(0, -2);
    return token;
}

function normalizeContextQueryTerm(value = '') {
    const token = cleanSearchToken(value);
    if (!token) return '';
    const numericOrdinal = token.match(/^(\d+)(?:st|nd|rd|th)$/);
    if (numericOrdinal) return numericOrdinal[1];
    return CONTEXT_TOKEN_NORMALIZATIONS.get(token)
        || CONTEXT_ORDINAL_WORDS.get(token)
        || token;
}

function getContextTermVariants(term = '') {
    const cleanTerm = normalizeContextQueryTerm(term);
    if (!cleanTerm) return [];
    const output = [cleanTerm, ...(CONTEXT_TOKEN_VARIANTS.get(cleanTerm) || [])];
    const seen = new Set();
    return output
        .map(item => normalizeContextSearchText(item).replace(/^[._:'-]+|[._:'-]+$/g, ''))
        .filter(item => {
            if (!item || seen.has(item)) return false;
            seen.add(item);
            return true;
        });
}

function isEditDistanceAtMostOne(a = '', b = '') {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i += 1;
            j += 1;
            continue;
        }
        edits += 1;
        if (edits > 1) return false;
        if (a.length > b.length) {
            i += 1;
        } else if (b.length > a.length) {
            j += 1;
        } else {
            i += 1;
            j += 1;
        }
    }
    return edits + (i < a.length ? 1 : 0) + (j < b.length ? 1 : 0) <= 1;
}

export function contextTextIncludesTerm(text = '', term = '') {
    const haystack = normalizeContextSearchText(text);
    if (!haystack) return false;
    const variants = getContextTermVariants(term);
    if (variants.some(variant => haystack.includes(variant))) return true;
    const compactHaystack = haystack.replace(/[^a-z0-9]+/g, '');
    if (variants.some(variant => variant.includes(' ') && compactHaystack.includes(variant.replace(/[^a-z0-9]+/g, '')))) {
        return true;
    }
    const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
    return variants.some(variant => (
        variant.length >= 6
        && !variant.includes(' ')
        && words.some(word => word.length >= 5 && isEditDistanceAtMostOne(word, variant))
    ));
}

export function analyzeContextQuery(query = '') {
    const rawTerms = String(query || '')
        .toLowerCase()
        .split(/[^a-z0-9._:-]+/i)
        .map(cleanSearchToken)
        .filter(Boolean);
    const terms = [];
    const ignoredTerms = [];
    const directionTerms = [];
    const seen = new Set();
    for (const rawTerm of rawTerms) {
        const term = normalizeContextQueryTerm(rawTerm);
        const isShortNoise = term.length <= 1 && !/\d/.test(term);
        const isStopword = CONTEXT_SEARCH_STOPWORDS.has(term);
        const isDirection = CONTEXT_DIRECTION_WORDS.has(term);
        if (isDirection) directionTerms.push(term);
        if (isShortNoise || isStopword || isDirection) {
            if (!ignoredTerms.includes(term)) ignoredTerms.push(term);
            continue;
        }
        if (seen.has(term)) continue;
        seen.add(term);
        terms.push(term);
        if (terms.length >= 24) break;
    }
    return {
        query: normalizeContextSearchText(query),
        terms,
        termPhrase: terms.join(' '),
        ignoredTerms,
        directionTerms: [...new Set(directionTerms)],
    };
}

function tokenizeAnchorSearchQuery(query = '') {
    return analyzeContextQuery(query).terms;
}

function addMatchReason(reasons, matchedTerms, type, label, score, detail = '') {
    if (!label) return;
    reasons.push({ type, label, score, detail });
    const text = `${label} ${detail}`;
    for (const term of matchedTerms.queryTerms || []) {
        if (contextTextIncludesTerm(text, term)) matchedTerms.terms.add(term);
    }
}

function markMatchedTermsFromText(matchedTerms, text = '') {
    const haystack = String(text || '');
    if (!haystack) return;
    for (const term of matchedTerms.queryTerms || []) {
        if (contextTextIncludesTerm(haystack, term)) matchedTerms.terms.add(term);
    }
}

function scoreAnchorMatch(anchor = {}, analysis = analyzeContextQuery('')) {
    const terms = Array.isArray(analysis) ? analysis : (analysis.terms || []);
    const query = Array.isArray(analysis) ? '' : (analysis.query || '');
    const termPhrase = Array.isArray(analysis) ? terms.join(' ') : (analysis.termPhrase || terms.join(' '));
    if (!terms.length) return { score: 0, reasons: [], matchedTerms: [], missingTerms: [] };
    const label = normalizeContextSearchText(anchor.label);
    const id = normalizeContextSearchText(anchor.id);
    const aliases = (anchor.aliases || []).map(alias => normalizeContextSearchText(alias));
    const tags = (anchor.tags || []).map(tag => normalizeContextSearchText(tag));
    const searchText = getAnchorSearchText(anchor);
    const reasons = [];
    const matchedTerms = { queryTerms: terms, terms: new Set() };
    let score = 0;
    if (query && (label === query || id === query || aliases.includes(query))) {
        score += 120;
        addMatchReason(reasons, matchedTerms, 'exact', 'Exact label, ID, or alias match', 120, query);
    }
    if (termPhrase && termPhrase !== query && (label === termPhrase || id === termPhrase || aliases.includes(termPhrase))) {
        score += 110;
        addMatchReason(reasons, matchedTerms, 'exact_terms', 'Exact cleaned phrase match', 110, termPhrase);
    }
    if (query && label.includes(query)) {
        score += 35;
        addMatchReason(reasons, matchedTerms, 'label_phrase', 'Label contains full phrase', 35, anchor.label);
    }
    if (termPhrase && label.includes(termPhrase)) {
        score += 35;
        addMatchReason(reasons, matchedTerms, 'label_clean_phrase', 'Label contains cleaned phrase', 35, anchor.label);
    }
    if (query && id.includes(query)) {
        score += 24;
        addMatchReason(reasons, matchedTerms, 'id_phrase', 'ID contains full phrase', 24, anchor.id);
    }
    if (termPhrase && id.includes(termPhrase)) {
        score += 24;
        addMatchReason(reasons, matchedTerms, 'id_clean_phrase', 'ID contains cleaned phrase', 24, anchor.id);
    }
    if (query && aliases.some(alias => alias.includes(query))) {
        score += 30;
        addMatchReason(reasons, matchedTerms, 'alias_phrase', 'Alias contains full phrase', 30, aliases.find(alias => alias.includes(query)));
    }
    if (termPhrase && aliases.some(alias => alias.includes(termPhrase))) {
        score += 30;
        addMatchReason(reasons, matchedTerms, 'alias_clean_phrase', 'Alias contains cleaned phrase', 30, aliases.find(alias => alias.includes(termPhrase)));
    }
    if (query && tags.some(tag => tag.includes(query))) {
        score += 12;
        addMatchReason(reasons, matchedTerms, 'tag_phrase', 'Tag contains full phrase', 12, tags.find(tag => tag.includes(query)));
    }
    if (termPhrase && tags.some(tag => tag.includes(termPhrase))) {
        score += 12;
        addMatchReason(reasons, matchedTerms, 'tag_clean_phrase', 'Tag contains cleaned phrase', 12, tags.find(tag => tag.includes(termPhrase)));
    }
    for (const term of terms) {
        if (!term) continue;
        if (contextTextIncludesTerm(label, term)) {
            score += 12;
            addMatchReason(reasons, matchedTerms, 'label_term', `Label term: ${term}`, 12, anchor.label);
        }
        if (contextTextIncludesTerm(id, term)) {
            score += 8;
            addMatchReason(reasons, matchedTerms, 'id_term', `ID term: ${term}`, 8, anchor.id);
        }
        const alias = aliases.find(item => contextTextIncludesTerm(item, term));
        if (alias) {
            score += 10;
            addMatchReason(reasons, matchedTerms, 'alias_term', `Alias term: ${term}`, 10, alias);
        }
        const tag = tags.find(item => contextTextIncludesTerm(item, term));
        if (tag) {
            score += 5;
            addMatchReason(reasons, matchedTerms, 'tag_term', `Tag term: ${term}`, 5, tag);
        }
        if (contextTextIncludesTerm(searchText, term)) {
            score += 2;
            markMatchedTermsFromText(matchedTerms, searchText);
            addMatchReason(reasons, matchedTerms, 'coordinate_term', `Coordinate term: ${term}`, 2, '');
        }
    }
    const matched = [...matchedTerms.terms];
    return {
        score,
        reasons: reasons
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 8),
        matchedTerms: matched,
        missingTerms: terms.filter(term => !matchedTerms.terms.has(term)),
    };
}

export function rankContextAnchors(query = '', options = {}) {
    const index = options.index || contextIndexCache;
    if (!index?.anchors?.length) return [];
    const cleanQuery = String(query || '').trim().toLowerCase();
    const analysis = analyzeContextQuery(query);
    const packId = cleanString(options.packId, 160);
    const limit = Math.max(1, Math.min(50, Number(options.limit) || 10));
    const candidates = packId
        ? index.anchors.filter(anchor => anchor.packId === packId)
        : index.anchors.slice();
    if (!cleanQuery) {
        return candidates.slice(0, limit).map(anchor => ({ anchor, score: 0 }));
    }
    return candidates
        .map(anchor => {
            const result = scoreAnchorMatch(anchor, analysis);
            return {
                anchor,
                score: result.score,
                reasons: result.reasons,
                matchedTerms: result.matchedTerms,
                missingTerms: result.missingTerms,
                queryTerms: analysis.terms,
                ignoredTerms: analysis.ignoredTerms,
                directionTerms: analysis.directionTerms,
            };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const packCompare = (a.anchor.packStackIndex || 0) - (b.anchor.packStackIndex || 0);
            if (packCompare) return packCompare;
            return (a.anchor.sortKey || 0) - (b.anchor.sortKey || 0);
        })
        .slice(0, limit);
}

export function findContextAnchors(query = '', options = {}) {
    return rankContextAnchors(query, options).map(item => item.anchor);
}
