/**
 * auto-relevance.js — Saga
 * Local high-performance Auto-Relevance pass for accepted lore entries.
 *
 * The pass is deliberately local-first: every accepted entry is scored without an
 * LLM call, then only high-signal promotion and demotion candidates are changed.
 * Higher automation levels add validated pin/mute/remap and curation operations.
 */

import { getSettings, getState, saveState } from '../state/state-manager.js';
import { normalizeLoreEntry, normalizeLoreMatrix } from '../lorecards/lore-matrix.js';
import {
    getLoreAutomationState,
    isLoreAutomationEnabledForEntry,
    markLoreAutomationAction,
    normalizeLoreAutomationMode,
    normalizeLoreAutomationProviderRouting,
    normalizeLoreAutomationStyle,
    setLoreAutomationEnabled,
} from '../lorecards/lore-automation.js';
import { computeLocalLoreRelevance, normalizeLoreRelevance, relevanceWeight } from '../lorecards/lore-relevance.js';
import { sendLoreRequest, validateLoreProviderConfiguration } from '../providers/lore-llm-client.js';
import {
    extractLoreResponseText,
    LORE_PARSE_ERROR_CODES,
} from '../providers/lore-response-normalizer.js';
import { captureLoreTimelineState, getLoreTimelineEvents, recordLoreTimelineEvent } from '../lorecards/lore-timeline.js';
import {
    previewCanonLoreForContext,
} from './canon-lore-db.js';

let autoRelevanceRunning = false;

const LORE_AUTOMATION_MODE_RANK = Object.freeze({ off: 0, ar: 1, armp: 2, armpc: 3 });
const LORE_AUTOMATION_STYLE_THRESHOLDS = Object.freeze({
    careful: {
        relevanceThreshold: 0.84,
        pinScore: 90,
        unpinScore: 18,
        muteScore: -1,
        unmuteScore: 86,
        remapCap: 4,
        curationCap: 1,
        retirementCap: 1,
        targetMin: 2,
        targetMax: 6,
        stalePasses: 2,
    },
    balanced: {
        relevanceThreshold: 0.72,
        pinScore: 84,
        unpinScore: 24,
        muteScore: 3,
        unmuteScore: 80,
        remapCap: 8,
        curationCap: 2,
        retirementCap: 1,
        targetMin: 3,
        targetMax: 9,
        stalePasses: 1,
    },
    aggressive: {
        relevanceThreshold: 0.62,
        pinScore: 78,
        unpinScore: 32,
        muteScore: 10,
        unmuteScore: 72,
        remapCap: 12,
        curationCap: 4,
        retirementCap: 3,
        targetMin: 4,
        targetMax: 14,
        stalePasses: 1,
    },
});

const LORE_AUTOMATION_CURATION_PACKET_CAP = 64;
const LORE_AUTOMATION_COVERAGE_STOP_WORDS = new Set([
    'about', 'after', 'again', 'before', 'being', 'from', 'have', 'into', 'near', 'needs',
    'next', 'scene', 'that', 'their', 'them', 'then', 'there', 'they', 'this', 'with',
]);
const LORE_AUTOMATION_BLOCKED_CURATION_STATUSES = new Set(['needs_context', 'unavailable', 'failed_parse', 'model_failed']);

function supportsLoreAutomationMode(actual = 'off', required = 'ar') {
    return (LORE_AUTOMATION_MODE_RANK[normalizeLoreAutomationMode(actual)] || 0) >= (LORE_AUTOMATION_MODE_RANK[normalizeLoreAutomationMode(required)] || 0);
}

function buildLoreAutomationRunId(mode = 'ar') {
    return `lore-automation-${normalizeLoreAutomationMode(mode)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLoreAutomationStyleProfile(settings = {}) {
    const style = normalizeLoreAutomationStyle(settings.loreAutomationStyle || 'balanced');
    return {
        style,
        ...(LORE_AUTOMATION_STYLE_THRESHOLDS[style] || LORE_AUTOMATION_STYLE_THRESHOLDS.balanced),
    };
}

function getLoreAutomationActionMode(settings = {}, mode = 'ar') {
    if (normalizeLoreAutomationMode(mode) === 'off') return 'off';
    return 'apply_high_confidence';
}

function selectLoreAutomationProviderKind(settings = {}, task = 'armp') {
    const routing = normalizeLoreAutomationProviderRouting(settings.loreAutomationProviderRouting || 'auto');
    if (routing === 'local') return '';
    if (routing === 'utility') return 'continuity';
    if (routing === 'reasoning') return 'lore';
    return task === 'armp' ? 'continuity' : 'lore';
}

function compactLoreAutomationOperationForJournal(operation = {}) {
    return {
        id: String(operation.id || operation.targetId || '').slice(0, 160),
        operation: String(operation.operation || '').slice(0, 48),
        title: String(operation.title || '').slice(0, 160),
        confidence: Math.max(0, Math.min(1, Number(operation.confidence) || 0)),
        provider: String(operation.provider || operation.source || '').slice(0, 24),
        reason: String(operation.reason || '').slice(0, 240),
    };
}

function recordLoreAutomationRun(state, run, settings = getSettings()) {
    if (!state || !run) return null;
    const compact = {
        id: String(run.id || buildLoreAutomationRunId(run.mode || 'ar')).slice(0, 140),
        mode: normalizeLoreAutomationMode(run.mode || 'ar'),
        style: normalizeLoreAutomationStyle(run.style || settings.loreAutomationStyle || 'balanced'),
        status: String(run.status || 'unknown').slice(0, 60),
        providerStatus: String(run.providerStatus || '').slice(0, 60),
        modelStatus: String(run.modelStatus || '').slice(0, 60),
        modelError: String(run.modelError || '').slice(0, 240),
        considered: Math.max(0, Number(run.considered) || 0),
        changed: Math.max(0, Number(run.changed) || 0),
        suggested: Math.max(0, Number(run.suggested) || 0),
        promotions: Math.max(0, Number(run.promotions) || 0),
        demotions: Math.max(0, Number(run.demotions) || 0),
        pinned: Math.max(0, Number(run.pinned) || 0),
        unpinned: Math.max(0, Number(run.unpinned) || 0),
        muted: Math.max(0, Number(run.muted) || 0),
        unmuted: Math.max(0, Number(run.unmuted) || 0),
        curated: Math.max(0, Number(run.curated) || 0),
        pendingCurated: Math.max(0, Number(run.pendingCurated) || 0),
        retired: Math.max(0, Number(run.retired) || 0),
        recentMessageChars: Math.max(0, Number(run.recentMessageChars) || 0),
        ranAt: Number.isFinite(Number(run.ranAt)) ? Number(run.ranAt) : Date.now(),
        operations: Array.isArray(run.operations) ? run.operations.slice(0, 40).map(compactLoreAutomationOperationForJournal) : [],
    };
    const limit = Math.max(1, Math.min(100, Number(settings.loreAutomationRunJournalLimit) || 20));
    state.loreAutomationLastRun = compact;
    state.loreAutomationRuns = [...(Array.isArray(state.loreAutomationRuns) ? state.loreAutomationRuns : []), compact].slice(-limit);
    return compact;
}

function cleanAutomationText(value = '', limit = 400) {
    return String(value || '').trim().slice(0, limit);
}

function countWords(text = '') {
    return (String(text || '').match(/\b[\p{L}\p{N}][\p{L}\p{N}'-]*\b/gu) || []).length;
}

function getChatMessages() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        return Array.isArray(ctx?.chat) ? ctx.chat : [];
    } catch (_) {
        return [];
    }
}

function getMessageStableId(message = {}, index = 0) {
    return cleanAutomationText(message?.extra?.gen_id || message?.send_date || message?.id || `${index}:${String(message?.mes || message?.content || '').slice(0, 60)}`, 120);
}

function getTotalStoryWordCount() {
    return getChatMessages().reduce((total, message) => {
        const body = typeof message?.mes === 'string' ? message.mes : typeof message?.content === 'string' ? message.content : '';
        return total + countWords(body);
    }, 0);
}

function getLatestMessageId() {
    const chat = getChatMessages();
    return chat.length ? getMessageStableId(chat[chat.length - 1], chat.length - 1) : '';
}

function stableStringify(value) {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function stableHash(value) {
    const text = stableStringify(value);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function normalizeStringArray(values = [], limit = 24) {
    return (Array.isArray(values) ? values : [values])
        .map(value => cleanAutomationText(value, 120))
        .filter(Boolean)
        .slice(0, limit)
        .sort((a, b) => a.localeCompare(b));
}

function buildContextAutomationHash(state = {}) {
    return stableHash({
        sceneDate: state?.loreContext?.sceneDate || state?.canon?.inUniverseDate || '',
        canonBoundary: state?.loreContext?.canonBoundary || state?.canon?.canonBoundary || '',
        branchId: state?.loreContext?.branchId || state?.branchId || 'main',
        location: state?.scene?.location || '',
        currentActivity: state?.scene?.currentActivity || '',
        presentCharacters: normalizeStringArray(state?.scene?.presentCharacters || []),
        nearbyCharacters: normalizeStringArray(state?.scene?.nearbyCharacters || []),
    });
}

function buildDeckStackAutomationHash(state = {}) {
    const stack = Array.isArray(state?.loredeckStack) ? state.loredeckStack : [];
    return stableHash(stack.map(item => ({
        id: item?.packId || item?.deckId || item?.id || '',
        enabled: item?.enabled !== false,
        order: Number(item?.sortOrder ?? item?.order ?? 0) || 0,
    })));
}

function buildAcceptedAutomationHash(state = {}) {
    const pinned = new Set(state?.loreSelection?.pinnedIds || []);
    const muted = new Set(state?.loreSelection?.suppressedIds || []);
    return stableHash(normalizeLoreMatrix(state?.loreMatrix || []).map(entry => {
        const automation = getLoreAutomationState(entry);
        return {
            id: entry.id,
            relevance: normalizeLoreRelevance(entry.relevance || 'normal'),
            pinned: pinned.has(entry.id),
            muted: muted.has(entry.id),
            automationEnabled: automation.enabled !== false,
            owner: automation.owner,
            lastAction: automation.lastAction,
        };
    }));
}

function getDefaultLoreAutomationCadence() {
    return {
        lastRemapAtMessageId: '',
        lastRemapWordCount: 0,
        lastCurationAtMessageId: '',
        lastCurationWordCount: 0,
        accumulatedRemapWords: 0,
        accumulatedCurationWords: 0,
        lastContextHash: '',
        lastDeckStackHash: '',
        lastAcceptedAutomationHash: '',
        pendingReason: '',
        lastEdgeClassifier: { edge: 'none', confidence: 0, changed: [], reason: '', wordCount: 0, checkedAt: 0 },
        staleEvidenceByCardId: {},
        cooldownByCardId: {},
    };
}

function normalizeLoreAutomationCadence(state = {}) {
    const raw = state.loreAutomationCadence && typeof state.loreAutomationCadence === 'object' && !Array.isArray(state.loreAutomationCadence)
        ? state.loreAutomationCadence
        : {};
    const defaults = getDefaultLoreAutomationCadence();
    const next = {
        ...defaults,
        ...raw,
        lastEdgeClassifier: {
            ...defaults.lastEdgeClassifier,
            ...(raw.lastEdgeClassifier && typeof raw.lastEdgeClassifier === 'object' && !Array.isArray(raw.lastEdgeClassifier) ? raw.lastEdgeClassifier : {}),
        },
        staleEvidenceByCardId: raw.staleEvidenceByCardId && typeof raw.staleEvidenceByCardId === 'object' && !Array.isArray(raw.staleEvidenceByCardId) ? raw.staleEvidenceByCardId : {},
        cooldownByCardId: raw.cooldownByCardId && typeof raw.cooldownByCardId === 'object' && !Array.isArray(raw.cooldownByCardId) ? raw.cooldownByCardId : {},
    };
    state.loreAutomationCadence = next;
    return next;
}

function getLoreAutomationPacingPolicy(settings = {}) {
    const pacing = ['responsive', 'normal', 'relaxed'].includes(String(settings.loreAutomationPacing || '').toLowerCase())
        ? String(settings.loreAutomationPacing).toLowerCase()
        : 'normal';
    const multipliers = { responsive: 0.65, normal: 1, relaxed: 1.6 };
    const multiplier = multipliers[pacing] || 1;
    return {
        pacing,
        remapWordBudget: Math.max(80, Math.round((Number(settings.loreAutomationRemapWordBudget) || 900) * multiplier)),
        curationWordBudget: Math.max(160, Math.round((Number(settings.loreAutomationCurationWordBudget) || 1800) * multiplier)),
        edgeClassifierMinWords: Math.max(120, Math.round((Number(settings.loreAutomationRemapWordBudget) || 900) * multiplier * 0.45)),
    };
}

function normalizeLanePart(value = '') {
    return cleanAutomationText(value, 80).toLowerCase().replace(/\s+/g, ' ');
}

function addLane(set, type, value) {
    const clean = normalizeLanePart(value);
    if (clean) set.add(`${type}:${clean}`);
}

function getCoverageTerms(value = '', options = {}) {
    const clean = normalizeLanePart(value)
        .replace(/[^a-z0-9'\s-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return [];
    const terms = new Set();
    if (!LORE_AUTOMATION_COVERAGE_STOP_WORDS.has(clean)) terms.add(clean);
    const tokens = clean.split(/\s+/)
        .map(token => token.replace(/^-+|-+$/g, ''))
        .filter(token => token.length >= 3 && !LORE_AUTOMATION_COVERAGE_STOP_WORDS.has(token));
    for (const token of tokens) terms.add(token);
    if (options.phrases !== false) {
        for (let size = 2; size <= 3; size += 1) {
            for (let index = 0; index <= tokens.length - size; index += 1) {
                terms.add(tokens.slice(index, index + size).join(' '));
            }
        }
    }
    return Array.from(terms).slice(0, Math.max(1, Number(options.limit) || 18));
}

function splitCoverageLane(lane = '') {
    const text = String(lane || '');
    const index = text.indexOf(':');
    if (index < 0) return { type: '', value: text };
    return { type: text.slice(0, index), value: text.slice(index + 1) };
}

function getMatchingCoverageLanes(contextLanes, type, value) {
    const clean = normalizeLanePart(value);
    if (!clean || clean.length < 3) return [];
    const matches = [];
    for (const lane of contextLanes) {
        const parsed = splitCoverageLane(lane);
        if (parsed.type !== type || !parsed.value) continue;
        if (
            parsed.value === clean
            || (clean.length >= 4 && parsed.value.includes(clean))
            || (parsed.value.length >= 4 && clean.includes(parsed.value))
        ) {
            matches.push(lane);
        }
    }
    return matches;
}

function getContextCoverageLaneIds(state = {}) {
    const lanes = new Set();
    for (const character of normalizeStringArray([...(state?.scene?.presentCharacters || []), ...(state?.scene?.nearbyCharacters || [])], 12)) {
        addLane(lanes, 'character', character);
    }
    addLane(lanes, 'location', state?.scene?.location || '');
    for (const token of getCoverageTerms(state?.scene?.currentActivity || '', { limit: 18 })) {
        addLane(lanes, 'objective', token);
    }
    return Array.from(lanes);
}

function getEntryCoverageLaneIds(entry = {}, state = {}) {
    const contextLanes = getContextCoverageLaneIds(state);
    const lanes = new Set();
    const scope = entry.scope || {};
    const addMatching = (type, values = []) => {
        for (const value of normalizeStringArray(values, 24)) {
            for (const lane of getMatchingCoverageLanes(contextLanes, type, value)) lanes.add(lane);
        }
    };
    const objectiveValues = [
        ...(scope.topics || []),
        ...(entry.activeWhen?.tagsAny || []),
        ...(entry.tags || []),
    ].flatMap(value => getCoverageTerms(value, { limit: 8 }));
    addMatching('character', scope.characters || entry.activeWhen?.charactersPresentAny || []);
    addMatching('location', scope.locations || entry.activeWhen?.locationsAny || []);
    addMatching('objective', objectiveValues);
    return Array.from(lanes);
}

function hasUsableLoreAutomationContext(state = {}) {
    return !!(
        state?.loreContext?.sceneDate
        || state?.loreContext?.canonBoundary
        || state?.canon?.inUniverseDate
        || state?.canon?.canonBoundary
        || state?.scene?.location
        || state?.scene?.currentActivity
        || (Array.isArray(state?.scene?.presentCharacters) && state.scene.presentCharacters.length)
        || (Array.isArray(state?.scene?.nearbyCharacters) && state.scene.nearbyCharacters.length)
    );
}

function isLoreAutomationBackgroundEnabled(settings = {}) {
    const mode = String(settings.automationMode || settings.workflowMode || 'manual').toLowerCase();
    return mode === 'automatic' || settings.autoGenerateLore === true;
}

function isAutomationOwnedEntry(entry = {}) {
    const automation = getLoreAutomationState(entry);
    return automation.owner === 'auto'
        || entry.extensions?.loreAutomationCuration?.source === 'active_deck'
        || automation.lastAction === 'accept_from_active_decks';
}

function getAutomationOwnedAcceptedEntries(state = {}) {
    return normalizeLoreMatrix(state?.loreMatrix || [])
        .filter(entry => entry?.id && isLoreAutomationEnabledForEntry(entry) && isAutomationOwnedEntry(entry));
}

function computeLoreAutomationStackPressure(state = {}, settings = getSettings(), recentText = '') {
    const profile = getLoreAutomationStyleProfile(settings);
    const owned = getAutomationOwnedAcceptedEntries(state);
    const laneCoverage = new Map();
    for (const entry of owned) {
        for (const lane of getEntryCoverageLaneIds(entry, state)) {
            if (!laneCoverage.has(lane)) laneCoverage.set(lane, []);
            laneCoverage.get(lane).push(entry.id);
        }
    }
    const activeDeckCount = Array.isArray(state?.loredeckStack)
        ? state.loredeckStack.filter(item => item?.enabled !== false).length
        : 0;
    const contextLanes = getContextCoverageLaneIds(state);
    const missingLanes = contextLanes.filter(lane => !laneCoverage.has(lane));
    const missingCoverageCanBeFilled = missingLanes.length > 0 && activeDeckCount > 0;
    const requiredPasses = Math.max(1, Number(profile.stalePasses) || 1);
    const staleCandidates = getRetirementScanItems(state, settings, recentText, profile)
        .filter(item => item.stale && item.stalePasses >= requiredPasses);
    const belowTarget = owned.length < Math.max(0, Number(profile.targetMin) || 0) && activeDeckCount > 0;
    const aboveTarget = owned.length > Math.max(1, Number(profile.targetMax) || 1);
    const duplicateLaneCount = Array.from(laneCoverage.values()).filter(ids => ids.length > 1).length;
    let pressure = 'none';
    if (belowTarget || missingCoverageCanBeFilled) pressure = staleCandidates.length ? 'replace' : 'add';
    if (aboveTarget || staleCandidates.length || duplicateLaneCount) pressure = pressure === 'add' ? 'replace' : 'remove';
    const reasons = [];
    if (belowTarget) reasons.push(`below target ${owned.length}/${profile.targetMin}`);
    if (aboveTarget) reasons.push(`above target ${owned.length}/${profile.targetMax}`);
    if (missingCoverageCanBeFilled) reasons.push(`${missingLanes.length} coverage lane${missingLanes.length === 1 ? '' : 's'} uncovered`);
    if (staleCandidates.length) reasons.push(`${staleCandidates.length} stale automation-owned card${staleCandidates.length === 1 ? '' : 's'}`);
    if (duplicateLaneCount) reasons.push(`${duplicateLaneCount} duplicate coverage lane${duplicateLaneCount === 1 ? '' : 's'}`);
    return {
        pressure,
        ownedCount: owned.length,
        targetMin: profile.targetMin,
        targetMax: profile.targetMax,
        missingLanes,
        staleCount: staleCandidates.length,
        duplicateLaneCount,
        reason: reasons.join('; '),
    };
}

function updateLoreAutomationCadenceHashes(state = {}) {
    const cadence = normalizeLoreAutomationCadence(state);
    cadence.lastContextHash = buildContextAutomationHash(state);
    cadence.lastDeckStackHash = buildDeckStackAutomationHash(state);
    cadence.lastAcceptedAutomationHash = buildAcceptedAutomationHash(state);
    return cadence;
}

function markLoreAutomationCadenceRun(state = {}, options = {}) {
    const cadence = updateLoreAutomationCadenceHashes(state);
    const wordCount = getTotalStoryWordCount();
    const messageId = getLatestMessageId();
    if (options.remap !== false) {
        cadence.lastRemapWordCount = wordCount;
        cadence.lastRemapAtMessageId = messageId;
        cadence.accumulatedRemapWords = 0;
    }
    if (options.curation === true) {
        cadence.lastCurationWordCount = wordCount;
        cadence.lastCurationAtMessageId = messageId;
        cadence.accumulatedCurationWords = 0;
    }
    cadence.pendingReason = '';
    return cadence;
}

function stripJsonFences(text) {
    const raw = String(text || '').trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return (fence ? fence[1] : raw).trim();
}

function parseJsonObject(text) {
    const responseText = extractLoreResponseText(text);
    const cleaned = stripJsonFences(responseText).replace(/^\uFEFF/, '').trim();
    try { return JSON.parse(cleaned); } catch (_) {}
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
    }
    return null;
}

function buildEdgeClassifierPrompts({ state, recentText, cadence }) {
    const system = `You are Saga's Lore Automation cadence edge classifier.

Task:
- Decide whether recent prose indicates a narrative edge that should pull Lore Automation forward.
- Do not choose Lorecards or recommend curation actions.
- Return only JSON: {"edge":"none|soft_scene_shift|hard_scene_shift|chapter_or_arc_shift","confidence":0.0-1.0,"changed":["location|cast|objective|time|chapter|deck|other"],"reason":"short"}`;
    const payload = {
        lastSnapshot: {
            contextHash: cadence?.lastContextHash || '',
            deckStackHash: cadence?.lastDeckStackHash || '',
            acceptedAutomationHash: cadence?.lastAcceptedAutomationHash || '',
        },
        currentContext: {
            sceneDate: state?.loreContext?.sceneDate || state?.canon?.inUniverseDate || '',
            canonBoundary: state?.loreContext?.canonBoundary || state?.canon?.canonBoundary || '',
            branchId: state?.loreContext?.branchId || 'main',
            location: state?.scene?.location || '',
            currentActivity: state?.scene?.currentActivity || '',
            presentCharacters: state?.scene?.presentCharacters || [],
            nearbyCharacters: state?.scene?.nearbyCharacters || [],
        },
        recentMessages: String(recentText || '').slice(-4000),
    };
    return { system, user: JSON.stringify(payload, null, 2) };
}

async function classifyLoreAutomationEdge(state, settings, recentText, cadence) {
    const providerKind = selectLoreAutomationProviderKind(settings, 'armp');
    if (providerKind !== 'continuity') return { edge: 'none', confidence: 0, changed: [], reason: '', status: 'skipped' };
    const validation = validateLoreProviderConfiguration(providerKind);
    if (!validation.ok) return { edge: 'none', confidence: 0, changed: [], reason: validation.message || '', status: 'unavailable' };
    const { system, user } = buildEdgeClassifierPrompts({ state, recentText, cadence });
    const response = await sendLoreRequest(system, user, {
        providerKind,
        expectedOutput: 'json',
        maxTokens: 512,
    });
    const parsed = parseJsonObject(response);
    if (!parsed) return { edge: 'none', confidence: 0, changed: [], reason: 'Malformed edge classifier JSON.', status: 'failed_parse' };
    const edge = ['none', 'soft_scene_shift', 'hard_scene_shift', 'chapter_or_arc_shift'].includes(String(parsed.edge || '').trim())
        ? String(parsed.edge).trim()
        : 'none';
    return {
        edge,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        changed: Array.isArray(parsed.changed) ? parsed.changed.map(item => cleanAutomationText(item, 40)).filter(Boolean).slice(0, 8) : [],
        reason: cleanAutomationText(parsed.reason, 180),
        status: 'classified',
    };
}

function summarizeEntryForModel(item) {
    const e = item.entry || {};
    const scope = e.scope || {};
    const date = e.date || {};
    const content = e.content || {};
    return {
        id: e.id,
        title: e.title || e.id,
        currentRelevance: item.current,
        localSuggestedRelevance: item.next,
        priority: Number(e.priority || 50),
        pinned: !!item.pinned,
        canon: e.canon || e.canonStatus || 'canon',
        category: e.category || 'other',
        lorePurpose: e.lorePurpose || '',
        specificityScore: Number(e.specificityScore || 0),
        dateWindow: [date.validFrom || e.validFrom || '', date.validTo || e.validTo || ''].filter(Boolean).join(' to '),
        scope: {
            characters: (scope.characters || []).slice?.(0, 8) || [],
            locations: (scope.locations || []).slice?.(0, 6) || [],
            topics: (scope.topics || []).slice?.(0, 8) || [],
            tags: (e.tags || []).slice?.(0, 10) || [],
        },
        fact: String(content.fact || e.fact || content.injection || '').slice(0, 500),
        localReason: `score=${item.local.score}; temporal=${item.local.temporalRole}; recentHit=${!!item.local.recentHit}`,
    };
}

function buildModelAdjudicationPrompts({ state, settings, candidates, recentText }) {
    const scene = state?.scene || {};
    const context = state?.loreContext || {};
    const system = `You are Saga's Auto-Relevance adjudicator.

Task:
- Review a compact candidate set of accepted lore entries.
- Assign only a relevance tier: high, normal, or low.
- Relevance is about current story usefulness, not Canon/AU status and not injection on/off.
- High = specific lore that directly constrains the next reply: current scene, immediately relevant characters/locations/items/secrets/events, or a current timing/knowledge/status gate.
- Normal = specific recent background, near-future/near-past, important story facts, or medium-context lore.
- Low = specific but long-term background, distant past/future, or not currently needed.
- Never promote generic reference/glossary/basic canon facts to High. If an entry lacks a specific lorePurpose, keep it Low.
- Respect pinned entries: do not demote them unless clearly irrelevant.
- Treat priority as ordering inside a tier, not as a reason to make generic facts High.
- Output only JSON: {"changes":[{"id":"...","relevance":"high|normal|low","confidence":0.0-1.0,"reason":"short"}]}
- Include an entry only when you recommend a change from currentRelevance and confidence is meaningful.`;
    const payload = {
        storyContext: {
            sceneDate: context.sceneDate || state?.canon?.inUniverseDate || '',
            canonBoundary: context.canonBoundary || state?.canon?.canonBoundary || '',
            branchId: context.branchId || 'main',
        },
        scene: {
            location: scene.location || '',
            currentActivity: scene.currentActivity || '',
            presentCharacters: scene.presentCharacters || [],
            nearbyCharacters: scene.nearbyCharacters || [],
        },
        recentMessages: String(recentText || '').slice(-Math.max(1000, Math.min(12000, Number(settings.autoRelevanceModelRecentChars) || 5000))),
        candidates: candidates.map(summarizeEntryForModel),
    };
    return { system, user: JSON.stringify(payload, null, 2) };
}

function buildAutoRelevanceModelParseFailure() {
    return {
        changes: [],
        status: 'failed_parse',
        errorCode: LORE_PARSE_ERROR_CODES.JSON_INVALID,
        error: 'Auto-Relevance model returned malformed JSON.',
    };
}

async function adjudicateCandidatesWithModel(candidates, state, settings, recentText) {
    if (!settings.autoRelevanceUseModel) return { changes: [], status: 'skipped' };
    const validation = validateLoreProviderConfiguration('continuity');
    if (!validation.ok) return { changes: [], status: 'unavailable', error: validation.message };
    const maxModelCandidates = Math.max(1, Math.min(80, Number(settings.autoRelevanceModelCandidateCap) || 30));
    const modelCandidates = candidates.slice(0, maxModelCandidates);
    if (!modelCandidates.length) return { changes: [], status: 'no_candidates' };
    const { system, user } = buildModelAdjudicationPrompts({ state, settings, candidates: modelCandidates, recentText });
    const response = await sendLoreRequest(system, user, {
        providerKind: 'continuity',
        expectedOutput: 'json',
        maxTokens: Math.max(512, Math.min(4096, Number(settings.autoRelevanceModelMaxTokens) || 2048)),
    });
    const parsed = parseJsonObject(response);
    if (!parsed) {
        return buildAutoRelevanceModelParseFailure();
    }
    const rawChanges = Array.isArray(parsed?.changes) ? parsed.changes : [];
    const candidateById = new Map(modelCandidates.map(item => [item.entry.id, item]));
    const changes = [];
    for (const raw of rawChanges) {
        const id = String(raw?.id || raw?.candidateId || '').replace(/^deck:[^:]+:/, '').trim();
        const item = candidateById.get(id);
        if (!item) continue;
        const next = normalizeLoreRelevance(raw.relevance || raw.suggestedRelevance, item.next);
        if (next === item.current) continue;
        changes.push({
            item,
            next,
            confidence: Math.max(0, Math.min(1, Number(raw.confidence) || item.confidence || 0.7)),
            reason: String(raw.reason || `Model adjusted relevance to ${next}.`).slice(0, 240),
            source: 'model',
        });
    }
    return { changes, status: 'model', rawCount: rawChanges.length };
}

function getRecentChatText(limit = 20) {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
        const recent = chat.slice(-Math.max(1, Math.min(200, Number(limit) || 20)));
        return recent.map(msg => {
            if (!msg) return '';
            const speaker = msg.name || (msg.is_user ? 'User' : 'Assistant');
            const body = typeof msg.mes === 'string' ? msg.mes : typeof msg.content === 'string' ? msg.content : '';
            return body ? `${speaker}: ${body}` : '';
        }).filter(Boolean).join('\n').slice(-12000);
    } catch (_) {
        return '';
    }
}

function isManualLocked(entry) {
    return entry?.extensions?.autoRelevance?.mode === 'manual' || entry?.extensions?.autoRelevance?.locked === true;
}

function buildScoredCandidates(entries, state, settings, suppressed, pinned) {
    const recentText = getRecentChatText(settings.autoRelevanceRecentMessages || 20);
    const scoringOptions = { ...settings, recentText };
    return entries
        .filter(entry => entry.injectableByDefault !== false)
        .filter(entry => isLoreAutomationEnabledForEntry(entry))
        .filter(entry => settings.autoRelevanceEvaluateMuted === true || !suppressed.has(entry.id))
        .map(entry => {
            const local = computeLocalLoreRelevance(entry, { ...state, autoRelevanceContext: { recentText } }, scoringOptions);
            const current = normalizeLoreRelevance(entry.relevance || 'normal');
            const next = normalizeLoreRelevance(local.relevance || 'normal');
            const delta = relevanceWeight(next) - relevanceWeight(current);
            let confidence;
            if (delta < 0) {
                // Demotion confidence must not be so conservative that high/normal
                // entries only ever move upward. Use distance below the current
                // tier threshold rather than raw score/70.
                const threshold = current === 'high' ? 78 : current === 'normal' ? 30 : 0;
                const denominator = current === 'high' ? 78 : current === 'normal' ? 30 : 1;
                const distance = Math.max(0, threshold - local.score);
                confidence = Math.max(0, Math.min(0.98, 0.62 + Math.min(0.36, (distance / denominator) * 0.36)));
                if (!local.recentHit) confidence = Math.min(0.98, confidence + 0.08);
            } else {
                confidence = Math.max(0, Math.min(1, Math.abs(local.score) / 100));
            }
            return { entry, current, next, local, confidence, delta, pinned: pinned.has(entry.id) };
        });
}

function dedupeCandidates(items, cap) {
    const out = [];
    const seen = new Set();
    for (const item of items) {
        if (!item?.entry?.id || seen.has(item.entry.id)) continue;
        seen.add(item.entry.id);
        out.push(item);
        if (out.length >= cap) break;
    }
    return out;
}

function selectCandidates(scored, settings, candidateCap) {
    const promotionLane = [...scored]
        .filter(item => item.delta > 0 || item.local.score >= 78)
        .sort((a, b) => b.local.score - a.local.score || Number(b.entry.priority || 50) - Number(a.entry.priority || 50));

    const demotionLane = [...scored]
        .filter(item => item.delta < 0 || (['high', 'normal'].includes(item.current) && item.local.score < 26))
        .sort((a, b) => a.local.score - b.local.score || relevanceWeight(b.current) - relevanceWeight(a.current));

    const half = Math.max(1, Math.floor(candidateCap / 2));
    return dedupeCandidates([
        ...promotionLane.slice(0, half),
        ...demotionLane.slice(0, candidateCap - Math.min(half, promotionLane.length)),
        ...promotionLane.slice(half),
        ...demotionLane.slice(candidateCap - Math.min(half, promotionLane.length)),
    ], candidateCap);
}

function shouldApplyCandidate(item, settings, threshold, pinned) {
    if (!item || item.current === item.next) return false;
    if (item.confidence < threshold) return false;
    if (!isLoreAutomationEnabledForEntry(item.entry)) return false;
    if (isManualLocked(item.entry) && settings.autoRelevanceOverrideManual !== true) return false;
    const protectPinned = settings.autoRelevanceProtectPinned !== false;
    if (protectPinned && pinned.has(item.entry.id) && relevanceWeight(item.next) < relevanceWeight(item.current)) return false;
    return true;
}

function getRemappingCandidateTitle(item = {}) {
    return String(item.entry?.title || item.entry?.id || '').slice(0, 160);
}

function buildRemappingOperation(item, operation, profile, reason, override = {}) {
    return {
        id: item.entry.id,
        targetId: item.entry.id,
        title: getRemappingCandidateTitle(item),
        operation,
        confidence: Math.max(0, Math.min(1, Number(override.confidence ?? item.confidence ?? 0.75) || 0)),
        score: Number(item.local?.score) || 0,
        source: override.source || 'local',
        provider: override.provider || override.source || 'local',
        reason: String(reason || '').slice(0, 240),
        suggestedAt: Date.now(),
        style: profile.style,
    };
}

function buildLocalRemappingCandidates(scored, state, settings, suppressed, pinned) {
    const profile = getLoreAutomationStyleProfile(settings);
    const operations = [];
    const sorted = [...scored]
        .filter(item => item?.entry?.id && isLoreAutomationEnabledForEntry(item.entry))
        .sort((a, b) => (Number(b.local?.score) || 0) - (Number(a.local?.score) || 0));

    for (const item of sorted) {
        if (operations.length >= profile.remapCap) break;
        const id = item.entry.id;
        const score = Number(item.local?.score) || 0;
        const recentHit = !!item.local?.recentHit;
        const isPinned = pinned.has(id);
        const isMuted = suppressed.has(id);
        const current = normalizeLoreRelevance(item.current || item.entry.relevance || 'normal');
        const next = normalizeLoreRelevance(item.next || current);

        if (!isMuted && !isPinned && score >= profile.pinScore && next === 'high') {
            operations.push(buildRemappingOperation(
                item,
                'pin',
                profile,
                `High current-context score ${score}; pin so it shapes the next reply.`,
                { confidence: Math.max(item.confidence || 0, 0.84) },
            ));
            continue;
        }
        if (isPinned && score <= profile.unpinScore && !recentHit) {
            operations.push(buildRemappingOperation(
                item,
                'unpin',
                profile,
                `Pinned card no longer has current-context support; local score ${score}.`,
                { confidence: Math.max(item.confidence || 0, 0.78) },
            ));
            continue;
        }
        if (isMuted && score >= profile.unmuteScore && next === 'high') {
            operations.push(buildRemappingOperation(
                item,
                'unmute',
                profile,
                `Muted card is now strongly relevant; local score ${score}.`,
                { confidence: Math.max(item.confidence || 0, 0.84) },
            ));
            continue;
        }
        if (!isMuted && !isPinned && profile.muteScore >= 0 && score <= profile.muteScore && current === 'low' && !recentHit) {
            operations.push(buildRemappingOperation(
                item,
                'mute',
                profile,
                `Low-relevance card has no current-context support; local score ${score}.`,
                { confidence: Math.max(item.confidence || 0, 0.76) },
            ));
        }
    }

    return operations;
}

function summarizeRemappingCandidateForModel(operation = {}, entry = {}) {
    const scope = entry.scope || {};
    const content = entry.content || {};
    return {
        id: operation.targetId || operation.id,
        title: entry.title || operation.title || entry.id,
        proposedOperation: operation.operation,
        currentRelevance: normalizeLoreRelevance(entry.relevance || 'normal'),
        localScore: Number(operation.score) || 0,
        localReason: operation.reason || '',
        pinned: !!operation.pinned,
        muted: !!operation.muted,
        category: entry.category || 'other',
        priority: Number(entry.priority || 50),
        lorePurpose: entry.lorePurpose || '',
        scope: {
            characters: (scope.characters || []).slice?.(0, 8) || [],
            locations: (scope.locations || []).slice?.(0, 6) || [],
            topics: (scope.topics || []).slice?.(0, 8) || [],
            tags: (entry.tags || []).slice?.(0, 10) || [],
        },
        fact: String(content.fact || entry.fact || content.injection || '').slice(0, 500),
    };
}

function buildRemappingModelPrompts({ state, settings, operations, entriesById, recentText }) {
    const system = `You are Saga's ARMP Lore Automation adjudicator.

Task:
- Decide which proposed pin, unpin, mute, or unmute operations are justified for the next roleplay turn.
- Pin only cards that must strongly shape the next reply.
- Mute only cards that should stop influencing prompt output now.
- Unmute only cards that are clearly current again.
- Unpin cards that are no longer critical.
- Never invent ids or operations.
- Output only JSON: {"operations":[{"id":"...","operation":"pin|unpin|mute|unmute","confidence":0.0-1.0,"reason":"short"}]}`;
    const payload = {
        storyContext: {
            sceneDate: state?.loreContext?.sceneDate || state?.canon?.inUniverseDate || '',
            canonBoundary: state?.loreContext?.canonBoundary || state?.canon?.canonBoundary || '',
            branchId: state?.loreContext?.branchId || 'main',
        },
        scene: {
            location: state?.scene?.location || '',
            currentActivity: state?.scene?.currentActivity || '',
            presentCharacters: state?.scene?.presentCharacters || [],
            nearbyCharacters: state?.scene?.nearbyCharacters || [],
        },
        recentMessages: String(recentText || '').slice(-Math.max(1000, Math.min(12000, Number(settings.autoRelevanceModelRecentChars) || 5000))),
        candidates: operations.map(operation => summarizeRemappingCandidateForModel(operation, entriesById.get(operation.targetId || operation.id) || {})),
    };
    return { system, user: JSON.stringify(payload, null, 2) };
}

async function adjudicateRemappingWithModel(operations, state, settings, recentText) {
    const providerKind = selectLoreAutomationProviderKind(settings, 'armp');
    if (!providerKind) return { operations: [], status: 'local_only' };
    if (!operations.length) return { operations: [], status: 'no_candidates' };
    const validation = validateLoreProviderConfiguration(providerKind);
    if (!validation.ok) return { operations: [], status: 'unavailable', error: validation.message };
    const entriesById = new Map(normalizeLoreMatrix(state.loreMatrix || []).map(entry => [entry.id, entry]));
    const { system, user } = buildRemappingModelPrompts({ state, settings, operations, entriesById, recentText });
    const response = await sendLoreRequest(system, user, {
        providerKind,
        expectedOutput: 'json',
        maxTokens: Math.max(512, Math.min(4096, Number(settings.autoRelevanceModelMaxTokens) || 2048)),
    });
    const parsed = parseJsonObject(response);
    if (!parsed) return { operations: [], status: 'failed_parse', error: 'ARMP model returned malformed JSON.' };
    const allowed = new Set(['pin', 'unpin', 'mute', 'unmute']);
    const candidateById = new Map(operations.map(operation => [operation.targetId || operation.id, operation]));
    const adjudicated = [];
    for (const raw of Array.isArray(parsed.operations) ? parsed.operations : []) {
        const id = String(raw?.id || raw?.targetId || '').trim();
        const operation = String(raw?.operation || '').trim().toLowerCase();
        const base = candidateById.get(id);
        if (!base || !allowed.has(operation)) continue;
        adjudicated.push({
            ...base,
            operation,
            confidence: Math.max(0, Math.min(1, Number(raw.confidence) || base.confidence || 0)),
            reason: String(raw.reason || base.reason || '').slice(0, 240),
            source: providerKind === 'lore' ? 'reasoning' : 'utility',
            provider: providerKind === 'lore' ? 'reasoning' : 'utility',
        });
    }
    return { operations: adjudicated, status: providerKind === 'lore' ? 'reasoning' : 'utility', rawCount: Array.isArray(parsed.operations) ? parsed.operations.length : 0 };
}

function validateRemappingOperations(operations, state, settings, mode) {
    if (!supportsLoreAutomationMode(mode, 'armp')) return [];
    const profile = getLoreAutomationStyleProfile(settings);
    const entriesById = new Map(normalizeLoreMatrix(state.loreMatrix || []).map(entry => [entry.id, entry]));
    const suppressed = new Set(state?.loreSelection?.suppressedIds || []);
    const pinned = new Set(state?.loreSelection?.pinnedIds || []);
    const threshold = Math.max(profile.relevanceThreshold, Math.min(0.98, Number(settings.autoRelevanceMinConfidence) || profile.relevanceThreshold));
    const validated = [];
    const seen = new Set();

    for (const operation of operations || []) {
        const id = String(operation.targetId || operation.id || '').trim();
        const kind = String(operation.operation || '').trim().toLowerCase();
        if (!id || seen.has(`${kind}:${id}`)) continue;
        if (!['pin', 'unpin', 'mute', 'unmute'].includes(kind)) continue;
        const entry = entriesById.get(id);
        if (!entry || !isLoreAutomationEnabledForEntry(entry)) continue;
        if ((Number(operation.confidence) || 0) < threshold) continue;
        if (kind === 'pin' && suppressed.has(id)) continue;
        if (kind === 'mute' && pinned.has(id)) continue;
        if (kind === 'unpin' && !pinned.has(id)) continue;
        if (kind === 'unmute' && !suppressed.has(id)) continue;
        if (kind === 'pin' && pinned.has(id)) continue;
        if (kind === 'mute' && suppressed.has(id)) continue;
        seen.add(`${kind}:${id}`);
        validated.push({ ...operation, targetId: id, id });
    }
    return validated.slice(0, profile.remapCap);
}

function applyRemappingOperations(state, operations, runId = '') {
    const valid = Array.isArray(operations) ? operations : [];
    if (!valid.length) return { changed: 0, pinned: 0, unpinned: 0, muted: 0, unmuted: 0, operations: [] };
    if (!state.loreSelection) state.loreSelection = { pinnedIds: [], suppressedIds: [] };
    const acceptedIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    const pinSet = new Set((state.loreSelection.pinnedIds || []).filter(id => acceptedIds.has(id)));
    const suppressedSet = new Set((state.loreSelection.suppressedIds || []).filter(id => acceptedIds.has(id)));
    const touched = new Map();
    const counts = { changed: 0, pinned: 0, unpinned: 0, muted: 0, unmuted: 0, operations: [] };

    for (const operation of valid) {
        const id = operation.targetId || operation.id;
        if (!acceptedIds.has(id)) continue;
        if (operation.operation === 'pin') {
            pinSet.add(id);
            suppressedSet.delete(id);
            counts.pinned += 1;
        } else if (operation.operation === 'unpin') {
            pinSet.delete(id);
            counts.unpinned += 1;
        } else if (operation.operation === 'mute') {
            suppressedSet.add(id);
            pinSet.delete(id);
            counts.muted += 1;
        } else if (operation.operation === 'unmute') {
            suppressedSet.delete(id);
            counts.unmuted += 1;
        } else {
            continue;
        }
        counts.changed += 1;
        touched.set(id, operation);
        counts.operations.push(operation);
    }

    state.loreSelection.pinnedIds = Array.from(pinSet);
    state.loreSelection.suppressedIds = Array.from(suppressedSet);
    if (touched.size) {
        state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
            const operation = touched.get(entry.id);
            if (!operation) return entry;
            return markLoreAutomationAction(entry, {
                operation: operation.operation,
                reason: operation.reason,
                provider: operation.provider || operation.source || 'local',
                runId,
                at: Date.now(),
            });
        });
    }
    return counts;
}

function summarizeCurationCandidateForModel(entry = {}) {
    const preview = entry.extensions?.canonPreview || {};
    const deck = entry.extensions?.sagaLoredeck || {};
    const scope = entry.scope || {};
    return {
        id: entry.id,
        title: entry.title || entry.id,
        deck: deck.packTitle || deck.packId || '',
        score: Number(preview.score) || 0,
        matchedBy: preview.matchedBy || '',
        contextGateStatus: preview.contextGateStatus || '',
        contextGateReason: preview.contextGateReason || '',
        relevance: normalizeLoreRelevance(entry.relevance || 'normal'),
        category: entry.category || 'other',
        priority: Number(entry.priority || 50),
        lorePurpose: entry.lorePurpose || '',
        truthStatus: entry.truthStatus || '',
        revealPolicy: entry.revealPolicy || '',
        coverageLaneIds: entry.extensions?.loreAutomationEvidence?.coverageLaneIds || [],
        laneIds: entry.extensions?.loreAutomationEvidence?.laneIds || [],
        stackPressure: entry.extensions?.loreAutomationEvidence?.stackPressure || 'none',
        scope: {
            characters: (scope.characters || []).slice?.(0, 8) || [],
            locations: (scope.locations || []).slice?.(0, 6) || [],
            topics: (scope.topics || []).slice?.(0, 8) || [],
            tags: (entry.tags || []).slice?.(0, 10) || [],
        },
        fact: String(entry.content?.fact || entry.fact || entry.content?.injection || '').slice(0, 700),
    };
}

function buildCurationModelPrompts({ state, candidates, recentText }) {
    const retirementCandidates = Array.isArray(state?.__loreAutomationRetirementCandidates)
        ? state.__loreAutomationRetirementCandidates
        : [];
    const system = `You are Saga's ARMPC Lorecard curator.

Task:
- Choose which active-deck Lorecards should enter this chat's Accepted Lorecards now.
- Choose automation-owned Accepted Lorecards that are safe to retire from this chat's Accepted stack.
- Use only the provided candidate ids.
- Prefer subtle but concrete cards that constrain the next few roleplay turns: present characters, location rules, current secrets, items, abilities, date gates, or active guardrails.
- Do not select broad glossary/reference cards unless they directly constrain the active scene.
- Retire only automation-owned cards that no longer matter to the active scene.
- Classify coverage explicitly: add_now, keep, retire, hold, or ignore.
- Prefer hold over weak additions and keep over uncertain retirement.
- Output only JSON: {"operations":[{"id":"...","operation":"accept_from_active_decks|retire_from_accepted_stack","classification":"add_now|keep|retire|hold|ignore","confidence":0.0-1.0,"reason":"short"}],"accept":[{"id":"...","confidence":0.0-1.0,"reason":"short"}],"retire":[{"id":"...","confidence":0.0-1.0,"reason":"short"}]}`;
    const payload = {
        storyContext: {
            sceneDate: state?.loreContext?.sceneDate || state?.canon?.inUniverseDate || '',
            canonBoundary: state?.loreContext?.canonBoundary || state?.canon?.canonBoundary || '',
            branchId: state?.loreContext?.branchId || 'main',
        },
        scene: {
            location: state?.scene?.location || '',
            currentActivity: state?.scene?.currentActivity || '',
            presentCharacters: state?.scene?.presentCharacters || [],
            nearbyCharacters: state?.scene?.nearbyCharacters || [],
        },
        recentMessages: String(recentText || '').slice(-9000),
        coverageLanes: getContextCoverageLaneIds(state),
        candidates: candidates.map(summarizeCurationCandidateForModel),
        acceptedRetirementCandidates: retirementCandidates.map(item => ({
            id: item.entry.id,
            title: item.entry.title || item.entry.id,
            localScore: item.local.score,
            temporalRole: item.local.temporalRole,
            stalePasses: item.stalePasses || 0,
            coverageLaneIds: item.coverageLaneIds || [],
            reason: item.reason,
            fact: String(item.entry.content?.fact || item.entry.fact || '').slice(0, 500),
        })),
    };
    return { system, user: JSON.stringify(payload, null, 2) };
}

async function adjudicateCurationWithModel(candidates, retireCandidates, state, settings, recentText) {
    const providerKind = selectLoreAutomationProviderKind(settings, 'armpc');
    if (!providerKind) return { selections: [], retireSelections: [], status: 'local_only' };
    if (!candidates.length && !retireCandidates.length) return { selections: [], retireSelections: [], status: 'no_candidates' };
    const validation = validateLoreProviderConfiguration(providerKind);
    if (!validation.ok) return { selections: [], retireSelections: [], status: 'unavailable', error: validation.message };
    const promptState = { ...state, __loreAutomationRetirementCandidates: retireCandidates };
    const { system, user } = buildCurationModelPrompts({ state: promptState, candidates, recentText });
    const response = await sendLoreRequest(system, user, {
        providerKind,
        expectedOutput: 'json',
        maxTokens: Math.max(768, Math.min(4096, Number(settings.autoRelevanceModelMaxTokens) || 2048)),
    });
    const parsed = parseJsonObject(response);
    if (!parsed) return { selections: [], retireSelections: [], status: 'failed_parse', error: 'ARMPC model returned malformed JSON.' };
    const candidateById = new Map(candidates.map(entry => [entry.id, entry]));
    const retireById = new Map(retireCandidates.map(item => [item.entry.id, item]));
    const selections = [];
    const acceptRaw = []
        .concat(Array.isArray(parsed.operations) ? parsed.operations.filter(item => item?.operation === 'accept_from_active_decks' || item?.classification === 'add_now') : [])
        .concat(Array.isArray(parsed.accept) ? parsed.accept : []);
    for (const raw of acceptRaw) {
        const id = String(raw?.id || raw?.candidateId || '').replace(/^accepted:/, '').trim();
        const entry = candidateById.get(id);
        if (!entry) continue;
        if (raw.classification && String(raw.classification || '').trim() !== 'add_now') continue;
        selections.push({
            id,
            entry,
            confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
            reason: String(raw.reason || 'Model selected this active-deck Lorecard for curation.').slice(0, 240),
            provider: providerKind === 'lore' ? 'reasoning' : 'utility',
        });
    }
    const retireSelections = [];
    const retireRaw = []
        .concat(Array.isArray(parsed.operations) ? parsed.operations.filter(item => item?.operation === 'retire_from_accepted_stack' || item?.classification === 'retire') : [])
        .concat(Array.isArray(parsed.retire) ? parsed.retire : []);
    for (const raw of retireRaw) {
        const id = String(raw?.id || '').trim();
        const item = retireById.get(id);
        if (!item) continue;
        if (raw.classification && String(raw.classification || '').trim() !== 'retire') continue;
        retireSelections.push({
            id,
            entry: item.entry,
            confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
            reason: String(raw.reason || item.reason || 'Model selected this automation-owned Lorecard for retirement.').slice(0, 240),
            provider: providerKind === 'lore' ? 'reasoning' : 'utility',
        });
    }
    return { selections, retireSelections, status: providerKind === 'lore' ? 'reasoning' : 'utility' };
}

function selectLocalCurationCandidates(candidates = [], profile = getLoreAutomationStyleProfile()) {
    const minimumScore = profile.style === 'aggressive' ? 18 : profile.style === 'balanced' ? 28 : 45;
    return candidates
        .filter(entry => (Number(entry.extensions?.canonPreview?.score) || 0) >= minimumScore)
        .sort((a, b) => (Number(b.extensions?.canonPreview?.score) || 0) - (Number(a.extensions?.canonPreview?.score) || 0)
            || Number(b.priority || 50) - Number(a.priority || 50))
        .slice(0, profile.curationCap)
        .map(entry => ({
            id: entry.id,
            entry,
            confidence: profile.style === 'aggressive' ? 0.72 : profile.style === 'balanced' ? 0.82 : 0.9,
            reason: `Active-deck Context score ${Number(entry.extensions?.canonPreview?.score) || 0}.`,
            provider: 'local',
        }));
}

function decorateCurationCandidate(entry = {}, state = {}, laneIds = []) {
    const coverageLaneIds = getEntryCoverageLaneIds(entry, state);
    return normalizeLoreEntry({
        ...entry,
        extensions: {
            ...(entry.extensions || {}),
            loreAutomationEvidence: {
                laneIds: Array.from(new Set(laneIds.filter(Boolean))).slice(0, 12),
                coverageLaneIds: coverageLaneIds.slice(0, 12),
                stackPressure: coverageLaneIds.length ? 'add' : 'none',
            },
        },
    });
}

function inferCurationLaneIds(entry = {}, state = {}) {
    const lanes = new Set();
    const preview = entry.extensions?.canonPreview || {};
    if (preview.matchedBy) lanes.add(`context:${preview.matchedBy}`);
    const score = Number(preview.score) || 0;
    if (score >= 70) lanes.add('score:high');
    else if (score >= 30) lanes.add('score:medium');
    if (Number(entry.priority || 50) >= 90) lanes.add('priority:high');
    const coverage = getEntryCoverageLaneIds(entry, state);
    for (const lane of coverage) lanes.add(lane);
    if (!lanes.size) lanes.add('exploration');
    return Array.from(lanes);
}

function packCurationCandidates(entries = [], state = {}, max = LORE_AUTOMATION_CURATION_PACKET_CAP) {
    const source = normalizeLoreMatrix(entries || [])
        .filter(entry => entry?.id)
        .map(entry => decorateCurationCandidate(entry, state, inferCurationLaneIds(entry, state)));
    const byId = new Map();
    for (const entry of source) {
        if (!byId.has(entry.id)) byId.set(entry.id, entry);
    }
    const unique = Array.from(byId.values());
    const laneBuckets = new Map();
    for (const entry of unique) {
        const lanes = entry.extensions?.loreAutomationEvidence?.laneIds || ['exploration'];
        for (const lane of lanes) {
            if (!laneBuckets.has(lane)) laneBuckets.set(lane, []);
            laneBuckets.get(lane).push(entry);
        }
    }
    for (const bucket of laneBuckets.values()) {
        bucket.sort((a, b) => (Number(b.extensions?.canonPreview?.score) || 0) - (Number(a.extensions?.canonPreview?.score) || 0)
            || Number(b.priority || 50) - Number(a.priority || 50)
            || String(a.title || '').localeCompare(String(b.title || '')));
    }
    const laneNames = Array.from(laneBuckets.keys()).sort((a, b) => {
        const aScore = Math.max(...laneBuckets.get(a).map(entry => Number(entry.extensions?.canonPreview?.score) || 0));
        const bScore = Math.max(...laneBuckets.get(b).map(entry => Number(entry.extensions?.canonPreview?.score) || 0));
        return bScore - aScore || a.localeCompare(b);
    });
    const selected = [];
    const selectedIds = new Set();
    let madeProgress = true;
    while (selected.length < max && madeProgress) {
        madeProgress = false;
        for (const lane of laneNames) {
            const bucket = laneBuckets.get(lane) || [];
            while (bucket.length) {
                const entry = bucket.shift();
                if (selectedIds.has(entry.id)) continue;
                selected.push(entry);
                selectedIds.add(entry.id);
                madeProgress = true;
                break;
            }
            if (selected.length >= max) break;
        }
    }
    return selected;
}

function getRetirementScanItems(state, settings, recentText, profile = getLoreAutomationStyleProfile(settings), options = {}) {
    const pinned = new Set(state?.loreSelection?.pinnedIds || []);
    const suppressed = new Set(state?.loreSelection?.suppressedIds || []);
    const scoringOptions = { ...settings, recentText };
    const maxScore = profile.style === 'aggressive' ? 12 : profile.style === 'balanced' ? 6 : 3;
    const cadence = normalizeLoreAutomationCadence(state);
    return normalizeLoreMatrix(state.loreMatrix || [])
        .filter(entry => entry?.id && !pinned.has(entry.id) && !suppressed.has(entry.id))
        .filter(entry => isLoreAutomationEnabledForEntry(entry))
        .filter(entry => isAutomationOwnedEntry(entry))
        .map(entry => {
            const local = computeLocalLoreRelevance(entry, { ...state, autoRelevanceContext: { recentText } }, scoringOptions);
            const coverageLaneIds = getEntryCoverageLaneIds(entry, state);
            const stale = normalizeLoreRelevance(local.relevance || 'normal') === 'low'
                && (Number(local.score) || 0) <= maxScore
                && !local.recentHit
                && coverageLaneIds.length === 0;
            const previousPasses = Math.max(0, Number(cadence.staleEvidenceByCardId?.[entry.id]) || 0);
            return {
                entry,
                local,
                stale,
                stalePasses: stale ? previousPasses + 1 : 0,
                coverageLaneIds,
                reason: `Automation-owned card is stale for current Context; local score ${local.score}; stale passes ${stale ? previousPasses + 1 : 0}.`,
            };
        })
        .map(item => {
            if (options.updateEvidence === true) {
                if (item.stale) cadence.staleEvidenceByCardId[item.entry.id] = item.stalePasses;
                else delete cadence.staleEvidenceByCardId[item.entry.id];
            }
            return item;
        });
}

function buildRetirementCandidates(state, settings, recentText, profile = getLoreAutomationStyleProfile(settings)) {
    const requiredPasses = Math.max(1, Number(profile.stalePasses) || 1);
    return getRetirementScanItems(state, settings, recentText, profile, { updateEvidence: true })
        .filter(item => item.stale && item.stalePasses >= requiredPasses)
        .sort((a, b) => (Number(a.local.score) || 0) - (Number(b.local.score) || 0))
        .slice(0, Math.max(1, Number(profile.retirementCap) || 1));
}

function selectLocalRetirementCandidates(retireCandidates = [], profile = getLoreAutomationStyleProfile()) {
    return retireCandidates.slice(0, Math.max(1, Number(profile.retirementCap) || 1)).map(item => ({
        id: item.entry.id,
        entry: item.entry,
        confidence: profile.style === 'aggressive' ? 0.72 : profile.style === 'balanced' ? 0.82 : 0.9,
        reason: item.reason,
        provider: 'local',
    }));
}

function getCurationNoChangeStatus(result = {}, fallback = 'unchanged') {
    const status = String(result.status || '').trim();
    return LORE_AUTOMATION_BLOCKED_CURATION_STATUSES.has(status) ? status : fallback;
}

function markCuratedAcceptedEntry(entry = {}, selection = {}, runId = '') {
    const now = Date.now();
    const enabled = setLoreAutomationEnabled(normalizeLoreEntry({
        ...entry,
        relevance: normalizeLoreRelevance(entry.relevance || 'normal') === 'low' ? 'normal' : normalizeLoreRelevance(entry.relevance || 'normal'),
        userEdited: false,
        source: entry.source || 'lore-automation',
        extensions: {
            ...(entry.extensions || {}),
            loreAutomationCuration: {
                source: 'active_deck',
                acceptedAt: now,
                reason: selection.reason || '',
                provider: selection.provider || 'local',
            },
        },
    }), true, { at: now, by: 'automation', owner: 'auto' });
    return markLoreAutomationAction(enabled, {
        operation: 'accept_from_active_decks',
        reason: selection.reason || 'ARMPC accepted this active-deck Lorecard.',
        provider: selection.provider || 'local',
        runId,
        at: now,
        owner: 'auto',
    });
}

async function runArmPcCuration({ state, settings, recentText, runId, beforeTimeline, recordTimeline = true }) {
    const mode = normalizeLoreAutomationMode(settings.loreAutomationMode || 'off');
    if (!supportsLoreAutomationMode(mode, 'armpc')) {
        return { status: 'skipped', curated: 0, pendingCurated: 0, providerStatus: '' };
    }
    if (!hasUsableLoreAutomationContext(state)) {
        return { status: 'needs_context', curated: 0, pendingCurated: 0, retired: 0, providerStatus: 'skipped' };
    }
    const profile = getLoreAutomationStyleProfile(settings);
    const retireCandidates = buildRetirementCandidates(state, settings, recentText, profile);
    const preview = await previewCanonLoreForContext(state?.loreContext || null, {
        maxCandidates: 240,
        includeAudit: false,
    });
    if (preview.status !== 'preview' && !retireCandidates.length) {
        return { status: preview.status || 'empty', curated: 0, pendingCurated: 0, providerStatus: '' };
    }
    const candidates = packCurationCandidates(
        (preview.status === 'preview' ? (preview.entries || []) : [])
            .filter(entry => entry?.id && entry.extensions?.canonPreview?.duplicateStatus === 'new'),
        state,
        LORE_AUTOMATION_CURATION_PACKET_CAP,
    );
    if (!candidates.length && !retireCandidates.length) {
        return { status: 'duplicates_only', curated: 0, pendingCurated: 0, providerStatus: '' };
    }

    let adjudicated;
    try {
        adjudicated = await adjudicateCurationWithModel(candidates, retireCandidates, state, settings, recentText);
    } catch (e) {
        console.warn('[Saga Lore Automation] ARMPC curation adjudication failed.', e);
        adjudicated = { selections: [], retireSelections: [], status: 'model_failed', error: e?.message || String(e || '') };
    }

    let selections = adjudicated.selections || [];
    let retireSelections = adjudicated.retireSelections || [];
    if (!selections.length && (adjudicated.status === 'local_only' || normalizeLoreAutomationProviderRouting(settings.loreAutomationProviderRouting || 'auto') === 'local')) {
        selections = selectLocalCurationCandidates(candidates, profile);
    }
    if (!retireSelections.length && (adjudicated.status === 'local_only' || normalizeLoreAutomationProviderRouting(settings.loreAutomationProviderRouting || 'auto') === 'local')) {
        retireSelections = selectLocalRetirementCandidates(retireCandidates, profile);
    }
    const curationBlocked = LORE_AUTOMATION_BLOCKED_CURATION_STATUSES.has(adjudicated.status)
        && normalizeLoreAutomationProviderRouting(settings.loreAutomationProviderRouting || 'auto') !== 'local';
    const threshold = profile.style === 'aggressive' ? 0.68 : profile.style === 'balanced' ? 0.78 : 0.88;
    retireSelections = retireSelections
        .filter(selection => selection?.entry?.id && (Number(selection.confidence) || 0) >= threshold)
        .slice(0, Math.max(1, Number(profile.retirementCap) || 1));
    const currentAutoOwnedCount = getAutomationOwnedAcceptedEntries(state).length;
    const availableSlots = Math.max(0, (Number(profile.targetMax) || currentAutoOwnedCount) - currentAutoOwnedCount + retireSelections.length);
    selections = selections
        .filter(selection => selection?.entry?.id && (Number(selection.confidence) || 0) >= threshold)
        .slice(0, Math.min(profile.curationCap, availableSlots));

    const existingIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    const acceptedEntries = [];
    for (const selection of selections) {
        if (existingIds.has(selection.id)) continue;
        existingIds.add(selection.id);
        acceptedEntries.push(markCuratedAcceptedEntry(selection.entry, selection, runId));
    }
    const beforeEntries = normalizeLoreMatrix(state.loreMatrix || []);
    const retireIds = new Set(retireSelections.map(selection => selection.id));
    const retiredEntries = beforeEntries.filter(entry => retireIds.has(entry.id));
    const beforeCount = beforeEntries.length;
    if (acceptedEntries.length || retireIds.size) {
        state.loreMatrix = normalizeLoreMatrix([
            ...beforeEntries.filter(entry => !retireIds.has(entry.id)),
            ...acceptedEntries,
        ]);
        if (state.loreSelection) {
            state.loreSelection.pinnedIds = (state.loreSelection.pinnedIds || []).filter(id => !retireIds.has(id));
            state.loreSelection.suppressedIds = (state.loreSelection.suppressedIds || []).filter(id => !retireIds.has(id));
        }
    }
    const retired = Math.max(0, beforeCount + acceptedEntries.length - state.loreMatrix.length);
    if (!acceptedEntries.length && !retired) {
        return {
            status: curationBlocked ? adjudicated.status : 'duplicates_only',
            curated: 0,
            pendingCurated: 0,
            retired: 0,
            providerStatus: adjudicated.status,
            modelError: adjudicated.error || '',
        };
    }
    if (recordTimeline !== false) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'lore_automation_curate',
            source: 'lore_automation',
            summary: `ARMPC curated ${acceptedEntries.length} active-deck Lorecard${acceptedEntries.length === 1 ? '' : 's'} and retired ${retired}.`,
        });
    }
    return {
        status: acceptedEntries.length ? 'curated' : 'retired',
        curated: acceptedEntries.length,
        pendingCurated: 0,
        retired,
        providerStatus: adjudicated.status,
        modelError: adjudicated.error || '',
        operations: selections.map(selection => ({
            id: selection.id,
            operation: 'accept_from_active_decks',
            title: selection.entry.title || selection.id,
            confidence: selection.confidence,
            reason: selection.reason,
            provider: selection.provider,
        })).concat(retiredEntries.map(entry => {
            const selection = retireSelections.find(item => item.id === entry.id) || {};
            return {
                id: entry.id,
                operation: 'retire_from_accepted_stack',
                title: entry.title || entry.id,
                confidence: selection.confidence,
                reason: selection.reason,
                provider: selection.provider,
            };
        })),
    };
}

export function applyAutoRelevanceSuggestions(ids = null) {
    const state = getState();
    const suggestions = Array.isArray(state.autoRelevanceSuggestions) ? state.autoRelevanceSuggestions : [];
    const idSet = ids ? new Set(Array.isArray(ids) ? ids : [ids]) : null;
    const apply = suggestions.filter(s => !idSet || idSet.has(s.id));
    if (!apply.length) return { status: 'no_suggestions', applied: 0 };
    const byId = new Map(apply.map(s => [s.id, s]));
    const beforeTimeline = captureLoreTimelineState(state);
    let applied = 0;
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        const suggestion = byId.get(entry.id);
        if (!suggestion) return entry;
        applied += 1;
        return markLoreAutomationAction({
            ...entry,
            relevance: normalizeLoreRelevance(suggestion.suggestedRelevance),
            extensions: {
                ...(entry.extensions || {}),
                autoRelevance: {
                    mode: 'local',
                    confidence: suggestion.confidence,
                    score: suggestion.score,
                    reason: suggestion.reason,
                    updatedAt: Date.now(),
                },
            },
        }, {
            operation: relevanceWeight(suggestion.suggestedRelevance) > relevanceWeight(entry.relevance) ? 'promote_relevance' : 'demote_relevance',
            reason: suggestion.reason,
            provider: suggestion.source || 'local',
            at: Date.now(),
        });
    });
    state.autoRelevanceSuggestions = suggestions.filter(s => !byId.has(s.id));
    if (applied > 0) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'auto_relevance',
            source: 'auto_relevance',
            summary: `Applied ${applied} Auto-Relevance suggestion${applied === 1 ? '' : 's'}.`,
        });
    }
    saveState(state, { syncPrompt: true });
    return { status: 'applied', applied };
}

export function clearAutoRelevanceSuggestions() {
    const state = getState();
    state.autoRelevanceSuggestions = [];
    saveState(state, { syncPrompt: false });
    return { status: 'cleared' };
}

export function rejectAutoRelevanceSuggestions(ids = null) {
    const state = getState();
    const suggestions = Array.isArray(state.autoRelevanceSuggestions) ? state.autoRelevanceSuggestions : [];
    const idSet = ids ? new Set(Array.isArray(ids) ? ids : [ids]) : null;
    const before = suggestions.length;
    state.autoRelevanceSuggestions = idSet ? suggestions.filter(s => !idSet.has(s.id)) : [];
    saveState(state, { syncPrompt: false });
    return { status: 'rejected', rejected: before - state.autoRelevanceSuggestions.length };
}

export function applyLoreAutomationSuggestions(ids = null) {
    const state = getState();
    const settings = getSettings();
    const suggestions = Array.isArray(state.loreAutomationSuggestions) ? state.loreAutomationSuggestions : [];
    const idSet = ids ? new Set(Array.isArray(ids) ? ids : [ids]) : null;
    const apply = suggestions.filter(s => !idSet || idSet.has(s.id));
    if (!apply.length) return { status: 'no_suggestions', applied: 0 };
    const beforeTimeline = captureLoreTimelineState(state);
    const runId = buildLoreAutomationRunId(settings.loreAutomationMode || 'armp');
    const operations = apply.map(suggestion => ({
        ...suggestion,
        targetId: suggestion.targetId || suggestion.cardId || suggestion.id,
    }));
    const valid = validateRemappingOperations(operations, state, settings, settings.loreAutomationMode || 'armp');
    const result = applyRemappingOperations(state, valid, runId);
    const appliedKeys = new Set(valid.map(operation => operation.suggestionId || `${operation.operation}:${operation.targetId || operation.id}`));
    state.loreAutomationSuggestions = suggestions.filter(suggestion => {
        const key = suggestion.suggestionId || suggestion.id || `${suggestion.operation}:${suggestion.targetId || suggestion.cardId}`;
        return !appliedKeys.has(key) && !(idSet && idSet.has(suggestion.id));
    });
    if (result.changed > 0) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'lore_automation',
            source: 'lore_automation',
            summary: `Applied ${result.changed} Lore Automation remapping suggestion${result.changed === 1 ? '' : 's'}.`,
        });
        recordLoreAutomationRun(state, {
            id: runId,
            mode: settings.loreAutomationMode || 'armp',
            style: settings.loreAutomationStyle || 'careful',
            status: 'applied_suggestions',
            changed: result.changed,
            pinned: result.pinned,
            unpinned: result.unpinned,
            muted: result.muted,
            unmuted: result.unmuted,
            ranAt: Date.now(),
            operations: result.operations,
        }, settings);
    }
    saveState(state, { syncPrompt: result.changed > 0 });
    return { status: result.changed ? 'applied' : 'unchanged', applied: result.changed };
}

export function rejectLoreAutomationSuggestions(ids = null) {
    const state = getState();
    const suggestions = Array.isArray(state.loreAutomationSuggestions) ? state.loreAutomationSuggestions : [];
    const idSet = ids ? new Set(Array.isArray(ids) ? ids : [ids]) : null;
    const before = suggestions.length;
    state.loreAutomationSuggestions = idSet ? suggestions.filter(s => !idSet.has(s.id)) : [];
    saveState(state, { syncPrompt: false });
    return { status: 'rejected', rejected: before - state.loreAutomationSuggestions.length };
}

export function clearLoreAutomationSuggestions() {
    const state = getState();
    state.loreAutomationSuggestions = [];
    saveState(state, { syncPrompt: false });
    return { status: 'cleared' };
}

export function undoLastLoreAutomationRun() {
    const state = getState();
    const events = getLoreTimelineEvents(state);
    const event = [...events].reverse().find(item => {
        if (item?.reversible === false) return false;
        if (item?.type === 'lore_automation_undo') return false;
        return item?.source === 'lore_automation'
            || item?.type === 'lore_automation'
            || item?.type === 'lore_automation_curate'
            || item?.type === 'auto_relevance';
    });
    if (!event) return { status: 'no_automation_event', undone: 0 };
    const patch = event.patch || {};
    const beforeTimeline = captureLoreTimelineState(state);
    const addedIds = new Set((patch.addedEntries || []).map(entry => entry?.id).filter(Boolean));
    const beforeById = new Map((patch.beforeEntries || []).map(entry => [entry.id, entry]).filter(entry => entry[0]));
    const deletedById = new Map((patch.deletedEntries || []).map(entry => [entry.id, entry]).filter(entry => entry[0]));
    const restoredIds = new Set([...beforeById.keys(), ...deletedById.keys()]);
    const nextEntries = [];
    const seen = new Set();

    for (const entry of normalizeLoreMatrix(state.loreMatrix || [])) {
        if (addedIds.has(entry.id)) continue;
        const restored = beforeById.get(entry.id) || deletedById.get(entry.id);
        const next = restored || entry;
        if (!next?.id || seen.has(next.id)) continue;
        nextEntries.push(next);
        seen.add(next.id);
    }
    for (const entry of deletedById.values()) {
        if (!entry?.id || seen.has(entry.id)) continue;
        nextEntries.push(entry);
        seen.add(entry.id);
    }
    state.loreMatrix = normalizeLoreMatrix(nextEntries);

    if (!state.loreSelection) state.loreSelection = { pinnedIds: [], suppressedIds: [] };
    const acceptedIds = new Set(state.loreMatrix.map(entry => entry.id));
    const pinSet = new Set((state.loreSelection.pinnedIds || []).filter(id => acceptedIds.has(id)));
    const muteSet = new Set((state.loreSelection.suppressedIds || []).filter(id => acceptedIds.has(id)));
    for (const id of patch.pinChanges?.added || []) pinSet.delete(id);
    for (const id of patch.pinChanges?.removed || []) if (acceptedIds.has(id)) pinSet.add(id);
    for (const id of patch.muteChanges?.added || []) muteSet.delete(id);
    for (const id of patch.muteChanges?.removed || []) if (acceptedIds.has(id)) muteSet.add(id);
    state.loreSelection.pinnedIds = Array.from(pinSet);
    state.loreSelection.suppressedIds = Array.from(muteSet);
    state.loreAutomationSuggestions = [];
    state.autoRelevanceSuggestions = [];

    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: 'lore_automation_undo',
        source: 'lore_automation',
        summary: `Undid Lore Automation event: ${event.summary || event.id}.`,
        patch: { undoneEventId: event.id },
    });
    recordLoreAutomationRun(state, {
        id: buildLoreAutomationRunId(state.loreAutomationLastRun?.mode || 'ar'),
        mode: state.loreAutomationLastRun?.mode || 'ar',
        style: state.loreAutomationLastRun?.style || getSettings().loreAutomationStyle || 'balanced',
        status: 'undone',
        changed: beforeById.size + deletedById.size + addedIds.size,
        ranAt: Date.now(),
        operations: [{ id: event.id, operation: 'undo_last_run', reason: event.summary || '', provider: 'local' }],
    }, getSettings());
    saveState(state, { syncPrompt: true });
    return { status: 'undone', undone: 1, eventId: event.id };
}

export async function runAutoRelevance(options = {}) {
    if (autoRelevanceRunning) {
        return { status: 'skipped_running' };
    }
    autoRelevanceRunning = true;
    try {
        return await runAutoRelevanceInternal(options);
    } finally {
        autoRelevanceRunning = false;
    }
}

async function runAutoRelevanceInternal(options = {}) {
    const settings = getSettings();
    const loreAutomationMode = normalizeLoreAutomationMode(settings.loreAutomationMode || (settings.autoRelevanceEnabled === false ? 'off' : 'ar'));
    const profile = getLoreAutomationStyleProfile(settings);
    const mode = getLoreAutomationActionMode(settings, loreAutomationMode);
    if (loreAutomationMode === 'off' || (!options.force && (settings.autoRelevanceEnabled === false || mode === 'off'))) {
        return { status: 'disabled' };
    }
    const state = getState();
    const runId = buildLoreAutomationRunId(loreAutomationMode);
    let entries = normalizeLoreMatrix(state.loreMatrix || []);
    if (options.curationOnly === true) {
        if (!supportsLoreAutomationMode(loreAutomationMode, 'armpc')) return { status: 'disabled' };
        const recentText = getRecentChatText(settings.autoRelevanceRecentMessages || 20);
        const beforeTimeline = captureLoreTimelineState(state);
        const curationResult = await runArmPcCuration({ state, settings, recentText, runId, beforeTimeline });
        const status = curationResult.curated || curationResult.pendingCurated || curationResult.retired
            ? curationResult.status
            : getCurationNoChangeStatus(curationResult, 'unchanged');
        recordLoreAutomationRun(state, {
            id: runId,
            mode: loreAutomationMode,
            style: profile.style,
            status,
            providerStatus: curationResult.providerStatus || '',
            modelError: curationResult.modelError || '',
            curated: curationResult.curated || 0,
            pendingCurated: curationResult.pendingCurated || 0,
            retired: curationResult.retired || 0,
            recentMessageChars: recentText.length,
            ranAt: Date.now(),
            operations: curationResult.operations || [],
        }, settings);
        markLoreAutomationCadenceRun(state, { remap: false, curation: true });
        saveState(state, { syncPrompt: !!(curationResult.curated || curationResult.retired) });
        return {
            status,
            curated: curationResult.curated || 0,
            pendingCurated: curationResult.pendingCurated || 0,
            retired: curationResult.retired || 0,
            providerStatus: curationResult.providerStatus || '',
        };
    }
    if (!entries.length) {
        const pendingCount = normalizeLoreMatrix(state.pendingLoreEntries || []).length;
        const activeStackCount = Array.isArray(state.loredeckStack)
            ? state.loredeckStack.filter(item => item?.enabled !== false).length
            : 0;
        if (activeStackCount && supportsLoreAutomationMode(loreAutomationMode, 'armpc')) {
            const recentText = getRecentChatText(settings.autoRelevanceRecentMessages || 20);
            const beforeTimeline = captureLoreTimelineState(state);
            const curationResult = await runArmPcCuration({ state, settings, recentText, runId, beforeTimeline });
            const status = curationResult.curated || curationResult.pendingCurated || curationResult.retired
                ? curationResult.status
                : getCurationNoChangeStatus(curationResult, 'no_accepted_lore');
            recordLoreAutomationRun(state, {
                id: runId,
                mode: loreAutomationMode,
                style: profile.style,
                status,
                providerStatus: curationResult.providerStatus || '',
                modelError: curationResult.modelError || '',
                curated: curationResult.curated || 0,
                pendingCurated: curationResult.pendingCurated || 0,
                retired: curationResult.retired || 0,
                recentMessageChars: recentText.length,
                ranAt: Date.now(),
                operations: curationResult.operations || [],
            }, settings);
            markLoreAutomationCadenceRun(state, { remap: false, curation: true });
            saveState(state, { syncPrompt: !!(curationResult.curated || curationResult.retired) });
            return {
                status,
                pendingCount,
                activeStackCount,
                curated: curationResult.curated || 0,
                pendingCurated: curationResult.pendingCurated || 0,
                retired: curationResult.retired || 0,
                providerStatus: curationResult.providerStatus || '',
            };
        }
        const status = pendingCount ? 'pending_only' : activeStackCount ? 'no_accepted_lore' : 'no_lore';
        recordLoreAutomationRun(state, {
            id: runId,
            mode: loreAutomationMode,
            style: profile.style,
            status,
            ranAt: Date.now(),
        }, settings);
        markLoreAutomationCadenceRun(state, { remap: true, curation: false });
        if (options.force) saveState(state, { syncPrompt: false });
        return {
            status,
            pendingCount,
            activeStackCount,
        };
    }

    const suppressed = new Set(state?.loreSelection?.suppressedIds || []);
    const pinned = new Set(state?.loreSelection?.pinnedIds || []);
    const candidateCap = Math.max(1, Math.min(500, Number(settings.autoRelevanceCandidateCap) || 40));
    const threshold = Math.max(profile.relevanceThreshold, Math.min(1, Number(settings.autoRelevanceMinConfidence) || profile.relevanceThreshold));
    const recentText = getRecentChatText(settings.autoRelevanceRecentMessages || 20);
    const beforeTimeline = captureLoreTimelineState(state);

    const scored = buildScoredCandidates(entries, state, settings, suppressed, pinned);
    const candidates = selectCandidates(scored, settings, candidateCap);
    let adjudicated = { changes: [], status: 'local' };
    try {
        adjudicated = await adjudicateCandidatesWithModel(candidates, state, settings, recentText);
    } catch (e) {
        console.warn('[Saga Auto-Relevance] Model adjudication failed; using local relevance only.', e);
        adjudicated = { changes: [], status: 'model_failed', error: e?.message || String(e || '') };
    }

    const modelById = new Map((adjudicated.changes || []).map(change => [change.item.entry.id, change]));
    const actionable = candidates
        .map(item => {
            const model = modelById.get(item.entry.id);
            if (!model) return item;
            return { ...item, next: normalizeLoreRelevance(model.next), confidence: model.confidence, modelReason: model.reason, modelSource: model.source || 'model' };
        })
        .filter(item => shouldApplyCandidate(item, settings, threshold, pinned));
    const promotionCount = actionable.filter(item => relevanceWeight(item.next) > relevanceWeight(item.current)).length;
    const demotionCount = actionable.filter(item => relevanceWeight(item.next) < relevanceWeight(item.current)).length;
    let changed = 0;
    let remapResult = { changed: 0, pinned: 0, unpinned: 0, muted: 0, unmuted: 0, operations: [], modelStatus: '' };
    let curationResult = { status: 'skipped', curated: 0, pendingCurated: 0, providerStatus: '', operations: [] };

    const byId = new Map(actionable.map(item => [item.entry.id, item]));
    state.loreMatrix = entries.map(entry => {
        const item = byId.get(entry.id);
        if (!item) return entry;
        changed += 1;
        return markLoreAutomationAction({
            ...entry,
            relevance: normalizeLoreRelevance(item.next),
            extensions: {
                ...(entry.extensions || {}),
                autoRelevance: {
                    mode: item.modelSource || 'local',
                    confidence: item.confidence,
                    score: item.local.score,
                    reason: item.modelReason || `Local relevance score ${item.local.score}; temporal role ${item.local.temporalRole}${item.local.recentHit ? '; recent-message match' : ''}.`,
                    updatedAt: Date.now(),
                },
            },
        }, {
            operation: relevanceWeight(item.next) > relevanceWeight(item.current) ? 'promote_relevance' : 'demote_relevance',
            reason: item.modelReason || `Local relevance score ${item.local.score}; temporal role ${item.local.temporalRole}${item.local.recentHit ? '; recent-message match' : ''}.`,
            provider: item.modelSource || 'local',
            runId,
            at: Date.now(),
        });
    });
    entries = normalizeLoreMatrix(state.loreMatrix || []);

    if (supportsLoreAutomationMode(loreAutomationMode, 'armp')) {
        const remapSuppressed = new Set(state?.loreSelection?.suppressedIds || []);
        const remapPinned = new Set(state?.loreSelection?.pinnedIds || []);
        const remapScored = buildScoredCandidates(entries, state, settings, remapSuppressed, remapPinned);
        const localRemapOperations = buildLocalRemappingCandidates(remapScored, state, settings, remapSuppressed, remapPinned);
        let remapAdjudicated = { operations: [], status: 'local' };
        try {
            remapAdjudicated = await adjudicateRemappingWithModel(localRemapOperations, state, settings, recentText);
        } catch (e) {
            console.warn('[Saga Lore Automation] ARMP adjudication failed; using local-safe operations only.', e);
            remapAdjudicated = { operations: [], status: 'model_failed', error: e?.message || String(e || '') };
        }
        const remapSource = remapAdjudicated.operations?.length
            ? remapAdjudicated.operations
            : (remapAdjudicated.status === 'local_only' || normalizeLoreAutomationProviderRouting(settings.loreAutomationProviderRouting || 'auto') === 'local' || remapAdjudicated.status === 'unavailable'
                ? localRemapOperations
                : []);
        const validatedRemap = validateRemappingOperations(remapSource, state, settings, loreAutomationMode);
        remapResult = {
            ...applyRemappingOperations(state, validatedRemap, runId),
            modelStatus: remapAdjudicated.status,
            modelError: remapAdjudicated.error || '',
        };
    }

    if (supportsLoreAutomationMode(loreAutomationMode, 'armpc') && options.skipCuration !== true) {
        curationResult = await runArmPcCuration({ state, settings, recentText, runId, beforeTimeline, recordTimeline: false });
    }

    state.autoRelevanceSuggestions = [];
    const totalChanged = changed + (remapResult.changed || 0) + (curationResult.curated || 0) + (curationResult.pendingCurated || 0) + (curationResult.retired || 0);
    const runStatus = totalChanged
        ? (curationResult.curated || curationResult.pendingCurated || curationResult.retired ? curationResult.status : 'changed')
        : getCurationNoChangeStatus(curationResult, 'unchanged');
    state.autoRelevanceLastRun = {
        status: runStatus,
        considered: candidates.length,
        changed,
        promotions: promotionCount,
        demotions: demotionCount,
        modelStatus: adjudicated.status,
        modelError: adjudicated.error || '',
        recentMessageChars: recentText.length,
        ranAt: Date.now(),
    };
    recordLoreAutomationRun(state, {
        id: runId,
        mode: loreAutomationMode,
        style: profile.style,
        status: runStatus,
        considered: candidates.length,
        changed,
        promotions: promotionCount,
        demotions: demotionCount,
        pinned: remapResult.pinned || 0,
        unpinned: remapResult.unpinned || 0,
        muted: remapResult.muted || 0,
        unmuted: remapResult.unmuted || 0,
        curated: curationResult.curated || 0,
        pendingCurated: curationResult.pendingCurated || 0,
        retired: curationResult.retired || 0,
        modelStatus: adjudicated.status,
        providerStatus: [remapResult.modelStatus, curationResult.providerStatus].filter(Boolean).join('/'),
        modelError: adjudicated.error || remapResult.modelError || curationResult.modelError || '',
        recentMessageChars: recentText.length,
        ranAt: Date.now(),
        operations: [
            ...actionable.map(item => ({
                id: item.entry.id,
                title: item.entry.title || item.entry.id,
                operation: relevanceWeight(item.next) > relevanceWeight(item.current) ? 'promote_relevance' : 'demote_relevance',
                confidence: item.confidence,
                reason: item.modelReason || `Local relevance score ${item.local.score}; temporal role ${item.local.temporalRole}${item.local.recentHit ? '; recent-message match' : ''}.`,
                provider: item.modelSource || 'local',
            })),
            ...(remapResult.operations || []),
            ...(curationResult.operations || []),
        ],
    }, settings);
    markLoreAutomationCadenceRun(state, {
        remap: true,
        curation: supportsLoreAutomationMode(loreAutomationMode, 'armpc') && options.skipCuration !== true,
    });
    if (totalChanged > 0) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'lore_automation',
            source: 'lore_automation',
            summary: `Lore Automation applied ${changed} relevance, ${remapResult.changed || 0} remapping, ${curationResult.curated || 0} accepted, and ${curationResult.retired || 0} retired change${totalChanged === 1 ? '' : 's'}.`,
        });
    }
    saveState(state, { syncPrompt: totalChanged > 0 });
    return {
        status: runStatus,
        changed,
        suggested: 0,
        promotions: promotionCount,
        demotions: demotionCount,
        considered: candidates.length,
        pinned: remapResult.pinned || 0,
        unpinned: remapResult.unpinned || 0,
        muted: remapResult.muted || 0,
        unmuted: remapResult.unmuted || 0,
        curated: curationResult.curated || 0,
        pendingCurated: curationResult.pendingCurated || 0,
        retired: curationResult.retired || 0,
        modelStatus: adjudicated.status,
        providerStatus: [remapResult.modelStatus, curationResult.providerStatus].filter(Boolean).join('/'),
    };
}

export function onGenerationEndedAutoRelevance() {
    const settings = getSettings();
    const loreAutomationMode = normalizeLoreAutomationMode(settings.loreAutomationMode || (settings.autoRelevanceEnabled ? 'ar' : 'off'));
    if (loreAutomationMode === 'off' || settings.loreAutomationPaused === true) return { status: 'disabled' };
    if (!isLoreAutomationBackgroundEnabled(settings)) return { status: 'manual_mode' };
    const state = getState();
    const cadence = normalizeLoreAutomationCadence(state);
    const policy = getLoreAutomationPacingPolicy(settings);
    const totalWords = getTotalStoryWordCount();
    const remapDelta = Math.max(0, totalWords - (Number(cadence.lastRemapWordCount) || 0));
    const curationDelta = Math.max(0, totalWords - (Number(cadence.lastCurationWordCount) || 0));
    cadence.accumulatedRemapWords = remapDelta;
    cadence.accumulatedCurationWords = curationDelta;

    const contextHash = buildContextAutomationHash(state);
    const deckStackHash = buildDeckStackAutomationHash(state);
    const acceptedAutomationHash = buildAcceptedAutomationHash(state);
    const initialized = !!(cadence.lastContextHash || cadence.lastDeckStackHash || cadence.lastAcceptedAutomationHash);
    const contextChanged = initialized && cadence.lastContextHash !== contextHash;
    const deckChanged = initialized && cadence.lastDeckStackHash !== deckStackHash;
    const acceptedChanged = initialized && cadence.lastAcceptedAutomationHash !== acceptedAutomationHash;
    if (!initialized) {
        cadence.lastContextHash = contextHash;
        cadence.lastDeckStackHash = deckStackHash;
        cadence.lastAcceptedAutomationHash = acceptedAutomationHash;
        saveState(state, { syncPrompt: false });
    }

    const recentText = getRecentChatText(settings.autoRelevanceRecentMessages || 20);
    const stackPressure = computeLoreAutomationStackPressure(state, settings, recentText);
    const appEventDue = contextChanged || deckChanged || acceptedChanged;
    const remapDue = appEventDue || remapDelta >= policy.remapWordBudget;
    const curationDue = supportsLoreAutomationMode(loreAutomationMode, 'armpc')
        && (appEventDue || curationDelta >= policy.curationWordBudget || stackPressure.pressure !== 'none');
    if (!remapDue && !curationDue) {
        const shouldClassify = supportsLoreAutomationMode(loreAutomationMode, 'armpc')
            && normalizeLoreAutomationProviderRouting(settings.loreAutomationProviderRouting || 'auto') !== 'local'
            && remapDelta >= policy.edgeClassifierMinWords
            && Number(cadence.lastEdgeClassifier?.wordCount || 0) !== totalWords;
        if (shouldClassify) {
            cadence.lastEdgeClassifier = {
                edge: 'pending',
                confidence: 0,
                changed: [],
                reason: '',
                wordCount: totalWords,
                checkedAt: Date.now(),
            };
            saveState(state, { syncPrompt: false });
            classifyLoreAutomationEdge(state, settings, recentText, cadence).then(result => {
                const nextState = getState();
                const nextCadence = normalizeLoreAutomationCadence(nextState);
                nextCadence.lastEdgeClassifier = {
                    edge: result.edge || 'none',
                    confidence: Number(result.confidence) || 0,
                    changed: result.changed || [],
                    reason: result.reason || '',
                    wordCount: totalWords,
                    checkedAt: Date.now(),
                    status: result.status || '',
                };
                const hardEdge = ['hard_scene_shift', 'chapter_or_arc_shift'].includes(result.edge) && (Number(result.confidence) || 0) >= 0.78;
                if (hardEdge && !autoRelevanceRunning) {
                    nextCadence.pendingReason = `Utility edge classifier: ${result.edge}`;
                    saveState(nextState, { syncPrompt: false });
                    runAutoRelevance({ skipCuration: false }).catch(e => console.error('[Saga Lore Automation] edge-triggered run failed:', e));
                } else {
                    saveState(nextState, { syncPrompt: false });
                }
            }).catch(e => console.warn('[Saga Lore Automation] edge classifier failed.', e));
            return { status: 'scheduled_classifier', remapDelta, curationDelta, remapWordBudget: policy.remapWordBudget, curationWordBudget: policy.curationWordBudget };
        }
        cadence.pendingReason = '';
        return {
            status: 'waiting',
            remapDelta,
            curationDelta,
            remapWordBudget: policy.remapWordBudget,
            curationWordBudget: policy.curationWordBudget,
            stackPressure: stackPressure.pressure,
        };
    }
    if (autoRelevanceRunning) return { status: 'skipped_running' };
    const reasons = [];
    if (contextChanged) reasons.push('context_changed');
    if (deckChanged) reasons.push('active_deck_changed');
    if (acceptedChanged) reasons.push('accepted_stack_changed');
    if (remapDelta >= policy.remapWordBudget) reasons.push('story_budget_remap');
    if (curationDelta >= policy.curationWordBudget) reasons.push('story_budget_curation');
    if (stackPressure.pressure !== 'none') reasons.push(`stack_pressure_${stackPressure.pressure}`);
    cadence.pendingReason = reasons.join(',');
    saveState(state, { syncPrompt: false });
    const options = curationDue && !remapDue
        ? { curationOnly: true }
        : { skipCuration: !curationDue };
    runAutoRelevance(options).catch(e => console.error('[Saga Lore Automation] failed:', e));
    return {
        status: 'scheduled',
        remapDue,
        curationDue,
        remapDelta,
        curationDelta,
        reasons,
        stackPressure: stackPressure.pressure,
    };
}

export const __autoRelevanceTestHooks = Object.freeze({
    buildAutoRelevanceModelParseFailure,
    buildContextAutomationHash,
    buildDeckStackAutomationHash,
    buildAcceptedAutomationHash,
    computeLoreAutomationStackPressure,
    getContextCoverageLaneIds,
    getEntryCoverageLaneIds,
    getLoreAutomationPacingPolicy,
    hasUsableLoreAutomationContext,
    isLoreAutomationBackgroundEnabled,
    packCurationCandidates,
    parseJsonObject,
});
