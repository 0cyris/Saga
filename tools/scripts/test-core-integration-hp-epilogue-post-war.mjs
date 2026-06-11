import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_PACK_ID = 'hp-core';
const POSTWAR_PACK_ID = 'hp-epilogue-post-war';
const LOADED_PACKS = [CORE_PACK_ID, POSTWAR_PACK_ID];
const EARLY_ENTRY_ID = 'postwar_immediate_reconstruction_ministry_transition';
const EARLY_GUARD_ENTRY_ID = 'dh_epilogue_optional_postwar_seed';
const MID_ENTRY_ID = 'postwar_quidditch_world_cup_2014_da_reunion';
const LATE_ENTRY_ID = 'postwar_kings_cross_epilogue_platform_state';

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
    { packId: POSTWAR_PACK_ID, enabled: true, priority: 100, addedAt: 2 },
  ];
  state.loredeckContexts = {};
  state.loreMatrix = [];
  state.pendingLoreEntries = [];
  state.pendingLoreMeta = null;
  state.loreSelection = { pinnedIds: [], suppressedIds: [] };
  state.scene = {
    ...state.scene,
    presentCharacters: ['Harry Potter', 'Ginny Weasley', 'Ron Weasley', 'Hermione Granger'],
    nearbyCharacters: ['Kingsley Shacklebolt', 'Draco Malfoy', 'Albus Severus Potter', 'Rose Granger-Weasley'],
    location: "Wizarding Britain and King's Cross",
    currentActivity: 'Harry Potter post-war and epilogue integration test',
  };
  return state;
}

function applyResolvedContexts(state, resolution, sourceContext) {
  const resolved = (resolution.results || []).filter(result => result.status === 'resolved' && result.patch);
  assert.ok(resolved.some(result => result.packId === POSTWAR_PACK_ID), 'Expected Post-War Context to resolve.');

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

  const postwar = state.loredeckContexts[POSTWAR_PACK_ID];
  state.loredeckContexts[CORE_PACK_ID] = {
    ...(state.loredeckContexts[CORE_PACK_ID] || {}),
    packId: CORE_PACK_ID,
    contextType: 'calendar',
    label: `Core mirror for ${postwar.label || POSTWAR_PACK_ID}`,
    sceneDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    contextSortKey: postwar.contextSortKey,
    contextSortKeyFrom: postwar.contextSortKeyFrom ?? postwar.contextSortKey,
    contextSortKeyTo: postwar.contextSortKeyTo ?? postwar.contextSortKey,
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
    era: 'Harry Potter Post-War Years & Epilogue',
  };
}

function getPackId(entry = {}) {
  return String(entry.extensions?.sagaLoredeck?.packId || entry.loredeckId || entry.packId || '').trim();
}

function assertOnlyLoadedPacks(entries = []) {
  const unexpected = entries
    .map(entry => ({ id: entry.id, packId: getPackId(entry) }))
    .filter(item => !LOADED_PACKS.includes(item.packId));
  assert.deepEqual(unexpected, [], 'Preview should only include entries from the explicitly loaded Post-War stack.');
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

function assertMemoHasCurrentEpilogue(memo = '') {
  assert.ok(
    cleanText(memo).includes("At the 2017 King's Cross epilogue"),
    `Lore memo should include the current 2017 epilogue substance: ${memo}`,
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
  assert.equal(contextIndex.summary.packCount, 2, 'Expected hp-core and hp-epilogue-post-war context indexes.');
  assert.ok(contextIndex.summary.anchorCount >= 29, 'Expected a dense Post-War Context anchor index.');
  assert.ok(contextIndex.summary.windowCount >= 7, 'Expected a meaningful Post-War Context window index.');

  const earlyContext = {
    sceneDate: '1998-05-03',
    canonBoundary: 'Post-war Harry Potter after Voldemort is defeated, wizarding reconstruction begins, and Kingsley stabilizes the Ministry before the next generation epilogue',
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
  const earlyPostwar = early.resolution.results.find(result => result.packId === POSTWAR_PACK_ID);
  assert.ok(
    ['hp.postwar.wizarding_reconstruction_begins', 'hp.postwar.kingsley_elected_minister', 'hp.postwar.quidditch_world_cup_1998', 'hp.postwar.harry_joins_aurors'].includes(earlyPostwar?.anchor?.id),
    `Expected early Post-War Context to resolve near immediate rebuilding, got ${earlyPostwar?.anchor?.id || earlyPostwar?.window?.id || ''}.`,
  );
  const earlyIds = entryIds(early.preview.entries);
  assert.equal(earlyIds.has(EARLY_ENTRY_ID), true, 'Early Post-War preview should include immediate reconstruction lore.');
  assert.equal(earlyIds.has(EARLY_GUARD_ENTRY_ID), true, 'Early Post-War preview should include the pre-epilogue next-generation guard.');
  assert.equal(earlyIds.has(MID_ENTRY_ID), false, 'Early Post-War preview should block 2014 World Cup lore.');
  assert.equal(earlyIds.has(LATE_ENTRY_ID), false, 'Early Post-War preview should block 2017 epilogue platform lore.');

  const earlyEntry = pickEntry(early.preview, EARLY_ENTRY_ID);
  forceHigh(earlyEntry);
  appendPendingLoreEntries([earlyEntry], {
    source: 'integration_postwar_early',
    contextKey: 'hp-postwar-immediate-reconstruction',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const earlyAccepted = getState().loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  assert.ok(earlyAccepted, 'Early Post-War Lorecard should be accepted.');
  assert.equal(getLoreEntryInjectionContextGate(earlyAccepted, getState(), { contextIndex }).eligible, true);
  const earlyMemo = buildLoreMemo(getState(), getSettings());
  assert.ok(earlyMemo.includes(injectionText(earlyAccepted)), 'Accepted early Post-War Lorecard should inject while its Context gate matches.');

  const midContext = {
    sceneDate: '2014-07-08',
    canonBoundary: "Post-war Harry Potter during the 2014 Quidditch World Cup and Dumbledore's Army reunion before the nineteen years later platform scene",
    branchId: 'main',
  };
  const mid = await resolveAndPreview({
    state: getState(),
    contextIndex,
    sourceContext: midContext,
    resolveContextsFromContext,
    clearCanonLoreDatabaseCache,
    previewCanonLoreForContext,
  });
  const midPostwar = mid.resolution.results.find(result => result.packId === POSTWAR_PACK_ID);
  assert.ok(
    ['hp.postwar.dumbledores_army_reunited_world_cup', 'hp.postwar.quidditch_world_cup_2014_semifinals', 'hp.postwar.quidditch_world_cup_2014_final', 'hp.postwar.ginny_reports_gobstones_league'].includes(midPostwar?.anchor?.id),
    `Expected mid Post-War Context to resolve near 2014 World Cup, got ${midPostwar?.anchor?.id || midPostwar?.window?.id || ''}.`,
  );
  const midIds = entryIds(mid.preview.entries);
  assert.equal(midIds.has(EARLY_ENTRY_ID), false, '2014 Post-War preview should block stale immediate-rebuilding lore.');
  assert.equal(midIds.has(MID_ENTRY_ID), true, '2014 Post-War preview should include World Cup/DA reunion lore.');
  assert.equal(midIds.has(EARLY_GUARD_ENTRY_ID), true, '2014 Post-War preview should still include the pre-epilogue next-generation guard.');
  assert.equal(midIds.has(LATE_ENTRY_ID), false, '2014 Post-War preview should block 2017 epilogue platform lore.');

  const lateContext = {
    sceneDate: '2017-09-01',
    canonBoundary: "Harry Potter nineteen years later at King's Cross as Albus, Rose, and Scorpius board the Hogwarts Express in the epilogue",
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
  const latePostwar = late.resolution.results.find(result => result.packId === POSTWAR_PACK_ID);
  assert.equal(latePostwar?.patch?.contextSortKey, 17410, 'Late Post-War Context should resolve to the 2017 epilogue sort key.');
  const lateIds = entryIds(late.preview.entries);
  assert.equal(lateIds.has(EARLY_ENTRY_ID), false, 'Late Post-War preview should block stale immediate-rebuilding lore.');
  assert.equal(lateIds.has(MID_ENTRY_ID), false, 'Late Post-War preview should block stale 2014 World Cup lore.');
  assert.equal(lateIds.has(EARLY_GUARD_ENTRY_ID), false, 'Late Post-War preview should block the pre-epilogue guard once epilogue Context is current.');
  assert.equal(lateIds.has(LATE_ENTRY_ID), true, 'Late Post-War preview should include 2017 epilogue platform lore.');

  const lateEntry = pickEntry(late.preview, LATE_ENTRY_ID);
  forceHigh(lateEntry);
  appendPendingLoreEntries([lateEntry], {
    source: 'integration_postwar_late',
    contextKey: 'hp-postwar-kings-cross-epilogue',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const accepted = getState();
  const staleAccepted = accepted.loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAccepted = accepted.loreMatrix.find(entry => entry.id === LATE_ENTRY_ID);
  assert.ok(staleAccepted, 'Earlier Post-War Lorecard should remain accepted after Context advances.');
  assert.ok(currentAccepted, 'Later Post-War Lorecard should be accepted after Context advances.');
  forceHigh(staleAccepted);
  forceHigh(currentAccepted);

  const staleGate = getLoreEntryInjectionContextGate(staleAccepted, accepted, { contextIndex });
  const currentGate = getLoreEntryInjectionContextGate(currentAccepted, accepted, { contextIndex });
  assert.equal(staleGate.eligible, false, `Earlier Post-War Lorecard should be Context-blocked after Context advances: ${JSON.stringify(staleGate)}`);
  assert.equal(currentGate.eligible, true, `Current Post-War Lorecard should remain eligible: ${JSON.stringify(currentGate)}`);

  const lateMemo = buildLoreMemo(accepted, getSettings());
  assert.ok(!lateMemo.includes(injectionText(staleAccepted)), 'Accepted stale Post-War Lorecard should not inject outside its active Loredeck Context.');

  const audit = buildLoreInjectionAudit(accepted, getSettings(), {
    transport: 'integration_postwar',
    promptCharsByTier: { high: 1000, normal: 1000, low: 1000 },
  });
  const staleAudit = audit.entries.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAudit = audit.entries.find(entry => entry.id === LATE_ENTRY_ID);
  assert.equal(staleAudit?.decision, 'context_blocked', `Expected stale Post-War Lorecard to be audited as context_blocked: ${JSON.stringify(staleAudit)}`);
  assert.equal(currentAudit?.decision, 'injected', `Expected current Post-War Lorecard to inject: ${JSON.stringify(currentAudit)}`);
  assertMemoHasCurrentEpilogue(lateMemo);
  assert.equal(audit.summary.contextBlocked >= 1, true, 'Injection audit should count Context-blocked Post-War Lorecards.');

  console.log(JSON.stringify({
    ok: true,
    scenario: 'hp-epilogue-post-war-context-progression-injection',
    contexts: {
      early: earlyPostwar.anchor?.id || earlyPostwar.window?.id || '',
      mid: midPostwar.anchor?.id || midPostwar.window?.id || '',
      late: latePostwar.anchor?.id || latePostwar.window?.id || '',
    },
    entries: {
      staleAccepted: staleAccepted.id,
      staleDecision: staleAudit?.decision || '',
      staleGate: staleGate.status,
      currentAccepted: currentAccepted.id,
      currentDecision: currentAudit?.decision || '',
      currentGate: currentGate.status,
      preEpilogueGuardBlockedAtEpilogue: EARLY_GUARD_ENTRY_ID,
      midWorldCupAsserted: MID_ENTRY_ID,
    },
    auditSummary: audit.summary,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
