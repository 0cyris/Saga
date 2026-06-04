import assert from 'node:assert/strict';
import { __lorepackLoaderTestHooks } from '../lorepack-loader.js';

const {
  createHealth,
  finalizeHealth,
  normalizeTimelineRegistryForHealth,
  createTimelineHealthIndex,
  analyzeTimelineWindowHealth,
  analyzeTimelineDateDerivedSortKeys,
  analyzeManifestFileListHealth,
  buildLorepackHealthForData,
  normalizeLorepackEntryForSchemaV3,
  repairLorepackEntryForHealth,
  analyzeEntries,
  analyzeEntryPositionHealth,
  normalizeTagRegistryForHealth,
  createTagRegistryHealthIndex,
  analyzeTagRegistryDefinitionHealth,
  analyzeEntryTagHealth,
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

const schemaHealth = createHealth('schema-pack');
analyzeEntries(schemaHealth, [{
  file: 'v3.json',
  schemaVersion: 3,
  entries: [
    {
      schemaVersion: 3,
      id: 'bad_v3_entry',
      title: 'Bad V3 Entry',
      category: 'event',
      date: { validFrom: '1991-09-01' },
      position: {
        scope: 'window',
        sortKeyFrom: 1,
        sortKeyTo: 365,
        precision: 'date_window',
        windowKind: 'wide',
        label: 'Wide bad',
      },
      content: { fact: 'Bad.', injection: 'Bad.' },
      retrieval: {
        activation: 'position_or_topic',
        frequency: 'normal',
        positionalBoost: 'medium',
      },
    },
    {
      schemaVersion: 3,
      id: 'missing_v3_shape',
      title: 'Missing V3 Shape',
      category: 'event',
      content: { fact: 'Bad.', injection: '' },
    },
  ],
}], {
  stats: {
    entryCount: 999,
    categoryCounts: { event: 1 },
  },
});
finalizeHealth(schemaHealth);
const schemaErrorCodes = schemaHealth.errors.map(issue => issue.code);
const schemaWarningCodes = schemaHealth.warnings.map(issue => issue.code);
assert.ok(schemaErrorCodes.includes('schema_v3_legacy_timing_fields'));
assert.ok(schemaErrorCodes.includes('schema_v3_missing_position'));
assert.ok(schemaErrorCodes.includes('schema_v3_missing_retrieval'));
assert.ok(schemaErrorCodes.includes('schema_v3_missing_content'));
assert.ok(schemaWarningCodes.includes('schema_v3_wide_lore_retrieval'));
assert.ok(schemaWarningCodes.includes('manifest_entry_count_mismatch'));
assert.ok(schemaWarningCodes.includes('manifest_category_counts_mismatch'));
assert.equal(schemaHealth.summary.schemaV3EntryCount, 2);
assert.equal(schemaHealth.summary.manifestStatsMismatchCount, 2);
assert.equal(schemaHealth.status, 'has_errors');

const manifestHealth = createHealth('manifest-pack');
analyzeManifestFileListHealth(manifestHealth, {
  files: ['entries/a.json', 'entries/a.json'],
});
finalizeHealth(manifestHealth);
assert.equal(manifestHealth.warnings[0].code, 'duplicate_manifest_file');
assert.equal(manifestHealth.status, 'needs_review');

const dateDerivedHealth = createHealth('timeline-pack');
const dateDerivedTimeline = createTimelineHealthIndex({
  ...normalizeTimelineRegistryForHealth({
    sortKeyScale: 'date-derived-day',
    anchors: [
      { id: 'hp.start', sortKey: 1, dateRange: { from: '1991-09-01', to: '1991-09-03' } },
      { id: 'hp.end', sortKey: 2, dateRange: { from: '1991-09-10', to: '1991-09-12' } },
    ],
    windows: [
      { id: 'hp.window', anchorFrom: 'hp.start', anchorTo: 'hp.end', sortKeyFrom: 1, sortKeyTo: 2 },
    ],
  }, 'timeline-pack'),
  packId: 'timeline-pack',
  timelineRef: 'timeline.json',
  hasTimelineRef: true,
});
analyzeTimelineDateDerivedSortKeys(dateDerivedHealth, dateDerivedTimeline);
finalizeHealth(dateDerivedHealth);
const dateDerivedWarningCodes = dateDerivedHealth.warnings.map(issue => issue.code);
assert.ok(dateDerivedWarningCodes.includes('timeline_anchor_sortkey_mismatch'));
assert.ok(dateDerivedWarningCodes.includes('timeline_window_sortkey_mismatch'));
assert.equal(dateDerivedHealth.status, 'needs_review');

const repairedV3Entry = repairLorepackEntryForHealth({
  schemaVersion: 3,
  id: 'wide_override',
  title: 'Wide Override',
  category: 'event',
  fact: 'Legacy top-level fact.',
  date: { validFrom: '1991-09-01' },
  publicVersion: 'Legacy public version.',
  position: {
    scope: 'global',
    sortKeyFrom: 1,
    sortKeyTo: 3650,
    precision: 'series_window',
    windowKind: 'series',
    label: 'Full series',
  },
  retrieval: {
    activation: 'position_or_topic',
    frequency: 'normal',
    positionalBoost: 'medium',
  },
  content: {
    fact: 'Content fact.',
    injection: 'Content injection.',
  },
}, { forceSchemaVersion: 3 });

assert.equal(repairedV3Entry.schemaVersion, 3);
assert.equal(Object.prototype.hasOwnProperty.call(repairedV3Entry, 'fact'), false);
assert.equal(Object.prototype.hasOwnProperty.call(repairedV3Entry, 'date'), false);
assert.equal(Object.prototype.hasOwnProperty.call(repairedV3Entry, 'publicVersion'), false);
assert.equal(repairedV3Entry.content.fact, 'Content fact.');
assert.equal(repairedV3Entry.retrieval.activation, 'topic_or_entity');
assert.equal(repairedV3Entry.retrieval.frequency, 'low');
assert.equal(repairedV3Entry.retrieval.positionalBoost, 'low');

const normalizedV3Entry = normalizeLorepackEntryForSchemaV3({
  schemaVersion: 3,
  id: 'normalized_override',
  title: 'Normalized Override',
  category: 'event',
  fact: 'Fallback fact.',
  content: { injection: 'Injection only.' },
});
assert.equal(normalizedV3Entry.content.fact, 'Fallback fact.');
assert.equal(normalizedV3Entry.content.injection, 'Injection only.');
assert.equal(Object.prototype.hasOwnProperty.call(normalizedV3Entry, 'fact'), false);

const draftHealth = buildLorepackHealthForData({
  packId: 'draft-pack',
  manifest: {
    id: 'draft-pack',
    entrySchemaVersion: 3,
    files: ['entries/core.json'],
    stats: {
      entryCount: 1,
      categoryCounts: { event: 1 },
    },
    registries: { timeline: 'timeline.json' },
  },
  timeline: {
    anchors: [
      { id: 'draft.start', sortKey: 100 },
      { id: 'draft.end', sortKey: 200 },
    ],
    windows: [
      { id: 'draft.window', anchorFrom: 'draft.start', anchorTo: 'draft.end', sortKeyFrom: 100, sortKeyTo: 200 },
    ],
  },
  entryFiles: [{
    file: 'entries/core.json',
    schemaVersion: 3,
    entries: [{
      schemaVersion: 3,
      id: 'draft_entry',
      title: 'Draft Entry',
      category: 'event',
      priority: 50,
      position: {
        scope: 'window',
        validFromAnchor: 'draft.start',
        validToAnchor: 'draft.end',
        sortKeyFrom: 100,
        sortKeyTo: 200,
        precision: 'anchor_window',
        windowKind: 'bounded',
        label: 'Draft window',
      },
      retrieval: {
        activation: 'topic_or_entity',
        frequency: 'normal',
        positionalBoost: 'medium',
      },
      content: {
        fact: 'Draft fact.',
        injection: 'Draft injection.',
      },
    }],
  }],
});
assert.equal(draftHealth.status, 'good');
assert.equal(draftHealth.summary.schemaV3EntryCount, 1);
assert.equal(draftHealth.summary.manifestStatsMismatchCount, 0);

const customTimelineOverlayHealth = buildLorepackHealthForData({
  packId: 'custom-timeline-pack',
  manifest: {
    id: 'custom-timeline-pack',
    entrySchemaVersion: 3,
    files: ['entries/custom-timeline.json'],
    registries: { timeline: 'timeline.json' },
    stats: {
      entryCount: 1,
      categoryCounts: { event: 1 },
    },
  },
  timeline: {
    anchors: [
      { id: 'story.source_start', sortKey: 10 },
    ],
    windows: [],
  },
  registryRecord: {
    packId: 'custom-timeline-pack',
    timelineRegistry: {
      anchors: [
        { id: 'story.custom_end', label: 'Custom Ending', sortKey: 20 },
      ],
      windows: [
        { id: 'story.custom_window', anchorFrom: 'story.source_start', anchorTo: 'story.custom_end', sortKeyFrom: 10, sortKeyTo: 20 },
      ],
    },
  },
  entryFiles: [{
    file: 'entries/custom-timeline.json',
    schemaVersion: 3,
    entries: [{
      schemaVersion: 3,
      id: 'custom_timeline_entry',
      title: 'Custom Timeline Entry',
      category: 'event',
      position: {
        scope: 'window',
        validFromAnchor: 'story.source_start',
        validToAnchor: 'story.custom_end',
        sortKeyFrom: 10,
        sortKeyTo: 20,
        precision: 'anchor_window',
        windowKind: 'bounded',
        label: 'Custom timeline window',
      },
      retrieval: {
        activation: 'topic_or_entity',
        frequency: 'normal',
        positionalBoost: 'medium',
      },
      content: {
        fact: 'Custom timeline fact.',
        injection: 'Custom timeline injection.',
      },
    }],
  }],
});
assert.equal(customTimelineOverlayHealth.status, 'good');
assert.equal(customTimelineOverlayHealth.summary.timelineAnchorCount, 2);
assert.equal(customTimelineOverlayHealth.summary.timelineWindowCount, 1);
assert.equal(customTimelineOverlayHealth.summary.brokenAnchorReferenceCount, 0);

const tagHealth = buildLorepackHealthForData({
  packId: 'tag-pack',
  manifest: {
    id: 'tag-pack',
    type: 'custom',
    files: ['entries/tags.json'],
    registries: { tags: 'tags.json' },
    stats: {
      entryCount: 2,
      categoryCounts: { character: 1, event: 1 },
    },
  },
  tagRegistry: {
    schemaVersion: 1,
    tags: {
      'character:nami': {
        label: 'Nami',
        aliases: ['navigator', 'cat burglar'],
      },
      'deprecated:arlong-crew': {
        label: 'Old Arlong Crew',
        deprecated: true,
        replacement: 'faction:arlong-crew',
        aliases: ['fishmen'],
      },
      'faction:arlong-crew': {
        label: 'Arlong Crew',
        aliases: ['fishmen', 'crew'],
      },
      'unused:tag': {
        label: 'Unused Tag',
      },
      'badtag:': {
        label: 'Bad Tag',
      },
    },
  },
  entryFiles: [{
    file: 'entries/tags.json',
    entries: [
      {
        id: 'nami_entry',
        title: 'Nami Entry',
        category: 'character',
        tags: ['character:nami', 'missing:tag', 'bad tag'],
      },
      {
        id: 'arlong_entry',
        title: 'Arlong Entry',
        category: 'event',
        tags: ['deprecated:arlong-crew'],
      },
    ],
  }],
});
const tagWarningCodes = tagHealth.warnings.map(issue => issue.code);
const tagSuggestionCodes = tagHealth.suggestions.map(issue => issue.code);
assert.ok(tagWarningCodes.includes('undefined_tag'));
assert.ok(tagWarningCodes.includes('deprecated_tag_used'));
assert.ok(tagWarningCodes.includes('duplicate_tag_alias'));
assert.ok(tagWarningCodes.includes('malformed_tag_namespace'));
assert.ok(tagSuggestionCodes.includes('orphaned_tag_definition'));
assert.equal(tagHealth.summary.tagRegistryTagCount, 5);
assert.equal(tagHealth.summary.undefinedTagCount, 2);
assert.equal(tagHealth.summary.deprecatedTagUsageCount, 1);
assert.equal(tagHealth.summary.duplicateTagAliasCount, 1);
assert.equal(tagHealth.summary.orphanedTagCount, 2);
assert.equal(tagHealth.status, 'needs_review');

const missingRegistryHealth = createHealth('missing-tag-registry');
analyzeEntryTagHealth(missingRegistryHealth, [{
  file: 'entries.json',
  entries: [{
    id: 'tagged_without_registry',
    title: 'Tagged Without Registry',
    tags: ['character:nami'],
  }],
}], createTagRegistryHealthIndex({
  packId: 'missing-tag-registry',
  sourceRegistry: null,
  customRegistry: null,
}), { id: 'missing-tag-registry' });
finalizeHealth(missingRegistryHealth);
assert.equal(missingRegistryHealth.status, 'good');
assert.equal(missingRegistryHealth.suggestions[0].code, 'tag_registry_missing');

console.log('Lorepack position health tests passed.');
