import assert from 'node:assert/strict';
import './test-hp-loredeck-family-split.mjs';
import { MODULE_KEY, SCHEMA_VERSION } from '../../src/state/constants.js';
import {
  DEFAULT_HP_LOREDECK_STACK,
  DEFAULT_HP_LOREDECK_FOLDER_ID,
  DEFAULT_HP_LOREDECK_ID,
  DEFAULT_HP_LOREDECK_IDS,
  HP_LEGACY_LOREDECK_ID,
} from '../../src/loredecks/loredeck-defaults.js';
import { getSettings, migrateState } from '../../src/state/state-manager.js';

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
assert.equal(migrated.loredeckCreator.schemaVersion, 1);
assert.equal(migrated.loredeckCreator.activeJobId, '');
assert.deepEqual(migrated.loredeckCreator.jobs, {});
assert.equal(migrated.lorePanel.selectedLoredeckId, DEFAULT_HP_LOREDECK_ID);
assert.equal(DEFAULT_HP_LOREDECK_STACK.length, 0);
assert.equal(migrated.loredeckStack.length, 0);
assert.equal(migrated.hpDefaultLoredeckStackCleared20260605, true);
assert.ok(!migrated.loredeckStack.some(item => item.packId === HP_LEGACY_LOREDECK_ID));
assert.ok(!migrated.loredeckRegistry.packs[HP_LEGACY_LOREDECK_ID]);
assert.ok(!migrated.loredeckContexts[HP_LEGACY_LOREDECK_ID]);
assert.ok(!(migrated.loredeckRegistry.deckPlacements || []).some(item => item.deckId === HP_LEGACY_LOREDECK_ID || item.packId === HP_LEGACY_LOREDECK_ID));

for (const deckId of DEFAULT_HP_LOREDECK_IDS) {
  assert.ok(migrated.loredeckRegistry.packs[deckId], `${deckId} should be present in the migrated registry.`);
  assert.ok(migrated.loredeckContexts[deckId], `${deckId} should have a migrated Context state.`);
}

const oldDefaultStackMigrated = migrateState({
  _version: SCHEMA_VERSION,
  loreContext: {},
  loreMatrix: [],
  pendingLoreEntries: [],
  loredeckStack: [
    {
      type: 'folder',
      folderId: DEFAULT_HP_LOREDECK_FOLDER_ID,
      enabled: true,
      includeNested: true,
      collapsed: false,
      priority: 100,
    },
  ],
  loredeckRegistry: { schemaVersion: 1, packs: {} },
  loredeckContexts: {},
  lorePanel: {},
});
assert.equal(oldDefaultStackMigrated.loredeckStack.length, 0);
assert.equal(oldDefaultStackMigrated.hpDefaultLoredeckStackCleared20260605, true);

let extensionSettings = {
  [MODULE_KEY]: {
    loredeckLibrary: {
      schemaVersion: 1,
      packs: {},
      activeStack: [
        {
          type: 'folder',
          folderId: DEFAULT_HP_LOREDECK_FOLDER_ID,
          enabled: true,
          includeNested: true,
          priority: 100,
        },
      ],
    },
  },
};
globalThis.SillyTavern = {
  getContext() {
    return { extensionSettings };
  },
};
const settings = getSettings();
assert.equal(settings.loredeckLibrary.activeStack.length, 0);
assert.equal(settings.emptyLoredeckStackDefaultsMigrated20260605, true);

console.log('HP Context migration tests passed.');
