/**
 * loredeck-assistant-review-panel.js - Saga
 * Runtime Loredeck Assistant card and draft review rendering.
 */

import {
    addTooltip,
    createButton,
    createStatusPill,
} from '../ui/runtime-ui-kit.js';
import {
    createLoredeckActionRow,
} from '../loredecks/loredeck-action-rows.js';

let assistantReviewDeps = {};

export function configureLoredeckAssistantReviewPanel(deps = {}) {
    assistantReviewDeps = { ...assistantReviewDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof assistantReviewDeps[name] === 'function' ? assistantReviewDeps[name] : fallback;
}

function getLoredeckAssistantInstruction() { return dep('getLoredeckAssistantInstruction', () => '')(); }
function setLoredeckAssistantInstruction(value = '') { return dep('setLoredeckAssistantInstruction')((value || '').trim()); }
function getLoredeckAssistantMode() { return dep('getLoredeckAssistantMode', () => 'revise_entries')(); }
function setLoredeckAssistantMode(value = '') { return dep('setLoredeckAssistantMode')(value || 'revise_entries'); }
function getLoredeckAssistantTargetScope() { return dep('getLoredeckAssistantTargetScope', () => 'current_filter')(); }
function setLoredeckAssistantTargetScope(value = '') { return dep('setLoredeckAssistantTargetScope')(value || 'current_filter'); }
function getLoredeckAssistantRevisionInstruction() { return dep('getLoredeckAssistantRevisionInstruction', () => '')(); }
function setLoredeckAssistantRevisionInstruction(value = '') { return dep('setLoredeckAssistantRevisionInstruction')((value || '').trim()); }
function getLoredeckAssistantTargetRows(rows = [], filteredRows = [], scope = '') { return dep('getLoredeckAssistantTargetRows', () => [])(rows, filteredRows, scope); }
function getLoredeckAssistantDraftCacheRecord(packId = '') { return dep('getLoredeckAssistantDraftCacheRecord', () => ({}))(packId); }
function getLoredeckAssistantDraftChanges(cached = {}) { return dep('getLoredeckAssistantDraftChanges', () => [])(cached); }
function getLoredeckAssistantSelectedDraftIds(cached = {}) { return dep('getLoredeckAssistantSelectedDraftIds', () => new Set())(cached); }
function countLoredeckAssistantQualityWarningsForChanges(changes = []) { return dep('countLoredeckAssistantQualityWarningsForChanges', () => 0)(changes); }
function humanizeScopeKey(value = '') { return dep('humanizeScopeKey', source => String(source || '').replace(/_/g, ' '))(value); }
function createNewLoreInput(container, label, tooltip, value, multiline, placeholder) { return dep('createNewLoreInput')(container, label, tooltip, value, multiline, placeholder); }
function createNewLoreSelect(container, label, values, selected, formatter) { return dep('createNewLoreSelect')(container, label, values, selected, formatter); }
function handleLoredeckAssistantDraft(pack, rows, filteredRows, options, button) { return dep('handleLoredeckAssistantDraft', async () => {})(pack, rows, filteredRows, options, button); }
function handleLoredeckAssistantDraftRevision(pack, rows, filteredRows, options, button) { return dep('handleLoredeckAssistantDraftRevision', async () => {})(pack, rows, filteredRows, options, button); }
function loadLoredeckEntriesForEditor(pack, button = null) { return dep('loadLoredeckEntriesForEditor', async () => {})(pack, button); }
function canValidateLoredeckInEditor(pack = {}) { return dep('canValidateLoredeckInEditor', () => false)(pack); }
function queueLoredeckAssistantDraftSelection(pack, selectedIds = new Set()) { return dep('queueLoredeckAssistantDraftSelection', () => false)(pack, selectedIds); }
function dropLoredeckAssistantDraftSelection(pack, selectedIds = new Set()) { return dep('dropLoredeckAssistantDraftSelection', () => false)(pack, selectedIds); }
function setLoredeckAssistantDraftSelectionBulk(pack, mode = 'all') { return dep('setLoredeckAssistantDraftSelectionBulk')(pack, mode); }
function setLoredeckAssistantDraftSelection(pack, changeId = '', selected = false, options = {}) { return dep('setLoredeckAssistantDraftSelection')(pack, changeId, selected, options); }
function openLoredeckAssistantDraftJsonEditor(pack, change = {}) { return dep('openLoredeckAssistantDraftJsonEditor')(pack, change); }
function formatLoredeckPendingActionLabel(action = '') { return dep('formatLoredeckPendingActionLabel', value => String(value || 'Record Patch'))(action); }
function formatLoredeckPendingTargetKindLabel(targetKind = '') { return dep('formatLoredeckPendingTargetKindLabel', value => String(value || 'Loredeck'))(targetKind); }
function getLoredeckPendingConfidence(change = {}) { return dep('getLoredeckPendingConfidence', () => null)(change); }
function getLoredeckPendingRisk(change = {}) { return dep('getLoredeckPendingRisk', () => '')(change); }
function createLoredeckPendingRiskPill(risk = '') { return dep('createLoredeckPendingRiskPill', () => null)(risk); }
function appendLoredeckPendingQualityPills(meta, change = {}) { return dep('appendLoredeckPendingQualityPills')(meta, change); }
function doesLoredeckPendingChangeAffectPackHealth(change = {}) { return dep('doesLoredeckPendingChangeAffectPackHealth', () => false)(change); }
function createLoredeckPendingHealthImpactPill() { return dep('createLoredeckPendingHealthImpactPill', () => null)(); }
function createLoredeckPendingDiffList(pack = {}, change = {}) { return dep('createLoredeckPendingDiffList', () => null)(pack, change); }
function createLoredeckPendingQualityList(change = {}) { return dep('createLoredeckPendingQualityList', () => null)(change); }

export function createLoredeckAssistantCard(pack = {}, rows = [], filteredRows = []) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview saga-loredeck-assistant-card';
    wrap.dataset.sagaAssistantPackId = pack.packId;

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Lore Assistant';
    wrap.appendChild(title);

    const targetScope = getLoredeckAssistantTargetScope();
    const targetRows = getLoredeckAssistantTargetRows(rows, filteredRows, targetScope).filter(row => row?.id && !row.disabled);
    const cached = getLoredeckAssistantDraftCacheRecord(pack.packId);
    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${targetRows.length} target entr${targetRows.length === 1 ? 'y' : 'ies'}`, 'Entries included in the assistant context. Current search can narrow this set.', { kind: 'count' }));
    summary.appendChild(createStatusPill(String(getLoredeckAssistantMode() || 'revise_entries').replace(/_/g, ' '), 'Current assistant task mode.', { tone: 'source', kind: 'status' }));
    summary.appendChild(createStatusPill('Value rubric', 'Assistant proposals are asked to score scene utility, behavior impact, Context fit, injection quality, and wiki-summary risk.', { tone: 'info', kind: 'metadata' }));
    if (cached?.draftChanges?.length) {
        const selectedCount = getLoredeckAssistantSelectedDraftIds(cached).size;
        summary.appendChild(createStatusPill(`${cached.draftChanges.length} drafted`, 'Assistant proposals waiting for batch review before they enter Pending Review.', { tone: 'review', kind: 'count' }));
        const selectedPill = createStatusPill(`${selectedCount} selected`, 'Draft proposals selected for queue, drop, or revision actions.', { tone: selectedCount ? 'selected' : 'muted', kind: 'count' });
        selectedPill.classList.add('saga-loredeck-assistant-selected-count');
        summary.appendChild(selectedPill);
    }
    if (cached?.queuedCount) summary.appendChild(createStatusPill(`${cached.queuedCount} queued`, 'Last assistant proposal count queued into Pending Review.', { tone: 'review', kind: 'count' }));
    if (cached?.selectedHealthIssueCount) summary.appendChild(createStatusPill(`${cached.selectedHealthIssueCount} health issue${cached.selectedHealthIssueCount === 1 ? '' : 's'}`, 'Last assistant draft was generated from selected Pack Health issues.', { tone: 'warning', kind: 'severity' }));
    if (cached?.repairBatchCount) summary.appendChild(createStatusPill(`${cached.repairBatchCount} repair batch${cached.repairBatchCount === 1 ? '' : 'es'}`, 'Last Pack Health repair draft was split into bounded assistant calls.', { tone: 'info', kind: 'count' }));
    if (cached?.qualityWarningCount) summary.appendChild(createStatusPill(`${cached.qualityWarningCount} quality flag${cached.qualityWarningCount === 1 ? '' : 's'}`, 'Last assistant draft included local quality guardrail flags.', { tone: 'warning', kind: 'severity' }));
    if (cached?.questions?.length) summary.appendChild(createStatusPill(`${cached.questions.length} question${cached.questions.length === 1 ? '' : 's'}`, 'Last assistant response requested clarification.', { tone: 'review', kind: 'count' }));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'The assistant drafts reviewable proposals only. Accepted Loredeck data changes after you accept the queued Pending Review items.';
    wrap.appendChild(help);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form';
    const instructionInput = createNewLoreInput(form, 'Instruction', 'Describe the revision, missing lore, tag definitions, or timeline anchors/windows you want proposed.', getLoredeckAssistantInstruction() || '', true, 'Revise Arlong and crew entries so their cruelty creates more pressure and danger without turning every line into generic villain biography.');
    const grid = document.createElement('div');
    grid.className = 'saga-new-lore-meta-grid';
    form.appendChild(grid);
    const modeSelect = createNewLoreSelect(grid, 'Mode', ['revise_entries', 'suggest_entries', 'draft_tags', 'draft_timeline', 'mixed'], getLoredeckAssistantMode(), value => humanizeScopeKey(value));
    const scopeSelect = createNewLoreSelect(grid, 'Target', ['current_filter', 'all_loaded'], getLoredeckAssistantTargetScope(), value => value === 'current_filter' ? 'Current Search' : 'All Loaded');
    wrap.appendChild(form);

    const actions = createLoredeckActionRow();
    const draftButton = createButton('Draft Proposals', 'Ask the Reasoning Provider to draft structured Loredeck changes for batch review before they enter Pending Review.', async (btn) => {
        setLoredeckAssistantInstruction(instructionInput.value);
        setLoredeckAssistantMode(modeSelect.value);
        setLoredeckAssistantTargetScope(scopeSelect.value);
        await handleLoredeckAssistantDraft(pack, rows, filteredRows, {
            instruction: getLoredeckAssistantInstruction(),
            mode: getLoredeckAssistantMode(),
            targetScope: getLoredeckAssistantTargetScope(),
        }, btn);
    }, 'saga-primary-button');
    actions.appendChild(draftButton);
    const loadButton = createButton('Load Context', 'Load entries, tags, and timeline registries so the assistant has current context.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
    });
    loadButton.disabled = !canValidateLoredeckInEditor(pack);
    actions.appendChild(loadButton);
    wrap.appendChild(actions);

    if (cached?.summary || cached?.questions?.length || cached?.warnings?.length) {
        const result = document.createElement('div');
        result.className = 'saga-runtime-help';
        const parts = [];
        if (cached.summary) parts.push(cached.summary);
        if (cached.questions?.length) parts.push(`Questions: ${cached.questions.join(' | ')}`);
        if (cached.warnings?.length) parts.push(`Warnings: ${cached.warnings.join(' | ')}`);
        result.textContent = parts.join(' ');
        wrap.appendChild(result);
    }

    const draftBatch = createLoredeckAssistantDraftBatchCard(pack, cached, rows, filteredRows);
    if (draftBatch) wrap.appendChild(draftBatch);

    return wrap;
}

export function createLoredeckAssistantDraftBatchCard(pack = {}, cached = null, rows = [], filteredRows = []) {
    const changes = getLoredeckAssistantDraftChanges(cached);
    if (!changes.length) return null;
    const selectedIds = getLoredeckAssistantSelectedDraftIds(cached);
    const selectedCount = changes.filter(change => selectedIds.has(change.changeId)).length;
    const creatorBatch = String(cached?.source || '').trim() === 'loredeck_creator'
        || changes.every(change => String(change.source || '').trim() === 'loredeck_creator');
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview saga-loredeck-assistant-draft-batch';
    wrap.dataset.sagaAssistantPackId = pack.packId;

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = creatorBatch ? 'Creator Lorecard Draft Review' : 'Assistant Draft Batch';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${changes.length} drafted`, creatorBatch ? 'Creator Lorecard drafts waiting for edit-before-review.' : 'Draft proposals waiting for edit-before-queue review.', { tone: 'review', kind: 'count' }));
    const selectedPill = createStatusPill(`${selectedCount} selected`, creatorBatch ? 'Selected drafts are affected by send, drop, and revise actions.' : 'Selected proposals are affected by queue, drop, and revise actions.', { tone: selectedCount ? 'selected' : 'muted', kind: 'count' });
    selectedPill.classList.add('saga-loredeck-assistant-draft-selected-count');
    summary.appendChild(selectedPill);
    const qualityWarningCount = countLoredeckAssistantQualityWarningsForChanges(changes);
    if (qualityWarningCount) summary.appendChild(createStatusPill(`${qualityWarningCount} quality flag${qualityWarningCount === 1 ? '' : 's'}`, 'Local guardrail flags across this assistant draft batch.', { tone: 'warning', kind: 'severity' }));
    wrap.appendChild(summary);

    const actions = createLoredeckActionRow();
    const queueSelected = createButton(creatorBatch ? 'Send Selected to Review' : 'Queue Selected', creatorBatch ? 'Move selected Creator Lorecard drafts into Pending Review.' : 'Move selected assistant draft proposals into Pending Review.', () => {
        queueLoredeckAssistantDraftSelection(pack, getLoredeckAssistantSelectedDraftIds(getLoredeckAssistantDraftCacheRecord(pack.packId)));
    }, 'saga-primary-button');
    queueSelected.dataset.sagaAssistantDraftAction = 'queue-selected';
    queueSelected.disabled = !selectedCount;
    actions.appendChild(queueSelected);
    const queueAll = createButton(creatorBatch ? 'Send All to Review' : 'Queue All', creatorBatch ? 'Move every Creator Lorecard draft into Pending Review.' : 'Move every assistant draft proposal into Pending Review.', () => {
        queueLoredeckAssistantDraftSelection(pack, new Set(changes.map(change => change.changeId)));
    });
    queueAll.disabled = !changes.length;
    actions.appendChild(queueAll);
    const dropSelected = createButton('Drop Selected', creatorBatch ? 'Remove selected Creator Lorecard drafts without sending them to Pending Review.' : 'Remove selected assistant draft proposals without queueing them.', () => {
        dropLoredeckAssistantDraftSelection(pack, getLoredeckAssistantSelectedDraftIds(getLoredeckAssistantDraftCacheRecord(pack.packId)));
    }, 'saga-danger-button');
    dropSelected.dataset.sagaAssistantDraftAction = 'drop-selected';
    dropSelected.disabled = !selectedCount;
    actions.appendChild(dropSelected);
    const selectAll = createButton('Select All', creatorBatch ? 'Select every Creator Lorecard draft.' : 'Select every assistant draft proposal.', () => {
        setLoredeckAssistantDraftSelectionBulk(pack, 'all');
    });
    selectAll.dataset.sagaAssistantDraftAction = 'select-all';
    selectAll.disabled = selectedCount >= changes.length;
    actions.appendChild(selectAll);
    const clearSelection = createButton('Clear Selection', creatorBatch ? 'Clear the Creator draft selection.' : 'Clear the assistant draft selection.', () => {
        setLoredeckAssistantDraftSelectionBulk(pack, 'none');
    });
    clearSelection.dataset.sagaAssistantDraftAction = 'clear-selection';
    clearSelection.disabled = !selectedCount;
    actions.appendChild(clearSelection);
    wrap.appendChild(actions);

    const reviseForm = document.createElement('div');
    reviseForm.className = 'saga-new-lore-form saga-loredeck-assistant-revise-form';
    const reviseInput = createNewLoreInput(reviseForm, 'Revision', creatorBatch ? 'Instruction for revising selected Creator Lorecard drafts before sending them to Pending Review.' : 'Instruction for revising selected draft proposals before queueing them.', getLoredeckAssistantRevisionInstruction() || '', true, 'Tighten selected entries so the injection text creates more pressure and less biography.');
    const reviseActions = createLoredeckActionRow();
    const reviseButton = createButton('Revise Selected', creatorBatch ? 'Ask the Reasoning Provider to revise only the selected Creator Lorecard drafts.' : 'Ask the Reasoning Provider to revise only the selected assistant draft proposals.', async (btn) => {
        setLoredeckAssistantRevisionInstruction(reviseInput.value);
        await handleLoredeckAssistantDraftRevision(pack, rows, filteredRows, {
            instruction: getLoredeckAssistantRevisionInstruction(),
        }, btn);
    });
    reviseButton.dataset.sagaAssistantDraftAction = 'revise-selected';
    reviseButton.disabled = !selectedCount;
    reviseActions.appendChild(reviseButton);
    reviseForm.appendChild(reviseActions);
    wrap.appendChild(reviseForm);

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list saga-loredeck-assistant-draft-list';
    for (const change of changes.slice(0, 30)) {
        list.appendChild(createLoredeckAssistantDraftRow(pack, change, selectedIds.has(change.changeId), { creatorBatch }));
    }
    if (changes.length > 30) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = creatorBatch
            ? `Showing 30 of ${changes.length} Creator Lorecard drafts. Send or drop some to reduce the list.`
            : `Showing 30 of ${changes.length} draft proposals. Queue or drop some to reduce the list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

export function createLoredeckAssistantDraftRow(pack = {}, change = {}, selected = false, options = {}) {
    const creatorDraft = options.creatorBatch || String(change.source || '').trim() === 'loredeck_creator';
    const row = document.createElement('div');
    row.className = 'saga-loredeck-entry-row saga-loredeck-assistant-draft-row';
    row.classList.toggle('saga-loredeck-assistant-draft-row-selected', selected);
    row.dataset.sagaAssistantDraftChangeId = change.changeId || '';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const titleLine = document.createElement('label');
    titleLine.className = 'saga-loredeck-assistant-draft-title';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    addTooltip(checkbox, selected ? 'Remove this draft proposal from the current batch selection.' : 'Add this draft proposal to the current batch selection.');
    checkbox.addEventListener('click', event => event.stopPropagation());
    checkbox.addEventListener('change', () => {
        setLoredeckAssistantDraftSelection(pack, change.changeId, checkbox.checked, { refresh: true });
    });
    titleLine.appendChild(checkbox);
    const title = document.createElement('span');
    title.className = 'saga-loredeck-row-title';
    title.textContent = change.title || change.changeId || 'Assistant Draft Proposal';
    titleLine.appendChild(title);
    main.appendChild(titleLine);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    const preview = change.preview || {};
    desc.textContent = change.description || preview.after || preview.before || (creatorDraft ? 'Creator Lorecard draft.' : 'Assistant draft proposal.');
    main.appendChild(desc);
    const creatorRepairWarnings = creatorDraft && Array.isArray(preview.creatorEntryBatch?.repairWarnings)
        ? preview.creatorEntryBatch.repairWarnings.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4)
        : [];
    if (creatorRepairWarnings.length) {
        const repairNote = document.createElement('div');
        repairNote.className = 'saga-runtime-help saga-loredeck-creator-review-note';
        repairNote.textContent = `Creator repair note: ${creatorRepairWarnings.join(' ')}`;
        main.appendChild(repairNote);
    }
    const creatorPreflightWarnings = creatorDraft && Array.isArray(preview.creatorEntryBatch?.preflightWarnings)
        ? preview.creatorEntryBatch.preflightWarnings.map(item => String(item || '').trim()).filter(Boolean).slice(0, 4)
        : [];
    if (creatorPreflightWarnings.length) {
        const preflightNote = document.createElement('div');
        preflightNote.className = 'saga-runtime-help saga-loredeck-creator-review-note';
        preflightNote.textContent = `Creator preflight note: ${creatorPreflightWarnings.join(' ')}`;
        main.appendChild(preflightNote);
    }

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(`Action: ${formatLoredeckPendingActionLabel(change.action)}`, `Draft action: ${change.action || 'record_patch'}.`, { tone: 'source', kind: 'source', maxChars: 34 }));
    meta.appendChild(createStatusPill(`Target: ${formatLoredeckPendingTargetKindLabel(change.targetKind)}`, `Draft target kind: ${change.targetKind || 'loredeck'}.`, { tone: 'category', kind: 'metadata', maxChars: 34 }));
    const confidence = getLoredeckPendingConfidence(change);
    if (confidence !== null) meta.appendChild(createStatusPill(`Confidence ${Math.round(confidence * 100)}%`, 'Model confidence for this draft proposal.', { tone: confidence >= 0.8 ? 'success' : (confidence >= 0.55 ? 'info' : 'warning'), kind: 'metadata' }));
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
    if (change.affectedEntryIds?.length) meta.appendChild(createStatusPill(`${change.affectedEntryIds.length} entr${change.affectedEntryIds.length === 1 ? 'y' : 'ies'}`, change.affectedEntryIds.slice(0, 10).join(', '), { kind: 'count' }));
    if (change.affectedTagIds?.length) meta.appendChild(createStatusPill(`${change.affectedTagIds.length} tag${change.affectedTagIds.length === 1 ? '' : 's'}`, change.affectedTagIds.slice(0, 10).join(', '), { tone: 'tag', kind: 'tag' }));
    if (change.affectedTimelineIds?.length) meta.appendChild(createStatusPill(`${change.affectedTimelineIds.length} timeline`, change.affectedTimelineIds.slice(0, 10).join(', '), { tone: 'source', kind: 'count' }));
    main.appendChild(meta);

    const diffs = createLoredeckPendingDiffList(pack, change);
    if (diffs) main.appendChild(diffs);
    const quality = createLoredeckPendingQualityList(change);
    if (quality) main.appendChild(quality);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    actions.appendChild(createButton(creatorDraft ? 'Send to Review' : 'Queue', creatorDraft ? 'Move this Creator Lorecard draft into Pending Review.' : 'Move this assistant draft proposal into Pending Review.', () => {
        queueLoredeckAssistantDraftSelection(pack, new Set([change.changeId]));
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Edit JSON', creatorDraft ? 'Edit this Creator Lorecard draft record before sending it to Pending Review.' : 'Edit this draft proposal record before queueing.', () => {
        openLoredeckAssistantDraftJsonEditor(pack, change);
    }));
    actions.appendChild(createButton('Drop', creatorDraft ? 'Remove this Creator Lorecard draft without sending it to Pending Review.' : 'Remove this draft proposal without queueing it.', () => {
        dropLoredeckAssistantDraftSelection(pack, new Set([change.changeId]));
    }, 'saga-danger-button'));
    row.appendChild(actions);
    return row;
}
