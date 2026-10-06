import assert from 'node:assert/strict';
const previous = { dataset: {}, classList: { contains: () => true, add() {}, remove() {}, toggle() {} },
    style: { setProperty() {} }, querySelector: () => null, remove() { this.removed = true; },
    addEventListener() {}, removeEventListener() {}, appendChild() {} };
Object.defineProperty(previous, 'innerHTML', { set() { throw new Error('fixture render failure'); } });
const metadata = {};
globalThis.SillyTavern = { getContext: () => ({ chatMetadata: metadata,
    extensionSettings: { saga: { enabled: true, runtimeWindowOpen: true } }, saveMetadata() {}, saveSettingsDebounced() {} }) };
globalThis.window = { innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
globalThis.document = { getElementById: () => previous, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, body: { appendChild() {} },
    createElement: () => {
        const root = { ...previous, dataset: {}, style: { setProperty() {} } };
        Object.defineProperty(root, 'innerHTML', { set() { throw new Error('fixture render failure'); } });
        return root;
    } };
globalThis.requestAnimationFrame = () => 0;
const { refreshLorePanel } = await import('../../src/runtime/lore-panel.js');
const errors = [];
const previousError = console.error;
console.error = (...args) => errors.push(args);
try { assert.doesNotThrow(() => refreshLorePanel(), 'a failed refresh must recover without escaping into prompt/event handlers'); }
finally { console.error = previousError; }
assert.equal(errors.length, 2, 'normal and fallback failures must be visible');
assert.ok(errors.every(args => args[1].message === 'fixture render failure'));
assert.equal(previous.removed, undefined, 'retain existing view when replacement cannot render');

const { createRuntimeRenderOwner } = await import('../../src/runtime/runtime-render-owner.js');
assert.throws(() => createRuntimeRenderOwner({}), /createRoot.*renderShell.*renderFallback.*commitRoot/);
const committed = [];
let roots = 0;
let failFallback = false;
const owner = createRuntimeRenderOwner({
    createRoot: () => ({ id: ++roots }),
    renderShell: () => { throw new Error('normal renderer failed'); },
    renderFallback: (root, state, error) => {
        if (failFallback) throw new Error('fallback failed');
        root.content = error.message;
    },
    commitRoot: (root, oldRoot) => committed.push({ root, oldRoot }),
});
const fallback = owner.replace(previous, {});
assert.equal(fallback.status, 'fallback');
assert.equal(fallback.root.content, 'normal renderer failed');
assert.equal(committed.length, 1);
assert.equal(committed[0].oldRoot, previous);
failFallback = true;
const preserved = owner.replace(previous, {});
assert.equal(preserved.ok, false);
assert.equal(preserved.root, previous);
assert.equal(committed.length, 1, 'failed replacement never commits a partial view');
failFallback = false;
assert.equal(owner.refresh(previous, {}, () => { throw new Error('incremental failure'); }).root.content, 'incremental failure');
console.log('Runtime refresh failure isolation passed.');
