import {
    getLoredeckCreatorCoveragePlan,
    normalizeLoredeckCreatorCoverageId,
    normalizeLoredeckCreatorCoverageStatus,
} from './loredeck-creator-coverage.js';

function callOrFallback(fn, fallback, ...args) {
    return typeof fn === 'function' ? fn(...args) : fallback;
}

function getClockNow(deps = {}) {
    return typeof deps.now === 'function' ? deps.now() : Date.now();
}

function getDefaultCoveragePlan(cached = {}) {
    return {
        storyShape: cached.brief?.creatorCoverage?.storyShape || '',
        storyDensity: cached.brief?.creatorCoverage?.storyDensity || '',
        scopeKind: cached.brief?.creatorCoverage?.scopeKind || '',
        dimensions: [],
    };
}

function getCoverageStatusToastMessage(status = '', options = {}) {
    if (options.toastMessage) return options.toastMessage;
    if (status === 'not_applicable') return 'Coverage row marked not applicable.';
    if (status === 'intentionally_light') return 'Coverage row marked intentionally light.';
    return 'Coverage row updated.';
}

export function getLoredeckCreatorCoverageReopenStatus(dimension = {}) {
    if (Number(dimension.acceptedEntryCount || 0)) return 'adequate';
    if (
        Number(dimension.titleCount || 0)
        || Number(dimension.approvedTitleCount || 0)
        || Number(dimension.pendingEntryCount || 0)
        || Number(dimension.draftEntryCount || 0)
    ) {
        return 'thin';
    }
    return 'missing';
}

export function createLoredeckCreatorCoverageActionsController(deps = {}) {
    const getCurrentJob = () => callOrFallback(deps.getCurrentJob, {}, {}) || {};
    const getGeneratedPackDefinition = packId => callOrFallback(deps.getGeneratedPackDefinition, null, packId);
    const getCoverageModel = (cached, generatedPack) => callOrFallback(deps.getCoverageModel, {}, cached, generatedPack) || {};
    const setCurrentJob = (job, options = {}) => callOrFallback(deps.setCurrentJob, job, job, options);
    const refreshPanelBody = options => callOrFallback(deps.refreshPanelBody, null, options);
    const toast = (message, tone) => callOrFallback(deps.toast, null, message, tone);

    function setDimensionStatus(dimension = {}, status = '', options = {}) {
        const normalizedStatus = normalizeLoredeckCreatorCoverageStatus(status, '');
        const dimensionId = normalizeLoredeckCreatorCoverageId(dimension.id || dimension.label || '');
        if (!dimensionId || !normalizedStatus) return false;
        const cached = getCurrentJob();
        const plan = getLoredeckCreatorCoveragePlan(cached) || getDefaultCoveragePlan(cached);
        const dimensions = [...(plan.dimensions || [])];
        const existingIndex = dimensions.findIndex(row => row.id === dimensionId);
        const reasonOverride = Object.prototype.hasOwnProperty.call(options || {}, 'notApplicableReason')
            ? String(options.notApplicableReason || '').trim()
            : null;
        const notApplicableReason = reasonOverride !== null
            ? reasonOverride
            : (normalizedStatus === 'not_applicable'
                ? 'User marked this coverage surface as not applicable.'
                : (normalizedStatus === 'intentionally_light'
                    ? 'User accepted this coverage surface as intentionally light.'
                    : ''));
        const now = getClockNow(deps);
        const nextDimension = {
            ...(existingIndex >= 0 ? dimensions[existingIndex] : {}),
            ...dimension,
            id: dimensionId,
            status: normalizedStatus,
            notApplicableReason,
        };
        if (options.acknowledged === false) delete nextDimension.acknowledgedAt;
        else nextDimension.acknowledgedAt = now;
        if (existingIndex >= 0) dimensions[existingIndex] = nextDimension;
        else dimensions.push(nextDimension);
        setCurrentJob({
            ...cached,
            creatorCoverage: {
                ...plan,
                status: '',
                dimensions,
                updatedAt: now,
            },
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(getCoverageStatusToastMessage(normalizedStatus, options), 'success');
        return true;
    }

    function reopenDimension(dimension = {}) {
        const dimensionId = normalizeLoredeckCreatorCoverageId(dimension.id || dimension.label || '');
        if (!dimensionId) return false;
        const cached = getCurrentJob();
        const generatedPack = cached.generatedPackId ? getGeneratedPackDefinition(cached.generatedPackId) : null;
        const coverage = getCoverageModel(cached, generatedPack);
        const current = (coverage.dimensions || []).find(row => row.id === dimensionId) || dimension;
        return setDimensionStatus({
            ...current,
            notApplicableReason: '',
        }, getLoredeckCreatorCoverageReopenStatus(current), {
            acknowledged: false,
            notApplicableReason: '',
            toastMessage: 'Coverage row reopened for expansion.',
        });
    }

    return {
        setDimensionStatus,
        reopenDimension,
    };
}
