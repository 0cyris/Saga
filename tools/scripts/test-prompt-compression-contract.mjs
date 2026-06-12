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
const {
  __injectionPreviewTestHooks,
} = await import('../../src/runtime/injection-preview-panel.js');

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

const compressionSource = Array.from({ length: 120 }, (_, index) => (
  `- Lore fact ${index + 1}: preserve this concrete character constraint, timing detail, secret boundary, and scene hazard for roleplay continuity.`
)).join('\n');
const lightBudget = __injectionPreviewTestHooks.estimateTokenBudgetForCompression(compressionSource, 1);
const maximumBudget = __injectionPreviewTestHooks.estimateTokenBudgetForCompression(compressionSource, 5);

assert.equal(lightBudget.profile.label, 'Light');
assert.equal(maximumBudget.profile.label, 'Maximum');
assert.equal(lightBudget.profile.targetRatio, 0.8);
assert.equal(maximumBudget.profile.targetRatio, 0.1);
assert.ok(
  lightBudget.minimumCharacters > maximumBudget.maximumCharacters,
  'Light compression must retain far more text than Maximum compression allows.'
);

const sliceByRatio = ratio => compressionSource.slice(0, Math.ceil(compressionSource.length * ratio));
const overcompressedLight = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.17), compressionSource, lightBudget, 1);
assert.equal(overcompressedLight.ok, false, 'Level 1 must reject level-5-sized overcompression.');
assert.match(overcompressedLight.message, /overcompressed/);

const validLight = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.8), compressionSource, lightBudget, 1);
assert.equal(validLight.ok, true, 'Level 1 should accept output inside its retention band.');

const validMaximum = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.11), compressionSource, maximumBudget, 5);
assert.equal(validMaximum.ok, true, 'Level 5 should accept an aggressively compressed output near 10%.');

const undercompressedMaximum = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.4), compressionSource, maximumBudget, 5);
assert.equal(undercompressedMaximum.ok, false, 'Level 5 must reject balanced-sized output.');
assert.match(undercompressedMaximum.message, /target band|too long/);

const compressionPrompt = __injectionPreviewTestHooks.buildCompressionPrompt('lore-high', 1, '{}', compressionSource, lightBudget);
assert.match(compressionPrompt, /Compression retention contract/);
assert.match(compressionPrompt, /Acceptable range:/);
assert.match(compressionPrompt, /Do not compress below the minimum range/);
assert.match(__injectionPreviewTestHooks.COMPRESSION_RETRY_SYSTEM_PROMPT, /outside the requested retention band/);
assert.doesNotMatch(__injectionPreviewTestHooks.COMPRESSION_RETRY_SYSTEM_PROMPT, /shorter|insufficiently compressed/);

console.log('Prompt compression contract passed.');
