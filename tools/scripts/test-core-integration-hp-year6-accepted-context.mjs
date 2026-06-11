import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_PACK_ID = 'hp-core';
const YEAR_6_PACK_ID = 'hp-year-6-half-blood-prince';
const EARLY_ENTRY_ID = 'lexcal_y6_horcrux_memory_task';
const LATER_ENTRY_ID = 'lexcal_y6_ron_poisoned_bezoar';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function installFileFetchMock() {
  globalThis.fetch = async function fetchLocalJson(url) {
    const resolved = url instanceof URL
      ? url
      : String(url || '').startsWith('file:')
        ? new URL(url)
        : pathToFileURL(String(url || ''));
    const text = await readFile(fileURLToPath(resolved), 'utf8');
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      async json() {
        return JSON.parse(text);
      },
      async text() {
        return text;
      },
    };
  };
}

function makeTestContext() {
  const ctx = {
    chat: [],
    chatMetadata: {},
    extensionSettings: {},
    saveMetadataCount: 0,
    saveSettingsCount: 0,
  };
  ctx.saveMetadata = () => {
    ctx.saveMetadataCount += 1;
  };
  ctx.saveSettingsDebounced = () => {
    ctx.saveSettingsCount += 1;
  };
  globalThis.SillyTavern = {
    getContext() {
      return ctx;
    },
  };
  return ctx;
}

function buildState(getDefaultState) {
  const state = getDefaultState();
  state.loredeckStack = [
    { packId: CORE_PACK_ID, enabled: true, priority: 200, addedAt: 1 },
    { packId: YEAR_6_PACK_ID, enabled: true, priority: 100, addedAt: 2 },
  ];
  state.loredeckContexts = {};
  state.loreMatrix = [];
  state.pendingLoreEntries = [];
  state.pendingLoreMeta = null;
  state.loreSelection = { pinnedIds: [], suppressedIds: [] };
  state.scene = {
    ...state.scene,
    presentCharacters: ['Harry Potter', 'Ron Weasley', 'Hermione Granger'],
    location: 'Hogwarts',
    currentActivity: 'Year 6 integration test',
  };
  return state;
}

function applyResolvedContexts(state, resolution, sourceContext) {
  const resolved = (resolution.results || []).filter(result => result.status === 'resolved' && result.patch);
  assert.ok(resolved.some(result => result.packId === YEAR_6_PACK_ID), 'Expected Year 6 Context to resolve.');

  for (const result of resolved) {
    state.loredeckContexts[result.packId] = {
      ...(state.loredeckContexts[result.packId] || {}),
      ...result.patch,
      packId: result.packId,
      branchId: result.patch.branchId || sourceContext.branchId || 'main',
      source: result.patch.source || result.matchType || 'integration_test',
      confidence: result.patch.confidence ?? 1,
      updatedAt: Date.now(),
    };
  }

  const year6 = state.loredeckContexts[YEAR_6_PACK_ID];
  state.loredeckContexts[CORE_PACK_ID] = {
    ...(state.loredeckContexts[CORE_PACK_ID] || {}),
    packId: CORE_PACK_ID,
    contextType: 'calendar',
    label: `Core mirror for ${year6.label || YEAR_6_PACK_ID}`,
    sceneDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    contextSortKey: year6.contextSortKey,
    contextSortKeyFrom: year6.contextSortKeyFrom ?? year6.contextSortKey,
    contextSortKeyTo: year6.contextSortKeyTo ?? year6.contextSortKey,
    branchId: sourceContext.branchId || 'main',
    source: 'integration_test_mirror',
    confidence: 1,
    updatedAt: Date.now(),
  };

  state.loreContext = {
    ...(state.loreContext || {}),
    sceneDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    branchId: sourceContext.branchId || 'main',
    lastDetectedAt: Date.now(),
  };
}

function entryIds(entries = []) {
  return new Set(entries.map(entry => entry.id));
}

function pickEntry(preview, id) {
  const entry = (preview.entries || []).find(item => item.id === id);
  assert.ok(entry, `Expected preview to contain ${id}.`);
  return entry;
}

function forceHigh(entry) {
  entry.relevance = 'high';
  entry.priority = Math.max(100, Number(entry.priority) || 0);
}

function injectionText(entry = {}) {
  return cleanText(entry.content?.injection || entry.content?.fact || entry.fact || '');
}

async function resolveAndPreview({ state, contextIndex, sourceContext, resolveContextsFromContext, clearCanonLoreDatabaseCache, previewCanonLoreForContext }) {
  const resolution = resolveContextsFromContext(sourceContext, {
    state,
    index: contextIndex,
    force: true,
    disableAlias: true,
  });
  applyResolvedContexts(state, resolution, sourceContext);
  clearCanonLoreDatabaseCache();
  const preview = await previewCanonLoreForContext(sourceContext, {
    contextIndex,
    maxCandidates: 300,
    includeAudit: true,
  });
  assert.equal(preview.status, 'preview');
  return { resolution, preview };
}

async function main() {
  installFileFetchMock();
  const ctx = makeTestContext();

  const { MODULE_KEY, DEFAULT_SETTINGS, getDefaultState } = await import('../../src/state/constants.js');
  const {
    appendPendingLoreEntries,
    acceptPendingLoreEntries,
    getState,
    getSettings,
  } = await import('../../src/state/state-manager.js');
  const {
    clearContextIndexCache,
    loadContextIndexForState,
  } = await import('../../src/context/context-index.js');
  const { resolveContextsFromContext } = await import('../../src/context/context-resolver.js');
  const {
    clearCanonLoreDatabaseCache,
    previewCanonLoreForContext,
  } = await import('../../src/context/canon-lore-db.js');
  const { getLoreEntryInjectionContextGate } = await import('../../src/lorecards/lore-injection-filter.js');
  const { buildLoreMemo } = await import('../../src/continuity/memo-builder.js');
  const { buildLoreInjectionAudit } = await import('../../src/lorecards/retrieval-audit.js');

  ctx.extensionSettings[MODULE_KEY] = {
    ...clone(DEFAULT_SETTINGS),
    canonLoreDatabaseEnabled: true,
    canonLoreMaxEntries: 100,
    injectLore: true,
    loreHighInjectionEnabled: true,
    loreNormalInjectionEnabled: true,
    loreLowInjectionEnabled: true,
    loreHighInjectionMode: 'direct',
    loreNormalInjectionMode: 'direct',
    loreLowInjectionMode: 'direct',
    loreHighMaxEntries: 20,
    loreNormalMaxEntries: 20,
    loreLowMaxEntries: 20,
  };

  const state = buildState(getDefaultState);
  ctx.chatMetadata[MODULE_KEY] = state;

  clearContextIndexCache();
  clearCanonLoreDatabaseCache();
  const contextIndex = await loadContextIndexForState(state, {
    registry: getSettings().loredeckLibrary,
    force: true,
  });

  const earlyContext = {
    sceneDate: 'Saturday, Jan 25, 1997',
    canonBoundary: 'Half-Blood Prince era, after Christmas and before Apparition lessons',
    branchId: 'main',
  };
  const early = await resolveAndPreview({
    state,
    contextIndex,
    sourceContext: earlyContext,
    resolveContextsFromContext,
    clearCanonLoreDatabaseCache,
    previewCanonLoreForContext,
  });
  const earlyYear6 = early.resolution.results.find(result => result.packId === YEAR_6_PACK_ID);
  assert.equal(earlyYear6?.window?.id, 'hp.y6.window.post_christmas_before_apparition');
  const earlyIds = entryIds(early.preview.entries);
  assert.equal(earlyIds.has(EARLY_ENTRY_ID), true, 'Early Context preview should include the Horcrux memory task.');
  assert.equal(earlyIds.has(LATER_ENTRY_ID), false, 'Early Context preview should block Ron poisoning lore.');

  const earlyEntry = pickEntry(early.preview, EARLY_ENTRY_ID);
  forceHigh(earlyEntry);
  appendPendingLoreEntries([earlyEntry], {
    source: 'integration_accepted_context_early',
    contextKey: 'hp-year6-pre-apparition',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const earlyAccepted = getState().loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  assert.ok(earlyAccepted, 'Early Context Lorecard should be accepted.');
  assert.equal(getLoreEntryInjectionContextGate(earlyAccepted, getState(), { contextIndex }).eligible, true);
  const earlyMemo = buildLoreMemo(getState(), getSettings());
  assert.ok(earlyMemo.includes(injectionText(earlyAccepted)), 'Accepted early Lorecard should inject while its Context gate matches.');

  const laterContext = {
    sceneDate: 'Saturday, Mar 1, 1997',
    canonBoundary: 'Year 6 Ron love potion and poisoning aftermath',
    branchId: 'main',
  };
  const later = await resolveAndPreview({
    state: getState(),
    contextIndex,
    sourceContext: laterContext,
    resolveContextsFromContext,
    clearCanonLoreDatabaseCache,
    previewCanonLoreForContext,
  });
  const laterYear6 = later.resolution.results.find(result => result.packId === YEAR_6_PACK_ID);
  assert.equal(laterYear6?.anchor?.id, 'hp.y6.ron_love_potion');
  const laterIds = entryIds(later.preview.entries);
  assert.equal(laterIds.has(EARLY_ENTRY_ID), false, 'Later Context preview should block the earlier Horcrux memory task.');
  assert.equal(laterIds.has(LATER_ENTRY_ID), true, 'Later Context preview should include Ron poisoning lore.');

  const laterEntry = pickEntry(later.preview, LATER_ENTRY_ID);
  forceHigh(laterEntry);
  appendPendingLoreEntries([laterEntry], {
    source: 'integration_accepted_context_later',
    contextKey: 'hp-year6-ron-poisoning',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const accepted = getState();
  const staleAccepted = accepted.loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAccepted = accepted.loreMatrix.find(entry => entry.id === LATER_ENTRY_ID);
  assert.ok(staleAccepted, 'Earlier Lorecard should remain accepted after Context advances.');
  assert.ok(currentAccepted, 'Later Lorecard should be accepted after Context advances.');
  forceHigh(staleAccepted);
  forceHigh(currentAccepted);

  const staleGate = getLoreEntryInjectionContextGate(staleAccepted, accepted, { contextIndex });
  const currentGate = getLoreEntryInjectionContextGate(currentAccepted, accepted, { contextIndex });
  assert.equal(staleGate.eligible, false, `Earlier accepted Lorecard should be Context-blocked after Context advances: ${JSON.stringify(staleGate)}`);
  assert.equal(currentGate.eligible, true, `Current accepted Lorecard should remain eligible: ${JSON.stringify(currentGate)}`);

  const laterMemo = buildLoreMemo(accepted, getSettings());
  assert.ok(!laterMemo.includes(injectionText(staleAccepted)), 'Accepted stale Lorecard should not inject outside its active Loredeck Context.');
  assert.ok(laterMemo.includes(injectionText(currentAccepted)), 'Accepted current Lorecard should inject in matching Context.');

  const audit = buildLoreInjectionAudit(accepted, getSettings(), {
    transport: 'integration_accepted_context',
    promptCharsByTier: { high: 1000, normal: 1000, low: 1000 },
  });
  const staleAudit = audit.entries.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAudit = audit.entries.find(entry => entry.id === LATER_ENTRY_ID);
  assert.equal(staleAudit?.decision, 'context_blocked', `Expected stale accepted Lorecard to be audited as context_blocked: ${JSON.stringify(staleAudit)}`);
  assert.equal(currentAudit?.decision, 'injected', `Expected current accepted Lorecard to inject: ${JSON.stringify(currentAudit)}`);
  assert.equal(audit.summary.contextBlocked >= 1, true, 'Injection audit should count Context-blocked accepted Lorecards.');

  console.log(JSON.stringify({
    ok: true,
    scenario: 'hp-year6-accepted-lorecard-context-injection',
    contexts: {
      early: earlyYear6.window?.id || earlyYear6.anchor?.id || '',
      later: laterYear6.anchor?.id || laterYear6.window?.id || '',
    },
    entries: {
      staleAccepted: staleAccepted.id,
      staleDecision: staleAudit?.decision || '',
      staleGate: staleGate.status,
      currentAccepted: currentAccepted.id,
      currentDecision: currentAudit?.decision || '',
      currentGate: currentGate.status,
    },
    auditSummary: audit.summary,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
