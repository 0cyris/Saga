import { formatRelativeHealthTime } from '../loredecks/loredeck-health-panel.js';

export function formatContextBriefUpdatedAt(brief = {}) {
    const timestamp = Number(brief?.updatedAt || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';
    return formatRelativeHealthTime(timestamp);
}

export function formatLoredeckContextUpdatedAt(context = {}) {
    const timestamp = Number(context?.updatedAt || context?.lastDetectedAt || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';
    return formatRelativeHealthTime(timestamp);
}
