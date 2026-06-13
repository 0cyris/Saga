/**
 * Storage-backed Pack Health repair adapter.
 */

import {
    buildLoredeckHealthForData,
} from './loredeck-health-engine.js';
import {
    buildLoredeckHealthRepairPlan,
} from './loredeck-health-fix-planner.js';
import {
    LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
    cloneRepairJson,
    createRepairRunSummary,
    isPlainRepairObject,
    normalizeRepairPatch,
} from './loredeck-health-repair-contracts.js';
import {
    validateLoredeckRepairPatch,
} from './loredeck-health-repair-validator.js';
import {
    getExternalLoredeckLibraryRegistry,
    hydrateSagaLorepackLibraryStorage,
    upsertExternalLoredeckLibraryRecordSync,
} from '../storage/saga-lorepack-library-storage.js';
import {
    createExternalLorepackLibraryRecord,
    hydrateExternalLorepackPayloadRecord,
    upsertExternalLorepackPayloadSync,
} from '../storage/saga-lorepack-payload-storage.js';

function cleanAdapterString(value = '', maxLength = 500) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function nowValue(options = {}) {
    if (typeof options.now === 'function') return Number(options.now()) || Date.now();
    if (options.now !== undefined) return Number(options.now) || Date.now();
    return Date.now();
}

function getPackId(value = '') {
    return cleanAdapterString(value, 180);
}

function getPackEntryFiles(pack = {}) {
    if (Array.isArray(pack.entryFiles)) return cloneRepairJson(pack.entryFiles);
    const entries = Array.isArray(pack.entries)
        ? pack.entries
        : Object.values(isPlainRepairObject(pack.entryOverrides) ? pack.entryOverrides : {});
    return [{
        file: '__saga_external_payload_entries__',
        schemaVersion: Number(pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 3,
        entries: cloneRepairJson(entries),
    }];
}

function normalizeStorageDiagnostic(error = {}, fallback = 'Pack Health repair storage operation failed.') {
    return {
        severity: 'error',
        code: cleanAdapterString(error?.code || 'repair_storage_error', 120),
        message: cleanAdapterString(error?.message || error || fallback, 1000),
    };
}

function createPatchValidationContext(plan = {}, patch = {}) {
    const normalizedPatch = normalizeRepairPatch(patch);
    const wantedFindingIds = new Set(normalizedPatch.findingIds || []);
    const findings = wantedFindingIds.size
        ? (Array.isArray(plan.findings) ? plan.findings : []).filter(finding => wantedFindingIds.has(finding.findingId))
        : (Array.isArray(plan.findings) ? plan.findings : []);
    const selectedFindingIds = new Set(findings.map(finding => finding.findingId).filter(Boolean));
    const buckets = selectedFindingIds.size
        ? (Array.isArray(plan.buckets) ? plan.buckets : []).filter(bucket => (bucket.findingIds || []).some(id => selectedFindingIds.has(id)))
        : (Array.isArray(plan.buckets) ? plan.buckets : []);
    return { findings, buckets };
}

function upsertEntryOnPayload(pack = {}, entryId = '', entry = {}) {
    const nextEntry = {
        ...cloneRepairJson(entry),
        id: entry.id || entryId,
    };
    const id = nextEntry.id || entryId;
    let updated = false;

    if (isPlainRepairObject(pack.entryOverrides) && Object.hasOwn(pack.entryOverrides, id)) {
        pack.entryOverrides[id] = nextEntry;
        updated = true;
    }

    if (Array.isArray(pack.entries)) {
        const index = pack.entries.findIndex(item => item?.id === id);
        if (index >= 0) {
            pack.entries[index] = nextEntry;
            updated = true;
        }
    }

    for (const file of Array.isArray(pack.entryFiles) ? pack.entryFiles : []) {
        if (!Array.isArray(file.entries)) continue;
        const index = file.entries.findIndex(item => item?.id === id);
        if (index >= 0) {
            file.entries[index] = nextEntry;
            updated = true;
        }
    }

    if (!updated) {
        if (!isPlainRepairObject(pack.entryOverrides)) pack.entryOverrides = {};
        pack.entryOverrides[id] = nextEntry;
    }
}

function upsertTimelineItem(list = [], item = {}, id = '') {
    const nextItem = {
        ...cloneRepairJson(item),
        id: item.id || id,
    };
    const cleanId = nextItem.id || id;
    const index = list.findIndex(row => row?.id === cleanId);
    if (index >= 0) list[index] = nextItem;
    else list.push(nextItem);
}

function applyRepairOperationToPayload(pack = {}, operation = {}) {
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE) {
        if (operation.entry?.id || operation.entryId) upsertEntryOnPayload(pack, operation.entryId || operation.entry.id, operation.entry);
        return;
    }
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TAG_DEFINITION) {
        if (!isPlainRepairObject(pack.tagRegistry)) pack.tagRegistry = { schemaVersion: 1, tags: {} };
        if (!isPlainRepairObject(pack.tagRegistry.tags)) pack.tagRegistry.tags = {};
        pack.tagRegistry.tags[operation.tagId] = cloneRepairJson(operation.tagDefinition) || {};
        return;
    }
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_ANCHOR) {
        if (!isPlainRepairObject(pack.timelineRegistry)) pack.timelineRegistry = { schemaVersion: 1, anchors: [], windows: [] };
        if (!Array.isArray(pack.timelineRegistry.anchors)) pack.timelineRegistry.anchors = [];
        upsertTimelineItem(pack.timelineRegistry.anchors, operation.timelineAnchor, operation.timelineId || operation.timelineAnchor?.id);
        return;
    }
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TIMELINE_WINDOW) {
        if (!isPlainRepairObject(pack.timelineRegistry)) pack.timelineRegistry = { schemaVersion: 1, anchors: [], windows: [] };
        if (!Array.isArray(pack.timelineRegistry.windows)) pack.timelineRegistry.windows = [];
        upsertTimelineItem(pack.timelineRegistry.windows, operation.timelineWindow, operation.timelineId || operation.timelineWindow?.id);
        return;
    }
    if (operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS) {
        const stats = cloneRepairJson(operation.stats) || {};
        pack.stats = stats;
        if (!isPlainRepairObject(pack.manifestData)) pack.manifestData = {};
        pack.manifestData.stats = cloneRepairJson(stats);
    }
}

function applyPatchToPayload(pack = {}, patch = {}) {
    const next = cloneRepairJson(pack) || {};
    const normalizedPatch = normalizeRepairPatch(patch);
    for (const operation of normalizedPatch.operations) {
        applyRepairOperationToPayload(next, operation);
    }
    next.localModified = true;
    return next;
}

function applyHealthSummaryToPayload(pack = {}, health = {}, options = {}) {
    const next = cloneRepairJson(pack) || {};
    const summary = isPlainRepairObject(health.summary) ? health.summary : {};
    const categoryCounts = isPlainRepairObject(summary.categoryCounts) ? cloneRepairJson(summary.categoryCounts) : {};
    next.healthStatus = health.status || next.healthStatus || '';
    next.stats = {
        ...(isPlainRepairObject(next.stats) ? next.stats : {}),
        entryCount: Math.max(0, Math.round(Number(summary.entryCount) || 0)),
        categoryCounts,
    };
    next.updatedAt = nowValue(options);
    if (isPlainRepairObject(next.manifestData)) {
        next.manifestData = {
            ...next.manifestData,
            stats: {
                ...(isPlainRepairObject(next.manifestData.stats) ? next.manifestData.stats : {}),
                entryCount: next.stats.entryCount,
                categoryCounts: cloneRepairJson(categoryCounts),
            },
        };
    }
    return next;
}

function persistRepairPayload(pack = {}, options = {}) {
    const payloadResult = upsertExternalLorepackPayloadSync(pack, options);
    if (!payloadResult.ok) return payloadResult;
    const libraryRecord = createExternalLorepackLibraryRecord(payloadResult.payload, options);
    const libraryResult = upsertExternalLoredeckLibraryRecordSync(libraryRecord, options);
    if (!libraryResult.ok) return libraryResult;
    return {
        ok: true,
        pack: payloadResult.payload,
        libraryRecord,
        library: libraryResult.library,
    };
}

export async function loadPackPayload(packId = '', options = {}) {
    const id = getPackId(packId);
    if (!id) return { ok: false, error: 'Missing Lorepack id.', diagnostics: [normalizeStorageDiagnostic({ code: 'repair_missing_pack_id', message: 'Missing Lorepack id.' })] };
    if (options.hydrateLibrary !== false) {
        await hydrateSagaLorepackLibraryStorage({ ...options, force: options.forceHydrateLibrary === true });
    }
    const library = getExternalLoredeckLibraryRegistry();
    const record = library.packs?.[id] || null;
    if (!record) {
        return {
            ok: false,
            notFound: true,
            error: `Lorepack ${id} is not registered in external storage.`,
            diagnostics: [normalizeStorageDiagnostic({ code: 'repair_pack_not_found', message: `Lorepack ${id} is not registered in external storage.` })],
        };
    }
    const pack = await hydrateExternalLorepackPayloadRecord(record, options);
    return {
        ok: !!pack,
        pack,
        record,
        library,
        diagnostics: pack ? [] : [normalizeStorageDiagnostic({ code: 'repair_payload_not_loaded', message: `Lorepack ${id} payload could not be loaded.` })],
    };
}

export async function runPackHealth(packOrId = {}, options = {}) {
    const loadResult = typeof packOrId === 'string'
        ? await loadPackPayload(packOrId, options)
        : { ok: true, pack: packOrId, diagnostics: [] };
    if (!loadResult.ok) return { ...loadResult, health: null };
    const pack = loadResult.pack;
    const health = typeof options.healthEvaluator === 'function'
        ? await options.healthEvaluator(pack)
        : buildLoredeckHealthForData({
            packId: pack.packId,
            manifest: pack.manifestData,
            entryFiles: getPackEntryFiles(pack),
            timeline: pack.timelineRegistry,
            tagRegistry: pack.tagRegistry,
        });
    return {
        ok: true,
        pack,
        health,
        diagnostics: loadResult.diagnostics || [],
    };
}

export async function updatePackHealthSummary(packId = '', health = null, options = {}) {
    const loadResult = await loadPackPayload(packId, options);
    if (!loadResult.ok) return loadResult;
    const currentHealth = health || (await runPackHealth(loadResult.pack, options)).health;
    const next = applyHealthSummaryToPayload(loadResult.pack, currentHealth, options);
    const persistResult = persistRepairPayload(next, options);
    return {
        ...persistResult,
        health: currentHealth,
        diagnostics: persistResult.ok ? [] : [normalizeStorageDiagnostic({ code: 'repair_health_summary_write_failed', message: persistResult.error || 'Pack Health summary write failed.' })],
    };
}

export async function applyPackRepairPatches(packId = '', patches = [], options = {}) {
    const loadResult = await loadPackPayload(packId, options);
    if (!loadResult.ok) return loadResult;

    const beforeHealth = options.health || (await runPackHealth(loadResult.pack, options)).health;
    const initialPlan = options.plan || buildLoredeckHealthRepairPlan({ pack: loadResult.pack, health: beforeHealth, batchLimits: options.batchLimits });
    const normalizedPatches = (Array.isArray(patches) ? patches : [patches]).map(normalizeRepairPatch);
    const diagnostics = [];
    const validations = [];
    let workingPack = cloneRepairJson(loadResult.pack) || {};

    for (const patch of normalizedPatches) {
        const context = createPatchValidationContext(initialPlan, patch);
        const validation = validateLoredeckRepairPatch(workingPack, patch, context);
        validations.push(validation);
        if (!validation.directApply) {
            diagnostics.push(...validation.diagnostics);
            continue;
        }
        workingPack = applyPatchToPayload(workingPack, patch);
    }

    const appliedPatches = normalizedPatches.filter((_patch, index) => validations[index]?.directApply);
    if (!appliedPatches.length) {
        return {
            ok: false,
            pack: loadResult.pack,
            beforeHealth,
            afterHealth: beforeHealth,
            initialPlan,
            finalPlan: initialPlan,
            validations,
            appliedPatches: [],
            diagnostics,
            error: diagnostics[0]?.message || 'No repair patches passed validation.',
            summary: createRepairRunSummary({
                initialHealth: beforeHealth,
                checkpointHealth: beforeHealth,
                finalHealth: beforeHealth,
                initialPlan,
                checkpointPlan: initialPlan,
                finalPlan: initialPlan,
                appliedPatches: [],
                choiceSets: [],
                diagnostics,
            }),
        };
    }

    const afterHealth = (await runPackHealth(workingPack, options)).health;
    const persistedPack = applyHealthSummaryToPayload(workingPack, afterHealth, options);
    const finalPlan = buildLoredeckHealthRepairPlan({ pack: persistedPack, health: afterHealth, batchLimits: options.batchLimits });
    const persistResult = persistRepairPayload(persistedPack, options);
    if (!persistResult.ok) {
        const diagnostic = normalizeStorageDiagnostic({ code: 'repair_payload_write_failed', message: persistResult.error || 'Repair payload write failed.' });
        return {
            ok: false,
            pack: loadResult.pack,
            beforeHealth,
            afterHealth,
            initialPlan,
            finalPlan,
            validations,
            appliedPatches,
            diagnostics: [...diagnostics, diagnostic],
            error: diagnostic.message,
        };
    }

    const summary = createRepairRunSummary({
        initialHealth: beforeHealth,
        checkpointHealth: afterHealth,
        finalHealth: afterHealth,
        initialPlan,
        checkpointPlan: finalPlan,
        finalPlan,
        appliedPatches,
        choiceSets: [],
        diagnostics,
    });
    return {
        ok: true,
        pack: persistResult.pack,
        beforeHealth,
        afterHealth,
        initialPlan,
        finalPlan,
        validations,
        appliedPatches,
        diagnostics,
        summary,
        libraryRecord: persistResult.libraryRecord,
        library: persistResult.library,
    };
}

export async function applyPackRepairPatch(packId = '', patch = {}, options = {}) {
    return applyPackRepairPatches(packId, [patch], options);
}
