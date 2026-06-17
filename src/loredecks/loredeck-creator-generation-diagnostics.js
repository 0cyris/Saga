import {
    GENERATION_ERROR_CODES,
} from '../generation/generation-job-runner.js';
import {
    describeLoreResponse,
    LORE_RESPONSE_ERROR_CODES,
} from '../providers/lore-response-normalizer.js';

export function inferLoredeckCreatorFailurePhase(payload = {}) {
    const phase = String(payload.phase || '').trim() || 'unknown';
    const error = payload.error || {};
    const code = String(error.code || error.errorCode || payload.normalizedError?.code || '').trim();
    const name = String(error.name || payload.normalizedError?.name || '').trim();
    if (phase === 'parse' && (name === 'GenerationNoUsableResultError' || /^creator_/.test(code))) return 'validation';
    return phase;
}

export function getLoredeckCreatorFailureCode(error = {}) {
    return String(error?.code || error?.errorCode || error?.diagnostic?.errorCode || '').trim();
}

export function formatLoredeckCreatorStageLabel(value = '', fallback = 'Deck Maker generation') {
    return String(value || fallback || 'Deck Maker generation').trim() || 'Deck Maker generation';
}

export function formatLoredeckCreatorGenerationFailureMessage(error = {}, fallbackMessage = 'Deck Maker generation failed.', stageLabel = 'Deck Maker generation') {
    const label = formatLoredeckCreatorStageLabel(stageLabel);
    const code = getLoredeckCreatorFailureCode(error);
    if (code === LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT || code === 'provider_token_limit') {
        return `${label} hit the provider output limit before Saga received a usable final JSON response. Retry Smaller or lower the output size for this stage.`;
    }
    if (code === LORE_RESPONSE_ERROR_CODES.REASONING_ONLY || code === 'provider_reasoning_only') {
        return `${label} returned hidden reasoning but no visible JSON. Use a profile that emits a final answer, lower reasoning effort, or retry this stage.`;
    }
    if (code === LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT || code === 'provider_empty_content') {
        return `${label} returned no visible content. Check the provider output settings and retry this stage.`;
    }
    if (code === GENERATION_ERROR_CODES.JSON_INVALID || code === 'json_invalid') {
        return `${label} returned malformed JSON that Saga could not repair. Retry Smaller or reduce the stage scope.`;
    }
    if (code === GENERATION_ERROR_CODES.COMMIT_FAILED || code === 'commit_failed') {
        return `${label} produced usable output, but Saga could not save or queue it. Check the latest Failure Diagnostic before retrying.`;
    }
    if (code === 'creator_entry_guard_rejected_all') {
        const rejected = Array.isArray(error?.rejectedTargetIds) && error.rejectedTargetIds.length
            ? ` Affected: ${error.rejectedTargetIds.slice(0, 5).join(', ')}.`
            : '';
        return `${label} returned valid JSON, but every Lorecard draft in the micro-batch was rejected by schema guardrails.${rejected}`;
    }
    if (code === GENERATION_ERROR_CODES.STAGE_CONTRACT_FAILED || /^creator_/.test(code)) {
        return `${label} returned valid JSON, but it did not contain usable content for this Deck Maker stage. Check the latest Failure Diagnostic or retry with a smaller scope.`;
    }
    const rawMessage = String(error?.message || fallbackMessage || '').trim();
    if (/eval|syntaxerror|unexpected token|unexpected end|invalid json|json/i.test(rawMessage)) {
        return `${label} returned output Saga could not parse. Check the latest Failure Diagnostic or retry with a smaller scope.`;
    }
    return rawMessage || `${label} failed.`;
}

export function prepareLoredeckCreatorStageFailure(error = {}, fallbackMessage = 'Deck Maker generation failed.', stageLabel = 'Deck Maker generation') {
    const message = formatLoredeckCreatorGenerationFailureMessage(error, fallbackMessage, stageLabel);
    if (error && typeof error === 'object') {
        if (!error.sagaRawMessage && error.message && error.message !== message) {
            try { error.sagaRawMessage = String(error.message || ''); } catch (_) {}
        }
        try { error.message = message; } catch (_) {}
        return error;
    }
    const wrapped = new Error(message);
    wrapped.sagaRawMessage = String(error || '');
    return wrapped;
}

export function warnLoredeckCreatorGenerationFailure(error = {}, context = {}) {
    const diagnostic = error?.diagnostic || {};
    const code = getLoredeckCreatorFailureCode(error) || 'unknown';
    console.warn('[Saga] Deck Maker generation failed:', {
        stage: context.stage || diagnostic.stage || '',
        unitId: context.unitId || diagnostic.unitId || '',
        unitLabel: context.unitLabel || diagnostic.unitLabel || '',
        errorCode: code,
        errorName: error?.name || diagnostic.errorName || '',
        message: error?.message || diagnostic.errorMessage || '',
        rawMessage: error?.sagaRawMessage || '',
        parsePhase: diagnostic.parsePhase || '',
        finishReason: diagnostic.finishReason || '',
        visibleContentLength: Number(diagnostic.visibleContentLength) || 0,
        repairAttempted: diagnostic.repairAttempted === true,
    });
}

export function buildLoredeckCreatorGenerationFailureDiagnostic(payload = {}, config = {}, requestOptions = {}, options = {}) {
    const description = describeLoreResponse(payload.rawResult, { sampleLimit: 240 });
    const normalizedError = payload.normalizedError || {};
    const error = payload.error || {};
    const diagnostic = {
        kind: 'loredeck_creator_generation_failure',
        stage: config.stage || payload.unit?.stage || '',
        unitId: payload.unit?.unitId || '',
        unitLabel: payload.unit?.label || config.unitLabel || config.label || '',
        providerKind: config.requestOptions?.providerKind || requestOptions.providerKind || 'lore',
        resultType: description.resultType,
        finishReason: description.finishReason,
        parsePhase: inferLoredeckCreatorFailurePhase(payload),
        errorCode: normalizedError.code || error.code || error.errorCode || '',
        errorName: normalizedError.name || error.name || '',
        errorMessage: normalizedError.message || error.message || '',
        visibleContentLength: description.visibleContentLength,
        reasoningLength: description.reasoningLength,
        attempt: payload.attempt || 0,
        recordedAt: Date.now(),
        repairAttempted: payload.repairAttempted === true,
        sample: description.sample,
    };
    if (error?.rejectionSummary) diagnostic.rejectionSummary = error.rejectionSummary;
    if (Array.isArray(error?.rejectionDiagnostics)) diagnostic.rejectionDiagnostics = error.rejectionDiagnostics.slice(0, 20);
    if (Array.isArray(error?.rejectedTargetIds)) diagnostic.rejectedTargetIds = error.rejectedTargetIds.slice(0, 20);
    const redactDiagnostic = typeof options.redactDiagnostic === 'function' ? options.redactDiagnostic : value => value;
    return redactDiagnostic(diagnostic);
}
