import {
    getState,
    saveSettings,
    activateLoredeckCreatorJobAsync,
    getLoredeckCreatorProjectRegistry,
    getActiveLoredeckCreatorJob,
    updateLoredeckCreatorProject,
    clearLoredeckCreatorJob,
} from '../state/state-manager.js';
import { getCanonLoreDatabaseSync, loadCanonLoreDatabase } from '../context/canon-lore-db.js';
import { buildLoredeckCreatorProjectCardModels } from './loredeck-creator-projects.js';
import { createLoredeckJobProgressBar } from './loredeck-job-view.js';
import { buildFolderTree, getFolderPath } from './loredeck-library-index.js';
import { isLoredeckLibraryFolderDescendant, moveLoredecksToLibraryFolderPlacement } from './loredeck-library-service.js';
import {
    createLoredeckDeckVisual,
    createLoredeckLibraryEditableTitle,
    getLoredeckLibraryIndexForPacks,
    getLoredeckLibraryPackFolderId,
    getLoredeckLibraryStackStats,
    getMutableLoredeckLibraryRegistry,
    isLoredeckLibraryOpen,
    normalizeLoredeckLibraryInlineTitle,
    openLoredeckLibraryWindow,
    renderLoredeckLibraryOverlay,
} from './loredeck-library-panel.js';
import { formatRelativeHealthTime } from './loredeck-health-panel.js';
import {
    addTooltip,
    confirmAction,
    createButton,
    createEmptyMessage,
    createSectionHeader,
    createStatusPill,
    toast,
} from '../ui/runtime-ui-kit.js';

let loredecksTabDeps = {};

export function configureLoredecksTabPanel(deps = {}) {
    loredecksTabDeps = { ...loredecksTabDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = loredecksTabDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Loredecks tab dependency is not configured: ${name}`);
}

function getLoredeckStack(state) { return dep('getLoredeckStack', () => [])(state); }
function getLoredeckLibrary(state) { return dep('getLoredeckLibrary', () => [])(state); }
function refreshLorePanel(options) { return dep('refreshLorePanel', () => {})(options); }
function refreshPanelBody(options) { return dep('refreshPanelBody', () => {})(options); }
function refreshHeader() { return dep('refreshHeader', () => {})(); }
function markTourTarget(el, target) { return dep('markTourTarget', value => value)(el, target); }
function createCollapsibleSection(...args) { return dep('createCollapsibleSection')(...args); }
function installLoredeckBundleFromFile() { return dep('installLoredeckBundleFromFile', () => {})(); }
function openLoredeckCreatorWorkbench() { return dep('openLoredeckCreatorWorkbench', () => {})(); }
function isBasicExperienceMode() { return dep('isBasicExperience', () => false)() === true; }
function getLoredeckDefinition(packId) { return dep('getLoredeckDefinition', () => null)(packId); }
function isGeneratedLoredeckPack(pack) { return dep('isGeneratedLoredeckPack', () => false)(pack); }
function getGeneratedLoredeckExportReadiness(pack, health, creatorJob) { return dep('getGeneratedLoredeckExportReadiness', () => null)(pack, health, creatorJob); }
function getLoredeckCreatorActiveGenerationByJobIdMap() { return dep('getLoredeckCreatorActiveGenerationByJobIdMap', () => ({}))(); }
function getLoredeckCreatorBriefCache() { return dep('getLoredeckCreatorBriefCache', () => ({}))(); }
function getActiveLoredeckCreatorGeneration(job) { return dep('getActiveLoredeckCreatorGeneration', () => null)(job); }
function refreshLoredeckCreatorWorkbenchBody(options) { return dep('refreshLoredeckCreatorWorkbenchBody', () => false)(options); }
function recoverLoredeckCreatorInterruptedActiveGeneration(job, options) { return dep('recoverLoredeckCreatorInterruptedActiveGeneration', value => ({ job: value }))(job, options); }
function attachLoredeckCreatorLiveGeneration(job) { return dep('attachLoredeckCreatorLiveGeneration', value => value)(job); }
function selectLoredeckForDetails(packId, options) { return dep('selectLoredeckForDetails', () => {})(packId, options); }
function setLoredeckCreatorDraftInputs(values = {}) { return dep('setLoredeckCreatorDraftInputs', () => {})(values); }
function clearLoredeckCreatorDraftInputs() { return dep('clearLoredeckCreatorDraftInputs', () => {} )(); }

const loredeckCreatorBriefCache = {
    set(key, value) { return dep('setLoredeckCreatorBriefCacheEntry', () => {})(key, value); },
    delete(key) { return dep('deleteLoredeckCreatorBriefCacheEntry', () => false)(key); },
};

let loredeckCreatorProjectQuery = '';
let loredeckCreatorProjectFilter = 'all';
let loredeckCreatorProjectFolderFilter = 'all';
let loredeckCreatorProjectSelectedIds = new Set();

export function renderLoredecksTab(container, state) {
    const basic = isBasicExperienceMode();
    const canonDb = getCanonLoreDatabaseSync();
    if (!canonDb) {
        loadCanonLoreDatabase()
            .then(() => refreshLorePanel({ preserveScroll: true }))
            .catch(e => console.warn('[Saga] Loredeck health load failed:', e));
    }
    const health = canonDb?.health || null;

    container.appendChild(createSectionHeader(
        'Loredecks',
        'Source decks loaded for canon suggestions, relevance, and Saga deck editing.'
    ));
    const librarySection = createCollapsibleSection(
        'loredecks.libraryLaunch',
        'Loredeck Library',
        getLoredeckLibraryLaunchSummary(state, canonDb, health),
        true,
        createLoredeckLibraryLaunchCard(state, canonDb, health),
        {
            tooltip: basic
                ? 'Open the fullscreen Loredeck Library or import a deck package.'
                : 'Open the fullscreen Loredeck Library, import a deck package, or start the Creator wizard.',
        }
    );
    markTourTarget(librarySection, 'loredecks.library.launch');
    container.appendChild(librarySection);

    if (!basic) {
        const projectModels = getLoredeckCreatorProjectShelfModels(state);
        const creatorSection = createCollapsibleSection(
            'loredecks.creatorProjects',
            'In-Progress Creator Projects',
            projectModels.length ? `${projectModels.length} unfinished` : 'none',
            false,
            () => createLoredeckCreatorProjectShelf(state, projectModels),
            {
                tooltip: 'Resume unfinished Generated Lorepacks from the staged Creator.',
            }
        );
        markTourTarget(creatorSection, 'loredecks.creator.projects');
        container.appendChild(creatorSection);
    }
}

function getLoredeckLibraryLaunchSummary(state = getState(), canonDb = null, health = null) {
    const stack = getLoredeckStack(state);
    const library = getLoredeckLibrary(state);
    const stats = getLoredeckLibraryStackStats(stack, library, canonDb, health);
    return `${library.length} decks | ${stats.activeCount} active | ${stats.entryCount} active Lorecards`;
}

function createLoredeckLibraryLaunchCard(state = getState(), canonDb = null, health = null) {
    const basic = isBasicExperienceMode();
    const stack = getLoredeckStack(state);
    const library = getLoredeckLibrary(state);
    const stats = getLoredeckLibraryStackStats(stack, library, canonDb, health);

    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-loredeck-library-launch-card';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-library-launch-main';
    const title = document.createElement('h4');
    title.textContent = 'Loredeck Library';
    main.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Open the fullscreen Library to move Loredecks from storage into the active session stack and set priority.';
    main.appendChild(help);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(`${library.length} decks`, 'Total Loredecks available in the Library.', { kind: 'count' }));
    chips.appendChild(createStatusPill(`${stats.activeCount} active`, 'Enabled Loredecks currently participating in retrieval, including folder groups.', { tone: stats.activeCount ? 'success' : 'muted', kind: 'count' }));
    chips.appendChild(createStatusPill(`${stats.entryCount} active Lorecards`, 'Approximate Lorecards from enabled stack decks.', { kind: 'count' }));
    chips.appendChild(createStatusPill(`${stats.errorCount} errors`, 'Current stack Pack Health error count.', { tone: stats.errorCount ? 'danger' : 'muted', kind: 'severity' }));
    chips.appendChild(createStatusPill(`${stats.warningCount} warnings`, 'Current stack Pack Health warning count.', { tone: stats.warningCount ? 'warning' : 'muted', kind: 'severity' }));
    main.appendChild(chips);
    card.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-loredeck-library-launch-actions';
    actions.appendChild(markTourTarget(createButton('Open Loredeck Library', 'Open the fullscreen Loredeck Library and active stack manager.', () => {
        openLoredeckLibraryWindow();
    }, 'saga-primary-button'), 'loredecks.library.open'));
    actions.appendChild(markTourTarget(createButton('Import Deck', 'Import a Saga Loredeck zip package into the Library.', () => {
        installLoredeckBundleFromFile();
    }), 'loredecks.import'));
    if (!basic) {
        actions.appendChild(markTourTarget(createButton('Create Deck', 'Open the staged Loredeck Creator wizard.', () => {
            openLoredeckCreatorWorkbench();
        }), 'loredecks.creator.open'));
    }
    card.appendChild(actions);
    return card;
}

function getLoredeckCreatorProjectShelfModels(state = getState()) {
    const registry = getLoredeckCreatorProjectRegistry();
    const library = getLoredeckLibrary(state);
    const libraryIndex = getLoredeckLibraryIndexForPacks(state, library);
    const packsById = {};
    const readinessByPackId = {};
    for (const pack of library) {
        if (!pack?.packId) continue;
        packsById[pack.packId] = pack;
    }
    for (const job of Object.values(registry.jobs || {})) {
        const packId = String(job?.generatedPackId || job?.brief?.packId || '').trim();
        if (!packId) continue;
        const pack = packsById[packId] || getLoredeckDefinition(packId);
        if (!pack) continue;
        packsById[packId] = pack;
        if (isGeneratedLoredeckPack(pack)) {
            readinessByPackId[packId] = getGeneratedLoredeckExportReadiness(pack, null, job);
        }
    }
    const models = buildLoredeckCreatorProjectCardModels(registry, {
        packsById,
        readinessByPackId,
        activeGenerationByJobId: getLoredeckCreatorActiveGenerationByJobIdMap(),
    });
    return models.map(model => {
        const pack = model.generatedPackId ? packsById[model.generatedPackId] : null;
        const folderId = String((pack ? getLoredeckLibraryPackFolderId(pack, libraryIndex) : '') || model.folderId || '').trim();
        const folderPath = folderId ? getFolderPath(folderId, libraryIndex) : [];
        return {
            ...model,
            folderId,
            folderLabel: getLoredeckCreatorProjectFolderLabel(folderId, libraryIndex),
            folderPathText: folderPath.join(' > ') || (folderId ? `Missing folder: ${folderId}` : 'Unfiled'),
        };
    });
}

function createLoredeckCreatorProjectShelf(state = getState(), presetModels = null) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-loredeck-creator-project-shelf';
    renderLoredeckCreatorProjectShelfContent(card, state, presetModels);
    return card;
}

function renderLoredeckCreatorProjectShelfContent(card, state = getState(), presetModels = null) {
    const allModels = Array.isArray(presetModels) ? presetModels : getLoredeckCreatorProjectShelfModels(state);
    const libraryIndex = getLoredeckLibraryIndexForPacks(state, getLoredeckLibrary(state));
    normalizeLoredeckCreatorProjectSelection(allModels);
    const models = getFilteredLoredeckCreatorProjectModels(allModels, libraryIndex);
    const activeJob = getActiveLoredeckCreatorJob(state);
    card.replaceChildren();
    const header = document.createElement('div');
    header.className = 'saga-loredeck-creator-project-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-loredeck-creator-project-title-wrap';
    const title = document.createElement('h4');
    title.textContent = 'In Progress';
    titleWrap.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Resume unfinished Generated Loredecks from the staged Creator.';
    titleWrap.appendChild(help);
    header.appendChild(titleWrap);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta saga-loredeck-creator-project-meta';
    const generatedCount = allModels.filter(model => model.hasGeneratedPack).length;
    const reviewCount = allModels.filter(model => model.nextAction?.tone === 'review' || model.stage?.tone === 'review').length;
    const selectedCount = getLoredeckCreatorProjectSelectedIds(allModels).length;
    meta.appendChild(createStatusPill(`${allModels.length} unfinished`, 'Unfinished Loredeck Creator projects saved across chats.', { kind: 'count' }));
    if (generatedCount) meta.appendChild(createStatusPill(`${generatedCount} generated`, 'Projects with a Generated Loredeck shell already created.', { tone: 'source', kind: 'count' }));
    if (reviewCount) meta.appendChild(createStatusPill(`${reviewCount} needs review`, 'Projects waiting on manual review before continuing.', { tone: 'review', kind: 'count' }));
    if (selectedCount) meta.appendChild(createStatusPill(`${selectedCount} selected`, 'Creator projects selected for bulk shelf actions.', { tone: 'selected', kind: 'count' }));
    header.appendChild(meta);
    card.appendChild(header);

    if (allModels.length) card.appendChild(createLoredeckCreatorProjectControls(allModels, models, card, libraryIndex));

    if (!allModels.length) {
        const empty = createEmptyMessage('No unfinished Creator projects.');
        card.appendChild(empty);
        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions';
        actions.appendChild(createButton('Open Creator Wizard', 'Start or resume the active Loredeck Creator wizard.', () => {
            openLoredeckCreatorWorkbench();
        }, 'saga-primary-button'));
        card.appendChild(actions);
        return;
    }

    if (!models.length) {
        card.appendChild(createEmptyMessage('No Creator projects match the current search and filter.'));
        return;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-creator-project-list';
    for (const model of models.slice(0, 20)) {
        list.appendChild(createLoredeckCreatorProjectCard(model, {
            active: activeJob?.jobId === model.jobId,
            selected: loredeckCreatorProjectSelectedIds.has(model.jobId),
        }));
    }
    card.appendChild(list);

    if (models.length > 20) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help saga-compact-help';
        more.textContent = `Showing 20 of ${models.length} unfinished Creator projects.`;
        card.appendChild(more);
    }
}

const LOREDECK_CREATOR_PROJECT_FILTERS = Object.freeze([
    ['all', 'All', 'Show every unfinished Creator project.'],
    ['review', 'Needs Review', 'Show projects waiting on manual review.'],
    ['generated', 'Generated', 'Show projects with a Generated Loredeck shell.'],
    ['draft', 'Draft Only', 'Show projects that have not created a Generated Loredeck shell yet.'],
    ['blocked', 'Blocked', 'Show projects with blocking errors or readiness blockers.'],
    ['running', 'Running', 'Show projects with an active generation in progress.'],
]);

function getLoredeckCreatorProjectFolderLabel(folderId = '', libraryIndex = getLoredeckLibraryIndexForPacks()) {
    const id = String(folderId || '').trim();
    if (!id) return 'Unfiled';
    const path = getFolderPath(id, libraryIndex);
    if (path.length) return path.join(' > ');
    return 'Missing folder';
}

function getLoredeckCreatorProjectSearchText(model = {}) {
    return [
        model.title,
        model.subtitle,
        model.description,
        model.fandom,
        model.scope,
        model.granularity,
        model.stage?.label,
        model.nextAction?.label,
        model.folderLabel,
        model.folderPathText,
        model.generatedPackId,
        model.jobId,
        ...(model.chips || []).map(chip => chip.label),
    ].filter(Boolean).join(' ').toLowerCase();
}

function matchesLoredeckCreatorProjectFilter(model = {}, filter = loredeckCreatorProjectFilter) {
    if (filter === 'review') return model.nextAction?.tone === 'review' || model.stage?.tone === 'review' || model.counts?.pendingChangeCount || model.counts?.draftChangeCount;
    if (filter === 'generated') return model.hasGeneratedPack === true;
    if (filter === 'draft') return model.hasGeneratedPack !== true;
    if (filter === 'blocked') return model.stage?.isBlocked === true || model.counts?.blockerCount || model.counts?.errorCount;
    if (filter === 'running') return model.stage?.isRunning === true;
    return true;
}

function matchesLoredeckCreatorProjectFolderFilter(model = {}, libraryIndex = getLoredeckLibraryIndexForPacks()) {
    const filter = String(loredeckCreatorProjectFolderFilter || 'all').trim() || 'all';
    if (filter === 'all') return true;
    const folderId = String(model.folderId || '').trim();
    if (filter === 'unfiled') return !folderId;
    return !!folderId && isLoredeckLibraryFolderDescendant(folderId, filter, libraryIndex);
}

function getFilteredLoredeckCreatorProjectModels(models = [], libraryIndex = getLoredeckLibraryIndexForPacks()) {
    const query = String(loredeckCreatorProjectQuery || '').trim().toLowerCase();
    return (models || []).filter(model => {
        if (!matchesLoredeckCreatorProjectFilter(model)) return false;
        if (!matchesLoredeckCreatorProjectFolderFilter(model, libraryIndex)) return false;
        if (!query) return true;
        return getLoredeckCreatorProjectSearchText(model).includes(query);
    });
}

function normalizeLoredeckCreatorProjectSelection(models = []) {
    const validIds = new Set((models || []).map(model => model.jobId).filter(Boolean));
    loredeckCreatorProjectSelectedIds = new Set([...loredeckCreatorProjectSelectedIds].filter(id => validIds.has(id)));
}

function getLoredeckCreatorProjectSelectedIds(models = getLoredeckCreatorProjectShelfModels()) {
    const validIds = new Set((models || []).map(model => model.jobId).filter(Boolean));
    return [...loredeckCreatorProjectSelectedIds].filter(id => validIds.has(id));
}

function createLoredeckCreatorProjectControls(allModels = [], filteredModels = [], shelfCard = null, libraryIndex = getLoredeckLibraryIndexForPacks()) {
    const controls = document.createElement('div');
    controls.className = 'saga-loredeck-creator-project-controls';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'text_pole saga-loredeck-creator-project-search';
    search.placeholder = 'Search projects...';
    search.value = loredeckCreatorProjectQuery;
    addTooltip(search, 'Search in-progress Creator projects by title, fandom, scope, stage, or linked Generated Loredeck.');
    search.addEventListener('click', event => event.stopPropagation());
    search.addEventListener('input', () => {
        loredeckCreatorProjectQuery = search.value;
        const target = shelfCard || controls.closest('.saga-loredeck-creator-project-shelf');
        if (target) renderLoredeckCreatorProjectShelfContent(target, getState());
        const next = document.querySelector('.saga-loredeck-creator-project-search');
        if (next) {
            next.focus();
            const end = next.value.length;
            next.setSelectionRange?.(end, end);
        }
    });
    controls.appendChild(search);

    const filter = document.createElement('select');
    filter.className = 'text_pole saga-loredeck-creator-project-filter';
    addTooltip(filter, 'Filter the in-progress Creator shelf.');
    for (const [value, label, tooltip] of LOREDECK_CREATOR_PROJECT_FILTERS) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        option.title = tooltip;
        filter.appendChild(option);
    }
    filter.value = LOREDECK_CREATOR_PROJECT_FILTERS.some(([value]) => value === loredeckCreatorProjectFilter)
        ? loredeckCreatorProjectFilter
        : 'all';
    filter.addEventListener('click', event => event.stopPropagation());
    filter.addEventListener('change', () => {
        loredeckCreatorProjectFilter = filter.value || 'all';
        const target = shelfCard || controls.closest('.saga-loredeck-creator-project-shelf');
        if (target) renderLoredeckCreatorProjectShelfContent(target, getState());
    });
    controls.appendChild(filter);

    const folderFilter = document.createElement('select');
    folderFilter.className = 'text_pole saga-loredeck-creator-project-folder-filter';
    addTooltip(folderFilter, 'Filter Creator projects by Library folder. Folder filters include nested subfolders.');
    appendLoredeckCreatorProjectFolderFilterOptions(folderFilter, allModels, libraryIndex);
    folderFilter.value = [...folderFilter.options].some(option => option.value === loredeckCreatorProjectFolderFilter)
        ? loredeckCreatorProjectFolderFilter
        : 'all';
    folderFilter.addEventListener('click', event => event.stopPropagation());
    folderFilter.addEventListener('change', () => {
        loredeckCreatorProjectFolderFilter = folderFilter.value || 'all';
        const target = shelfCard || controls.closest('.saga-loredeck-creator-project-shelf');
        if (target) renderLoredeckCreatorProjectShelfContent(target, getState());
    });
    controls.appendChild(folderFilter);

    controls.appendChild(createLoredeckCreatorProjectBulkToolbar(allModels, filteredModels, shelfCard, libraryIndex));
    return controls;
}

function appendLoredeckCreatorProjectFolderFilterOptions(select, models = [], libraryIndex = getLoredeckLibraryIndexForPacks()) {
    if (!select) return;
    const all = document.createElement('option');
    all.value = 'all';
    all.textContent = 'All folders';
    select.appendChild(all);

    const unfiledCount = (models || []).filter(model => !String(model.folderId || '').trim()).length;
    const unfiled = document.createElement('option');
    unfiled.value = 'unfiled';
    unfiled.textContent = `Unfiled${unfiledCount ? ` (${unfiledCount})` : ''}`;
    select.appendChild(unfiled);

    const countForFolder = folderId => (models || []).filter(model => {
        const id = String(model.folderId || '').trim();
        return id && isLoredeckLibraryFolderDescendant(id, folderId, libraryIndex);
    }).length;

    const appendFolder = (folder, depth = 0) => {
        if (!folder?.id) return;
        const count = countForFolder(folder.id);
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = `${'\u00a0\u00a0'.repeat(Math.max(0, depth))}${folder.title || folder.id}${count ? ` (${count})` : ''}`;
        select.appendChild(option);
        for (const child of folder.children || []) appendFolder(child, depth + 1);
    };
    for (const folder of buildFolderTree(libraryIndex)) appendFolder(folder, 0);
}

function appendLoredeckCreatorProjectMoveOptions(select, libraryIndex = getLoredeckLibraryIndexForPacks()) {
    if (!select) return;
    const unfiled = document.createElement('option');
    unfiled.value = 'unfiled';
    unfiled.textContent = 'Move to: Unfiled';
    select.appendChild(unfiled);

    const appendFolder = (folder, depth = 0) => {
        if (!folder?.id) return;
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = `${'\u00a0\u00a0'.repeat(Math.max(0, depth))}${folder.title || folder.id}`;
        select.appendChild(option);
        for (const child of folder.children || []) appendFolder(child, depth + 1);
    };
    for (const folder of buildFolderTree(libraryIndex)) appendFolder(folder, 0);
}

function createLoredeckCreatorProjectBulkToolbar(allModels = [], filteredModels = [], shelfCard = null, libraryIndex = getLoredeckLibraryIndexForPacks()) {
    const toolbar = document.createElement('div');
    toolbar.className = 'saga-loredeck-creator-project-bulk';
    const selectedIds = getLoredeckCreatorProjectSelectedIds(allModels);
    const visibleIds = (filteredModels || []).map(model => model.jobId).filter(Boolean);
    const selectedVisibleCount = visibleIds.filter(id => loredeckCreatorProjectSelectedIds.has(id)).length;
    const summary = document.createElement('span');
    summary.className = 'saga-loredeck-creator-project-selection-summary';
    summary.textContent = `${selectedIds.length} selected${selectedVisibleCount !== selectedIds.length ? ` (${selectedVisibleCount} visible)` : ''}`;
    toolbar.appendChild(summary);

    const selectVisible = createButton('Select Visible', 'Select every Creator project currently visible after search and filter.', () => {
        loredeckCreatorProjectSelectedIds = new Set(visibleIds);
        const target = shelfCard || toolbar.closest('.saga-loredeck-creator-project-shelf');
        if (target) renderLoredeckCreatorProjectShelfContent(target, getState());
    });
    selectVisible.disabled = !visibleIds.length;
    toolbar.appendChild(selectVisible);

    const clear = createButton('Clear', 'Clear the Creator project selection.', () => {
        loredeckCreatorProjectSelectedIds = new Set();
        const target = shelfCard || toolbar.closest('.saga-loredeck-creator-project-shelf');
        if (target) renderLoredeckCreatorProjectShelfContent(target, getState());
    });
    clear.disabled = !selectedIds.length;
    toolbar.appendChild(clear);

    const moveSelect = document.createElement('select');
    moveSelect.className = 'text_pole saga-loredeck-creator-project-move-select';
    addTooltip(moveSelect, selectedIds.length ? 'Choose a folder target for selected Creator projects.' : 'Select Creator projects before moving them.');
    appendLoredeckCreatorProjectMoveOptions(moveSelect, libraryIndex);
    moveSelect.value = 'unfiled';
    moveSelect.disabled = !selectedIds.length;
    moveSelect.addEventListener('click', event => event.stopPropagation());
    toolbar.appendChild(moveSelect);

    const moveButton = createButton('Move', selectedIds.length ? 'Move selected Creator projects and linked Generated Loredecks to the chosen folder.' : 'Select Creator projects before moving them to a folder.', () => {
        moveLoredeckCreatorProjectsToFolder(selectedIds, moveSelect.value || 'unfiled', allModels);
    });
    moveButton.disabled = !selectedIds.length;
    toolbar.appendChild(moveButton);

    const deleteSelected = createButton(selectedIds.length ? `Delete Selected (${selectedIds.length})` : 'Delete Selected', 'Delete selected Creator projects after confirmation.', async () => {
        await deleteSelectedLoredeckCreatorProjectsWithConfirm(allModels);
    }, 'saga-loredeck-creator-project-delete');
    deleteSelected.disabled = !selectedIds.length;
    toolbar.appendChild(deleteSelected);
    return toolbar;
}

function setLoredeckCreatorProjectSelected(jobId = '', selected = false) {
    const id = String(jobId || '').trim();
    if (!id) return;
    const next = new Set(loredeckCreatorProjectSelectedIds);
    if (selected) next.add(id);
    else next.delete(id);
    loredeckCreatorProjectSelectedIds = next;
    const shelf = document.querySelector('.saga-loredeck-creator-project-shelf');
    if (shelf) renderLoredeckCreatorProjectShelfContent(shelf, getState());
}

function moveLoredeckCreatorProjectsToFolder(jobIds = [], folderId = 'unfiled', models = getLoredeckCreatorProjectShelfModels()) {
    const ids = Array.from(new Set((jobIds || []).map(id => String(id || '').trim()).filter(Boolean)));
    if (!ids.length) {
        toast('Select one or more Creator projects first.', 'warning');
        return false;
    }
    const state = getState();
    const library = getLoredeckLibrary(state);
    const libraryIndex = getLoredeckLibraryIndexForPacks(state, library);
    const rawFolderId = String(folderId || '').trim();
    const targetFolderId = rawFolderId === 'unfiled' ? '' : rawFolderId;
    if (targetFolderId && !(libraryIndex.folders || []).some(folder => folder.id === targetFolderId)) {
        toast('That Library folder is no longer available.', 'warning');
        return false;
    }

    const modelById = new Map((models || []).map(model => [model.jobId, model]));
    const selectedModels = ids.map(id => modelById.get(id)).filter(Boolean);
    if (!selectedModels.length) {
        toast('Selected Creator projects are no longer available.', 'warning');
        return false;
    }

    let movedProjects = 0;
    let lastUpdatedJob = null;
    for (const model of selectedModels) {
        const result = updateLoredeckCreatorProject(model.jobId, { folderId: targetFolderId }, { syncPrompt: false });
        if (result.ok) {
            movedProjects += 1;
            lastUpdatedJob = result.job;
        }
    }
    if (!movedProjects) {
        toast('Creator projects could not be moved.', 'error');
        return false;
    }

    const libraryPackIds = new Set((library || []).map(pack => pack.packId).filter(Boolean));
    const linkedPackIds = Array.from(new Set(selectedModels.map(model => model.generatedPackId).filter(id => id && libraryPackIds.has(id))));
    if (linkedPackIds.length) {
        const { settings, registry } = getMutableLoredeckLibraryRegistry();
        const placement = moveLoredecksToLibraryFolderPlacement({
            packIds: linkedPackIds,
            folderId: rawFolderId || 'unfiled',
            library,
            libraryIndex,
            registry,
        });
        if (placement.ok) {
            settings.loredeckLibrary = placement.registry;
            saveSettings(settings);
        } else if (placement.error) {
            toast(placement.error, 'warning');
        }
    }

    const cached = getLoredeckCreatorBriefCache();
    if (cached?.jobId && ids.includes(cached.jobId)) {
        loredeckCreatorBriefCache.set('current', {
            ...cached,
            ...(lastUpdatedJob?.jobId === cached.jobId ? lastUpdatedJob : {}),
            folderId: targetFolderId,
            updatedAt: Date.now(),
        });
    }
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    if (isLoredeckLibraryOpen()) renderLoredeckLibraryOverlay();
    return movedProjects > 0;
}

function createLoredeckCreatorProjectCard(model = {}, options = {}) {
    const card = document.createElement('div');
    card.className = 'saga-loredeck-creator-project-card';
    if (options.active) card.classList.add('saga-loredeck-creator-project-card-active');
    if (options.selected) card.classList.add('saga-loredeck-creator-project-card-selected');
    addTooltip(card, `Open ${model.title || 'this Creator project'}.`);
    const open = () => openLoredeckCreatorProject(model.jobId);
    card.addEventListener('click', open);

    const visualPack = model.generatedPack || {
        packId: model.generatedPackId || model.jobId || model.id,
        title: model.title || 'Creator Project',
    };
    card.appendChild(createLoredeckDeckVisual(visualPack, 'saga-loredeck-library-monogram saga-loredeck-creator-project-visual'));

    const main = document.createElement('div');
    main.className = 'saga-loredeck-creator-project-main';

    const top = document.createElement('div');
    top.className = 'saga-loredeck-creator-project-topline';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-creator-project-title';
    title.appendChild(createLoredeckLibraryEditableTitle({
        value: model.title || 'Untitled Creator Project',
        fallback: model.title || 'Untitled Creator Project',
        kind: 'Creator project',
        editable: !!model.jobId,
        onCommit: nextTitle => renameLoredeckCreatorProjectTitle(model.jobId, nextTitle),
    }));
    top.appendChild(title);
    const stage = createStatusPill(model.stage?.label || 'Intake', 'Current Creator project stage.', {
        tone: model.stage?.tone || 'neutral',
        kind: 'status',
        className: 'saga-loredeck-creator-project-stage',
    });
    top.appendChild(stage);
    main.appendChild(top);

    const subtitle = document.createElement('div');
    subtitle.className = 'saga-loredeck-creator-project-subtitle';
    subtitle.textContent = model.subtitle || model.description || '';
    main.appendChild(subtitle);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta';
    chips.appendChild(createStatusPill(model.folderLabel || 'Unfiled', model.folderPathText ? `Library folder: ${model.folderPathText}.` : 'Creator project folder.', { kind: 'source', tone: model.folderPathText ? 'source' : 'muted' }));
    for (const chip of model.chips || []) {
        chips.appendChild(createStatusPill(chip.label, chip.tooltip, { tone: chip.tone, kind: chip.label?.match(/\\d/) ? 'count' : 'status' }));
    }
    main.appendChild(chips);

    main.appendChild(createLoredeckJobProgressBar(model.progress, {
        className: 'saga-loredeck-creator-project-progress',
        tooltip: percent => `${percent}% through the staged Creator workflow.`,
    }));

    const footer = document.createElement('div');
    footer.className = 'saga-loredeck-creator-project-footer';
    const updated = document.createElement('span');
    updated.textContent = model.updatedAt ? `Updated ${formatRelativeHealthTime(model.updatedAt)}` : 'Not updated';
    footer.appendChild(updated);
    const counts = [];
    if (model.counts?.acceptedEntryCount) counts.push(`${model.counts.acceptedEntryCount} accepted`);
    if (model.counts?.entryRemainingCount) counts.push(`${model.counts.entryRemainingCount} remaining`);
    if (model.counts?.lorecardCount) counts.push(`${model.counts.lorecardCount} Lorecards`);
    const countText = document.createElement('span');
    countText.textContent = counts.join(' | ');
    footer.appendChild(countText);
    main.appendChild(footer);
    card.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-creator-project-actions';
    const select = createButton(options.selected ? 'Selected' : 'Select', options.selected ? 'Remove this Creator project from the bulk selection.' : 'Select this Creator project for bulk shelf actions.', () => {
        setLoredeckCreatorProjectSelected(model.jobId, !options.selected);
    }, options.selected ? 'saga-loredeck-creator-project-select-active' : 'saga-loredeck-creator-project-select');
    actions.appendChild(select);
    actions.appendChild(createButton(model.nextAction?.label || 'Resume', model.nextAction?.tooltip || 'Open this Creator project.', () => {
        openLoredeckCreatorProject(model.jobId);
    }, 'saga-primary-button'));
    if (model.generatedPackId) {
        actions.appendChild(createButton('Library', 'Open the linked Generated Loredeck in the Library.', () => {
            selectLoredeckForDetails(model.generatedPackId, { refresh: false });
            openLoredeckLibraryWindow();
        }));
    }
    actions.appendChild(createButton('Delete', 'Delete this saved Creator project. Linked Generated Loredecks stay in the Library.', async () => {
        await deleteLoredeckCreatorProjectWithConfirm(model);
    }, 'saga-loredeck-creator-project-delete'));
    card.appendChild(actions);
    return card;
}

function renameLoredeckCreatorProjectTitle(jobId = '', title = '') {
    const id = String(jobId || '').trim();
    const cleanTitle = normalizeLoredeckLibraryInlineTitle(title, 160);
    if (!id || !cleanTitle) {
        toast('Creator project title is required.', 'warning');
        return false;
    }
    const result = updateLoredeckCreatorProject(id, { projectTitle: cleanTitle }, { syncPrompt: false });
    if (!result.ok) {
        toast(result.error || 'Creator project could not be renamed.', 'error');
        return false;
    }
    const cached = getLoredeckCreatorBriefCache();
    if (cached?.jobId === id) loredeckCreatorBriefCache.set('current', { ...cached, projectTitle: cleanTitle, updatedAt: result.job.updatedAt });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    return true;
}

async function deleteLoredeckCreatorProjectWithConfirm(model = {}) {
    const jobId = String(model.jobId || model.id || '').trim();
    if (!jobId) {
        toast('Creator project could not be found.', 'error');
        return false;
    }
    const title = model.title || 'this Creator project';
    const linkedText = model.generatedPackId
        ? ` The linked Generated Loredeck "${model.generatedPack?.title || model.generatedPackId}" will stay in the Library.`
        : '';
    const ok = await confirmAction(
        'Delete Creator project?',
        `Delete "${title}" from the in-progress Creator shelf? This removes the saved generation workflow and cannot be undone.${linkedText}`
    );
    if (!ok) return false;
    const activeGeneration = getActiveLoredeckCreatorGeneration(getLoredeckCreatorBriefCache());
    if (activeGeneration?.id && getLoredeckCreatorBriefCache()?.jobId === jobId) {
        toast('Cancel the running Creator generation before deleting this project.', 'warning');
        return false;
    }
    const result = clearLoredeckCreatorJob(jobId, { syncPrompt: false });
    if (!result.ok) {
        toast(result.error || 'Creator project could not be deleted.', 'error');
        return false;
    }
    const cached = getLoredeckCreatorBriefCache();
    if (cached?.jobId === jobId) {
        loredeckCreatorBriefCache.delete('current');
        clearLoredeckCreatorDraftInputs();
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: false });
    }
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    return true;
}

async function deleteSelectedLoredeckCreatorProjectsWithConfirm(models = []) {
    const selectedIds = getLoredeckCreatorProjectSelectedIds(models);
    if (!selectedIds.length) {
        toast('Select one or more Creator projects first.', 'warning');
        return false;
    }
    const selectedModels = selectedIds
        .map(id => (models || []).find(model => model.jobId === id))
        .filter(Boolean);
    const runningActive = selectedModels.find(model => {
        if (getLoredeckCreatorBriefCache()?.jobId !== model.jobId) return false;
        return !!getActiveLoredeckCreatorGeneration(getLoredeckCreatorBriefCache())?.id;
    });
    if (runningActive) {
        toast(`Cancel the running Creator generation for ${runningActive.title || runningActive.jobId} before deleting selected projects.`, 'warning');
        return false;
    }
    const listed = selectedModels.slice(0, 6).map(model => `- ${model.title || model.jobId}`).join('\n');
    const extra = selectedModels.length > 6 ? `\n- +${selectedModels.length - 6} more` : '';
    const linkedCount = selectedModels.filter(model => model.generatedPackId).length;
    const linkedText = linkedCount
        ? `\n\n${linkedCount} linked Generated Loredeck${linkedCount === 1 ? '' : 's'} will stay in the Library.`
        : '';
    const ok = await confirmAction(
        `Delete ${selectedModels.length} Creator project${selectedModels.length === 1 ? '' : 's'}?`,
        `This removes the saved generation workflow for:\n${listed}${extra}${linkedText}\n\nThis cannot be undone.`
    );
    if (!ok) return false;
    let deleted = 0;
    for (const id of selectedIds) {
        const result = clearLoredeckCreatorJob(id, { syncPrompt: false });
        if (result.ok) deleted += 1;
    }
    const cached = getLoredeckCreatorBriefCache();
    if (cached?.jobId && selectedIds.includes(cached.jobId)) {
        loredeckCreatorBriefCache.delete('current');
        clearLoredeckCreatorDraftInputs();
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: false });
    }
    loredeckCreatorProjectSelectedIds = new Set();
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    return deleted > 0;
}

async function openLoredeckCreatorProject(jobId = '') {
    let result;
    try {
        result = await activateLoredeckCreatorJobAsync(jobId, { syncPrompt: false });
    } catch (error) {
        result = { ok: false, error: error?.message || String(error || 'Creator project could not be opened.') };
    }
    if (!result.ok || !result.job) {
        toast(result.error || 'Creator project could not be opened.', 'error');
        return false;
    }
    const recovered = recoverLoredeckCreatorInterruptedActiveGeneration(result.job, {
        toast: true,
        context: 'project_open',
    });
    const job = attachLoredeckCreatorLiveGeneration(recovered.job || result.job);
    loredeckCreatorBriefCache.set('current', job);
    setLoredeckCreatorDraftInputs({
        fandom: job.fandom || job.brief?.fandom || '',
        scope: job.scope || job.brief?.scope || '',
        granularity: job.granularity || job.brief?.granularity || 'focused',
        notes: job.notes || '',
    });
    openLoredeckCreatorWorkbench();
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    return true;
}
