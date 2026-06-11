import { humanizeScopeKey } from '../ui/runtime-ui-kit.js';

export function estimateTokens(text) {
    return Math.ceil(String(text || '').length / 4);
}

export function truncateText(text, maxLen) {
    const value = String(text || '');
    if (value.length <= maxLen) return value;
    return value.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

export function truncateCleanText(text, maxLen) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLen) return clean;
    return `${clean.slice(0, Math.max(0, maxLen - 1))}...`;
}

export function sanitizeFileStem(value) {
    const text = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return text || 'saga-export';
}

export function formatCategoryCounts(categoryCounts = {}) {
    if (!categoryCounts || typeof categoryCounts !== 'object' || Array.isArray(categoryCounts)) return '';
    return Object.entries(categoryCounts)
        .filter(([, count]) => Number(count) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 6)
        .map(([category, count]) => `${humanizeScopeKey(category)}: ${count}`)
        .join(', ');
}

export function formatProviderRailModelName(value = '') {
    const label = String(value || '').trim();
    const slashIndex = label.lastIndexOf('/');
    if (slashIndex < 0 || slashIndex >= label.length - 1) return label;
    return label.slice(slashIndex + 1).trim() || label;
}

export function formatActiveChatMetricName(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.replace(/\\/g, '/').split('/').filter(Boolean).pop() || raw;
    return normalized.replace(/\.(jsonl|json)$/i, '').trim() || raw;
}
