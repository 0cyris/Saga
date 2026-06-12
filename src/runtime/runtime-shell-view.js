/**
 * runtime-shell-view.js - Saga
 * Runtime rail, drawer, and header rendering.
 */

import { getPanelLoreState } from '../lorecards/lore-matrix.js';
import { getDefaultState } from '../state/constants.js';
import {
    getSettings,
    getState,
} from '../state/state-manager.js';
import {
    getBrandLogoSrc,
    getTabIconSrc,
    applyRuntimeTheme,
} from '../theme/runtime-theme.js';
import {
    addTooltip,
    createIconButton,
    createStatusPill,
} from '../ui/runtime-ui-kit.js';
import {
    getConstrainedDrawerHeight,
    getConstrainedDrawerWidth,
    getRailWidth,
    normalizePanelLayoutState,
    normalizeRailMode,
    onRuntimeDrawerResizeStart,
    onRuntimeRailDragStart,
    resolveDrawerDirection,
    updateDrawerScrollMetrics,
} from './runtime-shell.js';
import { markTourTarget } from './runtime-tour.js';
import {
    TAB_ICONS,
    getAutomationLabel,
    getAutomationTooltip,
    getExperienceLabel,
    getExperienceTooltip,
    getTabLabelForExperience,
    getTabTooltipForExperience,
    getVisibleTabsForExperience,
    normalizeExperienceMode,
    normalizeTabForExperience,
} from './runtime-navigation.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureRuntimeShellView(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function renderPanelShell(root, state) {
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const railMode = normalizeRailMode(panelState.railMode);
    const drawerOpen = panelState.drawerOpen === true;
    const drawerDirection = drawerOpen ? resolveDrawerDirection(panelState) : 'right';
    const settings = getSettings();

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.classList.add(`saga-runtime-rail-${railMode}`);
    if (drawerOpen) root.classList.add('saga-runtime-drawer-open');
    root.dataset.railMode = railMode;
    root.dataset.drawerDirection = drawerDirection;
    root.style.setProperty('--saga-rail-width', `${getRailWidth(panelState)}px`);
    root.style.setProperty('--saga-drawer-width', `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`);
    root.style.setProperty('--saga-drawer-height', `${getConstrainedDrawerHeight(panelState)}px`);
    applyRuntimeTheme(root, settings);

    root.appendChild(renderRail(state));
    if (drawerOpen) root.appendChild(renderDrawer(state, drawerDirection));

    refreshRuntimeHeader(root);
}

export function renderPanelFallbackShell(root, state, error) {
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const railMode = normalizeRailMode(panelState.railMode);
    const drawerDirection = panelState.drawerOpen === true ? resolveDrawerDirection(panelState) : 'right';
    const settings = getSettings();

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.classList.add(`saga-runtime-rail-${railMode}`);
    root.classList.add('saga-runtime-drawer-open');
    root.dataset.railMode = railMode;
    root.dataset.drawerDirection = drawerDirection;
    root.style.setProperty('--saga-rail-width', `${getRailWidth(panelState)}px`);
    root.style.setProperty('--saga-drawer-width', `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`);
    root.style.setProperty('--saga-drawer-height', `${getConstrainedDrawerHeight(panelState)}px`);
    applyRuntimeTheme(root, settings);

    root.appendChild(renderRail(state));

    const drawer = document.createElement('div');
    drawer.className = `saga-runtime-drawer saga-runtime-drawer-${drawerDirection}`;
    drawer.style.width = `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`;
    drawer.style.height = `${getConstrainedDrawerHeight(panelState)}px`;
    const header = document.createElement('div');
    header.className = 'saga-runtime-drawer-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-panel-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-panel-title saga-runtime-drawer-title';
    title.textContent = 'Saga';
    titleWrap.appendChild(title);
    const status = document.createElement('div');
    status.className = 'saga-lore-panel-status saga-runtime-drawer-status';
    titleWrap.appendChild(status);
    header.appendChild(titleWrap);
    drawer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-lore-panel-body';
    const tabBody = document.createElement('div');
    tabBody.className = 'saga-runtime-tab-body';
    tabBody.appendChild(dep('createRuntimeRenderErrorCard')('Runtime Window', error));
    body.appendChild(tabBody);
    drawer.appendChild(body);
    root.appendChild(drawer);
}

function renderRail(state) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const railMode = normalizeRailMode(panelState.railMode);
    const drawerOpen = panelState.drawerOpen === true;
    const settings = getSettings();
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);
    const metrics = dep('getRailMetrics', () => ({}))(state, settings);
    const metricTooltips = dep('getRailMetricTooltips', () => ({}))(state, settings);

    const rail = document.createElement('div');
    rail.className = `saga-runtime-rail saga-runtime-rail-${railMode}`;

    const drag = document.createElement('div');
    drag.className = 'saga-runtime-rail-drag';
    drag.addEventListener('mousedown', onRuntimeRailDragStart);
    addTooltip(drag, 'Drag to move the Saga rail. The drawer stays anchored to this rail.');

    const mark = document.createElement('div');
    mark.className = 'saga-runtime-rail-mark';

    const markImg = document.createElement('img');
    markImg.className = 'saga-runtime-rail-logo-img';
    markImg.src = getBrandLogoSrc(railMode, settings);
    markImg.alt = railMode === 'compact' ? 'SAGA' : 'SAGA logo';
    markImg.draggable = false;
    markImg.addEventListener('error', () => {
        markImg.remove();
        mark.textContent = railMode === 'compact' ? 'S' : 'SAGA';
        mark.classList.add('saga-runtime-rail-mark-fallback');
    }, { once: true });
    mark.appendChild(markImg);
    drag.appendChild(mark);

    const sub = document.createElement('div');
    sub.className = 'saga-runtime-rail-subtitle';
    sub.textContent = railMode === 'expanded' ? 'Fandom Loresystem' : '';
    drag.appendChild(sub);
    rail.appendChild(drag);
    rail.appendChild(createExperienceModeSwitch(settings));

    const tabs = document.createElement('div');
    tabs.className = 'saga-runtime-rail-tabs';
    const visibleTabs = getVisibleTabsForExperience(settings);
    for (const tabId of visibleTabs) {
        const label = getTabLabelForExperience(tabId, settings);
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'saga-runtime-rail-tab';
        tab.dataset.tabId = tabId;
        const isGlobalLoredecksTab = tabId === 'loredecks';
        if (isGlobalLoredecksTab) tab.classList.add('saga-runtime-rail-tab-global');
        if (drawerOpen && tabId === activeTab) tab.classList.add('saga-runtime-rail-tab-active');
        addTooltip(tab, getTabTooltipForExperience(tabId, settings));

        const icon = document.createElement('span');
        icon.className = 'saga-runtime-rail-icon';
        icon.dataset.fallbackIcon = TAB_ICONS[tabId] || label.slice(0, 1);
        const iconSrc = getTabIconSrc(tabId, settings);
        if (iconSrc) {
            const iconImg = document.createElement('img');
            iconImg.className = 'saga-runtime-rail-icon-img';
            iconImg.src = iconSrc;
            iconImg.alt = '';
            iconImg.draggable = false;
            iconImg.addEventListener('error', () => {
                icon.classList.add('saga-runtime-rail-icon-missing');
                icon.textContent = TAB_ICONS[tabId] || label.slice(0, 1);
            }, { once: true });
            icon.appendChild(iconImg);
        } else {
            icon.textContent = TAB_ICONS[tabId] || label.slice(0, 1);
        }
        tab.appendChild(icon);

        const labelEl = document.createElement('span');
        labelEl.className = 'saga-runtime-rail-label';
        labelEl.textContent = label;
        tab.appendChild(labelEl);

        const metric = document.createElement('span');
        metric.className = 'saga-runtime-rail-metric';
        metric.dataset.tabId = tabId;
        dep('renderRailMetric')(metric, tabId, metrics, metricTooltips);
        tab.appendChild(metric);

        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            dep('toggleRuntimeDrawerForTab')(tabId);
        });
        tabs.appendChild(tab);
        if (isGlobalLoredecksTab && visibleTabs.length > 1) {
            const divider = document.createElement('div');
            divider.className = 'saga-runtime-rail-tab-divider';
            divider.setAttribute('aria-hidden', 'true');
            tabs.appendChild(divider);
        }
    }
    rail.appendChild(tabs);

    const controls = document.createElement('div');
    controls.className = 'saga-runtime-rail-controls';

    const density = createIconButton(
        railMode === 'compact' ? '>' : '<',
        railMode === 'compact' ? 'Show labels and compact metrics.' : 'Use icons only.',
        'saga-runtime-rail-control saga-runtime-rail-density',
        (e) => {
            e.stopPropagation();
            dep('toggleRuntimeRailMode')();
        }
    );
    controls.appendChild(density);

    const close = createIconButton(
        'x',
        'Close the Saga rail. Reopen it from the extension launcher.',
        'saga-runtime-rail-control saga-runtime-rail-close',
        (e) => {
            e.stopPropagation();
            dep('hideRuntimePanel')();
        }
    );
    controls.appendChild(close);
    rail.appendChild(controls);

    return rail;
}

function createExperienceModeSwitch(settings = getSettings()) {
    const mode = normalizeExperienceMode(settings.experienceMode);
    const control = document.createElement('div');
    control.className = `saga-experience-switch saga-experience-switch-${mode}`;
    markTourTarget(control, 'session.experienceMode');
    control.setAttribute('role', 'radiogroup');
    control.setAttribute('aria-label', `Experience Mode: ${getExperienceLabel(settings)}`);
    addTooltip(control, getExperienceTooltip(settings));

    const basic = document.createElement('button');
    basic.type = 'button';
    basic.className = 'saga-experience-switch-label saga-experience-switch-label-basic';
    basic.textContent = 'Basic';
    basic.setAttribute('role', 'radio');
    basic.setAttribute('aria-checked', mode === 'basic' ? 'true' : 'false');
    addTooltip(basic, 'Switch to Basic Experience.');
    basic.addEventListener('click', (event) => {
        event.stopPropagation();
        selectExperienceMode('basic');
    });
    control.appendChild(basic);

    const advanced = document.createElement('button');
    advanced.type = 'button';
    advanced.className = 'saga-experience-switch-label saga-experience-switch-label-advanced';
    advanced.textContent = 'Advanced';
    advanced.setAttribute('role', 'radio');
    advanced.setAttribute('aria-checked', mode === 'advanced' ? 'true' : 'false');
    addTooltip(advanced, 'Switch to Advanced Experience.');
    advanced.addEventListener('click', (event) => {
        event.stopPropagation();
        selectExperienceMode('advanced');
    });
    control.appendChild(advanced);

    const knob = document.createElement('span');
    knob.className = 'saga-experience-switch-knob';
    control.appendChild(knob);

    return control;
}

function selectExperienceMode(mode) {
    const normalized = normalizeExperienceMode(mode);
    const current = normalizeExperienceMode(getSettings().experienceMode);
    if (current === normalized) return;
    dep('setExperienceMode')(normalized);
    dep('showRuntimePanel')();
}

function renderDrawer(state, direction = 'right') {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const settings = getSettings();
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);

    const drawer = document.createElement('div');
    drawer.className = `saga-runtime-drawer saga-runtime-drawer-${direction}`;
    drawer.style.width = `${getConstrainedDrawerWidth(panelState, direction)}px`;
    drawer.style.height = `${getConstrainedDrawerHeight(panelState)}px`;

    const header = document.createElement('div');
    header.className = 'saga-runtime-drawer-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-panel-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-panel-title saga-runtime-drawer-title';
    title.textContent = getTabLabelForExperience(activeTab, settings);
    addTooltip(title, getTabTooltipForExperience(activeTab, settings));
    titleWrap.appendChild(title);

    const status = document.createElement('div');
    status.className = 'saga-lore-panel-status saga-runtime-drawer-status';
    titleWrap.appendChild(status);
    header.appendChild(titleWrap);

    drawer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-lore-panel-body';
    drawer.appendChild(body);
    dep('renderPanelBody')(body, state);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'saga-lore-panel-resize-handle saga-runtime-drawer-resize-handle';
    resizeHandle.addEventListener('pointerdown', onRuntimeDrawerResizeStart);
    addTooltip(resizeHandle, 'Drag to resize the active drawer. The size is remembered across tabs.');
    drawer.appendChild(resizeHandle);

    updateDrawerScrollMetrics(drawer);
    return drawer;
}

export function refreshRuntimeHeader(panelRoot) {
    if (!panelRoot) return;

    const state = getState();
    normalizePanelLayoutState(state);
    const settings = getSettings();
    const metrics = dep('getRailMetrics', () => ({}))(state, settings);
    const metricTooltips = dep('getRailMetricTooltips', () => ({}))(state, settings);
    const renderRailMetric = dep('renderRailMetric');

    for (const metric of panelRoot.querySelectorAll('.saga-runtime-rail-metric[data-tab-id]')) {
        const tabId = metric.dataset.tabId;
        renderRailMetric(metric, tabId, metrics, metricTooltips);
    }

    const status = panelRoot.querySelector('.saga-runtime-drawer-status');
    if (!status) return;

    const pendingLore = (state?.pendingLoreEntries || []).length;
    const pendingDelta = state?.lastDelta ? 1 : 0;
    const counts = getPanelLoreState(state).counts;
    const selectedLore = dep('getSelectedLoreInjectionCount', () => 0)(state, settings);

    status.innerHTML = '';
    status.appendChild(createStatusPill(`Experience: ${getExperienceLabel(settings)}`, getExperienceTooltip(settings), { tone: 'info', kind: 'status' }));
    status.appendChild(createStatusPill(`Automation: ${getAutomationLabel(settings)}`, getAutomationTooltip(settings), { tone: 'info', kind: 'status' }));
    status.appendChild(createStatusPill(settings.enabled ? 'Active' : 'Paused', 'Master runtime toggle. When paused, Saga does not inject, scan, or generate.', { tone: settings.enabled ? 'success' : 'muted', kind: 'status' }));
    status.appendChild(createStatusPill((settings.injectContinuity !== false && settings.injectMemo !== false) ? 'Continuity Injected' : 'Continuity Not Injected', 'Whether Saga includes structured continuity state in roleplay generation prompts.', { tone: (settings.injectContinuity !== false && settings.injectMemo !== false) ? 'success' : 'muted', kind: 'status' }));
    if (pendingDelta + pendingLore > 0) {
        status.appendChild(createStatusPill(`Pending: ${pendingDelta + pendingLore}`, 'Pending generated lore entries plus any legacy continuity delta.', { tone: 'review', kind: 'count' }));
    }
    status.appendChild(createStatusPill(`Lore Selected: ${selectedLore}`, 'Accepted lore entries selected for the next injection after context activation, priority, pinning, and muting.', { tone: selectedLore ? 'selected' : 'muted', kind: 'count' }));
    void counts;
}

export function refreshRuntimeRailIcons(panelRoot, settings = getSettings()) {
    if (!panelRoot) return;
    const state = getState();
    const railMode = normalizeRailMode(state?.lorePanel?.railMode);
    const logo = panelRoot.querySelector('.saga-runtime-rail-logo-img');
    if (logo) {
        logo.src = getBrandLogoSrc(railMode, settings);
        logo.alt = railMode === 'compact' ? 'SAGA' : 'SAGA logo';
    }
    for (const tab of panelRoot.querySelectorAll('.saga-runtime-rail-tab[data-tab-id]')) {
        const tabId = tab.dataset.tabId;
        const icon = tab.querySelector('.saga-runtime-rail-icon');
        if (!icon) continue;
        const label = getTabLabelForExperience(tabId, settings);
        const fallback = TAB_ICONS[tabId] || label.slice(0, 1);
        icon.classList.remove('saga-runtime-rail-icon-missing');
        icon.dataset.fallbackIcon = fallback;
        icon.textContent = '';
        const iconSrc = getTabIconSrc(tabId, settings);
        if (iconSrc) {
            const iconImg = document.createElement('img');
            iconImg.className = 'saga-runtime-rail-icon-img';
            iconImg.src = iconSrc;
            iconImg.alt = '';
            iconImg.draggable = false;
            iconImg.addEventListener('error', () => {
                icon.classList.add('saga-runtime-rail-icon-missing');
                icon.textContent = fallback;
            }, { once: true });
            icon.appendChild(iconImg);
        } else {
            icon.textContent = fallback;
        }
    }
}
