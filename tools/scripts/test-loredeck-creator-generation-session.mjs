import assert from 'node:assert/strict';
import {
  createLoredeckCreatorGenerationSessionController,
} from '../../src/loredecks/loredeck-creator-generation-session.js';

let now = 1000;
let currentJob = {
  jobId: 'creator-session-job',
  brief: { title: 'Session Test' },
  currentStage: 'titles_drafted',
  status: 'draft',
  lastAction: 'previous_action',
};
const calls = [];
const controllers = new Map();

class FakeAbortController {
  constructor() {
    this.signal = { type: 'fake-signal' };
    this.aborted = false;
  }

  abort() {
    this.aborted = true;
    calls.push(['abort']);
  }
}

const session = createLoredeckCreatorGenerationSessionController({
  getCurrentJob: () => currentJob,
  setCurrentJob(job, options = {}) {
    currentJob = job;
    calls.push(['setCurrentJob', job.status, job.activeGeneration?.id || '', options.refreshWorkbench === true]);
    return job;
  },
  setCurrentJobLocal(job) {
    currentJob = job;
    calls.push(['setCurrentJobLocal', job.activeGeneration?.id || '']);
    return job;
  },
  getGenerationSettings: () => ({ showStreamingProgress: true }),
  getActiveGeneration: job => (job?.activeGeneration?.status === 'running' ? job.activeGeneration : null),
  getAnyActiveLiveGeneration: () => null,
  inferUiStage: job => (job.brief ? 'titles_drafted' : 'intake'),
  startTicker: id => calls.push(['startTicker', id]),
  stopTicker: () => calls.push(['stopTicker']),
  queueWorkbenchRefresh: () => calls.push(['queueWorkbenchRefresh']),
  toast: (message, tone) => calls.push(['toast', tone, message]),
  setGenerationController(id, controller) {
    controllers.set(id, controller);
    calls.push(['setController', id]);
  },
  getGenerationController: id => controllers.get(id) || null,
  deleteGenerationController: id => {
    controllers.delete(id);
    calls.push(['deleteController', id]);
  },
  rememberLiveGeneration(jobId, generation) {
    const live = { ...generation, jobId, live: true };
    calls.push(['rememberLive', jobId, generation.id]);
    return live;
  },
  forgetLiveGeneration(generation) {
    calls.push(['forgetLive', generation?.id || '']);
  },
  warn: (message, error) => calls.push(['warn', message, String(error?.message || error || '')]),
  AbortController: FakeAbortController,
  now: () => now,
});

const started = session.startGeneration(
  'title_batch_draft',
  'Drafting Titles',
  { currentStage: 'titles_drafting' },
  { batchId: 'batch-a', batchIndex: 1, batchTotal: 3 },
);

assert.equal(started.blocked, undefined, 'Generation start should proceed when no active generation exists.');
assert.equal(started.generation.id, 'title_batch_draft-1000', 'Generation ids should include the action id and start time.');
assert.equal(started.generation.abortable, true, 'Generation start should mark AbortController-backed runs abortable.');
assert.equal(started.generation.batchId, 'batch-a', 'Generation start should preserve batch metadata.');
assert.equal(currentJob.status, 'running', 'Generation start should put the current Creator job into running state.');
assert.equal(currentJob.activeGeneration.id, started.generation.id, 'Generation start should cache the live active generation.');
assert.equal(currentJob.activeGeneration.live, true, 'Generation start should remember the live generation with its job id.');
assert.equal(currentJob.lastAction, 'title_batch_draft', 'Generation start should persist the triggering action.');
assert.equal(controllers.has(started.generation.id), true, 'Generation start should register the abort controller.');
assert.deepEqual(
  calls.slice(0, 5).map(call => call[0]),
  ['setController', 'setCurrentJob', 'rememberLive', 'setCurrentJobLocal', 'startTicker'],
  'Generation start should register controller, persist running job, cache live state, and start the ticker.',
);

calls.length = 0;
const blocked = session.startGeneration('entry_draft', 'Drafting Lorecards', {}, {});
assert.equal(blocked.blocked, true, 'Generation start should block when a generation is already running.');
assert.equal(blocked.generation, null, 'Blocked generation starts should not create a generation.');
assert.deepEqual(
  calls,
  [
    ['toast', 'warning', 'Drafting Titles is still running. Cancel it or wait for it to finish before starting another generation.'],
    ['queueWorkbenchRefresh'],
  ],
  'Blocked starts should tell the user and refresh the Creator workbench.',
);

calls.length = 0;
now = 5000;
const finished = session.finishGeneration(started.generation, 'success', '', { receivedChars: 99, snippet: 'done' });
assert.equal(finished.result.status, 'success', 'Finished generations should store a success result.');
assert.equal(finished.result.elapsedMs, 4000, 'Finished generation elapsed time should use the active generation start.');
assert.equal(currentJob.activeGeneration, null, 'Finished generations should clear activeGeneration.');
assert.equal(currentJob.status, 'draft', 'Successful finishes with a brief should return the job to draft status.');
assert.equal(currentJob.currentStage, 'titles_drafted', 'Finished generations should restore the inferred Creator UI stage.');
assert.equal(currentJob.lastCompletedAt, 5000, 'Successful finishes should stamp lastCompletedAt.');
assert.equal(controllers.has(started.generation.id), false, 'Finished generations should delete their controller.');
assert.deepEqual(
  calls.map(call => call[0]),
  ['stopTicker', 'deleteController', 'forgetLive', 'setCurrentJob'],
  'Finished generations should stop the ticker, clear live state, and persist the recovered job.',
);

calls.length = 0;
currentJob = {
  jobId: 'creator-session-job',
  brief: { title: 'Session Test' },
  status: 'running',
  activeGeneration: { id: 'current-generation', status: 'running', label: 'Current' },
};
const staleFinish = session.finishGeneration({ id: 'stale-generation', label: 'Stale' }, 'success');
assert.equal(staleFinish.stale, true, 'Finishing a non-current generation should be reported as stale.');
assert.deepEqual(
  calls,
  [
    ['deleteController', 'stale-generation'],
    ['forgetLive', 'stale-generation'],
  ],
  'Stale finishes should only clean up stale controller and live-generation state.',
);

calls.length = 0;
const currentController = new FakeAbortController();
controllers.set('current-generation', currentController);
now = 7000;
const cancelled = session.cancelGeneration('current-generation');
assert.equal(cancelled, true, 'Cancel should return true for the active generation.');
assert.equal(currentController.aborted, true, 'Cancel should abort the active controller.');
assert.equal(currentJob.activeGeneration, null, 'Cancel should clear activeGeneration.');
assert.equal(currentJob.lastGenerationResult.status, 'cancelled', 'Cancel should persist a cancelled generation result.');
assert.equal(currentJob.status, 'draft', 'Cancel should return a brief-backed Creator job to draft status.');
assert.equal(currentJob.currentStage, 'titles_drafted', 'Cancel should restore the inferred Creator UI stage.');
assert.equal(controllers.has('current-generation'), false, 'Cancel should delete the active controller.');
assert.deepEqual(
  calls.map(call => call[0]),
  ['abort', 'stopTicker', 'deleteController', 'forgetLive', 'setCurrentJob', 'toast'],
  'Cancel should abort, stop ticking, clear live state, persist, and notify the user.',
);
assert.equal(calls.at(-1)[2], 'Current cancelled.', 'Cancel should use the active generation label in the toast.');

calls.length = 0;
assert.equal(session.cancelGeneration('missing-generation'), false, 'Cancel should return false when the requested generation is not active.');
assert.deepEqual(calls, [], 'Failed cancel attempts should not mutate state.');

console.log('Deck Maker generation session tests passed.');
