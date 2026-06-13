/**
 * In-memory Pack Health repair simulator for Stage 1 tests.
 */

import {
    LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
    cloneRepairJson,
    createRepairRunSummary,
    isPlainRepairObject,
} from './loredeck-health-repair-contracts.js';
import {
    buildLoredeckHealthRepairPlan,
} from './loredeck-health-fix-planner.js';
import {
    buildLoredeckLocalRepairsForPlan,
} from './loredeck-health-local-repairs.js';
import {
    parseAndValidateLoredeckModelRepairResponse,
} from './loredeck-health-model-repairs.js';
import {
    validateLoredeckRepairPatch,
} from './loredeck-health-repair-validator.js';

function upsertEntryOnSnapshot(next = {}, entryId = '', entry = {}) {
    const normalizedEntry = {
        ...cloneRepairJson(entry),
        id: entry.id || entryId,
    };
    const id = normalizedEntry.id || entryId;
    let updated = false;

    if (isPlainRepairObject(next.entryOverrides) && Object.hasOwn(next.entryOverrides, id)) {
        next.entryOverrides[id] = normalizedEntry;
        updated = true;
    }

    if (Array.isArray(next.entries)) {
        const index = next.entries.findIndex(item => item?.id === id);
        if (index >= 0) {
            next.entries[index] = normalizedEntry;
            updated = true;
        }
    }

    for (const file of Array.isArray(next.entryFiles) ? next.entryFiles : []) {
        if (!Array.isArray(file.entries)) continue;
        const index = file.entries.findIndex(item => item?.id === id);
        if (index >= 0) {
            file.entries[index] = normalizedEntry;
            updated = true;
        }
    }

    if (!updated) {
        if (!isPlainRepairObject(next.entryOverrides)) next.entryOverrides = {};
        next.entryOverrides[id] = normalizedEntry;
    }
}

export function applyLoredeckRepairPatchToSnapshot(pack = {}, patch = {}) {
    const next = cloneRepairJson(pack) || {};
    for (const operation of Array.isArray(patch.operations) ? patch.operations : []) {
        if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE) {
            const entry = cloneRepairJson(operation.entry);
            if (entry?.id || operation.entryId) {
                upsertEntryOnSnapshot(next, operation.entryId || entry.id, entry);
            }
        } else if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TAG_DEFINITION) {
            if (!isPlainRepairObject(next.tagRegistry)) next.tagRegistry = { schemaVersion: 1, tags: {} };
            if (!isPlainRepairObject(next.tagRegistry.tags)) next.tagRegistry.tags = {};
            next.tagRegistry.tags[operation.tagId] = cloneRepairJson(operation.tagDefinition) || {};
        } else if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_ANCHOR) {
            if (!isPlainRepairObject(next.timelineRegistry)) next.timelineRegistry = { schemaVersion: 1, anchors: [], windows: [] };
            if (!Array.isArray(next.timelineRegistry.anchors)) next.timelineRegistry.anchors = [];
            const anchor = cloneRepairJson(operation.timelineAnchor) || {};
            const id = operation.timelineId || anchor.id;
            const index = next.timelineRegistry.anchors.findIndex(item => item?.id === id);
            if (index >= 0) next.timelineRegistry.anchors[index] = { ...anchor, id };
            else next.timelineRegistry.anchors.push({ ...anchor, id });
        } else if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_WINDOW) {
            if (!isPlainRepairObject(next.timelineRegistry)) next.timelineRegistry = { schemaVersion: 1, anchors: [], windows: [] };
            if (!Array.isArray(next.timelineRegistry.windows)) next.timelineRegistry.windows = [];
            const window = cloneRepairJson(operation.timelineWindow) || {};
            const id = operation.timelineId || window.id;
            const index = next.timelineRegistry.windows.findIndex(item => item?.id === id);
            if (index >= 0) next.timelineRegistry.windows[index] = { ...window, id };
            else next.timelineRegistry.windows.push({ ...window, id });
        } else if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS) {
            const stats = cloneRepairJson(operation.stats) || next.stats || {};
            next.stats = stats;
            if (!isPlainRepairObject(next.manifestData)) next.manifestData = {};
            next.manifestData.stats = cloneRepairJson(stats);
        }
    }
    return next;
}

export function simulateLoredeckHealthRepair(options = {}) {
    const initialPack = cloneRepairJson(options.pack) || {};
    const initialHealth = cloneRepairJson(options.health) || {};
    const healthEvaluator = typeof options.healthEvaluator === 'function' ? options.healthEvaluator : null;
    const modelResponses = options.modelResponses instanceof Map
        ? options.modelResponses
        : new Map(Object.entries(options.modelResponses || {}));
    const diagnostics = [];
    const appliedPatches = [];
    let workingPack = initialPack;
    const initialPlan = buildLoredeckHealthRepairPlan({ pack: workingPack, health: initialHealth, batchLimits: options.batchLimits });
    const local = buildLoredeckLocalRepairsForPlan(workingPack, initialPlan);
    const localChoiceSets = [...local.choiceSets];

    for (const patch of local.patches) {
        const validation = validateLoredeckRepairPatch(workingPack, patch, {
            findings: initialPlan.findings,
            buckets: initialPlan.buckets,
        });
        if (!validation.directApply) {
            diagnostics.push(...validation.diagnostics);
            continue;
        }
        workingPack = applyLoredeckRepairPatchToSnapshot(workingPack, patch);
        appliedPatches.push(patch);
    }

    const checkpointHealth = healthEvaluator ? healthEvaluator(workingPack) : initialHealth;
    const checkpointPlan = healthEvaluator
        ? buildLoredeckHealthRepairPlan({ pack: workingPack, health: checkpointHealth, batchLimits: options.batchLimits })
        : initialPlan;
    const modelResults = [];
    const modelChoiceSets = [];

    for (const unit of checkpointPlan.units || []) {
        const response = modelResponses.get(unit.unitId) || modelResponses.get(unit.code);
        if (!response) continue;
        const parsed = parseAndValidateLoredeckModelRepairResponse(workingPack, unit, checkpointPlan, response);
        modelResults.push({ unit, parsed });
        for (const item of parsed.repairs) {
            if (!item.directApply) {
                diagnostics.push(...item.validation.diagnostics);
                continue;
            }
            workingPack = applyLoredeckRepairPatchToSnapshot(workingPack, item.patch);
            appliedPatches.push(item.patch);
        }
        for (const item of parsed.invalidChoices || []) {
            diagnostics.push(...item.validation.diagnostics);
        }
        modelChoiceSets.push(...parsed.choices);
    }

    const finalHealth = healthEvaluator ? healthEvaluator(workingPack) : checkpointHealth;
    const finalPlan = healthEvaluator
        ? buildLoredeckHealthRepairPlan({ pack: workingPack, health: finalHealth, batchLimits: options.batchLimits })
        : checkpointPlan;
    const choiceSets = [...localChoiceSets, ...modelChoiceSets];
    const summary = createRepairRunSummary({
        initialHealth,
        checkpointHealth,
        finalHealth,
        initialPlan,
        checkpointPlan,
        finalPlan,
        local,
        modelResults,
        appliedPatches,
        choiceSets,
        diagnostics,
    });
    return {
        initialPack,
        initialHealth,
        initialPlan,
        local,
        checkpointHealth,
        checkpointPlan,
        modelResults,
        finalPack: workingPack,
        finalHealth,
        finalPlan,
        appliedPatches,
        choiceSets,
        diagnostics,
        summary,
    };
}
