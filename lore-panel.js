/**
 * lore-panel.js - Saga
 * Floating roleplay control window.
 *
 * The extension-menu settings panel is reserved for API setup and
 * runtime launch controls. This window is the runtime surface used during roleplay.
 */

import { getPanelLoreState, getInjectableLoreEntries, getLoreRelevanceCounts, normalizeLoreMatrix, normalizeLoreEntry, LORE_LIFECYCLE_STATUSES } from './lore-matrix.js';
import { LORE_RELEVANCE_TIERS, LORE_RELEVANCE_LABELS, normalizeLoreRelevance, LORE_CATEGORY_VALUES, LORE_PURPOSE_LABELS } from './lore-relevance.js';
import {
    getDefaultState,
    DEFAULT_SETTINGS,
} from './constants.js';
import { applyExperienceModeSettings } from './runtime-experience-mode.js';
import { buildBasicReadinessModel } from './runtime-basic-readiness.js';
import {
    getState,
    getSettings,
    saveSettings,
    saveState,
    appendPendingLoreEntries,
    restoreLoreTimelineEntriesToPending,
    setLoreContext,
    getLoredeckContext,
    setLoredeckContext,
    resetLoredeckContext,
    getLoredeckLibraryRegistry,
    upsertLoredeckLibraryPack,
    removeLoredeckLibraryPack,
    importLoredeckLibraryRegistry,
    getLoredeckCreatorRegistry,
    getActiveLoredeckCreatorJob,
    activateLoredeckCreatorJob,
    updateLoredeckCreatorProject,
    upsertLoredeckCreatorJob,
    updateLoredeckCreatorGenerationRun,
    updateLoredeckCreatorGenerationUnit,
    clearLoredeckCreatorJob,
} from './state-manager.js';
import { buildContinuityPreview, buildLorePreview, getCompressionSourceSignature } from './memo-builder.js';
import { onExtractionTriggered } from './extractor.js';
import { runLoreContextDetection, runBulkLoreGeneration } from './lore-generator.js';
import {
    sendLoreRequest,
    validateLoreProviderConfiguration,
} from './lore-llm-client.js';
import { proposeCanonLoreForContext, previewCanonLoreForContext, addCanonLorePreviewEntriesToPending, getLoreTaxonomySync, loadCanonLoreDatabase, getCanonLoreDatabaseSync, clearCanonLoreDatabaseCache } from './canon-lore-db.js';
import { buildLoredeckHealthForData, fetchJson, LOREDECK_INDEX_URL, loadLoredeckSourceById, mergeLoredeckTimelineRegistries, normalizeLoredeckEntryForSchemaV3, repairLoredeckEntryForHealth } from './loredeck-loader.js';
import {
    createLoredeckZipPackage,
    parseLoredeckZipPackage,
} from './loredeck-package-service.js';
import {
    buildLoredeckAssistantSystemPrompt,
    buildLoredeckAssistantUserPrompt,
    parseLoredeckAssistantResponse,
    buildLoredeckCreatorBriefSystemPrompt,
    buildLoredeckCreatorBriefUserPrompt,
    parseLoredeckCreatorBriefResponse,
    buildLoredeckCreatorOutlineSystemPrompt,
    buildLoredeckCreatorOutlineUserPrompt,
    parseLoredeckCreatorOutlineResponse,
    buildLoredeckCreatorTitleSystemPrompt,
    buildLoredeckCreatorTitleUserPrompt,
    parseLoredeckCreatorTitleResponse,
    buildLoredeckCreatorPlanningSystemPrompt,
    buildLoredeckCreatorPlanningUserPrompt,
    buildLoredeckCreatorEntrySystemPrompt,
    buildLoredeckCreatorEntryUserPrompt,
} from './loredeck-assistant.js';
import { analyzeContextQuery, clearContextIndexCache, findContextAnchors, getContextIndexSync, loadContextIndex, normalizeContextSearchText, rankContextAnchors, contextTextIncludesTerm } from './context-index.js';
import { applyContextResolutionResults, buildContextResolutionAudit, buildResolverContextFromState, resolveAndApplyContextsFromContext, resolveContextsWithModel } from './context-resolver.js';
import { runAutoRelevance, applyAutoRelevanceSuggestions, clearAutoRelevanceSuggestions, rejectAutoRelevanceSuggestions } from './auto-relevance.js';
import {
    buildFolderTree,
    createFolderIdFromPath,
    getFolderPath,
    normalizeLoredeckLibraryIndex,
    normalizePackLibraryMetadata,
    resolveLoredeckStackItems,
} from './loredeck-library-index.js';
import {
    resolveLoredeckLibraryDragFeedback,
} from './loredeck-library-drag.js';
import {
    sortLoredeckLibraryPacks,
} from './loredeck-library-view.js';
import {
    runGenerationUnits,
} from './generation-job-runner.js';
import {
    applyLoredeckLibraryFolderRemovalPlan,
    createLoredeckLibraryFolderRecord,
    getLoredeckLibraryFolderRemovalPlan,
    getLoredeckLibraryFolderDeckIds,
    getLoredeckLibraryFolderSiblingRecords,
    isLoredeckLibraryFolderDescendant,
    moveLoredeckLibraryFolderRecord,
    moveLoredecksToLibraryFolderPlacement,
    renameLoredeckLibraryFolderRecord,
    reorderLoredeckLibraryPlacements,
} from './loredeck-library-service.js';
import {
    captureLoreTimelineState,
    recordLoreTimelineEvent,
    getRecoverableTimelineEntries,
} from './lore-timeline.js';
import {
    DEFAULT_HP_LOREDECK_ID,
    HP_LEGACY_LOREDECK_ID,
    getDefaultLoredeckContextType,
} from './loredeck-defaults.js';
import {
    addTooltip,
    chooseAction,
    confirmAction,
    createBadge,
    createButton,
    createEmptyMessage,
    createIconButton,
    createKeyValue,
    createSectionHeader,
    createStatusPill,
    createToggleCard,
    formatStructuredValue,
    hasDisplayableScope,
    humanizeScopeKey,
    isPlainObjectValue,
    promptTextAction,
    runBusyAction,
    showNoticePopup,
    toast,
    wireOverlayBackdropClose,
} from './runtime-ui-kit.js';
import {
    estimateTokens,
    truncateText,
} from './runtime-formatters.js';
import {
    TAB_ICON_PATHS,
    applyRuntimeTheme,
    getActiveThemeColors,
    getAssetSrc,
    getBrandLogoSrc,
    getTabIconSrc,
    getThemePackLibrary,
    getThemePreset,
    normalizeAssetRef,
} from './runtime-theme.js';
import {
    closeSagaTour,
    configureRuntimeTour,
    markTourTarget,
    startSagaTour,
} from './runtime-tour.js';
import {
    getRuntimeGuideContent,
    getRuntimeGuideSections,
    getRuntimeGuideSteps,
} from './runtime-guide-content.js';
import {
    AUTOMATION_MODES,
    TAB_ICONS,
    TAB_LABELS,
    TAB_TOOLTIPS,
    getAutomationLabel,
    getAutomationTooltip,
    getExperienceLabel,
    getExperienceTooltip,
    getTabLabelForExperience,
    getTabTooltipForExperience,
    getVisibleTabsForExperience,
    isBasicExperience,
    normalizeAutomationMode,
    normalizeExperienceMode,
    normalizeTab,
    normalizeTabForExperience,
} from './runtime-navigation.js';
import {
    applyRuntimeShellGeometry,
    clampRuntimeShellToViewport,
    clampNumber,
    configureRuntimeShell,
    getConstrainedDrawerHeight,
    getConstrainedDrawerWidth,
    getActiveNestedScrollElement,
    getActiveTabScrollElement,
    getRailWidth,
    installNestedScrollHandoff,
    normalizePanelLayoutState,
    normalizeRailMode,
    onRuntimeDrawerResizeStart,
    onRuntimeRailDragStart,
    resetRuntimePanelLayout,
    resolveDrawerDirection,
    toggleRuntimeDrawerForTab,
    toggleRuntimeRailMode,
    updateDrawerScrollMetrics,
} from './runtime-shell.js';
import {
    buildLoredeckHealthPackSummary,
    buildLoredeckHealthReport,
    collectLoredeckHealthIssueTags,
    configureLoredeckHealthPanel,
    formatRelativeHealthTime,
    getCachedLoredeckHealthRecord,
    getLoredeckHealthStatusDescriptor,
    groupLoredeckHealthIssues,
    normalizeLoredeckHealthSeverity,
    openLoredeckHealthCenter,
    suggestLoredeckMachineId,
} from './loredeck-health-panel.js';
import {
    buildLoredeckPackScopedHealth,
    clearLoredeckLibrarySelectedFolderDetails,
    configureLoredeckLibraryPanel,
    createLoredeckDeckVisual,
    createLoredeckLibraryEditableTitle,
    getBundledLoredeckLibraryRecords,
    getLoredeckLibraryFolderPacks,
    getLoredeckLibraryIndexForPacks,
    getLoredeckLibraryPackFolderId,
    getLoredeckLibraryPackMap,
    getLoredeckLibraryStackStats,
    getLoredeckPackSummaryCounts,
    getMutableLoredeckLibraryRegistry,
    isLoredeckLibraryOpen,
    normalizeLoredeckLibraryInlineTitle,
    openLoredeckLibraryDetails,
    openLoredeckLibraryWindow,
    openLoredeckMetadataEditor,
    refreshLoredeckLibrarySelectionSurfaces,
    refreshLoredeckSurfaces,
    renderLoredeckLibraryOverlay,
    saveLoredeckLibraryFolderRecords,
    scheduleLoredeckLibraryOverlayRefresh,
    setLoredeckLibraryBulkSelection,
    setLoredeckLibrarySelectedFolder,
} from './loredeck-library-panel.js';
import {
    configureLoredecksTabPanel,
    renderLoredecksTab,
} from './loredecks-tab-panel.js';
import {
    configureLoredeckWorkbenchPanel,
    openLoredeckWorkbench,
} from './loredeck-workbench-panel.js';
import {
    appendLoredeckCreatorGenerationStatus,
    compactLoredeckCreatorTitleDraftForRevision,
    configureLoredeckCreatorPanel,
    countLoredeckCreatorTitleQualityWarnings,
    createLoredeckCreatorArtifactDisclosure,
    createLoredeckCreatorBriefReview,
    createLoredeckCreatorCurrentTaskCard,
    createLoredeckCreatorEntryDraftCard,
    createLoredeckCreatorOutlineCard,
    createLoredeckCreatorPendingReviewCard,
    createLoredeckCreatorPipelineHeader,
    createLoredeckCreatorPipelineReadinessCard,
    createLoredeckCreatorPlanningCard,
    createLoredeckCreatorStageGuide,
    createLoredeckCreatorTitlePassCard,
    formatLoredeckCreatorLiveSnippet,
    getLoredeckCreatorGenerationWaitMessage,
    getLoredeckCreatorNextTitleBatch,
    getLoredeckCreatorOutlineRows,
    getLoredeckCreatorRemainingTitleBatches,
    getLoredeckCreatorTitleBatchIdentity,
    getLoredeckCreatorTitleBatchRows,
    getLoredeckCreatorTitleDraftedBatchIds,
    getLoredeckCreatorTitleDrafts,
    normalizeLoredeckCreatorTitleDrafts,
    normalizeLoredeckCreatorTitleId,
    normalizeLoredeckCreatorTitleIdList,
    openLoredeckCreatorWorkbench,
    queueLoredeckCreatorWorkbenchRefresh,
    refreshLoredeckCreatorWorkbenchBody,
    scrollLoredeckCreatorWorkbenchToAnchor,
} from './loredeck-creator-panel.js';
import {
    configureContextPanel,
    createContextAdvancedBriefSection,
    createContextAutomationAuditPanel,
    createContextCommandCenterCard,
    createContextResolutionAuditPanel,
    createContextResolutionProposalPanel,
    createLoredeckContextCard,
    getContextPackSummary,
    renderContextProposalReview,
} from './context-panel.js';
import {
    configureContextWorkbenchPanel,
    createContextWorkbenchPackSelector,
    createContextWorkbenchShell,
    getContextWorkbenchValidationIssues,
} from './context-workbench-panel.js';
import {
    configureContinuityPanel,
    createDeltaReviewCard,
} from './continuity-panel.js';
import {
    configureSettingsPanel,
    createBasicProviderQuickSetupCard,
    createProviderSettingsCard,
    getProviderStatusText,
} from './settings-panel.js';
import {
    configureLoreTimelinePanel,
    openLoreTimeline,
    refreshLoreTimeline,
} from './lore-timeline-panel.js';
import {
    configureLorecardsPanel,
    createAcceptedLoreBulkControls,
    createEntryCard,
    createNewLoreInput,
    createNewLoreSelect,
    createPendingLoreBulkControls,
    createPendingLoreReviewCard,
    appendEntrySourceAndContextBadges,
    getAcceptedSelectionSet,
    getFilteredLoreEntries,
    getLoreSourceBucket,
    openNewLoreDialog,
    refreshLoreWorkbench,
    refreshAcceptedLoreCategoryTabs,
    refreshAcceptedLoreFilterResults,
    refreshAcceptedLoreList,
    renderAcceptedLoreEntryList,
    renderLorecardsTab,
    scheduleAcceptedLoreListRender,
    scoreSearchEntry,
    toggleAcceptedLoreSelection,
} from './lorecards-panel.js';
import {
    createActiveThemePanel,
    createInstalledThemePackGallery,
    createThemeAdvancedPanel,
    createThemeColorOverridesPanel,
    createThemeIconSetPanel,
} from './theme-panel.js';
import {
    configureThemeActions,
    createThemePanelOptions,
} from './theme-actions.js';

const PANEL_ID = 'saga-lore-panel';
const LORE_TIMELINE_ID = 'saga-lore-timeline';
const CONTEXT_WORKBENCH_ID = 'saga-context-workbench';
const STORED_API_KEY_SETTING_PREFIXES = Object.freeze(['loreOpenAI', 'continuityOpenAI']);
const STORED_API_KEY_SETTING_SUFFIXES = Object.freeze(['Encrypted', 'Salt', 'Iv', 'KeyEncrypted', 'KeySalt', 'KeyIv', 'KeySet']);
const CONTEXT_DETECTION_SETTING_KEYS = Object.freeze([
    'contextDetectionMode',
    'contextDetectionAutoInterval',
    'contextDetectionAutoMinTurns',
    'contextDetectionAutoCharacterThreshold',
    'contextSourceMessageCount',
    'contextModelFallbackMinCharacters',
    'contextReasonerFallbackEnabled',
    'contextLocalApplyMinConfidence',
    'contextReasonerProposalMinConfidence',
]);
const STORY_LORE_SCAN_SCOPE_SETTING_KEYS = Object.freeze([
    'loreBulkScanMode',
    'loreBulkRangeStart',
    'loreBulkRangeEnd',
    'loreSourceMessageCount',
]);
const STORY_LORE_SCAN_PERFORMANCE_SETTING_KEYS = Object.freeze([
    'loreBulkChunkSize',
    'loreBulkOverlap',
    'loreBulkConcurrency',
    'loreBulkRetryAttempts',
    'loreBulkFullCheckpointEveryChunks',
    'loreBulkConsolidationChunkWindow',
]);
const STORY_LORE_SCAN_QUALITY_SETTING_KEYS = Object.freeze([
    'loreGenerationBreadthMode',
    'loreBulkFactsPerChunk',
    'loreBootstrapTargetEntries',
    'loreIncrementalTargetEntries',
    'loreTagCount',
    'loreReplacementGuard',
    'loreDuplicateGuard',
    'loreSimilarityRouting',
    'loreStrictQualityGate',
    'loreBulkRescanMode',
]);
const STORY_LORE_AUTOMATION_SETTING_KEYS = Object.freeze([
    'loreGenerationMode',
    'loreGenerationAutoInterval',
    'loreGenerationAutoMinTurns',
    'loreGenerationAutoWordThreshold',
]);
const CONTINUITY_SCAN_SCOPE_SETTING_KEYS = Object.freeze([
    'continuityScanMode',
    'continuityScanRangeStart',
    'continuityScanRangeEnd',
    'continuitySourceMessageCount',
]);
const CONTINUITY_SCAN_PERFORMANCE_SETTING_KEYS = Object.freeze([
    'continuityScanStrategy',
    'continuityScanFastThreshold',
    'continuityScanHybridThreshold',
    'continuityFastMaxTokens',
    'continuityHybridMaxTokens',
    'continuityScanChunkSize',
    'continuityScanOverlap',
    'continuityScanConcurrency',
    'continuityScanReducerConcurrency',
    'continuityScanRetryAttempts',
    'continuityScanObservationsPerChunk',
    'continuityObservationMaxTokens',
    'continuityReducerMaxTokens',
    'continuityScanFullCheckpointEveryChunks',
    'continuityScanRescanMode',
]);
const CONTINUITY_EMOTION_FRESHNESS_SETTING_KEYS = Object.freeze([
    'continuityEmotionRecencyEnabled',
    'continuityEmotionCurrentMessageWindow',
    'continuityEmotionRecentMessageWindow',
    'continuityEmotionStaleBehavior',
]);
const PROMPT_PLACEMENT_SETTING_KEYS = Object.freeze([
    'injectionTransport',
    'continuityInjectionPosition',
    'continuityInjectionDepth',
    'continuityInjectionRole',
    'loreHighInjectionPosition',
    'loreHighInjectionDepth',
    'loreHighInjectionRole',
    'loreNormalInjectionPosition',
    'loreNormalInjectionDepth',
    'loreNormalInjectionRole',
    'loreLowInjectionPosition',
    'loreLowInjectionDepth',
    'loreLowInjectionRole',
]);
const CONTEXT_TYPE_OPTIONS = Object.freeze([
    ['calendar', 'Calendar'],
    ['anchor', 'Anchor'],
    ['anchor_window', 'Anchor Window'],
    ['arc', 'Arc'],
    ['phase', 'Phase'],
    ['season_episode', 'Season / Episode'],
    ['stardate', 'Stardate'],
    ['relative', 'Relative'],
    ['hybrid', 'Hybrid'],
    ['custom', 'Custom'],
]);

const CONTEXT_SOURCE_OPTIONS = Object.freeze([
    ['manual', 'Manual'],
    ['header', 'Header'],
    ['local_alias', 'Local Alias'],
    ['model', 'Model'],
    ['imported', 'Imported'],
    ['unknown', 'Unknown'],
]);

const loredeckManifestPreviewCache = new Map();
const loredeckEntryPreviewCache = new Map();
const loredeckTagRegistryCache = new Map();
const loredeckTimelineRegistryCache = new Map();
const loredeckAssistantDraftCache = new Map();
const loredeckHealthRepairSelectionCache = new Map();
const loredeckCreatorBriefCache = new Map();
const LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES = 5;
const LOREDECK_CREATOR_ENTRY_BATCH_SIZE = 3;
const LOREDECK_CREATOR_ENTRY_BATCH_MAX = 6;
const LOREDECK_CREATOR_ENTRY_AUTORUN_BATCHES = 5;
const LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS = Object.freeze({
    titleBatchLimit: 8,
    planningProposalLimit: 12,
    entryBatchSize: LOREDECK_CREATOR_ENTRY_BATCH_SIZE,
    titleRunRemainingLimit: LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES,
    entryRunRemainingLimit: LOREDECK_CREATOR_ENTRY_AUTORUN_BATCHES,
    retryAttempts: 1,
    retrySmaller: true,
    showStreamingProgress: true,
});
const LOREDECK_CREATOR_GENERATION_SETTING_LIMITS = Object.freeze({
    titleBatchLimit: [4, 12],
    planningProposalLimit: [6, 24],
    entryBatchSize: [1, LOREDECK_CREATOR_ENTRY_BATCH_MAX],
    titleRunRemainingLimit: [1, 10],
    entryRunRemainingLimit: [1, 10],
    retryAttempts: [0, 4],
});
let loredeckEntryOverrideQuery = '';
let loredeckTagManagerQuery = '';
let loredeckTimelineRegistryQuery = '';
let loredeckAssistantInstruction = '';
let loredeckAssistantMode = 'revise_entries';
let loredeckAssistantTargetScope = 'current_filter';
let loredeckAssistantRevisionInstruction = '';
let loredeckCreatorFandom = '';
let loredeckCreatorScope = '';
let loredeckCreatorGranularity = 'focused';
let loredeckCreatorNotes = '';
let loredeckCreatorRevisionInstruction = '';
let loredeckCreatorOutlineRevisionInstruction = '';
let loredeckCreatorTitleRevisionInstruction = '';
let loredeckCreatorGenerationTicker = null;
const loredeckCreatorGenerationControllers = new Map();
const loredeckCreatorLiveGenerationsByJobId = new Map();
const loredeckCreatorLiveGenerationJobs = new Map();

const CATEGORY_LABELS = {
    all: 'All',
    pinned: 'Pinned',
    suppressed: 'Muted',
    pending: 'Pending',
    high: 'High Relevance',
    normal: 'Normal Relevance',
    low: 'Low Relevance',
    canon: 'Canon',
    au: 'AU',
    secret: 'Secret',
    rumor: 'Rumor',
    lie: 'Lie',
    relationship: 'Relationship',
    location: 'Location',
    rule: 'Rule',
    timeline: 'Timeline',
    character: 'Character',
    event: 'Event',
    item: 'Item',
    knowledge: 'Knowledge',
    place: 'Place',
    faction: 'Faction',
    spell: 'Spell',
    artifact: 'Artifact',
};

configureLoredeckHealthPanel({
    getState,
    getCanonLoreDatabaseSync,
    getLoredeckLibrary,
    getLoredeckStack,
    getLoredeckLibraryIndexForPacks,
    resolveLoredeckStackItems,
    buildLoredeckPackScopedHealth,
    getLoredeckPackSummaryCounts,
    getLoredeckTypeLabel,
    getLoredeckEntryPreviewCacheRecord: packId => loredeckEntryPreviewCache.get(String(packId || '').trim()) || null,
    getLoredeckManifestPreviewCacheRecord: packId => loredeckManifestPreviewCache.get(String(packId || '').trim()) || null,
    validateLoredeckForEditor,
    refreshLoredeckSurfaces,
    clearCanonLoreDatabaseCache,
    clearContextIndexCache,
    loadCanonLoreDatabase,
    refreshPanelBody,
    refreshHeader,
    sanitizeFileStem,
    downloadJson,
    openDuplicateLoredeckDialog,
    handleLoredeckAssistantHealthRepairDraft,
    normalizeLoredeckHealthGroupIssuesForRepair,
    canValidateLoredeckInEditor,
    isLoredeckMalformedTagIssueGroup,
    queueLoredeckMalformedTagRepairFromHealthGroup,
    repairLoredeckSafeHealthIssues,
    normalizeLoredeckHealthIssueStates,
    normalizeLoredeckPendingIdList,
    normalizeLoredeckPendingTimelineIdList,
    getFreshLoredeckLibraryPack,
    persistLoredeckLibraryRecordMutation,
});

configureLoredeckLibraryPanel({
    getState,
    saveState,
    getSettings,
    saveSettings,
    getDefaultState,
    getCanonLoreDatabaseSync,
    clearCanonLoreDatabaseCache,
    clearCanonPreviewUiState: resetCanonPreviewUiState,
    loadCanonLoreDatabase,
    clearContextIndexCache,
    loadContextIndex,
    refreshPanelBody,
    refreshHeader,
    clampNumber,
    formatCategoryCounts,
    getLoredeckStack,
    getLoredeckLibrary,
    getLoredeckLibraryRegistry,
    normalizeLoredeckLibraryPack,
    getLoredeckDefinition,
    getLoredeckTypeLabel,
    getLoredeckSourceSummary,
    getLoredeckTagRegistryCount,
    getLoredeckTimelineRegistryCount,
    isVirtualLoredeckPack,
    isGeneratedLoredeckPack,
    isBundledLoredeckLibraryPack,
    getFreshLoredeckLibraryPack,
    persistLoredeckLibraryRecordMutation,
    validateLoredeckForEditor,
    canValidateLoredeckInEditor,
    repairLoredeckSafeHealthIssues,
    loadLoredeckManifestPreview,
    createLoredeckManifestPreview,
    createLoredeckEntryOverrideCard,
    createGeneratedLoredeckExportReadinessCard,
    createLoredeckEditorField,
    saveLoredeckMetadataFromInputs,
    syncLoredeckMetadataFromManifest,
    exportValidatedLoredeckDraft,
    refreshGeneratedLoredeckDerivedMetadata,
    finalizeGeneratedLoredeckAsCustom,
    installLoredeckBundleFromFile,
    exportSelectedLoredeckBundles,
    duplicateLoredeckLibraryPacksWithConfirm,
    duplicateLoredeckLibraryFolderWithContents,
    deleteLoredeckLibraryPacksWithConfirm,
    openDuplicateLoredeckDialog,
    openLoredeckWorkbench,
    openLoredeckCreatorWorkbench,
    selectLoredeckForDetails,
    commitLoredeckStackMutation,
    addLoredeckToStack,
    addLoredeckFolderToStack,
    removeLoredecksFromStack,
    removeLoredeckStackItem,
    moveLoredeckStackItem,
    reorderLoredeckStackItem,
    setLoredeckEnabled,
    setLoredeckStackItemEnabled,
    setLoredeckStackItemCollapsed,
    getLoredeckStackItemType,
    getLoredeckStackItemKey,
    createLoredeckStackDeckKey,
    createLoredeckStackFolderKey,
    renderContextWorkbench,
    buildLoredeckHealthPackSummary,
});

configureLoredeckWorkbenchPanel({
    getState,
    getLoredeckLibrary,
    getLoredeckLibraryRegistry,
    getLoredeckDefinition,
    getFreshLoredeckLibraryPack,
    getLoredeckTypeLabel,
    openDuplicateLoredeckDialog,
    openLoredeckHealthCenter,
    persistLoredeckLibraryRecordMutation,
});

configureLoredeckCreatorPanel({
    getState,
    getLoredeckCreatorBriefCache,
    getLoredeckCreatorPipelineModel,
    createLoredeckCreatorCard,
    recoverLoredeckCreatorCurrentActiveGenerationOnOpen,
    cancelLoredeckCreatorGeneration,
    createLoredeckCreatorCurrentTaskActions,
    getLoredeckCreatorLatestRecoverableUnit,
    formatLoredeckCreatorRecoveryStageLabel,
    formatRelativeHealthTime,
    createLoredeckCreatorBriefRevisionForm,
    createLoredeckCreatorOutlineActionForm,
    getLoredeckCreatorSelectedTitleIds,
    getLoredeckCreatorApprovedTitleIds,
    getLoredeckCreatorGenerationSettings,
    applyLoredeckCreatorGenerationButtonLock,
    handleLoredeckCreatorTitleDraft,
    handleLoredeckCreatorRemainingTitleBatches,
    approveLoredeckCreatorTitleSelection,
    unapproveLoredeckCreatorTitleSelection,
    dropLoredeckCreatorTitleSelection,
    setLoredeckCreatorTitleSelectionBulk,
    setLoredeckCreatorTitleSelection,
    getLoredeckCreatorSelectedTitleDrafts,
    getLoredeckCreatorTitleRevisionInstruction: () => loredeckCreatorTitleRevisionInstruction,
    setLoredeckCreatorTitleRevisionInstruction: value => {
        loredeckCreatorTitleRevisionInstruction = String(value || '').trim();
        return loredeckCreatorTitleRevisionInstruction;
    },
    appendLoredeckPendingQualityPills,
    createLoredeckPendingQualityList,
    openLoredeckCreatorTitleJsonEditor,
    getLoredeckCreatorPlanningBatchRows,
    getLoredeckCreatorPlanningQueuedBatchIds,
    getLoredeckCreatorNextPlanningBatch,
    countLoredeckCreatorPlanningPendingChanges,
    getLoredeckDefinition,
    handleLoredeckCreatorPlanningDraft,
    openLoredeckLibraryDetails,
    getLoredeckStack,
    addLoredeckToStack,
    getLoredeckCreatorAcceptedPlanningStatus,
    getLoredeckCreatorPlanningAcceptedBatchIds,
    getLoredeckCreatorEntryDraftProgress,
    getLoredeckCreatorEntryTargetTitles,
    getLoredeckCreatorDraftChanges: packId => getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(packId) || {}),
    getLoredeckCreatorPendingEntryCount: pack => getLoredeckPendingChanges(pack).filter(change => (change.affectedEntryIds || []).length).length,
    getLoredeckCreatorAcceptedEntryCount: pack => Object.keys(pack?.entryOverrides || {}).length,
    getFreshLoredeckLibraryPack,
    handleLoredeckCreatorEntryDraft,
    confirmAction,
    createLoredeckPendingReviewCard,
    getLoredeckCreatorPipelineReadinessView: (pack, cached = null) => {
        if (!isGeneratedLoredeckPack(pack)) return null;
        const linkedJob = cached || getLoredeckCreatorJobForPack(pack);
        const cachedHealth = loredeckManifestPreviewCache.get(pack.packId)?.health || null;
        const readiness = getGeneratedLoredeckExportReadiness(pack, cachedHealth, linkedJob);
        const pipeline = readiness.pipeline || getLoredeckCreatorPipelineReadiness(pack, linkedJob);
        return { readiness, pipeline };
    },
    createLoredeckCreatorDraftReviewSection: pack => {
        if (!pack?.packId) return null;
        const draftCache = loredeckAssistantDraftCache.get(pack.packId);
        const rows = getLoredeckEditableEntryRows(pack, []);
        return createLoredeckAssistantDraftBatchCard(pack, draftCache, rows, rows);
    },
    getLoredeckCreatorDraftInputs: () => ({
        fandom: loredeckCreatorFandom,
        scope: loredeckCreatorScope,
        granularity: loredeckCreatorGranularity,
        notes: loredeckCreatorNotes,
    }),
    formatLoredeckCreatorGranularity,
});

configureContextPanel({
    getContextWorkbenchStack,
    getLoredeckContext,
    getLoredeckDisplayName,
    getContextTypeLabel,
    formatContextSource,
    formatLoredeckContextUpdatedAt,
    formatContextSummary,
    getContextAutomationModeLabel,
    getContextBriefStatusLabel,
    getContextBriefStatusTone,
    getContextResolutionProposals,
    openContextWorkbenchForPack,
    toggleLoredeckContextManualLock,
    seedLoredeckContextFromRuntimeContext,
    applyContextResolutionProposalSet,
    dismissContextResolutionProposalSet,
    markTourTarget,
    handleDetectStoryContext,
    handleResolveContextsFromContext,
    handleModelResolveContexts,
    appendContextGenerationStatus: (card, state) => appendGenerationStatus(card, state, 'context'),
    createContextBriefStatusCard,
    createCollapsibleSection,
    createContextEditorCard,
    getState,
    getSettings,
    saveSettings,
    refreshContextPanelBody: () => refreshPanelBody({ preserveScroll: true }),
    resetContextDetectionSettings: () => resetSettingKeysToDefaults(CONTEXT_DETECTION_SETTING_KEYS, 'Context detection settings'),
    shouldShowContextAutomationPanel: () => !isBasicExperience(getSettings()),
    isBasicExperience: () => isBasicExperience(getSettings()),
    resetLoredeckContextFromPanel: async packId => {
        const ok = await confirmAction('Reset Context', `Clear Context for ${getLoredeckDisplayName(packId)}?`);
        if (!ok) return;
        resetLoredeckContext(packId);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
        toast('Context reset.', 'info');
    },
});

configureContextWorkbenchPanel({
    getContextWorkbenchTab: () => contextWorkbenchTab,
    setContextWorkbenchTab: tabId => {
        contextWorkbenchTab = ['context', 'timeline', 'aliases', 'validation'].includes(tabId) ? tabId : 'context';
    },
    getContextWorkbenchPackId: () => contextWorkbenchPackId,
    setContextWorkbenchPackId: packId => {
        contextWorkbenchPackId = String(packId || '').trim();
    },
    clearContextWorkbenchSelectedKey: () => {
        contextWorkbenchSelectedKey = '';
    },
    setContextWorkbenchSelectedKey: itemKey => {
        contextWorkbenchSelectedKey = String(itemKey || '');
    },
    renderContextWorkbench,
    closeContextWorkbench,
    refreshContextHeader: refreshHeader,
    clearContextIndexCache,
    loadContextIndex,
    getRuntimeState: getState,
    getContextWorkbenchStack,
    getContextWorkbenchPack,
    getContextWorkbenchTimelineItems,
    filterContextWorkbenchTimelineItems,
    getContextTimelineItemKey,
    getContextTimelineItemContextText,
    getContextTimelineItemCoordinateText,
    getLoredeckContext,
    getLoredeckDisplayName,
    getContextTypeLabel,
    formatContextSummary,
    formatContextSource,
    getContextWorkbenchQuery: () => contextWorkbenchQuery,
    setContextWorkbenchQuery: query => {
        contextWorkbenchQuery = String(query || '');
    },
    getContextWorkbenchSelectedKey: () => contextWorkbenchSelectedKey,
    getContextWorkbenchWaypointQuery: () => contextWorkbenchWaypointQuery,
    setContextWorkbenchWaypointQuery: query => {
        contextWorkbenchWaypointQuery = String(query || '').trim();
    },
    getContextWorkbenchTypeFilter: () => contextWorkbenchTypeFilter,
    setContextWorkbenchTypeFilter: typeFilter => {
        contextWorkbenchTypeFilter = ['all', 'anchor', 'window'].includes(typeFilter) ? typeFilter : 'all';
    },
    getContextWorkbenchWaypointFilter: () => contextWorkbenchWaypointFilter,
    setContextWorkbenchWaypointFilter: filter => {
        contextWorkbenchWaypointFilter = String(filter || 'major');
    },
    getContextWorkbenchResolverQuery: () => contextWorkbenchResolverQuery,
    setContextWorkbenchResolverQuery: query => {
        contextWorkbenchResolverQuery = String(query || '').trim();
    },
    getContextWorkbenchContextQuery: () => contextWorkbenchContextQuery,
    setContextWorkbenchContextQuery: query => {
        contextWorkbenchContextQuery = String(query || '').trim();
    },
    resolveContextsFromContext: handleResolveContextsFromContext,
    modelResolveContexts: handleModelResolveContexts,
    setLoredeckContextManualLock: (packId, manualLock) => {
        commitLoredeckContextPatch(packId, { manualLock: manualLock === true }, { manual: false });
    },
    resetLoredeckContextFromWorkbench: async packId => {
        const ok = await confirmAction('Reset Context', `Clear Context for ${getLoredeckDisplayName(packId)}?`);
        if (!ok) return;
        resetLoredeckContext(packId);
        refreshLoredeckSurfaces();
        toast('Context reset.', 'info');
    },
    seedLoredeckContextFromRuntimeContext,
    appendContextManualFields,
    normalizeLoredeckTimelineId,
    normalizeLoredeckTimelineNumber,
    applyContextTimelineItem,
    applyContextAnchor,
    applyContextEntryCandidate,
    applyContextAnchorBoundary,
    commitLoredeckContextPatch,
    validateLoredeckForEditor,
    loadLoredeckEntriesForEditor,
    canValidateLoredeckInEditor,
    getLoredeckEntryPreview: packId => loredeckEntryPreviewCache.get(String(packId || '').trim()) || null,
    getContextWorkbenchEntryRows,
    buildContextEntryDerivedAnchor,
    getContextResolverMissReasons,
    getContextEntryResolverMatches,
    queueContextEntryCandidateTimelineAnchor,
    openDuplicateLoredeckDialog,
    openLoredeckTimelineAnchorDialog,
    openLoredeckTimelineWindowDialog,
    setLoredeckTimelineItemDisabled,
    removeLoredeckTimelineDefinition,
    openLoredeckEditorForQuery: (packId, query, message) => {
        loredeckEntryOverrideQuery = String(query || '');
        selectLoredeckForDetails(packId);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(message || 'Loredeck editor filtered.', 'info');
    },
    exportContextWorkbenchTimelineRegistry: pack => {
        downloadJson(buildMergedLoredeckTimelineRegistryForExport(pack), `${sanitizeFileStem(pack?.packId || 'saga-loredeck')}.timeline.json`);
        toast('Timeline registry exported.', 'info');
    },
});

configureSettingsPanel({
    refreshSettingsPanel: options => {
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true, ...(options || {}) });
    },
    refreshRuntimeHeader: refreshHeader,
    openAdvancedSettings: openAdvancedSettingsTab,
    downloadJson,
});

configureLoreTimelinePanel({
    getState,
    refreshPanelBody,
    refreshHeader,
    getRecoverableTimelineEntries,
    restoreLoreTimelineEntriesToPending,
    toast,
    isBasicExperience,
    markTourTarget,
    createCompactPresetStat,
    openNewLoreDialog,
});

configureContinuityPanel({
    refreshPanelBody,
    refreshHeader,
});

configureRuntimeTour({
    getGuideSteps: mode => getRuntimeGuideSteps(normalizeExperienceMode(mode)),
    normalizeExperienceMode,
    setSectionCollapsed,
    normalizePanelLayoutState,
    normalizeTabForExperience,
    showRuntimePanel: showLorePanel,
    getPanelRoot: () => panelRoot,
    panelId: PANEL_ID,
});

configureRuntimeShell({
    getPanelRoot: () => panelRoot,
    getState,
    getSettings,
    saveState,
    saveSettings,
    showRuntimePanel: showLorePanel,
    notify: toast,
    updateAcceptedLoreScrollRegionHeight,
});

configureLorecardsPanel({
    getSettings,
    saveSettings,
    getState,
    saveState,
    isBasicExperience,
    refreshPanelBody,
    createCollapsibleSection,
    markTourTarget,
    createLoreGenerationCard,
    appendSettingsResetButton,
    runAutoRelevance,
    applyAutoRelevanceSuggestions,
    rejectAutoRelevanceSuggestions,
    clearAutoRelevanceSuggestions,
    getSelectedLoreInjectionCount,
    getInjectionCharacterStats,
    appendPendingLoreEntries,
    recordLoreTimelineEvent,
    captureLoreTimelineState,
    refreshLoreWorkbench,
    refreshLoreTimeline,
    refreshHeader,
    toast,
    getLoreDisplayLabel,
    getLoredeckDisplayName,
    getLoreRegistryMeta,
    applyLoreRegistryStyle,
    setPanelState,
    getPanelRoot: () => panelRoot,
    scheduleAcceptedLoreLayoutUpdate,
    getSearchRenderDebounceMs: () => SEARCH_RENDER_DEBOUNCE_MS,
    scheduleStateSave,
    flushScheduledStateSave,
    getLoreRegistryValues,
    getLorePriorityValues: () => LORE_PRIORITY_VALUES,
    getAcceptedLoreInitialVisibleLimit: () => ACCEPTED_LORE_INITIAL_VISIBLE_LIMIT,
    getAcceptedLorePageIncrement: () => ACCEPTED_LORE_PAGE_INCREMENT,
    refreshAcceptedLoreBulkToolbar,
    setExperienceMode,
});

configureThemeActions({
    getPanelRoot: () => panelRoot,
    refreshPanelBody,
    refreshHeader,
    refreshRuntimeRailIcons,
    downloadJson,
    getThemeShelfIconItems,
});

configureLoredecksTabPanel({
    getLoredeckStack,
    getLoredeckLibrary,
    refreshLorePanel,
    refreshPanelBody,
    refreshHeader,
    markTourTarget,
    createCollapsibleSection,
    installLoredeckBundleFromFile,
    openLoredeckCreatorWorkbench,
    getLoredeckDefinition,
    isGeneratedLoredeckPack,
    getGeneratedLoredeckExportReadiness,
    getLoredeckCreatorActiveGenerationByJobIdMap,
    getLoredeckCreatorBriefCache,
    getActiveLoredeckCreatorGeneration,
    refreshLoredeckCreatorWorkbenchBody,
    recoverLoredeckCreatorInterruptedActiveGeneration,
    attachLoredeckCreatorLiveGeneration,
    selectLoredeckForDetails,
    setLoredeckCreatorBriefCacheEntry: (key, value) => loredeckCreatorBriefCache.set(key, value),
    deleteLoredeckCreatorBriefCacheEntry: key => loredeckCreatorBriefCache.delete(key),
    setLoredeckCreatorDraftInputs: values => {
        loredeckCreatorFandom = values?.fandom || '';
        loredeckCreatorScope = values?.scope || '';
        loredeckCreatorGranularity = values?.granularity || 'focused';
        loredeckCreatorNotes = values?.notes || '';
    },
    clearLoredeckCreatorDraftInputs: () => {
        loredeckCreatorFandom = '';
        loredeckCreatorScope = '';
        loredeckCreatorGranularity = 'focused';
        loredeckCreatorNotes = '';
    },
});



function getSelectedLoreInjectionCount(state, settings = getSettings()) {
    void settings;
    return getInjectableLoreEntries(state, 0).length;
}

function getInjectionCharacterStats(state, settings = getSettings()) {
    const continuityEnabled = settings.injectContinuity !== false && settings.injectMemo !== false;
    const loreEnabled = settings.injectLore !== false;
    const continuityText = continuityEnabled ? buildContinuityPreview(state, settings.continuityInjectionMode || 'direct') : '';
    const loreText = loreEnabled ? buildLorePreview(state, settings.loreInjectionMode || 'direct') : '';
    return {
        continuityChars: continuityText.length,
        loreChars: loreText.length,
        totalChars: continuityText.length + loreText.length,
        totalTokens: estimateTokens(`${continuityText}
${loreText}`),
    };
}

const LORE_PRIORITY_VALUES = [10, 25, 50, 75, 90, 100];

let activeLoreGenerationController = null;

const ACCEPTED_LORE_INITIAL_VISIBLE_LIMIT = 40;
const ACCEPTED_LORE_PAGE_INCREMENT = 40;
const SEARCH_RENDER_DEBOUNCE_MS = 160;
const MINOR_STATE_SAVE_DEBOUNCE_MS = 350;
let deferredStateSaveTimer = null;
let deferredStateSaveRef = null;
let loreGenerationUiRunning = false;
let contextWorkbenchOpen = false;
let contextWorkbenchTab = 'context';
let contextWorkbenchPackId = '';
let contextWorkbenchSelectedKey = '';
let contextWorkbenchQuery = '';
let contextWorkbenchContextQuery = '';
let contextWorkbenchResolverQuery = '';
let contextWorkbenchWaypointQuery = '';
let contextWorkbenchWaypointFilter = 'major';
let contextWorkbenchTypeFilter = 'all';
let canonPreviewUiState = {
    contextKey: '',
    preview: null,
    selectedPackId: '',
    selectedEntryIds: [],
    detailLevel: 'standard',
};

function resetCanonPreviewUiState(options = {}) {
    canonPreviewUiState = {
        contextKey: '',
        preview: null,
        selectedPackId: '',
        selectedEntryIds: [],
        detailLevel: options.preserveDetailLevel === false ? 'standard' : getCanonPreviewDetailLevel(),
    };
}

function getLoreRegistry(registryName) {
    const taxonomy = getLoreTaxonomySync();
    return taxonomy?.[registryName] || {};
}

function getLoreRegistryValues(registryName, fallback = []) {
    if (registryName === 'canonStatuses') return ['canon', 'au'];
    if (registryName === 'categories') return LORE_CATEGORY_VALUES;
    const registry = getLoreRegistry(registryName);
    const values = Object.keys(registry);
    return values.length ? values : fallback;
}

function getLoreFieldRegistry(field) {
    if (field === 'category') return 'categories';
    if (field === 'canonStatus') return 'canonStatuses';
    if (field === 'truthStatus') return 'truthStatuses';
    if (field === 'revealPolicy') return 'revealPolicies';
    return '';
}

function getLoreRegistryMeta(registryName, value) {
    const registry = getLoreRegistry(registryName);
    return registry?.[value] || null;
}


function isSectionCollapsed(sectionId, defaultOpen = true) {
    const settings = getSettings();
    const collapsed = settings.collapsedSections || {};
    if (Object.prototype.hasOwnProperty.call(collapsed, sectionId)) {
        return !!collapsed[sectionId];
    }
    return !defaultOpen;
}

function setSectionCollapsed(sectionId, collapsed) {
    const next = getSettings();
    next.collapsedSections = {
        ...(DEFAULT_SETTINGS.collapsedSections || {}),
        ...(next.collapsedSections || {}),
        [sectionId]: !!collapsed,
    };
    saveSettings(next);
}

function createCollapsibleSection(sectionId, titleText, subtitleText, defaultOpen, content, options = {}) {
    const details = document.createElement('details');
    details.className = `saga-runtime-card saga-collapsible-card ${options.className || ''}`.trim();
    details.open = !isSectionCollapsed(sectionId, defaultOpen);

    const summary = document.createElement('summary');
    summary.className = 'saga-collapsible-summary';
    const title = document.createElement('span');
    title.className = 'saga-collapsible-title';
    title.textContent = titleText;
    addTooltip(title, options.tooltip || subtitleText || titleText);
    summary.appendChild(title);

    if (subtitleText) {
        const subtitle = document.createElement('span');
        subtitle.className = 'saga-collapsible-subtitle';
        subtitle.textContent = subtitleText;
        summary.appendChild(subtitle);
    }
    details.appendChild(summary);

    const wrap = document.createElement('div');
    wrap.className = 'saga-collapsible-content';
    const built = typeof content === 'function' ? content() : content;
    if (Array.isArray(built)) {
        for (const item of built) if (item) wrap.appendChild(item);
    } else if (built) {
        wrap.appendChild(built);
    }
    details.appendChild(wrap);

    details.addEventListener('toggle', () => {
        setSectionCollapsed(sectionId, !details.open);
        if (String(sectionId || '').startsWith('lore.')) scheduleAcceptedLoreLayoutUpdate();
    });

    return details;
}

function openPendingLoreReviewSections() {
    setSectionCollapsed('lore.pendingReview', false);
}

function getCountLabel(value, label) {
    const count = Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0);
    return `${count} ${label}${count === 1 ? '' : 's'}`;
}

function getLoreDisplayLabel(field, value) {
    if (field === 'priority') return `P${value}`;
    const registryName = getLoreFieldRegistry(field);
    const meta = registryName ? getLoreRegistryMeta(registryName, value) : null;
    return meta?.label || CATEGORY_LABELS[value] || String(value || '');
}

function applyLoreRegistryStyle(el, field, value) {
    const registryName = getLoreFieldRegistry(field);
    const meta = registryName ? getLoreRegistryMeta(registryName, value) : null;
    if (!meta) return el;
    if (meta.color) el.style.background = meta.color;
    if (meta.textColor) el.style.color = meta.textColor;
    if (meta.color) el.style.borderColor = meta.color;
    return el;
}

let panelRoot = null;

// Public runtime ------------------------------------------------------------

export function showLorePanel() {
    const state = getState();
    if (state?.lorePanel) {
        state.lorePanel.isOpen = true;
        normalizePanelLayoutState(state, { persistLegacyOpenState: true });
        saveState(state);
    }

    const freshState = getState();
    normalizePanelLayoutState(freshState, { persistLegacyOpenState: true });
    const panelState = freshState?.lorePanel || getDefaultState().lorePanel;

    const previousRoot = panelRoot || document.getElementById(PANEL_ID);
    const nextRoot = document.createElement('div');
    nextRoot.id = PANEL_ID;
    nextRoot.className = 'saga-lore-panel saga-runtime-shell';
    applyRuntimeShellGeometry(nextRoot, panelState);

    try {
        renderPanelShell(nextRoot, freshState);
    } catch (e) {
        console.error('[Saga] Runtime panel failed to render:', e);
        try {
            renderPanelFallbackShell(nextRoot, freshState, e);
        } catch (fallbackError) {
            console.error('[Saga] Runtime fallback panel failed to render:', fallbackError);
            if (previousRoot) {
                panelRoot = previousRoot;
                return;
            }
            throw fallbackError;
        }
    }

    if (previousRoot && previousRoot !== nextRoot) previousRoot.remove();
    panelRoot = nextRoot;
    document.body.appendChild(panelRoot);

    requestAnimationFrame(() => {
        clampRuntimeShellToViewport();
        updateAcceptedLoreScrollRegionHeight();
    });
}

export function hideLorePanel() {
    closeSagaTour();
    closeLoreWorkbench();
    removeLorePanel();
    const state = getState();
    if (state?.lorePanel) {
        state.lorePanel.isOpen = false;
        saveState(state);
    }
}
export function refreshLorePanel() {
    const existing = document.getElementById(PANEL_ID);
    if (!existing) return;

    const state = getState();
    if (!state?.lorePanel?.isOpen) {
        closeSagaTour();
        removeLorePanel();
        return;
    }

    normalizePanelLayoutState(state);
    applyRuntimeTheme(existing, getSettings());
    const hasDrawer = !!existing.querySelector('.saga-runtime-drawer');
    if ((state.lorePanel.drawerOpen === true) !== hasDrawer) {
        renderPanelShell(existing, state);
        return;
    }
    refreshPanelBody({ preserveScroll: true });
    refreshHeader();
}

function removeLorePanel() {
    if (panelRoot) {
        panelRoot.remove();
        panelRoot = null;
    }
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();
}

// Shell -----------------------------------------------------------------------

function renderPanelShell(root, state) {
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const railMode = normalizeRailMode(panelState.railMode);
    const drawerOpen = panelState.drawerOpen === true;
    const drawerDirection = drawerOpen ? resolveDrawerDirection(panelState) : 'right';
    const settings = getSettings();

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.classList.add(`saga-runtime-rail-${railMode}`);
    if (drawerOpen) root.classList.add('saga-runtime-drawer-open');
    root.dataset.railMode = railMode;
    root.dataset.drawerDirection = drawerDirection;
    root.style.setProperty('--saga-rail-width', `${getRailWidth(panelState)}px`);
    root.style.setProperty('--saga-drawer-width', `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`);
    root.style.setProperty('--saga-drawer-height', `${getConstrainedDrawerHeight(panelState)}px`);
    applyRuntimeTheme(root, settings);

    root.appendChild(renderRail(state));
    if (drawerOpen) root.appendChild(renderDrawer(state, drawerDirection));

    refreshHeader();
}

function renderPanelFallbackShell(root, state, error) {
    normalizePanelLayoutState(state);
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const railMode = normalizeRailMode(panelState.railMode);
    const drawerDirection = panelState.drawerOpen === true ? resolveDrawerDirection(panelState) : 'right';
    const settings = getSettings();

    root.innerHTML = '';
    root.className = 'saga-lore-panel saga-runtime-shell';
    root.classList.add(`saga-runtime-rail-${railMode}`);
    root.classList.add('saga-runtime-drawer-open');
    root.dataset.railMode = railMode;
    root.dataset.drawerDirection = drawerDirection;
    root.style.setProperty('--saga-rail-width', `${getRailWidth(panelState)}px`);
    root.style.setProperty('--saga-drawer-width', `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`);
    root.style.setProperty('--saga-drawer-height', `${getConstrainedDrawerHeight(panelState)}px`);
    applyRuntimeTheme(root, settings);

    root.appendChild(renderRail(state));

    const drawer = document.createElement('div');
    drawer.className = `saga-runtime-drawer saga-runtime-drawer-${drawerDirection}`;
    drawer.style.width = `${getConstrainedDrawerWidth(panelState, drawerDirection)}px`;
    drawer.style.height = `${getConstrainedDrawerHeight(panelState)}px`;
    const header = document.createElement('div');
    header.className = 'saga-runtime-drawer-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-panel-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-panel-title saga-runtime-drawer-title';
    title.textContent = 'Saga';
    titleWrap.appendChild(title);
    const status = document.createElement('div');
    status.className = 'saga-lore-panel-status saga-runtime-drawer-status';
    titleWrap.appendChild(status);
    header.appendChild(titleWrap);
    drawer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-lore-panel-body';
    const tabBody = document.createElement('div');
    tabBody.className = 'saga-runtime-tab-body';
    tabBody.appendChild(createRuntimeRenderErrorCard('Runtime Window', error));
    body.appendChild(tabBody);
    drawer.appendChild(body);
    root.appendChild(drawer);
}

function renderRail(state) {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const railMode = normalizeRailMode(panelState.railMode);
    const drawerOpen = panelState.drawerOpen === true;
    const settings = getSettings();
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);
    const metrics = getRailMetrics(state, settings);

    const rail = document.createElement('div');
    rail.className = `saga-runtime-rail saga-runtime-rail-${railMode}`;

    const drag = document.createElement('div');
    drag.className = 'saga-runtime-rail-drag';
    drag.addEventListener('mousedown', onRuntimeRailDragStart);
    addTooltip(drag, 'Drag to move the Saga rail. The drawer stays anchored to this rail.');

    const mark = document.createElement('div');
    mark.className = 'saga-runtime-rail-mark';

    const markImg = document.createElement('img');
    markImg.className = 'saga-runtime-rail-logo-img';
    markImg.src = getBrandLogoSrc(railMode, settings);
    markImg.alt = railMode === 'compact' ? 'SAGA' : 'SAGA logo';
    markImg.draggable = false;
    markImg.addEventListener('error', () => {
        markImg.remove();
        mark.textContent = railMode === 'compact' ? 'S' : 'SAGA';
        mark.classList.add('saga-runtime-rail-mark-fallback');
    }, { once: true });
    mark.appendChild(markImg);
    drag.appendChild(mark);

    const sub = document.createElement('div');
    sub.className = 'saga-runtime-rail-subtitle';
    sub.textContent = railMode === 'expanded' ? 'Fandom Loresystem' : '';
    drag.appendChild(sub);
    rail.appendChild(drag);
    rail.appendChild(createExperienceModeSwitch(settings));

    const tabs = document.createElement('div');
    tabs.className = 'saga-runtime-rail-tabs';
    const visibleTabs = getVisibleTabsForExperience(settings);
    for (const tabId of visibleTabs) {
        const label = getTabLabelForExperience(tabId, settings);
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'saga-runtime-rail-tab';
        tab.dataset.tabId = tabId;
        const isGlobalLoredecksTab = tabId === 'loredecks';
        if (isGlobalLoredecksTab) tab.classList.add('saga-runtime-rail-tab-global');
        if (drawerOpen && tabId === activeTab) tab.classList.add('saga-runtime-rail-tab-active');
        addTooltip(tab, getTabTooltipForExperience(tabId, settings));

        const icon = document.createElement('span');
        icon.className = 'saga-runtime-rail-icon';
        icon.dataset.fallbackIcon = TAB_ICONS[tabId] || label.slice(0, 1);
        const iconSrc = getTabIconSrc(tabId, settings);
        if (iconSrc) {
            const iconImg = document.createElement('img');
            iconImg.className = 'saga-runtime-rail-icon-img';
            iconImg.src = iconSrc;
            iconImg.alt = '';
            iconImg.draggable = false;
            iconImg.addEventListener('error', () => {
                icon.classList.add('saga-runtime-rail-icon-missing');
                icon.textContent = TAB_ICONS[tabId] || label.slice(0, 1);
            }, { once: true });
            icon.appendChild(iconImg);
        } else {
            icon.textContent = TAB_ICONS[tabId] || label.slice(0, 1);
        }
        tab.appendChild(icon);

        const labelEl = document.createElement('span');
        labelEl.className = 'saga-runtime-rail-label';
        labelEl.textContent = label;
        tab.appendChild(labelEl);

        const metric = document.createElement('span');
        metric.className = 'saga-runtime-rail-metric';
        metric.dataset.tabId = tabId;
        metric.textContent = metrics[tabId] || '';
        tab.appendChild(metric);

        tab.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleRuntimeDrawerForTab(tabId);
        });
        tabs.appendChild(tab);
        if (isGlobalLoredecksTab && visibleTabs.length > 1) {
            const divider = document.createElement('div');
            divider.className = 'saga-runtime-rail-tab-divider';
            divider.setAttribute('aria-hidden', 'true');
            tabs.appendChild(divider);
        }
    }
    rail.appendChild(tabs);

    const controls = document.createElement('div');
    controls.className = 'saga-runtime-rail-controls';

    const density = createIconButton(
        railMode === 'compact' ? '>' : '<',
        railMode === 'compact' ? 'Show labels and compact metrics.' : 'Use icons only.',
        'saga-runtime-rail-control saga-runtime-rail-density',
        (e) => {
            e.stopPropagation();
            toggleRuntimeRailMode();
        }
    );
    controls.appendChild(density);

    const close = createIconButton(
        'x',
        'Close the Saga rail. Reopen it from the extension launcher.',
        'saga-runtime-rail-control saga-runtime-rail-close',
        (e) => {
            e.stopPropagation();
            hideLorePanel();
        }
    );
    controls.appendChild(close);
    rail.appendChild(controls);

    return rail;
}

function createExperienceModeSwitch(settings = getSettings()) {
    const mode = normalizeExperienceMode(settings.experienceMode);
    const control = document.createElement('div');
    control.className = `saga-experience-switch saga-experience-switch-${mode}`;
    markTourTarget(control, 'session.experienceMode');
    control.setAttribute('role', 'radiogroup');
    control.setAttribute('aria-label', `Experience Mode: ${getExperienceLabel(settings)}`);
    addTooltip(control, getExperienceTooltip(settings));

    const basic = document.createElement('button');
    basic.type = 'button';
    basic.className = 'saga-experience-switch-label saga-experience-switch-label-basic';
    basic.textContent = 'Basic';
    basic.setAttribute('role', 'radio');
    basic.setAttribute('aria-checked', mode === 'basic' ? 'true' : 'false');
    addTooltip(basic, 'Switch to Basic Experience.');
    basic.addEventListener('click', (event) => {
        event.stopPropagation();
        selectExperienceMode('basic');
    });
    control.appendChild(basic);

    const advanced = document.createElement('button');
    advanced.type = 'button';
    advanced.className = 'saga-experience-switch-label saga-experience-switch-label-advanced';
    advanced.textContent = 'Advanced';
    advanced.setAttribute('role', 'radio');
    advanced.setAttribute('aria-checked', mode === 'advanced' ? 'true' : 'false');
    addTooltip(advanced, 'Switch to Advanced Experience.');
    advanced.addEventListener('click', (event) => {
        event.stopPropagation();
        selectExperienceMode('advanced');
    });
    control.appendChild(advanced);

    const knob = document.createElement('span');
    knob.className = 'saga-experience-switch-knob';
    control.appendChild(knob);

    return control;
}

function selectExperienceMode(mode) {
    const normalized = normalizeExperienceMode(mode);
    const current = normalizeExperienceMode(getSettings().experienceMode);
    if (current === normalized) return;
    setExperienceMode(normalized);
    showLorePanel();
}

function renderDrawer(state, direction = 'right') {
    const panelState = state?.lorePanel || getDefaultState().lorePanel;
    const settings = getSettings();
    const activeTab = normalizeTabForExperience(panelState.activeTab, settings);

    const drawer = document.createElement('div');
    drawer.className = `saga-runtime-drawer saga-runtime-drawer-${direction}`;
    drawer.style.width = `${getConstrainedDrawerWidth(panelState, direction)}px`;
    drawer.style.height = `${getConstrainedDrawerHeight(panelState)}px`;

    const header = document.createElement('div');
    header.className = 'saga-runtime-drawer-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-panel-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-panel-title saga-runtime-drawer-title';
    title.textContent = getTabLabelForExperience(activeTab, settings);
    addTooltip(title, getTabTooltipForExperience(activeTab, settings));
    titleWrap.appendChild(title);

    const status = document.createElement('div');
    status.className = 'saga-lore-panel-status saga-runtime-drawer-status';
    titleWrap.appendChild(status);
    header.appendChild(titleWrap);

    drawer.appendChild(header);

    const body = document.createElement('div');
    body.className = 'saga-lore-panel-body';
    drawer.appendChild(body);
    renderPanelBody(body, state);

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'saga-lore-panel-resize-handle saga-runtime-drawer-resize-handle';
    resizeHandle.addEventListener('pointerdown', onRuntimeDrawerResizeStart);
    addTooltip(resizeHandle, 'Drag to resize the active drawer. The size is remembered across tabs.');
    drawer.appendChild(resizeHandle);

    updateDrawerScrollMetrics(drawer);
    return drawer;
}

function refreshHeader() {
    if (!panelRoot) return;

    const state = getState();
    normalizePanelLayoutState(state);
    const settings = getSettings();
    const metrics = getRailMetrics(state, settings);

    for (const metric of panelRoot.querySelectorAll('.saga-runtime-rail-metric[data-tab-id]')) {
        metric.textContent = metrics[metric.dataset.tabId] || '';
    }

    const status = panelRoot.querySelector('.saga-runtime-drawer-status');
    if (!status) return;

    const pendingLore = (state?.pendingLoreEntries || []).length;
    const pendingDelta = state?.lastDelta ? 1 : 0;
    const counts = getPanelLoreState(state).counts;
    const selectedLore = getSelectedLoreInjectionCount(state, settings);

    status.innerHTML = '';
    status.appendChild(createStatusPill(`Experience: ${getExperienceLabel(settings)}`, getExperienceTooltip(settings)));
    status.appendChild(createStatusPill(`Automation: ${getAutomationLabel(settings)}`, getAutomationTooltip(settings)));
    status.appendChild(createStatusPill(settings.enabled ? 'Active' : 'Paused', 'Master runtime toggle. When paused, Saga does not inject, scan, or generate.'));
    status.appendChild(createStatusPill((settings.injectContinuity !== false && settings.injectMemo !== false) ? 'Continuity Injected' : 'Continuity Not Injected', 'Whether Saga includes structured continuity state in roleplay generation prompts.'));
    if (pendingDelta + pendingLore > 0) {
        status.appendChild(createStatusPill(`Pending: ${pendingDelta + pendingLore}`, 'Pending generated lore entries plus any legacy continuity delta.'));
    }
    status.appendChild(createStatusPill(`Lore Selected: ${selectedLore}`, 'Accepted lore entries selected for the next injection after context activation, priority, pinning, and muting.'));
    void counts;
}

function refreshRuntimeRailIcons(settings = getSettings()) {
    if (!panelRoot) return;
    const state = getState();
    const railMode = normalizeRailMode(state?.lorePanel?.railMode);
    const logo = panelRoot.querySelector('.saga-runtime-rail-logo-img');
    if (logo) {
        logo.src = getBrandLogoSrc(railMode, settings);
        logo.alt = railMode === 'compact' ? 'SAGA' : 'SAGA logo';
    }
    for (const tab of panelRoot.querySelectorAll('.saga-runtime-rail-tab[data-tab-id]')) {
        const tabId = tab.dataset.tabId;
        const icon = tab.querySelector('.saga-runtime-rail-icon');
        if (!icon) continue;
        const label = getTabLabelForExperience(tabId, settings);
        const fallback = TAB_ICONS[tabId] || label.slice(0, 1);
        icon.classList.remove('saga-runtime-rail-icon-missing');
        icon.dataset.fallbackIcon = fallback;
        icon.textContent = '';
        const iconSrc = getTabIconSrc(tabId, settings);
        if (iconSrc) {
            const iconImg = document.createElement('img');
            iconImg.className = 'saga-runtime-rail-icon-img';
            iconImg.src = iconSrc;
            iconImg.alt = '';
            iconImg.draggable = false;
            iconImg.addEventListener('error', () => {
                icon.classList.add('saga-runtime-rail-icon-missing');
                icon.textContent = fallback;
            }, { once: true });
            icon.appendChild(iconImg);
        } else {
            icon.textContent = fallback;
        }
    }
}

function stopLoredeckCreatorGenerationTicker() {
    if (!loredeckCreatorGenerationTicker) return;
    clearInterval(loredeckCreatorGenerationTicker);
    loredeckCreatorGenerationTicker = null;
}

function isLoredeckCreatorAbortError(error) {
    return error?.name === 'AbortError' || /aborted|cancelled|canceled/i.test(String(error?.message || error || ''));
}

function getLoredeckCreatorJobId(job = {}) {
    return String(job?.jobId || job?.id || '').trim();
}

function getLoredeckCreatorGenerationJobId(generation = null) {
    if (!generation?.id) return '';
    return String(generation.jobId || loredeckCreatorLiveGenerationJobs.get(generation.id) || '').trim();
}

function rememberLoredeckCreatorLiveGeneration(jobId = '', generation = null) {
    const id = String(jobId || '').trim();
    if (!id || !generation?.id || generation.status !== 'running') return generation;
    const live = {
        ...generation,
        jobId: id,
    };
    loredeckCreatorLiveGenerationsByJobId.set(id, live);
    loredeckCreatorLiveGenerationJobs.set(live.id, id);
    return live;
}

function forgetLoredeckCreatorLiveGeneration(generationOrId = '') {
    const generationId = typeof generationOrId === 'string'
        ? String(generationOrId || '').trim()
        : String(generationOrId?.id || '').trim();
    const jobId = String(
        (typeof generationOrId === 'object' && generationOrId ? generationOrId.jobId : '')
        || loredeckCreatorLiveGenerationJobs.get(generationId)
        || ''
    ).trim();
    if (jobId) {
        const live = loredeckCreatorLiveGenerationsByJobId.get(jobId);
        if (!generationId || live?.id === generationId) loredeckCreatorLiveGenerationsByJobId.delete(jobId);
    }
    if (generationId) loredeckCreatorLiveGenerationJobs.delete(generationId);
}

function getLoredeckCreatorLiveGenerationForJob(jobOrId = '') {
    const jobId = typeof jobOrId === 'string' ? String(jobOrId || '').trim() : getLoredeckCreatorJobId(jobOrId);
    if (!jobId) return null;
    const live = loredeckCreatorLiveGenerationsByJobId.get(jobId);
    if (!live || live.status !== 'running') return null;
    return live;
}

function getLoredeckCreatorActiveGenerationByJobIdMap() {
    const active = new Map();
    for (const [jobId, generation] of loredeckCreatorLiveGenerationsByJobId.entries()) {
        if (generation?.status === 'running') active.set(jobId, generation);
    }
    return active;
}

function isLoredeckCreatorActiveGenerationStillLive(job = {}) {
    const active = job?.activeGeneration;
    if (!active?.id) return false;
    const live = getLoredeckCreatorLiveGenerationForJob(job);
    if (!live || live.id !== active.id) return false;
    return loredeckCreatorGenerationControllers.has(active.id) || live.abortable === false;
}

function getAnyActiveLoredeckCreatorLiveGeneration() {
    for (const generation of getLoredeckCreatorActiveGenerationByJobIdMap().values()) {
        if (generation?.status === 'running') return generation;
    }
    return null;
}

function attachLoredeckCreatorLiveGeneration(job = {}) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) return job || {};
    const live = getLoredeckCreatorLiveGenerationForJob(job);
    if (!live) return job;
    return {
        ...job,
        activeGeneration: live,
        status: 'running',
    };
}

function findLoredeckCreatorActiveUnitForRecovery(job = {}, active = {}) {
    const units = job?.generationUnits && typeof job.generationUnits === 'object' && !Array.isArray(job.generationUnits)
        ? job.generationUnits
        : {};
    if (active.unitId && units[active.unitId]) return units[active.unitId];
    const runId = String(active.runId || active.id || '').trim();
    const activeStatuses = new Set(['queued', 'running', 'retrying']);
    return Object.values(units)
        .filter(unit => {
            if (!unit?.unitId) return false;
            if (runId && unit.runId && unit.runId !== runId) return false;
            return activeStatuses.has(String(unit.status || '').toLowerCase());
        })
        .sort((a, b) => (Number(b.updatedAt || b.startedAt || 0) || 0) - (Number(a.updatedAt || a.startedAt || 0) || 0))[0] || null;
}

function buildLoredeckCreatorInterruptedResult(active = {}, now = Date.now()) {
    const label = active.label || 'Creator generation';
    const startedAt = Number(active.startedAt || active.updatedAt || now) || now;
    return {
        id: active.id || active.runId || active.unitId || `interrupted_${now}`,
        runId: active.runId || '',
        unitId: active.unitId || '',
        actionId: active.actionId || '',
        stage: active.stage || active.currentStage || '',
        label,
        status: 'interrupted',
        message: `${label} was interrupted before it completed. Review any saved batches, then rerun the current stage.`,
        completedAt: now,
        elapsedMs: Math.max(0, now - startedAt),
        receivedChars: Number(active.receivedChars || 0),
        snippet: active.snippet || '',
        streamSupported: active.streamSupported === true ? true : active.streamSupported === false ? false : null,
        batchId: active.batchId || '',
        batchLabel: active.batchLabel || '',
    };
}

function recoverLoredeckCreatorInterruptedActiveGeneration(job = {}, options = {}) {
    if (!job?.jobId || !job.activeGeneration?.id) {
        return { job, recovered: false, live: false };
    }
    if (isLoredeckCreatorActiveGenerationStillLive(job)) {
        startLoredeckCreatorGenerationTicker(job.activeGeneration.id);
        return { job: attachLoredeckCreatorLiveGeneration(job), recovered: false, live: true };
    }
    const active = job.activeGeneration;
    const now = Date.now();
    const activeUnit = findLoredeckCreatorActiveUnitForRecovery(job, active);
    const runId = String(active.runId || active.id || activeUnit?.runId || '').trim();
    const unitId = String(active.unitId || activeUnit?.unitId || '').trim();
    const generationRuns = { ...(job.generationRuns || {}) };
    if (runId) {
        generationRuns[runId] = {
            ...(generationRuns[runId] || {}),
            runId,
            jobId: job.jobId,
            kind: generationRuns[runId]?.kind || 'loredeck_creator',
            stage: generationRuns[runId]?.stage || active.stage || active.currentStage || '',
            mode: generationRuns[runId]?.mode || 'single_unit',
            status: 'interrupted',
            completedAt: now,
            updatedAt: now,
            error: generationRuns[runId]?.error || 'Previous Creator generation was interrupted before it completed.',
        };
    }
    const generationUnits = { ...(job.generationUnits || {}) };
    if (unitId) {
        generationUnits[unitId] = {
            ...(generationUnits[unitId] || activeUnit || {}),
            unitId,
            jobId: job.jobId,
            runId: runId || generationUnits[unitId]?.runId || '',
            stage: generationUnits[unitId]?.stage || active.stage || active.currentStage || '',
            label: generationUnits[unitId]?.label || active.label || 'Generation unit',
            status: 'interrupted',
            failedAt: now,
            updatedAt: now,
            error: generationUnits[unitId]?.error || 'Previous Creator generation was interrupted before this unit completed.',
        };
    }
    const interruptedResult = buildLoredeckCreatorInterruptedResult({
        ...active,
        runId,
        unitId,
    }, now);
    const nextStatus = String(job.status || '').trim().toLowerCase() === 'running' ? 'draft' : (job.status || 'draft');
    const update = updateLoredeckCreatorProject(job.jobId, {
        activeGeneration: null,
        generationRuns,
        generationUnits,
        lastGenerationResult: interruptedResult,
        status: nextStatus,
        currentStage: '',
        updatedAt: now,
    }, { syncPrompt: false, syncLocal: true });
    loredeckCreatorGenerationControllers.delete(active.id);
    forgetLoredeckCreatorLiveGeneration(active);
    if (loredeckCreatorGenerationTicker) stopLoredeckCreatorGenerationTicker();
    const recoveredJob = update.ok && update.job ? update.job : {
        ...job,
        activeGeneration: null,
        generationRuns,
        generationUnits,
        lastGenerationResult: interruptedResult,
        status: nextStatus,
        currentStage: '',
        updatedAt: now,
    };
    loredeckCreatorBriefCache.set('current', recoveredJob);
    if (options.toast) {
        toast(`${active.label || 'Creator generation'} was interrupted. Saved batches are preserved; rerun the current stage when ready.`, 'warning');
    }
    return { job: recoveredJob, recovered: true, live: false, result: interruptedResult };
}

function recoverLoredeckCreatorCurrentActiveGenerationOnOpen(options = {}) {
    const cached = getLoredeckCreatorBriefCache();
    return recoverLoredeckCreatorInterruptedActiveGeneration(cached, options);
}

function getActiveLoredeckCreatorGeneration(job = getLoredeckCreatorBriefCache()) {
    const active = getLoredeckCreatorLiveGenerationForJob(job) || job?.activeGeneration;
    return active && active.status === 'running' ? active : null;
}

function isLoredeckCreatorGenerationCurrent(generation = null) {
    if (!generation?.id) return false;
    const jobId = getLoredeckCreatorGenerationJobId(generation);
    if (jobId) {
        const live = getLoredeckCreatorLiveGenerationForJob(jobId);
        if (live?.id === generation.id) return true;
    }
    const active = getActiveLoredeckCreatorGeneration();
    return !!active && active.id === generation.id;
}

function ignoreStaleLoredeckCreatorGeneration(generation = null, context = 'Creator generation') {
    if (isLoredeckCreatorGenerationCurrent(generation)) return false;
    if (generation?.id) {
        console.info(`[Saga] Ignored stale ${context} result: ${generation.id}`);
        loredeckCreatorGenerationControllers.delete(generation.id);
        forgetLoredeckCreatorLiveGeneration(generation);
    }
    return true;
}

function startLoredeckCreatorGenerationTicker(generationId = '') {
    stopLoredeckCreatorGenerationTicker();
    if (!generationId) return;
    loredeckCreatorGenerationTicker = setInterval(() => {
        const cached = getLoredeckCreatorBriefCache();
        const active = cached.activeGeneration;
        if (!active || active.id !== generationId || active.status !== 'running') {
            stopLoredeckCreatorGenerationTicker();
            return;
        }
        setLoredeckCreatorBriefCache({
            ...cached,
            activeGeneration: {
                ...active,
                elapsedMs: Date.now() - Number(active.startedAt || Date.now()),
                message: getLoredeckCreatorGenerationWaitMessage(active),
                updatedAt: Date.now(),
            },
        }, { refreshWorkbench: true });
    }, 1000);
}

function startLoredeckCreatorGeneration(actionId = '', label = '', jobPatch = {}, details = {}) {
    const now = Date.now();
    const current = getLoredeckCreatorBriefCache();
    const generationSettings = getLoredeckCreatorGenerationSettings(current);
    const active = getActiveLoredeckCreatorGeneration(current) || getAnyActiveLoredeckCreatorLiveGeneration();
    if (active) {
        toast(`${active.label || 'Creator generation'} is still running. Cancel it or wait for it to finish before starting another generation.`, 'warning');
        queueLoredeckCreatorWorkbenchRefresh();
        return { generation: null, job: current, blocked: true };
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const generation = {
        id: `${actionId || 'generation'}-${now}`,
        actionId,
        runId: details.runId || `${actionId || 'generation'}-${now}`,
        label: label || 'Generating',
        status: 'running',
        phase: 'starting',
        message: 'Contacting Reasoning Provider...',
        startedAt: now,
        updatedAt: now,
        elapsedMs: 0,
        receivedChars: 0,
        snippet: '',
        streamRequested: generationSettings.showStreamingProgress !== false,
        streamSupported: null,
        abortable: !!controller,
        stage: details.stage || jobPatch.currentStage || '',
        batchId: details.batchId || '',
        batchLabel: details.batchLabel || '',
        batchIndex: Number.isFinite(Number(details.batchIndex)) ? Number(details.batchIndex) : null,
        batchTotal: Number.isFinite(Number(details.batchTotal)) ? Number(details.batchTotal) : null,
    };
    if (controller) loredeckCreatorGenerationControllers.set(generation.id, controller);
    const job = setLoredeckCreatorBriefCache({
        ...(current || {}),
        ...(jobPatch || {}),
        status: 'running',
        activeGeneration: generation,
        lastGenerationResult: null,
        lastAction: actionId || jobPatch.lastAction || current.lastAction || '',
        lastStartedAt: now,
    }, { refreshWorkbench: true });
    if (job?.jobId) {
        const live = rememberLoredeckCreatorLiveGeneration(job.jobId, {
            ...generation,
            currentStage: job.currentStage || jobPatch.currentStage || current.currentStage || '',
        });
        if (live && live !== generation) Object.assign(generation, live);
        loredeckCreatorBriefCache.set('current', {
            ...getLoredeckCreatorBriefCache(),
            activeGeneration: live || generation,
        });
    }
    startLoredeckCreatorGenerationTicker(generation.id);
    return { generation, job };
}

function updateLoredeckCreatorGeneration(generation = null, event = {}, options = {}) {
    if (!generation?.id) return;
    const cached = getLoredeckCreatorBriefCache();
    const active = cached.activeGeneration;
    if (!active || active.id !== generation.id || active.status !== 'running') return;
    const now = Date.now();
    const accumulated = String(event.accumulated || '').trim();
    const receivedChars = Number(event.receivedChars || accumulated.length || active.receivedChars || 0);
    const phase = String(event.phase || active.phase || 'waiting');
    const message = String(event.message || getLoredeckCreatorGenerationWaitMessage(active)).trim();
    setLoredeckCreatorBriefCache({
        ...cached,
        activeGeneration: {
            ...active,
            phase,
            message,
            elapsedMs: now - Number(active.startedAt || now),
            updatedAt: now,
            receivedChars,
            streamSupported: event.streamSupported === undefined ? active.streamSupported : event.streamSupported,
            snippet: accumulated ? formatLoredeckCreatorLiveSnippet(accumulated) : active.snippet || '',
            batchId: options.batchId || active.batchId || '',
            batchLabel: options.batchLabel || active.batchLabel || '',
            batchIndex: options.batchIndex ?? active.batchIndex ?? null,
            batchTotal: options.batchTotal ?? active.batchTotal ?? null,
        },
    }, { refreshWorkbench: true });
}

function makeLoredeckCreatorProgressHandler(generation = null, options = {}) {
    let lastUpdateAt = 0;
    return event => {
        const now = Date.now();
        const important = ['start', 'stream_start', 'stream_complete', 'complete', 'reasoning', 'phase'].includes(event?.type)
            || event?.phase !== 'receiving';
        if (!important && now - lastUpdateAt < 250) return;
        lastUpdateAt = now;
        updateLoredeckCreatorGeneration(generation, event || {}, options);
    };
}

function createLoredeckCreatorRequestOptions(generation = null, options = {}) {
    const controller = generation?.id ? loredeckCreatorGenerationControllers.get(generation.id) : null;
    const settings = getLoredeckCreatorGenerationSettings();
    const stream = options.stream !== undefined ? options.stream === true : settings.showStreamingProgress !== false;
    return {
        stream,
        forceVisibleOutput: options.forceVisibleOutput !== undefined ? options.forceVisibleOutput === true : true,
        signal: controller?.signal,
        onProgress: makeLoredeckCreatorProgressHandler(generation, options),
    };
}

function isLoredeckCreatorParsedArtifactUsable(parsed = null, artifactKey = '') {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    if (artifactKey && parsed[artifactKey]) return true;
    return Array.isArray(parsed.clarifyingQuestions) && parsed.clarifyingQuestions.length > 0;
}

function buildLoredeckCreatorRunnerUnitId(generation = null, stage = 'unit') {
    const generationId = String(generation?.id || 'generation').trim();
    return `${generationId}:${stage || 'unit'}`.replace(/[^a-zA-Z0-9:._-]+/g, '_');
}

function handleLoredeckCreatorRunnerProgress(generation = null, event = {}, unitLabel = 'Creator generation') {
    if (!generation?.id || !event?.type) return;
    if (event.type === 'unit_started') {
        updateLoredeckCreatorGeneration(generation, {
            type: 'phase',
            phase: 'requesting',
            message: `${unitLabel} request started...`,
        });
        return;
    }
    if (event.type === 'unit_repairing') {
        updateLoredeckCreatorGeneration(generation, {
            type: 'phase',
            phase: 'repairing',
            message: `Repairing ${unitLabel} response...`,
        });
        return;
    }
    if (event.type === 'unit_retry_scheduled' || event.type === 'unit_retrying') {
        updateLoredeckCreatorGeneration(generation, {
            type: 'phase',
            phase: 'retry',
            message: `Retrying ${unitLabel}...`,
        });
    }
}

async function runLoredeckCreatorSingleUnitGeneration(config = {}) {
    const generation = config.generation;
    if (!generation?.id) throw new Error('Missing Loredeck Creator generation.');
    if (typeof config.requestResponse !== 'function') throw new Error('Missing Loredeck Creator request callback.');
    if (typeof config.parseResponse !== 'function') throw new Error('Missing Loredeck Creator parser callback.');
    const settings = getLoredeckCreatorGenerationSettings();
    const unitLabel = config.unitLabel || config.label || 'Creator generation';
    const stage = String(config.stage || 'creator_generation').trim();
    const jobId = getLoredeckCreatorGenerationJobId(generation) || generation.jobId || generation.id;
    const requestOptions = createLoredeckCreatorRequestOptions(generation, config.requestOptions || {});
    const unitId = config.unitId || buildLoredeckCreatorRunnerUnitId(generation, stage);
    const checkpointOptions = {
        syncPrompt: false,
        label: generation.label || unitLabel,
        currentStage: config.currentStage || generation.currentStage || stage,
    };
    const runnerResult = await runGenerationUnits({
        jobId,
        runId: generation.id,
        kind: 'loredeck_creator',
        stage,
        mode: 'single_unit',
        units: [{
            unitId,
            label: unitLabel,
            stage,
            inputHash: String(config.inputHash || '').trim(),
            meta: config.unitMeta && typeof config.unitMeta === 'object' && !Array.isArray(config.unitMeta)
                ? config.unitMeta
                : {},
            createdAt: Date.now(),
        }],
        signal: requestOptions.signal,
        retryAttempts: Number.isFinite(Number(config.retryAttempts)) ? Number(config.retryAttempts) : settings.retryAttempts,
        stopOnFailure: true,
        isRunCurrent: () => isLoredeckCreatorGenerationCurrent(generation),
        onProgress: event => handleLoredeckCreatorRunnerProgress(generation, event, unitLabel),
        checkpointRun: async ({ run }) => {
            if (!jobId) return;
            updateLoredeckCreatorGenerationRun(jobId, run, checkpointOptions);
        },
        checkpointUnit: async ({ unit }) => {
            if (!jobId || !unit?.unitId) return;
            updateLoredeckCreatorGenerationUnit(jobId, unit.unitId, unit, checkpointOptions);
        },
        callUnit: async ({ emitProgress }) => {
            if (typeof emitProgress === 'function') {
                emitProgress({
                    type: 'phase',
                    phase: 'requesting',
                    message: `${unitLabel} request started...`,
                });
            }
            return await config.requestResponse(config.requestContext || {}, requestOptions);
        },
        parseResult: rawResult => config.parseResponse(String(rawResult || '')),
        repairResult: typeof config.repairResponse === 'function'
            ? async ({ rawResult, error }) => {
                const repairedText = await config.repairResponse(String(rawResult || ''), config.requestContext || {}, requestOptions);
                const repaired = config.parseResponse(String(repairedText || ''));
                if (typeof config.isRepairUsable === 'function' && !config.isRepairUsable(repaired)) throw error;
                return {
                    rawResult: repairedText,
                    parsedResult: {
                        ...repaired,
                        warnings: [
                            ...((repaired?.warnings || [])),
                            config.repairWarning || 'Creator response was normalized into Saga format.',
                        ],
                    },
                };
            }
            : null,
        commitResult: async ({ parsedResult }) => {
            const customCommit = typeof config.commitParsedResult === 'function'
                ? await config.commitParsedResult({ parsedResult, generation, unitId, stage, requestContext: config.requestContext || {} })
                : null;
            return {
                ...(customCommit || {}),
                resultRef: {
                    ...(customCommit?.resultRef || {}),
                    type: config.resultRefType || stage,
                    summary: String(parsedResult?.summary || '').trim(),
                    completedAt: Date.now(),
                },
            };
        },
    });
    if (runnerResult.status === 'cancelled' || runnerResult.status === 'superseded') {
        return {
            aborted: true,
            runnerResult,
            requestOptions,
            responseText: '',
            parsed: null,
        };
    }
    const completed = (runnerResult.results || []).find(result => result?.status === 'complete');
    if (!completed) {
        const failed = (runnerResult.results || []).find(result => result?.status === 'failed') || runnerResult.results?.[0] || {};
        const message = failed.error?.message || failed.unit?.error || runnerResult.error?.message || `${unitLabel} generation failed.`;
        throw new Error(message);
    }
    return {
        aborted: false,
        runnerResult,
        requestOptions,
        responseText: String(completed.rawResult || ''),
        parsed: completed.parsedResult,
        commitResult: completed.commitResult || null,
    };
}

function finishLoredeckCreatorGeneration(generation = null, status = 'success', message = '', details = {}) {
    if (!generation?.id) return;
    const cached = getLoredeckCreatorBriefCache();
    const active = cached.activeGeneration;
    if (!active || active.id !== generation.id) {
        loredeckCreatorGenerationControllers.delete(generation.id);
        return;
    }
    stopLoredeckCreatorGenerationTicker();
    loredeckCreatorGenerationControllers.delete(generation.id);
    forgetLoredeckCreatorLiveGeneration(generation);
    const now = Date.now();
    const result = {
        id: generation.id,
        actionId: active.actionId || generation.actionId || '',
        label: active.label || generation.label || 'Generation',
        status,
        message: message || (status === 'success' ? 'Generation complete.' : status === 'warning' ? 'Generation needs review.' : 'Generation failed.'),
        completedAt: now,
        elapsedMs: now - Number(active.startedAt || now),
        receivedChars: Number(details.receivedChars || active.receivedChars || 0),
        snippet: details.snippet || active.snippet || '',
        streamSupported: active.streamSupported,
        batchId: active.batchId || '',
        batchLabel: active.batchLabel || '',
    };
    setLoredeckCreatorBriefCache({
        ...cached,
        activeGeneration: null,
        lastGenerationResult: result,
        lastCompletedAt: status === 'error' ? cached.lastCompletedAt : now,
    }, { refreshWorkbench: true });
}

function cancelLoredeckCreatorGeneration(generationId = '') {
    const cached = getLoredeckCreatorBriefCache();
    const active = getActiveLoredeckCreatorGeneration(cached);
    if (!active || (generationId && active.id !== generationId)) return false;
    const controller = loredeckCreatorGenerationControllers.get(active.id);
    try {
        controller?.abort?.();
    } catch (error) {
        console.warn('[Saga] Could not abort Creator generation:', error);
    }
    stopLoredeckCreatorGenerationTicker();
    loredeckCreatorGenerationControllers.delete(active.id);
    forgetLoredeckCreatorLiveGeneration(active);
    const now = Date.now();
    const restoredStage = inferLoredeckCreatorUiStage({
        ...cached,
        activeGeneration: null,
        status: '',
        currentStage: '',
    });
    const result = {
        id: active.id,
        actionId: active.actionId || '',
        label: active.label || 'Generation',
        status: 'cancelled',
        message: 'Generation cancelled. Any late provider response will be ignored.',
        completedAt: now,
        elapsedMs: now - Number(active.startedAt || now),
        receivedChars: Number(active.receivedChars || 0),
        snippet: active.snippet || '',
        streamSupported: active.streamSupported,
        batchId: active.batchId || '',
        batchLabel: active.batchLabel || '',
    };
    setLoredeckCreatorBriefCache({
        ...cached,
        activeGeneration: null,
        lastGenerationResult: result,
        status: cached.brief ? 'draft' : 'idle',
        currentStage: restoredStage,
    }, { refreshWorkbench: true });
    toast(`${active.label || 'Creator generation'} cancelled.`, 'info');
    return true;
}

function applyLoredeckCreatorGenerationButtonLock(button, cached = getLoredeckCreatorBriefCache(), label = 'generation') {
    if (!button) return button;
    const active = getActiveLoredeckCreatorGeneration(cached);
    if (!active) return button;
    button.disabled = true;
    addTooltip(button, `${active.label || 'Creator generation'} is running. Cancel it or wait for it to finish before starting another ${label}.`);
    return button;
}

const LOREDECK_CREATOR_RECOVERABLE_UNIT_STATUSES = new Set(['failed', 'interrupted']);

function getLoredeckCreatorUnitMeta(unit = {}) {
    return unit?.meta && typeof unit.meta === 'object' && !Array.isArray(unit.meta) ? unit.meta : {};
}

function getLoredeckCreatorLatestRecoverableUnit(cached = getLoredeckCreatorBriefCache()) {
    const active = getActiveLoredeckCreatorGeneration(cached);
    if (active) return null;
    const units = cached?.generationUnits && typeof cached.generationUnits === 'object' && !Array.isArray(cached.generationUnits)
        ? Object.values(cached.generationUnits)
        : [];
    const candidates = units
        .filter(unit => unit?.unitId && LOREDECK_CREATOR_RECOVERABLE_UNIT_STATUSES.has(String(unit.status || '').toLowerCase()))
        .sort((a, b) => (Number(b.failedAt || b.updatedAt || b.completedAt || b.startedAt || 0) || 0) - (Number(a.failedAt || a.updatedAt || a.completedAt || a.startedAt || 0) || 0));
    return candidates[0] || null;
}

function formatLoredeckCreatorRecoveryStageLabel(unit = {}) {
    const stage = String(unit?.stage || '').trim();
    if (stage === 'scope_brief') return 'Scope Brief';
    if (stage === 'story_outline') return 'Story Outline';
    if (stage === 'title_revision') return 'Title revision';
    if (stage === 'title_batch') return 'Title batch';
    if (stage === 'context_tag_planning') return 'Context and Tag plan';
    if (stage === 'entry_micro_batch') return 'Lorecard micro-batch';
    return unit?.label || 'Creator generation unit';
}

function getLoredeckCreatorRetrySmallerConfig(unit = {}, cached = getLoredeckCreatorBriefCache()) {
    const settings = getLoredeckCreatorGenerationSettings(cached);
    const meta = getLoredeckCreatorUnitMeta(unit);
    const stage = String(unit?.stage || '').trim();
    if (meta.retrySmallerSupported === false) return null;
    if (stage === 'title_batch') {
        const current = clampLoredeckCreatorInteger(meta.titlePassLimit, 1, 24, settings.titleBatchLimit);
        const next = Math.max(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS.titleBatchLimit[0], Math.ceil(current / 2));
        return next < current ? { key: 'titlePassLimitOverride', value: next, label: `${next} titles` } : null;
    }
    if (stage === 'context_tag_planning') {
        const current = clampLoredeckCreatorInteger(meta.proposalLimit, 1, 24, settings.planningProposalLimit);
        const next = Math.max(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS.planningProposalLimit[0], Math.ceil(current / 2));
        return next < current ? { key: 'planningProposalLimitOverride', value: next, label: `${next} proposals` } : null;
    }
    if (stage === 'entry_micro_batch') {
        const current = getLoredeckCreatorEntryBatchLimit(meta.batchSize, cached);
        const next = Math.max(1, Math.ceil(current / 2));
        return next < current ? { key: 'batchSize', value: next, label: `${next} Lorecard${next === 1 ? '' : 's'}` } : null;
    }
    return null;
}

function buildLoredeckCreatorRetryUnitId(unit = {}, mode = 'retry', size = '') {
    const base = String(unit?.unitId || unit?.id || 'creator_unit').replace(/[^a-zA-Z0-9:._-]+/g, '_').slice(0, 180);
    const suffix = [mode || 'retry', size || '', Date.now()].filter(Boolean).join('_');
    return `${base}:${suffix}`.replace(/[^a-zA-Z0-9:._-]+/g, '_').slice(0, 220);
}

function markLoredeckCreatorRecoveryUnitSuperseded(unit = {}, replacementUnitId = '') {
    if (!unit?.unitId) return false;
    const cached = getLoredeckCreatorBriefCache();
    const generationUnits = { ...(cached.generationUnits || {}) };
    const existing = generationUnits[unit.unitId] || unit;
    generationUnits[unit.unitId] = {
        ...existing,
        status: 'superseded',
        error: replacementUnitId ? `Superseded by retry unit ${replacementUnitId}.` : 'Superseded by retry.',
        updatedAt: Date.now(),
    };
    setLoredeckCreatorBriefCache({
        ...cached,
        generationUnits,
    }, { refreshWorkbench: true });
    return true;
}

function getLoredeckCreatorTitleBatchByRecoveryMeta(cached = {}, meta = {}) {
    const id = normalizeLoredeckCreatorTitleId(meta.targetTitleBatchId || meta.batchId || '', '');
    return (id ? getLoredeckCreatorTitleBatchById(cached, id) : null)
        || getLoredeckCreatorNextTitleBatch(cached)
        || null;
}

function getLoredeckCreatorPlanningBatchByRecoveryMeta(cached = {}, meta = {}) {
    const id = normalizeLoredeckCreatorTitleId(meta.targetPlanningBatchId || meta.targetTitleBatchId || meta.batchId || '', '');
    return getLoredeckCreatorPlanningBatchRows(cached).find(batch => batch.id === id)
        || getLoredeckCreatorNextPlanningBatch(cached)
        || null;
}

function getLoredeckCreatorSelectedDraftsByIds(cached = {}, ids = []) {
    const wanted = new Set(normalizeLoredeckCreatorTitleIdList(ids || [], 200, 180));
    if (!wanted.size) return [];
    return getLoredeckCreatorTitleDrafts(cached).filter(draft => wanted.has(normalizeLoredeckCreatorTitleId(draft.titleId || draft.id || '', '')));
}

async function retryLoredeckCreatorRecoverableUnit(unit = {}, options = {}, button = null) {
    const cached = getLoredeckCreatorBriefCache();
    if (!unit?.unitId) {
        toast('No failed Creator generation unit is available to retry.', 'info');
        return { status: 'missing' };
    }
    if (getActiveLoredeckCreatorGeneration(cached)) {
        toast('A Creator generation is already running.', 'warning');
        return { status: 'blocked' };
    }
    if (!ensureLoreProviderReadyForAction('Loredeck Creator', 'lore')) return { status: 'not_ready' };

    const meta = getLoredeckCreatorUnitMeta(unit);
    const stage = String(unit.stage || '').trim();
    const smaller = options.smaller === true;
    const smallerConfig = smaller ? getLoredeckCreatorRetrySmallerConfig(unit, cached) : null;
    if (smaller && !smallerConfig) {
        toast('This failed Creator unit cannot be retried smaller.', 'info');
        return { status: 'blocked', reason: 'no_smaller_unit' };
    }
    const unitIdOverride = smaller
        ? buildLoredeckCreatorRetryUnitId(unit, 'retry_smaller', smallerConfig?.value)
        : unit.unitId;
    let result = null;

    const runRetry = async () => {
        if (stage === 'scope_brief') {
            result = await handleLoredeckCreatorBriefDraft({
                fandom: meta.fandom || cached.fandom || cached.brief?.fandom || loredeckCreatorFandom,
                scope: meta.scope || cached.scope || cached.brief?.scope || loredeckCreatorScope,
                granularity: meta.granularity || cached.granularity || cached.brief?.granularity || loredeckCreatorGranularity || 'focused',
                notes: meta.notes || cached.notes || loredeckCreatorNotes,
                revisionInstruction: meta.revisionInstruction || '',
                previousBrief: cached.brief || null,
                unitIdOverride,
            }, button);
            return;
        }
        if (stage === 'story_outline') {
            result = await handleLoredeckCreatorOutlineDraft({
                previousOutline: cached.outline || null,
                revisionInstruction: meta.revisionInstruction || '',
                unitIdOverride,
            }, button);
            return;
        }
        if (stage === 'title_batch' || stage === 'title_revision') {
            const selectedTitleDrafts = getLoredeckCreatorSelectedDraftsByIds(cached, meta.selectedTitleDraftIds);
            result = await handleLoredeckCreatorTitleDraft({
                brief: cached.brief || {},
                notes: cached.notes || loredeckCreatorNotes,
                targetTitleBatch: getLoredeckCreatorTitleBatchByRecoveryMeta(cached, meta),
                previousTitleDrafts: getLoredeckCreatorTitleDrafts(cached).map(compactLoredeckCreatorTitleDraftForRevision),
                selectedTitleDrafts: selectedTitleDrafts.map(compactLoredeckCreatorTitleDraftForRevision),
                revisionInstruction: meta.revisionInstruction || '',
                titlePassLimitOverride: smallerConfig?.value,
                unitIdOverride,
            }, button);
            return;
        }
        if (stage === 'context_tag_planning') {
            result = await handleLoredeckCreatorPlanningDraft({
                targetPlanningBatch: getLoredeckCreatorPlanningBatchByRecoveryMeta(cached, meta),
                planningProposalLimitOverride: smallerConfig?.value,
                unitIdOverride,
            }, button);
            return;
        }
        if (stage === 'entry_micro_batch') {
            result = await handleLoredeckCreatorEntryDraft(button, {
                maxBatches: 1,
                batchSize: smallerConfig?.value || meta.batchSize,
                targetTitleIds: Array.isArray(meta.targetTitleIds) ? meta.targetTitleIds : [],
                targetPlanningBatchId: meta.targetPlanningBatchId || '',
                unitIdOverride,
            });
            return;
        }
        toast(`Saga does not know how to retry ${formatLoredeckCreatorRecoveryStageLabel(unit)} yet.`, 'warning');
        result = { status: 'unsupported' };
    };

    await runRetry();
    if (smaller && getLoredeckCreatorBriefCache().generationUnits?.[unitIdOverride]) {
        markLoredeckCreatorRecoveryUnitSuperseded(unit, unitIdOverride);
    }
    return result || { status: 'started' };
}

function appendLoredeckCreatorRecoveryActionButtons(actions, cached = getLoredeckCreatorBriefCache()) {
    const unit = getLoredeckCreatorLatestRecoverableUnit(cached);
    if (!unit) return false;
    const stageLabel = formatLoredeckCreatorRecoveryStageLabel(unit);
    const smallerConfig = getLoredeckCreatorRetrySmallerConfig(unit, cached);
    const retryButton = createButton('Retry Failed', `Retry the latest failed Creator unit: ${stageLabel}.`, async (btn) => {
        await retryLoredeckCreatorRecoverableUnit(unit, { smaller: false }, btn);
    }, 'saga-primary-button');
    actions.appendChild(retryButton);

    const smallerButton = createButton(
        'Retry Smaller',
        smallerConfig
            ? `Retry ${stageLabel} with a smaller request: ${smallerConfig.label}.`
            : `${stageLabel} cannot be reduced into a smaller unit.`,
        async (btn) => {
            await retryLoredeckCreatorRecoverableUnit(unit, { smaller: true }, btn);
        }
    );
    smallerButton.disabled = !smallerConfig;
    actions.appendChild(smallerButton);
    return true;
}

function getLoredeckCreatorPipelineModel(cached = {}) {
    const outline = getLoredeckCreatorOutline(cached);
    const titleSets = getLoredeckCreatorTitleBatchRows(cached);
    const draftedTitleSetIds = getLoredeckCreatorTitleDraftedBatchIds(cached);
    const draftedTitleSetCount = titleSets.filter(batch => draftedTitleSetIds.has(batch.id)).length;
    const approvedTitles = getLoredeckCreatorApprovedTitleDrafts(cached);
    const generatedPack = cached.generatedPackId ? getLoredeckDefinition(cached.generatedPackId) : null;
    const planningSets = getLoredeckCreatorPlanningBatchRows(cached);
    const eligiblePlanningSets = planningSets.filter(batch => batch.approvedTitleCount > 0);
    const plannedSetIds = getLoredeckCreatorPlanningQueuedBatchIds(cached);
    const plannedSetCount = eligiblePlanningSets.filter(batch => plannedSetIds.has(batch.id)).length;
    const acceptedPlanningSetIds = getLoredeckCreatorPlanningAcceptedBatchIds(cached);
    const acceptedPlanningSetCount = eligiblePlanningSets.filter(batch => acceptedPlanningSetIds.has(batch.id)).length;
    const draftChanges = generatedPack ? getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(generatedPack.packId) || {}) : [];
    const pendingEntryCount = generatedPack ? getLoredeckPendingChanges(generatedPack).filter(change => (change.affectedEntryIds || []).length).length : 0;
    const pipeline = generatedPack ? getLoredeckCreatorPipelineReadiness(generatedPack, cached) : null;
    const readiness = generatedPack ? getGeneratedLoredeckExportReadiness(generatedPack, null, cached) : null;
    const titleSetTotal = titleSets.length || (outline ? 1 : 0);
    const eligiblePlanningTotal = eligiblePlanningSets.length || (approvedTitles.length ? 1 : 0);
    const pendingChanges = generatedPack ? getLoredeckPendingChanges(generatedPack) : [];
    const pendingPlanningCount = pendingChanges.filter(change => change.preview?.creatorPlanningBatch || change.preview?.timelineRegistry || change.preview?.tagRegistry).length;
    const pendingLorecardCount = pendingChanges.filter(change => (change.affectedEntryIds || []).length).length;
    const repairCount = pendingChanges.filter(change => change.source === 'safe_repair' || change.source === 'loredeck_assistant_repair').length;
    const activeGeneration = getActiveLoredeckCreatorGeneration(cached);
    const briefComplete = !!cached.approved && !!cached.brief;
    const outlineComplete = !!cached.outlineApproved && !!outline;
    const titleSetsComplete = outlineComplete && titleSetTotal > 0 && draftedTitleSetCount >= titleSetTotal;
    const titleReviewComplete = titleSetsComplete && approvedTitles.length > 0;
    const planningComplete = titleReviewComplete && eligiblePlanningTotal > 0 && acceptedPlanningSetCount >= eligiblePlanningTotal;
    const lorecardsComplete = !!pipeline && pipeline.approvedTitleCount > 0 && pipeline.approvedTitleAcceptedCount >= pipeline.approvedTitleCount;
    const hasHealthBlockers = !!readiness && ((readiness.blockers || []).length > 0 || (readiness.errors || []).length > 0);
    const hasHealthWarnings = !!readiness && (readiness.warnings || []).length > 0;
    const healthReady = !!readiness?.ready && !hasHealthBlockers && !draftChanges.length && !pendingChanges.length;
    const isGenerating = (...actionIds) => activeGeneration?.actionId && actionIds.includes(activeGeneration.actionId);
    const errors = Array.isArray(cached.errors) ? cached.errors : [];
    const stages = [
        {
            id: 'scope',
            label: 'Scope Brief',
            status: errors.length && !cached.brief ? 'error' : (isGenerating('brief_draft', 'brief_revision') ? 'generating' : (briefComplete ? 'approved' : (cached.brief ? 'needs-review' : 'ready'))),
            detail: briefComplete ? 'Approved' : (cached.brief ? 'Needs approval' : 'Ready'),
            dependency: '',
            anchor: cached.brief ? 'scope-brief' : 'intake',
        },
        {
            id: 'outline',
            label: 'Story Outline',
            status: !briefComplete ? 'locked' : (isGenerating('outline_draft', 'outline_revision') ? 'generating' : (outlineComplete ? 'approved' : (outline ? 'needs-review' : 'ready'))),
            detail: !briefComplete ? 'Locked' : (outlineComplete ? 'Approved' : (outline ? 'Needs approval' : 'Ready')),
            dependency: 'Story Outline is locked until the Scope Brief is approved.',
            anchor: outline ? 'story-outline' : 'current-task',
        },
        {
            id: 'titles',
            label: 'Title Pass',
            status: !outlineComplete ? 'locked' : (isGenerating('title_batch_draft', 'title_batch_redraft', 'title_revision') ? 'generating' : (titleReviewComplete ? 'approved' : (titleDraftCount(cached) ? 'needs-review' : 'ready'))),
            detail: !outlineComplete
                ? 'Locked'
                : (titleReviewComplete ? `${approvedTitles.length} approved` : (titleSetTotal ? `${draftedTitleSetCount}/${titleSetTotal} drafted` : 'Ready')),
            dependency: 'Title Pass is locked until the Story Outline is approved.',
            anchor: 'title-sets',
        },
        {
            id: 'context',
            label: 'Context Plan',
            status: !titleReviewComplete ? 'locked' : (isGenerating('planning_batch_draft', 'planning_batch_redraft') ? 'generating' : (planningComplete ? 'approved' : (plannedSetCount > acceptedPlanningSetCount ? 'needs-review' : 'ready'))),
            detail: !titleReviewComplete
                ? 'Locked'
                : `${acceptedPlanningSetCount}/${eligiblePlanningTotal} accepted`,
            dependency: 'Context Plan is locked until selected titles are approved.',
            anchor: 'context-plan',
        },
        {
            id: 'lorecards',
            label: 'Lorecards',
            status: !planningComplete ? 'locked' : (isGenerating('entry_batch_draft', 'entry_multi_batch_draft') ? 'generating' : (lorecardsComplete ? 'approved' : (draftChanges.length ? 'needs-review' : 'ready'))),
            detail: !planningComplete
                ? 'Locked'
                : (lorecardsComplete
                    ? 'Approved'
                    : (draftChanges.length ? `${draftChanges.length} drafts` : `${pipeline?.remainingEntryCount || approvedTitles.length} remaining`)),
            dependency: 'Lorecards are locked until Context and Tag proposals are accepted.',
            anchor: 'lorecards',
        },
        {
            id: 'review',
            label: 'Review Queue',
            status: draftChanges.length || pendingChanges.length ? 'needs-review' : 'empty',
            detail: pendingChanges.length ? `${pendingChanges.length} pending` : (draftChanges.length ? `${draftChanges.length} drafts` : 'Empty'),
            dependency: '',
            anchor: 'review-queue',
        },
        {
            id: 'health',
            label: 'Deck Health',
            status: !generatedPack ? 'not-ready' : (hasHealthBlockers ? 'blocked' : (healthReady ? 'approved' : (hasHealthWarnings || readiness ? 'needs-review' : 'ready'))),
            detail: !generatedPack ? 'Not ready' : (healthReady ? 'Ready' : (hasHealthBlockers ? 'Blocked' : (hasHealthWarnings ? 'Warnings' : 'Run scan'))),
            dependency: generatedPack ? '' : 'Deck Health is available after Saga creates the Generated Loredeck shell.',
            anchor: 'deck-health',
        },
        {
            id: 'finalize',
            label: 'Finalize',
            status: healthReady ? 'ready' : 'locked',
            detail: healthReady ? 'Ready' : 'Locked',
            dependency: 'Finalize is locked until Lorecards are reviewed, Pending Review is clear, and Deck Health is ready.',
            anchor: 'finalize',
        },
    ];
    const currentStep = stages.find(stage => ['generating', 'error', 'blocked', 'needs-review', 'ready'].includes(stage.status)) || stages[stages.length - 1];
    const statusLine = currentStep.status === 'generating'
        ? `${activeGeneration.label || currentStep.label} running`
        : `${currentStep.label}: ${currentStep.detail}`;
    return {
        cached,
        outline,
        titleSets,
        draftedTitleSetCount,
        titleSetTotal,
        approvedTitles,
        generatedPack,
        planningSets,
        plannedSetCount,
        acceptedPlanningSetCount,
        eligiblePlanningTotal,
        draftChanges,
        pendingChanges,
        pendingPlanningCount,
        pendingLorecardCount,
        repairCount,
        pendingEntryCount,
        pipeline,
        readiness,
        briefComplete,
        outlineComplete,
        titleReviewComplete,
        planningComplete,
        lorecardsComplete,
        healthReady,
        activeGeneration,
        stages,
        currentStep,
        statusLine,
    };
}

function titleDraftCount(cached = {}) {
    return getLoredeckCreatorTitleDrafts(cached).length;
}

function createLoredeckCreatorCurrentTaskActions(cached = {}, pipeline = {}, context = {}) {
    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-creator-current-actions';
    const active = getActiveLoredeckCreatorGeneration(cached);
    if (active) {
        actions.appendChild(createButton('Cancel Generation', 'Cancel this generation. Any late provider response will be ignored.', () => {
            cancelLoredeckCreatorGeneration(active.id);
        }, 'saga-danger-button'));
        return actions;
    }
    appendLoredeckCreatorRecoveryActionButtons(actions, cached);
    const step = pipeline.currentStep || {};
    const addSecondary = (label, tooltip, anchor) => {
        actions.appendChild(createButton(label, tooltip, () => {
            scrollLoredeckCreatorWorkbenchToAnchor(anchor);
        }));
    };
    if (step.id === 'scope') {
        if (!cached.brief) {
            const draft = createButton('Draft Scope Brief', 'Generate the reviewable Scope Brief from the project inputs.', async (btn) => {
                const refs = context.intakeRefs || {};
                loredeckCreatorFandom = refs.fandomInput?.value?.trim() || loredeckCreatorFandom || cached.fandom || '';
                loredeckCreatorScope = refs.scopeInput?.value?.trim() || loredeckCreatorScope || cached.scope || '';
                loredeckCreatorGranularity = refs.granularitySelect?.value || cached.granularity || loredeckCreatorGranularity || 'focused';
                loredeckCreatorNotes = refs.notesInput?.value?.trim() || loredeckCreatorNotes || cached.notes || '';
                await handleLoredeckCreatorBriefDraft({
                    fandom: loredeckCreatorFandom,
                    scope: loredeckCreatorScope,
                    granularity: loredeckCreatorGranularity,
                    notes: loredeckCreatorNotes,
                }, btn);
            }, 'saga-primary-button');
            actions.appendChild(applyLoredeckCreatorGenerationButtonLock(draft, cached, 'scope brief draft'));
            addSecondary('Project Inputs', 'Jump to the project input fields.', 'intake');
        } else {
            actions.appendChild(createButton('Approve Scope Brief', 'Approve this Scope Brief and unlock Story Outline.', () => {
                approveLoredeckCreatorBrief();
            }, 'saga-primary-button'));
            addSecondary('Revise Scope Brief', 'Jump to the Scope Brief revision controls.', 'scope-brief');
        }
    } else if (step.id === 'outline') {
        if (!pipeline.outline) {
            const draftOutline = createButton('Draft Story Outline', 'Generate major story beats, Context milestones, title-batch slices, and risk notes.', async (btn) => {
                await handleLoredeckCreatorOutlineDraft({}, btn);
            }, 'saga-primary-button');
            actions.appendChild(applyLoredeckCreatorGenerationButtonLock(draftOutline, cached, 'story outline draft'));
            addSecondary('View Scope Brief', 'Open the approved Scope Brief supporting artifact.', 'scope-brief');
        } else {
            actions.appendChild(createButton('Approve Outline and Unlock Title Pass', 'Approve this Story Outline for title-pass generation.', () => {
                approveLoredeckCreatorOutline();
            }, 'saga-primary-button'));
            addSecondary('Revise Outline', 'Jump to Story Outline revision controls.', 'story-outline');
        }
    } else if (step.id === 'titles') {
        const nextTitleBatch = getLoredeckCreatorNextTitleBatch(cached);
        const label = nextTitleBatch ? 'Generate Next Title Batch' : 'Approve Selected Titles';
        const titleButton = createButton(label, nextTitleBatch ? 'Generate the next planned title batch.' : 'Approve selected title drafts for Context planning.', async (btn) => {
            const fresh = getLoredeckCreatorBriefCache();
            const batch = getLoredeckCreatorNextTitleBatch(fresh);
            if (batch) {
                await handleLoredeckCreatorTitleDraft({
                    brief: fresh.brief || cached.brief || {},
                    notes: fresh.notes || loredeckCreatorNotes,
                    targetTitleBatch: batch,
                    previousTitleDrafts: getLoredeckCreatorTitleDrafts(fresh).map(compactLoredeckCreatorTitleDraftForRevision),
                }, btn);
            } else {
                approveLoredeckCreatorTitleSelection(getLoredeckCreatorSelectedTitleIds(fresh));
            }
        }, 'saga-primary-button');
        titleButton.disabled = !nextTitleBatch && !getLoredeckCreatorSelectedTitleIds(cached).size;
        actions.appendChild(applyLoredeckCreatorGenerationButtonLock(titleButton, cached, 'title pass'));
        addSecondary('Open Title Table', 'Jump to the Title Pass review table.', 'title-sets');
    } else if (step.id === 'context') {
        const nextPlanningBatch = getLoredeckCreatorNextPlanningBatch(cached);
        const pendingPlanningCount = Number(pipeline.pendingPlanningCount || 0);
        const planButton = createButton(
            nextPlanningBatch ? 'Plan Context and Tags' : (pendingPlanningCount ? 'Review Context and Tags' : 'Open Pending Review'),
            nextPlanningBatch
                ? 'Draft timeline and tag proposals for the next accepted title set.'
                : (pendingPlanningCount ? 'Review and accept pending Context and Tag proposals so Lorecard drafting can unlock.' : 'Open the pending proposal queue for acceptance.'),
            async (btn) => {
            const fresh = getLoredeckCreatorBriefCache();
            const batch = getLoredeckCreatorNextPlanningBatch(fresh);
            if (batch) {
                await handleLoredeckCreatorPlanningDraft({
                    targetPlanningBatch: batch,
                }, btn);
            } else {
                scrollLoredeckCreatorWorkbenchToAnchor('review-queue');
            }
        }, 'saga-primary-button');
        actions.appendChild(applyLoredeckCreatorGenerationButtonLock(planButton, cached, 'Context and Tag planning'));
        addSecondary('Open Context Plan', 'Jump to Context and Tag planning details.', 'context-plan');
    } else if (step.id === 'lorecards') {
        if (pipeline.draftChanges?.length) {
            addSecondary('Review Draft Batch', 'Jump to the Creator Lorecard Draft Review section.', 'lorecards');
        } else {
            const draftEntries = createButton('Draft Lorecards', 'Draft the next small Lorecard batch from accepted Context and Tag metadata.', async (btn) => {
                await handleLoredeckCreatorEntryDraft(btn);
            }, 'saga-primary-button');
            actions.appendChild(applyLoredeckCreatorGenerationButtonLock(draftEntries, cached, 'Lorecard drafting'));
        }
        addSecondary('Open Review Queue', 'Jump to Pending Review status.', 'review-queue');
    } else if (step.id === 'review') {
        actions.appendChild(createButton('Open Review Queue', 'Jump to reviewable Creator drafts and Pending Review items.', () => {
            scrollLoredeckCreatorWorkbenchToAnchor('review-queue');
        }, 'saga-primary-button'));
    } else if (step.id === 'health') {
        const pack = pipeline.generatedPack;
        const validateButton = createButton('Run Deck Health', 'Validate the Generated Loredeck with the same rules used at runtime.', async (btn) => {
            if (!pack) {
                toast('Create a Generated Loredeck shell before running Deck Health.', 'warning');
                return;
            }
            await validateLoredeckForEditor(pack, btn);
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });
        }, 'saga-primary-button');
        validateButton.disabled = !pack;
        actions.appendChild(validateButton);
        if (pack) actions.appendChild(createButton('Open Health Center', 'Open the fullscreen Deck Health Center for this Generated Loredeck.', () => openLoredeckHealthCenter(pack.packId)));
    } else if (step.id === 'finalize') {
        const pack = pipeline.generatedPack;
        const finalizeButton = createButton('Finalize as Custom Loredeck', 'Validate and convert this reviewed Generated Loredeck into an editable Custom Loredeck.', async (btn) => {
            if (!pack) return;
            await finalizeGeneratedLoredeckAsCustom(pack, btn);
        }, 'saga-primary-button');
        finalizeButton.disabled = !pipeline.healthReady || !pack;
        actions.appendChild(finalizeButton);
    }
    return actions;
}

function createLoredeckCreatorGenerationRangeRow(settings = {}, key = '', labelText = '', tooltip = '', options = {}) {
    const [min, max] = LOREDECK_CREATOR_GENERATION_SETTING_LIMITS[key] || [0, 10];
    const suffix = options.suffix || '';
    const row = document.createElement('label');
    row.className = 'saga-loredeck-creator-generation-row';
    const label = document.createElement('span');
    label.className = 'saga-loredeck-creator-generation-label';
    addTooltip(label, tooltip);
    const value = document.createElement('strong');
    const renderLabel = nextValue => {
        value.textContent = `${nextValue}${suffix}`;
        label.replaceChildren(document.createTextNode(`${labelText}: `), value);
    };
    const initial = clampLoredeckCreatorInteger(settings[key], min, max, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS[key]);
    renderLabel(initial);
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(initial);
    input.dataset.sagaCreatorGenerationSetting = key;
    input.addEventListener('input', () => {
        renderLabel(clampLoredeckCreatorInteger(input.value, min, max, initial));
    });
    input.addEventListener('change', () => {
        const nextValue = clampLoredeckCreatorInteger(input.value, min, max, initial);
        input.value = String(nextValue);
        renderLabel(nextValue);
        setLoredeckCreatorGenerationSettings({ [key]: nextValue });
    });
    row.appendChild(input);
    return {
        element: row,
        setValue(nextSettings = {}) {
            const nextValue = clampLoredeckCreatorInteger(nextSettings[key], min, max, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS[key]);
            input.value = String(nextValue);
            renderLabel(nextValue);
        },
    };
}

function createLoredeckCreatorGenerationToggleRow(settings = {}, key = '', labelText = '', tooltip = '') {
    const row = document.createElement('label');
    row.className = 'saga-loredeck-creator-generation-toggle';
    addTooltip(row, tooltip);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = settings[key] !== false;
    input.dataset.sagaCreatorGenerationSetting = key;
    row.appendChild(input);
    const label = document.createElement('span');
    label.textContent = labelText;
    row.appendChild(label);
    const state = document.createElement('strong');
    const renderState = () => {
        state.textContent = input.checked ? 'On' : 'Off';
    };
    renderState();
    row.appendChild(state);
    input.addEventListener('change', () => {
        renderState();
        setLoredeckCreatorGenerationSettings({ [key]: input.checked });
    });
    return {
        element: row,
        setValue(nextSettings = {}) {
            input.checked = nextSettings[key] !== false;
            renderState();
        },
    };
}

function createLoredeckCreatorAdvancedGenerationSettings(cached = {}) {
    const settings = getLoredeckCreatorGenerationSettings(cached);
    const body = document.createElement('div');
    body.className = 'saga-loredeck-creator-generation-settings';
    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${settings.titleBatchLimit} titles/call`, 'Maximum title drafts requested in one Title Pass call.'));
    summary.appendChild(createStatusPill(`${settings.entryBatchSize} Lorecards/call`, 'Maximum Lorecards requested in one Lorecard drafting call.'));
    summary.appendChild(createStatusPill(`${settings.retryAttempts} retry${settings.retryAttempts === 1 ? '' : 'ies'}`, 'Automatic retry attempts for failed units before surfacing failure.'));
    summary.appendChild(createStatusPill(settings.showStreamingProgress ? 'Streaming snippets on' : 'Streaming snippets off', 'Whether active model calls show short transient streaming snippets.'));
    body.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Advanced controls for provider reliability and batching. Smaller values cost more calls but reduce overlong-response failures.';
    body.appendChild(help);

    const rows = [];
    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-creator-generation-grid';
    for (const row of [
        createLoredeckCreatorGenerationRangeRow(settings, 'titleBatchLimit', 'Title batch limit', 'Maximum title drafts Saga asks for in one Title Pass provider call.'),
        createLoredeckCreatorGenerationRangeRow(settings, 'planningProposalLimit', 'Planning proposals', 'Maximum Context and Tag proposals Saga asks for in one planning call.'),
        createLoredeckCreatorGenerationRangeRow(settings, 'entryBatchSize', 'Lorecards per call', 'Maximum full Lorecards Saga asks for in one micro-batch call.'),
        createLoredeckCreatorGenerationRangeRow(settings, 'titleRunRemainingLimit', 'Title run limit', 'Maximum separate title-batch calls made by Generate Remaining.'),
        createLoredeckCreatorGenerationRangeRow(settings, 'entryRunRemainingLimit', 'Lorecard run limit', 'Maximum separate Lorecard calls made by Auto-Draft before review or failure stops the run.'),
        createLoredeckCreatorGenerationRangeRow(settings, 'retryAttempts', 'Retry attempts', 'Automatic retry attempts after a malformed, empty, or failed generation unit.'),
    ]) {
        rows.push(row);
        grid.appendChild(row.element);
    }
    body.appendChild(grid);

    const toggles = document.createElement('div');
    toggles.className = 'saga-loredeck-creator-generation-toggles';
    for (const row of [
        createLoredeckCreatorGenerationToggleRow(settings, 'retrySmaller', 'Prefer smaller retries', 'When a failed unit is retried smaller, prefer splitting it into a lower-size replacement unit.'),
        createLoredeckCreatorGenerationToggleRow(settings, 'showStreamingProgress', 'Show streaming progress snippets', 'Show short transient snippets while a provider call is running. Completed raw output is not rendered.'),
    ]) {
        rows.push(row);
        toggles.appendChild(row.element);
    }
    body.appendChild(toggles);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Reset Advanced Settings', 'Restore conservative Creator generation defaults.', () => {
        const next = resetLoredeckCreatorGenerationSettings()?.generationSettings || { ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS };
        for (const row of rows) row.setValue(next);
        toast('Creator generation settings reset.', 'info');
    }));
    body.appendChild(actions);

    return createLoredeckCreatorArtifactDisclosure(
        'Advanced Generation Settings',
        body,
        { open: false, state: 'Batching & retries', anchor: 'advanced-generation' }
    );
}

function createLoredeckCreatorCard(state = getState(), options = {}) {
    void state;
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-loredeck-creator-card';

    const cached = getLoredeckCreatorBriefCache();
    const currentFandom = loredeckCreatorFandom || cached.fandom || '';
    const currentScope = loredeckCreatorScope || cached.scope || '';
    const currentGranularity = cached.granularity || loredeckCreatorGranularity || 'focused';
    const currentNotes = loredeckCreatorNotes || cached.notes || '';
    const pipeline = getLoredeckCreatorPipelineModel(cached);
    const outline = getLoredeckCreatorOutline(cached);

    if (options.showHeader !== false) {
        card.appendChild(createLoredeckCreatorPipelineHeader(cached, pipeline, { showClose: options.embedded === true }));
    }
    card.appendChild(createLoredeckCreatorStageGuide(cached, pipeline));

    if (options.embedded !== true) {
        const launcher = document.createElement('div');
        launcher.className = 'saga-loredeck-creator-launch-row';
        const launcherText = document.createElement('div');
        launcherText.className = 'saga-loredeck-creator-launch-text';
        launcherText.textContent = 'Open the Creator as a staged fullscreen wizard.';
        addTooltip(launcherText, 'The Creator belongs in a larger review-first workspace, similar to the Lorecard Workbench.');
        launcher.appendChild(launcherText);
        launcher.appendChild(createButton('Open Creator Wizard', 'Open the fullscreen Loredeck Creator wizard.', () => {
            openLoredeckCreatorWorkbench();
        }, 'saga-primary-button'));
        card.appendChild(launcher);
        return card;
    }

    let intakeForm = null;
    let intakeRefs = null;
    if (!cached.approved) {
        intakeForm = document.createElement('div');
        intakeForm.className = 'saga-new-lore-form saga-loredeck-creator-form';
        intakeForm.dataset.sagaCreatorAnchor = 'intake';
        const intakeHeader = document.createElement('div');
        intakeHeader.className = 'saga-loredeck-creator-form-header';
        const intakeTitle = document.createElement('div');
        intakeTitle.className = 'saga-loredeck-creator-form-title';
        intakeTitle.textContent = 'Project Inputs';
        intakeHeader.appendChild(intakeTitle);
        intakeForm.appendChild(intakeHeader);
        const fandomInput = createNewLoreInput(intakeForm, 'Fandom', 'Fandom, universe, or canon family.', currentFandom, false, 'One Piece');
        const scopeInput = createNewLoreInput(intakeForm, 'Scope', 'Story range, arc, season, issue run, game act, or scenario slice.', currentScope, true, 'Arlong Park Arc');
        const grid = document.createElement('div');
        grid.className = 'saga-new-lore-meta-grid';
        intakeForm.appendChild(grid);
        const granularitySelect = createNewLoreSelect(grid, 'Granularity', ['compact', 'focused', 'dense', 'scene_dense'], currentGranularity, formatLoredeckCreatorGranularity);
        const granularityBlurb = document.createElement('div');
        granularityBlurb.className = 'saga-loredeck-granularity-blurb';
        granularityBlurb.textContent = getLoredeckCreatorGranularityBlurb(currentGranularity);
        addTooltip(granularityBlurb, 'Granularity controls how far Saga zooms into the story when deriving Lorecard titles and metadata.');
        grid.appendChild(granularityBlurb);
        granularitySelect.addEventListener('change', () => {
            granularityBlurb.textContent = getLoredeckCreatorGranularityBlurb(granularitySelect.value);
        });
        const notesInput = createNewLoreInput(intakeForm, 'Notes', 'Optional desired focus, exclusions, AU premise, or creator guidance.', currentNotes, true, 'Focus on playable secrets, pressure, relationships, and timing. Avoid broad wiki biography.');
        intakeRefs = { fandomInput, scopeInput, granularitySelect, notesInput };
    }

    if (intakeForm) card.appendChild(intakeForm);
    card.appendChild(createLoredeckCreatorCurrentTaskCard(cached, pipeline, { intakeRefs }));
    card.appendChild(createLoredeckCreatorAdvancedGenerationSettings(cached));

    if (cached.summary || cached.questions?.length || cached.warnings?.length) {
        const result = document.createElement('div');
        result.className = 'saga-loredeck-creator-inline-note';
        const parts = [];
        if (cached.summary) parts.push(cached.summary);
        if (cached.questions?.length) parts.push(`Questions: ${cached.questions.join(' | ')}`);
        if (cached.warnings?.length) parts.push(`Warnings: ${cached.warnings.join(' | ')}`);
        result.textContent = parts.join(' ');
        card.appendChild(result);
    }

    if (cached.brief) {
        card.appendChild(createLoredeckCreatorArtifactDisclosure(
            cached.approved ? 'Approved: Scope Brief' : 'Scope Brief Review',
            createLoredeckCreatorBriefReview(cached.brief, cached),
            { open: cached.approved !== true, state: cached.approved ? 'Approved' : 'Needs review', anchor: 'scope-brief' }
        ));
        if (cached.approved) {
            card.appendChild(createLoredeckCreatorArtifactDisclosure(
                outline ? (cached.outlineApproved ? 'Approved: Story Outline' : 'Story Outline Review') : 'Story Outline',
                createLoredeckCreatorOutlineCard(cached.brief, cached),
                { open: !!outline && cached.outlineApproved !== true, state: outline ? (cached.outlineApproved ? 'Approved' : 'Needs review') : 'Ready', anchor: 'story-outline' }
            ));
            if (cached.outlineApproved && outline) {
                const generatedPack = cached.generatedPackId ? getLoredeckDefinition(cached.generatedPackId) : null;
                card.appendChild(createLoredeckCreatorArtifactDisclosure(
                    'Title Pass',
                    createLoredeckCreatorTitlePassCard(cached.brief, cached),
                    { open: pipeline.currentStep.id === 'titles', state: pipeline.stages.find(stage => stage.id === 'titles')?.detail || 'Ready', anchor: 'title-sets' }
                ));
                card.appendChild(createLoredeckCreatorArtifactDisclosure(
                    'Context Plan',
                    createLoredeckCreatorPlanningCard(cached.brief, cached),
                    { open: pipeline.currentStep.id === 'context', state: pipeline.stages.find(stage => stage.id === 'context')?.detail || 'Locked', anchor: 'context-plan' }
                ));
                if (generatedPack && pipeline.pendingChanges.length) {
                    const pendingReviewCard = createLoredeckCreatorPendingReviewCard(cached, pipeline);
                    if (pendingReviewCard) {
                        card.appendChild(createLoredeckCreatorArtifactDisclosure(
                            'Pending Review',
                            pendingReviewCard,
                            { open: ['context', 'review'].includes(pipeline.currentStep.id), state: `${pipeline.pendingChanges.length} pending`, anchor: 'review-queue' }
                        ));
                    }
                }
                card.appendChild(createLoredeckCreatorArtifactDisclosure(
                    'Lorecards',
                    createLoredeckCreatorEntryDraftCard(cached.brief, cached),
                    { open: pipeline.currentStep.id === 'lorecards', state: pipeline.stages.find(stage => stage.id === 'lorecards')?.detail || 'Locked', anchor: 'lorecards' }
                ));
                if (generatedPack) {
                    card.appendChild(createLoredeckCreatorArtifactDisclosure(
                        'Deck Health and Finalize',
                        createLoredeckCreatorPipelineReadinessCard(generatedPack, cached),
                        { open: ['health', 'finalize'].includes(pipeline.currentStep.id), state: pipeline.stages.find(stage => stage.id === 'health')?.detail || 'Not ready', anchor: 'deck-health' }
                    ));
                }
            }
        }
    }
    return card;
}

function getLoredeckCreatorBriefCache() {
    const stateJob = getActiveLoredeckCreatorJob(getState());
    const localJob = loredeckCreatorBriefCache.get('current') || {};
    if (!stateJob) return attachLoredeckCreatorLiveGeneration(localJob || {});
    if (localJob?.jobId && stateJob?.jobId && localJob.jobId !== stateJob.jobId) {
        return attachLoredeckCreatorLiveGeneration(stateJob);
    }
    return attachLoredeckCreatorLiveGeneration({
        ...stateJob,
        ...(localJob?.activeGeneration ? { activeGeneration: localJob.activeGeneration } : {}),
        ...(localJob?.lastGenerationResult ? { lastGenerationResult: localJob.lastGenerationResult } : {}),
    });
}

function setLoredeckCreatorBriefCache(next = {}, options = {}) {
    const current = getLoredeckCreatorBriefCache();
    const hasActiveGenerationPatch = Object.prototype.hasOwnProperty.call(next || {}, 'activeGeneration');
    const normalized = {
        ...(current || {}),
        ...(next || {}),
        updatedAt: Date.now(),
    };
    normalized.currentStage = inferLoredeckCreatorUiStage(normalized);
    const result = upsertLoredeckCreatorJob(normalized, { syncPrompt: false });
    if (result.ok) {
        const active = normalized.activeGeneration?.status === 'running'
            ? rememberLoredeckCreatorLiveGeneration(result.job.jobId, {
                ...normalized.activeGeneration,
                currentStage: normalized.currentStage || normalized.activeGeneration.currentStage || result.job.currentStage || '',
            })
            : null;
        if (!active && hasActiveGenerationPatch && normalized.activeGeneration === null) {
            const previousActive = current?.activeGeneration;
            forgetLoredeckCreatorLiveGeneration(previousActive || { jobId: result.job.jobId });
        }
        const localJob = {
            ...result.job,
            ...(active ? { activeGeneration: active } : {}),
            ...(normalized.lastGenerationResult ? { lastGenerationResult: normalized.lastGenerationResult } : {}),
        };
        loredeckCreatorBriefCache.set('current', localJob);
        if (!options.suppressWorkbenchRefresh && (result.job.status !== 'running' || options.refreshWorkbench)) queueLoredeckCreatorWorkbenchRefresh();
        return localJob;
    }
    console.warn('[Saga] Loredeck Creator job persistence failed:', result.error);
    const active = normalized.activeGeneration?.status === 'running'
        ? rememberLoredeckCreatorLiveGeneration(normalized.jobId || current?.jobId || '', normalized.activeGeneration)
        : null;
    loredeckCreatorBriefCache.set('current', normalized);
    if (!options.suppressWorkbenchRefresh && (normalized.status !== 'running' || options.refreshWorkbench)) queueLoredeckCreatorWorkbenchRefresh();
    return active ? { ...normalized, activeGeneration: active } : normalized;
}

function clearLoredeckCreatorBrief() {
    const cached = getLoredeckCreatorBriefCache();
    const active = getActiveLoredeckCreatorGeneration(cached);
    if (active?.id) {
        try {
            loredeckCreatorGenerationControllers.get(active.id)?.abort?.();
        } catch (_) {}
        loredeckCreatorGenerationControllers.delete(active.id);
        forgetLoredeckCreatorLiveGeneration(active);
        stopLoredeckCreatorGenerationTicker();
    }
    if (cached.jobId) clearLoredeckCreatorJob(cached.jobId, { syncPrompt: false });
    loredeckCreatorBriefCache.delete('current');
    loredeckCreatorFandom = '';
    loredeckCreatorScope = '';
    loredeckCreatorGranularity = 'focused';
    loredeckCreatorNotes = '';
    loredeckCreatorRevisionInstruction = '';
    loredeckCreatorOutlineRevisionInstruction = '';
    loredeckCreatorTitleRevisionInstruction = '';
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshLoredeckCreatorWorkbenchBody({ preserveScroll: false });
    toast('Loredeck Creator brief cleared.', 'info');
}

function inferLoredeckCreatorUiStage(job = {}) {
    if (job.status === 'running' && job.currentStage) return job.currentStage;
    if (job.entryDraftCount || job.entryDraftedAt) return 'entries_drafted';
    if (job.generatedPackId && (job.planningQueuedCount || job.planningQueuedAt)) return 'planning_queued';
    if (Array.isArray(job.approvedTitleDraftIds) && job.approvedTitleDraftIds.length) return 'titles_approved';
    if (Array.isArray(job.titleDrafts) && job.titleDrafts.length) return 'titles_drafted';
    if (job.outlineApproved && job.outline) return 'outline_approved';
    if (job.outline) return 'outline_drafted';
    if (job.approved) return 'brief_approved';
    if (job.brief) return 'brief_drafted';
    return 'intake';
}

function formatLoredeckCreatorGranularity(value = '') {
    const known = {
        compact: 'Constellation View',
        focused: 'Chapter Lens',
        dense: 'Scene Loom',
        scene_dense: 'Lantern Glass',
    };
    return known[String(value || '').trim()] || humanizeScopeKey(value || 'focused');
}

function getLoredeckCreatorGranularityBlurb(value = '') {
    const blurbs = {
        compact: 'Only the bright stars: eras, factions, core cast, and broad brushstrokes.',
        focused: 'A chapter-wise lens: the major beats, secrets, relationships, and pressure points.',
        dense: 'The scene loom: enough threads for recurring locations, motives, tensions, and reveals.',
        scene_dense: 'Lantern glass detail: close-up moments, tells, objects, and playable micro-lore.',
    };
    return blurbs[String(value || '').trim()] || blurbs.focused;
}

function clampLoredeckCreatorInteger(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeLoredeckCreatorGenerationSettings(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const output = { ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS };
    for (const [key, limits] of Object.entries(LOREDECK_CREATOR_GENERATION_SETTING_LIMITS)) {
        const [min, max] = limits;
        output[key] = clampLoredeckCreatorInteger(input[key], min, max, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS[key]);
    }
    output.retrySmaller = input.retrySmaller !== false;
    output.showStreamingProgress = input.showStreamingProgress !== false;
    return output;
}

function getLoredeckCreatorGenerationSettings(cached = getLoredeckCreatorBriefCache()) {
    return normalizeLoredeckCreatorGenerationSettings(cached?.generationSettings || {});
}

function setLoredeckCreatorGenerationSettings(patch = {}) {
    const cached = getLoredeckCreatorBriefCache();
    const next = normalizeLoredeckCreatorGenerationSettings({
        ...getLoredeckCreatorGenerationSettings(cached),
        ...(patch || {}),
    });
    return setLoredeckCreatorBriefCache({
        ...cached,
        generationSettings: next,
    }, { suppressWorkbenchRefresh: true });
}

function resetLoredeckCreatorGenerationSettings() {
    const cached = getLoredeckCreatorBriefCache();
    return setLoredeckCreatorBriefCache({
        ...cached,
        generationSettings: { ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS },
    }, { suppressWorkbenchRefresh: true });
}

function createLoredeckCreatorBriefRevisionForm(brief = {}, cached = {}) {
    const reviseForm = document.createElement('div');
    reviseForm.className = 'saga-new-lore-form saga-loredeck-creator-revise-form';
    const reviseInput = createNewLoreInput(reviseForm, 'Revision', 'Instruction for revising this brief before approval.', loredeckCreatorRevisionInstruction || '', true, 'Narrow this to Cocoyasi Village and Nami/Arlong pressure. Keep it focused rather than dense.');
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const reviseBriefButton = createButton('Revise Brief', 'Ask the Reasoning Provider to revise this Creator brief.', async (btn) => {
        loredeckCreatorRevisionInstruction = reviseInput.value.trim();
        await handleLoredeckCreatorBriefDraft({
            fandom: loredeckCreatorFandom || brief.fandom,
            scope: loredeckCreatorScope || brief.scope,
            granularity: loredeckCreatorGranularity || brief.granularity,
            notes: loredeckCreatorNotes,
            previousBrief: brief,
            revisionInstruction: loredeckCreatorRevisionInstruction,
        }, btn);
    });
    actions.appendChild(applyLoredeckCreatorGenerationButtonLock(reviseBriefButton, cached, 'brief revision'));
    reviseForm.appendChild(actions);
    return reviseForm;
}

function isLoredeckCreatorBriefRetryableError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return /response token limit|hit the response token limit|max[_ -]?token|length|truncated|reasoning-only|empty visible content/.test(message);
}

function markLoredeckCreatorOutlineFailed(error, fallbackMessage = 'Loredeck Creator outline response could not be parsed.') {
    const current = getLoredeckCreatorBriefCache();
    const message = String(error?.message || fallbackMessage || 'Loredeck Creator outline failed.').trim();
    setLoredeckCreatorBriefCache({
        ...(current || {}),
        outlineApproved: false,
        status: current?.approved ? 'approved' : 'draft',
        errors: [
            ...((current?.errors || []).slice(-20)),
            message || fallbackMessage,
        ],
        lastFailedAt: Date.now(),
    });
}

function markLoredeckCreatorActionFailed(error, fallbackMessage = 'Loredeck Creator action failed.') {
    const current = getLoredeckCreatorBriefCache();
    const message = String(error?.message || fallbackMessage || 'Loredeck Creator action failed.').trim();
    setLoredeckCreatorBriefCache({
        ...(current || {}),
        status: 'blocked',
        currentStage: 'blocked',
        errors: [
            ...((current?.errors || []).slice(-20)),
            message || fallbackMessage,
        ],
        lastFailedAt: Date.now(),
    });
}

async function requestLoredeckCreatorBriefResponse(context = {}, requestOptionsOverride = {}) {
    const systemPrompt = buildLoredeckCreatorBriefSystemPrompt();
    const userPrompt = buildLoredeckCreatorBriefUserPrompt(context);
    const requestOptions = { providerKind: 'lore', maxTokens: 1536, expectedOutput: 'json', ...requestOptionsOverride };
    try {
        return await sendLoreRequest(systemPrompt, userPrompt, requestOptions);
    } catch (error) {
        if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
        if (typeof requestOptions.onProgress === 'function') {
            requestOptions.onProgress({
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact scope brief after empty or oversized response...',
                streamSupported: requestOptions.stream === true,
            });
        }
        const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before a usable visible JSON object was returned.
- Return only the tiny scope-brief JSON object from the schema.
- Do not include generation plans, outline details, timeline anchors, tags, Lorecard titles, entry counts, or prose.`;
        const retryUserPrompt = `${userPrompt}

Return the compact scope brief now. If the request is too broad, return clarifyingQuestions with "brief": null.`;
        return await sendLoreRequest(retrySystemPrompt, retryUserPrompt, requestOptions);
    }
}

async function repairLoredeckCreatorBriefResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
    const systemPrompt = `You repair Saga Loredeck Creator intake output.

Return JSON only. Do not include markdown.

Convert the malformed or overlong response into the compact scope-brief contract. Do not preserve timeline plans, tag plans, title plans, entry counts, or Lorecard facts. If there is not enough usable information, ask 1-3 clarifyingQuestions and set brief null.`;
    const userPrompt = JSON.stringify({
        sourceInputs: {
            fandom: context.fandom || '',
            scope: context.scope || '',
            granularity: context.granularity || 'focused',
            notes: truncateText(context.notes || '', 700),
            revisionInstruction: truncateText(context.revisionInstruction || '', 700),
        },
        expectedShape: {
            summary: 'one sentence',
            clarifyingQuestions: [],
            warnings: [],
            brief: {
                title: 'string',
                packId: 'machine-safe-id',
                fandom: 'string',
                scope: 'string',
                granularity: 'compact|focused|dense|scene_dense',
                coverageSummary: 'under 60 words',
                assumptions: [],
                risks: [],
            },
        },
        malformedResponse: truncateText(responseText, 5000),
    });
    if (typeof requestOptionsOverride.onProgress === 'function') {
        requestOptionsOverride.onProgress({
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed response into compact Creator JSON...',
            streamSupported: requestOptionsOverride.stream === true,
        });
    }
    return await sendLoreRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 1024, expectedOutput: 'json', ...requestOptionsOverride });
}

async function requestLoredeckCreatorOutlineResponse(context = {}, requestOptionsOverride = {}) {
    const systemPrompt = buildLoredeckCreatorOutlineSystemPrompt();
    const userPrompt = buildLoredeckCreatorOutlineUserPrompt(context);
    const requestOptions = { providerKind: 'lore', maxTokens: 4096, expectedOutput: 'json', ...requestOptionsOverride };
    try {
        return await sendLoreRequest(systemPrompt, userPrompt, requestOptions);
    } catch (error) {
        if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
        if (typeof requestOptions.onProgress === 'function') {
            requestOptions.onProgress({
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact Story Outline after oversized or empty response...',
                streamSupported: requestOptions.stream === true,
            });
        }
        const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before a usable visible JSON object was returned.
- Return only the compact Story Outline JSON object from the schema.
- Use at most 8 beats, 8 Context milestones, and 5 titleBatches.
- Keep each summary/contextRole under 18 words.
- Do not include prose outside JSON.`;
        const retryUserPrompt = `${userPrompt}

Return the compact Story Outline now. If the approved Scope Brief is still too broad, return clarifyingQuestions with "outline": null.`;
        return await sendLoreRequest(retrySystemPrompt, retryUserPrompt, requestOptions);
    }
}

async function repairLoredeckCreatorOutlineResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
    const systemPrompt = `You repair Saga Loredeck Creator Story Outline output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, or overlong response into the compact Story Outline contract. Preserve only reviewable story beats, Context milestones, title-batch slices, assumptions, risks, and warnings. Do not generate Lorecards, Lorecard titles, tag registries, timeline registry records, facts, or injection text. If there is not enough usable information, ask 1-3 clarifyingQuestions and set outline null.`;
    const userPrompt = JSON.stringify({
        sourceInputs: {
            approvedBrief: context.brief || null,
            notes: truncateText(context.notes || '', 700),
            revisionInstruction: truncateText(context.revisionInstruction || '', 700),
            previousOutline: context.previousOutline || null,
        },
        expectedShape: {
            summary: 'one sentence',
            clarifyingQuestions: [],
            warnings: [],
            outline: {
                label: 'string',
                coverageSummary: 'under 70 words',
                beats: [{ id: 'machine-safe-id', label: 'string', type: 'beat', order: 10, summary: 'short sentence', contextRole: 'short sentence', titleTargets: [] }],
                contextMilestones: [{ id: 'machine-safe-id', label: 'string', type: 'before_after', order: 10, summary: 'short sentence', contextRole: 'short sentence' }],
                titleBatches: [{ id: 'machine-safe-id', label: 'string', type: 'title_batch', order: 10, summary: 'short sentence' }],
                assumptions: [],
                risks: [],
            },
        },
        limits: {
            beats: 8,
            contextMilestones: 8,
            titleBatches: 5,
            maxVisibleJsonTokens: 1600,
        },
        malformedResponse: truncateText(responseText, 7000),
    });
    if (typeof requestOptionsOverride.onProgress === 'function') {
        requestOptionsOverride.onProgress({
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Story Outline into compact Creator JSON...',
            streamSupported: requestOptionsOverride.stream === true,
        });
    }
    return await sendLoreRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 2048, expectedOutput: 'json', ...requestOptionsOverride });
}

async function requestLoredeckCreatorTitleResponse(context = {}, requestOptionsOverride = {}) {
    const systemPrompt = buildLoredeckCreatorTitleSystemPrompt();
    const userPrompt = buildLoredeckCreatorTitleUserPrompt(context);
    const requestOptions = {
        providerKind: 'lore',
        maxTokens: context.revisionInstruction ? 4096 : 4096,
        expectedOutput: 'json',
        ...requestOptionsOverride,
    };
    try {
        return await sendLoreRequest(systemPrompt, userPrompt, requestOptions);
    } catch (error) {
        if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
        if (typeof requestOptions.onProgress === 'function') {
            requestOptions.onProgress({
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact title set after oversized or empty response...',
                streamSupported: requestOptions.stream === true,
            });
        }
        const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before valid visible JSON was returned.
- Return only the compact Title Pass JSON object from the schema.
- Generate at most ${Math.max(1, Math.min(12, Number(context.titlePassLimit || 8)))} titles for the supplied targetTitleBatch.
- Omit rubric unless a title needs a specific quality warning; if included, use only wikiSummaryRisk and one useful key.
- Keep each reason under 18 words and each contextHint under 18 words.
- Do not include prose outside JSON.`;
        return await sendLoreRequest(retrySystemPrompt, userPrompt, requestOptions);
    }
}

async function repairLoredeckCreatorTitleResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
    const systemPrompt = `You repair Saga Loredeck Creator Title Pass output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, overlong, or structurally wrong response into the compact Title Pass contract. Preserve usable title drafts from the source. Do not generate Lorecards, facts, injection text, timeline anchors, timeline windows, or tag registries. If there is not enough usable title information, ask 1-3 clarifyingQuestions and return an empty titleDrafts array.`;
    const userPrompt = JSON.stringify({
        sourceInputs: {
            approvedBrief: context.brief || null,
            targetTitleBatch: context.targetTitleBatch || null,
            revisionInstruction: truncateText(context.revisionInstruction || '', 700),
            selectedTitleDrafts: Array.isArray(context.selectedTitleDrafts) ? context.selectedTitleDrafts.slice(0, 20) : [],
            titlePassLimit: Math.max(1, Math.min(12, Number(context.titlePassLimit || 8))),
        },
        expectedShape: {
            summary: 'one sentence',
            clarifyingQuestions: [],
            warnings: [],
            batch: {
                label: 'string',
                coverage: 'under 40 words',
                nextBatchHint: 'optional string',
                complete: false,
            },
            titleDrafts: [{
                titleId: 'machine-safe-id',
                title: 'string',
                category: 'string',
                priority: 80,
                relevance: 'high|medium|low',
                contextHint: 'short timing or activation hint',
                tags: ['namespaced:tag'],
                reason: 'short review rationale',
                rubric: { wikiSummaryRisk: 'low' },
                warnings: [],
            }],
        },
        limits: {
            titleDrafts: Math.max(1, Math.min(12, Number(context.titlePassLimit || 8))),
            maxReasonWords: 18,
            maxContextHintWords: 18,
            compactJson: true,
        },
        malformedResponse: truncateText(responseText, 9000),
    });
    if (typeof requestOptionsOverride.onProgress === 'function') {
        requestOptionsOverride.onProgress({
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Title Pass into compact Creator JSON...',
            streamSupported: requestOptionsOverride.stream === true,
        });
    }
    return await sendLoreRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 2048, expectedOutput: 'json', ...requestOptionsOverride });
}

async function requestLoredeckCreatorPlanningResponse(context = {}, requestOptionsOverride = {}) {
    const systemPrompt = buildLoredeckCreatorPlanningSystemPrompt();
    const userPrompt = buildLoredeckCreatorPlanningUserPrompt(context);
    const requestOptions = { providerKind: 'lore', maxTokens: 4096, expectedOutput: 'json', ...requestOptionsOverride };
    try {
        return await sendLoreRequest(systemPrompt, userPrompt, requestOptions);
    } catch (error) {
        if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
        if (typeof requestOptions.onProgress === 'function') {
            requestOptions.onProgress({
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact Context and Tag plan after oversized or empty response...',
                streamSupported: requestOptions.stream === true,
            });
        }
        const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before valid visible JSON was returned.
- Return only the compact proposal JSON object from the schema.
- Return at most ${Math.max(1, Math.min(24, Number(context.proposalLimit || 16)))} planning proposals.
- Supported actions only: upsert_timeline_anchor, upsert_timeline_window, upsert_tag_definition.
- Omit rubric unless a proposal needs a specific quality warning; if included, use only wikiSummaryRisk and one useful key.
- Keep each reason under 18 words.
- Do not include prose outside JSON.`;
        return await sendLoreRequest(retrySystemPrompt, userPrompt, requestOptions);
    }
}

async function repairLoredeckCreatorPlanningResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
    const systemPrompt = `You repair Saga Loredeck Creator Context and Tag planning output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, overlong, or structurally wrong response into the compact proposal contract. Preserve usable planning proposals from the source. Return only upsert_timeline_anchor, upsert_timeline_window, and upsert_tag_definition proposals. Do not generate Lorecards, facts, injection text, or entry overrides. If there is not enough usable planning information, ask 1-3 clarifyingQuestions and return an empty proposals array.`;
    const userPrompt = JSON.stringify({
        sourceInputs: {
            generatedPackId: context.generatedPackId || '',
            approvedBrief: context.brief || null,
            targetPlanningBatch: context.targetPlanningBatch || null,
            approvedTitleDrafts: Array.isArray(context.approvedTitleDrafts) ? context.approvedTitleDrafts.slice(0, 24) : [],
            existingTimelineIds: Array.isArray(context.existingTimelineIds) ? context.existingTimelineIds.slice(0, 120) : [],
            existingTagIds: Array.isArray(context.existingTagIds) ? context.existingTagIds.slice(0, 160) : [],
            proposalLimit: Math.max(1, Math.min(24, Number(context.proposalLimit || 16))),
        },
        expectedShape: {
            summary: 'one sentence',
            clarifyingQuestions: [],
            warnings: [],
            proposals: [{
                action: 'upsert_timeline_anchor|upsert_timeline_window|upsert_tag_definition',
                title: 'string',
                timelineId: 'optional-id',
                tagId: 'optional-id',
                timelineAnchor: 'object when action is upsert_timeline_anchor',
                timelineWindow: 'object when action is upsert_timeline_window',
                tagDefinition: 'object when action is upsert_tag_definition',
                reason: 'short review rationale',
                confidence: 0.8,
                risk: 'low|medium|high',
                rubric: { wikiSummaryRisk: 'low' },
            }],
        },
        limits: {
            proposals: Math.max(1, Math.min(24, Number(context.proposalLimit || 16))),
            supportedActionsOnly: true,
            compactJson: true,
        },
        malformedResponse: truncateText(responseText, 9000),
    });
    if (typeof requestOptionsOverride.onProgress === 'function') {
        requestOptionsOverride.onProgress({
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Context and Tag plan into compact Creator JSON...',
            streamSupported: requestOptionsOverride.stream === true,
        });
    }
    return await sendLoreRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 2048, expectedOutput: 'json', ...requestOptionsOverride });
}

async function requestLoredeckCreatorEntryResponse(context = {}, requestOptionsOverride = {}) {
    const systemPrompt = buildLoredeckCreatorEntrySystemPrompt();
    const userPrompt = buildLoredeckCreatorEntryUserPrompt(context);
    const requestOptions = { providerKind: 'lore', maxTokens: 8192, expectedOutput: 'json', ...requestOptionsOverride };
    try {
        return await sendLoreRequest(systemPrompt, userPrompt, requestOptions);
    } catch (error) {
        if (!isLoredeckCreatorBriefRetryableError(error)) throw error;
        if (typeof requestOptions.onProgress === 'function') {
            requestOptions.onProgress({
                type: 'phase',
                phase: 'retry',
                message: 'Retrying compact Lorecard micro-batch after oversized or empty response...',
                streamSupported: requestOptions.stream === true,
            });
        }
        const retrySystemPrompt = `${systemPrompt}

RETRY MODE:
- The previous attempt failed before valid visible JSON was returned.
- Return only the compact proposal JSON object from the schema.
- Return only upsert_entry proposals for the supplied targetTitleDrafts.
- Keep fact under 60 words, injection under 75 words, notes under 24 words, and reason under 20 words.
- Omit rubric unless needed; if included, use only wikiSummaryRisk and one useful key.
- Do not include prose outside JSON.`;
        return await sendLoreRequest(retrySystemPrompt, userPrompt, requestOptions);
    }
}

async function repairLoredeckCreatorEntryResponse(responseText = '', context = {}, requestOptionsOverride = {}) {
    const systemPrompt = `You repair Saga Loredeck Creator Lorecard drafting output.

Return JSON only. Do not include markdown.

Convert the malformed, partial, overlong, or structurally wrong response into the compact proposal contract. Preserve usable upsert_entry proposals from the source. Return only upsert_entry proposals for the supplied targetTitleDrafts. Do not generate timeline, tag, disable, restore, manifest, or settings proposals. If there is not enough usable entry information, ask 1-3 clarifyingQuestions and return an empty proposals array.`;
    const userPrompt = JSON.stringify({
        sourceInputs: {
            generatedPackId: context.generatedPackId || '',
            approvedBrief: context.brief || null,
            targetPlanningBatch: context.targetPlanningBatch || null,
            targetTitleDrafts: Array.isArray(context.targetTitleDrafts) ? context.targetTitleDrafts.slice(0, 6) : [],
            acceptedTimelineRegistry: context.timelineRegistry || null,
            acceptedTagRegistry: context.tagRegistry || null,
            existingEntryIds: Array.isArray(context.existingEntryIds) ? context.existingEntryIds.slice(0, 160) : [],
        },
        expectedShape: {
            summary: 'one sentence',
            clarifyingQuestions: [],
            warnings: [],
            proposals: [{
                action: 'upsert_entry',
                title: 'Draft entry: title',
                entryId: 'target-entry-id',
                entry: {
                    id: 'target-entry-id',
                    schemaVersion: 3,
                    title: 'string',
                    category: 'string',
                    canon: 'canon',
                    canonStatus: 'canon',
                    relevance: 'high|medium|low',
                    priority: 80,
                    tags: [],
                    context: {},
                    retrieval: {},
                    content: { fact: 'short useful constraint', injection: 'short scene instruction', notes: 'optional' },
                },
                reason: 'short review rationale',
                confidence: 0.8,
                risk: 'low|medium|high',
                rubric: { wikiSummaryRisk: 'low' },
            }],
        },
        limits: {
            proposals: Math.max(1, Math.min(6, Number(context.entryBatchLimit || 3))),
            upsertEntriesOnly: true,
            compactJson: true,
        },
        malformedResponse: truncateText(responseText, 12000),
    });
    if (typeof requestOptionsOverride.onProgress === 'function') {
        requestOptionsOverride.onProgress({
            type: 'phase',
            phase: 'repairing',
            message: 'Repairing malformed Lorecard batch into compact Creator JSON...',
            streamSupported: requestOptionsOverride.stream === true,
        });
    }
    return await sendLoreRequest(systemPrompt, userPrompt, { providerKind: 'lore', maxTokens: 4096, expectedOutput: 'json', ...requestOptionsOverride });
}

async function handleLoredeckCreatorBriefDraft(options = {}, button = null) {
    await runBusyAction(button, 'Drafting...', async () => {
        if (!ensureLoreProviderReadyForAction('Loredeck Creator', 'lore')) return;
        const fandom = String(options.fandom || '').trim();
        const scope = String(options.scope || '').trim();
        if (!fandom || !scope) {
            toast('Creator intake needs a fandom and scope.', 'warning');
            return;
        }
        const actionId = options.revisionInstruction ? 'brief_revision' : 'brief_draft';
        const { generation, job: startedJob } = startLoredeckCreatorGeneration(
            actionId,
            options.revisionInstruction ? 'Revising Scope Brief' : 'Drafting Scope Brief',
            {
                fandom,
                scope,
                granularity: options.granularity || 'focused',
                notes: options.notes || '',
                currentStage: 'intake',
            }
        );
        if (!generation) return;
        const requestContext = {
            fandom,
            scope,
            granularity: options.granularity || 'focused',
            notes: options.notes || '',
            previousBrief: options.previousBrief || null,
            revisionInstruction: options.revisionInstruction || '',
        };
        let responseText = '';
        let parsed = null;
        let generationOptions = null;
        try {
            const result = await runLoredeckCreatorSingleUnitGeneration({
                generation,
                stage: 'scope_brief',
                unitId: options.unitIdOverride || undefined,
                unitLabel: options.revisionInstruction ? 'Scope Brief revision' : 'Scope Brief draft',
                currentStage: 'intake',
                unitMeta: {
                    actionId,
                    fandom,
                    scope,
                    granularity: options.granularity || 'focused',
                    notes: options.notes || '',
                    revisionInstruction: options.revisionInstruction || '',
                    retrySmallerSupported: false,
                },
                requestContext,
                requestResponse: requestLoredeckCreatorBriefResponse,
                parseResponse: parseLoredeckCreatorBriefResponse,
                repairResponse: repairLoredeckCreatorBriefResponse,
                repairWarning: 'Creator brief response was normalized into Saga scope-brief format.',
                isRepairUsable: repaired => isLoredeckCreatorParsedArtifactUsable(repaired, 'brief'),
                resultRefType: 'creator_scope_brief',
            });
            if (result?.aborted || ignoreStaleLoredeckCreatorGeneration(generation, 'scope brief')) return;
            responseText = result.responseText;
            parsed = result.parsed;
            generationOptions = result.requestOptions;
        } catch (e) {
            if (isLoredeckCreatorAbortError(e) || ignoreStaleLoredeckCreatorGeneration(generation, 'scope brief')) return;
            markLoredeckCreatorActionFailed(e, 'Loredeck Creator brief draft failed.');
            finishLoredeckCreatorGeneration(generation, 'error', e?.message || 'Scope brief generation failed.');
            throw e;
        }
        if (!parsed.brief && !parsed.clarifyingQuestions.length && String(responseText || '').trim()) {
            try {
                const repairedText = await repairLoredeckCreatorBriefResponse(responseText, requestContext, generationOptions);
                if (ignoreStaleLoredeckCreatorGeneration(generation, 'scope brief repair')) return;
                const repaired = parseLoredeckCreatorBriefResponse(repairedText);
                if (repaired.brief || repaired.clarifyingQuestions.length) {
                    parsed = {
                        ...repaired,
                        warnings: [
                            ...((repaired.warnings || [])),
                            'Creator brief response was normalized into Saga scope-brief format.',
                        ],
                    };
                }
            } catch (repairError) {
                console.warn('[Saga] Loredeck Creator brief repair failed:', repairError);
            }
        }
        if (ignoreStaleLoredeckCreatorGeneration(generation, 'scope brief commit')) return;
        setLoredeckCreatorBriefCache({
            summary: parsed.summary,
            questions: parsed.clarifyingQuestions,
            warnings: parsed.warnings,
            brief: parsed.brief,
            approved: false,
            outline: null,
            outlineApproved: false,
            outlineSummary: '',
            outlineQuestions: [],
            outlineWarnings: [],
            titleDrafts: [],
            selectedTitleDraftIds: [],
            approvedTitleDraftIds: [],
            titleBatchDraftedIds: [],
            titleBatch: null,
            titlePassSummary: '',
            titlePassQuestions: [],
            titlePassWarnings: [],
            planningSummary: '',
            planningQuestions: [],
            planningWarnings: [],
            planningQueuedCount: 0,
            planningBatchQueuedIds: [],
            planningBatchAcceptedIds: [],
            generatedPackId: '',
            generatedPackTitle: '',
            entryDraftSummary: '',
            entryDraftQuestions: [],
            entryDraftWarnings: [],
            entryDraftCount: 0,
            status: parsed.brief ? 'draft' : 'needs_input',
            fandom,
            scope,
            granularity: options.granularity || 'focused',
            notes: options.notes || '',
            createdAt: startedJob?.createdAt || Date.now(),
            lastCompletedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        if (parsed.clarifyingQuestions.length && !parsed.brief) {
            finishLoredeckCreatorGeneration(generation, 'warning', `Needs clarification: ${parsed.clarifyingQuestions[0]}`);
            toast(`Loredeck Creator needs clarification: ${parsed.clarifyingQuestions[0]}`, 'warning');
            return;
        }
        if (!parsed.brief) {
            finishLoredeckCreatorGeneration(generation, 'warning', parsed.warnings?.[0] || 'No scope brief returned.');
            toast(parsed.warnings?.[0] || 'Loredeck Creator returned no brief.', 'warning');
            return;
        }
        finishLoredeckCreatorGeneration(generation, 'success', 'Scope brief drafted. Ready for review.');
        toast('Loredeck Creator brief drafted for review.', 'success');
    });
}

function approveLoredeckCreatorBrief() {
    const cached = getLoredeckCreatorBriefCache();
    if (!cached.brief) {
        toast('Draft a Creator brief before approval.', 'warning');
        return false;
    }
    setLoredeckCreatorBriefCache({
        ...cached,
        approved: true,
        status: 'approved',
        approvedAt: Date.now(),
    });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    toast('Scope brief approved for the next Creator stage.', 'success');
    return true;
}

function getLoredeckCreatorOutline(cached = {}) {
    const outline = cached?.outline;
    return outline && typeof outline === 'object' && !Array.isArray(outline) ? outline : null;
}

function createLoredeckCreatorOutlineActionForm(brief = {}, cached = {}, outline = getLoredeckCreatorOutline(cached)) {
    const reviseForm = document.createElement('div');
    reviseForm.className = 'saga-new-lore-form saga-loredeck-creator-revise-form';
    const reviseInput = createNewLoreInput(reviseForm, 'Outline Revision', 'Instruction for revising the outline before approval.', loredeckCreatorOutlineRevisionInstruction || '', true, 'Add more high-value Context points around the betrayal reveal and final battle.');
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const draftOutlineButton = createButton(outline ? 'Redraft Outline' : 'Draft Outline', 'Ask the Reasoning Provider to draft this reviewable story outline.', async (btn) => {
        loredeckCreatorOutlineRevisionInstruction = '';
        await handleLoredeckCreatorOutlineDraft({}, btn);
    }, outline ? '' : 'saga-primary-button');
    actions.appendChild(applyLoredeckCreatorGenerationButtonLock(draftOutlineButton, cached, 'story outline draft'));
    const approve = createButton(cached.outlineApproved ? 'Outline Approved' : 'Approve Outline', 'Approve this Story Outline for title-pass generation.', () => {
        approveLoredeckCreatorOutline();
    }, cached.outlineApproved ? '' : 'saga-primary-button');
    approve.disabled = !outline || cached.outlineApproved === true;
    actions.appendChild(approve);
    const reviseOutlineButton = createButton('Revise Outline', 'Ask the Reasoning Provider to revise this outline.', async (btn) => {
        loredeckCreatorOutlineRevisionInstruction = reviseInput.value.trim();
        await handleLoredeckCreatorOutlineDraft({
            previousOutline: outline,
            revisionInstruction: loredeckCreatorOutlineRevisionInstruction,
        }, btn);
    });
    actions.appendChild(applyLoredeckCreatorGenerationButtonLock(reviseOutlineButton, cached, 'story outline revision'));
    reviseForm.appendChild(actions);
    appendLoredeckCreatorGenerationStatus(reviseForm, cached, ['outline_draft', 'outline_revision']);
    return reviseForm;
}

async function handleLoredeckCreatorOutlineDraft(options = {}, button = null) {
    await runBusyAction(button, options.revisionInstruction ? 'Revising...' : 'Outlining...', async () => {
        if (!ensureLoreProviderReadyForAction('Loredeck Creator', 'lore')) return;
        const cached = getLoredeckCreatorBriefCache();
        const brief = cached.brief || {};
        if (!cached.approved || !brief) {
            toast('Approve a Scope Brief before drafting the Story Outline.', 'warning');
            return;
        }
        const revisionInstruction = String(options.revisionInstruction || '').trim();
        if (revisionInstruction && !getLoredeckCreatorOutline(cached)) {
            toast('Draft a Story Outline before revising it.', 'warning');
            return;
        }
        const actionId = revisionInstruction ? 'outline_revision' : 'outline_draft';
        const { generation } = startLoredeckCreatorGeneration(
            actionId,
            revisionInstruction ? 'Revising Story Outline' : 'Drafting Story Outline',
            {
                ...cached,
                currentStage: 'outline_drafting',
            }
        );
        if (!generation) return;
        const requestContext = {
            brief,
            notes: options.notes || cached.notes || loredeckCreatorNotes,
            previousOutline: options.previousOutline || cached.outline || null,
            revisionInstruction,
        };
        let responseText = '';
        let parsed = null;
        let generationOptions = null;
        try {
            const result = await runLoredeckCreatorSingleUnitGeneration({
                generation,
                stage: 'story_outline',
                unitId: options.unitIdOverride || undefined,
                unitLabel: revisionInstruction ? 'Story Outline revision' : 'Story Outline draft',
                currentStage: 'outline_drafting',
                unitMeta: {
                    actionId,
                    revisionInstruction,
                    retrySmallerSupported: false,
                },
                requestContext,
                requestResponse: requestLoredeckCreatorOutlineResponse,
                parseResponse: parseLoredeckCreatorOutlineResponse,
                repairResponse: repairLoredeckCreatorOutlineResponse,
                repairWarning: 'Creator Story Outline response was normalized into Saga outline format.',
                isRepairUsable: repaired => isLoredeckCreatorParsedArtifactUsable(repaired, 'outline'),
                resultRefType: 'creator_story_outline',
            });
            if (result?.aborted || ignoreStaleLoredeckCreatorGeneration(generation, 'story outline')) return;
            responseText = result.responseText;
            parsed = result.parsed;
            generationOptions = result.requestOptions;
        } catch (e) {
            if (isLoredeckCreatorAbortError(e) || ignoreStaleLoredeckCreatorGeneration(generation, 'story outline')) return;
            markLoredeckCreatorOutlineFailed(e, 'Loredeck Creator outline draft failed.');
            finishLoredeckCreatorGeneration(generation, 'error', e?.message || 'Story Outline generation failed.');
            throw e;
        }
        if (!parsed.outline && !parsed.clarifyingQuestions.length && String(responseText || '').trim()) {
            try {
                const repairedText = await repairLoredeckCreatorOutlineResponse(responseText, requestContext, generationOptions);
                if (ignoreStaleLoredeckCreatorGeneration(generation, 'story outline repair')) return;
                const repaired = parseLoredeckCreatorOutlineResponse(repairedText);
                if (repaired.outline || repaired.clarifyingQuestions.length) {
                    parsed = {
                        ...repaired,
                        warnings: [
                            ...((repaired.warnings || [])),
                            'Creator Story Outline response was normalized into Saga outline format.',
                        ],
                    };
                }
            } catch (repairError) {
                console.warn('[Saga] Loredeck Creator outline repair failed:', repairError);
            }
        }
        if (ignoreStaleLoredeckCreatorGeneration(generation, 'story outline commit')) return;
        if (parsed.clarifyingQuestions.length && !parsed.outline) {
            setLoredeckCreatorBriefCache({
                ...getLoredeckCreatorBriefCache(),
                outlineSummary: parsed.summary,
                outlineQuestions: parsed.clarifyingQuestions,
                outlineWarnings: parsed.warnings,
                outlineApproved: false,
                status: 'needs_input',
                lastCompletedAt: Date.now(),
            });
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            finishLoredeckCreatorGeneration(generation, 'warning', `Needs clarification: ${parsed.clarifyingQuestions[0]}`);
            toast(`Loredeck Creator needs clarification: ${parsed.clarifyingQuestions[0]}`, 'warning');
            return;
        }
        if (!parsed.outline) {
            setLoredeckCreatorBriefCache({
                ...getLoredeckCreatorBriefCache(),
                outlineSummary: parsed.summary,
                outlineQuestions: parsed.clarifyingQuestions,
                outlineWarnings: parsed.warnings,
                outlineApproved: false,
                status: 'needs_input',
                lastCompletedAt: Date.now(),
            });
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            finishLoredeckCreatorGeneration(generation, 'warning', parsed.warnings?.[0] || 'No Story Outline returned.');
            toast(parsed.warnings?.[0] || 'Loredeck Creator returned no Story Outline.', 'warning');
            return;
        }
        setLoredeckCreatorBriefCache({
            ...getLoredeckCreatorBriefCache(),
            outlineSummary: parsed.summary,
            outlineQuestions: parsed.clarifyingQuestions,
            outlineWarnings: parsed.warnings,
            outline: parsed.outline,
            outlineApproved: false,
            titleDrafts: [],
            selectedTitleDraftIds: [],
            approvedTitleDraftIds: [],
            titleBatchDraftedIds: [],
            titleBatch: null,
            titlePassSummary: '',
            titlePassQuestions: [],
            titlePassWarnings: [],
            planningSummary: '',
            planningQuestions: [],
            planningWarnings: [],
            planningQueuedCount: 0,
            planningBatchQueuedIds: [],
            planningBatchAcceptedIds: [],
            generatedPackId: '',
            generatedPackTitle: '',
            entryDraftSummary: '',
            entryDraftQuestions: [],
            entryDraftWarnings: [],
            entryDraftCount: 0,
            status: 'draft',
            outlineDraftedAt: Date.now(),
            outlineRevisedAt: revisionInstruction ? Date.now() : undefined,
            lastCompletedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        finishLoredeckCreatorGeneration(generation, 'success', 'Story Outline drafted. Ready for review.');
        toast('Loredeck Creator Story Outline drafted for review.', 'success');
    });
}

function approveLoredeckCreatorOutline() {
    const cached = getLoredeckCreatorBriefCache();
    if (!getLoredeckCreatorOutline(cached)) {
        toast('Draft a Story Outline before approval.', 'warning');
        return false;
    }
    setLoredeckCreatorBriefCache({
        ...cached,
        outlineApproved: true,
        status: 'approved',
        outlineApprovedAt: Date.now(),
    });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    toast('Story Outline approved for title-pass generation.', 'success');
    return true;
}

function getLoredeckCreatorSelectedTitleIds(cached = {}) {
    const drafts = getLoredeckCreatorTitleDrafts(cached);
    const validIds = new Set(drafts.map(draft => draft.titleId));
    if (!Object.prototype.hasOwnProperty.call(cached || {}, 'selectedTitleDraftIds')) {
        return new Set(validIds);
    }
    return new Set(normalizeLoredeckCreatorTitleIdList(cached.selectedTitleDraftIds).filter(id => validIds.has(id)));
}

function getLoredeckCreatorApprovedTitleIds(cached = {}) {
    const validIds = new Set(getLoredeckCreatorTitleDrafts(cached).map(draft => draft.titleId));
    return new Set(normalizeLoredeckCreatorTitleIdList(cached?.approvedTitleDraftIds || []).filter(id => validIds.has(id)));
}

function updateLoredeckCreatorTitleCache(mutator = null) {
    if (typeof mutator !== 'function') return getLoredeckCreatorBriefCache();
    const current = getLoredeckCreatorBriefCache();
    const next = mutator({
        ...current,
        titleDrafts: getLoredeckCreatorTitleDrafts(current),
        selectedTitleDraftIds: [...getLoredeckCreatorSelectedTitleIds(current)],
        approvedTitleDraftIds: [...getLoredeckCreatorApprovedTitleIds(current)],
    }) || current;
    const titleDrafts = getLoredeckCreatorTitleDrafts(next);
    const validIds = new Set(titleDrafts.map(draft => draft.titleId));
    const selectedTitleDraftIds = normalizeLoredeckCreatorTitleIdList(next.selectedTitleDraftIds || [])
        .filter(id => validIds.has(id));
    const approvedTitleDraftIds = normalizeLoredeckCreatorTitleIdList(next.approvedTitleDraftIds || [])
        .filter(id => validIds.has(id));
    return setLoredeckCreatorBriefCache({
        ...next,
        titleDrafts,
        selectedTitleDraftIds,
        approvedTitleDraftIds,
    });
}

function setLoredeckCreatorTitleSelection(titleId = '', selected = false, options = {}) {
    const id = normalizeLoredeckCreatorTitleId(titleId);
    if (!id) return;
    updateLoredeckCreatorTitleCache(cached => {
        const selectedIds = getLoredeckCreatorSelectedTitleIds(cached);
        if (selected) selectedIds.add(id);
        else selectedIds.delete(id);
        return { ...cached, selectedTitleDraftIds: [...selectedIds] };
    });
    if (options.refresh) refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
}

function setLoredeckCreatorTitleSelectionBulk(mode = 'all') {
    updateLoredeckCreatorTitleCache(cached => ({
        ...cached,
        selectedTitleDraftIds: mode === 'all' ? getLoredeckCreatorTitleDrafts(cached).map(draft => draft.titleId) : [],
    }));
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
}

function getLoredeckCreatorSelectedTitleDrafts(cached = {}) {
    const selectedIds = getLoredeckCreatorSelectedTitleIds(cached);
    return getLoredeckCreatorTitleDrafts(cached).filter(draft => selectedIds.has(draft.titleId));
}

function getLoredeckCreatorApprovedTitleDrafts(cached = {}) {
    const approvedIds = getLoredeckCreatorApprovedTitleIds(cached);
    return getLoredeckCreatorTitleDrafts(cached).filter(draft => approvedIds.has(draft.titleId));
}

function getLoredeckCreatorTitleBatchLimit(brief = {}, cached = getLoredeckCreatorBriefCache()) {
    const settings = getLoredeckCreatorGenerationSettings(cached);
    if (Number.isFinite(Number(settings.titleBatchLimit))) return settings.titleBatchLimit;
    const granularity = String(brief?.granularity || '').trim().toLowerCase();
    const byGranularity = {
        compact: 6,
        focused: 8,
        dense: 10,
        scene_dense: 8,
    };
    return byGranularity[granularity] || 8;
}

function attachLoredeckCreatorTitleBatch(drafts = [], batch = {}) {
    const batchId = normalizeLoredeckCreatorTitleId(batch?.id || batch?.label || 'title-batch', 'title-batch');
    const batchLabel = String(batch?.label || batchId || 'Title Batch').trim();
    return normalizeLoredeckCreatorTitleDrafts(drafts).map(draft => ({
        ...draft,
        creatorTitleBatchId: draft.creatorTitleBatchId || batchId,
        creatorTitleBatchLabel: draft.creatorTitleBatchLabel || batchLabel,
    }));
}

function isLoredeckCreatorParsedTitlePassUsable(parsed = null) {
    return !!parsed
        && typeof parsed === 'object'
        && !Array.isArray(parsed)
        && ((Array.isArray(parsed.titleDrafts) && parsed.titleDrafts.length > 0)
            || (Array.isArray(parsed.clarifyingQuestions) && parsed.clarifyingQuestions.length > 0));
}

function buildLoredeckCreatorTitleGenerationUnitId(actionId = '', targetTitleBatch = null, selectedTitleDrafts = []) {
    const action = String(actionId || 'title_batch_draft').trim();
    const batchId = normalizeLoredeckCreatorTitleId(targetTitleBatch?.id || targetTitleBatch?.label || '', '');
    const selectedIds = Array.isArray(selectedTitleDrafts)
        ? selectedTitleDrafts.map(item => normalizeLoredeckCreatorTitleId(item?.titleId || item?.id || '', '')).filter(Boolean).sort()
        : [];
    const seed = action === 'title_revision'
        ? (selectedIds.join('_') || 'selected_titles')
        : (batchId || 'next_title_batch');
    return `creator_${action}:${seed}`.replace(/[^a-zA-Z0-9:._-]+/g, '_').slice(0, 220);
}

function commitLoredeckCreatorTitleDraftResult(parsed = {}, options = {}) {
    const titleDrafts = Array.isArray(parsed.titleDrafts) ? parsed.titleDrafts : [];
    if (!titleDrafts.length) {
        return {
            revisedMode: false,
            draftCount: 0,
            replacedCount: 0,
            titleIds: [],
            batchId: '',
            batchLabel: '',
        };
    }
    const revisionInstruction = String(options.revisionInstruction || '').trim();
    const selectedTitleDrafts = Array.isArray(options.selectedTitleDrafts) ? options.selectedTitleDrafts : [];
    const revisedMode = !!revisionInstruction && selectedTitleDrafts.length > 0;
    const selectedIds = new Set(selectedTitleDrafts.map(item => normalizeLoredeckCreatorTitleId(item?.titleId || item?.id || '', '')).filter(Boolean));
    const selectedBatch = selectedTitleDrafts.find(item => item?.creatorTitleBatchId || item?.creatorTitleBatchLabel);
    const batchForDrafts = revisedMode
        ? {
            id: selectedBatch?.creatorTitleBatchId || 'revised-selection',
            label: selectedBatch?.creatorTitleBatchLabel || 'Revised Selection',
        }
        : (options.targetTitleBatch || {});
    const batchIdentity = getLoredeckCreatorTitleBatchIdentity(batchForDrafts);
    const normalizedBatch = {
        ...(batchForDrafts || {}),
        id: batchIdentity.id || (revisedMode ? 'revised-selection' : 'title-batch'),
        label: batchIdentity.label,
    };
    const revisedDrafts = attachLoredeckCreatorTitleBatch(titleDrafts, normalizedBatch);
    const committedTitleIds = [];
    let replacedCount = 0;
    updateLoredeckCreatorTitleCache(current => {
        const existing = getLoredeckCreatorTitleDrafts(current);
        const approvedIds = getLoredeckCreatorApprovedTitleIds(current);
        const selectedIdsNext = getLoredeckCreatorSelectedTitleIds(current);
        let nextDrafts = [];
        if (!revisedMode) {
            const targetBatchId = normalizeLoredeckCreatorTitleId(normalizedBatch.id || normalizedBatch.label || '', '');
            const existingForNext = targetBatchId
                ? existing.filter(draft => {
                    const replace = draft.creatorTitleBatchId === targetBatchId;
                    if (replace) {
                        replacedCount += 1;
                        approvedIds.delete(draft.titleId);
                        selectedIdsNext.delete(draft.titleId);
                    }
                    return !replace;
                })
                : existing;
            nextDrafts = normalizeLoredeckCreatorTitleDrafts([...existingForNext, ...revisedDrafts]);
            const nextBatchDrafts = targetBatchId
                ? nextDrafts.filter(draft => draft.creatorTitleBatchId === targetBatchId)
                : revisedDrafts;
            for (const draft of nextBatchDrafts) {
                selectedIdsNext.add(draft.titleId);
                committedTitleIds.push(draft.titleId);
            }
            const draftedBatchIds = getLoredeckCreatorTitleDraftedBatchIds(current);
            if (targetBatchId) draftedBatchIds.add(targetBatchId);
            return {
                ...current,
                titlePassSummary: parsed.summary,
                titlePassQuestions: parsed.clarifyingQuestions,
                titlePassWarnings: parsed.warnings,
                titleBatch: {
                    ...(parsed.batch || {}),
                    targetTitleBatchId: targetBatchId,
                    targetTitleBatchLabel: normalizedBatch.label || targetBatchId,
                },
                titleDrafts: nextDrafts,
                selectedTitleDraftIds: [...selectedIdsNext].filter(id => nextDrafts.some(draft => draft.titleId === id)),
                approvedTitleDraftIds: [...approvedIds].filter(id => nextDrafts.some(draft => draft.titleId === id)),
                titleBatchDraftedIds: [...draftedBatchIds],
                status: 'draft',
                titleDraftedAt: Date.now(),
                updatedAt: Date.now(),
            };
        }
        let inserted = false;
        for (const draft of existing) {
            if (selectedIds.has(draft.titleId)) {
                replacedCount += 1;
                approvedIds.delete(draft.titleId);
                selectedIdsNext.delete(draft.titleId);
                if (!inserted) {
                    nextDrafts.push(...revisedDrafts);
                    inserted = true;
                }
                continue;
            }
            nextDrafts.push(draft);
        }
        if (!inserted) nextDrafts.push(...revisedDrafts);
        nextDrafts = normalizeLoredeckCreatorTitleDrafts(nextDrafts);
        const nextRevisedIds = new Set(revisedDrafts.map(draft => draft.titleId));
        for (const draft of nextDrafts) {
            if (nextRevisedIds.has(draft.titleId)) {
                selectedIdsNext.add(draft.titleId);
                committedTitleIds.push(draft.titleId);
            }
        }
        return {
            ...current,
            titlePassSummary: parsed.summary || current.titlePassSummary || '',
            titlePassQuestions: parsed.clarifyingQuestions,
            titlePassWarnings: parsed.warnings,
            titleBatch: {
                ...(parsed.batch || {}),
                targetTitleBatchId: normalizedBatch.id,
                targetTitleBatchLabel: normalizedBatch.label,
            },
            titleDrafts: nextDrafts,
            selectedTitleDraftIds: [...selectedIdsNext].filter(id => nextDrafts.some(draft => draft.titleId === id)),
            approvedTitleDraftIds: [...approvedIds].filter(id => nextDrafts.some(draft => draft.titleId === id)),
            status: 'draft',
            titleRevisedAt: Date.now(),
            updatedAt: Date.now(),
        };
    });
    return {
        revisedMode,
        draftCount: titleDrafts.length,
        replacedCount,
        titleIds: committedTitleIds,
        batchId: normalizedBatch.id,
        batchLabel: normalizedBatch.label,
    };
}

function approveLoredeckCreatorTitleSelection(selectedIds = new Set()) {
    const idSet = selectedIds instanceof Set ? selectedIds : new Set(normalizeLoredeckCreatorTitleIdList(selectedIds || []));
    const cached = getLoredeckCreatorBriefCache();
    const drafts = getLoredeckCreatorTitleDrafts(cached).filter(draft => idSet.has(draft.titleId));
    if (!drafts.length) {
        toast('Select title drafts to approve.', 'warning');
        return false;
    }
    updateLoredeckCreatorTitleCache(current => {
        const approvedIds = getLoredeckCreatorApprovedTitleIds(current);
        for (const draft of drafts) approvedIds.add(draft.titleId);
        return {
            ...current,
            approvedTitleDraftIds: [...approvedIds],
            status: 'approved',
            approvedTitleDraftAt: Date.now(),
        };
    });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    toast(`Approved ${drafts.length} title draft${drafts.length === 1 ? '' : 's'} for the next Creator stage.`, 'success');
    return true;
}

function unapproveLoredeckCreatorTitleSelection(selectedIds = new Set()) {
    const idSet = selectedIds instanceof Set ? selectedIds : new Set(normalizeLoredeckCreatorTitleIdList(selectedIds || []));
    const cached = getLoredeckCreatorBriefCache();
    const approvedIds = getLoredeckCreatorApprovedTitleIds(cached);
    const removed = [...idSet].filter(id => approvedIds.has(id));
    if (!removed.length) {
        toast('Selected title drafts are not approved yet.', 'info');
        return false;
    }
    updateLoredeckCreatorTitleCache(current => {
        const nextApproved = getLoredeckCreatorApprovedTitleIds(current);
        for (const id of removed) nextApproved.delete(id);
        return {
            ...current,
            approvedTitleDraftIds: [...nextApproved],
            status: nextApproved.size ? 'approved' : 'draft',
            updatedAt: Date.now(),
        };
    });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    toast(`Unapproved ${removed.length} title draft${removed.length === 1 ? '' : 's'}.`, 'info');
    return true;
}

function dropLoredeckCreatorTitleSelection(selectedIds = new Set()) {
    const idSet = selectedIds instanceof Set ? selectedIds : new Set(normalizeLoredeckCreatorTitleIdList(selectedIds || []));
    const cached = getLoredeckCreatorBriefCache();
    const selected = getLoredeckCreatorTitleDrafts(cached).filter(draft => idSet.has(draft.titleId));
    if (!selected.length) {
        toast('Select title drafts to drop.', 'warning');
        return false;
    }
    updateLoredeckCreatorTitleCache(current => {
        const remaining = getLoredeckCreatorTitleDrafts(current).filter(draft => !idSet.has(draft.titleId));
        const selectedIdsNext = getLoredeckCreatorSelectedTitleIds(current);
        const approvedIdsNext = getLoredeckCreatorApprovedTitleIds(current);
        for (const draft of selected) {
            selectedIdsNext.delete(draft.titleId);
            approvedIdsNext.delete(draft.titleId);
        }
        return {
            ...current,
            titleDrafts: remaining,
            selectedTitleDraftIds: [...selectedIdsNext],
            approvedTitleDraftIds: [...approvedIdsNext],
            status: approvedIdsNext.size ? 'approved' : 'draft',
            updatedAt: Date.now(),
        };
    });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    toast(`Dropped ${selected.length} title draft${selected.length === 1 ? '' : 's'}.`, 'info');
    return true;
}

function openLoredeckCreatorTitleJsonEditor(draft = {}) {
    const existing = document.querySelector('.saga-loredeck-creator-title-overlay');
    existing?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-creator-title-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);
    const title = document.createElement('div');
    title.className = 'saga-new-lore-title';
    title.textContent = 'Edit Creator Title Draft';
    shell.appendChild(title);
    const textarea = document.createElement('textarea');
    textarea.className = 'saga-continuity-json-editor saga-loredeck-creator-title-json';
    textarea.spellcheck = false;
    textarea.value = JSON.stringify(draft, null, 2);
    addTooltip(textarea, 'Editable title-draft JSON. Save validates the draft before replacing it in the Creator title pass.');
    shell.appendChild(textarea);
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Save Draft', 'Validate and save this edited title draft.', () => {
        try {
            const parsed = JSON.parse(textarea.value || '{}');
            const normalized = parseLoredeckCreatorTitleResponse(JSON.stringify({ titleDrafts: [parsed] })).titleDrafts[0];
            if (!normalized) {
                toast('Edited title draft is not valid.', 'warning');
                return;
            }
            updateLoredeckCreatorTitleCache(current => {
                const wasSelected = getLoredeckCreatorSelectedTitleIds(current).has(draft.titleId);
                const wasApproved = getLoredeckCreatorApprovedTitleIds(current).has(draft.titleId);
                const titleDrafts = getLoredeckCreatorTitleDrafts(current).map(item => item.titleId === draft.titleId ? normalized : item);
                const selectedIds = getLoredeckCreatorSelectedTitleIds({ ...current, titleDrafts });
                const approvedIds = getLoredeckCreatorApprovedTitleIds({ ...current, titleDrafts });
                selectedIds.delete(draft.titleId);
                approvedIds.delete(draft.titleId);
                if (wasSelected) selectedIds.add(normalized.titleId);
                if (wasApproved) approvedIds.add(normalized.titleId);
                return {
                    ...current,
                    titleDrafts,
                    selectedTitleDraftIds: [...selectedIds],
                    approvedTitleDraftIds: [...approvedIds],
                    updatedAt: Date.now(),
                };
            });
            overlay.remove();
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast('Creator title draft updated.', 'success');
        } catch (e) {
            toast(e?.message || 'Title draft JSON is invalid.', 'error');
        }
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without saving this title draft edit.', () => overlay.remove()));
    shell.appendChild(actions);
    document.body.appendChild(overlay);
}

async function performLoredeckCreatorTitleDraft(options = {}) {
    if (!ensureLoreProviderReadyForAction('Loredeck Creator', 'lore')) return { status: 'not_ready' };
        const cached = getLoredeckCreatorBriefCache();
        const brief = options.brief || cached.brief;
        if (!cached.approved || !brief) {
            toast('Approve a Creator brief before drafting titles.', 'warning');
            return { status: 'blocked', reason: 'brief_not_approved' };
        }
        const outline = getLoredeckCreatorOutline(cached);
        if (!cached.outlineApproved || !outline) {
            toast('Approve the Story Outline before drafting titles.', 'warning');
            return { status: 'blocked', reason: 'outline_not_approved' };
        }
        const revisionInstruction = String(options.revisionInstruction || '').trim();
        const selectedTitleDrafts = Array.isArray(options.selectedTitleDrafts) ? options.selectedTitleDrafts : [];
        if (selectedTitleDrafts.length && !revisionInstruction) {
            toast('Enter a title revision instruction first.', 'warning');
            return { status: 'blocked', reason: 'missing_revision_instruction' };
        }
        if (revisionInstruction && !selectedTitleDrafts.length) {
            toast('Select title drafts to revise.', 'warning');
            return { status: 'blocked', reason: 'missing_selected_titles' };
        }
        const targetTitleBatch = revisionInstruction
            ? (options.targetTitleBatch || null)
            : (options.targetTitleBatch || getLoredeckCreatorNextTitleBatch(cached));
        if (!revisionInstruction && !targetTitleBatch) {
            toast('All planned title sets have already been drafted.', 'info');
            return { status: 'complete', reason: 'no_title_batches_remaining' };
        }
        const actionId = revisionInstruction ? 'title_revision' : (options.redraftTitleBatch ? 'title_batch_redraft' : 'title_batch_draft');
        const generationLabel = revisionInstruction
            ? 'Revising Selected Titles'
            : (options.redraftTitleBatch ? 'Redrafting Title Set' : 'Drafting Title Set');
        const { generation } = startLoredeckCreatorGeneration(
            actionId,
            generationLabel,
            {
                ...cached,
                currentStage: 'titles_drafting',
            },
            {
                batchId: normalizeLoredeckCreatorTitleId(targetTitleBatch?.id || targetTitleBatch?.label || '', ''),
                batchLabel: targetTitleBatch?.label || targetTitleBatch?.id || '',
            }
        );
        if (!generation) return { status: 'blocked', reason: 'generation_already_running' };
        const generationSettings = getLoredeckCreatorGenerationSettings(cached);
        const batchId = normalizeLoredeckCreatorTitleId(targetTitleBatch?.id || targetTitleBatch?.label || '', '');
        const batchLabel = targetTitleBatch?.label || targetTitleBatch?.id || '';
        const effectiveTitlePassLimit = revisionInstruction
            ? Math.max(generationSettings.titleBatchLimit, selectedTitleDrafts.length)
            : clampLoredeckCreatorInteger(options.titlePassLimitOverride, 1, 24, getLoredeckCreatorTitleBatchLimit(brief, cached));
        const requestContext = {
            brief,
            outline,
            notes: options.notes || cached.notes || loredeckCreatorNotes,
            revisionInstruction,
            previousTitleDrafts: Array.isArray(options.previousTitleDrafts) ? options.previousTitleDrafts.slice(0, 120) : [],
            selectedTitleDrafts,
            targetTitleBatch,
            draftedTitleBatchIds: [...getLoredeckCreatorTitleDraftedBatchIds(cached)],
            titlePassLimit: effectiveTitlePassLimit,
        };
        let responseText = '';
        let parsed = null;
        let generationOptions = null;
        let titleCommit = null;
        try {
            const result = await runLoredeckCreatorSingleUnitGeneration({
                generation,
                stage: revisionInstruction ? 'title_revision' : 'title_batch',
                unitId: options.unitIdOverride || buildLoredeckCreatorTitleGenerationUnitId(actionId, targetTitleBatch, selectedTitleDrafts),
                unitLabel: revisionInstruction ? 'Title revision' : (batchLabel ? `Title batch: ${batchLabel}` : 'Title batch'),
                currentStage: 'titles_drafting',
                unitMeta: {
                    actionId,
                    targetTitleBatchId: batchId,
                    targetTitleBatchLabel: batchLabel,
                    selectedTitleDraftIds: selectedTitleDrafts.map(draft => normalizeLoredeckCreatorTitleId(draft.titleId || draft.id || '', '')).filter(Boolean),
                    revisionInstruction,
                    titlePassLimit: effectiveTitlePassLimit,
                    retrySmallerSupported: !revisionInstruction,
                },
                requestOptions: {
                    batchId,
                    batchLabel,
                },
                requestContext,
                requestResponse: requestLoredeckCreatorTitleResponse,
                parseResponse: parseLoredeckCreatorTitleResponse,
                repairResponse: repairLoredeckCreatorTitleResponse,
                repairWarning: 'Creator Title Pass response was normalized into Saga title-draft format.',
                isRepairUsable: isLoredeckCreatorParsedTitlePassUsable,
                resultRefType: revisionInstruction ? 'creator_title_revision' : 'creator_title_batch',
                commitParsedResult: async ({ parsedResult }) => {
                    if (!parsedResult?.titleDrafts?.length) {
                        return {
                            resultRef: {
                                batchId,
                                batchLabel,
                                draftCount: 0,
                                status: parsedResult?.clarifyingQuestions?.length ? 'needs_input' : 'empty',
                            },
                        };
                    }
                    const commit = commitLoredeckCreatorTitleDraftResult(parsedResult, {
                        revisionInstruction,
                        selectedTitleDrafts,
                        targetTitleBatch,
                    });
                    return {
                        titleCommit: commit,
                        resultRef: {
                            batchId: commit.batchId || batchId,
                            batchLabel: commit.batchLabel || batchLabel,
                            draftCount: commit.draftCount,
                            replacedCount: commit.replacedCount,
                            revisedMode: commit.revisedMode,
                            titleIds: commit.titleIds,
                        },
                    };
                },
            });
            if (result?.aborted || ignoreStaleLoredeckCreatorGeneration(generation, 'title draft')) return { status: 'stale' };
            responseText = result.responseText;
            parsed = result.parsed;
            generationOptions = result.requestOptions;
            titleCommit = result.commitResult?.titleCommit || null;
        } catch (e) {
            if (isLoredeckCreatorAbortError(e) || ignoreStaleLoredeckCreatorGeneration(generation, 'title draft')) return { status: 'stale' };
            markLoredeckCreatorActionFailed(e, 'Loredeck Creator title draft failed.');
            finishLoredeckCreatorGeneration(generation, 'error', e?.message || 'Title generation failed.');
            throw e;
        }
        if (!parsed.titleDrafts.length && !parsed.clarifyingQuestions.length && String(responseText || '').trim()) {
            try {
                const repairedText = await repairLoredeckCreatorTitleResponse(responseText, requestContext, generationOptions);
                if (ignoreStaleLoredeckCreatorGeneration(generation, 'title draft repair')) return { status: 'stale' };
                const repaired = parseLoredeckCreatorTitleResponse(repairedText);
                if (repaired.titleDrafts.length || repaired.clarifyingQuestions.length) {
                    parsed = {
                        ...repaired,
                        warnings: [
                            ...((repaired.warnings || [])),
                            'Creator Title Pass response was normalized into Saga title-draft format.',
                        ],
                    };
                    if (parsed.titleDrafts.length) {
                        titleCommit = commitLoredeckCreatorTitleDraftResult(parsed, {
                            revisionInstruction,
                            selectedTitleDrafts,
                            targetTitleBatch,
                        });
                    }
                }
            } catch (repairError) {
                console.warn('[Saga] Loredeck Creator title repair failed:', repairError);
            }
        }
        if (ignoreStaleLoredeckCreatorGeneration(generation, 'title draft commit')) return { status: 'stale' };
        if (parsed.clarifyingQuestions.length && !parsed.titleDrafts.length) {
            updateLoredeckCreatorTitleCache(current => ({
                ...current,
                titlePassSummary: parsed.summary || current.titlePassSummary || '',
                titlePassQuestions: parsed.clarifyingQuestions,
                titlePassWarnings: parsed.warnings,
                titleBatch: parsed.batch,
                status: 'needs_input',
                updatedAt: Date.now(),
            }));
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            finishLoredeckCreatorGeneration(generation, 'warning', `Needs clarification: ${parsed.clarifyingQuestions[0]}`);
            toast(`Loredeck Creator needs clarification: ${parsed.clarifyingQuestions[0]}`, 'warning');
            return { status: 'questions', questions: parsed.clarifyingQuestions, batchId, batchLabel };
        }
        if (!parsed.titleDrafts.length) {
            updateLoredeckCreatorTitleCache(current => ({
                ...current,
                titlePassSummary: parsed.summary || current.titlePassSummary || '',
                titlePassQuestions: parsed.clarifyingQuestions,
                titlePassWarnings: parsed.warnings,
                titleBatch: parsed.batch,
                status: 'needs_input',
                updatedAt: Date.now(),
            }));
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            finishLoredeckCreatorGeneration(generation, 'warning', parsed.warnings[0] || 'No title drafts returned.');
            toast(parsed.warnings[0] || 'Loredeck Creator returned no title drafts.', 'warning');
            return { status: 'empty', warnings: parsed.warnings, batchId, batchLabel };
        }
        const revisedMode = revisionInstruction && selectedTitleDrafts.length;
        if (!titleCommit) {
            titleCommit = commitLoredeckCreatorTitleDraftResult(parsed, {
                revisionInstruction,
                selectedTitleDrafts,
                targetTitleBatch,
            });
        }
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        if (revisedMode) {
            finishLoredeckCreatorGeneration(generation, 'success', `Revised ${selectedTitleDrafts.length} selected title draft${selectedTitleDrafts.length === 1 ? '' : 's'}.`);
            if (!options.suppressSuccessToast) toast(`Revised ${selectedTitleDrafts.length} selected title draft${selectedTitleDrafts.length === 1 ? '' : 's'} into ${parsed.titleDrafts.length} draft${parsed.titleDrafts.length === 1 ? '' : 's'}.`, 'success');
            return {
                status: 'revised',
                draftCount: parsed.titleDrafts.length,
                replacedCount: titleCommit?.replacedCount || selectedTitleDrafts.length,
                titleCommit,
            };
        }
        const successBatchLabel = batchLabel || targetTitleBatch?.label || targetTitleBatch?.id || 'title set';
        finishLoredeckCreatorGeneration(generation, 'success', `Drafted ${parsed.titleDrafts.length} ${successBatchLabel} title${parsed.titleDrafts.length === 1 ? '' : 's'}.`);
        if (!options.suppressSuccessToast) toast(`Loredeck Creator drafted ${parsed.titleDrafts.length} ${successBatchLabel} title${parsed.titleDrafts.length === 1 ? '' : 's'} for review.`, 'success');
        return {
            status: 'drafted',
            draftCount: parsed.titleDrafts.length,
            batchId: titleCommit?.batchId || batchId,
            batchLabel: titleCommit?.batchLabel || successBatchLabel,
            titleCommit,
        };
}

async function handleLoredeckCreatorTitleDraft(options = {}, button = null) {
    let result = null;
    await runBusyAction(button, options.revisionInstruction ? 'Revising...' : 'Drafting...', async () => {
        result = await performLoredeckCreatorTitleDraft(options);
    });
    return result;
}

async function performLoredeckCreatorRemainingTitleBatches(options = {}) {
    const settings = getLoredeckCreatorGenerationSettings();
    const configuredLimit = settings.titleRunRemainingLimit;
    const maxBatches = Math.max(1, Math.min(configuredLimit, Number(options.maxBatches) || configuredLimit));
    let completedBatches = 0;
    let draftedTitles = 0;
    let lastResult = null;
    let stoppedReason = '';
    for (let index = 0; index < maxBatches; index += 1) {
        const fresh = getLoredeckCreatorBriefCache();
        const batch = getLoredeckCreatorNextTitleBatch(fresh);
        if (!batch) {
            stoppedReason = 'complete';
            break;
        }
        lastResult = await performLoredeckCreatorTitleDraft({
            brief: fresh.brief || options.brief || {},
            notes: fresh.notes || loredeckCreatorNotes,
            targetTitleBatch: batch,
            previousTitleDrafts: getLoredeckCreatorTitleDrafts(fresh).map(compactLoredeckCreatorTitleDraftForRevision),
            suppressSuccessToast: true,
        });
        if (lastResult?.status !== 'drafted') {
            stoppedReason = lastResult?.status || 'stopped';
            break;
        }
        completedBatches += 1;
        draftedTitles += Number(lastResult.draftCount || 0);
    }
    const remaining = getLoredeckCreatorRemainingTitleBatches(getLoredeckCreatorBriefCache()).length;
    return {
        status: remaining ? (stoppedReason || 'limit_reached') : 'complete',
        completedBatches,
        draftedTitles,
        remainingBatches: remaining,
        lastResult,
        maxBatches,
    };
}

async function handleLoredeckCreatorRemainingTitleBatches(button = null) {
    let result = null;
    await runBusyAction(button, 'Generating batches...', async () => {
        const fresh = getLoredeckCreatorBriefCache();
        const remaining = getLoredeckCreatorRemainingTitleBatches(fresh);
        if (!remaining.length) {
            toast('All planned title batches are already drafted.', 'info');
            result = { status: 'complete', completedBatches: 0, draftedTitles: 0, remainingBatches: 0 };
            return;
        }
        const settings = getLoredeckCreatorGenerationSettings(fresh);
        const callCount = Math.min(settings.titleRunRemainingLimit, remaining.length);
        const confirmed = await confirmAction(
            'Generate Remaining Title Batches',
            `Saga will make up to ${callCount} separate Reasoning Provider call${callCount === 1 ? '' : 's'}, one title set per call. It will stop on clarification, empty output, failure, cancellation, or the current run limit. Continue?`
        );
        if (!confirmed) {
            result = { status: 'cancelled', completedBatches: 0, draftedTitles: 0, remainingBatches: remaining.length };
            return;
        }
        result = await performLoredeckCreatorRemainingTitleBatches({
            maxBatches: settings.titleRunRemainingLimit,
        });
        if (result.completedBatches > 0) {
            const remainingText = result.remainingBatches
                ? ` ${result.remainingBatches} title batch${result.remainingBatches === 1 ? '' : 'es'} remain.`
                : ' Title batches are complete.';
            toast(`Generated ${result.draftedTitles} title draft${result.draftedTitles === 1 ? '' : 's'} across ${result.completedBatches} batch${result.completedBatches === 1 ? '' : 'es'}.${remainingText}`, 'success');
            return;
        }
        if (result.status !== 'cancelled') {
            toast('No title batches were generated. Check the latest Creator status for details.', 'warning');
        }
    });
    return result;
}

function getLoredeckCreatorGeneratedPackId(cached = {}) {
    return normalizeLoredeckPackId(cached.generatedPackId || cached.brief?.packId || cached.brief?.title || 'generated-loredeck');
}

function buildLoredeckCreatorGeneratedTags(brief = {}) {
    const base = ['origin:generated', 'quality:model-drafted', 'saga:creator'];
    const fandom = normalizeLoredeckTagId(`fandom:${brief.fandom || ''}`);
    if (fandom) base.push(fandom);
    return parseLoredeckTags(base.join(', '));
}

function buildLoredeckCreatorGeneratedManifestSeed(packId = '', brief = {}) {
    return {
        schemaVersion: 3,
        id: packId,
        type: 'generated',
        title: brief.title || packId,
        description: brief.coverage || `Generated Loredeck draft for ${brief.scope || brief.fandom || packId}.`,
        fandom: brief.fandom || '',
        era: brief.scope || '',
        author: 'Saga Creator',
        version: '0.1.0',
        entrySchemaVersion: 3,
        files: [],
        registries: {
            timeline: 'timeline.json',
            tags: 'tags.json',
        },
        tags: buildLoredeckCreatorGeneratedTags(brief),
        stats: {
            entryCount: 0,
            categoryCounts: {},
        },
        health: {
            status: 'draft',
        },
    };
}

function buildLoredeckCreatorGeneratedPackRecord(cached = {}, packId = '', existing = null) {
    const brief = cached.brief || {};
    const id = normalizeLoredeckPackId(packId || getLoredeckCreatorGeneratedPackId(cached)) || getUniqueLoredeckPackId('generated-loredeck');
    const manifestSeed = buildLoredeckCreatorGeneratedManifestSeed(id, brief);
    const record = {
        ...(existing || {}),
        packId: id,
        type: 'generated',
        title: brief.title || existing?.title || id,
        description: brief.coverage || existing?.description || `Generated Loredeck draft for ${brief.scope || brief.fandom || id}.`,
        fandom: brief.fandom || existing?.fandom || '',
        era: brief.scope || existing?.era || '',
        author: existing?.author || 'Saga Creator',
        version: existing?.version || '0.1.0',
        entrySchemaVersion: 3,
        manifest: existing?.manifest || '',
        source: {
            ...(existing?.source || {}),
            kind: 'generated',
            url: '',
            updateUrl: '',
        },
        tags: Array.isArray(existing?.tags) && existing.tags.length ? existing.tags : manifestSeed.tags,
        stats: existing?.stats || manifestSeed.stats,
        healthStatus: existing?.healthStatus || 'draft',
        derivedFrom: existing?.derivedFrom || {
            kind: 'saga_creator',
            title: brief.title || id,
            fandom: brief.fandom || '',
            scope: brief.scope || '',
            granularity: brief.granularity || '',
            createdAt: Date.now(),
        },
        entryOverrides: existing?.entryOverrides || {},
        disabledEntryIds: Array.isArray(existing?.disabledEntryIds) ? existing.disabledEntryIds : [],
        tagRegistry: normalizeLoredeckTagRegistry(existing?.tagRegistry),
        timelineRegistry: normalizeLoredeckTimelineRegistry(existing?.timelineRegistry),
        pendingChanges: normalizeLoredeckPendingChanges(existing?.pendingChanges),
        installedAt: existing?.installedAt || Date.now(),
        updatedAt: Date.now(),
    };
    record.manifestData = buildEmbeddedCustomManifest(manifestSeed, record);
    return record;
}

function ensureLoredeckCreatorGeneratedPack(cached = getLoredeckCreatorBriefCache()) {
    const brief = cached.brief || {};
    if (!brief) {
        toast('Approve a Creator brief before creating a Generated Loredeck shell.', 'warning');
        return null;
    }
    let packId = getLoredeckCreatorGeneratedPackId(cached);
    let existing = packId ? getLoredeckDefinition(packId) : null;
    if (!packId || existing?.type === 'bundled') {
        packId = getUniqueLoredeckPackId(brief.packId || brief.title || 'generated-loredeck');
        existing = null;
    } else if (existing && existing.type !== 'generated') {
        packId = getUniqueLoredeckPackId(`${packId}-generated`);
        existing = null;
    }
    if (!existing && getLoredeckDefinition(packId)) {
        packId = getUniqueLoredeckPackId(`${packId}-generated`);
    }
    const record = buildLoredeckCreatorGeneratedPackRecord(cached, packId, existing);
    const result = upsertLoredeckLibraryPack(record);
    if (!result.ok) {
        toast(result.error || 'Generated Loredeck shell could not be saved.', 'error');
        return null;
    }
    loredeckManifestPreviewCache.set(packId, {
        manifest: record.manifestData,
        error: '',
        loadedAt: Date.now(),
    });
    clearCanonLoreDatabaseCache();
    clearContextIndexCache();
    setLoredeckCreatorBriefCache({
        ...getLoredeckCreatorBriefCache(),
        generatedPackId: packId,
        generatedPackTitle: record.title,
        generatedPackCreatedAt: cached.generatedPackCreatedAt || Date.now(),
    });
    refreshLoredeckSurfaces();
    return getLoredeckDefinition(packId) || result.pack || record;
}

function getLoredeckCreatorPlanningExistingTimelineIds(pack = {}) {
    const registry = normalizeLoredeckTimelineRegistry(pack.timelineRegistry);
    return [
        ...(registry.anchors || []).map(anchor => anchor.id),
        ...(registry.windows || []).map(windowDef => windowDef.id),
    ].filter(Boolean).slice(0, 160);
}

function getLoredeckCreatorPlanningExistingTagIds(pack = {}) {
    return Object.keys(normalizeLoredeckTagRegistry(pack.tagRegistry).tags || {}).slice(0, 240);
}

function markLoredeckCreatorPlanningChange(change = {}) {
    const actionMap = {
        assistant_upsert_tag_definition: 'creator_upsert_tag_definition',
        assistant_upsert_timeline_anchor: 'creator_upsert_timeline_anchor',
        assistant_upsert_timeline_window: 'creator_upsert_timeline_window',
    };
    const title = String(change.title || '')
        .replace(/Lore Assistant/gi, 'Loredeck Creator')
        .trim();
    return {
        ...change,
        source: 'loredeck_creator',
        action: actionMap[change.action] || change.action,
        title: title || change.title,
        description: change.description || 'Loredeck Creator proposed planning metadata for review.',
    };
}

function getLoredeckCreatorPlanningQueuedBatchIds(cached = {}) {
    return new Set(normalizeLoredeckCreatorTitleIdList(cached?.planningBatchQueuedIds || [], 1200));
}

const LOREDECK_CREATOR_PLANNING_ACTIONS = new Set([
    'upsert_tag_definition',
    'upsert_timeline_anchor',
    'upsert_timeline_window',
]);

function isLoredeckCreatorPlanningProposal(proposal = {}) {
    return LOREDECK_CREATOR_PLANNING_ACTIONS.has(String(proposal?.action || '').trim());
}

function isLoredeckCreatorParsedPlanningUsable(parsed = null) {
    return !!parsed
        && ((Array.isArray(parsed.proposals) && parsed.proposals.length > 0)
            || (Array.isArray(parsed.clarifyingQuestions) && parsed.clarifyingQuestions.length > 0));
}

function getLoredeckCreatorPlanningBatchIdentity(batch = {}) {
    const id = normalizeLoredeckCreatorTitleId(batch?.id || batch?.label || '', '');
    return {
        id,
        label: String(batch?.label || id || 'Context Set').trim(),
    };
}

function buildLoredeckCreatorPlanningGenerationUnitId(targetPlanningBatch = null, targetApprovedTitles = []) {
    const batchIdentity = getLoredeckCreatorPlanningBatchIdentity(targetPlanningBatch || {});
    const titleSeed = Array.isArray(targetApprovedTitles)
        ? targetApprovedTitles
            .map(item => normalizeLoredeckCreatorTitleId(item?.titleId || item?.id || item?.title || '', ''))
            .filter(Boolean)
            .sort()
            .join('_')
        : '';
    const seed = `${batchIdentity.id || 'next_context_set'}:${titleSeed || 'approved_titles'}`;
    return `creator_planning_batch:${seed}`.replace(/[^a-zA-Z0-9:._-]+/g, '_').slice(0, 220);
}

function getLoredeckCreatorPlanningBatchRows(cached = {}) {
    const titleBatches = getLoredeckCreatorTitleBatchRows(cached);
    const approvedTitles = getLoredeckCreatorApprovedTitleDrafts(cached);
    const rowsById = new Map(titleBatches.map(batch => [batch.id, { ...batch, approvedTitles: [] }]));
    for (const draft of approvedTitles) {
        const id = normalizeLoredeckCreatorTitleId(draft.creatorTitleBatchId || 'unbatched', 'unbatched');
        if (!rowsById.has(id)) {
            rowsById.set(id, {
                id,
                label: draft.creatorTitleBatchLabel || humanizeScopeKey(id),
                type: 'title_batch',
                order: rowsById.size + 1,
                summary: 'Approved titles without a matching Story Outline title set.',
                contextRole: '',
                titleTargets: [],
                approvedTitles: [],
            });
        }
        rowsById.get(id).approvedTitles.push(draft);
    }
    return [...rowsById.values()]
        .map(row => ({
            ...row,
            approvedTitleCount: row.approvedTitles.length,
        }))
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}

function getLoredeckCreatorNextPlanningBatch(cached = {}) {
    const queued = getLoredeckCreatorPlanningQueuedBatchIds(cached);
    return getLoredeckCreatorPlanningBatchRows(cached)
        .find(batch => batch.approvedTitleCount > 0 && !queued.has(batch.id)) || null;
}

function compactLoredeckCreatorPlanningBatchForPrompt(batch = {}) {
    return {
        id: batch.id || '',
        label: batch.label || '',
        type: batch.type || '',
        order: Number.isFinite(Number(batch.order)) ? Math.round(Number(batch.order)) : null,
        summary: batch.summary || '',
        contextRole: batch.contextRole || '',
        titleTargets: Array.isArray(batch.titleTargets) ? batch.titleTargets.slice(0, 8) : [],
        approvedTitleCount: Number.isFinite(Number(batch.approvedTitleCount)) ? Math.round(Number(batch.approvedTitleCount)) : 0,
    };
}

function markLoredeckCreatorPlanningChangeForBatch(change = {}, batch = {}) {
    const marked = markLoredeckCreatorPlanningChange(change);
    const { id, label } = getLoredeckCreatorPlanningBatchIdentity(batch);
    if (id || label) {
        marked.description = `${marked.description || 'Loredeck Creator proposed planning metadata for review.'} Batch: ${label || id}.`;
        marked.preview = {
            ...(marked.preview || {}),
            creatorPlanningBatch: {
                id,
                label,
            },
        };
    }
    return marked;
}

function createLoredeckCreatorPlanningChangeId(change = {}, batch = {}, index = 0) {
    const { id: batchId } = getLoredeckCreatorPlanningBatchIdentity(batch);
    const target = [
        change.targetKind,
        change.action,
        ...(change.affectedTagIds || []),
        ...(change.affectedTimelineIds || []),
        change.title || '',
        String(index + 1),
    ].filter(Boolean).join('_');
    return `creator_plan_${batchId || 'batch'}_${target || index + 1}`
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .slice(0, 220);
}

function prepareLoredeckCreatorPlanningChange(change = {}, batch = {}, index = 0) {
    const marked = markLoredeckCreatorPlanningChangeForBatch(change, batch);
    return {
        ...marked,
        changeId: createLoredeckCreatorPlanningChangeId(marked, batch, index),
    };
}

function buildLoredeckCreatorPlanningChanges(pack = {}, parsed = {}, targetPlanningBatch = {}) {
    const proposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
    const allowed = proposals.filter(isLoredeckCreatorPlanningProposal);
    const changes = buildLoredeckAssistantPendingChanges(pack, allowed, [])
        .filter(change => ['tag', 'timeline_anchor', 'timeline_window'].includes(change.targetKind))
        .map((change, index) => prepareLoredeckCreatorPlanningChange(change, targetPlanningBatch, index));
    return {
        allowed,
        ignoredCount: proposals.length - allowed.length,
        changes,
    };
}

function isLoredeckCreatorPlanningPendingChange(change = {}, batchId = '') {
    if (String(change?.source || '').trim() !== 'loredeck_creator') return false;
    if (!['tag', 'timeline_anchor', 'timeline_window'].includes(change.targetKind)) return false;
    if (!batchId) return true;
    return normalizeLoredeckCreatorTitleId(change.preview?.creatorPlanningBatch?.id || '', '') === batchId;
}

function countLoredeckCreatorPlanningPendingChanges(pack = {}) {
    return getLoredeckPendingChanges(pack).filter(change => isLoredeckCreatorPlanningPendingChange(change)).length;
}

function upsertLoredeckCreatorPlanningPendingChanges(pack = {}, changes = [], targetPlanningBatch = {}, message = '') {
    const pendingChanges = normalizeLoredeckPendingChanges(changes);
    if (!pendingChanges.length) {
        return {
            queued: false,
            changeCount: 0,
            replacedCount: 0,
            pendingChangeIds: [],
        };
    }
    const { id: batchId } = getLoredeckCreatorPlanningBatchIdentity(targetPlanningBatch);
    const incomingIds = new Set(pendingChanges.map(change => change.changeId));
    let replacedCount = 0;
    const queued = persistLoredeckLibraryRecordMutation(pack, next => {
        const pending = normalizeLoredeckPendingChanges(next.pendingChanges);
        const retained = pending.filter(change => {
            const replace = incomingIds.has(change.changeId) || (batchId && isLoredeckCreatorPlanningPendingChange(change, batchId));
            if (replace) replacedCount += 1;
            return !replace;
        });
        next.pendingChanges = normalizeLoredeckPendingChanges([...retained, ...pendingChanges]);
    }, message, {
        errorMessage: 'Loredeck Creator planning proposal save failed.',
    });
    return {
        queued,
        changeCount: queued ? pendingChanges.length : 0,
        replacedCount: queued ? replacedCount : 0,
        pendingChangeIds: queued ? pendingChanges.map(change => change.changeId) : [],
    };
}

function commitLoredeckCreatorPlanningResult(parsed = {}, options = {}) {
    const pack = options.pack;
    const targetPlanningBatch = options.targetPlanningBatch || {};
    const targetBatchId = normalizeLoredeckCreatorTitleId(options.targetBatchId || targetPlanningBatch.id || targetPlanningBatch.label || '', '');
    if (!pack?.packId) {
        if (options.throwOnFailure) throw new Error('Generated Loredeck shell is missing.');
        return { queued: false, changeCount: 0, replacedCount: 0, pendingChangeIds: [], warnings: [] };
    }
    const { ignoredCount, changes } = buildLoredeckCreatorPlanningChanges(pack, parsed, targetPlanningBatch);
    const warnings = [
        ...(Array.isArray(parsed?.warnings) ? parsed.warnings : []),
        ...(ignoredCount ? [`Ignored ${ignoredCount} non-planning proposal${ignoredCount === 1 ? '' : 's'}.`] : []),
    ];
    if (!changes.length) {
        return {
            queued: false,
            changeCount: 0,
            replacedCount: 0,
            pendingChangeIds: [],
            ignoredCount,
            warnings,
        };
    }
    const queueResult = upsertLoredeckCreatorPlanningPendingChanges(pack, changes, targetPlanningBatch);
    if (!queueResult.queued) {
        if (options.throwOnFailure) throw new Error('Could not queue Creator planning proposals for Pending Review.');
        return {
            ...queueResult,
            ignoredCount,
            warnings,
        };
    }
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    const nextQueuedBatchIds = getLoredeckCreatorPlanningQueuedBatchIds(getLoredeckCreatorBriefCache());
    if (targetBatchId) nextQueuedBatchIds.add(targetBatchId);
    setLoredeckCreatorBriefCache({
        ...getLoredeckCreatorBriefCache(),
        planningSummary: parsed.summary,
        planningQuestions: parsed.clarifyingQuestions,
        planningWarnings: warnings,
        planningQueuedCount: countLoredeckCreatorPlanningPendingChanges(fresh),
        planningBatchQueuedIds: [...nextQueuedBatchIds],
        planningCurrentBatchId: targetBatchId,
        planningCurrentBatchLabel: targetPlanningBatch.label || targetBatchId,
        planningQueuedAt: Date.now(),
        generatedPackId: pack.packId,
        generatedPackTitle: pack.title || pack.packId,
        status: 'draft',
    });
    return {
        ...queueResult,
        ignoredCount,
        warnings,
        batchId: targetBatchId,
        batchLabel: targetPlanningBatch.label || targetBatchId,
    };
}

async function handleLoredeckCreatorPlanningDraft(options = {}, button = null) {
    if (options?.nodeType === 1) {
        button = options;
        options = {};
    }
    await runBusyAction(button, 'Planning...', async () => {
        if (!ensureLoreProviderReadyForAction('Loredeck Creator', 'lore')) return;
        const cached = getLoredeckCreatorBriefCache();
        const brief = cached.brief || {};
        if (!cached.approved || !brief) {
            toast('Approve a Creator brief before planning Context and Tags.', 'warning');
            return;
        }
        const outline = getLoredeckCreatorOutline(cached);
        if (!cached.outlineApproved || !outline) {
            toast('Approve the Story Outline before planning Context and Tags.', 'warning');
            return;
        }
        const approvedTitles = getLoredeckCreatorApprovedTitleDrafts(cached);
        if (!approvedTitles.length) {
            toast('Approve title drafts before planning Context and Tags.', 'warning');
            return;
        }
        const targetPlanningBatch = options.targetPlanningBatch || getLoredeckCreatorNextPlanningBatch(cached);
        if (!targetPlanningBatch) {
            toast('All eligible Context and Tag sets have already been planned.', 'info');
            return;
        }
        const targetBatchId = normalizeLoredeckCreatorTitleId(targetPlanningBatch.id || targetPlanningBatch.label || '', '');
        const queuedBatchIds = getLoredeckCreatorPlanningQueuedBatchIds(cached);
        if (targetBatchId && queuedBatchIds.has(targetBatchId)) {
            toast('That Context and Tag set has already been planned.', 'info');
            return;
        }
        const targetApprovedTitles = approvedTitles.filter(draft => normalizeLoredeckCreatorTitleId(draft.creatorTitleBatchId || 'unbatched', 'unbatched') === targetBatchId);
        if (!targetApprovedTitles.length) {
            toast('Approve at least one title in this set before planning Context and Tags.', 'warning');
            return;
        }
        const pack = ensureLoredeckCreatorGeneratedPack(cached);
        if (!pack) return;
        const { generation } = startLoredeckCreatorGeneration(
            'planning_batch_draft',
            'Planning Context & Tags',
            {
                ...cached,
                currentStage: 'planning_drafting',
                generatedPackId: pack.packId,
                generatedPackTitle: pack.title || pack.packId,
            },
            {
                batchId: targetBatchId,
                batchLabel: targetPlanningBatch.label || targetBatchId,
            }
        );
        if (!generation) return;
        let responseText = '';
        const generationSettings = getLoredeckCreatorGenerationSettings(cached);
        const effectiveProposalLimit = clampLoredeckCreatorInteger(
            options.planningProposalLimitOverride,
            1,
            24,
            generationSettings.planningProposalLimit
        );
        const requestContext = {
            generatedPackId: pack.packId,
            brief,
            outline,
            notes: cached.notes || loredeckCreatorNotes,
            targetPlanningBatch: compactLoredeckCreatorPlanningBatchForPrompt({
                ...targetPlanningBatch,
                approvedTitleCount: targetApprovedTitles.length,
            }),
            approvedTitleDrafts: targetApprovedTitles.map(compactLoredeckCreatorTitleDraftForRevision).slice(0, 40),
            existingTimelineIds: getLoredeckCreatorPlanningExistingTimelineIds(pack),
            existingTagIds: getLoredeckCreatorPlanningExistingTagIds(pack),
            queuedPlanningBatchIds: [...queuedBatchIds],
            proposalLimit: effectiveProposalLimit,
        };
        let generationOptions = null;
        let parsed = null;
        let planningCommit = null;
        try {
            const result = await runLoredeckCreatorSingleUnitGeneration({
                generation,
                stage: 'context_tag_planning',
                unitId: options.unitIdOverride || buildLoredeckCreatorPlanningGenerationUnitId(targetPlanningBatch, targetApprovedTitles),
                unitLabel: targetPlanningBatch.label ? `Context plan: ${targetPlanningBatch.label}` : 'Context and Tag plan',
                currentStage: 'planning_drafting',
                unitMeta: {
                    actionId: 'planning_batch_draft',
                    targetPlanningBatchId: targetBatchId,
                    targetPlanningBatchLabel: targetPlanningBatch.label || targetBatchId,
                    approvedTitleDraftIds: targetApprovedTitles.map(draft => normalizeLoredeckCreatorTitleId(draft.titleId || draft.id || '', '')).filter(Boolean),
                    proposalLimit: effectiveProposalLimit,
                    retrySmallerSupported: true,
                },
                requestOptions: {
                    batchId: targetBatchId,
                    batchLabel: targetPlanningBatch.label || targetBatchId,
                },
                requestContext,
                requestResponse: requestLoredeckCreatorPlanningResponse,
                parseResponse: parseLoredeckAssistantResponse,
                repairResponse: repairLoredeckCreatorPlanningResponse,
                repairWarning: 'Creator Context and Tag plan was normalized into Saga proposal format.',
                isRepairUsable: isLoredeckCreatorParsedPlanningUsable,
                resultRefType: 'creator_context_tag_plan',
                commitParsedResult: async ({ parsedResult }) => {
                    const commit = commitLoredeckCreatorPlanningResult(parsedResult, {
                        pack,
                        targetPlanningBatch,
                        targetBatchId,
                        throwOnFailure: true,
                    });
                    return {
                        planningCommit: commit,
                        resultRef: {
                            batchId: commit.batchId || targetBatchId,
                            batchLabel: commit.batchLabel || targetPlanningBatch.label || targetBatchId,
                            proposalCount: Array.isArray(parsedResult?.proposals) ? parsedResult.proposals.length : 0,
                            changeCount: commit.changeCount || 0,
                            replacedCount: commit.replacedCount || 0,
                            pendingChangeIds: commit.pendingChangeIds || [],
                            status: commit.queued
                                ? 'queued'
                                : (parsedResult?.clarifyingQuestions?.length ? 'needs_input' : 'empty'),
                        },
                    };
                },
            });
            if (result?.aborted || ignoreStaleLoredeckCreatorGeneration(generation, 'context/tag plan')) return;
            responseText = result.responseText;
            parsed = result.parsed;
            generationOptions = result.requestOptions;
            planningCommit = result.commitResult?.planningCommit || null;
        } catch (e) {
            if (isLoredeckCreatorAbortError(e) || ignoreStaleLoredeckCreatorGeneration(generation, 'context/tag plan')) return;
            markLoredeckCreatorActionFailed(e, 'Loredeck Creator planning draft failed.');
            finishLoredeckCreatorGeneration(generation, 'error', e?.message || 'Timeline/tag planning failed.');
            throw e;
        }
        if (!parsed) {
            parsed = { summary: '', clarifyingQuestions: [], warnings: [], proposals: [] };
        }
        const repairPlanningResult = async (warningMessage = 'Creator Context and Tag plan was normalized into Saga proposal format.') => {
            try {
                const repairedText = await repairLoredeckCreatorPlanningResponse(responseText, requestContext, generationOptions);
                if (ignoreStaleLoredeckCreatorGeneration(generation, 'context/tag plan repair')) return;
                const repaired = parseLoredeckAssistantResponse(repairedText);
                if (repaired.proposals.length || repaired.clarifyingQuestions.length) {
                    return {
                        ...repaired,
                        warnings: [
                            ...((repaired.warnings || [])),
                            warningMessage,
                        ],
                    };
                }
            } catch (repairError) {
                console.warn('[Saga] Loredeck Creator planning repair failed:', repairError);
            }
            return null;
        };
        if (!planningCommit?.queued && !parsed.proposals.length && !parsed.clarifyingQuestions.length && String(responseText || '').trim()) {
            const repaired = await repairPlanningResult();
            if (repaired) {
                parsed = repaired;
            }
        }
        if (ignoreStaleLoredeckCreatorGeneration(generation, 'context/tag plan commit')) return;
        if (!planningCommit?.queued
            && parsed.proposals.length
            && !parsed.clarifyingQuestions.length
            && !parsed.proposals.some(isLoredeckCreatorPlanningProposal)) {
            const repaired = await repairPlanningResult('Creator Context and Tag plan was normalized into supported planning proposal actions.');
            if (repaired) {
                parsed = repaired;
            }
        }
        const preview = buildLoredeckCreatorPlanningChanges(pack, parsed, targetPlanningBatch);
        const warnings = planningCommit?.warnings || [
            ...(parsed.warnings || []),
            ...(preview.ignoredCount ? [`Ignored ${preview.ignoredCount} non-planning proposal${preview.ignoredCount === 1 ? '' : 's'}.`] : []),
        ];
        if (!planningCommit?.queued && parsed.clarifyingQuestions.length && !preview.changes.length) {
            setLoredeckCreatorBriefCache({
                ...getLoredeckCreatorBriefCache(),
                planningSummary: parsed.summary,
                planningQuestions: parsed.clarifyingQuestions,
                planningWarnings: warnings,
                generatedPackId: pack.packId,
                generatedPackTitle: pack.title || pack.packId,
                planningCurrentBatchId: targetBatchId,
                planningCurrentBatchLabel: targetPlanningBatch.label || targetBatchId,
                status: 'needs_input',
            });
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            finishLoredeckCreatorGeneration(generation, 'warning', `Needs clarification: ${parsed.clarifyingQuestions[0]}`);
            toast(`Loredeck Creator needs clarification: ${parsed.clarifyingQuestions[0]}`, 'warning');
            return;
        }
        if (!planningCommit?.queued && !preview.changes.length) {
            setLoredeckCreatorBriefCache({
                ...getLoredeckCreatorBriefCache(),
                planningSummary: parsed.summary,
                planningQuestions: parsed.clarifyingQuestions,
                planningWarnings: warnings,
                generatedPackId: pack.packId,
                generatedPackTitle: pack.title || pack.packId,
                planningCurrentBatchId: targetBatchId,
                planningCurrentBatchLabel: targetPlanningBatch.label || targetBatchId,
                status: 'needs_input',
            });
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            finishLoredeckCreatorGeneration(generation, 'warning', warnings[0] || 'No planning proposals returned.');
            toast(warnings[0] || 'Loredeck Creator returned no Context or Tag planning proposals.', 'warning');
            return;
        }
        if (!planningCommit?.queued) {
            try {
                planningCommit = commitLoredeckCreatorPlanningResult(parsed, {
                    pack,
                    targetPlanningBatch,
                    targetBatchId,
                    throwOnFailure: true,
                });
            } catch (error) {
                if (ignoreStaleLoredeckCreatorGeneration(generation, 'context/tag plan commit')) return;
                markLoredeckCreatorActionFailed(error, 'Could not queue Creator planning proposals for Pending Review.');
                finishLoredeckCreatorGeneration(generation, 'error', error?.message || 'Could not queue planning proposals.');
                throw error;
            }
        }
        selectLoredeckForDetails(pack.packId, { refresh: false });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
        const changeCount = Number(planningCommit?.changeCount) || preview.changes.length;
        finishLoredeckCreatorGeneration(generation, 'success', `Drafted ${changeCount} planning proposal${changeCount === 1 ? '' : 's'} for review.`);
        toast(`Drafted ${changeCount} ${targetPlanningBatch.label || targetBatchId} planning proposal${changeCount === 1 ? '' : 's'} for Pending Review.`, 'success');
    });
}

function getLoredeckCreatorAcceptedPlanningStatus(pack = null) {
    const timeline = normalizeLoredeckTimelineRegistry(pack?.timelineRegistry);
    const tags = normalizeLoredeckTagRegistry(pack?.tagRegistry);
    const anchorCount = timeline.anchors?.length || 0;
    const windowCount = timeline.windows?.length || 0;
    const tagCount = Object.keys(tags.tags || {}).length;
    return {
        timeline,
        tags,
        anchorCount,
        windowCount,
        tagCount,
        ready: (anchorCount + windowCount) > 0 && tagCount > 0,
    };
}

function compactLoredeckCreatorTimelineAnchorForPrompt(anchor = {}) {
    return {
        id: anchor.id || '',
        label: anchor.label || '',
        contextType: anchor.contextType || '',
        sortKey: Number.isFinite(Number(anchor.sortKey)) ? Number(anchor.sortKey) : null,
        dateRange: isPlainObjectValue(anchor.dateRange) ? anchor.dateRange : null,
        book: anchor.book || '',
        work: anchor.work || '',
        arc: anchor.arc || '',
        phase: anchor.phase || '',
        season: anchor.season || '',
        episode: anchor.episode || '',
        chapter: anchor.chapter || '',
        issue: anchor.issue || '',
        quest: anchor.quest || '',
        gameStage: anchor.gameStage || '',
        aliases: Array.isArray(anchor.aliases) ? anchor.aliases.slice(0, 12) : [],
        tags: Array.isArray(anchor.tags) ? anchor.tags.slice(0, 16) : [],
        notes: truncateText(anchor.notes || '', 500),
    };
}

function compactLoredeckCreatorTimelineWindowForPrompt(windowDef = {}) {
    return {
        id: windowDef.id || '',
        label: windowDef.label || '',
        contextType: windowDef.contextType || '',
        anchorFrom: windowDef.anchorFrom || '',
        anchorTo: windowDef.anchorTo || '',
        sortKeyFrom: Number.isFinite(Number(windowDef.sortKeyFrom)) ? Number(windowDef.sortKeyFrom) : null,
        sortKeyTo: Number.isFinite(Number(windowDef.sortKeyTo)) ? Number(windowDef.sortKeyTo) : null,
        dateRange: isPlainObjectValue(windowDef.dateRange) ? windowDef.dateRange : null,
        aliases: Array.isArray(windowDef.aliases) ? windowDef.aliases.slice(0, 12) : [],
        tags: Array.isArray(windowDef.tags) ? windowDef.tags.slice(0, 16) : [],
        notes: truncateText(windowDef.notes || '', 500),
    };
}

function compactLoredeckCreatorTimelineRegistryForPrompt(timeline = {}) {
    const registry = normalizeLoredeckTimelineRegistry(timeline);
    return {
        schemaVersion: registry.schemaVersion || 1,
        timelineMode: registry.timelineMode || 'hybrid',
        defaultContextType: registry.defaultContextType || '',
        sortKeyScale: registry.sortKeyScale || 'pack_local',
        summary: truncateText(registry.summary || '', 800),
        anchors: (registry.anchors || []).slice(0, 120).map(compactLoredeckCreatorTimelineAnchorForPrompt),
        windows: (registry.windows || []).slice(0, 120).map(compactLoredeckCreatorTimelineWindowForPrompt),
    };
}

function compactLoredeckCreatorTagRegistryForPrompt(registry = {}) {
    const normalized = normalizeLoredeckTagRegistry(registry);
    const tags = {};
    let count = 0;
    for (const [id, def] of Object.entries(normalized.tags || {})) {
        tags[id] = {
            label: def.label || humanizeLoredeckTagId(id),
            description: truncateText(def.description || '', 500),
            aliases: Array.isArray(def.aliases) ? def.aliases.slice(0, 12) : [],
            parents: Array.isArray(def.parents) ? def.parents.slice(0, 12) : [],
            sensitive: def.sensitive === true,
            deprecated: def.deprecated === true,
            replacement: def.replacement || '',
        };
        count += 1;
        if (count >= 200) break;
    }
    return {
        schemaVersion: normalized.schemaVersion || 1,
        tags,
    };
}

function getLoredeckCreatorBlockedEntryIds(pack = {}, draftCache = null) {
    pack = pack || {};
    const blocked = new Set(Object.keys(pack.entryOverrides || {}).map(id => normalizeLoredeckEntryId(id)).filter(Boolean));
    for (const id of normalizeLoredeckPendingChanges(pack.pendingChanges).flatMap(change => change.affectedEntryIds || [])) {
        const clean = normalizeLoredeckEntryId(id);
        if (clean) blocked.add(clean);
    }
    for (const id of getLoredeckAssistantDraftChanges(draftCache || loredeckAssistantDraftCache.get(pack.packId) || {}).flatMap(change => change.affectedEntryIds || [])) {
        const clean = normalizeLoredeckEntryId(id);
        if (clean) blocked.add(clean);
    }
    return blocked;
}

function getLoredeckCreatorEntryBatchLimit(limit = null, cached = getLoredeckCreatorBriefCache()) {
    const settings = getLoredeckCreatorGenerationSettings(cached);
    const fallback = settings.entryBatchSize || LOREDECK_CREATOR_ENTRY_BATCH_SIZE;
    return Math.max(1, Math.min(LOREDECK_CREATOR_ENTRY_BATCH_MAX, Number(limit ?? fallback) || fallback));
}

function getLoredeckCreatorPlanningAcceptedBatchIds(cached = {}) {
    return new Set(normalizeLoredeckCreatorTitleIdList(cached?.planningBatchAcceptedIds || [], 1200));
}

function getLoredeckCreatorEntryEligibleBatchIds(cached = {}, planning = null) {
    const accepted = getLoredeckCreatorPlanningAcceptedBatchIds(cached);
    if (accepted.size) return accepted;
    const queued = getLoredeckCreatorPlanningQueuedBatchIds(cached);
    if (queued.size) return new Set();
    if (planning?.ready) {
        return new Set(getLoredeckCreatorTitleBatchRows(cached).map(batch => batch.id).filter(Boolean));
    }
    return new Set();
}

function getLoredeckCreatorTitleBatchById(cached = {}, batchId = '') {
    const id = normalizeLoredeckCreatorTitleId(batchId || '', '');
    return getLoredeckCreatorTitleBatchRows(cached).find(batch => batch.id === id) || null;
}

function getLoredeckCreatorDraftBatchId(draft = {}) {
    return normalizeLoredeckCreatorTitleId(draft.creatorTitleBatchId || 'unbatched', 'unbatched');
}

function getLoredeckCreatorEntryDraftPool(cached = {}, pack = {}) {
    const planning = getLoredeckCreatorAcceptedPlanningStatus(pack || {});
    const eligibleBatchIds = getLoredeckCreatorEntryEligibleBatchIds(cached, planning);
    const approved = getLoredeckCreatorApprovedTitleDrafts(cached);
    const eligibleApproved = approved.filter(draft => eligibleBatchIds.has(getLoredeckCreatorDraftBatchId(draft)));
    const blocked = getLoredeckCreatorBlockedEntryIds(pack || {});
    const selectedIds = getLoredeckCreatorSelectedTitleIds(cached);
    const selectedApproved = eligibleApproved.filter(draft => selectedIds.has(draft.titleId));
    const preferred = selectedApproved.length ? selectedApproved : eligibleApproved;
    const batchOrder = getLoredeckCreatorTitleBatchRows(cached).map(batch => batch.id);
    let activeBatchId = selectedApproved.length
        ? getLoredeckCreatorDraftBatchId(selectedApproved[0])
        : '';
    if (!activeBatchId) {
        activeBatchId = batchOrder.find(batchId => eligibleBatchIds.has(batchId)
            && preferred.some(draft => getLoredeckCreatorDraftBatchId(draft) === batchId && !blocked.has(normalizeLoredeckEntryId(draft.titleId)))) || '';
    }
    if (!activeBatchId) {
        activeBatchId = preferred.find(draft => !blocked.has(normalizeLoredeckEntryId(draft.titleId)))
            ? getLoredeckCreatorDraftBatchId(preferred.find(draft => !blocked.has(normalizeLoredeckEntryId(draft.titleId))))
            : '';
    }
    const source = activeBatchId
        ? preferred.filter(draft => getLoredeckCreatorDraftBatchId(draft) === activeBatchId)
        : preferred;
    const remaining = source.filter(draft => {
        const id = normalizeLoredeckEntryId(draft.titleId);
        return id && !blocked.has(id);
    });
    return {
        approved,
        eligibleApproved,
        eligibleBatchIds,
        activeBatchId,
        activeBatch: getLoredeckCreatorTitleBatchById(cached, activeBatchId),
        selectedApproved,
        source,
        blocked,
        remaining,
    };
}

function getLoredeckCreatorEntryDraftProgress(cached = {}, pack = {}) {
    const pool = getLoredeckCreatorEntryDraftPool(cached, pack || {});
    const remainingCount = pool.remaining.length;
    const sourceCount = pool.source.length;
    const batchSize = getLoredeckCreatorEntryBatchLimit(null, cached);
    return {
        ...pool,
        batchSize,
        remainingCount,
        handledCount: Math.max(0, sourceCount - remainingCount),
        batchCount: remainingCount ? Math.ceil(remainingCount / batchSize) : 0,
        eligibleBatchCount: pool.eligibleBatchIds?.size || 0,
        activeBatchLabel: pool.activeBatch?.label || pool.activeBatchId || '',
    };
}

function getLoredeckCreatorEntryTargetTitles(cached = {}, pack = {}, limit = null) {
    const batchLimit = getLoredeckCreatorEntryBatchLimit(limit, cached);
    return getLoredeckCreatorEntryDraftPool(cached, pack || {}).remaining.slice(0, batchLimit);
}

function getLoredeckCreatorExistingEntryIdsForPrompt(pack = {}) {
    const ids = new Set();
    for (const id of Object.keys(pack.entryOverrides || {})) {
        const clean = normalizeLoredeckEntryId(id);
        if (clean) ids.add(clean);
    }
    for (const change of normalizeLoredeckPendingChanges(pack.pendingChanges)) {
        for (const id of change.affectedEntryIds || []) {
            const clean = normalizeLoredeckEntryId(id);
            if (clean) ids.add(clean);
        }
    }
    for (const change of getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(pack.packId) || {})) {
        for (const id of change.affectedEntryIds || []) {
            const clean = normalizeLoredeckEntryId(id);
            if (clean) ids.add(clean);
        }
    }
    return [...ids].slice(0, 240);
}

function compactLoredeckCreatorEntryTitleForPrompt(draft = {}) {
    return {
        ...compactLoredeckCreatorTitleDraftForRevision(draft),
        targetEntryId: normalizeLoredeckEntryId(draft.titleId),
    };
}

function markLoredeckCreatorEntryChange(change = {}, pack = {}, batch = {}) {
    const title = String(change.title || '')
        .replace(/Lore Assistant/gi, 'Loredeck Creator')
        .trim();
    const payload = cloneLoredeckJson(change.payload) || {};
    const batchId = normalizeLoredeckCreatorTitleId(batch?.id || batch?.label || '', '');
    const batchLabel = String(batch?.label || batchId || '').trim();
    const entryOverrides = isPlainObjectValue(payload.entryOverrides) ? payload.entryOverrides : {};
    for (const entry of Object.values(entryOverrides)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        entry.source = `saga-loredeck:${pack.packId || ''}:creator`;
        entry.extensions = {
            ...(entry.extensions || {}),
            sagaLoredeckCreator: {
                packId: pack.packId || '',
                source: 'loredeck_creator',
                planningBatchId: batchId,
                planningBatchLabel: batchLabel,
                draftedAt: Date.now(),
            },
        };
        if (entry.extensions?.sagaLoredeckOverride) {
            entry.extensions.sagaLoredeckOverride.source = 'loredeck_creator';
        }
    }
    return {
        ...change,
        source: 'loredeck_creator',
        action: change.action === 'assistant_upsert_entry' ? 'creator_upsert_entry' : change.action,
        title: title || change.title,
        description: `${change.description || 'Loredeck Creator drafted a schema v3 Lorecard for review.'}${batchLabel ? ` Batch: ${batchLabel}.` : ''}`,
        payload,
        preview: {
            ...(change.preview || {}),
            creatorEntryBatch: {
                id: batchId,
                label: batchLabel,
            },
        },
    };
}

function isLoredeckCreatorParsedEntryDraftUsable(parsed = null) {
    return !!parsed
        && ((Array.isArray(parsed.proposals) && parsed.proposals.length > 0)
            || (Array.isArray(parsed.clarifyingQuestions) && parsed.clarifyingQuestions.length > 0));
}

function getLoredeckCreatorEntryTargetIds(targetTitles = []) {
    return new Set((Array.isArray(targetTitles) ? targetTitles : [])
        .map(draft => normalizeLoredeckEntryId(draft?.titleId || draft?.id || draft?.targetEntryId || ''))
        .filter(Boolean));
}

function buildLoredeckCreatorEntryGenerationUnitId(targetPlanningBatch = null, targetTitles = []) {
    const batchId = normalizeLoredeckCreatorTitleId(targetPlanningBatch?.id || targetPlanningBatch?.label || '', '');
    const titleSeed = [...getLoredeckCreatorEntryTargetIds(targetTitles)].sort().join('_') || 'target_titles';
    return `creator_entry_micro_batch:${batchId || 'context_set'}:${titleSeed}`
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .slice(0, 220);
}

function createLoredeckCreatorEntryChangeId(change = {}, batch = {}, unitId = '', index = 0) {
    const batchId = normalizeLoredeckCreatorTitleId(batch?.id || batch?.label || '', '');
    const entryId = normalizeLoredeckEntryId((change.affectedEntryIds || [])[0] || Object.keys(change.payload?.entryOverrides || {})[0] || '');
    const seed = [batchId || 'batch', entryId || change.title || index + 1, unitId || 'unit'].filter(Boolean).join('_');
    return `creator_entry_${seed}`
        .replace(/[^a-zA-Z0-9:._-]+/g, '_')
        .slice(0, 220);
}

function prepareLoredeckCreatorEntryChange(change = {}, pack = {}, batch = {}, unitId = '', targetTitles = [], index = 0) {
    const marked = markLoredeckCreatorEntryChange(change, pack, batch);
    const targetEntryIds = [...getLoredeckCreatorEntryTargetIds(targetTitles)];
    return {
        ...marked,
        changeId: createLoredeckCreatorEntryChangeId(marked, batch, unitId, index),
        preview: {
            ...(marked.preview || {}),
            creatorEntryBatch: {
                ...(marked.preview?.creatorEntryBatch || {}),
                unitId,
                targetEntryIds,
            },
        },
    };
}

function buildLoredeckCreatorEntryDraftChanges(pack = {}, parsed = {}, rows = [], targetTitles = [], targetPlanningBatch = {}, unitId = '') {
    const proposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
    const targetEntryIds = getLoredeckCreatorEntryTargetIds(targetTitles);
    const allowed = proposals.filter(proposal => {
        if (proposal.action !== 'upsert_entry') return false;
        const proposalId = normalizeLoredeckEntryId(proposal.entryId || proposal.entry?.id);
        return proposalId && targetEntryIds.has(proposalId);
    });
    const changes = buildLoredeckAssistantPendingChanges(pack, allowed, rows)
        .filter(change => change.targetKind === 'entry')
        .map((change, index) => prepareLoredeckCreatorEntryChange(change, pack, targetPlanningBatch, unitId, targetTitles, index));
    return {
        allowed,
        ignoredCount: proposals.length - allowed.length,
        changes,
    };
}

function isLoredeckCreatorEntryDraftChange(change = {}, unitId = '') {
    if (String(change?.source || '').trim() !== 'loredeck_creator') return false;
    if (change.targetKind !== 'entry') return false;
    if (!unitId) return true;
    return String(change.preview?.creatorEntryBatch?.unitId || '').trim() === unitId;
}

function countLoredeckCreatorEntryDraftUnits(changes = []) {
    const units = new Set();
    for (const change of changes || []) {
        if (!isLoredeckCreatorEntryDraftChange(change)) continue;
        const unitId = String(change.preview?.creatorEntryBatch?.unitId || change.changeId || '').trim();
        if (unitId) units.add(unitId);
    }
    return units.size;
}

function upsertLoredeckCreatorEntryDraftChanges(pack = {}, changes = [], context = {}) {
    const draftChanges = normalizeLoredeckPendingChanges(changes);
    if (!pack?.packId || !draftChanges.length) {
        return {
            queued: false,
            changeCount: 0,
            replacedCount: 0,
            draftChangeIds: [],
        };
    }
    const unitId = String(context.unitId || '').trim();
    const incomingIds = new Set(draftChanges.map(change => change.changeId));
    let replacedCount = 0;
    const nextCache = updateLoredeckAssistantDraftCache(pack.packId, current => {
        const existing = getLoredeckAssistantDraftChanges(current);
        const selectedIds = getLoredeckAssistantSelectedDraftIds(current);
        const retained = existing.filter(change => {
            const replace = incomingIds.has(change.changeId) || (unitId && isLoredeckCreatorEntryDraftChange(change, unitId));
            if (replace) {
                replacedCount += 1;
                selectedIds.delete(change.changeId);
            }
            return !replace;
        });
        for (const change of draftChanges) selectedIds.add(change.changeId);
        const nextChanges = normalizeLoredeckPendingChanges([...retained, ...draftChanges]);
        const creatorDraftCount = nextChanges.filter(change => isLoredeckCreatorEntryDraftChange(change)).length;
        return {
            ...current,
            source: 'loredeck_creator',
            summary: context.summary || `Creator drafted ${draftChanges.length} schema v3 Lorecard${draftChanges.length === 1 ? '' : 's'}.`,
            questions: Array.isArray(context.questions) ? context.questions : [],
            warnings: Array.isArray(context.warnings) ? context.warnings : [],
            proposalCount: Number.isFinite(Number(context.proposalCount)) ? Number(context.proposalCount) : (Number(current.proposalCount) || 0),
            queuedCount: Number(current.queuedCount) || 0,
            draftChanges: nextChanges,
            selectedDraftChangeIds: [...selectedIds].filter(id => nextChanges.some(change => change.changeId === id)),
            mode: 'creator_entry_generation',
            targetScope: 'approved_titles',
            creatorEntryDraftCount: creatorDraftCount,
            creatorEntryBatchCount: countLoredeckCreatorEntryDraftUnits(nextChanges),
            createdAt: current.createdAt || Date.now(),
            updatedAt: Date.now(),
        };
    });
    return {
        queued: true,
        changeCount: draftChanges.length,
        replacedCount,
        draftChangeIds: draftChanges.map(change => change.changeId),
        draftCount: getLoredeckAssistantDraftChanges(nextCache).length,
    };
}

function commitLoredeckCreatorEntryDraftResult(parsed = {}, options = {}) {
    const pack = options.pack;
    const rows = Array.isArray(options.rows) ? options.rows : [];
    const targetTitles = Array.isArray(options.targetTitles) ? options.targetTitles : [];
    const targetPlanningBatch = options.targetPlanningBatch || {};
    const unitId = String(options.unitId || buildLoredeckCreatorEntryGenerationUnitId(targetPlanningBatch, targetTitles)).trim();
    if (!pack?.packId) {
        if (options.throwOnFailure) throw new Error('Generated Loredeck shell is missing.');
        return { queued: false, changeCount: 0, replacedCount: 0, draftChangeIds: [], warnings: [] };
    }
    const { ignoredCount, changes } = buildLoredeckCreatorEntryDraftChanges(pack, parsed, rows, targetTitles, targetPlanningBatch, unitId);
    const warnings = [
        ...(Array.isArray(parsed?.warnings) ? parsed.warnings : []),
        ...(ignoredCount ? [`Ignored ${ignoredCount} proposal${ignoredCount === 1 ? '' : 's'} outside this micro-batch.`] : []),
    ];
    if (!changes.length) {
        return {
            queued: false,
            changeCount: 0,
            replacedCount: 0,
            draftChangeIds: [],
            ignoredCount,
            warnings,
        };
    }
    const draftResult = upsertLoredeckCreatorEntryDraftChanges(pack, changes, {
        unitId,
        summary: parsed.summary,
        questions: parsed.clarifyingQuestions,
        warnings,
        proposalCount: Array.isArray(parsed?.proposals) ? parsed.proposals.length : 0,
    });
    if (!draftResult.queued) {
        if (options.throwOnFailure) throw new Error('Could not write Creator Lorecard drafts to the draft-review queue.');
        return {
            ...draftResult,
            ignoredCount,
            warnings,
        };
    }
    const freshCache = getLoredeckCreatorBriefCache();
    const freshProgress = getLoredeckCreatorEntryDraftProgress(freshCache, pack);
    const allDrafts = getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(pack.packId) || {});
    setLoredeckCreatorBriefCache({
        ...freshCache,
        entryDraftSummary: parsed.summary,
        entryDraftQuestions: parsed.clarifyingQuestions,
        entryDraftWarnings: warnings,
        entryDraftCount: allDrafts.filter(change => isLoredeckCreatorEntryDraftChange(change)).length,
        entryDraftLastBatchCount: draftResult.changeCount,
        entryDraftLastTargetCount: targetTitles.length,
        entryDraftRemainingCount: freshProgress.remainingCount,
        entryDraftBatchSize: getLoredeckCreatorEntryBatchLimit(options.batchSize, freshCache),
        entryDraftCurrentBatchId: targetPlanningBatch?.id || '',
        entryDraftCurrentBatchLabel: targetPlanningBatch?.label || '',
        entryDraftedAt: Date.now(),
        generatedPackId: pack.packId,
        generatedPackTitle: pack.title || pack.packId,
        status: 'draft',
    });
    return {
        ...draftResult,
        ignoredCount,
        warnings,
        unitId,
        batchId: targetPlanningBatch?.id || '',
        batchLabel: targetPlanningBatch?.label || '',
    };
}

async function draftLoredeckCreatorEntryBatch(cached = {}, pack = {}, planning = {}, options = {}) {
    const brief = cached.brief || {};
    const batchSize = getLoredeckCreatorEntryBatchLimit(options.batchSize, cached);
    const targetTitleIds = new Set(normalizeLoredeckCreatorTitleIdList(options.targetTitleIds || [], 200, 180));
    const targetPlanningBatchId = normalizeLoredeckCreatorTitleId(options.targetPlanningBatchId || options.targetPlanningBatch?.id || '', '');
    let targetTitles = [];
    if (targetTitleIds.size || targetPlanningBatchId) {
        const pool = getLoredeckCreatorEntryDraftPool(cached, pack || {});
        targetTitles = pool.remaining
            .filter(draft => {
                const draftId = normalizeLoredeckCreatorTitleId(draft.titleId || draft.id || '', '');
                if (targetTitleIds.size && !targetTitleIds.has(draftId)) return false;
                if (targetPlanningBatchId && getLoredeckCreatorDraftBatchId(draft) !== targetPlanningBatchId) return false;
                return true;
            })
            .slice(0, batchSize);
    } else {
        targetTitles = getLoredeckCreatorEntryTargetTitles(cached, pack, batchSize);
    }
    if (!targetTitles.length) return { status: 'empty_pool', changeCount: 0, targetCount: 0 };

    const rows = getLoredeckEditableEntryRows(pack, []);
    const progress = getLoredeckCreatorEntryDraftProgress(cached, pack);
    const targetPlanningBatch = options.targetPlanningBatch
        || (targetPlanningBatchId ? getLoredeckCreatorTitleBatchById(cached, targetPlanningBatchId) : null)
        || progress.activeBatch
        || getLoredeckCreatorTitleBatchById(cached, progress.activeBatchId);
    if (options.generation) {
        updateLoredeckCreatorGeneration(options.generation, {
            type: 'phase',
            phase: 'batch',
            message: `Drafting Lorecards for ${targetPlanningBatch?.label || targetPlanningBatch?.id || 'current batch'}...`,
            streamSupported: null,
        }, {
            batchId: targetPlanningBatch?.id || '',
            batchLabel: targetPlanningBatch?.label || '',
            batchIndex: options.batchIndex ?? null,
            batchTotal: options.batchTotal ?? null,
        });
    }
    const unitId = options.unitIdOverride || buildLoredeckCreatorEntryGenerationUnitId(targetPlanningBatch, targetTitles);
    const requestContext = {
        generatedPackId: pack.packId,
        brief,
        notes: cached.notes || loredeckCreatorNotes,
        targetPlanningBatch: targetPlanningBatch ? compactLoredeckCreatorPlanningBatchForPrompt({
            ...targetPlanningBatch,
            approvedTitleCount: progress.source.length,
        }) : null,
        acceptedPlanningBatchIds: [...getLoredeckCreatorPlanningAcceptedBatchIds(cached)],
        targetTitleDrafts: targetTitles.map(compactLoredeckCreatorEntryTitleForPrompt),
        timelineRegistry: compactLoredeckCreatorTimelineRegistryForPrompt(planning.timeline),
        tagRegistry: compactLoredeckCreatorTagRegistryForPrompt(planning.tags),
        existingEntryIds: getLoredeckCreatorExistingEntryIdsForPrompt(pack),
        entryBatchLimit: targetTitles.length,
        remainingTitleCount: progress.remainingCount,
        remainingAfterThisBatch: Math.max(0, progress.remainingCount - targetTitles.length),
    };
    let parsed = null;
    let responseText = '';
    let generationOptions = null;
    let entryCommit = null;
    try {
        const result = await runLoredeckCreatorSingleUnitGeneration({
            generation: options.generation,
            stage: 'entry_micro_batch',
            unitId,
            unitLabel: targetPlanningBatch?.label ? `Lorecard batch: ${targetPlanningBatch.label}` : 'Lorecard micro-batch',
            currentStage: 'entries_drafting',
            unitMeta: {
                actionId: 'entry_batch_draft',
                targetPlanningBatchId: targetPlanningBatch?.id || targetPlanningBatchId || '',
                targetPlanningBatchLabel: targetPlanningBatch?.label || '',
                targetTitleIds: targetTitles.map(draft => normalizeLoredeckCreatorTitleId(draft.titleId || draft.id || '', '')).filter(Boolean),
                batchSize,
                retrySmallerSupported: true,
            },
            requestOptions: {
                batchId: targetPlanningBatch?.id || '',
                batchLabel: targetPlanningBatch?.label || '',
                batchIndex: options.batchIndex ?? null,
                batchTotal: options.batchTotal ?? null,
            },
            requestContext,
            requestResponse: requestLoredeckCreatorEntryResponse,
            parseResponse: parseLoredeckAssistantResponse,
            repairResponse: repairLoredeckCreatorEntryResponse,
            repairWarning: 'Creator Lorecard batch was normalized into Saga proposal format.',
            isRepairUsable: isLoredeckCreatorParsedEntryDraftUsable,
            resultRefType: 'creator_entry_micro_batch',
            commitParsedResult: async ({ parsedResult }) => {
                const commit = commitLoredeckCreatorEntryDraftResult(parsedResult, {
                    pack,
                    rows,
                    targetTitles,
                    targetPlanningBatch,
                    unitId,
                    batchSize,
                    throwOnFailure: true,
                });
                return {
                    entryCommit: commit,
                    resultRef: {
                        unitId,
                        batchId: commit.batchId || targetPlanningBatch?.id || '',
                        batchLabel: commit.batchLabel || targetPlanningBatch?.label || '',
                        proposalCount: Array.isArray(parsedResult?.proposals) ? parsedResult.proposals.length : 0,
                        draftCount: commit.changeCount || 0,
                        replacedCount: commit.replacedCount || 0,
                        draftChangeIds: commit.draftChangeIds || [],
                        status: commit.queued
                            ? 'draft_review'
                            : (parsedResult?.clarifyingQuestions?.length ? 'needs_input' : 'empty'),
                    },
                };
            },
        });
        if (result?.aborted || (options.generation && ignoreStaleLoredeckCreatorGeneration(options.generation, 'entry draft'))) {
            return { status: 'stale', changeCount: 0, targetCount: targetTitles.length };
        }
        responseText = result.responseText;
        parsed = result.parsed;
        generationOptions = result.requestOptions;
        entryCommit = result.commitResult?.entryCommit || null;
    } catch (error) {
        if (options.generation && (isLoredeckCreatorAbortError(error) || ignoreStaleLoredeckCreatorGeneration(options.generation, 'entry draft'))) {
            return { status: 'stale', changeCount: 0, targetCount: targetTitles.length };
        }
        throw error;
    }
    if (!parsed) {
        parsed = { summary: '', clarifyingQuestions: [], warnings: [], proposals: [] };
    }
    const repairEntryResult = async (warningMessage = 'Creator Lorecard batch was normalized into Saga proposal format.') => {
        try {
            const repairedText = await repairLoredeckCreatorEntryResponse(responseText, requestContext, generationOptions);
            if (options.generation && ignoreStaleLoredeckCreatorGeneration(options.generation, 'entry draft repair')) {
                return { stale: true, parsed: null };
            }
            const repaired = parseLoredeckAssistantResponse(repairedText);
            if (repaired.proposals.length || repaired.clarifyingQuestions.length) {
                return {
                    stale: false,
                    parsed: {
                        ...repaired,
                        warnings: [
                            ...((repaired.warnings || [])),
                            warningMessage,
                        ],
                    },
                };
            }
        } catch (repairError) {
            console.warn('[Saga] Loredeck Creator entry repair failed:', repairError);
        }
        return { stale: false, parsed: null };
    };
    if (!entryCommit?.queued && !parsed.proposals.length && !parsed.clarifyingQuestions.length && String(responseText || '').trim()) {
        const repaired = await repairEntryResult();
        if (repaired.stale) return { status: 'stale', changeCount: 0, targetCount: targetTitles.length };
        if (repaired.parsed) parsed = repaired.parsed;
    }
    if (!entryCommit?.queued
        && parsed.proposals.length
        && !parsed.clarifyingQuestions.length
        && !parsed.proposals.some(proposal => proposal.action === 'upsert_entry')) {
        const repaired = await repairEntryResult('Creator Lorecard batch was normalized into supported entry proposal actions.');
        if (repaired.stale) return { status: 'stale', changeCount: 0, targetCount: targetTitles.length };
        if (repaired.parsed) parsed = repaired.parsed;
    }
    const preview = buildLoredeckCreatorEntryDraftChanges(pack, parsed, rows, targetTitles, targetPlanningBatch, unitId);
    const warnings = entryCommit?.warnings || [
        ...(parsed.warnings || []),
        ...(preview.ignoredCount ? [`Ignored ${preview.ignoredCount} proposal${preview.ignoredCount === 1 ? '' : 's'} outside this micro-batch.`] : []),
    ];

    if (!entryCommit?.queued && parsed.clarifyingQuestions.length && !preview.changes.length) {
        setLoredeckCreatorBriefCache({
            ...getLoredeckCreatorBriefCache(),
            entryDraftSummary: parsed.summary,
            entryDraftQuestions: parsed.clarifyingQuestions,
            entryDraftWarnings: warnings,
            generatedPackId: pack.packId,
            generatedPackTitle: pack.title || pack.packId,
            status: 'needs_input',
        });
        return { status: 'questions', changeCount: 0, targetCount: targetTitles.length, parsed, warnings };
    }
    if (!entryCommit?.queued && !preview.changes.length) {
        setLoredeckCreatorBriefCache({
            ...getLoredeckCreatorBriefCache(),
            entryDraftSummary: parsed.summary,
            entryDraftQuestions: parsed.clarifyingQuestions,
            entryDraftWarnings: warnings,
            generatedPackId: pack.packId,
            generatedPackTitle: pack.title || pack.packId,
            status: 'needs_input',
        });
        return { status: 'empty', changeCount: 0, targetCount: targetTitles.length, parsed, warnings };
    }
    if (!entryCommit?.queued) {
        entryCommit = commitLoredeckCreatorEntryDraftResult(parsed, {
            pack,
            rows,
            targetTitles,
            targetPlanningBatch,
            unitId,
            batchSize,
            throwOnFailure: true,
        });
    }
    return {
        status: 'drafted',
        changeCount: Number(entryCommit?.changeCount) || preview.changes.length,
        targetCount: targetTitles.length,
        proposalCount: parsed.proposals.length,
        parsed,
        warnings,
        entryCommit,
    };
}

async function handleLoredeckCreatorEntryDraft(button = null, options = {}) {
    const settings = getLoredeckCreatorGenerationSettings();
    const maxBatches = Math.max(1, Math.min(settings.entryRunRemainingLimit, Number(options.maxBatches) || 1));
    await runBusyAction(button, maxBatches > 1 ? 'Drafting batches...' : 'Drafting...', async () => {
        if (!ensureLoreProviderReadyForAction('Loredeck Creator', 'lore')) return;
        let cached = getLoredeckCreatorBriefCache();
        const brief = cached.brief || {};
        if (!cached.approved || !brief) {
            toast('Approve a Creator brief before drafting Lorecards.', 'warning');
            return;
        }
        let pack = cached.generatedPackId ? getFreshLoredeckLibraryPack(cached.generatedPackId, null) : null;
        if (!pack) {
            toast('Create and accept Creator planning before drafting Lorecards.', 'warning');
            return;
        }
        const openDrafts = getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(pack.packId) || {});
        if (openDrafts.length) {
            toast('Review the current Lorecard drafts before drafting more.', 'warning');
            return;
        }
        let planning = getLoredeckCreatorAcceptedPlanningStatus(pack);
        if (!planning.ready) {
            toast('Accept Context and Tag planning proposals before drafting Lorecards.', 'warning');
            return;
        }
        const eligibleBatchIds = getLoredeckCreatorEntryEligibleBatchIds(cached, planning);
        if (!eligibleBatchIds.size) {
            toast('Accept at least one planned Context and Tag set before drafting Lorecards.', 'warning');
            return;
        }
        if (!getLoredeckCreatorEntryTargetTitles(cached, pack).length) {
            toast('No undrafted approved titles are available for Lorecard generation.', 'info');
            return;
        }
        const actionId = maxBatches > 1 ? 'entry_multi_batch_draft' : 'entry_batch_draft';
        const { generation } = startLoredeckCreatorGeneration(
            actionId,
            maxBatches > 1 ? 'Drafting Lorecard Batches' : 'Drafting Lorecard Batch',
            {
                ...cached,
                currentStage: 'entries_drafting',
                generatedPackId: pack.packId,
                generatedPackTitle: pack.title || pack.packId,
            },
            {
                batchTotal: maxBatches,
            }
        );
        if (!generation) return;

        let totalChanges = 0;
        let completedBatches = 0;
        let lastResult = null;
        let staleResult = false;
        try {
            for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
                cached = getLoredeckCreatorBriefCache();
                pack = cached.generatedPackId ? getFreshLoredeckLibraryPack(cached.generatedPackId, pack) : pack;
                planning = getLoredeckCreatorAcceptedPlanningStatus(pack);
                if (!pack || !planning.ready) break;
                if (getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(pack.packId) || {}).length) break;
                if (!getLoredeckCreatorEntryTargetTitles(cached, pack).length) break;
                lastResult = await draftLoredeckCreatorEntryBatch(cached, pack, planning, {
                    generation,
                    batchIndex: batchIndex + 1,
                    batchTotal: maxBatches,
                    batchSize: options.batchSize,
                    targetTitleIds: options.targetTitleIds,
                    targetPlanningBatchId: options.targetPlanningBatchId,
                    unitIdOverride: options.unitIdOverride,
                });
                if (lastResult.status === 'stale') {
                    staleResult = true;
                    break;
                }
                if (lastResult.status === 'questions' || lastResult.status === 'empty' || lastResult.status === 'empty_pool') break;
                totalChanges += lastResult.changeCount || 0;
                completedBatches += 1;
                if (getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(pack.packId) || {}).length) break;
            }
        } catch (e) {
            if (isLoredeckCreatorAbortError(e) || ignoreStaleLoredeckCreatorGeneration(generation, 'entry draft')) return;
            if (totalChanges > 0) {
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
                refreshHeader();
                finishLoredeckCreatorGeneration(generation, 'warning', `Drafted ${totalChanges} Lorecard${totalChanges === 1 ? '' : 's'} before a later batch stopped.`);
                toast(`Creator drafted ${totalChanges} Lorecard${totalChanges === 1 ? '' : 's'} before a later batch stopped: ${e?.message || e}`, 'warning');
                return;
            }
            setLoredeckCreatorBriefCache({
                ...getLoredeckCreatorBriefCache(),
                status: 'blocked',
                currentStage: 'blocked',
                errors: [
                    ...((getLoredeckCreatorBriefCache().errors || []).slice(-20)),
                    e?.message || 'Loredeck Creator entry drafting failed.',
                ],
                lastFailedAt: Date.now(),
            });
            finishLoredeckCreatorGeneration(generation, 'error', e?.message || 'Lorecard entry drafting failed.');
            throw e;
        }
        if (staleResult || ignoreStaleLoredeckCreatorGeneration(generation, 'entry draft commit')) return;

        if (!pack) {
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            finishLoredeckCreatorGeneration(generation, 'warning', 'Generated Loredeck is no longer available for drafting.');
            toast('Generated Loredeck is no longer available for drafting.', 'warning');
            return;
        }
        selectLoredeckForDetails(pack.packId, { refresh: false });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
        if (lastResult?.status === 'questions') {
            finishLoredeckCreatorGeneration(generation, 'warning', `Needs clarification: ${lastResult.parsed?.clarifyingQuestions?.[0] || 'Creator needs clarification.'}`);
            toast(`Loredeck Creator needs clarification: ${lastResult.parsed?.clarifyingQuestions?.[0]}`, 'warning');
            return;
        }
        if (lastResult?.status === 'empty') {
            finishLoredeckCreatorGeneration(generation, 'warning', lastResult.warnings?.[0] || 'No valid Lorecard drafts returned.');
            toast(lastResult.warnings?.[0] || 'Loredeck Creator returned no valid schema v3 Lorecard drafts for this micro-batch.', 'warning');
            return;
        }
        if (!totalChanges) {
            finishLoredeckCreatorGeneration(generation, 'warning', 'No undrafted approved titles are available.');
            toast('No undrafted approved titles are available for Lorecard generation.', 'info');
            return;
        }
        const batchText = completedBatches > 1 ? ` across ${completedBatches} batches` : '';
        finishLoredeckCreatorGeneration(generation, 'success', `Drafted ${totalChanges} schema v3 Lorecard${totalChanges === 1 ? '' : 's'}${batchText}.`);
        toast(`Creator drafted ${totalChanges} schema v3 Lorecard${totalChanges === 1 ? '' : 's'} into the draft batch${batchText}.`, 'success');
    });
}

function getContextResolutionProposals(state = getState()) {
    return Array.isArray(state?.lorePanel?.contextResolutionProposals)
        ? state.lorePanel.contextResolutionProposals.filter(proposal => proposal?.packId && proposal?.patch && typeof proposal.patch === 'object')
        : [];
}

function getContextResolutionProposalKey(proposal = {}) {
    return [
        String(proposal.packId || '').trim(),
        String(proposal.candidateId || '').trim(),
        String(proposal.candidateType || '').trim(),
        JSON.stringify(proposal.patch || {}),
    ].join('|');
}

function removeContextResolutionProposalsByKeys(keys = []) {
    const state = getState();
    if (!state?.lorePanel) return 0;
    const keySet = new Set((keys || []).map(key => String(key || '')).filter(Boolean));
    if (!keySet.size) return getContextResolutionProposals(state).length;
    state.lorePanel.contextResolutionProposals = getContextResolutionProposals(state)
        .filter(proposal => !keySet.has(getContextResolutionProposalKey(proposal)));
    if (!state.lorePanel.contextResolutionProposals.length) state.lorePanel.contextResolutionProposalMeta = null;
    saveState(state, { syncPrompt: false });
    return state.lorePanel.contextResolutionProposals.length;
}

function clearContextResolutionProposals() {
    const state = getState();
    if (!state?.lorePanel) return;
    state.lorePanel.contextResolutionProposals = [];
    state.lorePanel.contextResolutionProposalMeta = null;
    saveState(state, { syncPrompt: false });
}

function applyContextResolutionProposalSet(proposals = getContextResolutionProposals(), options = {}) {
    const selected = (Array.isArray(proposals) ? proposals : [])
        .filter(proposal => proposal?.packId && proposal?.patch && typeof proposal.patch === 'object');
    if (!selected.length) return 0;
    const applied = applyContextResolutionResults(selected.map(proposal => ({
        packId: proposal.packId,
        status: 'resolved',
        changed: true,
        patch: proposal.patch,
    })));
    if (options.clearAll === true) {
        clearContextResolutionProposals();
    } else {
        removeContextResolutionProposalsByKeys(selected.map(getContextResolutionProposalKey));
    }
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    refreshContextWorkbench();
    renderContextProposalReview();
    return applied;
}

function dismissContextResolutionProposalSet(proposals = getContextResolutionProposals(), options = {}) {
    const selected = (Array.isArray(proposals) ? proposals : [])
        .filter(proposal => proposal?.packId);
    if (!selected.length) return 0;
    if (options.clearAll === true) {
        clearContextResolutionProposals();
    } else {
        removeContextResolutionProposalsByKeys(selected.map(getContextResolutionProposalKey));
    }
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    renderContextProposalReview();
    return selected.length;
}

function storeContextResolutionAuditFromResult(result = null, context = {}, sourceText = '', source = 'manual_context') {
    const state = getState();
    if (!state?.lorePanel) return null;
    const audit = buildContextResolutionAudit(result || {}, context || {}, {
        source,
        sourceText,
    });
    state.lorePanel.contextResolutionAudit = audit;
    saveState(state, { syncPrompt: false });
    return audit;
}

function storeContextResolutionProposalsFromResult(result = null, context = {}) {
    if (result?.status === 'in_flight') return getContextResolutionProposals().length;
    const proposals = Array.isArray(result?.proposals) ? result.proposals : [];
    const state = getState();
    if (!state?.lorePanel) return 0;
    if (result?.cacheRecord) {
        state.lorePanel.contextResolutionCache = result.cacheRecord;
    }
    state.lorePanel.contextResolutionProposals = proposals.map(proposal => ({
        packId: String(proposal.packId || '').trim(),
        candidateId: String(proposal.candidateId || '').trim(),
        candidateType: String(proposal.candidateType || '').trim(),
        label: String(proposal.label || '').trim().slice(0, 240),
        summary: String(proposal.summary || '').trim().slice(0, 500),
        confidence: Number.isFinite(Number(proposal.confidence)) ? Math.max(0, Math.min(1, Number(proposal.confidence))) : 0,
        patch: proposal.patch && typeof proposal.patch === 'object' && !Array.isArray(proposal.patch) ? { ...proposal.patch } : {},
    })).filter(proposal => proposal.packId && Object.keys(proposal.patch || {}).length);
    state.lorePanel.contextResolutionProposalMeta = proposals.length
        ? {
            createdAt: Date.now(),
            source: result?.cached === true ? 'manual_reasoner_cached' : 'manual_reasoner',
            contextLabel: context.label || context.canonBoundary || context.sceneDate || '',
            cached: result?.cached === true,
        }
        : null;
    saveState(state, { syncPrompt: false });
    return state.lorePanel.contextResolutionProposals.length;
}

function formatAnchorDateRange(anchor = {}) {
    const from = String(anchor.dateRange?.from || '').trim();
    const to = String(anchor.dateRange?.to || '').trim();
    if (from && to && from !== to) return `${from} to ${to}`;
    return from || to || '';
}

function parseLoredeckAnchorDateSortKey(value = '') {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const epoch = Date.UTC(year, month - 1, day);
    const check = new Date(epoch);
    if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
    return Math.floor(epoch / 86400000);
}

function getLoredeckAnchorStartSortKey(anchor = {}) {
    const explicit = Number(anchor.sortKey);
    if (Number.isFinite(explicit)) return explicit;
    return parseLoredeckAnchorDateSortKey(anchor.dateRange?.from || anchor.dateRange?.to || '');
}

function getLoredeckAnchorEndSortKey(anchor = {}) {
    return parseLoredeckAnchorDateSortKey(anchor.dateRange?.to || anchor.dateRange?.from || '') ?? getLoredeckAnchorStartSortKey(anchor);
}

function setLoredeckContextInputValue(input, value) {
    if (!input) return;
    input.value = value === null || value === undefined ? '' : String(value);
}

function applyAnchorToLoredeckContextFields(anchor = {}, fields = {}, mode = 'exact') {
    if (!fields || !anchor?.id) return;
    const id = String(anchor.id || '').trim();
    const label = String(anchor.label || id).trim();
    const startSort = getLoredeckAnchorStartSortKey(anchor);
    const endSort = getLoredeckAnchorEndSortKey(anchor);
    const precision = anchor.contextType === 'calendar' ? 'date_anchor' : 'anchor';

    if (mode === 'from') {
        if (fields.scopeSelect) fields.scopeSelect.value = 'window';
        setLoredeckContextInputValue(fields.validFromAnchorInput, id);
        setLoredeckContextInputValue(fields.sortKeyFromInput, startSort);
        if (!fields.precisionInput?.value) setLoredeckContextInputValue(fields.precisionInput, 'anchor_window');
        if (!fields.labelInput?.value) setLoredeckContextInputValue(fields.labelInput, `After ${label}`);
        return;
    }

    if (mode === 'to') {
        if (fields.scopeSelect) fields.scopeSelect.value = 'window';
        setLoredeckContextInputValue(fields.validToAnchorInput, id);
        setLoredeckContextInputValue(fields.sortKeyToInput, endSort);
        if (!fields.precisionInput?.value) setLoredeckContextInputValue(fields.precisionInput, 'anchor_window');
        if (!fields.labelInput?.value) setLoredeckContextInputValue(fields.labelInput, `Before ${label}`);
        return;
    }

    if (fields.scopeSelect) fields.scopeSelect.value = 'anchor';
    setLoredeckContextInputValue(fields.anchorIdInput, id);
    setLoredeckContextInputValue(fields.validFromAnchorInput, id);
    setLoredeckContextInputValue(fields.validToAnchorInput, id);
    setLoredeckContextInputValue(fields.sortKeyFromInput, startSort);
    setLoredeckContextInputValue(fields.sortKeyToInput, endSort);
    if (fields.windowKindSelect) fields.windowKindSelect.value = 'bounded';
    setLoredeckContextInputValue(fields.precisionInput, fields.precisionInput?.value || precision);
    setLoredeckContextInputValue(fields.labelInput, label);
}

function createLoredeckEntryAnchorPicker(pack, contextFields = {}, options = {}) {
    const box = document.createElement('div');
    box.className = 'saga-context-anchor-lookup';

    const top = document.createElement('div');
    top.className = 'saga-context-anchor-lookup-top';

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'saga-lore-editor-input';
    input.placeholder = 'Search timeline anchors';
    addTooltip(input, 'Search this Loredeck timeline by book, event, arc, alias, date, or tag.');
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    top.appendChild(input);

    const results = document.createElement('div');
    results.className = 'saga-context-anchor-results';

    const renderResults = () => {
        results.innerHTML = '';
        const contextIndex = getContextIndexSync();
        const packId = String(pack?.packId || '').trim();
        const query = input.value.trim();
        const packIndex = getContextPackSummary(contextIndex, packId);
        if (!contextIndex) {
            results.appendChild(createEmptyMessage('Context index is loading. Load this Loredeck in the active stack to search anchors.'));
            return;
        }
        if (!packIndex?.hasIndex) {
            results.appendChild(createEmptyMessage('No loaded timeline registry for this Loredeck. Add it to the active stack or inspect a pack with timeline data.'));
            return;
        }
        if (!query) {
            results.appendChild(createEmptyMessage('Search by event, book, arc, date, alias, or tag.'));
            return;
        }
        const matches = findContextAnchors(query, { packId, limit: options.limit || 8, index: contextIndex });
        if (!matches.length) {
            results.appendChild(createEmptyMessage('No matching anchors.'));
            return;
        }
        for (const anchor of matches) {
            results.appendChild(createLoredeckEntryAnchorPickerResult(anchor, contextFields));
        }
    };

    top.appendChild(createButton('Find', 'Search timeline anchors in this Loredeck.', renderResults));
    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        renderResults();
    });
    box.appendChild(top);
    results.appendChild(createEmptyMessage('Search loaded timeline anchors to fill Context fields.'));
    box.appendChild(results);
    return box;
}

function createLoredeckEntryAnchorPickerResult(anchor = {}, contextFields = {}) {
    const row = document.createElement('div');
    row.className = 'saga-context-anchor-result';

    const main = document.createElement('div');
    main.className = 'saga-context-anchor-main';
    const title = document.createElement('div');
    title.className = 'saga-context-anchor-title';
    title.textContent = anchor.label || anchor.id || 'Anchor';
    main.appendChild(title);
    const meta = document.createElement('div');
    meta.className = 'saga-context-anchor-meta';
    meta.textContent = [
        anchor.id,
        formatAnchorDateRange(anchor),
        anchor.book,
        anchor.arc,
        anchor.aliases?.slice(0, 2).join(', '),
    ].filter(Boolean).join(' | ');
    main.appendChild(meta);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    actions.appendChild(createButton('Exact', 'Use this anchor as the exact Context.', () => {
        applyAnchorToLoredeckContextFields(anchor, contextFields, 'exact');
    }, 'saga-primary-button'));
    actions.appendChild(createButton('From', 'Use this anchor as the start of a Context window.', () => {
        applyAnchorToLoredeckContextFields(anchor, contextFields, 'from');
    }));
    actions.appendChild(createButton('To', 'Use this anchor as the end of a Context window.', () => {
        applyAnchorToLoredeckContextFields(anchor, contextFields, 'to');
    }));
    row.appendChild(actions);
    return row;
}

function createContextAnchorLookup(packId, contextIndex = getContextIndexSync()) {
    const box = document.createElement('div');
    box.className = 'saga-context-anchor-lookup';

    const top = document.createElement('div');
    top.className = 'saga-context-anchor-lookup-top';

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'saga-lore-editor-input';
    input.placeholder = 'Search timeline anchors';
    addTooltip(input, 'Search this Loredeck timeline by book, event, arc, alias, date, or tag.');
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    top.appendChild(input);

    const results = document.createElement('div');
    results.className = 'saga-context-anchor-results';

    const renderResults = () => {
        results.innerHTML = '';
        const query = input.value.trim();
        const packIndex = getContextPackSummary(contextIndex, packId);
        if (!contextIndex) {
            results.appendChild(createEmptyMessage('Context index is loading.'));
            return;
        }
        if (!packIndex?.hasIndex) {
            results.appendChild(createEmptyMessage('This Loredeck has no timeline registry loaded.'));
            return;
        }
        if (!query) {
            results.appendChild(createEmptyMessage('Search by event, book, arc, date, alias, or tag.'));
            return;
        }
        const matches = findContextAnchors(query, { packId, limit: 6, index: contextIndex });
        if (!matches.length) {
            results.appendChild(createEmptyMessage('No matching anchors.'));
            return;
        }
        for (const anchor of matches) {
            results.appendChild(createContextAnchorResult(packId, anchor));
        }
    };

    top.appendChild(createButton('Find', 'Search timeline anchors in this Loredeck.', renderResults));
    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        renderResults();
    });
    box.appendChild(top);
    renderResults();
    box.appendChild(results);
    return box;
}

function createContextAnchorResult(packId, anchor = {}) {
    const row = document.createElement('div');
    row.className = 'saga-context-anchor-result';

    const main = document.createElement('div');
    main.className = 'saga-context-anchor-main';

    const title = document.createElement('div');
    title.className = 'saga-context-anchor-title';
    title.textContent = anchor.label || anchor.id || 'Anchor';
    main.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'saga-context-anchor-meta';
    const details = [
        formatAnchorDateRange(anchor),
        anchor.book,
        anchor.arc,
        anchor.aliases?.slice(0, 2).join(', '),
    ].filter(Boolean);
    meta.textContent = details.join(' | ') || anchor.id || '';
    main.appendChild(meta);
    row.appendChild(main);

    row.appendChild(createButton('Use', 'Use this anchor as the Context for this Loredeck.', () => {
        applyContextAnchor(packId, anchor);
    }, 'saga-primary-button'));
    return row;
}

function applyContextAnchor(packId, anchor = {}) {
    const firstDate = String(anchor.dateRange?.from || anchor.dateRange?.to || '').trim();
    const sortKey = getLoredeckAnchorStartSortKey(anchor);
    commitLoredeckContextPatch(packId, {
        contextType: anchor.contextType || 'anchor',
        anchorId: anchor.id || '',
        anchorFrom: '',
        anchorTo: '',
        label: anchor.label || anchor.id || '',
        sceneDate: firstDate,
        contextSortKey: sortKey,
        contextSortKeyFrom: sortKey,
        contextSortKeyTo: sortKey,
        arc: anchor.arc || '',
        phase: anchor.phase || '',
        season: anchor.season || '',
        episode: anchor.episode || '',
        chapter: anchor.chapter || '',
        issue: anchor.issue || '',
        quest: anchor.quest || '',
        gameStage: anchor.gameStage || '',
        alias: anchor.aliases?.[0] || anchor.label || anchor.id || '',
        source: 'local_alias',
    });
}

function seedLoredeckContextFromRuntimeContext(packId, context = {}) {
    const current = getState();
    const runtimeContext = current?.loreContext || {};
    const resolverContext = buildResolverContextFromState(current);
    commitLoredeckContextPatch(packId, {
        contextType: getDefaultLoredeckContextType(packId, context.contextType || 'custom'),
        sceneDate: resolverContext.sceneDate || runtimeContext.sceneDate || '',
        subjectiveDate: resolverContext.subjectiveDate || runtimeContext.subjectiveDate || '',
        label: resolverContext.label || resolverContext.summary || resolverContext.canonBoundary || resolverContext.sceneDate || context.label || '',
        alias: resolverContext.alias || resolverContext.canonBoundary || context.alias || '',
        branchId: resolverContext.branchId || runtimeContext.branchId || 'main',
        timeTravelMode: resolverContext.timeTravelMode || runtimeContext.timeTravelMode || 'none',
        arc: resolverContext.arc || context.arc || '',
        phase: resolverContext.phase || context.phase || '',
        season: resolverContext.season || context.season || '',
        episode: resolverContext.episode || context.episode || '',
        chapter: resolverContext.chapter || context.chapter || '',
        issue: resolverContext.issue || context.issue || '',
        quest: resolverContext.quest || context.quest || '',
        gameStage: resolverContext.gameStage || context.gameStage || '',
        stardate: resolverContext.stardate || context.stardate || '',
        coordinates: resolverContext.coordinates && typeof resolverContext.coordinates === 'object' ? { ...resolverContext.coordinates } : (context.coordinates || {}),
    });
}

function buildContextResolutionSourceText(state = {}, resolverContext = {}) {
    const brief = state?.contextBrief || {};
    const signals = brief?.signals || {};
    const evidence = Array.isArray(brief?.evidence) ? brief.evidence : [];
    const uncertaintyNotes = Array.isArray(brief?.uncertainty?.notes) ? brief.uncertainty.notes : [];
    return [
        resolverContext.label,
        resolverContext.summary,
        resolverContext.sceneDate,
        resolverContext.subjectiveDate,
        resolverContext.canonBoundary,
        resolverContext.branchId,
        resolverContext.timeTravelMode,
        resolverContext.arc,
        resolverContext.phase,
        resolverContext.season,
        resolverContext.episode,
        resolverContext.chapter,
        resolverContext.issue,
        resolverContext.quest,
        resolverContext.gameStage,
        resolverContext.stardate,
        ...(Array.isArray(signals.positionPhrases) ? signals.positionPhrases : []),
        ...(Array.isArray(signals.eventLabels) ? signals.eventLabels : []),
        ...evidence.map(item => item?.quote || item?.text || item?.snippet),
        ...uncertaintyNotes,
    ].map(value => String(value || '').trim()).filter(Boolean).join(' | ').slice(0, 3000);
}

async function handleResolveContextsFromContext(btn = null) {
    await runBusyAction(btn, 'Resolving...', async () => {
        const state = getState();
        const settings = getSettings();
        const context = buildResolverContextFromState(state);
        const sourceText = buildContextResolutionSourceText(state, context);
        const result = await resolveAndApplyContextsFromContext(context, {
            contextSource: 'local_alias',
            sourceText,
            minLocalConfidence: clampSettingConfidence(settings.contextLocalApplyMinConfidence, 0.78),
        });
        storeContextResolutionAuditFromResult(result, context, sourceText, 'manual_local_resolve');
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
        if (result.appliedCount > 0) {
            toast(`Context resolved for ${result.appliedCount} Loredeck${result.appliedCount === 1 ? '' : 's'}.`, 'success');
            return;
        }
        if (result.resolvedCount > 0) {
            toast('Context already matches the current context.', 'info');
            return;
        }
        if (result.skippedCount > 0 && !result.unresolvedCount) {
            toast('Context resolver skipped locked Loredecks.', 'warning');
            return;
        }
        toast('No local Context match found. Try a clearer date, arc, book, event, or anchor alias.', 'warning');
    });
}

async function handleModelResolveContexts(btn = null) {
    await runBusyAction(btn, 'Asking...', async () => {
        const validation = validateLoreProviderConfiguration('lore');
        if (!validation.ok) {
            toast(`Reasoning Provider is not ready: ${validation.message}`, 'error');
            return;
        }
        const state = getState();
        const settings = getSettings();
        const context = buildResolverContextFromState(state);
        const sourceText = buildContextResolutionSourceText(state, context);
        const result = await resolveContextsWithModel(context, {
            explicit: true,
            applyModel: false,
            sourceText,
            minLocalConfidence: clampSettingConfidence(settings.contextLocalApplyMinConfidence, 0.78),
            minConfidence: clampSettingConfidence(settings.contextReasonerProposalMinConfidence, 0.55),
            resolutionCache: state?.lorePanel?.contextResolutionCache || null,
        });
        if (result.status === 'in_flight') {
            storeContextResolutionAuditFromResult(result, context, sourceText, 'manual_reasoner');
            toast('A Context Reasoner request is already running.', 'warning');
            return;
        }
        storeContextResolutionAuditFromResult(result, context, sourceText, result.cached ? 'manual_reasoner_cached' : 'manual_reasoner');
        const proposalCount = storeContextResolutionProposalsFromResult(result, context);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
        if (proposalCount > 0) {
            const localText = result.localAppliedCount ? ` Local resolver also updated ${result.localAppliedCount} Loredeck${result.localAppliedCount === 1 ? '' : 's'}.` : '';
            const verb = result.cached ? 'Reopened cached' : 'Reasoner drafted';
            toast(`${verb} ${proposalCount} Context proposal${proposalCount === 1 ? '' : 's'} for review.${localText}`, 'success');
            return;
        }
        if (result.localAppliedCount > 0) {
            toast(`Local resolver updated ${result.localAppliedCount} Loredeck${result.localAppliedCount === 1 ? '' : 's'} before model fallback.`, 'success');
            return;
        }
        if (result.status === 'resolved_locally') {
            toast('Local resolver already matched the current context.', 'info');
            return;
        }
        if (!result.targetPackIds?.length) {
            toast('No unlocked unresolved Loredecks need model fallback.', 'info');
            return;
        }
        if (result.cached) {
            toast('Same Context was already checked; cached result had no confident bounded candidate.', 'info');
            return;
        }
        toast('Reasoner fallback did not find a confident bounded Context candidate.', 'warning');
    });
}

function createContextTextField(container, labelText, packId, key, value, tooltip, options = {}) {
    const label = document.createElement('label');
    label.className = `saga-loredeck-editor-field${options.full ? ' saga-loredeck-editor-field-full' : ''}`;
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, tooltip || labelText);
    label.appendChild(span);

    const input = options.multiline ? document.createElement('textarea') : document.createElement('input');
    input.className = options.multiline ? 'saga-lore-editor-textarea' : 'saga-lore-editor-input';
    if (!options.multiline) input.type = 'text';
    input.value = String(value || '');
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    input.addEventListener('change', () => {
        commitLoredeckContextPatch(packId, { [key]: input.value.trim() }, options);
    });
    label.appendChild(input);
    container.appendChild(label);
    return input;
}

function createContextSelectField(container, labelText, packId, key, value, optionsList, tooltip, options = {}) {
    const label = document.createElement('label');
    label.className = 'saga-loredeck-editor-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, tooltip || labelText);
    label.appendChild(span);

    const select = document.createElement('select');
    select.className = 'saga-lore-editor-input';
    for (const [optionValue, optionLabel] of optionsList) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionLabel;
        select.appendChild(option);
    }
    select.value = String(value || optionsList[0]?.[0] || '');
    select.addEventListener('change', () => {
        commitLoredeckContextPatch(packId, { [key]: select.value }, options);
    });
    label.appendChild(select);
    container.appendChild(label);
    return select;
}

function createContextNumberField(container, labelText, packId, key, value, tooltip, options = {}) {
    const label = document.createElement('label');
    label.className = 'saga-loredeck-editor-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, tooltip || labelText);
    label.appendChild(span);

    const input = document.createElement('input');
    input.className = 'saga-lore-editor-input';
    input.type = 'number';
    input.min = '0';
    input.max = '1';
    input.step = '0.05';
    input.value = String(Number.isFinite(Number(value)) ? Number(value) : 0);
    input.addEventListener('change', () => {
        commitLoredeckContextPatch(packId, { [key]: input.value }, options);
    });
    label.appendChild(input);
    container.appendChild(label);
    return input;
}

function createContextCheckboxField(container, labelText, packId, key, value, tooltip) {
    const label = document.createElement('label');
    label.className = 'saga-loredeck-context-check';
    addTooltip(label, tooltip || labelText);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value === true;
    input.addEventListener('change', () => {
        commitLoredeckContextPatch(packId, { [key]: input.checked }, { manual: false });
    });
    label.appendChild(input);
    const span = document.createElement('span');
    span.textContent = labelText;
    label.appendChild(span);
    container.appendChild(label);
    return input;
}

function appendContextManualFields(grid, packId, context = {}) {
    createContextSelectField(grid, 'Type', packId, 'contextType', context.contextType, CONTEXT_TYPE_OPTIONS, 'How this Loredeck represents story progress.');
    createContextTextField(grid, 'Label', packId, 'label', context.label, 'Human-readable Context label.');
    createContextTextField(grid, 'Scene Date', packId, 'sceneDate', context.sceneDate, 'Exact or approximate in-universe date when the pack supports dates.');
    createContextTextField(grid, 'Branch', packId, 'branchId', context.branchId || 'main', 'Use main for canon baseline, or a custom branch for AU/time travel.');
    createContextTextField(grid, 'Arc', packId, 'arc', context.arc, 'Named arc, saga, route, or campaign segment.');
    createContextTextField(grid, 'Phase', packId, 'phase', context.phase, 'Broad phase or era, such as MCU Phase 3.');
    createContextTextField(grid, 'Season', packId, 'season', context.season, 'Television/anime season when relevant.');
    createContextTextField(grid, 'Episode', packId, 'episode', context.episode, 'Episode number, title, or range when relevant.');
    createContextTextField(grid, 'Chapter', packId, 'chapter', context.chapter, 'Book/manga/webnovel chapter when relevant.');
    createContextTextField(grid, 'Issue', packId, 'issue', context.issue, 'Comic issue or run context when relevant.');
    createContextTextField(grid, 'Quest', packId, 'quest', context.quest, 'Game quest, mission, route, or scenario marker.');
    createContextTextField(grid, 'Game Stage', packId, 'gameStage', context.gameStage, 'Game progression marker when a calendar date is not useful.');
    createContextTextField(grid, 'Anchor', packId, 'anchorId', context.anchorId, 'Selected event/book/film/arc anchor ID or label.');
    createContextTextField(grid, 'After', packId, 'anchorFrom', context.anchorFrom, 'Lower bound anchor for before/after windows.');
    createContextTextField(grid, 'Before', packId, 'anchorTo', context.anchorTo, 'Upper bound anchor for before/after windows.');
    createContextTextField(grid, 'Alias / User Note', packId, 'alias', context.alias, 'Freeform user phrasing, such as after Shibuya Incident or pre-Endgame.');
    createContextSelectField(grid, 'Source', packId, 'source', context.source, CONTEXT_SOURCE_OPTIONS, 'Where this Context came from.', { manual: false });
    createContextNumberField(grid, 'Confidence', packId, 'confidence', context.confidence, 'Confidence from 0 to 1. Manual choices commonly use 1.0.', { manual: false });
    createContextCheckboxField(grid, 'Manual Lock', packId, 'manualLock', context.manualLock, 'Prevent future automatic Context resolvers from overwriting this pack context.');
    createContextTextField(grid, 'Notes', packId, 'notes', context.notes, 'Private notes for this pack-specific Context.', { multiline: true, full: true });
}

function commitLoredeckContextPatch(packId, patch = {}, options = {}) {
    const nextPatch = { ...(patch || {}) };
    if (options.manual !== false) {
        if (!Object.prototype.hasOwnProperty.call(nextPatch, 'source')) nextPatch.source = 'manual';
        if (!Object.prototype.hasOwnProperty.call(nextPatch, 'manualLock')) nextPatch.manualLock = true;
        if (!Object.prototype.hasOwnProperty.call(nextPatch, 'confidence')) nextPatch.confidence = 1;
    }
    setLoredeckContext(packId, nextPatch);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    refreshContextWorkbench();
    toast('Context updated.', 'success');
}

function getContextTypeLabel(value) {
    const option = CONTEXT_TYPE_OPTIONS.find(([key]) => key === value);
    return option?.[1] || 'Custom';
}

function formatContextSource(value) {
    const option = CONTEXT_SOURCE_OPTIONS.find(([key]) => key === value);
    return option?.[1] || 'Unknown';
}

function formatContextSummary(context = {}) {
    const parts = [];
    if (context.label) parts.push(context.label);
    if (context.sceneDate) parts.push(context.sceneDate);
    if (context.arc) parts.push(`Arc: ${context.arc}`);
    if (context.phase) parts.push(`Phase: ${context.phase}`);
    if (context.season || context.episode) parts.push(`S${context.season || '?'} E${context.episode || '?'}`);
    if (context.chapter) parts.push(`Chapter: ${context.chapter}`);
    if (context.issue) parts.push(`Issue: ${context.issue}`);
    if (context.quest) parts.push(`Quest: ${context.quest}`);
    if (context.gameStage) parts.push(`Game: ${context.gameStage}`);
    if (context.anchorId) parts.push(`Anchor: ${context.anchorId}`);
    if (context.anchorFrom || context.anchorTo) parts.push(`Window: ${context.anchorFrom || 'start'} -> ${context.anchorTo || 'open'}`);
    if (context.alias && !parts.includes(context.alias)) parts.push(context.alias);
    if (context.branchId && context.branchId !== 'main') parts.push(`Branch: ${context.branchId}`);
    return parts.length ? parts.join(' | ') : 'Unset. Add a date, arc, anchor, chapter, episode, quest, or freeform alias.';
}

function openContextWorkbench(packId = '') {
    contextWorkbenchOpen = true;
    const state = getState();
    const stack = getContextWorkbenchStack(state);
    const requested = String(packId || '').trim();
    contextWorkbenchPackId = stack.some(item => item.packId === requested)
        ? requested
        : (contextWorkbenchPackId || stack[0]?.packId || '');
    ensureContextWorkbenchSelection(state, getContextIndexSync());
    renderContextWorkbench();
    loadContextIndex()
        .then(() => {
            if (contextWorkbenchOpen) renderContextWorkbench();
        })
        .catch(e => console.warn('[Saga] Context Workbench index load failed:', e));
}

function openContextWorkbenchForPack(packId = '', tab = 'context') {
    const nextTab = ['context', 'timeline', 'aliases', 'validation'].includes(tab) ? tab : 'context';
    contextWorkbenchTab = nextTab;
    contextWorkbenchSelectedKey = '';
    openContextWorkbench(packId);
}

function closeContextWorkbench() {
    contextWorkbenchOpen = false;
    document.getElementById(CONTEXT_WORKBENCH_ID)?.remove();
}

function refreshContextWorkbench() {
    if (!contextWorkbenchOpen) return;
    renderContextWorkbench();
}

function getContextWorkbenchStack(state = getState()) {
    const stack = getLoredeckStack(state).filter(item => item.enabled !== false);
    const library = getLoredeckLibrary(state);
    const libraryIndex = getLoredeckLibraryIndexForPacks(state, library);
    return resolveLoredeckStackItems(stack, libraryIndex, {
        packs: getLoredeckLibraryPackMap(library),
    }).stack.map((item, index) => ({ ...item, stackIndex: index }));
}

function getContextWorkbenchPack(state = getState()) {
    const stack = getContextWorkbenchStack(state);
    if (!stack.length) return null;
    const selectedId = stack.some(item => item.packId === contextWorkbenchPackId)
        ? contextWorkbenchPackId
        : stack[0].packId;
    contextWorkbenchPackId = selectedId;
    return getFreshLoredeckLibraryPack(selectedId, getLoredeckDefinition(selectedId)) || { packId: selectedId, title: getLoredeckDisplayName(selectedId) };
}

function ensureContextWorkbenchSelection(state = getState(), contextIndex = getContextIndexSync()) {
    const stack = getContextWorkbenchStack(state);
    if (!stack.length) {
        contextWorkbenchPackId = '';
        contextWorkbenchSelectedKey = '';
        return;
    }
    if (!stack.some(item => item.packId === contextWorkbenchPackId)) {
        contextWorkbenchPackId = stack[0].packId;
        contextWorkbenchSelectedKey = '';
    }
    const pack = getContextWorkbenchPack(state);
    const items = getContextWorkbenchTimelineItems(pack, contextIndex);
    if (!items.some(item => getContextTimelineItemKey(item) === contextWorkbenchSelectedKey)) {
        contextWorkbenchSelectedKey = items[0] ? getContextTimelineItemKey(items[0]) : '';
    }
}

function renderContextWorkbench() {
    if (!contextWorkbenchOpen) return;
    const state = getState();
    const contextIndex = getContextIndexSync();
    ensureContextWorkbenchSelection(state, contextIndex);

    let overlay = document.getElementById(CONTEXT_WORKBENCH_ID);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = CONTEXT_WORKBENCH_ID;
        overlay.className = 'saga-lore-workbench-overlay saga-context-workbench-overlay';
        overlay.tabIndex = -1;
        wireOverlayBackdropClose(overlay, closeContextWorkbench);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeContextWorkbench();
        });
        document.body.appendChild(overlay);
    }

    overlay.replaceChildren(createContextWorkbenchShell(state, contextIndex));
    requestAnimationFrame(() => overlay.focus?.());
}

function getContextResolverMissReasons(pack, analysis = {}, packIndex = null) {
    const terms = Array.isArray(analysis.terms) ? analysis.terms : [];
    const lines = [
        `Searched ${packIndex?.anchorCount || 0} timeline anchor${Number(packIndex?.anchorCount) === 1 ? '' : 's'} using labels, IDs, aliases, tags, and coordinates.`,
    ];
    if (terms.length) {
        lines.push(`No anchor contained the cleaned term${terms.length === 1 ? '' : 's'}: ${terms.join(', ')}.`);
    }
    if (analysis.directionTerms?.length) {
        lines.push(`Direction word${analysis.directionTerms.length === 1 ? '' : 's'} ignored: ${analysis.directionTerms.join(', ')}.`);
    }
    const cachedEntries = loredeckEntryPreviewCache.get(pack?.packId);
    if (!cachedEntries?.loadedAt) {
        lines.push('Lorecards are not loaded in this workbench yet, so entry-level Context gates were not searched.');
        return lines;
    }
    const entryHint = getContextResolverEntryCoverageHint(pack, terms);
    if (entryHint?.count) {
        lines.push(`${entryHint.count} loaded Lorecard${entryHint.count === 1 ? '' : 's'} mention those terms, but no timeline anchor does. This is probably a registry coverage gap.`);
        if (entryHint.examples?.length) lines.push(`Examples: ${entryHint.examples.join(', ')}.`);
    } else {
        lines.push('If this phrase should resolve, add an alias to an existing anchor or create a more precise timeline anchor.');
    }
    if (pack?.type === 'bundled') {
        lines.push('Bundled decks are protected; duplicate this Loredeck as Custom before editing its timeline registry.');
    }
    return lines;
}

function getContextResolverEntryCoverageHint(pack, terms = []) {
    if (!terms.length) return null;
    const rows = getContextWorkbenchEntryRows(pack);
    if (!rows.length) return null;
    const hits = [];
    for (const row of rows) {
        const entry = row.entry || {};
        const text = getContextResolverEntrySearchText(entry);
        if (!terms.every(term => contextTextIncludesTerm(text, term))) continue;
        hits.push(entry.title || entry.id || row.id || 'Untitled Lorecard');
        if (hits.length >= 4) break;
    }
    return hits.length ? { count: hits.length, examples: hits } : null;
}

function getContextResolverEntrySearchText(entry = {}) {
    const scope = entry.scope || {};
    const retrieval = entry.retrieval || {};
    const triggers = retrieval.triggers || {};
    const content = entry.content || {};
    const resolverAliases = entry.extensions?.contextResolver?.aliases || entry.contextAliases || entry.resolverAliases || triggers.resolverAliases;
    return [
        entry.id,
        entry.title,
        entry.kind,
        entry.gateType,
        entry.category,
        entry.lorePurpose,
        entry.priority,
        entry.context?.label,
        content.fact,
        content.injection,
        ...(Array.isArray(content.constraints) ? content.constraints : []),
        ...(Array.isArray(resolverAliases) ? resolverAliases : []),
        ...(Array.isArray(entry.aliases) ? entry.aliases : []),
        ...(Array.isArray(contextAliasesFromEntry(entry)) ? contextAliasesFromEntry(entry) : []),
        ...(Array.isArray(scope.characters) ? scope.characters : []),
        ...(Array.isArray(scope.locations) ? scope.locations : []),
        ...(Array.isArray(scope.topics) ? scope.topics : []),
        ...(Array.isArray(scope.books) ? scope.books : []),
        ...(Array.isArray(scope.phases) ? scope.phases : []),
        ...(Array.isArray(triggers.topicsAny) ? triggers.topicsAny : []),
        ...(Array.isArray(triggers.charactersAny) ? triggers.charactersAny : []),
        ...(Array.isArray(triggers.locationsAny) ? triggers.locationsAny : []),
        ...(Array.isArray(entry.effects?.addsTags) ? entry.effects.addsTags : []),
    ].filter(Boolean).join(' ');
}

function contextAliasesFromEntry(entry = {}) {
    const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    return Array.isArray(contextGate.aliases) ? contextGate.aliases : [];
}

function getContextEntryResolverMatches(pack, analysis = {}, options = {}) {
    const cachedEntries = loredeckEntryPreviewCache.get(pack?.packId);
    if (!cachedEntries?.loadedAt || !Array.isArray(cachedEntries.entries)) return [];
    const terms = Array.isArray(analysis.terms) ? analysis.terms : [];
    if (!terms.length) return [];
    const limit = Math.max(1, Math.min(20, Number(options.limit) || 6));
    return getContextWorkbenchEntryRows(pack)
        .filter(row => row?.id && !row.disabled)
        .map(row => buildContextEntryResolverMatch(pack, row, analysis))
        .filter(match => match && match.score > 0 && !match.missingTerms.length)
        .sort((a, b) => b.score - a.score || String(a.entry.title || a.row.id).localeCompare(String(b.entry.title || b.row.id)))
        .slice(0, limit);
}

function buildContextEntryResolverMatch(pack, row = {}, analysis = {}) {
    const entry = row.entry || {};
    const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    const sortKeyFrom = normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom);
    const sortKeyTo = normalizeLoredeckTimelineNumber(contextGate.sortKeyTo);
    if (sortKeyFrom === null && sortKeyTo === null) return null;

    const terms = Array.isArray(analysis.terms) ? analysis.terms : [];
    const termPhrase = String(analysis.termPhrase || terms.join(' ')).trim().toLowerCase();
    const reasons = [];
    const matched = new Set();
    let score = 0;

    const addGroup = (label, text, termScore, phraseScore = 0) => {
        const haystack = normalizeContextSearchText(text);
        if (!haystack) return;
        if (termPhrase && haystack.includes(termPhrase)) {
            score += phraseScore || termScore * Math.max(2, terms.length);
            reasons.push({ type: 'entry_phrase', label: `${label} contains phrase`, score: phraseScore || termScore * 2, detail: text });
            for (const term of terms) {
                if (contextTextIncludesTerm(haystack, term)) matched.add(term);
            }
        }
        for (const term of terms) {
            if (!term || !contextTextIncludesTerm(haystack, term)) continue;
            matched.add(term);
            score += termScore;
            reasons.push({ type: 'entry_term', label: `${label} term: ${term}`, score: termScore, detail: text });
        }
    };

    const scope = entry.scope || {};
    const retrieval = entry.retrieval || {};
    const triggers = retrieval.triggers || {};
    const content = entry.content || {};
    const resolverAliases = entry.extensions?.contextResolver?.aliases || entry.contextAliases || entry.resolverAliases || triggers.resolverAliases;
    addGroup('Title', entry.title, 18, 72);
    addGroup('ID', row.id || entry.id, 8, 24);
    addGroup('Context label', contextGate.label, 10, 32);
    addGroup('Aliases', [
        ...(Array.isArray(entry.aliases) ? entry.aliases : []),
        ...(Array.isArray(contextGate.aliases) ? contextGate.aliases : []),
        ...(Array.isArray(resolverAliases) ? resolverAliases : []),
    ].join(' '), 20, 80);
    addGroup('Topics', [
        ...(Array.isArray(scope.topics) ? scope.topics : []),
        ...(Array.isArray(triggers.topicsAny) ? triggers.topicsAny : []),
        ...(Array.isArray(entry.effects?.addsTags) ? entry.effects.addsTags : []),
    ].join(' '), 14, 56);
    addGroup('Entities', [
        ...(Array.isArray(scope.characters) ? scope.characters : []),
        ...(Array.isArray(scope.locations) ? scope.locations : []),
    ].join(' '), 8, 24);
    addGroup('Book/phase', [
        ...(Array.isArray(scope.books) ? scope.books : []),
        ...(Array.isArray(scope.phases) ? scope.phases : []),
        entry.sourceInfo?.book,
    ].join(' '), 8, 24);
    addGroup('Content', [
        content.fact,
        content.injection,
        ...(Array.isArray(content.constraints) ? content.constraints : []),
    ].join(' '), 4, 16);

    const matchedTerms = [...matched];
    const missingTerms = terms.filter(term => !matched.has(term));
    if (!matchedTerms.length) return null;
    const anchorDefinition = buildContextEntryDerivedAnchor(pack, row, analysis);
    if (!anchorDefinition) return null;
    return {
        source: 'entry',
        row,
        entry,
        context: contextGate,
        anchorDefinition,
        score,
        reasons: reasons.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 8),
        matchedTerms,
        missingTerms,
        queryTerms: terms,
        ignoredTerms: analysis.ignoredTerms || [],
        directionTerms: analysis.directionTerms || [],
        query: analysis.query || '',
    };
}

function buildContextEntryDerivedAnchor(pack, row = {}, analysis = {}) {
    const entry = row.entry || {};
    const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    const sortKeyFrom = normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom);
    const sortKeyTo = normalizeLoredeckTimelineNumber(contextGate.sortKeyTo);
    const sortKey = sortKeyFrom ?? sortKeyTo;
    if (sortKey === null) return null;
    const scope = entry.scope || {};
    const retrieval = entry.retrieval || {};
    const triggers = retrieval.triggers || {};
    const content = entry.content || {};
    const resolverAliases = entry.extensions?.contextResolver?.aliases || entry.contextAliases || entry.resolverAliases || triggers.resolverAliases;
    const id = normalizeLoredeckTimelineId(`${pack?.packId || 'pack'}.${row.id || entry.id || entry.title || 'entry_anchor'}`);
    if (!id) return null;
    const aliases = uniqueStrings([
        entry.title,
        row.id,
        analysis.termPhrase,
        analysis.query,
        ...(Array.isArray(entry.aliases) ? entry.aliases : []),
        ...(Array.isArray(contextGate.aliases) ? contextGate.aliases : []),
        ...(Array.isArray(resolverAliases) ? resolverAliases : []),
        ...(Array.isArray(scope.topics) ? scope.topics : []),
        ...(Array.isArray(triggers.topicsAny) ? triggers.topicsAny : []),
        ...(Array.isArray(entry.effects?.addsTags) ? entry.effects.addsTags : []),
    ]).slice(0, 24);
    const tags = normalizeLoredeckTimelineTextList([
        'source:lorecard-derived',
        entry.category ? `category:${entry.category}` : '',
        entry.lorePurpose ? `purpose:${entry.lorePurpose}` : '',
        ...(Array.isArray(entry.effects?.addsTags) ? entry.effects.addsTags : []),
    ], 64);
    return normalizeLoredeckTimelineAnchor({
        id,
        label: entry.title || contextGate.label || row.id || id,
        contextType: contextGate.scope === 'anchor' ? 'anchor' : 'anchor_window',
        sortKey,
        book: entry.sourceInfo?.book || scope.books?.[0] || '',
        arc: contextGate.arc || '',
        phase: contextGate.phase || scope.phases?.[0] || '',
        season: contextGate.season || '',
        episode: contextGate.episode || '',
        chapter: contextGate.chapter || '',
        issue: contextGate.issue || '',
        quest: contextGate.quest || '',
        gameStage: contextGate.gameStage || '',
        aliases,
        tags,
        notes: [
            `Entry-derived candidate from Lorecard ${row.id || entry.id || 'unknown'}.`,
            contextGate.label ? `Entry Context label: ${contextGate.label}.` : '',
            content.notes ? `Entry notes: ${truncateText(content.notes, 240)}` : '',
        ].filter(Boolean).join(' '),
    }, id);
}

function uniqueStrings(values = []) {
    const output = [];
    const seen = new Set();
    for (const value of values) {
        const text = String(value || '').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        output.push(text);
    }
    return output;
}

function applyContextEntryCandidate(packId, match = {}) {
    const entry = match.entry || {};
    const contextGate = match.context || {};
    const anchorId = normalizeLoredeckTimelineId(contextGate.anchorId || '');
    const anchorFrom = normalizeLoredeckTimelineId(contextGate.validFromAnchor || contextGate.anchorFrom || '');
    const anchorTo = normalizeLoredeckTimelineId(contextGate.validToAnchor || contextGate.anchorTo || '');
    const sortKeyFrom = normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom);
    const sortKeyTo = normalizeLoredeckTimelineNumber(contextGate.sortKeyTo);
    const title = entry.title || match.row?.id || contextGate.label || 'Lorecard-derived Context';
    commitLoredeckContextPatch(packId, {
        contextType: anchorId ? 'anchor' : 'anchor_window',
        anchorId,
        anchorFrom: anchorId ? '' : anchorFrom,
        anchorTo: anchorId ? '' : anchorTo,
        label: title,
        sceneDate: '',
        contextSortKey: sortKeyFrom ?? sortKeyTo,
        contextSortKeyFrom: sortKeyFrom ?? sortKeyTo,
        contextSortKeyTo: sortKeyTo ?? sortKeyFrom,
        arc: contextGate.arc || '',
        phase: contextGate.phase || '',
        season: contextGate.season || '',
        episode: contextGate.episode || '',
        chapter: contextGate.chapter || '',
        issue: contextGate.issue || '',
        quest: contextGate.quest || '',
        gameStage: contextGate.gameStage || '',
        alias: match.query || title,
        source: 'manual',
        confidence: Math.max(0.55, Math.min(0.95, (Number(match.score) || 0) / 180)),
        notes: `Applied from Lorecard-derived resolver candidate: ${match.row?.id || entry.id || title}.`,
    }, `Set Context from Lorecard: ${getLoredeckDisplayName(packId)}`);
}

function queueContextEntryCandidateTimelineAnchor(pack, match = {}) {
    if (pack?.type === 'bundled') {
        toast('Bundled Loredeck timelines are read-only. Duplicate as Custom first.', 'warning');
        return false;
    }
    const anchor = match.anchorDefinition;
    if (!anchor?.id) {
        toast('Could not build a timeline anchor from this Lorecard candidate.', 'error');
        return false;
    }
    return saveLoredeckTimelineAnchorDefinition(pack, anchor, `Queued Lorecard-derived timeline anchor ${anchor.id}.`);
}

function getContextWorkbenchEntryRows(pack = {}) {
    const cached = loredeckEntryPreviewCache.get(String(pack?.packId || '').trim()) || {};
    return getLoredeckEditableEntryRows(pack, Array.isArray(cached.entries) ? cached.entries : []);
}

function getContextTimelineItemKey(item = {}) {
    return `${item.kind || 'anchor'}:${item.id || ''}`;
}

function getContextTimelineItemContextText(item = {}) {
    const def = item.definition || {};
    if (item.kind === 'window') {
        const bounds = [def.sortKeyFrom, def.sortKeyTo].filter(value => value !== null && value !== undefined && value !== '').join(' -> ');
        return bounds || `${def.anchorFrom || '?'} -> ${def.anchorTo || '?'}`;
    }
    return def.sortKey !== null && def.sortKey !== undefined ? String(def.sortKey) : '';
}

function getContextTimelineItemCoordinateText(item = {}) {
    const def = item.definition || {};
    return [
        formatTimelineDateRange(def.dateRange),
        def.book || def.work,
        def.schoolYear,
        def.arc,
        def.phase,
        def.season || def.episode ? `S${def.season || '?'} E${def.episode || '?'}` : '',
        def.chapter ? `Ch ${def.chapter}` : '',
        def.issue ? `Issue ${def.issue}` : '',
        def.quest,
        def.gameStage,
    ].filter(Boolean).join(' | ');
}

function getContextWorkbenchTimelineItems(pack = null, contextIndex = getContextIndexSync()) {
    if (!pack?.packId) return [];
    const rows = getContextWorkbenchEntryRows(pack);
    const items = buildLoredeckTimelineRegistryItems(pack, rows);
    const itemMap = new Map(items.map(item => [getContextTimelineItemKey(item), item]));
    const stats = buildLoredeckTimelineAttachmentStats(rows);
    const addIndexedItem = (kind, sourceDef) => {
        const id = normalizeLoredeckTimelineId(sourceDef?.id);
        if (!id) return;
        const key = `${kind}:${id}`;
        const existing = itemMap.get(key);
        if (existing?.sourceDefined) return;
        const normalized = kind === 'window'
            ? normalizeLoredeckTimelineWindow(sourceDef, id)
            : normalizeLoredeckTimelineAnchor(sourceDef, id);
        if (!normalized) return;
        if (existing) {
            existing.sourceDefined = true;
            existing.sourceDefinition = normalized;
            existing.definition = existing.customDefinition || normalized;
            existing.registryState = existing.disabled
                ? 'disabled'
                : (existing.customDefined ? 'custom override' : 'source');
            return;
        }
        itemMap.set(key, {
            kind,
            id,
            sourceDefined: true,
            customDefined: false,
            disabled: false,
            sourceDefinition: normalized,
            customDefinition: null,
            definition: normalized,
            entryIds: kind === 'anchor' ? (stats.anchorRefs.get(id) || []) : getTimelineWindowEntryRefs(normalized, stats),
            registryState: 'source',
        });
    };

    for (const anchor of (contextIndex?.anchors || []).filter(anchor => anchor?.packId === pack.packId)) {
        addIndexedItem('anchor', anchor);
    }
    for (const windowDef of (contextIndex?.windows || []).filter(windowDef => windowDef?.packId === pack.packId)) {
        addIndexedItem('window', windowDef);
    }
    return Array.from(itemMap.values()).sort(compareContextTimelineItems);
}

function compareContextTimelineItems(a = {}, b = {}) {
    const aSort = normalizeLoredeckTimelineNumber(a.definition?.sortKey ?? a.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
    const bSort = normalizeLoredeckTimelineNumber(b.definition?.sortKey ?? b.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;
    const kindCompare = String(a.kind || '').localeCompare(String(b.kind || ''));
    if (kindCompare) return kindCompare;
    return String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true, sensitivity: 'base' });
}

function filterContextWorkbenchTimelineItems(items = [], query = contextWorkbenchQuery, typeFilter = contextWorkbenchTypeFilter) {
    const q = String(query || '').trim().toLowerCase();
    return items.filter(item => {
        if (typeFilter !== 'all' && item.kind !== typeFilter) return false;
        if (!q) return true;
        const def = item.definition || {};
        return [
            item.kind,
            item.id,
            item.registryState,
            def.label,
            def.anchorFrom,
            def.anchorTo,
            def.book,
            def.work,
            def.schoolYear,
            def.arc,
            def.phase,
            def.season,
            def.episode,
            def.chapter,
            def.issue,
            def.quest,
            def.gameStage,
            def.notes,
            ...(Array.isArray(def.aliases) ? def.aliases : []),
            ...(Array.isArray(def.tags) ? def.tags : []),
            ...(Array.isArray(item.entryIds) ? item.entryIds : []),
        ].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
}

function applyContextTimelineItem(packId, item = {}) {
    if (!item?.id) return;
    const def = item.definition || {};
    if (item.kind === 'window') {
        const firstDate = String(def.dateRange?.from || def.dateRange?.to || '').trim();
        commitLoredeckContextPatch(packId, {
            contextType: def.contextType || 'anchor_window',
            anchorId: '',
            anchorFrom: def.anchorFrom || '',
            anchorTo: def.anchorTo || '',
            label: def.label || item.id || '',
            sceneDate: firstDate,
            contextSortKey: normalizeLoredeckTimelineNumber(def.sortKeyFrom),
            contextSortKeyFrom: normalizeLoredeckTimelineNumber(def.sortKeyFrom),
            contextSortKeyTo: normalizeLoredeckTimelineNumber(def.sortKeyTo),
            alias: def.aliases?.[0] || def.label || item.id || '',
            source: 'manual',
        });
        return;
    }
    applyContextAnchor(packId, def);
}

function applyContextAnchorBoundary(packId, item = {}, mode = 'from') {
    if (!item?.id || item.kind === 'window') return;
    const def = item.definition || {};
    const id = normalizeLoredeckTimelineId(def.id || item.id);
    if (!id) return;
    const context = getLoredeckContext(getState(), packId);
    const label = String(def.label || id).trim();
    const firstDate = String(def.dateRange?.from || def.dateRange?.to || '').trim();
    const startSort = getLoredeckAnchorStartSortKey(def);
    const endSort = getLoredeckAnchorEndSortKey(def);
    const patch = {
        contextType: 'anchor_window',
        anchorId: '',
        sceneDate: firstDate || context.sceneDate || '',
        arc: def.arc || context.arc || '',
        phase: def.phase || context.phase || '',
        season: def.season || context.season || '',
        episode: def.episode || context.episode || '',
        chapter: def.chapter || context.chapter || '',
        issue: def.issue || context.issue || '',
        quest: def.quest || context.quest || '',
        gameStage: def.gameStage || context.gameStage || '',
        alias: def.aliases?.[0] || def.label || id,
        source: 'manual',
    };
    if (mode === 'to') {
        patch.anchorFrom = context.anchorFrom || '';
        patch.anchorTo = id;
        patch.contextSortKey = Number.isFinite(Number(context.contextSortKey)) ? Number(context.contextSortKey) : (context.contextSortKeyFrom ?? endSort);
        patch.contextSortKeyFrom = Number.isFinite(Number(context.contextSortKeyFrom)) ? Number(context.contextSortKeyFrom) : (Number.isFinite(Number(context.contextSortKey)) ? Number(context.contextSortKey) : null);
        patch.contextSortKeyTo = endSort;
        patch.label = context.anchorFrom ? `${context.anchorFrom} to ${label}` : `Before ${label}`;
    } else {
        patch.anchorFrom = id;
        patch.anchorTo = context.anchorTo || '';
        patch.contextSortKey = startSort;
        patch.contextSortKeyFrom = startSort;
        patch.contextSortKeyTo = Number.isFinite(Number(context.contextSortKeyTo)) ? Number(context.contextSortKeyTo) : null;
        patch.label = context.anchorTo ? `${label} to ${context.anchorTo}` : `After ${label}`;
    }
    commitLoredeckContextPatch(packId, patch);
}

function resolveManifestUrlForFetch(manifestRef) {
    const text = String(manifestRef || '').trim();
    if (!text) return null;
    try {
        return new URL(text, import.meta.url);
    } catch (_) {
        return null;
    }
}

async function fetchLoredeckManifest(manifestRef) {
    const url = resolveManifestUrlForFetch(manifestRef);
    if (!url) throw new Error('Manifest path or URL is invalid.');
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Manifest failed to load: HTTP ${response.status}`);
    try {
        return await response.json();
    } catch (e) {
        throw new Error(`Manifest is not valid JSON: ${e?.message || 'parse failed'}`);
    }
}

function buildLoredeckRecordFromManifest(manifest, manifestRef) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error('Loredeck manifest must be a JSON object.');
    }
    const packId = String(manifest.id || '').trim();
    if (!packId) throw new Error('Loredeck manifest is missing required id.');
    if (!Array.isArray(manifest.files)) throw new Error('Loredeck manifest is missing required files array.');
    const sourceUrl = String(manifest.source?.url || manifestRef || '').trim();
    const isRemote = /^https?:\/\//i.test(String(manifestRef || ''));
    const manifestType = ['generated', 'custom'].includes(manifest.type) ? manifest.type : 'custom';
    return {
        packId,
        type: manifestType,
        title: String(manifest.title || packId).trim(),
        description: String(manifest.description || '').trim(),
        fandom: String(manifest.fandom || '').trim(),
        era: String(manifest.era || '').trim(),
        author: String(manifest.author || '').trim(),
        version: String(manifest.version || '').trim(),
        entrySchemaVersion: Number.isFinite(Number(manifest.entrySchemaVersion)) ? Number(manifest.entrySchemaVersion) : 0,
        manifest: String(manifestRef || '').trim(),
        source: {
            kind: isRemote ? 'url' : 'path',
            url: sourceUrl,
            updateUrl: String(manifest.update?.url || '').trim(),
        },
        tags: Array.isArray(manifest.tags) ? manifest.tags.map(tag => String(tag || '').trim()).filter(Boolean) : [],
        stats: {
            entryCount: Number.isFinite(Number(manifest.stats?.entryCount)) ? Math.max(0, Number(manifest.stats.entryCount)) : 0,
            categoryCounts: manifest.stats?.categoryCounts && typeof manifest.stats.categoryCounts === 'object' && !Array.isArray(manifest.stats.categoryCounts)
                ? { ...manifest.stats.categoryCounts }
                : {},
        },
        healthStatus: String(manifest.health?.status || '').trim(),
        installedAt: Date.now(),
        updatedAt: Date.now(),
    };
}

function cloneLoredeckJson(value) {
    if (!value || typeof value !== 'object') return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return null;
    }
}

function isVirtualLoredeckPack(pack) {
    return !!(pack?.manifestData && typeof pack.manifestData === 'object' && !Array.isArray(pack.manifestData));
}

function isGeneratedLoredeckPack(pack) {
    return String(pack?.type || pack?.manifestData?.type || '').trim() === 'generated';
}

function getAcceptedVirtualLoredeckEntries(pack = {}) {
    if (!isVirtualLoredeckPack(pack)) return [];
    const overrides = pack.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? pack.entryOverrides
        : {};
    const disabled = new Set(Array.isArray(pack.disabledEntryIds) ? pack.disabledEntryIds.map(id => String(id || '').trim()).filter(Boolean) : []);
    const schemaVersion = Math.max(3, Number(pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 0);
    const entries = [];
    for (const [key, raw] of Object.entries(overrides)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.id || key || '').trim();
        if (!id || disabled.has(id)) continue;
        const entry = cloneLoredeckJson(raw) || { ...raw };
        entry.id = id;
        entry.schemaVersion = Number(entry.schemaVersion) || schemaVersion;
        entries.push(entry);
    }
    return entries;
}

function canUseVirtualLoredeckData(pack = {}) {
    return isVirtualLoredeckPack(pack) && !String(pack?.manifest || '').trim() && getAcceptedVirtualLoredeckEntries(pack).length > 0;
}

function canUseGeneratedVirtualLoredeckData(pack = {}) {
    return isGeneratedLoredeckPack(pack) && canUseVirtualLoredeckData(pack);
}

function canValidateLoredeckInEditor(pack = {}) {
    return !!String(pack?.manifest || '').trim() || canUseVirtualLoredeckData(pack);
}

function getAcceptedGeneratedLoredeckEntries(pack = {}) {
    if (!isGeneratedLoredeckPack(pack)) return [];
    return getAcceptedVirtualLoredeckEntries(pack);
}

function buildLoredeckStatsFromEntries(entries = []) {
    const categoryCounts = {};
    for (const entry of Array.isArray(entries) ? entries : []) {
        const category = String(entry?.category || 'other').trim() || 'other';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
    return {
        entryCount: Array.isArray(entries) ? entries.length : 0,
        categoryCounts,
    };
}

function buildLoredeckStatsFromHealth(health = null) {
    const summary = health?.summary || {};
    return {
        entryCount: Math.max(0, Number(summary.entryCount) || 0),
        categoryCounts: summary.categoryCounts && typeof summary.categoryCounts === 'object' && !Array.isArray(summary.categoryCounts)
            ? { ...summary.categoryCounts }
            : {},
    };
}

function refreshGeneratedLoredeckDerivedMetadata(record = {}) {
    if (!isGeneratedLoredeckPack(record)) return record;
    const entries = getAcceptedGeneratedLoredeckEntries(record);
    const stats = buildLoredeckStatsFromEntries(entries);
    const entrySchemaVersion = Math.max(3, Number(record.entrySchemaVersion || record.manifestData?.entrySchemaVersion) || 0);
    record.entrySchemaVersion = entrySchemaVersion;
    record.stats = stats;
    const baseManifest = cloneLoredeckJson(record.manifestData) || {};
    if (!String(record.manifest || '').trim()) baseManifest.files = [];
    baseManifest.entrySchemaVersion = entrySchemaVersion;
    baseManifest.stats = stats;
    record.manifestData = buildEmbeddedCustomManifest(baseManifest, record);
    return record;
}

function buildGeneratedLoredeckEntryCache(pack = {}, manifest = {}) {
    const entries = getAcceptedVirtualLoredeckEntries(pack);
    const schemaVersion = Math.max(3, Number(manifest.entrySchemaVersion || pack.entrySchemaVersion || pack.manifestData?.entrySchemaVersion) || 0);
    const entryFiles = entries.length
        ? [{
            file: isGeneratedLoredeckPack(pack) ? '__saga_generated_entries__' : '__saga_embedded_entries__',
            url: null,
            ok: true,
            json: {
                schemaVersion,
                entries,
            },
            entries,
            schemaVersion,
        }]
        : [];
    return {
        manifest,
        baseUrl: null,
        entries,
        entryFiles,
    };
}

function buildEmbeddedCustomManifest(sourceManifest = {}, metadata = {}) {
    const manifest = cloneLoredeckJson(sourceManifest) || {};
    delete manifest.entries;
    const packId = String(metadata.packId || manifest.id || '').trim();
    manifest.id = packId;
    manifest.type = metadata.type === 'generated' ? 'generated' : 'custom';
    manifest.title = String(metadata.title || manifest.title || packId).trim();
    manifest.description = String(metadata.description || manifest.description || '').trim();
    manifest.fandom = String(metadata.fandom || manifest.fandom || '').trim();
    manifest.era = String(metadata.era || manifest.era || '').trim();
    manifest.author = String(metadata.author || manifest.author || '').trim();
    manifest.version = String(metadata.version || manifest.version || '1.0.0').trim();
    if (Number.isFinite(Number(metadata.entrySchemaVersion)) && Number(metadata.entrySchemaVersion) > 0) {
        manifest.entrySchemaVersion = Number(metadata.entrySchemaVersion);
    }
    manifest.tags = Array.isArray(metadata.tags) ? metadata.tags : (Array.isArray(manifest.tags) ? manifest.tags : []);
    manifest.source = metadata.source || manifest.source || {};
    manifest.update = {
        ...(manifest.update || {}),
        checkForUpdates: false,
        url: '',
    };
    if (metadata.derivedFrom) manifest.derivedFrom = metadata.derivedFrom;
    if (metadata.stats) manifest.stats = metadata.stats;
    if (!Array.isArray(manifest.files)) manifest.files = [];
    return manifest;
}

async function getDisplayManifestForPack(pack, options = {}) {
    if (isVirtualLoredeckPack(pack)) {
        let baseManifest = {};
        if (pack.manifest) {
            baseManifest = await fetchLoredeckManifest(pack.manifest);
        } else if (options.requireFetch !== false) {
            throw new Error('Virtual Custom Loredeck is missing its base manifest path.');
        }
        return buildEmbeddedCustomManifest(
            {
                ...baseManifest,
                ...(pack.manifestData || {}),
            },
            pack
        );
    }
    return fetchLoredeckManifest(pack.manifest);
}

async function registerLoredeckManifestFromInput(manifestRef, options = {}) {
    const button = options.button || null;
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Registering...';
    }
    try {
        const ref = String(manifestRef || '').trim();
        if (!ref) throw new Error('Enter a loredeck.json path or URL.');
        const manifest = await fetchLoredeckManifest(ref);
        const record = buildLoredeckRecordFromManifest(manifest, ref);
        const result = upsertLoredeckLibraryPack(record);
        if (!result.ok) throw new Error(result.error || 'Loredeck registration failed.');
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        toast(`${record.title} registered as a ${record.type} Loredeck.`, 'success');
        return result.pack;
    } catch (e) {
        toast(e?.message || 'Loredeck registration failed.', 'error');
        return null;
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Register';
        }
    }
}

function normalizeLoredeckPackageRelativePath(value = '', fallback = '') {
    const raw = String(value || '').replace(/\\/g, '/').trim();
    const candidate = raw && !/^https?:\/\//i.test(raw) && !raw.startsWith('data:') ? raw : fallback;
    const clean = String(candidate || '')
        .replace(/\\/g, '/')
        .replace(/^\.\/+/, '')
        .replace(/^\/+/, '')
        .trim();
    if (
        !clean
        || clean.includes('\0')
        || /^[A-Za-z]:\//.test(clean)
        || clean.split('/').some(part => !part || part === '.' || part === '..')
        || clean.endsWith('/')
    ) {
        return fallback || '';
    }
    return clean;
}

function loredeckPackageStringify(value = {}) {
    return JSON.stringify(value, null, 2);
}

function addLoredeckPackageFile(files, path, data, options = {}) {
    const safePath = normalizeLoredeckPackageRelativePath(path);
    if (!safePath) throw new Error(`Package file path is invalid: ${path}`);
    const existingIndex = files.findIndex(file => file.path === safePath);
    if (existingIndex >= 0) {
        if (options.replace === true) {
            files[existingIndex] = { path: safePath, data };
            return true;
        }
        return false;
    }
    files.push({ path: safePath, data });
    return true;
}

function getLoredeckPackageEntryPath(fileRecord = {}, index = 0) {
    const raw = String(fileRecord.file || '').trim();
    if (!raw || raw.startsWith('__') || /^https?:\/\//i.test(raw) || raw.startsWith('data:')) {
        const stem = raw.includes('override') ? 'entry-overrides' : (raw.includes('generated') ? 'generated-entries' : `entries-${index + 1}`);
        return `entries/${stem}.json`;
    }
    return normalizeLoredeckPackageRelativePath(raw, `entries/entries-${index + 1}.json`);
}

function getLoredeckPackageRefPaths(manifest = {}) {
    const refs = [];
    const add = ref => {
        const raw = String(ref || '').trim();
        if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith('data:')) return;
        const clean = normalizeLoredeckPackageRelativePath(raw);
        if (clean && !refs.includes(clean)) refs.push(clean);
    };
    const registries = manifest.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    for (const ref of Object.values(registries)) {
        if (typeof ref === 'string') add(ref);
    }
    add(manifest.resolver);
    return refs;
}

function getLoredeckPackageAssetExtension(mimeType = '', fallbackPath = '') {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('png')) return 'png';
    const ext = String(fallbackPath || '').toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1] || '';
    return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'png';
}

function dataUrlToBytes(dataUrl = '') {
    const match = String(dataUrl || '').match(/^data:([^;,]+)?((?:;[^,]+)*),(.*)$/i);
    if (!match) throw new Error('Data URL asset could not be decoded.');
    const meta = match[2] || '';
    const body = match[3] || '';
    if (/;base64/i.test(meta)) {
        const binary = atob(body.replace(/\s+/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return { bytes, mimeType: match[1] || '' };
    }
    return {
        bytes: new TextEncoder().encode(decodeURIComponent(body)),
        mimeType: match[1] || '',
    };
}

async function fetchLoredeckPackageBytes(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
}

async function stageLoredeckPackageReferencedFile(files, deckFolder, baseUrl, relativePath) {
    const safeRelative = normalizeLoredeckPackageRelativePath(relativePath);
    if (!safeRelative || !baseUrl) return false;
    const bytes = await fetchLoredeckPackageBytes(new URL(safeRelative, baseUrl));
    addLoredeckPackageFile(files, `${deckFolder}/${safeRelative}`, bytes);
    return true;
}

async function stageLoredeckPackageAssets(files, pack = {}, manifest = {}, baseUrl = null, deckFolder = '') {
    const assets = manifest.assets && typeof manifest.assets === 'object' && !Array.isArray(manifest.assets)
        ? cloneLoredeckJson(manifest.assets) || {}
        : {};
    const packAssets = pack.assets && typeof pack.assets === 'object' && !Array.isArray(pack.assets)
        ? pack.assets
        : {};
    for (const [key, raw] of Object.entries(packAssets)) {
        if (!assets[key]) assets[key] = cloneLoredeckJson(raw) || raw;
    }
    if (!Object.keys(assets).length) return {};

    const exported = {};
    for (const [key, raw] of Object.entries(assets)) {
        const asset = raw && typeof raw === 'object' && !Array.isArray(raw) ? cloneLoredeckJson(raw) || {} : {};
        const path = String(asset.path || '').trim();
        if (!path) continue;
        try {
            if (path.startsWith('data:')) {
                const decoded = dataUrlToBytes(path);
                const ext = getLoredeckPackageAssetExtension(decoded.mimeType || asset.mimeType, asset.title || key);
                const assetPath = normalizeLoredeckPackageRelativePath(`assets/${sanitizeFileStem(key || 'asset')}.${ext}`);
                addLoredeckPackageFile(files, `${deckFolder}/${assetPath}`, decoded.bytes);
                exported[key] = {
                    ...asset,
                    path: assetPath,
                    mimeType: decoded.mimeType || asset.mimeType || `image/${ext}`,
                };
                continue;
            }
            if (/^https?:\/\//i.test(path)) {
                console.warn('[Saga] Skipping remote Loredeck asset during package export:', path);
                continue;
            }
            const assetPath = normalizeLoredeckPackageRelativePath(path);
            if (!assetPath || !baseUrl) continue;
            await stageLoredeckPackageReferencedFile(files, deckFolder, baseUrl, assetPath);
            exported[key] = { ...asset, path: assetPath };
        } catch (e) {
            console.warn('[Saga] Loredeck asset skipped during package export:', pack.packId, key, e);
        }
    }
    return exported;
}

function buildLoredeckPackageFolderSubset(selectedPackIds = [], registry = {}) {
    const selected = new Set(selectedPackIds);
    const placements = Array.isArray(registry.deckPlacements)
        ? registry.deckPlacements.filter(placement => selected.has(String(placement.deckId || placement.packId || '').trim()))
        : [];
    const folders = Array.isArray(registry.folders) ? registry.folders : [];
    const byId = new Map(folders.map(folder => [String(folder.id || '').trim(), folder]));
    const needed = new Set();
    const addAncestors = folderId => {
        let current = byId.get(String(folderId || '').trim());
        const seen = new Set();
        while (current?.id && !seen.has(current.id)) {
            seen.add(current.id);
            needed.add(current.id);
            current = current.parentId ? byId.get(current.parentId) : null;
        }
    };
    for (const placement of placements) addAncestors(placement.folderId);
    return {
        folders: folders.filter(folder => needed.has(String(folder.id || '').trim())).map(folder => cloneLoredeckJson(folder) || { ...folder }),
        deckPlacements: placements.map(placement => cloneLoredeckJson(placement) || { ...placement }),
    };
}

function buildLoredeckPackageIndexRecord(pack = {}, manifest = {}, deckFolderName = '') {
    const source = manifest.source && typeof manifest.source === 'object' && !Array.isArray(manifest.source) ? manifest.source : {};
    const originalType = String(source.originalType || pack.type || manifest.type || 'custom').trim() || 'custom';
    const originalPackId = String(source.originalPackId || pack.packId || manifest.id || deckFolderName).trim();
    return {
        packId: pack.packId || manifest.id || deckFolderName,
        manifest: `${deckFolderName}/loredeck.json`,
        type: 'custom',
        originalType,
        originalPackId,
        source: {
            kind: 'package_export',
            originalType,
            originalPackId,
        },
        title: pack.title || manifest.title || pack.packId || deckFolderName,
        description: pack.description || manifest.description || '',
        fandom: pack.fandom || manifest.fandom || '',
        era: pack.era || manifest.era || '',
        author: pack.author || manifest.author || '',
        version: pack.version || manifest.version || '1.0.0',
        library: normalizePackLibraryMetadata(pack.library || manifest.library || {}),
        assets: manifest.assets || pack.assets || {},
        entrySchemaVersion: Math.max(3, Number(pack.entrySchemaVersion || manifest.entrySchemaVersion) || 0),
        tags: Array.isArray(pack.tags) ? pack.tags : (Array.isArray(manifest.tags) ? manifest.tags : []),
        updatedAt: Date.now(),
        stats: pack.stats || manifest.stats || { entryCount: 0, categoryCounts: {} },
    };
}

async function buildLoredeckZipPackageFilesForPack(pack = {}, registry = getLoredeckLibraryRegistry(getState())) {
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack) || pack;
    if (!fresh?.packId) throw new Error('Loredeck is missing packId.');

    const source = await loadLoredeckSourceById(fresh.packId, {
        registry,
        registryRecord: fresh,
    });
    if (!source?.manifest) throw new Error(`${fresh.title || fresh.packId} has no loadable manifest.`);
    const deckFolderName = sanitizeFileStem(fresh.packId || source.manifest.id || 'loredeck');
    const deckFolder = `Loredecks/${deckFolderName}`;
    const files = [];
    const sourceInfo = source.manifest.source && typeof source.manifest.source === 'object' && !Array.isArray(source.manifest.source)
        ? source.manifest.source
        : {};
    const originalType = String(fresh.type || sourceInfo.originalType || source.manifest.type || '').trim();
    const manifest = {
        ...(cloneLoredeckJson(source.manifest) || {}),
        id: fresh.packId,
        type: 'custom',
        title: fresh.title || source.manifest.title || fresh.packId,
        description: fresh.description || source.manifest.description || '',
        fandom: fresh.fandom || source.manifest.fandom || '',
        era: fresh.era || source.manifest.era || '',
        author: fresh.author || source.manifest.author || '',
        version: fresh.version || source.manifest.version || '1.0.0',
        entrySchemaVersion: Math.max(3, Number(fresh.entrySchemaVersion || source.manifest.entrySchemaVersion) || 0),
        tags: Array.isArray(fresh.tags) ? fresh.tags : (Array.isArray(source.manifest.tags) ? source.manifest.tags : []),
        library: normalizePackLibraryMetadata(fresh.library || source.manifest.library || {}),
        stats: fresh.stats || source.manifest.stats || { entryCount: 0, categoryCounts: {} },
        source: {
            ...(source.manifest.source || {}),
            kind: 'package_export',
            originalType,
            originalPackId: fresh.packId,
        },
        update: {
            ...(source.manifest.update || {}),
            checkForUpdates: false,
            url: '',
        },
    };

    const exportedEntryFiles = [];
    const entryFiles = Array.isArray(source.entryFiles) ? source.entryFiles : [];
    if (!entryFiles.length) throw new Error(`${fresh.title || fresh.packId} has no Lorecard files to export.`);
    entryFiles.forEach((fileRecord, index) => {
        if (!fileRecord?.ok) throw new Error(`${fresh.title || fresh.packId} has a missing Lorecard file: ${fileRecord?.file || 'unknown'}`);
        const relativePath = getLoredeckPackageEntryPath(fileRecord, index);
        const schemaVersion = Math.max(3, Number(fileRecord.schemaVersion || manifest.entrySchemaVersion) || 0);
        const entries = Array.isArray(fileRecord.entries) ? fileRecord.entries : entryListFromLoredeckFileJson(fileRecord.json);
        addLoredeckPackageFile(files, `${deckFolder}/${relativePath}`, loredeckPackageStringify({
            schemaVersion,
            entries: cloneLoredeckJson(entries) || [],
        }));
        exportedEntryFiles.push(relativePath);
    });
    manifest.files = exportedEntryFiles;

    const baseUrl = source.baseUrl || (fresh.manifest ? resolveManifestUrlForFetch(fresh.manifest) : null);
    const copiedRefs = new Set(manifest.files);
    for (const ref of getLoredeckPackageRefPaths(manifest)) {
        if (copiedRefs.has(ref)) continue;
        if (!baseUrl) continue;
        await stageLoredeckPackageReferencedFile(files, deckFolder, baseUrl, ref);
        copiedRefs.add(ref);
    }
    if (getLoredeckTimelineRegistryCount(fresh.timelineRegistry)) {
        manifest.registries = { ...(manifest.registries || {}), timeline: 'timeline.json' };
        addLoredeckPackageFile(files, `${deckFolder}/timeline.json`, loredeckPackageStringify(normalizeLoredeckTimelineRegistry(fresh.timelineRegistry)), { replace: true });
    }
    if (getLoredeckTagRegistryCount(fresh.tagRegistry)) {
        manifest.registries = { ...(manifest.registries || {}), tags: 'tags.json' };
        addLoredeckPackageFile(files, `${deckFolder}/tags.json`, loredeckPackageStringify(normalizeLoredeckTagRegistry(fresh.tagRegistry)), { replace: true });
    }
    const exportedAssets = await stageLoredeckPackageAssets(files, fresh, manifest, baseUrl, deckFolder);
    if (Object.keys(exportedAssets).length) manifest.assets = exportedAssets;
    else delete manifest.assets;

    addLoredeckPackageFile(files, `${deckFolder}/loredeck.json`, loredeckPackageStringify(manifest));
    return {
        files,
        indexRecord: buildLoredeckPackageIndexRecord(fresh, manifest, deckFolderName),
        manifest,
    };
}

async function buildLoredeckZipPackageForExport(packs = []) {
    const unique = new Map();
    for (const pack of packs || []) {
        if (pack?.packId && !unique.has(pack.packId)) unique.set(pack.packId, pack);
    }
    const selected = [...unique.values()];
    if (!selected.length) throw new Error('Select one or more Loredecks before exporting.');

    const registry = getLoredeckLibraryRegistry(getState());
    const files = [];
    const indexRecords = [];
    for (const pack of selected) {
        const staged = await buildLoredeckZipPackageFilesForPack(pack, registry);
        for (const file of staged.files) addLoredeckPackageFile(files, file.path, file.data);
        indexRecords.push(staged.indexRecord);
    }

    const selectedIds = selected.map(pack => String(pack.packId || '').trim()).filter(Boolean);
    const folderSubset = buildLoredeckPackageFolderSubset(selectedIds, registry);
    const packageTitle = selected.length === 1
        ? `${selected[0].title || selected[0].packId} Loredeck Package`
        : `Saga Loredeck Package (${selected.length} decks)`;
    addLoredeckPackageFile(files, 'saga-package.json', loredeckPackageStringify({
        packageSchemaVersion: 1,
        packageType: 'saga_loredeck_package',
        title: packageTitle,
        description: selected.length === 1
            ? `Exported Saga Loredeck package for ${selected[0].title || selected[0].packId}.`
            : `Exported Saga Loredeck package containing ${selected.length} Loredecks.`,
        author: 'Saga',
        version: '1.0.0',
        exportedAt: Date.now(),
        deckCount: selected.length,
    }));
    addLoredeckPackageFile(files, 'Loredecks/index.json', loredeckPackageStringify({
        schemaVersion: 2,
        packageType: 'saga_loredeck_index',
        loredecks: indexRecords,
        folders: folderSubset.folders,
        deckPlacements: folderSubset.deckPlacements,
    }));

    const zipBytes = await createLoredeckZipPackage(files, { date: new Date() });
    const filenameStem = selected.length === 1
        ? sanitizeFileStem(selected[0].packId || selected[0].title || 'saga-loredeck')
        : `saga-loredecks-${new Date().toISOString().slice(0, 10)}`;
    return {
        zipBytes,
        filename: `${filenameStem}.saga-loredeck.zip`,
        deckCount: selected.length,
        fileCount: files.length,
    };
}

async function exportSelectedLoredeckBundles(packs = [], button = null) {
    const unique = new Map();
    for (const pack of packs || []) {
        if (pack?.packId && !unique.has(pack.packId)) unique.set(pack.packId, pack);
    }
    const selected = [...unique.values()];
    if (!selected.length) {
        toast('Select one or more Loredecks before exporting.', 'warning');
        return;
    }
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Exporting...';
    }
    try {
        const result = await buildLoredeckZipPackageForExport(selected);
        downloadBytes(result.zipBytes, result.filename, 'application/zip');
        toast(`Exported ${result.deckCount} Loredeck${result.deckCount === 1 ? '' : 's'} as ${result.filename}.`, 'success');
    } catch (e) {
        toast(e?.message || 'Loredeck package export failed.', 'error');
        console.warn('[Saga] Loredeck package export failed:', e);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Export Selected';
        }
    }
}

function canonicalizeLoredeckBundleValue(value, key = '') {
    const transientKeys = new Set([
        'contentHash',
        'exportedAt',
        'importedAt',
        'installedAt',
        'updatedAt',
        'loadedAt',
        'localModified',
        'health',
        'healthStatus',
        'exportReadiness',
        'pendingChanges',
        'manifestData',
        'source',
        'derivedFrom',
    ]);
    if (transientKeys.has(key)) return undefined;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        const values = value
            .map(item => canonicalizeLoredeckBundleValue(item))
            .filter(item => item !== undefined);
        return values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    const out = {};
    for (const sourceKey of Object.keys(value).sort()) {
        if (sourceKey === 'update' && key === 'manifest') continue;
        if (sourceKey === 'stats' && (key === 'manifest' || key === 'pack')) continue;
        const clean = canonicalizeLoredeckBundleValue(value[sourceKey], sourceKey);
        if (clean !== undefined) out[sourceKey] = clean;
    }
    return out;
}

function hashLoredeckBundleJson(value) {
    let text = '';
    try {
        text = JSON.stringify(canonicalizeLoredeckBundleValue(value || {}));
    } catch (_) {
        text = String(value || '');
    }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function getLoredeckInstallDuplicateMatches(install = {}) {
    const record = install.record || {};
    const originalPackId = String(install.originalPackId || record.source?.originalPackId || '').trim();
    const contentHash = String(record.source?.contentHash || '').trim();
    const titleKey = String(record.title || '').trim().toLowerCase();
    const versionKey = String(record.version || '').trim().toLowerCase();
    const fandomKey = String(record.fandom || '').trim().toLowerCase();
    const matches = [];
    const seen = new Set();

    for (const pack of getLoredeckLibrary(getState())) {
        if (!pack?.packId || seen.has(pack.packId)) continue;
        const source = pack.source && typeof pack.source === 'object' && !Array.isArray(pack.source) ? pack.source : {};
        const derivedFrom = pack.derivedFrom && typeof pack.derivedFrom === 'object' && !Array.isArray(pack.derivedFrom) ? pack.derivedFrom : {};
        const reasons = [];
        const exactHash = !!(contentHash && source.contentHash === contentHash);
        if (exactHash) reasons.push('same content hash');
        if (originalPackId && pack.packId === originalPackId) reasons.push('same deck ID');
        if (originalPackId && source.originalPackId === originalPackId) reasons.push('same source deck');
        if (originalPackId && derivedFrom.packId === originalPackId) reasons.push('same derived source');
        const sameTitleVersion = titleKey
            && titleKey === String(pack.title || '').trim().toLowerCase()
            && (!versionKey || versionKey === String(pack.version || '').trim().toLowerCase())
            && (!fandomKey || fandomKey === String(pack.fandom || '').trim().toLowerCase());
        if (!reasons.length && sameTitleVersion) reasons.push('same title/version');
        if (!reasons.length) continue;
        seen.add(pack.packId);
        matches.push({
            pack,
            reasons,
            exactHash,
            sameId: originalPackId && pack.packId === originalPackId,
            canReplace: pack.type !== 'bundled',
            localModified: pack.localModified === true,
        });
    }

    return matches.sort((a, b) => {
        if (a.exactHash !== b.exactHash) return a.exactHash ? -1 : 1;
        if (a.sameId !== b.sameId) return a.sameId ? -1 : 1;
        if (a.canReplace !== b.canReplace) return a.canReplace ? -1 : 1;
        return String(a.pack.title || a.pack.packId).localeCompare(String(b.pack.title || b.pack.packId));
    });
}

function isLoredeckZipPackageFile(file = {}) {
    const name = String(file?.name || '').toLowerCase();
    const type = String(file?.type || '').toLowerCase();
    return name.endsWith('.zip') || name.endsWith('.saga-loredeck.zip') || type.includes('zip');
}

function getLoredeckPackageMimeType(path = '', fallback = '') {
    const text = String(path || fallback || '').toLowerCase();
    if (/\.webp(?:[?#].*)?$/.test(text)) return 'image/webp';
    if (/\.jpe?g(?:[?#].*)?$/.test(text)) return 'image/jpeg';
    if (/\.gif(?:[?#].*)?$/.test(text)) return 'image/gif';
    if (/\.png(?:[?#].*)?$/.test(text)) return 'image/png';
    return String(fallback || '').includes('/') ? fallback : 'application/octet-stream';
}

function bytesToBase64(bytes = new Uint8Array()) {
    if (typeof btoa === 'function') {
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const chunk = bytes.slice(offset, offset + chunkSize);
            binary += String.fromCharCode(...chunk);
        }
        return btoa(binary);
    }
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(bytes).toString('base64');
    }
    throw new Error('This runtime cannot encode package assets.');
}

function resolveLoredeckPackageImportPath(deckRoot = '', ref = '') {
    const raw = String(ref || '').replace(/\\/g, '/').trim();
    if (!raw) return '';
    if (raw.startsWith('Loredecks/')) return normalizeLoredeckPackageRelativePath(raw);
    return normalizeLoredeckPackageRelativePath(`${String(deckRoot || '').replace(/\\/g, '/')}${raw}`);
}

function getLoredeckPackageRegistryRef(manifest = {}, key = '') {
    const registries = manifest.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    if (typeof registries[key] === 'string') return registries[key];
    if (key === 'timeline' && typeof manifest.timeline === 'string') return manifest.timeline;
    if (key === 'tags' && typeof manifest.tagRegistry === 'string') return manifest.tagRegistry;
    return '';
}

async function readLoredeckPackageRegistry(packageModel = {}, deck = {}, key = '') {
    const archive = packageModel.archive;
    const manifest = deck.manifest || {};
    const ref = getLoredeckPackageRegistryRef(manifest, key);
    if (ref) {
        const path = resolveLoredeckPackageImportPath(deck.deckRoot, ref);
        if (path && archive.has(path)) {
            return archive.readJson(path);
        }
    }
    const embeddedKey = key === 'timeline' ? 'timelineRegistry' : 'tagRegistry';
    const embedded = manifest[embeddedKey];
    return embedded && typeof embedded === 'object' && !Array.isArray(embedded) ? embedded : null;
}

async function buildLoredeckPackageAssetsForInstall(packageModel = {}, deck = {}, warnings = []) {
    const assets = {};
    for (const ref of deck.assetRefs || []) {
        try {
            const bytes = await packageModel.archive.readFileBytes(ref.resolvedPath);
            if (bytes.length > 1024 * 1024) {
                warnings.push(`Skipped oversized asset ${ref.resolvedPath}; imported deck will use a text fallback for that image.`);
                continue;
            }
            const mimeType = ref.asset?.mimeType || getLoredeckPackageMimeType(ref.resolvedPath);
            assets[ref.key || 'cover'] = {
                ...(cloneLoredeckJson(ref.asset) || {}),
                path: `data:${mimeType};base64,${bytesToBase64(bytes)}`,
                mimeType,
                updatedAt: Date.now(),
            };
        } catch (e) {
            warnings.push(`Could not import asset ${ref.resolvedPath}: ${e?.message || 'asset failed'}`);
        }
    }
    return assets;
}

async function buildLoredeckPackageEntryOverridesForInstall(packageModel = {}, deck = {}, warnings = []) {
    const entryOverrides = {};
    let skipped = 0;
    let duplicates = 0;
    const addEntries = (entries = [], fileRef = '', schemaVersion = 3) => {
        for (const raw of entries || []) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
            const id = normalizeLoredeckEntryId(raw.id || '');
            if (!id) {
                skipped += 1;
                continue;
            }
            if (entryOverrides[id]) {
                duplicates += 1;
                continue;
            }
            const entry = normalizeLoredeckEntryForSchemaV3({
                ...(cloneLoredeckJson(raw) || raw),
                id,
                schemaVersion: Math.max(3, Number(raw.schemaVersion || schemaVersion) || 0),
            });
            entry.extensions = {
                ...(entry.extensions || {}),
                sagaLoredeckSourceFile: String(fileRef || '').replace(String(deck.deckRoot || ''), ''),
            };
            entryOverrides[id] = entry;
        }
    };

    for (const fileRef of deck.fileRefs || []) {
        try {
            const json = await packageModel.archive.readJson(fileRef);
            addEntries(entryListFromLoredeckFileJson(json), fileRef, json?.schemaVersion || deck.manifest?.entrySchemaVersion || 3);
        } catch (e) {
            warnings.push(`Could not import Lorecard file ${fileRef}: ${e?.message || 'file failed'}`);
        }
    }
    addEntries(entryListFromLoredeckFileJson(deck.manifest), 'loredeck.json', deck.manifest?.entrySchemaVersion || 3);

    if (skipped) warnings.push(`Skipped ${skipped} Lorecard${skipped === 1 ? '' : 's'} without IDs.`);
    if (duplicates) warnings.push(`Skipped ${duplicates} duplicate Lorecard ID${duplicates === 1 ? '' : 's'}.`);
    return entryOverrides;
}

async function buildLoredeckPackageDeckInstall(packageModel = {}, deck = {}, options = {}) {
    const now = Date.now();
    const warnings = [];
    const originalPackId = normalizeLoredeckPackId(deck.originalPackId || deck.manifest?.id || deck.indexRecord?.packId || 'imported-loredeck');
    if (!originalPackId) throw new Error('Package deck is missing a usable ID.');
    const existing = getLoredeckDefinition(originalPackId);
    const packId = existing ? getUniqueLoredeckPackId(`${originalPackId}-custom`) : originalPackId;
    if (existing) warnings.push(`Deck ID ${originalPackId} already exists; install target will be ${packId}.`);
    if (deck.missingFiles?.length) warnings.push(`${deck.missingFiles.length} referenced Lorecard file${deck.missingFiles.length === 1 ? '' : 's'} missing from package.`);
    if (deck.missingAssets?.length) warnings.push(`${deck.missingAssets.length} referenced asset${deck.missingAssets.length === 1 ? '' : 's'} missing from package.`);

    const sourceManifest = cloneLoredeckJson(deck.manifest) || {};
    const indexRecord = cloneLoredeckJson(deck.indexRecord) || {};
    const sourceInfo = sourceManifest.source && typeof sourceManifest.source === 'object' && !Array.isArray(sourceManifest.source)
        ? sourceManifest.source
        : {};
    const originalType = String(sourceInfo.originalType || indexRecord.originalType || indexRecord.type || sourceManifest.type || 'custom').trim() || 'custom';
    const packageTitle = String(packageModel.packageMeta?.title || options.fileName || '').trim();
    const bundledReferenceManifest = existing?.type === 'bundled' && originalType === 'bundled'
        ? String(existing.manifest || existing.source?.url || '').trim()
        : '';

    if (bundledReferenceManifest) {
        const stats = sourceManifest.stats && typeof sourceManifest.stats === 'object' && !Array.isArray(sourceManifest.stats)
            ? cloneLoredeckJson(sourceManifest.stats) || {}
            : (indexRecord.stats && typeof indexRecord.stats === 'object' && !Array.isArray(indexRecord.stats)
                ? cloneLoredeckJson(indexRecord.stats) || {}
                : cloneLoredeckJson(existing.stats) || {});
        const sourceTags = Array.isArray(sourceManifest.tags) ? sourceManifest.tags : [];
        const indexTags = Array.isArray(indexRecord.tags) ? indexRecord.tags : [];
        const contentHash = hashLoredeckBundleJson({
            packageSchemaVersion: packageModel.packageMeta?.packageSchemaVersion || 1,
            packageType: packageModel.packageMeta?.packageType || 'saga_loredeck_package',
            originalPackId,
            manifest: sourceManifest,
            storageMode: 'bundled_manifest_reference',
        });
        const source = {
            ...(sourceManifest.source && typeof sourceManifest.source === 'object' && !Array.isArray(sourceManifest.source) ? sourceManifest.source : {}),
            kind: 'imported_zip',
            storageMode: 'bundled_manifest_reference',
            installedFrom: String(options.fileName || '').trim(),
            bundleType: 'saga_loredeck_zip_package',
            originalPackId,
            contentHash,
            exportedAt: Number.isFinite(Number(packageModel.packageMeta?.exportedAt)) ? Number(packageModel.packageMeta.exportedAt) : 0,
            importedAt: now,
            url: bundledReferenceManifest,
        };
        const record = {
            packId,
            type: 'custom',
            title: String(sourceManifest.title || indexRecord.title || existing.title || packId).trim(),
            description: String(sourceManifest.description || indexRecord.description || existing.description || '').trim(),
            fandom: String(sourceManifest.fandom || indexRecord.fandom || existing.fandom || '').trim(),
            era: String(sourceManifest.era || indexRecord.era || existing.era || '').trim(),
            author: String(sourceManifest.author || indexRecord.author || existing.author || '').trim(),
            version: String(sourceManifest.version || indexRecord.version || existing.version || '1.0.0').trim(),
            entrySchemaVersion: Math.max(3, Number(sourceManifest.entrySchemaVersion || indexRecord.entrySchemaVersion || existing.entrySchemaVersion) || 0),
            manifest: bundledReferenceManifest,
            source,
            tags: parseLoredeckTags([
                ...sourceTags,
                ...indexTags,
                'origin:imported',
                'origin:zip-package',
            ].filter(Boolean).join(', ')),
            stats,
            healthStatus: '',
            localModified: false,
            installedAt: now,
            updatedAt: now,
            derivedFrom: {
                kind: 'imported_loredeck_package',
                packId: originalPackId,
                title: String(sourceManifest.title || indexRecord.title || originalPackId).trim(),
                type: originalType,
                version: String(sourceManifest.version || indexRecord.version || '').trim(),
                packageTitle,
                sourceFile: String(options.fileName || '').trim(),
                importedAt: now,
            },
            entryOverrides: {},
            disabledEntryIds: [],
            pendingChanges: [],
        };
        const manifestSeed = {
            ...sourceManifest,
            id: packId,
            type: 'custom',
            library: {},
            stats,
            source,
        };
        record.manifestData = buildEmbeddedCustomManifest(manifestSeed, record);

        const install = {
            record,
            warnings,
            originalPackId,
            originalType,
            bundleType: 'saga_loredeck_zip_package',
            contentHash,
            declaredContentHash: '',
            contentHashMatches: true,
            embeddedEntryCount: Math.max(0, Number(stats.entryCount || indexRecord.entryCount || 0) || 0),
            pendingDropCount: 0,
            collision: !!existing,
            fileCount: deck.fileRefs?.length || 0,
            assetCount: 0,
            storageMode: 'bundled_manifest_reference',
        };
        const matches = getLoredeckInstallDuplicateMatches(install);
        const exactMatches = matches.filter(match => match.exactHash);
        if (exactMatches.length) {
            install.warnings.unshift(`${exactMatches.length} installed Loredeck${exactMatches.length === 1 ? '' : 's'} already match this package content hash.`);
        } else if (matches.length) {
            install.warnings.unshift(`${matches.length} possible duplicate Loredeck${matches.length === 1 ? '' : 's'} found.`);
        }
        return {
            ...install,
            matches,
        };
    }

    const entryOverrides = await buildLoredeckPackageEntryOverridesForInstall(packageModel, deck, warnings);
    const entries = Object.values(entryOverrides);
    if (!entries.length) throw new Error(`${sourceManifest.title || originalPackId} contains no importable Lorecards.`);
    const stats = buildLoredeckStatsFromEntries(entries);
    const assets = await buildLoredeckPackageAssetsForInstall(packageModel, deck, warnings);
    const timelineRegistry = normalizeLoredeckTimelineRegistry(await readLoredeckPackageRegistry(packageModel, deck, 'timeline'));
    const tagRegistry = normalizeLoredeckTagRegistry(await readLoredeckPackageRegistry(packageModel, deck, 'tags'));
    const contentHash = hashLoredeckBundleJson({
        packageSchemaVersion: packageModel.packageMeta?.packageSchemaVersion || 1,
        packageType: packageModel.packageMeta?.packageType || 'saga_loredeck_package',
        originalPackId,
        manifest: sourceManifest,
        entryOverrides,
        timelineRegistry,
        tagRegistry,
        assets,
    });
    const source = {
        ...(sourceManifest.source && typeof sourceManifest.source === 'object' && !Array.isArray(sourceManifest.source) ? sourceManifest.source : {}),
        kind: 'imported_zip',
        installedFrom: String(options.fileName || '').trim(),
        bundleType: 'saga_loredeck_zip_package',
        originalPackId,
        contentHash,
        exportedAt: Number.isFinite(Number(packageModel.packageMeta?.exportedAt)) ? Number(packageModel.packageMeta.exportedAt) : 0,
        importedAt: now,
    };
    const record = {
        packId,
        type: 'custom',
        title: String(sourceManifest.title || indexRecord.title || packId).trim(),
        description: String(sourceManifest.description || indexRecord.description || '').trim(),
        fandom: String(sourceManifest.fandom || indexRecord.fandom || '').trim(),
        era: String(sourceManifest.era || indexRecord.era || '').trim(),
        author: String(sourceManifest.author || indexRecord.author || '').trim(),
        version: String(sourceManifest.version || indexRecord.version || '1.0.0').trim(),
        entrySchemaVersion: Math.max(3, Number(sourceManifest.entrySchemaVersion || indexRecord.entrySchemaVersion) || 0),
        manifest: '',
        source,
        tags: parseLoredeckTags([
            ...(Array.isArray(sourceManifest.tags) ? sourceManifest.tags : []),
            ...(Array.isArray(indexRecord.tags) ? indexRecord.tags : []),
            'origin:imported',
            'origin:zip-package',
        ].filter(Boolean).join(', ')),
        stats,
        healthStatus: '',
        localModified: false,
        installedAt: now,
        updatedAt: now,
        derivedFrom: {
            kind: 'imported_loredeck_package',
            packId: originalPackId,
            title: String(sourceManifest.title || indexRecord.title || originalPackId).trim(),
            type: originalType,
            version: String(sourceManifest.version || indexRecord.version || '').trim(),
            packageTitle,
            sourceFile: String(options.fileName || '').trim(),
            importedAt: now,
        },
        entryOverrides,
        disabledEntryIds: [],
        pendingChanges: [],
    };
    if (Object.keys(assets).length) record.assets = assets;
    if (getLoredeckTimelineRegistryCount(timelineRegistry)) record.timelineRegistry = timelineRegistry;
    if (getLoredeckTagRegistryCount(tagRegistry)) record.tagRegistry = tagRegistry;

    const manifestSeed = {
        ...sourceManifest,
        id: packId,
        type: 'custom',
        files: [],
        library: {},
        assets: Object.keys(assets).length ? assets : sourceManifest.assets,
        stats,
        source,
    };
    record.manifestData = buildEmbeddedCustomManifest(manifestSeed, record);

    const install = {
        record,
        warnings,
        originalPackId,
        originalType,
        bundleType: 'saga_loredeck_zip_package',
        contentHash,
        declaredContentHash: '',
        contentHashMatches: true,
        embeddedEntryCount: entries.length,
        pendingDropCount: 0,
        collision: !!existing,
        fileCount: deck.fileRefs?.length || 0,
        assetCount: Object.keys(assets).length,
    };
    const matches = getLoredeckInstallDuplicateMatches(install);
    const exactMatches = matches.filter(match => match.exactHash);
    if (exactMatches.length) {
        install.warnings.unshift(`${exactMatches.length} installed Loredeck${exactMatches.length === 1 ? '' : 's'} already match this package content hash.`);
    } else if (matches.length) {
        install.warnings.unshift(`${matches.length} possible duplicate Loredeck${matches.length === 1 ? '' : 's'} found.`);
    }
    return {
        ...install,
        matches,
    };
}

async function readLoredeckZipPackageInstallFile(file) {
    const fileName = file?.name || 'selected-package.saga-loredeck.zip';
    try {
        const packageModel = await parseLoredeckZipPackage(file);
        const installs = [];
        const failures = [...(packageModel.failures || [])];
        for (const deck of packageModel.decks || []) {
            try {
                installs.push(await buildLoredeckPackageDeckInstall(packageModel, deck, { fileName }));
            } catch (e) {
                failures.push({
                    record: deck.indexRecord || deck.manifest || {},
                    error: e?.message || 'Deck package record could not be installed.',
                });
            }
        }
        return {
            ok: installs.length > 0,
            fileName,
            packageModel,
            installs,
            failures,
            warnings: packageModel.warnings || [],
            error: installs.length ? '' : 'Loredeck package contains no installable decks.',
        };
    } catch (e) {
        return {
            ok: false,
            fileName,
            packageModel: null,
            installs: [],
            failures: [],
            warnings: [],
            error: e?.message || 'Loredeck package import failed.',
        };
    }
}

function buildLoredeckPackageRegistryForInstall(packageInstall = {}, installs = []) {
    const selected = installs.filter(install => install?.record?.packId);
    const packs = {};
    for (const install of selected) packs[install.record.packId] = install.record;
    return {
        schemaVersion: 1,
        packs,
        folders: [],
        deckPlacements: [],
        activeStack: [],
    };
}

async function commitLoredeckPackageInstall(packageInstall = {}, installs = [], overlay = null, button = null) {
    const selected = installs.filter(install => install?.record?.packId);
    if (!selected.length) {
        toast('Select at least one valid Loredeck package deck to install.', 'warning');
        return;
    }
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Installing...';
    }
    try {
        const registry = buildLoredeckPackageRegistryForInstall(packageInstall, selected);
        const result = importLoredeckLibraryRegistry(registry, { replace: false });
        if (!result.ok) throw new Error(result.error || 'Loredeck package install failed.');
        for (const install of selected) {
            const installed = result.library?.packs?.[install.record.packId] || install.record;
            cacheInstalledLoredeckBundle(installed, { health: null });
            selectLoredeckForDetails(installed.packId, { refresh: false });
        }
        overlay?.remove?.();
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        const skipped = result.skippedCount ? ` Skipped ${result.skippedCount} bundled-id conflict${result.skippedCount === 1 ? '' : 's'}.` : '';
        toast(`Installed ${result.importedCount || selected.length} Custom Loredeck${selected.length === 1 ? '' : 's'} from package.${skipped}`, result.skippedCount ? 'warning' : 'success');
    } catch (e) {
        toast(e?.message || 'Loredeck package install failed.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Install Selected';
        }
    }
}

function openLoredeckPackageInstallPreviewDialog(packageInstall = {}) {
    document.querySelector('.saga-loredeck-install-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-install-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-install-shell';
    overlay.appendChild(shell);

    const meta = packageInstall.packageModel?.packageMeta || {};
    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Import Loredeck Package';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = meta.title || packageInstall.fileName || 'Review package contents before installing as Custom Loredecks.';
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Cancel this Loredeck package import.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-install-form';
    shell.appendChild(form);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-manifest-preview';
    const summaryTitle = document.createElement('div');
    summaryTitle.className = 'saga-runtime-card-title';
    summaryTitle.textContent = meta.title || packageInstall.fileName || 'Loredeck Package';
    summary.appendChild(summaryTitle);
    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-entry-summary';
    chips.appendChild(createStatusPill(`${packageInstall.installs?.length || 0} installable`, 'Loredecks in this package that can be installed.'));
    chips.appendChild(createStatusPill(`${packageInstall.packageModel?.entryCountHint || 0} Lorecards`, 'Manifest-declared Lorecard count in this package.'));
    chips.appendChild(createStatusPill(`${packageInstall.packageModel?.folderCount || 0} folders`, 'Folder records declared by the package index.'));
    chips.appendChild(createStatusPill(packageInstall.fileName || 'local zip', 'Selected package file.'));
    if (packageInstall.failures?.length) chips.appendChild(createStatusPill(`${packageInstall.failures.length} failed`, 'Deck records that could not be parsed or installed.'));
    summary.appendChild(chips);
    form.appendChild(summary);

    const warningText = [
        ...(packageInstall.warnings || []),
        ...((packageInstall.failures || []).map(failure => `${failure.record?.title || failure.record?.packId || 'Deck'}: ${failure.error}`)),
    ];
    if (warningText.length) {
        const warningList = document.createElement('div');
        warningList.className = 'saga-loredeck-generated-readiness-list';
        for (const warning of warningText.slice(0, 12)) {
            const item = document.createElement('div');
            item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-warning';
            item.textContent = warning;
            warningList.appendChild(item);
        }
        if (warningText.length > 12) {
            const item = document.createElement('div');
            item.className = 'saga-runtime-help';
            item.textContent = `+${warningText.length - 12} more package warning${warningText.length - 12 === 1 ? '' : 's'}.`;
            warningList.appendChild(item);
        }
        form.appendChild(warningList);
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-bulk-install-list';
    for (const [index, install] of (packageInstall.installs || []).entries()) {
        const row = document.createElement('label');
        row.className = 'saga-loredeck-bulk-install-row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !(install.matches || []).some(match => match.exactHash);
        checkbox.dataset.index = String(index);
        row.appendChild(checkbox);

        const main = document.createElement('div');
        main.className = 'saga-loredeck-bulk-install-main';
        const rowTitle = document.createElement('div');
        rowTitle.className = 'saga-loredeck-install-match-title';
        rowTitle.textContent = install.record?.title || install.record?.packId || `Package Deck ${index + 1}`;
        main.appendChild(rowTitle);
        const rowMeta = document.createElement('div');
        rowMeta.className = 'saga-loredeck-install-match-meta';
        rowMeta.textContent = [
            install.record?.packId,
            `from ${install.originalPackId}`,
            `${install.embeddedEntryCount || 0} Lorecards`,
            `${install.fileCount || 0} files`,
            `${install.assetCount || 0} assets`,
            install.matches?.length ? `${install.matches.length} duplicate match${install.matches.length === 1 ? '' : 'es'}` : 'no duplicate matches',
            install.warnings?.[0] || '',
        ].filter(Boolean).join(' | ');
        main.appendChild(rowMeta);
        row.appendChild(main);
        list.appendChild(row);
    }
    form.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const installButton = createButton('Install Selected', 'Install checked package decks as editable Custom Loredecks.', async (btn) => {
        const selected = [...list.querySelectorAll('input[type="checkbox"]:checked')]
            .map(input => packageInstall.installs[Number(input.dataset.index)])
            .filter(Boolean);
        await commitLoredeckPackageInstall(packageInstall, selected, overlay, btn);
    }, 'saga-primary-button');
    installButton.disabled = !(packageInstall.installs || []).length;
    actions.appendChild(installButton);
    actions.appendChild(createButton('Cancel', 'Cancel this Loredeck package import.', () => overlay.remove()));
    form.appendChild(actions);
}

function cacheInstalledLoredeckBundle(installed = {}, parsed = {}) {
    if (installed.manifestData) {
        loredeckManifestPreviewCache.set(installed.packId, {
            manifest: installed.manifestData,
            health: parsed.health || null,
            error: '',
            loadedAt: Date.now(),
        });
    }
    if (canUseVirtualLoredeckData(installed)) {
        const entryCache = buildGeneratedLoredeckEntryCache(installed, installed.manifestData || {});
        loredeckEntryPreviewCache.set(installed.packId, {
            ...entryCache,
            health: parsed.health || null,
            error: '',
            loadedAt: Date.now(),
        });
    }
}

async function installLoredeckBundleFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = false;
    input.accept = '.saga-loredeck.zip,.zip,application/zip,application/x-zip-compressed';
    input.addEventListener('change', async () => {
        const files = [...(input.files || [])];
        if (!files.length) return;
        try {
            const file = files[0];
            if (!isLoredeckZipPackageFile(file)) {
                throw new Error('Import a .saga-loredeck.zip package.');
            }
            const packageInstall = await readLoredeckZipPackageInstallFile(file);
            if (!packageInstall.ok) throw new Error(packageInstall.error || 'Loredeck package import failed.');
            openLoredeckPackageInstallPreviewDialog(packageInstall);
        } catch (e) {
            toast(e?.message || 'Loredeck import failed.', 'error');
        }
    }, { once: true });
    input.click();
}

function createLoredeckEditorField(container, labelText, value = '', options = {}) {
    const label = document.createElement('label');
    label.className = `saga-loredeck-editor-field${options.full ? ' saga-loredeck-editor-field-full' : ''}`;
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, options.tooltip || labelText);
    label.appendChild(span);

    const input = options.multiline ? document.createElement('textarea') : document.createElement('input');
    input.className = options.multiline ? 'saga-lore-editor-textarea' : 'saga-lore-editor-input';
    if (!options.multiline) input.type = 'text';
    input.value = String(value || '');
    input.disabled = options.disabled === true;
    input.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('mousedown', e => e.stopPropagation());
    label.appendChild(input);
    container.appendChild(label);
    return input;
}

function getLoredeckCreatorJobForPack(pack = {}) {
    const packId = String(pack?.packId || '').trim();
    if (!packId || !isGeneratedLoredeckPack(pack)) return null;
    const active = getActiveLoredeckCreatorJob(getState());
    if (active && String(active.generatedPackId || active.brief?.packId || '').trim() === packId) return active;
    const registry = getLoredeckCreatorRegistry(getState());
    const jobs = registry?.jobs && typeof registry.jobs === 'object' && !Array.isArray(registry.jobs)
        ? Object.values(registry.jobs)
        : [];
    return jobs.find(job => String(job?.generatedPackId || job?.brief?.packId || '').trim() === packId) || null;
}

function collectLoredeckCreatorChangeEntryIds(changes = []) {
    const ids = new Set();
    for (const change of Array.isArray(changes) ? changes : []) {
        for (const rawId of change?.affectedEntryIds || []) {
            const id = normalizeLoredeckEntryId(rawId);
            if (id) ids.add(id);
        }
        const overrides = isPlainObjectValue(change?.payload?.entryOverrides) ? change.payload.entryOverrides : {};
        for (const rawId of Object.keys(overrides)) {
            const id = normalizeLoredeckEntryId(rawId);
            if (id) ids.add(id);
        }
    }
    return ids;
}

function countLoredeckCreatorCoveredApprovedTitles(approvedEntryIds = new Set(), candidateIds = new Set()) {
    let count = 0;
    for (const id of approvedEntryIds || []) {
        if (candidateIds.has(id)) count += 1;
    }
    return count;
}

function getLoredeckCreatorPipelineReadiness(pack = {}, creatorJob = null) {
    const job = creatorJob || getLoredeckCreatorJobForPack(pack);
    const acceptedEntries = getAcceptedGeneratedLoredeckEntries(pack);
    const acceptedEntryIds = new Set(acceptedEntries.map(entry => normalizeLoredeckEntryId(entry.id)).filter(Boolean));
    const pendingChanges = getLoredeckPendingChanges(pack);
    const draftChanges = getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(pack.packId) || {});
    const pendingEntryIds = collectLoredeckCreatorChangeEntryIds(pendingChanges);
    const draftEntryIds = collectLoredeckCreatorChangeEntryIds(draftChanges);
    const warnings = [];

    if (!job) {
        warnings.push('No linked Creator job was found for this Generated Loredeck, so batch completeness cannot be verified.');
        return {
            jobLinked: false,
            statusLabel: acceptedEntries.length ? 'Accepted data only' : 'No Creator job',
            warnings,
            titleBatchCount: 0,
            titleBatchDraftedCount: 0,
            approvedTitleCount: 0,
            approvedTitleAcceptedCount: 0,
            approvedTitlePendingCount: 0,
            approvedTitleDraftCount: 0,
            approvedTitleUnhandledCount: 0,
            eligiblePlanningBatchCount: 0,
            queuedPlanningBatchCount: 0,
            acceptedPlanningBatchCount: 0,
            remainingEntryCount: 0,
            activeEntryBatchLabel: '',
        };
    }

    const titleBatches = getLoredeckCreatorTitleBatchRows(job);
    const titleBatchIds = new Set(titleBatches.map(batch => batch.id).filter(Boolean));
    const draftedTitleBatchIds = getLoredeckCreatorTitleDraftedBatchIds(job);
    const titleBatchDraftedCount = [...draftedTitleBatchIds].filter(id => titleBatchIds.has(id)).length;
    const approvedTitles = getLoredeckCreatorApprovedTitleDrafts(job);
    const approvedEntryIds = new Set(approvedTitles.map(draft => normalizeLoredeckEntryId(draft.titleId)).filter(Boolean));
    const planningBatches = getLoredeckCreatorPlanningBatchRows(job);
    const eligiblePlanningBatches = planningBatches.filter(batch => batch.approvedTitleCount > 0);
    const eligiblePlanningBatchIds = new Set(eligiblePlanningBatches.map(batch => batch.id).filter(Boolean));
    const queuedPlanningBatchIds = getLoredeckCreatorPlanningQueuedBatchIds(job);
    const acceptedPlanningBatchIds = getLoredeckCreatorPlanningAcceptedBatchIds(job);
    const queuedPlanningBatchCount = [...queuedPlanningBatchIds].filter(id => eligiblePlanningBatchIds.has(id)).length;
    const acceptedPlanningBatchCount = [...acceptedPlanningBatchIds].filter(id => eligiblePlanningBatchIds.has(id)).length;
    const entryProgress = getLoredeckCreatorEntryDraftProgress(job, pack);
    const approvedTitleAcceptedCount = countLoredeckCreatorCoveredApprovedTitles(approvedEntryIds, acceptedEntryIds);
    const approvedTitlePendingCount = countLoredeckCreatorCoveredApprovedTitles(approvedEntryIds, pendingEntryIds);
    const approvedTitleDraftCount = countLoredeckCreatorCoveredApprovedTitles(approvedEntryIds, draftEntryIds);
    const approvedTitleHandledCount = Math.min(
        approvedEntryIds.size,
        approvedTitleAcceptedCount + approvedTitlePendingCount + approvedTitleDraftCount
    );
    const approvedTitleUnhandledCount = Math.max(0, approvedEntryIds.size - approvedTitleHandledCount);

    if (!job.approved) warnings.push('Scope Brief is not approved in the linked Creator job.');
    if (!job.outlineApproved) warnings.push('Story Outline is not approved in the linked Creator job.');
    if (titleBatches.length && titleBatchDraftedCount < titleBatches.length) {
        warnings.push(`${titleBatches.length - titleBatchDraftedCount} title set${titleBatches.length - titleBatchDraftedCount === 1 ? '' : 's'} still need a title pass.`);
    }
    if (!approvedEntryIds.size) {
        warnings.push('No approved title plan is linked to this Generated Loredeck.');
    }
    if (eligiblePlanningBatches.length && queuedPlanningBatchCount < eligiblePlanningBatches.length) {
        warnings.push(`${eligiblePlanningBatches.length - queuedPlanningBatchCount} approved-title set${eligiblePlanningBatches.length - queuedPlanningBatchCount === 1 ? '' : 's'} still need Context and Tag planning.`);
    }
    if (queuedPlanningBatchCount && acceptedPlanningBatchCount < queuedPlanningBatchCount) {
        warnings.push(`${queuedPlanningBatchCount - acceptedPlanningBatchCount} planned Context and Tag set${queuedPlanningBatchCount - acceptedPlanningBatchCount === 1 ? '' : 's'} still need Pending Review acceptance.`);
    }
    if (approvedEntryIds.size && approvedTitleAcceptedCount < approvedEntryIds.size) {
        warnings.push(`${approvedEntryIds.size - approvedTitleAcceptedCount} approved title${approvedEntryIds.size - approvedTitleAcceptedCount === 1 ? '' : 's'} do not have accepted Lorecards yet.`);
    }

    const complete = !!approvedEntryIds.size
        && approvedTitleAcceptedCount >= approvedEntryIds.size
        && (!titleBatches.length || titleBatchDraftedCount >= titleBatches.length)
        && (!eligiblePlanningBatches.length || acceptedPlanningBatchCount >= eligiblePlanningBatches.length);
    const statusLabel = complete
        ? 'Creator complete'
        : (approvedTitleAcceptedCount ? 'Partial deck' : (entryProgress?.remainingCount ? 'Entries in progress' : 'Planning in progress'));

    return {
        jobLinked: true,
        jobId: job.jobId || '',
        statusLabel,
        warnings,
        titleBatchCount: titleBatches.length,
        titleBatchDraftedCount,
        approvedTitleCount: approvedEntryIds.size,
        approvedTitleAcceptedCount,
        approvedTitlePendingCount,
        approvedTitleDraftCount,
        approvedTitleUnhandledCount,
        eligiblePlanningBatchCount: eligiblePlanningBatches.length,
        queuedPlanningBatchCount,
        acceptedPlanningBatchCount,
        remainingEntryCount: entryProgress?.remainingCount || 0,
        activeEntryBatchLabel: entryProgress?.activeBatchLabel || '',
    };
}

function appendLoredeckCreatorReadinessItems(container, blockers = [], warnings = []) {
    if (!blockers.length && !warnings.length) return;
    const list = document.createElement('div');
    list.className = 'saga-loredeck-generated-readiness-list';
    for (const blocker of blockers) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-blocker';
        item.textContent = blocker;
        list.appendChild(item);
    }
    for (const warning of warnings) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-generated-readiness-item saga-loredeck-generated-readiness-warning';
        item.textContent = warning;
        list.appendChild(item);
    }
    container.appendChild(list);
}

function getGeneratedLoredeckExportReadiness(pack = {}, health = null, creatorJob = null) {
    if (!isGeneratedLoredeckPack(pack)) {
        return {
            ready: true,
            blockers: [],
            warnings: [],
            acceptedEntryCount: 0,
            pendingChangeCount: 0,
            draftChangeCount: 0,
            pipeline: null,
        };
    }
    const acceptedEntries = getAcceptedGeneratedLoredeckEntries(pack);
    const pendingChanges = getLoredeckPendingChanges(pack);
    const draftChanges = getLoredeckAssistantDraftChanges(loredeckAssistantDraftCache.get(pack.packId) || {});
    const pipeline = getLoredeckCreatorPipelineReadiness(pack, creatorJob);
    const blockers = [];
    const warnings = [...pipeline.warnings];
    if (!acceptedEntries.length) blockers.push('Generated Loredeck needs at least one accepted Lorecard.');
    if (pendingChanges.length) blockers.push('Pending Review must be accepted or rejected before finalizing as Custom.');
    if (draftChanges.length) blockers.push('Creator/Assistant Draft Batch must be queued, accepted, or dropped before finalizing as Custom.');
    if (isLoredeckHealthStatusStale(pack)) warnings.push('Deck Health is stale; rerun validation before sharing.');
    if ((health?.errors || []).length) warnings.push('Latest Deck Health has errors.');
    if (!getLoredeckTimelineRegistryCount(pack.timelineRegistry)) warnings.push('No local timeline registry is saved yet.');
    if (!getLoredeckTagRegistryCount(pack.tagRegistry)) warnings.push('No local tag registry is saved yet.');
    return {
        ready: blockers.length === 0,
        blockers,
        warnings,
        acceptedEntryCount: acceptedEntries.length,
        pendingChangeCount: pendingChanges.length,
        draftChangeCount: draftChanges.length,
        pipeline,
    };
}

function formatGeneratedLoredeckExportNotice(message = '') {
    if (message.includes('needs at least one accepted Lorecard')) return 'No accepted Lorecards are available for export yet.';
    if (message.includes('Pending Review')) return 'Pending Review proposals are excluded from export until accepted.';
    if (message.includes('Draft Batch')) return 'Creator/Assistant draft proposals are excluded from export until accepted.';
    return message;
}

function createGeneratedLoredeckExportReadinessCard(pack = {}) {
    if (!isGeneratedLoredeckPack(pack)) return null;
    const cached = loredeckManifestPreviewCache.get(pack.packId);
    const readiness = getGeneratedLoredeckExportReadiness(pack, cached?.health || null);
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview saga-loredeck-generated-readiness';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Generated Export Snapshot';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(readiness.ready ? 'Clean' : 'Review state', 'Export is available; this summarizes accepted entries, pending review, and draft batch state.'));
    summary.appendChild(createStatusPill(readiness.pipeline?.statusLabel || 'Pipeline check', 'Creator pipeline status from staged generation metadata.'));
    summary.appendChild(createStatusPill(`${readiness.acceptedEntryCount} accepted`, 'Accepted generated Lorecards that will export and load at runtime.'));
    summary.appendChild(createStatusPill(`${readiness.pendingChangeCount} pending`, 'Pending Review proposals are excluded from export until accepted.'));
    summary.appendChild(createStatusPill(`${readiness.draftChangeCount} drafted`, 'Creator/Assistant draft proposals are excluded from export until accepted.'));
    if (readiness.pipeline?.titleBatchCount) {
        summary.appendChild(createStatusPill(`${readiness.pipeline.titleBatchDraftedCount}/${readiness.pipeline.titleBatchCount} title sets`, 'Title sets drafted from the approved Story Outline.'));
    }
    if (readiness.pipeline?.eligiblePlanningBatchCount) {
        summary.appendChild(createStatusPill(`${readiness.pipeline.acceptedPlanningBatchCount}/${readiness.pipeline.eligiblePlanningBatchCount} Context sets accepted`, 'Context and Tag sets accepted into the Generated Loredeck registry.'));
    }
    if (readiness.pipeline?.approvedTitleCount) {
        summary.appendChild(createStatusPill(`${readiness.pipeline.approvedTitleAcceptedCount}/${readiness.pipeline.approvedTitleCount} titles covered`, 'Approved title plan covered by accepted generated Lorecards.'));
    }
    summary.appendChild(createStatusPill(`${getLoredeckTimelineRegistryCount(pack.timelineRegistry)} timeline`, 'Saved local timeline anchors/windows.'));
    summary.appendChild(createStatusPill(`${getLoredeckTagRegistryCount(pack.tagRegistry)} tags`, 'Saved local tag definitions.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = readiness.ready
        ? 'Export will include accepted generated Lorecards, embedded manifest stats, local timeline/tag registries, and passive package assets.'
        : 'Export is available now. Pending or drafted material is reported here and will not be included until it is accepted into the deck.';
    wrap.appendChild(help);

    appendLoredeckCreatorReadinessItems(wrap, [], [
        ...readiness.blockers.map(formatGeneratedLoredeckExportNotice),
        ...readiness.warnings,
    ]);

    return wrap;
}

function createLoredeckManifestPreview(pack) {
    const preview = document.createElement('div');
    preview.className = 'saga-loredeck-manifest-preview';
    const embeddedPreviewManifest = isVirtualLoredeckPack(pack)
        ? buildEmbeddedCustomManifest(pack.manifestData || {}, refreshGeneratedLoredeckDerivedMetadata(cloneLoredeckJson(pack) || { ...pack }))
        : null;
    const cached = loredeckManifestPreviewCache.get(pack.packId) || (embeddedPreviewManifest
        ? {
            manifest: embeddedPreviewManifest,
            error: '',
            loadedAt: pack.updatedAt || pack.installedAt || 0,
        }
        : null);

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Manifest Preview';
    preview.appendChild(title);

    if (!pack.manifest && !cached?.manifest) {
        preview.appendChild(createEmptyMessage('No manifest path or URL is registered for this Loredeck.'));
        return preview;
    }
    if (!cached) {
        preview.appendChild(createEmptyMessage('Manifest not loaded. Use Inspect Manifest to preview files and schema metadata.'));
        return preview;
    }
    if (cached.error) {
        preview.appendChild(createKeyValue('Status', 'Load failed', 'Manifest preview load status.'));
        preview.appendChild(createKeyValue('Error', cached.error, 'Last manifest fetch error.'));
        return preview;
    }

    const manifest = cached.manifest || {};
    const files = Array.isArray(manifest.files) ? manifest.files.map(file => String(file || '').trim()).filter(Boolean) : [];
    const registries = manifest.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-detail-grid';
    summary.appendChild(createKeyValue('Schema', String(manifest.schemaVersion || 'unset'), 'Loredeck manifest schema version.'));
    summary.appendChild(createKeyValue('Lorecard Schema', String(manifest.entrySchemaVersion || 'unset'), 'Lorecard schema version used by deck files.'));
    summary.appendChild(createKeyValue('Content Kind', manifest.contentKind || 'unset', 'Fandom, original, system, or other pack content kind.'));
    summary.appendChild(createKeyValue('Files', String(files.length), 'Entry JSON files referenced by the manifest.'));
    summary.appendChild(createKeyValue('Registries', Object.keys(registries).join(', ') || 'none', 'Taxonomy, gate, scoring, or other registry files declared by the manifest.'));
    summary.appendChild(createKeyValue('Continuity', formatLoredeckManifestContinuity(manifest.continuity), 'Canon/adaptation/source-boundary metadata.'));
    summary.appendChild(createKeyValue('Compatibility', formatLoredeckCompatibility(manifest.compatibility), 'Saga schema compatibility declared by the pack.'));
    summary.appendChild(createKeyValue('Update URL', manifest.update?.url || pack.source?.updateUrl || 'none', 'Optional update-check source for creator-published packs.'));
    preview.appendChild(summary);

    if (cached.health) {
        const validation = document.createElement('div');
        validation.className = 'saga-loredeck-detail-grid';
        const healthSummary = cached.health.summary || {};
        validation.appendChild(createKeyValue('Validation', cached.health.status || 'unknown', 'Latest Deck Health validation run from the Loredeck editor/export path.'));
        validation.appendChild(createKeyValue('Validation Issues', `${healthSummary.errorCount || 0} errors / ${healthSummary.warningCount || 0} warnings / ${healthSummary.suggestionCount || 0} suggestions`, 'Issue counts from latest validation.'));
        validation.appendChild(createKeyValue('Schema v3', `${healthSummary.schemaV3EntryCount || 0} Lorecards / ${healthSummary.schemaV3IssueCount || 0} issues`, 'Schema v3 conformance count from latest validation.'));
        validation.appendChild(createKeyValue('Stats Drift', String(healthSummary.manifestStatsMismatchCount || 0), 'Manifest stats mismatches from latest validation.'));
        preview.appendChild(validation);
        const repairPanel = createLoredeckHealthRepairPlanner(pack, cached.health);
        if (repairPanel) preview.appendChild(repairPanel);
    }

    const fileList = document.createElement('div');
    fileList.className = 'saga-loredeck-file-list';
    for (const file of files.slice(0, 14)) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-file-item';
        item.textContent = file;
        fileList.appendChild(item);
    }
    if (!files.length && canUseVirtualLoredeckData(pack)) {
        const item = document.createElement('div');
        item.className = 'saga-loredeck-file-item saga-loredeck-file-item-muted';
        item.textContent = isGeneratedLoredeckPack(pack)
            ? 'Accepted generated Lorecards are stored in this local Loredeck record.'
            : 'Embedded Lorecards are stored in this installed Custom Loredeck record.';
        fileList.appendChild(item);
    }
    if (files.length > 14) {
        const more = document.createElement('div');
        more.className = 'saga-loredeck-file-item saga-loredeck-file-item-muted';
        more.textContent = `+${files.length - 14} more file${files.length - 14 === 1 ? '' : 's'}`;
        fileList.appendChild(more);
    }
    preview.appendChild(fileList);

    if (cached.loadedAt) {
        const loaded = document.createElement('div');
        loaded.className = 'saga-runtime-help';
        loaded.textContent = `Last inspected ${new Date(cached.loadedAt).toLocaleString()}.`;
        preview.appendChild(loaded);
    }
    return preview;
}

function getLoredeckHealthIssueGroups(health = null) {
    const groups = [
        ['error', 'Errors', Array.isArray(health?.errors) ? health.errors : []],
        ['warning', 'Warnings', Array.isArray(health?.warnings) ? health.warnings : []],
        ['suggestion', 'Suggestions', Array.isArray(health?.suggestions) ? health.suggestions : []],
    ];
    return groups.map(([severity, title, issues]) => ({
        severity,
        title,
        issues: issues.map((issue, index) => normalizeLoredeckHealthIssueForRepair(issue, severity, index)),
    }));
}

function normalizeLoredeckHealthIssueForRepair(issue = {}, severity = 'suggestion', index = 0) {
    const normalized = issue && typeof issue === 'object' && !Array.isArray(issue) ? issue : {};
    const code = String(normalized.code || severity || 'issue').trim().slice(0, 120);
    const message = String(normalized.message || '').trim().slice(0, 1000);
    const entryIds = normalizeLoredeckPendingIdList(normalized.entryIds || normalized.affectedEntryIds || []);
    const tagIds = normalizeLoredeckTagTextList(
        [
            ...(Array.isArray(normalized.tagIds) ? normalized.tagIds : []),
            ...(Array.isArray(normalized.tags) ? normalized.tags.map(tag => typeof tag === 'string' ? tag : tag?.tag).filter(Boolean) : []),
            normalized.tag || '',
        ],
        80,
        true
    );
    const timelineIds = normalizeLoredeckPendingTimelineIdList([
        normalized.anchorId || '',
        normalized.timelineWindowId || '',
        ...(Array.isArray(normalized.anchorIds) ? normalized.anchorIds : []),
        ...(Array.isArray(normalized.timelineIds) ? normalized.timelineIds : []),
    ]);
    const idBase = [
        severity,
        code,
        message,
        normalized.packId || '',
        normalized.file || '',
        entryIds.join(','),
        tagIds.join(','),
        timelineIds.join(','),
        index,
    ].join('|');
    return {
        ...cloneLoredeckJson(normalized),
        issueId: `health_${hashLoredeckHealthRepairIssueId(idBase)}`,
        severity,
        code,
        message,
        entryIds,
        tagIds,
        timelineIds,
    };
}

function normalizeLoredeckHealthGroupIssuesForRepair(group = {}) {
    return (group.issues || [])
        .map((issue, index) => normalizeLoredeckHealthIssueForRepair(issue, group.severity || issue?.severity || 'suggestion', index))
        .filter(issue => issue.issueId);
}

function hashLoredeckHealthRepairIssueId(value = '') {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function getLoredeckHealthRepairSelection(packId = '', health = null) {
    const selected = new Set(loredeckHealthRepairSelectionCache.get(String(packId || '').trim()) || []);
    const validIds = new Set(getLoredeckHealthIssueGroups(health).flatMap(group => group.issues.map(issue => issue.issueId)));
    return new Set([...selected].filter(id => validIds.has(id)));
}

function setLoredeckHealthRepairSelection(packId = '', issueId = '', selected = false) {
    const id = String(packId || '').trim();
    const issueKey = String(issueId || '').trim();
    if (!id || !issueKey) return;
    const current = new Set(loredeckHealthRepairSelectionCache.get(id) || []);
    if (selected) current.add(issueKey);
    else current.delete(issueKey);
    loredeckHealthRepairSelectionCache.set(id, [...current]);
}

function setLoredeckHealthRepairSelectionBulk(pack, health = null, mode = 'all') {
    const id = String(pack?.packId || '').trim();
    if (!id) return;
    const allIds = getLoredeckHealthIssueGroups(health).flatMap(group => group.issues.map(issue => issue.issueId));
    loredeckHealthRepairSelectionCache.set(id, mode === 'all' ? allIds : []);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
}

function createLoredeckHealthRepairPlanner(pack, health = null) {
    const groups = getLoredeckHealthIssueGroups(health);
    const allIssues = groups.flatMap(group => group.issues);
    if (!allIssues.length) return null;
    const editable = pack?.type !== 'bundled';
    const selectedIds = getLoredeckHealthRepairSelection(pack.packId, health);
    const selectedCount = allIssues.filter(issue => selectedIds.has(issue.issueId)).length;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-health-repair-planner';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Assistant Repair Planning';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${allIssues.length} issue${allIssues.length === 1 ? '' : 's'}`, 'Deck Health issues from the latest validation run.'));
    summary.appendChild(createStatusPill(`${selectedCount} selected`, 'Selected issues will be sent to the Lore Assistant for repair planning.'));
    if (!editable) summary.appendChild(createStatusPill('Read-only', 'Bundled Loredecks must be duplicated as Custom before assistant repair planning can create proposals.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = editable
        ? 'Select Deck Health issues and draft repair proposals. Repairs enter the Assistant Draft Batch first, then Pending Review if you queue them.'
        : 'Bundled Loredecks are read-only. Duplicate as Custom before drafting repair proposals.';
    wrap.appendChild(help);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const draftButton = createButton('Draft Repairs', 'Ask the Lore Assistant to convert selected Deck Health issues into reviewable draft proposals.', async (btn) => {
        await handleLoredeckAssistantHealthRepairDraft(pack, health, btn);
    }, 'saga-primary-button');
    draftButton.disabled = !editable || !selectedCount;
    actions.appendChild(draftButton);
    actions.appendChild(createButton('Select All', 'Select every Deck Health issue in this validation report.', () => {
        setLoredeckHealthRepairSelectionBulk(pack, health, 'all');
    }));
    actions.appendChild(createButton('Clear Selection', 'Clear selected Deck Health issues.', () => {
        setLoredeckHealthRepairSelectionBulk(pack, health, 'none');
    }));
    wrap.appendChild(actions);

    const list = document.createElement('div');
    list.className = 'saga-loredeck-health-issue-list saga-loredeck-health-repair-list';
    for (const group of groups) {
        for (const issue of group.issues.slice(0, 8)) {
            list.appendChild(createLoredeckHealthRepairIssueRow(pack, issue, selectedIds.has(issue.issueId), editable));
        }
    }
    if (allIssues.length > 24) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing first 24 of ${allIssues.length} issues. Export Health JSON for the full report.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function createLoredeckHealthRepairIssueRow(pack, issue = {}, selected = false, editable = true) {
    const label = document.createElement('label');
    label.className = `saga-loredeck-health-issue saga-loredeck-health-issue-${issue.severity || 'suggestion'} saga-loredeck-health-repair-issue`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    checkbox.disabled = !editable;
    addTooltip(checkbox, selected ? 'Remove this Deck Health issue from the assistant repair plan.' : 'Include this Deck Health issue in the assistant repair plan.');
    checkbox.addEventListener('click', event => event.stopPropagation());
    checkbox.addEventListener('change', () => {
        setLoredeckHealthRepairSelection(pack.packId, issue.issueId, checkbox.checked);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    label.appendChild(checkbox);

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const code = document.createElement('div');
    code.className = 'saga-loredeck-health-issue-code';
    code.textContent = issue.code || issue.severity || 'issue';
    main.appendChild(code);
    const message = document.createElement('div');
    message.className = 'saga-loredeck-health-issue-message';
    message.textContent = issue.message || 'No message.';
    main.appendChild(message);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(issue.severity || 'suggestion', 'Deck Health issue severity.'));
    if (issue.entryIds?.length) meta.appendChild(createStatusPill(`${issue.entryIds.length} Lorecard${issue.entryIds.length === 1 ? '' : 's'}`, issue.entryIds.slice(0, 10).join(', ')));
    if (issue.tagIds?.length) meta.appendChild(createStatusPill(`${issue.tagIds.length} tag${issue.tagIds.length === 1 ? '' : 's'}`, issue.tagIds.slice(0, 10).join(', ')));
    if (issue.timelineIds?.length) meta.appendChild(createStatusPill(`${issue.timelineIds.length} timeline`, issue.timelineIds.slice(0, 10).join(', ')));
    if (issue.file) meta.appendChild(createStatusPill(issue.file, 'Affected file.'));
    main.appendChild(meta);
    label.appendChild(main);
    return label;
}

function createLoredeckEntryOverrideCard(pack) {
    const state = getLoredeckOverrideState(pack);
    const cached = loredeckEntryPreviewCache.get(pack.packId);
    const card = document.createElement('div');
    card.className = 'saga-loredeck-entry-overrides';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Lorecard Overrides';
    card.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${state.overrideCount} override${state.overrideCount === 1 ? '' : 's'}`, 'Saved edited or added Lorecards in this Custom Loredeck.'));
    summary.appendChild(createStatusPill(`${state.disabledEntryIds.length} disabled`, 'Source Lorecard IDs suppressed by this Custom Loredeck.'));
    summary.appendChild(createStatusPill(`${state.pendingCount} pending`, 'Loredeck edits queued for review before they affect runtime injection.'));
    if (cached?.entries?.length) summary.appendChild(createStatusPill(`${cached.entries.length} source Lorecards`, 'Source Lorecards loaded for browsing and editing.'));
    card.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Accepted overrides are stored in the Custom Loredeck library record. New edits are queued for review first and do not edit bundled files.';
    card.appendChild(help);

    const rows = getLoredeckEditableEntryRows(pack, cached?.entries || []);
    const filteredRows = filterLoredeckEditableEntryRows(rows, loredeckEntryOverrideQuery);
    const bulkRows = loredeckEntryOverrideQuery ? filteredRows : rows;

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const loadButton = createButton(cached?.entries?.length ? 'Reload Lorecards' : 'Load Lorecards', 'Fetch source Lorecard files for browsing and editing.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
    }, 'saga-primary-button');
    loadButton.disabled = !canValidateLoredeckInEditor(pack);
    actions.appendChild(loadButton);
    actions.appendChild(createButton('New Lorecard', 'Create a new custom Lorecard in this Loredeck.', () => {
        openLoredeckEntryOverrideDialog(pack, null);
    }));
    const bulkTagsButton = createButton('Bulk Tags', 'Add, remove, or rename tags for loaded Lorecards or the current search result.', () => {
        openLoredeckBulkTagsDialog(pack, bulkRows);
    });
    bulkTagsButton.disabled = !bulkRows.length;
    actions.appendChild(bulkTagsButton);
    const bulkButton = createButton('Bulk Context', 'Apply one Context and retrieval block to loaded Lorecards or the current search result.', () => {
        openLoredeckBulkContextDialog(pack, bulkRows);
    });
    bulkButton.disabled = !bulkRows.length;
    actions.appendChild(bulkButton);
    if (state.overrideCount) {
        actions.appendChild(createButton('Repair Overrides', 'Apply safe schema v3 repairs to saved override Lorecards.', async (btn) => {
            await repairLoredeckSafeHealthIssues(pack, btn);
        }));
    }
    card.appendChild(actions);

    if (cached?.error) {
        card.appendChild(createKeyValue('Load Error', cached.error, 'Last entry load error.'));
    }

    if (pack.type !== 'bundled' || state.pendingCount) {
        card.appendChild(createLoredeckPendingReviewCard(pack));
    }

    card.appendChild(createLoredeckAssistantCard(pack, rows, filteredRows));
    card.appendChild(createLoredeckTimelineRegistryCard(pack, rows));
    card.appendChild(createLoredeckTagManagerCard(pack, rows, filteredRows));

    if (rows.length) {
        const search = document.createElement('input');
        search.type = 'text';
        search.className = 'saga-loredeck-entry-search';
        search.placeholder = 'Search entries...';
        search.value = loredeckEntryOverrideQuery || '';
        addTooltip(search, 'Search loaded source entries, saved overrides, and disabled IDs. Press Enter or leave the field to refresh.');
        search.addEventListener('click', e => e.stopPropagation());
        search.addEventListener('mousedown', e => e.stopPropagation());
        search.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loredeckEntryOverrideQuery = search.value;
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            }
        });
        search.addEventListener('change', () => {
            loredeckEntryOverrideQuery = search.value;
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        });
        card.appendChild(search);

        const list = document.createElement('div');
        list.className = 'saga-loredeck-entry-list';
        const visible = filteredRows.slice(0, 30);
        for (const row of visible) {
            list.appendChild(createLoredeckEntryOverrideRow(pack, row));
        }
        if (visible.length < rows.length) {
            const more = document.createElement('div');
            more.className = 'saga-runtime-help';
            more.textContent = `Showing ${visible.length} of ${rows.length}. Narrow search to reduce the list.`;
            list.appendChild(more);
        }
        card.appendChild(list);
    } else {
        card.appendChild(createEmptyMessage('Load Lorecards or create a new Lorecard to begin editing this Custom Loredeck.'));
    }

    return card;
}

function createLoredeckPendingReviewCard(pack) {
    const pending = getLoredeckPendingChanges(pack);
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview saga-loredeck-pending-review';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Pending Review Queue';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${pending.length} pending`, 'Loredeck edit proposals waiting for acceptance.'));
    const affectedEntries = new Set(pending.flatMap(change => change.affectedEntryIds || []));
    const affectedTags = new Set(pending.flatMap(change => change.affectedTagIds || []));
    const affectedTimeline = new Set(pending.flatMap(change => change.affectedTimelineIds || []));
    const healthImpactCount = pending.filter(change => doesLoredeckPendingChangeAffectPackHealth(change)).length;
    if (affectedEntries.size) summary.appendChild(createStatusPill(`${affectedEntries.size} Lorecard${affectedEntries.size === 1 ? '' : 's'}`, 'Lorecards affected by pending proposals.'));
    if (affectedTags.size) summary.appendChild(createStatusPill(`${affectedTags.size} tag${affectedTags.size === 1 ? '' : 's'}`, 'Tags affected by pending proposals.'));
    if (affectedTimeline.size) summary.appendChild(createStatusPill(`${affectedTimeline.size} timeline`, 'Timeline anchors/windows affected by pending proposals.'));
    if (healthImpactCount) summary.appendChild(createStatusPill(`${healthImpactCount} health impact`, 'Pending proposals that will mark Deck Health stale when accepted because they change entries, tags, or timeline data.'));
    if (isLoredeckHealthStatusStale(pack)) summary.appendChild(createLoredeckPendingHealthStalePill());
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = isLoredeckHealthStatusStale(pack)
        ? 'Accepted changes have made the saved Deck Health status stale. Rerun validation before sharing or treating this Loredeck as clean.'
        : 'Pending changes do not affect runtime injection until accepted. This is the review path for manual edits, bulk edits, and Lore Assistant patches.';
    wrap.appendChild(help);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const acceptAll = createButton('Accept All', 'Apply every pending Loredeck change to this Custom Loredeck, then refresh Deck Health if accepted changes affect validation.', async (btn) => {
        await runBusyAction(btn, 'Accepting...', async () => {
            await acceptLoredeckPendingChanges(pack, pending.map(change => change.changeId));
        });
    }, 'saga-primary-button');
    acceptAll.disabled = !pending.length;
    actions.appendChild(acceptAll);
    const rejectAll = createButton('Reject All', 'Discard every pending Loredeck change without applying it.', () => {
        rejectLoredeckPendingChanges(pack);
    }, 'saga-danger-button');
    rejectAll.disabled = !pending.length;
    actions.appendChild(rejectAll);
    const validateButton = createButton('Validate Deck', 'Run Deck Health on the currently accepted Loredeck data. Pending proposals are not included until accepted.', async (btn) => {
        await validateLoredeckForEditor(pack, btn);
    });
    validateButton.disabled = !canValidateLoredeckInEditor(pack);
    actions.appendChild(validateButton);
    wrap.appendChild(actions);

    if (!pending.length) {
        wrap.appendChild(createEmptyMessage('No pending Loredeck edits.'));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const change of pending.slice(0, 20)) {
        list.appendChild(createLoredeckPendingChangeRow(pack, change));
    }
    if (pending.length > 20) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing 20 of ${pending.length} pending changes.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function createLoredeckPendingChangeRow(pack, change = {}) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-entry-row saga-loredeck-pending-row';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = change.title || change.changeId || 'Pending Loredeck Change';
    main.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    const preview = change.preview || {};
    desc.textContent = change.description || preview.after || preview.before || 'Pending record patch.';
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(`Action: ${formatLoredeckPendingActionLabel(change.action)}`, `Pending change action: ${change.action || 'record_patch'}.`));
    meta.appendChild(createStatusPill(`Target: ${formatLoredeckPendingTargetKindLabel(change.targetKind)}`, `Pending change target kind: ${change.targetKind || 'loredeck'}.`));
    if (change.source) meta.appendChild(createStatusPill(`Source: ${formatLoredeckPendingSourceLabel(change.source)}`, getLoredeckPendingSourceTooltip(change.source)));
    const confidence = getLoredeckPendingConfidence(change);
    if (confidence !== null) meta.appendChild(createStatusPill(`Confidence ${Math.round(confidence * 100)}%`, 'Model or tool confidence for this pending proposal. Review remains required before acceptance.'));
    const risk = getLoredeckPendingRisk(change);
    if (risk) meta.appendChild(createLoredeckPendingRiskPill(risk));
    appendLoredeckPendingQualityPills(meta, change);
    if (doesLoredeckPendingChangeAffectPackHealth(change)) meta.appendChild(createLoredeckPendingHealthImpactPill());
    if (change.affectedEntryIds?.length) meta.appendChild(createStatusPill(`${change.affectedEntryIds.length} entr${change.affectedEntryIds.length === 1 ? 'y' : 'ies'}`, change.affectedEntryIds.slice(0, 10).join(', ')));
    if (change.affectedTagIds?.length) meta.appendChild(createStatusPill(`${change.affectedTagIds.length} tag${change.affectedTagIds.length === 1 ? '' : 's'}`, change.affectedTagIds.slice(0, 10).join(', ')));
    if (change.affectedTimelineIds?.length) meta.appendChild(createStatusPill(`${change.affectedTimelineIds.length} timeline`, change.affectedTimelineIds.slice(0, 10).join(', ')));
    if (change.createdAt) meta.appendChild(createStatusPill(new Date(change.createdAt).toLocaleString(), 'Created at.'));
    main.appendChild(meta);
    const diffs = createLoredeckPendingDiffList(pack, change);
    if (diffs) main.appendChild(diffs);
    const quality = createLoredeckPendingQualityList(change);
    if (quality) main.appendChild(quality);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    actions.appendChild(createButton('Accept', 'Apply this pending Loredeck change, then refresh Deck Health if it affects validation.', async (btn) => {
        await runBusyAction(btn, 'Accepting...', async () => {
            await acceptLoredeckPendingChanges(pack, [change.changeId]);
        });
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reject', 'Discard this pending Loredeck change.', () => {
        rejectLoredeckPendingChanges(pack, [change.changeId]);
    }, 'saga-danger-button'));
    row.appendChild(actions);
    return row;
}

function formatLoredeckPendingActionLabel(action = '') {
    const key = String(action || 'record_patch').trim();
    const known = {
        record_patch: 'Record Patch',
        upsert_entry: 'Upsert Entry',
        assistant_upsert_entry: 'Assistant Upsert Entry',
        assistant_disable_entry: 'Assistant Disable Entry',
        assistant_restore_entry: 'Assistant Restore Entry',
        assistant_upsert_tag_definition: 'Assistant Upsert Tag',
        assistant_upsert_timeline_anchor: 'Assistant Upsert Anchor',
        assistant_upsert_timeline_window: 'Assistant Upsert Window',
        creator_upsert_entry: 'Creator Upsert Entry',
        creator_upsert_tag_definition: 'Creator Upsert Tag',
        creator_upsert_timeline_anchor: 'Creator Upsert Anchor',
        creator_upsert_timeline_window: 'Creator Upsert Window',
        remove_entry_override: 'Remove Override',
        disable_entry: 'Disable Entry',
        restore_entry: 'Restore Entry',
        bulk_context_update: 'Bulk Context Update',
        normalize_malformed_tag_ids: 'Normalize Tag IDs',
        upsert_tag_definition: 'Upsert Tag',
        rename_tag: 'Rename Tag',
        merge_tag: 'Merge Tag',
        remove_tag_definition: 'Remove Tag',
        upsert_timeline_anchor: 'Upsert Anchor',
        upsert_timeline_window: 'Upsert Window',
        disable_timeline_anchor: 'Disable Anchor',
        disable_timeline_window: 'Disable Window',
        restore_timeline_anchor: 'Restore Anchor',
        restore_timeline_window: 'Restore Window',
    };
    return known[key] || humanizeScopeKey(key);
}

function formatLoredeckPendingTargetKindLabel(targetKind = '') {
    const key = String(targetKind || 'loredeck').trim();
    const known = {
        loredeck: 'Loredeck',
        entry: 'Entry',
        entries: 'Entries',
        tag: 'Tag',
        tags: 'Tags',
        timeline_anchor: 'Timeline Anchor',
        timeline_window: 'Timeline Window',
        timeline: 'Timeline',
    };
    return known[key] || humanizeScopeKey(key);
}

function formatLoredeckPendingSourceLabel(source = '') {
    const key = String(source || 'manual').trim();
    const known = {
        manual: 'Manual',
        bulk_edit: 'Bulk Edit',
        lore_assistant: 'Lore Assistant',
        loredeck_creator: 'Loredeck Creator',
        safe_repair: 'Safe Repair',
        import: 'Import',
    };
    return known[key] || humanizeScopeKey(key);
}

function getLoredeckPendingSourceTooltip(source = '') {
    const key = String(source || 'manual').trim();
    if (key === 'lore_assistant') return 'Created by Saga Lore Assistant. Treat as a proposal until reviewed and accepted.';
    if (key === 'loredeck_creator') return 'Created by Saga Loredeck Creator. Treat as a generated planning proposal until reviewed and accepted.';
    if (key === 'bulk_edit') return 'Created by a bulk-edit tool. Review the field diffs before acceptance.';
    if (key === 'safe_repair') return 'Created by an automated Deck Health repair path.';
    return 'Proposal source.';
}

function getLoredeckPendingPreviewMetadata(change = {}) {
    return change?.preview && typeof change.preview === 'object' && !Array.isArray(change.preview) ? change.preview : {};
}

function getLoredeckPendingConfidence(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const raw = preview.confidence ?? change.confidence;
    if (raw === undefined || raw === null || raw === '') return null;
    let confidence = Number(raw);
    if (!Number.isFinite(confidence)) return null;
    if (confidence > 1 && confidence <= 100) confidence /= 100;
    return Math.max(0, Math.min(1, confidence));
}

function getLoredeckPendingRisk(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const raw = String(preview.risk || change.risk || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    if (/critical|severe|high/.test(lower)) return 'high';
    if (/medium|moderate|med/.test(lower)) return 'medium';
    if (/low|minor|minimal/.test(lower)) return 'low';
    return raw.slice(0, 60);
}

function createLoredeckPendingRiskPill(risk = '') {
    const normalized = String(risk || '').trim();
    const pill = createStatusPill(`Risk: ${humanizeScopeKey(normalized)}`, 'Estimated proposal risk. Higher-risk proposals need closer manual review before acceptance.');
    const classKey = /high/i.test(normalized)
        ? 'high'
        : (/medium|moderate|med/i.test(normalized) ? 'medium' : (/low|minor|minimal/i.test(normalized) ? 'low' : 'unknown'));
    pill.classList.add(`saga-status-pill-risk-${classKey}`);
    return pill;
}

function normalizeLoredeckPendingRubricLevel(value = '') {
    const raw = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (!raw) return '';
    if (raw === 'n_a' || raw === 'na' || raw === 'none') return 'not_applicable';
    if (raw === 'med' || raw === 'moderate') return 'medium';
    if (raw === 'minor' || raw === 'minimal') return 'low';
    if (raw === 'strong') return 'high';
    return ['high', 'medium', 'low', 'not_applicable'].includes(raw) ? raw : '';
}

function getLoredeckPendingRubric(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const rubric = preview.rubric || preview.qualityRubric || preview.quality;
    return rubric && typeof rubric === 'object' && !Array.isArray(rubric) ? rubric : {};
}

function getLoredeckPendingQualityWarnings(change = {}) {
    const preview = getLoredeckPendingPreviewMetadata(change);
    const warnings = Array.isArray(preview.qualityWarnings)
        ? preview.qualityWarnings
        : (Array.isArray(preview.rubric?.warnings) ? preview.rubric.warnings : []);
    return warnings.map(item => String(item || '').trim()).filter(Boolean).slice(0, 8);
}

function getLoredeckPendingRubricNotes(change = {}) {
    const rubric = getLoredeckPendingRubric(change);
    return Array.isArray(rubric.notes)
        ? rubric.notes.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6)
        : [];
}

function createLoredeckPendingQualityPill(label, level, tooltip) {
    const normalized = normalizeLoredeckPendingRubricLevel(level);
    if (!normalized) return null;
    const pill = createStatusPill(`${label}: ${humanizeScopeKey(normalized)}`, tooltip);
    pill.classList.add(`saga-status-pill-quality-${normalized}`);
    return pill;
}

function appendLoredeckPendingQualityPills(meta, change = {}) {
    const rubric = getLoredeckPendingRubric(change);
    const sceneUtility = createLoredeckPendingQualityPill('Utility', rubric.sceneUtility, 'Lore Value Rubric: whether this proposal improves scene behavior, tension, characterization, or setting response.');
    if (sceneUtility) meta.appendChild(sceneUtility);
    const behavioralImpact = createLoredeckPendingQualityPill('Behavior', rubric.behavioralImpact, 'Lore Value Rubric: whether this proposal changes what characters do, say, know, hide, avoid, or expect.');
    if (behavioralImpact) meta.appendChild(behavioralImpact);
    const contextFit = createLoredeckPendingQualityPill('Context Fit', rubric.contextFit, 'Lore Value Rubric: whether this proposal fits the intended Context without future leakage.');
    if (contextFit) meta.appendChild(contextFit);
    const wikiRisk = createLoredeckPendingQualityPill('Wiki Risk', rubric.wikiSummaryRisk || rubric.wikiRisk, 'Risk that this proposal reads like generic wiki summary instead of playable Saga lore.');
    if (wikiRisk) meta.appendChild(wikiRisk);
    const warnings = getLoredeckPendingQualityWarnings(change);
    if (warnings.length) {
        const pill = createStatusPill(`${warnings.length} quality flag${warnings.length === 1 ? '' : 's'}`, warnings.join(' | '));
        pill.classList.add('saga-status-pill-quality-flag');
        meta.appendChild(pill);
    }
}

function createLoredeckPendingQualityList(change = {}) {
    const warnings = getLoredeckPendingQualityWarnings(change);
    const notes = getLoredeckPendingRubricNotes(change);
    if (!warnings.length && !notes.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-pending-quality-list';
    for (const warning of warnings) {
        const item = document.createElement('div');
        item.className = 'saga-runtime-help saga-warning-text';
        item.textContent = `Quality flag: ${warning}`;
        wrap.appendChild(item);
    }
    for (const note of notes) {
        const item = document.createElement('div');
        item.className = 'saga-runtime-help';
        item.textContent = `Rubric note: ${note}`;
        wrap.appendChild(item);
    }
    return wrap;
}

function createLoredeckPendingHealthImpactPill() {
    const pill = createStatusPill('Health impact', 'Accepting this proposal changes entries, tags, or timeline data and will mark Deck Health stale until validation reruns.');
    pill.classList.add('saga-status-pill-health-impact');
    return pill;
}

function createLoredeckPendingHealthStalePill() {
    const pill = createStatusPill('Health stale', 'Deck Health was computed before the latest accepted Loredeck edits. Rerun validation.');
    pill.classList.add('saga-status-pill-health-stale');
    return pill;
}

function isLoredeckHealthStatusStale(pack = {}) {
    return String(pack?.healthStatus || '').trim().toLowerCase() === 'stale';
}

function doesLoredeckPendingChangeAffectPackHealth(change = {}) {
    const payload = change?.payload && typeof change.payload === 'object' && !Array.isArray(change.payload) ? change.payload : {};
    const hasObjectEntries = value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    const hasArrayItems = value => Array.isArray(value) && value.length > 0;
    return hasObjectEntries(payload.entryOverrides)
        || hasArrayItems(payload.disabledEntryIdsAdd)
        || hasArrayItems(payload.disabledEntryIdsRemove)
        || hasObjectEntries(payload.tagDefinitions)
        || hasObjectEntries(payload.timelineAnchors)
        || hasObjectEntries(payload.timelineWindows)
        || hasArrayItems(payload.timelineAnchorIdsDisable)
        || hasArrayItems(payload.timelineAnchorIdsEnable)
        || hasArrayItems(payload.timelineWindowIdsDisable)
        || hasArrayItems(payload.timelineWindowIdsEnable);
}

function createLoredeckPendingDiffList(pack, change = {}) {
    const diffs = buildLoredeckPendingDiffs(pack, change);
    if (!diffs.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-pending-diff-list';
    for (const diff of diffs.slice(0, 10)) {
        const item = document.createElement('div');
        item.className = 'saga-runtime-help';
        const before = formatLoredeckPendingDiffValue(diff.before);
        const after = formatLoredeckPendingDiffValue(diff.after);
        item.textContent = `${diff.scope ? `${diff.scope} | ` : ''}${diff.field}: ${before} => ${after}`;
        wrap.appendChild(item);
    }
    if (diffs.length > 10) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `+${diffs.length - 10} more field change${diffs.length - 10 === 1 ? '' : 's'}.`;
        wrap.appendChild(more);
    }
    return wrap;
}

function formatLoredeckPendingDiffValue(value) {
    if (value === null || value === undefined || value === '') return '(empty)';
    if (Array.isArray(value)) return truncateText(value.join(', ') || '(empty)', 180);
    if (typeof value === 'object') {
        try {
            return truncateText(JSON.stringify(value), 180);
        } catch (_) {
            return '[object]';
        }
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return truncateText(String(value), 180);
}

function buildLoredeckPendingDiffs(pack, change = {}) {
    const patch = change.payload && typeof change.payload === 'object' && !Array.isArray(change.payload) ? change.payload : {};
    const diffs = [];
    collectLoredeckPendingEntryDiffs(diffs, pack, patch);
    collectLoredeckPendingEntryDisableDiffs(diffs, pack, patch);
    collectLoredeckPendingTagDiffs(diffs, pack, patch);
    collectLoredeckPendingTimelineDiffs(diffs, pack, patch);
    if (!diffs.length && (change.preview?.before || change.preview?.after)) {
        addLoredeckPendingDiff(diffs, 'Preview', 'summary', change.preview?.before || '', change.preview?.after || '');
    }
    return diffs;
}

function addLoredeckPendingDiff(diffs, scope, field, before, after) {
    if (isLoredeckPendingDiffEqual(before, after)) return;
    diffs.push({ scope, field, before, after });
}

function isLoredeckPendingDiffEqual(before, after) {
    return JSON.stringify(normalizeLoredeckPendingDiffComparable(before)) === JSON.stringify(normalizeLoredeckPendingDiffComparable(after));
}

function normalizeLoredeckPendingDiffComparable(value) {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.map(item => normalizeLoredeckPendingDiffComparable(item));
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([, nested]) => nested !== undefined && nested !== null && nested !== '')
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, nested]) => [key, normalizeLoredeckPendingDiffComparable(nested)]));
    }
    return value;
}

function getLoredeckPendingCachedSourceEntry(pack, entryId = '') {
    const id = String(entryId || '').trim();
    if (!id) return null;
    const cached = loredeckEntryPreviewCache.get(String(pack?.packId || '').trim());
    return (cached?.entries || []).find(entry => String(entry?.id || '').trim() === id) || null;
}

function getLoredeckPendingCurrentEntry(pack, entryId = '') {
    const id = String(entryId || '').trim();
    if (!id) return null;
    const overrides = pack?.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? pack.entryOverrides
        : {};
    return overrides[id] || getLoredeckPendingCachedSourceEntry(pack, id) || null;
}

function getLoredeckPendingEntryField(entry = {}, field = '') {
    if (!entry || typeof entry !== 'object') return '';
    const content = entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content) ? entry.content : {};
    const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    const retrieval = entry.retrieval && typeof entry.retrieval === 'object' && !Array.isArray(entry.retrieval) ? entry.retrieval : {};
    if (field === 'fact') return content.fact || entry.fact || '';
    if (field === 'injection') return content.injection || entry.injection || '';
    if (field === 'notes') return content.notes || entry.notes || '';
    if (field === 'canon') return entry.canon || entry.canonStatus || '';
    if (field === 'tags') return parseLoredeckEntryTags(entry.tags || []);
    if (field === 'context.validFromAnchor') return contextGate.validFromAnchor || contextGate.anchorFrom || '';
    if (field === 'context.validToAnchor') return contextGate.validToAnchor || contextGate.anchorTo || '';
    if (field.startsWith('context.')) return contextGate[field.slice('context.'.length)] ?? '';
    if (field.startsWith('retrieval.')) return retrieval[field.slice('retrieval.'.length)] ?? '';
    return entry[field] ?? '';
}

function collectLoredeckPendingEntryDiffs(diffs, pack, patch = {}) {
    const entryOverrides = patch.entryOverrides && typeof patch.entryOverrides === 'object' && !Array.isArray(patch.entryOverrides)
        ? patch.entryOverrides
        : {};
    const fields = [
        ['title', 'title'],
        ['category', 'category'],
        ['canon', 'canon'],
        ['relevance', 'relevance'],
        ['priority', 'priority'],
        ['tags', 'tags'],
        ['context.scope', 'context scope'],
        ['context.anchorId', 'context anchor'],
        ['context.validFromAnchor', 'context from'],
        ['context.validToAnchor', 'context to'],
        ['context.sortKeyFrom', 'sort from'],
        ['context.sortKeyTo', 'sort to'],
        ['context.precision', 'context precision'],
        ['context.windowKind', 'window kind'],
        ['context.label', 'context label'],
        ['retrieval.activation', 'retrieval activation'],
        ['retrieval.frequency', 'retrieval frequency'],
        ['retrieval.contextBoost', 'context boost'],
        ['fact', 'lore text'],
        ['injection', 'injection'],
        ['notes', 'notes'],
    ];
    for (const [rawId, rawEntry] of Object.entries(entryOverrides)) {
        const id = String(rawEntry?.id || rawId || '').trim();
        if (!id) continue;
        const scope = `Entry ${id}`;
        const beforeEntry = getLoredeckPendingCurrentEntry(pack, id);
        if (rawEntry === null) {
            addLoredeckPendingDiff(diffs, scope, 'override', beforeEntry ? 'present' : '(none)', 'removed');
            continue;
        }
        if (!beforeEntry) {
            addLoredeckPendingDiff(diffs, scope, 'entry', '(new)', rawEntry.title || id);
        }
        for (const [field, label] of fields) {
            addLoredeckPendingDiff(
                diffs,
                scope,
                label,
                getLoredeckPendingEntryField(beforeEntry || {}, field),
                getLoredeckPendingEntryField(rawEntry || {}, field)
            );
        }
    }
}

function collectLoredeckPendingEntryDisableDiffs(diffs, pack, patch = {}) {
    const disabled = new Set(Array.isArray(pack?.disabledEntryIds) ? pack.disabledEntryIds : []);
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsAdd || [])) {
        addLoredeckPendingDiff(diffs, `Entry ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'disabled');
    }
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsRemove || [])) {
        addLoredeckPendingDiff(diffs, `Entry ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'active');
    }
}

function getLoredeckPendingCurrentTagDefinition(pack, tagId = '') {
    const id = normalizeLoredeckTagId(tagId);
    if (!id) return null;
    const custom = getLoredeckEmbeddedTagRegistry(pack);
    const source = getLoredeckCachedSourceTagRegistry(pack?.packId);
    return custom.tags?.[id] || source.tags?.[id] || null;
}

function collectLoredeckPendingTagDiffs(diffs, pack, patch = {}) {
    const tagDefinitions = patch.tagDefinitions && typeof patch.tagDefinitions === 'object' && !Array.isArray(patch.tagDefinitions)
        ? patch.tagDefinitions
        : {};
    const fields = ['label', 'description', 'color', 'textColor', 'aliases', 'parents', 'sensitive', 'deprecated', 'replacement'];
    for (const [rawId, rawDef] of Object.entries(tagDefinitions)) {
        const id = normalizeLoredeckTagId(rawDef?.id || rawId);
        if (!id) continue;
        const scope = `Tag ${id}`;
        const beforeDef = getLoredeckPendingCurrentTagDefinition(pack, id);
        const before = beforeDef || {};
        if (rawDef === null) {
            addLoredeckPendingDiff(diffs, scope, 'definition', beforeDef ? 'present' : '(none)', 'removed');
            continue;
        }
        const after = normalizeLoredeckTagDefinition(rawDef, id);
        for (const field of fields) addLoredeckPendingDiff(diffs, scope, field, before[field] ?? '', after[field] ?? '');
    }
}

function getLoredeckPendingCurrentTimelineItem(pack, kind = 'anchor', itemId = '') {
    const id = normalizeLoredeckTimelineId(itemId);
    if (!id) return null;
    const custom = getLoredeckEmbeddedTimelineRegistry(pack);
    const source = getLoredeckCachedSourceTimelineRegistry(pack?.packId);
    const customList = kind === 'window' ? custom.windows : custom.anchors;
    const sourceList = kind === 'window' ? source.windows : source.anchors;
    return (customList || []).find(item => item.id === id) || (sourceList || []).find(item => item.id === id) || null;
}

function collectLoredeckPendingTimelineDiffs(diffs, pack, patch = {}) {
    collectLoredeckPendingTimelineDefinitionDiffs(diffs, pack, patch.timelineAnchors, 'anchor');
    collectLoredeckPendingTimelineDefinitionDiffs(diffs, pack, patch.timelineWindows, 'window');
    collectLoredeckPendingTimelineDisabledDiffs(diffs, pack, patch.timelineAnchorIdsDisable, patch.timelineAnchorIdsEnable, 'anchor');
    collectLoredeckPendingTimelineDisabledDiffs(diffs, pack, patch.timelineWindowIdsDisable, patch.timelineWindowIdsEnable, 'window');
}

function collectLoredeckPendingTimelineDefinitionDiffs(diffs, pack, definitions, kind = 'anchor') {
    if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) return;
    const fields = kind === 'window'
        ? ['label', 'anchorFrom', 'anchorTo', 'sortKeyFrom', 'sortKeyTo', 'dateRange', 'aliases', 'tags', 'notes']
        : ['label', 'sortKey', 'dateRange', 'arc', 'phase', 'season', 'episode', 'chapter', 'aliases', 'tags', 'notes'];
    for (const [rawId, rawDef] of Object.entries(definitions)) {
        const id = normalizeLoredeckTimelineId(rawDef?.id || rawId);
        if (!id) continue;
        const scope = `${kind === 'window' ? 'Timeline window' : 'Timeline anchor'} ${id}`;
        const beforeDef = getLoredeckPendingCurrentTimelineItem(pack, kind, id);
        const before = beforeDef || {};
        if (rawDef === null) {
            addLoredeckPendingDiff(diffs, scope, 'definition', beforeDef ? 'present' : '(none)', 'removed');
            continue;
        }
        const after = kind === 'window'
            ? normalizeLoredeckTimelineWindow(rawDef, id)
            : normalizeLoredeckTimelineAnchor(rawDef, id);
        for (const field of fields) addLoredeckPendingDiff(diffs, scope, field, before[field] ?? '', after?.[field] ?? '');
    }
}

function collectLoredeckPendingTimelineDisabledDiffs(diffs, pack, disableIds = [], enableIds = [], kind = 'anchor') {
    const custom = getLoredeckEmbeddedTimelineRegistry(pack);
    const disabled = new Set(kind === 'window' ? custom.disabledWindowIds : custom.disabledAnchorIds);
    const scopeType = kind === 'window' ? 'Timeline window' : 'Timeline anchor';
    for (const id of normalizeLoredeckTimelineDisabledIds(disableIds || [])) {
        addLoredeckPendingDiff(diffs, `${scopeType} ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'disabled');
    }
    for (const id of normalizeLoredeckTimelineDisabledIds(enableIds || [])) {
        addLoredeckPendingDiff(diffs, `${scopeType} ${id}`, 'enabled state', disabled.has(id) ? 'disabled' : 'active', 'active');
    }
}

function getLoredeckOverrideState(pack = {}) {
    const overrides = {};
    const rawOverrides = pack.entryOverrides && typeof pack.entryOverrides === 'object' && !Array.isArray(pack.entryOverrides)
        ? pack.entryOverrides
        : {};
    for (const [key, raw] of Object.entries(rawOverrides)) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = String(raw.id || key || '').trim();
        if (!id) continue;
        overrides[id] = {
            ...raw,
            id,
        };
    }
    const disabledEntryIds = [];
    const seen = new Set();
    for (const raw of Array.isArray(pack.disabledEntryIds) ? pack.disabledEntryIds : []) {
        const id = String(raw || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        disabledEntryIds.push(id);
    }
    const pendingChanges = getLoredeckPendingChanges(pack);
    return {
        overrides,
        disabledEntryIds,
        disabledSet: new Set(disabledEntryIds),
        overrideCount: Object.keys(overrides).length,
        pendingChanges,
        pendingCount: pendingChanges.length,
    };
}

function normalizeLoredeckTagId(value) {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/:+/g, ':')
        .replace(/^[\s:._/-]+|[\s:._/-]+$/g, '')
        .toLowerCase()
        .slice(0, 96)
        .trim();
}

function normalizeLoredeckTagColor(value) {
    const text = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(text)) {
        return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
    }
    return '';
}

function humanizeLoredeckTagId(tagId) {
    const text = String(tagId || '').trim();
    const value = text.includes(':') ? text.split(':').slice(1).join(':') : text;
    return value
        .replace(/[._/-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, char => char.toUpperCase()) || text;
}

function normalizeLoredeckTagTextList(value, limit = 64, normalizeIds = false) {
    const rawItems = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const output = [];
    const seen = new Set();
    for (const raw of rawItems) {
        const text = normalizeIds
            ? normalizeLoredeckTagId(raw)
            : String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 120).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(text);
        if (output.length >= limit) break;
    }
    return output;
}

function normalizeLoredeckTagDefinition(raw = {}, tagId = '') {
    const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const id = normalizeLoredeckTagId(input.id || tagId);
    return {
        label: String(input.label || '').trim().slice(0, 160),
        color: normalizeLoredeckTagColor(input.color),
        textColor: normalizeLoredeckTagColor(input.textColor),
        description: String(input.description || '').trim().slice(0, 1000),
        aliases: normalizeLoredeckTagTextList(input.aliases, 64, false),
        parents: normalizeLoredeckTagTextList(input.parents, 64, true),
        sensitive: input.sensitive === true,
        deprecated: input.deprecated === true,
        replacement: normalizeLoredeckTagId(input.replacement || ''),
        ...(id ? { id } : {}),
    };
}

function normalizeLoredeckTagRegistry(value = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { schemaVersion: 1, tags: {} };
    }
    const source = value.tags && typeof value.tags === 'object' && !Array.isArray(value.tags)
        ? value.tags
        : value;
    const tags = {};
    let count = 0;
    for (const [rawId, rawDef] of Object.entries(source || {})) {
        if (!rawDef || typeof rawDef !== 'object' || Array.isArray(rawDef)) continue;
        const id = normalizeLoredeckTagId(rawDef.id || rawId);
        if (!id) continue;
        const def = normalizeLoredeckTagDefinition(rawDef, id);
        delete def.id;
        tags[id] = def;
        count += 1;
        if (count >= 2000) break;
    }
    return {
        schemaVersion: 1,
        tags,
    };
}

function getLoredeckTagRegistryCount(registry = {}) {
    return Object.keys(normalizeLoredeckTagRegistry(registry).tags || {}).length;
}

function normalizeLoredeckTimelineId(value) {
    return String(value || '')
        .trim()
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
        .replace(/\s+/g, '_')
        .slice(0, 180)
        .trim();
}

function normalizeLoredeckTimelineTextList(value, limit = 64) {
    const rawItems = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const output = [];
    const seen = new Set();
    for (const raw of rawItems) {
        const text = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 160).trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        output.push(text);
        if (output.length >= limit) break;
    }
    return output;
}

function normalizeLoredeckTimelineDateRange(value = {}) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        from: String(input.from || input.start || input.validFrom || '').trim().slice(0, 80),
        to: String(input.to || input.end || input.validTo || '').trim().slice(0, 80),
        precision: String(input.precision || '').trim().slice(0, 40),
    };
}

function normalizeLoredeckTimelineNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

function normalizeLoredeckTimelineAnchor(raw = {}, fallbackId = '', index = 0) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = normalizeLoredeckTimelineId(raw.id || fallbackId);
    if (!id) return null;
    return {
        id,
        label: String(raw.label || raw.title || id).trim().slice(0, 240),
        contextType: String(raw.contextType || raw.type || 'anchor').trim().slice(0, 80),
        sortKey: normalizeLoredeckTimelineNumber(raw.sortKey) ?? index + 1,
        dateRange: normalizeLoredeckTimelineDateRange(raw.dateRange || raw.date || raw.canonTiming),
        book: String(raw.book || raw.sourceInfo?.title || raw.source?.book || '').trim().slice(0, 160),
        work: String(raw.work || raw.sourceInfo?.work || raw.source?.work || '').trim().slice(0, 160),
        schoolYear: String(raw.schoolYear || raw.date?.schoolYear || raw.canonTiming?.schoolYear || '').trim().slice(0, 80),
        arc: String(raw.arc || '').trim().slice(0, 180),
        phase: String(raw.phase || '').trim().slice(0, 180),
        season: String(raw.season || '').trim().slice(0, 80),
        episode: String(raw.episode || '').trim().slice(0, 80),
        chapter: String(raw.chapter || '').trim().slice(0, 80),
        issue: String(raw.issue || '').trim().slice(0, 80),
        quest: String(raw.quest || '').trim().slice(0, 180),
        gameStage: String(raw.gameStage || '').trim().slice(0, 180),
        aliases: normalizeLoredeckTimelineTextList(raw.aliases || raw.triggers, 64),
        tags: normalizeLoredeckTimelineTextList(raw.tags, 64),
        notes: String(raw.notes || raw.description || '').trim().slice(0, 1000),
    };
}

function normalizeLoredeckTimelineWindow(raw = {}, fallbackId = '', index = 0) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const id = normalizeLoredeckTimelineId(raw.id || fallbackId);
    if (!id) return null;
    return {
        id,
        label: String(raw.label || raw.title || id).trim().slice(0, 240),
        contextType: String(raw.contextType || raw.type || 'anchor_window').trim().slice(0, 80),
        anchorFrom: normalizeLoredeckTimelineId(raw.anchorFrom || raw.from || raw.validFromAnchor),
        anchorTo: normalizeLoredeckTimelineId(raw.anchorTo || raw.to || raw.validToAnchor),
        sortKeyFrom: normalizeLoredeckTimelineNumber(raw.sortKeyFrom),
        sortKeyTo: normalizeLoredeckTimelineNumber(raw.sortKeyTo),
        dateRange: normalizeLoredeckTimelineDateRange(raw.dateRange || raw.date),
        aliases: normalizeLoredeckTimelineTextList(raw.aliases || raw.triggers, 64),
        tags: normalizeLoredeckTimelineTextList(raw.tags, 64),
        notes: String(raw.notes || raw.description || '').trim().slice(0, 1000),
    };
}

function normalizeLoredeckTimelineDisabledIds(value = []) {
    if (!Array.isArray(value)) return [];
    const output = [];
    const seen = new Set();
    for (const raw of value) {
        const id = normalizeLoredeckTimelineId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        output.push(id);
        if (output.length >= 2000) break;
    }
    return output;
}

function normalizeLoredeckTimelineRegistry(value = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { schemaVersion: 1, timelineMode: 'hybrid', sortKeyScale: 'pack_local', anchors: [], windows: [] };
    }
    const input = value;
    const anchors = [];
    for (const [index, raw] of (Array.isArray(input.anchors) ? input.anchors : []).entries()) {
        const anchor = normalizeLoredeckTimelineAnchor(raw, '', index);
        if (anchor) anchors.push(anchor);
        if (anchors.length >= 5000) break;
    }
    const rawWindows = [
        ...(Array.isArray(input.windows) ? input.windows : []),
        ...(Array.isArray(input.arcs) ? input.arcs : []),
        ...(Array.isArray(input.phases) ? input.phases : []),
    ];
    const windows = [];
    for (const [index, raw] of rawWindows.entries()) {
        const window = normalizeLoredeckTimelineWindow(raw, '', index);
        if (window) windows.push(window);
        if (windows.length >= 5000) break;
    }
    return {
        schemaVersion: Number.isFinite(Number(input.schemaVersion)) ? Number(input.schemaVersion) : 1,
        timelineMode: String(input.timelineMode || 'hybrid').trim().slice(0, 80),
        defaultContextType: String(input.defaultContextType || '').trim().slice(0, 80),
        sortKeyScale: String(input.sortKeyScale || 'pack_local').trim().slice(0, 160),
        summary: String(input.summary || input.description || '').trim().slice(0, 1000),
        anchors,
        windows,
        disabledAnchorIds: normalizeLoredeckTimelineDisabledIds(input.disabledAnchorIds || input.disabledAnchors || []),
        disabledWindowIds: normalizeLoredeckTimelineDisabledIds(input.disabledWindowIds || input.disabledWindows || []),
    };
}

function getLoredeckTimelineRegistryCount(registry = {}) {
    const normalized = normalizeLoredeckTimelineRegistry(registry);
    return (normalized.anchors?.length || 0) + (normalized.windows?.length || 0) + (normalized.disabledAnchorIds?.length || 0) + (normalized.disabledWindowIds?.length || 0);
}

function getLoredeckEmbeddedTimelineRegistry(pack = {}) {
    return normalizeLoredeckTimelineRegistry(pack?.timelineRegistry);
}

function getLoredeckCachedSourceTimelineRegistry(packId) {
    const cached = loredeckTimelineRegistryCache.get(String(packId || '').trim());
    return normalizeLoredeckTimelineRegistry(cached?.sourceRegistry);
}

function getLoredeckEmbeddedTagRegistry(pack = {}) {
    return normalizeLoredeckTagRegistry(pack?.tagRegistry);
}

function getLoredeckCachedSourceTagRegistry(packId) {
    const cached = loredeckTagRegistryCache.get(String(packId || '').trim());
    return normalizeLoredeckTagRegistry(cached?.sourceRegistry);
}

function mergeLoredeckTagDefinition(sourceDef = {}, customDef = {}) {
    return normalizeLoredeckTagDefinition({
        ...(sourceDef || {}),
        ...(customDef || {}),
    });
}

function normalizeLoredeckPendingIdList(value = [], limit = 500) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const id = String(raw || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

function normalizeLoredeckPendingTagIdList(value = [], limit = 500) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const id = normalizeLoredeckTagId(raw);
        if (!id || seen.has(id.toLowerCase())) continue;
        seen.add(id.toLowerCase());
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

function normalizeLoredeckHealthIssueStates(value = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const output = {};
    let count = 0;
    for (const [rawKey, rawState] of Object.entries(value)) {
        if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) continue;
        const issueKey = String(rawKey || rawState.issueKey || '').trim().replace(/[^a-z0-9_.:-]+/gi, '_').slice(0, 160);
        const status = String(rawState.status || '').trim().toLowerCase();
        if (!issueKey || !['ignored', 'resolved'].includes(status)) continue;
        output[issueKey] = {
            status,
            issueKey,
            code: String(rawState.code || '').trim().slice(0, 120),
            severity: normalizeLoredeckHealthSeverity(rawState.severity || ''),
            title: String(rawState.title || '').trim().slice(0, 240),
            note: String(rawState.note || '').trim().slice(0, 500),
            updatedAt: Number.isFinite(Number(rawState.updatedAt)) ? Number(rawState.updatedAt) : Date.now(),
        };
        count += 1;
        if (count >= 500) break;
    }
    return output;
}

function normalizeLoredeckPendingTimelineIdList(value = [], limit = 500) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const id = normalizeLoredeckTimelineId(raw);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

function normalizeLoredeckPendingChanges(value = []) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const changeId = String(raw.changeId || raw.id || '').trim();
        if (!changeId || seen.has(changeId)) continue;
        seen.add(changeId);
        out.push({
            schemaVersion: Number.isFinite(Number(raw.schemaVersion)) ? Number(raw.schemaVersion) : 1,
            changeId,
            status: 'pending',
            source: String(raw.source || 'manual').trim().slice(0, 80),
            action: String(raw.action || 'record_patch').trim().slice(0, 80),
            targetKind: String(raw.targetKind || 'loredeck').trim().slice(0, 80),
            title: String(raw.title || changeId).trim().slice(0, 240),
            description: String(raw.description || '').trim().slice(0, 1000),
            affectedEntryIds: normalizeLoredeckPendingIdList(raw.affectedEntryIds),
            affectedTagIds: normalizeLoredeckPendingTagIdList(raw.affectedTagIds),
            affectedTimelineIds: normalizeLoredeckPendingTimelineIdList(raw.affectedTimelineIds),
            payload: cloneLoredeckJson(raw.payload) || {},
            preview: cloneLoredeckJson(raw.preview) || {},
            createdAt: Number.isFinite(Number(raw.createdAt)) ? Number(raw.createdAt) : Date.now(),
            updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : Date.now(),
        });
        if (out.length >= 500) break;
    }
    return out;
}

function getLoredeckPendingChanges(pack = {}) {
    return normalizeLoredeckPendingChanges(pack?.pendingChanges);
}

function createLoredeckPendingChangeId(action = 'change') {
    return `lpchg_${String(action || 'change').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createLoredeckRecordPatchChange(fields = {}) {
    const now = Date.now();
    return {
        schemaVersion: 1,
        changeId: fields.changeId || createLoredeckPendingChangeId(fields.action || 'record_patch'),
        status: 'pending',
        source: fields.source || 'manual',
        action: fields.action || 'record_patch',
        targetKind: fields.targetKind || 'loredeck',
        title: String(fields.title || 'Pending Loredeck Change').trim(),
        description: String(fields.description || '').trim(),
        affectedEntryIds: normalizeLoredeckPendingIdList(fields.affectedEntryIds),
        affectedTagIds: normalizeLoredeckPendingTagIdList(fields.affectedTagIds),
        affectedTimelineIds: normalizeLoredeckPendingTimelineIdList(fields.affectedTimelineIds),
        payload: cloneLoredeckJson(fields.payload) || {},
        preview: cloneLoredeckJson(fields.preview) || {},
        createdAt: now,
        updatedAt: now,
    };
}

function ensureLoredeckPatchTagRegistry(record) {
    if (!record.tagRegistry || typeof record.tagRegistry !== 'object' || Array.isArray(record.tagRegistry)) {
        record.tagRegistry = { schemaVersion: 1, tags: {} };
    }
    if (!record.tagRegistry.tags || typeof record.tagRegistry.tags !== 'object' || Array.isArray(record.tagRegistry.tags)) {
        record.tagRegistry.tags = {};
    }
}

function ensureLoredeckPatchTimelineRegistry(record) {
    if (!record.timelineRegistry || typeof record.timelineRegistry !== 'object' || Array.isArray(record.timelineRegistry)) {
        record.timelineRegistry = { schemaVersion: 1, timelineMode: 'hybrid', sortKeyScale: 'pack_local', anchors: [], windows: [] };
    }
    if (!Array.isArray(record.timelineRegistry.anchors)) record.timelineRegistry.anchors = [];
    if (!Array.isArray(record.timelineRegistry.windows)) record.timelineRegistry.windows = [];
    if (!Array.isArray(record.timelineRegistry.disabledAnchorIds)) record.timelineRegistry.disabledAnchorIds = [];
    if (!Array.isArray(record.timelineRegistry.disabledWindowIds)) record.timelineRegistry.disabledWindowIds = [];
}

function upsertLoredeckTimelineItem(list = [], item = null, normalizer = null) {
    const normalized = typeof normalizer === 'function' ? normalizer(item) : item;
    const id = String(normalized?.id || '').trim();
    if (!id) return list;
    const next = (Array.isArray(list) ? list : []).filter(existing => String(existing?.id || '').trim() !== id);
    next.push(normalized);
    return next;
}

function removeLoredeckTimelineItem(list = [], id = '') {
    const target = normalizeLoredeckTimelineId(id);
    if (!target) return Array.isArray(list) ? list : [];
    return (Array.isArray(list) ? list : []).filter(item => String(item?.id || '').trim() !== target);
}

function updateLoredeckDisabledTimelineIds(current = [], add = [], remove = []) {
    const set = new Set(normalizeLoredeckTimelineDisabledIds(current));
    for (const id of normalizeLoredeckTimelineDisabledIds(add)) set.add(id);
    for (const id of normalizeLoredeckTimelineDisabledIds(remove)) set.delete(id);
    return Array.from(set);
}

function applyLoredeckRecordPatch(record, payload = {}) {
    const patch = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const entryOverrides = patch.entryOverrides && typeof patch.entryOverrides === 'object' && !Array.isArray(patch.entryOverrides)
        ? patch.entryOverrides
        : {};
    for (const [rawId, rawEntry] of Object.entries(entryOverrides)) {
        const id = String(rawEntry?.id || rawId || '').trim();
        if (!id) continue;
        if (rawEntry === null) {
            delete record.entryOverrides[id];
            continue;
        }
        record.entryOverrides[id] = rawEntry;
    }

    const disabledSet = new Set(Array.isArray(record.disabledEntryIds) ? record.disabledEntryIds : []);
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsAdd || [])) disabledSet.add(id);
    for (const id of normalizeLoredeckPendingIdList(patch.disabledEntryIdsRemove || [])) disabledSet.delete(id);
    record.disabledEntryIds = Array.from(disabledSet);

    const tagDefinitions = patch.tagDefinitions && typeof patch.tagDefinitions === 'object' && !Array.isArray(patch.tagDefinitions)
        ? patch.tagDefinitions
        : {};
    if (Object.keys(tagDefinitions).length) ensureLoredeckPatchTagRegistry(record);
    for (const [rawId, rawDef] of Object.entries(tagDefinitions)) {
        const id = normalizeLoredeckTagId(rawDef?.id || rawId);
        if (!id) continue;
        if (rawDef === null) {
            delete record.tagRegistry.tags[id];
            continue;
        }
        const def = normalizeLoredeckTagDefinition(rawDef, id);
        delete def.id;
        record.tagRegistry.tags[id] = def;
    }

    const timelineAnchors = patch.timelineAnchors && typeof patch.timelineAnchors === 'object' && !Array.isArray(patch.timelineAnchors)
        ? patch.timelineAnchors
        : {};
    const timelineWindows = patch.timelineWindows && typeof patch.timelineWindows === 'object' && !Array.isArray(patch.timelineWindows)
        ? patch.timelineWindows
        : {};
    const hasTimelinePatch = Object.keys(timelineAnchors).length
        || Object.keys(timelineWindows).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineAnchorIdsDisable || []).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineAnchorIdsEnable || []).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineWindowIdsDisable || []).length
        || normalizeLoredeckTimelineDisabledIds(patch.timelineWindowIdsEnable || []).length;
    if (hasTimelinePatch) ensureLoredeckPatchTimelineRegistry(record);

    for (const [rawId, rawAnchor] of Object.entries(timelineAnchors)) {
        const id = normalizeLoredeckTimelineId(rawAnchor?.id || rawId);
        if (!id) continue;
        if (rawAnchor === null) {
            record.timelineRegistry.anchors = removeLoredeckTimelineItem(record.timelineRegistry.anchors, id);
            continue;
        }
        record.timelineRegistry.anchors = upsertLoredeckTimelineItem(record.timelineRegistry.anchors, { ...rawAnchor, id }, normalizeLoredeckTimelineAnchor);
        record.timelineRegistry.disabledAnchorIds = updateLoredeckDisabledTimelineIds(record.timelineRegistry.disabledAnchorIds, [], [id]);
    }

    for (const [rawId, rawWindow] of Object.entries(timelineWindows)) {
        const id = normalizeLoredeckTimelineId(rawWindow?.id || rawId);
        if (!id) continue;
        if (rawWindow === null) {
            record.timelineRegistry.windows = removeLoredeckTimelineItem(record.timelineRegistry.windows, id);
            continue;
        }
        record.timelineRegistry.windows = upsertLoredeckTimelineItem(record.timelineRegistry.windows, { ...rawWindow, id }, normalizeLoredeckTimelineWindow);
        record.timelineRegistry.disabledWindowIds = updateLoredeckDisabledTimelineIds(record.timelineRegistry.disabledWindowIds, [], [id]);
    }

    if (hasTimelinePatch) {
        record.timelineRegistry.disabledAnchorIds = updateLoredeckDisabledTimelineIds(
            record.timelineRegistry?.disabledAnchorIds,
            patch.timelineAnchorIdsDisable || [],
            patch.timelineAnchorIdsEnable || []
        );
        record.timelineRegistry.disabledWindowIds = updateLoredeckDisabledTimelineIds(
            record.timelineRegistry?.disabledWindowIds,
            patch.timelineWindowIdsDisable || [],
            patch.timelineWindowIdsEnable || []
        );
    }
}

function parseLoredeckEntryTags(value, limit = 64) {
    const rawItems = Array.isArray(value)
        ? value.flatMap(item => Array.isArray(item) ? item : [item])
        : String(value || '').split(/[,;\n\r]+/);
    const tags = [];
    const seen = new Set();
    for (const raw of rawItems) {
        const tag = normalizeLoredeckTagId(raw);
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= limit) break;
    }
    return tags;
}

function mergeLoredeckEntryTags(current = [], additions = []) {
    const tags = parseLoredeckEntryTags(current);
    const seen = new Set(tags.map(tag => tag.toLowerCase()));
    for (const tag of parseLoredeckEntryTags(additions)) {
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
    }
    return tags.slice(0, 64);
}

function removeLoredeckEntryTags(current = [], removals = []) {
    const removeSet = new Set(parseLoredeckEntryTags(removals).map(tag => tag.toLowerCase()));
    if (!removeSet.size) return parseLoredeckEntryTags(current);
    return parseLoredeckEntryTags(current).filter(tag => !removeSet.has(tag.toLowerCase()));
}

function replaceLoredeckEntryTag(current = [], fromTag = '', toTag = '') {
    const from = parseLoredeckEntryTags([fromTag])[0] || '';
    if (!from) return parseLoredeckEntryTags(current);
    const to = parseLoredeckEntryTags([toTag])[0] || '';
    const next = removeLoredeckEntryTags(current, [from]);
    return to ? mergeLoredeckEntryTags(next, [to]) : next;
}

function getLoredeckEntryTags(entry = {}) {
    return parseLoredeckEntryTags(Array.isArray(entry.tags) ? entry.tags : []);
}

function getLoredeckEntryRowsForBulk(rows = []) {
    return (rows || []).filter(row => row?.id && !row.disabled);
}

function buildLoredeckTagStats(rows = []) {
    const map = new Map();
    for (const row of rows || []) {
        if (row?.disabled) continue;
        for (const tag of getLoredeckEntryTags(row.entry || {})) {
            const key = tag.toLowerCase();
            if (!map.has(key)) {
                map.set(key, {
                    tag,
                    count: 0,
                    overrideCount: 0,
                    sourceCount: 0,
                    entryIds: [],
                });
            }
            const item = map.get(key);
            item.count += 1;
            if (row.overrideEntry) item.overrideCount += 1;
            else item.sourceCount += 1;
            if (item.entryIds.length < 50) item.entryIds.push(row.id);
        }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function buildLoredeckTagManagerItems(pack, rows = []) {
    const stats = buildLoredeckTagStats(rows);
    const sourceRegistry = getLoredeckCachedSourceTagRegistry(pack?.packId);
    const customRegistry = getLoredeckEmbeddedTagRegistry(pack);
    const map = new Map();

    const ensure = (tag) => {
        const id = normalizeLoredeckTagId(tag);
        if (!id) return null;
        const key = id.toLowerCase();
        if (!map.has(key)) {
            map.set(key, {
                tag: id,
                count: 0,
                overrideCount: 0,
                sourceCount: 0,
                entryIds: [],
                sourceDefined: false,
                customDefined: false,
                sourceDefinition: null,
                customDefinition: null,
                definition: normalizeLoredeckTagDefinition({}, id),
            });
        }
        return map.get(key);
    };

    for (const [tag, def] of Object.entries(sourceRegistry.tags || {})) {
        const item = ensure(tag);
        if (!item) continue;
        item.sourceDefined = true;
        item.sourceDefinition = normalizeLoredeckTagDefinition(def, tag);
    }
    for (const [tag, def] of Object.entries(customRegistry.tags || {})) {
        const item = ensure(tag);
        if (!item) continue;
        item.customDefined = true;
        item.customDefinition = normalizeLoredeckTagDefinition(def, tag);
    }
    for (const stat of stats) {
        const item = ensure(stat.tag);
        if (!item) continue;
        item.count = stat.count || 0;
        item.overrideCount = stat.overrideCount || 0;
        item.sourceCount = stat.sourceCount || 0;
        item.entryIds = stat.entryIds || [];
    }
    for (const item of map.values()) {
        item.definition = mergeLoredeckTagDefinition(item.sourceDefinition || {}, item.customDefinition || {});
        item.registryState = item.customDefined
            ? (item.sourceDefined ? 'custom override' : 'custom')
            : (item.sourceDefined ? 'source' : 'undefined');
    }

    return Array.from(map.values()).sort((a, b) => {
        const aUndefined = !a.sourceDefined && !a.customDefined ? 0 : 1;
        const bUndefined = !b.sourceDefined && !b.customDefined ? 0 : 1;
        return aUndefined - bUndefined
            || (b.count || 0) - (a.count || 0)
            || a.tag.localeCompare(b.tag);
    });
}

function buildMergedLoredeckTagRegistryForExport(pack, rows = []) {
    const registry = { schemaVersion: 1, tags: {} };
    for (const item of buildLoredeckTagManagerItems(pack, rows)) {
        if (!item.sourceDefined && !item.customDefined) continue;
        registry.tags[item.tag] = normalizeLoredeckTagDefinition(item.definition || {}, item.tag);
        delete registry.tags[item.tag].id;
    }
    return registry;
}

function getLoredeckEntryAnchorRefs(entry = {}) {
    const contextGate = entry?.context && typeof entry.context === 'object' && !Array.isArray(entry.context)
        ? entry.context
        : {};
    return normalizeLoredeckPendingTimelineIdList([
        contextGate.anchorId,
        contextGate.validFromAnchor,
        contextGate.validToAnchor,
        contextGate.anchorFrom,
        contextGate.anchorTo,
    ], 12);
}

function buildLoredeckTimelineAttachmentStats(rows = []) {
    const anchorRefs = new Map();
    const entryContexts = [];
    for (const row of rows || []) {
        if (!row?.id || row.disabled) continue;
        const entry = row.entry || {};
        const refs = getLoredeckEntryAnchorRefs(entry);
        for (const ref of refs) {
            if (!anchorRefs.has(ref)) anchorRefs.set(ref, []);
            const list = anchorRefs.get(ref);
            if (list.length < 50) list.push(row.id);
        }
        const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context)
            ? entry.context
            : {};
        entryContexts.push({
            id: row.id,
            from: normalizeLoredeckTimelineId(contextGate.validFromAnchor || contextGate.anchorFrom || ''),
            to: normalizeLoredeckTimelineId(contextGate.validToAnchor || contextGate.anchorTo || ''),
            sortKeyFrom: normalizeLoredeckTimelineNumber(contextGate.sortKeyFrom),
            sortKeyTo: normalizeLoredeckTimelineNumber(contextGate.sortKeyTo),
        });
    }
    return { anchorRefs, entryContexts };
}

function getTimelineWindowEntryRefs(window = {}, stats = {}) {
    const refs = [];
    const anchorFrom = normalizeLoredeckTimelineId(window.anchorFrom);
    const anchorTo = normalizeLoredeckTimelineId(window.anchorTo);
    const sortKeyFrom = normalizeLoredeckTimelineNumber(window.sortKeyFrom);
    const sortKeyTo = normalizeLoredeckTimelineNumber(window.sortKeyTo);
    for (const entry of stats.entryContexts || []) {
        const anchorsMatch = anchorFrom && anchorTo && entry.from === anchorFrom && entry.to === anchorTo;
        const sortsMatch = sortKeyFrom !== null && sortKeyTo !== null && entry.sortKeyFrom === sortKeyFrom && entry.sortKeyTo === sortKeyTo;
        if (anchorsMatch || sortsMatch) refs.push(entry.id);
        if (refs.length >= 50) break;
    }
    return refs;
}

function buildLoredeckTimelineRegistryItems(pack, rows = []) {
    const sourceRegistry = getLoredeckCachedSourceTimelineRegistry(pack?.packId);
    const customRegistry = getLoredeckEmbeddedTimelineRegistry(pack);
    const stats = buildLoredeckTimelineAttachmentStats(rows);
    const map = new Map();

    const ensure = (kind, id) => {
        const cleanId = normalizeLoredeckTimelineId(id);
        if (!cleanId) return null;
        const key = `${kind}:${cleanId}`;
        if (!map.has(key)) {
            map.set(key, {
                kind,
                id: cleanId,
                sourceDefined: false,
                customDefined: false,
                disabled: false,
                sourceDefinition: null,
                customDefinition: null,
                definition: null,
                entryIds: [],
            });
        }
        return map.get(key);
    };

    const disabledAnchors = new Set(customRegistry.disabledAnchorIds || []);
    const disabledWindows = new Set(customRegistry.disabledWindowIds || []);
    for (const anchor of sourceRegistry.anchors || []) {
        const item = ensure('anchor', anchor.id);
        if (!item) continue;
        item.sourceDefined = true;
        item.sourceDefinition = normalizeLoredeckTimelineAnchor(anchor, anchor.id);
        item.disabled = disabledAnchors.has(item.id);
    }
    for (const anchor of customRegistry.anchors || []) {
        const item = ensure('anchor', anchor.id);
        if (!item) continue;
        item.customDefined = true;
        item.customDefinition = normalizeLoredeckTimelineAnchor(anchor, anchor.id);
        item.disabled = disabledAnchors.has(item.id);
    }
    for (const window of sourceRegistry.windows || []) {
        const item = ensure('window', window.id);
        if (!item) continue;
        item.sourceDefined = true;
        item.sourceDefinition = normalizeLoredeckTimelineWindow(window, window.id);
        item.disabled = disabledWindows.has(item.id);
    }
    for (const window of customRegistry.windows || []) {
        const item = ensure('window', window.id);
        if (!item) continue;
        item.customDefined = true;
        item.customDefinition = normalizeLoredeckTimelineWindow(window, window.id);
        item.disabled = disabledWindows.has(item.id);
    }

    for (const item of map.values()) {
        item.definition = item.customDefinition || item.sourceDefinition || (item.kind === 'anchor'
            ? normalizeLoredeckTimelineAnchor({ id: item.id }, item.id)
            : normalizeLoredeckTimelineWindow({ id: item.id }, item.id));
        item.registryState = item.disabled
            ? 'disabled'
            : item.customDefined
                ? (item.sourceDefined ? 'custom override' : 'custom')
                : (item.sourceDefined ? 'source' : 'undefined');
        item.entryIds = item.kind === 'anchor'
            ? (stats.anchorRefs.get(item.id) || [])
            : getTimelineWindowEntryRefs(item.definition, stats);
    }

    const usedAnchorIds = Array.from(stats.anchorRefs.keys());
    for (const id of usedAnchorIds) {
        if (map.has(`anchor:${id}`)) continue;
        const item = ensure('anchor', id);
        if (!item) continue;
        item.definition = normalizeLoredeckTimelineAnchor({ id, label: id }, id);
        item.registryState = 'undefined';
        item.entryIds = stats.anchorRefs.get(id) || [];
    }

    return Array.from(map.values()).sort((a, b) => {
        const kindCompare = a.kind.localeCompare(b.kind);
        if (kindCompare) return kindCompare;
        const aSort = normalizeLoredeckTimelineNumber(a.definition?.sortKey ?? a.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
        const bSort = normalizeLoredeckTimelineNumber(b.definition?.sortKey ?? b.definition?.sortKeyFrom) ?? Number.MAX_SAFE_INTEGER;
        return aSort - bSort || a.id.localeCompare(b.id);
    });
}

function buildMergedLoredeckTimelineRegistryForExport(pack) {
    const sourceRegistry = getLoredeckCachedSourceTimelineRegistry(pack?.packId);
    const customRegistry = getLoredeckEmbeddedTimelineRegistry(pack);
    const merged = normalizeLoredeckTimelineRegistry(mergeLoredeckTimelineRegistries(sourceRegistry, customRegistry));
    const exportRegistry = {
        schemaVersion: merged.schemaVersion,
        timelineMode: merged.timelineMode,
        defaultContextType: merged.defaultContextType,
        sortKeyScale: merged.sortKeyScale,
        summary: merged.summary,
        anchors: merged.anchors || [],
        windows: merged.windows || [],
    };
    if (!exportRegistry.defaultContextType) delete exportRegistry.defaultContextType;
    if (!exportRegistry.summary) delete exportRegistry.summary;
    return exportRegistry;
}

function createLoredeckTimelineRegistryCard(pack, rows = []) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Timeline Registry';
    wrap.appendChild(title);

    const sourceCache = loredeckTimelineRegistryCache.get(pack.packId);
    const customRegistry = getLoredeckEmbeddedTimelineRegistry(pack);
    const allItems = buildLoredeckTimelineRegistryItems(pack, rows);
    const anchors = allItems.filter(item => item.kind === 'anchor');
    const windows = allItems.filter(item => item.kind === 'window');
    const disabledCount = allItems.filter(item => item.disabled).length;
    const undefinedCount = allItems.filter(item => item.registryState === 'undefined').length;
    const attachedCount = allItems.filter(item => item.entryIds.length).length;

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${anchors.length} anchors`, 'Timeline anchor definitions visible in this editor.'));
    summary.appendChild(createStatusPill(`${windows.length} windows`, 'Timeline window definitions visible in this editor.'));
    summary.appendChild(createStatusPill(`${attachedCount} attached`, 'Timeline definitions referenced by loaded entries.'));
    if (undefinedCount) summary.appendChild(createStatusPill(`${undefinedCount} undefined`, 'Loaded entries reference anchors that are not defined in the active timeline registry.'));
    if (disabledCount) summary.appendChild(createStatusPill(`${disabledCount} disabled`, 'Source timeline definitions suppressed by this Custom Loredeck overlay.'));
    if (sourceCache?.loadedAt && !sourceCache.missing && !sourceCache.error) summary.appendChild(createStatusPill('timeline.json loaded', 'Source timeline registry has been fetched for this editor session.'));
    if (sourceCache?.missing) summary.appendChild(createStatusPill('no source timeline', 'The manifest does not currently declare registries.timeline.'));
    if (getLoredeckTimelineRegistryCount(customRegistry)) summary.appendChild(createStatusPill('custom overlay', 'This Loredeck has saved editable timeline registry metadata.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Timeline edits queue Custom overlay proposals. Accepted overlays affect Context search, Deck Health, and runtime Context gating.';
    wrap.appendChild(help);
    if (sourceCache?.error) {
        wrap.appendChild(createKeyValue('Registry Load Error', sourceCache.error, 'Last timeline.json load error for this Loredeck.'));
    }

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const loadRegistry = createButton('Load Timeline', 'Fetch source timeline.json for this Loredeck if the manifest declares one.', async (btn) => {
        await loadLoredeckTimelineRegistryForEditor(pack, btn);
    });
    loadRegistry.disabled = !pack.manifest;
    actions.appendChild(loadRegistry);
    actions.appendChild(createButton('New Anchor', 'Create a new timeline anchor in this Custom Loredeck overlay.', () => {
        openLoredeckTimelineAnchorDialog(pack, null);
    }, 'saga-primary-button'));
    actions.appendChild(createButton('New Window', 'Create a new timeline window in this Custom Loredeck overlay.', () => {
        openLoredeckTimelineWindowDialog(pack, null);
    }));
    const exportButton = createButton('Export Timeline', 'Download the currently merged active timeline registry as timeline.json.', () => {
        downloadJson(buildMergedLoredeckTimelineRegistryForExport(pack), `${sanitizeFileStem(pack.packId || 'saga-loredeck')}.timeline.json`);
        toast('Timeline registry exported.', 'info');
    });
    exportButton.disabled = !allItems.length;
    actions.appendChild(exportButton);
    wrap.appendChild(actions);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'saga-loredeck-entry-search';
    search.placeholder = 'Search timeline anchors/windows...';
    search.value = loredeckTimelineRegistryQuery || '';
    addTooltip(search, 'Search timeline IDs, labels, arcs, aliases, tags, and attachment status.');
    search.addEventListener('click', e => e.stopPropagation());
    search.addEventListener('mousedown', e => e.stopPropagation());
    search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        loredeckTimelineRegistryQuery = search.value;
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    search.addEventListener('change', () => {
        loredeckTimelineRegistryQuery = search.value;
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    wrap.appendChild(search);

    const q = String(loredeckTimelineRegistryQuery || '').trim().toLowerCase();
    const visible = allItems
        .filter(item => {
            if (!q) return true;
            const def = item.definition || {};
            return [
                item.kind,
                item.id,
                item.registryState,
                def.label,
                def.arc,
                def.phase,
                def.season,
                def.episode,
                def.chapter,
                def.anchorFrom,
                def.anchorTo,
                def.notes,
                ...(Array.isArray(def.aliases) ? def.aliases : []),
                ...(Array.isArray(def.tags) ? def.tags : []),
            ].filter(Boolean).join(' ').toLowerCase().includes(q);
        })
        .slice(0, 32);

    if (!visible.length) {
        wrap.appendChild(createEmptyMessage(allItems.length ? 'No matching timeline definitions.' : 'Load entries, load timeline.json, or create an anchor/window to begin editing the registry.'));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const item of visible) {
        list.appendChild(createLoredeckTimelineRegistryRow(pack, item));
    }
    if (visible.length < allItems.length) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing ${visible.length} of ${allItems.length} timeline definitions. Search to narrow the list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function formatTimelineDateRange(dateRange = {}) {
    const range = dateRange && typeof dateRange === 'object' && !Array.isArray(dateRange) ? dateRange : {};
    const from = String(range.from || '').trim();
    const to = String(range.to || '').trim();
    if (from && to && from !== to) return `${from} to ${to}`;
    return from || to || '';
}

function createLoredeckTimelineRegistryRow(pack, item = {}) {
    const row = document.createElement('div');
    row.className = `saga-loredeck-entry-row${item.disabled ? ' saga-loredeck-entry-row-disabled' : ''}`.trim();

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = item.definition?.label || item.id;
    main.appendChild(title);
    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    if (item.kind === 'anchor') {
        const range = formatTimelineDateRange(item.definition?.dateRange);
        desc.textContent = `${item.id}${range ? ` | ${range}` : ''}${item.definition?.notes ? ` | ${truncateText(item.definition.notes, 120)}` : ''}`;
    } else {
        desc.textContent = `${item.id} | ${item.definition?.anchorFrom || '?'} -> ${item.definition?.anchorTo || '?'}`;
    }
    main.appendChild(desc);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(item.kind, 'Timeline registry item type.'));
    meta.appendChild(createStatusPill(item.registryState, 'Timeline registry source state.'));
    if (item.kind === 'anchor') meta.appendChild(createStatusPill(`sort ${item.definition?.sortKey ?? '?'}`, 'Timeline sort key.'));
    if (item.kind === 'window') meta.appendChild(createStatusPill(`${item.definition?.sortKeyFrom ?? '?'}-${item.definition?.sortKeyTo ?? '?'}`, 'Timeline sort key window.'));
    if (item.entryIds.length) meta.appendChild(createStatusPill(`${item.entryIds.length} entr${item.entryIds.length === 1 ? 'y' : 'ies'}`, item.entryIds.slice(0, 12).join(', ')));
    main.appendChild(meta);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    const filterButton = createButton('Entries', 'Filter the entry list to entries attached to this timeline definition.', () => {
        loredeckEntryOverrideQuery = item.id || '';
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    filterButton.disabled = !item.entryIds.length;
    actions.appendChild(filterButton);
    actions.appendChild(createButton('Edit', 'Edit this timeline definition as a Custom overlay proposal.', () => {
        if (item.kind === 'anchor') openLoredeckTimelineAnchorDialog(pack, item);
        else openLoredeckTimelineWindowDialog(pack, item);
    }, item.customDefined ? 'saga-primary-button' : ''));
    actions.appendChild(createButton(item.disabled ? 'Enable' : 'Disable', item.disabled ? 'Restore this source timeline definition.' : 'Suppress this timeline definition in this Custom overlay.', () => {
        setLoredeckTimelineItemDisabled(pack, item.kind, item.id, !item.disabled);
    }));
    if (item.customDefined) {
        actions.appendChild(createButton('Forget Overlay', 'Remove this Custom timeline definition and fall back to source if one exists.', () => {
            removeLoredeckTimelineDefinition(pack, item.kind, item.id);
        }, 'saga-danger-button'));
    }
    row.appendChild(actions);
    return row;
}

function getLoredeckAssistantTargetRows(rows = [], filteredRows = [], targetScope = 'current_filter') {
    if (targetScope === 'all_loaded') return rows || [];
    const scoped = loredeckEntryOverrideQuery ? filteredRows : rows;
    return scoped || [];
}

function compactLoredeckAssistantEntry(row = {}) {
    const entry = row.entry || {};
    const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    const retrieval = entry.retrieval && typeof entry.retrieval === 'object' && !Array.isArray(entry.retrieval) ? entry.retrieval : {};
    const content = entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content) ? entry.content : {};
    return {
        id: row.id || entry.id || '',
        status: row.status || '',
        title: entry.title || row.id || '',
        category: entry.category || '',
        canon: entry.canon || entry.canonStatus || '',
        relevance: entry.relevance || '',
        priority: Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : null,
        tags: getLoredeckEntryTags(entry).slice(0, 24),
        context: {
            scope: contextGate.scope || '',
            anchorId: contextGate.anchorId || '',
            validFromAnchor: contextGate.validFromAnchor || contextGate.anchorFrom || '',
            validToAnchor: contextGate.validToAnchor || contextGate.anchorTo || '',
            sortKeyFrom: Number.isFinite(Number(contextGate.sortKeyFrom)) ? Number(contextGate.sortKeyFrom) : null,
            sortKeyTo: Number.isFinite(Number(contextGate.sortKeyTo)) ? Number(contextGate.sortKeyTo) : null,
            precision: contextGate.precision || '',
            windowKind: contextGate.windowKind || '',
            label: contextGate.label || '',
        },
        retrieval: {
            activation: retrieval.activation || '',
            frequency: retrieval.frequency || '',
            contextBoost: retrieval.contextBoost || '',
        },
        content: {
            fact: truncateText(content.fact || entry.fact || '', 900),
            injection: truncateText(content.injection || entry.injection || '', 900),
            notes: truncateText(content.notes || entry.notes || '', 500),
        },
    };
}

function buildLoredeckAssistantContext(pack, rows = [], filteredRows = [], options = {}) {
    const targetRows = getLoredeckAssistantTargetRows(rows, filteredRows, options.targetScope);
    const timelineItems = buildLoredeckTimelineRegistryItems(pack, rows);
    const tagItems = buildLoredeckTagManagerItems(pack, rows);
    const context = getLoredeckContext(getState(), pack.packId);
    return {
        instruction: options.instruction || '',
        mode: options.mode || 'mixed',
        targetScope: options.targetScope || 'current_filter',
        pack: {
            packId: pack.packId || '',
            title: pack.title || pack.packId || '',
            type: pack.type || '',
            fandom: pack.fandom || '',
            era: pack.era || '',
            entrySchemaVersion: getExpectedLoredeckEntrySchemaVersion(pack),
        },
        context: {
            label: context?.label || '',
            contextType: context?.contextType || '',
            sceneDate: context?.sceneDate || '',
            anchorId: context?.anchorId || '',
            anchorFrom: context?.anchorFrom || '',
            anchorTo: context?.anchorTo || '',
            arc: context?.arc || '',
            phase: context?.phase || '',
        },
        allowedTimelineAnchorIds: timelineItems
            .filter(item => item.kind === 'anchor' && !item.disabled)
            .map(item => item.id)
            .slice(0, 160),
        knownTags: tagItems
            .map(item => item.tag)
            .filter(Boolean)
            .slice(0, 160),
        targetEntries: targetRows
            .filter(row => row?.id && !row.disabled)
            .slice(0, 60)
            .map(compactLoredeckAssistantEntry),
    };
}

function createLoredeckAssistantCard(pack, rows = [], filteredRows = []) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Lore Assistant';
    wrap.appendChild(title);

    const targetRows = getLoredeckAssistantTargetRows(rows, filteredRows, loredeckAssistantTargetScope).filter(row => row?.id && !row.disabled);
    const cached = loredeckAssistantDraftCache.get(pack.packId);
    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${targetRows.length} target entr${targetRows.length === 1 ? 'y' : 'ies'}`, 'Entries included in the assistant context. Current search can narrow this set.'));
    summary.appendChild(createStatusPill(loredeckAssistantMode.replace(/_/g, ' '), 'Current assistant task mode.'));
    summary.appendChild(createStatusPill('Value rubric', 'Assistant proposals are asked to score scene utility, behavior impact, Context fit, injection quality, and wiki-summary risk.'));
    if (cached?.draftChanges?.length) {
        const selectedCount = getLoredeckAssistantSelectedDraftIds(cached).size;
        summary.appendChild(createStatusPill(`${cached.draftChanges.length} drafted`, 'Assistant proposals waiting for batch review before they enter Pending Review.'));
        summary.appendChild(createStatusPill(`${selectedCount} selected`, 'Draft proposals selected for queue, drop, or revision actions.'));
    }
    if (cached?.queuedCount) summary.appendChild(createStatusPill(`${cached.queuedCount} queued`, 'Last assistant proposal count queued into Pending Review.'));
    if (cached?.selectedHealthIssueCount) summary.appendChild(createStatusPill(`${cached.selectedHealthIssueCount} health issue${cached.selectedHealthIssueCount === 1 ? '' : 's'}`, 'Last assistant draft was generated from selected Deck Health issues.'));
    if (cached?.qualityWarningCount) summary.appendChild(createStatusPill(`${cached.qualityWarningCount} quality flag${cached.qualityWarningCount === 1 ? '' : 's'}`, 'Last assistant draft included local quality guardrail flags.'));
    if (cached?.questions?.length) summary.appendChild(createStatusPill(`${cached.questions.length} question${cached.questions.length === 1 ? '' : 's'}`, 'Last assistant response requested clarification.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'The assistant drafts reviewable proposals only. Accepted Loredeck data changes after you accept the queued Pending Review items.';
    wrap.appendChild(help);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form';
    const instructionInput = createNewLoreInput(form, 'Instruction', 'Describe the revision, missing lore, tag definitions, or timeline anchors/windows you want proposed.', loredeckAssistantInstruction || '', true, 'Revise Arlong and crew entries so their cruelty creates more pressure and danger without turning every line into generic villain biography.');
    const grid = document.createElement('div');
    grid.className = 'saga-new-lore-meta-grid';
    form.appendChild(grid);
    const modeSelect = createNewLoreSelect(grid, 'Mode', ['revise_entries', 'suggest_entries', 'draft_tags', 'draft_timeline', 'mixed'], loredeckAssistantMode, value => humanizeScopeKey(value));
    const scopeSelect = createNewLoreSelect(grid, 'Target', ['current_filter', 'all_loaded'], loredeckAssistantTargetScope, value => value === 'current_filter' ? 'Current Search' : 'All Loaded');
    wrap.appendChild(form);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const draftButton = createButton('Draft Proposals', 'Ask the Reasoning Provider to draft structured Loredeck changes for batch review before they enter Pending Review.', async (btn) => {
        loredeckAssistantInstruction = instructionInput.value.trim();
        loredeckAssistantMode = modeSelect.value;
        loredeckAssistantTargetScope = scopeSelect.value;
        await handleLoredeckAssistantDraft(pack, rows, filteredRows, {
            instruction: loredeckAssistantInstruction,
            mode: loredeckAssistantMode,
            targetScope: loredeckAssistantTargetScope,
        }, btn);
    }, 'saga-primary-button');
    actions.appendChild(draftButton);
    const loadButton = createButton('Load Context', 'Load entries, tags, and timeline registries so the assistant has current context.', async (btn) => {
        await loadLoredeckEntriesForEditor(pack, btn);
    });
    loadButton.disabled = !canValidateLoredeckInEditor(pack);
    actions.appendChild(loadButton);
    wrap.appendChild(actions);

    if (cached?.summary || cached?.questions?.length || cached?.warnings?.length) {
        const result = document.createElement('div');
        result.className = 'saga-runtime-help';
        const parts = [];
        if (cached.summary) parts.push(cached.summary);
        if (cached.questions?.length) parts.push(`Questions: ${cached.questions.join(' | ')}`);
        if (cached.warnings?.length) parts.push(`Warnings: ${cached.warnings.join(' | ')}`);
        result.textContent = parts.join(' ');
        wrap.appendChild(result);
    }

    const draftBatch = createLoredeckAssistantDraftBatchCard(pack, cached, rows, filteredRows);
    if (draftBatch) wrap.appendChild(draftBatch);

    return wrap;
}

function getLoredeckAssistantDraftChanges(cached = {}) {
    return normalizeLoredeckPendingChanges(cached?.draftChanges);
}

function normalizeLoredeckAssistantDraftChangeIds(value = [], limit = 500) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of value) {
        const id = String(raw || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= limit) break;
    }
    return out;
}

function getLoredeckAssistantSelectedDraftIds(cached = {}) {
    const changes = getLoredeckAssistantDraftChanges(cached);
    const validIds = new Set(changes.map(change => change.changeId));
    if (!Object.prototype.hasOwnProperty.call(cached || {}, 'selectedDraftChangeIds')) {
        return new Set(validIds);
    }
    const selected = new Set(normalizeLoredeckAssistantDraftChangeIds(cached.selectedDraftChangeIds).filter(id => validIds.has(id)));
    return selected;
}

function getLoredeckAssistantSelectedDraftChanges(cached = {}) {
    const selectedIds = getLoredeckAssistantSelectedDraftIds(cached);
    return getLoredeckAssistantDraftChanges(cached).filter(change => selectedIds.has(change.changeId));
}

function updateLoredeckAssistantDraftCache(packId = '', mutator = null) {
    const id = String(packId || '').trim();
    if (!id || typeof mutator !== 'function') return null;
    const current = loredeckAssistantDraftCache.get(id) || {};
    const next = mutator({
        ...current,
        draftChanges: getLoredeckAssistantDraftChanges(current),
        selectedDraftChangeIds: normalizeLoredeckAssistantDraftChangeIds(current.selectedDraftChangeIds || []),
    }) || current;
    const normalized = {
        ...next,
        draftChanges: getLoredeckAssistantDraftChanges(next),
        selectedDraftChangeIds: normalizeLoredeckAssistantDraftChangeIds(next.selectedDraftChangeIds || []),
    };
    if (!normalized.draftChanges.length) {
        delete normalized.draftChanges;
        delete normalized.selectedDraftChangeIds;
    }
    normalized.qualityWarningCount = countLoredeckAssistantQualityWarningsForChanges(normalized.draftChanges || []);
    loredeckAssistantDraftCache.set(id, normalized);
    return normalized;
}

function setLoredeckAssistantDraftSelection(pack, changeId = '', selected = false, options = {}) {
    const id = String(changeId || '').trim();
    if (!id) return;
    updateLoredeckAssistantDraftCache(pack.packId, cached => {
        const selectedIds = getLoredeckAssistantSelectedDraftIds(cached);
        if (selected) selectedIds.add(id);
        else selectedIds.delete(id);
        return { ...cached, selectedDraftChangeIds: [...selectedIds] };
    });
    if (options.refresh) refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
}

function setLoredeckAssistantDraftSelectionBulk(pack, mode = 'all') {
    updateLoredeckAssistantDraftCache(pack.packId, cached => {
        const changes = getLoredeckAssistantDraftChanges(cached);
        return {
            ...cached,
            selectedDraftChangeIds: mode === 'all' ? changes.map(change => change.changeId) : [],
        };
    });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
}

function createLoredeckAssistantDraftBatchCard(pack, cached = null, rows = [], filteredRows = []) {
    const changes = getLoredeckAssistantDraftChanges(cached);
    if (!changes.length) return null;
    const selectedIds = getLoredeckAssistantSelectedDraftIds(cached);
    const selectedCount = changes.filter(change => selectedIds.has(change.changeId)).length;
    const creatorBatch = String(cached?.source || '').trim() === 'loredeck_creator'
        || changes.every(change => String(change.source || '').trim() === 'loredeck_creator');
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview saga-loredeck-assistant-draft-batch';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = creatorBatch ? 'Creator Lorecard Draft Review' : 'Assistant Draft Batch';
    wrap.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${changes.length} drafted`, creatorBatch ? 'Creator Lorecard drafts waiting for edit-before-review.' : 'Draft proposals waiting for edit-before-queue review.'));
    summary.appendChild(createStatusPill(`${selectedCount} selected`, creatorBatch ? 'Selected drafts are affected by send, drop, and revise actions.' : 'Selected proposals are affected by queue, drop, and revise actions.'));
    const qualityWarningCount = countLoredeckAssistantQualityWarningsForChanges(changes);
    if (qualityWarningCount) summary.appendChild(createStatusPill(`${qualityWarningCount} quality flag${qualityWarningCount === 1 ? '' : 's'}`, 'Local guardrail flags across this assistant draft batch.'));
    wrap.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const queueSelected = createButton(creatorBatch ? 'Send Selected to Review' : 'Queue Selected', creatorBatch ? 'Move selected Creator Lorecard drafts into Pending Review.' : 'Move selected assistant draft proposals into Pending Review.', () => {
        queueLoredeckAssistantDraftSelection(pack, getLoredeckAssistantSelectedDraftIds(loredeckAssistantDraftCache.get(pack.packId) || {}));
    }, 'saga-primary-button');
    queueSelected.disabled = !selectedCount;
    actions.appendChild(queueSelected);
    const queueAll = createButton(creatorBatch ? 'Send All to Review' : 'Queue All', creatorBatch ? 'Move every Creator Lorecard draft into Pending Review.' : 'Move every assistant draft proposal into Pending Review.', () => {
        queueLoredeckAssistantDraftSelection(pack, new Set(changes.map(change => change.changeId)));
    });
    queueAll.disabled = !changes.length;
    actions.appendChild(queueAll);
    const dropSelected = createButton('Drop Selected', creatorBatch ? 'Remove selected Creator Lorecard drafts without sending them to Pending Review.' : 'Remove selected assistant draft proposals without queueing them.', () => {
        dropLoredeckAssistantDraftSelection(pack, getLoredeckAssistantSelectedDraftIds(loredeckAssistantDraftCache.get(pack.packId) || {}));
    }, 'saga-danger-button');
    dropSelected.disabled = !selectedCount;
    actions.appendChild(dropSelected);
    actions.appendChild(createButton('Select All', creatorBatch ? 'Select every Creator Lorecard draft.' : 'Select every assistant draft proposal.', () => {
        setLoredeckAssistantDraftSelectionBulk(pack, 'all');
    }));
    actions.appendChild(createButton('Clear Selection', creatorBatch ? 'Clear the Creator draft selection.' : 'Clear the assistant draft selection.', () => {
        setLoredeckAssistantDraftSelectionBulk(pack, 'none');
    }));
    wrap.appendChild(actions);

    const reviseForm = document.createElement('div');
    reviseForm.className = 'saga-new-lore-form saga-loredeck-assistant-revise-form';
    const reviseInput = createNewLoreInput(reviseForm, 'Revision', creatorBatch ? 'Instruction for revising selected Creator Lorecard drafts before sending them to Pending Review.' : 'Instruction for revising selected draft proposals before queueing them.', loredeckAssistantRevisionInstruction || '', true, 'Tighten selected entries so the injection text creates more pressure and less biography.');
    const reviseActions = document.createElement('div');
    reviseActions.className = 'saga-primary-actions';
    const reviseButton = createButton('Revise Selected', creatorBatch ? 'Ask the Reasoning Provider to revise only the selected Creator Lorecard drafts.' : 'Ask the Reasoning Provider to revise only the selected assistant draft proposals.', async (btn) => {
        loredeckAssistantRevisionInstruction = reviseInput.value.trim();
        await handleLoredeckAssistantDraftRevision(pack, rows, filteredRows, {
            instruction: loredeckAssistantRevisionInstruction,
        }, btn);
    });
    reviseButton.disabled = !selectedCount;
    reviseActions.appendChild(reviseButton);
    reviseForm.appendChild(reviseActions);
    wrap.appendChild(reviseForm);

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const change of changes.slice(0, 30)) {
        list.appendChild(createLoredeckAssistantDraftRow(pack, change, selectedIds.has(change.changeId), { creatorBatch }));
    }
    if (changes.length > 30) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = creatorBatch
            ? `Showing 30 of ${changes.length} Creator Lorecard drafts. Send or drop some to reduce the list.`
            : `Showing 30 of ${changes.length} draft proposals. Queue or drop some to reduce the list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function createLoredeckAssistantDraftRow(pack, change = {}, selected = false, options = {}) {
    const creatorDraft = options.creatorBatch || String(change.source || '').trim() === 'loredeck_creator';
    const row = document.createElement('div');
    row.className = 'saga-loredeck-entry-row saga-loredeck-assistant-draft-row';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const titleLine = document.createElement('label');
    titleLine.className = 'saga-loredeck-assistant-draft-title';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected;
    addTooltip(checkbox, selected ? 'Remove this draft proposal from the current batch selection.' : 'Add this draft proposal to the current batch selection.');
    checkbox.addEventListener('click', event => event.stopPropagation());
    checkbox.addEventListener('change', () => {
        setLoredeckAssistantDraftSelection(pack, change.changeId, checkbox.checked, { refresh: true });
    });
    titleLine.appendChild(checkbox);
    const title = document.createElement('span');
    title.className = 'saga-loredeck-row-title';
    title.textContent = change.title || change.changeId || 'Assistant Draft Proposal';
    titleLine.appendChild(title);
    main.appendChild(titleLine);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    const preview = change.preview || {};
    desc.textContent = change.description || preview.after || preview.before || (creatorDraft ? 'Creator Lorecard draft.' : 'Assistant draft proposal.');
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(`Action: ${formatLoredeckPendingActionLabel(change.action)}`, `Draft action: ${change.action || 'record_patch'}.`));
    meta.appendChild(createStatusPill(`Target: ${formatLoredeckPendingTargetKindLabel(change.targetKind)}`, `Draft target kind: ${change.targetKind || 'loredeck'}.`));
    const confidence = getLoredeckPendingConfidence(change);
    if (confidence !== null) meta.appendChild(createStatusPill(`Confidence ${Math.round(confidence * 100)}%`, 'Model confidence for this draft proposal.'));
    const risk = getLoredeckPendingRisk(change);
    if (risk) meta.appendChild(createLoredeckPendingRiskPill(risk));
    appendLoredeckPendingQualityPills(meta, change);
    if (doesLoredeckPendingChangeAffectPackHealth(change)) meta.appendChild(createLoredeckPendingHealthImpactPill());
    if (change.affectedEntryIds?.length) meta.appendChild(createStatusPill(`${change.affectedEntryIds.length} entr${change.affectedEntryIds.length === 1 ? 'y' : 'ies'}`, change.affectedEntryIds.slice(0, 10).join(', ')));
    if (change.affectedTagIds?.length) meta.appendChild(createStatusPill(`${change.affectedTagIds.length} tag${change.affectedTagIds.length === 1 ? '' : 's'}`, change.affectedTagIds.slice(0, 10).join(', ')));
    if (change.affectedTimelineIds?.length) meta.appendChild(createStatusPill(`${change.affectedTimelineIds.length} timeline`, change.affectedTimelineIds.slice(0, 10).join(', ')));
    main.appendChild(meta);

    const diffs = createLoredeckPendingDiffList(pack, change);
    if (diffs) main.appendChild(diffs);
    const quality = createLoredeckPendingQualityList(change);
    if (quality) main.appendChild(quality);
    row.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    actions.appendChild(createButton(creatorDraft ? 'Send to Review' : 'Queue', creatorDraft ? 'Move this Creator Lorecard draft into Pending Review.' : 'Move this assistant draft proposal into Pending Review.', () => {
        queueLoredeckAssistantDraftSelection(pack, new Set([change.changeId]));
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Edit JSON', creatorDraft ? 'Edit this Creator Lorecard draft record before sending it to Pending Review.' : 'Edit this draft proposal record before queueing.', () => {
        openLoredeckAssistantDraftJsonEditor(pack, change);
    }));
    actions.appendChild(createButton('Drop', creatorDraft ? 'Remove this Creator Lorecard draft without sending it to Pending Review.' : 'Remove this draft proposal without queueing it.', () => {
        dropLoredeckAssistantDraftSelection(pack, new Set([change.changeId]));
    }, 'saga-danger-button'));
    row.appendChild(actions);
    return row;
}

function updateLoredeckAssistantDraftAfterRemoval(packId, removedIds = new Set(), queuedCountDelta = 0) {
    return updateLoredeckAssistantDraftCache(packId, cached => {
        const changes = getLoredeckAssistantDraftChanges(cached);
        const selectedIds = getLoredeckAssistantSelectedDraftIds(cached);
        for (const id of removedIds) selectedIds.delete(id);
        const remaining = changes.filter(change => !removedIds.has(change.changeId));
        const remainingIds = new Set(remaining.map(change => change.changeId));
        return {
            ...cached,
            draftChanges: remaining,
            selectedDraftChangeIds: [...selectedIds].filter(id => remainingIds.has(id)),
            queuedCount: (Number(cached.queuedCount) || 0) + queuedCountDelta,
            updatedAt: Date.now(),
        };
    });
}

function queueLoredeckAssistantDraftSelection(pack, selectedIds = new Set()) {
    const cached = loredeckAssistantDraftCache.get(pack.packId) || {};
    const draftChanges = getLoredeckAssistantDraftChanges(cached);
    const creatorBatch = String(cached?.source || '').trim() === 'loredeck_creator'
        || (draftChanges.length > 0 && draftChanges.every(change => String(change.source || '').trim() === 'loredeck_creator'));
    const idSet = selectedIds instanceof Set ? selectedIds : new Set(normalizeLoredeckPendingIdList(selectedIds || []));
    const selected = draftChanges.filter(change => idSet.has(change.changeId));
    if (!selected.length) {
        toast(creatorBatch ? 'Select Creator Lorecard drafts to send to review.' : 'Select assistant draft proposals to queue.', 'warning');
        return false;
    }
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    const queued = queueLoredeckPendingChanges(
        fresh,
        selected,
        creatorBatch
            ? `Sent ${selected.length} Creator Lorecard draft${selected.length === 1 ? '' : 's'} to Pending Review.`
            : `Queued ${selected.length} assistant draft proposal${selected.length === 1 ? '' : 's'} for Pending Review.`
    );
    if (!queued) return false;
    updateLoredeckAssistantDraftAfterRemoval(pack.packId, new Set(selected.map(change => change.changeId)), selected.length);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    return true;
}

function dropLoredeckAssistantDraftSelection(pack, selectedIds = new Set()) {
    const cached = loredeckAssistantDraftCache.get(pack.packId) || {};
    const draftChanges = getLoredeckAssistantDraftChanges(cached);
    const creatorBatch = String(cached?.source || '').trim() === 'loredeck_creator'
        || (draftChanges.length > 0 && draftChanges.every(change => String(change.source || '').trim() === 'loredeck_creator'));
    const idSet = selectedIds instanceof Set ? selectedIds : new Set(normalizeLoredeckPendingIdList(selectedIds || []));
    const selected = draftChanges.filter(change => idSet.has(change.changeId));
    if (!selected.length) {
        toast(creatorBatch ? 'Select Creator Lorecard drafts to drop.' : 'Select assistant draft proposals to drop.', 'warning');
        return false;
    }
    updateLoredeckAssistantDraftAfterRemoval(pack.packId, new Set(selected.map(change => change.changeId)), 0);
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    toast(creatorBatch
        ? `Dropped ${selected.length} Creator Lorecard draft${selected.length === 1 ? '' : 's'}.`
        : `Dropped ${selected.length} assistant draft proposal${selected.length === 1 ? '' : 's'}.`, 'info');
    return true;
}

function compactLoredeckAssistantDraftChangeForRevision(change = {}) {
    const payload = cloneLoredeckJson(change.payload) || {};
    return {
        changeId: change.changeId || '',
        action: change.action || '',
        targetKind: change.targetKind || '',
        title: change.title || '',
        description: truncateText(change.description || '', 900),
        affectedEntryIds: change.affectedEntryIds || [],
        affectedTagIds: change.affectedTagIds || [],
        affectedTimelineIds: change.affectedTimelineIds || [],
        preview: cloneLoredeckJson(change.preview) || {},
        payload,
    };
}

function collectLoredeckHealthRepairSelectedIssues(pack, health = null) {
    const selectedIds = getLoredeckHealthRepairSelection(pack.packId, health);
    return getLoredeckHealthIssueGroups(health)
        .flatMap(group => group.issues)
        .filter(issue => selectedIds.has(issue.issueId));
}

function compactLoredeckHealthIssueForAssistant(issue = {}) {
    const out = {
        issueId: issue.issueId || '',
        severity: issue.severity || 'suggestion',
        code: issue.code || '',
        message: issue.message || '',
        packId: issue.packId || '',
        file: issue.file || '',
        entryIds: normalizeLoredeckPendingIdList(issue.entryIds || []),
        tagIds: normalizeLoredeckTagTextList(issue.tagIds || [], 80, true),
        timelineIds: normalizeLoredeckPendingTimelineIdList(issue.timelineIds || []),
    };
    if (issue.expectedEntryCount !== undefined) out.expectedEntryCount = issue.expectedEntryCount;
    if (issue.actualEntryCount !== undefined) out.actualEntryCount = issue.actualEntryCount;
    if (issue.contextField) out.contextField = issue.contextField;
    if (Array.isArray(issue.contextFields) && issue.contextFields.length) out.contextFields = issue.contextFields.slice(0, 20);
    if (Array.isArray(issue.tags) && issue.tags.length) {
        out.tags = issue.tags.slice(0, 20).map(tag => ({
            tag: String(tag?.tag || tag || '').trim(),
            replacement: String(tag?.replacement || '').trim(),
            entryIds: normalizeLoredeckPendingIdList(tag?.entryIds || []).slice(0, 20),
        })).filter(tag => tag.tag);
    }
    if (issue.expectedCategoryCounts) out.expectedCategoryCounts = cloneLoredeckJson(issue.expectedCategoryCounts);
    if (issue.actualCategoryCounts) out.actualCategoryCounts = cloneLoredeckJson(issue.actualCategoryCounts);
    return out;
}

function collectLoredeckHealthRepairEntryIds(issues = []) {
    const ids = new Set();
    for (const issue of issues || []) {
        for (const id of normalizeLoredeckPendingIdList(issue.entryIds || [])) ids.add(id);
        if (Array.isArray(issue.tags)) {
            for (const tag of issue.tags) {
                for (const id of normalizeLoredeckPendingIdList(tag?.entryIds || [])) ids.add(id);
            }
        }
    }
    return ids;
}

async function handleLoredeckAssistantHealthRepairDraft(pack, health = null, button = null, options = {}) {
    await runBusyAction(button, 'Drafting...', async () => {
        if (!ensureLoreProviderReadyForAction('Deck Health repair planning', 'lore')) return;
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!fresh || fresh.type === 'bundled') {
            toast('Bundled Loredecks cannot be repaired directly. Duplicate as Custom first.', 'warning');
            return;
        }
        const selectedIssues = Array.isArray(options.selectedIssues) && options.selectedIssues.length
            ? options.selectedIssues.map((issue, index) => issue?.issueId ? issue : normalizeLoredeckHealthIssueForRepair(issue, issue?.severity || 'suggestion', index)).filter(issue => issue?.issueId)
            : collectLoredeckHealthRepairSelectedIssues(fresh, health);
        if (!selectedIssues.length) {
            toast('Select Deck Health issues to plan repairs.', 'warning');
            return;
        }
        const entryCache = loredeckEntryPreviewCache.get(fresh.packId) || {};
        const rows = getLoredeckEditableEntryRows(fresh, entryCache.entries || []);
        const relatedEntryIds = collectLoredeckHealthRepairEntryIds(selectedIssues);
        const targetRows = relatedEntryIds.size
            ? rows.filter(row => relatedEntryIds.has(row.id))
            : rows;
        const instruction = [
            'Draft repair proposals for the selected Deck Health issues.',
            'Use supported proposal actions only. Put every repair into reviewable proposals; do not claim fixes are applied.',
            'If an issue cannot be repaired with entry, tag, or timeline proposals, explain that in warnings or ask a clarifying question.',
        ].join(' ');
        const context = buildLoredeckAssistantContext(fresh, rows, targetRows, {
            instruction,
            mode: 'pack_health_repair',
            targetScope: 'all_loaded',
        });
        context.task = 'Turn selected Deck Health issues into reviewable assistant draft proposals.';
        context.targetEntries = targetRows
            .filter(row => row?.id && !row.disabled)
            .slice(0, 80)
            .map(compactLoredeckAssistantEntry);
        context.selectedHealthIssues = selectedIssues.map(compactLoredeckHealthIssueForAssistant);
        const responseText = await sendLoreRequest(
            buildLoredeckAssistantSystemPrompt(),
            buildLoredeckAssistantUserPrompt(context),
            { providerKind: 'lore', maxTokens: 4096 }
        );
        const parsed = parseLoredeckAssistantResponse(responseText);
        const changes = buildLoredeckAssistantPendingChanges(fresh, parsed.proposals, rows);
        const qualityWarningCount = countLoredeckAssistantQualityWarningsForChanges(changes);
        loredeckAssistantDraftCache.set(fresh.packId, {
            summary: parsed.summary || `Repair plan for ${selectedIssues.length} Deck Health issue${selectedIssues.length === 1 ? '' : 's'}.`,
            questions: parsed.clarifyingQuestions,
            warnings: parsed.warnings,
            proposalCount: parsed.proposals.length,
            queuedCount: 0,
            draftChanges: changes,
            selectedDraftChangeIds: changes.map(change => change.changeId),
            qualityWarningCount,
            mode: 'pack_health_repair',
            targetScope: relatedEntryIds.size ? 'health_issue_entries' : 'all_loaded',
            selectedHealthIssueCount: selectedIssues.length,
            createdAt: Date.now(),
        });
        if (parsed.clarifyingQuestions.length && !changes.length) {
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast(`Lore Assistant needs clarification: ${parsed.clarifyingQuestions[0]}`, 'warning');
            return;
        }
        if (!changes.length) {
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast(parsed.warnings[0] || 'Lore Assistant returned no repair proposals.', 'warning');
            return;
        }
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`Lore Assistant drafted ${changes.length} repair proposal${changes.length === 1 ? '' : 's'} for batch review.`, 'success');
    });
}

async function handleLoredeckAssistantDraftRevision(pack, rows = [], filteredRows = [], options = {}, button = null) {
    await runBusyAction(button, 'Revising...', async () => {
        if (!ensureLoreProviderReadyForAction('Lore Assistant', 'lore')) return;
        const instruction = String(options.instruction || '').trim();
        if (!instruction) {
            toast('Enter a revision instruction first.', 'warning');
            return;
        }
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!fresh || fresh.type === 'bundled') {
            toast('Bundled Loredecks cannot be edited directly. Duplicate as Custom first.', 'warning');
            return;
        }
        const cached = loredeckAssistantDraftCache.get(fresh.packId) || {};
        const selected = getLoredeckAssistantSelectedDraftChanges(cached);
        if (!selected.length) {
            toast('Select assistant draft proposals to revise.', 'warning');
            return;
        }
        const selectedIds = new Set(selected.map(change => change.changeId));
        const context = buildLoredeckAssistantContext(fresh, rows, filteredRows, {
            instruction,
            mode: 'revise_draft_batch',
            targetScope: cached.targetScope || loredeckAssistantTargetScope,
        });
        context.task = 'Revise only the selected assistant draft proposals. Return replacement proposals for the selected drafts, not already-applied changes.';
        context.selectedDraftProposals = selected.map(compactLoredeckAssistantDraftChangeForRevision);
        const responseText = await sendLoreRequest(
            buildLoredeckAssistantSystemPrompt(),
            buildLoredeckAssistantUserPrompt(context),
            { providerKind: 'lore', maxTokens: 4096 }
        );
        const parsed = parseLoredeckAssistantResponse(responseText);
        const revisedChanges = buildLoredeckAssistantPendingChanges(fresh, parsed.proposals, rows);
        if (parsed.clarifyingQuestions.length && !revisedChanges.length) {
            updateLoredeckAssistantDraftCache(fresh.packId, current => ({
                ...current,
                summary: parsed.summary || current.summary || '',
                questions: parsed.clarifyingQuestions,
                warnings: parsed.warnings,
                updatedAt: Date.now(),
            }));
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast(`Lore Assistant needs clarification: ${parsed.clarifyingQuestions[0]}`, 'warning');
            return;
        }
        if (!revisedChanges.length) {
            updateLoredeckAssistantDraftCache(fresh.packId, current => ({
                ...current,
                summary: parsed.summary || current.summary || '',
                questions: parsed.clarifyingQuestions,
                warnings: parsed.warnings,
                updatedAt: Date.now(),
            }));
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast(parsed.warnings[0] || 'Lore Assistant returned no revised proposals.', 'warning');
            return;
        }
        updateLoredeckAssistantDraftCache(fresh.packId, current => {
            const existing = getLoredeckAssistantDraftChanges(current);
            const nextChanges = [];
            let inserted = false;
            for (const change of existing) {
                if (selectedIds.has(change.changeId)) {
                    if (!inserted) {
                        nextChanges.push(...revisedChanges);
                        inserted = true;
                    }
                    continue;
                }
                nextChanges.push(change);
            }
            if (!inserted) nextChanges.push(...revisedChanges);
            return {
                ...current,
                summary: parsed.summary || current.summary || '',
                questions: parsed.clarifyingQuestions,
                warnings: parsed.warnings,
                proposalCount: parsed.proposals.length,
                draftChanges: nextChanges,
                selectedDraftChangeIds: revisedChanges.map(change => change.changeId),
                revisedAt: Date.now(),
                updatedAt: Date.now(),
            };
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`Revised ${selected.length} selected draft proposal${selected.length === 1 ? '' : 's'} into ${revisedChanges.length} proposal${revisedChanges.length === 1 ? '' : 's'}.`, 'success');
    });
}

function openLoredeckAssistantDraftJsonEditor(pack, change = {}) {
    const existing = document.querySelector('.saga-loredeck-assistant-draft-overlay');
    existing?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-assistant-draft-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);
    const title = document.createElement('div');
    title.className = 'saga-new-lore-title';
    title.textContent = 'Edit Assistant Draft';
    shell.appendChild(title);
    const textarea = document.createElement('textarea');
    textarea.className = 'saga-continuity-json-editor saga-loredeck-assistant-draft-json';
    textarea.spellcheck = false;
    textarea.value = JSON.stringify(change, null, 2);
    addTooltip(textarea, 'Editable pending-change JSON. Save validates the draft record before replacing it in the assistant batch.');
    shell.appendChild(textarea);
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Save Draft', 'Validate and save this edited assistant draft proposal.', () => {
        try {
            const parsed = JSON.parse(textarea.value || '{}');
            const normalized = normalizeLoredeckPendingChanges([parsed])[0];
            if (!normalized) {
                toast('Edited draft is not a valid pending-change record.', 'warning');
                return;
            }
            updateLoredeckAssistantDraftCache(pack.packId, cached => {
                const wasSelected = getLoredeckAssistantSelectedDraftIds(cached).has(change.changeId);
                const draftChanges = getLoredeckAssistantDraftChanges(cached).map(item => item.changeId === change.changeId ? normalized : item);
                const selectedIds = getLoredeckAssistantSelectedDraftIds({ ...cached, draftChanges });
                selectedIds.delete(change.changeId);
                if (wasSelected) selectedIds.add(normalized.changeId);
                return {
                    ...cached,
                    draftChanges,
                    selectedDraftChangeIds: [...selectedIds],
                    updatedAt: Date.now(),
                };
            });
            overlay.remove();
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast('Assistant draft updated.', 'success');
        } catch (e) {
            toast(e?.message || 'Draft JSON is invalid.', 'error');
        }
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without saving this assistant draft edit.', () => overlay.remove()));
    shell.appendChild(actions);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => textarea.focus());
}

async function handleLoredeckAssistantDraft(pack, rows = [], filteredRows = [], options = {}, button = null) {
    await runBusyAction(button, 'Drafting...', async () => {
        if (!ensureLoreProviderReadyForAction('Lore Assistant', 'lore')) return;
        const instruction = String(options.instruction || '').trim();
        if (!instruction) {
            toast('Enter an assistant instruction first.', 'warning');
            return;
        }
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!fresh || fresh.type === 'bundled') {
            toast('Bundled Loredecks cannot be edited directly. Duplicate as Custom first.', 'warning');
            return;
        }
        const context = buildLoredeckAssistantContext(fresh, rows, filteredRows, options);
        const responseText = await sendLoreRequest(
            buildLoredeckAssistantSystemPrompt(),
            buildLoredeckAssistantUserPrompt(context),
            { providerKind: 'lore', maxTokens: 4096 }
        );
        const parsed = parseLoredeckAssistantResponse(responseText);
        const changes = buildLoredeckAssistantPendingChanges(fresh, parsed.proposals, rows);
        const qualityWarningCount = countLoredeckAssistantQualityWarningsForChanges(changes);
        loredeckAssistantDraftCache.set(fresh.packId, {
            summary: parsed.summary,
            questions: parsed.clarifyingQuestions,
            warnings: parsed.warnings,
            proposalCount: parsed.proposals.length,
            queuedCount: 0,
            draftChanges: changes,
            selectedDraftChangeIds: changes.map(change => change.changeId),
            qualityWarningCount,
            mode: options.mode || loredeckAssistantMode,
            targetScope: options.targetScope || loredeckAssistantTargetScope,
            createdAt: Date.now(),
        });
        if (parsed.clarifyingQuestions.length && !changes.length) {
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast(`Lore Assistant needs clarification: ${parsed.clarifyingQuestions[0]}`, 'warning');
            return;
        }
        if (!changes.length) {
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            toast(parsed.warnings[0] || 'Lore Assistant returned no supported proposals.', 'warning');
            return;
        }
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`Lore Assistant drafted ${changes.length} proposal${changes.length === 1 ? '' : 's'} for batch review.`, 'success');
    });
}

function buildLoredeckAssistantPendingChanges(pack, proposals = [], rows = []) {
    const changes = [];
    const rowById = new Map((rows || []).map(row => [String(row?.id || '').trim(), row]).filter(([id]) => id));
    for (const proposal of proposals || []) {
        const change = buildLoredeckAssistantPendingChange(pack, proposal, rowById);
        if (change) changes.push(change);
        if (changes.length >= 40) break;
    }
    return changes;
}

function buildLoredeckAssistantPendingChange(pack, proposal = {}, rowById = new Map()) {
    if (!proposal?.action) return null;
    if (proposal.action === 'upsert_entry') return buildLoredeckAssistantEntryChange(pack, proposal, rowById);
    if (proposal.action === 'disable_entry' || proposal.action === 'restore_entry') return buildLoredeckAssistantEntryToggleChange(proposal);
    if (proposal.action === 'upsert_tag_definition') return buildLoredeckAssistantTagChange(proposal);
    if (proposal.action === 'upsert_timeline_anchor') return buildLoredeckAssistantTimelineAnchorChange(proposal);
    if (proposal.action === 'upsert_timeline_window') return buildLoredeckAssistantTimelineWindowChange(proposal);
    return null;
}

function countLoredeckAssistantQualityWarningsForChanges(changes = []) {
    return (changes || []).reduce((total, change) => {
        const preview = change?.preview && typeof change.preview === 'object' && !Array.isArray(change.preview) ? change.preview : {};
        return total + (Array.isArray(preview.qualityWarnings) ? preview.qualityWarnings.length : 0);
    }, 0);
}

function normalizeLoredeckAssistantRubricForPreview(rubric = null) {
    if (!rubric || typeof rubric !== 'object' || Array.isArray(rubric)) return null;
    const levelFields = [
        'sceneUtility',
        'activationClarity',
        'behavioralImpact',
        'relationshipImpact',
        'conflictStakes',
        'nonRedundancy',
        'injectionQuality',
        'contextFit',
        'wikiSummaryRisk',
    ];
    const out = {};
    for (const field of levelFields) {
        const level = normalizeLoredeckPendingRubricLevel(rubric[field]);
        if (level) out[field] = level;
    }
    const notes = Array.isArray(rubric.notes)
        ? rubric.notes.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6)
        : [];
    if (notes.length) out.notes = notes;
    const warnings = Array.isArray(rubric.warnings)
        ? rubric.warnings.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6)
        : [];
    if (warnings.length) out.warnings = warnings;
    return Object.keys(out).length ? out : null;
}

function collectLoredeckAssistantLocalQualityWarnings(proposal = {}, entry = null, pack = null) {
    if (proposal.action !== 'upsert_entry' || !entry) return [];
    const warnings = [];
    const content = entry.content && typeof entry.content === 'object' && !Array.isArray(entry.content) ? entry.content : {};
    const contextGate = entry.context && typeof entry.context === 'object' && !Array.isArray(entry.context) ? entry.context : {};
    const title = String(entry.title || proposal.title || '').trim();
    const fact = String(content.fact || entry.fact || '').trim();
    const injection = String(content.injection || entry.injection || '').trim();
    const searchable = `${title} ${fact} ${injection}`;
    if (/\b(biography|summary|overview|profile|facts?|wiki|encyclopedia)\b/i.test(`${title} ${fact}`)) {
        warnings.push('Likely wiki-summary framing; verify it creates playable scene pressure or behavior.');
    }
    if (injection.length > 700) {
        warnings.push('Injection is long; consider tightening it for prompt use.');
    }
    if (!/\b(knows?|hides?|wants?|fears?|expects?|avoids?|reacts?|refuses?|pressures?|threatens?|trusts?|suspects?|believes?|lies?|reveals?|protects?|risks?|obligation|consequence|danger|leverage|taboo|rivalry|pressure|secret|misunderstands?)\b/i.test(searchable)) {
        warnings.push('Behavioral impact is unclear; check that this changes how scenes play.');
    }
    if (getExpectedLoredeckEntrySchemaVersion(pack) >= 3 && !contextGate.scope) {
        warnings.push('Context fit is unclear; schema v3 entries should have a Context scope.');
    }
    if (!getLoredeckEntryTags(entry).length) {
        warnings.push('No tags detected; review retrieval and tag coverage.');
    }
    return [...new Set(warnings)].slice(0, 6);
}

function buildLoredeckAssistantPreviewMeta(proposal = {}, base = {}, entry = null, pack = null) {
    const preview = {
        ...base,
        confidence: proposal.confidence,
        risk: proposal.risk,
    };
    const rubric = normalizeLoredeckAssistantRubricForPreview(proposal.rubric);
    if (rubric) preview.rubric = rubric;
    const localWarnings = collectLoredeckAssistantLocalQualityWarnings(proposal, entry, pack);
    const rubricWarnings = Array.isArray(rubric?.warnings) ? rubric.warnings : [];
    const warnings = [...new Set([...rubricWarnings, ...localWarnings].map(item => String(item || '').trim()).filter(Boolean))].slice(0, 8);
    if (warnings.length) preview.qualityWarnings = warnings;
    return preview;
}

function formatLoredeckAssistantProposalDescription(proposal = {}, fallback = '') {
    const reason = String(proposal.reason || '').trim();
    const rubric = normalizeLoredeckAssistantRubricForPreview(proposal.rubric);
    const notes = Array.isArray(rubric?.notes) ? rubric.notes : [];
    const parts = [reason || fallback, ...notes.map(note => `Rubric: ${note}`)];
    return parts.filter(Boolean).join(' ');
}

function buildLoredeckAssistantEntryChange(pack, proposal = {}, rowById = new Map()) {
    const rawEntry = proposal.entry && typeof proposal.entry === 'object' && !Array.isArray(proposal.entry) ? proposal.entry : null;
    if (!rawEntry) return null;
    const id = normalizeLoredeckEntryId(rawEntry.id || proposal.entryId);
    if (!id) return null;
    const row = rowById.get(id) || null;
    const baseEntry = row?.entry || {};
    const entrySchemaVersion = Math.max(Number(rawEntry.schemaVersion) || 0, Number(baseEntry.schemaVersion) || 0, getExpectedLoredeckEntrySchemaVersion(pack));
    const content = rawEntry.content && typeof rawEntry.content === 'object' && !Array.isArray(rawEntry.content) ? rawEntry.content : {};
    const baseContent = baseEntry.content && typeof baseEntry.content === 'object' && !Array.isArray(baseEntry.content) ? baseEntry.content : {};
    const fact = String(content.fact || rawEntry.fact || baseContent.fact || baseEntry.fact || rawEntry.title || baseEntry.title || id).trim();
    const injection = String(content.injection || rawEntry.injection || baseContent.injection || fact).trim();
    let entry = normalizeLoreEntry({
        ...baseEntry,
        ...rawEntry,
        id,
        title: String(rawEntry.title || baseEntry.title || id).trim(),
        category: rawEntry.category || baseEntry.category || 'other',
        canon: rawEntry.canon || rawEntry.canonStatus || baseEntry.canon || baseEntry.canonStatus || 'au',
        canonStatus: rawEntry.canonStatus || rawEntry.canon || baseEntry.canonStatus || baseEntry.canon || 'au',
        relevance: normalizeLoreRelevance(rawEntry.relevance || baseEntry.relevance || 'normal'),
        priority: Number.isFinite(Number(rawEntry.priority)) ? Number(rawEntry.priority) : (Number(baseEntry.priority) || 50),
        tags: parseLoredeckEntryTags(rawEntry.tags || baseEntry.tags || []),
        source: rawEntry.source || baseEntry.source || `saga-loredeck:${pack.packId}:assistant`,
        content: {
            ...baseContent,
            ...content,
            fact,
            injection,
            notes: String(content.notes || rawEntry.notes || baseContent.notes || '').trim(),
        },
        userEditable: true,
        userEdited: true,
        extensions: {
            ...(baseEntry.extensions || {}),
            ...(rawEntry.extensions || {}),
            sagaLoredeckOverride: {
                kind: row?.sourceEntry ? 'override' : 'addition',
                packId: pack.packId,
                sourceEntryId: row?.sourceEntry?.id || '',
                updatedAt: Date.now(),
                source: 'lore_assistant',
            },
        },
    });
    entry.id = id;
    entry.tags = parseLoredeckEntryTags(rawEntry.tags || baseEntry.tags || []);
    if (entrySchemaVersion >= 3) {
        const contextGate = rawEntry.context || baseEntry.context || {};
        const retrieval = rawEntry.retrieval || baseEntry.retrieval || {};
        const errors = validateLoredeckV3EditorFields(contextGate, retrieval);
        if (errors.length) return null;
        entry = normalizeLoredeckEntryForSchemaV3({
            ...entry,
            id,
            schemaVersion: 3,
            context: contextGate,
            retrieval,
            tags: entry.tags,
        });
        entry.tags = parseLoredeckEntryTags(rawEntry.tags || baseEntry.tags || []);
    }
    return createLoredeckRecordPatchChange({
        source: 'lore_assistant',
        action: 'assistant_upsert_entry',
        targetKind: 'entry',
        title: proposal.title || `Lore Assistant entry: ${entry.title || id}`,
        description: formatLoredeckAssistantProposalDescription(proposal, 'Lore Assistant proposed an entry change.'),
        affectedEntryIds: [id],
        payload: {
            entryOverrides: { [id]: entry },
            disabledEntryIdsRemove: [id],
        },
        preview: buildLoredeckAssistantPreviewMeta(proposal, {
            before: row?.entry?.content?.fact || row?.entry?.fact || '',
            after: entry.content?.fact || entry.fact || entry.title || id,
        }, entry, pack),
    });
}

function buildLoredeckAssistantEntryToggleChange(proposal = {}) {
    const id = String(proposal.entryId || '').trim();
    if (!id) return null;
    const restore = proposal.action === 'restore_entry';
    return createLoredeckRecordPatchChange({
        source: 'lore_assistant',
        action: restore ? 'assistant_restore_entry' : 'assistant_disable_entry',
        targetKind: 'entry',
        title: proposal.title || `${restore ? 'Restore' : 'Disable'} entry: ${id}`,
        description: formatLoredeckAssistantProposalDescription(proposal, `Lore Assistant proposed to ${restore ? 'restore' : 'disable'} this entry.`),
        affectedEntryIds: [id],
        payload: restore ? { disabledEntryIdsRemove: [id] } : { disabledEntryIdsAdd: [id] },
        preview: buildLoredeckAssistantPreviewMeta(proposal, {
            after: restore ? 'Entry will be restored.' : 'Entry will be disabled.',
        }),
    });
}

function buildLoredeckAssistantTagChange(proposal = {}) {
    const rawDef = proposal.tagDefinition && typeof proposal.tagDefinition === 'object' && !Array.isArray(proposal.tagDefinition)
        ? proposal.tagDefinition
        : {};
    const id = normalizeLoredeckTagId(rawDef.id || proposal.tagId);
    if (!id) return null;
    const def = normalizeLoredeckTagDefinition(rawDef, id);
    delete def.id;
    return createLoredeckRecordPatchChange({
        source: 'lore_assistant',
        action: 'assistant_upsert_tag_definition',
        targetKind: 'tag',
        title: proposal.title || `Lore Assistant tag: ${id}`,
        description: formatLoredeckAssistantProposalDescription(proposal, 'Lore Assistant proposed a tag definition.'),
        affectedTagIds: [id],
        payload: {
            tagDefinitions: { [id]: def },
        },
        preview: buildLoredeckAssistantPreviewMeta(proposal, {
            after: def.description || def.label || id,
        }),
    });
}

function buildLoredeckAssistantTimelineAnchorChange(proposal = {}) {
    const rawAnchor = proposal.timelineAnchor && typeof proposal.timelineAnchor === 'object' && !Array.isArray(proposal.timelineAnchor)
        ? proposal.timelineAnchor
        : {};
    const id = normalizeLoredeckTimelineId(rawAnchor.id || proposal.timelineId);
    if (!id) return null;
    const anchor = normalizeLoredeckTimelineAnchor({ ...rawAnchor, id }, id);
    if (!anchor) return null;
    return createLoredeckRecordPatchChange({
        source: 'lore_assistant',
        action: 'assistant_upsert_timeline_anchor',
        targetKind: 'timeline_anchor',
        title: proposal.title || `Lore Assistant anchor: ${id}`,
        description: formatLoredeckAssistantProposalDescription(proposal, 'Lore Assistant proposed a timeline anchor.'),
        affectedTimelineIds: [id],
        payload: {
            timelineAnchors: { [id]: anchor },
            timelineAnchorIdsEnable: [id],
        },
        preview: buildLoredeckAssistantPreviewMeta(proposal, {
            after: anchor.label || id,
        }),
    });
}

function buildLoredeckAssistantTimelineWindowChange(proposal = {}) {
    const rawWindow = proposal.timelineWindow && typeof proposal.timelineWindow === 'object' && !Array.isArray(proposal.timelineWindow)
        ? proposal.timelineWindow
        : {};
    const id = normalizeLoredeckTimelineId(rawWindow.id || proposal.timelineId);
    if (!id) return null;
    const windowDef = normalizeLoredeckTimelineWindow({ ...rawWindow, id }, id);
    if (!windowDef) return null;
    return createLoredeckRecordPatchChange({
        source: 'lore_assistant',
        action: 'assistant_upsert_timeline_window',
        targetKind: 'timeline_window',
        title: proposal.title || `Lore Assistant window: ${id}`,
        description: formatLoredeckAssistantProposalDescription(proposal, 'Lore Assistant proposed a timeline window.'),
        affectedTimelineIds: [id, windowDef.anchorFrom, windowDef.anchorTo].filter(Boolean),
        payload: {
            timelineWindows: { [id]: windowDef },
            timelineWindowIdsEnable: [id],
        },
        preview: buildLoredeckAssistantPreviewMeta(proposal, {
            after: windowDef.label || `${windowDef.anchorFrom || '?'} -> ${windowDef.anchorTo || '?'}`,
        }),
    });
}

function saveLoredeckTimelineAnchorDefinition(pack, anchor, message = '') {
    const id = normalizeLoredeckTimelineId(anchor?.id);
    if (!id) {
        toast('Timeline anchor needs a valid ID.', 'warning');
        return false;
    }
    const def = normalizeLoredeckTimelineAnchor({ ...anchor, id }, id);
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_timeline_anchor',
        targetKind: 'timeline_anchor',
        title: `Save timeline anchor: ${id}`,
        description: 'Creates or updates a Custom timeline anchor overlay after review.',
        affectedTimelineIds: [id],
        payload: {
            timelineAnchors: { [id]: def },
            timelineAnchorIdsEnable: [id],
        },
        preview: {
            after: def.label || id,
        },
    }), message || `Queued timeline anchor for ${id}.`);
}

function saveLoredeckTimelineWindowDefinition(pack, windowDef, message = '') {
    const id = normalizeLoredeckTimelineId(windowDef?.id);
    if (!id) {
        toast('Timeline window needs a valid ID.', 'warning');
        return false;
    }
    const def = normalizeLoredeckTimelineWindow({ ...windowDef, id }, id);
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_timeline_window',
        targetKind: 'timeline_window',
        title: `Save timeline window: ${id}`,
        description: 'Creates or updates a Custom timeline window overlay after review.',
        affectedTimelineIds: [id, def.anchorFrom, def.anchorTo].filter(Boolean),
        payload: {
            timelineWindows: { [id]: def },
            timelineWindowIdsEnable: [id],
        },
        preview: {
            after: def.label || `${def.anchorFrom || '?'} -> ${def.anchorTo || '?'}`,
        },
    }), message || `Queued timeline window for ${id}.`);
}

function removeLoredeckTimelineDefinition(pack, kind = 'anchor', id = '') {
    const cleanId = normalizeLoredeckTimelineId(id);
    if (!cleanId) return false;
    const isWindow = kind === 'window';
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: isWindow ? 'remove_timeline_window' : 'remove_timeline_anchor',
        targetKind: isWindow ? 'timeline_window' : 'timeline_anchor',
        title: `Forget timeline ${isWindow ? 'window' : 'anchor'}: ${cleanId}`,
        description: 'Removes the Custom timeline overlay after review. Source definitions remain unless disabled.',
        affectedTimelineIds: [cleanId],
        payload: isWindow
            ? { timelineWindows: { [cleanId]: null } }
            : { timelineAnchors: { [cleanId]: null } },
        preview: {
            after: 'Custom timeline overlay will be removed.',
        },
    }), `Queued timeline overlay removal for ${cleanId}.`);
}

function setLoredeckTimelineItemDisabled(pack, kind = 'anchor', id = '', disabled = true) {
    const cleanId = normalizeLoredeckTimelineId(id);
    if (!cleanId) return false;
    const isWindow = kind === 'window';
    const payload = isWindow
        ? {
            timelineWindowIdsDisable: disabled ? [cleanId] : [],
            timelineWindowIdsEnable: disabled ? [] : [cleanId],
        }
        : {
            timelineAnchorIdsDisable: disabled ? [cleanId] : [],
            timelineAnchorIdsEnable: disabled ? [] : [cleanId],
        };
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: disabled ? 'disable_timeline_definition' : 'enable_timeline_definition',
        targetKind: isWindow ? 'timeline_window' : 'timeline_anchor',
        title: `${disabled ? 'Disable' : 'Enable'} timeline ${isWindow ? 'window' : 'anchor'}: ${cleanId}`,
        description: `${disabled ? 'Suppresses' : 'Restores'} this timeline definition after review.`,
        affectedTimelineIds: [cleanId],
        payload,
        preview: {
            after: disabled ? 'Definition will be disabled in this Custom overlay.' : 'Definition will be restored in this Custom overlay.',
        },
    }), `Queued timeline ${disabled ? 'disable' : 'enable'} for ${cleanId}.`);
}

function openLoredeckTimelineAnchorDialog(pack, item = null) {
    if (pack.type === 'bundled') {
        toast('Bundled Loredeck timelines are read-only. Duplicate as Custom first.', 'warning');
        return;
    }
    const existing = document.querySelector('.saga-loredeck-timeline-overlay');
    existing?.remove();

    const definition = normalizeLoredeckTimelineAnchor(item?.definition || {}, item?.id || '') || {};
    const isExisting = !!definition?.id;
    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-timeline-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = isExisting ? 'Edit Timeline Anchor' : 'New Timeline Anchor';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${pack.title || pack.packId} | Pending timeline proposal`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without saving this timeline anchor.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-entry-override-form';
    shell.appendChild(form);

    const idInput = createNewLoreInput(form, 'Anchor ID', 'Stable Context anchor ID.', definition.id || '', false, 'one-piece.arlong_park.nami_breaks_down');
    idInput.disabled = isExisting;
    const labelInput = createNewLoreInput(form, 'Label', 'Human-readable anchor label.', definition.label || '', false, 'Nami asks Luffy for help');
    const sortKeyInput = createNewLoreInput(form, 'Sort Key', 'Numeric order inside this Loredeck timeline.', getLoredeckEntryEditorNumberText(definition.sortKey), false, '1200');
    sortKeyInput.inputMode = 'decimal';

    const grid = appendLoredeckEntryEditorSection(form, 'Coordinates');
    const dateFromInput = createNewLoreInput(grid, 'Date From', 'Optional date/year/stardate lower bound.', definition.dateRange?.from || '', false, '1995-09-01');
    const dateToInput = createNewLoreInput(grid, 'Date To', 'Optional date/year/stardate upper bound.', definition.dateRange?.to || '', false, '1996-06-30');
    const precisionInput = createNewLoreInput(grid, 'Date Precision', 'Optional precision label.', definition.dateRange?.precision || '', false, 'day');
    const arcInput = createNewLoreInput(grid, 'Arc', 'Optional arc label.', definition.arc || '', false, 'Arlong Park');
    const phaseInput = createNewLoreInput(grid, 'Phase', 'Optional phase/saga label.', definition.phase || '', false, 'East Blue Saga');
    const seasonInput = createNewLoreInput(grid, 'Season', 'Optional season number or label.', definition.season || '', false, '1');
    const episodeInput = createNewLoreInput(grid, 'Episode', 'Optional episode number or label.', definition.episode || '', false, '37');
    const chapterInput = createNewLoreInput(grid, 'Chapter', 'Optional chapter/issue number.', definition.chapter || definition.issue || '', false, '81');
    const aliasesInput = createNewLoreInput(form, 'Aliases', 'Comma-separated local resolver aliases.', (definition.aliases || []).join(', '), false, 'help me, Nami cries, Arlong Park climax');
    const tagsInput = createNewLoreInput(form, 'Tags', 'Comma-separated timeline tags.', (definition.tags || []).join(', '), false, 'arc:arlong-park, event:turning-point');
    const notesInput = createNewLoreInput(form, 'Notes', 'Private notes for this timeline anchor.', definition.notes || '', true, 'Why this anchor matters.');

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Queue Anchor', 'Queue this timeline anchor for Pending Review.', () => {
        const id = isExisting ? definition.id : normalizeLoredeckTimelineId(idInput.value);
        if (!id || !labelInput.value.trim()) {
            toast('Timeline anchor needs an ID and label.', 'warning');
            return;
        }
        const sortKey = normalizeLoredeckTimelineNumber(sortKeyInput.value);
        if (sortKey === null) {
            toast('Timeline anchor needs a numeric sort key.', 'warning');
            return;
        }
        const saved = saveLoredeckTimelineAnchorDefinition(pack, {
            id,
            label: labelInput.value.trim(),
            sortKey,
            dateRange: {
                from: dateFromInput.value.trim(),
                to: dateToInput.value.trim(),
                precision: precisionInput.value.trim(),
            },
            arc: arcInput.value.trim(),
            phase: phaseInput.value.trim(),
            season: seasonInput.value.trim(),
            episode: episodeInput.value.trim(),
            chapter: chapterInput.value.trim(),
            aliases: normalizeLoredeckTimelineTextList(aliasesInput.value, 64),
            tags: normalizeLoredeckTimelineTextList(tagsInput.value, 64),
            notes: notesInput.value.trim(),
        }, `Queued timeline anchor ${id}.`);
        if (saved) overlay.remove();
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without saving this timeline anchor.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => (isExisting ? labelInput : idInput).focus());
}

function openLoredeckTimelineWindowDialog(pack, item = null) {
    if (pack.type === 'bundled') {
        toast('Bundled Loredeck timelines are read-only. Duplicate as Custom first.', 'warning');
        return;
    }
    const existing = document.querySelector('.saga-loredeck-timeline-overlay');
    existing?.remove();

    const definition = normalizeLoredeckTimelineWindow(item?.definition || {}, item?.id || '') || {};
    const isExisting = !!definition?.id;
    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-timeline-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = isExisting ? 'Edit Timeline Window' : 'New Timeline Window';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${pack.title || pack.packId} | Pending timeline proposal`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without saving this timeline window.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-entry-override-form';
    shell.appendChild(form);

    const idInput = createNewLoreInput(form, 'Window ID', 'Stable Context window ID.', definition.id || '', false, 'one-piece.arlong_park.full_arc');
    idInput.disabled = isExisting;
    const labelInput = createNewLoreInput(form, 'Label', 'Human-readable timeline window label.', definition.label || '', false, 'Arlong Park Arc');

    const grid = appendLoredeckEntryEditorSection(form, 'Bounds');
    const fromInput = createNewLoreInput(grid, 'From Anchor', 'Starting anchor ID.', definition.anchorFrom || '', false, 'one-piece.arlong_park.arrival');
    const toInput = createNewLoreInput(grid, 'To Anchor', 'Ending anchor ID.', definition.anchorTo || '', false, 'one-piece.arlong_park.departure');
    const sortFromInput = createNewLoreInput(grid, 'Sort From', 'Numeric lower bound for this window.', getLoredeckEntryEditorNumberText(definition.sortKeyFrom), false, '1100');
    const sortToInput = createNewLoreInput(grid, 'Sort To', 'Numeric upper bound for this window.', getLoredeckEntryEditorNumberText(definition.sortKeyTo), false, '1299');
    sortFromInput.inputMode = 'decimal';
    sortToInput.inputMode = 'decimal';
    const dateFromInput = createNewLoreInput(grid, 'Date From', 'Optional date/year/stardate lower bound.', definition.dateRange?.from || '', false, '1995-09-01');
    const dateToInput = createNewLoreInput(grid, 'Date To', 'Optional date/year/stardate upper bound.', definition.dateRange?.to || '', false, '1996-06-30');
    const precisionInput = createNewLoreInput(grid, 'Date Precision', 'Optional precision label.', definition.dateRange?.precision || '', false, 'arc');
    const aliasesInput = createNewLoreInput(form, 'Aliases', 'Comma-separated local resolver aliases.', (definition.aliases || []).join(', '), false, 'Arlong Park, Nami arc');
    const tagsInput = createNewLoreInput(form, 'Tags', 'Comma-separated timeline tags.', (definition.tags || []).join(', '), false, 'arc:arlong-park, saga:east-blue');
    const notesInput = createNewLoreInput(form, 'Notes', 'Private notes for this timeline window.', definition.notes || '', true, 'Window authoring notes.');

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Queue Window', 'Queue this timeline window for Pending Review.', () => {
        const id = isExisting ? definition.id : normalizeLoredeckTimelineId(idInput.value);
        if (!id || !labelInput.value.trim()) {
            toast('Timeline window needs an ID and label.', 'warning');
            return;
        }
        const sortKeyFrom = normalizeLoredeckTimelineNumber(sortFromInput.value);
        const sortKeyTo = normalizeLoredeckTimelineNumber(sortToInput.value);
        if (sortKeyFrom === null || sortKeyTo === null) {
            toast('Timeline window needs numeric sort bounds.', 'warning');
            return;
        }
        if (sortKeyFrom > sortKeyTo) {
            toast('Timeline window sort start cannot be after sort end.', 'warning');
            return;
        }
        const anchorFrom = normalizeLoredeckTimelineId(fromInput.value);
        const anchorTo = normalizeLoredeckTimelineId(toInput.value);
        const saved = saveLoredeckTimelineWindowDefinition(pack, {
            id,
            label: labelInput.value.trim(),
            anchorFrom,
            anchorTo,
            sortKeyFrom,
            sortKeyTo,
            dateRange: {
                from: dateFromInput.value.trim(),
                to: dateToInput.value.trim(),
                precision: precisionInput.value.trim(),
            },
            aliases: normalizeLoredeckTimelineTextList(aliasesInput.value, 64),
            tags: normalizeLoredeckTimelineTextList(tagsInput.value, 64),
            notes: notesInput.value.trim(),
        }, `Queued timeline window ${id}.`);
        if (saved) overlay.remove();
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without saving this timeline window.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => (isExisting ? labelInput : idInput).focus());
}

function createLoredeckTagManagerCard(pack, rows = [], filteredRows = []) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-loredeck-manifest-preview';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Tag Manager';
    wrap.appendChild(title);

    const sourceCache = loredeckTagRegistryCache.get(pack.packId);
    const customRegistry = getLoredeckEmbeddedTagRegistry(pack);
    const allItems = buildLoredeckTagManagerItems(pack, rows);
    const registryCount = allItems.filter(item => item.sourceDefined || item.customDefined).length;
    const undefinedCount = allItems.filter(item => item.count && !item.sourceDefined && !item.customDefined).length;
    const targetRows = loredeckEntryOverrideQuery ? filteredRows : rows;
    const editableTargetCount = getLoredeckEntryRowsForBulk(targetRows).length;

    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    summary.appendChild(createStatusPill(`${registryCount} defined`, 'Tags defined by source tags.json or this Custom Loredeck registry layer.'));
    summary.appendChild(createStatusPill(`${undefinedCount} undefined`, 'Entry tags currently used but not defined by a loaded registry.'));
    summary.appendChild(createStatusPill(`${allItems.length} visible`, 'Total registry and entry-discovered tags in this manager.'));
    summary.appendChild(createStatusPill(`${editableTargetCount} target entr${editableTargetCount === 1 ? 'y' : 'ies'}`, 'Entries affected by bulk tag actions. Current entry search narrows this target set.'));
    if (sourceCache?.loadedAt && !sourceCache.missing && !sourceCache.error) summary.appendChild(createStatusPill('tags.json loaded', 'Source tag registry has been fetched for this editor session.'));
    if (sourceCache?.missing) summary.appendChild(createStatusPill('no source registry', 'The manifest does not currently declare registries.tags.'));
    if (getLoredeckTagRegistryCount(customRegistry)) summary.appendChild(createStatusPill('custom registry', 'This Loredeck has saved editable tag registry metadata.'));
    if (loredeckEntryOverrideQuery) summary.appendChild(createStatusPill('Search scoped', 'Bulk tag actions will target the current entry search result.'));
    wrap.appendChild(summary);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = pack.type === 'bundled'
        ? 'Bundled tag registries are read-only here. Duplicate this pack as Custom to define, rename, or deprecate tags.'
        : 'Registry definitions are saved in this Custom Loredeck record. Entry tag changes still use Custom overrides.';
    wrap.appendChild(help);
    if (sourceCache?.error) {
        wrap.appendChild(createKeyValue('Registry Load Error', sourceCache.error, 'Last tags.json load error for this Loredeck.'));
    }

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    const loadRegistry = createButton('Load Registry', 'Fetch source tags.json for this Loredeck if the manifest declares one.', async (btn) => {
        await loadLoredeckTagRegistryForEditor(pack, btn);
    });
    loadRegistry.disabled = !pack.manifest;
    actions.appendChild(loadRegistry);
    const newTag = createButton('New Tag', 'Create a new tag definition in this Custom Loredeck registry.', () => {
        openLoredeckTagRegistryDialog(pack, null);
    }, 'saga-primary-button');
    newTag.disabled = pack.type === 'bundled';
    actions.appendChild(newTag);
    const bulk = createButton('Bulk Tags', 'Add, remove, or rename tags for the current target entries.', () => {
        openLoredeckBulkTagsDialog(pack, targetRows);
    });
    bulk.disabled = !editableTargetCount;
    actions.appendChild(bulk);
    const exportButton = createButton('Export Registry', 'Download the currently merged tag registry as tags.json.', () => {
        downloadJson(buildMergedLoredeckTagRegistryForExport(pack, rows), `${sanitizeFileStem(pack.packId || 'saga-loredeck')}.tags.json`);
        toast('Tag registry exported.', 'info');
    });
    exportButton.disabled = !registryCount;
    actions.appendChild(exportButton);
    wrap.appendChild(actions);

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'saga-loredeck-entry-search';
    search.placeholder = 'Search tags...';
    search.value = loredeckTagManagerQuery || '';
    addTooltip(search, 'Search tags by namespace or label.');
    search.addEventListener('click', e => e.stopPropagation());
    search.addEventListener('mousedown', e => e.stopPropagation());
    search.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        loredeckTagManagerQuery = search.value;
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    search.addEventListener('change', () => {
        loredeckTagManagerQuery = search.value;
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    wrap.appendChild(search);

    const q = String(loredeckTagManagerQuery || '').trim().toLowerCase();
    const visible = allItems
        .filter(item => {
            if (!q) return true;
            const def = item.definition || {};
            return [
                item.tag,
                def.label,
                def.description,
                ...(Array.isArray(def.aliases) ? def.aliases : []),
                ...(Array.isArray(def.parents) ? def.parents : []),
                def.replacement,
                item.registryState,
            ].filter(Boolean).join(' ').toLowerCase().includes(q);
        })
        .slice(0, 24);

    if (!visible.length) {
        wrap.appendChild(createEmptyMessage(allItems.length ? 'No matching tags.' : 'No tags found. Load entries, load tags.json, or create a new tag definition.'));
        return wrap;
    }

    const list = document.createElement('div');
    list.className = 'saga-loredeck-entry-list';
    for (const item of visible) {
        list.appendChild(createLoredeckTagManagerRow(pack, rows, item));
    }
    if (visible.length < allItems.length) {
        const more = document.createElement('div');
        more.className = 'saga-runtime-help';
        more.textContent = `Showing ${visible.length} of ${allItems.length} tags. Search to narrow the list.`;
        list.appendChild(more);
    }
    wrap.appendChild(list);
    return wrap;
}

function createLoredeckTagManagerRow(pack, rows = [], item = {}) {
    const row = document.createElement('div');
    row.className = 'saga-loredeck-entry-row';

    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = item.tag || 'tag';
    main.appendChild(title);
    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    const def = item.definition || {};
    const label = def.label || humanizeLoredeckTagId(item.tag);
    const description = def.description || `${item.count || 0} entr${item.count === 1 ? 'y' : 'ies'} use this tag.`;
    desc.textContent = `${label}${description ? ` | ${description}` : ''}`;
    main.appendChild(desc);
    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(`${item.count || 0} total`, 'Total entries with this tag.'));
    if (item.overrideCount) meta.appendChild(createStatusPill(`${item.overrideCount} override${item.overrideCount === 1 ? '' : 's'}`, 'Saved overrides using this tag.'));
    if (item.sourceCount) meta.appendChild(createStatusPill(`${item.sourceCount} source`, 'Source entries using this tag.'));
    meta.appendChild(createStatusPill(item.registryState || 'undefined', 'Registry definition source for this tag.'));
    if (def.deprecated) meta.appendChild(createStatusPill('deprecated', def.replacement ? `Replacement: ${def.replacement}` : 'Tag is marked deprecated.'));
    if (def.sensitive) meta.appendChild(createStatusPill('sensitive', 'Tag marks sensitive, secret, or spoiler-prone lore.'));
    if (Array.isArray(def.aliases) && def.aliases.length) meta.appendChild(createStatusPill(`${def.aliases.length} alias${def.aliases.length === 1 ? '' : 'es'}`, 'Search aliases defined for this tag.'));
    main.appendChild(meta);
    row.appendChild(main);

    const tagRows = rows.filter(entryRow => getLoredeckEntryTags(entryRow.entry || {}).some(tag => tag.toLowerCase() === String(item.tag || '').toLowerCase()));
    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    const filterButton = createButton('Filter', 'Filter entry rows to this tag.', () => {
        loredeckEntryOverrideQuery = item.tag || '';
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    filterButton.disabled = !(item.count || 0);
    actions.appendChild(filterButton);
    const editButton = createButton(item.sourceDefined || item.customDefined ? 'Edit Def' : 'Define', 'Edit this tag definition in the Custom registry layer.', () => {
        openLoredeckTagRegistryDialog(pack, item);
    });
    editButton.disabled = pack.type === 'bundled';
    actions.appendChild(editButton);
    const renameButton = createButton('Rename', 'Rename this tag across entries that currently use it.', () => {
        openLoredeckTagRenameDialog(pack, tagRows, item);
    });
    renameButton.disabled = pack.type === 'bundled';
    actions.appendChild(renameButton);
    const removeEntriesButton = createButton('Remove Entries', 'Remove this tag across entries that currently use it.', () => {
        openLoredeckBulkTagsDialog(pack, tagRows, { mode: 'remove', removeTags: item.tag || '' });
    }, 'saga-danger-button');
    removeEntriesButton.disabled = pack.type === 'bundled' || !tagRows.length;
    actions.appendChild(removeEntriesButton);
    if (item.customDefined) {
        actions.appendChild(createButton('Forget Def', 'Remove the saved Custom registry definition without changing entry tags.', () => {
            removeLoredeckTagRegistryDefinition(pack, item.tag);
        }, 'saga-danger-button'));
    }
    row.appendChild(actions);
    return row;
}

function getLoredeckEditableEntryRows(pack, sourceEntries = []) {
    const state = getLoredeckOverrideState(pack);
    const sourceMap = new Map();
    for (const entry of sourceEntries || []) {
        const id = String(entry?.id || '').trim();
        if (!id || sourceMap.has(id)) continue;
        sourceMap.set(id, entry);
    }

    const ids = new Set([
        ...sourceMap.keys(),
        ...Object.keys(state.overrides),
        ...state.disabledEntryIds,
    ]);
    return Array.from(ids).map(id => {
        const sourceEntry = sourceMap.get(id) || null;
        const overrideEntry = state.overrides[id] || null;
        const disabled = state.disabledSet.has(id);
        const entry = overrideEntry || sourceEntry || { id, title: id };
        const status = disabled
            ? 'disabled'
            : overrideEntry && sourceEntry
                ? 'overridden'
                : overrideEntry
                    ? 'added'
                    : 'source';
        return { id, entry, sourceEntry, overrideEntry, disabled, status };
    }).sort((a, b) => {
        const order = { overridden: 0, added: 1, disabled: 2, source: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9)
            || String(a.entry.title || a.id).localeCompare(String(b.entry.title || b.id));
    });
}

function filterLoredeckEditableEntryRows(rows, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row => {
        const entry = row.entry || {};
        return [
            row.id,
            row.status,
            entry.title,
            entry.fact,
            entry.content?.fact,
            entry.content?.injection,
            entry.category,
            entry.canon || entry.canonStatus,
            ...(Array.isArray(entry.tags) ? entry.tags : []),
        ].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
}

function createLoredeckEntryOverrideRow(pack, row) {
    const wrap = document.createElement('div');
    wrap.className = `saga-loredeck-entry-row saga-loredeck-entry-row-${row.status}`.trim();
    const main = document.createElement('div');
    main.className = 'saga-loredeck-row-main';
    const title = document.createElement('div');
    title.className = 'saga-loredeck-row-title';
    title.textContent = row.entry?.title || row.id;
    main.appendChild(title);

    const desc = document.createElement('div');
    desc.className = 'saga-loredeck-row-description';
    desc.textContent = truncateText(row.entry?.fact || row.entry?.content?.fact || row.entry?.content?.notes || row.id, 180);
    main.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'saga-loredeck-row-meta';
    meta.appendChild(createStatusPill(row.status, 'Entry override status in this Custom Loredeck.'));
    meta.appendChild(createStatusPill(row.id, 'Lore entry ID.'));
    if (row.entry?.category) meta.appendChild(createStatusPill(row.entry.category, 'Entry category.'));
    if (row.entry?.relevance) meta.appendChild(createStatusPill(row.entry.relevance, 'Entry relevance tier.'));
    if (row.entry?.context?.label) meta.appendChild(createStatusPill(row.entry.context.label, 'Context label for this entry.'));
    if (row.entry?.retrieval?.activation) meta.appendChild(createStatusPill(row.entry.retrieval.activation, 'Retrieval activation mode.'));
    main.appendChild(meta);
    wrap.appendChild(main);

    const actions = document.createElement('div');
    actions.className = 'saga-loredeck-row-actions';
    actions.appendChild(createButton('Edit', 'Edit or create an override for this entry.', () => {
        openLoredeckEntryOverrideDialog(pack, row);
    }, row.overrideEntry ? 'saga-primary-button' : ''));
    actions.appendChild(createButton(row.disabled ? 'Restore' : 'Disable', row.disabled ? 'Restore this source/custom entry.' : 'Suppress this entry inside this Custom Loredeck.', () => {
        setLoredeckEntryDisabled(pack, row.id, !row.disabled);
    }));
    if (row.overrideEntry) {
        actions.appendChild(createButton('Remove Override', 'Remove the saved override. Source entry remains unless disabled.', () => {
            removeLoredeckEntryOverride(pack, row.id);
        }, 'saga-danger-button'));
    }
    wrap.appendChild(actions);
    return wrap;
}

function entryListFromLoredeckFileJson(json) {
    if (Array.isArray(json?.entries)) return json.entries;
    if (Array.isArray(json)) return json;
    return [];
}

async function fetchJsonForLoredeckEditor(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
        return await response.json();
    } catch (e) {
        throw new Error(e?.message || 'Invalid JSON');
    }
}

async function fetchLoredeckEntryFilesForEditor(pack, manifest = null, baseUrl = null) {
    const displayManifest = manifest || await getDisplayManifestForPack(pack, { requireFetch: !canUseVirtualLoredeckData(pack) });
    if (canUseVirtualLoredeckData(pack) && !baseUrl) {
        return buildGeneratedLoredeckEntryCache(refreshGeneratedLoredeckDerivedMetadata(cloneLoredeckJson(pack) || { ...pack }), displayManifest);
    }
    const resolvedBaseUrl = baseUrl || resolveManifestUrlForFetch(pack.manifest);
    if (!resolvedBaseUrl) throw new Error('Loredeck needs a fetchable base manifest path to load entries.');
    const entries = [];
    const entryFiles = [];
    for (const file of Array.isArray(displayManifest.files) ? displayManifest.files : []) {
        const filePath = String(file || '').trim();
        if (!filePath) continue;
        try {
            const json = await fetchJsonForLoredeckEditor(new URL(filePath, resolvedBaseUrl));
            const fileEntries = entryListFromLoredeckFileJson(json)
                .filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry))
                .map(entry => ({
                    ...entry,
                    schemaVersion: entry.schemaVersion || json?.schemaVersion || displayManifest.entrySchemaVersion || 2,
                    extensions: {
                        ...(entry.extensions || {}),
                        sagaLoredeckSourceFile: filePath,
                    },
                }));
            entries.push(...fileEntries);
            entryFiles.push({
                file: filePath,
                url: new URL(filePath, resolvedBaseUrl),
                ok: true,
                json,
                entries: fileEntries,
                schemaVersion: json?.schemaVersion || displayManifest.entrySchemaVersion || 2,
            });
        } catch (e) {
            console.warn('[Saga] Loredeck entry file failed in editor:', filePath, e);
            entryFiles.push({
                file: filePath,
                url: null,
                ok: false,
                json: null,
                entries: [],
                schemaVersion: 0,
                error: e?.message || 'Entry file failed to load.',
            });
        }
    }
    return { manifest: displayManifest, baseUrl: resolvedBaseUrl, entries, entryFiles };
}

async function fetchLoredeckTimelineForEditor(manifest = {}, baseUrl = null) {
    if (!baseUrl) return null;
    const registries = manifest?.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    const ref = String(registries.timeline || manifest.timeline || '').trim();
    if (!ref) return null;
    return fetchJsonForLoredeckEditor(new URL(ref, baseUrl));
}

async function loadLoredeckTimelineRegistryForEditor(pack, button = null, options = {}) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Loading...';
    }
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        const manifest = options.manifest || await getDisplayManifestForPack(fresh, { requireFetch: !canUseVirtualLoredeckData(fresh) });
        const baseUrl = options.baseUrl || resolveManifestUrlForFetch(fresh.manifest);
        if (!baseUrl && canUseVirtualLoredeckData(fresh)) {
            const sourceRegistry = normalizeLoredeckTimelineRegistry(fresh.timelineRegistry);
            loredeckTimelineRegistryCache.set(fresh.packId, {
                sourceRegistry,
                error: '',
                missing: !getLoredeckTimelineRegistryCount(sourceRegistry),
                loadedAt: Date.now(),
            });
            if (options.quiet !== true) {
                const count = getLoredeckTimelineRegistryCount(sourceRegistry);
                toast(count ? `Loaded ${count} local timeline definition${count === 1 ? '' : 's'}.` : 'This Loredeck does not have local timeline definitions yet.', count ? 'success' : 'info');
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            }
            return sourceRegistry;
        }
        if (!baseUrl) throw new Error('Loredeck needs a fetchable base manifest path to load timeline.json.');
        const registryJson = await fetchLoredeckTimelineForEditor(manifest, baseUrl);
        const sourceRegistry = normalizeLoredeckTimelineRegistry(registryJson);
        loredeckTimelineRegistryCache.set(fresh.packId, {
            sourceRegistry,
            error: '',
            missing: !registryJson,
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            const count = getLoredeckTimelineRegistryCount(sourceRegistry);
            toast(registryJson ? `Loaded ${count} timeline definition${count === 1 ? '' : 's'} from timeline.json.` : 'This Loredeck does not declare timeline.json yet.', registryJson ? 'success' : 'info');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return sourceRegistry;
    } catch (e) {
        loredeckTimelineRegistryCache.set(String(pack.packId || '').trim(), {
            sourceRegistry: normalizeLoredeckTimelineRegistry(null),
            error: e?.message || 'timeline.json failed to load.',
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            toast(e?.message || 'timeline.json failed to load.', 'error');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return normalizeLoredeckTimelineRegistry(null);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Load Timeline';
        }
    }
}

async function fetchLoredeckTagRegistryForEditor(manifest = {}, baseUrl = null) {
    if (!baseUrl) return null;
    const registries = manifest?.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
        ? manifest.registries
        : {};
    const ref = String(
        typeof registries.tags === 'string'
            ? registries.tags
            : (typeof manifest.tagRegistry === 'string' ? manifest.tagRegistry : '')
    ).trim();
    if (!ref) return null;
    return fetchJsonForLoredeckEditor(new URL(ref, baseUrl));
}

async function loadLoredeckTagRegistryForEditor(pack, button = null, options = {}) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Loading...';
    }
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        const manifest = options.manifest || await getDisplayManifestForPack(fresh, { requireFetch: !canUseVirtualLoredeckData(fresh) });
        const baseUrl = options.baseUrl || resolveManifestUrlForFetch(fresh.manifest);
        if (!baseUrl && canUseVirtualLoredeckData(fresh)) {
            const sourceRegistry = normalizeLoredeckTagRegistry(fresh.tagRegistry);
            loredeckTagRegistryCache.set(fresh.packId, {
                sourceRegistry,
                error: '',
                missing: !getLoredeckTagRegistryCount(sourceRegistry),
                loadedAt: Date.now(),
            });
            if (options.quiet !== true) {
                const count = getLoredeckTagRegistryCount(sourceRegistry);
                toast(count ? `Loaded ${count} local tag definition${count === 1 ? '' : 's'}.` : 'This Loredeck does not have local tag definitions yet.', count ? 'success' : 'info');
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            }
            return sourceRegistry;
        }
        if (!baseUrl) throw new Error('Loredeck needs a fetchable base manifest path to load tags.json.');
        const registryJson = await fetchLoredeckTagRegistryForEditor(manifest, baseUrl);
        const sourceRegistry = normalizeLoredeckTagRegistry(registryJson);
        loredeckTagRegistryCache.set(fresh.packId, {
            sourceRegistry,
            error: '',
            missing: !registryJson,
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            const count = getLoredeckTagRegistryCount(sourceRegistry);
            toast(registryJson ? `Loaded ${count} tag definition${count === 1 ? '' : 's'} from tags.json.` : 'This Loredeck does not declare tags.json yet.', registryJson ? 'success' : 'info');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return sourceRegistry;
    } catch (e) {
        loredeckTagRegistryCache.set(String(pack.packId || '').trim(), {
            sourceRegistry: { schemaVersion: 1, tags: {} },
            error: e?.message || 'tags.json failed to load.',
            loadedAt: Date.now(),
        });
        if (options.quiet !== true) {
            toast(e?.message || 'tags.json failed to load.', 'error');
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        }
        return { schemaVersion: 1, tags: {} };
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Load Registry';
        }
    }
}

async function loadLoredeckEntriesForEditor(pack, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Loading...';
    }
    try {
        const { manifest, baseUrl, entries, entryFiles } = await fetchLoredeckEntryFilesForEditor(pack);
        await loadLoredeckTimelineRegistryForEditor(pack, null, { manifest, baseUrl, quiet: true });
        await loadLoredeckTagRegistryForEditor(pack, null, { manifest, baseUrl, quiet: true });
        loredeckEntryPreviewCache.set(pack.packId, {
            entries,
            entryFiles,
            error: '',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`${entries.length} entries loaded for ${pack.title || pack.packId}.`, entries.length ? 'success' : 'warning');
        return entries;
    } catch (e) {
        loredeckEntryPreviewCache.set(pack.packId, {
            entries: [],
            error: e?.message || 'Entry load failed.',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(e?.message || 'Entry load failed.', 'error');
        return [];
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Load Entries';
        }
    }
}

async function loadLoredeckManifestPreview(pack, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Inspecting...';
    }
    try {
        const manifest = await getDisplayManifestForPack(pack, { requireFetch: !canUseVirtualLoredeckData(pack) });
        loredeckManifestPreviewCache.set(pack.packId, {
            manifest,
            error: '',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`${pack.title || pack.packId} manifest inspected.`, 'success');
        return manifest;
    } catch (e) {
        loredeckManifestPreviewCache.set(pack.packId, {
            manifest: null,
            error: e?.message || 'Manifest inspection failed.',
            loadedAt: Date.now(),
        });
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(e?.message || 'Manifest inspection failed.', 'error');
        return null;
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Inspect Manifest';
        }
    }
}

function getCachedLoredeckManifest(packId) {
    const cached = loredeckManifestPreviewCache.get(String(packId || '').trim());
    return cached?.manifest && typeof cached.manifest === 'object' && !Array.isArray(cached.manifest)
        ? cached.manifest
        : null;
}

function getExpectedLoredeckEntrySchemaVersion(pack = {}, manifest = null) {
    const cachedManifest = manifest || getCachedLoredeckManifest(pack.packId);
    const candidates = [
        cachedManifest?.entrySchemaVersion,
        pack.entrySchemaVersion,
        pack.manifestData?.entrySchemaVersion,
    ];
    for (const raw of candidates) {
        const version = Number(raw);
        if (Number.isFinite(version) && version > 0) return version;
    }
    return 2;
}

function cacheLoredeckValidation(packId, manifest, entryCache, health) {
    const cachedManifest = loredeckManifestPreviewCache.get(packId) || {};
    loredeckManifestPreviewCache.set(packId, {
        ...cachedManifest,
        manifest,
        health,
        error: '',
        loadedAt: Date.now(),
    });
    const cachedEntries = loredeckEntryPreviewCache.get(packId) || {};
    loredeckEntryPreviewCache.set(packId, {
        ...cachedEntries,
        ...(entryCache || {}),
        health,
        error: '',
        loadedAt: Date.now(),
    });
}

async function validateLoredeckForEditor(pack, button = null, options = {}) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Validating...';
    }
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!canValidateLoredeckInEditor(fresh)) throw new Error('Loredeck needs a fetchable manifest path or accepted generated data to validate.');
        const virtualData = canUseVirtualLoredeckData(fresh);
        const workingPack = isGeneratedLoredeckPack(fresh)
            ? refreshGeneratedLoredeckDerivedMetadata(cloneLoredeckJson(fresh) || { ...fresh })
            : fresh;
        const manifest = await getDisplayManifestForPack(workingPack, { requireFetch: !virtualData });
        const baseUrl = virtualData ? null : resolveManifestUrlForFetch(workingPack.manifest);
        if (!virtualData && !baseUrl) throw new Error('Loredeck manifest path or URL is invalid.');
        const entryCache = virtualData
            ? buildGeneratedLoredeckEntryCache(workingPack, manifest)
            : await fetchLoredeckEntryFilesForEditor(workingPack, manifest, baseUrl);
        let timeline = null;
        let tagRegistry = null;
        if (virtualData) {
            timeline = getLoredeckTimelineRegistryCount(workingPack.timelineRegistry)
                ? normalizeLoredeckTimelineRegistry(workingPack.timelineRegistry)
                : null;
            loredeckTimelineRegistryCache.set(workingPack.packId, {
                sourceRegistry: normalizeLoredeckTimelineRegistry(timeline),
                error: '',
                missing: !timeline,
                loadedAt: Date.now(),
            });
            tagRegistry = getLoredeckTagRegistryCount(workingPack.tagRegistry)
                ? normalizeLoredeckTagRegistry(workingPack.tagRegistry)
                : { schemaVersion: 1, tags: {} };
            loredeckTagRegistryCache.set(workingPack.packId, {
                sourceRegistry: tagRegistry,
                error: '',
                missing: !getLoredeckTagRegistryCount(tagRegistry),
                loadedAt: Date.now(),
            });
        } else {
            try {
                timeline = await fetchLoredeckTimelineForEditor(manifest, baseUrl);
                loredeckTimelineRegistryCache.set(workingPack.packId, {
                    sourceRegistry: normalizeLoredeckTimelineRegistry(timeline),
                    error: '',
                    missing: !timeline,
                    loadedAt: Date.now(),
                });
            } catch (e) {
                console.warn('[Saga] Loredeck timeline failed during editor validation:', e);
                loredeckTimelineRegistryCache.set(workingPack.packId, {
                    sourceRegistry: normalizeLoredeckTimelineRegistry(null),
                    error: e?.message || 'timeline.json failed to load.',
                    loadedAt: Date.now(),
                });
            }
            tagRegistry = await loadLoredeckTagRegistryForEditor(workingPack, null, { manifest, baseUrl, quiet: true });
        }
        const health = buildLoredeckHealthForData({
            packId: workingPack.packId,
            manifest,
            entryFiles: entryCache.entryFiles,
            timeline,
            tagRegistry,
            registryRecord: virtualData ? null : workingPack,
        });
        cacheLoredeckValidation(workingPack.packId, manifest, entryCache, health);

        if (workingPack.type !== 'bundled' && options.updateLibrary !== false) {
            const record = {
                ...workingPack,
                entrySchemaVersion: getExpectedLoredeckEntrySchemaVersion(workingPack, manifest),
                stats: buildLoredeckStatsFromHealth(health),
                healthStatus: health.status,
                updatedAt: Date.now(),
            };
            if (isGeneratedLoredeckPack(record)) refreshGeneratedLoredeckDerivedMetadata(record);
            else if (isVirtualLoredeckPack(record)) record.manifestData = buildEmbeddedCustomManifest(record.manifestData || manifest, record);
            const result = upsertLoredeckLibraryPack(record);
            if (!result.ok) throw new Error(result.error || 'Deck Health status save failed.');
        }

        if (options.quiet !== true) {
            const summary = health.summary || {};
            toast(`Deck Health: ${health.status} (${summary.errorCount || 0} errors, ${summary.warningCount || 0} warnings).`, health.errors?.length ? 'error' : (health.warnings?.length ? 'warning' : 'success'));
            refreshLoredeckSurfaces();
        }
        return { health, manifest, entryCache };
    } catch (e) {
        if (options.quiet !== true) toast(e?.message || 'Loredeck validation failed.', 'error');
        return { health: null, manifest: null, entryCache: null, error: e?.message || 'Loredeck validation failed.' };
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Validate Deck';
        }
    }
}

async function repairLoredeckSafeHealthIssues(pack, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Repairing...';
    }
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!fresh || fresh.type === 'bundled') {
            toast('Bundled Loredecks cannot be repaired directly. Duplicate as Custom first.', 'warning');
            return false;
        }
        const validation = await validateLoredeckForEditor(fresh, null, { quiet: true, updateLibrary: false });
        if (!validation.health) throw new Error(validation.error || 'Validation failed before repair.');
        const summary = validation.health.summary || {};
        const entrySchemaVersion = getExpectedLoredeckEntrySchemaVersion(fresh, validation.manifest);
        const next = {
            ...fresh,
            entrySchemaVersion,
            healthStatus: validation.health.status,
            stats: {
                entryCount: Number(summary.entryCount) || 0,
                categoryCounts: summary.categoryCounts && typeof summary.categoryCounts === 'object' && !Array.isArray(summary.categoryCounts)
                    ? { ...summary.categoryCounts }
                    : {},
            },
            entryOverrides: { ...(fresh.entryOverrides || {}) },
            disabledEntryIds: Array.isArray(fresh.disabledEntryIds) ? [...fresh.disabledEntryIds] : [],
            localModified: true,
            updatedAt: Date.now(),
        };

        let overrideRepairCount = 0;
        if (entrySchemaVersion >= 3) {
            for (const [id, raw] of Object.entries(next.entryOverrides || {})) {
                const repaired = repairLoredeckEntryForHealth(raw, { forceSchemaVersion: 3 });
                if (JSON.stringify(repaired) !== JSON.stringify(raw)) {
                    next.entryOverrides[id] = repaired;
                    overrideRepairCount += 1;
                }
            }
        }
        if (isGeneratedLoredeckPack(next)) {
            refreshGeneratedLoredeckDerivedMetadata(next);
        } else if (isVirtualLoredeckPack(next)) {
            next.manifestData = buildEmbeddedCustomManifest(next.manifestData || validation.manifest, next);
        }
        const result = upsertLoredeckLibraryPack(next);
        if (!result.ok) throw new Error(result.error || 'Safe repair failed.');
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        loredeckEntryPreviewCache.delete(next.packId);
        await validateLoredeckForEditor(next, null, { quiet: true, updateLibrary: true });
        refreshLoredeckSurfaces();
        toast(`Safe repairs applied: stats refreshed${overrideRepairCount ? `, ${overrideRepairCount} override${overrideRepairCount === 1 ? '' : 's'} repaired` : ''}.`, 'success');
        return true;
    } catch (e) {
        toast(e?.message || 'Safe repair failed.', 'error');
        return false;
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Repair Safe Issues';
        }
    }
}

async function exportValidatedLoredeckDraft(pack, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Exporting...';
    }
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack) || pack;
        const packageResult = await buildLoredeckZipPackageForExport([fresh]);
        downloadBytes(packageResult.zipBytes, packageResult.filename, 'application/zip');
        toast(`Loredeck package exported with ${packageResult.fileCount} file${packageResult.fileCount === 1 ? '' : 's'}.`, 'success');
    } catch (e) {
        toast(e?.message || 'Loredeck export failed.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Export Package';
        }
    }
}

async function syncLoredeckMetadataFromManifest(pack, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Syncing...';
    }
    try {
        if (isVirtualLoredeckPack(pack)) {
            const baseManifest = await fetchLoredeckManifest(pack.manifest);
            const record = {
                ...pack,
                type: 'custom',
                entrySchemaVersion: Number.isFinite(Number(baseManifest.entrySchemaVersion)) ? Number(baseManifest.entrySchemaVersion) : (Number(pack.entrySchemaVersion) || 0),
                stats: {
                    entryCount: Number.isFinite(Number(baseManifest.stats?.entryCount)) && Number(baseManifest.stats.entryCount) > 0
                        ? Math.max(0, Number(baseManifest.stats.entryCount))
                        : Math.max(0, Number(pack.entryCount || pack.stats?.entryCount) || 0),
                    categoryCounts: baseManifest.stats?.categoryCounts && typeof baseManifest.stats.categoryCounts === 'object' && !Array.isArray(baseManifest.stats.categoryCounts)
                        ? { ...baseManifest.stats.categoryCounts }
                        : (pack.stats?.categoryCounts || {}),
                },
            };
            record.manifestData = buildEmbeddedCustomManifest(baseManifest, record);
            if (getLoredeckTimelineRegistryCount(pack.timelineRegistry)) record.timelineRegistry = normalizeLoredeckTimelineRegistry(pack.timelineRegistry);
            if (getLoredeckTagRegistryCount(pack.tagRegistry)) record.tagRegistry = normalizeLoredeckTagRegistry(pack.tagRegistry);
            const result = upsertLoredeckLibraryPack(record);
            if (!result.ok) throw new Error(result.error || 'Metadata sync failed.');
            loredeckManifestPreviewCache.set(record.packId, {
                manifest: record.manifestData,
                error: '',
                loadedAt: Date.now(),
            });
            refreshLoredeckSurfaces({ clearCanon: true });
            toast(`${record.title} refreshed from its base manifest.`, 'success');
            return;
        }
        const manifest = await fetchLoredeckManifest(pack.manifest);
        const record = buildLoredeckRecordFromManifest(manifest, pack.manifest);
        if (record.packId !== pack.packId) {
            throw new Error(`Manifest id ${record.packId} does not match selected Loredeck id ${pack.packId}. Register it as a separate Loredeck instead.`);
        }
        record.type = pack.type === 'generated' ? 'generated' : 'custom';
        record.installedAt = pack.installedAt || Date.now();
        record.entryOverrides = pack.entryOverrides || {};
        record.disabledEntryIds = Array.isArray(pack.disabledEntryIds) ? [...pack.disabledEntryIds] : [];
        record.localModified = pack.localModified === true;
        const pendingChanges = getLoredeckPendingChanges(pack);
        if (pendingChanges.length) record.pendingChanges = pendingChanges;
        if (getLoredeckTimelineRegistryCount(pack.timelineRegistry)) record.timelineRegistry = normalizeLoredeckTimelineRegistry(pack.timelineRegistry);
        if (getLoredeckTagRegistryCount(pack.tagRegistry)) record.tagRegistry = normalizeLoredeckTagRegistry(pack.tagRegistry);
        const result = upsertLoredeckLibraryPack(record);
        if (!result.ok) throw new Error(result.error || 'Metadata sync failed.');
        loredeckManifestPreviewCache.set(record.packId, {
            manifest,
            error: '',
            loadedAt: Date.now(),
        });
        selectLoredeckForDetails(record.packId, { refresh: false });
        clearCanonLoreDatabaseCache();
        refreshLoredeckSurfaces();
        toast(`${record.title} metadata synced from manifest.`, 'success');
    } catch (e) {
        toast(e?.message || 'Metadata sync failed.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Sync From Manifest';
        }
    }
}

async function saveLoredeckMetadataFromInputs(pack, fields, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Saving...';
    }
    try {
        const title = fields.titleInput.value.trim() || pack.title || pack.packId;
        const nextManifest = fields.manifestInput.value.trim();
        if (nextManifest && nextManifest !== pack.manifest) {
            const manifest = await fetchLoredeckManifest(nextManifest);
            const manifestId = String(manifest?.id || '').trim();
            if (!manifestId) throw new Error('Manifest is missing required id.');
            if (manifestId !== pack.packId) {
                throw new Error(`Manifest id ${manifestId} does not match selected Loredeck id ${pack.packId}. Register it as a separate Loredeck instead.`);
            }
            loredeckManifestPreviewCache.set(pack.packId, {
                manifest,
                error: '',
                loadedAt: Date.now(),
            });
        }
        const record = {
            ...pack,
            type: pack.type === 'generated' ? 'generated' : 'custom',
            title,
            description: fields.descriptionInput.value.trim(),
            fandom: fields.fandomInput.value.trim(),
            era: fields.eraInput.value.trim(),
            author: fields.authorInput.value.trim(),
            version: fields.versionInput.value.trim(),
            manifest: nextManifest,
            tags: parseLoredeckTags(fields.tagsInput.value),
            localModified: true,
            updatedAt: Date.now(),
        };
        if (isGeneratedLoredeckPack(record)) {
            refreshGeneratedLoredeckDerivedMetadata(record);
        } else if (isVirtualLoredeckPack(pack)) {
            record.manifestData = buildEmbeddedCustomManifest(pack.manifestData, record);
        }
        const result = upsertLoredeckLibraryPack(record);
        if (!result.ok) throw new Error(result.error || 'Loredeck metadata save failed.');
        if (record.manifest !== pack.manifest) {
            loredeckManifestPreviewCache.delete(pack.packId);
            loredeckEntryPreviewCache.delete(pack.packId);
            loredeckTimelineRegistryCache.delete(pack.packId);
            loredeckTagRegistryCache.delete(pack.packId);
        }
        clearCanonLoreDatabaseCache();
        refreshLoredeckSurfaces();
        toast(`${title} metadata saved.`, 'success');
    } catch (e) {
        toast(e?.message || 'Loredeck metadata save failed.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Save Metadata';
        }
    }
}

function parseLoredeckTags(value) {
    const seen = new Set();
    const tags = [];
    for (const raw of String(value || '').split(',')) {
        const tag = String(raw || '')
            .trim()
            .replace(/[\r\n]+/g, ' ')
            .replace(/[^\p{L}\p{N} _:\-./]+/gu, '')
            .replace(/\s+/g, ' ')
            .slice(0, 64)
            .trim();
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= 32) break;
    }
    return tags;
}

function normalizeLoredeckPackId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .replace(/[^a-z0-9]+$/, '')
        .slice(0, 96);
}

function getUniqueLoredeckPackId(baseId, library = getLoredeckLibrary(getState())) {
    const existing = new Set(library.map(pack => pack.packId));
    const base = normalizeLoredeckPackId(baseId) || 'custom-loredeck';
    if (!existing.has(base)) return base;
    for (let index = 2; index < 1000; index += 1) {
        const candidate = `${base}-${index}`;
        if (!existing.has(candidate)) return candidate;
    }
    return `${base}-${Date.now()}`;
}

function getDefaultDuplicateLoredeckTags(pack, manifest = {}) {
    const sourceTags = Array.isArray(pack?.tags) && pack.tags.length ? pack.tags : (Array.isArray(manifest.tags) ? manifest.tags : []);
    return parseLoredeckTags([
        ...sourceTags.filter(tag => !String(tag || '').toLowerCase().startsWith('quality:')),
        'origin:duplicate',
        'quality:user-managed',
    ].join(', '));
}

function getLoredeckDuplicateTitle(sourcePack = {}, suffix = 'Copy') {
    const title = String(sourcePack.title || sourcePack.packId || 'Loredeck').trim();
    const cleanSuffix = String(suffix || 'Copy').trim() || 'Copy';
    return /\bcopy(?:\s+\d+)?$/i.test(title) ? title : `${title} ${cleanSuffix}`;
}

function getUniqueLoredeckLibraryFolderTitle(parentId = '', title = '', folders = []) {
    const base = String(title || 'Folder').trim() || 'Folder';
    const siblings = new Set(getLoredeckLibraryFolderSiblingRecords(parentId, folders).map(folder => String(folder.title || '').trim().toLowerCase()));
    if (!siblings.has(base.toLowerCase())) return base;
    for (let index = 2; index < 1000; index += 1) {
        const candidate = `${base} ${index}`;
        if (!siblings.has(candidate.toLowerCase())) return candidate;
    }
    return `${base} ${Date.now()}`;
}

async function buildCustomDuplicateLoredeckRecord(sourcePack, options = {}) {
    const packId = normalizeLoredeckPackId(options.packId);
    if (!packId) throw new Error('Custom Loredeck needs a valid pack ID.');
    if (getLoredeckDefinition(packId)) throw new Error(`A Loredeck with id ${packId} already exists.`);
    const title = String(options.title || sourcePack.title || packId).trim() || packId;
    const sourceManifest = await getDisplayManifestForPack(sourcePack);
    const baseManifest = sourcePack.manifest || sourcePack.source?.url || '';
    if (!baseManifest) throw new Error('Source Loredeck does not have a fetchable manifest path.');
    const stats = {
        entryCount: Number.isFinite(Number(sourcePack.entryCount)) ? Math.max(0, Number(sourcePack.entryCount)) : (Number(sourceManifest.stats?.entryCount) || 0),
        categoryCounts: sourceManifest.stats?.categoryCounts && typeof sourceManifest.stats.categoryCounts === 'object' && !Array.isArray(sourceManifest.stats.categoryCounts)
            ? { ...sourceManifest.stats.categoryCounts }
            : (sourcePack.stats?.categoryCounts || {}),
    };
    const derivedFrom = {
        packId: sourcePack.packId,
        title: sourcePack.title || sourcePack.packId,
        type: sourcePack.type || 'custom',
        version: sourcePack.version || sourceManifest.version || '',
        manifest: baseManifest,
        duplicatedAt: Date.now(),
    };
    const record = {
        packId,
        type: 'custom',
        title,
        description: String(options.description ?? sourcePack.description ?? '').trim(),
        fandom: sourcePack.fandom || sourceManifest.fandom || '',
        era: sourcePack.era || sourceManifest.era || '',
        author: String(options.author || 'User').trim(),
        version: String(options.version || '1.0.0').trim() || '1.0.0',
        entrySchemaVersion: Number.isFinite(Number(sourceManifest.entrySchemaVersion)) ? Number(sourceManifest.entrySchemaVersion) : (Number(sourcePack.entrySchemaVersion) || 0),
        manifest: baseManifest,
        source: {
            kind: 'derived',
            url: baseManifest,
            updateUrl: '',
        },
        tags: Array.isArray(options.tags) ? options.tags : parseLoredeckTags(options.tags || getDefaultDuplicateLoredeckTags(sourcePack, sourceManifest).join(', ')),
        stats,
        healthStatus: '',
        derivedFrom,
        entryOverrides: {},
        disabledEntryIds: [],
        installedAt: Date.now(),
        updatedAt: Date.now(),
    };
    if (getLoredeckTagRegistryCount(sourcePack.tagRegistry)) {
        record.tagRegistry = normalizeLoredeckTagRegistry(sourcePack.tagRegistry);
    }
    if (getLoredeckTimelineRegistryCount(sourcePack.timelineRegistry)) {
        record.timelineRegistry = normalizeLoredeckTimelineRegistry(sourcePack.timelineRegistry);
    }
    record.manifestData = buildEmbeddedCustomManifest(sourceManifest, record);
    return record;
}

async function createCustomDuplicateLoredeckRecord(sourcePack, options = {}) {
    const record = await buildCustomDuplicateLoredeckRecord(sourcePack, options);
    const result = upsertLoredeckLibraryPack(record);
    if (!result.ok) throw new Error(result.error || 'Loredeck duplication failed.');
    loredeckManifestPreviewCache.set(record.packId, {
        manifest: record.manifestData,
        error: '',
        loadedAt: Date.now(),
    });
    return record;
}

function getFinalizedGeneratedLoredeckTags(pack = {}) {
    const sourceTags = Array.isArray(pack.tags) ? pack.tags : [];
    const tags = sourceTags.filter(tag => {
        const key = String(tag || '').trim().toLowerCase();
        return key
            && key !== 'origin:generated'
            && key !== 'quality:model-drafted'
            && key !== 'saga:creator';
    });
    tags.push('origin:custom', 'source:generated', 'quality:user-managed', 'saga:creator-finalized');
    return parseLoredeckTags(tags.join(', '));
}

function finalizeGeneratedLoredeckEntry(entry = {}, targetPackId = '', sourcePackId = '', finalizedAt = Date.now()) {
    const next = cloneLoredeckJson(entry) || { ...(entry || {}) };
    next.source = `saga-loredeck:${targetPackId}:custom`;
    const extensions = next.extensions && typeof next.extensions === 'object' && !Array.isArray(next.extensions)
        ? { ...next.extensions }
        : {};
    delete extensions.sagaLoredeckCreator;
    extensions.sagaLoredeckFinalizedFrom = {
        packId: sourcePackId,
        source: 'loredeck_creator',
        finalizedAt,
    };
    if (extensions.sagaLoredeckOverride && typeof extensions.sagaLoredeckOverride === 'object' && !Array.isArray(extensions.sagaLoredeckOverride)) {
        extensions.sagaLoredeckOverride = {
            ...extensions.sagaLoredeckOverride,
            packId: targetPackId,
            source: 'custom_finalized',
        };
    }
    next.extensions = extensions;
    return next;
}

function buildFinalizedCustomLoredeckRecordFromGenerated(sourcePack = {}, options = {}) {
    if (!isGeneratedLoredeckPack(sourcePack)) throw new Error('Only Generated Loredecks can be finalized as Custom.');
    const packId = normalizeLoredeckPackId(options.packId || getUniqueLoredeckPackId(`${sourcePack.packId}-custom`));
    if (!packId) throw new Error('Finalized Custom Loredeck needs a valid pack ID.');
    if (getLoredeckDefinition(packId)) throw new Error(`A Loredeck with id ${packId} already exists.`);
    const finalizedAt = Date.now();
    const entries = getAcceptedGeneratedLoredeckEntries(sourcePack);
    if (!entries.length) throw new Error('Generated Loredeck needs accepted Lorecards before it can be finalized.');
    const entryOverrides = {};
    for (const entry of entries) {
        const id = normalizeLoredeckEntryId(entry.id);
        if (!id) continue;
        entryOverrides[id] = finalizeGeneratedLoredeckEntry(entry, packId, sourcePack.packId, finalizedAt);
    }
    const stats = buildLoredeckStatsFromEntries(Object.values(entryOverrides));
    const title = String(options.title || getLoredeckDuplicateTitle(sourcePack, 'Custom') || packId).trim() || packId;
    const manifestSeed = {
        ...(cloneLoredeckJson(sourcePack.manifestData) || {}),
        id: packId,
        type: 'custom',
        title,
        description: String(options.description ?? sourcePack.description ?? '').trim(),
        fandom: sourcePack.fandom || sourcePack.manifestData?.fandom || '',
        era: sourcePack.era || sourcePack.manifestData?.era || '',
        author: String(options.author || 'User').trim(),
        version: String(options.version || '1.0.0').trim() || '1.0.0',
        entrySchemaVersion: Math.max(3, Number(sourcePack.entrySchemaVersion || sourcePack.manifestData?.entrySchemaVersion) || 0),
        files: [],
        tags: getFinalizedGeneratedLoredeckTags(sourcePack),
        stats,
        update: {
            checkForUpdates: false,
            url: '',
        },
    };
    const record = {
        packId,
        type: 'custom',
        title,
        description: manifestSeed.description,
        fandom: manifestSeed.fandom,
        era: manifestSeed.era,
        author: manifestSeed.author,
        version: manifestSeed.version,
        entrySchemaVersion: manifestSeed.entrySchemaVersion,
        manifest: '',
        source: {
            kind: 'generated_finalized',
            url: '',
            updateUrl: '',
            originalPackId: sourcePack.packId,
        },
        tags: manifestSeed.tags,
        stats,
        healthStatus: options.healthStatus || sourcePack.healthStatus || '',
        derivedFrom: {
            packId: sourcePack.packId,
            title: sourcePack.title || sourcePack.packId,
            type: 'generated',
            version: sourcePack.version || '',
            creatorJobId: options.creatorJob?.jobId || getLoredeckCreatorJobForPack(sourcePack)?.jobId || '',
            finalizedAt,
        },
        entryOverrides,
        disabledEntryIds: Array.isArray(sourcePack.disabledEntryIds) ? [...sourcePack.disabledEntryIds] : [],
        tagRegistry: normalizeLoredeckTagRegistry(sourcePack.tagRegistry),
        timelineRegistry: normalizeLoredeckTimelineRegistry(sourcePack.timelineRegistry),
        pendingChanges: [],
        localModified: true,
        installedAt: finalizedAt,
        updatedAt: finalizedAt,
    };
    record.manifestData = buildEmbeddedCustomManifest(manifestSeed, record);
    return record;
}

async function finalizeGeneratedLoredeckAsCustom(pack, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Finalizing...';
    }
    try {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!isGeneratedLoredeckPack(fresh)) throw new Error('Only Generated Loredecks can be finalized as Custom.');
        const validation = await validateLoredeckForEditor(fresh, null, { quiet: true, updateLibrary: true });
        if (!validation.health) throw new Error(validation.error || 'Validation failed before finalizing.');
        const validated = getFreshLoredeckLibraryPack(fresh.packId, fresh);
        const readiness = getGeneratedLoredeckExportReadiness(validated, validation.health);
        if (!readiness.ready) {
            throw new Error(`Generated Loredeck is not ready to finalize: ${readiness.blockers[0] || 'resolve pending generated draft state first.'}`);
        }
        if (readiness.warnings.length) {
            const proceed = await confirmAction(
                'Finalize Generated Loredeck with warnings?',
                [
                    `${validated.title || validated.packId} has readiness warnings:`,
                    ...readiness.warnings.slice(0, 6).map(item => `- ${item}`),
                    readiness.warnings.length > 6 ? `- ...and ${readiness.warnings.length - 6} more` : '',
                    '',
                    'Finalize anyway as a Custom Loredeck copy?',
                ].filter(Boolean).join('\n')
            );
            if (!proceed) return null;
        }
        const record = buildFinalizedCustomLoredeckRecordFromGenerated(validated, {
            healthStatus: validation.health.status,
        });
        const result = upsertLoredeckLibraryPack(record);
        if (!result.ok) throw new Error(result.error || 'Generated Loredeck finalization failed.');
        loredeckManifestPreviewCache.set(record.packId, {
            manifest: record.manifestData,
            health: null,
            error: '',
            loadedAt: Date.now(),
        });
        selectLoredeckForDetails(record.packId, { refresh: false });
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        await validateLoredeckForEditor(record, null, { quiet: true, updateLibrary: true });
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        openLoredeckMetadataEditor(record.packId);
        if (isLoredeckLibraryOpen()) renderLoredeckLibraryOverlay();
        toast(`${record.title || record.packId} finalized as a Custom Loredeck.`, 'success');
        return record;
    } catch (e) {
        toast(e?.message || 'Generated Loredeck finalization failed.', 'error');
        return null;
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Finalize as Custom';
        }
    }
}

function saveLoredeckLibraryDeckPlacementAssignments(assignments = []) {
    const normalized = (assignments || [])
        .map(item => ({
            deckId: String(item.deckId || item.packId || '').trim(),
            folderId: String(item.folderId || '').trim(),
        }))
        .filter(item => item.deckId);
    if (!normalized.length) return false;
    const { settings, registry } = getMutableLoredeckLibraryRegistry();
    const byId = new Map((Array.isArray(registry.deckPlacements) ? registry.deckPlacements : [])
        .map(item => [String(item.deckId || item.packId || '').trim(), { ...item, deckId: String(item.deckId || item.packId || '').trim() }])
        .filter(([deckId]) => deckId));
    const maxByFolder = new Map();
    for (const placement of byId.values()) {
        const folderId = String(placement.folderId || '').trim();
        maxByFolder.set(folderId, Math.max(maxByFolder.get(folderId) || 0, Number(placement.sortOrder) || 0));
    }
    const now = Date.now();
    for (const assignment of normalized) {
        const maxOrder = maxByFolder.get(assignment.folderId) || 0;
        const sortOrder = Math.max(100, Math.ceil(maxOrder / 100) * 100 + 100);
        maxByFolder.set(assignment.folderId, sortOrder);
        byId.set(assignment.deckId, {
            ...(byId.get(assignment.deckId) || {}),
            deckId: assignment.deckId,
            folderId: assignment.folderId,
            sortOrder,
            updatedAt: now,
        });
    }
    settings.loredeckLibrary = {
        ...registry,
        deckPlacements: [...byId.values()],
    };
    saveSettings(settings);
    return true;
}

function openDuplicateLoredeckDialog(sourcePack) {
    const existing = document.querySelector('.saga-loredeck-duplicate-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-duplicate-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-duplicate-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Duplicate Loredeck';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = 'Creates a Custom Loredeck copy with its own pack ID and metadata.';
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without duplicating this Loredeck.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-duplicate-form';
    shell.appendChild(form);

    const source = document.createElement('div');
    source.className = 'saga-loredeck-duplicate-source';
    source.appendChild(createKeyValue('Source', sourcePack.title || sourcePack.packId, 'Loredeck being duplicated.'));
    source.appendChild(createKeyValue('Source ID', sourcePack.packId, 'Original pack ID recorded in derivedFrom metadata.'));
    source.appendChild(createKeyValue('Base Manifest', sourcePack.manifest || 'unset', 'Source manifest used for entry-file resolution.'));
    form.appendChild(source);

    const library = getLoredeckLibrary(getState());
    const suggestedId = getUniqueLoredeckPackId(`${sourcePack.packId}-custom`, library);
    const suggestedTitle = `${sourcePack.title || sourcePack.packId} Custom`;
    const defaultTags = getDefaultDuplicateLoredeckTags(sourcePack);

    const idInput = createNewLoreInput(form, 'Deck ID', 'Stable lowercase ID for the Custom Loredeck. Internally this is stored as packId until the schema alias pass.', suggestedId, false, 'my-custom-loredeck');
    const titleInput = createNewLoreInput(form, 'Title', 'Display title shown in the Loredeck Library and stack.', suggestedTitle, false, 'My Custom Loredeck');
    const descriptionInput = createNewLoreInput(form, 'Description', 'Short description for the Custom Loredeck.', sourcePack.description || '', true, 'Custom AU/crossover copy for my story.');
    const authorInput = createNewLoreInput(form, 'Author', 'Creator shown in pack metadata.', 'User', false, 'User');
    const versionInput = createNewLoreInput(form, 'Version', 'Starting version for the Custom copy.', '1.0.0', false, '1.0.0');
    const tagsInput = createNewLoreInput(form, 'Tags', 'Comma-separated pack tags.', defaultTags.join(', '), false, 'origin:duplicate, quality:user-managed');

    const options = document.createElement('label');
    options.className = 'saga-loredeck-duplicate-option';
    const addToStackInput = document.createElement('input');
    addToStackInput.type = 'checkbox';
    options.appendChild(addToStackInput);
    const optionText = document.createElement('span');
    optionText.textContent = 'Add copy to current Loredeck stack';
    options.appendChild(optionText);
    addTooltip(options, 'Adds the new Custom Loredeck to the active stack after creating it. You can still reorder priority later.');
    form.appendChild(options);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Create Custom Loredeck', 'Duplicate this pack into the Custom Loredeck Library.', async (btn) => {
        await duplicateLoredeckAsCustom(sourcePack, {
            overlay,
            idInput,
            titleInput,
            descriptionInput,
            authorInput,
            versionInput,
            tagsInput,
            addToStackInput,
        }, btn);
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without duplicating this Loredeck.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => idInput.focus());
}

async function duplicateLoredeckAsCustom(sourcePack, fields, button = null) {
    const originalText = button?.textContent;
    if (button) {
        button.disabled = true;
        button.textContent = 'Creating...';
    }
    try {
        const packId = normalizeLoredeckPackId(fields.idInput.value);
        const title = fields.titleInput.value.trim() || packId;
        const record = await createCustomDuplicateLoredeckRecord(sourcePack, {
            packId,
            title,
            description: fields.descriptionInput.value.trim(),
            author: fields.authorInput.value.trim(),
            version: fields.versionInput.value.trim() || '1.0.0',
            tags: parseLoredeckTags(fields.tagsInput.value),
        });
        fields.overlay?.remove?.();
        selectLoredeckForDetails(record.packId, { refresh: false });
        if (fields.addToStackInput.checked) {
            addLoredeckToStack(record.packId);
        }
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    } catch (e) {
        toast(e?.message || 'Loredeck duplication failed.', 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText || 'Create Custom Loredeck';
        }
    }
}

function formatLoredeckBulkDuplicateList(packs = [], limit = 10) {
    const titles = packs
        .map(pack => pack?.title || pack?.packId || '')
        .filter(Boolean);
    const visible = titles.slice(0, limit).map((title, index) => `${index + 1}. ${title}`);
    if (titles.length > limit) visible.push(`...and ${titles.length - limit} more`);
    return visible.join('\n');
}

async function duplicateLoredeckLibraryPacks(packs = [], options = {}) {
    const libraryIndex = getLoredeckLibraryIndexForPacks();
    const created = [];
    const assignments = [];
    const failures = [];
    for (const sourcePack of packs || []) {
        if (!sourcePack?.packId) continue;
        try {
            const currentLibrary = getLoredeckLibrary(getState());
            const packId = getUniqueLoredeckPackId(`${sourcePack.packId}-copy`, currentLibrary);
            const record = await createCustomDuplicateLoredeckRecord(sourcePack, {
                packId,
                title: getLoredeckDuplicateTitle(sourcePack, options.titleSuffix || 'Copy'),
                description: sourcePack.description || '',
                author: 'User',
                version: '1.0.0',
                tags: getDefaultDuplicateLoredeckTags(sourcePack),
            });
            created.push(record);
            const folderId = typeof options.getTargetFolderId === 'function'
                ? String(options.getTargetFolderId(sourcePack, record) || '').trim()
                : getLoredeckLibraryPackFolderId(sourcePack, libraryIndex);
            assignments.push({ deckId: record.packId, folderId });
        } catch (e) {
            failures.push(`${sourcePack.title || sourcePack.packId}: ${e?.message || 'duplicate failed'}`);
        }
    }
    saveLoredeckLibraryDeckPlacementAssignments(assignments);
    return { created, failures };
}

async function duplicateLoredeckLibraryPacksWithConfirm(packsOrIds = []) {
    const library = getLoredeckLibrary(getState());
    const byId = new Map(library.map(pack => [pack.packId, pack]));
    const requested = [];
    const seen = new Set();
    for (const item of packsOrIds || []) {
        const packId = String(typeof item === 'string' ? item : item?.packId || '').trim();
        if (!packId || seen.has(packId)) continue;
        seen.add(packId);
        const pack = byId.get(packId) || (typeof item === 'object' ? item : null);
        if (pack) requested.push(pack);
    }
    if (!requested.length) {
        toast('Select one or more Loredecks before duplicating.', 'warning');
        return false;
    }
    const proceed = await confirmAction(
        'Duplicate selected Loredecks?',
        [
            `Create ${requested.length} editable Custom Loredeck cop${requested.length === 1 ? 'y' : 'ies'}:`,
            formatLoredeckBulkDuplicateList(requested),
            '',
            'Copies keep the same folder placement as their source Loredecks.',
        ].join('\n')
    );
    if (!proceed) return false;
    const result = await duplicateLoredeckLibraryPacks(requested);
    if (result.created.length) {
        setLoredeckLibraryBulkSelection(result.created.map(pack => pack.packId), result.created[0].packId);
        selectLoredeckForDetails(result.created[0].packId, { refresh: false });
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        renderLoredeckLibraryOverlay();
    }
    if (result.failures.length) {
        toast(`Could not duplicate: ${result.failures.slice(0, 2).join('; ')}${result.failures.length > 2 ? '...' : ''}`, 'warning');
    }
    return result.created.length > 0;
}

async function duplicateLoredeckLibraryFolderWithContents(folderId = '') {
    const id = String(folderId || '').trim();
    if (!id || id === 'unfiled') {
        toast('Select a Library folder before duplicating.', 'warning');
        return false;
    }
    const state = getState();
    const library = getLoredeckLibrary(state);
    const libraryIndex = getLoredeckLibraryIndexForPacks(state, library);
    const sourceFolder = (libraryIndex.folders || []).find(folder => folder.id === id);
    if (!sourceFolder) {
        toast('That Library folder is no longer available.', 'warning');
        return false;
    }
    const sourceFolders = (libraryIndex.folders || [])
        .filter(folder => folder.id === id || isLoredeckLibraryFolderDescendant(folder.id, id, libraryIndex))
        .sort((a, b) => getFolderPath(a.id, libraryIndex).length - getFolderPath(b.id, libraryIndex).length || (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    const packs = getLoredeckLibraryFolderPacks(id, library, libraryIndex, { includeNested: true });
    const proceed = await confirmAction(
        'Duplicate folder and contents?',
        [
            `Duplicate "${sourceFolder.title || id}" as a new Library folder.`,
            '',
            `Folders: ${sourceFolders.length}`,
            `Loredecks copied as Custom: ${packs.length}`,
            '',
            packs.length ? formatLoredeckBulkDuplicateList(packs, 8) : 'This folder contains no Loredecks yet.',
        ].join('\n')
    );
    if (!proceed) return false;

    let folders = (libraryIndex.folders || []).map(folder => ({ ...folder }));
    const folderMap = new Map();
    for (const folder of sourceFolders) {
        const parentId = folder.id === id ? String(folder.parentId || '').trim() : String(folderMap.get(folder.parentId) || '').trim();
        const baseTitle = folder.id === id ? getLoredeckDuplicateTitle(folder, 'Copy') : (folder.title || 'Folder');
        const title = getUniqueLoredeckLibraryFolderTitle(parentId, baseTitle, folders);
        const result = createLoredeckLibraryFolderRecord(parentId, title, { ...libraryIndex, folders });
        if (!result.ok) {
            toast(result.error || 'Folder duplicate failed.', 'warning');
            return false;
        }
        folders = result.folders.map(item => item.id === result.folder.id
            ? {
                ...item,
                icon: folder.icon || item.icon,
                color: folder.color || item.color,
                collapsed: folder.collapsed === true,
            }
            : item);
        folderMap.set(folder.id, result.folder.id);
    }
    saveLoredeckLibraryFolderRecords(folders);

    const duplicateResult = await duplicateLoredeckLibraryPacks(packs, {
        titleSuffix: 'Copy',
        getTargetFolderId: sourcePack => {
            const sourceFolderId = getLoredeckLibraryPackFolderId(sourcePack, libraryIndex);
            return folderMap.get(sourceFolderId) || folderMap.get(id) || '';
        },
    });
    const newFolderId = folderMap.get(id) || '';
    setLoredeckLibrarySelectedFolder(newFolderId || 'all', newFolderId || '');
    setLoredeckLibraryBulkSelection(duplicateResult.created.map(pack => pack.packId), duplicateResult.created[0]?.packId || '');
    refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    renderLoredeckLibraryOverlay();
    if (duplicateResult.failures.length) {
        toast(`Some Loredecks could not be duplicated: ${duplicateResult.failures.slice(0, 2).join('; ')}${duplicateResult.failures.length > 2 ? '...' : ''}`, 'warning');
    }
    return true;
}

function normalizeLoredeckEntryId(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._:-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 140);
}

function getLoredeckEntryEditorString(value, maxLength = 240) {
    return String(value || '').trim().slice(0, maxLength);
}

function getLoredeckEntryEditorNumber(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
}

function getLoredeckEntryEditorNumberText(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : '';
}

function appendLoredeckEntryEditorSection(form, titleText) {
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = titleText;
    form.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'saga-new-lore-meta-grid';
    form.appendChild(grid);
    return grid;
}

function buildLoredeckContextFromEditorFields(fields = {}) {
    if (!fields.scopeSelect) return {};
    const scope = getLoredeckEntryEditorString(fields.scopeSelect.value, 60);
    const anchorId = getLoredeckEntryEditorString(fields.anchorIdInput?.value, 180);
    const validFromAnchor = getLoredeckEntryEditorString(fields.validFromAnchorInput?.value, 180);
    const validToAnchor = getLoredeckEntryEditorString(fields.validToAnchorInput?.value, 180);
    const sortKeyFrom = getLoredeckEntryEditorNumber(fields.sortKeyFromInput?.value);
    const sortKeyTo = getLoredeckEntryEditorNumber(fields.sortKeyToInput?.value);
    const precision = getLoredeckEntryEditorString(fields.precisionInput?.value, 120);
    const windowKind = getLoredeckEntryEditorString(fields.windowKindSelect?.value, 120);
    const label = getLoredeckEntryEditorString(fields.labelInput?.value, 240);
    const contextGate = {
        scope,
        anchorId,
        validFromAnchor: validFromAnchor || (scope === 'anchor' ? anchorId : ''),
        validToAnchor: validToAnchor || (scope === 'anchor' ? anchorId : ''),
        sortKeyFrom,
        sortKeyTo,
        precision,
        windowKind,
        label,
    };
    return Object.fromEntries(Object.entries(contextGate).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

function buildLoredeckRetrievalFromEditorFields(fields = {}) {
    if (!fields.activationSelect) return {};
    return {
        activation: getLoredeckEntryEditorString(fields.activationSelect.value, 80),
        frequency: getLoredeckEntryEditorString(fields.frequencySelect.value, 80),
        contextBoost: getLoredeckEntryEditorString(fields.contextBoostSelect.value, 80),
        triggers: {},
    };
}

function validateLoredeckV3EditorFields(contextGate = {}, retrieval = {}) {
    const errors = [];
    if (!['anchor', 'window', 'global'].includes(contextGate.scope)) errors.push('Context scope');
    if (!Number.isFinite(Number(contextGate.sortKeyFrom))) errors.push('sort key from');
    if (!Number.isFinite(Number(contextGate.sortKeyTo))) errors.push('sort key to');
    if (Number.isFinite(Number(contextGate.sortKeyFrom)) && Number.isFinite(Number(contextGate.sortKeyTo)) && Number(contextGate.sortKeyFrom) > Number(contextGate.sortKeyTo)) {
        errors.push('sort key order');
    }
    if (!getLoredeckEntryEditorString(contextGate.precision, 120)) errors.push('Context precision');
    if (!getLoredeckEntryEditorString(contextGate.label, 240)) errors.push('Context label');
    if (!getLoredeckEntryEditorString(retrieval.activation, 80)) errors.push('retrieval activation');
    if (!getLoredeckEntryEditorString(retrieval.frequency, 80)) errors.push('retrieval frequency');
    if (!getLoredeckEntryEditorString(retrieval.contextBoost, 80)) errors.push('retrieval boost');
    return errors;
}

function openLoredeckEntryOverrideDialog(pack, row = null) {
    const existing = document.querySelector('.saga-loredeck-entry-override-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-entry-override-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);

    const sourceEntry = row?.entry || {};
    const isExisting = !!row?.id;
    const entrySchemaVersion = Math.max(
        Number(sourceEntry.schemaVersion) || 0,
        getExpectedLoredeckEntrySchemaVersion(pack)
    );

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = isExisting ? 'Edit Lorecard' : 'New Lorecard';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${pack.title || pack.packId} | Pending override proposal`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without saving this entry override.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-entry-override-form';
    shell.appendChild(form);

    const idInput = createNewLoreInput(form, 'Lorecard ID', 'Stable Lorecard ID inside this Loredeck.', row?.id || '', false, 'my_custom_lorecard');
    idInput.disabled = isExisting;
    const titleInput = createNewLoreInput(form, 'Title', 'Short descriptive title.', sourceEntry.title || '', false, 'Custom Lorecard');
    const factInput = createNewLoreInput(form, 'Lore Text', 'The durable fact, rule, constraint, or state to remember.', sourceEntry.fact || sourceEntry.content?.fact || '', true, 'The durable lore fact to remember.');
    const injectionInput = createNewLoreInput(form, 'Injection Override', 'Optional model-facing phrasing; blank uses Lore Text.', sourceEntry.content?.injection || '', true, 'Optional model-facing wording.');
    const notesInput = createNewLoreInput(form, 'Notes', 'Optional private notes for this override.', sourceEntry.notes || sourceEntry.content?.notes || '', true, 'Why this entry was changed or added.');

    const metaGrid = document.createElement('div');
    metaGrid.className = 'saga-new-lore-meta-grid';
    form.appendChild(metaGrid);
    const categorySelect = createNewLoreSelect(metaGrid, 'Category', getLoreRegistryValues('categories', LORE_CATEGORY_VALUES), sourceEntry.category || 'other');
    const canonSelect = createNewLoreSelect(metaGrid, 'Canon', getLoreRegistryValues('canonStatuses', ['canon', 'au']), sourceEntry.canon || sourceEntry.canonStatus || 'au');
    const relevanceSelect = createNewLoreSelect(metaGrid, 'Relevance', LORE_RELEVANCE_TIERS, sourceEntry.relevance || 'normal', value => RELEVANCE_META[value]?.label || value);
    const prioritySelect = createNewLoreSelect(metaGrid, 'Priority', LORE_PRIORITY_VALUES.map(String), String(sourceEntry.priority || 50));
    const truthSelect = createNewLoreSelect(metaGrid, 'Truth', getLoreRegistryValues('truthStatuses', ['true', 'rumor', 'contested', 'hidden']), sourceEntry.truthStatus || 'true');
    const revealSelect = createNewLoreSelect(metaGrid, 'Reveal', getLoreRegistryValues('revealPolicies', ['private', 'public', 'do_not_reveal']), sourceEntry.revealPolicy || 'private');
    const tagsInput = createNewLoreInput(form, 'Tags', 'Comma-separated tags.', Array.isArray(sourceEntry.tags) ? sourceEntry.tags.join(', ') : '', false, 'au-change, custom-pack');

    let contextFields = null;
    let retrievalFields = null;
    if (entrySchemaVersion >= 3) {
        const sourceContext = sourceEntry.context && typeof sourceEntry.context === 'object' && !Array.isArray(sourceEntry.context) ? sourceEntry.context : {};
        const sourceRetrieval = sourceEntry.retrieval && typeof sourceEntry.retrieval === 'object' && !Array.isArray(sourceEntry.retrieval) ? sourceEntry.retrieval : {};
        const wideContext = sourceContext.scope === 'global' || ['wide', 'series'].includes(String(sourceContext.windowKind || '').trim());

        const contextGrid = appendLoredeckEntryEditorSection(form, 'Context');
        const scopeSelect = createNewLoreSelect(contextGrid, 'Scope', ['window', 'anchor', 'global'], sourceContext.scope || 'window', value => humanizeScopeKey(value));
        const anchorIdInput = createNewLoreInput(contextGrid, 'Anchor ID', 'Optional exact Context anchor ID for anchor-scoped entries.', sourceContext.anchorId || '', false, 'hp.ootp.year_5');
        const validFromAnchorInput = createNewLoreInput(contextGrid, 'From Anchor', 'Optional starting Context anchor ID.', sourceContext.validFromAnchor || sourceContext.anchorFrom || '', false, 'hp.ootp.year_5');
        const validToAnchorInput = createNewLoreInput(contextGrid, 'To Anchor', 'Optional ending Context anchor ID.', sourceContext.validToAnchor || sourceContext.anchorTo || '', false, 'hp.ootp.year_5');
        const sortKeyFromInput = createNewLoreInput(contextGrid, 'Sort From', 'Required numeric Context sort key where this entry starts being eligible.', getLoredeckEntryEditorNumberText(sourceContext.sortKeyFrom), false, '9374');
        const sortKeyToInput = createNewLoreInput(contextGrid, 'Sort To', 'Required numeric Context sort key where this entry stops being eligible.', getLoredeckEntryEditorNumberText(sourceContext.sortKeyTo), false, '9739');
        sortKeyFromInput.inputMode = 'decimal';
        sortKeyToInput.inputMode = 'decimal';
        const precisionInput = createNewLoreInput(contextGrid, 'Precision', 'Required precision label for this Context gate.', sourceContext.precision || '', false, 'anchor_window');
        const windowKindSelect = createNewLoreSelect(contextGrid, 'Window Kind', ['bounded', 'school_year', 'arc', 'phase', 'relative', 'wide', 'series'], sourceContext.windowKind || 'bounded', value => humanizeScopeKey(value));
        const labelInput = createNewLoreInput(contextGrid, 'Context Label', 'Required human-readable Context label.', sourceContext.label || '', false, 'After Year 5 begins');
        contextFields = {
            scopeSelect,
            anchorIdInput,
            validFromAnchorInput,
            validToAnchorInput,
            sortKeyFromInput,
            sortKeyToInput,
            precisionInput,
            windowKindSelect,
            labelInput,
        };
        form.appendChild(createLoredeckEntryAnchorPicker(pack, contextFields));

        const retrievalGrid = appendLoredeckEntryEditorSection(form, 'Retrieval');
        const activationSelect = createNewLoreSelect(retrievalGrid, 'Activation', ['topic_or_entity', 'context_or_topic', 'context_only', 'constant', 'manual'], sourceRetrieval.activation || 'topic_or_entity', value => humanizeScopeKey(value));
        const frequencySelect = createNewLoreSelect(retrievalGrid, 'Frequency', ['low', 'normal', 'high'], sourceRetrieval.frequency || (wideContext ? 'low' : 'normal'), value => humanizeScopeKey(value));
        const contextBoostSelect = createNewLoreSelect(retrievalGrid, 'Context Boost', ['low', 'medium', 'high'], sourceRetrieval.contextBoost || (wideContext ? 'low' : 'medium'), value => humanizeScopeKey(value));
        retrievalFields = {
            activationSelect,
            frequencySelect,
            contextBoostSelect,
        };
    }

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Queue Change', 'Queue this entry override for Pending Review.', () => {
        const id = isExisting ? row.id : normalizeLoredeckEntryId(idInput.value);
        const fact = factInput.value.trim();
        if (!id || !titleInput.value.trim() || !fact) {
            toast('Entry override needs an ID, title, and lore text.', 'warning');
            return;
        }
        const contextGate = buildLoredeckContextFromEditorFields(contextFields);
        const retrieval = buildLoredeckRetrievalFromEditorFields(retrievalFields);
        if (entrySchemaVersion >= 3) {
            const v3Errors = validateLoredeckV3EditorFields(contextGate, retrieval);
            if (v3Errors.length) {
                toast(`Schema v3 entry needs: ${v3Errors.join(', ')}.`, 'warning');
                return;
            }
        }
        let entry = normalizeLoreEntry({
            ...sourceEntry,
            id,
            title: titleInput.value.trim(),
            fact,
            category: categorySelect.value,
            canon: canonSelect.value,
            canonStatus: canonSelect.value,
            relevance: normalizeLoreRelevance(relevanceSelect.value),
            priority: Number(prioritySelect.value) || 50,
            truthStatus: truthSelect.value,
            revealPolicy: revealSelect.value,
            tags: parseLoredeckEntryTags(tagsInput.value),
            ...(entrySchemaVersion >= 3 ? {
                schemaVersion: 3,
                context: contextGate,
                retrieval,
            } : {}),
            source: sourceEntry.source || `saga-loredeck:${pack.packId}:override`,
            sourceInfo: {
                ...(sourceEntry.sourceInfo || {}),
                work: pack.title || pack.packId,
                notes: 'Saved as a Custom Loredeck entry override.',
                confidence: Number(sourceEntry.sourceInfo?.confidence || 1),
            },
            content: {
                ...(sourceEntry.content || {}),
                fact,
                injection: injectionInput.value.trim() || fact,
                notes: notesInput.value.trim(),
            },
            userEditable: true,
            userEdited: true,
            extensions: {
                ...(sourceEntry.extensions || {}),
                sagaLoredeckOverride: {
                    kind: row?.sourceEntry ? 'override' : 'addition',
                    packId: pack.packId,
                    sourceEntryId: row?.sourceEntry?.id || '',
                    updatedAt: Date.now(),
                },
            },
        });
        entry.id = id;
        entry.tags = parseLoredeckEntryTags(tagsInput.value);
        if (entrySchemaVersion >= 3) {
            entry = normalizeLoredeckEntryForSchemaV3({
                ...entry,
                id,
                schemaVersion: 3,
                context: contextGate,
                retrieval,
            });
            entry.tags = parseLoredeckEntryTags(tagsInput.value);
        }
        saveLoredeckEntryOverride(pack, entry);
        overlay.remove();
    }, 'saga-primary-button'));
    if (isExisting) {
        actions.appendChild(createButton(row?.disabled ? 'Restore Entry' : 'Disable Entry', row?.disabled ? 'Restore this entry in the Custom Loredeck.' : 'Suppress this entry in the Custom Loredeck.', () => {
            setLoredeckEntryDisabled(pack, row.id, !row.disabled);
            overlay.remove();
        }));
    }
    actions.appendChild(createButton('Cancel', 'Close without saving this entry override.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => (isExisting ? titleInput : idInput).focus());
}

function buildBulkLoredeckTagOverrideEntry(pack, row, tags = []) {
    const baseEntry = row.overrideEntry || row.sourceEntry || row.entry || {};
    const entrySchemaVersion = Math.max(Number(baseEntry.schemaVersion) || 0, getExpectedLoredeckEntrySchemaVersion(pack));
    const id = String(row.id || baseEntry.id || '').trim();
    const title = String(baseEntry.title || id || 'Lorecard').trim();
    const fact = String(baseEntry.content?.fact || baseEntry.fact || baseEntry.description || baseEntry.detail || title).trim();
    const injection = String(baseEntry.content?.injection || baseEntry.injection || fact).trim();
    const cleanTags = parseLoredeckEntryTags(tags);
    let entry = normalizeLoreEntry({
        ...baseEntry,
        id,
        title,
        tags: cleanTags,
        content: {
            ...(baseEntry.content || {}),
            fact,
            injection,
        },
        userEditable: true,
        userEdited: true,
        extensions: {
            ...(baseEntry.extensions || {}),
            sagaLoredeckOverride: {
                kind: row.sourceEntry ? 'override' : 'addition',
                packId: pack.packId,
                sourceEntryId: row.sourceEntry?.id || '',
                updatedAt: Date.now(),
            },
        },
    });
    entry.id = id;
    entry.tags = cleanTags;
    if (entrySchemaVersion >= 3) {
        entry = normalizeLoredeckEntryForSchemaV3({
            ...entry,
            id,
            schemaVersion: 3,
            tags: cleanTags,
        });
        entry.tags = cleanTags;
    }
    return entry;
}

function computeLoredeckBulkTagUpdates(pack, rows = [], mode = 'add', fields = {}) {
    const updates = [];
    const addTags = parseLoredeckEntryTags(fields.addTags);
    const removeTags = parseLoredeckEntryTags(fields.removeTags);
    const fromTag = parseLoredeckEntryTags([fields.fromTag])[0] || '';
    const toTag = parseLoredeckEntryTags([fields.toTag])[0] || '';

    for (const row of getLoredeckEntryRowsForBulk(rows)) {
        const current = getLoredeckEntryTags(row.entry || {});
        let next = current;
        if (mode === 'add') next = mergeLoredeckEntryTags(current, addTags);
        else if (mode === 'remove') next = removeLoredeckEntryTags(current, removeTags);
        else if (mode === 'replace') next = replaceLoredeckEntryTag(current, fromTag, toTag);

        if (JSON.stringify(current.map(tag => tag.toLowerCase()).sort()) === JSON.stringify(next.map(tag => tag.toLowerCase()).sort())) continue;
        updates.push(buildBulkLoredeckTagOverrideEntry(pack, row, next));
    }
    return updates;
}

function isLoredeckMalformedTagIssueGroup(group = {}) {
    const codes = new Set(['malformed_tag_namespace', 'malformed_tag_id', 'malformed_tag_reference']);
    if (codes.has(String(group.code || '').trim())) return true;
    return (group.issues || []).some(issue => codes.has(String(issue?.code || '').trim()));
}

function getLoredeckMalformedTagRepairPairs(group = {}) {
    const tags = [];
    const push = (value) => {
        const raw = String(value || '').trim();
        if (raw) tags.push(raw);
    };
    for (const tag of group.tagIds || []) push(tag);
    for (const issue of group.issues || []) {
        for (const tag of collectLoredeckHealthIssueTags(issue)) push(tag);
    }

    const byRaw = new Map();
    for (const from of tags) {
        const to = suggestLoredeckMachineId(from);
        if (!to || to.toLowerCase() === from.toLowerCase()) continue;
        const key = from.toLowerCase();
        if (!byRaw.has(key)) {
            byRaw.set(key, {
                from,
                to,
            });
        }
    }
    return [...byRaw.values()].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
}

function getLoredeckRawEntryTagsForRepair(entry = {}) {
    const source = Array.isArray(entry?.tags)
        ? entry.tags
        : (entry?.tags ? String(entry.tags).split(/[,;\n\r]+/) : []);
    const tags = [];
    const seen = new Set();
    for (const raw of source) {
        const text = String(raw || '').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(text);
    }
    return tags;
}

function buildLoredeckMalformedTagRepairEntryTags(entry = {}, pairByRawKey = new Map()) {
    const rawTags = getLoredeckRawEntryTagsForRepair(entry);
    const tags = [];
    const seen = new Set();
    let changed = false;
    for (const raw of rawTags) {
        const pair = pairByRawKey.get(raw.toLowerCase());
        const next = pair?.to || normalizeLoredeckTagId(raw);
        if (!next) {
            changed = true;
            continue;
        }
        if (pair && next.toLowerCase() !== raw.toLowerCase()) changed = true;
        const key = next.toLowerCase();
        if (seen.has(key)) {
            changed = true;
            continue;
        }
        seen.add(key);
        tags.push(next);
    }
    return { tags, changed };
}

function getLoredeckResolvedTagDefinitionForRepair(pack = {}, fromTag = '', toTag = '') {
    const target = normalizeLoredeckTagId(toTag);
    const source = normalizeLoredeckTagId(fromTag);
    const custom = getLoredeckEmbeddedTagRegistry(pack);
    const cached = getLoredeckCachedSourceTagRegistry(pack?.packId);
    const def = custom.tags?.[target]
        || cached.tags?.[target]
        || custom.tags?.[source]
        || cached.tags?.[source]
        || null;
    return normalizeLoredeckTagDefinition(def || {
        label: humanizeLoredeckTagId(fromTag),
        description: '',
    }, target);
}

function buildLoredeckMalformedTagRepairPlan(pack = {}, group = {}, sourceEntries = []) {
    const pairs = getLoredeckMalformedTagRepairPairs(group);
    if (!pairs.length) return null;
    const pairByRawKey = new Map(pairs.map(pair => [pair.from.toLowerCase(), pair]));
    const affectedEntryIdSet = new Set(normalizeLoredeckPendingIdList(group.entryIds || []));
    const rows = getLoredeckEditableEntryRows(pack, sourceEntries);
    const entryOverrides = {};
    const entryIds = [];

    for (const row of rows) {
        if (!row?.id || row.disabled) continue;
        const rawTags = getLoredeckRawEntryTagsForRepair(row.entry || {});
        const hasAffectedTag = rawTags.some(tag => pairByRawKey.has(tag.toLowerCase()));
        if (!hasAffectedTag && affectedEntryIdSet.size && !affectedEntryIdSet.has(row.id)) continue;
        if (!hasAffectedTag) continue;
        const repaired = buildLoredeckMalformedTagRepairEntryTags(row.entry || {}, pairByRawKey);
        if (!repaired.changed) continue;
        const entry = buildBulkLoredeckTagOverrideEntry(pack, row, repaired.tags);
        if (!entry.id) continue;
        entryOverrides[entry.id] = entry;
        entryIds.push(entry.id);
    }

    const existingTargetIds = new Set();
    const tagDefinitions = {};
    for (const pair of pairs) {
        const target = normalizeLoredeckTagId(pair.to);
        if (!target || existingTargetIds.has(target.toLowerCase())) continue;
        existingTargetIds.add(target.toLowerCase());
        const existing = getLoredeckPendingCurrentTagDefinition(pack, target);
        if (existing) continue;
        const def = getLoredeckResolvedTagDefinitionForRepair(pack, pair.from, target);
        def.label = def.label || humanizeLoredeckTagId(pair.from);
        def.deprecated = false;
        def.replacement = '';
        delete def.id;
        tagDefinitions[target] = def;
    }

    return {
        pairs,
        entryOverrides,
        entryIds,
        tagDefinitions,
    };
}

async function queueLoredeckMalformedTagRepairFromHealthGroup(pack, group = {}, button = null) {
    await runBusyAction(button, 'Queueing...', async () => {
        const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
        if (!fresh || fresh.type === 'bundled') {
            toast('Bundled Loredecks cannot be repaired directly. Duplicate as Custom first.', 'warning');
            return;
        }
        const validation = await validateLoredeckForEditor(fresh, null, { quiet: true, updateLibrary: false });
        if (!validation.health) throw new Error(validation.error || 'Deck Health validation failed before repair planning.');
        const plan = buildLoredeckMalformedTagRepairPlan(fresh, group, validation.entryCache?.entries || []);
        if (!plan || (!Object.keys(plan.entryOverrides).length && !Object.keys(plan.tagDefinitions).length)) {
            toast('No deterministic malformed tag repair could be queued from this health group.', 'info');
            return;
        }
        const mapping = plan.pairs.map(pair => `${pair.from} -> ${pair.to}`).join(', ');
        const queued = queueLoredeckPendingChange(fresh, createLoredeckRecordPatchChange({
            source: 'safe_repair',
            action: 'normalize_malformed_tag_ids',
            targetKind: 'tags',
            title: 'Normalize malformed tag IDs',
            description: `Replaces malformed tag IDs with machine-safe IDs after review. ${plan.entryIds.length} Lorecard${plan.entryIds.length === 1 ? '' : 's'} will receive Custom overrides.`,
            affectedEntryIds: plan.entryIds,
            affectedTagIds: plan.pairs.flatMap(pair => [pair.from, pair.to]),
            payload: {
                tagDefinitions: plan.tagDefinitions,
                entryOverrides: plan.entryOverrides,
                disabledEntryIdsRemove: plan.entryIds,
            },
            preview: {
                before: plan.pairs.map(pair => pair.from).join(', '),
                after: mapping,
                repairMap: plan.pairs,
                healthIssueCode: group.code || 'malformed_tag_namespace',
            },
        }), `Queued malformed tag ID repair for ${plan.pairs.length} tag${plan.pairs.length === 1 ? '' : 's'}. Accept it in Pending Review, then rerun Deck Health.`);
        if (queued) {
            loredeckHealthRepairSelectionCache.delete(fresh.packId);
        }
    });
}

function openLoredeckBulkTagsDialog(pack, rows = [], options = {}) {
    const editableRows = getLoredeckEntryRowsForBulk(rows);
    if (!editableRows.length) {
        toast('No editable entries are available for bulk tag editing.', 'warning');
        return;
    }

    const existing = document.querySelector('.saga-loredeck-bulk-tags-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-bulk-tags-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Bulk Tags';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${pack.title || pack.packId} | ${editableRows.length} entr${editableRows.length === 1 ? 'y' : 'ies'}`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without applying bulk tag edits.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-entry-override-form';
    shell.appendChild(form);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Bulk tag edits create pending Custom override proposals. They do not affect runtime injection until accepted.';
    form.appendChild(help);

    const grid = appendLoredeckEntryEditorSection(form, 'Tag Operation');
    const modeSelect = createNewLoreSelect(grid, 'Mode', ['add', 'remove', 'replace'], options.mode || 'add', value => humanizeScopeKey(value));
    const addInput = createNewLoreInput(grid, 'Tags To Add', 'Comma-separated tags to add in Add mode.', options.addTags || '', false, 'character:hermione-granger, meta:crossover');
    const removeInput = createNewLoreInput(grid, 'Tags To Remove', 'Comma-separated tags to remove in Remove mode.', options.removeTags || '', false, 'deprecated:old-tag');
    const fromInput = createNewLoreInput(grid, 'Rename From', 'Existing tag to rename or delete in Replace mode.', options.fromTag || '', false, 'character:old-name');
    const toInput = createNewLoreInput(grid, 'Rename To', 'Replacement tag in Replace mode. Leave blank to delete Rename From.', options.toTag || '', false, 'character:new-name');

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Queue Tags', 'Queue this tag operation for Pending Review.', () => {
        const mode = modeSelect.value;
        if (mode === 'add' && !parseLoredeckEntryTags(addInput.value).length) {
            toast('Enter at least one tag to add.', 'warning');
            return;
        }
        if (mode === 'remove' && !parseLoredeckEntryTags(removeInput.value).length) {
            toast('Enter at least one tag to remove.', 'warning');
            return;
        }
        if (mode === 'replace' && !parseLoredeckEntryTags([fromInput.value]).length) {
            toast('Enter the tag to rename or delete.', 'warning');
            return;
        }

        const updates = computeLoredeckBulkTagUpdates(pack, editableRows, mode, {
            addTags: addInput.value,
            removeTags: removeInput.value,
            fromTag: fromInput.value,
            toTag: toInput.value,
        });
        if (!updates.length) {
            toast('No tag changes were needed for the target entries.', 'info');
            return;
        }
        const entryOverrides = {};
        const entryIds = [];
        for (const entry of updates) {
            if (!entry.id) continue;
            entryOverrides[entry.id] = entry;
            entryIds.push(entry.id);
        }
        const applied = queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
            action: 'bulk_tag_update',
            targetKind: 'entries',
            title: `Bulk tag ${mode}`,
            description: `Updates tags on ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'} after review.`,
            affectedEntryIds: entryIds,
            affectedTagIds: [
                ...parseLoredeckEntryTags(addInput.value),
                ...parseLoredeckEntryTags(removeInput.value),
                ...parseLoredeckEntryTags([fromInput.value]),
                ...parseLoredeckEntryTags([toInput.value]),
            ],
            payload: {
                entryOverrides,
                disabledEntryIdsRemove: entryIds,
            },
            preview: {
                after: `Tag changes will apply to ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}.`,
            },
        }), `Queued bulk tag update for ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}.`);
        if (applied) overlay.remove();
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without applying bulk tag edits.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => {
        if (options.mode === 'replace') fromInput.focus();
        else if (options.mode === 'remove') removeInput.focus();
        else addInput.focus();
    });
}

function createLoredeckCheckbox(container, labelText, tooltip, checked = false) {
    const label = document.createElement('label');
    label.className = 'saga-inline-toggle';
    addTooltip(label, tooltip);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    label.appendChild(input);
    label.appendChild(document.createTextNode(` ${labelText}`));
    container.appendChild(label);
    return input;
}

function saveLoredeckTagRegistryDefinition(pack, tagId, definition, message = '') {
    const id = normalizeLoredeckTagId(tagId);
    if (!id) {
        toast('Tag definition needs a valid tag ID.', 'warning');
        return false;
    }
    const def = normalizeLoredeckTagDefinition(definition, id);
    delete def.id;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_tag_definition',
        targetKind: 'tag',
        title: `Save tag definition: ${id}`,
        description: 'Creates or updates a Custom tag registry definition after review.',
        affectedTagIds: [id],
        payload: {
            tagDefinitions: { [id]: def },
        },
        preview: {
            after: def.description || def.label || id,
        },
    }), message || `Queued pending tag definition for ${id}.`);
}

function removeLoredeckTagRegistryDefinition(pack, tagId) {
    const id = normalizeLoredeckTagId(tagId);
    if (!id) return false;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'remove_tag_definition',
        targetKind: 'tag',
        title: `Forget tag definition: ${id}`,
        description: 'Removes the Custom tag registry definition after review without changing entry tags.',
        affectedTagIds: [id],
        payload: {
            tagDefinitions: { [id]: null },
        },
        preview: {
            after: 'Custom tag definition will be removed.',
        },
    }), `Queued pending tag definition removal for ${id}.`);
}

function openLoredeckTagRegistryDialog(pack, item = null) {
    if (pack.type === 'bundled') {
        toast('Bundled Loredeck tag registries are read-only. Duplicate as Custom first.', 'warning');
        return;
    }
    const existing = document.querySelector('.saga-loredeck-tag-registry-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-tag-registry-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);

    const tagId = normalizeLoredeckTagId(item?.tag || '');
    const definition = normalizeLoredeckTagDefinition(item?.definition || {}, tagId);
    const isExisting = !!tagId;

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = isExisting ? 'Edit Tag Definition' : 'New Tag Definition';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${pack.title || pack.packId} | Pending tag registry proposal`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without saving this tag definition.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-entry-override-form';
    shell.appendChild(form);

    const idInput = createNewLoreInput(form, 'Tag ID', 'Stable tag ID used by entries and registries.', tagId, false, 'character:nami');
    idInput.disabled = isExisting;
    const labelInput = createNewLoreInput(form, 'Label', 'Short display label for this tag.', definition.label || humanizeLoredeckTagId(tagId), false, 'Nami');
    const descriptionInput = createNewLoreInput(form, 'Description', 'What this tag groups or signals.', definition.description || '', true, 'Entries about Nami during Arlong Park.');

    const grid = appendLoredeckEntryEditorSection(form, 'Registry Metadata');
    const colorInput = createNewLoreInput(grid, 'Color', 'Optional chip background color.', definition.color || '', false, '#4c1d95');
    const textColorInput = createNewLoreInput(grid, 'Text Color', 'Optional chip text color.', definition.textColor || '', false, '#f3e8ff');
    const aliasesInput = createNewLoreInput(grid, 'Aliases', 'Comma-separated search aliases.', Array.isArray(definition.aliases) ? definition.aliases.join(', ') : '', false, 'Cat Burglar, navigator');
    const parentsInput = createNewLoreInput(grid, 'Parents', 'Comma-separated parent tag IDs.', Array.isArray(definition.parents) ? definition.parents.join(', ') : '', false, 'character:straw-hats');
    const replacementInput = createNewLoreInput(grid, 'Replacement', 'Optional replacement tag ID for deprecated tags.', definition.replacement || '', false, 'character:nami');
    const sensitiveInput = createLoredeckCheckbox(grid, 'Sensitive', 'Mark this tag as sensitive, secret, or spoiler-prone.', definition.sensitive === true);
    const deprecatedInput = createLoredeckCheckbox(grid, 'Deprecated', 'Mark this tag as deprecated while keeping it visible for cleanup.', definition.deprecated === true);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Queue Definition', 'Queue this tag definition for Pending Review.', () => {
        const id = isExisting ? tagId : normalizeLoredeckTagId(idInput.value);
        if (!id) {
            toast('Enter a valid tag ID.', 'warning');
            return;
        }
        const replacement = normalizeLoredeckTagId(replacementInput.value);
        if (deprecatedInput.checked && replacement && replacement.toLowerCase() === id.toLowerCase()) {
            toast('A deprecated tag replacement must be a different tag.', 'warning');
            return;
        }
        const saved = saveLoredeckTagRegistryDefinition(pack, id, {
            label: labelInput.value.trim() || humanizeLoredeckTagId(id),
            description: descriptionInput.value.trim(),
            color: colorInput.value.trim(),
            textColor: textColorInput.value.trim(),
            aliases: normalizeLoredeckTagTextList(aliasesInput.value, 64, false),
            parents: normalizeLoredeckTagTextList(parentsInput.value, 64, true),
            sensitive: sensitiveInput.checked,
            deprecated: deprecatedInput.checked,
            replacement,
        }, `Saved tag definition for ${id}.`);
        if (saved) overlay.remove();
    }, 'saga-primary-button'));
    if (isExisting && item?.customDefined) {
        actions.appendChild(createButton('Forget Definition', 'Remove this Custom registry definition without changing entry tags.', () => {
            const removed = removeLoredeckTagRegistryDefinition(pack, tagId);
            if (removed) overlay.remove();
        }, 'saga-danger-button'));
    }
    actions.appendChild(createButton('Cancel', 'Close without saving this tag definition.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => (isExisting ? labelInput : idInput).focus());
}

function openLoredeckTagRenameDialog(pack, rows = [], item = {}) {
    if (pack.type === 'bundled') {
        toast('Bundled Loredecks cannot be edited directly. Duplicate as Custom first.', 'warning');
        return;
    }
    const fromTag = normalizeLoredeckTagId(item?.tag || '');
    if (!fromTag) {
        toast('Rename needs a source tag.', 'warning');
        return;
    }
    const existing = document.querySelector('.saga-loredeck-tag-rename-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-tag-rename-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Rename / Merge Tag';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${pack.title || pack.packId} | ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} currently use ${fromTag}`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without renaming this tag.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-entry-override-form';
    shell.appendChild(form);

    const fromInput = createNewLoreInput(form, 'From Tag', 'Existing tag to rename or merge.', fromTag, false, 'character:old-name');
    fromInput.disabled = true;
    const toInput = createNewLoreInput(form, 'To Tag', 'Replacement tag ID. If it already exists, this becomes a merge.', item?.definition?.replacement || '', false, 'character:new-name');
    const updateEntriesInput = createLoredeckCheckbox(form, 'Update entry tags', 'Create Custom overrides that replace this tag on affected entries.', true);
    const deprecatedInput = createLoredeckCheckbox(form, 'Deprecate old tag', 'Keep the old tag definition as deprecated with a replacement pointer.', true);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Queue Rename', 'Queue this tag rename or merge for Pending Review.', () => {
        const toTag = normalizeLoredeckTagId(toInput.value);
        if (!toTag) {
            toast('Enter a replacement tag.', 'warning');
            return;
        }
        if (toTag.toLowerCase() === fromTag.toLowerCase()) {
            toast('Replacement tag must be different.', 'warning');
            return;
        }
        const updates = updateEntriesInput.checked
            ? computeLoredeckBulkTagUpdates(pack, rows, 'replace', { fromTag, toTag })
            : [];
        const sourceDef = normalizeLoredeckTagDefinition(item.definition || {}, fromTag);
        const tagDefinitions = {};
        const targetDef = normalizeLoredeckTagDefinition({
            ...sourceDef,
            label: sourceDef.label && sourceDef.label !== humanizeLoredeckTagId(fromTag)
                ? sourceDef.label
                : humanizeLoredeckTagId(toTag),
            deprecated: false,
            replacement: '',
        }, toTag);
        delete targetDef.id;
        tagDefinitions[toTag] = targetDef;

        if (deprecatedInput.checked || item.sourceDefined) {
            const oldDef = normalizeLoredeckTagDefinition({
                ...sourceDef,
                deprecated: true,
                replacement: toTag,
            }, fromTag);
            delete oldDef.id;
            tagDefinitions[fromTag] = oldDef;
        } else {
            tagDefinitions[fromTag] = null;
        }

        const entryOverrides = {};
        const entryIds = [];
        for (const entry of updates) {
            if (!entry.id) continue;
            entryOverrides[entry.id] = entry;
            entryIds.push(entry.id);
        }

        const applied = queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
            action: 'rename_tag',
            targetKind: 'tags',
            title: `Rename tag: ${fromTag} -> ${toTag}`,
            description: `Renames or merges a tag definition${entryIds.length ? ` and updates ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}` : ''} after review.`,
            affectedEntryIds: entryIds,
            affectedTagIds: [fromTag, toTag],
            payload: {
                tagDefinitions,
                entryOverrides,
                disabledEntryIdsRemove: entryIds,
            },
            preview: {
                before: fromTag,
                after: toTag,
            },
        }), `Queued tag rename ${fromTag} -> ${toTag}.`);
        if (applied) overlay.remove();
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without renaming this tag.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => toInput.focus());
}

function buildBulkLoredeckContextOverrideEntry(pack, row, contextGate, retrieval) {
    const baseEntry = row.overrideEntry || row.sourceEntry || row.entry || {};
    const id = String(row.id || baseEntry.id || '').trim();
    const title = String(baseEntry.title || id || 'Lorecard').trim();
    const fact = String(baseEntry.content?.fact || baseEntry.fact || baseEntry.description || baseEntry.detail || title).trim();
    const injection = String(baseEntry.content?.injection || baseEntry.injection || fact).trim();
    let entry = normalizeLoreEntry({
        ...baseEntry,
        id,
        title,
        schemaVersion: 3,
        context: contextGate,
        retrieval,
        tags: getLoredeckEntryTags(baseEntry),
        content: {
            ...(baseEntry.content || {}),
            fact,
            injection,
        },
        userEditable: true,
        userEdited: true,
        extensions: {
            ...(baseEntry.extensions || {}),
            sagaLoredeckOverride: {
                kind: row.sourceEntry ? 'override' : 'addition',
                packId: pack.packId,
                sourceEntryId: row.sourceEntry?.id || '',
                updatedAt: Date.now(),
            },
        },
    });
    entry.id = id;
    entry.tags = getLoredeckEntryTags(baseEntry);
    return normalizeLoredeckEntryForSchemaV3({
        ...entry,
        id,
        schemaVersion: 3,
        context: contextGate,
        retrieval,
        tags: getLoredeckEntryTags(baseEntry),
    });
}

function openLoredeckBulkContextDialog(pack, rows = []) {
    const entrySchemaVersion = getExpectedLoredeckEntrySchemaVersion(pack);
    if (entrySchemaVersion < 3) {
        toast('Bulk Context editing is available for schema v3 Loredecks.', 'warning');
        return;
    }

    const editableRows = (rows || []).filter(row => row?.id && !row.disabled);
    if (!editableRows.length) {
        toast('No editable entries are available for bulk Context editing.', 'warning');
        return;
    }

    const existing = document.querySelector('.saga-loredeck-bulk-context-overlay');
    existing?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'saga-new-lore-overlay saga-loredeck-bulk-context-overlay';
    wireOverlayBackdropClose(overlay, () => overlay.remove());
    document.body.appendChild(overlay);

    const shell = document.createElement('div');
    shell.className = 'saga-new-lore-shell saga-loredeck-entry-override-shell';
    overlay.appendChild(shell);

    const header = document.createElement('div');
    header.className = 'saga-lore-workbench-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-lore-workbench-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-lore-workbench-title';
    title.textContent = 'Bulk Context';
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-lore-workbench-subtitle';
    subtitle.textContent = `${pack.title || pack.packId} | ${editableRows.length} entr${editableRows.length === 1 ? 'y' : 'ies'}`;
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);
    header.appendChild(createButton('Close', 'Close without applying bulk Context edits.', () => overlay.remove()));
    shell.appendChild(header);

    const form = document.createElement('div');
    form.className = 'saga-new-lore-form saga-loredeck-entry-override-form';
    shell.appendChild(form);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'This queues Custom override proposals for the chosen entries. Runtime injection is unchanged until the proposals are accepted.';
    form.appendChild(help);

    const contextGrid = appendLoredeckEntryEditorSection(form, 'Context');
    const scopeSelect = createNewLoreSelect(contextGrid, 'Scope', ['window', 'anchor', 'global'], 'window', value => humanizeScopeKey(value));
    const anchorIdInput = createNewLoreInput(contextGrid, 'Anchor ID', 'Optional exact Context anchor ID for anchor-scoped entries.', '', false, 'hp.ootp.year_5');
    const validFromAnchorInput = createNewLoreInput(contextGrid, 'From Anchor', 'Optional starting Context anchor ID.', '', false, 'hp.ootp.year_5');
    const validToAnchorInput = createNewLoreInput(contextGrid, 'To Anchor', 'Optional ending Context anchor ID.', '', false, 'hp.ootp.year_5');
    const sortKeyFromInput = createNewLoreInput(contextGrid, 'Sort From', 'Required numeric Context sort key where these entries start being eligible.', '', false, '9374');
    const sortKeyToInput = createNewLoreInput(contextGrid, 'Sort To', 'Required numeric Context sort key where these entries stop being eligible.', '', false, '9739');
    sortKeyFromInput.inputMode = 'decimal';
    sortKeyToInput.inputMode = 'decimal';
    const precisionInput = createNewLoreInput(contextGrid, 'Precision', 'Required precision label for this Context gate.', 'anchor_window', false, 'anchor_window');
    const windowKindSelect = createNewLoreSelect(contextGrid, 'Window Kind', ['bounded', 'school_year', 'arc', 'phase', 'relative', 'wide', 'series'], 'bounded', value => humanizeScopeKey(value));
    const labelInput = createNewLoreInput(contextGrid, 'Context Label', 'Required human-readable Context label.', '', false, 'After Year 5 begins');
    const contextFields = {
        scopeSelect,
        anchorIdInput,
        validFromAnchorInput,
        validToAnchorInput,
        sortKeyFromInput,
        sortKeyToInput,
        precisionInput,
        windowKindSelect,
        labelInput,
    };
    form.appendChild(createLoredeckEntryAnchorPicker(pack, contextFields));

    const retrievalGrid = appendLoredeckEntryEditorSection(form, 'Retrieval');
    const activationSelect = createNewLoreSelect(retrievalGrid, 'Activation', ['topic_or_entity', 'context_or_topic', 'context_only', 'constant', 'manual'], 'topic_or_entity', value => humanizeScopeKey(value));
    const frequencySelect = createNewLoreSelect(retrievalGrid, 'Frequency', ['low', 'normal', 'high'], 'normal', value => humanizeScopeKey(value));
    const contextBoostSelect = createNewLoreSelect(retrievalGrid, 'Context Boost', ['low', 'medium', 'high'], 'medium', value => humanizeScopeKey(value));
    const retrievalFields = {
        activationSelect,
        frequencySelect,
        contextBoostSelect,
    };

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Queue For Review', 'Queue Custom overrides with this Context and retrieval metadata.', () => {
        const contextGate = buildLoredeckContextFromEditorFields(contextFields);
        const retrieval = buildLoredeckRetrievalFromEditorFields(retrievalFields);
        const v3Errors = validateLoredeckV3EditorFields(contextGate, retrieval);
        if (v3Errors.length) {
            toast(`Schema v3 entries need: ${v3Errors.join(', ')}.`, 'warning');
            return;
        }
        const entryOverrides = {};
        const entryIds = [];
        for (const row of editableRows) {
            const entry = buildBulkLoredeckContextOverrideEntry(pack, row, contextGate, retrieval);
            if (!entry.id) continue;
            entryOverrides[entry.id] = entry;
            entryIds.push(entry.id);
        }
        const applied = queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
            action: 'bulk_context_update',
            targetKind: 'entries',
            title: 'Bulk Context update',
            description: `Applies one Context/retrieval block to ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'} after review.`,
            affectedEntryIds: entryIds,
            payload: {
                entryOverrides,
                disabledEntryIdsRemove: entryIds,
            },
            preview: {
                after: context.label || 'Context metadata will be updated.',
            },
        }), `Queued Context update for ${entryIds.length} entr${entryIds.length === 1 ? 'y' : 'ies'}.`);
        if (applied) overlay.remove();
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Cancel', 'Close without applying bulk Context edits.', () => overlay.remove()));
    form.appendChild(actions);

    requestAnimationFrame(() => labelInput.focus());
}

function getFreshLoredeckLibraryPack(packId, fallback = null) {
    return getLoredeckDefinition(packId) || fallback;
}

function persistLoredeckLibraryRecordMutation(pack, mutator, message, options = {}) {
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    if (!fresh || fresh.type === 'bundled') {
        toast('Bundled Loredecks cannot be edited directly. Duplicate as Custom first.', 'warning');
        return false;
    }
    const next = {
        ...fresh,
        entryOverrides: { ...(fresh.entryOverrides || {}) },
        disabledEntryIds: Array.isArray(fresh.disabledEntryIds) ? [...fresh.disabledEntryIds] : [],
        tagRegistry: normalizeLoredeckTagRegistry(fresh.tagRegistry),
        timelineRegistry: normalizeLoredeckTimelineRegistry(fresh.timelineRegistry),
        pendingChanges: normalizeLoredeckPendingChanges(fresh.pendingChanges),
        healthIssueStates: normalizeLoredeckHealthIssueStates(fresh.healthIssueStates),
        localModified: true,
        updatedAt: Date.now(),
    };
    mutator(next);
    const normalizedTagRegistry = normalizeLoredeckTagRegistry(next.tagRegistry);
    if (getLoredeckTagRegistryCount(normalizedTagRegistry)) next.tagRegistry = normalizedTagRegistry;
    else next.tagRegistry = { schemaVersion: 1, tags: {} };
    const normalizedTimelineRegistry = normalizeLoredeckTimelineRegistry(next.timelineRegistry);
    if (getLoredeckTimelineRegistryCount(normalizedTimelineRegistry)) next.timelineRegistry = normalizedTimelineRegistry;
    else next.timelineRegistry = { schemaVersion: 1, timelineMode: 'hybrid', sortKeyScale: 'pack_local', anchors: [], windows: [] };
    const normalizedPendingChanges = normalizeLoredeckPendingChanges(next.pendingChanges);
    if (normalizedPendingChanges.length) next.pendingChanges = normalizedPendingChanges;
    else next.pendingChanges = [];
    const normalizedHealthIssueStates = normalizeLoredeckHealthIssueStates(next.healthIssueStates);
    if (Object.keys(normalizedHealthIssueStates).length) next.healthIssueStates = normalizedHealthIssueStates;
    else next.healthIssueStates = {};
    if (isVirtualLoredeckPack(next)) {
        next.manifestData = buildEmbeddedCustomManifest(next.manifestData, next);
    }
    const result = upsertLoredeckLibraryPack(next);
    if (!result.ok) {
        toast(result.error || options.errorMessage || 'Loredeck save failed.', 'error');
        return false;
    }
    refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    if (message) toast(message, 'success');
    return true;
}

function persistLoredeckEntryLayer(pack, mutator, message) {
    return persistLoredeckLibraryRecordMutation(pack, mutator, message, {
        errorMessage: 'Loredeck entry layer save failed.',
    });
}

function persistLoredeckTagRegistryLayer(pack, mutator, message) {
    return persistLoredeckLibraryRecordMutation(pack, mutator, message, {
        errorMessage: 'Loredeck tag registry save failed.',
    });
}

function queueLoredeckPendingChange(pack, change, message = '') {
    const pendingChange = normalizeLoredeckPendingChanges([change])[0];
    if (!pendingChange) {
        toast('Could not queue Loredeck change.', 'error');
        return false;
    }
    return persistLoredeckLibraryRecordMutation(pack, next => {
        const pending = normalizeLoredeckPendingChanges(next.pendingChanges);
        pending.push(pendingChange);
        next.pendingChanges = pending;
    }, message || `Queued pending change: ${pendingChange.title}.`, {
        errorMessage: 'Loredeck pending change save failed.',
    });
}

function queueLoredeckPendingChanges(pack, changes = [], message = '') {
    const pendingChanges = normalizeLoredeckPendingChanges(changes);
    if (!pendingChanges.length) {
        toast('Could not queue Loredeck changes.', 'error');
        return false;
    }
    return persistLoredeckLibraryRecordMutation(pack, next => {
        const pending = normalizeLoredeckPendingChanges(next.pendingChanges);
        pending.push(...pendingChanges);
        next.pendingChanges = pending;
    }, message || `Queued ${pendingChanges.length} pending Loredeck change${pendingChanges.length === 1 ? '' : 's'}.`, {
        errorMessage: 'Loredeck pending change save failed.',
    });
}

async function refreshLoredeckHealthAfterAcceptedPendingChanges(pack = {}, acceptedCount = 0) {
    const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
    if (!fresh) return null;
    if (!canValidateLoredeckInEditor(fresh)) {
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        if (isGeneratedLoredeckPack(fresh) && !getAcceptedVirtualLoredeckEntries(fresh).length) {
            return { skipped: true, reason: 'generated_shell_without_entries' };
        }
        toast('Accepted changes, but Deck Health could not rerun because this Loredeck is not validatable yet.', 'warning');
        return { skipped: true, reason: 'not_validatable' };
    }
    const validation = await validateLoredeckForEditor(fresh, null, { quiet: true, updateLibrary: true });
    if (!validation.health) {
        refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
        toast(validation.error || 'Accepted changes, but Deck Health rerun failed. Health remains stale.', 'warning');
        return null;
    }
    clearCanonLoreDatabaseCache();
    clearContextIndexCache();
    refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    const summary = validation.health.summary || {};
    const issueText = `${summary.errorCount || 0} error${(summary.errorCount || 0) === 1 ? '' : 's'}, ${summary.warningCount || 0} warning${(summary.warningCount || 0) === 1 ? '' : 's'}`;
    toast(`Accepted ${acceptedCount} change${acceptedCount === 1 ? '' : 's'} and refreshed Deck Health: ${validation.health.status || 'checked'} (${issueText}).`, validation.health.errors?.length ? 'error' : (validation.health.warnings?.length ? 'warning' : 'success'));
    return validation;
}

async function acceptLoredeckPendingChanges(pack, changeIds = []) {
    const freshPack = getFreshLoredeckLibraryPack(pack?.packId, pack);
    if (!freshPack?.packId) {
        toast('Loredeck is no longer available.', 'warning');
        return false;
    }
    const idSet = new Set(normalizeLoredeckPendingIdList(changeIds));
    const pending = getLoredeckPendingChanges(freshPack);
    const selected = idSet.size ? pending.filter(change => idSet.has(change.changeId)) : pending;
    if (!selected.length) {
        toast('No pending Loredeck changes selected.', 'warning');
        return false;
    }
    const affectsHealth = selected.some(change => doesLoredeckPendingChangeAffectPackHealth(change));
    const shouldReportStaleHealth = affectsHealth && canValidateLoredeckInEditor(freshPack);
    const selectedCreatorPlanningBatchIds = selected
        .filter(change => String(change.source || '').trim() === 'loredeck_creator' && ['timeline_anchor', 'timeline_window', 'tag'].includes(change.targetKind))
        .map(change => normalizeLoredeckCreatorTitleId(change.preview?.creatorPlanningBatch?.id || '', ''))
        .filter(Boolean);
    const accepted = persistLoredeckLibraryRecordMutation(freshPack, next => {
        const current = normalizeLoredeckPendingChanges(next.pendingChanges);
        const selectedIds = new Set(selected.map(change => change.changeId));
        for (const change of current) {
            if (!selectedIds.has(change.changeId)) continue;
            applyLoredeckRecordPatch(next, change.payload);
        }
        next.pendingChanges = current.filter(change => !selectedIds.has(change.changeId));
        if (isGeneratedLoredeckPack(next)) refreshGeneratedLoredeckDerivedMetadata(next);
        if (affectsHealth) next.healthStatus = 'stale';
    }, shouldReportStaleHealth
        ? `Accepted ${selected.length} pending Loredeck change${selected.length === 1 ? '' : 's'}. Deck Health marked stale.`
        : `Accepted ${selected.length} pending Loredeck change${selected.length === 1 ? '' : 's'}.`, {
        errorMessage: 'Pending Loredeck change acceptance failed.',
    });
    if (accepted && selectedCreatorPlanningBatchIds.length) {
        const cached = getLoredeckCreatorBriefCache();
        if (cached.generatedPackId === pack.packId) {
            const fresh = getFreshLoredeckLibraryPack(pack.packId, pack);
            const remainingPending = getLoredeckPendingChanges(fresh);
            const acceptedIds = new Set(normalizeLoredeckCreatorTitleIdList(cached.planningBatchAcceptedIds || [], 1200));
            for (const id of selectedCreatorPlanningBatchIds) {
                const stillPending = remainingPending.some(change => isLoredeckCreatorPlanningPendingChange(change, id));
                if (!stillPending) acceptedIds.add(id);
            }
            setLoredeckCreatorBriefCache({
                ...cached,
                planningBatchAcceptedIds: [...acceptedIds],
                planningAcceptedAt: Date.now(),
            });
        }
    }
    if (accepted && affectsHealth) {
        await refreshLoredeckHealthAfterAcceptedPendingChanges(pack, selected.length);
    }
    if (accepted) {
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });
        refreshHeader();
    }
    return accepted;
}

function rejectLoredeckPendingChanges(pack, changeIds = []) {
    const freshPack = getFreshLoredeckLibraryPack(pack?.packId, pack);
    if (!freshPack?.packId) {
        toast('Loredeck is no longer available.', 'warning');
        return false;
    }
    const idSet = new Set(normalizeLoredeckPendingIdList(changeIds));
    const pending = getLoredeckPendingChanges(freshPack);
    const selected = idSet.size ? pending.filter(change => idSet.has(change.changeId)) : pending;
    if (!selected.length) {
        toast('No pending Loredeck changes selected.', 'warning');
        return false;
    }
    const rejected = persistLoredeckLibraryRecordMutation(freshPack, next => {
        const selectedIds = new Set(selected.map(change => change.changeId));
        next.pendingChanges = normalizeLoredeckPendingChanges(next.pendingChanges).filter(change => !selectedIds.has(change.changeId));
    }, `Rejected ${selected.length} pending Loredeck change${selected.length === 1 ? '' : 's'}.`, {
        errorMessage: 'Pending Loredeck change rejection failed.',
    });
    if (rejected) {
        refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });
        refreshHeader();
    }
    return rejected;
}

function saveLoredeckEntryOverride(pack, entry) {
    const id = String(entry?.id || '').trim();
    if (!id) {
        toast('Entry override needs an ID.', 'warning');
        return false;
    }
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'upsert_entry',
        targetKind: 'entry',
        title: `Save entry: ${entry.title || id}`,
        description: 'Creates or updates a Custom Loredeck entry override after review.',
        affectedEntryIds: [id],
        payload: {
            entryOverrides: { [id]: entry },
            disabledEntryIdsRemove: [id],
        },
        preview: {
            after: entry.content?.fact || entry.fact || entry.title || id,
        },
    }), `Queued pending entry change for ${entry.title || id}.`);
}

function removeLoredeckEntryOverride(pack, entryId) {
    const id = String(entryId || '').trim();
    if (!id) return false;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: 'remove_entry_override',
        targetKind: 'entry',
        title: `Remove override: ${id}`,
        description: 'Removes the Custom override after review. Source entry remains unless disabled.',
        affectedEntryIds: [id],
        payload: {
            entryOverrides: { [id]: null },
        },
        preview: {
            after: 'Custom override will be removed.',
        },
    }), `Queued pending override removal for ${id}.`);
}

function setLoredeckEntryDisabled(pack, entryId, disabled) {
    const id = String(entryId || '').trim();
    if (!id) return false;
    return queueLoredeckPendingChange(pack, createLoredeckRecordPatchChange({
        action: disabled ? 'disable_entry' : 'restore_entry',
        targetKind: 'entry',
        title: `${disabled ? 'Disable' : 'Restore'} entry: ${id}`,
        description: disabled
            ? 'Suppresses this entry in the Custom Loredeck after review.'
            : 'Removes this entry from the Custom disabled list after review.',
        affectedEntryIds: [id],
        payload: disabled
            ? { disabledEntryIdsAdd: [id] }
            : { disabledEntryIdsRemove: [id] },
        preview: {
            after: disabled ? 'Entry will be disabled.' : 'Entry will be restored.',
        },
    }), `Queued pending ${disabled ? 'disable' : 'restore'} for ${id}.`);
}

function selectLoredeckForDetails(packId, options = {}) {
    const id = String(packId || '').trim();
    if (!id) return;
    if (options.clearFolder !== false) clearLoredeckLibrarySelectedFolderDetails();
    const state = getState();
    if (!state.lorePanel) state.lorePanel = getDefaultState().lorePanel;
    state.lorePanel.selectedLoredeckId = id;
    saveState(state, { syncPrompt: false });
    if (options.refresh !== false) {
        refreshLoredeckSurfaces();
    }
}

function formatCategoryCounts(categoryCounts = {}) {
    if (!categoryCounts || typeof categoryCounts !== 'object' || Array.isArray(categoryCounts)) return '';
    return Object.entries(categoryCounts)
        .filter(([, count]) => Number(count) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .slice(0, 6)
        .map(([category, count]) => `${humanizeScopeKey(category)}: ${count}`)
        .join(', ');
}

function getLoredeckSourceSummary(pack) {
    const source = pack?.source && typeof pack.source === 'object' && !Array.isArray(pack.source) ? pack.source : {};
    const kind = source.kind || (pack?.manifest ? (/^https?:\/\//i.test(pack.manifest) ? 'url' : 'path') : 'unknown');
    const parts = [kind];
    if (source.installedFrom) parts.push(`file: ${source.installedFrom}`);
    if (source.originalPackId && source.originalPackId !== pack?.packId) parts.push(`source deck: ${source.originalPackId}`);
    const updateUrl = source.updateUrl || '';
    if (updateUrl) parts.push('update URL registered');
    if (pack?.localModified) parts.push('locally modified');
    return parts.filter(Boolean).join(' | ') || 'unknown';
}

function formatLoredeckManifestContinuity(continuity) {
    if (!continuity || typeof continuity !== 'object' || Array.isArray(continuity)) return 'unset';
    const parts = [
        continuity.continuityId ? `ID: ${continuity.continuityId}` : '',
        continuity.canonTier ? `tier: ${continuity.canonTier}` : '',
        continuity.adaptation ? `adaptation: ${continuity.adaptation}` : '',
        continuity.sourceBoundary ? `boundary: ${continuity.sourceBoundary}` : '',
    ].filter(Boolean);
    return parts.join(' | ') || 'unset';
}

function formatLoredeckCompatibility(compatibility) {
    if (!compatibility || typeof compatibility !== 'object' || Array.isArray(compatibility)) return 'unset';
    const min = compatibility.sagaSchemaMin ?? compatibility.min ?? '';
    const max = compatibility.sagaSchemaMax ?? compatibility.max ?? '';
    if (min || max) return `Saga schema ${min || '?'}-${max || '?'}`;
    return formatStructuredValue(compatibility) || 'unset';
}

async function deleteLoredeckLibraryPackWithConfirm(packOrId) {
    const packId = String(typeof packOrId === 'string' ? packOrId : packOrId?.packId || '').trim();
    if (!packId) {
        toast('Missing Loredeck id.', 'warning');
        return false;
    }
    const pack = getLoredeckDefinition(packId) || (typeof packOrId === 'object' ? packOrId : null) || { packId };
    if (isBundledLoredeckLibraryPack(pack)) {
        toast('Bundled Loredecks are built into Saga and cannot be deleted.', 'warning');
        return false;
    }
    const title = pack.title || packId;
    const stackKey = createLoredeckStackDeckKey(packId);
    const inStack = getLoredeckStack(getState()).some(item => getLoredeckStackItemKey(item) === stackKey);
    const proceed = await confirmAction(
        'Delete Loredeck?',
        `Delete "${title}" from your Loredeck Library?${inStack ? ' It will also be removed from the active stack.' : ''} This cannot be undone unless you import or create it again.`
    );
    if (!proceed) return false;

    if (inStack) {
        commitLoredeckStackMutation(stack => {
            const index = stack.findIndex(item => getLoredeckStackItemKey(item) === stackKey);
            if (index >= 0) stack.splice(index, 1);
        });
    }
    const result = removeLoredeckLibraryPack(packId);
    if (!result.ok) {
        toast(result.error || 'Loredeck could not be deleted.', 'warning');
        return false;
    }

    const state = getState();
    if (state?.lorePanel?.selectedLoredeckId === packId) {
        const nextPack = getLoredeckLibrary().find(item => item.packId !== packId) || null;
        if (!state.lorePanel) state.lorePanel = getDefaultState().lorePanel;
        state.lorePanel.selectedLoredeckId = nextPack?.packId || '';
        saveState(state, { syncPrompt: false });
    }
    loredeckManifestPreviewCache.delete(packId);
    loredeckEntryPreviewCache.delete(packId);
    loredeckTimelineRegistryCache.delete(packId);
    loredeckTagRegistryCache.delete(packId);
    loredeckAssistantDraftCache.delete(packId);
    loredeckHealthRepairSelectionCache.delete(packId);
    refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    return true;
}

function isBundledLoredeckLibraryPack(packOrId) {
    const packId = String(typeof packOrId === 'string' ? packOrId : packOrId?.packId || '').trim();
    const pack = typeof packOrId === 'object' ? packOrId : getLoredeckDefinition(packId);
    return pack?.type === 'bundled' || DEFAULT_SETTINGS.loredeckLibrary?.packs?.[packId]?.type === 'bundled';
}

function formatLoredeckBulkDeleteList(packs = [], limit = 10) {
    const titles = packs
        .map(pack => pack?.title || pack?.packId || '')
        .filter(Boolean);
    const visible = titles.slice(0, limit).map((title, index) => `${index + 1}. ${title}`);
    if (titles.length > limit) visible.push(`...and ${titles.length - limit} more`);
    return visible.join('\n');
}

async function deleteLoredeckLibraryPacksWithConfirm(packsOrIds = []) {
    const library = getLoredeckLibrary(getState());
    const byId = new Map(library.map(pack => [pack.packId, pack]));
    const requested = [];
    const seen = new Set();
    for (const item of packsOrIds || []) {
        const packId = String(typeof item === 'string' ? item : item?.packId || '').trim();
        if (!packId || seen.has(packId)) continue;
        seen.add(packId);
        requested.push(byId.get(packId) || (typeof item === 'object' ? item : { packId }));
    }
    const deletable = requested.filter(pack => !isBundledLoredeckLibraryPack(pack));
    const skipped = requested.filter(pack => isBundledLoredeckLibraryPack(pack));
    if (!deletable.length) {
        toast('No selected Custom Loredecks can be deleted.', 'warning');
        return false;
    }
    if (deletable.length === 1 && !skipped.length) {
        return deleteLoredeckLibraryPackWithConfirm(deletable[0]);
    }

    const stack = getLoredeckStack(getState());
    const stackIds = new Set(stack.map(item => getLoredeckStackItemPackId(item)).filter(Boolean));
    const inStack = deletable.filter(pack => stackIds.has(pack.packId));
    const actions = [
        `Delete ${deletable.length} Custom Loredeck${deletable.length === 1 ? '' : 's'} from your Library:`,
        formatLoredeckBulkDeleteList(deletable),
    ];
    if (inStack.length) {
        actions.push(
            '',
            `Remove ${inStack.length} deleted Loredeck${inStack.length === 1 ? '' : 's'} from the active stack:`,
            formatLoredeckBulkDeleteList(inStack),
        );
    }
    if (skipped.length) {
        actions.push(
            '',
            `Skip ${skipped.length} Bundled Loredeck${skipped.length === 1 ? '' : 's'} because Bundled decks are read-only:`,
            formatLoredeckBulkDeleteList(skipped),
        );
    }
    actions.push('', 'This cannot be undone unless you import or create those Loredecks again.');
    const proceed = await confirmAction('Delete selected Loredecks?', actions.join('\n'));
    if (!proceed) return false;

    const deletableIds = new Set(deletable.map(pack => pack.packId));
    if (inStack.length) {
        commitLoredeckStackMutation(stackItems => {
            for (let index = stackItems.length - 1; index >= 0; index -= 1) {
                if (deletableIds.has(getLoredeckStackItemPackId(stackItems[index]))) stackItems.splice(index, 1);
            }
        });
    }

    let deletedCount = 0;
    const failed = [];
    for (const pack of deletable) {
        const result = removeLoredeckLibraryPack(pack.packId);
        if (result.ok) {
            deletedCount += 1;
            loredeckManifestPreviewCache.delete(pack.packId);
            loredeckEntryPreviewCache.delete(pack.packId);
            loredeckTimelineRegistryCache.delete(pack.packId);
            loredeckTagRegistryCache.delete(pack.packId);
            loredeckAssistantDraftCache.delete(pack.packId);
            loredeckHealthRepairSelectionCache.delete(pack.packId);
        } else {
            failed.push(pack.title || pack.packId);
        }
    }

    const state = getState();
    if (deletableIds.has(state?.lorePanel?.selectedLoredeckId)) {
        const nextPack = getLoredeckLibrary().find(item => !deletableIds.has(item.packId)) || null;
        if (!state.lorePanel) state.lorePanel = getDefaultState().lorePanel;
        state.lorePanel.selectedLoredeckId = nextPack?.packId || '';
        saveState(state, { syncPrompt: false });
    }
    setLoredeckLibraryBulkSelection([], '');
    refreshLoredeckSurfaces({ clearCanon: true, clearContext: true });
    if (failed.length) toast(`Could not delete: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '...' : ''}`, 'warning');
    return deletedCount > 0;
}

function forgetLoredeckLibraryPack(packId) {
    void deleteLoredeckLibraryPackWithConfirm(packId);
}

function commitLoredeckStackMutation(mutator) {
    const state = getState();
    const current = getLoredeckStack(state);
    const next = current.map(item => ({ ...item }));
    mutator?.(next);
    const normalized = normalizeLoredeckStackPriority(next);
    if (JSON.stringify(current) === JSON.stringify(normalized)) return false;

    state.loredeckStack = normalized;
    clearCanonLoreDatabaseCache();
    clearContextIndexCache();
    saveState(state, { sanitize: false });
    refreshLoredeckSurfaces({ renderLibrary: false });
    if (isLoredeckLibraryOpen()) {
        refreshLoredeckLibrarySelectionSurfaces();
        scheduleLoredeckLibraryOverlayRefresh();
    }
    return true;
}

function normalizeLoredeckStackPriority(stack = []) {
    const output = [];
    const seen = new Set();
    for (const item of stack) {
        const type = getLoredeckStackItemType(item);
        const packId = String(item?.packId || item?.deckId || '').trim();
        const folderId = String(item?.folderId || '').trim();
        const key = getLoredeckStackItemKey({ type, packId, folderId });
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const normalized = {
            type,
            enabled: item.enabled !== false,
            priority: Math.max(1, 100 - output.length),
            locked: item.locked === true,
            addedAt: Number.isFinite(Number(item.addedAt)) ? Number(item.addedAt) : Date.now(),
        };
        if (type === 'folder') {
            normalized.folderId = folderId;
            normalized.includeNested = item.includeNested !== false;
            normalized.collapsed = item.collapsed === true;
        } else {
            normalized.packId = packId;
        }
        output.push(normalized);
    }
    return output;
}

function addLoredeckToStack(packId) {
    const changed = commitLoredeckStackMutation(stack => {
        const existing = stack.find(item => getLoredeckStackItemKey(item) === createLoredeckStackDeckKey(packId));
        if (existing) {
            existing.enabled = true;
            return;
        }
        stack.push({
            type: 'deck',
            packId,
            enabled: true,
            priority: 1,
            locked: false,
            addedAt: Date.now(),
        });
    });
    return changed;
}

function addLoredeckFolderToStack(folderId, libraryIndex = getLoredeckLibraryIndexForPacks()) {
    const id = String(folderId || '').trim();
    if (!id || id === 'unfiled') {
        toast('Only named Library folders can be added to the active stack.', 'warning');
        return false;
    }
    const folder = (libraryIndex.folders || []).find(item => item.id === id);
    if (!folder) {
        toast('That Library folder is no longer available.', 'warning');
        return false;
    }
    const changed = commitLoredeckStackMutation(stack => {
        const key = createLoredeckStackFolderKey(id);
        const existing = stack.find(item => getLoredeckStackItemKey(item) === key);
        if (existing) {
            existing.enabled = true;
            existing.includeNested = true;
            return;
        }
        stack.push({
            type: 'folder',
            folderId: id,
            includeNested: true,
            enabled: true,
            priority: 1,
            locked: false,
            addedAt: Date.now(),
        });
    });
    return changed;
}

function setLoredeckEnabled(packId, enabled) {
    const changed = setLoredeckStackItemEnabled(createLoredeckStackDeckKey(packId), enabled);
    return changed;
}

function setLoredeckStackItemEnabled(stackKey, enabled) {
    const key = String(stackKey || '').trim();
    const changed = commitLoredeckStackMutation(stack => {
        const item = stack.find(entry => getLoredeckStackItemKey(entry) === key);
        if (item) item.enabled = enabled !== false;
    });
    return changed;
}

function setLoredeckStackItemCollapsed(stackKey, collapsed) {
    const key = String(stackKey || '').trim();
    const next = collapsed === true;
    const changed = commitLoredeckStackMutation(stack => {
        const item = stack.find(entry => getLoredeckStackItemKey(entry) === key);
        if (item && getLoredeckStackItemType(item) === 'folder') item.collapsed = next;
    });
    if (!changed) renderLoredeckLibraryOverlay();
    return changed;
}

function moveLoredeckInStack(packId, direction) {
    return moveLoredeckStackItem(createLoredeckStackDeckKey(packId), direction);
}

function moveLoredeckStackItem(stackKey, direction) {
    const key = String(stackKey || '').trim();
    const step = Number(direction) < 0 ? -1 : 1;
    const changed = commitLoredeckStackMutation(stack => {
        const index = stack.findIndex(item => getLoredeckStackItemKey(item) === key);
        const nextIndex = index + step;
        if (index < 0 || nextIndex < 0 || nextIndex >= stack.length) return;
        const [item] = stack.splice(index, 1);
        stack.splice(nextIndex, 0, item);
    });
    return changed;
}

function reorderLoredeckInStack(packId, targetIndex) {
    return reorderLoredeckStackItem(createLoredeckStackDeckKey(packId), targetIndex);
}

function reorderLoredeckStackItem(stackKey, targetIndex) {
    const key = String(stackKey || '').trim();
    const changed = commitLoredeckStackMutation(stack => {
        const index = stack.findIndex(item => getLoredeckStackItemKey(item) === key);
        if (index < 0) return;
        const nextIndex = Math.max(0, Math.min(stack.length - 1, Number(targetIndex)));
        if (!Number.isFinite(nextIndex) || nextIndex === index) return;
        const [item] = stack.splice(index, 1);
        stack.splice(nextIndex, 0, item);
    });
    return changed;
}

function removeLoredeckFromStack(packId) {
    const changed = commitLoredeckStackMutation(stack => {
        const index = stack.findIndex(item => getLoredeckStackItemKey(item) === createLoredeckStackDeckKey(packId));
        if (index >= 0) stack.splice(index, 1);
    });
    return changed;
}

function removeLoredeckStackItem(stackKey) {
    const key = String(stackKey || '').trim();
    const changed = commitLoredeckStackMutation(stack => {
        const index = stack.findIndex(item => getLoredeckStackItemKey(item) === key);
        if (index >= 0) stack.splice(index, 1);
    });
    return changed;
}

function removeLoredecksFromStack(packIds = []) {
    const ids = new Set((packIds || []).map(id => String(id || '').trim()).filter(Boolean));
    if (!ids.size) return false;
    const changed = commitLoredeckStackMutation(stack => {
        for (let index = stack.length - 1; index >= 0; index -= 1) {
            if (ids.has(getLoredeckStackItemPackId(stack[index]))) stack.splice(index, 1);
        }
    });
    return changed;
}

function renderSettingsTab(container, state) {
    void state;
    const settings = getSettings();
    const basic = isBasicExperience(settings);
    container.appendChild(createSectionHeader(
        'SAGA',
        basic ? 'Providers and Theme Pack.' : 'Fandom Loresystem.'
    ));

    if (basic) {
        container.appendChild(markTourTarget(createCollapsibleSection(
            'settings.providers',
            'Providers',
            `${getProviderStatusText('lore', settings)} / ${getProviderStatusText('continuity', settings)}`,
            true,
            createBasicProviderQuickSetupCard(settings),
            { tooltip: 'Check providers needed for model-backed Saga actions without exposing advanced provider tuning.' }
        ), 'settings.providers'));

        container.appendChild(markTourTarget(createCollapsibleSection(
            'settings.themePack',
            'Theme Pack',
            getThemePreset(settings.themePackId, settings)?.title || 'Theme',
            true,
            createThemeSettingsCard(settings),
            { tooltip: 'Manage Theme Packs, icon sets, and color overrides.' }
        ), 'settings.themePack'));

        return;
    }

    container.appendChild(markTourTarget(createCollapsibleSection(
        'settings.providers',
        'Providers',
        'Utility and Reasoning model settings',
        true,
        createProviderSettingsCard(settings),
        { tooltip: 'Configure model providers used by Saga generation, Context detection, compression, and continuity workflows.' }
    ), 'settings.providers'));

    container.appendChild(markTourTarget(createCollapsibleSection(
        'settings.themePack',
        'Theme Pack',
        getThemePreset(settings.themePackId)?.title || 'Theme',
        false,
        createThemeSettingsCard(settings),
        { tooltip: 'Manage Theme Packs, icon sets, and color overrides.' }
    ), 'settings.themePack'));
}

function createThemeSettingsCard(settings = getSettings()) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-settings-theme-card';
    const themeLibrary = getThemePackLibrary(settings);
    const activePreset = getThemePreset(settings.themePackId, settings);
    const colors = getActiveThemeColors(settings);
    const themePanelOptions = createThemePanelOptions();

    const header = document.createElement('div');
    header.className = 'saga-theme-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-theme-header-title-wrap';
    const icon = document.createElement('div');
    icon.className = 'saga-theme-header-icon';
    icon.textContent = 'T';
    titleWrap.appendChild(icon);
    const textWrap = document.createElement('div');
    const title = document.createElement('h4');
    title.textContent = 'Theme Pack';
    textWrap.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'JSON-only appearance presets for colors, surfaces, and shelf tab icons. Theme packs cannot run code.';
    textWrap.appendChild(help);
    titleWrap.appendChild(textWrap);
    header.appendChild(titleWrap);

    const topActions = document.createElement('div');
    topActions.className = 'saga-primary-actions saga-theme-header-actions';
    topActions.appendChild(createButton('Import Theme Pack', 'Install a user-made JSON Theme Pack into the local library.', () => {
        themePanelOptions.onImportThemePack?.();
    }, 'saga-primary-button'));
    topActions.appendChild(createButton('Export Active Theme', 'Download the active theme as a Custom Theme Pack JSON file.', () => {
        themePanelOptions.onExportActiveThemePack?.();
    }));
    topActions.appendChild(createButton('Reset Theme', 'Restore the bundled SAGA Archive Theme Pack and clear color overrides.', () => {
        themePanelOptions.onResetThemeSettings?.();
    }));
    header.appendChild(topActions);
    card.appendChild(header);

    const topGrid = document.createElement('div');
    topGrid.className = 'saga-theme-top-grid';
    topGrid.appendChild(createActiveThemePanel(activePreset, settings, colors, themePanelOptions));
    card.appendChild(topGrid);

    const middleGrid = document.createElement('div');
    middleGrid.className = 'saga-theme-middle-grid';
    middleGrid.appendChild(createInstalledThemePackGallery(themeLibrary, activePreset, settings, themePanelOptions));
    middleGrid.appendChild(createThemeColorOverridesPanel(settings, activePreset, colors, themePanelOptions));
    card.appendChild(middleGrid);

    const lowerGrid = document.createElement('div');
    lowerGrid.className = 'saga-theme-lower-grid';
    lowerGrid.appendChild(createThemeIconSetPanel(activePreset, settings, themePanelOptions));
    card.appendChild(lowerGrid);

    card.appendChild(createThemeAdvancedPanel(settings, activePreset, colors, themePanelOptions));
    return card;
}

function getThemeShelfIconItems() {
    return [
        ...Object.entries(TAB_LABELS).map(([tabId, label]) => ({
            key: `tab.${tabId}`,
            legacyKey: tabId,
            tabId,
            label,
            fallback: TAB_ICONS[tabId] || label.slice(0, 1),
            defaultPath: TAB_ICON_PATHS[tabId] || '',
        })),
        {
            key: 'control.collapse',
            legacyKey: 'collapse',
            tabId: '',
            label: 'Collapse',
            fallback: '<',
            defaultPath: '',
        },
    ];
}

function renderPanelBody(container, state) {
    container.innerHTML = '';

    const settings = getSettings();
    const activeTab = normalizeTabForExperience(state?.lorePanel?.activeTab, settings);
    const tabBody = document.createElement('div');
    tabBody.className = `saga-runtime-tab-body saga-runtime-tab-body-${activeTab}`;
    container.appendChild(tabBody);

    try {
        if (activeTab === 'loredecks') {
            renderLoredecksTab(tabBody, state);
        } else if (activeTab === 'session') {
            renderSessionTab(tabBody, state);
        } else if (activeTab === 'context') {
            renderContextTab(tabBody, state);
        } else if (activeTab === 'continuity') {
            renderContinuityTab(tabBody, state);
        } else if (activeTab === 'lore') {
            renderLorecardsTab(tabBody, state);
        } else if (activeTab === 'settings') {
            renderSettingsTab(tabBody, state);
        } else {
            renderInjectionTab(tabBody, state);
        }
    } catch (e) {
        console.error(`[Saga] Runtime ${activeTab} tab failed to render:`, e);
        tabBody.textContent = '';
        tabBody.appendChild(createRuntimeRenderErrorCard(getTabLabelForExperience(activeTab, settings), e));
    }

    installNestedScrollHandoff(tabBody);
    if (activeTab === 'lore') scheduleAcceptedLoreLayoutUpdate();
}

function createRuntimeRenderErrorCard(titleText = 'Runtime Tab', error = null) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-runtime-render-error-card';
    const title = document.createElement('h4');
    title.textContent = `${titleText} could not render`;
    card.appendChild(title);
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Saga kept the runtime window open so this can be diagnosed instead of disappearing.';
    card.appendChild(help);
    const message = document.createElement('pre');
    message.className = 'saga-runtime-render-error-message';
    message.textContent = error?.stack || error?.message || String(error || 'Unknown render error.');
    card.appendChild(message);
    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Return to Session', 'Open the Session tab.', () => {
        toggleRuntimeDrawerForTab('session');
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reset Window', 'Reset Saga runtime window layout and section defaults.', () => {
        resetLorePanelLayout();
    }));
    card.appendChild(actions);
    return card;
}

function getRailMetrics(state, settings = getSettings()) {
    const counts = getPanelLoreState(state).counts;
    const pendingLore = (state?.pendingLoreEntries || []).length;
    const selectedLore = getSelectedLoreInjectionCount(state, settings);
    const injectionStats = getInjectionCharacterStats(state, settings);
    const sceneDate = String(state?.loreContext?.sceneDate || '').trim();
    const canonBoundary = String(state?.loreContext?.canonBoundary || '').trim();
    const activeCharacters = Array.isArray(state?.scene?.presentCharacters)
        ? state.scene.presentCharacters.length
        : (Array.isArray(state?.characters) ? state.characters.length : 0);
    const liveItems = [state?.scene?.location, state?.scene?.currentActivity].filter(Boolean).length;

    return {
        loredecks: getLoredeckStackMetric(state),
        session: settings.enabled ? getExperienceLabel(settings) : 'Paused',
        context: sceneDate || canonBoundary || 'No date',
        continuity: `${activeCharacters || liveItems || 0} live`,
        lore: pendingLore ? `${counts.active || 0}+${pendingLore}` : `${counts.active || 0} active`,
        injection: injectionStats.totalChars ? `${injectionStats.totalTokens} tk` : `${selectedLore} lore`,
        settings: getThemePreset(settings.themePackId)?.title || 'Theme',
    };
}

function getLoredeckStackItemType(item = {}) {
    return item?.type === 'folder' || item?.folderId ? 'folder' : 'deck';
}

function getLoredeckStackItemKey(item = {}) {
    const type = getLoredeckStackItemType(item);
    const id = type === 'folder'
        ? String(item?.folderId || '').trim()
        : String(item?.packId || item?.deckId || '').trim();
    return id ? `${type}:${id}` : '';
}

function createLoredeckStackDeckKey(packId = '') {
    const id = String(packId || '').trim();
    return id ? `deck:${id}` : '';
}

function createLoredeckStackFolderKey(folderId = '') {
    const id = String(folderId || '').trim();
    return id ? `folder:${id}` : '';
}

function getLoredeckStackItemLabel(item = {}, libraryIndex = getLoredeckLibraryIndexForPacks()) {
    if (getLoredeckStackItemType(item) === 'folder') {
        const path = getFolderPath(item.folderId, libraryIndex);
        return path.length ? path.join(' > ') : (item.folderId || 'Folder');
    }
    return getLoredeckDisplayName(item.packId || item.deckId || '');
}

function getLoredeckStackItemPackId(item = {}) {
    return getLoredeckStackItemType(item) === 'deck' ? String(item?.packId || item?.deckId || '').trim() : '';
}

function getLoredeckStackItemFolderId(item = {}) {
    return getLoredeckStackItemType(item) === 'folder' ? String(item?.folderId || '').trim() : '';
}

function getLoredeckStack(state = getState()) {
    const stack = Array.isArray(state?.loredeckStack) ? state.loredeckStack : [];
    return stack
        .filter(item => item && typeof item === 'object')
        .map((item, index) => {
            const type = getLoredeckStackItemType(item);
            const packId = String(item.packId || item.deckId || '').trim();
            const folderId = String(item.folderId || '').trim();
            const normalized = {
                type,
                enabled: item.enabled !== false,
                priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : Math.max(1, 100 - index),
                locked: item.locked === true,
                addedAt: Number.isFinite(Number(item.addedAt)) ? Number(item.addedAt) : 0,
            };
            if (type === 'folder') {
                normalized.folderId = folderId;
                normalized.includeNested = item.includeNested !== false;
                normalized.collapsed = item.collapsed === true;
            } else {
                normalized.packId = packId;
            }
            return normalized;
        })
        .filter(item => getLoredeckStackItemKey(item));
}

function normalizeLoredeckLibraryPack(raw = {}) {
    const packId = String(raw.packId || raw.id || '').trim();
    if (!packId) return null;
    const stats = raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats) ? raw.stats : {};
    const derivedFrom = raw.derivedFrom && typeof raw.derivedFrom === 'object' && !Array.isArray(raw.derivedFrom) ? raw.derivedFrom : null;
    const manifestData = raw.manifestData && typeof raw.manifestData === 'object' && !Array.isArray(raw.manifestData) ? raw.manifestData : null;
    const library = normalizePackLibraryMetadata(raw.library || manifestData?.library || {});
    const entryOverrides = raw.entryOverrides && typeof raw.entryOverrides === 'object' && !Array.isArray(raw.entryOverrides) ? raw.entryOverrides : {};
    const disabledEntryIds = Array.isArray(raw.disabledEntryIds) ? raw.disabledEntryIds.map(id => String(id || '').trim()).filter(Boolean) : [];
    const assets = raw.assets && typeof raw.assets === 'object' && !Array.isArray(raw.assets) ? raw.assets : null;
    const timelineRegistry = normalizeLoredeckTimelineRegistry(raw.timelineRegistry);
    const tagRegistry = normalizeLoredeckTagRegistry(raw.tagRegistry);
    const pendingChanges = normalizeLoredeckPendingChanges(raw.pendingChanges);
    const healthIssueStates = normalizeLoredeckHealthIssueStates(raw.healthIssueStates);
    return {
        packId,
        type: ['bundled', 'custom', 'generated'].includes(raw.type) ? raw.type : 'custom',
        title: String(raw.title || packId).trim(),
        description: String(raw.description || '').trim(),
        fandom: String(raw.fandom || '').trim(),
        era: String(raw.era || '').trim(),
        author: String(raw.author || '').trim(),
        version: String(raw.version || '').trim(),
        entrySchemaVersion: Number.isFinite(Number(raw.entrySchemaVersion)) ? Number(raw.entrySchemaVersion) : 0,
        manifest: String(raw.manifest || '').trim(),
        source: raw.source && typeof raw.source === 'object' && !Array.isArray(raw.source) ? raw.source : {},
        tags: Array.isArray(raw.tags) ? raw.tags.map(tag => String(tag || '').trim()).filter(Boolean) : [],
        stats,
        entryCount: Number.isFinite(Number(raw.entryCount)) ? Number(raw.entryCount) : (Number.isFinite(Number(stats.entryCount)) ? Number(stats.entryCount) : 0),
        healthStatus: String(raw.healthStatus || '').trim(),
        localModified: raw.localModified === true,
        derivedFrom,
        ...(assets ? { assets } : {}),
        manifestData,
        ...(Object.keys(library).length ? { library } : {}),
        entryOverrides,
        disabledEntryIds,
        ...(getLoredeckTimelineRegistryCount(timelineRegistry) ? { timelineRegistry } : {}),
        ...(getLoredeckTagRegistryCount(tagRegistry) ? { tagRegistry } : {}),
        ...(pendingChanges.length ? { pendingChanges } : {}),
        ...(Object.keys(healthIssueStates).length ? { healthIssueStates } : {}),
        installedAt: Number.isFinite(Number(raw.installedAt)) ? Number(raw.installedAt) : 0,
        updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : 0,
    };
}

function getLoredeckLibrary(state = getState()) {
    const packs = new Map();
    for (const pack of getBundledLoredeckLibraryRecords()) {
        const normalized = normalizeLoredeckLibraryPack(pack);
        if (normalized) packs.set(normalized.packId, normalized);
    }
    const registry = getLoredeckLibraryRegistry(state);
    const registryPacks = registry?.packs && typeof registry.packs === 'object' && !Array.isArray(registry.packs)
        ? registry.packs
        : {};
    for (const pack of Object.values(registryPacks)) {
        const normalized = normalizeLoredeckLibraryPack(pack);
        if (normalized) packs.set(normalized.packId, { ...(packs.get(normalized.packId) || {}), ...normalized });
    }
    return [...packs.values()].sort((a, b) => {
        const typeOrder = { bundled: 0, custom: 1, generated: 2 };
        return (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9)
            || a.title.localeCompare(b.title);
    });
}

function getLoredeckDisplayName(packId) {
    const definition = getLoredeckDefinition(packId);
    if (definition?.title) return definition.title;
    const known = {
        [HP_LEGACY_LOREDECK_ID]: 'Harry Potter: Golden Trio (Legacy)',
        [DEFAULT_HP_LOREDECK_ID]: 'Harry Potter: Core',
    };
    return known[packId] || packId;
}

function getLoredeckTypeLabel(packId) {
    const definition = getLoredeckDefinition(packId);
    if (definition?.type) {
        if (definition.type === 'bundled') return 'Bundled';
        if (definition.type === 'generated') return 'Generated';
        return 'Custom';
    }
    const known = {
        [HP_LEGACY_LOREDECK_ID]: 'Legacy',
        [DEFAULT_HP_LOREDECK_ID]: 'Bundled',
    };
    return known[packId] || 'Custom';
}

function getLoredeckDefinition(packId) {
    return getLoredeckLibrary().find(pack => pack.packId === packId) || null;
}

function getLoredeckStackMetric(state = getState()) {
    const stack = getLoredeckStack(state);
    const enabled = stack.filter(item => item.enabled).length;
    return enabled ? `${enabled} loaded` : 'None';
}

function getLoredeckHealthText(health) {
    if (!health) return 'Not checked';
    const summary = health.summary || {};
    const status = String(health.status || 'unknown').replace(/_/g, ' ');
    const errors = Number(summary.errorCount) || 0;
    const warnings = Number(summary.warningCount) || 0;
    return `${status} | ${errors} errors | ${warnings} warnings`;
}

// Session tab -----------------------------------------------------------------

function formatActiveChatMetricName(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.replace(/\\/g, '/').split('/').filter(Boolean).pop() || raw;
    return normalized.replace(/\.(jsonl|json)$/i, '').trim() || raw;
}

function getActiveChatMetricName() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const candidates = [
            ctx?.chatName,
            ctx?.chat_name,
            ctx?.currentChat,
            ctx?.current_chat,
            ctx?.chatFile,
            ctx?.chat_file,
            ctx?.chatId,
            ctx?.chat_id,
            ctx?.chatMetadata?.chatName,
            ctx?.chatMetadata?.name,
        ];
        for (const candidate of candidates) {
            const name = formatActiveChatMetricName(candidate);
            if (name) return name;
        }
        const characterName = formatActiveChatMetricName(ctx?.name2);
        if (characterName) return `${characterName} chat`;
    } catch (_e) {
        // Ignore unavailable SillyTavern context in static harnesses.
    }
    return 'Current chat';
}

function navigateRuntimeTab(tabId) {
    const settings = getSettings();
    setPanelState({ activeTab: normalizeTabForExperience(tabId, settings) });
    refreshPanelBody({ preserveScroll: false });
    refreshHeader();
}

function openAdvancedSettingsTab() {
    setExperienceMode('advanced');
    setPanelState({ activeTab: 'settings' });
    refreshPanelBody({ preserveScroll: false });
    refreshHeader();
}

function enableSagaRuntime() {
    const next = getSettings();
    next.enabled = true;
    saveSettings(next);
    refreshPanelBody({ preserveScroll: false });
    refreshHeader();
}

function getUsableLoredeckContextCount(state = getState()) {
    return getEnabledLoredeckStackPackIds(state).filter(packId => {
        const row = state?.loredeckContexts?.[packId] || getLoredeckContext(state, packId);
        return hasUsableLoredeckContext(row);
    }).length;
}

function getBasicReadinessModel(state = getState(), settings = getSettings()) {
    const loreState = getPanelLoreState(state);
    const acceptedCount = Math.max(0, (loreState.counts?.all || 0) - (loreState.counts?.pending || 0));
    const pendingCount = (state?.pendingLoreEntries || []).length;
    const enabledLoredecks = getEnabledLoredeckStackPackIds(state).length;
    const contextCount = getUsableLoredeckContextCount(state);
    const selectedLore = getSelectedLoreInjectionCount(state, settings);
    const providerValidation = validateLoreProviderConfiguration('lore');
    const loreInjectionOn = settings.injectLore !== false && settings.injectMemo !== false;

    return buildBasicReadinessModel({
        acceptedCount,
        enabledLoredecks,
        contextCount,
        pendingCount,
        providerReady: providerValidation.ok,
        sagaEnabled: settings.enabled !== false,
        selectedLore,
        loreInjectionOn,
    });
}

function getBasicReadinessAction(row) {
    if (!row || row.ready || !row.actionLabel) return null;
    if (row.actionId === 'enable-saga') return enableSagaRuntime;
    if (row.targetTab) return () => navigateRuntimeTab(row.targetTab);
    return null;
}

function createBasicReadinessRow(row) {
    const item = document.createElement('div');
    item.className = `saga-basic-readiness-row ${row.ready ? 'saga-basic-readiness-row-ready' : 'saga-basic-readiness-row-missing'} ${row.optional ? 'saga-basic-readiness-row-optional' : ''}`.trim();

    const main = document.createElement('div');
    main.className = 'saga-basic-readiness-main';

    const label = document.createElement('div');
    label.className = 'saga-basic-readiness-label';
    label.textContent = row.label;
    main.appendChild(label);

    const state = document.createElement('div');
    state.className = 'saga-basic-readiness-state';
    state.textContent = row.ready ? row.readyText : row.missingText;
    main.appendChild(state);

    item.appendChild(main);
    item.appendChild(createStatusPill(row.ready ? 'Ready' : (row.optional ? 'Optional' : 'Needs setup'), row.ready ? row.readyText : row.missingText));

    const action = getBasicReadinessAction(row);
    if (!row.ready && row.actionLabel && typeof action === 'function') {
        item.appendChild(createButton(row.actionLabel, row.missingText, action, 'saga-small-button'));
    }

    return item;
}

function createBasicStartReadinessCard(state = getState(), settings = getSettings()) {
    const model = getBasicReadinessModel(state, settings);
    const content = document.createElement('div');
    content.className = 'saga-basic-readiness-content';

    const next = document.createElement('div');
    next.className = 'saga-basic-next-action';
    const nextLabel = model.nextAction?.label || 'Continue roleplay';
    next.appendChild(createStatusPill(model.nextAction?.ready ? 'Ready' : 'Next', model.nextAction?.missingText || model.nextAction?.readyText || nextLabel));
    const nextText = document.createElement('span');
    nextText.textContent = model.nextAction?.ready ? 'Continue roleplay' : (model.nextAction?.actionLabel || nextLabel);
    next.appendChild(nextText);
    const nextAction = getBasicReadinessAction(model.nextAction);
    if (model.nextAction?.actionLabel && typeof nextAction === 'function') {
        next.appendChild(createButton(model.nextAction.actionLabel, model.nextAction.missingText || 'Open the next Basic workflow step.', nextAction, 'saga-primary-button'));
    }
    content.appendChild(next);

    const list = document.createElement('div');
    list.className = 'saga-basic-readiness-list';
    for (const row of model.rows) list.appendChild(createBasicReadinessRow(row));
    content.appendChild(list);

    const subtitle = model.nextAction?.ready ? 'ready' : (model.nextAction?.actionLabel || 'next action');
    return markTourTarget(createCollapsibleSection(
        'session.basicReadiness',
        'Start Checklist',
        subtitle,
        true,
        content,
        {
            tooltip: 'Guided Basic workflow: load lore, set Context, review Lorecards, then continue roleplay.',
            className: 'saga-basic-readiness-card',
        }
    ), 'session.basicReadiness');
}

function renderSessionTab(container, state) {
    const settings = getSettings();
    const basic = isBasicExperience(settings);
    const guideMode = basic ? 'basic' : 'advanced';
    const guide = getRuntimeGuideContent(guideMode);

    container.appendChild(createSectionHeader(
        'Session Controls',
        basic ? 'Review the Start Checklist and runtime state for this chat.' : 'Set how Saga behaves during roleplay.'
    ));

    const toggles = document.createElement('div');
    toggles.className = 'saga-runtime-grid';
    toggles.appendChild(markTourTarget(createToggleCard(
        'Saga Active',
        settings.enabled,
        'Master switch for Saga runtime behavior. Pausing disables prompt injection, automatic extraction, and generation actions.',
        (checked) => {
            const next = getSettings();
            next.enabled = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: false });
            refreshHeader();
        }
    ), 'session.active'));
    container.appendChild(toggles);

    if (basic) {
        container.appendChild(createBasicStartReadinessCard(state, settings));
    }

    if (!basic) {
        const modeCard = document.createElement('div');
        modeCard.className = 'saga-runtime-card';

        const modeTitle = document.createElement('div');
        modeTitle.className = 'saga-runtime-card-title';
        modeTitle.textContent = 'Automation Mode';
        addTooltip(modeTitle, 'Automation Mode controls whether Saga scans and generates only when clicked, or automatically after roleplay turns. Experience Mode lives on the shelf.');
        modeCard.appendChild(modeTitle);

        const modeButtons = document.createElement('div');
        modeButtons.className = 'saga-mode-buttons';
        for (const [mode, cfg] of Object.entries(AUTOMATION_MODES)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'saga-mode-button';
            if (normalizeAutomationMode(settings.automationMode || settings.workflowMode) === mode) btn.classList.add('saga-mode-button-active');
            btn.textContent = cfg.label;
            addTooltip(btn, cfg.description);
            btn.addEventListener('click', () => {
                setAutomationMode(mode);
                refreshPanelBody({ preserveScroll: false });
                refreshHeader();
            });
            modeButtons.appendChild(btn);
        }
        modeCard.appendChild(modeButtons);

        const modeDesc = document.createElement('div');
        modeDesc.className = 'saga-runtime-help';
        modeDesc.textContent = AUTOMATION_MODES[normalizeAutomationMode(settings.automationMode || settings.workflowMode)].description;
        modeCard.appendChild(modeDesc);

        const currentMode = normalizeAutomationMode(settings.automationMode || settings.workflowMode);
        const automationSection = createCollapsibleSection(
            'session.automationMode',
            'Automation Mode',
            getAutomationLabel(currentMode),
            true,
            modeCard,
            { tooltip: 'Choose whether Saga runs only when clicked or automatically after roleplay turns.' }
        );
        markTourTarget(automationSection, 'session.automation');
        container.appendChild(automationSection);
    }

    container.appendChild(createCollapsibleSection(
        `session.instructions.${guideMode}`,
        guide.title,
        guide.subtitle,
        false,
        createInstructionsCard(guideMode),
        { tooltip: guide.tooltip }
    ));

    const stats = document.createElement('div');
    stats.className = 'saga-runtime-card';
    markTourTarget(stats, 'session.metrics');
    const statsTitle = document.createElement('div');
    statsTitle.className = 'saga-runtime-card-title';
    statsTitle.textContent = 'Session Metrics';
    addTooltip(statsTitle, 'Runtime counters for pending changes, accepted Lorecards, relevance tiers, and current injection size.');
    stats.appendChild(statsTitle);
    const counts = getPanelLoreState(state).counts;
    const selectedLoreCount = getSelectedLoreInjectionCount(state, settings);
    const injectionStats = getInjectionCharacterStats(state, settings);
    stats.appendChild(createKeyValue('Active chat', getActiveChatMetricName(), 'The active SillyTavern chat whose Saga metrics and chat metadata are being shown.'));
    stats.appendChild(createKeyValue('Pending continuity changes', state?.lastDelta ? '1' : '0', 'Legacy extracted state delta waiting in the Continuity tab. New scans apply directly to Continuity sections.'));
    stats.appendChild(createKeyValue('Pending Lorecards', String((state?.pendingLoreEntries || []).length), 'Generated Lorecards waiting in the Lorecards tab Pending Lorecard Review section.'));
    stats.appendChild(createKeyValue('Accepted lore entries', String(counts.all - counts.pending), 'Lore entries currently stored in the accepted lore matrix.'));
    stats.appendChild(createKeyValue('High-relevance lore entries', String(counts.active), 'Accepted lore entries currently assigned to the High-Relevance injection tier.'));
    stats.appendChild(createKeyValue('Lore selected for injection', String(selectedLoreCount), 'Accepted lore entries selected for Lore Injection after pin/mute rules, Context activation, and fallback priority selection. There is no hidden entry cap; mute entries to exclude them.'));
    stats.appendChild(createKeyValue('Injection token estimate', injectionStats.totalChars ? `${injectionStats.totalTokens} tokens` : 'empty', 'Approximate token count for the combined Continuity + Lore injection previews.'));
    stats.appendChild(createKeyValue('Total chars injected', `${injectionStats.totalChars} chars`, 'Combined character count of Continuity Injection plus Lore Injection using current Injection tab toggles and handling modes.'));
    container.appendChild(stats);

    container.appendChild(createDangerZoneCard(state));
}

function createInstructionsCard(guideMode = normalizeExperienceMode(getSettings().experienceMode)) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-instructions-card';
    const mode = normalizeExperienceMode(guideMode);
    const guide = getRuntimeGuideContent(mode);
    const sections = getRuntimeGuideSections(mode);

    const intro = document.createElement('p');
    intro.className = 'saga-instructions-lede';
    intro.textContent = guide.lede;
    wrap.appendChild(intro);

    const actions = document.createElement('div');
    actions.className = 'saga-guide-actions';
    actions.appendChild(createButton(guide.tourLabel || 'Start Walkthrough', 'Open a guided walkthrough that moves through the related Saga tabs and controls.', () => {
        startSagaTour(mode);
    }, 'saga-primary-button'));
    wrap.appendChild(actions);

    const flow = document.createElement('div');
    flow.className = 'saga-instructions-flow saga-instructions-section-list';

    for (const section of sections) {
        const card = document.createElement('div');
        card.className = 'saga-instructions-section-card';
        const main = document.createElement('div');
        main.className = 'saga-instructions-section-main';
        const header = document.createElement('div');
        header.className = 'saga-instructions-section-header';
        const title = document.createElement('div');
        title.className = 'saga-instructions-section-title';
        title.textContent = section.label;
        header.appendChild(title);
        header.appendChild(createStatusPill(`${section.stepCount} step${section.stepCount === 1 ? '' : 's'}`, `${section.label} walkthrough length.`));
        main.appendChild(header);
        const body = document.createElement('div');
        body.className = 'saga-instructions-section-body';
        body.textContent = section.description || `Walk through the ${section.label} tab.`;
        main.appendChild(body);
        card.appendChild(main);
        const action = createButton('Start', `Start the ${section.label} walkthrough.`, () => {
            startSagaTour(mode, { sectionId: section.id });
        }, 'saga-mini-button saga-guide-step-button');
        card.appendChild(action);
        flow.appendChild(card);
    }

    wrap.appendChild(flow);

    if (String(guide.note || '').trim()) {
        const close = document.createElement('p');
        close.className = 'saga-instructions-note';
        close.textContent = guide.note;
        wrap.appendChild(close);
    }

    return wrap;
}

function createCompactPresetStat(label, value) {
    const row = document.createElement('div');
    row.className = 'saga-preset-status-stat';
    const key = document.createElement('span');
    key.textContent = label;
    const val = document.createElement('strong');
    val.textContent = value;
    row.appendChild(key);
    row.appendChild(val);
    return row;
}

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadBytes(data, filename, mimeType = 'application/octet-stream') {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function sanitizeFileStem(value) {
    const text = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return text || 'saga-export';
}

function cloneJson(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function cloneDefaultSettings() {
    return cloneJson(DEFAULT_SETTINGS);
}

function copyStoredApiKeySettings(source, target) {
    if (!source || !target) return target;
    for (const prefix of STORED_API_KEY_SETTING_PREFIXES) {
        for (const suffix of STORED_API_KEY_SETTING_SUFFIXES) {
            const key = `${prefix}${suffix}`;
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                target[key] = cloneJson(source[key]);
            }
        }
    }
    return target;
}

function resetAllSettingsToDefaults() {
    const current = getSettings();
    const defaults = cloneDefaultSettings();
    copyStoredApiKeySettings(current, defaults);
    saveSettings(defaults);
}

function resetSettingKeysToDefaults(settingKeys, label = 'Settings') {
    const keys = Array.isArray(settingKeys) ? settingKeys : [];
    if (!keys.length) return;

    const next = getSettings();
    let changed = 0;
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) continue;
        next[key] = cloneJson(DEFAULT_SETTINGS[key]);
        changed += 1;
    }

    if (!changed) return;
    saveSettings(next);
    refreshPanelBody({ preserveScroll: true });
    toast(`${label} reset to defaults.`, 'info');
}

function appendSettingsResetButton(container, settingKeys, label = 'Settings') {
    if (!container || !Array.isArray(settingKeys) || !settingKeys.length) return;
    const row = document.createElement('div');
    row.className = 'saga-settings-reset-row';
    row.appendChild(createButton(
        'Reset Defaults',
        `Reset only the ${label.toLowerCase()} controls in this section to bundled defaults.`,
        () => resetSettingKeysToDefaults(settingKeys, label),
        'saga-small-button saga-settings-reset-button'
    ));
    container.appendChild(row);
}

function createDangerZoneCard(state) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-danger-zone-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title saga-danger-zone-title';
    title.textContent = 'Danger Zone';
    addTooltip(title, 'Destructive cleanup actions for the current chat. Deleted accepted lore can be recovered through Lore Timeline when payloads are retained. Total Reset clears all Saga data.');
    card.appendChild(title);

    card.appendChild(createKeyValue('Accepted lore', String((state?.loreMatrix || []).length), 'Lore entries currently stored in the accepted lore matrix.'));
    card.appendChild(createKeyValue('Pending Lorecards', String((state?.pendingLoreEntries || []).length), 'Generated Lorecards waiting in the Lorecards tab Pending Lorecard Review section.'));
    card.appendChild(createKeyValue('Pending continuity changes', state?.lastDelta ? '1' : '0', 'Legacy extracted continuity delta waiting in the Continuity tab.'));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';

    actions.appendChild(createButton('Delete All Lore', 'Deletes accepted lore, pending lore, and pin/mute selections. Lightweight continuity state is left intact.', async () => {
        const proceed = await confirmAction('Are you sure? Delete all Saga lore?', 'You are about to delete every accepted lore entry, every pending lore entry, and all pin/mute selections for this chat. Lightweight continuity state will remain. Accepted lore can be restored to Pending Review through Lore Timeline when retained. Continue?');
        if (!proceed) return;
        const current = getState();
        const beforeTimeline = captureLoreTimelineState(current);
        const deleted = normalizeLoreMatrix(current.loreMatrix || []).length;
        current.loreMatrix = [];
        current.pendingLoreEntries = [];
        current.pendingLoreMeta = null;
        current.loreSelection = { pinnedIds: [], suppressedIds: [] };
        if (current.lorePanel) {
            current.lorePanel.selectedEntryId = '';
            current.lorePanel.reviewSelectedIds = [];
        }
        if (deleted > 0) {
            recordLoreTimelineEvent(current, {
                before: beforeTimeline,
                after: captureLoreTimelineState(current),
                type: 'delete_all',
                source: 'danger_zone',
                summary: `Deleted all accepted lore (${deleted} entr${deleted === 1 ? 'y' : 'ies'}).`,
            });
        }
        saveState(current);
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('All lore entries deleted.', 'info');
    }, 'saga-danger-button'));

    actions.appendChild(createButton('Reset Generation State', 'Clears detected lore context, pending generated lore, pending deltas, and generation ledger. Accepted lore remains intact.', async () => {
        const proceed = await confirmAction('Are you sure? Reset generation state?', 'You are about to clear detected context, pending generated lore, pending continuity changes, and the lore-generation ledger. Accepted lore entries and Lore Timeline will remain. Continue?');
        if (!proceed) return;
        const current = getState();
        const defaults = getDefaultState();
        current.loreContext = defaults.loreContext;
        current.pendingLoreEntries = [];
        current.pendingLoreMeta = null;
        current.loreGeneration = defaults.loreGeneration;
        current.loreBulkGeneration = defaults.loreBulkGeneration;
        current.continuityScan = defaults.continuityScan;
        current.lastDelta = null;
        if (current.lorePanel) current.lorePanel.reviewSelectedIds = [];
        resetCanonPreviewUiState();
        clearCanonLoreDatabaseCache();
        saveState(current);
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('Generation state reset.', 'info');
    }, 'saga-danger-button'));

    actions.appendChild(createButton('Reset All Settings', 'Resets Saga preferences and provider settings to bundled defaults. Stored API keys are preserved.', async () => {
        const proceed = await confirmAction('Are you sure? Reset all Saga settings?', 'You are about to reset Saga preferences, workflow settings, provider selections, generation settings, injection settings, and UI defaults. Stored API keys are preserved. Chat state, accepted lore, pending lore, and Lore Timeline are not changed. Continue?');
        if (!proceed) return;
        resetAllSettingsToDefaults();
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('Saga settings reset to defaults. Stored API keys were preserved.', 'info');
    }, 'saga-danger-button'));

    actions.appendChild(createButton('Total Reset', 'Resets Saga continuity state for this chat to defaults and clears Lore Timeline. Panel size and position are preserved.', async () => {
        const proceed = await confirmAction('Are you sure? Total reset?', 'You are about to reset all Saga data for this chat: lightweight continuity state, accepted lore, pending lore, generation state, and Lore Timeline. Window position and size are preserved. Because recovery data will also be cleared, this action cannot be undone. Continue?');
        if (!proceed) return;
        const current = getState();
        const defaults = getDefaultState();
        if (current.lorePanel) {
            defaults.lorePanel = {
                ...defaults.lorePanel,
                isOpen: true,
                x: current.lorePanel.x,
                y: current.lorePanel.y,
                width: current.lorePanel.width,
                height: current.lorePanel.height,
                activeTab: 'session',
            };
        }
        resetCanonPreviewUiState({ preserveDetailLevel: false });
        clearCanonLoreDatabaseCache();
        clearContextIndexCache();
        saveState(defaults);
        refreshPanelBody({ preserveScroll: false });
        refreshHeader();
        toast('Saga state reset. Lore Timeline cleared.', 'info');
    }, 'saga-danger-button'));

    card.appendChild(actions);
    return card;
}

function ensureProviderReadyForAction(kind = 'lore', actionLabel = 'this action', statusKind = kind) {
    const validation = validateLoreProviderConfiguration(kind);
    if (validation.ok) return true;

    const message = `API/model settings incomplete for ${actionLabel}: ${validation.message}`;
    setFeatureProgress(statusKind, message, 100);
    toast(message, 'error');
    return false;
}

function ensureLoreProviderReadyForAction(actionLabel = 'this action', statusKind = 'lore') {
    return ensureProviderReadyForAction('lore', actionLabel, statusKind);
}

function ensureContinuityProviderReadyForAction(actionLabel = 'this action') {
    return ensureProviderReadyForAction('continuity', actionLabel, 'continuity');
}


// Context tab -----------------------------------------------------------------

function renderContextTab(container, state) {
    const settings = getSettings();
    const basic = isBasicExperience(settings);
    const contextIndex = getContextIndexSync();
    if (!contextIndex) {
        loadContextIndex()
            .then(() => refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true }))
            .catch(e => console.warn('[Saga] Context index load failed:', e));
    }

    container.appendChild(createSectionHeader(
        'Context',
        'Set and audit where this chat sits inside each loaded Loredeck.'
    ));

    const contextStack = getContextWorkbenchStack(state);
    const contextProposals = getContextResolutionProposals(state);
    container.appendChild(createCollapsibleSection(
        'context.commandCenter',
        'Runtime Context',
        `${contextStack.length} loaded | ${contextProposals.length} proposal${contextProposals.length === 1 ? '' : 's'}`,
        true,
        createContextCommandCenterCard(state, contextIndex),
        {
            tooltip: 'Primary controls for browsing, detecting, resolving, and reviewing loaded Loredeck Context.',
        }
    ));
    container.appendChild(createCollapsibleSection(
        'context.loadedLoredecks',
        'Loaded Loredeck Contexts',
        contextStack.length ? `${contextStack.length} active` : 'none loaded',
        true,
        createLoredeckContextCard(state, contextIndex),
        {
            tooltip: 'Per-Loredeck Context rows for the active stack, including locks, manual browser access, and resolver confidence.',
        }
    ));
    if (!basic) container.appendChild(createContextAdvancedBriefSection(state));
}

function clampSettingConfidence(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return Math.max(0, Math.min(1, fallback));
    if (number > 1 && number <= 100) return Math.max(0, Math.min(1, number / 100));
    return Math.max(0, Math.min(1, number));
}

function getContextAutomationModeLabel(mode = 'manual') {
    const normalized = String(mode || 'manual').toLowerCase();
    if (normalized === 'assisted') return 'Assisted';
    if (normalized === 'automatic') return 'Automatic';
    return 'Manual';
}

function getContextBriefSignalSummary(brief = {}) {
    const signals = brief?.signals || {};
    const values = [
        signals.arc ? `Arc: ${signals.arc}` : '',
        signals.phase ? `Phase: ${signals.phase}` : '',
        signals.season || signals.episode ? `S${signals.season || '?'} E${signals.episode || '?'}` : '',
        signals.chapter ? `Chapter: ${signals.chapter}` : '',
        signals.issue ? `Issue: ${signals.issue}` : '',
        signals.quest ? `Quest: ${signals.quest}` : '',
        signals.gameStage ? `Game: ${signals.gameStage}` : '',
        signals.stardate ? `Stardate: ${signals.stardate}` : '',
        ...(Array.isArray(signals.positionPhrases) ? signals.positionPhrases.slice(0, 2) : []),
        ...(Array.isArray(signals.eventLabels) ? signals.eventLabels.slice(0, 2) : []),
    ].map(value => String(value || '').trim()).filter(Boolean);
    const coordinates = signals.coordinates && typeof signals.coordinates === 'object'
        ? Object.entries(signals.coordinates).slice(0, 3).map(([key, value]) => `${key}: ${value}`)
        : [];
    return [...values, ...coordinates].slice(0, 8).join(' | ') || 'none';
}

function createContextDetectionCard(state) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-generation-progress-card';
    markTourTarget(card, 'context.detect.card');

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Context Detection';
    addTooltip(title, 'Detects Context from recent chat and updates the Context Brief plus loaded Loredeck Context rows. It does not create lore entries.');
    card.appendChild(title);

    const settings = getSettings();
    if (!isBasicExperience(settings)) {
        const automationCard = createAutomationModeCard(
            'Context Detection',
            'contextDetectionMode',
            'contextDetectionAutoInterval',
            'Only runs when you click Detect Context.',
            'Runs automatically after roleplay turns on this interval, using recent messages and loaded Loredeck Context candidates.',
            'Automatic Context detection interval in completed model turns.'
        );
        markTourTarget(automationCard, 'context.automation');
        card.appendChild(automationCard);

        const sourceRow = document.createElement('label');
        sourceRow.className = 'saga-slider-row saga-compact-slider-row';
        markTourTarget(sourceRow, 'context.sourceMessages');
        const sourceText = document.createElement('span');
        sourceText.textContent = `Context source messages: ${settings.contextSourceMessageCount || 20}`;
        addTooltip(sourceText, 'How many recent chat messages are sent to Context detection. This is separate from the Lore generation source window.');
        const sourceInput = document.createElement('input');
        sourceInput.type = 'range';
        sourceInput.min = '4';
        sourceInput.max = '200';
        sourceInput.step = '1';
        sourceInput.value = String(settings.contextSourceMessageCount || 20);
        sourceInput.addEventListener('input', () => {
            const next = getSettings();
            next.contextSourceMessageCount = Math.max(4, Math.min(200, parseInt(sourceInput.value, 10) || 20));
            saveSettings(next);
            sourceText.textContent = `Context source messages: ${next.contextSourceMessageCount}`;
        });
        sourceRow.appendChild(sourceText);
        sourceRow.appendChild(sourceInput);
        card.appendChild(sourceRow);
        card.appendChild(createRangeSettingRow(
            'Reasoner fallback',
            'Minimum recent-message character count before automatic Context detection stores Reasoner-backed loaded-deck Context proposals. Manual Ask Reasoner ignores this threshold.',
            'contextModelFallbackMinCharacters',
            { min: 0, max: 8000, fallback: 1200, suffix: ' chars' }
        ));

        appendSettingsResetButton(card, CONTEXT_DETECTION_SETTING_KEYS, 'Context detection settings');
    }

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-generation-actions';
    actions.appendChild(markTourTarget(createButton('Detect Context', 'Analyzes recent messages and updates the Context Brief plus loaded Loredeck Context rows. It does not create lore entries.', async (btn) => {
        await handleDetectStoryContext(btn);
    }, 'saga-primary-button'), 'context.detect'));
    card.appendChild(actions);

    appendGenerationStatus(card, state, 'context');
    card.appendChild(createContextBriefStatusCard(state));
    return card;
}

function getContextBriefStatusLabel(status = {}) {
    const state = String(status?.state || 'idle').toLowerCase();
    switch (state) {
        case 'detected': return 'Detected';
        case 'repaired': return 'Repaired';
        case 'fallback': return 'Local fallback';
        case 'failed': return 'Failed';
        case 'empty': return 'No signal';
        case 'skipped': return 'Skipped';
        case 'idle':
        default:
            return 'Idle';
    }
}

function getContextBriefStatusTone(status = {}) {
    const state = String(status?.state || 'idle').toLowerCase();
    if (state === 'detected') return 'low';
    if (state === 'repaired' || state === 'fallback' || state === 'empty' || state === 'skipped') return 'medium';
    if (state === 'failed') return 'high';
    return 'unknown';
}

function formatContextBriefUpdatedAt(brief = {}) {
    const timestamp = Number(brief?.updatedAt || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';
    return formatRelativeHealthTime(timestamp);
}

function createContextBriefStatusPill(text, tooltip, tone = '') {
    const pill = createStatusPill(text, tooltip);
    if (tone) pill.classList.add(`saga-status-pill-risk-${tone}`);
    return pill;
}

function createContextBriefStatusCard(state) {
    const basic = isBasicExperience(getSettings());
    const brief = state?.contextBrief || {};
    const status = brief?.status || {};
    const labelText = getContextBriefStatusLabel(status);
    const tone = getContextBriefStatusTone(status);
    const row = document.createElement('div');
    row.className = `saga-lore-context-status saga-context-brief-status saga-context-brief-status-${tone}`;
    markTourTarget(row, 'context.briefStatus');

    const label = document.createElement('div');
    label.className = 'saga-lore-context-status-label';
    label.textContent = 'Detector';
    addTooltip(label, 'Latest top-level Context Brief extraction status. Loredeck Context rows below use this brief plus each loaded deck timeline registry.');
    row.appendChild(label);

    const value = document.createElement('div');
    value.className = 'saga-lore-context-status-value';
    const message = String(status.message || status.error || '').trim();
    value.textContent = message ? `${labelText}: ${message}` : labelText;
    if (tone === 'medium' || tone === 'high') value.classList.add('saga-warning-text');
    addTooltip(value, status.rawResponsePreview ? `Raw response preview: ${status.rawResponsePreview}` : 'No raw response preview stored.');
    row.appendChild(value);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta saga-context-brief-status-chips';
    chips.appendChild(createContextBriefStatusPill(labelText, 'Detector status from the last Context scan.', tone));
    if (!basic && status.repaired) chips.appendChild(createContextBriefStatusPill('JSON repaired', 'Saga repaired malformed detector JSON before saving the brief.', 'medium'));
    if (!basic && status.fallbackUsed) chips.appendChild(createContextBriefStatusPill('Local fallback', 'Saga inferred Context locally from recent message headings or obvious story-position cues.', 'medium'));
    if (!basic) chips.appendChild(createStatusPill(`Source: ${formatContextSource(brief.source || 'unknown')}`, 'Where the latest Context Brief came from.'));
    if (!basic) chips.appendChild(createStatusPill(`Evidence: ${(brief.evidence || []).length}`, 'Number of evidence snippets saved in the latest Context Brief.'));
    if (!basic) chips.appendChild(createStatusPill(`Uncertainty: ${brief.uncertainty?.level || 'low'}`, 'Detector uncertainty level from the latest Context Brief.'));
    chips.appendChild(createStatusPill(`Updated: ${formatContextBriefUpdatedAt(brief)}`, 'When the latest Context Brief was saved.'));
    row.appendChild(chips);

    return row;
}

function formatLoredeckContextUpdatedAt(context = {}) {
    const timestamp = Number(context?.updatedAt || context?.lastDetectedAt || 0);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Never';
    return formatRelativeHealthTime(timestamp);
}

function toggleLoredeckContextManualLock(packId, locked) {
    setLoredeckContext(packId, {
        manualLock: !!locked,
        source: 'manual',
        updatedAt: Date.now(),
    });
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    refreshHeader();
    refreshContextWorkbench();
}

function createLoreGenerationCard(state) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-generation-progress-card saga-lore-generation-card';
    markTourTarget(card, 'lore.generation');

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Lore Generation';
    addTooltip(title, 'Create reviewable lore entries either from the local canon database or from model analysis of recent story messages.');
    card.appendChild(title);

    card.appendChild(createLoreContextStatusCard(state));

    const actionsGrid = document.createElement('div');
    actionsGrid.className = 'saga-lore-generation-grid';
    actionsGrid.appendChild(createCanonSuggestionPanel(state));
    actionsGrid.appendChild(createStoryLoreGenerationPanel(state));
    actionsGrid.appendChild(createManualLorecardPanel());
    card.appendChild(actionsGrid);

    return card;
}

function createManualLorecardPanel() {
    const panel = document.createElement('div');
    panel.className = 'saga-lore-generation-panel saga-manual-lorecard-panel';

    const header = document.createElement('div');
    header.className = 'saga-lore-generation-panel-title';
    header.textContent = 'Manual Lorecard';
    addTooltip(header, 'Create a reviewable Lorecard by hand when you already know a fact should be available for future responses.');
    panel.appendChild(header);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Draft a fact yourself, then accept it through Pending Lorecard Review before it affects prompts.';
    panel.appendChild(help);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-generation-actions';
    actions.appendChild(markTourTarget(createButton('Add Lorecard', 'Create a manual Lorecard draft and send it to Pending Lorecard Review.', () => {
        openNewLoreDialog({ basicReview: isBasicExperience(getSettings()) });
    }, 'saga-primary-button'), 'lore.manual.add'));
    panel.appendChild(actions);

    panel.appendChild(createKeyValue('Destination', 'Pending Review', 'Manual Lorecards are reviewed before they become accepted Lorecards.'));

    return panel;
}

function createLoreContextStatusCard(state) {
    const context = state?.loreContext || {};
    const card = document.createElement('div');
    card.className = 'saga-lore-context-status';
    markTourTarget(card, 'lore.contextStatus');

    const label = document.createElement('div');
    label.className = 'saga-lore-context-status-label';
    label.textContent = 'Context';
    addTooltip(label, 'Legacy canon suggestions use the global Context projection for date-aware canon filtering. Loredeck gates use the loaded Loredeck Context rows in the Context tab.');
    card.appendChild(label);

    const value = document.createElement('div');
    value.className = 'saga-lore-context-status-value';
    if (hasUsableStoryContext(context)) {
        const parts = [context.sceneDate, context.canonBoundary, context.branchId ? `Branch: ${context.branchId}` : '']
            .map(part => String(part || '').trim())
            .filter(Boolean);
        value.textContent = parts.join(' · ') || 'Context detected';
    } else {
        value.textContent = 'No Context';
        value.classList.add('saga-warning-text');
    }
    card.appendChild(value);

    const action = createButton('Refresh Context', 'Runs Detect Context, then returns here. Useful before suggesting canon lore.', async (btn) => {
        await handleDetectStoryContext(btn, { stayOnTab: 'lore' });
    }, 'saga-secondary-button saga-compact-action-button');
    markTourTarget(action, 'lore.contextRefresh');
    card.appendChild(action);

    return card;
}

function createCanonSuggestionPanel(state) {
    const settings = getSettings();
    const db = state?.canonLoreDatabase || {};
    const panel = document.createElement('div');
    panel.className = 'saga-lore-generation-panel saga-canon-suggestion-panel';

    const header = document.createElement('div');
    header.className = 'saga-lore-generation-panel-title';
    header.textContent = 'Suggest Canon Lore';
    addTooltip(header, 'Uses the local Lore Database and current Context to propose date-aware canon constraints. No model call.');
    panel.appendChild(header);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Preview local canon packs for the current Context, choose only the entries you want, then add them to Pending Lore Review. No API/model cost.';
    panel.appendChild(help);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-generation-actions';
    actions.appendChild(markTourTarget(createButton('Preview Canon Packs', 'Queries the local Lore Database and groups matching entries into selectable packs with counts.', async (btn) => {
        await handlePreviewCanonLorePacks(btn);
    }, 'saga-primary-button'), 'lore.canon.preview'));
    actions.appendChild(markTourTarget(createButton('Quick Add Top Matches', `Legacy one-click flow: proposes up to ${settings.canonLoreMaxEntries || 10} top matches into Pending Lore Review.`, async (btn) => {
        await handleSuggestCanonLore(btn);
    }, 'saga-secondary-button'), 'lore.canon.quick'));
    panel.appendChild(actions);

    panel.appendChild(createCanonPreviewSection(state));

    if (!isBasicExperience(settings)) {
        const advanced = createCollapsibleSection(
            'lore.canonSuggestionSettings',
            'Canon Suggestion Settings',
            settings.canonLoreDatabaseEnabled === false ? 'disabled' : (settings.canonLoreAutoPropose === false ? 'manual' : 'auto after context'),
            false,
            createCanonSuggestionSettingsContent(state),
            { tooltip: 'Low-frequency local canon database settings.' }
        );
        markTourTarget(advanced, 'lore.canon.settings');
        panel.appendChild(advanced);
    }

    appendGenerationStatus(panel, state, 'canon');
    panel.appendChild(createKeyValue('Last query', db.lastQueriedAt ? new Date(db.lastQueriedAt).toLocaleString() : 'never', 'When the local canon database was last queried.'));
    panel.appendChild(createKeyValue('Last result', db.lastStatus || 'Not queried.', 'Summary of the last local canon lore query.'));

    return panel;
}

function createCanonSuggestionSettingsContent(state) {
    const settings = getSettings();
    const content = document.createElement('div');
    content.className = 'saga-canon-suggestion-settings';

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid';
    markTourTarget(grid, 'lore.canon.settingsToggles');
    grid.appendChild(createToggleCard(
        'Use Local Canon Database',
        settings.canonLoreDatabaseEnabled !== false,
        'Allows manual previews, quick add, and optional auto-suggest to query local pre-generated canon lore files.',
        (checked) => {
            const next = getSettings();
            next.canonLoreDatabaseEnabled = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    grid.appendChild(createToggleCard(
        'Auto-suggest after Context detection',
        settings.canonLoreAutoPropose !== false,
        'When enabled, a Context detection run also performs the quick top-match canon proposal. It does not affect manual previews.',
        (checked) => {
            const next = getSettings();
            next.canonLoreAutoPropose = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    content.appendChild(grid);

    const capRow = document.createElement('label');
    capRow.className = 'saga-slider-row saga-compact-slider-row';
    markTourTarget(capRow, 'lore.canon.cap');
    const capText = document.createElement('span');
    capText.textContent = `Quick/auto add cap: ${settings.canonLoreMaxEntries || 10}`;
    addTooltip(capText, 'Maximum entries used only by Quick Add Top Matches and auto-suggest after Context detection. Pack preview counts are not capped by this slider.');
    const capInput = document.createElement('input');
    capInput.type = 'range';
    capInput.min = '1';
    capInput.max = '200';
    capInput.step = '1';
    capInput.value = String(settings.canonLoreMaxEntries || 10);
    capInput.addEventListener('input', () => {
        const next = getSettings();
        next.canonLoreMaxEntries = Math.max(1, Math.min(200, parseInt(capInput.value, 10) || 10));
        saveSettings(next);
        capText.textContent = `Quick/auto add cap: ${next.canonLoreMaxEntries}`;
    });
    capRow.appendChild(capText);
    capRow.appendChild(capInput);
    content.appendChild(capRow);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Auto-suggest runs only when Context detection runs. With the default automatic context interval, that is interval-based, not every message. Manual pack preview can be run any time.';
    content.appendChild(help);
    return content;
}

function getCanonPreviewContextKey(context = {}, state = getState()) {
    const activeContextParts = getEnabledLoredeckStackPackIds(state).map(packId => {
        const row = state?.loredeckContexts?.[packId] || {};
        return [
            packId,
            row.sceneDate || '',
            row.subjectiveDate || '',
            row.stardate || '',
            row.anchorId || '',
            row.anchorFrom || '',
            row.anchorTo || '',
            row.arc || '',
            row.phase || '',
            row.season || '',
            row.episode || '',
            row.chapter || '',
            row.issue || '',
            row.quest || '',
            row.gameStage || '',
            row.contextSortKey ?? '',
            row.contextSortKeyFrom ?? '',
            row.contextSortKeyTo ?? '',
        ].map(value => String(value || '').trim()).join(':');
    });
    return [
        context.sceneDate || '',
        context.subjectiveDate || '',
        context.canonBoundary || '',
        context.branchId || '',
        context.timeTravelMode || '',
        context.stardate || '',
        context.anchorId || '',
        context.anchorFrom || '',
        context.anchorTo || '',
        context.arc || '',
        context.phase || '',
        context.season || '',
        context.episode || '',
        context.chapter || '',
        context.issue || '',
        context.quest || '',
        context.gameStage || '',
        ...activeContextParts,
    ].map(value => String(value || '').trim()).join('|');
}

function getCanonPreviewSelectedIds() {
    return new Set(Array.isArray(canonPreviewUiState.selectedEntryIds) ? canonPreviewUiState.selectedEntryIds : []);
}

function setCanonPreviewSelectedIds(ids = []) {
    canonPreviewUiState.selectedEntryIds = Array.from(new Set((ids || []).map(id => String(id || '')).filter(Boolean)));
}

function getCanonPreviewEntrySummary(entry = {}) {
    const content = entry.content || {};
    return content.injection
        || content.fact
        || entry.fact
        || (Array.isArray(content.constraints) ? content.constraints[0] : '')
        || (Array.isArray(content.antiLore) ? content.antiLore[0] : '')
        || '';
}

function getCanonPreviewEntryMap(preview = null) {
    return new Map((preview?.entries || []).map(entry => [String(entry.id || ''), entry]));
}

function isCanonPreviewEntryAddable(entry = {}) {
    return (entry.extensions?.canonPreview?.duplicateStatus || 'new') === 'new';
}

const CANON_PREVIEW_DETAIL_LEVELS = [
    { id: 'core', label: 'Core', tooltip: 'Only highest-value active guardrails and reveal blockers.' },
    { id: 'standard', label: 'Standard', tooltip: 'Core plus normal character, access, and constraint entries.' },
    { id: 'detailed', label: 'Detailed', tooltip: 'Includes low-priority and micro constraints that are still active.' },
    { id: 'all', label: 'All Active', tooltip: 'Shows every active non-reference entry in each pack.' },
];

function getCanonPreviewDetailLevel() {
    return ['core', 'standard', 'detailed', 'all'].includes(canonPreviewUiState.detailLevel)
        ? canonPreviewUiState.detailLevel
        : 'standard';
}

function getCanonPreviewDetailRank(level) {
    const normalized = String(level || '').toLowerCase();
    if (normalized === 'core') return 1;
    if (normalized === 'standard') return 2;
    if (normalized === 'detailed') return 3;
    return 4;
}

function getCanonPreviewEntryDetailLevel(entry = {}) {
    const level = entry.extensions?.canonPreview?.detailLevel || 'standard';
    return ['core', 'standard', 'detailed'].includes(level) ? level : 'standard';
}

function canonPreviewDetailAllows(entry = {}, detailLevel = getCanonPreviewDetailLevel()) {
    if (detailLevel === 'all') return true;
    return getCanonPreviewDetailRank(getCanonPreviewEntryDetailLevel(entry)) <= getCanonPreviewDetailRank(detailLevel);
}

function createCanonPreviewDetailControls() {
    const active = getCanonPreviewDetailLevel();
    const wrap = document.createElement('div');
    wrap.className = 'saga-canon-detail-filter';
    CANON_PREVIEW_DETAIL_LEVELS.forEach(option => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `saga-canon-detail-button ${active === option.id ? 'saga-canon-detail-active' : ''}`.trim();
        btn.textContent = option.label;
        addTooltip(btn, option.tooltip);
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            canonPreviewUiState.detailLevel = option.id;
            refreshPanelBody({ preserveScroll: true });
        });
        wrap.appendChild(btn);
    });
    return wrap;
}

function createCanonPreviewSection(state) {
    const section = document.createElement('div');
    section.className = 'saga-canon-preview-section';
    markTourTarget(section, 'lore.canon.previewResults');
    const preview = canonPreviewUiState.preview;
    const activeStackIds = getEnabledLoredeckStackPackIds(state);
    const currentContext = getCanonSuggestionContext(state);
    const currentContextKey = getCanonPreviewContextKey(currentContext, state);
    const isStale = !!(preview && canonPreviewUiState.contextKey && canonPreviewUiState.contextKey !== currentContextKey);

    if (!activeStackIds.length) {
        section.appendChild(createEmptyMessage('No active Loredecks are loaded. Open the Loredeck Library and add one or more decks to the active stack before previewing canon Lorecards.'));
        return section;
    }

    if (!preview) {
        section.appendChild(createEmptyMessage('No canon pack preview yet. Preview packs to choose entries before adding them to Pending Lore Review.'));
        return section;
    }

    if (preview.status === 'disabled') {
        section.appendChild(createEmptyMessage('The local canon database is disabled in Canon Suggestion Settings.'));
        return section;
    }
    if (preview.status === 'no_date') {
        section.appendChild(createEmptyMessage('No parseable Scene date. Detect or enter Context before previewing canon packs.'));
        return section;
    }
    if (preview.status === 'no_context') {
        section.appendChild(createEmptyMessage('No Context is available for the active Loredecks. Use the Context tab or Detect Context before previewing canon packs.'));
        return section;
    }
    if (!preview.entries?.length) {
        section.appendChild(createEmptyMessage('No canon database entries matched this Context.'));
        return section;
    }

    const summary = document.createElement('div');
    summary.className = 'saga-canon-preview-summary';
    const yearText = preview.schoolYear ? `Year ${preview.schoolYear} | ` : '';
    const contextLabel = preview.sceneIso || currentContext.canonBoundary || currentContext.label || currentContext.anchorId || currentContext.arc || currentContext.chapter || currentContext.stardate || 'active Context';
    summary.textContent = `${yearText}${contextLabel} | ${preview.matchedCount || preview.entries.length} matches | ${preview.newCount || 0} new | ${preview.duplicateCount || 0} already present`;
    section.appendChild(summary);
    section.appendChild(markTourTarget(createCanonPreviewDetailControls(), 'lore.canon.detailFilter'));

    if (isStale) {
        const stale = document.createElement('div');
        stale.className = 'saga-runtime-help saga-warning-text';
        stale.textContent = 'This preview was built for earlier Context. Refresh Canon Packs before adding entries.';
        section.appendChild(stale);
    }

    const packs = Array.isArray(preview.packs) ? preview.packs : [];
    const detailLevel = getCanonPreviewDetailLevel();
    const entryMap = getCanonPreviewEntryMap(preview);
    const activePack = packs.find(pack => pack.id === canonPreviewUiState.selectedPackId)
        || packs.find(pack => pack.newCount > 0)
        || packs[0]
        || null;
    if (activePack && canonPreviewUiState.selectedPackId !== activePack.id) {
        canonPreviewUiState.selectedPackId = activePack.id;
    }

    const packGrid = document.createElement('div');
    packGrid.className = 'saga-canon-pack-grid';
    markTourTarget(packGrid, 'lore.canon.packGrid');
    packs.forEach(pack => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `saga-canon-pack-button ${pack.id === activePack?.id ? 'saga-canon-pack-active' : ''}`.trim();
        addTooltip(btn, pack.description || 'Canon preview pack.');
        const packEntriesForDetail = (pack.entryIds || [])
            .map(id => entryMap.get(String(id)))
            .filter(Boolean)
            .filter(entry => canonPreviewDetailAllows(entry, detailLevel));
        const packNewForDetail = packEntriesForDetail.filter(isCanonPreviewEntryAddable).length;

        const label = document.createElement('span');
        label.className = 'saga-canon-pack-label';
        label.textContent = `${pack.label} (${packEntriesForDetail.length})`;
        btn.appendChild(label);

        const meta = document.createElement('span');
        meta.className = 'saga-canon-pack-meta';
        meta.textContent = `${packNewForDetail} new${packEntriesForDetail.length !== (pack.totalCount || 0) ? ` of ${pack.totalCount || 0}` : ''}${pack.duplicateCount ? `, ${pack.duplicateCount} present` : ''}`;
        btn.appendChild(meta);

        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            canonPreviewUiState.selectedPackId = pack.id;
            refreshPanelBody({ preserveScroll: true });
        });
        packGrid.appendChild(btn);
    });
    section.appendChild(packGrid);

    if (!activePack) {
        section.appendChild(createEmptyMessage('No canon packs are available for this preview.'));
        return section;
    }

    const packEntriesAll = (activePack.entryIds || []).map(id => entryMap.get(String(id))).filter(Boolean);
    const packEntries = packEntriesAll.filter(entry => canonPreviewDetailAllows(entry, detailLevel));
    const addablePackIds = packEntries.filter(isCanonPreviewEntryAddable).map(entry => entry.id);
    const selectedIds = getCanonPreviewSelectedIds();
    const selectedAddableCount = Array.from(selectedIds).filter(id => isCanonPreviewEntryAddable(entryMap.get(String(id)) || {})).length;

    const controls = document.createElement('div');
    controls.className = 'saga-canon-preview-actions';
    markTourTarget(controls, 'lore.canon.addPending');
    const count = document.createElement('span');
    count.className = 'saga-canon-preview-selected-count';
    count.textContent = `${selectedAddableCount} selected`;
    controls.appendChild(count);
    controls.appendChild(createButton('Select Pack', `Selects all visible new entries in ${activePack.label} at the current detail level.`, () => {
        setCanonPreviewSelectedIds([...selectedIds, ...addablePackIds]);
        refreshPanelBody({ preserveScroll: true });
    }, 'saga-small-button'));
    controls.appendChild(createButton('Clear', 'Clears the current canon preview selection.', () => {
        setCanonPreviewSelectedIds([]);
        refreshPanelBody({ preserveScroll: true });
    }, 'saga-small-button'));
    const addSelected = createButton('Add Selected to Pending Lore', 'Adds selected canon preview entries to the existing Pending Lore Review list for full inspection before accepting.', async (btn) => {
        await handleAddCanonPreviewEntries(btn, Array.from(getCanonPreviewSelectedIds()));
    }, 'saga-primary-button');
    addSelected.disabled = isStale || selectedAddableCount <= 0;
    controls.appendChild(addSelected);
    const addPack = createButton('Add Pack to Pending Lore', `Adds all new entries in ${activePack.label} to Pending Lore Review.`, async (btn) => {
        await handleAddCanonPreviewEntries(btn, addablePackIds);
    }, 'saga-secondary-button');
    addPack.disabled = isStale || addablePackIds.length <= 0;
    controls.appendChild(addPack);
    section.appendChild(controls);

    const list = document.createElement('div');
    list.className = 'saga-canon-preview-list';
    markTourTarget(list, 'lore.canon.entryList');
    const visibleEntries = packEntries.slice(0, 80);
    visibleEntries.forEach(entry => {
        list.appendChild(createCanonPreviewEntryRow(entry, selectedIds, isStale));
    });
    if (!visibleEntries.length) {
        list.appendChild(createEmptyMessage(`No ${activePack.label} entries at the ${detailLevel === 'all' ? 'All Active' : detailLevel} detail level.`));
    }
    if (packEntriesAll.length > packEntries.length) {
        const hidden = document.createElement('div');
        hidden.className = 'saga-runtime-help saga-compact-help';
        hidden.textContent = `${packEntriesAll.length - packEntries.length} entries hidden by the current detail level. Switch to Detailed or All Active to inspect them.`;
        list.appendChild(hidden);
    }
    if (packEntries.length > visibleEntries.length) {
        const note = document.createElement('div');
        note.className = 'saga-runtime-help saga-compact-help';
        note.textContent = `Showing first ${visibleEntries.length} of ${packEntries.length}. Select Pack still selects every new entry in this pack.`;
        list.appendChild(note);
    }
    section.appendChild(list);
    return section;
}

function createCanonPreviewEntryRow(entry, selectedIds, isStale = false) {
    const id = String(entry?.id || '');
    const duplicateStatus = entry?.extensions?.canonPreview?.duplicateStatus || 'new';
    const duplicateReason = entry?.extensions?.canonPreview?.duplicateReason || '';
    const addable = !isStale && duplicateStatus === 'new';
    const row = document.createElement('label');
    row.className = `saga-canon-preview-row ${selectedIds.has(id) ? 'saga-canon-preview-row-selected' : ''} ${addable ? '' : 'saga-canon-preview-row-disabled'}`.trim();
    markTourTarget(row, 'lore.canon.entry');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedIds.has(id);
    checkbox.disabled = !addable;
    checkbox.addEventListener('change', (event) => {
        event.stopPropagation();
        const next = getCanonPreviewSelectedIds();
        if (checkbox.checked) next.add(id);
        else next.delete(id);
        setCanonPreviewSelectedIds(Array.from(next));
        refreshPanelBody({ preserveScroll: true });
    });
    row.appendChild(checkbox);

    const main = document.createElement('div');
    main.className = 'saga-canon-preview-row-main';
    const title = document.createElement('div');
    title.className = 'saga-canon-preview-row-title';
    title.textContent = entry?.title || 'Canon lore';
    main.appendChild(title);

    const text = document.createElement('div');
    text.className = 'saga-canon-preview-row-text';
    text.textContent = getCanonPreviewEntrySummary(entry);
    main.appendChild(text);

    const meta = document.createElement('div');
    meta.className = 'saga-lore-entry-meta saga-canon-preview-row-meta';
    const previewMeta = entry?.extensions?.canonPreview || {};
    appendEntrySourceAndContextBadges(meta, entry);
    if (entry?.category) meta.appendChild(createBadge(entry.category, 'Canon entry category.'));
    if (entry?.lorePurpose) meta.appendChild(createBadge(LORE_PURPOSE_LABELS[entry.lorePurpose] || entry.lorePurpose, 'Why this canon entry would be useful.'));
    if (previewMeta.suggestionRole) meta.appendChild(createBadge(previewMeta.suggestionRole.replace(/_/g, ' '), 'Canon preview role used for pack sorting.'));
    if (previewMeta.detailLevel) meta.appendChild(createBadge(previewMeta.detailLevel, 'Canon preview detail tier.'));
    if (previewMeta.suggestByDefault === false) meta.appendChild(createBadge('non-default', 'Shown only in All Active or higher-detail review because this is not usually worth suggesting automatically.'));
    if (entry?.relevance) meta.appendChild(createBadge(entry.relevance, 'Recommended relevance tier for Pending Lore Review.'));
    meta.appendChild(createBadge(`P${Number(entry?.priority || 50)}`, 'Canon database priority.'));
    if (duplicateStatus !== 'new') {
        meta.appendChild(createBadge(duplicateStatus, duplicateReason || 'Already present by id/title.'));
    }
    main.appendChild(meta);

    row.appendChild(main);
    return row;
}

function createStoryLoreGenerationPanel(state) {
    const panel = document.createElement('div');
    panel.className = 'saga-lore-generation-panel saga-story-lore-generation-panel';
    markTourTarget(panel, 'lore.story');

    const header = document.createElement('div');
    header.className = 'saga-lore-generation-panel-title';
    header.textContent = 'Scan Story Lore';
    addTooltip(header, 'Uses the Reasoning provider to scan chat messages and create story-specific lore entries for Pending Lore Review. The scan can cover recent messages, a custom range, or the entire chat.');
    panel.appendChild(header);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help saga-lore-scan-help';
    help.textContent = 'Model-based story scan. Uses resumable chunks, partial saves, retries, and configurable scan ranges. Output stays pending until accepted.';
    panel.appendChild(help);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-generation-actions';
    const scanBtn = markTourTarget(createButton('Scan Story Lore', 'Scans the configured message range, processes chunks in parallel, and appends generated story-specific lore into Pending Lore Review as chunks complete.', async (btn) => {
        await handleBulkGeneratePendingLore(btn);
    }, 'saga-primary-button'), 'lore.story.scan');
    if (loreGenerationUiRunning || activeLoreGenerationController) {
        scanBtn.disabled = true;
        scanBtn.textContent = 'Scan Running...';
    }
    actions.appendChild(scanBtn);

    const cancelBtn = createButton('Cancel Scan', 'Cancels the current story-lore scan after active provider requests return or abort.', () => {
        if (activeLoreGenerationController) {
            activeLoreGenerationController.abort();
            setFeatureProgress('lore', 'Cancelling story lore scan...', Math.max(1, Number(getState()?.lorePanel?.loreProgress) || 1));
        }
    }, 'saga-danger-button');
    cancelBtn.disabled = !activeLoreGenerationController;
    actions.appendChild(cancelBtn);
    panel.appendChild(actions);

    appendGenerationStatus(panel, state, 'lore');
    const resultsCard = createBulkLoreLedgerStatusCard(state);
    if (resultsCard) panel.appendChild(resultsCard);

    if (!isBasicExperience()) {
        const settingsSection = createCollapsibleSection(
            'lore.storyGenerationSettings',
            'Story Lore Scan Settings',
            getLoreScanSettingsSummary(getSettings()),
            false,
            createStoryLoreSettingsContent(),
            { tooltip: 'Advanced model-based story-lore scan controls. Most users can leave these defaults unchanged.', className: 'saga-story-lore-settings-collapsible' }
        );
        markTourTarget(settingsSection, 'lore.story.settings');
        panel.appendChild(settingsSection);
    }

    return panel;
}

function getLoreScanSettingsSummary(settings = getSettings()) {
    const mode = settings.loreBulkScanMode || 'recent';
    const label = mode === 'entire' ? 'entire chat' : (mode === 'range' ? 'custom range' : `last ${settings.loreSourceMessageCount || 40}`);
    return `${label} · ${settings.loreBulkChunkSize || 10}/chunk · ${settings.loreBulkConcurrency || 3} parallel`;
}

function createStoryLoreSettingsContent() {
    const settings = getSettings();
    const wrap = document.createElement('div');
    wrap.className = 'saga-story-lore-settings-content';

    const scopeSection = createCollapsibleSection(
        'lore.story.scanScope',
        'Scan Scope',
        getLoreScanScopeSummary(settings),
        true,
        createLoreScanScopeSettingsContent(),
        { tooltip: 'Choose which chat messages are scanned for story lore.', className: 'saga-compact-subsection saga-lore-scan-scope-subsection' }
    );
    markTourTarget(scopeSection, 'lore.story.scope');
    wrap.appendChild(scopeSection);

    const performanceSection = createCollapsibleSection(
        'lore.story.performance',
        'Performance',
        getLoreScanPerformanceSummary(settings),
        false,
        createLoreScanPerformanceSettingsContent(),
        { tooltip: 'Controls throughput, chunk size, overlap, and retry behavior for story-lore scanning.', className: 'saga-compact-subsection' }
    );
    markTourTarget(performanceSection, 'lore.story.performance');
    wrap.appendChild(performanceSection);

    const qualitySection = createCollapsibleSection(
        'lore.story.quality',
        'Generation Quality',
        getLoreScanQualitySummary(settings),
        false,
        createLoreScanQualitySettingsContent(),
        { tooltip: 'Controls breadth, generated fact count, tags, and duplicate filtering.', className: 'saga-compact-subsection' }
    );
    markTourTarget(qualitySection, 'lore.story.quality');
    wrap.appendChild(qualitySection);

    const automationSection = createCollapsibleSection(
        'lore.story.automation',
        'Automation',
        getStoryLoreAutomationSummary(settings),
        false,
        createStoryLoreAutomationSettingsContent(),
        { tooltip: 'Optional automatic story-lore scanning after roleplay turns.', className: 'saga-compact-subsection' }
    );
    markTourTarget(automationSection, 'lore.story.automation');
    wrap.appendChild(automationSection);

    return wrap;
}

function getLoreScanScopeSummary(settings = getSettings()) {
    const mode = settings.loreBulkScanMode || 'recent';
    if (mode === 'entire') return 'entire chat';
    if (mode === 'range') return `${settings.loreBulkRangeStart || 1}-${settings.loreBulkRangeEnd || 'latest'}`;
    return `last ${settings.loreSourceMessageCount || 40}`;
}

function getLoreScanPerformanceSummary(settings = getSettings()) {
    return `${settings.loreBulkChunkSize || 10}/chunk · ${settings.loreBulkConcurrency || 3} simultaneous`;
}

function getLoreScanQualitySummary(settings = getSettings()) {
    return `${settings.loreBulkFactsPerChunk || 14} facts/chunk · ${(settings.loreGenerationBreadthMode || 'auto')}`;
}

function getStoryLoreAutomationSummary(settings = getSettings()) {
    if (settings.loreGenerationMode !== 'automatic') return 'manual';
    const words = Number(settings.loreGenerationAutoWordThreshold || 2500);
    const maxTurns = Number(settings.loreGenerationAutoInterval || 50);
    return `~${words} words or ${maxTurns} turns`;
}

function createStoryLoreAutomationSettingsContent() {
    const content = document.createElement('div');
    content.className = 'saga-story-lore-automation-content';
    appendSettingsResetButton(content, STORY_LORE_AUTOMATION_SETTING_KEYS, 'Story lore automation settings');
    content.appendChild(createAutomationModeCard(
        'Story Lore Scan',
        'loreGenerationMode',
        'loreGenerationAutoInterval',
        'Only scans when you click Scan Story Lore.',
        'Runs automatically after enough new story text accumulates or the maximum turn interval is reached. Generated lore still waits in Pending Lore Review.',
        'Maximum completed model turns between automatic story-lore scans.'
    ));
    content.appendChild(createRangeSettingRow('Minimum turns', 'Automatic story lore waits at least this many completed model turns unless the maximum turn interval is reached.', 'loreGenerationAutoMinTurns', { min: 1, max: 100, fallback: 20 }));
    content.appendChild(createRangeSettingRow('Word threshold', 'Automatic story lore runs after roughly this many new chat words have accumulated, once the minimum turn count has passed. Set to 0 to use turn interval only.', 'loreGenerationAutoWordThreshold', { min: 0, max: 10000, fallback: 2500, suffix: ' words' }));
    const help = document.createElement('div');
    help.className = 'saga-runtime-help saga-compact-help';
    help.textContent = 'Automatic story-lore scans are intentionally conservative because they are expensive and produce review work.';
    content.appendChild(help);
    return content;
}

function createLoreScanScopeSettingsContent() {
    const settings = getSettings();
    const content = document.createElement('div');
    content.className = 'saga-lore-scan-settings-block';
    appendSettingsResetButton(content, STORY_LORE_SCAN_SCOPE_SETTING_KEYS, 'Story lore scan scope settings');

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-lore-scan-compact-grid';
    grid.appendChild(createSelectSettingRow(
        'Scan range',
        'Controls which messages Scan Story Lore processes. Recent uses Lore source messages; Custom uses explicit 1-based message indexes; Entire scans the whole chat.',
        'loreBulkScanMode',
        [
            ['recent', 'Recent messages'],
            ['range', 'Custom range'],
            ['entire', 'Entire chat'],
        ]
    ));
    grid.appendChild(createNumberSettingRow('Start', 'First 1-based message index used when Scan range is Custom range.', 'loreBulkRangeStart', { min: 1, max: 100000, fallback: 1 }));
    grid.appendChild(createNumberSettingRow('End', 'Last 1-based message index used when Scan range is Custom range. Use 0 to mean latest message.', 'loreBulkRangeEnd', { min: 0, max: 100000, fallback: 0 }));
    content.appendChild(grid);

    const sourceRow = document.createElement('label');
    sourceRow.className = 'saga-slider-row saga-compact-slider-row saga-lore-scan-setting-row';
    const sourceText = document.createElement('span');
    sourceText.textContent = `Recent window: ${settings.loreSourceMessageCount || 40}`;
    addTooltip(sourceText, 'How many recent chat messages are scanned when Scan range is Recent messages.');
    const sourceInput = document.createElement('input');
    sourceInput.type = 'range';
    sourceInput.min = '4';
    sourceInput.max = '200';
    sourceInput.step = '1';
    sourceInput.value = String(settings.loreSourceMessageCount || 40);
    sourceInput.addEventListener('input', () => {
        const next = getSettings();
        next.loreSourceMessageCount = Math.max(4, Math.min(200, parseInt(sourceInput.value, 10) || 40));
        saveSettings(next);
        sourceText.textContent = `Recent window: ${next.loreSourceMessageCount}`;
    });
    sourceRow.appendChild(sourceText);
    sourceRow.appendChild(sourceInput);
    content.appendChild(sourceRow);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help saga-compact-help';
    help.textContent = 'Use Custom range for backfilling old story sections. Use Entire chat for first-time setup on an existing story.';
    content.appendChild(help);
    return content;
}

function createLoreScanPerformanceSettingsContent() {
    const content = document.createElement('div');
    content.className = 'saga-lore-scan-settings-block';
    appendSettingsResetButton(content, STORY_LORE_SCAN_PERFORMANCE_SETTING_KEYS, 'Story lore scan performance settings');
    content.appendChild(createRangeSettingRow('Chunk size', 'Messages per scan chunk. Smaller chunks parse more reliably; larger chunks reduce provider calls.', 'loreBulkChunkSize', { min: 3, max: 50, fallback: 10 }));
    content.appendChild(createRangeSettingRow('Overlap', 'Messages repeated at chunk boundaries to preserve facts that span two intervals. Must be lower than chunk size.', 'loreBulkOverlap', { min: 0, max: 10, fallback: 1 }));
    content.appendChild(createRangeSettingRow('Simultaneous chunks', 'Maximum number of story-lore chunks submitted to the Reasoning provider at the same time.', 'loreBulkConcurrency', { min: 1, max: 8, fallback: 3 }));
    content.appendChild(createRangeSettingRow('Retry attempts', 'Chunk-level retry attempts after empty, malformed, or failed extraction responses.', 'loreBulkRetryAttempts', { min: 0, max: 4, fallback: 2 }));
    content.appendChild(createRangeSettingRow('Save checkpoint every chunks', 'How often the scan writes a full compact checkpoint after lightweight per-chunk saves. Lower is safer; higher reduces persistence overhead.', 'loreBulkFullCheckpointEveryChunks', { min: 1, max: 25, fallback: 5 }));
    content.appendChild(createRangeSettingRow('Consolidate every chunks', 'How many completed chunks to collect before converting extracted facts into Pending Lore entries.', 'loreBulkConsolidationChunkWindow', { min: 1, max: 25, fallback: 5 }));

    const help = document.createElement('div');
    help.className = 'saga-runtime-help saga-compact-help';
    help.textContent = 'Each chunk still checkpoints immediately for recovery. Full saves and Pending Lore consolidation happen in batches to reduce large-scan overhead.';
    content.appendChild(help);
    return content;
}

function createLoreScanQualitySettingsContent() {
    const settings = getSettings();
    const content = document.createElement('div');
    content.className = 'saga-lore-scan-settings-block';
    appendSettingsResetButton(content, STORY_LORE_SCAN_QUALITY_SETTING_KEYS, 'Story lore generation quality settings');

    const modeRow = document.createElement('label');
    modeRow.className = 'saga-setting-row saga-lore-scan-setting-row';
    const modeLabel = document.createElement('span');
    modeLabel.textContent = 'Scan breadth';
    addTooltip(modeLabel, 'Auto uses bootstrap mode for manual first-runs when accepted story-specific lore is sparse, then incremental mode for maintenance. Bootstrap targets broad story coverage; incremental targets only new or changed facts.');
    const modeSelect = document.createElement('select');
    modeSelect.className = 'text_pole';
    [
        ['auto', 'Auto'],
        ['bootstrap', 'Bootstrap'],
        ['incremental', 'Incremental'],
    ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if ((settings.loreGenerationBreadthMode || 'auto') === value) option.selected = true;
        modeSelect.appendChild(option);
    });
    modeSelect.addEventListener('change', () => {
        const next = getSettings();
        next.loreGenerationBreadthMode = modeSelect.value;
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true });
    });
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(modeSelect);
    content.appendChild(modeRow);

    content.appendChild(createRangeSettingRow('Facts per chunk', 'Upper target for compact facts extracted per chunk before conversion into Pending Lore entries.', 'loreBulkFactsPerChunk', { min: 4, max: 30, fallback: 14 }));
    content.appendChild(createRangeSettingRow('Bootstrap target', 'Approximate total pending entries targeted during broad first-run story-lore scan.', 'loreBootstrapTargetEntries', { min: 12, max: 120, fallback: 40 }));
    content.appendChild(createRangeSettingRow('Incremental target', 'Approximate total pending entries targeted during incremental story-lore scan.', 'loreIncrementalTargetEntries', { min: 3, max: 30, fallback: 8 }));
    content.appendChild(createRangeSettingRow('Generated tags', 'Number of short searchable tags requested per generated lore entry. Set to 0 to disable generated tags.', 'loreTagCount', { min: 0, max: 10, fallback: 4 }));

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-lore-scan-compact-grid';
    grid.appendChild(createToggleCard(
        'Replacement Guard',
        settings.loreReplacementGuard !== false,
        'When enabled, Saga asks before replacing an unresolved pending lore batch.',
        (checked) => {
            const next = getSettings();
            next.loreReplacementGuard = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    grid.appendChild(createToggleCard(
        'Duplicate Guard',
        settings.loreDuplicateGuard !== false,
        'When enabled, exact duplicate generated entries are filtered and similar entries are routed for update/merge review.',
        (checked) => {
            const next = getSettings();
            next.loreDuplicateGuard = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    grid.appendChild(createToggleCard(
        'Similarity Routing',
        settings.loreSimilarityRouting !== false,
        'When enabled, similar generated lore is kept as a possible update or merge instead of being thrown away as a duplicate.',
        (checked) => {
            const next = getSettings();
            next.loreSimilarityRouting = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    grid.appendChild(createToggleCard(
        'Strict Quality Gate',
        settings.loreStrictQualityGate !== false,
        'When enabled, low-value recap facts are filtered before Pending Lore Review.',
        (checked) => {
            const next = getSettings();
            next.loreStrictQualityGate = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    content.appendChild(grid);

    const rescanRow = createSelectSettingRow(
        'What to rescan',
        'Controls whether Scan Story Lore skips unchanged completed chunks, retries failed chunks, rescans stale edited chunks, or rescans all chunks.',
        'loreBulkRescanMode',
        [
            ['skip_unchanged', 'Skip unchanged'],
            ['retry_failed', 'Retry failed only'],
            ['stale_only', 'Rescan edited only'],
            ['rescan_all', 'Rescan all'],
        ]
    );
    content.appendChild(rescanRow);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help saga-compact-help';
    help.textContent = 'Priority and final review still happen in Pending Lore Review. Generated entries are not accepted automatically.';
    content.appendChild(help);
    return content;
}

function appendGenerationStatus(card, state, kind = 'lore') {
    const statusKey = `${kind}Status`;
    const progressKey = `${kind}Progress`;

    const status = document.createElement('div');
    status.className = 'saga-generation-status-text';
    status.dataset.sagaStatus = kind;
    status.textContent = state?.lorePanel?.[statusKey] || 'Idle.';
    card.appendChild(status);

    const bar = document.createElement('div');
    bar.className = 'saga-progress-bar';
    const fill = document.createElement('div');
    fill.className = 'saga-progress-fill';
    fill.dataset.sagaProgress = kind;
    fill.style.width = `${Math.max(0, Math.min(100, Number(state?.lorePanel?.[progressKey]) || 0))}%`;
    bar.appendChild(fill);
    card.appendChild(bar);
}

async function handleDetectStoryContext(btn, options = {}) {
    if (btn) {
        let result = false;
        await runBusyAction(btn, 'Detecting...', async () => { result = await performStoryContextDetection(options); });
        return result;
    }
    return await performStoryContextDetection(options);
}

async function performStoryContextDetection(options = {}) {
    setFeatureProgress('context', 'Reading chat and detecting context...', 8);
    const detected = await runLoreContextDetection({ progress: (message, percent) => setFeatureProgress('context', message, percent) });
    const after = getState();
    if (options.stayOnTab) setPanelState({ activeTab: options.stayOnTab }, { deferSave: true });
    refreshHeader();
    refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });

    const fields = after?.loreContext || {};
    const filled = ['sceneDate', 'subjectiveDate', 'canonBoundary', 'branchId', 'timeTravelMode']
        .filter(key => String(fields[key] || '').trim()).length;

    if (detected && filled > 0) {
        setFeatureProgress('context', 'Context detected and fields updated.', 100);
        resetFeatureProgress('context');
        toast('Context detected and fields updated.');
        return true;
    }
    if (detected) {
        toast('Context detection completed, but it did not find global date/reference fields to populate.', 'warning');
        return false;
    }
    const validation = validateLoreProviderConfiguration('lore');
    if (!validation.ok) {
        const message = `API/model settings incomplete for Detect Context: ${validation.message}`;
        setFeatureProgress('context', message, 100);
        toast(message, 'error');
        return false;
    }
    toast('Context detection returned no usable result.', 'warning');
    return false;
}

function hasUsableStoryContext(context = {}) {
    return !![
        context.sceneDate,
        context.subjectiveDate,
        context.canonBoundary,
        context.branchId && context.branchId !== 'main' ? context.branchId : '',
    ].map(value => String(value || '').trim()).find(Boolean);
}

function getEnabledLoredeckStackPackIds(state = getState()) {
    const stack = Array.isArray(state?.loredeckStack) ? state.loredeckStack : [];
    if (!stack.length) return [];
    const registry = getLoredeckLibraryRegistry(state);
    const resolved = registry && (Array.isArray(registry.folders) || Array.isArray(registry.deckPlacements))
        ? resolveLoredeckStackItems(stack, registry, { packs: registry.packs || {} })?.stack || []
        : stack;
    const seen = new Set();
    const ids = [];
    for (const item of Array.isArray(resolved) ? resolved : []) {
        const packId = String(item?.packId || item?.deckId || '').trim();
        if (!packId || seen.has(packId) || item?.enabled === false) continue;
        seen.add(packId);
        ids.push(packId);
    }
    return ids;
}

function hasUsableLoredeckContext(context = {}) {
    if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
    if (String(context.branchId || '').trim() && String(context.branchId || '').trim() !== 'main') return true;
    if ([
        context.sceneDate,
        context.subjectiveDate,
        context.stardate,
        context.anchorId,
        context.anchorFrom,
        context.anchorTo,
        context.arc,
        context.phase,
        context.season,
        context.episode,
        context.chapter,
        context.issue,
        context.quest,
        context.gameStage,
        context.alias,
        context.label,
    ].some(value => String(value || '').trim())) return true;
    if (Number.isFinite(Number(context.contextSortKey))) return true;
    if (Number.isFinite(Number(context.contextSortKeyFrom))) return true;
    if (Number.isFinite(Number(context.contextSortKeyTo))) return true;
    return Array.isArray(context.coordinates)
        && context.coordinates.some(item => item && typeof item === 'object' && Object.values(item).some(value => String(value || '').trim()));
}

function getCanonSuggestionContext(state = getState()) {
    const globalContext = state?.loreContext || {};
    if (hasUsableStoryContext(globalContext)) return globalContext;
    const activePackIds = getEnabledLoredeckStackPackIds(state);
    for (const packId of activePackIds) {
        const row = state?.loredeckContexts?.[packId] || getLoredeckContext(state, packId);
        if (!hasUsableLoredeckContext(row)) continue;
        return {
            ...globalContext,
            sceneDate: row.sceneDate || globalContext.sceneDate || '',
            subjectiveDate: row.subjectiveDate || globalContext.subjectiveDate || '',
            canonBoundary: row.alias || row.label || globalContext.canonBoundary || '',
            branchId: row.branchId || globalContext.branchId || 'main',
            timeTravelMode: globalContext.timeTravelMode || 'none',
            stardate: row.stardate || '',
            anchorId: row.anchorId || '',
            anchorFrom: row.anchorFrom || '',
            anchorTo: row.anchorTo || '',
            arc: row.arc || '',
            phase: row.phase || '',
            season: row.season || '',
            episode: row.episode || '',
            chapter: row.chapter || '',
            issue: row.issue || '',
            quest: row.quest || '',
            gameStage: row.gameStage || '',
            coordinates: Array.isArray(row.coordinates) ? row.coordinates : [],
            label: row.label || row.alias || '',
        };
    }
    return globalContext;
}

function hasUsableCanonSuggestionContext(state = getState()) {
    if (hasUsableStoryContext(state?.loreContext || {})) return true;
    return getEnabledLoredeckStackPackIds(state).some(packId => hasUsableLoredeckContext(state?.loredeckContexts?.[packId] || getLoredeckContext(state, packId)));
}

async function ensureStoryContextForCanonAction(actionLabel = 'Canon lore') {
    let state = getState();
    if (!getEnabledLoredeckStackPackIds(state).length) {
        resetCanonPreviewUiState();
        setFeatureProgress('canon', `${actionLabel} cancelled: no active Loredecks.`, 0);
        toast('Load at least one Loredeck before previewing or suggesting canon Lorecards.', 'warning');
        return null;
    }
    if (hasUsableCanonSuggestionContext(state)) {
        return state;
    }

    const proceed = await confirmAction(
        'No Context detected',
        `${actionLabel} needs a usable Context projection, such as a date, arc, chapter, episode, stardate, or canon reference point. Run Detect Context now?`
    );
    if (!proceed) {
        setFeatureProgress('canon', `${actionLabel} cancelled: no Context.`, 0);
        return null;
    }

    setFeatureProgress('canon', 'Detecting Context before querying canon lore...', 5);
    const detected = await performStoryContextDetection({ stayOnTab: 'lore' });
    state = getState();
    if (!detected || !hasUsableCanonSuggestionContext(state)) {
        setFeatureProgress('canon', 'No Context available. Canon lore was not queried.', 100);
        toast('Canon lore needs Context before it can run.', 'warning');
        return null;
    }
    return state;
}

async function handlePreviewCanonLorePacks(btn) {
    await runBusyAction(btn, 'Previewing...', async () => {
        const state = await ensureStoryContextForCanonAction('Canon pack preview');
        if (!state) return;
        const context = getCanonSuggestionContext(state);

        setFeatureProgress('canon', 'Previewing canon packs from local database...', 20);
        const result = await previewCanonLoreForContext(context, { maxCandidates: 500 });
        canonPreviewUiState = {
            contextKey: getCanonPreviewContextKey(context, getState()),
            preview: result,
            selectedPackId: (result?.packs || []).find(pack => pack.newCount > 0)?.id || result?.packs?.[0]?.id || '',
            selectedEntryIds: [],
            detailLevel: getCanonPreviewDetailLevel(),
        };

        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();

        if (result?.status === 'preview') {
            setFeatureProgress('canon', `Previewed ${result.packs?.length || 0} canon packs with ${result.newCount || 0} new entries.`, 100);
            resetFeatureProgress('canon');
            toast(`Previewed ${result.packs?.length || 0} canon packs. Select entries to add to Pending Lore Review.`, 'info');
        } else if (result?.status === 'no_date') {
            setFeatureProgress('canon', 'No parseable Context date. Detect or enter a scene date first.', 100);
            toast('Canon pack preview needs a parseable Scene date first.', 'warning');
        } else if (result?.status === 'no_context') {
            setFeatureProgress('canon', 'No Context available. Canon packs were not previewed.', 100);
            toast('Canon pack preview needs Context from the Context tab or Detect Context first.', 'warning');
        } else if (result?.status === 'disabled') {
            setFeatureProgress('canon', 'Canon database is disabled.', 100);
            toast('Canon database is disabled.', 'warning');
        } else {
            setFeatureProgress('canon', 'No matching canon packs for this context.', 100);
            resetFeatureProgress('canon');
            toast('Canon database found no matching entries for this context.', 'info');
        }
    });
}

async function handleAddCanonPreviewEntries(btn, entryIds = []) {
    const ids = Array.from(new Set((entryIds || []).map(id => String(id || '')).filter(Boolean)));
    if (!ids.length) {
        toast('Select at least one new canon preview entry first.', 'warning');
        return;
    }

    await runBusyAction(btn, 'Adding...', async () => {
        const state = await ensureStoryContextForCanonAction('Adding canon preview entries');
        if (!state) return;
        const context = getCanonSuggestionContext(state);

        setFeatureProgress('canon', 'Adding selected canon entries to Pending Lore Review...', 35);
        const result = await addCanonLorePreviewEntriesToPending(ids, context, { maxCandidates: 500 });
        if (result?.status === 'proposed') {
            canonPreviewUiState = {
                contextKey: '',
                preview: null,
                selectedPackId: '',
                selectedEntryIds: [],
                detailLevel: getCanonPreviewDetailLevel(),
            };
            openPendingLoreReviewSections();
            setPanelState({ activeTab: 'lore' }, { deferSave: true });
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            refreshHeader();
            setFeatureProgress('canon', `Added ${result.proposedCount || 0} canon entries to Pending Lore Review.`, 100);
            resetFeatureProgress('canon');
            toast(`Added ${result.proposedCount || 0} canon entries to Pending Lore Review.`);
        } else if (result?.status === 'duplicates_only') {
            setFeatureProgress('canon', 'Selected canon entries were already pending or accepted.', 100);
            resetFeatureProgress('canon');
            refreshHeader();
            toast('Selected canon entries were already pending or accepted.', 'info');
        } else if (result?.status === 'disabled') {
            setFeatureProgress('canon', 'Canon database is disabled.', 100);
            toast('Canon database is disabled.', 'warning');
        } else if (result?.status === 'no_date') {
            setFeatureProgress('canon', 'No parseable Context date. Canon entries were not added.', 100);
            toast('Canon entries need a parseable Scene date first.', 'warning');
        } else if (result?.status === 'no_context') {
            setFeatureProgress('canon', 'No Context available. Canon entries were not added.', 100);
            toast('Canon entries need Context from the Context tab or Detect Context first.', 'warning');
        } else {
            setFeatureProgress('canon', 'No selected canon entries were added.', 100);
            resetFeatureProgress('canon');
            toast('No selected canon entries were added.', 'info');
        }
    });
}

async function handleSuggestCanonLore(btn) {
    await runBusyAction(btn, 'Suggesting...', async () => {
        const state = await ensureStoryContextForCanonAction('Canon lore suggestions');
        if (!state) return;
        const context = getCanonSuggestionContext(state);

        setFeatureProgress('canon', 'Suggesting canon lore from local database...', 20);
        const result = await proposeCanonLoreForContext(context, {
            maxEntries: getSettings().canonLoreMaxEntries || 10,
            progress: (message, percent) => setFeatureProgress('canon', message, percent),
        });

        if (result?.status === 'proposed') {
            openPendingLoreReviewSections();
            setPanelState({ activeTab: 'lore' }, { deferSave: true });
            refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
            refreshHeader();
            setFeatureProgress('canon', `Suggested ${result.proposedCount || 0} canon lore entries.`, 100);
            resetFeatureProgress('canon');
            toast(`Suggested ${result.proposedCount || 0} canon lore entries. Review them in Pending Lore Review.`);
        } else if (result?.status === 'duplicates_only') {
            setFeatureProgress('canon', `Matched ${result.matchedCount || 0}, but all selected suggestions already exist.`, 100);
            resetFeatureProgress('canon');
            refreshHeader();
            toast('Canon database matches were already present by id/title.', 'info');
        } else if (result?.status === 'no_date') {
            setFeatureProgress('canon', 'No parseable Context date. Detect or enter a scene date first.', 100);
            toast('Canon suggestions need a parseable Scene date first.', 'warning');
        } else if (result?.status === 'no_context') {
            setFeatureProgress('canon', 'No Context available. Canon suggestions were not run.', 100);
            toast('Canon suggestions need Context from the Context tab or Detect Context first.', 'warning');
        } else if (result?.status === 'disabled') {
            setFeatureProgress('canon', 'Canon database is disabled.', 100);
            toast('Canon database is disabled.', 'warning');
        } else {
            setFeatureProgress('canon', 'No matching canon suggestions for this context.', 100);
            resetFeatureProgress('canon');
            toast('Canon database found no matching entries for this context.', 'info');
        }
    });
}


function createBulkLoreLedgerStatusCard(state) {
    const ledger = state?.loreBulkGeneration || {};
    const batchId = ledger.activeBatchId || ledger.lastBatchId || '';
    const batch = batchId ? ledger.batches?.[batchId] : null;
    if (!batch) return null;

    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-bulk-lore-status-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Lore Scan Results';
    addTooltip(title, 'Shows the latest story-lore scan result, including completed chunks, failed chunks, extracted candidate facts, and Pending Lore Review entries.');
    card.appendChild(title);

    const status = String(batch.status || 'unknown');
    const queued = batch.queuedChunks || batch.totalChunks || 0;
    const completed = batch.completedChunks || 0;
    const failed = batch.failedChunks || 0;
    const candidateCount = batch.candidateCount || 0;
    const pendingCount = batch.pendingEntryCount || (state?.pendingLoreEntries || []).length || 0;
    const qualityDropped = batch.droppedQualityCount || state?.pendingLoreMeta?.droppedQualityCount || 0;
    const routedSimilar = batch.routedSimilarCount || state?.pendingLoreMeta?.routedSimilarCount || 0;

    const summary = document.createElement('div');
    summary.className = 'saga-runtime-help saga-lore-scan-results-summary';
    summary.textContent = `${status} · ${completed}/${queued} chunks · ${candidateCount} facts · ${pendingCount} pending${failed ? ` · ${failed} failed` : ''}`;
    card.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-lore-scan-results-grid';
    grid.appendChild(createKeyValue('Range', `${batch.rangeStart || '?'}-${batch.rangeEnd || '?'}`, 'Message index range scanned.'));
    grid.appendChild(createKeyValue('Chunks', `${completed}/${queued}`, 'Completed queued chunks over total queued chunks.'));
    grid.appendChild(createKeyValue('Failed', String(failed), 'Chunks that failed after retry attempts and can be retried with What to rescan: Retry failed only.'));
    grid.appendChild(createKeyValue('Facts', String(candidateCount), 'Compact extracted candidate facts stored for this scan.'));
    grid.appendChild(createKeyValue('Pending', String(pendingCount), 'Pending Lore Review entries after scan commits.'));
    if (qualityDropped) grid.appendChild(createKeyValue('Quality filtered', String(qualityDropped), 'Generated candidates discarded by the strict quality gate as low-value recap or insufficiently specific lore.'));
    if (routedSimilar) grid.appendChild(createKeyValue('Routed updates', String(routedSimilar), 'Similar generated candidates kept as possible updates or merges instead of discarded as duplicates.'));
    card.appendChild(grid);
    return card;
}

async function handleBulkGeneratePendingLore(btn) {
    if (loreGenerationUiRunning || activeLoreGenerationController) {
        toast('Lore generation is already running. Use Cancel Scan to stop it.', 'warning');
        return;
    }
    if (!ensureLoreProviderReadyForAction('Scan Story Lore', 'lore')) return;
    activeLoreGenerationController = new AbortController();
    loreGenerationUiRunning = true;
    refreshPanelBody({ preserveScroll: true });
    await runBusyAction(btn, 'Scanning...', async () => {
        setFeatureProgress('lore', 'Starting story lore scan...', 5);
        let result = await runBulkLoreGeneration({
            force: true,
            signal: activeLoreGenerationController?.signal,
            progress: (message, percent) => setFeatureProgress('lore', message, percent),
        });
        if (result?.status === 'pending_lore_exists') {
            const pendingCount = result.pendingCount || 0;
            const sameContext = result.sameContext !== false;
            const proceed = await confirmAction(
                'Pending lore already exists',
                sameContext
                    ? `There are ${pendingCount} unresolved pending lore entr${pendingCount === 1 ? 'y' : 'ies'} for this context. Continue and append/merge new scan results into Pending Lore Review?`
                    : `There are ${pendingCount} unresolved pending lore entr${pendingCount === 1 ? 'y' : 'ies'} from another context. Continue by marking the old batch replaced and starting a fresh scan?`
            );
            if (!proceed) {
                setFeatureProgress('lore', 'Story lore scan cancelled: pending lore still needs review.', 0);
                toast('Review or dismiss existing pending lore before scanning again.', 'info');
                return;
            }
            setFeatureProgress('lore', sameContext ? 'Continuing scan and appending to pending lore...' : 'Replacing stale pending lore and starting scan...', 5);
            result = await runBulkLoreGeneration({
                force: true,
                signal: activeLoreGenerationController?.signal,
                progress: (message, percent) => setFeatureProgress('lore', message, percent),
                allowPendingAppend: sameContext,
                replacePending: !sameContext,
            });
        }
        refreshHeader();

        if (result?.status === 'cancelled') {
            refreshPanelBody({ preserveScroll: true });
            setFeatureProgress('lore', 'Story lore scan cancelled.', 0);
            toast('Story lore scan cancelled.', 'warning');
        } else if (['complete', 'partial'].includes(result?.status)) {
            openPendingLoreReviewSections();
            setPanelState({ activeTab: 'lore' });
            refreshPanelBody({ preserveScroll: false });
            const failedText = result.failedChunkCount ? ` ${result.failedChunkCount} chunk${result.failedChunkCount === 1 ? '' : 's'} failed and can be retried.` : '';
            const skippedText = result.skippedChunks ? ` ${result.skippedChunks} unchanged chunk${result.skippedChunks === 1 ? '' : 's'} skipped.` : '';
            const qualityText = result.droppedQualityCount ? ` ${result.droppedQualityCount} low-value candidate${result.droppedQualityCount === 1 ? '' : 's'} filtered.` : '';
            const routedText = result.routedSimilarCount ? ` ${result.routedSimilarCount} similar candidate${result.routedSimilarCount === 1 ? '' : 's'} routed for update review.` : '';
            setFeatureProgress('lore', `Story lore scan ${result.status}: ${result.completedChunkCount || 0} chunks, ${result.candidateCount || 0} candidate facts, ${result.pendingEntryCount || 0} pending entries.`, 100);
            resetFeatureProgress('lore');
            toast(`Story lore scan ${result.status}. ${result.candidateCount || 0} candidate facts extracted; ${result.pendingEntryCount || 0} pending lore entries now available.${failedText}${skippedText}${qualityText}${routedText}`);
        } else if (result?.status === 'skipped_unchanged') {
            refreshPanelBody({ preserveScroll: true });
            setFeatureProgress('lore', `Story lore scan skipped ${result.skippedChunks || 0} unchanged chunks.`, 100);
            resetFeatureProgress('lore');
            toast('Story lore scan found no changed chunks to process.', 'info');
        } else {
            refreshPanelBody({ preserveScroll: true });
            const details = formatGenerationStatus(result);
            toast(details, 'warning');
        }
    });
    activeLoreGenerationController = null;
    loreGenerationUiRunning = false;
    refreshPanelBody({ preserveScroll: true });
}

function createCanonLoreDatabaseCard(state) {
    const settings = getSettings();
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-canon-db-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Local Canon Lore Database';
    addTooltip(title, 'After Context detection finds a parseable canon date, Saga locally queries active Loredecks and proposes relevant canon entries into Pending Lore Review. This does not call the model.');
    card.appendChild(title);

    const db = state?.canonLoreDatabase || {};
    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Canon database entries are proposed for review, not automatically accepted. Saga queries the active Loredeck stack and its bundled or custom Lorecard files.';
    card.appendChild(help);

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid';
    grid.appendChild(createToggleCard(
        'Use Local Canon Database',
        settings.canonLoreDatabaseEnabled !== false,
        'Allows manual previews, quick queries, and optional auto-suggest to query local pre-generated canon lore files.',
        (checked) => {
            const next = getSettings();
            next.canonLoreDatabaseEnabled = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    grid.appendChild(createToggleCard(
        'Auto-suggest After Detection',
        settings.canonLoreAutoPropose !== false,
        'When enabled, a Context detection run also performs the quick top-match canon proposal. It does not affect manual pack previews.',
        (checked) => {
            const next = getSettings();
            next.canonLoreAutoPropose = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        }
    ));
    card.appendChild(grid);

    const maxRow = document.createElement('label');
    maxRow.className = 'saga-slider-row saga-compact-slider-row';
    const maxText = document.createElement('span');
    maxText.textContent = `Quick/auto add cap: ${settings.canonLoreMaxEntries || 12}`;
    addTooltip(maxText, 'Maximum entries used only by quick query and auto-suggest after Context detection. Pack preview counts are not capped by this slider.');
    const maxInput = document.createElement('input');
    maxInput.type = 'range';
    maxInput.min = '1';
    maxInput.max = '200';
    maxInput.step = '1';
    maxInput.value = String(settings.canonLoreMaxEntries || 12);
    maxInput.addEventListener('input', () => {
        const next = getSettings();
        next.canonLoreMaxEntries = Math.max(1, Math.min(200, parseInt(maxInput.value, 10) || 12));
        saveSettings(next);
        maxText.textContent = `Quick/auto add cap: ${next.canonLoreMaxEntries}`;
    });
    maxRow.appendChild(maxText);
    maxRow.appendChild(maxInput);
    card.appendChild(maxRow);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Quick Add Top Matches', 'Uses the current Context fields to query local canon lore and propose the capped top matches into Pending Lore Review.', async (btn) => {
        await runBusyAction(btn, 'Querying...', async () => {
            const state = await ensureStoryContextForCanonAction('Canon database quick add');
            if (!state) return;
            const context = getCanonSuggestionContext(state);
            setFeatureProgress('context', 'Querying local canon lore database...', 80);
            const result = await proposeCanonLoreForContext(context, {
                maxEntries: getSettings().canonLoreMaxEntries || 12,
                progress: (message, percent) => setFeatureProgress('context', message, percent),
            });
            if (result?.status === 'proposed') {
                refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
                refreshHeader();
                setFeatureProgress('context', `Canon database proposed ${result.proposedCount || 0} pending lore entries.`, 100);
                resetFeatureProgress('context');
                toast(`Canon database proposed ${result.proposedCount || 0} pending lore entries.`);
            } else if (result?.status === 'duplicates_only') {
                // Do not refresh the whole panel for a no-op duplicate result. In chats that
                // already contain oversized pending canon entries, a full refresh can freeze.
                setFeatureProgress('context', `Canon database matched ${result.matchedCount || 0}, but selected proposals were already present by id/title.`, 100);
                resetFeatureProgress('context');
                refreshHeader();
                toast('Canon database matches were already present by id/title.', 'info');
            } else if (result?.status === 'no_date') {
                toast('Canon database needs a parseable Scene date first.', 'warning');
            } else if (result?.status === 'no_context') {
                toast('Canon database needs Context from the Context tab or Detect Context first.', 'warning');
            } else if (result?.status === 'disabled') {
                toast('Canon database is disabled.', 'warning');
            } else {
                toast('Canon database found no matching entries for this context.', 'info');
            }
        });
    }, 'saga-primary-button'));
    card.appendChild(actions);

    card.appendChild(createKeyValue('Last query', db.lastQueriedAt ? new Date(db.lastQueriedAt).toLocaleString() : 'never', 'When the local canon database was last queried.'));
    card.appendChild(createKeyValue('Last result', db.lastStatus || 'Not queried.', 'Summary of the last local canon lore query.'));
    return card;
}

function createContextEditorCard(state) {
    const card = document.createElement('div');
    card.className = 'saga-context-advanced-brief-content';
    markTourTarget(card, 'context.editor');

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Global Brief Projection';
    addTooltip(title, 'Legacy date/canon reference projection used by older local canon-preview flows. Per-Loredeck Context rows above remain authoritative for Loredeck gates.');
    card.appendChild(title);

    const brief = state?.contextBrief || {};
    const diagnostics = document.createElement('div');
    diagnostics.className = 'saga-context-brief-diagnostics';
    diagnostics.appendChild(createKeyValue('Brief summary', brief.summary || 'not detected', 'Latest detector Context Brief summary.'));
    diagnostics.appendChild(createKeyValue('Evidence', String((brief.evidence || []).length), 'Evidence snippets captured by the detector.'));
    diagnostics.appendChild(createKeyValue('Uncertainty', brief.uncertainty?.level || 'low', 'Detector uncertainty level.'));
    diagnostics.appendChild(createKeyValue('Signals', getContextBriefSignalSummary(brief), 'Structured story-position signals saved in the latest Context Brief.'));
    card.appendChild(diagnostics);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Use these fields only when legacy canon preview or story-lore tools need a simple global date/reference point. For arcs, chapters, episodes, quests, stardates, and windows, use the loaded Loredeck Context rows and Browser above.';
    card.appendChild(help);

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-context-grid';
    markTourTarget(grid, 'context.fields');
    grid.appendChild(createTextSettingField('Scene date', state?.loreContext?.sceneDate || '', 'Example: September 1, 1996. Used for date-sensitive lore.', (value) => updateLoreContextField('sceneDate', value)));
    grid.appendChild(createTextSettingField('Canon reference point', state?.loreContext?.canonBoundary || '', 'Example: Through Chapter 14 of Half-Blood Prince. Used to avoid using future canon prematurely.', (value) => updateLoreContextField('canonBoundary', value)));
    grid.appendChild(createTextSettingField('Branch', state?.loreContext?.branchId || 'main', 'Use “main” for the primary timeline, or a custom branch name for story/time-travel branches.', (value) => updateLoreContextField('branchId', value || 'main')));
    card.appendChild(grid);

    card.appendChild(createKeyValue('Last detected', state?.loreContext?.lastDetectedAt ? new Date(state.loreContext.lastDetectedAt).toLocaleString() : 'never', 'When Context was last detected automatically. Manual edits also affect generation immediately.'));
    return card;
}


function createSelectSettingRow(labelText, tooltip, settingKey, options, onChange = null) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-setting-row';
    const label = document.createElement('span');
    label.textContent = labelText;
    addTooltip(label, tooltip);
    const select = document.createElement('select');
    select.className = 'text_pole';
    for (const [value, text] of options) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (String(settings[settingKey]) === String(value)) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('change', () => {
        const next = getSettings();
        next[settingKey] = select.value;
        saveSettings(next);
        if (typeof onChange === 'function') onChange(select.value);
        refreshPanelBody({ preserveScroll: true });
    });
    row.appendChild(label);
    row.appendChild(select);
    return row;
}

function createNumberSettingRow(labelText, tooltip, settingKey, { min = 0, max = 9999, fallback = 0 } = {}) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-setting-row';
    const label = document.createElement('span');
    label.textContent = labelText;
    addTooltip(label, tooltip);
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'text_pole';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(settings[settingKey] ?? fallback);
    input.addEventListener('change', () => {
        const next = getSettings();
        const parsed = parseInt(input.value, 10);
        next[settingKey] = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
        input.value = String(next[settingKey]);
        saveSettings(next);
    });
    row.appendChild(label);
    row.appendChild(input);
    return row;
}

function createRangeSettingRow(labelPrefix, tooltip, settingKey, { min = 0, max = 100, fallback = 0, suffix = '', step = 1 } = {}) {
    const settings = getSettings();
    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    const text = document.createElement('span');
    const rawValue = settings[settingKey] ?? fallback;
    const numericValue = Number.isFinite(Number(rawValue)) ? Number(rawValue) : fallback;
    const currentValue = Math.max(min, Math.min(max, numericValue));
    text.textContent = `${labelPrefix}: ${currentValue}${suffix}`;
    addTooltip(text, tooltip);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(currentValue);
    input.addEventListener('input', () => {
        const next = getSettings();
        {
            const parsed = parseInt(input.value, 10);
            next[settingKey] = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
        }
        saveSettings(next);
        text.textContent = `${labelPrefix}: ${next[settingKey]}${suffix}`;
    });
    row.appendChild(text);
    row.appendChild(input);
    return row;
}

function createAutomationModeCard(titleText, modeKey, intervalKey, manualTooltip, automaticTooltip, intervalTooltip) {
    const settings = getSettings();
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-automation-mode-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = titleText;
    addTooltip(title, `${titleText} can run manually from its button or automatically every configured number of turns.`);
    card.appendChild(title);

    const buttons = document.createElement('div');
    buttons.className = 'saga-mode-buttons';
    for (const [mode, label, tip] of [
        ['manual', 'Manual', manualTooltip],
        ['automatic', 'Automatic', automaticTooltip],
    ]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'saga-mode-button';
        if ((settings[modeKey] || 'manual') === mode) btn.classList.add('saga-mode-button-active');
        btn.textContent = label;
        addTooltip(btn, tip);
        btn.addEventListener('click', () => {
            const next = getSettings();
            next[modeKey] = mode;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
        });
        buttons.appendChild(btn);
    }
    card.appendChild(buttons);

    const row = document.createElement('label');
    row.className = 'saga-slider-row saga-compact-slider-row';
    const label = document.createElement('span');
    label.textContent = `Every ${settings[intervalKey] || 5} turns`;
    addTooltip(label, intervalTooltip);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '1';
    input.max = '100';
    input.step = '1';
    input.value = String(settings[intervalKey] || 5);
    input.addEventListener('input', () => {
        const next = getSettings();
        next[intervalKey] = Math.max(1, Math.min(100, parseInt(input.value, 10) || 5));
        saveSettings(next);
        label.textContent = `Every ${next[intervalKey]} turns`;
    });
    row.appendChild(label);
    row.appendChild(input);
    card.appendChild(row);

    return card;
}

function setFeatureProgress(kind = 'lore', message, percent = 0) {
    const statusKind = ['context', 'continuity', 'lore', 'canon'].includes(kind) ? kind : 'lore';
    const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
    const state = getState();
    if (state?.lorePanel) {
        state.lorePanel[`${statusKind}Status`] = message;
        state.lorePanel[`${statusKind}Progress`] = safePercent;
        if (statusKind === 'lore') {
            state.lorePanel.generationStatus = message;
            state.lorePanel.generationProgress = safePercent;
        }
        saveState(state);
    }

    if (!panelRoot) return;
    const text = panelRoot.querySelector(`[data-saga-status="${statusKind}"]`);
    const fill = panelRoot.querySelector(`[data-saga-progress="${statusKind}"]`);
    if (text) text.textContent = message;
    if (fill) fill.style.width = `${safePercent}%`;
}

const progressResetTimers = new Map();

function resetFeatureProgress(kind = 'lore', delayMs = 1400) {
    const statusKind = ['context', 'continuity', 'lore', 'canon'].includes(kind) ? kind : 'lore';
    const existing = progressResetTimers.get(statusKind);
    if (existing) window.clearTimeout(existing);
    const timer = window.setTimeout(() => {
        progressResetTimers.delete(statusKind);
        resetFeatureProgressNow(statusKind);
    }, Math.max(0, Number(delayMs) || 0));
    progressResetTimers.set(statusKind, timer);
}

function resetFeatureProgressNow(kind = 'lore') {
    const statusKind = ['context', 'continuity', 'lore', 'canon'].includes(kind) ? kind : 'lore';
    const existing = progressResetTimers.get(statusKind);
    if (existing) {
        window.clearTimeout(existing);
        progressResetTimers.delete(statusKind);
    }
    const state = getState();
    if (state?.lorePanel) {
        state.lorePanel[`${statusKind}Status`] = 'Idle.';
        state.lorePanel[`${statusKind}Progress`] = 0;
        if (statusKind === 'lore') {
            state.lorePanel.generationStatus = 'Idle.';
            state.lorePanel.generationProgress = 0;
        }
        saveState(state);
    }
    if (!panelRoot) return;
    const text = panelRoot.querySelector(`[data-saga-status="${statusKind}"]`);
    const fill = panelRoot.querySelector(`[data-saga-progress="${statusKind}"]`);
    if (text) text.textContent = 'Idle.';
    if (fill) fill.style.width = '0%';
}

function resetAllFeatureProgressNow() {
    ['context', 'continuity', 'lore', 'canon'].forEach(kind => resetFeatureProgressNow(kind));
}

function updateLoreContextField(key, value) {
    setLoreContext({ [key]: value, lastDetectedAt: Date.now() });
    refreshHeader();
}

function createTextSettingField(label, value, tooltip, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'saga-inline-field saga-context-field';
    addTooltip(wrap, tooltip);

    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.addEventListener('change', () => onChange?.(input.value.trim()));
    wrap.appendChild(input);
    return wrap;
}

function formatGenerationStatus(result) {
    if (!result) return 'Story lore scan ended without a result.';
    const modeText = result.generationMode ? `${result.generationMode} mode` : 'story-lore scan';
    const targetText = result.targetEntryCount ? ` Target: ${result.targetEntryCount}.` : '';
    if (result.status === 'empty_valid_entries') {
        if (result.droppedDuplicateCount) {
            return `Scan in ${modeText} produced ${result.normalizedEntryCount || result.rawEntryCount || 0} normalized entries, but all were duplicate/similar (${result.droppedDuplicateCount} filtered). Try disabling Duplicate Guard or broadening Source Messages.`;
        }
        return `Scan in ${modeText} returned ${result.rawEntryCount || 0} raw entries, but none matched the Saga lore schema after normalization.${targetText}`;
    }
    if (result.status === 'failed_parse') return 'Story lore scan returned malformed JSON that could not be repaired.';
    if (result.status === 'failed_no_response') return result.chunkCount ? `Story lore scan in ${modeText} returned no usable responses across ${result.chunkCount} chunk(s). Check provider connection, model output format, max tokens, or reduce chunk size.${targetText}` : 'Story lore scan returned an empty response from the selected model/provider.';
    if (result.status === 'api_not_configured') return `API/model settings incomplete: ${result.error || 'missing provider settings'}`;
    if (result.status === 'no_context_detected') return 'No context could be detected. Set Context manually or increase the scan range.';
    return `Story lore scan ended with status: ${result.status || 'unknown'}`;
}



// Continuity tab --------------------------------------------------------------

const CONTINUITY_SECTION_LABELS = {
    canon: 'Timeline / Date',
    scene: 'Scene',
    characters: 'Active Characters',
    inventory: 'Key Items',
    objectives: 'Active Goals',
    threads: 'Active Threads',
};

const CHARACTER_CONTINUITY_FIELD_LABELS = {
    appearance: 'Appearance Detail',
    emotionalState: 'Emotional State',
};


function getContinuityScanScopeSummary(settings = getSettings()) {
    const mode = settings.continuityScanMode || 'recent';
    if (mode === 'entire') return 'entire chat';
    if (mode === 'range') return `${settings.continuityScanRangeStart || 1}-${settings.continuityScanRangeEnd || 'latest'}`;
    return `last ${settings.continuitySourceMessageCount || 10}`;
}

function getContinuityScanPerformanceSummary(settings = getSettings()) {
    const strategy = settings.continuityScanStrategy || 'adaptive';
    const fast = settings.continuityScanFastThreshold || 4;
    const hybrid = settings.continuityScanHybridThreshold || 80;
    return `${strategy} · fast ≤${fast} · hybrid ≤${hybrid}`;
}

function getContinuityScanResultsSummary(state = getState()) {
    const ledger = state?.continuityScan || {};
    const batch = ledger.lastBatchId ? ledger.batches?.[ledger.lastBatchId] : null;
    if (!batch) return 'no scan results yet';
    const status = batch.status || 'unknown';
    const completed = Number(batch.completedChunks || 0);
    const failed = Number(batch.failedChunks || 0);
    const observations = Number(batch.observationCount || 0);
    return `${status} · ${completed} complete · ${failed} failed · ${observations} observations`;
}

function createContinuityScanScopeSettingsContent() {
    const settings = getSettings();
    const content = document.createElement('div');
    content.className = 'saga-lore-scan-settings-block';
    appendSettingsResetButton(content, CONTINUITY_SCAN_SCOPE_SETTING_KEYS, 'Continuity scan scope settings');

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-lore-scan-compact-grid';
    grid.appendChild(createSelectSettingRow(
        'Scan range',
        'Controls which messages Scan Continuity State processes. Recent is safest for routine use; Custom and Entire are for backfilling or repair scans.',
        'continuityScanMode',
        [
            ['recent', 'Recent messages'],
            ['range', 'Custom range'],
            ['entire', 'Entire chat'],
        ]
    ));
    grid.appendChild(createNumberSettingRow('Start', 'First 1-based message index used when Scan range is Custom range.', 'continuityScanRangeStart', { min: 1, max: 100000, fallback: 1 }));
    grid.appendChild(createNumberSettingRow('End', 'Last 1-based message index used when Scan range is Custom range. Use 0 to mean latest message.', 'continuityScanRangeEnd', { min: 0, max: 100000, fallback: 0 }));
    content.appendChild(grid);

    const sourceRow = document.createElement('label');
    sourceRow.className = 'saga-slider-row saga-compact-slider-row saga-lore-scan-setting-row';
    const sourceText = document.createElement('span');
    sourceText.textContent = `Recent window: ${settings.continuitySourceMessageCount || 10}`;
    addTooltip(sourceText, 'How many recent chat messages are scanned when Scan range is Recent messages.');
    const sourceInput = document.createElement('input');
    sourceInput.type = 'range';
    sourceInput.min = '1';
    sourceInput.max = '200';
    sourceInput.step = '1';
    sourceInput.value = String(settings.continuitySourceMessageCount || 10);
    sourceInput.addEventListener('input', () => {
        const next = getSettings();
        next.continuitySourceMessageCount = Math.max(1, Math.min(200, parseInt(sourceInput.value, 10) || 10));
        saveSettings(next);
        sourceText.textContent = `Recent window: ${next.continuitySourceMessageCount}`;
    });
    sourceRow.appendChild(sourceText);
    sourceRow.appendChild(sourceInput);
    content.appendChild(sourceRow);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help saga-compact-help';
    help.textContent = 'Adaptive continuity scans use a single compact delta call only for very small windows, parallel grouped calls for routine recent scans, and checkpointed chunks for large backfills.';
    content.appendChild(help);
    return content;
}

function createContinuityScanPerformanceSettingsContent() {
    const content = document.createElement('div');
    content.className = 'saga-lore-scan-settings-block';
    appendSettingsResetButton(content, CONTINUITY_SCAN_PERFORMANCE_SETTING_KEYS, 'Continuity performance and recovery settings');
    content.appendChild(createSelectSettingRow(
        'Scan strategy',
        'Adaptive uses one fast delta call only for very small scans, grouped hybrid calls for routine recent ranges, and the checkpointed bulk pipeline for large backfills.',
        'continuityScanStrategy',
        [
            ['adaptive', 'Adaptive'],
            ['fast', 'Always fast'],
            ['hybrid', 'Always hybrid'],
            ['bulk', 'Always bulk/checkpointed'],
        ]
    ));
    content.appendChild(createRangeSettingRow('Fast threshold', 'Adaptive scans at or below this message count use the single-call fast continuity delta path. Keep this low if your provider is slow on large JSON calls.', 'continuityScanFastThreshold', { min: 1, max: 200, fallback: 4 }));
    content.appendChild(createRangeSettingRow('Hybrid threshold', 'Adaptive scans above the fast threshold and at or below this count use grouped hybrid delta calls. Larger scans use the checkpointed bulk path.', 'continuityScanHybridThreshold', { min: 20, max: 500, fallback: 80 }));
    content.appendChild(createRangeSettingRow('Fast max tokens', 'Maximum output tokens for the fast single-call continuity scan.', 'continuityFastMaxTokens', { min: 512, max: 8192, fallback: 2048 }));
    content.appendChild(createRangeSettingRow('Hybrid max tokens', 'Maximum output tokens for each grouped hybrid continuity scan call.', 'continuityHybridMaxTokens', { min: 512, max: 8192, fallback: 3072 }));
    content.appendChild(createRangeSettingRow('Chunk size', 'Messages per continuity observation chunk. Used by the bulk/checkpointed path for large ranges.', 'continuityScanChunkSize', { min: 2, max: 40, fallback: 8 }));
    content.appendChild(createRangeSettingRow('Overlap', 'Messages repeated at chunk boundaries to preserve continuity facts that span intervals.', 'continuityScanOverlap', { min: 0, max: 10, fallback: 1 }));
    content.appendChild(createRangeSettingRow('Simultaneous chunks', 'Maximum continuity observation chunks sent to the Utility provider at the same time.', 'continuityScanConcurrency', { min: 1, max: 8, fallback: 3 }));
    content.appendChild(createRangeSettingRow('Simultaneous reducers', 'Maximum section reducers sent to the Utility provider at the same time after observations are extracted.', 'continuityScanReducerConcurrency', { min: 1, max: 6, fallback: 3 }));
    content.appendChild(createRangeSettingRow('Retry attempts', 'Chunk-level retry attempts after empty, malformed, or failed observation responses.', 'continuityScanRetryAttempts', { min: 0, max: 4, fallback: 2 }));
    content.appendChild(createRangeSettingRow('Observations per chunk', 'Upper target for compact continuity observations extracted from each chunk in the bulk/checkpointed path.', 'continuityScanObservationsPerChunk', { min: 3, max: 30, fallback: 12 }));
    content.appendChild(createRangeSettingRow('Observation max tokens', 'Maximum output tokens for each bulk observation extraction call.', 'continuityObservationMaxTokens', { min: 512, max: 8192, fallback: 1536 }));
    content.appendChild(createRangeSettingRow('Reducer max tokens', 'Maximum output tokens for each bulk section reducer call.', 'continuityReducerMaxTokens', { min: 512, max: 8192, fallback: 1536 }));
    content.appendChild(createRangeSettingRow('Save checkpoint every chunks', 'How often the scan writes a full compact checkpoint after lightweight per-chunk observation saves.', 'continuityScanFullCheckpointEveryChunks', { min: 1, max: 25, fallback: 5 }));

    const rescanRow = createSelectSettingRow(
        'What to rescan',
        'Controls whether Scan Continuity State skips unchanged completed chunks, retries failed chunks, rescans edited chunks, or rescans all chunks.',
        'continuityScanRescanMode',
        [
            ['skip_unchanged', 'Skip unchanged'],
            ['retry_failed', 'Retry failed only'],
            ['stale_only', 'Rescan edited only'],
            ['rescan_all', 'Rescan all'],
        ]
    );
    content.appendChild(rescanRow);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help saga-compact-help';
    help.textContent = 'Adaptive mode avoids the heavy bulk pipeline for small scans. Chunk checkpoints are still used for large backfills, with prompt injection sync deferred until the final delta is applied or stored for review.';
    content.appendChild(help);
    return content;
}

function createContinuityScanResultsCard(state) {
    const ledger = state?.continuityScan || {};
    const batch = ledger.lastBatchId ? ledger.batches?.[ledger.lastBatchId] : null;
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-generation-results-card';

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Continuity Scan Results';
    addTooltip(title, 'Recoverable results from the latest checkpointed continuity scan.');
    card.appendChild(title);

    if (!batch) {
        card.appendChild(createEmptyMessage('No continuity scan has run yet.'));
        return card;
    }

    card.appendChild(createKeyValue('Status', batch.status || 'unknown', 'Latest scan batch status.'));
    card.appendChild(createKeyValue('Strategy', batch.strategy || 'bulk', 'Continuity scan strategy used for this result.'));
    if (batch.modelCallCount !== undefined) card.appendChild(createKeyValue('Model calls', String(batch.modelCallCount || 0), 'Expected direct model calls used by this strategy, excluding JSON repair retries.'));
    card.appendChild(createKeyValue('Range', `${batch.startIndex || 0}-${batch.endIndex || 0}`, 'Message range used for this scan.'));
    card.appendChild(createKeyValue('Chunks', `${batch.completedChunks || 0} complete / ${batch.failedChunks || 0} failed / ${batch.totalChunks || 0} total`, 'Chunk-level checkpoint status.'));
    card.appendChild(createKeyValue('Observations', String(batch.observationCount || 0), 'Compact observations extracted before reducer passes.'));
    if (Array.isArray(batch.changeKeys) && batch.changeKeys.length) {
        card.appendChild(createKeyValue('Changed sections', batch.changeKeys.join(', '), 'Top-level continuity sections updated by the reduced delta.'));
    }
    if (batch.error) {
        card.appendChild(createKeyValue('Last error', batch.error, 'Latest scan error stored in the checkpoint ledger.'));
    }
    if (batch.completedAt || batch.updatedAt) {
        card.appendChild(createKeyValue('Updated', new Date(batch.completedAt || batch.updatedAt).toLocaleString(), 'Last time this scan batch was updated.'));
    }
    return card;
}

function createContinuityScanCard(state) {
    const settings = getSettings();
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-generation-progress-card';
    markTourTarget(card, 'continuity.scan');

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Continuity Scan';
    addTooltip(title, 'Adaptive continuity scanning: small scans use one fast delta call, medium scans use grouped section calls, and large scans use the checkpointed bulk pipeline.');
    card.appendChild(title);

    const automationCard = createAutomationModeCard(
        'Continuity Tracking',
        'continuityTrackingMode',
        'continuityAutoInterval',
        'Continuity scans only run when you click Scan Continuity State.',
        'Saga automatically scans recent continuity state every configured number of turns using the Utility provider.',
        'Automatic continuity scan interval in completed model turns.'
    );
    markTourTarget(automationCard, 'continuity.automation');
    card.appendChild(automationCard);

    const settingsWrap = document.createElement('div');
    settingsWrap.className = 'saga-lore-scan-settings-wrap';
    const scopeSection = createCollapsibleSection(
        'continuity.scanScope',
        'Scan Scope',
        getContinuityScanScopeSummary(settings),
        false,
        createContinuityScanScopeSettingsContent,
        { tooltip: 'Choose recent, custom range, or entire-chat scanning for continuity state.' }
    );
    markTourTarget(scopeSection, 'continuity.scanScope');
    settingsWrap.appendChild(scopeSection);
    const performanceSection = createCollapsibleSection(
        'continuity.scanPerformance',
        'Performance and Recovery',
        getContinuityScanPerformanceSummary(settings),
        false,
        createContinuityScanPerformanceSettingsContent,
        { tooltip: 'Chunk size, overlap, parallelism, retry behavior, and checkpoint settings.' }
    );
    markTourTarget(performanceSection, 'continuity.performance');
    settingsWrap.appendChild(performanceSection);
    const hasScanResults = !!state?.continuityScan?.lastBatchId;
    if (hasScanResults) {
        const resultsSection = createCollapsibleSection(
            'continuity.scanResults',
            'Scan Results',
            getContinuityScanResultsSummary(state),
            false,
            () => createContinuityScanResultsCard(getState()),
            { tooltip: 'Latest checkpointed continuity scan result and recovery status.' }
        );
        markTourTarget(resultsSection, 'continuity.results');
        settingsWrap.appendChild(resultsSection);
    }
    card.appendChild(settingsWrap);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(markTourTarget(createButton('Scan Continuity State', 'Scans the selected message range with the adaptive continuity scanner, then applies or stores one ordered continuity state update.', async (btn) => {
        if (!ensureContinuityProviderReadyForAction('Scan Continuity State')) return;
        await runBusyAction(btn, 'Scanning...', async () => {
            setFeatureProgress('continuity', 'Scanning continuity state...', 5);
            const result = await onExtractionTriggered({
                force: true,
                applyImmediately: true,
                progress: (message, pct) => setFeatureProgress('continuity', message, pct),
            });
            refreshHeader();
            refreshPanelBody({ preserveScroll: true });

            if (result?.status === 'applied') {
                const keys = result.changeKeys?.length ? ` Updated: ${result.changeKeys.join(', ')}.` : '';
                const chunks = Number(result.completedChunkCount || 0);
                const failed = Number(result.failedChunkCount || 0);
                setFeatureProgress('continuity', `Continuity scan applied.${keys}`, 100);
                resetFeatureProgress('continuity');
                toast(`Continuity state updated from ${chunks} chunk(s)${failed ? `; ${failed} failed` : ''}.${keys}`);
            } else if (result?.status === 'no_changes' || result?.status === 'skipped_unchanged') {
                setFeatureProgress('continuity', 'Continuity scan complete. No state changes detected.', 100);
                resetFeatureProgress('continuity');
                toast(result?.status === 'skipped_unchanged' ? 'Scan skipped unchanged chunks.' : 'Scan complete. No continuity changes detected.', 'info');
            } else if (result?.status === 'pending_review') {
                setFeatureProgress('continuity', 'Continuity scan stored changes for review.', 100);
                resetFeatureProgress('continuity');
                toast('Continuity changes stored for review.', 'info');
            } else {
                const status = result?.error || result?.status || 'unknown result';
                setFeatureProgress('continuity', `Continuity scan did not update state: ${status}`, 100);
                toast(`Continuity scan did not update state: ${status}`, 'warning');
            }
        });
    }, 'saga-primary-button'), 'continuity.scan.button'));
    card.appendChild(actions);

    appendGenerationStatus(card, state, 'continuity');
    return card;
}


function renderContinuityTab(container, state) {
    container.appendChild(createSectionHeader(
        'Continuity State',
        'Edit the lightweight live roleplay state Saga tracks for the next scene. Durable memory such as knowledge, secrets, milestones, and relationships belongs in Story Lore.'
    ));

    container.appendChild(createCollapsibleSection(
        'continuity.scan',
        'Continuity Scan',
        getContinuityScanScopeSummary(getSettings()),
        true,
        createContinuityScanCard(state),
        { tooltip: 'Adaptive continuity scanning controls, progress, and scan settings.' }
    ));

    if (state?.lastDelta) {
        const pendingDelta = document.createElement('div');
        pendingDelta.className = 'saga-review-section';
        const title = document.createElement('h4');
        title.textContent = 'Pending Continuity Changes';
        addTooltip(title, 'Older or manually created continuity deltas waiting to be applied. New scans apply directly to the editable sections below.');
        pendingDelta.appendChild(title);
        pendingDelta.appendChild(createDeltaReviewCard(state.lastDelta));
        container.appendChild(createCollapsibleSection(
            'continuity.pendingChanges',
            'Pending Continuity Changes',
            '1 waiting',
            true,
            pendingDelta,
            { tooltip: 'Older or manually created continuity deltas waiting to be applied.' }
        ));
    }

    const trackedSection = createCollapsibleSection('continuity.trackedSections', 'Tracked Sections', 'Enable/disable live-state scan and injection sections', false, createContinuitySectionToggleCard(state), { tooltip: 'Optional lightweight continuity sections for this chat.' });
    markTourTarget(trackedSection, 'continuity.trackedSections');
    container.appendChild(trackedSection);
    const sceneSection = createCollapsibleSection('continuity.canonScene', 'Scene and Timeline', getContinuityCanonSceneSummary(state), false, createCanonSceneEditorCard(state), { tooltip: 'Current date, scene, cast, and activity fields.' });
    markTourTarget(sceneSection, 'continuity.scene');
    container.appendChild(sceneSection);
    const charactersSection = createCollapsibleSection('continuity.characters', 'Active Characters', getCountLabel(state.characters || [], 'character'), false, createCharacterStateEditorCard(state), { tooltip: 'Current character-specific state: clothing, posture, emotion, immediate goals, and notes.' });
    markTourTarget(charactersSection, 'continuity.characters');
    container.appendChild(charactersSection);
    const inventorySection = createCollapsibleSection('continuity.inventory', 'Key Items', getCountLabel(state.inventory || [], 'item'), false, createJsonEditorCard('Key Items', 'Currently relevant items, owners, locations, and object status. Durable item history belongs in Story Lore.', 'inventory', state.inventory || [], false, 'inventory'), { tooltip: 'Current consequential items only.' });
    markTourTarget(inventorySection, 'continuity.items');
    container.appendChild(inventorySection);
    const threadsSection = createCollapsibleSection('continuity.activeGoalsThreads', 'Active Goals and Threads', getActiveGoalsThreadsSummary(state), false, createActiveGoalsThreadsEditorCard(state), { tooltip: 'Immediate goals and active threads that affect the next scene.' });
    markTourTarget(threadsSection, 'continuity.threads');
    container.appendChild(threadsSection);
}

function createContinuitySectionToggleCard(state) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Tracked Sections';
    addTooltip(title, 'Disabled top-level sections are not updated by Scan Continuity State and are omitted from continuity injection. Character child fields control nested character details.');
    card.appendChild(title);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Top-level sections control the live continuity blocks. Appearance Detail and Emotional State are child fields inside Active Characters.';
    card.appendChild(help);

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-continuity-toggle-grid';
    const cfg = state?.continuityConfig || {};
    for (const [key, label] of Object.entries(CONTINUITY_SECTION_LABELS)) {
        grid.appendChild(createContinuityConfigToggle(key, label, `${label} tracking. Turn off to preserve existing data but omit it from scans and continuity injection.`, cfg[key] !== false));
    }
    card.appendChild(grid);

    const characterFields = document.createElement('div');
    characterFields.className = 'saga-continuity-child-fields';
    markTourTarget(characterFields, 'continuity.characterFields');
    const childTitle = document.createElement('div');
    childTitle.className = 'saga-runtime-card-title saga-runtime-card-subtitle';
    childTitle.textContent = 'Active Character Fields';
    addTooltip(childTitle, 'Nested fields inside Active Characters. These apply only when Active Characters is enabled.');
    characterFields.appendChild(childTitle);

    const childHelp = document.createElement('div');
    childHelp.className = 'saga-runtime-help';
    childHelp.textContent = 'Appearance and emotion are stored inside each active character. Disabling one preserves saved values but keeps scans and injection from treating it as live state.';
    characterFields.appendChild(childHelp);

    const childGrid = document.createElement('div');
    childGrid.className = 'saga-runtime-grid saga-continuity-toggle-grid';
    for (const [key, label] of Object.entries(CHARACTER_CONTINUITY_FIELD_LABELS)) {
        const tooltip = key === 'emotionalState'
            ? 'Emotional State tracking. Turn off to preserve saved emotions but stop scans and continuity injection from treating them as live state.'
            : 'Appearance Detail tracking. Turn off to preserve saved clothing/appearance details but omit them from scans and continuity injection.';
        childGrid.appendChild(createContinuityConfigToggle(key, label, tooltip, cfg[key] !== false));
    }
    characterFields.appendChild(childGrid);
    card.appendChild(characterFields);

    card.appendChild(createEmotionFreshnessControls());

    return card;
}

function createContinuityConfigToggle(key, label, tooltip, checked) {
    return createToggleCard(label, checked, tooltip, (nextChecked) => {
        const current = getState();
        current.continuityConfig = { ...(current.continuityConfig || {}), [key]: nextChecked };
        saveState(current);
        refreshPanelBody({ preserveScroll: true });
        refreshHeader();
    });
}

function createEmotionFreshnessControls() {
    const settings = getSettings();
    const wrap = document.createElement('div');
    wrap.className = 'saga-continuity-emotion-freshness';
    markTourTarget(wrap, 'continuity.emotionalState');

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title saga-runtime-card-subtitle';
    title.textContent = 'Emotional State Freshness';
    addTooltip(title, 'Controls how long emotional state is treated as current in continuity injection.');
    wrap.appendChild(title);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Emotion decays by chat-message age so an old feeling does not keep steering the character after the scene moves on.';
    wrap.appendChild(help);
    appendSettingsResetButton(wrap, CONTINUITY_EMOTION_FRESHNESS_SETTING_KEYS, 'Emotional state freshness settings');

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-continuity-toggle-grid';
    grid.appendChild(createToggleCard(
        'Use emotion recency labels',
        settings.continuityEmotionRecencyEnabled !== false,
        'When enabled, injected emotional state is labeled current or recent, and stale emotions can be omitted.',
        (checked) => {
            const next = getSettings();
            next.continuityEmotionRecencyEnabled = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
        }
    ));
    wrap.appendChild(grid);

    wrap.appendChild(createRangeSettingRow('Current emotion window', 'Messages after an emotional update where emotion is injected as current.', 'continuityEmotionCurrentMessageWindow', { min: 0, max: 50, fallback: 8, suffix: ' messages' }));
    wrap.appendChild(createRangeSettingRow('Recent emotion window', 'Messages after an emotional update where emotion is injected only as recent context. Older emotions follow stale handling.', 'continuityEmotionRecentMessageWindow', { min: 0, max: 100, fallback: 20, suffix: ' messages' }));
    wrap.appendChild(createSelectSettingRow(
        'Stale emotion handling',
        'Controls what happens after the recent emotion window expires.',
        'continuityEmotionStaleBehavior',
        [
            ['omit', 'Omit stale emotions'],
            ['keep_as_recent', 'Keep as recent warning'],
            ['keep', 'Keep with stale label'],
        ]
    ));

    return wrap;
}

function createCanonSceneEditorCard(state) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Scene and Timeline';
    addTooltip(title, 'Lightweight live scene and timeline fields. Durable story-established canon changes belong in Story Lore.');
    card.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'saga-runtime-grid saga-context-grid';
    grid.appendChild(createContinuityTextField('Era', state?.canon?.era || '', 'canon', 'era', 'Canon era or broad story period.'));
    grid.appendChild(createContinuityTextField('In-universe date', state?.canon?.inUniverseDate || '', 'canon', 'inUniverseDate', 'Current in-universe date if known.'));
    grid.appendChild(createContinuityTextField('Canon boundary', state?.canon?.canonBoundary || '', 'canon', 'canonBoundary', 'Latest canon point treated as established.'));
    grid.appendChild(createContinuityTextField('Location', state?.scene?.location || '', 'scene', 'location', 'Current scene location.'));
    grid.appendChild(createContinuityTextField('Time of day', state?.scene?.timeOfDay || '', 'scene', 'timeOfDay', 'Current scene time of day.'));
    grid.appendChild(createContinuityTextField('Weather', state?.scene?.weather || '', 'scene', 'weather', 'Current weather if relevant.'));
    grid.appendChild(createContinuityTextField('Ambience', state?.scene?.ambience || '', 'scene', 'ambience', 'Scene mood or ambient conditions.'));
    grid.appendChild(createContinuityTextField('Current activity', state?.scene?.currentActivity || '', 'scene', 'currentActivity', 'What is currently happening in the scene.'));
    card.appendChild(grid);

    card.appendChild(createArrayTextField('Present characters', state?.scene?.presentCharacters || [], 'scene', 'presentCharacters', 'Comma-separated characters currently present.'));
    card.appendChild(createArrayTextField('Nearby characters', state?.scene?.nearbyCharacters || [], 'scene', 'nearbyCharacters', 'Comma-separated characters nearby but not necessarily in the active conversation.'));
    card.appendChild(createContinuitySectionPromptEditor('canonScene', 'Scene and Timeline'));
    return card;
}

function getContinuityCanonSceneSummary(state) {
    const parts = [state?.canon?.inUniverseDate, state?.scene?.location, state?.scene?.currentActivity]
        .map(v => String(v || '').trim())
        .filter(Boolean);
    return parts.length ? parts.slice(0, 2).join(' · ') : 'core fields';
}


function getActiveGoalsThreadsSummary(state) {
    const objectives = Array.isArray(state?.objectives) ? state.objectives.filter(o => o?.status !== 'completed' && o?.status !== 'abandoned').length : 0;
    const threads = Array.isArray(state?.threads) ? state.threads.filter(t => t?.status !== 'resolved').length : 0;
    const parts = [];
    if (objectives) parts.push(`${objectives} active goal${objectives === 1 ? '' : 's'}`);
    if (threads) parts.push(`${threads} active thread${threads === 1 ? '' : 's'}`);
    return parts.join(' · ') || 'none active';
}

function createActiveGoalsThreadsEditorCard(state) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-runtime-grid';
    wrap.appendChild(createJsonEditorCard(
        'Active Goals',
        'Immediate goals, blockers, stakes, and status. Long-term plot memory belongs in Story Lore.',
        'objectives',
        state?.objectives || [],
        true,
        'objectives'
    ));
    wrap.appendChild(createJsonEditorCard(
        'Active Threads',
        'Immediate unresolved threads that should influence the next scene. Durable relationship history, milestones, secrets, and plot history belong in Story Lore.',
        'threads',
        state?.threads || [],
        true,
        'threads'
    ));
    return wrap;
}

function createCharacterStateEditorCard(state) {
    const card = createJsonEditorCard(
        'Active Characters',
        'Live character state supports name, role, current location, clothing, posture, physicalState, emotionalState, carried key items, immediate goals, and notes. Durable knowledge, secrets, relationships, and milestones belong in Story Lore.',
        'characters',
        state?.characters || [],
        false,
        'characters'
    );
    card.appendChild(createCharacterAppearanceSummary(state));
    card.appendChild(createCharacterEmotionSummary(state));
    const schema = document.createElement('div');
    schema.className = 'saga-runtime-help';
    schema.textContent = 'Recommended active character object: { "name": "Harry", "clothing": "school robes", "physicalState": "tired", "emotionalState": { "trust": 2, "fear": 1, "confidence": 0.8, "notes": "uneasy but cooperative" }, "goals": ["find the source of the curse"] }';
    card.appendChild(schema);
    return card;
}

function createCharacterAppearanceSummary(state) {
    const cfg = state?.continuityConfig || {};
    const characters = Array.isArray(state?.characters) ? state.characters : [];
    return createCharacterFieldSummary(
        'Appearance Detail',
        cfg.appearance === false ? 'disabled for scans and injection' : 'active child field',
        characters
            .map(c => {
                return c?.clothing ? `${c.name || 'Unnamed'} - clothing: ${c.clothing}` : '';
            })
            .filter(Boolean),
        'continuity.appearanceDetail',
        'Appearance Detail is stored inside Active Characters. Disabling it preserves saved values but omits clothing/appearance from scans and injection.'
    );
}

function createCharacterEmotionSummary(state) {
    const cfg = state?.continuityConfig || {};
    const settings = getSettings();
    const characters = Array.isArray(state?.characters) ? state.characters : [];
    return createCharacterFieldSummary(
        'Emotional State',
        cfg.emotionalState === false ? 'disabled for scans and injection' : getEmotionFreshnessSummary(settings),
        characters
            .map(c => {
                const emotion = formatEmotionSummaryForPanel(c?.emotionalState || {}, settings);
                return emotion ? `${c.name || 'Unnamed'} - ${emotion}` : '';
            })
            .filter(Boolean),
        'continuity.emotionalStateSummary',
        'Emotional State is stored inside Active Characters. Injection uses freshness windows so old emotions do not keep steering the character.'
    );
}

function createCharacterFieldSummary(titleText, statusText, lines, tourTarget, tooltip) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-character-field-summary';
    markTourTarget(wrap, tourTarget);

    const head = document.createElement('div');
    head.className = 'saga-character-field-summary-head';
    const title = document.createElement('span');
    title.textContent = titleText;
    addTooltip(title, tooltip);
    head.appendChild(title);
    const status = document.createElement('span');
    status.textContent = statusText;
    head.appendChild(status);
    wrap.appendChild(head);

    if (lines.length) {
        for (const line of lines.slice(0, 8)) {
            const row = document.createElement('div');
            row.className = 'saga-character-field-summary-row';
            row.textContent = line;
            wrap.appendChild(row);
        }
        if (lines.length > 8) {
            const more = document.createElement('div');
            more.className = 'saga-character-field-summary-row';
            more.textContent = `+${lines.length - 8} more`;
            wrap.appendChild(more);
        }
    } else {
        const empty = document.createElement('div');
        empty.className = 'saga-character-field-summary-row saga-character-field-empty';
        empty.textContent = 'No saved values yet.';
        wrap.appendChild(empty);
    }

    return wrap;
}

function getPanelChatLength() {
    try {
        const ctx = SillyTavern.getContext();
        return Array.isArray(ctx?.chat) ? ctx.chat.length : 0;
    } catch (_) {
        return 0;
    }
}

function getEmotionFreshnessSummary(settings = getSettings()) {
    if (settings.continuityEmotionRecencyEnabled === false) return 'recency labels off';
    return `current ${settings.continuityEmotionCurrentMessageWindow || 8} / recent ${settings.continuityEmotionRecentMessageWindow || 20} messages`;
}

function formatEmotionSummaryForPanel(raw = {}, settings = getSettings()) {
    const keys = ['affection', 'trust', 'desire', 'connection', 'fear', 'anger', 'sadness', 'joy'];
    const parts = [];
    for (const key of keys) {
        const value = Number(raw?.[key] || 0);
        if (Math.abs(value) >= 2) parts.push(`${key} ${value > 0 ? '+' : ''}${value}`);
    }
    if (raw?.notes) parts.push(String(raw.notes));
    if (!parts.length) return '';

    const current = getPanelChatLength();
    const updatedAt = Number(raw?.lastUpdatedChatLength);
    const age = Number.isFinite(updatedAt) && updatedAt > 0 && current >= updatedAt ? current - updatedAt : 0;
    if (settings.continuityEmotionRecencyEnabled === false) return parts.join(', ');

    const currentWindow = Math.max(0, Number(settings.continuityEmotionCurrentMessageWindow) || 8);
    const recentWindow = Math.max(currentWindow, Number(settings.continuityEmotionRecentMessageWindow) || 20);
    const confidence = Number(raw?.confidence);
    const confidenceText = Number.isFinite(confidence) && confidence < 0.65 ? 'uncertain, ' : '';
    if (age > recentWindow) return `${confidenceText}stale ${age} messages ago; omitted unless stale handling keeps it (${parts.join(', ')})`;
    if (age > currentWindow) return `${confidenceText}recent ${age} messages ago: ${parts.join(', ')}`;
    return `${confidenceText}current: ${parts.join(', ')}`;
}


function createContinuitySectionPromptEditor(sectionKey, label) {
    const settings = getSettings();
    const prompts = settings.continuitySectionPrompts || {};
    const defaults = DEFAULT_SETTINGS.continuitySectionPrompts || {};

    const wrap = document.createElement('div');
    wrap.className = 'saga-section-prompt-editor-wrap';

    const textarea = document.createElement('textarea');
    textarea.className = 'saga-section-prompt-editor';
    textarea.spellcheck = false;
    textarea.value = String(prompts[sectionKey] || defaults[sectionKey] || '');
    addTooltip(textarea, `User-editable scan prompt for ${label}. This is appended to Scan Continuity State when this section is enabled/tracked.`);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-section-prompt-actions';
    actions.appendChild(createButton('Save Prompt', `Save the Scan Continuity prompt for ${label}.`, () => {
        const next = getSettings();
        next.continuitySectionPrompts = {
            ...(DEFAULT_SETTINGS.continuitySectionPrompts || {}),
            ...(next.continuitySectionPrompts || {}),
            [sectionKey]: textarea.value.trim(),
        };
        saveSettings(next);
        toast(`${label} scan prompt saved.`);
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reset Default', `Restore the default Scan Continuity prompt for ${label}.`, () => {
        textarea.value = String(defaults[sectionKey] || '');
        const next = getSettings();
        next.continuitySectionPrompts = {
            ...(DEFAULT_SETTINGS.continuitySectionPrompts || {}),
            ...(next.continuitySectionPrompts || {}),
            [sectionKey]: textarea.value.trim(),
        };
        saveSettings(next);
        toast(`${label} scan prompt reset.`);
    }));

    wrap.appendChild(textarea);
    wrap.appendChild(actions);

    return createCollapsibleSection(
        `continuity.prompt.${sectionKey}`,
        'Scan Prompt',
        'used when this section is tracked',
        false,
        wrap,
        { tooltip: `Editable prompt guidance appended to continuity scans for ${label}.` }
    );
}

function createContinuityTextField(label, value, section, field, tooltip) {
    return createTextSettingField(label, value, tooltip, (nextValue) => {
        const current = getState();
        current[section] = { ...(current[section] || {}), [field]: nextValue };
        saveState(current);
        refreshHeader();
    });
}

function createArrayTextField(label, values, section, field, tooltip) {
    const wrap = document.createElement('label');
    wrap.className = 'saga-inline-field saga-context-field';
    addTooltip(wrap, tooltip);
    const span = document.createElement('span');
    span.textContent = label;
    wrap.appendChild(span);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = Array.isArray(values) ? values.join(', ') : '';
    input.addEventListener('change', () => {
        const current = getState();
        current[section] = { ...(current[section] || {}), [field]: input.value.split(',').map(x => x.trim()).filter(Boolean) };
        saveState(current);
        refreshHeader();
    });
    wrap.appendChild(input);
    return wrap;
}

function createJsonEditorCard(titleText, helpText, path, value, embedded = false, promptSectionKey = '') {
    const card = document.createElement('div');
    card.className = embedded ? 'saga-json-editor-embedded' : 'saga-runtime-card saga-json-editor-card';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = titleText;
    addTooltip(title, helpText);
    card.appendChild(title);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = helpText;
    card.appendChild(help);

    const textarea = document.createElement('textarea');
    textarea.className = 'saga-continuity-json-editor';
    textarea.value = JSON.stringify(value ?? null, null, 2);
    textarea.spellcheck = false;
    addTooltip(textarea, `Editable JSON for ${titleText}. Save validates JSON before writing to state.`);
    card.appendChild(textarea);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Save Section', `Save edited ${titleText} JSON into the current chat continuity state.`, () => {
        try {
            const parsed = JSON.parse(textarea.value || 'null');
            const current = getState();
            setStatePath(current, path, parsed);
            saveState(current);
            refreshPanelBody({ preserveScroll: true });
            refreshHeader();
            toast(`${titleText} saved.`);
        } catch (e) {
            toast(`Invalid JSON in ${titleText}: ${e.message}`, 'error');
        }
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Revert', `Reload ${titleText} from saved state.`, () => {
        refreshPanelBody({ preserveScroll: true });
    }));
    card.appendChild(actions);
    if (promptSectionKey) {
        card.appendChild(createContinuitySectionPromptEditor(promptSectionKey, titleText));
    }
    return card;
}

function setStatePath(state, path, value) {
    const parts = String(path).split('.');
    let target = state;
    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        target = target[key];
    }
    target[parts[parts.length - 1]] = value;
}

// Injection tab ---------------------------------------------------------------

function renderInjectionTab(container, state) {
    const settings = getSettings();
    if (isBasicExperience(settings)) {
        setPanelState({ activeTab: 'session' });
        renderSessionTab(container, state);
        return;
    }

    const continuityPreview = buildContinuityPreview(state, settings.continuityInjectionMode || 'direct');
    const loreHighPreview = buildLorePreview(state, getLoreTierMode(settings, 'high'), 'high');
    const loreNormalPreview = buildLorePreview(state, getLoreTierMode(settings, 'normal'), 'normal');
    const loreLowPreview = buildLorePreview(state, getLoreTierMode(settings, 'low'), 'low');
    updateCompressionTurnStatus(state, 'lore-high');
    updateCompressionTurnStatus(state, 'lore-normal');
    updateCompressionTurnStatus(state, 'lore-low');
    updateCompressionTurnStatus(state, 'continuity');

    container.appendChild(createSectionHeader(
        'Injection',
        'Final workflow step. Decide whether to inject structured Continuity state, Lore entries, or both, and whether each is direct or model-compressed.'
    ));

    const toggles = document.createElement('div');
    toggles.className = 'saga-runtime-grid';
    markTourTarget(toggles, 'injection.toggles');
    toggles.appendChild(createToggleCard(
        'Inject Continuity',
        settings.injectContinuity !== false && settings.injectMemo !== false,
        'Injects the editable lightweight Continuity state: scene/timeline, active characters, key items, and active goals/threads. Durable memory is handled by Lore entries.',
        (checked) => {
            const next = getSettings();
            next.injectContinuity = checked;
            next.injectMemo = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: false });
            refreshHeader();
        }
    ));
    toggles.appendChild(createToggleCard(
        'Inject Lore',
        settings.injectLore !== false,
        'Injects accepted, unmuted Lore entries through relevance-tiered prompt groups. Turn this off if you want Saga to track/edit lore without sending lore to the roleplay model.',
        (checked) => {
            const next = getSettings();
            next.injectLore = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: false });
            refreshHeader();
        }
    ));
    container.appendChild(toggles);

    const placementStatus = `${settings.injectionTransport === 'interceptor' ? 'Legacy prepend' : 'Extension Prompt'} · C ${formatPlacementSummary(settings, 'continuity')} · H ${formatPlacementSummary(settings, 'loreHigh')} · N ${formatPlacementSummary(settings, 'loreNormal')} · L ${formatPlacementSummary(settings, 'loreLow')}`;
    const placementSection = createCollapsibleSection('injection.promptPlacement', 'Prompt Placement', placementStatus, false, createInjectionPlacementCard(settings), { tooltip: 'Role, position, and depth used for prompt injection.' });
    markTourTarget(placementSection, 'injection.promptPlacement');
    container.appendChild(placementSection);

    const continuityEnabled = settings.injectContinuity !== false && settings.injectMemo !== false;
    container.appendChild(createCollapsibleSection(
        'injection.preview.continuity',
        'Continuity Injection Preview',
        getInjectionPreviewSectionSummary(continuityPreview, continuityEnabled),
        true,
        createInjectionPreviewCard('Continuity Injection', 'saga-continuity-injection-preview', continuityPreview, continuityEnabled, 'This is the actual Continuity block currently configured for prompt injection. It can be placed at a different depth because it is separated from Lore.', createContinuityHandlingDropdown(state, settings)),
        { tooltip: 'Read-only preview of the Continuity prompt block Saga will inject.' }
    ));
    const highEnabled = settings.injectLore !== false && settings.loreHighInjectionEnabled !== false;
    container.appendChild(createCollapsibleSection(
        'injection.preview.loreHigh',
        'High-Relevance Lore Preview',
        getInjectionPreviewSectionSummary(loreHighPreview, highEnabled),
        true,
        createInjectionPreviewCard('High-Relevance Lore Injection', 'saga-lore-high-injection-preview', loreHighPreview, highEnabled, 'Lore injected in the high-relevance prompt group.', createLoreTierHandlingDropdown('high', state, settings)),
        { tooltip: 'Read-only preview of the high-relevance Lore prompt block.' }
    ));
    const normalEnabled = settings.injectLore !== false && settings.loreNormalInjectionEnabled !== false;
    container.appendChild(createCollapsibleSection(
        'injection.preview.loreNormal',
        'Normal-Relevance Lore Preview',
        getInjectionPreviewSectionSummary(loreNormalPreview, normalEnabled),
        false,
        createInjectionPreviewCard('Normal-Relevance Lore Injection', 'saga-lore-normal-injection-preview', loreNormalPreview, normalEnabled, 'Lore injected in the normal-relevance prompt group.', createLoreTierHandlingDropdown('normal', state, settings)),
        { tooltip: 'Read-only preview of the normal-relevance Lore prompt block.' }
    ));
    const lowEnabled = settings.injectLore !== false && settings.loreLowInjectionEnabled !== false;
    container.appendChild(createCollapsibleSection(
        'injection.preview.loreLow',
        'Low-Relevance Lore Preview',
        getInjectionPreviewSectionSummary(loreLowPreview, lowEnabled),
        false,
        createInjectionPreviewCard('Low-Relevance Lore Injection', 'saga-lore-low-injection-preview', loreLowPreview, lowEnabled, 'Lore injected in the low-relevance prompt group.', createLoreTierHandlingDropdown('low', state, settings)),
        { tooltip: 'Read-only preview of the low-relevance Lore prompt block.' }
    ));
    const compressionSection = createCollapsibleSection(
        'injection.compressionPrompts',
        'Compression Prompts',
        'Editable templates for model compression',
        false,
        createCompressionPromptEditorCard(),
        { tooltip: 'Editable prompt templates used by Compress Continuity Now and tiered Compress Lore actions.' }
    );
    markTourTarget(compressionSection, 'injection.compression');
    container.appendChild(compressionSection);
}

function getInjectionPreviewSectionSummary(text, enabled = true) {
    if (!enabled) return 'disabled';
    const clean = String(text || '').trim();
    if (!clean) return 'empty';
    return `${clean.length} chars`;
}


function createContinuityHandlingDropdown(state, settings) {
    return createCollapsibleSection(
        'injection.continuityHandling',
        'Continuity Handling',
        `${settings.continuityInjectionMode || 'direct'} · ${getCompressionStatusTextForSummary(state, 'continuity')}`,
        (settings.continuityInjectionMode || 'direct') === 'compressed',
        createContinuityHandlingCard(state, settings),
        { tooltip: 'Direct or model-compressed handling for Continuity injection.' }
    );
}

function createContinuityHandlingCard(state, settings) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-compression-handling-card';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Continuity Handling Mode';
    addTooltip(title, 'Direct sends structured continuity state. Compressed uses a cached model compression generated from the direct continuity preview.');
    card.appendChild(title);

    const buttons = document.createElement('div');
    buttons.className = 'saga-mode-buttons';
    buttons.appendChild(createContinuityModeButton('direct', 'Direct', 'Insert editable continuity state with full section detail.', settings));
    buttons.appendChild(createContinuityModeButton('compressed', 'Compressed', 'Use a saved model-compressed continuity block. If the cache is stale or missing, direct text is used until you click Compress Continuity Now.', settings));
    card.appendChild(buttons);

    card.appendChild(createCompressionLevelControl('continuity', settings));
    card.appendChild(createKeyValue('Target budget', getCompressionBudgetSummary('continuity', state), 'Compression levels set an explicit target token budget for the model request.'));
    card.appendChild(createKeyValue('Continuity status', getContinuityCompressionStatusText(getState()), 'Shows whether cached model-compressed continuity is current, stale, missing, or failed.'));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Compress Continuity Now', 'Uses the Utility provider to compress the direct Continuity Injection block and cache it for compressed injection.', async (btn) => {
        await runModelCompression('continuity', btn);
    }, 'saga-primary-button'));
    card.appendChild(actions);
    return card;
}

function createLoreTierHandlingDropdown(tier, state, settings) {
    const label = RELEVANCE_META[tier]?.label || tier;
    const entries = getInjectableLoreEntries(getState(), 0, tier).length;
    return createCollapsibleSection(
        `injection.lore${capTier(tier)}Handling`,
        `${label}-Relevance Lore Handling`,
        `${entries} entries · ${getLoreTierMode(settings, tier)} · ${getCompressionStatusTextForSummary(state, `lore-${tier}`)}`,
        false,
        createLoreTierHandlingCard(tier, state, settings),
        { tooltip: `Direct/compressed handling, compression level, and cache status for ${label}-Relevance Lore.` }
    );
}

function createLoreTierHandlingCard(tier, state, settings) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-compression-handling-card saga-lore-tier-injection-card';
    const label = RELEVANCE_META[tier]?.label || tier;
    const counts = getLoreRelevanceCounts(state);
    card.appendChild(createKeyValue('Lore available', `${counts[tier] || 0} ${label} · ${counts.muted || 0} muted total`, 'Accepted lore grouped by relevance. Muted entries are excluded before injection/compression.'));

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'saga-inline-toggle';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = settings[tierSettingKey(tier, 'InjectionEnabled')] !== false;
    enabled.addEventListener('change', () => {
        const next = getSettings();
        next[tierSettingKey(tier, 'InjectionEnabled')] = enabled.checked;
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
    });
    enabledLabel.appendChild(enabled);
    enabledLabel.appendChild(document.createTextNode(' Enable this lore injection'));
    card.appendChild(enabledLabel);

    const buttons = document.createElement('div');
    buttons.className = 'saga-mode-buttons';
    buttons.appendChild(createLoreTierModeButton(tier, 'direct', 'Direct', 'Inject this tier as resolved lore text.'));
    buttons.appendChild(createLoreTierModeButton(tier, 'compressed', 'Compressed', 'Inject this tier from its own cached model compression.'));
    card.appendChild(buttons);

    card.appendChild(createKeyValue('Entries', String(getInjectableLoreEntries(getState(), 0, tier).length), 'Accepted, unmuted entries in this relevance tier.'));
    card.appendChild(createCompressionLevelControl(`lore-${tier}`, settings));
    card.appendChild(createKeyValue('Target budget', getCompressionBudgetSummary(`lore-${tier}`, state), 'Compression budget for this relevance tier.'));
    card.appendChild(createKeyValue('Compression status', getCompressionStatusTextForKind(getState(), `lore-${tier}`), 'Tier-specific compression cache status.'));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton(`Compress ${label} Now`, `Compresses only ${tier} relevance lore.`, async (btn) => {
        await runModelCompression(`lore-${tier}`, btn);
    }, tier === 'high' ? 'saga-primary-button' : ''));
    card.appendChild(actions);
    return card;
}

function createLoreTierModeButton(tier, mode, label, tooltip) {
    const settings = getSettings();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'saga-mode-button';
    if (getLoreTierMode(settings, tier) === mode) btn.classList.add('saga-mode-button-active');
    btn.textContent = label;
    addTooltip(btn, tooltip);
    btn.addEventListener('click', () => {
        const next = getSettings();
        next[tierSettingKey(tier, 'InjectionMode')] = mode;
        saveSettings(next);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
    });
    return btn;
}


function createCompressionLevelControl(kind, settings) {
    const parsed = parseLoreCompressionKind(kind);
    const levelKey = parsed.base === 'continuity' ? 'continuityCompressionLevel' : parsed.tier ? tierSettingKey(parsed.tier, 'CompressionLevel') : 'loreCompressionLevel';
    const fallback = 3;
    const levelValue = Math.max(1, Math.min(5, Number(settings[levelKey]) || fallback));
    const label = document.createElement('label');
    label.className = 'saga-slider-row';
    const text = document.createElement('span');
    text.textContent = `Compression level: ${levelValue} (${getCompressionProfile(levelValue).label})`;
    addTooltip(text, 'Compression level changes both the wording and the target token budget for the model compression request.');
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '1';
    range.max = '5';
    range.value = String(levelValue);
    range.addEventListener('input', () => {
        const next = getSettings();
        next[levelKey] = Number(range.value) || 3;
        saveSettings(next);
        text.textContent = `Compression level: ${next[levelKey]} (${getCompressionProfile(next[levelKey]).label})`;
        refreshInjectionPreviewOnly();
    });
    label.appendChild(text);
    label.appendChild(range);
    return label;
}

function createCompressionPromptEditorCard() {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-compression-prompt-card';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Compression Prompts';
    card.appendChild(title);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Variables: {{kind}}, {{compressionLevel}}, {{compressionLabel}}, {{directTokens}}, {{targetTokens}}, {{hardTokenLimit}}, {{directCharacters}}, {{targetCharacters}}, {{hardCharacterLimit}}, {{storyContext}}, {{directText}}.';
    card.appendChild(help);

    card.appendChild(createCompressionPromptTextarea('Continuity Compression Prompt', 'continuityCompressionPromptTemplate', DEFAULT_SETTINGS.continuityCompressionPromptTemplate));
    card.appendChild(createCompressionPromptTextarea('Lore Compression Prompt', 'loreCompressionPromptTemplate', DEFAULT_SETTINGS.loreCompressionPromptTemplate));
    return card;
}

function createCompressionPromptTextarea(labelText, settingKey, defaultValue) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-compression-template-wrap';
    const label = document.createElement('div');
    label.className = 'saga-runtime-card-title saga-compression-template-title';
    label.textContent = labelText;
    addTooltip(label, `Editable template used for ${labelText}.`);
    wrap.appendChild(label);

    const textarea = document.createElement('textarea');
    textarea.className = 'saga-compression-template-editor';
    textarea.spellcheck = false;
    textarea.value = String(getSettings()[settingKey] || defaultValue || '');
    wrap.appendChild(textarea);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Save Template', `Save ${labelText}.`, () => {
        const next = getSettings();
        next[settingKey] = textarea.value;
        saveSettings(next);
        toast(`${labelText} saved.`);
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reset Default', `Restore Saga's default ${labelText}.`, () => {
        const next = getSettings();
        next[settingKey] = defaultValue;
        saveSettings(next);
        textarea.value = defaultValue;
        toast(`${labelText} reset to default.`, 'info');
    }));
    actions.appendChild(createButton('Copy Prompt', `Copy ${labelText} to clipboard.`, async () => {
        try {
            await navigator.clipboard?.writeText(textarea.value);
            toast(`${labelText} copied.`, 'info');
        } catch (_) {
            toast('Clipboard copy unavailable in this browser context.', 'warning');
        }
    }));
    wrap.appendChild(actions);
    return wrap;
}



function formatPlacementSummary(settings, kind) {
    const prefix = kind === 'continuity' ? 'continuity' : kind === 'loreHigh' ? 'loreHigh' : kind === 'loreNormal' ? 'loreNormal' : kind === 'loreLow' ? 'loreLow' : 'lore';
    const position = Number(settings[`${prefix}InjectionPosition`] ?? 1);
    const role = Number(settings[`${prefix}InjectionRole`] ?? 0);
    const depth = Number(settings[`${prefix}InjectionDepth`] ?? 4);
    const positionLabel = position === 1 ? 'in-chat' : (position === 2 ? 'before' : 'after');
    const roleLabel = role === 1 ? 'user' : (role === 2 ? 'assistant' : 'system');
    return `${positionLabel}@${depth}/${roleLabel}`;
}

function getCompressionProfile(level) {
    const profiles = {
        1: { label: 'Light', ratio: 0.8, description: 'preserve most details; remove redundancy only' },
        2: { label: 'Moderate', ratio: 0.6, description: 'concise but still descriptive' },
        3: { label: 'Balanced', ratio: 0.4, description: 'keep roleplay-relevant facts and current-scene implications' },
        4: { label: 'Heavy', ratio: 0.25, description: 'short bullets; preserve critical secrets, constraints, and protected details' },
        5: { label: 'Minimal', ratio: 0.15, description: 'minimum viable context; only essential facts, constraints, secrets, and hazards' },
    };
    return profiles[Math.max(1, Math.min(5, Number(level) || 2))] || profiles[2];
}

function estimateTokenBudgetForCompression(text, level) {
    const source = String(text || '');
    const directTokens = estimateTokens(source);
    const directCharacters = source.length;
    const profile = getCompressionProfile(level);
    const targetTokens = Math.max(96, Math.ceil(directTokens * profile.ratio));
    const hardTokenLimit = Math.max(128, Math.ceil(targetTokens * 1.2));
    const targetCharacters = Math.max(420, Math.ceil(directCharacters * profile.ratio));
    const hardCharacterLimit = Math.max(560, Math.ceil(targetCharacters * 1.18));
    return {
        directTokens,
        directCharacters,
        targetTokens,
        targetCharacters,
        hardTokenLimit,
        hardCharacterLimit,
        profile,
    };
}

function getCompressionBudgetSummary(kind, state) {
    const settings = getSettings();
    const parsed = parseLoreCompressionKind(kind);
    const level = parsed.base === 'continuity'
        ? Math.max(1, Math.min(5, Number(settings.continuityCompressionLevel) || 3))
        : parsed.tier ? getLoreTierLevel(settings, parsed.tier) : Math.max(1, Math.min(5, Number(settings.loreCompressionLevel) || 3));
    const directText = parsed.base === 'continuity'
        ? buildContinuityPreview(state, 'direct')
        : parsed.tier ? buildLorePreview(state, 'direct', parsed.tier) : buildLorePreview(state, 'direct');
    if (!directText || !directText.trim()) return 'No source text';
    const budget = estimateTokenBudgetForCompression(directText, level);
    return `~${budget.targetTokens} tokens / ${budget.targetCharacters} chars target; max ${budget.hardTokenLimit} tokens / ${budget.hardCharacterLimit} chars from ~${budget.directTokens} tokens / ${budget.directCharacters} chars`;
}

function getCompressionStatusTextForSummary(state, kind) {
    const parsed = parseLoreCompressionKind(kind);
    const status = parsed.base === 'continuity' ? getContinuityCompressionStatusText(state) : getCompressionStatusTextForKind(state, kind);
    if (/Direct mode active/i.test(status)) return 'direct';
    if (/current/i.test(status) || /model-compressed/i.test(status)) return 'current cache';
    if (/stale/i.test(status)) return 'stale cache';
    if (/missing|No cached/i.test(status)) return 'no cache';
    return status.slice(0, 40);
}


function createInjectionPlacementCard(settings) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-prompt-placement-card';
    markTourTarget(card, 'injection.placement.card');

    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title';
    title.textContent = 'Prompt Placement';
    addTooltip(title, 'Controls how Saga injects Continuity and Lore into SillyTavern prompts. Extension Prompt mode uses SillyTavern role/depth injection; Interceptor mode prepends a combined block to the last user message.');
    card.appendChild(title);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Recommended: Extension Prompt, System role, with Continuity depth 3, High-Relevance Lore depth 2, Normal depth 5, and Low depth 9. Depth 0 is closest to the latest message.';
    card.appendChild(help);
    appendSettingsResetButton(card, PROMPT_PLACEMENT_SETTING_KEYS, 'Prompt placement settings');

    const placement = document.createElement('div');
    placement.className = 'saga-prompt-placement-lines';

    const methodRow = document.createElement('div');
    methodRow.className = 'saga-prompt-placement-line saga-prompt-placement-method-line';
    markTourTarget(methodRow, 'injection.placement.method');
    methodRow.appendChild(createPlacementSelect('Injection method', 'injectionTransport', settings.injectionTransport || 'extension_prompt', [
        ['extension_prompt', 'Extension Prompt'],
        ['interceptor', 'Legacy prepend'],
    ], 'Extension Prompt uses SillyTavern setExtensionPrompt and supports role/depth. Interceptor mode appears as part of the last user message.', 'saga-placement-method'));
    placement.appendChild(methodRow);

    placement.appendChild(createPromptPlacementLine('Continuity', [
        createPlacementSelect('Position', 'continuityInjectionPosition', String(settings.continuityInjectionPosition ?? 1), [
            ['1', 'In-chat'],
            ['0', 'After prompt'],
            ['2', 'Before prompt'],
        ], 'Where the Continuity Injection block is inserted. Depth only applies to In-chat.', 'saga-placement-position'),
        createPlacementNumber('Depth', 'continuityInjectionDepth', settings.continuityInjectionDepth ?? 3, 0, 1000, 'Depth 0 is closest to the latest message. Higher depth moves the block earlier in chat history.', 'saga-placement-depth'),
        createPlacementSelect('Role', 'continuityInjectionRole', String(settings.continuityInjectionRole ?? 0), [
            ['0', 'System'],
            ['1', 'User'],
            ['2', 'Assistant'],
        ], 'Role used for the injected Continuity block when using In-chat extension prompt placement.', 'saga-placement-role'),
    ]));

    for (const [tier, label, depth] of [['high', 'High-Relevance Lore', 2], ['normal', 'Normal-Relevance Lore', 5], ['low', 'Low-Relevance Lore', 9]]) {
        placement.appendChild(createPromptPlacementLine(label, [
            createPlacementSelect('Position', tierSettingKey(tier, 'InjectionPosition'), String(settings[tierSettingKey(tier, 'InjectionPosition')] ?? 1), [
                ['1', 'In-chat'],
                ['0', 'After prompt'],
                ['2', 'Before prompt'],
            ], `Where the ${label} block is inserted. Depth only applies to In-chat.`, 'saga-placement-position'),
            createPlacementNumber('Depth', tierSettingKey(tier, 'InjectionDepth'), settings[tierSettingKey(tier, 'InjectionDepth')] ?? depth, 0, 1000, 'Depth 0 is closest to the latest message. Higher depth moves the block earlier in chat history.', 'saga-placement-depth'),
            createPlacementSelect('Role', tierSettingKey(tier, 'InjectionRole'), String(settings[tierSettingKey(tier, 'InjectionRole')] ?? 0), [
                ['0', 'System'],
                ['1', 'User'],
                ['2', 'Assistant'],
            ], `Role used for ${label}.`, 'saga-placement-role'),
        ]));
    }

    card.appendChild(placement);

    const status = typeof globalThis.sagaGetInjectionStatus === 'function'
        ? globalThis.sagaGetInjectionStatus()
        : null;
    const statusText = status
        ? `${status.transport || 'unknown'} | continuity ${status.continuityChars || 0} chars | high ${status.loreHighChars || 0} chars | normal ${status.loreNormalChars || 0} chars | low ${status.loreLowChars || 0} chars`
        : 'Prompt sync status unavailable until extension initialization completes.';
    card.appendChild(createKeyValue('Current sync', statusText, 'Shows the last Saga prompt sync result.'));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Sync Injection Now', 'Immediately updates SillyTavern extension prompts from the current Continuity and Lore previews.', () => {
        if (typeof globalThis.sagaSyncPromptInjection === 'function') {
            const info = globalThis.sagaSyncPromptInjection();
            toast(`Synced injection: ${info.transport}, continuity ${info.continuityChars || 0} chars, lore ${info.loreChars || 0} chars.`, 'info');
        } else {
            toast('Saga prompt sync function is not available.', 'error');
        }
    }));
    card.appendChild(actions);

    return card;
}

function createPromptPlacementLine(labelText, controls) {
    const row = document.createElement('div');
    row.className = 'saga-prompt-placement-line';

    const label = document.createElement('div');
    label.className = 'saga-prompt-placement-line-label';
    label.textContent = labelText;
    addTooltip(label, `${labelText} prompt placement settings.`);
    row.appendChild(label);

    const controlWrap = document.createElement('div');
    controlWrap.className = 'saga-prompt-placement-control-wrap';
    for (const control of controls) {
        controlWrap.appendChild(control);
    }
    row.appendChild(controlWrap);

    return row;
}

function createPlacementSelect(labelText, settingKey, value, options, tooltip, extraClass = '') {
    const label = document.createElement('label');
    label.className = `saga-inline-field ${extraClass}`.trim();
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, tooltip);
    const select = document.createElement('select');
    select.value = String(value);
    for (const [optionValue, optionLabel] of options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionLabel;
        select.appendChild(option);
    }
    select.value = String(value);
    select.addEventListener('change', () => {
        const next = getSettings();
        if (settingKey.endsWith('Position') || settingKey.endsWith('Role')) {
            next[settingKey] = Number(select.value);
        } else {
            next[settingKey] = select.value;
        }
        saveSettings(next);
        refreshPanelBody({ preserveScroll: false });
    });
    label.appendChild(span);
    label.appendChild(select);
    return label;
}

function createPlacementNumber(labelText, settingKey, value, min, max, tooltip, extraClass = '') {
    const label = document.createElement('label');
    label.className = `saga-inline-field ${extraClass}`.trim();
    const span = document.createElement('span');
    span.textContent = labelText;
    addTooltip(span, tooltip);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.addEventListener('change', () => {
        const next = getSettings();
        next[settingKey] = Math.max(min, Math.min(max, parseInt(input.value, 10) || Number(value) || 0));
        saveSettings(next);
        refreshPanelBody({ preserveScroll: false });
    });
    label.appendChild(span);
    label.appendChild(input);
    return label;
}

function createInjectionPreviewCard(titleText, className, text, enabled, helpText, extraContent = null) {
    const previewCard = document.createElement('div');
    previewCard.className = 'saga-runtime-card saga-injection-preview-card';
    if (String(className || '').includes('continuity')) markTourTarget(previewCard, 'injection.preview.continuity');
    else if (String(className || '').includes('lore-high')) markTourTarget(previewCard, 'injection.preview.high');
    else if (String(className || '').includes('lore-normal')) markTourTarget(previewCard, 'injection.preview.normal');
    else if (String(className || '').includes('lore-low')) markTourTarget(previewCard, 'injection.preview.low');
    const previewTitle = document.createElement('div');
    previewTitle.className = 'saga-runtime-card-title';
    previewTitle.textContent = titleText;
    addTooltip(previewTitle, helpText);
    previewCard.appendChild(previewTitle);

    const previewHelp = document.createElement('div');
    previewHelp.className = 'saga-runtime-help';
    previewHelp.textContent = enabled
        ? helpText
        : `${titleText} is currently disabled. This panel shows what would be injected if enabled.`;
    previewCard.appendChild(previewHelp);

    const pre = document.createElement('pre');
    pre.className = `saga-injection-preview ${className}`;
    pre.textContent = getInjectionDisplayText(titleText, text, enabled);
    addTooltip(pre, 'Scrollable prompt context block. This text is ephemeral and is not written into chat history.');
    previewCard.appendChild(pre);

    if (extraContent) previewCard.appendChild(extraContent);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    actions.appendChild(createButton('Refresh Injection Text', 'Rebuilds both split injection blocks from current state and settings.', () => {
        refreshInjectionPreviewOnly();
        toast('Injection text refreshed.', 'info');
    }));
    previewCard.appendChild(actions);
    return previewCard;
}

function getInjectionDisplayText(titleText, text, enabled = true) {
    const clean = String(text || '').trim();
    if (clean) return clean;
    const lower = String(titleText || '').toLowerCase();
    if (lower.includes('lore')) return enabled ? '(No lore data to inject.)' : '(Lore injection is disabled.)';
    if (lower.includes('continuity')) return enabled ? '(No continuity data to inject.)' : '(Continuity injection is disabled.)';
    return '(No data to inject.)';
}

function refreshInjectionPreviewOnly() {
    const state = getState();
    const settings = getSettings();
    const continuity = buildContinuityPreview(state, settings.continuityInjectionMode || 'direct');
    const loreHigh = buildLorePreview(state, getLoreTierMode(settings, 'high'), 'high');
    const loreNormal = buildLorePreview(state, getLoreTierMode(settings, 'normal'), 'normal');
    const loreLow = buildLorePreview(state, getLoreTierMode(settings, 'low'), 'low');
    updateCompressionTurnStatus(state, 'continuity');
    updateCompressionTurnStatus(state, 'lore-high');
    updateCompressionTurnStatus(state, 'lore-normal');
    updateCompressionTurnStatus(state, 'lore-low');

    const continuityPre = panelRoot?.querySelector('.saga-continuity-injection-preview');
    if (continuityPre) {
        continuityPre.textContent = getInjectionDisplayText('Continuity Injection', continuity, settings.injectContinuity !== false && settings.injectMemo !== false);
    }

    const loreHighPre = panelRoot?.querySelector('.saga-lore-high-injection-preview');
    if (loreHighPre) loreHighPre.textContent = getInjectionDisplayText('High-Relevance Lore Injection', loreHigh, settings.injectLore !== false && settings.loreHighInjectionEnabled !== false);
    const loreNormalPre = panelRoot?.querySelector('.saga-lore-normal-injection-preview');
    if (loreNormalPre) loreNormalPre.textContent = getInjectionDisplayText('Normal-Relevance Lore Injection', loreNormal, settings.injectLore !== false && settings.loreNormalInjectionEnabled !== false);
    const loreLowPre = panelRoot?.querySelector('.saga-lore-low-injection-preview');
    if (loreLowPre) loreLowPre.textContent = getInjectionDisplayText('Low-Relevance Lore Injection', loreLow, settings.injectLore !== false && settings.loreLowInjectionEnabled !== false);

    if (typeof globalThis.sagaSyncPromptInjection === 'function') {
        globalThis.sagaSyncPromptInjection();
    }
}

function updateCompressionTurnStatus(state, kind = 'lore') {
    if (!state) return;
    const parsed = parseLoreCompressionKind(kind);
    let status = null;
    if (parsed.base === 'continuity') status = state.continuityCompressionStatus;
    else if (parsed.tier) status = state.loreCompressionStatusByRelevance?.[parsed.tier];
    else status = state.loreCompressionStatus;
    if (!status?.lastCompressedAt) return;
    const chatLength = getChatLength();
    status.turnsSinceCompression = Math.max(0, chatLength - Number(status.lastChatLength || chatLength));
    saveState(state);
}

async function runModelCompression(kind = 'lore', btn = null) {
    const settings = getSettings();
    // Compression is a frequent transformation task, so it is routed through the
    // Utility provider. Internal key remains `continuity` for backward-compatible
    // settings storage; the UI presents this provider role as Utility.
    const providerKind = 'continuity';
    const validation = validateLoreProviderConfiguration(providerKind);
    if (!validation.ok) {
        toast(`${kind === 'continuity' ? 'Continuity' : 'Lore'} compression blocked: Utility provider unavailable: ${validation.message}`, 'error');
        return null;
    }

    const originalText = btn?.textContent || '';
    if (btn) {
        btn.disabled = true;
        const parsedKindForLabel = parseLoreCompressionKind(kind);
        btn.textContent = parsedKindForLabel.base === 'continuity' ? 'Compressing continuity...' : `Compressing ${parsedKindForLabel.tier || ''} lore...`;
    }

    try {
        const state = getState();
        const parsedKind = parseLoreCompressionKind(kind);
        const directText = parsedKind.base === 'continuity'
            ? buildContinuityPreview(state, 'direct')
            : parsedKind.tier
                ? buildLorePreview(state, 'direct', parsedKind.tier)
                : buildLorePreview(state, 'direct');

        if (!directText || !directText.trim()) {
            toast(`${parsedKind.base === 'continuity' ? 'Continuity' : 'Lore'} preview is empty; nothing to compress.`, 'warning');
            return null;
        }

        const level = parsedKind.base === 'continuity'
            ? Math.max(1, Math.min(5, Number(settings.continuityCompressionLevel) || 3))
            : parsedKind.tier
                ? getLoreTierLevel(settings, parsedKind.tier)
                : Math.max(1, Math.min(5, Number(settings.loreCompressionLevel) || 3));

        const context = JSON.stringify({
            sceneDate: state?.loreContext?.sceneDate || state?.canon?.inUniverseDate || '',
            canonBoundary: state?.loreContext?.canonBoundary || state?.canon?.canonBoundary || '',
            branchId: state?.loreContext?.branchId || 'main',
            scene: state?.scene || {},
        }, null, 2);

        const budget = estimateTokenBudgetForCompression(directText, level);
        const compressionPrompt = buildCompressionPrompt(kind, level, context, directText, budget);
        const compressed = await sendLoreRequest(
            'You are Saga Compression. Compress the source into a shorter visible plain-text injection block. Output only that block. Do not use markdown fences, JSON, reasoning, or commentary.',
            compressionPrompt,
            {
                providerKind,
                maxTokens: Math.max(512, Math.min(8192, Math.ceil(budget.hardTokenLimit * 3))),
                prefill: '',
                expectedOutput: 'text',
                task: 'compression',
            }
        );

        let cleaned = cleanCompressedText(compressed);
        let validationResult = validateCompressedText(cleaned, directText, budget, level);
        if (!validationResult.ok && shouldRetryCompression(validationResult, directText, level)) {
            const retryPrompt = buildCompressionRetryPrompt(kind, level, context, directText, cleaned, budget, validationResult.message);
            const retry = await sendLoreRequest(
                'You are Saga Compression. Your previous visible output was too long or insufficiently compressed. Output only the corrected shorter plain-text injection block. No markdown, JSON, reasoning, or commentary.',
                retryPrompt,
                {
                    providerKind,
                    maxTokens: Math.max(512, Math.min(8192, Math.ceil(budget.hardTokenLimit * 3))),
                    prefill: '',
                    expectedOutput: 'text',
                    task: 'compression',
                }
            );
            cleaned = cleanCompressedText(retry);
            validationResult = validateCompressedText(cleaned, directText, budget, level);
        }

        if (!validationResult.ok) {
            throw new Error(validationResult.message);
        }

        const freshState = getState();
        let statusKey = parsedKind.base === 'continuity' ? 'continuityCompressionStatus' : 'loreCompressionStatus';
        let statusTarget = null;
        if (parsedKind.base === 'continuity') {
            if (!freshState.continuityCompressionStatus) freshState.continuityCompressionStatus = {};
            statusTarget = freshState.continuityCompressionStatus;
        } else if (parsedKind.tier) {
            if (!freshState.loreCompressionStatusByRelevance) freshState.loreCompressionStatusByRelevance = {};
            if (!freshState.loreCompressionStatusByRelevance[parsedKind.tier]) freshState.loreCompressionStatusByRelevance[parsedKind.tier] = {};
            statusTarget = freshState.loreCompressionStatusByRelevance[parsedKind.tier];
            statusKey = `loreCompressionStatusByRelevance.${parsedKind.tier}`;
        } else {
            if (!freshState.loreCompressionStatus) freshState.loreCompressionStatus = {};
            statusTarget = freshState.loreCompressionStatus;
        }
        const compressedTokens = estimateTokens(cleaned);
        const nextStatus = {
            ...statusTarget,
            lastCompressedAt: Date.now(),
            lastSignature: getCompressionSourceSignature(freshState, kind, directText, settings),
            lastMode: 'compressed',
            lastTokenEstimate: compressedTokens,
            lastCharacterCount: cleaned.length,
            lastDirectTokenEstimate: budget.directTokens,
            lastDirectCharacterCount: budget.directCharacters,
            lastTargetTokenEstimate: budget.targetTokens,
            lastTargetCharacterCount: budget.targetCharacters,
            lastHardTokenLimit: budget.hardTokenLimit,
            lastHardCharacterLimit: budget.hardCharacterLimit,
            lastCompressionRatio: budget.directCharacters ? Number((cleaned.length / budget.directCharacters).toFixed(3)) : 0,
            turnsSinceCompression: 0,
            lastChatLength: getChatLength(),
            cachedText: cleaned,
            lastError: '',
        };
        if (parsedKind.base === 'continuity') freshState.continuityCompressionStatus = nextStatus;
        else if (parsedKind.tier) freshState.loreCompressionStatusByRelevance[parsedKind.tier] = nextStatus;
        else freshState.loreCompressionStatus = nextStatus;
        saveState(freshState);
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        toast(`${parsedKind.base === 'continuity' ? 'Continuity' : parsedKind.tier ? `${RELEVANCE_META[parsedKind.tier]?.label || parsedKind.tier} lore` : 'Lore'} compression updated: ${compressedTokens} tokens / ${cleaned.length} chars from ${budget.directTokens} tokens / ${budget.directCharacters} chars.`);
        return cleaned;
    } catch (e) {
        const freshState = getState();
        const parsedKind = parseLoreCompressionKind(kind);
        let status = parsedKind.base === 'continuity' ? freshState.continuityCompressionStatus : parsedKind.tier ? freshState.loreCompressionStatusByRelevance?.[parsedKind.tier] : freshState.loreCompressionStatus;
        if (status) {
            status.lastError = e?.message || String(e);
            saveState(freshState);
        }
        toast(`${kind === 'continuity' ? 'Continuity' : 'Lore'} compression failed: ${e?.message || e}`, 'error');
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        return null;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}


function validateCompressedText(cleaned, directText, budget, level) {
    const text = String(cleaned || '').trim();
    if (!text) return { ok: false, message: 'Compression returned empty visible text.' };
    const source = String(directText || '');
    const sourceChars = source.length;
    const outputChars = text.length;
    const outputTokens = estimateTokens(text);
    if (sourceChars >= 900 && outputChars > budget.hardCharacterLimit) {
        return { ok: false, message: `Compressed output is too long: ${outputChars} chars; hard limit is ${budget.hardCharacterLimit} chars.` };
    }
    if (budget.directTokens >= 220 && outputTokens > Math.ceil(budget.hardTokenLimit * 1.1)) {
        return { ok: false, message: `Compressed output is too long: ~${outputTokens} tokens; hard limit is ~${budget.hardTokenLimit} tokens.` };
    }
    if (level >= 3 && sourceChars >= 1200 && outputChars > Math.ceil(sourceChars * 0.72)) {
        return { ok: false, message: `Compression level ${level} did not significantly reduce the source: ${outputChars} chars from ${sourceChars} chars.` };
    }
    if (level >= 4 && sourceChars >= 1200 && outputChars > Math.ceil(sourceChars * 0.55)) {
        return { ok: false, message: `Compression level ${level} did not meet heavy-reduction expectations: ${outputChars} chars from ${sourceChars} chars.` };
    }
    return { ok: true, message: '' };
}

function shouldRetryCompression(result, directText, level) {
    if (result?.ok) return false;
    const sourceChars = String(directText || '').length;
    return sourceChars >= 600 || level >= 3;
}

function buildCompressionRetryPrompt(kind, level, context, directText, previousOutput, budget, reason) {
    const parsedKind = parseLoreCompressionKind(kind);
    const kindLabel = parsedKind.base === 'continuity' ? 'Continuity State' : parsedKind.tier ? `${RELEVANCE_META[parsedKind.tier]?.label || parsedKind.tier} Relevance Lorecards` : 'Lorecards';
    return `Compress the Saga ${kindLabel} injection again. The previous output failed validation: ${reason}

Required visible-output limits:
- Source: about ${budget.directTokens} tokens / ${budget.directCharacters} characters.
- Target: <= ${budget.targetTokens} tokens / <= ${budget.targetCharacters} characters.
- Hard maximum: <= ${budget.hardTokenLimit} tokens / <= ${budget.hardCharacterLimit} characters.
- Compression level ${level}: ${budget.profile.description}.

Context:
${context}

Previous too-long output:
${previousOutput || '(empty)'}

Direct injection block to compress:
${directText}

Output only the corrected compressed injection text. No markdown fences, JSON, reasoning, or commentary.`;
}

function buildCompressionPrompt(kind, level, context, directText, budget = null) {
    const settings = getSettings();
    const parsedKind = parseLoreCompressionKind(kind);
    const kindLabel = parsedKind.base === 'continuity' ? 'Continuity State' : parsedKind.tier ? `${RELEVANCE_META[parsedKind.tier]?.label || parsedKind.tier} Relevance Lorecards` : 'Lorecards';
    const computedBudget = budget || estimateTokenBudgetForCompression(directText, level);
    const templateKey = parsedKind.base === 'continuity' ? 'continuityCompressionPromptTemplate' : 'loreCompressionPromptTemplate';
    const fallbackTemplate = parsedKind.base === 'continuity'
        ? DEFAULT_SETTINGS.continuityCompressionPromptTemplate
        : DEFAULT_SETTINGS.loreCompressionPromptTemplate;
    const template = String(settings[templateKey] || fallbackTemplate || '');
    const vars = {
        kind: kindLabel,
        compressionLevel: String(level),
        compressionLabel: computedBudget.profile.description,
        directTokens: String(computedBudget.directTokens),
        targetTokens: String(computedBudget.targetTokens),
        hardTokenLimit: String(computedBudget.hardTokenLimit),
        directCharacters: String(computedBudget.directCharacters),
        targetCharacters: String(computedBudget.targetCharacters),
        hardCharacterLimit: String(computedBudget.hardCharacterLimit),
        storyContext: context,
        directText,
    };
    const rendered = template.replace(/{{\s*(\w+)\s*}}/g, (_, key) => Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '');
    if (/{{\s*(targetCharacters|hardCharacterLimit|directCharacters)\s*}}/i.test(template)) return rendered;
    // Preserve older/custom advanced templates, but append the dynamic length
    // contract that prevents level 3+ compression from becoming a same-size rewrite.
    return `${rendered}

Compression length contract:
- Source length: about ${vars.directTokens} tokens / ${vars.directCharacters} characters.
- Target length: <= ${vars.targetTokens} tokens / <= ${vars.targetCharacters} characters.
- Hard maximum visible output: <= ${vars.hardTokenLimit} tokens / <= ${vars.hardCharacterLimit} characters.
- If information must be sacrificed, preserve active continuity constraints, secrets, knowledge boundaries, pinned/protected details, and current-scene hazards first.
- Output only the compressed injection text.`;
}


function cleanCompressedText(text) {
    let cleaned = String(text || '')
        .replace(/```(?:text|markdown)?\s*([\s\S]*?)```/i, '$1')
        .trim();
    if (/^\{[\s\S]*\}$/.test(cleaned)) {
        try {
            const parsed = JSON.parse(cleaned);
            cleaned = String(parsed.compressedText || parsed.compressed || parsed.text || parsed.content || parsed.message || cleaned).trim();
        } catch (_) {}
    }
    return cleaned;
}

function parseLoreCompressionKind(kind = 'lore') {
    const raw = String(kind || 'lore').toLowerCase().replace(/_/g, '-');
    if (raw === 'continuity') return { base: 'continuity', tier: '' };
    if (raw.includes('high')) return { base: 'lore', tier: 'high' };
    if (raw.includes('normal')) return { base: 'lore', tier: 'normal' };
    if (raw.includes('low')) return { base: 'lore', tier: 'low' };
    return { base: 'lore', tier: '' };
}
function capTier(tier) { return tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : ''; }
function tierSettingKey(tier, suffix) { return tier ? `lore${capTier(tier)}${suffix}` : `lore${suffix}`; }
function getCompressionStatusObjectForKind(state, kind = 'lore') {
    const parsed = parseLoreCompressionKind(kind);
    if (parsed.base === 'continuity') return state?.continuityCompressionStatus || {};
    if (parsed.tier) return state?.loreCompressionStatusByRelevance?.[parsed.tier] || {};
    return state?.loreCompressionStatus || {};
}
function getCompressionStatusKeyForKind(kind = 'lore') {
    const parsed = parseLoreCompressionKind(kind);
    if (parsed.base === 'continuity') return 'continuityCompressionStatus';
    if (parsed.tier) return `loreCompressionStatusByRelevance.${parsed.tier}`;
    return 'loreCompressionStatus';
}
function getLoreTierMode(settings, tier) { return settings[tierSettingKey(tier, 'InjectionMode')] || (tier === 'high' ? 'direct' : 'compressed'); }
function getLoreTierLevel(settings, tier) { return Math.max(1, Math.min(5, Number(settings[tierSettingKey(tier, 'CompressionLevel')]) || 3)); }

function getCompressionStatusTextForKind(state, kind = 'lore') {
    const settings = getSettings();
    const parsed = parseLoreCompressionKind(kind);
    if (parsed.base === 'continuity') return getContinuityCompressionStatusText(state);
    if (parsed.tier && getLoreTierMode(settings, parsed.tier) !== 'compressed') return 'Direct mode active; compression not used.';
    if (!parsed.tier && (settings.loreInjectionMode || 'direct') !== 'compressed') return 'Direct mode active; compression not used.';
    const status = getCompressionStatusObjectForKind(state, kind);
    const direct = parsed.tier ? buildLorePreview(state, 'direct', parsed.tier) : buildLorePreview(state, 'direct');
    const currentSignature = getCompressionSourceSignature(state, kind, direct);
    if (status.lastSignature !== currentSignature) {
        return status.lastError ? `cached compression is stale; last error: ${status.lastError}` : 'Cached compression is missing or stale. Click Compress Now.';
    }
    if (status.lastError) return `last compression failed: ${status.lastError}`;
    if (!status.lastCompressedAt) return 'No cached model compression yet. Click Compress Now.';
    const when = new Date(status.lastCompressedAt).toLocaleTimeString();
    return `model-compressed ${when}; ${status.turnsSinceCompression || 0} turns since; ~${status.lastTokenEstimate || 0} tokens / ${status.lastCharacterCount || 0} chars${status.lastCompressionRatio ? `; ratio ${Math.round(status.lastCompressionRatio * 100)}%` : ''}`;
}

function getCompressionStatusText(state) {
    const settings = getSettings();
    const status = state?.loreCompressionStatus || {};
    if ((settings.loreInjectionMode || 'direct') !== 'compressed') {
        return 'Direct mode active; compression not used.';
    }
    const currentSignature = getCompressionSourceSignature(state, 'lore', buildLorePreview(state, 'direct'));
    if (status.lastSignature !== currentSignature) {
        return status.lastError ? `cached compression is stale; last error: ${status.lastError}` : 'Cached compression is missing or stale. Click Compress Lore Now.';
    }
    if (status.lastError) {
        return `last compression failed: ${status.lastError}`;
    }
    if (!status.lastCompressedAt) {
        return 'No cached model compression yet. Click Compress Lore Now.';
    }
    const when = new Date(status.lastCompressedAt).toLocaleTimeString();
    return `model-compressed ${when}; ${status.turnsSinceCompression || 0} turns since; ~${status.lastTokenEstimate || 0} tokens / ${status.lastCharacterCount || 0} chars${status.lastTargetTokenEstimate ? ` (target ${status.lastTargetTokenEstimate} tokens / ${status.lastTargetCharacterCount || '?'} chars)` : ''}${status.lastCompressionRatio ? `; ratio ${Math.round(status.lastCompressionRatio * 100)}%` : ''}`;
}

function getContinuityCompressionStatusText(state) {
    const settings = getSettings();
    const status = state?.continuityCompressionStatus || {};
    if ((settings.continuityInjectionMode || 'direct') !== 'compressed') {
        return 'Direct mode active; continuity compression not used.';
    }
    const currentSignature = getCompressionSourceSignature(state, 'continuity', buildContinuityPreview(state, 'direct'));
    if (status.lastSignature !== currentSignature) {
        return status.lastError ? `cached compression is stale; last error: ${status.lastError}` : 'Cached compression is missing or stale. Click Compress Continuity Now.';
    }
    if (status.lastError) {
        return `last compression failed: ${status.lastError}`;
    }
    if (!status.lastCompressedAt) {
        return 'No cached model compression yet. Click Compress Continuity Now.';
    }
    const when = new Date(status.lastCompressedAt).toLocaleTimeString();
    return `model-compressed ${when}; ${status.turnsSinceCompression || 0} turns since; ~${status.lastTokenEstimate || 0} tokens / ${status.lastCharacterCount || 0} chars${status.lastTargetTokenEstimate ? ` (target ${status.lastTargetTokenEstimate} tokens / ${status.lastTargetCharacterCount || '?'} chars)` : ''}${status.lastCompressionRatio ? `; ratio ${Math.round(status.lastCompressionRatio * 100)}%` : ''}`;
}

function getChatLength() {
    try {
        const ctx = SillyTavern.getContext();
        return Array.isArray(ctx?.chat) ? ctx.chat.length : 0;
    } catch (_) {
        return 0;
    }
}

function hasValidModelCompression(kind = 'lore') {
    const state = getState();
    const statusKey = kind === 'continuity' ? 'continuityCompressionStatus' : 'loreCompressionStatus';
    const status = state?.[statusKey] || {};
    const signature = getCompressionSourceSignature(state, kind, kind === 'continuity' ? buildContinuityPreview(state, 'direct') : buildLorePreview(state, 'direct'));
    return status.lastSignature === signature && typeof status.cachedText === 'string' && status.cachedText.trim();
}

function hasAnyModelCompression(kind = 'lore') {
    const state = getState();
    const statusKey = kind === 'continuity' ? 'continuityCompressionStatus' : 'loreCompressionStatus';
    const status = state?.[statusKey] || {};
    return typeof status.cachedText === 'string' && status.cachedText.trim() && status.lastCompressedAt;
}

function hasCompressibleText(text) {
    const clean = String(text || '')
        .replace(/Direct mode active;[^\n]*/gi, '')
        .replace(/No accepted active lore entries[^\n]*/gi, '')
        .replace(/No continuity state[^\n]*/gi, '')
        .trim();
    return clean.length > 80;
}

function createInjectionModeButton(mode, label, tooltip, settings) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'saga-mode-button';
    if ((settings.loreInjectionMode || 'direct') === mode) btn.classList.add('saga-mode-button-active');
    btn.textContent = label;
    addTooltip(btn, tooltip);
    btn.addEventListener('click', async () => {
        const next = getSettings();
        next.loreInjectionMode = mode;
        saveSettings(next);
        if (mode === 'compressed' && !hasValidModelCompression('lore')) {
            const directText = buildLorePreview(getState(), 'direct');
            if (!hasCompressibleText(directText)) {
                toast('Lore compressed mode selected, but there is no accepted lore to compress yet. Generate/accept lore entries first, then use Compress Lore Now.', 'warning');
            } else if (hasAnyModelCompression('lore')) {
                toast('Lore compressed mode selected. Existing compressed cache is stale for the current source/settings; using direct preview until you click Compress Lore Now.', 'warning');
            } else {
                toast('Lore compressed mode selected. No cached compression exists yet; using direct preview until you click Compress Lore Now.', 'warning');
            }
        }
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
    });
    return btn;
}

function createContinuityModeButton(mode, label, tooltip, settings) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'saga-mode-button';
    if ((settings.continuityInjectionMode || 'direct') === mode) btn.classList.add('saga-mode-button-active');
    btn.textContent = label;
    addTooltip(btn, tooltip);
    btn.addEventListener('click', async () => {
        const next = getSettings();
        next.continuityInjectionMode = mode;
        saveSettings(next);
        if (mode === 'compressed' && !hasValidModelCompression('continuity')) {
            const directText = buildContinuityPreview(getState(), 'direct');
            if (!hasCompressibleText(directText)) {
                toast('Continuity compressed mode selected, but there is no continuity state to compress yet. Run Scan Continuity State first, then use Compress Continuity Now.', 'warning');
            } else if (hasAnyModelCompression('continuity')) {
                toast('Continuity compressed mode selected. Existing compressed cache is stale for the current source/settings; using direct preview until you click Compress Continuity Now.', 'warning');
            } else {
                toast('Continuity compressed mode selected. No cached compression exists yet; using direct preview until you click Compress Continuity Now.', 'warning');
            }
        }
        refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });
        refreshHeader();
    });
    return btn;
}


// Accepted lore bulk selection and editing --------------------------------------

function refreshAcceptedLoreBulkToolbar() {
    if (!panelRoot) return;
    const mount = panelRoot.querySelector('.saga-lore-bulk-toolbar');
    if (!mount) return;
    mount.replaceChildren(createAcceptedLoreBulkControls(getState()));
}

let acceptedLoreLayoutFrame = 0;

function scheduleAcceptedLoreLayoutUpdate() {
    if (acceptedLoreLayoutFrame) cancelAnimationFrame(acceptedLoreLayoutFrame);
    acceptedLoreLayoutFrame = requestAnimationFrame(() => {
        acceptedLoreLayoutFrame = requestAnimationFrame(() => {
            acceptedLoreLayoutFrame = 0;
            updateAcceptedLoreScrollRegionHeight();
        });
    });
}

function updateAcceptedLoreScrollRegionHeight() {
    if (!panelRoot) return;
    const drawer = panelRoot.querySelector('.saga-runtime-drawer');
    if (!drawer) return;

    updateDrawerScrollMetrics(drawer);

    const list = drawer.querySelector('.saga-accepted-lore-scroll-region');
    if (!list) return;

    const acceptedSection = list.closest('.saga-accepted-lore-section');
    const acceptedDetails = list.closest('.saga-lore-accepted-collapsible');
    const content = acceptedDetails?.querySelector(':scope > .saga-collapsible-content');

    // Earlier layout code made the accepted-lore section stretch to the bottom of
    // the drawer. That works for a fixed Lorecards tab, but it clips later sections
    // when every Lore section is expanded. The drawer tab is now the outer
    // scroller; accepted lore remains a bounded nested scroller. Clear any stale
    // inline sizing before applying the bounded-scroll CSS variables.
    for (const el of [acceptedDetails, content, acceptedSection, list]) {
        if (!el) continue;
        el.style.removeProperty('height');
        el.style.removeProperty('flex');
        el.style.removeProperty('max-height');
    }

    list.style.setProperty('overflow-y', 'auto');
    list.style.setProperty('overscroll-behavior', 'contain');
}

if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        clampRuntimeShellToViewport();
        scheduleAcceptedLoreLayoutUpdate();
    });
}

const RELEVANCE_META = {
    high: { label: 'High', color: '#166534', textColor: '#dcfce7', tooltip: 'Current-scene or immediate story relevance. Injects in the High-Relevance lore group.' },
    normal: { label: 'Normal', color: '#1e3a8a', textColor: '#dbeafe', tooltip: 'Recent, branch-defining, or medium-range story relevance. Injects in the Normal-Relevance lore group.' },
    low: { label: 'Low', color: '#4b5563', textColor: '#f9fafb', tooltip: 'Long-term background or distant past/future lore. Injects in the Low-Relevance lore group if enabled.' },
};
const LIFECYCLE_META = RELEVANCE_META;

function getLifecycleStatus(entry) {
    return normalizeLoreRelevance(entry.relevance || entry.lifecycleStatus || entry.lifecycle?.status || entry.lifecycle?.computedStatus || 'normal');
}

function scheduleStateSave(state, delay = MINOR_STATE_SAVE_DEBOUNCE_MS) {
    deferredStateSaveRef = state || deferredStateSaveRef;
    if (deferredStateSaveTimer) clearTimeout(deferredStateSaveTimer);
    deferredStateSaveTimer = setTimeout(() => {
        if (deferredStateSaveRef) saveState(deferredStateSaveRef);
        deferredStateSaveRef = null;
        deferredStateSaveTimer = null;
    }, delay);
}

function flushScheduledStateSave() {
    if (deferredStateSaveTimer) clearTimeout(deferredStateSaveTimer);
    if (deferredStateSaveRef) saveState(deferredStateSaveRef);
    deferredStateSaveRef = null;
    deferredStateSaveTimer = null;
}

// Mutations -------------------------------------------------------------------

function setAutomationMode(mode) {
    const normalized = normalizeAutomationMode(mode);
    const settings = getSettings();
    settings.automationMode = normalized;
    settings.workflowMode = normalized;
    Object.assign(settings, AUTOMATION_MODES[normalized].settings);
    saveSettings(settings);
}

function setExperienceMode(mode) {
    const settings = getSettings();
    const result = applyExperienceModeSettings(settings, mode);
    if (!result.changed) return;

    saveSettings(settings);
    const state = getState();
    if (state?.lorePanel) {
        normalizePanelLayoutState(state);
        state.lorePanel.activeTab = normalizeTabForExperience(state.lorePanel.activeTab, settings);
        saveState(state);
    }
}

function setPanelState(patch, options = {}) {
    const state = getState();
    if (!state?.lorePanel) return;
    Object.assign(state.lorePanel, patch || {});
    if (options.deferSave) scheduleStateSave(state);
    else saveState(state);
}

export function resetLorePanelLayout(options = {}) {
    resetRuntimePanelLayout(options);
}

function refreshPanelBody(options = {}) {
    if (!panelRoot) return;
    const stateForShell = getState();
    normalizePanelLayoutState(stateForShell);
    const body = panelRoot.querySelector('.saga-lore-panel-body');
    if (!body) {
        if (stateForShell?.lorePanel?.drawerOpen === true) renderPanelShell(panelRoot, stateForShell);
        else refreshHeader();
        return;
    }

    const activeNestedScroll = getActiveNestedScrollElement();
    const nestedScrollTop = options.preserveScroll && activeNestedScroll ? activeNestedScroll.scrollTop : 0;
    const tabScroll = getActiveTabScrollElement();
    const tabScrollTop = options.preserveScroll && tabScroll ? tabScroll.scrollTop : 0;
    const drawer = panelRoot.querySelector('.saga-runtime-drawer');
    const drawerScrollTop = options.preserveScroll && drawer ? (drawer.scrollTop || 0) : 0;
    const pageScrollElement = typeof document !== 'undefined' ? document.scrollingElement || document.documentElement : null;
    const pageScrollTop = (options.preserveScroll || options.preserveWindowScroll) && pageScrollElement
        ? pageScrollElement.scrollTop
        : null;
    const pageScrollLeft = (options.preserveScroll || options.preserveWindowScroll) && pageScrollElement
        ? pageScrollElement.scrollLeft
        : null;

    const state = stateForShell;
    renderPanelBody(body, state);
    refreshHeader();

    if (options.preserveScroll) {
        const newTabScroll = getActiveTabScrollElement();
        if (newTabScroll) newTabScroll.scrollTop = tabScrollTop;
        const newNestedScroll = getActiveNestedScrollElement();
        if (newNestedScroll) newNestedScroll.scrollTop = nestedScrollTop;
        if (drawer) drawer.scrollTop = drawerScrollTop;
    }
    updateDrawerScrollMetrics(drawer);

    if ((options.preserveScroll || options.preserveWindowScroll) && pageScrollElement && pageScrollTop !== null) {
        const restorePageScroll = () => {
            pageScrollElement.scrollTop = pageScrollTop;
            pageScrollElement.scrollLeft = pageScrollLeft || 0;
        };
        restorePageScroll();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restorePageScroll);
    }
}
