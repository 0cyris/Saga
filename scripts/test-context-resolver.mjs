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

const baseState = {
  loredeckStack: [
    { packId: 'hp-golden-trio', enabled: true, priority: 100, addedAt: 0 },
  ],
  loredeckContexts: {
    'hp-golden-trio': {
      packId: 'hp-golden-trio',
      manualLock: false,
      source: 'unknown',
    },
  },
};

const index = await loadContextIndexForState(baseState, {
  registry: { packs: {} },
  force: true,
});

assert.equal(index.summary.anchorCount, 17);
assert.equal(index.summary.windowCount, 3);

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
assert.equal(dateResolution.results[0].anchor.id, 'hp.hbp.year_6');
assert.equal(dateResolution.results[0].matchType, 'date');
assert.equal(dateResolution.results[0].patch.source, 'header');
assert.equal(dateResolution.results[0].patch.sceneDate, 'Saturday, Jan 25, 1997');
assert.equal(dateResolution.results[0].patch.contextSortKey, Math.floor(Date.UTC(1997, 0, 25) / 86400000));

const aliasResolution = resolveContextsFromContext({
  canonBoundary: 'after Sirius reveal',
  branchId: 'au-test',
}, {
  state: baseState,
  index,
  contextSource: 'local_alias',
});

assert.equal(aliasResolution.resolvedCount, 1);
assert.equal(aliasResolution.results[0].anchor.id, 'hp.poa.sirius_truth_to_trio');
assert.equal(aliasResolution.results[0].matchType, 'alias');
assert.equal(aliasResolution.results[0].patch.branchId, 'au-test');
assert.equal(aliasResolution.results[0].patch.contextSortKey, Math.floor(Date.UTC(1994, 5, 6) / 86400000));

const lockedResolution = resolveContextsFromContext({
  canonBoundary: 'after Sirius reveal',
}, {
  state: {
    ...baseState,
    loredeckContexts: {
      'hp-golden-trio': {
        packId: 'hp-golden-trio',
        manualLock: true,
      },
    },
  },
  index,
  contextSource: 'local_alias',
});

assert.equal(lockedResolution.resolvedCount, 0);
assert.equal(lockedResolution.skippedCount, 1);
assert.equal(lockedResolution.results[0].reason, 'manual_lock');

console.log('Context resolver tests passed.');
