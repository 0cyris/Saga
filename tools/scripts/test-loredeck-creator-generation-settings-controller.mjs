import assert from 'node:assert/strict';
import {
  LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
} from '../../src/loredecks/loredeck-creator-generation-settings.js';
import {
  createLoredeckCreatorGenerationSettingsController,
} from '../../src/loredecks/loredeck-creator-generation-settings-controller.js';

{
  let currentJob = {
    generationSettings: {
      titleBatchLimit: 99,
      entryBatchSize: 2,
      retrySmaller: false,
    },
  };
  const localUpdates = [];
  const persistedUpdates = [];
  const controller = createLoredeckCreatorGenerationSettingsController({
    getCurrentJob: () => currentJob,
    setCurrentJob: (job, options) => {
      persistedUpdates.push({ job, options });
      currentJob = job;
      return job;
    },
    setCurrentJobLocal: job => {
      localUpdates.push(job);
      currentJob = job;
      return job;
    },
  });

  assert.equal(controller.getGenerationSettings().titleBatchLimit, 12, 'Reads should normalize current cached settings.');
  assert.equal(controller.getGenerationSettings().retrySmaller, false, 'Reads should preserve explicit retrySmaller opt-out.');

  const updated = controller.setGenerationSettings({
    entryBatchSize: 99,
    useUtilityProviderForSplitRetries: true,
  });
  assert.equal(updated, currentJob);
  assert.equal(localUpdates.length, 1, 'Settings-only jobs should update the local cache instead of creating a project.');
  assert.equal(persistedUpdates.length, 0);
  assert.equal(currentJob.generationSettings.entryBatchSize, 6);
  assert.equal(currentJob.generationSettings.useUtilityProviderForSplitRetries, true);

  controller.resetGenerationSettings();
  assert.equal(localUpdates.length, 2);
  assert.deepEqual(currentJob.generationSettings, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS);
  assert.notEqual(currentJob.generationSettings, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS, 'Reset local settings should store a mutable normalized copy.');
}

{
  let currentJob = {
    jobId: 'creator-persisted',
    brief: { title: 'Arlong Park' },
    generationSettings: {
      titleBatchLimit: 6,
      showStreamingProgress: false,
    },
  };
  const localUpdates = [];
  const persistedUpdates = [];
  const controller = createLoredeckCreatorGenerationSettingsController({
    getCurrentJob: () => currentJob,
    setCurrentJob: (job, options) => {
      persistedUpdates.push({ job, options });
      currentJob = job;
      return job;
    },
    setCurrentJobLocal: job => {
      localUpdates.push(job);
      currentJob = job;
      return job;
    },
  });

  controller.setGenerationSettings({ retryAttempts: 4 });
  assert.equal(localUpdates.length, 0);
  assert.equal(persistedUpdates.length, 1);
  assert.deepEqual(persistedUpdates[0].options, { suppressWorkbenchRefresh: true });
  assert.equal(currentJob.generationSettings.titleBatchLimit, 6);
  assert.equal(currentJob.generationSettings.retryAttempts, 4);
  assert.equal(currentJob.generationSettings.showStreamingProgress, false);

  controller.resetGenerationSettings();
  assert.equal(persistedUpdates.length, 2);
  assert.deepEqual(currentJob.generationSettings, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS);
  assert.notEqual(currentJob.generationSettings, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS, 'Persisted reset should store a mutable defaults copy.');
}

{
  const validatedKinds = [];
  const controller = createLoredeckCreatorGenerationSettingsController({
    validateProvider: providerKind => {
      validatedKinds.push(providerKind);
      return { ok: providerKind === 'continuity' };
    },
  });
  assert.deepEqual(controller.getSplitRetryProvider({ useUtilityProviderForSplitRetries: true }), {
    providerKind: 'continuity',
    label: 'Utility Provider',
    fallbackMessage: '',
  });
  assert.deepEqual(validatedKinds, ['continuity']);
}

{
  const controller = createLoredeckCreatorGenerationSettingsController({
    validateProvider: () => ({ ok: false, message: 'Utility Provider is missing a model.' }),
  });
  assert.deepEqual(controller.getSplitRetryProvider({ useUtilityProviderForSplitRetries: true }), {
    providerKind: 'lore',
    label: 'Reasoning Provider',
    fallbackMessage: 'Utility Provider is missing a model.',
  });
}

console.log('Deck Maker generation settings controller tests passed.');
