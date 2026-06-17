import {
    formatLoredeckCreatorCoverageStatus,
    isLoredeckCreatorCoverageDimensionTargetable,
    normalizeLoredeckCreatorCoverageIdList,
} from './loredeck-creator-coverage.js';

function callOrFallback(fn, fallback, ...args) {
    return typeof fn === 'function' ? fn(...args) : fallback;
}

function getClockNow(deps = {}) {
    return typeof deps.now === 'function' ? deps.now() : Date.now();
}

function getResolvedUiStage(cached = {}, deps = {}) {
    const input = {
        ...(cached || {}),
        activeGeneration: null,
        status: '',
        currentStage: '',
    };
    return callOrFallback(deps.inferUiStage, input.currentStage || '', input);
}

export function buildLoredeckCreatorCoverageFinalizeConfirmation(coverage = {}) {
    const unresolved = (coverage.dimensions || [])
        .filter(dimension => isLoredeckCreatorCoverageDimensionTargetable(dimension))
        .slice(0, 8)
        .map(dimension => `- ${dimension.label || dimension.id}: ${dimension.statusLabel || formatLoredeckCreatorCoverageStatus(dimension.derivedStatus || dimension.status)}`);
    const unresolvedCount = Number(coverage.missingDimensionCount || 0) + Number(coverage.thinDimensionCount || 0);
    const lines = coverage.available
        ? [
            'Deck Maker Coverage still has missing or thin rows:',
            ...unresolved,
            unresolvedCount > unresolved.length
                ? `- ...and ${unresolvedCount - unresolved.length} more`
                : '',
            '',
            'This does not create filler Lorecards or set a fixed entry quota. It records that you intentionally accept the current coverage for finalization.',
        ]
        : [
            'This Deck Maker job has no adaptive coverage plan.',
            'Redraft the Scope Brief or Story Outline for the strongest density review, or continue only if this missing coverage plan is intentional for the current alpha workflow.',
            '',
            'This records that you intentionally accept finalizing without a Deck Maker Coverage plan.',
        ];
    return {
        title: coverage.available ? 'Finalize Anyway with light coverage?' : 'Finalize Anyway without Deck Maker Coverage?',
        message: lines.filter(Boolean).join('\n'),
        unresolved,
    };
}

export function buildLoredeckCreatorCoverageFinalizeAcknowledgement(coverage = {}, now = Date.now()) {
    return {
        mode: 'finalize_anyway',
        acknowledgedAt: Number(now || 0),
        coverageSignature: coverage.finalizationSignature,
        status: coverage.status,
        missingDimensionIds: normalizeLoredeckCreatorCoverageIdList(coverage.missingDimensionIds || [], 24),
        thinDimensionIds: normalizeLoredeckCreatorCoverageIdList(coverage.thinDimensionIds || [], 24),
        note: coverage.available
            ? 'User chose to finalize despite unresolved adaptive coverage rows.'
            : 'User chose to finalize without an adaptive coverage plan.',
    };
}

export function createLoredeckCreatorCoverageFinalizationController(deps = {}) {
    const getCurrentJob = () => callOrFallback(deps.getCurrentJob, {}, {}) || {};
    const getGeneratedPackDefinition = packId => callOrFallback(deps.getGeneratedPackDefinition, null, packId);
    const getCoverageModel = (cached, generatedPack) => callOrFallback(deps.getCoverageModel, {}, cached, generatedPack) || {};
    const setCurrentJob = (job, options = {}) => callOrFallback(deps.setCurrentJob, job, job, options);
    const setCurrentJobLocal = job => {
        if (typeof deps.setCurrentJobLocal === 'function') deps.setCurrentJobLocal(job);
        return job;
    };
    const updateCreatorProject = (jobId, patch, options = {}) => callOrFallback(deps.updateCreatorProject, null, jobId, patch, options);
    const refreshPanelBody = options => callOrFallback(deps.refreshPanelBody, null, options);
    const refreshWorkbenchBody = options => callOrFallback(deps.refreshWorkbenchBody, null, options);
    const confirmAction = (title, message) => callOrFallback(deps.confirmAction, Promise.resolve(false), title, message);
    const toast = (message, tone) => callOrFallback(deps.toast, null, message, tone);
    const warn = (message, error) => {
        if (typeof deps.warn === 'function') deps.warn(message, error);
        else console.warn(message, error);
    };

    async function acknowledgeCoverageForFinalize() {
        const cached = getCurrentJob();
        const generatedPack = cached.generatedPackId ? getGeneratedPackDefinition(cached.generatedPackId) : null;
        const coverage = getCoverageModel(cached, generatedPack);
        if (!coverage.available && !coverage.finalizeAcknowledgementRequired) {
            toast('Deck Maker Coverage is not available for this job yet.', 'warning');
            return false;
        }
        if (!coverage.finalizeAcknowledgementRequired) {
            toast(coverage.finalizeAcknowledged ? 'Deck Maker Coverage finalization acknowledgement is already current.' : 'Deck Maker Coverage does not need finalization acknowledgement.', 'info');
            return false;
        }
        const confirmation = buildLoredeckCreatorCoverageFinalizeConfirmation(coverage);
        const proceed = await confirmAction(confirmation.title, confirmation.message);
        if (!proceed) return false;
        const restoredStage = getResolvedUiStage(cached, deps);
        const acknowledgement = buildLoredeckCreatorCoverageFinalizeAcknowledgement(coverage, getClockNow(deps));
        const jobPatch = {
            activeGeneration: null,
            status: cached.brief ? 'draft' : 'idle',
            currentStage: restoredStage,
            coverageFinalizeAcknowledgement: acknowledgement,
        };
        const acknowledgedJob = setCurrentJob({
            ...cached,
            ...jobPatch,
        });
        if (!acknowledgedJob?.coverageFinalizeAcknowledgement && cached.jobId) {
            const direct = updateCreatorProject(cached.jobId, jobPatch, { syncPrompt: false, syncLocal: true });
            if (direct?.ok && direct.job) {
                setCurrentJobLocal(direct.job);
            } else {
                warn('[Saga] Deck Maker Coverage acknowledgement persistence fallback failed:', direct?.error || direct);
            }
        }
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshWorkbenchBody({ preserveScroll: true });
        toast(coverage.available ? 'Deck Maker Coverage acknowledged for finalization.' : 'Missing Deck Maker Coverage plan acknowledged for finalization.', 'success');
        return true;
    }

    return {
        acknowledgeCoverageForFinalize,
    };
}
