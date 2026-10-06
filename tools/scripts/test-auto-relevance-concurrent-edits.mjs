import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, MODULE_KEY, getDefaultState } from '../../src/state/constants.js';
import { getState, saveStateDurable } from '../../src/state/state-manager.js';
import { runAutoRelevance } from '../../src/context/auto-relevance.js';

const clone = value => JSON.parse(JSON.stringify(value));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
let current;
globalThis.SillyTavern = { getContext: () => current };
for (const [name, edit] of [
    ['unrelated scene and new card', state => { state.scene.location = 'Manually edited location'; state.loreMatrix.push({ id: 'new-card', title: 'Manual card', content: { fact: 'Keep this new fact.' } }); }],
    ['removed card', state => { state.loreMatrix = []; }],
    ['manual opt-out and content', state => { state.loreMatrix[0].extensions.loreAutomation.enabled = false; state.loreMatrix[0].content.fact = 'Manually edited fact.'; }],
]) {
    const resultGate = deferred(); const started = deferred(); const writes = [];
    const source = getDefaultState();
    source.scene.presentCharacters = ['Alice'];
    source.loreMatrix = [{ id: 'alice', title: 'Alice', relevance: 'low', content: { fact: 'Alice enters the harbor.' },
        extensions: { loreAutomation: { enabled: true } } }];
    current = { chatId: `concurrent-${name}`, chatMetadata: { [MODULE_KEY]: source },
        chat: [{ is_user: true, name: 'User', mes: 'Alice enters the harbor.' }],
        extensionSettings: { [MODULE_KEY]: { ...clone(DEFAULT_SETTINGS), enabled: true, loreAutomationMode: 'ar',
            autoRelevanceEnabled: true, loreAutomationProviderRouting: 'utility', continuityProvider: 'st' } },
        saveSettingsDebounced() {},
        sagaPersistence: { originBound: true, async saveState(request) { writes.push(request.snapshot); return { ok: true, persisted: true }; } },
        generateRaw: async () => { started.resolve(); return resultGate.promise; },
    };
    const job = runAutoRelevance({ force: true, forceProvider: true });
    await started.promise;
    const live = getState(); edit(live);
    assert.equal((await saveStateDurable(live, { syncPrompt: false })).ok, true);
    const expected = clone(getState()); const savedCount = writes.length;
    resultGate.resolve('{"changes":[{"id":"alice","relevance":"high","confidence":1}]}');
    const result = await job;
    assert.equal(JSON.stringify(getState()) === JSON.stringify(expected), true, `${name}: stale automation must preserve concurrent edits`);
    assert.equal(result.status, 'cancelled');
    assert.match(result.reason, /changed/i);
    assert.equal(writes.length, savedCount, 'A stale draft must never reach persistence.');
    console.log(`PASS ${name}`);
}
