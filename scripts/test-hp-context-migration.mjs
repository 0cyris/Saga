import assert from 'node:assert/strict';
import './test-hp-loredeck-family-split.mjs';
import { SCHEMA_VERSION } from '../constants.js';
import {
  DEFAULT_HP_LOREDECK_FOLDER_ID,
  DEFAULT_HP_LOREDECK_ID,
  DEFAULT_HP_LOREDECK_IDS,
  HP_LEGACY_LOREDECK_ID,
} from '../loredeck-defaults.js';
import { migrateState } from '../state-manager.js';

globalThis.SillyTavern = {
  getContext() {
    return { extensionSettings: {} };
  },
};

const migrated = migrateState({
  _version: 21,
  loreContext: {},
  loreMatrix: [],
  pendingLoreEntries: [],
  loredeckStack: [
    { packId: HP_LEGACY_LOREDECK_ID, enabled: true, priority: 100, addedAt: 1 },
  ],
  loredeckRegistry: {
    schemaVersion: 1,
    packs: {
      [HP_LEGACY_LOREDECK_ID]: {
        packId: HP_LEGACY_LOREDECK_ID,
        type: 'bundled',
        title: 'Harry Potter: Golden Trio',
        stats: { entryCount: 431 },
      },
    },
    deckPlacements: [
      { deckId: HP_LEGACY_LOREDECK_ID, folderId: 'legacy-hp', sortOrder: 1 },
    ],
    activeStack: [
      { packId: HP_LEGACY_LOREDECK_ID, enabled: true, priority: 100 },
    ],
  },
  loredeckContexts: {
    [HP_LEGACY_LOREDECK_ID]: {
      packId: HP_LEGACY_LOREDECK_ID,
      contextType: 'calendar',
      label: 'Legacy HP',
    },
  },
  lorePanel: {
    selectedLoredeckId: HP_LEGACY_LOREDECK_ID,
  },
});

assert.equal(migrated._version, SCHEMA_VERSION);
assert.equal(migrated.lorePanel.selectedLoredeckId, DEFAULT_HP_LOREDECK_ID);
assert.equal(migrated.loredeckStack.length, 1);
assert.equal(migrated.loredeckStack[0].type, 'folder');
assert.equal(migrated.loredeckStack[0].folderId, DEFAULT_HP_LOREDECK_FOLDER_ID);
assert.equal(migrated.loredeckStack[0].includeNested, true);
assert.ok(!migrated.loredeckStack.some(item => item.packId === HP_LEGACY_LOREDECK_ID));
assert.ok(!migrated.loredeckRegistry.packs[HP_LEGACY_LOREDECK_ID]);
assert.ok(!migrated.loredeckContexts[HP_LEGACY_LOREDECK_ID]);
assert.ok(!(migrated.loredeckRegistry.deckPlacements || []).some(item => item.deckId === HP_LEGACY_LOREDECK_ID || item.packId === HP_LEGACY_LOREDECK_ID));

for (const deckId of DEFAULT_HP_LOREDECK_IDS) {
  assert.ok(migrated.loredeckRegistry.packs[deckId], `${deckId} should be present in the migrated registry.`);
  assert.ok(migrated.loredeckContexts[deckId], `${deckId} should have a migrated Context state.`);
}

console.log('HP Context migration tests passed.');
