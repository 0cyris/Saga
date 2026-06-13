/**
 * loredeck-pending-change-model.js - Saga
 * Runtime pending Loredeck change normalization and patch application.
 */

import {
    cloneLoredeckJson,
} from './loredeck-package-helpers.js';

let pendingChangeDeps = {};

export function configureLoredeckPendingChangeModel(deps = {}) {
    pendingChangeDeps = { ...pendingChangeDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof pendingChangeDeps[name] === 'function' ? pendingChangeDeps[name] : fallback;
}

function normalizeLoredeckTagId(value = '') { return dep('normalizeLoredeckTagId', input => String(input || '').trim().toLowerCase())(value); }
function normalizeLoredeckTimelineId(value = '') { return dep('normalizeLoredeckTimelineId', input => String(input || '').trim().toLowerCase())(value); }
function normalizeLoredeckTimelineDisabledIds(value = []) { return dep('normalizeLoredeckTimelineDisabledIds', input => Array.isArray(input) ? input.map(String).filter(Boolean) : [])(value); }
function normalizeLoredeckTagDefinition(raw = {}, tagId = '') { return dep('normalizeLoredeckTagDefinition', input => input || {})(raw, tagId); }
function normalizeLoredeckTimelineAnchor(raw = {}, fallbackId = '', index = 0) { return dep('normalizeLoredeckTimelineAnchor', input => input || null)(raw, fallbackId, index); }
function normalizeLoredeckTimelineWindow(raw = {}, fallbackId = '', index = 0) { return dep('normalizeLoredeckTimelineWindow', input => input || null)(raw, fallbackId, index); }
function normalizeLoredeckPatchEntryOverride(record = {}, rawEntry = {}, id = '') { return dep('normalizeLoredeckPatchEntryOverride', (_record, entry) => entry)(record, rawEntry, id); }

export function normalizeLoredeckPendingIdList(value = [], limit = 500) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const id = String(raw || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

export function normalizeLoredeckPendingTagIdList(value = [], limit = 500) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const id = normalizeLoredeckTagId(raw);
        if (!id || seen.has(id.toLowerCase())) continue;
        seen.add(id.toLowerCase());
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

export function normalizeLoredeckPendingTimelineIdList(value = [], limit = 500) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const id = normalizeLoredeckTimelineId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

export function normalizeLoredeckPendingChanges(value = []) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const changeId = String(raw.changeId || raw.id || '').trim();
        if (!changeId || seen.has(changeId)) continue;
        seen.add(changeId);
        out.push({
            schemaVersion: Number.isFinite(Number(raw.schemaVersion)) ? Number(raw.schemaVersion) : 1,
            changeId,
            status: 'pending',
            source: String(raw.source || 'manual').trim().slice(0, 80),
            action: String(raw.action || 'record_patch').trim().slice(0, 80),
            targetKind: String(raw.targetKind || 'loredeck').trim().slice(0, 80),
            title: String(raw.title || changeId).trim().slice(0, 240),
            description: String(raw.description || '').trim().slice(0, 1000),
            affectedEntryIds: normalizeLoredeckPendingIdList(raw.affectedEntryIds),
            affectedTagIds: normalizeLoredeckPendingTagIdList(raw.affectedTagIds),
            affectedTimelineIds: normalizeLoredeckPendingTimelineIdList(raw.affectedTimelineIds),
            payload: cloneLoredeckJson(raw.payload) || {},
            preview: cloneLoredeckJson(raw.preview) || {},
            createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
            updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : Date.now(),
        });
        if (out.length >= 500) break;
    }
    return out;
}

export function getLoredeckPendingChanges(pack = {}) {
    return normalizeLoredeckPendingChanges(pack?.pendingChanges);
}

function createLoredeckPendingChangeId(action = 'change') {
    return `lpchg_${String(action || 'change').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createLoredeckRecordPatchChange(fields = {}) {
    const now = Date.now();
    return {
        schemaVersion: 1,
        changeId: fields.changeId || createLoredeckPendingChangeId(fields.action || 'record_patch'),
        status: 'pending',
        source: fields.source || 'manual',
        action: fields.action || 'record_patch',
        targetKind: fields.targetKind || 'loredeck',
        title: String(fields.title || 'Pending Loredeck Change').trim(),
        description: String(fields.description || '').trim(),
        affectedEntryIds: normalizeLoredeckPendingIdList(fields.affectedEntryIds),
        affectedTagIds: normalizeLoredeckPendingTagIdList(fields.affectedTagIds),
        affectedTimelineIds: normalizeLoredeckPendingTimelineIdList(fields.affectedTimelineIds),
        payload: cloneLoredeckJson(fields.payload) || {},
        preview: cloneLoredeckJson(fields.preview) || {},
        createdAt: now,
        updatedAt: now,
    };
}

function ensureLoredeckPatchTagRegistry(record) {
    if (!record.tagRegistry || typeof record.tagRegistry !== 'object' || Array.isArray(record.tagRegistry)) {
        record.tagRegistry = { schemaVersion: 1, tags: {} };
    }
    if (!record.tagRegistry.tags || typeof record.tagRegistry.tags !== 'object' || Array.isArray(record.tagRegistry.tags)) {
        record.tagRegistry.tags = {};
    }
}

function ensureLoredeckPatchTimelineRegistry(record) {
    if (!record.timelineRegistry || typeof record.timelineRegistry !== 'object' || Array.isArray(record.timelineRegistry)) {
        record.timelineRegistry = { schemaVersion: 1, timelineMode: 'hybrid', sortKeyScale: 'pack_local', anchors: [], windows: [] };
    }
    if (!Array.isArray(record.timelineRegistry.anchors)) record.timelineRegistry.anchors = [];
    if (!Array.isArray(record.timelineRegistry.windows)) record.timelineRegistry.windows = [];
    if (!Array.isArray(record.timelineRegistry.disabledAnchorIds)) record.timelineRegistry.disabledAnchorIds = [];
    if (!Array.isArray(record.timelineRegistry.disabledWindowIds)) record.timelineRegistry.disabledWindowIds = [];
}

function upsertLoredeckTimelineItem(list = [], item = null, normalizer = null) {
    const normalized = typeof normalizer === 'function' ? normalizer(item) : item;
    const id = String(normalized?.id || '').trim();
    if (!id) return list;
    const next = (Array.isArray(list) ? list : []).filter(existing => String(existing?.id || '').trim() !== id);
    next.push(normalized);
    return next;
}

function removeLoredeckTimelineItem(list = [], id = '') {
    const target = normalizeLoredeckTimelineId(id);
    if (!target) return Array.isArray(list) ? list : [];
    return (Array.isArray(list) ? list : []).filter(item => String(item?.id || '').trim() !== target);
}

function updateLoredeckDisabledTimelineIds(current = [], add = [], remove = []) {
    const set = new Set(normalizeLoredeckTimelineDisabledIds(current));
    for (const id of normalizeLoredeckTimelineDisabledIds(add)) set.add(id);
    for (const id of normalizeLoredeckTimelineDisabledIds(remove)) set.delete(id);
    return Array.from(set);
}

export function applyLoredeckRecordPatch(record, payload = {}) {
    const patch = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    if (!record.entryOverrides || typeof record.entryOverrides !== 'object' || Array.isArray(record.entryOverrides)) {
        record.entryOverrides = {};
    }
    const entryOverrides = patch.entryOverrides && typeof patch.entryOverrides === 'object' && !Array.isArray(patch.entryOverrides)
        ? patch.entryOverrides
        : {};
    for (const [rawId, rawEntry] of Object.entries(entryOverrides)) {
        const id = String(rawEntry?.id || rawId || '').trim();
        if (!id) continue;
        if (rawEntry === null) {
            delete record.entryOverrides[id];
            continue;
        }
        record.entryOverrides[id] = normalizeLoredeckPatchEntryOverride(record, rawEntry, id);
    }

    const disabledSet = new Set(Array.isArray(record.disabledEntryIds) ? record.disabledEntryIds : []);
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsAdd || [])) disabledSet.add(id);
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsRemove || [])) disabledSet.delete(id);
    record.disabledEntryIds = Array.from(disabledSet);

    const tagDefinitions = patch.tagDefinitions && typeof patch.tagDefinitions === 'object' && !Array.isArray(patch.tagDefinitions)
        ? patch.tagDefinitions
        : {};
    if (Object.keys(tagDefinitions).length) ensureLoredeckPatchTagRegistry(record);
    for (const [rawId, rawDef] of Object.entries(tagDefinitions)) {
        const id = normalizeLoredeckTagId(rawDef?.id || rawId);
        if (!id) continue;
        if (rawDef === null) {
            delete record.tagRegistry.tags[id];
            continue;
        }
        const def = normalizeLoredeckTagDefinition(rawDef, id);
        delete def.id;
        record.tagRegistry.tags[id] = def;
    }

    const timelineAnchors = patch.timelineAnchors && typeof patch.timelineAnchors === 'object' && !Array.isArray(patch.timelineAnchors)
        ? patch.timelineAnchors
        : {};
    const timelineWindows = patch.timelineWindows && typeof patch.timelineWindows === 'object' && !Array.isArray(patch.timelineWindows)
        ? patch.timelineWindows
        : {};
    const hasTimelinePatch = Object.keys(timelineAnchors).length
        || Object.keys(timelineWindows).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineAnchorIdsDisable || []).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineAnchorIdsEnable || []).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineWindowIdsDisable || []).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineWindowIdsEnable || []).length;
    if (hasTimelinePatch) ensureLoredeckPatchTimelineRegistry(record);

    for (const [rawId, rawAnchor] of Object.entries(timelineAnchors)) {
        const id = normalizeLoredeckTimelineId(rawAnchor?.id || rawId);
        if (!id) continue;
        if (rawAnchor === null) {
            record.timelineRegistry.anchors = removeLoredeckTimelineItem(record.timelineRegistry.anchors, id);
            continue;
        }
        record.timelineRegistry.anchors = upsertLoredeckTimelineItem(record.timelineRegistry.anchors, { ...rawAnchor, id }, normalizeLoredeckTimelineAnchor);
        record.timelineRegistry.disabledAnchorIds = updateLoredeckDisabledTimelineIds(record.timelineRegistry.disabledAnchorIds, [], [id]);
    }

    for (const [rawId, rawWindow] of Object.entries(timelineWindows)) {
        const id = normalizeLoredeckTimelineId(rawWindow?.id || rawId);
        if (!id) continue;
        if (rawWindow === null) {
            record.timelineRegistry.windows = removeLoredeckTimelineItem(record.timelineRegistry.windows, id);
            continue;
        }
        record.timelineRegistry.windows = upsertLoredeckTimelineItem(record.timelineRegistry.windows, { ...rawWindow, id }, normalizeLoredeckTimelineWindow);
        record.timelineRegistry.disabledWindowIds = updateLoredeckDisabledTimelineIds(record.timelineRegistry.disabledWindowIds, [], [id]);
    }

    if (hasTimelinePatch) {
        record.timelineRegistry.disabledAnchorIds = updateLoredeckDisabledTimelineIds(
            record.timelineRegistry?.disabledAnchorIds,
            patch.timelineAnchorIdsDisable || [],
            patch.timelineAnchorIdsEnable || []
        );
        record.timelineRegistry.disabledWindowIds = updateLoredeckDisabledTimelineIds(
            record.timelineRegistry?.disabledWindowIds,
            patch.timelineWindowIdsDisable || [],
            patch.timelineWindowIdsEnable || []
        );
    }
}
