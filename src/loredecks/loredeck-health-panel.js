import {
    addTooltip,
    createButton,
    createEmptyMessage,
    createKeyValue,
    createStatusPill,
    humanizeScopeKey,
    toast,
    wireOverlayBackdropClose,
} from '../ui/runtime-ui-kit.js';
import {
    redactDiagnosticValue,
    stringifyRedactedDiagnostic,
} from '../runtime/runtime-redaction.js';

let healthPanelDeps = {};

export function configureLoredeckHealthPanel(deps = {}) {
    healthPanelDeps = { ...healthPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = healthPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Deck Health dependency is not configured: ${name}`);
}

function getState() { return dep('getState', () => ({}))(); }
function getCanonLoreDatabaseSync() { return dep('getCanonLoreDatabaseSync', () => null)(); }
function getLoredeckLibrary(state) { return dep('getLoredeckLibrary', () => [])(state); }
function getLoredeckStack(state) { return dep('getLoredeckStack', () => [])(state); }
function getLoredeckLibraryIndexForPacks(state, library) { return dep('getLoredeckLibraryIndexForPacks', () => ({ folders: [], packs: {} }))(state, library); }
function resolveLoredeckStackItems(stack, index, options) { return dep('resolveLoredeckStackItems', () => ({ stack: [] }))(stack, index, options); }
function buildLoredeckPackScopedHealth(pack, loadedMeta, stackHealth) { return dep('buildLoredeckPackScopedHealth', () => null)(pack, loadedMeta, stackHealth); }
function getLoredeckPackSummaryCounts(pack, cached, loadedMeta, health, report) { return dep('getLoredeckPackSummaryCounts', () => ({ entryCount: 0, fileCount: 0, loadedFileCount: 0, categoryCounts: {} }))(pack, cached, loadedMeta, health, report); }
function getLoredeckTypeLabel(packId) { return dep('getLoredeckTypeLabel', () => 'Custom')(packId); }
function getFreshLoredeckLibraryPack(packId, fallback) { return dep('getFreshLoredeckLibraryPack', (_packId, _fallback) => _fallback || null)(packId, fallback); }
function persistLoredeckLibraryRecordMutation(pack, mutator, message, options) { return dep('persistLoredeckLibraryRecordMutation', () => false)(pack, mutator, message, options); }
function normalizeLoredeckHealthIssueStates(value) { return dep('normalizeLoredeckHealthIssueStates', () => ({}))(value); }
function normalizeLoredeckPendingIdList(value, limit) { return dep('normalizeLoredeckPendingIdList', () => [])(value, limit); }
function normalizeLoredeckPendingTimelineIdList(value, limit) { return dep('normalizeLoredeckPendingTimelineIdList', () => [])(value, limit); }
function validateLoredeckForEditor(pack, button, options) { return dep('validateLoredeckForEditor', async () => ({ health: null, error: 'Validation is unavailable.' }))(pack, button, options); }
function refreshLoredeckSurfaces(options) { return dep('refreshLoredeckSurfaces', () => {})(options); }
function clearCanonLoreDatabaseCache() { return dep('clearCanonLoreDatabaseCache', () => {})(); }
function clearContextIndexCache() { return dep('clearContextIndexCache', () => {})(); }
function loadCanonLoreDatabase() { return dep('loadCanonLoreDatabase', async () => null)(); }
function refreshPanelBody(options) { return dep('refreshPanelBody', () => {})(options); }
function refreshHeader() { return dep('refreshHeader', () => {})(); }
function sanitizeFileStem(value) { return dep('sanitizeFileStem', value => String(value || 'saga-deck-health').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'saga-deck-health')(value); }
function downloadJson(data, filename) { return dep('downloadJson', () => {})(data, filename); }
function openDuplicateLoredeckDialog(pack) { return dep('openDuplicateLoredeckDialog', () => {})(pack); }
function handleLoredeckAssistantHealthRepairDraft(pack, health, button, options) { return dep('handleLoredeckAssistantHealthRepairDraft', async () => {})(pack, health, button, options); }
function normalizeLoredeckHealthGroupIssuesForRepair(group) { return dep('normalizeLoredeckHealthGroupIssuesForRepair', () => [])(group); }
function canValidateLoredeckInEditor(pack) { return dep('canValidateLoredeckInEditor', () => false)(pack); }
function isLoredeckMalformedTagIssueGroup(group) { return dep('isLoredeckMalformedTagIssueGroup', () => false)(group); }
function queueLoredeckMalformedTagRepairFromHealthGroup(pack, group, button) { return dep('queueLoredeckMalformedTagRepairFromHealthGroup', async () => {})(pack, group, button); }
function repairLoredeckSafeHealthIssues(pack, button) { return dep('repairLoredeckSafeHealthIssues', async () => {})(pack, button); }
function markTourTarget(element, target) { return dep('markTourTarget', value => value)(element, target); }

const loredeckEntryPreviewCache = { get: id => healthPanelDeps.getLoredeckEntryPreviewCacheRecord?.(id) || null };
const loredeckManifestPreviewCache = { get: id => healthPanelDeps.getLoredeckManifestPreviewCacheRecord?.(id) || null };

let loredeckHealthCenterOpen = false;
let loredeckHealthCenterPackId = '';
let loredeckHealthCenterTab = 'overview';

function hashLoredeckHealthRepairIssueId(value = '') {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function openLoredeckHealthCenter(packId = '') {
    loredeckHealthCenterOpen = true;
    loredeckHealthCenterPackId = String(packId || '').trim();
    loredeckHealthCenterTab = 'overview';
    renderLoredeckHealthCenterOverlay();
}

export function closeLoredeckHealthCenter() {
    loredeckHealthCenterOpen = false;
    document.querySelector('.saga-loredeck-health-center-overlay')?.remove();
}

const LOREDECK_HEALTH_CENTER_SCROLL_SELECTORS = Object.freeze({
    body: '.saga-loredeck-health-center-body',
    content: '.saga-loredeck-health-center-content',
});

function captureLoredeckHealthCenterScrollState() {
    const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
    if (!overlay) return null;
    const snapshot = { elements: {} };
    for (const [key, selector] of Object.entries(LOREDECK_HEALTH_CENTER_SCROLL_SELECTORS)) {
        const element = overlay.querySelector(selector);
        if (!element) continue;
        snapshot.elements[key] = {
            top: element.scrollTop || 0,
            left: element.scrollLeft || 0,
        };
    }
    const pageScrollElement = typeof document !== 'undefined' ? document.scrollingElement || document.documentElement : null;
    if (pageScrollElement) {
        snapshot.page = {
            top: pageScrollElement.scrollTop || 0,
            left: pageScrollElement.scrollLeft || 0,
        };
    }
    return snapshot;
}

function restoreLoredeckHealthCenterScrollState(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') return;
    const restore = () => {
        const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
        if (overlay && snapshot.elements && typeof snapshot.elements === 'object') {
            for (const [key, value] of Object.entries(snapshot.elements)) {
                const selector = LOREDECK_HEALTH_CENTER_SCROLL_SELECTORS[key];
                const element = selector ? overlay.querySelector(selector) : null;
                if (!element || !value) continue;
                element.scrollTop = Number(value.top) || 0;
                element.scrollLeft = Number(value.left) || 0;
            }
        }
        const pageScrollElement = typeof document !== 'undefined' ? document.scrollingElement || document.documentElement : null;
        if (pageScrollElement && snapshot.page) {
            pageScrollElement.scrollTop = Number(snapshot.page.top) || 0;
            pageScrollElement.scrollLeft = Number(snapshot.page.left) || 0;
        }
    };
    restore();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restore);
}

export function renderLoredeckHealthCenterOverlay(options = {}) {
    const scrollState = options.preserveScroll === false ? null : captureLoredeckHealthCenterScrollState();
    const previousOverlay = document.querySelector('.saga-loredeck-health-center-overlay');
    if (!loredeckHealthCenterOpen) {
        previousOverlay?.remove();
        return;
    }

    let overlay = null;
    try {
        const context = getLoredeckHealthCenterContext(loredeckHealthCenterPackId);

        overlay = document.createElement('div');
        overlay.className = 'saga-lore-workbench-overlay saga-loredeck-health-center-overlay';
        wireOverlayBackdropClose(overlay, closeLoredeckHealthCenter);

        const shell = document.createElement('div');
        shell.className = 'saga-lore-workbench-shell saga-loredeck-health-center-shell';
        overlay.appendChild(shell);

        const header = document.createElement('div');
        header.className = 'saga-lore-workbench-header saga-loredeck-health-center-header';
        markTourTarget(header, 'loredecks.health.header');
        const titleWrap = document.createElement('div');
        titleWrap.className = 'saga-lore-workbench-title-wrap';
        const title = document.createElement('div');
        title.className = 'saga-lore-workbench-title';
        title.textContent = 'Deck Health Center';
        titleWrap.appendChild(title);
        const subtitle = document.createElement('div');
        subtitle.className = 'saga-lore-workbench-subtitle';
        subtitle.textContent = context.subtitle;
        titleWrap.appendChild(subtitle);
        header.appendChild(titleWrap);

        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions saga-loredeck-health-center-actions';
        markTourTarget(actions, 'loredecks.health.actions');
        actions.appendChild(createButton('Refresh Scan', context.pack ? 'Validate this Loredeck and refresh its Deck Health report.' : 'Reload active Loredecks and recompute stack Deck Health.', async (btn) => {
            await refreshLoredeckHealthCenterScan(context, btn);
        }, 'saga-primary-button'));
        const exportButton = createButton('Export Report', 'Download this Deck Health report as JSON.', () => exportLoredeckHealthCenterReport(context));
        exportButton.disabled = !context.health;
        actions.appendChild(exportButton);
        actions.appendChild(createButton('Close', 'Close the Deck Health Center.', closeLoredeckHealthCenter));
        header.appendChild(actions);
        shell.appendChild(header);

        const body = document.createElement('div');
        body.className = 'saga-loredeck-health-center-body';
        body.appendChild(createLoredeckHealthCenterTabs());
        const content = document.createElement('div');
        content.className = `saga-loredeck-health-center-content saga-loredeck-health-center-content-${loredeckHealthCenterTab}`;
        if (loredeckHealthCenterTab === 'issues') content.appendChild(createLoredeckHealthIssuesView(context));
        else if (loredeckHealthCenterTab === 'coverage') content.appendChild(createLoredeckHealthCoverageView(context));
        else if (loredeckHealthCenterTab === 'files') content.appendChild(createLoredeckHealthFilesView(context));
        else if (loredeckHealthCenterTab === 'advanced') content.appendChild(createLoredeckHealthAdvancedView(context));
        else content.appendChild(createLoredeckHealthOverviewView(context));
        body.appendChild(content);
        shell.appendChild(body);
    } catch (e) {
        console.error('[Saga] Deck Health Center render failed:', e);
        toast('Deck Health Center failed to render. Keeping the previous view open.', 'error');
        if (!previousOverlay) {
            document.body.appendChild(createLoredeckHealthCenterRenderErrorOverlay(e));
        }
        return;
    }

    previousOverlay?.remove();
    document.body.appendChild(overlay);
    restoreLoredeckHealthCenterScrollState(scrollState);
}

function createLoredeckHealthCenterRenderErrorOverlay(error = null) {
    const overlay = document.createElement('div');
    overlay.className = 'saga-lore-workbench-overlay saga-loredeck-health-center-overlay';
    wireOverlayBackdropClose(overlay, closeLoredeckHealthCenter);

    const shell = document.createElement('div');
    shell.className = 'saga-lore-workbench-shell saga-loredeck-health-center-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header saga-loredeck-health-center-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Deck Health Center';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = 'The report could not be rendered.';
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-loredeck-health-center-actions';
    actions.appendChild(createButton('Close', 'Close the Deck Health Center.', closeLoredeckHealthCenter));
    header.appendChild(actions);
    shell.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-loredeck-health-center-body';
    body.appendChild(createEmptyMessage('Deck Health Center could not render this report. Close and reopen the Health Center after rerunning the scan.'));
    const detail = document.createElement('div');
    detail.className = 'saga-runtime-help';
    detail.textContent = error?.message || 'Unknown render error.';
    body.appendChild(detail);
    shell.appendChild(body);
    return overlay;
}

function createLoredeckHealthCenterTabs() {
    const tabs = document.createElement('div');
    tabs.className = 'saga-lore-workbench-mode-tabs saga-loredeck-health-tabs';
    const options = [
        ['overview', 'Overview', 'Readiness, priority issues, categories, and inventory.'],
        ['issues', 'Issues', 'Grouped issue triage with affected data and repair guidance.'],
        ['coverage', 'Coverage', 'Narrative and schema coverage signals.'],
        ['files', 'Files', 'File-level diagnostics for imported and bundled decks.'],
        ['advanced', 'Advanced', 'Raw metrics and JSON-oriented diagnostics.'],
    ];
    for (const [id, label, tooltip] of options) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `saga-lore-workbench-mode-tab${loredeckHealthCenterTab === id ? ' saga-lore-workbench-mode-tab-active' : ''}`;
        btn.textContent = label;
        addTooltip(btn, tooltip);
        btn.addEventListener('click', () => {
            loredeckHealthCenterTab = id;
            renderLoredeckHealthCenterOverlay({ preserveScroll: false });
        });
        tabs.appendChild(btn);
    }
    return tabs;
}

function getLoredeckHealthCenterContext(packId = '') {
    const state = getState();
    const canonDb = getCanonLoreDatabaseSync();
    const library = getLoredeckLibrary(state);
    const pack = String(packId || '').trim()
        ? (library.find(item => item.packId === String(packId || '').trim()) || null)
        : null;
    const cached = pack ? getCachedLoredeckHealthRecord(pack.packId) : {};
    const loadedMeta = pack ? ((canonDb?.loredecks || []).find(item => item.id === pack.packId) || null) : null;
    const health = pack ? (cached.health || buildLoredeckPackScopedHealth(pack, loadedMeta, canonDb?.health || null)) : (canonDb?.health || null);
    const report = buildLoredeckHealthReport(state, pack ? null : canonDb, health);
    if (pack) {
        const counts = getLoredeckPackSummaryCounts(pack, cached, loadedMeta, health, report);
        report.scanned = !!health;
        report.insights = [];
        report.packs = [buildLoredeckHealthPackSummary(pack, cached, health)];
        report.enabledPackIds = [pack.packId];
        report.databaseId = pack.packId;
        report.summary = {
            ...(report.summary || {}),
            entryCount: counts.entryCount,
            fileCount: counts.fileCount,
            loadedFileCount: counts.loadedFileCount,
            categoryCounts: counts.categoryCounts,
        };
    }
    const status = getLoredeckHealthStatusDescriptor(report, health);
    const title = pack?.title || (report.packs?.[0]?.title || 'Active Loredeck Stack');
    const subtitle = pack
        ? `${getLoredeckTypeLabel(pack.packId)} Loredeck health report for ${title}.`
        : 'Active stack health report across loaded Loredecks.';
    return {
        state,
        canonDb,
        pack,
        cached,
        health,
        report,
        status,
        title,
        subtitle,
        generatedAt: cached.loadedAt || report.generatedAt || Date.now(),
    };
}

export function getCachedLoredeckHealthRecord(packId = '') {
    const id = String(packId || '').trim();
    const entryCache = loredeckEntryPreviewCache.get(id) || {};
    const manifestCache = loredeckManifestPreviewCache.get(id) || {};
    const manifest = entryCache.manifest || manifestCache.manifest || null;
    const entryFiles = Array.isArray(entryCache.entryFiles) ? entryCache.entryFiles : [];
    return {
        health: entryCache.health || manifestCache.health || null,
        manifest,
        entryCache,
        entryFiles,
        loadedAt: Number(entryCache.loadedAt) || Number(manifestCache.loadedAt) || 0,
        entryCount: entryFiles.reduce((sum, file) => sum + (Array.isArray(file.entries) ? file.entries.length : 0), 0),
        fileCount: entryFiles.length || countLoredeckManifestFiles(manifest),
        loadedFileCount: entryFiles.filter(file => file?.ok !== false).length,
    };
}

export function countLoredeckManifestFiles(manifest = null) {
    return Array.isArray(manifest?.files) ? manifest.files.length : 0;
}

function isHealthForLoredeckPack(packId = '', health = null) {
    const id = String(packId || '').trim();
    return !!id && !!health && String(health.packId || '').trim() === id;
}

export function buildLoredeckHealthPackSummary(pack = {}, cached = {}, health = null) {
    const overrideCount = pack.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? Object.keys(pack.entryOverrides).length
        : 0;
    const canUseHealthSummary = isHealthForLoredeckPack(pack.packId, health);
    return {
        packId: pack.packId,
        title: pack.title || pack.packId,
        type: pack.type || 'custom',
        typeLabel: getLoredeckTypeLabel(pack.packId),
        description: pack.description || '',
        manifest: pack.manifest || '',
        derivedFrom: pack.derivedFrom?.packId || '',
        entryCount: Number(canUseHealthSummary ? health?.summary?.entryCount : 0) || Number(cached.entryCount) || Number(pack.stats?.entryCount) || Number(pack.entryCount) || 0,
        healthStatus: (canUseHealthSummary ? health?.status : '') || pack.healthStatus || 'unknown',
        overrideCount,
        disabledCount: Array.isArray(pack.disabledEntryIds) ? pack.disabledEntryIds.length : 0,
    };
}

export function getLoredeckHealthStatusDescriptor(report = {}, health = null) {
    const summary = report.summary || {};
    const errors = Number(summary.errorCount) || (Array.isArray(report.errors) ? report.errors.length : 0);
    const warnings = Number(summary.warningCount) || (Array.isArray(report.warnings) ? report.warnings.length : 0);
    const suggestions = Number(summary.suggestionCount) || (Array.isArray(report.suggestions) ? report.suggestions.length : 0);
    const raw = String(health?.status || report.status || 'unknown').trim();
    if (!health) {
        return {
            key: 'unknown',
            label: 'Not scanned',
            tone: 'unknown',
            summary: 'Run a scan to check this deck for schema, tag, timeline, and file issues.',
            detail: 'No current Deck Health report is available for this target.',
        };
    }
    if (errors > 0 || raw === 'error') {
        return {
            key: 'blocked',
            label: 'Blocked',
            tone: 'error',
            summary: 'This deck has errors that should be fixed before relying on it.',
            detail: 'Start with errors, then rerun Deck Health before sharing or stacking this deck.',
        };
    }
    if (warnings > 0 || raw === 'needs_review') {
        return {
            key: 'warnings',
            label: 'Usable with warnings',
            tone: 'warning',
            summary: 'This deck can run, but metadata cleanup is recommended.',
            detail: 'Address the priority issues below to improve reliability.',
        };
    }
    if (raw === 'partial') {
        return {
            key: 'partial',
            label: 'Incomplete',
            tone: 'warning',
            summary: 'This deck loaded partially and should be reviewed.',
            detail: 'Check file and schema diagnostics to find what did not load cleanly.',
        };
    }
    if (suggestions > 0) {
        return {
            key: 'healthy_suggestions',
            label: 'Healthy with suggestions',
            tone: 'suggestion',
            summary: 'This deck can run cleanly; optional improvements are available.',
            detail: 'Suggestions are not blockers. Use them when polishing a deck for sharing.',
        };
    }
    return {
        key: 'healthy',
        label: 'Healthy',
        tone: 'ok',
        summary: 'This deck passed the current Deck Health checks.',
        detail: 'No blocking or review-worthy issues were found in the latest scan.',
    };
}

function createLoredeckHealthOverviewView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-overview';
    wrap.appendChild(createLoredeckHealthSummaryHero(context));
    wrap.appendChild(createLoredeckHealthSeverityGrid(context));

    const main = document.createElement('div');
    main.className = 'saga-loredeck-health-overview-main';
    const issues = document.createElement('div');
    issues.className = 'saga-loredeck-health-panel';
    markTourTarget(issues, 'loredecks.health.issues');
    const issueTitle = document.createElement('div');
    issueTitle.className = 'saga-runtime-card-title';
    issueTitle.textContent = 'Priority Issues';
    issues.appendChild(issueTitle);
    const groups = getLoredeckHealthIssueGroupsForContext(context);
    if (!groups.length) {
        issues.appendChild(createEmptyMessage(context.report.scanned === false ? 'Run Refresh Scan to check this deck for priority issues.' : 'No priority issues found.'));
    } else {
        for (const group of groups.slice(0, 4)) {
            issues.appendChild(createLoredeckHealthIssueGroupCard(group, context));
        }
    }
    main.appendChild(issues);

    const categories = document.createElement('div');
    categories.className = 'saga-loredeck-health-panel';
    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'saga-runtime-card-title';
    categoryTitle.textContent = 'Health Categories';
    categories.appendChild(categoryTitle);
    categories.appendChild(createLoredeckHealthCategoryList(context));
    main.appendChild(categories);
    wrap.appendChild(main);

    wrap.appendChild(createLoredeckHealthInventoryBar(context));
    if (groups[0]) wrap.appendChild(createLoredeckHealthIssueDetailPanel(groups[0], context));
    return wrap;
}

function createLoredeckHealthIssuesView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-issues-view';
    markTourTarget(wrap, 'loredecks.health.issues');
    const groups = getLoredeckHealthIssueGroupsForContext(context, { includeIgnored: true });
    const header = document.createElement('div');
    header.className = 'saga-loredeck-health-view-header';
    const stateCounts = getLoredeckHealthIssueStateCounts(context, groups);
    header.appendChild(createStatusPill(`${groups.length} grouped issue${groups.length === 1 ? '' : 's'}`, 'Issues are grouped by severity, code, and affected file when possible.'));
    header.appendChild(createStatusPill(`${getLoredeckHealthAllIssues(context.report).length} raw finding${getLoredeckHealthAllIssues(context.report).length === 1 ? '' : 's'}`, 'Raw Deck Health findings before grouping.'));
    if (stateCounts.ignored) header.appendChild(createStatusPill(`${stateCounts.ignored} ignored`, 'Ignored issue groups are hidden from Overview priority issues but remain visible here.'));
    if (stateCounts.resolved) header.appendChild(createStatusPill(`${stateCounts.resolved} resolved`, 'Issue groups marked resolved by the user. Rerun Deck Health after repairs to verify they disappear.'));
    wrap.appendChild(header);
    if (!groups.length) {
        wrap.appendChild(createEmptyMessage('No issues found in this Deck Health report.'));
        return wrap;
    }
    const table = document.createElement('div');
    table.className = 'saga-loredeck-health-issue-table';
    table.appendChild(createLoredeckHealthIssueTableHeader());
    for (const group of groups) {
        table.appendChild(createLoredeckHealthIssueTableRow(group, context));
    }
    wrap.appendChild(table);
    return wrap;
}

function createLoredeckHealthCoverageView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-coverage-view';
    const summary = context.report.summary || {};
    const panel = document.createElement('div');
    panel.className = 'saga-loredeck-health-panel';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Narrative Coverage Signals';
    panel.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Coverage is advisory. These signals help identify whether a deck has enough Context, category, and retrieval structure to support long-form play.';
    panel.appendChild(help);
    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-health-coverage-grid';
    const categoryCounts = summary.categoryCounts && typeof summary.categoryCounts === 'object' && !Array.isArray(summary.categoryCounts)
        ? summary.categoryCounts
        : {};
    const categories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    if (categories.length) {
        for (const [category, count] of categories) {
            grid.appendChild(createLoredeckHealthMetric(humanizeScopeKey(category), String(count), `Loaded ${category} Lorecards.`));
        }
    } else {
        grid.appendChild(createLoredeckHealthMetric('Categories', 'unset', 'No category counts are available yet.'));
    }
    grid.appendChild(createLoredeckHealthMetric('Context Gates', String(summary.contextGateCount || 0), 'Lorecards with Context gates.'));
    grid.appendChild(createLoredeckHealthMetric('Schema v3', String(summary.schemaV3EntryCount || 0), 'Lorecards checked against Saga schema v3.'));
    grid.appendChild(createLoredeckHealthMetric('Timeline', `${summary.timelineAnchorCount || 0}/${summary.timelineWindowCount || 0}`, 'Timeline anchors/windows available to Context.'));
    grid.appendChild(createLoredeckHealthMetric('Candidates', String(summary.timelineCandidateCount || ((summary.timelineAnchorCount || 0) + (summary.timelineWindowCount || 0))), 'Durable timeline candidates available to the Context Browser and Reasoner.'));
    grid.appendChild(createLoredeckHealthMetric('Gates / Candidate', String(summary.timelineGatesPerCandidate || 0), 'Approximate Context-gated Lorecard density per durable timeline candidate.'));
    grid.appendChild(createLoredeckHealthMetric('Density Hints', String(summary.timelineDensificationSuggestionCount || 0), 'Advisory suggestions for adding high-value anchors/windows without creating alias sprawl.'));
    panel.appendChild(grid);
    wrap.appendChild(panel);
    wrap.appendChild(createLoredeckHealthCategoryList(context, { asPanel: true }));
    return wrap;
}

function createLoredeckHealthFilesView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-files-view';
    const files = getLoredeckHealthFileRows(context);
    if (!files.length) {
        wrap.appendChild(createEmptyMessage('No file-level diagnostics are available yet. Run Refresh Scan or validate the selected Loredeck.'));
        return wrap;
    }
    const table = document.createElement('div');
    table.className = 'saga-loredeck-health-file-table';
    const header = document.createElement('div');
    header.className = 'saga-loredeck-health-file-row saga-loredeck-health-file-row-header';
    for (const text of ['File', 'Entries', 'Errors', 'Warnings', 'Status']) {
        const cell = document.createElement('div');
        cell.textContent = text;
        header.appendChild(cell);
    }
    table.appendChild(header);
    for (const file of files) {
        const row = document.createElement('div');
        row.className = `saga-loredeck-health-file-row saga-loredeck-health-file-row-${file.statusTone}`;
        for (const text of [file.file || '(unknown)', String(file.entries || 0), String(file.errors || 0), String(file.warnings || 0), file.status]) {
            const cell = document.createElement('div');
            cell.textContent = text;
            row.appendChild(cell);
        }
        table.appendChild(row);
    }
    wrap.appendChild(table);
    return wrap;
}

function createLoredeckHealthAdvancedView(context) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-advanced-view';
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Copy Diagnostics', 'Copy the current Deck Health report JSON to clipboard.', async () => {
        await copyTextToClipboard(stringifyRedactedDiagnostic(context.report), 'Deck Health diagnostics copied.');
    }));
    actions.appendChild(createButton('Export Report', 'Download this Deck Health report as JSON.', () => exportLoredeckHealthCenterReport(context), 'saga-primary-button'));
    wrap.appendChild(actions);

    const summary = context.report.summary || {};
    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-health-grid';
    const metrics = [
        ['Status', context.report.status || 'unknown', 'Raw Deck Health status.'],
        ['Entries', String(summary.entryCount || 0), 'Loaded entry count after Custom overrides and stack dedupe.'],
        ['Files', `${summary.loadedFileCount || 0}/${summary.fileCount || 0}`, 'Loaded files over declared files.'],
        ['Overrides', String(summary.entryOverrideCount || 0), 'Custom entry overrides applied in loaded packs.'],
        ['Added', String(summary.entryAdditionCount || 0), 'Custom entries added through override layers.'],
        ['Disabled', String(summary.suppressedEntryCount || 0), 'Source entries suppressed by Custom packs.'],
        ['Stack Duplicates', String(context.report.duplicateEntryIdCount || 0), 'Duplicate entry IDs resolved by stack priority.'],
        ['Context Gates', String(summary.contextGateCount || 0), 'Entries with Context gates.'],
        ['Timeline', `${summary.timelineAnchorCount || 0}/${summary.timelineWindowCount || 0}`, 'Loaded Context anchors/windows.'],
        ['Schema v3', String(summary.schemaV3EntryCount || 0), 'Loaded entries checked against Saga schema v3 rules.'],
        ['v3 Issues', String(summary.schemaV3IssueCount || 0), 'Schema v3 Deck Health issues across loaded entries.'],
        ['Stats Drift', String(summary.manifestStatsMismatchCount || 0), 'Manifest stats mismatches found during validation.'],
        ['Tag Issues', String((summary.undefinedTagCount || 0) + (summary.deprecatedTagUsageCount || 0) + (summary.duplicateTagAliasCount || 0) + (summary.malformedTagCount || 0)), 'Undefined, deprecated, duplicate-alias, or malformed tag issues.'],
        ['Anchor Issues', String(summary.brokenAnchorReferenceCount || 0), 'Broken Context anchor references.'],
        ['Window Issues', String(summary.invalidContextWindowCount || 0), 'Invalid Context windows.'],
        ['Unmatchable', String(summary.unmatchableContextGateCount || 0), 'Context-gated entries that cannot match known Context anchors.'],
    ];
    for (const [label, value, tooltip] of metrics) grid.appendChild(createLoredeckHealthMetric(label, value, tooltip));
    wrap.appendChild(grid);

    if (context.report.packs?.length) {
        const packs = document.createElement('div');
        packs.className = 'saga-loredeck-health-pack-list';
        for (const pack of context.report.packs) packs.appendChild(createLoredeckHealthPackRow(pack));
        wrap.appendChild(packs);
    }
    if (context.report.insights?.length) wrap.appendChild(createLoredeckHealthIssueList('Stack Insights', context.report.insights, 'warning'));
    wrap.appendChild(createLoredeckHealthIssueList('Errors', context.report.errors, 'error'));
    wrap.appendChild(createLoredeckHealthIssueList('Warnings', context.report.warnings, 'warning'));
    wrap.appendChild(createLoredeckHealthIssueList('Suggestions', context.report.suggestions, 'suggestion'));
    return wrap;
}

function createLoredeckHealthSummaryHero(context, options = {}) {
    const hero = document.createElement('div');
    hero.className = `saga-loredeck-health-hero saga-loredeck-health-hero-${context.status.tone}${options.compact ? ' saga-loredeck-health-hero-compact' : ''}`;
    markTourTarget(hero, 'loredecks.health.status');
    const emblem = document.createElement('div');
    emblem.className = 'saga-loredeck-health-emblem';
    emblem.textContent = context.status.tone === 'error' ? '!' : (context.status.tone === 'ok' ? 'OK' : '!');
    hero.appendChild(emblem);
    const main = document.createElement('div');
    main.className = 'saga-loredeck-health-hero-main';
    const deck = document.createElement('div');
    deck.className = 'saga-loredeck-health-deck-title';
    deck.textContent = context.title;
    main.appendChild(deck);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const pack = context.pack || context.report.packs?.[0] || null;
    if (pack) meta.appendChild(createStatusPill(pack.typeLabel || getLoredeckTypeLabel(pack.packId), 'Loredeck type.'));
    meta.appendChild(createStatusPill(`${context.report.summary?.entryCount || 0} Lorecards`, 'Lorecards checked in this report.'));
    meta.appendChild(createStatusPill(`Last scan: ${context.health ? formatRelativeHealthTime(context.generatedAt) : 'not scanned'}`, 'Last Deck Health scan time.'));
    main.appendChild(meta);
    const status = document.createElement('div');
    status.className = 'saga-loredeck-health-status-label';
    status.textContent = context.status.label;
    main.appendChild(status);
    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-health-status-summary';
    summary.textContent = context.status.summary;
    main.appendChild(summary);
    if (!options.compact) {
        const detail = document.createElement('div');
        detail.className = 'saga-loredeck-health-status-detail';
        detail.textContent = context.status.detail;
        main.appendChild(detail);
    }
    hero.appendChild(main);
    return hero;
}

function createLoredeckHealthSeverityGrid(context, options = {}) {
    const summary = context.report.summary || {};
    const grid = document.createElement('div');
    grid.className = `saga-loredeck-health-severity-grid${options.compact ? ' saga-loredeck-health-severity-grid-compact' : ''}`;
    grid.appendChild(createLoredeckHealthSeverityCard('Errors', String(summary.errorCount || 0), (summary.errorCount || 0) ? 'Fix first' : 'None found', 'error'));
    grid.appendChild(createLoredeckHealthSeverityCard('Warnings', String(summary.warningCount || 0), (summary.warningCount || 0) ? 'Needs review' : 'Clear', 'warning'));
    grid.appendChild(createLoredeckHealthSeverityCard('Suggestions', String(summary.suggestionCount || 0), (summary.suggestionCount || 0) ? 'Optional' : 'None', 'suggestion'));
    grid.appendChild(createLoredeckHealthSeverityCard('Checked', String(summary.entryCount || 0), 'Lorecards', 'checked'));
    return grid;
}

function createLoredeckHealthSeverityCard(label, value, detail, tone = 'checked') {
    const card = document.createElement('div');
    card.className = `saga-loredeck-health-severity-card saga-loredeck-health-severity-card-${tone}`;
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    card.appendChild(labelEl);
    const valueEl = document.createElement('strong');
    valueEl.textContent = value;
    card.appendChild(valueEl);
    const detailEl = document.createElement('small');
    detailEl.textContent = detail;
    card.appendChild(detailEl);
    return card;
}

function createLoredeckHealthCategoryList(context, options = {}) {
    const categories = getLoredeckHealthCategories(context.report);
    const list = document.createElement('div');
    list.className = `${options.asPanel ? 'saga-loredeck-health-panel ' : ''}saga-loredeck-health-category-list`.trim();
    for (const category of categories) {
        const row = document.createElement('div');
        row.className = `saga-loredeck-health-category-row saga-loredeck-health-category-row-${category.tone}`;
        const name = document.createElement('span');
        name.textContent = category.label;
        row.appendChild(name);
        const status = document.createElement('span');
        status.textContent = category.status;
        row.appendChild(status);
        addTooltip(row, category.tooltip);
        list.appendChild(row);
    }
    return list;
}

function getLoredeckHealthCategories(report = {}) {
    const summary = report.summary || {};
    const issues = getLoredeckHealthAllIssues(report);
    if (report.scanned === false) {
        const makeUnknown = (label, tooltip) => ({
            label,
            status: 'Not checked',
            tone: 'unknown',
            tooltip,
        });
        return [
            makeUnknown('Structure', 'Run Refresh Scan to check manifest structure and source metadata.'),
            makeUnknown('JSON Validity', 'Run Refresh Scan to check whether declared JSON resources load successfully.'),
            makeUnknown('Schema', 'Run Refresh Scan to check Saga schema v3 entry shape and required fields.'),
            makeUnknown('Tags', 'Run Refresh Scan to check tag registry, tag IDs, deprecated tags, aliases, and orphaned tags.'),
            makeUnknown('Timeline', 'Run Refresh Scan to check timeline anchors, windows, sort keys, and registry availability.'),
            makeUnknown('Anchors', 'Run Refresh Scan to check Context anchor references.'),
            makeUnknown('Coverage', 'Run Refresh Scan to check advisory completeness and retrieval coverage signals.'),
        ];
    }
    const hasCode = pattern => issues.some(issue => pattern.test(String(issue.code || '')));
    const make = (label, failed, review, tooltip) => ({
        label,
        status: failed ? 'Blocked' : (review ? 'Needs Review' : 'Passed'),
        tone: failed ? 'error' : (review ? 'warning' : 'ok'),
        tooltip,
    });
    return [
        make('Structure', hasCode(/missing_default_loredeck|missing_loredeck_manifest|invalid_pack_id|missing_virtual_loredeck_base_manifest/), hasCode(/duplicate_manifest_file|manifest_.*mismatch/), 'Manifest structure and library/source metadata.'),
        make('JSON Validity', hasCode(/missing_entry_file|load_failed/), false, 'Whether declared JSON resources loaded successfully.'),
        make('Schema', Number(summary.schemaV3IssueCount) > 0 && (report.errors || []).some(issue => String(issue.code || '').startsWith('schema_v3')), Number(summary.schemaV3IssueCount) > 0, 'Saga schema v3 entry shape and required fields.'),
        make('Tags', false, (Number(summary.undefinedTagCount) || 0) + (Number(summary.deprecatedTagUsageCount) || 0) + (Number(summary.duplicateTagAliasCount) || 0) + (Number(summary.malformedTagCount) || 0) > 0 || hasCode(/tag/), 'Tag registry, tag IDs, deprecated tags, aliases, and orphaned tags.'),
        make('Timeline', false, (Number(summary.invalidContextWindowCount) || 0) > 0 || (Number(summary.timelineDensificationSuggestionCount) || 0) > 0 || hasCode(/timeline|context_window/), 'Timeline anchors, windows, sort keys, and registry availability.'),
        make('Anchors', false, (Number(summary.brokenAnchorReferenceCount) || 0) > 0 || hasCode(/anchor/), 'Context anchor references from entries and windows.'),
        make('Coverage', false, (Number(summary.suggestionCount) || 0) > 0, 'Advisory completeness signals such as optional metadata and broad coverage.'),
    ];
}

function createLoredeckHealthInventoryBar(context) {
    const summary = context.report.summary || {};
    const bar = document.createElement('div');
    bar.className = 'saga-loredeck-health-inventory';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-health-inventory-title';
    title.textContent = 'Deck Inventory';
    bar.appendChild(title);
    const items = [
        ['Entries', String(summary.entryCount || 0)],
        ['Files', `${summary.loadedFileCount || 0}/${summary.fileCount || 0}`],
        ['Schema', summary.schemaV3EntryCount ? 'v3' : (context.pack?.entrySchemaVersion ? `v${context.pack.entrySchemaVersion}` : 'unknown')],
        ['Context Gates', String(summary.contextGateCount || 0)],
        ['Timeline', `${summary.timelineAnchorCount || 0}/${summary.timelineWindowCount || 0}`],
        ['Disabled', String(summary.suppressedEntryCount || context.pack?.disabledEntryIds?.length || 0)],
        ['Overrides', String(summary.entryOverrideCount || (context.pack?.entryOverrides ? Object.keys(context.pack.entryOverrides).length : 0))],
    ];
    for (const [label, value] of items) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-health-inventory-item';
        const k = document.createElement('span');
        k.textContent = label;
        item.appendChild(k);
        const v = document.createElement('strong');
        v.textContent = value;
        item.appendChild(v);
        bar.appendChild(item);
    }
    return bar;
}

function createLoredeckHealthIssueGroupCard(group, context, options = {}) {
    const issueState = getLoredeckHealthIssueState(context.pack, group);
    const card = document.createElement('details');
    card.className = `saga-loredeck-health-group-card saga-loredeck-health-group-${group.severity}${options.compact ? ' saga-loredeck-health-group-card-compact' : ''}`;
    if (issueState?.status) card.classList.add(`saga-loredeck-health-group-state-${issueState.status}`);
    card.open = false;
    const summary = document.createElement('summary');
    const main = document.createElement('div');
    main.className = 'saga-loredeck-health-group-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-health-group-title';
    title.textContent = group.title;
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    const severityPill = createStatusPill(humanizeScopeKey(group.severity), 'Issue severity.');
    severityPill.classList.add('saga-loredeck-health-chip', `saga-loredeck-health-chip-${group.severity}`);
    meta.appendChild(severityPill);
    const affectedPill = createStatusPill(group.affectedLabel, 'Affected scope.');
    affectedPill.classList.add('saga-loredeck-health-chip', 'saga-loredeck-health-chip-affected');
    meta.appendChild(affectedPill);
    if (group.files.length) {
        const filePill = createStatusPill(`${group.files.length} file${group.files.length === 1 ? '' : 's'}`, group.files.join(', '));
        filePill.classList.add('saga-loredeck-health-chip', 'saga-loredeck-health-chip-file');
        meta.appendChild(filePill);
    }
    if (group.autoFixLabel) {
        const fixPill = createStatusPill(group.autoFixLabel, group.autoFixTooltip);
        fixPill.classList.add('saga-loredeck-health-chip', 'saga-loredeck-health-chip-fix');
        meta.appendChild(fixPill);
    }
    if (issueState?.status) {
        const stateLabel = getLoredeckHealthIssueStateLabel(issueState, group);
        const statePill = createStatusPill(stateLabel, issueState.note || 'User-set Deck Health issue state.');
        statePill.classList.add('saga-loredeck-health-chip', `saga-loredeck-health-chip-state-${issueState.status}`);
        meta.appendChild(statePill);
    }
    main.appendChild(meta);
    const message = document.createElement('div');
    message.className = 'saga-loredeck-health-group-message';
    message.textContent = group.summary;
    main.appendChild(message);
    summary.appendChild(main);
    card.appendChild(summary);
    if (!options.compact) {
        card.appendChild(createLoredeckHealthIssueDetailPanel(group, context, { embedded: true }));
    }
    return card;
}

function createLoredeckHealthIssueDetailPanel(group, context, options = {}) {
    const issueState = getLoredeckHealthIssueState(context.pack, group);
    const editable = !!context.pack && context.pack.type !== 'bundled';
    const panel = document.createElement('div');
    panel.className = `saga-loredeck-health-detail-panel${options.embedded ? ' saga-loredeck-health-detail-panel-embedded' : ''}`;
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = options.embedded ? 'Details' : `Issue: ${group.title}`;
    panel.appendChild(title);
    const why = document.createElement('div');
    why.className = 'saga-loredeck-health-detail-block';
    const whyTitle = document.createElement('strong');
    whyTitle.textContent = 'Why this matters';
    why.appendChild(whyTitle);
    const whyText = document.createElement('p');
    whyText.textContent = group.why;
    why.appendChild(whyText);
    panel.appendChild(why);
    const fix = document.createElement('div');
    fix.className = 'saga-loredeck-health-detail-block';
    const fixTitle = document.createElement('strong');
    fixTitle.textContent = 'Recommended fix';
    fix.appendChild(fixTitle);
    const fixText = document.createElement('p');
    fixText.textContent = group.fix;
    fix.appendChild(fixText);
    panel.appendChild(fix);

    if (context.pack) {
        const workflow = document.createElement('div');
        workflow.className = 'saga-loredeck-health-detail-block';
        const workflowTitle = document.createElement('strong');
        workflowTitle.textContent = 'Repair workflow';
        workflow.appendChild(workflowTitle);
        const workflowText = document.createElement('p');
        workflowText.textContent = editable
            ? 'Queue deterministic fixes or assistant drafts, review them in Pending Review, accept the changes, then rerun Refresh Scan. Accepted entry, tag, or timeline changes mark Deck Health stale until the rerun.'
            : 'Bundled Loredecks are read-only. Duplicate as Custom before repairing, ignoring, or marking issue state.';
        workflow.appendChild(workflowText);
        panel.appendChild(workflow);
    }

    const affected = createLoredeckHealthAffectedList(group);
    if (affected) panel.appendChild(affected);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Copy Details', 'Copy this grouped issue summary to clipboard.', async () => {
        await copyTextToClipboard(formatLoredeckHealthGroupForCopy(group), 'Deck Health issue copied.');
    }));
    if (group.files.length) {
        actions.appendChild(createButton('Copy File Path', 'Copy the first affected source file path.', async () => {
            await copyTextToClipboard(group.files[0], 'Affected file path copied.');
        }));
    }
    if (context.pack) {
        if (!editable) {
            actions.appendChild(createButton('Duplicate as Custom', 'Create an editable Custom Loredeck copy before repairing source-protected health issues.', () => {
                openDuplicateLoredeckDialog(context.pack);
            }));
        } else {
            const ignoreButton = createButton(issueState?.status === 'ignored' ? 'Clear Ignore' : 'Ignore Issue', issueState?.status === 'ignored' ? 'Clear this user-set ignored state.' : 'Mark this grouped issue as intentionally ignored for this editable Loredeck.', () => {
                setLoredeckHealthIssueGroupState(context.pack, group, issueState?.status === 'ignored' ? '' : 'ignored');
                renderLoredeckHealthCenterOverlay();
            });
            actions.appendChild(ignoreButton);
            const resolveButton = createButton(issueState?.status === 'resolved' ? 'Clear Resolved' : 'Mark Resolved', issueState?.status === 'resolved' ? 'Clear this user-set resolved state.' : 'Mark this grouped issue resolved after you have reviewed or repaired it.', () => {
                setLoredeckHealthIssueGroupState(context.pack, group, issueState?.status === 'resolved' ? '' : 'resolved');
                renderLoredeckHealthCenterOverlay();
            });
            actions.appendChild(resolveButton);
            const assistantButton = createButton('Draft With Assistant', 'Send only this grouped issue to the Lore Assistant as repair-planning context.', async (btn) => {
                await handleLoredeckAssistantHealthRepairDraft(context.pack, context.health, btn, {
                    selectedIssues: normalizeLoredeckHealthGroupIssuesForRepair(group),
                });
                renderLoredeckHealthCenterOverlay();
            });
            assistantButton.disabled = !canValidateLoredeckInEditor(context.pack);
            actions.appendChild(assistantButton);
            if (isLoredeckMalformedTagIssueGroup(group)) {
                const tagRepairButton = createButton('Queue Tag ID Repair', 'Queue deterministic malformed tag ID replacements for Pending Review.', async (btn) => {
                    await queueLoredeckMalformedTagRepairFromHealthGroup(context.pack, group, btn);
                    renderLoredeckHealthCenterOverlay();
                }, 'saga-primary-button');
                tagRepairButton.disabled = !canValidateLoredeckInEditor(context.pack);
                actions.appendChild(tagRepairButton);
            }
            const repairButton = createButton('Repair Safe Issues', 'Apply deterministic safe repairs available to this editable Loredeck record.', async (btn) => {
                await repairLoredeckSafeHealthIssues(context.pack, btn);
                renderLoredeckHealthCenterOverlay();
            });
            repairButton.disabled = !canValidateLoredeckInEditor(context.pack);
            actions.appendChild(repairButton);
        }
    }
    panel.appendChild(actions);
    return panel;
}

function createLoredeckHealthAffectedList(group) {
    const rows = getLoredeckHealthAffectedRows(group).slice(0, 12);
    if (!rows.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-affected-list';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Affected Items';
    wrap.appendChild(title);
    for (const row of rows) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-health-affected-row';
        for (const text of row) {
            const cell = document.createElement('span');
            cell.textContent = text;
            item.appendChild(cell);
        }
        wrap.appendChild(item);
    }
    const total = getLoredeckHealthAffectedCount(group);
    if (total > rows.length) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing first ${rows.length} of ${total}. Export the report for the full set.`;
        wrap.appendChild(more);
    }
    return wrap;
}

function createLoredeckHealthIssueTableHeader() {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-health-issue-table-row saga-loredeck-health-issue-table-header';
    for (const text of ['Severity', 'Issue', 'Affected', 'File', 'Action']) {
        const cell = document.createElement('div');
        cell.textContent = text;
        row.appendChild(cell);
    }
    return row;
}

function createLoredeckHealthIssueTableRow(group, context) {
    const issueState = getLoredeckHealthIssueState(context.pack, group);
    const row = document.createElement('details');
    row.className = `saga-loredeck-health-issue-table-row saga-loredeck-health-issue-table-row-${group.severity}`;
    if (issueState?.status) row.classList.add(`saga-loredeck-health-issue-table-row-state-${issueState.status}`);
    const summary = document.createElement('summary');
    const actionText = issueState?.status
        ? `${getLoredeckHealthIssueStateLabel(issueState, group)} | ${group.fixShort}`
        : group.fixShort;
    for (const text of [humanizeScopeKey(group.severity), group.title, group.affectedLabel, group.files[0] || 'Multiple / none', actionText]) {
        const cell = document.createElement('div');
        cell.textContent = text;
        summary.appendChild(cell);
    }
    row.appendChild(summary);
    row.appendChild(createLoredeckHealthIssueDetailPanel(group, context, { embedded: true }));
    return row;
}

function getLoredeckHealthAllIssues(report = {}) {
    const rows = [];
    const add = (items, severity) => {
        for (const raw of Array.isArray(items) ? items : []) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
            rows.push({ ...raw, severity: raw.severity || severity });
        }
    };
    add(report.errors, 'error');
    add(report.warnings, 'warning');
    add(report.suggestions, 'suggestion');
    add(report.insights, 'suggestion');
    return rows;
}

export function groupLoredeckHealthIssues(report = {}) {
    const map = new Map();
    for (const issue of getLoredeckHealthAllIssues(report)) {
        const severity = normalizeLoredeckHealthSeverity(issue.severity);
        const code = String(issue.code || severity || 'issue').trim() || 'issue';
        const files = collectLoredeckHealthIssueFiles(issue);
        const primaryFile = files[0] || '';
        const key = `${severity}|${code}|${primaryFile}`;
        if (!map.has(key)) {
            map.set(key, {
                severity,
                code,
                files: new Set(),
                tagIds: new Set(),
                entryIds: new Set(),
                timelineIds: new Set(),
                reasons: new Set(),
                issues: [],
            });
        }
        const group = map.get(key);
        group.issues.push(issue);
        for (const file of files) group.files.add(file);
        for (const tag of collectLoredeckHealthIssueTags(issue)) group.tagIds.add(tag);
        for (const id of normalizeLoredeckPendingIdList(issue.entryIds || issue.affectedEntryIds || [])) group.entryIds.add(id);
        for (const id of collectLoredeckHealthIssueTimelineIds(issue)) group.timelineIds.add(id);
        for (const reason of Array.isArray(issue.reasons) ? issue.reasons : []) {
            const text = String(reason || '').trim();
            if (text) group.reasons.add(text);
        }
    }
    return [...map.values()]
        .map(finalizeLoredeckHealthIssueGroup)
        .sort((a, b) => getLoredeckHealthSeverityWeight(a.severity) - getLoredeckHealthSeverityWeight(b.severity)
            || b.rawCount - a.rawCount
            || a.title.localeCompare(b.title));
}

function getLoredeckHealthIssueGroupsForContext(context = {}, options = {}) {
    const groups = groupLoredeckHealthIssues(context.report);
    if (options.includeIgnored === true) return groups;
    return groups.filter(group => getLoredeckHealthIssueState(context.pack, group)?.status !== 'ignored');
}

function getLoredeckHealthIssueStateCounts(context = {}, groups = groupLoredeckHealthIssues(context.report)) {
    const counts = { ignored: 0, resolved: 0 };
    for (const group of groups || []) {
        const status = getLoredeckHealthIssueState(context.pack, group)?.status;
        if (status === 'ignored') counts.ignored += 1;
        if (status === 'resolved') counts.resolved += 1;
    }
    return counts;
}

function finalizeLoredeckHealthIssueGroup(group) {
    const files = [...group.files];
    const tagIds = [...group.tagIds];
    const entryIds = [...group.entryIds];
    const timelineIds = [...group.timelineIds];
    const title = getLoredeckHealthIssueTitle(group.code);
    const advice = getLoredeckHealthIssueAdvice(group.code, group.severity);
    const affectedCount = tagIds.length || entryIds.length || timelineIds.length || group.issues.length;
    const affectedKind = tagIds.length ? 'tag' : (entryIds.length ? 'Lorecard' : (timelineIds.length ? 'timeline item' : 'finding'));
    const affectedLabel = `${affectedCount} affected ${affectedKind}${affectedCount === 1 ? '' : 's'}`;
    const issueKey = getLoredeckHealthIssueGroupKey({ ...group, files, tagIds, entryIds, timelineIds });
    return {
        ...group,
        issueKey,
        files,
        tagIds,
        entryIds,
        timelineIds,
        reasons: [...group.reasons],
        title,
        affectedLabel,
        rawCount: group.issues.length,
        summary: advice.summary || group.issues[0]?.message || title,
        why: advice.why,
        fix: advice.fix,
        fixShort: advice.fixShort,
        autoFixLabel: advice.autoFixLabel,
        autoFixTooltip: advice.autoFixTooltip,
    };
}

function getLoredeckHealthIssueGroupKey(group = {}) {
    const parts = [
        normalizeLoredeckHealthSeverity(group.severity),
        String(group.code || '').trim(),
        ...(group.files || []).map(item => `file:${String(item || '').trim()}`).sort(),
        ...(group.tagIds || []).map(item => `tag:${String(item || '').trim()}`).sort(),
        ...(group.entryIds || []).map(item => `entry:${String(item || '').trim()}`).sort(),
        ...(group.timelineIds || []).map(item => `timeline:${String(item || '').trim()}`).sort(),
    ].filter(Boolean);
    return `health_issue_${hashLoredeckHealthRepairIssueId(parts.join('|'))}`;
}

function getLoredeckHealthIssueState(pack = {}, group = {}) {
    const key = String(group.issueKey || getLoredeckHealthIssueGroupKey(group)).trim();
    if (!key) return null;
    return normalizeLoredeckHealthIssueStates(pack?.healthIssueStates)[key] || null;
}

function getLoredeckHealthIssueStateLabel(state = null, group = {}) {
    const status = String(state?.status || '').trim();
    if (status === 'ignored') return 'Ignored';
    if (status === 'resolved') return 'Marked resolved';
    return '';
}

function setLoredeckHealthIssueGroupState(pack = {}, group = {}, status = '') {
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    if (!fresh || fresh.type === 'bundled') {
        toast('Bundled Loredecks are read-only. Duplicate as Custom before setting issue state.', 'warning');
        return false;
    }
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const issueKey = String(group.issueKey || getLoredeckHealthIssueGroupKey(group)).trim();
    if (!issueKey) {
        toast('Deck Health issue state needs a stable issue key.', 'warning');
        return false;
    }
    const title = group.title || getLoredeckHealthIssueTitle(group.code);
    const message = normalizedStatus === 'ignored'
        ? `Marked Deck Health issue ignored: ${title}.`
        : (normalizedStatus === 'resolved'
            ? `Marked Deck Health issue resolved: ${title}. Rerun Deck Health to verify.`
            : `Cleared Deck Health issue state: ${title}.`);
    return persistLoredeckLibraryRecordMutation(fresh, next => {
        const states = normalizeLoredeckHealthIssueStates(next.healthIssueStates);
        if (['ignored', 'resolved'].includes(normalizedStatus)) {
            states[issueKey] = {
                issueKey,
                status: normalizedStatus,
                code: String(group.code || '').trim(),
                severity: normalizeLoredeckHealthSeverity(group.severity || ''),
                title,
                note: normalizedStatus === 'resolved'
                    ? 'Marked resolved by user. Rerun Deck Health after accepted repairs to verify it no longer appears.'
                    : 'Ignored by user. The finding remains in diagnostics but is no longer a priority for this deck.',
                updatedAt: Date.now(),
            };
        } else {
            delete states[issueKey];
        }
        next.healthIssueStates = states;
    }, message, {
        errorMessage: 'Deck Health issue state save failed.',
    });
}

export function normalizeLoredeckHealthSeverity(severity = '') {
    const key = String(severity || '').trim().toLowerCase();
    if (key === 'error') return 'error';
    if (key === 'warning') return 'warning';
    return 'suggestion';
}

function getLoredeckHealthSeverityWeight(severity = '') {
    return severity === 'error' ? 0 : (severity === 'warning' ? 1 : 2);
}

function getLoredeckHealthIssueTitle(code = '') {
    const key = String(code || '').trim();
    const titles = {
        malformed_tag_namespace: 'Tag IDs contain spaces or unsupported characters',
        undefined_tag: 'Tags are missing from the registry',
        deprecated_tag_used: 'Deprecated tags are still used',
        duplicate_tag_alias: 'Tag aliases point to multiple definitions',
        orphaned_tag_definition: 'Unused tag definitions',
        tag_registry_missing: 'Tag registry is missing',
        tag_registry_load_failed: 'Tag registry failed to load',
        tag_parent_missing: 'Tag parent is missing',
        deprecated_tag_replacement_missing: 'Deprecated tag replacement is missing',
        unnamespaced_bundled_tag: 'Bundled tags should be namespaced',
        missing_entry_file: 'Entry file failed to load',
        duplicate_entry_id: 'Duplicate Lorecard IDs',
        missing_entry_id: 'Lorecards are missing IDs',
        duplicate_manifest_file: 'Manifest lists duplicate files',
        manifest_entry_count_mismatch: 'Manifest entry count is stale',
        manifest_category_counts_mismatch: 'Manifest category counts are stale',
        schema_v3_legacy_timing_fields: 'Legacy timing fields remain in schema v3 entries',
        schema_v3_missing_context: 'Lorecards are missing Context',
        schema_v3_invalid_context_scope: 'Context scope is invalid',
        schema_v3_missing_context_sort_keys: 'Context sort keys are missing',
        schema_v3_missing_context_precision: 'Context precision is missing',
        schema_v3_missing_context_label: 'Context label is missing',
        schema_v3_missing_retrieval: 'Retrieval metadata is missing',
        schema_v3_incomplete_retrieval: 'Retrieval metadata is incomplete',
        schema_v3_missing_content: 'Lorecard content is incomplete',
        schema_v3_wide_lore_retrieval: 'Wide lore activation should be topic-gated',
        broken_anchor_reference: 'Context anchors are missing',
        invalid_context_window: 'Context window is invalid',
        unmatchable_context_gate: 'Context gate cannot match',
        context_gates_without_timeline: 'Context gates need a timeline registry',
        context_timeline_empty: 'Timeline registry is empty',
        context_timeline_registry_malformed: 'Timeline registry overlay is malformed',
        context_timeline_load_failed: 'Timeline registry failed to load',
        context_timeline_invalid_ref: 'Timeline registry path is invalid',
        timeline_anchor_sortkey_mismatch: 'Timeline anchor sort key mismatch',
        timeline_window_sortkey_mismatch: 'Timeline window sort key mismatch',
        timeline_candidate_sparse: 'Timeline candidates are sparse',
        timeline_anchor_coverage_concentrated: 'Timeline coverage is concentrated',
        timeline_windows_missing: 'Timeline windows are missing',
        custom_entry_overrides_applied: 'Custom overrides are active',
        likely_duplicate_pack: 'Likely duplicate deck loaded',
        shared_manifest_with_overrides: 'Loaded decks share a manifest',
        loaded_pack_missing_library_record: 'Loaded deck is missing from the Library',
        loaded_pack_not_available: 'Loaded deck did not produce a source',
        custom_duplicate_has_no_entry_changes: 'Custom duplicate has no Lorecard changes',
        empty_loredeck_stack: 'No Loredecks are loaded',
    };
    return titles[key] || humanizeScopeKey(key || 'Deck Health issue');
}

function getLoredeckHealthIssueAdvice(code = '', severity = 'suggestion') {
    const key = String(code || '').trim();
    const generic = {
        summary: severity === 'error' ? 'This issue can prevent reliable deck loading.' : 'This issue may reduce reliability, search, or future editing quality.',
        why: 'Deck Health checks help keep Loredecks predictable when they are loaded, stacked, edited, exported, or shared.',
        fix: 'Review the affected records, correct the underlying metadata, then rerun Deck Health.',
        fixShort: 'Review',
    };
    const advice = {
        malformed_tag_namespace: {
            summary: 'Some tags appear to use display labels as machine IDs.',
            why: 'Tag IDs with spaces, punctuation, or unsupported characters can break filtering, matching, namespace routing, and future bulk operations.',
            fix: 'Use stable machine-safe IDs while preserving readable labels in the tag registry, such as "Year 1" as label and "year-1" as ID.',
            fixShort: 'Normalize IDs',
            autoFixLabel: 'Deterministic fix',
            autoFixTooltip: 'Machine-safe IDs can be generated deterministically, but bundled or remote source files still need a protected edit path.',
        },
        undefined_tag: {
            summary: 'Used tags are not defined in the active tag registry.',
            why: 'Undefined tags still display, but they cannot carry labels, descriptions, colors, hierarchy, aliases, or deprecation metadata.',
            fix: 'Define these tags in tags.json or remove them from entries that do not need them.',
            fixShort: 'Define tags',
        },
        tag_registry_missing: {
            summary: 'Lorecards use tags, but this deck has no tag registry.',
            why: 'A registry separates machine IDs from readable labels and makes tags safer for filtering, editing, and creator guidance.',
            fix: 'Create a tags.json registry or embed a Custom tag registry before sharing the deck.',
            fixShort: 'Create registry',
        },
        schema_v3_missing_context: {
            summary: 'Schema v3 Lorecards should define Context eligibility.',
            why: 'Context prevents future canon leakage and lets Saga activate lore at the right point in the story.',
            fix: 'Add context.scope, sort keys, precision, label, and anchor/window references where appropriate.',
            fixShort: 'Add Context',
        },
        schema_v3_missing_retrieval: {
            summary: 'Lorecards are missing retrieval metadata.',
            why: 'Retrieval metadata tells Saga when a card is useful and prevents broad entries from over-injecting.',
            fix: 'Add retrieval activation, frequency, Context boost, and cue metadata.',
            fixShort: 'Add retrieval',
        },
        schema_v3_wide_lore_retrieval: {
            summary: 'Wide lore should activate from scene topics or entities.',
            why: 'Global lore can be valid background material, but broad automatic activation can inject it into unrelated scenes.',
            fix: 'Use topic-or-entity activation for wide/global entries. Frequency and Context boost can stay higher when the entry is intentionally common background lore.',
            fixShort: 'Gate activation',
        },
        missing_entry_file: {
            summary: 'A declared entry file did not load.',
            why: 'Missing files reduce deck coverage and may make manifest stats inaccurate.',
            fix: 'Check the manifest path, URL, filename, and browser accessibility for the affected file.',
            fixShort: 'Fix path',
        },
        duplicate_entry_id: {
            summary: 'Multiple Lorecards share the same ID.',
            why: 'Duplicate IDs make overrides and stack priority ambiguous.',
            fix: 'Give each Lorecard a unique stable ID, then rerun validation.',
            fixShort: 'Rename IDs',
        },
        broken_anchor_reference: {
            summary: 'Entries or windows reference timeline anchors that do not exist.',
            why: 'Broken anchors can make Context gates fail or behave unpredictably.',
            fix: 'Add the missing anchors to timeline.json or update entries to reference existing anchors.',
            fixShort: 'Fix anchors',
        },
        invalid_context_window: {
            summary: 'A Context window starts after it ends or has invalid boundaries.',
            why: 'Invalid windows can make entries never eligible or eligible at the wrong time.',
            fix: 'Check anchor order, sort keys, and window start/end references.',
            fixShort: 'Fix window',
        },
        timeline_candidate_sparse: {
            summary: 'The timeline may be too sparse for the number of Context-gated Lorecards.',
            why: 'The Reasoner can translate casual phrasing, but it still needs a healthy set of known story candidates to choose from.',
            fix: 'Add durable anchors/windows for recurring high-value story moments, major reveals, arc turns, generated Creator output, or accepted user/model suggestions. Do not add aliases for every possible phrase.',
            fixShort: 'Add waypoints',
        },
        timeline_anchor_coverage_concentrated: {
            summary: 'Many Context gates cluster around only a few anchors.',
            why: 'Over-concentrated anchors make broad areas of canon feel like one large bucket and reduce Context Browser usefulness.',
            fix: 'Split the coverage around meaningful story turns, relationship changes, location shifts, public knowledge changes, battles, lessons, or arc transitions.',
            fixShort: 'Split anchors',
        },
        timeline_windows_missing: {
            summary: 'The timeline has anchors but no broad selectable windows.',
            why: 'Windows let users choose ranges like arcs, school years, phases, seasons, or before/after spans without selecting a single exact event.',
            fix: 'Add broad windows over existing anchors for arcs, years, phases, seasons, quests, or chapters.',
            fixShort: 'Add windows',
        },
        manifest_entry_count_mismatch: {
            summary: 'Manifest stats do not match the loaded deck.',
            why: 'Stale stats make library cards and sharing metadata misleading.',
            fix: 'Refresh manifest stats from Deck Health before exporting or sharing.',
            fixShort: 'Refresh stats',
        },
    };
    return { ...generic, ...(advice[key] || {}) };
}

export function collectLoredeckHealthIssueTags(issue = {}) {
    const tags = [];
    const push = value => {
        const text = String(value || '').trim();
        if (text && !tags.includes(text)) tags.push(text);
    };
    for (const tag of Array.isArray(issue.tagIds) ? issue.tagIds : []) push(tag);
    if (issue.tag) push(issue.tag);
    for (const tag of Array.isArray(issue.tags) ? issue.tags : []) {
        if (typeof tag === 'string') push(tag);
        else push(tag?.tag || tag?.id || '');
    }
    return tags;
}

function collectLoredeckHealthIssueFiles(issue = {}) {
    const files = [];
    const push = value => {
        const text = String(value || '').trim();
        if (text && !files.includes(text)) files.push(text);
    };
    push(issue.file);
    for (const tag of Array.isArray(issue.tags) ? issue.tags : []) {
        if (tag && typeof tag === 'object') {
            for (const file of Array.isArray(tag.files) ? tag.files : []) push(file);
        }
    }
    return files;
}

function collectLoredeckHealthIssueTimelineIds(issue = {}) {
    return normalizeLoredeckPendingTimelineIdList([
        issue.anchorId || '',
        issue.timelineWindowId || '',
        ...(Array.isArray(issue.anchorIds) ? issue.anchorIds : []),
        ...(Array.isArray(issue.timelineIds) ? issue.timelineIds : []),
    ]);
}

function getLoredeckHealthAffectedCount(group = {}) {
    return group.tagIds?.length || group.entryIds?.length || group.timelineIds?.length || group.rawCount || 0;
}

function getLoredeckHealthAffectedRows(group = {}) {
    const rows = [];
    if (group.tagIds?.length) {
        for (const tag of group.tagIds) rows.push([tag, suggestLoredeckMachineId(tag), group.files[0] || '']);
        return rows;
    }
    if (group.entryIds?.length) {
        for (const id of group.entryIds) rows.push([id, group.code, group.files[0] || '']);
        return rows;
    }
    if (group.timelineIds?.length) {
        for (const id of group.timelineIds) rows.push([id, group.code, group.files[0] || '']);
        return rows;
    }
    for (const issue of group.issues || []) rows.push([issue.code || group.code, issue.message || '', issue.file || '']);
    return rows;
}

export function suggestLoredeckMachineId(value = '') {
    return normalizeLoredeckTagId(value) || String(value || '').trim().toLowerCase().replace(/[^a-z0-9:._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function normalizeLoredeckTagId(value = '') {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/:+/g, ':')
        .replace(/^[\s:._/-]+|[\s:._/-]+$/g, '')
        .toLowerCase()
        .slice(0, 96)
        .trim();
}

function formatLoredeckHealthGroupForCopy(group = {}) {
    const lines = [
        `${group.title}`,
        `Severity: ${humanizeScopeKey(group.severity || 'suggestion')}`,
        `Affected: ${group.affectedLabel || ''}`,
        group.files?.length ? `Files: ${group.files.join(', ')}` : '',
        '',
        `Why this matters: ${group.why || ''}`,
        `Recommended fix: ${group.fix || ''}`,
    ].filter(line => line !== '');
    const rows = getLoredeckHealthAffectedRows(group).slice(0, 20);
    if (rows.length) {
        lines.push('', 'Affected items:');
        for (const row of rows) lines.push(`- ${row.filter(Boolean).join(' | ')}`);
    }
    return lines.join('\n');
}

function getLoredeckHealthFileRows(context = {}) {
    const rows = new Map();
    const addFile = (file, data = {}) => {
        const key = String(file || '').trim();
        if (!key) return;
        const current = rows.get(key) || { file: key, entries: 0, errors: 0, warnings: 0, suggestions: 0 };
        current.entries = Math.max(current.entries || 0, Number(data.entries) || 0);
        current.errors += Number(data.errors) || 0;
        current.warnings += Number(data.warnings) || 0;
        current.suggestions += Number(data.suggestions) || 0;
        rows.set(key, current);
    };
    for (const fileRecord of context.cached?.entryFiles || []) {
        addFile(fileRecord.file, {
            entries: Array.isArray(fileRecord.entries) ? fileRecord.entries.length : 0,
            errors: fileRecord.ok === false ? 1 : 0,
        });
    }
    for (const issue of getLoredeckHealthAllIssues(context.report)) {
        const files = collectLoredeckHealthIssueFiles(issue);
        for (const file of files) {
            addFile(file, {
                errors: normalizeLoredeckHealthSeverity(issue.severity) === 'error' ? 1 : 0,
                warnings: normalizeLoredeckHealthSeverity(issue.severity) === 'warning' ? 1 : 0,
                suggestions: normalizeLoredeckHealthSeverity(issue.severity) === 'suggestion' ? 1 : 0,
            });
        }
    }
    return [...rows.values()]
        .map(row => ({
            ...row,
            statusTone: row.errors ? 'error' : (row.warnings ? 'warning' : 'ok'),
            status: row.errors ? 'Blocked' : (row.warnings ? 'Review' : 'Healthy'),
        }))
        .sort((a, b) => b.errors - a.errors || b.warnings - a.warnings || a.file.localeCompare(b.file));
}

export function formatRelativeHealthTime(timestamp = 0) {
    const value = Number(timestamp) || 0;
    if (!value) return 'unknown';
    const delta = Date.now() - value;
    if (delta < 60000) return 'just now';
    const minutes = Math.floor(delta / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(value).toLocaleString();
}

async function copyTextToClipboard(text = '', successMessage = 'Copied.') {
    try {
        await navigator.clipboard?.writeText(String(text || ''));
        toast(successMessage, 'info');
    } catch (_) {
        toast('Clipboard copy unavailable in this browser context.', 'warning');
    }
}

async function refreshLoredeckHealthCenterScan(context = getLoredeckHealthCenterContext(), button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Scanning...';
    }
    try {
        if (context.pack) {
            const result = await validateLoredeckForEditor(context.pack, null, { quiet: true, updateLibrary: true });
            if (!result.health) throw new Error(result.error || 'Deck Health scan failed.');
            refreshLoredeckSurfaces();
        } else {
            clearCanonLoreDatabaseCache();
            clearContextIndexCache();
            await loadCanonLoreDatabase();
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            refreshHeader();
        }
    } catch (e) {
        toast(e?.message || 'Deck Health scan failed.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Refresh Scan';
        }
        renderLoredeckHealthCenterOverlay();
    }
}

function exportLoredeckHealthCenterReport(context = getLoredeckHealthCenterContext()) {
    if (!context.health) {
        toast('Deck Health has not loaded yet.', 'warning');
        return;
    }
    const fileStem = sanitizeFileStem(context.pack?.packId || context.report.databaseId || 'saga-deck-health');
    downloadJson(redactDiagnosticValue(context.report), `${fileStem}.health.json`);
}

function createLoredeckHealthMetric(label, value, tooltip) {
    const metric = document.createElement('div');
    metric.className = 'saga-loredeck-health-metric';
    addTooltip(metric, tooltip || label);
    const k = document.createElement('span');
    k.textContent = label;
    metric.appendChild(k);
    const v = document.createElement('strong');
    v.textContent = value || '0';
    metric.appendChild(v);
    return metric;
}

function createLoredeckHealthPackRow(pack) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-health-pack-row';
    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = pack.title || pack.packId;
    main.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    desc.textContent = pack.description || pack.manifest || pack.packId;
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(pack.typeLabel || pack.type || 'Custom', 'Loredeck type.'));
    meta.appendChild(createStatusPill(`${pack.entryCount || 0} entries`, 'Loaded entries from this pack.'));
    meta.appendChild(createStatusPill(pack.healthStatus || 'unknown', 'Per-pack health status.'));
    if (pack.overrideCount) meta.appendChild(createStatusPill(`${pack.overrideCount} overrides`, 'Saved entry overrides in the library record.'));
    if (pack.disabledCount) meta.appendChild(createStatusPill(`${pack.disabledCount} disabled`, 'Disabled source entry IDs in the library record.'));
    if (pack.derivedFrom) meta.appendChild(createStatusPill(`from ${pack.derivedFrom}`, 'Source pack recorded in derivedFrom metadata.'));
    main.appendChild(meta);
    row.appendChild(main);
    return row;
}

function createLoredeckHealthIssueList(titleText, issues = [], severity = 'suggestion') {
    const wrap = document.createElement('div');
    wrap.className = `saga-loredeck-health-issue-section saga-loredeck-health-issue-section-${severity}`;

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = `${titleText}: ${issues.length}`;
    wrap.appendChild(title);

    if (!issues.length) {
        wrap.appendChild(createEmptyMessage(`No ${titleText.toLowerCase()}.`));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-health-issue-list';
    for (const issue of issues.slice(0, 12)) {
        const item = document.createElement('div');
        item.className = `saga-loredeck-health-issue saga-loredeck-health-issue-${severity}`;
        const code = document.createElement('div');
        code.className = 'saga-loredeck-health-issue-code';
        code.textContent = issue.code || severity;
        item.appendChild(code);
        const message = document.createElement('div');
        message.className = 'saga-loredeck-health-issue-message';
        message.textContent = issue.message || 'No message.';
        item.appendChild(message);
        const meta = document.createElement('div');
        meta.className = 'saga-loredeck-row-meta';
        if (issue.packId) meta.appendChild(createStatusPill(issue.packId, 'Affected pack ID.'));
        if (Array.isArray(issue.entryIds) && issue.entryIds.length) meta.appendChild(createStatusPill(`${issue.entryIds.length} entr${issue.entryIds.length === 1 ? 'y' : 'ies'}`, 'Affected entry IDs.'));
        if (issue.file) meta.appendChild(createStatusPill(issue.file, 'Affected file.'));
        if (issue.anchorId) meta.appendChild(createStatusPill(`anchor: ${issue.anchorId}`, 'Affected Context anchor.'));
        if (Array.isArray(issue.anchorIds) && issue.anchorIds.length) meta.appendChild(createStatusPill(`${issue.anchorIds.length} anchor${issue.anchorIds.length === 1 ? '' : 's'}`, 'Affected Context anchors.'));
        if (issue.timelineWindowId) meta.appendChild(createStatusPill(`window: ${issue.timelineWindowId}`, 'Affected Context timeline window.'));
        if (issue.contextField) meta.appendChild(createStatusPill(issue.contextField, 'Affected Context field.'));
        if (Array.isArray(issue.contextFields) && issue.contextFields.length) meta.appendChild(createStatusPill(issue.contextFields.join(', '), 'Affected Context fields.'));
        if (issue.winningPackId) meta.appendChild(createStatusPill(`winner: ${issue.winningPackId}`, 'Winning pack after stack duplicate resolution.'));
        item.appendChild(meta);
        list.appendChild(item);
    }
    if (issues.length > 12) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing first 12 of ${issues.length}. Export Health JSON for the full list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

export function buildLoredeckHealthReport(state, canonDb = null, health = null) {
    const stack = getLoredeckStack(state);
    const library = new Map(getLoredeckLibrary(state).map(pack => [pack.packId, pack]));
    const loadedPacks = Array.isArray(canonDb?.loredecks) ? canonDb.loredecks : [];
    const enabledIds = new Set(loadedPacks.length
        ? loadedPacks.map(pack => pack.id).filter(Boolean)
        : resolveLoredeckStackItems(stack, getLoredeckLibraryIndexForPacks(state), {
            packs: Object.fromEntries(library.entries()),
        }).stack.map(item => item.packId).filter(Boolean));
    const packs = loadedPacks.map(loaded => {
        const libraryPack = library.get(loaded.id) || {};
        const overrideCount = libraryPack.entryOverrides && typeof libraryPack.entryOverrides === 'object' && !Array.isArray(libraryPack.entryOverrides)
            ? Object.keys(libraryPack.entryOverrides).length
            : 0;
        const disabledCount = Array.isArray(libraryPack.disabledEntryIds) ? libraryPack.disabledEntryIds.length : 0;
        return {
            packId: loaded.id,
            title: loaded.title || libraryPack.title || loaded.id,
            type: loaded.type || libraryPack.type || 'custom',
            typeLabel: getLoredeckTypeLabel(loaded.id),
            description: libraryPack.description || '',
            manifest: libraryPack.manifest || '',
            derivedFrom: libraryPack.derivedFrom?.packId || '',
            stackIndex: loaded.stackIndex,
            stackPriority: loaded.stackPriority,
            sourceKind: loaded.sourceKind,
            entryCount: loaded.entryCount || 0,
            healthStatus: loaded.healthStatus || 'unknown',
            overrideCount,
            disabledCount,
        };
    });
    const duplicateEntryIdCount = Array.isArray(canonDb?.duplicateEntryIds)
        ? canonDb.duplicateEntryIds.length
        : Number(health?.summary?.duplicateEntryIdCount || 0);
    return {
        schemaVersion: 1,
        generatedAt: Date.now(),
        scanned: !!health,
        status: health?.status || 'unknown',
        databaseId: canonDb?.databaseId || '',
        enabledPackIds: Array.from(enabledIds),
        summary: health?.summary || {},
        duplicateEntryIdCount,
        packs,
        errors: Array.isArray(health?.errors) ? health.errors : [],
        warnings: Array.isArray(health?.warnings) ? health.warnings : [],
        suggestions: Array.isArray(health?.suggestions) ? health.suggestions : [],
        insights: getLoredeckStackHealthInsights(state, loadedPacks),
    };
}

function getLoredeckStackHealthInsights(state, loadedPacks = []) {
    const stackItems = getLoredeckStack(state).filter(item => item.enabled);
    const libraryPacks = getLoredeckLibrary(state);
    const library = new Map(libraryPacks.map(pack => [pack.packId, pack]));
    const stack = resolveLoredeckStackItems(stackItems, getLoredeckLibraryIndexForPacks(state, libraryPacks), {
        packs: Object.fromEntries(library.entries()),
    }).stack;
    const loadedIds = new Set(loadedPacks.map(pack => pack.id));
    const issues = [];

    for (const item of stack) {
        const pack = library.get(item.packId);
        if (!pack) {
            issues.push({
                severity: 'warning',
                code: 'loaded_pack_missing_library_record',
                packId: item.packId,
                message: `Loaded deck ${item.packId} is not present in the Loredeck Library.`,
            });
            continue;
        }
        if (!loadedIds.has(item.packId)) {
            issues.push({
                severity: 'warning',
                code: 'loaded_pack_not_available',
                packId: item.packId,
                message: `Loaded deck ${item.packId} did not produce a usable Loredeck source.`,
            });
        }
    }

    const manifestGroups = new Map();
    for (const item of stack) {
        const pack = library.get(item.packId);
        const manifest = String(pack?.manifest || '').trim();
        if (!manifest) continue;
        if (!manifestGroups.has(manifest)) manifestGroups.set(manifest, []);
        manifestGroups.get(manifest).push(pack);
    }
    for (const [manifest, packs] of manifestGroups.entries()) {
        if (packs.length <= 1) continue;
        const names = packs.map(pack => pack?.title || pack?.packId).join(', ');
        const editableCount = packs.filter(pack => {
            const overrides = pack?.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
                ? Object.keys(pack.entryOverrides).length
                : 0;
            const disabled = Array.isArray(pack?.disabledEntryIds) ? pack.disabledEntryIds.length : 0;
            return overrides + disabled > 0;
        }).length;
        issues.push({
            severity: editableCount ? 'suggestion' : 'warning',
            code: editableCount ? 'shared_manifest_with_overrides' : 'likely_duplicate_pack',
            packId: packs[0]?.packId || '',
            message: editableCount
                ? `Multiple loaded packs share ${manifest}; ${editableCount} have Custom entry changes. Stack priority decides duplicate IDs.`
                : `Multiple loaded packs share ${manifest} with no Custom entry changes: ${names}. This may be an unedited duplicate load.`,
        });
    }

    for (const pack of library.values()) {
        if (!pack?.derivedFrom?.packId) continue;
        if (!stack.some(item => item.packId === pack.packId)) continue;
        const overrides = pack.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
            ? Object.keys(pack.entryOverrides).length
            : 0;
        const disabled = Array.isArray(pack.disabledEntryIds) ? pack.disabledEntryIds.length : 0;
        if (overrides + disabled === 0) {
            issues.push({
                severity: 'warning',
                code: 'custom_duplicate_has_no_entry_changes',
                packId: pack.packId,
                message: `${pack.title || pack.packId} is derived from ${pack.derivedFrom.packId} but has no entry overrides or disabled entries.`,
            });
        }
    }
    return issues;
}

export async function refreshLoredeckHealthReport(button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Refreshing...';
    }
    try {
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        await loadCanonLoreDatabase();
        refreshLoredeckSurfaces();
    } catch (e) {
        toast(e?.message || 'Deck Health refresh failed.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Refresh Health';
        }
    }
}

export function exportLoredeckHealthReport(state, canonDb = null, health = null) {
    if (!health) {
        toast('Deck Health has not loaded yet.', 'warning');
        return;
    }
    downloadJson(buildLoredeckHealthReport(state, canonDb, health), 'saga-pack-health.json');
}
