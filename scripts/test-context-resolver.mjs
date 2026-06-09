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
const { buildContextResolutionAudit, resolveContextsFromContext } = await import('../context-resolver.js');

const CORE_DECK_ID = 'hp-core';
const YEAR_3_DECK_ID = 'hp-year-3-prisoner-of-azkaban';
const YEAR_6_DECK_ID = 'hp-year-6-half-blood-prince';

const baseState = {
  loredeckStack: [
    { packId: YEAR_6_DECK_ID, enabled: true, priority: 100, addedAt: 0 },
    { packId: YEAR_3_DECK_ID, enabled: true, priority: 90, addedAt: 1 },
  ],
  loredeckContexts: {
    [YEAR_6_DECK_ID]: {
      packId: YEAR_6_DECK_ID,
      manualLock: false,
      source: 'unknown',
    },
    [YEAR_3_DECK_ID]: {
      packId: YEAR_3_DECK_ID,
      manualLock: false,
      source: 'unknown',
    },
  },
};

const index = await loadContextIndexForState(baseState, {
  registry: { packs: {} },
  force: true,
});

assert.equal(index.summary.packCount, 2);
assert.equal(index.packs.map(pack => pack.packId).join(','), `${YEAR_6_DECK_ID},${YEAR_3_DECK_ID}`);
assert.ok(index.summary.anchorCount >= 100);
assert.ok(index.summary.windowCount >= 20);

const coreYear6State = {
  loredeckStack: [
    { packId: CORE_DECK_ID, enabled: true, priority: 100, addedAt: 0 },
    { packId: YEAR_6_DECK_ID, enabled: true, priority: 90, addedAt: 1 },
  ],
  loredeckContexts: {
    [CORE_DECK_ID]: {
      packId: CORE_DECK_ID,
      contextType: 'recurring_context',
      anchorId: 'hp.core.school_cycle.hogwarts_express',
      label: 'School Cycle Hogwarts Express',
      sceneDate: '1991-10-06',
      contextSortKey: 7948,
      contextSortKeyFrom: 7948,
      contextSortKeyTo: 7948,
      manualLock: false,
      source: 'local_alias',
    },
    [YEAR_6_DECK_ID]: {
      packId: YEAR_6_DECK_ID,
      manualLock: false,
      source: 'unknown',
    },
  },
};
const coreYear6Index = await loadContextIndexForState(coreYear6State, {
  registry: { packs: {} },
  force: true,
});
const jan25Year6Resolution = resolveContextsFromContext({
  sceneDate: 'Saturday, Jan 25, 1997',
  canonBoundary: 'Harry Potter Year 6 after Christmas before Apparition lessons',
  label: 'After Christmas Year 6',
  alias: 'After Christmas Year 6',
  branchId: 'main',
  arc: 'Year 6: Half-Blood Prince',
  phase: 'Post Christmas Before Apparition',
  notes: 'Hogwarts Year 6 roleplay scene with Harry Ron Hermione',
}, {
  state: coreYear6State,
  index: coreYear6Index,
  contextSource: 'local_alias',
  sourceText: 'Hogwarts Year 6 roleplay scene with Harry Ron Hermione',
  minLocalConfidence: 0.78,
});
const coreDateOnlyMatch = jan25Year6Resolution.results.find(result => result.packId === CORE_DECK_ID);
assert.equal(coreDateOnlyMatch.status, 'resolved');
assert.equal(coreDateOnlyMatch.matchType, 'date_only');
assert.equal(coreDateOnlyMatch.changed, true);
assert.equal(coreDateOnlyMatch.anchor, null);
assert.equal(coreDateOnlyMatch.window, null);
assert.equal(coreDateOnlyMatch.patch.contextType, 'calendar');
assert.equal(coreDateOnlyMatch.patch.anchorId, '');
assert.equal(coreDateOnlyMatch.patch.contextSortKey, Math.floor(Date.UTC(1997, 0, 25) / 86400000));
assert.equal(coreDateOnlyMatch.patch.contextSortKeyFrom, Math.floor(Date.UTC(1997, 0, 25) / 86400000));
assert.equal(coreDateOnlyMatch.patch.contextSortKeyTo, Math.floor(Date.UTC(1997, 0, 25) / 86400000));
const year6WindowMatch = jan25Year6Resolution.results.find(result => result.packId === YEAR_6_DECK_ID);
assert.equal(year6WindowMatch.status, 'resolved');
assert.equal(year6WindowMatch.window.id, 'hp.y6.window.post_christmas_before_apparition');
assert.equal(year6WindowMatch.matchType, 'date');

const customIndex = await loadContextIndexForState({
  loredeckStack: [
    { packId: 'custom-story-pack', enabled: true, priority: 100, addedAt: 0 },
  ],
}, {
  registry: {
    packs: {
      'custom-story-pack': {
        packId: 'custom-story-pack',
        type: 'custom',
        title: 'Custom Story Pack',
        manifestData: {
          id: 'custom-story-pack',
          type: 'custom',
          title: 'Custom Story Pack',
          files: [],
        },
        timelineRegistry: {
          anchors: [
            { id: 'custom.story.start', label: 'Custom Story Start', sortKey: 1, aliases: ['custom beginning'] },
            { id: 'custom.story.end', label: 'Custom Story End', sortKey: 2 },
          ],
          windows: [
            { id: 'custom.story.full', label: 'Custom Story Window', anchorFrom: 'custom.story.start', anchorTo: 'custom.story.end', sortKeyFrom: 1, sortKeyTo: 2 },
          ],
        },
      },
    },
  },
  force: true,
});
assert.equal(customIndex.summary.anchorCount, 2);
assert.equal(customIndex.summary.windowCount, 1);
assert.equal(customIndex.anchors[0].id, 'custom.story.start');

const folderContextRegistry = {
  schemaVersion: 1,
  folders: [
    { id: 'folder_custom_context', title: 'Custom Context', sortOrder: 100 },
  ],
  deckPlacements: [
    { deckId: 'custom-folder-pack', folderId: 'folder_custom_context', sortOrder: 100 },
  ],
  packs: {
    'custom-folder-pack': {
      packId: 'custom-folder-pack',
      type: 'custom',
      title: 'Custom Folder Pack',
      manifestData: {
        id: 'custom-folder-pack',
        type: 'custom',
        title: 'Custom Folder Pack',
        files: [],
      },
      timelineRegistry: {
        anchors: [
          { id: 'custom.folder.start', label: 'Custom Folder Start', sortKey: 1, aliases: ['folder beginning'] },
        ],
        windows: [
          { id: 'custom.folder.full', label: 'Custom Folder Full Window', anchorFrom: 'custom.folder.start', sortKeyFrom: 1, sortKeyTo: 2 },
        ],
      },
    },
  },
};
const folderStackIndex = await loadContextIndexForState({
  loredeckStack: [
    { type: 'folder', folderId: 'folder_custom_context', enabled: true, priority: 100, addedAt: 0 },
  ],
}, {
  registry: folderContextRegistry,
  force: true,
});
assert.equal(folderStackIndex.summary.packCount, 1);
assert.equal(folderStackIndex.packs[0].packId, 'custom-folder-pack');
assert.equal(folderStackIndex.packs[0].stackSource.type, 'folder');
assert.equal(folderStackIndex.packs[0].stackSource.folderId, 'folder_custom_context');
assert.deepEqual(folderStackIndex.packs[0].stackSource.folderPath, ['Custom Context']);
assert.equal(folderStackIndex.anchors[0].id, 'custom.folder.start');

const dateResolution = resolveContextsFromContext({
  sceneDate: 'Saturday, Jan 25, 1997',
  canonBoundary: 'Half-Blood Prince era, Year 6',
  branchId: 'main',
}, {
  state: baseState,
  index,
  contextSource: 'header',
});

assert.equal(dateResolution.resolvedCount, 1);
assert.equal(dateResolution.results[0].status, 'resolved');
assert.equal(dateResolution.results[0].packId, YEAR_6_DECK_ID);
assert.equal(dateResolution.results[0].window.id, 'hp.y6.window.post_christmas_before_apparition');
assert.equal(dateResolution.results[0].matchType, 'date');
assert.equal(dateResolution.results[0].patch.source, 'header');
assert.equal(dateResolution.results[0].patch.sceneDate, 'Saturday, Jan 25, 1997');
assert.equal(dateResolution.results[0].patch.contextSortKey, Math.floor(Date.UTC(1997, 0, 25) / 86400000));

const dateWithBoundaryPhraseResolution = resolveContextsFromContext({
  sceneDate: 'Saturday, Jan 25, 1997',
  canonBoundary: 'Half-Blood Prince era, Year 6 before Apparition lessons',
  alias: 'before Apparition lessons',
  branchId: 'main',
}, {
  state: baseState,
  index,
  contextSource: 'header',
});
const dateWithBoundaryPhraseMatch = dateWithBoundaryPhraseResolution.results.find(result => result.packId === YEAR_6_DECK_ID);
assert.equal(dateWithBoundaryPhraseMatch?.status, 'resolved');
assert.equal(
  dateWithBoundaryPhraseMatch?.window?.id,
  'hp.y6.window.post_christmas_before_apparition',
  'Explicit sceneDate should stay authoritative when loose boundary text mentions an upcoming anchor.',
);
assert.equal(dateWithBoundaryPhraseMatch?.matchType, 'date');

const thresholdedDateResolution = resolveContextsFromContext({
  sceneDate: 'Saturday, Jan 25, 1997',
  canonBoundary: 'Half-Blood Prince era, Year 6',
  branchId: 'main',
}, {
  state: baseState,
  index,
  contextSource: 'header',
  minLocalConfidence: 0.99,
});
const thresholdedDateMatch = thresholdedDateResolution.results.find(result => result.packId === YEAR_6_DECK_ID);
assert.equal(thresholdedDateMatch.status, 'unresolved');
assert.equal(thresholdedDateMatch.reason, 'local_low_confidence');
assert.equal(thresholdedDateResolution.unresolvedCount, 2);
const thresholdedAudit = buildContextResolutionAudit(thresholdedDateResolution, { sceneDate: 'Saturday, Jan 25, 1997' }, {
  source: 'test_local',
  sourceText: 'Saturday, Jan 25, 1997',
});
assert.equal(thresholdedAudit.counts.skippedLowConfidence, 1);
assert.equal(thresholdedAudit.outcomes.some(outcome => outcome.reason === 'local_low_confidence'), true);

const aliasResolution = resolveContextsFromContext({
  canonBoundary: 'Shrieking Shack Reveal',
  branchId: 'au-test',
}, {
  state: baseState,
  index,
  contextSource: 'local_alias',
});

assert.equal(aliasResolution.resolvedCount, 1);
const aliasMatch = aliasResolution.results.find(result => result.status === 'resolved');
assert.equal(aliasMatch.packId, YEAR_3_DECK_ID);
assert.equal(aliasMatch.anchor.id, 'hp.y3.shrieking_shack_reveal');
assert.equal(aliasMatch.matchType, 'alias');
assert.equal(aliasMatch.patch.branchId, 'au-test');
assert.equal(aliasMatch.patch.contextSortKey, Math.floor(Date.UTC(1994, 3, 21) / 86400000));

const lockedResolution = resolveContextsFromContext({
  canonBoundary: 'Shrieking Shack Reveal',
}, {
  state: {
    ...baseState,
    loredeckContexts: {
      ...baseState.loredeckContexts,
      [YEAR_3_DECK_ID]: {
        packId: YEAR_3_DECK_ID,
        manualLock: true,
      },
    },
  },
  index,
  contextSource: 'local_alias',
});

assert.equal(lockedResolution.resolvedCount, 0);
assert.equal(lockedResolution.skippedCount, 1);
assert.equal(lockedResolution.results.find(result => result.packId === YEAR_3_DECK_ID).reason, 'manual_lock');
const lockedAudit = buildContextResolutionAudit(lockedResolution, { canonBoundary: 'Shrieking Shack Reveal' }, {
  source: 'test_local_lock',
  sourceText: 'Shrieking Shack Reveal',
});
assert.equal(lockedAudit.counts.skippedLocked, 1);
assert.equal(lockedAudit.outcomes.some(outcome => outcome.packId === YEAR_3_DECK_ID && outcome.reason === 'manual_lock'), true);

console.log('Context resolver tests passed.');
