/**
 * loredeck-selection-toolbar.js -- Saga
 * Shared Loredeck selection summary helpers.
 *
 * Keep action buttons and mutations in the caller. This module only renders
 * small, reusable selection status surfaces.
 */

import { addTooltip } from '../ui/runtime-ui-kit.js';

export function formatLoredeckSelectionSummary(options = {}) {
    const selectedCount = Math.max(0, Number(options.selectedCount) || 0);
    if (!selectedCount && options.emptyText) return String(options.emptyText);

    const label = String(options.label || 'selected').trim() || 'selected';
    let text = `${selectedCount} ${label}`;
    if (Number.isFinite(Number(options.visibleSelectedCount))) {
        const visibleSelectedCount = Math.max(0, Number(options.visibleSelectedCount) || 0);
        if (visibleSelectedCount !== selectedCount) text += ` (${visibleSelectedCount} visible)`;
    }
    return text;
}

export function createLoredeckSelectionSummary(options = {}) {
    const summary = document.createElement(options.tagName || 'div');
    summary.className = options.className || 'saga-loredeck-selection-summary';
    summary.textContent = formatLoredeckSelectionSummary(options);
    addTooltip(summary, options.tooltip);
    return summary;
}
