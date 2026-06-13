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

async function refreshLoredeckHealthAfterAcceptedPendingChanges(pack = {}, acceptedCount = 0) {
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
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        toast(validation.error || 'Accepted changes, but Pack Health rerun failed. Health remains stale.', 'warning');
        return null;
    }
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
    const affectsHealth = selected.some(change => doesLoredeckPendingChangeAffectPackHealth(change));
    const shouldReportStaleHealth = affectsHealth && canValidateLoredeckInEditor(freshPack);
    const selectedCreatorPlanningBatchIds = selected
        .filter(change => String(change.source || '').trim() === 'loredeck_creator' && ['timeline_anchor', 'timeline_window', 'tag'].includes(change.targetKind))
        .map(change => normalizeLoredeckCreatorTitleId(change.preview?.creatorPlanningBatch?.id || '', ''))
        .filter(Boolean);
    const accepted = persistLoredeckLibraryRecordMutation(freshPack, next => {
        const current = normalizeLoredeckPendingChanges(next.pendingChanges);
        const selectedIds = new Set(selected.map(change => change.changeId));
        for (const change of current) {
            if (!selectedIds.has(change.changeId)) continue;
            applyLoredeckRecordPatch(next, change.payload);
        }
        next.pendingChanges = current.filter(change => !selectedIds.has(change.changeId));
        if (isGeneratedLoredeckPack(next)) refreshGeneratedLoredeckDerivedMetadata(next);
        if (affectsHealth) next.healthStatus = 'stale';
    }, shouldReportStaleHealth
        ? `Accepted ${selected.length} pending Loredeck change${selected.length === 1 ? '' : 's'}. Pack Health marked stale.`
        : `Accepted ${selected.length} pending Loredeck change${selected.length === 1 ? '' : 's'}.`, {
        errorMessage: 'Pending Loredeck change acceptance failed.',
    });
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
        await refreshLoredeckHealthAfterAcceptedPendingChanges(pack, selected.length);
    }
    if (accepted) {
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });
        refreshHeader();
    }
    return accepted;
}

export function rejectLoredeckPendingChanges(pack, changeIds = []) {
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
    if (rejected) {
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });
        refreshHeader();
    }
    return rejected;
}
