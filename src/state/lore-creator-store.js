/**
 * Deck Maker project persistence store.
 */

import { DEFAULT_SETTINGS, getDefaultState as createDefaultState } from './constants.js';
import { getSettings as readSettings, saveSettings as writeSettings } from './settings-store.js';
import {
    CREATOR_ACTIVE_GENERATION_STATUSES,
    getMostRecentLoredeckCreatorJob,
    normalizeLoredeckCreatorActiveGeneration,
    normalizeLoredeckCreatorGenerationRun,
    normalizeLoredeckCreatorGenerationUnit,
    normalizeLoredeckCreatorId,
    normalizeLoredeckCreatorJob,
    normalizeLoredeckCreatorRegistry,
    normalizeLoredeckCreatorString,
} from './lore-creator-state.js';
import {
    hydrateCachedExternalLoredeckCreatorProjectRecord,
    hydrateExternalLoredeckCreatorProjectRecord,
    isExternalLoredeckCreatorProjectBackedRecord,
    isExternalLoredeckCreatorProjectHydratedRecord,
    mergeExternalLoredeckCreatorRegistry,
    removeExternalLoredeckCreatorProjectSync,
    upsertExternalLoredeckCreatorProjectSync,
} from '../storage/saga-creator-project-storage.js';

let storeDeps = {};

export function configureLoredeckCreatorStore(deps = {}) {
    storeDeps = { ...deps };
}

function getState() {
    if (typeof storeDeps.getState === 'function') return storeDeps.getState();
    throw new Error('Deck Maker store is not configured.');
}

function saveState(state, options) {
    if (typeof storeDeps.saveState === 'function') return storeDeps.saveState(state, options);
    throw new Error('Deck Maker store is not configured.');
}

function getSettings() {
    return typeof storeDeps.getSettings === 'function' ? storeDeps.getSettings() : readSettings();
}

function saveSettings(settings) {
    return typeof storeDeps.saveSettings === 'function' ? storeDeps.saveSettings(settings) : writeSettings(settings);
}

function getDefaultState() {
    return typeof storeDeps.getDefaultState === 'function' ? storeDeps.getDefaultState() : createDefaultState();
}

function getLoredeckCreatorPersistenceErrorMessage(error = {}, fallback = 'Deck Maker project persistence failed.') {
    return normalizeLoredeckCreatorString(error?.message || error || fallback, 500) || fallback;
}

function failLoredeckCreatorPersistence(error = {}, fallback = 'Deck Maker project persistence failed.') {
    console.warn('[Saga] Deck Maker project persistence failed:', error);
    return {
        ok: false,
        error: getLoredeckCreatorPersistenceErrorMessage(error, fallback),
    };
}

function cleanupSettingsLoredeckCreatorJob(settings = {}, jobId = '') {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id || !settings || typeof settings !== 'object') return false;
    const registry = getLoredeckCreatorSettingsRegistry(settings);
    if (!registry.jobs?.[id]) return false;
    delete registry.jobs[id];
    if (registry.activeJobId === id) registry.activeJobId = '';
    if (registry.lastJobId === id) registry.lastJobId = '';
    const recent = getMostRecentLoredeckCreatorJob(registry);
    if (recent) {
        registry.activeJobId = recent.jobId;
        registry.lastJobId = recent.jobId;
    }
    settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(registry);
    return true;
}

function cleanupSettingsLoredeckCreatorJobs(settings = {}, jobIds = []) {
    let changed = false;
    for (const jobId of jobIds || []) {
        if (cleanupSettingsLoredeckCreatorJob(settings, jobId)) changed = true;
    }
    return changed;
}

function saveSettingsCleanup(settings = {}) {
    try {
        saveSettings(settings);
        return { ok: true };
    } catch (error) {
        console.warn('[Saga] Deck Maker settings cleanup failed:', error);
        return { ok: false, error: getLoredeckCreatorPersistenceErrorMessage(error, 'Deck Maker project settings cleanup failed.') };
    }
}

function getBestAvailableCreatorJob(projectJob = null, localJob = null) {
    if (projectJob && isExternalLoredeckCreatorProjectBackedRecord(projectJob)
        && !isExternalLoredeckCreatorProjectHydratedRecord(projectJob)) {
        return localJob || projectJob;
    }
    return projectJob || localJob || null;
}

function getCreatorPayloadNotLoadedResult(jobId = '') {
    return {
        ok: false,
        error: 'Deck Maker project payload must be loaded before saving changes to this external Deck Maker project.',
        code: 'creator_payload_not_loaded',
        jobId: normalizeLoredeckCreatorString(jobId, 160),
    };
}

function preserveLoredeckCreatorExplicitGenerationClears(job = {}, patch = {}) {
    if (!job || typeof job !== 'object' || !patch || typeof patch !== 'object') return job;
    if (Object.prototype.hasOwnProperty.call(patch, 'activeGeneration') && patch.activeGeneration === null) {
        delete job.activeGeneration;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'lastGenerationResult') && patch.lastGenerationResult === null) {
        delete job.lastGenerationResult;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'draftChanges') && Array.isArray(patch.draftChanges) && !patch.draftChanges.length) {
        delete job.draftChanges;
    }
    return job;
}

function applyLoredeckCreatorExplicitGenerationClearsForStorage(job = {}, patch = {}) {
    const output = { ...(job || {}) };
    if (!patch || typeof patch !== 'object') return output;
    if (Object.prototype.hasOwnProperty.call(patch, 'activeGeneration') && patch.activeGeneration === null) {
        output.activeGeneration = null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'lastGenerationResult') && patch.lastGenerationResult === null) {
        output.lastGenerationResult = null;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'draftChanges') && Array.isArray(patch.draftChanges) && !patch.draftChanges.length) {
        output.draftChanges = [];
    }
    return output;
}

function createLoredeckCreatorJobId(seed = '') {
    const stem = normalizeLoredeckCreatorString(seed, 100)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60) || 'creator';
    return `${stem}_${Date.now().toString(36)}`;
}

export function getLoredeckCreatorSettingsRegistry(settings = getSettings()) {
    return normalizeLoredeckCreatorRegistry(settings.loredeckCreatorProjects || DEFAULT_SETTINGS.loredeckCreatorProjects);
}

export function getLoredeckCreatorRegistry(state = null) {
    const source = state || getState();
    return mergeExternalLoredeckCreatorRegistry(
        getLoredeckCreatorSettingsRegistry(),
        normalizeLoredeckCreatorRegistry(source?.loredeckCreator || getDefaultState().loredeckCreator),
        { preferLocalActive: !!source?.loredeckCreator?.activeJobId }
    );
}

export function getLoredeckCreatorProjectRegistry() {
    return mergeExternalLoredeckCreatorRegistry(
        getLoredeckCreatorSettingsRegistry(),
        getDefaultState().loredeckCreator,
        { preferLocalActive: false }
    );
}

export function getActiveLoredeckCreatorJob(state = null) {
    const registry = getLoredeckCreatorRegistry(state);
    return registry.activeJobId ? (registry.jobs[registry.activeJobId] || null) : null;
}

export function upsertLoredeckCreatorJob(jobRecord = {}, options = {}) {
    const state = getState();
    const registry = getLoredeckCreatorRegistry(state);
    const active = registry.activeJobId ? registry.jobs[registry.activeJobId] : null;
    const requestedJobId = normalizeLoredeckCreatorString(jobRecord.jobId, 160);
    const existing = requestedJobId ? (registry.jobs[requestedJobId] || null) : active;
    const base = existing || (!requestedJobId ? active : null);
    const seed = `${jobRecord.fandom || base?.fandom || active?.fandom || 'creator'}-${jobRecord.scope || base?.scope || active?.scope || ''}`;
    const job = preserveLoredeckCreatorExplicitGenerationClears(normalizeLoredeckCreatorJob({
        ...(base || {}),
        ...(jobRecord || {}),
        jobId: requestedJobId || base?.jobId || active?.jobId || createLoredeckCreatorJobId(seed),
        updatedAt: Date.now(),
    }), jobRecord);
    if (!job) return { ok: false, error: 'Deck Maker job could not be normalized.' };

    let settings;
    try {
        settings = getSettings();
        const existingExternal = getLoredeckCreatorProjectRegistry().jobs[job.jobId] || null;
        if (existingExternal?.projectFile && !isExternalLoredeckCreatorProjectHydratedRecord(job)) {
            return getCreatorPayloadNotLoadedResult(job.jobId);
        }
        const externalResult = upsertExternalLoredeckCreatorProjectSync(applyLoredeckCreatorExplicitGenerationClearsForStorage(job, jobRecord), {
            ...options,
            activeJobId: job.jobId,
            lastJobId: job.jobId,
            activate: true,
        });
        if (!externalResult.ok) return externalResult;
        if (cleanupSettingsLoredeckCreatorJob(settings, job.jobId)) saveSettingsCleanup(settings);

        const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
        localRegistry.jobs[job.jobId] = job;
        localRegistry.activeJobId = job.jobId;
        localRegistry.lastJobId = job.jobId;
        state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
        saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });
    } catch (error) {
        return failLoredeckCreatorPersistence(error);
    }
    return {
        ok: true,
        job: state.loredeckCreator.jobs[job.jobId],
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: getLoredeckCreatorProjectRegistry(),
    };
}

export function activateLoredeckCreatorJob(jobId = '', options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Deck Maker project id.' };

    const state = getState();
    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    const externalProjectRegistry = getLoredeckCreatorProjectRegistry();
    const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    const sourceJob = getBestAvailableCreatorJob(externalProjectRegistry.jobs[id] || projectRegistry.jobs[id] || null, localRegistry.jobs[id] || null);
    if (!sourceJob) return { ok: false, error: 'Deck Maker project was not found.' };
    if (isExternalLoredeckCreatorProjectBackedRecord(sourceJob) && !isExternalLoredeckCreatorProjectHydratedRecord(sourceJob)) {
        return getCreatorPayloadNotLoadedResult(id);
    }

    const job = normalizeLoredeckCreatorJob({
        ...hydrateCachedExternalLoredeckCreatorProjectRecord(sourceJob),
        jobId: id,
        updatedAt: sourceJob.updatedAt || Date.now(),
    });
    if (!job) return { ok: false, error: 'Deck Maker project could not be normalized.' };

    const externalResult = upsertExternalLoredeckCreatorProjectSync(job, {
        ...options,
        activeJobId: job.jobId,
        lastJobId: job.jobId,
        activate: true,
    });
    if (!externalResult.ok) return externalResult;
    if (cleanupSettingsLoredeckCreatorJob(settings, job.jobId)) saveSettingsCleanup(settings);

    localRegistry.jobs[job.jobId] = job;
    localRegistry.activeJobId = job.jobId;
    localRegistry.lastJobId = job.jobId;
    state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
    saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });

    return {
        ok: true,
        job: state.loredeckCreator.jobs[job.jobId],
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: getLoredeckCreatorProjectRegistry(),
    };
}

export async function activateLoredeckCreatorJobAsync(jobId = '', options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    const result = activateLoredeckCreatorJob(id, options);
    if (result.ok || result.code !== 'creator_payload_not_loaded') return result;
    const projectJob = getLoredeckCreatorProjectRegistry().jobs[id] || null;
    if (!projectJob?.projectFile) return result;
    try {
        await hydrateExternalLoredeckCreatorProjectRecord(projectJob, options);
    } catch (error) {
        return {
            ok: false,
            error: getLoredeckCreatorPersistenceErrorMessage(error, 'Deck Maker project payload failed to load.'),
            code: 'creator_payload_load_failed',
            jobId: id,
        };
    }
    return activateLoredeckCreatorJob(id, options);
}

export function updateLoredeckCreatorProject(jobId = '', patch = {}, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Deck Maker project id.' };
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return { ok: false, error: 'Deck Maker project update must be an object.' };
    }

    const state = getState();
    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    const externalProjectRegistry = getLoredeckCreatorProjectRegistry();
    const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    const sourceJob = getBestAvailableCreatorJob(externalProjectRegistry.jobs[id] || projectRegistry.jobs[id] || null, localRegistry.jobs[id] || null);
    if (!sourceJob) return { ok: false, error: 'Deck Maker project was not found.' };
    if (isExternalLoredeckCreatorProjectBackedRecord(sourceJob) && !isExternalLoredeckCreatorProjectHydratedRecord(sourceJob)) {
        return getCreatorPayloadNotLoadedResult(id);
    }

    const projectActiveJobId = externalProjectRegistry.activeJobId || projectRegistry.activeJobId;
    const projectLastJobId = externalProjectRegistry.lastJobId || projectRegistry.lastJobId;
    const localActiveJobId = localRegistry.activeJobId;
    const localLastJobId = localRegistry.lastJobId;
    const updatedAt = options.touchUpdatedAt === false
        ? (Number(sourceJob.updatedAt) || Date.now())
        : Date.now();
    const job = preserveLoredeckCreatorExplicitGenerationClears(normalizeLoredeckCreatorJob({
        ...hydrateCachedExternalLoredeckCreatorProjectRecord(sourceJob),
        ...patch,
        jobId: id,
        updatedAt,
    }), patch);
    if (!job) return { ok: false, error: 'Deck Maker project could not be normalized.' };

    try {
        const externalResult = upsertExternalLoredeckCreatorProjectSync(applyLoredeckCreatorExplicitGenerationClearsForStorage(job, patch), {
            ...options,
            activeJobId: projectActiveJobId,
            lastJobId: projectLastJobId,
            activate: false,
        });
        if (!externalResult.ok) return externalResult;
        if (cleanupSettingsLoredeckCreatorJob(settings, id)) saveSettingsCleanup(settings);

        if (localRegistry.jobs[id] || localRegistry.activeJobId === id || options.syncLocal === true) {
            localRegistry.jobs[id] = job;
            localRegistry.activeJobId = localActiveJobId;
            localRegistry.lastJobId = localLastJobId;
            state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
            saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });
        }
    } catch (error) {
        return failLoredeckCreatorPersistence(error);
    }

    return {
        ok: true,
        job,
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: getLoredeckCreatorProjectRegistry(),
    };
}

export function setLoredeckCreatorActiveGeneration(jobId = '', activeGeneration = null, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Deck Maker project id.' };
    const normalizedActive = normalizeLoredeckCreatorActiveGeneration(activeGeneration, id);
    const sourceJob = getLoredeckCreatorRegistry(getState()).jobs[id] || null;
    return updateLoredeckCreatorProject(id, {
        activeGeneration: normalizedActive || null,
        ...(normalizedActive ? {
            status: 'running',
            currentStage: normalizedActive.currentStage || normalizedActive.stage || '',
        } : (sourceJob?.status === 'running' ? { status: sourceJob.complete ? 'complete' : 'draft' } : {})),
    }, { ...options, syncLocal: true });
}

export function updateLoredeckCreatorGenerationRun(jobId = '', runPatch = {}, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Deck Maker project id.' };
    if (!runPatch || typeof runPatch !== 'object' || Array.isArray(runPatch)) {
        return { ok: false, error: 'Deck Maker generation run update must be an object.' };
    }
    const registry = getLoredeckCreatorRegistry(getState());
    const sourceJob = registry.jobs[id] || null;
    if (!sourceJob) return { ok: false, error: 'Deck Maker project was not found.' };
    const runId = normalizeLoredeckCreatorId(runPatch.runId || runPatch.id || sourceJob.activeGeneration?.runId || '', '');
    if (!runId) return { ok: false, error: 'Missing Deck Maker generation run id.' };

    const generationRuns = {
        ...(sourceJob.generationRuns || {}),
    };
    const previous = generationRuns[runId] || {};
    const run = normalizeLoredeckCreatorGenerationRun({
        ...previous,
        ...runPatch,
        runId,
        jobId: id,
        updatedAt: Number.isFinite(Number(runPatch.updatedAt)) ? Number(runPatch.updatedAt) : Date.now(),
    }, Object.keys(generationRuns).length);
    if (!run) return { ok: false, error: 'Deck Maker generation run could not be normalized.' };
    generationRuns[run.runId] = run;

    const patch = { generationRuns };
    if (options.activate === true || (run.status === 'running' && options.activate !== false)) {
        const currentStage = options.currentStage || sourceJob.activeGeneration?.currentStage || sourceJob.currentStage || run.stage || '';
        patch.activeGeneration = {
            ...(sourceJob.activeGeneration || {}),
            id: sourceJob.activeGeneration?.id || run.runId,
            jobId: id,
            runId: run.runId,
            stage: run.stage,
            currentStage,
            status: 'running',
            phase: run.status,
            label: options.label || sourceJob.activeGeneration?.label || 'Generation running',
            startedAt: run.startedAt || Date.now(),
            updatedAt: run.updatedAt || Date.now(),
        };
        patch.status = 'running';
        if (currentStage) patch.currentStage = currentStage;
    } else if (sourceJob.activeGeneration?.runId === run.runId && !CREATOR_ACTIVE_GENERATION_STATUSES.has(run.status)) {
        patch.activeGeneration = null;
        if (sourceJob.status === 'running') patch.status = sourceJob.complete ? 'complete' : 'draft';
    }

    return updateLoredeckCreatorProject(id, patch, { ...options, syncLocal: true });
}

export function updateLoredeckCreatorGenerationUnit(jobId = '', unitId = '', unitPatch = {}, options = {}) {
    const id = normalizeLoredeckCreatorString(jobId, 160);
    if (!id) return { ok: false, error: 'Missing Deck Maker project id.' };
    if (!unitPatch || typeof unitPatch !== 'object' || Array.isArray(unitPatch)) {
        return { ok: false, error: 'Deck Maker generation unit update must be an object.' };
    }
    const registry = getLoredeckCreatorRegistry(getState());
    const sourceJob = registry.jobs[id] || null;
    if (!sourceJob) return { ok: false, error: 'Deck Maker project was not found.' };
    const resolvedUnitId = normalizeLoredeckCreatorId(unitId || unitPatch.unitId || unitPatch.id || sourceJob.activeGeneration?.unitId || '', '');
    if (!resolvedUnitId) return { ok: false, error: 'Missing Deck Maker generation unit id.' };
    const incomingRunId = normalizeLoredeckCreatorId(unitPatch.runId || '', '');
    if (
        sourceJob.activeGeneration?.unitId === resolvedUnitId
        && sourceJob.activeGeneration?.runId
        && incomingRunId
        && sourceJob.activeGeneration.runId !== incomingRunId
        && options.allowStale !== true
    ) {
        return {
            ok: true,
            ignored: true,
            reason: 'stale_creator_generation_unit',
            job: sourceJob,
            registry,
        };
    }

    const generationUnits = {
        ...(sourceJob.generationUnits || {}),
    };
    const previous = generationUnits[resolvedUnitId] || {};
    const unit = normalizeLoredeckCreatorGenerationUnit({
        ...previous,
        ...unitPatch,
        unitId: resolvedUnitId,
        jobId: id,
        updatedAt: Number.isFinite(Number(unitPatch.updatedAt)) ? Number(unitPatch.updatedAt) : Date.now(),
    }, Object.keys(generationUnits).length);
    if (!unit) return { ok: false, error: 'Deck Maker generation unit could not be normalized.' };
    generationUnits[unit.unitId] = unit;

    const patch = { generationUnits };
    if (CREATOR_ACTIVE_GENERATION_STATUSES.has(unit.status) && options.activate !== false) {
        const currentStage = options.currentStage || sourceJob.activeGeneration?.currentStage || sourceJob.currentStage || unit.stage || '';
        patch.activeGeneration = {
            ...(sourceJob.activeGeneration || {}),
            id: sourceJob.activeGeneration?.id || unit.runId || unit.unitId,
            jobId: id,
            runId: unit.runId || sourceJob.activeGeneration?.runId || '',
            unitId: unit.unitId,
            stage: unit.stage || sourceJob.activeGeneration?.stage || '',
            currentStage,
            status: 'running',
            phase: unit.status,
            label: options.label || unit.label || sourceJob.activeGeneration?.label || 'Generation running',
            startedAt: unit.startedAt || sourceJob.activeGeneration?.startedAt || Date.now(),
            updatedAt: unit.updatedAt || Date.now(),
        };
        patch.status = 'running';
        if (currentStage) patch.currentStage = currentStage;
    } else if (
        sourceJob.activeGeneration?.unitId === unit.unitId
        && (
            !sourceJob.activeGeneration?.runId
            || !unit.runId
            || sourceJob.activeGeneration.runId === unit.runId
        )
        && !CREATOR_ACTIVE_GENERATION_STATUSES.has(unit.status)
    ) {
        patch.activeGeneration = null;
        if (sourceJob.status === 'running') patch.status = sourceJob.complete ? 'complete' : 'draft';
    }

    return updateLoredeckCreatorProject(id, patch, { ...options, syncLocal: true });
}

export function clearLoredeckCreatorJob(jobId = '', options = {}) {
    const state = getState();
    const registry = getLoredeckCreatorRegistry(state);
    const id = normalizeLoredeckCreatorString(jobId || registry.activeJobId, 160);
    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorSettingsRegistry(settings);
    const externalRemoval = removeExternalLoredeckCreatorProjectSync(id, options);
    if (id && projectRegistry.jobs[id]) delete projectRegistry.jobs[id];
    if (projectRegistry.activeJobId === id) projectRegistry.activeJobId = '';
    if (projectRegistry.lastJobId === id) projectRegistry.lastJobId = '';
    const nextGlobalActive = getMostRecentLoredeckCreatorJob(projectRegistry);
    if (nextGlobalActive) {
        projectRegistry.activeJobId = nextGlobalActive.jobId;
        projectRegistry.lastJobId = nextGlobalActive.jobId;
    }
    if (id && !externalRemoval.ok && externalRemoval.notFound !== true && !projectRegistry.jobs[id]) {
        return externalRemoval;
    }
    if (cleanupSettingsLoredeckCreatorJob(settings, id) || projectRegistry.jobs[id]) {
        settings.loredeckCreatorProjects = normalizeLoredeckCreatorRegistry(projectRegistry);
        saveSettingsCleanup(settings);
    }

    const localRegistry = normalizeLoredeckCreatorRegistry(state.loredeckCreator || getDefaultState().loredeckCreator);
    if (id && localRegistry.jobs[id]) delete localRegistry.jobs[id];
    if (localRegistry.activeJobId === id) localRegistry.activeJobId = '';
    if (localRegistry.lastJobId === id) localRegistry.lastJobId = '';
    const nextLocalActive = getMostRecentLoredeckCreatorJob(localRegistry);
    if (nextLocalActive) {
        localRegistry.activeJobId = nextLocalActive.jobId;
        localRegistry.lastJobId = nextLocalActive.jobId;
    }
    state.loredeckCreator = normalizeLoredeckCreatorRegistry(localRegistry);
    saveState(state, { syncPrompt: options.syncPrompt !== false, sanitize: true });
    return {
        ok: true,
        registry: getLoredeckCreatorRegistry(state),
        projectRegistry: getLoredeckCreatorProjectRegistry(),
    };
}

export function promoteChatLoredeckCreatorToSettings(state = {}) {
    const chatRegistry = normalizeLoredeckCreatorRegistry(state?.loredeckCreator || getDefaultState().loredeckCreator);
    if (!Object.keys(chatRegistry.jobs || {}).length) return;

    const settings = getSettings();
    const projectRegistry = getLoredeckCreatorProjectRegistry();
    let changed = false;
    for (const [jobId, job] of Object.entries(chatRegistry.jobs || {})) {
        const existing = projectRegistry.jobs[jobId];
        if (!existing || (Number(job.updatedAt) || 0) > (Number(existing.updatedAt) || 0)) {
            upsertExternalLoredeckCreatorProjectSync(job, {
                activeJobId: chatRegistry.activeJobId || projectRegistry.activeJobId,
                lastJobId: chatRegistry.lastJobId || projectRegistry.lastJobId,
                activate: false,
            });
            changed = true;
        }
    }
    if (cleanupSettingsLoredeckCreatorJobs(settings, Object.keys(chatRegistry.jobs || {}))) {
        saveSettingsCleanup(settings);
    }
    return changed;
}
