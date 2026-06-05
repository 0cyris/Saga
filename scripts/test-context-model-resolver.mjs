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

const YEAR_7_DECK_ID = 'hp-year-7-deathly-hallows';
const MINISTRY_FALLS_ANCHOR_ID = 'hp.y7.ministry_falls';

const state = {
  loredeckStack: [
    { packId: YEAR_7_DECK_ID, enabled: true, priority: 100, addedAt: 0 },
  ],
  loredeckContexts: {
    [YEAR_7_DECK_ID]: {
      packId: YEAR_7_DECK_ID,
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
  targetPackIds: [YEAR_7_DECK_ID],
  sourceText: 'The story is set after the Ministry falls but before the final battle.',
});

const promptJson = JSON.parse(prompt);
assert.equal(promptJson.targetPacks.length, 1);
assert.ok(promptJson.targetPacks[0].candidates.length <= 24);
assert.ok(promptJson.targetPacks[0].candidates.some(candidate => candidate.candidateId === `anchor:${MINISTRY_FALLS_ANCHOR_ID}`));

const fenced = `\`\`\`json\n{"contexts":[{"packId":"${YEAR_7_DECK_ID}","status":"resolved","candidateId":"anchor:${MINISTRY_FALLS_ANCHOR_ID}","candidateType":"anchor","confidence":0.82,"reason":"The user says after the Ministry falls."}]}\n\`\`\``;
assert.equal(parseContextModelResponse(fenced).contexts.length, 1);

const resolved = resolveContextsFromModelResponse(fenced, {
  canonBoundary: 'after the Ministry falls',
  branchId: 'main',
}, {
  state,
  index,
  targetPackIds: [YEAR_7_DECK_ID],
});

assert.equal(resolved.resolvedCount, 1);
assert.equal(resolved.results[0].status, 'resolved');
assert.equal(resolved.results[0].matchType, 'model');
assert.equal(resolved.results[0].anchor.id, MINISTRY_FALLS_ANCHOR_ID);
assert.equal(resolved.results[0].patch.source, 'model');
assert.equal(resolved.proposals.length, 1);
assert.equal(resolved.proposals[0].candidateId, `anchor:${MINISTRY_FALLS_ANCHOR_ID}`);

const invented = resolveContextsFromModelResponse(`{"contexts":[{"packId":"${YEAR_7_DECK_ID}","status":"resolved","candidateId":"anchor:hp.fake.anchor","candidateType":"anchor","confidence":0.9}]}`, {}, {
  state,
  index,
  targetPackIds: [YEAR_7_DECK_ID],
});
assert.equal(invented.resolvedCount, 0);
assert.equal(invented.results[0].reason, 'model_candidate_not_found');

const inventedWithoutTargets = resolveContextsFromModelResponse(`{"contexts":[{"packId":"${YEAR_7_DECK_ID}","status":"resolved","candidateId":"anchor:hp.fake.anchor","candidateType":"anchor","confidence":0.9}]}`, {}, {
  state,
  index,
});
assert.equal(inventedWithoutTargets.resolvedCount, 0);
assert.equal(inventedWithoutTargets.results[0].reason, 'model_candidate_not_found');

const lowConfidence = resolveContextsFromModelResponse(`{"contexts":[{"packId":"${YEAR_7_DECK_ID}","status":"resolved","candidateId":"anchor:${MINISTRY_FALLS_ANCHOR_ID}","candidateType":"anchor","confidence":0.2}]}`, {}, {
  state,
  index,
  targetPackIds: [YEAR_7_DECK_ID],
});
assert.equal(lowConfidence.resolvedCount, 0);
assert.equal(lowConfidence.results[0].reason, 'model_low_confidence');

console.log('Context model resolver tests passed.');
