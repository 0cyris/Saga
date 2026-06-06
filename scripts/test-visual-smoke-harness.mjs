import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const harnessPath = path.join(root, 'tests', 'visual-smoke.html');
const fixturePath = path.join(root, 'tests', 'fixtures', 'arlong-park-update.saga-loredeck.json');
const loredeckIndexPath = path.join(root, 'Loredecks', 'index.json');
const panelPath = path.join(root, 'lore-panel.js');
const assistantPath = path.join(root, 'loredeck-assistant.js');
const llmClientPath = path.join(root, 'lore-llm-client.js');
const creatorProjectsPath = path.join(root, 'loredeck-creator-projects.js');
const stateManagerPath = path.join(root, 'state-manager.js');
const stylePath = path.join(root, 'style.css');
const settingsTemplatePath = path.join(root, 'settings.html');
const sagaHeroIconPath = path.join(root, 'Images', 'iconsets', 'saga-hero', 'hero-tab-loredecks-256.png');
const sagaHeroManifestPath = path.join(root, 'Images', 'iconsets', 'saga-hero', 'icons.json');
const sagaMysticIconPath = path.join(root, 'Images', 'iconsets', 'saga-mystic', 'mystic-tab-loredecks-256.png');
const sagaMysticManifestPath = path.join(root, 'Images', 'iconsets', 'saga-mystic', 'icons.json');
const sagaRelayIconPath = path.join(root, 'Images', 'iconsets', 'saga-relay', 'relay-tab-loredecks-256.png');
const sagaRelayManifestPath = path.join(root, 'Images', 'iconsets', 'saga-relay', 'icons.json');
const hpCoreCoverPath = path.join(root, 'Loredecks', 'hp-core', 'assets', 'cover.png');
const hpYearOneCoverPath = path.join(root, 'Loredecks', 'hp-year-1-philosophers-stone', 'assets', 'cover.png');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const harness = read(harnessPath);
const fixture = JSON.parse(read(fixturePath));
const loredeckIndex = JSON.parse(read(loredeckIndexPath));
const panel = read(panelPath);
const assistant = read(assistantPath);
const llm = read(llmClientPath);
const creatorProjects = read(creatorProjectsPath);
const stateManager = read(stateManagerPath);
const style = read(stylePath);
const settingsTemplate = read(settingsTemplatePath);

assert(harness.includes("import { showLorePanel } from '../lore-panel.js';"), 'Harness must import the real runtime panel.');
assert(fs.existsSync(sagaHeroIconPath), 'Bundled Saga Hero Loredecks icon must exist.');
assert(JSON.parse(read(sagaHeroManifestPath)).id === 'saga-hero', 'Bundled Saga Hero Icon Set manifest must exist.');
assert(fs.existsSync(sagaMysticIconPath), 'Bundled Saga Mystic Loredecks icon must exist.');
assert(JSON.parse(read(sagaMysticManifestPath)).id === 'saga-mystic', 'Bundled Saga Mystic Icon Set manifest must exist.');
assert(fs.existsSync(sagaRelayIconPath), 'Bundled Saga Relay Loredecks icon must exist.');
assert(JSON.parse(read(sagaRelayManifestPath)).id === 'saga-relay', 'Bundled Saga Relay Icon Set manifest must exist.');
assert(fs.existsSync(hpCoreCoverPath), 'Bundled HP Core Loredeck cover must be deck-local.');
assert(fs.existsSync(hpYearOneCoverPath), 'Bundled HP Year 1 Loredeck cover must be deck-local.');
assert((loredeckIndex.bundled || []).some(record => record.packId === 'hp-core' && record.assets?.cover?.path === 'assets/cover.png'), 'Bundled HP index records must expose deck-local cover paths.');
assert(harness.includes('window.SillyTavern'), 'Harness must stub SillyTavern before importing modules.');
assert(harness.includes('window.__sagaSmokeReady = true'), 'Harness must expose a smoke-ready marker.');
assert(harness.includes("activeTab: 'loredecks'"), 'Harness must open directly to the Loredecks tab.');
assert(harness.includes("selectedLoredeckId: customPack.packId"), 'Harness must select the seeded Custom Loredeck.');
assert(harness.includes('pendingChanges'), 'Harness must seed Pending Review content.');
assert(harness.includes('source: {'), 'Harness must seed source/update metadata.');
assert(harness.includes('./fixtures/arlong-park-update.saga-loredeck.json'), 'Harness must point at the local update fixture.');
assert(!settingsTemplate.includes('Provider Settings'), 'Extension menu settings must not expose the old Provider Settings dropdown.');
assert(!settingsTemplate.includes('API and model controls'), 'Extension menu settings must not expose legacy API/model controls.');
assert(!panel.includes('Drop support is queued'), 'Loredeck Library must not expose queued drop-support placeholder copy.');
assert(!panel.includes("['contents', 'Contents'"), 'Loredeck Library details must not expose the low-value Contents tab.');
assert(!panel.includes("['activation', 'Activation'"), 'Loredeck Library details must not expose the low-value Activation tab.');
assert(!panel.includes("createButton('Delete Folder'"), 'Folder details must not expose a redundant Delete Folder button.');
assert(!panel.includes("createButton('Remove', 'Remove this Loredeck from the current stack.'"), 'Loredeck details must not expose a redundant Remove button.');
assert(!panel.includes('createLoredeckLibraryCurrentViewHeader'), 'Loredeck Library must not render the obsolete current-view side-tree summary strip.');
assert(!style.includes('wandlight-loredeck-library-current-view'), 'Loredeck Library CSS must not keep obsolete current-view side-tree styles.');
assert(panel.includes('buildLoredeckPackScopedHealth'), 'Loredeck Library deck stats must scope aggregate stack health back to a single pack.');
assert(panel.includes('report?.databaseId === packId'), 'Loredeck Library deck counts must guard against aggregate stack report summaries.');
assert(!panel.includes('entryCount: Number(report.summary?.entryCount) || Number(loadedMeta?.entryCount)'), 'Loredeck Library deck counts must not prefer aggregate report entry totals over per-pack metadata.');
assert(panel.includes('function refreshLoredeckLibrarySelectionSurfaces'), 'Loredeck Library card selection must support in-place surface refreshes.');
assert(panel.includes('function updateLoredeckLibraryDetailsCollapsedDom'), 'Loredeck Library details expand/collapse must update the existing DOM in place.');
assert(panel.includes('if (!updateLoredeckLibraryDetailsCollapsedDom(next)) renderLoredeckLibraryOverlay();'), 'Loredeck Library details collapse should only rerender when the overlay DOM is missing.');
assert(panel.includes('LOREDECK_CREATOR_ENTRY_BATCH_SIZE = 3'), 'Creator entry drafting must keep the default micro-batch size small.');
assert(panel.includes('Draft Lorecards'), 'Creator entry drafting must expose a guided one-batch action.');
assert(panel.includes('Auto-Draft Up To ${generationSettings.entryRunRemainingLimit}'), 'Creator entry drafting must expose a settings-driven bounded advanced auto-draft action.');
assert(panel.includes('Review the current Lorecard drafts before drafting more.'), 'Creator entry drafting must block additional generation while review drafts are open.');
assert(panel.includes('Creator Lorecard Draft Review'), 'Creator draft review must use Creator-specific review language.');
assert(panel.includes('Send Selected to Review'), 'Creator draft review must expose explicit Pending Review handoff language.');
assert(panel.includes('getLoredeckCreatorPipelineModel'), 'Creator wizard must derive a checkpointed production pipeline model.');
assert(style.includes('wandlight-loredeck-creator-stage-guide'), 'Creator roadmap must have dedicated styling.');
assert(panel.includes('getLoredeckCreatorWorkbenchScrollAnchor'), 'Creator workbench must preserve section anchors during rerenders.');
assert(panel.includes('restoreLoredeckCreatorWorkbenchScrollAnchor'), 'Creator workbench must restore section anchors after rerenders.');
assert(panel.includes("wrap.dataset.sagaCreatorAnchor = 'lorecards'"), 'Creator Lorecard stage must expose a stable scroll anchor.');
assert(panel.includes("wrap.dataset.sagaCreatorAnchor = 'finalize'"), 'Creator readiness stage must expose a stable scroll anchor.');
assert(assistant.includes('currentMicroBatchOnly'), 'Creator entry prompt context must mark entry drafting as a micro-batch.');
assert(assistant.includes('coverageSummary'), 'Creator brief prompt must use the compact scope-brief coverage summary field.');
assert(assistant.includes('timeline plans, tag plans, title-pass plans'), 'Creator brief prompt must prohibit first-pass generation plans.');
assert(assistant.includes('compactCreatorBriefForPrompt'), 'Creator brief revisions must compact older saved briefs before prompting.');
assert(assistant.includes('buildLoredeckCreatorOutlineSystemPrompt'), 'Creator must expose a dedicated outline-stage prompt.');
assert(assistant.includes('parseLoredeckCreatorOutlineResponse'), 'Creator must parse outline-stage responses.');
assert(assistant.includes('Context milestones'), 'Creator outline prompt must ask for major Context browser points.');
assert(assistant.includes('targetTitleBatch'), 'Creator title prompt must target one outline title batch per call.');
assert(assistant.includes('currentTitleBatchOnly'), 'Creator title prompt must prohibit drifting into other title batches.');
assert(assistant.includes('targetPlanningBatch'), 'Creator planning prompt must target one approved title batch per call.');
assert(assistant.includes('currentPlanningBatchOnly'), 'Creator planning prompt must prohibit drifting into other planning batches.');
assert(assistant.includes('acceptedPlanningBatchIds'), 'Creator entry prompt must receive accepted planning batch IDs.');
assert(panel.includes('buildLoredeckCreatorPlanningGenerationUnitId'), 'Creator planning must use stable unit IDs for one planning batch per provider call.');
assert(panel.includes('commitLoredeckCreatorPlanningResult'), 'Creator planning must commit through an idempotent Pending Review helper.');
assert(panel.includes('upsertLoredeckCreatorPlanningPendingChanges'), 'Creator planning must replace same-batch Pending Review proposals instead of appending duplicates.');
assert(panel.includes('creator_planning_batch:'), 'Creator planning unit IDs must be namespaced for runner checkpoints.');
assert(panel.includes('buildLoredeckCreatorEntryGenerationUnitId'), 'Creator Lorecard drafting must use stable micro-batch unit IDs.');
assert(panel.includes('commitLoredeckCreatorEntryDraftResult'), 'Creator Lorecard drafting must commit through an idempotent draft-review helper.');
assert(panel.includes('upsertLoredeckCreatorEntryDraftChanges'), 'Creator Lorecard drafting must replace same-unit draft-review records instead of appending duplicates.');
assert(panel.includes('creator_entry_micro_batch:'), 'Creator Lorecard unit IDs must be namespaced for runner checkpoints.');
assert(panel.includes('entry_micro_batch'), 'Creator Lorecard drafting must run through the generation runner as entry micro-batches.');
assert(panel.includes('draft-review items exist'), 'Creator Lorecard auto-draft must stop when draft-review items exist.');
assert(panel.includes('createLoredeckCreatorAdvancedGenerationSettings'), 'Creator wizard must expose a collapsed Advanced Generation Settings panel.');
assert(panel.includes('getLoredeckCreatorGenerationSettings'), 'Creator generation must read normalized per-project generation settings.');
assert(panel.includes('setLoredeckCreatorGenerationSettings'), 'Creator generation settings must persist per project.');
assert(panel.includes('showStreamingProgress'), 'Creator generation settings must control streaming progress snippets.');
assert(panel.includes('titleRunRemainingLimit'), 'Creator title Generate Remaining must use a configurable run limit.');
assert(panel.includes('entryRunRemainingLimit'), 'Creator Lorecard auto-draft must use a configurable run limit.');
assert(panel.includes('retryAttempts: Number.isFinite(Number(config.retryAttempts))'), 'Creator runner calls must support configured retry attempts.');
assert(stateManager.includes('generationSettings'), 'Creator project persistence must preserve generation settings.');
assert(panel.includes('unitMeta'), 'Creator generation units must persist compact retry metadata.');
assert(panel.includes('getLoredeckCreatorLatestRecoverableUnit'), 'Creator recovery must locate the latest failed or interrupted unit.');
assert(panel.includes('retryLoredeckCreatorRecoverableUnit'), 'Creator recovery must retry failed generation units.');
assert(panel.includes('markLoredeckCreatorRecoveryUnitSuperseded'), 'Creator Retry Smaller must supersede the previous failed unit after creating a replacement.');
assert(panel.includes('buildLoredeckCreatorRetryUnitId'), 'Creator Retry Smaller must create a distinct replacement unit ID.');
assert(panel.includes('Retry Failed'), 'Creator current task controls must expose Retry Failed.');
assert(panel.includes('Retry Smaller'), 'Creator current task controls must expose Retry Smaller.');
assert(panel.includes('Cancel Generation'), 'Creator current task controls must expose Cancel while a generation is active.');
assert(panel.includes('titlePassLimitOverride'), 'Creator Retry Smaller must reduce Title Pass batch size.');
assert(panel.includes('planningProposalLimitOverride'), 'Creator Retry Smaller must reduce Context/Tag planning proposal size.');
assert(panel.includes('targetTitleIds'), 'Creator Lorecard retries must preserve target title IDs.');
assert(panel.includes('getLoredeckCreatorPipelineReadiness'), 'Generated Loredeck export must inspect staged Creator pipeline readiness.');
assert(panel.includes('Creator Readiness Gate'), 'Creator wizard must expose deterministic readiness feedback.');
assert(panel.includes('titles covered'), 'Generated export readiness must show approved-title coverage.');
assert(panel.includes('No linked Creator job was found'), 'Generated export readiness must warn when Creator job metadata is missing.');
assert(panel.includes('Finalize as Custom'), 'Generated Loredecks must expose reviewed Generated-to-Custom finalization.');
assert(panel.includes('buildFinalizedCustomLoredeckRecordFromGenerated'), 'Generated-to-Custom finalization must use an explicit conversion builder.');
assert(panel.includes('generated_finalized'), 'Finalized Custom Loredecks must retain generated-source provenance.');
assert(panel.includes('Generated Loredeck is not export-ready'), 'Selected export must enforce Generated Loredeck readiness.');
assert(panel.includes('refreshLoredeckHealthAfterAcceptedPendingChanges'), 'Pending Review acceptance must rerun Deck Health after health-impact changes.');
assert(panel.includes('and refreshed Deck Health'), 'Pending Review health rerun must report refreshed Deck Health to the user.');
assert(panel.includes('getLoredeckBundleContentHash'), 'Loredeck bundle export/import must use a canonical content hash.');
assert(panel.includes('Hash mismatch'), 'Loredeck install preview must surface declared content-hash mismatches.');
assert(panel.includes('Embedded Lorecards'), 'Loredeck install preview must show embedded Lorecard counts.');
assert(panel.includes('Pending Dropped'), 'Loredeck install preview must show pending proposals dropped during import.');

assert(fixture.bundleType === 'saga_loredeck_json', 'Fixture must be a Saga Loredeck bundle.');
assert(fixture.pack?.packId === 'smoke-arlong-park', 'Fixture pack ID must match the harness deck.');
assert(fixture.manifest?.id === fixture.pack.packId, 'Fixture manifest ID must match the pack ID.');
assert(fixture.pack?.version === '1.0.1', 'Fixture should simulate a newer published version.');
assert(Array.isArray(fixture.entries) && fixture.entries.length >= 2, 'Fixture must include embedded Lorecards.');
for (const entry of fixture.entries) {
    assert(entry.schemaVersion === 3, `Fixture entry ${entry.id || '(missing id)'} must use schema v3.`);
    assert(entry.id && entry.title, 'Fixture entries need IDs and titles.');
    assert(entry.content?.fact && entry.content?.injection, `Fixture entry ${entry.id} needs high-value content fields.`);
    assert(entry.context && typeof entry.context === 'object', `Fixture entry ${entry.id} needs Context metadata.`);
    assert(entry.retrieval && typeof entry.retrieval === 'object', `Fixture entry ${entry.id} needs retrieval metadata.`);
}
assert(fixture.timelineRegistry?.anchors?.length, 'Fixture must include timeline anchors.');
assert(fixture.tagRegistry?.tags?.length, 'Fixture must include tag definitions.');

for (const token of [
    'Check Updates',
    'Loredeck Update Preview',
    'Update This Deck',
    'Install As New Copy',
    'Pending Review',
    'Loredeck Creator',
    'getActiveLoredeckCreatorJob',
    'getLoredeckCreatorProjectRegistry',
    'activateLoredeckCreatorJob',
    'updateLoredeckCreatorProject',
    'upsertLoredeckCreatorJob',
    'clearLoredeckCreatorJob',
    'inferLoredeckCreatorUiStage',
    'refreshLoredeckCreatorWorkbenchBody',
    'queueLoredeckCreatorWorkbenchRefresh',
    'startLoredeckCreatorGeneration',
    'createLoredeckCreatorRequestOptions',
    'appendLoredeckCreatorGenerationStatus',
    'cancelLoredeckCreatorGeneration',
    'ignoreStaleLoredeckCreatorGeneration',
    'recoverLoredeckCreatorInterruptedActiveGeneration',
    'recoverLoredeckCreatorCurrentActiveGenerationOnOpen',
    'isLoredeckCreatorActiveGenerationStillLive',
    'buildLoredeckCreatorInterruptedResult',
    "status: 'interrupted'",
    'Saved batches are preserved',
    'applyLoredeckCreatorGenerationButtonLock',
    'loredeckCreatorGenerationControllers',
    'loredeckCreatorLiveGenerationsByJobId',
    'attachLoredeckCreatorLiveGeneration',
    'activeGenerationByJobId: getLoredeckCreatorActiveGenerationByJobIdMap()',
    'getLoredeckCreatorPipelineModel',
    'createLoredeckCreatorPipelineHeader',
    'createLoredeckCreatorStageGuide',
    'createLoredeckCreatorCurrentTaskCard',
    'createLoredeckCreatorCurrentTaskActions',
    'createLoredeckCreatorArtifactDisclosure',
    'Draft Story Outline',
    'Approve Outline and Unlock Title Pass',
    'Finalize as Custom Loredeck',
    'localJob?.activeGeneration',
    'normalized.activeGeneration',
    'requestLoredeckCreatorBriefResponse',
    'repairLoredeckCreatorBriefResponse',
    'requestLoredeckCreatorOutlineResponse',
    'repairLoredeckCreatorOutlineResponse',
    'markLoredeckCreatorOutlineFailed',
    'createLoredeckCreatorProjectShelf',
    'getLoredeckCreatorProjectShelfModels',
    'createLoredeckCreatorProjectControls',
    'createLoredeckCreatorProjectBulkToolbar',
    'appendLoredeckCreatorProjectFolderFilterOptions',
    'appendLoredeckCreatorProjectMoveOptions',
    'moveLoredeckCreatorProjectsToFolder',
    'getFilteredLoredeckCreatorProjectModels',
    'matchesLoredeckCreatorProjectFolderFilter',
    'setLoredeckCreatorProjectSelected',
    'openLoredeckCreatorProject',
    'renameLoredeckCreatorProjectTitle',
    'deleteLoredeckCreatorProjectWithConfirm',
    'deleteSelectedLoredeckCreatorProjectsWithConfirm',
    'buildLoredeckCreatorProjectCardModels',
    'Search projects...',
    'Delete Selected',
    'Move to: Unfiled',
    'Resume unfinished Generated Loredecks',
    'Scope Brief',
    'Creator Story Outline',
    'handleLoredeckCreatorOutlineDraft',
    'approveLoredeckCreatorOutline',
    'Approve the Story Outline before drafting titles',
    'Generate Next Title Batch',
    'Generate Remaining',
    'handleLoredeckCreatorRemainingTitleBatches',
    'performLoredeckCreatorRemainingTitleBatches',
    'getLoredeckCreatorRemainingTitleBatches',
    'LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES',
    'createLoredeckCreatorTitleBatchPlanner',
    'getLoredeckCreatorNextTitleBatch',
    'creatorTitleBatchId',
    'runGenerationUnits',
    'runLoredeckCreatorSingleUnitGeneration',
    'buildLoredeckCreatorTitleGenerationUnitId',
    'commitLoredeckCreatorTitleDraftResult',
    'creator_title_batch',
    'result.commitResult?.titleCommit',
    'Plan Context and Tags',
    'createLoredeckCreatorPlanningBatchPlanner',
    'getLoredeckCreatorNextPlanningBatch',
    'creatorPlanningBatch',
    'getLoredeckCreatorEntryEligibleBatchIds',
    'Accept at least one planned Context and Tag set before drafting Lorecards',
    'creatorEntryBatch',
    'Open Loredeck Library',
    'Loredeck Library',
    'Import Deck',
    'Install Selected As New Copies',
    'Add to Stack >',
    'Clear Stack',
    'Deck Health Center',
    'Open Health Center',
    'Run Validation',
    'captureLoredeckHealthCenterScrollState',
    'restoreLoredeckHealthCenterScrollState',
    'Duplicate',
    'Delete',
    'Add Folder to Stack',
    'deleteLoredeckLibraryPackWithConfirm',
    'deleteLoredeckLibraryPacksWithConfirm',
    'moveLoredecksToLibraryFolder',
    'folderDropTarget',
    'createLoredeckLibraryHierarchyList',
    'createLoredeckLibraryInlineFolderRow',
    'createLoredeckLibraryFolderCoverStrip',
    'updateLoredeckLibraryFolderCoverStrip',
    'createLoredeckLibraryFolderDetailsPanel',
    'createLoredeckLibraryFolderLoredeckRow',
    'loredeckLibrarySelectedFolderDetailsId',
    'wandlight-grip-dot-rows',
    'promptCreateLoredeckLibraryFolder',
    'promptRenameLoredeckLibraryFolder',
    'deleteLoredeckLibraryFolderWithConfirm',
    'promptLoredeckLibraryFolderRemovalStrategy',
    'applyLoredeckLibraryFolderRemoval',
    'duplicateLoredeckLibraryPacksWithConfirm',
    'duplicateLoredeckLibraryFolderWithContents',
    'wireOverlayBackdropClose',
    'showSagaChoiceDialog',
    'saveLoredeckLibraryDeckPlacementAssignments',
    'getTargetFolderId',
    'appendLoredeckLibraryFolderMoveOptions',
    'appendLoredeckLibraryFolderParentOptions',
    'showSagaInputDialog',
    'getLoredeckStackFolderPreviewModel',
    'formatLoredeckStackSourceLabel',
    'createLoredeckStackFolderPreview',
    'addLoredeckFolderToStack',
    'createLoredeckStackFolderKey',
    'setLoredeckStackItemCollapsed',
    'createLoredeckLibraryDetailKicker',
    'createLoredeckLibraryEditableTitle',
    'renameLoredeckLibraryDeckTitle',
    'aria-current',
    'resolveLoredeckLibraryDragFeedback',
    'sortLoredeckLibraryPacks',
    'updateLoredeckLibraryDragFeedback',
    'ensureLoredeckLibraryDragCopyLabel',
    'getLoredeckLibraryPackSearchText',
    'getLoredeckLibraryHierarchySearchModel',
    'getLoredeckLibraryFolderSearchState',
    'Expand Details',
    'refreshLoredeckSurfaces',
    'LOREDECK_INDEX_URL',
    'createLoredeckLibraryHeaderMeta',
    'createLoredeckLibrarySquareIconAction',
    'renderSettingsTab',
    'ICONSET_SCHEMA_VERSION',
    'BUNDLED_ICONSET_PRESETS',
    'saga-hero',
    'Images/iconsets/saga-hero/hero-tab-loredecks-256.png',
    'saga-mystic',
    'Images/iconsets/saga-mystic/mystic-tab-loredecks-256.png',
    'saga-relay',
    'Images/iconsets/saga-relay/relay-tab-loredecks-256.png',
    'createThemeIconSetSelector',
    'applyThemeIconSet',
    'createLoredeckDeckVisual',
    'assets.cover',
    'Theme Pack',
    'Installed Theme Packs',
    'Royal Chronicle',
    'Grimoire Crimson',
    'Stellar Cartography',
    'Neon District',
    'Hero Campus',
    'Sea Map Odyssey',
    'Monster Index',
    'Holo Rail',
    'Midnight Evidence',
    'Shelf Icon Set',
    'Color Overrides',
]) {
    assert(panel.includes(token), `Runtime panel is missing expected smoke token: ${token}`);
}
assert(!panel.includes('main.appendChild(snippet)'), 'Creator generation status must not render raw model output snippets.');
assert(!panel.includes('Draft This Set'), 'Creator Title Pass must not expose per-row title-batch draft buttons.');
assert(!panel.includes('Redraft Set'), 'Creator Title Pass must not expose per-row title-batch redraft buttons.');

for (const token of [
    'emitLoreRequestProgress',
    'readOpenAICompatibleStream',
    'wantsStreamingResponse',
    'stream: shouldStream',
    'streamSupported: false',
]) {
    assert(llm.includes(token), `LLM client is missing expected streaming token: ${token}`);
}

for (const token of [
    'LOREDECK_CREATOR_PROJECT_STAGE_ORDER',
    'normalizeLoredeckCreatorProjectStage',
    'inferLoredeckCreatorProjectStage',
    'getLoredeckCreatorProjectStageDescriptor',
    'getLoredeckCreatorProjectCounts',
    'getLoredeckCreatorProjectNextAction',
    'isLoredeckCreatorProjectUnfinished',
    'buildLoredeckCreatorProjectCardModel',
    'buildLoredeckCreatorProjectCardModels',
    'Review Draft Lorecards',
    'Review Pending Lorecards',
]) {
    assert(creatorProjects.includes(token), `Creator project model is missing expected token: ${token}`);
}

for (const token of [
    'loredeckCreator',
    'loredeckCreatorProjects',
    'normalizeLoredeckCreatorRegistry',
    'normalizeLoredeckCreatorJob',
    'getLoredeckCreatorRegistry',
    'getLoredeckCreatorProjectRegistry',
    'getActiveLoredeckCreatorJob',
    'activateLoredeckCreatorJob',
    'updateLoredeckCreatorProject',
    'upsertLoredeckCreatorJob',
    'clearLoredeckCreatorJob',
    'outline_approved',
    'outlineApproved',
    'titleBatchDraftedIds',
    'planningBatchQueuedIds',
    'planningBatchAcceptedIds',
]) {
    assert(stateManager.includes(token), `State manager is missing expected Creator job token: ${token}`);
}

for (const token of [
    'wandlight-loredeck-install-shell',
    'wandlight-runtime-rail',
    'wandlight-runtime-drawer',
    'wandlight-loredeck-creator-project-shelf',
    'wandlight-loredeck-creator-project-card',
    'wandlight-loredeck-creator-project-controls',
    'wandlight-loredeck-creator-project-search',
    'wandlight-loredeck-creator-project-filter',
    'wandlight-loredeck-creator-project-folder-filter',
    'wandlight-loredeck-creator-project-move-select',
    'wandlight-loredeck-creator-project-bulk',
    'wandlight-loredeck-creator-project-card-selected',
    'wandlight-loredeck-creator-project-progress',
    'wandlight-loredeck-creator-project-delete',
    'wandlight-loredeck-creator-project-select-active',
    'wandlight-loredeck-creator-pipeline-header',
    'wandlight-loredeck-creator-stage-guide',
    'wandlight-loredeck-creator-stage-active',
    'wandlight-loredeck-creator-stage-needs-review',
    'wandlight-loredeck-creator-current-task',
    'wandlight-loredeck-creator-current-sidebar',
    'wandlight-loredeck-creator-output-grid',
    'wandlight-loredeck-creator-artifact',
    'wandlight-loredeck-library-details',
    'wandlight-loredeck-library-resize-handle',
    'wandlight-loredeck-library-resize-track-left',
    'wandlight-loredeck-library-resize-label-arrow',
    'wandlight-loredeck-metadata-shell',
    'wandlight-loredeck-library-shell',
    'wandlight-loredeck-library-columns',
    'wandlight-loredeck-library-hierarchy-list',
    'wandlight-loredeck-library-title-meta',
    'wandlight-loredeck-library-details-collapsed',
    'wandlight-loredeck-library-inline-folder-row',
    'wandlight-loredeck-library-folder-cover-strip',
    'wandlight-loredeck-library-folder-cover-tile',
    'wandlight-loredeck-library-folder-row-drop-enabled',
    'wandlight-loredeck-library-folder-move-select',
    'wandlight-loredeck-library-folder-parent-control',
    'wandlight-loredeck-library-folder-actions',
    'wandlight-confirm-input',
    'wandlight-confirm-choice-list',
    'wandlight-loredeck-library-stack-folder-preview',
    'wandlight-loredeck-library-stack-disclosure-button',
    'wandlight-loredeck-library-stack-folder-card-has-suppressed',
    'wandlight-loredeck-library-stack-card-suppressed',
    'wandlight-loredeck-library-stack-duplicate-summary',
    'wandlight-loredeck-library-stack-folder-preview-chip-kept',
    'wandlight-loredeck-library-drag-copy',
    'wandlight-loredeck-library-drag-copy-remove',
    'wandlight-loredeck-library-drag-drop-invalid',
    'wandlight-loredeck-library-root-drop-active',
    'wandlight-loredeck-library-stack-remove-active',
    'wandlight-loredeck-library-search-match',
    'wandlight-loredeck-library-search-context',
    'wandlight-loredeck-library-transfer-footer',
    'wandlight-loredeck-library-stack-card',
    'wandlight-loredeck-library-stack-grip',
    'wandlight-loredeck-library-inline-title',
    'wandlight-loredeck-library-title-edit-action',
    'wandlight-loredeck-library-title-input',
    'wandlight-loredeck-library-stack-ghost',
    'wandlight-loredeck-library-center-actions',
    'wandlight-loredeck-library-square-action',
    'wandlight-loredeck-library-icon-action',
    'wandlight-loredeck-library-stack-toggle-button',
    'wandlight-loredeck-library-detail-kicker',
    'wandlight-loredeck-library-deck-card.wandlight-loredeck-library-deck-selected',
    'wandlight-loredeck-library-inline-folder-row.wandlight-loredeck-library-folder-row-active',
    'wandlight-loredeck-library-stack-card.wandlight-loredeck-library-stack-card-selected',
    'wandlight-lore-workbench-shell .wandlight-runtime-button',
    'wandlight-loredeck-health-center-shell',
    'wandlight-loredeck-health-severity-card',
    'wandlight-theme-top-grid',
    'wandlight-theme-gallery',
    'wandlight-theme-iconset-selector',
    'wandlight-theme-iconset-strip',
    'wandlight-theme-icon-grid',
    'wandlight-loredeck-library-visual-cover',
    'wandlight-loredeck-library-visual-cover::after',
    'border-radius: inherit',
    'scrollbar-gutter: stable',
]) {
    assert(style.includes(token), `Stylesheet is missing expected smoke selector: ${token}`);
}

console.log('Visual smoke harness contract passed.');
