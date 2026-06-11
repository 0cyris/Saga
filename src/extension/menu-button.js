/**
 * SillyTavern extensions menu integration for Saga.
 */

import { runRuntimeAction } from '../runtime/runtime-actions.js';

/**
 * Installs a launcher button in #extensionsMenu that opens the runtime window.
 */
export function installExtensionsMenuButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu) return;

    if (document.getElementById('saga-extensions-menu-button')) return;

    const placeholder = document.getElementById('extensionsMenuDefault');
    if (placeholder) placeholder.remove();

    const btn = document.createElement('div');
    btn.id = 'saga-extensions-menu-button';
    btn.className = 'list-group-item flex-container flexGap5 interactable';
    btn.title = 'Open the SAGA runtime window.';
    btn.innerHTML = `\uD83E\uDE84 <span>SAGA</span>`;

    btn.addEventListener('click', () => {
        runRuntimeAction('runtime.open');
    });

    menu.appendChild(btn);
}
