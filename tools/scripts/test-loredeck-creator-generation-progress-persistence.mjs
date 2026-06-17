import assert from 'node:assert/strict';
import {
  createLoredeckCreatorGenerationProgressController,
  isLoredeckCreatorAbortError,
} from '../../src/loredecks/loredeck-creator-generation-progress.js';
import {
  deleteLoredeckCreatorGenerationController,
  forgetLoredeckCreatorLiveGeneration,
  setLoredeckCreatorGenerationController,
} from '../../src/loredecks/loredeck-creator-generation-state.js';

const jobId = 'progress-persistence-job';
const generationId = 'progress-persistence-generation';
let now = 1000;
let currentJob = {
  jobId,
  currentStage: 'titles_drafting',
  status: 'running',
  activeGeneration: {
    id: generationId,
    jobId,
    actionId: 'title_batch',
    label: 'Title Batch',
    status: 'running',
    phase: 'starting',
    message: 'Starting',
    currentStage: 'titles_drafting',
    startedAt: 1000,
    updatedAt: 1000,
    receivedChars: 0,
  },
};
let intervalCallback = null;
let intervalMs = 0;
const clearedIntervals = [];
const localWrites = [];
const persistedWrites = [];
const statusRefreshes = [];
let workbenchRefreshCount = 0;

const progress = createLoredeckCreatorGenerationProgressController({
  getCurrentJob: () => currentJob,
  setCurrentJobLocal(job) {
    currentJob = job;
    localWrites.push(job);
  },
  setCurrentJob(job, options = {}) {
    currentJob = job;
    persistedWrites.push({ job, options });
    return job;
  },
  queueWorkbenchRefresh() {
    workbenchRefreshCount += 1;
  },
  refreshGenerationStatusUi(generationIdToRefresh) {
    statusRefreshes.push(generationIdToRefresh);
  },
  getGenerationWaitMessage(active) {
    return `Waiting on ${active.label}`;
  },
  setInterval(callback, ms) {
    intervalCallback = callback;
    intervalMs = ms;
    return 'progress-ticker';
  },
  clearInterval(intervalId) {
    clearedIntervals.push(intervalId);
  },
  now: () => now,
});

assert.equal(isLoredeckCreatorAbortError({ name: 'AbortError', message: 'aborted' }), true, 'AbortError-shaped exceptions should be treated as cancellations.');
assert.equal(isLoredeckCreatorAbortError(new Error('request cancelled by user')), true, 'Cancelled provider errors should be treated as cancellations.');
assert.equal(isLoredeckCreatorAbortError(new Error('provider failed')), false, 'Ordinary provider failures should not be treated as cancellations.');

assert.equal(progress.getActiveGeneration(currentJob)?.id, generationId, 'The progress controller should resolve the active generation from the current job.');

const localJob = progress.updateActiveGenerationLocal(generationId, {
  phase: 'waiting',
  updatedAt: 1100,
}, { liveStatusOnly: true });
assert.equal(localJob.activeGeneration.phase, 'waiting');
assert.equal(localWrites.length, 1, 'Local progress updates should refresh the in-memory Deck Maker job.');
assert.equal(persistedWrites.length, 0, 'Local progress updates must not persist the Deck Maker project payload.');
assert.deepEqual(statusRefreshes, [generationId], 'Local live-status updates should repaint the generation status UI.');
assert.equal(workbenchRefreshCount, 0, 'Live-status-only updates should not rerender the full workbench.');

progress.startTicker(generationId);
assert.equal(intervalMs, 1000, 'The elapsed-time ticker should run once per second.');
now = 2600;
intervalCallback();
assert.equal(currentJob.activeGeneration.elapsedMs, 1600, 'The elapsed-time ticker should compute elapsed time from the active generation start.');
assert.equal(currentJob.activeGeneration.message, 'Waiting on Title Batch', 'The elapsed-time ticker should refresh wait copy locally.');
assert.equal(persistedWrites.length, 0, 'The elapsed-time ticker must not persist a project write every second.');
assert.equal(statusRefreshes.at(-1), generationId, 'The elapsed-time ticker should repaint live generation status.');

progress.updateGeneration({ id: generationId }, {
  type: 'stream_start',
  phase: 'receiving',
  accumulated: 'visible model output',
  receivedChars: 20,
}, {});
assert.equal(persistedWrites.length, 1, 'Persistable progress events should still route through the project cache helper.');
assert.equal(persistedWrites[0].options.coalesceStorageWrite, true, 'Persistable progress events should coalesce storage writes.');

const persistedBeforeReasoning = persistedWrites.length;
progress.updateGeneration({ id: generationId }, {
  type: 'reasoning',
  phase: 'receiving',
  accumulated: '',
  receivedChars: 0,
}, { persist: false });
assert.equal(persistedWrites.length, persistedBeforeReasoning, 'Reasoning-only local progress should not persist the project payload.');
assert.equal(localWrites.at(-1).activeGeneration.phase, 'receiving', 'Reasoning-only local progress should still update the visible active generation.');

const handler = progress.makeProgressHandler({ id: generationId }, {});
now = 3000;
handler({
  type: 'reasoning',
  phase: 'receiving',
  accumulated: '',
  receivedChars: 0,
});
assert.equal(persistedWrites.length, persistedBeforeReasoning, 'Progress handlers should downgrade reasoning-only events to local UI updates.');

const controllerGenerationId = 'progress-persistence-controller-current';
setLoredeckCreatorGenerationController(controllerGenerationId, { signal: {} });
assert.equal(progress.isGenerationCurrent({ id: controllerGenerationId }), true, 'Controller-backed generations should remain current.');
deleteLoredeckCreatorGenerationController(controllerGenerationId);

forgetLoredeckCreatorLiveGeneration({ id: generationId, jobId });
currentJob = {
  jobId,
  status: 'running',
  activeGeneration: { id: 'different-generation', jobId, status: 'running' },
};
const originalConsoleInfo = console.info;
const staleLogs = [];
console.info = (...args) => staleLogs.push(args.join(' '));
try {
  assert.equal(progress.ignoreStaleGeneration({ id: generationId, jobId }, 'progress persistence test'), true, 'Stale generation results should be ignored after the active generation changes.');
} finally {
  console.info = originalConsoleInfo;
}
assert.equal(staleLogs.length, 1, 'Ignoring a stale generation should leave a diagnostic log.');

progress.stopTicker();
assert.deepEqual(clearedIntervals, ['progress-ticker'], 'Stopping the progress controller should clear the elapsed-time ticker.');

console.log('Deck Maker generation progress persistence tests passed.');
