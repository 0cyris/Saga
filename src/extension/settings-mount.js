/**
 * Settings panel mounting for Saga.
 */

import { DEFAULT_SETTINGS, LOG_PREFIX, detectExtensionFolder } from '../state/constants.js';
import { getSettings, getState, saveSettings } from '../state/state-manager.js';
import { runRuntimeAction } from '../runtime/runtime-actions.js';
import { renderSettingsPanel } from '../ui/ui.js';
import { createSagaCompassIcon, installExtensionsMenuButton } from './menu-button.js';

const SETTINGS_TEMPLATE_ID = 'src/extension/settings';

/**
 * Mounts the settings panel using ST's renderExtensionTemplateAsync.
 * This renders src/extension/settings.html into the DOM and then wires all controls.
 * @param {Object} ctx - SillyTavern.getContext() result
 */
export async function mountSettingsPanel(ctx) {
    // Duplicate panel guard
    const existingPanel = document.getElementById('saga_settings');
    if (existingPanel) {
        renderSettingsPanel(existingPanel);
        wireSettingsPanel(existingPanel);
        installExtensionsMenuButton();
        console.warn(`${LOG_PREFIX} Settings panel already mounted; skipping duplicate mount`);
        return;
    }

    // Render the template async
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
                    console.warn(`${LOG_PREFIX} No extensions_settings container found - settings panel unavailable`);
                    return;
                }
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} renderExtensionTemplateAsync failed:`, e);
            return;
        }
    } else {
        console.warn(`${LOG_PREFIX} renderExtensionTemplateAsync not available - settings panel unavailable`);
        return;
    }

    // Wire UI after a brief DOM settle
    setTimeout(() => {
        const container = document.getElementById('saga_settings');
        if (container) {
            renderSettingsPanel(container);
            wireSettingsPanel(container);
            try {
                runRuntimeAction('runtime.refresh');
            } catch (e) {
                // Runtime panel may not exist yet.
            }
        }
    }, 100);

    console.log(`${LOG_PREFIX} Settings panel mounted`);

    installExtensionsMenuButton();

    try {
        if (getSettings().runtimeWindowOpen === true) {
            runRuntimeAction('runtime.show');
        }
    } catch (e) {
        // Panel auto-open is optional during early startup.
    }
}

function normalizeSettingsPanelBranding(container) {
    if (!container) return;

    const header = container.querySelector(':scope > .inline-drawer > .inline-drawer-toggle, :scope > .inline-drawer > .inline-drawer-header');
    const rootTitle = header?.querySelector('b');
    if (rootTitle) {
        rootTitle.textContent = 'Saga';
        if (!header.querySelector('.saga-extensions-menu-icon')) {
            rootTitle.parentNode?.insertBefore(createSagaCompassIcon(), rootTitle);
        }
    }

    for (const paragraph of container.querySelectorAll('p')) {
        const text = String(paragraph.textContent || '');
        if (!/Saga window|runtime window|roleplay/i.test(text)) continue;
        paragraph.textContent = 'Saga: Fandom Loresystem. During roleplay, use the runtime window for mode, injection toggles, scanning, generation, review, lore editing, provider setup, and theme settings.';
        break;
    }

    const openWindowBtn = container.querySelector('#saga_open_window');
    if (openWindowBtn) {
        openWindowBtn.title = 'Open the Saga runtime window.';
        openWindowBtn.innerHTML = '<i class="fa-solid fa-up-right-from-square"></i> Open Saga Window';
    }

    const resetWindowBtn = container.querySelector('#saga_reset_window');
    if (resetWindowBtn) {
        resetWindowBtn.title = 'Reset the Saga runtime window to its safe default position, size, tab, shelf state, and section dropdown defaults.';
    }
}

/**
 * Wires the settings panel form controls.
 * @param {HTMLElement} container - The settings panel div
 */
export function wireSettingsPanel(container) {
    if (!container) return;

    const settings = getSettings();

    normalizeSettingsPanelBranding(container);

    const openWindowBtn = container.querySelector('#saga_open_window');
    if (openWindowBtn) {
        openWindowBtn.addEventListener('click', (event) => {
            event?.preventDefault?.();
            runRuntimeAction('runtime.open');
        });
    }

    const resetWindowBtn = container.querySelector('#saga_reset_window');
    if (resetWindowBtn) {
        resetWindowBtn.addEventListener('click', (event) => {
            event?.preventDefault?.();
            runRuntimeAction('runtime.resetLayout');
        });
    }

    const toggles = container.querySelectorAll('[data-setting]');
    toggles.forEach(el => {
        const key = el.dataset.setting;
        if (!key) return;

        if (el.type === 'checkbox') {
            el.checked = !!settings[key];
        } else if (el.type === 'number' || el.type === 'range') {
            el.value = settings[key] !== undefined ? settings[key] : DEFAULT_SETTINGS[key];
        } else {
            el.value = settings[key] !== undefined ? String(settings[key]) : '';
        }

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
                console.log(`${LOG_PREFIX} Setting "${key}" ->`, currentSettings[key]);
            }
        });
    });

    console.log(`${LOG_PREFIX} Settings panel wired`);
}
