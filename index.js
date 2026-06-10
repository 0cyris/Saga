/**
 * index.js — Saga
 * Extension entrypoint. Wires events, renders settings panel, registers
 * slash commands, and exposes globalThis bridge functions.
 *
 * Imported modules: constants.js, state-manager.js, memo-builder.js,
 *                    prompt-injector.js, extractor.js, ui.js,
 *                    lore-matrix.js, lore-generator.js
 */

import { LOG_PREFIX, DEFAULT_SETTINGS, EXTENSION_FOLDER, detectExtensionFolder } from './constants.js';
import {
    getSettings,
    saveSettings,
    getState,
    exportState,
    acceptPendingLoreEntries,
    rejectPendingLoreEntries,
} from './state-manager.js';
import { buildMemo } from './memo-builder.js';
import { installInterceptor, syncPromptInjection, clearExtensionPrompts } from './prompt-injector.js';
import { onExtractionTriggered, onGenerationEndedAutomation, resetExtractionCounter } from './extractor.js';
import { renderSettingsPanel } from './ui.js';
import {
    runLoreContextDetection,
    runStoryLoreScan,
} from './lore-generator.js';
import { showLorePanel, hideLorePanel, refreshLorePanel, resetLorePanelLayout } from './lore-panel.js';
import { onGenerationEndedAutoRelevance, runAutoRelevance } from './auto-relevance.js';
import { registerSagaToolManagerTools } from './saga-tool-registry.js';
import { getLastLoreInjectionAudit, getLastLoredeckRetrievalAudit, searchAcceptedLorecards } from './retrieval-audit.js';

// ════════════════════════════════════════════════════════════════════════════════
// jQuery ready — this is the SillyTavern extension lifecycle entrypoint.
// SillyTavern loads all .js files in the extension folder and waits for them to
// execute. We use jQuery's $(document).ready() which fires after the page DOM
// is ready (including any HTML templates rendered by renderExtensionTemplateAsync).
// ════════════════════════════════════════════════════════════════════════════════
$(document).ready(async () => {
    'use strict';

    console.log(`${LOG_PREFIX} Saga extension initializing...`);

    // ── Defensive API guard ──────────────────────────────────────────────────
    if (typeof SillyTavern === 'undefined' || !SillyTavern.getContext) {
        console.error(`${LOG_PREFIX} SillyTavern.getContext() not available. Extension cannot load.`);
        return;
    }

    const ctx = SillyTavern.getContext();
    if (!ctx) {
        console.error(`${LOG_PREFIX} SillyTavern context returned null. Extension cannot load.`);
        return;
    }

    // ── Install the generate_interceptor ─────────────────────────────────────
    installInterceptor();

    // ── Wire ST events ──────────────────────────────────────────────────────
    wireEvents(ctx);

    // ── Register slash commands ─────────────────────────────────────────────
    registerSlashCommands(ctx);
    registerSagaToolManagerTools(ctx);

    // ── Mount settings panel via ST's template system ───────────────────────
    await mountSettingsPanel(ctx);

    // ── Expose global bridge functions ───────────────────────────────────────
    exposeGlobalBridge();

    console.log(`${LOG_PREFIX} Extension initialized successfully`);
});

// ════════════════════════════════════════════════════════════════════════════════
// Event wiring
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Wires GENERATION_ENDED and CHAT_CHANGED events using ST's eventSource API.
 * @param {Object} ctx - SillyTavern.getContext() result
 */
function wireEvents(ctx) {
    // ── Primary API: eventSource.on(event_types.EVENT_NAME, handler) ─────
    if (ctx.eventSource && ctx.event_types) {
        const syncBeforePrompt = () => {
            try {
                syncPromptInjection();
            } catch (e) {
                console.error(`${LOG_PREFIX} Error syncing Saga prompt injection before prompt assembly:`, e);
            }
        };

        if (ctx.event_types.GENERATE_BEFORE_COMBINE_PROMPTS) {
            ctx.eventSource.on(ctx.event_types.GENERATE_BEFORE_COMBINE_PROMPTS, syncBeforePrompt);
        } else if (ctx.event_types.GENERATION_STARTED) {
            ctx.eventSource.on(ctx.event_types.GENERATION_STARTED, syncBeforePrompt);
        }

        ctx.eventSource.on(ctx.event_types.GENERATION_ENDED, () => {
            try {
                onGenerationEndedAutomation();
                onGenerationEndedAutoRelevance();
                syncPromptInjection();
            } catch (e) {
                console.error(`${LOG_PREFIX} Error in GENERATION_ENDED handler:`, e);
            }
        });

        ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, () => {
            try {
                resetExtractionCounter();
                clearExtensionPrompts();
                // Refresh lore panel if open
                refreshLorePanel();
                // Refresh state panel if visible
                if (typeof globalThis._sagaRefreshUI === 'function') {
                    globalThis._sagaRefreshUI();
                }
                syncPromptInjection();
            } catch (e) {
                console.error(`${LOG_PREFIX} Error in CHAT_CHANGED handler:`, e);
            }
        });

        console.log(`${LOG_PREFIX} Events wired via eventSource`);
        return;
    }

    // ── Fallback 1: eventBus ─────────────────────────────────────────────
    const bus = ctx.eventBus || (typeof eventBus !== 'undefined' ? eventBus : null);
    if (bus && bus.on) {
        bus.on('GENERATION_ENDED', () => {
            try { onGenerationEndedAutomation(); onGenerationEndedAutoRelevance(); } catch (e) { console.error(e); }
        });
        bus.on('CHAT_CHANGED', () => {
            try { resetExtractionCounter(); } catch (e) { console.error(e); }
        });
        console.log(`${LOG_PREFIX} Events wired via eventBus`);
        return;
    }

    // ── Fallback 2: eventTypes object (legacy) ───────────────────────────
    if (ctx.eventTypes) {
        ctx.eventTypes['GENERATION_ENDED'] = ctx.eventTypes['GENERATION_ENDED'] || [];
        ctx.eventTypes['GENERATION_ENDED'].push(() => {
            try { onGenerationEndedAutomation(); onGenerationEndedAutoRelevance(); } catch (e) { console.error(e); }
        });
        ctx.eventTypes['CHAT_CHANGED'] = ctx.eventTypes['CHAT_CHANGED'] || [];
        ctx.eventTypes['CHAT_CHANGED'].push(() => {
            try { resetExtractionCounter(); } catch (e) { console.error(e); }
        });
        console.log(`${LOG_PREFIX} Events wired via eventTypes object`);
        return;
    }

    console.warn(`${LOG_PREFIX} No event API found. Manual extraction via slash command is still available.`);
}

// ════════════════════════════════════════════════════════════════════════════════
// Slash commands
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Registers slash commands for manual control.
 * @param {Object} ctx - SillyTavern.getContext() result
 */
function registerSlashCommands(ctx) {
    if (typeof registerSlashCommand !== 'function') {
        console.warn(`${LOG_PREFIX} Slash command registration unavailable`);
        return;
    }

    const register = registerSlashCommand;

    // ── /saga-extract ───────────────────────────────────────────────────
    register('saga-extract', async () => {
        await onExtractionTriggered({ force: true });
    }, undefined, '\uD83D\uDC41\uFE0F Manually run continuity state extraction', 'Saga');

    // ── /saga-memo ─────────────────────────────────────────────────────
    register('saga-memo', async () => {
        const state = getState();
        const memo = buildMemo(state);
        if (!memo) {
            if (typeof toastr !== 'undefined') toastr.info('No continuity state to build memo from.');
        } else {
            navigator.clipboard.writeText(memo).then(() => {
                if (typeof toastr !== 'undefined') toastr.success('Continuity memo copied to clipboard');
            }).catch(() => {
                if (typeof toastr !== 'undefined') toastr.info(`[Saga State]\n${memo}`);
            });
        }
    }, undefined, '\uD83D\uDCCB Copy continuity memo to clipboard', 'Saga');

    // ── /saga-state ────────────────────────────────────────────────────
    register('saga-state', async () => {
        const state = getState();
        const json = exportState(state);
        navigator.clipboard.writeText(json).then(() => {
            if (typeof toastr !== 'undefined') toastr.success('Continuity state JSON copied to clipboard');
        }).catch(() => {
            if (typeof toastr !== 'undefined') toastr.info(`State JSON (${json.length} chars) ready; clipboard unavailable`);
        });
    }, undefined, '\uD83D\uDCC4 Export full continuity state as JSON', 'Saga');

    // ── Lore slash commands ──────────────────────────────────────────────────

    // /saga-lore-detect — re-run lore context detection
    register('saga-lore-detect', async () => {
        try {
            if (typeof toastr !== 'undefined') toastr.info('Running lore context detection…');
            await runLoreContextDetection({ force: true });
            if (typeof toastr !== 'undefined') toastr.success('Lore context detection completed');
        } catch (e) {
            console.error(`${LOG_PREFIX} Lore detection failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Lore detection failed: ${e.message}`);
        }
    }, undefined, '\uD83D\uDD0D Re-run Context detection', 'Saga Lorecards');

    const runManualLoreScanCommand = async () => {
        try {
            if (typeof toastr !== 'undefined') toastr.info('Scanning story lore…');
            await runStoryLoreScan({ force: true, source: 'manual' });
            refreshLorePanel();
            if (typeof toastr !== 'undefined') toastr.success('Story lore scan completed');
        } catch (e) {
            console.error(`${LOG_PREFIX} Lore scan failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Lore scan failed: ${e.message}`);
        }
    };

    // /saga-lore-scan — scan story lore with the bulk scan engine
    register('saga-lore-scan', runManualLoreScanCommand, undefined, '\u2728 Scan story lorecards', 'Saga Lorecards');

    // /saga-lore-generate — deprecated alias retained for user macros/workflows
    register('saga-lore-generate', runManualLoreScanCommand, undefined, '\u2728 Scan story lorecards', 'Saga Lorecards');

    // /saga-lore-accept — accept all pending lore entries
    register('saga-lore-accept', async () => {
        try {
            const state = getState();
            const pendingCount = (state?.pendingLoreEntries || []).length;
            acceptPendingLoreEntries();
            refreshLorePanel();
            if (typeof toastr !== 'undefined') toastr.success(`Accepted ${pendingCount} pending lore entr${pendingCount === 1 ? 'y' : 'ies'}`);
        } catch (e) {
            console.error(`${LOG_PREFIX} Accept lore failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Accept lore failed: ${e.message}`);
        }
    }, undefined, '\u2705 Accept all pending lorecards', 'Saga Lorecards');

    // /saga-lore-reject — reject all pending lore entries
    register('saga-lore-reject', async () => {
        try {
            const state = getState();
            const pendingCount = (state?.pendingLoreEntries || []).length;
            rejectPendingLoreEntries();
            refreshLorePanel();
            if (typeof toastr !== 'undefined') toastr.success(`Rejected ${pendingCount} pending lore entr${pendingCount === 1 ? 'y' : 'ies'}`);
        } catch (e) {
            console.error(`${LOG_PREFIX} Reject lore failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Reject lore failed: ${e.message}`);
        }
    }, undefined, '\u274C Reject all pending lorecards', 'Saga Lorecards');

    // /saga-lore-panel — toggle the floating lore panel
    register('saga-lore-panel', async () => {
        try {
            const state = getState();
            const isOpen = state?.lorePanel?.isOpen || false;
            if (isOpen) {
                hideLorePanel();
                if (typeof toastr !== 'undefined') toastr.info('Lore panel hidden');
            } else {
                showLorePanel();
                if (typeof toastr !== 'undefined') toastr.info('Lore panel shown');
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} Toggle lore panel failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Toggle lore panel failed: ${e.message}`);
        }
    }, undefined, '\uD83D\uDCD6 Toggle the Saga runtime panel', 'Saga Lorecards');

    console.log(`${LOG_PREFIX} Slash commands registered`);
}

// ════════════════════════════════════════════════════════════════════════════════
// Settings panel mounting
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Mounts the settings panel using ST's renderExtensionTemplateAsync.
 * This renders settings.html into the DOM and then wires all controls.
 * @param {Object} ctx - SillyTavern.getContext() result
 */
async function mountSettingsPanel(ctx) {
    // ── Duplicate panel guard ────────────────────────────────────────────────
    const existingPanel = document.getElementById('saga_settings');
    if (existingPanel) {
        renderSettingsPanel(existingPanel);
        wireSettingsPanel(existingPanel);
        installExtensionsMenuButton();
        console.warn(`${LOG_PREFIX} Settings panel already mounted; skipping duplicate mount`);
        return;
    }

    // ── Render the template async ────────────────────────────────────────────
    if (ctx.renderExtensionTemplateAsync) {
        try {
            // Detect the actual installed folder name dynamically, falling back to EXTENSION_FOLDER
            const folder = detectExtensionFolder();
            const html = await ctx.renderExtensionTemplateAsync(
                folder,
                'settings'
            );
            const extensionsSettings = document.getElementById('extensions_settings2');
            if (extensionsSettings) {
                extensionsSettings.insertAdjacentHTML('beforeend', html);
            } else {
                // Fallback: append to the older settings area
                const legacyArea = document.getElementById('extensions_settings');
                if (legacyArea) {
                    legacyArea.insertAdjacentHTML('beforeend', html);
                } else {
                    console.warn(`${LOG_PREFIX} No extensions_settings container found — settings panel unavailable`);
                    return;
                }
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} renderExtensionTemplateAsync failed:`, e);
            return;
        }
    } else {
        console.warn(`${LOG_PREFIX} renderExtensionTemplateAsync not available — settings panel unavailable`);
        return;
    }

    // ── Wire UI after a brief DOM settle ───────────────────────────────────
    setTimeout(() => {
        const container = document.getElementById('saga_settings');
        if (container) {
            renderSettingsPanel(container);
            wireSettingsPanel(container);
            // Refresh runtime/settings preview surfaces after wiring
            // Use the local refreshStatePanel() directly since _sagaRefreshUI
            // is not yet exposed by exposeGlobalBridge() at this point.
            try {
                refreshStatePanel();
            } catch (e) {
                // Silently ignore — panels might not exist yet
            }
        }
    }, 100);

    console.log(`${LOG_PREFIX} Settings panel mounted`);

    // ── Install #extensionsMenu launcher button ──────────────────────
    installExtensionsMenuButton();

    // ── Auto-open lore panel if it was previously open ────────────────
    try {
        const state = getState();
        if (state?.lorePanel?.isOpen !== false) {
            showLorePanel();
        }
    } catch (_) {
        // Silently ignore — panel may not be needed
    }
}

/**
 * Installs a launcher button in #extensionsMenu that links to the extension's
 * settings panel and provides quick-access commands.
 */
function installExtensionsMenuButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return;

    // Guard against double-installation
    if (document.getElementById('saga-extensions-menu-button')) return;

    // Clear any stale "no extensions" placeholder
    const placeholder = document.getElementById('extensionsMenuDefault');
    if (placeholder) placeholder.remove();

    const btn = document.createElement('div');
    btn.id = 'saga-extensions-menu-button';
    btn.className = 'list-group-item flex-container flexGap5 interactable';
    btn.title = 'Open SAGA runtime window and extension settings.';

    btn.innerHTML = `\uD83E\uDE84 <span>SAGA</span>`;

    // Click opens settings panel + optionally lore panel
    btn.addEventListener('click', () => {
        // Scroll/focus the settings panel
        const panel = document.getElementById('saga_settings');
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Expand all inline drawers so settings are visible
            const toggles = panel.querySelectorAll('.inline-drawer-toggle');
            toggles.forEach(t => {
                if (t.classList.contains('closed')) {
                    t.click();
                }
            });
        } else {
            if (typeof toastr !== 'undefined') toastr.info('SAGA settings panel not yet mounted. It will appear shortly.');
        }
    });

    menu.appendChild(btn);
}

function normalizeSettingsPanelBranding(container) {
    if (!container) return;

    const rootTitle = container.querySelector(':scope > .inline-drawer > .inline-drawer-toggle b, :scope > .inline-drawer > .inline-drawer-header b');
    if (rootTitle) rootTitle.textContent = 'SAGA';

    for (const paragraph of container.querySelectorAll('p')) {
        const text = String(paragraph.textContent || '');
        if (!/Saga window|runtime window|roleplay/i.test(text)) continue;
        paragraph.textContent = 'SAGA: Fandom Loresystem. During roleplay, use the runtime window for mode, injection toggles, scanning, generation, review, lore editing, provider setup, and theme settings.';
        break;
    }

    const openWindowBtn = container.querySelector('#saga_open_window');
    if (openWindowBtn) {
        openWindowBtn.title = 'Open the SAGA runtime window.';
        openWindowBtn.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i> Open SAGA Window';
    }

    const resetWindowBtn = container.querySelector('#saga_reset_window');
    if (resetWindowBtn) {
        resetWindowBtn.title = 'Reset the SAGA runtime window to its safe default position, size, tab, shelf state, and section dropdown defaults.';
    }
}

/**
 * Wires the settings panel form controls (save, buttons, lore).
 * Called after the settings HTML is rendered into the DOM.
 * @param {HTMLElement} container - The settings panel div
 */
function wireSettingsPanel(container) {
    if (!container) return;

    const settings = getSettings();

    normalizeSettingsPanelBranding(container);

    // Open runtime window button in settings panel
    const openWindowBtn = container.querySelector('#saga_open_window');
    if (openWindowBtn) {
        openWindowBtn.addEventListener('click', (event) => {
            event?.preventDefault?.();
            showLorePanel();
            refreshLorePanel();
        });
    }

    // Reset runtime window geometry to a safe default if it is off-screen or too small to grab.
    const resetWindowBtn = container.querySelector('#saga_reset_window');
    if (resetWindowBtn) {
        resetWindowBtn.addEventListener('click', (event) => {
            event?.preventDefault?.();
            resetLorePanelLayout();
        });
    }

    // ── Toggle controls → save settings ───────────────────────────────────
    const toggles = container.querySelectorAll('[data-setting]');
    toggles.forEach(el => {
        const key = el.dataset.setting;
        if (!key) return;

        // Set initial value from settings
        if (el.type === 'checkbox') {
            el.checked = !!settings[key];
        } else if (el.type === 'number' || el.type === 'range') {
            el.value = settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
        } else {
            el.value = settings[key] !== undefined ? String(settings[key]) : '';
        }

        // Wire change handler
        el.addEventListener('change', () => {
            const currentSettings = getSettings();
            if (el.type === 'checkbox') {
                currentSettings[key] = el.checked;
            } else if (el.type === 'number' || el.type === 'range') {
                currentSettings[key] = Number(el.value);
            } else {
                currentSettings[key] = el.value;
            }
            saveSettings(currentSettings);
            if (currentSettings.debugMode) {
                console.log(`${LOG_PREFIX} Setting "${key}" →`, currentSettings[key]);
            }
        });
    });

    console.log(`${LOG_PREFIX} Settings panel wired`);
}

// ════════════════════════════════════════════════════════════════════════════════
// Global bridge (expose functions for cross-module and external access)
// ════════════════════════════════════════════════════════════════════════════════

function exposeGlobalBridge() {
    globalThis._sagaBuildMemo = buildMemo;
    globalThis._sagaRefreshUI = refreshStatePanel;
    globalThis._sagaGetState = getState;
    globalThis._sagaShowLorePanel = showLorePanel;
    globalThis._sagaHideLorePanel = hideLorePanel;
    globalThis._sagaRefreshLorePanel = refreshLorePanel;
    globalThis._sagaGetLastLoreInjectionAudit = getLastLoreInjectionAudit;
    globalThis._sagaGetLastLoredeckRetrievalAudit = getLastLoredeckRetrievalAudit;
    globalThis._sagaSearchLorecards = (query, options = {}) => searchAcceptedLorecards(getState(), query, options);
    globalThis._sagaRegisterToolManagerTools = registerSagaToolManagerTools;
    console.log(`${LOG_PREFIX} Global bridge exposed`);
}

// ════════════════════════════════════════════════════════════════════════════════
// Shared UI refresh bridge
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Refreshes runtime surfaces. Called from
 * buttons, events, and via globalThis._sagaRefreshUI().
 */
function refreshStatePanel() {
    try {
        refreshLorePanel();
    } catch (_) {
        // Runtime panel may be closed.
    }
}
