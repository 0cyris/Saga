// Keep large Libraries responsive without changing row order, keyboard access,
// or the complete set of decks available to selection and drag operations.
export const LOREDECK_LIBRARY_ROW_BATCH_SIZE = 40;

export function cancelLoredeckLibraryRowRender(list) {
    list?.__sagaLoredeckLibraryCancelRows?.();
}

export function restoreLoredeckLibraryRowScroll(list, top = 0, left = 0) {
    if (!list) return;
    if (list.__sagaLoredeckLibraryRestoreScroll) list.__sagaLoredeckLibraryRestoreScroll(top, left);
    else { list.scrollTop = top; list.scrollLeft = left; }
}

export function renderLoredeckLibraryRows(list, rows, renderBatch = callback => callback()) {
    cancelLoredeckLibraryRowRender(list);
    let offset = 0;
    let timer = null;
    let cancelled = false;
    let scrollTarget = null;
    const clearScrollTarget = () => { scrollTarget = null; };
    const restoreScroll = (top, left) => {
        scrollTarget = { top, left };
        list.scrollTop = top;
        list.scrollLeft = left;
    };
    list.__sagaLoredeckLibraryRestoreScroll = restoreScroll;
    const scrollEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    for (const event of scrollEvents) list.addEventListener(event, clearScrollTarget, { passive: true });
    const cancel = () => {
        cancelled = true;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        list.removeAttribute('aria-busy');
        if (list.__sagaLoredeckLibraryCancelRows === cancel) delete list.__sagaLoredeckLibraryCancelRows;
        if (list.__sagaLoredeckLibraryRestoreScroll === restoreScroll) delete list.__sagaLoredeckLibraryRestoreScroll;
        for (const event of scrollEvents) list.removeEventListener(event, clearScrollTarget);
    };
    list.__sagaLoredeckLibraryCancelRows = cancel;
    const appendBatch = () => {
        timer = null;
        const started = performance.now();
        renderBatch(() => {
            const fragment = document.createDocumentFragment();
            let count = 0;
            while (offset < rows.length && count < LOREDECK_LIBRARY_ROW_BATCH_SIZE) {
                fragment.appendChild(rows[offset++]());
                count++;
                if (performance.now() - started >= 8) break;
            }
            list.appendChild(fragment);
        });
        if (scrollTarget) {
            list.scrollTop = scrollTarget.top;
            list.scrollLeft = scrollTarget.left;
        }
        if (offset >= rows.length) {
            cancel();
            return;
        }
        list.setAttribute('aria-busy', 'true');
        timer = setTimeout(() => {
            if (cancelled || !list.isConnected) { cancel(); return; }
            appendBatch();
        }, 0);
    };
    appendBatch();
}
