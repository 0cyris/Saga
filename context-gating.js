/**
 * context-gating.js -- Saga/Wandlight
 * Pure helpers for evaluating entry-level Context gates.
 */

import { normalizeLoreEntry } from './lore-matrix.js';

export const CONTEXT_GATE_STATUSES = Object.freeze({
    NO_GATE: 'no_gate',
    MATCH: 'match',
    MISMATCH: 'mismatch',
    UNRESOLVED: 'unresolved',
});

function cleanString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value) {
    return cleanString(value, 240).toLowerCase();
}

function hasFiniteNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function hasAnyContextGate(position = {}, coordinates = []) {
    const p = isPlainObject(position) ? position : {};
    const stringFields = [
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
    if (stringFields.some(field => cleanString(p[field]))) return true;
    if (hasFiniteNumber(p.sortKeyFrom) || hasFiniteNumber(p.sortKeyTo)) return true;
    return Array.isArray(coordinates) && coordinates.some(item => {
        if (!isPlainObject(item)) return false;
        return cleanString(item.axis) || cleanString(item.id) || cleanString(item.from) || cleanString(item.to);
    });
}

function getEntryPackId(entry = {}) {
    return cleanString(
        entry.extensions?.sagaLoredeck?.packId
        || entry.loredeckId
        || entry.packId
        || entry.sourceInfo?.packId
        || ''
    );
}

function getContextForEntry(entry = {}, state = {}, options = {}) {
    const packId = cleanString(options.packId || getEntryPackId(entry));
    const contexts = isPlainObject(options.loredeckContexts)
        ? options.loredeckContexts
        : isPlainObject(state?.loredeckContexts)
            ? state.loredeckContexts
            : {};
    return {
        packId,
        context: packId ? contexts[packId] || null : null,
    };
}

function getAnchorsForPack(index = null, packId = '') {
    const anchors = Array.isArray(index?.anchors) ? index.anchors : [];
    return anchors.filter(anchor => !packId || anchor.packId === packId);
}

function getWindowsForPack(index = null, packId = '') {
    const windows = Array.isArray(index?.windows) ? index.windows : [];
    return windows.filter(window => !packId || window.packId === packId);
}

function findAnchor(index = null, packId = '', anchorId = '') {
    const id = cleanString(anchorId);
    if (!id) return null;
    return getAnchorsForPack(index, packId).find(anchor => anchor.id === id) || null;
}

function findWindow(index = null, packId = '', fromAnchor = '', toAnchor = '') {
    const from = cleanString(fromAnchor);
    const to = cleanString(toAnchor);
    if (!from && !to) return null;
    return getWindowsForPack(index, packId).find(window => {
        const windowFrom = cleanString(window.anchorFrom || window.validFromAnchor);
        const windowTo = cleanString(window.anchorTo || window.validToAnchor);
        return (!from || windowFrom === from) && (!to || windowTo === to);
    }) || null;
}

function getContextAnchor(index = null, context = {}, packId = '') {
    const anchorId = cleanString(context?.anchorId);
    return anchorId ? findAnchor(index, packId, anchorId) : null;
}

function getContextSortKey(index = null, context = {}, packId = '') {
    const direct = Number(context?.sortKey ?? context?.contextSortKey);
    if (Number.isFinite(direct)) return direct;
    const anchor = getContextAnchor(index, context, packId);
    if (anchor && Number.isFinite(Number(anchor.sortKey))) return Number(anchor.sortKey);
    return null;
}

function anchorMatches(position = {}, context = {}, index = null, packId = '') {
    const requiredAnchor = cleanString(position.anchorId);
    if (!requiredAnchor) return { ok: true };
    const contextAnchor = cleanString(context?.anchorId);
    if (!contextAnchor) {
        return { ok: false, unresolved: true, reason: `Entry requires anchor ${requiredAnchor}, but this Loredeck has no selected anchor.` };
    }
    if (contextAnchor === requiredAnchor) return { ok: true };

    const required = findAnchor(index, packId, requiredAnchor);
    const current = findAnchor(index, packId, contextAnchor);
    if (required && current && Number(required.sortKey) === Number(current.sortKey)) return { ok: true };
    return { ok: false, reason: `Entry requires anchor ${requiredAnchor}; current anchor is ${contextAnchor}.` };
}

function windowMatches(position = {}, context = {}, index = null, packId = '') {
    const fromAnchorId = cleanString(position.validFromAnchor);
    const toAnchorId = cleanString(position.validToAnchor);
    const hasWindow = fromAnchorId || toAnchorId || hasFiniteNumber(position.sortKeyFrom) || hasFiniteNumber(position.sortKeyTo);
    if (!hasWindow) return { ok: true };

    let fromSort = hasFiniteNumber(position.sortKeyFrom) ? Number(position.sortKeyFrom) : null;
    let toSort = hasFiniteNumber(position.sortKeyTo) ? Number(position.sortKeyTo) : null;
    const fromAnchor = findAnchor(index, packId, fromAnchorId);
    const toAnchor = findAnchor(index, packId, toAnchorId);
    const matchingWindow = findWindow(index, packId, fromAnchorId, toAnchorId);

    if (fromSort === null && fromAnchor && Number.isFinite(Number(fromAnchor.sortKey))) fromSort = Number(fromAnchor.sortKey);
    if (toSort === null && toAnchor && Number.isFinite(Number(toAnchor.sortKey))) toSort = Number(toAnchor.sortKey);
    if (fromSort === null && Number.isFinite(Number(matchingWindow?.sortKeyFrom))) fromSort = Number(matchingWindow.sortKeyFrom);
    if (toSort === null && Number.isFinite(Number(matchingWindow?.sortKeyTo))) toSort = Number(matchingWindow.sortKeyTo);

    const contextSort = getContextSortKey(index, context, packId);
    if (contextSort === null) {
        const contextFrom = cleanString(context?.anchorFrom);
        const contextTo = cleanString(context?.anchorTo);
        if ((fromAnchorId && contextFrom === fromAnchorId) || (toAnchorId && contextTo === toAnchorId)) {
            return { ok: true };
        }
        return { ok: false, unresolved: true, reason: 'Entry has a position window, but this Loredeck Context has no comparable anchor or sort key.' };
    }

    if (fromSort !== null && contextSort < fromSort) {
        return { ok: false, reason: `Current Context is before ${fromAnchorId || fromSort}.` };
    }
    if (toSort !== null && contextSort > toSort) {
        return { ok: false, reason: `Current Context is after ${toAnchorId || toSort}.` };
    }
    return { ok: true };
}

function textFieldMatches(entryValue, contextValue, label) {
    const entryText = canonical(entryValue);
    if (!entryText) return { ok: true };
    const contextText = canonical(contextValue);
    if (!contextText) return { ok: false, unresolved: true, reason: `Entry requires ${label} ${entryValue}, but this Loredeck Context has no ${label}.` };
    if (entryText === contextText || contextText.includes(entryText) || entryText.includes(contextText)) return { ok: true };
    return { ok: false, reason: `Entry requires ${label} ${entryValue}; current ${label} is ${contextValue}.` };
}

function mediaFieldsMatch(position = {}, context = {}) {
    const checks = [
        ['arc', position.arc || position.arcId, context.arc],
        ['phase', position.phase || position.phaseId, context.phase],
        ['season', position.season, context.season],
        ['episode', position.episode, context.episode],
        ['chapter', position.chapter, context.chapter],
        ['issue', position.issue, context.issue],
        ['quest', position.quest, context.quest],
        ['game stage', position.gameStage, context.gameStage],
    ];
    for (const [label, entryValue, contextValue] of checks) {
        const result = textFieldMatches(entryValue, contextValue, label);
        if (!result.ok) return result;
    }
    return { ok: true };
}

function stardateMatches(position = {}, context = {}) {
    const from = hasFiniteNumber(position.stardateFrom) ? Number(position.stardateFrom) : null;
    const to = hasFiniteNumber(position.stardateTo) ? Number(position.stardateTo) : null;
    if (from === null && to === null) return { ok: true };
    const current = Number(context?.stardate || context?.sceneDate || context?.subjectiveDate);
    if (!Number.isFinite(current)) {
        return { ok: false, unresolved: true, reason: 'Entry has a stardate gate, but the Loredeck Context has no stardate.' };
    }
    if (from !== null && current < from) return { ok: false, reason: `Current stardate is before ${from}.` };
    if (to !== null && current > to) return { ok: false, reason: `Current stardate is after ${to}.` };
    return { ok: true };
}

function coordinateMatches(coordinate = {}, context = {}) {
    const axis = cleanString(coordinate.axis);
    const id = canonical(coordinate.id);
    if (!axis && !id) return { ok: true };

    const contextValue = context?.[axis] ?? context?.coordinates?.[axis];
    const contextText = canonical(contextValue);
    if (id && !contextText) {
        return coordinate.required === false
            ? { ok: true }
            : { ok: false, unresolved: true, reason: `Entry requires coordinate ${axis}:${coordinate.id}, but Context has no matching coordinate.` };
    }
    if (id && contextText !== id) {
        return coordinate.required === false
            ? { ok: true }
            : { ok: false, reason: `Entry requires coordinate ${axis}:${coordinate.id}; current value is ${contextValue}.` };
    }
    return { ok: true };
}

function coordinatesMatch(coordinates = [], context = {}) {
    for (const coordinate of Array.isArray(coordinates) ? coordinates : []) {
        const result = coordinateMatches(coordinate, context);
        if (!result.ok) return result;
    }
    return { ok: true };
}

export function evaluateEntryContextGate(entryInput = {}, state = {}, options = {}) {
    const entry = normalizeLoreEntry(entryInput);
    const position = entry.context || {};
    const coordinates = Array.isArray(entry.coordinates) ? entry.coordinates : [];

    if (!hasAnyContextGate(position, coordinates)) {
        return {
            status: CONTEXT_GATE_STATUSES.NO_GATE,
            eligible: true,
            hasGate: false,
            reason: 'Entry has no Context gate.',
            packId: getEntryPackId(entry),
            entry,
        };
    }

    const { packId, context } = getContextForEntry(entry, state, options);
    if (!context) {
        return {
            status: CONTEXT_GATE_STATUSES.UNRESOLVED,
            eligible: options.unresolvedEligible !== false,
            hasGate: true,
            reason: packId
                ? `Entry has Context gates, but ${packId} has no active Context.`
                : 'Entry has Context gates, but no pack id was available for context lookup.',
            packId,
            entry,
        };
    }

    const index = options.index || null;
    const checks = [
        anchorMatches(position, context, index, packId),
        windowMatches(position, context, index, packId),
        mediaFieldsMatch(position, context),
        stardateMatches(position, context),
        coordinatesMatch(coordinates, context),
    ];
    const failed = checks.find(result => !result.ok);
    if (failed) {
        return {
            status: failed.unresolved ? CONTEXT_GATE_STATUSES.UNRESOLVED : CONTEXT_GATE_STATUSES.MISMATCH,
            eligible: failed.unresolved ? options.unresolvedEligible !== false : false,
            hasGate: true,
            reason: failed.reason || 'Entry Context gate does not match the active Loredeck context.',
            packId,
            context,
            entry,
        };
    }

    return {
        status: CONTEXT_GATE_STATUSES.MATCH,
        eligible: true,
        hasGate: true,
        reason: 'Entry Context gate matches the active Loredeck context.',
        packId,
        context,
        entry,
    };
}

export function evaluateEntryContextGates(entries = [], state = {}, options = {}) {
    return (Array.isArray(entries) ? entries : []).map(entry => evaluateEntryContextGate(entry, state, options));
}
