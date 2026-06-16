import assert from 'node:assert/strict';

const {
  __storyOpenerGenerationTestHooks,
  buildStoryOpenerBrief,
  writeStoryOpenerVariants,
} = await import('../../src/story-openers/story-opener-generation.js');
const {
  buildStoryOpenerContextPacket,
} = await import('../../src/story-openers/story-opener-source.js');
const {
  __storyOpenerPanelTestHooks,
} = await import('../../src/runtime/story-opener-panel.js');
const {
  getStoryOpenerStageDescriptors,
  normalizeStoryOpenerControls,
  normalizeStoryOpenerSession,
} = await import('../../src/story-openers/story-opener-state.js');

async function withFakeStoryOpenerProvider(handler, run) {
  const restore = __storyOpenerGenerationTestHooks.setStoryOpenerRequestForTests(handler);
  try {
    return await run();
  } finally {
    restore();
  }
}

function makeBriefJson(overrides = {}) {
  return JSON.stringify({
    fandoms: ['Harry Potter'],
    context: 'Harry Potter Book 6 - January',
    premise: 'Open on Hermione noticing a strange silence.',
    proseStyle: 'Half-Blood Prince-era school mystery.',
    openingShape: 'Scene Setting',
    characterFocus: 'Hermione',
    pov: '3rd person limited',
    tense: 'past tense',
    targetLength: 'scene',
    styleGuidance: 'Close third-person narration with restrained unease.',
    lengthGuidance: 'Balanced first-message scene opener.',
    scenePlan: ['Hermione studies late', 'A strange detail interrupts her focus'],
    mustInclude: ['Hermione is under January academic pressure.'],
    freshEmphasis: ['January pressure'],
    mustAvoid: ['Do not reveal Horcrux knowledge.'],
    variantAngles: ['A angle', 'B angle', 'C angle'],
    ...overrides,
  });
}

const parsed = __storyOpenerGenerationTestHooks.parseStoryOpenerJsonResponse(`Here is the JSON:
\`\`\`json
{
  "premise": "Open on Hermione",
  "scenePlan": ["Library tension",],
  "styleGuidance": "Half-Blood Prince-era school mystery",
}
\`\`\``);
assert.equal(parsed.ok, true);
assert.equal(parsed.value.premise, 'Open on Hermione');
assert.deepEqual(parsed.value.scenePlan, ['Library tension']);

const normalizedText = __storyOpenerGenerationTestHooks.normalizeOpenerText('```text\nHermione looked up from the library table.\n```');
assert.equal(normalizedText, 'Hermione looked up from the library table.');
assert.equal(__storyOpenerGenerationTestHooks.normalizeOpenerText('{"opener":"not plain text"}'), '');
assert.equal(normalizeStoryOpenerControls({ variantCount: 5 }).variantCount, 5);
assert.equal(normalizeStoryOpenerControls({ variantCount: 9 }).variantCount, 5);
assert.equal(normalizeStoryOpenerControls({ variantCount: 0 }).variantCount, 1);
assert.equal(normalizeStoryOpenerControls({ variantsEnabled: true }).variantCount, 3);
assert.equal(normalizeStoryOpenerControls({}).openingShape, 'Scene Setting');
assert.equal(normalizeStoryOpenerControls({ openingShape: 'Scene-setting' }).openingShape, 'Scene Setting');
assert.equal(normalizeStoryOpenerControls({ pov: '1st' }).pov, '1st person');
assert.equal(normalizeStoryOpenerControls({ pov: '2nd person' }).pov, '2nd person');
assert.equal(normalizeStoryOpenerControls({ tense: 'Present' }).tense, 'present tense');
assert.equal(normalizeStoryOpenerControls({ tense: 'future tense' }).tense, 'future tense');
const missingStackContextStage = getStoryOpenerStageDescriptors({
  controls: {
    userPrompt: 'Open on Hermione.',
    context: 'Harry Potter Book 6 - January',
  },
  sourceIntent: {
    sourceMode: 'loredeck_only',
    context: 'Harry Potter Book 6 - January',
    stackItems: [],
    packIds: [],
  },
  currentStage: 'context_packet',
}).find(stage => stage.id === 'context_packet');
assert.equal(missingStackContextStage.status, 'locked');
assert.equal(missingStackContextStage.action, 'add_loredecks');
assert.equal(missingStackContextStage.actionLabel, 'Add Loredecks');
assert.match(missingStackContextStage.actionTooltip, /No active Loredecks/);

const liveStackContextStage = getStoryOpenerStageDescriptors({
  controls: {
    userPrompt: 'Open on Hermione.',
    context: 'Harry Potter Book 6 - January',
  },
  sourceIntent: {
    sourceMode: 'loredeck_only',
    context: 'Harry Potter Book 6 - January',
    stackItems: [],
    packIds: [],
  },
  currentStage: 'context_packet',
}, {
  sourceIntent: {
    sourceMode: 'loredeck_only',
    context: 'Harry Potter Book 6 - January',
    stackItems: [{ type: 'deck', packId: 'hp-opener-test', label: 'Harry Potter: Test' }],
    packIds: ['hp-opener-test'],
  },
}).find(stage => stage.id === 'context_packet');
assert.equal(liveStackContextStage.label, 'Context Packet');
assert.equal(liveStackContextStage.action, '');
assert.equal(liveStackContextStage.status, 'active');

const registry = {
  schemaVersion: 1,
  packs: {
    'hp-opener-test': {
      packId: 'hp-opener-test',
      id: 'hp-opener-test',
      type: 'generated',
      title: 'Harry Potter: Test',
      fandom: 'Harry Potter',
      manifestData: {
        id: 'hp-opener-test',
        title: 'Harry Potter: Test',
        type: 'generated',
        entrySchemaVersion: 3,
      },
      entryOverrides: {
        'hermione-library-pressure': {
          title: 'Hermione library pressure',
          fact: 'Hermione is spending January under heavy academic and personal pressure in the Hogwarts library.',
          priority: 90,
          validFrom: '1996-01-01',
          validTo: '1996-01-31',
          scope: { characters: ['Hermione'], locations: ['Hogwarts library'], topics: ['library pressure'] },
          lorePurpose: 'status_change',
        },
        'horcrux-reveal-future': {
          title: 'Horcrux reveal future',
          fact: 'Harry and Dumbledore have identified Horcruxes as Voldemort soul anchors.',
          priority: 100,
          validFrom: '1996-06-01',
          scope: { characters: ['Harry', 'Dumbledore'], topics: ['Horcruxes'] },
          lorePurpose: 'knowledge_gate',
        },
      },
    },
  },
  folders: [],
  deckPlacements: [],
  activeStack: [],
};

const state = {
  loredeckStack: [{ type: 'deck', packId: 'hp-opener-test', enabled: true, priority: 100 }],
  loredeckRegistry: registry,
  loreMatrix: [],
  loreContext: {
    sceneDate: '1996-01-15',
    canonBoundary: 'Half-Blood Prince January',
    branchId: 'main',
    timeTravelMode: 'none',
  },
  canon: {
    inUniverseDate: '1996-01-15',
    canonBoundary: 'Half-Blood Prince January',
  },
  scene: {
    location: 'Hogwarts library',
    presentCharacters: ['Hermione'],
    currentActivity: 'library pressure',
  },
};

const result = await buildStoryOpenerContextPacket({
  controls: {
    userPrompt: 'Open on Hermione in sixth year.',
    context: 'Harry Potter Book 6 - January',
    proseStyle: 'Harry Potter prose style',
  },
  sourceIntent: {
    sourceMode: 'loredeck_only',
    context: 'Harry Potter Book 6 - January',
    stackItems: [{ type: 'deck', packId: 'hp-opener-test', enabled: true, priority: 100 }],
  },
}, state, { registry });

assert.equal(result.sourceResolution.status, 'current');
assert(result.packet.fandoms.includes('Harry Potter'));
assert(result.packet.mustUse.some(fact => fact.id === 'hermione-library-pressure'), 'Current Hermione fact should be eligible.');
assert(result.packet.mustAvoid.some(fact => fact.id === 'horcrux-reveal-future'), 'Future Horcrux fact should be guarded out before its date.');

const providerSession = normalizeStoryOpenerSession({
  sessionId: 'opener-provider-test',
  controls: {
    userPrompt: 'Open on Hermione in sixth year.',
    context: 'Harry Potter Book 6 - January',
    proseStyle: 'Harry Potter prose style',
    openingShape: 'Scene Setting',
    pov: '3rd person limited',
    tense: 'past tense',
    targetLength: 'scene',
    variantCount: 3,
  },
  sourceIntent: {
    sourceMode: 'loredeck_only',
    context: 'Harry Potter Book 6 - January',
    stackItems: [{ type: 'deck', packId: 'hp-opener-test', enabled: true, priority: 100 }],
  },
});

const providerPacket = {
  context: 'Harry Potter Book 6 - January',
  contextState: { sceneDate: '1996-01-15' },
  fandoms: ['Harry Potter'],
  fresh: [],
  mustUse: [{ id: 'hermione-library-pressure', title: 'Hermione pressure', fact: 'Hermione is under January academic pressure.' }],
  supporting: [],
  mustAvoid: [{ id: 'horcrux-reveal-future', title: 'Horcrux reveal future', fact: 'Do not reveal Horcrux knowledge.' }],
};

await withFakeStoryOpenerProvider(async () => {
  throw new Error('Reasoning profile is not selected.');
}, async () => {
  const brief = await buildStoryOpenerBrief(providerSession, providerPacket, { retryDelayMs: 0 });
  assert.equal(brief.ok, false);
  assert.equal(brief.failure.code, 'provider_missing_config');
  assert.equal(brief.attempts.length, 1);
});

await withFakeStoryOpenerProvider(async () => new Promise(() => {}), async () => {
  const brief = await buildStoryOpenerBrief(providerSession, providerPacket, { retryDelayMs: 0, timeoutMs: 10 });
  assert.equal(brief.ok, false);
  assert.equal(brief.failure.code, 'provider_timeout');
  assert.equal(brief.attempts.length, 3);
  assert.match(brief.failure.message, /timed out/i);
});

await withFakeStoryOpenerProvider(async () => {
  if (!globalThis.__sagaStoryOpenerEmptyThenSuccessCalls) globalThis.__sagaStoryOpenerEmptyThenSuccessCalls = 0;
  globalThis.__sagaStoryOpenerEmptyThenSuccessCalls += 1;
  return globalThis.__sagaStoryOpenerEmptyThenSuccessCalls === 1
    ? { choices: [{ message: { content: '' } }] }
    : { choices: [{ message: { content: makeBriefJson() } }] };
}, async () => {
  globalThis.__sagaStoryOpenerEmptyThenSuccessCalls = 0;
  const brief = await buildStoryOpenerBrief(providerSession, providerPacket, { retryDelayMs: 0 });
  assert.equal(brief.ok, true);
  assert.equal(brief.attempts.length, 2);
  assert.equal(brief.attempts[0].errorCode, 'provider_empty_content');
  assert.equal(brief.brief.premise, 'Open on Hermione noticing a strange silence.');
});

await withFakeStoryOpenerProvider(async () => {
  if (!globalThis.__sagaStoryOpenerRepairCalls) globalThis.__sagaStoryOpenerRepairCalls = 0;
  globalThis.__sagaStoryOpenerRepairCalls += 1;
  return globalThis.__sagaStoryOpenerRepairCalls === 1
    ? '{ "premise": "Open on Hermione", '
    : makeBriefJson({ premise: 'Repaired brief premise.' });
}, async () => {
  globalThis.__sagaStoryOpenerRepairCalls = 0;
  const brief = await buildStoryOpenerBrief(providerSession, providerPacket, { retryDelayMs: 0 });
  assert.equal(brief.ok, true);
  assert.equal(globalThis.__sagaStoryOpenerRepairCalls, 2);
  assert.equal(brief.repairAttempted, true);
  assert.equal(brief.brief.premise, 'Repaired brief premise.');
});

await withFakeStoryOpenerProvider(async () => {
  if (!globalThis.__sagaStoryOpenerContractCalls) globalThis.__sagaStoryOpenerContractCalls = 0;
  globalThis.__sagaStoryOpenerContractCalls += 1;
  return globalThis.__sagaStoryOpenerContractCalls === 1
    ? makeBriefJson({ styleGuidance: '', scenePlan: [] })
    : makeBriefJson({ premise: 'Contract retry premise.' });
}, async () => {
  globalThis.__sagaStoryOpenerContractCalls = 0;
  const brief = await buildStoryOpenerBrief(providerSession, providerPacket, { retryDelayMs: 0 });
  assert.equal(brief.ok, true);
  assert.equal(brief.attempts.length, 2);
  assert.equal(brief.attempts[0].errorCode, 'stage_contract_failed');
  assert.equal(brief.brief.premise, 'Contract retry premise.');
});

const providerBrief = JSON.parse(makeBriefJson());

await withFakeStoryOpenerProvider(async (system, user) => {
  assert.match(system, /Use Markdown italics only where the formatting contract requires italics/);
  assert.match(user, /Spoken dialogue must always be enclosed in quotation marks/);
  assert.match(user, /internalized words or thoughts must be italicized with Markdown italics/);
  if (user.includes('Variant angle: B angle')) {
    if (!globalThis.__sagaStoryOpenerVariantBCalls) globalThis.__sagaStoryOpenerVariantBCalls = 0;
    globalThis.__sagaStoryOpenerVariantBCalls += 1;
    return globalThis.__sagaStoryOpenerVariantBCalls === 1 ? '{}' : 'Variant B prose.';
  }
  if (user.includes('Variant angle: C angle')) return 'Variant C prose.';
  return 'Variant A prose.';
}, async () => {
  globalThis.__sagaStoryOpenerVariantBCalls = 0;
  const variants = await writeStoryOpenerVariants(providerSession, providerPacket, providerBrief, { retryDelayMs: 0 });
  assert.equal(variants.ok, true);
  assert.equal(variants.variants.length, 3);
  assert.equal(variants.failures.length, 0);
  assert.equal(variants.variants.find(item => item.variantIndex === 1).text, 'Variant B prose.');
  assert.equal(variants.attempts.filter(attempt => attempt.variantLabel === 'Variant B').length, 2);
});

await withFakeStoryOpenerProvider(async (_system, user) => {
  if (user.includes('Variant angle: B angle')) return '{}';
  if (user.includes('Variant angle: C angle')) return 'Variant C prose.';
  return 'Variant A prose.';
}, async () => {
  const variants = await writeStoryOpenerVariants(providerSession, providerPacket, providerBrief, { retryDelayMs: 0 });
  assert.equal(variants.ok, true);
  assert.equal(variants.variants.length, 2);
  assert.equal(variants.failures.length, 1);
  assert.deepEqual(variants.failedVariantIndexes, [1]);
  assert.equal(variants.partialFailure.code, 'draft_variants_partial_failed');
});

await withFakeStoryOpenerProvider(async (_system, user) => {
  if (user.includes('Variant angle: B angle')) return new Promise(() => {});
  if (user.includes('Variant angle: C angle')) return 'Variant C prose.';
  return 'Variant A prose.';
}, async () => {
  const variants = await writeStoryOpenerVariants(providerSession, providerPacket, providerBrief, { retryDelayMs: 0, timeoutMs: 10 });
  assert.equal(variants.ok, true);
  assert.equal(variants.variants.length, 2);
  assert.deepEqual(variants.failedVariantIndexes, [1]);
  assert.equal(variants.failures[0].code, 'provider_timeout');
});

await withFakeStoryOpenerProvider(async () => '{}', async () => {
  const variants = await writeStoryOpenerVariants(providerSession, providerPacket, providerBrief, { retryDelayMs: 0 });
  assert.equal(variants.ok, false);
  assert.equal(variants.failure.code, 'draft_variants_failed');
  assert.deepEqual(variants.failedVariantIndexes, [0, 1, 2]);
  assert.match(variants.failure.message, /No opener variants were usable/);
});

const retryingSession = normalizeStoryOpenerSession({
  sessionId: 'opener-retrying-state-test',
  controls: {
    userPrompt: 'Open on Hermione.',
    context: 'Harry Potter Book 6 - January',
  },
  sourceIntent: {
    stackItems: [{ type: 'deck', packId: 'hp-opener-test', enabled: true, priority: 100 }],
  },
  currentStage: 'opener_brief',
  generationRuns: {
    run1: {
      id: 'run1',
      stage: 'opener_brief',
      status: 'retrying',
      label: 'Retrying Opener Brief, attempt 2 of 3',
      message: 'Retrying after provider_empty_content.',
      attempts: [{ stage: 'opener_brief', attempt: 1, maxAttempts: 3, status: 'error', errorCode: 'provider_empty_content' }],
    },
  },
  activeGeneration: { id: 'run1', stage: 'opener_brief', status: 'retrying' },
});
assert.equal(retryingSession.activeGeneration.status, 'retrying');
assert.equal(retryingSession.generationRuns.run1.attempts.length, 1);
const retryingStage = getStoryOpenerStageDescriptors(retryingSession).find(stage => stage.id === 'opener_brief');
assert.equal(retryingStage.status, 'generating');

const staleRunSession = normalizeStoryOpenerSession({
  sessionId: 'opener-stale-run-test',
  controls: {
    userPrompt: 'Open on Hermione.',
    context: 'Harry Potter Book 6 - January',
  },
  currentStage: 'review_copy',
  variants: [{ id: 'variant-a', label: 'Variant A', text: 'Hermione checked the corridor.', status: 'selected' }],
  generationRuns: {
    run1: {
      id: 'run1',
      stage: 'context_packet',
      status: 'running',
      label: 'Building Context Packet',
      message: 'Resolving active Loredecks, Context, and guardrails.',
      startedAt: 1000,
      updatedAt: 1000,
    },
  },
  activeGeneration: { id: 'run1', stage: 'context_packet', status: 'running', startedAt: 1000, updatedAt: 1000 },
});
const recovered = __storyOpenerPanelTestHooks.recoverStoryOpenerInterruptedActiveGeneration(staleRunSession, {
  now: () => 1000 + (11 * 60 * 1000),
  persist: false,
});
assert.equal(recovered.recovered, true);
assert.equal(recovered.session.activeGeneration, undefined);
assert.equal(recovered.session.generationRuns.run1.status, 'interrupted');
assert.equal(recovered.session.variants.length, 1);

console.log('Story Opener pipeline tests passed.');
