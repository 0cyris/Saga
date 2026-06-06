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
const { resolveContextsWithModel, __contextResolverTestHooks } = await import('../context-resolver.js');

const {
  buildResolverContextFromState,
  buildContextResolutionCacheKey,
  normalizeContextResolutionCacheRecord,
  buildContextResolutionAudit,
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
  contextBrief: {
    summary: 'After the Ministry falls but before the final battle.',
    evidence: [{ quote: 'after the Ministry falls', signal: 'event' }],
    uncertainty: { level: 'medium', notes: ['Exact chapter is not explicit.'] },
    status: { state: 'fallback', fallbackUsed: true },
    signals: {
      positionPhrases: ['after the Ministry falls'],
      eventLabels: ['Ministry falls'],
    },
  },
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

const resolverContext = buildResolverContextFromState(state);
assert.equal(resolverContext.summary, 'After the Ministry falls but before the final battle.');
assert.equal(resolverContext.alias, 'after the Ministry falls');
assert.match(resolverContext.notes, /Evidence: after the Ministry falls/);
assert.equal(resolverContext.contextBrief.uncertainty.level, 'medium');

const prompt = buildContextModelPrompt(resolverContext, {
  state,
  index,
  targetPackIds: [YEAR_7_DECK_ID],
  sourceText: 'The story is set after the Ministry falls but before the final battle.',
});

const promptJson = JSON.parse(prompt);
assert.equal(promptJson.targetPacks.length, 1);
assert.equal(promptJson.currentStoryContext.contextBrief.summary, 'After the Ministry falls but before the final battle.');
assert.equal(promptJson.currentStoryContext.contextBrief.evidence[0].quote, 'after the Ministry falls');
assert.equal(promptJson.currentStoryContext.contextBrief.uncertainty.level, 'medium');
assert.equal(promptJson.currentStoryContext.contextBrief.status.fallbackUsed, true);
assert.ok(promptJson.targetPacks[0].candidates.length <= 24);
assert.ok(promptJson.targetPacks[0].candidates.some(candidate => candidate.candidateId === `anchor:${MINISTRY_FALLS_ANCHOR_ID}`));

const ambiguousContext = {
  summary: 'Ambiguous emotional aftermath without a named event.',
  branchId: 'main',
  contextBrief: {
    summary: 'Ambiguous emotional aftermath without a named event.',
    updatedAt: 111,
    status: { state: 'detected' },
  },
};
const ambiguousSourceText = 'The characters are shaken, but the message does not name a date, chapter, or event.';
const cacheKeyA = buildContextResolutionCacheKey(ambiguousContext, {
  state,
  index,
  targetPackIds: [YEAR_7_DECK_ID],
  sourceText: ambiguousSourceText,
});
const cacheKeyB = buildContextResolutionCacheKey({
  ...ambiguousContext,
  contextBrief: {
    summary: ambiguousContext.summary,
    updatedAt: Date.now() + 99999,
    status: { state: 'repaired', repaired: true },
  },
}, {
  state,
  index,
  targetPackIds: [YEAR_7_DECK_ID],
  sourceText: ambiguousSourceText,
});
assert.equal(cacheKeyA.key, cacheKeyB.key, 'Context cache keys should ignore detector timestamps/status for identical signals.');
const cacheKeyDifferentStack = buildContextResolutionCacheKey(ambiguousContext, {
  state,
  index: {
    ...index,
    packs: [
      ...index.packs,
      { packId: 'hp-year-6-half-blood-prince', priority: 90 },
    ],
    summary: {
      ...index.summary,
      packCount: (Number(index.summary?.packCount) || 0) + 1,
    },
  },
  targetPackIds: [YEAR_7_DECK_ID],
  sourceText: ambiguousSourceText,
});
assert.notEqual(cacheKeyA.key, cacheKeyDifferentStack.key, 'Context cache keys should change when the active stack changes.');

const cachedUnresolved = normalizeContextResolutionCacheRecord({
  ...cacheKeyA,
  status: 'unresolved',
  unresolvedCount: 1,
  sourceCharacters: ambiguousSourceText.length,
});
const cachedResolution = await resolveContextsWithModel(ambiguousContext, {
  state,
  index,
  applyLocal: false,
  applyModel: false,
  sourceText: ambiguousSourceText,
  resolutionCache: cachedUnresolved,
});
assert.equal(cachedResolution.cached, true);
assert.equal(cachedResolution.status, 'unresolved');
assert.equal(cachedResolution.reason, 'context_model_resolution_cache_hit');
assert.equal(cachedResolution.targetPackIds.length, 1);
assert.equal(cachedResolution.proposalCount, 0);
const cachedAudit = buildContextResolutionAudit(cachedResolution, ambiguousContext, {
  source: 'test_cached_reasoner',
  sourceText: ambiguousSourceText,
  createdAt: 1234,
});
assert.equal(cachedAudit.cached, true);
assert.equal(cachedAudit.counts.cached, 1);
assert.equal(cachedAudit.counts.unresolved, 1);
assert.equal(cachedAudit.counts.inFlight, 0);
assert.equal(cachedAudit.outcomes.some(outcome => outcome.reason === 'no_local_match'), true);

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
const proposedAudit = buildContextResolutionAudit({
  status: 'proposed',
  model: resolved,
  proposals: resolved.proposals,
  proposalCount: resolved.proposals.length,
  resolvedCount: resolved.resolvedCount,
  changedCount: resolved.changedCount,
  unresolvedCount: resolved.unresolvedCount,
}, resolverContext, {
  source: 'test_reasoner',
  sourceText: 'after the Ministry falls',
});
assert.equal(proposedAudit.counts.proposed, 1);
assert.equal(proposedAudit.counts.skippedLocked, 0);
assert.equal(proposedAudit.outcomes.some(outcome => outcome.phase === 'model' && outcome.candidateId === `anchor:${MINISTRY_FALLS_ANCHOR_ID}`), true);

const lockedModelResolution = resolveContextsFromModelResponse(fenced, {
  canonBoundary: 'after the Ministry falls',
  branchId: 'main',
}, {
  state: {
    ...state,
    loredeckContexts: {
      ...state.loredeckContexts,
      [YEAR_7_DECK_ID]: {
        packId: YEAR_7_DECK_ID,
        manualLock: true,
      },
    },
  },
  index,
  targetPackIds: [YEAR_7_DECK_ID],
});
assert.equal(lockedModelResolution.resolvedCount, 0);
assert.equal(lockedModelResolution.skippedCount, 1);
assert.equal(lockedModelResolution.proposals.length, 0);
assert.equal(lockedModelResolution.results[0].status, 'skipped');
assert.equal(lockedModelResolution.results[0].reason, 'manual_lock');
const lockedModelAudit = buildContextResolutionAudit({
  status: 'unresolved',
  model: lockedModelResolution,
  proposals: lockedModelResolution.proposals,
  proposalCount: lockedModelResolution.proposals.length,
  resolvedCount: lockedModelResolution.resolvedCount,
  changedCount: lockedModelResolution.changedCount,
  skippedCount: lockedModelResolution.skippedCount,
  unresolvedCount: lockedModelResolution.unresolvedCount,
}, resolverContext, {
  source: 'test_reasoner_lock',
  sourceText: 'after the Ministry falls',
});
assert.equal(lockedModelAudit.counts.skippedLocked, 1);
assert.equal(lockedModelAudit.counts.proposed, 0);
assert.equal(lockedModelAudit.outcomes.some(outcome => outcome.phase === 'model' && outcome.reason === 'manual_lock'), true);

const inFlightAudit = buildContextResolutionAudit({
  status: 'in_flight',
  reason: 'context_model_resolution_in_flight',
  targetPackIds: [YEAR_7_DECK_ID],
  local: {
    results: [],
  },
  proposals: [],
  proposalCount: 0,
  resolvedCount: 0,
  changedCount: 0,
  skippedCount: 0,
  unresolvedCount: 1,
}, resolverContext, {
  source: 'test_reasoner_in_flight',
  sourceText: 'after the Ministry falls',
});
assert.equal(inFlightAudit.inFlight, true);
assert.equal(inFlightAudit.counts.inFlight, 1);
assert.equal(inFlightAudit.counts.proposed, 0);
assert.equal(inFlightAudit.outcomes.some(outcome => outcome.phase === 'system' && outcome.reason === 'context_model_resolution_in_flight'), true);

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
