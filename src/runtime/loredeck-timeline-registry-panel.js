/**
 * loredeck-timeline-registry-panel.js - Saga
 * Runtime Loredeck timeline registry card and row rendering.
 */

import {
    addTooltip,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
} from '../ui/runtime-ui-kit.js';
import {
    createLoredeckActionRow,
} from '../loredecks/loredeck-action-rows.js';
import {
    truncateText,
} from './runtime-formatters.js';

let timelineRegistryDeps = {};

export function configureLoredeckTimelineRegistryPanel(deps = {}) {
    timelineRegistryDeps = { ...timelineRegistryDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof timelineRegistryDeps[name] === 'function' ? timelineRegistryDeps[name] : fallback;
}

function getLoredeckTimelineRegistryCacheRecord(packId = '') { return dep('getLoredeckTimelineRegistryCacheRecord', () => null)(packId); }
function getLoredeckEmbeddedTimelineRegistry(pack = {}) { return dep('getLoredeckEmbeddedTimelineRegistry', () => ({}))(pack); }
function buildLoredeckTimelineRegistryItems(pack = {}, rows = []) { return dep('buildLoredeckTimelineRegistryItems', () => [])(pack, rows); }
function buildMergedLoredeckTimelineRegistryForExport(pack = {}) { return dep('buildMergedLoredeckTimelineRegistryForExport', () => ({}))(pack); }
function getLoredeckTimelineRegistryCount(registry = {}) { return dep('getLoredeckTimelineRegistryCount', () => 0)(registry); }
function getLoredeckTimelineRegistryQuery() { return dep('getLoredeckTimelineRegistryQuery', () => '')(); }
function setLoredeckTimelineRegistryQuery(value = '') { return dep('setLoredeckTimelineRegistryQuery')((value || '').trim()); }
function setLoredeckEntryOverrideQuery(value = '') { return dep('setLoredeckEntryOverrideQuery')((value || '').trim()); }
function refreshPanelBody(options = {}) { return dep('refreshPanelBody')(options); }
function loadLoredeckTimelineRegistryForEditor(pack, button = null) { return dep('loadLoredeckTimelineRegistryForEditor', async () => {})(pack, button); }
function openLoredeckTimelineAnchorDialog(pack, item = null) { return dep('openLoredeckTimelineAnchorDialog')(pack, item); }
function openLoredeckTimelineWindowDialog(pack, item = null) { return dep('openLoredeckTimelineWindowDialog')(pack, item); }
function setLoredeckTimelineItemDisabled(pack, kind = 'anchor', id = '', disabled = true) { return dep('setLoredeckTimelineItemDisabled')(pack, kind, id, disabled); }
function removeLoredeckTimelineDefinition(pack, kind = 'anchor', id = '') { return dep('removeLoredeckTimelineDefinition')(pack, kind, id); }
function downloadJson(value = {}, filename = '') { return dep('downloadJson')(value, filename); }
function sanitizeFileStem(value = '') { return dep('sanitizeFileStem', source => String(source || 'saga-loredeck'))(value); }
function toast(message, type = 'info') { return dep('toast')(message, type); }

export function createLoredeckTimelineRegistryCard(pack = {}, rows = []) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Timeline Registry';
    wrap.appendChild(title);

    const sourceCache = getLoredeckTimelineRegistryCacheRecord(pack.packId);
    const customRegistry = getLoredeckEmbeddedTimelineRegistry(pack);
    const allItems = buildLoredeckTimelineRegistryItems(pack, rows);
    const anchors = allItems.filter(item => item.kind === 'anchor');
    const windows = allItems.filter(item => item.kind === 'window');
    const disabledCount = allItems.filter(item => item.disabled).length;
    const undefinedCount = allItems.filter(item => item.registryState === 'undefined').length;
    const attachedCount = allItems.filter(item => item.entryIds.length).length;

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${anchors.length} anchors`, 'Timeline anchor definitions visible in this editor.'));
    summary.appendChild(createStatusPill(`${windows.length} windows`, 'Timeline window definitions visible in this editor.'));
    summary.appendChild(createStatusPill(`${attachedCount} attached`, 'Timeline definitions referenced by loaded entries.'));
    if (undefinedCount) summary.appendChild(createStatusPill(`${undefinedCount} undefined`, 'Loaded entries reference anchors that are not defined in the active timeline registry.'));
    if (disabledCount) summary.appendChild(createStatusPill(`${disabledCount} disabled`, 'Source timeline definitions suppressed by this Custom Loredeck overlay.'));
    if (sourceCache?.loadedAt && !sourceCache.missing && !sourceCache.error) summary.appendChild(createStatusPill('timeline.json loaded', 'Source timeline registry has been fetched for this editor session.'));
    if (sourceCache?.missing) summary.appendChild(createStatusPill('no source timeline', 'The manifest does not currently declare registries.timeline.'));
    if (getLoredeckTimelineRegistryCount(customRegistry)) summary.appendChild(createStatusPill('custom overlay', 'This Loredeck has saved editable timeline registry metadata.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Timeline edits queue Custom overlay proposals. Accepted overlays affect Context search, Deck Health, and runtime Context gating.';
    wrap.appendChild(help);
    if (sourceCache?.error) {
        wrap.appendChild(createKeyValue('Registry Load Error', sourceCache.error, 'Last timeline.json load error for this Loredeck.'));
    }

    const actions = createLoredeckActionRow();
    const loadRegistry = createButton('Load Timeline', 'Fetch source timeline.json for this Loredeck if the manifest declares one.', async (btn) => {
        await loadLoredeckTimelineRegistryForEditor(pack, btn);
    });
    loadRegistry.disabled = !pack.manifest;
    actions.appendChild(loadRegistry);
    actions.appendChild(createButton('New Anchor', 'Create a new timeline anchor in this Custom Loredeck overlay.', () => {
        openLoredeckTimelineAnchorDialog(pack, null);
    }, 'saga-primary-button'));
    actions.appendChild(createButton('New Window', 'Create a new timeline window in this Custom Loredeck overlay.', () => {
        openLoredeckTimelineWindowDialog(pack, null);
    }));
    const exportButton = createButton('Export Timeline', 'Download the currently merged active timeline registry as timeline.json.', () => {
        downloadJson(buildMergedLoredeckTimelineRegistryForExport(pack), `${sanitizeFileStem(pack.packId || 'saga-loredeck')}.timeline.json`);
        toast('Timeline registry exported.', 'info');
    });
    exportButton.disabled = !allItems.length;
    actions.appendChild(exportButton);
    wrap.appendChild(actions);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'saga-loredeck-entry-search';
    search.placeholder = 'Search timeline anchors/windows...';
    search.value = getLoredeckTimelineRegistryQuery() || '';
    addTooltip(search, 'Search timeline IDs, labels, arcs, aliases, tags, and attachment status.');
    search.addEventListener('click', e => e.stopPropagation());
    search.addEventListener('mousedown', e => e.stopPropagation());
    search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        setLoredeckTimelineRegistryQuery(search.value);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    search.addEventListener('change', () => {
        setLoredeckTimelineRegistryQuery(search.value);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    wrap.appendChild(search);

    const q = String(getLoredeckTimelineRegistryQuery() || '').trim().toLowerCase();
    const visible = allItems
        .filter(item => isLoredeckTimelineRegistryItemVisible(item, q))
        .slice(0, 32);

    if (!visible.length) {
        wrap.appendChild(createEmptyMessage(allItems.length ? 'No matching timeline definitions.' : 'Load entries, load timeline.json, or create an anchor/window to begin editing the registry.'));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const item of visible) {
        list.appendChild(createLoredeckTimelineRegistryRow(pack, item));
    }
    if (visible.length < allItems.length) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing ${visible.length} of ${allItems.length} timeline definitions. Search to narrow the list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function isLoredeckTimelineRegistryItemVisible(item = {}, query = '') {
    if (!query) return true;
    const def = item.definition || {};
    return [
        item.kind,
        item.id,
        item.registryState,
        def.label,
        def.arc,
        def.phase,
        def.season,
        def.episode,
        def.chapter,
        def.anchorFrom,
        def.anchorTo,
        def.notes,
        ...(Array.isArray(def.aliases) ? def.aliases : []),
        ...(Array.isArray(def.tags) ? def.tags : []),
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
}

function formatTimelineDateRange(dateRange = {}) {
    const range = dateRange && typeof dateRange === 'object' && !Array.isArray(dateRange) ? dateRange : {};
    const from = String(range.from || '').trim();
    const to = String(range.to || '').trim();
    if (from && to && from !== to) return `${from} to ${to}`;
    return from || to || '';
}

export function createLoredeckTimelineRegistryRow(pack = {}, item = {}) {
    const row = document.createElement('div');
    row.className = `saga-loredeck-entry-row${item.disabled ? ' saga-loredeck-entry-row-disabled' : ''}`.trim();

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = item.definition?.label || item.id;
    main.appendChild(title);
    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    if (item.kind === 'anchor') {
        const range = formatTimelineDateRange(item.definition?.dateRange);
        desc.textContent = `${item.id}${range ? ` | ${range}` : ''}${item.definition?.notes ? ` | ${truncateText(item.definition.notes, 120)}` : ''}`;
    } else {
        desc.textContent = `${item.id} | ${item.definition?.anchorFrom || '?'} -> ${item.definition?.anchorTo || '?'}`;
    }
    main.appendChild(desc);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(item.kind, 'Timeline registry item type.'));
    meta.appendChild(createStatusPill(item.registryState, 'Timeline registry source state.'));
    if (item.kind === 'anchor') meta.appendChild(createStatusPill(`sort ${item.definition?.sortKey ?? '?'}`, 'Timeline sort key.'));
    if (item.kind === 'window') meta.appendChild(createStatusPill(`${item.definition?.sortKeyFrom ?? '?'}-${item.definition?.sortKeyTo ?? '?'}`, 'Timeline sort key window.'));
    if (item.entryIds.length) meta.appendChild(createStatusPill(`${item.entryIds.length} entr${item.entryIds.length === 1 ? 'y' : 'ies'}`, item.entryIds.slice(0, 12).join(', ')));
    main.appendChild(meta);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    const filterButton = createButton('Entries', 'Filter the entry list to entries attached to this timeline definition.', () => {
        setLoredeckEntryOverrideQuery(item.id || '');
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    filterButton.disabled = !item.entryIds.length;
    actions.appendChild(filterButton);
    actions.appendChild(createButton('Edit', 'Edit this timeline definition as a Custom overlay proposal.', () => {
        if (item.kind === 'anchor') openLoredeckTimelineAnchorDialog(pack, item);
        else openLoredeckTimelineWindowDialog(pack, item);
    }, item.customDefined ? 'saga-primary-button' : ''));
    actions.appendChild(createButton(item.disabled ? 'Enable' : 'Disable', item.disabled ? 'Restore this source timeline definition.' : 'Suppress this timeline definition in this Custom overlay.', () => {
        setLoredeckTimelineItemDisabled(pack, item.kind, item.id, !item.disabled);
    }));
    if (item.customDefined) {
        actions.appendChild(createButton('Forget Overlay', 'Remove this Custom timeline definition and fall back to source if one exists.', () => {
            removeLoredeckTimelineDefinition(pack, item.kind, item.id);
        }, 'saga-danger-button'));
    }
    row.appendChild(actions);
    return row;
}
