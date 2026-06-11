/**
 * tab-registry.js - Saga
 * Runtime tab routing and render fallback handling.
 */

import { renderContextTab } from '../context/context-panel.js';
import { renderContinuityTab } from '../continuity/continuity-panel.js';
import { renderLorecardsTab } from '../lorecards/lorecards-panel.js';
import { renderLoredecksTab } from '../loredecks/loredecks-tab-panel.js';
import { getSettings } from '../state/state-manager.js';
import { renderSettingsTab } from '../settings/runtime-settings-tab.js';
import { createButton } from '../ui/runtime-ui-kit.js';
import { renderSessionTab } from './advanced-runtime-panel.js';
import { renderInjectionTab } from './injection-preview-panel.js';
import { installNestedScrollHandoff, toggleRuntimeDrawerForTab } from './runtime-shell.js';
import {
    getTabLabelForExperience,
    normalizeTabForExperience,
} from './runtime-navigation.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureRuntimeTabRegistry(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function renderPanelBody(container, state) {
    container.innerHTML = '';

    const settings = getSettings();
    const activeTab = normalizeTabForExperience(state?.lorePanel?.activeTab, settings);
    const tabBody = document.createElement('div');
    tabBody.className = `saga-runtime-tab-body saga-runtime-tab-body-${activeTab}`;
    container.appendChild(tabBody);

    try {
        if (activeTab === 'loredecks') {
            renderLoredecksTab(tabBody, state);
        } else if (activeTab === 'session') {
            renderSessionTab(tabBody, state);
        } else if (activeTab === 'context') {
            renderContextTab(tabBody, state);
        } else if (activeTab === 'continuity') {
            renderContinuityTab(tabBody, state);
        } else if (activeTab === 'lore') {
            renderLorecardsTab(tabBody, state);
        } else if (activeTab === 'settings') {
            renderSettingsTab(tabBody, state);
        } else {
            renderInjectionTab(tabBody, state);
        }
    } catch (e) {
        console.error(`[Saga] Runtime ${activeTab} tab failed to render:`, e);
        tabBody.textContent = '';
        tabBody.appendChild(createRuntimeRenderErrorCard(getTabLabelForExperience(activeTab, settings), e));
    }

    installNestedScrollHandoff(tabBody);
    if (activeTab === 'lore') dep('scheduleAcceptedLoreLayoutUpdate')();
}

export function createRuntimeRenderErrorCard(titleText = 'Runtime Tab', error = null) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-runtime-render-error-card';
    const title = document.createElement('h4');
    title.textContent = `${titleText} could not render`;
    card.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Saga kept the runtime window open so this can be diagnosed instead of disappearing.';
    card.appendChild(help);
    const message = document.createElement('pre');
    message.className = 'saga-runtime-render-error-message';
    message.textContent = error?.stack || error?.message || String(error || 'Unknown render error.');
    card.appendChild(message);
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Return to Session', 'Open the Session tab.', () => {
        toggleRuntimeDrawerForTab('session');
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reset Window', 'Reset Saga runtime window layout and section defaults.', () => {
        dep('resetLorePanelLayout')();
    }));
    card.appendChild(actions);
    return card;
}
