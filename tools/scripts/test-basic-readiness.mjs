import assert from 'node:assert/strict';

import { buildBasicReadinessModel } from '../../src/runtime/runtime-basic-readiness.js';

function row(model, id) {
    return model.rows.find(item => item.id === id);
}

function assertNext(input, expected, message) {
    const model = buildBasicReadinessModel(input);
    assert.equal(model.nextAction?.id, expected.id, `${message}: next action id`);
    assert.equal(model.nextAction?.actionLabel || '', expected.actionLabel || '', `${message}: action label`);
    assert.equal(model.nextAction?.targetTab || '', expected.targetTab || '', `${message}: target tab`);
    return model;
}

let model = assertNext(
    { enabledLoredecks: 0, contextCount: 0, acceptedCount: 0, pendingCount: 0, selectedLore: 0, providerReady: false },
    { id: 'loredecks', actionLabel: 'Open Library', targetTab: 'loredecks' },
    'empty stack'
);
assert.equal(row(model, 'loredecks').missingText, 'Open Library, expand a folder, and add 1-2 Loredecks', 'Empty stack should explain the Library workflow.');
assert.equal(row(model, 'context').targetTab, 'loredecks', 'Context row should route to Loredecks until a deck is loaded.');
assert.equal(row(model, 'context').label, 'Browse Context', 'Context row should be framed as the explicit Browse Context step.');

model = assertNext(
    { enabledLoredecks: 1, contextCount: 0, acceptedCount: 0, pendingCount: 0, selectedLore: 0, providerReady: false },
    { id: 'context', actionLabel: 'Browse Context', targetTab: 'context' },
    'missing Context'
);
assert.equal(row(model, 'context').missingText, 'Browse Context before starting', 'Loaded deck without Context should ask users to browse before story start.');

model = assertNext(
    { enabledLoredecks: 1, contextCount: 1, acceptedCount: 0, pendingCount: 2, selectedLore: 0, providerReady: false },
    { id: 'review', actionLabel: 'Review Lorecards', targetTab: 'lore' },
    'pending review'
);
assert.equal(row(model, 'review').missingText, '2 pending review', 'Pending review should be surfaced before prompt readiness.');

model = assertNext(
    { enabledLoredecks: 1, contextCount: 1, acceptedCount: 1, pendingCount: 0, selectedLore: 0, providerReady: false },
    { id: 'lore-ready', actionLabel: 'Review Lorecards', targetTab: 'lore' },
    'accepted lore not selected'
);
assert.equal(row(model, 'review').ready, true, 'Accepted Lorecards should satisfy the review row.');
assert.equal(row(model, 'lore-ready').missingText, 'Nothing selected for prompt', 'Accepted-but-unselected lore should explain prompt readiness.');

model = assertNext(
    { enabledLoredecks: 1, contextCount: 1, acceptedCount: 1, pendingCount: 0, selectedLore: 1, providerReady: false },
    { id: 'continue', actionLabel: '', targetTab: '' },
    'ready prompt'
);
assert.equal(model.nextAction.ready, true, 'Ready prompt should allow continuing roleplay.');
assert.equal(row(model, 'provider').optional, true, 'Provider setup must stay optional in Basic readiness.');
assert.equal(row(model, 'provider').ready, false, 'Provider can remain unconfigured while prompt is ready.');

model = assertNext(
    { sagaEnabled: false, enabledLoredecks: 1, contextCount: 1, acceptedCount: 1, pendingCount: 0, selectedLore: 1, providerReady: true },
    { id: 'active', actionLabel: 'Enable Saga', targetTab: '' },
    'paused Saga'
);
assert.equal(row(model, 'active').missingText, 'Saga is paused', 'Paused Saga should be the first Basic action.');

model = buildBasicReadinessModel({
    enabledLoredecks: 1,
    contextCount: 1,
    acceptedCount: 1,
    pendingCount: 0,
    selectedLore: 1,
    loreInjectionOn: false,
    providerReady: true,
});
assert.equal(model.nextAction.id, 'lore-ready', 'Lore injection off should block prompt readiness.');
assert.equal(row(model, 'lore-ready').missingText, 'Lore injection is off', 'Lore injection off should be explicit.');

console.log('Basic readiness contract passed.');
