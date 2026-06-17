import {
    runGenerationUnits,
} from '../generation/generation-job-runner.js';

function defaultExtractResponseText(rawResult = '') {
    if (typeof rawResult === 'string') return rawResult;
    if (rawResult?.content !== undefined) return String(rawResult.content || '');
    return String(rawResult || '');
}

function defaultFormatFailureMessage(error = {}, fallbackMessage = 'Deck Maker generation failed.') {
    return String(error?.message || fallbackMessage || 'Deck Maker generation failed.').trim();
}

export function buildLoredeckCreatorRunnerUnitId(generation = null, stage = 'unit') {
    const generationId = String(generation?.id || 'generation').trim();
    return `${generationId}:${stage || 'unit'}`.replace(/[^a-zA-Z0-9:._-]+/g, '_');
}

export function handleLoredeckCreatorRunnerProgress(generation = null, event = {}, unitLabel = 'Deck Maker generation', updateGeneration = null) {
    if (!generation?.id || !event?.type || typeof updateGeneration !== 'function') return;
    if (event.type === 'unit_started') {
        updateGeneration(generation, {
            type: 'phase',
            phase: 'requesting',
            message: `${unitLabel} request started...`,
        });
        return;
    }
    if (event.type === 'unit_repairing') {
        updateGeneration(generation, {
            type: 'phase',
            phase: 'repairing',
            message: `Repairing ${unitLabel} response...`,
        });
        return;
    }
    if (event.type === 'unit_retry_scheduled' || event.type === 'unit_retrying') {
        updateGeneration(generation, {
            type: 'phase',
            phase: 'retry',
            message: `Retrying ${unitLabel}...`,
        });
    }
}

export async function runLoredeckCreatorSingleUnitGeneration(config = {}, deps = {}) {
    const generation = config.generation;
    if (!generation?.id) throw new Error('Missing Deck Maker generation.');
    if (typeof config.requestResponse !== 'function') throw new Error('Missing Deck Maker request callback.');
    if (typeof config.parseResponse !== 'function') throw new Error('Missing Deck Maker parser callback.');

    const getGenerationSettings = typeof deps.getGenerationSettings === 'function' ? deps.getGenerationSettings : () => ({});
    const getGenerationJobId = typeof deps.getGenerationJobId === 'function' ? deps.getGenerationJobId : () => '';
    const createRequestOptions = typeof deps.createRequestOptions === 'function' ? deps.createRequestOptions : () => ({ providerKind: 'lore' });
    const isGenerationCurrent = typeof deps.isGenerationCurrent === 'function' ? deps.isGenerationCurrent : () => true;
    const updateGeneration = typeof deps.updateGeneration === 'function' ? deps.updateGeneration : null;
    const updateGenerationRun = typeof deps.updateGenerationRun === 'function' ? deps.updateGenerationRun : null;
    const updateGenerationUnit = typeof deps.updateGenerationUnit === 'function' ? deps.updateGenerationUnit : null;
    const extractResponseText = typeof deps.extractResponseText === 'function' ? deps.extractResponseText : defaultExtractResponseText;
    const buildFailureDiagnostic = typeof deps.buildFailureDiagnostic === 'function' ? deps.buildFailureDiagnostic : () => null;
    const formatFailureMessage = typeof deps.formatFailureMessage === 'function' ? deps.formatFailureMessage : defaultFormatFailureMessage;
    const warnFailure = typeof deps.warnFailure === 'function' ? deps.warnFailure : () => {};

    const settings = getGenerationSettings();
    const unitLabel = config.unitLabel || config.label || 'Deck Maker generation';
    const stage = String(config.stage || 'creator_generation').trim();
    const jobId = getGenerationJobId(generation) || generation.jobId || generation.id;
    const requestOptions = createRequestOptions(generation, config.requestOptions || {});
    const unitId = config.unitId || buildLoredeckCreatorRunnerUnitId(generation, stage);
    if (config.waitForUiPaint !== false && typeof deps.waitForUiPaint === 'function') {
        await deps.waitForUiPaint();
    }
    const checkpointOptions = {
        syncPrompt: false,
        label: generation.label || unitLabel,
        currentStage: config.currentStage || generation.currentStage || stage,
    };
    const runnerResult = await runGenerationUnits({
        jobId,
        runId: generation.id,
        kind: 'loredeck_creator',
        stage,
        mode: 'single_unit',
        units: [{
            unitId,
            label: unitLabel,
            stage,
            inputHash: String(config.inputHash || '').trim(),
            meta: config.unitMeta && typeof config.unitMeta === 'object' && !Array.isArray(config.unitMeta)
                ? config.unitMeta
                : {},
            createdAt: Date.now(),
        }],
        signal: requestOptions.signal,
        retryAttempts: Number.isFinite(Number(config.retryAttempts)) ? Number(config.retryAttempts) : settings.retryAttempts,
        stopOnFailure: true,
        isRunCurrent: () => isGenerationCurrent(generation),
        onProgress: event => handleLoredeckCreatorRunnerProgress(generation, event, unitLabel, updateGeneration),
        checkpointRun: async ({ run }) => {
            if (!jobId || !updateGenerationRun) return;
            updateGenerationRun(jobId, run, checkpointOptions);
        },
        checkpointUnit: async ({ unit }) => {
            if (!jobId || !unit?.unitId || !updateGenerationUnit) return;
            updateGenerationUnit(jobId, unit.unitId, unit, checkpointOptions);
        },
        callUnit: async ({ emitProgress }) => {
            if (typeof emitProgress === 'function') {
                emitProgress({
                    type: 'phase',
                    phase: 'requesting',
                    message: `${unitLabel} request started...`,
                });
            }
            return await config.requestResponse(config.requestContext || {}, requestOptions);
        },
        parseResult: rawResult => config.parseResponse(extractResponseText(rawResult)),
        validateResult: typeof config.validateParsedResult === 'function'
            ? parsedResult => config.validateParsedResult(parsedResult, config.requestContext || {})
            : null,
        diagnoseFailure: payload => buildFailureDiagnostic(payload, config, requestOptions),
        repairResult: typeof config.repairResponse === 'function'
            ? async ({ rawResult, error }) => {
                const responseText = extractResponseText(rawResult);
                const repairedText = await config.repairResponse(responseText, config.requestContext || {}, requestOptions);
                const repairedResponseText = extractResponseText(repairedText);
                const repaired = config.parseResponse(repairedResponseText);
                if (typeof config.isRepairUsable === 'function' && !config.isRepairUsable(repaired)) throw error;
                return {
                    rawResult: repairedResponseText,
                    parsedResult: repaired,
                };
            }
            : null,
        commitResult: async ({ parsedResult }) => {
            const customCommit = typeof config.commitParsedResult === 'function'
                ? await config.commitParsedResult({ parsedResult, generation, unitId, stage, requestContext: config.requestContext || {} })
                : null;
            return {
                ...(customCommit || {}),
                resultRef: {
                    ...(customCommit?.resultRef || {}),
                    type: config.resultRefType || stage,
                    summary: String(parsedResult?.summary || '').trim(),
                    completedAt: Date.now(),
                },
            };
        },
    });
    if (runnerResult.status === 'cancelled' || runnerResult.status === 'superseded') {
        return {
            aborted: true,
            runnerResult,
            requestOptions,
            responseText: '',
            parsed: null,
        };
    }
    const completed = (runnerResult.results || []).find(result => result?.status === 'complete');
    if (!completed) {
        const failed = (runnerResult.results || []).find(result => result?.status === 'failed') || runnerResult.results?.[0] || {};
        const rawMessage = failed.error?.message || failed.unit?.error || runnerResult.error?.message || `${unitLabel} generation failed.`;
        const diagnostic = failed.unit?.diagnostic || null;
        const message = formatFailureMessage(
            {
                ...(failed.error || {}),
                message: rawMessage,
                diagnostic,
            },
            `${unitLabel} generation failed.`,
            unitLabel
        );
        const error = new Error(message);
        error.name = failed.error?.name || 'LoredeckCreatorGenerationError';
        error.code = failed.error?.code || failed.unit?.diagnostic?.errorCode || runnerResult.error?.code || '';
        error.diagnostic = diagnostic;
        if (diagnostic?.rejectionSummary) error.rejectionSummary = diagnostic.rejectionSummary;
        if (Array.isArray(diagnostic?.rejectionDiagnostics)) error.rejectionDiagnostics = diagnostic.rejectionDiagnostics;
        if (Array.isArray(diagnostic?.rejectedTargetIds)) error.rejectedTargetIds = diagnostic.rejectedTargetIds;
        if (rawMessage && rawMessage !== message) error.sagaRawMessage = rawMessage;
        warnFailure(error, { stage, unitId, unitLabel });
        throw error;
    }
    return {
        aborted: false,
        runnerResult,
        requestOptions,
        responseText: extractResponseText(completed.rawResult),
        parsed: completed.parsedResult,
        commitResult: completed.commitResult || null,
    };
}
