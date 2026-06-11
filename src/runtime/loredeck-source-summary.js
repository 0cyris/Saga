/**
 * loredeck-source-summary.js - Saga
 * Display summary helpers for Loredeck source metadata.
 */

export function getLoredeckSourceSummary(pack) {
    const source = pack?.source && typeof pack.source === 'object' && !Array.isArray(pack.source) ? pack.source : {};
    const kind = source.kind || (pack?.manifest ? (/^https?:\/\//i.test(pack.manifest) ? 'url' : 'path') : 'unknown');
    const parts = [kind];
    if (source.installedFrom) parts.push(`file: ${source.installedFrom}`);
    if (source.originalPackId && source.originalPackId !== pack?.packId) parts.push(`source deck: ${source.originalPackId}`);
    const updateUrl = source.updateUrl || '';
    if (updateUrl) parts.push('update URL registered');
    if (pack?.localModified) parts.push('locally modified');
    return parts.filter(Boolean).join(' | ') || 'unknown';
}
