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

const { loadContextIndexForState } = await import('../context-index.js');
const { __contextResolverTestHooks } = await import('../context-resolver.js');

const {
  buildContextModelPrompt,
  parseContextModelResponse,
  resolveContextsFromModelResponse,
} = __contextResolverTestHooks;

const state = {
  loredeckStack: [
    { packId: 'hp-golden-trio', enabled: true, priority: 100, addedAt: 0 },
  ],
  loredeckContexts: {
    'hp-golden-trio': {
      packId: 'hp-golden-trio',
      manualLock: false,
      source: 'unknown',
    },
  },
};

const index = await loadContextIndexForState(state, {
  registry: { packs: {} },
  force: true,
});

const prompt = buildContextModelPrompt({
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
assert.equal(parseContextModelResponse(fenced).positions.length, 1);

const resolved = resolveContextsFromModelResponse(fenced, {
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

const invented = resolveContextsFromModelResponse('{"positions":[{"packId":"hp-golden-trio","status":"resolved","anchorId":"hp.fake.anchor","confidence":0.9}]}', {}, {
  state,
  index,
  targetPackIds: ['hp-golden-trio'],
});
assert.equal(invented.resolvedCount, 0);
assert.equal(invented.results[0].reason, 'model_anchor_not_found');

const lowConfidence = resolveContextsFromModelResponse('{"positions":[{"packId":"hp-golden-trio","status":"resolved","anchorId":"hp.dh.ministry_falls","confidence":0.2}]}', {}, {
  state,
  index,
  targetPackIds: ['hp-golden-trio'],
});
assert.equal(lowConfidence.resolvedCount, 0);
assert.equal(lowConfidence.results[0].reason, 'model_low_confidence');

console.log('Context model resolver tests passed.');
