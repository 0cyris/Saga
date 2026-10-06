import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateEntryContextGate } from '../../src/context/context-gating.js';
import { normalizeLoreEntryContext, normalizeLoreEntry } from '../../src/lorecards/lore-matrix.js';
import { loadContextIndexForState, clearContextIndexCache, getContextIndexSync } from '../../src/context/context-index.js';

const entry = { id: 'gated', title: 'Gated fact', content: { fact: 'fixture' } };
const index = { anchors: [{ id: 'start', packId: 'pack', sortKey: 10 }], windows: [] };
const gate = (required, current, customIndex = index) => evaluateEntryContextGate(
    { ...entry, context: required }, { loredeckContexts: { pack: current } },
    { packId: 'pack', index: customIndex, unresolvedEligible: false },
);

await test('missing positions and unknown required bounds stay unresolved', () => {
    for (const contextSortKey of [null, undefined, '', ' ', false]) {
        const result = gate({ sortKeyTo: 10 }, { contextSortKey });
        assert.equal(result.status, 'unresolved', `position ${String(contextSortKey)}`);
        assert.equal(result.eligible, false);
    }
    for (const required of [{ validFromAnchor: 'unknown' }, { validToAnchor: 'unknown' }]) {
        const result = gate(required, { contextSortKey: 20 });
        assert.equal(result.status, 'unresolved');
        assert.equal(result.eligible, false);
    }
    assert.equal(gate({ sortKeyTo: 10 }, { contextSortKey: 0 }).status, 'match', 'zero is an explicit valid position');
    assert.equal(gate({ validFromAnchor: 'start' }, { contextSortKey: 20 }).status, 'match');
});

await test('normalization preserves missing numeric bounds without inventing zero', () => {
    assert.equal(normalizeLoreEntryContext({ context: { sortKeyFrom: null, sortKeyTo: null } }).sortKeyFrom, null);
    assert.equal(normalizeLoreEntryContext({ context: { sortKeyFrom: ' ', sortKeyTo: false } }).sortKeyTo, null);
});

await test('malformed and reversed windows fail closed', () => {
    assert.equal(gate({ sortKeyFrom: 30, sortKeyTo: 10 }, { contextSortKey: 20 }).eligible, false);
    assert.equal(gate({ sortKeyFrom: 10 }, { contextSortKeyFrom: 30, contextSortKeyTo: 10 }).eligible, false);
    assert.equal(gate({ sortKeyFrom: 'invalid' }, { contextSortKey: 20 }).eligible, false);
    const normalized = normalizeLoreEntry({ ...entry, context: { sortKeyFrom: 'invalid' } });
    assert.equal(gate(normalized.context, { contextSortKey: 20 }).eligible, false, 'stored normalization must preserve malformed constraints');
    assert.equal(gate({ validFromAnchor: 'start' }, { anchorFrom: 'unknown', contextSortKey: 20 }).eligible, false);
});

await test('media identifiers use exact field aliases rather than substrings', () => {
    for (const [field, required, current] of [
        ['season', '1', '10'], ['episode', '2', '12'], ['chapter', '3', '13'],
        ['issue', '1', '11'], ['phase', 'Phase 1', 'Phase 10'], ['arc', 'War', 'Civil War'],
        ['quest', 'Main', 'Main ending'], ['gameStage', 'Stage 1', 'Stage 10'],
    ]) assert.equal(gate({ [field]: required }, { [field]: current }).status, 'mismatch', field);
    for (const [field, required, current] of [
        ['season', 'Season 01', '1'], ['episode', 'Episode 2', '02'],
        ['chapter', 'Chapter 3', '3'], ['phase', 'Phase 3', '3'], ['arc', '  CIVIL WAR ', 'Civil War'],
    ]) assert.equal(gate({ [field]: required }, { [field]: current }).status, 'match', field);
});

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
const registry = { packs: { a: { manifest: 'a/loredeck.json' }, b: { manifest: 'b/loredeck.json' } } };
const state = pack => ({ loredeckStack: [{ packId: pack, enabled: true, priority: 100 }] });
async function withFetch(run) {
    const previous = globalThis.fetch;
    const requests = [];
    const delays = new Map();
    globalThis.fetch = async url => {
        const path = new URL(url).pathname;
        const pack = path.includes('/a/') ? 'a' : 'b';
        if (path.endsWith('loredeck.json')) {
            requests.push(pack);
            const delay = delays.get(pack);
            if (delay) { delay.started.resolve(); await delay.release.promise; }
            return { ok: true, status: 200, json: async () => ({ id: pack, type: 'bundled', files: [], registries: { timeline: 'timeline.json' } }) };
        }
        return { ok: true, status: 200, json: async () => ({ schemaVersion: 1, anchors: [{ id: `${pack}.start`, sortKey: 10 }], windows: [] }) };
    };
    const pause = pack => { const delay = { started: deferred(), release: deferred() }; delays.set(pack, delay); return delay; };
    clearContextIndexCache();
    try { await run({ pause, requests }); } finally { globalThis.fetch = previous; clearContextIndexCache(); }
}

await test('old Context completion cannot replace the newer stack cache', async () => withFetch(async ({ pause }) => {
    const a = pause('a');
    const pendingA = loadContextIndexForState(state('a'), { registry });
    await a.started.promise;
    await loadContextIndexForState(state('b'), { registry });
    a.release.resolve();
    assert.deepEqual((await pendingA).packs.map(pack => pack.packId), ['a'], 'caller still receives its own result');
    assert.deepEqual((await loadContextIndexForState(state('b'), { registry })).packs.map(pack => pack.packId), ['b']);
}));

await test('old finalizer cannot clear a newer in-flight Context request', async () => withFetch(async ({ pause, requests }) => {
    const a = pause('a'); const b = pause('b');
    const pendingA = loadContextIndexForState(state('a'), { registry });
    await a.started.promise;
    const pendingB = loadContextIndexForState(state('b'), { registry });
    await b.started.promise;
    a.release.resolve(); await pendingA;
    const joinedB = loadContextIndexForState(state('b'), { registry });
    b.release.resolve();
    for (const result of await Promise.all([pendingB, joinedB])) assert.deepEqual(result.packs.map(pack => pack.packId), ['b']);
    assert.equal(requests.filter(pack => pack === 'b').length, 1);
}));

await test('cache invalidation revokes pending publication', async () => withFetch(async ({ pause }) => {
    const a = pause('a');
    const pending = loadContextIndexForState(state('a'), { registry });
    await a.started.promise;
    clearContextIndexCache();
    a.release.resolve(); await pending;
    assert.equal(getContextIndexSync(), null);
}));
