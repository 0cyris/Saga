import assert from 'node:assert/strict';
class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.handlers = new Map();
        this.style = { setProperty() {} }; this.attributes = new Map();
        const classes = new Set();
        this.classList = { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)),
            contains: name => classes.has(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) };
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(name, handler) { this.handlers.set(name, handler); }
    removeEventListener(name) { this.handlers.delete(name); }
    appendChild(child) { this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    remove() { this.removed = true; }
}
const documentHandlers = new Map();
const timers = new Map();
let nextTimer = 0;
globalThis.setTimeout = callback => { const id = ++nextTimer; timers.set(id, callback); return id; };
globalThis.clearTimeout = id => timers.delete(id);
const metadata = {};
const root = new Element();
globalThis.window = { innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
globalThis.document = { createElement: tag => new Element(tag), body: new Element('body'),
    getElementById: id => id === 'saga-lore-panel' ? root : null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (name, handler) => {
        const listeners = documentHandlers.get(name) || new Set(); listeners.add(handler); documentHandlers.set(name, listeners);
    }, removeEventListener: (name, handler) => {
        const listeners = documentHandlers.get(name); listeners?.delete(handler); if (!listeners?.size) documentHandlers.delete(name);
    } };
globalThis.SillyTavern = { getContext: () => ({ chatMetadata: metadata,
    extensionSettings: { saga: { enabled: true, experienceMode: 'advanced', runtimeWindowOpen: true } },
    saveMetadata: () => ({ ok: true, persisted: true }), saveSettingsDebounced() {} }) };
const { hideLorePanel } = await import('../../src/runtime/lore-panel.js');
const { configureRuntimeShellView, renderPanelShell } = await import('../../src/runtime/runtime-shell-view.js');
const { getState } = await import('../../src/state/state-manager.js');
let shows = 0;
configureRuntimeShellView({ renderRailMetric() {}, showRuntimePanel() { shows += 1; } });
const state = getState();
state.lorePanel.drawerOpen = false;
renderPanelShell(root, state);
const descendants = element => [element, ...element.children.flatMap(descendants)];
const button = descendants(root).find(element => element.tagName === 'BUTTON' && element.dataset.tabId === 'lore');
assert.ok(button);
button.handlers.get('click')({ stopPropagation() {} });
assert.equal(documentHandlers.size, 2);
const stalePointer = [...documentHandlers.get('pointerdown')][0];
stalePointer({ target: null });
assert.equal(timers.size, 1, 'outside-click close is scheduled');
hideLorePanel();
assert.equal(documentHandlers.size, 0, 'closing the view tears down document listeners');
assert.equal(timers.size, 0, 'closing the view cancels delayed flyout callbacks');
stalePointer({ target: null });
for (const callback of timers.values()) callback();
assert.equal(shows, 1, 'stale callbacks cannot reopen the hidden runtime');
console.log('Runtime view disposal passed.');

const { configureRuntimeShell, onRuntimeRailDragStart, onRuntimeDrawerResizeStart } = await import('../../src/runtime/runtime-shell.js');
const interactionRoot = new Element();
const drawer = new Element();
interactionRoot.getBoundingClientRect = () => ({ left: 20, top: 20, width: 60, height: 400 });
drawer.getBoundingClientRect = () => ({ left: 88, top: 20, width: 420, height: 500 });
interactionRoot.querySelector = selector => selector === '.saga-runtime-drawer' ? drawer : null;
let activeRoot = interactionRoot;
let geometrySaves = 0;
configureRuntimeShell({ getPanelRoot: () => activeRoot, getState: () => state, saveState: () => { geometrySaves += 1; } });
onRuntimeRailDragStart({ target: { closest: () => null }, clientX: 25, clientY: 25 });
assert.ok(documentHandlers.has('mousemove'));
const staleDragEnd = [...documentHandlers.get('mouseup')][0];
activeRoot = null;
staleDragEnd();
assert.equal(documentHandlers.size, 0, 'ending a drag after the root disappears still releases listeners');
assert.equal(interactionRoot.classList.contains('saga-runtime-dragging'), false);
activeRoot = interactionRoot;
onRuntimeRailDragStart({ target: { closest: () => null }, clientX: 25, clientY: 25 });
let released = 0;
const handle = { setPointerCapture() {}, releasePointerCapture(id) { assert.equal(id, 7); released += 1; } };
onRuntimeDrawerResizeStart({ button: 0, clientX: 500, clientY: 500, pointerId: 7, currentTarget: handle,
    preventDefault() {}, stopPropagation() {} });
assert.equal(documentHandlers.size, 5);
const staleResizeEnd = [...documentHandlers.get('pointerup')][0];
hideLorePanel();
assert.equal(documentHandlers.size, 0, 'hiding during drag/resize releases every document listener');
assert.equal(interactionRoot.classList.contains('saga-runtime-dragging'), false);
assert.equal(drawer.classList.contains('saga-lore-panel-resizing'), false);
assert.equal(released, 1, 'hiding releases owned pointer capture');
staleDragEnd();
staleResizeEnd();
assert.equal(geometrySaves, 0, 'stale interaction callbacks cannot persist geometry');
assert.equal(released, 1, 'teardown is idempotent');
console.log('Runtime interaction disposal passed.');
