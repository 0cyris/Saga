import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorCoverageFinalizeAcknowledgement,
  buildLoredeckCreatorCoverageFinalizeConfirmation,
  createLoredeckCreatorCoverageFinalizationController,
} from '../../src/loredecks/loredeck-creator-finalization.js';

function makeThinCoverage(overrides = {}) {
  return {
    available: true,
    status: 'thin',
    statusLabel: 'Thin',
    finalizeAcknowledgementRequired: true,
    finalizeAcknowledged: false,
    finalizationSignature: 'character-pressure:missing|setting-pressure:thin',
    missingDimensionCount: 1,
    thinDimensionCount: 1,
    missingDimensionIds: ['Character Pressure'],
    thinDimensionIds: ['setting-pressure'],
    dimensions: [
      {
        id: 'character-pressure',
        label: 'Character pressure',
        applicable: true,
        derivedStatus: 'missing',
        statusLabel: 'Missing',
      },
      {
        id: 'setting-pressure',
        label: 'Setting pressure',
        applicable: true,
        derivedStatus: 'thin',
        statusLabel: 'Thin',
      },
      {
        id: 'resolved-row',
        label: 'Resolved row',
        applicable: true,
        derivedStatus: 'adequate',
        statusLabel: 'Adequate',
      },
    ],
    ...overrides,
  };
}

const confirmation = buildLoredeckCreatorCoverageFinalizeConfirmation(makeThinCoverage());
assert.equal(confirmation.title, 'Finalize Anyway with light coverage?');
assert.ok(confirmation.message.includes('Deck Maker Coverage still has missing or thin rows:'));
assert.ok(confirmation.message.includes('- Character pressure: Missing'));
assert.ok(confirmation.message.includes('- Setting pressure: Thin'));
assert.ok(!confirmation.message.includes('Resolved row'), 'Only unresolved targetable coverage rows should appear in the confirmation.');

const acknowledgement = buildLoredeckCreatorCoverageFinalizeAcknowledgement(makeThinCoverage(), 1234);
assert.equal(acknowledgement.mode, 'finalize_anyway');
assert.equal(acknowledgement.acknowledgedAt, 1234);
assert.equal(acknowledgement.coverageSignature, 'character-pressure:missing|setting-pressure:thin');
assert.deepEqual(acknowledgement.missingDimensionIds, ['character-pressure']);
assert.deepEqual(acknowledgement.thinDimensionIds, ['setting-pressure']);

{
  const toasts = [];
  const controller = createLoredeckCreatorCoverageFinalizationController({
    getCurrentJob: () => ({ jobId: 'creator-draft' }),
    getCoverageModel: () => ({ available: false, finalizeAcknowledgementRequired: false }),
    toast: (message, tone) => toasts.push({ message, tone }),
  });
  assert.equal(await controller.acknowledgeCoverageForFinalize(), false);
  assert.deepEqual(toasts.at(-1), {
    message: 'Deck Maker Coverage is not available for this job yet.',
    tone: 'warning',
  });
}

{
  const toasts = [];
  let confirmCount = 0;
  let setCount = 0;
  const controller = createLoredeckCreatorCoverageFinalizationController({
    getCurrentJob: () => ({ jobId: 'creator-current' }),
    getCoverageModel: () => ({ available: true, finalizeAcknowledgementRequired: false, finalizeAcknowledged: true }),
    confirmAction: async () => { confirmCount += 1; return true; },
    setCurrentJob: () => { setCount += 1; },
    toast: (message, tone) => toasts.push({ message, tone }),
  });
  assert.equal(await controller.acknowledgeCoverageForFinalize(), false);
  assert.equal(confirmCount, 0, 'Already-current coverage acknowledgement should not ask for confirmation.');
  assert.equal(setCount, 0, 'Already-current coverage acknowledgement should not mutate the job.');
  assert.deepEqual(toasts.at(-1), {
    message: 'Deck Maker Coverage finalization acknowledgement is already current.',
    tone: 'info',
  });
}

{
  const confirms = [];
  let setCount = 0;
  const controller = createLoredeckCreatorCoverageFinalizationController({
    getCurrentJob: () => ({ jobId: 'creator-cancelled', brief: { fandom: 'Naruto' }, generatedPackId: 'naruto-generated' }),
    getGeneratedPackDefinition: packId => ({ packId }),
    getCoverageModel: (_job, pack) => makeThinCoverage({ packId: pack.packId }),
    confirmAction: async (title, message) => {
      confirms.push({ title, message });
      return false;
    },
    setCurrentJob: () => { setCount += 1; },
  });
  assert.equal(await controller.acknowledgeCoverageForFinalize(), false);
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].title, 'Finalize Anyway with light coverage?');
  assert.equal(setCount, 0, 'Cancelled acknowledgement should not persist anything.');
}

{
  let job = {
    jobId: 'creator-ack',
    brief: { fandom: 'One Piece' },
    generatedPackId: 'one-piece-generated',
    activeGeneration: { id: 'generation-a', status: 'running' },
    currentStage: 'entries_drafting',
  };
  const confirms = [];
  const refreshes = [];
  const toasts = [];
  const controller = createLoredeckCreatorCoverageFinalizationController({
    getCurrentJob: () => job,
    getGeneratedPackDefinition: packId => ({ packId, title: 'Generated Pack' }),
    getCoverageModel: () => makeThinCoverage(),
    setCurrentJob: next => {
      job = { ...next };
      return job;
    },
    inferUiStage: next => (next.activeGeneration ? 'running' : 'entries_drafted'),
    refreshPanelBody: options => refreshes.push({ surface: 'runtime', options }),
    refreshWorkbenchBody: options => refreshes.push({ surface: 'workbench', options }),
    confirmAction: async (title, message) => {
      confirms.push({ title, message });
      return true;
    },
    toast: (message, tone) => toasts.push({ message, tone }),
    now: () => 5000,
  });
  assert.equal(await controller.acknowledgeCoverageForFinalize(), true);
  assert.equal(confirms.length, 1);
  assert.equal(job.activeGeneration, null);
  assert.equal(job.status, 'draft');
  assert.equal(job.currentStage, 'entries_drafted');
  assert.equal(job.coverageFinalizeAcknowledgement.acknowledgedAt, 5000);
  assert.equal(job.coverageFinalizeAcknowledgement.status, 'thin');
  assert.deepEqual(job.coverageFinalizeAcknowledgement.missingDimensionIds, ['character-pressure']);
  assert.deepEqual(job.coverageFinalizeAcknowledgement.thinDimensionIds, ['setting-pressure']);
  assert.ok(refreshes.some(refresh => refresh.surface === 'runtime' && refresh.options.preserveWindowScroll));
  assert.ok(refreshes.some(refresh => refresh.surface === 'workbench' && refresh.options.preserveScroll));
  assert.deepEqual(toasts.at(-1), {
    message: 'Deck Maker Coverage acknowledged for finalization.',
    tone: 'success',
  });
}

{
  const localUpdates = [];
  const warnings = [];
  const controller = createLoredeckCreatorCoverageFinalizationController({
    getCurrentJob: () => ({ jobId: 'creator-fallback', approved: true }),
    getCoverageModel: () => ({
      available: false,
      status: 'missing',
      finalizeAcknowledgementRequired: true,
      finalizationSignature: 'no-coverage-plan:approved',
    }),
    setCurrentJob: next => ({ ...next, coverageFinalizeAcknowledgement: null }),
    updateCreatorProject: (jobId, patch, options) => ({
      ok: true,
      job: { jobId, ...patch, fallbackPersisted: options.syncLocal },
    }),
    setCurrentJobLocal: job => localUpdates.push(job),
    confirmAction: async (title, message) => {
      assert.equal(title, 'Finalize Anyway without Deck Maker Coverage?');
      assert.ok(message.includes('no adaptive coverage plan'));
      return true;
    },
    warn: (message, error) => warnings.push({ message, error }),
    now: () => 7000,
  });
  assert.equal(await controller.acknowledgeCoverageForFinalize(), true);
  assert.equal(warnings.length, 0);
  assert.equal(localUpdates.length, 1, 'Fallback persistence should refresh the local current job cache.');
  assert.equal(localUpdates[0].coverageFinalizeAcknowledgement.coverageSignature, 'no-coverage-plan:approved');
  assert.equal(localUpdates[0].coverageFinalizeAcknowledgement.note, 'User chose to finalize without an adaptive coverage plan.');
  assert.equal(localUpdates[0].fallbackPersisted, true);
}

console.log('Deck Maker finalization controller tests passed.');
