/**
 * runtime-feature-progress.js - Saga
 * Shared feature progress state and provider-readiness gates.
 */

import {
    getState,
    saveState,
} from '../state/state-manager.js';
import { validateLoreProviderConfiguration } from '../providers/lore-llm-client.js';
import { toast } from '../ui/runtime-ui-kit.js';

const FEATURE_PROGRESS_KINDS = Object.freeze(['context', 'continuity', 'lore', 'canon']);
const progressResetTimers = new Map();
let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureRuntimeFeatureProgress(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

function normalizeFeatureProgressKind(kind = 'lore') {
    return FEATURE_PROGRESS_KINDS.includes(kind) ? kind : 'lore';
}

function getPanelRoot() {
    return dep('getPanelRoot', () => null)();
}

export function appendGenerationStatus(card, state, kind = 'lore') {
    const statusKind = normalizeFeatureProgressKind(kind);
    const statusKey = `${statusKind}Status`;
    const progressKey = `${statusKind}Progress`;

    const status = document.createElement('div');
    status.className = 'saga-generation-status-text';
    status.dataset.sagaStatus = statusKind;
    status.textContent = state?.lorePanel?.[statusKey] || 'Idle.';
    card.appendChild(status);

    const bar = document.createElement('div');
    bar.className = 'saga-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'saga-progress-fill';
    fill.dataset.sagaProgress = statusKind;
    fill.style.width = `${Math.max(0, Math.min(100, Number(state?.lorePanel?.[progressKey]) || 0))}%`;
    bar.appendChild(fill);
    card.appendChild(bar);
}

export function setFeatureProgress(kind = 'lore', message, percent = 0) {
    const statusKind = normalizeFeatureProgressKind(kind);
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    const state = getState();
    if (state?.lorePanel) {
        state.lorePanel[`${statusKind}Status`] = message;
        state.lorePanel[`${statusKind}Progress`] = safePercent;
        if (statusKind === 'lore') {
            state.lorePanel.generationStatus = message;
            state.lorePanel.generationProgress = safePercent;
        }
        saveState(state);
    }

    const panelRoot = getPanelRoot();
    if (!panelRoot) return;
    const text = panelRoot.querySelector(`[data-saga-status="${statusKind}"]`);
    const fill = panelRoot.querySelector(`[data-saga-progress="${statusKind}"]`);
    if (text) text.textContent = message;
    if (fill) fill.style.width = `${safePercent}%`;
}

export function resetFeatureProgress(kind = 'lore', delayMs = 1400) {
    const statusKind = normalizeFeatureProgressKind(kind);
    const existing = progressResetTimers.get(statusKind);
    if (existing) globalThis.clearTimeout(existing);
    const timer = globalThis.setTimeout(() => {
        progressResetTimers.delete(statusKind);
        resetFeatureProgressNow(statusKind);
    }, Math.max(0, Number(delayMs) || 0));
    progressResetTimers.set(statusKind, timer);
}

export function resetFeatureProgressNow(kind = 'lore') {
    const statusKind = normalizeFeatureProgressKind(kind);
    const existing = progressResetTimers.get(statusKind);
    if (existing) {
        globalThis.clearTimeout(existing);
        progressResetTimers.delete(statusKind);
    }
    const state = getState();
    if (state?.lorePanel) {
        state.lorePanel[`${statusKind}Status`] = 'Idle.';
        state.lorePanel[`${statusKind}Progress`] = 0;
        if (statusKind === 'lore') {
            state.lorePanel.generationStatus = 'Idle.';
            state.lorePanel.generationProgress = 0;
        }
        saveState(state);
    }
    const panelRoot = getPanelRoot();
    if (!panelRoot) return;
    const text = panelRoot.querySelector(`[data-saga-status="${statusKind}"]`);
    const fill = panelRoot.querySelector(`[data-saga-progress="${statusKind}"]`);
    if (text) text.textContent = 'Idle.';
    if (fill) fill.style.width = '0%';
}

export function resetAllFeatureProgressNow() {
    FEATURE_PROGRESS_KINDS.forEach(kind => resetFeatureProgressNow(kind));
}

export function ensureProviderReadyForAction(kind = 'lore', actionLabel = 'this action', statusKind = kind) {
    const validation = validateLoreProviderConfiguration(kind);
    if (validation.ok) return true;

    const message = `API/model settings incomplete for ${actionLabel}: ${validation.message}`;
    setFeatureProgress(statusKind, message, 100);
    toast(message, 'error');
    return false;
}

export function ensureLoreProviderReadyForAction(actionLabel = 'this action', statusKind = 'lore') {
    return ensureProviderReadyForAction('lore', actionLabel, statusKind);
}

export function ensureContinuityProviderReadyForAction(actionLabel = 'this action') {
    return ensureProviderReadyForAction('continuity', actionLabel, 'continuity');
}
