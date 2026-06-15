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
    hideFloatingTooltip,
} from '../ui/runtime-ui-kit.js';
import {
    MOBILE_LORECARDS_STAGES,
    canGoBackRuntimeMobileShell,
    getRuntimeMobileActiveSubview,
    getRuntimeMobileActiveTab,
    getRuntimeMobileLorecardsStage,
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
    selectRuntimeMobileLorecardsStage,
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

const MOBILE_LORECARDS_SUBTAB_META = Object.freeze({
    suggested: Object.freeze({
        label: 'Generation',
        tooltip: 'Create or suggest Lorecards.',
    }),
    automation: Object.freeze({
        label: 'Automation',
        tooltip: 'Configure and run Lore Automation.',
    }),
    pending: Object.freeze({
        label: 'Pending',
        tooltip: 'Review proposed Lorecards.',
    }),
    accepted: Object.freeze({
        label: 'Approved',
        tooltip: 'Manage approved Lorecards and active state.',
    }),
});
const MOBILE_NAV_TOOLTIP_OPTIONS = Object.freeze({ showOnHover: false, showOnFocus: false });

function addMobileNavigationLabel(element, text) {
    return addTooltip(element, text, MOBILE_NAV_TOOLTIP_OPTIONS);
}

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
    if (mobile.activeRoute === 'lore' && !options.error) root.classList.add('saga-mobile-lorecards-subtabs-active');
    root.dataset.mobileRoute = mobile.activeRoute;
    root.dataset.mobileActiveTab = activeTab || '';
    root.dataset.mobileMoreRoute = mobile.activeMoreRoute || '';
    root.dataset.mobileLorecardsStage = mobile.activeRoute === 'lore'
        ? getRuntimeMobileLorecardsStage(panelState, getMobileLorecardsFallbackStage(state), settings)
        : '';
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

    const shellActions = renderMobileShellActionBar(state, settings);
    if (shellActions) {
        root.classList.add('saga-mobile-shell-actions-active');
        root.appendChild(shellActions);
    }
    if (mobile.activeRoute === 'lore' && !options.error) {
        root.appendChild(renderMobileLorecardsSubTabs(state, settings));
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

function hideRuntimeMobileShell() {
    hideFloatingTooltip();
    dep('hideRuntimePanel')();
}

function renderMobileShellActionBar(state, settings = getSettings()) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const mobile = normalizeMobilePanelState(panelState, settings);
    const canGoBack = canGoBackRuntimeMobileShell(panelState, settings);
    if (mobile.activeRoute === 'more' && !mobile.activeMoreRoute) return null;
    if (!canGoBack) return null;

    const bar = document.createElement('div');
    bar.className = 'saga-mobile-shell-action-bar';
    bar.setAttribute('aria-label', 'Saga shell actions');

    const back = createMobileShellActionButton(
        'back',
        'Back',
        'Go back.',
        'saga-mobile-shell-action saga-mobile-shell-back',
        (event) => {
            event.stopPropagation();
            hideFloatingTooltip();
            goBackRuntimeMobileShell();
        },
        settings,
    );
    back.setAttribute('aria-keyshortcuts', 'Escape');
    bar.appendChild(back);
    return bar;
}

function createMobileShellActionButton(kind, label, tooltip, className, handler, settings = getSettings()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.mobileShellAction = kind;
    addMobileNavigationLabel(button, tooltip || label);
    button.appendChild(createMobileShellActionIcon(kind, settings));
    const text = document.createElement('span');
    text.className = 'saga-mobile-shell-action-label';
    text.textContent = label;
    button.appendChild(text);
    button.addEventListener('click', handler);
    return button;
}

function createMobileShellActionIcon(kind, settings = getSettings()) {
    void settings;
    const icon = document.createElement('span');
    icon.className = `saga-mobile-shell-action-icon saga-mobile-shell-action-icon-${kind}`;
    icon.setAttribute('aria-hidden', 'true');

    const symbol = document.createElement('span');
    symbol.className = `saga-mobile-shell-action-symbol saga-mobile-shell-action-symbol-${kind}`;
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
        const active = mobile.activeRoute === route;
        addMobileNavigationLabel(tab, active ? 'Close the Saga runtime window.' : getMobileRouteTooltip(route, settings));
        tab.appendChild(active ? createMobileBottomExitIcon() : createMobileRouteIcon(route, settings, 'saga-mobile-bottom-icon'));
        const text = document.createElement('span');
        text.className = 'saga-mobile-bottom-label';
        text.textContent = active ? 'Exit' : label;
        tab.appendChild(text);
        tab.draggable = false;
        tab.addEventListener('contextmenu', event => event.preventDefault());
        tab.addEventListener('click', (event) => {
            event.stopPropagation();
            hideFloatingTooltip();
            if (active) {
                hideRuntimeMobileShell();
                return;
            }
            if (route === 'more') openRuntimeMobileMoreSheet();
            else selectRuntimeMobileRoute(route);
        });
        bar.appendChild(tab);
    }

    return bar;
}

function createMobileBottomExitIcon() {
    const icon = document.createElement('span');
    icon.className = 'saga-mobile-bottom-icon saga-mobile-bottom-exit-icon';
    icon.setAttribute('aria-hidden', 'true');
    const symbol = document.createElement('span');
    symbol.className = 'saga-mobile-shell-action-symbol saga-mobile-shell-action-symbol-close';
    icon.appendChild(symbol);
    return icon;
}

function createMobileRouteIcon(route, settings = getSettings(), className = 'saga-mobile-route-icon') {
    const iconRoute = route === 'more' ? 'more' : route;
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
        iconImg.setAttribute('draggable', 'false');
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

function getMobileLorecardsSubTabCounts(state) {
    const pendingCount = Array.isArray(state?.pendingLoreEntries) ? state.pendingLoreEntries.length : 0;
    const loreState = getPanelLoreState(state);
    const acceptedCount = (loreState.entries || []).filter(entry => !entry?.isPending).length;
    return {
        suggested: 0,
        automation: 0,
        pending: pendingCount,
        accepted: acceptedCount,
    };
}

function getMobileLorecardsFallbackStage(state) {
    const counts = getMobileLorecardsSubTabCounts(state);
    return counts.pending > 0 ? 'pending' : 'accepted';
}

function renderMobileLorecardsSubTabs(state, settings = getSettings()) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const counts = getMobileLorecardsSubTabCounts(state);
    const activeStage = getRuntimeMobileLorecardsStage(panelState, getMobileLorecardsFallbackStage(state), settings);
    const nav = document.createElement('nav');
    nav.className = 'saga-mobile-lorecards-subtabs';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Lorecards workspace');

    for (const stage of MOBILE_LORECARDS_STAGES) {
        const meta = MOBILE_LORECARDS_SUBTAB_META[stage] || MOBILE_LORECARDS_SUBTAB_META.pending;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'saga-mobile-lorecards-subtab';
        tab.dataset.stage = stage;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', stage === activeStage ? 'true' : 'false');
        tab.tabIndex = stage === activeStage ? 0 : -1;
        if (stage === activeStage) tab.classList.add('saga-mobile-lorecards-subtab-active');
        addMobileNavigationLabel(tab, meta.tooltip);

        const label = document.createElement('span');
        label.className = 'saga-mobile-lorecards-subtab-label';
        label.textContent = meta.label;
        tab.appendChild(label);
        tab.draggable = false;
        tab.addEventListener('contextmenu', event => event.preventDefault());

        const count = Number(counts[stage] || 0);
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'saga-mobile-lorecards-subtab-count';
            badge.textContent = String(count);
            tab.appendChild(badge);
        }

        tab.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            hideFloatingTooltip();
            selectRuntimeMobileLorecardsStage(stage);
        });
        nav.appendChild(tab);
    }

    return nav;
}

function renderMobileMoreSheet(container, settings = getSettings()) {
    container.innerHTML = '';
    const sheet = document.createElement('div');
    sheet.className = 'saga-mobile-more-sheet';
    sheet.setAttribute('role', 'menu');
    sheet.setAttribute('aria-label', 'More Saga routes');

    const modeWrap = document.createElement('div');
    modeWrap.className = 'saga-mobile-more-mode';
    const modeLabel = document.createElement('div');
    modeLabel.className = 'saga-mobile-more-mode-label';
    modeLabel.textContent = 'Experience Mode';
    modeWrap.appendChild(modeLabel);
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
            entry.draggable = false;
            entry.addEventListener('contextmenu', event => event.preventDefault());
            addMobileNavigationLabel(entry, getMobileRouteTooltip(route, settings));
            entry.appendChild(createMobileRouteIcon(route, settings, 'saga-mobile-more-entry-icon'));
            const text = document.createElement('span');
            text.className = 'saga-mobile-more-entry-label';
            text.textContent = getMobileRouteLabel(route, settings);
            entry.appendChild(text);
            entry.addEventListener('click', (event) => {
                event.stopPropagation();
                hideFloatingTooltip();
                selectRuntimeMobileMoreRoute(route);
            });
            list.appendChild(entry);
        }
        groupEl.appendChild(list);
        sheet.appendChild(groupEl);
    }

    const shellGroup = document.createElement('section');
    shellGroup.className = 'saga-mobile-more-group saga-mobile-more-shell-group';
    const shellHeading = document.createElement('h3');
    shellHeading.className = 'saga-mobile-more-group-title';
    shellHeading.textContent = 'Runtime';
    shellGroup.appendChild(shellHeading);
    const shellList = document.createElement('div');
    shellList.className = 'saga-mobile-more-list';
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.className = 'saga-mobile-more-entry saga-mobile-more-exit';
    exit.setAttribute('role', 'menuitem');
    exit.draggable = false;
    exit.addEventListener('contextmenu', event => event.preventDefault());
    addMobileNavigationLabel(exit, 'Close the Saga runtime window.');
    exit.appendChild(createMobileShellActionIcon('close', settings));
    const exitText = document.createElement('span');
    exitText.className = 'saga-mobile-more-entry-label';
    exitText.textContent = 'Exit Saga';
    exit.appendChild(exitText);
    exit.addEventListener('click', (event) => {
        event.stopPropagation();
        hideRuntimeMobileShell();
    });
    shellList.appendChild(exit);
    shellGroup.appendChild(shellList);
    sheet.appendChild(shellGroup);

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
