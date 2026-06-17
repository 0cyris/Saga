import assert from 'node:assert/strict';
import {
  createLoredeckAssistantDraftHandoffController,
} from '../../src/runtime/loredeck-assistant-draft-handoff.js';

const creatorDrafts = [
  { changeId: 'draft-a', source: 'loredeck_creator', title: 'Draft A' },
  { changeId: 'draft-b', source: 'loredeck_creator', title: 'Draft B' },
];

function makeHarness({
  cache = { source: 'loredeck_creator', draftChanges: creatorDrafts },
  hydratePayload,
  queueResult = true,
  confirmResults = [true, true],
} = {}) {
  const calls = {
    toasts: [],
    warnings: [],
    freshPacks: [],
    hydrated: [],
    queued: [],
    confirms: [],
    removals: [],
    refreshes: 0,
  };
  const controller = createLoredeckAssistantDraftHandoffController({
    getDraftCacheForPack: packId => ({ packId, ...cache }),
    getDraftChanges: cached => cached.draftChanges || [],
    normalizePendingIds: ids => (Array.isArray(ids) ? ids : [ids]),
    getFreshPack: (packId, fallback) => {
      calls.freshPacks.push({ packId, fallback });
      return { ...fallback, fresh: true };
    },
    hydratePayload: async pack => {
      calls.hydrated.push(pack.packId);
      if (hydratePayload) return await hydratePayload(pack);
      return { ...pack, hydrated: true };
    },
    queuePendingChanges: (pack, selected, message) => {
      calls.queued.push({ pack, selected, message });
      return queueResult;
    },
    confirmStorage: async (label, options) => {
      calls.confirms.push({ label, options });
      return confirmResults.shift() ?? true;
    },
    updateDraftAfterRemoval: (packId, removedIds, queuedCountDelta) => {
      calls.removals.push({ packId, removedIds: [...removedIds], queuedCountDelta });
    },
    refreshDraftSurfaces: () => {
      calls.refreshes += 1;
    },
    toast: (message, tone) => calls.toasts.push({ message, tone }),
    warn: (message, error) => calls.warnings.push({ message, error: error.message }),
  });
  return { controller, calls };
}

{
  const { controller, calls } = makeHarness();
  assert.equal(await controller.queueDraftSelection({ packId: 'generated-pack' }, ['draft-a', 'missing']), true);
  assert.deepEqual(calls.freshPacks, [{ packId: 'generated-pack', fallback: { packId: 'generated-pack' } }]);
  assert.deepEqual(calls.hydrated, ['generated-pack']);
  assert.equal(calls.queued.length, 1);
  assert.deepEqual(calls.queued[0].selected.map(change => change.changeId), ['draft-a']);
  assert.equal(calls.queued[0].message, 'Sent 1 Deck Maker Lorecard draft to Pending Review.');
  assert.deepEqual(calls.confirms, [
    { label: 'Deck Maker draft handoff', options: { creator: false } },
    { label: 'Deck Maker draft review update', options: { payload: false, library: false, creator: true } },
  ]);
  assert.deepEqual(calls.removals, [{ packId: 'generated-pack', removedIds: ['draft-a'], queuedCountDelta: 1 }]);
  assert.equal(calls.refreshes, 1);
}

{
  const { controller, calls } = makeHarness({ cache: { source: 'assistant', draftChanges: [{ changeId: 'assistant-a', source: 'assistant' }] } });
  assert.equal(await controller.dropDraftSelection({ packId: 'custom-pack' }, new Set(['assistant-a'])), true);
  assert.deepEqual(calls.confirms, [
    { label: 'Assistant draft review update', options: { payload: false, library: false, creator: false } },
  ]);
  assert.deepEqual(calls.removals, [{ packId: 'custom-pack', removedIds: ['assistant-a'], queuedCountDelta: 0 }]);
  assert.deepEqual(calls.toasts.at(-1), {
    message: 'Dropped 1 assistant draft proposal.',
    tone: 'info',
  });
  assert.equal(calls.refreshes, 1);
}

{
  const { controller, calls } = makeHarness();
  assert.equal(await controller.queueDraftSelection({ packId: 'generated-pack' }, []), false);
  assert.deepEqual(calls.toasts, [{
    message: 'Select Deck Maker Lorecard drafts to send to review.',
    tone: 'warning',
  }]);
  assert.equal(calls.queued.length, 0);
  assert.equal(calls.confirms.length, 0);
}

{
  const failure = new Error('payload missing');
  const { controller, calls } = makeHarness({
    hydratePayload: async () => {
      throw failure;
    },
  });
  assert.equal(await controller.queueDraftSelection({ packId: 'generated-pack' }, ['draft-a']), false);
  assert.deepEqual(calls.warnings, [{
    message: '[Saga] Loredeck draft handoff payload hydration failed:',
    error: 'payload missing',
  }]);
  assert.deepEqual(calls.toasts, [{
    message: 'payload missing',
    tone: 'warning',
  }]);
  assert.equal(calls.queued.length, 0);
  assert.equal(calls.removals.length, 0);
}

console.log('Loredeck assistant draft handoff controller tests passed.');
