/**
 * Storage-neutral Pack Health repair contracts.
 */

export const LOREDECK_HEALTH_REPAIR_STRATEGIES = Object.freeze({
    LOCAL_BULK: 'local_bulk',
    LOCAL_REVIEW_CHOICE: 'local_review_choice',
    MODEL_DIRECT: 'model_direct',
    MODEL_REVIEW_CHOICE: 'model_review_choice',
    MANUAL_ONLY: 'manual_only',
});

export const LOREDECK_HEALTH_REPAIR_OPERATION_NAMES = Object.freeze({
    UPSERT_ENTRY_OVERRIDE: 'upsert_entry_override',
    UPSERT_TAG_DEFINITION: 'upsert_tag_definition',
    UPSERT_TIMELINE_ANCHOR: 'upsert_timeline_anchor',
    UPSERT_TIMELINE_WINDOW: 'upsert_timeline_window',
    REFRESH_MANIFEST_STATS: 'refresh_manifest_stats',
});

export const LOREDECK_HEALTH_REPAIR_SOURCES = Object.freeze({
    LOCAL: 'local_repair',
    MODEL: 'model_repair',
    USER_CHOICE: 'user_choice',
});

export const LOREDECK_HEALTH_REPAIR_SEVERITIES = Object.freeze([
    'error',
    'warning',
    'suggestion',
]);

const REPAIR_STRATEGY_SET = new Set(Object.values(LOREDECK_HEALTH_REPAIR_STRATEGIES));
const REPAIR_OPERATION_SET = new Set(Object.values(LOREDECK_HEALTH_REPAIR_OPERATION_NAMES));
const REPAIR_SEVERITY_SET = new Set(LOREDECK_HEALTH_REPAIR_SEVERITIES);

export function isPlainRepairObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function cloneRepairJson(value) {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        if (Array.isArray(value)) return [...value];
        if (isPlainRepairObject(value)) return { ...value };
        return value;
    }
}

export function cleanRepairString(value = '', maxLength = 500) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function cleanRepairId(value = '', maxLength = 180) {
    return cleanRepairString(value, maxLength)
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_:.-]+|[_:.-]+$/g, '')
        .slice(0, maxLength);
}

export function normalizeRepairSeverity(value = '') {
    const severity = cleanRepairString(value, 40).toLowerCase();
    return REPAIR_SEVERITY_SET.has(severity) ? severity : 'suggestion';
}

export function normalizeRepairStrategy(value = '') {
    const strategy = cleanRepairString(value, 80).toLowerCase();
    return REPAIR_STRATEGY_SET.has(strategy) ? strategy : LOREDECK_HEALTH_REPAIR_STRATEGIES.MANUAL_ONLY;
}

export function normalizeRepairOperationName(value = '') {
    const op = cleanRepairString(value, 120).toLowerCase();
    return REPAIR_OPERATION_SET.has(op) ? op : '';
}

export function normalizeRepairIdList(value = [], limit = 1000, maxLength = 180) {
    const input = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const out = [];
    const seen = new Set();
    for (const raw of input) {
        const id = cleanRepairString(raw, maxLength);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

export function normalizeRepairTagId(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/:+/g, ':')
        .replace(/^[\s:._/-]+|[\s:._/-]+$/g, '')
        .toLowerCase()
        .slice(0, 96)
        .trim();
}

export function normalizeRepairTimelineId(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '_')
        .slice(0, 180)
        .trim();
}

export function normalizeRepairTagIdList(value = [], limit = 1000) {
    const input = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const out = [];
    const seen = new Set();
    for (const raw of input) {
        const id = normalizeRepairTagId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

export function normalizeRepairTimelineIdList(value = [], limit = 1000) {
    const input = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const out = [];
    const seen = new Set();
    for (const raw of input) {
        const id = normalizeRepairTimelineId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

export function compactRepairIdentity(value = '') {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function hashRepairText(value = '') {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function collectTagIdsFromIssue(issue = {}) {
    const tags = [];
    const push = value => {
        const tag = normalizeRepairTagId(value);
        if (tag) tags.push(tag);
    };
    push(issue.tag);
    for (const tag of Array.isArray(issue.tagIds) ? issue.tagIds : []) push(tag);
    for (const tag of Array.isArray(issue.tags) ? issue.tags : []) {
        if (typeof tag === 'string') push(tag);
        else push(tag?.tag || tag?.id || '');
    }
    return normalizeRepairTagIdList(tags);
}

function collectEntryIdsFromIssue(issue = {}) {
    const ids = [];
    const push = value => {
        const id = cleanRepairString(value, 180);
        if (id) ids.push(id);
    };
    push(issue.entryId);
    for (const id of Array.isArray(issue.entryIds) ? issue.entryIds : []) push(id);
    for (const tag of Array.isArray(issue.tags) ? issue.tags : []) {
        if (!isPlainRepairObject(tag)) continue;
        for (const id of Array.isArray(tag.entryIds) ? tag.entryIds : []) push(id);
    }
    return normalizeRepairIdList(ids);
}

function collectTimelineIdsFromIssue(issue = {}) {
    return normalizeRepairTimelineIdList([
        issue.anchorId || '',
        issue.timelineWindowId || '',
        ...(Array.isArray(issue.anchorIds) ? issue.anchorIds : []),
        ...(Array.isArray(issue.timelineIds) ? issue.timelineIds : []),
    ]);
}

function buildFindingId(input = {}) {
    const seed = [
        input.packId || '',
        input.severity || '',
        input.code || '',
        input.message || '',
        input.file || '',
        (input.entryIds || []).join(','),
        (input.tagIds || []).join(','),
        (input.timelineIds || []).join(','),
        (input.fields || []).join(','),
    ].join('|');
    return `health_${hashRepairText(seed)}`;
}

export function normalizeRepairFinding(raw = {}, index = 0, options = {}) {
    const issue = isPlainRepairObject(raw) ? raw : {};
    const severity = normalizeRepairSeverity(issue.severity || options.severity);
    const code = cleanRepairId(issue.code || 'unknown_finding', 120) || 'unknown_finding';
    const packId = cleanRepairId(issue.packId || options.packId || '', 180);
    const entryIds = collectEntryIdsFromIssue(issue);
    const tagIds = collectTagIdsFromIssue(issue);
    const timelineIds = collectTimelineIdsFromIssue(issue);
    const fields = normalizeRepairIdList([
        ...(Array.isArray(issue.fields) ? issue.fields : []),
        ...(Array.isArray(issue.contextFields) ? issue.contextFields : []),
        issue.contextField || '',
    ], 100, 120);
    const normalized = {
        findingId: cleanRepairId(issue.findingId || issue.issueId || '', 160),
        packId,
        severity,
        code,
        message: cleanRepairString(issue.message || '', 1000),
        file: cleanRepairString(issue.file || '', 400),
        entryIds,
        tagIds,
        timelineIds,
        fields,
        index: Number.isFinite(Number(index)) ? Number(index) : 0,
        raw: cloneRepairJson(issue),
    };
    normalized.findingId = normalized.findingId || buildFindingId(normalized);
    return normalized;
}

export function normalizeRepairFindingsFromHealth(health = null, options = {}) {
    const report = isPlainRepairObject(health) ? health : {};
    const packId = cleanRepairId(options.packId || report.packId || report.databaseId || '', 180);
    const findings = [];
    let index = 0;
    const pushIssues = (issues = [], severity = '') => {
        for (const issue of Array.isArray(issues) ? issues : []) {
            findings.push(normalizeRepairFinding(issue, index, {
                packId,
                severity: issue?.severity || severity,
            }));
            index += 1;
        }
    };
    pushIssues(report.errors, 'error');
    pushIssues(report.warnings, 'warning');
    pushIssues(report.suggestions, 'suggestion');
    return findings;
}

function highestSeverity(findings = []) {
    const order = { error: 3, warning: 2, suggestion: 1 };
    let current = 'suggestion';
    for (const finding of findings || []) {
        if ((order[finding?.severity] || 0) > (order[current] || 0)) current = finding.severity;
    }
    return current;
}

function buildBucketId(input = {}) {
    const seed = [
        input.packId || '',
        input.strategy || '',
        input.code || '',
        input.targetKind || '',
        (input.findingIds || []).join(','),
        (input.affectedEntryIds || []).join(','),
        (input.affectedTagIds || []).join(','),
        (input.affectedTimelineIds || []).join(','),
    ].join('|');
    return `bucket_${hashRepairText(seed)}`;
}

export function normalizeRepairBucket(raw = {}, findingsById = new Map()) {
    const input = isPlainRepairObject(raw) ? raw : {};
    const findingIds = normalizeRepairIdList(input.findingIds);
    const findings = findingIds.map(id => findingsById.get(id)).filter(Boolean);
    const code = cleanRepairId(input.code || findings[0]?.code || 'unknown_finding', 120) || 'unknown_finding';
    const strategy = normalizeRepairStrategy(input.strategy);
    const affectedEntryIds = normalizeRepairIdList([
        ...(Array.isArray(input.affectedEntryIds) ? input.affectedEntryIds : []),
        ...findings.flatMap(finding => finding.entryIds || []),
    ]);
    const affectedTagIds = normalizeRepairTagIdList([
        ...(Array.isArray(input.affectedTagIds) ? input.affectedTagIds : []),
        ...findings.flatMap(finding => finding.tagIds || []),
    ]);
    const affectedTimelineIds = normalizeRepairTimelineIdList([
        ...(Array.isArray(input.affectedTimelineIds) ? input.affectedTimelineIds : []),
        ...findings.flatMap(finding => finding.timelineIds || []),
    ]);
    const normalized = {
        bucketId: cleanRepairId(input.bucketId || '', 180),
        packId: cleanRepairId(input.packId || findings[0]?.packId || '', 180),
        strategy,
        code,
        severity: normalizeRepairSeverity(input.severity || highestSeverity(findings)),
        targetKind: cleanRepairId(input.targetKind || inferBucketTargetKind({ affectedEntryIds, affectedTagIds, affectedTimelineIds }), 80),
        findingIds,
        affectedEntryIds,
        affectedTagIds,
        affectedTimelineIds,
        estimatedUnits: Math.max(0, Math.round(Number(input.estimatedUnits) || 0)),
        reason: cleanRepairString(input.reason || '', 500),
    };
    normalized.bucketId = normalized.bucketId || buildBucketId(normalized);
    return normalized;
}

function inferBucketTargetKind(input = {}) {
    if (input.affectedEntryIds?.length) return 'entry';
    if (input.affectedTagIds?.length) return 'tag';
    if (input.affectedTimelineIds?.length) return 'timeline';
    return 'pack';
}

export function normalizeRepairOperation(raw = {}) {
    const input = isPlainRepairObject(raw) ? raw : {};
    return {
        op: normalizeRepairOperationName(input.op),
        entryId: cleanRepairString(input.entryId || '', 180),
        tagId: normalizeRepairTagId(input.tagId || ''),
        timelineId: normalizeRepairTimelineId(input.timelineId || input.anchorId || input.windowId || ''),
        fields: normalizeRepairIdList(input.fields || [], 100, 120),
        entry: cloneRepairJson(input.entry),
        tagDefinition: cloneRepairJson(input.tagDefinition),
        timelineAnchor: cloneRepairJson(input.timelineAnchor),
        timelineWindow: cloneRepairJson(input.timelineWindow),
        stats: cloneRepairJson(input.stats),
        before: cloneRepairJson(input.before),
        after: cloneRepairJson(input.after),
        requiresConfirmation: input.requiresConfirmation === true,
    };
}

export function normalizeRepairPatch(raw = {}) {
    const input = isPlainRepairObject(raw) ? raw : {};
    const operations = (Array.isArray(input.operations) ? input.operations : [])
        .map(normalizeRepairOperation)
        .filter(operation => operation.op);
    const findingIds = normalizeRepairIdList(input.findingIds || []);
    const strategy = normalizeRepairStrategy(input.strategy);
    const source = cleanRepairId(input.source || LOREDECK_HEALTH_REPAIR_SOURCES.LOCAL, 80);
    const seed = [
        source,
        strategy,
        findingIds.join(','),
        JSON.stringify(operations),
    ].join('|');
    return {
        patchId: cleanRepairId(input.patchId || `patch_${hashRepairText(seed)}`, 180),
        source,
        strategy,
        findingIds,
        confidence: clampRepairNumber(input.confidence, 0, 1, source === LOREDECK_HEALTH_REPAIR_SOURCES.LOCAL ? 1 : 0),
        risk: cleanRepairId(input.risk || 'unknown', 40),
        operations,
        diagnostics: normalizeRepairIdList(input.diagnostics || [], 100, 500),
        directApply: input.directApply !== false,
    };
}

export function normalizeRepairChoiceSet(raw = {}) {
    const input = isPlainRepairObject(raw) ? raw : {};
    const options = (Array.isArray(input.options) ? input.options : [])
        .map((option, index) => normalizeRepairChoiceOption(option, index))
        .filter(option => option.optionId);
    const findingIds = normalizeRepairIdList(input.findingIds || []);
    const seed = [
        input.question || '',
        findingIds.join(','),
        JSON.stringify(options.map(option => option.label)),
    ].join('|');
    return {
        choiceSetId: cleanRepairId(input.choiceSetId || `choice_${hashRepairText(seed)}`, 180),
        findingIds,
        severity: normalizeRepairSeverity(input.severity),
        code: cleanRepairId(input.code || '', 120),
        question: cleanRepairString(input.question || 'Choose a repair option.', 500),
        reason: cleanRepairString(input.reason || '', 500),
        options,
    };
}

function normalizeRepairChoiceOption(raw = {}, index = 0) {
    const input = isPlainRepairObject(raw) ? raw : {};
    const optionId = cleanRepairId(input.optionId || input.id || String.fromCharCode(65 + index), 40);
    return {
        optionId,
        label: cleanRepairString(input.label || optionId, 160),
        confidence: clampRepairNumber(input.confidence, 0, 1, 0),
        reason: cleanRepairString(input.reason || '', 500),
        patch: normalizeRepairPatch(input.patch || {}),
    };
}

export function clampRepairNumber(value, min, max, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
}

export function createRepairPlanSummary(plan = {}) {
    const buckets = Array.isArray(plan.buckets) ? plan.buckets : [];
    const units = Array.isArray(plan.units) ? plan.units : [];
    const deferredUnits = Array.isArray(plan.deferredUnits) ? plan.deferredUnits : [];
    const summary = {
        findingCount: Array.isArray(plan.findings) ? plan.findings.length : 0,
        bucketCount: buckets.length,
        localBulkCount: 0,
        localChoiceCount: 0,
        modelDirectCount: 0,
        modelChoiceCount: 0,
        manualOnlyCount: 0,
        modelUnitCount: units.length,
        deferredModelUnitCount: deferredUnits.length,
        totalModelUnitCount: units.length + deferredUnits.length,
        affectedEntryCount: 0,
        affectedTagCount: 0,
        affectedTimelineCount: 0,
    };
    const entries = new Set();
    const tags = new Set();
    const timeline = new Set();
    for (const bucket of buckets) {
        if (bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK) summary.localBulkCount += 1;
        else if (bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE) summary.localChoiceCount += 1;
        else if (bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT) summary.modelDirectCount += 1;
        else if (bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE) summary.modelChoiceCount += 1;
        else if (bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.MANUAL_ONLY) summary.manualOnlyCount += 1;
        for (const id of bucket.affectedEntryIds || []) entries.add(id);
        for (const id of bucket.affectedTagIds || []) tags.add(id);
        for (const id of bucket.affectedTimelineIds || []) timeline.add(id);
    }
    summary.affectedEntryCount = entries.size;
    summary.affectedTagCount = tags.size;
    summary.affectedTimelineCount = timeline.size;
    return summary;
}

function readRepairSummaryCount(summary = {}, key = '', fallback = 0) {
    const value = Number(summary[key]);
    if (Number.isFinite(value)) return Math.max(0, Math.round(value));
    const fallbackValue = Number(fallback);
    return Number.isFinite(fallbackValue) ? Math.max(0, Math.round(fallbackValue)) : 0;
}

function countRepairIssueList(health = {}, key = '') {
    return Array.isArray(health[key]) ? health[key].length : 0;
}

export function createRepairHealthSnapshotSummary(health = {}) {
    const report = isPlainRepairObject(health) ? health : {};
    const summary = isPlainRepairObject(report.summary) ? report.summary : {};
    const errorCount = readRepairSummaryCount(summary, 'errorCount', countRepairIssueList(report, 'errors'));
    const warningCount = readRepairSummaryCount(summary, 'warningCount', countRepairIssueList(report, 'warnings'));
    const suggestionCount = readRepairSummaryCount(summary, 'suggestionCount', countRepairIssueList(report, 'suggestions'));
    const issueCount = errorCount + warningCount + suggestionCount;
    return {
        status: cleanRepairId(report.status || (errorCount ? 'errors' : issueCount ? 'needs_review' : 'good'), 80),
        errorCount,
        warningCount,
        suggestionCount,
        issueCount,
        schemaV3IssueCount: readRepairSummaryCount(summary, 'schemaV3IssueCount', 0),
        undefinedTagCount: readRepairSummaryCount(summary, 'undefinedTagCount', 0),
        brokenAnchorReferenceCount: readRepairSummaryCount(summary, 'brokenAnchorReferenceCount', 0),
        unmatchableContextGateCount: readRepairSummaryCount(summary, 'unmatchableContextGateCount', 0),
        manifestStatsMismatchCount: readRepairSummaryCount(summary, 'manifestStatsMismatchCount', 0),
    };
}

function createHealthDelta(before = {}, after = {}) {
    return {
        errorCount: after.errorCount - before.errorCount,
        warningCount: after.warningCount - before.warningCount,
        suggestionCount: after.suggestionCount - before.suggestionCount,
        issueCount: after.issueCount - before.issueCount,
        resolvedErrorCount: Math.max(0, before.errorCount - after.errorCount),
        resolvedWarningCount: Math.max(0, before.warningCount - after.warningCount),
        resolvedSuggestionCount: Math.max(0, before.suggestionCount - after.suggestionCount),
        resolvedIssueCount: Math.max(0, before.issueCount - after.issueCount),
    };
}

function getPlanSummary(plan = {}) {
    if (isPlainRepairObject(plan.summary)) return cloneRepairJson(plan.summary);
    return createRepairPlanSummary(plan);
}

function inferRepairRunOutcome(finalHealth = {}, planSummary = {}, choiceSetCount = 0, diagnosticCount = 0) {
    if (finalHealth.errorCount === 0 && finalHealth.warningCount === 0 && finalHealth.suggestionCount === 0) return 'clean';
    if (choiceSetCount > 0) return 'needs_review';
    if ((planSummary.modelDirectCount || 0) + (planSummary.modelChoiceCount || 0) > 0) return 'model_pending';
    if ((planSummary.manualOnlyCount || 0) > 0) return 'manual_remaining';
    if (diagnosticCount > 0) return 'blocked';
    return 'unresolved';
}

export function createRepairRunSummary(input = {}) {
    const local = isPlainRepairObject(input.local) ? input.local : {};
    const initialHealth = createRepairHealthSnapshotSummary(input.initialHealth);
    const checkpointHealth = createRepairHealthSnapshotSummary(input.checkpointHealth || input.initialHealth);
    const finalHealth = createRepairHealthSnapshotSummary(input.finalHealth || input.checkpointHealth || input.initialHealth);
    const initialPlan = getPlanSummary(input.initialPlan);
    const checkpointPlan = getPlanSummary(input.checkpointPlan || input.initialPlan);
    const finalPlan = getPlanSummary(input.finalPlan || input.checkpointPlan || input.initialPlan);
    const choiceSetCount = Array.isArray(input.choiceSets)
        ? input.choiceSets.length
        : readRepairSummaryCount({}, '', (Array.isArray(local.choiceSets) ? local.choiceSets.length : 0));
    const diagnosticCount = Array.isArray(input.diagnostics) ? input.diagnostics.length : 0;
    return {
        outcome: inferRepairRunOutcome(finalHealth, finalPlan, choiceSetCount, diagnosticCount),
        initialHealth,
        checkpointHealth,
        finalHealth,
        healthDelta: createHealthDelta(initialHealth, finalHealth),
        checkpointDelta: createHealthDelta(initialHealth, checkpointHealth),
        initialPlan,
        checkpointPlan,
        finalPlan,
        localPatchCount: Array.isArray(local.patches) ? local.patches.length : 0,
        localChoiceSetCount: Array.isArray(local.choiceSets) ? local.choiceSets.length : 0,
        modelResultCount: Array.isArray(input.modelResults) ? input.modelResults.length : 0,
        appliedPatchCount: Array.isArray(input.appliedPatches) ? input.appliedPatches.length : 0,
        choiceSetCount,
        diagnosticCount,
        deferredModelUnitCount: finalPlan.deferredModelUnitCount || 0,
        totalModelUnitCount: finalPlan.totalModelUnitCount || finalPlan.modelUnitCount || 0,
    };
}
