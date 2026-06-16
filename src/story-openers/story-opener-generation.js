/**
 * Story Maker provider pipeline.
 */

import { sendLoreRequest } from '../providers/lore-llm-client.js';
import {
    assertLoreResponseText,
    createLoreJsonInvalidDiagnostic,
    LORE_RESPONSE_ERROR_CODES,
} from '../providers/lore-response-normalizer.js';
import {
    getStoryOpenerTargetLength,
    normalizeStoryOpenerFailure,
    normalizeStoryOpenerSession,
    normalizeStoryOpenerString,
} from './story-opener-state.js';

const STORY_OPENER_PROVIDER_KIND = 'lore';
const STORY_OPENER_VARIANT_LETTERS = Object.freeze(['A', 'B', 'C', 'D', 'E']);
const STORY_OPENER_DEFAULT_MAX_ATTEMPTS = 3;
const STORY_OPENER_PROVIDER_UNIT_TIMEOUT_MS = 5 * 60 * 1000;
const STORY_OPENER_REPAIR_TIMEOUT_MS = 2 * 60 * 1000;
const STORY_OPENER_RETRY_BACKOFF_MS = Object.freeze([0, 600, 1800]);
const STORY_OPENER_RETRYABLE_CODES = new Set([
    'provider_timeout',
    'provider_rate_limited',
    'provider_request_failed',
    LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT,
    LORE_RESPONSE_ERROR_CODES.REASONING_ONLY,
    LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT,
    'json_invalid',
    'json_repair_failed',
    'stage_contract_failed',
    'opener_empty_or_rejected',
]);
const STORY_OPENER_NON_RETRYABLE_CODES = new Set([
    'provider_missing_config',
    'provider_auth_failed',
    'user_cancelled',
    'source_missing',
    'source_resolution_failed',
    'guardrail_blocked',
]);
const STORY_OPENER_PROSE_FORMATTING_CONTRACT = `Formatting contract:
- Spoken dialogue must always be enclosed in quotation marks.
- Written text, text being read, and internalized words or thoughts must be italicized with Markdown italics, like *this*.
- Do not use other Markdown formatting unless the opener text itself requires it.`;

let storyOpenerSendLoreRequest = sendLoreRequest;

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(value = [], limit = 80) {
    const input = Array.isArray(value) ? value : [value];
    const out = [];
    const seen = new Set();
    for (const raw of input.flat(Infinity)) {
        if (raw && typeof raw === 'object') continue;
        const text = String(raw || '').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
        if (out.length >= limit) break;
    }
    return out;
}

function compactPromptJson(value) {
    return JSON.stringify(value, null, 2);
}

function nowTimestamp() {
    return Date.now();
}

function normalizeStoryOpenerTimeoutMs(value, fallback = STORY_OPENER_PROVIDER_UNIT_TIMEOUT_MS) {
    const numeric = Math.floor(Number(value));
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    return Math.max(1, Math.floor(Number(fallback) || STORY_OPENER_PROVIDER_UNIT_TIMEOUT_MS));
}

function formatStoryOpenerTimeout(timeoutMs = 0) {
    const seconds = Math.max(1, Math.ceil(Number(timeoutMs || 0) / 1000));
    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function createStoryOpenerTimeoutError(label = 'Story Maker provider request', timeoutMs = STORY_OPENER_PROVIDER_UNIT_TIMEOUT_MS) {
    return createStoryOpenerUnitError(
        'provider_timeout',
        `${label || 'Story Maker provider request'} timed out after ${formatStoryOpenerTimeout(timeoutMs)}.`,
        { timeoutMs },
    );
}

async function runStoryOpenerTimedProviderRequest(label = '', options = {}, factory) {
    const timeoutMs = normalizeStoryOpenerTimeoutMs(options.timeoutMs, STORY_OPENER_PROVIDER_UNIT_TIMEOUT_MS);
    const parentSignal = options.signal || null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const requestSignal = controller?.signal || parentSignal;
    let timeoutId = 0;
    let parentAbort = null;
    let timedOut = false;
    const work = Promise.resolve().then(() => factory(requestSignal));
    const guards = [work];
    guards.push(new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            timedOut = true;
            if (controller && !controller.signal.aborted) controller.abort();
            reject(createStoryOpenerTimeoutError(label, timeoutMs));
        }, timeoutMs);
    }));
    if (parentSignal && typeof parentSignal.addEventListener === 'function') {
        guards.push(new Promise((_, reject) => {
            if (parentSignal.aborted) {
                if (controller && !controller.signal.aborted) controller.abort();
                reject(createStoryOpenerUnitError('user_cancelled', 'Story Maker generation was cancelled.'));
                return;
            }
            parentAbort = () => {
                if (controller && !controller.signal.aborted) controller.abort();
                reject(createStoryOpenerUnitError('user_cancelled', 'Story Maker generation was cancelled.'));
            };
            parentSignal.addEventListener('abort', parentAbort, { once: true });
        }));
    }
    try {
        return await Promise.race(guards);
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (parentSignal && parentAbort && typeof parentSignal.removeEventListener === 'function') {
            parentSignal.removeEventListener('abort', parentAbort);
        }
        if (timedOut) work.catch(() => {});
    }
}

function getStoryOpenerVariantLabel(index = 0) {
    const numeric = Math.max(0, Math.floor(Number(index) || 0));
    return `Variant ${STORY_OPENER_VARIANT_LETTERS[numeric] || String(numeric + 1)}`;
}

function createStoryOpenerUnitError(code = 'provider_request_failed', message = 'Story Maker generation failed.', details = {}) {
    const error = new Error(message || 'Story Maker generation failed.');
    error.name = 'StoryOpenerUnitError';
    error.code = code || 'provider_request_failed';
    error.details = isPlainObject(details) ? details : {};
    return error;
}

function getStoryOpenerErrorCode(error = {}) {
    const details = isPlainObject(error.details) ? error.details : {};
    const existing = normalizeStoryOpenerString(error.code || error.errorCode || details.code || details.errorCode || '', 160);
    if (existing) return existing;
    const name = normalizeStoryOpenerString(error.name, 160);
    const message = String(error?.message || error || '').toLowerCase();
    if (name === 'AbortError' || /request aborted|aborted by user|user cancelled|user canceled/.test(message)) return 'user_cancelled';
    if (/429|rate.?limit|too many requests/.test(message)) return 'provider_rate_limited';
    if (/timed out|timeout|network|failed to fetch|econnreset|socket|temporarily unavailable/.test(message)) return 'provider_timeout';
    if (/401|403|unauthorized|forbidden|api key|auth|credential/.test(message)) return 'provider_auth_failed';
    if (/configuration|not configured|profile is not selected|base url is missing|model is missing|connectionmanagerrequestservice unavailable|no sillytavern raw generation api/.test(message)) return 'provider_missing_config';
    if (name === 'LoreJsonParseError') return 'json_invalid';
    return 'provider_request_failed';
}

function getStoryOpenerRecoveryText(code = 'provider_request_failed') {
    if (code === LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT) {
        return 'Increase Reasoning Provider Max Tokens, reduce opener scope, or use a model/provider with a larger output limit.';
    }
    if (code === LORE_RESPONSE_ERROR_CODES.REASONING_ONLY) {
        return 'Increase max tokens, lower reasoning effort, or use a non-thinking model for visible output.';
    }
    if (code === LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT) {
        return 'Increase max tokens, lower reasoning effort, or try a different Reasoning model/API.';
    }
    if (code === 'json_invalid' || code === 'json_repair_failed') {
        return 'Retry this stage. Saga will repair malformed JSON first, then retry with stricter JSON instructions if needed.';
    }
    if (code === 'stage_contract_failed') {
        return 'Retry this stage with stricter schema guidance, or simplify Context and User Prompt if this repeats.';
    }
    if (code === 'opener_empty_or_rejected') {
        return 'Retry Draft Variants; if repeated, lower Target Length or simplify Prose Style.';
    }
    if (code === 'provider_rate_limited') {
        return 'Saga will retry with backoff. If this repeats, wait briefly or reduce simultaneous variants.';
    }
    if (code === 'provider_timeout' || code === 'provider_request_failed') {
        return 'Retry this stage. If it repeats, test the Reasoning Provider in Settings.';
    }
    if (code === 'provider_auth_failed') {
        return 'Review Reasoning Provider API credentials, profile, endpoint, and model in Settings.';
    }
    if (code === 'provider_missing_config') {
        return 'Open Settings and configure or test the Reasoning Provider.';
    }
    if (code === 'user_cancelled') {
        return 'The Story Maker run was cancelled.';
    }
    return 'Check the Reasoning Provider settings and retry.';
}

function getStoryOpenerFinalFailureMessage(failure = {}, attempts = []) {
    const code = normalizeStoryOpenerString(failure.code, 160);
    const count = Math.max(1, attempts.length || 1);
    const attemptText = `${count} attempt${count === 1 ? '' : 's'}`;
    if (code === LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT) {
        return `The Reasoning Provider returned empty visible output after ${attemptText}. This often means the model is spending output on reasoning, the response was truncated, or the selected API/model is not returning assistant content.`;
    }
    if (code === LORE_RESPONSE_ERROR_CODES.REASONING_ONLY) {
        return `The Reasoning Provider returned reasoning-only output after ${attemptText}. It did not provide usable visible assistant content.`;
    }
    if (code === LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT) {
        return `The Reasoning Provider hit its output token limit after ${attemptText}.`;
    }
    if (code === 'json_invalid' || code === 'json_repair_failed') {
        return `The Reasoning Provider returned malformed Story Maker JSON after ${attemptText}.`;
    }
    if (code === 'stage_contract_failed') {
        return `${failure.message || 'The Reasoning Provider returned JSON that did not satisfy the Story Maker stage contract.'} Saga retried with stricter schema instructions and still could not build a usable result.`;
    }
    if (code === 'opener_empty_or_rejected') {
        return `The Reasoning Provider did not return usable opener prose after ${attemptText}.`;
    }
    if (count > 1 && STORY_OPENER_RETRYABLE_CODES.has(code)) {
        return `${failure.message || 'Story Maker generation failed.'} Saga retried ${count} times but could not recover.`;
    }
    return failure.message || 'Story Maker generation failed.';
}

function normalizeProviderFailure(error = {}, stage = '') {
    const details = isPlainObject(error.details) ? error.details : {};
    const code = getStoryOpenerErrorCode(error);
    return normalizeStoryOpenerFailure({
        code,
        stage,
        message: error?.message || String(error || 'Story Maker generation failed.'),
        recovery: getStoryOpenerRecoveryText(code),
        providerTitle: details.providerTitle || 'Reasoning',
        finishReason: details.finishReason || '',
        maxTokens: details.maxTokens || 0,
        details: {
            ...details,
            code,
        },
    });
}

function isStoryOpenerRetryableFailure(failure = {}) {
    const code = normalizeStoryOpenerString(failure.code, 160);
    if (!code) return true;
    if (STORY_OPENER_NON_RETRYABLE_CODES.has(code)) return false;
    return STORY_OPENER_RETRYABLE_CODES.has(code);
}

function compactStoryOpenerPacketForRetry(packet = {}) {
    if (!isPlainObject(packet)) return packet;
    return {
        ...packet,
        fresh: Array.isArray(packet.fresh) ? packet.fresh.slice(0, 10) : packet.fresh,
        mustUse: Array.isArray(packet.mustUse) ? packet.mustUse.slice(0, 18) : packet.mustUse,
        supporting: Array.isArray(packet.supporting) ? packet.supporting.slice(0, 8) : packet.supporting,
        mustAvoid: Array.isArray(packet.mustAvoid) ? packet.mustAvoid.slice(0, 40) : packet.mustAvoid,
    };
}

function getStoryOpenerRetryInstruction(stage = '', expectedOutput = 'json', previousFailure = {}) {
    const code = normalizeStoryOpenerString(previousFailure.code, 160);
    if (expectedOutput === 'text') {
        if (code === LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT) {
            return `Retry instruction: return only the visible opener prose, keep it tighter, follow the formatting contract, and do not include labels, JSON, markdown fences, commentary, or analysis. ${STORY_OPENER_PROSE_FORMATTING_CONTRACT}`;
        }
        return `Retry instruction: return only visible opener prose in message.content and follow the formatting contract. Do not return JSON, labels, title text, markdown fences, commentary, or analysis. ${STORY_OPENER_PROSE_FORMATTING_CONTRACT}`;
    }
    if (code === 'stage_contract_failed') {
        const missing = Array.isArray(previousFailure.details?.missing) ? previousFailure.details.missing.join(', ') : '';
        return `Retry instruction: return one valid JSON object only. Include every required field${missing ? `, especially: ${missing}` : ''}. No markdown, commentary, prose wrapper, or analysis.`;
    }
    if (code === LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT) {
        return 'Retry instruction: return compact valid JSON only. Keep arrays short, preserve hard exclusions, and omit empty optional fields. No markdown or commentary.';
    }
    if (code === LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT || code === LORE_RESPONSE_ERROR_CODES.REASONING_ONLY) {
        return 'Retry instruction: put the final JSON in visible assistant content. Do not leave message.content empty. No markdown, commentary, prose wrapper, or analysis.';
    }
    if (stage === 'context_packet') {
        return 'Retry instruction: return valid JSON only using the supplied IDs. No markdown, commentary, prose wrapper, or analysis.';
    }
    return 'Retry instruction: return valid JSON only. The first visible character must be { and the last visible character must be }. No markdown, commentary, prose wrapper, or analysis.';
}

function applyStoryOpenerRetryPrompt(prompt = {}, context = {}) {
    if (context.attempt <= 1) return prompt;
    const instruction = getStoryOpenerRetryInstruction(context.stage, context.expectedOutput, context.previousFailure);
    return {
        system: `${prompt.system}

STORY MAKER RETRY REQUIREMENT:
${instruction}`,
        user: `${prompt.user}

${instruction}`,
    };
}

function createStoryOpenerAttemptDiagnostic(fields = {}) {
    const failure = fields.failure || null;
    const details = isPlainObject(failure?.details) ? failure.details : {};
    return {
        attemptId: normalizeStoryOpenerString(fields.attemptId, 180) || `attempt-${fields.stage || 'stage'}-${fields.unitId || 'unit'}-${fields.attempt || 1}-${nowTimestamp().toString(36)}`,
        stage: normalizeStoryOpenerString(fields.stage, 80),
        unitId: normalizeStoryOpenerString(fields.unitId, 160),
        variantIndex: Number.isFinite(Number(fields.variantIndex)) ? Math.floor(Number(fields.variantIndex)) : null,
        variantLabel: normalizeStoryOpenerString(fields.variantLabel, 80),
        attempt: Math.max(1, Math.floor(Number(fields.attempt) || 1)),
        maxAttempts: Math.max(1, Math.floor(Number(fields.maxAttempts) || 1)),
        status: fields.status === 'complete' ? 'complete' : 'error',
        strategy: normalizeStoryOpenerString(fields.strategy, 120),
        providerTitle: normalizeStoryOpenerString(failure?.providerTitle || details.providerTitle || 'Reasoning', 160),
        errorCode: normalizeStoryOpenerString(failure?.code || details.code || '', 160),
        message: normalizeStoryOpenerString(fields.message || failure?.message || '', 1000),
        recovery: normalizeStoryOpenerString(failure?.recovery || '', 1000),
        finishReason: normalizeStoryOpenerString(failure?.finishReason || details.finishReason || '', 160),
        maxTokens: Math.max(0, Math.floor(Number(failure?.maxTokens || details.maxTokens || fields.maxTokens) || 0)),
        visibleContentLength: Math.max(0, Math.floor(Number(fields.visibleContentLength ?? details.visibleContentLength) || 0)),
        repairAttempted: fields.repairAttempted === true,
        startedAt: Math.max(0, Math.floor(Number(fields.startedAt) || 0)),
        completedAt: Math.max(0, Math.floor(Number(fields.completedAt) || 0)),
    };
}

function finalizeStoryOpenerFailure(failure = {}, attempts = [], maxAttempts = STORY_OPENER_DEFAULT_MAX_ATTEMPTS) {
    const normalized = normalizeStoryOpenerFailure(failure);
    const compactAttempts = attempts.map(attempt => createStoryOpenerAttemptDiagnostic(attempt)).slice(-40);
    return normalizeStoryOpenerFailure({
        ...normalized,
        message: getStoryOpenerFinalFailureMessage(normalized, compactAttempts),
        recovery: normalized.recovery || getStoryOpenerRecoveryText(normalized.code),
        details: {
            ...(isPlainObject(normalized.details) ? normalized.details : {}),
            attempts: compactAttempts,
            attemptCount: compactAttempts.length,
            maxAttempts,
        },
    });
}

function emitStoryOpenerProgress(onProgress, event = {}) {
    if (typeof onProgress !== 'function') return;
    try {
        onProgress({
            ...event,
            timestamp: nowTimestamp(),
        });
    } catch (error) {
        console.warn('[Saga] Story Maker progress callback failed:', error);
    }
}

async function waitForStoryOpenerRetry(attempt = 1, options = {}) {
    const override = options.retryDelayMs;
    const delay = Number.isFinite(Number(override))
        ? Math.max(0, Number(override))
        : (STORY_OPENER_RETRY_BACKOFF_MS[attempt] || STORY_OPENER_RETRY_BACKOFF_MS[STORY_OPENER_RETRY_BACKOFF_MS.length - 1] || 0);
    if (!delay) return;
    await new Promise((resolve, reject) => {
        if (options.signal?.aborted) {
            reject(createStoryOpenerUnitError('user_cancelled', 'Story Maker generation was cancelled.'));
            return;
        }
        const timer = setTimeout(resolve, delay);
        if (options.signal && typeof options.signal.addEventListener === 'function') {
            const abort = () => {
                clearTimeout(timer);
                reject(createStoryOpenerUnitError('user_cancelled', 'Story Maker generation was cancelled.'));
            };
            options.signal.addEventListener('abort', abort, { once: true });
        }
    });
}

async function runStoryOpenerProviderUnit(config = {}) {
    const maxAttempts = Math.max(1, Math.min(5, Math.floor(Number(config.maxAttempts || STORY_OPENER_DEFAULT_MAX_ATTEMPTS) || STORY_OPENER_DEFAULT_MAX_ATTEMPTS)));
    const attempts = [];
    let previousFailure = null;
    const stage = normalizeStoryOpenerString(config.stage, 80);
    const unitId = normalizeStoryOpenerString(config.unitId || stage, 160);
    const retryLabel = normalizeStoryOpenerString(config.retryLabel || config.label || unitId, 120);
    const expectedOutput = config.expectedOutput === 'text' ? 'text' : 'json';
    const maxTokens = Math.max(1, Math.floor(Number(config.maxTokens || 4096) || 4096));
    const timeoutMs = normalizeStoryOpenerTimeoutMs(config.timeoutMs, STORY_OPENER_PROVIDER_UNIT_TIMEOUT_MS);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const startedAt = nowTimestamp();
        const status = attempt > 1 ? 'retrying' : 'running';
        const strategy = attempt === 1
            ? 'normal'
            : (attempt >= 3 ? 'compact_retry' : `${expectedOutput}_retry`);
        const label = attempt > 1 ? `Retrying ${retryLabel}, attempt ${attempt} of ${maxAttempts}` : (config.label || retryLabel);
        emitStoryOpenerProgress(config.onProgress, {
            stage,
            unitId,
            variantIndex: config.variantIndex,
            variantLabel: config.variantLabel,
            status,
            attempt,
            maxAttempts,
            label,
            message: attempt > 1 ? `Retrying after ${previousFailure?.code || 'provider failure'}.` : 'Contacting Reasoning Provider.',
        });
        try {
            const basePrompt = await config.buildPrompt({
                attempt,
                maxAttempts,
                previousFailure,
                compact: attempt >= 3,
                strategy,
            });
            const prompt = applyStoryOpenerRetryPrompt(basePrompt, {
                attempt,
                stage,
                expectedOutput,
                previousFailure,
            });
            const response = await runStoryOpenerTimedProviderRequest(retryLabel, {
                signal: config.signal,
                timeoutMs,
            }, signal => storyOpenerSendLoreRequest(prompt.system, prompt.user, {
                providerKind: STORY_OPENER_PROVIDER_KIND,
                maxTokens,
                prefill: config.prefill,
                signal,
                forceVisibleOutput: attempt > 1 && (
                    previousFailure?.code === LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT
                    || previousFailure?.code === LORE_RESPONSE_ERROR_CODES.REASONING_ONLY
                ),
                expectedOutput,
                onProgress: event => {
                    emitStoryOpenerProgress(config.onProgress, {
                        ...(event || {}),
                        stage,
                        unitId,
                        variantIndex: config.variantIndex,
                        variantLabel: config.variantLabel,
                        status,
                        attempt,
                        maxAttempts,
                        label,
                        message: event?.message || (attempt > 1 ? `Retrying ${retryLabel}.` : `Waiting for ${retryLabel}.`),
                    });
                },
            }));
            const text = assertLoreResponseText(response, {
                providerTitle: 'Reasoning',
                maxTokens,
                retried: attempt > 1,
            });
            const value = await config.handleText(text, {
                attempt,
                maxAttempts,
                previousFailure,
                compact: attempt >= 3,
                strategy,
                label,
                onProgress: config.onProgress,
            });
            const completedAt = nowTimestamp();
            const diagnostic = createStoryOpenerAttemptDiagnostic({
                stage,
                unitId,
                variantIndex: config.variantIndex,
                variantLabel: config.variantLabel,
                attempt,
                maxAttempts,
                status: 'complete',
                strategy,
                maxTokens,
                visibleContentLength: text.length,
                repairAttempted: value?.repairAttempted === true,
                message: `${retryLabel} completed.`,
                startedAt,
                completedAt,
            });
            attempts.push(diagnostic);
            return {
                ok: true,
                ...(isPlainObject(value) ? value : { value }),
                rawText: text,
                attempts,
                attemptCount: attempts.length,
            };
        } catch (error) {
            const failure = normalizeProviderFailure(error, stage);
            const completedAt = nowTimestamp();
            const diagnostic = createStoryOpenerAttemptDiagnostic({
                stage,
                unitId,
                variantIndex: config.variantIndex,
                variantLabel: config.variantLabel,
                attempt,
                maxAttempts,
                status: 'error',
                strategy,
                failure,
                maxTokens,
                visibleContentLength: error?.details?.visibleContentLength || error?.details?.diagnostic?.visibleContentLength || 0,
                repairAttempted: error?.details?.repairAttempted === true,
                startedAt,
                completedAt,
            });
            attempts.push(diagnostic);
            previousFailure = failure;
            const retryable = isStoryOpenerRetryableFailure(failure);
            if (attempt >= maxAttempts || !retryable) {
                const finalFailure = finalizeStoryOpenerFailure(failure, attempts, maxAttempts);
                return { ok: false, failure: finalFailure, attempts, attemptCount: attempts.length };
            }
            emitStoryOpenerProgress(config.onProgress, {
                stage,
                unitId,
                variantIndex: config.variantIndex,
                variantLabel: config.variantLabel,
                status: 'retrying',
                attempt,
                maxAttempts,
                label: `Retrying ${retryLabel}, attempt ${attempt + 1} of ${maxAttempts}`,
                message: `${failure.code || 'Provider failure'}: ${failure.recovery || 'Retrying.'}`,
                attempts: attempts.slice(),
            });
            await waitForStoryOpenerRetry(attempt, config);
        }
    }
    const failure = finalizeStoryOpenerFailure(normalizeStoryOpenerFailure({
        code: 'provider_request_failed',
        stage,
        message: `${retryLabel} failed after retry attempts.`,
        recovery: getStoryOpenerRecoveryText('provider_request_failed'),
    }), attempts, maxAttempts);
    return { ok: false, failure, attempts, attemptCount: attempts.length };
}

function stripReasoningBlocks(text = '') {
    return String(text || '')
        .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
        .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
        .trim();
}

function stripMarkdownFence(text = '') {
    const clean = stripReasoningBlocks(text).trim();
    const fenced = clean.match(/^```(?:json|text|markdown)?\s*([\s\S]*?)\s*```$/i);
    return (fenced ? fenced[1] : clean).trim();
}

function extractBalancedJsonObject(text = '') {
    const clean = stripMarkdownFence(text);
    const start = clean.indexOf('{');
    if (start < 0) return '';
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let index = start; index < clean.length; index += 1) {
        const char = clean[index];
        if (escape) {
            escape = false;
            continue;
        }
        if (char === '\\') {
            escape = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return clean.slice(start, index + 1);
        }
    }
    return clean.slice(start);
}

function repairCommonJson(text = '') {
    return String(text || '')
        .replace(/^\uFEFF/, '')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/“|”/g, '"')
        .replace(/‘|’/g, "'")
        .replace(/\/\/[^\n\r]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
}

export function parseStoryOpenerJsonResponse(text = '') {
    const candidates = [
        stripMarkdownFence(text),
        extractBalancedJsonObject(text),
        repairCommonJson(extractBalancedJsonObject(text)),
    ].filter(Boolean);
    let lastError = null;
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (isPlainObject(parsed)) return { ok: true, value: parsed, repaired: candidate !== candidates[0] };
        } catch (error) {
            lastError = error;
        }
    }
    return {
        ok: false,
        error: lastError?.message || 'Model response was not valid JSON.',
        diagnostic: createLoreJsonInvalidDiagnostic(lastError?.message || 'Model response was not valid JSON.', {
            sample: String(text || '').slice(0, 600),
        }),
    };
}

async function repairStoryOpenerJsonWithProvider(rawText = '', schemaName = 'Story Maker JSON', options = {}) {
    const system = `You repair malformed Saga ${schemaName} responses.
Return valid JSON only. Preserve every usable field. Do not add facts that were not present.`;
    const user = `Repair this malformed response into valid JSON for ${schemaName}.

Malformed response:
${rawText}`;
    const response = await runStoryOpenerTimedProviderRequest(`${schemaName} repair`, {
        signal: options.signal,
        timeoutMs: normalizeStoryOpenerTimeoutMs(options.timeoutMs, STORY_OPENER_REPAIR_TIMEOUT_MS),
    }, signal => storyOpenerSendLoreRequest(system, user, {
        providerKind: STORY_OPENER_PROVIDER_KIND,
        maxTokens: options.maxTokens || 2048,
        prefill: '{',
        signal,
        onProgress: options.onProgress,
    }));
    const text = assertLoreResponseText(response, {
        providerTitle: 'Reasoning',
        maxTokens: options.maxTokens || 2048,
    });
    return parseStoryOpenerJsonResponse(`{${String(text || '').replace(/^\s*\{/, '')}`);
}

function normalizeBrief(value = {}, packet = {}, controls = {}) {
    const raw = isPlainObject(value) ? value : {};
    const targetLength = getStoryOpenerTargetLength(raw.targetLength || controls.targetLength).id;
    const brief = {
        schemaVersion: 1,
        fandoms: uniqueStrings(raw.fandoms || packet.fandoms, 12),
        context: normalizeStoryOpenerString(raw.context || packet.context || controls.context, 2000),
        proseStyle: normalizeStoryOpenerString(raw.proseStyle || controls.proseStyle, 1200),
        openingShape: normalizeStoryOpenerString(raw.openingShape || controls.openingShape, 180),
        characterFocus: normalizeStoryOpenerString(raw.characterFocus || controls.characterFocus, 800),
        pov: normalizeStoryOpenerString(raw.pov || controls.pov, 160),
        tense: normalizeStoryOpenerString(raw.tense || controls.tense, 120),
        targetLength,
        premise: normalizeStoryOpenerString(raw.premise || raw.prompt || controls.userPrompt, 1400),
        styleGuidance: normalizeStoryOpenerString(raw.styleGuidance, 1600),
        lengthGuidance: normalizeStoryOpenerString(raw.lengthGuidance, 900),
        scenePlan: uniqueStrings(raw.scenePlan || raw.beats, 16).slice(0, 12),
        mustInclude: uniqueStrings(raw.mustInclude || raw.include, 32),
        freshEmphasis: uniqueStrings(raw.freshEmphasis || raw.fresh, 20),
        mustAvoid: uniqueStrings(raw.mustAvoid || raw.avoid, 32),
        variantAngles: uniqueStrings(raw.variantAngles || raw.angles, 6),
    };
    const requiredMissing = [];
    for (const key of ['premise', 'styleGuidance']) {
        if (!brief[key]) requiredMissing.push(key);
    }
    if (!brief.scenePlan.length) requiredMissing.push('scenePlan');
    if (!brief.mustInclude.length && (packet.mustUse || []).length) requiredMissing.push('mustInclude');
    return {
        ok: requiredMissing.length === 0,
        brief,
        missing: requiredMissing,
    };
}

function applyFactRefinement(packet = {}, refinement = null) {
    if (!refinement || !isPlainObject(refinement)) return packet;
    const allowedById = new Map([...(packet.mustUse || []), ...(packet.supporting || [])].map(fact => [fact.id, fact]));
    const avoidById = new Map((packet.mustAvoid || []).map(fact => [fact.id, fact]));
    const selectedIds = uniqueStrings(refinement.selectedFactIds, 40);
    const freshIds = uniqueStrings(refinement.freshFactIds, 20);
    const avoidIds = uniqueStrings(refinement.mustAvoidIds, 40);
    const selectedFacts = selectedIds.map(id => allowedById.get(id)).filter(Boolean);
    const freshFacts = freshIds.map(id => allowedById.get(id)).filter(Boolean);
    const avoidFacts = avoidIds.map(id => avoidById.get(id)).filter(Boolean);
    return {
        ...packet,
        mustUse: selectedFacts.length ? selectedFacts : packet.mustUse,
        fresh: freshFacts.length ? freshFacts : packet.fresh,
        mustAvoid: avoidFacts.length ? avoidFacts : packet.mustAvoid,
        providerRefinement: {
            selectedFactIds: selectedFacts.map(fact => fact.id),
            freshFactIds: freshFacts.map(fact => fact.id),
            mustAvoidIds: avoidFacts.map(fact => fact.id),
            rationale: normalizeStoryOpenerString(refinement.rationale, 900),
        },
    };
}

export async function refineStoryOpenerFacts(packet = {}, controls = {}, options = {}) {
    const candidates = [...(packet.mustUse || []), ...(packet.supporting || [])];
    if (!candidates.length || candidates.length <= 18) {
        return { ok: true, packet, skipped: true };
    }
    const result = await runStoryOpenerProviderUnit({
        stage: 'context_packet',
        unitId: 'source_fact_refinement',
        label: 'Selecting Source Facts',
        retryLabel: 'Source Fact Selection',
        expectedOutput: 'json',
        maxTokens: options.maxTokens || 2048,
        prefill: '{',
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        retryDelayMs: options.retryDelayMs,
        onProgress: options.onProgress,
        buildPrompt: ({ compact = false }) => {
            const factLimit = compact ? 30 : 60;
            const avoidLimit = compact ? 30 : 45;
            const system = `You are Saga's Story Maker source selector.
Choose the facts that matter most for one opening scene. Return JSON only.`;
            const user = `Select the highest-value facts for the opener. Use only IDs from the candidate lists.

Return exactly this JSON shape:
{
  "selectedFactIds": ["id"],
  "freshFactIds": ["id"],
  "mustAvoidIds": ["id"],
  "rationale": "one short explanation"
}

Story controls:
${compactPromptJson(controls)}

Context Packet candidates:
${compactPromptJson({
    context: packet.context,
    fandoms: packet.fandoms,
    mustUse: candidates.slice(0, factLimit).map(fact => ({ id: fact.id, title: fact.title, fact: fact.fact, sourceType: fact.sourceType, score: fact.score, temporalRole: fact.temporalRole, lifecycleStatus: fact.lifecycleStatus })),
    mustAvoid: (packet.mustAvoid || []).slice(0, avoidLimit).map(fact => ({ id: fact.id, title: fact.title, fact: fact.fact, lifecycleStatus: fact.lifecycleStatus, reason: fact.lifecycleReason })),
})}`;
            return { system, user };
        },
        handleText: async (text, context) => {
            let parsed = parseStoryOpenerJsonResponse(text);
            let repairAttempted = false;
            if (!parsed.ok && options.repair !== false) {
                repairAttempted = true;
                emitStoryOpenerProgress(context.onProgress, {
                    stage: 'context_packet',
                    unitId: 'source_fact_refinement',
                    status: 'running',
                    attempt: context.attempt,
                    maxAttempts: context.maxAttempts,
                    label: 'Repairing Source Fact Selection JSON',
                    message: 'Repairing malformed source-selection JSON.',
                });
                parsed = await repairStoryOpenerJsonWithProvider(text, 'Story Maker Fact Refinement', {
                    ...options,
                    onProgress: context.onProgress,
                });
            }
            if (!parsed.ok) {
                throw createStoryOpenerUnitError(repairAttempted ? 'json_repair_failed' : 'json_invalid', parsed.error || 'Fact refinement JSON could not be parsed.', {
                    diagnostic: parsed.diagnostic,
                    repairAttempted,
                    visibleContentLength: text.length,
                });
            }
            return {
                packet: applyFactRefinement(packet, parsed.value),
                refinement: parsed.value,
                repairAttempted,
            };
        },
    });
    if (!result.ok) {
        return {
            ok: false,
            packet,
            failure: result.failure,
            attempts: result.attempts || [],
        };
    }
    return {
        ok: true,
        packet: result.packet,
        refinement: result.refinement,
        repairAttempted: result.repairAttempted === true,
        attempts: result.attempts || [],
    };
}

function buildBriefPrompt(session = {}, packet = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const controls = normalized.controls;
    const target = getStoryOpenerTargetLength(controls.targetLength);
    const system = `You are Saga's Story Maker prompt architect.
Create a precise writing brief for a later model call. Return JSON only.
Use only the supplied Context Packet facts. Do not introduce unsupported facts.
Respect mustAvoid as hard exclusions. The prose style should evoke fandom-era conventions without copying any passage.`;
    const user = `Build a fantastic opener-writing brief.

Return exactly this JSON shape:
{
  "fandoms": ["fandom"],
  "context": "story position",
  "premise": "what the opener should accomplish",
  "proseStyle": "style instruction",
  "openingShape": "shape instruction",
  "characterFocus": "optional focus",
  "pov": "point of view",
  "tense": "tense",
  "targetLength": "hook|scene|chapter",
  "styleGuidance": "concrete prose guidance",
  "lengthGuidance": "pacing guidance",
  "scenePlan": ["beat"],
  "mustInclude": ["fact summary"],
  "freshEmphasis": ["fresh fact summary"],
  "mustAvoid": ["exclusion"],
  "variantAngles": ["direct/default", "minor alternate angle", "minor alternate angle"]
}

Controls:
${compactPromptJson({
    userPrompt: controls.userPrompt,
    context: controls.context,
    proseStyle: controls.proseStyle,
    openingShape: controls.openingShape,
    characterFocus: controls.characterFocus,
    pov: controls.pov,
    tense: controls.tense,
    targetLength: target,
})}

Context Packet:
${compactPromptJson({
    context: packet.context,
    contextState: packet.contextState,
    fandoms: packet.fandoms,
    fresh: packet.fresh,
    mustUse: packet.mustUse,
    supporting: packet.supporting,
    mustAvoid: packet.mustAvoid,
})}`;
    return { system, user };
}

export async function buildStoryOpenerBrief(session = {}, packet = {}, options = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const refined = await refineStoryOpenerFacts(packet, normalized.controls, options);
    const effectivePacket = refined.packet || packet;
    const result = await runStoryOpenerProviderUnit({
        stage: 'opener_brief',
        unitId: 'opener_brief',
        label: 'Drafting Opener Brief',
        retryLabel: 'Opener Brief',
        expectedOutput: 'json',
        maxTokens: options.maxTokens || 4096,
        prefill: '{',
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        retryDelayMs: options.retryDelayMs,
        onProgress: options.onProgress,
        buildPrompt: ({ compact = false }) => buildBriefPrompt(normalized, compact ? compactStoryOpenerPacketForRetry(effectivePacket) : effectivePacket),
        handleText: async (text, context) => {
            let parsed = parseStoryOpenerJsonResponse(text);
            let repairAttempted = false;
            if (!parsed.ok && options.repair !== false) {
                repairAttempted = true;
                emitStoryOpenerProgress(context.onProgress, {
                    stage: 'opener_brief',
                    unitId: 'opener_brief',
                    status: 'running',
                    attempt: context.attempt,
                    maxAttempts: context.maxAttempts,
                    label: 'Repairing Opener Brief JSON',
                    message: 'Repairing malformed Opener Brief JSON.',
                });
                parsed = await repairStoryOpenerJsonWithProvider(text, 'Story Maker Brief', {
                    ...options,
                    onProgress: context.onProgress,
                });
            }
            if (!parsed.ok) {
                throw createStoryOpenerUnitError(repairAttempted ? 'json_repair_failed' : 'json_invalid', parsed.error || 'Opener Brief response was not valid JSON.', {
                    diagnostic: parsed.diagnostic,
                    repairAttempted,
                    visibleContentLength: text.length,
                });
            }
            const normalizedBrief = normalizeBrief(parsed.value, effectivePacket, normalized.controls);
            if (!normalizedBrief.ok) {
                throw createStoryOpenerUnitError('stage_contract_failed', `Opener Brief JSON omitted required fields: ${normalizedBrief.missing.join(', ')}.`, {
                    missing: normalizedBrief.missing,
                    repairAttempted,
                    visibleContentLength: text.length,
                });
            }
            return {
                brief: normalizedBrief.brief,
                repairAttempted,
            };
        },
    });
    if (!result.ok) {
        return {
            ok: false,
            packet: effectivePacket,
            failure: result.failure,
            attempts: [...(refined.attempts || []), ...(result.attempts || [])],
        };
    }
    return {
        ok: true,
        packet: effectivePacket,
        brief: result.brief,
        rawText: result.rawText || '',
        repairAttempted: result.repairAttempted === true,
        refinement: refined.refinement || null,
        refinementFailure: refined.failure || null,
        attempts: [...(refined.attempts || []), ...(result.attempts || [])],
    };
}

function getTargetLengthGuidance(targetLength = 'scene') {
    if (targetLength === 'hook') return 'Write a compact opener: one scene entry, one strong hook, minimal exposition.';
    if (targetLength === 'chapter') return 'Write a fuller opener: room for atmosphere, character interiority, and two or three scene beats.';
    return 'Write a balanced opener: enough setup and character grounding for a strong first reply without turning into a full chapter.';
}

function buildOpenerPrompt(session = {}, packet = {}, brief = {}, variantIndex = 0, revisionPrompt = '') {
    const normalized = normalizeStoryOpenerSession(session);
    const controls = normalized.controls;
    const selectedAngle = brief.variantAngles?.[variantIndex] || (variantIndex === 0 ? 'direct/default opener' : `minor variation ${variantIndex + 1}`);
    const previous = normalizeStoryOpenerString(normalized.variants.find(variant => variant.id === normalized.selectedVariantId)?.text || normalized.variants[0]?.text || '', 12000);
    const system = `You are Saga's Story Maker writer.
Write only the finished opener prose. Do not include analysis, labels, JSON, commentary, title text, markdown fences, or extra wrapper formatting.
Use Markdown italics only where the formatting contract requires italics.
Respect all exclusions. Use only supplied facts. The style may evoke fandom-era prose conventions, but do not copy or quote canon prose.`;
    const user = `Write the opener from this brief.

Variant angle: ${selectedAngle}
Revision instruction: ${revisionPrompt || 'None'}

Length guidance: ${brief.lengthGuidance || getTargetLengthGuidance(controls.targetLength)}

${STORY_OPENER_PROSE_FORMATTING_CONTRACT}

Brief:
${compactPromptJson(brief)}

Hard exclusions:
${compactPromptJson(brief.mustAvoid?.length ? brief.mustAvoid : (packet.mustAvoid || []).map(fact => fact.fact || fact.title))}

Previous opener to revise, if any:
${previous || 'None'}

Output visible opener prose only, with the formatting contract applied.`;
    return { system, user };
}

function compactStoryOpenerBriefForRetry(brief = {}) {
    if (!isPlainObject(brief)) return brief;
    return {
        ...brief,
        styleGuidance: normalizeStoryOpenerString(brief.styleGuidance, 900),
        lengthGuidance: normalizeStoryOpenerString(brief.lengthGuidance, 500),
        scenePlan: Array.isArray(brief.scenePlan) ? brief.scenePlan.slice(0, 6) : brief.scenePlan,
        mustInclude: Array.isArray(brief.mustInclude) ? brief.mustInclude.slice(0, 18) : brief.mustInclude,
        freshEmphasis: Array.isArray(brief.freshEmphasis) ? brief.freshEmphasis.slice(0, 10) : brief.freshEmphasis,
        mustAvoid: Array.isArray(brief.mustAvoid) ? brief.mustAvoid.slice(0, 28) : brief.mustAvoid,
        variantAngles: Array.isArray(brief.variantAngles) ? brief.variantAngles.slice(0, 5) : brief.variantAngles,
    };
}

function normalizeOpenerText(text = '') {
    const clean = stripMarkdownFence(text)
        .replace(/^["']([\s\S]*)["']$/m, '$1')
        .trim();
    if (!clean) return '';
    if (/^\s*\{[\s\S]*\}\s*$/.test(clean)) return '';
    if (/^(here(?:'s| is)|sure[,!]|certainly[,!])/i.test(clean)) {
        return clean.replace(/^(here(?:'s| is)[^:\n]*:|sure[,!]\s*|certainly[,!]\s*)/i, '').trim();
    }
    return clean;
}

export async function writeStoryOpenerVariant(session = {}, packet = {}, brief = {}, variantIndex = 0, options = {}) {
    const revisionPrompt = normalizeStoryOpenerString(options.revisionPrompt, 5000);
    const variantLabel = getStoryOpenerVariantLabel(variantIndex);
    const actionLabel = `${revisionPrompt ? 'Revising' : 'Drafting'} ${variantLabel}`;
    const result = await runStoryOpenerProviderUnit({
        stage: 'draft_variants',
        unitId: `variant_${variantIndex + 1}`,
        variantIndex,
        variantLabel,
        label: actionLabel,
        retryLabel: revisionPrompt ? 'Revision' : variantLabel,
        expectedOutput: 'text',
        maxTokens: options.maxTokens || 4096,
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        retryDelayMs: options.retryDelayMs,
        onProgress: options.onProgress,
        buildPrompt: ({ compact = false }) => buildOpenerPrompt(session, compact ? compactStoryOpenerPacketForRetry(packet) : packet, compact ? compactStoryOpenerBriefForRetry(brief) : brief, variantIndex, revisionPrompt),
        handleText: async text => {
            const normalizedText = normalizeOpenerText(text);
            if (!normalizedText) {
                throw createStoryOpenerUnitError('opener_empty_or_rejected', `${variantLabel} returned no usable plain opener text.`, {
                    visibleContentLength: text.length,
                });
            }
            return { text: normalizedText };
        },
    });
    if (!result.ok) {
        const failure = normalizeStoryOpenerFailure({
            ...result.failure,
            message: `${variantLabel}: ${result.failure.message || 'Provider failed to draft this opener variant.'}`,
            details: {
                ...(isPlainObject(result.failure?.details) ? result.failure.details : {}),
                variantIndex,
                variantLabel,
            },
        });
        return {
            ok: false,
            variantIndex,
            variantLabel,
            failure,
            attempts: result.attempts || [],
        };
    }
    const { user } = buildOpenerPrompt(session, packet, brief, variantIndex, revisionPrompt);
    return {
        ok: true,
        variantIndex,
        variantLabel,
        variant: {
            id: `variant-${Date.now().toString(36)}-${variantIndex + 1}`,
            label: variantLabel,
            variantIndex,
            text: result.text,
            prompt: user,
            createdAt: Date.now(),
            status: 'draft',
            attemptCount: result.attemptCount || 1,
        },
        rawText: result.rawText || '',
        attempts: result.attempts || [],
    };
}

export async function writeStoryOpenerVariants(session = {}, packet = {}, brief = {}, options = {}) {
    const normalized = normalizeStoryOpenerSession(session);
    const count = normalized.controls.variantCount;
    const requestedIndexes = Array.isArray(options.variantIndexes)
        ? options.variantIndexes
            .map(index => Math.floor(Number(index)))
            .filter(index => Number.isFinite(index) && index >= 0 && index < count)
        : Array.from({ length: count }, (_, index) => index);
    const targetIndexes = requestedIndexes.length ? [...new Set(requestedIndexes)] : Array.from({ length: count }, (_, index) => index);
    const settled = await Promise.allSettled(targetIndexes.map(index => writeStoryOpenerVariant(normalized, packet, brief, index, options)));
    const results = settled.map((item, index) => {
        if (item.status === 'fulfilled') return item.value;
        const variantIndex = targetIndexes[index];
        const variantLabel = getStoryOpenerVariantLabel(variantIndex);
        return {
            ok: false,
            variantIndex,
            variantLabel,
            failure: normalizeStoryOpenerFailure({
                ...normalizeProviderFailure(item.reason, 'draft_variants'),
                message: `${variantLabel}: ${item.reason?.message || 'Provider failed to draft this opener variant.'}`,
                details: { variantIndex, variantLabel },
            }),
            attempts: [],
        };
    });
    const variants = results
        .map(result => result.ok ? ({ ...result.variant, id: `variant-${Date.now().toString(36)}-${result.variantIndex + 1}` }) : null)
        .filter(Boolean);
    const failures = results
        .filter(result => !result.ok)
        .map(result => result.failure)
        .filter(Boolean);
    const failedVariantIndexes = results
        .filter(result => !result.ok)
        .map(result => result.variantIndex)
        .filter(index => Number.isFinite(index));
    const failedVariantLabels = failedVariantIndexes.map(index => getStoryOpenerVariantLabel(index));
    const attempts = results.flatMap(result => Array.isArray(result.attempts) ? result.attempts : []);
    if (!variants.length) {
        const firstFailure = failures[0] || normalizeStoryOpenerFailure({
            code: 'draft_variants_failed',
            stage: 'draft_variants',
            message: 'No opener variants were usable.',
            recovery: 'Retry Draft Variants or simplify the opener controls.',
        });
        return {
            ok: false,
            variants,
            failures,
            failedVariantIndexes,
            failedVariantLabels,
            attempts,
            failure: normalizeStoryOpenerFailure({
                code: 'draft_variants_failed',
                stage: 'draft_variants',
                message: `No opener variants were usable after retry attempts. ${failedVariantLabels.length ? `${failedVariantLabels.join(', ')} failed.` : ''}`.trim(),
                recovery: firstFailure.recovery || 'Retry Draft Variants or simplify the opener controls.',
                providerTitle: firstFailure.providerTitle,
                finishReason: firstFailure.finishReason,
                maxTokens: firstFailure.maxTokens,
                details: {
                    ...(isPlainObject(firstFailure.details) ? firstFailure.details : {}),
                    firstFailure,
                    failedVariantIndexes,
                    failedVariantLabels,
                    failures,
                    attempts,
                },
            }),
        };
    }
    const partialFailure = failures.length
        ? normalizeStoryOpenerFailure({
            code: 'draft_variants_partial_failed',
            stage: 'draft_variants',
            message: `Created ${variants.length} of ${targetIndexes.length} requested variants. ${failedVariantLabels.join(', ')} failed after retry attempts.`,
            recovery: 'Review the successful variants or retry the failed variants.',
            details: {
                failedVariantIndexes,
                failedVariantLabels,
                attempts,
                failures,
            },
        })
        : null;
    return { ok: true, variants, failures, failedVariantIndexes, failedVariantLabels, partialFailure, attempts };
}

export const __storyOpenerGenerationTestHooks = Object.freeze({
    parseStoryOpenerJsonResponse,
    normalizeOpenerText,
    normalizeBrief,
    getStoryOpenerVariantLabel,
    runStoryOpenerProviderUnit,
    setStoryOpenerRequestForTests(fn) {
        const previous = storyOpenerSendLoreRequest;
        storyOpenerSendLoreRequest = typeof fn === 'function' ? fn : sendLoreRequest;
        return () => {
            storyOpenerSendLoreRequest = previous;
        };
    },
});
