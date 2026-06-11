import assert from 'node:assert/strict';

import { buildLoredeckHealthForData } from '../../src/loredecks/loredeck-health-engine.js';
import { normalizeLoredeckRegistry } from '../../src/state/lore-state-normalizers.js';
import { normalizeLoredeckLibraryPack } from '../../src/runtime/active-stack-panel.js';
import { getLoredeckTimelineRegistryCount } from '../../src/runtime/loredeck-package-helpers.js';

assert.equal(getLoredeckTimelineRegistryCount(null), 0);
assert.equal(getLoredeckTimelineRegistryCount(undefined), 0);
assert.equal(getLoredeckTimelineRegistryCount({}), 0);
assert.equal(getLoredeckTimelineRegistryCount({ anchors: null, windows: null }), 0);
assert.equal(getLoredeckTimelineRegistryCount({ anchors: [{ id: 'arc.start' }] }), 1);

const nullTimelinePack = normalizeLoredeckLibraryPack({
  packId: 'null-timeline-pack',
  type: 'custom',
  title: 'Null Timeline Pack',
  timelineRegistry: null,
});

assert.equal(nullTimelinePack.packId, 'null-timeline-pack');
assert.equal(nullTimelinePack.timelineRegistry, undefined);
assert.equal(nullTimelinePack.timelineRegistryIssue?.code, 'malformed_timeline_registry');

const malformedTimelinePack = normalizeLoredeckLibraryPack({
  packId: 'malformed-timeline-pack',
  type: 'custom',
  title: 'Malformed Timeline Pack',
  timelineRegistry: {
    anchors: null,
    windows: 'not an array',
  },
});

assert.equal(malformedTimelinePack.timelineRegistry, undefined);
assert.equal(malformedTimelinePack.timelineRegistryIssue?.code, 'malformed_timeline_registry');
assert.match(malformedTimelinePack.timelineRegistryIssue.reason, /anchors|windows/);

const registry = normalizeLoredeckRegistry({
  schemaVersion: 1,
  packs: {
    'null-timeline-pack': {
      packId: 'null-timeline-pack',
      type: 'custom',
      title: 'Null Timeline Pack',
      manifestData: {
        id: 'null-timeline-pack',
        type: 'custom',
        title: 'Null Timeline Pack',
        entrySchemaVersion: 3,
        files: [],
      },
      timelineRegistry: null,
      entryOverrides: {
        'null-timeline-entry': {
          schemaVersion: 3,
          id: 'null-timeline-entry',
          title: 'Null Timeline Entry',
          category: 'event',
          priority: 50,
          context: {
            scope: 'always',
            precision: 'global',
            label: 'Always',
          },
          retrieval: {
            activation: 'topic_or_entity',
            frequency: 'normal',
            contextBoost: 'medium',
          },
          content: {
            fact: 'This fixture keeps a malformed timeline overlay from crashing Library or Context rendering.',
            injection: 'This fixture should never crash the runtime when the timeline overlay is null.',
          },
        },
      },
    },
  },
}, { schemaVersion: 1, packs: {} });

const registryRecord = registry.packs['null-timeline-pack'];
assert.equal(registryRecord.timelineRegistry, undefined);
assert.equal(registryRecord.timelineRegistryIssue?.code, 'malformed_timeline_registry');

const persistedMarkerRegistry = normalizeLoredeckRegistry({
  schemaVersion: 1,
  packs: {
    'null-timeline-pack': {
      ...registryRecord,
      timelineRegistryIssue: {
        code: 'malformed_timeline_registry',
        reason: 'Timeline registry is null.',
      },
    },
  },
}, { schemaVersion: 1, packs: {} });
assert.equal(persistedMarkerRegistry.packs['null-timeline-pack'].timelineRegistryIssue?.code, 'malformed_timeline_registry');

const health = buildLoredeckHealthForData({
  packId: 'null-timeline-pack',
  manifest: registryRecord.manifestData,
  entryFiles: [],
  timeline: registryRecord.timelineRegistry || null,
  timelineRegistryRecord: registryRecord,
  registryRecord: null,
});

assert.equal(health.status, 'needs_review');
assert.ok(
  health.warnings.some(issue => issue.code === 'context_timeline_registry_malformed'),
  'Pack Health should report a malformed timeline overlay instead of allowing render paths to crash.'
);

console.log('Loredeck null timeline registry regression tests passed.');
