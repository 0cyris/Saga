import assert from 'node:assert/strict';
import {
  getLoredeckCreatorEntryDraftBatchModels,
  getLoredeckCreatorUnhandledEntryDrafts,
  selectLoredeckCreatorEntryDraftBatchId,
} from '../../src/loredecks/loredeck-creator-entry-draft-pool.js';

const titleDrafts = [
  ...[
    'nami-secret-buyback-bargain',
    'arlong-holds-cocoyasi-hostage',
    'crew-sees-nami-as-arlongs-ally',
  ].map(titleId => ({
    titleId,
    creatorTitleBatchId: 'characters-pressure',
  })),
  ...[
    'bellemere-dies-for-her-daughters',
    'tangerines-carry-bellemeres-memory',
    'luffys-hat-on-namis-head',
  ].map(titleId => ({
    titleId,
    creatorTitleBatchId: 'emotional-symbols',
  })),
  ...[
    'nojiko-waits-for-the-right-moment',
    'eight-years-of-silent-maps',
  ].map(titleId => ({
    titleId,
    creatorTitleBatchId: 'backstory-timing',
  })),
];

const batchOrder = [
  'characters-pressure',
  'emotional-symbols',
  'backstory-timing',
];

{
  const blocked = new Set([
    'nami-secret-buyback-bargain',
    'arlong-holds-cocoyasi-hostage',
    'crew-sees-nami-as-arlongs-ally',
  ]);
  assert.equal(
    selectLoredeckCreatorEntryDraftBatchId(titleDrafts, batchOrder, blocked),
    'emotional-symbols',
    'Entry drafting should skip a selected batch once every title in that batch is already accepted, pending, or drafted.'
  );
  assert.deepEqual(
    getLoredeckCreatorUnhandledEntryDrafts(titleDrafts, blocked).map(draft => draft.titleId),
    [
      'bellemere-dies-for-her-daughters',
      'tangerines-carry-bellemeres-memory',
      'luffys-hat-on-namis-head',
      'nojiko-waits-for-the-right-moment',
      'eight-years-of-silent-maps',
    ]
  );
  assert.deepEqual(
    getLoredeckCreatorEntryDraftBatchModels({
      batches: batchOrder.map((id, index) => ({ id, label: id, order: index + 1 })),
      drafts: titleDrafts,
      remainingDrafts: getLoredeckCreatorUnhandledEntryDrafts(titleDrafts, blocked),
    }).map(batch => ({
      id: batch.id,
      approvedCount: batch.approvedCount,
      remainingCount: batch.remainingCount,
    })),
    [
      { id: 'characters-pressure', approvedCount: 3, remainingCount: 0 },
      { id: 'emotional-symbols', approvedCount: 3, remainingCount: 3 },
      { id: 'backstory-timing', approvedCount: 2, remainingCount: 2 },
    ],
    'The category model should expose remaining counts for every draftable title batch.'
  );
}

{
  const selectedSubset = titleDrafts.slice(0, 3);
  const blocked = new Set(selectedSubset.map(draft => draft.titleId));
  assert.equal(
    selectLoredeckCreatorEntryDraftBatchId(selectedSubset, batchOrder, blocked),
    '',
    'When the preferred selected subset is exhausted, entry drafting must not silently include unselected title batches.'
  );
}
