/**
 * Storage-neutral model repair prompt and parser helpers.
 */

import {
    LOREDECK_HEALTH_REPAIR_SOURCES,
    LOREDECK_HEALTH_REPAIR_STRATEGIES,
    cleanRepairString,
    cloneRepairJson,
    compactRepairIdentity,
    isPlainRepairObject,
    normalizeRepairChoiceSet,
    normalizeRepairPatch,
    normalizeRepairTagIdList,
    normalizeRepairTimelineId,
} from './loredeck-health-repair-contracts.js';
import {
    getAllowedLoredeckRepairEntryFieldsForCodes,
    getAllowedLoredeckRepairOperationNamesForCodes,
    validateLoredeckRepairChoiceSet,
    validateLoredeckRepairPatch,
} from './loredeck-health-repair-validator.js';

export const DEFAULT_MODEL_REPAIR_RESPONSE_LIMIT = 200000;

function getEntryRows(pack = {}, entryIds = []) {
    const wanted = new Set(entryIds || []);
    const rows = [];
    const push = entry => {
        const id = cleanRepairString(entry?.id, 180);
        if (!id || (wanted.size && !wanted.has(id))) return;
        rows.push({
            id,
            title: cleanRepairString(entry.title || id, 180),
            category: cleanRepairString(entry.category || '', 80),
            schemaVersion: Number(entry.schemaVersion) || Number(pack.entrySchemaVersion) || 0,
            tags: normalizeRepairTagIdList(entry.tags || [], 64),
            context: cloneRepairJson(entry.context || null),
            retrieval: cloneRepairJson(entry.retrieval || null),
            content: cloneRepairJson(entry.content || null),
        });
    };
    if (isPlainRepairObject(pack.entryOverrides)) {
        for (const [id, entry] of Object.entries(pack.entryOverrides)) {
            if (isPlainRepairObject(entry)) push({ ...entry, id: entry.id || id });
        }
    }
    for (const entry of Array.isArray(pack.entries) ? pack.entries : []) push(entry);
    for (const file of Array.isArray(pack.entryFiles) ? pack.entryFiles : []) {
        for (const entry of Array.isArray(file.entries) ? file.entries : []) push(entry);
    }
    return rows.slice(0, 20);
}

function getTagRegistrySlice(pack = {}, tagIds = []) {
    const registry = isPlainRepairObject(pack.tagRegistry) ? pack.tagRegistry : {};
    const source = isPlainRepairObject(registry.tags) ? registry.tags : registry;
    const wanted = new Set(tagIds || []);
    const wantedCompact = new Set((tagIds || []).map(compactRepairIdentity).filter(Boolean));
    const rows = [];
    for (const [id, def] of Object.entries(source || {})) {
        const compactId = compactRepairIdentity(id);
        if (wanted.size && !wanted.has(id) && !wantedCompact.has(compactId) && !tagIds.some(tag => id.toLowerCase().includes(String(tag || '').toLowerCase()))) continue;
        rows.push({
            id,
            label: cleanRepairString(def?.label || id, 180),
            description: cleanRepairString(def?.description || '', 500),
            aliases: Array.isArray(def?.aliases) ? def.aliases.slice(0, 12) : [],
        });
        if (rows.length >= 50) break;
    }
    if (rows.length || !wanted.size) return rows;
    return Object.entries(source || {}).slice(0, 50).map(([id, def]) => ({
        id,
        label: cleanRepairString(def?.label || id, 180),
        description: cleanRepairString(def?.description || '', 500),
        aliases: Array.isArray(def?.aliases) ? def.aliases.slice(0, 12) : [],
    }));
}

function getTimelineSlice(pack = {}, timelineIds = []) {
    const registry = isPlainRepairObject(pack.timelineRegistry) ? pack.timelineRegistry : {};
    const wanted = new Set((timelineIds || []).map(normalizeRepairTimelineId));
    const sourceAnchors = Array.isArray(registry.anchors) ? registry.anchors : [];
    let anchorSource = sourceAnchors
        .filter(anchor => !wanted.size || wanted.has(normalizeRepairTimelineId(anchor?.id)) || wanted.has(normalizeRepairTimelineId(anchor?.anchorFrom)) || wanted.has(normalizeRepairTimelineId(anchor?.anchorTo)))
        .slice(0, 50);
    if (wanted.size && !anchorSource.length) anchorSource = sourceAnchors.slice(0, 50);
    const anchors = anchorSource.map(anchor => ({
        id: normalizeRepairTimelineId(anchor?.id),
        label: cleanRepairString(anchor?.label || anchor?.title || anchor?.id, 180),
        sortKey: Number.isFinite(Number(anchor?.sortKey)) ? Number(anchor.sortKey) : null,
    }));
    const sourceWindows = Array.isArray(registry.windows) ? registry.windows : [];
    let windowSource = sourceWindows
        .filter(window => !wanted.size || wanted.has(normalizeRepairTimelineId(window?.id)) || wanted.has(normalizeRepairTimelineId(window?.anchorFrom)) || wanted.has(normalizeRepairTimelineId(window?.anchorTo)))
        .slice(0, 30);
    if (wanted.size && !windowSource.length) windowSource = sourceWindows.slice(0, 30);
    const windows = windowSource.map(window => ({
        id: normalizeRepairTimelineId(window?.id),
        label: cleanRepairString(window?.label || window?.title || window?.id, 180),
        anchorFrom: normalizeRepairTimelineId(window?.anchorFrom),
        anchorTo: normalizeRepairTimelineId(window?.anchorTo),
        sortKeyFrom: Number.isFinite(Number(window?.sortKeyFrom)) ? Number(window.sortKeyFrom) : null,
        sortKeyTo: Number.isFinite(Number(window?.sortKeyTo)) ? Number(window.sortKeyTo) : null,
    }));
    return { anchors, windows };
}

function getAllowedOperationsForUnit(unit = {}) {
    return getAllowedLoredeckRepairOperationNamesForCodes([unit.code], {
        entryIds: unit.entryIds || [],
        tagIds: unit.tagIds || [],
        timelineIds: unit.timelineIds || [],
    });
}

function getAllowedFieldsForUnit(unit = {}) {
    return getAllowedLoredeckRepairEntryFieldsForCodes([unit.code]);
}

export function buildLoredeckModelRepairPromptPayload(pack = {}, unit = {}, plan = {}) {
    const findingIds = new Set(unit.findingIds || []);
    const findings = (Array.isArray(plan.findings) ? plan.findings : []).filter(finding => findingIds.has(finding.findingId));
    return {
        task: 'Return compact JSON repair patches or choice sets for the supplied Pack Health repair unit. Do not include prose.',
        pack: {
            packId: pack.packId || plan.packId || '',
            title: pack.title || '',
            entrySchemaVersion: Number(pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 0,
        },
        unit: {
            unitId: unit.unitId,
            strategy: unit.strategy,
            code: unit.code,
            findingIds: unit.findingIds || [],
            entryIds: unit.entryIds || [],
            tagIds: unit.tagIds || [],
            timelineIds: unit.timelineIds || [],
        },
        selectedHealthFindings: findings.map(finding => ({
            findingId: finding.findingId,
            severity: finding.severity,
            code: finding.code,
            message: finding.message,
            entryIds: finding.entryIds,
            tagIds: finding.tagIds,
            timelineIds: finding.timelineIds,
            fields: finding.fields,
        })),
        targetEntries: getEntryRows(pack, unit.entryIds || []),
        tagRegistry: getTagRegistrySlice(pack, unit.tagIds || []),
        timeline: getTimelineSlice(pack, unit.timelineIds || []),
        allowedOperations: getAllowedOperationsForUnit(unit),
        allowedFields: getAllowedFieldsForUnit(unit),
        responseLimits: {
            maxChars: DEFAULT_MODEL_REPAIR_RESPONSE_LIMIT,
        },
        outputContract: {
            repairs: [{ repairId: 'repair_1', findingIds: [], confidence: 0.9, risk: 'low', applyMode: 'direct', patch: { operations: [] }, reason: '' }],
            choices: [{ choiceSetId: 'choice_1', findingIds: [], question: '', options: [{ optionId: 'A', label: '', confidence: 0.5, patch: { operations: [] } }] }],
            warnings: [],
            clarifyingQuestions: [],
        },
        rules: [
            'Use only allowedOperations.',
            'Target only IDs listed in unit.entryIds, unit.tagIds, or unit.timelineIds.',
            'Return review choices when multiple plausible fixes exist.',
            'Return no prose outside the JSON object.',
        ],
    };
}

function stripJsonFences(text = '') {
    return String(text || '')
        .replace(/^\s*```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
}

function parseJsonObject(text = '') {
    const cleaned = stripJsonFences(text);
    try {
        return JSON.parse(cleaned);
    } catch (error) {
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(cleaned.slice(start, end + 1));
            } catch (_nested) {
                // fall through
            }
        }
        const wrapped = new Error(`Model repair response was not valid JSON: ${error.message}`);
        wrapped.code = 'model_repair_json_invalid';
        throw wrapped;
    }
}

function normalizeModelRepairPatch(row = {}) {
    const patchInput = isPlainRepairObject(row.patch) ? row.patch : {};
    return normalizeRepairPatch({
        ...patchInput,
        source: LOREDECK_HEALTH_REPAIR_SOURCES.MODEL,
        strategy: row.applyMode === 'review'
            ? LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE
            : LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
        findingIds: row.findingIds || patchInput.findingIds || [],
        confidence: row.confidence ?? patchInput.confidence,
        risk: row.risk || patchInput.risk || 'unknown',
        diagnostics: [
            ...(Array.isArray(patchInput.diagnostics) ? patchInput.diagnostics : []),
            cleanRepairString(row.reason || '', 500),
        ].filter(Boolean),
        directApply: row.applyMode !== 'review',
    });
}

function normalizeModelChoiceSet(row = {}) {
    const options = (Array.isArray(row.options) ? row.options : [])
        .filter(isPlainRepairObject)
        .map(option => {
            const patchInput = isPlainRepairObject(option.patch) ? option.patch : {};
            return {
                ...option,
                patch: {
                    ...patchInput,
                    source: LOREDECK_HEALTH_REPAIR_SOURCES.MODEL,
                    strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE,
                    findingIds: row.findingIds || patchInput.findingIds || [],
                    directApply: false,
                },
            };
        });
    return normalizeRepairChoiceSet({
        ...row,
        options,
    });
}

export function parseLoredeckModelRepairResponse(text = '', options = {}) {
    const maxChars = Math.max(1000, Number(options.maxChars) || DEFAULT_MODEL_REPAIR_RESPONSE_LIMIT);
    if (String(text || '').length > maxChars) {
        const error = new Error(`Model repair response exceeded ${maxChars} characters.`);
        error.code = 'model_repair_response_too_large';
        throw error;
    }
    const parsed = parseJsonObject(text);
    if (!isPlainRepairObject(parsed)) throw new Error('Model repair response must be a JSON object.');
    const repairs = (Array.isArray(parsed.repairs) ? parsed.repairs : [])
        .filter(isPlainRepairObject)
        .map(normalizeModelRepairPatch);
    const choices = (Array.isArray(parsed.choices) ? parsed.choices : [])
        .filter(isPlainRepairObject)
        .map(normalizeModelChoiceSet);
    return {
        repairs,
        choices,
        warnings: (Array.isArray(parsed.warnings) ? parsed.warnings : []).map(item => cleanRepairString(item, 500)).filter(Boolean),
        clarifyingQuestions: (Array.isArray(parsed.clarifyingQuestions) ? parsed.clarifyingQuestions : []).map(item => cleanRepairString(item, 500)).filter(Boolean),
    };
}

export function parseAndValidateLoredeckModelRepairResponse(pack = {}, unit = {}, plan = {}, text = '') {
    const parsed = parseLoredeckModelRepairResponse(text);
    const sourceBuckets = (Array.isArray(plan.buckets) ? plan.buckets : []).filter(bucket => bucket.bucketId === unit.bucketId);
    const unitBuckets = sourceBuckets.map(bucket => ({
        ...bucket,
        findingIds: unit.findingIds || [],
        affectedEntryIds: unit.entryIds || [],
        affectedTagIds: unit.tagIds || [],
        affectedTimelineIds: unit.timelineIds || [],
    }));
    const context = {
        findings: (Array.isArray(plan.findings) ? plan.findings : []).filter(finding => (unit.findingIds || []).includes(finding.findingId)),
        buckets: unitBuckets,
    };
    const repairs = parsed.repairs.map(patch => {
        const validation = validateLoredeckRepairPatch(pack, patch, context);
        return {
            patch,
            validation,
            directApply: validation.directApply,
        };
    });
    const choiceResults = parsed.choices.map(choice => {
        const validation = validateLoredeckRepairChoiceSet(pack, choice, context);
        return {
            choice,
            validation,
        };
    });
    const choices = choiceResults.filter(item => item.validation.ok).map(item => item.choice);
    const invalidChoices = choiceResults.filter(item => !item.validation.ok);
    return {
        ...parsed,
        repairs,
        choices,
        choiceResults,
        invalidChoices,
    };
}

export const __loredeckHealthModelRepairsTestHooks = Object.freeze({
    stripJsonFences,
    parseJsonObject,
    getEntryRows,
    getTagRegistrySlice,
    getTimelineSlice,
    getAllowedOperationsForUnit,
    getAllowedFieldsForUnit,
});
