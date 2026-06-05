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
const { resolveContextsFromContext } = await import('../context-resolver.js');

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

console.log('Context resolver tests passed.');
