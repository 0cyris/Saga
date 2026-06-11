import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_PACK_ID = 'hp-core';
const YEAR_7_PACK_ID = 'hp-year-7-deathly-hallows';
const LOADED_PACKS = [CORE_PACK_ID, YEAR_7_PACK_ID];
const EARLY_ENTRY_ID = 'dh_camping_protections_locket_effects';
const EARLY_GUARD_ENTRY_ID = 'dh_battle_phase_death_state_guard';
const LATE_ENTRY_ID = 'event_battle_hogwarts_after';
const LATE_LEXICON_ENTRY_ID = 'lexcal_y7_battle_hogwarts_final';

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
    { packId: YEAR_7_PACK_ID, enabled: true, priority: 100, addedAt: 2 },
  ];
  state.loredeckContexts = {};
  state.loreMatrix = [];
  state.pendingLoreEntries = [];
  state.pendingLoreMeta = null;
  state.loreSelection = { pinnedIds: [], suppressedIds: [] };
  state.scene = {
    ...state.scene,
    presentCharacters: ['Harry Potter', 'Ron Weasley', 'Hermione Granger'],
    nearbyCharacters: ['Voldemort', 'Severus Snape', 'Neville Longbottom', 'Bellatrix Lestrange'],
    location: 'Hogwarts and the Horcrux hunt',
    currentActivity: 'Year 7 Deathly Hallows integration test',
  };
  return state;
}

function applyResolvedContexts(state, resolution, sourceContext) {
  const resolved = (resolution.results || []).filter(result => result.status === 'resolved' && result.patch);
  assert.ok(resolved.some(result => result.packId === YEAR_7_PACK_ID), 'Expected Year 7 Context to resolve.');

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

  const year7 = state.loredeckContexts[YEAR_7_PACK_ID];
  state.loredeckContexts[CORE_PACK_ID] = {
    ...(state.loredeckContexts[CORE_PACK_ID] || {}),
    packId: CORE_PACK_ID,
    contextType: 'calendar',
    label: `Core mirror for ${year7.label || YEAR_7_PACK_ID}`,
    sceneDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    contextSortKey: year7.contextSortKey,
    contextSortKeyFrom: year7.contextSortKeyFrom ?? year7.contextSortKey,
    contextSortKeyTo: year7.contextSortKeyTo ?? year7.contextSortKey,
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
    era: 'Harry Potter Year 7',
  };
}

function getPackId(entry = {}) {
  return String(entry.extensions?.sagaLoredeck?.packId || entry.loredeckId || entry.packId || '').trim();
}

function assertOnlyLoadedPacks(entries = []) {
  const unexpected = entries
    .map(entry => ({ id: entry.id, packId: getPackId(entry) }))
    .filter(item => !LOADED_PACKS.includes(item.packId));
  assert.deepEqual(unexpected, [], 'Preview should only include entries from the explicitly loaded Year 7 stack.');
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

function assertMemoHasCurrentYear7Aftermath(memo = '') {
  assert.ok(
    cleanText(memo).includes('Voldemort is defeated and many war losses are known'),
    `Lore memo should include the current Year 7 aftermath substance: ${memo}`,
  );
}

async function resolveAndPreview({
  state,
  contextIndex,
  sourceContext,
  resolveContextsFromContext,
  clearCanonLoreDatabaseCache,
  previewCanonLoreForContext,
}) {
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
  assertOnlyLoadedPacks(preview.entries);
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
    canonLoreMaxEntries: 120,
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
  assert.equal(contextIndex.summary.packCount, 2, 'Expected hp-core and hp-year-7 context indexes.');
  assert.ok(contextIndex.summary.anchorCount >= 70, 'Expected a dense Year 7 Context anchor index.');
  assert.ok(contextIndex.summary.windowCount >= 18, 'Expected a meaningful Year 7 Context window index.');

  const earlyContext = {
    sceneDate: '1997-10-06',
    canonBoundary: 'Deathly Hallows Year 7 during the camping phase while the locket Horcrux strains Harry, Ron, and Hermione before Battle of Hogwarts outcomes',
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
  const earlyYear7 = early.resolution.results.find(result => result.packId === YEAR_7_PACK_ID);
  assert.equal(earlyYear7?.anchor?.id, 'hp.y7.locket_wearing_strain');
  const earlyIds = entryIds(early.preview.entries);
  assert.equal(earlyIds.has(EARLY_ENTRY_ID), true, 'Early Year 7 preview should include camping protections and locket-effect lore.');
  assert.equal(earlyIds.has(EARLY_GUARD_ENTRY_ID), true, 'Early Year 7 preview should include the Battle death-state guard.');
  assert.equal(earlyIds.has(LATE_ENTRY_ID), false, 'Early Year 7 preview should block Battle aftermath lore.');
  assert.equal(earlyIds.has(LATE_LEXICON_ENTRY_ID), false, 'Early Year 7 preview should block Battle of Hogwarts final lexicon lore.');

  const earlyEntry = pickEntry(early.preview, EARLY_ENTRY_ID);
  forceHigh(earlyEntry);
  appendPendingLoreEntries([earlyEntry], {
    source: 'integration_year7_early',
    contextKey: 'hp-year7-camping-locket-effects',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const earlyAccepted = getState().loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  assert.ok(earlyAccepted, 'Early Year 7 Lorecard should be accepted.');
  assert.equal(getLoreEntryInjectionContextGate(earlyAccepted, getState(), { contextIndex }).eligible, true);
  const earlyMemo = buildLoreMemo(getState(), getSettings());
  assert.ok(earlyMemo.includes(injectionText(earlyAccepted)), 'Accepted early Year 7 Lorecard should inject while its Context gate matches.');

  const lateContext = {
    sceneDate: '1998-05-03',
    canonBoundary: 'Deathly Hallows Year 7 after the Battle of Hogwarts, Voldemort defeated, major deaths known, and immediate aftermath beginning',
    branchId: 'main',
  };
  const late = await resolveAndPreview({
    state: getState(),
    contextIndex,
    sourceContext: lateContext,
    resolveContextsFromContext,
    clearCanonLoreDatabaseCache,
    previewCanonLoreForContext,
  });
  const lateYear7 = late.resolution.results.find(result => result.packId === YEAR_7_PACK_ID);
  assert.equal(lateYear7?.anchor?.id, 'hp.y7.battle_aftermath');
  const lateIds = entryIds(late.preview.entries);
  assert.equal(lateIds.has(EARLY_ENTRY_ID), false, 'Late Year 7 preview should block stale camping protections and locket-effect lore.');
  assert.equal(lateIds.has(EARLY_GUARD_ENTRY_ID), false, 'Late Year 7 preview should block the earlier Battle death-state guard.');
  assert.equal(lateIds.has(LATE_ENTRY_ID), true, 'Late Year 7 preview should include Battle aftermath lore.');
  assert.equal(lateIds.has(LATE_LEXICON_ENTRY_ID), true, 'Late Year 7 preview should include Battle of Hogwarts final lexicon lore.');

  const lateEntry = pickEntry(late.preview, LATE_ENTRY_ID);
  forceHigh(lateEntry);
  appendPendingLoreEntries([lateEntry], {
    source: 'integration_year7_late',
    contextKey: 'hp-year7-battle-aftermath',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const accepted = getState();
  const staleAccepted = accepted.loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAccepted = accepted.loreMatrix.find(entry => entry.id === LATE_ENTRY_ID);
  assert.ok(staleAccepted, 'Earlier Year 7 Lorecard should remain accepted after Context advances.');
  assert.ok(currentAccepted, 'Later Year 7 Lorecard should be accepted after Context advances.');
  forceHigh(staleAccepted);
  forceHigh(currentAccepted);

  const staleGate = getLoreEntryInjectionContextGate(staleAccepted, accepted, { contextIndex });
  const currentGate = getLoreEntryInjectionContextGate(currentAccepted, accepted, { contextIndex });
  assert.equal(staleGate.eligible, false, `Earlier Year 7 Lorecard should be Context-blocked after Context advances: ${JSON.stringify(staleGate)}`);
  assert.equal(currentGate.eligible, true, `Current Year 7 Lorecard should remain eligible: ${JSON.stringify(currentGate)}`);

  const lateMemo = buildLoreMemo(accepted, getSettings());
  assert.ok(!lateMemo.includes(injectionText(staleAccepted)), 'Accepted stale Year 7 Lorecard should not inject outside its active Loredeck Context.');

  const audit = buildLoreInjectionAudit(accepted, getSettings(), {
    transport: 'integration_year7',
    promptCharsByTier: { high: 1000, normal: 1000, low: 1000 },
  });
  const staleAudit = audit.entries.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAudit = audit.entries.find(entry => entry.id === LATE_ENTRY_ID);
  assert.equal(staleAudit?.decision, 'context_blocked', `Expected stale Year 7 Lorecard to be audited as context_blocked: ${JSON.stringify(staleAudit)}`);
  assert.equal(currentAudit?.decision, 'injected', `Expected current Year 7 Lorecard to inject: ${JSON.stringify(currentAudit)}`);
  assertMemoHasCurrentYear7Aftermath(lateMemo);
  assert.equal(audit.summary.contextBlocked >= 1, true, 'Injection audit should count Context-blocked Year 7 Lorecards.');

  console.log(JSON.stringify({
    ok: true,
    scenario: 'hp-year7-context-progression-injection',
    contexts: {
      early: earlyYear7.anchor?.id || earlyYear7.window?.id || '',
      late: lateYear7.anchor?.id || lateYear7.window?.id || '',
    },
    entries: {
      staleAccepted: staleAccepted.id,
      staleDecision: staleAudit?.decision || '',
      staleGate: staleGate.status,
      currentAccepted: currentAccepted.id,
      currentDecision: currentAudit?.decision || '',
      currentGate: currentGate.status,
      battleGuardBlockedAfterReveal: EARLY_GUARD_ENTRY_ID,
      lateRevealAsserted: LATE_LEXICON_ENTRY_ID,
    },
    auditSummary: audit.summary,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
