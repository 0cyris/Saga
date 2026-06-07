import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_PACK_ID = 'hp-core';
const YEAR_1_PACK_ID = 'hp-year-1-philosophers-stone';
const LOADED_PACKS = [CORE_PACK_ID, YEAR_1_PACK_ID];
const EARLY_ENTRY_ID = 'ps_sorting_house_assignments';
const LATE_ENTRY_ID = 'event_quirrell_stone_aftermath';
const LATE_LEXICON_ENTRY_ID = 'lexcal_y1_stone_chambers_hospital';

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
    { packId: YEAR_1_PACK_ID, enabled: true, priority: 100, addedAt: 2 },
  ];
  state.loredeckContexts = {};
  state.loreMatrix = [];
  state.pendingLoreEntries = [];
  state.pendingLoreMeta = null;
  state.loreSelection = { pinnedIds: [], suppressedIds: [] };
  state.scene = {
    ...state.scene,
    presentCharacters: ['Harry Potter', 'Ron Weasley', 'Hermione Granger'],
    nearbyCharacters: ['Draco Malfoy', 'Quirinus Quirrell'],
    location: 'Hogwarts',
    currentActivity: "Year 1 Philosopher's Stone integration test",
  };
  return state;
}

function applyResolvedContexts(state, resolution, sourceContext) {
  const resolved = (resolution.results || []).filter(result => result.status === 'resolved' && result.patch);
  assert.ok(resolved.some(result => result.packId === YEAR_1_PACK_ID), 'Expected Year 1 Context to resolve.');

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

  const year1 = state.loredeckContexts[YEAR_1_PACK_ID];
  state.loredeckContexts[CORE_PACK_ID] = {
    ...(state.loredeckContexts[CORE_PACK_ID] || {}),
    packId: CORE_PACK_ID,
    contextType: 'calendar',
    label: `Core mirror for ${year1.label || YEAR_1_PACK_ID}`,
    sceneDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    contextSortKey: year1.contextSortKey,
    contextSortKeyFrom: year1.contextSortKeyFrom ?? year1.contextSortKey,
    contextSortKeyTo: year1.contextSortKeyTo ?? year1.contextSortKey,
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
    era: 'Harry Potter Year 1',
  };
}

function getPackId(entry = {}) {
  return String(entry.extensions?.sagaLoredeck?.packId || entry.loredeckId || entry.packId || '').trim();
}

function assertOnlyLoadedPacks(entries = []) {
  const unexpected = entries
    .map(entry => ({ id: entry.id, packId: getPackId(entry) }))
    .filter(item => !LOADED_PACKS.includes(item.packId));
  assert.deepEqual(unexpected, [], 'Preview should only include entries from the explicitly loaded Year 1 stack.');
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

function assertMemoHasCurrentYear1Aftermath(memo = '') {
  assert.ok(
    cleanText(memo).includes("The Philosopher's Stone plot is resolved and Quirrell is dead"),
    `Lore memo should include the current Year 1 Stone aftermath substance: ${memo}`,
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

  const { MODULE_KEY, DEFAULT_SETTINGS, getDefaultState } = await import('../constants.js');
  const {
    appendPendingLoreEntries,
    acceptPendingLoreEntries,
    getState,
    getSettings,
  } = await import('../state-manager.js');
  const {
    clearContextIndexCache,
    loadContextIndexForState,
  } = await import('../context-index.js');
  const { resolveContextsFromContext } = await import('../context-resolver.js');
  const {
    clearCanonLoreDatabaseCache,
    previewCanonLoreForContext,
  } = await import('../canon-lore-db.js');
  const { getLoreEntryInjectionContextGate } = await import('../lore-injection-filter.js');
  const { buildLoreMemo } = await import('../memo-builder.js');
  const { buildLoreInjectionAudit } = await import('../retrieval-audit.js');

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
  assert.equal(contextIndex.summary.packCount, 2, 'Expected hp-core and hp-year-1 context indexes.');
  assert.ok(contextIndex.summary.anchorCount >= 55, 'Expected a dense Year 1 Context anchor index.');
  assert.ok(contextIndex.summary.windowCount >= 9, 'Expected a meaningful Year 1 Context window index.');

  const earlyContext = {
    sceneDate: '1991-10-15',
    canonBoundary: "Philosopher's Stone Year 1 after Hogwarts Express arrival and Sorting, before late Stone confrontation revelations",
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
  const earlyYear1 = early.resolution.results.find(result => result.packId === YEAR_1_PACK_ID);
  assert.equal(earlyYear1?.anchor?.id, 'hp.y1.hogwarts_express_ron_meeting');
  const earlyIds = entryIds(early.preview.entries);
  assert.equal(earlyIds.has(EARLY_ENTRY_ID), true, 'Early Year 1 preview should include Sorting and house assignment lore.');
  assert.equal(earlyIds.has(LATE_ENTRY_ID), false, 'Early Year 1 preview should block Quirrell and Stone aftermath lore.');
  assert.equal(earlyIds.has(LATE_LEXICON_ENTRY_ID), false, 'Early Year 1 preview should block Stone chamber aftermath lexicon lore.');

  const earlyEntry = pickEntry(early.preview, EARLY_ENTRY_ID);
  forceHigh(earlyEntry);
  appendPendingLoreEntries([earlyEntry], {
    source: 'integration_year1_early',
    contextKey: 'hp-year1-sorting',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const earlyAccepted = getState().loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  assert.ok(earlyAccepted, 'Early Year 1 Lorecard should be accepted.');
  assert.equal(getLoreEntryInjectionContextGate(earlyAccepted, getState(), { contextIndex }).eligible, true);
  const earlyMemo = buildLoreMemo(getState(), getSettings());
  assert.ok(earlyMemo.includes(injectionText(earlyAccepted)), 'Accepted early Year 1 Lorecard should inject while its Context gate matches.');

  const lateContext = {
    sceneDate: '1992-06-06',
    canonBoundary: "Philosopher's Stone Year 1 after the trapdoor trials, Quirrell confrontation, Stone destruction, and hospital aftermath",
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
  const lateYear1 = late.resolution.results.find(result => result.packId === YEAR_1_PACK_ID);
  assert.equal(lateYear1?.anchor?.id, 'hp.y1.hospital_aftermath');
  const lateIds = entryIds(late.preview.entries);
  assert.equal(lateIds.has(EARLY_ENTRY_ID), false, 'Late Year 1 preview should block earlier Sorting and house assignment lore.');
  assert.equal(lateIds.has(LATE_ENTRY_ID), true, 'Late Year 1 preview should include Quirrell and Stone aftermath lore.');
  assert.equal(lateIds.has(LATE_LEXICON_ENTRY_ID), true, 'Late Year 1 preview should include Stone chamber aftermath lexicon lore.');

  const lateEntry = pickEntry(late.preview, LATE_ENTRY_ID);
  forceHigh(lateEntry);
  appendPendingLoreEntries([lateEntry], {
    source: 'integration_year1_late',
    contextKey: 'hp-year1-stone-aftermath',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const accepted = getState();
  const staleAccepted = accepted.loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAccepted = accepted.loreMatrix.find(entry => entry.id === LATE_ENTRY_ID);
  assert.ok(staleAccepted, 'Earlier Year 1 Lorecard should remain accepted after Context advances.');
  assert.ok(currentAccepted, 'Later Year 1 Lorecard should be accepted after Context advances.');
  forceHigh(staleAccepted);
  forceHigh(currentAccepted);

  const staleGate = getLoreEntryInjectionContextGate(staleAccepted, accepted, { contextIndex });
  const currentGate = getLoreEntryInjectionContextGate(currentAccepted, accepted, { contextIndex });
  assert.equal(staleGate.eligible, false, `Earlier Year 1 Lorecard should be Context-blocked after Context advances: ${JSON.stringify(staleGate)}`);
  assert.equal(currentGate.eligible, true, `Current Year 1 Lorecard should remain eligible: ${JSON.stringify(currentGate)}`);

  const lateMemo = buildLoreMemo(accepted, getSettings());
  assert.ok(!lateMemo.includes(injectionText(staleAccepted)), 'Accepted stale Year 1 Lorecard should not inject outside its active Loredeck Context.');

  const audit = buildLoreInjectionAudit(accepted, getSettings(), {
    transport: 'integration_year1',
    promptCharsByTier: { high: 1000, normal: 1000, low: 1000 },
  });
  const staleAudit = audit.entries.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAudit = audit.entries.find(entry => entry.id === LATE_ENTRY_ID);
  assert.equal(staleAudit?.decision, 'context_blocked', `Expected stale Year 1 Lorecard to be audited as context_blocked: ${JSON.stringify(staleAudit)}`);
  assert.equal(currentAudit?.decision, 'injected', `Expected current Year 1 Lorecard to inject: ${JSON.stringify(currentAudit)}`);
  assertMemoHasCurrentYear1Aftermath(lateMemo);
  assert.equal(audit.summary.contextBlocked >= 1, true, 'Injection audit should count Context-blocked Year 1 Lorecards.');

  console.log(JSON.stringify({
    ok: true,
    scenario: 'hp-year1-context-progression-injection',
    contexts: {
      early: earlyYear1.anchor?.id || earlyYear1.window?.id || '',
      late: lateYear1.anchor?.id || lateYear1.window?.id || '',
    },
    entries: {
      staleAccepted: staleAccepted.id,
      staleDecision: staleAudit?.decision || '',
      staleGate: staleGate.status,
      currentAccepted: currentAccepted.id,
      currentDecision: currentAudit?.decision || '',
      currentGate: currentGate.status,
      lateRevealAsserted: LATE_LEXICON_ENTRY_ID,
    },
    auditSummary: audit.summary,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
