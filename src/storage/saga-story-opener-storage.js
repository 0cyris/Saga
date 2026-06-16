/**
 * External Story Maker session storage.
 */

import {
    createStoryOpenerSessionId,
    normalizeStoryOpenerControls,
    normalizeStoryOpenerId,
    normalizeStoryOpenerSession,
    normalizeStoryOpenerString,
    STORY_OPENER_INDEX_KIND,
    STORY_OPENER_SESSION_KIND,
} from '../story-openers/story-opener-state.js';
import { createSagaDomainStorage, buildSagaDomainPayloadPath } from './saga-domain-storage.js';
import { createSagaFileApi } from './saga-file-api.js';
import { createSagaStorageIndexStore, SAGA_STORAGE_DOMAIN_INDEX_FILES } from './saga-storage-index.js';
import {
    assertSagaUserFilesPath,
    getSagaUserFilesFileName,
    SAGA_STORAGE_JSON_EXTENSION,
} from './saga-storage-filenames.js';
import { assertSagaStorageRevisionFresh } from './saga-storage-stale-write.js';

const STORY_OPENER_STORAGE_DOMAIN = 'storyOpeners';
const STORY_OPENER_INDEX_RECORD_KIND = 'story_opener_index';
const STORY_OPENER_PAYLOAD_RECORD_KIND = 'story_opener_session_payload';

let openerRuntimeOptions = {};
let hydratedOpenerIndex = createSagaStoryOpenerIndex({ now: 0 });
let openerPayloadCache = new Map();
let hydrationStatus = {
    loaded: false,
    loading: false,
    loadedAt: 0,
    error: '',
};
let hydrationPromise = null;
let pendingOpenerWrite = Promise.resolve();
let pendingOpenerWriteCount = 0;
let lastOpenerWriteError = '';

export function configureSagaStoryOpenerStorage(options = {}) {
    openerRuntimeOptions = { ...openerRuntimeOptions, ...(options || {}) };
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

function normalizeExpectedRevision(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return 0;
    return Math.floor(numeric);
}

function resolveStorageOptions(options = {}) {
    return { ...(openerRuntimeOptions || {}), ...(options || {}) };
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

function sortObjectByKey(value = {}) {
    return Object.fromEntries(Object.entries(value || {}).sort(([left], [right]) => left.localeCompare(right)));
}

function shouldPersistQueuedWrites(options = {}) {
    const merged = resolveStorageOptions(options);
    if (merged.persistWrites === false || merged.persist === false) return false;
    if (merged.fileApi || merged.domainStorage || merged.storageIndexStore) return true;
    return typeof window !== 'undefined' && typeof fetch === 'function';
}

function recordQueuedWriteError(error = {}, options = {}) {
    const merged = resolveStorageOptions(options);
    lastOpenerWriteError = String(error?.message || error || 'Story Maker external storage write failed.');
    if (typeof merged.onWriteError === 'function') {
        merged.onWriteError(error);
        return;
    }
    console.warn('[Saga] Story Maker external storage write failed:', error);
}

function getSessionTitle(session = {}) {
    const controls = normalizeStoryOpenerControls(session.controls || session);
    return normalizeStoryOpenerString(
        session.title
        || controls.context
        || controls.userPrompt
        || 'Untitled opener',
        240,
    ) || 'Untitled opener';
}

function normalizeStoryOpenerIndexRecord(value = {}, fallbackId = '', options = {}) {
    const raw = isPlainObject(value) ? cloneJson(value) : {};
    const sessionId = normalizeStoryOpenerId(raw.sessionId || raw.id || fallbackId, '');
    if (!sessionId) return null;
    const now = getClockNow(options);
    const session = normalizeStoryOpenerSession({
        ...raw,
        sessionId,
        title: raw.title || '',
        payloadFile: raw.payloadFile || raw.sessionFile || '',
    }, { now });
    const sessionFile = normalizeStoragePath(raw.sessionFile || raw.payloadFile || session.sessionFile || '')
        || buildSagaDomainPayloadPath(STORY_OPENER_STORAGE_DOMAIN, session.sessionId);
    const variantCount = session.variants.length || Math.max(0, Math.floor(Number(raw.variantCount) || 0));
    const revisionCount = session.revisionHistory.length || Math.max(0, Math.floor(Number(raw.revisionCount) || 0));
    return {
        schemaVersion: 1,
        sessionId: session.sessionId,
        id: session.sessionId,
        title: getSessionTitle(session),
        status: session.status,
        currentStage: session.currentStage,
        sourceStatus: session.lastSourceResolution?.status || raw.sourceStatus || 'missing',
        sourceMode: session.sourceIntent?.sourceMode || raw.sourceMode || 'loredeck_only',
        sourceSummary: normalizeStoryOpenerString(raw.sourceSummary || buildSourceSummary(session), 300),
        variantCount,
        revisionCount,
        sessionFile,
        payloadFile: sessionFile,
        createdAt: normalizeTimestamp(session.createdAt, now),
        updatedAt: normalizeTimestamp(session.updatedAt, now),
    };
}

function buildSourceSummary(session = {}) {
    const fandoms = Array.isArray(session.sourceIntent?.fandoms) ? session.sourceIntent.fandoms.filter(Boolean) : [];
    if (fandoms.length) return fandoms.join(', ');
    const packs = Array.isArray(session.sourceIntent?.packIds) ? session.sourceIntent.packIds.filter(Boolean) : [];
    if (packs.length) return `${packs.length} Loredeck${packs.length === 1 ? '' : 's'}`;
    return session.sourceIntent?.sourceMode === 'chat_enriched' ? 'Chat + Loredecks' : 'Loredecks';
}

export function createSagaStoryOpenerIndex(options = {}) {
    const now = getClockNow(options);
    return {
        schemaVersion: 1,
        kind: STORY_OPENER_INDEX_KIND,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        activeSessionId: '',
        lastSessionId: '',
        sessions: {},
    };
}

export function normalizeSagaStoryOpenerIndex(value = {}, options = {}) {
    const raw = isPlainObject(value) ? value : {};
    const createdAt = normalizeTimestamp(raw.createdAt, options.now || 0);
    const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt);
    const sourceSessions = isPlainObject(raw.sessions) ? raw.sessions : {};
    const sessions = {};
    for (const [sessionId, record] of Object.entries(sourceSessions)) {
        const normalized = normalizeStoryOpenerIndexRecord(record, sessionId, { ...options, now: updatedAt || options.now || 0 });
        if (normalized) sessions[normalized.sessionId] = normalized;
    }
    const recent = Object.values(sessions).sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0))[0] || null;
    const requestedActive = normalizeStoryOpenerId(raw.activeSessionId || raw.activeProjectId || '', '');
    const requestedLast = normalizeStoryOpenerId(raw.lastSessionId || raw.lastProjectId || '', '');
    const activeSessionId = sessions[requestedActive] ? requestedActive : (recent?.sessionId || '');
    const lastSessionId = sessions[requestedLast] ? requestedLast : activeSessionId;
    return {
        schemaVersion: 1,
        kind: STORY_OPENER_INDEX_KIND,
        createdAt,
        updatedAt,
        revision: normalizeRevision(raw.revision, 1),
        activeSessionId,
        lastSessionId,
        sessions: sortObjectByKey(sessions),
    };
}

function setHydratedOpenerIndex(index = {}, options = {}) {
    const now = getClockNow(options);
    hydratedOpenerIndex = normalizeSagaStoryOpenerIndex(index, { now });
    hydrationStatus = {
        loaded: true,
        loading: false,
        loadedAt: now,
        error: '',
    };
    return getExternalStoryOpenerIndex();
}

export function getExternalStoryOpenerIndex() {
    return cloneJson(normalizeSagaStoryOpenerIndex(hydratedOpenerIndex));
}

export function getStoryOpenerStorageStatus() {
    return {
        ...hydrationStatus,
        pendingWriteCount: pendingOpenerWriteCount,
        lastWriteError: lastOpenerWriteError,
    };
}

function setOpenerPayloadCache(payload = {}, options = {}) {
    const normalized = normalizeExternalStoryOpenerSessionPayload(payload, options);
    if (!normalized.sessionId) return null;
    openerPayloadCache.set(normalized.sessionId, normalized);
    return cloneJson(normalized);
}

export function getCachedExternalStoryOpenerSession(sessionId = '') {
    const id = normalizeStoryOpenerId(sessionId, '');
    return id && openerPayloadCache.has(id) ? cloneJson(openerPayloadCache.get(id)) : null;
}

export function normalizeExternalStoryOpenerSessionPayload(value = {}, options = {}) {
    const input = isPlainObject(value) ? cloneJson(value) : {};
    const cachedId = normalizeStoryOpenerId(input.sessionId || input.id || '', '');
    const cached = cachedId && openerPayloadCache.has(cachedId) ? openerPayloadCache.get(cachedId) : null;
    const raw = {
        ...(isPlainObject(cached) ? cloneJson(cached) : {}),
        ...input,
    };
    const now = getClockNow(options);
    const session = normalizeStoryOpenerSession({
        ...raw,
        sessionId: raw.sessionId || raw.id || createStoryOpenerSessionId(raw.title || raw.controls?.userPrompt || ''),
    }, { now });
    const sessionFile = normalizeStoragePath(raw.sessionFile || raw.payloadFile || session.sessionFile || '')
        || normalizeStoragePath(cached?.sessionFile || cached?.payloadFile || '')
        || buildSagaDomainPayloadPath(STORY_OPENER_STORAGE_DOMAIN, session.sessionId);
    const revision = Math.max(
        normalizeRevision(raw.revision, 1),
        normalizeRevision(cached?.revision, 1),
    );
    return {
        ...session,
        schemaVersion: 1,
        kind: STORY_OPENER_SESSION_KIND,
        revision,
        sessionFile,
        payloadFile: sessionFile,
        createdAt: normalizeTimestamp(session.createdAt, now),
        updatedAt: normalizeTimestamp(session.updatedAt, now),
    };
}

export function createExternalStoryOpenerIndexRecord(payload = {}, options = {}) {
    return normalizeStoryOpenerIndexRecord(normalizeExternalStoryOpenerSessionPayload(payload, options), '', options);
}

export async function hydrateExternalStoryOpenerSessionRecord(record = {}, options = {}) {
    const sessionId = normalizeStoryOpenerId(record?.sessionId || record?.id || '', '');
    if (!sessionId) return isPlainObject(record) ? cloneJson(record) : null;
    if (openerPayloadCache.has(sessionId)) return getCachedExternalStoryOpenerSession(sessionId);
    const sessionFile = normalizeStoragePath(record.sessionFile || record.payloadFile || '');
    if (!sessionFile) return normalizeExternalStoryOpenerSessionPayload(record, options);
    const raw = await getFileApi(options).readJsonFile(sessionFile, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    return setOpenerPayloadCache({
        ...raw,
        sessionId: raw?.sessionId || sessionId,
        sessionFile,
    }, options);
}

async function assertStoryOpenerPayloadFresh(fileApi, payload = {}, expectedRevision = 0) {
    if (!expectedRevision) return true;
    const sessionFile = normalizeStoragePath(payload.sessionFile || payload.payloadFile || '');
    if (!sessionFile) return true;
    let latest = null;
    try {
        latest = await fileApi.readJsonFile(sessionFile, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    } catch (error) {
        if (!(error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) throw error;
        latest = { revision: 1 };
    }
    assertSagaStorageRevisionFresh({
        latest,
        expectedRevision,
        domain: 'story opener',
        path: sessionFile,
        message: 'Story Maker session storage changed. Reload this opener before continuing.',
    });
    return true;
}

async function assertStoryOpenerIndexFresh(fileApi, expectedRevision = 0) {
    if (!expectedRevision) return true;
    let latest = null;
    try {
        latest = await fileApi.readJsonFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
    } catch (error) {
        if (!(error?.status === 404 || /missing|not found|404/i.test(String(error?.message || '')))) throw error;
        return true;
    }
    assertSagaStorageRevisionFresh({
        latest,
        expectedRevision,
        domain: 'story opener',
        path: SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners,
        message: 'Story Maker session index changed. Reload opener sessions before continuing.',
    });
    return true;
}

function updateOpenerIndexRecord(index = {}, record = {}, options = {}) {
    const now = getClockNow(options);
    const current = normalizeSagaStoryOpenerIndex(index, { now });
    const compact = normalizeStoryOpenerIndexRecord(record, '', { now });
    if (!compact) return current;
    const existing = current.sessions[compact.sessionId] || {};
    current.sessions[compact.sessionId] = {
        ...existing,
        ...compact,
        createdAt: existing.createdAt || compact.createdAt || now,
        updatedAt: compact.updatedAt || now,
    };
    current.sessions = sortObjectByKey(current.sessions);
    if (options.activeSessionId !== undefined || options.activate === true) {
        const active = normalizeStoryOpenerId(options.activeSessionId || compact.sessionId, '');
        current.activeSessionId = current.sessions[active] ? active : current.activeSessionId;
    }
    if (options.lastSessionId !== undefined || options.activate === true) {
        const last = normalizeStoryOpenerId(options.lastSessionId || compact.sessionId, '');
        current.lastSessionId = current.sessions[last] ? last : current.lastSessionId;
    }
    if (!current.activeSessionId || !current.sessions[current.activeSessionId]) current.activeSessionId = compact.sessionId;
    if (!current.lastSessionId || !current.sessions[current.lastSessionId]) current.lastSessionId = current.activeSessionId;
    current.updatedAt = now;
    if (options.bumpRevision !== false) current.revision = normalizeRevision(current.revision + 1, 2);
    return normalizeSagaStoryOpenerIndex(current, { now });
}

function removeOpenerIndexRecord(index = {}, sessionId = '', options = {}) {
    const now = getClockNow(options);
    const current = normalizeSagaStoryOpenerIndex(index, { now });
    const id = normalizeStoryOpenerId(sessionId, '');
    if (!id || !current.sessions[id]) return current;
    delete current.sessions[id];
    const recent = Object.values(current.sessions)
        .sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0))[0] || null;
    if (current.activeSessionId === id) current.activeSessionId = recent?.sessionId || '';
    if (current.lastSessionId === id) current.lastSessionId = current.activeSessionId;
    if (!current.sessions[current.activeSessionId]) current.activeSessionId = recent?.sessionId || '';
    if (!current.sessions[current.lastSessionId]) current.lastSessionId = current.activeSessionId;
    current.updatedAt = now;
    if (options.bumpRevision !== false) current.revision = normalizeRevision(current.revision + 1, 2);
    return normalizeSagaStoryOpenerIndex(current, { now });
}

function queueExternalStoryOpenerSessionWrite(payload = {}, index = hydratedOpenerIndex, expectations = {}, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingOpenerWrite;
    const merged = resolveStorageOptions(options);
    const payloadWriteSnapshot = normalizeExternalStoryOpenerSessionPayload(payload, merged);
    const indexSnapshot = normalizeSagaStoryOpenerIndex(index, merged);
    const expectedPayloadRevision = normalizeExpectedRevision(expectations.expectedPayloadRevision);
    const expectedIndexRevision = normalizeExpectedRevision(expectations.expectedIndexRevision);
    pendingOpenerWriteCount += 1;
    pendingOpenerWrite = pendingOpenerWrite
        .catch(() => {})
        .then(async () => {
            try {
                const domainStorage = getDomainStorage(merged);
                const fileApi = getFileApi(merged);
                await assertStoryOpenerPayloadFresh(fileApi, payloadWriteSnapshot, expectedPayloadRevision);
                await assertStoryOpenerIndexFresh(fileApi, expectedIndexRevision);
                await domainStorage.writePayload(STORY_OPENER_STORAGE_DOMAIN, payloadWriteSnapshot.sessionId, payloadWriteSnapshot, {
                    ...merged,
                    staleCheck: !!expectedPayloadRevision,
                    expectedRevision: expectedPayloadRevision,
                    kind: STORY_OPENER_PAYLOAD_RECORD_KIND,
                    deletion: 'delete_with_owner',
                });
                setOpenerPayloadCache(payloadWriteSnapshot, merged);
                await writeExternalStoryOpenerIndex(indexSnapshot, {
                    ...merged,
                    staleCheck: !!expectedIndexRevision,
                    expectedRevision: expectedIndexRevision,
                });
                lastOpenerWriteError = '';
            } catch (error) {
                recordQueuedWriteError(error, merged);
            } finally {
                pendingOpenerWriteCount = Math.max(0, pendingOpenerWriteCount - 1);
            }
        });
    return pendingOpenerWrite;
}

function queueExternalStoryOpenerSessionDelete(sessionId = '', sessionFile = '', index = hydratedOpenerIndex, options = {}) {
    if (!shouldPersistQueuedWrites(options)) return pendingOpenerWrite;
    const merged = resolveStorageOptions(options);
    const id = normalizeStoryOpenerId(sessionId, '');
    const file = normalizeStoragePath(sessionFile || '');
    const indexSnapshot = normalizeSagaStoryOpenerIndex(index, merged);
    pendingOpenerWriteCount += 1;
    pendingOpenerWrite = pendingOpenerWrite
        .catch(() => {})
        .then(async () => {
            try {
                const fileApi = getFileApi(merged);
                const storageIndexStore = getStorageIndexStore(merged);
                if (file) {
                    await fileApi.deleteFile(file, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
                    if (storageIndexStore?.unregisterFile) await storageIndexStore.unregisterFile(file, merged);
                }
                await writeExternalStoryOpenerIndex(indexSnapshot, merged);
                lastOpenerWriteError = '';
            } catch (error) {
                recordQueuedWriteError(error, merged);
            } finally {
                pendingOpenerWriteCount = Math.max(0, pendingOpenerWriteCount - 1);
            }
        });
    return pendingOpenerWrite;
}

export function upsertExternalStoryOpenerSessionSync(sessionRecord = {}, options = {}) {
    const id = normalizeStoryOpenerId(sessionRecord.sessionId || sessionRecord.id || '', '');
    const existing = id ? (getCachedExternalStoryOpenerSession(id) || null) : null;
    const previousIndex = getExternalStoryOpenerIndex();
    const now = getClockNow(options);
    const baseRevision = existing ? normalizeRevision(existing.revision, 1) : normalizeRevision(sessionRecord.revision, 1);
    const payload = setOpenerPayloadCache({
        ...(existing || {}),
        ...(sessionRecord || {}),
        revision: existing ? normalizeRevision(baseRevision + 1, 2) : baseRevision,
        updatedAt: now,
    }, options);
    if (!payload?.sessionId) return { ok: false, error: 'Story Maker session must include a sessionId/id.' };
    const index = updateOpenerIndexRecord(hydratedOpenerIndex, createExternalStoryOpenerIndexRecord(payload, options), options);
    const external = setHydratedOpenerIndex(index, options);
    queueExternalStoryOpenerSessionWrite(payload, external, {
        expectedPayloadRevision: existing?.revision || 0,
        expectedIndexRevision: previousIndex.revision || 0,
    }, options);
    return {
        ok: true,
        session: getCachedExternalStoryOpenerSession(payload.sessionId),
        record: external.sessions[payload.sessionId],
        payload,
        index: external,
    };
}

export function removeExternalStoryOpenerSessionSync(sessionId = '', options = {}) {
    const id = normalizeStoryOpenerId(sessionId, '');
    if (!id) return { ok: false, error: 'Missing Story Maker session id.' };
    const cached = getCachedExternalStoryOpenerSession(id);
    const existing = hydratedOpenerIndex.sessions?.[id] || {};
    const sessionFile = normalizeStoragePath(options.sessionFile || cached?.sessionFile || existing.sessionFile || existing.payloadFile || '');
    if (!cached && !existing.sessionFile && !sessionFile) {
        return { ok: false, notFound: true, error: 'Story Maker session is not registered in external storage.' };
    }
    openerPayloadCache.delete(id);
    const index = removeOpenerIndexRecord(hydratedOpenerIndex, id, options);
    const external = setHydratedOpenerIndex(index, options);
    queueExternalStoryOpenerSessionDelete(id, sessionFile, external, options);
    return {
        ok: true,
        sessionFile,
        index: external,
    };
}

export async function writeExternalStoryOpenerIndex(index = {}, options = {}) {
    const now = getClockNow(options);
    const normalized = normalizeSagaStoryOpenerIndex({
        ...index,
        updatedAt: now,
    }, { now });
    const fileApi = getFileApi(options);
    if (options.staleCheck !== false && options.expectedRevision !== undefined) {
        await assertStoryOpenerIndexFresh(fileApi, Math.max(1, Math.floor(Number(options.expectedRevision) || 1)));
    }
    const result = await fileApi.writeJsonFile(getSagaUserFilesFileName(SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners), normalized, {
        pretty: options.pretty,
    });
    const storageIndexStore = getStorageIndexStore(options);
    if (storageIndexStore?.registerFile) {
        await storageIndexStore.registerFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners, {
            kind: STORY_OPENER_INDEX_RECORD_KIND,
            domain: STORY_OPENER_STORAGE_DOMAIN,
            ownerId: STORY_OPENER_STORAGE_DOMAIN,
            mime: 'application/json',
            deletion: 'managed',
        }, options);
    }
    hydratedOpenerIndex = normalizeSagaStoryOpenerIndex(normalized, { now });
    return {
        ...result,
        ok: true,
        path: SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners,
        index: getExternalStoryOpenerIndex(),
    };
}

export async function hydrateSagaStoryOpenerStorage(options = {}) {
    if (hydrationPromise && options.force !== true) return hydrationPromise;
    hydrationStatus = { ...hydrationStatus, loading: true, error: '' };
    hydrationPromise = (async () => {
        const fileApi = getFileApi(options);
        let index;
        try {
            index = await fileApi.readJsonFile(SAGA_STORAGE_DOMAIN_INDEX_FILES.storyOpeners, { allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION] });
        } catch (error) {
            if (error?.status === 404 || /missing|not found|404/i.test(String(error?.message || ''))) {
                index = createSagaStoryOpenerIndex({ now: getClockNow(options) });
            } else {
                throw error;
            }
        }
        hydratedOpenerIndex = normalizeSagaStoryOpenerIndex(index, { now: getClockNow(options) });
        hydrationStatus = {
            loaded: true,
            loading: false,
            loadedAt: getClockNow(options),
            error: '',
        };
        return { ok: true, index: getExternalStoryOpenerIndex() };
    })().catch(error => {
        hydrationStatus = {
            loaded: false,
            loading: false,
            loadedAt: 0,
            error: error?.message || String(error || 'Story Maker storage hydration failed.'),
        };
        hydrationPromise = null;
        throw error;
    });
    return hydrationPromise;
}

export async function flushSagaStoryOpenerStorageWrites() {
    try {
        await pendingOpenerWrite;
        return { ok: !lastOpenerWriteError, error: lastOpenerWriteError };
    } catch (error) {
        const message = error?.message || String(error || 'Story Maker storage write failed.');
        return { ok: false, error: message };
    }
}

export function resetSagaStoryOpenerStorageCache() {
    hydratedOpenerIndex = createSagaStoryOpenerIndex({ now: 0 });
    openerPayloadCache = new Map();
    hydrationStatus = {
        loaded: false,
        loading: false,
        loadedAt: 0,
        error: '',
    };
    hydrationPromise = null;
    pendingOpenerWrite = Promise.resolve();
    pendingOpenerWriteCount = 0;
    lastOpenerWriteError = '';
}

resetSagaStoryOpenerStorageCache();
