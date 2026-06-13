/**
 * loredeck-entry-overrides-panel.js - Saga
 * Runtime Loredeck entry override card and row rendering.
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

let entryOverrideDeps = {};

export function configureLoredeckEntryOverridesPanel(deps = {}) {
    entryOverrideDeps = { ...entryOverrideDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof entryOverrideDeps[name] === 'function' ? entryOverrideDeps[name] : fallback;
}

function getLoredeckOverrideState(pack = {}) { return dep('getLoredeckOverrideState', () => ({ overrideCount: 0, disabledEntryIds: [], pendingCount: 0 }))(pack); }
function getLoredeckEntryPreviewCacheRecord(packId = '') { return dep('getLoredeckEntryPreviewCacheRecord', () => null)(packId); }
function getLoredeckEditableEntryRows(pack = {}, entries = []) { return dep('getLoredeckEditableEntryRows', () => [])(pack, entries); }
function filterLoredeckEditableEntryRows(rows = [], query = '') { return dep('filterLoredeckEditableEntryRows', sourceRows => sourceRows)(rows, query); }
function getLoredeckEntryOverrideQuery() { return dep('getLoredeckEntryOverrideQuery', () => '')(); }
function setLoredeckEntryOverrideQuery(value = '') { return dep('setLoredeckEntryOverrideQuery')((value || '').trim()); }
function refreshPanelBody(options = {}) { return dep('refreshPanelBody')(options); }
function loadLoredeckEntriesForEditor(pack, button = null) { return dep('loadLoredeckEntriesForEditor', async () => {})(pack, button); }
function canValidateLoredeckInEditor(pack = {}) { return dep('canValidateLoredeckInEditor', () => false)(pack); }
function openLoredeckEntryOverrideDialog(pack, row = null) { return dep('openLoredeckEntryOverrideDialog')(pack, row); }
function openLoredeckBulkTagsDialog(pack, rows = []) { return dep('openLoredeckBulkTagsDialog')(pack, rows); }
function openLoredeckBulkContextDialog(pack, rows = []) { return dep('openLoredeckBulkContextDialog')(pack, rows); }
function attemptLoredeckHealthFixes(pack, button = null) {
    return dep('attemptLoredeckHealthFixes', async () => false)(pack, button);
}
function createLoredeckPendingReviewCard(pack = {}) { return dep('createLoredeckPendingReviewCard', () => null)(pack); }
function createLoredeckAssistantCard(pack = {}, rows = [], filteredRows = []) { return dep('createLoredeckAssistantCard', () => null)(pack, rows, filteredRows); }
function createLoredeckTimelineRegistryCard(pack = {}, rows = []) { return dep('createLoredeckTimelineRegistryCard', () => null)(pack, rows); }
function createLoredeckTagManagerCard(pack = {}, rows = [], filteredRows = []) { return dep('createLoredeckTagManagerCard', () => null)(pack, rows, filteredRows); }
function setLoredeckEntryDisabled(pack = {}, entryId = '', disabled = false) { return dep('setLoredeckEntryDisabled')(pack, entryId, disabled); }
function removeLoredeckEntryOverride(pack = {}, entryId = '') { return dep('removeLoredeckEntryOverride')(pack, entryId); }

function getLoredeckEntryOverrideStatusTone(status = '') {
    const normalized = String(status || '').trim().toLowerCase();
    if (['override', 'edited', 'custom', 'added', 'addition'].includes(normalized)) return 'success';
    if (['pending', 'draft'].includes(normalized)) return 'review';
    if (['disabled', 'suppressed'].includes(normalized)) return 'muted';
    return 'source';
}

export function createLoredeckEntryOverrideCard(pack = {}) {
    const state = getLoredeckOverrideState(pack);
    const cached = getLoredeckEntryPreviewCacheRecord(pack.packId) || {};
    const card = document.createElement('div');
    card.className = 'saga-loredeck-entry-overrides';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Lorecard Overrides';
    card.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${state.overrideCount} override${state.overrideCount === 1 ? '' : 's'}`, 'Saved edited or added Lorecards in this Custom Loredeck.', { tone: state.overrideCount ? 'success' : 'muted', kind: 'count' }));
    summary.appendChild(createStatusPill(`${state.disabledEntryIds.length} disabled`, 'Source Lorecard IDs suppressed by this Custom Loredeck.', { tone: 'muted', kind: 'count' }));
    summary.appendChild(createStatusPill(`${state.pendingCount} pending`, 'Loredeck edits queued for review before they affect runtime injection.', { tone: state.pendingCount ? 'review' : 'muted', kind: 'count' }));
    if (cached?.entries?.length) summary.appendChild(createStatusPill(`${cached.entries.length} source Lorecards`, 'Source Lorecards loaded for browsing and editing.', { tone: 'source', kind: 'count' }));
    card.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Accepted overrides are stored in the Custom Loredeck library record. New edits are queued for review first and do not edit bundled files.';
    card.appendChild(help);

    const rows = getLoredeckEditableEntryRows(pack, cached?.entries || []);
    const query = getLoredeckEntryOverrideQuery();
    const filteredRows = filterLoredeckEditableEntryRows(rows, query);
    const bulkRows = query ? filteredRows : rows;

    const actions = createLoredeckActionRow();
    const loadButton = createButton(cached?.entries?.length ? 'Reload Lorecards' : 'Load Lorecards', 'Fetch source Lorecard files for browsing and editing.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
    }, 'saga-primary-button');
    loadButton.disabled = !canValidateLoredeckInEditor(pack);
    actions.appendChild(loadButton);
    actions.appendChild(createButton('New Lorecard', 'Create a new custom Lorecard in this Loredeck.', () => {
        openLoredeckEntryOverrideDialog(pack, null);
    }));
    const bulkTagsButton = createButton('Bulk Tags', 'Add, remove, or rename tags for loaded Lorecards or the current search result.', () => {
        openLoredeckBulkTagsDialog(pack, bulkRows);
    });
    bulkTagsButton.disabled = !bulkRows.length;
    actions.appendChild(bulkTagsButton);
    const bulkButton = createButton('Bulk Context', 'Apply one Context and retrieval block to loaded Lorecards or the current search result.', () => {
        openLoredeckBulkContextDialog(pack, bulkRows);
    });
    bulkButton.disabled = !bulkRows.length;
    actions.appendChild(bulkButton);
    if (state.overrideCount) {
        actions.appendChild(createButton('Attempt Fixing', 'Run Pack Health fixing for this Loredeck and save remaining review work when needed.', async (btn) => {
            await attemptLoredeckHealthFixes(pack, btn);
        }));
    }
    card.appendChild(actions);

    if (cached?.error) {
        card.appendChild(createKeyValue('Load Error', cached.error, 'Last entry load error.'));
    }

    if (pack.type !== 'bundled' || state.pendingCount) {
        const pending = createLoredeckPendingReviewCard(pack);
        if (pending) card.appendChild(pending);
    }

    const assistant = createLoredeckAssistantCard(pack, rows, filteredRows);
    if (assistant) card.appendChild(assistant);
    const timeline = createLoredeckTimelineRegistryCard(pack, rows);
    if (timeline) card.appendChild(timeline);
    const tags = createLoredeckTagManagerCard(pack, rows, filteredRows);
    if (tags) card.appendChild(tags);

    if (rows.length) {
        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'saga-loredeck-entry-search';
        search.placeholder = 'Search entries...';
        search.value = query || '';
        addTooltip(search, 'Search loaded source entries, saved overrides, and disabled IDs. Press Enter or leave the field to refresh.');
        search.addEventListener('click', e => e.stopPropagation());
        search.addEventListener('mousedown', e => e.stopPropagation());
        search.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                setLoredeckEntryOverrideQuery(search.value);
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            }
        });
        search.addEventListener('change', () => {
            setLoredeckEntryOverrideQuery(search.value);
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        });
        card.appendChild(search);

        const list = document.createElement('div');
        list.className = 'saga-loredeck-entry-list';
        const visible = filteredRows.slice(0, 30);
        for (const row of visible) {
            list.appendChild(createLoredeckEntryOverrideRow(pack, row));
        }
        if (visible.length < rows.length) {
            const more = document.createElement('div');
            more.className = 'saga-runtime-help';
            more.textContent = `Showing ${visible.length} of ${rows.length}. Narrow search to reduce the list.`;
            list.appendChild(more);
        }
        card.appendChild(list);
    } else {
        card.appendChild(createEmptyMessage('Load Lorecards or create a new Lorecard to begin editing this Custom Loredeck.'));
    }

    return card;
}

export function createLoredeckEntryOverrideRow(pack = {}, row = {}) {
    const wrap = document.createElement('div');
    wrap.className = `saga-loredeck-entry-row saga-loredeck-entry-row-${row.status}`.trim();
    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = row.entry?.title || row.id;
    main.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    desc.textContent = truncateText(row.entry?.fact || row.entry?.content?.fact || row.entry?.content?.notes || row.id, 180);
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(row.status, 'Entry override status in this Custom Loredeck.', { tone: getLoredeckEntryOverrideStatusTone(row.status), kind: 'status' }));
    meta.appendChild(createStatusPill(row.id, 'Lore entry ID.', { tone: 'source', kind: 'source', maxChars: 38 }));
    if (row.entry?.category) meta.appendChild(createStatusPill(row.entry.category, 'Entry category.', { tone: 'category', kind: 'metadata' }));
    if (row.entry?.relevance) meta.appendChild(createStatusPill(row.entry.relevance, 'Entry relevance tier.', { tone: 'relevance', kind: 'metadata' }));
    if (row.entry?.context?.label) meta.appendChild(createStatusPill(row.entry.context.label, 'Context label for this entry.', { tone: 'source', kind: 'source', maxChars: 36 }));
    if (row.entry?.retrieval?.activation) meta.appendChild(createStatusPill(row.entry.retrieval.activation, 'Retrieval activation mode.', { tone: 'info', kind: 'metadata' }));
    main.appendChild(meta);
    wrap.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    actions.appendChild(createButton('Edit', 'Edit or create an override for this entry.', () => {
        openLoredeckEntryOverrideDialog(pack, row);
    }, row.overrideEntry ? 'saga-primary-button' : ''));
    actions.appendChild(createButton(row.disabled ? 'Restore' : 'Disable', row.disabled ? 'Restore this source/custom entry.' : 'Suppress this entry inside this Custom Loredeck.', () => {
        setLoredeckEntryDisabled(pack, row.id, !row.disabled);
    }));
    if (row.overrideEntry) {
        actions.appendChild(createButton('Remove Override', 'Remove the saved override. Source entry remains unless disabled.', () => {
            removeLoredeckEntryOverride(pack, row.id);
        }, 'saga-danger-button'));
    }
    wrap.appendChild(actions);
    return wrap;
}
