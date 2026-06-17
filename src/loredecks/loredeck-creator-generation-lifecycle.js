import {
    formatLoredeckCreatorLiveSnippet,
    getLoredeckCreatorGenerationWaitMessage,
    normalizeLoredeckCreatorTitleId,
    normalizeLoredeckCreatorTitleIdList,
} from './loredeck-creator-panel.js';
import {
    normalizeLoredeckCreatorCoverageIdList,
} from './loredeck-creator-coverage.js';

function finiteNumberOrNull(value = null) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function elapsedSince(startedAt = 0, now = Date.now()) {
    return Math.max(0, now - (Number(startedAt || now) || now));
}

export function buildLoredeckCreatorActiveGeneration({
    actionId = '',
    label = '',
    jobPatch = {},
    details = {},
    generationSettings = {},
    abortable = false,
    now = Date.now(),
} = {}) {
    const id = `${actionId || 'generation'}-${now}`;
    return {
        id,
        actionId,
        runId: details.runId || id,
        label: label || 'Generating',
        status: 'running',
        phase: 'starting',
        message: 'Contacting Reasoning Provider...',
        startedAt: now,
        updatedAt: now,
        elapsedMs: 0,
        receivedChars: 0,
        snippet: '',
        streamRequested: generationSettings.showStreamingProgress !== false,
        streamSupported: null,
        abortable: !!abortable,
        stage: details.stage || jobPatch.currentStage || '',
        batchId: details.batchId || '',
        batchLabel: details.batchLabel || '',
        batchIndex: finiteNumberOrNull(details.batchIndex),
        batchTotal: finiteNumberOrNull(details.batchTotal),
        targetTitleBatchId: normalizeLoredeckCreatorTitleId(details.targetTitleBatchId || details.batchId || '', ''),
        targetPlanningBatchId: normalizeLoredeckCreatorTitleId(details.targetPlanningBatchId || '', ''),
        coverageDimensionIds: normalizeLoredeckCreatorCoverageIdList(details.coverageDimensionIds || [], 24),
        targetTitleIds: normalizeLoredeckCreatorTitleIdList(details.targetTitleIds || [], 200),
    };
}

export function buildLoredeckCreatorActiveGenerationUpdate(active = {}, event = {}, options = {}, now = Date.now()) {
    const accumulated = String(event.accumulated || '').trim();
    const receivedChars = Number(event.receivedChars || accumulated.length || active.receivedChars || 0);
    const phase = String(event.phase || active.phase || 'waiting');
    const message = String(event.message || getLoredeckCreatorGenerationWaitMessage(active)).trim();
    const hasCoverageDimensionIds = Object.prototype.hasOwnProperty.call(options, 'coverageDimensionIds');
    const hasTargetTitleIds = Object.prototype.hasOwnProperty.call(options, 'targetTitleIds');
    return {
        ...active,
        phase,
        message,
        elapsedMs: elapsedSince(active.startedAt, now),
        updatedAt: now,
        receivedChars,
        streamSupported: event.streamSupported === undefined ? active.streamSupported : event.streamSupported,
        snippet: accumulated ? formatLoredeckCreatorLiveSnippet(accumulated) : active.snippet || '',
        batchId: options.batchId || active.batchId || '',
        batchLabel: options.batchLabel || active.batchLabel || '',
        batchIndex: options.batchIndex ?? active.batchIndex ?? null,
        batchTotal: options.batchTotal ?? active.batchTotal ?? null,
        targetTitleBatchId: normalizeLoredeckCreatorTitleId(options.targetTitleBatchId || active.targetTitleBatchId || active.batchId || '', ''),
        targetPlanningBatchId: normalizeLoredeckCreatorTitleId(options.targetPlanningBatchId || active.targetPlanningBatchId || '', ''),
        coverageDimensionIds: hasCoverageDimensionIds
            ? normalizeLoredeckCreatorCoverageIdList(options.coverageDimensionIds || [], 24)
            : normalizeLoredeckCreatorCoverageIdList(active.coverageDimensionIds || [], 24),
        targetTitleIds: hasTargetTitleIds
            ? normalizeLoredeckCreatorTitleIdList(options.targetTitleIds || [], 200)
            : normalizeLoredeckCreatorTitleIdList(active.targetTitleIds || [], 200),
    };
}

export function buildLoredeckCreatorGenerationResult(generation = {}, active = {}, status = 'success', message = '', details = {}, now = Date.now()) {
    return {
        id: generation.id,
        actionId: active.actionId || generation.actionId || '',
        label: active.label || generation.label || 'Generation',
        status,
        message: message || (status === 'success' ? 'Generation complete.' : status === 'warning' ? 'Generation needs review.' : 'Generation failed.'),
        completedAt: now,
        elapsedMs: elapsedSince(active.startedAt, now),
        receivedChars: Number(details.receivedChars || active.receivedChars || 0),
        snippet: details.snippet || active.snippet || '',
        streamSupported: active.streamSupported,
        batchId: active.batchId || '',
        batchLabel: active.batchLabel || '',
        batchIndex: active.batchIndex ?? null,
        batchTotal: active.batchTotal ?? null,
        targetTitleBatchId: active.targetTitleBatchId || '',
        targetPlanningBatchId: active.targetPlanningBatchId || '',
        coverageDimensionIds: normalizeLoredeckCreatorCoverageIdList(active.coverageDimensionIds || [], 24),
        targetTitleIds: normalizeLoredeckCreatorTitleIdList(active.targetTitleIds || [], 200),
    };
}

export function buildLoredeckCreatorCancelledGenerationResult(active = {}, now = Date.now()) {
    return {
        id: active.id,
        actionId: active.actionId || '',
        label: active.label || 'Generation',
        status: 'cancelled',
        message: 'Generation cancelled. Any late provider response will be ignored.',
        completedAt: now,
        elapsedMs: elapsedSince(active.startedAt, now),
        receivedChars: Number(active.receivedChars || 0),
        snippet: active.snippet || '',
        streamSupported: active.streamSupported,
        batchId: active.batchId || '',
        batchLabel: active.batchLabel || '',
        batchIndex: active.batchIndex ?? null,
        batchTotal: active.batchTotal ?? null,
        targetTitleBatchId: active.targetTitleBatchId || '',
        targetPlanningBatchId: active.targetPlanningBatchId || '',
        coverageDimensionIds: normalizeLoredeckCreatorCoverageIdList(active.coverageDimensionIds || [], 24),
        targetTitleIds: normalizeLoredeckCreatorTitleIdList(active.targetTitleIds || [], 200),
    };
}
