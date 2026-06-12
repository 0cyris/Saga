import assert from 'node:assert/strict';
import {
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
