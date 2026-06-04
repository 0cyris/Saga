import assert from 'node:assert/strict';

let saveMetadataCount = 0;

const ctx = {
  chatMetadata: {},
  extensionSettings: {},
  saveMetadata() {
    saveMetadataCount += 1;
  },
  saveSettingsDebounced() {},
};

globalThis.SillyTavern = {
  getContext() {
    return ctx;
  },
};

const { appendPendingLoreEntries, getState } = await import('../state-manager.js');

const result = appendPendingLoreEntries([{
  id: 'mcu_wanda_sokovia_pending',
  title: 'Wanda After Sokovia',
  kind: 'knowledge_gate',
  category: 'character',
  canon: 'canon',
  priority: 70,
  source: 'canon-lore-db:mcu-infinity-saga:characters/wanda.json',
  sourceInfo: {
    work: 'Marvel Cinematic Universe',
    book: 'Avengers: Age of Ultron',
    chapter: 'Sokovia',
  },
  position: {
    validFromAnchor: 'mcu.age_of_ultron',
    validToAnchor: 'mcu.civil_war',
    arc: 'Sokovia aftermath',
    precision: 'anchor_window',
    label: 'After Sokovia, before Civil War',
  },
  coordinates: [{
    axis: 'adaptation',
    id: 'mcu',
    label: 'MCU',
  }],
  content: {
    fact: 'After Sokovia, Wanda Maximoff is publicly associated with the Avengers and the Sokovia incident.',
  },
  extensions: {
    sagaLorepack: {
      packId: 'mcu-infinity-saga',
      packType: 'custom',
      packTitle: 'Marvel: MCU Infinity Saga',
      file: 'characters/wanda.json',
      stackPriority: 100,
      stackIndex: 0,
    },
    sagaPositionGate: {
      status: 'match',
      hasGate: true,
      eligible: true,
      matchedBy: 'date_position',
      reason: 'Entry position matched active Story Position.',
      packId: 'mcu-infinity-saga',
    },
  },
}], { source: 'test' }, { syncPrompt: false, full: true });

assert.equal(result.changed, true);
assert.equal(result.pendingCount, 1);
assert.equal(saveMetadataCount, 1);

const state = getState();
const stored = state.pendingLoreEntries[0];

assert.equal(stored.position.validFromAnchor, 'mcu.age_of_ultron');
assert.equal(stored.position.validToAnchor, 'mcu.civil_war');
assert.equal(stored.position.label, 'After Sokovia, before Civil War');
assert.equal(stored.coordinates.length, 1);
assert.equal(stored.coordinates[0].axis, 'adaptation');
assert.equal(stored.coordinates[0].id, 'mcu');
assert.equal(stored.extensions.sagaLorepack.packId, 'mcu-infinity-saga');
assert.equal(stored.extensions.sagaLorepack.packTitle, 'Marvel: MCU Infinity Saga');
assert.equal(stored.extensions.sagaPositionGate.status, 'match');
assert.equal(stored.extensions.sagaPositionGate.matchedBy, 'date_position');

console.log('Pending position storage test passed.');
