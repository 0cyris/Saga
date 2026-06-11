/**
 * retrieval-audit.js -- Saga/Saga
 * Lightweight observability for Lorecard retrieval and prompt injection.
 *
 * Inspired by TunnelVision's retrieval sidecar, but Saga keeps Context gates and
 * Pending Review as the authority. This module records compact, ephemeral audit
 * snapshots; it does not mutate accepted lore or SillyTavern World Info.
 */

import { normalizeLoreMatrix } from './lore-matrix.js';
import {
    getInjectableLoreEntriesByRelevanceForInjection,
    getLoreEntryInjectionContextGate,
} from './lore-injection-filter.js';
import { normalizeLoreRelevance } from './lore-relevance.js';

const RELEVANCE_TIERS = Object.freeze(['high', 'normal', 'low']);
const MAX_AUDIT_ENTRIES = 240;
const MAX_SEARCH_RESULTS = 24;

let lastLoreInjectionAudit = null;
let lastLoredeckRetrievalAudit = null;

function text(value, limit = 240) {
    return String(value || '').trim().slice(0, limit);
}

function arr(value) {
    if (Array.isArray(value)) return value.map(item => text(item, 160)).filter(Boolean);
    if (typeof value === 'string') return value.split(',').map(item => text(item, 160)).filter(Boolean);
    return [];
}

function estimateTokens(value = '') {
    return Math.ceil(String(value || '').length / 4);
}

function capTier(tier = '') {
    return tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : '';
}

function tierSettingKey(tier, suffix) {
    return `lore${capTier(tier)}${suffix}`;
}

function getEntryLoredeckMeta(entry = {}) {
    const meta = entry.extensions?.sagaLoredeck || {};
    return {
        packId: text(meta.packId || entry.loredeckId || entry.packId || '', 120),
        packTitle: text(meta.packTitle || '', 160),
        file: text(meta.file || '', 240),
        stackIndex: Number.isFinite(Number(meta.stackIndex)) ? Number(meta.stackIndex) : 9999,
        stackPriority: Number.isFinite(Number(meta.stackPriority)) ? Number(meta.stackPriority) : 0,
    };
}

function summarizeLoredeckStack(state = {}) {
    return (Array.isArray(state.loredeckStack) ? state.loredeckStack : [])
        .filter(item => item?.packId)
        .map((item, index) => ({
            packId: text(item.packId, 120),
            enabled: item.enabled !== false,
            priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
            order: index,
        }))
        .slice(0, 40);
}

function summarizeLoredeckContexts(state = {}) {
    const contexts = state?.loredeckContexts && typeof state.loredeckContexts === 'object' && !Array.isArray(state.loredeckContexts)
        ? state.loredeckContexts
        : {};
    const out = {};
    for (const [packId, context] of Object.entries(contexts).slice(0, 40)) {
        out[text(packId, 120)] = {
            label: text(context?.label, 180),
            contextType: text(context?.contextType, 80),
            anchorId: text(context?.anchorId, 180),
            contextSortKey: Number.isFinite(Number(context?.contextSortKey)) ? Number(context.contextSortKey) : null,
            arc: text(context?.arc, 180),
            phase: text(context?.phase, 180),
            source: text(context?.source, 80),
            confidence: Number.isFinite(Number(context?.confidence)) ? Number(context.confidence) : 0,
        };
    }
    return out;
}

function getEntrySearchText(entry = {}) {
    const content = entry.content || {};
    const scope = entry.scope || {};
    const retrieval = entry.retrieval || {};
    const triggers = retrieval.triggers || {};
    return [
        entry.id,
        entry.title,
        entry.category,
        entry.kind,
        entry.gateType,
        entry.lorePurpose,
        content.fact,
        content.injection,
        entry.fact,
        ...(Array.isArray(content.constraints) ? content.constraints : []),
        ...(Array.isArray(content.antiLore) ? content.antiLore : []),
        ...arr(entry.tags),
        ...arr(scope.characters),
        ...arr(scope.locations),
        ...arr(scope.topics),
        ...arr(scope.objects),
        ...arr(scope.spells),
        ...arr(triggers.topicsAny),
        ...arr(triggers.charactersAny),
        ...arr(triggers.locationsAny),
    ].filter(Boolean).join(' ');
}

function lowerTokens(value = '') {
    return String(value || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .map(item => item.trim())
        .filter(item => item.length > 2);
}

function scoreSearchHit(entry = {}, query = '') {
    const q = text(query, 400).toLowerCase();
    if (!q) return 0;
    const title = text(entry.title, 240).toLowerCase();
    const id = text(entry.id, 180).toLowerCase();
    const haystack = getEntrySearchText(entry).toLowerCase();
    let score = 0;
    if (title === q || id === q) score += 100;
    if (title.includes(q)) score += 55;
    if (id.includes(q)) score += 35;
    if (haystack.includes(q)) score += 40;
    const tokens = new Set(lowerTokens(haystack));
    for (const token of lowerTokens(q)) {
        if (tokens.has(token)) score += 10;
    }
    if (score <= 0) return 0;
    if (entry.isPinned) score += 8;
    if (entry.isSuppressed) score -= 20;
    score += Math.max(0, Math.min(12, Number(entry.priority || 50) / 10));
    return Math.round(score);
}

function compactEntry(entry = {}, extra = {}) {
    const loredeck = getEntryLoredeckMeta(entry);
    return {
        id: text(entry.id, 180),
        title: text(entry.title || entry.id, 240),
        category: text(entry.category, 80),
        relevance: normalizeLoreRelevance(entry.relevance || 'normal'),
        priority: Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : 50,
        status: text(entry.status || 'active', 80),
        packId: loredeck.packId,
        packTitle: loredeck.packTitle,
        stackIndex: loredeck.stackIndex,
        stackPriority: loredeck.stackPriority,
        pinned: entry.isPinned === true,
        muted: entry.isSuppressed === true,
        ...extra,
    };
}

export function searchAcceptedLorecards(state = {}, query = '', options = {}) {
    const limit = Math.max(1, Math.min(MAX_SEARCH_RESULTS, Number(options.limit) || 8));
    const includeMuted = options.includeMuted === true;
    const includeDisabled = options.includeDisabled === true;
    const pinnedIds = new Set(state?.loreSelection?.pinnedIds || []);
    const mutedIds = new Set(state?.loreSelection?.suppressedIds || []);
    const entries = normalizeLoreMatrix(state?.loreMatrix || [])
        .map(entry => ({
            ...entry,
            isPinned: pinnedIds.has(entry.id),
            isSuppressed: mutedIds.has(entry.id),
            relevance: normalizeLoreRelevance(entry.relevance || 'normal'),
        }))
        .filter(entry => includeMuted || !entry.isSuppressed)
        .filter(entry => includeDisabled || !['archived', 'disabled'].includes(String(entry.status || '').toLowerCase()))
        .map(entry => ({ entry, score: scoreSearchHit(entry, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || String(a.entry.title || '').localeCompare(String(b.entry.title || '')))
        .slice(0, limit);

    return {
        schemaVersion: 1,
        query: text(query, 400),
        resultCount: entries.length,
        results: entries.map(item => compactEntry(item.entry, {
            score: item.score,
            reason: item.entry.isSuppressed ? 'muted_match' : 'accepted_match',
            preview: text(item.entry.content?.injection || item.entry.content?.fact || item.entry.fact || '', 500),
        })),
    };
}

export function buildLoreInjectionAudit(state = {}, settings = {}, promptInfo = {}) {
    const allEntries = normalizeLoreMatrix(state?.loreMatrix || []);
    const pinnedIds = new Set(state?.loreSelection?.pinnedIds || []);
    const mutedIds = new Set(state?.loreSelection?.suppressedIds || []);
    const tierSelections = {};
    const tierSummary = {};

    for (const tier of RELEVANCE_TIERS) {
        const enabled = settings.injectLore !== false && settings[tierSettingKey(tier, 'InjectionEnabled')] !== false;
        const maxEntries = Math.max(0, Number(settings[tierSettingKey(tier, 'MaxEntries')]) || 0);
        const selected = enabled ? getInjectableLoreEntriesByRelevanceForInjection(state, tier, maxEntries) : [];
        const selectedIds = new Set(selected.map(entry => entry.id));
        tierSelections[tier] = selectedIds;
        tierSummary[tier] = {
            enabled,
            maxEntries,
            injected: selected.length,
            promptChars: Number(promptInfo.promptCharsByTier?.[tier]) || 0,
            estimatedTokens: estimateTokens(promptInfo.promptCharsByTier?.[tier] ? 'x'.repeat(Number(promptInfo.promptCharsByTier[tier]) || 0) : ''),
            entryIds: selected.map(entry => text(entry.id, 180)).slice(0, 80),
        };
    }

    const entries = [];
    const summary = {
        accepted: allEntries.length,
        injected: 0,
        pinnedInjected: 0,
        muted: 0,
        disabled: 0,
        nonInjectable: 0,
        tierDisabled: 0,
        contextBlocked: 0,
        overCap: 0,
        notInjected: 0,
    };

    for (const raw of allEntries) {
        const entry = {
            ...raw,
            isPinned: pinnedIds.has(raw.id),
            isSuppressed: mutedIds.has(raw.id),
            relevance: normalizeLoreRelevance(raw.relevance || 'normal'),
        };
        const tier = entry.relevance;
        const tierEnabled = tierSummary[tier]?.enabled === true;
        const selected = tierSelections[tier]?.has(entry.id) === true;
        const contextGate = getLoreEntryInjectionContextGate(entry, state);
        let decision = 'not_injected';
        let reason = 'not selected for this prompt sync';

        if (['archived', 'disabled'].includes(String(entry.status || '').toLowerCase())) {
            decision = 'disabled';
            reason = `status:${entry.status || 'disabled'}`;
            summary.disabled += 1;
        } else if (entry.injectableByDefault === false) {
            decision = 'non_injectable';
            reason = 'injectableByDefault:false';
            summary.nonInjectable += 1;
        } else if (entry.isSuppressed) {
            decision = 'muted';
            reason = 'muted by user';
            summary.muted += 1;
        } else if (!contextGate.eligible) {
            decision = 'context_blocked';
            reason = contextGate.reason || 'blocked by active Loredeck Context';
            summary.contextBlocked += 1;
        } else if (!tierEnabled) {
            decision = 'tier_disabled';
            reason = `${tier} tier disabled`;
            summary.tierDisabled += 1;
        } else if (selected) {
            decision = 'injected';
            reason = entry.isPinned ? 'pinned and selected' : 'selected by relevance tier';
            summary.injected += 1;
            if (entry.isPinned) summary.pinnedInjected += 1;
        } else {
            const maxEntries = tierSummary[tier]?.maxEntries || 0;
            decision = maxEntries > 0 ? 'over_cap' : 'not_injected';
            reason = maxEntries > 0 ? `${tier} tier cap reached` : 'not selected';
            if (decision === 'over_cap') summary.overCap += 1;
            else summary.notInjected += 1;
        }

        entries.push(compactEntry(entry, {
            tier,
            decision,
            reason,
            contextGateStatus: contextGate.status,
            contextGateReason: contextGate.reason,
            injectionChars: text(entry.content?.injection || entry.content?.fact || entry.fact || '', 2000).length,
        }));
    }

    summary.notInjected += summary.muted + summary.disabled + summary.nonInjectable + summary.contextBlocked + summary.tierDisabled + summary.overCap;

    return {
        schemaVersion: 1,
        source: 'prompt_sync',
        createdAt: Date.now(),
        transport: promptInfo.transport || 'unknown',
        enabled: settings.enabled !== false,
        injectLore: settings.injectLore !== false,
        loredeckStack: summarizeLoredeckStack(state),
        loredeckContexts: summarizeLoredeckContexts(state),
        prompt: {
            continuityChars: Number(promptInfo.continuityChars) || 0,
            loreChars: Number(promptInfo.loreChars) || 0,
            combinedChars: Number(promptInfo.combinedChars) || 0,
            loreHighChars: Number(promptInfo.promptCharsByTier?.high) || 0,
            loreNormalChars: Number(promptInfo.promptCharsByTier?.normal) || 0,
            loreLowChars: Number(promptInfo.promptCharsByTier?.low) || 0,
        },
        summary,
        tiers: tierSummary,
        entries: entries
            .sort((a, b) => {
                if (a.decision === 'injected' && b.decision !== 'injected') return -1;
                if (b.decision === 'injected' && a.decision !== 'injected') return 1;
                return a.stackIndex - b.stackIndex || b.priority - a.priority || a.title.localeCompare(b.title);
            })
            .slice(0, MAX_AUDIT_ENTRIES),
    };
}

export function buildLoredeckRetrievalAudit(input = {}) {
    const selectedIds = new Set((input.selectedCandidates || []).map(item => item?.entry?.id).filter(Boolean));
    const candidates = (Array.isArray(input.candidates) ? input.candidates : [])
        .map((item, index) => {
            const entry = item.entry || {};
            const gate = item.eligibility?.contextGate || {};
            return compactEntry(entry, {
                decision: selectedIds.has(entry.id) ? 'selected' : 'eligible_not_selected',
                score: Math.round(Number(item.score) || 0),
                rank: index + 1,
                matchedBy: text(item.eligibility?.matchedBy || '', 80),
                contextGateStatus: text(gate.status || '', 80),
                contextGateReason: text(gate.reason || '', 240),
            });
        })
        .slice(0, MAX_AUDIT_ENTRIES);

    return {
        schemaVersion: 1,
        source: text(input.source || 'loredeck_retrieval', 120),
        createdAt: Date.now(),
        status: text(input.status || '', 80),
        databaseId: text(input.databaseId || '', 160),
        sceneIso: text(input.sceneIso || '', 80),
        maxEntries: Math.max(0, Number(input.maxEntries) || 0),
        loredeckStack: summarizeLoredeckStack(input.state || {}),
        loredeckContexts: summarizeLoredeckContexts(input.state || {}),
        context: {
            sceneDate: text(input.context?.sceneDate, 80),
            canonBoundary: text(input.context?.canonBoundary, 240),
            branchId: text(input.context?.branchId || 'main', 120),
        },
        summary: {
            eligibleCandidates: candidates.length,
            selected: selectedIds.size,
        },
        candidates,
    };
}

export function recordLoreInjectionAudit(audit = null) {
    lastLoreInjectionAudit = audit && typeof audit === 'object' ? audit : null;
    return lastLoreInjectionAudit;
}

export function getLastLoreInjectionAudit() {
    return lastLoreInjectionAudit;
}

export function recordLoredeckRetrievalAudit(audit = null) {
    lastLoredeckRetrievalAudit = audit && typeof audit === 'object' ? audit : null;
    return lastLoredeckRetrievalAudit;
}

export function getLastLoredeckRetrievalAudit() {
    return lastLoredeckRetrievalAudit;
}
