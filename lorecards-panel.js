import {
    getPanelLoreState,
    getLoreRelevanceCounts,
    normalizeLoreMatrix,
    normalizeLoreEntry,
    normalizeLoreTag,
} from './lore-matrix.js';
import {
    LORE_CATEGORY_VALUES,
    LORE_PURPOSE_LABELS,
    LORE_RELEVANCE_LABELS,
    LORE_RELEVANCE_TIERS,
    normalizeLorePurpose,
    normalizeLoreRelevance,
} from './lore-relevance.js';
import {
    addTooltip,
    createBadge,
    createButton,
    createEmptyMessage,
    confirmAction,
    createIconButton,
    createKeyValue,
    createSectionHeader,
    formatLoreScope,
    getLoreScopeSpecificity,
    hasDisplayableScope,
    humanizeScopeKey,
    isPlainObjectValue,
    wireOverlayBackdropClose,
} from './runtime-ui-kit.js';
import {
    truncateCleanText as truncateText,
} from './runtime-formatters.js';
import {
    createLoreTimelineCard,
} from './lore-timeline-panel.js';
import {
    acceptPendingLoreEntries as acceptPendingLoreEntriesInState,
    rejectPendingLoreEntries as rejectPendingLoreEntriesInState,
    acceptPendingLoreEntry as acceptPendingLoreEntryInState,
    rejectPendingLoreEntry as rejectPendingLoreEntryInState,
} from './state-manager.js';

let lorecardsPanelDeps = {};
let acceptedLoreSearchRenderTimer = null;
const LORE_WORKBENCH_ID = 'saga-lore-workbench';
let loreWorkbenchSearchTimer = null;
let loreWorkbenchOpen = false;
let loreWorkbenchMode = 'accepted';
let loreWorkbenchSelectedId = '';
let loreWorkbenchPendingQuery = '';
let loreWorkbenchFocusSelector = '';
const loreWorkbenchScrollState = { accepted: 0, pending: 0 };

const AUTO_RELEVANCE_SETTING_KEYS = Object.freeze([
    'autoRelevanceEnabled',
    'autoRelevanceMode',
    'autoRelevanceEveryTurns',
    'autoRelevanceRecentMessages',
    'autoRelevanceCandidateCap',
    'autoRelevanceMinConfidence',
    'autoRelevanceNearFutureDays',
    'autoRelevanceRecentPastDays',
    'autoRelevanceProtectPinned',
    'autoRelevanceEvaluateMuted',
    'autoRelevanceUseModel',
    'autoRelevanceModelCandidateCap',
    'autoRelevanceModelMaxTokens',
    'autoRelevanceModelRecentChars',
]);

const RELEVANCE_META = Object.freeze({
    high: { label: 'High', color: '#166534', textColor: '#dcfce7', tooltip: 'Current-scene or immediate story relevance. Injects in the High-Relevance lore group.' },
    normal: { label: 'Normal', color: '#1e3a8a', textColor: '#dbeafe', tooltip: 'Recent, branch-defining, or medium-range story relevance. Injects in the Normal-Relevance lore group.' },
    low: { label: 'Low', color: '#4b5563', textColor: '#f9fafb', tooltip: 'Long-term background or distant past/future lore. Injects in the Low-Relevance lore group if enabled.' },
});

const LORE_ENTRY_TYPE_FILTERS = Object.freeze([
    ['all', 'Type: All'],
    ['high', 'High Relevance'],
    ['normal', 'Normal Relevance'],
    ['low', 'Low Relevance'],
    ['character', 'Character'],
    ['event', 'Event'],
    ['faction', 'Faction'],
    ['relationship', 'Relationship'],
    ['knowledge', 'Knowledge'],
    ['future_guard', 'Future Guard'],
    ['item', 'Item / Artifact'],
    ['location', 'Location / Place'],
    ['spell', 'Spell / Ability'],
    ['rule', 'Rule / System'],
    ['canon', 'Canon'],
    ['au', 'AU'],
    ['pinned', 'Pinned'],
    ['muted', 'Muted'],
]);

export function configureLorecardsPanel(deps = {}) {
    lorecardsPanelDeps = { ...lorecardsPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = lorecardsPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Lorecards panel dependency is not configured: ${name}`);
}

function isBasicExperience() {
    return dep('isBasicExperience', () => false)();
}

function getSettings() {
    return dep('getSettings', () => ({}))();
}

function saveSettings(settings) {
    return dep('saveSettings', () => null)(settings);
}

function markTourTarget(el, target) {
    return dep('markTourTarget', element => element)(el, target);
}

function createCollapsibleSection(...args) {
    return dep('createCollapsibleSection')(...args);
}

function getSelectedLoreInjectionCount(state, settings) {
    return dep('getSelectedLoreInjectionCount', () => 0)(state, settings);
}

function getPendingLoreBatchLabel(state) {
    const meta = state?.pendingLoreMeta || {};
    const parts = [];
    if (meta.createdAt) parts.push(`Generated ${new Date(meta.createdAt).toLocaleString()}`);
    if (meta.status) parts.push(`status: ${meta.status}`);
    if (meta.generationMode) parts.push(`${meta.generationMode} mode`);
    if (meta.targetEntryCount) parts.push(`target ${meta.targetEntryCount}`);
    if (meta.validEntryCount !== undefined) parts.push(`${meta.validEntryCount} valid`);
    if (meta.rawEntryCount !== undefined) parts.push(`${meta.rawEntryCount} raw`);
    if (meta.normalizedEntryCount !== undefined) parts.push(`${meta.normalizedEntryCount} normalized`);
    if (meta.droppedDuplicateCount) parts.push(`${meta.droppedDuplicateCount} duplicates filtered`);
    if (meta.droppedEntryCount) parts.push(`${meta.droppedEntryCount} dropped`);
    if (meta.chunkCount) parts.push(`${meta.chunkCount} chunks`);
    if (meta.sourceMessageCount) parts.push(`${meta.sourceMessageCount} source messages`);
    return parts.length ? parts.join(' | ') : 'Pending lore batch awaiting review.';
}

function createLoreWorkbenchLaunchRow(mode, summaryText) {
    const row = document.createElement('div');
    row.className = 'saga-lore-workbench-launch-row';
    markTourTarget(row, mode === 'pending' ? 'lore.pending.workbench' : 'lore.accepted.workbench');

    const text = document.createElement('div');
    text.className = 'saga-lore-workbench-launch-text';
    text.textContent = summaryText || (mode === 'pending' ? 'Review pending lore in a larger surface.' : 'Manage accepted lore in a larger surface.');
    row.appendChild(text);

    const btn = createButton(
        'Open Workbench',
        mode === 'pending'
            ? 'Open a larger Pending Lore Review workspace with dense rows and a detail pane.'
            : 'Open a larger Accepted Lore workspace with filters, bulk actions, dense rows, and a detail pane.',
        () => openLoreWorkbench(mode),
        'saga-small-button saga-lore-workbench-open-button'
    );
    row.appendChild(btn);
    return row;
}

function openAdvancedLoreReview(mode = '') {
    setExperienceMode('advanced');
    setPanelState({ activeTab: 'lore' });
    refreshPanelBody({ preserveScroll: false });
    refreshHeader();
    if (mode) openLoreWorkbench(mode);
}

function openLoreWorkbench(mode = 'accepted') {
    loreWorkbenchOpen = true;
    loreWorkbenchMode = mode === 'pending' ? 'pending' : 'accepted';
    ensureLoreWorkbenchSelection(getState());
    renderLoreWorkbench();
}

function closeLoreWorkbench() {
    flushScheduledStateSave();
    loreWorkbenchOpen = false;
    const existing = document.getElementById(LORE_WORKBENCH_ID);
    if (existing) existing.remove();
}

export function refreshLoreWorkbench() {
    if (!loreWorkbenchOpen) return;
    ensureLoreWorkbenchSelection(getState());
    renderLoreWorkbench();
}

function scheduleLoreWorkbenchRefresh() {
    if (loreWorkbenchSearchTimer) clearTimeout(loreWorkbenchSearchTimer);
    loreWorkbenchSearchTimer = setTimeout(() => {
        loreWorkbenchSearchTimer = null;
        refreshLoreWorkbench();
    }, getSearchRenderDebounceMs());
}

function ensureLoreWorkbenchSelection(state = getState()) {
    if (loreWorkbenchMode === 'pending') {
        const rows = getPendingWorkbenchRows(state);
        if (!rows.some(row => getLoreReviewId(row.entry) === loreWorkbenchSelectedId)) {
            loreWorkbenchSelectedId = rows[0] ? getLoreReviewId(rows[0].entry) : '';
        }
        return;
    }

    const accepted = getFilteredLoreEntries(state);
    if (!accepted.some(entry => entry.id === loreWorkbenchSelectedId)) {
        loreWorkbenchSelectedId = accepted[0]?.id || '';
    }
}

function renderLoreWorkbench() {
    if (!loreWorkbenchOpen) return;
    const state = getState();
    ensureLoreWorkbenchSelection(state);

    let overlay = document.getElementById(LORE_WORKBENCH_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = LORE_WORKBENCH_ID;
        overlay.className = 'saga-lore-workbench-overlay';
        overlay.tabIndex = -1;
        wireOverlayBackdropClose(overlay, closeLoreWorkbench);
        overlay.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeLoreWorkbench();
        });
        document.body.appendChild(overlay);
    }

    const previousTable = overlay.querySelector?.('.saga-lore-workbench-table');
    if (previousTable) loreWorkbenchScrollState[loreWorkbenchMode] = previousTable.scrollTop || 0;

    const focusSelector = loreWorkbenchFocusSelector;
    loreWorkbenchFocusSelector = '';
    overlay.replaceChildren(createLoreWorkbenchShell(state));
    requestAnimationFrame(() => {
        const focusTarget = focusSelector ? overlay.querySelector(focusSelector) : overlay;
        focusTarget?.focus?.();
        if (focusTarget && typeof focusTarget.setSelectionRange === 'function') {
            const len = String(focusTarget.value || '').length;
            focusTarget.setSelectionRange(len, len);
        }
        const table = overlay.querySelector?.('.saga-lore-workbench-table');
        if (table) table.scrollTop = loreWorkbenchScrollState[loreWorkbenchMode] || 0;
    });
}

function createLoreWorkbenchShell(state) {
    const shell = document.createElement('div');
    shell.className = 'saga-lore-workbench-shell';
    shell.addEventListener('click', event => event.stopPropagation());

    shell.appendChild(createLoreWorkbenchHeader(state));

    const body = document.createElement('div');
    body.className = 'saga-lore-workbench-body';
    body.appendChild(loreWorkbenchMode === 'pending'
        ? createPendingLoreWorkbenchView(state)
        : createAcceptedLoreWorkbenchView(state));
    shell.appendChild(body);

    return shell;
}

function createLoreWorkbenchHeader(state) {
    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Lore Workbench';
    titleWrap.appendChild(title);

    const acceptedCount = normalizeLoreMatrix(state?.loreMatrix || []).length;
    const pendingCount = normalizeLoreMatrix(state?.pendingLoreEntries || []).length;
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${acceptedCount} accepted | ${pendingCount} pending`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);

    const modeTabs = document.createElement('div');
    modeTabs.className = 'saga-lore-workbench-mode-tabs';
    for (const [mode, label, count] of [
        ['accepted', 'Accepted', acceptedCount],
        ['pending', 'Pending', pendingCount],
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'saga-lore-workbench-mode-tab';
        if (loreWorkbenchMode === mode) btn.classList.add('saga-lore-workbench-mode-tab-active');
        btn.textContent = `${label} (${count})`;
        btn.addEventListener('click', () => {
            loreWorkbenchMode = mode;
            loreWorkbenchSelectedId = '';
            ensureLoreWorkbenchSelection(getState());
            renderLoreWorkbench();
        });
        modeTabs.appendChild(btn);
    }
    header.appendChild(modeTabs);

    const close = createButton('Close', 'Close the Lore Workbench.', () => closeLoreWorkbench(), 'saga-small-button saga-lore-workbench-close');
    header.appendChild(close);
    return header;
}

function createAcceptedLoreWorkbenchView(state) {
    const view = document.createElement('div');
    view.className = 'saga-lore-workbench-view saga-lore-workbench-view-accepted';

    view.appendChild(createAcceptedWorkbenchControls(state));

    const bulk = document.createElement('div');
    bulk.className = 'saga-workbench-bulk-toolbar saga-workbench-accepted-bulk-toolbar';
    bulk.appendChild(createAcceptedLoreBulkControls(state));
    view.appendChild(bulk);

    const main = document.createElement('div');
    main.className = 'saga-lore-workbench-main';

    const filtered = getFilteredLoreEntries(state);
    main.appendChild(createAcceptedWorkbenchTable(filtered, state));
    main.appendChild(createAcceptedWorkbenchDetail(filtered, state));
    view.appendChild(main);

    return view;
}

function createAcceptedWorkbenchControls(state) {
    const controls = document.createElement('div');
    controls.className = 'saga-lore-workbench-controls';
    const panelState = state?.lorePanel || {};
    const loreState = getPanelLoreState(state);

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'saga-lore-workbench-search';
    search.dataset.workbenchFocus = 'accepted-search';
    search.placeholder = 'Search accepted lore...';
    search.value = panelState.search || '';
    search.addEventListener('input', () => {
        setPanelState({ search: search.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        loreWorkbenchFocusSelector = '[data-workbench-focus="accepted-search"]';
        scheduleAcceptedLoreListRender(getPanelRoot());
        scheduleLoreWorkbenchRefresh();
    });
    controls.appendChild(search);

    const category = document.createElement('select');
    category.className = 'saga-lore-workbench-select';
    for (const cat of loreState.categories || ['all']) {
        if (cat === 'pending') continue;
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = `${getLoreDisplayLabel('category', cat)} (${getCategoryCount(cat, loreState.entries, loreState.counts)})`;
        if ((panelState.selectedCategory || 'all') === cat) opt.selected = true;
        category.appendChild(opt);
    }
    category.addEventListener('change', () => {
        setPanelState({ selectedCategory: category.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        refreshAcceptedLoreCategoryTabs(category.value);
        refreshAcceptedLoreFilterResults({ resetListScroll: true });
        refreshLoreWorkbench();
    });
    controls.appendChild(category);

    const source = document.createElement('select');
    source.className = 'saga-lore-workbench-select';
    for (const [value, label] of [
        ['all', 'Source: All'],
        ['canon-db', 'Canon Database'],
        ['story-generation', 'Story Generation'],
        ['manual', 'Manual / User'],
    ]) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        if ((panelState.sourceFilter || 'all') === value) opt.selected = true;
        source.appendChild(opt);
    }
    source.addEventListener('change', () => {
        setPanelState({ sourceFilter: source.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        refreshAcceptedLoreFilterResults({ resetListScroll: true });
        refreshLoreWorkbench();
    });
    controls.appendChild(source);

    const acceptedPool = (loreState.entries || []).filter(entry => !entry.isPending);
    controls.appendChild(createLoreTypeFilterSelect(
        acceptedPool,
        panelState.loreTypeFilter || 'all',
        (value) => {
            setPanelState({ loreTypeFilter: value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
            refreshAcceptedLoreFilterResults({ resetListScroll: true });
            refreshLoreWorkbench();
        },
        { className: 'saga-lore-workbench-select', tooltip: 'Filter accepted Lorecards by relevance, card type, canon/AU, pin, or mute state.' }
    ));

    const count = document.createElement('div');
    count.className = 'saga-lore-workbench-count';
    count.textContent = `${getFilteredLoreEntries(state).length} matching`;
    controls.appendChild(count);

    return controls;
}

function createAcceptedWorkbenchTable(entries, state) {
    const table = document.createElement('div');
    table.className = 'saga-lore-workbench-table saga-lore-workbench-accepted-table';

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-row saga-lore-workbench-row-header';
    for (const label of ['', 'Title', 'Relevance', 'Source', 'Category', 'Canon', 'Priority', 'Flags']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    const visible = entries.slice(0, getLoreWorkbenchRowLimit());
    if (!visible.length) {
        table.appendChild(createEmptyMessage('No accepted lore entries match the current filters.'));
        return table;
    }

    const selected = getAcceptedSelectionSet(state);
    for (const entry of visible) {
        const row = document.createElement('div');
        row.className = 'saga-lore-workbench-row saga-lore-workbench-entry-row';
        if (entry.id === loreWorkbenchSelectedId) row.classList.add('saga-lore-workbench-row-active');
        row.addEventListener('click', () => {
            loreWorkbenchSelectedId = entry.id;
            renderLoreWorkbench();
        });

        const checkCell = document.createElement('div');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = selected.has(entry.id);
        check.addEventListener('click', event => event.stopPropagation());
        check.addEventListener('change', () => {
            toggleAcceptedLoreSelection(entry.id, check.checked);
            refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
            refreshLoreWorkbench();
        });
        checkCell.appendChild(check);
        row.appendChild(checkCell);

        row.appendChild(createWorkbenchTextCell(entry.title || '(Untitled lore)', entry.fact || ''));
        row.appendChild(createWorkbenchTextCell(RELEVANCE_META[getLifecycleStatus(entry)]?.label || getLifecycleStatus(entry)));
        row.appendChild(createWorkbenchTextCell(getLoreSourceBucketLabel(getLoreSourceBucket(entry))));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('category', entry.category || 'other')));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('canonStatus', entry.canon || entry.canonStatus || 'canon')));
        row.appendChild(createWorkbenchTextCell(`P${Number(entry.priority || 50)}`));
        row.appendChild(createWorkbenchTextCell([
            entry.isPinned ? 'Pinned' : '',
            entry.isSuppressed ? 'Muted' : '',
        ].filter(Boolean).join(', ') || '-'));

        table.appendChild(row);
    }

    if (entries.length > visible.length) {
        const more = document.createElement('div');
        more.className = 'saga-lore-workbench-row-note';
        more.textContent = `Showing first ${visible.length} of ${entries.length} matching entries. Narrow filters or search to reduce the set.`;
        table.appendChild(more);
    }

    return table;
}

function createAcceptedWorkbenchDetail(entries, state) {
    const detail = document.createElement('div');
    detail.className = 'saga-lore-workbench-detail';

    const entry = entries.find(item => item.id === loreWorkbenchSelectedId) || entries[0];
    if (!entry) {
        detail.appendChild(createEmptyMessage('Select an accepted lore entry to inspect it.'));
        return detail;
    }

    const detailState = {
        ...state,
        lorePanel: {
            ...(state?.lorePanel || {}),
            selectedEntryId: entry.id,
        },
    };
    const card = createEntryCard(entry, detailState);
    card.classList.add('saga-lore-workbench-detail-card');
    detail.appendChild(card);
    return detail;
}

function createPendingLoreWorkbenchView(state) {
    const view = document.createElement('div');
    view.className = 'saga-lore-workbench-view saga-lore-workbench-view-pending';

    view.appendChild(createPendingWorkbenchControls(state));

    const pending = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    if (pending.length) {
        const bulk = document.createElement('div');
        bulk.className = 'saga-workbench-bulk-toolbar saga-workbench-pending-bulk-toolbar';
        bulk.appendChild(createPendingLoreBulkControls(pending, state));
        view.appendChild(bulk);
    }

    const main = document.createElement('div');
    main.className = 'saga-lore-workbench-main';
    const rows = getPendingWorkbenchRows(state);
    main.appendChild(createPendingWorkbenchTable(rows, state));
    main.appendChild(createPendingWorkbenchDetail(rows, state));
    view.appendChild(main);

    return view;
}

function createPendingWorkbenchControls(state) {
    const controls = document.createElement('div');
    controls.className = 'saga-lore-workbench-controls';

    const search = document.createElement('input');
    search.type = 'text';
    search.className = 'saga-lore-workbench-search';
    search.dataset.workbenchFocus = 'pending-search';
    search.placeholder = 'Search pending lore...';
    search.value = loreWorkbenchPendingQuery || '';
    search.addEventListener('input', () => {
        loreWorkbenchPendingQuery = search.value;
        loreWorkbenchFocusSelector = '[data-workbench-focus="pending-search"]';
        scheduleLoreWorkbenchRefresh();
    });
    controls.appendChild(search);

    const pendingPool = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    controls.appendChild(createLoreTypeFilterSelect(
        pendingPool,
        getPendingReviewTypeFilter(state),
        (value) => {
            setPendingReviewTypeFilter(value);
            loreWorkbenchSelectedId = '';
            refreshLoreWorkbench();
        },
        { className: 'saga-lore-workbench-select', tooltip: 'Filter pending Lorecards by relevance, card type, canon/AU, pin, or mute state.' }
    ));

    const rows = getPendingWorkbenchRows(state);
    const count = document.createElement('div');
    count.className = 'saga-lore-workbench-count';
    count.textContent = `${rows.length} matching pending`;
    controls.appendChild(count);

    const selectFiltered = createButton('Select Filtered', 'Select every pending entry matching the current Workbench search and type filter.', () => {
        setPendingReviewSelection(rows.map(row => getLoreReviewId(row.entry)));
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    }, 'saga-small-button');
    controls.appendChild(selectFiltered);

    const clear = createButton('Clear Selection', 'Clear pending lore selection.', () => {
        clearPendingReviewSelection();
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    }, 'saga-small-button');
    controls.appendChild(clear);

    return controls;
}

function createPendingWorkbenchTable(rows, state) {
    const table = document.createElement('div');
    table.className = 'saga-lore-workbench-table saga-lore-workbench-pending-table';

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-row saga-lore-workbench-row-header';
    for (const label of ['', 'Title', 'Operation', 'Route', 'Category', 'Canon', 'Priority']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    const visible = rows.slice(0, getLoreWorkbenchRowLimit());
    if (!visible.length) {
        table.appendChild(createEmptyMessage('No pending lore entries match the current search.'));
        return table;
    }

    const selected = getPendingReviewSelectedIds(state);
    for (const rowInfo of visible) {
        const entry = rowInfo.entry;
        const reviewId = getLoreReviewId(entry);
        const generation = entry.extensions?.sagaGeneration || {};
        const reviewMeta = entry.extensions?.sagaPendingReview || {};
        const row = document.createElement('div');
        row.className = 'saga-lore-workbench-row saga-lore-workbench-entry-row';
        if (reviewId === loreWorkbenchSelectedId) row.classList.add('saga-lore-workbench-row-active');
        row.addEventListener('click', () => {
            loreWorkbenchSelectedId = reviewId;
            renderLoreWorkbench();
        });

        const checkCell = document.createElement('div');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = selected.has(reviewId);
        check.addEventListener('click', event => event.stopPropagation());
        check.addEventListener('change', () => {
            togglePendingReviewSelection(reviewId, check.checked);
            refreshPanelBody({ preserveScroll: true });
            refreshLoreWorkbench();
        });
        checkCell.appendChild(check);
        row.appendChild(checkCell);

        row.appendChild(createWorkbenchTextCell(entry.title || '(Untitled pending lore)', entry.fact || ''));
        row.appendChild(createWorkbenchTextCell(generation.operation || reviewMeta.reviewRoute || 'create'));
        row.appendChild(createWorkbenchTextCell(generation.similarityRoute || reviewMeta.reviewRoute || '-'));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('category', entry.category || 'other')));
        row.appendChild(createWorkbenchTextCell(getLoreDisplayLabel('canonStatus', entry.canon || entry.canonStatus || 'canon')));
        row.appendChild(createWorkbenchTextCell(`P${Number(entry.priority || 50)}`));
        table.appendChild(row);
    }

    if (rows.length > visible.length) {
        const more = document.createElement('div');
        more.className = 'saga-lore-workbench-row-note';
        more.textContent = `Showing first ${visible.length} of ${rows.length} matching pending entries. Narrow search to reduce the set.`;
        table.appendChild(more);
    }
    return table;
}

function createPendingWorkbenchDetail(rows, state) {
    const detail = document.createElement('div');
    detail.className = 'saga-lore-workbench-detail';

    const selected = rows.find(row => getLoreReviewId(row.entry) === loreWorkbenchSelectedId) || rows[0];
    if (!selected) {
        detail.appendChild(createEmptyMessage('Select a pending lore entry to inspect it.'));
        return detail;
    }
    detail.appendChild(createPendingLoreReviewCard(selected.entry, selected.index, isPendingLoreSelected(state, selected.entry)));
    return detail;
}

function getPendingWorkbenchRows(state = getState()) {
    const pending = getFilteredPendingLoreRows(state);
    const query = String(loreWorkbenchPendingQuery || '').trim().toLowerCase();
    const rows = pending;
    if (!query) return rows;
    return rows
        .map(row => ({ ...row, score: scoreSearchEntry(row.entry, query) }))
        .filter(row => row.score > 0)
        .sort((a, b) => b.score - a.score || String(a.entry.title || '').localeCompare(String(b.entry.title || '')));
}

function getPendingReviewTypeFilter(state = getState()) {
    return String(state?.lorePanel?.pendingReviewTypeFilter || 'all');
}

function setPendingReviewTypeFilter(value = 'all') {
    setPanelState({ pendingReviewTypeFilter: value || 'all', pendingReviewVisibleLimit: 10 }, { deferSave: true });
}

function getFilteredPendingLoreRows(state = getState()) {
    const pending = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    const typeFilter = getPendingReviewTypeFilter(state);
    return pending
        .map((entry, index) => ({ entry, index }))
        .filter(row => entryMatchesLoreTypeFilter(row.entry, typeFilter));
}

function createWorkbenchTextCell(primary, secondary = '') {
    const cell = document.createElement('div');
    cell.className = 'saga-lore-workbench-cell';
    const main = document.createElement('span');
    main.className = 'saga-lore-workbench-cell-main';
    main.textContent = primary || '-';
    cell.appendChild(main);
    if (secondary) {
        const sub = document.createElement('span');
        sub.className = 'saga-lore-workbench-cell-sub';
        sub.textContent = truncateText(secondary, 150);
        cell.appendChild(sub);
    }
    return cell;
}

function getLoreSourceBucketLabel(bucket) {
    if (bucket === 'canon-db') return 'Canon DB';
    if (bucket === 'story-generation') return 'Story';
    if (bucket === 'manual') return 'Manual';
    return 'Other';
}

export function createPendingLoreBulkControls(pendingLore, state) {
    const selectedIds = getPendingReviewSelectedIds(state);
    const pendingIds = pendingLore.map(getLoreReviewId);
    const selectedCount = pendingIds.filter(id => selectedIds.has(id)).length;

    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-review-bulk-card';

    const header = document.createElement('label');
    header.className = 'saga-review-select-all';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.checked = selectedCount > 0 && selectedCount === pendingIds.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < pendingIds.length;
    addTooltip(selectAll, 'Select or clear all pending lore entries in this batch.');
    selectAll.addEventListener('change', () => {
        setPendingReviewSelection(selectAll.checked ? pendingIds : []);
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    });
    header.appendChild(selectAll);
    const label = document.createElement('span');
    label.textContent = selectedCount ? `${selectedCount} of ${pendingIds.length} selected` : `Select all ${pendingIds.length} pending entries`;
    header.appendChild(label);
    card.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Apply Selected', 'Accepts only the selected pending lore entries. Use Select All for large batches.', () => {
        applySelectedPendingLore();
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Dismiss Selected', 'Rejects only the selected pending lore entries.', () => {
        dismissSelectedPendingLore();
    }));
    actions.appendChild(createButton('Apply All', 'Accepts every pending lore entry in the current batch.', () => {
        acceptPendingLoreEntries();
        clearPendingReviewSelection();
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        refreshLoreWorkbench();
    }));
    actions.appendChild(createButton('Dismiss All', 'Rejects every pending lore entry in the current batch.', () => {
        rejectPendingLoreEntries();
        clearPendingReviewSelection();
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        refreshLoreWorkbench();
    }));
    card.appendChild(actions);

    return card;
}

export function createPendingLoreReviewCard(entry, index, selected = false, options = {}) {
    const basicReview = !!options.basicReview;
    const card = document.createElement('div');
    card.className = 'saga-lore-entry-card saga-lore-entry-pending saga-pending-review-entry-card';
    markTourTarget(card, 'lore.pending.entry');
    if (selected) card.classList.add('saga-review-lore-card-selected');
    if (basicReview) card.classList.add('saga-basic-review-entry-card');

    const headerRow = document.createElement('div');
    headerRow.className = 'saga-lore-entry-header';
    if (!basicReview) headerRow.appendChild(createPendingLoreCheckbox(entry, selected));

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-entry-title-wrap';
    const title = document.createElement('span');
    title.className = 'saga-lore-entry-title';
    title.textContent = entry.title || `Pending lore ${index + 1}`;
    addTooltip(title, 'Generated lore entry title. This entry is pending until accepted.');
    titleWrap.appendChild(title);
    headerRow.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-lore-entry-actions';
    if (!basicReview) actions.appendChild(createEditableLifecycleBadge(entry, { pending: true }));
    const status = document.createElement('span');
    status.className = 'saga-lore-badge saga-lore-badge-pending';
    status.textContent = 'pending';
    addTooltip(status, 'This lore entry has not been accepted into the accepted lore matrix yet.');
    actions.appendChild(status);
    headerRow.appendChild(actions);
    card.appendChild(headerRow);

    const meta = document.createElement('div');
    meta.className = 'saga-lore-entry-meta';
    meta.appendChild(createRegistryBadge('category', entry.category || 'other', `Category: ${entry.category || 'other'}. Pending cards use the same compact metadata style as accepted cards.`));
    meta.appendChild(createLorePurposeBadge(entry));
    meta.appendChild(createRegistryBadge('canonStatus', entry.canon || entry.canonStatus || 'canon', `Canon/Story: ${entry.canon || entry.canonStatus || 'canon'}.`));
    const generation = entry.extensions?.sagaGeneration || {};
    const reviewMeta = entry.extensions?.sagaPendingReview || {};
    if (!basicReview) {
        appendEntrySourceAndContextBadges(meta, entry);
        meta.appendChild(createBadge(`P${Number(entry.priority || 50)}`, 'Priority used for sorting, injection preference, and canon-lore suggestion limits.'));
        if (generation.operation) meta.appendChild(createBadge(`Op: ${generation.operation}`, 'Generated lore operation proposed by the story-lore scan.'));
        if (generation.qualityRoute || reviewMeta.qualityRoute) meta.appendChild(createBadge(`Quality: ${generation.qualityRoute || reviewMeta.qualityRoute}`, generation.qualityReason || reviewMeta.qualityReason || 'Generated-lore quality route.'));
        if (generation.similarityRoute || reviewMeta.reviewRoute) meta.appendChild(createBadge(`Route: ${generation.similarityRoute || reviewMeta.reviewRoute}`, generation.similarityReason || reviewMeta.similarityReason || 'Similarity/update routing result.'));
    }
    if (generation.recommendedPin) meta.appendChild(createBadge('pin suggested', 'Generator recommends pinning/protecting this entry after acceptance.'));
    if (generation.recommendedMute) meta.appendChild(createBadge('mute suggested', 'Generator recommends storing but muting this entry after acceptance.'));
    if (!basicReview) {
        meta.appendChild(createSpellMetadataBadges(entry));
        if (entry.confidence !== undefined) meta.appendChild(createBadge(`confidence ${entry.confidence}`, 'Model-provided confidence for this entry.'));
    }
    card.appendChild(meta);

    const targetId = generation.targetEntryId || reviewMeta.targetEntryId || '';
    if (targetId) {
        const target = normalizeLoreMatrix(getState()?.loreMatrix || []).find(item => item.id === targetId);
        const targetBox = document.createElement('div');
        targetBox.className = 'saga-runtime-help saga-pending-target-help';
        targetBox.textContent = basicReview
            ? 'This will update an accepted Lorecard unless you apply it as new.'
            : target
            ? `Targets existing lore: ${target.title || target.id}${target.fact ? ` - ${target.fact}` : ''}`
            : `Targets existing lore id: ${targetId}`;
        addTooltip(targetBox, basicReview
            ? 'Advanced Lorecards shows the routed target and similarity details.'
            : generation.similarityReason || reviewMeta.similarityReason || 'Accepting this candidate will update or merge into the target if it still exists and is not locked.'
        );
        card.appendChild(targetBox);
    }

    if (Array.isArray(entry.tags) && entry.tags.length) {
        const tags = createReadOnlyTags(entry.tags);
        tags.classList.add('saga-pending-readonly-tags');
        card.appendChild(tags);
    }

    const fact = document.createElement('div');
    fact.className = 'saga-lore-entry-fact';
    fact.textContent = entry.fact || '(No fact text)';
    addTooltip(fact, 'The fact that will be merged into the accepted lore matrix if applied.');
    card.appendChild(fact);

    if (!basicReview && entry.content?.injection && entry.content.injection !== entry.fact) {
        const injection = document.createElement('div');
        injection.className = 'saga-runtime-help saga-pending-injection-preview';
        injection.textContent = `Injection: ${entry.content.injection}`;
        addTooltip(injection, 'Model-facing lore text that will be injected after acceptance.');
        card.appendChild(injection);
    }
    if (!basicReview && Array.isArray(entry.content?.constraints) && entry.content.constraints.length) {
        const constraints = document.createElement('div');
        constraints.className = 'saga-runtime-help saga-pending-constraints-preview';
        constraints.textContent = `Constraints: ${entry.content.constraints.join(' ')}`;
        addTooltip(constraints, 'Specific constraints captured by generated lore.');
        card.appendChild(constraints);
    }

    const actionsRow = document.createElement('div');
    actionsRow.className = 'saga-primary-actions saga-pending-entry-actions';
    markTourTarget(actionsRow, 'lore.pending.actions');
    const applyLabel = targetId ? 'Apply Update' : 'Apply';
    actionsRow.appendChild(createButton(applyLabel, targetId ? 'Accepts this generated update and merges it into the targeted accepted lore entry.' : 'Accepts this single lore entry and merges it into the accepted lore matrix.', () => {
        acceptPendingLoreEntry(index);
        togglePendingReviewSelection(getLoreReviewId(entry), false);
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    }, 'saga-primary-button'));
    if (targetId) {
        actionsRow.appendChild(createButton('Apply as New', 'Accepts this generated lore as a separate new entry instead of updating the routed target.', () => {
            const current = getState();
            const pending = normalizeLoreMatrix(current.pendingLoreEntries || []);
            if (pending[index]) {
                const generationMeta = pending[index].extensions?.sagaGeneration || {};
                const reviewMeta = pending[index].extensions?.sagaPendingReview || {};
                pending[index] = normalizeLoreEntry({
                    ...pending[index],
                    extensions: {
                        ...(pending[index].extensions || {}),
                        sagaGeneration: {
                            ...generationMeta,
                            operation: 'create',
                            targetEntryId: '',
                            similarityRoute: 'kept_separate',
                        },
                        sagaPendingReview: {
                            ...reviewMeta,
                            reviewRoute: 'kept_separate',
                            targetEntryId: '',
                        },
                    },
                });
                current.pendingLoreEntries = pending;
                saveState(current, { syncPrompt: false });
            }
            acceptPendingLoreEntry(index);
            togglePendingReviewSelection(getLoreReviewId(entry), false);
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            refreshLoreWorkbench();
        }));
    }
    actionsRow.appendChild(createButton('Dismiss', 'Rejects this single lore entry without changing accepted lore.', () => {
        rejectPendingLoreEntry(index);
        togglePendingReviewSelection(getLoreReviewId(entry), false);
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    }));
    card.appendChild(actionsRow);

    return card;
}

function createPendingLoreCheckbox(entry, checked) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'saga-review-lore-checkbox saga-lore-entry-select';
    checkbox.checked = checked;
    addTooltip(checkbox, checked ? 'Remove this lore entry from the current bulk selection.' : 'Add this lore entry to the current bulk selection.');
    checkbox.addEventListener('click', e => e.stopPropagation());
    checkbox.addEventListener('change', () => {
        togglePendingReviewSelection(getLoreReviewId(entry), checkbox.checked);
        refreshPanelBody({ preserveScroll: true });
        refreshLoreWorkbench();
    });
    return checkbox;
}

function createReadOnlyTags(tags) {
    const row = document.createElement('div');
    row.className = 'saga-lore-entry-tags';
    for (const tag of tags) {
        const chip = document.createElement('span');
        chip.className = 'saga-lore-tag-chip';
        const label = document.createElement('span');
        label.className = 'saga-lore-tag-label';
        label.textContent = tag;
        chip.appendChild(label);
        row.appendChild(chip);
    }
    return row;
}

function getLifecycleStatus(entry) {
    return normalizeLoreRelevance(entry.relevance || entry.lifecycleStatus || entry.lifecycle?.status || entry.lifecycle?.computedStatus || 'normal');
}

function getEntryCanonStatus(entry = {}) {
    return String(entry.canon || entry.canonStatus || 'canon').trim().toLowerCase();
}

function getEntryCategoryText(entry = {}) {
    return [
        entry.category,
        entry.kind,
        entry.gateType,
        entry.lorePurpose,
        entry.purpose,
    ].map(value => String(value || '').trim().toLowerCase()).join(' ');
}

function entryMatchesLoreTypeFilter(entry = {}, filter = 'all') {
    const value = String(filter || 'all').trim().toLowerCase();
    if (!value || value === 'all') return true;
    if (value === 'high' || value === 'normal' || value === 'low') return getLifecycleStatus(entry) === value;
    if (value === 'canon' || value === 'au') return getEntryCanonStatus(entry) === value;
    if (value === 'pinned') return !!entry.isPinned;
    if (value === 'muted') return !!entry.isSuppressed || !!entry.suppressed || !!entry.muted;

    const categoryText = getEntryCategoryText(entry);
    if (value === 'future_guard') {
        return categoryText.includes('future_guard')
            || categoryText.includes('future guard')
            || categoryText.includes('leak')
            || normalizeLorePurpose(entry.lorePurpose || entry.purpose, entry) === 'negative_constraint';
    }
    if (value === 'item') return ['item', 'artifact', 'object'].some(term => categoryText.includes(term));
    if (value === 'location') return ['location', 'place', 'setting'].some(term => categoryText.includes(term));
    if (value === 'spell') return ['spell', 'ability', 'skill'].some(term => categoryText.includes(term));
    if (value === 'rule') return ['rule', 'system', 'constraint'].some(term => categoryText.includes(term));
    return categoryText.split(/\s+/).includes(value) || categoryText.includes(value);
}

function getLoreEntryTypeFilterOptions(entries = []) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    return LORE_ENTRY_TYPE_FILTERS.map(([value, label]) => [
        value,
        value === 'all'
            ? `${label} (${safeEntries.length})`
            : `${label} (${safeEntries.filter(entry => entryMatchesLoreTypeFilter(entry, value)).length})`,
    ]);
}

function createLoreTypeFilterSelect(entries, value, onChange, options = {}) {
    const select = document.createElement('select');
    select.className = options.className || 'saga-lore-type-filter';
    addTooltip(select, options.tooltip || 'Filter Lorecards by relevance tier, category, canon/AU status, or injection flag.');
    const active = String(value || 'all');
    for (const [filterValue, label] of getLoreEntryTypeFilterOptions(entries)) {
        const opt = document.createElement('option');
        opt.value = filterValue;
        opt.textContent = label;
        if (active === filterValue) opt.selected = true;
        select.appendChild(opt);
    }
    select.addEventListener('change', () => onChange?.(select.value));
    return select;
}

function getLoreFieldRegistry(field) {
    if (field === 'category') return 'categories';
    if (field === 'canonStatus') return 'canonStatuses';
    if (field === 'truthStatus') return 'truthStatuses';
    if (field === 'revealPolicy') return 'revealPolicies';
    return '';
}

function getLoreRegistryMeta(registryName, value) {
    return dep('getLoreRegistryMeta', () => null)(registryName, value);
}

function applyLoreRegistryStyle(el, field, value) {
    return dep('applyLoreRegistryStyle', element => element)(el, field, value);
}

function createEditableLifecycleBadge(entry, options = {}) {
    const value = getLifecycleStatus(entry);
    const meta = RELEVANCE_META[value] || RELEVANCE_META.normal;
    const wrap = document.createElement('label');
    wrap.className = 'saga-lore-lifecycle-select-wrap';
    wrap.style.setProperty('--saga-chip-bg', meta.color);
    wrap.style.setProperty('--saga-chip-fg', meta.textColor);
    addTooltip(wrap, `${meta.label} Relevance: ${meta.tooltip}`);

    const select = document.createElement('select');
    select.className = 'saga-lore-lifecycle-select';
    select.setAttribute('aria-label', 'Lore relevance');
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('mousedown', e => e.stopPropagation());

    for (const status of LORE_RELEVANCE_TIERS) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = RELEVANCE_META[status]?.label || status;
        if (status === value) option.selected = true;
        select.appendChild(option);
    }

    select.addEventListener('change', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextRelevance = normalizeLoreRelevance(select.value);
        updateLoreEntryById(entry.id, raw => ({
            ...raw,
            relevance: nextRelevance,
            lifecycle: {
                ...(raw.lifecycle || {}),
                status: '',
                computedStatus: '',
                manualOverride: false,
                reason: `Relevance manually set to ${nextRelevance}.`,
                lastEvaluatedAt: Date.now(),
            },
            extensions: {
                ...(raw.extensions || {}),
                autoRelevance: {
                    ...(raw.extensions?.autoRelevance || {}),
                    mode: 'manual',
                    confidence: 1,
                    reason: `User manually set relevance to ${nextRelevance}.`,
                    updatedAt: Date.now(),
                },
            },
        }), { deferSave: true });
        if (options.pending) refreshPanelBody({ preserveScroll: true });
        else if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
        refreshAcceptedLoreBulkToolbar();
        refreshHeader();
        refreshLoreWorkbench();
    });

    wrap.appendChild(select);
    return wrap;
}

function createRegistryBadge(field, value, tooltip = '') {
    const label = getLoreDisplayLabel(field, value);
    const badge = createBadge(label, tooltip || `${field}: ${label}. Expand the entry to edit.`);
    badge.classList.add('saga-lore-registry-badge');
    applyLoreRegistryStyle(badge, field, value);
    return badge;
}

function createLorePurposeBadge(entry) {
    const purpose = normalizeLorePurpose(entry?.lorePurpose || entry?.purpose, entry) || 'unspecified';
    const label = LORE_PURPOSE_LABELS[purpose] || String(purpose || 'unspecified').replace(/[_-]+/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
    return createBadge(`Purpose: ${label}`, 'Lore purpose explains why this is specific Saga lore rather than a generic reference fact.');
}

function getLoredeckDisplayName(packId) {
    return dep('getLoredeckDisplayName', value => String(value || ''))(packId);
}

function cleanLoreChipText(value, maxLength = 160) {
    return truncateText(String(value ?? '').trim(), maxLength);
}

function getEntrySagaLoredeckMeta(entry = {}) {
    const raw = isPlainObjectValue(entry.extensions?.sagaLoredeck) ? entry.extensions.sagaLoredeck : {};
    const sourceInfo = isPlainObjectValue(entry.sourceInfo) ? entry.sourceInfo : {};
    const packId = cleanLoreChipText(raw.packId || entry.packId || entry.loredeckId || sourceInfo.packId, 120);
    const fallbackTitle = packId ? getLoredeckDisplayName(packId) : '';
    return {
        packId,
        packType: cleanLoreChipText(raw.packType, 40),
        packTitle: cleanLoreChipText(raw.packTitle || fallbackTitle, 180),
        file: cleanLoreChipText(raw.file || entry.sagaLoredeckSourceFile, 240),
        stackPriority: Number.isFinite(Number(raw.stackPriority)) ? Number(raw.stackPriority) : null,
        stackIndex: Number.isFinite(Number(raw.stackIndex)) ? Number(raw.stackIndex) : null,
    };
}

function getReadableEntrySource(entry = {}) {
    const loredeck = getEntrySagaLoredeckMeta(entry);
    const sourceInfo = isPlainObjectValue(entry.sourceInfo) ? entry.sourceInfo : {};
    const source = cleanLoreChipText(entry.source, 180);
    const generation = isPlainObjectValue(entry.extensions?.sagaGeneration) ? entry.extensions.sagaGeneration : {};
    const work = cleanLoreChipText(sourceInfo.work, 120);
    const book = cleanLoreChipText(sourceInfo.book, 120);
    const chapter = cleanLoreChipText(sourceInfo.chapter, 120);

    if (loredeck.packTitle || loredeck.packId) {
        const title = loredeck.packTitle || loredeck.packId;
        return {
            label: `Pack: ${truncateText(title, 34)}`,
            tooltip: [
                `Loredeck: ${title}`,
                loredeck.packId ? `Deck ID: ${loredeck.packId}` : '',
                loredeck.packType ? `Type: ${humanizeScopeKey(loredeck.packType)}` : '',
                loredeck.file ? `File: ${loredeck.file}` : '',
                loredeck.stackPriority !== null ? `Stack priority: ${loredeck.stackPriority}` : '',
            ].filter(Boolean).join(' | '),
            detailLabel: [book, chapter].filter(Boolean).join(' / ') || (work && work !== title ? work : ''),
            detailTooltip: [work, book, chapter].filter(Boolean).join(' | '),
        };
    }

    if (work || book || chapter) {
        const label = work || book || chapter;
        return {
            label: `Source: ${truncateText(label, 32)}`,
            tooltip: [work, book, chapter].filter(Boolean).join(' | '),
            detailLabel: work && (book || chapter) ? [book, chapter].filter(Boolean).join(' / ') : '',
            detailTooltip: [work, book, chapter].filter(Boolean).join(' | '),
        };
    }

    if (source.includes('canon-lore-db')) {
        return {
            label: 'Source: Canon DB',
            tooltip: 'Suggested from Saga canon Loredeck retrieval.',
            detailLabel: '',
            detailTooltip: '',
        };
    }

    if (generation.mode || generation.batchId || generation.chunkId) {
        return {
            label: 'Source: Story Scan',
            tooltip: generation.batchId ? `Generated by story-lore scan batch ${generation.batchId}.` : 'Generated by story-lore scan.',
            detailLabel: '',
            detailTooltip: '',
        };
    }

    if (source && !['saga', 'model-generated', 'unknown'].includes(source.toLowerCase())) {
        return {
            label: `Source: ${truncateText(source, 32)}`,
            tooltip: source,
            detailLabel: '',
            detailTooltip: '',
        };
    }

    return null;
}

function createSagaMetadataBadge(label, tooltip, classes = []) {
    const badge = createBadge(label, tooltip);
    badge.classList.add('saga-lore-badge-saga-meta');
    for (const className of classes) {
        if (className) badge.classList.add(className);
    }
    return badge;
}

function createEntrySourceBadges(entry = {}) {
    const fragment = document.createDocumentFragment();
    const source = getReadableEntrySource(entry);
    if (!source?.label) return fragment;

    fragment.appendChild(createSagaMetadataBadge(source.label, source.tooltip || 'Lore source metadata.', ['saga-lore-badge-source']));
    if (source.detailLabel) {
        fragment.appendChild(createSagaMetadataBadge(`Ref: ${truncateText(source.detailLabel, 32)}`, source.detailTooltip || source.tooltip, ['saga-lore-badge-source-detail']));
    }
    return fragment;
}

function getEntryContextGateMeta(entry = {}) {
    const gate = isPlainObjectValue(entry.extensions?.sagaContextGate) ? entry.extensions.sagaContextGate : {};
    const preview = isPlainObjectValue(entry.extensions?.canonPreview) ? entry.extensions.canonPreview : {};
    const pack = getEntrySagaLoredeckMeta(entry);
    const status = cleanLoreChipText(gate.status || preview.contextGateStatus, 40);
    const matchedBy = cleanLoreChipText(gate.matchedBy || preview.matchedBy, 60);
    const reason = cleanLoreChipText(gate.reason || preview.contextGateReason, 240);
    return {
        status,
        hasGate: gate.hasGate === true || (!!status && status !== 'no_gate'),
        eligible: gate.eligible === undefined ? null : gate.eligible === true,
        matchedBy,
        reason,
        packId: cleanLoreChipText(gate.packId || pack.packId, 120),
    };
}

function getContextGateChipLabel(gate = {}) {
    const matchedBy = String(gate.matchedBy || '').trim();
    if (matchedBy === 'date_context') return 'Gate: date + Context';
    if (matchedBy === 'context') return 'Gate: Context';
    if (matchedBy === 'date_unresolved_context') return 'Gate: date fallback';
    if (matchedBy === 'date') return 'Gate: date';
    if (matchedBy === 'unresolved_context') return 'Gate: unresolved';
    if (matchedBy === 'context_mismatch' || gate.status === 'mismatch') return 'Gate: blocked';
    if (matchedBy === 'date_contradicts_context') return 'Gate: date conflict';
    if (gate.status === 'match') return 'Gate: Context';
    if (gate.status === 'unresolved') return 'Gate: unresolved';
    if (gate.status === 'no_gate') return '';
    return matchedBy ? `Gate: ${matchedBy.replace(/_/g, ' ')}` : '';
}

function getContextGateClass(gate = {}) {
    const matchedBy = String(gate.matchedBy || '');
    if (gate.status === 'mismatch' || matchedBy.includes('mismatch') || matchedBy.includes('conflict')) return 'saga-lore-badge-context-blocked';
    if (gate.status === 'unresolved' || matchedBy.includes('unresolved')) return 'saga-lore-badge-context-unresolved';
    if (gate.status === 'match' || matchedBy.includes('context')) return 'saga-lore-badge-context-match';
    if (matchedBy === 'date') return 'saga-lore-badge-date-gate';
    return 'saga-lore-badge-context';
}

function hasEntryContextMetadata(entry = {}) {
    const contextGate = isPlainObjectValue(entry.context) ? entry.context : {};
    const contextHasValue = Object.entries(contextGate).some(([key, value]) => {
        if (key === 'approximate') return value === true;
        if (value === null || value === undefined || value === '') return false;
        return Number.isFinite(Number(value)) || String(value || '').trim() !== '';
    });
    const coordinates = Array.isArray(entry.coordinates) ? entry.coordinates : [];
    return contextHasValue || coordinates.some(item => isPlainObjectValue(item)
        && [item.axis, item.id, item.label, item.from, item.to].some(value => String(value || '').trim()));
}

function formatEntryContextSummary(entry = {}) {
    if (!hasEntryContextMetadata(entry)) return '';
    const contextGate = isPlainObjectValue(entry.context) ? entry.context : {};
    const parts = [];
    if (contextGate.scope) parts.push(`Scope: ${contextGate.scope}`);
    if (contextGate.label) parts.push(contextGate.label);
    if (contextGate.anchorId) parts.push(`Anchor: ${contextGate.anchorId}`);
    if (contextGate.validFromAnchor || contextGate.validToAnchor) parts.push(`Window: ${contextGate.validFromAnchor || 'start'} -> ${contextGate.validToAnchor || 'open'}`);
    if (contextGate.arc) parts.push(`Arc: ${contextGate.arc}`);
    if (contextGate.phase) parts.push(`Phase: ${contextGate.phase}`);
    if (contextGate.season || contextGate.episode) parts.push(`S${contextGate.season || '?'} E${contextGate.episode || '?'}`);
    if (contextGate.chapter) parts.push(`Chapter: ${contextGate.chapter}`);
    if (contextGate.issue) parts.push(`Issue: ${contextGate.issue}`);
    if (contextGate.quest) parts.push(`Quest: ${contextGate.quest}`);
    if (contextGate.gameStage) parts.push(`Game: ${contextGate.gameStage}`);
    if (contextGate.stardateFrom || contextGate.stardateTo) parts.push(`Stardate: ${contextGate.stardateFrom || 'start'} -> ${contextGate.stardateTo || 'open'}`);
    if (contextGate.windowKind) parts.push(`Kind: ${contextGate.windowKind}`);
    if ((Number.isFinite(Number(contextGate.sortKeyFrom)) || Number.isFinite(Number(contextGate.sortKeyTo))) && !parts.some(part => part.startsWith('Window:'))) {
        parts.push(`Sort: ${contextGate.sortKeyFrom ?? 'start'} -> ${contextGate.sortKeyTo ?? 'open'}`);
    }
    const coordinates = (Array.isArray(entry.coordinates) ? entry.coordinates : [])
        .filter(isPlainObjectValue)
        .map(coordinate => coordinate.label || [coordinate.axis, coordinate.id || coordinate.from || coordinate.to].filter(Boolean).join(': '))
        .filter(Boolean)
        .slice(0, 2);
    if (coordinates.length) parts.push(`Axis: ${coordinates.join(', ')}`);
    return parts.join(' | ');
}

function createEntryContextBadges(entry = {}) {
    const fragment = document.createDocumentFragment();
    const gate = getEntryContextGateMeta(entry);
    const gateLabel = getContextGateChipLabel(gate);
    if (gateLabel) {
        const tooltip = [
            `Context retrieval: ${gate.matchedBy || gate.status || 'unknown'}`,
            gate.packId ? `Deck ID: ${gate.packId}` : '',
            gate.reason,
        ].filter(Boolean).join(' | ');
        fragment.appendChild(createSagaMetadataBadge(gateLabel, tooltip, ['saga-lore-badge-context', getContextGateClass(gate)]));
    }

    const summary = formatEntryContextSummary(entry);
    if (summary) {
        fragment.appendChild(createSagaMetadataBadge(`Ctx: ${truncateText(summary, 36)}`, summary, ['saga-lore-badge-context']));
    }
    return fragment;
}

export function appendEntrySourceAndContextBadges(meta, entry = {}) {
    if (!meta) return;
    meta.appendChild(createEntrySourceBadges(entry));
    meta.appendChild(createEntryContextBadges(entry));
}

function createSpellMetadataBadges(entry) {
    const row = document.createDocumentFragment();
    const spells = Array.from(new Set([
        ...((entry?.scope?.spells || []).map(v => String(v || '').trim()).filter(Boolean)),
        ...((entry?.tags || []).filter(tag => /spell|patronus|expelliarmus|sectumsempra|occlumency|legilimency|apparition/i.test(String(tag || '')))),
    ])).slice(0, 4);

    if (!spells.length && (entry?.kind === 'spell_gate' || entry?.category === 'spell')) {
        spells.push(entry?.title || 'Spell gate');
    }

    for (const spell of spells) {
        const badge = createBadge(`Spell: ${spell}`, 'Spell metadata. This identifies spell knowledge, spell-learning gates, or magic-ability constraints attached to this lore entry.');
        badge.classList.add('saga-lore-badge-spell');
        row.appendChild(badge);
    }

    return row;
}

function getLoreReviewId(entry) {
    return entry?.id || `${entry?.title || 'pending'}:${entry?.fact || ''}`;
}

function getPendingReviewSelectedIds(state = getState()) {
    return new Set(Array.isArray(state?.lorePanel?.reviewSelectedIds) ? state.lorePanel.reviewSelectedIds : []);
}

function isPendingLoreSelected(state, entry) {
    return getPendingReviewSelectedIds(state).has(getLoreReviewId(entry));
}

function setPendingReviewSelection(ids) {
    const state = getState();
    if (!state?.lorePanel) return;
    state.lorePanel.reviewSelectedIds = Array.from(new Set((ids || []).filter(Boolean)));
    saveState(state);
}

function togglePendingReviewSelection(id, selected) {
    if (!id) return;
    const current = getPendingReviewSelectedIds();
    if (selected) current.add(id);
    else current.delete(id);
    setPendingReviewSelection(Array.from(current));
}

function clearPendingReviewSelection() {
    setPendingReviewSelection([]);
}

function getSelectedPendingIndexes() {
    const state = getState();
    const selected = getPendingReviewSelectedIds(state);
    const pending = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    return pending
        .map((entry, index) => ({ entry, index }))
        .filter(item => selected.has(getLoreReviewId(item.entry)))
        .map(item => item.index);
}

function applySelectedPendingLore() {
    const indexes = getSelectedPendingIndexes().sort((a, b) => b - a);
    if (!indexes.length) {
        toast('No pending lore entries selected.', 'warning');
        return;
    }
    for (const idx of indexes) acceptPendingLoreEntry(idx);
    clearPendingReviewSelection();
    refreshPanelBody({ preserveScroll: true });
    refreshHeader();
    refreshLoreWorkbench();
}

function dismissSelectedPendingLore() {
    const indexes = getSelectedPendingIndexes().sort((a, b) => b - a);
    if (!indexes.length) {
        toast('No pending lore entries selected.', 'warning');
        return;
    }
    for (const idx of indexes) rejectPendingLoreEntry(idx);
    clearPendingReviewSelection();
    refreshPanelBody({ preserveScroll: true });
    refreshHeader();
    refreshLoreWorkbench();
}

function acceptPendingLoreEntries() {
    return acceptPendingLoreEntriesInState();
}

function rejectPendingLoreEntries() {
    return rejectPendingLoreEntriesInState();
}

function acceptPendingLoreEntry(index) {
    return acceptPendingLoreEntryInState(index);
}

function rejectPendingLoreEntry(index) {
    return rejectPendingLoreEntryInState(index);
}

function refreshHeader() {
    return dep('refreshHeader', () => null)();
}

function toast(message, type) {
    return dep('toast', () => null)(message, type);
}

function getState() {
    return dep('getState', () => ({}))();
}

function saveState(state, options) {
    return dep('saveState', () => null)(state, options);
}

function refreshPanelBody(options = {}) {
    return dep('refreshPanelBody', () => null)(options);
}

function getLoreDisplayLabel(field, value) {
    return dep('getLoreDisplayLabel', (fieldName, rawValue) => String(rawValue || fieldName || ''))(field, value);
}

function getCategoryCount(category, entries, counts) {
    const safeCounts = counts || {};
    const safeEntries = Array.isArray(entries) ? entries : [];
    if (category === 'all') return safeCounts.all || 0;
    if (category === 'active' || category === 'high') return safeCounts.high || safeCounts.active || 0;
    if (category === 'normal') return safeCounts.normal || 0;
    if (category === 'low') return safeCounts.low || 0;
    if (category === 'pinned') return safeCounts.pinned || 0;
    if (category === 'suppressed') return safeCounts.suppressed || 0;
    if (category === 'pending') return safeCounts.pending || 0;
    return safeEntries.filter(entry => entry.category === category).length;
}

function getCategoryTooltip(category) {
    const registryMeta = getLoreRegistryMeta('categories', category);
    if (registryMeta?.description) return registryMeta.description;
    const map = {
        all: 'Shows every accepted and pending lore entry.',
        active: 'Legacy alias for High Relevance.',
        high: 'Shows accepted lore in the High-Relevance injection tier.',
        normal: 'Shows accepted lore in the Normal-Relevance injection tier.',
        low: 'Shows accepted lore in the Low-Relevance injection tier.',
        pinned: 'Shows entries manually prioritized and protected during injection/compression.',
        suppressed: 'Shows muted entries excluded from injection.',
        pending: 'Shows generated entries that still need review.',
    };
    return map[category] || `Shows lore entries in category: ${category}.`;
}

function setPanelState(patch, options = {}) {
    return dep('setPanelState', () => null)(patch, options);
}

function setExperienceMode(mode) {
    return dep('setExperienceMode', () => {
        const settings = getSettings();
        settings.experienceMode = mode;
        saveSettings(settings);
    })(mode);
}

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

function scheduleAcceptedLoreLayoutUpdate() {
    return dep('scheduleAcceptedLoreLayoutUpdate', () => null)();
}

function getSearchRenderDebounceMs() {
    return Math.max(0, Number(dep('getSearchRenderDebounceMs', () => 160)()) || 0);
}

function getLoreWorkbenchRowLimit() {
    return Math.max(25, Number(dep('getLoreWorkbenchRowLimit', () => 500)()) || 500);
}

function flushScheduledStateSave() {
    return dep('flushScheduledStateSave', () => null)();
}

export function refreshAcceptedLoreCategoryTabs(activeCategory) {
    const root = getPanelRoot();
    if (!root) return;
    root.querySelectorAll('.saga-lore-tabs .saga-lore-tab').forEach(tab => {
        tab.classList.toggle('saga-lore-tab-active', tab.dataset.category === activeCategory);
    });
}

export function refreshAcceptedLoreFilterResults(options = {}) {
    const root = getPanelRoot();
    if (!root) return;
    const section = root.querySelector('.saga-accepted-lore-section');
    const list = section?.querySelector?.('.saga-lore-entry-list');
    if (!list) return;
    renderAcceptedLoreEntryList(list, getState());
    if (options.resetListScroll !== false) list.scrollTop = 0;
    refreshAcceptedLoreBulkToolbar();
    scheduleAcceptedLoreLayoutUpdate();
    refreshLoreWorkbench();
}

export function scheduleAcceptedLoreListRender(container) {
    if (acceptedLoreSearchRenderTimer) clearTimeout(acceptedLoreSearchRenderTimer);
    acceptedLoreSearchRenderTimer = setTimeout(() => {
        acceptedLoreSearchRenderTimer = null;
        const root = container || getPanelRoot();
        const list = root?.querySelector?.('.saga-lore-entry-list');
        if (list) renderAcceptedLoreEntryList(list, getState());
        refreshAcceptedLoreBulkToolbar();
        scheduleAcceptedLoreLayoutUpdate();
    }, getSearchRenderDebounceMs());
}

export function getAcceptedSelectionSet(state = getState()) {
    const ids = Array.isArray(state?.lorePanel?.acceptedSelectedIds) ? state.lorePanel.acceptedSelectedIds : [];
    const acceptedIds = new Set(normalizeLoreMatrix(state?.loreMatrix || []).map(entry => entry.id));
    return new Set(ids.filter(id => acceptedIds.has(id)));
}

export function getFilteredAcceptedLoreIds(state = getState()) {
    return getFilteredLoreEntries(state).map(entry => entry.id);
}

export function setAcceptedLoreSelection(ids = [], options = {}) {
    const state = getState();
    if (!state.lorePanel) state.lorePanel = {};
    const acceptedIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    state.lorePanel.acceptedSelectedIds = Array.from(new Set((ids || []).filter(id => acceptedIds.has(id))));
    if (options.deferSave) scheduleStateSave(state);
    else saveState(state);
}

export function toggleAcceptedLoreSelection(entryId, selected) {
    const state = getState();
    if (!state.lorePanel) state.lorePanel = {};
    const selection = getAcceptedSelectionSet(state);
    if (selected) selection.add(entryId);
    else selection.delete(entryId);
    state.lorePanel.acceptedSelectedIds = Array.from(selection);
    scheduleStateSave(state);
}

function bulkUpdateAcceptedLore(ids, updater) {
    if (!ids?.length || typeof updater !== 'function') return false;
    const state = getState();
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    let count = 0;
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).map(entry => {
        if (!idSet.has(entry.id)) return entry;
        count += 1;
        return normalizeLoreEntry({ ...updater(entry), userEdited: true });
    });
    if (count) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'bulk_edit',
            source: 'manual',
            summary: `Bulk edited ${count} accepted lore entr${count === 1 ? 'y' : 'ies'}.`,
        });
    }
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
    return count > 0;
}

function bulkSetAcceptedPinned(ids, pinned) {
    const state = getState();
    if (!state.loreSelection) state.loreSelection = { pinnedIds: [], suppressedIds: [] };
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    const acceptedIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    const pinSet = new Set((state.loreSelection.pinnedIds || []).filter(id => acceptedIds.has(id)));
    const suppressedSet = new Set((state.loreSelection.suppressedIds || []).filter(id => acceptedIds.has(id)));
    for (const id of idSet) {
        if (!acceptedIds.has(id)) continue;
        if (pinned) {
            pinSet.add(id);
            suppressedSet.delete(id);
        } else {
            pinSet.delete(id);
        }
    }
    state.loreSelection.pinnedIds = Array.from(pinSet);
    state.loreSelection.suppressedIds = Array.from(suppressedSet);
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: pinned ? 'pin' : 'unpin',
        source: 'manual',
        summary: `${pinned ? 'Pinned' : 'Unpinned'} ${idSet.size} accepted lore entr${idSet.size === 1 ? 'y' : 'ies'}.`,
    });
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
}

function bulkSetAcceptedMuted(ids, muted) {
    const state = getState();
    if (!state.loreSelection) state.loreSelection = { pinnedIds: [], suppressedIds: [] };
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    const acceptedIds = new Set(normalizeLoreMatrix(state.loreMatrix || []).map(entry => entry.id));
    const pinSet = new Set((state.loreSelection.pinnedIds || []).filter(id => acceptedIds.has(id)));
    const suppressedSet = new Set((state.loreSelection.suppressedIds || []).filter(id => acceptedIds.has(id)));
    for (const id of idSet) {
        if (!acceptedIds.has(id)) continue;
        if (muted) {
            suppressedSet.add(id);
            pinSet.delete(id);
        } else {
            suppressedSet.delete(id);
        }
    }
    state.loreSelection.pinnedIds = Array.from(pinSet);
    state.loreSelection.suppressedIds = Array.from(suppressedSet);
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: muted ? 'mute' : 'unmute',
        source: 'manual',
        summary: `${muted ? 'Muted' : 'Unmuted'} ${idSet.size} accepted lore entr${idSet.size === 1 ? 'y' : 'ies'}.`,
    });
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
}

function bulkAddTagToAcceptedLore(ids, tag) {
    const clean = normalizeLoreTag(tag);
    if (!clean) return false;
    return bulkUpdateAcceptedLore(ids, entry => {
        const tags = Array.isArray(entry.tags) ? entry.tags.map(normalizeLoreTag).filter(Boolean) : [];
        const exists = tags.some(t => t.toLowerCase() === clean.toLowerCase());
        return { ...entry, tags: exists ? tags : [...tags, clean] };
    });
}

function bulkDeleteAcceptedLore(ids) {
    const state = getState();
    const beforeTimeline = captureLoreTimelineState(state);
    const idSet = new Set(ids);
    const before = Array.isArray(state.loreMatrix) ? state.loreMatrix.length : 0;
    state.loreMatrix = normalizeLoreMatrix(state.loreMatrix || []).filter(entry => !idSet.has(entry.id));
    const acceptedIds = new Set(state.loreMatrix.map(entry => entry.id));
    if (state.loreSelection) {
        state.loreSelection.pinnedIds = (state.loreSelection.pinnedIds || []).filter(id => acceptedIds.has(id));
        state.loreSelection.suppressedIds = (state.loreSelection.suppressedIds || []).filter(id => acceptedIds.has(id));
    }
    if (state.lorePanel) {
        state.lorePanel.acceptedSelectedIds = (state.lorePanel.acceptedSelectedIds || []).filter(id => acceptedIds.has(id));
        if (idSet.has(state.lorePanel.selectedEntryId)) state.lorePanel.selectedEntryId = '';
    }
    const deleted = before - state.loreMatrix.length;
    if (deleted > 0) {
        recordLoreTimelineEvent(state, {
            before: beforeTimeline,
            after: captureLoreTimelineState(state),
            type: 'delete',
            source: 'manual',
            summary: `Deleted ${deleted} accepted lore entr${deleted === 1 ? 'y' : 'ies'}.`,
        });
    }
    saveState(state);
    refreshAcceptedLoreList({ preserveScroll: true });
    refreshAcceptedLoreBulkToolbar();
    refreshHeader();
    refreshLoreWorkbench();
}

function getLoreRegistryValues(registryName, fallback = []) {
    return dep('getLoreRegistryValues', (_registryName, values = []) => values)(registryName, fallback);
}

function getLorePriorityValues() {
    return dep('getLorePriorityValues', () => [10, 25, 50, 75, 90, 100])();
}

function appendPendingLoreEntries(entries, batch, options = {}) {
    return dep('appendPendingLoreEntries')(entries, batch, options);
}

function recordLoreTimelineEvent(state, event) {
    return dep('recordLoreTimelineEvent', () => null)(state, event);
}

function captureLoreTimelineState(state) {
    return dep('captureLoreTimelineState', () => null)(state);
}

function scheduleStateSave(state, delay) {
    return dep('scheduleStateSave', saveState)(state, delay);
}

function refreshLoreTimeline() {
    return dep('refreshLoreTimeline', () => null)();
}

function appendSettingsResetButton(container, settingKeys, label = 'Settings') {
    return dep('appendSettingsResetButton', () => null)(container, settingKeys, label);
}

function runAutoRelevance(options = {}) {
    return dep('runAutoRelevance')(options);
}

function applyAutoRelevanceSuggestions(ids = null) {
    return dep('applyAutoRelevanceSuggestions', () => ({ applied: 0 }))(ids);
}

function rejectAutoRelevanceSuggestions(ids = null) {
    return dep('rejectAutoRelevanceSuggestions', () => ({ rejected: 0 }))(ids);
}

function clearAutoRelevanceSuggestions() {
    return dep('clearAutoRelevanceSuggestions', () => null)();
}

export function createAutoRelevanceCard(state) {
    const settings = getSettings();
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-auto-relevance-card';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Auto-Relevance';
    addTooltip(title, 'Periodically rescans recent context and adjusts accepted lore relevance tiers. Mute remains the hard injection on/off control.');
    card.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Auto-Relevance uses local scoring for performance. It can promote or demote High/Normal/Low relevance, but it does not change mute or pin.';
    card.appendChild(help);
    appendSettingsResetButton(card, AUTO_RELEVANCE_SETTING_KEYS, 'Auto-Relevance settings');

    const enabled = document.createElement('label');
    enabled.className = 'saga-inline-toggle';
    markTourTarget(enabled, 'lore.autoRelevance.toggle');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!settings.autoRelevanceEnabled;
    cb.addEventListener('change', () => {
        const next = getSettings();
        next.autoRelevanceEnabled = cb.checked;
        if (cb.checked && (!next.autoRelevanceMode || next.autoRelevanceMode === 'off')) next.autoRelevanceMode = 'suggest';
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true });
    });
    enabled.appendChild(cb);
    enabled.appendChild(document.createTextNode(' Enable Auto-Relevance'));
    card.appendChild(enabled);

    const modeRow = document.createElement('div');
    modeRow.className = 'saga-runtime-grid';
    markTourTarget(modeRow, 'lore.autoRelevance.mode');
    const modeLabel = document.createElement('label');
    modeLabel.className = 'saga-inline-field';
    const modeSpan = document.createElement('span');
    modeSpan.textContent = 'Action when enabled';
    addTooltip(modeSpan, 'The checkbox turns Auto-Relevance on or off. This selector controls what Auto-Relevance does when it runs.');
    const modeSelect = document.createElement('select');
    const selectedMode = (settings.autoRelevanceMode || 'suggest') === 'off' ? 'suggest' : (settings.autoRelevanceMode || 'suggest');
    for (const [value, label] of [['suggest', 'Suggest changes for review'], ['apply_high_confidence', 'Apply high-confidence changes']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (selectedMode === value) option.selected = true;
        modeSelect.appendChild(option);
    }
    modeSelect.addEventListener('change', () => {
        const next = getSettings();
        next.autoRelevanceMode = modeSelect.value;
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true });
    });
    modeLabel.appendChild(modeSpan);
    modeLabel.appendChild(modeSelect);
    modeRow.appendChild(modeLabel);
    card.appendChild(modeRow);

    const row = document.createElement('div');
    row.className = 'saga-runtime-grid';
    markTourTarget(row, 'lore.autoRelevance.tuning');
    row.appendChild(createNumberSettingMini('Run every turns', 'autoRelevanceEveryTurns', settings.autoRelevanceEveryTurns || 5, 1, 50));
    row.appendChild(createNumberSettingMini('Recent messages', 'autoRelevanceRecentMessages', settings.autoRelevanceRecentMessages || 20, 1, 200));
    row.appendChild(createNumberSettingMini('Candidate cap', 'autoRelevanceCandidateCap', settings.autoRelevanceCandidateCap || 40, 1, 500));
    row.appendChild(createNumberSettingMini('Min confidence %', 'autoRelevanceMinConfidence', Math.round((settings.autoRelevanceMinConfidence || 0.7) * 100), 1, 100, value => Number(value) / 100));
    card.appendChild(row);

    const modelRow = document.createElement('div');
    modelRow.className = 'saga-runtime-grid';
    markTourTarget(modelRow, 'lore.autoRelevance.model');
    const modelToggle = document.createElement('label');
    modelToggle.className = 'saga-inline-toggle';
    const modelCb = document.createElement('input');
    modelCb.type = 'checkbox';
    modelCb.checked = !!settings.autoRelevanceUseModel;
    modelCb.addEventListener('change', () => {
        const next = getSettings();
        next.autoRelevanceUseModel = modelCb.checked;
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true });
    });
    modelToggle.appendChild(modelCb);
    modelToggle.appendChild(document.createTextNode(' Use Utility Provider adjudication'));
    addTooltip(modelToggle, 'Optional second-stage model review. Saga still scores locally first and sends only the candidate cap subset.');
    modelRow.appendChild(modelToggle);
    modelRow.appendChild(createNumberSettingMini('Model candidate cap', 'autoRelevanceModelCandidateCap', settings.autoRelevanceModelCandidateCap || 30, 1, 80));
    modelRow.appendChild(createNumberSettingMini('Model max tokens', 'autoRelevanceModelMaxTokens', settings.autoRelevanceModelMaxTokens || 2048, 512, 4096));
    card.appendChild(modelRow);
    const counts = getLoreRelevanceCounts(state);
    card.appendChild(createKeyValue('Current tiers', `High ${counts.high} | Normal ${counts.normal} | Low ${counts.low} | Muted ${counts.muted}`, 'Current accepted lore counts by relevance.'));

    const suggestions = Array.isArray(state.autoRelevanceSuggestions) ? state.autoRelevanceSuggestions : [];
    if (suggestions.length) {
        const box = document.createElement('div');
        box.className = 'saga-auto-relevance-suggestions';
        markTourTarget(box, 'lore.autoRelevance.suggestions');
        const heading = document.createElement('div');
        heading.className = 'saga-runtime-help';
        heading.textContent = `Pending relevance suggestions: ${suggestions.length}`;
        box.appendChild(heading);
        for (const suggestion of suggestions.slice(0, 12)) {
            const row = document.createElement('div');
            row.className = 'saga-auto-relevance-suggestion-row';
            const summary = document.createElement('div');
            summary.className = 'saga-auto-relevance-suggestion-summary';
            summary.textContent = `${suggestion.title || suggestion.id}: ${suggestion.currentRelevance || '?'} -> ${suggestion.suggestedRelevance} (${Math.round((suggestion.confidence || 0) * 100)}%, ${suggestion.source || 'local'})`;
            addTooltip(summary, suggestion.reason || 'Auto-Relevance suggestion.');
            row.appendChild(summary);
            const applyOne = createButton('Apply', 'Apply this relevance suggestion only.', () => {
                const result = applyAutoRelevanceSuggestions([suggestion.id]);
                refreshPanelBody({ preserveScroll: true });
                refreshHeader();
                toast(`Applied ${result.applied || 0} relevance suggestion.`, 'success');
            }, 'saga-mini-button');
            const rejectOne = createButton('Reject', 'Reject this relevance suggestion only.', () => {
                const result = rejectAutoRelevanceSuggestions([suggestion.id]);
                refreshPanelBody({ preserveScroll: true });
                toast(`Rejected ${result.rejected || 0} relevance suggestion.`, 'info');
            }, 'saga-mini-button');
            row.appendChild(applyOne);
            row.appendChild(rejectOne);
            box.appendChild(row);
        }
        if (suggestions.length > 12) {
            const more = document.createElement('div');
            more.className = 'saga-runtime-help';
            more.textContent = `${suggestions.length - 12} additional suggestions hidden. Use Apply Suggestions or Clear Suggestions for the full queue.`;
            box.appendChild(more);
        }
        card.appendChild(box);
    }

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    markTourTarget(actions, 'lore.autoRelevance.actions');
    actions.appendChild(createButton('Run Auto-Relevance Now', 'Runs Auto-Relevance immediately. Local scoring always runs first; optional Utility Provider adjudication reviews only the candidate set.', async (btn) => {
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Running...';
        try {
            const result = await runAutoRelevance({ force: true });
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            if (result.status === 'no_accepted_lore') {
                toast('Auto-Relevance runs on accepted Lorecards. Preview Loredeck packs, add entries to Pending, then accept the cards you want before running it.', 'warning');
            } else if (result.status === 'pending_only') {
                toast(`Auto-Relevance found ${result.pendingCount || 0} pending Lorecards. Accept or dismiss pending cards before relevance scanning.`, 'warning');
            } else if (result.status === 'no_lore') {
                toast('Auto-Relevance needs accepted Lorecards before it can run.', 'warning');
            } else {
                toast(`Auto-Relevance ${result.status}: ${result.changed || 0} changed, ${result.suggested || 0} suggested, ${result.considered || 0} considered${result.modelStatus ? `, model ${result.modelStatus}` : ''}.`, 'info');
            }
        } catch (e) {
            console.error(e);
            toast(`Auto-Relevance failed: ${e?.message || e}`, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = original;
        }
    }, 'saga-primary-button'));
    if (suggestions.length) {
        actions.appendChild(createButton('Apply Suggestions', 'Applies all pending Auto-Relevance suggestions.', () => {
            const result = applyAutoRelevanceSuggestions();
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            toast(`Auto-Relevance suggestions applied: ${result.applied || 0}.`, 'success');
        }, 'saga-small-button'));
        actions.appendChild(createButton('Reject All Suggestions', 'Rejects all pending Auto-Relevance suggestions without applying them.', () => {
            clearAutoRelevanceSuggestions();
            refreshPanelBody({ preserveScroll: true });
            toast('Auto-Relevance suggestions rejected.', 'info');
        }, 'saga-small-button'));
    }
    card.appendChild(actions);
    return card;
}

function createNumberSettingMini(labelText, settingKey, value, min, max, transform = null) {
    const label = document.createElement('label');
    label.className = 'saga-inline-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener('change', () => {
        const next = getSettings();
        const raw = Math.max(min, Math.min(max, Number(input.value) || Number(value) || min));
        next[settingKey] = transform ? transform(raw) : raw;
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true });
    });
    label.appendChild(span);
    label.appendChild(input);
    return label;
}

export function openNewLoreDialog(options = {}) {
    const basicReview = !!options.basicReview || isBasicExperience();
    const existing = document.querySelector('.saga-new-lore-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'New Lorecard';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = basicReview
        ? 'Creates a pending draft for review and acceptance.'
        : 'Creates a pending draft for review, editing, and acceptance.';
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without creating lore.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form';
    shell.appendChild(form);

    const titleInput = createNewLoreInput(form, 'Title', 'Short descriptive title', '', false, 'Conundrum Confidicus opening hazard');
    const factInput = createNewLoreInput(form, 'Lore Text', 'The durable fact, rule, constraint, or state to remember', '', true, 'The Conundrum Confidicus is an ancient book that whispers whenever it is opened and chills the room around it.');
    const injectionInput = basicReview ? null : createNewLoreInput(form, 'Injection Override', 'Optional model-facing phrasing; blank uses Lore Text', '', true, 'When this book opens, describe faint whispers and an unnatural chill before any spell effect is revealed.');
    const notesInput = createNewLoreInput(form, 'Notes', 'Optional private notes for the user', '', true, 'Introduced during the Restricted Section scene. Keep as AU unless later tied to canon.');

    const metaGrid = document.createElement('div');
    metaGrid.className = 'saga-new-lore-meta-grid';
    form.appendChild(metaGrid);
    const categorySelect = createNewLoreSelect(metaGrid, 'Category', getLoreRegistryValues('categories', LORE_CATEGORY_VALUES), 'knowledge');
    const canonSelect = createNewLoreSelect(metaGrid, 'Canon', getLoreRegistryValues('canonStatuses', ['canon', 'au']), 'au');
    const relevanceSelect = createNewLoreSelect(metaGrid, 'Relevance', LORE_RELEVANCE_TIERS, 'normal', value => LORE_RELEVANCE_LABELS[value] || value);
    const prioritySelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Priority', getLorePriorityValues().map(String), '50');
    const truthSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Truth', getLoreRegistryValues('truthStatuses', ['true', 'rumor', 'contested', 'hidden']), 'true');
    const revealSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Reveal', getLoreRegistryValues('revealPolicies', ['private', 'public', 'do_not_reveal']), 'private');
    const tagsInput = createNewLoreInput(form, 'Tags', 'Comma-separated tags', '', false, 'restricted-section, cursed-book, whispers');

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Create Pending Lore', 'Adds this draft to Pending Lore Review.', () => {
        const title = titleInput.value.trim();
        const fact = factInput.value.trim();
        if (!title || !fact) {
            toast('New lore needs both a title and lore text.', 'warning');
            return;
        }

        const entry = normalizeLoreEntry({
            title,
            fact,
            category: categorySelect.value,
            canon: canonSelect.value,
            canonStatus: canonSelect.value,
            relevance: relevanceSelect.value,
            priority: prioritySelect ? Number(prioritySelect.value) || 50 : 50,
            truthStatus: truthSelect ? truthSelect.value : 'true',
            revealPolicy: revealSelect ? revealSelect.value : 'private',
            tags: tagsInput.value,
            source: 'manual',
            sourceInfo: {
                work: 'Manual Lore',
                notes: 'Created manually by the user.',
                confidence: 1,
            },
            content: {
                fact,
                injection: injectionInput ? injectionInput.value.trim() || fact : fact,
                notes: notesInput.value.trim(),
            },
            userEditable: true,
            userEdited: true,
            extensions: {
                sagaManualDraft: {
                    createdAt: Date.now(),
                    reviewRoute: 'manual_pending',
                },
            },
        });

        const result = appendPendingLoreEntries([entry], {
            source: 'manual',
            status: 'pending',
            summary: `Manual lore draft: ${entry.title}`,
            normalizedEntryCount: 1,
            rawEntryCount: 1,
        });
        recordLoreTimelineEvent(result.state, {
            type: 'manual_create_pending',
            source: 'manual',
            summary: `Created manual pending lore: ${entry.title}`,
            counts: { pending: 1 },
            refs: [{ id: entry.id, title: entry.title, category: entry.category, relevance: entry.relevance, canon: entry.canon }],
            patch: { pendingEntries: [entry] },
            reversible: false,
            force: true,
        });
        saveState(result.state);
        overlay.remove();
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
        refreshLoreTimeline();
        refreshLoreWorkbench();
        toast('Manual lore draft added to Pending Review.', 'success');
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without creating lore.', () => overlay.remove()));
    form.appendChild(actions);

    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : callback => setTimeout(callback, 0);
    schedule(() => titleInput.focus());
}

export function createNewLoreInput(container, labelText, tooltip, value = '', multiline = false, placeholder = '') {
    const label = document.createElement('label');
    label.className = 'saga-new-lore-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, tooltip);
    label.appendChild(span);
    const input = multiline ? document.createElement('textarea') : document.createElement('input');
    input.className = multiline ? 'saga-lore-editor-textarea' : 'saga-lore-editor-input';
    if (!multiline) input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder || '';
    label.appendChild(input);
    container.appendChild(label);
    return input;
}

export function createNewLoreSelect(container, labelText, values, selected, display = null) {
    const label = document.createElement('label');
    label.className = 'saga-new-lore-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);
    const select = document.createElement('select');
    select.className = 'saga-lore-editor-input';
    for (const value of values) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = display ? display(value) : getLoreDisplayLabel(labelToField(labelText), value);
        if (String(value) === String(selected)) option.selected = true;
        select.appendChild(option);
    }
    label.appendChild(select);
    container.appendChild(label);
    return select;
}

export function createAcceptedLoreBulkControls(state) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-lore-bulk-controls-card';

    const selected = getAcceptedSelectionSet(state);
    const filteredIds = getFilteredAcceptedLoreIds(state);
    const selectedCount = selected.size;
    const disabled = selectedCount === 0;

    const summary = document.createElement('div');
    summary.className = 'saga-lore-bulk-summary';
    summary.textContent = `${selectedCount} selected | ${filteredIds.length} matching current filters`;
    addTooltip(summary, 'Bulk actions apply to selected accepted lore entries. Use Select Filtered to select every accepted entry matching the current search and filters, not just the rendered page.');
    wrap.appendChild(summary);

    const selectRow = document.createElement('div');
    selectRow.className = 'saga-lore-bulk-row';
    const selectFiltered = createButton('Select Filtered', 'Selects every accepted lore entry matching the current search and filters, including entries not currently rendered by paging.', () => {
        setAcceptedLoreSelection(filteredIds, { deferSave: true });
        refreshAcceptedLoreList({ preserveScroll: true });
        refreshAcceptedLoreBulkToolbar();
        refreshLoreWorkbench();
    }, 'saga-small-button');
    selectRow.appendChild(selectFiltered);

    const clearSelection = createButton('Clear Selection', 'Clears the accepted-lore selection.', () => {
        setAcceptedLoreSelection([], { deferSave: true });
        refreshAcceptedLoreList({ preserveScroll: true });
        refreshAcceptedLoreBulkToolbar();
        refreshLoreWorkbench();
    }, 'saga-small-button');
    clearSelection.disabled = disabled;
    selectRow.appendChild(clearSelection);
    wrap.appendChild(selectRow);

    const actionRow = document.createElement('div');
    actionRow.className = 'saga-lore-bulk-row';

    const addAction = (label, tooltip, fn, className = 'saga-small-button', detail = '') => {
        const btn = createButton(label, tooltip, async () => {
            const ids = Array.from(getAcceptedSelectionSet(getState()));
            if (!ids.length) {
                toast('Select one or more accepted lore entries first.', 'warning');
                return;
            }
            const proceed = await confirmBulkAcceptedAction(label, ids, detail || tooltip);
            if (!proceed) return;
            await fn(ids);
        }, className);
        btn.disabled = disabled;
        actionRow.appendChild(btn);
        return btn;
    };

    addAction('Pin', 'Pins selected accepted lore entries so they are prioritized for injection.', ids => bulkSetAcceptedPinned(ids, true), 'saga-small-button', 'Selected entries will be pinned and prioritized for lore injection.');
    addAction('Unpin', 'Removes selected accepted lore entries from pinned lore.', ids => bulkSetAcceptedPinned(ids, false), 'saga-small-button', 'Selected entries will no longer be pinned. They may still inject if unmuted and active.');
    addAction('Mute', 'Mutes selected accepted lore entries so they are excluded from injection.', ids => bulkSetAcceptedMuted(ids, true), 'saga-small-button', 'Selected entries will be muted and excluded from injection.');
    addAction('Unmute', 'Unmutes selected accepted lore entries.', ids => bulkSetAcceptedMuted(ids, false), 'saga-small-button', 'Selected entries will be unmuted and may be injected again.');
    addAction('Delete', 'Deletes selected accepted lore entries from this chat after confirmation.', ids => bulkDeleteAcceptedLore(ids), 'saga-small-button saga-danger-button', 'Deleted accepted lore can be restored to Pending Review from Lore Timeline while the recovery payload is retained.');
    wrap.appendChild(actionRow);

    const editRow = document.createElement('div');
    editRow.className = 'saga-lore-bulk-row saga-lore-bulk-edit-row';
    const selectedIdsNow = () => Array.from(getAcceptedSelectionSet(getState()));
    editRow.appendChild(createBulkSelect('Relevance', LORE_RELEVANCE_TIERS, 'Set relevance tier for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Relevance', ids, `Selected entries will have relevance set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({
            ...raw,
            relevance: normalizeLoreRelevance(value),
            lifecycle: { ...(raw.lifecycle || {}), status: '', computedStatus: '', manualOverride: false, reason: 'Relevance replaced lifecycle state.' },
            extensions: { ...(raw.extensions || {}), autoRelevance: { ...(raw.extensions?.autoRelevance || {}), mode: 'manual', confidence: 1, reason: `Bulk relevance set to ${value}.`, updatedAt: Date.now() } },
        }));
    }, disabled, value => LORE_RELEVANCE_LABELS[value] || value));
    editRow.appendChild(createBulkSelect('Category', getLoreRegistryValues('categories', LORE_CATEGORY_VALUES), 'Set category for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Category', ids, `Selected entries will have category set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, category: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Canon', getLoreRegistryValues('canonStatuses', ['canon', 'au']), 'Set canon status for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Canon Status', ids, `Selected entries will have canon status set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, canon: value, canonStatus: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Truth', getLoreRegistryValues('truthStatuses', ['true', 'false', 'public_belief', 'rumor', 'contested', 'hidden']), 'Set truth status for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Truth Status', ids, `Selected entries will have truth status set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, truthStatus: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Reveal', getLoreRegistryValues('revealPolicies', ['public', 'private', 'do_not_reveal', 'only_if_knower_present', 'only_if_user_reveals']), 'Set reveal policy for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Reveal Policy', ids, `Selected entries will have reveal policy set to ${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, revealPolicy: value }));
    }, disabled));
    editRow.appendChild(createBulkSelect('Priority', getLorePriorityValues().map(String), 'Set priority for selected entries.', async value => {
        const ids = selectedIdsNow();
        if (!(await confirmBulkAcceptedAction('Set Priority', ids, `Selected entries will have priority set to P${value}.`))) return;
        bulkUpdateAcceptedLore(ids, raw => ({ ...raw, priority: Number(value) || 50 }));
    }, disabled, value => `P${value}`));
    wrap.appendChild(editRow);

    const tagRow = document.createElement('div');
    tagRow.className = 'saga-lore-bulk-row saga-lore-bulk-tag-row';
    const tagInput = document.createElement('input');
    tagInput.type = 'text';
    tagInput.className = 'saga-lore-bulk-tag-input';
    tagInput.placeholder = 'Add tag to selected...';
    tagInput.disabled = disabled;
    addTooltip(tagInput, 'Adds one searchable tag to all selected accepted lore entries.');
    tagInput.addEventListener('click', e => e.stopPropagation());
    tagRow.appendChild(tagInput);
    const addTagBtn = createButton('Add Tag', 'Adds the typed tag to selected entries.', () => {
        const ids = Array.from(getAcceptedSelectionSet(getState()));
        const tag = normalizeLoreTag(tagInput.value);
        if (!ids.length || !tag) {
            toast(ids.length ? 'Enter a tag first.' : 'Select entries first.', 'warning');
            return;
        }
        confirmBulkAcceptedAction('Add Tag', ids, `The tag "${tag}" will be added to selected accepted lore entries.`).then(proceed => {
            if (!proceed) return;
            bulkAddTagToAcceptedLore(ids, tag);
            tagInput.value = '';
        });
    }, 'saga-small-button');
    addTagBtn.disabled = disabled;
    tagRow.appendChild(addTagBtn);
    wrap.appendChild(tagRow);

    return wrap;
}

async function confirmBulkAcceptedAction(actionLabel, ids, detail = '') {
    const safeIds = Array.isArray(ids) ? ids : [];
    if (!safeIds.length) {
        toast('Select one or more accepted lore entries first.', 'warning');
        return false;
    }
    const state = getState();
    const byId = new Map(normalizeLoreMatrix(state?.loreMatrix || []).map(entry => [entry.id, entry]));
    const names = safeIds
        .map(id => byId.get(id)?.title || id)
        .filter(Boolean)
        .slice(0, 6);
    const extra = safeIds.length > names.length ? `\n...and ${safeIds.length - names.length} more.` : '';
    const message = [
        `You are about to perform this bulk action on ${safeIds.length} accepted lore entr${safeIds.length === 1 ? 'y' : 'ies'}:`,
        '',
        actionLabel,
        detail ? `\n${detail}` : '',
        names.length ? `\nSelected entries:\n- ${names.join('\n- ')}${extra}` : '',
        '',
        'Continue?'
    ].join('\n');
    return await confirmAction(`Confirm bulk lore action: ${actionLabel}`, message);
}

function createBulkSelect(label, values, tooltip, onChange, disabled = false, display = null) {
    const select = document.createElement('select');
    select.className = 'saga-lore-bulk-select';
    select.disabled = disabled;
    addTooltip(select, tooltip);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = `Set ${label}...`;
    placeholder.selected = true;
    select.appendChild(placeholder);
    for (const value of values) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = display ? display(value) : getLoreDisplayLabel(labelToField(label), value);
        select.appendChild(option);
    }
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('change', async () => {
        if (!select.value) return;
        const value = select.value;
        select.value = '';
        await onChange(value);
    });
    return select;
}

function labelToField(label) {
    if (label === 'Category') return 'category';
    if (label === 'Canon') return 'canonStatus';
    if (label === 'Relevance') return 'relevance';
    if (label === 'Priority') return 'priority';
    if (label === 'Truth') return 'truthStatus';
    if (label === 'Reveal') return 'revealPolicy';
    return 'category';
}

function getAcceptedLoreInitialVisibleLimit() {
    return dep('getAcceptedLoreInitialVisibleLimit', () => 40)();
}

function getAcceptedLorePageIncrement() {
    return dep('getAcceptedLorePageIncrement', () => 40)();
}

export function getFilteredLoreEntries(state) {
    const panelState = state?.lorePanel || {
        selectedCategory: 'all',
        search: '',
        selectedEntryId: '',
    };

    const { entries } = getPanelLoreState(state);
    let filtered = entries.filter(entry => !entry.isPending);

    if (panelState.selectedCategory === 'pending') {
        filtered = [];
    } else if (panelState.selectedCategory === 'active' || panelState.selectedCategory === 'high') {
        filtered = filtered.filter(e => e.relevance === 'high');
    } else if (panelState.selectedCategory === 'normal') {
        filtered = filtered.filter(e => e.relevance === 'normal');
    } else if (panelState.selectedCategory === 'low') {
        filtered = filtered.filter(e => e.relevance === 'low');
    } else if (panelState.selectedCategory === 'pinned') {
        filtered = filtered.filter(e => e.isPinned);
    } else if (panelState.selectedCategory === 'suppressed') {
        filtered = filtered.filter(e => e.isSuppressed);
    } else if (panelState.selectedCategory && panelState.selectedCategory !== 'all') {
        filtered = filtered.filter(e => e.category === panelState.selectedCategory);
    }

    const sourceFilter = panelState.sourceFilter || 'all';
    if (sourceFilter && sourceFilter !== 'all') {
        filtered = filtered.filter(entry => getLoreSourceBucket(entry) === sourceFilter);
    }

    const typeFilter = panelState.loreTypeFilter || 'all';
    if (typeFilter && typeFilter !== 'all') {
        filtered = filtered.filter(entry => entryMatchesLoreTypeFilter(entry, typeFilter));
    }

    filtered = [...filtered].sort(sortLoreEntriesForPanel);

    const query = String(panelState.search || '').trim().toLowerCase();
    if (!query) return filtered;

    return filtered
        .map(entry => ({ entry, score: scoreSearchEntry(entry, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) =>
            b.score - a.score
            || Number(b.entry.priority || 50) - Number(a.entry.priority || 50)
            || String(a.entry.title || '').localeCompare(String(b.entry.title || ''))
        )
        .map(item => item.entry);
}

function getBasicAcceptedLoreEntries(state) {
    const panelState = state?.lorePanel || { search: '' };
    const { entries } = getPanelLoreState(state);
    const filtered = entries
        .filter(entry => !entry.isPending)
        .sort(sortLoreEntriesForPanel);
    const query = String(panelState.search || '').trim().toLowerCase();
    if (!query) return filtered;

    return filtered
        .map(entry => ({ entry, score: scoreSearchEntry(entry, query) }))
        .filter(item => item.score > 0)
        .sort((a, b) =>
            b.score - a.score
            || Number(b.entry.priority || 50) - Number(a.entry.priority || 50)
            || String(a.entry.title || '').localeCompare(String(b.entry.title || ''))
        )
        .map(item => item.entry);
}

export function getLoreSourceBucket(entry) {
    const source = String(entry?.source || entry?.sourceInfo?.id || '').toLowerCase();
    const id = String(entry?.id || '').toLowerCase();
    const userEdited = !!entry?.userEdited;
    if (source.includes('canon-lore-db') || source.includes('canon database') || id.startsWith('canon_db_') || id.includes('_canon_')) return 'canon-db';
    if (source.includes('model-generated') || source.includes('story') || source.includes('lore-generator')) return 'story-generation';
    if (userEdited || source === 'user' || source === 'manual') return 'manual';
    return 'story-generation';
}

function sortLoreEntriesForPanel(a, b) {
    const pinScore = Number(!!b.isPinned) - Number(!!a.isPinned);
    if (pinScore) return pinScore;
    const pendingScore = Number(!!b.isPending) - Number(!!a.isPending);
    if (pendingScore) return pendingScore;
    const categoryScore = getLoreCategoryRank(a.category) - getLoreCategoryRank(b.category);
    if (categoryScore) return categoryScore;
    const priorityScore = Number(b.priority || 50) - Number(a.priority || 50);
    if (priorityScore) return priorityScore;
    const scopeScore = getLoreScopeSpecificity(b) - getLoreScopeSpecificity(a);
    if (scopeScore) return scopeScore;
    return String(a.title || '').localeCompare(String(b.title || ''));
}

function getLoreCategoryRank(category) {
    const order = ['event', 'timeline', 'character', 'relationship', 'location', 'faction', 'knowledge', 'secret', 'item', 'spell', 'rule', 'other'];
    const idx = order.indexOf(category || '');
    return idx >= 0 ? idx : 99;
}

export function scoreSearchEntry(entry, query) {
    const title = String(entry.title || '').toLowerCase();
    const tags = Array.isArray(entry.tags) ? entry.tags.map(t => String(t).toLowerCase()) : [];
    const scope = formatLoreScope(entry.scope).toLowerCase();
    const fact = String(entry.fact || '').toLowerCase();
    const id = String(entry.id || '').toLowerCase();
    const notes = String(entry.notes || '').toLowerCase();

    if (title === query) return 100;
    if (tags.some(t => t === query)) return 90;
    if (title.includes(query)) return 80;
    if (tags.some(t => t.includes(query))) return 70;
    if (scope.includes(query)) return 55;
    if (fact.includes(query)) return 40;
    if (notes.includes(query)) return 30;
    if (id.includes(query)) return 20;
    return 0;
}

export function refreshAcceptedLoreRow(entryId) {
    const root = getPanelRoot();
    if (!root || !entryId) return false;
    const list = root.querySelector('.saga-lore-entry-list');
    const existing = list?.querySelector?.(`[data-entry-id="${cssEscape(entryId)}"]`);
    if (!existing) return false;
    const state = getState();
    const basicReview = isBasicExperience();
    const entry = (basicReview ? getBasicAcceptedLoreEntries(state) : getFilteredLoreEntries(state)).find(item => item.id === entryId);
    if (!entry) {
        existing.remove();
        return true;
    }
    existing.replaceWith(createEntryCard(entry, state, { basicReview }));
    scheduleAcceptedLoreLayoutUpdate();
    return true;
}

function togglePinEntry(entryId, options = {}) {
    const state = getState();
    if (!state?.loreSelection) return;
    const beforeTimeline = captureLoreTimelineState(state);
    const sel = state.loreSelection;
    sel.pinnedIds = Array.isArray(sel.pinnedIds) ? sel.pinnedIds : [];
    sel.suppressedIds = Array.isArray(sel.suppressedIds) ? sel.suppressedIds : [];
    const idx = sel.pinnedIds.indexOf(entryId);
    if (idx >= 0) {
        sel.pinnedIds.splice(idx, 1);
    } else {
        sel.pinnedIds.push(entryId);
        const supIdx = sel.suppressedIds.indexOf(entryId);
        if (supIdx >= 0) sel.suppressedIds.splice(supIdx, 1);
    }
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: idx >= 0 ? 'unpin' : 'pin',
        source: 'manual',
        summary: `${idx >= 0 ? 'Unpinned' : 'Pinned'} lore entry.`,
    });
    if (options.deferSave) scheduleStateSave(state);
    else saveState(state);
}

function toggleSuppressEntry(entryId, options = {}) {
    const state = getState();
    if (!state?.loreSelection) return;
    const beforeTimeline = captureLoreTimelineState(state);
    const sel = state.loreSelection;
    sel.pinnedIds = Array.isArray(sel.pinnedIds) ? sel.pinnedIds : [];
    sel.suppressedIds = Array.isArray(sel.suppressedIds) ? sel.suppressedIds : [];
    const idx = sel.suppressedIds.indexOf(entryId);
    if (idx >= 0) {
        sel.suppressedIds.splice(idx, 1);
    } else {
        sel.suppressedIds.push(entryId);
        const pinIdx = sel.pinnedIds.indexOf(entryId);
        if (pinIdx >= 0) sel.pinnedIds.splice(pinIdx, 1);
    }
    recordLoreTimelineEvent(state, {
        before: beforeTimeline,
        after: captureLoreTimelineState(state),
        type: idx >= 0 ? 'unmute' : 'mute',
        source: 'manual',
        summary: `${idx >= 0 ? 'Unmuted' : 'Muted'} lore entry.`,
    });
    if (options.deferSave) scheduleStateSave(state);
    else saveState(state);
}

function createEditableLoreMetaBadge(entry, field, value, values = null, tooltip = '') {
    const fallbackValues = {
        category: LORE_CATEGORY_VALUES,
        canon: ['canon', 'au'],
        canonStatus: ['canon', 'au'],
        truthStatus: ['true', 'false', 'public_belief', 'rumor', 'contested', 'hidden'],
        revealPolicy: ['public', 'private', 'do_not_reveal', 'only_if_knower_present', 'only_if_user_reveals'],
    };
    const registryName = getLoreFieldRegistry(field);
    const effectiveValues = Array.from(new Set((Array.isArray(values) && values.length
        ? values
        : getLoreRegistryValues(registryName, fallbackValues[field] || [])
    ).map(v => String(v || '').trim()).filter(Boolean)));

    const currentValue = String(value || effectiveValues[0] || '').trim();
    const currentLabel = getLoreDisplayLabel(field, currentValue);
    const meta = registryName ? getLoreRegistryMeta(registryName, currentValue) : null;
    const help = tooltip || meta?.description || `${field}: ${currentLabel}. Choose a new value from the dropdown.`;

    const wrap = document.createElement('label');
    wrap.className = 'saga-lore-meta-select-wrap';
    applyLoreRegistryStyle(wrap, field, currentValue);
    addTooltip(wrap, help);

    const prefix = document.createElement('span');
    prefix.className = 'saga-lore-meta-select-prefix';
    prefix.textContent = (field === 'canonStatus' || field === 'canon')
        ? 'Canon'
        : field === 'truthStatus'
            ? 'Truth'
            : field === 'revealPolicy'
                ? 'Reveal'
                : 'Category';
    wrap.appendChild(prefix);

    const select = document.createElement('select');
    select.className = 'saga-lore-meta-select';
    select.setAttribute('aria-label', `${prefix.textContent} metadata`);
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('mousedown', e => e.stopPropagation());

    for (const optionValue of effectiveValues) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = getLoreDisplayLabel(field, optionValue);
        if (optionValue === currentValue) option.selected = true;
        select.appendChild(option);
    }

    if (currentValue && !effectiveValues.includes(currentValue)) {
        const option = document.createElement('option');
        option.value = currentValue;
        option.textContent = getLoreDisplayLabel(field, currentValue);
        option.selected = true;
        select.insertBefore(option, select.firstChild);
    }

    select.addEventListener('change', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextValue = select.value;
        updateLoreEntryById(entry.id, raw => field === 'canonStatus' || field === 'canon'
            ? ({ ...raw, canon: nextValue, canonStatus: nextValue })
            : ({ ...raw, [field]: nextValue }), { deferSave: true });
        if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    });

    wrap.appendChild(select);
    return wrap;
}

function createEditablePriorityBadge(entry) {
    const current = Number(entry.priority || 50);
    const wrap = document.createElement('label');
    wrap.className = 'saga-lore-meta-select-wrap saga-lore-meta-select-priority';
    addTooltip(wrap, 'Priority controls sorting and injection preference. Choose P10 through P100.');

    const prefix = document.createElement('span');
    prefix.className = 'saga-lore-meta-select-prefix';
    prefix.textContent = 'Priority';
    wrap.appendChild(prefix);

    const select = document.createElement('select');
    select.className = 'saga-lore-meta-select';
    select.setAttribute('aria-label', 'Priority metadata');
    select.addEventListener('click', e => e.stopPropagation());
    select.addEventListener('mousedown', e => e.stopPropagation());

    for (const value of getLorePriorityValues()) {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = `P${value}`;
        if (value === current) option.selected = true;
        select.appendChild(option);
    }

    select.addEventListener('change', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextValue = Math.max(0, Math.min(100, Number(select.value) || 50));
        updateLoreEntryById(entry.id, raw => ({ ...raw, priority: nextValue }), { deferSave: true });
        if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    });

    wrap.appendChild(select);
    return wrap;
}

function createEditableLoreEntryEditor(entry, options = {}) {
    const basicReview = !!options.basicReview;
    const editor = document.createElement('div');
    editor.className = 'saga-lore-entry-editor';
    addTooltip(editor, basicReview ? 'Edit this accepted Lorecard directly. Changes are saved only when you click Save Entry.' : 'Edit accepted lore directly. Changes are saved only when you click Save Entry.');

    const makeField = (labelText, value, multiline = false) => {
        const label = document.createElement('label');
        label.className = 'saga-lore-editor-field';
        const span = document.createElement('span');
        span.textContent = labelText;
        label.appendChild(span);
        const input = multiline ? document.createElement('textarea') : document.createElement('input');
        input.className = multiline ? 'saga-lore-editor-textarea' : 'saga-lore-editor-input';
        if (!multiline) input.type = 'text';
        input.value = value || '';
        input.addEventListener('click', e => e.stopPropagation());
        input.addEventListener('mousedown', e => e.stopPropagation());
        label.appendChild(input);
        editor.appendChild(label);
        return input;
    };

    const titleInput = makeField('Title', entry.title || '', false);
    const factInput = makeField('Lore text / fact', entry.fact || entry.content?.fact || '', true);
    const injectionInput = basicReview ? null : makeField('Injection override', entry.content?.injection || '', true);
    const notesInput = makeField('Notes', entry.notes || entry.content?.notes || '', true);
    const metaGrid = document.createElement('div');
    metaGrid.className = 'saga-new-lore-meta-grid saga-lore-editor-meta-grid';
    editor.appendChild(metaGrid);
    const categorySelect = createNewLoreSelect(metaGrid, 'Category', getLoreRegistryValues('categories', LORE_CATEGORY_VALUES), entry.category || 'other');
    const canonSelect = createNewLoreSelect(metaGrid, 'Canon', getLoreRegistryValues('canonStatuses', ['canon', 'au']), entry.canon || entry.canonStatus || 'canon');
    const relevanceSelect = createNewLoreSelect(metaGrid, 'Relevance', LORE_RELEVANCE_TIERS, entry.relevance || 'normal', value => RELEVANCE_META[value]?.label || value);
    const prioritySelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Priority', getLorePriorityValues().map(String), String(entry.priority || 50));
    const truthSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Truth', getLoreRegistryValues('truthStatuses', ['true', 'rumor', 'contested', 'hidden']), entry.truthStatus || 'true');
    const revealSelect = basicReview ? null : createNewLoreSelect(metaGrid, 'Reveal', getLoreRegistryValues('revealPolicies', ['private', 'public', 'do_not_reveal']), entry.revealPolicy || 'private');
    const tagsInput = makeField('Tags', (entry.tags || []).join(', '), false);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const saveBtn = createButton('Save Entry', 'Saves the edited title, lore text, injection override, and notes for this accepted lore entry.', (btn, e) => {
        e?.stopPropagation?.();
        const title = titleInput.value.trim() || entry.title || '(Untitled lore)';
        const fact = factInput.value.trim();
        const injection = injectionInput ? injectionInput.value.trim() : entry.content?.injection || fact;
        const notes = notesInput.value.trim();
        updateLoreEntryById(entry.id, raw => ({
            ...raw,
            title,
            fact,
            notes,
            category: categorySelect.value,
            canon: canonSelect.value,
            canonStatus: canonSelect.value,
            relevance: normalizeLoreRelevance(relevanceSelect.value),
            priority: prioritySelect ? Number(prioritySelect.value) || 50 : raw.priority,
            truthStatus: truthSelect ? truthSelect.value : raw.truthStatus,
            revealPolicy: revealSelect ? revealSelect.value : raw.revealPolicy,
            tags: tagsInput.value,
            content: {
                ...(raw.content || {}),
                fact,
                injection,
                notes,
            },
            userEdited: true,
        }), { deferSave: false });
        if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
        refreshHeader();
        refreshLoreWorkbench();
    }, 'saga-primary-button');
    actions.appendChild(saveBtn);
    editor.appendChild(actions);
    return editor;
}

function updateLoreEntryById(entryId, updater, options = {}) {
    const state = getState();
    if (!entryId || typeof updater !== 'function') return false;
    const beforeTimeline = captureLoreTimelineState(state);

    for (const key of ['loreMatrix', 'pendingLoreEntries']) {
        const list = Array.isArray(state[key]) ? state[key] : [];
        const idx = list.findIndex(item => item?.id === entryId);
        if (idx < 0) continue;

        const updated = normalizeLoreEntry(updater(list[idx]));
        updated.userEdited = true;
        list[idx] = updated;
        state[key] = list;
        if (key === 'loreMatrix') {
            recordLoreTimelineEvent(state, {
                before: beforeTimeline,
                after: captureLoreTimelineState(state),
                type: options.timelineType || 'edit',
                source: options.timelineSource || 'manual',
                summary: options.timelineSummary || `Edited lore entry: ${updated.title || updated.id}.`,
            });
        }
        if (options.deferSave) scheduleStateSave(state);
        else saveState(state);
        return true;
    }

    return false;
}

function addLoreTag(entryId, tag, options = {}) {
    const clean = normalizeLoreTag(tag);
    if (!clean) return false;
    return updateLoreEntryById(entryId, (entry) => {
        const tags = Array.isArray(entry.tags) ? entry.tags.map(normalizeLoreTag).filter(Boolean) : [];
        const exists = tags.some(t => t.toLowerCase() === clean.toLowerCase());
        return { ...entry, tags: exists ? tags : [...tags, clean] };
    }, options);
}

function removeLoreTag(entryId, tag, options = {}) {
    const clean = normalizeLoreTag(tag).toLowerCase();
    return updateLoreEntryById(entryId, (entry) => ({
        ...entry,
        tags: (Array.isArray(entry.tags) ? entry.tags : [])
            .map(normalizeLoreTag)
            .filter(t => t && t.toLowerCase() !== clean),
    }), options);
}

export function refreshAcceptedLoreList(options = {}) {
    const root = getPanelRoot();
    if (!root) return;
    const list = root.querySelector('.saga-lore-entry-list');
    if (!list) return;
    const scrollTop = options.preserveScroll ? list.scrollTop : 0;
    renderAcceptedLoreEntryList(list, getState(), { basicReview: isBasicExperience() });
    scheduleAcceptedLoreLayoutUpdate();
    if (options.preserveScroll) list.scrollTop = scrollTop;
}

function refreshAcceptedLoreBulkToolbar() {
    return dep('refreshAcceptedLoreBulkToolbar', () => null)();
}

function cssEscape(value) {
    if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

export function createEntryCard(entry, state, options = {}) {
    const basicReview = !!options.basicReview;
    const card = document.createElement('div');
    card.className = 'saga-lore-entry-card';
    markTourTarget(card, entry.isPending ? 'lore.pending.entry' : 'lore.accepted.entry');
    if (entry.id) card.dataset.entryId = entry.id;
    if (basicReview) card.classList.add('saga-basic-review-entry-card');

    if (entry.isPending) card.classList.add('saga-lore-entry-pending');
    if (entry.isActive) card.classList.add('saga-lore-entry-active');
    if (entry.isPinned) card.classList.add('saga-lore-entry-pinned');
    if (entry.isSuppressed) card.classList.add('saga-lore-entry-suppressed');
    if (getAcceptedSelectionSet(state).has(entry.id)) card.classList.add('saga-lore-entry-selected');

    const panelState = state?.lorePanel || {};
    const isExpanded = panelState.selectedEntryId === entry.id;
    if (isExpanded) card.classList.add('saga-lore-entry-expanded');

    const headerRow = document.createElement('div');
    headerRow.className = 'saga-lore-entry-header';

    if (!basicReview) {
        const selectBox = document.createElement('input');
        selectBox.type = 'checkbox';
        selectBox.className = 'saga-lore-entry-select';
        selectBox.checked = getAcceptedSelectionSet(state).has(entry.id);
        selectBox.setAttribute('aria-label', 'Select accepted lore entry for bulk actions');
        addTooltip(selectBox, selectBox.checked ? 'Remove this accepted lore entry from the bulk selection.' : 'Select this accepted lore entry for bulk actions.');
        selectBox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAcceptedLoreSelection(entry.id, selectBox.checked);
            if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
        });
        headerRow.appendChild(selectBox);
    }

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-entry-title-wrap';

    const titleEl = document.createElement('span');
    titleEl.className = 'saga-lore-entry-title';
    titleEl.textContent = entry.title || '(Untitled lore)';
    addTooltip(titleEl, basicReview ? 'Click the card to expand, edit, or inspect this accepted Lorecard.' : 'Click the card to expand details. Tags beside this title are editable search tags.');
    titleWrap.appendChild(titleEl);
    headerRow.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-lore-entry-actions';
    actions.appendChild(createEditableLifecycleBadge(entry));

    const pinBtn = createIconButton(
        entry.isPinned ? 'Pinned' : 'Pin',
        basicReview
            ? (entry.isPinned ? 'Stop keeping this Lorecard especially prominent.' : 'Keep this Lorecard especially prominent when Saga chooses future-response lore.')
            : (entry.isPinned ? 'Remove this entry from pinned lore. Pinned lore is prioritized for injection.' : 'Pin this entry so it is prioritized for injection.'),
        'saga-lore-entry-btn',
        (e) => {
            e.stopPropagation();
            togglePinEntry(entry.id, { deferSave: true });
            if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
            refreshHeader();
            refreshLoreWorkbench();
        }
    );
    actions.appendChild(pinBtn);

    const suppressBtn = createIconButton(
        entry.isSuppressed ? 'Muted' : 'Mute',
        basicReview
            ? (entry.isSuppressed ? 'Let this saved Lorecard affect future responses again.' : 'Keep this Lorecard saved but stop it from affecting future responses.')
            : (entry.isSuppressed ? 'Unmute this entry so it can become active again.' : 'Mute this entry so it will not be injected into prompts.'),
        'saga-lore-entry-btn',
        (e) => {
            e.stopPropagation();
            toggleSuppressEntry(entry.id, { deferSave: true });
            if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
            refreshHeader();
            refreshLoreWorkbench();
        }
    );
    actions.appendChild(suppressBtn);

    headerRow.appendChild(actions);
    card.appendChild(headerRow);

    const metaRow = document.createElement('div');
    metaRow.className = 'saga-lore-entry-meta';
    if (isExpanded) {
        metaRow.appendChild(createEditableLoreMetaBadge(entry, 'category', entry.category || 'other', null, `Category: ${entry.category || 'canon'}. Use dropdown to change.`));
        metaRow.appendChild(createLorePurposeBadge(entry));
        metaRow.appendChild(createEditableLoreMetaBadge(entry, 'canonStatus', entry.canon || entry.canonStatus || 'canon', null, `Canon/Story: ${entry.canon || entry.canonStatus || 'canon'}. Use dropdown to change.`));
        if (!basicReview) {
            metaRow.appendChild(createEditableLoreMetaBadge(entry, 'truthStatus', entry.truthStatus || 'true', null, `Truth/reveal status: ${entry.truthStatus || 'true'}. Use dropdown to change.`));
            metaRow.appendChild(createEditableLoreMetaBadge(entry, 'revealPolicy', entry.revealPolicy || 'private', null, `Reveal policy: ${entry.revealPolicy || 'private'}. Use dropdown to change.`));
            metaRow.appendChild(createEditablePriorityBadge(entry));
        }
    } else {
        metaRow.appendChild(createRegistryBadge('category', entry.category || 'other', `Category: ${entry.category || 'canon'}. Expand the entry to edit.`));
        metaRow.appendChild(createLorePurposeBadge(entry));
        metaRow.appendChild(createRegistryBadge('canonStatus', entry.canon || entry.canonStatus || 'canon', `Canon/Story: ${entry.canon || entry.canonStatus || 'canon'}. Expand the entry to edit.`));
        if (!basicReview) metaRow.appendChild(createBadge(`P${Number(entry.priority || 50)}`, 'Priority. Expand the entry to edit.'));
    }
    if (!basicReview) metaRow.appendChild(createSpellMetadataBadges(entry));
    if (entry.isPending) metaRow.appendChild(createBadge('pending', 'This entry is pending review.'));
    if (entry.isPinned) metaRow.appendChild(createBadge('pinned', 'Pinned entries are prioritized for injection.'));
    if (entry.isSuppressed) metaRow.appendChild(createBadge('muted', 'Muted entries are excluded from injection.'));
    card.appendChild(metaRow);

    card.appendChild(createTagsRow(entry));

    const factEl = document.createElement('div');
    factEl.className = 'saga-lore-entry-fact';
    factEl.textContent = truncateText(entry.fact || '', 140);
    addTooltip(factEl, 'Lore fact text. Expand the card to inspect the full entry.');
    card.appendChild(factEl);

    card.addEventListener('click', () => {
        const currentPanelState = getState()?.lorePanel || {};
        const newId = currentPanelState.selectedEntryId === entry.id ? '' : entry.id;
        setPanelState({ selectedEntryId: newId }, { deferSave: true });
        if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
    });

    if (isExpanded) {
        const details = document.createElement('div');
        details.className = 'saga-lore-entry-details';

        details.appendChild(createEditableLoreEntryEditor(entry, { basicReview }));

        if (entry.fact && entry.fact.length > 140) {
            const fullFact = document.createElement('div');
            fullFact.className = 'saga-lore-entry-full-fact';
            fullFact.textContent = entry.fact;
            details.appendChild(fullFact);
        }

        const detailRows = [];
        if (entry.source) detailRows.push(['Source', entry.source]);
        if (hasDisplayableScope(entry.scope)) detailRows.push(['Scope', entry.scope]);
        if (entry.appliesTo?.length) detailRows.push(['Applies to', entry.appliesTo.join(', ')]);
        if (entry.publicVersion) detailRows.push(['Public version', entry.publicVersion]);
        if (entry.whoKnowsTruth?.length) detailRows.push(['Who knows truth', entry.whoKnowsTruth.join(', ')]);
        if (entry.whoSuspects?.length) detailRows.push(['Who suspects', entry.whoSuspects.join(', ')]);
        if (entry.revealPolicy) detailRows.push(['Reveal policy', entry.revealPolicy]);
        if (entry.validFrom || entry.validTo) detailRows.push(['Valid window', `${entry.validFrom || '...'} to ${entry.validTo || '...'}`]);
        if (entry.notes) detailRows.push(['Notes', entry.notes]);

        for (const [label, value] of detailRows) {
            details.appendChild(createKeyValue(label, value, `${label} metadata for this lore entry.`));
        }

        const aw = entry.activeWhen || {};
        const conditions = [];
        if (aw.erasAny?.length) conditions.push(`Eras: ${aw.erasAny.join(', ')}`);
        if (aw.locationsAny?.length) conditions.push(`Locations: ${aw.locationsAny.join(', ')}`);
        if (aw.charactersPresentAny?.length) conditions.push(`Cast: ${aw.charactersPresentAny.join(', ')}`);
        if (aw.tagsAny?.length) conditions.push(`Tags: ${aw.tagsAny.join(', ')}`);
        if (conditions.length) {
            const cond = document.createElement('div');
            cond.className = 'saga-lore-entry-conditions';
            cond.textContent = `Relevant when: ${conditions.join(' | ')}`;
            addTooltip(cond, 'Context conditions used to determine whether this lore entry should be active.');
            details.appendChild(cond);
        }

        if (entry.isPending) {
            const pendingActions = document.createElement('div');
            pendingActions.className = 'saga-lore-entry-pending-actions';
            pendingActions.appendChild(createButton('Apply', 'Accepts this pending entry into the lore matrix.', (btn, e) => {
                e?.stopPropagation?.();
                const current = getState();
                const pending = normalizeLoreMatrix(current?.pendingLoreEntries || []);
                const idx = pending.findIndex(pe => pe.id === entry.id);
                if (idx >= 0) {
                    acceptPendingLoreEntry(idx);
                    refreshPanelBody({ preserveScroll: true });
                    refreshHeader();
                }
            }, 'saga-primary-button'));
            pendingActions.appendChild(createButton('Dismiss', 'Rejects this pending entry.', (btn, e) => {
                e?.stopPropagation?.();
                const current = getState();
                const pending = normalizeLoreMatrix(current?.pendingLoreEntries || []);
                const idx = pending.findIndex(pe => pe.id === entry.id);
                if (idx >= 0) {
                    rejectPendingLoreEntry(idx);
                    refreshPanelBody({ preserveScroll: true });
                    refreshHeader();
                }
            }));
            details.appendChild(pendingActions);
        }

        card.appendChild(details);
    }

    return card;
}

function createTagsRow(entry) {
    const row = document.createElement('div');
    row.className = 'saga-lore-entry-tags';
    addTooltip(row, 'Tags are editable search labels. Search matches tags as well as entry titles.');

    const tags = Array.isArray(entry.tags) ? entry.tags : [];
    for (const tag of tags) {
        const chip = document.createElement('span');
        chip.className = 'saga-lore-tag-chip';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'saga-lore-tag-remove';
        removeBtn.type = 'button';
        removeBtn.textContent = 'x';
        addTooltip(removeBtn, `Remove tag: ${tag}`);
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeLoreTag(entry.id, tag, { deferSave: true });
            if (!refreshAcceptedLoreRow(entry.id)) refreshAcceptedLoreList({ preserveScroll: true });
            refreshLoreWorkbench();
        });
        chip.appendChild(removeBtn);

        const label = document.createElement('span');
        label.className = 'saga-lore-tag-label';
        label.textContent = tag;
        chip.appendChild(label);
        row.appendChild(chip);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'saga-lore-tag-add';
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addTooltip(addBtn, 'Add a searchable tag to this lore entry.');
    addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showInlineTagInput(row, entry.id, addBtn);
    });
    row.appendChild(addBtn);

    return row;
}

function showInlineTagInput(row, entryId, addBtn) {
    if (row.querySelector('.saga-lore-tag-input')) return;

    const input = document.createElement('input');
    input.className = 'saga-lore-tag-input';
    input.type = 'text';
    input.placeholder = 'tag';
    addTooltip(input, 'Type a tag and press Enter. Press Escape to cancel.');

    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            input.dataset.committed = '1';
            commitInlineTagInput(entryId, input.value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            input.remove();
        }
    });
    input.addEventListener('blur', () => {
        if (input.dataset.committed === '1') return;
        if (input.value.trim()) {
            input.dataset.committed = '1';
            commitInlineTagInput(entryId, input.value);
        } else {
            input.remove();
        }
    });

    row.insertBefore(input, addBtn);
    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : callback => setTimeout(callback, 0);
    schedule(() => input.focus());
}

function commitInlineTagInput(entryId, rawTag) {
    const tag = normalizeLoreTag(rawTag);
    if (!tag) {
        refreshPanelBody({ preserveScroll: true });
        return;
    }
    addLoreTag(entryId, tag, { deferSave: true });
    if (!refreshAcceptedLoreRow(entryId)) refreshAcceptedLoreList({ preserveScroll: true });
    refreshLoreWorkbench();
}

export function renderLorecardsTab(container, state) {
    const basic = isBasicExperience();
    container.appendChild(createSectionHeader(
        'Lorecards',
        basic ? 'Suggest, review, and manage Lorecards with advanced controls hidden.' : 'Suggest canon Lorecards from the local database, generate story-specific Lorecards with the model, review pending cards, and manage accepted Lorecards.'
    ));
    if (!basic) {
        const timelineSection = createCollapsibleSection(
            'lore.timeline',
            'Lore Timeline',
            'accepted-lore audit + recovery',
            true,
            createLoreTimelineCard(state),
            { tooltip: 'Story-aware audit trail for accepted lore changes and recoverable lore versions.' }
        );
        markTourTarget(timelineSection, 'lore.timeline.section');
        container.appendChild(timelineSection);
    }

    const generationSection = createCollapsibleSection(
        'lore.generation',
        'Lorecard Generation',
        basic ? 'canon suggestions + story scan' : 'canon suggestions + story generation',
        true,
        dep('createLoreGenerationCard')(state),
        { tooltip: 'Suggest canon Lorecards from the local database or generate story-specific Lorecards from recent chat messages.', className: 'saga-lore-generation-collapsible' }
    );
    markTourTarget(generationSection, 'lore.generation.section');
    container.appendChild(generationSection);

    if (!basic) {
        const autoRelevanceSection = createCollapsibleSection(
            'lore.autoRelevance',
            'Auto-Relevance',
            getSettings().autoRelevanceEnabled ? `every ${getSettings().autoRelevanceEveryTurns || 5} turns` : 'off',
            false,
            createAutoRelevanceCard(state),
            { tooltip: 'Automatically promotes or demotes accepted lore between High, Normal, and Low relevance tiers.' }
        );
        markTourTarget(autoRelevanceSection, 'lore.autoRelevance');
        container.appendChild(autoRelevanceSection);
    }

    const pendingCount = (state?.pendingLoreEntries || []).length;
    const pendingSection = createCollapsibleSection(
        'lore.pendingReview',
        'Pending Lorecard Review',
        pendingCount ? `${pendingCount} pending` : 'none',
        basic ? true : pendingCount > 0,
        createPendingLoreReviewSection(state, { basicReview: basic }),
        { tooltip: 'Review suggested/generated Lorecards before accepting them.', className: 'saga-lore-pending-collapsible' }
    );
    markTourTarget(pendingSection, 'lore.pending');
    container.appendChild(pendingSection);

    const loreState = getPanelLoreState(state);
    const acceptedCount = Math.max(0, (loreState.counts?.all || 0) - (loreState.counts?.pending || 0));
    const injectableCount = getSelectedLoreInjectionCount(state, getSettings());
    const acceptedSection = createCollapsibleSection(
        'lore.acceptedEntries',
        'Accepted Lorecards',
        basic ? `${acceptedCount} accepted \u00b7 ${injectableCount} selected` : `${acceptedCount} accepted \u00b7 ${injectableCount} injectable`,
        true,
        createAcceptedLoreEntriesSection(state, { basicReview: basic }),
        { tooltip: basic ? 'Search and review accepted Lorecards that can affect future responses.' : 'Search, filter, bulk edit, tag, pin, mute, and edit accepted Lorecards.', className: 'saga-lore-accepted-collapsible' }
    );
    markTourTarget(acceptedSection, 'lore.accepted');
    container.appendChild(acceptedSection);
}

export function createPendingLoreReviewSection(state, options = {}) {
    const basicReview = !!options.basicReview;
    const pendingLore = normalizeLoreMatrix(state?.pendingLoreEntries || []);
    const filteredPendingRows = getFilteredPendingLoreRows(state);
    const section = document.createElement('div');
    section.className = 'saga-review-section saga-pending-lore-section';
    if (basicReview) section.classList.add('saga-basic-review-pending-section');

    if (!basicReview) {
        section.appendChild(createLoreWorkbenchLaunchRow('pending', pendingLore.length ? `${pendingLore.length} pending entries` : 'No pending entries yet'));
    }

    if (pendingLore.length > 0) {
        const batchInfo = document.createElement('div');
        batchInfo.className = 'saga-runtime-help';
        batchInfo.textContent = basicReview
            ? 'Accept facts that should affect future responses. Dismiss the rest.'
            : getPendingLoreBatchLabel(state);
        section.appendChild(batchInfo);

        const filterRow = document.createElement('div');
        filterRow.className = 'saga-lore-filter-row saga-pending-lore-filter-row';
        filterRow.appendChild(createLoreTypeFilterSelect(
            pendingLore,
            getPendingReviewTypeFilter(state),
            (value) => {
                setPendingReviewTypeFilter(value);
                refreshPanelBody({ preserveScroll: true });
                refreshLoreWorkbench();
            },
            { tooltip: 'Filter pending Lorecards by relevance, card type, canon/AU, pin, or mute state.' }
        ));
        const filterCount = document.createElement('div');
        filterCount.className = 'saga-lore-workbench-count';
        filterCount.textContent = `${filteredPendingRows.length} matching`;
        filterRow.appendChild(filterCount);
        section.appendChild(filterRow);

        if (!basicReview) {
            section.appendChild(markTourTarget(createPendingLoreBulkControls(pendingLore, state), 'lore.pending.bulk'));
        } else if (pendingLore.length > 8) {
            const advancedRow = document.createElement('div');
            advancedRow.className = 'saga-basic-advanced-handoff';
            advancedRow.appendChild(createButton('Bulk Tools in Advanced', 'Switch to Advanced Lorecards and open the Pending Review workbench.', () => openAdvancedLoreReview('pending'), 'saga-small-button'));
            section.appendChild(advancedRow);
        }

        const visibleLimit = Math.max(5, Math.min(1000, Number(state?.lorePanel?.pendingReviewVisibleLimit) || 10));
        const list = document.createElement('div');
        list.className = 'saga-review-lore-list saga-pending-lore-list';
        markTourTarget(list, 'lore.pending.list');
        filteredPendingRows.slice(0, visibleLimit).forEach(row => list.appendChild(createPendingLoreReviewCard(row.entry, row.index, isPendingLoreSelected(state, row.entry), { basicReview })));
        if (!filteredPendingRows.length) {
            list.appendChild(createEmptyMessage('No pending Lorecards match the current type filter.'));
        }
        section.appendChild(list);

        if (filteredPendingRows.length > visibleLimit) {
            const more = createButton(`Show ${Math.min(25, filteredPendingRows.length - visibleLimit)} more`, 'Renders more pending lore cards. Keeping this list paged prevents large canon batches from freezing the browser.', () => {
                const current = getState();
                current.lorePanel.pendingReviewVisibleLimit = Math.min(filteredPendingRows.length, visibleLimit + 25);
                saveState(current);
                refreshPanelBody({ preserveScroll: true });
            });
            more.classList.add('saga-small-button');
            section.appendChild(more);
        }
    } else {
        section.appendChild(createEmptyMessage(basicReview
            ? 'No Lorecards are waiting for review. Use Lorecard Generation above or add one manually.'
            : 'No lore entries are waiting for review. Use Suggest Canon Lore or Scan Story Lore above.'
        ));
    }

    return section;
}

export function createAcceptedLoreEntriesSection(state, options = {}) {
    const basicReview = !!options.basicReview;
    const section = document.createElement('div');
    section.className = 'saga-accepted-lore-section';
    if (basicReview) section.classList.add('saga-basic-review-accepted-section');

    const controls = document.createElement('div');
    controls.className = 'saga-lore-controls';

    const panelState = state?.lorePanel || { selectedCategory: 'all', search: '' };
    const loreState = getPanelLoreState(state);
    const { entries, categories, counts } = loreState;
    const acceptedCount = Math.max(0, (counts?.all || 0) - (counts?.pending || 0));

    if (!basicReview) {
        controls.appendChild(createLoreWorkbenchLaunchRow('accepted', `${acceptedCount} accepted entries`));
    } else if (acceptedCount > 12) {
        const advancedRow = document.createElement('div');
        advancedRow.className = 'saga-basic-advanced-handoff';
        advancedRow.appendChild(createButton('Manage in Advanced', 'Switch to Advanced Lorecards and open the Accepted Lore workbench.', () => openAdvancedLoreReview('accepted'), 'saga-small-button'));
        controls.appendChild(advancedRow);
    }

    if (!basicReview) {
        const tabs = document.createElement('div');
        tabs.className = 'saga-lore-tabs';
        markTourTarget(tabs, 'lore.accepted.categoryTabs');
        for (const cat of categories) {
            const tab = document.createElement('button');
            tab.className = 'saga-lore-tab';
            if (cat === panelState.selectedCategory) tab.classList.add('saga-lore-tab-active');
            tab.type = 'button';
            const label = getLoreDisplayLabel('category', cat);
            const catCount = getCategoryCount(cat, entries, counts);
            tab.textContent = `${label} (${catCount})`;
            tab.dataset.category = cat;
            addTooltip(tab, getCategoryTooltip(cat));
            tab.addEventListener('click', () => {
                setPanelState({ selectedCategory: cat, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
                refreshAcceptedLoreCategoryTabs(cat);
                refreshAcceptedLoreFilterResults({ resetListScroll: true });
            });
            tabs.appendChild(tab);
        }
        controls.appendChild(tabs);
    }

    const filterRow = document.createElement('div');
    filterRow.className = 'saga-lore-filter-row';
    markTourTarget(filterRow, 'lore.accepted.filters');

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'saga-lore-search';
    searchInput.placeholder = basicReview ? 'Search accepted Lorecards...' : 'Search titles and tags...';
    searchInput.value = panelState.search || '';
    addTooltip(searchInput, basicReview ? 'Search accepted Lorecards by title, tags, fact text, notes, or ID.' : 'Searches lore entry titles and tags first. Fact text, notes, and IDs are searched as fallback.');
    searchInput.addEventListener('input', (e) => {
        setPanelState({ search: e.target.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
        scheduleAcceptedLoreListRender(section);
    });
    filterRow.appendChild(searchInput);

    if (!basicReview) {
        const sourceSelect = document.createElement('select');
        sourceSelect.className = 'saga-lore-source-filter';
        addTooltip(sourceSelect, 'Filter accepted lore by origin: canon database, story generation, or manual/user-created entries.');
        const sourceOptions = [
            ['all', 'Source: All'],
            ['canon-db', 'Canon Database'],
            ['story-generation', 'Story Generation'],
            ['manual', 'Manual / User'],
        ];
        for (const [value, label] of sourceOptions) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if ((panelState.sourceFilter || 'all') === value) opt.selected = true;
            sourceSelect.appendChild(opt);
        }
        sourceSelect.addEventListener('change', () => {
            setPanelState({ sourceFilter: sourceSelect.value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
            refreshAcceptedLoreFilterResults({ resetListScroll: true });
        });
        filterRow.appendChild(sourceSelect);

        const acceptedPool = entries.filter(entry => !entry.isPending);
        filterRow.appendChild(createLoreTypeFilterSelect(
            acceptedPool,
            panelState.loreTypeFilter || 'all',
            (value) => {
                setPanelState({ loreTypeFilter: value, acceptedLoreVisibleLimit: getAcceptedLoreInitialVisibleLimit() }, { deferSave: true });
                refreshAcceptedLoreFilterResults({ resetListScroll: true });
            },
            { tooltip: 'Filter accepted Lorecards by relevance, card type, canon/AU, pin, or mute state.' }
        ));
    }
    controls.appendChild(filterRow);

    if (!basicReview) {
        const pinHelp = document.createElement('div');
        pinHelp.className = 'saga-runtime-help saga-pin-help';
        markTourTarget(pinHelp, 'lore.accepted.pinMuteHelp');
        pinHelp.textContent = 'Pinned = prioritized/protected. Muted = excluded from injection. Relevance controls tier placement, sorting, and compression budget.';
        addTooltip(pinHelp, 'Pin important facts you always want kept prominent. Mute facts that should stay stored but not be sent to the model.');
        controls.appendChild(pinHelp);

        const bulkMount = document.createElement('div');
        bulkMount.className = 'saga-lore-bulk-toolbar';
        markTourTarget(bulkMount, 'lore.accepted.bulk');
        bulkMount.appendChild(createAcceptedLoreBulkControls(state));
        controls.appendChild(bulkMount);
    }

    section.appendChild(controls);

    const list = document.createElement('div');
    list.className = 'saga-lore-entry-list saga-accepted-lore-scroll-region';
    markTourTarget(list, 'lore.accepted.list');
    list.setAttribute('role', 'region');
    list.setAttribute('aria-label', 'Accepted lore entries');
    renderAcceptedLoreEntryList(list, state, { basicReview });
    section.appendChild(list);
    return section;
}

export function renderAcceptedLoreEntryList(list, state, options = {}) {
    if (!list) return;
    list.replaceChildren();

    const basicReview = !!options.basicReview;
    const filtered = basicReview ? getBasicAcceptedLoreEntries(state) : getFilteredLoreEntries(state);
    if (filtered.length === 0) {
        list.appendChild(createEmptyMessage('No lore entries match the current filter.'));
        return;
    }

    const panelState = state?.lorePanel || {};
    const visibleLimit = Math.max(10, Math.min(
        filtered.length,
        Number(panelState.acceptedLoreVisibleLimit) || getAcceptedLoreInitialVisibleLimit()
    ));
    const visible = filtered.slice(0, visibleLimit);
    const fragment = document.createDocumentFragment();

    const summary = document.createElement('div');
    summary.className = 'saga-lore-list-summary';
    summary.textContent = filtered.length > visible.length
        ? `Showing ${visible.length} of ${filtered.length} accepted lore entries.`
        : `Showing ${filtered.length} accepted lore entr${filtered.length === 1 ? 'y' : 'ies'}.`;
    fragment.appendChild(summary);

    for (const entry of visible) {
        fragment.appendChild(createEntryCard(entry, state, { basicReview }));
    }

    if (filtered.length > visible.length) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'saga-secondary-button saga-lore-show-more';
        const pageIncrement = getAcceptedLorePageIncrement();
        const nextCount = Math.min(pageIncrement, filtered.length - visible.length);
        more.textContent = `Show ${nextCount} more`;
        addTooltip(more, 'Renders more accepted lore entries. Keeping the list paged prevents large lore matrices from slowing the browser.');
        more.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setPanelState({ acceptedLoreVisibleLimit: visible.length + pageIncrement }, { deferSave: true });
            refreshAcceptedLoreList({ preserveScroll: true });
            refreshAcceptedLoreBulkToolbar();
        });
        fragment.appendChild(more);
    }

    list.appendChild(fragment);
}
