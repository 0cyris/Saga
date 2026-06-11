/**
 * Core Deck Health helpers for Saga Loredecks.
 */

export function createHealth(packId = '') {
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
            timelineCandidateCount: 0,
            timelineReferencedAnchorCount: 0,
            timelineGatesPerCandidate: 0,
            timelineDensificationSuggestionCount: 0,
            contextGateCount: 0,
            brokenAnchorReferenceCount: 0,
            invalidContextWindowCount: 0,
            unmatchableContextGateCount: 0,
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

export function addHealthIssue(health, severity, code, message, extra = {}) {
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

export function finalizeHealth(health) {
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

export function entryListFromJson(json) {
    if (Array.isArray(json?.entries)) return json.entries;
    if (Array.isArray(json)) return json;
    return [];
}

export function cleanHealthString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

export function normalizeHealthIdList(value = [], limit = 1000, maxLength = 180) {
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

export function cleanHealthNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function cleanTagIdForHealth(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, ' ')
        .slice(0, 96)
        .trim();
}

export function cleanTagLabelForHealth(value = '', maxLength = 180) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength).trim();
}

export function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function clonePlainObject(value) {
    if (!isPlainObject(value)) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_e) {
        return { ...value };
    }
}
