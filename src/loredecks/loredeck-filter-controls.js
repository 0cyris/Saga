/**
 * loredeck-filter-controls.js -- Saga
 * Shared Loredeck search, filter, sort, and count controls.
 *
 * These helpers are UI-only. Callers own state, persistence, and refresh logic.
 */

import { addTooltip } from '../ui/runtime-ui-kit.js';

function normalizeOption(option) {
    if (Array.isArray(option)) {
        const [value, label, tooltip = ''] = option;
        return { value, label, tooltip };
    }
    if (option && typeof option === 'object') return option;
    return { value: option, label: option };
}

function stopControlEvent(event) {
    event.stopPropagation();
}

export function createLoredeckSearchInput(options = {}) {
    const input = document.createElement('input');
    input.type = 'search';
    input.className = options.className || 'text_pole';
    input.placeholder = options.placeholder || 'Search...';
    input.value = String(options.value || '');
    if (options.ariaLabel) input.setAttribute('aria-label', options.ariaLabel);
    addTooltip(input, options.tooltip);

    if (options.stopPropagation !== false) {
        input.addEventListener('click', stopControlEvent);
        input.addEventListener('mousedown', stopControlEvent);
    }
    if (typeof options.onInput === 'function') {
        input.addEventListener('input', event => options.onInput(input.value, input, event));
    }
    if (typeof options.onChange === 'function') {
        input.addEventListener('change', event => options.onChange(input.value, input, event));
    }
    if (typeof options.onEnter === 'function') {
        input.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            options.onEnter(input.value, input, event);
        });
    }
    return input;
}

export function createLoredeckSelectControl(options = {}) {
    const select = document.createElement('select');
    select.className = options.className || 'text_pole';
    addTooltip(select, options.tooltip);
    if (options.stopPropagation !== false) {
        select.addEventListener('click', stopControlEvent);
        select.addEventListener('mousedown', stopControlEvent);
    }

    const normalizedOptions = (options.options || []).map(normalizeOption);
    for (const item of normalizedOptions) {
        const option = document.createElement('option');
        option.value = String(item.value ?? '');
        option.textContent = String(item.label ?? item.value ?? '');
        if (item.tooltip) option.title = String(item.tooltip);
        select.appendChild(option);
    }

    const allowed = new Set(normalizedOptions.map(item => String(item.value ?? '')));
    const value = String(options.value ?? '');
    const fallbackValue = String(options.fallbackValue ?? normalizedOptions[0]?.value ?? '');
    select.value = allowed.has(value) ? value : fallbackValue;
    if (typeof options.onChange === 'function') {
        select.addEventListener('change', event => options.onChange(select.value, select, event));
    }
    return select;
}

export function createLoredeckFilterCount(options = {}) {
    const count = document.createElement(options.tagName || 'div');
    count.className = options.className || 'saga-loredeck-filter-count';
    count.textContent = String(options.text || '');
    addTooltip(count, options.tooltip);
    return count;
}
