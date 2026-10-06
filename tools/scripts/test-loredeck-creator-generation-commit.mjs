import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { normalizeLoredeckCreatorJob } from '../../src/state/lore-creator-state.js';
import { normalizeLoredeckCreatorTitleDrafts, normalizeLoredeckCreatorTitleId, getLoredeckCreatorTitleDrafts, getLoredeckCreatorTitleBatchIdentity } from '../../src/loredecks/loredeck-creator-panel.js';
import { normalizeLoredeckCreatorCoverageIdList } from '../../src/loredecks/loredeck-creator-coverage.js';
import { buildLoredeckCreatorGenerationCommitPatch, reconcileLoredeckCreatorGenerationCommit, findLoredeckCreatorPendingGenerationCommit, getLoredeckCreatorCommittedGenerationResult, attachLoredeckCreatorGenerationCommitToChanges } from '../../src/loredecks/loredeck-creator-generation-commit.js';
import { runGenerationUnits } from '../../src/generation/generation-job-runner.js';

const runtime = readFileSync(new URL('../../src/runtime/lore-panel.js', import.meta.url), 'utf8');
const titleSource = runtime.match(/function attachLoredeckCreatorTitleBatch\([\s\S]*?(?=\nfunction approveLoredeckCreatorTitleSelection)/)?.[0];
assert.ok(titleSource, 'Load the real title generation commit boundary.');
let durable = normalizeLoredeckCreatorJob({ jobId: 'durable-generation', fandom: 'Fixture', scope: 'Fixture', titleDrafts: [] });
let writes = 0;
const scope = {
  normalizeLoredeckCreatorTitleDrafts, normalizeLoredeckCreatorTitleId, getLoredeckCreatorTitleDrafts, normalizeLoredeckCreatorCoverageIdList,
  getLoredeckCreatorTitleBatchIdentity,
  buildLoredeckCreatorGenerationCommitPatch,
  getLoredeckCreatorCommittedGenerationResult,
  getLoredeckCreatorApprovedTitleIds: job => new Set(job.approvedTitleDraftIds || []),
  getLoredeckCreatorSelectedTitleIds: job => new Set(job.selectedTitleDraftIds || []),
  getLoredeckCreatorTitleDraftedBatchIds: job => new Set(job.titleBatchDraftedIds || []),
  getLoredeckCreatorBriefCache: () => structuredClone(durable),
  updateLoredeckCreatorTitleCache: mutator => {
    const next = mutator(structuredClone(durable));
    durable = normalizeLoredeckCreatorJob(next);
    writes += 1;
    return durable;
  },
};
runInNewContext(`${titleSource}\nthis.commitTitle = commitLoredeckCreatorTitleDraftResult;`, scope);
const identity = '["durable-generation","run-one","batch-one","input-v1"]';
const receiptOptions = { idempotencyKey: identity, unitId: 'batch-one', runId: 'run-one', stage: 'title_batch', inputHash: 'input-v1' };
const commit = scope.commitTitle({ summary: 'Saved', clarifyingQuestions: [], titleDrafts: [{ titleId: 'saved-title', title: 'Saved title' }] }, {
  targetTitleBatch: { id: 'batch-one', label: 'Batch' }, generationCommit: receiptOptions,
});
assert.equal(durable.titleDrafts[0].titleId, 'saved-title');
assert.equal(writes, 1, 'Titles and reconciliation receipt must share one persisted job write.');
assert.equal(durable.generationUnits['batch-one']?.meta?.generationCommit?.idempotencyKey, identity,
  'Reload must identify the already committed title batch even when completion metadata never saved.');
assert.equal(durable.generationUnits['batch-one'].meta.checkpointPending, true);
assert.equal(durable.generationUnits['batch-one'].resultRef.titleIds[0], 'saved-title');
assert.equal(commit.draftCount, 1);
scope.commitTitle({ summary: 'Duplicate attempt', clarifyingQuestions: [], titleDrafts: [{ titleId: 'replacement', title: 'Must not replace the saved commit' }] }, {
  targetTitleBatch: { id: 'batch-one', label: 'Batch' }, generationCommit: receiptOptions,
});
assert.equal(writes, 1, 'The domain sink deduplicates an already acknowledged identity before any mutation.');
assert.equal(durable.titleDrafts[0].titleId, 'saved-title');
// Discard all live evidence. Reconciliation reads only a serialized/reloaded
// payload, while completion metadata remains absent.
durable = normalizeLoredeckCreatorJob(JSON.parse(JSON.stringify(durable)));
const pending = findLoredeckCreatorPendingGenerationCommit(durable, 'batch-one', 'input-v1');
assert.equal(pending.idempotencyKey, identity);
let providerCalls = 0;
const resumed = await runGenerationUnits({
  jobId: durable.jobId, runId: 'run-one', stage: 'title_batch', units: [{ unitId: 'batch-one', inputHash: 'input-v1' }],
  reconcileCommittedResult: context => reconcileLoredeckCreatorGenerationCommit(durable, context),
  callUnit: async () => { providerCalls += 1; return {}; },
  commitResult: async () => { throw new Error('Reload must not repeat the saved title mutation.'); },
});
assert.equal(resumed.status, 'complete');
assert.equal(providerCalls, 0);
assert.equal(resumed.results[0].parsedResult.titleDrafts[0].titleId, 'saved-title');

const artifactSource = runtime.match(/function commitLoredeckCreatorArtifactResult\([\s\S]*?(?=\nasync function acknowledgeLoredeckCreatorGenerationWrite)/)?.[0];
assert.ok(artifactSource);
scope.setLoredeckCreatorBriefCache = next => { durable = normalizeLoredeckCreatorJob(next); writes += 1; return durable; };
runInNewContext(`${artifactSource}\nthis.commitArtifact = commitLoredeckCreatorArtifactResult;`, scope);
for (const [stage, artifactKey, artifact] of [
  ['scope_brief', 'brief', { title: 'Saved brief', fandom: 'Fixture', scope: 'Fixture' }],
  ['story_outline', 'outline', { title: 'Saved outline', titleBatches: [] }],
]) {
  durable = normalizeLoredeckCreatorJob({ jobId: 'durable-generation', fandom: 'Fixture', scope: 'Fixture' });
  writes = 0;
  const artifactIdentity = JSON.stringify([durable.jobId, `run-${stage}`, `unit-${stage}`, 'input-v1']);
  scope.commitArtifact({ summary: 'Saved artifact', clarifyingQuestions: [], [artifactKey]: artifact }, stage, artifactIdentity);
  assert.equal(writes, 1);
  durable = normalizeLoredeckCreatorJob(JSON.parse(JSON.stringify(durable)));
  assert.equal(durable[artifactKey].title, artifact.title);
  assert.equal(durable.generationUnits[`unit-${stage}`].meta.generationCommit.idempotencyKey, artifactIdentity);
  scope.commitArtifact({ summary: 'Duplicate', clarifyingQuestions: [], [artifactKey]: { title: 'Must not replace saved artifact' } }, stage, artifactIdentity);
  assert.equal(writes, 1);
  const recovered = getLoredeckCreatorCommittedGenerationResult(durable, { idempotencyKey: artifactIdentity, stage });
  assert.equal(recovered.parsedResult[artifactKey].title, artifact.title);
}
const entryIdentity = '["durable-generation","run-entries","entry-unit","input-v1"]';
const proposals = ['one', 'two', 'three'].map(id => ({ action: 'upsert_entry', entry: { id, title: id, content: { fact: 'x'.repeat(60000) } } }));
const changes = proposals.map(proposal => ({ changeId: proposal.entry.id, source: 'loredeck_creator', targetKind: 'entry', payload: { entryOverrides: { [proposal.entry.id]: proposal.entry } } }));
const entryJob = normalizeLoredeckCreatorJob({ jobId: 'durable-generation', draftChanges: attachLoredeckCreatorGenerationCommitToChanges(changes,
  { idempotencyKey: entryIdentity, stage: 'entry_micro_batch' }, { summary: 'Saved large batch', proposals, clarifyingQuestions: [] }) });
assert.equal(entryJob.draftChanges.length, 3, 'A receipt must not duplicate a whole batch and push a saved draft beyond its normalization budget.');
const recoveredEntries = getLoredeckCreatorCommittedGenerationResult(entryJob, { idempotencyKey: entryIdentity, stage: 'entry_micro_batch' });
assert.equal(recoveredEntries.parsedResult.proposals.length, 3);
assert.equal(recoveredEntries.commitResult.entryCommit.changeCount, 3);
console.log('Deck Maker durable generation commit tests passed.');
