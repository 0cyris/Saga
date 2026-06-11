import assert from 'node:assert/strict';

import {
    BASIC_EXPERIENCE_MANAGED_SETTING_KEYS,
    BASIC_EXPERIENCE_PROFILE_VERSION,
    BASIC_EXPERIENCE_SETTINGS,
    DEFAULT_SETTINGS,
} from '../../src/state/constants.js';
import {
    ADVANCED_EXPERIENCE_TABS,
    BASIC_EXPERIENCE_TABS,
    getTabLabelForExperience,
    getVisibleTabsForExperience,
    normalizeTabForExperience,
} from '../../src/runtime/runtime-navigation.js';
import {
    applyExperienceModeSettings,
    pickManagedExperienceSettings,
} from '../../src/runtime/runtime-experience-mode.js';

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function assertDeepEqual(actual, expected, message) {
    assert.deepEqual(clone(actual), clone(expected), message);
}

assertDeepEqual(
    getVisibleTabsForExperience({ experienceMode: 'basic' }),
    BASIC_EXPERIENCE_TABS,
    'Basic Experience must expose the Basic tab set.'
);
assert(!BASIC_EXPERIENCE_TABS.includes('injection'), 'Basic Experience must hide Injection.');
assert(!BASIC_EXPERIENCE_TABS.includes('continuity'), 'Basic Experience must hide Continuity.');
assert(ADVANCED_EXPERIENCE_TABS.includes('injection'), 'Advanced Experience must expose Injection.');
assert(ADVANCED_EXPERIENCE_TABS.includes('continuity'), 'Advanced Experience must expose Continuity.');
assert.equal(normalizeTabForExperience('injection', { experienceMode: 'basic' }), 'session', 'Hidden Basic Injection tab must normalize to Session.');
assert.equal(normalizeTabForExperience('continuity', { experienceMode: 'basic' }), 'session', 'Hidden Basic Continuity tab must normalize to Session.');
assert.equal(normalizeTabForExperience('injection', { experienceMode: 'advanced' }), 'injection', 'Advanced Injection tab must stay selectable.');
assert.equal(getTabLabelForExperience('session', { experienceMode: 'basic' }), 'Session', 'Basic Session label must match Advanced.');
assert.equal(getTabLabelForExperience('lore', { experienceMode: 'basic' }), 'Lorecards', 'Basic Lorecards label must match Advanced.');

const advancedSettings = {
    ...DEFAULT_SETTINGS,
    experienceMode: 'advanced',
    automationMode: 'automatic',
    workflowMode: 'automatic',
    autoExtract: true,
    autoApplyDelta: true,
    autoGenerateLore: true,
    continuityTrackingMode: 'automatic',
    contextDetectionMode: 'automatic',
    loreGenerationMode: 'automatic',
    injectContinuity: true,
    injectLore: true,
    loreLowInjectionEnabled: true,
    loreLowInjectionMode: 'compressed',
    customNonManagedFlag: 'preserve-me',
};
const expectedBackup = pickManagedExperienceSettings(advancedSettings);
const basicResult = applyExperienceModeSettings(advancedSettings, 'basic');

assert.equal(basicResult.changed, true, 'Switching Advanced to Basic must report a change.');
assert.equal(advancedSettings.experienceMode, 'basic', 'Basic switch must set experienceMode.');
assert.equal(advancedSettings.basicExperienceProfileVersion, BASIC_EXPERIENCE_PROFILE_VERSION, 'Basic switch must stamp the profile version.');
assertDeepEqual(advancedSettings.advancedExperienceSettingsBackup, expectedBackup, 'Basic switch must back up managed Advanced settings.');
for (const key of BASIC_EXPERIENCE_MANAGED_SETTING_KEYS) {
    assert.deepEqual(advancedSettings[key], BASIC_EXPERIENCE_SETTINGS[key], `Basic switch must apply managed Basic setting ${key}.`);
}
assert.equal(advancedSettings.customNonManagedFlag, 'preserve-me', 'Basic switch must preserve non-managed settings.');

const state = {
    lorePanel: { activeTab: 'injection', drawerOpen: true },
    loredeckStack: [{ packId: 'hp-core', enabled: true }],
    loredeckContexts: { 'hp-core': { anchorId: 'year-6', manualLock: true } },
    pendingLoreEntries: [{ id: 'pending-1', title: 'Pending Lore' }],
    loreMatrix: [{ id: 'accepted-1', title: 'Accepted Lore' }],
};
const preservedState = {
    loredeckStack: clone(state.loredeckStack),
    loredeckContexts: clone(state.loredeckContexts),
    pendingLoreEntries: clone(state.pendingLoreEntries),
    loreMatrix: clone(state.loreMatrix),
};
state.lorePanel.activeTab = normalizeTabForExperience(state.lorePanel.activeTab, advancedSettings);

assert.equal(state.lorePanel.activeTab, 'session', 'Switching to Basic must route a hidden saved Injection tab to Session.');
assertDeepEqual(state.loredeckStack, preservedState.loredeckStack, 'Mode switching must preserve the active Loredeck stack.');
assertDeepEqual(state.loredeckContexts, preservedState.loredeckContexts, 'Mode switching must preserve Context rows.');
assertDeepEqual(state.pendingLoreEntries, preservedState.pendingLoreEntries, 'Mode switching must preserve pending Lorecards.');
assertDeepEqual(state.loreMatrix, preservedState.loreMatrix, 'Mode switching must preserve accepted Lorecards.');

const advancedResult = applyExperienceModeSettings(advancedSettings, 'advanced');
assert.equal(advancedResult.changed, true, 'Switching Basic to Advanced must report a change.');
assert.equal(advancedSettings.experienceMode, 'advanced', 'Advanced switch must set experienceMode.');
for (const key of BASIC_EXPERIENCE_MANAGED_SETTING_KEYS) {
    assert.deepEqual(advancedSettings[key], expectedBackup[key], `Advanced switch must restore backed-up setting ${key}.`);
}
state.lorePanel.activeTab = 'injection';
assert.equal(normalizeTabForExperience(state.lorePanel.activeTab, advancedSettings), 'injection', 'Advanced must keep Injection visible after restoration.');

const idempotentResult = applyExperienceModeSettings(advancedSettings, 'advanced');
assert.equal(idempotentResult.changed, false, 'Applying the current experience mode must be idempotent.');

const fallbackSettings = { experienceMode: 'basic', advancedExperienceSettingsBackup: null };
applyExperienceModeSettings(fallbackSettings, 'advanced');
assert.equal(fallbackSettings.experienceMode, 'advanced', 'Advanced fallback switch must set experienceMode.');
assert.equal(fallbackSettings.automationMode, DEFAULT_SETTINGS.automationMode, 'Advanced fallback must restore default managed settings when no backup exists.');
assert.equal(fallbackSettings.workflowMode, fallbackSettings.automationMode || DEFAULT_SETTINGS.workflowMode, 'Advanced fallback must keep workflowMode aligned with automationMode.');

console.log('Experience mode contract passed.');
