import assert from 'node:assert/strict';

import {
  getLoredeckCreatorLorecardsStageState,
} from '../../src/loredecks/loredeck-creator-pipeline-status.js';

assert.deepEqual(getLoredeckCreatorLorecardsStageState({
  planningComplete: false,
  remainingEntryCount: 4,
  draftChangeCount: 2,
}), {
  status: 'locked',
  detail: 'Locked',
});

assert.deepEqual(getLoredeckCreatorLorecardsStageState({
  planningComplete: true,
  remainingEntryCount: 4,
  draftChangeCount: 2,
  pendingLorecardCount: 0,
  approvedTitleCount: 8,
}), {
  status: 'ready',
  detail: '4 remaining, 2 drafts',
});

assert.deepEqual(getLoredeckCreatorLorecardsStageState({
  planningComplete: true,
  remainingEntryCount: 0,
  draftChangeCount: 2,
  pendingLorecardCount: 0,
  approvedTitleCount: 8,
}), {
  status: 'needs-review',
  detail: '2 drafts',
});

assert.deepEqual(getLoredeckCreatorLorecardsStageState({
  planningComplete: true,
  remainingEntryCount: 0,
  draftChangeCount: 0,
  pendingLorecardCount: 3,
  approvedTitleCount: 8,
}), {
  status: 'approved',
  detail: '3 pending',
});

assert.deepEqual(getLoredeckCreatorLorecardsStageState({
  planningComplete: true,
  lorecardsComplete: true,
  remainingEntryCount: 0,
  draftChangeCount: 0,
  pendingLorecardCount: 0,
  approvedTitleCount: 8,
}), {
  status: 'approved',
  detail: 'Approved',
});

assert.deepEqual(getLoredeckCreatorLorecardsStageState({
  planningComplete: true,
  generating: true,
  remainingEntryCount: 4,
  draftChangeCount: 2,
  approvedTitleCount: 8,
}), {
  status: 'generating',
  detail: '4 remaining, 2 drafts',
});

console.log('Loredeck Creator Lorecards stage status tests passed.');
