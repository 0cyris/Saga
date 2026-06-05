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

const MIN_ALIAS_SCORE = 22;
const MIN_MODEL_CONFIDENCE = 0.55;
const MODEL_ANCHOR_CAP_PER_PACK = 60;
const CONTEXT_MODEL_SYSTEM_PROMPT = `You are the Saga Context Resolver.

Resolve each target Loredeck to one known timeline anchor using only the anchor IDs provided.
Do not invent anchors, dates, arcs, phases, episodes, or canon facts.
If the context is too ambiguous for a pack, mark it unresolved.
Return only valid JSON with this shape:
{
  "contexts": [
    {
      "packId": "string",
      "status": "resolved|unresolved",
      "anchorId": "string",
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

function getEnabledStack(state = {}) {
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

function getPackAnchors(index = {}, packId = '') {
    const id = cleanString(packId, 160);
    return Array.isArray(index?.anchors)
        ? index.anchors.filter(anchor => anchor?.packId === id)
        : [];
}

function buildResolverText(context = {}, options = {}) {
    const parts = [
        context.label,
        context.sceneDate,
        context.subjectiveDate,
        context.canonBoundary,
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
        alias: anchor.aliases?.[0] || anchor.label || anchor.id || '',
        source: mapResolverSource(options.contextSource),
        confidence: Number.isFinite(Number(options.confidence)) ? Number(options.confidence) : 0.66,
        manualLock: false,
    };
}

function buildResolutionFromMatch(packId, match, context = {}, options = {}) {
    const patch = buildContextPatchFromAnchor(match.anchor, {
        contextSource: options.contextSource,
        confidence: match.confidence,
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
        anchor: match.anchor,
        patch,
    };
}

function getBestDateMatch(packId, context = {}, index = {}) {
    const contextDate = parseContextDate(context);
    if (!contextDate) return null;
    return getPackAnchors(index, packId)
        .map(anchor => scoreAnchorDateMatch(anchor, contextDate))
        .filter(Boolean)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.spanDays !== b.spanDays) return a.spanDays - b.spanDays;
            return (a.anchor.sortKey || 0) - (b.anchor.sortKey || 0);
        })[0] || null;
}

function getBestAliasMatch(packId, context = {}, index = {}, options = {}) {
    const resolverText = buildResolverText(context, options);
    if (!resolverText) return null;
    const ranked = rankContextAnchors(resolverText, { packId, index, limit: 5 });
    const top = ranked[0];
    if (!top || top.score < MIN_ALIAS_SCORE) return null;
    return {
        anchor: top.anchor,
        score: top.score,
        matchType: 'alias',
        confidence: confidenceFromAliasScore(top.score),
    };
}

function chooseBestMatch(dateMatch = null, aliasMatch = null) {
    if (!dateMatch) return aliasMatch;
    if (!aliasMatch) return dateMatch;
    if (dateMatch.anchor?.id && dateMatch.anchor.id === aliasMatch.anchor?.id) return dateMatch;
    if (aliasMatch.score >= 80 && aliasMatch.score >= dateMatch.score - 8) return aliasMatch;
    return dateMatch;
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
        'alias',
        'branchId',
        'source',
    ];
    return keys.some(key => cleanString(current?.[key], 240) !== cleanString(patch?.[key], 240));
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

function resolveAnchorForModelChoice(choice = {}, index = {}) {
    const packId = cleanString(choice.packId, 160);
    let anchor = getAnchorById(index, packId, choice.anchorId);
    if (anchor) return anchor;
    const label = cleanString(choice.label || choice.alias || choice.reason, 240);
    if (!label) return null;
    return rankContextAnchors(label, { packId, index, limit: 1 })[0]?.anchor || null;
}

function buildContextPatchFromModelChoice(choice = {}, anchor = {}, context = {}) {
    const confidence = clampConfidence(choice.confidence, 0.6);
    const patch = buildContextPatchFromAnchor(anchor, {
        contextSource: 'model',
        confidence,
    });
    patch.contextType = cleanString(choice.contextType || patch.contextType, 80) || patch.contextType;
    patch.label = cleanString(choice.label || patch.label, 240);
    patch.sceneDate = cleanString(choice.sceneDate || context.sceneDate || patch.sceneDate, 80);
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
    const packs = getEnabledStack(state)
        .filter(item => targetPackIds.has(item.packId))
        .map(item => {
            const packIndex = Array.isArray(index.packs) ? index.packs.find(pack => pack.packId === item.packId) : null;
            const anchors = getPackAnchors(index, item.packId)
                .slice(0, MODEL_ANCHOR_CAP_PER_PACK)
                .map(anchor => ({
                    id: anchor.id,
                    label: anchor.label,
                    contextType: anchor.contextType,
                    dateRange: anchor.dateRange,
                    book: anchor.book,
                    arc: anchor.arc,
                    phase: anchor.phase,
                    aliases: (anchor.aliases || []).slice(0, 8),
                    tags: (anchor.tags || []).slice(0, 10),
                }));
            return {
                packId: item.packId,
                title: packIndex?.title || item.packId,
                timelineMode: packIndex?.timelineMode || '',
                anchors,
            };
        });

    return JSON.stringify({
        task: 'Resolve Context for target Loredecks using only listed anchors.',
        currentStoryContext: {
            sceneDate: context.sceneDate || '',
            subjectiveDate: context.subjectiveDate || '',
            canonBoundary: context.canonBoundary || '',
            branchId: context.branchId || 'main',
            timeTravelMode: context.timeTravelMode || 'none',
            summary: context.summary || '',
        },
        supportingText: cleanString(options.sourceText, 3000),
        rules: [
            'Use only anchor IDs listed under each pack.',
            'Prefer unresolved over guessing.',
            'Do not output locked packs; locked packs are omitted from targets.',
            'If a date clearly falls within an anchor dateRange, choose that anchor.',
            'If user wording says before/after but no exact anchor is listed, choose the nearest listed anchor only when confidence is at least 0.55.',
        ],
        targetPacks: packs,
    }, null, 2);
}

export function resolveContextsFromModelResponse(responseText = '', context = {}, options = {}) {
    const state = options.state || getState();
    const index = options.index || getContextIndexSync();
    const targetPackIds = new Set((options.targetPackIds || []).map(packId => cleanString(packId, 160)).filter(Boolean));
    const minConfidence = clampConfidence(options.minConfidence, MIN_MODEL_CONFIDENCE);
    const parsed = parseContextModelResponse(responseText);
    const results = [];

    for (const rawChoice of parsed.contexts || []) {
        if (!isPlainObject(rawChoice)) continue;
        const packId = cleanString(rawChoice.packId, 160);
        if (!packId || (targetPackIds.size && !targetPackIds.has(packId))) continue;
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
        const anchor = resolveAnchorForModelChoice(rawChoice, index);
        if (!anchor) {
            results.push({ packId, status: 'unresolved', reason: 'model_anchor_not_found' });
            continue;
        }
        const patch = buildContextPatchFromModelChoice(rawChoice, anchor, context);
        results.push({
            packId,
            status: 'resolved',
            matchType: 'model',
            score: confidence * 100,
            confidence,
            anchor,
            patch,
            changed: patchChangesContext(current, patch),
            reason: cleanString(rawChoice.reason, 300),
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
        results,
    };
}

export function resolveContextsFromContext(context = {}, options = {}) {
    const state = options.state || getState();
    const index = options.index || getContextIndexSync();
    const stack = getEnabledStack(state);
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

export async function resolveContextsWithModel(context = {}, options = {}) {
    const index = options.index || getContextIndexSync() || await loadContextIndex();
    const state = options.state || getState();
    const local = resolveContextsFromContext(context, {
        ...options,
        state,
        index,
    });
    let localAppliedCount = 0;
    for (const result of local.results || []) {
        if (result.status !== 'resolved' || !result.changed || !result.patch) continue;
        setLoredeckContext(result.packId, {
            ...result.patch,
            updatedAt: Date.now(),
        });
        localAppliedCount += 1;
    }
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
            targetPackIds,
            indexSummary: index?.summary || null,
        };
    }

    const userPrompt = buildContextModelPrompt(context, {
        ...options,
        state,
        index,
        targetPackIds,
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
    });

    let modelAppliedCount = 0;
    for (const result of model.results || []) {
        if (result.status !== 'resolved' || !result.changed || !result.patch) continue;
        setLoredeckContext(result.packId, {
            ...result.patch,
            updatedAt: Date.now(),
        });
        modelAppliedCount += 1;
    }

    return {
        status: model.resolvedCount ? 'resolved' : 'unresolved',
        local,
        model,
        appliedCount: localAppliedCount + modelAppliedCount,
        localAppliedCount,
        modelAppliedCount,
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
    buildContextModelPrompt,
    parseContextModelResponse,
    resolveContextsFromModelResponse,
    buildContextPatchFromModelChoice,
};
