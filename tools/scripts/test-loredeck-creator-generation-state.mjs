import assert from 'node:assert/strict';
import {
  attachLoredeckCreatorLiveGeneration,
  deleteLoredeckCreatorGenerationController,
  forgetLoredeckCreatorLiveGeneration,
  getAnyActiveLoredeckCreatorLiveGeneration,
  getLoredeckCreatorActiveGenerationByJobIdMap,
  getLoredeckCreatorGenerationController,
  getLoredeckCreatorGenerationJobId,
  getLoredeckCreatorJobId,
  getLoredeckCreatorLiveGenerationForJob,
  hasLoredeckCreatorGenerationController,
  isLoredeckCreatorActiveGenerationStillLive,
  rememberLoredeckCreatorLiveGeneration,
  setLoredeckCreatorGenerationController,
} from '../../src/loredecks/loredeck-creator-generation-state.js';

assert.equal(getLoredeckCreatorJobId({ jobId: 'job-a' }), 'job-a', 'Generation state should read the canonical jobId.');
assert.equal(getLoredeckCreatorJobId({ id: 'job-b' }), 'job-b', 'Generation state should fall back to id for job references.');

const controller = { signal: { aborted: false }, abort() {} };
assert.equal(setLoredeckCreatorGenerationController('generation-a', controller), controller, 'Controller registration should return the registered controller.');
assert.equal(getLoredeckCreatorGenerationController('generation-a'), controller, 'Controller lookup should return the registered controller.');
assert.equal(hasLoredeckCreatorGenerationController('generation-a'), true, 'Controller presence should be queryable by id.');
assert.equal(hasLoredeckCreatorGenerationController({ id: 'generation-a' }), true, 'Controller presence should be queryable by generation object.');

const generation = {
  id: 'generation-a',
  status: 'running',
  abortable: true,
};
const live = rememberLoredeckCreatorLiveGeneration('job-a', generation);
assert.deepEqual(live, { ...generation, jobId: 'job-a' }, 'Live generation registration should attach the owning jobId.');
assert.equal(getLoredeckCreatorGenerationJobId(generation), 'job-a', 'Generation lookup should resolve the remembered jobId.');
assert.equal(getLoredeckCreatorLiveGenerationForJob('job-a'), live, 'Live generation lookup should return running jobs.');
assert.equal(getLoredeckCreatorActiveGenerationByJobIdMap().get('job-a'), live, 'Active generation map should expose running jobs by jobId.');
assert.equal(getAnyActiveLoredeckCreatorLiveGeneration(), live, 'Any-active lookup should return a running live generation.');
assert.deepEqual(
  attachLoredeckCreatorLiveGeneration({ jobId: 'job-a', status: 'draft' }),
  { jobId: 'job-a', status: 'running', activeGeneration: live },
  'Job attachment should overlay the live generation and running status.',
);
assert.equal(
  isLoredeckCreatorActiveGenerationStillLive({ jobId: 'job-a', activeGeneration: live }),
  true,
  'Controller-backed live generations should still be treated as active.',
);

assert.equal(deleteLoredeckCreatorGenerationController('generation-a'), true, 'Controller deletion should report removed controllers.');
assert.equal(hasLoredeckCreatorGenerationController('generation-a'), false, 'Controller deletion should clear presence.');
assert.equal(
  isLoredeckCreatorActiveGenerationStillLive({ jobId: 'job-a', activeGeneration: live }),
  false,
  'Abortable live generations without a controller should not be treated as active.',
);

const nonAbortable = rememberLoredeckCreatorLiveGeneration('job-b', {
  id: 'generation-b',
  status: 'running',
  abortable: false,
});
assert.equal(
  isLoredeckCreatorActiveGenerationStillLive({ jobId: 'job-b', activeGeneration: nonAbortable }),
  true,
  'Non-abortable live generations should stay active even without a controller.',
);

forgetLoredeckCreatorLiveGeneration(live);
assert.equal(getLoredeckCreatorLiveGenerationForJob('job-a'), null, 'Forgetting by generation should remove the live job entry.');
assert.equal(getLoredeckCreatorGenerationJobId(generation), '', 'Forgetting by generation should remove the reverse job lookup.');
forgetLoredeckCreatorLiveGeneration({ jobId: 'job-b' });
assert.equal(getLoredeckCreatorLiveGenerationForJob('job-b'), null, 'Forgetting by job reference should remove the live job entry.');

console.log('Deck Maker generation state tests passed.');
