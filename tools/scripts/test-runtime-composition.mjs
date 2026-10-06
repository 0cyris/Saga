import assert from 'node:assert/strict';
import { configureRuntimeComposition } from '../../src/runtime/runtime-composition.js';

assert.throws(() => configureRuntimeComposition({}), /Runtime composition requires function dependencies/);
const dependencies = {
    getPanelRoot: () => null, getState: () => ({}), getSettings: () => ({}),
    saveState() {}, saveSettings() {}, showLorePanel() {}, hideLorePanel() {},
    refreshPanelBody() {}, refreshHeader() {}, renderPanelBody() {}, createRuntimeRenderErrorCard() {},
};
assert.doesNotThrow(() => configureRuntimeComposition(dependencies), 'core runtime works without optional theme/notification capabilities');
assert.throws(() => configureRuntimeComposition({ ...dependencies, getState: null }), /getState/);
assert.throws(() => configureRuntimeComposition({ ...dependencies, toast: 'unsupported' }), /toast/);
assert.doesNotThrow(() => configureRuntimeComposition({ ...dependencies, toast() {}, applyRuntimeTheme() {}, refreshRuntimeRailIcons() {} }));
console.log('Runtime composition dependency contract passed.');
