import assert from 'node:assert/strict';
import {
  createLoredeckCreatorResetController,
  getLoredeckCreatorResetAnchor,
} from '../../src/loredecks/loredeck-creator-reset-controller.js';

assert.equal(getLoredeckCreatorResetAnchor('scope', {}), 'intake');
assert.equal(getLoredeckCreatorResetAnchor('scope', { brief: { title: 'Arc' } }), 'scope-brief');
assert.equal(getLoredeckCreatorResetAnchor('context', {}), 'context-plan');
assert.equal(getLoredeckCreatorResetAnchor('unknown', {}), 'current-task');

function makeJob(overrides = {}) {
  return {
    jobId: 'creator_one_piece_arlong',
    approved: true,
    brief: { title: 'Arlong Park Arc' },
    outline: { titleBatches: [{ id: 'characters-pressure' }] },
    outlineApproved: true,
    titleDrafts: [{ titleId: 'nami-secret-buyback-bargain', title: 'Nami secret buyback bargain' }],
    approvedTitleDraftIds: ['nami-secret-buyback-bargain'],
    planningBatchAcceptedIds: ['characters-pressure'],
    generatedPackId: 'generated-one-piece-arlong',
    draftChanges: [{ changeId: 'draft-entry', source: 'loredeck_creator', targetKind: 'entry' }],
    entryDraftCount: 1,
    coverageFinalizeAcknowledgement: { mode: 'finalize_anyway' },
    activeGeneration: null,
    ...overrides,
  };
}

function makeGeneratedPack(overrides = {}) {
  return {
    packId: 'generated-one-piece-arlong',
    type: 'generated',
    manifestData: { id: 'generated-one-piece-arlong' },
    entryOverrides: {
      'creator-entry': {
        id: 'creator-entry',
        category: 'event',
        extensions: { sagaLoredeckCreator: { jobId: 'creator_one_piece_arlong' } },
      },
      'manual-entry': {
        id: 'manual-entry',
        category: 'knowledge',
        content: 'Manual note.',
      },
    },
    pendingChanges: [
      { changeId: 'creator-planning', source: 'loredeck_creator', targetKind: 'tag' },
      { changeId: 'creator-entry', source: 'loredeck_creator', targetKind: 'entry', affectedEntryIds: ['creator-entry'] },
      { changeId: 'manual-entry', source: 'manual', targetKind: 'entry', affectedEntryIds: ['manual-entry'] },
    ],
    healthStatus: 'warning',
    healthIssueStates: { issue: { status: 'open' } },
    stats: { entryCount: 2, categoryCounts: { event: 1, knowledge: 1 } },
    ...overrides,
  };
}

function makeHarness({ job = makeJob(), pack = makeGeneratedPack(), confirmResults = [true], hydratePayload, removeLibraryResult = { ok: true } } = {}) {
  const calls = {
    confirms: [],
    toasts: [],
    removedFromStack: [],
    removedLibrary: [],
    clearedCaches: [],
    clearedSelected: [],
    upserts: [],
    setJobs: [],
    refreshes: [],
    scrolled: [],
    frameCallbacks: 0,
    warnings: [],
    embeddedManifests: [],
  };
  let currentJob = job;
  const controller = createLoredeckCreatorResetController({
    getCurrentJob: () => currentJob,
    getActiveGeneration: current => current.activeGeneration || null,
    getLoredeckDefinition: packId => (packId === pack?.packId ? pack : null),
    getFreshPack: (_packId, fallback) => fallback,
    isGeneratedPack: candidate => candidate?.type === 'generated',
    isVirtualPack: candidate => candidate?.virtual === true,
    removeGeneratedPackFromStack: packId => calls.removedFromStack.push(packId),
    removeLibraryPack: (packId, options) => {
      calls.removedLibrary.push({ packId, options });
      return removeLibraryResult;
    },
    clearPackCaches: (packId, options) => calls.clearedCaches.push({ packId, options }),
    clearSelectedPackIfMatches: packId => calls.clearedSelected.push(packId),
    hydratePayload: hydratePayload || (candidate => candidate),
    buildEmbeddedManifest: (manifest, candidate) => {
      calls.embeddedManifests.push({ manifest, packId: candidate.packId });
      return { ...manifest, embedded: true };
    },
    upsertLibraryPack: candidate => {
      calls.upserts.push(candidate);
      return { ok: true };
    },
    setCurrentJob: (next, options) => {
      currentJob = next;
      calls.setJobs.push({ next, options });
      return next;
    },
    clearCanonCache: () => calls.refreshes.push('clearCanon'),
    clearContextCache: () => calls.refreshes.push('clearContext'),
    refreshLoredeckSurfaces: options => calls.refreshes.push({ surface: 'loredecks', options }),
    refreshPanelBody: options => calls.refreshes.push({ surface: 'runtime', options }),
    refreshWorkbenchBody: options => calls.refreshes.push({ surface: 'workbench', options }),
    scrollWorkbenchToAnchor: anchor => calls.scrolled.push(anchor),
    confirmAction: async (title, message, options) => {
      calls.confirms.push({ title, message, options });
      return confirmResults.shift() ?? false;
    },
    toast: (message, tone) => calls.toasts.push({ message, tone }),
    warn: (message, error) => calls.warnings.push({ message, error }),
    requestAnimationFrame: callback => {
      calls.frameCallbacks += 1;
      callback();
    },
  });
  return { controller, calls, getJob: () => currentJob };
}

{
  const { controller, calls } = makeHarness({ job: makeJob({ activeGeneration: { id: 'running' } }) });
  assert.equal(await controller.handleResetToStep('titles'), false);
  assert.deepEqual(calls.toasts.at(-1), {
    message: 'Cancel or finish the current Deck Maker generation before resetting.',
    tone: 'warning',
  });
  assert.equal(calls.confirms.length, 0);
}

{
  const { controller, calls } = makeHarness({
    job: { approved: true, brief: { title: 'Arc' }, titleDrafts: [{ titleId: 'one' }] },
    pack: null,
  });
  assert.equal(await controller.handleResetToStep('titles'), false);
  assert.deepEqual(calls.toasts.at(-1), {
    message: 'No later Deck Maker data exists after Title Pass.',
    tone: 'info',
  });
  assert.equal(calls.confirms.length, 0);
}

{
  const { controller, calls, getJob } = makeHarness();
  assert.equal(await controller.handleResetToStep('titles'), true);
  assert.equal(calls.confirms[0].title, 'Reset to Title Pass?');
  assert.deepEqual(calls.removedFromStack, ['generated-one-piece-arlong']);
  assert.deepEqual(calls.removedLibrary, [{
    packId: 'generated-one-piece-arlong',
    options: { clearCreatorProjects: false },
  }]);
  assert.deepEqual(calls.clearedCaches, [{
    packId: 'generated-one-piece-arlong',
    options: { clearDraftCache: true },
  }]);
  assert.deepEqual(calls.clearedSelected, ['generated-one-piece-arlong']);
  assert.equal(getJob().generatedPackId, '');
  assert.equal(getJob().entryDraftCount, 0);
  assert.equal(getJob().coverageFinalizeAcknowledgement, null);
  assert.deepEqual(calls.scrolled, ['title-sets', 'title-sets']);
  assert.equal(calls.frameCallbacks, 1);
  assert.deepEqual(calls.toasts.at(-1), {
    message: 'Reset to Title Pass.',
    tone: 'success',
  });
}

{
  const virtualPack = makeGeneratedPack({ virtual: true });
  const { controller, calls, getJob } = makeHarness({ pack: virtualPack });
  assert.equal(await controller.handleResetToStep('context'), true);
  assert.equal(calls.removedLibrary.length, 0, 'Resetting to Context Plan should preserve the Generated shell.');
  assert.equal(calls.upserts.length, 1);
  assert.equal(calls.upserts[0].manifestData.embedded, true, 'Virtual Generated packs should rebuild embedded manifest data after reset.');
  assert.deepEqual(Object.keys(calls.upserts[0].entryOverrides), ['manual-entry']);
  assert.equal(calls.upserts[0].healthStatus, 'draft');
  assert.deepEqual(calls.clearedCaches.at(-1), {
    packId: 'generated-one-piece-arlong',
    options: { clearDraftCache: true },
  });
  assert.equal(getJob().generatedPackId, 'generated-one-piece-arlong');
  assert.equal(getJob().entryDraftCount, 0);
  assert.deepEqual(calls.scrolled, ['context-plan', 'context-plan']);
}

{
  const missingPayload = Object.assign(new Error('Payload not found'), { status: 404 });
  const { controller, calls, getJob } = makeHarness({
    confirmResults: [true, true],
    hydratePayload: () => { throw missingPayload; },
  });
  assert.equal(await controller.handleResetToStep('context'), true);
  assert.equal(calls.confirms.length, 2, 'Missing payload fallback should ask for a second confirmation.');
  assert.equal(calls.confirms[1].title, 'Generated Loredeck Payload Missing');
  assert.deepEqual(calls.removedFromStack, ['generated-one-piece-arlong']);
  assert.equal(getJob().generatedPackId, '');
  assert.deepEqual(calls.scrolled, ['title-sets', 'title-sets']);
  assert.deepEqual(calls.toasts.at(-1), {
    message: 'Reset to Title Pass.',
    tone: 'success',
  });
}

{
  const { controller, calls } = makeHarness({
    hydratePayload: () => { throw new Error('permission denied'); },
  });
  assert.equal(await controller.handleResetToStep('context'), false);
  assert.equal(calls.setJobs.length, 0);
  assert.equal(calls.upserts.length, 0);
  assert.equal(calls.toasts.at(-1).message, 'permission denied');
  assert.equal(calls.toasts.at(-1).tone, 'warning');
}

console.log('Deck Maker reset controller tests passed.');
