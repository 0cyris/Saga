/**
 * Storage-backed Loredeck Health model repair batch runner.
 */

import {
    runGenerationUnits,
} from '../generation/generation-job-runner.js';
import {
    buildLoredeckHealthRepairPlan,
} from './loredeck-health-fix-planner.js';
import {
    buildLoredeckModelRepairPromptPayload,
    parseAndValidateLoredeckModelRepairResponse,
} from './loredeck-health-model-repairs.js';
import {
    LOREDECK_HEALTH_REPAIR_STRATEGIES,
    cleanRepairId,
    cleanRepairString,
    cloneRepairJson,
    createRepairRunSummary,
    isPlainRepairObject,
    normalizeRepairChoiceSet,
    normalizeRepairIdList,
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

const DEFAULT_MODEL_REPAIR_MAX_UNITS = 8;
const MODEL_REPAIR_MAX_UNIT_CAP = 100;

function nowValue(options = {}) {
    if (typeof options.now === 'function') return Number(options.now()) || Date.now();
    if (options.now !== undefined) return Number(options.now) || Date.now();
    return Date.now();
}

function clampUnitCount(value, fallback = DEFAULT_MODEL_REPAIR_MAX_UNITS) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(1, Math.min(MODEL_REPAIR_MAX_UNIT_CAP, Math.round(number)));
}

function mergeDiagnostics(...groups) {
    return groups.flatMap(group => Array.isArray(group) ? group : []).map(item => cloneRepairJson(item));
}

function hasErrorDiagnostics(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : []).some(item => {
        const severity = cleanRepairId(item?.severity || '', 40);
        return severity === 'error' || severity === 'danger';
    });
}

function normalizeRunnerDiagnostic(input = {}, fallbackCode = 'model_repair_runner_diagnostic') {
    if (typeof input === 'string') {
        return {
            severity: 'info',
            code: fallbackCode,
            message: cleanRepairString(input, 1000),
        };
    }
    const raw = isPlainRepairObject(input) ? input : {};
    return {
        severity: cleanRepairId(raw.severity || 'info', 40),
        code: cleanRepairId(raw.code || fallbackCode, 120),
        message: cleanRepairString(raw.message || raw.error || '', 1000),
        ...(raw.entryId ? { entryId: cleanRepairString(raw.entryId, 180) } : {}),
        ...(raw.findingId ? { findingId: cleanRepairId(raw.findingId, 180) } : {}),
    };
}

function readModelRepairResponseText(value = '') {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return String(value || '');
    if (typeof value.text === 'string') return value.text;
    if (typeof value.responseText === 'string') return value.responseText;
    if (typeof value.content === 'string') return value.content;
    if (typeof value.message?.content === 'string') return value.message.content;
    if (typeof value.raw === 'string') return value.raw;
    return JSON.stringify(value);
}

function firstCleanResponseValue(...values) {
    for (const value of values) {
        const clean = cleanRepairString(value || '', 160);
        if (clean) return clean;
    }
    return '';
}

function getModelRepairResponseFinishReason(value = null) {
    if (!value || typeof value !== 'object') return '';
    return firstCleanResponseValue(
        value.finishReason,
        value.finish_reason,
        value.stopReason,
        value.stop_reason,
        value.reason,
        value.response?.finishReason,
        value.response?.finish_reason,
        value.message?.finishReason,
        value.message?.finish_reason,
        value.choices?.[0]?.finishReason,
        value.choices?.[0]?.finish_reason
    );
}

function isTokenLimitFinishReason(reason = '') {
    return /length|max[_\s-]?tokens?|token[_\s-]?limit|output[_\s-]?limit|truncated/i.test(String(reason || ''));
}

function getModelRepairAttemptMeta(raw = '', responseText = '') {
    return {
        finishReason: getModelRepairResponseFinishReason(raw),
        responseLength: String(responseText || '').length,
    };
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

function getFindingIdsForTargets(plan = {}, findingIds = [], targets = {}) {
    const wanted = new Set(normalizeRepairIdList(findingIds));
    const entryIds = new Set(normalizeRepairIdList(targets.entryIds || []));
    const tagIds = new Set(normalizeRepairIdList(targets.tagIds || []));
    const timelineIds = new Set(normalizeRepairIdList(targets.timelineIds || []));
    const scoped = [];
    for (const finding of Array.isArray(plan.findings) ? plan.findings : []) {
        if (!wanted.has(finding?.findingId)) continue;
        if (entryIds.size && intersects(finding.entryIds || [], entryIds)) scoped.push(finding.findingId);
        else if (!entryIds.size && tagIds.size && intersects(finding.tagIds || [], tagIds)) scoped.push(finding.findingId);
        else if (!entryIds.size && !tagIds.size && timelineIds.size && intersects(finding.timelineIds || [], timelineIds)) scoped.push(finding.findingId);
    }
    return normalizeRepairIdList(scoped.length ? scoped : findingIds);
}

function reduceModelRepairUnitScope(unit = {}, plan = {}) {
    const next = cloneRepairJson(unit) || {};
    let targetReduction = '';
    if (Array.isArray(next.entryIds) && next.entryIds.length > 1) {
        const originalCount = next.entryIds.length;
        next.entryIds = next.entryIds.slice(0, 1);
        targetReduction = `Reduced entries from ${originalCount} to 1.`;
    } else if (Array.isArray(next.tagIds) && next.tagIds.length > 1) {
        const originalCount = next.tagIds.length;
        next.tagIds = next.tagIds.slice(0, 1);
        targetReduction = `Reduced tags from ${originalCount} to 1.`;
    } else if (Array.isArray(next.timelineIds) && next.timelineIds.length > 1) {
        const originalCount = next.timelineIds.length;
        next.timelineIds = next.timelineIds.slice(0, 1);
        targetReduction = `Reduced timeline targets from ${originalCount} to 1.`;
    } else {
        targetReduction = 'Kept the same single target but requested a smaller JSON response.';
    }
    next.findingIds = getFindingIdsForTargets(plan, next.findingIds || unit.findingIds || [], {
        entryIds: next.entryIds || [],
        tagIds: next.tagIds || [],
        timelineIds: next.timelineIds || [],
    });
    next.retrySmaller = true;
    next.originalUnitId = unit.unitId || '';
    next.label = `${next.label || unit.label || unit.unitId || 'repair batch'} retry`;
    next.targetReduction = targetReduction;
    return next;
}

function getRetrySmallerUnit(unit = {}, plan = {}, retryState = null) {
    if (!retryState?.retrySmaller) return cloneRepairJson(unit) || {};
    const reduced = reduceModelRepairUnitScope(unit, plan);
    reduced.previousFailureCode = retryState.previousFailureCode || '';
    reduced.previousFailureMessage = retryState.previousFailureMessage || '';
    return reduced;
}

function getModelRepairRetryDecision(error = null, meta = {}, unit = {}) {
    const code = cleanRepairId(error?.code || error?.errorCode || '', 160);
    const message = cleanRepairString(error?.message || error || '', 1000);
    const finishReason = cleanRepairString(meta.finishReason || '', 160);
    const retrySmaller = code === 'model_repair_json_truncated'
        || code === 'model_repair_response_too_large'
        || isTokenLimitFinishReason(finishReason)
        || /truncated|token limit|max tokens|too large|unexpected end|unterminated/i.test(message);
    return {
        retry: true,
        retrySmaller,
        previousFailureCode: code || (retrySmaller ? 'model_repair_response_truncated' : 'model_repair_retry'),
        previousFailureMessage: message || 'Model repair batch failed.',
        targetReduction: retrySmaller ? reduceModelRepairUnitScope(unit, {}).targetReduction : '',
    };
}

function getStrategyBuckets(plan = {}, strategy = '', excludedFindingIds = new Set()) {
    return (Array.isArray(plan.buckets) ? plan.buckets : [])
        .filter(bucket => bucket.strategy === strategy)
        .filter(bucket => !intersects(bucket.findingIds || [], excludedFindingIds))
        .map(bucket => cloneRepairJson(bucket));
}

function buildRemainingRepairState(plan = {}, choiceSets = []) {
    const excludedFindingIds = getChoiceFindingIdSet(choiceSets);
    const includeUnit = unit => !intersects(unit.findingIds || [], excludedFindingIds);
    const selectedChoiceSets = (Array.isArray(choiceSets) ? choiceSets : []).map(choice => cloneRepairJson(choice));
    return {
        choiceSets: selectedChoiceSets,
        choiceSetCount: selectedChoiceSets.length,
        modelUnits: (Array.isArray(plan.units) ? plan.units : []).filter(includeUnit).map(unit => cloneRepairJson(unit)),
        deferredUnits: (Array.isArray(plan.deferredUnits) ? plan.deferredUnits : []).filter(includeUnit).map(unit => cloneRepairJson(unit)),
        modelDirectBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT, excludedFindingIds),
        modelChoiceBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE, excludedFindingIds),
        manualBuckets: getStrategyBuckets(plan, LOREDECK_HEALTH_REPAIR_STRATEGIES.MANUAL_ONLY),
    };
}

function mergeChoiceSets(existing = [], incoming = []) {
    const out = [];
    const seen = new Set();
    for (const choice of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
        if (!choice?.choiceSetId || seen.has(choice.choiceSetId)) continue;
        seen.add(choice.choiceSetId);
        out.push(cloneRepairJson(choice));
    }
    return out;
}

function unitResultProgress(unit = {}, patch = {}) {
    return {
        unitId: cleanRepairId(unit.unitId || '', 220),
        status: cleanRepairId(patch.status || 'complete', 80),
        code: cleanRepairId(unit.code || patch.code || '', 120),
        strategy: cleanRepairId(unit.strategy || patch.strategy || '', 80),
        inputHash: cleanRepairId(unit.inputHash || patch.inputHash || '', 80),
        startedAt: Number(patch.startedAt) || 0,
        completedAt: Number(patch.completedAt) || 0,
        failedAt: Number(patch.failedAt) || 0,
        updatedAt: Number(patch.updatedAt) || Date.now(),
        attemptCount: Math.max(0, Math.round(Number(patch.attemptCount || patch.attempts) || 0)),
        appliedPatchIds: (Array.isArray(patch.appliedPatchIds) ? patch.appliedPatchIds : []).map(id => cleanRepairId(id || '', 180)).filter(Boolean),
        choiceSetIds: (Array.isArray(patch.choiceSetIds) ? patch.choiceSetIds : []).map(id => cleanRepairId(id || '', 180)).filter(Boolean),
        diagnosticCount: Math.max(0, Math.round(Number(patch.diagnosticCount) || 0)),
        warningCount: Math.max(0, Math.round(Number(patch.warningCount) || 0)),
        error: cleanRepairString(patch.error || '', 500),
    };
}

function setUnitProgress(progressMap = new Map(), unit = {}, patch = {}) {
    const progress = unitResultProgress(unit, patch);
    if (!progress.unitId) return null;
    progressMap.set(progress.unitId, progress);
    return progress;
}

function buildReviewChoiceSetFromRepair(unit = {}, repair = {}, index = 0) {
    const patch = {
        ...(cloneRepairJson(repair.patch) || {}),
        strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE,
        directApply: false,
    };
    const choiceSetId = cleanRepairId(`choice:${unit.unitId}:${patch.patchId || index + 1}`, 180);
    return normalizeRepairChoiceSet({
        choiceSetId,
        findingIds: patch.findingIds?.length ? patch.findingIds : unit.findingIds,
        code: unit.code,
        question: `Review model repair for ${unit.label || unit.code || 'this repair batch'}.`,
        reason: repair.validation?.warnings?.[0] || patch.diagnostics?.[0] || 'The model returned a repair that needs review before applying.',
        options: [{
            optionId: 'A',
            label: 'Apply model repair',
            confidence: patch.confidence,
            reason: patch.diagnostics?.[0] || '',
            patch,
        }],
    });
}

function collectParsedDiagnostics(parsed = {}) {
    const diagnostics = [];
    for (const item of parsed.repairs || []) {
        if (!item.validation?.ok) diagnostics.push(...(item.validation?.diagnostics || []));
    }
    for (const item of parsed.invalidChoices || []) {
        diagnostics.push(...(item.validation?.diagnostics || []));
    }
    for (const warning of parsed.warnings || []) {
        diagnostics.push(normalizeRunnerDiagnostic({
            severity: 'warning',
            code: 'model_repair_warning',
            message: warning,
        }));
    }
    for (const question of parsed.clarifyingQuestions || []) {
        diagnostics.push(normalizeRunnerDiagnostic({
            severity: 'warning',
            code: 'model_repair_clarifying_question',
            message: question,
        }));
    }
    return diagnostics;
}

function getUsableRepairCounts(parsed = {}) {
    const directRepairCount = (parsed.repairs || []).filter(item => item.directApply).length;
    const reviewRepairCount = (parsed.repairs || []).filter(item => !item.directApply && item.validation?.ok).length;
    const choiceCount = Array.isArray(parsed.choices) ? parsed.choices.length : 0;
    return { directRepairCount, reviewRepairCount, choiceCount };
}

function validateParsedModelRepairResult(parsed = {}) {
    const counts = getUsableRepairCounts(parsed);
    if (counts.directRepairCount + counts.reviewRepairCount + counts.choiceCount > 0) return true;
    const diagnostics = collectParsedDiagnostics(parsed);
    const message = diagnostics[0]?.message || 'Model repair batch did not return a valid direct repair or review choice.';
    return {
        ok: false,
        code: 'model_repair_no_usable_fix',
        message,
    };
}

function selectModelRepairUnits(plan = {}, options = {}) {
    const excludedFindingIds = getChoiceFindingIdSet(options.choiceSets || []);
    const includedFindingIds = new Set(normalizeRepairIdList(options.includeFindingIds || options.findingIds || []));
    const allUnits = [
        ...(Array.isArray(plan.units) ? plan.units : []),
        ...(Array.isArray(plan.deferredUnits) ? plan.deferredUnits : []),
    ];
    const seen = new Set();
    const out = [];
    for (const unit of allUnits) {
        if (!unit?.unitId || seen.has(unit.unitId)) continue;
        seen.add(unit.unitId);
        if (includedFindingIds.size && !intersects(unit.findingIds || [], includedFindingIds)) continue;
        if (intersects(unit.findingIds || [], excludedFindingIds)) continue;
        out.push(cloneRepairJson(unit));
    }
    return out;
}

async function resolveStartingRepairSession(packId = '', options = {}) {
    if (isPlainRepairObject(options.session)) return { session: createLoredeckHealthRepairSession(options.session, options), diagnostics: [] };
    const sessionRef = options.sessionPath || options.repairSessionPath || '';
    const sessionId = options.sessionId || options.repairSessionId || '';
    if (!sessionRef && !sessionId) return { session: null, diagnostics: [] };
    const result = sessionRef
        ? await readLoredeckHealthRepairSession(sessionRef, options)
        : await readLoredeckHealthRepairSession(packId, sessionId, options);
    return {
        session: result.ok ? result.session : null,
        diagnostics: result.ok ? [] : (result.diagnostics || [normalizeRunnerDiagnostic(result.error || 'Repair session could not be loaded.', 'repair_session_read_failed')]),
    };
}

function buildModelRunSummary(input = {}) {
    return createRepairRunSummary({
        initialHealth: input.initialHealth,
        checkpointHealth: input.checkpointHealth || input.finalHealth || input.initialHealth,
        finalHealth: input.finalHealth || input.initialHealth,
        initialPlan: input.initialPlan,
        checkpointPlan: input.checkpointPlan || input.finalPlan || input.initialPlan,
        finalPlan: input.finalPlan || input.initialPlan,
        modelResults: input.modelResults,
        appliedPatches: input.appliedPatches,
        choiceSets: input.choiceSets,
        diagnostics: input.diagnostics,
    });
}

export function buildLoredeckHealthModelRepairPromptText(promptPayload = {}) {
    return JSON.stringify(promptPayload, null, 2);
}

export async function runLoredeckHealthModelRepairBatches(packId = '', options = {}) {
    const requestModelRepair = options.requestModelRepair || options.callModelRepair || options.modelRepairProvider;
    if (typeof requestModelRepair !== 'function') {
        return {
            ok: false,
            changed: false,
            error: 'Model repair runner needs a requestModelRepair callback.',
            diagnostics: [normalizeRunnerDiagnostic({
                severity: 'error',
                code: 'model_repair_provider_missing',
                message: 'Model repair runner needs a requestModelRepair callback.',
            })],
        };
    }

    const preflight = await runPackHealth(packId, options);
    if (!preflight.ok) {
        return {
            ok: false,
            changed: false,
            error: preflight.error || 'Pack Health preflight failed.',
            diagnostics: preflight.diagnostics || [],
        };
    }

    const startingSessionResult = await resolveStartingRepairSession(packId, options);
    const startingSession = startingSessionResult.session;
    const progressMap = new Map((startingSession?.remaining?.modelProgress || []).map(progress => [progress.unitId, cloneRepairJson(progress)]));
    let choiceSets = mergeChoiceSets(startingSession?.remaining?.choiceSets || [], []);
    let currentPack = preflight.pack;
    let currentHealth = preflight.health;
    const initialPlan = buildLoredeckHealthRepairPlan({
        pack: currentPack,
        health: currentHealth,
        batchLimits: options.batchLimits,
    });
    const maxUnits = clampUnitCount(options.maxUnits ?? options.modelUnitLimit ?? options.batchLimits?.modelUnitLimit);
    const allSelectedUnits = selectModelRepairUnits(initialPlan, {
        choiceSets,
        includeFindingIds: options.includeFindingIds || options.findingIds || [],
    });
    const selectedUnits = allSelectedUnits.slice(0, maxUnits);
    const diagnostics = mergeDiagnostics(preflight.diagnostics, startingSessionResult.diagnostics);
    const appliedPatches = [];
    const modelResults = [];
    let sessionPath = startingSession?.sessionFile || '';
    let latestSession = startingSession || null;
    let changed = false;

    const shouldPersistSession = options.persistSession !== false && options.writeRepairSession !== false;
    const persistSessionSnapshot = async (statusHint = '') => {
        if (!shouldPersistSession) return null;
        const snapshotHealth = currentHealth || (await runPackHealth(currentPack, options)).health;
        const snapshotPlan = buildLoredeckHealthRepairPlan({
            pack: currentPack,
            health: snapshotHealth,
            batchLimits: options.batchLimits,
        });
        const remaining = buildRemainingRepairState(snapshotPlan, choiceSets);
        remaining.modelProgress = Array.from(progressMap.values()).map(progress => cloneRepairJson(progress));
        const summary = buildModelRunSummary({
            initialHealth: preflight.health,
            checkpointHealth: preflight.health,
            finalHealth: snapshotHealth,
            initialPlan,
            checkpointPlan: snapshotPlan,
            finalPlan: snapshotPlan,
            modelResults,
            appliedPatches,
            choiceSets,
            diagnostics,
        });
        const session = createLoredeckHealthRepairSession({
            ...(latestSession || {}),
            packId,
            sessionId: latestSession?.sessionId || options.repairSessionId || options.sessionId || '',
            status: statusHint || '',
            outcome: summary.outcome,
            createdAt: latestSession?.createdAt,
            updatedAt: nowValue(options),
            summary,
            remaining,
            diagnostics,
            appliedPatchIds: appliedPatches.map(patch => patch.patchId).filter(Boolean),
        }, options);
        if (session.status === 'complete' && options.persistCompletedSession !== true && !hasErrorDiagnostics(diagnostics)) {
            if (latestSession?.sessionId || latestSession?.sessionFile) {
                await deleteLoredeckHealthRepairSession(latestSession, options);
            }
            latestSession = null;
            sessionPath = '';
            return null;
        }
        const writeResult = await writeLoredeckHealthRepairSession(session, options);
        if (writeResult.ok) {
            latestSession = writeResult.session;
            sessionPath = writeResult.path;
            return latestSession;
        }
        diagnostics.push(...(writeResult.diagnostics || [normalizeRunnerDiagnostic(writeResult.error || 'Repair session write failed.', 'repair_session_write_failed')]));
        return null;
    };

    if (!selectedUnits.length) {
        const finalPlan = buildLoredeckHealthRepairPlan({
            pack: currentPack,
            health: currentHealth,
            batchLimits: options.batchLimits,
        });
        const remaining = buildRemainingRepairState(finalPlan, choiceSets);
        remaining.modelProgress = Array.from(progressMap.values()).map(progress => cloneRepairJson(progress));
        const summary = buildModelRunSummary({
            initialHealth: preflight.health,
            finalHealth: currentHealth,
            initialPlan,
            finalPlan,
            modelResults,
            appliedPatches,
            choiceSets,
            diagnostics,
        });
        await persistSessionSnapshot(summary.outcome);
        return {
            ok: true,
            changed: false,
            pack: currentPack,
            preflightHealth: preflight.health,
            finalHealth: currentHealth,
            initialPlan,
            finalPlan,
            selectedUnits: [],
            modelResults,
            appliedPatches,
            choiceSets,
            diagnostics,
            remaining,
            summary,
            session: latestSession,
            sessionPath,
        };
    }

    const passPack = cloneRepairJson(currentPack);
    const passHealth = cloneRepairJson(currentHealth);
    const passPlan = cloneRepairJson(initialPlan);
    const retryStateByUnitId = new Map();
    const attemptMetaByKey = new Map();
    const getSelectedRepairUnit = unit => selectedUnits.find(row => row.unitId === unit.unitId) || unit;
    const getAttemptRetryState = (unit = {}, attempt = 1) => attempt > 1 ? retryStateByUnitId.get(unit.unitId) || null : null;
    const getAttemptRepairUnit = (unit = {}, attempt = 1) => getRetrySmallerUnit(getSelectedRepairUnit(unit), passPlan, getAttemptRetryState(unit, attempt));
    const runResult = await runGenerationUnits({
        jobId: cleanRepairId(packId || 'loredeck', 180),
        kind: 'loredeck_health_repair',
        stage: 'model_repair',
        mode: 'repair_batches',
        units: selectedUnits,
        signal: options.signal,
        retryAttempts: Math.max(0, Math.round(Number(options.retryAttempts) || 0)),
        stopOnFailure: options.stopOnFailure !== false,
        onProgress: options.onProgress,
        callUnit: async ({ unit, attempt, signal, emitProgress }) => {
            const retryState = getAttemptRetryState(unit, attempt);
            const repairUnit = getAttemptRepairUnit(unit, attempt);
            if (retryState?.retrySmaller && typeof emitProgress === 'function') {
                emitProgress({
                    type: 'unit_retry_smaller',
                    unitId: unit.unitId,
                    attempt,
                    previousFailureCode: retryState.previousFailureCode || '',
                    targetReduction: repairUnit.targetReduction || '',
                });
            }
            const promptPayload = buildLoredeckModelRepairPromptPayload(passPack, repairUnit, passPlan, retryState?.retrySmaller ? {
                retry: {
                    retrySmaller: true,
                    originalUnitId: unit.unitId,
                    previousFailureCode: retryState.previousFailureCode || '',
                    previousFailureMessage: retryState.previousFailureMessage || '',
                    targetReduction: repairUnit.targetReduction || retryState.targetReduction || '',
                },
                maxChars: Math.max(1000, Math.round((Number(options.modelRepairResponseLimit) || 200000) / 2)),
            } : {
                maxChars: Number(options.modelRepairResponseLimit) || undefined,
            });
            const promptText = buildLoredeckHealthModelRepairPromptText(promptPayload);
            const raw = await requestModelRepair({
                pack: passPack,
                health: passHealth,
                plan: passPlan,
                unit: repairUnit,
                promptPayload,
                promptText,
                attempt,
                signal,
                emitProgress,
            });
            const responseText = readModelRepairResponseText(raw);
            attemptMetaByKey.set(`${unit.unitId}:${attempt}`, getModelRepairAttemptMeta(raw, responseText));
            return responseText;
        },
        parseResult: (rawText, { unit, attempt }) => {
            const repairUnit = getAttemptRepairUnit(unit, attempt);
            const parsed = parseAndValidateLoredeckModelRepairResponse(passPack, repairUnit, passPlan, rawText);
            return {
                ...parsed,
                repairUnit: cloneRepairJson(repairUnit),
                retrySmaller: repairUnit.retrySmaller === true,
            };
        },
        validateResult: validateParsedModelRepairResult,
        isRetryableError: (error, { unit, attempt }) => {
            const baseUnit = getSelectedRepairUnit(unit);
            const meta = attemptMetaByKey.get(`${unit.unitId}:${attempt}`) || {};
            const decision = getModelRepairRetryDecision(error, meta, baseUnit);
            if (decision.retrySmaller) {
                retryStateByUnitId.set(unit.unitId, {
                    retrySmaller: true,
                    previousFailureCode: decision.previousFailureCode,
                    previousFailureMessage: decision.previousFailureMessage,
                    targetReduction: decision.targetReduction,
                });
            }
            return decision.retry !== false;
        },
        diagnoseFailure: ({ unit, attempt, error }) => {
            const meta = attemptMetaByKey.get(`${unit.unitId}:${attempt}`) || {};
            const decision = getModelRepairRetryDecision(error, meta, getSelectedRepairUnit(unit));
            if (!decision.retrySmaller) return null;
            return {
                severity: 'warning',
                code: 'model_repair_retry_smaller',
                message: 'Model repair response was too large or truncated; retrying this batch with a reduced target set.',
                previousFailureCode: decision.previousFailureCode,
            };
        },
        commitResult: async ({ unit, parsedResult }) => {
            const repairUnit = parsedResult.repairUnit || getSelectedRepairUnit(unit);
            const directPatches = (parsedResult.repairs || [])
                .filter(item => item.directApply)
                .map(item => item.patch);
            const reviewChoices = (parsedResult.repairs || [])
                .filter(item => !item.directApply && item.validation?.ok)
                .map((item, index) => buildReviewChoiceSetFromRepair(repairUnit, item, index));
            const unitChoiceSets = mergeChoiceSets(reviewChoices, parsedResult.choices || []);
            const parsedDiagnostics = collectParsedDiagnostics(parsedResult);
            diagnostics.push(...parsedDiagnostics);

            let unitAppliedPatches = [];
            if (directPatches.length) {
                const applyResult = await applyPackRepairPatches(packId, directPatches, {
                    ...options,
                    health: passHealth,
                    plan: passPlan,
                });
                diagnostics.push(...(applyResult.diagnostics || []));
                if (!applyResult.ok) {
                    throw new Error(applyResult.error || 'Model repair patches did not pass storage validation.');
                }
                unitAppliedPatches = applyResult.appliedPatches || [];
                appliedPatches.push(...unitAppliedPatches);
                currentPack = applyResult.pack || currentPack;
                currentHealth = applyResult.afterHealth || currentHealth;
                changed = changed || unitAppliedPatches.length > 0;
            }

            choiceSets = mergeChoiceSets(choiceSets, unitChoiceSets);
            modelResults.push({
                unit: cloneRepairJson(repairUnit),
                repairCount: (parsedResult.repairs || []).length,
                directRepairCount: directPatches.length,
                choiceSetCount: unitChoiceSets.length,
                appliedPatchIds: unitAppliedPatches.map(patch => patch.patchId).filter(Boolean),
                diagnostics: parsedDiagnostics.map(item => normalizeRunnerDiagnostic(item)),
            });
            setUnitProgress(progressMap, repairUnit, {
                status: 'complete',
                startedAt: unit.startedAt,
                completedAt: nowValue(options),
                updatedAt: nowValue(options),
                attemptCount: unit.attempts,
                appliedPatchIds: unitAppliedPatches.map(patch => patch.patchId).filter(Boolean),
                choiceSetIds: unitChoiceSets.map(choice => choice.choiceSetId).filter(Boolean),
                diagnosticCount: parsedDiagnostics.length,
                warningCount: (parsedResult.warnings || []).length,
            });
            await persistSessionSnapshot(unitChoiceSets.length ? 'needs_review' : 'model_pending');
            return {
                resultRef: {
                    type: 'loredeck_health_model_repair',
                    summary: `${directPatches.length} direct repair${directPatches.length === 1 ? '' : 's'}, ${unitChoiceSets.length} review choice${unitChoiceSets.length === 1 ? '' : 's'}`,
                },
                appliedPatchIds: unitAppliedPatches.map(patch => patch.patchId).filter(Boolean),
                choiceSetIds: unitChoiceSets.map(choice => choice.choiceSetId).filter(Boolean),
            };
        },
    });

    for (const result of runResult.results || []) {
        if (result.status !== 'failed' && result.status !== 'cancelled' && result.status !== 'superseded') continue;
        const repairUnit = selectedUnits.find(row => row.unitId === result.unit?.unitId) || result.unit || {};
        const diagnostic = normalizeRunnerDiagnostic({
            severity: 'error',
            code: result.error?.code || 'model_repair_unit_failed',
            message: result.error?.message || result.unit?.error || 'Model repair batch failed.',
        });
        diagnostics.push(diagnostic);
        modelResults.push({
            unit: cloneRepairJson(repairUnit),
            status: result.status,
            repairCount: 0,
            directRepairCount: 0,
            choiceSetCount: 0,
            appliedPatchIds: [],
            diagnostics: [diagnostic],
        });
        setUnitProgress(progressMap, repairUnit, {
            status: result.status,
            startedAt: result.unit?.startedAt,
            failedAt: nowValue(options),
            updatedAt: nowValue(options),
            attemptCount: result.unit?.attempts,
            diagnosticCount: 1,
            error: diagnostic.message,
        });
    }

    const finalHealthResult = await runPackHealth(currentPack, options);
    if (finalHealthResult.ok) {
        currentPack = finalHealthResult.pack || currentPack;
        currentHealth = finalHealthResult.health || currentHealth;
        diagnostics.push(...(finalHealthResult.diagnostics || []));
    } else {
        diagnostics.push(...(finalHealthResult.diagnostics || [normalizeRunnerDiagnostic(finalHealthResult.error || 'Pack Health final scan failed.', 'model_repair_final_health_failed')]));
    }
    const finalPlan = buildLoredeckHealthRepairPlan({
        pack: currentPack,
        health: currentHealth,
        batchLimits: options.batchLimits,
    });
    const remaining = buildRemainingRepairState(finalPlan, choiceSets);
    remaining.modelProgress = Array.from(progressMap.values()).map(progress => cloneRepairJson(progress));
    const summary = buildModelRunSummary({
        initialHealth: preflight.health,
        checkpointHealth: preflight.health,
        finalHealth: currentHealth,
        initialPlan,
        checkpointPlan: finalPlan,
        finalPlan,
        modelResults,
        appliedPatches,
        choiceSets,
        diagnostics,
    });
    await persistSessionSnapshot(summary.outcome);

    return {
        ok: runResult.status !== 'failed',
        changed,
        pack: currentPack,
        preflightHealth: preflight.health,
        finalHealth: currentHealth,
        initialPlan,
        finalPlan,
        selectedUnits,
        runResult,
        modelResults,
        appliedPatches,
        choiceSets,
        diagnostics,
        remaining,
        summary,
        session: latestSession,
        sessionPath,
        error: runResult.status === 'failed' ? runResult.run?.error || 'One or more model repair batches failed.' : '',
    };
}

function findRepairChoiceSet(session = {}, choiceSetId = '') {
    const id = cleanRepairId(choiceSetId || '', 180);
    if (!id) return null;
    return (Array.isArray(session.remaining?.choiceSets) ? session.remaining.choiceSets : [])
        .find(choice => choice?.choiceSetId === id) || null;
}

function removeRepairChoiceSetFromSession(session = {}, choiceSetId = '') {
    const id = cleanRepairId(choiceSetId || '', 180);
    const next = cloneRepairJson(session) || {};
    const remaining = isPlainRepairObject(next.remaining) ? next.remaining : {};
    const choiceSets = (Array.isArray(remaining.choiceSets) ? remaining.choiceSets : [])
        .filter(choice => choice?.choiceSetId !== id)
        .map(choice => cloneRepairJson(choice));
    next.remaining = {
        ...remaining,
        choiceSets,
        choiceSetCount: choiceSets.length,
    };
    next.status = 'model_pending';
    next.outcome = 'model_pending';
    return next;
}

export async function reevaluateLoredeckHealthRepairChoice(packId = '', input = {}, options = {}) {
    const id = cleanRepairId(packId || input.packId || input.session?.packId || '', 180);
    if (!id) {
        return {
            ok: false,
            changed: false,
            error: 'Re-evaluating a repair choice needs a Loredeck pack id.',
            diagnostics: [normalizeRunnerDiagnostic({
                severity: 'error',
                code: 'repair_choice_reevaluate_missing_pack_id',
                message: 'Re-evaluating a repair choice needs a Loredeck pack id.',
            })],
        };
    }
    const sessionResult = await resolveStartingRepairSession(id, {
        ...options,
        session: input.session || options.session || null,
        sessionPath: input.sessionPath || input.sessionFile || input.session?.sessionFile || options.sessionPath || '',
        sessionId: input.sessionId || options.sessionId || '',
    });
    const session = sessionResult.session;
    if (!session) {
        return {
            ok: false,
            changed: false,
            error: sessionResult.diagnostics?.[0]?.message || 'Re-evaluating a repair choice needs a saved repair session.',
            diagnostics: sessionResult.diagnostics || [normalizeRunnerDiagnostic({
                severity: 'error',
                code: 'repair_choice_reevaluate_missing_session',
                message: 'Re-evaluating a repair choice needs a saved repair session.',
            })],
        };
    }
    const choiceSetId = cleanRepairId(input.choiceSetId || input.choice?.choiceSetId || '', 180);
    const choice = findRepairChoiceSet(session, choiceSetId);
    if (!choice) {
        return {
            ok: false,
            changed: false,
            session,
            sessionPath: session.sessionFile || '',
            error: 'Repair choice set was not found in this session.',
            diagnostics: [normalizeRunnerDiagnostic({
                severity: 'error',
                code: 'repair_choice_reevaluate_choice_not_found',
                message: 'Repair choice set was not found in this session.',
            })],
        };
    }
    const findingIds = normalizeRepairIdList(choice.findingIds || input.findingIds || []);
    if (!findingIds.length) {
        return {
            ok: false,
            changed: false,
            session,
            sessionPath: session.sessionFile || '',
            choice,
            error: 'Repair choice set does not identify Pack Health findings to re-evaluate.',
            diagnostics: [normalizeRunnerDiagnostic({
                severity: 'error',
                code: 'repair_choice_reevaluate_missing_findings',
                message: 'Repair choice set does not identify Pack Health findings to re-evaluate.',
            })],
        };
    }
    const rerunSession = removeRepairChoiceSetFromSession(session, choice.choiceSetId);
    return await runLoredeckHealthModelRepairBatches(id, {
        ...options,
        session: rerunSession,
        includeFindingIds: findingIds,
        maxUnits: 1,
        persistSession: options.persistSession !== false,
    });
}

export const __loredeckHealthModelRepairRunnerTestHooks = Object.freeze({
    buildRemainingRepairState,
    buildReviewChoiceSetFromRepair,
    collectParsedDiagnostics,
    findRepairChoiceSet,
    getUsableRepairCounts,
    hasErrorDiagnostics,
    removeRepairChoiceSetFromSession,
    readModelRepairResponseText,
    reduceModelRepairUnitScope,
    selectModelRepairUnits,
    validateParsedModelRepairResult,
});
