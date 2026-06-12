import assert from 'node:assert/strict';
import { MODULE_KEY, SCHEMA_VERSION } from '../../src/state/constants.js';
import {
  activateLoredeckCreatorJob,
  clearLoredeckCreatorJob,
  getLoredeckCreatorProjectRegistry,
  getLoredeckCreatorRegistry,
  getSettings,
  getState,
  removeLoredeckLibraryPack,
  setLoredeckCreatorActiveGeneration,
  updateLoredeckCreatorGenerationRun,
  updateLoredeckCreatorGenerationUnit,
  updateLoredeckCreatorProject,
  upsertLoredeckLibraryPack,
  upsertLoredeckCreatorJob,
} from '../../src/state/state-manager.js';

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
let throwSettingsSave = false;

globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings,
      chatMetadata,
      saveSettingsDebounced() {
        if (throwSettingsSave) throw new Error('settings save exploded');
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
assert.deepEqual(globalRegistry.jobs.creator_one_piece_arlong.generationRuns, {});
assert.deepEqual(globalRegistry.jobs.creator_one_piece_arlong.generationUnits, {});

const runStarted = updateLoredeckCreatorGenerationRun('creator_one_piece_arlong', {
  runId: 'run_titles_1',
  stage: 'titles',
  status: 'running',
  totalUnits: 2,
  currentUnitId: 'unit_title_1',
  startedAt: 300,
}, {
  syncPrompt: false,
  label: 'Generating title batches',
  currentStage: 'titles_drafting',
});
assert.equal(runStarted.ok, true);
assert.equal(runStarted.job.generationRuns.run_titles_1.status, 'running');
assert.equal(runStarted.job.activeGeneration.runId, 'run_titles_1');
assert.equal(runStarted.job.activeGeneration.status, 'running');
assert.equal(runStarted.job.currentStage, 'titles_drafting');
assert.equal(extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_one_piece_arlong.activeGeneration.runId, 'run_titles_1');
assert.equal(chatMetadata[MODULE_KEY].loredeckCreator.jobs.creator_one_piece_arlong.activeGeneration.runId, 'run_titles_1');

const unitStarted = updateLoredeckCreatorGenerationUnit('creator_one_piece_arlong', 'unit_title_1', {
  runId: 'run_titles_1',
  stage: 'titles',
  status: 'running',
  label: 'Characters and pressure',
  inputHash: 'hash_input',
  attempts: 1,
  startedAt: 310,
}, {
  syncPrompt: false,
  label: 'Generating title batch 1 of 2',
  currentStage: 'titles_drafting',
});
assert.equal(unitStarted.ok, true);
assert.equal(unitStarted.job.generationUnits.unit_title_1.status, 'running');
assert.equal(unitStarted.job.activeGeneration.unitId, 'unit_title_1');
assert.equal(unitStarted.job.activeGeneration.phase, 'running');
assert.equal(unitStarted.job.activeGeneration.label, 'Generating title batch 1 of 2');

const unitCompleted = updateLoredeckCreatorGenerationUnit('creator_one_piece_arlong', 'unit_title_1', {
  status: 'complete',
  outputHash: 'hash_output',
  completedAt: 330,
  resultRef: { type: 'creator_title_batch', batchId: 'characters_pressure' },
}, { syncPrompt: false });
assert.equal(unitCompleted.ok, true);
assert.equal(unitCompleted.job.generationUnits.unit_title_1.status, 'complete');
assert.equal(unitCompleted.job.generationUnits.unit_title_1.resultRef.batchId, 'characters_pressure');
assert.equal(unitCompleted.job.activeGeneration, undefined, 'Completing the active unit should clear activeGeneration.');
assert.equal(unitCompleted.job.status, 'draft', 'Clearing activeGeneration should not leave the Creator project stuck as running.');

const runCompleted = updateLoredeckCreatorGenerationRun('creator_one_piece_arlong', {
  runId: 'run_titles_1',
  status: 'complete',
  completedUnits: 1,
  completedAt: 340,
}, { syncPrompt: false });
assert.equal(runCompleted.ok, true);
assert.equal(runCompleted.job.generationRuns.run_titles_1.status, 'complete');

const rerunStarted = updateLoredeckCreatorGenerationRun('creator_one_piece_arlong', {
  runId: 'run_titles_2',
  stage: 'titles',
  status: 'running',
  totalUnits: 1,
  currentUnitId: 'unit_title_1',
  startedAt: 350,
}, {
  syncPrompt: false,
  label: 'Regenerating title batch',
  currentStage: 'titles_drafting',
});
assert.equal(rerunStarted.ok, true);

const rerunUnitStarted = updateLoredeckCreatorGenerationUnit('creator_one_piece_arlong', 'unit_title_1', {
  runId: 'run_titles_2',
  stage: 'titles',
  status: 'running',
  label: 'Characters and pressure',
  attempts: 1,
  startedAt: 360,
}, {
  syncPrompt: false,
  label: 'Regenerating title batch',
  currentStage: 'titles_drafting',
});
assert.equal(rerunUnitStarted.ok, true);
assert.equal(rerunUnitStarted.job.activeGeneration.runId, 'run_titles_2');
assert.equal(rerunUnitStarted.job.generationUnits.unit_title_1.runId, 'run_titles_2');

const staleOldUnit = updateLoredeckCreatorGenerationUnit('creator_one_piece_arlong', 'unit_title_1', {
  runId: 'run_titles_1',
  stage: 'titles',
  status: 'superseded',
  completedAt: 365,
}, { syncPrompt: false });
assert.equal(staleOldUnit.ok, true);
assert.equal(staleOldUnit.ignored, true, 'A stale old run for the same stable unit ID should be ignored while a newer run is active.');
assert.equal(staleOldUnit.job.activeGeneration.runId, 'run_titles_2');
assert.equal(staleOldUnit.job.generationUnits.unit_title_1.runId, 'run_titles_2');

const rerunUnitCompleted = updateLoredeckCreatorGenerationUnit('creator_one_piece_arlong', 'unit_title_1', {
  runId: 'run_titles_2',
  stage: 'titles',
  status: 'complete',
  completedAt: 370,
  resultRef: { type: 'creator_title_batch', batchId: 'characters_pressure', draftCount: 4 },
}, { syncPrompt: false });
assert.equal(rerunUnitCompleted.ok, true);
assert.equal(rerunUnitCompleted.job.generationUnits.unit_title_1.status, 'complete');
assert.equal(rerunUnitCompleted.job.generationUnits.unit_title_1.runId, 'run_titles_2');
assert.equal(rerunUnitCompleted.job.activeGeneration, undefined);

const rerunCompleted = updateLoredeckCreatorGenerationRun('creator_one_piece_arlong', {
  runId: 'run_titles_2',
  status: 'complete',
  completedUnits: 1,
  completedAt: 380,
}, { syncPrompt: false });
assert.equal(rerunCompleted.ok, true);

const activeSet = setLoredeckCreatorActiveGeneration('creator_one_piece_arlong', {
  id: 'run_outline_1',
  runId: 'run_outline_1',
  actionId: 'outline',
  stage: 'outline',
  currentStage: 'outline_drafting',
  status: 'running',
  label: 'Drafting Story Outline',
}, { syncPrompt: false });
assert.equal(activeSet.ok, true);
assert.equal(activeSet.job.activeGeneration.label, 'Drafting Story Outline');
assert.equal(activeSet.job.currentStage, 'outline_drafting');

const activeCleared = setLoredeckCreatorActiveGeneration('creator_one_piece_arlong', null, { syncPrompt: false });
assert.equal(activeCleared.ok, true);
assert.equal(activeCleared.job.activeGeneration, undefined);
assert.equal(activeCleared.job.status, 'draft');

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

const generatedPackId = 'one-piece-arlong-park-generated';
const linkedGeneratedProject = updateLoredeckCreatorProject('creator_one_piece_arlong', {
  generatedPackId,
  generatedPackTitle: 'One Piece: Arlong Park',
  planningQueuedCount: 1,
}, { syncPrompt: false });
assert.equal(linkedGeneratedProject.ok, true);

const titleOnlyGeneratedProject = upsertLoredeckCreatorJob({
  jobId: 'creator_one_piece_arlong_title_only',
  fandom: 'One Piece',
  scope: 'Arlong Park Arc',
  granularity: 'focused',
  brief: {
    title: 'One Piece: Arlong Park Generated',
    fandom: 'One Piece',
    scope: 'Arlong Park Arc',
  },
}, { syncPrompt: false });
assert.equal(titleOnlyGeneratedProject.ok, true);

const generatedPackRecord = {
  packId: generatedPackId,
  type: 'generated',
  title: 'One Piece: Arlong Park',
  description: 'Generated Arlong Park draft deck.',
  fandom: 'One Piece',
  era: 'Arlong Park Arc',
  source: { kind: 'generated' },
  tags: ['origin:generated', 'saga:creator'],
  stats: { entryCount: 0, categoryCounts: {} },
};
const generatedPackSaved = upsertLoredeckLibraryPack(generatedPackRecord);
assert.equal(generatedPackSaved.ok, true);
assert.equal(extensionSettings[MODULE_KEY].loredeckLibrary.packs[generatedPackId].type, 'generated');

chatMetadata[MODULE_KEY].loredeckRegistry = {
  schemaVersion: 1,
  packs: {
    [generatedPackId]: {
      ...generatedPackRecord,
      title: 'One Piece: Arlong Park chat mirror',
    },
  },
};

const generatedPackRemoved = removeLoredeckLibraryPack(generatedPackId, { syncPrompt: false });
assert.equal(generatedPackRemoved.ok, true);
assert.deepEqual(generatedPackRemoved.clearedCreatorJobIds, ['creator_one_piece_arlong', 'creator_one_piece_arlong_title_only']);
assert.ok(!extensionSettings[MODULE_KEY].loredeckLibrary.packs[generatedPackId], 'Deleting a Generated Loredeck should remove the global pack record.');
assert.ok(!chatMetadata[MODULE_KEY].loredeckRegistry.packs[generatedPackId], 'Deleting a Generated Loredeck should remove the chat-local pack mirror.');
assert.ok(!extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_one_piece_arlong, 'Deleting a Generated Loredeck should clear its global Creator project.');
assert.ok(!chatMetadata[MODULE_KEY].loredeckCreator.jobs.creator_one_piece_arlong, 'Deleting a Generated Loredeck should clear its chat-local Creator project.');
assert.ok(!extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_one_piece_arlong_title_only, 'Deleting a Generated Loredeck should clear Creator projects that only retain the normalized brief title.');
assert.ok(!chatMetadata[MODULE_KEY].loredeckCreator.jobs.creator_one_piece_arlong_title_only, 'Deleting a Generated Loredeck should clear chat-local title-only Creator projects.');
assert.ok(extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_naruto_chunin, 'Unrelated Creator projects should remain.');
assert.equal(getLoredeckCreatorProjectRegistry().activeJobId, 'creator_naruto_chunin');

const cleared = clearLoredeckCreatorJob('creator_naruto_chunin', { syncPrompt: false });
assert.equal(cleared.ok, true);
assert.ok(!extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_naruto_chunin);
assert.ok(!chatMetadata[MODULE_KEY].loredeckCreator.jobs.creator_naruto_chunin);
assert.deepEqual(Object.keys(getLoredeckCreatorProjectRegistry().jobs), []);

throwSettingsSave = true;
const failedCreatorPersistence = upsertLoredeckCreatorJob({
  jobId: 'creator_storage_failure',
  fandom: 'One Piece',
  scope: 'Storage failure fixture',
}, { syncPrompt: false });
assert.equal(failedCreatorPersistence.ok, false);
assert.match(failedCreatorPersistence.error, /settings save exploded/);

const failedLibraryPersistence = upsertLoredeckLibraryPack({
  packId: 'storage-failure-pack',
  type: 'generated',
  title: 'Storage Failure Pack',
  source: { kind: 'generated' },
});
assert.equal(failedLibraryPersistence.ok, false);
assert.match(failedLibraryPersistence.error, /settings save exploded/);
throwSettingsSave = false;

if (extensionSettings[MODULE_KEY].loredeckCreatorProjects.jobs.creator_storage_failure) {
  const cleanedFailureJob = clearLoredeckCreatorJob('creator_storage_failure', { syncPrompt: false });
  assert.equal(cleanedFailureJob.ok, true);
}
if (extensionSettings[MODULE_KEY].loredeckLibrary.packs['storage-failure-pack']) {
  const cleanedFailurePack = removeLoredeckLibraryPack('storage-failure-pack', { clearCreatorProjects: false, syncPrompt: false });
  assert.equal(cleanedFailurePack.ok, true);
}
assert.deepEqual(Object.keys(getLoredeckCreatorProjectRegistry().jobs), []);

console.log('Loredeck Creator project registry tests passed.');
