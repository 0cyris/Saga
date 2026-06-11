/**
 * loredeck-manifest-formatters.js - Saga
 * Display formatters for Loredeck manifest metadata.
 */

import {
    formatStructuredValue,
} from '../ui/runtime-ui-kit.js';

export function formatLoredeckManifestContinuity(continuity) {
    if (!continuity || typeof continuity !== 'object' || Array.isArray(continuity)) return 'unset';
    const parts = [
        continuity.continuityId ? `ID: ${continuity.continuityId}` : '',
        continuity.canonTier ? `tier: ${continuity.canonTier}` : '',
        continuity.adaptation ? `adaptation: ${continuity.adaptation}` : '',
        continuity.sourceBoundary ? `boundary: ${continuity.sourceBoundary}` : '',
    ].filter(Boolean);
    return parts.join(' | ') || 'unset';
}

export function formatLoredeckCompatibility(compatibility) {
    if (!compatibility || typeof compatibility !== 'object' || Array.isArray(compatibility)) return 'unset';
    const min = compatibility.sagaSchemaMin ?? compatibility.min ?? '';
    const max = compatibility.sagaSchemaMax ?? compatibility.max ?? '';
    if (min || max) return `Saga schema ${min || '?'}-${max || '?'}`;
    return formatStructuredValue(compatibility) || 'unset';
}
