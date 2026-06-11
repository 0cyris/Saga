import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorCoverageFinalizationProvenance,
  buildLoredeckCreatorCoverageModel,
  buildLoredeckCreatorCoverageTitleBatch,
  formatLoredeckCreatorCoverageStatus,
  getLoredeckCreatorCoveragePlan,
  mergeLoredeckCreatorCoveragePlans,
  normalizeLoredeckCreatorCoverageId,
  normalizeLoredeckCreatorCoverageIdList,
  normalizeLoredeckCreatorCoverageStatus,
} from '../../src/loredecks/loredeck-creator-coverage.js';

function evidence(rows = {}) {
  return new Map(Object.entries(rows));
}

assert.equal(normalizeLoredeckCreatorCoverageStatus('N/A'), 'not_applicable');
assert.equal(normalizeLoredeckCreatorCoverageStatus('Sparse'), 'intentionally_light');
assert.equal(formatLoredeckCreatorCoverageStatus('weak'), 'Thin');
assert.equal(normalizeLoredeckCreatorCoverageId('Character Pressure!'), 'character-pressure');
assert.deepEqual(normalizeLoredeckCreatorCoverageIdList(['Magic', 'magic', 'Places'], 5), ['magic', 'places']);

const merged = mergeLoredeckCreatorCoveragePlans({
  storyShape: 'single arc',
  storyDensity: 'dense',
  dimensions: [
    {
      id: 'character-pressure',
      label: 'Character pressure',
      status: 'missing',
      priority: 90,
      evidenceTargets: ['Nami secrecy'],
    },
  ],
}, {
  storyDensity: 'dense',
  dimensions: [
    {
      id: 'character-pressure',
      label: 'Character pressure',
      status: 'thin',
      priority: 95,
      titleBatchIds: ['characters-pressure'],
    },
  ],
});

assert.equal(merged.dimensions[0].status, 'thin');
assert.equal(merged.dimensions[0].priority, 95);
assert.equal(merged.dimensions[0].evidenceTargets[0], 'Nami secrecy');
assert.equal(merged.dimensions[0].titleBatchIds[0], 'characters-pressure');

const sparseJob = {
  approved: true,
  brief: {
    creatorCoverage: {
      storyShape: 'game-rule slice',
      storyDensity: 'sparse',
      scopeKind: 'game',
      status: 'intentionally_light',
      dimensions: [
        {
          id: 'maze-rules',
          label: 'Maze rules',
          status: 'intentionally_light',
          priority: 40,
          rationale: 'Pac-Man has a small rules surface.',
        },
        {
          id: 'relationship-states',
          label: 'Relationship states',
          status: 'not_applicable',
          priority: 5,
          notApplicableReason: 'No meaningful relationship continuity exists.',
        },
      ],
    },
  },
};

const sparse = buildLoredeckCreatorCoverageModel(sparseJob, evidence());
assert.equal(sparse.available, true);
assert.equal(sparse.status, 'intentionally_light');
assert.equal(sparse.applicableDimensionCount, 0);
assert.equal(sparse.finalizeAcknowledgementRequired, false);
assert.equal(sparse.intentionallyLightCount, 1);
assert.equal(sparse.notApplicableCount, 1);

const denseJob = {
  approved: true,
  brief: {
    creatorCoverage: {
      storyShape: 'single arc',
      storyDensity: 'dense',
      scopeKind: 'arc',
      status: 'thin',
      expectedCoverage: 'Dense enough for arc roleplay without a fixed entry threshold.',
      dimensions: [
        {
          id: 'character-pressure',
          label: 'Character pressure',
          kind: 'characters',
          status: 'missing',
          priority: 90,
          rationale: 'Nami, Arlong, villagers, and crew commitment carry the arc.',
          evidenceTargets: ['Nami secrecy', 'Arlong coercion'],
        },
        {
          id: 'setting-pressure',
          label: 'Setting pressure',
          kind: 'locations',
          status: 'thin',
          priority: 70,
          rationale: 'Cocoyasi Village occupation needs playable state.',
          titleBatchIds: ['places-pressure'],
        },
      ],
    },
  },
};

const denseThin = buildLoredeckCreatorCoverageModel(denseJob, evidence({
  'setting-pressure': { titleCount: 2, approvedTitleCount: 1 },
}));

assert.equal(denseThin.status, 'missing');
assert.equal(denseThin.missingDimensionCount, 1);
assert.equal(denseThin.thinDimensionCount, 1);
assert.deepEqual(denseThin.missingDimensionIds, ['character-pressure']);
assert.deepEqual(denseThin.thinDimensionIds, ['setting-pressure']);
assert.equal(denseThin.finalizeAcknowledgementRequired, true);
assert.ok(denseThin.finalizationSignature.includes('character-pressure:missing'));
assert.ok(denseThin.finalizationSignature.includes('setting-pressure:thin'));
assert.ok(denseThin.warnings.some(warning => warning.includes('Character pressure')));

const targetBatch = buildLoredeckCreatorCoverageTitleBatch(denseThin.dimensions[0]);
assert.equal(targetBatch.id, 'coverage-character-pressure');
assert.equal(targetBatch.coverageDimensionIds[0], 'character-pressure');
assert.equal(targetBatch.coverageTarget.status, 'missing');

const acknowledgedJob = {
  ...denseJob,
  coverageFinalizeAcknowledgement: {
    mode: 'finalize_anyway',
    acknowledgedAt: 12345,
    coverageSignature: denseThin.finalizationSignature,
  },
};
const acknowledged = buildLoredeckCreatorCoverageModel(acknowledgedJob, evidence({
  'setting-pressure': { titleCount: 2, approvedTitleCount: 1 },
}));
assert.equal(acknowledged.finalizeAcknowledged, true);
assert.equal(acknowledged.finalizeAcknowledgementRequired, false);

const provenance = buildLoredeckCreatorCoverageFinalizationProvenance(acknowledged);
assert.equal(provenance.acknowledged, true);
assert.equal(provenance.acknowledgementMode, 'finalize_anyway');
assert.deepEqual(provenance.missingDimensionIds, ['character-pressure']);
assert.deepEqual(provenance.thinDimensionIds, ['setting-pressure']);

const staleAcknowledgement = buildLoredeckCreatorCoverageModel(acknowledgedJob, evidence({
  'setting-pressure': { titleCount: 3, approvedTitleCount: 1 },
}));
assert.equal(staleAcknowledgement.finalizeAcknowledged, false);
assert.equal(staleAcknowledgement.finalizeAcknowledgementRequired, true);

const denseAccepted = buildLoredeckCreatorCoverageModel(denseJob, evidence({
  'character-pressure': { acceptedEntryCount: 4 },
  'setting-pressure': { acceptedEntryCount: 3 },
}));
assert.equal(denseAccepted.status, 'adequate');
assert.equal(denseAccepted.missingDimensionCount, 0);
assert.equal(denseAccepted.thinDimensionCount, 0);
assert.equal(denseAccepted.finalizeAcknowledgementRequired, false);

const noPlan = buildLoredeckCreatorCoverageModel({ approved: true }, evidence());
assert.equal(noPlan.available, false);
assert.equal(noPlan.finalizeAcknowledgementRequired, true);
assert.equal(noPlan.finalizeAcknowledged, false);
assert.equal(noPlan.finalizationSignature, 'no-coverage-plan:approved');
assert.equal(noPlan.warnings.length, 1);

const noPlanAcknowledged = buildLoredeckCreatorCoverageModel({
  approved: true,
  coverageFinalizeAcknowledgement: {
    mode: 'finalize_anyway',
    acknowledgedAt: 333,
    coverageSignature: noPlan.finalizationSignature,
  },
}, evidence());
assert.equal(noPlanAcknowledged.available, false);
assert.equal(noPlanAcknowledged.finalizeAcknowledged, true);
assert.equal(noPlanAcknowledged.finalizeAcknowledgementRequired, false);
const noPlanProvenance = buildLoredeckCreatorCoverageFinalizationProvenance(noPlanAcknowledged);
assert.equal(noPlanProvenance.noCoveragePlan, true);
assert.equal(noPlanProvenance.acknowledged, true);
assert.equal(noPlanProvenance.acknowledgementMode, 'finalize_anyway');

const planFromJob = getLoredeckCreatorCoveragePlan(denseJob);
assert.equal(planFromJob.storyDensity, 'dense');
assert.equal(planFromJob.dimensions.length, 2);

console.log('Loredeck Creator coverage model tests passed.');
