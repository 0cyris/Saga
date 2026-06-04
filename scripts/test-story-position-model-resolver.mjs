import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

globalThis.fetch = async (url) => {
  const filePath = fileURLToPath(url);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return JSON.parse(await readFile(filePath, 'utf8'));
    },
  };
};

const { loadStoryPositionIndexForState } = await import('../story-position-index.js');
const { __storyPositionResolverTestHooks } = await import('../story-position-resolver.js');

const {
  buildStoryPositionModelPrompt,
  parseStoryPositionModelResponse,
  resolveStoryPositionsFromModelResponse,
} = __storyPositionResolverTestHooks;

const state = {
  lorepackStack: [
    { packId: 'hp-golden-trio', enabled: true, priority: 100, addedAt: 0 },
  ],
  lorepackContexts: {
    'hp-golden-trio': {
      packId: 'hp-golden-trio',
      manualLock: false,
      source: 'unknown',
    },
  },
};

const index = await loadStoryPositionIndexForState(state, {
  registry: { packs: {} },
  force: true,
});

const prompt = buildStoryPositionModelPrompt({
  canonBoundary: 'after the Ministry falls',
  branchId: 'main',
}, {
  state,
  index,
  targetPackIds: ['hp-golden-trio'],
  sourceText: 'The story is set after the Ministry falls but before the final battle.',
});

const promptJson = JSON.parse(prompt);
assert.equal(promptJson.targetPacks.length, 1);
assert.ok(promptJson.targetPacks[0].anchors.some(anchor => anchor.id === 'hp.dh.ministry_falls'));

const fenced = '```json\n{"positions":[{"packId":"hp-golden-trio","status":"resolved","anchorId":"hp.dh.ministry_falls","confidence":0.82,"reason":"The user says after the Ministry falls."}]}\n```';
assert.equal(parseStoryPositionModelResponse(fenced).positions.length, 1);

const resolved = resolveStoryPositionsFromModelResponse(fenced, {
  canonBoundary: 'after the Ministry falls',
  branchId: 'main',
}, {
  state,
  index,
  targetPackIds: ['hp-golden-trio'],
});

assert.equal(resolved.resolvedCount, 1);
assert.equal(resolved.results[0].status, 'resolved');
assert.equal(resolved.results[0].matchType, 'model');
assert.equal(resolved.results[0].anchor.id, 'hp.dh.ministry_falls');
assert.equal(resolved.results[0].patch.source, 'model');

const invented = resolveStoryPositionsFromModelResponse('{"positions":[{"packId":"hp-golden-trio","status":"resolved","anchorId":"hp.fake.anchor","confidence":0.9}]}', {}, {
  state,
  index,
  targetPackIds: ['hp-golden-trio'],
});
assert.equal(invented.resolvedCount, 0);
assert.equal(invented.results[0].reason, 'model_anchor_not_found');

const lowConfidence = resolveStoryPositionsFromModelResponse('{"positions":[{"packId":"hp-golden-trio","status":"resolved","anchorId":"hp.dh.ministry_falls","confidence":0.2}]}', {}, {
  state,
  index,
  targetPackIds: ['hp-golden-trio'],
});
assert.equal(lowConfidence.resolvedCount, 0);
assert.equal(lowConfidence.results[0].reason, 'model_low_confidence');

console.log('Story Position model resolver tests passed.');
