import assert from 'node:assert/strict';
import {
  createLoredeckCreatorCoverageActionsController,
  getLoredeckCreatorCoverageReopenStatus,
} from '../../src/loredecks/loredeck-creator-coverage-actions.js';

assert.equal(getLoredeckCreatorCoverageReopenStatus({ acceptedEntryCount: 1 }), 'adequate');
assert.equal(getLoredeckCreatorCoverageReopenStatus({ titleCount: 1 }), 'thin');
assert.equal(getLoredeckCreatorCoverageReopenStatus({ approvedTitleCount: 1 }), 'thin');
assert.equal(getLoredeckCreatorCoverageReopenStatus({ pendingEntryCount: 1 }), 'thin');
assert.equal(getLoredeckCreatorCoverageReopenStatus({ draftEntryCount: 1 }), 'thin');
assert.equal(getLoredeckCreatorCoverageReopenStatus({}), 'missing');

{
  let setCount = 0;
  const controller = createLoredeckCreatorCoverageActionsController({
    setCurrentJob: () => { setCount += 1; },
  });
  assert.equal(controller.setDimensionStatus({}, 'intentionally_light'), false);
  assert.equal(controller.setDimensionStatus({ id: 'character-pressure' }, 'unknown-status'), false);
  assert.equal(controller.reopenDimension({}), false);
  assert.equal(setCount, 0, 'Invalid coverage action input should not mutate the job.');
}

{
  let job = {
    jobId: 'creator-existing',
    brief: { fandom: 'One Piece' },
    creatorCoverage: {
      storyShape: 'arc',
      storyDensity: 'dense',
      scopeKind: 'arc',
      dimensions: [
        {
          id: 'character-pressure',
          label: 'Character pressure',
          status: 'missing',
          priority: 90,
        },
      ],
    },
  };
  const refreshes = [];
  const toasts = [];
  const controller = createLoredeckCreatorCoverageActionsController({
    getCurrentJob: () => job,
    setCurrentJob: next => {
      job = { ...next };
      return job;
    },
    refreshPanelBody: options => refreshes.push(options),
    toast: (message, tone) => toasts.push({ message, tone }),
    now: () => 1000,
  });
  assert.equal(controller.setDimensionStatus({ id: 'character-pressure', label: 'Character pressure' }, 'light'), true);
  assert.equal(job.creatorCoverage.status, '');
  assert.equal(job.creatorCoverage.updatedAt, 1000);
  assert.equal(job.creatorCoverage.dimensions.length, 1);
  assert.equal(job.creatorCoverage.dimensions[0].status, 'intentionally_light');
  assert.equal(job.creatorCoverage.dimensions[0].notApplicableReason, 'User accepted this coverage surface as intentionally light.');
  assert.equal(job.creatorCoverage.dimensions[0].acknowledgedAt, 1000);
  assert.deepEqual(refreshes.at(-1), { preserveScroll: true, preserveWindowScroll: true });
  assert.deepEqual(toasts.at(-1), {
    message: 'Coverage row marked intentionally light.',
    tone: 'success',
  });
}

{
  let job = {
    jobId: 'creator-fallback-plan',
    brief: {
      creatorCoverage: {
        storyShape: 'season',
        storyDensity: 'sparse',
        scopeKind: 'episode_cluster',
      },
    },
  };
  const controller = createLoredeckCreatorCoverageActionsController({
    getCurrentJob: () => job,
    setCurrentJob: next => {
      job = { ...next };
      return job;
    },
    now: () => 2000,
  });
  assert.equal(controller.setDimensionStatus({ label: 'Side material' }, 'n/a'), true);
  assert.equal(job.creatorCoverage.storyShape, 'season');
  assert.equal(job.creatorCoverage.storyDensity, 'sparse');
  assert.equal(job.creatorCoverage.scopeKind, 'episode_cluster');
  assert.equal(job.creatorCoverage.dimensions[0].id, 'side-material');
  assert.equal(job.creatorCoverage.dimensions[0].status, 'not_applicable');
  assert.equal(job.creatorCoverage.dimensions[0].notApplicableReason, 'User marked this coverage surface as not applicable.');
}

{
  let job = {
    jobId: 'creator-reopen',
    generatedPackId: 'generated-pack',
    creatorCoverage: {
      dimensions: [{
        id: 'setting-pressure',
        label: 'Setting pressure',
        status: 'intentionally_light',
        acknowledgedAt: 111,
        notApplicableReason: 'Accepted as light.',
      }],
    },
  };
  const toasts = [];
  const packLookups = [];
  const controller = createLoredeckCreatorCoverageActionsController({
    getCurrentJob: () => job,
    getGeneratedPackDefinition: packId => {
      packLookups.push(packId);
      return { packId };
    },
    getCoverageModel: (_cached, pack) => ({
      packId: pack.packId,
      dimensions: [{
        id: 'setting-pressure',
        label: 'Setting pressure',
        status: 'intentionally_light',
        acknowledgedAt: 111,
        titleCount: 2,
        approvedTitleCount: 1,
        notApplicableReason: 'Accepted as light.',
      }],
    }),
    setCurrentJob: next => {
      job = { ...next };
      return job;
    },
    toast: (message, tone) => toasts.push({ message, tone }),
    now: () => 3000,
  });
  assert.equal(controller.reopenDimension({ id: 'setting-pressure' }), true);
  assert.deepEqual(packLookups, ['generated-pack']);
  assert.equal(job.creatorCoverage.dimensions[0].status, 'thin');
  assert.equal(job.creatorCoverage.dimensions[0].notApplicableReason, '');
  assert.equal(Object.prototype.hasOwnProperty.call(job.creatorCoverage.dimensions[0], 'acknowledgedAt'), false);
  assert.deepEqual(toasts.at(-1), {
    message: 'Coverage row reopened for expansion.',
    tone: 'success',
  });
}

console.log('Deck Maker coverage action tests passed.');
