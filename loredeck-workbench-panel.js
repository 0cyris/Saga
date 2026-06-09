import {
    loadLoredeckSourceById,
    normalizeLoredeckEntryForSchemaV3,
} from './loredeck-loader.js';
import {
    addTooltip,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
    toast,
    wireOverlayBackdropClose,
} from './runtime-ui-kit.js';

const LOREDECK_WORKBENCH_ID = 'wandlight-loredeck-workbench';

let loredeckWorkbenchDeps = {};
let loredeckWorkbenchPackId = '';
let loredeckWorkbenchQuery = '';
let loredeckWorkbenchRelevanceFilter = 'all';
let loredeckWorkbenchCategoryFilter = 'all';
let loredeckWorkbenchSelectedEntryId = '';
let loredeckWorkbenchCache = {
    packId: '',
    status: 'idle',
    error: '',
    loadedAt: 0,
    rows: [],
    source: null,
};

export function configureLoredeckWorkbenchPanel(deps = {}) {
    loredeckWorkbenchDeps = { ...loredeckWorkbenchDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = loredeckWorkbenchDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Loredeck Workbench dependency is not configured: ${name}`);
}

function getState() { return dep('getState', () => ({}))(); }
function getLoredeckLibrary(state) { return dep('getLoredeckLibrary', () => [])(state); }
function getLoredeckLibraryRegistry(state) { return dep('getLoredeckLibraryRegistry', () => ({ packs: {}, folders: [] }))(state); }
function getLoredeckDefinition(packId) { return dep('getLoredeckDefinition', () => null)(packId); }
function getFreshLoredeckLibraryPack(packId, fallback) { return dep('getFreshLoredeckLibraryPack', (_packId, _fallback) => _fallback || null)(packId, fallback); }
function getLoredeckTypeLabel(packId) { return dep('getLoredeckTypeLabel', () => 'Custom')(packId); }
function openDuplicateLoredeckDialog(pack) { return dep('openDuplicateLoredeckDialog', () => {})(pack); }
function openLoredeckHealthCenter(packId) { return dep('openLoredeckHealthCenter', () => {})(packId); }

export function openLoredeckWorkbench(packId = '') {
    const id = String(packId || '').trim();
    if (!id) {
        toast('Select a Loredeck before opening the workbench.', 'warning');
        return;
    }
    loredeckWorkbenchPackId = id;
    loredeckWorkbenchSelectedEntryId = '';
    renderLoredeckWorkbench();
    void loadLoredeckWorkbenchRows(id, { force: loredeckWorkbenchCache.packId !== id || !loredeckWorkbenchCache.rows.length });
}

export function closeLoredeckWorkbench() {
    document.getElementById(LOREDECK_WORKBENCH_ID)?.remove();
}

export function refreshLoredeckWorkbench() {
    if (!document.getElementById(LOREDECK_WORKBENCH_ID)) return;
    renderLoredeckWorkbench();
}

function getWorkbenchPack(packId = loredeckWorkbenchPackId) {
    const state = getState();
    const id = String(packId || '').trim();
    if (!id) return null;
    const libraryPack = getLoredeckLibrary(state).find(pack => pack?.packId === id) || null;
    return getFreshLoredeckLibraryPack(id, libraryPack || getLoredeckDefinition(id)) || libraryPack || getLoredeckDefinition(id);
}

function renderLoredeckWorkbench() {
    const pack = getWorkbenchPack();
    let overlay = document.getElementById(LOREDECK_WORKBENCH_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = LOREDECK_WORKBENCH_ID;
        overlay.className = 'wandlight-lore-workbench-overlay wandlight-loredeck-workbench-overlay';
        overlay.tabIndex = -1;
        wireOverlayBackdropClose(overlay, closeLoredeckWorkbench);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeLoredeckWorkbench();
        });
        document.body.appendChild(overlay);
    }
    overlay.replaceChildren(createLoredeckWorkbenchShell(pack));
    requestAnimationFrame(() => overlay.focus?.());
}

function createLoredeckWorkbenchShell(pack = null) {
    const shell = document.createElement('div');
    shell.className = 'wandlight-lore-workbench-shell wandlight-loredeck-workbench-shell';
    shell.addEventListener('click', event => event.stopPropagation());

    shell.appendChild(createLoredeckWorkbenchHeader(pack));

    const body = document.createElement('div');
    body.className = 'wandlight-lore-workbench-body wandlight-loredeck-workbench-body';
    if (!pack?.packId) {
        body.appendChild(createEmptyMessage('Select a Loredeck from the Library before opening the workbench.'));
    } else {
        body.appendChild(createLoredeckWorkbenchTabs());
        body.appendChild(createLoredeckWorkbenchLorecardsView(pack));
    }
    shell.appendChild(body);
    return shell;
}

function createLoredeckWorkbenchHeader(pack = null) {
    const header = document.createElement('div');
    header.className = 'wandlight-lore-workbench-header wandlight-loredeck-workbench-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'wandlight-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'wandlight-lore-workbench-title';
    title.textContent = pack?.title || pack?.packId || 'Loredeck Workbench';
    titleWrap.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'wandlight-lore-workbench-subtitle';
    subtitle.textContent = pack?.description || 'Inspect and edit Lorecards inside this Loredeck.';
    titleWrap.appendChild(subtitle);

    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-workbench-header-chips wandlight-loredeck-row-meta';
    if (pack?.packId) {
        chips.appendChild(createStatusPill(getLoredeckTypeLabel(pack.packId), 'Loredeck source type.'));
        chips.appendChild(createStatusPill(`${loredeckWorkbenchCache.rows.length} Lorecards`, 'Loaded Lorecards in this workbench cache.'));
        chips.appendChild(createStatusPill(getLoredeckWorkbenchSaveState(pack), getLoredeckWorkbenchSaveTooltip(pack)));
        if (loredeckWorkbenchCache.status === 'loading') chips.appendChild(createStatusPill('Loading...', 'Lorecards are loading from this Loredeck source.'));
        if (loredeckWorkbenchCache.error) chips.appendChild(createStatusPill('Load failed', loredeckWorkbenchCache.error));
    } else {
        chips.appendChild(createStatusPill('No deck', 'No Loredeck is selected.'));
    }
    titleWrap.appendChild(chips);
    header.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'wandlight-primary-actions wandlight-loredeck-workbench-header-actions';
    if (pack?.packId) {
        const refresh = createButton('Reload Lorecards', 'Reload Lorecards from this Loredeck source.', async btn => {
            await loadLoredeckWorkbenchRows(pack.packId, { force: true, button: btn });
        });
        actions.appendChild(refresh);
        actions.appendChild(createButton('Open Health', 'Open the Deck Health Center for this Loredeck.', () => {
            openLoredeckHealthCenter(pack.packId);
        }));
        if (pack.type === 'bundled') {
            actions.appendChild(createButton('Duplicate to Edit', 'Create an editable Custom copy of this Bundled Loredeck.', () => {
                openDuplicateLoredeckDialog(pack);
            }, 'wandlight-primary-button'));
        }
    }
    actions.appendChild(createButton('Close', 'Close the Loredeck Workbench.', closeLoredeckWorkbench, 'wandlight-small-button wandlight-lore-workbench-close'));
    header.appendChild(actions);
    return header;
}

function getLoredeckWorkbenchSaveState(pack = {}) {
    if (!pack?.packId) return 'No deck';
    if (pack.type === 'bundled') return 'Read-only';
    return 'Saved';
}

function getLoredeckWorkbenchSaveTooltip(pack = {}) {
    if (pack?.type === 'bundled') return 'Bundled Loredecks are read-only. Duplicate to edit.';
    return 'Phase 1 is a read-only viewer. Editable autosave will be added next for Custom and Generated Loredecks.';
}

function createLoredeckWorkbenchTabs() {
    const tabs = document.createElement('div');
    tabs.className = 'wandlight-lore-workbench-mode-tabs wandlight-loredeck-workbench-mode-tabs';
    for (const [id, label, count, tip] of [
        ['lorecards', 'Lorecards', loredeckWorkbenchCache.rows.length, 'Browse Lorecards inside this Loredeck.'],
        ['registries', 'Registries', 0, 'Registry editing will be added after the Lorecard browser/editor foundation.'],
        ['health', 'Health', 0, 'Use Open Health for the full Health Center in this phase.'],
        ['files', 'Files', getSourceFileCount(loredeckWorkbenchCache.source), 'Package file inspection will be expanded after the browser foundation.'],
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wandlight-lore-workbench-mode-tab';
        if (id === 'lorecards') btn.classList.add('wandlight-lore-workbench-mode-tab-active');
        btn.textContent = count ? `${label} (${count})` : label;
        btn.disabled = id !== 'lorecards';
        addTooltip(btn, tip);
        tabs.appendChild(btn);
    }
    return tabs;
}

function createLoredeckWorkbenchLorecardsView(pack = {}) {
    const view = document.createElement('div');
    view.className = 'wandlight-lore-workbench-view wandlight-loredeck-workbench-view';

    view.appendChild(createLoredeckWorkbenchControls(pack));

    if (loredeckWorkbenchCache.status === 'loading') {
        view.appendChild(createEmptyMessage('Loading Lorecards...'));
        return view;
    }
    if (loredeckWorkbenchCache.error) {
        view.appendChild(createEmptyMessage(loredeckWorkbenchCache.error));
        return view;
    }

    const rows = getFilteredLoredeckWorkbenchRows();
    ensureLoredeckWorkbenchSelection(rows);

    const main = document.createElement('div');
    main.className = 'wandlight-lore-workbench-main wandlight-loredeck-workbench-main';
    main.appendChild(createLoredeckWorkbenchTable(rows));
    main.appendChild(createLoredeckWorkbenchDetail(pack, rows));
    view.appendChild(main);
    return view;
}

function createLoredeckWorkbenchControls(pack = {}) {
    const controls = document.createElement('div');
    controls.className = 'wandlight-lore-workbench-controls wandlight-loredeck-workbench-controls';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wandlight-lore-workbench-search';
    search.placeholder = 'Search Lorecards...';
    search.value = loredeckWorkbenchQuery;
    addTooltip(search, 'Search by Lorecard title, ID, summary, tags, category, Context, or source file.');
    search.addEventListener('input', () => {
        loredeckWorkbenchQuery = search.value;
        renderLoredeckWorkbench();
        const next = document.querySelector(`#${LOREDECK_WORKBENCH_ID} .wandlight-lore-workbench-search`);
        if (next) {
            next.focus();
            next.setSelectionRange?.(next.value.length, next.value.length);
        }
    });
    controls.appendChild(search);

    controls.appendChild(createWorkbenchSelect('Relevance', loredeckWorkbenchRelevanceFilter, getRelevanceFilterOptions(), value => {
        loredeckWorkbenchRelevanceFilter = value || 'all';
        renderLoredeckWorkbench();
    }));
    controls.appendChild(createWorkbenchSelect('Category', loredeckWorkbenchCategoryFilter, getCategoryFilterOptions(), value => {
        loredeckWorkbenchCategoryFilter = value || 'all';
        renderLoredeckWorkbench();
    }));

    const count = document.createElement('div');
    count.className = 'wandlight-lore-workbench-count';
    const filtered = getFilteredLoredeckWorkbenchRows();
    count.textContent = `${filtered.length} of ${loredeckWorkbenchCache.rows.length} Lorecards`;
    addTooltip(count, `Current filters for ${pack.title || pack.packId}.`);
    controls.appendChild(count);
    return controls;
}

function createWorkbenchSelect(labelText, value, options, onChange) {
    const select = document.createElement('select');
    select.className = 'wandlight-lore-workbench-select';
    addTooltip(select, `Filter by ${labelText.toLowerCase()}.`);
    for (const [optionValue, optionLabel] of options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionLabel;
        select.appendChild(option);
    }
    select.value = options.some(([optionValue]) => optionValue === value) ? value : 'all';
    select.addEventListener('change', () => onChange(select.value));
    return select;
}

function createLoredeckWorkbenchTable(rows = []) {
    const table = document.createElement('div');
    table.className = 'wandlight-lore-workbench-table wandlight-loredeck-workbench-table';

    const header = document.createElement('div');
    header.className = 'wandlight-lore-workbench-row wandlight-lore-workbench-row-header';
    header.appendChild(createWorkbenchCell('Lorecard'));
    header.appendChild(createWorkbenchCell('Type'));
    header.appendChild(createWorkbenchCell('Relevance'));
    header.appendChild(createWorkbenchCell('Source'));
    table.appendChild(header);

    if (!rows.length) {
        table.appendChild(createEmptyMessage('No Lorecards match the current filters.'));
        return table;
    }

    const visible = rows.slice(0, 500);
    for (const row of visible) {
        table.appendChild(createLoredeckWorkbenchRow(row));
    }
    if (visible.length < rows.length) {
        const more = document.createElement('div');
        more.className = 'wandlight-lore-workbench-row-note';
        more.textContent = `Showing ${visible.length} of ${rows.length}. Narrow search or filters to inspect more.`;
        table.appendChild(more);
    }
    return table;
}

function createLoredeckWorkbenchRow(row = {}) {
    const entry = row.entry || {};
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'wandlight-lore-workbench-row wandlight-lore-workbench-entry-row wandlight-loredeck-workbench-entry-row';
    if (row.id === loredeckWorkbenchSelectedEntryId) el.classList.add('wandlight-lore-workbench-row-active');
    addTooltip(el, `Inspect ${entry.title || row.id}.`);
    el.addEventListener('click', () => {
        loredeckWorkbenchSelectedEntryId = row.id;
        renderLoredeckWorkbench();
    });
    el.appendChild(createWorkbenchCell(entry.title || row.id, row.id));
    el.appendChild(createWorkbenchCell(getEntryCategory(entry)));
    el.appendChild(createWorkbenchCell(getEntryRelevance(entry)));
    el.appendChild(createWorkbenchCell(row.sourceFile || 'embedded'));
    return el;
}

function createWorkbenchCell(text, subText = '') {
    const cell = document.createElement('div');
    cell.className = 'wandlight-lore-workbench-cell';
    const main = document.createElement('span');
    main.className = 'wandlight-lore-workbench-cell-main';
    main.textContent = String(text || 'unset');
    cell.appendChild(main);
    if (subText) {
        const sub = document.createElement('span');
        sub.className = 'wandlight-lore-workbench-cell-sub';
        sub.textContent = String(subText || '');
        cell.appendChild(sub);
    }
    return cell;
}

function createLoredeckWorkbenchDetail(pack = {}, rows = []) {
    const detail = document.createElement('div');
    detail.className = 'wandlight-lore-workbench-detail wandlight-loredeck-workbench-detail';
    const selected = rows.find(row => row.id === loredeckWorkbenchSelectedEntryId) || rows[0] || null;
    if (!selected) {
        detail.appendChild(createEmptyMessage('Select a Lorecard to inspect it.'));
        return detail;
    }

    const entry = selected.entry || {};
    const title = document.createElement('div');
    title.className = 'wandlight-runtime-card-title';
    title.textContent = entry.title || selected.id;
    detail.appendChild(title);

    const chips = document.createElement('div');
    chips.className = 'wandlight-loredeck-row-meta';
    chips.appendChild(createStatusPill(getEntryRelevance(entry), 'Lorecard relevance tier.'));
    chips.appendChild(createStatusPill(getEntryCategory(entry), 'Lorecard category/type.'));
    chips.appendChild(createStatusPill(selected.sourceFile || 'embedded', 'Source file for this Lorecard.'));
    if (pack?.type === 'bundled') chips.appendChild(createStatusPill('Read-only', 'Bundled Loredecks must be duplicated before editing.'));
    detail.appendChild(chips);

    const grid = document.createElement('div');
    grid.className = 'wandlight-loredeck-workbench-detail-grid';
    grid.appendChild(createKeyValue('ID', selected.id, 'Stable Lorecard machine ID.'));
    grid.appendChild(createKeyValue('Canon', getEntryCanonStatus(entry), 'Canon/AU/custom status.'));
    grid.appendChild(createKeyValue('Truth', entry.truthStatus || entry.truth || 'unset', 'Truth or reliability status.'));
    grid.appendChild(createKeyValue('Reveal', entry.revealPolicy || entry.reveal || 'unset', 'Reveal/knowledge policy.'));
    detail.appendChild(grid);

    const fact = document.createElement('div');
    fact.className = 'wandlight-loredeck-workbench-entry-text';
    fact.textContent = getEntryMainText(entry) || 'No Lorecard content available.';
    detail.appendChild(fact);

    const tags = getEntryTags(entry);
    if (tags.length) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'wandlight-loredeck-row-meta wandlight-loredeck-workbench-tags';
        for (const tag of tags.slice(0, 32)) tagWrap.appendChild(createStatusPill(tag, 'Lorecard tag.'));
        if (tags.length > 32) tagWrap.appendChild(createStatusPill(`+${tags.length - 32}`, 'Additional tags hidden in this compact view.'));
        detail.appendChild(tagWrap);
    }

    const contextText = getEntryContextSummary(entry);
    if (contextText) detail.appendChild(createKeyValue('Context Gate', contextText, 'Context activation gate for this Lorecard.'));

    if (pack?.type === 'bundled') {
        const actions = document.createElement('div');
        actions.className = 'wandlight-primary-actions';
        actions.appendChild(createButton('Duplicate to Edit', 'Create an editable Custom copy of this Bundled Loredeck.', () => {
            openDuplicateLoredeckDialog(pack);
        }, 'wandlight-primary-button'));
        detail.appendChild(actions);
    }
    return detail;
}

async function loadLoredeckWorkbenchRows(packId = loredeckWorkbenchPackId, options = {}) {
    const id = String(packId || '').trim();
    if (!id) return [];
    if (!options.force && loredeckWorkbenchCache.packId === id && loredeckWorkbenchCache.rows.length) return loredeckWorkbenchCache.rows;
    const button = options.button || null;
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Loading...';
    }
    loredeckWorkbenchCache = { packId: id, status: 'loading', error: '', loadedAt: 0, rows: [], source: null };
    renderLoredeckWorkbench();
    try {
        const pack = getWorkbenchPack(id);
        const registry = getLoredeckLibraryRegistry(getState());
        const source = await loadLoredeckSourceById(id, {
            registry,
            registryRecord: pack,
        });
        const rows = buildLoredeckWorkbenchRows(source);
        loredeckWorkbenchCache = {
            packId: id,
            status: 'loaded',
            error: '',
            loadedAt: Date.now(),
            rows,
            source,
        };
        ensureLoredeckWorkbenchSelection(rows);
        renderLoredeckWorkbench();
        if (!rows.length) toast(`${pack?.title || id} has no loadable Lorecards.`, 'warning');
        return rows;
    } catch (e) {
        loredeckWorkbenchCache = {
            packId: id,
            status: 'error',
            error: e?.message || 'Loredeck failed to load.',
            loadedAt: Date.now(),
            rows: [],
            source: null,
        };
        renderLoredeckWorkbench();
        toast(loredeckWorkbenchCache.error, 'error');
        return [];
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Reload Lorecards';
        }
    }
}

function buildLoredeckWorkbenchRows(source = {}) {
    const rows = [];
    const seen = new Set();
    for (const fileRecord of source.entryFiles || []) {
        const sourceFile = String(fileRecord?.file || '').trim() || 'embedded';
        const entries = getEntriesFromLoredeckFileRecord(fileRecord);
        for (const raw of entries) {
            const entry = normalizeLoredeckEntryForSchemaV3(raw);
            const id = String(entry?.id || '').trim();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            rows.push({
                id,
                entry,
                sourceFile,
                schemaVersion: fileRecord?.schemaVersion || source.manifest?.entrySchemaVersion || entry.schemaVersion || 3,
            });
        }
    }
    return rows.sort((a, b) => String(a.entry.title || a.id).localeCompare(String(b.entry.title || b.id)));
}

function getEntriesFromLoredeckFileRecord(fileRecord = {}) {
    if (Array.isArray(fileRecord.entries)) return fileRecord.entries;
    const json = fileRecord.json;
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.entries)) return json.entries;
    if (Array.isArray(json?.lorecards)) return json.lorecards;
    if (Array.isArray(json?.loreEntries)) return json.loreEntries;
    if (json && typeof json === 'object' && !Array.isArray(json) && (json.id || json.title || json.content || json.fact)) return [json];
    return [];
}

function ensureLoredeckWorkbenchSelection(rows = getFilteredLoredeckWorkbenchRows()) {
    if (!rows.length) {
        loredeckWorkbenchSelectedEntryId = '';
        return;
    }
    if (!rows.some(row => row.id === loredeckWorkbenchSelectedEntryId)) {
        loredeckWorkbenchSelectedEntryId = rows[0].id;
    }
}

function getFilteredLoredeckWorkbenchRows() {
    const query = String(loredeckWorkbenchQuery || '').trim().toLowerCase();
    return (loredeckWorkbenchCache.rows || []).filter(row => {
        const entry = row.entry || {};
        if (loredeckWorkbenchRelevanceFilter !== 'all' && getEntryRelevance(entry).toLowerCase() !== loredeckWorkbenchRelevanceFilter) return false;
        if (loredeckWorkbenchCategoryFilter !== 'all' && getEntryCategory(entry).toLowerCase() !== loredeckWorkbenchCategoryFilter) return false;
        if (!query) return true;
        return getLoredeckWorkbenchSearchText(row).includes(query);
    });
}

function getLoredeckWorkbenchSearchText(row = {}) {
    const entry = row.entry || {};
    return [
        row.id,
        row.sourceFile,
        entry.title,
        getEntryMainText(entry),
        getEntryCategory(entry),
        getEntryRelevance(entry),
        getEntryCanonStatus(entry),
        getEntryContextSummary(entry),
        ...getEntryTags(entry),
    ].filter(Boolean).join(' ').toLowerCase();
}

function getRelevanceFilterOptions() {
    return [
        ['all', 'All Relevance'],
        ['high', 'High'],
        ['normal', 'Normal'],
        ['low', 'Low'],
    ];
}

function getCategoryFilterOptions() {
    const categories = new Set();
    for (const row of loredeckWorkbenchCache.rows || []) {
        const category = getEntryCategory(row.entry).toLowerCase();
        if (category) categories.add(category);
    }
    return [
        ['all', 'All Types'],
        ...[...categories].sort().map(category => [category, humanizeScopeKey(category)]),
    ];
}

function getEntryRelevance(entry = {}) {
    const value = String(entry.relevance || entry.retrieval?.relevance || entry.priority || '').trim().toLowerCase();
    if (['high', 'normal', 'low'].includes(value)) return value;
    if (value === 'critical' || value === 'p1') return 'high';
    if (value === 'background' || value === 'p3') return 'low';
    return 'normal';
}

function getEntryCategory(entry = {}) {
    return String(entry.category || entry.type || entry.kind || entry.content?.category || 'other').trim() || 'other';
}

function getEntryCanonStatus(entry = {}) {
    return String(entry.canonStatus || entry.canon || entry.truthStatus || 'unset').trim() || 'unset';
}

function getEntryTags(entry = {}) {
    return Array.isArray(entry.tags) ? entry.tags.map(tag => String(tag || '').trim()).filter(Boolean) : [];
}

function getEntryMainText(entry = {}) {
    return String(
        entry.fact
        || entry.summary
        || entry.description
        || entry.content?.fact
        || entry.content?.injection
        || entry.content?.summary
        || entry.text
        || ''
    ).trim();
}

function getEntryContextSummary(entry = {}) {
    const context = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    const values = [
        context.label,
        context.scope,
        context.anchorId,
        context.validFromAnchor ? `from ${context.validFromAnchor}` : '',
        context.validToAnchor ? `to ${context.validToAnchor}` : '',
        Number.isFinite(Number(context.sortKeyFrom)) || Number.isFinite(Number(context.sortKeyTo))
            ? `${context.sortKeyFrom ?? '?'} -> ${context.sortKeyTo ?? '?'}`
            : '',
    ].map(value => String(value || '').trim()).filter(Boolean);
    return values.join(' | ');
}

function getSourceFileCount(source = {}) {
    return Array.isArray(source?.entryFiles) ? source.entryFiles.length : 0;
}

