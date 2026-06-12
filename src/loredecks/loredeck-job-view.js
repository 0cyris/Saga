/**
 * loredeck-job-view.js -- Saga
 * Shared Loredeck async job and progress rendering primitives.
 *
 * Keep this module UI-only. Callers own job state, cancellation, retry,
 * persistence, and recovery behavior.
 */

import {
    addTooltip,
    createButton,
} from '../ui/runtime-ui-kit.js';

function normalizeJobStatus(status, active = false) {
    const fallback = active ? 'running' : 'complete';
    return String(status || fallback)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || fallback;
}

export function formatLoredeckJobElapsed(ms = 0) {
    const value = Number(ms);
    const seconds = Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function getLoredeckJobProgressPercent(value = 0) {
    const percent = Number(value);
    return Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
}

export function createLoredeckJobProgressBar(value = 0, options = {}) {
    const percent = getLoredeckJobProgressPercent(value);
    const progress = document.createElement(options.tagName || 'div');
    progress.className = options.className || 'saga-loredeck-job-progress';

    const fill = document.createElement(options.fillTagName || 'span');
    if (options.fillClassName) fill.className = options.fillClassName;
    fill.style.width = `${percent}%`;
    progress.appendChild(fill);

    const tooltip = typeof options.tooltip === 'function'
        ? options.tooltip(percent)
        : options.tooltip;
    addTooltip(progress, tooltip || `${percent}% complete.`);
    return progress;
}

export function formatLoredeckJobMeta(job = {}) {
    if (job.metaText) return String(job.metaText);
    const streamText = job.streamSupported === true
        ? 'streaming'
        : job.streamSupported === false
            ? 'final response'
            : 'provider pending';
    const chars = Number(job.receivedChars || 0);
    const batchLabel = String(job.batchLabel || '').trim();
    return `${streamText}${chars ? ` | ${chars} chars` : ''}${batchLabel ? ` | ${batchLabel}` : ''}`;
}

export function getLoredeckJobStatusIconText(status = '', active = false) {
    if (active) return '';
    const normalized = normalizeJobStatus(status, false);
    if (['error', 'failed', 'interrupted'].includes(normalized)) return '!';
    if (normalized === 'cancelled') return 'X';
    if (normalized === 'warning') return '?';
    return 'OK';
}

export function createLoredeckJobStatusRow(job = {}, options = {}) {
    const active = job.active === true;
    const status = normalizeJobStatus(job.status, active);
    const baseClassName = options.className || 'saga-generation-live-status';
    const row = document.createElement(options.tagName || 'div');
    row.className = `${baseClassName} ${options.statusClassPrefix || baseClassName}-${active ? 'running' : status}`.trim();
    if (options.compact) row.classList.add(options.compactClassName || `${baseClassName}-compact`);

    const icon = document.createElement('div');
    icon.className = active
        ? (options.activeIconClassName || 'saga-generation-thinking-icon')
        : (options.resultIconClassName || 'saga-generation-result-icon');
    icon.textContent = getLoredeckJobStatusIconText(status, active);
    row.appendChild(icon);

    const main = document.createElement('div');
    main.className = options.mainClassName || 'saga-generation-live-main';
    const line = document.createElement('div');
    line.className = options.lineClassName || 'saga-generation-live-line';

    const label = document.createElement('span');
    label.className = options.labelClassName || 'saga-generation-live-label';
    label.textContent = String(job.label || options.label || 'Job');
    line.appendChild(label);

    const text = document.createElement('span');
    text.className = options.textClassName || 'saga-generation-live-text';
    text.textContent = String(job.message || options.message || (active ? 'Running...' : 'Complete.'));
    line.appendChild(text);

    const elapsed = document.createElement('span');
    elapsed.className = options.elapsedClassName || 'saga-generation-live-elapsed';
    elapsed.textContent = formatLoredeckJobElapsed(job.elapsedMs);
    line.appendChild(elapsed);

    if (active && typeof options.onCancel === 'function') {
        const cancel = createButton(
            options.cancelLabel || 'Cancel',
            options.cancelTooltip || 'Cancel this job.',
            options.onCancel,
            options.cancelClassName || 'saga-generation-cancel-button',
        );
        line.appendChild(cancel);
    }
    main.appendChild(line);

    const meta = document.createElement('div');
    meta.className = options.metaClassName || 'saga-generation-live-meta';
    meta.textContent = typeof options.getMetaText === 'function'
        ? String(options.getMetaText(job) || '')
        : formatLoredeckJobMeta(job);
    main.appendChild(meta);

    row.appendChild(main);
    return row;
}
