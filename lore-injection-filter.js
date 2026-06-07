/**
 * lore-injection-filter.js -- Saga
 * Shared accepted-Lorecard injection eligibility.
 */

import { evaluateEntryContextGate } from './context-gating.js';
import { getContextIndexSync } from './context-index.js';
import { normalizeLoreMatrix } from './lore-matrix.js';
import { normalizeLoreRelevance, sortLoreEntriesForInjection } from './lore-relevance.js';

function cleanString(value = '', limit = 240) {
    return String(value || '').trim().slice(0, limit);
}

function numericLimit(value = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function getContextIndex(options = {}) {
    return options.contextIndex || options.index || getContextIndexSync() || null;
}

export function getLoreEntryInjectionContextGate(entry = {}, state = {}, options = {}) {
    const result = evaluateEntryContextGate(entry, state, {
        index: getContextIndex(options),
        unresolvedEligible: options.unresolvedEligible === true,
    });
    return {
        eligible: result.eligible !== false,
        status: cleanString(result.status, 80),
        reason: cleanString(result.reason, 500),
        hasGate: result.hasGate === true,
        packId: cleanString(result.packId, 160),
    };
}

export function getInjectableLoreEntriesForInjection(state = {}, options = {}) {
    const all = normalizeLoreMatrix(state?.loreMatrix || []);
    const suppressed = new Set(state?.loreSelection?.suppressedIds || []);
    const pinned = new Set(state?.loreSelection?.pinnedIds || []);
    const tier = options.relevance ? normalizeLoreRelevance(options.relevance) : null;
    const injectable = all
        .filter(entry => entry.status !== 'archived' && entry.status !== 'disabled')
        .filter(entry => entry.injectableByDefault !== false)
        .filter(entry => !suppressed.has(entry.id))
        .filter(entry => !tier || normalizeLoreRelevance(entry.relevance) === tier)
        .filter(entry => getLoreEntryInjectionContextGate(entry, state, options).eligible)
        .map(entry => ({
            ...entry,
            isPinned: pinned.has(entry.id),
            isSuppressed: false,
            isActive: normalizeLoreRelevance(entry.relevance) === 'high',
            relevance: normalizeLoreRelevance(entry.relevance),
        }));
    const sorted = sortLoreEntriesForInjection(injectable, pinned);
    const limit = numericLimit(options.limit);
    return limit > 0 ? sorted.slice(0, limit) : sorted;
}

export function getInjectableLoreEntriesByRelevanceForInjection(state = {}, relevance = 'normal', limit = 0, options = {}) {
    return getInjectableLoreEntriesForInjection(state, {
        ...options,
        relevance,
        limit,
    });
}
