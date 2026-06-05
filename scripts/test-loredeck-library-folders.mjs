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
import {
  resolveLoredeckLibraryDragFeedback,
} from '../loredeck-library-drag.js';
import {
  getLoredeckLibraryManualSortOrder,
  sortLoredeckLibraryPacks,
} from '../loredeck-library-view.js';
import {
  applyLoredeckLibraryFolderRemovalPlan,
  createLoredeckLibraryFolderRecord,
  getLoredeckLibraryFolderDeckIds,
  getLoredeckLibraryFolderRemovalPlan,
  isLoredeckLibraryFolderDescendant,
  moveLoredeckLibraryFolderRecord,
  moveLoredecksToLibraryFolderPlacement,
  renameLoredeckLibraryFolderRecord,
  reorderLoredeckLibraryPlacements,
} from '../loredeck-library-service.js';

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
assert.equal(isLoredeckLibraryFolderDescendant(arlongId, onePieceId, index), true);
assert.equal(isLoredeckLibraryFolderDescendant(onePieceId, arlongId, index), false);
assert.deepEqual(getLoredeckLibraryFolderDeckIds(arlongId, index).sort(), [
  'onepiece-arlong-core',
  'onepiece-arlong-villains',
]);
assert.deepEqual(getLoredeckLibraryFolderDeckIds(onePieceId, index, { includeNested: false }), []);

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

const library = Object.entries(packs).map(([packId, pack]) => ({ packId, ...pack }));
const registry = { schemaVersion: 1, packs: {}, deckPlacements: index.deckPlacements };

const movedDeck = moveLoredecksToLibraryFolderPlacement({
  packIds: ['onepiece-east-blue-core'],
  folderId: arlongId,
  library,
  libraryIndex: index,
  registry,
});
assert.equal(movedDeck.ok, true);
assert.equal(movedDeck.validIds[0], 'onepiece-east-blue-core');
assert.equal(movedDeck.deckPlacements.find(item => item.deckId === 'onepiece-east-blue-core')?.folderId, arlongId);

const reorderedDeck = reorderLoredeckLibraryPlacements({
  packId: 'onepiece-arlong-villains',
  targetIndex: 0,
  visiblePacks: library,
  registry,
});
assert.equal(reorderedDeck.ok, true);
assert.equal(reorderedDeck.deckPlacements.find(item => item.deckId === 'onepiece-arlong-villains')?.sortOrder, 100);

const createdFolder = createLoredeckLibraryFolderRecord(onePieceId, 'Special Editions', index);
assert.equal(createdFolder.ok, true);
assert.equal(createdFolder.folder.parentId, onePieceId);
assert.equal(createLoredeckLibraryFolderRecord(onePieceId, 'Special Editions', { ...index, folders: createdFolder.folders }).ok, false);

const renamedFolder = renameLoredeckLibraryFolderRecord(createdFolder.folder.id, 'Special Loredecks', { ...index, folders: createdFolder.folders });
assert.equal(renamedFolder.ok, true);
assert.equal(renamedFolder.folder.title, 'Special Loredecks');

const movedFolder = moveLoredeckLibraryFolderRecord(createdFolder.folder.id, eastBlueId, null, { ...index, folders: renamedFolder.folders });
assert.equal(movedFolder.ok, true);
assert.equal(movedFolder.folders.find(folder => folder.id === createdFolder.folder.id)?.parentId, eastBlueId);
assert.equal(moveLoredeckLibraryFolderRecord(onePieceId, arlongId, null, index).ok, false);

const removalIndex = normalizeLoredeckLibraryIndex({
  folders: [
    { id: 'folder_series', title: 'Series', sortOrder: 100 },
    { id: 'folder_series__arc', title: 'Arc', parentId: 'folder_series', sortOrder: 100 },
    { id: 'folder_series__arc__scene', title: 'Scene', parentId: 'folder_series__arc', sortOrder: 100 },
  ],
  deckPlacements: [
    { deckId: 'deck-root', folderId: 'folder_series', sortOrder: 100 },
    { deckId: 'deck-direct', folderId: 'folder_series__arc', sortOrder: 100 },
    { deckId: 'deck-nested', folderId: 'folder_series__arc__scene', sortOrder: 100 },
  ],
}, {
  packs: {
    'deck-root': {},
    'deck-direct': {},
    'deck-nested': {},
  },
});

const removalPlan = getLoredeckLibraryFolderRemovalPlan('folder_series__arc', removalIndex);
assert.equal(removalPlan.directChildFolders[0].id, 'folder_series__arc__scene');
assert.deepEqual(removalPlan.containedDeckIds.sort(), ['deck-direct', 'deck-nested']);

const movedUpRemoval = applyLoredeckLibraryFolderRemovalPlan({
  folderId: 'folder_series__arc',
  strategy: 'move_to_parent',
  libraryIndex: removalIndex,
  registry: { schemaVersion: 1, packs: {}, deckPlacements: [] },
});
assert.equal(movedUpRemoval.ok, true);
assert.equal(movedUpRemoval.folders.some(folder => folder.id === 'folder_series__arc'), false);
assert.equal(movedUpRemoval.folders.find(folder => folder.id === 'folder_series__arc__scene')?.parentId, 'folder_series');
assert.equal(movedUpRemoval.deckPlacements.find(item => item.deckId === 'deck-direct')?.folderId, 'folder_series');
assert.equal(movedUpRemoval.deckPlacements.find(item => item.deckId === 'deck-nested')?.folderId, 'folder_series__arc__scene');

const unfiledRemoval = applyLoredeckLibraryFolderRemovalPlan({
  folderId: 'folder_series__arc',
  strategy: 'move_decks_to_unfiled',
  libraryIndex: removalIndex,
  registry: { schemaVersion: 1, packs: {}, deckPlacements: [] },
});
assert.equal(unfiledRemoval.ok, true);
assert.equal(unfiledRemoval.folders.some(folder => folder.id === 'folder_series__arc__scene'), false);
assert.equal(unfiledRemoval.deckPlacements.find(item => item.deckId === 'deck-direct')?.folderId, '');
assert.equal(unfiledRemoval.deckPlacements.find(item => item.deckId === 'deck-nested')?.folderId, '');

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-deck',
  packIds: ['onepiece-arlong-core', 'onepiece-arlong-villains'],
  dropKind: 'folder',
  dropFolderId: arlongId,
  libraryIndex: index,
}), {
  valid: true,
  text: 'Move 2 Loredecks to One Piece > East Blue Saga > Arlong Park',
});

assert.equal(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-folder',
  folderId: onePieceId,
  folderTitle: 'One Piece',
  dropKind: 'folder',
  dropFolderId: arlongId,
  libraryIndex: index,
}).valid, false);

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-folder',
  folderId: arlongId,
  folderTitle: 'Arlong Park',
  dropKind: 'library',
  reparentToRoot: true,
  libraryIndex: index,
}), {
  valid: true,
  text: 'Move Arlong Park to Library root',
  root: true,
});

assert.equal(resolveLoredeckLibraryDragFeedback({
  dragType: 'stack-item',
  stackKey: `folder:${arlongId}`,
  dropKind: 'folder',
  dropFolderId: eastBlueId,
  libraryIndex: index,
}).text, 'Folder groups cannot be dropped into Library folders');

const sortPacks = [
  { packId: 'custom-b', title: 'Custom B', type: 'custom', library: { familyOrder: 500 }, updatedAt: 2000, stats: { entryCount: 8 } },
  { packId: 'bundled-a', title: 'Bundled A', type: 'bundled', library: { familyOrder: 300 }, updatedAt: 1000, stats: { entryCount: 20 } },
  { packId: 'generated-c', title: 'Generated C', type: 'generated', updatedAt: 3000, stats: { entryCount: 2 } },
];
const sortRegistry = {
  deckPlacements: [
    { deckId: 'generated-c', sortOrder: 100 },
    { deckId: 'bundled-a', sortOrder: 200 },
  ],
};
assert.equal(getLoredeckLibraryManualSortOrder(sortPacks[2], sortRegistry), 100);
assert.deepEqual(sortLoredeckLibraryPacks(sortPacks, { sortMode: 'manual', registry: sortRegistry }).map(pack => pack.packId), [
  'generated-c',
  'bundled-a',
  'custom-b',
]);
assert.deepEqual(sortLoredeckLibraryPacks(sortPacks, { sortMode: 'type' }).map(pack => pack.packId), [
  'bundled-a',
  'custom-b',
  'generated-c',
]);
assert.deepEqual(sortLoredeckLibraryPacks(sortPacks, {
  sortMode: 'health',
  getHealthTone: pack => ({ 'bundled-a': 'warning', 'custom-b': 'error', 'generated-c': 'ok' }[pack.packId]),
}).map(pack => pack.packId), [
  'custom-b',
  'bundled-a',
  'generated-c',
]);
assert.deepEqual(sortLoredeckLibraryPacks(sortPacks, {
  sortMode: 'entries',
  getEntryCount: pack => pack.stats.entryCount,
}).map(pack => pack.packId), [
  'bundled-a',
  'custom-b',
  'generated-c',
]);
assert.deepEqual(sortLoredeckLibraryPacks(sortPacks, { sortMode: 'updated' }).map(pack => pack.packId), [
  'generated-c',
  'custom-b',
  'bundled-a',
]);

console.log('Loredeck Library folder tests passed.');
