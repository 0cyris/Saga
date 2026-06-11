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
