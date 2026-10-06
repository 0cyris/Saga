/**
 * External Deck Maker project storage.
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
import { createSagaStorageOperationOutcomes } from './saga-storage-operation-outcomes.js';
import { assertSagaStorageWriteAcknowledged, writeSagaStorageJsonFile } from './saga-storage-coordinator.js';
import { getSagaStorageRolledBackRevision, recoverSagaStorageTransactions, runSagaStorageTransaction, verifySagaStorageFiles } from './saga-storage-transactions.js';
import { createSagaStorageIndexStore, SAGA_STORAGE_DOMAIN_INDEX_FILES } from './saga-storage-index.js';
import {
    assertSagaUserFilesPath,
    getSagaUserFilesFileName,
    SAGA_STORAGE_JSON_EXTENSION,
} from './saga-storage-filenames.js';
import {
    assertSagaStorageRevisionFresh,
} from './saga-storage-stale-write.js';

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
let coalescedCreatorProjectWriteRequests = new Map();
let lastCreatorWriteError = '';
const creatorOutcomes = createSagaStorageOperationOutcomes();
const creatorRetryRevisions = new Map();
let durableCreatorIndexRevision = 1;

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
        projectTitle: raw.projectTitle || '',
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
        projectTitle: job.projectTitle || '',
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
        revision: normalizeRevision(raw.revision, 1),
        progress,
        createdAt: normalizeTimestamp(job.createdAt, now),
        updatedAt: normalizeTimestamp(job.updatedAt, now),
    };
    const currentTask = normalizeCurrentTask(raw.currentTask || activeGeneration);
    if (currentTask) record.currentTask = currentTask;
    if (activeGeneration?.id) record.activeGeneration = activeGeneration;
    for (const key of ['projectTitle', 'fandom', 'scope', 'granularity', 'folderId', 'linkedGeneratedPackId', 'generatedPackId', 'generatedPackTitle']) {
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

function recordQueuedWriteError(error = {}, options = {}, attempt) {
    const merged = resolveStorageOptions(options);
    creatorOutcomes.fail(attempt, error);
    lastCreatorWriteError = creatorOutcomes.getError();
    if (typeof merged.onWriteError === 'function') {
        merged.onWriteError(error);
        return;
    }
    console.warn('[Saga] Deck Maker project external storage write failed:', error);
}

async function assertCreatorProjectPayloadFresh(fileApi, payload = {}, expectedRevision = 0) {
    if (!expectedRevision) return true;
    const projectFile = normalizeStoragePath(payload.projectFile || payload.payloadFile || '');
    if (!projectFile) return true;
    let latest = null;
    try {
        latest = await fileApi.readJsonFile(projectFile, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    } catch (error) {
        if (!(error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) throw error;
        latest = { revision: 1 };
    }
    assertSagaStorageRevisionFresh({
        latest,
        expectedRevision,
        domain: 'creator',
        path: projectFile,
        message: 'Deck Maker project storage changed. Reload this project before continuing.',
    });
    return true;
}

async function assertCreatorIndexFresh(fileApi, expectedRevision = 0) {
    if (!expectedRevision) return true;
    let latest = null;
    try {
        latest = await fileApi.readJsonFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    } catch (error) {
        if (!(error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) throw error;
        return true;
    }
    assertSagaStorageRevisionFresh({
        latest,
        expectedRevision,
        domain: 'creator',
        path: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        message: 'Deck Maker project storage changed. Reload this project before continuing.',
    });
    return true;
}

export function normalizeExternalLoredeckCreatorProjectPayload(value = {}, options = {}) {
    const input = isPlainObject(value) ? cloneJson(value) : {};
    const cachedId = normalizeJobId(input.jobId || input.projectId || input.id || '');
    const cached = cachedId && projectPayloadCache.has(cachedId) ? projectPayloadCache.get(cachedId) : null;
    const raw = {
        ...(isPlainObject(cached) ? cloneJson(cached) : {}),
        ...input,
    };
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
        || normalizeStoragePath(cached?.projectFile || cached?.payloadFile || '')
        || buildSagaDomainPayloadPath('creator', job.jobId);
    const revision = Math.max(
        normalizeRevision(raw.revision, 1),
        normalizeRevision(cached?.revision, 1),
    );
    return {
        ...job,
        schemaVersion: 1,
        kind: CREATOR_PROJECT_KIND,
        revision,
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
    if (!compact.activeGeneration) delete current.projects[compact.jobId].activeGeneration;
    if (!compact.currentTask) delete current.projects[compact.jobId].currentTask;
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

function buildCreatorProjectWriteRequest(payload = {}, index = hydratedCreatorIndex, options = {}) {
    const merged = resolveStorageOptions(options);
    const payloadSnapshot = normalizeExternalLoredeckCreatorProjectPayload(payload, merged);
    const indexSnapshot = normalizeSagaCreatorIndex(index, merged);
    const staleCheck = merged.staleCheck !== false && pendingCreatorWriteCount === 0;
    const retryRevision = creatorRetryRevisions.get(payloadSnapshot.jobId);
    const expectedPayloadRevision = staleCheck ? retryRevision ?? normalizeRevision(payloadSnapshot.revision, 1) : 0;
    const payloadWriteSnapshot = normalizeExternalLoredeckCreatorProjectPayload({
        ...payloadSnapshot,
        revision: merged.bumpRevision === false ? expectedPayloadRevision || normalizeRevision(payloadSnapshot.revision, 1) : normalizeRevision((expectedPayloadRevision || normalizeRevision(payloadSnapshot.revision, 1)) + 1, 2),
        updatedAt: getClockNow(merged),
    }, merged);
    const indexRecord = indexSnapshot.projects?.[payloadWriteSnapshot.jobId];
    if (indexRecord) {
        indexRecord.projectFile = payloadWriteSnapshot.projectFile || indexRecord.projectFile;
        indexRecord.revision = payloadWriteSnapshot.revision;
    }
    const expectedIndexRevision = staleCheck
        ? retryRevision !== undefined ? durableCreatorIndexRevision : Math.max(1, normalizeRevision(indexSnapshot.revision, 1) - (merged.bumpRevision === false ? 0 : 1))
        : 0;
    return {
        merged,
        payloadWriteSnapshot,
        indexSnapshot,
        staleCheck,
        expectedPayloadRevision,
        expectedIndexRevision,
        attempt: creatorOutcomes.begin(payloadWriteSnapshot.jobId, 'write_project', { payload: payloadWriteSnapshot, index: indexSnapshot }),
    };
}

async function writeCreatorProjectRequest(request = {}) {
    const {
        merged = {},
        payloadWriteSnapshot = {},
        indexSnapshot = {},
        staleCheck = false,
        expectedPayloadRevision = 0,
        expectedIndexRevision = 0,
        attempt,
    } = request;
    try {
        const domainStorage = getDomainStorage(merged);
        const fileApi = getFileApi(merged);
        await runSagaStorageTransaction(fileApi, {
            domain: 'creator', ownerId: payloadWriteSnapshot.jobId, operation: 'write_project', operationId: attempt.operationId, retryOf: attempt.retryOf,
            paths: [payloadWriteSnapshot.projectFile, SAGA_STORAGE_DOMAIN_INDEX_FILES.creator], request: attempt.request,
        }, async () => {
        await assertCreatorProjectPayloadFresh(fileApi, payloadWriteSnapshot, expectedPayloadRevision);
        await assertCreatorIndexFresh(fileApi, expectedIndexRevision);
        assertSagaStorageWriteAcknowledged(await domainStorage.writePayload('creator', payloadWriteSnapshot.jobId, payloadWriteSnapshot, {
            ...merged,
            staleCheck,
            expectedRevision: expectedPayloadRevision,
            kind: 'creator_project_payload',
            deletion: 'delete_with_owner',
        }));
        setProjectPayloadCache(payloadWriteSnapshot, merged);
        await verifySagaStorageFiles(fileApi, [payloadWriteSnapshot.projectFile]);
        const latestIndex = normalizeSagaCreatorIndex(await readCreatorIndexForMutation(fileApi), merged);
        const mergedIndex = normalizeSagaCreatorIndex({
            ...latestIndex, activeJobId: indexSnapshot.activeJobId, lastJobId: indexSnapshot.lastJobId,
            revision: latestIndex.revision + 1,
            projects: { ...latestIndex.projects, [payloadWriteSnapshot.jobId]: indexSnapshot.projects[payloadWriteSnapshot.jobId] },
        }, merged);
        assertSagaStorageWriteAcknowledged(await writeExternalLoredeckCreatorIndex(mergedIndex, {
            ...merged,
            staleCheck,
            expectedRevision: expectedIndexRevision,
        }));
        return { ok: true };
        }, merged);
        creatorOutcomes.succeed(attempt);
        creatorRetryRevisions.delete(payloadWriteSnapshot.jobId);
        lastCreatorWriteError = creatorOutcomes.getError();
        return { ok: true, persisted: true, queued: false, pendingWrites: 0 };
    } catch (error) {
        const revision = getSagaStorageRolledBackRevision(error, payloadWriteSnapshot.projectFile);
        if (revision !== undefined) creatorRetryRevisions.set(payloadWriteSnapshot.jobId, revision);
        durableCreatorIndexRevision = getSagaStorageRolledBackRevision(error, SAGA_STORAGE_DOMAIN_INDEX_FILES.creator) ?? durableCreatorIndexRevision;
        recordQueuedWriteError(error, merged, attempt);
        return { ok: false, persisted: false, error: lastCreatorWriteError };
    }
}

async function readCreatorIndexForMutation(fileApi) {
    try { return await fileApi.readJsonFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator); }
    catch (error) {
        if (error?.status === 404 || /missing|not found|404/i.test(String(error?.message || ''))) return createSagaCreatorIndex();
        throw error;
    }
}

async function drainCoalescedCreatorProjectWrites() {
    const completed = [];
    while (coalescedCreatorProjectWriteRequests.size) {
        const requests = Array.from(coalescedCreatorProjectWriteRequests.values());
        coalescedCreatorProjectWriteRequests.clear();
        for (const request of requests) {
            const result = await writeCreatorProjectRequest(request);
            completed.push({ request, result });
        }
    }
    return completed;
}

function queueExternalLoredeckCreatorProjectWrite(payload = {}, index = hydratedCreatorIndex, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingCreatorWrite;
    const merged = resolveStorageOptions(options);
    const request = buildCreatorProjectWriteRequest(payload, index, merged);
    const completion = new Promise(resolve => { request.completeCallbacks = [resolve]; });
    const jobId = request.payloadWriteSnapshot?.jobId || '';
    if (merged.coalesceWrites === true && jobId && pendingCreatorWriteCount > 0) {
        const replaced = coalescedCreatorProjectWriteRequests.get(jobId);
        if (replaced) request.completeCallbacks.push(...replaced.completeCallbacks);
        coalescedCreatorProjectWriteRequests.set(jobId, request);
        return completion;
    }
    pendingCreatorWriteCount += 1;
    pendingCreatorWrite = pendingCreatorWrite
        .catch(() => {})
        .then(async () => {
            const completed = [];
            let result;
            try {
                result = await writeCreatorProjectRequest(request);
                completed.push({ request, result });
                completed.push(...await drainCoalescedCreatorProjectWrites());
            } catch (error) {
                recordQueuedWriteError(error, merged, request.attempt);
                result = { ok: false, persisted: false, error: lastCreatorWriteError };
                completed.push({ request, result });
            } finally {
                pendingCreatorWriteCount = Math.max(0, pendingCreatorWriteCount - 1);
            }
            for (const item of completed) for (const complete of item.request.completeCallbacks) complete(item.result);
            return result;
        });
    return completion;
}

function queueExternalLoredeckCreatorProjectDelete(jobId = '', projectFile = '', index = hydratedCreatorIndex, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingCreatorWrite;
    const merged = resolveStorageOptions(options);
    const id = normalizeJobId(jobId);
    const file = normalizeStoragePath(projectFile || '');
    const indexSnapshot = normalizeSagaCreatorIndex(index, merged);
    const attempt = creatorOutcomes.begin(id, 'delete_project', { jobId: id, projectFile: file, index: indexSnapshot });
    pendingCreatorWriteCount += 1;
    pendingCreatorWrite = pendingCreatorWrite
        .catch(() => {})
        .then(async () => {
            try {
                const fileApi = getFileApi(merged);
                await runSagaStorageTransaction(fileApi, {
                    domain: 'creator', ownerId: id, operation: 'delete_project', operationId: attempt.operationId, retryOf: attempt.retryOf,
                    paths: [SAGA_STORAGE_DOMAIN_INDEX_FILES.creator], request: attempt.request, gcPaths: file ? [file] : [],
                }, async () => {
                    const latest = removeCreatorIndexRecord(await readCreatorIndexForMutation(fileApi), id, merged);
                    return writeExternalLoredeckCreatorIndex(latest, merged);
                }, merged);
                creatorOutcomes.succeed(attempt);
                lastCreatorWriteError = creatorOutcomes.getError();
                return { ok: true, persisted: true, queued: false, pendingWrites: 0 };
            } catch (error) {
                recordQueuedWriteError(error, merged, attempt);
                return { ok: false, persisted: false, error: lastCreatorWriteError };
            } finally {
                pendingCreatorWriteCount = Math.max(0, pendingCreatorWriteCount - 1);
            }
        });
    return pendingCreatorWrite;
}

export function upsertExternalLoredeckCreatorProjectSync(jobRecord = {}, options = {}) {
    const requestedJobId = normalizeJobId(jobRecord?.jobId || jobRecord?.projectId || jobRecord?.id || '');
    const existing = requestedJobId ? (hydratedCreatorIndex.projects?.[requestedJobId] || {}) : {};
    const payload = setProjectPayloadCache({
        ...existing,
        ...jobRecord,
        projectFile: jobRecord?.projectFile || jobRecord?.payloadFile || existing.projectFile || existing.payloadFile || '',
        revision: Math.max(
            normalizeRevision(existing.revision, 1),
            normalizeRevision(jobRecord?.revision, 1),
        ),
    }, options);
    if (!payload?.jobId) return { ok: false, error: 'Deck Maker project must include a jobId/id.' };
    const index = updateCreatorIndexRecord(hydratedCreatorIndex, createExternalLoredeckCreatorIndexRecord(payload, options), options);
    const external = setHydratedCreatorIndex(index, options);
    const completion = queueExternalLoredeckCreatorProjectWrite(payload, external, options);
    return {
        ok: true,
        job: hydrateCachedExternalLoredeckCreatorProjectRecord(external.projects[payload.jobId]),
        queued: shouldPersistQueuedWrites(options),
        persisted: false,
        completion,
        project: external.projects[payload.jobId],
        payload,
        index: external,
        registry: getExternalLoredeckCreatorRegistry(),
    };
}

export function removeExternalLoredeckCreatorProjectSync(jobId = '', options = {}) {
    const id = normalizeJobId(jobId);
    if (!id) return { ok: false, error: 'Missing Deck Maker project id.' };
    const cached = getCachedExternalLoredeckCreatorProject(id);
    const existing = hydratedCreatorIndex.projects?.[id] || {};
    const projectFile = normalizeStoragePath(options.projectFile || cached?.projectFile || existing.projectFile || '');
    if (!cached && !existing.projectFile && !projectFile) {
        return { ok: false, notFound: true, error: 'Deck Maker project is not registered in external storage.' };
    }
    projectPayloadCache.delete(id);
    const index = removeCreatorIndexRecord(hydratedCreatorIndex, id, options);
    const external = setHydratedCreatorIndex(index, options);
    const completion = queueExternalLoredeckCreatorProjectDelete(id, projectFile, external, options);
    return {
        ok: true,
        projectFile,
        completion, queued: shouldPersistQueuedWrites(options), persisted: false,
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
    if (options.staleCheck !== false && options.expectedRevision !== undefined) {
        await assertCreatorIndexFresh(fileApi, Math.max(1, Math.floor(Number(options.expectedRevision) || 1)));
    }
    const result = await writeSagaStorageJsonFile(fileApi, getSagaUserFilesFileName(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator), normalized, {
        pretty: options.pretty,
        domain: 'creator', path: SAGA_STORAGE_DOMAIN_INDEX_FILES.creator,
        expectedRevision: options.expectedRevision,
    });
    const storageIndexStore = getStorageIndexStore(options);
    if (storageIndexStore?.registerFile) {
        assertSagaStorageWriteAcknowledged(await storageIndexStore.registerFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.creator, {
            kind: 'creator_index',
            domain: 'creator',
            ownerId: 'creator',
            mime: 'application/json',
            deletion: 'managed',
        }, options));
    }
    hydratedCreatorIndex = normalizeSagaCreatorIndex(normalized, { now });
    durableCreatorIndexRevision = hydratedCreatorIndex.revision;
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
        const recovered = await recoverSagaStorageTransactions(fileApi, resolveStorageOptions(options));
        creatorOutcomes.restore(recovered.filter(item => item.domain === 'creator'));
        lastCreatorWriteError = creatorOutcomes.getError();
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
        durableCreatorIndexRevision = hydratedCreatorIndex.revision;
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
            error: error?.message || String(error || 'Deck Maker project storage hydration failed.'),
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
        failures: creatorOutcomes.getFailures(),
        cachedProjectCount: projectPayloadCache.size,
    };
}

export async function flushSagaCreatorProjectStorageWrites() {
    await pendingCreatorWrite;
    return {
        ok: !lastCreatorWriteError,
        error: lastCreatorWriteError,
        failures: creatorOutcomes.getFailures(),
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
    coalescedCreatorProjectWriteRequests = new Map();
    lastCreatorWriteError = '';
    creatorOutcomes.reset();
    creatorRetryRevisions.clear();
    durableCreatorIndexRevision = 1;
}

export function getMostRecentExternalLoredeckCreatorProject(registry = getExternalLoredeckCreatorRegistry()) {
    return getMostRecentLoredeckCreatorJob(registry);
}

resetSagaCreatorProjectStorageCache();
