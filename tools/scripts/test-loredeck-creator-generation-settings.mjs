import assert from 'node:assert/strict';
import {
  LOREDECK_CREATOR_ENTRY_BATCH_MAX,
  LOREDECK_CREATOR_ENTRY_BATCH_SIZE,
  LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
  LOREDECK_CREATOR_GENERATION_SETTING_LIMITS,
  LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES,
  clampLoredeckCreatorInteger,
  getLoredeckCreatorGenerationSettingsFromCache,
  hasPersistableLoredeckCreatorProject,
  normalizeLoredeckCreatorGenerationSettings,
  resolveLoredeckCreatorSplitRetryProvider,
} from '../../src/loredecks/loredeck-creator-generation-settings.js';

assert.equal(LOREDECK_CREATOR_ENTRY_BATCH_SIZE, 3, 'Default Lorecard drafting micro-batch size should stay small.');
assert.equal(LOREDECK_CREATOR_ENTRY_BATCH_MAX, 6, 'Lorecard drafting micro-batches should keep the existing upper bound.');
assert.equal(LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES, 5, 'Title Generate Remaining should keep the existing run limit.');
assert.ok(Object.isFrozen(LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS), 'Generation setting defaults should be immutable.');
assert.ok(Object.isFrozen(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS), 'Generation setting limits should be immutable.');
for (const [key, limits] of Object.entries(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS)) {
  assert.ok(Object.isFrozen(limits), `${key} generation setting limits should be immutable.`);
}

assert.equal(clampLoredeckCreatorInteger('4.6', 1, 6, 3), 5, 'Integer clamping should round numeric input.');
assert.equal(clampLoredeckCreatorInteger('not-a-number', 1, 6, 3), 3, 'Integer clamping should use the fallback for invalid input.');
assert.equal(clampLoredeckCreatorInteger(99, 1, 6, 3), 6, 'Integer clamping should enforce max bounds.');
assert.equal(clampLoredeckCreatorInteger(-99, 1, 6, 3), 1, 'Integer clamping should enforce min bounds.');

const defaults = normalizeLoredeckCreatorGenerationSettings();
assert.deepEqual(defaults, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS, 'Empty generation settings should normalize to defaults.');
assert.notEqual(defaults, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS, 'Normalization should return a mutable copy, not the frozen defaults object.');

assert.deepEqual(
  normalizeLoredeckCreatorGenerationSettings({
    titleBatchLimit: 99,
    planningProposalLimit: -1,
    entryBatchSize: '4.4',
    titleRunRemainingLimit: 0,
    entryRunRemainingLimit: 99,
    retryAttempts: 3.6,
    retrySmaller: false,
    useUtilityProviderForSplitRetries: true,
    showStreamingProgress: false,
  }),
  {
    titleBatchLimit: 12,
    planningProposalLimit: 6,
    entryBatchSize: 4,
    titleRunRemainingLimit: 1,
    entryRunRemainingLimit: 10,
    retryAttempts: 4,
    retrySmaller: false,
    useUtilityProviderForSplitRetries: true,
    showStreamingProgress: false,
  },
  'Generation settings should clamp bounded numbers and preserve explicit boolean opt-outs.',
);

assert.deepEqual(
  normalizeLoredeckCreatorGenerationSettings(['entryBatchSize', 6]),
  LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
  'Array input should not be treated as a settings object.',
);

assert.deepEqual(
  getLoredeckCreatorGenerationSettingsFromCache({
    generationSettings: {
      entryBatchSize: 6,
      retrySmaller: false,
    },
  }),
  {
    ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
    entryBatchSize: 6,
    retrySmaller: false,
  },
  'Cache reads should normalize the stored generationSettings payload.',
);

assert.equal(hasPersistableLoredeckCreatorProject({ generationSettings: { entryBatchSize: 4 } }), false, 'Settings-only local jobs should not force project persistence.');
assert.equal(hasPersistableLoredeckCreatorProject({ jobId: 'creator-job' }), true, 'Jobs with an id should persist.');
assert.equal(hasPersistableLoredeckCreatorProject({ titleDrafts: [{ id: 'title' }] }), true, 'Jobs with generated title drafts should persist.');
assert.equal(hasPersistableLoredeckCreatorProject({ titleDrafts: [] }), false, 'Empty generated arrays should not force persistence.');

assert.deepEqual(
  resolveLoredeckCreatorSplitRetryProvider({ useUtilityProviderForSplitRetries: false }, () => ({ ok: true })),
  {
    providerKind: 'lore',
    label: 'Reasoning Provider',
    fallbackMessage: '',
  },
  'Split retries should default to the Reasoning Provider even when the Utility Provider is configured.',
);

let requestedProviderKind = '';
assert.deepEqual(
  resolveLoredeckCreatorSplitRetryProvider({ useUtilityProviderForSplitRetries: true }, providerKind => {
    requestedProviderKind = providerKind;
    return { ok: true };
  }),
  {
    providerKind: 'continuity',
    label: 'Utility Provider',
    fallbackMessage: '',
  },
  'Opted-in split retries should use the Utility Provider when configured.',
);
assert.equal(requestedProviderKind, 'continuity', 'Split retry validation should check the Utility Provider configuration.');

assert.deepEqual(
  resolveLoredeckCreatorSplitRetryProvider({ useUtilityProviderForSplitRetries: true }, () => ({
    ok: false,
    message: 'Utility Provider is missing a model.',
  })),
  {
    providerKind: 'lore',
    label: 'Reasoning Provider',
    fallbackMessage: 'Utility Provider is missing a model.',
  },
  'Split retries should fall back to the Reasoning Provider with the Utility Provider validation message.',
);

console.log('Deck Maker generation settings tests passed.');
