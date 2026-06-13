/**
 * Storage-backed Pack Health review choice application.
 */

import {
    buildLoredeckHealthRepairPlan,
} from './loredeck-health-fix-planner.js';
import {
    buildLoredeckLocalRepairsForPlan,
} from './loredeck-health-local-repairs.js';
import {
    LOREDECK_HEALTH_REPAIR_SOURCES,
    LOREDECK_HEALTH_REPAIR_STRATEGIES,
    cleanRepairId,
    cloneRepairJson,
    createRepairRunSummary,
    normalizeRepairChoiceSet,
    normalizeRepairPatch,
} from './loredeck-health-repair-contracts.js';
import {
    applyPackRepairPatches,
    runPackHealth,
} from './loredeck-health-repair-storage-adapter.js';
import {
    createLoredeckHealthRepairSession,
    deleteLoredeckHealthRepairSession,
    readLoredeckHealthRepairSession,
    writeLoredeckHealthRepairSession,
} from './loredeck-health-repair-session-storage.js';

function mergeDiagnostics(...groups) {
    return groups.flatMap(group => Array.isArray(group) ? group : []).map(item => cloneRepairJson(item));
}

function getChoiceFindingIdSet(choiceSets = []) {
    const out = new Set();
    for (const choice of Array.isArray(choiceSets) ? choiceSets : []) {
        for (const findingId of choice?.findingIds || []) out.add(findingId);
    }
    return out;
}

function intersects(values = [], wanted = new Set()) {
    return values.some(value => wanted.has(value));
}

function getStrategyBuckets(plan = {}, strategy = '', excludedFindingIds = new Set()) {
    return (Array.isArray(plan.buckets) ? plan.buckets : [])
        .filter(bucket => bucket.strategy === strategy)
        .filter(bucket => !intersects(bucket.findingIds || [], excludedFindingIds))
        .map(bucket => cloneRepairJson(bucket));
}

function mergeChoiceSets(existing = [], incoming = []) {
    const out = [];
    const seen = new Set();
    for (const raw of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
        const choice = normalizeRepairChoiceSet(raw);
        if (!choice.choiceSetId || seen.has(choice.choiceSetId)) continue;
        seen.add(choice.choiceSetId);
        out.push(choice);
    }
    return out;
}

function getActiveFindingIdSet(plan = {}) {
    const out = new Set();
    for (const finding of Array.isArray(plan.findings) ? plan.findings : []) {
        if (finding?.findingId) out.add(finding.findingId);
    }
    return out;
}

function keepChoiceForActiveFindings(choice = {}, activeFindingIds = new Set()) {
    const findingIds = Array.isArray(choice.findingIds) ? choice.findingIds : [];
    if (!findingIds.length) return activeFindingIds.size > 0;
    return intersects(findingIds, activeFindingIds);
}

function buildRemainingRepairStateForPack(pack = {}, plan = {}, previousRemaining = {}, selectedChoiceSetId = '') {
    const activeFindingIds = getActiveFindingIdSet(plan);
    const previousChoices = Array.isArray(previousRemaining.choiceSets) ? previousRemaining.choiceSets : [];
    const keptPreviousChoices = previousChoices
        .filter(choice => choice?.choiceSetId !== selectedChoiceSetId)
        .filter(choice => keepChoiceForActiveFindings(choice, activeFindingIds));
    const local = buildLoredeckLocalRepairsForPlan(pack, plan);
    const choiceSets = mergeChoiceSets(keptPreviousChoices, local.choiceSets);
    const excludedFindingIds = getChoiceFindingIdSet(choiceSets);
    const includeUnit = unit => !intersects(unit.findingIds || [], excludedFindingIds);
    return {
        choiceSets,
        choiceSetCount: choiceSets.length,
        modelUnits: (Array.isArray(plan.units) ? plan.units : []).filter(includeUnit).map(unit => cloneRepairJson(unit)),
        deferredUnits: (Array.isArray(plan.deferredUnits) ? plan.deferredUnits : []).filter(includeUnit).map(unit => cloneRepairJson(unit)),
        modelProgress: (Array.isArray(previousRemaining.modelProgress) ? previousRemaining.modelProgress : []).map(progress => cloneRepairJson(progress)),
        modelDirectBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT, excludedFindingIds),
        modelChoiceBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE, excludedFindingIds),
        manualBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MANUAL_ONLY),
    };
}

function hasErrorDiagnostics(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : []).some(item => {
        const severity = cleanRepairId(item?.severity || '', 40);
        return severity === 'error' || severity === 'danger';
    });
}

function findChoiceSet(session = {}, choiceSetId = '') {
    const id = cleanRepairId(choiceSetId || '', 180);
    return (session.remaining?.choiceSets || []).find(choice => choice?.choiceSetId === id) || null;
}

function findChoiceOption(choice = {}, optionId = '') {
    const id = cleanRepairId(optionId || '', 40);
    return (choice.options || []).find(option => option?.optionId === id) || null;
}

function buildSelectedChoicePatch(choice = {}, option = {}) {
    const patch = normalizeRepairPatch({
        ...(option.patch || {}),
        source: LOREDECK_HEALTH_REPAIR_SOURCES.USER_CHOICE,
        findingIds: option.patch?.findingIds?.length ? option.patch.findingIds : choice.findingIds,
        directApply: true,
        diagnostics: [
            ...(Array.isArray(option.patch?.diagnostics) ? option.patch.diagnostics : []),
            option.reason || choice.reason || '',
        ].filter(Boolean),
    });
    return {
        ...patch,
        directApply: true,
    };
}

async function loadChoiceSession(packId = '', input = {}, options = {}) {
    if (input.session) {
        return {
            ok: true,
            session: input.session,
            path: input.sessionPath || input.session.sessionFile || '',
        };
    }
    const sessionRef = input.sessionPath || input.sessionFile || input.sessionId || '';
    if (!sessionRef) {
        return {
            ok: false,
            error: 'Applying a repair choice needs a saved repair session.',
            diagnostics: [{ severity: 'error', code: 'repair_choice_missing_session', message: 'Applying a repair choice needs a saved repair session.' }],
        };
    }
    const readResult = String(sessionRef).startsWith('/user/files/')
        ? await readLoredeckHealthRepairSession(sessionRef, options)
        : await readLoredeckHealthRepairSession(packId, sessionRef, options);
    return readResult;
}

async function persistChoiceSession(result = {}, baseSession = {}, options = {}) {
    const session = createLoredeckHealthRepairSession({
        ...baseSession,
        status: result.summary?.outcome,
        outcome: result.summary?.outcome,
        updatedAt: options.now,
        summary: result.summary,
        remaining: result.remaining,
        diagnostics: result.diagnostics,
        appliedPatchIds: [
            ...(Array.isArray(baseSession.appliedPatchIds) ? baseSession.appliedPatchIds : []),
            ...(Array.isArray(result.appliedPatches) ? result.appliedPatches.map(patch => patch?.patchId).filter(Boolean) : []),
        ],
    }, options);
    const hasRemaining = (Number(session.remaining?.choiceSetCount) || 0)
        + (Number(session.remaining?.modelUnits?.length) || 0)
        + (Number(session.remaining?.deferredUnits?.length) || 0)
        + (Number(session.remaining?.manualBuckets?.length) || 0);
    if (session.status === 'complete' && !hasRemaining && !hasErrorDiagnostics(session.diagnostics) && options.persistCompletedSession !== true) {
        await deleteLoredeckHealthRepairSession(baseSession.sessionFile || session, options);
        return {
            session: null,
            sessionPath: '',
            deletedSession: true,
        };
    }
    const writeResult = await writeLoredeckHealthRepairSession(session, options);
    if (!writeResult.ok) {
        return {
            session: null,
            sessionPath: '',
            sessionError: writeResult.error,
            diagnostics: writeResult.diagnostics || [],
        };
    }
    return {
        session: writeResult.session,
        sessionPath: writeResult.path,
        deletedSession: false,
    };
}

export async function applyLoredeckHealthRepairChoice(packId = '', input = {}, options = {}) {
    const id = cleanRepairId(packId || input.packId || input.session?.packId || '', 180);
    if (!id) {
        return {
            ok: false,
            changed: false,
            error: 'Applying a repair choice needs a Loredeck pack id.',
            diagnostics: [{ severity: 'error', code: 'repair_choice_missing_pack_id', message: 'Applying a repair choice needs a Loredeck pack id.' }],
        };
    }

    const sessionResult = await loadChoiceSession(id, input, options);
    if (!sessionResult.ok) {
        return {
            ok: false,
            changed: false,
            error: sessionResult.error || 'Repair choice session could not be loaded.',
            diagnostics: sessionResult.diagnostics || [],
        };
    }

    const session = sessionResult.session || {};
    const choice = findChoiceSet(session, input.choiceSetId || input.choice?.choiceSetId || '');
    if (!choice) {
        return {
            ok: false,
            changed: false,
            session,
            sessionPath: sessionResult.path || session.sessionFile || '',
            error: 'Repair choice set was not found in this session.',
            diagnostics: [{ severity: 'error', code: 'repair_choice_not_found', message: 'Repair choice set was not found in this session.' }],
        };
    }
    const option = findChoiceOption(choice, input.optionId || input.option?.optionId || '');
    if (!option) {
        return {
            ok: false,
            changed: false,
            session,
            sessionPath: sessionResult.path || session.sessionFile || '',
            choice,
            error: 'Repair choice option was not found in this session.',
            diagnostics: [{ severity: 'error', code: 'repair_choice_option_not_found', message: 'Repair choice option was not found in this session.' }],
        };
    }

    const preflight = await runPackHealth(id, options);
    if (!preflight.ok) {
        return {
            ok: false,
            changed: false,
            session,
            sessionPath: sessionResult.path || session.sessionFile || '',
            error: preflight.error || 'Pack Health preflight failed.',
            diagnostics: preflight.diagnostics || [],
        };
    }
    const initialPlan = buildLoredeckHealthRepairPlan({
        pack: preflight.pack,
        health: preflight.health,
        batchLimits: options.batchLimits,
    });
    const patch = buildSelectedChoicePatch(choice, option);
    const applyResult = await applyPackRepairPatches(id, [patch], {
        ...options,
        health: preflight.health,
        plan: initialPlan,
    });
    if (!applyResult.ok) {
        return {
            ...applyResult,
            ok: false,
            changed: false,
            session,
            sessionPath: sessionResult.path || session.sessionFile || '',
            choice,
            option,
            preflightHealth: preflight.health,
            diagnostics: mergeDiagnostics(preflight.diagnostics, applyResult.diagnostics),
        };
    }

    const finalPlan = applyResult.finalPlan || buildLoredeckHealthRepairPlan({
        pack: applyResult.pack,
        health: applyResult.afterHealth,
        batchLimits: options.batchLimits,
    });
    const remaining = buildRemainingRepairStateForPack(applyResult.pack, finalPlan, session.remaining || {}, choice.choiceSetId);
    const diagnostics = mergeDiagnostics(preflight.diagnostics, applyResult.diagnostics);
    const summary = createRepairRunSummary({
        initialHealth: preflight.health,
        checkpointHealth: applyResult.afterHealth,
        finalHealth: applyResult.afterHealth,
        initialPlan,
        checkpointPlan: finalPlan,
        finalPlan,
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
        storageResult: applyResult,
        appliedPatches: applyResult.appliedPatches,
        choice,
        option,
        remaining,
        diagnostics,
        summary,
    };
    const persistResult = await persistChoiceSession(result, {
        ...session,
        sessionFile: sessionResult.path || session.sessionFile || '',
    }, options);
    return {
        ...result,
        session: persistResult.session,
        sessionPath: persistResult.sessionPath,
        deletedSession: persistResult.deletedSession === true,
        sessionError: persistResult.sessionError || '',
        diagnostics: mergeDiagnostics(result.diagnostics, persistResult.diagnostics),
    };
}

export const __loredeckHealthReviewChoicesTestHooks = Object.freeze({
    buildRemainingRepairStateForPack,
    buildSelectedChoicePatch,
});
