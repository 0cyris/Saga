import { DEFAULT_SETTINGS, getDefaultState } from '../state/constants.js';
import {
    getMobileRouteForTab,
    getMobileRouteLabel,
    getMobilePrimaryRoutes,
    normalizeMobileBottomRoute,
    normalizeTabForExperience,
} from './runtime-navigation.js';

export const MIN_DRAWER_WIDTH = 360;
export const MIN_DRAWER_HEIGHT = 320;
export const MOBILE_SHELL_MAX_WIDTH = 640;
export const RAIL_WIDTH_COMPACT = 60;
export const RAIL_WIDTH_EXPANDED = 206;
export const RAIL_DRAWER_GAP = 8;
export const MAX_PANEL_MARGIN = 16;
export const DEFAULT_RAIL_LEFT = 20;
export const DEFAULT_COMPACT_RAIL_HEIGHT_ESTIMATE = 420;
export const DEFAULT_EXPANDED_RAIL_HEIGHT_ESTIMATE = 420;
export const LAYOUT_VERSION = 2;

let runtimeShellDeps = {};
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isResizing = false;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;
let resizeStartDirection = 'right';
let pendingRuntimeMobileFocusSelector = '';

export const MOBILE_LORECARDS_STAGES = Object.freeze(['generate', 'automation', 'lore']);

export function normalizeRuntimeMobileLorecardsStage(value = '') {
    const stage = String(value || '').trim().toLowerCase();
    if (stage === 'pending' || stage === 'accepted' || stage === 'approved' || stage === 'active' || stage === 'cards') return 'lore';
    if (stage === 'suggested' || stage === 'generation') return 'generate';
    return MOBILE_LORECARDS_STAGES.includes(stage) ? stage : '';
}

export function configureRuntimeShell(deps = {}) {
    runtimeShellDeps = { ...runtimeShellDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = runtimeShellDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga runtime shell dependency is not configured: ${name}`);
}

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

function getStateForShell() {
    return dep('getState', () => null)();
}

function saveStateForShell(state) {
    return dep('saveState', () => null)(state);
}

function getSettingsForShell() {
    return dep('getSettings', () => ({}))();
}

function saveSettingsForShell(settings) {
    return dep('saveSettings', () => null)(settings);
}

function showRuntimePanelForShell() {
    return dep('showRuntimePanel', () => null)();
}

function notifyRuntimeShell(message, type = 'info') {
    const notify = runtimeShellDeps?.notify;
    if (typeof notify === 'function') return notify(message, type);
    if (typeof toastr !== 'undefined') {
        if (type === 'success' && typeof toastr.success === 'function') return toastr.success(message);
        if (type === 'warning' && typeof toastr.warning === 'function') return toastr.warning(message);
        if (type === 'error' && typeof toastr.error === 'function') return toastr.error(message);
        if (typeof toastr.info === 'function') return toastr.info(message);
    }
    return null;
}

function updateAcceptedLoreScrollRegionHeightForShell() {
    return dep('updateAcceptedLoreScrollRegionHeight', () => null)();
}

function scheduleRuntimeMobileFocus(selector = '') {
    pendingRuntimeMobileFocusSelector = selector || pendingRuntimeMobileFocusSelector;
    if (!pendingRuntimeMobileFocusSelector) return;
    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 0);
    schedule(() => {
        const root = getPanelRoot();
        if (!root?.classList?.contains('saga-runtime-mobile')) return;
        const focusSelector = pendingRuntimeMobileFocusSelector;
        pendingRuntimeMobileFocusSelector = '';
        const target = root.querySelector(focusSelector)
            || root.querySelector('.saga-mobile-shell-back')
            || root.querySelector('.saga-mobile-bottom-tab-active')
            || root.querySelector('.saga-mobile-bottom-tab[data-mobile-route="session"]');
        target?.focus?.({ preventScroll: true });
    });
}

export function normalizeRailMode(mode) {
    return mode === 'expanded' ? 'expanded' : 'compact';
}

export function getRailWidth(panelState) {
    return normalizeRailMode(panelState?.railMode) === 'expanded' ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COMPACT;
}

export function getViewportWidth() {
    return window.innerWidth || document.documentElement?.clientWidth || 1024;
}

export function getViewportHeight() {
    return window.innerHeight || document.documentElement?.clientHeight || 800;
}

export function isRuntimeMobileShell(width = getViewportWidth()) {
    return Number(width) <= MOBILE_SHELL_MAX_WIDTH;
}

export function getDefaultMobilePanelState(activeTab = 'session', settings = {}) {
    const activeRoute = getMobileRouteForTab(activeTab, settings);
    return {
        activeRoute,
        lastPrimaryRoute: getMobilePrimaryRoutes(settings).includes(activeRoute) ? activeRoute : 'session',
        lorecardsStage: '',
        subviewStacks: {
            loredecks: [],
            session: [],
            continuity: [],
            context: [],
            lore: [],
            injection: [],
            settings: [],
        },
    };
}

function normalizeMobileSubviewStack(stack) {
    if (!Array.isArray(stack)) return [];
    return stack
        .filter(item => item && typeof item === 'object')
        .slice(-12)
        .map((item, index) => {
            const id = String(item.id || item.route || `subview-${index + 1}`).trim() || `subview-${index + 1}`;
            const title = String(item.title || item.label || id).trim() || id;
            const params = item.params && typeof item.params === 'object' && !Array.isArray(item.params)
                ? { ...item.params }
                : {};
            return { id, title, params };
        });
}

function normalizeMobileLoreSubviewStack(stack) {
    return normalizeMobileSubviewStack(stack)
        .filter(item => !normalizeRuntimeMobileLorecardsStage(item?.params?.stage));
}

function getMobileSubviewRouteKey(routeId, settings = getSettingsForShell()) {
    const route = getMobileRouteForTab(routeId, settings);
    return getMobilePrimaryRoutes(settings).includes(route) ? route : 'session';
}

export function normalizeMobilePanelState(panelState, settings = getSettingsForShell()) {
    if (!panelState || typeof panelState !== 'object') {
        return getDefaultMobilePanelState('session', settings);
    }

    const hasMobileState = panelState.mobile && typeof panelState.mobile === 'object' && !Array.isArray(panelState.mobile);
    const previous = hasMobileState ? panelState.mobile : getDefaultMobilePanelState(panelState.activeTab, settings);
    const activeRoute = normalizeMobileBottomRoute(previous.activeRoute || getMobileRouteForTab(panelState.activeTab, settings), settings);
    const lastPrimaryRoute = getMobilePrimaryRoutes(settings).includes(previous.lastPrimaryRoute)
        ? previous.lastPrimaryRoute
        : (getMobilePrimaryRoutes(settings).includes(activeRoute) ? activeRoute : 'session');
    const previousStacks = previous.subviewStacks && typeof previous.subviewStacks === 'object' ? previous.subviewStacks : {};

    panelState.mobile = {
        activeRoute,
        lastPrimaryRoute,
        lorecardsStage: normalizeRuntimeMobileLorecardsStage(previous.lorecardsStage || panelState.mobileLifecycleStage),
        subviewStacks: {
            loredecks: normalizeMobileSubviewStack(previousStacks.loredecks),
            session: normalizeMobileSubviewStack(previousStacks.session),
            continuity: normalizeMobileSubviewStack(previousStacks.continuity),
            context: normalizeMobileSubviewStack(previousStacks.context),
            lore: normalizeMobileLoreSubviewStack(previousStacks.lore),
            injection: normalizeMobileSubviewStack(previousStacks.injection),
            settings: normalizeMobileSubviewStack(previousStacks.settings),
        },
    };
    return panelState.mobile;
}

export function getRuntimeMobileActiveTab(panelState, settings = getSettingsForShell()) {
    const mobile = normalizeMobilePanelState(panelState, settings);
    return mobile.activeRoute;
}

export function getRuntimeMobileSubviewStack(panelState, routeId = null, settings = getSettingsForShell()) {
    const mobile = normalizeMobilePanelState(panelState, settings);
    const routeKey = getMobileSubviewRouteKey(routeId || mobile.activeRoute, settings);
    return mobile.subviewStacks[routeKey] || [];
}

export function getRuntimeMobileActiveSubview(panelState, routeId = null, settings = getSettingsForShell()) {
    const stack = getRuntimeMobileSubviewStack(panelState, routeId, settings);
    return stack.length ? stack[stack.length - 1] : null;
}

export function getRuntimeMobileLorecardsStage(panelState, fallback = 'lore', settings = getSettingsForShell()) {
    const mobile = normalizeMobilePanelState(panelState, settings);
    return normalizeRuntimeMobileLorecardsStage(mobile.lorecardsStage)
        || normalizeRuntimeMobileLorecardsStage(panelState?.mobileLifecycleStage)
        || normalizeRuntimeMobileLorecardsStage(fallback)
        || 'lore';
}

export function getRuntimeMobileHeaderTitle(panelState, settings = getSettingsForShell()) {
    const mobile = normalizeMobilePanelState(panelState, settings);
    const activeSubview = getRuntimeMobileActiveSubview(panelState, mobile.activeRoute, settings);
    if (activeSubview?.title) return activeSubview.title;
    return getMobileRouteLabel(mobile.activeRoute, settings);
}

function getRuntimeMobileFocusSelectorFromResult(result = null) {
    if (!result || typeof result !== 'object') return '';
    if (result.action === 'primary-route' && result.route) {
        return `.saga-mobile-bottom-tab[data-mobile-route="${result.route}"]`;
    }
    if (result.action === 'pop-subview') {
        return '.saga-mobile-shell-back, .saga-mobile-bottom-tab-active';
    }
    if (result.action === 'lorecards-subtab' && result.stage) {
        return `.saga-mobile-lorecards-subtab[data-stage="${result.stage}"]`;
    }
    return '';
}

function updateRuntimeMobilePanelState(mutator, options = {}) {
    const state = getStateForShell();
    if (!state?.lorePanel || typeof mutator !== 'function') return null;
    normalizePanelLayoutState(state);
    const settings = getSettingsForShell();
    const mobile = normalizeMobilePanelState(state.lorePanel, settings);
    const result = mutator({ state, panelState: state.lorePanel, mobile, settings });
    saveStateForShell(state);
    showRuntimePanelForShell();
    scheduleRuntimeMobileFocus(options.focusSelector || getRuntimeMobileFocusSelectorFromResult(result));
    return result;
}

export function selectRuntimeMobileRoute(routeId, options = {}) {
    const route = normalizeMobileBottomRoute(routeId, getSettingsForShell());
    return updateRuntimeMobilePanelState(({ panelState, mobile, settings }) => {
        mobile.activeRoute = route;
        if (getMobilePrimaryRoutes(settings).includes(route)) {
            mobile.lastPrimaryRoute = route;
            panelState.activeTab = route;
        }
        panelState.drawerOpen = true;
        panelState.collapsed = false;
        return route;
    }, {
        focusSelector: `.saga-mobile-bottom-tab[data-mobile-route="${route}"]`,
    });
}

export function selectRuntimeMobileLorecardsStage(stage) {
    const normalized = normalizeRuntimeMobileLorecardsStage(stage) || 'lore';
    return updateRuntimeMobilePanelState(({ panelState, mobile }) => {
        mobile.activeRoute = 'lore';
        mobile.lastPrimaryRoute = 'lore';
        mobile.lorecardsStage = normalized;
        mobile.subviewStacks.lore = [];
        panelState.activeTab = 'lore';
        panelState.mobileLifecycleStage = normalized;
        panelState.pendingReviewVisibleLimit = 10;
        panelState.acceptedLoreVisibleLimit = Math.max(10, Number(panelState.acceptedLoreVisibleLimit) || 10);
        panelState.drawerOpen = true;
        panelState.collapsed = false;
        return { action: 'lorecards-subtab', stage: normalized };
    }, {
        focusSelector: `.saga-mobile-lorecards-subtab[data-stage="${normalized}"]`,
    });
}

export function pushRuntimeMobileSubview(routeId, subview = {}, options = {}) {
    return updateRuntimeMobilePanelState(({ panelState, mobile, settings }) => {
        const routeKey = getMobileSubviewRouteKey(routeId || mobile.activeRoute, settings);
        const record = normalizeMobileSubviewStack([subview])[0] || {
            id: String(subview?.id || 'detail'),
            title: String(subview?.title || subview?.label || 'Details'),
            params: {},
        };
        mobile.subviewStacks[routeKey] = normalizeMobileSubviewStack([...(mobile.subviewStacks[routeKey] || []), record]);
        if (options.activate !== false) {
            mobile.activeRoute = routeKey;
            mobile.lastPrimaryRoute = routeKey;
            panelState.activeTab = routeKey;
        }
        return record;
    }, {
        focusSelector: '.saga-mobile-shell-back, .saga-mobile-bottom-tab-active',
    });
}

export function popRuntimeMobileSubview(routeId = null) {
    return updateRuntimeMobilePanelState(({ mobile, settings }) => {
        const routeKey = getMobileSubviewRouteKey(routeId || mobile.activeRoute, settings);
        const stack = mobile.subviewStacks[routeKey] || [];
        if (!stack.length) return null;
        const popped = stack[stack.length - 1];
        mobile.subviewStacks[routeKey] = stack.slice(0, -1);
        return popped;
    }, {
        focusSelector: '.saga-mobile-shell-back, .saga-mobile-bottom-tab-active',
    });
}

export function clearRuntimeMobileSubviews(routeId = null) {
    return updateRuntimeMobilePanelState(({ mobile, settings }) => {
        const routeKey = getMobileSubviewRouteKey(routeId || mobile.activeRoute, settings);
        mobile.subviewStacks[routeKey] = [];
        return routeKey;
    });
}

export function goBackRuntimeMobileShell() {
    return updateRuntimeMobilePanelState(({ panelState, mobile, settings }) => {
        const routeKey = getMobileSubviewRouteKey(mobile.activeRoute, settings);
        const stack = mobile.subviewStacks[routeKey] || [];
        if (stack.length) {
            const popped = stack[stack.length - 1];
            mobile.subviewStacks[routeKey] = stack.slice(0, -1);
            return { action: 'pop-subview', subview: popped };
        }
        return { action: 'none' };
    });
}

export function canGoBackRuntimeMobileShell(panelState, settings = getSettingsForShell()) {
    const mobile = normalizeMobilePanelState(panelState, settings);
    if (getRuntimeMobileSubviewStack(panelState, mobile.activeRoute, settings).length > 0) return true;
    return false;
}

export function getEstimatedRailHeight(panelState = null) {
    return normalizeRailMode(panelState?.railMode) === 'expanded'
        ? DEFAULT_EXPANDED_RAIL_HEIGHT_ESTIMATE
        : DEFAULT_COMPACT_RAIL_HEIGHT_ESTIMATE;
}

export function getDefaultRailY(panelState = null) {
    const viewportHeight = getViewportHeight();
    const estimatedHeight = Math.min(
        getEstimatedRailHeight(panelState),
        Math.max(80, viewportHeight - (MAX_PANEL_MARGIN * 2)),
    );
    return Math.max(MAX_PANEL_MARGIN, Math.round((viewportHeight - estimatedHeight) / 2));
}

export function getMeasuredCenteredRailY(root, panelState = null) {
    const viewportHeight = getViewportHeight();
    const rail = root?.querySelector?.('.saga-runtime-rail');
    const measuredHeight = Number(rail?.offsetHeight) || getEstimatedRailHeight(panelState);
    const safeHeight = Math.min(measuredHeight, Math.max(80, viewportHeight - (MAX_PANEL_MARGIN * 2)));
    return Math.max(MAX_PANEL_MARGIN, Math.round((viewportHeight - safeHeight) / 2));
}

export function normalizePanelLayoutState(state, options = {}) {
    if (!state) return null;
    if (!state.lorePanel || typeof state.lorePanel !== 'object') state.lorePanel = getDefaultState().lorePanel;
    const panelState = state.lorePanel;

    const hadRailFields = panelState.railX != null || panelState.railY != null || panelState.drawerOpen != null;
    panelState.railMode = normalizeRailMode(panelState.railMode);
    if (typeof panelState.drawerOpen !== 'boolean') {
        panelState.drawerOpen = hadRailFields ? false : panelState.collapsed !== true;
    }
    panelState.collapsed = panelState.drawerOpen !== true;
    panelState.activeTab = normalizeTabForExperience(panelState.activeTab);
    panelState.drawerDirection = ['auto', 'right', 'left'].includes(panelState.drawerDirection) ? panelState.drawerDirection : 'auto';
    normalizeMobilePanelState(panelState);

    const legacyX = Number(panelState.x);
    const legacyY = Number(panelState.y);
    const rawRailX = Number(panelState.railX);
    const rawRailY = Number(panelState.railY);
    const defaultY = getDefaultRailY(panelState);
    const looksLikeOldDefaultPosition = panelState.layoutVersion !== LAYOUT_VERSION
        && [16, 20].includes(rawRailX)
        && rawRailY === 220
        && (!Number.isFinite(legacyX) || [16, 20].includes(legacyX))
        && (!Number.isFinite(legacyY) || legacyY === 220);

    const railXValue = looksLikeOldDefaultPosition ? Number.NaN : rawRailX;
    const railYValue = looksLikeOldDefaultPosition ? Number.NaN : rawRailY;

    panelState.railX = clampNumber(
        railXValue,
        0,
        Math.max(0, getViewportWidth() - getRailWidth(panelState)),
        looksLikeOldDefaultPosition ? DEFAULT_RAIL_LEFT : (Number.isFinite(legacyX) ? legacyX : DEFAULT_RAIL_LEFT),
    );
    panelState.railY = clampNumber(
        railYValue,
        0,
        Math.max(0, getViewportHeight() - 80),
        looksLikeOldDefaultPosition ? defaultY : (Number.isFinite(legacyY) ? legacyY : defaultY),
    );
    panelState.drawerWidth = clampNumber(Number(panelState.drawerWidth), MIN_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, getViewportWidth() - (MAX_PANEL_MARGIN * 2)), Number(panelState.width) || 560);
    panelState.drawerHeight = clampNumber(Number(panelState.drawerHeight), MIN_DRAWER_HEIGHT, Math.max(MIN_DRAWER_HEIGHT, getViewportHeight() - (MAX_PANEL_MARGIN * 2)), Number(panelState.height) || 640);
    panelState.layoutVersion = LAYOUT_VERSION;

    if (options.persistLegacyOpenState || looksLikeOldDefaultPosition) {
        panelState.x = panelState.railX;
        panelState.y = panelState.railY;
        panelState.width = panelState.drawerWidth;
        panelState.height = panelState.drawerHeight;
    }
    return panelState;
}

export function getConstrainedDrawerWidth(panelState, direction = 'right') {
    const railX = Number(panelState?.railX) || 0;
    const railWidth = getRailWidth(panelState);
    const requested = Number(panelState?.drawerWidth) || 560;
    const spaceRight = Math.max(MIN_DRAWER_WIDTH, getViewportWidth() - railX - railWidth - RAIL_DRAWER_GAP - MAX_PANEL_MARGIN);
    const spaceLeft = Math.max(MIN_DRAWER_WIDTH, railX - RAIL_DRAWER_GAP - MAX_PANEL_MARGIN);
    const maxWidth = direction === 'left' ? spaceLeft : spaceRight;
    return Math.max(MIN_DRAWER_WIDTH, Math.min(requested, maxWidth));
}

export function getConstrainedDrawerHeight(panelState) {
    const railY = Number(panelState?.railY) || 0;
    const requested = Number(panelState?.drawerHeight) || 640;
    const maxHeight = Math.max(MIN_DRAWER_HEIGHT, getViewportHeight() - railY - MAX_PANEL_MARGIN);
    return Math.max(MIN_DRAWER_HEIGHT, Math.min(requested, maxHeight));
}

export function resolveDrawerDirection(panelState) {
    if (panelState?.drawerDirection === 'left') return 'left';
    if (panelState?.drawerDirection === 'right') return 'right';

    const railX = Number(panelState?.railX) || 0;
    const railWidth = getRailWidth(panelState);
    const requested = Number(panelState?.drawerWidth) || 560;
    const spaceRight = getViewportWidth() - railX - railWidth - RAIL_DRAWER_GAP - MAX_PANEL_MARGIN;
    const spaceLeft = railX - RAIL_DRAWER_GAP - MAX_PANEL_MARGIN;

    if (spaceRight >= requested) return 'right';
    if (spaceLeft >= requested) return 'left';
    return spaceRight >= spaceLeft ? 'right' : 'left';
}

export function applyRuntimeShellGeometry(root, panelState) {
    if (!root) return;
    if (isRuntimeMobileShell()) {
        root.style.left = '';
        root.style.top = '';
        root.style.right = '';
        root.style.bottom = '';
        return;
    }
    const railWidth = getRailWidth(panelState);
    const x = clampNumber(Number(panelState?.railX), 0, Math.max(0, getViewportWidth() - railWidth), DEFAULT_RAIL_LEFT);
    const y = clampNumber(Number(panelState?.railY), 0, Math.max(0, getViewportHeight() - 80), getDefaultRailY(panelState));
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
    root.style.right = '';
    root.style.bottom = '';
}

export function updateDrawerScrollMetrics(drawer) {
    if (!drawer) return;
    const drawerRect = drawer.getBoundingClientRect?.();
    const headerRect = drawer.querySelector('.saga-runtime-drawer-header')?.getBoundingClientRect?.();
    const drawerHeight = Number(drawerRect?.height) || Number.parseFloat(drawer.style.height) || 640;
    const headerHeight = Number(headerRect?.height) || 48;
    const bodyHeight = Math.max(120, Math.floor(drawerHeight - headerHeight - 18));
    const nestedMax = Math.max(140, Math.min(420, Math.floor(bodyHeight * 0.52)));
    drawer.style.setProperty('--saga-drawer-body-available', `${bodyHeight}px`);
    drawer.style.setProperty('--saga-nested-scroll-max', `${nestedMax}px`);
}

export function getActiveTabScrollElement(root = getPanelRoot()) {
    if (!root) return null;
    return root.querySelector('.saga-runtime-tab-body');
}

export function getActiveNestedScrollElement(root = getPanelRoot()) {
    if (!root) return null;
    return root.querySelector('.saga-accepted-lore-scroll-region')
        || root.querySelector('.saga-pending-lore-list')
        || root.querySelector('.saga-canon-preview-list')
        || root.querySelector('.saga-loredeck-assistant-draft-list')
        || root.querySelector('.saga-loredeck-creator-title-list')
        || root.querySelector('.saga-injection-preview')
        || root.querySelector('.saga-continuity-json-editor');
}

export function installNestedScrollHandoff(tabBody) {
    if (!tabBody) return;
    const nestedScrolls = tabBody.querySelectorAll([
        '.saga-accepted-lore-scroll-region',
        '.saga-pending-lore-list',
        '.saga-canon-preview-list',
        '.saga-loredeck-assistant-draft-list',
        '.saga-loredeck-creator-title-list',
        '.saga-injection-preview',
        '.saga-continuity-json-editor',
        'textarea'
    ].join(','));

    for (const nested of nestedScrolls) {
        nested.addEventListener('wheel', (event) => {
            const outer = nested.closest('.saga-runtime-tab-body');
            if (!outer || outer === nested || !event.deltaY) return;

            const canScrollDown = nested.scrollTop + nested.clientHeight < nested.scrollHeight - 1;
            const canScrollUp = nested.scrollTop > 0;
            const shouldHandoff = (event.deltaY > 0 && !canScrollDown) || (event.deltaY < 0 && !canScrollUp);
            if (!shouldHandoff) return;

            outer.scrollTop += event.deltaY;
            event.preventDefault();
            event.stopPropagation();
        }, { passive: false });
    }
}

export function centerRuntimeRailInViewport(options = {}) {
    const root = getPanelRoot();
    if (!root) return;
    if (isRuntimeMobileShell()) {
        root.style.left = '';
        root.style.top = '';
        root.style.right = '';
        root.style.bottom = '';
        return;
    }
    const state = getStateForShell();
    if (!state?.lorePanel) return;
    normalizePanelLayoutState(state);

    const railWidth = getRailWidth(state.lorePanel);
    const maxX = Math.max(0, getViewportWidth() - railWidth);
    const railX = options.forceLeft === true
        ? Math.min(DEFAULT_RAIL_LEFT, maxX)
        : clampNumber(Number(state.lorePanel.railX), 0, maxX, DEFAULT_RAIL_LEFT);
    const railY = getMeasuredCenteredRailY(root, state.lorePanel);

    state.lorePanel.railX = railX;
    state.lorePanel.railY = railY;
    state.lorePanel.x = railX;
    state.lorePanel.y = railY;
    root.style.left = `${railX}px`;
    root.style.top = `${railY}px`;

    if (options.persist === true) saveStateForShell(state);
}

export function clampRuntimeShellToViewport() {
    const root = getPanelRoot();
    if (!root) return;
    if (isRuntimeMobileShell()) {
        root.style.left = '';
        root.style.top = '';
        root.style.right = '';
        root.style.bottom = '';
        updateDrawerScrollMetrics(root.querySelector('.saga-runtime-drawer'));
        return;
    }
    const state = getStateForShell();
    const panelState = normalizePanelLayoutState(state);
    if (!panelState) return;
    const railWidth = getRailWidth(panelState);
    const railHeight = root.querySelector('.saga-runtime-rail')?.offsetHeight || 80;
    panelState.railX = clampNumber(Number(panelState.railX), 0, Math.max(0, getViewportWidth() - railWidth), DEFAULT_RAIL_LEFT);
    panelState.railY = clampNumber(Number(panelState.railY), 0, Math.max(0, getViewportHeight() - Math.min(railHeight, getViewportHeight())), getDefaultRailY());
    panelState.x = panelState.railX;
    panelState.y = panelState.railY;
    applyRuntimeShellGeometry(root, panelState);
    root.style.setProperty('--saga-rail-width', `${railWidth}px`);
    root.style.setProperty('--saga-drawer-width', `${getConstrainedDrawerWidth(panelState, resolveDrawerDirection(panelState))}px`);
    root.style.setProperty('--saga-drawer-height', `${getConstrainedDrawerHeight(panelState)}px`);
    updateDrawerScrollMetrics(root.querySelector('.saga-runtime-drawer'));
    saveStateForShell(state);
}

export function resetRuntimePanelLayout(options = {}) {
    const state = getStateForShell();
    if (!state) return;
    if (!state.lorePanel || typeof state.lorePanel !== 'object') {
        state.lorePanel = getDefaultState().lorePanel;
    }

    const settings = getSettingsForShell();
    const drawerWidth = Number(getDefaultState()?.lorePanel?.drawerWidth) || 560;
    const drawerHeight = Number(getDefaultState()?.lorePanel?.drawerHeight) || 640;
    const railX = DEFAULT_RAIL_LEFT;
    const railY = getDefaultRailY({ railMode: 'compact' });

    Object.assign(state.lorePanel, {
        railMode: 'compact',
        railX,
        railY,
        drawerOpen: false,
        activeTab: 'session',
        drawerWidth,
        drawerHeight,
        collapsed: true,
        isOpen: true,
        x: railX,
        y: railY,
        width: drawerWidth,
        height: drawerHeight,
        mobile: getDefaultMobilePanelState('session', settings),
        layoutVersion: LAYOUT_VERSION,
    });

    settings.collapsedSections = { ...(DEFAULT_SETTINGS.collapsedSections || {}) };
    saveSettingsForShell(settings);
    saveStateForShell(state);
    showRuntimePanelForShell();

    const schedule = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (fn) => setTimeout(fn, 0);
    schedule(() => centerRuntimeRailInViewport({ forceLeft: true, persist: true }));

    if (options.silent !== true) {
        notifyRuntimeShell('Saga window layout reset.', 'success');
    }
}

export function toggleRuntimeDrawerForTab(tabId) {
    const state = getStateForShell();
    if (!state?.lorePanel) return;
    normalizePanelLayoutState(state);
    const settings = getSettingsForShell();
    const normalizedTab = normalizeTabForExperience(tabId, settings);
    if (isRuntimeMobileShell()) {
        const mobileRoute = getMobileRouteForTab(normalizedTab, settings);
        selectRuntimeMobileRoute(mobileRoute);
        return;
    }
    const sameActiveTab = normalizeTabForExperience(state.lorePanel.activeTab, settings) === normalizedTab;
    const shouldClose = sameActiveTab && state.lorePanel.drawerOpen === true;
    state.lorePanel.activeTab = normalizedTab;
    state.lorePanel.drawerOpen = !shouldClose;
    state.lorePanel.collapsed = shouldClose;
    saveStateForShell(state);
    showRuntimePanelForShell();
}

export function toggleRuntimeRailMode() {
    const state = getStateForShell();
    if (!state?.lorePanel) return;
    normalizePanelLayoutState(state);
    state.lorePanel.railMode = normalizeRailMode(state.lorePanel.railMode) === 'compact' ? 'expanded' : 'compact';
    saveStateForShell(state);
    showRuntimePanelForShell();
}

export function onRuntimeRailDragStart(event) {
    const root = getPanelRoot();
    if (!root) return;
    if (isRuntimeMobileShell()) return;
    if (event.target.closest('button, input, textarea, select, .saga-lore-panel-resize-handle')) return;

    isDragging = true;
    const rect = root.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;

    root.style.left = `${rect.left}px`;
    root.style.top = `${rect.top}px`;
    root.style.right = '';
    root.style.bottom = '';
    root.classList.add('saga-runtime-dragging');

    document.addEventListener('mousemove', onRuntimeRailDragMove);
    document.addEventListener('mouseup', onRuntimeRailDragEnd);
}

function onRuntimeRailDragMove(event) {
    const root = getPanelRoot();
    if (!isDragging || !root) return;
    const state = getStateForShell();
    const panelState = normalizePanelLayoutState(state) || {};
    const railWidth = getRailWidth(panelState);
    const railHeight = root.querySelector('.saga-runtime-rail')?.offsetHeight || 80;
    const x = event.clientX - dragOffsetX;
    const y = event.clientY - dragOffsetY;
    const maxX = Math.max(0, getViewportWidth() - railWidth);
    const maxY = Math.max(0, getViewportHeight() - Math.min(railHeight, getViewportHeight()));
    root.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    root.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
}

function onRuntimeRailDragEnd() {
    const root = getPanelRoot();
    if (!root) return;
    isDragging = false;
    root.classList.remove('saga-runtime-dragging');
    saveRuntimeRailGeometry();
    document.removeEventListener('mousemove', onRuntimeRailDragMove);
    document.removeEventListener('mouseup', onRuntimeRailDragEnd);
}

export function onRuntimeDrawerResizeStart(event) {
    const root = getPanelRoot();
    if (event.button !== 0 || !root) return;
    if (isRuntimeMobileShell()) return;
    const drawer = root.querySelector('.saga-runtime-drawer');
    if (!drawer) return;

    isResizing = true;
    const rect = drawer.getBoundingClientRect();
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    resizeStartWidth = rect.width;
    resizeStartHeight = rect.height;
    resizeStartDirection = root.dataset.drawerDirection === 'left' ? 'left' : 'right';

    drawer.classList.add('saga-lore-panel-resizing');

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    document.addEventListener('pointermove', onRuntimeDrawerResizeMove);
    document.addEventListener('pointerup', onRuntimeDrawerResizeEnd);
    document.addEventListener('pointercancel', onRuntimeDrawerResizeEnd);
}

function onRuntimeDrawerResizeMove(event) {
    const root = getPanelRoot();
    if (!isResizing || !root) return;
    const drawer = root.querySelector('.saga-runtime-drawer');
    if (!drawer) return;
    const state = getStateForShell();
    const panelState = normalizePanelLayoutState(state) || {};
    const railX = Number(panelState.railX) || 0;
    const railWidth = getRailWidth(panelState);
    const maxWidth = resizeStartDirection === 'left'
        ? Math.max(MIN_DRAWER_WIDTH, railX - RAIL_DRAWER_GAP - MAX_PANEL_MARGIN)
        : Math.max(MIN_DRAWER_WIDTH, getViewportWidth() - railX - railWidth - RAIL_DRAWER_GAP - MAX_PANEL_MARGIN);
    const maxHeight = Math.max(MIN_DRAWER_HEIGHT, getViewportHeight() - (Number(panelState.railY) || 0) - MAX_PANEL_MARGIN);
    const deltaX = event.clientX - resizeStartX;
    const requestedWidth = resizeStartDirection === 'left'
        ? resizeStartWidth - deltaX
        : resizeStartWidth + deltaX;
    const width = Math.max(MIN_DRAWER_WIDTH, Math.min(maxWidth, requestedWidth));
    const height = Math.max(MIN_DRAWER_HEIGHT, Math.min(maxHeight, resizeStartHeight + (event.clientY - resizeStartY)));
    drawer.style.width = `${width}px`;
    drawer.style.height = `${height}px`;
    root.style.setProperty('--saga-drawer-width', `${width}px`);
    root.style.setProperty('--saga-drawer-height', `${height}px`);
    updateDrawerScrollMetrics(drawer);
    updateAcceptedLoreScrollRegionHeightForShell();
}

function onRuntimeDrawerResizeEnd() {
    const root = getPanelRoot();
    if (!isResizing || !root) return;
    isResizing = false;
    const drawer = root.querySelector('.saga-runtime-drawer');
    drawer?.classList.remove('saga-lore-panel-resizing');
    saveRuntimeDrawerGeometry();
    document.removeEventListener('pointermove', onRuntimeDrawerResizeMove);
    document.removeEventListener('pointerup', onRuntimeDrawerResizeEnd);
    document.removeEventListener('pointercancel', onRuntimeDrawerResizeEnd);
}

function saveRuntimeRailGeometry() {
    const root = getPanelRoot();
    if (!root) return;
    const state = getStateForShell();
    if (!state?.lorePanel) return;
    normalizePanelLayoutState(state);
    const rect = root.getBoundingClientRect();
    state.lorePanel.railX = Math.round(rect.left);
    state.lorePanel.railY = Math.round(rect.top);
    state.lorePanel.x = state.lorePanel.railX;
    state.lorePanel.y = state.lorePanel.railY;
    saveStateForShell(state);
}

function saveRuntimeDrawerGeometry() {
    const root = getPanelRoot();
    if (!root) return;
    const state = getStateForShell();
    if (!state?.lorePanel) return;
    normalizePanelLayoutState(state);
    const drawer = root.querySelector('.saga-runtime-drawer');
    if (!drawer) {
        saveStateForShell(state);
        return;
    }
    const rect = drawer.getBoundingClientRect();
    state.lorePanel.drawerWidth = Math.round(rect.width);
    state.lorePanel.drawerHeight = Math.round(rect.height);
    state.lorePanel.width = state.lorePanel.drawerWidth;
    state.lorePanel.height = state.lorePanel.drawerHeight;
    saveStateForShell(state);
}

export function clampNumber(value, min, max, fallback) {
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? Math.max(safeMin, max) : safeMin;
    const safeFallback = Number.isFinite(fallback) ? fallback : safeMin;
    const n = Number.isFinite(value) ? value : safeFallback;
    return Math.max(safeMin, Math.min(n, safeMax));
}
