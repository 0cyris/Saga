import assert from 'node:assert/strict';
import {
  buildFolderTree,
  createFolderIdFromPath,
  getFolderPath,
  normalizeLoredeckLibraryIndex,
  normalizeLibrarySuggestedPath,
  normalizePackLibraryMetadata,
  resolveLoredeckStackItems,
} from '../../src/loredecks/loredeck-library-index.js';
import {
  resolveLoredeckLibraryDragFeedback,
} from '../../src/loredecks/loredeck-library-drag.js';
import {
  normalizeSagaLibraryIndex,
} from '../../src/storage/saga-lorepack-library-storage.js';
import {
  sortLoredeckLibraryFolderTreeByTitle,
  sortLoredeckLibraryFolderPacks,
  getLoredeckLibraryManualSortOrder,
  sortLoredeckLibraryPacks,
} from '../../src/loredecks/loredeck-library-view.js';
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
} from '../../src/loredecks/loredeck-library-service.js';
import { loadLoredeckStackSources } from '../../src/loredecks/loredeck-loader.js';

assert.deepEqual(
  normalizeLibrarySuggestedPath('One Piece > East Blue Saga > Arlong Park'),
  ['One Piece', 'East Blue Saga', 'Arlong Park']
);
assert.deepEqual(
  normalizeLibrarySuggestedPath('One Piece > East Blue Saga / Arlong Park \\ Cocoyasi Village'),
  ['One Piece', 'East Blue Saga', 'Arlong Park', 'Cocoyasi Village']
);
assert.deepEqual(
  normalizeLibrarySuggestedPath(['Saga', 'Arc', 'Arc', 'Scene'], 3),
  ['Saga', 'Arc', 'Scene']
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
    type: 'bundled',
    library: { suggestedPath: ['Harry Potter', 'Golden Trio'], familyOrder: 70 },
  },
};

const index = normalizeLoredeckLibraryIndex({}, { packs });
const onePieceId = createFolderIdFromPath(['One Piece']);
const eastBlueId = createFolderIdFromPath(['One Piece', 'East Blue Saga']);
const arlongId = createFolderIdFromPath(['One Piece', 'East Blue Saga', 'Arlong Park']);
const hpRootId = createFolderIdFromPath(['Harry Potter']);
const hpGoldenTrioId = createFolderIdFromPath(['Harry Potter', 'Golden Trio']);

assert.ok(index.folders.some(folder => folder.id === onePieceId));
assert.ok(index.folders.some(folder => folder.id === arlongId && folder.parentId === eastBlueId));
assert.equal(index.folders.find(folder => folder.id === onePieceId)?.collapsed, false);
assert.equal(index.folders.find(folder => folder.id === hpRootId)?.collapsed, true);
assert.equal(index.folders.find(folder => folder.id === hpGoldenTrioId)?.collapsed, true);
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
assert.equal(resolved.duplicates[0].source.type, 'folder');
assert.equal(resolved.summary.resolvedDeckCount, 4);

const directDeckSuppression = resolveLoredeckStackItems([
  { type: 'folder', folderId: eastBlueId, priority: 100, sortOrder: 10 },
  { type: 'deck', packId: 'onepiece-east-blue-core', priority: 90, sortOrder: 20 },
], index, { packs });
assert.equal(directDeckSuppression.summary.duplicateCount, 1);
assert.equal(directDeckSuppression.duplicates[0].packId, 'onepiece-east-blue-core');
assert.equal(directDeckSuppression.duplicates[0].source.type, 'deck');
assert.equal(directDeckSuppression.duplicates[0].source.packId, 'onepiece-east-blue-core');
assert.equal(directDeckSuppression.stack[directDeckSuppression.duplicates[0].keptAt].source.type, 'folder');

const missingResolved = resolveLoredeckStackItems([
  { type: 'deck', packId: 'missing-pack', sortOrder: 10 },
], index, { packs });
assert.equal(missingResolved.summary.missingCount, 1);
assert.equal(missingResolved.missing[0].packId, 'missing-pack');

const persistedStackIndex = normalizeLoredeckLibraryIndex({
  activeStack: [
    { type: 'folder', folderId: eastBlueId, includeNested: false, collapsed: true, sortOrder: 20 },
    { type: 'folder', folderId: 'missing-folder', sortOrder: 5 },
    { type: 'deck', packId: 'onepiece-arlong-core', enabled: false, sortOrder: 10 },
  ],
}, { packs });
assert.deepEqual(persistedStackIndex.activeStack.map(item => item.type), ['deck', 'folder']);
assert.equal(persistedStackIndex.activeStack[0].packId, 'onepiece-arlong-core');
assert.equal(persistedStackIndex.activeStack[0].enabled, false);
assert.equal(persistedStackIndex.activeStack[1].folderId, eastBlueId);
assert.equal(persistedStackIndex.activeStack[1].includeNested, false);
assert.equal(persistedStackIndex.activeStack[1].collapsed, true);
const persistedStackResolved = resolveLoredeckStackItems(persistedStackIndex.activeStack, persistedStackIndex, { packs });
assert.deepEqual(persistedStackResolved.stack.map(item => item.packId), ['onepiece-east-blue-core']);
assert.equal(persistedStackResolved.summary.stackItemCount, 2);

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

const movedToUnfiled = moveLoredecksToLibraryFolderPlacement({
  packIds: ['onepiece-arlong-core', 'missing-pack'],
  folderId: 'unfiled',
  library,
  libraryIndex: index,
  registry,
});
assert.equal(movedToUnfiled.ok, true);
assert.deepEqual(movedToUnfiled.validIds, ['onepiece-arlong-core']);
assert.equal(movedToUnfiled.targetFolderId, '');
assert.equal(movedToUnfiled.deckPlacements.find(item => item.deckId === 'onepiece-arlong-core')?.folderId, '');

const invalidDestination = moveLoredecksToLibraryFolderPlacement({
  packIds: ['onepiece-arlong-core'],
  folderId: 'missing-folder',
  library,
  libraryIndex: index,
  registry,
});
assert.equal(invalidDestination.ok, false);
assert.equal(invalidDestination.error, 'That Library folder is no longer available.');

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
const movedFolderToRoot = moveLoredeckLibraryFolderRecord(createdFolder.folder.id, '', null, { ...index, folders: movedFolder.folders });
assert.equal(movedFolderToRoot.ok, true);
assert.equal(movedFolderToRoot.folders.find(folder => folder.id === createdFolder.folder.id)?.parentId, '');

const sourceDuplicateName = createLoredeckLibraryFolderRecord(onePieceId, 'Duplicate Name', index);
const targetDuplicateName = createLoredeckLibraryFolderRecord(eastBlueId, 'Duplicate Name', { ...index, folders: sourceDuplicateName.folders });
const duplicateNameMove = moveLoredeckLibraryFolderRecord(sourceDuplicateName.folder.id, eastBlueId, null, { ...index, folders: targetDuplicateName.folders });
assert.equal(duplicateNameMove.ok, false);
assert.equal(duplicateNameMove.error, 'A sibling folder already uses that name.');

const removalIndex = normalizeLoredeckLibraryIndex({
  folders: [
    { id: 'folder_series', title: 'Series', sortOrder: 100 },
    { id: 'folder_series__arc', title: 'Arc', parentId: 'folder_series', sortOrder: 100 },
    { id: 'folder_series__arc__scene', title: 'Scene', parentId: 'folder_series__arc', sortOrder: 100 },
    { id: 'folder_series__empty', title: 'Empty', parentId: 'folder_series', sortOrder: 200 },
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

const blockedEmptyRemoval = applyLoredeckLibraryFolderRemovalPlan({
  folderId: 'folder_series__arc',
  strategy: 'empty',
  libraryIndex: removalIndex,
  registry: { schemaVersion: 1, packs: {}, deckPlacements: [] },
});
assert.equal(blockedEmptyRemoval.ok, false);
assert.equal(blockedEmptyRemoval.error, 'Folder is not empty. Choose a contents-preserving deletion strategy.');

const emptyRemoval = applyLoredeckLibraryFolderRemovalPlan({
  folderId: 'folder_series__empty',
  strategy: 'empty',
  libraryIndex: removalIndex,
  registry: { schemaVersion: 1, packs: {}, deckPlacements: [] },
});
assert.equal(emptyRemoval.ok, true);
assert.equal(emptyRemoval.folders.some(folder => folder.id === 'folder_series__empty'), false);

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

const directOnlyStack = resolveLoredeckStackItems([
  { type: 'folder', folderId: eastBlueId, includeNested: false, sortOrder: 10 },
], index, { packs });
assert.deepEqual(directOnlyStack.stack.map(item => item.packId), ['onepiece-east-blue-core']);
assert.equal(directOnlyStack.summary.duplicateCount, 0);

const emptyFolderStack = resolveLoredeckStackItems([
  { type: 'folder', folderId: 'folder_series__empty', sortOrder: 10 },
], removalIndex, { packs: { 'deck-root': {}, 'deck-direct': {}, 'deck-nested': {} } });
assert.equal(emptyFolderStack.summary.missingCount, 1);
assert.equal(emptyFolderStack.missing[0].folderId, 'folder_series__empty');

const runtimePacks = Object.fromEntries(Object.entries(packs).map(([packId, pack]) => [packId, {
  packId,
  type: 'custom',
  title: pack.title,
  library: pack.library,
  manifestData: {
    id: packId,
    type: 'custom',
    title: pack.title,
    files: [],
  },
  entryOverrides: {
    [`${packId}.runtime-entry`]: {
      id: `${packId}.runtime-entry`,
      title: `${pack.title} Runtime Entry`,
      category: 'event',
      content: { fact: `${pack.title} loaded from a flattened folder stack.` },
    },
  },
}]));

const folderRuntimeSources = await loadLoredeckStackSources([
  { type: 'folder', folderId: eastBlueId, enabled: true, priority: 100, sortOrder: 10 },
], {
  registry: {
    schemaVersion: 1,
    packs: runtimePacks,
    folders: index.folders,
    deckPlacements: index.deckPlacements,
  },
});
assert.deepEqual(folderRuntimeSources.map(source => source.pack.id), [
  'onepiece-east-blue-core',
  'onepiece-arlong-core',
  'onepiece-arlong-villains',
]);
assert.equal(folderRuntimeSources[0].pack.stackSource.type, 'folder');
assert.equal(folderRuntimeSources[0].pack.stackSource.folderId, eastBlueId);
assert.deepEqual(folderRuntimeSources[0].pack.stackSource.folderPath, ['One Piece', 'East Blue Saga']);
assert.equal(folderRuntimeSources[0].entryFiles[0].entries.length, 1);

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-deck',
  packIds: ['onepiece-arlong-core', 'onepiece-arlong-villains'],
  dropKind: 'folder',
  dropFolderId: arlongId,
  libraryIndex: index,
}), {
  valid: true,
  action: 'move-folder',
  text: 'Move 2 Loredecks to One Piece > East Blue Saga > Arlong Park',
});

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-folder',
  folderId: onePieceId,
  folderTitle: 'One Piece',
  dropKind: 'folder',
  dropFolderId: arlongId,
  libraryIndex: index,
}), {
  valid: false,
  action: 'invalid-child',
  text: 'Cannot move One Piece into its own child folder',
});

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-folder',
  folderId: arlongId,
  folderTitle: 'Arlong Park',
  dropKind: 'folder',
  dropFolderId: arlongId,
  libraryIndex: index,
}), {
  valid: false,
  action: 'invalid-self',
  text: 'Cannot move Arlong Park into itself',
});

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-folder',
  folderId: arlongId,
  folderTitle: 'Arlong Park',
  dropKind: 'folder',
  dropFolderId: 'unfiled',
  libraryIndex: index,
}), {
  valid: false,
  action: 'invalid-unfiled',
  text: 'Folders cannot be placed inside Unfiled',
});

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'library-folder',
  folderId: arlongId,
  folderTitle: 'Arlong Park',
  dropKind: 'library',
  reparentToRoot: true,
  libraryIndex: index,
}), {
  valid: true,
  action: 'move-root',
  text: 'Move Arlong Park to Library root',
  badge: 'Move to Library root',
  root: true,
});

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'stack-item',
  stackKey: `folder:${arlongId}`,
  dropKind: 'folder',
  dropFolderId: eastBlueId,
  libraryIndex: index,
}), {
  valid: false,
  action: 'invalid-stack-folder',
  text: 'Stack Groups cannot be filed into Library folders; drag to Library to remove from Stack',
});

assert.deepEqual(resolveLoredeckLibraryDragFeedback({
  dragType: 'stack-item',
  stackKey: `folder:${arlongId}`,
  dropKind: 'library',
  libraryIndex: index,
}), {
  valid: true,
  action: 'remove-stack',
  text: 'Remove folder group from Active Stack',
  badge: 'Remove from Active Stack',
  remove: true,
});

const sortPacks = [
  { packId: 'custom-b', title: 'Custom B', type: 'custom', library: { familyOrder: 500 }, updatedAt: 2000, stats: { entryCount: 8 } },
  { packId: 'bundled-a', title: 'Bundled A', type: 'bundled', library: { familyOrder: 300 }, updatedAt: 1000, stats: { entryCount: 20 } },
  { packId: 'generated-c', title: 'Generated C', type: 'generated', updatedAt: 3000, stats: { entryCount: 2 } },
];
const explorerNamePacks = [
  { packId: 'deck-10', title: 'Deck 10' },
  { packId: 'deck-2', title: 'Deck 2' },
  { packId: 'deck-1', title: 'deck 1' },
];
const folderContentPacks = [
  { packId: 'sample-arc-z', title: 'Sample: Arc Z', library: { familyOrder: 30 } },
  { packId: 'sample-core', title: 'Sample: Core', library: { familyOrder: 90 } },
  { packId: 'sample-arc-a', title: 'Sample: Arc A', library: { familyOrder: 20 } },
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
assert.deepEqual(sortLoredeckLibraryPacks(explorerNamePacks, { sortMode: 'name' }).map(pack => pack.packId), [
  'deck-1',
  'deck-2',
  'deck-10',
]);
assert.deepEqual(sortLoredeckLibraryFolderPacks(folderContentPacks).map(pack => pack.packId), [
  'sample-core',
  'sample-arc-a',
  'sample-arc-z',
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
assert.deepEqual(sortLoredeckLibraryFolderTreeByTitle([
  { id: 'folder_z', title: 'Zeta', children: [{ id: 'folder_z__10', title: 'Arc 10' }, { id: 'folder_z__2', title: 'Arc 2' }] },
  { id: 'folder_a', title: 'alpha', children: [] },
]).map(folder => [folder.id, folder.children.map(child => child.id)]), [
  ['folder_a', []],
  ['folder_z', ['folder_z__2', 'folder_z__10']],
]);

const { MODULE_KEY } = await import('../../src/state/constants.js');
const legacySettingsLibrary = {
  schemaVersion: 1,
  packs: {
    'imported-zip-deck': {
      packId: 'imported-zip-deck',
      type: 'custom',
      title: 'Imported Zip Deck',
      source: {
        kind: 'imported_zip',
        bundleType: 'saga_loredeck_zip_package',
      },
      library: {
        suggestedPath: ['Package Root', 'Package Child'],
        folderId: 'folder_package_root__package_child',
      },
      manifestData: {
        id: 'imported-zip-deck',
        title: 'Imported Zip Deck',
        files: [],
        library: {
          suggestedPath: ['Package Root', 'Package Child'],
        },
      },
      entryOverrides: {
        imported_fact: {
          id: 'imported_fact',
          title: 'Imported Fact',
          content: { fact: 'Imported lore.' },
        },
      },
    },
    'local-deck': {
      packId: 'local-deck',
      type: 'custom',
      title: 'Local Deck',
    },
  },
  folders: [
    { id: 'folder_package_root', title: 'Package Root', parentId: '' },
    { id: 'folder_package_root__package_child', title: 'Package Child', parentId: 'folder_package_root' },
    { id: 'folder_kept', title: 'Kept', parentId: '' },
  ],
  deckPlacements: [
    { deckId: 'imported-zip-deck', folderId: 'folder_package_root__package_child', sortOrder: 100 },
    { deckId: 'local-deck', folderId: 'folder_kept', sortOrder: 200 },
  ],
};
let extensionSettings = {
  [MODULE_KEY]: {
    loredeckLibrary: legacySettingsLibrary,
  },
};
globalThis.SillyTavern = {
  getContext() {
    return { extensionSettings };
  },
};
const { getSettings } = await import('../../src/state/state-manager.js');
const importedZipSettings = getSettings();
assert.deepEqual(importedZipSettings.loredeckLibrary.packs, {});
assert.deepEqual(importedZipSettings.loredeckLibrary.folders, []);
assert.deepEqual(importedZipSettings.loredeckLibrary.deckPlacements, []);
assert.deepEqual(importedZipSettings.loredeckLibrary.activeStack, []);
assert.deepEqual(extensionSettings[MODULE_KEY].loredeckLibrary.packs, {});

const normalizedExternalLibrary = normalizeSagaLibraryIndex(legacySettingsLibrary, { now: 1 });
const importedZipDeck = normalizedExternalLibrary.packs['imported-zip-deck'];
assert.ok(importedZipDeck);
assert.equal(importedZipDeck.library, undefined);
assert.equal(importedZipDeck.manifestData, undefined);
assert.equal(importedZipDeck.entryOverrides, undefined);
assert.ok((normalizedExternalLibrary.deckPlacements || []).some(item => item.deckId === 'imported-zip-deck' && item.folderId === 'folder_package_root__package_child'));
assert.ok((normalizedExternalLibrary.folders || []).some(item => item.id === 'folder_package_root__package_child'));
assert.ok((normalizedExternalLibrary.deckPlacements || []).some(item => item.deckId === 'local-deck' && item.folderId === 'folder_kept'));
assert.ok((normalizedExternalLibrary.folders || []).some(item => item.id === 'folder_kept'));

const { normalizeLoredeckRegistry } = await import('../../src/state/lore-state-normalizers.js');
const importedZipRuntimeRegistry = normalizeLoredeckRegistry({
  schemaVersion: 1,
  packs: {
    'imported-zip-deck': {
      packId: 'imported-zip-deck',
      type: 'custom',
      title: 'Imported Zip Deck',
      source: {
        kind: 'imported_zip',
        bundleType: 'saga_loredeck_zip_package',
      },
      library: {
        suggestedPath: ['Package Root', 'Package Child'],
      },
      manifestData: {
        id: 'imported-zip-deck',
        title: 'Imported Zip Deck',
        files: [],
        library: {
          suggestedPath: ['Package Root', 'Package Child'],
        },
      },
    },
  },
  folders: [
    { id: 'folder_package_root', title: 'Package Root', parentId: '' },
    { id: 'folder_package_root__package_child', title: 'Package Child', parentId: 'folder_package_root' },
  ],
  deckPlacements: [
    { deckId: 'imported-zip-deck', folderId: 'folder_package_root__package_child', sortOrder: 100 },
  ],
}, { schemaVersion: 1, packs: {} });
assert.ok(
  (importedZipRuntimeRegistry.deckPlacements || []).some(item => item.deckId === 'imported-zip-deck' && item.folderId === 'folder_package_root__package_child'),
  'Explicit deck placements for imported zip decks must survive registry normalization.',
);
assert.ok(
  (importedZipRuntimeRegistry.folders || []).some(item => item.id === 'folder_package_root__package_child'),
  'Folders used by imported zip deck placements must survive registry normalization.',
);
assert.ok(
  (importedZipRuntimeRegistry.folders || []).some(item => item.id === 'folder_package_root'),
  'Ancestor folders of imported zip deck placements must survive registry normalization.',
);
const importedZipRuntimePack = importedZipRuntimeRegistry.packs['imported-zip-deck'];
assert.equal(importedZipRuntimePack.library, undefined, 'Imported zip packs must not retain live library metadata (anti-respawn).');
assert.equal(importedZipRuntimePack.manifestData?.library, undefined, 'Imported zip pack manifest data must not retain live library metadata (anti-respawn).');

console.log('Loredeck Library folder tests passed.');
