/**
 * loredeck-pending-change-actions.js - Saga
 * Runtime pending Loredeck change queue, accept, and reject lifecycle.
 */

import {
    applyLoredeckRecordPatch,
    getLoredeckPendingChanges,
    normalizeLoredeckPendingChanges,
    normalizeLoredeckPendingIdList,
} from './loredeck-pending-change-model.js';
import {
    cloneLoredeckJson,
} from './loredeck-package-helpers.js';
import {
    doesLoredeckPendingChangeAffectPackHealth,
} from './loredeck-review-helpers.js';

let pendingActionDeps = {};

export function configureLoredeckPendingChangeActions(deps = {}) {
    pendingActionDeps = { ...pendingActionDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof pendingActionDeps[name] === 'function' ? pendingActionDeps[name] : fallback;
}

function toast(message, type = 'info') { return dep('toast')(message, type); }
function persistLoredeckLibraryRecordMutation(pack, mutator, message, options = {}) { return dep('persistLoredeckLibraryRecordMutation', () => false)(pack, mutator, message, options); }
function getFreshLoredeckLibraryPack(packId, fallback = null) { return dep('getFreshLoredeckLibraryPack', (_id, fallbackPack) => fallbackPack)(packId, fallback); }
function canValidateLoredeckInEditor(pack = {}) { return dep('canValidateLoredeckInEditor', () => false)(pack); }
function refreshLoredeckSurfaces(options = {}) { return dep('refreshLoredeckSurfaces')(options); }
function isGeneratedLoredeckPack(pack = {}) { return dep('isGeneratedLoredeckPack', () => false)(pack); }
function getAcceptedVirtualLoredeckEntries(pack = {}) { return dep('getAcceptedVirtualLoredeckEntries', () => [])(pack); }
function validateLoredeckForEditor(pack, button = null, options = {}) { return dep('validateLoredeckForEditor', async () => ({}))(pack, button, options); }
function flushLoredeckStorageWrites() { return dep('flushLoredeckStorageWrites', async () => ({ ok: true, error: '', pendingWrites: 0 }))(); }
function clearCanonLoreDatabaseCache() { return dep('clearCanonLoreDatabaseCache')(); }
function clearContextIndexCache() { return dep('clearContextIndexCache')(); }
function normalizeLoredeckCreatorTitleId(value = '', fallback = '') { return dep('normalizeLoredeckCreatorTitleId', (_value, fallbackValue) => fallbackValue)(value, fallback); }
function normalizeLoredeckCreatorTitleIdList(value = [], limit = 1200) { return dep('normalizeLoredeckCreatorTitleIdList', input => Array.isArray(input) ? input.map(String).filter(Boolean) : [])(value, limit); }
function refreshGeneratedLoredeckDerivedMetadata(pack = {}) { return dep('refreshGeneratedLoredeckDerivedMetadata')(pack); }
function getLoredeckCreatorBriefCache() { return dep('getLoredeckCreatorBriefCache', () => ({}))(); }
function setLoredeckCreatorBriefCache(next = {}, options = {}) { return dep('setLoredeckCreatorBriefCache')(next, options); }
function isLoredeckCreatorPlanningPendingChange(change = {}, batchId = '') { return dep('isLoredeckCreatorPlanningPendingChange', () => false)(change, batchId); }
function refreshLoredeckCreatorWorkbenchBody(options = {}) { return dep('refreshLoredeckCreatorWorkbenchBody')(options); }
function refreshHeader() { return dep('refreshHeader')(); }

function getLoredeckPendingChangeDisplayName(change = {}) {
    return String(change?.title || change?.changeId || 'Pending Loredeck change').trim() || 'Pending Loredeck change';
}

function getErrorMessage(error) {
    return String(error?.message || error || '').trim() || 'Unknown error';
}

function stableLoredeckPendingJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(item => stableLoredeckPendingJson(item)).join(',')}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableLoredeckPendingJson(value[key])}`).join(',')}}`;
}

function isPlainLoredeckPendingObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isLoredeckPendingEntryChangeAlreadyApplied(pack = {}, change = {}) {
    const payload = isPlainLoredeckPendingObject(change?.payload) ? change.payload : {};
    const payloadKeys = Object.keys(payload).filter(key => payload[key] !== undefined);
    const supportedKeys = new Set(['entryOverrides', 'disabledEntryIdsRemove']);
    if (!payloadKeys.length || payloadKeys.some(key => !supportedKeys.has(key))) return false;
    const overrides = isPlainLoredeckPendingObject(payload.entryOverrides) ? payload.entryOverrides : {};
    const overrideEntries = Object.entries(overrides);
    if (!overrideEntries.length) return false;
    const accepted = isPlainLoredeckPendingObject(pack.entryOverrides) ? pack.entryOverrides : {};
    const disabled = new Set(normalizeLoredeckPendingIdList(pack.disabledEntryIds || []));
    const removesAlreadyApplied = normalizeLoredeckPendingIdList(payload.disabledEntryIdsRemove || [])
        .every(id => !disabled.has(id));
    return removesAlreadyApplied && overrideEntries.every(([entryId, nextEntry]) => (
        Object.prototype.hasOwnProperty.call(accepted, entryId)
        && stableLoredeckPendingJson(accepted[entryId]) === stableLoredeckPendingJson(nextEntry)
    ));
}

function pruneAlreadyAppliedLoredeckPendingChanges(next = {}) {
    const pending = normalizeLoredeckPendingChanges(next.pendingChanges);
    const retained = pending.filter(change => !isLoredeckPendingEntryChangeAlreadyApplied(next, change));
    if (retained.length === pending.length) {
        next.pendingChanges = pending;
        return 0;
    }
    next.pendingChanges = retained;
    return pending.length - retained.length;
}

function getAcceptableLoredeckPendingChanges(pack = {}, selected = []) {
    const accepted = [];
    const failed = [];
    let probe = cloneLoredeckJson(pack) || { ...(pack || {}) };
    for (const change of selected || []) {
        const before = cloneLoredeckJson(probe) || { ...(probe || {}) };
        try {
            applyLoredeckRecordPatch(probe, change.payload);
            accepted.push(change);
        } catch (error) {
            probe = before;
            failed.push({ change, error });
        }
    }
    return { accepted, failed };
}

function reportLoredeckPendingAcceptFailures(failed = [], acceptedCount = 0) {
    if (!failed.length) return;
    const first = failed[0] || {};
    const firstName = getLoredeckPendingChangeDisplayName(first.change);
    const firstError = getErrorMessage(first.error);
    const skipped = failed.length === 1
        ? `"${firstName}" could not be applied: ${firstError}`
        : `${failed.length} pending Loredeck changes could not be applied. First failure: "${firstName}" (${firstError})`;
    const suffix = acceptedCount
        ? ` Accepted ${acceptedCount} other change${acceptedCount === 1 ? '' : 's'}; skipped item${failed.length === 1 ? '' : 's'} remain in Pending Review.`
        : ` No changes were accepted; skipped item${failed.length === 1 ? '' : 's'} remain in Pending Review.`;
    console.warn('[Saga] Pending Loredeck change acceptance skipped invalid payloads:', failed.map(item => ({
        changeId: item.change?.changeId,
        title: item.change?.title,
        error: getErrorMessage(item.error),
    })));
    toast(`${skipped}.${suffix}`, acceptedCount ? 'warning' : 'error');
}

function applyAcceptedLoredeckPendingChanges(next = {}, acceptedChanges = []) {
    const acceptedIds = new Set((acceptedChanges || []).map(change => String(change?.changeId || '').trim()).filter(Boolean));
    if (!acceptedIds.size) return false;
    for (const change of acceptedChanges || []) {
        if (!change?.payload) continue;
        applyLoredeckRecordPatch(next, change.payload);
    }
    next.pendingChanges = normalizeLoredeckPendingChanges(next.pendingChanges)
        .filter(change => !acceptedIds.has(change.changeId));
    pruneAlreadyAppliedLoredeckPendingChanges(next);
    return true;
}

function ensureAcceptedLoredeckPendingChangesCommitted(pack = {}, acceptedChanges = [], validation = null) {
    if (!acceptedChanges.length) return false;
    const fresh = getFreshLoredeckLibraryPack(pack?.packId, pack) || pack;
    return persistLoredeckLibraryRecordMutation(fresh, next => {
        applyAcceptedLoredeckPendingChanges(next, acceptedChanges);
        if (isGeneratedLoredeckPack(next)) refreshGeneratedLoredeckDerivedMetadata(next);
        if (validation?.health?.status) next.healthStatus = validation.health.status;
    }, '', {
        errorMessage: 'Pending Loredeck change acceptance cleanup failed.',
    });
}

async function confirmLoredeckPendingMutationPersisted(label = 'Pending Loredeck change') {
    const result = await flushLoredeckStorageWrites();
    if (!result || result.ok !== false) return true;
    const error = String(result.error || 'External Loredeck storage write failed.').trim();
    toast(`${label} could not be saved to external storage: ${error}`, 'error');
    return false;
}

export function queueLoredeckPendingChange(pack, change, message = '') {
    const pendingChange = normalizeLoredeckPendingChanges([change])[0];
    if (!pendingChange) {
        toast('Could not queue Loredeck change.', 'error');
        return false;
    }
    return persistLoredeckLibraryRecordMutation(pack, next => {
        const pending = normalizeLoredeckPendingChanges(next.pendingChanges);
        pending.push(pendingChange);
        next.pendingChanges = pending;
    }, message || `Queued pending change: ${pendingChange.title}.`, {
        errorMessage: 'Loredeck pending change save failed.',
    });
}

export function queueLoredeckPendingChanges(pack, changes = [], message = '') {
    const pendingChanges = normalizeLoredeckPendingChanges(changes);
    if (!pendingChanges.length) {
        toast('Could not queue Loredeck changes.', 'error');
        return false;
    }
    return persistLoredeckLibraryRecordMutation(pack, next => {
        const pending = normalizeLoredeckPendingChanges(next.pendingChanges);
        pending.push(...pendingChanges);
        next.pendingChanges = pending;
    }, message || `Queued ${pendingChanges.length} pending Loredeck change${pendingChanges.length === 1 ? '' : 's'}.`, {
        errorMessage: 'Loredeck pending change save failed.',
    });
}

async function refreshLoredeckHealthAfterAcceptedPendingChanges(pack = {}, acceptedChanges = []) {
    const acceptedCount = Array.isArray(acceptedChanges) ? acceptedChanges.length : Math.max(0, Number(acceptedChanges) || 0);
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    if (!fresh) return null;
    if (!canValidateLoredeckInEditor(fresh)) {
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        if (isGeneratedLoredeckPack(fresh) && !getAcceptedVirtualLoredeckEntries(fresh).length) {
            return { skipped: true, reason: 'generated_shell_without_entries' };
        }
        toast('Accepted changes, but Pack Health could not rerun because this Loredeck is not validatable yet.', 'warning');
        return { skipped: true, reason: 'not_validatable' };
    }
    const validation = await validateLoredeckForEditor(fresh, null, { quiet: true, updateLibrary: true });
    if (!validation.health) {
        ensureAcceptedLoredeckPendingChangesCommitted(fresh, acceptedChanges);
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        toast(validation.error || 'Accepted changes, but Pack Health rerun failed. Health remains stale.', 'warning');
        return null;
    }
    const validatedFresh = getFreshLoredeckLibraryPack(fresh.packId, fresh) || fresh;
    ensureAcceptedLoredeckPendingChangesCommitted(validatedFresh, acceptedChanges, validation);
    clearCanonLoreDatabaseCache();
    clearContextIndexCache();
    refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    const summary = validation.health.summary || {};
    const issueText = `${summary.errorCount || 0} error${(summary.errorCount || 0) === 1 ? '' : 's'}, ${summary.warningCount || 0} warning${(summary.warningCount || 0) === 1 ? '' : 's'}`;
    const followup = validation.health.errors?.length ? ' Open Pack Health Center for grouped findings.' : '';
    toast(`Accepted ${acceptedCount} change${acceptedCount === 1 ? '' : 's'} and refreshed Pack Health: ${validation.health.status || 'checked'} (${issueText}).${followup}`, validation.health.errors?.length ? 'error' : (validation.health.warnings?.length ? 'warning' : 'success'));
    return validation;
}

export async function acceptLoredeckPendingChanges(pack, changeIds = []) {
    const freshPack = getFreshLoredeckLibraryPack(pack?.packId, pack);
    if (!freshPack?.packId) {
        toast('Loredeck is no longer available.', 'warning');
        return false;
    }
    const idSet = new Set(normalizeLoredeckPendingIdList(changeIds));
    const pending = getLoredeckPendingChanges(freshPack);
    const selected = idSet.size ? pending.filter(change => idSet.has(change.changeId)) : pending;
    if (!selected.length) {
        toast('No pending Loredeck changes selected.', 'warning');
        return false;
    }
    const acceptance = getAcceptableLoredeckPendingChanges(freshPack, selected);
    const acceptedChanges = acceptance.accepted;
    if (!acceptedChanges.length) {
        reportLoredeckPendingAcceptFailures(acceptance.failed, 0);
        return false;
    }
    const affectsHealth = acceptedChanges.some(change => doesLoredeckPendingChangeAffectPackHealth(change));
    const shouldReportStaleHealth = affectsHealth && canValidateLoredeckInEditor(freshPack);
    const selectedCreatorPlanningBatchIds = acceptedChanges
        .filter(change => String(change.source || '').trim() === 'loredeck_creator' && ['timeline_anchor', 'timeline_window', 'tag'].includes(change.targetKind))
        .map(change => normalizeLoredeckCreatorTitleId(change.preview?.creatorPlanningBatch?.id || '', ''))
        .filter(Boolean);
    const accepted = persistLoredeckLibraryRecordMutation(freshPack, next => {
        applyAcceptedLoredeckPendingChanges(next, acceptedChanges);
        if (isGeneratedLoredeckPack(next)) refreshGeneratedLoredeckDerivedMetadata(next);
        if (affectsHealth) next.healthStatus = 'stale';
    }, shouldReportStaleHealth
        ? `Accepted ${acceptedChanges.length} pending Loredeck change${acceptedChanges.length === 1 ? '' : 's'}. Pack Health marked stale.`
        : `Accepted ${acceptedChanges.length} pending Loredeck change${acceptedChanges.length === 1 ? '' : 's'}.`, {
        errorMessage: 'Pending Loredeck change acceptance failed.',
    });
    if (accepted && acceptance.failed.length) {
        reportLoredeckPendingAcceptFailures(acceptance.failed, acceptedChanges.length);
    }
    if (accepted && selectedCreatorPlanningBatchIds.length) {
        const cached = getLoredeckCreatorBriefCache();
        if (cached.generatedPackId === pack.packId) {
            const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
            const remainingPending = getLoredeckPendingChanges(fresh);
            const acceptedIds = new Set(normalizeLoredeckCreatorTitleIdList(cached.planningBatchAcceptedIds || [], 1200));
            for (const id of selectedCreatorPlanningBatchIds) {
                const stillPending = remainingPending.some(change => isLoredeckCreatorPlanningPendingChange(change, id));
                if (!stillPending) acceptedIds.add(id);
            }
            setLoredeckCreatorBriefCache({
                ...cached,
                planningBatchAcceptedIds: [...acceptedIds],
                planningAcceptedAt: Date.now(),
            });
        }
    }
    if (accepted && affectsHealth) {
        await refreshLoredeckHealthAfterAcceptedPendingChanges(freshPack, acceptedChanges);
    } else if (accepted) {
        ensureAcceptedLoredeckPendingChangesCommitted(freshPack, acceptedChanges);
    }
    const persisted = accepted
        ? await confirmLoredeckPendingMutationPersisted(`Accepted ${acceptedChanges.length} pending Loredeck change${acceptedChanges.length === 1 ? '' : 's'}`)
        : false;
    if (accepted) {
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });
        refreshHeader();
    }
    return accepted && persisted;
}

export async function rejectLoredeckPendingChanges(pack, changeIds = []) {
    const freshPack = getFreshLoredeckLibraryPack(pack?.packId, pack);
    if (!freshPack?.packId) {
        toast('Loredeck is no longer available.', 'warning');
        return false;
    }
    const idSet = new Set(normalizeLoredeckPendingIdList(changeIds));
    const pending = getLoredeckPendingChanges(freshPack);
    const selected = idSet.size ? pending.filter(change => idSet.has(change.changeId)) : pending;
    if (!selected.length) {
        toast('No pending Loredeck changes selected.', 'warning');
        return false;
    }
    const rejected = persistLoredeckLibraryRecordMutation(freshPack, next => {
        const selectedIds = new Set(selected.map(change => change.changeId));
        next.pendingChanges = normalizeLoredeckPendingChanges(next.pendingChanges).filter(change => !selectedIds.has(change.changeId));
    }, `Rejected ${selected.length} pending Loredeck change${selected.length === 1 ? '' : 's'}.`, {
        errorMessage: 'Pending Loredeck change rejection failed.',
    });
    let persisted = false;
    if (rejected) {
        persisted = await confirmLoredeckPendingMutationPersisted(`Rejected ${selected.length} pending Loredeck change${selected.length === 1 ? '' : 's'}`);
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });
        refreshHeader();
    }
    return rejected && persisted;
}
