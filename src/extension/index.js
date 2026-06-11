/**
 * index.js — Saga
 * Extension entrypoint. Wires events, renders settings panel, registers
 * slash commands, and exposes globalThis bridge functions.
 *
 * Imported modules: constants.js, state-manager.js, memo-builder.js,
 *                    prompt-injector.js, extractor.js, ui.js,
 *                    lore-matrix.js, lore-generator.js
 */

import { LOG_PREFIX, DEFAULT_SETTINGS, detectExtensionFolder, getDefaultState } from '../state/constants.js';
import {
    getSettings,
    saveSettings,
    getState,
    saveState,
    exportSagaState,
    createStateBackup,
    recordStateSafetyEvent,
    acceptPendingLoreEntries,
    rejectPendingLoreEntries,
} from '../state/state-manager.js';
import { clearStoredSecret } from '../state/secure-keyring.js';
import { buildMemo } from '../continuity/memo-builder.js';
import { installInterceptor, syncPromptInjection, clearExtensionPrompts } from '../continuity/prompt-injector.js';
import { onExtractionTriggered, onGenerationEndedAutomation, resetExtractionCounter } from '../continuity/extractor.js';
import { renderSettingsPanel } from '../ui/ui.js';
import {
    runLoreContextDetection,
    runStoryLoreScan,
} from '../lorecards/lore-generator.js';
import { showLorePanel, hideLorePanel, refreshLorePanel, resetLorePanelLayout } from '../runtime/lore-panel.js';
import { onGenerationEndedAutoRelevance, runAutoRelevance } from '../context/auto-relevance.js';
import { registerSagaToolManagerTools } from './saga-tool-registry.js';
import { getLastLoreInjectionAudit, getLastLoredeckRetrievalAudit, searchAcceptedLorecards } from '../lorecards/retrieval-audit.js';

const SETTINGS_TEMPLATE_ID = 'src/extension/settings';

function canUseSagaContext() {
    try {
        return typeof globalThis.SillyTavern?.getContext === 'function' && !!globalThis.SillyTavern.getContext();
    } catch (_) {
        return false;
    }
}

function recordLifecycleStateEvent(type, message) {
    if (!canUseSagaContext()) return;
    try {
        recordStateSafetyEvent(type, message, { syncPrompt: false });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to record lifecycle state event "${type}":`, e);
    }
}

function backupLifecycleState(reason, label) {
    if (!canUseSagaContext()) return null;
    try {
        return createStateBackup(reason, { label, syncPrompt: false });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to create lifecycle backup "${reason}":`, e);
        return null;
    }
}

function clearSagaDirectProviderKeys() {
    for (const secretName of ['loreOpenAI', 'continuityOpenAI']) {
        try {
            clearStoredSecret(secretName);
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to clear ${secretName} provider key material:`, e);
        }
    }
}

function cloneSagaDefaultSettings() {
    try {
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    } catch (_) {
        return { ...DEFAULT_SETTINGS };
    }
}

function clearSagaPromptInjectionSafely(reason = 'clearing prompt injection') {
    try {
        clearExtensionPrompts();
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed while ${reason}:`, e);
    }
}

export async function sagaOnInstall() {
    recordLifecycleStateEvent('extension_install', 'Saga extension install hook completed.');
}

export async function sagaOnUpdate() {
    backupLifecycleState('before_extension_update', 'Before applying a Saga extension update hook.');
    if (canUseSagaContext()) {
        try {
            getState();
        } catch (e) {
            console.warn(`${LOG_PREFIX} Saga update hook could not normalize current chat state:`, e);
        }
    }
    recordLifecycleStateEvent('extension_update', 'Saga extension update hook completed.');
}

export async function sagaOnEnable() {
    recordLifecycleStateEvent('extension_enable', 'Saga extension enable hook completed.');
    try {
        syncPromptInjection();
    } catch (e) {
        console.warn(`${LOG_PREFIX} Saga enable hook could not sync prompt injection:`, e);
        clearSagaPromptInjectionSafely('recovering from enable hook prompt sync failure');
    }
}

export async function sagaOnDisable() {
    handleExtensionDisabled();
    recordLifecycleStateEvent('extension_disable', 'Saga extension disable hook cleared prompt injection and hid the runtime.');
}

export async function sagaOnDelete() {
    handleExtensionDisabled();
    backupLifecycleState('before_extension_delete', 'Before Saga extension delete hook.');
    recordLifecycleStateEvent('extension_delete', 'Saga extension delete hook completed.');
}

export async function sagaOnClean() {
    handleExtensionDisabled();
    let previous = null;
    if (canUseSagaContext()) {
        try {
            previous = getState();
        } catch (e) {
            console.warn(`${LOG_PREFIX} Saga clean hook could not read current chat state:`, e);
        }
    }
    backupLifecycleState('before_extension_clean', 'Before cleaning Saga current-chat state and settings.');
    if (previous) {
        try {
            const next = getDefaultState();
            next.stateSafety = previous.stateSafety;
            saveState(next, { syncPrompt: false });
            recordStateSafetyEvent('extension_clean', 'Saga clean hook reset current-chat Saga state and preserved State Safety records.', { syncPrompt: false });
        } catch (e) {
            console.warn(`${LOG_PREFIX} Saga clean hook could not reset current chat state:`, e);
        }
    }
    clearSagaDirectProviderKeys();
    try {
        saveSettings(cloneSagaDefaultSettings());
    } catch (e) {
        console.warn(`${LOG_PREFIX} Saga clean hook could not reset settings:`, e);
    }
}

export async function sagaOnActivate() {
    recordLifecycleStateEvent('extension_activate', 'Saga extension activate hook completed.');
}

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
function handleBeforePromptSync() {
    try {
        syncPromptInjection();
    } catch (e) {
        console.error(`${LOG_PREFIX} Error syncing Saga prompt injection before prompt assembly:`, e);
        clearSagaPromptInjectionSafely('recovering from prompt assembly sync failure');
    }
}

function handleGenerationEnded() {
    try {
        onGenerationEndedAutomation();
        onGenerationEndedAutoRelevance();
        syncPromptInjection();
    } catch (e) {
        console.error(`${LOG_PREFIX} Error in generation-ended handler:`, e);
        clearSagaPromptInjectionSafely('recovering from generation-ended prompt sync failure');
    }
}

function handleGenerationInterrupted() {
    try {
        clearSagaPromptInjectionSafely('clearing prompt injection after interrupted generation');
        syncPromptInjection();
    } catch (e) {
        console.error(`${LOG_PREFIX} Error clearing Saga prompt injection after interrupted generation:`, e);
        clearSagaPromptInjectionSafely('recovering from interrupted generation prompt sync failure');
    }
}

function handleChatChanged() {
    try {
        resetExtractionCounter();
        clearSagaPromptInjectionSafely('clearing prompt injection after chat switch');
        refreshLorePanel();
        if (typeof globalThis._sagaRefreshUI === 'function') {
            globalThis._sagaRefreshUI();
        }
        syncPromptInjection();
    } catch (e) {
        console.error(`${LOG_PREFIX} Error in chat-changed handler:`, e);
        clearSagaPromptInjectionSafely('recovering from chat-changed prompt sync failure');
    }
}

function handleExtensionDisabled() {
    clearSagaPromptInjectionSafely('disabling Saga prompt injection');
    try {
        hideLorePanel();
    } catch (e) {
        console.error(`${LOG_PREFIX} Error while hiding Saga runtime during disable:`, e);
    }
}

function registerEventHandler(source, eventName, handler) {
    if (!source || !eventName || typeof source.on !== 'function') return false;
    source.on(eventName, handler);
    return true;
}

function registerEventHandlers(source, eventNames, handler) {
    const registered = new Set();
    for (const eventName of eventNames) {
        if (!eventName || registered.has(eventName)) continue;
        if (registerEventHandler(source, eventName, handler)) {
            registered.add(eventName);
        }
    }
    return registered.size;
}

function wireEvents(ctx) {
    if (ctx.eventSource && ctx.event_types) {
        const events = ctx.event_types;
        registerEventHandlers(ctx.eventSource, [
            events.GENERATE_BEFORE_COMBINE_PROMPTS,
            events.GENERATION_STARTED,
        ], handleBeforePromptSync);
        registerEventHandler(ctx.eventSource, events.GENERATION_ENDED, handleGenerationEnded);
        registerEventHandlers(ctx.eventSource, [
            events.GENERATION_STOPPED,
            events.GENERATION_FAILED,
            events.GENERATION_ABORTED,
        ], handleGenerationInterrupted);
        registerEventHandler(ctx.eventSource, events.CHAT_CHANGED, handleChatChanged);
        registerEventHandlers(ctx.eventSource, [
            events.EXTENSION_DISABLED,
            events.EXTENSION_DISABLE,
        ], handleExtensionDisabled);
        console.log(`${LOG_PREFIX} Events wired via eventSource`);
        return;
    }

    const bus = ctx.eventBus || (typeof eventBus !== 'undefined' ? eventBus : null);
    if (bus && bus.on) {
        registerEventHandler(bus, 'GENERATE_BEFORE_COMBINE_PROMPTS', handleBeforePromptSync);
        registerEventHandler(bus, 'GENERATION_STARTED', handleBeforePromptSync);
        registerEventHandler(bus, 'GENERATION_ENDED', handleGenerationEnded);
        registerEventHandler(bus, 'GENERATION_STOPPED', handleGenerationInterrupted);
        registerEventHandler(bus, 'GENERATION_FAILED', handleGenerationInterrupted);
        registerEventHandler(bus, 'GENERATION_ABORTED', handleGenerationInterrupted);
        registerEventHandler(bus, 'CHAT_CHANGED', handleChatChanged);
        registerEventHandler(bus, 'EXTENSION_DISABLED', handleExtensionDisabled);
        console.log(`${LOG_PREFIX} Events wired via eventBus`);
        return;
    }

    if (ctx.eventTypes) {
        for (const [eventName, handler] of [
            ['GENERATE_BEFORE_COMBINE_PROMPTS', handleBeforePromptSync],
            ['GENERATION_STARTED', handleBeforePromptSync],
            ['GENERATION_ENDED', handleGenerationEnded],
            ['GENERATION_STOPPED', handleGenerationInterrupted],
            ['GENERATION_FAILED', handleGenerationInterrupted],
            ['GENERATION_ABORTED', handleGenerationInterrupted],
            ['CHAT_CHANGED', handleChatChanged],
            ['EXTENSION_DISABLED', handleExtensionDisabled],
        ]) {
            ctx.eventTypes[eventName] = ctx.eventTypes[eventName] || [];
            ctx.eventTypes[eventName].push(handler);
        }
        console.log(`${LOG_PREFIX} Events wired via eventTypes object`);
        return;
    }

    console.warn(`${LOG_PREFIX} No event API found. Manual extraction via slash command is still available.`);
}

export const __sagaTestHooks = Object.freeze({
    wireEvents,
    handleBeforePromptSync,
    handleGenerationEnded,
    handleGenerationInterrupted,
    handleChatChanged,
    handleExtensionDisabled,
});

// -----------------------------------------------------------------------------
// Slash commands
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Registers slash commands for manual control.
 * @param {Object} ctx - SillyTavern.getContext() result
 */
function registerSagaSlashCommand(ctx, name, callback, helpString, category = 'Saga') {
    const parser = ctx?.SlashCommandParser || globalThis.SlashCommandParser;
    const commandFactory = ctx?.SlashCommand || globalThis.SlashCommand;

    if (parser && typeof parser.addCommandObject === 'function') {
        const commandProps = {
            name,
            callback,
            helpString,
            category,
            returns: 'none',
        };
        const command = commandFactory && typeof commandFactory.fromProps === 'function'
            ? commandFactory.fromProps(commandProps)
            : commandProps;
        parser.addCommandObject(command);
        return true;
    }

    if (typeof registerSlashCommand === 'function') {
        registerSlashCommand(name, callback, undefined, helpString, category);
        return true;
    }

    return false;
}

async function confirmSlashBulkPendingAction(ctx, verb, count) {
    if (!count) {
        if (typeof toastr !== 'undefined') toastr.info(`No pending Lorecards to ${verb.toLowerCase()}.`);
        return false;
    }
    const message = `${verb} all ${count} pending Lorecard${count === 1 ? '' : 's'}? This affects every pending item in the current chat.`;
    const popup = ctx?.callGenericPopup || globalThis.callGenericPopup;
    const popupTypes = ctx?.POPUP_TYPE || globalThis.POPUP_TYPE || {};
    if (typeof popup === 'function') {
        const result = await popup(message, popupTypes.CONFIRM || 'confirm');
        return result === true || result === 'ok' || result === 'confirm' || result === 1;
    }
    if (typeof globalThis.confirm === 'function') return globalThis.confirm(message);
    if (typeof toastr !== 'undefined') toastr.warning(`${verb} all requires confirmation, but no confirmation UI is available.`);
    return false;
}

function registerSlashCommands(ctx) {
    const parser = ctx?.SlashCommandParser || globalThis.SlashCommandParser;
    if (!parser?.addCommandObject && typeof registerSlashCommand !== 'function') {
        console.warn(`${LOG_PREFIX} Slash command registration unavailable`);
        return;
    }

    const register = (name, callback, helpString, category = 'Saga') => registerSagaSlashCommand(ctx, name, callback, helpString, category);

    // ── /saga-extract ───────────────────────────────────────────────────
    register('saga-extract', async () => {
        await onExtractionTriggered({ force: true });
    }, '\uD83D\uDC41\uFE0F Manually run continuity state extraction', 'Saga');

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
    }, '\uD83D\uDCCB Copy continuity memo to clipboard', 'Saga');

    // ── /saga-state ────────────────────────────────────────────────────
    register('saga-state', async () => {
        const state = getState();
        const json = exportSagaState(state);
        navigator.clipboard.writeText(json).then(() => {
            if (typeof toastr !== 'undefined') toastr.success('Saga state export JSON copied to clipboard');
        }).catch(() => {
            if (typeof toastr !== 'undefined') toastr.info(`State JSON (${json.length} chars) ready; clipboard unavailable`);
        });
    }, '\uD83D\uDCC4 Export Saga state as JSON', 'Saga');

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
    }, '\uD83D\uDD0D Re-run Context detection', 'Saga Lorecards');

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
    register('saga-lore-scan', runManualLoreScanCommand, '\u2728 Scan story lorecards', 'Saga Lorecards');

    // /saga-lore-generate — deprecated alias retained for user macros/workflows
    register('saga-lore-generate', runManualLoreScanCommand, '\u2728 Scan story lorecards', 'Saga Lorecards');

    // /saga-lore-accept — accept all pending lore entries
    register('saga-lore-accept', async () => {
        try {
            if ((getSettings().experienceMode || 'basic') !== 'advanced') {
                if (typeof toastr !== 'undefined') toastr.warning('/saga-lore-accept is available in Advanced mode only. Review selected Lorecards in Basic.');
                return;
            }
            const state = getState();
            const pendingCount = (state?.pendingLoreEntries || []).length;
            const confirmed = await confirmSlashBulkPendingAction(ctx, 'Accept', pendingCount);
            if (!confirmed) return;
            acceptPendingLoreEntries();
            refreshLorePanel();
            if (typeof toastr !== 'undefined') toastr.success(`Accepted ${pendingCount} pending lore entr${pendingCount === 1 ? 'y' : 'ies'}`);
        } catch (e) {
            console.error(`${LOG_PREFIX} Accept lore failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Accept lore failed: ${e.message}`);
        }
    }, '\u2705 Accept all pending lorecards after confirmation', 'Saga Lorecards');

    // /saga-lore-reject — reject all pending lore entries
    register('saga-lore-reject', async () => {
        try {
            if ((getSettings().experienceMode || 'basic') !== 'advanced') {
                if (typeof toastr !== 'undefined') toastr.warning('/saga-lore-reject is available in Advanced mode only. Review selected Lorecards in Basic.');
                return;
            }
            const state = getState();
            const pendingCount = (state?.pendingLoreEntries || []).length;
            const confirmed = await confirmSlashBulkPendingAction(ctx, 'Reject', pendingCount);
            if (!confirmed) return;
            rejectPendingLoreEntries();
            refreshLorePanel();
            if (typeof toastr !== 'undefined') toastr.success(`Rejected ${pendingCount} pending lore entr${pendingCount === 1 ? 'y' : 'ies'}`);
        } catch (e) {
            console.error(`${LOG_PREFIX} Reject lore failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Reject lore failed: ${e.message}`);
        }
    }, '\u274C Reject all pending lorecards after confirmation', 'Saga Lorecards');

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
    }, '\uD83D\uDCD6 Toggle the Saga runtime panel', 'Saga Lorecards');

    console.log(`${LOG_PREFIX} Slash commands registered`);
}

// ════════════════════════════════════════════════════════════════════════════════
// Settings panel mounting
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Mounts the settings panel using ST's renderExtensionTemplateAsync.
 * This renders src/extension/settings.html into the DOM and then wires all controls.
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
                SETTINGS_TEMPLATE_ID
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
        if (state?.lorePanel?.isOpen === true) {
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
    btn.title = 'Open the SAGA runtime window.';

    btn.innerHTML = `\uD83E\uDE84 <span>SAGA</span>`;

    // Click opens the runtime surface. Settings stay configuration-only.
    btn.addEventListener('click', () => {
        showLorePanel();
        refreshLorePanel();
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
