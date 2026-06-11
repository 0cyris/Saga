/**
 * loredeck-generated-readiness.js - Saga
 * Readiness model for Generated Loredeck export/finalization summaries.
 */

import {
    LOREDECK_CREATOR_COVERAGE_FINALIZE_BLOCKER,
} from '../loredecks/loredeck-creator-coverage.js';
import {
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
} from './loredeck-package-helpers.js';
import {
    getAcceptedGeneratedLoredeckEntries,
    isGeneratedLoredeckPack,
} from './loredeck-virtual-data.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureGeneratedLoredeckReadiness(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function getGeneratedLoredeckExportReadiness(pack = {}, health = null, creatorJob = null) {
    if (!isGeneratedLoredeckPack(pack)) {
        return {
            ready: true,
            blockers: [],
            warnings: [],
            acceptedEntryCount: 0,
            pendingChangeCount: 0,
            draftChangeCount: 0,
            pipeline: null,
        };
    }
    const getLoredeckPendingChanges = dep('getLoredeckPendingChanges', () => []);
    const getLoredeckAssistantDraftChanges = dep('getLoredeckAssistantDraftChanges', () => []);
    const getLoredeckAssistantDraftCacheRecord = dep('getLoredeckAssistantDraftCacheRecord', () => ({}));
    const getLoredeckCreatorPipelineReadiness = dep('getLoredeckCreatorPipelineReadiness', () => ({ warnings: [], coverage: null }));
    const isLoredeckHealthStatusStale = dep('isLoredeckHealthStatusStale', () => false);

    const acceptedEntries = getAcceptedGeneratedLoredeckEntries(pack);
    const pendingChanges = getLoredeckPendingChanges(pack);
    const draftChanges = getLoredeckAssistantDraftChanges(getLoredeckAssistantDraftCacheRecord(pack.packId) || {});
    const pipeline = getLoredeckCreatorPipelineReadiness(pack, creatorJob);
    const blockers = [];
    const warnings = [...(pipeline.warnings || [])];
    if (!acceptedEntries.length) blockers.push('Generated Loredeck needs at least one accepted Lorecard.');
    if (pendingChanges.length) blockers.push('Pending Review must be accepted or rejected before finalizing as Custom.');
    if (draftChanges.length) blockers.push('Creator/Assistant Draft Batch must be queued, accepted, or dropped before finalizing as Custom.');
    if (pipeline.coverage?.finalizeAcknowledgementRequired) blockers.push(LOREDECK_CREATOR_COVERAGE_FINALIZE_BLOCKER);
    if (isLoredeckHealthStatusStale(pack)) warnings.push('Deck Health is stale; rerun validation before sharing.');
    if ((health?.errors || []).length) warnings.push('Latest Deck Health has errors.');
    if (!getLoredeckTimelineRegistryCount(pack.timelineRegistry)) warnings.push('No local timeline registry is saved yet.');
    if (!getLoredeckTagRegistryCount(pack.tagRegistry)) warnings.push('No local tag registry is saved yet.');
    return {
        ready: blockers.length === 0,
        blockers,
        warnings,
        acceptedEntryCount: acceptedEntries.length,
        pendingChangeCount: pendingChanges.length,
        draftChangeCount: draftChanges.length,
        coverageAcknowledgementRequired: !!pipeline.coverage?.finalizeAcknowledgementRequired,
        pipeline,
    };
}
