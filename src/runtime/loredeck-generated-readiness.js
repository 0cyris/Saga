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

function getHealthIssueCounts(health = null) {
    const summary = health?.summary && typeof health.summary === 'object' && !Array.isArray(health.summary)
        ? health.summary
        : {};
    const count = (summaryKey, listKey) => {
        const number = Number(summary[summaryKey]);
        if (Number.isFinite(number)) return Math.max(0, Math.round(number));
        return Array.isArray(health?.[listKey]) ? health[listKey].length : 0;
    };
    return {
        errors: count('errorCount', 'errors'),
        warnings: count('warningCount', 'warnings'),
        suggestions: count('suggestionCount', 'suggestions'),
    };
}

function formatPackHealthCounts(counts = {}) {
    return `${counts.errors || 0} error${(counts.errors || 0) === 1 ? '' : 's'}, ${counts.warnings || 0} warning${(counts.warnings || 0) === 1 ? '' : 's'}`;
}

function normalizePackHealthStatus(value = '') {
    return String(value || '').trim().toLowerCase();
}

function getPackHealthStatusState(status = '') {
    const clean = normalizePackHealthStatus(status);
    const hasErrors = ['has_errors', 'error', 'errors', 'failed'].includes(clean);
    const needsReview = ['needs_review', 'warning', 'warnings', 'review'].includes(clean);
    const stale = clean === 'stale';
    const cleanStatus = ['good', 'ok', 'pass', 'passed', 'clean'].includes(clean);
    const known = hasErrors || needsReview || stale || cleanStatus;
    let summary = '';
    if (hasErrors) summary = 'Pack Health: Errors';
    else if (needsReview) summary = 'Pack Health: Review';
    else if (stale) summary = 'Pack Health: Stale';
    else if (cleanStatus) summary = 'Pack Health: Clean';
    return {
        status: clean,
        known,
        hasErrors,
        needsReview,
        stale,
        clean: cleanStatus,
        summary,
    };
}

export function getGeneratedLoredeckExportReadiness(pack = {}, health = null, creatorJob = null) {
    const healthCounts = getHealthIssueCounts(health);
    const packHealthState = getPackHealthStatusState(health?.status || pack?.healthStatus || '');
    const healthScanned = !!health || packHealthState.known;
    const healthHasErrors = healthCounts.errors > 0 || packHealthState.hasErrors;
    const healthNeedsReview = healthCounts.warnings > 0 || packHealthState.needsReview;
    const healthIsStale = packHealthState.stale;
    const healthSummary = health
        ? `Pack Health: ${formatPackHealthCounts(healthCounts)}`
        : (packHealthState.summary || 'Pack Health: Not scanned');
    const healthStatus = health?.status || packHealthState.status || '';
    if (!isGeneratedLoredeckPack(pack)) {
        return {
            ready: true,
            blockers: [],
            warnings: [],
            healthScanned,
            healthStatus,
            healthErrorCount: healthCounts.errors,
            healthWarningCount: healthCounts.warnings,
            healthSuggestionCount: healthCounts.suggestions,
            healthSummary,
            healthHasErrors,
            healthNeedsReview,
            healthIsStale,
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
    const staleByDependency = isLoredeckHealthStatusStale(pack);
    const blockers = [];
    const warnings = [...(pipeline.warnings || [])];
    if (!acceptedEntries.length) blockers.push('Generated Loredeck needs at least one accepted Lorecard.');
    if (pendingChanges.length) blockers.push('Pending Review must be accepted or rejected before finalizing as Custom.');
    if (draftChanges.length) blockers.push('Creator/Assistant Draft Batch must be queued, accepted, or dropped before finalizing as Custom.');
    if (pipeline.coverage?.finalizeAcknowledgementRequired) blockers.push(LOREDECK_CREATOR_COVERAGE_FINALIZE_BLOCKER);
    if (!healthScanned) blockers.push('Pack Health has not been run for this Generated Loredeck.');
    if (healthIsStale || staleByDependency) blockers.push('Pack Health is stale; rerun validation before finalizing as Custom.');
    if (healthHasErrors) blockers.push(healthCounts.errors ? `Pack Health: ${formatPackHealthCounts(healthCounts)}.` : 'Pack Health has errors.');
    else if (healthScanned && healthNeedsReview) warnings.push(healthCounts.warnings ? `Pack Health: ${formatPackHealthCounts(healthCounts)}.` : 'Pack Health needs review.');
    if (!getLoredeckTimelineRegistryCount(pack.timelineRegistry)) warnings.push('No local timeline registry is saved yet.');
    if (!getLoredeckTagRegistryCount(pack.tagRegistry)) warnings.push('No local tag registry is saved yet.');
    return {
        ready: blockers.length === 0,
        blockers,
        warnings,
        healthScanned,
        healthStatus,
        healthErrorCount: healthCounts.errors,
        healthWarningCount: healthCounts.warnings,
        healthSuggestionCount: healthCounts.suggestions,
        healthSummary,
        healthHasErrors,
        healthNeedsReview,
        healthIsStale: healthIsStale || staleByDependency,
        acceptedEntryCount: acceptedEntries.length,
        pendingChangeCount: pendingChanges.length,
        draftChangeCount: draftChanges.length,
        coverageAcknowledgementRequired: !!pipeline.coverage?.finalizeAcknowledgementRequired,
        pipeline,
    };
}
