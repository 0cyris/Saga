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
    pinnedIds: [],
    suppressedIds: [],
    elevated: {
      'harry-secret': {
        elevatedAt: 1,
        previousRelevance: 'normal',
        previousMuted: false,
        previousLoreAutomation: { enabled: true },
      },
    },
  },
  loreMatrix: [{
    id: 'harry-secret',
    title: 'Harry Secret',
    relevance: 'normal',
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
assert.equal(parsedSignature.signatureVersion, 5);
assert.equal(parsedSignature.kind, 'lore-high');
assert.equal(parsedSignature.compressionLevel, 3);
assert.equal(parsedSignature.elevatedLoreIds, 'harry-secret');

state.loreCompressionStatusByRelevance = {
  high: {
    lastSignature: signature,
    cachedText: 'COMPRESSED HIGH LORE',
  },
};

assert.equal(
  buildLorePreview(state, 'compressed', 'high'),
  'COMPRESSED HIGH LORE\n\n## Elevated Lore (Direct)\n- Harry knows the hidden passage.',
  'Matching high-relevance compression cache must append exact Elevated lore directly.'
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

const unelevatedSignature = getCompressionSourceSignature({
  ...state,
  loreSelection: {
    ...state.loreSelection,
    elevated: {},
  },
}, 'lore-high', direct, sagaSettings);
assert.notEqual(unelevatedSignature, signature, 'Changing Elevated lore must invalidate cached lore compression.');

const compressionSource = Array.from({ length: 120 }, (_, index) => (
  `- Lore fact ${index + 1}: preserve this concrete character constraint, timing detail, secret boundary, and scene hazard for roleplay continuity.`
)).join('\n');
const lightBudget = __injectionPreviewTestHooks.estimateTokenBudgetForCompression(compressionSource, 1);
const maximumBudget = __injectionPreviewTestHooks.estimateTokenBudgetForCompression(compressionSource, 5);

assert.equal(lightBudget.profile.label, 'Light');
assert.equal(maximumBudget.profile.label, 'Maximum');
assert.equal(lightBudget.profile.targetRatio, 0.8);
assert.equal(maximumBudget.profile.targetRatio, 0.1);
assert.equal(lightBudget.profile.minimumRatio, 0.55);
assert.equal(maximumBudget.profile.maximumRatio, 0.3);
assert.ok(
  lightBudget.minimumCharacters > maximumBudget.maximumCharacters,
  'Light compression must retain far more text than Maximum compression allows.'
);

const sliceByRatio = ratio => compressionSource.slice(0, Math.ceil(compressionSource.length * ratio));
const overcompressedLight = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.17), compressionSource, lightBudget, 1);
assert.equal(overcompressedLight.ok, true, 'Level 1 should keep hard-valid overcompression usable.');
assert.equal(overcompressedLight.inPreferredBand, false, 'Level 1 should flag level-5-sized output as outside the preferred range.');
assert.equal(overcompressedLight.bandStatus, 'below_preferred_range');

const validLight = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.8), compressionSource, lightBudget, 1);
assert.equal(validLight.ok, true, 'Level 1 should accept output inside its preferred range.');
assert.equal(validLight.inPreferredBand, true, 'Level 1 should mark target-sized output inside its preferred range.');

const validMaximum = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.11), compressionSource, maximumBudget, 5);
assert.equal(validMaximum.ok, true, 'Level 5 should accept an aggressively compressed output near 10%.');
assert.equal(validMaximum.inPreferredBand, true, 'Level 5 should mark target-sized output inside its preferred range.');

const undercompressedMaximum = __injectionPreviewTestHooks.validateCompressedText(sliceByRatio(0.4), compressionSource, maximumBudget, 5);
assert.equal(undercompressedMaximum.ok, true, 'Level 5 should keep undercompressed-but-shorter output usable.');
assert.equal(undercompressedMaximum.inPreferredBand, false, 'Level 5 should flag balanced-sized output as outside the preferred range.');
assert.equal(undercompressedMaximum.bandStatus, 'above_preferred_range');

const tooLongMaximum = __injectionPreviewTestHooks.validateCompressedText(`${compressionSource}\n${compressionSource}`, compressionSource, maximumBudget, 5);
assert.equal(tooLongMaximum.ok, false, 'Output longer than the source should remain a hard compression failure.');
assert.equal(tooLongMaximum.hardFailure, true);

const lessBadLightText = sliceByRatio(0.5);
const selectedFallback = __injectionPreviewTestHooks.selectBestCompressionCandidate([
  { attempt: 1, text: sliceByRatio(0.17), evaluation: overcompressedLight },
  {
    attempt: 2,
    text: lessBadLightText,
    evaluation: __injectionPreviewTestHooks.validateCompressedText(lessBadLightText, compressionSource, lightBudget, 1),
  },
]);
assert.equal(selectedFallback.text, lessBadLightText, 'When both attempts miss the preferred range, Saga should keep the closer usable result.');

const selectedWithHardFailure = __injectionPreviewTestHooks.selectBestCompressionCandidate([
  { attempt: 1, text: lessBadLightText, evaluation: __injectionPreviewTestHooks.validateCompressedText(lessBadLightText, compressionSource, lightBudget, 1) },
  { attempt: 2, text: '', evaluation: __injectionPreviewTestHooks.validateCompressedText('', compressionSource, lightBudget, 1) },
]);
assert.equal(selectedWithHardFailure.text, lessBadLightText, 'Hard-invalid retry output must not replace a usable first result.');

const insideMaximumText = sliceByRatio(0.3);
const belowMaximumText = sliceByRatio(0.02);
const selectedInsideBand = __injectionPreviewTestHooks.selectBestCompressionCandidate([
  { attempt: 1, text: belowMaximumText, evaluation: __injectionPreviewTestHooks.validateCompressedText(belowMaximumText, compressionSource, maximumBudget, 5) },
  { attempt: 2, text: insideMaximumText, evaluation: __injectionPreviewTestHooks.validateCompressedText(insideMaximumText, compressionSource, maximumBudget, 5) },
]);
assert.equal(selectedInsideBand.text, insideMaximumText, 'A preferred-range retry should beat a closer-but-outside candidate.');

const compressionPrompt = __injectionPreviewTestHooks.buildCompressionPrompt('lore-high', 1, '{}', compressionSource, lightBudget);
assert.match(compressionPrompt, /Compression target guidance/);
assert.match(compressionPrompt, /Preferred range:/);
assert.match(compressionPrompt, /Try not to compress below the preferred range/);
assert.match(__injectionPreviewTestHooks.COMPRESSION_RETRY_SYSTEM_PROMPT, /outside the requested preferred range/);
assert.doesNotMatch(__injectionPreviewTestHooks.COMPRESSION_RETRY_SYSTEM_PROMPT, /shorter|insufficiently compressed/);

console.log('Prompt compression contract passed.');
