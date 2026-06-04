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

const { loadStoryPositionIndexForState } = await import('../story-position-index.js');
const { resolveStoryPositionsFromContext } = await import('../story-position-resolver.js');

const baseState = {
  lorepackStack: [
    { packId: 'hp-golden-trio', enabled: true, priority: 100, addedAt: 0 },
  ],
  lorepackContexts: {
    'hp-golden-trio': {
      packId: 'hp-golden-trio',
      manualLock: false,
      source: 'unknown',
    },
  },
};

const index = await loadStoryPositionIndexForState(baseState, {
  registry: { packs: {} },
  force: true,
});

assert.equal(index.summary.anchorCount, 17);
assert.equal(index.summary.windowCount, 3);

const dateResolution = resolveStoryPositionsFromContext({
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
assert.equal(dateResolution.results[0].patch.positionSortKey, Math.floor(Date.UTC(1997, 0, 25) / 86400000));

const aliasResolution = resolveStoryPositionsFromContext({
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
assert.equal(aliasResolution.results[0].patch.positionSortKey, Math.floor(Date.UTC(1994, 5, 6) / 86400000));

const lockedResolution = resolveStoryPositionsFromContext({
  canonBoundary: 'after Sirius reveal',
}, {
  state: {
    ...baseState,
    lorepackContexts: {
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

console.log('Story Position resolver tests passed.');
