/**
 * loredeck-generated-export-card.js - Saga
 * Generated Loredeck export readiness card.
 */

import {
    createStatusPill,
} from '../ui/runtime-ui-kit.js';
import {
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
} from './loredeck-package-helpers.js';
import {
    isGeneratedLoredeckPack,
} from './loredeck-virtual-data.js';

let deps = {};

function dep(name, fallback = () => undefined) {
    return typeof deps[name] === 'function' ? deps[name] : fallback;
}

export function configureGeneratedLoredeckExportCard(nextDeps = {}) {
    deps = { ...deps, ...nextDeps };
}

export function formatGeneratedLoredeckExportNotice(message = '') {
    if (message.includes('needs at least one accepted Lorecard')) return 'No accepted Lorecards are available for export yet.';
    if (message.includes('Pending Review')) return 'Pending Review proposals are excluded from export until accepted.';
    if (message.includes('Draft Batch')) return 'Creator/Assistant draft proposals are excluded from export until accepted.';
    if (message.includes('Creator Coverage')) return 'Creator Coverage needs expansion or explicit light-coverage acknowledgement before finalization.';
    return message;
}

function appendGeneratedLoredeckReadinessItems(container, blockers = [], warnings = []) {
    if (!blockers.length && !warnings.length) return;
    const list = document.createElement('div');
    list.className = 'saga-loredeck-generated-readiness-list';
    for (const blocker of blockers) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-blocker';
        item.textContent = blocker;
        list.appendChild(item);
    }
    for (const warning of warnings) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-warning';
        item.textContent = warning;
        list.appendChild(item);
    }
    container.appendChild(list);
}

export function createGeneratedLoredeckExportReadinessCard(pack = {}) {
    if (!isGeneratedLoredeckPack(pack)) return null;
    const getLoredeckManifestPreviewCacheRecord = dep('getLoredeckManifestPreviewCacheRecord', () => null);
    const getGeneratedLoredeckExportReadiness = dep('getGeneratedLoredeckExportReadiness', () => ({ ready: true, blockers: [], warnings: [] }));
    const cached = getLoredeckManifestPreviewCacheRecord(pack.packId);
    const readiness = getGeneratedLoredeckExportReadiness(pack, cached?.health || null);
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview saga-loredeck-generated-readiness';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Generated Export Snapshot';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(readiness.ready ? 'Clean' : 'Review state', 'Export is available; this summarizes accepted entries, pending review, and draft batch state.'));
    summary.appendChild(createStatusPill(readiness.pipeline?.statusLabel || 'Pipeline check', 'Creator pipeline status from staged generation metadata.'));
    summary.appendChild(createStatusPill(`${readiness.acceptedEntryCount} accepted`, 'Accepted generated Lorecards that will export and load at runtime.'));
    summary.appendChild(createStatusPill(`${readiness.pendingChangeCount} pending`, 'Pending Review proposals are excluded from export until accepted.'));
    summary.appendChild(createStatusPill(`${readiness.draftChangeCount} drafted`, 'Creator/Assistant draft proposals are excluded from export until accepted.'));
    if (readiness.pipeline?.titleBatchCount) {
        summary.appendChild(createStatusPill(`${readiness.pipeline.titleBatchDraftedCount}/${readiness.pipeline.titleBatchCount} title sets`, 'Title sets drafted from the approved Story Outline.'));
    }
    if (readiness.pipeline?.eligiblePlanningBatchCount) {
        summary.appendChild(createStatusPill(`${readiness.pipeline.acceptedPlanningBatchCount}/${readiness.pipeline.eligiblePlanningBatchCount} Context sets accepted`, 'Context and Tag sets accepted into the Generated Loredeck registry.'));
    }
    if (readiness.pipeline?.approvedTitleCount) {
        summary.appendChild(createStatusPill(`${readiness.pipeline.approvedTitleAcceptedCount}/${readiness.pipeline.approvedTitleCount} titles covered`, 'Approved title plan covered by accepted generated Lorecards.'));
    }
    if (readiness.pipeline?.coverage?.available) {
        summary.appendChild(createStatusPill(
            `Coverage: ${readiness.pipeline.coverage.statusLabel || 'Review'}`,
            'Adaptive Creator coverage status. This is advisory and does not enforce a fixed Lorecard count.'
        ));
    }
    summary.appendChild(createStatusPill(`${getLoredeckTimelineRegistryCount(pack.timelineRegistry)} timeline`, 'Saved local timeline anchors/windows.'));
    summary.appendChild(createStatusPill(`${getLoredeckTagRegistryCount(pack.tagRegistry)} tags`, 'Saved local tag definitions.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = readiness.ready
        ? 'Export will include accepted generated Lorecards, embedded manifest stats, local timeline/tag registries, and passive package assets.'
        : 'Export is available now. Pending or drafted material is reported here and will not be included until it is accepted into the deck.';
    wrap.appendChild(help);

    appendGeneratedLoredeckReadinessItems(wrap, [], [
        ...(readiness.blockers || []).map(formatGeneratedLoredeckExportNotice),
        ...(readiness.warnings || []),
    ]);

    return wrap;
}
