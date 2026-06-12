/**
 * loredeck-validation-view.js -- Saga
 * Shared validation and Pack Health rendering primitives.
 *
 * Keep this module UI-only. Callers own issue grouping, repair actions,
 * persistence, and feature-specific health semantics.
 */

import {
    appendLoredeckStatusPills,
    createLoredeckCardTitle,
    createLoredeckEmptyState,
} from './loredeck-ui-kit.js';
import {
    addTooltip,
} from '../ui/runtime-ui-kit.js';

export function createLoredeckValidationSeverityCard(options = {}) {
    const tone = String(options.tone || 'checked').trim() || 'checked';
    const card = document.createElement('div');
    card.className = `${options.className || 'saga-loredeck-health-severity-card'} ${options.toneClassName || `saga-loredeck-health-severity-card-${tone}`}`.trim();

    const label = document.createElement('span');
    label.textContent = String(options.label || '');
    card.appendChild(label);

    const value = document.createElement('strong');
    value.textContent = String(options.value ?? '0');
    card.appendChild(value);

    const detail = document.createElement('small');
    detail.textContent = String(options.detail || '');
    card.appendChild(detail);

    return card;
}

export function createLoredeckValidationSeverityGrid(items = [], options = {}) {
    const grid = document.createElement('div');
    grid.className = `${options.className || 'saga-loredeck-health-severity-grid'}${options.compact ? ` ${options.compactClassName || 'saga-loredeck-health-severity-grid-compact'}` : ''}`;
    for (const item of items || []) {
        grid.appendChild(createLoredeckValidationSeverityCard(item));
    }
    return grid;
}

export function createLoredeckValidationMetric(label, value, tooltip, options = {}) {
    const metric = document.createElement(options.tagName || 'div');
    metric.className = options.className || 'saga-loredeck-health-metric';
    addTooltip(metric, tooltip || label);

    const key = document.createElement('span');
    key.textContent = String(label || '');
    metric.appendChild(key);

    const val = document.createElement('strong');
    val.textContent = String(value || '0');
    metric.appendChild(val);

    return metric;
}

export function createLoredeckValidationCategoryList(categories = [], options = {}) {
    const list = document.createElement(options.tagName || 'div');
    list.className = `${options.asPanel ? `${options.panelClassName || 'saga-loredeck-health-panel'} ` : ''}${options.className || 'saga-loredeck-health-category-list'}`.trim();

    for (const category of categories || []) {
        const row = document.createElement('div');
        const tone = String(category?.tone || 'unknown').trim() || 'unknown';
        row.className = `${options.rowClassName || 'saga-loredeck-health-category-row'} ${options.rowToneClassPrefix || 'saga-loredeck-health-category-row'}-${tone}`.trim();

        const name = document.createElement('span');
        name.textContent = String(category?.label || '');
        row.appendChild(name);

        const status = document.createElement('span');
        status.textContent = String(category?.status || '');
        row.appendChild(status);

        addTooltip(row, category?.tooltip);
        list.appendChild(row);
    }
    return list;
}

function normalizeIssueMetaItems(issue = {}, options = {}) {
    if (typeof options.getMetaItems === 'function') return options.getMetaItems(issue) || [];
    return [];
}

export function createLoredeckValidationIssueList(titleText, issues = [], options = {}) {
    const severity = String(options.severity || 'suggestion').trim() || 'suggestion';
    const limit = Math.max(1, Number(options.limit) || 12);
    const wrap = document.createElement('div');
    wrap.className = options.sectionClassName || `saga-loredeck-health-issue-section saga-loredeck-health-issue-section-${severity}`;

    wrap.appendChild(createLoredeckCardTitle(`${titleText}: ${issues.length}`));

    if (!issues.length) {
        wrap.appendChild(createLoredeckEmptyState(options.emptyText || `No ${String(titleText || 'issues').toLowerCase()}.`));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = options.listClassName || 'saga-loredeck-health-issue-list';
    for (const issue of issues.slice(0, limit)) {
        const item = document.createElement('div');
        item.className = options.itemClassName || `saga-loredeck-health-issue saga-loredeck-health-issue-${severity}`;

        const code = document.createElement('div');
        code.className = options.codeClassName || 'saga-loredeck-health-issue-code';
        code.textContent = typeof options.getCode === 'function'
            ? options.getCode(issue)
            : (issue?.code || severity);
        item.appendChild(code);

        const message = document.createElement('div');
        message.className = options.messageClassName || 'saga-loredeck-health-issue-message';
        message.textContent = typeof options.getMessage === 'function'
            ? options.getMessage(issue)
            : (issue?.message || 'No message.');
        item.appendChild(message);

        const meta = document.createElement('div');
        meta.className = options.metaClassName || 'saga-loredeck-row-meta';
        appendLoredeckStatusPills(meta, normalizeIssueMetaItems(issue, options));
        item.appendChild(meta);

        list.appendChild(item);
    }
    if (issues.length > limit) {
        const more = document.createElement('div');
        more.className = options.moreClassName || 'saga-runtime-help';
        more.textContent = options.moreText || `Showing first ${limit} of ${issues.length}. Export Health JSON for the full list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}
