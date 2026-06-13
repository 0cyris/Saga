import assert from 'node:assert/strict';

import { buildLoredeckHealthForData } from '../../src/loredecks/loredeck-health-engine.js';
import { normalizeLoredeckRegistry } from '../../src/state/lore-state-normalizers.js';
import { applyLoredeckRecordPatch, createLoredeckRecordPatchChange } from '../../src/runtime/loredeck-pending-change-model.js';

const legacySchemaV3Fields = [
  'date',
  'canonTiming',
  'validFrom',
  'validTo',
  'activeWhen',
  'whoKnowsTruth',
  'whoSuspects',
  'whoBelievesPublicVersion',
  'publicVersion',
  'fact',
];

function buildSchemaV3Entry(id = 'nami-secret') {
  return {
    schemaVersion: 3,
    id,
    title: "Nami's Secret",
    kind: 'fact',
    category: 'secret',
    fact: 'Legacy top-level fact should not survive schema v3 Loredeck override persistence.',
    date: { validFrom: 'arlong.start' },
    canonTiming: { hardValidFrom: 'arlong.start' },
    validFrom: 'arlong.start',
    validTo: 'arlong.end',
    activeWhen: { tagsAny: ['character:nami'] },
    whoKnowsTruth: ['Nami'],
    whoSuspects: ['Nojiko'],
    whoBelievesPublicVersion: ['Straw Hats'],
    publicVersion: 'Nami is betraying the village.',
    tags: ['character:nami'],
    context: {
      scope: 'window',
      validFromAnchor: 'arlong.start',
      validToAnchor: 'arlong.end',
      sortKeyFrom: 10,
      sortKeyTo: 20,
      precision: 'anchor_window',
      windowKind: 'pressure_phase',
      label: 'Arlong pressure phase',
    },
    retrieval: {
      activation: 'context_or_topic',
      frequency: 'normal',
      contextBoost: 'high',
    },
    content: {
      fact: 'Nami hides her buyback deal to keep Arlong from exploiting her attachment to Cocoyasi.',
      injection: 'When Nami, Cocoyasi, or Arlong pressure is relevant, treat her thefts as cover for a hidden buyback plan.',
    },
    source: 'saga-loredeck:test-pack:creator',
    extensions: {
      sagaLoredeckOverride: {
        kind: 'addition',
        packId: 'schema-v3-pack',
        source: 'loredeck_creator',
      },
    },
  };
}

function buildPack(entry = buildSchemaV3Entry()) {
  return {
    packId: 'schema-v3-pack',
    type: 'generated',
    title: 'Schema V3 Pack',
    entrySchemaVersion: 3,
    manifestData: {
      id: 'schema-v3-pack',
      type: 'generated',
      title: 'Schema V3 Pack',
      entrySchemaVersion: 3,
      files: [],
      stats: { entryCount: 1, categoryCounts: { secret: 1 } },
      registries: {
        timeline: 'timeline.json',
        tags: 'tags.json',
      },
    },
    entryOverrides: {
      [entry.id]: entry,
    },
    timelineRegistry: {
      schemaVersion: 1,
      timelineMode: 'hybrid',
      sortKeyScale: 'pack_local',
      anchors: [
        { id: 'arlong.start', label: 'Arlong starts pressuring Cocoyasi', sortKey: 10 },
        { id: 'arlong.end', label: 'Arlong betrays the buyback deal', sortKey: 20 },
      ],
      windows: [
        { id: 'arlong.pressure', label: 'Arlong pressure phase', anchorFrom: 'arlong.start', anchorTo: 'arlong.end', sortKeyFrom: 10, sortKeyTo: 20 },
      ],
    },
    tagRegistry: {
      schemaVersion: 1,
      tags: {
        'character:nami': {
          label: 'Nami',
          description: 'Navigator under Arlong pressure.',
        },
      },
    },
    healthStatus: 'draft',
  };
}

function normalizePack(pack = buildPack()) {
  return normalizeLoredeckRegistry({
    schemaVersion: 1,
    packs: {
      [pack.packId]: pack,
    },
  }, { schemaVersion: 1, packs: {} }).packs[pack.packId];
}

function validateNormalizedPack(pack) {
  const entry = pack.entryOverrides['nami-secret'];
  assert.ok(entry, 'normalized pack should retain the schema v3 entry override');
  assert.equal(entry.schemaVersion, 3);
  assert.deepEqual(entry.tags, ['character:nami']);
  assert.equal(entry.content.fact, 'Nami hides her buyback deal to keep Arlong from exploiting her attachment to Cocoyasi.');
  assert.equal(entry.content.injection, 'When Nami, Cocoyasi, or Arlong pressure is relevant, treat her thefts as cover for a hidden buyback plan.');
  assert.equal(entry.context.validFromAnchor, 'arlong.start');
  assert.equal(entry.retrieval.activation, 'context_or_topic');
  assert.equal(entry.extensions.sagaLoredeckOverride.source, 'loredeck_creator');

  for (const field of legacySchemaV3Fields) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(entry, field),
      false,
      `schema v3 Loredeck override should not persist legacy top-level field ${field}`
    );
  }

  const health = buildLoredeckHealthForData({
    packId: pack.packId,
    manifest: pack.manifestData,
    entryFiles: [{
      file: '__schema_v3_override_fixture__',
      schemaVersion: 3,
      entries: Object.values(pack.entryOverrides),
    }],
    timeline: pack.timelineRegistry,
    tagRegistry: pack.tagRegistry,
  });
  assert.equal(health.status, 'good');
  assert.equal(health.summary.errorCount, 0);
  assert.equal(health.summary.warningCount, 0);
  assert.equal(health.summary.undefinedTagCount, 0);
  assert.equal(health.summary.orphanedTagCount, 0);
}

const normalizedDirectPack = normalizePack(buildPack());
validateNormalizedPack(normalizedDirectPack);

const pendingPatchEntry = buildSchemaV3Entry('nami-secret');
const pendingChange = createLoredeckRecordPatchChange({
  source: 'loredeck_creator',
  action: 'creator_upsert_entry',
  targetKind: 'entry',
  title: 'Creator upsert: Nami secret',
  affectedEntryIds: ['nami-secret'],
  payload: {
    entryOverrides: {
      'nami-secret': pendingPatchEntry,
    },
  },
});

const acceptedPack = normalizePack({
  ...buildPack(),
  entryOverrides: {},
});
applyLoredeckRecordPatch(acceptedPack, pendingChange.payload);
const normalizedAcceptedPack = normalizePack(acceptedPack);
validateNormalizedPack(normalizedAcceptedPack);

console.log('Loredeck schema v3 override persistence tests passed.');
