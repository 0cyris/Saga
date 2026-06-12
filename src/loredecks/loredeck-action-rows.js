/**
 * loredeck-action-rows.js -- Saga
 * Shared Loredeck action row and action-button lifecycle helpers.
 *
 * Keep this module UI-only. Callers own commands, domain mutations,
 * persistence, confirmation, and navigation.
 */

import { createButton } from '../ui/runtime-ui-kit.js';

export function createLoredeckActionRow(options = {}) {
    const row = document.createElement(options.tagName || 'div');
    row.className = options.className || 'saga-primary-actions';
    for (const child of options.children || []) {
        if (child) row.appendChild(child);
    }
    return row;
}

export function createLoredeckActionButton(options = {}) {
    const button = createButton(
        options.label || 'Action',
        options.tooltip || '',
        options.onClick,
        options.className || '',
    );
    if (options.disabled === true) button.disabled = true;
    if (options.dataset && typeof options.dataset === 'object') {
        for (const [key, value] of Object.entries(options.dataset)) {
            button.dataset[key] = String(value);
        }
    }
    return button;
}

export function setLoredeckActionButtonBusy(button = null, busyText = 'Working...', options = {}) {
    if (!button) return () => {};
    const originalText = button.textContent;
    const originalDisabled = button.disabled === true;
    button.disabled = true;
    button.textContent = String(busyText || originalText || options.fallbackLabel || 'Working...');
    button.dataset.sagaLoredeckActionBusy = 'true';
    return () => {
        button.disabled = options.restoreDisabled === undefined
            ? originalDisabled
            : options.restoreDisabled === true;
        button.textContent = originalText || options.fallbackLabel || '';
        delete button.dataset.sagaLoredeckActionBusy;
    };
}

export async function withLoredeckActionButtonBusy(button = null, options = {}, action = null) {
    const restoreBusy = setLoredeckActionButtonBusy(button, options.busyText, {
        fallbackLabel: options.fallbackLabel,
        restoreDisabled: options.restoreDisabled,
    });
    try {
        return typeof action === 'function' ? await action(button) : undefined;
    } finally {
        restoreBusy();
    }
}

export async function withLoredeckConfirmedActionButton(button = null, options = {}, action = null) {
    if (typeof options.confirm === 'function') {
        const confirmed = await options.confirm(button);
        if (!confirmed) return options.cancelValue;
    }
    return withLoredeckActionButtonBusy(button, options, action);
}
