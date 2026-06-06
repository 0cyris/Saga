/**
 * context-resolver.js -- Saga/Wandlight
 * Local, non-model Context resolver for enabled Loredecks.
 */

import {
    getState,
    getLoredeckContext,
    setLoredeckContext,
} from './state-manager.js';
import {
    getContextIndexSync,
    loadContextIndex,
    rankContextAnchors,
} from './context-index.js';
import { sendLoreRequest } from './lore-llm-client.js';

const MIN_ALIAS_SCORE = 40;
const MIN_MODEL_CONFIDENCE = 0.55;
const MODEL_CANDIDATE_CAP_PER_PACK = 24;
const CONTEXT_MODEL_SYSTEM_PROMPT = `You are the Saga Context Resolver.

Resolve each target Loredeck to one known timeline candidate using only the candidate IDs provided.
Do not invent anchors, windows, dates, arcs, phases, episodes, or canon facts.
If the context is too ambiguous for a pack, mark it unresolved.
Return only valid JSON with this shape:
{
  "contexts": [
    {
      "packId": "string",
      "status": "resolved|unresolved",
      "candidateId": "string",
      "candidateType": "anchor|window",
      "anchorId": "string",
      "windowId": "string",
      "label": "string",
      "contextType": "calendar|anchor|anchor_window|arc|phase|season_episode|stardate|relative|hybrid|custom",
      "sceneDate": "string",
      "alias": "string",
      "confidence": 0.0,
      "reason": "short string"
    }
  ]
}`;
const MONTHS = Object.freeze({
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
});

function cleanString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function getEnabledStack(state = {}, index = null) {
    if (Array.isArray(index?.packs) && index.packs.length) {
        return index.packs
            .map((pack, stackIndex) => ({
                packId: cleanString(pack?.packId || pack?.id, 160),
                enabled: true,
                priority: Number.isFinite(Number(pack?.priority)) ? Number(pack.priority) : Math.max(1, 100 - stackIndex),
                stackIndex,
            }))
            .filter(item => item.packId);
    }
    const stack = Array.isArray(state?.loredeckStack) ? state.loredeckStack : [];
    return stack
        .map((item, index) => ({
            packId: cleanString(item?.packId, 160),
            enabled: item?.enabled !== false,
            priority: Number.isFinite(Number(item?.priority)) ? Number(item.priority) : Math.max(1, 100 - index),
            stackIndex: index,
        }))
        .filter(item => item.packId && item.enabled);
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function makeDateRecord(year, month, day, precision = 'date') {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const epoch = Date.UTC(y, m - 1, d);
    return {
        year: y,
        month: m,
        day: d,
        epoch,
        iso: `${y}-${pad2(m)}-${pad2(d)}`,
        precision,
    };
}

function parseDateLike(value = '', boundary = 'exact') {
    const text = cleanString(value, 160);
    if (!text) return null;

    let match = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
    if (match) return makeDateRecord(match[1], match[2], match[3], 'date');

    match = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (match) {
        const year = String(match[3]).length === 2 ? Number(`19${match[3]}`) : Number(match[3]);
        return makeDateRecord(year, Number(match[1]), Number(match[2]), 'date');
    }

    match = text.match(/\b(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)?\.?\s*,?\s*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/i);
    if (match) {
        const month = MONTHS[String(match[1] || '').toLowerCase().replace('.', '')];
        return makeDateRecord(Number(match[3]), month, Number(match[2]), 'date');
    }

    match = text.match(/^\s*(\d{4})\s*$/);
    if (match) {
        const day = boundary === 'to' ? 31 : 1;
        const month = boundary === 'to' ? 12 : 1;
        return makeDateRecord(Number(match[1]), month, day, 'year');
    }

    return null;
}

function parseContextDate(context = {}) {
    return parseDateLike(context.sceneDate || context.subjectiveDate || '', 'exact');
}

function getDateContextSortKey(dateRecord = null) {
    if (!dateRecord || !Number.isFinite(Number(dateRecord.epoch))) return null;
    return Math.floor(Number(dateRecord.epoch) / 86400000);
}

function parseAnchorRange(anchor = {}) {
    const from = parseDateLike(anchor.dateRange?.from || '', 'from');
    const to = parseDateLike(anchor.dateRange?.to || anchor.dateRange?.from || '', 'to');
    if (!from && !to) return null;
    return {
        from: from || to,
        to: to || from,
    };
}

function getWindowSortKeyRange(windowDef = {}) {
    const from = Number(windowDef.sortKeyFrom);
    const to = Number(windowDef.sortKeyTo);
    const hasFrom = Number.isFinite(from);
    const hasTo = Number.isFinite(to);
    if (!hasFrom && !hasTo) return null;
    const start = hasFrom ? from : to;
    const end = hasTo ? to : from;
    return start <= end
        ? { from: start, to: end }
        : { from: end, to: start };
}

function scoreAnchorDateMatch(anchor = {}, contextDate = null) {
    if (!contextDate) return null;
    const range = parseAnchorRange(anchor);
    if (!range?.from || !range?.to) return null;
    if (contextDate.epoch < range.from.epoch || contextDate.epoch > range.to.epoch) return null;
    const spanDays = Math.max(1, Math.round((range.to.epoch - range.from.epoch) / 86400000) + 1);
    const specificity = spanDays <= 14 ? 36 : spanDays <= 45 ? 28 : spanDays <= 120 ? 18 : spanDays <= 370 ? 10 : 5;
    return {
        anchor,
        score: 80 + specificity,
        matchType: 'date',
        confidence: spanDays <= 45 ? 0.88 : 0.78,
        contextDate: contextDate.iso,
        spanDays,
    };
}

function scoreWindowDateMatch(windowDef = {}, contextDate = null) {
    if (!contextDate) return null;
    const contextSortKey = getDateContextSortKey(contextDate);
    const sortRange = getWindowSortKeyRange(windowDef);
    if (Number.isFinite(contextSortKey) && sortRange && contextSortKey >= sortRange.from && contextSortKey <= sortRange.to) {
        const spanDays = Math.max(1, Math.round(sortRange.to - sortRange.from) + 1);
        const specificity = spanDays <= 14 ? 32 : spanDays <= 45 ? 26 : spanDays <= 120 ? 18 : spanDays <= 370 ? 10 : 5;
        return {
            window: windowDef,
            score: 78 + specificity,
            matchType: 'date',
            confidence: spanDays <= 45 ? 0.84 : 0.74,
            contextDate: contextDate.iso,
            spanDays,
        };
    }
    const range = parseAnchorRange(windowDef);
    if (!range?.from || !range?.to || contextDate.epoch < range.from.epoch || contextDate.epoch > range.to.epoch) {
        return null;
    }
    const spanDays = Math.max(1, Math.round((range.to.epoch - range.from.epoch) / 86400000) + 1);
    const specificity = spanDays <= 14 ? 32 : spanDays <= 45 ? 26 : spanDays <= 120 ? 18 : spanDays <= 370 ? 10 : 5;
    return {
        window: windowDef,
        score: 78 + specificity,
        matchType: 'date',
        confidence: spanDays <= 45 ? 0.84 : 0.74,
        contextDate: contextDate.iso,
        spanDays,
    };
}

function getPackAnchors(index = {}, packId = '') {
    const id = cleanString(packId, 160);
    return Array.isArray(index?.anchors)
        ? index.anchors.filter(anchor => anchor?.packId === id)
        : [];
}

function getPackWindows(index = {}, packId = '') {
    const id = cleanString(packId, 160);
    return Array.isArray(index?.windows)
        ? index.windows.filter(windowDef => windowDef?.packId === id)
        : [];
}

function contextCoordinatesToText(coordinates = {}) {
    if (Array.isArray(coordinates)) {
        return coordinates
            .map(item => isPlainObject(item) ? [item.axis || item.type, item.value || item.id || item.label].filter(Boolean).join(':') : '')
            .filter(Boolean)
            .join(' ');
    }
    if (!isPlainObject(coordinates)) return '';
    return Object.entries(coordinates)
        .map(([axis, value]) => `${axis}:${isPlainObject(value) ? (value.id || value.value || value.label || '') : value}`)
        .filter(Boolean)
        .join(' ');
}

function candidateCoordinatesToContextObject(coordinates = []) {
    const output = {};
    for (const item of Array.isArray(coordinates) ? coordinates : []) {
        if (!isPlainObject(item)) continue;
        const axis = cleanString(item.axis || item.type, 80);
        const value = cleanString(item.value || item.id || item.label, 180);
        if (axis && value) output[axis] = value;
    }
    return output;
}

function buildResolverText(context = {}, options = {}) {
    const parts = [
        context.label,
        context.sceneDate,
        context.subjectiveDate,
        context.canonBoundary,
        context.stardate,
        context.arc,
        context.phase,
        context.season,
        context.episode,
        context.chapter,
        context.issue,
        context.quest,
        context.gameStage,
        context.anchorId,
        context.anchorFrom,
        context.anchorTo,
        context.alias,
        context.notes,
        context.summary,
        contextCoordinatesToText(context.coordinates),
        options.sourceText,
    ];
    return parts
        .map(value => cleanString(value, 1200))
        .filter(Boolean)
        .join(' | ')
        .slice(0, 4000);
}

function mapResolverSource(value = '') {
    const source = cleanString(value, 40).toLowerCase();
    if (source === 'header') return 'header';
    if (source === 'model') return 'model';
    if (source === 'imported') return 'imported';
    return 'local_alias';
}

function confidenceFromAliasScore(score = 0) {
    if (score >= 120) return 0.95;
    if (score >= 80) return 0.86;
    if (score >= 50) return 0.78;
    return 0.66;
}

function comparableText(value = '') {
    return cleanString(value, 240).toLowerCase().replace(/[^a-z0-9.:-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function textMatchesLoose(defValue = '', contextValue = '') {
    const defText = comparableText(defValue);
    const contextText = comparableText(contextValue);
    if (!defText || !contextText) return false;
    return defText === contextText || defText.includes(contextText) || contextText.includes(defText);
}

function parseNumber(value = '') {
    const match = cleanString(value, 120).match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
}

function numberMatchesRange(value = '', rangeValue = '') {
    const number = parseNumber(value);
    if (number === null) return false;
    const text = cleanString(rangeValue, 120);
    if (!text) return false;
    const range = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|to|through|\u2013|\u2014)\s*(-?\d+(?:\.\d+)?)/i);
    if (range) {
        const from = Number(range[1]);
        const to = Number(range[2]);
        if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
        return number >= Math.min(from, to) && number <= Math.max(from, to);
    }
    const exact = parseNumber(text);
    return exact !== null && Number(exact) === Number(number);
}

function stardateNumber(value = '') {
    const match = cleanString(value, 120).match(/(?:stardate\s*)?(-?\d+(?:\.\d+)?)/i);
    if (!match) return null;
    const number = Number(match[1]);
    return Number.isFinite(number) ? number : null;
}

function stardateMatchesDef(def = {}, context = {}) {
    const current = stardateNumber(context.stardate || context.sceneDate || context.subjectiveDate);
    if (current === null) return false;
    const exact = stardateNumber(def.stardate);
    if (exact !== null && Math.abs(exact - current) < 0.0001) return true;
    const from = stardateNumber(def.stardateFrom);
    const to = stardateNumber(def.stardateTo);
    if (from !== null || to !== null) {
        const low = from ?? -Infinity;
        const high = to ?? Infinity;
        return current >= Math.min(low, high) && current <= Math.max(low, high);
    }
    return false;
}

function coordinateMatchesDef(defCoordinates = [], contextCoordinates = {}) {
    const contextMap = isPlainObject(contextCoordinates)
        ? contextCoordinates
        : Object.fromEntries((Array.isArray(contextCoordinates) ? contextCoordinates : [])
            .filter(isPlainObject)
            .map(item => [cleanString(item.axis || item.type, 80), cleanString(item.value || item.id || item.label, 180)]));
    let matches = 0;
    for (const coordinate of Array.isArray(defCoordinates) ? defCoordinates : []) {
        if (!isPlainObject(coordinate)) continue;
        const axis = cleanString(coordinate.axis || coordinate.type, 80);
        const value = comparableText(coordinate.value || coordinate.id || coordinate.label);
        const contextValue = comparableText(contextMap[axis]);
        if (axis && value && contextValue && value === contextValue) matches += 1;
    }
    return matches;
}

function scoreStructuredContextMatch(def = {}, context = {}, options = {}) {
    let score = 0;
    if (textMatchesLoose(def.arc, context.arc)) score += options.window ? 70 : 38;
    if (textMatchesLoose(def.phase, context.phase)) score += options.window ? 38 : 28;
    if (textMatchesLoose(def.season, context.season)) score += options.window ? 34 : 28;
    if (textMatchesLoose(def.episode, context.episode)) score += options.window ? 20 : 38;
    if (textMatchesLoose(def.chapter, context.chapter)) score += options.window ? 24 : 34;
    if (!textMatchesLoose(def.chapter, context.chapter) && numberMatchesRange(context.chapter, def.chapter)) score += options.window ? 46 : 28;
    if (textMatchesLoose(def.issue, context.issue)) score += options.window ? 24 : 34;
    if (!textMatchesLoose(def.issue, context.issue) && numberMatchesRange(context.issue, def.issue)) score += options.window ? 42 : 28;
    if (textMatchesLoose(def.quest, context.quest)) score += 34;
    if (textMatchesLoose(def.gameStage, context.gameStage)) score += 34;
    if (stardateMatchesDef(def, context)) score += options.window ? 50 : 78;
    score += coordinateMatchesDef(def.coordinates, context.coordinates) * (options.window ? 18 : 14);
    if (options.window && (context.arc || context.phase) && score > 0) score += 18;
    return score;
}

export function buildContextPatchFromAnchor(anchor = {}, options = {}) {
    const firstDate = cleanString(anchor.dateRange?.from || anchor.dateRange?.to, 80);
    const firstDateSortKey = getDateContextSortKey(parseDateLike(firstDate, 'exact'));
    const anchorSortKey = Number.isFinite(Number(anchor.sortKey)) ? Number(anchor.sortKey) : null;
    const resolvedSortKey = Number.isFinite(Number(options.contextSortKey))
        ? Number(options.contextSortKey)
        : (firstDateSortKey ?? anchorSortKey);
    return {
        contextType: anchor.contextType || 'anchor',
        anchorId: anchor.id || '',
        anchorFrom: '',
        anchorTo: '',
        label: anchor.label || anchor.id || '',
        sceneDate: firstDate,
        contextSortKey: resolvedSortKey,
        contextSortKeyFrom: resolvedSortKey,
        contextSortKeyTo: resolvedSortKey,
        arc: anchor.arc || '',
        phase: anchor.phase || '',
        season: anchor.season || '',
        episode: anchor.episode || '',
        chapter: anchor.chapter || '',
        issue: anchor.issue || '',
        quest: anchor.quest || '',
        gameStage: anchor.gameStage || '',
        stardate: anchor.stardate || anchor.stardateFrom || '',
        coordinates: candidateCoordinatesToContextObject(anchor.coordinates),
        alias: anchor.aliases?.[0] || anchor.label || anchor.id || '',
        source: mapResolverSource(options.contextSource),
        confidence: Number.isFinite(Number(options.confidence)) ? Number(options.confidence) : 0.66,
        manualLock: false,
    };
}

export function buildContextPatchFromWindow(windowDef = {}, options = {}) {
    const firstDate = cleanString(windowDef.dateRange?.from || windowDef.dateRange?.to, 80);
    const firstDateSortKey = getDateContextSortKey(parseDateLike(firstDate, 'exact'));
    const fromSortKey = Number.isFinite(Number(windowDef.sortKeyFrom)) ? Number(windowDef.sortKeyFrom) : null;
    const toSortKey = Number.isFinite(Number(windowDef.sortKeyTo)) ? Number(windowDef.sortKeyTo) : null;
    const resolvedSortKey = Number.isFinite(Number(options.contextSortKey))
        ? Number(options.contextSortKey)
        : (firstDateSortKey ?? fromSortKey ?? toSortKey);
    return {
        contextType: windowDef.contextType || 'anchor_window',
        anchorId: '',
        anchorFrom: windowDef.anchorFrom || '',
        anchorTo: windowDef.anchorTo || '',
        label: windowDef.label || windowDef.id || '',
        sceneDate: firstDate,
        contextSortKey: resolvedSortKey,
        contextSortKeyFrom: fromSortKey ?? resolvedSortKey,
        contextSortKeyTo: toSortKey ?? resolvedSortKey,
        arc: windowDef.arc || '',
        phase: windowDef.phase || '',
        season: windowDef.season || '',
        episode: windowDef.episode || '',
        chapter: windowDef.chapter || '',
        issue: windowDef.issue || '',
        quest: windowDef.quest || '',
        gameStage: windowDef.gameStage || '',
        stardate: windowDef.stardate || windowDef.stardateFrom || '',
        coordinates: candidateCoordinatesToContextObject(windowDef.coordinates),
        alias: windowDef.aliases?.[0] || windowDef.label || windowDef.id || '',
        source: mapResolverSource(options.contextSource),
        confidence: Number.isFinite(Number(options.confidence)) ? Number(options.confidence) : 0.66,
        manualLock: false,
    };
}

function buildResolutionFromMatch(packId, match, context = {}, options = {}) {
    const isWindowMatch = Boolean(match.window);
    const patch = isWindowMatch ? buildContextPatchFromWindow(match.window, {
        contextSource: options.contextSource,
        confidence: match.confidence,
        contextSortKey: match.contextSortKey,
    }) : buildContextPatchFromAnchor(match.anchor, {
        contextSource: options.contextSource,
        confidence: match.confidence,
        contextSortKey: match.contextSortKey,
    });
    if (context.sceneDate && match.matchType === 'date') {
        patch.sceneDate = cleanString(context.sceneDate, 80);
        patch.contextSortKey = getDateContextSortKey(parseDateLike(context.sceneDate, 'exact')) ?? patch.contextSortKey;
    }
    if (context.branchId) patch.branchId = cleanString(context.branchId, 120) || 'main';
    return {
        packId,
        status: 'resolved',
        matchType: match.matchType,
        score: match.score,
        confidence: patch.confidence,
        anchor: match.anchor || null,
        window: match.window || null,
        patch,
    };
}

function getBestDateMatch(packId, context = {}, index = {}) {
    const contextDate = parseContextDate(context);
    if (!contextDate) return null;
    const anchorMatches = getPackAnchors(index, packId)
        .map(anchor => scoreAnchorDateMatch(anchor, contextDate))
        .filter(Boolean);
    const windowMatches = getPackWindows(index, packId)
        .map(windowDef => scoreWindowDateMatch(windowDef, contextDate))
        .filter(Boolean);
    return [...anchorMatches, ...windowMatches]
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.spanDays !== b.spanDays) return a.spanDays - b.spanDays;
            const aSort = Number.isFinite(Number(a.anchor?.sortKey ?? a.window?.sortKeyFrom)) ? Number(a.anchor?.sortKey ?? a.window?.sortKeyFrom) : 0;
            const bSort = Number.isFinite(Number(b.anchor?.sortKey ?? b.window?.sortKeyFrom)) ? Number(b.anchor?.sortKey ?? b.window?.sortKeyFrom) : 0;
            if (a.anchor && b.window) return -1;
            if (a.window && b.anchor) return 1;
            return aSort - bSort;
        })[0] || null;
}

function getBestAliasMatch(packId, context = {}, index = {}, options = {}) {
    const resolverText = buildResolverText(context, options);
    if (!resolverText) return null;
    const ranked = buildContextModelCandidatesForPack(packId, context, {
        ...options,
        index,
        candidateLimit: 8,
        includeDateCandidates: false,
        includeFallbackCandidates: false,
    });
    const top = ranked[0];
    if (!top || top.score < MIN_ALIAS_SCORE) return null;
    const isWindow = top.type === 'window';
    return {
        anchor: isWindow ? null : top.def,
        window: isWindow ? top.def : null,
        score: top.score,
        matchType: isWindow ? 'window_alias' : 'alias',
        confidence: confidenceFromAliasScore(top.score),
        contextSortKey: top.def?.sortKey ?? top.def?.sortKeyFrom,
    };
}

function chooseBestMatch(dateMatch = null, aliasMatch = null) {
    if (!dateMatch) return aliasMatch;
    if (!aliasMatch) return dateMatch;
    if (dateMatch.anchor?.id && dateMatch.anchor.id === aliasMatch.anchor?.id) return dateMatch;
    if (aliasMatch.score >= 80 && aliasMatch.score >= dateMatch.score - 8) return aliasMatch;
    return dateMatch;
}

function getTimelineCandidateId(candidate = {}) {
    const type = candidate.type === 'window' ? 'window' : 'anchor';
    const id = cleanString(candidate.id, 180);
    return id ? `${type}:${id}` : '';
}

function getWindowSearchText(windowDef = {}) {
    return [
        windowDef.id,
        windowDef.label,
        windowDef.anchorFrom,
        windowDef.anchorTo,
        windowDef.arc,
        windowDef.phase,
        windowDef.season,
        windowDef.episode,
        windowDef.chapter,
        windowDef.issue,
        windowDef.quest,
        windowDef.gameStage,
        windowDef.stardate,
        windowDef.stardateFrom,
        windowDef.stardateTo,
        ...(windowDef.coordinates || []).flatMap(coordinate => [coordinate.axis, coordinate.value]),
        ...(windowDef.aliases || []),
        ...(windowDef.tags || []),
    ].filter(Boolean).join(' ');
}

function scoreWindowCandidate(windowDef = {}, resolverText = '', context = {}) {
    const text = cleanString(resolverText, 4000).toLowerCase();
    const haystack = getWindowSearchText(windowDef).toLowerCase();
    let score = 0;
    if (text && haystack) {
        const label = cleanString(windowDef.label, 240).toLowerCase();
        const id = cleanString(windowDef.id, 180).toLowerCase();
        if (label && text.includes(label)) score += 90;
        if (id && text.includes(id)) score += 80;
        for (const alias of windowDef.aliases || []) {
            const cleanAlias = cleanString(alias, 160).toLowerCase();
            if (cleanAlias && text.includes(cleanAlias)) score += 65;
        }
        for (const term of text.split(/[^a-z0-9._:-]+/).filter(Boolean)) {
            if (term.length < 3) continue;
            if (haystack.includes(term)) score += 3;
        }
    }
    const contextDate = parseContextDate(context);
    const contextSortKey = getDateContextSortKey(contextDate);
    const sortRange = getWindowSortKeyRange(windowDef);
    const range = parseAnchorRange(windowDef);
    if (
        contextDate
        && (
            (Number.isFinite(contextSortKey) && sortRange && contextSortKey >= sortRange.from && contextSortKey <= sortRange.to)
            || (range?.from && range?.to && contextDate.epoch >= range.from.epoch && contextDate.epoch <= range.to.epoch)
        )
    ) {
        score += 70;
    }
    score += scoreStructuredContextMatch(windowDef, context, { window: true });
    return score;
}

function makeAnchorCandidate(anchor = {}, score = 0, reason = '') {
    return {
        type: 'anchor',
        id: anchor.id,
        candidateId: `anchor:${anchor.id}`,
        score,
        reason,
        def: anchor,
    };
}

function makeWindowCandidate(windowDef = {}, score = 0, reason = '') {
    return {
        type: 'window',
        id: windowDef.id,
        candidateId: `window:${windowDef.id}`,
        score,
        reason,
        def: windowDef,
    };
}

function serializeContextCandidate(candidate = {}) {
    const def = candidate.def || {};
    const base = {
        candidateId: candidate.candidateId || getTimelineCandidateId(candidate),
        type: candidate.type === 'window' ? 'window' : 'anchor',
        id: def.id || candidate.id || '',
        label: def.label || def.id || candidate.id || '',
        contextType: def.contextType || (candidate.type === 'window' ? 'anchor_window' : 'anchor'),
        score: Math.round(Number(candidate.score) || 0),
        reason: cleanString(candidate.reason, 120),
        dateRange: def.dateRange,
        arc: def.arc,
        phase: def.phase,
        season: def.season,
        episode: def.episode,
        chapter: def.chapter,
        issue: def.issue,
        quest: def.quest,
        gameStage: def.gameStage,
        stardate: def.stardate,
        stardateFrom: def.stardateFrom,
        stardateTo: def.stardateTo,
        coordinates: def.coordinates,
        aliases: (def.aliases || []).slice(0, 8),
        tags: (def.tags || []).slice(0, 10),
    };
    if (candidate.type === 'window') {
        base.anchorFrom = def.anchorFrom || '';
        base.anchorTo = def.anchorTo || '';
        base.sortKeyFrom = Number.isFinite(Number(def.sortKeyFrom)) ? Number(def.sortKeyFrom) : null;
        base.sortKeyTo = Number.isFinite(Number(def.sortKeyTo)) ? Number(def.sortKeyTo) : null;
    } else {
        base.book = def.book;
        base.work = def.work;
        base.sortKey = Number.isFinite(Number(def.sortKey)) ? Number(def.sortKey) : null;
    }
    return base;
}

export function buildContextModelCandidatesForPack(packId = '', context = {}, options = {}) {
    const index = options.index || getContextIndexSync();
    const resolverText = buildResolverText(context, options);
    const limit = Math.max(4, Math.min(60, Number(options.candidateLimit) || MODEL_CANDIDATE_CAP_PER_PACK));
    const candidates = [];
    const candidateIndexes = new Map();
    const addCandidate = (candidate) => {
        const key = candidate?.candidateId || getTimelineCandidateId(candidate);
        if (!key) return;
        const existingIndex = candidateIndexes.get(key);
        if (existingIndex !== undefined) {
            const existing = candidates[existingIndex] || {};
            if ((Number(candidate.score) || 0) > (Number(existing.score) || 0)) {
                candidates[existingIndex] = candidate;
            }
            return;
        }
        candidateIndexes.set(key, candidates.length);
        candidates.push(candidate);
    };

    if (options.includeDateCandidates !== false) {
        const dateMatch = getBestDateMatch(packId, context, index);
        if (dateMatch?.anchor) addCandidate(makeAnchorCandidate(dateMatch.anchor, dateMatch.score, 'date_match'));
        if (dateMatch?.window) addCandidate(makeWindowCandidate(dateMatch.window, dateMatch.score, 'date_match'));
    }

    for (const ranked of rankContextAnchors(resolverText, { packId, index, limit: limit * 2 }) || []) {
        const structuredScore = scoreStructuredContextMatch(ranked.anchor, context, { window: false });
        addCandidate(makeAnchorCandidate(
            ranked.anchor,
            (Number(ranked.score) || 0) + structuredScore,
            structuredScore > 0 ? 'ranked_anchor_structured' : 'ranked_anchor',
        ));
    }

    for (const anchor of getPackAnchors(index, packId)) {
        const structuredScore = scoreStructuredContextMatch(anchor, context, { window: false });
        if (structuredScore > 0) addCandidate(makeAnchorCandidate(anchor, structuredScore, 'structured_anchor'));
    }

    for (const windowDef of getPackWindows(index, packId)) {
        const score = scoreWindowCandidate(windowDef, resolverText, context);
        if (score > 0) addCandidate(makeWindowCandidate(windowDef, score, 'ranked_window'));
    }

    if (!candidates.length && options.includeFallbackCandidates !== false) {
        for (const anchor of getPackAnchors(index, packId).slice(0, Math.ceil(limit / 2))) {
            addCandidate(makeAnchorCandidate(anchor, 0, 'fallback_anchor'));
        }
        for (const windowDef of getPackWindows(index, packId).slice(0, Math.floor(limit / 2))) {
            addCandidate(makeWindowCandidate(windowDef, 0, 'fallback_window'));
        }
    }

    return candidates
        .sort((a, b) => {
            if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
            const aDef = a.def || {};
            const bDef = b.def || {};
            const aSort = Number.isFinite(Number(aDef.sortKey ?? aDef.sortKeyFrom)) ? Number(aDef.sortKey ?? aDef.sortKeyFrom) : 0;
            const bSort = Number.isFinite(Number(bDef.sortKey ?? bDef.sortKeyFrom)) ? Number(bDef.sortKey ?? bDef.sortKeyFrom) : 0;
            return aSort - bSort;
        })
        .slice(0, limit);
}

function currentContextForPack(state = {}, packId = '') {
    const contexts = isPlainObject(state?.loredeckContexts) ? state.loredeckContexts : {};
    return contexts[packId] || getLoredeckContext(state, packId);
}

function patchChangesContext(current = {}, patch = {}) {
    const keys = [
        'contextType',
        'label',
        'sceneDate',
        'contextSortKey',
        'anchorId',
        'anchorFrom',
        'anchorTo',
        'arc',
        'phase',
        'season',
        'episode',
        'chapter',
        'issue',
        'quest',
        'gameStage',
        'stardate',
        'alias',
        'branchId',
        'source',
    ];
    if (keys.some(key => cleanString(current?.[key], 240) !== cleanString(patch?.[key], 240))) return true;
    return JSON.stringify(current?.coordinates || {}) !== JSON.stringify(patch?.coordinates || {});
}

function clampConfidence(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    if (number > 1 && number <= 100) return Math.max(0, Math.min(1, number / 100));
    return Math.max(0, Math.min(1, number));
}

function stripJsonFences(text = '') {
    const cleaned = String(text || '').trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return fenceMatch ? fenceMatch[1].trim() : cleaned;
}

function findBalancedJsonObject(text = '') {
    const value = String(text || '');
    let start = -1;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        if (start < 0) {
            if (ch === '{') {
                start = i;
                depth = 1;
            }
            continue;
        }
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        if (depth === 0) return value.slice(start, i + 1);
    }
    return start >= 0 ? value.slice(start) : '';
}

function parseContextModelResponse(text = '') {
    const candidates = [
        stripJsonFences(text),
        findBalancedJsonObject(text),
        findBalancedJsonObject(stripJsonFences(text)),
    ].filter(Boolean);
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) return { contexts: parsed };
            if (Array.isArray(parsed?.contexts)) return { contexts: parsed.contexts };
            if (isPlainObject(parsed?.result) && Array.isArray(parsed.result.contexts)) return { contexts: parsed.result.contexts };
        } catch (_) {
            // Try the next candidate.
        }
    }
    return { contexts: [] };
}

function getAnchorById(index = {}, packId = '', anchorId = '') {
    const id = cleanString(anchorId, 180);
    const pack = cleanString(packId, 160);
    if (!id || !pack || !Array.isArray(index?.anchors)) return null;
    return index.anchors.find(anchor => anchor.packId === pack && anchor.id === id) || null;
}

function getWindowById(index = {}, packId = '', windowId = '') {
    const id = cleanString(windowId, 180);
    const pack = cleanString(packId, 160);
    if (!id || !pack || !Array.isArray(index?.windows)) return null;
    return index.windows.find(windowDef => windowDef.packId === pack && windowDef.id === id) || null;
}

function getModelChoiceCandidateId(choice = {}) {
    const explicit = cleanString(choice.candidateId || choice.timelineId, 220);
    if (explicit) return explicit.includes(':') ? explicit : `${choice.candidateType === 'window' ? 'window' : 'anchor'}:${explicit}`;
    const windowId = cleanString(choice.windowId, 180);
    if (windowId) return `window:${windowId}`;
    const anchorId = cleanString(choice.anchorId, 180);
    if (anchorId) return `anchor:${anchorId}`;
    return '';
}

function resolveTimelineCandidateForModelChoice(choice = {}, index = {}, options = {}) {
    const packId = cleanString(choice.packId, 160);
    const allowed = new Set((options.candidatesByPack?.[packId] || []).map(candidate => candidate.candidateId).filter(Boolean));
    const candidateId = getModelChoiceCandidateId(choice);
    if (candidateId && allowed.size && !allowed.has(candidateId)) return null;
    if (candidateId.startsWith('window:')) {
        const windowDef = getWindowById(index, packId, candidateId.slice('window:'.length));
        return windowDef ? makeWindowCandidate(windowDef, 0, 'model_choice') : null;
    }
    if (candidateId.startsWith('anchor:')) {
        const anchor = getAnchorById(index, packId, candidateId.slice('anchor:'.length));
        return anchor ? makeAnchorCandidate(anchor, 0, 'model_choice') : null;
    }
    let anchor = getAnchorById(index, packId, choice.anchorId);
    if (anchor) {
        const candidate = makeAnchorCandidate(anchor, 0, 'model_choice_anchor_id');
        return !allowed.size || allowed.has(candidate.candidateId) ? candidate : null;
    }
    const label = cleanString(choice.label || choice.alias || choice.reason, 240);
    if (!label) return null;
    anchor = rankContextAnchors(label, { packId, index, limit: 1 })[0]?.anchor || null;
    if (!anchor) return null;
    const candidate = makeAnchorCandidate(anchor, 0, 'model_choice_label_rank');
    return !allowed.size || allowed.has(candidate.candidateId) ? candidate : null;
}

function buildContextPatchFromModelChoice(choice = {}, candidate = {}, context = {}) {
    const confidence = clampConfidence(choice.confidence, 0.6);
    const def = candidate.def || candidate;
    const patch = candidate.type === 'window'
        ? buildContextPatchFromWindow(def, {
            contextSource: 'model',
            confidence,
        })
        : buildContextPatchFromAnchor(def, {
        contextSource: 'model',
        confidence,
    });
    patch.contextType = cleanString(choice.contextType || patch.contextType, 80) || patch.contextType;
    patch.label = cleanString(choice.label || patch.label, 240);
    patch.sceneDate = cleanString(choice.sceneDate || context.sceneDate || patch.sceneDate, 80);
    patch.stardate = cleanString(choice.stardate || context.stardate || patch.stardate, 80);
    if (isPlainObject(choice.coordinates)) patch.coordinates = choice.coordinates;
    patch.alias = cleanString(choice.alias || patch.alias, 240);
    if (context.branchId) patch.branchId = cleanString(context.branchId, 120) || 'main';
    patch.source = 'model';
    patch.confidence = confidence;
    patch.manualLock = false;
    return patch;
}

function buildContextModelPrompt(context = {}, options = {}) {
    const state = options.state || {};
    const index = options.index || {};
    const targetPackIds = new Set((options.targetPackIds || []).map(packId => cleanString(packId, 160)).filter(Boolean));
    const packs = getEnabledStack(state, index)
        .filter(item => targetPackIds.has(item.packId))
        .map(item => {
            const packIndex = Array.isArray(index.packs) ? index.packs.find(pack => pack.packId === item.packId) : null;
            const rawCandidates = options.candidatesByPack?.[item.packId]
                || buildContextModelCandidatesForPack(item.packId, context, {
                    ...options,
                    state,
                    index,
                });
            const candidates = rawCandidates.map(serializeContextCandidate);
            return {
                packId: item.packId,
                title: packIndex?.title || item.packId,
                timelineMode: packIndex?.timelineMode || '',
                candidates,
            };
        });

    return JSON.stringify({
        task: 'Resolve Context for target Loredecks using only listed bounded candidates.',
        currentStoryContext: {
            sceneDate: context.sceneDate || '',
            subjectiveDate: context.subjectiveDate || '',
            canonBoundary: context.canonBoundary || '',
            branchId: context.branchId || 'main',
            timeTravelMode: context.timeTravelMode || 'none',
            summary: context.summary || '',
            arc: context.arc || '',
            phase: context.phase || '',
            season: context.season || '',
            episode: context.episode || '',
            chapter: context.chapter || '',
            issue: context.issue || '',
            quest: context.quest || '',
            gameStage: context.gameStage || '',
            stardate: context.stardate || '',
            coordinates: isPlainObject(context.coordinates) ? context.coordinates : {},
        },
        supportingText: cleanString(options.sourceText, 3000),
        rules: [
            'Use only candidateId values listed under each pack.',
            'Prefer unresolved over guessing.',
            'Do not output locked packs; locked packs are omitted from targets.',
            'If a date clearly falls within a candidate dateRange, choose that candidate.',
            'If user wording describes a broad before/after range and a window candidate fits, prefer the window.',
            'If wording says before/after but no exact candidate fits, choose the nearest listed candidate only when confidence is at least 0.55.',
            'Return candidateId and candidateType for resolved packs.',
        ],
        targetPacks: packs,
    }, null, 2);
}

export function resolveContextsFromModelResponse(responseText = '', context = {}, options = {}) {
    const state = options.state || getState();
    const index = options.index || getContextIndexSync();
    const targetPackIds = new Set((options.targetPackIds || []).map(packId => cleanString(packId, 160)).filter(Boolean));
    const minConfidence = clampConfidence(options.minConfidence, MIN_MODEL_CONFIDENCE);
    const candidatesByPack = options.candidatesByPack || Object.fromEntries([...targetPackIds].map(packId => [
        packId,
        buildContextModelCandidatesForPack(packId, context, {
            ...options,
            state,
            index,
        }),
    ]));
    const parsed = parseContextModelResponse(responseText);
    const results = [];

    for (const rawChoice of parsed.contexts || []) {
        if (!isPlainObject(rawChoice)) continue;
        const packId = cleanString(rawChoice.packId, 160);
        if (!packId || (targetPackIds.size && !targetPackIds.has(packId))) continue;
        if (!Array.isArray(candidatesByPack[packId])) {
            candidatesByPack[packId] = buildContextModelCandidatesForPack(packId, context, {
                ...options,
                state,
                index,
            });
        }
        const current = currentContextForPack(state, packId);
        if (current?.manualLock === true && options.force !== true) {
            results.push({ packId, status: 'skipped', reason: 'manual_lock' });
            continue;
        }
        const status = cleanString(rawChoice.status, 40).toLowerCase();
        if (status && status !== 'resolved') {
            results.push({ packId, status: 'unresolved', reason: cleanString(rawChoice.reason || status, 240) || 'model_unresolved' });
            continue;
        }
        const confidence = clampConfidence(rawChoice.confidence, 0);
        if (confidence < minConfidence) {
            results.push({ packId, status: 'unresolved', reason: 'model_low_confidence', confidence });
            continue;
        }
        const candidate = resolveTimelineCandidateForModelChoice(rawChoice, index, { candidatesByPack });
        if (!candidate) {
            results.push({ packId, status: 'unresolved', reason: 'model_candidate_not_found' });
            continue;
        }
        const patch = buildContextPatchFromModelChoice(rawChoice, candidate, context);
        const serializedCandidate = serializeContextCandidate(candidate);
        const reason = cleanString(rawChoice.reason, 300);
        const changed = patchChangesContext(current, patch);
        results.push({
            packId,
            status: 'resolved',
            matchType: 'model',
            score: confidence * 100,
            confidence,
            anchor: candidate.type === 'anchor' ? candidate.def : null,
            window: candidate.type === 'window' ? candidate.def : null,
            candidate: serializedCandidate,
            patch,
            changed,
            reason,
            proposal: {
                packId,
                candidateId: serializedCandidate.candidateId,
                candidateType: serializedCandidate.type,
                label: patch.label || serializedCandidate.label,
                summary: reason || `Reasoner selected ${serializedCandidate.label || serializedCandidate.id}.`,
                confidence,
                patch,
            },
        });
    }

    for (const packId of targetPackIds) {
        if (results.some(result => result.packId === packId)) continue;
        results.push({ packId, status: 'unresolved', reason: 'model_no_result' });
    }

    return {
        status: results.some(result => result.status === 'resolved') ? 'resolved' : 'unresolved',
        resolvedCount: results.filter(result => result.status === 'resolved').length,
        changedCount: results.filter(result => result.status === 'resolved' && result.changed).length,
        skippedCount: results.filter(result => result.status === 'skipped').length,
        unresolvedCount: results.filter(result => result.status === 'unresolved').length,
        proposals: results.filter(result => result.status === 'resolved' && result.changed && result.proposal).map(result => result.proposal),
        results,
    };
}

export function resolveContextsFromContext(context = {}, options = {}) {
    const state = options.state || getState();
    const index = options.index || getContextIndexSync();
    const stack = getEnabledStack(state, index);
    const results = [];

    for (const item of stack) {
        const packId = item.packId;
        const current = currentContextForPack(state, packId);
        if (current?.manualLock === true && options.force !== true) {
            results.push({
                packId,
                status: 'skipped',
                reason: 'manual_lock',
            });
            continue;
        }

        const packAnchors = getPackAnchors(index, packId);
        if (!packAnchors.length) {
            results.push({
                packId,
                status: 'unresolved',
                reason: 'no_pack_anchors',
            });
            continue;
        }

        const dateMatch = getBestDateMatch(packId, context, index);
        const aliasMatch = getBestAliasMatch(packId, context, index, options);
        const match = chooseBestMatch(dateMatch, aliasMatch);
        if (!match) {
            results.push({
                packId,
                status: 'unresolved',
                reason: 'no_local_match',
            });
            continue;
        }

        const resolution = buildResolutionFromMatch(packId, match, context, options);
        resolution.changed = patchChangesContext(current, resolution.patch);
        results.push(resolution);
    }

    return {
        status: results.some(result => result.status === 'resolved') ? 'resolved' : 'unresolved',
        resolvedCount: results.filter(result => result.status === 'resolved').length,
        changedCount: results.filter(result => result.status === 'resolved' && result.changed).length,
        skippedCount: results.filter(result => result.status === 'skipped').length,
        unresolvedCount: results.filter(result => result.status === 'unresolved').length,
        results,
    };
}

export async function resolveAndApplyContextsFromContext(context = {}, options = {}) {
    const index = options.index || getContextIndexSync() || await loadContextIndex();
    const state = options.state || getState();
    const resolution = resolveContextsFromContext(context, {
        ...options,
        state,
        index,
    });
    let appliedCount = 0;
    for (const result of resolution.results || []) {
        if (result.status !== 'resolved' || !result.changed || !result.patch) continue;
        setLoredeckContext(result.packId, {
            ...result.patch,
            updatedAt: Date.now(),
        });
        appliedCount += 1;
    }
    return {
        ...resolution,
        appliedCount,
        indexSummary: index?.summary || null,
    };
}

export function applyContextResolutionResults(results = []) {
    let appliedCount = 0;
    for (const result of results || []) {
        if (result.status !== 'resolved' || !result.changed || !result.patch) continue;
        setLoredeckContext(result.packId, {
            ...result.patch,
            updatedAt: Date.now(),
        });
        appliedCount += 1;
    }
    return appliedCount;
}

export async function resolveContextsWithModel(context = {}, options = {}) {
    const index = options.index || getContextIndexSync() || await loadContextIndex();
    const state = options.state || getState();
    const local = resolveContextsFromContext(context, {
        ...options,
        state,
        index,
    });
    const localAppliedCount = options.applyLocal === false ? 0 : applyContextResolutionResults(local.results);
    const targetPackIds = (local.results || [])
        .filter(result => result.status === 'unresolved')
        .map(result => result.packId)
        .filter(Boolean);

    if (!targetPackIds.length) {
        return {
            status: local.resolvedCount ? 'resolved_locally' : 'skipped',
            local,
            model: null,
            appliedCount: localAppliedCount,
            localAppliedCount,
            modelAppliedCount: 0,
            resolvedCount: local.resolvedCount || 0,
            changedCount: local.changedCount || 0,
            skippedCount: local.skippedCount || 0,
            unresolvedCount: local.unresolvedCount || 0,
            targetPackIds,
            indexSummary: index?.summary || null,
        };
    }

    const candidatesByPack = Object.fromEntries(targetPackIds.map(packId => [
        packId,
        buildContextModelCandidatesForPack(packId, context, {
            ...options,
            state,
            index,
        }),
    ]));
    const userPrompt = buildContextModelPrompt(context, {
        ...options,
        state,
        index,
        targetPackIds,
        candidatesByPack,
    });
    const responseText = await sendLoreRequest(CONTEXT_MODEL_SYSTEM_PROMPT, userPrompt, {
        providerKind: 'lore',
        expectedOutput: 'json',
        maxTokens: options.maxTokens || 1800,
        signal: options.signal || null,
    });
    const model = resolveContextsFromModelResponse(responseText, context, {
        ...options,
        state,
        index,
        targetPackIds,
        candidatesByPack,
    });

    const modelAppliedCount = options.applyModel === true ? applyContextResolutionResults(model.results) : 0;

    return {
        status: modelAppliedCount ? 'resolved' : (model.proposals?.length ? 'proposed' : (model.resolvedCount ? 'resolved_unapplied' : 'unresolved')),
        local,
        model,
        appliedCount: localAppliedCount + modelAppliedCount,
        localAppliedCount,
        modelAppliedCount,
        proposalCount: model.proposals?.length || 0,
        proposals: model.proposals || [],
        resolvedCount: (local.resolvedCount || 0) + (model.resolvedCount || 0),
        changedCount: (local.changedCount || 0) + (model.changedCount || 0),
        skippedCount: (local.skippedCount || 0) + (model.skippedCount || 0),
        unresolvedCount: model.unresolvedCount || 0,
        targetPackIds,
        indexSummary: index?.summary || null,
    };
}

export const __contextResolverTestHooks = {
    parseDateLike,
    parseContextDate,
    buildResolverText,
    scoreAnchorDateMatch,
    resolveContextsFromContext,
    buildContextPatchFromAnchor,
    buildContextPatchFromWindow,
    buildContextModelCandidatesForPack,
    buildContextModelPrompt,
    parseContextModelResponse,
    resolveContextsFromModelResponse,
    buildContextPatchFromModelChoice,
};
