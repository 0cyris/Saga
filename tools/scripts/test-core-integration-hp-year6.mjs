import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_PACK_ID = 'hp-core';
const YEAR_6_PACK_ID = 'hp-year-6-half-blood-prince';
const MODULES_LOADED_PACKS = [CORE_PACK_ID, YEAR_6_PACK_ID];
const JAN_25_1997_EXCLUDED_CORE_ENTRY_IDS = [
  'adult_phase_dumbledore_early_headmaster_years_1_4_baseline',
  'adult_phase_lucius_malfoy_public_patriarch_years_1_4_baseline',
  'adult_phase_fudge_minister_pre_denial_years_1_4_baseline',
  'adult_phase_snape_potions_master_years_1_5_baseline',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function parseArgs(argv = []) {
  const options = {
    chatPath: '',
    messageCounts: [40, 80, 120],
  };
  for (const arg of argv) {
    if (arg.startsWith('--chat=')) {
      options.chatPath = arg.slice('--chat='.length).trim();
    } else if (arg.startsWith('--message-counts=')) {
      const counts = arg.slice('--message-counts='.length)
        .split(',')
        .map(value => Math.max(1, Number.parseInt(value.trim(), 10)))
        .filter(Number.isFinite);
      if (counts.length) options.messageCounts = counts;
    }
  }
  return options;
}

function installFileFetchMock() {
  globalThis.fetch = async function fetchLocalJson(url) {
    const resolved = url instanceof URL
      ? url
      : String(url || '').startsWith('file:')
        ? new URL(url)
        : pathToFileURL(String(url || ''));
    try {
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
    } catch (error) {
      return {
        ok: false,
        status: 404,
        statusText: error?.message || 'Not found',
        async json() {
          throw error;
        },
        async text() {
          return '';
        },
      };
    }
  };
}

async function loadJsonlChat(chatPath = '') {
  if (!chatPath) return [];
  const text = await readFile(chatPath, 'utf8');
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${error?.message || error}`);
      }
    })
    .filter(row => typeof row?.mes === 'string')
    .map((row, index) => ({
      index,
      name: cleanText(row.name),
      is_user: row.is_user === true,
      mes: cleanText(row.mes),
    }));
}

function countSignals(messages = []) {
  const text = messages.map(message => message.mes).join(' ').toLowerCase();
  const count = pattern => (text.match(pattern) || []).length;
  return {
    messages: messages.length,
    christmas: count(/\bchristmas\b/g),
    lavender: count(/\blavender\b/g),
    apparition: count(/\bapparition\b|\bapparate\b|\bapparating\b/g),
    susanBones: count(/\bsusan bones\b|\bsplinch(?:ed|ing)?\b/g),
    slughorn: count(/\bslughorn\b/g),
    dumbledore: count(/\bdumbledore\b/g),
  };
}

function summarizeChatProgression(messages = [], counts = []) {
  if (!messages.length) return null;
  const checkpoints = [...new Set([
    ...counts.filter(count => count <= messages.length),
    messages.length,
  ])].sort((a, b) => a - b);
  return checkpoints.map(count => ({
    count,
    signals: countSignals(messages.slice(0, count)),
  }));
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

function buildIntegrationState(getDefaultState) {
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
    currentActivity: 'Year 6 roleplay scene',
  };
  return state;
}

function applyResolvedContextsToState(state, resolution, sourceContext) {
  const resolved = (resolution.results || []).filter(result => result.status === 'resolved' && result.patch);
  assert.ok(resolved.length > 0, 'Expected at least one Loredeck Context resolution.');

  for (const result of resolved) {
    state.loredeckContexts[result.packId] = {
      ...(state.loredeckContexts[result.packId] || {}),
      ...result.patch,
      packId: result.packId,
      branchId: result.patch.branchId || sourceContext.branchId || 'main',
      source: result.patch.source || result.matchType || 'integration_test',
      confidence: result.patch.confidence ?? 1,
      updatedAt: 1,
    };
  }

  const year6 = state.loredeckContexts[YEAR_6_PACK_ID];
  assert.ok(year6?.contextSortKey, 'Year 6 Context should expose a contextSortKey.');

  if (!state.loredeckContexts[CORE_PACK_ID]?.contextSortKey) {
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
      updatedAt: 1,
    };
  }

  state.loreContext = {
    ...(state.loreContext || {}),
    sceneDate: sourceContext.sceneDate,
    canonBoundary: sourceContext.canonBoundary,
    branchId: sourceContext.branchId || 'main',
    lastDetectedAt: 1,
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

function selectEntriesForApproval(entries = []) {
  const requiredIds = [
    'future_guard_dumbledore_alive_before_tower',
    'spell_gate_sectumsempra',
    'knowledge_pre_horcrux_knowledge',
    'canon_secret_disclosure_requires_trust',
  ];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const selected = requiredIds.map(id => byId.get(id)).filter(Boolean);
  for (const entry of entries) {
    if (selected.length >= 6) break;
    if (!selected.some(item => item.id === entry.id)) selected.push(entry);
  }
  return selected;
}

function assertOnlyLoadedPacks(entries = []) {
  const unexpected = entries
    .map(entry => ({ id: entry.id, packId: getPackId(entry) }))
    .filter(item => !MODULES_LOADED_PACKS.includes(item.packId));
  assert.deepEqual(unexpected, [], 'Preview should only include Lorecards from the explicitly loaded stack.');
}

function assertNoJan25ExcludedCoreEntries(entries = []) {
  const entryIds = new Set(entries.map(entry => entry.id));
  const unexpected = JAN_25_1997_EXCLUDED_CORE_ENTRY_IDS.filter(id => entryIds.has(id));
  assert.deepEqual(
    unexpected,
    [],
    'Jan 25, 1997 previews should not include earlier Core adult phase baselines.',
  );
}

function getInjectionNeedle(entry = {}) {
  return cleanText(entry.content?.injection || entry.content?.fact || entry.fact || entry.title || '');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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
    loadCanonLoreDatabase,
    previewCanonLoreForContext,
  } = await import('../../src/context/canon-lore-db.js');
  const { buildLoreMemo } = await import('../../src/continuity/memo-builder.js');
  const { buildLoreInjectionAudit } = await import('../../src/lorecards/retrieval-audit.js');

  ctx.extensionSettings[MODULE_KEY] = {
    ...clone(DEFAULT_SETTINGS),
    canonLoreDatabaseEnabled: true,
    canonLoreAutoPropose: true,
    canonLoreMaxEntries: 80,
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

  const state = buildIntegrationState(getDefaultState);
  const emptyStackState = buildIntegrationState(getDefaultState);
  emptyStackState.loredeckStack = [];
  ctx.chatMetadata[MODULE_KEY] = emptyStackState;

  clearContextIndexCache();
  clearCanonLoreDatabaseCache();
  const emptyStackDb = await loadCanonLoreDatabase();
  assert.equal(emptyStackDb.entries.length, 0, 'Expected an empty active stack to load no canon entries.');

  ctx.chatMetadata[MODULE_KEY] = state;
  const contextIndex = await loadContextIndexForState(state, {
    registry: getSettings().loredeckLibrary,
    force: true,
  });
  assert.equal(contextIndex.summary.packCount, 2, 'Expected hp-core and hp-year-6 context indexes.');
  assert.ok(contextIndex.summary.anchorCount >= 70, 'Expected a meaningful Context anchor index.');
  assert.ok(contextIndex.summary.windowCount >= 20, 'Expected a meaningful Context window index.');

  const preApparitionContext = {
    sceneDate: 'Saturday, Jan 25, 1997',
    canonBoundary: 'Half-Blood Prince era, Year 6',
    branchId: 'main',
  };
  const resolution = resolveContextsFromContext(preApparitionContext, {
    state,
    index: contextIndex,
    force: true,
    disableAlias: true,
  });
  const year6Resolution = resolution.results.find(result => result.packId === YEAR_6_PACK_ID);
  assert.equal(year6Resolution?.status, 'resolved', 'Year 6 Context should resolve from date.');
  assert.equal(
    year6Resolution?.window?.id,
    'hp.y6.window.post_christmas_before_apparition',
    `Unexpected Year 6 resolution: ${JSON.stringify(year6Resolution, null, 2)}`,
  );
  assert.equal(year6Resolution?.matchType, 'date');
  const coreResolution = resolution.results.find(result => result.packId === CORE_PACK_ID);
  assert.equal(coreResolution?.status, 'resolved', 'Core Context should resolve from the scene date.');
  assert.equal(coreResolution?.matchType, 'date_only', 'Core should use a date-only calendar context when no named Core window matches.');
  assert.equal(coreResolution?.patch?.contextType, 'calendar');
  assert.equal(coreResolution?.patch?.anchorId, '');
  assert.equal(coreResolution?.patch?.contextSortKey, Math.floor(Date.UTC(1997, 0, 25) / 86400000));

  applyResolvedContextsToState(state, resolution, preApparitionContext);

  const preview = await previewCanonLoreForContext(preApparitionContext, {
    contextIndex,
    maxCandidates: 300,
    includeAudit: true,
  });
  assert.equal(preview.status, 'preview');
  assert.ok(preview.entries.length >= 30, 'Expected substantial Context-gated Lorecard suggestions.');
  assertOnlyLoadedPacks(preview.entries);
  assertNoJan25ExcludedCoreEntries(preview.entries);
  assert.ok(preview.entries.some(entry => entry.id === 'future_guard_dumbledore_alive_before_tower'), 'Expected Dumbledore tower future guard before the tower.');
  assert.ok(preview.entries.some(entry => entry.id === 'spell_gate_sectumsempra'), 'Expected Sectumsempra gate in Year 6 suggestions.');
  assert.ok(preview.entries.some(entry => entry.id === 'canon_secret_disclosure_requires_trust'), 'Expected secret disclosure trust guard in Jan 25 Year 6 suggestions.');
  assert.ok(!preview.entries.some(entry => getPackId(entry) === 'hp-year-7-deathly-hallows'), 'Year 7 Lorecards should not appear when Year 7 is not loaded.');

  const acceptedCandidates = selectEntriesForApproval(preview.entries);
  assert.ok(acceptedCandidates.length >= 3, 'Expected enough candidates to test approval and injection.');
  const pendingResult = appendPendingLoreEntries(acceptedCandidates, {
    source: 'integration_test_preview',
    contextKey: 'hp-year6-pre-apparition',
    rawEntryCount: acceptedCandidates.length,
    normalizedEntryCount: acceptedCandidates.length,
  }, { syncPrompt: false, full: true });
  assert.equal(pendingResult.changed, true);
  assert.equal(getState().pendingLoreEntries.length, acceptedCandidates.length);

  acceptPendingLoreEntries();
  const acceptedState = getState();
  assert.equal(acceptedState.pendingLoreEntries.length, 0);
  assert.equal(acceptedState.loreMatrix.length, acceptedCandidates.length);
  assert.ok(acceptedState.loreMatrix.every(entry => getPackId(entry)), 'Accepted Lorecards should preserve Loredeck metadata.');
  assert.ok(acceptedState.loreMatrix.every(entry => entry.context && typeof entry.context === 'object'), 'Accepted Lorecards should preserve Context gates.');

  const elevated = acceptedState.loreMatrix.find(entry => entry.id === 'future_guard_dumbledore_alive_before_tower') || acceptedState.loreMatrix[0];
  const muted = acceptedState.loreMatrix.find(entry => entry.id !== elevated.id) || acceptedState.loreMatrix[1];
  assert.ok(elevated, 'Expected a Lorecard to Elevate.');
  assert.ok(muted, 'Expected a Lorecard to mute.');
  acceptedState.loreSelection = {
    pinnedIds: [],
    suppressedIds: [muted.id],
    elevated: {
      [elevated.id]: {
        elevatedAt: Date.now(),
        previousRelevance: elevated.relevance || 'normal',
        previousMuted: false,
        previousLoreAutomation: { enabled: true },
      },
    },
  };

  const audit = buildLoreInjectionAudit(acceptedState, getSettings(), {
    transport: 'integration_test',
    promptCharsByTier: { high: 1000, normal: 1000, low: 1000 },
  });
  const elevatedAudit = audit.entries.find(entry => entry.id === elevated.id);
  const mutedAudit = audit.entries.find(entry => entry.id === muted.id);
  const trustGuard = acceptedState.loreMatrix.find(entry => entry.id === 'canon_secret_disclosure_requires_trust');
  const trustGuardAudit = audit.entries.find(entry => entry.id === 'canon_secret_disclosure_requires_trust');
  assert.equal(elevatedAudit?.decision, 'injected', 'Elevated eligible Lorecard should inject.');
  assert.equal(mutedAudit?.decision, 'muted', 'Muted Lorecard should not inject.');
  assert.ok(trustGuard, 'Secret disclosure trust guard should be accepted in the Jan 25 Year 6 smoke.');
  assert.equal(trustGuardAudit?.decision, 'injected', 'Secret disclosure trust guard should inject when accepted and eligible.');

  const memo = buildLoreMemo(acceptedState, getSettings());
  assert.ok(memo.includes(getInjectionNeedle(elevated)), 'Lore memo should include the Elevated Lorecard content.');
  assert.ok(!memo.includes(getInjectionNeedle(muted)), 'Lore memo should omit the muted Lorecard content.');
  assert.ok(memo.includes(getInjectionNeedle(trustGuard)), 'Lore memo should include the secret disclosure trust guard content.');

  const chatMessages = await loadJsonlChat(args.chatPath);
  const chatProgression = summarizeChatProgression(chatMessages, args.messageCounts);
  if (chatProgression) {
    const first = chatProgression[0]?.signals || {};
    const last = chatProgression[chatProgression.length - 1]?.signals || {};
    assert.ok(last.messages >= first.messages, 'Chat fixture checkpoints should progress forward.');
    assert.ok(last.apparition >= first.apparition, 'Apparition signals should not decrease across chat checkpoints.');
  }

  console.log(JSON.stringify({
    ok: true,
    scenario: 'hp-year6-core-integration',
    context: {
      packId: YEAR_6_PACK_ID,
      candidateId: year6Resolution.window?.id || year6Resolution.anchor?.id || '',
      label: year6Resolution.patch?.label || year6Resolution.window?.label || year6Resolution.anchor?.label || '',
      matchType: year6Resolution.matchType,
    },
    indexSummary: contextIndex.summary,
    preview: {
      status: preview.status,
      entries: preview.entries.length,
      packs: [...new Set(preview.entries.map(getPackId))],
    },
    accepted: {
      count: acceptedState.loreMatrix.length,
      elevated: elevated.id,
      muted: muted.id,
      injected: audit.summary.injected,
    },
    chatProgression,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
