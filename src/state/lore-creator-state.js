/**
 * Loredeck Creator state normalization helpers for Saga.
 */

import { GENERATION_RUN_STATUSES, GENERATION_UNIT_STATUSES } from '../generation/generation-job-runner.js';
import { cloneLoredeckPlainObject } from './lore-state-normalizers.js';
export function normalizeLoredeckCreatorString(value = '', maxLength = 1000) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength).trim();
}

function normalizeLoredeckCreatorStringList(value = [], limit = 80, maxLength = 300) {
    const input = Array.isArray(value) ? value : [];
    const output = [];
    const seen = new Set();
    for (const raw of input) {
        const text = normalizeLoredeckCreatorString(raw, maxLength);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(text);
        if (output.length >= limit) break;
    }
    return output;
}

const CREATOR_GENERATION_RUN_STATUSES = new Set(GENERATION_RUN_STATUSES);
const CREATOR_GENERATION_UNIT_STATUSES = new Set(GENERATION_UNIT_STATUSES);
export const CREATOR_ACTIVE_GENERATION_STATUSES = new Set(['queued', 'running', 'retrying']);
const CREATOR_GENERATION_RESULT_STATUSES = new Set(['success', 'warning', 'error', 'cancelled', 'complete', 'partial', 'failed', 'superseded', 'interrupted']);

export function normalizeLoredeckCreatorId(value = '', fallback = '') {
    const text = normalizeLoredeckCreatorString(value, 220)
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .replace(/^_+|_+$/g, '');
    return text || fallback;
}

function normalizeLoredeckCreatorNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function normalizeLoredeckCreatorGenerationStatus(value = '', allowed = CREATOR_GENERATION_UNIT_STATUSES, fallback = 'queued') {
    const status = normalizeLoredeckCreatorString(value, 60).toLowerCase();
    return allowed.has(status) ? status : fallback;
}

function normalizeLoredeckCreatorResultRef(value = {}, maxLength = 12000) {
    const cloned = cloneLoredeckPlainObject(value, maxLength);
    return cloned && typeof cloned === 'object' && !Array.isArray(cloned) ? cloned : null;
}

export function normalizeLoredeckCreatorGenerationRun(value = {}, index = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const runId = normalizeLoredeckCreatorId(value.runId || value.id || '', `run_${index + 1}`);
    if (!runId) return null;
    const run = {
        runId,
        id: normalizeLoredeckCreatorId(value.id || runId, runId),
        jobId: normalizeLoredeckCreatorId(value.jobId || '', ''),
        kind: normalizeLoredeckCreatorId(value.kind || 'loredeck_creator', 'loredeck_creator'),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        mode: normalizeLoredeckCreatorId(value.mode || 'run_next', 'run_next'),
        status: normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_GENERATION_RUN_STATUSES, 'queued'),
        totalUnits: normalizeLoredeckCreatorNumber(value.totalUnits),
        completedUnits: normalizeLoredeckCreatorNumber(value.completedUnits),
        failedUnits: normalizeLoredeckCreatorNumber(value.failedUnits),
        skippedUnits: normalizeLoredeckCreatorNumber(value.skippedUnits),
        cancelledUnits: normalizeLoredeckCreatorNumber(value.cancelledUnits),
        currentUnitId: normalizeLoredeckCreatorId(value.currentUnitId || '', ''),
        currentUnitIndex: Number.isFinite(Number(value.currentUnitIndex)) ? Math.max(0, Math.round(Number(value.currentUnitIndex))) : 0,
        error: normalizeLoredeckCreatorString(value.error, 800),
        createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : 0,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
        startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0,
        completedAt: Number.isFinite(Number(value.completedAt)) ? Number(value.completedAt) : 0,
    };
    const meta = normalizeLoredeckCreatorResultRef(value.meta, 12000);
    if (meta) run.meta = meta;
    return run;
}

export function normalizeLoredeckCreatorGenerationUnit(value = {}, index = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const unitId = normalizeLoredeckCreatorId(value.unitId || value.id || value.batchId || '', `unit_${index + 1}`);
    if (!unitId) return null;
    const unit = {
        unitId,
        id: normalizeLoredeckCreatorId(value.id || unitId, unitId),
        runId: normalizeLoredeckCreatorId(value.runId || '', ''),
        jobId: normalizeLoredeckCreatorId(value.jobId || '', ''),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        label: normalizeLoredeckCreatorString(value.label || value.title || unitId, 180),
        status: normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_GENERATION_UNIT_STATUSES, 'queued'),
        attempts: normalizeLoredeckCreatorNumber(value.attempts),
        inputHash: normalizeLoredeckCreatorString(value.inputHash, 160),
        outputHash: normalizeLoredeckCreatorString(value.outputHash, 160),
        error: normalizeLoredeckCreatorString(value.error, 800),
        createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : 0,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
        startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0,
        completedAt: Number.isFinite(Number(value.completedAt)) ? Number(value.completedAt) : 0,
        failedAt: Number.isFinite(Number(value.failedAt)) ? Number(value.failedAt) : 0,
    };
    const resultRef = normalizeLoredeckCreatorResultRef(value.resultRef, 12000);
    if (resultRef) unit.resultRef = resultRef;
    const meta = normalizeLoredeckCreatorResultRef(value.meta, 12000);
    if (meta) unit.meta = meta;
    return unit;
}

function normalizeLoredeckCreatorGenerationMap(value = {}, normalizer, idKey = 'id', limit = 200) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = {};
    const rows = Object.entries(input)
        .map(([key, raw], index) => normalizer({ ...(raw || {}), [idKey]: raw?.[idKey] || key }, index))
        .filter(Boolean)
        .sort((a, b) => (Number(b.updatedAt || b.completedAt || b.startedAt || b.createdAt) || 0) - (Number(a.updatedAt || a.completedAt || a.startedAt || a.createdAt) || 0))
        .slice(0, Math.max(1, Number(limit) || 200));
    for (const row of rows) output[row[idKey]] = row;
    return output;
}

export function normalizeLoredeckCreatorActiveGeneration(value = {}, jobId = '') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const status = normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_ACTIVE_GENERATION_STATUSES, '');
    if (!status) return null;
    const id = normalizeLoredeckCreatorId(value.id || value.runId || value.unitId || '', '');
    if (!id) return null;
    const rawCurrentStage = normalizeLoredeckCreatorString(value.currentStage || value.uiStage || '', 80);
    const normalizedCurrentStage = rawCurrentStage ? normalizeLoredeckCreatorStage(rawCurrentStage) : '';
    const active = {
        id,
        jobId: normalizeLoredeckCreatorId(value.jobId || jobId || '', ''),
        runId: normalizeLoredeckCreatorId(value.runId || '', ''),
        unitId: normalizeLoredeckCreatorId(value.unitId || '', ''),
        actionId: normalizeLoredeckCreatorId(value.actionId || '', ''),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        currentStage: normalizedCurrentStage === 'intake' && rawCurrentStage !== 'intake' ? '' : normalizedCurrentStage,
        label: normalizeLoredeckCreatorString(value.label || 'Generation running', 180),
        status,
        phase: normalizeLoredeckCreatorString(value.phase || 'running', 80),
        message: normalizeLoredeckCreatorString(value.message || '', 300),
        startedAt: Number.isFinite(Number(value.startedAt)) ? Number(value.startedAt) : 0,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : 0,
        elapsedMs: normalizeLoredeckCreatorNumber(value.elapsedMs),
        receivedChars: normalizeLoredeckCreatorNumber(value.receivedChars),
        snippet: normalizeLoredeckCreatorString(value.snippet, 500),
        streamRequested: value.streamRequested === true,
        streamSupported: value.streamSupported === true ? true : value.streamSupported === false ? false : null,
        abortable: value.abortable === true,
        batchId: normalizeLoredeckCreatorId(value.batchId || '', ''),
        batchLabel: normalizeLoredeckCreatorString(value.batchLabel || '', 180),
        batchIndex: Number.isFinite(Number(value.batchIndex)) ? Math.max(0, Math.round(Number(value.batchIndex))) : null,
        batchTotal: Number.isFinite(Number(value.batchTotal)) ? Math.max(0, Math.round(Number(value.batchTotal))) : null,
    };
    return active;
}

function normalizeLoredeckCreatorGenerationResult(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = normalizeLoredeckCreatorId(value.id || value.runId || value.unitId || '', '');
    if (!id) return null;
    const status = normalizeLoredeckCreatorGenerationStatus(value.status, CREATOR_GENERATION_RESULT_STATUSES, 'complete');
    const result = {
        id,
        runId: normalizeLoredeckCreatorId(value.runId || '', ''),
        unitId: normalizeLoredeckCreatorId(value.unitId || '', ''),
        actionId: normalizeLoredeckCreatorId(value.actionId || '', ''),
        stage: normalizeLoredeckCreatorId(value.stage || '', ''),
        label: normalizeLoredeckCreatorString(value.label || 'Generation', 180),
        status,
        message: normalizeLoredeckCreatorString(value.message || '', 500),
        completedAt: Number.isFinite(Number(value.completedAt)) ? Number(value.completedAt) : 0,
        elapsedMs: normalizeLoredeckCreatorNumber(value.elapsedMs),
        receivedChars: normalizeLoredeckCreatorNumber(value.receivedChars),
        snippet: normalizeLoredeckCreatorString(value.snippet, 500),
        streamSupported: value.streamSupported === true ? true : value.streamSupported === false ? false : null,
        batchId: normalizeLoredeckCreatorId(value.batchId || '', ''),
        batchLabel: normalizeLoredeckCreatorString(value.batchLabel || '', 180),
    };
    return result;
}

function normalizeLoredeckCreatorStage(value = '') {
    const stage = normalizeLoredeckCreatorString(value, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    return [
        'intake',
        'brief_drafted',
        'brief_approved',
        'outline_drafting',
        'outline_drafted',
        'outline_approved',
        'context_drafted',
        'tags_drafted',
        'titles_drafting',
        'titles_drafted',
        'titles_approved',
        'planning_drafting',
        'planning_queued',
        'planning_accepted',
        'entries_drafting',
        'entries_drafted',
        'health_review',
        'complete',
        'blocked',
    ].includes(stage) ? stage : 'intake';
}

function inferLoredeckCreatorStage(job = {}) {
    if (job.activeGeneration?.status && CREATOR_ACTIVE_GENERATION_STATUSES.has(String(job.activeGeneration.status).toLowerCase())) {
        const activeStage = normalizeLoredeckCreatorStage(job.activeGeneration.currentStage || job.activeGeneration.stage || '');
        if (activeStage && activeStage !== 'intake') return activeStage;
    }
    if (job.currentStage) return normalizeLoredeckCreatorStage(job.currentStage);
    if (job.entryDraftCount || job.entryDraftedAt) return 'entries_drafted';
    if (job.generatedPackId && (job.planningQueuedCount || job.planningQueuedAt)) return 'planning_queued';
    if (Array.isArray(job.approvedTitleDraftIds) && job.approvedTitleDraftIds.length) return 'titles_approved';
    if (Array.isArray(job.titleDrafts) && job.titleDrafts.length) return 'titles_drafted';
    if (job.outlineApproved && job.outline) return 'outline_approved';
    if (job.outline) return 'outline_drafted';
    if (job.approved) return 'brief_approved';
    if (job.brief) return 'brief_drafted';
    return 'intake';
}

export function normalizeLoredeckCreatorJob(value = {}, index = 0) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const intake = value.intake && typeof value.intake === 'object' && !Array.isArray(value.intake) ? value.intake : {};
    const now = Date.now();
    const fallbackIdSeed = `${value.fandom || intake.fandom || 'creator'}-${value.scope || intake.scope || index + 1}-${value.createdAt || now}`;
    const jobId = normalizeLoredeckCreatorString(value.jobId || value.id || '', 160)
        || `creator_${String(fallbackIdSeed).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || index + 1}`;
    const titleDrafts = Array.isArray(value.titleDrafts)
        ? value.titleDrafts.map(item => cloneLoredeckPlainObject(item, 30000)).filter(Boolean).slice(0, 1200)
        : [];
    const selectedTitleDraftIds = normalizeLoredeckCreatorStringList(value.selectedTitleDraftIds, 1200, 180);
    const approvedTitleDraftIds = normalizeLoredeckCreatorStringList(value.approvedTitleDraftIds, 1200, 180);
    const titleBatchDraftedIds = normalizeLoredeckCreatorStringList(value.titleBatchDraftedIds, 1200, 180);
    const planningBatchQueuedIds = normalizeLoredeckCreatorStringList(value.planningBatchQueuedIds, 1200, 180);
    const planningBatchAcceptedIds = normalizeLoredeckCreatorStringList(value.planningBatchAcceptedIds, 1200, 180);
    const generationRuns = normalizeLoredeckCreatorGenerationMap(value.generationRuns, normalizeLoredeckCreatorGenerationRun, 'runId', 80);
    const generationUnits = normalizeLoredeckCreatorGenerationMap(value.generationUnits, normalizeLoredeckCreatorGenerationUnit, 'unitId', 1200);
    const job = {
        schemaVersion: 1,
        jobId,
        status: normalizeLoredeckCreatorString(value.status || (value.blocked ? 'blocked' : 'draft'), 80) || 'draft',
        currentStage: inferLoredeckCreatorStage(value),
        archived: value.archived === true,
        fandom: normalizeLoredeckCreatorString(value.fandom || intake.fandom, 200),
        scope: normalizeLoredeckCreatorString(value.scope || intake.scope, 500),
        granularity: normalizeLoredeckCreatorString(value.granularity || intake.granularity || 'focused', 80) || 'focused',
        notes: normalizeLoredeckCreatorString(value.notes || intake.notes, 4000),
        summary: normalizeLoredeckCreatorString(value.summary, 1500),
        questions: normalizeLoredeckCreatorStringList(value.questions || value.clarifyingQuestions, 20, 400),
        warnings: normalizeLoredeckCreatorStringList(value.warnings, 40, 400),
        approved: value.approved === true,
        outlineApproved: value.outlineApproved === true,
        createdAt: Number.isFinite(Number(value.createdAt)) ? Number(value.createdAt) : now,
        updatedAt: Number.isFinite(Number(value.updatedAt)) ? Number(value.updatedAt) : now,
    };
    const brief = cloneLoredeckPlainObject(value.brief, 60000);
    if (brief) job.brief = brief;
    const outline = cloneLoredeckPlainObject(value.outline, 80000);
    if (outline) job.outline = outline;
    for (const key of [
        'approvedAt',
        'outlineDraftedAt',
        'outlineRevisedAt',
        'outlineApprovedAt',
        'approvedTitleDraftAt',
        'titleDraftedAt',
        'titleRevisedAt',
        'planningQueuedAt',
        'planningAcceptedAt',
        'entryDraftedAt',
        'lastStartedAt',
        'lastCompletedAt',
        'lastFailedAt',
        'archivedAt',
    ]) {
        if (Number.isFinite(Number(value[key]))) job[key] = Number(value[key]);
    }
    if (titleDrafts.length) job.titleDrafts = titleDrafts;
    if (selectedTitleDraftIds.length) job.selectedTitleDraftIds = selectedTitleDraftIds;
    if (approvedTitleDraftIds.length) job.approvedTitleDraftIds = approvedTitleDraftIds;
    if (titleBatchDraftedIds.length) job.titleBatchDraftedIds = titleBatchDraftedIds;
    if (planningBatchQueuedIds.length) job.planningBatchQueuedIds = planningBatchQueuedIds;
    if (planningBatchAcceptedIds.length) job.planningBatchAcceptedIds = planningBatchAcceptedIds;
    job.generationRuns = generationRuns;
    job.generationUnits = generationUnits;
    const activeGeneration = normalizeLoredeckCreatorActiveGeneration(value.activeGeneration, jobId);
    if (activeGeneration) job.activeGeneration = activeGeneration;
    const lastGenerationResult = normalizeLoredeckCreatorGenerationResult(value.lastGenerationResult);
    if (lastGenerationResult) job.lastGenerationResult = lastGenerationResult;

    const objectFields = {
        titleBatch: 20000,
        stageStatus: 50000,
        batches: 100000,
        generationSettings: 12000,
    };
    for (const [key, maxLength] of Object.entries(objectFields)) {
        const cloned = cloneLoredeckPlainObject(value[key], maxLength);
        if (cloned) job[key] = cloned;
    }

    for (const key of [
        'titlePassSummary',
        'outlineSummary',
        'planningSummary',
        'entryDraftSummary',
        'generatedPackId',
        'generatedPackTitle',
        'planningCurrentBatchId',
        'planningCurrentBatchLabel',
        'entryDraftCurrentBatchId',
        'entryDraftCurrentBatchLabel',
        'folderId',
        'projectTitle',
        'lastAction',
    ]) {
        const text = normalizeLoredeckCreatorString(value[key], key.includes('Summary') ? 1500 : 200);
        if (text) job[key] = text;
    }
    for (const key of ['outlineQuestions', 'outlineWarnings', 'titlePassQuestions', 'titlePassWarnings', 'planningQuestions', 'planningWarnings', 'entryDraftQuestions', 'entryDraftWarnings']) {
        const list = normalizeLoredeckCreatorStringList(value[key], 40, 400);
        if (list.length) job[key] = list;
    }
    for (const key of [
        'planningQueuedCount',
        'entryDraftCount',
        'entryDraftLastBatchCount',
        'entryDraftLastTargetCount',
        'entryDraftRemainingCount',
        'entryDraftBatchSize',
    ]) {
        if (Number.isFinite(Number(value[key]))) job[key] = Math.max(0, Math.round(Number(value[key])));
    }
    const errors = normalizeLoredeckCreatorStringList(value.errors, 40, 500);
    if (errors.length) job.errors = errors;
    return job;
}

export function normalizeLoredeckCreatorRegistry(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const jobs = {};
    const rawJobs = input.jobs && typeof input.jobs === 'object' && !Array.isArray(input.jobs) ? input.jobs : {};
    let count = 0;
    for (const [key, raw] of Object.entries(rawJobs)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const job = normalizeLoredeckCreatorJob({ ...(raw || {}), jobId: raw?.jobId || key }, count);
        if (!job) continue;
        jobs[job.jobId] = job;
        count += 1;
        if (count >= 200) break;
    }
    const activeJobId = normalizeLoredeckCreatorString(input.activeJobId, 160);
    const lastJobId = normalizeLoredeckCreatorString(input.lastJobId, 160);
    const fallbackActive = jobs[activeJobId] ? activeJobId : (jobs[lastJobId] ? lastJobId : Object.keys(jobs)[0] || '');
    return {
        schemaVersion: 1,
        activeJobId: fallbackActive,
        lastJobId: jobs[lastJobId] ? lastJobId : fallbackActive,
        jobs,
    };
}

export function mergeLoredeckCreatorRegistries(globalRegistry = {}, localRegistry = {}, options = {}) {
    const globalNormalized = normalizeLoredeckCreatorRegistry(globalRegistry);
    const localNormalized = normalizeLoredeckCreatorRegistry(localRegistry);
    const jobs = {};
    const addJob = job => {
        if (!job?.jobId) return;
        const existing = jobs[job.jobId];
        if (!existing || (Number(job.updatedAt) || 0) >= (Number(existing.updatedAt) || 0)) {
            jobs[job.jobId] = job;
        }
    };
    for (const job of Object.values(globalNormalized.jobs || {})) addJob(job);
    for (const job of Object.values(localNormalized.jobs || {})) addJob(job);
    const preferLocalActive = options.preferLocalActive !== false;
    const activeJobId = preferLocalActive && localNormalized.activeJobId && jobs[localNormalized.activeJobId]
        ? localNormalized.activeJobId
        : (globalNormalized.activeJobId && jobs[globalNormalized.activeJobId]
            ? globalNormalized.activeJobId
            : (localNormalized.activeJobId && jobs[localNormalized.activeJobId]
                ? localNormalized.activeJobId
                : ''));
    const lastJobId = preferLocalActive && localNormalized.lastJobId && jobs[localNormalized.lastJobId]
        ? localNormalized.lastJobId
        : (globalNormalized.lastJobId && jobs[globalNormalized.lastJobId]
            ? globalNormalized.lastJobId
            : (activeJobId || ''));
    return normalizeLoredeckCreatorRegistry({
        schemaVersion: 1,
        activeJobId,
        lastJobId,
        jobs,
    });
}

function getLoredeckCreatorSettingsRegistry(settings = getSettings()) {
    return normalizeLoredeckCreatorRegistry(settings.loredeckCreatorProjects || DEFAULT_SETTINGS.loredeckCreatorProjects);
}

export function getMostRecentLoredeckCreatorJob(registry = {}) {
    return Object.values(registry.jobs || {})
        .filter(job => job?.jobId)
        .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))[0] || null;
}

function normalizeLoredeckCreatorPackIdCandidate(value = '') {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .slice(0, 96);
}

function getLoredeckCreatorJobGeneratedPackIdCandidates(job = {}) {
    const values = [
        job?.generatedPackId,
        job?.brief?.packId,
        job?.brief?.title,
    ];
    const output = [];
    const seen = new Set();
    for (const value of values) {
        for (const candidate of [
            normalizeLoredeckCreatorString(value, 200),
            normalizeLoredeckCreatorPackIdCandidate(value),
        ]) {
            if (!candidate || seen.has(candidate)) continue;
            seen.add(candidate);
            output.push(candidate);
        }
    }
    return output;
}

export function removeLoredeckCreatorJobsForGeneratedPackId(registry = {}, packId = '') {
    const id = normalizeLoredeckCreatorString(packId, 200);
    const normalizedId = normalizeLoredeckCreatorPackIdCandidate(packId);
    const targetIds = new Set([id, normalizedId].filter(Boolean));
    const next = normalizeLoredeckCreatorRegistry(registry);
    if (!targetIds.size || !Object.keys(next.jobs || {}).length) {
        return { registry: next, removedJobIds: [] };
    }

    const removedJobIds = [];
    for (const [jobId, job] of Object.entries(next.jobs || {})) {
        if (!getLoredeckCreatorJobGeneratedPackIdCandidates(job).some(candidate => targetIds.has(candidate))) continue;
        delete next.jobs[jobId];
        removedJobIds.push(jobId);
    }
    if (!removedJobIds.length) return { registry: next, removedJobIds };

    const removed = new Set(removedJobIds);
    if (removed.has(next.activeJobId)) next.activeJobId = '';
    if (removed.has(next.lastJobId)) next.lastJobId = '';
    const nextActive = getMostRecentLoredeckCreatorJob(next);
    if (nextActive) {
        next.activeJobId = nextActive.jobId;
        next.lastJobId = nextActive.jobId;
    }
    return {
        registry: normalizeLoredeckCreatorRegistry(next),
        removedJobIds,
    };
}
