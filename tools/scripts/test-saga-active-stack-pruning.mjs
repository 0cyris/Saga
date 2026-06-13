import assert from 'node:assert/strict';

const {
  buildPrunedLoredeckStack,
} = await import('../../src/runtime/active-stack-panel.js');

const result = buildPrunedLoredeckStack([
  { type: 'deck', packId: 'custom-deleted', enabled: true, priority: 100, addedAt: 1 },
  { type: 'deck', packId: 'bundled-core', enabled: true, priority: 99, addedAt: 2 },
  { type: 'folder', folderId: 'deleted-folder', enabled: true, includeNested: true, priority: 98, addedAt: 3 },
  { type: 'folder', folderId: 'kept-folder', enabled: true, includeNested: true, priority: 97, addedAt: 4 },
  { type: 'deck', packId: 'custom-kept', enabled: false, priority: 96, addedAt: 5 },
], [
  { packId: 'bundled-core', type: 'bundled' },
  { packId: 'custom-kept', type: 'custom' },
], {
  folders: [
    { id: 'kept-folder', title: 'Kept Folder' },
  ],
});

assert.equal(result.removedDeckCount, 1);
assert.equal(result.removedFolderCount, 1);
assert.equal(result.removedCount, 2);
assert.deepEqual(result.stack.map(item => item.type === 'folder' ? `folder:${item.folderId}` : `deck:${item.packId}`), [
  'deck:bundled-core',
  'folder:kept-folder',
  'deck:custom-kept',
]);
assert.equal(result.stack.find(item => item.packId === 'custom-kept')?.enabled, false, 'Pruning should preserve enabled state for retained stack items.');
assert.deepEqual(result.stack.map(item => item.priority), [100, 99, 98], 'Pruning should normalize priorities after removing unavailable stack items.');

console.log('Saga active stack pruning tests passed.');
