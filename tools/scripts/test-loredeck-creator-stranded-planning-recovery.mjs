/**
 * Regression test for stranded Deck Maker planning batches.
 *
 * Bug: once a planning batch was first drafted, its id was stored in the sticky
 * `planningBatchQueuedIds` list and never pruned. If the user then discarded the
 * batch's proposals from Pending Review WITHOUT accepting them, the batch became
 * permanently stranded: still "Planned" (in queued ids) yet not Accepted and with
 * no live pending proposals to review. `getLoredeckCreatorNextPlanningBatch` then
 * returned null, so the planning button rendered as "Context Plans Complete" and
 * there was no in-app way to re-plan the batch or draft its approved titles.
 *
 * Fix: `getLoredeckCreatorNextPlanningBatch` now blocks re-planning only for batches
 * that are genuinely settled - ACCEPTED, or currently holding LIVE pending proposals -
 * rather than relying on the stale stored `planningBatchQueuedIds` list.
 */
import assert from 'node:assert/strict';

// Stub the SillyTavern host so the runtime state/library stores resolve against an
// in-memory chat registry. The generated pack (and its pending changes) live in the
// chat-level loredeck registry, which `getLoredeckCreatorPackFromCache` reads through.
const TEST_PACK_ID = 'stranded-recovery-test-pack';
const packPendingChanges = [];
globalThis.SillyTavern = {
  getContext() {
    return {
      chatMetadata: {
        saga: {
          loredeckRegistry: {
            schemaVersion: 1,
            packs: {
              [TEST_PACK_ID]: {
                packId: TEST_PACK_ID,
                id: TEST_PACK_ID,
                type: 'generated',
                title: 'Stranded Recovery Test Pack',
                pendingChanges: packPendingChanges,
              },
            },
          },
        },
      },
      extensionSettings: { saga: {} },
      saveMetadata() {},
      saveSettingsDebounced() {},
    };
  },
};

const {
  getLoredeckCreatorNextPlanningBatch,
  getLoredeckCreatorPlanningPendingBatchIds,
  getLoredeckCreatorPlanningSettledBatchIds,
} = await import('../../src/runtime/lore-panel.js');

const BATCH_ID = 'batch-a';

function makeStrandedCached(extra = {}) {
  return {
    // Two approved titles assigned to BATCH_ID -> a planning batch row with
    // approvedTitleCount > 0, i.e. a batch that needs a Context & Tag set.
    titleDrafts: [
      { titleId: 't1', title: 'Title One', creatorTitleBatchId: BATCH_ID },
      { titleId: 't2', title: 'Title Two', creatorTitleBatchId: BATCH_ID },
    ],
    approvedTitleDraftIds: ['t1', 't2'],
    // The sticky stored list still claims this batch was "Planned"...
    planningBatchQueuedIds: [BATCH_ID],
    // ...but it was never accepted.
    planningBatchAcceptedIds: [],
    ...extra,
  };
}

function makePlanningPendingChange(batchId) {
  return {
    changeId: `creator_plan_${batchId}`,
    source: 'loredeck_creator',
    targetKind: 'tag',
    action: 'creator_upsert_tag_definition',
    preview: { creatorPlanningBatch: { id: batchId } },
  };
}

// --- Case 1: stranded batch is re-offered for planning ---------------------
{
  packPendingChanges.length = 0; // no live pending proposals on the pack
  const cached = makeStrandedCached();
  const next = getLoredeckCreatorNextPlanningBatch(cached);
  assert.ok(next, 'A stranded batch (queued-but-not-accepted, nothing pending) must be re-offered for planning.');
  assert.equal(next.id, BATCH_ID, 'The stranded batch should be the next plannable batch.');
  assert.ok(next.approvedTitleCount > 0, 'The re-offered batch should carry its approved titles.');
}

// --- Case 2: an ACCEPTED batch is NOT re-offered ---------------------------
{
  packPendingChanges.length = 0;
  const cached = makeStrandedCached({ planningBatchAcceptedIds: [BATCH_ID] });
  const next = getLoredeckCreatorNextPlanningBatch(cached);
  assert.equal(next, null, 'An accepted batch must not be re-offered for planning.');
}

// --- Case 3: a batch with LIVE pending proposals is NOT re-offered ---------
{
  packPendingChanges.length = 0;
  packPendingChanges.push(makePlanningPendingChange(BATCH_ID));
  // Sanity: the pack genuinely reports this batch as having pending review work.
  const pendingIds = getLoredeckCreatorPlanningPendingBatchIds({ packId: TEST_PACK_ID, pendingChanges: packPendingChanges });
  assert.ok(pendingIds.has(BATCH_ID), 'Pending-proposal helper should report the batch as awaiting review.');

  const cached = makeStrandedCached({ generatedPackId: TEST_PACK_ID });
  const next = getLoredeckCreatorNextPlanningBatch(cached);
  assert.equal(next, null, 'A batch with live pending proposals must not be re-offered (the user should review those instead).');
}

// --- Case 4: the shared "settled" helper drives BOTH the selector and the ----
// planning-draft guard. The guard rejected the batch when it appeared in this set,
// so a stranded batch must be ABSENT here (otherwise the button unlocks but the
// handler still toasts "That Context and Tag set has already been planned").
{
  packPendingChanges.length = 0;
  const strandedSettled = getLoredeckCreatorPlanningSettledBatchIds(makeStrandedCached());
  assert.ok(!strandedSettled.has(BATCH_ID), 'A stranded batch must not be treated as settled, so the planning-draft guard lets it re-plan.');

  const acceptedSettled = getLoredeckCreatorPlanningSettledBatchIds(makeStrandedCached({ planningBatchAcceptedIds: [BATCH_ID] }));
  assert.ok(acceptedSettled.has(BATCH_ID), 'An accepted batch must be settled so the guard blocks duplicate planning.');

  packPendingChanges.push(makePlanningPendingChange(BATCH_ID));
  const pendingSettled = getLoredeckCreatorPlanningSettledBatchIds(makeStrandedCached({ generatedPackId: TEST_PACK_ID }));
  assert.ok(pendingSettled.has(BATCH_ID), 'A batch awaiting review must be settled so the guard steers the user to review instead.');
  packPendingChanges.length = 0;
}

console.log('Stranded Deck Maker planning recovery checks passed.');
