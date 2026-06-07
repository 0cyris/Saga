import {
    addTooltip,
    confirmAction,
    createButton,
    createEmptyMessage,
    createStatusPill,
    humanizeScopeKey,
    toast,
} from './runtime-ui-kit.js';

let contextPanelDeps = {};

export function configureContextPanel(deps = {}) {
    contextPanelDeps = { ...contextPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = contextPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Context Panel dependency is not configured: ${name}`);
}

function getContextWorkbenchStack(state) { return dep('getContextWorkbenchStack', () => [])(state); }
function getLoredeckContext(state, packId) { return dep('getLoredeckContext', () => ({}))(state, packId); }
function getLoredeckDisplayName(packId) { return dep('getLoredeckDisplayName', packId => String(packId || 'Loredeck'))(packId); }
function getContextTypeLabel(value) { return dep('getContextTypeLabel', value => String(value || 'Custom'))(value); }
function formatContextSource(value) { return dep('formatContextSource', value => String(value || 'Unknown'))(value); }
function formatLoredeckContextUpdatedAt(context) { return dep('formatLoredeckContextUpdatedAt', () => 'Never')(context); }
function formatContextSummary(context) { return dep('formatContextSummary', () => 'No Context set.')(context); }
function getContextAutomationModeLabel(mode) { return dep('getContextAutomationModeLabel', mode => String(mode || 'Manual'))(mode); }
function getContextResolutionProposals(state) { return dep('getContextResolutionProposals', () => [])(state); }
function openContextWorkbenchForPack(packId, tab) { return dep('openContextWorkbenchForPack', () => null)(packId, tab); }
function toggleLoredeckContextManualLock(packId, locked) { return dep('toggleLoredeckContextManualLock', () => null)(packId, locked); }
function seedLoredeckContextFromRuntimeContext(packId, context) { return dep('seedLoredeckContextFromRuntimeContext', () => null)(packId, context); }
function resetLoredeckContextFromPanel(packId) { return dep('resetLoredeckContextFromPanel', async () => null)(packId); }
function openContextProposalReview() { return dep('openContextProposalReview', () => null)(); }
function applyContextResolutionProposalSet(proposals, options) { return dep('applyContextResolutionProposalSet', () => 0)(proposals, options); }
function dismissContextResolutionProposalSet(proposals, options) { return dep('dismissContextResolutionProposalSet', () => 0)(proposals, options); }

export function createLoredeckContextCard(state = {}, contextIndex = null) {
    const stack = getContextWorkbenchStack(state);
    const card = document.createElement('div');
    card.className = 'wandlight-runtime-card wandlight-loredeck-context-card';

    const header = document.createElement('div');
    header.className = 'wandlight-context-section-header';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Loaded Loredeck Contexts';
    addTooltip(title, 'Current story position for each enabled Loredeck in the active stack.');
    header.appendChild(title);

    const indexMeta = document.createElement('div');
    indexMeta.className = 'wandlight-context-index-summary';
    indexMeta.appendChild(createStatusPill(formatContextIndexSummary(contextIndex), 'Context timeline registry status for the enabled Loredeck stack.'));
    if (contextIndex?.summary?.issueCount) {
        indexMeta.appendChild(createStatusPill(`${contextIndex.summary.issueCount} index issue${contextIndex.summary.issueCount === 1 ? '' : 's'}`, 'Timeline registry load warnings or suggestions.'));
    }
    header.appendChild(indexMeta);
    card.appendChild(header);

    if (!stack.length) {
        card.appendChild(createEmptyMessage('No enabled Loredecks need active Context.'));
        return card;
    }

    const list = document.createElement('div');
    list.className = 'wandlight-loredeck-context-list';
    for (const item of stack) {
        list.appendChild(createLoredeckContextRow(item, state, contextIndex));
    }
    card.appendChild(list);
    return card;
}

export function createContextResolutionAuditPanel(state = {}) {
    const audit = state?.lorePanel?.contextResolutionAudit || null;
    if (!audit || !audit.createdAt) return document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'wandlight-loredeck-context-quick wandlight-context-resolution-audit';

    const header = document.createElement('div');
    header.className = 'wandlight-loredeck-context-quick-header';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Last Resolver Check';
    addTooltip(title, 'Audit summary for the most recent local or Reasoner-backed Context resolver pass.');
    header.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(audit.status || 'unknown', 'Final resolver status for the latest check.'));
    if (audit.reason) chips.appendChild(createStatusPill(formatContextAuditReason(audit.reason), audit.message || audit.reason));
    if (audit.cached) chips.appendChild(createStatusPill('Cached', 'This result came from the repeated-check cache.'));
    if (audit.inFlight) chips.appendChild(createStatusPill('In flight skipped', 'Saga skipped a duplicate Context Reasoner request because one was already running.'));
    if (audit.counts?.localApplied) chips.appendChild(createStatusPill(`${audit.counts.localApplied} local applied`, 'High-confidence local Context updates applied to unlocked Loredecks.'));
    if (audit.counts?.proposed) chips.appendChild(createStatusPill(`${audit.counts.proposed} proposed`, 'Bounded Reasoner proposals waiting for review.'));
    if (audit.counts?.skipped && !audit.counts?.skippedLocked && !audit.counts?.skippedLowConfidence) chips.appendChild(createStatusPill(`${audit.counts.skipped} skipped`, 'Resolver or automation skipped one or more Context targets.'));
    if (audit.counts?.skippedLocked) chips.appendChild(createStatusPill(`${audit.counts.skippedLocked} locked`, 'Loredecks skipped because manual lock is enabled.'));
    if (audit.counts?.skippedLowConfidence) chips.appendChild(createStatusPill(`${audit.counts.skippedLowConfidence} low confidence`, 'Local or model results left unresolved because confidence was too low.'));
    if (audit.counts?.unresolved) chips.appendChild(createStatusPill(`${audit.counts.unresolved} unresolved`, 'Loredecks that still need clearer Context or manual selection.'));
    chips.appendChild(createStatusPill(new Date(audit.createdAt).toLocaleTimeString(), 'When this resolver check completed.'));
    header.appendChild(chips);
    wrap.appendChild(header);

    return wrap;
}

function formatContextAuditReason(reason = '') {
    const normalized = String(reason || '').trim().toLowerCase();
    const labels = {
        context_manual_mode: 'Manual mode',
        context_cadence_not_reached: 'Cadence waiting',
        max_turn_cadence: 'Max cadence',
        turn_and_text_cadence: 'Cadence ready',
        context_no_loaded_loredecks: 'No loaded decks',
        context_all_loredecks_locked: 'All locked',
        context_provider_not_configured: 'Provider missing',
        context_reasoner_fallback_disabled: 'Reasoner disabled',
        context_model_resolution_in_flight: 'Already running',
        manual_lock: 'Manual lock',
        local_low_confidence: 'Low confidence',
        model_low_confidence: 'Low confidence',
    };
    return labels[normalized] || humanizeScopeKey(normalized || 'unknown');
}

export function createContextAutomationAuditPanel(state = {}) {
    const audit = state?.lorePanel?.contextAutomationAudit || null;
    if (!audit || !audit.createdAt) return document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'wandlight-loredeck-context-quick wandlight-context-automation-audit';

    const header = document.createElement('div');
    header.className = 'wandlight-loredeck-context-quick-header';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Last Automation Check';
    addTooltip(title, 'Audit summary for the most recent background Context automation decision, including skipped cadence/provider/lock states.');
    header.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(audit.status || 'unknown', audit.message || 'Latest Context automation status.'));
    if (audit.reason) chips.appendChild(createStatusPill(formatContextAuditReason(audit.reason), audit.message || audit.reason));
    if (audit.mode) chips.appendChild(createStatusPill(getContextAutomationModeLabel(audit.mode), 'Context automation mode used for this decision.'));
    if (audit.cadence) {
        chips.appendChild(createStatusPill(`${audit.cadence.turns || 0}/${audit.cadence.minTurns || 0} turns`, 'Completed model turns since the last automatic Context check.'));
        chips.appendChild(createStatusPill(`${audit.cadence.newChars || 0}/${audit.cadence.characterThreshold || 0} chars`, 'New story characters since the last automatic Context check baseline.'));
    }
    if (audit.providerError) chips.appendChild(createStatusPill('Provider issue', audit.providerError));
    chips.appendChild(createStatusPill(new Date(audit.createdAt).toLocaleTimeString(), 'When this automation decision was recorded.'));
    header.appendChild(chips);
    wrap.appendChild(header);

    if (audit.message) {
        const message = document.createElement('div');
        message.className = 'wandlight-runtime-help';
        message.textContent = audit.message;
        wrap.appendChild(message);
    }

    return wrap;
}

export function createContextResolutionProposalPanel(state = {}) {
    const proposals = getContextResolutionProposals(state);
    if (!proposals.length) return document.createDocumentFragment();
    const wrap = document.createElement('div');
    wrap.className = 'wandlight-loredeck-context-quick';
    wrap.dataset.sagaContextProposals = 'true';

    const header = document.createElement('div');
    header.className = 'wandlight-loredeck-context-quick-header';
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = 'Reasoner Proposals';
    addTooltip(title, 'Reasoner-backed Context proposals are bounded to known timeline candidates and require review before application.');
    header.appendChild(title);

    const meta = state?.lorePanel?.contextResolutionProposalMeta || {};
    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(`${proposals.length} proposal${proposals.length === 1 ? '' : 's'}`, 'Pending Context proposals from the Reasoning Provider.'));
    if (meta.createdAt) chips.appendChild(createStatusPill(`Drafted ${new Date(meta.createdAt).toLocaleTimeString()}`, 'When these Context proposals were drafted.'));
    header.appendChild(chips);
    wrap.appendChild(header);

    const list = document.createElement('div');
    list.className = 'wandlight-context-workbench-mini-list';
    for (const proposal of proposals.slice(0, 6)) {
        const item = document.createElement('div');
        item.className = 'wandlight-context-workbench-mini-item';
        const label = document.createElement('strong');
        label.textContent = `${getLoredeckDisplayName(proposal.packId)}: ${proposal.label || proposal.candidateId || 'Context proposal'}`;
        item.appendChild(label);
        const detail = document.createElement('span');
        const confidence = Number.isFinite(Number(proposal.confidence)) ? ` (${Math.round(Number(proposal.confidence) * 100)}%)` : '';
        detail.textContent = `${proposal.summary || 'Reasoner selected a bounded timeline candidate.'}${confidence}`;
        item.appendChild(detail);
        list.appendChild(item);
    }
    if (proposals.length > 6) {
        const more = document.createElement('div');
        more.className = 'wandlight-runtime-help wandlight-compact-help';
        more.textContent = `Showing 6 of ${proposals.length} proposals.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions';
    actions.appendChild(createButton('Open Review', 'Open the fullscreen Context proposal review window.', () => {
        openContextProposalReview();
    }, 'wandlight-primary-button'));
    actions.appendChild(createButton('Apply Proposals', 'Apply every listed Context proposal to its loaded Loredeck Context.', async () => {
        const ok = await confirmAction('Apply Context proposals?', `Apply ${proposals.length} Reasoner Context proposal${proposals.length === 1 ? '' : 's'}?`);
        if (!ok) return;
        const applied = applyContextResolutionProposalSet(proposals, {
            clearAll: true,
            snapshotLabel: `Apply ${proposals.length} Context proposal${proposals.length === 1 ? '' : 's'}`,
        });
        toast(`Applied ${applied} Context proposal${applied === 1 ? '' : 's'}.`, 'success');
    }));
    actions.appendChild(createButton('Dismiss', 'Discard these Context proposals without changing loaded Loredeck Contexts.', () => {
        dismissContextResolutionProposalSet(proposals, { clearAll: true });
        toast('Context proposals dismissed.', 'info');
    }));
    wrap.appendChild(actions);
    return wrap;
}

function createLoredeckContextRow(item, state = {}, contextIndex = null) {
    const packId = item.packId;
    const context = getLoredeckContext(state, packId);
    const packIndex = getContextPackSummary(contextIndex, packId);
    const row = document.createElement('div');
    row.className = 'wandlight-loredeck-context-row';

    const header = document.createElement('div');
    header.className = 'wandlight-loredeck-context-header';
    const title = document.createElement('div');
    title.className = 'wandlight-loredeck-row-title';
    title.textContent = getLoredeckDisplayName(packId);
    header.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(getContextTypeLabel(context.contextType), 'Context mode for this Loredeck.'));
    chips.appendChild(createStatusPill(formatContextSource(context.source), 'How this Context was last set.'));
    chips.appendChild(createStatusPill(context.manualLock ? 'Locked' : 'Unlocked', 'Locked Contexts should not be overwritten by automatic resolvers.'));
    chips.appendChild(createStatusPill(`${Math.round((Number(context.confidence) || 0) * 100)}%`, 'Resolver confidence. Manual choices default to high confidence.'));
    chips.appendChild(createStatusPill(`Updated: ${formatLoredeckContextUpdatedAt(context)}`, 'When this Loredeck Context was last updated.'));
    if (packIndex?.hasIndex) {
        chips.appendChild(createStatusPill(`${packIndex.anchorCount || 0}/${packIndex.windowCount || 0}`, 'Timeline anchors/windows available from this Loredeck registry.'));
    } else {
        chips.appendChild(createStatusPill(contextIndex ? 'No index' : 'Index loading', 'This Loredeck has no loaded timeline registry yet.'));
    }
    header.appendChild(chips);
    row.appendChild(header);

    const summary = document.createElement('div');
    summary.className = 'wandlight-loredeck-context-summary';
    summary.textContent = formatContextSummary(context);
    row.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions wandlight-loredeck-context-actions';
    actions.appendChild(createButton('Browse', 'Open this Loredeck in the fullscreen Context Browser.', () => {
        openContextWorkbenchForPack(packId, 'context');
    }, 'wandlight-primary-button'));
    actions.appendChild(createButton(context.manualLock ? 'Unlock' : 'Lock', context.manualLock ? 'Allow automatic Context resolvers to update this Loredeck.' : 'Prevent automatic Context resolvers from overwriting this Loredeck.', () => {
        toggleLoredeckContextManualLock(packId, !context.manualLock);
    }));
    actions.appendChild(createButton('Seed From Brief', 'Seed this Loredeck Context from the advanced global Context Brief projection.', () => {
        seedLoredeckContextFromRuntimeContext(packId, context);
    }));
    actions.appendChild(createButton('Timeline', 'Open this Loredeck in the fullscreen Timeline registry view.', () => {
        openContextWorkbenchForPack(packId, 'timeline');
    }));
    actions.appendChild(createButton('Reset Context', 'Clear this Loredeck Context back to an empty default.', async () => {
        await resetLoredeckContextFromPanel(packId);
    }, 'wandlight-danger-button'));
    row.appendChild(actions);

    return row;
}

export function getContextPackSummary(contextIndex, packId) {
    const id = String(packId || '').trim();
    if (!id || !contextIndex?.packs?.length) return null;
    return contextIndex.packs.find(pack => pack.packId === id) || null;
}

export function formatContextIndexSummary(contextIndex) {
    const summary = contextIndex?.summary || null;
    if (!summary) return 'Loading';
    if (!summary.packCount) return 'No packs';
    if (!summary.indexCount) return `${summary.packCount} pack${summary.packCount === 1 ? '' : 's'}, no timelines`;
    return `${summary.anchorCount || 0} anchors, ${summary.windowCount || 0} windows`;
}
