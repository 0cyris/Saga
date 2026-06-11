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
assert.equal(row(model, 'loredecks').missingText, 'Open Loredeck Library and add a deck to the stack', 'Empty stack should explain the Library workflow.');
assert.equal(row(model, 'context').targetTab, 'loredecks', 'Context row should route to Loredecks until a deck is loaded.');

model = assertNext(
    { enabledLoredecks: 1, contextCount: 0, acceptedCount: 0, pendingCount: 0, selectedLore: 0, providerReady: false },
    { id: 'context', actionLabel: 'Set Context', targetTab: 'context' },
    'missing Context'
);
assert.equal(row(model, 'context').missingText, 'Story position missing', 'Loaded deck without Context should ask for story position.');

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
