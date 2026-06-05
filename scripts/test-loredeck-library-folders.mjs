import assert from 'node:assert/strict';
import {
  buildFolderTree,
  createFolderIdFromPath,
  getFolderPath,
  normalizeLoredeckLibraryIndex,
  normalizeLibrarySuggestedPath,
  normalizePackLibraryMetadata,
  resolveLoredeckStackItems,
} from '../loredeck-library-index.js';

assert.deepEqual(
  normalizeLibrarySuggestedPath('One Piece > East Blue Saga > Arlong Park'),
  ['One Piece', 'East Blue Saga', 'Arlong Park']
);
assert.deepEqual(
  normalizePackLibraryMetadata({ suggestedPath: ['One Piece', '', 'Arlong Park'], familyOrder: '30' }),
  { suggestedPath: ['One Piece', 'Arlong Park'], familyOrder: 30 }
);

const packs = {
  'onepiece-east-blue-core': {
    title: 'One Piece: East Blue Core',
    library: { suggestedPath: ['One Piece', 'East Blue Saga'], familyOrder: 10 },
  },
  'onepiece-arlong-core': {
    title: 'Arlong Park: Core',
    library: { suggestedPath: ['One Piece', 'East Blue Saga', 'Arlong Park'], familyOrder: 20 },
  },
  'onepiece-arlong-villains': {
    title: 'Arlong Park: Arlong Pirates',
    library: { suggestedPath: ['One Piece', 'East Blue Saga', 'Arlong Park'], familyOrder: 30 },
  },
  'hp-year-6-half-blood-prince': {
    title: 'Harry Potter Year 6: Half-Blood Prince',
    library: { suggestedPath: ['Harry Potter', 'Golden Trio'], familyOrder: 70 },
  },
};

const index = normalizeLoredeckLibraryIndex({}, { packs });
const onePieceId = createFolderIdFromPath(['One Piece']);
const eastBlueId = createFolderIdFromPath(['One Piece', 'East Blue Saga']);
const arlongId = createFolderIdFromPath(['One Piece', 'East Blue Saga', 'Arlong Park']);
const hpGoldenTrioId = createFolderIdFromPath(['Harry Potter', 'Golden Trio']);

assert.ok(index.folders.some(folder => folder.id === onePieceId));
assert.ok(index.folders.some(folder => folder.id === arlongId && folder.parentId === eastBlueId));
assert.deepEqual(getFolderPath(arlongId, index), ['One Piece', 'East Blue Saga', 'Arlong Park']);
assert.equal(index.deckPlacements.find(item => item.deckId === 'onepiece-arlong-core')?.folderId, arlongId);
assert.equal(index.deckPlacements.find(item => item.deckId === 'hp-year-6-half-blood-prince')?.folderId, hpGoldenTrioId);

const tree = buildFolderTree(index);
assert.equal(tree.find(folder => folder.id === onePieceId)?.children[0]?.id, eastBlueId);

const resolved = resolveLoredeckStackItems([
  { type: 'deck', packId: 'onepiece-arlong-villains', priority: 100, sortOrder: 10 },
  { type: 'folder', folderId: eastBlueId, priority: 90, sortOrder: 20 },
  { type: 'folder', folderId: hpGoldenTrioId, priority: 80, sortOrder: 30 },
], index, { packs });

assert.deepEqual(resolved.stack.map(item => item.packId), [
  'onepiece-arlong-villains',
  'onepiece-east-blue-core',
  'onepiece-arlong-core',
  'hp-year-6-half-blood-prince',
]);
assert.equal(resolved.duplicates.length, 1);
assert.equal(resolved.duplicates[0].packId, 'onepiece-arlong-villains');
assert.equal(resolved.summary.resolvedDeckCount, 4);

const missingResolved = resolveLoredeckStackItems([
  { type: 'deck', packId: 'missing-pack', sortOrder: 10 },
], index, { packs });
assert.equal(missingResolved.summary.missingCount, 1);
assert.equal(missingResolved.missing[0].packId, 'missing-pack');

const cycleIndex = normalizeLoredeckLibraryIndex({
  folders: [
    { id: 'a', title: 'A', parentId: 'b' },
    { id: 'b', title: 'B', parentId: 'a' },
  ],
}, { packs: {} });
assert.equal(cycleIndex.folders.find(folder => folder.id === 'a')?.parentId, '');
assert.notEqual(cycleIndex.folders.find(folder => folder.id === 'b')?.parentId, 'b');

console.log('Loredeck Library folder tests passed.');
