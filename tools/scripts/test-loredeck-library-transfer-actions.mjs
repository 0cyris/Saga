import assert from 'node:assert/strict';
import {
  createFolderIdFromPath,
  normalizeLoredeckLibraryIndex,
} from '../../src/loredecks/loredeck-library-index.js';

globalThis.SillyTavern = {
  getContext() {
    return { extensionSettings: { saga: {} } };
  },
};

const {
  __loredeckLibraryPanelTestHooks,
  configureLoredeckLibraryPanel,
} = await import('../../src/loredecks/loredeck-library-panel.js');

function createStackFolderKey(folderId = '') {
  const id = String(folderId || '').trim();
  return id ? `folder:${id}` : '';
}

function createStackDeckKey(packId = '') {
  const id = String(packId || '').trim();
  return id ? `deck:${id}` : '';
}

function getStackItemKey(item = {}) {
  const type = item?.type === 'folder' || item?.folderId ? 'folder' : 'deck';
  const id = type === 'folder'
    ? String(item?.folderId || '').trim()
    : String(item?.packId || item?.deckId || '').trim();
  return id ? `${type}:${id}` : '';
}

configureLoredeckLibraryPanel({
  createLoredeckStackDeckKey: createStackDeckKey,
  createLoredeckStackFolderKey: createStackFolderKey,
  getLoredeckStackItemKey: getStackItemKey,
});

const packs = {
  'series-core': {
    title: 'Series Core',
    library: { suggestedPath: ['Series'], familyOrder: 10 },
  },
  'series-arc': {
    title: 'Series Arc',
    library: { suggestedPath: ['Series', 'Arc'], familyOrder: 20 },
  },
};
const library = Object.entries(packs).map(([packId, pack]) => ({ packId, ...pack }));
const libraryIndex = normalizeLoredeckLibraryIndex({}, { packs });
const seriesId = createFolderIdFromPath(['Series']);
const selectedFolder = libraryIndex.folders.find(folder => folder.id === seriesId);

const activeFolder = __loredeckLibraryPanelTestHooks.getLoredeckLibraryTransferActionModel({
  selectedFolder,
  stack: [{ type: 'folder', folderId: seriesId, enabled: true, sortOrder: 10 }],
  libraryIndex,
  library,
  filteredPacks: library,
});
assert.equal(activeFolder.addDisabled, true);
assert.equal(activeFolder.removeDisabled, false);
assert.equal(activeFolder.selectedFolderStackKey, `folder:${seriesId}`);
assert.equal(activeFolder.removeLabel, '< Remove from Stack');

const disabledFolder = __loredeckLibraryPanelTestHooks.getLoredeckLibraryTransferActionModel({
  selectedFolder,
  stack: [{ type: 'folder', folderId: seriesId, enabled: false, sortOrder: 10 }],
  libraryIndex,
  library,
  filteredPacks: library,
});
assert.equal(disabledFolder.addDisabled, false);
assert.equal(disabledFolder.addLabel, 'Enable Folder >');
assert.equal(disabledFolder.removeDisabled, false);
assert.equal(disabledFolder.selectedFolderStackKey, `folder:${seriesId}`);

const inactiveFolder = __loredeckLibraryPanelTestHooks.getLoredeckLibraryTransferActionModel({
  selectedFolder,
  stack: [],
  libraryIndex,
  library,
  filteredPacks: library,
});
assert.equal(inactiveFolder.addDisabled, false);
assert.equal(inactiveFolder.removeDisabled, true);
assert.equal(inactiveFolder.selectedFolderStackKey, '');

console.log('Loredeck Library transfer action tests passed.');
