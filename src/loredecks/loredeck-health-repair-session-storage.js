/**
 * Storage-backed Loredeck Health repair session files.
 */

import {
    SAGA_STORAGE_JSON_EXTENSION,
    buildSagaJsonStorageFileName,
    getSagaUserFilesFileName,
    normalizeSagaStorageId,
    toSagaUserFilesPath,
} from '../storage/saga-storage-filenames.js';
import {
    createSagaFileApi,
} from '../storage/saga-file-api.js';
import {
    createSagaStorageIndexStore,
    getSagaStorageFilesForOwner,
} from '../storage/saga-storage-index.js';
import {
    cleanRepairId,
    cleanRepairString,
    cloneRepairJson,
    hashRepairText,
    isPlainRepairObject,
} from './loredeck-health-repair-contracts.js';

export const LOREDECK_HEALTH_REPAIR_SESSION_KIND = 'saga_loredeck_health_repair_session';
export const LOREDECK_HEALTH_REPAIR_SESSION_SCHEMA_VERSION = 1;
export const LOREDECK_HEALTH_REPAIR_SESSION_STORAGE_KIND = 'loredeck_health_repair_session';

const REPAIR_SESSION_STATUSES = Object.freeze([
    'active',
    'complete',
    'needs_review',
    'model_pending',
    'manual_remaining',
    'blocked',
]);

let repairSessionRuntimeOptions = {};

export function configureLoredeckHealthRepairSessionStorage(options = {}) {
    repairSessionRuntimeOptions = { ...repairSessionRuntimeOptions, ...(options || {}) };
}

function resolveRepairSessionStorageOptions(options = {}) {
    return { ...(repairSessionRuntimeOptions || {}), ...(options || {}) };
}

function nowValue(options = {}) {
    const merged = resolveRepairSessionStorageOptions(options);
    if (typeof merged.now === 'function') return Number(merged.now()) || Date.now();
    if (merged.now !== undefined) return Number(merged.now) || Date.now();
    return Date.now();
}

function getFileApi(options = {}) {
    const merged = resolveRepairSessionStorageOptions(options);
    return merged.fileApi || createSagaFileApi(merged.fileApiOptions || {});
}

function getStorageIndexStore(options = {}) {
    const merged = resolveRepairSessionStorageOptions(options);
    return merged.storageIndexStore || createSagaStorageIndexStore({
        fileApi: getFileApi(merged),
        now: merged.now,
    });
}

function normalizeSessionId(value = '', fallback = 'session') {
    return normalizeSagaStorageId(cleanRepairId(value || fallback, 96), fallback, 96);
}

function normalizePackId(value = '') {
    return normalizeSagaStorageId(cleanRepairId(value || 'pack', 160), 'pack', 160);
}

function normalizeTimestamp(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function normalizeStatus(value = '', fallback = 'active') {
    const text = cleanRepairId(value || fallback, 80);
    return REPAIR_SESSION_STATUSES.includes(text) ? text : fallback;
}

function inferSessionStatus(attempt = {}, remaining = {}, diagnostics = []) {
    const summary = isPlainRepairObject(attempt.summary) ? attempt.summary : {};
    const choiceCount = Number(remaining.choiceSetCount || remaining.choiceSets?.length || summary.choiceSetCount || 0) || 0;
    const modelCount = Number(remaining.modelUnits?.length || summary.totalModelUnitCount || summary.finalPlan?.modelUnitCount || 0) || 0;
    const deferredCount = Number(remaining.deferredUnits?.length || summary.deferredModelUnitCount || 0) || 0;
    const manualCount = Number(remaining.manualBuckets?.length || summary.finalPlan?.manualOnlyCount || 0) || 0;
    if (choiceCount > 0) return 'needs_review';
    if (modelCount + deferredCount > 0) return 'model_pending';
    if (manualCount > 0) return 'manual_remaining';
    if (diagnostics.length > 0 && summary.outcome === 'blocked') return 'blocked';
    if (summary.outcome === 'clean') return 'complete';
    if (summary.outcome && REPAIR_SESSION_STATUSES.includes(summary.outcome)) return summary.outcome;
    return diagnostics.length > 0 ? 'blocked' : 'active';
}

function normalizeDiagnostic(item = {}) {
    if (typeof item === 'string') {
        return {
            severity: 'info',
            code: '',
            message: cleanRepairString(item, 1000),
        };
    }
    const raw = isPlainRepairObject(item) ? item : {};
    return {
        severity: cleanRepairId(raw.severity || 'info', 40),
        code: cleanRepairId(raw.code || '', 120),
        message: cleanRepairString(raw.message || raw.error || '', 1000),
    };
}

function normalizeDiagnostics(value = []) {
    return (Array.isArray(value) ? value : [])
        .map(normalizeDiagnostic)
        .filter(item => item.message || item.code);
}

function compactModelRepairProgress(item = {}) {
    const raw = isPlainRepairObject(item) ? item : {};
    return {
        unitId: cleanRepairId(raw.unitId || '', 220),
        status: cleanRepairId(raw.status || 'queued', 80),
        code: cleanRepairId(raw.code || '', 120),
        strategy: cleanRepairId(raw.strategy || '', 80),
        inputHash: cleanRepairId(raw.inputHash || '', 80),
        startedAt: normalizeTimestamp(raw.startedAt, 0),
        completedAt: normalizeTimestamp(raw.completedAt, 0),
        failedAt: normalizeTimestamp(raw.failedAt, 0),
        updatedAt: normalizeTimestamp(raw.updatedAt, 0),
        attemptCount: Math.max(0, Math.round(Number(raw.attemptCount || raw.attempts) || 0)),
        appliedPatchIds: (Array.isArray(raw.appliedPatchIds) ? raw.appliedPatchIds : [])
            .map(id => cleanRepairId(id || '', 180))
            .filter(Boolean),
        choiceSetIds: (Array.isArray(raw.choiceSetIds) ? raw.choiceSetIds : [])
            .map(id => cleanRepairId(id || '', 180))
            .filter(Boolean),
        diagnosticCount: Math.max(0, Math.round(Number(raw.diagnosticCount) || 0)),
        warningCount: Math.max(0, Math.round(Number(raw.warningCount) || 0)),
        error: cleanRepairString(raw.error || '', 500),
    };
}

function compactRepairUnit(unit = {}) {
    const raw = isPlainRepairObject(unit) ? unit : {};
    return {
        unitId: cleanRepairId(raw.unitId || '', 220),
        stage: cleanRepairId(raw.stage || 'pack_health_repair', 80),
        strategy: cleanRepairId(raw.strategy || '', 80),
        code: cleanRepairId(raw.code || '', 120),
        bucketId: cleanRepairId(raw.bucketId || '', 180),
        findingIds: cloneRepairJson(raw.findingIds || []),
        entryIds: cloneRepairJson(raw.entryIds || []),
        tagIds: cloneRepairJson(raw.tagIds || []),
        timelineIds: cloneRepairJson(raw.timelineIds || []),
        inputHash: cleanRepairId(raw.inputHash || '', 80),
        label: cleanRepairString(raw.label || '', 240),
        deferred: raw.deferred === true,
        deferredIndex: Number(raw.deferredIndex) || 0,
    };
}

function compactRepairBucket(bucket = {}) {
    const raw = isPlainRepairObject(bucket) ? bucket : {};
    return {
        bucketId: cleanRepairId(raw.bucketId || '', 180),
        strategy: cleanRepairId(raw.strategy || '', 80),
        code: cleanRepairId(raw.code || '', 120),
        severity: cleanRepairId(raw.severity || '', 40),
        targetKind: cleanRepairId(raw.targetKind || '', 80),
        findingIds: cloneRepairJson(raw.findingIds || []),
        affectedEntryIds: cloneRepairJson(raw.affectedEntryIds || []),
        affectedTagIds: cloneRepairJson(raw.affectedTagIds || []),
        affectedTimelineIds: cloneRepairJson(raw.affectedTimelineIds || []),
        estimatedUnits: Number(raw.estimatedUnits) || 0,
        reason: cleanRepairString(raw.reason || '', 500),
    };
}

function normalizeRemainingRepairState(value = {}) {
    const raw = isPlainRepairObject(value) ? value : {};
    const choiceSets = (Array.isArray(raw.choiceSets) ? raw.choiceSets : []).map(choice => cloneRepairJson(choice));
    const modelUnits = (Array.isArray(raw.modelUnits) ? raw.modelUnits : []).map(compactRepairUnit).filter(unit => unit.unitId);
    const deferredUnits = (Array.isArray(raw.deferredUnits) ? raw.deferredUnits : []).map(compactRepairUnit).filter(unit => unit.unitId);
    const modelDirectBuckets = (Array.isArray(raw.modelDirectBuckets) ? raw.modelDirectBuckets : []).map(compactRepairBucket).filter(bucket => bucket.bucketId || bucket.code);
    const modelChoiceBuckets = (Array.isArray(raw.modelChoiceBuckets) ? raw.modelChoiceBuckets : []).map(compactRepairBucket).filter(bucket => bucket.bucketId || bucket.code);
    const manualBuckets = (Array.isArray(raw.manualBuckets) ? raw.manualBuckets : []).map(compactRepairBucket).filter(bucket => bucket.bucketId || bucket.code);
    const modelProgress = (Array.isArray(raw.modelProgress) ? raw.modelProgress : [])
        .map(compactModelRepairProgress)
        .filter(progress => progress.unitId);
    return {
        choiceSets,
        choiceSetCount: Number(raw.choiceSetCount || choiceSets.length) || choiceSets.length,
        modelUnits,
        deferredUnits,
        modelProgress,
        modelDirectBuckets,
        modelChoiceBuckets,
        manualBuckets,
    };
}

function getRepairSessionRemainingCounts(remaining = {}) {
    const raw = isPlainRepairObject(remaining) ? remaining : {};
    return {
        choiceSetCount: Number(raw.choiceSetCount || raw.choiceSets?.length) || 0,
        modelUnitCount: Number(raw.modelUnits?.length) || 0,
        deferredUnitCount: Number(raw.deferredUnits?.length) || 0,
        manualBucketCount: Number(raw.manualBuckets?.length) || 0,
    };
}

function getRepairSessionRemainingWorkCount(remaining = {}) {
    const counts = getRepairSessionRemainingCounts(remaining);
    return counts.choiceSetCount + counts.modelUnitCount + counts.deferredUnitCount + counts.manualBucketCount;
}

function getRepairSessionErrorDiagnosticCount(diagnostics = []) {
    return (Array.isArray(diagnostics) ? diagnostics : []).filter(item => {
        const severity = cleanRepairId(item?.severity || '', 40);
        return severity === 'error' || severity === 'danger';
    }).length;
}

export function buildLoredeckHealthRepairSessionLifecycle(session = {}) {
    const raw = isPlainRepairObject(session) ? session : {};
    const remaining = isPlainRepairObject(raw.remaining) ? raw.remaining : {};
    const diagnostics = Array.isArray(raw.diagnostics) ? raw.diagnostics : [];
    const status = cleanRepairId(raw.status || raw.outcome || 'active', 80);
    const counts = getRepairSessionRemainingCounts(remaining);
    const remainingWorkCount = getRepairSessionRemainingWorkCount(remaining);
    const diagnosticCount = diagnostics.length;
    const errorDiagnosticCount = getRepairSessionErrorDiagnosticCount(diagnostics);
    let retainReason = 'active';
    if (counts.choiceSetCount) retainReason = 'needs_review';
    else if (counts.modelUnitCount || counts.deferredUnitCount) retainReason = 'model_pending';
    else if (counts.manualBucketCount) retainReason = 'manual_remaining';
    else if (diagnosticCount) retainReason = 'diagnostics';
    else if (status === 'complete') retainReason = 'completed_summary';
    return {
        status,
        ...counts,
        remainingWorkCount,
        diagnosticCount,
        errorDiagnosticCount,
        appliedPatchCount: Array.isArray(raw.appliedPatchIds) ? raw.appliedPatchIds.length : 0,
        retainReason,
        hasRemainingWork: remainingWorkCount > 0,
        hasDiagnostics: diagnosticCount > 0,
        canAutoDelete: status === 'complete' && remainingWorkCount === 0 && diagnosticCount === 0,
        canUserDelete: true,
    };
}

function inferSessionId(input = {}, packId = '', now = Date.now()) {
    const explicit = input.sessionId || input.repairSessionId || input.attempt?.sessionId || input.attempt?.repairSessionId || '';
    if (explicit) return normalizeSessionId(explicit);
    const seed = [
        packId,
        now,
        input.attempt?.summary?.outcome || input.summary?.outcome || '',
        input.attempt?.summary?.finalHealth?.errorCount ?? input.summary?.finalHealth?.errorCount ?? '',
        input.attempt?.summary?.finalPlan?.totalModelUnitCount ?? input.summary?.finalPlan?.totalModelUnitCount ?? '',
    ].join('|');
    return normalizeSessionId(`session_${hashRepairText(seed)}`);
}

function getAttemptInput(input = {}) {
    if (isPlainRepairObject(input.attempt)) return input.attempt;
    return isPlainRepairObject(input) ? input : {};
}

export function buildLoredeckHealthRepairSessionFileName(packId = '', sessionId = '', options = {}) {
    const cleanPackId = normalizePackId(packId || options.packId || '');
    const cleanSessionId = normalizeSessionId(sessionId || options.sessionId || '');
    return buildSagaJsonStorageFileName('repair-session', `${cleanPackId}-${cleanSessionId}`, {
        idMaxLength: 128,
    });
}

export function buildLoredeckHealthRepairSessionPath(packId = '', sessionId = '', options = {}) {
    return toSagaUserFilesPath(buildLoredeckHealthRepairSessionFileName(packId, sessionId, options), {
        allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
    });
}

export function normalizeLoredeckHealthRepairSession(input = {}, options = {}) {
    const raw = isPlainRepairObject(input) ? input : {};
    const attempt = getAttemptInput(raw);
    const now = nowValue(options);
    const packId = normalizePackId(raw.packId || attempt.packId || attempt.pack?.packId || attempt.pack?.id || options.packId || '');
    const createdAt = normalizeTimestamp(raw.createdAt, now);
    const updatedAt = normalizeTimestamp(raw.updatedAt, now);
    const sessionId = inferSessionId(raw, packId, createdAt);
    const remaining = normalizeRemainingRepairState(raw.remaining || attempt.remaining || {});
    const diagnostics = normalizeDiagnostics(raw.diagnostics || attempt.diagnostics || []);
    const summary = cloneRepairJson(raw.summary || attempt.summary || {});
    const status = normalizeStatus(raw.status, inferSessionStatus(attempt, remaining, diagnostics));
    const sessionFile = raw.sessionFile || buildLoredeckHealthRepairSessionPath(packId, sessionId);
    const lifecycle = buildLoredeckHealthRepairSessionLifecycle({
        status,
        outcome: raw.outcome || summary.outcome || status,
        remaining,
        diagnostics,
        appliedPatchIds: raw.appliedPatchIds || attempt.appliedPatches?.map(patch => patch?.patchId) || [],
    });

    return {
        schemaVersion: LOREDECK_HEALTH_REPAIR_SESSION_SCHEMA_VERSION,
        kind: LOREDECK_HEALTH_REPAIR_SESSION_KIND,
        sessionId,
        packId,
        status,
        outcome: cleanRepairId(raw.outcome || summary.outcome || status, 80),
        createdAt,
        updatedAt,
        sessionFile,
        summary,
        remaining,
        diagnostics,
        appliedPatchIds: (Array.isArray(raw.appliedPatchIds) ? raw.appliedPatchIds : attempt.appliedPatches?.map(patch => patch?.patchId))
            ?.map(id => cleanRepairId(id || '', 180))
            .filter(Boolean) || [],
        lifecycle,
    };
}

export function createLoredeckHealthRepairSession(input = {}, options = {}) {
    return normalizeLoredeckHealthRepairSession(input, options);
}

export async function writeLoredeckHealthRepairSession(session = {}, options = {}) {
    try {
        const merged = resolveRepairSessionStorageOptions(options);
        const normalized = normalizeLoredeckHealthRepairSession(session, merged);
        const fileName = getSagaUserFilesFileName(normalized.sessionFile)
            || buildLoredeckHealthRepairSessionFileName(normalized.packId, normalized.sessionId);
        const fileApi = getFileApi(merged);
        const result = await fileApi.writeJsonFile(fileName, normalized, {
            pretty: merged.pretty,
            allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
        });
        const path = result.path || normalized.sessionFile;
        const stored = {
            ...normalized,
            sessionFile: path,
        };
        const storageIndexStore = getStorageIndexStore({
            ...merged,
            fileApi,
        });
        if (storageIndexStore?.registerFile) {
            await storageIndexStore.registerFile(path, {
                kind: LOREDECK_HEALTH_REPAIR_SESSION_STORAGE_KIND,
                domain: 'library',
                ownerId: stored.packId,
                mime: 'application/json',
                deletion: 'delete_with_owner',
            }, merged);
        }
        return {
            ok: true,
            path,
            session: stored,
        };
    } catch (error) {
        return {
            ok: false,
            error: error?.message || String(error || 'Repair session write failed.'),
            diagnostics: [normalizeDiagnostic({
                severity: 'error',
                code: 'repair_session_write_failed',
                message: error?.message || error || 'Repair session write failed.',
            })],
        };
    }
}

function resolveSessionPath(input = '', sessionId = '', options = {}) {
    if (isPlainRepairObject(input)) {
        if (input.sessionFile) return String(input.sessionFile || '');
        return buildLoredeckHealthRepairSessionPath(input.packId || options.packId || '', input.sessionId || options.sessionId || '');
    }
    const text = String(input || '').trim();
    if (text.startsWith('/user/files/')) return text;
    return buildLoredeckHealthRepairSessionPath(text || options.packId || '', sessionId || options.sessionId || '');
}

export async function readLoredeckHealthRepairSession(packIdOrPath = '', sessionIdOrOptions = '', maybeOptions = {}) {
    const options = resolveRepairSessionStorageOptions(isPlainRepairObject(sessionIdOrOptions) ? sessionIdOrOptions : maybeOptions);
    const sessionId = isPlainRepairObject(sessionIdOrOptions) ? options.sessionId || '' : sessionIdOrOptions;
    const path = resolveSessionPath(packIdOrPath, sessionId, options);
    try {
        const raw = await getFileApi(options).readJsonFile(path, {
            allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
        });
        return {
            ok: true,
            path,
            session: normalizeLoredeckHealthRepairSession({
                ...raw,
                sessionFile: path,
            }, options),
        };
    } catch (error) {
        return {
            ok: false,
            path,
            error: error?.message || String(error || 'Repair session read failed.'),
            diagnostics: [normalizeDiagnostic({
                severity: 'error',
                code: 'repair_session_read_failed',
                message: error?.message || error || 'Repair session read failed.',
            })],
        };
    }
}

export async function listLoredeckHealthRepairSessions(packId = '', options = {}) {
    const merged = resolveRepairSessionStorageOptions(options);
    const cleanPackId = normalizePackId(packId || merged.packId || '');
    if (!cleanPackId) {
        return {
            ok: false,
            packId: '',
            sessions: [],
            records: [],
            diagnostics: [normalizeDiagnostic({
                severity: 'error',
                code: 'repair_session_missing_pack_id',
                message: 'Repair session listing needs a Loredeck pack id.',
            })],
        };
    }
    try {
        const storageIndexStore = getStorageIndexStore(merged);
        const index = await storageIndexStore.readIndex({ allowMissing: true });
        const records = getSagaStorageFilesForOwner(index, cleanPackId, merged)
            .filter(record => record.kind === LOREDECK_HEALTH_REPAIR_SESSION_STORAGE_KIND)
            .sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0));
        const sessions = [];
        const diagnostics = [];
        for (const record of records) {
            const result = await readLoredeckHealthRepairSession(record.path, merged);
            if (result.ok && result.session?.packId === cleanPackId) {
                sessions.push(result.session);
            } else {
                diagnostics.push(...(result.diagnostics || [normalizeDiagnostic({
                    severity: 'warning',
                    code: 'repair_session_unreadable',
                    message: result.error || `Repair session could not be read: ${record.path}`,
                })]));
            }
        }
        return {
            ok: diagnostics.length === 0,
            packId: cleanPackId,
            sessions: sessions.sort((left, right) => (Number(right.updatedAt) || 0) - (Number(left.updatedAt) || 0)),
            records,
            diagnostics,
        };
    } catch (error) {
        return {
            ok: false,
            packId: cleanPackId,
            sessions: [],
            records: [],
            error: error?.message || String(error || 'Repair session listing failed.'),
            diagnostics: [normalizeDiagnostic({
                severity: 'error',
                code: 'repair_session_list_failed',
                message: error?.message || error || 'Repair session listing failed.',
            })],
        };
    }
}

function normalizeCleanupStatuses(value = []) {
    const input = Array.isArray(value) ? value : String(value || '').split(/[,;\s]+/);
    const statuses = input.map(item => normalizeStatus(item, '')).filter(Boolean);
    return statuses.length ? new Set(statuses) : new Set(['complete']);
}

function shouldCleanupRepairSession(session = {}, options = {}) {
    const statuses = normalizeCleanupStatuses(options.statuses || options.status || []);
    if (!statuses.has(session.status)) return false;
    const lifecycle = session.lifecycle || buildLoredeckHealthRepairSessionLifecycle(session);
    if (lifecycle.hasRemainingWork && options.includeRemainingWork !== true) return false;
    if (lifecycle.hasDiagnostics && options.includeDiagnosticSessions !== true) return false;
    return lifecycle.canUserDelete || options.includeRemainingWork === true || options.includeDiagnosticSessions === true;
}

export async function cleanupLoredeckHealthRepairSessions(packId = '', options = {}) {
    const listResult = await listLoredeckHealthRepairSessions(packId, options);
    const diagnostics = [...(listResult.diagnostics || [])];
    const sessions = (Array.isArray(listResult.sessions) ? listResult.sessions : [])
        .filter(session => shouldCleanupRepairSession(session, options));
    const deleted = [];
    for (const session of sessions) {
        const result = await deleteLoredeckHealthRepairSession(session, options);
        if (result.ok) {
            deleted.push({ sessionId: session.sessionId, path: result.path, status: session.status });
        } else {
            diagnostics.push(...(result.diagnostics || [normalizeDiagnostic({
                severity: 'error',
                code: 'repair_session_cleanup_delete_failed',
                message: result.error || 'Repair session cleanup failed.',
            })]));
        }
    }
    return {
        ok: diagnostics.length === 0,
        packId: listResult.packId || normalizePackId(packId || options.packId || ''),
        deleted,
        deletedCount: deleted.length,
        scannedCount: Array.isArray(listResult.sessions) ? listResult.sessions.length : 0,
        diagnostics,
        error: diagnostics.find(item => item.severity === 'error')?.message || '',
    };
}

export async function deleteLoredeckHealthRepairSession(sessionOrPackId = '', sessionIdOrOptions = '', maybeOptions = {}) {
    const options = resolveRepairSessionStorageOptions(isPlainRepairObject(sessionIdOrOptions) ? sessionIdOrOptions : maybeOptions);
    const sessionId = isPlainRepairObject(sessionIdOrOptions) ? options.sessionId || '' : sessionIdOrOptions;
    const path = resolveSessionPath(sessionOrPackId, sessionId, options);
    try {
        const fileApi = getFileApi(options);
        await fileApi.deleteFile(path, {
            allowedExtensions: [SAGA_STORAGE_JSON_EXTENSION],
        });
        const storageIndexStore = getStorageIndexStore({
            ...options,
            fileApi,
        });
        if (storageIndexStore?.unregisterFile) await storageIndexStore.unregisterFile(path, options);
        return {
            ok: true,
            path,
        };
    } catch (error) {
        return {
            ok: false,
            path,
            error: error?.message || String(error || 'Repair session delete failed.'),
            diagnostics: [normalizeDiagnostic({
                severity: 'error',
                code: 'repair_session_delete_failed',
                message: error?.message || error || 'Repair session delete failed.',
            })],
        };
    }
}
