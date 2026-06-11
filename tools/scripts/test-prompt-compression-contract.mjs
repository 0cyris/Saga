import assert from 'node:assert/strict';

const sagaSettings = {
  injectLore: true,
  loreHighInjectionEnabled: true,
  loreHighInjectionMode: 'compressed',
  loreHighMaxEntries: 5,
  loreCompressionPromptTemplate: 'Compress {{directText}}',
  loreHighCompressionLevel: 3,
};

globalThis.SillyTavern = {
  getContext: () => ({
    extensionSettings: { saga: sagaSettings },
    chat: [],
  }),
};

const {
  buildLorePreview,
  getCompressionSourceSignature,
} = await import('../../src/continuity/memo-builder.js');

const state = {
  loreSelection: {
    pinnedIds: ['harry-secret'],
    suppressedIds: [],
  },
  loreMatrix: [{
    id: 'harry-secret',
    title: 'Harry Secret',
    relevance: 'high',
    priority: 100,
    status: 'active',
    injectableByDefault: true,
    content: {
      injection: 'Harry knows the hidden passage.',
    },
  }],
};

const direct = buildLorePreview(state, 'direct', 'high');
assert.equal(direct, '## High-Relevance Lore\n- Harry knows the hidden passage.');

const signature = getCompressionSourceSignature(state, 'lore-high', direct, sagaSettings);
const parsedSignature = JSON.parse(signature);
assert.equal(parsedSignature.signatureVersion, 4);
assert.equal(parsedSignature.kind, 'lore-high');
assert.equal(parsedSignature.compressionLevel, 3);
assert.equal(parsedSignature.pinnedLoreIds, 'harry-secret');

state.loreCompressionStatusByRelevance = {
  high: {
    lastSignature: signature,
    cachedText: 'COMPRESSED HIGH LORE',
  },
};

assert.equal(
  buildLorePreview(state, 'compressed', 'high'),
  'COMPRESSED HIGH LORE',
  'Matching high-relevance compression cache must replace the direct lore prompt.'
);

state.loreCompressionStatusByRelevance.high.lastSignature = 'stale-signature';
assert.equal(
  buildLorePreview(state, 'compressed', 'high'),
  direct,
  'Stale high-relevance compression cache must fall back to direct lore prompt text.'
);

const higherCompressionSignature = getCompressionSourceSignature(state, 'lore-high', direct, {
  ...sagaSettings,
  loreHighCompressionLevel: 4,
});
assert.notEqual(higherCompressionSignature, signature, 'Changing compression level must invalidate cached compression.');

const unpinnedSignature = getCompressionSourceSignature({
  ...state,
  loreSelection: {
    ...state.loreSelection,
    pinnedIds: [],
  },
}, 'lore-high', direct, sagaSettings);
assert.notEqual(unpinnedSignature, signature, 'Changing pinned lore must invalidate cached lore compression.');

console.log('Prompt compression contract passed.');
