import {
    addTooltip,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
    runBusyAction,
    toast,
} from './runtime-ui-kit.js';
import {
    formatContextIndexSummary,
    getContextPackSummary,
} from './context-panel.js';
import {
    analyzeContextQuery,
    contextTextIncludesTerm,
    normalizeContextSearchText,
    rankContextAnchors,
} from './context-index.js';

let contextWorkbenchDeps = {};

export function configureContextWorkbenchPanel(deps = {}) {
    contextWorkbenchDeps = { ...contextWorkbenchDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = contextWorkbenchDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Context Workbench dependency is not configured: ${name}`);
}

function getContextWorkbenchTab() { return dep('getContextWorkbenchTab', () => 'context')(); }
function setContextWorkbenchTab(tabId) { return dep('setContextWorkbenchTab', () => null)(tabId); }
function getContextWorkbenchPackId() { return dep('getContextWorkbenchPackId', () => '')(); }
function setContextWorkbenchPackId(packId) { return dep('setContextWorkbenchPackId', () => null)(packId); }
function clearContextWorkbenchSelectedKey() { return dep('clearContextWorkbenchSelectedKey', () => null)(); }
function renderContextWorkbench() { return dep('renderContextWorkbench', () => null)(); }
function closeContextWorkbench() { return dep('closeContextWorkbench', () => null)(); }
function refreshContextHeader() { return dep('refreshContextHeader', () => null)(); }
function clearContextIndexCache() { return dep('clearContextIndexCache', () => null)(); }
function loadContextIndex(options) { return dep('loadContextIndex', async () => null)(options); }
function getRuntimeState() { return dep('getRuntimeState', () => ({}))(); }
function getContextWorkbenchStack(state) { return dep('getContextWorkbenchStack', () => [])(state); }
function getContextWorkbenchPack(state) { return dep('getContextWorkbenchPack', () => null)(state); }
function getContextWorkbenchTimelineItems(pack, contextIndex) { return dep('getContextWorkbenchTimelineItems', () => [])(pack, contextIndex); }
function filterContextWorkbenchTimelineItems(items, query, typeFilter) { return dep('filterContextWorkbenchTimelineItems', items => items)(items, query, typeFilter); }
function getContextTimelineItemKey(item) { return dep('getContextTimelineItemKey', item => `${item?.kind || 'item'}:${item?.id || ''}`)(item); }
function getContextTimelineItemContextText(item) { return dep('getContextTimelineItemContextText', () => '')(item); }
function getContextTimelineItemCoordinateText(item) { return dep('getContextTimelineItemCoordinateText', () => '')(item); }
function getLoredeckContext(state, packId) { return dep('getLoredeckContext', () => ({}))(state, packId); }
function getLoredeckDisplayName(packId) { return dep('getLoredeckDisplayName', packId => String(packId || 'Loredeck'))(packId); }
function getContextTypeLabel(value) { return dep('getContextTypeLabel', value => String(value || 'Custom'))(value); }
function formatContextSummary(context) { return dep('formatContextSummary', () => 'Unset.')(context); }
function formatContextSource(value) { return dep('formatContextSource', value => String(value || 'Unknown'))(value); }
function getContextWorkbenchQuery() { return dep('getContextWorkbenchQuery', () => '')(); }
function setContextWorkbenchQuery(query) { return dep('setContextWorkbenchQuery', () => null)(query); }
function getContextWorkbenchSelectedKey() { return dep('getContextWorkbenchSelectedKey', () => '')(); }
function setContextWorkbenchSelectedKey(itemKey) { return dep('setContextWorkbenchSelectedKey', () => null)(itemKey); }
function getContextWorkbenchTypeFilter() { return dep('getContextWorkbenchTypeFilter', () => 'all')(); }
function setContextWorkbenchTypeFilter(typeFilter) { return dep('setContextWorkbenchTypeFilter', () => null)(typeFilter); }
function getContextWorkbenchWaypointQuery() { return dep('getContextWorkbenchWaypointQuery', () => '')(); }
function setContextWorkbenchWaypointQuery(query) { return dep('setContextWorkbenchWaypointQuery', () => null)(query); }
function getContextWorkbenchWaypointFilter() { return dep('getContextWorkbenchWaypointFilter', () => 'major')(); }
function setContextWorkbenchWaypointFilter(filter) { return dep('setContextWorkbenchWaypointFilter', () => null)(filter); }
function getContextWorkbenchResolverQuery() { return dep('getContextWorkbenchResolverQuery', () => '')(); }
function setContextWorkbenchResolverQuery(query) { return dep('setContextWorkbenchResolverQuery', () => null)(query); }
function getContextWorkbenchContextQuery() { return dep('getContextWorkbenchContextQuery', () => '')(); }
function setContextWorkbenchContextQuery(query) { return dep('setContextWorkbenchContextQuery', () => null)(query); }
function resolveContextsFromContext(btn) { return dep('resolveContextsFromContext', async () => null)(btn); }
function modelResolveContexts(btn) { return dep('modelResolveContexts', async () => null)(btn); }
function setLoredeckContextManualLock(packId, manualLock) { return dep('setLoredeckContextManualLock', () => null)(packId, manualLock); }
function resetLoredeckContextFromWorkbench(packId) { return dep('resetLoredeckContextFromWorkbench', async () => null)(packId); }
function seedLoredeckContextFromRuntimeContext(packId, context) { return dep('seedLoredeckContextFromRuntimeContext', () => null)(packId, context); }
function appendContextManualFields(container, packId, context) { return dep('appendContextManualFields', () => null)(container, packId, context); }
function applyContextTimelineItem(packId, item) { return dep('applyContextTimelineItem', () => null)(packId, item); }
function applyContextAnchor(packId, anchor) { return dep('applyContextAnchor', () => null)(packId, anchor); }
function applyContextEntryCandidate(packId, match) { return dep('applyContextEntryCandidate', () => null)(packId, match); }
function applyContextAnchorBoundary(packId, item, mode) { return dep('applyContextAnchorBoundary', () => null)(packId, item, mode); }
function commitLoredeckContextPatch(packId, patch, summary, options) { return dep('commitLoredeckContextPatch', () => null)(packId, patch, summary, options); }
function validateLoredeckForEditor(pack, btn) { return dep('validateLoredeckForEditor', async () => null)(pack, btn); }
function loadLoredeckEntriesForEditor(pack, btn) { return dep('loadLoredeckEntriesForEditor', async () => null)(pack, btn); }
function canValidateLoredeckInEditor(pack) { return dep('canValidateLoredeckInEditor', () => false)(pack); }
function getLoredeckEntryPreview(packId) { return dep('getLoredeckEntryPreview', () => null)(packId); }
function getContextWorkbenchEntryRows(pack) { return dep('getContextWorkbenchEntryRows', () => [])(pack); }
function buildContextEntryDerivedAnchor(pack, row, analysis) { return dep('buildContextEntryDerivedAnchor', () => null)(pack, row, analysis); }
function getContextResolverMissReasons(pack, analysis, packIndex) { return dep('getContextResolverMissReasons', () => [])(pack, analysis, packIndex); }
function getContextEntryResolverMatches(pack, analysis, options) { return dep('getContextEntryResolverMatches', () => [])(pack, analysis, options); }
function queueContextEntryCandidateTimelineAnchor(pack, match) { return dep('queueContextEntryCandidateTimelineAnchor', () => false)(pack, match); }
function openDuplicateLoredeckDialog(pack) { return dep('openDuplicateLoredeckDialog', () => null)(pack); }
function normalizeLoredeckTimelineId(value) { return dep('normalizeLoredeckTimelineId', value => String(value || '').trim().toLowerCase())(value); }
function normalizeLoredeckTimelineNumber(value) { return dep('normalizeLoredeckTimelineNumber', value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
})(value); }
function openLoredeckEditorForQuery(packId, query, message) { return dep('openLoredeckEditorForQuery', () => null)(packId, query, message); }
function openLoredeckTimelineAnchorDialog(pack, item) { return dep('openLoredeckTimelineAnchorDialog', () => null)(pack, item); }
function openLoredeckTimelineWindowDialog(pack, item) { return dep('openLoredeckTimelineWindowDialog', () => null)(pack, item); }
function setLoredeckTimelineItemDisabled(pack, kind, id, disabled) { return dep('setLoredeckTimelineItemDisabled', () => null)(pack, kind, id, disabled); }
function removeLoredeckTimelineDefinition(pack, kind, id) { return dep('removeLoredeckTimelineDefinition', () => null)(pack, kind, id); }
function exportContextWorkbenchTimelineRegistry(pack) { return dep('exportContextWorkbenchTimelineRegistry', () => null)(pack); }

export function createContextWorkbenchTimelineView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'wandlight-context-workbench-view';
    const pack = getContextWorkbenchPack(state);
    if (!pack) {
        view.appendChild(createEmptyMessage('No loaded Loredeck selected.'));
        return view;
    }
    const allItems = getContextWorkbenchTimelineItems(pack, contextIndex);
    const visibleItems = filterContextWorkbenchTimelineItems(allItems);
    let selectedKey = getContextWorkbenchSelectedKey();
    if (!visibleItems.some(item => getContextTimelineItemKey(item) === selectedKey)) {
        selectedKey = visibleItems[0] ? getContextTimelineItemKey(visibleItems[0]) : (allItems[0] ? getContextTimelineItemKey(allItems[0]) : '');
        setContextWorkbenchSelectedKey(selectedKey);
    }
    const selected = allItems.find(item => getContextTimelineItemKey(item) === selectedKey) || visibleItems[0] || allItems[0] || null;

    view.appendChild(createContextWorkbenchTimelineControls(state, contextIndex, pack, allItems, visibleItems));

    const main = document.createElement('div');
    main.className = 'wandlight-context-workbench-main';
    main.appendChild(createContextWorkbenchTimelineTable(pack, visibleItems, selected));
    main.appendChild(createContextWorkbenchInspector(pack, selected, allItems, contextIndex));
    view.appendChild(main);
    return view;
}

function createContextWorkbenchTimelineControls(state, contextIndex, pack, allItems = [], visibleItems = []) {
    const controls = document.createElement('div');
    controls.className = 'wandlight-context-workbench-controls';
    controls.appendChild(createContextWorkbenchPackSelector(state, contextIndex));

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wandlight-lore-workbench-search';
    search.placeholder = 'Search anchors, windows, arcs, dates, aliases, tags...';
    search.value = getContextWorkbenchQuery();
    addTooltip(search, 'Search the selected Loredeck timeline registry.');
    search.addEventListener('input', () => {
        setContextWorkbenchQuery(search.value);
        renderContextWorkbench();
    });
    controls.appendChild(search);

    const type = document.createElement('select');
    type.className = 'wandlight-lore-workbench-select';
    addTooltip(type, 'Filter timeline rows by registry object type.');
    const activeTypeFilter = getContextWorkbenchTypeFilter();
    for (const [value, label] of [['all', 'All Types'], ['anchor', 'Anchors'], ['window', 'Windows']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (activeTypeFilter === value) option.selected = true;
        type.appendChild(option);
    }
    type.addEventListener('change', () => {
        setContextWorkbenchTypeFilter(type.value);
        setContextWorkbenchSelectedKey('');
        renderContextWorkbench();
    });
    controls.appendChild(type);

    const count = document.createElement('div');
    count.className = 'wandlight-lore-workbench-count';
    count.textContent = `${visibleItems.length} / ${allItems.length} shown`;
    controls.appendChild(count);

    const loadButton = createButton('Load Context', 'Load entries, tags, and timeline files so attachment counts and source registry rows are current.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
        await loadContextIndex({ force: true }).catch(() => null);
        renderContextWorkbench();
    });
    loadButton.disabled = !canValidateLoredeckInEditor(pack);
    controls.appendChild(loadButton);

    const newAnchor = createButton('New Anchor', 'Create a new timeline anchor proposal for this Custom Loredeck.', () => openLoredeckTimelineAnchorDialog(pack, null));
    newAnchor.disabled = pack.type === 'bundled';
    controls.appendChild(newAnchor);

    const newWindow = createButton('New Window', 'Create a new timeline window proposal for this Custom Loredeck.', () => openLoredeckTimelineWindowDialog(pack, null));
    newWindow.disabled = pack.type === 'bundled';
    controls.appendChild(newWindow);

    const exportButton = createButton('Export Timeline', 'Download the merged active timeline registry for this Loredeck.', () => {
        exportContextWorkbenchTimelineRegistry(pack);
    });
    exportButton.disabled = !allItems.length;
    controls.appendChild(exportButton);
    return controls;
}

function createContextWorkbenchTimelineTable(pack, items = [], selected = null) {
    const table = document.createElement('div');
    table.className = 'wandlight-context-workbench-table';
    const header = document.createElement('div');
    header.className = 'wandlight-context-workbench-table-row wandlight-context-workbench-row-header';
    for (const label of ['Type', 'Label / ID', 'Context', 'Coordinates', 'Aliases', 'Tags', 'Attached', 'State']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    if (!items.length) {
        table.appendChild(createEmptyMessage('No matching timeline definitions. Load context, create anchors/windows, or clear the search.'));
        return table;
    }

    for (const item of items.slice(0, 500)) {
        const key = getContextTimelineItemKey(item);
        const def = item.definition || {};
        const row = document.createElement('div');
        row.className = 'wandlight-context-workbench-table-row';
        if (selected && key === getContextTimelineItemKey(selected)) row.classList.add('wandlight-context-workbench-row-active');
        if (item.disabled) row.classList.add('wandlight-context-workbench-row-disabled');
        row.addEventListener('click', () => {
            setContextWorkbenchSelectedKey(key);
            renderContextWorkbench();
        });
        row.appendChild(createWorkbenchTextCell(item.kind === 'window' ? 'Window' : 'Anchor', item.registryState || 'source'));
        row.appendChild(createWorkbenchTextCell(def.label || item.id, item.id));
        row.appendChild(createWorkbenchTextCell(getContextTimelineItemContextText(item), item.kind === 'window' ? `${def.anchorFrom || '?'} -> ${def.anchorTo || '?'}` : 'sort key'));
        row.appendChild(createWorkbenchTextCell(getContextTimelineItemCoordinateText(item), def.notes || ''));
        row.appendChild(createWorkbenchTextCell(String(def.aliases?.length || 0), def.aliases?.slice(0, 3).join(', ') || ''));
        row.appendChild(createWorkbenchTextCell(String(def.tags?.length || 0), def.tags?.slice(0, 3).join(', ') || ''));
        row.appendChild(createWorkbenchTextCell(String(item.entryIds?.length || 0), item.entryIds?.slice(0, 2).join(', ') || ''));
        row.appendChild(createWorkbenchTextCell(item.registryState || 'source', item.disabled ? 'disabled' : 'active'));
        table.appendChild(row);
    }
    if (items.length > 500) {
        const note = document.createElement('div');
        note.className = 'wandlight-lore-workbench-row-note';
        note.textContent = `Showing first 500 of ${items.length} matching definitions. Narrow the search to inspect more precisely.`;
        table.appendChild(note);
    }
    return table;
}

function createContextWorkbenchInspector(pack, selected = null, allItems = [], contextIndex = null) {
    const detail = document.createElement('div');
    detail.className = 'wandlight-context-workbench-inspector';
    if (!selected) {
        detail.appendChild(createEmptyMessage('Select an anchor or window to inspect it.'));
        return detail;
    }
    const def = selected.definition || {};

    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-inspector-title';
    title.textContent = def.label || selected.id || 'Timeline Definition';
    detail.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(selected.kind === 'window' ? 'Window' : 'Anchor', 'Timeline registry object type.'));
    chips.appendChild(createStatusPill(selected.registryState || 'source', 'Source/custom overlay state.'));
    chips.appendChild(createStatusPill(`${selected.entryIds?.length || 0} attached`, 'Lorecards attached to this timeline Context.'));
    if (selected.disabled) chips.appendChild(createStatusPill('Disabled', 'This definition is suppressed by the Custom overlay.'));
    detail.appendChild(chips);

    const grid = document.createElement('div');
    grid.className = 'wandlight-context-workbench-inspector-grid';
    grid.appendChild(createKeyValue('ID', selected.id, 'Stable timeline registry ID.'));
    grid.appendChild(createKeyValue('Context', getContextTimelineItemContextText(selected) || 'unset', 'Sort key or sort range.'));
    if (selected.kind === 'window') {
        grid.appendChild(createKeyValue('From', def.anchorFrom || 'unset', 'Window start anchor.'));
        grid.appendChild(createKeyValue('To', def.anchorTo || 'unset', 'Window end anchor.'));
    }
    grid.appendChild(createKeyValue('Coordinates', getContextTimelineItemCoordinateText(selected) || 'unset', 'Date, arc, episode, chapter, quest, or other coordinates.'));
    grid.appendChild(createKeyValue('Aliases', def.aliases?.join(', ') || 'none', 'Local resolver aliases.'));
    grid.appendChild(createKeyValue('Tags', def.tags?.join(', ') || 'none', 'Timeline tags.'));
    grid.appendChild(createKeyValue('Notes', def.notes || 'none', 'Registry author notes.'));
    detail.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions wandlight-context-workbench-inspector-actions';
    actions.appendChild(createButton('Apply to Context', 'Set the selected Loredeck Context to this anchor/window.', () => {
        applyContextTimelineItem(pack.packId, selected);
    }, 'wandlight-primary-button'));

    const editButton = createButton('Edit Definition', 'Edit this timeline definition as a Pending Review proposal.', () => {
        if (selected.kind === 'anchor') openLoredeckTimelineAnchorDialog(pack, selected);
        else openLoredeckTimelineWindowDialog(pack, selected);
    });
    editButton.disabled = pack.type === 'bundled';
    actions.appendChild(editButton);

    const disableButton = createButton(selected.disabled ? 'Restore Definition' : 'Disable Definition', selected.disabled ? 'Queue restore for this timeline definition.' : 'Queue suppression for this timeline definition.', () => {
        setLoredeckTimelineItemDisabled(pack, selected.kind, selected.id, !selected.disabled);
    });
    disableButton.disabled = pack.type === 'bundled';
    actions.appendChild(disableButton);

    if (selected.customDefined) {
        const forgetButton = createButton('Forget Overlay', 'Queue removal of this Custom timeline overlay definition.', () => {
            removeLoredeckTimelineDefinition(pack, selected.kind, selected.id);
        }, 'wandlight-danger-button');
        forgetButton.disabled = pack.type === 'bundled';
        actions.appendChild(forgetButton);
    }
    if (pack.type === 'bundled') {
        actions.appendChild(createButton('Duplicate as Custom', 'Create an editable Custom Loredeck copy before changing bundled timeline data.', () => {
            openDuplicateLoredeckDialog(pack);
        }));
    }
    const attachedButton = createButton('Find Lorecards', 'Open this Loredeck details panel filtered to Lorecards attached to this timeline ID.', () => {
        openLoredeckEditorForQuery(pack.packId, selected.id || '', 'Loredeck editor filtered to attached timeline ID.');
    });
    attachedButton.disabled = !(selected.entryIds?.length);
    actions.appendChild(attachedButton);
    detail.appendChild(actions);

    const issues = getContextWorkbenchValidationIssues(pack, allItems, contextIndex).filter(issue => issue.itemKey === getContextTimelineItemKey(selected));
    if (issues.length) {
        const issueWrap = document.createElement('div');
        issueWrap.className = 'wandlight-context-workbench-mini-list';
        const issueTitle = document.createElement('div');
        issueTitle.className = 'wandlight-runtime-card-title';
        issueTitle.textContent = 'Warnings';
        issueWrap.appendChild(issueTitle);
        for (const issue of issues.slice(0, 4)) {
            const row = document.createElement('div');
            row.className = `wandlight-context-workbench-mini-item wandlight-context-workbench-issue-${issue.severity || 'suggestion'}`;
            row.textContent = issue.message;
            issueWrap.appendChild(row);
        }
        detail.appendChild(issueWrap);
    }
    return detail;
}

export function createContextWorkbenchShell(state = {}, contextIndex = null) {
    const shell = document.createElement('div');
    shell.className = 'wandlight-lore-workbench-shell wandlight-context-workbench-shell';
    shell.addEventListener('click', event => event.stopPropagation());

    shell.appendChild(createContextWorkbenchHeader(state, contextIndex));

    const body = document.createElement('div');
    body.className = 'wandlight-context-workbench-body';
    const activeTab = getContextWorkbenchTab();
    if (activeTab === 'timeline') {
        body.appendChild(createContextWorkbenchTimelineView(state, contextIndex));
    } else if (activeTab === 'aliases') {
        body.appendChild(createContextWorkbenchAliasesView(state, contextIndex));
    } else if (activeTab === 'validation') {
        body.appendChild(createContextWorkbenchValidationView(state, contextIndex));
    } else {
        body.appendChild(createContextWorkbenchContextView(state, contextIndex));
    }
    shell.appendChild(body);

    return shell;
}

function createContextWorkbenchHeader(state = {}, contextIndex = null) {
    const header = document.createElement('div');
    header.className = 'wandlight-lore-workbench-header wandlight-context-workbench-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'wandlight-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'wandlight-lore-workbench-title';
    title.textContent = 'Context Workbench';
    titleWrap.appendChild(title);

    const stack = getContextWorkbenchStack(state);
    const selectedPack = getContextWorkbenchPack(state);
    const subtitle = document.createElement('div');
    subtitle.className = 'wandlight-lore-workbench-subtitle';
    subtitle.textContent = selectedPack
        ? `${selectedPack.title || selectedPack.packId} | ${stack.length} loaded Loredeck${stack.length === 1 ? '' : 's'}`
        : 'Load a Loredeck stack to set Context.';
    titleWrap.appendChild(subtitle);

    const chips = document.createElement('div');
    chips.className = 'wandlight-context-workbench-header-chips';
    chips.appendChild(createStatusPill(formatContextIndexSummary(contextIndex), 'Loaded Context timeline registry status.'));
    if (selectedPack) {
        const context = getLoredeckContext(state, selectedPack.packId);
        chips.appendChild(createStatusPill(context.manualLock ? 'Manual lock' : 'Auto allowed', 'Manual lock prevents automatic Context resolvers from overwriting this deck.'));
        chips.appendChild(createStatusPill(formatContextSource(context.source), 'How this Context was last set.'));
    }
    if (contextIndex?.summary?.issueCount) {
        chips.appendChild(createStatusPill(`${contextIndex.summary.issueCount} index issue${contextIndex.summary.issueCount === 1 ? '' : 's'}`, 'Timeline registry load issues from the active stack.'));
    }
    titleWrap.appendChild(chips);
    header.appendChild(titleWrap);

    const tabs = document.createElement('div');
    tabs.className = 'wandlight-lore-workbench-mode-tabs wandlight-context-workbench-tabs';
    const activeTab = getContextWorkbenchTab();
    for (const [id, label] of [
        ['context', 'Context'],
        ['timeline', 'Timeline'],
        ['aliases', 'Aliases'],
        ['validation', 'Validation'],
    ]) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'wandlight-lore-workbench-mode-tab';
        if (activeTab === id) tab.classList.add('wandlight-lore-workbench-mode-tab-active');
        tab.textContent = label;
        addTooltip(tab, getContextWorkbenchTabTooltip(id));
        tab.addEventListener('click', () => {
            setContextWorkbenchTab(id);
            renderContextWorkbench();
        });
        tabs.appendChild(tab);
    }
    header.appendChild(tabs);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions wandlight-context-workbench-header-actions';
    actions.appendChild(createButton('Refresh Index', 'Reload loaded Loredeck timeline registries and refresh the workbench.', async (btn) => {
        await runBusyAction(btn, 'Refreshing...', async () => {
            clearContextIndexCache();
            await loadContextIndex({ force: true }).catch(() => null);
            renderContextWorkbench();
            refreshContextHeader();
            toast('Context index refreshed.', 'success');
        });
    }));
    actions.appendChild(createButton('Done', 'Close the Context Workbench.', closeContextWorkbench, 'wandlight-primary-button'));
    header.appendChild(actions);
    return header;
}

function getContextWorkbenchTabTooltip(tabId = '') {
    if (tabId === 'timeline') return 'Search, inspect, create, and queue timeline anchor/window registry changes.';
    if (tabId === 'aliases') return 'Inspect resolver aliases and duplicate phrasing across the selected Loredeck timeline.';
    if (tabId === 'validation') return 'Check timeline structure for missing anchors, sort issues, sparse aliases, and unmatchable references.';
    return 'Set the current chat Context for each loaded Loredeck.';
}

export function createContextWorkbenchPackSelector(state = {}, contextIndex = null) {
    const select = document.createElement('select');
    select.className = 'wandlight-lore-workbench-select';
    addTooltip(select, 'Selected loaded Loredeck for timeline, alias, and validation views.');
    const selectedPackId = getContextWorkbenchPackId();
    for (const item of getContextWorkbenchStack(state)) {
        const packSummary = getContextPackSummary(contextIndex, item.packId);
        const option = document.createElement('option');
        option.value = item.packId;
        option.textContent = `${getLoredeckDisplayName(item.packId)}${packSummary?.hasIndex ? ` (${packSummary.anchorCount || 0}/${packSummary.windowCount || 0})` : ''}`;
        if (item.packId === selectedPackId) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('change', () => {
        setContextWorkbenchPackId(select.value);
        clearContextWorkbenchSelectedKey();
        renderContextWorkbench();
    });
    return select;
}

export function createContextWorkbenchContextView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'wandlight-context-workbench-view wandlight-context-workbench-context-view';
    const stack = getContextWorkbenchStack(state);
    if (!stack.length) {
        view.appendChild(createEmptyMessage('No enabled Loredecks are loaded. Open the Loredeck Library and add decks to the active stack first.'));
        return view;
    }

    const controls = document.createElement('div');
    controls.className = 'wandlight-context-workbench-controls';
    controls.appendChild(createButton('Resolve From Context', 'Use current Context and loaded timeline aliases to update unlocked Contexts.', async (btn) => {
        await resolveContextsFromContext(btn);
        renderContextWorkbench();
    }, 'wandlight-primary-button'));
    controls.appendChild(createButton('Resolve With Reasoner', 'Ask the configured Reasoning Provider to resolve unresolved Contexts using bounded known candidates.', async (btn) => {
        await modelResolveContexts(btn);
        renderContextWorkbench();
    }));
    controls.appendChild(createButton('Open Selected Timeline', 'Jump to the Timeline tab for the selected Loredeck.', () => {
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }));
    view.appendChild(controls);

    const table = document.createElement('div');
    table.className = 'wandlight-context-workbench-context-table';
    const header = document.createElement('div');
    header.className = 'wandlight-context-workbench-context-row wandlight-context-workbench-row-header';
    for (const label of ['Loredeck', 'Current Context', 'Source', 'Index', 'Manual Lock', 'Actions']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);

    const selectedPackId = getContextWorkbenchPackId();
    for (const item of stack) {
        const context = getLoredeckContext(state, item.packId);
        const packIndex = getContextPackSummary(contextIndex, item.packId);
        const row = document.createElement('div');
        row.className = 'wandlight-context-workbench-context-row';
        if (item.packId === selectedPackId) row.classList.add('wandlight-context-workbench-row-active');
        row.addEventListener('click', () => {
            setContextWorkbenchPackId(item.packId);
            renderContextWorkbench();
        });
        row.appendChild(createWorkbenchTextCell(getLoredeckDisplayName(item.packId), `Priority ${item.stackIndex + 1}`));
        row.appendChild(createWorkbenchTextCell(formatContextSummary(context), context.anchorId || context.anchorFrom || context.alias || ''));
        row.appendChild(createWorkbenchTextCell(formatContextSource(context.source), `${Math.round((Number(context.confidence) || 0) * 100)}% confidence`));
        row.appendChild(createWorkbenchTextCell(packIndex?.hasIndex ? `${packIndex.anchorCount || 0} anchors` : 'No timeline', packIndex?.hasIndex ? `${packIndex.windowCount || 0} windows` : 'Load or create registry data'));

        const lockCell = document.createElement('label');
        lockCell.className = 'wandlight-context-workbench-lock';
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = context.manualLock === true;
        check.addEventListener('click', event => event.stopPropagation());
        check.addEventListener('change', () => {
            setLoredeckContextManualLock(item.packId, check.checked);
        });
        lockCell.appendChild(check);
        const lockText = document.createElement('span');
        lockText.textContent = context.manualLock ? 'Locked' : 'Unlocked';
        lockCell.appendChild(lockText);
        row.appendChild(lockCell);

        const actions = document.createElement('div');
        actions.className = 'wandlight-context-workbench-row-actions';
        actions.appendChild(createButton('Timeline', 'Open this Loredeck in the Timeline tab.', () => {
            setContextWorkbenchPackId(item.packId);
            setContextWorkbenchTab('timeline');
            clearContextWorkbenchSelectedKey();
            renderContextWorkbench();
        }));
        actions.appendChild(createButton('Reset', 'Clear this Loredeck Context.', async () => {
            await resetLoredeckContextFromWorkbench(item.packId);
        }, 'wandlight-danger-button'));
        row.appendChild(actions);
        table.appendChild(row);
    }

    const layout = document.createElement('div');
    layout.className = 'wandlight-context-workbench-context-layout';
    layout.appendChild(table);
    layout.appendChild(createContextWorkbenchContextEditor(state, contextIndex));
    view.appendChild(layout);
    return view;
}

function createContextWorkbenchContextEditor(state = {}, contextIndex = null) {
    const pack = getContextWorkbenchPack(state);
    const panel = document.createElement('div');
    panel.className = 'wandlight-context-workbench-inspector wandlight-context-workbench-context-editor';
    if (!pack?.packId) {
        panel.appendChild(createEmptyMessage('Select a loaded Loredeck to edit its Context.'));
        return panel;
    }

    const context = getLoredeckContext(state, pack.packId);
    const packIndex = getContextPackSummary(contextIndex, pack.packId);
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-inspector-title';
    title.textContent = pack.title || getLoredeckDisplayName(pack.packId);
    panel.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(getContextTypeLabel(context.contextType), 'Context mode for this Loredeck.'));
    chips.appendChild(createStatusPill(formatContextSource(context.source), 'How this Context was last set.'));
    chips.appendChild(createStatusPill(context.manualLock ? 'Locked' : 'Unlocked', 'Locked Contexts are protected from automatic resolver overwrites.'));
    chips.appendChild(createStatusPill(`${Math.round((Number(context.confidence) || 0) * 100)}%`, 'Resolver confidence for this Context.'));
    chips.appendChild(createStatusPill(packIndex?.hasIndex ? `${packIndex.anchorCount || 0} anchors / ${packIndex.windowCount || 0} windows` : 'No timeline index', 'Loaded timeline registry coverage for this Loredeck.'));
    panel.appendChild(chips);

    const summary = document.createElement('div');
    summary.className = 'wandlight-loredeck-context-summary';
    summary.textContent = formatContextSummary(context);
    panel.appendChild(summary);

    panel.appendChild(createContextWorkbenchWaypointBrowser(pack, context, contextIndex));
    panel.appendChild(createContextWorkbenchResolverTester(pack, context, contextIndex));
    panel.appendChild(createContextWorkbenchContextPicker(pack, context, contextIndex));

    const grid = document.createElement('div');
    grid.className = 'wandlight-context-workbench-editor-grid';
    appendContextManualFields(grid, pack.packId, context);
    panel.appendChild(grid);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions wandlight-context-workbench-inspector-actions';
    actions.appendChild(createButton('Seed From Context', 'Seed this Context from the current Context fields.', () => {
        seedLoredeckContextFromRuntimeContext(pack.packId, context);
    }));
    actions.appendChild(createButton('Timeline', 'Open this Loredeck in the Timeline tab.', () => {
        setContextWorkbenchTab('timeline');
        clearContextWorkbenchSelectedKey();
        renderContextWorkbench();
    }));
    actions.appendChild(createButton('Reset Context', 'Clear this Loredeck Context.', async () => {
        await resetLoredeckContextFromWorkbench(pack.packId);
    }, 'wandlight-danger-button'));
    panel.appendChild(actions);
    return panel;
}

const CONTEXT_WAYPOINT_FILTER_OPTIONS = Object.freeze([
    ['major', 'Major Points'],
    ['windows', 'Windows'],
    ['anchors', 'Anchors'],
    ['events', 'Events'],
    ['lorecards', 'Lorecards'],
    ['all', 'All'],
]);

function createContextWorkbenchWaypointBrowser(pack, context = {}, contextIndex = null) {
    const wrap = document.createElement('div');
    wrap.className = 'wandlight-context-workbench-waypoint-browser';

    const top = document.createElement('div');
    top.className = 'wandlight-context-workbench-waypoint-top';
    const label = document.createElement('div');
    label.className = 'wandlight-runtime-card-title';
    label.textContent = 'Browse Story Waypoints';
    addTooltip(label, 'Choose major timeline points directly. Use After and Before on two waypoints to build a Context window.');
    top.appendChild(label);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wandlight-lore-workbench-search';
    search.placeholder = 'Search: Christmas 6th Year, Ron Lavender, Hogsmeade...';
    search.value = getContextWorkbenchWaypointQuery();
    addTooltip(search, 'Search first-class timeline waypoints and, when loaded, Lorecard-derived event waypoints.');
    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        setContextWorkbenchWaypointQuery(search.value.trim());
        renderContextWorkbench();
    });
    search.addEventListener('change', () => {
        setContextWorkbenchWaypointQuery(search.value.trim());
        renderContextWorkbench();
    });
    top.appendChild(search);

    const filter = document.createElement('select');
    filter.className = 'wandlight-lore-workbench-select';
    addTooltip(filter, 'Control how much of the Loredeck Context map is shown.');
    const activeFilter = getContextWorkbenchWaypointFilter();
    for (const [value, text] of CONTEXT_WAYPOINT_FILTER_OPTIONS) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (activeFilter === value) option.selected = true;
        filter.appendChild(option);
    }
    filter.addEventListener('change', () => {
        setContextWorkbenchWaypointFilter(filter.value);
        renderContextWorkbench();
    });
    top.appendChild(filter);

    top.appendChild(createButton('Find', 'Search browser waypoints.', () => {
        setContextWorkbenchWaypointQuery(search.value.trim());
        renderContextWorkbench();
    }, 'wandlight-primary-button'));

    const cachedEntries = getLoredeckEntryPreview(pack?.packId);
    const loadEvents = createButton(cachedEntries?.loadedAt ? 'Reload Events' : 'Load Events', 'Load Lorecards so the browser can include event-level Context waypoints.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
        renderContextWorkbench();
    });
    loadEvents.disabled = !canValidateLoredeckInEditor(pack);
    top.appendChild(loadEvents);
    wrap.appendChild(top);

    wrap.appendChild(createContextWorkbenchWindowBuilderSummary(pack, context));

    const allItems = getContextWorkbenchWaypointItems(pack, contextIndex);
    const visible = filterContextWorkbenchWaypointItems(allItems, getContextWorkbenchWaypointQuery(), getContextWorkbenchWaypointFilter());
    const capped = visible.slice(0, 80);
    const meta = document.createElement('div');
    meta.className = 'wandlight-loredeck-row-meta';
    const firstClassCount = allItems.filter(item => item.source === 'timeline').length;
    const eventCount = allItems.filter(item => item.source === 'lorecard').length;
    meta.appendChild(createStatusPill(`${firstClassCount} timeline`, 'First-class anchors/windows from the Loredeck timeline registry.'));
    meta.appendChild(createStatusPill(cachedEntries?.loadedAt ? `${eventCount} event waypoints` : 'Events unloaded', 'Lorecard-derived Context candidates are optional and loaded on demand.'));
    meta.appendChild(createStatusPill(`${visible.length} shown`, 'Waypoints matching the current search and filter.'));
    if (getContextWorkbenchWaypointFilter() === 'major') {
        meta.appendChild(createStatusPill('Major only', 'Major Points shows first-class timeline anchors/windows by default. Search or load Events for denser event selection.'));
    }
    wrap.appendChild(meta);

    const list = document.createElement('div');
    list.className = 'wandlight-context-workbench-waypoint-list';
    if (!allItems.length) {
        list.appendChild(createEmptyMessage('No Context waypoints are loaded for this Loredeck yet.'));
    } else if (!visible.length) {
        const lines = ['No waypoints match the current search/filter.'];
        if (!cachedEntries?.loadedAt) lines.push('Load Events to include Lorecard-derived event waypoints such as parties, lessons, battles, reveals, and relationship turns.');
        list.appendChild(createContextResolverDiagnosticCard('No browser match', lines, 'warning'));
    } else {
        for (const item of capped) {
            list.appendChild(createContextWorkbenchWaypointRow(pack, item, context));
        }
        if (visible.length > capped.length) {
            const note = document.createElement('div');
            note.className = 'wandlight-runtime-help';
            note.textContent = `Showing ${capped.length} of ${visible.length} matching waypoints. Narrow the search for a smaller set.`;
            list.appendChild(note);
        }
    }
    wrap.appendChild(list);
    return wrap;
}

function createContextWorkbenchWindowBuilderSummary(pack, context = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'wandlight-context-workbench-window-builder';
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-window-builder-title';
    title.textContent = 'Current Window';
    addTooltip(title, 'Use After and Before on browser waypoints to define the active Context window for this Loredeck.');
    wrap.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'wandlight-loredeck-row-meta';
    meta.appendChild(createStatusPill(context.anchorFrom ? `After: ${formatContextAnchorBoundaryLabel(context.anchorFrom, context)}` : 'After: unset', 'Lower Context bound.'));
    meta.appendChild(createStatusPill(context.anchorTo ? `Before: ${formatContextAnchorBoundaryLabel(context.anchorTo, context)}` : 'Before: unset', 'Upper Context bound.'));
    meta.appendChild(createStatusPill(context.manualLock ? 'Locked' : 'Unlocked', 'Locked Contexts are protected from automatic updates.'));
    wrap.appendChild(meta);

    const summary = document.createElement('div');
    summary.className = 'wandlight-context-workbench-window-summary';
    summary.textContent = context.anchorFrom || context.anchorTo
        ? formatContextSummary(context)
        : 'Select After on one waypoint and Before on another to create a bounded Context window.';
    wrap.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions';
    const lockButton = createButton(context.manualLock ? 'Unlock' : 'Lock Context', 'Toggle whether automatic Context detection may replace this selected window.', () => {
        commitLoredeckContextPatch(pack.packId, { manualLock: !context.manualLock }, `Toggle Context lock: ${getLoredeckDisplayName(pack.packId)}`, { manual: false });
    });
    actions.appendChild(lockButton);
    const clearBounds = createButton('Clear Bounds', 'Clear only the After/Before bounds for this Loredeck Context.', () => {
        commitLoredeckContextPatch(pack.packId, {
            anchorFrom: '',
            anchorTo: '',
            anchorId: '',
            contextType: 'custom',
            label: '',
            contextSortKey: null,
            contextSortKeyFrom: null,
            contextSortKeyTo: null,
        }, `Clear Context bounds: ${getLoredeckDisplayName(pack.packId)}`);
    });
    clearBounds.disabled = !context.anchorFrom && !context.anchorTo && !context.anchorId;
    actions.appendChild(clearBounds);
    wrap.appendChild(actions);
    return wrap;
}

function formatContextAnchorBoundaryLabel(anchorId = '', context = {}) {
    const id = String(anchorId || '').trim();
    if (!id) return 'unset';
    const label = String(context.label || '').trim();
    if (label && label.toLowerCase().includes(id.toLowerCase())) return label;
    return id;
}

function getContextWorkbenchWaypointItems(pack = null, contextIndex = null) {
    const timelineItems = getContextWorkbenchTimelineItems(pack, contextIndex).map(item => ({
        ...item,
        source: 'timeline',
    }));
    const entryItems = getContextWorkbenchEntryWaypointItems(pack);
    return [...timelineItems, ...entryItems].sort(compareContextWaypointItems);
}

function getContextWorkbenchEntryWaypointItems(pack = {}) {
    return getContextWorkbenchEntryRows(pack)
        .filter(row => row?.id && !row.disabled)
        .map(row => {
            const anchorDefinition = buildContextEntryDerivedAnchor(pack, row, {});
            if (!anchorDefinition) return null;
            const entry = row.entry || {};
            const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
            return {
                kind: 'entry',
                source: 'lorecard',
                id: anchorDefinition.id,
                row,
                entry,
                context: contextGate,
                definition: anchorDefinition,
                registryState: 'Lorecard-derived',
                entryIds: [row.id || entry.id].filter(Boolean),
            };
        })
        .filter(Boolean);
}

function compareContextWaypointItems(a = {}, b = {}) {
    const aSort = normalizeLoredeckTimelineNumber(a.definition?.sortKey ?? a.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
    const bSort = normalizeLoredeckTimelineNumber(b.definition?.sortKey ?? b.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    const sourceOrder = { timeline: 0, lorecard: 1 };
    const sourceCompare = (sourceOrder[a.source] ?? 9) - (sourceOrder[b.source] ?? 9);
    if (sourceCompare) return sourceCompare;
    return String(a.definition?.label || a.id || '').localeCompare(String(b.definition?.label || b.id || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function filterContextWorkbenchWaypointItems(items = [], query = '', filter = 'major') {
    const q = String(query || '').trim();
    const analysis = analyzeContextQuery(q);
    return items.filter(item => {
        if (!contextWaypointMatchesFilter(item, filter, Boolean(q))) return false;
        if (!q) return true;
        const text = getContextWaypointSearchText(item);
        if (normalizeContextSearchText(text).includes(normalizeContextSearchText(q))) return true;
        return analysis.terms.every(term => contextTextIncludesTerm(text, term));
    });
}

function contextWaypointMatchesFilter(item = {}, filter = 'major', hasQuery = false) {
    if (filter === 'all') return true;
    if (filter === 'windows') return item.kind === 'window';
    if (filter === 'anchors') return item.kind === 'anchor';
    if (filter === 'events') return item.kind === 'entry' || contextWaypointLooksEventLike(item);
    if (filter === 'lorecards') return item.source === 'lorecard';
    if (filter === 'major') {
        if (item.source === 'timeline') return true;
        return hasQuery && contextWaypointLooksEventLike(item);
    }
    return true;
}

function contextWaypointLooksEventLike(item = {}) {
    const def = item.definition || {};
    if (item.source === 'lorecard') return true;
    const tags = Array.isArray(def.tags) ? def.tags.join(' ') : '';
    const haystack = normalizeContextSearchText([
        item.kind,
        def.contextType,
        def.label,
        def.arc,
        tags,
    ].filter(Boolean).join(' '));
    return /\bevent\b|\bclimax\b|\bbattle\b|\bdeath\b|\breveal\b|\bincident\b|\btask\b|\bparty\b|\blesson\b/.test(haystack);
}

function getContextWaypointSearchText(item = {}) {
    const def = item.definition || {};
    const entry = item.entry || {};
    const content = entry.content || {};
    return [
        item.kind,
        item.source,
        item.id,
        item.registryState,
        def.label,
        def.anchorFrom,
        def.anchorTo,
        def.book,
        def.work,
        def.schoolYear,
        def.arc,
        def.phase,
        def.season,
        def.episode,
        def.chapter,
        def.issue,
        def.quest,
        def.gameStage,
        def.notes,
        entry.title,
        entry.category,
        entry.lorePurpose,
        content.fact,
        ...(Array.isArray(content.constraints) ? content.constraints : []),
        ...(Array.isArray(def.aliases) ? def.aliases : []),
        ...(Array.isArray(def.tags) ? def.tags : []),
        ...(Array.isArray(item.entryIds) ? item.entryIds : []),
    ].filter(Boolean).join(' ');
}

function createContextWorkbenchWaypointRow(pack, item = {}, context = {}) {
    const def = item.definition || {};
    const row = document.createElement('div');
    row.className = 'wandlight-context-workbench-waypoint-row';
    if (item.source === 'lorecard') row.classList.add('wandlight-context-workbench-waypoint-row-entry');
    if (context.anchorId && normalizeLoredeckTimelineId(context.anchorId) === normalizeLoredeckTimelineId(item.id)) row.classList.add('wandlight-context-workbench-row-active');
    if ((context.anchorFrom && normalizeLoredeckTimelineId(context.anchorFrom) === normalizeLoredeckTimelineId(item.id))
        || (context.anchorTo && normalizeLoredeckTimelineId(context.anchorTo) === normalizeLoredeckTimelineId(item.id))) {
        row.classList.add('wandlight-context-workbench-row-active');
    }

    const main = document.createElement('div');
    main.className = 'wandlight-context-workbench-context-picker-main';
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-context-picker-title';
    title.textContent = def.label || item.entry?.title || item.id || 'Waypoint';
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'wandlight-context-workbench-context-picker-meta';
    meta.textContent = [
        getContextWaypointKindLabel(item),
        item.id,
        getContextTimelineItemContextText(item),
        getContextTimelineItemCoordinateText(item),
        item.source === 'lorecard' ? item.row?.id : '',
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'wandlight-context-workbench-row-actions';
    if (item.kind === 'window') {
        actions.appendChild(createButton('Use Window', 'Apply this whole timeline window as the current Context.', () => {
            applyContextTimelineItem(pack.packId, item);
        }, 'wandlight-primary-button'));
    } else {
        actions.appendChild(createButton('Start Here', 'Apply this waypoint as the exact starting Context.', () => {
            applyContextWaypointItem(pack.packId, item);
        }, 'wandlight-primary-button'));
        actions.appendChild(createButton('After', 'Use this waypoint as the lower bound of the current Context window.', () => {
            applyContextWaypointBoundary(pack.packId, item, 'from');
        }));
        actions.appendChild(createButton('Before', 'Use this waypoint as the upper bound of the current Context window.', () => {
            applyContextWaypointBoundary(pack.packId, item, 'to');
        }));
    }
    actions.appendChild(createButton(item.source === 'lorecard' ? 'Lorecard' : 'Timeline', item.source === 'lorecard' ? 'Find the source Lorecard.' : 'Inspect this waypoint in the Timeline tab.', () => {
        if (item.source === 'lorecard') {
            openLoredeckEditorForQuery(item.row?.packId || pack.packId, item.row?.id || item.entry?.title || '', 'Loredeck editor filtered to the source Lorecard.');
            return;
        }
        setContextWorkbenchSelectedKey(getContextTimelineItemKey(item));
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }));
    row.appendChild(actions);
    return row;
}

function getContextWaypointKindLabel(item = {}) {
    if (item.kind === 'window') return 'Window';
    if (item.source === 'lorecard') return 'Lorecard event';
    return 'Anchor';
}

function applyContextWaypointItem(packId, item = {}) {
    if (item.source === 'lorecard') {
        applyContextEntryCandidate(packId, {
            row: item.row,
            entry: item.entry,
            context: item.context,
            query: getContextWorkbenchWaypointQuery(),
            score: 120,
        });
        return;
    }
    applyContextTimelineItem(packId, item);
}

function applyContextWaypointBoundary(packId, item = {}, mode = 'from') {
    if (item.source !== 'lorecard') {
        applyContextAnchorBoundary(packId, item, mode);
        return;
    }
    const def = item.definition || {};
    const contextGate = item.context || {};
    const id = normalizeLoredeckTimelineId(def.id || item.id);
    if (!id) return;
    const context = getLoredeckContext(getRuntimeState(), packId);
    const label = String(def.label || item.entry?.title || id).trim();
    const sortKeyFrom = normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom ?? def.sortKey);
    const sortKeyTo = normalizeLoredeckTimelineNumber(contextGate.sortKeyTo ?? def.sortKey);
    const boundarySort = mode === 'to' ? (sortKeyFrom ?? sortKeyTo) : (sortKeyTo ?? sortKeyFrom);
    const patch = {
        contextType: 'anchor_window',
        anchorId: '',
        sceneDate: context.sceneDate || '',
        contextSortKey: Number.isFinite(Number(context.contextSortKey)) && mode === 'to'
            ? Number(context.contextSortKey)
            : boundarySort,
        arc: contextGate.arc || context.arc || '',
        phase: contextGate.phase || context.phase || '',
        season: contextGate.season || context.season || '',
        episode: contextGate.episode || context.episode || '',
        chapter: contextGate.chapter || context.chapter || '',
        issue: contextGate.issue || context.issue || '',
        quest: contextGate.quest || context.quest || '',
        gameStage: contextGate.gameStage || context.gameStage || '',
        alias: getContextWorkbenchWaypointQuery() || label,
        source: 'manual',
        notes: `Boundary applied from Lorecard-derived waypoint: ${item.row?.id || item.entry?.id || label}.`,
    };
    if (mode === 'to') {
        patch.anchorFrom = context.anchorFrom || '';
        patch.anchorTo = id;
        patch.contextSortKeyFrom = Number.isFinite(Number(context.contextSortKeyFrom))
            ? Number(context.contextSortKeyFrom)
            : (Number.isFinite(Number(context.contextSortKey)) ? Number(context.contextSortKey) : null);
        patch.contextSortKeyTo = boundarySort;
        patch.label = context.anchorFrom ? `${context.anchorFrom} to ${label}` : `Before ${label}`;
    } else {
        patch.anchorFrom = id;
        patch.anchorTo = context.anchorTo || '';
        patch.contextSortKeyFrom = boundarySort;
        patch.contextSortKeyTo = Number.isFinite(Number(context.contextSortKeyTo)) ? Number(context.contextSortKeyTo) : null;
        patch.label = context.anchorTo ? `${label} to ${context.anchorTo}` : `After ${label}`;
    }
    commitLoredeckContextPatch(packId, patch, `Set Context ${mode === 'to' ? 'upper' : 'lower'} bound: ${getLoredeckDisplayName(packId)}`);
}

function createContextWorkbenchResolverTester(pack, context = {}, contextIndex = null) {
    const wrap = document.createElement('div');
    wrap.className = 'wandlight-context-workbench-resolver';

    const top = document.createElement('div');
    top.className = 'wandlight-context-workbench-resolver-top';
    const label = document.createElement('div');
    label.className = 'wandlight-runtime-card-title';
    label.textContent = 'Phrase Resolver';
    addTooltip(label, 'Test casual context phrasing against this Loredeck timeline registry before applying a match.');
    top.appendChild(label);

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'wandlight-lore-workbench-search';
    input.placeholder = 'Try: after the Yule Ball, pre-Endgame, post Shibuya...';
    input.value = getContextWorkbenchResolverQuery();
    addTooltip(input, 'Local-only resolver test using loaded anchor labels, IDs, aliases, dates, arcs, tags, and coordinates.');
    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        setContextWorkbenchResolverQuery(input.value.trim());
        renderContextWorkbench();
    });
    input.addEventListener('change', () => {
        setContextWorkbenchResolverQuery(input.value.trim());
        renderContextWorkbench();
    });
    top.appendChild(input);

    top.appendChild(createButton('Test Phrase', 'Run the local phrase resolver for this Loredeck.', () => {
        setContextWorkbenchResolverQuery(input.value.trim());
        renderContextWorkbench();
    }, 'wandlight-primary-button'));
    top.appendChild(createButton('Use Context', 'Use the current Context and runtime context text as the test phrase.', () => {
        const seed = getContextResolverSeedText(context);
        if (!seed) {
            toast('No Context text is available to test.', 'warning');
            return;
        }
        setContextWorkbenchResolverQuery(seed);
        renderContextWorkbench();
    }));
    top.appendChild(createButton('Clear', 'Clear the phrase resolver test.', () => {
        setContextWorkbenchResolverQuery('');
        renderContextWorkbench();
    }));
    const cachedEntries = getLoredeckEntryPreview(pack?.packId);
    const loadEntriesButton = createButton(cachedEntries?.loadedAt ? 'Reload Lorecards' : 'Load Lorecards', 'Load this Loredeck\'s Lorecards so the resolver can include Lorecard-derived Context candidates.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
        renderContextWorkbench();
    });
    loadEntriesButton.disabled = !canValidateLoredeckInEditor(pack);
    top.appendChild(loadEntriesButton);
    wrap.appendChild(top);

    const meta = document.createElement('div');
    meta.className = 'wandlight-loredeck-row-meta';
    const packIndex = getContextPackSummary(contextIndex, pack?.packId);
    meta.appendChild(createStatusPill('Local match', 'This test does not call a model.'));
    meta.appendChild(createStatusPill(packIndex?.hasIndex ? `${packIndex.anchorCount || 0} anchors` : 'No index', 'Anchor count available to the local resolver.'));
    if (cachedEntries?.loadedAt) {
        meta.appendChild(createStatusPill(`${cachedEntries.entries?.length || 0} Lorecards loaded`, 'Loaded Lorecards are included as Lorecard-derived Context candidates.'));
    } else {
        meta.appendChild(createStatusPill('Lorecards not loaded', 'Click Load Lorecards to include event-level Context candidates in resolver testing.'));
    }
    const resolverQuery = getContextWorkbenchResolverQuery();
    if (resolverQuery) {
        meta.appendChild(createStatusPill(`Query: ${truncateText(resolverQuery, 42)}`, 'Current resolver test phrase.'));
    }
    wrap.appendChild(meta);

    const list = document.createElement('div');
    list.className = 'wandlight-context-workbench-resolver-results';
    const query = String(resolverQuery || '').trim();
    const analysis = analyzeContextQuery(query);
    if (query) {
        if (analysis.terms?.length) {
            meta.appendChild(createStatusPill(`Terms: ${analysis.terms.join(', ')}`, 'Search terms used by the local resolver after cleanup.'));
        }
        if (analysis.ignoredTerms?.length) {
            meta.appendChild(createStatusPill(`Ignored: ${analysis.ignoredTerms.join(', ')}`, 'Direction/filler words ignored so they do not cause false matches.'));
        }
    }
    if (!contextIndex) {
        list.appendChild(createEmptyMessage('Context index is loading. Refresh the index and try again.'));
    } else if (!packIndex?.hasIndex) {
        list.appendChild(createEmptyMessage('This Loredeck has no loaded timeline registry for phrase matching.'));
    } else if (!query) {
        list.appendChild(createEmptyMessage('Enter a loose story phrase to preview matching anchors.'));
    } else if (!analysis.terms?.length) {
        list.appendChild(createContextResolverDiagnosticCard(
            'No searchable terms',
            [
                'The phrase only contains direction or filler words after cleanup.',
                'Add a story event, arc, date, book, chapter, episode, quest, or alias.',
            ],
            'warning'
        ));
    } else {
        const matches = rankContextAnchors(query, { packId: pack.packId, limit: 8, index: contextIndex });
        const entryMatches = getContextEntryResolverMatches(pack, analysis, { limit: 6 });
        if (!matches.length && !entryMatches.length) {
            list.appendChild(createContextResolverDiagnosticCard(
                'No local anchor match',
                getContextResolverMissReasons(pack, analysis, packIndex),
                'warning'
            ));
        } else {
            if (Number(matches[0]?.score) < 32) {
                list.appendChild(createContextResolverDiagnosticCard(
                    'Weak match set',
                    [
                        'The best result only matched low-weight coordinate text.',
                        'Review the reasons before applying, or add a stronger alias/anchor if this phrase should be supported.',
                    ],
                    'suggestion'
                ));
            }
            const currentAnchorId = normalizeLoredeckTimelineId(context.anchorId);
            for (const match of matches) {
                list.appendChild(createContextWorkbenchResolverResult(pack, match, currentAnchorId));
            }
        }
        if (entryMatches.length) {
            list.appendChild(createContextResolverDiagnosticCard(
                'Lorecard-derived candidates',
                [
                    'These candidates come from loaded Lorecard Context gates, not from first-class timeline anchors.',
                    pack.type === 'bundled'
                        ? 'Apply one for this chat, or duplicate the bundled deck as Custom before promoting it into the timeline registry.'
                        : 'Apply one for this chat, or queue it as a real timeline anchor for Pending Review.',
                ],
                'suggestion'
            ));
            for (const match of entryMatches) {
                list.appendChild(createContextWorkbenchEntryResolverResult(pack, match));
            }
        } else if (!cachedEntries?.loadedAt) {
            list.appendChild(createContextResolverDiagnosticCard(
                'Lorecards not included',
                ['Click Load Lorecards to also search entry-level Context gates for event-like phrases.'],
                'suggestion'
            ));
        }
    }
    wrap.appendChild(list);

    return wrap;
}

function createContextResolverDiagnosticCard(titleText = 'Resolver note', lines = [], severity = 'suggestion') {
    const card = document.createElement('div');
    card.className = `wandlight-context-workbench-resolver-diagnostic wandlight-context-workbench-issue-${severity || 'suggestion'}`;
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-context-picker-title';
    title.textContent = titleText;
    card.appendChild(title);
    for (const line of lines.filter(Boolean).slice(0, 5)) {
        const item = document.createElement('div');
        item.className = 'wandlight-context-workbench-resolver-diagnostic-line';
        item.textContent = line;
        card.appendChild(item);
    }
    return card;
}

function getContextResolverSeedText(context = {}, state = getRuntimeState()) {
    const runtimeContext = state?.loreContext || {};
    return uniqueStrings([
        context.alias,
        context.label,
        context.sceneDate,
        context.arc,
        context.phase,
        context.season ? `season ${context.season}` : '',
        context.episode ? `episode ${context.episode}` : '',
        context.chapter ? `chapter ${context.chapter}` : '',
        context.issue ? `issue ${context.issue}` : '',
        context.quest,
        context.gameStage,
        runtimeContext.canonBoundary,
        runtimeContext.sceneDate,
        runtimeContext.subjectiveDate,
    ]).join(' ');
}

function createContextWorkbenchResolverResult(pack, match = {}, currentAnchorId = '') {
    const anchor = match.anchor || {};
    const id = normalizeLoredeckTimelineId(anchor.id);
    const row = document.createElement('div');
    row.className = 'wandlight-context-workbench-resolver-row';
    if (id && id === currentAnchorId) row.classList.add('wandlight-context-workbench-row-active');

    const main = document.createElement('div');
    main.className = 'wandlight-context-workbench-context-picker-main';
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-context-picker-title';
    title.textContent = anchor.label || id || 'Anchor';
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'wandlight-context-workbench-context-picker-meta';
    meta.textContent = [
        id,
        getContextResolverConfidenceLabel(match.score),
        formatAnchorDateRange(anchor),
        anchor.book || anchor.work,
        anchor.arc,
        anchor.phase,
        anchor.aliases?.slice(0, 2).join(', '),
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);
    const reason = document.createElement('div');
    reason.className = 'wandlight-context-workbench-resolver-reason';
    reason.textContent = formatContextResolverReasonText(match);
    main.appendChild(reason);
    row.appendChild(main);

    const score = document.createElement('div');
    score.className = 'wandlight-context-workbench-resolver-score';
    score.textContent = String(Math.round(Number(match.score) || 0));
    addTooltip(score, 'Local resolver match score. Higher is better; this is not model confidence.');
    row.appendChild(score);

    const actions = document.createElement('div');
    actions.className = 'wandlight-context-workbench-row-actions';
    actions.appendChild(createButton('Apply', 'Apply this anchor as the exact Context.', () => {
        applyContextAnchor(pack.packId, anchor);
    }, 'wandlight-primary-button'));
    actions.appendChild(createButton('After', 'Use this anchor as the lower bound of the current Context window.', () => {
        applyContextAnchorBoundary(pack.packId, { kind: 'anchor', id, definition: anchor }, 'from');
    }));
    actions.appendChild(createButton('Before', 'Use this anchor as the upper bound of the current Context window.', () => {
        applyContextAnchorBoundary(pack.packId, { kind: 'anchor', id, definition: anchor }, 'to');
    }));
    actions.appendChild(createButton('Timeline', 'Inspect this anchor in the Timeline tab.', () => {
        setContextWorkbenchSelectedKey(`anchor:${id}`);
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }));
    row.appendChild(actions);
    return row;
}

function createContextWorkbenchEntryResolverResult(pack, match = {}) {
    const entry = match.entry || {};
    const row = document.createElement('div');
    row.className = 'wandlight-context-workbench-resolver-row wandlight-context-workbench-resolver-row-entry';

    const main = document.createElement('div');
    main.className = 'wandlight-context-workbench-context-picker-main';
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-context-picker-title';
    title.textContent = entry.title || match.row?.id || 'Lorecard candidate';
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'wandlight-context-workbench-context-picker-meta';
    meta.textContent = [
        'Lorecard-derived',
        match.row?.id,
        getContextResolverConfidenceLabel(match.score),
        getContextEntryCandidateText(match),
        entry.category,
        entry.lorePurpose,
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);

    const reason = document.createElement('div');
    reason.className = 'wandlight-context-workbench-resolver-reason';
    reason.textContent = formatContextResolverReasonText(match);
    main.appendChild(reason);
    row.appendChild(main);

    const score = document.createElement('div');
    score.className = 'wandlight-context-workbench-resolver-score';
    score.textContent = String(Math.round(Number(match.score) || 0));
    addTooltip(score, 'Entry-derived resolver match score. Higher is better; this is not model confidence.');
    row.appendChild(score);

    const actions = document.createElement('div');
    actions.className = 'wandlight-context-workbench-row-actions';
    actions.appendChild(createButton('Apply', 'Apply this Lorecard-derived Context to the current chat.', () => {
        applyContextEntryCandidate(pack.packId, match);
    }, 'wandlight-primary-button'));
    if (pack.type === 'bundled') {
        actions.appendChild(createButton('Duplicate as Custom', 'Create an editable Custom Loredeck before promoting Lorecard-derived anchors.', () => {
            openDuplicateLoredeckDialog(pack);
        }));
    } else {
        actions.appendChild(createButton('Queue Anchor', 'Queue this Lorecard-derived candidate as a real timeline anchor for Pending Review.', () => {
            queueContextEntryCandidateTimelineAnchor(pack, match);
        }));
    }
    actions.appendChild(createButton('Find Lorecard', 'Open the Loredeck editor filtered to this Lorecard.', () => {
        openLoredeckEditorForQuery(pack.packId, match.row?.id || entry.title || '', 'Loredeck editor filtered to the resolver candidate Lorecard.');
    }));
    row.appendChild(actions);
    return row;
}

function getContextEntryCandidateText(match = {}) {
    const contextGate = match.context || {};
    const bounds = [
        normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom),
        normalizeLoredeckTimelineNumber(contextGate.sortKeyTo),
    ].filter(value => value !== null && value !== undefined).join(' -> ');
    return [
        contextGate.scope,
        bounds,
        contextGate.validFromAnchor || contextGate.anchorFrom,
        contextGate.validToAnchor || contextGate.anchorTo,
        contextGate.label,
    ].filter(Boolean).join(' | ');
}

function formatContextResolverReasonText(match = {}) {
    const pieces = [];
    const reasons = Array.isArray(match.reasons) ? match.reasons : [];
    if (reasons.length) {
        pieces.push(`Why: ${reasons.slice(0, 3).map(reason => reason.label).join('; ')}`);
    }
    if (Array.isArray(match.matchedTerms) && match.matchedTerms.length) {
        pieces.push(`Matched: ${match.matchedTerms.join(', ')}`);
    }
    if (Array.isArray(match.missingTerms) && match.missingTerms.length) {
        pieces.push(`Missing: ${match.missingTerms.join(', ')}`);
    }
    if (Array.isArray(match.ignoredTerms) && match.ignoredTerms.length) {
        pieces.push(`Ignored: ${match.ignoredTerms.join(', ')}`);
    }
    return pieces.join(' | ') || 'Matched by local timeline registry text.';
}

function getContextResolverConfidenceLabel(score = 0) {
    const value = Number(score) || 0;
    if (value >= 120) return 'Exact';
    if (value >= 70) return 'Strong';
    if (value >= 32) return 'Likely';
    return 'Possible';
}

function formatAnchorDateRange(anchor = {}) {
    const from = String(anchor.dateRange?.from || '').trim();
    const to = String(anchor.dateRange?.to || '').trim();
    if (from && to && from !== to) return `${from} to ${to}`;
    return from || to || '';
}

function uniqueStrings(values = []) {
    const output = [];
    const seen = new Set();
    for (const value of values) {
        const text = String(value || '').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        output.push(text);
    }
    return output;
}

function createContextWorkbenchContextPicker(pack, context = {}, contextIndex = null) {
    const wrap = document.createElement('div');
    wrap.className = 'wandlight-context-workbench-context-picker';

    const top = document.createElement('div');
    top.className = 'wandlight-context-workbench-context-picker-top';
    const label = document.createElement('div');
    label.className = 'wandlight-runtime-card-title';
    label.textContent = 'Select From Timeline';
    addTooltip(label, 'Search known anchors/windows and apply them to the selected Loredeck Context.');
    top.appendChild(label);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wandlight-lore-workbench-search';
    search.placeholder = 'Search anchors, windows, aliases...';
    search.value = getContextWorkbenchContextQuery();
    addTooltip(search, 'Search timeline labels, IDs, aliases, tags, arcs, dates, episodes, chapters, and attached Lorecard IDs.');
    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        setContextWorkbenchContextQuery(search.value.trim());
        renderContextWorkbench();
    });
    search.addEventListener('change', () => {
        setContextWorkbenchContextQuery(search.value.trim());
        renderContextWorkbench();
    });
    top.appendChild(search);
    top.appendChild(createButton('Find', 'Search timeline anchors/windows for this Loredeck.', () => {
        setContextWorkbenchContextQuery(search.value.trim());
        renderContextWorkbench();
    }));
    wrap.appendChild(top);

    const items = getContextWorkbenchTimelineItems(pack, contextIndex);
    const current = getContextWorkbenchCurrentTimelineItem(context, items);
    const currentKey = current ? getContextTimelineItemKey(current) : '';
    const q = String(getContextWorkbenchContextQuery() || '').trim();
    const filtered = q
        ? filterContextWorkbenchTimelineItems(items, q, 'all')
        : items.slice(0, 12);
    const visible = [];
    const seen = new Set();
    if (current) {
        visible.push(current);
        seen.add(currentKey);
    }
    for (const item of filtered) {
        const key = getContextTimelineItemKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        visible.push(item);
        if (visible.length >= 12) break;
    }

    const list = document.createElement('div');
    list.className = 'wandlight-context-workbench-context-picker-list';
    if (!items.length) {
        list.appendChild(createEmptyMessage('No timeline registry rows are loaded for this Loredeck yet.'));
    } else if (!visible.length) {
        list.appendChild(createEmptyMessage('No timeline rows match that search.'));
    } else {
        for (const item of visible) {
            list.appendChild(createContextWorkbenchContextPickerRow(pack, item, currentKey));
        }
    }
    wrap.appendChild(list);

    if (!q && items.length > visible.length) {
        const note = document.createElement('div');
        note.className = 'wandlight-runtime-help';
        note.textContent = `Showing ${visible.length} of ${items.length} timeline rows. Search to narrow the registry.`;
        wrap.appendChild(note);
    }
    return wrap;
}

function getContextWorkbenchCurrentTimelineItem(context = {}, items = []) {
    const anchorId = normalizeLoredeckTimelineId(context.anchorId);
    if (anchorId) {
        const anchor = items.find(item => item.kind === 'anchor' && item.id === anchorId);
        if (anchor) return anchor;
    }
    const anchorFrom = normalizeLoredeckTimelineId(context.anchorFrom);
    const anchorTo = normalizeLoredeckTimelineId(context.anchorTo);
    if (anchorFrom || anchorTo) {
        const exactWindow = items.find(item => item.kind === 'window'
            && (!anchorFrom || item.definition?.anchorFrom === anchorFrom)
            && (!anchorTo || item.definition?.anchorTo === anchorTo));
        if (exactWindow) return exactWindow;
        return items.find(item => item.kind === 'anchor' && (item.id === anchorFrom || item.id === anchorTo)) || null;
    }
    return null;
}

function createContextWorkbenchContextPickerRow(pack, item = {}, currentKey = '') {
    const def = item.definition || {};
    const key = getContextTimelineItemKey(item);
    const row = document.createElement('div');
    row.className = 'wandlight-context-workbench-context-picker-row';
    if (key === currentKey) row.classList.add('wandlight-context-workbench-row-active');
    if (item.disabled) row.classList.add('wandlight-context-workbench-row-disabled');

    const main = document.createElement('div');
    main.className = 'wandlight-context-workbench-context-picker-main';
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-context-picker-title';
    title.textContent = def.label || item.id || 'Timeline row';
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'wandlight-context-workbench-context-picker-meta';
    meta.textContent = [
        item.kind === 'window' ? 'Window' : 'Anchor',
        item.id,
        getContextTimelineItemContextText(item),
        getContextTimelineItemCoordinateText(item),
        def.aliases?.slice(0, 2).join(', '),
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'wandlight-context-workbench-row-actions';
    if (item.kind === 'window') {
        actions.appendChild(createButton('Use Window', 'Apply this timeline window as the selected Context.', () => {
            applyContextTimelineItem(pack.packId, item);
        }, 'wandlight-primary-button'));
    } else {
        actions.appendChild(createButton('Use Anchor', 'Apply this anchor as the exact Context.', () => {
            applyContextTimelineItem(pack.packId, item);
        }, 'wandlight-primary-button'));
        actions.appendChild(createButton('After', 'Use this anchor as the lower bound of the current Context window.', () => {
            applyContextAnchorBoundary(pack.packId, item, 'from');
        }));
        actions.appendChild(createButton('Before', 'Use this anchor as the upper bound of the current Context window.', () => {
            applyContextAnchorBoundary(pack.packId, item, 'to');
        }));
    }
    row.appendChild(actions);
    return row;
}

export function createContextWorkbenchAliasesView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'wandlight-context-workbench-view';
    const pack = getContextWorkbenchPack(state);
    if (!pack) {
        view.appendChild(createEmptyMessage('No loaded Loredeck selected.'));
        return view;
    }
    const allItems = getContextWorkbenchTimelineItems(pack, contextIndex);
    const filteredItems = filterContextWorkbenchTimelineItems(allItems);
    const aliasRows = getContextWorkbenchAliasRows(filteredItems);

    const controls = document.createElement('div');
    controls.className = 'wandlight-context-workbench-controls';
    controls.appendChild(createContextWorkbenchPackSelector(state, contextIndex));
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wandlight-lore-workbench-search';
    search.placeholder = 'Search aliases and targets...';
    search.value = getContextWorkbenchQuery();
    addTooltip(search, 'Search resolver aliases, target labels, IDs, tags, and coordinates.');
    search.addEventListener('input', () => {
        setContextWorkbenchQuery(search.value);
        renderContextWorkbench();
    });
    controls.appendChild(search);
    const count = document.createElement('div');
    count.className = 'wandlight-lore-workbench-count';
    count.textContent = `${aliasRows.length} aliases`;
    controls.appendChild(count);
    controls.appendChild(createButton('Timeline', 'Return to the timeline spreadsheet.', () => {
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }));
    view.appendChild(controls);

    const table = document.createElement('div');
    table.className = 'wandlight-context-workbench-alias-table';
    const header = document.createElement('div');
    header.className = 'wandlight-context-workbench-alias-row wandlight-context-workbench-row-header';
    for (const label of ['Alias', 'Target', 'Kind', 'Context', 'State', 'Warning', 'Actions']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);
    if (!aliasRows.length) {
        table.appendChild(createEmptyMessage('No aliases match the current filters. Add aliases to timeline anchors/windows to improve casual resolver matching.'));
    } else {
        for (const aliasRow of aliasRows.slice(0, 500)) {
            table.appendChild(createContextWorkbenchAliasRow(pack, aliasRow));
        }
    }
    view.appendChild(table);
    return view;
}

export function getContextWorkbenchAliasRows(items = []) {
    const rows = [];
    const counts = new Map();
    for (const item of Array.isArray(items) ? items : []) {
        const aliases = Array.isArray(item.definition?.aliases) ? item.definition.aliases : [];
        for (const alias of aliases) {
            const text = String(alias || '').trim();
            if (!text) continue;
            const key = text.toLowerCase();
            counts.set(key, (counts.get(key) || 0) + 1);
            rows.push({ alias: text, aliasKey: key, item });
        }
    }
    return rows
        .map(row => ({ ...row, duplicate: (counts.get(row.aliasKey) || 0) > 1 }))
        .sort((a, b) => a.alias.localeCompare(b.alias, undefined, { numeric: true, sensitivity: 'base' }));
}

function createContextWorkbenchAliasRow(pack, aliasRow = {}) {
    const item = aliasRow.item || {};
    const def = item.definition || {};
    const row = document.createElement('div');
    row.className = 'wandlight-context-workbench-alias-row';
    if (aliasRow.duplicate) row.classList.add('wandlight-context-workbench-row-warning');
    row.appendChild(createWorkbenchTextCell(aliasRow.alias, aliasRow.duplicate ? 'duplicate alias' : 'resolver phrase'));
    row.appendChild(createWorkbenchTextCell(def.label || item.id, item.id));
    row.appendChild(createWorkbenchTextCell(item.kind === 'window' ? 'Window' : 'Anchor', item.registryState || 'source'));
    row.appendChild(createWorkbenchTextCell(getContextTimelineItemContextText(item), getContextTimelineItemCoordinateText(item)));
    row.appendChild(createWorkbenchTextCell(item.disabled ? 'Disabled' : 'Active', item.registryState || ''));
    row.appendChild(createWorkbenchTextCell(aliasRow.duplicate ? 'Duplicate' : 'OK', aliasRow.duplicate ? 'Same alias maps to multiple targets.' : ''));
    const actions = document.createElement('div');
    actions.className = 'wandlight-context-workbench-row-actions';
    actions.appendChild(createButton('Select', 'Select this timeline target in the Timeline tab.', () => {
        setContextWorkbenchSelectedKey(getContextTimelineItemKey(item));
        setContextWorkbenchTab('timeline');
        renderContextWorkbench();
    }));
    actions.appendChild(createButton('Apply', 'Use this alias target as the selected Loredeck Context.', () => {
        applyContextTimelineItem(pack.packId, item);
    }, 'wandlight-primary-button'));
    row.appendChild(actions);
    return row;
}

export function createContextWorkbenchValidationView(state = {}, contextIndex = null) {
    const view = document.createElement('div');
    view.className = 'wandlight-context-workbench-view';
    const pack = getContextWorkbenchPack(state);
    if (!pack) {
        view.appendChild(createEmptyMessage('No loaded Loredeck selected.'));
        return view;
    }
    const items = getContextWorkbenchTimelineItems(pack, contextIndex);
    const issues = getContextWorkbenchValidationIssues(pack, items, contextIndex);

    const controls = document.createElement('div');
    controls.className = 'wandlight-context-workbench-controls';
    controls.appendChild(createContextWorkbenchPackSelector(state, contextIndex));
    const counts = {
        error: issues.filter(issue => issue.severity === 'error').length,
        warning: issues.filter(issue => issue.severity === 'warning').length,
        suggestion: issues.filter(issue => issue.severity === 'suggestion').length,
    };
    controls.appendChild(createStatusPill(`${counts.error} errors`, 'Structural timeline issues that can break resolution.'));
    controls.appendChild(createStatusPill(`${counts.warning} warnings`, 'Timeline issues that should be reviewed.'));
    controls.appendChild(createStatusPill(`${counts.suggestion} suggestions`, 'Optional improvements for resolver coverage.'));
    controls.appendChild(createButton('Validate Deck', 'Run Deck Health validation and refresh timeline diagnostics.', async (btn) => {
        await validateLoredeckForEditor(pack, btn);
        await loadContextIndex({ force: true }).catch(() => null);
        renderContextWorkbench();
    }, 'wandlight-primary-button'));
    view.appendChild(controls);

    const main = document.createElement('div');
    main.className = 'wandlight-context-workbench-validation-layout';
    const table = document.createElement('div');
    table.className = 'wandlight-context-workbench-validation-table';
    const header = document.createElement('div');
    header.className = 'wandlight-context-workbench-validation-row wandlight-context-workbench-row-header';
    for (const label of ['Severity', 'Issue', 'Target', 'Suggested Action']) {
        const cell = document.createElement('div');
        cell.textContent = label;
        header.appendChild(cell);
    }
    table.appendChild(header);
    if (!issues.length) {
        table.appendChild(createEmptyMessage('No Context validation issues found for the selected Loredeck.'));
    } else {
        for (const issue of issues.slice(0, 500)) {
            table.appendChild(createContextWorkbenchValidationRow(issue));
        }
    }
    main.appendChild(table);
    main.appendChild(createContextWorkbenchValidationSummary(pack, items, issues));
    view.appendChild(main);
    return view;
}

export function getContextWorkbenchValidationIssues(pack, items = [], contextIndex = null) {
    items = Array.isArray(items) ? items : [];
    const issues = [];
    const itemByKey = new Map(items.map(item => [getContextTimelineItemKey(item), item]));
    const anchorIds = new Set(items
        .filter(item => item.kind === 'anchor' && !item.disabled && item.registryState !== 'undefined')
        .map(item => item.id));
    const aliasTargets = new Map();
    for (const item of items) {
        const key = getContextTimelineItemKey(item);
        const def = item.definition || {};
        if (item.registryState === 'undefined') {
            issues.push({
                severity: 'warning',
                code: 'undefined_anchor',
                itemKey: key,
                target: item.id,
                message: `Lorecards reference ${item.id}, but the timeline registry does not define it.`,
                action: 'Create or map this anchor in the Custom timeline registry.',
            });
        }
        if (!String(def.label || '').trim()) {
            issues.push({
                severity: 'warning',
                code: 'missing_label',
                itemKey: key,
                target: item.id,
                message: `${item.id} is missing a readable label.`,
                action: 'Add a label before sharing the Loredeck.',
            });
        }
        if (!(def.aliases || []).length) {
            issues.push({
                severity: 'suggestion',
                code: 'missing_aliases',
                itemKey: key,
                target: item.id,
                message: `${def.label || item.id} has no resolver aliases.`,
                action: 'Add casual phrasing users might type.',
            });
        }
        for (const alias of def.aliases || []) {
            const aliasKey = String(alias || '').trim().toLowerCase();
            if (!aliasKey) continue;
            if (!aliasTargets.has(aliasKey)) aliasTargets.set(aliasKey, []);
            aliasTargets.get(aliasKey).push(key);
        }
        if (item.kind === 'window') {
            const sortFrom = normalizeLoredeckTimelineNumber(def.sortKeyFrom);
            const sortTo = normalizeLoredeckTimelineNumber(def.sortKeyTo);
            if (sortFrom !== null && sortTo !== null && sortFrom > sortTo) {
                issues.push({
                    severity: 'error',
                    code: 'invalid_window_sort',
                    itemKey: key,
                    target: item.id,
                    message: `${def.label || item.id} has sort bounds in reverse order.`,
                    action: 'Set Sort From lower than or equal to Sort To.',
                });
            }
            if (def.anchorFrom && !anchorIds.has(def.anchorFrom)) {
                issues.push({
                    severity: 'error',
                    code: 'dangling_start_anchor',
                    itemKey: key,
                    target: item.id,
                    message: `${def.label || item.id} starts at missing anchor ${def.anchorFrom}.`,
                    action: 'Create the anchor or update the window start.',
                });
            }
            if (def.anchorTo && !anchorIds.has(def.anchorTo)) {
                issues.push({
                    severity: 'error',
                    code: 'dangling_end_anchor',
                    itemKey: key,
                    target: item.id,
                    message: `${def.label || item.id} ends at missing anchor ${def.anchorTo}.`,
                    action: 'Create the anchor or update the window end.',
                });
            }
        }
    }
    for (const [alias, targets] of aliasTargets.entries()) {
        const uniqueTargets = [...new Set(targets)];
        if (uniqueTargets.length <= 1) continue;
        for (const itemKey of uniqueTargets) {
            const item = itemByKey.get(itemKey);
            issues.push({
                severity: 'warning',
                code: 'duplicate_alias',
                itemKey,
                target: item?.id || itemKey,
                message: `Alias "${alias}" maps to ${uniqueTargets.length} timeline definitions.`,
                action: 'Rename or narrow duplicate aliases so local matching is predictable.',
            });
        }
    }
    for (const issue of contextIndex?.issues || []) {
        if (issue?.packId && issue.packId !== pack?.packId) continue;
        issues.push({
            severity: issue?.severity || 'warning',
            code: issue?.code || 'index_issue',
            itemKey: '',
            target: issue?.timelineRef || pack?.packId || '',
            message: issue?.message || 'Context index reported an issue.',
            action: 'Inspect timeline registry source and reload the index.',
        });
    }
    return issues.sort((a, b) => {
        const order = { error: 0, warning: 1, suggestion: 2 };
        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3)
            || String(a.target || '').localeCompare(String(b.target || ''));
    });
}

function createContextWorkbenchValidationRow(issue = {}) {
    const row = document.createElement('div');
    row.className = `wandlight-context-workbench-validation-row wandlight-context-workbench-issue-${issue.severity || 'suggestion'}`;
    row.addEventListener('click', () => {
        if (issue.itemKey) {
            setContextWorkbenchSelectedKey(issue.itemKey);
            setContextWorkbenchTab('timeline');
            renderContextWorkbench();
        }
    });
    row.appendChild(createWorkbenchTextCell(humanizeScopeKey(issue.severity || 'suggestion'), issue.code || ''));
    row.appendChild(createWorkbenchTextCell(issue.message || 'Timeline issue', ''));
    row.appendChild(createWorkbenchTextCell(issue.target || 'registry', issue.itemKey || ''));
    row.appendChild(createWorkbenchTextCell(issue.action || 'Review timeline data.', issue.itemKey ? 'Click to inspect target.' : ''));
    return row;
}

function createContextWorkbenchValidationSummary(pack, items = [], issues = []) {
    const panel = document.createElement('div');
    panel.className = 'wandlight-context-workbench-inspector';
    const title = document.createElement('div');
    title.className = 'wandlight-context-workbench-inspector-title';
    title.textContent = 'Timeline Summary';
    panel.appendChild(title);
    const anchors = items.filter(item => item.kind === 'anchor');
    const windows = items.filter(item => item.kind === 'window');
    const aliases = items.reduce((sum, item) => sum + (item.definition?.aliases?.length || 0), 0);
    const attached = items.filter(item => item.entryIds?.length).length;
    const grid = document.createElement('div');
    grid.className = 'wandlight-context-workbench-inspector-grid';
    grid.appendChild(createKeyValue('Deck', pack.title || pack.packId, 'Selected Loredeck.'));
    grid.appendChild(createKeyValue('Anchors', String(anchors.length), 'Timeline anchors visible to the workbench.'));
    grid.appendChild(createKeyValue('Windows', String(windows.length), 'Timeline windows visible to the workbench.'));
    grid.appendChild(createKeyValue('Aliases', String(aliases), 'Explicit resolver aliases across anchors/windows.'));
    grid.appendChild(createKeyValue('Attached', String(attached), 'Timeline rows referenced by loaded Lorecards.'));
    grid.appendChild(createKeyValue('Issues', String(issues.length), 'Current Context validation findings.'));
    panel.appendChild(grid);
    const help = document.createElement('div');
    help.className = 'wandlight-runtime-help';
    help.textContent = 'This validation is focused on Context structure. Deck Health remains the broader import/export and schema health report.';
    panel.appendChild(help);
    return panel;
}

function createWorkbenchTextCell(primary, secondary = '') {
    const cell = document.createElement('div');
    cell.className = 'wandlight-lore-workbench-cell';
    const main = document.createElement('span');
    main.className = 'wandlight-lore-workbench-cell-main';
    main.textContent = primary || '-';
    cell.appendChild(main);
    if (secondary) {
        const sub = document.createElement('span');
        sub.className = 'wandlight-lore-workbench-cell-sub';
        sub.textContent = truncateText(secondary, 150);
        cell.appendChild(sub);
    }
    return cell;
}

function truncateText(value, limit = 120) {
    const text = String(value || '');
    return text.length > limit ? `${text.slice(0, Math.max(0, limit - 1))}...` : text;
}
