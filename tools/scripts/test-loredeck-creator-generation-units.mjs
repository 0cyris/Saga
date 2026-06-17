import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorEntryGenerationUnitId,
  buildLoredeckCreatorPlanningGenerationUnitId,
  buildLoredeckCreatorTitleGenerationUnitId,
  createLoredeckCreatorEntryChangeId,
  getLoredeckCreatorEntryTargetIds,
  getLoredeckCreatorGenerationUnitActionId,
  getLoredeckCreatorGenerationUnitBatchId,
  getLoredeckCreatorPlanningBatchIdentity,
} from '../../src/loredecks/loredeck-creator-generation-units.js';

assert.equal(
  getLoredeckCreatorGenerationUnitActionId({ meta: { actionId: 'entry_batch_draft' }, actionId: 'fallback' }),
  'entry_batch_draft',
  'Unit action id should prefer compact generation metadata.',
);
assert.equal(
  getLoredeckCreatorGenerationUnitBatchId({ meta: { targetPlanningBatchId: 'arlong-park' }, resultRef: { batchId: 'fallback' } }),
  'arlong-park',
  'Unit batch id should prefer retry/recovery metadata.',
);
assert.equal(
  getLoredeckCreatorGenerationUnitBatchId({ resultRef: { batchId: 'result-batch' } }),
  'result-batch',
  'Unit batch id should fall back to result refs for older generation unit records.',
);

assert.equal(
  buildLoredeckCreatorTitleGenerationUnitId('title_batch_draft', { id: 'arlong-park' }),
  'creator_title_batch_draft:arlong-park',
  'Title batch unit ids should include the target title batch id.',
);
assert.equal(
  buildLoredeckCreatorTitleGenerationUnitId('title_batch_draft', null),
  'creator_title_batch_draft:next_title_batch',
  'Title batch unit ids should have a stable fallback when no batch is selected.',
);
assert.equal(
  buildLoredeckCreatorTitleGenerationUnitId('title_revision', null, [{ titleId: 'zoro' }, { id: 'nami' }]),
  'creator_title_revision:nami_zoro',
  'Title revision unit ids should sort selected title ids for stable retries.',
);
assert.equal(
  buildLoredeckCreatorTitleGenerationUnitId('title_revision', null, []),
  'creator_title_revision:selected_titles',
  'Title revision unit ids should have a stable selected-title fallback.',
);

assert.deepEqual(
  getLoredeckCreatorPlanningBatchIdentity({ label: '  Arlong Park Context  ' }),
  {
    id: 'Arlong Park Context',
    label: 'Arlong Park Context',
  },
  'Planning batch identity should derive an id and label from labels when ids are missing.',
);
assert.equal(
  buildLoredeckCreatorPlanningGenerationUnitId(
    { label: 'Arlong Park Context' },
    [{ titleId: 'zoro' }, { title: 'Nami Choice' }],
  ),
  'creator_planning_batch:Arlong_Park_Context:Nami_Choice_zoro',
  'Planning unit ids should combine one context set with sorted approved title ids.',
);
assert.equal(
  buildLoredeckCreatorPlanningGenerationUnitId(null, []),
  'creator_planning_batch:next_context_set:approved_titles',
  'Planning unit ids should have stable fallback seeds.',
);

assert.deepEqual(
  [...getLoredeckCreatorEntryTargetIds([
    { titleId: 'Nami / Cocoyasi' },
    { id: 'Arlong:Park' },
    { targetEntryId: 'Ignored Because Id Wins', id: 'Usopp Village' },
    { targetEntryId: 'Target Only' },
  ])].sort(),
  ['arlong:park', 'nami_cocoyasi', 'target_only', 'usopp_village'],
  'Entry target ids should normalize title/id/target ids with the Loredeck entry-id contract.',
);
assert.equal(
  buildLoredeckCreatorEntryGenerationUnitId(
    { label: 'Arlong Park Context' },
    [{ titleId: 'Nami / Cocoyasi' }, { id: 'Arlong:Park' }],
  ),
  'creator_entry_micro_batch:Arlong_Park_Context:arlong:park_nami_cocoyasi',
  'Entry micro-batch unit ids should combine context batch and sorted target entry ids.',
);
assert.equal(
  buildLoredeckCreatorEntryGenerationUnitId(null, []),
  'creator_entry_micro_batch:context_set:target_titles',
  'Entry micro-batch unit ids should have stable fallback seeds.',
);

assert.equal(
  createLoredeckCreatorEntryChangeId(
    { affectedEntryIds: ['Nami / Cocoyasi'], title: 'Ignored Title' },
    { label: 'Arlong Park Context' },
    'creator_entry_micro_batch:Arlong_Park_Context:nami_cocoyasi',
    0,
  ),
  'creator_entry_Arlong_Park_Context_nami_cocoyasi_creator_entry_micro_batch:Arlong_Park_Context:nami_cocoyasi',
  'Entry draft change ids should include batch, entry, and source unit ids.',
);
assert.equal(
  createLoredeckCreatorEntryChangeId(
    { payload: { entryOverrides: { 'Arlong / Park': {} } } },
    {},
    '',
    2,
  ),
  'creator_entry_batch_arlong_park_unit',
  'Entry draft change ids should fall back through payload overrides, batch, index, and unit seeds.',
);

const longId = buildLoredeckCreatorEntryGenerationUnitId(
  { label: 'A'.repeat(200) },
  Array.from({ length: 20 }, (_, index) => ({ titleId: `title-${index}-${'x'.repeat(30)}` })),
);
assert(longId.length <= 220, 'Generation unit ids should stay within the storage-safe length cap.');

console.log('Deck Maker generation unit tests passed.');
