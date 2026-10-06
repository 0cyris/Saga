import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { DEFAULT_SETTINGS, MODULE_KEY, SCHEMA_VERSION } from '../../src/state/constants.js';
import { configureLoredeckLibraryStore, upsertLoredeckLibraryPack } from '../../src/state/loredeck-library-store.js';
import { getLoredeckDefinition } from '../../src/runtime/active-stack-panel.js';
import { buildLoredeckCreatorGeneratedPackRecord, getLoredeckCreatorGeneratedPackId } from '../../src/loredecks/loredeck-creator-generated-pack.js';
import { getLoredeckCreatorPlanningBatchIdentity, buildLoredeckCreatorPlanningGenerationUnitId } from '../../src/loredecks/loredeck-creator-generation-units.js';
import { isLoredeckCreatorPlanningProposal, validateLoredeckCreatorPlanningResult, isLoredeckCreatorParsedPlanningUsable } from '../../src/loredecks/loredeck-creator-generation-validation.js';
import { attachLoredeckCreatorGenerationCommitToChanges, getLoredeckCreatorCommittedGenerationResult, reconcileLoredeckCreatorGenerationCommit } from '../../src/loredecks/loredeck-creator-generation-commit.js';
import { runGenerationUnits } from '../../src/generation/generation-job-runner.js';
import { normalizeLoredeckCreatorTitleId, normalizeLoredeckCreatorTitleIdList } from '../../src/loredecks/loredeck-creator-panel.js';
import { createLoredeckRecordPatchChange, getLoredeckPendingChanges, normalizeLoredeckPendingChanges } from '../../src/runtime/loredeck-pending-change-model.js';
import { acceptLoredeckPendingChanges, configureLoredeckPendingChangeActions } from '../../src/runtime/loredeck-pending-change-actions.js';
import { configureSagaLorepackLibraryStorage, resetSagaLorepackLibraryStorageCache } from '../../src/storage/saga-lorepack-library-storage.js';
import {
  configureSagaLorepackPayloadStorage,
  getCachedExternalLorepackPayload,
  hydrateCachedExternalLorepackPayloadRecord,
  hydrateExternalLorepackPayloadRecord,
  resetSagaLorepackPayloadStorageCache,
} from '../../src/storage/saga-lorepack-payload-storage.js';

const settings = { loredeckLibrary: DEFAULT_SETTINGS.loredeckLibrary, loredeckCreatorProjects: DEFAULT_SETTINGS.loredeckCreatorProjects };
const state = { _version: SCHEMA_VERSION, loredeckRegistry: { schemaVersion: 1, packs: {} } };
globalThis.SillyTavern = {
  getContext: () => ({ extensionSettings: { [MODULE_KEY]: settings }, chatMetadata: { [MODULE_KEY]: state } }),
};
configureLoredeckLibraryStore({ getState: () => state, getSettings: () => settings, saveSettings() {}, saveState() {} });
configureSagaLorepackLibraryStorage({ persistWrites: false });
configureSagaLorepackPayloadStorage({ persistWrites: false });

const runtime = readFileSync(new URL('../../src/runtime/lore-panel.js', import.meta.url), 'utf8');
const ensureSource = runtime.match(/(?:async )?function ensureLoredeckCreatorGeneratedPack\([\s\S]*?(?=\nfunction getLoredeckCreatorPlanningExistingTimelineIds)/)?.[0];
assert.ok(ensureSource, 'Load the production shell initialization function.');
let job;
const ensurePack = new Function('deps', `
  const { getLoredeckCreatorBriefCache, getLoredeckCreatorGeneratedPackId, getLoredeckDefinition,
    getUniqueLoredeckPackId, buildLoredeckCreatorGeneratedPackRecord, upsertLoredeckLibraryPack,
    hydrateExternalLorepackPayloadRecord, getFreshLoredeckLibraryPack, loredeckPreviewCacheController,
    clearCanonLoreDatabaseCache, clearContextIndexCache, setLoredeckCreatorBriefCache,
    refreshLoredeckSurfaces, toast } = deps;
  ${ensureSource}
  return ensureLoredeckCreatorGeneratedPack;
`)({
  getLoredeckCreatorBriefCache: () => job,
  getLoredeckCreatorGeneratedPackId,
  getLoredeckDefinition,
  getUniqueLoredeckPackId: id => `${id}-unique`,
  buildLoredeckCreatorGeneratedPackRecord,
  upsertLoredeckLibraryPack,
  hydrateExternalLorepackPayloadRecord,
  getFreshLoredeckLibraryPack: (id, fallback) => hydrateCachedExternalLorepackPayloadRecord(getLoredeckDefinition(id) || fallback),
  loredeckPreviewCacheController: { setManifestPreview() {} },
  clearCanonLoreDatabaseCache() {}, clearContextIndexCache() {},
  setLoredeckCreatorBriefCache: next => { job = next; },
  refreshLoredeckSurfaces() {}, toast() {},
});

function planningChange(batchId, changeId) {
  return {
    changeId, source: 'loredeck_creator', action: 'creator_upsert_tag_definition', targetKind: 'tag', title: changeId,
    payload: { tagDefinitions: { [changeId]: { label: changeId } } },
    preview: { creatorPlanningBatch: { id: batchId, label: batchId } },
  };
}

function seedProject() {
  resetSagaLorepackLibraryStorageCache();
  resetSagaLorepackPayloadStorageCache();
  job = {
    jobId: 'planning-persistence', generatedPackId: 'planning-persistence',
    brief: { packId: 'planning-persistence', title: 'Planning Persistence' },
    planningBatchQueuedIds: ['batch-a'], planningBatchAcceptedIds: [],
  };
  const pack = buildLoredeckCreatorGeneratedPackRecord(job, job.generatedPackId);
  pack.pendingChanges = [planningChange('batch-a', 'plan-a')];
  pack.entryOverrides = { existing: { id: 'existing', title: 'Existing Lorecard', content: { fact: 'Accepted lore.' } } };
  pack.disabledEntryIds = ['disabled-card'];
  pack.tagRegistry = { schemaVersion: 1, tags: { 'existing-tag': { label: 'Existing tag' } } };
  pack.timelineRegistry = { schemaVersion: 1, anchors: [{ id: 'existing-anchor', label: 'Existing anchor' }], windows: [] };
  assert.equal(upsertLoredeckLibraryPack(pack).ok, true);
  return getCachedExternalLorepackPayload(job.generatedPackId);
}

// A second planning batch must not overwrite payload content with the compact
// Library row's empty defaults, and its prompt must receive the saved registry.
seedProject();
assert.equal(getLoredeckDefinition(job.generatedPackId).pendingChanges, undefined);
const existingPack = await ensurePack(job);
const saved = getCachedExternalLorepackPayload(job.generatedPackId);
assert.deepEqual(saved.pendingChanges.map(change => change.changeId), ['plan-a'], 'Starting another planning batch must preserve earlier proposals.');
assert.equal(saved.entryOverrides.existing.title, 'Existing Lorecard', 'Starting another planning batch must preserve accepted Lorecards.');
assert.deepEqual(saved.disabledEntryIds, ['disabled-card']);
assert.deepEqual(existingPack.pendingChanges.map(change => change.changeId), ['plan-a'], 'Return the full payload to the planning caller.');
assert.equal(existingPack.tagRegistry.tags['existing-tag'].label, 'Existing tag');
assert.equal(existingPack.timelineRegistry.anchors[0].id, 'existing-anchor');

// Even a cached hydration yields to other work before the shell write. Read the
// current payload again so an acceptance in that interval cannot be rolled back.
seedProject();
const warmCachePlanning = ensurePack(job);
const warmCacheEdit = getCachedExternalLorepackPayload(job.generatedPackId);
warmCacheEdit.entryOverrides.existing.content.fact = 'Accepted during planning start.';
warmCacheEdit.pendingChanges.push(planningChange('batch-b', 'plan-b'));
assert.equal(upsertLoredeckLibraryPack(warmCacheEdit).ok, true);
const afterWarmCacheEdit = await warmCachePlanning;
assert.equal(afterWarmCacheEdit.entryOverrides.existing.content.fact, 'Accepted during planning start.');
assert.deepEqual(afterWarmCacheEdit.pendingChanges.map(change => change.changeId), ['plan-a', 'plan-b']);

// Reloading clears the in-memory payload cache. Load the saved payload before
// making any shell write, rather than treating its compact row as an empty deck.
const stored = seedProject();
resetSagaLorepackPayloadStorageCache();
configureSagaLorepackPayloadStorage({
  persistWrites: false,
  fileApi: {
    async readJsonFile(path) {
      assert.equal(path, '/user/files/saga-pack-planning-persistence.v1.json');
      return structuredClone(stored);
    },
  },
});
const resumed = await ensurePack(job);
assert.deepEqual(resumed.pendingChanges.map(change => change.changeId), ['plan-a']);
assert.equal(resumed.entryOverrides.existing.content.fact, 'Accepted lore.');
assert.deepEqual(resumed.disabledEntryIds, ['disabled-card']);
assert.equal(resumed.timelineRegistry.anchors[0].id, 'existing-anchor');

// Payload reads may finish after the user selects another Creator project.
const beforeSwitch = seedProject();
resetSagaLorepackPayloadStorageCache();
const originalJob = job;
configureSagaLorepackPayloadStorage({
  fileApi: { async readJsonFile() {
    job = { jobId: 'another-project', generatedPackId: 'another-deck' };
    return structuredClone(beforeSwitch);
  } },
});
assert.equal(await ensurePack(originalJob), null, 'A delayed payload read must not update another active project.');
assert.equal(job.generatedPackId, 'another-deck');

const beforeRelink = seedProject();
resetSagaLorepackPayloadStorageCache();
const originalLinkedJob = job;
configureSagaLorepackPayloadStorage({ fileApi: { async readJsonFile() {
  job = { ...job, generatedPackId: 'replacement-deck' };
  return structuredClone(beforeRelink);
} } });
assert.equal(await ensurePack(originalLinkedJob), null, 'A delayed payload read must not restore a previous deck link.');
assert.equal(job.generatedPackId, 'replacement-deck');

// A background Creator read and a planning read can overlap. A later disk
// response must not roll back edits made after the first response populated cache.
const overlappingSnapshot = seedProject();
const compactPack = getLoredeckDefinition(job.generatedPackId);
resetSagaLorepackPayloadStorageCache();
const completeReads = [];
configureSagaLorepackPayloadStorage({ fileApi: { readJsonFile() {
  if (completeReads.length >= 2) throw new Error('Unexpected cold payload read after the overlap fixture.');
  return new Promise(resolve => completeReads.push(resolve));
} } });
const backgroundHydration = hydrateExternalLorepackPayloadRecord(compactPack);
const planningHydration = ensurePack(job);
assert.equal(completeReads.length, 2);
completeReads[0](structuredClone(overlappingSnapshot));
await backgroundHydration;
const editedPack = hydrateCachedExternalLorepackPayloadRecord(compactPack);
editedPack.entryOverrides.existing.content.fact = 'Newly accepted lore.';
editedPack.pendingChanges.push(planningChange('batch-c', 'plan-c'));
assert.equal(upsertLoredeckLibraryPack(editedPack).ok, true);
completeReads[1](structuredClone(overlappingSnapshot));
const afterOverlappingRead = await planningHydration;
assert.equal(afterOverlappingRead.entryOverrides.existing.content.fact, 'Newly accepted lore.', 'A late payload read must preserve newer accepted Lorecard content.');
assert.deepEqual(afterOverlappingRead.pendingChanges.map(change => change.changeId), ['plan-a', 'plan-c'], 'A late payload read must preserve newer pending proposals.');

// Recover only the requested stranded batch; keep another batch's review queue
// and accepted cards intact through generation, commit, and acceptance.
seedProject();
job.approved = true;
job.outlineApproved = true;
job.outline = { titleBatches: [{ id: 'batch-a' }, { id: 'batch-b' }] };
job.titleDrafts = [{ titleId: 'card-a', creatorTitleBatchId: 'batch-a' }, { titleId: 'card-b', creatorTitleBatchId: 'batch-b' }];
job.planningBatchQueuedIds = ['batch-a', 'batch-b'];
let payload = getCachedExternalLorepackPayload(job.generatedPackId);
payload.pendingChanges = [planningChange('batch-b', 'plan-b')];
assert.equal(upsertLoredeckLibraryPack(payload).ok, true);
function sourceBetween(start, end) {
  const first = runtime.indexOf(start);
  const last = runtime.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  return runtime.slice(first, last);
}
const freshPack = (id, fallback) => hydrateCachedExternalLorepackPayloadRecord(getLoredeckDefinition(id) || fallback);
const parsed = { summary: 'Recovered batch A', clarifyingQuestions: [], proposals: [{ action: 'upsert_tag_definition', tagDefinition: { id: 'replanned', label: 'Replanned' } }] };
let generationCalls = 0;
const scope = {
  loredeckCreatorNotes: '',
  getLoredeckCreatorBriefCache: () => job,
  setLoredeckCreatorBriefCache: next => { job = next; },
  ensureLoredeckCreatorGeneratedPack: ensurePack,
  getLoredeckDefinition, getFreshLoredeckLibraryPack: freshPack,
  normalizeLoredeckCreatorTitleId, normalizeLoredeckCreatorTitleIdList,
  getLoredeckPendingChanges, normalizeLoredeckPendingChanges, createLoredeckRecordPatchChange,
  getLoredeckCreatorPlanningBatchIdentity, buildLoredeckCreatorPlanningGenerationUnitId,
  isLoredeckCreatorPlanningProposal, validateLoredeckCreatorPlanningResult, isLoredeckCreatorParsedPlanningUsable,
  attachLoredeckCreatorGenerationCommitToChanges,
  getLoredeckCreatorCommittedGenerationResult,
  getLoredeckCreatorOutline: cached => cached.outline,
  getLoredeckCreatorTitleBatchRows: cached => cached.outline.titleBatches,
  getLoredeckCreatorApprovedTitleDrafts: cached => cached.titleDrafts,
  normalizeLoredeckCreatorCoverageIdList: values => values,
  getLoredeckCreatorGenerationSettings: () => ({ planningProposalLimit: 24 }),
  clampLoredeckCreatorInteger: (_value, _min, _max, fallback) => fallback,
  compactLoredeckCreatorTitleDraftForRevision: draft => draft,
  getLoredeckCreatorPlanningExistingTimelineIds: pack => pack.timelineRegistry.anchors.map(anchor => anchor.id),
  getLoredeckCreatorPlanningExistingTagIds: pack => Object.keys(pack.tagRegistry.tags),
  runBusyAction: async (_button, _label, action) => action(),
  ensureLoreProviderReadyForAction: () => true,
  startLoredeckCreatorGeneration: (_action, _label, patch) => {
    job = { ...job, ...patch };
    return { generation: { id: 'replan-run' } };
  },
  runLoredeckCreatorSingleUnitGeneration: async config => {
    generationCalls += 1;
    return {
      parsed,
      responseText: JSON.stringify(parsed),
      commitResult: await config.commitParsedResult({ parsedResult: parsed }),
    };
  },
  requestLoredeckCreatorPlanningResponse() {}, repairLoredeckCreatorPlanningResponse() {}, parseLoredeckAssistantResponse() {},
  ignoreStaleLoredeckCreatorGeneration: () => false,
  isLoredeckCreatorAbortError: () => false,
  prepareLoredeckCreatorStageFailure: error => error,
  markLoredeckCreatorActionFailed() {},
  normalizeLoredeckTagId: id => id,
  normalizeLoredeckTagDefinition: (definition, id) => ({ ...definition, id }),
  formatLoredeckAssistantProposalDescription: () => 'Planning proposal',
  buildLoredeckAssistantPreviewMeta: (_proposal, meta) => meta,
  buildLoredeckAssistantPendingChanges: (_pack, proposals) => proposals.map(proposal => scope.buildLoredeckAssistantTagChange(proposal)),
  persistLoredeckLibraryRecordMutation: (pack, mutator) => {
    const next = freshPack(pack.packId, pack);
    mutator(next);
    return upsertLoredeckLibraryPack(next).ok;
  },
  selectLoredeckForDetails() {}, refreshPanelBody() {}, refreshHeader() {}, finishLoredeckCreatorGeneration() {}, toast() {},
};
runInNewContext([
  sourceBetween('function markLoredeckCreatorPlanningChange(', 'function getLoredeckCreatorAcceptedPlanningStatus('),
  sourceBetween('function getLoredeckCreatorPlanningAcceptedBatchIds(', 'function getLoredeckCreatorTitleBatchById('),
  sourceBetween('function buildLoredeckAssistantTagChange(', 'function buildLoredeckAssistantTimelineAnchorChange('),
].join('\n'), scope);
await scope.handleLoredeckCreatorPlanningDraft({ targetPlanningBatch: { id: 'batch-a', label: 'Batch A' }, replan: true });
payload = getCachedExternalLorepackPayload(job.generatedPackId);
assert.deepEqual(payload.pendingChanges.map(change => change.preview.creatorPlanningBatch.id).sort(), ['batch-a', 'batch-b'], 'Re-plan must restore the missing batch without deleting other proposals.');
assert.equal(payload.entryOverrides.existing.title, 'Existing Lorecard');
await scope.handleLoredeckCreatorPlanningDraft({ targetPlanningBatch: { id: 'batch-a' }, replan: true });
assert.equal(generationCalls, 1, 'A stale Re-plan button must not replace proposals still awaiting review.');
configureLoredeckPendingChangeActions({
  getFreshLoredeckLibraryPack: freshPack,
  persistLoredeckLibraryRecordMutation: scope.persistLoredeckLibraryRecordMutation,
  normalizeLoredeckCreatorTitleId, normalizeLoredeckCreatorTitleIdList,
  getLoredeckCreatorBriefCache: () => job,
  setLoredeckCreatorBriefCache: next => { job = next; },
  isLoredeckCreatorPlanningPendingChange: scope.isLoredeckCreatorPlanningPendingChange,
  isGeneratedLoredeckPack: () => true, canValidateLoredeckInEditor: () => false,
});
assert.equal(await acceptLoredeckPendingChanges(freshPack(job.generatedPackId)), true);
assert.deepEqual(job.planningBatchAcceptedIds.sort(), ['batch-a', 'batch-b']);
assert.deepEqual([...scope.getLoredeckCreatorEntryEligibleBatchIds(job)].sort(), ['batch-a', 'batch-b']);
await scope.handleLoredeckCreatorPlanningDraft({ targetPlanningBatch: { id: 'batch-a' }, replan: true });
assert.equal(generationCalls, 1, 'A stale Re-plan button must not regenerate an accepted batch.');

// The normal next-batch path preserves A while queuing B, so both unlock after
// review without needing the recovery action.
seedProject();
job.approved = true;
job.outlineApproved = true;
job.outline = { titleBatches: [{ id: 'batch-a' }, { id: 'batch-b' }] };
job.titleDrafts = [{ titleId: 'card-a', creatorTitleBatchId: 'batch-a' }, { titleId: 'card-b', creatorTitleBatchId: 'batch-b' }];
await scope.handleLoredeckCreatorPlanningDraft({ targetPlanningBatch: { id: 'batch-b', label: 'Batch B' } });
assert.equal(generationCalls, 2);
payload = getCachedExternalLorepackPayload(job.generatedPackId);
assert.deepEqual(payload.pendingChanges.map(change => change.preview.creatorPlanningBatch.id).sort(), ['batch-a', 'batch-b']);
assert.equal(payload.entryOverrides.existing.title, 'Existing Lorecard');
assert.equal(await acceptLoredeckPendingChanges(freshPack(job.generatedPackId)), true);
assert.deepEqual(job.planningBatchAcceptedIds.sort(), ['batch-a', 'batch-b']);

// Accepting a different batch while the payload loads must survive the session
// patch; the refreshed project also supplies the latest prompt inputs.
const acceptanceSnapshot = seedProject();
job.approved = true;
job.outlineApproved = true;
job.outline = { titleBatches: [{ id: 'batch-a' }, { id: 'batch-b' }] };
job.titleDrafts = [{ titleId: 'card-a', creatorTitleBatchId: 'batch-a' }];
job.planningBatchQueuedIds = ['batch-a', 'batch-b'];
acceptanceSnapshot.pendingChanges = [];
resetSagaLorepackPayloadStorageCache();
configureSagaLorepackPayloadStorage({ fileApi: { async readJsonFile() {
  job = { ...job, planningBatchAcceptedIds: ['batch-b'], notes: 'Latest notes',
    titleDrafts: [{ titleId: 'card-a', title: 'Updated title', creatorTitleBatchId: 'batch-a' }] };
  return structuredClone(acceptanceSnapshot);
} } });
let requestedContext;
const generate = scope.runLoredeckCreatorSingleUnitGeneration;
scope.runLoredeckCreatorSingleUnitGeneration = config => {
  requestedContext = config.requestContext;
  return generate(config);
};
await scope.handleLoredeckCreatorPlanningDraft({ targetPlanningBatch: { id: 'batch-a' }, replan: true });
assert.deepEqual([...job.planningBatchAcceptedIds], ['batch-b'], 'A delayed planning start must preserve another batch accepted during hydration.');
assert.equal(requestedContext.notes, 'Latest notes');
assert.equal(requestedContext.approvedTitleDrafts[0].title, 'Updated title');

// Re-check the requested batch after hydration, since it may have been accepted
// or its prerequisites revoked while the read was pending.
for (const changeJob of [
  current => ({ ...current, planningBatchAcceptedIds: ['batch-a'] }),
  current => ({ ...current, outlineApproved: false }),
]) {
  const snapshot = seedProject();
  job.approved = true;
  job.outlineApproved = true;
  job.outline = { titleBatches: [{ id: 'batch-a' }] };
  job.titleDrafts = [{ titleId: 'card-a', creatorTitleBatchId: 'batch-a' }];
  snapshot.pendingChanges = [];
  resetSagaLorepackPayloadStorageCache();
  configureSagaLorepackPayloadStorage({ fileApi: { async readJsonFile() {
    job = changeJob(job);
    return structuredClone(snapshot);
  } } });
  const callsBefore = generationCalls;
  await scope.handleLoredeckCreatorPlanningDraft({ targetPlanningBatch: { id: 'batch-a' }, replan: true });
  assert.equal(generationCalls, callsBefore, 'A delayed planning start must honor the latest acceptance and approvals.');
}

// A failed cold-cache read must leave the Library link and project untouched.
seedProject();
resetSagaLorepackPayloadStorageCache();
configureSagaLorepackPayloadStorage({ fileApi: { async readJsonFile() { throw new Error('Payload unavailable'); } } });
await assert.rejects(ensurePack(job), /Payload unavailable/);
assert.equal(getCachedExternalLorepackPayload(job.generatedPackId), null);
assert.deepEqual(job.planningBatchQueuedIds, ['batch-a']);
assert.equal(getLoredeckDefinition(job.generatedPackId).payloadFile, '/user/files/saga-pack-planning-persistence.v1.json');

// The commit receipt belongs to the same durable pending-change payload as the
// proposals, so loss of the separate completion checkpoint cannot replay work.
seedProject();
const durableIdentity = JSON.stringify([job.jobId, 'durable-planning', 'plan-one', 'input-v1']);
const planningCommit = scope.commitLoredeckCreatorPlanningResult(parsed, {
  pack: freshPack(job.generatedPackId), targetPlanningBatch: { id: 'batch-durable', label: 'Durable batch' },
  generationCommit: { idempotencyKey: durableIdentity, stage: 'context_tag_planning' }, throwOnFailure: true,
});
assert.equal(planningCommit.queued, true);
const durablePayload = JSON.parse(JSON.stringify(getCachedExternalLorepackPayload(job.generatedPackId)));
const durableJob = JSON.parse(JSON.stringify(job));
const savedProposal = durablePayload.pendingChanges.find(change => change.preview?.generationCommit?.idempotencyKey === durableIdentity);
assert.equal(savedProposal.preview.generationCommit.parsedResult.summary, 'Recovered batch A');
let resumedProviderCalls = 0;
const checkpointReconciled = await runGenerationUnits({
  jobId: job.jobId, runId: 'durable-planning', stage: 'context_tag_planning', units: [{ unitId: 'plan-one', inputHash: 'input-v1' }],
  reconcileCommittedResult: context => reconcileLoredeckCreatorGenerationCommit(durableJob, context, durablePayload),
  callUnit: async () => { resumedProviderCalls += 1; return {}; },
  commitResult: async () => { throw new Error('A saved planning payload must not be rewritten.'); },
});
assert.equal(checkpointReconciled.status, 'complete');
assert.equal(resumedProviderCalls, 0);
assert.equal(checkpointReconciled.results[0].parsedResult.summary, 'Recovered batch A');
assert.equal(checkpointReconciled.results[0].commitResult.planningCommit.queued, true);

console.log('Deck Maker planning persistence tests passed.');
