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
    canGoBackRuntimeMobileShell,
    getRuntimeMobileActiveSubview,
    getRuntimeMobileActiveTab,
    getRuntimeMobileHeaderTitle,
    getConstrainedDrawerHeight,
    getConstrainedDrawerWidth,
    getRailWidth,
    goBackRuntimeMobileShell,
    isRuntimeMobileShell,
    normalizePanelLayoutState,
    normalizeMobilePanelState,
    normalizeRailMode,
    onRuntimeDrawerResizeStart,
    onRuntimeRailDragStart,
    openRuntimeMobileMoreSheet,
    resolveDrawerDirection,
    selectRuntimeMobileMoreRoute,
    selectRuntimeMobileRoute,
    updateDrawerScrollMetrics,
} from './runtime-shell.js';
import { markTourTarget } from './runtime-tour.js';
import {
    TAB_ICONS,
    getMobileBottomRoutes,
    getMobileMoreGroupsForExperience,
    getMobileRouteLabel,
    getMobileRouteTooltip,
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
    const settings = getSettings();

    if (isRuntimeMobileShell()) {
        renderMobilePanelShell(root, state, settings);
        return;
    }

    const railMode = normalizeRailMode(panelState.railMode);
    const drawerOpen = panelState.drawerOpen === true;
    const drawerDirection = drawerOpen ? resolveDrawerDirection(panelState) : 'right';

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.removeEventListener('keydown', onRuntimeMobileShellKeydown);
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
    const settings = getSettings();

    if (isRuntimeMobileShell()) {
        renderMobilePanelShell(root, state, settings, { error });
        return;
    }

    const railMode = normalizeRailMode(panelState.railMode);
    const drawerDirection = panelState.drawerOpen === true ? resolveDrawerDirection(panelState) : 'right';

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.removeEventListener('keydown', onRuntimeMobileShellKeydown);
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

function renderMobilePanelShell(root, state, settings = getSettings(), options = {}) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const mobile = normalizeMobilePanelState(panelState, settings);
    const activeTab = getRuntimeMobileActiveTab(panelState, settings);
    const activeSubview = getRuntimeMobileActiveSubview(panelState, mobile.activeRoute, settings);

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell saga-runtime-mobile saga-mobile-touch';
    if (activeSubview) root.classList.add('saga-mobile-subview-active');
    root.dataset.mobileRoute = mobile.activeRoute;
    root.dataset.mobileActiveTab = activeTab || '';
    root.dataset.mobileMoreRoute = mobile.activeMoreRoute || '';
    root.removeEventListener('keydown', onRuntimeMobileShellKeydown);
    root.addEventListener('keydown', onRuntimeMobileShellKeydown);
    root.style.left = '';
    root.style.top = '';
    root.style.right = '';
    root.style.bottom = '';
    root.style.removeProperty('--saga-rail-width');
    root.style.removeProperty('--saga-drawer-width');
    root.style.removeProperty('--saga-drawer-height');
    applyRuntimeTheme(root, settings);

    root.appendChild(renderMobileHeader(state, settings));

    const body = document.createElement('div');
    body.className = 'saga-lore-panel-body saga-mobile-content';
    if (activeSubview) {
        body.classList.add('saga-mobile-subview');
        body.dataset.mobileSubviewId = activeSubview.id;
    }
    root.appendChild(body);

    if (options.error) {
        renderMobileErrorBody(body, mobile, settings, options.error);
    } else if (mobile.activeRoute === 'more' && !mobile.activeMoreRoute) {
        renderMobileMoreSheet(body, settings);
    } else if (activeTab) {
        panelState.activeTab = activeTab;
        dep('renderPanelBody')(body, state);
    } else {
        renderMobileMoreSheet(body, settings);
    }

    root.appendChild(renderMobileBottomBar(state, settings));
    refreshRuntimeHeader(root);
}

function onRuntimeMobileShellKeydown(event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const target = event.target;
    const targetTag = String(target?.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag) || target?.isContentEditable) return;

    const state = getState();
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const settings = getSettings();
    if (!canGoBackRuntimeMobileShell(panelState, settings)) return;

    event.preventDefault();
    event.stopPropagation();
    goBackRuntimeMobileShell();
}

function renderMobileHeader(state, settings = getSettings()) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const mobile = normalizeMobilePanelState(panelState, settings);
    const canGoBack = canGoBackRuntimeMobileShell(panelState, settings);
    const header = document.createElement('div');
    header.className = 'saga-mobile-header';

    const backSlot = document.createElement('div');
    backSlot.className = 'saga-mobile-header-back-slot';
    if (canGoBack) {
        const back = createMobileHeaderActionButton(
            'back',
            'Go back.',
            'saga-mobile-header-action saga-mobile-header-back',
            (event) => {
                event.stopPropagation();
                goBackRuntimeMobileShell();
            },
            settings,
        );
        back.setAttribute('aria-keyshortcuts', 'Escape');
        backSlot.appendChild(back);
    }
    header.appendChild(backSlot);

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-mobile-header-title-wrap';
    const titleRow = document.createElement('div');
    titleRow.className = 'saga-mobile-header-title-row';

    const mark = document.createElement('span');
    mark.className = 'saga-mobile-header-mark';
    const markImg = document.createElement('img');
    markImg.className = 'saga-mobile-header-mark-img';
    markImg.src = getBrandLogoSrc('compact', settings);
    markImg.alt = 'SAGA';
    markImg.draggable = false;
    markImg.addEventListener('error', () => {
        markImg.remove();
        mark.textContent = 'S';
        mark.classList.add('saga-mobile-header-mark-fallback');
    }, { once: true });
    mark.appendChild(markImg);
    titleRow.appendChild(mark);

    const title = document.createElement('div');
    title.className = 'saga-mobile-header-title';
    title.textContent = getRuntimeMobileHeaderTitle(panelState, settings);
    addTooltip(title, getMobileRouteTooltip(mobile.activeMoreRoute || mobile.activeRoute, settings));
    titleRow.appendChild(title);
    titleWrap.appendChild(titleRow);

    const status = document.createElement('div');
    status.className = 'saga-mobile-header-status';
    status.appendChild(createStatusPill(`Experience: ${getExperienceLabel(settings)}`, getExperienceTooltip(settings), { tone: 'info', kind: 'status' }));
    status.appendChild(createStatusPill(settings.enabled ? 'Active' : 'Paused', 'Master runtime toggle. When paused, Saga does not inject, scan, or generate.', { tone: settings.enabled ? 'success' : 'muted', kind: 'status' }));
    titleWrap.appendChild(status);
    header.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-mobile-header-actions';
    const more = createMobileHeaderActionButton(
        'more',
        'Open More.',
        'saga-mobile-header-action saga-mobile-header-more',
        (event) => {
            event.stopPropagation();
            openRuntimeMobileMoreSheet();
        },
        settings,
    );
    actions.appendChild(more);
    const close = createMobileHeaderActionButton(
        'close',
        'Close Saga.',
        'saga-mobile-header-action saga-mobile-header-close',
        (event) => {
            event.stopPropagation();
            dep('hideRuntimePanel')();
        },
        settings,
    );
    actions.appendChild(close);
    header.appendChild(actions);

    return header;
}

function createMobileHeaderActionButton(kind, tooltip, className, handler, settings = getSettings()) {
    const button = createIconButton('', tooltip, className, handler);
    button.dataset.mobileHeaderAction = kind;
    button.appendChild(createMobileHeaderActionIcon(kind, settings));
    return button;
}

function createMobileHeaderActionIcon(kind, settings = getSettings()) {
    if (kind === 'more') {
        const icon = createMobileRouteIcon('more', settings, 'saga-mobile-header-action-icon');
        icon.classList.add('saga-mobile-header-action-icon-more');
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    }

    const icon = document.createElement('span');
    icon.className = `saga-mobile-header-action-icon saga-mobile-header-action-icon-${kind}`;
    icon.setAttribute('aria-hidden', 'true');

    const symbol = document.createElement('span');
    symbol.className = `saga-mobile-header-action-symbol saga-mobile-header-action-symbol-${kind}`;
    icon.appendChild(symbol);
    return icon;
}

function renderMobileBottomBar(state, settings = getSettings()) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const mobile = normalizeMobilePanelState(panelState, settings);
    const bar = document.createElement('nav');
    bar.className = 'saga-mobile-bottom-bar';
    bar.setAttribute('aria-label', 'Saga mobile navigation');

    for (const route of getMobileBottomRoutes()) {
        if (route === 'session') {
            const divider = document.createElement('div');
            divider.className = 'saga-mobile-bottom-divider';
            divider.setAttribute('aria-hidden', 'true');
            bar.appendChild(divider);
        }
        const label = getMobileRouteLabel(route, settings);
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'saga-mobile-bottom-tab';
        tab.dataset.mobileRoute = route;
        if (mobile.activeRoute === route) {
            tab.classList.add('saga-mobile-bottom-tab-active');
            tab.setAttribute('aria-current', 'page');
        }
        addTooltip(tab, getMobileRouteTooltip(route, settings));
        tab.appendChild(createMobileRouteIcon(route, settings, 'saga-mobile-bottom-icon'));
        const text = document.createElement('span');
        text.className = 'saga-mobile-bottom-label';
        text.textContent = label;
        tab.appendChild(text);
        tab.addEventListener('click', (event) => {
            event.stopPropagation();
            if (route === 'more') openRuntimeMobileMoreSheet();
            else selectRuntimeMobileRoute(route);
        });
        bar.appendChild(tab);
    }

    return bar;
}

function createMobileRouteIcon(route, settings = getSettings(), className = 'saga-mobile-route-icon') {
    const iconRoute = route === 'more' ? 'settings' : route;
    const label = getMobileRouteLabel(route, settings);
    const icon = document.createElement('span');
    icon.className = className;
    icon.dataset.fallbackIcon = route === 'more' ? 'M' : (TAB_ICONS[iconRoute] || label.slice(0, 1));
    const iconSrc = getTabIconSrc(iconRoute, settings);
    if (iconSrc) {
        const iconImg = document.createElement('img');
        iconImg.className = `${className}-img`;
        iconImg.src = iconSrc;
        iconImg.alt = '';
        iconImg.draggable = false;
        iconImg.addEventListener('error', () => {
            icon.classList.add(`${className}-missing`);
            icon.textContent = icon.dataset.fallbackIcon || label.slice(0, 1);
        }, { once: true });
        icon.appendChild(iconImg);
    } else {
        icon.textContent = icon.dataset.fallbackIcon || label.slice(0, 1);
    }
    return icon;
}

function renderMobileMoreSheet(container, settings = getSettings()) {
    container.innerHTML = '';
    const sheet = document.createElement('div');
    sheet.className = 'saga-mobile-more-sheet';
    sheet.setAttribute('role', 'menu');
    sheet.setAttribute('aria-label', 'More Saga routes');

    const modeWrap = document.createElement('div');
    modeWrap.className = 'saga-mobile-more-mode';
    modeWrap.appendChild(createExperienceModeSwitch(settings));
    sheet.appendChild(modeWrap);

    for (const group of getMobileMoreGroupsForExperience(settings)) {
        const groupEl = document.createElement('section');
        groupEl.className = 'saga-mobile-more-group';
        const heading = document.createElement('h3');
        heading.className = 'saga-mobile-more-group-title';
        heading.textContent = group.label;
        groupEl.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'saga-mobile-more-list';
        for (const route of group.routes) {
            const entry = document.createElement('button');
            entry.type = 'button';
            entry.className = 'saga-mobile-more-entry';
            entry.dataset.mobileMoreRoute = route;
            entry.setAttribute('role', 'menuitem');
            addTooltip(entry, getMobileRouteTooltip(route, settings));
            entry.appendChild(createMobileRouteIcon(route, settings, 'saga-mobile-more-entry-icon'));
            const text = document.createElement('span');
            text.className = 'saga-mobile-more-entry-label';
            text.textContent = getMobileRouteLabel(route, settings);
            entry.appendChild(text);
            entry.addEventListener('click', (event) => {
                event.stopPropagation();
                selectRuntimeMobileMoreRoute(route);
            });
            list.appendChild(entry);
        }
        groupEl.appendChild(list);
        sheet.appendChild(groupEl);
    }

    container.appendChild(sheet);
}

function renderMobileErrorBody(container, mobile, settings, error) {
    container.innerHTML = '';
    const tabBody = document.createElement('div');
    const activeTab = mobile.activeMoreRoute || mobile.activeRoute || 'session';
    tabBody.className = `saga-runtime-tab-body saga-runtime-tab-body-${activeTab}`;
    tabBody.appendChild(dep('createRuntimeRenderErrorCard')(getMobileRouteLabel(activeTab, settings), error));
    container.appendChild(tabBody);
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
        status.appendChild(createStatusPill(`Pending: ${pendingDelta + pendingLore}`, 'Pending Review entries plus any legacy continuity delta.', { tone: 'review', kind: 'count' }));
    }
    status.appendChild(createStatusPill(`Lore Selected: ${selectedLore}`, 'Accepted Lorecards selected for the next injection after context activation, priority, pinning, and muting.', { tone: selectedLore ? 'selected' : 'muted', kind: 'count' }));
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
