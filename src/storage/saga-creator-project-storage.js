/**
 * External Loredeck Creator project storage.
 */

import {
    getMostRecentLoredeckCreatorJob,
    mergeLoredeckCreatorRegistries,
    normalizeLoredeckCreatorJob,
    normalizeLoredeckCreatorRegistry,
    normalizeLoredeckCreatorString,
} from '../state/lore-creator-state.js';
import { createSagaDomainStorage, buildSagaDomainPayloadPath } from './saga-domain-storage.js';
import { createSagaFileApi } from './saga-file-api.js';
import { createSagaStorageIndexStore, SAGA_STORAGE_DOMAIN_INDEX_FILES } from './saga-storage-index.js';
import {
    assertSagaUserFilesPath,
    getSagaUserFilesFileName,
    SAGA_STORAGE_JSON_EXTENSION,
} from './saga-storage-filenames.js';

const EMPTY_CREATOR_REGISTRY = Object.freeze({ schemaVersion: 1, activeJobId: '', lastJobId: '', jobs: Object.freeze({}) });
const CREATOR_INDEX_KIND = 'saga_creator_index';
const CREATOR_PROJECT_KIND = 'saga_creator_project';

let creatorRuntimeOptions = {};
let hydratedCreatorIndex = createSagaCreatorIndex({ now: 0 });
let projectPayloadCache = new Map();
let hydrationStatus = {
    loaded: false,
    loading: false,
    loadedAt: 0,
    error: '',
};
let hydrationPromise = null;
let pendingCreatorWrite = Promise.resolve();
let pendingCreatorWriteCount = 0;
let lastCreatorWriteError = '';

export function configureSagaCreatorProjectStorage(options = {}) {
    creatorRuntimeOptions = { ...creatorRuntimeOptions, ...(options || {}) };
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value ?? null));
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTimestamp(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return Math.max(0, Number(fallback) || 0);
    return Math.floor(numeric);
}

function normalizeRevision(value, fallback = 1) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return Math.max(1, Number(fallback) || 1);
    return Math.floor(numeric);
}

function resolveStorageOptions(options = {}) {
    return { ...(creatorRuntimeOptions || {}), ...(options || {}) };
}

function getClockNow(options = {}) {
    const merged = resolveStorageOptions(options);
    if (typeof merged.now === 'function') return normalizeTimestamp(merged.now(), Date.now());
    if (merged.now !== undefined) return normalizeTimestamp(merged.now, Date.now());
    return Date.now();
}

function getFileApi(options = {}) {
    const merged = resolveStorageOptions(options);
    return merged.fileApi || createSagaFileApi(merged.fileApiOptions || {});
}

function getStorageIndexStore(options = {}) {
    const merged = resolveStorageOptions(options);
    return merged.storageIndexStore || createSagaStorageIndexStore({
        fileApi: getFileApi(options),
        now: merged.now,
    });
}

function getDomainStorage(options = {}) {
    const merged = resolveStorageOptions(options);
    return merged.domainStorage || createSagaDomainStorage({
        fileApi: getFileApi(options),
        storageIndexStore: getStorageIndexStore(options),
        now: merged.now,
    });
}

function normalizeStoragePath(value = '') {
    try {
        return assertSagaUserFilesPath(value, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    } catch {
        return '';
    }
}

function normalizeJobId(value = '') {
    return normalizeLoredeckCreatorString(value, 160);
}

function sortObjectByKey(value = {}) {
    return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)));
}

function getProjectTitle(job = {}) {
    return normalizeLoredeckCreatorString(
        job.projectTitle
            || job.brief?.title
            || job.generatedPackTitle
            || (job.fandom && job.scope ? `${job.fandom}: ${job.scope}` : '')
            || job.fandom
            || job.scope
            || job.jobId,
        240,
    );
}

function getGeneratedPackId(job = {}) {
    return normalizeLoredeckCreatorString(job.generatedPackId || job.brief?.packId || '', 200);
}

function getProjectCountListLength(value = []) {
    return Array.isArray(value) ? value.length : 0;
}

function getProjectProgress(job = {}) {
    return {
        titleDraftCount: getProjectCountListLength(job.titleDrafts),
        approvedTitleCount: getProjectCountListLength(job.approvedTitleDraftIds),
        titleBatchDraftedCount: getProjectCountListLength(job.titleBatchDraftedIds),
        planningQueuedCount: getProjectCountListLength(job.planningBatchQueuedIds) || Math.max(0, Number(job.planningQueuedCount) || 0),
        planningAcceptedCount: getProjectCountListLength(job.planningBatchAcceptedIds),
        entryDraftCount: Math.max(0, Number(job.entryDraftCount) || 0),
        draftChangeCount: getProjectCountListLength(job.draftChanges),
        generationRunCount: Object.keys(job.generationRuns || {}).length,
        generationUnitCount: Object.keys(job.generationUnits || {}).length,
    };
}

function normalizeProgress(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const progress = {};
    for (const key of [
        'titleDraftCount',
        'approvedTitleCount',
        'titleBatchDraftedCount',
        'planningQueuedCount',
        'planningAcceptedCount',
        'entryDraftCount',
        'draftChangeCount',
        'generationRunCount',
        'generationUnitCount',
        'acceptedEntryCount',
        'pendingReviewCount',
    ]) {
        const number = Number(raw[key]);
        if (Number.isFinite(number) && number > 0) progress[key] = Math.round(number);
    }
    return progress;
}

function normalizeCurrentTask(value = {}) {
    const raw = isPlainObject(value) ? value : {};
    const label = normalizeLoredeckCreatorString(raw.label || raw.message || '', 180);
    const status = normalizeLoredeckCreatorString(raw.status || '', 80).toLowerCase();
    const task = {
        label,
        status: ['idle', 'queued', 'running', 'review', 'blocked', 'complete', 'error'].includes(status) ? status : 'idle',
        updatedAt: normalizeTimestamp(raw.updatedAt, 0),
    };
    return task.label || task.status !== 'idle' || task.updatedAt ? task : null;
}

function normalizeProjectIndexRecord(value = {}, fallbackId = '', options = {}) {
    const raw = isPlainObject(value) ? cloneJson(value) : {};
    const jobId = normalizeJobId(raw.jobId || raw.projectId || raw.id || fallbackId);
    const job = normalizeLoredeckCreatorJob({
        ...raw,
        jobId,
        projectTitle: raw.projectTitle || raw.title || '',
        generatedPackId: raw.generatedPackId || raw.linkedGeneratedPackId || '',
        currentStage: raw.currentStage || raw.stage || '',
        projectFile: raw.projectFile || raw.payloadFile || '',
    });
    if (!job?.jobId) return null;
    const now = getClockNow(options);
    const projectFile = normalizeStoragePath(raw.projectFile || raw.payloadFile || job.projectFile || '')
        || buildSagaDomainPayloadPath('creator', job.jobId);
    const progress = normalizeProgress(raw.progress || getProjectProgress(job));
    const activeGeneration = job.activeGeneration && isPlainObject(job.activeGeneration)
        ? {
            id: normalizeLoredeckCreatorString(job.activeGeneration.id || job.activeGeneration.runId || '', 160),
            label: normalizeLoredeckCreatorString(job.activeGeneration.label || '', 180),
            status: normalizeLoredeckCreatorString(job.activeGeneration.status || '', 80),
            stage: normalizeLoredeckCreatorString(job.activeGeneration.currentStage || job.activeGeneration.stage || '', 80),
            updatedAt: normalizeTimestamp(job.activeGeneration.updatedAt, 0),
        }
        : null;
    const record = {
        schemaVersion: 1,
        projectId: job.jobId,
        jobId: job.jobId,
        title: getProjectTitle(job),
        projectTitle: job.projectTitle || getProjectTitle(job),
        fandom: job.fandom || '',
        scope: job.scope || '',
        granularity: job.granularity || '',
        stage: job.currentStage || 'intake',
        currentStage: job.currentStage || 'intake',
        status: job.status || 'draft',
        archived: job.archived === true,
        folderId: job.folderId || '',
        linkedGeneratedPackId: getGeneratedPackId(job),
        generatedPackId: getGeneratedPackId(job),
        generatedPackTitle: job.generatedPackTitle || '',
        projectFile,
        progress,
        createdAt: normalizeTimestamp(job.createdAt, now),
        updatedAt: normalizeTimestamp(job.updatedAt, now),
    };
    const currentTask = normalizeCurrentTask(raw.currentTask || activeGeneration);
    if (currentTask) record.currentTask = currentTask;
    if (activeGeneration?.id) record.activeGeneration = activeGeneration;
    for (const key of ['fandom', 'scope', 'granularity', 'folderId', 'linkedGeneratedPackId', 'generatedPackId', 'generatedPackTitle']) {
        if (!record[key]) delete record[key];
    }
    if (!Object.keys(record.progress || {}).length) delete record.progress;
    return record;
}

export function createSagaCreatorIndex(options = {}) {
    const now = getClockNow(options);
    return {
        schemaVersion: 1,
        kind: CREATOR_INDEX_KIND,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        activeJobId: '',
        lastJobId: '',
        projects: {},
    };
}

export function normalizeSagaCreatorIndex(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const createdAt = normalizeTimestamp(raw.createdAt, options.now || 0);
    const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt);
    const sourceProjects = isPlainObject(raw.projects) ? raw.projects : (isPlainObject(raw.jobs) ? raw.jobs : {});
    const projects = {};
    for (const [projectId, project] of Object.entries(sourceProjects)) {
        const normalized = normalizeProjectIndexRecord(project, projectId, { ...options, now: updatedAt || options.now || 0 });
        if (normalized) projects[normalized.jobId] = normalized;
    }
    const recent = Object.values(projects).sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0))[0] || null;
    const requestedActive = normalizeJobId(raw.activeJobId || raw.activeProjectId || '');
    const requestedLast = normalizeJobId(raw.lastJobId || raw.lastProjectId || '');
    const activeJobId = projects[requestedActive] ? requestedActive : (recent?.jobId || '');
    const lastJobId = projects[requestedLast] ? requestedLast : activeJobId;
    return {
        schemaVersion: 1,
        kind: CREATOR_INDEX_KIND,
        createdAt,
        updatedAt,
        revision: normalizeRevision(raw.revision, 1),
        activeJobId,
        lastJobId,
        activeProjectId: activeJobId,
        lastProjectId: lastJobId,
        projects: sortObjectByKey(projects),
    };
}

function setHydratedCreatorIndex(index = {}, options = {}) {
    const now = getClockNow(options);
    hydratedCreatorIndex = normalizeSagaCreatorIndex(index, { now });
    hydrationStatus = {
        loaded: true,
        loading: false,
        loadedAt: now,
        error: '',
    };
    return getExternalLoredeckCreatorIndex();
}

function shouldPersistQueuedWrites(options = {}) {
    const merged = resolveStorageOptions(options);
    if (merged.persistWrites === false || merged.persist === false) return false;
    if (merged.fileApi || merged.domainStorage || merged.storageIndexStore) return true;
    return typeof window !== 'undefined' && typeof fetch === 'function';
}

function recordQueuedWriteError(error = {}, options = {}) {
    const merged = resolveStorageOptions(options);
    lastCreatorWriteError = String(error?.message || error || 'Creator project external storage write failed.');
    if (typeof merged.onWriteError === 'function') {
        merged.onWriteError(error);
        return;
    }
    console.warn('[Saga] Creator project external storage write failed:', error);
}

export function normalizeExternalLoredeckCreatorProjectPayload(value = {}, options = {}) {
    const raw = isPlainObject(value) ? cloneJson(value) : {};
    const job = normalizeLoredeckCreatorJob(raw);
    if (!job?.jobId) {
        return {
            schemaVersion: 1,
            kind: CREATOR_PROJECT_KIND,
            revision: 1,
            projectId: '',
            jobId: '',
            status: 'draft',
            currentStage: 'intake',
            generationRuns: {},
            generationUnits: {},
        };
    }
    const now = getClockNow(options);
    const projectFile = normalizeStoragePath(raw.projectFile || raw.payloadFile || job.projectFile || '')
        || buildSagaDomainPayloadPath('creator', job.jobId);
    return {
        ...job,
        schemaVersion: 1,
        kind: CREATOR_PROJECT_KIND,
        revision: normalizeRevision(raw.revision, 1),
        projectId: job.jobId,
        jobId: job.jobId,
        projectFile,
        createdAt: normalizeTimestamp(job.createdAt, now),
        updatedAt: normalizeTimestamp(job.updatedAt, now),
    };
}

export function createExternalLoredeckCreatorIndexRecord(payload = {}, options = {}) {
    return normalizeProjectIndexRecord(normalizeExternalLoredeckCreatorProjectPayload(payload, options), '', options);
}

function setProjectPayloadCache(payload = {}, options = {}) {
    const normalized = normalizeExternalLoredeckCreatorProjectPayload(payload, options);
    if (!normalized.jobId) return null;
    projectPayloadCache.set(normalized.jobId, normalized);
    return cloneJson(normalized);
}

export function getCachedExternalLoredeckCreatorProject(jobId = '') {
    const id = normalizeJobId(jobId);
    return id && projectPayloadCache.has(id) ? cloneJson(projectPayloadCache.get(id)) : null;
}

export function hasCachedExternalLoredeckCreatorProject(jobId = '') {
    const id = normalizeJobId(jobId);
    return !!(id && projectPayloadCache.has(id));
}

export function isExternalLoredeckCreatorProjectBackedRecord(record = {}) {
    return !!normalizeStoragePath(record?.projectFile || record?.payloadFile || '');
}

export function isExternalLoredeckCreatorProjectHydratedRecord(record = {}) {
    if (!isPlainObject(record)) return false;
    const jobId = normalizeJobId(record.jobId || record.projectId || '');
    if (jobId && hasCachedExternalLoredeckCreatorProject(jobId)) return true;
    if (isPlainObject(record.brief)) return true;
    if (isPlainObject(record.outline)) return true;
    if (Array.isArray(record.titleDrafts) && record.titleDrafts.length) return true;
    if (Array.isArray(record.draftChanges) && record.draftChanges.length) return true;
    if (isPlainObject(record.batches) && Object.keys(record.batches).length) return true;
    if (isPlainObject(record.generationSettings) && Object.keys(record.generationSettings).length) return true;
    return false;
}

export function hydrateCachedExternalLoredeckCreatorProjectRecord(record = {}) {
    const jobId = normalizeJobId(record?.jobId || record?.projectId || '');
    if (!jobId) return isPlainObject(record) ? cloneJson(record) : null;
    const cached = getCachedExternalLoredeckCreatorProject(jobId);
    if (!cached) return cloneJson(record);
    return normalizeLoredeckCreatorJob({
        ...cached,
        ...(isPlainObject(record) ? cloneJson(record) : {}),
        projectTitle: cached.projectTitle,
        brief: cached.brief,
        outline: cached.outline,
        titleDrafts: cached.titleDrafts,
        selectedTitleDraftIds: cached.selectedTitleDraftIds,
        approvedTitleDraftIds: cached.approvedTitleDraftIds,
        titleBatchDraftedIds: cached.titleBatchDraftedIds,
        planningBatchQueuedIds: cached.planningBatchQueuedIds,
        planningBatchAcceptedIds: cached.planningBatchAcceptedIds,
        draftChanges: cached.draftChanges,
        generationRuns: cached.generationRuns || {},
        generationUnits: cached.generationUnits || {},
        activeGeneration: cached.activeGeneration,
        lastGenerationResult: cached.lastGenerationResult,
        titleBatch: cached.titleBatch,
        stageStatus: cached.stageStatus,
        batches: cached.batches,
        generationSettings: cached.generationSettings,
        projectFile: record.projectFile || cached.projectFile,
    });
}

export async function hydrateExternalLoredeckCreatorProjectRecord(record = {}, options = {}) {
    const jobId = normalizeJobId(record?.jobId || record?.projectId || '');
    if (!jobId) return hydrateCachedExternalLoredeckCreatorProjectRecord(record);
    if (projectPayloadCache.has(jobId)) return hydrateCachedExternalLoredeckCreatorProjectRecord(record);
    const projectFile = normalizeStoragePath(record.projectFile || record.payloadFile || '');
    if (!projectFile) return hydrateCachedExternalLoredeckCreatorProjectRecord(record);
    const raw = await getFileApi(options).readJsonFile(projectFile, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    setProjectPayloadCache({
        ...raw,
        jobId: raw?.jobId || jobId,
        projectFile,
    }, options);
    return hydrateCachedExternalLoredeckCreatorProjectRecord(record);
}

function updateCreatorIndexRecord(index = {}, record = {}, options = {}) {
    const now = getClockNow(options);
    const current = normalizeSagaCreatorIndex(index, { now });
    const compact = normalizeProjectIndexRecord(record, '', { now });
    if (!compact) return current;
    const existing = current.projects[compact.jobId] || {};
    current.projects[compact.jobId] = {
        ...existing,
        ...compact,
        createdAt: existing.createdAt || compact.createdAt || now,
        updatedAt: compact.updatedAt || now,
    };
    current.projects = sortObjectByKey(current.projects);
    if (options.activeJobId !== undefined || options.activate === true) {
        const active = normalizeJobId(options.activeJobId || compact.jobId);
        current.activeJobId = current.projects[active] ? active : current.activeJobId;
    }
    if (options.lastJobId !== undefined || options.activate === true) {
        const last = normalizeJobId(options.lastJobId || compact.jobId);
        current.lastJobId = current.projects[last] ? last : current.lastJobId;
    }
    if (!current.activeJobId || !current.projects[current.activeJobId]) current.activeJobId = compact.jobId;
    if (!current.lastJobId || !current.projects[current.lastJobId]) current.lastJobId = current.activeJobId;
    current.activeProjectId = current.activeJobId;
    current.lastProjectId = current.lastJobId;
    current.updatedAt = now;
    if (options.bumpRevision !== false) current.revision = normalizeRevision(current.revision + 1, 2);
    return normalizeSagaCreatorIndex(current, { now });
}

function removeCreatorIndexRecord(index = {}, jobId = '', options = {}) {
    const now = getClockNow(options);
    const current = normalizeSagaCreatorIndex(index, { now });
    const id = normalizeJobId(jobId);
    if (!id || !current.projects[id]) return current;
    delete current.projects[id];
    const recent = Object.values(current.projects)
        .sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0))[0] || null;
    if (current.activeJobId === id) current.activeJobId = recent?.jobId || '';
    if (current.lastJobId === id) current.lastJobId = current.activeJobId;
    if (!current.projects[current.activeJobId]) current.activeJobId = recent?.jobId || '';
    if (!current.projects[current.lastJobId]) current.lastJobId = current.activeJobId;
    current.activeProjectId = current.activeJobId;
    current.lastProjectId = current.lastJobId;
    current.updatedAt = now;
    if (options.bumpRevision !== false) current.revision = normalizeRevision(current.revision + 1, 2);
    return normalizeSagaCreatorIndex(current, { now });
}

function queueExternalLoredeckCreatorProjectWrite(payload = {}, index = hydratedCreatorIndex, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingCreatorWrite;
    const merged = resolveStorageOptions(options);
    const payloadSnapshot = normalizeExternalLoredeckCreatorProjectPayload(payload, merged);
    const indexSnapshot = normalizeSagaCreatorIndex(index, merged);
    pendingCreatorWriteCount += 1;
    pendingCreatorWrite = pendingCreatorWrite
        .catch(() => {})
        .then(async () => {
            try {
                const domainStorage = getDomainStorage(merged);
                await domainStorage.writePayload('creator', payloadSnapshot.jobId, payloadSnapshot, {
                    ...merged,
                    kind: 'creator_project_payload',
                    deletion: 'delete_with_owner',
                });
                await writeExternalLoredeckCreatorIndex(indexSnapshot, merged);
                lastCreatorWriteError = '';
            } catch (error) {
                recordQueuedWriteError(error, merged);
            } finally {
                pendingCreatorWriteCount = Math.max(0, pendingCreatorWriteCount - 1);
            }
        });
    return pendingCreatorWrite;
}

function queueExternalLoredeckCreatorProjectDelete(jobId = '', projectFile = '', index = hydratedCreatorIndex, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingCreatorWrite;
    const merged = resolveStorageOptions(options);
    const id = normalizeJobId(jobId);
    const file = normalizeStoragePath(projectFile || '');
    const indexSnapshot = normalizeSagaCreatorIndex(index, merged);
    pendingCreatorWriteCount += 1;
    pendingCreatorWrite = pendingCreatorWrite
        .catch(() => {})
        .then(async () => {
            try {
                const fileApi = getFileApi(merged);
                const storageIndexStore = getStorageIndexStore(merged);
                if (file) {
                    await fileApi.deleteFile(file, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
                    if (storageIndexStore?.unregisterFile) await storageIndexStore.unregisterFile(file, merged);
                }
                await writeExternalLoredeckCreatorIndex(indexSnapshot, merged);
                lastCreatorWriteError = '';
            } catch (error) {
                recordQueuedWriteError(error, merged);
            } finally {
                pendingCreatorWriteCount = Math.max(0, pendingCreatorWriteCount - 1);
            }
        });
    return pendingCreatorWrite;
}

export function upsertExternalLoredeckCreatorProjectSync(jobRecord = {}, options = {}) {
    const payload = setProjectPayloadCache(jobRecord, options);
    if (!payload?.jobId) return { ok: false, error: 'Creator project must include a jobId/id.' };
    const index = updateCreatorIndexRecord(hydratedCreatorIndex, createExternalLoredeckCreatorIndexRecord(payload, options), options);
    const external = setHydratedCreatorIndex(index, options);
    queueExternalLoredeckCreatorProjectWrite(payload, external, options);
    return {
        ok: true,
        job: hydrateCachedExternalLoredeckCreatorProjectRecord(external.projects[payload.jobId]),
        project: external.projects[payload.jobId],
        payload,
        index: external,
        registry: getExternalLoredeckCreatorRegistry(),
    };
}

export function removeExternalLoredeckCreatorProjectSync(jobId = '', options = {}) {
    const id = normalizeJobId(jobId);
    if (!id) return { ok: false, error: 'Missing Creator project id.' };
    const cached = getCachedExternalLoredeckCreatorProject(id);
    const existing = hydratedCreatorIndex.projects?.[id] || {};
    const projectFile = normalizeStoragePath(options.projectFile || cached?.projectFile || existing.projectFile || '');
    if (!cached && !existing.projectFile && !projectFile) {
        return { ok: false, notFound: true, error: 'Creator project is not registered in external storage.' };
    }
    projectPayloadCache.delete(id);
    const index = removeCreatorIndexRecord(hydratedCreatorIndex, id, options);
    const external = setHydratedCreatorIndex(index, options);
    queueExternalLoredeckCreatorProjectDelete(id, projectFile, external, options);
    return {
        ok: true,
        projectFile,
        index: external,
        registry: getExternalLoredeckCreatorRegistry(),
    };
}

export async function writeExternalLoredeckCreatorIndex(index = {}, options = {}) {
    const now = getClockNow(options);
    const normalized = normalizeSagaCreatorIndex({
        ...index,
        updatedAt: now,
    }, { now });
    const fileApi = getFileApi(options);
    const result = await fileApi.writeJsonFile(getSagaUserFilesFileName(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator), normalized, {
        pretty: options.pretty,
    });
    const storageIndexStore = getStorageIndexStore(options);
    if (storageIndexStore?.registerFile) {
        await storageIndexStore.registerFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator, {
            kind: 'creator_index',
            domain: 'creator',
            ownerId: 'creator',
            mime: 'application/json',
            deletion: 'managed',
        }, options);
    }
    hydratedCreatorIndex = normalizeSagaCreatorIndex(normalized, { now });
    return {
        ...result,
        ok: true,
        path: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        index: getExternalLoredeckCreatorIndex(),
    };
}

export async function hydrateSagaCreatorProjectStorage(options = {}) {
    if (hydrationPromise && options.force !== true) return hydrationPromise;
    hydrationStatus = { ...hydrationStatus, loading: true, error: '' };
    hydrationPromise = (async () => {
        const fileApi = getFileApi(options);
        let index;
        try {
            index = await fileApi.readJsonFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
        } catch (error) {
            if (error?.status === 404 || /missing|not found|404/i.test(String(error?.message || ''))) {
                index = createSagaCreatorIndex({ now: getClockNow(options) });
            } else {
                throw error;
            }
        }
        hydratedCreatorIndex = normalizeSagaCreatorIndex(index, { now: getClockNow(options) });
        hydrationStatus = {
            loaded: true,
            loading: false,
            loadedAt: getClockNow(options),
            error: '',
        };
        return { ok: true, index: getExternalLoredeckCreatorIndex(), registry: getExternalLoredeckCreatorRegistry() };
    })().catch(error => {
        hydrationStatus = {
            loaded: false,
            loading: false,
            loadedAt: 0,
            error: error?.message || String(error || 'Creator project storage hydration failed.'),
        };
        hydrationPromise = null;
        throw error;
    });
    return hydrationPromise;
}

export function mergeExternalLoredeckCreatorRegistry(settingsRegistry = {}, localRegistry = {}, options = {}) {
    const externalIndex = normalizeSagaCreatorIndex(hydratedCreatorIndex);
    const externalRegistry = normalizeLoredeckCreatorRegistry({
        schemaVersion: 1,
        activeJobId: externalIndex.activeJobId,
        lastJobId: externalIndex.lastJobId,
        jobs: Object.fromEntries(Object.entries(externalIndex.projects || {})
            .map(([jobId, record]) => [jobId, hydrateCachedExternalLoredeckCreatorProjectRecord(record)])),
    });
    const settingsAndExternal = mergeLoredeckCreatorRegistries(
        externalRegistry,
        normalizeLoredeckCreatorRegistry(settingsRegistry || EMPTY_CREATOR_REGISTRY),
        { preferLocalActive: false },
    );
    const merged = mergeLoredeckCreatorRegistries(
        settingsAndExternal,
        normalizeLoredeckCreatorRegistry(localRegistry || EMPTY_CREATOR_REGISTRY),
        { preferLocalActive: options.preferLocalActive !== false },
    );
    return normalizeLoredeckCreatorRegistry(merged);
}

export function getExternalLoredeckCreatorIndex() {
    return cloneJson(hydratedCreatorIndex);
}

export function getExternalLoredeckCreatorRegistry() {
    return normalizeLoredeckCreatorRegistry({
        schemaVersion: 1,
        activeJobId: hydratedCreatorIndex.activeJobId,
        lastJobId: hydratedCreatorIndex.lastJobId,
        jobs: Object.fromEntries(Object.entries(hydratedCreatorIndex.projects || {})
            .map(([jobId, record]) => [jobId, hydrateCachedExternalLoredeckCreatorProjectRecord(record)])),
    });
}

export function getSagaCreatorProjectStorageStatus() {
    return {
        ...hydrationStatus,
        pendingWrites: pendingCreatorWriteCount,
        lastWriteError: lastCreatorWriteError,
        cachedProjectCount: projectPayloadCache.size,
    };
}

export async function flushSagaCreatorProjectStorageWrites() {
    await pendingCreatorWrite;
    return {
        ok: !lastCreatorWriteError,
        error: lastCreatorWriteError,
        pendingWrites: pendingCreatorWriteCount,
        index: getExternalLoredeckCreatorIndex(),
        registry: getExternalLoredeckCreatorRegistry(),
    };
}

export function resetSagaCreatorProjectStorageCache() {
    hydratedCreatorIndex = createSagaCreatorIndex({ now: 0 });
    projectPayloadCache = new Map();
    hydrationStatus = {
        loaded: false,
        loading: false,
        loadedAt: 0,
        error: '',
    };
    hydrationPromise = null;
    pendingCreatorWrite = Promise.resolve();
    pendingCreatorWriteCount = 0;
    lastCreatorWriteError = '';
}

export function getMostRecentExternalLoredeckCreatorProject(registry = getExternalLoredeckCreatorRegistry()) {
    return getMostRecentLoredeckCreatorJob(registry);
}

resetSagaCreatorProjectStorageCache();
