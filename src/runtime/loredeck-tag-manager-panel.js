/**
 * loredeck-tag-manager-panel.js - Saga
 * Runtime Loredeck tag manager card and row rendering.
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

let tagManagerDeps = {};

export function configureLoredeckTagManagerPanel(deps = {}) {
    tagManagerDeps = { ...tagManagerDeps, ...(deps || {}) };
}

function dep(name, fallback = () => undefined) {
    return typeof tagManagerDeps[name] === 'function' ? tagManagerDeps[name] : fallback;
}

function getLoredeckTagRegistryCacheRecord(packId = '') { return dep('getLoredeckTagRegistryCacheRecord', () => null)(packId); }
function getLoredeckEmbeddedTagRegistry(pack = {}) { return dep('getLoredeckEmbeddedTagRegistry', () => ({}))(pack); }
function buildLoredeckTagManagerItems(pack = {}, rows = []) { return dep('buildLoredeckTagManagerItems', () => [])(pack, rows); }
function buildMergedLoredeckTagRegistryForExport(pack = {}, rows = []) { return dep('buildMergedLoredeckTagRegistryForExport', () => ({}))(pack, rows); }
function getLoredeckTagRegistryCount(registry = {}) { return dep('getLoredeckTagRegistryCount', () => 0)(registry); }
function getLoredeckEntryOverrideQuery() { return dep('getLoredeckEntryOverrideQuery', () => '')(); }
function getLoredeckTagManagerQuery() { return dep('getLoredeckTagManagerQuery', () => '')(); }
function setLoredeckTagManagerQuery(value = '') { return dep('setLoredeckTagManagerQuery')((value || '').trim()); }
function setLoredeckEntryOverrideQuery(value = '') { return dep('setLoredeckEntryOverrideQuery')((value || '').trim()); }
function getLoredeckEntryRowsForBulk(rows = []) { return dep('getLoredeckEntryRowsForBulk', value => value || [])(rows); }
function getLoredeckEntryTags(entry = {}) { return dep('getLoredeckEntryTags', () => [])(entry); }
function humanizeLoredeckTagId(tagId = '') { return dep('humanizeLoredeckTagId', value => String(value || 'tag'))(tagId); }
function refreshPanelBody(options = {}) { return dep('refreshPanelBody')(options); }
function loadLoredeckTagRegistryForEditor(pack, button = null) { return dep('loadLoredeckTagRegistryForEditor', async () => {})(pack, button); }
function openLoredeckTagRegistryDialog(pack, item = null) { return dep('openLoredeckTagRegistryDialog')(pack, item); }
function openLoredeckTagRenameDialog(pack, rows = [], item = {}) { return dep('openLoredeckTagRenameDialog')(pack, rows, item); }
function openLoredeckBulkTagsDialog(pack, rows = [], options = null) { return dep('openLoredeckBulkTagsDialog')(pack, rows, options); }
function removeLoredeckTagRegistryDefinition(pack, tagId = '') { return dep('removeLoredeckTagRegistryDefinition')(pack, tagId); }
function downloadJson(value = {}, filename = '') { return dep('downloadJson')(value, filename); }
function sanitizeFileStem(value = '') { return dep('sanitizeFileStem', source => String(source || 'saga-loredeck'))(value); }
function toast(message, type = 'info') { return dep('toast')(message, type); }

export function createLoredeckTagManagerCard(pack = {}, rows = [], filteredRows = []) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Tag Manager';
    wrap.appendChild(title);

    const sourceCache = getLoredeckTagRegistryCacheRecord(pack.packId);
    const customRegistry = getLoredeckEmbeddedTagRegistry(pack);
    const allItems = buildLoredeckTagManagerItems(pack, rows);
    const registryCount = allItems.filter(item => item.sourceDefined || item.customDefined).length;
    const undefinedCount = allItems.filter(item => item.count && !item.sourceDefined && !item.customDefined).length;
    const targetRows = getLoredeckEntryOverrideQuery() ? filteredRows : rows;
    const editableTargetCount = getLoredeckEntryRowsForBulk(targetRows).length;

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${registryCount} defined`, 'Tags defined by source tags.json or this Custom Loredeck registry layer.'));
    summary.appendChild(createStatusPill(`${undefinedCount} undefined`, 'Entry tags currently used but not defined by a loaded registry.'));
    summary.appendChild(createStatusPill(`${allItems.length} visible`, 'Total registry and entry-discovered tags in this manager.'));
    summary.appendChild(createStatusPill(`${editableTargetCount} target entr${editableTargetCount === 1 ? 'y' : 'ies'}`, 'Entries affected by bulk tag actions. Current entry search narrows this target set.'));
    if (sourceCache?.loadedAt && !sourceCache.missing && !sourceCache.error) summary.appendChild(createStatusPill('tags.json loaded', 'Source tag registry has been fetched for this editor session.'));
    if (sourceCache?.missing) summary.appendChild(createStatusPill('no source registry', 'The manifest does not currently declare registries.tags.'));
    if (getLoredeckTagRegistryCount(customRegistry)) summary.appendChild(createStatusPill('custom registry', 'This Loredeck has saved editable tag registry metadata.'));
    if (getLoredeckEntryOverrideQuery()) summary.appendChild(createStatusPill('Search scoped', 'Bulk tag actions will target the current entry search result.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = pack.type === 'bundled'
        ? 'Bundled tag registries are read-only here. Duplicate this pack as Custom to define, rename, or deprecate tags.'
        : 'Registry definitions are saved in this Custom Loredeck record. Entry tag changes still use Custom overrides.';
    wrap.appendChild(help);
    if (sourceCache?.error) {
        wrap.appendChild(createKeyValue('Registry Load Error', sourceCache.error, 'Last tags.json load error for this Loredeck.'));
    }

    const actions = createLoredeckActionRow();
    const loadRegistry = createButton('Load Registry', 'Fetch source tags.json for this Loredeck if the manifest declares one.', async (btn) => {
        await loadLoredeckTagRegistryForEditor(pack, btn);
    });
    loadRegistry.disabled = !pack.manifest;
    actions.appendChild(loadRegistry);
    const newTag = createButton('New Tag', 'Create a new tag definition in this Custom Loredeck registry.', () => {
        openLoredeckTagRegistryDialog(pack, null);
    }, 'saga-primary-button');
    newTag.disabled = pack.type === 'bundled';
    actions.appendChild(newTag);
    const bulk = createButton('Bulk Tags', 'Add, remove, or rename tags for the current target entries.', () => {
        openLoredeckBulkTagsDialog(pack, targetRows);
    });
    bulk.disabled = !editableTargetCount;
    actions.appendChild(bulk);
    const exportButton = createButton('Export Registry', 'Download the currently merged tag registry as tags.json.', () => {
        downloadJson(buildMergedLoredeckTagRegistryForExport(pack, rows), `${sanitizeFileStem(pack.packId || 'saga-loredeck')}.tags.json`);
        toast('Tag registry exported.', 'info');
    });
    exportButton.disabled = !registryCount;
    actions.appendChild(exportButton);
    wrap.appendChild(actions);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'saga-loredeck-entry-search';
    search.placeholder = 'Search tags...';
    search.value = getLoredeckTagManagerQuery() || '';
    addTooltip(search, 'Search tags by namespace or label.');
    search.addEventListener('click', e => e.stopPropagation());
    search.addEventListener('mousedown', e => e.stopPropagation());
    search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        setLoredeckTagManagerQuery(search.value);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    search.addEventListener('change', () => {
        setLoredeckTagManagerQuery(search.value);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    wrap.appendChild(search);

    const q = String(getLoredeckTagManagerQuery() || '').trim().toLowerCase();
    const visible = allItems
        .filter(item => isLoredeckTagManagerItemVisible(item, q))
        .slice(0, 24);

    if (!visible.length) {
        wrap.appendChild(createEmptyMessage(allItems.length ? 'No matching tags.' : 'No tags found. Load entries, load tags.json, or create a new tag definition.'));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const item of visible) {
        list.appendChild(createLoredeckTagManagerRow(pack, rows, item));
    }
    if (visible.length < allItems.length) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing ${visible.length} of ${allItems.length} tags. Search to narrow the list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function isLoredeckTagManagerItemVisible(item = {}, query = '') {
    if (!query) return true;
    const def = item.definition || {};
    return [
        item.tag,
        def.label,
        def.description,
        ...(Array.isArray(def.aliases) ? def.aliases : []),
        ...(Array.isArray(def.parents) ? def.parents : []),
        def.replacement,
        item.registryState,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
}

export function createLoredeckTagManagerRow(pack = {}, rows = [], item = {}) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-entry-row';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = item.tag || 'tag';
    main.appendChild(title);
    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    const def = item.definition || {};
    const label = def.label || humanizeLoredeckTagId(item.tag);
    const description = def.description || `${item.count || 0} entr${item.count === 1 ? 'y' : 'ies'} use this tag.`;
    desc.textContent = `${label}${description ? ` | ${description}` : ''}`;
    main.appendChild(desc);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(`${item.count || 0} total`, 'Total entries with this tag.'));
    if (item.overrideCount) meta.appendChild(createStatusPill(`${item.overrideCount} override${item.overrideCount === 1 ? '' : 's'}`, 'Saved overrides using this tag.'));
    if (item.sourceCount) meta.appendChild(createStatusPill(`${item.sourceCount} source`, 'Source entries using this tag.'));
    meta.appendChild(createStatusPill(item.registryState || 'undefined', 'Registry definition source for this tag.'));
    if (def.deprecated) meta.appendChild(createStatusPill('deprecated', def.replacement ? `Replacement: ${def.replacement}` : 'Tag is marked deprecated.'));
    if (def.sensitive) meta.appendChild(createStatusPill('sensitive', 'Tag marks sensitive, secret, or spoiler-prone lore.'));
    if (Array.isArray(def.aliases) && def.aliases.length) meta.appendChild(createStatusPill(`${def.aliases.length} alias${def.aliases.length === 1 ? '' : 'es'}`, 'Search aliases defined for this tag.'));
    main.appendChild(meta);
    row.appendChild(main);

    const tagRows = rows.filter(entryRow => getLoredeckEntryTags(entryRow.entry || {}).some(tag => tag.toLowerCase() === String(item.tag || '').toLowerCase()));
    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    const filterButton = createButton('Filter', 'Filter entry rows to this tag.', () => {
        setLoredeckEntryOverrideQuery(item.tag || '');
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    filterButton.disabled = !(item.count || 0);
    actions.appendChild(filterButton);
    const editButton = createButton(item.sourceDefined || item.customDefined ? 'Edit Def' : 'Define', 'Edit this tag definition in the Custom registry layer.', () => {
        openLoredeckTagRegistryDialog(pack, item);
    });
    editButton.disabled = pack.type === 'bundled';
    actions.appendChild(editButton);
    const renameButton = createButton('Rename', 'Rename this tag across entries that currently use it.', () => {
        openLoredeckTagRenameDialog(pack, tagRows, item);
    });
    renameButton.disabled = pack.type === 'bundled';
    actions.appendChild(renameButton);
    const removeEntriesButton = createButton('Remove Entries', 'Remove this tag across entries that currently use it.', () => {
        openLoredeckBulkTagsDialog(pack, tagRows, { mode: 'remove', removeTags: item.tag || '' });
    }, 'saga-danger-button');
    removeEntriesButton.disabled = pack.type === 'bundled' || !tagRows.length;
    actions.appendChild(removeEntriesButton);
    if (item.customDefined) {
        actions.appendChild(createButton('Forget Def', 'Remove the saved Custom registry definition without changing entry tags.', () => {
            removeLoredeckTagRegistryDefinition(pack, item.tag);
        }, 'saga-danger-button'));
    }
    row.appendChild(actions);
    return row;
}
