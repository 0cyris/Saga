import assert from 'node:assert/strict';

import { buildLoredeckHealthForData } from '../../src/loredecks/loredeck-health-engine.js';
import {
  configureLoredeckEditorActions,
  repairLoredeckSafeHealthIssues,
} from '../../src/runtime/loredeck-editor-actions.js';
import {
  applyLoredeckRecordPatch,
} from '../../src/runtime/loredeck-pending-change-model.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildBadEntry(overrides = {}) {
  return {
    schemaVersion: 3,
    id: 'nami-secret',
    title: "Nami's Secret",
    kind: 'fact',
    category: 'secret',
    fact: 'Legacy top-level fact should move into content.',
    date: { validFrom: 'arlong.start' },
    whoKnowsTruth: ['Nami'],
    tags: ['characternami', 'fact', 'secret', 'other'],
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
      fact: 'Nami hides her buyback deal from Arlong.',
      injection: 'When Nami or Arlong pressure is relevant, treat the thefts as cover for a hidden buyback plan.',
    },
    ...overrides,
  };
}

function buildPack(entry = buildBadEntry(), packId = 'generated-safe-repair-pack') {
  return {
    packId,
    type: 'generated',
    title: 'Generated Safe Repair Pack',
    entrySchemaVersion: 3,
    manifestData: {
      id: packId,
      type: 'generated',
      title: 'Generated Safe Repair Pack',
      entrySchemaVersion: 3,
      files: [],
      registries: {
        timeline: 'timeline.json',
        tags: 'tags.json',
      },
      stats: { entryCount: 1, categoryCounts: { secret: 1 } },
    },
    entryOverrides: {
      [entry.id]: entry,
    },
    disabledEntryIds: [],
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

function buildHealth(pack) {
  return buildLoredeckHealthForData({
    packId: pack.packId,
    manifest: pack.manifestData,
    entryFiles: [{
      file: '__generated_safe_repair__',
      schemaVersion: 3,
      entries: Object.values(pack.entryOverrides || {}),
    }],
    timeline: pack.timelineRegistry,
    tagRegistry: pack.tagRegistry,
  });
}

async function runSafeRepair(pack) {
  let savedPack = clone(pack);
  const toasts = [];
  configureLoredeckEditorActions({
    getFreshLoredeckLibraryPack: (_packId, fallback) => savedPack || fallback,
    getExpectedLoredeckEntrySchemaVersion: () => 3,
    validateLoredeckForEditor: async (workingPack) => ({
      health: buildHealth(workingPack),
      manifest: workingPack.manifestData,
      entryCache: {
        entries: Object.values(workingPack.entryOverrides || {}),
        entryFiles: [{
          file: '__generated_safe_repair__',
          schemaVersion: 3,
          entries: Object.values(workingPack.entryOverrides || {}),
        }],
      },
    }),
    upsertLoredeckLibraryPack: (next) => {
      savedPack = clone(next);
      return { ok: true };
    },
    clearCanonLoreDatabaseCache: () => {},
    clearContextIndexCache: () => {},
    deleteLoredeckEntryPreviewCacheRecord: () => {},
    refreshLoredeckSurfaces: () => {},
    toast: (message, type = 'info') => {
      toasts.push({ message, type });
    },
  });
  const ok = await repairLoredeckSafeHealthIssues(savedPack);
  return { ok, pack: savedPack, toasts };
}

const broken = buildPack();
const beforeHealth = buildHealth(broken);
assert.equal(beforeHealth.summary.errorCount, 1);
assert.equal(beforeHealth.summary.schemaV3IssueCount, 1);
assert.equal(beforeHealth.summary.undefinedTagCount, 4);

const repairedResult = await runSafeRepair(broken);
assert.equal(repairedResult.ok, true);
const repairedEntry = repairedResult.pack.entryOverrides['nami-secret'];
assert.deepEqual(repairedEntry.tags, ['character:nami']);
assert.equal(Object.hasOwn(repairedEntry, 'fact'), false);
assert.equal(Object.hasOwn(repairedEntry, 'date'), false);
assert.equal(Object.hasOwn(repairedEntry, 'whoKnowsTruth'), false);
assert.ok(repairedResult.toasts.some(toast => toast.type === 'success' && toast.message.includes('1 override repaired')));

const afterHealth = buildHealth(repairedResult.pack);
assert.equal(afterHealth.status, 'good');
assert.equal(afterHealth.summary.errorCount, 0);
assert.equal(afterHealth.summary.warningCount, 0);
assert.equal(afterHealth.summary.schemaV3IssueCount, 0);
assert.equal(afterHealth.summary.undefinedTagCount, 0);

const unresolved = buildPack(buildBadEntry({
  tags: ['character:nojiko', 'fact'],
  context: {
    ...buildBadEntry().context,
    validToAnchor: 'arlong.end.deal',
  },
}), 'generated-safe-repair-unresolved-pack');
const unresolvedResult = await runSafeRepair(unresolved);
assert.equal(unresolvedResult.ok, true);
const unresolvedEntry = unresolvedResult.pack.entryOverrides['nami-secret'];
assert.deepEqual(unresolvedEntry.tags, ['character:nojiko']);
assert.equal(unresolvedEntry.context.validToAnchor, 'arlong.end.deal');
assert.equal(Object.hasOwn(unresolvedEntry, 'fact'), false);
assert.equal(unresolvedResult.pack.pendingChanges.length, 1);
assert.equal(unresolvedResult.pack.pendingChanges[0].action, 'review_schema_v3_context_anchor');
assert.ok(unresolvedResult.toasts.some(toast => toast.type === 'success' && toast.message.includes('still need review')));
assert.ok(unresolvedResult.toasts.some(toast => toast.type === 'success' && toast.message.includes('1 review repair queued')));

const unresolvedHealth = buildHealth(unresolvedResult.pack);
assert.equal(unresolvedHealth.summary.errorCount, 0);
assert.equal(unresolvedHealth.summary.schemaV3IssueCount, 0);
assert.ok(unresolvedHealth.summary.undefinedTagCount > 0);
assert.ok(unresolvedHealth.summary.brokenAnchorReferenceCount > 0);
assert.equal(unresolvedHealth.status, 'needs_review');

const anchorOnly = buildPack(buildBadEntry({
  tags: ['character:nami', 'fact'],
  context: {
    ...buildBadEntry().context,
    validToAnchor: 'arlong.end.deal',
  },
}), 'generated-safe-repair-anchor-proposal-pack');
const anchorOnlyResult = await runSafeRepair(anchorOnly);
assert.equal(anchorOnlyResult.ok, true);
assert.equal(anchorOnlyResult.pack.pendingChanges.length, 1);
const anchorRepairChange = anchorOnlyResult.pack.pendingChanges[0];
assert.equal(anchorRepairChange.source, 'safe_repair');
assert.equal(anchorRepairChange.action, 'review_schema_v3_context_anchor');
assert.deepEqual(anchorRepairChange.affectedEntryIds, ['nami-secret']);
assert.deepEqual(anchorRepairChange.affectedTimelineIds, ['arlong.end.deal', 'arlong.end']);
assert.equal(anchorRepairChange.payload.entryOverrides['nami-secret'].context.validToAnchor, 'arlong.end');
assert.equal(anchorRepairChange.preview.schemaV3RepairCandidates[0].reason, 'sort_key_match');

const anchorOnlyDirectHealth = buildHealth(anchorOnlyResult.pack);
assert.equal(anchorOnlyDirectHealth.status, 'needs_review');
assert.ok(anchorOnlyDirectHealth.summary.brokenAnchorReferenceCount > 0);

const acceptedAnchorRepair = clone(anchorOnlyResult.pack);
applyLoredeckRecordPatch(acceptedAnchorRepair, anchorRepairChange.payload);
acceptedAnchorRepair.pendingChanges = [];
const acceptedAnchorHealth = buildHealth(acceptedAnchorRepair);
assert.equal(acceptedAnchorHealth.status, 'good');
assert.equal(acceptedAnchorHealth.summary.errorCount, 0);
assert.equal(acceptedAnchorHealth.summary.warningCount, 0);
assert.equal(acceptedAnchorHealth.summary.brokenAnchorReferenceCount, 0);

const ambiguous = buildPack(buildBadEntry({
  tags: ['characternami', 'fact'],
  context: {
    ...buildBadEntry().context,
    validToAnchor: 'arlong.end.deal',
  },
}), 'generated-safe-repair-ambiguous-pack');
ambiguous.timelineRegistry.anchors.push({
  id: 'arlong.false-end',
  label: 'Arlong false ending',
  sortKey: 20,
});
ambiguous.tagRegistry.tags['character_nami'] = {
  label: 'Nami alternate tag',
  description: 'Ambiguous compact tag candidate.',
};
const ambiguousResult = await runSafeRepair(ambiguous);
assert.equal(ambiguousResult.ok, true);
assert.deepEqual(ambiguousResult.pack.pendingChanges || [], []);
const ambiguousEntry = ambiguousResult.pack.entryOverrides['nami-secret'];
assert.deepEqual(ambiguousEntry.tags, ['characternami']);
assert.equal(ambiguousEntry.context.validToAnchor, 'arlong.end.deal');
assert.ok(ambiguousResult.toasts.some(toast => toast.message.includes('2 ambiguous candidates left for Pack Health review')));

const ambiguousHealth = buildHealth(ambiguousResult.pack);
assert.equal(ambiguousHealth.status, 'needs_review');
assert.ok(ambiguousHealth.summary.undefinedTagCount > 0);
assert.ok(ambiguousHealth.summary.brokenAnchorReferenceCount > 0);

function buildArlongStylePack() {
  const pack = buildPack(buildBadEntry(), 'one-piece-arlong-park-custom');
  pack.type = 'custom';
  pack.title = 'Arlong Park Arc Custom';
  pack.source = {
    kind: 'generated_finalized',
    originalPackId: 'one-piece-arlong-park',
  };
  pack.tagRegistry.tags = {
    'character:nami': { label: 'Nami' },
    'character:arlong': { label: 'Arlong' },
    'faction:arlong-pirates': { label: 'Arlong Pirates' },
    'concept:buyback-deal': { label: 'Buyback Deal' },
  };
  pack.timelineRegistry.anchors = [
    { id: 'one-piece.arlong.start', label: 'Arlong Park starts', sortKey: 10 },
    { id: 'one-piece.arlong.arlong-betrays-buyback', label: 'Arlong betrays the buyback deal', sortKey: 20 },
    { id: 'one-piece.arlong.end', label: 'Arlong Park ends', sortKey: 30 },
  ];
  pack.timelineRegistry.windows = [
    { id: 'one-piece.arlong.arc', label: 'Arlong Park', anchorFrom: 'one-piece.arlong.start', anchorTo: 'one-piece.arlong.end', sortKeyFrom: 10, sortKeyTo: 30 },
  ];
  pack.entryOverrides = {};
  for (let index = 1; index <= 56; index += 1) {
    const id = index === 23 ? 'namis-childhood-under-arlongs-rule' : `arlong-style-entry-${String(index).padStart(2, '0')}`;
    pack.entryOverrides[id] = buildBadEntry({
      id,
      title: `Arlong Style Entry ${index}`,
      category: index === 1 ? 'secret' : 'other',
      tags: index % 2 === 0
        ? ['characterarlong', 'characternami', 'factionarlong-pirates', 'fact', 'other']
        : ['characternami', 'factionarlong-pirates', 'conceptbuyback-deal', 'fact', 'other'],
      context: {
        ...buildBadEntry().context,
        validFromAnchor: 'one-piece.arlong.start',
        validToAnchor: index === 23 ? 'one-piece.arlong.arlong-betrays-buyback-deal' : 'one-piece.arlong.end',
        sortKeyFrom: 10,
        sortKeyTo: index === 23 ? 20 : 30,
      },
    });
  }
  pack.manifestData.stats = { entryCount: 56, categoryCounts: { secret: 1, other: 55 } };
  return pack;
}

const arlongStyle = buildArlongStylePack();
const arlongBeforeHealth = buildHealth(arlongStyle);
assert.equal(arlongBeforeHealth.summary.errorCount, 56);
assert.equal(arlongBeforeHealth.summary.schemaV3IssueCount, 56);
assert.ok(arlongBeforeHealth.summary.undefinedTagCount > 0);

const arlongResult = await runSafeRepair(arlongStyle);
assert.equal(arlongResult.ok, true);
assert.ok(arlongResult.toasts.some(toast => toast.type === 'success' && toast.message.includes('56 overrides repaired')));
assert.ok(arlongResult.toasts.some(toast => toast.type === 'success' && toast.message.includes('1 review repair queued')));
for (const entry of Object.values(arlongResult.pack.entryOverrides || {})) {
  assert.equal(Object.hasOwn(entry, 'fact'), false);
  assert.equal(Object.hasOwn(entry, 'date'), false);
  assert.equal(Object.hasOwn(entry, 'whoKnowsTruth'), false);
  assert.equal(entry.tags.includes('fact'), false);
  assert.equal(entry.tags.includes('other'), false);
}
assert.deepEqual(arlongResult.pack.entryOverrides['arlong-style-entry-01'].tags, [
  'character:nami',
  'faction:arlong-pirates',
  'concept:buyback-deal',
]);
assert.equal(arlongResult.pack.pendingChanges.length, 1);
assert.equal(arlongResult.pack.pendingChanges[0].action, 'review_schema_v3_context_anchor');

const arlongAfterRepairHealth = buildHealth(arlongResult.pack);
assert.equal(arlongAfterRepairHealth.summary.errorCount, 0);
assert.equal(arlongAfterRepairHealth.summary.schemaV3IssueCount, 0);
assert.equal(arlongAfterRepairHealth.summary.undefinedTagCount, 0);
assert.equal(arlongAfterRepairHealth.status, 'needs_review');

const arlongAccepted = clone(arlongResult.pack);
applyLoredeckRecordPatch(arlongAccepted, arlongAccepted.pendingChanges[0].payload);
arlongAccepted.pendingChanges = [];
const arlongAcceptedHealth = buildHealth(arlongAccepted);
assert.equal(arlongAcceptedHealth.status, 'good');
assert.equal(arlongAcceptedHealth.summary.errorCount, 0);
assert.equal(arlongAcceptedHealth.summary.warningCount, 0);

console.log('Loredeck generated safe repair tests passed.');
