import assert from 'node:assert/strict';
import { __lorepackLoaderTestHooks } from '../lorepack-loader.js';

const {
  createHealth,
  finalizeHealth,
  normalizeTimelineRegistryForHealth,
  createTimelineHealthIndex,
  analyzeTimelineWindowHealth,
  analyzeEntryPositionHealth,
} = __lorepackLoaderTestHooks;

const timeline = createTimelineHealthIndex({
  ...normalizeTimelineRegistryForHealth({
    anchors: [
      { id: 'story.start', sortKey: 100 },
      { id: 'story.middle', sortKey: 200 },
    ],
    windows: [
      { id: 'known_reversed', anchorFrom: 'story.middle', anchorTo: 'story.start' },
      { id: 'missing_anchor', anchorFrom: 'story.start', anchorTo: 'story.unknown' },
    ],
  }, 'test-pack'),
  packId: 'test-pack',
  timelineRef: 'timeline.json',
  hasTimelineRef: true,
});

const health = createHealth('test-pack');
health.summary.timelineAnchorCount = timeline.anchors.length;
health.summary.timelineWindowCount = timeline.windows.length;

analyzeTimelineWindowHealth(health, timeline);
analyzeEntryPositionHealth(health, [{
  file: 'entries.json',
  entries: [
    {
      id: 'valid_anchor_gate',
      title: 'Valid Anchor Gate',
      category: 'event',
      fact: 'This entry references a known anchor.',
      position: { anchorId: 'story.start' },
    },
    {
      id: 'unknown_anchor_gate',
      title: 'Unknown Anchor Gate',
      category: 'event',
      fact: 'This entry references an unknown anchor.',
      position: { anchorId: 'story.missing' },
    },
    {
      id: 'reversed_window_gate',
      title: 'Reversed Window Gate',
      category: 'event',
      fact: 'This entry has a reversed window.',
      position: { validFromAnchor: 'story.middle', validToAnchor: 'story.start' },
    },
  ],
}], timeline);

finalizeHealth(health);

const warningCodes = health.warnings.map(issue => issue.code);
assert.ok(warningCodes.includes('broken_anchor_reference'));
assert.ok(warningCodes.includes('invalid_position_window'));
assert.ok(warningCodes.includes('unmatchable_position_gate'));
assert.equal(health.summary.positionGateCount, 3);
assert.equal(health.summary.brokenAnchorReferenceCount, 2);
assert.equal(health.summary.invalidPositionWindowCount, 2);
assert.equal(health.summary.unmatchablePositionGateCount, 2);
assert.equal(health.status, 'needs_review');

const noTimelineHealth = createHealth('draft-pack');
analyzeEntryPositionHealth(noTimelineHealth, [{
  file: 'draft.json',
  entries: [{
    id: 'draft_anchor_gate',
    title: 'Draft Anchor Gate',
    category: 'event',
    fact: 'This entry uses an anchor before the pack has a timeline registry.',
    position: { validFromAnchor: 'draft.start' },
  }],
}], {
  hasTimelineRef: false,
  anchorById: new Map(),
});
finalizeHealth(noTimelineHealth);

assert.equal(noTimelineHealth.summary.positionGateCount, 1);
assert.equal(noTimelineHealth.warnings.length, 0);
assert.equal(noTimelineHealth.suggestions.length, 1);
assert.equal(noTimelineHealth.suggestions[0].code, 'position_gates_without_timeline');
assert.equal(noTimelineHealth.status, 'good');

console.log('Lorepack position health tests passed.');
