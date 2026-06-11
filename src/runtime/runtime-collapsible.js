/**
 * Shared runtime collapsible section behavior.
 */

import { DEFAULT_SETTINGS } from '../state/constants.js';
import { getSettings, saveSettings } from '../state/state-manager.js';
import { addTooltip } from '../ui/runtime-ui-kit.js';

let runtimeCollapsibleDeps = {};

export function configureRuntimeCollapsible(deps = {}) {
    runtimeCollapsibleDeps = { ...runtimeCollapsibleDeps, ...(deps || {}) };
}

function onSectionToggle(sectionId, open) {
    const handler = runtimeCollapsibleDeps?.onSectionToggle;
    if (typeof handler === 'function') handler(sectionId, open);
}

export function isSectionCollapsed(sectionId, defaultOpen = true) {
    const settings = getSettings();
    const collapsed = settings.collapsedSections || {};
    if (Object.prototype.hasOwnProperty.call(collapsed, sectionId)) {
        return !!collapsed[sectionId];
    }
    return !defaultOpen;
}

export function setSectionCollapsed(sectionId, collapsed) {
    const next = getSettings();
    next.collapsedSections = {
        ...(DEFAULT_SETTINGS.collapsedSections || {}),
        ...(next.collapsedSections || {}),
        [sectionId]: !!collapsed,
    };
    saveSettings(next);
}

export function createCollapsibleSection(sectionId, titleText, subtitleText, defaultOpen, content, options = {}) {
    const details = document.createElement('details');
    details.className = `saga-runtime-card saga-collapsible-card ${options.className || ''}`.trim();
    details.open = !isSectionCollapsed(sectionId, defaultOpen);

    const summary = document.createElement('summary');
    summary.className = 'saga-collapsible-summary';
    const title = document.createElement('span');
    title.className = 'saga-collapsible-title';
    title.textContent = titleText;
    addTooltip(title, options.tooltip || subtitleText || titleText);
    summary.appendChild(title);

    if (subtitleText) {
        const subtitle = document.createElement('span');
        subtitle.className = 'saga-collapsible-subtitle';
        subtitle.textContent = subtitleText;
        summary.appendChild(subtitle);
    }
    details.appendChild(summary);

    const wrap = document.createElement('div');
    wrap.className = 'saga-collapsible-content';
    const built = typeof content === 'function' ? content() : content;
    if (Array.isArray(built)) {
        for (const item of built) if (item) wrap.appendChild(item);
    } else if (built) {
        wrap.appendChild(built);
    }
    details.appendChild(wrap);

    details.addEventListener('toggle', () => {
        setSectionCollapsed(sectionId, !details.open);
        onSectionToggle(sectionId, details.open);
    });

    return details;
}
