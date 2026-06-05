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
  context: {
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
    sagaLoredeck: {
      packId: 'mcu-infinity-saga',
      packType: 'custom',
      packTitle: 'Marvel: MCU Infinity Saga',
      file: 'characters/wanda.json',
      stackPriority: 100,
      stackIndex: 0,
    },
    sagaContextGate: {
      status: 'match',
      hasGate: true,
      eligible: true,
      matchedBy: 'date_context',
      reason: 'Entry Context matched active Context.',
      packId: 'mcu-infinity-saga',
    },
  },
}], { source: 'test' }, { syncPrompt: false, full: true });

assert.equal(result.changed, true);
assert.equal(result.pendingCount, 1);
assert.equal(saveMetadataCount, 1);

const state = getState();
const stored = state.pendingLoreEntries[0];

assert.equal(stored.context.validFromAnchor, 'mcu.age_of_ultron');
assert.equal(stored.context.validToAnchor, 'mcu.civil_war');
assert.equal(stored.context.label, 'After Sokovia, before Civil War');
assert.equal(stored.coordinates.length, 1);
assert.equal(stored.coordinates[0].axis, 'adaptation');
assert.equal(stored.coordinates[0].id, 'mcu');
assert.equal(stored.extensions.sagaLoredeck.packId, 'mcu-infinity-saga');
assert.equal(stored.extensions.sagaLoredeck.packTitle, 'Marvel: MCU Infinity Saga');
assert.equal(stored.extensions.sagaContextGate.status, 'match');
assert.equal(stored.extensions.sagaContextGate.matchedBy, 'date_context');

console.log('Pending Context storage test passed.');
