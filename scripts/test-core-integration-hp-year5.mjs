import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_PACK_ID = 'hp-core';
const YEAR_5_PACK_ID = 'hp-year-5-order-of-the-phoenix';
const LOADED_PACKS = [CORE_PACK_ID, YEAR_5_PACK_ID];
const EARLY_ENTRY_ID = 'ootp_da_formation_secrecy_gate';
const LATE_ENTRY_ID = 'event_sirius_death_after';
const LATE_LEXICON_ENTRY_ID = 'lexcal_y5_department_mysteries_public_return';

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
    { packId: YEAR_5_PACK_ID, enabled: true, priority: 100, addedAt: 2 },
  ];
  state.loredeckContexts = {};
  state.loreMatrix = [];
  state.pendingLoreEntries = [];
  state.pendingLoreMeta = null;
  state.loreSelection = { pinnedIds: [], suppressedIds: [] };
  state.scene = {
    ...state.scene,
    presentCharacters: ['Harry Potter', 'Ron Weasley', 'Hermione Granger'],
    nearbyCharacters: ['Dolores Umbridge', 'Sirius Black'],
    location: 'Hogwarts',
    currentActivity: 'Year 5 Order of the Phoenix integration test',
  };
  return state;
}

function applyResolvedContexts(state, resolution, sourceContext) {
  const resolved = (resolution.results || []).filter(result => result.status === 'resolved' && result.patch);
  assert.ok(resolved.some(result => result.packId === YEAR_5_PACK_ID), 'Expected Year 5 Context to resolve.');

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

  const year5 = state.loredeckContexts[YEAR_5_PACK_ID];
  state.loredeckContexts[CORE_PACK_ID] = {
    ...(state.loredeckContexts[CORE_PACK_ID] || {}),
    packId: CORE_PACK_ID,
    contextType: 'calendar',
    label: `Core mirror for ${year5.label || YEAR_5_PACK_ID}`,
    sceneDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    contextSortKey: year5.contextSortKey,
    contextSortKeyFrom: year5.contextSortKeyFrom ?? year5.contextSortKey,
    contextSortKeyTo: year5.contextSortKeyTo ?? year5.contextSortKey,
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
    era: 'Harry Potter Year 5',
  };
}

function getPackId(entry = {}) {
  return String(entry.extensions?.sagaLoredeck?.packId || entry.loredeckId || entry.packId || '').trim();
}

function assertOnlyLoadedPacks(entries = []) {
  const unexpected = entries
    .map(entry => ({ id: entry.id, packId: getPackId(entry) }))
    .filter(item => !LOADED_PACKS.includes(item.packId));
  assert.deepEqual(unexpected, [], 'Preview should only include entries from the explicitly loaded Year 5 stack.');
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

function assertMemoHasCurrentYear5Aftermath(memo = '') {
  assert.ok(
    cleanText(memo).includes('Sirius Black is dead and Harry is grieving'),
    `Lore memo should include the current Year 5 aftermath substance: ${memo}`,
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
  assert.equal(contextIndex.summary.packCount, 2, 'Expected hp-core and hp-year-5 context indexes.');
  assert.ok(contextIndex.summary.anchorCount >= 56, 'Expected a dense Year 5 Context anchor index.');
  assert.ok(contextIndex.summary.windowCount >= 10, 'Expected a meaningful Year 5 Context window index.');

  const earlyContext = {
    sceneDate: '1995-12-01',
    canonBoundary: "Order of the Phoenix Year 5, Dumbledore's Army recruitment and Umbridge control before Department of Mysteries revelations",
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
  const earlyYear5 = early.resolution.results.find(result => result.packId === YEAR_5_PACK_ID);
  assert.equal(earlyYear5?.anchor?.id, 'hp.y5.hogs_head_da_recruitment');
  const earlyIds = entryIds(early.preview.entries);
  assert.equal(earlyIds.has(EARLY_ENTRY_ID), true, 'Early Year 5 preview should include DA formation secrecy lore.');
  assert.equal(earlyIds.has(LATE_ENTRY_ID), false, 'Early Year 5 preview should block Sirius death aftermath lore.');
  assert.equal(earlyIds.has(LATE_LEXICON_ENTRY_ID), false, 'Early Year 5 preview should block Department aftermath lexicon lore.');

  const earlyEntry = pickEntry(early.preview, EARLY_ENTRY_ID);
  forceHigh(earlyEntry);
  appendPendingLoreEntries([earlyEntry], {
    source: 'integration_year5_early',
    contextKey: 'hp-year5-da-formation',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const earlyAccepted = getState().loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  assert.ok(earlyAccepted, 'Early Year 5 Lorecard should be accepted.');
  assert.equal(getLoreEntryInjectionContextGate(earlyAccepted, getState(), { contextIndex }).eligible, true);
  const earlyMemo = buildLoreMemo(getState(), getSettings());
  assert.ok(earlyMemo.includes(injectionText(earlyAccepted)), 'Accepted early Year 5 Lorecard should inject while its Context gate matches.');

  const lateContext = {
    sceneDate: '1996-06-25',
    canonBoundary: 'Order of the Phoenix Year 5 after the Department of Mysteries, Sirius death, Voldemort public return, and train home aftermath',
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
  const lateYear5 = late.resolution.results.find(result => result.packId === YEAR_5_PACK_ID);
  assert.equal(lateYear5?.anchor?.id, 'hp.y5.grief_and_train_home');
  const lateIds = entryIds(late.preview.entries);
  assert.equal(lateIds.has(EARLY_ENTRY_ID), false, 'Late Year 5 preview should block earlier DA formation secrecy lore.');
  assert.equal(lateIds.has(LATE_ENTRY_ID), true, 'Late Year 5 preview should include Sirius death aftermath lore.');
  assert.equal(lateIds.has(LATE_LEXICON_ENTRY_ID), true, 'Late Year 5 preview should include Department aftermath lexicon lore.');

  const lateEntry = pickEntry(late.preview, LATE_ENTRY_ID);
  forceHigh(lateEntry);
  appendPendingLoreEntries([lateEntry], {
    source: 'integration_year5_late',
    contextKey: 'hp-year5-department-aftermath',
    rawEntryCount: 1,
    normalizedEntryCount: 1,
  }, { syncPrompt: false, full: true });
  acceptPendingLoreEntries();

  const accepted = getState();
  const staleAccepted = accepted.loreMatrix.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAccepted = accepted.loreMatrix.find(entry => entry.id === LATE_ENTRY_ID);
  assert.ok(staleAccepted, 'Earlier Year 5 Lorecard should remain accepted after Context advances.');
  assert.ok(currentAccepted, 'Later Year 5 Lorecard should be accepted after Context advances.');
  forceHigh(staleAccepted);
  forceHigh(currentAccepted);

  const staleGate = getLoreEntryInjectionContextGate(staleAccepted, accepted, { contextIndex });
  const currentGate = getLoreEntryInjectionContextGate(currentAccepted, accepted, { contextIndex });
  assert.equal(staleGate.eligible, false, `Earlier Year 5 Lorecard should be Context-blocked after Context advances: ${JSON.stringify(staleGate)}`);
  assert.equal(currentGate.eligible, true, `Current Year 5 Lorecard should remain eligible: ${JSON.stringify(currentGate)}`);

  const lateMemo = buildLoreMemo(accepted, getSettings());
  assert.ok(!lateMemo.includes(injectionText(staleAccepted)), 'Accepted stale Year 5 Lorecard should not inject outside its active Loredeck Context.');

  const audit = buildLoreInjectionAudit(accepted, getSettings(), {
    transport: 'integration_year5',
    promptCharsByTier: { high: 1000, normal: 1000, low: 1000 },
  });
  const staleAudit = audit.entries.find(entry => entry.id === EARLY_ENTRY_ID);
  const currentAudit = audit.entries.find(entry => entry.id === LATE_ENTRY_ID);
  assert.equal(staleAudit?.decision, 'context_blocked', `Expected stale Year 5 Lorecard to be audited as context_blocked: ${JSON.stringify(staleAudit)}`);
  assert.equal(currentAudit?.decision, 'injected', `Expected current Year 5 Lorecard to inject: ${JSON.stringify(currentAudit)}`);
  assertMemoHasCurrentYear5Aftermath(lateMemo);
  assert.equal(audit.summary.contextBlocked >= 1, true, 'Injection audit should count Context-blocked Year 5 Lorecards.');

  console.log(JSON.stringify({
    ok: true,
    scenario: 'hp-year5-context-progression-injection',
    contexts: {
      early: earlyYear5.anchor?.id || earlyYear5.window?.id || '',
      late: lateYear5.anchor?.id || lateYear5.window?.id || '',
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
