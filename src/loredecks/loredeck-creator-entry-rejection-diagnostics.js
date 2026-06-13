/**
 * Structured diagnostics for Loredeck Creator entry draft rejections.
 */

export const LOREDECK_CREATOR_ENTRY_GUARD_REJECTED_ALL = 'creator_entry_guard_rejected_all';

function cleanString(value = '', maxLength = 500) {
    return String(value || '').trim().slice(0, maxLength);
}

function classifyGuardError(message = '') {
    const text = cleanString(message, 700);
    const unknownTag = text.match(/^Unknown tag\s+(.+?)\.?$/i);
    if (unknownTag) {
        return {
            reasonCode: 'unknown_tag',
            unknownTags: [cleanString(unknownTag[1], 140).replace(/\.$/, '')].filter(Boolean),
            retryable: true,
            safeLocalRepairAvailable: true,
        };
    }
    const unknownAnchor = text.match(/^Unknown\s+(anchorId|validFromAnchor|validToAnchor)\s+(.+?)\.?$/i);
    if (unknownAnchor) {
        return {
            reasonCode: 'unknown_anchor',
            anchorField: unknownAnchor[1],
            unknownAnchors: [cleanString(unknownAnchor[2], 180).replace(/\.$/, '')].filter(Boolean),
            retryable: true,
            safeLocalRepairAvailable: false,
        };
    }
    if (/outside this Creator micro-batch/i.test(text)) {
        return {
            reasonCode: 'outside_micro_batch',
            retryable: false,
            safeLocalRepairAvailable: false,
        };
    }
    if (/Missing|invalid|after|must define|must declare/i.test(text)) {
        return {
            reasonCode: 'invalid_schema_shape',
            retryable: true,
            safeLocalRepairAvailable: false,
        };
    }
    return {
        reasonCode: 'schema_guard_rejected',
        retryable: true,
        safeLocalRepairAvailable: false,
    };
}

export function buildLoredeckCreatorEntryRejectionDiagnostics(input = {}) {
    const errors = Array.isArray(input.errors) ? input.errors : [];
    const targetTitle = input.targetTitle || {};
    const targetTitleId = cleanString(input.targetTitleId || targetTitle.titleId || targetTitle.id || input.entryId || '', 180);
    const targetEntryId = cleanString(input.targetEntryId || targetTitle.targetEntryId || targetTitle.titleId || targetTitle.id || input.entryId || '', 180);
    return errors
        .map(error => {
            const message = cleanString(error, 700);
            if (!message) return null;
            return {
                targetTitleId,
                targetEntryId,
                title: cleanString(targetTitle.title || '', 240),
                stage: 'entry_micro_batch',
                phase: 'schema_guard',
                message,
                ...classifyGuardError(message),
            };
        })
        .filter(Boolean);
}

export function summarizeLoredeckCreatorEntryRejections(diagnostics = []) {
    const list = Array.isArray(diagnostics) ? diagnostics : [];
    const byReason = {};
    const unknownTags = new Set();
    const unknownAnchors = new Set();
    const targetIds = new Set();
    for (const diagnostic of list) {
        const code = cleanString(diagnostic?.reasonCode || 'schema_guard_rejected', 80);
        byReason[code] = (byReason[code] || 0) + 1;
        for (const tag of diagnostic?.unknownTags || []) unknownTags.add(tag);
        for (const anchor of diagnostic?.unknownAnchors || []) unknownAnchors.add(anchor);
        const targetId = cleanString(diagnostic?.targetEntryId || diagnostic?.targetTitleId || '', 180);
        if (targetId) targetIds.add(targetId);
    }
    return {
        count: list.length,
        targetCount: targetIds.size,
        targetEntryIds: [...targetIds],
        byReason,
        unknownTags: [...unknownTags],
        unknownAnchors: [...unknownAnchors],
    };
}

export function getLoredeckCreatorEntryRejectionDiagnostics(errorOrResult = {}) {
    const direct = Array.isArray(errorOrResult?.rejectionDiagnostics) ? errorOrResult.rejectionDiagnostics : [];
    const diagnostic = Array.isArray(errorOrResult?.diagnostic?.rejectionDiagnostics) ? errorOrResult.diagnostic.rejectionDiagnostics : [];
    const commit = Array.isArray(errorOrResult?.entryCommit?.rejectionDiagnostics) ? errorOrResult.entryCommit.rejectionDiagnostics : [];
    return [...direct, ...diagnostic, ...commit].filter(item => item && typeof item === 'object' && !Array.isArray(item));
}

export function buildLoredeckCreatorEntryRetryContextByTarget(errorOrResult = {}) {
    const diagnostics = getLoredeckCreatorEntryRejectionDiagnostics(errorOrResult);
    const byTarget = new Map();
    for (const diagnostic of diagnostics) {
        const targetId = cleanString(diagnostic.targetEntryId || diagnostic.targetTitleId || '', 180);
        if (!targetId) continue;
        const current = byTarget.get(targetId) || {
            targetEntryId: targetId,
            targetTitleId: cleanString(diagnostic.targetTitleId || targetId, 180),
            title: cleanString(diagnostic.title || '', 240),
            reasonCodes: [],
            unknownTags: [],
            unknownAnchors: [],
            messages: [],
            instruction: 'Correct the prior schema rejection. Use only targetTitleDraft.allowedEntryTags and accepted timeline IDs; do not emit unknown, omitted, or invented references.',
        };
        const reasonCode = cleanString(diagnostic.reasonCode || 'schema_guard_rejected', 80);
        if (reasonCode && !current.reasonCodes.includes(reasonCode)) current.reasonCodes.push(reasonCode);
        for (const tag of diagnostic.unknownTags || []) {
            const item = cleanString(tag, 140);
            if (item && !current.unknownTags.includes(item)) current.unknownTags.push(item);
        }
        for (const anchor of diagnostic.unknownAnchors || []) {
            const item = cleanString(anchor, 180);
            if (item && !current.unknownAnchors.includes(item)) current.unknownAnchors.push(item);
        }
        const message = cleanString(diagnostic.message || '', 240);
        if (message && !current.messages.includes(message)) current.messages.push(message);
        byTarget.set(targetId, current);
    }
    return byTarget;
}

export function createLoredeckCreatorEntryGuardRejectedAllError(input = {}) {
    const rejectionSummary = input.rejectionSummary || summarizeLoredeckCreatorEntryRejections(input.rejectionDiagnostics || []);
    const rejectedTargetIds = Array.isArray(input.rejectedTargetIds) && input.rejectedTargetIds.length
        ? input.rejectedTargetIds.map(id => cleanString(id, 180)).filter(Boolean)
        : (Array.isArray(rejectionSummary?.targetEntryIds) ? rejectionSummary.targetEntryIds : []);
    const count = Number(input.invalidCount || rejectionSummary?.targetCount || rejectedTargetIds.length) || rejectedTargetIds.length || 1;
    const message = input.message || `Creator Lorecard batch returned valid JSON, but Saga rejected ${count} draft${count === 1 ? '' : 's'} before Draft Review.`;
    const error = new Error(message);
    error.name = 'LoredeckCreatorEntryGuardRejectedAllError';
    error.code = LOREDECK_CREATOR_ENTRY_GUARD_REJECTED_ALL;
    error.rejectionDiagnostics = Array.isArray(input.rejectionDiagnostics) ? input.rejectionDiagnostics : [];
    error.rejectionSummary = rejectionSummary || null;
    error.rejectedTargetIds = rejectedTargetIds;
    error.retrySmallerPreferred = true;
    return error;
}

export function isLoredeckCreatorEntryGuardRejectedAllError(error = {}) {
    const code = cleanString(error?.code || error?.errorCode || error?.diagnostic?.errorCode || '', 120);
    return code === LOREDECK_CREATOR_ENTRY_GUARD_REJECTED_ALL;
}

export function getLoredeckCreatorEntryRejectedTargetIds(errorOrResult = {}) {
    const direct = Array.isArray(errorOrResult?.rejectedTargetIds) ? errorOrResult.rejectedTargetIds : [];
    const summaryIds = Array.isArray(errorOrResult?.rejectionSummary?.targetEntryIds) ? errorOrResult.rejectionSummary.targetEntryIds : [];
    const diagnosticIds = Array.isArray(errorOrResult?.diagnostic?.rejectionSummary?.targetEntryIds) ? errorOrResult.diagnostic.rejectionSummary.targetEntryIds : [];
    const resultIds = Array.isArray(errorOrResult?.entryCommit?.rejectionSummary?.targetEntryIds) ? errorOrResult.entryCommit.rejectionSummary.targetEntryIds : [];
    const out = [];
    const seen = new Set();
    for (const rawId of [...direct, ...summaryIds, ...diagnosticIds, ...resultIds]) {
        const id = cleanString(rawId, 180);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}
