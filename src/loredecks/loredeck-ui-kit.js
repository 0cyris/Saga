/**
 * loredeck-ui-kit.js -- Saga
 * Loredeck-specific DOM helpers layered on the shared runtime UI primitives.
 *
 * Keep this module UI-only. It should not import state, settings, stores, or
 * runtime panel controllers.
 */

import {
    addTooltip,
    createEmptyMessage,
    createStatusPill,
} from '../ui/runtime-ui-kit.js';

function appendClassName(element, className = '') {
    const extra = String(className || '').trim();
    if (extra) element.className = `${element.className || ''} ${extra}`.trim();
    return element;
}

function normalizeStatusPillItem(item) {
    if (!item) return null;
    if (Array.isArray(item)) {
        const [text, tooltip, options = {}] = item;
        return { text, tooltip, ...(options || {}) };
    }
    if (typeof item === 'object') return item;
    return { text: item };
}

export function createLoredeckEmptyState(text, options = {}) {
    const empty = createEmptyMessage(text);
    appendClassName(empty, options.className);
    if (options.tone) empty.dataset.loredeckEmptyTone = String(options.tone);
    return empty;
}

export function createLoredeckCardTitle(text, options = {}) {
    const title = document.createElement(options.tagName || 'div');
    title.className = options.className || 'saga-runtime-card-title';
    title.textContent = text;
    addTooltip(title, options.tooltip);
    return title;
}

export function appendLoredeckStatusPills(parent, items = []) {
    if (!parent) return parent;
    for (const raw of items || []) {
        const item = normalizeStatusPillItem(raw);
        if (!item || item.show === false) continue;
        const text = String(item.text ?? '').trim();
        if (!text) continue;
        const pill = createStatusPill(text, item.tooltip, {
            tone: item.tone,
            kind: item.kind,
            density: item.density,
            maxChars: item.maxChars,
            testId: item.testId,
        });
        appendClassName(pill, item.className);
        if (item.dataset && typeof item.dataset === 'object') {
            Object.entries(item.dataset).forEach(([key, value]) => {
                if (value != null) pill.dataset[key] = String(value);
            });
        }
        parent.appendChild(pill);
    }
    return parent;
}

export function createLoredeckStatusPillList(items = [], options = {}) {
    const wrap = document.createElement(options.tagName || 'div');
    wrap.className = options.className || 'saga-loredeck-row-meta';
    appendLoredeckStatusPills(wrap, items);
    return wrap;
}

export function createLoredeckRenderErrorCard(options = {}) {
    const card = document.createElement('div');
    card.className = options.className || 'saga-runtime-card saga-runtime-error-card';

    const title = createLoredeckCardTitle(options.title || 'Loredeck surface could not render.', {
        tagName: options.titleTagName || 'h4',
        className: options.titleClassName || '',
    });
    card.appendChild(title);

    const message = document.createElement('div');
    message.className = options.messageClassName || 'saga-runtime-help';
    message.textContent = options.message
        || options.error?.message
        || String(options.error || 'Unknown render error.');
    card.appendChild(message);

    return card;
}

export function createLoredeckRenderErrorBody(options = {}) {
    const body = document.createElement('div');
    body.className = options.bodyClassName || 'saga-loredeck-render-error-body';
    body.appendChild(createLoredeckRenderErrorCard(options));
    return body;
}
