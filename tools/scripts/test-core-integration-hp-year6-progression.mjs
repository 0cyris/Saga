import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_PACK_ID = 'hp-core';
const YEAR_6_PACK_ID = 'hp-year-6-half-blood-prince';
const LOADED_PACKS = [CORE_PACK_ID, YEAR_6_PACK_ID];
const PRE_ENTRY_ID = 'lexcal_y6_horcrux_memory_task';
const STALE_ENTRY_ID = 'hbp_memory_lessons_sequence';
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

function setChat(ctx, messages = []) {
  ctx.chat = messages.map((message, index) => ({
    name: message.name || (message.is_user ? 'User' : 'Assistant'),
    is_user: message.is_user === true,
    mes: cleanText(message.mes),
    send_date: index,
  }));
}

function countSignals(messages = []) {
  const text = messages.map(message => message.mes || '').join(' ').toLowerCase();
  const count = pattern => (text.match(pattern) || []).length;
  return {
    messages: messages.length,
    horcrux: count(/\bhorcrux(?:es)?\b/g),
    slughorn: count(/\bslughorn\b/g),
    apparition: count(/\bapparition\b|\bapparate\b|\bapparating\b/g),
    susanBones: count(/\bsusan bones\b|\bsplinch(?:ed|ing)?\b/g),
    ronPoisoning: count(/\bpoison(?:ed|ing)?\b|\bbezoar\b|\bmead\b/g),
  };
}

function detectFixtureContextFromChat(messages = []) {
  const signals = countSignals(messages);
  if (signals.ronPoisoning > 0) {
    return {
      sceneDate: 'Saturday, Mar 1, 1997',
      canonBoundary: 'Year 6 Ron love potion and poisoning aftermath',
      branchId: 'main',
      detector: 'fixture_signal_ron_poisoning',
      signals,
    };
  }
  if (signals.apparition > 0 || signals.susanBones > 0) {
    return {
      sceneDate: 'Saturday, Feb 1, 1997',
      canonBoundary: 'Year 6 Apparition lessons and Susan Bones splinched',
      branchId: 'main',
      detector: 'fixture_signal_apparition',
      signals,
    };
  }
  return {
    sceneDate: 'Saturday, Jan 25, 1997',
    canonBoundary: 'Half-Blood Prince era, Year 6',
    branchId: 'main',
    detector: 'fixture_signal_pre_apparition',
    signals,
  };
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
  state.autoRelevanceSuggestions = [];
  state.autoRelevanceLastRun = null;
  state.loreSelection = { pinnedIds: [], suppressedIds: [] };
  state.scene = {
    ...state.scene,
    presentCharacters: ['Harry Potter', 'Ron Weasley', 'Hermione Granger'],
    location: 'Hogwarts',
    currentActivity: 'Year 6 roleplay scene',
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
      source: result.patch.source || sourceContext.detector || result.matchType || 'integration_test',
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
  state.canon = {
    ...(state.canon || {}),
    inUniverseDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    era: 'Harry Potter Year 6',
  };
}

function getPackId(entry = {}) {
  return String(entry.extensions?.sagaLoredeck?.packId || entry.loredeckId || entry.packId || '').trim();
}

function assertOnlyLoadedPacks(entries = []) {
  const unexpected = entries
    .map(entry => ({ id: entry.id, packId: getPackId(entry) }))
    .filter(item => !LOADED_PACKS.includes(item.packId));
  assert.deepEqual(unexpected, [], 'Preview should only include entries from the explicitly loaded stack.');
}

function entryIds(entries = []) {
  return new Set(entries.map(entry => entry.id));
}

function pickEntries(preview, ids = []) {
  const byId = new Map((preview.entries || []).map(entry => [entry.id, entry]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

async function resolveAndPreview({ state, contextIndex, sourceContext, resolveContextsFromContext, clearCanonLoreDatabaseCache, previewCanonLoreForContext }) {
  const resolution = resolveContextsFromContext(sourceContext, {
    state,
    index: contextIndex,
    force: true,
  });
  applyResolvedContexts(state, resolution, sourceContext);
  clearCanonLoreDatabaseCache();
  const preview = await previewCanonLoreForContext(sourceContext, {
    contextIndex,
    maxCandidates: 300,
    includeAudit: true,
  });
  assert.equal(preview.status, 'preview');
  assertOnlyLoadedPacks(preview.entries);
  return { resolution, preview };
}

function forceRelevance(state, id, relevance) {
  const entry = state.loreMatrix.find(item => item.id === id);
  assert.ok(entry, `Expected accepted Lorecard ${id}.`);
  entry.relevance = relevance;
  entry.extensions = {
    ...(entry.extensions || {}),
    autoRelevance: {
      ...(entry.extensions?.autoRelevance || {}),
      mode: 'integration_seed',
      reason: `Seeded ${relevance} for progression test.`,
      updatedAt: Date.now(),
    },
  };
}

function findAccepted(state, id) {
  return state.loreMatrix.find(entry => entry.id === id);
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
  const { runAutoRelevance } = await import('../../src/context/auto-relevance.js');
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
    loreHighMaxEntries: 10,
    loreNormalMaxEntries: 10,
    loreLowMaxEntries: 10,
    autoRelevanceEnabled: true,
    autoRelevanceMode: 'apply_high_confidence',
    autoRelevanceUseModel: false,
    autoRelevanceCandidateCap: 20,
    autoRelevanceMinConfidence: 0.25,
    autoRelevanceRecentMessages: 2,
    autoRelevanceNearFutureDays: 45,
    autoRelevanceRecentPastDays: 45,
  };

  const state = buildState(getDefaultState);
  ctx.chatMetadata[MODULE_KEY] = state;

  clearContextIndexCache();
  clearCanonLoreDatabaseCache();
  const contextIndex = await loadContextIndexForState(state, {
    registry: getSettings().loredeckLibrary,
    force: true,
  });
  assert.equal(contextIndex.summary.packCount, 2);

  const earlyChat = [
    { name: 'User', is_user: true, mes: 'Harry returns from Christmas break in sixth year. Dumbledore is preparing another memory lesson.' },
    { name: 'Assistant', is_user: false, mes: 'Slughorn keeps avoiding the subject of the altered Horcrux memory.' },
  ];
  setChat(ctx, earlyChat);
  const preContext = detectFixtureContextFromChat(ctx.chat);
  const pre = await resolveAndPreview({
    state,
    contextIndex,
    sourceContext: preContext,
    resolveContextsFromContext,
    clearCanonLoreDatabaseCache,
    previewCanonLoreForContext,
  });
  const preYear6 = pre.resolution.results.find(result => result.packId === YEAR_6_PACK_ID);
  assert.equal(preYear6?.window?.id, 'hp.y6.window.post_christmas_before_apparition');
  const preIds = entryIds(pre.preview.entries);
  assert.equal(preIds.has(PRE_ENTRY_ID), true, 'Pre-Apparition preview should include the Horcrux memory task.');
  assert.equal(preIds.has(LATER_ENTRY_ID), false, 'Pre-Apparition preview should not include Ron poisoning.');

  const preAccept = pickEntries(pre.preview, [PRE_ENTRY_ID, STALE_ENTRY_ID]);
  assert.ok(preAccept.length >= 1, 'Expected pre-context entries to accept.');
  appendPendingLoreEntries(preAccept, {
    source: 'integration_progression_pre',
    contextKey: 'hp-year6-pre-apparition',
    rawEntryCount: preAccept.length,
    normalizedEntryCount: preAccept.length,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const laterChat = [
    ...earlyChat,
    { name: 'User', is_user: true, mes: 'Later that spring, Ron eats chocolates meant for Harry, stumbles into Slughorn’s office, drinks poisoned mead, and Harry saves him with a bezoar.' },
    { name: 'Assistant', is_user: false, mes: 'Lavender is frantic while Ron is rushed toward the hospital wing after the poisoning.' },
  ];
  setChat(ctx, laterChat);
  const liveLaterState = getState();
  liveLaterState.scene = {
    ...(liveLaterState.scene || {}),
    presentCharacters: ['Ron Weasley', 'Lavender Brown', 'Horace Slughorn'],
    nearbyCharacters: ['Harry Potter', 'Hermione Granger'],
    location: 'Hospital wing',
    currentActivity: 'Ron poisoned by mead and saved with a bezoar',
  };
  const laterContext = detectFixtureContextFromChat(ctx.chat);
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
  assert.equal(laterIds.has(PRE_ENTRY_ID), false, 'Later preview should drop the earlier Horcrux memory task.');
  assert.equal(laterIds.has(LATER_ENTRY_ID), true, 'Later preview should include Ron poisoning.');

  const laterAccept = pickEntries(later.preview, [LATER_ENTRY_ID, 'hbp_draco_cabinet_progression']);
  assert.ok(laterAccept.some(entry => entry.id === LATER_ENTRY_ID), 'Expected Ron poisoning candidate to accept.');
  appendPendingLoreEntries(laterAccept, {
    source: 'integration_progression_later',
    contextKey: 'hp-year6-ron-poisoning',
    rawEntryCount: laterAccept.length,
    normalizedEntryCount: laterAccept.length,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const accepted = getState();
  assert.ok(findAccepted(accepted, PRE_ENTRY_ID), 'Earlier accepted Lorecard should remain accepted.');
  assert.ok(findAccepted(accepted, STALE_ENTRY_ID), 'Earlier non-protected Lorecard should remain accepted.');
  assert.ok(findAccepted(accepted, LATER_ENTRY_ID), 'Later accepted Lorecard should be accepted.');
  forceRelevance(accepted, STALE_ENTRY_ID, 'high');
  forceRelevance(accepted, LATER_ENTRY_ID, 'low');
  accepted.loreSelection = { pinnedIds: [], suppressedIds: [] };

  const auto = await runAutoRelevance({ force: true, mode: 'apply_high_confidence' });
  assert.equal(auto.status, 'changed', `Expected Auto-Relevance to change tiers: ${JSON.stringify(auto)}`);
  const afterAuto = getState();
  const protectedPreEntry = findAccepted(afterAuto, PRE_ENTRY_ID);
  const staleEntry = findAccepted(afterAuto, STALE_ENTRY_ID);
  const laterEntry = findAccepted(afterAuto, LATER_ENTRY_ID);
  assert.notEqual(
    staleEntry.relevance,
    'high',
    `Auto-Relevance should demote stale earlier context lore. ${JSON.stringify({
      auto,
      lastRun: afterAuto.autoRelevanceLastRun,
      entry: {
        id: staleEntry.id,
        relevance: staleEntry.relevance,
        autoRelevance: staleEntry.extensions?.autoRelevance || null,
      },
    }, null, 2)}`,
  );
  assert.notEqual(laterEntry.relevance, 'low', 'Auto-Relevance should promote current Ron poisoning lore.');
  assert.deepEqual(afterAuto.loreSelection.pinnedIds, [], 'Auto-Relevance should not pin entries in the current product contract.');
  assert.deepEqual(afterAuto.loreSelection.suppressedIds, [], 'Auto-Relevance should not mute entries in the current product contract.');

  const memo = buildLoreMemo(afterAuto, getSettings());
  assert.ok(memo.includes(laterEntry.content.injection), 'Lore memo should include current promoted Ron poisoning lore.');
  const audit = buildLoreInjectionAudit(afterAuto, getSettings(), {
    transport: 'integration_progression',
    promptCharsByTier: { high: 1000, normal: 1000, low: 1000 },
  });
  const laterAudit = audit.entries.find(entry => entry.id === LATER_ENTRY_ID);
  assert.equal(laterAudit?.decision, 'injected', 'Current promoted Lorecard should be injected.');

  console.log(JSON.stringify({
    ok: true,
    scenario: 'hp-year6-context-progression-auto-relevance',
    contexts: {
      early: {
        detector: preContext.detector,
        sceneDate: preContext.sceneDate,
        candidate: preYear6.window?.id || preYear6.anchor?.id || '',
        signals: preContext.signals,
      },
      later: {
        detector: laterContext.detector,
        sceneDate: laterContext.sceneDate,
        candidate: laterYear6.anchor?.id || laterYear6.window?.id || '',
        signals: laterContext.signals,
      },
    },
    suggestions: {
      earlyCount: pre.preview.entries.length,
      laterCount: later.preview.entries.length,
      earlyOnlyAsserted: PRE_ENTRY_ID,
      laterOnlyAsserted: LATER_ENTRY_ID,
    },
    autoRelevance: {
      status: auto.status,
      changed: auto.changed,
      promotions: auto.promotions,
      demotions: auto.demotions,
      [PRE_ENTRY_ID]: protectedPreEntry.relevance,
      [STALE_ENTRY_ID]: staleEntry.relevance,
      [LATER_ENTRY_ID]: laterEntry.relevance,
    },
    injection: {
      injected: audit.summary.injected,
      ronPoisoningDecision: laterAudit?.decision || '',
    },
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
