import assert from 'node:assert/strict';
import { getDefaultState, MODULE_KEY } from '../../src/state/constants.js';
import { getState } from '../../src/state/state-manager.js';

const state = getDefaultState();
state.stateHistory = ['retired'.repeat(50000)];
let legacyCalls = 0;
const boundWrites = [];
const context = { chatId: 'origin-A', chatMetadata: { [MODULE_KEY]: state }, extensionSettings: {},
    saveMetadata() { legacyCalls += 1; }, saveSettingsDebounced() {},
    sagaPersistence: { originBound: true, async saveState(request) { boundWrites.push(request); return { ok: true, persisted: true }; } },
};
globalThis.SillyTavern = { getContext: () => context };
const result = getState();
await new Promise(resolve => setImmediate(resolve));
assert.equal(result.stateHistory, undefined);
assert.equal(legacyCalls, 0, 'read-time compaction must use the owned persistence capability');
assert.equal(boundWrites.length, 1);
assert.equal(boundWrites[0].origin.chatId, 'origin-A');
assert.equal(boundWrites[0].snapshot[MODULE_KEY].stateHistory, undefined);
assert.notEqual(boundWrites[0].snapshot, context.chatMetadata, 'transport gets an immutable snapshot');
getState();
await new Promise(resolve => setImmediate(resolve));
assert.equal(boundWrites.length, 1, 'read caching must not schedule duplicate compaction writes');
console.log('Read-time state persistence ownership passed.');
