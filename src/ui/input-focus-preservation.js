/**
 * input-focus-preservation.js -- Saga
 * Helpers for controls that re-render the DOM node currently receiving input.
 */

function getOwnerDocument(input) {
    return input?.ownerDocument || (typeof document !== 'undefined' ? document : null);
}

function clampSelectionIndex(value, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return max;
    return Math.max(0, Math.min(max, Math.trunc(number)));
}

export function captureTextInputFocus(input) {
    const doc = getOwnerDocument(input);
    const value = String(input?.value ?? '');
    const fallback = value.length;
    return {
        focused: !!(doc && input && doc.activeElement === input),
        value,
        selectionStart: clampSelectionIndex(input?.selectionStart, fallback),
        selectionEnd: clampSelectionIndex(input?.selectionEnd, fallback),
        selectionDirection: typeof input?.selectionDirection === 'string' ? input.selectionDirection : 'none',
    };
}

export function restoreTextInputFocus(target, snapshot = {}, options = {}) {
    if (!snapshot?.focused && options.requirePreviouslyFocused !== false) return false;
    const root = options.root || (typeof document !== 'undefined' ? document : null);
    const input = typeof target === 'string' ? root?.querySelector?.(target) : target;
    if (!input) return false;

    try {
        input.focus?.({ preventScroll: true });
    } catch {
        input.focus?.();
    }

    if (typeof input.setSelectionRange === 'function') {
        const max = String(input.value ?? '').length;
        const start = clampSelectionIndex(snapshot.selectionStart, max);
        const end = clampSelectionIndex(snapshot.selectionEnd, max);
        try {
            input.setSelectionRange(start, end, snapshot.selectionDirection || 'none');
        } catch {
            input.setSelectionRange(start, end);
        }
    }
    return true;
}

export function restoreTextInputFocusAfterRender(target, snapshot = {}, options = {}) {
    const root = options.root || getOwnerDocument(options.input);
    const restore = () => restoreTextInputFocus(
        typeof target === 'function' ? target() : target,
        snapshot,
        { ...options, root },
    );
    if (options.defer === false) return restore();
    const scheduler = root?.defaultView?.requestAnimationFrame
        || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
    if (scheduler) {
        scheduler(restore);
        return true;
    }
    restore();
    return true;
}

export function preserveInputFocusAfterRender(input, target, render, options = {}) {
    const snapshot = captureTextInputFocus(input);
    const result = typeof render === 'function' ? render() : undefined;
    restoreTextInputFocusAfterRender(target, snapshot, {
        ...options,
        input,
        root: options.root || getOwnerDocument(input),
    });
    return result;
}
