import assert from 'node:assert/strict';
import test from 'node:test';
import { importState } from '../../src/state/state-manager.js';
import { SCHEMA_VERSION } from '../../src/state/schema.js';

globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {}, saveSettingsDebounced() {} }) };
const card = { id: 'manual', title: 'Manual card', content: { fact: 'fixture' },
    extensions: { autoRelevance: { mode: 'manual', locked: true } } };
for (let version = 20; version <= 26; version += 1) {
    await test(`supported schema ${version} runs versioned migrations`, () => {
        const result = importState(JSON.stringify({ _version: version, loreMatrix: [card],
            lorePanel: { lorecardWorkspaceSort: 'relevance' }, scene: { location: `version-${version}` } }));
        assert.equal(result.error, null);
        assert.equal(result.state._version, SCHEMA_VERSION);
        assert.equal(result.state.scene.location, `version-${version}`);
        assert.equal(result.state.lorePanel.lorecardWorkspaceSort, 'alphabetical', 'v27 migration must run');
        if (version < 25) assert.equal(result.state.loreMatrix[0].extensions.loreAutomation.enabled, false, 'legacy manual lock is preserved');
        assert.ok(result.state.loreAutomationCadence);
    });
}
await test('current-version explicit choices survive import', () => {
    const result = importState(JSON.stringify({ _version: SCHEMA_VERSION,
        lorePanel: { lorecardWorkspaceSort: 'relevance' },
        loreMatrix: [{ ...card, extensions: { loreAutomation: { enabled: false } } }] }));
    assert.equal(result.error, null);
    assert.equal(result.state.lorePanel.lorecardWorkspaceSort, 'relevance');
    assert.equal(result.state.loreMatrix[0].extensions.loreAutomation.enabled, false);
});
await test('unsupported and fractional schema versions fail detectably', () => {
    for (const version of [19, SCHEMA_VERSION + 1, 24.5]) assert.ok(importState(JSON.stringify({ _version: version })).error);
    assert.ok(importState('{}').error);
});
