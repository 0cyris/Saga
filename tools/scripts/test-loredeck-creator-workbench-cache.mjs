import assert from 'node:assert/strict';
import {
  createLoredeckCreatorWorkbenchCacheController,
} from '../../src/loredecks/loredeck-creator-workbench-cache.js';

{
  const cache = new Map();
  const controller = createLoredeckCreatorWorkbenchCacheController({ cache });

  assert.deepEqual(controller.getCurrentJobLocal(), {});
  assert.deepEqual(controller.setEntry(' custom ', { value: 1 }), { value: 1 });
  assert.deepEqual(controller.getEntry('custom'), { value: 1 });
  assert.equal(controller.deleteEntry(' custom '), true);
  assert.equal(controller.getEntry('custom'), undefined);

  assert.deepEqual(controller.setCurrentJobLocal({ jobId: 'creator-one' }), { jobId: 'creator-one' });
  assert.deepEqual(controller.getCurrentJobLocal(), { jobId: 'creator-one' });
  assert.equal(controller.deleteCurrentJob(), true);
  assert.deepEqual(controller.getCurrentJobLocal(), {});
}

{
  const calls = {
    aborted: [],
    deletedControllers: [],
    forgotten: [],
    stopped: 0,
    clearedDrafts: 0,
    refreshed: [],
  };
  const controller = createLoredeckCreatorWorkbenchCacheController({
    getActiveGeneration: job => job.activeGeneration,
    getGenerationController: generationId => ({
      abort: () => calls.aborted.push(generationId),
    }),
    deleteGenerationController: generationId => calls.deletedControllers.push(generationId),
    forgetLiveGeneration: generation => calls.forgotten.push(generation),
    stopGenerationTicker: () => {
      calls.stopped += 1;
    },
    clearDraftInputs: () => {
      calls.clearedDrafts += 1;
    },
    refreshWorkbenchBody: options => calls.refreshed.push(options),
  });

  controller.setCurrentJobLocal({
    jobId: 'creator-one',
    activeGeneration: { id: 'generation-one', status: 'running' },
  });

  assert.equal(controller.clearCurrentCache(), true);
  assert.deepEqual(calls.aborted, ['generation-one']);
  assert.deepEqual(calls.deletedControllers, ['generation-one']);
  assert.deepEqual(calls.forgotten, [{ id: 'generation-one', status: 'running' }]);
  assert.equal(calls.stopped, 1);
  assert.equal(calls.clearedDrafts, 1);
  assert.deepEqual(calls.refreshed, [{ preserveScroll: false }]);
  assert.deepEqual(controller.getCurrentJobLocal(), {});

  controller.setCurrentJobLocal({ jobId: 'creator-two' });
  assert.equal(controller.clearCurrentCache({ refresh: false }), true);
  assert.equal(calls.clearedDrafts, 2);
  assert.deepEqual(calls.refreshed, [{ preserveScroll: false }]);
}

{
  const cleared = [];
  const controller = createLoredeckCreatorWorkbenchCacheController({
    clearDraftInputs: () => cleared.push('drafts'),
    refreshWorkbenchBody: options => cleared.push({ refresh: options }),
    getJobGeneratedPackId: job => job.generatedPackId || job.brief?.packId || '',
  });

  controller.setCurrentJobLocal({ jobId: 'creator-one', generatedPackId: 'generated-one' });
  assert.equal(controller.clearCurrentCacheForRemovedJobs(['creator-two'], 'generated-two'), false);
  assert.deepEqual(controller.getCurrentJobLocal().jobId, 'creator-one');
  assert.equal(controller.clearCurrentCacheForRemovedJobs('creator-one', ''), true);
  assert.deepEqual(cleared, ['drafts', { refresh: { preserveScroll: false } }]);
  assert.deepEqual(controller.getCurrentJobLocal(), {});

  controller.setCurrentJobLocal({ jobId: 'creator-three', brief: { packId: 'generated-three' } });
  assert.equal(controller.clearCurrentCacheForRemovedJobs([], ' generated-three ', { refresh: false }), true);
  assert.deepEqual(cleared, ['drafts', { refresh: { preserveScroll: false } }, 'drafts']);
  assert.deepEqual(controller.getCurrentJobLocal(), {});
}

console.log('Deck Maker workbench cache controller tests passed.');
