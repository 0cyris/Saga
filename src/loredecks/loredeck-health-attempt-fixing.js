/**
 * Storage-backed Pack Health Attempt Fixing orchestrator.
 */

import {
    buildLoredeckHealthRepairPlan,
} from './loredeck-health-fix-planner.js';
import {
    buildLoredeckLocalRepairsForPlan,
} from './loredeck-health-local-repairs.js';
import {
    LOREDECK_HEALTH_REPAIR_STRATEGIES,
    cloneRepairJson,
    createRepairRunSummary,
} from './loredeck-health-repair-contracts.js';
import {
    applyPackRepairPatches,
    runPackHealth,
    updatePackHealthSummary,
} from './loredeck-health-repair-storage-adapter.js';
import {
    createLoredeckHealthRepairSession,
    writeLoredeckHealthRepairSession,
} from './loredeck-health-repair-session-storage.js';

function getStrategyBuckets(plan = {}, strategy = '') {
    return (Array.isArray(plan.buckets) ? plan.buckets : [])
        .filter(bucket => bucket.strategy === strategy)
        .map(bucket => cloneRepairJson(bucket));
}

function buildRemainingRepairState(plan = {}, local = {}) {
    const choiceSets = Array.isArray(local.choiceSets) ? local.choiceSets.map(choice => cloneRepairJson(choice)) : [];
    return {
        choiceSets,
        choiceSetCount: choiceSets.length,
        modelUnits: (Array.isArray(plan.units) ? plan.units : []).map(unit => cloneRepairJson(unit)),
        deferredUnits: (Array.isArray(plan.deferredUnits) ? plan.deferredUnits : []).map(unit => cloneRepairJson(unit)),
        modelDirectBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT),
        modelChoiceBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE),
        manualBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MANUAL_ONLY),
    };
}

function mergeDiagnostics(...groups) {
    return groups.flatMap(group => Array.isArray(group) ? group : []).map(item => cloneRepairJson(item));
}

function buildNoDirectPatchResult(input = {}) {
    const diagnostics = mergeDiagnostics(input.local?.diagnostics, input.diagnostics);
    const summary = createRepairRunSummary({
        initialHealth: input.initialHealth,
        checkpointHealth: input.finalHealth || input.initialHealth,
        finalHealth: input.finalHealth || input.initialHealth,
        initialPlan: input.initialPlan,
        checkpointPlan: input.finalPlan || input.initialPlan,
        finalPlan: input.finalPlan || input.initialPlan,
        local: input.local,
        appliedPatches: [],
        choiceSets: input.remaining?.choiceSets || [],
        diagnostics,
    });
    return {
        ok: true,
        changed: false,
        pack: input.pack,
        preflightHealth: input.initialHealth,
        finalHealth: input.finalHealth || input.initialHealth,
        initialPlan: input.initialPlan,
        finalPlan: input.finalPlan || input.initialPlan,
        local: input.local,
        appliedPatches: [],
        diagnostics,
        remaining: input.remaining,
        summary,
    };
}

async function maybePersistRepairSession(result = {}, packId = '', options = {}) {
    if (options.persistSession !== true && options.writeRepairSession !== true) return result;
    const session = createLoredeckHealthRepairSession({
        packId,
        attempt: result,
        sessionId: options.repairSessionId || options.sessionId || '',
    }, options);
    if (session.status === 'complete' && options.persistCompletedSession !== true) {
        return {
            ...result,
            session: null,
        };
    }
    const writeResult = await writeLoredeckHealthRepairSession(session, options);
    if (!writeResult.ok) {
        return {
            ...result,
            session: null,
            sessionError: writeResult.error,
            diagnostics: mergeDiagnostics(result.diagnostics, writeResult.diagnostics),
        };
    }
    return {
        ...result,
        session: writeResult.session,
        sessionPath: writeResult.path,
    };
}

export async function attemptLoredeckHealthFixes(packId = '', options = {}) {
    const preflight = await runPackHealth(packId, options);
    if (!preflight.ok) {
        return {
            ok: false,
            changed: false,
            error: preflight.error || 'Pack Health preflight failed.',
            diagnostics: preflight.diagnostics || [],
        };
    }

    const initialPlan = buildLoredeckHealthRepairPlan({
        pack: preflight.pack,
        health: preflight.health,
        batchLimits: options.batchLimits,
    });
    const initialLocal = buildLoredeckLocalRepairsForPlan(preflight.pack, initialPlan);

    if (!initialLocal.patches.length) {
        const summaryResult = options.updateHealthSummary === false
            ? { ok: true, pack: preflight.pack, health: preflight.health, diagnostics: [] }
            : await updatePackHealthSummary(packId, preflight.health, options);
        if (!summaryResult.ok) {
            return {
                ok: false,
                changed: false,
                error: summaryResult.error || 'Pack Health summary update failed.',
                diagnostics: mergeDiagnostics(preflight.diagnostics, summaryResult.diagnostics),
                preflightHealth: preflight.health,
                initialPlan,
            };
        }
        const finalPlan = buildLoredeckHealthRepairPlan({
            pack: summaryResult.pack || preflight.pack,
            health: preflight.health,
            batchLimits: options.batchLimits,
        });
        const finalLocal = buildLoredeckLocalRepairsForPlan(summaryResult.pack || preflight.pack, finalPlan);
        const remaining = buildRemainingRepairState(finalPlan, finalLocal);
        const result = buildNoDirectPatchResult({
            pack: summaryResult.pack || preflight.pack,
            initialHealth: preflight.health,
            finalHealth: preflight.health,
            initialPlan,
            finalPlan,
            local: initialLocal,
            remaining,
            diagnostics: mergeDiagnostics(preflight.diagnostics, summaryResult.diagnostics, finalLocal.diagnostics),
        });
        return maybePersistRepairSession(result, packId, options);
    }

    const applyResult = await applyPackRepairPatches(packId, initialLocal.patches, {
        ...options,
        health: preflight.health,
        plan: initialPlan,
    });
    if (!applyResult.ok) {
        return {
            ...applyResult,
            ok: false,
            changed: false,
            preflightHealth: preflight.health,
            diagnostics: mergeDiagnostics(preflight.diagnostics, initialLocal.diagnostics, applyResult.diagnostics),
        };
    }

    const finalPlan = applyResult.finalPlan || buildLoredeckHealthRepairPlan({
        pack: applyResult.pack,
        health: applyResult.afterHealth,
        batchLimits: options.batchLimits,
    });
    const finalLocal = buildLoredeckLocalRepairsForPlan(applyResult.pack, finalPlan);
    const remaining = buildRemainingRepairState(finalPlan, finalLocal);
    const diagnostics = mergeDiagnostics(preflight.diagnostics, initialLocal.diagnostics, applyResult.diagnostics, finalLocal.diagnostics);
    const summary = createRepairRunSummary({
        initialHealth: preflight.health,
        checkpointHealth: applyResult.afterHealth,
        finalHealth: applyResult.afterHealth,
        initialPlan,
        checkpointPlan: finalPlan,
        finalPlan,
        local: initialLocal,
        appliedPatches: applyResult.appliedPatches,
        choiceSets: remaining.choiceSets,
        diagnostics,
    });

    const result = {
        ok: true,
        changed: applyResult.appliedPatches.length > 0,
        pack: applyResult.pack,
        preflightHealth: preflight.health,
        finalHealth: applyResult.afterHealth,
        initialPlan,
        finalPlan,
        local: initialLocal,
        storageResult: applyResult,
        appliedPatches: applyResult.appliedPatches,
        diagnostics,
        remaining,
        summary,
    };
    return maybePersistRepairSession(result, packId, options);
}

export const __loredeckHealthAttemptFixingTestHooks = Object.freeze({
    buildRemainingRepairState,
});
