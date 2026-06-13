import assert from 'node:assert/strict';

import {
  normalizeLoredeckCreatorJob,
  normalizeLoredeckCreatorRegistry,
} from '../../src/state/lore-creator-state.js';

const draftChange = {
  changeId: 'creator-entry-draft:nami-secret',
  source: 'loredeck_creator',
  status: 'pending',
  action: 'update',
  targetKind: 'entry',
  affectedEntryIds: ['nami_secret'],
  payload: {
    entryOverrides: {
      nami_secret: {
        id: 'nami_secret',
        title: 'Nami Secret',
        schemaVersion: 3,
        content: 'Nami hides the village debt until Arlong Park breaks open.',
      },
    },
  },
};

const existing = normalizeLoredeckCreatorJob({
  jobId: 'creator-one-piece',
  fandom: 'One Piece',
  scope: 'Arlong Park',
  generatedPackId: 'one-piece-arlong-generated',
  draftChanges: [draftChange],
  entryDraftCount: 1,
  entryDraftedAt: 1000,
  updatedAt: 1000,
});

assert.equal(existing.draftChanges.length, 1, 'Fixture should preserve a pending Creator draft.');
assert.equal(existing.entryDraftCount, 1);

const afterHandoff = normalizeLoredeckCreatorJob({
  ...existing,
  draftChanges: [],
  entryDraftCount: 0,
  updatedAt: 2000,
});

assert.equal(
  Object.prototype.hasOwnProperty.call(afterHandoff, 'draftChanges'),
  false,
  'Creator draft handoff must clear saved draft rows instead of preserving stale drafts.'
);
assert.equal(afterHandoff.entryDraftCount, 0);

const registry = normalizeLoredeckCreatorRegistry({
  activeJobId: existing.jobId,
  lastJobId: existing.jobId,
  jobs: {
    [existing.jobId]: {
      ...existing,
      draftChanges: [],
      entryDraftCount: 0,
      updatedAt: 3000,
    },
  },
});

assert.equal(
  Object.prototype.hasOwnProperty.call(registry.jobs[existing.jobId], 'draftChanges'),
  false,
  'Creator registry normalization must not rehydrate cleared draft rows.'
);
assert.equal(registry.jobs[existing.jobId].entryDraftCount, 0);

console.log('Loredeck Creator draft handoff state tests passed.');
