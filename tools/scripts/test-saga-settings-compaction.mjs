import assert from 'node:assert/strict';

import { MODULE_KEY } from '../../src/state/constants.js';
import {
  getSettings,
  saveSettings,
} from '../../src/state/settings-store.js';

let saveSettingsCount = 0;

const heavyMarkers = [
  'Should Not Persist In Settings On Read',
  'Should Not Persist In Settings On Save',
  'Polluting Creator Draft',
  'data:image/png;base64,iVBORw0KGgo=',
];

const extensionSettings = {
  [MODULE_KEY]: {
    enabled: true,
    experienceMode: 'advanced',
    debugMode: false,
    themePackId: 'external-theme',
    themeIconSetId: 'external-icons',
    sagaStorage: {
      storageVersion: 'external-files-v1',
    },
    sagaStorageFallback: {},
    loredeckLibrary: {
      schemaVersion: 1,
      packs: {
        polluting: {
          packId: 'polluting',
          type: 'custom',
          title: 'Polluting Pack',
          entryOverrides: {
            nami: {
              id: 'nami',
              title: 'Nami',
              content: {
                fact: 'Should Not Persist In Settings On Read',
              },
            },
          },
          manifestData: {
            title: 'Polluting Manifest',
          },
        },
      },
      folders: [{ id: 'polluting-folder', title: 'Polluting Folder' }],
      deckPlacements: [{ deckId: 'polluting', folderId: 'polluting-folder' }],
      activeStack: [{ packId: 'polluting', enabled: true }],
    },
    loredeckCreatorProjects: {
      schemaVersion: 1,
      activeJobId: 'polluting_creator',
      lastJobId: 'polluting_creator',
      jobs: {
        polluting_creator: {
          jobId: 'polluting_creator',
          fandom: 'One Piece',
          projectTitle: 'Polluting Creator Draft',
          titleDrafts: [{ titleId: 'draft', title: 'Polluting Creator Draft' }],
          generationRuns: {
            run: { rawResponse: 'Should Not Persist In Settings On Read' },
          },
        },
      },
    },
    themePackLibrary: {
      schemaVersion: 1,
      packs: {
        'external-theme': {
          id: 'external-theme',
          type: 'custom',
          title: 'External Theme',
          colors: {
            background: '#120c12',
            accent: '#d7b56d',
          },
        },
      },
    },
    themeIconSetLibrary: {
      schemaVersion: 1,
      iconSets: {
        'external-icons': {
          id: 'external-icons',
          type: 'custom',
          title: 'External Icons',
          icons: {
            'tab.loredecks': 'data:image/png;base64,iVBORw0KGgo=',
          },
        },
      },
    },
  },
};

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings,
      chatMetadata: {},
      saveSettingsDebounced() {
        saveSettingsCount += 1;
      },
    };
  },
};

function serializedStoredSettings() {
  return JSON.stringify(extensionSettings[MODULE_KEY]);
}

function assertStoredSettingsRetained(label) {
  const stored = extensionSettings[MODULE_KEY];
    assert.equal(stored.sagaStorage.storageVersion, 'external-files-v1', `${label}: storage version survives normalization.`);
    assert(stored.loredeckLibrary.packs.polluting, `${label}: Library source remains until external durability.`);
    assert.equal(stored.loredeckLibrary.folders.length, 1);
    assert.equal(stored.loredeckLibrary.deckPlacements.length, 1);
    assert(stored.loredeckCreatorProjects.jobs.polluting_creator);
    assert(stored.themePackLibrary.packs['external-theme']);
    assert(stored.themeIconSetLibrary.iconSets['external-icons']);
    for (const marker of [heavyMarkers[0], heavyMarkers[2], heavyMarkers[3]]) assert(serializedStoredSettings().includes(marker), `${label}: retained source includes ${marker}.`);
    assert.equal(stored.sagaInlineRecovery.status, 'pending');
    assert.equal(stored.sagaInlineRecovery.registries.loredeckLibrary.packs.polluting.entryOverrides.nami.content.fact, heavyMarkers[0]);
}

const settings = getSettings();
assert(settings.loredeckLibrary.packs.polluting, 'Settings reads retain supported inline payload rows.');
assert(settings.loredeckCreatorProjects.jobs.polluting_creator);
assert(settings.themePackLibrary.packs['external-theme']);
assert(settings.themeIconSetLibrary.iconSets['external-icons']);
assert.equal(settings.themePackId, 'external-theme', 'Active Theme Pack ID remains compact control-plane state.');
assert.equal(settings.themeIconSetId, 'external-icons', 'Active Icon Set ID remains compact control-plane state.');
assertStoredSettingsRetained('getSettings');

settings.debugMode = true;
settings.loredeckLibrary.packs.accidental = {
  packId: 'accidental',
  type: 'custom',
  title: 'Accidental Pack',
  entryOverrides: {
    luffy: {
      id: 'luffy',
      content: {
        fact: 'Should Not Persist In Settings On Save',
      },
    },
  },
};
settings.loredeckCreatorProjects.jobs.accidental_creator = {
  jobId: 'accidental_creator',
  titleDrafts: [{ titleId: 'draft', title: 'Should Not Persist In Settings On Save' }],
};
settings.themePackLibrary.packs.accidental_theme = {
  id: 'accidental_theme',
  title: 'Accidental Theme',
  colors: { accent: '#d7b56d' },
};
settings.themeIconSetLibrary.iconSets.accidental_icons = {
  id: 'accidental_icons',
  title: 'Accidental Icons',
  icons: { 'tab.loredecks': 'data:image/png;base64,iVBORw0KGgo=' },
};

saveSettings(settings);
assert.equal(saveSettingsCount, 1);
assert.equal(extensionSettings[MODULE_KEY].debugMode, true, 'Ordinary compact preferences should still save.');
assertStoredSettingsRetained('saveSettings');
assert(serializedStoredSettings().includes(heavyMarkers[1]), 'An unrelated save cannot erase newly supplied inline data.');

console.log('Saga settings preservation before acknowledged compaction tests passed.');
