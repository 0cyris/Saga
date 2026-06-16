import { getSettings } from '../state/state-manager.js';

export const TAB_LABELS = Object.freeze({
    loredecks: 'Loredecks',
    session: 'Session',
    context: 'Context',
    continuity: 'Continuity',
    lore: 'Lorecards',
    injection: 'Injection',
    settings: 'Settings',
});

export const TAB_ICONS = Object.freeze({
    loredecks: 'P',
    session: 'S',
    context: 'C',
    continuity: 'K',
    lore: 'L',
    injection: 'I',
    settings: 'O',
});

export const TAB_TOOLTIPS = Object.freeze({
    loredecks: 'Load, order, inspect, and edit Saga Loredecks.',
    session: 'Runtime overview, preset status, instructions, and active chat readiness.',
    context: 'Detect, browse, resolve, and lock story position across loaded Loredecks.',
    continuity: 'Scan, automatically track, view, and edit lightweight live continuity state: scene/timeline, active characters, key items, and active goals/threads.',
    lore: 'Open Generate, Automate, or Lore to create, automate, review, and manage Lorecards.',
    injection: 'Choose what Saga sends to the model: continuity state, lore entries, direct/compressed handling, and live split injection previews.',
    settings: 'Configure providers, runtime appearance, Saga Theme Packs, State Safety, and Danger Zone cleanup.',
});

export const BASIC_MOBILE_BOTTOM_ROUTES = Object.freeze(['loredecks', 'session', 'context', 'lore', 'settings']);
export const ADVANCED_MOBILE_BOTTOM_ROUTES = Object.freeze(['loredecks', 'session', 'continuity', 'context', 'lore', 'injection', 'settings']);
export const MOBILE_BOTTOM_ROUTES = Object.freeze([...new Set([...BASIC_MOBILE_BOTTOM_ROUTES, ...ADVANCED_MOBILE_BOTTOM_ROUTES])]);
export const MOBILE_PRIMARY_ROUTES = MOBILE_BOTTOM_ROUTES;

export const MOBILE_ROUTE_LABELS = Object.freeze({
    ...TAB_LABELS,
});

export const MOBILE_ROUTE_TOOLTIPS = Object.freeze({
    ...TAB_TOOLTIPS,
});

export const AUTOMATION_MODES = Object.freeze({
    manual: Object.freeze({
        label: 'Manual',
        description: 'No automatic extraction or lore generation. Use the buttons in this window when you want Saga to scan or generate.',
        settings: Object.freeze({
            autoExtract: false,
            autoApplyDelta: false,
            autoGenerateLore: false,
            continuityTrackingMode: 'manual',
            contextDetectionMode: 'manual',
            loreGenerationMode: 'manual',
        }),
    }),
    assisted: Object.freeze({
        label: 'Assisted',
        description: 'Automatically scans continuity state after turns. Context and lore generation stay manual.',
        settings: Object.freeze({
            autoExtract: true,
            autoApplyDelta: true,
            autoGenerateLore: false,
            continuityTrackingMode: 'automatic',
            contextDetectionMode: 'manual',
            loreGenerationMode: 'manual',
        }),
    }),
    automatic: Object.freeze({
        label: 'Automatic',
        description: 'Automatically scans continuity, detects context, and generates Pending Review entries on their configured intervals. Generated Lorecards still go to Pending Review in the Lorecards tab.',
        settings: Object.freeze({
            autoExtract: true,
            autoApplyDelta: true,
            autoGenerateLore: true,
            continuityTrackingMode: 'automatic',
            contextDetectionMode: 'automatic',
            loreGenerationMode: 'automatic',
        }),
    }),
});

export const BASIC_EXPERIENCE_TABS = Object.freeze(['loredecks', 'session', 'context', 'lore', 'settings']);
export const ADVANCED_EXPERIENCE_TABS = Object.freeze(Object.keys(TAB_LABELS));

export function normalizeTab(tab) {
    return Object.prototype.hasOwnProperty.call(TAB_LABELS, tab) ? tab : 'session';
}

export function normalizeMobileBottomRoute(route, settings = getSettings()) {
    return getMobileBottomRoutes(settings).includes(route) ? route : 'session';
}

export function getMobileBottomRoutes(settings = getSettings()) {
    return normalizeExperienceMode(settings?.experienceMode) === 'advanced'
        ? ADVANCED_MOBILE_BOTTOM_ROUTES
        : BASIC_MOBILE_BOTTOM_ROUTES;
}

export function getMobilePrimaryRoutes(settings = getSettings()) {
    return getMobileBottomRoutes(settings);
}

export function getMobileRouteForTab(tab, settings = getSettings()) {
    const normalized = normalizeTabForExperience(tab, settings);
    if (getMobileBottomRoutes(settings).includes(normalized)) return normalized;
    return 'session';
}

export function getMobileRouteLabel(route, settings = getSettings()) {
    void settings;
    const normalized = normalizeTab(route);
    return MOBILE_ROUTE_LABELS[normalized] || 'Saga';
}

export function getMobileRouteTooltip(route, settings = getSettings()) {
    void settings;
    const normalized = normalizeTab(route);
    return MOBILE_ROUTE_TOOLTIPS[normalized] || 'Saga runtime screen.';
}

export function getVisibleTabsForExperience(settings = getSettings()) {
    return normalizeExperienceMode(settings?.experienceMode) === 'basic'
        ? BASIC_EXPERIENCE_TABS
        : ADVANCED_EXPERIENCE_TABS;
}

export function getTabLabelForExperience(tab, settings = getSettings()) {
    void settings;
    const normalized = normalizeTab(tab);
    return TAB_LABELS[normalized] || 'Saga';
}

export function getTabTooltipForExperience(tab, settings = getSettings()) {
    void settings;
    const normalized = normalizeTab(tab);
    return TAB_TOOLTIPS[normalized] || 'Saga runtime drawer.';
}

export function isBasicExperience(settings = getSettings()) {
    return normalizeExperienceMode(settings?.experienceMode) === 'basic';
}

export function normalizeTabForExperience(tab, settings = getSettings()) {
    const normalized = normalizeTab(tab);
    return getVisibleTabsForExperience(settings).includes(normalized) ? normalized : 'session';
}

export function normalizeAutomationMode(mode) {
    return Object.prototype.hasOwnProperty.call(AUTOMATION_MODES, mode) ? mode : 'manual';
}

export function normalizeExperienceMode(mode) {
    return mode === 'advanced' ? 'advanced' : 'basic';
}

export function getAutomationLabel(settings) {
    return AUTOMATION_MODES[normalizeAutomationMode(settings?.automationMode || settings?.workflowMode)].label;
}

export function getAutomationTooltip(settings) {
    return AUTOMATION_MODES[normalizeAutomationMode(settings?.automationMode || settings?.workflowMode)].description;
}

export function getExperienceLabel(settings) {
    return normalizeExperienceMode(settings?.experienceMode) === 'advanced' ? 'Advanced' : 'Basic';
}

export function getExperienceTooltip(settings) {
    return normalizeExperienceMode(settings?.experienceMode) === 'advanced'
        ? 'Advanced Experience gives you detailed control over Saga behavior.'
        : 'Basic Experience keeps Saga focused on the main roleplay workflow.';
}
