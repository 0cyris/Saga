import assert from 'node:assert/strict';

import { __contextDetectionTestHooks } from '../lore-generator.js';

const {
  inferContextBriefLocallyFromMessages,
  buildLoreContextFromContextBrief,
  buildResolverContextFromContextBrief,
} = __contextDetectionTestHooks;

const onePieceBrief = inferContextBriefLocallyFromMessages(`
[1] User: Let's start during the Arlong Park Arc, chapter 82.
[2] Assistant: This is after Nami asks Luffy for help. Saga: East Blue. Island: Cocoyasi.
`, {
  loreContext: {
    sceneDate: 'Saturday, Jan 25, 1997',
    canonBoundary: 'Old Harry Potter context',
    branchId: 'main',
    timeTravelMode: 'none',
  },
}, { updatedAt: 1000 });

assert.equal(onePieceBrief.source, 'local_alias');
assert.equal(onePieceBrief.status.state, 'fallback');
assert.equal(onePieceBrief.status.fallbackUsed, true);
assert.equal(onePieceBrief.updatedAt, 1000);
assert.equal(onePieceBrief.signals.arc, 'Arlong Park');
assert.equal(onePieceBrief.signals.chapter, '82');
assert.deepEqual(onePieceBrief.signals.coordinates, {
  saga: 'East Blue',
  island: 'Cocoyasi',
});
assert.ok(onePieceBrief.signals.positionPhrases.some(phrase => /after Nami asks Luffy/i.test(phrase)));
assert.ok(onePieceBrief.signals.eventLabels.some(label => /Nami asks Luffy/i.test(label)));

const onePieceLegacy = buildLoreContextFromContextBrief(onePieceBrief, {
  sceneDate: 'Saturday, Jan 25, 1997',
  canonBoundary: 'Old Harry Potter context',
  branchId: 'main',
});
assert.equal(onePieceLegacy.sceneDate, '');
assert.equal(onePieceLegacy.canonBoundary, '');

const onePieceResolver = buildResolverContextFromContextBrief(onePieceBrief, onePieceLegacy);
assert.equal(onePieceResolver.arc, 'Arlong Park');
assert.equal(onePieceResolver.chapter, '82');
assert.deepEqual(onePieceResolver.coordinates, {
  saga: 'East Blue',
  island: 'Cocoyasi',
});

const trekBrief = inferContextBriefLocallyFromMessages(`
[1] User: Star Trek TNG S05E02 Darmok. Stardate 45047.2.
[2] Assistant: Series: TNG. This is during the Darmok mission.
`, {}, { updatedAt: 2000 });

assert.equal(trekBrief.signals.season, '5');
assert.equal(trekBrief.signals.episode, '2');
assert.equal(trekBrief.signals.stardate, '45047.2');
assert.equal(trekBrief.signals.coordinates.series, 'TNG');
assert.ok(trekBrief.signals.fandomHints.includes('tng'));
assert.ok(trekBrief.signals.eventLabels.some(label => /Darmok/i.test(label)));

const trekResolver = buildResolverContextFromContextBrief(trekBrief, {});
assert.equal(trekResolver.season, '5');
assert.equal(trekResolver.episode, '2');
assert.equal(trekResolver.stardate, '45047.2');
assert.deepEqual(trekResolver.coordinates, { series: 'TNG' });

const preservedBrief = inferContextBriefLocallyFromMessages('No new timeline signals here.', {
  loreContext: {
    sceneDate: 'Saturday, Mar 1, 1997',
    canonBoundary: 'After Ron is poisoned',
    branchId: 'main',
    timeTravelMode: 'none',
  },
}, { updatedAt: 3000 });

assert.equal(preservedBrief.signals.sceneDate, 'Saturday, Mar 1, 1997');
assert.equal(preservedBrief.signals.canonBoundary, 'After Ron is poisoned');
assert.equal(preservedBrief.uncertainty.level, 'medium');

console.log('Context local extraction tests passed.');
