/**
 * generation-job-runner.js -- Saga
 * UI-free sequential generation unit runner.
 *
 * This module is intentionally domain-agnostic. It does not know about
 * Loredecks, chat messages, Provider settings, or Pending Review. Callers
 * provide unit callbacks for provider calls, parsing, repair, checkpointing,
 * and commits.
 */

export const GENERATION_RUN_STATUSES = Object.freeze([
    'queued',
    'running',
    'complete',
    'partial',
    'failed',
    'cancelled',
    'interrupted',
    'superseded',
]);

export const GENERATION_UNIT_STATUSES = Object.freeze([
    'queued',
    'running',
    'retrying',
    'complete',
    'failed',
    'cancelled',
    'interrupted',
    'superseded',
    'skipped',
]);

export const GENERATION_ERROR_CODES = Object.freeze({
    NO_USABLE_RESULT: 'generation_no_usable_result',
    STAGE_CONTRACT_FAILED: 'creator_stage_contract_failed',
    JSON_INVALID: 'json_invalid',
    COMMIT_FAILED: 'commit_failed',
});

const RUN_STATUS_SET = new Set(GENERATION_RUN_STATUSES);
const UNIT_STATUS_SET = new Set(GENERATION_UNIT_STATUSES);

function cleanString(value = '', maxLength = 500) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function cleanId(value = '', fallback = '') {
    const cleaned = cleanString(value, 220)
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return cleaned || fallback;
}

function clampInteger(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
}

function now() {
    return Date.now();
}

function createRunId(jobId = 'job', stage = 'stage') {
    const suffix = Math.random().toString(36).slice(2, 8);
    return `run_${cleanId(jobId, 'job')}_${cleanId(stage, 'stage')}_${now()}_${suffix}`;
}

function createAbortError(message = 'Generation cancelled') {
    try {
        return new DOMException(message, 'AbortError');
    } catch (_) {
        const error = new Error(message);
        error.name = 'AbortError';
        return error;
    }
}

export function isGenerationAbortError(error) {
    return error?.name === 'AbortError'
        || /aborted|abort|cancelled|canceled/i.test(String(error?.message || error || ''));
}

export function throwIfGenerationAborted(signal, message = 'Generation cancelled') {
    if (signal?.aborted) throw createAbortError(message);
}

function normalizeStatus(status = '', allowed = RUN_STATUS_SET, fallback = 'queued') {
    const value = cleanString(status, 40).toLowerCase();
    return allowed.has(value) ? value : fallback;
}

export function normalizeGenerationUnit(raw = {}, index = 0) {
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const fallbackId = `unit_${index + 1}`;
    const unitId = cleanId(input.unitId || input.id || input.batchId || '', fallbackId);
    const label = cleanString(input.label || input.title || unitId, 180);
    return {
        ...input,
        unitId,
        id: cleanId(input.id || unitId, unitId),
        label,
        stage: cleanId(input.stage || '', ''),
        inputHash: cleanString(input.inputHash || '', 160),
        status: normalizeStatus(input.status, UNIT_STATUS_SET, 'queued'),
        attempts: clampInteger(input.attempts, 0, 100, 0),
        createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : 0,
        updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : 0,
    };
}

function normalizeUnits(units = []) {
    const output = [];
    const seen = new Set();
    for (const [index, raw] of (Array.isArray(units) ? units : []).entries()) {
        const unit = normalizeGenerationUnit(raw, index);
        const key = unit.unitId.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(unit);
    }
    return output;
}

function normalizeRun(options = {}, units = []) {
    const jobId = cleanId(options.jobId || '', 'generation_job');
    const stage = cleanId(options.stage || '', 'generation');
    const kind = cleanId(options.kind || 'generation', 'generation');
    const runId = cleanId(options.runId || '', '') || createRunId(jobId, stage);
    const createdAt = now();
    return {
        runId,
        jobId,
        kind,
        stage,
        mode: cleanId(options.mode || 'run_next', 'run_next'),
        status: 'running',
        totalUnits: units.length,
        completedUnits: 0,
        failedUnits: 0,
        skippedUnits: 0,
        cancelledUnits: 0,
        createdAt,
        updatedAt: createdAt,
        startedAt: createdAt,
        completedAt: 0,
        error: '',
    };
}

function normalizeError(error) {
    if (!error) return { message: '', name: '' };
    return {
        name: cleanString(error.name || '', 80),
        code: cleanString(error.code || error.errorCode || '', 120),
        message: cleanString(error.message || String(error), 1000),
        stack: typeof error.stack === 'string' ? error.stack.slice(0, 4000) : '',
    };
}

function normalizeDiagnosticValue(value, depth = 0, seen = new WeakSet()) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return cleanString(value, depth > 1 ? 500 : 1000);
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'object') return cleanString(value, 500);
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) {
        return value.slice(0, 20).map(item => normalizeDiagnosticValue(item, depth + 1, seen));
    }

    if (depth >= 2) {
        try { return cleanString(JSON.stringify(value), 1000); } catch (_) { return '[Object]'; }
    }

    const output = {};
    for (const [rawKey, nested] of Object.entries(value).slice(0, 40)) {
        const key = cleanId(rawKey, '');
        if (!key) continue;
        output[key] = normalizeDiagnosticValue(nested, depth + 1, seen);
    }
    return output;
}

function normalizeFailureDiagnostic(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const diagnostic = normalizeDiagnosticValue(value);
    return diagnostic && typeof diagnostic === 'object' && !Array.isArray(diagnostic) && Object.keys(diagnostic).length
        ? diagnostic
        : null;
}

async function buildFailureDiagnostic(options = {}, payload = {}) {
    if (typeof options.diagnoseFailure !== 'function') return null;
    try {
        return normalizeFailureDiagnostic(await options.diagnoseFailure(payload));
    } catch (error) {
        console.warn('[Saga] Generation runner diagnostic callback failed:', error);
        return null;
    }
}

function unitPatch(unit = {}, patch = {}) {
    return {
        ...unit,
        ...patch,
        status: normalizeStatus(patch.status || unit.status, UNIT_STATUS_SET, 'queued'),
        attempts: clampInteger(patch.attempts ?? unit.attempts, 0, 100, unit.attempts || 0),
        updatedAt: now(),
    };
}

function runPatch(run = {}, patch = {}) {
    return {
        ...run,
        ...patch,
        status: normalizeStatus(patch.status || run.status, RUN_STATUS_SET, 'running'),
        updatedAt: now(),
    };
}

async function callOptional(callback, payload, fallback) {
    if (typeof callback !== 'function') return fallback;
    return await callback(payload);
}

function emitProgress(options = {}, event = {}) {
    if (typeof options.onProgress !== 'function') return;
    try {
        options.onProgress({
            ...event,
            timestamp: now(),
        });
    } catch (error) {
        console.warn('[Saga] Generation runner progress callback failed:', error);
    }
}

async function checkpointRun(options = {}, run = {}, event = {}) {
    emitProgress(options, { type: event.type || 'run_checkpoint', run, ...event });
    await callOptional(options.checkpointRun, { run, event }, null);
}

async function checkpointUnit(options = {}, run = {}, unit = {}, event = {}) {
    emitProgress(options, { type: event.type || 'unit_checkpoint', run, unit, ...event });
    await callOptional(options.checkpointUnit, { run, unit, event }, null);
}

async function assertUsableParsedResult(result, context, options = {}) {
    if (typeof options.validateResult === 'function') {
        const validation = await options.validateResult(result, context);
        if (validation instanceof Error) throw validation;
        if (validation === false) throw makeNoUsableResultError();
        if (typeof validation === 'string' && validation.trim()) {
            throw makeNoUsableResultError(validation, GENERATION_ERROR_CODES.STAGE_CONTRACT_FAILED);
        }
        if (validation && typeof validation === 'object' && !Array.isArray(validation)) {
            const failed = validation.ok === false || validation.valid === false || validation.usable === false;
            if (failed) {
                throw makeNoUsableResultError(
                    validation.message || validation.error || 'Generation unit returned no usable result.',
                    validation.code || validation.errorCode || GENERATION_ERROR_CODES.STAGE_CONTRACT_FAILED
                );
            }
        }
        return;
    }
    if (options.allowEmptyResult === true) return;
    if (result === undefined || result === null) throw makeNoUsableResultError();
}

function makeNoUsableResultError(message = 'Generation unit returned no usable result.', code = GENERATION_ERROR_CODES.NO_USABLE_RESULT) {
    const error = new Error(message);
    error.name = 'GenerationNoUsableResultError';
    error.code = code;
    return error;
}

function annotateGenerationError(error, code, fallbackMessage = 'Generation failed.') {
    if (error && typeof error === 'object') {
        if (!error.code && !error.errorCode) {
            try { error.code = code; } catch (_) {}
        }
        return error;
    }
    const wrapped = new Error(cleanString(error || fallbackMessage, 1000) || fallbackMessage);
    wrapped.code = code;
    return wrapped;
}

async function parseUnitResult(rawResult, context, options = {}) {
    let parsed = rawResult;
    if (typeof options.parseResult === 'function') {
        try {
            parsed = await options.parseResult(rawResult, context);
        } catch (error) {
            throw annotateGenerationError(error, GENERATION_ERROR_CODES.JSON_INVALID, 'Generation returned invalid JSON.');
        }
    }
    await assertUsableParsedResult(parsed, context, options);
    return parsed;
}

async function repairAndParseUnitResult(rawResult, error, context, options = {}) {
    if (typeof options.repairResult !== 'function') throw error;
    const repaired = await options.repairResult({ ...context, rawResult, error });
    const repairRaw = repaired && typeof repaired === 'object' && Object.prototype.hasOwnProperty.call(repaired, 'rawResult')
        ? repaired.rawResult
        : repaired;
    const parsed = repaired && typeof repaired === 'object' && Object.prototype.hasOwnProperty.call(repaired, 'parsedResult')
        ? repaired.parsedResult
        : await parseUnitResult(repairRaw, context, options);
    await assertUsableParsedResult(parsed, context, options);
    return { rawResult: repairRaw, parsedResult: parsed };
}

async function isRetryable(error, context, options = {}) {
    if (isGenerationAbortError(error)) return false;
    if (typeof options.isRetryableError === 'function') {
        return await options.isRetryableError(error, context) !== false;
    }
    return true;
}

async function isRunCurrent(options = {}, context = {}) {
    if (typeof options.isRunCurrent !== 'function') return true;
    return await options.isRunCurrent(context) !== false;
}

async function maybeSkipUnit(options = {}, context = {}) {
    if (typeof options.shouldSkipUnit !== 'function') return false;
    return await options.shouldSkipUnit(context) === true;
}

async function commitUnitResult(options = {}, context = {}) {
    if (typeof options.commitResult !== 'function') return null;
    try {
        return await options.commitResult(context);
    } catch (error) {
        throw annotateGenerationError(error, GENERATION_ERROR_CODES.COMMIT_FAILED, 'Generation result could not be saved.');
    }
}

async function runSingleUnit(options, run, unit, runState) {
    const retryAttempts = clampInteger(options.retryAttempts, 0, 10, 0);
    const maxAttempts = retryAttempts + 1;
    const stopOnFailure = options.stopOnFailure !== false;
    const contextBase = { run, unit, signal: options.signal };

    if (await maybeSkipUnit(options, contextBase)) {
        const skipped = unitPatch(unit, { status: 'skipped' });
        await checkpointUnit(options, run, skipped, { type: 'unit_skipped' });
        return { status: 'skipped', unit: skipped, stop: false };
    }

    let rawResult = undefined;
    let lastError = null;
    let lastDiagnostic = null;
    let repairAttempted = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        throwIfGenerationAborted(options.signal);
        const running = unitPatch(unit, {
            status: attempt === 1 ? 'running' : 'retrying',
            attempts: attempt,
            startedAt: unit.startedAt || now(),
            error: '',
            diagnostic: null,
        });
        await checkpointUnit(options, run, running, {
            type: attempt === 1 ? 'unit_started' : 'unit_retrying',
            attempt,
        });

        rawResult = undefined;
        let failurePhase = 'request';
        try {
            const attemptContext = { ...contextBase, unit: running, attempt, emitProgress: event => emitProgress(options, { run, unit: running, ...event }) };
            rawResult = await options.callUnit(attemptContext);
            throwIfGenerationAborted(options.signal);

            if (!(await isRunCurrent(options, attemptContext))) {
                const superseded = unitPatch(running, { status: 'superseded' });
                await checkpointUnit(options, run, superseded, { type: 'unit_superseded', attempt });
                return { status: 'superseded', unit: superseded, stop: true };
            }

            let parsedResult;
            failurePhase = 'parse';
            try {
                parsedResult = await parseUnitResult(rawResult, attemptContext, options);
            } catch (parseError) {
                if (repairAttempted || typeof options.repairResult !== 'function') throw parseError;
                repairAttempted = true;
                emitProgress(options, {
                    type: 'unit_repairing',
                    run,
                    unit: running,
                    attempt,
                    error: normalizeError(parseError),
                });
                failurePhase = 'repair';
                const repaired = await repairAndParseUnitResult(rawResult, parseError, attemptContext, options);
                rawResult = repaired.rawResult;
                parsedResult = repaired.parsedResult;
            }

            throwIfGenerationAborted(options.signal);
            if (!(await isRunCurrent(options, attemptContext))) {
                const superseded = unitPatch(running, { status: 'superseded' });
                await checkpointUnit(options, run, superseded, { type: 'unit_superseded', attempt });
                return { status: 'superseded', unit: superseded, stop: true };
            }

            failurePhase = 'commit';
            const commitResult = await commitUnitResult(options, {
                ...attemptContext,
                rawResult,
                parsedResult,
            });
            const complete = unitPatch(running, {
                status: 'complete',
                completedAt: now(),
                outputHash: cleanString(commitResult?.outputHash || commitResult?.hash || running.outputHash || '', 160),
                resultRef: commitResult?.resultRef || running.resultRef || null,
                error: '',
                diagnostic: null,
            });
            await checkpointUnit(options, run, complete, {
                type: 'unit_completed',
                attempt,
                commitResult,
            });
            return {
                status: 'complete',
                unit: complete,
                rawResult,
                parsedResult,
                commitResult,
                stop: false,
            };
        } catch (error) {
            if (isGenerationAbortError(error)) throw error;
            lastError = error;
            const normalizedError = normalizeError(error);
            lastDiagnostic = await buildFailureDiagnostic(options, {
                run,
                unit: running,
                attempt,
                maxAttempts,
                phase: failurePhase,
                rawResult,
                error,
                normalizedError,
                repairAttempted,
            });
            const retry = attempt < maxAttempts && await isRetryable(error, { ...contextBase, unit: running, attempt, rawResult }, options);
            await checkpointUnit(options, run, unitPatch(running, {
                status: retry ? 'retrying' : 'failed',
                error: normalizedError.message,
                diagnostic: lastDiagnostic || null,
                failedAt: retry ? 0 : now(),
            }), {
                type: retry ? 'unit_retry_scheduled' : 'unit_failed',
                attempt,
                error: normalizedError,
                diagnostic: lastDiagnostic || null,
            });
            if (retry) continue;
        }
    }

    const failed = unitPatch(unit, {
        status: 'failed',
        attempts: maxAttempts,
        error: normalizeError(lastError).message || 'Generation unit failed.',
        diagnostic: lastDiagnostic || null,
        failedAt: now(),
    });
    return {
        status: 'failed',
        unit: failed,
        error: normalizeError(lastError),
        stop: stopOnFailure,
    };
}

/**
 * Runs generation units sequentially with retry, repair, checkpoint, and
 * cancellation hooks.
 *
 * @param {Object} options
 * @param {string} options.jobId
 * @param {string} options.kind
 * @param {string} options.stage
 * @param {Object[]} options.units
 * @param {Function} options.callUnit - required async provider/work callback
 * @returns {Promise<Object>} run summary
 */
export async function runGenerationUnits(options = {}) {
    if (typeof options.callUnit !== 'function') {
        throw new TypeError('runGenerationUnits requires a callUnit callback.');
    }

    const units = normalizeUnits(options.units || []);
    const run = normalizeRun(options, units);
    const results = [];
    const runState = {
        completed: 0,
        failed: 0,
        skipped: 0,
        cancelled: 0,
    };

    await checkpointRun(options, run, { type: 'run_started' });

    if (!units.length) {
        const emptyRun = runPatch(run, { status: 'complete', completedAt: now() });
        await checkpointRun(options, emptyRun, { type: 'run_completed' });
        return {
            status: 'complete',
            run: emptyRun,
            units: [],
            results,
            completedUnits: 0,
            failedUnits: 0,
            skippedUnits: 0,
            cancelledUnits: 0,
        };
    }

    let currentRun = run;
    try {
        for (const [index, unit] of units.entries()) {
            throwIfGenerationAborted(options.signal);
            currentRun = runPatch(currentRun, {
                completedUnits: runState.completed,
                failedUnits: runState.failed,
                skippedUnits: runState.skipped,
                currentUnitId: unit.unitId,
                currentUnitIndex: index,
            });
            await checkpointRun(options, currentRun, {
                type: 'run_progress',
                unit,
                index,
                progress: Math.round((index / Math.max(1, units.length)) * 100),
            });

            const result = await runSingleUnit(options, currentRun, unit, runState);
            results.push(result);
            if (result.status === 'complete') runState.completed += 1;
            else if (result.status === 'skipped') runState.skipped += 1;
            else if (result.status === 'cancelled') runState.cancelled += 1;
            else if (result.status === 'failed') runState.failed += 1;

            if (result.stop) {
                const status = result.status === 'superseded' ? 'superseded' : (result.status === 'failed' ? 'failed' : 'partial');
                currentRun = runPatch(currentRun, {
                    status,
                    completedUnits: runState.completed,
                    failedUnits: runState.failed,
                    skippedUnits: runState.skipped,
                    cancelledUnits: runState.cancelled,
                    completedAt: now(),
                    error: result.error?.message || result.unit?.error || '',
                });
                await checkpointRun(options, currentRun, { type: `run_${status}`, result });
                return {
                    status,
                    run: currentRun,
                    units,
                    results,
                    completedUnits: runState.completed,
                    failedUnits: runState.failed,
                    skippedUnits: runState.skipped,
                    cancelledUnits: runState.cancelled,
                };
            }
        }
    } catch (error) {
        const status = isGenerationAbortError(error) ? 'cancelled' : 'failed';
        if (status === 'cancelled') runState.cancelled += 1;
        currentRun = runPatch(currentRun, {
            status,
            completedUnits: runState.completed,
            failedUnits: runState.failed,
            skippedUnits: runState.skipped,
            cancelledUnits: runState.cancelled,
            completedAt: now(),
            error: normalizeError(error).message,
        });
        await checkpointRun(options, currentRun, {
            type: status === 'cancelled' ? 'run_cancelled' : 'run_failed',
            error: normalizeError(error),
        });
        return {
            status,
            run: currentRun,
            units,
            results,
            error: normalizeError(error),
            completedUnits: runState.completed,
            failedUnits: runState.failed,
            skippedUnits: runState.skipped,
            cancelledUnits: runState.cancelled,
        };
    }

    const finalStatus = runState.failed
        ? (runState.completed ? 'partial' : 'failed')
        : 'complete';
    currentRun = runPatch(currentRun, {
        status: finalStatus,
        completedUnits: runState.completed,
        failedUnits: runState.failed,
        skippedUnits: runState.skipped,
        cancelledUnits: runState.cancelled,
        completedAt: now(),
        currentUnitId: '',
    });
    await checkpointRun(options, currentRun, { type: `run_${finalStatus}` });

    return {
        status: finalStatus,
        run: currentRun,
        units,
        results,
        completedUnits: runState.completed,
        failedUnits: runState.failed,
        skippedUnits: runState.skipped,
        cancelledUnits: runState.cancelled,
    };
}

export const __generationJobRunnerTestHooks = Object.freeze({
    cleanId,
    normalizeUnits,
    normalizeError,
    runPatch,
    unitPatch,
});
