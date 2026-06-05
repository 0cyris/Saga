import assert from 'node:assert/strict';
import { __loredeckLoaderTestHooks, loadLoredeckSourceById } from '../loredeck-loader.js';

const {
  createHealth,
  finalizeHealth,
  normalizeTimelineRegistryForHealth,
  createTimelineHealthIndex,
  analyzeTimelineWindowHealth,
  analyzeTimelineDateDerivedSortKeys,
  analyzeManifestFileListHealth,
  buildLoredeckHealthForData,
  normalizeLoredeckEntryForSchemaV3,
  repairLoredeckEntryForHealth,
  analyzeEntries,
  analyzeEntryContextHealth,
  normalizeTagRegistryForHealth,
  createTagRegistryHealthIndex,
  analyzeTagRegistryDefinitionHealth,
  analyzeEntryTagHealth,
} = __loredeckLoaderTestHooks;

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
analyzeEntryContextHealth(health, [{
  file: 'entries.json',
  entries: [
    {
      id: 'valid_anchor_gate',
      title: 'Valid Anchor Gate',
      category: 'event',
      fact: 'This entry references a known anchor.',
      context: { anchorId: 'story.start' },
    },
    {
      id: 'unknown_anchor_gate',
      title: 'Unknown Anchor Gate',
      category: 'event',
      fact: 'This entry references an unknown anchor.',
      context: { anchorId: 'story.missing' },
    },
    {
      id: 'reversed_window_gate',
      title: 'Reversed Window Gate',
      category: 'event',
      fact: 'This entry has a reversed window.',
      context: { validFromAnchor: 'story.middle', validToAnchor: 'story.start' },
    },
  ],
}], timeline);

finalizeHealth(health);

const warningCodes = health.warnings.map(issue => issue.code);
assert.ok(warningCodes.includes('broken_anchor_reference'));
assert.ok(warningCodes.includes('invalid_context_window'));
assert.ok(warningCodes.includes('unmatchable_context_gate'));
assert.equal(health.summary.contextGateCount, 3);
assert.equal(health.summary.brokenAnchorReferenceCount, 2);
assert.equal(health.summary.invalidContextWindowCount, 2);
assert.equal(health.summary.unmatchableContextGateCount, 2);
assert.equal(health.status, 'needs_review');

const noTimelineHealth = createHealth('draft-pack');
analyzeEntryContextHealth(noTimelineHealth, [{
  file: 'draft.json',
  entries: [{
    id: 'draft_anchor_gate',
    title: 'Draft Anchor Gate',
    category: 'event',
    fact: 'This entry uses an anchor before the pack has a timeline registry.',
    context: { validFromAnchor: 'draft.start' },
  }],
}], {
  hasTimelineRef: false,
  anchorById: new Map(),
});
finalizeHealth(noTimelineHealth);

assert.equal(noTimelineHealth.summary.contextGateCount, 1);
assert.equal(noTimelineHealth.warnings.length, 0);
assert.equal(noTimelineHealth.suggestions.length, 1);
assert.equal(noTimelineHealth.suggestions[0].code, 'context_gates_without_timeline');
assert.equal(noTimelineHealth.status, 'good');

const sparseTimelineHealth = createHealth('sparse-timeline-pack');
const sparseTimeline = createTimelineHealthIndex({
  ...normalizeTimelineRegistryForHealth({
    anchors: [
      { id: 'sparse.start', sortKey: 100 },
      { id: 'sparse.end', sortKey: 200 },
    ],
    windows: [],
  }, 'sparse-timeline-pack'),
  packId: 'sparse-timeline-pack',
  timelineRef: 'timeline.json',
  hasTimelineRef: true,
});
sparseTimelineHealth.summary.timelineAnchorCount = sparseTimeline.anchors.length;
sparseTimelineHealth.summary.timelineWindowCount = sparseTimeline.windows.length;
analyzeEntryContextHealth(sparseTimelineHealth, [{
  file: 'entries/sparse.json',
  entries: Array.from({ length: 40 }, (_, index) => ({
    id: `sparse_gate_${index + 1}`,
    title: `Sparse Gate ${index + 1}`,
    category: 'event',
    fact: 'This entry shares the same broad Context anchors.',
    context: {
      validFromAnchor: 'sparse.start',
      validToAnchor: 'sparse.end',
      sortKeyFrom: 100,
      sortKeyTo: 200,
    },
  })),
}], sparseTimeline);
finalizeHealth(sparseTimelineHealth);

const sparseSuggestionCodes = sparseTimelineHealth.suggestions.map(issue => issue.code);
assert.ok(sparseSuggestionCodes.includes('timeline_candidate_sparse'));
assert.ok(sparseSuggestionCodes.includes('timeline_anchor_coverage_concentrated'));
assert.ok(sparseSuggestionCodes.includes('timeline_windows_missing'));
assert.equal(sparseTimelineHealth.summary.timelineCandidateCount, 2);
assert.equal(sparseTimelineHealth.summary.timelineReferencedAnchorCount, 2);
assert.equal(sparseTimelineHealth.summary.timelineDensificationSuggestionCount, 3);
assert.equal(sparseTimelineHealth.status, 'good');

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
      context: {
        scope: 'window',
        sortKeyFrom: 1,
        sortKeyTo: 365,
        precision: 'date_window',
        windowKind: 'wide',
        label: 'Wide bad',
      },
      content: { fact: 'Bad.', injection: 'Bad.' },
      retrieval: {
        activation: 'context_or_topic',
        frequency: 'normal',
        contextBoost: 'medium',
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
assert.ok(schemaErrorCodes.includes('schema_v3_missing_context'));
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

const repairedV3Entry = repairLoredeckEntryForHealth({
  schemaVersion: 3,
  id: 'wide_override',
  title: 'Wide Override',
  category: 'event',
  fact: 'Legacy top-level fact.',
  date: { validFrom: '1991-09-01' },
  publicVersion: 'Legacy public version.',
  context: {
    scope: 'global',
    sortKeyFrom: 1,
    sortKeyTo: 3650,
    precision: 'series_window',
    windowKind: 'series',
    label: 'Full series',
  },
  retrieval: {
    activation: 'context_or_topic',
    frequency: 'normal',
    contextBoost: 'medium',
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
assert.equal(repairedV3Entry.retrieval.contextBoost, 'low');

const normalizedV3Entry = normalizeLoredeckEntryForSchemaV3({
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

const draftHealth = buildLoredeckHealthForData({
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
      context: {
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
        contextBoost: 'medium',
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

const customTimelineOverlayHealth = buildLoredeckHealthForData({
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
      context: {
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
        contextBoost: 'medium',
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

const tagHealth = buildLoredeckHealthForData({
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

const generatedSource = await loadLoredeckSourceById('generated-arlong-park', {
  registry: {
    packs: {
      'generated-arlong-park': {
        packId: 'generated-arlong-park',
        type: 'generated',
        title: 'Generated Arlong Park',
        fandom: 'One Piece',
        era: 'Arlong Park Arc',
        entrySchemaVersion: 3,
        manifestData: {
          id: 'generated-arlong-park',
          type: 'generated',
          title: 'Generated Arlong Park',
          entrySchemaVersion: 3,
          files: [],
          registries: {
            timeline: 'local',
            tags: 'local',
          },
          stats: {
            entryCount: 1,
            categoryCounts: { character: 1 },
          },
        },
        timelineRegistry: {
          anchors: [
            { id: 'arlong_park.start', label: 'Arlong Park Begins', sortKey: 100 },
            { id: 'arlong_park.end', label: 'Arlong Park Ends', sortKey: 200 },
          ],
          windows: [
            { id: 'arlong_park.window', anchorFrom: 'arlong_park.start', anchorTo: 'arlong_park.end', sortKeyFrom: 100, sortKeyTo: 200 },
          ],
        },
        tagRegistry: {
          schemaVersion: 1,
          tags: {
            'character:arlong': {
              label: 'Arlong',
              aliases: ['sawshark fish-man'],
            },
          },
        },
        entryOverrides: {
          arlong_generated: {
            schemaVersion: 3,
            id: 'arlong_generated',
            title: 'Arlong',
            category: 'character',
            priority: 72,
            tags: ['character:arlong'],
            context: {
              scope: 'window',
              validFromAnchor: 'arlong_park.start',
              validToAnchor: 'arlong_park.end',
              sortKeyFrom: 100,
              sortKeyTo: 200,
              precision: 'anchor_window',
              windowKind: 'bounded',
              label: 'Arlong Park Arc',
            },
            retrieval: {
              activation: 'topic_or_entity',
              frequency: 'normal',
              contextBoost: 'medium',
            },
            content: {
              fact: 'Arlong controls Cocoyasi Village through extortion and intimidation.',
              injection: 'Arlong should apply pressure through extortion, intimidation, and contempt for humans.',
            },
          },
        },
      },
    },
  },
});
assert.equal(generatedSource.sourceKind, 'generated_virtual');
assert.equal(generatedSource.entryFiles.length, 1);
assert.equal(generatedSource.entryFiles[0].entries.length, 1);
assert.equal(generatedSource.health.status, 'good');
assert.equal(generatedSource.health.summary.entryCount, 1);
assert.equal(generatedSource.health.summary.timelineAnchorCount, 2);
assert.equal(generatedSource.health.summary.tagRegistryTagCount, 1);

const customVirtualSource = await loadLoredeckSourceById('arlong-park-imported', {
  registry: {
    schemaVersion: 1,
    packs: {
      'arlong-park-imported': {
        packId: 'arlong-park-imported',
        type: 'custom',
        title: 'Arlong Park Imported',
        entrySchemaVersion: 3,
        manifest: '',
        manifestData: {
          schemaVersion: 3,
          id: 'arlong-park-imported',
          type: 'custom',
          title: 'Arlong Park Imported',
          entrySchemaVersion: 3,
          files: [],
          stats: { entryCount: 1, categoryCounts: { character: 1 } },
        },
        timelineRegistry: {
          anchors: [
            { id: 'arlong_park.start', label: 'Start', sortKey: 100 },
            { id: 'arlong_park.end', label: 'End', sortKey: 200 },
          ],
        },
        tagRegistry: {
          tags: {
            'character:arlong': { label: 'Arlong' },
          },
        },
        entryOverrides: {
          arlong_custom_import: {
            schemaVersion: 3,
            id: 'arlong_custom_import',
            title: 'Arlong imported as Custom',
            category: 'character',
            priority: 72,
            tags: ['character:arlong'],
            context: {
              scope: 'window',
              validFromAnchor: 'arlong_park.start',
              validToAnchor: 'arlong_park.end',
              sortKeyFrom: 100,
              sortKeyTo: 200,
              precision: 'anchor_window',
              windowKind: 'bounded',
              label: 'Arlong Park Arc',
            },
            retrieval: {
              activation: 'topic_or_entity',
              frequency: 'normal',
              contextBoost: 'medium',
            },
            content: {
              fact: 'Imported Arlong remains coercive and cruel.',
              injection: 'Arlong should remain coercive and cruel in this imported Custom deck.',
            },
          },
        },
      },
    },
  },
});
assert.equal(customVirtualSource.sourceKind, 'custom_virtual');
assert.equal(customVirtualSource.entryFiles.length, 1);
assert.equal(customVirtualSource.entryFiles[0].entries.length, 1);
assert.equal(customVirtualSource.health.status, 'good');
assert.equal(customVirtualSource.health.summary.entryCount, 1);

console.log('Loredeck Context health tests passed.');
