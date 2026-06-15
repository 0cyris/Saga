import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS, MODULE_KEY, getDefaultState } from '../../src/state/constants.js';
import { getSettings, getState, saveState } from '../../src/state/state-manager.js';
import {
  applyLoreAutomationSuggestions,
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
  loreAutomationRemapEveryTurns: 1,
  loreAutomationCurationEveryTurns: 5,
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

const suggestResult = await runAutoRelevance({ force: true });
assert.equal(suggestResult.status, 'suggested', `Expected careful ARMP to suggest changes: ${JSON.stringify(suggestResult)}`);
assert.equal(getState().loreSelection.pinnedIds.length, 0, 'Careful ARMP must not pin before suggestions are applied.');
assert.ok(getState().loreAutomationSuggestions.some(s => s.targetId === 'bezoar_rescue' && s.operation === 'pin'), 'ARMP should suggest pinning the enabled current-scene card.');
assert.ok(!getState().loreAutomationSuggestions.some(s => s.targetId === 'disabled_bezoar_rescue'), 'ARMP must skip cards with Lore Automation disabled.');

const applyResult = applyLoreAutomationSuggestions();
assert.equal(applyResult.status, 'applied', `Expected remap suggestions to apply: ${JSON.stringify(applyResult)}`);
assert.deepEqual(getState().loreSelection.pinnedIds, ['bezoar_rescue']);
assert.ok(!getState().loreSelection.pinnedIds.includes('disabled_bezoar_rescue'), 'Manual-disabled card must remain untouched.');
assert.equal(getState().loreAutomationSuggestions.length, 0, 'Applied remap suggestions should be cleared.');
assert.equal(getState().loreAutomationLastRun.status, 'applied_suggestions');
assert.equal(getSettings().loreAutomationMode, 'armp');

const undoResult = undoLastLoreAutomationRun();
assert.equal(undoResult.status, 'undone', `Expected undo to reverse latest automation run: ${JSON.stringify(undoResult)}`);
assert.deepEqual(getState().loreSelection.pinnedIds, [], 'Undo Last Run should reverse automation pin changes.');
assert.equal(getState().loreAutomationLastRun.status, 'undone');

ctx.extensionSettings[MODULE_KEY] = {
  ...ctx.extensionSettings[MODULE_KEY],
  canonLoreDatabaseEnabled: false,
  loreAutomationMode: 'armpc',
  loreAutomationStyle: 'aggressive',
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
curationState.loreAutomationRuns = [];
curationState.loreAutomationLastRun = null;
ctx.chatMetadata[MODULE_KEY] = curationState;
saveState(curationState, { syncPrompt: false });

const retireResult = await runAutoRelevance({ force: true, curationOnly: true });
assert.equal(retireResult.status, 'retired', `Expected ARMPC to retire stale automation-owned lore: ${JSON.stringify(retireResult)}`);
assert.equal(getState().loreMatrix.some(entry => entry.id === 'stale_auto_curated_card'), false, 'ARMPC retirement should remove the stale automation-owned card.');

const undoRetireResult = undoLastLoreAutomationRun();
assert.equal(undoRetireResult.status, 'undone', `Expected undo to restore retired lore: ${JSON.stringify(undoRetireResult)}`);
assert.equal(getState().loreMatrix.some(entry => entry.id === 'stale_auto_curated_card'), true, 'Undo Last Run should restore retired automation-owned lore.');

console.log('Lore Automation Levels contract passed.');
