import assert from 'node:assert/strict';
import { MODULE_KEY, SCHEMA_VERSION } from '../constants.js';
import {
  activateLoredeckCreatorJob,
  clearLoredeckCreatorJob,
  getLoredeckCreatorProjectRegistry,
  getLoredeckCreatorRegistry,
  getSettings,
  getState,
  updateLoredeckCreatorProject,
  upsertLoredeckCreatorJob,
} from '../state-manager.js';

let extensionSettings = {
  [MODULE_KEY]: {},
};
let chatMetadata = {
  [MODULE_KEY]: {
    _version: SCHEMA_VERSION,
    loreContext: {},
    loreMatrix: [],
    pendingLoreEntries: [],
    loredeckCreator: {
      schemaVersion: 1,
      activeJobId: 'creator_one_piece_arlong',
      lastJobId: 'creator_one_piece_arlong',
      jobs: {
        creator_one_piece_arlong: {
          schemaVersion: 1,
          jobId: 'creator_one_piece_arlong',
          fandom: 'One Piece',
          scope: 'Arlong Park Arc',
          granularity: 'focused',
          status: 'draft',
          currentStage: 'titles_drafted',
          titleDrafts: [
            { titleId: 'arlong-pressure', title: 'Arlong pressure over Cocoyasi Village' },
          ],
          createdAt: 100,
          updatedAt: 200,
        },
      },
    },
  },
};
let saveSettingsCount = 0;
let saveStateCount = 0;

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings,
      chatMetadata,
      saveSettingsDebounced() {
        saveSettingsCount += 1;
      },
      saveMetadata() {
        saveStateCount += 1;
      },
    };
  },
};

const state = getState();
assert.equal(state.loredeckCreator.activeJobId, 'creator_one_piece_arlong');

const settingsAfterMigration = getSettings();
assert.equal(settingsAfterMigration.loredeckCreatorProjects.schemaVersion, 1);
assert.equal(settingsAfterMigration.loredeckCreatorProjects.activeJobId, 'creator_one_piece_arlong');
assert.equal(settingsAfterMigration.loredeckCreatorProjects.jobs.creator_one_piece_arlong.scope, 'Arlong Park Arc');
assert.ok(saveSettingsCount >= 1, 'Opening a chat with local Creator jobs should promote them to global settings.');

const globalRegistry = getLoredeckCreatorProjectRegistry();
assert.equal(globalRegistry.activeJobId, 'creator_one_piece_arlong');
assert.equal(globalRegistry.jobs.creator_one_piece_arlong.currentStage, 'titles_drafted');

const upserted = upsertLoredeckCreatorJob({
  jobId: 'creator_naruto_chunin',
  fandom: 'Naruto',
  scope: 'Chunin Exams',
  granularity: 'focused',
  projectTitle: 'Naruto: Chunin Exams',
  folderId: 'naruto',
  currentStage: 'brief_drafted',
}, { syncPrompt: false });

assert.equal(upserted.ok, true);
assert.equal(upserted.job.projectTitle, 'Naruto: Chunin Exams');
assert.equal(upserted.job.titleDrafts, undefined, 'Creating a different project must not inherit title drafts from the previously active project.');
assert.equal(upserted.projectRegistry.activeJobId, 'creator_naruto_chunin');
assert.equal(extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_naruto_chunin.folderId, 'naruto');
assert.equal(chatMetadata[MODULE_KEY].loredeckCreator.jobs.creator_naruto_chunin.folderId, 'naruto');
assert.ok(saveStateCount >= 1, 'Creator project upsert should keep the current chat mirror in sync.');

const mergedRegistry = getLoredeckCreatorRegistry(getState());
assert.equal(mergedRegistry.jobs.creator_one_piece_arlong.scope, 'Arlong Park Arc');
assert.equal(mergedRegistry.jobs.creator_naruto_chunin.scope, 'Chunin Exams');
assert.equal(mergedRegistry.activeJobId, 'creator_naruto_chunin');

const activated = activateLoredeckCreatorJob('creator_one_piece_arlong', { syncPrompt: false });
assert.equal(activated.ok, true);
assert.equal(activated.job.scope, 'Arlong Park Arc');
assert.equal(activated.registry.activeJobId, 'creator_one_piece_arlong');
assert.equal(extensionSettings[MODULE_KEY].loredeckCreatorProjects.activeJobId, 'creator_one_piece_arlong');
assert.equal(chatMetadata[MODULE_KEY].loredeckCreator.activeJobId, 'creator_one_piece_arlong');
assert.equal(activated.job.projectTitle, undefined, 'Activating an older project must not inherit fields from the previously active project.');

const reactivated = activateLoredeckCreatorJob('creator_naruto_chunin', { syncPrompt: false });
assert.equal(reactivated.ok, true);
assert.equal(reactivated.job.scope, 'Chunin Exams');

const renamedInactive = updateLoredeckCreatorProject('creator_one_piece_arlong', {
  projectTitle: 'One Piece: Arlong Park Draft',
}, { syncPrompt: false });
assert.equal(renamedInactive.ok, true);
assert.equal(renamedInactive.projectRegistry.jobs.creator_one_piece_arlong.projectTitle, 'One Piece: Arlong Park Draft');
assert.equal(renamedInactive.projectRegistry.activeJobId, 'creator_naruto_chunin', 'Renaming an inactive project must not make it active.');
assert.equal(chatMetadata[MODULE_KEY].loredeckCreator.jobs.creator_one_piece_arlong.projectTitle, 'One Piece: Arlong Park Draft');
assert.equal(chatMetadata[MODULE_KEY].loredeckCreator.activeJobId, 'creator_naruto_chunin');

const cleared = clearLoredeckCreatorJob('creator_naruto_chunin', { syncPrompt: false });
assert.equal(cleared.ok, true);
assert.ok(!extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_naruto_chunin);
assert.ok(!chatMetadata[MODULE_KEY].loredeckCreator.jobs.creator_naruto_chunin);
assert.equal(getLoredeckCreatorProjectRegistry().jobs.creator_one_piece_arlong.scope, 'Arlong Park Arc');

console.log('Loredeck Creator project registry tests passed.');
