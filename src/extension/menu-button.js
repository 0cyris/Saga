/**
 * SillyTavern extensions menu integration for Saga.
 */

import { runRuntimeAction } from '../runtime/runtime-actions.js';

export function createSagaCompassIcon() {
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-compass saga-extensions-menu-icon';
    icon.setAttribute('aria-hidden', 'true');
    return icon;
}

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
    btn.title = 'Open the Saga runtime window.';

    const label = document.createElement('span');
    label.textContent = 'Saga';
    btn.append(createSagaCompassIcon(), label);

    btn.addEventListener('click', () => {
        runRuntimeAction('runtime.open');
    });

    menu.appendChild(btn);
}
