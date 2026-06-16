const COVERAGE_STATUS_LABELS = Object.freeze({
    missing: 'Missing',
    thin: 'Thin',
    adequate: 'Adequate',
    rich: 'Rich',
    not_applicable: 'N/A',
    intentionally_light: 'Light by design',
});

export const LOREDECK_CREATOR_COVERAGE_STATUS_LABELS = COVERAGE_STATUS_LABELS;
export const LOREDECK_CREATOR_COVERAGE_APPLICABLE_STATUSES = Object.freeze(new Set(['missing', 'thin', 'adequate', 'rich']));
export const LOREDECK_CREATOR_COVERAGE_FINALIZE_BLOCKER = 'Deck Maker Coverage is unresolved. Add or expand the adaptive coverage plan, or acknowledge intentionally light/missing coverage before finalizing as Custom.';
const NO_PLAN_FINALIZATION_SIGNATURE = 'no-coverage-plan:approved';

function isPlainObjectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

function humanizeScopeKey(key) {
    return String(key || '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, c => c.toUpperCase());
}

function normalizeCreatorTitleId(value = '', fallback = '') {
    const text = String(value || fallback || '')
        .trim()
        .slice(0, 160);
    return text || String(fallback || '').trim();
}

export function normalizeLoredeckCreatorCoverageStatus(value = '', fallback = '') {
    const raw = String(value || fallback || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    const aliases = {
        n_a: 'not_applicable',
        na: 'not_applicable',
        none: 'not_applicable',
        irrelevant: 'not_applicable',
        intentional: 'intentionally_light',
        light: 'intentionally_light',
        sparse: 'intentionally_light',
        ok: 'adequate',
        good: 'adequate',
        covered: 'adequate',
        dense: 'rich',
        complete: 'rich',
        weak: 'thin',
        partial: 'thin',
        gap: 'missing',
        absent: 'missing',
    };
    const status = aliases[raw] || raw;
    return Object.prototype.hasOwnProperty.call(COVERAGE_STATUS_LABELS, status) ? status : '';
}

export function formatLoredeckCreatorCoverageStatus(value = '', fallback = 'missing') {
    const status = normalizeLoredeckCreatorCoverageStatus(value, fallback) || fallback;
    return COVERAGE_STATUS_LABELS[status] || humanizeScopeKey(status);
}

export function normalizeLoredeckCreatorCoverageId(value = '', fallback = '') {
    return normalizeCreatorTitleId(String(value || fallback || '').trim(), fallback)
        .toLowerCase()
        .replace(/[^a-z0-9_.:-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 140);
}

export function normalizeLoredeckCreatorCoverageIdList(value = [], limit = 24) {
    const source = Array.isArray(value) ? value : [];
    const ids = [];
    const seen = new Set();
    for (const raw of source) {
        const id = normalizeLoredeckCreatorCoverageId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        if (ids.length >= limit) break;
    }
    return ids;
}

export function normalizeLoredeckCreatorCoverageDimension(raw = {}, index = 0) {
    if (!isPlainObjectValue(raw)) return null;
    const label = String(raw.label || raw.title || raw.name || raw.dimension || '').trim().slice(0, 180);
    const fallback = `coverage-${index + 1}`;
    const id = normalizeLoredeckCreatorCoverageId(raw.id || raw.key || raw.dimensionId || label || fallback, fallback);
    if (!id && !label) return null;
    const status = normalizeLoredeckCreatorCoverageStatus(raw.status || raw.coverageStatus || raw.state, 'missing') || 'missing';
    return {
        id: id || fallback,
        label: label || id || fallback,
        kind: String(raw.kind || raw.type || raw.category || '').trim().slice(0, 80),
        status,
        priority: Number.isFinite(Number(raw.priority ?? raw.weight ?? raw.rank))
            ? Math.max(0, Math.min(100, Math.round(Number(raw.priority ?? raw.weight ?? raw.rank))))
            : 50,
        rationale: String(raw.rationale || raw.reason || raw.summary || raw.description || '').trim().slice(0, 700),
        evidenceTargets: Array.isArray(raw.evidenceTargets || raw.expectedEvidence || raw.examples || raw.targets)
            ? (raw.evidenceTargets || raw.expectedEvidence || raw.examples || raw.targets).map(item => String(item || '').trim()).filter(Boolean).slice(0, 8)
            : [],
        titleBatchIds: normalizeLoredeckCreatorCoverageIdList(raw.titleBatchIds || raw.titleBatches || raw.batchIds || [], 12),
        notApplicableReason: String(raw.notApplicableReason || raw.naReason || raw.exclusionReason || '').trim().slice(0, 500),
    };
}

export function normalizeLoredeckCreatorCoveragePlan(raw = {}) {
    const source = isPlainObjectValue(raw?.creatorCoverage)
        ? raw.creatorCoverage
        : (isPlainObjectValue(raw?.coveragePlan)
            ? raw.coveragePlan
            : (isPlainObjectValue(raw?.coverageMatrix)
                ? raw.coverageMatrix
                : (isPlainObjectValue(raw?.coverageReview)
                    ? raw.coverageReview
                    : (isPlainObjectValue(raw) ? raw : {}))));
    if (!isPlainObjectValue(source)) return null;
    const dimensions = (Array.isArray(source.dimensions || source.coverageDimensions || source.axes)
        ? (source.dimensions || source.coverageDimensions || source.axes)
        : [])
        .map((row, index) => normalizeLoredeckCreatorCoverageDimension(row, index))
        .filter(Boolean)
        .slice(0, 24);
    const plan = {
        storyShape: String(source.storyShape || source.shape || source.narrativeShape || '').trim().slice(0, 100),
        storyDensity: String(source.storyDensity || source.density || source.loreDensity || '').trim().slice(0, 100),
        scopeKind: String(source.scopeKind || source.scopeType || source.kind || '').trim().slice(0, 100),
        status: normalizeLoredeckCreatorCoverageStatus(source.status || source.overallStatus || source.coverageStatus, ''),
        rationale: String(source.rationale || source.reason || source.summary || '').trim().slice(0, 900),
        expectedCoverage: String(source.expectedCoverage || source.expectation || source.coverageExpectation || '').trim().slice(0, 900),
        likelyNotApplicable: Array.isArray(source.likelyNotApplicable || source.notApplicable || source.exclusions)
            ? (source.likelyNotApplicable || source.notApplicable || source.exclusions).map(item => String(item || '').trim()).filter(Boolean).slice(0, 8)
            : [],
        dimensions,
    };
    return Object.values(plan).some(value => Array.isArray(value) ? value.length : !!value) ? plan : null;
}

export function mergeLoredeckCreatorCoveragePlans(base = null, incoming = null) {
    const current = normalizeLoredeckCreatorCoveragePlan(base);
    const next = normalizeLoredeckCreatorCoveragePlan(incoming);
    if (!current) return next;
    if (!next) return current;
    const dimensions = new Map();
    for (const dimension of current.dimensions || []) dimensions.set(dimension.id, dimension);
    for (const dimension of next.dimensions || []) {
        dimensions.set(dimension.id, {
            ...(dimensions.get(dimension.id) || {}),
            ...dimension,
            evidenceTargets: dimension.evidenceTargets?.length ? dimension.evidenceTargets : (dimensions.get(dimension.id)?.evidenceTargets || []),
            titleBatchIds: dimension.titleBatchIds?.length ? dimension.titleBatchIds : (dimensions.get(dimension.id)?.titleBatchIds || []),
        });
    }
    return {
        ...current,
        ...next,
        storyShape: next.storyShape || current.storyShape,
        storyDensity: next.storyDensity || current.storyDensity,
        scopeKind: next.scopeKind || current.scopeKind,
        status: next.status || current.status,
        rationale: next.rationale || current.rationale,
        expectedCoverage: next.expectedCoverage || current.expectedCoverage,
        likelyNotApplicable: next.likelyNotApplicable?.length ? next.likelyNotApplicable : current.likelyNotApplicable,
        dimensions: [...dimensions.values()].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0)),
    };
}

export function getLoredeckCreatorCoveragePlan(cached = {}) {
    let plan = null;
    plan = mergeLoredeckCreatorCoveragePlans(plan, cached.brief?.creatorCoverage || null);
    plan = mergeLoredeckCreatorCoveragePlans(plan, cached.outline?.creatorCoverage || null);
    plan = mergeLoredeckCreatorCoveragePlans(plan, cached.creatorCoverage || null);
    return plan;
}

export function isLoredeckCreatorCoverageDimensionTargetable(dimension = {}) {
    if (!dimension?.applicable) return false;
    return ['missing', 'thin'].includes(dimension.derivedStatus || dimension.status || '');
}

export function getLoredeckCreatorCoverageFinalizationSignature(dimensions = []) {
    return (Array.isArray(dimensions) ? dimensions : [])
        .filter(dimension => isLoredeckCreatorCoverageDimensionTargetable(dimension))
        .map(dimension => [
            dimension.id || '',
            dimension.derivedStatus || dimension.status || '',
            Number(dimension.titleCount || 0),
            Number(dimension.approvedTitleCount || 0),
            Number(dimension.draftEntryCount || 0),
            Number(dimension.pendingEntryCount || 0),
            Number(dimension.acceptedEntryCount || 0),
        ].join(':'))
        .filter(Boolean)
        .sort()
        .join('|');
}

export function getLoredeckCreatorCoverageFinalizeAcknowledgement(cached = {}, signature = '') {
    const ack = isPlainObjectValue(cached?.coverageFinalizeAcknowledgement)
        ? cached.coverageFinalizeAcknowledgement
        : {};
    const acknowledgedAt = Number(ack.acknowledgedAt || 0);
    const coverageSignature = String(ack.coverageSignature || ack.signature || '').trim();
    if (!signature || !acknowledgedAt || coverageSignature !== signature) return null;
    return {
        ...ack,
        acknowledgedAt,
        coverageSignature,
    };
}

export function buildLoredeckCreatorCoverageFinalizationProvenance(coverage = {}) {
    if (!coverage?.available && !coverage?.finalizeAcknowledged) return null;
    const acknowledgement = coverage.finalizeAcknowledgement || null;
    return {
        status: coverage.status || '',
        statusLabel: coverage.statusLabel || '',
        storyShape: coverage.storyShape || '',
        storyDensity: coverage.storyDensity || '',
        scopeKind: coverage.scopeKind || '',
        noCoveragePlan: coverage.available === false,
        acknowledged: !!coverage.finalizeAcknowledged,
        acknowledgedAt: Number(acknowledgement?.acknowledgedAt || 0),
        acknowledgementMode: String(acknowledgement?.mode || '').trim(),
        missingDimensionIds: normalizeLoredeckCreatorCoverageIdList(coverage.missingDimensionIds || [], 24),
        thinDimensionIds: normalizeLoredeckCreatorCoverageIdList(coverage.thinDimensionIds || [], 24),
    };
}

function getEvidenceRecord(evidence = new Map(), dimensionId = '') {
    const empty = {
        titleCount: 0,
        selectedTitleCount: 0,
        approvedTitleCount: 0,
        pendingEntryCount: 0,
        draftEntryCount: 0,
        acceptedEntryCount: 0,
    };
    const record = evidence instanceof Map ? evidence.get(dimensionId) : evidence?.[dimensionId];
    return record ? { ...empty, ...record } : empty;
}

export function buildLoredeckCreatorCoverageModel(cached = {}, evidence = new Map()) {
    const plan = getLoredeckCreatorCoveragePlan(cached);
    if (!plan) {
        const finalizationSignature = cached.approved ? NO_PLAN_FINALIZATION_SIGNATURE : '';
        const finalizeAcknowledgement = getLoredeckCreatorCoverageFinalizeAcknowledgement(cached, finalizationSignature);
        return {
            available: false,
            status: 'missing',
            statusLabel: 'No coverage plan',
            storyShape: '',
            storyDensity: '',
            scopeKind: '',
            dimensions: [],
            dimensionCount: 0,
            applicableDimensionCount: 0,
            missingDimensionCount: 0,
            thinDimensionCount: 0,
            missingDimensionIds: [],
            thinDimensionIds: [],
            finalizeAcknowledgementRequired: !!finalizationSignature && !finalizeAcknowledgement,
            finalizeAcknowledged: !!finalizeAcknowledgement,
            finalizeAcknowledgement,
            finalizationSignature,
            warnings: cached.approved ? ['Deck Maker has no adaptive coverage plan yet. Redraft the Scope Brief or Story Outline before finalizing if coverage depth matters.'] : [],
        };
    }
    const dimensions = (plan.dimensions || []).map((dimension, index) => {
        const record = getEvidenceRecord(evidence, dimension.id);
        const applicable = LOREDECK_CREATOR_COVERAGE_APPLICABLE_STATUSES.has(dimension.status);
        const derivedStatus = !applicable
            ? dimension.status
            : (record.acceptedEntryCount
                ? 'adequate'
                : (record.pendingEntryCount || record.draftEntryCount || record.approvedTitleCount || record.titleCount ? 'thin' : dimension.status || 'missing'));
        return {
            ...dimension,
            order: index + 1,
            applicable,
            derivedStatus,
            statusLabel: formatLoredeckCreatorCoverageStatus(derivedStatus),
            titleCount: record.titleCount,
            selectedTitleCount: record.selectedTitleCount,
            approvedTitleCount: record.approvedTitleCount,
            pendingEntryCount: record.pendingEntryCount,
            draftEntryCount: record.draftEntryCount,
            acceptedEntryCount: record.acceptedEntryCount,
        };
    });
    const applicable = dimensions.filter(dimension => dimension.applicable);
    const missing = applicable.filter(dimension => !dimension.titleCount && !dimension.approvedTitleCount && !dimension.pendingEntryCount && !dimension.draftEntryCount && !dimension.acceptedEntryCount);
    const thin = applicable.filter(dimension => !dimension.acceptedEntryCount
        && (dimension.titleCount || dimension.approvedTitleCount || dimension.pendingEntryCount || dimension.draftEntryCount));
    const warnings = [];
    for (const dimension of missing.slice(0, 5)) {
        warnings.push(`Coverage dimension "${dimension.label}" has no linked title drafts yet.`);
    }
    for (const dimension of applicable.filter(row => (row.status === 'missing' || row.status === 'thin') && !row.titleBatchIds.length && !row.titleCount).slice(0, 5)) {
        warnings.push(`Coverage dimension "${dimension.label}" is marked ${formatLoredeckCreatorCoverageStatus(dimension.status).toLowerCase()} but is not linked to a title set.`);
    }
    const status = applicable.length
        ? (missing.length
            ? 'missing'
            : (thin.length
                ? 'thin'
                : (plan.status && !['missing', 'thin'].includes(plan.status) ? plan.status : 'adequate')))
        : (plan.status && !['missing', 'thin'].includes(plan.status) ? plan.status : 'intentionally_light');
    const finalizationSignature = getLoredeckCreatorCoverageFinalizationSignature(dimensions);
    const finalizeAcknowledgement = getLoredeckCreatorCoverageFinalizeAcknowledgement(cached, finalizationSignature);
    const finalizeAcknowledgementRequired = !!finalizationSignature && !finalizeAcknowledgement;
    return {
        available: true,
        ...plan,
        status,
        statusLabel: formatLoredeckCreatorCoverageStatus(status),
        dimensions,
        dimensionCount: dimensions.length,
        applicableDimensionCount: applicable.length,
        missingDimensionCount: missing.length,
        thinDimensionCount: thin.length,
        missingDimensionIds: missing.map(dimension => dimension.id).filter(Boolean),
        thinDimensionIds: thin.map(dimension => dimension.id).filter(Boolean),
        intentionallyLightCount: dimensions.filter(dimension => dimension.status === 'intentionally_light').length,
        notApplicableCount: dimensions.filter(dimension => dimension.status === 'not_applicable').length,
        finalizeAcknowledgementRequired,
        finalizeAcknowledged: !!finalizeAcknowledgement,
        finalizeAcknowledgement,
        finalizationSignature,
        warnings,
    };
}

export function buildLoredeckCreatorCoverageTitleBatch(dimension = {}) {
    const id = normalizeCreatorTitleId(`coverage-${dimension.id || dimension.label || 'gap'}`, 'coverage-gap');
    const label = `Coverage: ${dimension.label || dimension.id || 'Gap'}`;
    const targetText = [
        dimension.rationale || '',
        ...(Array.isArray(dimension.evidenceTargets) ? dimension.evidenceTargets : []),
    ].filter(Boolean);
    return {
        id,
        label,
        type: 'coverage_gap',
        order: 9000 + Number(dimension.order || 0),
        summary: dimension.rationale || `Targeted title batch for ${dimension.label || dimension.id || 'this coverage dimension'}.`,
        contextRole: `Expand ${dimension.label || dimension.id || 'coverage'} without padding unrelated lore.`,
        titleTargets: targetText.slice(0, 8),
        coverageDimensionIds: dimension.id ? [dimension.id] : [],
        coverageTarget: {
            id: dimension.id || '',
            label: dimension.label || '',
            status: dimension.derivedStatus || dimension.status || '',
            priority: dimension.priority || 50,
        },
    };
}
