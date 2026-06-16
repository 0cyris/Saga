import assert from 'node:assert/strict';

const {
  __storyOpenerGenerationTestHooks,
} = await import('../../src/story-openers/story-opener-generation.js');
const {
  buildStoryOpenerContextPacket,
} = await import('../../src/story-openers/story-opener-source.js');
const {
  getStoryOpenerStageDescriptors,
  normalizeStoryOpenerControls,
} = await import('../../src/story-openers/story-opener-state.js');

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

console.log('Story Opener pipeline tests passed.');
