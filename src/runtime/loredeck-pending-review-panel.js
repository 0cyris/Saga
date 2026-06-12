/**
 * loredeck-pending-review-panel.js - Saga
 * Runtime Loredeck pending review card and row rendering.
 */

import {
    createButton,
    createEmptyMessage,
    createStatusPill,
} from '../ui/runtime-ui-kit.js';
import {
    createLoredeckActionRow,
} from '../loredecks/loredeck-action-rows.js';

let pendingReviewDeps = {};

export function configureLoredeckPendingReviewPanel(deps = {}) {
    pendingReviewDeps = { ...pendingReviewDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof pendingReviewDeps[name] === 'function' ? pendingReviewDeps[name] : fallback;
}

function getLoredeckPendingChanges(pack = {}) { return dep('getLoredeckPendingChanges', () => [])(pack); }
function doesLoredeckPendingChangeAffectPackHealth(change = {}) { return dep('doesLoredeckPendingChangeAffectPackHealth', () => false)(change); }
function isLoredeckHealthStatusStale(pack = {}) { return dep('isLoredeckHealthStatusStale', () => false)(pack); }
function createLoredeckPendingHealthStalePill() { return dep('createLoredeckPendingHealthStalePill', () => null)(); }
function createLoredeckPendingHealthImpactPill() { return dep('createLoredeckPendingHealthImpactPill', () => null)(); }
function formatLoredeckPendingActionLabel(action = '') { return dep('formatLoredeckPendingActionLabel', value => String(value || 'Record Patch'))(action); }
function formatLoredeckPendingTargetKindLabel(targetKind = '') { return dep('formatLoredeckPendingTargetKindLabel', value => String(value || 'Loredeck'))(targetKind); }
function formatLoredeckPendingSourceLabel(source = '') { return dep('formatLoredeckPendingSourceLabel', value => String(value || 'Manual'))(source); }
function getLoredeckPendingSourceTooltip(source = '') { return dep('getLoredeckPendingSourceTooltip', () => 'Proposal source.')(source); }
function getLoredeckPendingConfidence(change = {}) { return dep('getLoredeckPendingConfidence', () => null)(change); }
function getLoredeckPendingRisk(change = {}) { return dep('getLoredeckPendingRisk', () => '')(change); }
function createLoredeckPendingRiskPill(risk = '') { return dep('createLoredeckPendingRiskPill', () => null)(risk); }
function appendLoredeckPendingQualityPills(meta, change = {}) { return dep('appendLoredeckPendingQualityPills')(meta, change); }
function createLoredeckPendingDiffList(pack = {}, change = {}) { return dep('createLoredeckPendingDiffList', () => null)(pack, change); }
function createLoredeckPendingQualityList(change = {}) { return dep('createLoredeckPendingQualityList', () => null)(change); }
function createStateBackup(reason = '', options = {}) { return dep('createStateBackup')(reason, options); }
function confirmAction(title = '', message = '') { return dep('confirmAction', async () => false)(title, message); }
function runBusyAction(button, label = '', action = async () => {}) { return dep('runBusyAction', async (_button, _label, fn) => fn())(button, label, action); }
function acceptLoredeckPendingChanges(pack, changeIds = []) { return dep('acceptLoredeckPendingChanges', async () => false)(pack, changeIds); }
function rejectLoredeckPendingChanges(pack, changeIds = []) { return dep('rejectLoredeckPendingChanges', () => false)(pack, changeIds); }
function validateLoredeckForEditor(pack, button = null) { return dep('validateLoredeckForEditor', async () => null)(pack, button); }
function canValidateLoredeckInEditor(pack = {}) { return dep('canValidateLoredeckInEditor', () => false)(pack); }

export function createLoredeckPendingReviewCard(pack = {}) {
    const pending = getLoredeckPendingChanges(pack);
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview saga-loredeck-pending-review';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Pending Review Queue';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${pending.length} pending`, 'Loredeck edit proposals waiting for acceptance.'));
    const affectedEntries = new Set(pending.flatMap(change => change.affectedEntryIds || []));
    const affectedTags = new Set(pending.flatMap(change => change.affectedTagIds || []));
    const affectedTimeline = new Set(pending.flatMap(change => change.affectedTimelineIds || []));
    const healthImpactCount = pending.filter(change => doesLoredeckPendingChangeAffectPackHealth(change)).length;
    if (affectedEntries.size) summary.appendChild(createStatusPill(`${affectedEntries.size} Lorecard${affectedEntries.size === 1 ? '' : 's'}`, 'Lorecards affected by pending proposals.'));
    if (affectedTags.size) summary.appendChild(createStatusPill(`${affectedTags.size} tag${affectedTags.size === 1 ? '' : 's'}`, 'Tags affected by pending proposals.'));
    if (affectedTimeline.size) summary.appendChild(createStatusPill(`${affectedTimeline.size} timeline`, 'Timeline anchors/windows affected by pending proposals.'));
    if (healthImpactCount) summary.appendChild(createStatusPill(`${healthImpactCount} health impact`, 'Pending proposals that will mark Deck Health stale when accepted because they change entries, tags, or timeline data.'));
    if (isLoredeckHealthStatusStale(pack)) {
        const stale = createLoredeckPendingHealthStalePill();
        if (stale) summary.appendChild(stale);
    }
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = isLoredeckHealthStatusStale(pack)
        ? 'Accepted changes have made the saved Deck Health status stale. Rerun validation before sharing or treating this Loredeck as clean.'
        : 'Pending changes do not affect runtime injection until accepted. This is the review path for manual edits, bulk edits, and Lore Assistant patches.';
    wrap.appendChild(help);

    const actions = createLoredeckActionRow();
    const acceptAll = createButton('Accept All', 'Apply every pending Loredeck change to this Custom Loredeck, then refresh Deck Health if accepted changes affect validation.', async (btn) => {
        const proceed = await confirmAction(
            'Accept all pending Loredeck changes?',
            `Apply all ${pending.length} pending Loredeck change${pending.length === 1 ? '' : 's'} to this Custom Loredeck?`
        );
        if (!proceed) return;
        createStateBackup('before_accept_loredeck_pending_changes', {
            label: `Before accepting ${pending.length} pending Loredeck change${pending.length === 1 ? '' : 's'}.`,
        });
        await runBusyAction(btn, 'Accepting...', async () => {
            await acceptLoredeckPendingChanges(pack, pending.map(change => change.changeId));
        });
    }, 'saga-primary-button');
    acceptAll.disabled = !pending.length;
    actions.appendChild(acceptAll);
    const rejectAll = createButton('Reject All', 'Discard every pending Loredeck change without applying it.', async () => {
        const proceed = await confirmAction(
            'Reject all pending Loredeck changes?',
            `Discard all ${pending.length} pending Loredeck change${pending.length === 1 ? '' : 's'} without applying them?`
        );
        if (!proceed) return;
        createStateBackup('before_reject_loredeck_pending_changes', {
            label: `Before rejecting ${pending.length} pending Loredeck change${pending.length === 1 ? '' : 's'}.`,
        });
        rejectLoredeckPendingChanges(pack);
    }, 'saga-danger-button');
    rejectAll.disabled = !pending.length;
    actions.appendChild(rejectAll);
    const validateButton = createButton('Validate Deck', 'Run Deck Health on the currently accepted Loredeck data. Pending proposals are not included until accepted.', async (btn) => {
        await validateLoredeckForEditor(pack, btn);
    });
    validateButton.disabled = !canValidateLoredeckInEditor(pack);
    actions.appendChild(validateButton);
    wrap.appendChild(actions);

    if (!pending.length) {
        wrap.appendChild(createEmptyMessage('No pending Loredeck edits.'));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const change of pending.slice(0, 20)) {
        list.appendChild(createLoredeckPendingChangeRow(pack, change));
    }
    if (pending.length > 20) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing 20 of ${pending.length} pending changes.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

export function createLoredeckPendingChangeRow(pack = {}, change = {}) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-entry-row saga-loredeck-pending-row';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = change.title || change.changeId || 'Pending Loredeck Change';
    main.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    const preview = change.preview || {};
    desc.textContent = change.description || preview.after || preview.before || 'Pending record patch.';
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(`Action: ${formatLoredeckPendingActionLabel(change.action)}`, `Pending change action: ${change.action || 'record_patch'}.`));
    meta.appendChild(createStatusPill(`Target: ${formatLoredeckPendingTargetKindLabel(change.targetKind)}`, `Pending change target kind: ${change.targetKind || 'loredeck'}.`));
    if (change.source) meta.appendChild(createStatusPill(`Source: ${formatLoredeckPendingSourceLabel(change.source)}`, getLoredeckPendingSourceTooltip(change.source)));
    const confidence = getLoredeckPendingConfidence(change);
    if (confidence !== null) meta.appendChild(createStatusPill(`Confidence ${Math.round(confidence * 100)}%`, 'Model or tool confidence for this pending proposal. Review remains required before acceptance.'));
    const risk = getLoredeckPendingRisk(change);
    if (risk) {
        const pill = createLoredeckPendingRiskPill(risk);
        if (pill) meta.appendChild(pill);
    }
    appendLoredeckPendingQualityPills(meta, change);
    if (doesLoredeckPendingChangeAffectPackHealth(change)) {
        const pill = createLoredeckPendingHealthImpactPill();
        if (pill) meta.appendChild(pill);
    }
    if (change.affectedEntryIds?.length) meta.appendChild(createStatusPill(`${change.affectedEntryIds.length} entr${change.affectedEntryIds.length === 1 ? 'y' : 'ies'}`, change.affectedEntryIds.slice(0, 10).join(', ')));
    if (change.affectedTagIds?.length) meta.appendChild(createStatusPill(`${change.affectedTagIds.length} tag${change.affectedTagIds.length === 1 ? '' : 's'}`, change.affectedTagIds.slice(0, 10).join(', ')));
    if (change.affectedTimelineIds?.length) meta.appendChild(createStatusPill(`${change.affectedTimelineIds.length} timeline`, change.affectedTimelineIds.slice(0, 10).join(', ')));
    if (change.createdAt) meta.appendChild(createStatusPill(new Date(change.createdAt).toLocaleString(), 'Created at.'));
    main.appendChild(meta);
    const diffs = createLoredeckPendingDiffList(pack, change);
    if (diffs) main.appendChild(diffs);
    const quality = createLoredeckPendingQualityList(change);
    if (quality) main.appendChild(quality);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    actions.appendChild(createButton('Accept', 'Apply this pending Loredeck change, then refresh Deck Health if it affects validation.', async (btn) => {
        await runBusyAction(btn, 'Accepting...', async () => {
            await acceptLoredeckPendingChanges(pack, [change.changeId]);
        });
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reject', 'Discard this pending Loredeck change.', () => {
        rejectLoredeckPendingChanges(pack, [change.changeId]);
    }, 'saga-danger-button'));
    row.appendChild(actions);
    return row;
}
