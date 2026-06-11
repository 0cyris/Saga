/**
 * runtime-rail-metrics.js - Saga
 * Compact runtime rail counters, tooltips, and injection-size helpers.
 */

import {
    getInjectableLoreEntries,
    getPanelLoreState,
} from '../lorecards/lore-matrix.js';
import { buildContinuityPreview, buildLorePreview } from '../continuity/memo-builder.js';
import { getProviderModelStatus } from '../providers/lore-llm-client.js';
import { getSettings } from '../state/state-manager.js';
import { addTooltip } from '../ui/runtime-ui-kit.js';
import {
    estimateTokens,
    formatProviderRailModelName,
} from './runtime-formatters.js';
import { getLoredeckStackMetric } from './active-stack-panel.js';
import { getExperienceLabel } from './runtime-navigation.js';

export function getSelectedLoreInjectionCount(state, settings = getSettings()) {
    void settings;
    return getInjectableLoreEntries(state, 0).length;
}

export function getInjectionCharacterStats(state, settings = getSettings()) {
    const continuityEnabled = settings.injectContinuity !== false && settings.injectMemo !== false;
    const loreEnabled = settings.injectLore !== false;
    const continuityText = continuityEnabled ? buildContinuityPreview(state, settings.continuityInjectionMode || 'direct') : '';
    const loreText = loreEnabled ? buildLorePreview(state, settings.loreInjectionMode || 'direct') : '';
    return {
        continuityChars: continuityText.length,
        loreChars: loreText.length,
        totalChars: continuityText.length + loreText.length,
        totalTokens: estimateTokens(`${continuityText}
${loreText}`),
    };
}

function getProviderRailMetricLabel(status = {}) {
    if (status.exact) return formatProviderRailModelName(status.model || status.label) || 'Model';
    if (status.provider === 'profile' && !status.exact && status.profileLabel) return status.profileLabel;
    if (status.provider === 'st' && !status.exact) return 'ST model';
    if (status.provider === 'openai_compatible' && !status.exact) return 'No model';
    return formatProviderRailModelName(status.label) || 'Model';
}

function getProviderRailMetricPart(kind, settings = getSettings()) {
    const status = getProviderModelStatus(kind, settings);
    return getProviderRailMetricLabel(status);
}

function getSettingsProviderRailMetricLines(settings = getSettings()) {
    return [
        getProviderRailMetricPart('lore', settings),
        getProviderRailMetricPart('continuity', settings),
    ];
}

function getSettingsProviderRailTooltip(settings = getSettings()) {
    const reasoning = getProviderModelStatus('lore', settings);
    const utility = getProviderModelStatus('continuity', settings);
    return `Reasoning Provider: ${reasoning.label}. Utility Provider: ${utility.label}.`;
}

function setRailMetricTooltip(metric, tooltip = '') {
    const text = String(tooltip || '').trim();
    if (!text) {
        delete metric.dataset.sagaTooltip;
        metric.removeAttribute('aria-label');
        return;
    }
    if (metric.dataset.sagaTooltip) {
        metric.dataset.sagaTooltip = text;
        metric.setAttribute('aria-label', text);
    } else {
        addTooltip(metric, text);
    }
}

export function renderRailMetric(metric, tabId, metrics = {}, metricTooltips = {}) {
    if (!metric) return;
    const value = metrics[tabId] || '';
    const lines = Array.isArray(value) ? value : [];
    metric.classList.toggle('saga-runtime-rail-metric-stack', lines.length > 0);
    metric.textContent = '';
    if (lines.length) {
        const fragments = lines
            .map(line => String(line || '').trim())
            .filter(Boolean)
            .map(line => {
                const item = document.createElement('span');
                item.className = 'saga-runtime-rail-metric-line';
                item.textContent = line;
                return item;
            });
        metric.replaceChildren(...fragments);
    } else {
        metric.textContent = String(value || '');
    }
    setRailMetricTooltip(metric, metricTooltips[tabId] || '');
}

export function getRailMetrics(state, settings = getSettings()) {
    const counts = getPanelLoreState(state).counts;
    const pendingLore = (state?.pendingLoreEntries || []).length;
    const selectedLore = getSelectedLoreInjectionCount(state, settings);
    const injectionStats = getInjectionCharacterStats(state, settings);
    const sceneDate = String(state?.loreContext?.sceneDate || '').trim();
    const canonBoundary = String(state?.loreContext?.canonBoundary || '').trim();
    const activeCharacters = Array.isArray(state?.scene?.presentCharacters)
        ? state.scene.presentCharacters.length
        : (Array.isArray(state?.characters) ? state.characters.length : 0);
    const liveItems = [state?.scene?.location, state?.scene?.currentActivity].filter(Boolean).length;

    return {
        loredecks: getLoredeckStackMetric(state),
        session: settings.enabled ? getExperienceLabel(settings) : 'Paused',
        context: sceneDate || canonBoundary || 'No date',
        continuity: `${activeCharacters || liveItems || 0} live`,
        lore: pendingLore ? `${counts.active || 0}+${pendingLore}` : `${counts.active || 0} active`,
        injection: injectionStats.totalChars ? `${injectionStats.totalTokens} tk` : `${selectedLore} lore`,
        settings: getSettingsProviderRailMetricLines(settings),
    };
}

export function getRailMetricTooltips(state, settings = getSettings()) {
    void state;
    return {
        settings: getSettingsProviderRailTooltip(settings),
    };
}
