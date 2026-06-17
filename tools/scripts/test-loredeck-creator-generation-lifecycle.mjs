import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorActiveGeneration,
  buildLoredeckCreatorActiveGenerationUpdate,
  buildLoredeckCreatorCancelledGenerationResult,
  buildLoredeckCreatorGenerationResult,
} from '../../src/loredecks/loredeck-creator-generation-lifecycle.js';

const generation = buildLoredeckCreatorActiveGeneration({
  actionId: 'title_batch',
  label: 'Title Batch',
  jobPatch: { currentStage: 'titles_drafting' },
  details: {
    runId: 'run-title',
    batchId: 'batch-a',
    batchLabel: 'Batch A',
    batchIndex: '2',
    batchTotal: '5',
    targetTitleBatchId: '',
    targetPlanningBatchId: 'planning-a',
    coverageDimensionIds: ['Character Pressure', 'Character Pressure', 'Arc Stakes'],
    targetTitleIds: ['nami', 'arlong', 'nami'],
  },
  generationSettings: { showStreamingProgress: true },
  abortable: true,
  now: 1000,
});

assert.deepEqual(
  generation,
  {
    id: 'title_batch-1000',
    actionId: 'title_batch',
    runId: 'run-title',
    label: 'Title Batch',
    status: 'running',
    phase: 'starting',
    message: 'Contacting Reasoning Provider...',
    startedAt: 1000,
    updatedAt: 1000,
    elapsedMs: 0,
    receivedChars: 0,
    snippet: '',
    streamRequested: true,
    streamSupported: null,
    abortable: true,
    stage: 'titles_drafting',
    batchId: 'batch-a',
    batchLabel: 'Batch A',
    batchIndex: 2,
    batchTotal: 5,
    targetTitleBatchId: 'batch-a',
    targetPlanningBatchId: 'planning-a',
    coverageDimensionIds: ['character-pressure', 'arc-stakes'],
    targetTitleIds: ['nami', 'arlong'],
  },
  'Active generation creation should normalize ids, stream settings, batch metadata, and timing.',
);

const updated = buildLoredeckCreatorActiveGenerationUpdate(
  generation,
  {
    phase: 'receiving',
    accumulated: `first line\n${'x'.repeat(900)}`,
    streamSupported: true,
  },
  {
    batchId: 'batch-b',
    batchIndex: 3,
    coverageDimensionIds: ['New Coverage'],
    targetTitleIds: ['usopp'],
  },
  3500,
);

assert.equal(updated.phase, 'receiving');
assert.equal(updated.elapsedMs, 2500);
assert.equal(updated.receivedChars, 911);
assert.equal(updated.streamSupported, true);
assert.equal(updated.batchId, 'batch-b');
assert.equal(updated.batchIndex, 3);
assert.deepEqual(updated.coverageDimensionIds, ['new-coverage']);
assert.deepEqual(updated.targetTitleIds, ['usopp']);
assert.ok(updated.snippet.startsWith('...'), 'Long accumulated output should be compacted to a tail snippet.');

const completed = buildLoredeckCreatorGenerationResult(
  generation,
  updated,
  'success',
  '',
  { receivedChars: 1200, snippet: 'final snippet' },
  5000,
);

assert.deepEqual(
  completed,
  {
    id: 'title_batch-1000',
    actionId: 'title_batch',
    label: 'Title Batch',
    status: 'success',
    message: 'Generation complete.',
    completedAt: 5000,
    elapsedMs: 4000,
    receivedChars: 1200,
    snippet: 'final snippet',
    streamSupported: true,
    batchId: 'batch-b',
    batchLabel: 'Batch A',
    batchIndex: 3,
    batchTotal: 5,
    targetTitleBatchId: 'batch-a',
    targetPlanningBatchId: 'planning-a',
    coverageDimensionIds: ['new-coverage'],
    targetTitleIds: ['usopp'],
  },
  'Completed generation results should preserve active generation metadata and final details.',
);

assert.deepEqual(
  buildLoredeckCreatorCancelledGenerationResult(updated, 6000),
  {
    id: 'title_batch-1000',
    actionId: 'title_batch',
    label: 'Title Batch',
    status: 'cancelled',
    message: 'Generation cancelled. Any late provider response will be ignored.',
    completedAt: 6000,
    elapsedMs: 5000,
    receivedChars: 911,
    snippet: updated.snippet,
    streamSupported: true,
    batchId: 'batch-b',
    batchLabel: 'Batch A',
    batchIndex: 3,
    batchTotal: 5,
    targetTitleBatchId: 'batch-a',
    targetPlanningBatchId: 'planning-a',
    coverageDimensionIds: ['new-coverage'],
    targetTitleIds: ['usopp'],
  },
  'Cancelled generation results should use the standard cancellation copy and preserve active metadata.',
);

console.log('Deck Maker generation lifecycle tests passed.');
