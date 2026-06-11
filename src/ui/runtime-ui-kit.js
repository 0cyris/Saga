/**
 * runtime-ui-kit.js -- Saga
 * Shared runtime DOM helpers for the Saga shelf and fullscreen workbenches.
 *
 * This module is intentionally UI-only. Feature panels should use these
 * primitives without importing feature-specific runtime state here.
 */

const LORE_SCOPE_DISPLAY_ORDER = [
    { key: 'characters', label: 'Characters', weight: 80 },
    { key: 'locations', label: 'Locations', weight: 64 },
    { key: 'factions', label: 'Factions', weight: 56 },
    { key: 'objects', label: 'Objects', weight: 48 },
    { key: 'spells', label: 'Spells', weight: 48 },
    { key: 'topics', label: 'Topics', weight: 32 },
    { key: 'eras', label: 'Eras', weight: 24 },
    { key: 'schoolYears', label: 'School years', weight: 24 },
    { key: 'books', label: 'Books', weight: 16 },
];

let floatingTooltip = null;
let tooltipAnchor = null;

export function isPlainObjectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

export function uniqueDisplayStrings(value) {
    const rawValues = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);
    const seen = new Set();
    const out = [];
    for (const raw of rawValues) {
        if (raw && typeof raw === 'object') continue;
        const text = String(raw ?? '').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(text);
    }
    return out.sort(compareScopeDisplayValues);
}

function compareScopeDisplayValues(a, b) {
    const yearA = String(a).match(/\bYear\s+(\d+)\b/i);
    const yearB = String(b).match(/\bYear\s+(\d+)\b/i);
    if (yearA && yearB) return Number(yearA[1]) - Number(yearB[1]);
    const numA = String(a).match(/\b(19\d{2}|20\d{2})\b/);
    const numB = String(b).match(/\b(19\d{2}|20\d{2})\b/);
    if (numA && numB && numA[1] !== numB[1]) return Number(numA[1]) - Number(numB[1]);
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function getDisplayableScopeEntries(scope = {}) {
    if (!isPlainObjectValue(scope)) return [];
    const known = new Set(LORE_SCOPE_DISPLAY_ORDER.map(item => item.key));
    const ordered = LORE_SCOPE_DISPLAY_ORDER
        .map(item => ({ ...item, values: uniqueDisplayStrings(scope[item.key]) }))
        .filter(item => item.values.length > 0);

    const extras = Object.entries(scope)
        .filter(([key]) => !known.has(key))
        .map(([key, value]) => ({ key, label: humanizeScopeKey(key), weight: 1, values: uniqueDisplayStrings(value) }))
        .filter(item => item.values.length > 0)
        .sort((a, b) => a.label.localeCompare(b.label));

    return [...ordered, ...extras];
}

export function humanizeScopeKey(key) {
    return String(key || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, c => c.toUpperCase());
}

export function hasDisplayableScope(scope) {
    return getDisplayableScopeEntries(scope).length > 0;
}

export function formatLoreScope(scope = {}) {
    const entries = getDisplayableScopeEntries(scope);
    if (!entries.length) return 'Global / broad context';
    return entries
        .map(item => `${item.label}: ${item.values.join(', ')}`)
        .join(' | ');
}

export function getLoreScopeSpecificity(entry = {}) {
    return getDisplayableScopeEntries(entry.scope || {}).reduce((total, item) => {
        const first = Math.max(0, Number(item.weight) || 1);
        const additional = Math.max(0, item.values.length - 1) * Math.max(1, Math.round(first / 8));
        return total + first + additional;
    }, 0);
}

export function formatStructuredValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return uniqueDisplayStrings(value).join(', ');
    if (!isPlainObjectValue(value)) return String(value);

    const parts = Object.entries(value)
        .map(([key, val]) => {
            if (Array.isArray(val) || typeof val === 'string') {
                const values = uniqueDisplayStrings(val);
                return values.length ? `${humanizeScopeKey(key)}: ${values.join(', ')}` : '';
            }
            if (isPlainObjectValue(val)) {
                const nested = Object.entries(val)
                    .map(([nestedKey, nestedValue]) => `${humanizeScopeKey(nestedKey)}=${formatStructuredValue(nestedValue)}`)
                    .filter(Boolean)
                    .join(', ');
                return nested ? `${humanizeScopeKey(key)}: ${nested}` : '';
            }
            const text = String(val ?? '').trim();
            return text ? `${humanizeScopeKey(key)}: ${text}` : '';
        })
        .filter(Boolean);

    return parts.join(' | ');
}

function formatKeyValueDisplay(label, value) {
    if (String(label || '').toLowerCase() === 'scope') return formatLoreScope(value);
    return formatStructuredValue(value);
}

export function createKeyValue(label, value, tooltip) {
    const row = document.createElement('div');
    row.className = 'saga-key-value';
    addTooltip(row, tooltip || label);

    const k = document.createElement('span');
    k.className = 'saga-key';
    k.textContent = label;
    row.appendChild(k);

    const v = document.createElement('span');
    v.className = 'saga-value';
    v.textContent = formatKeyValueDisplay(label, value);
    row.appendChild(v);

    return row;
}

export function createCompactPresetStat(label, value) {
    const row = document.createElement('div');
    row.className = 'saga-preset-status-stat';
    const key = document.createElement('span');
    key.textContent = label;
    const val = document.createElement('strong');
    val.textContent = value;
    row.appendChild(key);
    row.appendChild(val);
    return row;
}

export function createSectionHeader(title, description) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-section-header';
    const h = document.createElement('h3');
    h.textContent = title;
    addTooltip(h, description);
    wrap.appendChild(h);
    const p = document.createElement('p');
    p.textContent = description;
    wrap.appendChild(p);
    return wrap;
}

export function createToggleCard(label, checked, tooltip, onChange) {
    const card = document.createElement('label');
    card.className = 'saga-toggle-card';
    addTooltip(card, tooltip);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    card.appendChild(input);

    const text = document.createElement('span');
    text.textContent = label;
    card.appendChild(text);

    const state = document.createElement('span');
    state.className = 'saga-toggle-state';
    state.textContent = checked ? 'On' : 'Off';
    card.appendChild(state);

    input.addEventListener('change', () => {
        state.textContent = input.checked ? 'On' : 'Off';
        onChange(input.checked);
    });

    return card;
}

export function createButton(label, tooltip, handler, className = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `saga-runtime-button ${className}`.trim();
    btn.textContent = label;
    addTooltip(btn, tooltip);
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideFloatingTooltip();
        handler?.(btn, e);
    });
    return btn;
}

export function wireOverlayBackdropClose(overlay, closeHandler) {
    if (!overlay || typeof closeHandler !== 'function') return overlay;
    overlay.addEventListener('click', event => {
        if (event.target === overlay) closeHandler();
    });
    return overlay;
}

export function createIconButton(label, tooltip, className, handler) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    addTooltip(btn, tooltip);
    btn.addEventListener('click', event => {
        hideFloatingTooltip();
        handler?.(event);
    });
    return btn;
}

function getLoreBadgeClass(text) {
    const normalized = String(text || '')
        .trim()
        .toLowerCase()
        .replace(/^p\d+$/, 'priority')
        .replace(/[^a-z0-9]+/g, '-');
    return normalized ? `saga-lore-badge-${normalized}` : '';
}

export function createBadge(text, tooltip) {
    const badge = document.createElement('span');
    badge.className = `saga-lore-badge ${getLoreBadgeClass(text)}`.trim();
    badge.textContent = text;
    addTooltip(badge, tooltip);
    return badge;
}

export function createStatusPill(text, tooltip) {
    const pill = document.createElement('span');
    pill.className = 'saga-status-pill';
    pill.textContent = text;
    addTooltip(pill, tooltip);
    return pill;
}

export function createEmptyMessage(text) {
    const empty = document.createElement('div');
    empty.className = 'saga-lore-empty';
    empty.textContent = text;
    return empty;
}

export function addTooltip(el, text) {
    if (!el || !text) return el;
    el.dataset.sagaTooltip = text;
    el.setAttribute('aria-label', text);
    // Native title tooltips are slow and can fight the runtime overlay tooltip.
    el.removeAttribute('title');
    el.addEventListener('mouseenter', () => showFloatingTooltip(el));
    el.addEventListener('focus', () => showFloatingTooltip(el));
    el.addEventListener('mouseleave', hideFloatingTooltip);
    el.addEventListener('blur', hideFloatingTooltip);
    return el;
}

function showFloatingTooltip(anchor) {
    const text = anchor?.dataset?.sagaTooltip;
    if (!text) return;
    tooltipAnchor = anchor;
    if (!floatingTooltip) {
        floatingTooltip = document.createElement('div');
        floatingTooltip.className = 'saga-floating-tooltip';
        document.body.appendChild(floatingTooltip);
    }
    floatingTooltip.textContent = text;
    floatingTooltip.style.display = 'block';
    requestAnimationFrame(() => positionFloatingTooltip(anchor));
}

function positionFloatingTooltip(anchor) {
    if (!floatingTooltip || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const tipRect = floatingTooltip.getBoundingClientRect();
    const margin = 8;

    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    left = Math.max(margin, Math.min(left, window.innerWidth - tipRect.width - margin));

    let top = rect.top - tipRect.height - margin;
    if (top < margin) {
        top = rect.bottom + margin;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - tipRect.height - margin));

    floatingTooltip.style.left = `${left}px`;
    floatingTooltip.style.top = `${top}px`;
}

export function hideFloatingTooltip() {
    tooltipAnchor = null;
    if (floatingTooltip) floatingTooltip.style.display = 'none';
}

export async function runBusyAction(btn, busyText, action) {
    if (!btn || typeof action !== 'function') return;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = busyText;
    try {
        await action();
    } catch (e) {
        console.error('[Saga] Runtime action failed:', e);
        toast(e?.message ? `Action failed: ${e.message}` : 'Action failed.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = original;
    }
}

function showSagaConfirmDialog(title, message) {
    if (typeof document === 'undefined' || !document.body) return Promise.resolve(false);
    return new Promise(resolve => {
        document.querySelector('.saga-confirm-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'saga-confirm-overlay';

        const shell = document.createElement('div');
        shell.className = 'saga-confirm-shell';
        shell.setAttribute('role', 'dialog');
        shell.setAttribute('aria-modal', 'true');
        shell.setAttribute('aria-labelledby', 'saga-confirm-title');
        shell.setAttribute('aria-describedby', 'saga-confirm-message');

        const heading = document.createElement('div');
        heading.id = 'saga-confirm-title';
        heading.className = 'saga-confirm-title';
        heading.textContent = String(title || 'Confirm Action');
        shell.appendChild(heading);

        const body = document.createElement('div');
        body.id = 'saga-confirm-message';
        body.className = 'saga-confirm-message';
        body.textContent = String(message || 'Continue?');
        shell.appendChild(body);

        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions saga-confirm-actions';
        const cancel = createButton('Cancel', 'Cancel this action.', () => finish(false));
        const confirm = createButton('Confirm', 'Confirm and continue.', () => finish(true), 'saga-danger-button');
        actions.appendChild(cancel);
        actions.appendChild(confirm);
        shell.appendChild(actions);

        function finish(value) {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
            resolve(!!value);
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') finish(false);
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) finish(true);
        }

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) finish(false);
        });
        document.addEventListener('keydown', onKeyDown);
        overlay.appendChild(shell);
        document.body.appendChild(overlay);
        setTimeout(() => cancel.focus?.(), 0);
    });
}

function showSagaInputDialog(title, message, initialValue = '', options = {}) {
    if (typeof document === 'undefined' || !document.body) return Promise.resolve(null);
    return new Promise(resolve => {
        document.querySelector('.saga-confirm-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'saga-confirm-overlay';

        const shell = document.createElement('div');
        shell.className = 'saga-confirm-shell saga-input-shell';
        shell.setAttribute('role', 'dialog');
        shell.setAttribute('aria-modal', 'true');
        shell.setAttribute('aria-labelledby', 'saga-input-title');
        shell.setAttribute('aria-describedby', 'saga-input-message');

        const heading = document.createElement('div');
        heading.id = 'saga-input-title';
        heading.className = 'saga-confirm-title';
        heading.textContent = String(title || 'Enter Value');
        shell.appendChild(heading);

        const body = document.createElement('div');
        body.id = 'saga-input-message';
        body.className = 'saga-confirm-message';
        body.textContent = String(message || '');
        shell.appendChild(body);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'text_pole saga-confirm-input';
        input.value = String(initialValue || '');
        input.placeholder = String(options.placeholder || '');
        input.maxLength = Number.isFinite(Number(options.maxLength)) ? Number(options.maxLength) : 120;
        shell.appendChild(input);

        const error = document.createElement('div');
        error.className = 'saga-confirm-error';
        error.hidden = true;
        shell.appendChild(error);

        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions saga-confirm-actions';
        const cancel = createButton('Cancel', 'Cancel this action.', () => finish(null));
        const confirm = createButton(options.confirmLabel || 'Save', 'Save this value.', () => {
            const value = String(input.value || '').trim().replace(/\s+/g, ' ');
            if (options.required && !value) {
                error.textContent = options.requiredMessage || 'A value is required.';
                error.hidden = false;
                input.focus?.();
                return;
            }
            finish(value);
        }, 'saga-primary-button');
        actions.appendChild(cancel);
        actions.appendChild(confirm);
        shell.appendChild(actions);

        function finish(value) {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
            resolve(value);
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(null);
            }
        }

        input.addEventListener('keydown', event => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            confirm.click();
        });
        overlay.addEventListener('click', event => {
            if (event.target === overlay) finish(null);
        });
        document.addEventListener('keydown', onKeyDown);
        overlay.appendChild(shell);
        document.body.appendChild(overlay);
        setTimeout(() => {
            input.focus?.();
            input.select?.();
        }, 0);
    });
}

function showSagaChoiceDialog(title, message, choices = []) {
    if (typeof document === 'undefined' || !document.body) return Promise.resolve(null);
    return new Promise(resolve => {
        document.querySelector('.saga-confirm-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'saga-confirm-overlay';

        const shell = document.createElement('div');
        shell.className = 'saga-confirm-shell saga-choice-shell';
        shell.setAttribute('role', 'dialog');
        shell.setAttribute('aria-modal', 'true');
        shell.setAttribute('aria-labelledby', 'saga-choice-title');
        shell.setAttribute('aria-describedby', 'saga-choice-message');

        const heading = document.createElement('div');
        heading.id = 'saga-choice-title';
        heading.className = 'saga-confirm-title';
        heading.textContent = String(title || 'Choose Action');
        shell.appendChild(heading);

        const body = document.createElement('div');
        body.id = 'saga-choice-message';
        body.className = 'saga-confirm-message';
        body.textContent = String(message || '');
        shell.appendChild(body);

        const choiceWrap = document.createElement('div');
        choiceWrap.className = 'saga-confirm-choice-list';
        for (const choice of choices || []) {
            const value = String(choice?.value || '').trim();
            if (!value) continue;
            const button = createButton(
                choice.label || value,
                choice.tooltip || choice.label || value,
                () => finish(value),
                `saga-confirm-choice-button ${choice.className || ''}`.trim(),
            );
            choiceWrap.appendChild(button);
        }
        shell.appendChild(choiceWrap);

        const actions = document.createElement('div');
        actions.className = 'saga-primary-actions saga-confirm-actions';
        const cancel = createButton('Cancel', 'Cancel this action.', () => finish(null));
        actions.appendChild(cancel);
        shell.appendChild(actions);

        function finish(value) {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
            resolve(value);
        }

        function onKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(null);
            }
        }

        overlay.addEventListener('click', event => {
            if (event.target === overlay) finish(null);
        });
        document.addEventListener('keydown', onKeyDown);
        overlay.appendChild(shell);
        document.body.appendChild(overlay);
        setTimeout(() => cancel.focus?.(), 0);
    });
}

export async function confirmAction(title, message) {
    if (typeof document !== 'undefined' && document.body) {
        return await showSagaConfirmDialog(title, message);
    }
    const hasPopupConfirm = typeof Popup !== 'undefined' && Popup.show && typeof Popup.show.confirm === 'function';
    if (hasPopupConfirm) return await Popup.show.confirm(title, message);
    return false;
}

export async function chooseAction(title, message, choices = []) {
    if (typeof document !== 'undefined' && document.body) {
        return await showSagaChoiceDialog(title, message, choices);
    }
    return null;
}

export async function promptTextAction(title, message, initialValue = '', options = {}) {
    if (typeof document !== 'undefined' && document.body) {
        return await showSagaInputDialog(title, message, initialValue, options);
    }
    if (typeof prompt === 'function') {
        const value = prompt(`${title}\n\n${message}`, String(initialValue || ''));
        if (value === null) return null;
        return String(value || '').trim().replace(/\s+/g, ' ');
    }
    return null;
}

export async function showNoticePopup(title, message) {
    const hasPopupAlert = typeof Popup !== 'undefined' && Popup.show && typeof Popup.show.alert === 'function';
    if (hasPopupAlert) {
        await Popup.show.alert(title, message);
        return;
    }
    if (typeof alert === 'function') {
        alert(`${title}\n\n${message}`);
        return;
    }
    toast(message, 'info');
}

export function toast(message, type = 'success') {
    if (typeof toastr === 'undefined') return;
    if (type === 'error' && toastr.error) toastr.error(message);
    else if (type === 'warning' && toastr.warning) toastr.warning(message);
    else if (type === 'info' && toastr.info) toastr.info(message);
    else if (toastr.success) toastr.success(message);
}
