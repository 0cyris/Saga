import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS, MODULE_KEY, getDefaultState } from '../../src/state/constants.js';
import { getSettings, getState, saveState } from '../../src/state/state-manager.js';
import {
  __autoRelevanceTestHooks,
  onGenerationEndedAutoRelevance,
  runAutoRelevance,
  undoLastLoreAutomationRun,
} from '../../src/context/auto-relevance.js';
import {
  LORE_AUTOMATION_MODE_LABELS,
  LORE_AUTOMATION_MODE_TOOLTIPS,
  disableLoreAutomationForManualChange,
  isLoreAutomationEnabledForEntry,
} from '../../src/lorecards/lore-automation.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function installSillyTavernContext() {
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

function makeEntry(id, title, overrides = {}) {
  return {
    id,
    title,
    kind: 'event_anchor',
    category: 'event',
    lorePurpose: 'event_anchor',
    specificityScore: 90,
    relevance: overrides.relevance || 'normal',
    priority: overrides.priority || 90,
    injectableByDefault: true,
    date: {
      validFrom: '1997-03-01',
      validTo: '1997-03-02',
    },
    scope: {
      characters: ['Ron Weasley'],
      locations: ['Hogwarts'],
      topics: ['bezoar', 'poisoned mead'],
    },
    content: {
      fact: `${title} constrains the immediate scene before the next reply.`,
      injection: `${title} must be honored in the next reply.`,
    },
    ...overrides,
  };
}

const ctx = installSillyTavernContext();
ctx.chat = [
  { name: 'User', is_user: true, mes: 'Ron Weasley is poisoned by mead and Harry needs the bezoar rescue now.' },
  { name: 'Assistant', is_user: false, mes: 'The bezoar rescue becomes the urgent focus in Hogwarts.' },
];
ctx.extensionSettings[MODULE_KEY] = {
  ...clone(DEFAULT_SETTINGS),
  loreAutomationMode: 'armp',
  loreAutomationStyle: 'careful',
  loreAutomationProviderRouting: 'local',
  loreAutomationPacing: 'normal',
  loreAutomationRemapWordBudget: 120,
  loreAutomationCurationWordBudget: 240,
  autoRelevanceEnabled: true,
  autoRelevanceUseModel: false,
  autoRelevanceCandidateCap: 10,
  autoRelevanceMinConfidence: 0.25,
  autoRelevanceRecentMessages: 4,
};

const state = getDefaultState();
state.loreContext = {
  sceneDate: 'Saturday, Mar 1, 1997',
  canonBoundary: 'Year 6 Ron poisoning scene',
  branchId: 'main',
};
state.canon = {
  ...(state.canon || {}),
  inUniverseDate: 'Saturday, Mar 1, 1997',
  canonBoundary: 'Year 6 Ron poisoning scene',
};
state.scene = {
  ...(state.scene || {}),
  presentCharacters: ['Ron Weasley', 'Harry Potter'],
  location: 'Hogwarts',
  currentActivity: 'bezoar poisoned mead rescue',
};

const enabledEntry = makeEntry('bezoar_rescue', 'Bezoar rescue');
const disabledEntry = disableLoreAutomationForManualChange(
  makeEntry('disabled_bezoar_rescue', 'Disabled bezoar rescue'),
  'manual_relevance_change',
  { at: Date.now(), by: 'user' },
);
state.loreMatrix = [enabledEntry, disabledEntry];
state.loreSelection = { pinnedIds: [], suppressedIds: [] };
state.autoRelevanceSuggestions = [];
state.loreAutomationSuggestions = [];
state.loreAutomationRuns = [];
state.loreAutomationLastRun = null;
ctx.chatMetadata[MODULE_KEY] = state;
saveState(state, { syncPrompt: false });

assert.equal(LORE_AUTOMATION_MODE_LABELS.off, 'Off');
assert.equal(LORE_AUTOMATION_MODE_LABELS.ar, 'AR');
assert.equal(LORE_AUTOMATION_MODE_LABELS.armp, 'ARMP');
assert.equal(LORE_AUTOMATION_MODE_LABELS.armpc, 'ARMPC');
assert.equal(LORE_AUTOMATION_MODE_TOOLTIPS.armpc, 'Auto-Relevance, Muting, Pinning, Curating.');
assert.equal(isLoreAutomationEnabledForEntry(disabledEntry), false);

const actionResult = await runAutoRelevance({ force: true });
assert.equal(actionResult.status, 'changed', `Expected careful ARMP to act directly: ${JSON.stringify(actionResult)}`);
assert.deepEqual(getState().loreSelection.pinnedIds, ['bezoar_rescue']);
assert.ok(!getState().loreSelection.pinnedIds.includes('disabled_bezoar_rescue'), 'Manual-disabled card must remain untouched.');
assert.equal(getState().loreAutomationSuggestions.length, 0, 'Careful ARMP must not create a primary remap suggestion queue.');
assert.equal(getState().loreAutomationLastRun.status, 'changed');
assert.equal(getSettings().loreAutomationMode, 'armp');

const contextLanes = __autoRelevanceTestHooks.getContextCoverageLaneIds(getState());
assert.ok(contextLanes.includes('objective:bezoar'), `Context coverage should split objective terms: ${JSON.stringify(contextLanes)}`);
assert.ok(!contextLanes.some(lane => lane.startsWith('time:') || lane.startsWith('canon:')), `Coverage pressure should not include unsatisfiable date/canon lanes: ${JSON.stringify(contextLanes)}`);
const entryCoverage = __autoRelevanceTestHooks.getEntryCoverageLaneIds(getState().loreMatrix.find(entry => entry.id === 'bezoar_rescue'), getState());
assert.ok(entryCoverage.includes('objective:bezoar'), `Entry topics should satisfy objective coverage: ${JSON.stringify(entryCoverage)}`);
const noDeckPressure = __autoRelevanceTestHooks.computeLoreAutomationStackPressure(getState(), getSettings());
assert.equal(noDeckPressure.pressure, 'none', `Missing lanes without an active deck should not create add pressure: ${JSON.stringify(noDeckPressure)}`);

const pacing = __autoRelevanceTestHooks.getLoreAutomationPacingPolicy(getSettings());
assert.equal(pacing.pacing, 'normal');
assert.equal(pacing.remapWordBudget, 120, 'Narrative remap cadence should use word budgets, not turn counters.');
assert.equal(pacing.curationWordBudget, 240, 'Narrative curation cadence should use word budgets, not turn counters.');
assert.equal(__autoRelevanceTestHooks.isLoreAutomationBackgroundEnabled(getSettings()), false, 'Manual Session Automation must block background Lore Automation.');
assert.equal(onGenerationEndedAutoRelevance().status, 'manual_mode', 'Generation-ended cadence must not act while Session Automation is Manual.');

const undoResult = undoLastLoreAutomationRun();
assert.equal(undoResult.status, 'undone', `Expected undo to reverse latest automation run: ${JSON.stringify(undoResult)}`);
assert.deepEqual(getState().loreSelection.pinnedIds, [], 'Undo Last Run should reverse automation pin changes.');
assert.equal(getState().loreAutomationLastRun.status, 'undone');

ctx.extensionSettings[MODULE_KEY] = {
  ...ctx.extensionSettings[MODULE_KEY],
  canonLoreDatabaseEnabled: false,
  loreAutomationMode: 'armpc',
  loreAutomationStyle: 'careful',
  loreAutomationProviderRouting: 'local',
};
const staleAutoEntry = makeEntry('stale_auto_curated_card', 'Stale automation-owned card', {
  relevance: 'low',
  priority: 25,
  date: { validFrom: '1990-01-01', validTo: '1990-01-02' },
  scope: { characters: ['Minerva McGonagall'], topics: ['old irrelevant topic'] },
  content: { fact: 'A stale automation-owned fact from another scene.', injection: 'Stale automation-owned fact.' },
  extensions: {
    loreAutomation: { enabled: true, owner: 'auto', lastAction: 'accept_from_active_decks' },
    loreAutomationCuration: { source: 'active_deck' },
  },
});
const curationState = getDefaultState();
curationState.loreContext = state.loreContext;
curationState.canon = state.canon;
curationState.scene = state.scene;
curationState.loreMatrix = [staleAutoEntry];
curationState.loreSelection = { pinnedIds: [], suppressedIds: [] };
curationState.loreAutomationCadence = {
  ...(curationState.loreAutomationCadence || {}),
  staleEvidenceByCardId: { stale_auto_curated_card: 1 },
  cooldownByCardId: {},
};
curationState.loreAutomationRuns = [];
curationState.loreAutomationLastRun = null;
ctx.chatMetadata[MODULE_KEY] = curationState;
saveState(curationState, { syncPrompt: false });

const pressure = __autoRelevanceTestHooks.computeLoreAutomationStackPressure(getState(), getSettings());
assert.equal(pressure.pressure, 'remove', `Expected stack pressure to request removal after repeated stale evidence: ${JSON.stringify(pressure)}`);
assert.equal(pressure.staleCount, 1, 'Careful ARMPC should require repeated stale evidence before retirement.');

const retireResult = await runAutoRelevance({ force: true, curationOnly: true });
assert.equal(retireResult.status, 'retired', `Expected ARMPC to retire stale automation-owned lore: ${JSON.stringify(retireResult)}`);
assert.equal(getState().loreMatrix.some(entry => entry.id === 'stale_auto_curated_card'), false, 'ARMPC retirement should remove the stale automation-owned card.');

const undoRetireResult = undoLastLoreAutomationRun();
assert.equal(undoRetireResult.status, 'undone', `Expected undo to restore retired lore: ${JSON.stringify(undoRetireResult)}`);
assert.equal(getState().loreMatrix.some(entry => entry.id === 'stale_auto_curated_card'), true, 'Undo Last Run should restore retired automation-owned lore.');

ctx.extensionSettings[MODULE_KEY] = {
  ...ctx.extensionSettings[MODULE_KEY],
  loreAutomationMode: 'armpc',
  loreAutomationProviderRouting: 'local',
};
const noContextState = getDefaultState();
noContextState.loreContext = {};
noContextState.canon = {};
noContextState.scene = {};
noContextState.loreMatrix = [];
noContextState.loreSelection = { pinnedIds: [], suppressedIds: [] };
ctx.chatMetadata[MODULE_KEY] = noContextState;
saveState(noContextState, { syncPrompt: false });
assert.equal(__autoRelevanceTestHooks.hasUsableLoreAutomationContext(getState()), false, 'Empty Context should be detected before ARMPC curation.');
const noContextResult = await runAutoRelevance({ force: true, curationOnly: true });
assert.equal(noContextResult.status, 'needs_context', `ARMPC curation should pause without usable Context: ${JSON.stringify(noContextResult)}`);

console.log('Lore Automation Levels contract passed.');
