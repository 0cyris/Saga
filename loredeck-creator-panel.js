import {
    addTooltip,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
    isPlainObjectValue,
    toast,
    wireOverlayBackdropClose,
} from './runtime-ui-kit.js';

let creatorPanelDeps = {};
let loredeckCreatorWorkbenchRefreshQueued = false;

export function configureLoredeckCreatorPanel(deps = {}) {
    creatorPanelDeps = { ...creatorPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = creatorPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Loredeck Creator dependency is not configured: ${name}`);
}

function getState() { return dep('getState', () => ({}))(); }
function getLoredeckCreatorBriefCache() { return dep('getLoredeckCreatorBriefCache', () => ({}))(); }
function getLoredeckCreatorPipelineModel(cached) { return dep('getLoredeckCreatorPipelineModel', () => ({}))(cached); }
function createLoredeckCreatorCard(state, options) { return dep('createLoredeckCreatorCard', () => document.createDocumentFragment())(state, options); }
function recoverLoredeckCreatorCurrentActiveGenerationOnOpen(options) { return dep('recoverLoredeckCreatorCurrentActiveGenerationOnOpen', () => null)(options); }
function cancelLoredeckCreatorGeneration(generationId) { return dep('cancelLoredeckCreatorGeneration', () => false)(generationId); }
function getLoredeckCreatorDraftInputs() { return dep('getLoredeckCreatorDraftInputs', () => ({}))(); }
function formatLoredeckCreatorGranularity(value) { return dep('formatLoredeckCreatorGranularity', value => String(value || 'Focused'))(value); }
function createLoredeckCreatorCurrentTaskActions(cached, pipeline, context) { return dep('createLoredeckCreatorCurrentTaskActions', () => document.createDocumentFragment())(cached, pipeline, context); }
function getLoredeckCreatorLatestRecoverableUnit(cached) { return dep('getLoredeckCreatorLatestRecoverableUnit', () => null)(cached); }
function formatLoredeckCreatorRecoveryStageLabel(unit) { return dep('formatLoredeckCreatorRecoveryStageLabel', () => 'Creator generation unit')(unit); }
function formatRelativeHealthTime(value) { return dep('formatRelativeHealthTime', value => value ? new Date(value).toLocaleString() : '-')(value); }
function createLoredeckCreatorBriefRevisionForm(brief, cached) { return dep('createLoredeckCreatorBriefRevisionForm', () => document.createDocumentFragment())(brief, cached); }
function createLoredeckCreatorOutlineActionForm(brief, cached, outline) { return dep('createLoredeckCreatorOutlineActionForm', () => document.createDocumentFragment())(brief, cached, outline); }
function getLoredeckCreatorSelectedTitleIds(cached) { return dep('getLoredeckCreatorSelectedTitleIds', () => new Set())(cached); }
function getLoredeckCreatorApprovedTitleIds(cached) { return dep('getLoredeckCreatorApprovedTitleIds', () => new Set())(cached); }
function getLoredeckCreatorGenerationSettings(cached) { return dep('getLoredeckCreatorGenerationSettings', () => ({}))(cached); }
function lockLoredeckCreatorGenerationButton(button, cached, label) { return dep('applyLoredeckCreatorGenerationButtonLock', button => button)(button, cached, label); }
function handleLoredeckCreatorTitleDraft(options, button) { return dep('handleLoredeckCreatorTitleDraft', async () => null)(options, button); }
function handleLoredeckCreatorRemainingTitleBatches(button) { return dep('handleLoredeckCreatorRemainingTitleBatches', async () => null)(button); }
function approveLoredeckCreatorTitleSelection(selectedIds) { return dep('approveLoredeckCreatorTitleSelection', () => false)(selectedIds); }
function unapproveLoredeckCreatorTitleSelection(selectedIds) { return dep('unapproveLoredeckCreatorTitleSelection', () => false)(selectedIds); }
function dropLoredeckCreatorTitleSelection(selectedIds) { return dep('dropLoredeckCreatorTitleSelection', () => false)(selectedIds); }
function setLoredeckCreatorTitleSelectionBulk(mode) { return dep('setLoredeckCreatorTitleSelectionBulk', () => false)(mode); }
function setLoredeckCreatorTitleSelection(titleId, selected, options) { return dep('setLoredeckCreatorTitleSelection', () => false)(titleId, selected, options); }
function getLoredeckCreatorSelectedTitleDrafts(cached) { return dep('getLoredeckCreatorSelectedTitleDrafts', () => [])(cached); }
function getLoredeckCreatorTitleRevisionInstruction() { return dep('getLoredeckCreatorTitleRevisionInstruction', () => '')(); }
function setLoredeckCreatorTitleRevisionInstruction(value) { return dep('setLoredeckCreatorTitleRevisionInstruction', value => value)(value); }
function appendLoredeckPendingQualityPills(meta, change) { return dep('appendLoredeckPendingQualityPills', () => null)(meta, change); }
function createLoredeckPendingQualityList(change) { return dep('createLoredeckPendingQualityList', () => null)(change); }
function openLoredeckCreatorTitleJsonEditor(draft) { return dep('openLoredeckCreatorTitleJsonEditor', () => null)(draft); }
function getLoredeckCreatorPlanningBatchRows(cached) { return dep('getLoredeckCreatorPlanningBatchRows', () => [])(cached); }
function getLoredeckCreatorPlanningQueuedBatchIds(cached) { return dep('getLoredeckCreatorPlanningQueuedBatchIds', () => new Set())(cached); }
function getLoredeckCreatorNextPlanningBatch(cached) { return dep('getLoredeckCreatorNextPlanningBatch', () => null)(cached); }
function countLoredeckCreatorPlanningPendingChanges(pack) { return dep('countLoredeckCreatorPlanningPendingChanges', () => 0)(pack); }
function getLoredeckDefinition(packId) { return dep('getLoredeckDefinition', () => null)(packId); }
function handleLoredeckCreatorPlanningDraft(options, button) { return dep('handleLoredeckCreatorPlanningDraft', async () => null)(options, button); }
function openLoredeckLibraryDetails(packId) { return dep('openLoredeckLibraryDetails', () => null)(packId); }
function getLoredeckStack(state) { return dep('getLoredeckStack', () => [])(state); }
function addLoredeckToStack(packId) { return dep('addLoredeckToStack', () => false)(packId); }
function getLoredeckCreatorAcceptedPlanningStatus(pack) { return dep('getLoredeckCreatorAcceptedPlanningStatus', () => ({ anchorCount: 0, windowCount: 0, tagCount: 0, ready: false }))(pack); }
function getLoredeckCreatorPlanningAcceptedBatchIds(cached) { return dep('getLoredeckCreatorPlanningAcceptedBatchIds', () => new Set())(cached); }
function getLoredeckCreatorEntryDraftProgress(cached, pack) { return dep('getLoredeckCreatorEntryDraftProgress', () => null)(cached, pack); }
function getLoredeckCreatorEntryTargetTitles(cached, pack) { return dep('getLoredeckCreatorEntryTargetTitles', () => [])(cached, pack); }
function getLoredeckCreatorDraftChanges(packId) { return dep('getLoredeckCreatorDraftChanges', () => [])(packId); }
function getLoredeckCreatorPendingEntryCount(pack) { return dep('getLoredeckCreatorPendingEntryCount', () => 0)(pack); }
function getLoredeckCreatorAcceptedEntryCount(pack) { return dep('getLoredeckCreatorAcceptedEntryCount', () => 0)(pack); }
function getFreshLoredeckLibraryPack(packId, fallback) { return dep('getFreshLoredeckLibraryPack', (packId, fallback) => fallback || null)(packId, fallback); }
function handleLoredeckCreatorEntryDraft(button, options) { return dep('handleLoredeckCreatorEntryDraft', async () => null)(button, options); }
function confirmAction(title, message) { return dep('confirmAction', async () => false)(title, message); }
function createLoredeckCreatorDraftReviewSection(pack) { return dep('createLoredeckCreatorDraftReviewSection', () => null)(pack); }
function createLoredeckPendingReviewCard(pack) { return dep('createLoredeckPendingReviewCard', () => null)(pack); }
function getLoredeckCreatorPipelineReadinessView(pack, cached) { return dep('getLoredeckCreatorPipelineReadinessView', () => null)(pack, cached); }

export function openLoredeckCreatorWorkbench() {
    document.querySelector('.saga-loredeck-creator-workbench-overlay')?.remove();
    recoverLoredeckCreatorCurrentActiveGenerationOnOpen({ toast: true });
    const overlay = document.createElement('div');
    overlay.className = 'saga-lore-workbench-overlay saga-loredeck-creator-workbench-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-lore-workbench-shell saga-loredeck-creator-workbench-shell';
    overlay.appendChild(shell);

    const cached = getLoredeckCreatorBriefCache();
    const pipeline = getLoredeckCreatorPipelineModel(cached);
    shell.appendChild(createLoredeckCreatorPipelineHeader(cached, pipeline, { showClose: true, workbench: true }));

    const body = document.createElement('div');
    body.className = 'saga-loredeck-creator-workbench-body';
    body.appendChild(createLoredeckCreatorCard(getState(), { embedded: true, showHeader: false }));
    shell.appendChild(body);
}

export function refreshLoredeckCreatorWorkbenchBody(options = {}) {
    const body = document.querySelector('.saga-loredeck-creator-workbench-body');
    if (!body) return false;
    const scrollTop = options.preserveScroll === false ? 0 : (body.scrollTop || 0);
    const anchor = options.preserveScroll === false ? null : getLoredeckCreatorWorkbenchScrollAnchor(body);
    const shell = body.closest('.saga-loredeck-creator-workbench-shell');
    const cached = getLoredeckCreatorBriefCache();
    const pipeline = getLoredeckCreatorPipelineModel(cached);
    const header = [...(shell?.children || [])].find(child => child.classList?.contains('saga-loredeck-creator-pipeline-header'));
    const nextHeader = createLoredeckCreatorPipelineHeader(cached, pipeline, { showClose: true, workbench: true });
    if (header) header.replaceWith(nextHeader);
    else if (shell) shell.insertBefore(nextHeader, body);
    body.replaceChildren(createLoredeckCreatorCard(getState(), { embedded: true, showHeader: false }));
    if (options.preserveScroll !== false) {
        const restore = () => {
            body.scrollTop = scrollTop;
            restoreLoredeckCreatorWorkbenchScrollAnchor(body, anchor);
        };
        restore();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
    }
    return true;
}

function getLoredeckCreatorWorkbenchScrollAnchor(body) {
    if (!body) return null;
    const bodyRect = body.getBoundingClientRect();
    const active = document.activeElement && body.contains(document.activeElement)
        ? document.activeElement.closest('[data-saga-creator-anchor]')
        : null;
    let target = active;
    if (!target) {
        const focusLine = bodyRect.top + Math.min(96, Math.max(28, body.clientHeight * 0.18));
        const anchors = [...body.querySelectorAll('[data-saga-creator-anchor]')];
        target = anchors
            .filter(anchor => {
                const rect = anchor.getBoundingClientRect();
                return rect.bottom >= bodyRect.top && rect.top <= bodyRect.bottom;
            })
            .sort((a, b) => Math.abs(a.getBoundingClientRect().top - focusLine) - Math.abs(b.getBoundingClientRect().top - focusLine))[0] || null;
    }
    if (!target?.dataset?.sagaCreatorAnchor) return null;
    const rect = target.getBoundingClientRect();
    return {
        id: target.dataset.sagaCreatorAnchor,
        offset: rect.top - bodyRect.top,
    };
}

function restoreLoredeckCreatorWorkbenchScrollAnchor(body, anchor = null) {
    if (!body || !anchor?.id) return;
    const selectorId = String(anchor.id).replace(/"/g, '\\"');
    const next = body.querySelector(`[data-saga-creator-anchor="${selectorId}"]`);
    if (!next) return;
    const bodyRect = body.getBoundingClientRect();
    const rect = next.getBoundingClientRect();
    body.scrollTop += rect.top - bodyRect.top - Number(anchor.offset || 0);
}

export function queueLoredeckCreatorWorkbenchRefresh(options = {}) {
    if (!document.querySelector('.saga-loredeck-creator-workbench-body')) return false;
    if (loredeckCreatorWorkbenchRefreshQueued) return true;
    loredeckCreatorWorkbenchRefreshQueued = true;
    const refresh = () => {
        loredeckCreatorWorkbenchRefreshQueued = false;
        refreshLoredeckCreatorWorkbenchBody(options);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(refresh);
    else setTimeout(refresh, 0);
    return true;
}

export function createLoredeckCreatorPipelineHeader(cached = {}, pipeline = getLoredeckCreatorPipelineModel(cached), options = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-lore-workbench-header saga-loredeck-creator-pipeline-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const titleRow = document.createElement('div');
    titleRow.className = 'saga-loredeck-library-title-row saga-loredeck-creator-title-row';
    const emblem = document.createElement('div');
    emblem.className = 'saga-loredeck-library-emblem saga-loredeck-creator-emblem';
    emblem.textContent = 'S';
    titleRow.appendChild(emblem);
    const titleText = document.createElement('div');
    titleText.className = 'saga-loredeck-creator-title-text';
    const titleLine = document.createElement('div');
    titleLine.className = 'saga-loredeck-library-title-line';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Loredeck Creator';
    titleLine.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = 'Generated Loredeck draft';
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-library-title-meta saga-loredeck-creator-pipeline-meta';
    const brief = cached.brief || {};
    const draft = getLoredeckCreatorDraftInputs();
    const fandom = draft.fandom || cached.fandom || brief.fandom || 'No fandom';
    const scope = draft.scope || cached.scope || brief.scope || 'No scope';
    const granularity = cached.granularity || brief.granularity || draft.granularity || 'focused';
    meta.appendChild(createStatusPill(`Fandom: ${fandom}`, 'Fandom or universe for this Generated Loredeck draft.'));
    meta.appendChild(createStatusPill(`Scope: ${scope}`, 'Story scope for this Creator project.'));
    meta.appendChild(createStatusPill(`Granularity: ${formatLoredeckCreatorGranularity(granularity)}`, 'Creator generation granularity.'));
    if (cached.jobId) meta.appendChild(createStatusPill('Resumable job', 'This Creator project is saved and can be resumed from the Loredecks tab.'));
    titleLine.appendChild(meta);
    titleText.appendChild(titleLine);
    titleText.appendChild(subtitle);
    titleRow.appendChild(titleText);
    titleWrap.appendChild(titleRow);
    wrap.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-loredeck-library-header-actions saga-loredeck-creator-header-actions';
    actions.appendChild(createButton('Project Settings', 'Jump to the editable project inputs or approved Scope Brief.', () => {
        scrollLoredeckCreatorWorkbenchToAnchor(cached.approved ? 'scope-brief' : 'intake');
    }));
    if (options.showClose) {
        actions.appendChild(createButton('Close', 'Close the Loredeck Creator wizard.', () => {
            document.querySelector('.saga-loredeck-creator-workbench-overlay')?.remove();
        }));
    }
    wrap.appendChild(actions);
    return wrap;
}

export function createLoredeckCreatorStageGuide(cached = {}, pipeline = getLoredeckCreatorPipelineModel(cached)) {
    void cached;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-stage-guide';
    wrap.dataset.sagaCreatorAnchor = 'roadmap';

    const list = document.createElement('div');
    list.className = 'saga-loredeck-creator-stage-list';
    for (const [index, stage] of (pipeline.stages || []).entries()) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `saga-loredeck-creator-stage-item saga-loredeck-creator-stage-${stage.status}`;
        if (pipeline.currentStep?.id === stage.id) item.classList.add('saga-loredeck-creator-stage-active');
        const number = document.createElement('div');
        number.className = 'saga-loredeck-creator-stage-number';
        number.textContent = String(index + 1);
        item.appendChild(number);
        const body = document.createElement('div');
        body.className = 'saga-loredeck-creator-stage-body';
        const label = document.createElement('div');
        label.className = 'saga-loredeck-creator-stage-label';
        label.textContent = stage.label;
        body.appendChild(label);
        const detail = document.createElement('div');
        detail.className = 'saga-loredeck-creator-stage-detail';
        detail.textContent = stage.detail;
        body.appendChild(detail);
        item.appendChild(body);
        addTooltip(item, stage.status === 'locked' ? stage.dependency : `${stage.label}: ${stage.detail}`);
        item.addEventListener('click', () => {
            if (stage.status === 'locked' && stage.dependency) {
                toast(stage.dependency, 'info');
                return;
            }
            scrollLoredeckCreatorWorkbenchToAnchor(stage.anchor || 'current-task');
        });
        list.appendChild(item);
    }
    wrap.appendChild(list);
    return wrap;
}

export function scrollLoredeckCreatorWorkbenchToAnchor(anchorId = '') {
    const id = String(anchorId || '').trim();
    if (!id) return false;
    const body = document.querySelector('.saga-loredeck-creator-workbench-body');
    const selectorId = id.replace(/"/g, '\\"');
    const target = body?.querySelector(`[data-saga-creator-anchor="${selectorId}"]`)
        || (id === 'review-queue' ? body?.querySelector('.saga-loredeck-creator-pending-review') : null);
    if (!target) {
        toast(id === 'review-queue' ? 'No pending review queue is available yet.' : 'That Creator section is not available yet.', 'info');
        return false;
    }
    const details = target.matches?.('details') ? target : target.closest('details');
    if (details) details.open = true;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
}

export function createLoredeckCreatorArtifactDisclosure(title, child, options = {}) {
    const details = document.createElement('details');
    details.className = 'saga-loredeck-creator-artifact';
    details.open = options.open === true;
    if (options.anchor) details.dataset.sagaCreatorAnchor = options.anchor;
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.textContent = title;
    summary.appendChild(label);
    const state = document.createElement('span');
    state.className = 'saga-loredeck-creator-artifact-state';
    state.textContent = options.state || (details.open ? 'Open' : 'Collapsed');
    summary.appendChild(state);
    details.appendChild(summary);
    details.appendChild(child);
    return details;
}

export function createLoredeckCreatorCurrentTaskCard(cached = {}, pipeline = getLoredeckCreatorPipelineModel(cached), context = {}) {
    const card = document.createElement('div');
    card.className = 'saga-loredeck-creator-current-task';
    card.dataset.sagaCreatorAnchor = 'current-task';
    const main = document.createElement('div');
    main.className = 'saga-loredeck-creator-current-main';
    const kicker = document.createElement('div');
    kicker.className = 'saga-loredeck-creator-current-kicker';
    kicker.textContent = 'Current Task';
    main.appendChild(kicker);
    const title = document.createElement('div');
    title.className = 'saga-loredeck-creator-current-title';
    title.textContent = getLoredeckCreatorCurrentTaskTitle(cached, pipeline);
    main.appendChild(title);
    const description = document.createElement('div');
    description.className = 'saga-loredeck-creator-current-description';
    description.textContent = getLoredeckCreatorCurrentTaskDescription(cached, pipeline);
    main.appendChild(description);
    main.appendChild(createLoredeckCreatorCurrentTaskOutputs(pipeline));
    main.appendChild(createLoredeckCreatorCurrentTaskActions(cached, pipeline, context));
    appendLoredeckCreatorGenerationStatus(main, cached, [
        'brief_draft',
        'brief_revision',
        'outline_draft',
        'outline_revision',
        'title_batch_draft',
        'title_batch_redraft',
        'title_revision',
        'planning_batch_draft',
        'entry_batch_draft',
        'entry_multi_batch_draft',
    ]);
    card.appendChild(main);
    card.appendChild(createLoredeckCreatorCurrentSidebar(cached, pipeline));
    return card;
}

export function createLoredeckCreatorBriefReview(brief = {}, cached = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-brief';
    wrap.dataset.sagaCreatorAnchor = 'brief-review';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Scope Brief';
    wrap.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-entry-summary';
    chips.appendChild(createStatusPill(cached.approved ? 'Approved' : 'Needs approval', 'Brief approval status.'));
    if (brief.granularity) chips.appendChild(createStatusPill(formatLoredeckCreatorGranularity(brief.granularity), 'Model-confirmed granularity.'));
    wrap.appendChild(chips);

    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-detail-grid';
    grid.appendChild(createKeyValue('Title', brief.title || 'unset', 'Creator brief title.'));
    grid.appendChild(createKeyValue('Deck ID', brief.packId || 'unset', 'Stable generated Loredeck ID.'));
    grid.appendChild(createKeyValue('Fandom', brief.fandom || 'unset', 'Fandom or universe.'));
    grid.appendChild(createKeyValue('Scope', brief.scope || 'unset', 'Coverage range for this deck.'));
    grid.appendChild(createKeyValue('Coverage', brief.coverageSummary || brief.coverage || 'unset', 'What the deck should cover.'));
    wrap.appendChild(grid);

    appendLoredeckCreatorBriefList(wrap, 'Assumptions', brief.assumptions);
    appendLoredeckCreatorBriefList(wrap, 'Risks', brief.risks);
    wrap.appendChild(createLoredeckCreatorBriefRevisionForm(brief, cached));
    return wrap;
}

export function appendLoredeckCreatorBriefList(container, label, items = []) {
    const values = Array.isArray(items) ? items.map(item => String(item || '').trim()).filter(Boolean) : [];
    if (!values.length) return;
    const section = document.createElement('div');
    section.className = 'saga-loredeck-creator-brief-list';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = label;
    section.appendChild(title);
    for (const item of values.slice(0, 10)) {
        const row = document.createElement('div');
        row.className = 'saga-runtime-help';
        row.textContent = item;
        section.appendChild(row);
    }
    container.appendChild(section);
}

function getLoredeckCreatorOutline(cached = {}) {
    const outline = cached?.outline;
    return outline && typeof outline === 'object' && !Array.isArray(outline) ? outline : null;
}

export function getLoredeckCreatorOutlineRows(outline = {}, key = '') {
    const rows = Array.isArray(outline?.[key]) ? outline[key] : [];
    return rows
        .filter(row => row && typeof row === 'object' && !Array.isArray(row))
        .map((row, index) => ({
            id: String(row.id || `${key}-${index + 1}`).trim(),
            label: String(row.label || row.title || row.name || `${humanizeScopeKey(key)} ${index + 1}`).trim(),
            type: String(row.type || row.kind || row.category || '').trim(),
            order: Number.isFinite(Number(row.order ?? row.sortKey)) ? Math.round(Number(row.order ?? row.sortKey)) : index + 1,
            summary: String(row.summary || row.description || '').trim(),
            contextRole: String(row.contextRole || row.context || row.role || '').trim(),
            titleTargets: Array.isArray(row.titleTargets) ? row.titleTargets.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8) : [],
        }));
}

function createLoredeckCreatorOutlineRows(container, label, rows = []) {
    const cleanRows = Array.isArray(rows) ? rows : [];
    if (!cleanRows.length) return;
    const section = document.createElement('div');
    section.className = 'saga-loredeck-creator-brief-list';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = label;
    section.appendChild(title);
    for (const row of cleanRows.slice(0, 16)) {
        const item = document.createElement('div');
        item.className = 'saga-runtime-help';
        const parts = [];
        const prefix = row.type ? `${humanizeScopeKey(row.type)}: ` : '';
        parts.push(`${prefix}${row.label}`);
        if (row.summary) parts.push(row.summary);
        if (row.contextRole) parts.push(`Context: ${row.contextRole}`);
        if (row.titleTargets?.length) parts.push(`Targets: ${row.titleTargets.join(', ')}`);
        item.textContent = parts.join(' | ');
        section.appendChild(item);
    }
    container.appendChild(section);
}

export function createLoredeckCreatorOutlineCard(brief = {}, cached = {}) {
    const outline = getLoredeckCreatorOutline(cached);
    const beats = getLoredeckCreatorOutlineRows(outline, 'beats');
    const contextMilestones = getLoredeckCreatorOutlineRows(outline, 'contextMilestones');
    const titleBatches = getLoredeckCreatorOutlineRows(outline, 'titleBatches');
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-brief saga-loredeck-creator-outline';
    wrap.dataset.sagaCreatorAnchor = 'story-outline';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Creator Story Outline';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(outline ? (cached.outlineApproved ? 'Approved' : 'Needs approval') : 'Ready', 'Story Outline approval status.'));
    summary.appendChild(createStatusPill(`${beats.length} beat${beats.length === 1 ? '' : 's'}`, 'Major story beats in this outline.'));
    summary.appendChild(createStatusPill(`${contextMilestones.length} Context`, 'Major Context browser points suggested by this outline.'));
    summary.appendChild(createStatusPill(`${titleBatches.length} title set${titleBatches.length === 1 ? '' : 's'}`, 'Future title-pass slices suggested by this outline.'));
    if (cached.outlineQuestions?.length) summary.appendChild(createStatusPill(`${cached.outlineQuestions.length} question${cached.outlineQuestions.length === 1 ? '' : 's'}`, 'Creator needs clarification before the outline is ready.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'This stage confirms the story shape and major Context points before Saga drafts Lorecard titles.';
    wrap.appendChild(help);

    if (outline) {
        const grid = document.createElement('div');
        grid.className = 'saga-loredeck-detail-grid';
        grid.appendChild(createKeyValue('Outline', outline.label || brief.title || 'Story outline', 'Reviewable outline label.'));
        grid.appendChild(createKeyValue('Coverage', outline.coverageSummary || brief.coverageSummary || brief.coverage || 'unset', 'What this outline covers.'));
        wrap.appendChild(grid);
        createLoredeckCreatorOutlineRows(wrap, 'Story Beats', beats);
        createLoredeckCreatorOutlineRows(wrap, 'Context Milestones', contextMilestones);
        createLoredeckCreatorOutlineRows(wrap, 'Title Batch Plan', titleBatches);
        appendLoredeckCreatorBriefList(wrap, 'Assumptions', outline.assumptions);
        appendLoredeckCreatorBriefList(wrap, 'Risks', outline.risks);
    }

    if (cached.outlineSummary || cached.outlineQuestions?.length || cached.outlineWarnings?.length) {
        const result = document.createElement('div');
        result.className = 'saga-runtime-help';
        const parts = [];
        if (cached.outlineSummary) parts.push(cached.outlineSummary);
        if (cached.outlineQuestions?.length) parts.push(`Questions: ${cached.outlineQuestions.join(' | ')}`);
        if (cached.outlineWarnings?.length) parts.push(`Warnings: ${cached.outlineWarnings.join(' | ')}`);
        result.textContent = parts.join(' ');
        wrap.appendChild(result);
    }

    wrap.appendChild(createLoredeckCreatorOutlineActionForm(brief, cached, outline));
    return wrap;
}

export function normalizeLoredeckCreatorTitleId(value = '', fallback = '') {
    const text = String(value || fallback || '')
        .trim()
        .slice(0, 160);
    return text || String(fallback || '').trim();
}

function normalizeLoredeckCreatorStringList(value = [], limit = 500) {
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

export function normalizeLoredeckCreatorTitleDrafts(value = []) {
    if (!Array.isArray(value)) return [];
    const drafts = [];
    const seen = new Set();
    for (const [index, raw] of value.entries()) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const title = String(raw.title || raw.name || raw.label || '').trim().slice(0, 220);
        if (!title) continue;
        const fallback = `title-${index + 1}`;
        let titleId = normalizeLoredeckCreatorTitleId(raw.titleId || raw.id || raw.entryId, fallback);
        if (seen.has(titleId)) titleId = `${titleId}-${index + 1}`;
        seen.add(titleId);
        drafts.push({
            titleId,
            title,
            category: String(raw.category || raw.type || raw.kind || '').trim().slice(0, 120),
            priority: Number.isFinite(Number(raw.priority)) ? Math.max(0, Math.min(100, Math.round(Number(raw.priority)))) : 50,
            relevance: String(raw.relevance || '').trim().slice(0, 80),
            contextHint: String(raw.contextHint || raw.timelineHint || '').trim().slice(0, 500),
            tags: normalizeLoredeckCreatorStringList(raw.tags || raw.tagHints || raw.suggestedTags || [], 24),
            reason: String(raw.reason || raw.rationale || raw.description || '').trim().slice(0, 1000),
            creatorTitleBatchId: normalizeLoredeckCreatorTitleId(raw.creatorTitleBatchId || raw.batchId || raw.sourceBatchId || '', ''),
            creatorTitleBatchLabel: String(raw.creatorTitleBatchLabel || raw.batchLabel || raw.sourceBatchLabel || '').trim().slice(0, 180),
            rubric: isPlainObjectValue(raw.rubric) ? raw.rubric : null,
            warnings: Array.isArray(raw.warnings || raw.qualityWarnings)
                ? (raw.warnings || raw.qualityWarnings).map(item => String(item || '').trim()).filter(Boolean).slice(0, 8)
                : [],
        });
    }
    return drafts;
}

export function normalizeLoredeckCreatorTitleIdList(value = [], limit = 500) {
    const out = [];
    const seen = new Set();
    const values = Array.isArray(value) ? value : [];
    for (const raw of values) {
        const id = normalizeLoredeckCreatorTitleId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

export function getLoredeckCreatorTitleDrafts(cached = {}) {
    return normalizeLoredeckCreatorTitleDrafts(cached?.titleDrafts);
}

export function getLoredeckCreatorTitleDraftedBatchIds(cached = {}) {
    return new Set(normalizeLoredeckCreatorTitleIdList(cached?.titleBatchDraftedIds || [], 1200));
}

export function getLoredeckCreatorTitleBatchRows(cached = {}) {
    const outline = getLoredeckCreatorOutline(cached);
    const rows = getLoredeckCreatorOutlineRows(outline, 'titleBatches')
        .map((row, index) => ({
            ...row,
            id: normalizeLoredeckCreatorTitleId(row.id || row.label, `title-batch-${index + 1}`),
            label: row.label || `Title Batch ${index + 1}`,
            order: Number.isFinite(Number(row.order)) ? Number(row.order) : index + 1,
        }))
        .filter(row => row.id);
    if (rows.length) return rows;
    const brief = cached.brief || {};
    return [{
        id: 'whole-scope',
        label: 'Whole Scope',
        type: 'title_batch',
        order: 10,
        summary: outline?.coverageSummary || brief.coverageSummary || brief.coverage || brief.scope || 'Approved Creator scope.',
        contextRole: 'Fallback title set when the outline did not define smaller title slices.',
        titleTargets: [],
    }];
}

export function getLoredeckCreatorNextTitleBatch(cached = {}) {
    const drafted = getLoredeckCreatorTitleDraftedBatchIds(cached);
    return getLoredeckCreatorTitleBatchRows(cached).find(batch => !drafted.has(batch.id)) || null;
}

export function getLoredeckCreatorRemainingTitleBatches(cached = {}) {
    const drafted = getLoredeckCreatorTitleDraftedBatchIds(cached);
    return getLoredeckCreatorTitleBatchRows(cached).filter(batch => batch?.id && !drafted.has(batch.id));
}

export function getLoredeckCreatorTitleBatchIdentity(batch = {}) {
    const id = normalizeLoredeckCreatorTitleId(batch?.id || batch?.label || '', '');
    return {
        id,
        label: String(batch?.label || id || 'Title Batch').trim(),
    };
}

export function countLoredeckCreatorTitleQualityWarnings(drafts = []) {
    return drafts.reduce((total, draft) => total + (Array.isArray(draft.warnings) ? draft.warnings.length : 0), 0);
}

function truncateLoredeckCreatorText(text = '', maxLength = 700) {
    const value = String(text || '');
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).replace(/\s+\S*$/, '')}...`;
}

export function compactLoredeckCreatorTitleDraftForRevision(draft = {}) {
    return {
        titleId: draft.titleId || '',
        title: draft.title || '',
        category: draft.category || '',
        priority: Number.isFinite(Number(draft.priority)) ? Math.round(Number(draft.priority)) : 50,
        relevance: draft.relevance || '',
        contextHint: draft.contextHint || '',
        tags: Array.isArray(draft.tags) ? draft.tags.slice(0, 24) : [],
        reason: truncateLoredeckCreatorText(draft.reason || '', 700),
        creatorTitleBatchId: draft.creatorTitleBatchId || '',
        creatorTitleBatchLabel: draft.creatorTitleBatchLabel || '',
        rubric: isPlainObjectValue(draft.rubric) ? draft.rubric : null,
    };
}

export function createLoredeckCreatorTitleBatchPlanner(brief = {}, cached = {}) {
    const batches = getLoredeckCreatorTitleBatchRows(cached);
    const draftedIds = getLoredeckCreatorTitleDraftedBatchIds(cached);
    const drafts = getLoredeckCreatorTitleDrafts(cached);
    const nextBatch = getLoredeckCreatorNextTitleBatch(cached);
    const section = document.createElement('div');
    section.className = 'saga-loredeck-creator-title-batches';

    const heading = document.createElement('div');
    heading.className = 'saga-loredeck-row-title';
    heading.textContent = 'Title Set Plan';
    section.appendChild(heading);

    for (const batch of batches.slice(0, 16)) {
        const drafted = draftedIds.has(batch.id);
        const isNext = !drafted && nextBatch?.id === batch.id;
        const row = document.createElement('div');
        row.className = 'saga-loredeck-entry-row saga-loredeck-creator-title-batch-row';
        const main = document.createElement('div');
        main.className = 'saga-loredeck-row-main';
        const label = document.createElement('div');
        label.className = 'saga-loredeck-row-title';
        label.textContent = batch.label || batch.id;
        main.appendChild(label);
        const desc = document.createElement('div');
        desc.className = 'saga-loredeck-row-description';
        desc.textContent = batch.summary || batch.contextRole || 'Planned title-batch slice from the approved Story Outline.';
        main.appendChild(desc);
        const meta = document.createElement('div');
        meta.className = 'saga-loredeck-row-meta';
        const batchDrafts = drafts.filter(draft => draft.creatorTitleBatchId === batch.id);
        meta.appendChild(createStatusPill(drafted ? 'Drafted' : (isNext ? 'Next' : 'Waiting'), drafted ? 'This title set already has generated drafts.' : (isNext ? 'This is the next title set Saga will draft.' : 'Draft earlier title sets before this one.')));
        meta.appendChild(createStatusPill(`${batchDrafts.length} title${batchDrafts.length === 1 ? '' : 's'}`, 'Title drafts currently tied to this batch.'));
        if (batch.type) meta.appendChild(createStatusPill(humanizeScopeKey(batch.type), 'Outline title-batch type.'));
        if (batch.titleTargets?.length) meta.appendChild(createStatusPill(`${batch.titleTargets.length} target${batch.titleTargets.length === 1 ? '' : 's'}`, batch.titleTargets.join(', ')));
        main.appendChild(meta);
        row.appendChild(main);

        const actions = document.createElement('div');
        actions.className = 'saga-loredeck-row-actions';
        actions.appendChild(createStatusPill(drafted ? 'Generated' : (isNext ? 'Next in queue' : 'Waiting'), drafted ? 'This title set has generated drafts.' : (isNext ? 'Use Generate Next to draft this title set.' : 'Earlier title sets generate first.')));
        row.appendChild(actions);
        appendLoredeckCreatorGenerationStatus(main, cached, ['title_batch_draft', 'title_batch_redraft'], { batchId: batch.id, compact: true });
        section.appendChild(row);
    }

    if (batches.length > 16) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing 16 of ${batches.length} planned title sets.`;
        section.appendChild(more);
    }
    return section;
}

export function createLoredeckCreatorTitlePassCard(brief = {}, cached = {}) {
    const drafts = getLoredeckCreatorTitleDrafts(cached);
    const titleBatches = getLoredeckCreatorTitleBatchRows(cached);
    const draftedBatchIds = getLoredeckCreatorTitleDraftedBatchIds(cached);
    const nextTitleBatch = getLoredeckCreatorNextTitleBatch(cached);
    const remainingTitleBatches = getLoredeckCreatorRemainingTitleBatches(cached);
    const selectedIds = getLoredeckCreatorSelectedTitleIds(cached);
    const approvedIds = getLoredeckCreatorApprovedTitleIds(cached);
    const selectedCount = drafts.filter(draft => selectedIds.has(draft.titleId)).length;
    const selectedApprovedCount = drafts.filter(draft => selectedIds.has(draft.titleId) && approvedIds.has(draft.titleId)).length;
    const qualityWarningCount = countLoredeckCreatorTitleQualityWarnings(drafts);
    const context = {
        drafts,
        titleBatches,
        draftedBatchIds,
        nextTitleBatch,
        remainingTitleBatches,
        selectedIds,
        approvedIds,
        selectedCount,
        selectedApprovedCount,
        qualityWarningCount,
    };

    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-brief saga-loredeck-creator-title-pass';
    wrap.dataset.sagaCreatorAnchor = 'title-sets';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Creator Title Pass';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(drafts.length ? 'Drafted' : 'Ready', 'Title-pass generation status.'));
    summary.appendChild(createStatusPill(`${drafts.length} title${drafts.length === 1 ? '' : 's'}`, 'Reviewable title drafts in this batch.'));
    summary.appendChild(createStatusPill(`${draftedBatchIds.size}/${titleBatches.length} batches`, 'Title batches drafted from the approved Story Outline.'));
    summary.appendChild(createStatusPill(`${selectedCount} selected`, 'Selected titles are affected by approve, drop, and revise actions.'));
    if (approvedIds.size) summary.appendChild(createStatusPill(`${approvedIds.size} approved`, 'Approved titles are ready for the next Creator stage.'));
    if (qualityWarningCount) summary.appendChild(createStatusPill(`${qualityWarningCount} quality flag${qualityWarningCount === 1 ? '' : 's'}`, 'Model-provided quality warnings across title drafts.'));
    if (cached.titleBatch?.label) summary.appendChild(createStatusPill(cached.titleBatch.label, 'Current title set label.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Titles are review-only. Draft one planned title set per model call, then approve the useful titles for the next Creator stage.';
    wrap.appendChild(help);

    wrap.appendChild(createLoredeckCreatorTitleBatchPlanner(brief, cached));

    if (cached.titlePassSummary || cached.titlePassQuestions?.length || cached.titlePassWarnings?.length || cached.titleBatch?.coverage || cached.titleBatch?.nextBatchHint) {
        const result = document.createElement('div');
        result.className = 'saga-runtime-help';
        const parts = [];
        if (cached.titlePassSummary) parts.push(cached.titlePassSummary);
        if (cached.titleBatch?.coverage) parts.push(`Coverage: ${cached.titleBatch.coverage}`);
        if (cached.titleBatch?.nextBatchHint) parts.push(`Next batch: ${cached.titleBatch.nextBatchHint}`);
        if (cached.titlePassQuestions?.length) parts.push(`Questions: ${cached.titlePassQuestions.join(' | ')}`);
        if (cached.titlePassWarnings?.length) parts.push(`Warnings: ${cached.titlePassWarnings.join(' | ')}`);
        result.textContent = parts.join(' ');
        wrap.appendChild(result);
    }

    wrap.appendChild(createLoredeckCreatorTitlePassActions(brief, cached, context));
    appendLoredeckCreatorGenerationStatus(wrap, cached, ['title_batch_draft', 'title_batch_redraft']);
    wrap.appendChild(createLoredeckCreatorTitleRevisionForm(brief, cached, context));

    if (!drafts.length) {
        wrap.appendChild(createEmptyMessage('Draft title sets after approving the Creator Story Outline.'));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const draft of drafts.slice(0, 80)) {
        list.appendChild(createLoredeckCreatorTitleRow(draft, selectedIds.has(draft.titleId), approvedIds.has(draft.titleId)));
    }
    if (drafts.length > 80) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing 80 of ${drafts.length} title drafts. Approve, drop, or revise this batch before generating more.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function createLoredeckCreatorTitlePassActions(brief = {}, cached = {}, context = {}) {
    const generationSettings = getLoredeckCreatorGenerationSettings(cached);
    const nextTitleBatch = context.nextTitleBatch || getLoredeckCreatorNextTitleBatch(cached);
    const remainingTitleBatches = Array.isArray(context.remainingTitleBatches)
        ? context.remainingTitleBatches
        : getLoredeckCreatorRemainingTitleBatches(cached);
    const selectedCount = Number.isFinite(Number(context.selectedCount)) ? Number(context.selectedCount) : getLoredeckCreatorSelectedTitleDrafts(cached).length;
    const selectedApprovedCount = Number.isFinite(Number(context.selectedApprovedCount))
        ? Number(context.selectedApprovedCount)
        : getLoredeckCreatorSelectedTitleDrafts(cached).filter(draft => getLoredeckCreatorApprovedTitleIds(cached).has(draft.titleId)).length;
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const draftNext = createButton(nextTitleBatch ? 'Generate Next Title Batch' : 'Title Batches Complete', nextTitleBatch ? 'Generate the next undrafted title batch from the approved Story Outline.' : 'Every planned title batch has already been drafted.', async (btn) => {
        const fresh = getLoredeckCreatorBriefCache();
        const draftInputs = getLoredeckCreatorDraftInputs();
        await handleLoredeckCreatorTitleDraft({
            brief: fresh.brief || brief,
            notes: fresh.notes || draftInputs.notes || '',
            targetTitleBatch: getLoredeckCreatorNextTitleBatch(fresh),
            previousTitleDrafts: getLoredeckCreatorTitleDrafts(fresh).map(compactLoredeckCreatorTitleDraftForRevision),
        }, btn);
    }, 'saga-primary-button');
    draftNext.disabled = !nextTitleBatch;
    actions.appendChild(lockLoredeckCreatorGenerationButton(draftNext, cached, 'title set draft'));

    const titleRunLimit = Number.isFinite(Number(generationSettings.titleRunRemainingLimit))
        ? Number(generationSettings.titleRunRemainingLimit)
        : 1;
    const remainingLabel = remainingTitleBatches.length
        ? `Generate Remaining (${Math.min(titleRunLimit, remainingTitleBatches.length)})`
        : 'Remaining Complete';
    const generateRemaining = createButton(remainingLabel, remainingTitleBatches.length ? `Run up to ${titleRunLimit} title-batch calls in sequence, one title set per provider call.` : 'Every planned title batch has already been drafted.', async (btn) => {
        await handleLoredeckCreatorRemainingTitleBatches(btn);
    });
    generateRemaining.disabled = !remainingTitleBatches.length;
    actions.appendChild(lockLoredeckCreatorGenerationButton(generateRemaining, cached, 'remaining title batches'));

    const approveSelected = createButton('Approve Selected Titles', 'Approve selected title drafts for the next Creator stage.', () => {
        approveLoredeckCreatorTitleSelection(getLoredeckCreatorSelectedTitleIds(getLoredeckCreatorBriefCache()));
    });
    approveSelected.disabled = !selectedCount;
    actions.appendChild(approveSelected);

    const unapproveSelected = createButton('Unapprove Selected', 'Remove selected title drafts from the approved set.', () => {
        unapproveLoredeckCreatorTitleSelection(getLoredeckCreatorSelectedTitleIds(getLoredeckCreatorBriefCache()));
    });
    unapproveSelected.disabled = !selectedApprovedCount;
    actions.appendChild(unapproveSelected);

    const dropSelected = createButton('Drop Selected', 'Remove selected title drafts from this Creator batch.', () => {
        dropLoredeckCreatorTitleSelection(getLoredeckCreatorSelectedTitleIds(getLoredeckCreatorBriefCache()));
    }, 'saga-danger-button');
    dropSelected.disabled = !selectedCount;
    actions.appendChild(dropSelected);

    actions.appendChild(createButton('Select All', 'Select every title draft in this batch.', () => {
        setLoredeckCreatorTitleSelectionBulk('all');
    }));
    actions.appendChild(createButton('Clear Selection', 'Clear the current title draft selection.', () => {
        setLoredeckCreatorTitleSelectionBulk('none');
    }));
    return actions;
}

function createLoredeckCreatorTitleRevisionInput(container, value = '') {
    const label = document.createElement('label');
    label.className = 'saga-new-lore-field';
    const span = document.createElement('span');
    span.textContent = 'Title Revision';
    addTooltip(span, 'Instruction for revising selected title drafts before full entry generation.');
    label.appendChild(span);
    const input = document.createElement('textarea');
    input.className = 'saga-lore-editor-textarea';
    input.value = value || '';
    input.placeholder = 'Make Arlong Pirates titles harsher and more coercive without adding generic biography.';
    label.appendChild(input);
    container.appendChild(label);
    return input;
}

function createLoredeckCreatorTitleRevisionForm(brief = {}, cached = {}, context = {}) {
    const selectedCount = Number.isFinite(Number(context.selectedCount)) ? Number(context.selectedCount) : getLoredeckCreatorSelectedTitleDrafts(cached).length;
    const reviseForm = document.createElement('div');
    reviseForm.className = 'saga-new-lore-form saga-loredeck-creator-revise-form';
    const reviseInput = createLoredeckCreatorTitleRevisionInput(reviseForm, getLoredeckCreatorTitleRevisionInstruction());
    const reviseActions = document.createElement('div');
    reviseActions.className = 'saga-primary-actions';
    const reviseButton = createButton('Revise Selected Titles', 'Ask the Reasoning Provider to revise only the selected title drafts.', async (btn) => {
        const revisionInstruction = setLoredeckCreatorTitleRevisionInstruction(reviseInput.value.trim());
        const fresh = getLoredeckCreatorBriefCache();
        const draftInputs = getLoredeckCreatorDraftInputs();
        await handleLoredeckCreatorTitleDraft({
            brief: fresh.brief || brief,
            notes: fresh.notes || draftInputs.notes || '',
            revisionInstruction,
            previousTitleDrafts: getLoredeckCreatorTitleDrafts(fresh).map(compactLoredeckCreatorTitleDraftForRevision),
            selectedTitleDrafts: getLoredeckCreatorSelectedTitleDrafts(fresh).map(compactLoredeckCreatorTitleDraftForRevision),
        }, btn);
    });
    reviseButton.disabled = !selectedCount;
    reviseActions.appendChild(lockLoredeckCreatorGenerationButton(reviseButton, cached, 'title revision'));
    reviseForm.appendChild(reviseActions);
    appendLoredeckCreatorGenerationStatus(reviseForm, cached, ['title_revision']);
    return reviseForm;
}

function createLoredeckCreatorTitleRow(draft = {}, selected = false, approved = false) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-entry-row saga-loredeck-creator-title-row';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const titleLine = document.createElement('label');
    titleLine.className = 'saga-loredeck-assistant-draft-title saga-loredeck-creator-title-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    addTooltip(checkbox, selected ? 'Remove this title draft from the current selection.' : 'Add this title draft to the current selection.');
    checkbox.addEventListener('click', event => event.stopPropagation());
    checkbox.addEventListener('change', () => {
        setLoredeckCreatorTitleSelection(draft.titleId, checkbox.checked, { refresh: true });
    });
    titleLine.appendChild(checkbox);
    const title = document.createElement('span');
    title.className = 'saga-loredeck-row-title';
    title.textContent = draft.title || draft.titleId || 'Creator Title Draft';
    titleLine.appendChild(title);
    main.appendChild(titleLine);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    desc.textContent = draft.reason || draft.contextHint || 'Future lore-entry title draft.';
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(approved ? 'Approved' : 'Draft', approved ? 'Approved for the next Creator stage.' : 'Not approved for the next Creator stage yet.'));
    if (draft.category) meta.appendChild(createStatusPill(humanizeScopeKey(draft.category), 'Title category.'));
    if (draft.relevance) meta.appendChild(createStatusPill(`Relevance: ${humanizeScopeKey(draft.relevance)}`, 'Expected lore relevance.'));
    meta.appendChild(createStatusPill(`Priority ${Number.isFinite(Number(draft.priority)) ? Math.round(Number(draft.priority)) : 50}`, 'Draft priority from 0-100.'));
    if (draft.creatorTitleBatchLabel || draft.creatorTitleBatchId) meta.appendChild(createStatusPill(draft.creatorTitleBatchLabel || draft.creatorTitleBatchId, 'Creator title set that produced this draft.'));
    if (draft.contextHint) meta.appendChild(createStatusPill('Context hint', draft.contextHint));
    for (const tag of (draft.tags || []).slice(0, 6)) {
        meta.appendChild(createStatusPill(tag, 'Suggested tag hint.'));
    }
    if ((draft.tags || []).length > 6) meta.appendChild(createStatusPill(`+${draft.tags.length - 6} tags`, draft.tags.slice(6).join(', ')));
    const qualityChange = {
        preview: {
            rubric: draft.rubric || {},
            qualityWarnings: draft.warnings || [],
        },
    };
    appendLoredeckPendingQualityPills(meta, qualityChange);
    main.appendChild(meta);

    const quality = createLoredeckPendingQualityList(qualityChange);
    if (quality) main.appendChild(quality);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    const approve = createButton(approved ? 'Approved' : 'Approve', 'Approve this title draft for the next Creator stage.', () => {
        approveLoredeckCreatorTitleSelection(new Set([draft.titleId]));
    }, approved ? '' : 'saga-primary-button');
    approve.disabled = approved;
    actions.appendChild(approve);
    actions.appendChild(createButton('Edit JSON', 'Edit this title draft JSON before full entry generation.', () => {
        openLoredeckCreatorTitleJsonEditor(draft);
    }));
    actions.appendChild(createButton('Drop', 'Remove this title draft from the Creator batch.', () => {
        dropLoredeckCreatorTitleSelection(new Set([draft.titleId]));
    }, 'saga-danger-button'));
    row.appendChild(actions);
    return row;
}

function createLoredeckCreatorPlanningBatchPlanner(brief = {}, cached = {}) {
    const rows = getLoredeckCreatorPlanningBatchRows(cached);
    const queuedIds = getLoredeckCreatorPlanningQueuedBatchIds(cached);
    const nextBatch = getLoredeckCreatorNextPlanningBatch(cached);
    const section = document.createElement('div');
    section.className = 'saga-loredeck-creator-title-batches saga-loredeck-creator-planning-batches';

    const heading = document.createElement('div');
    heading.className = 'saga-loredeck-row-title';
    heading.textContent = 'Context & Tag Plan';
    section.appendChild(heading);

    for (const batch of rows.slice(0, 16)) {
        const queued = queuedIds.has(batch.id);
        const isNext = !queued && batch.approvedTitleCount > 0 && nextBatch?.id === batch.id;
        const row = document.createElement('div');
        row.className = 'saga-loredeck-entry-row saga-loredeck-creator-title-batch-row';
        const main = document.createElement('div');
        main.className = 'saga-loredeck-row-main';
        const label = document.createElement('div');
        label.className = 'saga-loredeck-row-title';
        label.textContent = batch.label || batch.id;
        main.appendChild(label);
        const desc = document.createElement('div');
        desc.className = 'saga-loredeck-row-description';
        desc.textContent = batch.summary || batch.contextRole || 'Approved-title set used for Context and Tag planning.';
        main.appendChild(desc);
        const meta = document.createElement('div');
        meta.className = 'saga-loredeck-row-meta';
        meta.appendChild(createStatusPill(queued ? 'Planned' : (isNext ? 'Next' : 'Waiting'), queued ? 'Context and tag proposals were already drafted for this title set.' : (isNext ? 'This is the next Context and Tag set Saga will plan.' : 'Approve and plan earlier title sets before this one.')));
        meta.appendChild(createStatusPill(`${batch.approvedTitleCount} approved title${batch.approvedTitleCount === 1 ? '' : 's'}`, 'Approved titles available to this planning batch.'));
        if (batch.type) meta.appendChild(createStatusPill(humanizeScopeKey(batch.type), 'Planning batch type.'));
        main.appendChild(meta);
        row.appendChild(main);

        const actions = document.createElement('div');
        actions.className = 'saga-loredeck-row-actions';
        if (isNext) {
            const planButton = createButton('Plan This Set', 'Draft Context anchors/windows and tag proposals for this title set.', async (btn) => {
                await handleLoredeckCreatorPlanningDraft({
                    targetPlanningBatch: batch,
                }, btn);
            }, 'saga-primary-button');
            actions.appendChild(lockLoredeckCreatorGenerationButton(planButton, cached, 'context/tag plan'));
        } else if (queued) {
            const doneButton = createButton('Done', 'This Context and Tag set is already in Pending Review.', null, 'saga-loredeck-creator-done-button');
            doneButton.disabled = true;
            actions.appendChild(doneButton);
        } else {
            actions.appendChild(createStatusPill('Waiting', 'This set unlocks after earlier eligible sets are planned.'));
        }
        row.appendChild(actions);
        section.appendChild(row);
    }

    if (rows.length > 16) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing 16 of ${rows.length} Context and Tag sets.`;
        section.appendChild(more);
    }
    return section;
}

export function createLoredeckCreatorPlanningCard(brief = {}, cached = {}) {
    const approvedTitles = getLoredeckCreatorTitleDrafts(cached)
        .filter(draft => getLoredeckCreatorApprovedTitleIds(cached).has(draft.titleId));
    const planningBatches = getLoredeckCreatorPlanningBatchRows(cached);
    const queuedBatchIds = getLoredeckCreatorPlanningQueuedBatchIds(cached);
    const eligiblePlanningBatchCount = planningBatches.filter(batch => batch.approvedTitleCount > 0).length;
    const nextPlanningBatch = getLoredeckCreatorNextPlanningBatch(cached);
    const generatedPack = cached.generatedPackId ? getLoredeckDefinition(cached.generatedPackId) : null;
    const pendingPlanningCount = generatedPack ? countLoredeckCreatorPlanningPendingChanges(generatedPack) : 0;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-brief saga-loredeck-creator-planning';
    wrap.dataset.sagaCreatorAnchor = 'context-tags';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Creator Context & Tags';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${approvedTitles.length} approved title${approvedTitles.length === 1 ? '' : 's'}`, 'Approved title drafts used to infer the Context and Tag planning shape.'));
    summary.appendChild(createStatusPill(`${queuedBatchIds.size}/${eligiblePlanningBatchCount} planned`, 'Context and Tag sets drafted from approved title sets.'));
    summary.appendChild(createStatusPill(generatedPack ? 'Generated shell ready' : 'No shell yet', 'Generated Loredeck shell status.'));
    if (generatedPack) summary.appendChild(createStatusPill(generatedPack.packId, 'Generated Loredeck target for Pending Review proposals.'));
    if (pendingPlanningCount) summary.appendChild(createStatusPill(`${pendingPlanningCount} awaiting review`, 'Context and Tag proposals waiting in Pending Review.'));
    if (cached.planningQueuedCount) summary.appendChild(createStatusPill(`${cached.planningQueuedCount} drafted`, 'Last Creator planning proposal count sent to Pending Review.'));
    if (cached.planningQuestions?.length) summary.appendChild(createStatusPill(`${cached.planningQuestions.length} question${cached.planningQuestions.length === 1 ? '' : 's'}`, 'Creator needs clarification before Context and Tag planning can proceed.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Context anchors/windows and tag definitions are drafted one title set at a time into the Generated Loredeck Pending Review. They do not become accepted registry data until reviewed.';
    wrap.appendChild(help);

    wrap.appendChild(createLoredeckCreatorPlanningBatchPlanner(brief, cached));

    if (cached.planningSummary || cached.planningQuestions?.length || cached.planningWarnings?.length) {
        const result = document.createElement('div');
        result.className = 'saga-runtime-help';
        const parts = [];
        if (cached.planningSummary) parts.push(cached.planningSummary);
        if (cached.planningQuestions?.length) parts.push(`Questions: ${cached.planningQuestions.join(' | ')}`);
        if (cached.planningWarnings?.length) parts.push(`Warnings: ${cached.planningWarnings.join(' | ')}`);
        result.textContent = parts.join(' ');
        wrap.appendChild(result);
    }

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const draftButton = createButton(
        nextPlanningBatch ? 'Plan Context and Tags' : (pendingPlanningCount ? 'Review Context and Tags' : 'Context Plans Complete'),
        nextPlanningBatch
            ? 'Create or reuse the Generated Loredeck shell, then draft Context and Tag proposals for the next approved title set.'
            : (pendingPlanningCount ? 'Open the Pending Review section to accept Context and Tag proposals.' : 'Every eligible Context and Tag set has already been planned.'),
        async (btn) => {
            const fresh = getLoredeckCreatorBriefCache();
            const batch = getLoredeckCreatorNextPlanningBatch(fresh);
            if (batch) {
                await handleLoredeckCreatorPlanningDraft({
                    targetPlanningBatch: batch,
                }, btn);
                return;
            }
            scrollLoredeckCreatorWorkbenchToAnchor('review-queue');
        },
        'saga-primary-button'
    );
    draftButton.disabled = !nextPlanningBatch && !pendingPlanningCount;
    actions.appendChild(lockLoredeckCreatorGenerationButton(draftButton, cached, 'context/tag plan'));
    if (generatedPack) {
        actions.appendChild(createButton('Inspect in Library', 'Open the Generated Loredeck in the fullscreen Loredeck Library details panel.', () => {
            openLoredeckLibraryDetails(generatedPack.packId);
        }));
        const inStack = getLoredeckStack(getState()).some(item => item.packId === generatedPack.packId && item.enabled);
        const stackButton = createButton(inStack ? 'In Stack' : 'Add to Stack', 'Add the Generated Loredeck to the current stack when you are ready to test it.', () => {
            if (!inStack) addLoredeckToStack(generatedPack.packId);
        });
        stackButton.disabled = inStack;
        actions.appendChild(stackButton);
    }
    wrap.appendChild(actions);

    if (!approvedTitles.length) {
        wrap.appendChild(createEmptyMessage('Approve title drafts before generating timeline and tag planning proposals.'));
    }
    return wrap;
}

export function createLoredeckCreatorEntryDraftCard(brief = {}, cached = {}) {
    const generationSettings = getLoredeckCreatorGenerationSettings(cached);
    const generatedPack = cached.generatedPackId ? getLoredeckDefinition(cached.generatedPackId) : null;
    const planning = getLoredeckCreatorAcceptedPlanningStatus(generatedPack);
    const acceptedPlanningBatchIds = getLoredeckCreatorPlanningAcceptedBatchIds(cached);
    const queuedPlanningBatchIds = getLoredeckCreatorPlanningQueuedBatchIds(cached);
    const approvedTitles = getLoredeckCreatorTitleDrafts(cached)
        .filter(draft => getLoredeckCreatorApprovedTitleIds(cached).has(draft.titleId));
    const draftChanges = generatedPack ? getLoredeckCreatorDraftChanges(generatedPack.packId) : [];
    const hasDraftsAwaitingReview = draftChanges.length > 0;
    const pendingCount = generatedPack ? getLoredeckCreatorPendingEntryCount(generatedPack) : 0;
    const entryCount = generatedPack ? getLoredeckCreatorAcceptedEntryCount(generatedPack) : 0;
    const progress = generatedPack ? getLoredeckCreatorEntryDraftProgress(cached, generatedPack) : null;
    const targetTitles = generatedPack ? getLoredeckCreatorEntryTargetTitles(cached, generatedPack) : [];
    const canDraftEntries = !!generatedPack && planning.ready && !!targetTitles.length && !hasDraftsAwaitingReview;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-brief saga-loredeck-creator-entry-drafts';
    wrap.dataset.sagaCreatorAnchor = 'lorecards';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Creator Lorecard Drafts';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${approvedTitles.length} approved title${approvedTitles.length === 1 ? '' : 's'}`, 'Approved title drafts available for schema v3 entry generation.'));
    summary.appendChild(createStatusPill(`${acceptedPlanningBatchIds.size}/${queuedPlanningBatchIds.size || acceptedPlanningBatchIds.size} Context sets accepted`, 'Creator Context and Tag sets accepted into the Generated Loredeck registry.'));
    summary.appendChild(createStatusPill(`${planning.anchorCount + planning.windowCount} timeline`, 'Accepted timeline anchors/windows on the Generated Loredeck.'));
    summary.appendChild(createStatusPill(`${planning.tagCount} tags`, 'Accepted tag definitions on the Generated Loredeck.'));
    if (progress) {
        summary.appendChild(createStatusPill(`${progress.remainingCount} remaining`, 'Approved titles not yet accepted, pending, or sitting in the Creator draft batch.'));
        if (progress.activeBatchLabel) summary.appendChild(createStatusPill(`Set: ${progress.activeBatchLabel}`, 'Accepted Context and Tag set used for the next Lorecard micro-batch.'));
        summary.appendChild(createStatusPill(`${progress.batchSize}/call`, 'Maximum Lorecards Saga asks the model to draft in one Creator call.'));
    }
    if (draftChanges.length) summary.appendChild(createStatusPill(`${draftChanges.length} awaiting review`, 'Generated Lorecard drafts waiting for edit-before-review.'));
    if (pendingCount) summary.appendChild(createStatusPill(`${pendingCount} pending`, 'Entry proposals already queued into Pending Review.'));
    if (entryCount) summary.appendChild(createStatusPill(`${entryCount} accepted`, 'Accepted generated Lorecards in this Generated Loredeck.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Lorecard drafts run in small resumable batches. Each model call receives only titles from one accepted Context and Tag set, then drafts enter review before Pending Review and acceptance.';
    wrap.appendChild(help);

    if (hasDraftsAwaitingReview) {
        const reviewHelp = document.createElement('div');
        reviewHelp.className = 'saga-runtime-help saga-loredeck-creator-review-blocker';
        reviewHelp.textContent = 'Review the current Lorecard drafts below before drafting more. Send useful drafts to Pending Review, edit or revise them, or drop the ones that do not fit.';
        wrap.appendChild(reviewHelp);
    }

    if (cached.entryDraftSummary || cached.entryDraftQuestions?.length || cached.entryDraftWarnings?.length) {
        const result = document.createElement('div');
        result.className = 'saga-runtime-help';
        const parts = [];
        if (cached.entryDraftSummary) parts.push(cached.entryDraftSummary);
        if (cached.entryDraftQuestions?.length) parts.push(`Questions: ${cached.entryDraftQuestions.join(' | ')}`);
        if (cached.entryDraftWarnings?.length) parts.push(`Warnings: ${cached.entryDraftWarnings.join(' | ')}`);
        result.textContent = parts.join(' ');
        wrap.appendChild(result);
    }

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const draftButton = createButton('Draft Lorecards', hasDraftsAwaitingReview ? 'Review the current Lorecard drafts before drafting more.' : 'Generate the next small schema v3 Lorecard set for approved titles that are not accepted, pending, or already drafted.', async (btn) => {
        await handleLoredeckCreatorEntryDraft(btn);
    }, 'saga-primary-button');
    draftButton.disabled = !canDraftEntries;
    actions.appendChild(lockLoredeckCreatorGenerationButton(draftButton, cached, 'Lorecard batch draft'));

    const entryRunLimit = Number.isFinite(Number(generationSettings.entryRunRemainingLimit))
        ? Number(generationSettings.entryRunRemainingLimit)
        : 1;
    const entryBatchSize = Number.isFinite(Number(generationSettings.entryBatchSize))
        ? Number(generationSettings.entryBatchSize)
        : 1;
    const multiBatchButton = createButton(`Auto-Draft Up To ${entryRunLimit}`, hasDraftsAwaitingReview ? 'Review the current Lorecard drafts before auto-drafting more.' : `Advanced: run up to ${entryRunLimit} separate small Lorecard drafting calls, stopping as soon as draft-review items exist.`, async (btn) => {
        const freshPack = cached.generatedPackId ? getFreshLoredeckLibraryPack(cached.generatedPackId, generatedPack) : null;
        const freshCache = getLoredeckCreatorBriefCache();
        const freshSettings = getLoredeckCreatorGenerationSettings(freshCache);
        const freshProgress = freshPack ? getLoredeckCreatorEntryDraftProgress(freshCache, freshPack) : null;
        const freshRunLimit = Number.isFinite(Number(freshSettings.entryRunRemainingLimit)) ? Number(freshSettings.entryRunRemainingLimit) : entryRunLimit;
        const freshBatchSize = Number.isFinite(Number(freshSettings.entryBatchSize)) ? Number(freshSettings.entryBatchSize) : entryBatchSize;
        const callCount = Math.min(freshRunLimit, freshProgress?.batchCount || 0);
        if (!callCount) return;
        const confirmed = await confirmAction('Auto-Draft Lorecards', `Saga will make up to ${callCount} separate Reasoning Provider call${callCount === 1 ? '' : 's'}, with at most ${freshBatchSize} Lorecards per call. It will stop as soon as the Creator Lorecard Draft Review has items. Continue?`);
        if (!confirmed) return;
        await handleLoredeckCreatorEntryDraft(btn, { maxBatches: freshRunLimit });
    });
    multiBatchButton.disabled = !canDraftEntries || (progress?.batchCount || 0) <= 1;
    actions.appendChild(lockLoredeckCreatorGenerationButton(multiBatchButton, cached, 'Lorecard batch draft'));
    if (generatedPack) {
        actions.appendChild(createButton('Inspect in Library', 'Open the Generated Loredeck in the fullscreen Loredeck Library details panel.', () => {
            openLoredeckLibraryDetails(generatedPack.packId);
        }));
    }
    wrap.appendChild(actions);
    appendLoredeckCreatorGenerationStatus(wrap, cached, ['entry_batch_draft', 'entry_multi_batch_draft']);

    if (!generatedPack) {
        wrap.appendChild(createEmptyMessage('Plan and accept Context and Tag proposals to create the Generated Loredeck shell before drafting Lorecards.'));
        return wrap;
    }
    if (!planning.ready) {
        wrap.appendChild(createEmptyMessage('Accept Context and Tag planning proposals before drafting full Lorecards.'));
        return wrap;
    }
    if (!progress?.eligibleBatchCount) {
        wrap.appendChild(createEmptyMessage('Accept at least one planned Context and Tag set before drafting full Lorecards.'));
        return wrap;
    }
    if (!targetTitles.length && !draftChanges.length) {
        wrap.appendChild(createEmptyMessage('No undrafted approved titles remain. Approve more titles or review existing Lorecard drafts.'));
    }
    if (targetTitles.length) {
        const next = document.createElement('div');
        next.className = 'saga-runtime-help';
        next.textContent = `Next batch: ${targetTitles.map(draft => draft.title || draft.titleId).join(' | ')}`;
        wrap.appendChild(next);
    }

    if (draftChanges.length) {
        const draftBatch = createLoredeckCreatorDraftReviewSection(generatedPack);
        if (draftBatch) wrap.appendChild(draftBatch);
    }
    return wrap;
}

export function createLoredeckCreatorPendingReviewCard(cached = {}, pipeline = {}) {
    const pack = pipeline.generatedPack || (cached.generatedPackId ? getLoredeckDefinition(cached.generatedPackId) : null);
    if (!pack) return null;
    const card = createLoredeckPendingReviewCard(pack);
    if (!card) return null;
    card.classList.add('saga-loredeck-creator-pending-review');
    card.dataset.sagaCreatorAnchor = 'review-queue';
    if (pipeline.pendingPlanningCount) {
        const note = document.createElement('div');
        note.className = 'saga-runtime-help';
        note.textContent = 'Next step: review and accept these Context and Tag proposals. Accepted planning metadata unlocks Lorecard drafting.';
        const insertBefore = card.children[2] || null;
        card.insertBefore(note, insertBefore);
    }
    return card;
}

function appendLoredeckCreatorReadinessItems(container, blockers = [], warnings = []) {
    if (!blockers.length && !warnings.length) return;
    const list = document.createElement('div');
    list.className = 'saga-loredeck-generated-readiness-list';
    for (const blocker of blockers) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-blocker';
        item.textContent = blocker;
        list.appendChild(item);
    }
    for (const warning of warnings) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-warning';
        item.textContent = warning;
        list.appendChild(item);
    }
    container.appendChild(list);
}

export function createLoredeckCreatorPipelineReadinessCard(pack = {}, cached = null) {
    const view = getLoredeckCreatorPipelineReadinessView(pack, cached);
    if (!view) return null;
    const readiness = view.readiness || {};
    const pipeline = view.pipeline || readiness.pipeline || {};
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-creator-brief saga-loredeck-generated-readiness saga-loredeck-creator-pipeline-readiness';
    wrap.dataset.sagaCreatorAnchor = 'finalize';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Creator Readiness Gate';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(readiness.ready ? 'Finalize ready' : 'Needs review', 'Generated Loredeck finalization gate after staged Creator review.'));
    summary.appendChild(createStatusPill(pipeline.statusLabel || 'Pipeline check', 'Creator pipeline completeness based on the persisted staged job.'));
    summary.appendChild(createStatusPill(`${pipeline.titleBatchDraftedCount || 0}/${pipeline.titleBatchCount || 0} title sets`, 'Title sets drafted from the approved Story Outline.'));
    summary.appendChild(createStatusPill(`${pipeline.acceptedPlanningBatchCount || 0}/${pipeline.eligiblePlanningBatchCount || 0} Context sets accepted`, 'Context and Tag sets accepted from Pending Review into the Generated Loredeck.'));
    summary.appendChild(createStatusPill(`${pipeline.approvedTitleAcceptedCount || 0}/${pipeline.approvedTitleCount || 0} titles accepted`, 'Approved title plan covered by accepted generated Lorecards.'));
    if (pipeline.remainingEntryCount) summary.appendChild(createStatusPill(`${pipeline.remainingEntryCount} remaining`, 'Approved titles still available for Creator entry drafting.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = readiness.ready
        ? 'This Generated Loredeck has no unresolved draft or Pending Review state. Warnings may still describe intentionally partial Creator coverage.'
        : 'Resolve the blockers below before finalizing this Generated Loredeck as Custom. Library export is still available.';
    wrap.appendChild(help);

    appendLoredeckCreatorReadinessItems(wrap, readiness.blockers, readiness.warnings);
    return wrap;
}

function getLoredeckCreatorCurrentTaskTitle(cached = {}, pipeline = {}) {
    if (pipeline.activeGeneration) return pipeline.activeGeneration.label || 'Generation running';
    const step = pipeline.currentStep || {};
    if (step.id === 'scope') return cached.brief && !cached.approved ? 'Review the Scope Brief' : 'Draft the Scope Brief';
    if (step.id === 'outline') return pipeline.outline && !cached.outlineApproved ? 'Review the Story Outline' : 'Draft the Story Outline';
    if (step.id === 'titles') return pipeline.approvedTitles?.length ? 'Approve More Titles or Continue' : 'Generate the Title Pass';
    if (step.id === 'context') return pipeline.plannedSetCount > pipeline.acceptedPlanningSetCount ? 'Review Context and Tag Proposals' : 'Plan Context and Tags';
    if (step.id === 'lorecards') return pipeline.draftChanges?.length ? 'Review Lorecard Drafts' : 'Draft Lorecards';
    if (step.id === 'review') return 'Clear the Review Queue';
    if (step.id === 'health') return 'Run Deck Health';
    if (step.id === 'finalize') return 'Finalize as Custom Loredeck';
    return 'Continue the Creator Pipeline';
}

function getLoredeckCreatorCurrentTaskDescription(cached = {}, pipeline = {}) {
    if (pipeline.activeGeneration) return 'Saga is waiting on the Reasoning Provider. Cached batches already completed by earlier calls remain preserved.';
    const step = pipeline.currentStep || {};
    if (step.id === 'scope') return cached.brief && !cached.approved
        ? 'Confirm the deck ID, coverage, assumptions, and risks before Saga uses them as the source of truth.'
        : 'Define the fandom, scope, granularity, assumptions, and risks before any large generation call.';
    if (step.id === 'outline') return pipeline.outline && !cached.outlineApproved
        ? 'Approve the story beats, Context milestones, title-batch slices, and risk notes before title generation.'
        : 'Saga will generate major story beats, high-value Context milestones, title-batch slices, and leakage-risk notes.';
    if (step.id === 'titles') return 'Review generated title rows for scene pressure, entities, Context gates, and risk before approving selected titles.';
    if (step.id === 'context') return 'Accept selected timeline anchors, windows, and tags into the Generated Loredeck before drafting Lorecards.';
    if (step.id === 'lorecards') return 'Draft small Lorecard batches, then edit, repair, drop, or send them to Pending Review.';
    if (step.id === 'review') return 'Pending changes are not runtime-active. Accept or reject them before Deck Health and finalization.';
    if (step.id === 'health') return 'Validate accepted data and fix blockers before this Generated Loredeck can become a Custom Loredeck.';
    if (step.id === 'finalize') return 'Create a normal editable Custom Loredeck from the reviewed Generated draft.';
    return 'Complete the current stage before moving forward.';
}

function createLoredeckCreatorCurrentTaskOutputs(pipeline = {}) {
    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-creator-output-grid';
    const outputsByStep = {
        scope: [
            ['Scope boundary', 'Fandom, story slice, granularity, assumptions, and risks.'],
            ['Deck identity', 'Stable generated deck ID and metadata.'],
            ['Leakage notes', 'Known spoiler, hidden-knowledge, or timing risks.'],
        ],
        outline: [
            ['Major story beats', 'Key events and turning points in the arc.'],
            ['Context milestones', 'High-value anchors and windows for gating.'],
            ['Title-batch slices', 'Suggested chunks for Title Pass generation.'],
            ['Risk notes', 'Potential future leaks and hidden knowledge.'],
        ],
        titles: [
            ['Review table', 'Keep, edit, drop, merge, split, or regenerate title drafts.'],
            ['Scene pressure', 'Titles should imply playable tension, not wiki biography.'],
            ['Context hints', 'Each title should point toward when it can safely activate.'],
        ],
        context: [
            ['Timeline anchors', 'Selectable Context points for this Loredeck.'],
            ['Tags', 'Character, faction, location, pressure, and secret tags.'],
            ['Usage links', 'Which approved titles depend on each proposed item.'],
        ],
        lorecards: [
            ['Small batches', 'Independent cached Lorecard draft batches.'],
            ['Review boundary', 'Drafts stay inactive until sent to Pending Review and accepted.'],
            ['Repair loop', 'Weak cards can be edited or repaired before queueing.'],
        ],
        review: [
            ['Draft only', 'Generated but not queued.'],
            ['Pending Review', 'Queued but not active.'],
            ['Accepted', 'Active in the Generated Loredeck.'],
        ],
        health: [
            ['Errors', 'Blockers that must be fixed before finalization.'],
            ['Warnings', 'Quality or metadata issues worth reviewing.'],
            ['Suggestions', 'Optional cleanup that should not block fun decks.'],
        ],
        finalize: [
            ['Custom Loredeck', 'A normal editable deck copied from the reviewed Generated draft.'],
            ['Health snapshot', 'Latest validation travels with the finalized deck.'],
        ],
    };
    const rows = outputsByStep[pipeline.currentStep?.id] || outputsByStep.scope;
    for (const [label, text] of rows) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-creator-output-item';
        const strong = document.createElement('strong');
        strong.textContent = label;
        item.appendChild(strong);
        const desc = document.createElement('span');
        desc.textContent = text;
        item.appendChild(desc);
        grid.appendChild(item);
    }
    return grid;
}

function createLoredeckCreatorCurrentSidebar(cached = {}, pipeline = {}) {
    const side = document.createElement('div');
    side.className = 'saga-loredeck-creator-current-sidebar';
    side.appendChild(createLoredeckCreatorInputsPanel(cached, pipeline));
    side.appendChild(createLoredeckCreatorGuidancePanel(pipeline));
    side.appendChild(createLoredeckCreatorQueuePanel(pipeline));
    side.appendChild(createLoredeckCreatorJobPanel(cached, pipeline));
    return side;
}

function createLoredeckCreatorInputsPanel(cached = {}, pipeline = {}) {
    const panel = document.createElement('div');
    panel.className = 'saga-loredeck-creator-side-panel';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-creator-side-title';
    title.textContent = 'Inputs';
    panel.appendChild(title);
    const list = document.createElement('div');
    list.className = 'saga-loredeck-creator-side-list';
    const brief = cached.brief || {};
    const draft = getLoredeckCreatorDraftInputs();
    const rows = [
        ['Scope Brief', cached.approved ? 'Approved' : (cached.brief ? 'Drafted' : 'Missing')],
        ['Fandom', brief.fandom || cached.fandom || draft.fandom || '-'],
        ['Scope', brief.scope || cached.scope || draft.scope || '-'],
        ['Granularity', formatLoredeckCreatorGranularity(brief.granularity || cached.granularity || draft.granularity || 'focused')],
    ];
    if (pipeline.outline) rows.push(['Outline', cached.outlineApproved ? 'Approved' : 'Drafted']);
    if (pipeline.approvedTitles?.length) rows.push(['Approved titles', String(pipeline.approvedTitles.length)]);
    for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'saga-loredeck-creator-side-row';
        const key = document.createElement('span');
        key.textContent = label;
        row.appendChild(key);
        const val = document.createElement('strong');
        val.textContent = value;
        row.appendChild(val);
        list.appendChild(row);
    }
    panel.appendChild(list);
    return panel;
}

function createLoredeckCreatorGuidancePanel(pipeline = {}) {
    const panel = document.createElement('div');
    panel.className = 'saga-loredeck-creator-side-panel';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-creator-side-title';
    title.textContent = 'Guidance';
    panel.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'saga-loredeck-creator-check-list';
    const items = pipeline.currentStep?.id === 'outline'
        ? ['Story beats', 'Context milestones', 'Title-batch slices', 'Risks and assumptions']
        : pipeline.currentStep?.id === 'titles'
            ? ['Status', 'Title', 'Beat', 'Primary entities', 'Context gate', 'Risk']
            : ['Generate', 'Review', 'Approve', 'Unlock next stage'];
    for (const item of items) {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    }
    panel.appendChild(list);
    return panel;
}

function createLoredeckCreatorQueuePanel(pipeline = {}) {
    const panel = document.createElement('div');
    panel.className = 'saga-loredeck-creator-side-panel';
    panel.dataset.sagaCreatorAnchor = 'review-status';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-creator-side-title';
    title.textContent = 'Pending Review';
    panel.appendChild(title);
    const rows = [
        ['Planning proposals', pipeline.pendingPlanningCount || 0],
        ['Lorecard drafts', pipeline.draftChanges?.length || 0],
        ['Pending Lorecards', pipeline.pendingLorecardCount || 0],
        ['Repairs / fixes', pipeline.repairCount || 0],
    ];
    for (const [label, count] of rows) {
        const row = document.createElement('div');
        row.className = 'saga-loredeck-creator-queue-row';
        const name = document.createElement('span');
        name.textContent = label;
        row.appendChild(name);
        const value = document.createElement('strong');
        value.textContent = String(count);
        row.appendChild(value);
        panel.appendChild(row);
    }
    return panel;
}

function createLoredeckCreatorJobPanel(cached = {}, pipeline = {}) {
    const panel = document.createElement('div');
    panel.className = 'saga-loredeck-creator-side-panel';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-creator-side-title';
    title.textContent = 'Job & Cache';
    panel.appendChild(title);
    const active = pipeline.activeGeneration;
    const interrupted = String(cached.lastGenerationResult?.status || '').toLowerCase() === 'interrupted';
    const failedUnit = getLoredeckCreatorLatestRecoverableUnit(cached);
    const rows = [
        ['Status', active ? 'Running' : (interrupted ? 'Interrupted' : 'Idle')],
        ['Cached batches', String((cached.titleBatchDraftedIds || []).length + (cached.planningBatchQueuedIds || []).length)],
        ['Drafted items', String((pipeline.draftChanges || []).length)],
        ...(failedUnit ? [['Recoverable', formatLoredeckCreatorRecoveryStageLabel(failedUnit)]] : []),
        ['Last activity', cached.updatedAt ? formatRelativeHealthTime(cached.updatedAt) : '-'],
    ];
    for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'saga-loredeck-creator-side-row';
        const key = document.createElement('span');
        key.textContent = label;
        row.appendChild(key);
        const val = document.createElement('strong');
        val.textContent = value;
        row.appendChild(val);
        panel.appendChild(row);
    }
    return panel;
}

export function formatLoredeckCreatorGenerationElapsed(ms = 0) {
    const seconds = Math.max(0, Math.floor(Number(ms) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function formatLoredeckCreatorLiveSnippet(text = '', limit = 760) {
    const clean = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
    if (!clean) return '';
    if (clean.length <= limit) return clean;
    return `...${clean.slice(-limit)}`;
}

export function getLoredeckCreatorGenerationWaitMessage(generation = {}) {
    const elapsed = Math.max(0, Date.now() - Number(generation.startedAt || Date.now()));
    if (Number(generation.receivedChars || 0) > 0) return generation.message || 'Receiving visible response...';
    if (generation.phase === 'reasoning') return generation.message || 'Model is reasoning; visible response has not started yet.';
    if (elapsed >= 60000) return 'Still running. This stage may be too large for the selected model.';
    if (elapsed >= 30000) return 'The model is still thinking. Large generations can take a while.';
    if (elapsed >= 10000) return 'Still waiting for the model...';
    return generation.message || 'Waiting for model response...';
}

function loredeckCreatorGenerationMatches(model = null, actionIds = [], options = {}) {
    if (!model?.actionId) return false;
    const ids = Array.isArray(actionIds) ? actionIds : [actionIds];
    if (ids.length && !ids.includes(model.actionId)) return false;
    if (options.batchId && model.batchId && model.batchId !== options.batchId) return false;
    return true;
}

export function createLoredeckCreatorGenerationStatus(cached = {}, actionIds = [], options = {}) {
    const active = loredeckCreatorGenerationMatches(cached.activeGeneration, actionIds, options) ? cached.activeGeneration : null;
    const result = !active && loredeckCreatorGenerationMatches(cached.lastGenerationResult, actionIds, options) ? cached.lastGenerationResult : null;
    const model = active || result;
    if (!model) return null;

    const row = document.createElement('div');
    row.className = `saga-generation-live-status saga-generation-live-status-${active ? 'running' : model.status || 'complete'}`;
    if (options.compact) row.classList.add('saga-generation-live-status-compact');

    const icon = document.createElement('div');
    icon.className = active ? 'saga-generation-thinking-icon' : 'saga-generation-result-icon';
    const status = String(model.status || '').toLowerCase();
    icon.textContent = active ? '' : (['error', 'failed', 'interrupted'].includes(status) ? '!' : status === 'cancelled' ? 'X' : status === 'warning' ? '?' : 'OK');
    row.appendChild(icon);

    const main = document.createElement('div');
    main.className = 'saga-generation-live-main';
    const line = document.createElement('div');
    line.className = 'saga-generation-live-line';
    const label = document.createElement('span');
    label.className = 'saga-generation-live-label';
    label.textContent = model.label || 'Generation';
    line.appendChild(label);
    const text = document.createElement('span');
    text.className = 'saga-generation-live-text';
    text.textContent = active
        ? getLoredeckCreatorGenerationWaitMessage(model)
        : (model.message || (status === 'interrupted' ? 'Previous generation was interrupted. Review saved batches, then rerun this stage.' : 'Generation complete.'));
    line.appendChild(text);
    const elapsed = document.createElement('span');
    elapsed.className = 'saga-generation-live-elapsed';
    elapsed.textContent = formatLoredeckCreatorGenerationElapsed(active ? Date.now() - Number(model.startedAt || Date.now()) : model.elapsedMs);
    line.appendChild(elapsed);
    if (active) {
        const cancel = createButton('Cancel', 'Cancel this generation. Any late provider response will be ignored.', () => {
            cancelLoredeckCreatorGeneration(model.id);
        }, 'saga-generation-cancel-button');
        line.appendChild(cancel);
    }
    main.appendChild(line);

    const meta = document.createElement('div');
    meta.className = 'saga-generation-live-meta';
    const streamText = model.streamSupported === true ? 'streaming' : model.streamSupported === false ? 'final response' : 'provider pending';
    const chars = Number(model.receivedChars || 0);
    meta.textContent = `${streamText}${chars ? ` | ${chars} chars` : ''}${model.batchLabel ? ` | ${model.batchLabel}` : ''}`;
    main.appendChild(meta);

    row.appendChild(main);
    return row;
}

export function appendLoredeckCreatorGenerationStatus(container, cached = {}, actionIds = [], options = {}) {
    const row = createLoredeckCreatorGenerationStatus(cached, actionIds, options);
    if (row) container.appendChild(row);
    return row;
}
