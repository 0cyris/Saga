import {
    LOREDECK_CREATOR_GENERATION_SETTING_LIMITS,
    clampLoredeckCreatorInteger,
} from './loredeck-creator-generation-settings.js';
import {
    getLoredeckCreatorGenerationUnitActionId,
    getLoredeckCreatorGenerationUnitBatchId,
} from './loredeck-creator-generation-units.js';
import {
    attachLoredeckCreatorLiveGeneration,
    deleteLoredeckCreatorGenerationController,
    forgetLoredeckCreatorLiveGeneration,
    isLoredeckCreatorActiveGenerationStillLive,
} from './loredeck-creator-generation-state.js';

const LOREDECK_CREATOR_ACTIVE_RECOVERY_STATUSES = Object.freeze(['queued', 'running', 'retrying']);
export const LOREDECK_CREATOR_RECOVERABLE_UNIT_STATUSES = Object.freeze(['failed', 'interrupted']);

export function findLoredeckCreatorActiveUnitForRecovery(job = {}, active = {}) {
    const units = job?.generationUnits && typeof job.generationUnits === 'object' && !Array.isArray(job.generationUnits)
        ? job.generationUnits
        : {};
    if (active.unitId && units[active.unitId]) return units[active.unitId];
    const runId = String(active.runId || active.id || '').trim();
    const activeStatuses = new Set(LOREDECK_CREATOR_ACTIVE_RECOVERY_STATUSES);
    return Object.values(units)
        .filter(unit => {
            if (!unit?.unitId) return false;
            if (runId && unit.runId && unit.runId !== runId) return false;
            return activeStatuses.has(String(unit.status || '').toLowerCase());
        })
        .sort((a, b) => (Number(b.updatedAt || b.startedAt || 0) || 0) - (Number(a.updatedAt || a.startedAt || 0) || 0))[0] || null;
}

export function buildLoredeckCreatorInterruptedResult(active = {}, now = Date.now()) {
    const label = active.label || 'Deck Maker generation';
    const startedAt = Number(active.startedAt || active.updatedAt || now) || now;
    return {
        id: active.id || active.runId || active.unitId || `interrupted_${now}`,
        runId: active.runId || '',
        unitId: active.unitId || '',
        actionId: active.actionId || '',
        stage: active.stage || active.currentStage || '',
        label,
        status: 'interrupted',
        message: `${label} was interrupted before it completed. Review any saved batches, then rerun the current stage.`,
        completedAt: now,
        elapsedMs: Math.max(0, now - startedAt),
        receivedChars: Number(active.receivedChars || 0),
        snippet: active.snippet || '',
        streamSupported: active.streamSupported === true ? true : active.streamSupported === false ? false : null,
        batchId: active.batchId || '',
        batchLabel: active.batchLabel || '',
    };
}

function getClockNow(deps = {}) {
    return typeof deps.now === 'function' ? deps.now() : Date.now();
}

export function recoverLoredeckCreatorInterruptedActiveGeneration(job = {}, options = {}, deps = {}) {
    if (!job?.jobId || !job.activeGeneration?.id) {
        return { job, recovered: false, live: false };
    }
    const active = job.activeGeneration;
    const isActiveGenerationStillLive = typeof deps.isActiveGenerationStillLive === 'function'
        ? deps.isActiveGenerationStillLive
        : isLoredeckCreatorActiveGenerationStillLive;
    const startGenerationTicker = typeof deps.startGenerationTicker === 'function' ? deps.startGenerationTicker : () => null;
    const attachLiveGeneration = typeof deps.attachLiveGeneration === 'function' ? deps.attachLiveGeneration : attachLoredeckCreatorLiveGeneration;
    if (isActiveGenerationStillLive(job)) {
        startGenerationTicker(active.id);
        return { job: attachLiveGeneration(job), recovered: false, live: true };
    }

    const now = getClockNow(deps);
    const activeUnit = findLoredeckCreatorActiveUnitForRecovery(job, active);
    const runId = String(active.runId || active.id || activeUnit?.runId || '').trim();
    const unitId = String(active.unitId || activeUnit?.unitId || '').trim();
    const generationRuns = { ...(job.generationRuns || {}) };
    if (runId) {
        generationRuns[runId] = {
            ...(generationRuns[runId] || {}),
            runId,
            jobId: job.jobId,
            kind: generationRuns[runId]?.kind || 'loredeck_creator',
            stage: generationRuns[runId]?.stage || active.stage || active.currentStage || '',
            mode: generationRuns[runId]?.mode || 'single_unit',
            status: 'interrupted',
            completedAt: now,
            updatedAt: now,
            error: generationRuns[runId]?.error || 'Previous Deck Maker generation was interrupted before it completed.',
        };
    }
    const generationUnits = { ...(job.generationUnits || {}) };
    if (unitId) {
        generationUnits[unitId] = {
            ...(generationUnits[unitId] || activeUnit || {}),
            unitId,
            jobId: job.jobId,
            runId: runId || generationUnits[unitId]?.runId || '',
            stage: generationUnits[unitId]?.stage || active.stage || active.currentStage || '',
            label: generationUnits[unitId]?.label || active.label || 'Generation unit',
            status: 'interrupted',
            failedAt: now,
            updatedAt: now,
            error: generationUnits[unitId]?.error || 'Previous Deck Maker generation was interrupted before this unit completed.',
        };
    }
    const interruptedResult = buildLoredeckCreatorInterruptedResult({
        ...active,
        runId,
        unitId,
    }, now);
    const nextStatus = String(job.status || '').trim().toLowerCase() === 'running' ? 'draft' : (job.status || 'draft');
    const patch = {
        activeGeneration: null,
        generationRuns,
        generationUnits,
        lastGenerationResult: interruptedResult,
        status: nextStatus,
        currentStage: '',
        updatedAt: now,
    };
    const updateCreatorProject = typeof deps.updateCreatorProject === 'function' ? deps.updateCreatorProject : () => ({ ok: false });
    const update = updateCreatorProject(job.jobId, patch, { syncPrompt: false, syncLocal: true }) || { ok: false };
    const deleteGenerationController = typeof deps.deleteGenerationController === 'function'
        ? deps.deleteGenerationController
        : deleteLoredeckCreatorGenerationController;
    const forgetLiveGeneration = typeof deps.forgetLiveGeneration === 'function' ? deps.forgetLiveGeneration : forgetLoredeckCreatorLiveGeneration;
    const stopGenerationTicker = typeof deps.stopGenerationTicker === 'function' ? deps.stopGenerationTicker : () => null;
    deleteGenerationController(active.id);
    forgetLiveGeneration(active);
    stopGenerationTicker();
    const recoveredJob = update.ok && update.job ? update.job : {
        ...job,
        ...patch,
    };
    if (typeof deps.setCurrentJobLocal === 'function') deps.setCurrentJobLocal(recoveredJob);
    if (options.toast && typeof deps.toast === 'function') {
        deps.toast(`${active.label || 'Deck Maker generation'} was interrupted. Saved batches are preserved; rerun the current stage when ready.`, 'warning');
    }
    return { job: recoveredJob, recovered: true, live: false, result: interruptedResult, update };
}

export function getLoredeckCreatorUnitMeta(unit = {}) {
    return unit?.meta && typeof unit.meta === 'object' && !Array.isArray(unit.meta) ? unit.meta : {};
}

export function isLoredeckCreatorRecoverableUnit(unit = {}) {
    return !!unit?.unitId && LOREDECK_CREATOR_RECOVERABLE_UNIT_STATUSES.includes(String(unit.status || '').toLowerCase());
}

export function selectLoredeckCreatorLatestRecoverableUnit(cached = {}, activeGeneration = null) {
    if (activeGeneration) return null;
    const units = cached?.generationUnits && typeof cached.generationUnits === 'object' && !Array.isArray(cached.generationUnits)
        ? Object.values(cached.generationUnits)
        : [];
    const candidates = units
        .filter(unit => isLoredeckCreatorRecoverableUnit(unit))
        .sort((a, b) => (Number(b.failedAt || b.updatedAt || b.completedAt || b.startedAt || 0) || 0) - (Number(a.failedAt || a.updatedAt || a.completedAt || a.startedAt || 0) || 0));
    return candidates[0] || null;
}

export function isStaleLoredeckCreatorInterruptedResult(job = {}) {
    const result = job?.lastGenerationResult;
    if (String(result?.status || '').toLowerCase() !== 'interrupted') return false;
    if (job?.activeGeneration?.status === 'running') return false;
    const units = job?.generationUnits && typeof job.generationUnits === 'object' && !Array.isArray(job.generationUnits)
        ? Object.values(job.generationUnits)
        : [];
    if (!units.length) return false;
    const resultUnitId = String(result.unitId || '').trim();
    const resultActionId = String(result.actionId || '').trim();
    const resultBatchId = String(result.batchId || '').trim();
    const matches = units.filter(unit => {
        if (!unit?.unitId) return false;
        if (resultUnitId) return unit.unitId === resultUnitId;
        if (resultActionId && getLoredeckCreatorGenerationUnitActionId(unit) !== resultActionId) return false;
        if (resultBatchId && getLoredeckCreatorGenerationUnitBatchId(unit) !== resultBatchId) return false;
        return !!resultActionId;
    });
    if (!matches.length) return false;
    const recoverable = matches.some(unit => isLoredeckCreatorRecoverableUnit(unit));
    if (recoverable) return false;
    return matches.some(unit => ['complete', 'success'].includes(String(unit.status || '').toLowerCase()));
}

export function formatLoredeckCreatorRecoveryStageLabel(unit = {}) {
    const stage = String(unit?.stage || '').trim();
    if (stage === 'scope_brief') return 'Scope Brief';
    if (stage === 'story_outline') return 'Story Outline';
    if (stage === 'title_revision') return 'Title revision';
    if (stage === 'title_batch') return 'Title batch';
    if (stage === 'context_tag_planning') return 'Context and Tag plan';
    if (stage === 'entry_micro_batch') return 'Lorecard micro-batch';
    return unit?.label || 'Deck Maker generation unit';
}

export function buildLoredeckCreatorRetrySmallerConfig(unit = {}, settings = {}, options = {}) {
    const meta = getLoredeckCreatorUnitMeta(unit);
    const stage = String(unit?.stage || '').trim();
    if (meta.retrySmallerSupported === false) return null;
    if (stage === 'title_batch') {
        const current = clampLoredeckCreatorInteger(meta.titlePassLimit, 1, 24, settings.titleBatchLimit);
        const next = Math.max(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS.titleBatchLimit[0], Math.ceil(current / 2));
        return next < current ? { key: 'titlePassLimitOverride', value: next, label: `${next} titles` } : null;
    }
    if (stage === 'context_tag_planning') {
        const current = clampLoredeckCreatorInteger(meta.proposalLimit, 1, 24, settings.planningProposalLimit);
        const next = Math.max(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS.planningProposalLimit[0], Math.ceil(current / 2));
        return next < current ? { key: 'planningProposalLimitOverride', value: next, label: `${next} proposals` } : null;
    }
    if (stage === 'entry_micro_batch') {
        const current = typeof options.getEntryBatchLimit === 'function'
            ? options.getEntryBatchLimit(meta.batchSize)
            : Math.max(1, Number(meta.batchSize) || Number(settings.entryBatchSize) || 1);
        const next = Math.max(1, Math.ceil(current / 2));
        return next < current ? { key: 'batchSize', value: next, label: `${next} Lorecard${next === 1 ? '' : 's'}` } : null;
    }
    return null;
}

export function buildLoredeckCreatorRetryUnitId(unit = {}, mode = 'retry', size = '', now = Date.now()) {
    const base = String(unit?.unitId || unit?.id || 'creator_unit').replace(/[^a-zA-Z0-9:._-]+/g, '_').slice(0, 180);
    const suffix = [mode || 'retry', size || '', now].filter(Boolean).join('_');
    return `${base}:${suffix}`.replace(/[^a-zA-Z0-9:._-]+/g, '_').slice(0, 220);
}
