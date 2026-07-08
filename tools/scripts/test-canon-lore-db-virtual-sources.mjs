import assert from 'node:assert/strict';

const ctx = {
  chatMetadata: {},
  extensionSettings: {},
  saveMetadata() {},
  saveSettingsDebounced() {},
};
globalThis.SillyTavern = {
  getContext() {
    return ctx;
  },
};

const { getState } = await import('../../src/state/state-manager.js');
const { clearCanonLoreDatabaseCache, loadCanonLoreDatabase } = await import('../../src/context/canon-lore-db.js');

const state = getState();
state.loredeckStack = [
  { packId: 'arlong-park-imported', enabled: true, priority: 100, addedAt: 0 },
  { packId: 'broken-virtual-pack', enabled: true, priority: 90, addedAt: 0 },
];
state.loredeckRegistry = {
  schemaVersion: 1,
  packs: {
    'arlong-park-imported': {
      packId: 'arlong-park-imported',
      type: 'custom',
      title: 'Arlong Park Imported',
      entrySchemaVersion: 3,
      manifest: '',
      manifestData: {
        schemaVersion: 3,
        id: 'arlong-park-imported',
        type: 'custom',
        title: 'Arlong Park Imported',
        entrySchemaVersion: 3,
        files: [],
        stats: { entryCount: 1, categoryCounts: { character: 1 } },
      },
      timelineRegistry: {
        anchors: [
          { id: 'arlong_park.start', label: 'Start', sortKey: 100 },
          { id: 'arlong_park.end', label: 'End', sortKey: 200 },
        ],
      },
      tagRegistry: {
        tags: {
          'character:arlong': { label: 'Arlong' },
        },
      },
      entryOverrides: {
        arlong_custom_import: {
          schemaVersion: 3,
          id: 'arlong_custom_import',
          title: 'Arlong imported as Custom',
          category: 'character',
          priority: 72,
          tags: ['character:arlong'],
          context: {
            scope: 'window',
            validFromAnchor: 'arlong_park.start',
            validToAnchor: 'arlong_park.end',
            sortKeyFrom: 100,
            sortKeyTo: 200,
            precision: 'anchor_window',
            windowKind: 'bounded',
            label: 'Arlong Park Arc',
          },
          retrieval: {
            activation: 'topic_or_entity',
            frequency: 'normal',
            contextBoost: 'medium',
          },
          content: {
            fact: 'Imported Arlong remains coercive and cruel.',
            injection: 'Arlong should remain coercive and cruel in this imported Custom deck.',
          },
        },
      },
    },
    'broken-virtual-pack': {
      packId: 'broken-virtual-pack',
      type: 'custom',
      title: 'Broken Virtual Pack',
      entrySchemaVersion: 3,
      manifest: '',
      manifestData: {
        schemaVersion: 3,
        id: 'broken-virtual-pack',
        type: 'custom',
        title: 'Broken Virtual Pack',
        entrySchemaVersion: 3,
        files: [],
        stats: { entryCount: 0, categoryCounts: {} },
      },
    },
  },
};

clearCanonLoreDatabaseCache();
const db = await loadCanonLoreDatabase();

assert.ok(
  db.entries.some(entry => entry.id === 'arlong_custom_import'),
  'Expected the Custom-imported deck entry to appear in the canon lore database.',
);

const customPack = db.loredecks.find(pack => pack.id === 'arlong-park-imported');
assert.ok(customPack, 'Expected the Custom-imported deck to appear in db.loredecks.');
assert.equal(customPack.sourceKind, 'custom_virtual');
assert.equal(customPack.entryCount, 1);

assert.ok(
  !db.loredecks.some(pack => pack.id === 'broken-virtual-pack'),
  'A virtual source with no resolvable entries should still be excluded from the canon lore database.',
);

console.log('Canon lore DB virtual source inclusion tests passed.');
