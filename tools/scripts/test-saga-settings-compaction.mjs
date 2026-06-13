import assert from 'node:assert/strict';

import { MODULE_KEY } from '../../src/state/constants.js';
import {
  SAGA_STORAGE_MIGRATION_VERSION,
} from '../../src/storage/saga-storage-index.js';
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
      migrationVersion: SAGA_STORAGE_MIGRATION_VERSION,
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

function assertStoredSettingsCompact(label) {
  const stored = extensionSettings[MODULE_KEY];
  assert.equal(stored.sagaStorage.migrationVersion, SAGA_STORAGE_MIGRATION_VERSION, `${label}: migration marker should survive compaction.`);
  assert.deepEqual(stored.loredeckLibrary.packs, {}, `${label}: Loredeck Library rows should stay external.`);
  assert.deepEqual(stored.loredeckLibrary.folders, [], `${label}: Library folders should stay external.`);
  assert.deepEqual(stored.loredeckLibrary.deckPlacements, [], `${label}: Library placements should stay external.`);
  assert.deepEqual(stored.loredeckCreatorProjects.jobs, {}, `${label}: Creator jobs should stay external.`);
  assert.deepEqual(stored.themePackLibrary.packs, {}, `${label}: Theme Pack rows should stay external.`);
  assert.deepEqual(stored.themeIconSetLibrary.iconSets, {}, `${label}: Icon Set rows should stay external.`);
  for (const marker of heavyMarkers) {
    assert.equal(serializedStoredSettings().includes(marker), false, `${label}: settings should not include ${marker}.`);
  }
}

const settings = getSettings();
assert.equal(settings.loredeckLibrary.packs.polluting, undefined, 'Migrated reads should ignore stale settings-backed Lorepack payload rows.');
assert.equal(settings.loredeckCreatorProjects.jobs.polluting_creator, undefined, 'Migrated reads should ignore stale settings-backed Creator project payloads.');
assert.equal(settings.themePackLibrary.packs['external-theme'], undefined, 'Migrated reads should ignore stale settings-backed Theme Pack payloads.');
assert.equal(settings.themeIconSetLibrary.iconSets['external-icons'], undefined, 'Migrated reads should ignore stale settings-backed Icon Set payloads.');
assert.equal(settings.themePackId, 'external-theme', 'Active Theme Pack ID remains compact control-plane state.');
assert.equal(settings.themeIconSetId, 'external-icons', 'Active Icon Set ID remains compact control-plane state.');
assertStoredSettingsCompact('getSettings');

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
assertStoredSettingsCompact('saveSettings');

console.log('Saga settings compaction tests passed.');
