/**
 * extractor.js — Wandlight
 * Event/automation entrypoints for checkpointed continuity scanning, context
 * detection, and story-lore scanning.
 *
 * The legacy one-prompt continuity extractor has been replaced by
 * continuity-scanner.js. This file now owns throttle/guard behavior only.
 */

import { LOG_PREFIX } from './constants.js';
import { getSettings, getState, getLoredeckLibraryRegistry, saveState } from './state-manager.js';
import { runLoreContextDetection, runStoryLoreScan } from './lore-generator.js';
import { runContinuityScan } from './continuity-scanner.js';
import { validateLoreProviderConfiguration } from './lore-llm-client.js';
import { buildContextResolutionAudit, buildResolverContextFromState } from './context-resolver.js';
import { resolveLoredeckStackItems } from './loredeck-library-index.js';

/** Guard flag to prevent concurrent continuity scans. */
let _extractionRunning = false;
let _continuityProgressResetTimer = null;

function setContinuityProgressState(message, percent = 0) {
    const state = getState();
    if (!state?.lorePanel) return;
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    if (_continuityProgressResetTimer && safePercent < 100 && globalThis.clearTimeout) {
        globalThis.clearTimeout(_continuityProgressResetTimer);
        _continuityProgressResetTimer = null;
    }
    state.lorePanel.continuityStatus = message;
    state.lorePanel.continuityProgress = safePercent;
    saveState(state, { syncPrompt: false, sanitize: false });
    if (typeof globalThis._wandlightRefreshUI === 'function') globalThis._wandlightRefreshUI();
    if (safePercent >= 100 && globalThis.setTimeout) {
        if (_continuityProgressResetTimer && globalThis.clearTimeout) globalThis.clearTimeout(_continuityProgressResetTimer);
        _continuityProgressResetTimer = globalThis.setTimeout(() => {
            const fresh = getState();
            if (fresh?.lorePanel) {
                fresh.lorePanel.continuityStatus = 'Idle.';
                fresh.lorePanel.continuityProgress = 0;
                saveState(fresh, { syncPrompt: false, sanitize: false });
                if (typeof globalThis._wandlightRefreshUI === 'function') globalThis._wandlightRefreshUI();
            }
            _continuityProgressResetTimer = null;
        }, 2200);
    }
}

/**
 * Main continuity scan handler. Called by manual UI/slash command and by
 * GENERATION_ENDED automation when automatic continuity tracking is enabled.
 *
 * @param {Object} [options]
 * @param {boolean} [options.force] - Bypass automatic mode and interval checks.
 * @param {boolean} [options.applyImmediately] - Apply reduced delta instead of storing lastDelta.
 * @returns {Promise<Object>} Structured scan result.
 */
export async function onExtractionTriggered(options = {}) {
    const { force = false, applyImmediately = false } = options;

    if (_extractionRunning) {
        const settings = getSettings();
        if (settings.debugMode) console.log(`${LOG_PREFIX} Continuity scan already running, skipping`);
        return { status: 'skipped_running' };
    }

    const settings = getSettings();
    if (!settings.enabled) return { status: 'disabled' };

    if (!force) {
        const mode = settings.continuityTrackingMode || (settings.autoExtract ? 'automatic' : 'manual');
        if (mode !== 'automatic') return { status: 'skipped_continuity_manual' };

        if (typeof onExtractionTriggered._counter === 'undefined') onExtractionTriggered._counter = 0;
        onExtractionTriggered._counter++;
        const interval = Math.max(1, Math.min(20, Number(settings.continuityAutoInterval || settings.extractionInterval) || 1));
        if (onExtractionTriggered._counter < interval) return { status: 'skipped_interval' };
        onExtractionTriggered._counter = 0;
    }

    const validation = validateLoreProviderConfiguration('continuity');
    if (!validation.ok) return { status: 'api_not_configured', error: validation.message };

    _extractionRunning = true;
    try {
        const progress = typeof options.progress === 'function'
            ? options.progress
            : (message, percent) => setContinuityProgressState(message, percent);
        const result = await runContinuityScan({
            ...options,
            force,
            source: force ? 'manual' : 'auto',
            automationSafe: !force,
            applyImmediately: !!applyImmediately,
            progress,
        });

        if (typeof globalThis._wandlightRefreshUI === 'function') globalThis._wandlightRefreshUI();
        return result;
    } catch (e) {
        console.error(`${LOG_PREFIX} Continuity scan failed:`, e);
        return { status: 'failed_exception', error: e?.message || String(e) };
    } finally {
        _extractionRunning = false;
    }
}

function shouldRunTurnInterval(counterName, interval) {
    const key = `_${counterName}Counter`;
    if (typeof onGenerationEndedAutomation[key] === 'undefined') onGenerationEndedAutomation[key] = 0;
    onGenerationEndedAutomation[key]++;
    const threshold = Math.max(1, Math.min(100, Number(interval) || 1));
    if (onGenerationEndedAutomation[key] < threshold) return false;
    onGenerationEndedAutomation[key] = 0;
    return true;
}

function getChatTextStats() {
    try {
        const ctx = SillyTavern.getContext();
        const chat = Array.isArray(ctx?.chat) ? ctx.chat : [];
        const texts = chat.map(message => String(message?.mes || message?.content || '').trim()).filter(Boolean);
        const text = texts.join('\n');
        const wordCount = (text.match(/\b[\w'-]+\b/g) || []).length;
        return { messageCount: chat.length, wordCount, charCount: text.length };
    } catch (_) {
        return { messageCount: 0, wordCount: 0, charCount: 0 };
    }
}

function shouldRunContextAutomation(settings = getSettings()) {
    const key = '_contextDetectionCounter';
    const baselineKey = '_contextDetectionCharBaseline';
    if (typeof onGenerationEndedAutomation[key] === 'undefined') onGenerationEndedAutomation[key] = 0;
    const stats = getChatTextStats();
    if (typeof onGenerationEndedAutomation[baselineKey] === 'undefined') {
        onGenerationEndedAutomation[baselineKey] = stats.charCount;
    }

    onGenerationEndedAutomation[key]++;
    const turns = onGenerationEndedAutomation[key];
    const minTurns = Math.max(1, Math.min(100, Number(settings.contextDetectionAutoMinTurns) || 8));
    const maxTurns = Math.max(minTurns, Math.min(100, Number(settings.contextDetectionAutoInterval) || 20));
    const configuredCharacterThreshold = Number(settings.contextDetectionAutoCharacterThreshold);
    const characterThreshold = Math.max(0, Number.isFinite(configuredCharacterThreshold) ? configuredCharacterThreshold : 8000);
    const newChars = Math.max(0, stats.charCount - Number(onGenerationEndedAutomation[baselineKey] || 0));
    const enoughText = characterThreshold > 0 && newChars >= characterThreshold;
    const maxTurnReached = turns >= maxTurns;

    const shouldRun = (turns >= minTurns && enoughText) || maxTurnReached;
    const result = {
        shouldRun,
        turns,
        minTurns,
        maxTurns,
        newChars,
        characterThreshold,
        enoughText,
        maxTurnReached,
        reason: shouldRun ? (maxTurnReached ? 'max_turn_cadence' : 'turn_and_text_cadence') : 'context_cadence_not_reached',
    };

    if (shouldRun) {
        onGenerationEndedAutomation[key] = 0;
        onGenerationEndedAutomation[baselineKey] = stats.charCount;
    }

    return result;
}

function getActiveContextAutomationStack(state = getState()) {
    const registry = getLoredeckLibraryRegistry(state);
    const stack = Array.isArray(state?.loredeckStack) ? state.loredeckStack : [];
    return resolveLoredeckStackItems(stack, registry, {
        packs: registry.packs || {},
    }).stack || [];
}

function areAllContextStackItemsLocked(state = getState(), stack = getActiveContextAutomationStack(state)) {
    return !!stack.length && stack.every(item => {
        const context = state?.loredeckContexts?.[item.packId] || {};
        return context.manualLock === true;
    });
}

function recordContextAutomationAudit(reason = 'context_automation_skipped', message = '', options = {}) {
    const state = getState();
    if (!state?.lorePanel) return null;
    const stack = Array.isArray(options.stack) ? options.stack : getActiveContextAutomationStack(state);
    const targetPackIds = stack.map(item => item.packId).filter(Boolean);
    const result = {
        status: 'skipped',
        reason,
        message,
        automationSkipped: true,
        skippedCount: Math.max(1, Number(options.skippedCount) || (targetPackIds.length || 1)),
        targetPackIds,
    };
    const audit = buildContextResolutionAudit(result, buildResolverContextFromState(state), {
        source: 'context_automation',
        message,
        sourceText: '',
    });
    state.lorePanel.contextAutomationAudit = {
        ...audit,
        mode: String(options.mode || getSettings().contextDetectionMode || 'manual'),
        cadence: options.cadence || null,
        providerError: String(options.providerError || '').slice(0, 500),
    };
    saveState(state, { syncPrompt: false, sanitize: false });
    return state.lorePanel.contextAutomationAudit;
}

function clearContextAutomationAuditRunningSkip() {
    const state = getState();
    if (!state?.lorePanel?.contextAutomationAudit?.automationSkipped) return;
    state.lorePanel.contextAutomationAudit = {
        ...state.lorePanel.contextAutomationAudit,
        status: 'running',
        reason: 'context_automation_running',
        message: 'Background Context check is running.',
        createdAt: Date.now(),
    };
    saveState(state, { syncPrompt: false, sanitize: false });
}

function shouldRunLoreGenerationAutomation(settings = getSettings()) {
    const key = '_loreGenerationHybridCounter';
    const baselineKey = '_loreGenerationWordBaseline';
    if (typeof onGenerationEndedAutomation[key] === 'undefined') onGenerationEndedAutomation[key] = 0;
    const stats = getChatTextStats();
    if (typeof onGenerationEndedAutomation[baselineKey] === 'undefined') {
        onGenerationEndedAutomation[baselineKey] = stats.wordCount;
    }

    onGenerationEndedAutomation[key]++;
    const turns = onGenerationEndedAutomation[key];
    const minTurns = Math.max(1, Math.min(100, Number(settings.loreGenerationAutoMinTurns) || 20));
    const maxTurns = Math.max(minTurns, Math.min(100, Number(settings.loreGenerationAutoInterval) || 50));
    const configuredWordThreshold = Number(settings.loreGenerationAutoWordThreshold);
    const wordThreshold = Math.max(0, Number.isFinite(configuredWordThreshold) ? configuredWordThreshold : 2500);
    const newWords = Math.max(0, stats.wordCount - Number(onGenerationEndedAutomation[baselineKey] || 0));
    const enoughWords = wordThreshold > 0 && newWords >= wordThreshold;
    const maxTurnReached = turns >= maxTurns;

    if ((turns >= minTurns && enoughWords) || maxTurnReached) {
        onGenerationEndedAutomation[key] = 0;
        onGenerationEndedAutomation[baselineKey] = stats.wordCount;
        return true;
    }

    return false;
}

export async function onGenerationEndedAutomation() {
    const settings = getSettings();
    if (!settings.enabled) return { status: 'disabled' };

    const results = {};

    try {
        results.continuity = await onExtractionTriggered({ force: false });
    } catch (e) {
        results.continuity = { status: 'failed_exception', error: e?.message || String(e) };
    }

    const contextMode = settings.contextDetectionMode || 'manual';
    if (contextMode !== 'assisted' && contextMode !== 'automatic') {
        const audit = recordContextAutomationAudit(
            'context_manual_mode',
            'Background Context checks are disabled in Manual mode.',
            { mode: contextMode }
        );
        results.context = { status: 'skipped', reason: 'context_manual_mode', audit };
    } else {
        const cadence = shouldRunContextAutomation(settings);
        if (!cadence.shouldRun) {
            const audit = recordContextAutomationAudit(
                cadence.reason,
                `Background Context check skipped: ${cadence.turns}/${cadence.minTurns} minimum turns and ${cadence.newChars}/${cadence.characterThreshold} new characters.`,
                { mode: contextMode, cadence }
            );
            results.context = { status: 'skipped', reason: cadence.reason, cadence, audit };
        } else {
            const stack = getActiveContextAutomationStack(getState());
            if (!stack.length) {
                const audit = recordContextAutomationAudit(
                    'context_no_loaded_loredecks',
                    'Background Context check skipped because no Loredecks are loaded in the active stack.',
                    { mode: contextMode, cadence, stack }
                );
                results.context = { status: 'skipped', reason: 'context_no_loaded_loredecks', cadence, audit };
            } else if (areAllContextStackItemsLocked(getState(), stack)) {
                const audit = recordContextAutomationAudit(
                    'context_all_loredecks_locked',
                    'Background Context check skipped because every loaded Loredeck Context is manually locked.',
                    { mode: contextMode, cadence, stack, skippedCount: stack.length }
                );
                results.context = { status: 'skipped', reason: 'context_all_loredecks_locked', cadence, audit };
            } else {
                try {
                    const validation = validateLoreProviderConfiguration('lore');
                    if (!validation.ok) {
                        const audit = recordContextAutomationAudit(
                            'context_provider_not_configured',
                            `Background Context check skipped: ${validation.message}`,
                            { mode: contextMode, cadence, stack, providerError: validation.message }
                        );
                        results.context = { status: 'skipped', reason: 'context_provider_not_configured', error: validation.message, cadence, audit };
                    } else {
                        clearContextAutomationAuditRunningSkip();
                        results.context = await runLoreContextDetection({ force: false, contextAutomationMode: contextMode });
                    }
                } catch (e) {
                    results.context = { status: 'failed_exception', error: e?.message || String(e) };
                }
            }
        }
    }

    if ((settings.loreGenerationMode || 'manual') === 'automatic'
        && shouldRunLoreGenerationAutomation(settings)) {
        try {
            const validation = validateLoreProviderConfiguration('lore');
            if (!validation.ok) results.lore = { status: 'api_not_configured', error: validation.message };
            else results.lore = await runStoryLoreScan({ force: false, source: 'auto', automationSafe: true });
        } catch (e) {
            results.lore = { status: 'failed_exception', error: e?.message || String(e) };
        }
    }

    if (typeof globalThis._wandlightRefreshUI === 'function') globalThis._wandlightRefreshUI();
    return { status: 'complete', results };
}

/** Returns whether a continuity scan is currently running. */
export function isExtractionRunning() {
    return _extractionRunning;
}

globalThis._wandlightRunExtraction = onExtractionTriggered;
globalThis._wandlightRunAutomation = onGenerationEndedAutomation;
globalThis._wandlightIsExtractionRunning = isExtractionRunning;

/** Resets the automatic continuity throttle counter. Called on chat change. */
export function resetExtractionCounter() {
    onExtractionTriggered._counter = 0;
    onGenerationEndedAutomation._contextDetectionCounter = 0;
    onGenerationEndedAutomation._contextDetectionCharBaseline = undefined;
    onGenerationEndedAutomation._loreGenerationHybridCounter = 0;
    onGenerationEndedAutomation._loreGenerationWordBaseline = undefined;
}
