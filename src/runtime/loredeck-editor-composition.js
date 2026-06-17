import { configureGeneratedLoredeckExportCard } from './loredeck-generated-export-card.js';
import { configureGeneratedLoredeckReadiness } from './loredeck-generated-readiness.js';
import { configureLoredeckAssistantReviewPanel } from './loredeck-assistant-review-panel.js';
import { configureLoredeckEditProposals } from './loredeck-edit-proposals.js';
import { configureLoredeckEditorActions } from './loredeck-editor-actions.js';
import { configureLoredeckEditorLoader } from './loredeck-editor-loader.js';
import { configureLoredeckEditorValidation } from './loredeck-editor-validation.js';
import { configureLoredeckEntryOverridesPanel } from './loredeck-entry-overrides-panel.js';
import { configureLoredeckManifestPreview } from './loredeck-manifest-preview.js';
import { configureLoredeckPackageExport } from './loredeck-package-export.js';
import { configureLoredeckPackageInstallPanel } from './loredeck-package-install-panel.js';
import { configureLoredeckPendingChangeActions } from './loredeck-pending-change-actions.js';
import { configureLoredeckPendingChangeModel } from './loredeck-pending-change-model.js';
import { configureLoredeckPendingReviewPanel } from './loredeck-pending-review-panel.js';
import { configureLoredeckReviewHelpers } from './loredeck-review-helpers.js';
import { configureLoredeckTagManagerPanel } from './loredeck-tag-manager-panel.js';
import { configureLoredeckTimelineRegistryPanel } from './loredeck-timeline-registry-panel.js';

export function configureLoredeckEditorComposition(deps = {}) {
    const previewCache = deps.loredeckPreviewCacheController || {};
    const assistantDraftCache = deps.loredeckAssistantDraftCacheController || {};

    const getManifestPreview = packId => previewCache.getManifestPreview?.(packId);
    const setManifestPreview = (packId, record) => previewCache.setManifestPreview?.(packId, record);
    const deleteManifestPreview = packId => previewCache.deleteManifestPreview?.(packId);
    const getEntryPreview = packId => previewCache.getEntryPreview?.(packId);
    const setEntryPreview = (packId, record) => previewCache.setEntryPreview?.(packId, record);
    const deleteEntryPreview = packId => previewCache.deleteEntryPreview?.(packId);
    const getTimelineRegistry = packId => previewCache.getTimelineRegistry?.(packId);
    const setTimelineRegistry = (packId, record) => previewCache.setTimelineRegistry?.(packId, record);
    const deleteTimelineRegistry = packId => previewCache.deleteTimelineRegistry?.(packId);
    const getTagRegistry = packId => previewCache.getTagRegistry?.(packId);
    const setTagRegistry = (packId, record) => previewCache.setTagRegistry?.(packId, record);
    const deleteTagRegistry = packId => previewCache.deleteTagRegistry?.(packId);

    configureLoredeckEditorActions({
        getState: deps.getState,
        getLoredeckLibrary: deps.getLoredeckLibrary,
        getLoredeckDefinition: deps.getLoredeckDefinition,
        getFreshLoredeckLibraryPack: deps.getFreshLoredeckLibraryPack,
        upsertLoredeckLibraryPack: deps.upsertLoredeckLibraryPack,
        validateLoredeckForEditor: deps.validateLoredeckForEditor,
        getExpectedLoredeckEntrySchemaVersion: deps.getExpectedLoredeckEntrySchemaVersion,
        getLoredeckPendingChanges: deps.getLoredeckPendingChanges,
        normalizeLoredeckTagRegistry: deps.normalizeLoredeckTagRegistry,
        normalizeLoredeckTimelineRegistry: deps.normalizeLoredeckTimelineRegistry,
        clearCanonLoreDatabaseCache: deps.clearCanonLoreDatabaseCache,
        clearContextIndexCache: deps.clearContextIndexCache,
        refreshLoredeckSurfaces: deps.refreshLoredeckSurfaces,
        toast: deps.toast,
        downloadBytes: deps.downloadBytes,
        selectLoredeckForDetails: deps.selectLoredeckForDetails,
        confirmAction: deps.confirmAction,
        createStateBackup: deps.createStateBackup,
        getLoredeckCreatorJobForPack: deps.getLoredeckCreatorJobForPack,
        buildLoredeckCreatorCoverageFinalizationProvenance: deps.buildLoredeckCreatorCoverageFinalizationProvenance,
        retireGeneratedLoredeckAfterFinalization: deps.retireGeneratedLoredeckAfterFinalization,
        openLoredeckMetadataEditor: deps.openLoredeckMetadataEditor,
        isLoredeckLibraryOpen: deps.isLoredeckLibraryOpen,
        renderLoredeckLibraryOverlay: deps.renderLoredeckLibraryOverlay,
        addLoredeckToStack: deps.addLoredeckToStack,
        setLoredeckManifestPreviewCacheRecord: setManifestPreview,
        deleteLoredeckManifestPreviewCacheRecord: deleteManifestPreview,
        deleteLoredeckEntryPreviewCacheRecord: deleteEntryPreview,
        deleteLoredeckTimelineRegistryCacheRecord: deleteTimelineRegistry,
        deleteLoredeckTagRegistryCacheRecord: deleteTagRegistry,
    });

    configureLoredeckEntryOverridesPanel({
        getLoredeckOverrideState: deps.getLoredeckOverrideState,
        getLoredeckEntryPreviewCacheRecord: getEntryPreview,
        getLoredeckEditableEntryRows: deps.getLoredeckEditableEntryRows,
        filterLoredeckEditableEntryRows: deps.filterLoredeckEditableEntryRows,
        getLoredeckEntryOverrideQuery: deps.getLoredeckEntryOverrideQuery,
        setLoredeckEntryOverrideQuery: deps.setLoredeckEntryOverrideQuery,
        refreshPanelBody: deps.refreshPanelBody,
        loadLoredeckEntriesForEditor: deps.loadLoredeckEntriesForEditor,
        canValidateLoredeckInEditor: deps.canValidateLoredeckInEditor,
        openLoredeckEntryOverrideDialog: deps.openLoredeckEntryOverrideDialog,
        openLoredeckBulkTagsDialog: deps.openLoredeckBulkTagsDialog,
        openLoredeckBulkContextDialog: deps.openLoredeckBulkContextDialog,
        attemptLoredeckHealthFixes: deps.attemptLoredeckHealthFixes,
        createLoredeckPendingReviewCard: deps.createLoredeckPendingReviewCard,
        createLoredeckAssistantCard: deps.createLoredeckAssistantCard,
        createLoredeckTimelineRegistryCard: deps.createLoredeckTimelineRegistryCard,
        createLoredeckTagManagerCard: deps.createLoredeckTagManagerCard,
        setLoredeckEntryDisabled: deps.setLoredeckEntryDisabled,
        removeLoredeckEntryOverride: deps.removeLoredeckEntryOverride,
    });

    configureLoredeckTimelineRegistryPanel({
        getLoredeckTimelineRegistryCacheRecord: getTimelineRegistry,
        getLoredeckEmbeddedTimelineRegistry: deps.getLoredeckEmbeddedTimelineRegistry,
        buildLoredeckTimelineRegistryItems: deps.buildLoredeckTimelineRegistryItems,
        buildMergedLoredeckTimelineRegistryForExport: deps.buildMergedLoredeckTimelineRegistryForExport,
        getLoredeckTimelineRegistryCount: deps.getLoredeckTimelineRegistryCount,
        getLoredeckTimelineRegistryQuery: deps.getLoredeckTimelineRegistryQuery,
        setLoredeckTimelineRegistryQuery: deps.setLoredeckTimelineRegistryQuery,
        setLoredeckEntryOverrideQuery: deps.setLoredeckEntryOverrideQuery,
        refreshPanelBody: deps.refreshPanelBody,
        loadLoredeckTimelineRegistryForEditor: deps.loadLoredeckTimelineRegistryForEditor,
        openLoredeckTimelineAnchorDialog: deps.openLoredeckTimelineAnchorDialog,
        openLoredeckTimelineWindowDialog: deps.openLoredeckTimelineWindowDialog,
        setLoredeckTimelineItemDisabled: deps.setLoredeckTimelineItemDisabled,
        removeLoredeckTimelineDefinition: deps.removeLoredeckTimelineDefinition,
        downloadJson: deps.downloadJson,
        sanitizeFileStem: deps.sanitizeFileStem,
        toast: deps.toast,
    });

    configureLoredeckTagManagerPanel({
        getLoredeckTagRegistryCacheRecord: getTagRegistry,
        getLoredeckEmbeddedTagRegistry: deps.getLoredeckEmbeddedTagRegistry,
        buildLoredeckTagManagerItems: deps.buildLoredeckTagManagerItems,
        buildMergedLoredeckTagRegistryForExport: deps.buildMergedLoredeckTagRegistryForExport,
        getLoredeckTagRegistryCount: deps.getLoredeckTagRegistryCount,
        getLoredeckEntryOverrideQuery: deps.getLoredeckEntryOverrideQuery,
        getLoredeckTagManagerQuery: deps.getLoredeckTagManagerQuery,
        setLoredeckTagManagerQuery: deps.setLoredeckTagManagerQuery,
        setLoredeckEntryOverrideQuery: deps.setLoredeckEntryOverrideQuery,
        getLoredeckEntryRowsForBulk: deps.getLoredeckEntryRowsForBulk,
        getLoredeckEntryTags: deps.getLoredeckEntryTags,
        humanizeLoredeckTagId: deps.humanizeLoredeckTagId,
        refreshPanelBody: deps.refreshPanelBody,
        loadLoredeckTagRegistryForEditor: deps.loadLoredeckTagRegistryForEditor,
        openLoredeckTagRegistryDialog: deps.openLoredeckTagRegistryDialog,
        openLoredeckTagRenameDialog: deps.openLoredeckTagRenameDialog,
        openLoredeckBulkTagsDialog: deps.openLoredeckBulkTagsDialog,
        removeLoredeckTagRegistryDefinition: deps.removeLoredeckTagRegistryDefinition,
        downloadJson: deps.downloadJson,
        sanitizeFileStem: deps.sanitizeFileStem,
        toast: deps.toast,
    });

    configureLoredeckPendingChangeModel({
        normalizeLoredeckTagId: deps.normalizeLoredeckTagId,
        normalizeLoredeckTimelineId: deps.normalizeLoredeckTimelineId,
        normalizeLoredeckTimelineDisabledIds: deps.normalizeLoredeckTimelineDisabledIds,
        normalizeLoredeckTagDefinition: deps.normalizeLoredeckTagDefinition,
        normalizeLoredeckTimelineAnchor: deps.normalizeLoredeckTimelineAnchor,
        normalizeLoredeckTimelineWindow: deps.normalizeLoredeckTimelineWindow,
        normalizeLoredeckPatchEntryOverride: deps.normalizeLoredeckPatchEntryOverride,
    });

    configureLoredeckReviewHelpers({
        getLoredeckEntryPreviewCacheRecord: getEntryPreview,
        parseLoredeckEntryTags: deps.parseLoredeckEntryTags,
        normalizeLoredeckPendingIdList: deps.normalizeLoredeckPendingIdList,
        normalizeLoredeckTagId: deps.normalizeLoredeckTagId,
        getLoredeckEmbeddedTagRegistry: deps.getLoredeckEmbeddedTagRegistry,
        getLoredeckCachedSourceTagRegistry: deps.getLoredeckCachedSourceTagRegistry,
        normalizeLoredeckTagDefinition: deps.normalizeLoredeckTagDefinition,
        normalizeLoredeckTimelineId: deps.normalizeLoredeckTimelineId,
        getLoredeckEmbeddedTimelineRegistry: deps.getLoredeckEmbeddedTimelineRegistry,
        getLoredeckCachedSourceTimelineRegistry: deps.getLoredeckCachedSourceTimelineRegistry,
        normalizeLoredeckTimelineAnchor: deps.normalizeLoredeckTimelineAnchor,
        normalizeLoredeckTimelineWindow: deps.normalizeLoredeckTimelineWindow,
        normalizeLoredeckTimelineDisabledIds: deps.normalizeLoredeckTimelineDisabledIds,
    });

    configureLoredeckPendingChangeActions({
        toast: deps.toast,
        persistLoredeckLibraryRecordMutation: deps.persistLoredeckLibraryRecordMutation,
        getFreshLoredeckLibraryPack: deps.getFreshLoredeckLibraryPack,
        canValidateLoredeckInEditor: deps.canValidateLoredeckInEditor,
        refreshLoredeckSurfaces: deps.refreshLoredeckSurfaces,
        isGeneratedLoredeckPack: deps.isGeneratedLoredeckPack,
        getAcceptedVirtualLoredeckEntries: deps.getAcceptedVirtualLoredeckEntries,
        validateLoredeckForEditor: deps.validateLoredeckForEditor,
        flushLoredeckStorageWrites: deps.flushLoredeckStorageWrites,
        clearCanonLoreDatabaseCache: deps.clearCanonLoreDatabaseCache,
        clearContextIndexCache: deps.clearContextIndexCache,
        normalizeLoredeckCreatorTitleId: deps.normalizeLoredeckCreatorTitleId,
        normalizeLoredeckCreatorTitleIdList: deps.normalizeLoredeckCreatorTitleIdList,
        refreshGeneratedLoredeckDerivedMetadata: deps.refreshGeneratedLoredeckDerivedMetadata,
        getLoredeckCreatorBriefCache: deps.getLoredeckCreatorBriefCache,
        setLoredeckCreatorBriefCache: deps.setLoredeckCreatorBriefCache,
        isLoredeckCreatorPlanningPendingChange: deps.isLoredeckCreatorPlanningPendingChange,
        refreshLoredeckCreatorWorkbenchBody: deps.refreshLoredeckCreatorWorkbenchBody,
        refreshHeader: deps.refreshHeader,
    });

    configureLoredeckEditProposals({
        toast: deps.toast,
        queueLoredeckPendingChange: deps.queueLoredeckPendingChange,
        createLoredeckRecordPatchChange: deps.createLoredeckRecordPatchChange,
        normalizeLoredeckTimelineId: deps.normalizeLoredeckTimelineId,
        normalizeLoredeckTimelineAnchor: deps.normalizeLoredeckTimelineAnchor,
        normalizeLoredeckTimelineWindow: deps.normalizeLoredeckTimelineWindow,
        normalizeLoredeckTagId: deps.normalizeLoredeckTagId,
        normalizeLoredeckTagDefinition: deps.normalizeLoredeckTagDefinition,
        parseLoredeckEntryTags: deps.parseLoredeckEntryTags,
        humanizeLoredeckTagId: deps.humanizeLoredeckTagId,
        getExpectedLoredeckEntrySchemaVersion: deps.getExpectedLoredeckEntrySchemaVersion,
        normalizeLoreEntry: deps.normalizeLoreEntry,
        normalizeLoredeckEntryForSchemaV3: deps.normalizeLoredeckEntryForSchemaV3,
        getLoredeckEntryTags: deps.getLoredeckEntryTags,
    });

    configureLoredeckPendingReviewPanel({
        getLoredeckPendingChanges: deps.getLoredeckPendingChanges,
        doesLoredeckPendingChangeAffectPackHealth: deps.doesLoredeckPendingChangeAffectPackHealth,
        isLoredeckHealthStatusStale: deps.isLoredeckHealthStatusStale,
        createLoredeckPendingHealthStalePill: deps.createLoredeckPendingHealthStalePill,
        createLoredeckPendingHealthImpactPill: deps.createLoredeckPendingHealthImpactPill,
        formatLoredeckPendingActionLabel: deps.formatLoredeckPendingActionLabel,
        formatLoredeckPendingTargetKindLabel: deps.formatLoredeckPendingTargetKindLabel,
        formatLoredeckPendingSourceLabel: deps.formatLoredeckPendingSourceLabel,
        getLoredeckPendingSourceTooltip: deps.getLoredeckPendingSourceTooltip,
        getLoredeckPendingConfidence: deps.getLoredeckPendingConfidence,
        getLoredeckPendingRisk: deps.getLoredeckPendingRisk,
        createLoredeckPendingRiskPill: deps.createLoredeckPendingRiskPill,
        appendLoredeckPendingQualityPills: deps.appendLoredeckPendingQualityPills,
        createLoredeckPendingDiffList: deps.createLoredeckPendingDiffList,
        createLoredeckPendingRepairCandidateList: deps.createLoredeckPendingRepairCandidateList,
        createLoredeckPendingQualityList: deps.createLoredeckPendingQualityList,
        createStateBackup: deps.createStateBackup,
        confirmAction: deps.confirmAction,
        runBusyAction: deps.runBusyAction,
        acceptLoredeckPendingChanges: deps.acceptLoredeckPendingChanges,
        rejectLoredeckPendingChanges: deps.rejectLoredeckPendingChanges,
        validateLoredeckForEditor: deps.validateLoredeckForEditor,
        canValidateLoredeckInEditor: deps.canValidateLoredeckInEditor,
        openLoredeckHealthCenter: deps.openLoredeckHealthCenter,
    });

    configureLoredeckAssistantReviewPanel({
        getLoredeckAssistantInstruction: deps.getLoredeckAssistantInstruction,
        setLoredeckAssistantInstruction: deps.setLoredeckAssistantInstruction,
        getLoredeckAssistantMode: deps.getLoredeckAssistantMode,
        setLoredeckAssistantMode: deps.setLoredeckAssistantMode,
        getLoredeckAssistantTargetScope: deps.getLoredeckAssistantTargetScope,
        setLoredeckAssistantTargetScope: deps.setLoredeckAssistantTargetScope,
        getLoredeckAssistantRevisionInstruction: deps.getLoredeckAssistantRevisionInstruction,
        setLoredeckAssistantRevisionInstruction: deps.setLoredeckAssistantRevisionInstruction,
        getLoredeckAssistantTargetRows: deps.getLoredeckAssistantTargetRows,
        getLoredeckAssistantDraftCacheRecord: packId => assistantDraftCache.getRecord?.(packId),
        getLoredeckAssistantDraftChanges: deps.getLoredeckAssistantDraftChanges,
        getLoredeckAssistantSelectedDraftIds: deps.getLoredeckAssistantSelectedDraftIds,
        countLoredeckAssistantQualityWarningsForChanges: deps.countLoredeckAssistantQualityWarningsForChanges,
        humanizeScopeKey: deps.humanizeScopeKey,
        createNewLoreInput: deps.createNewLoreInput,
        createNewLoreSelect: deps.createNewLoreSelect,
        handleLoredeckAssistantDraft: deps.handleLoredeckAssistantDraft,
        handleLoredeckAssistantDraftRevision: deps.handleLoredeckAssistantDraftRevision,
        loadLoredeckEntriesForEditor: deps.loadLoredeckEntriesForEditor,
        canValidateLoredeckInEditor: deps.canValidateLoredeckInEditor,
        queueLoredeckAssistantDraftSelection: deps.queueLoredeckAssistantDraftSelection,
        dropLoredeckAssistantDraftSelection: deps.dropLoredeckAssistantDraftSelection,
        setLoredeckAssistantDraftSelectionBulk: deps.setLoredeckAssistantDraftSelectionBulk,
        setLoredeckAssistantDraftSelection: deps.setLoredeckAssistantDraftSelection,
        openLoredeckAssistantDraftJsonEditor: deps.openLoredeckAssistantDraftJsonEditor,
        formatLoredeckPendingActionLabel: deps.formatLoredeckPendingActionLabel,
        formatLoredeckPendingTargetKindLabel: deps.formatLoredeckPendingTargetKindLabel,
        getLoredeckPendingConfidence: deps.getLoredeckPendingConfidence,
        getLoredeckPendingRisk: deps.getLoredeckPendingRisk,
        createLoredeckPendingRiskPill: deps.createLoredeckPendingRiskPill,
        appendLoredeckPendingQualityPills: deps.appendLoredeckPendingQualityPills,
        doesLoredeckPendingChangeAffectPackHealth: deps.doesLoredeckPendingChangeAffectPackHealth,
        createLoredeckPendingHealthImpactPill: deps.createLoredeckPendingHealthImpactPill,
        createLoredeckPendingDiffList: deps.createLoredeckPendingDiffList,
        createLoredeckPendingQualityList: deps.createLoredeckPendingQualityList,
        markTourTarget: deps.markTourTarget,
    });

    configureLoredeckPackageExport({
        getFreshLoredeckLibraryPack: deps.getFreshLoredeckLibraryPack,
        resolveManifestUrlForFetch: deps.resolveManifestUrlForFetch,
    });

    configureLoredeckPackageInstallPanel({
        cacheLoredeckManifestPreviewRecord: setManifestPreview,
        cacheLoredeckEntryPreviewRecord: setEntryPreview,
        selectLoredeckForDetails: deps.selectLoredeckForDetails,
        refreshLoredeckSurfaces: deps.refreshLoredeckSurfaces,
    });

    configureLoredeckEditorLoader({
        getFreshLoredeckLibraryPack: deps.getFreshLoredeckLibraryPack,
        setLoredeckManifestPreviewCacheRecord: setManifestPreview,
        setLoredeckEntryPreviewCacheRecord: setEntryPreview,
        setLoredeckTimelineRegistryCacheRecord: setTimelineRegistry,
        setLoredeckTagRegistryCacheRecord: setTagRegistry,
        refreshPanelBody: deps.refreshPanelBody,
    });

    configureLoredeckEditorValidation({
        getFreshLoredeckLibraryPack: deps.getFreshLoredeckLibraryPack,
        getLoredeckManifestPreviewCacheRecord: getManifestPreview,
        getLoredeckEntryPreviewCacheRecord: getEntryPreview,
        setLoredeckManifestPreviewCacheRecord: setManifestPreview,
        setLoredeckEntryPreviewCacheRecord: setEntryPreview,
        setLoredeckTimelineRegistryCacheRecord: setTimelineRegistry,
        setLoredeckTagRegistryCacheRecord: setTagRegistry,
        refreshLoredeckSurfaces: deps.refreshLoredeckSurfaces,
    });

    configureLoredeckManifestPreview({
        getLoredeckManifestPreviewCacheRecord: getManifestPreview,
    });

    configureGeneratedLoredeckExportCard({
        getLoredeckManifestPreviewCacheRecord: getManifestPreview,
        getGeneratedLoredeckExportReadiness: deps.getGeneratedLoredeckExportReadiness,
    });

    configureGeneratedLoredeckReadiness({
        getLoredeckPendingChanges: deps.getLoredeckPendingChanges,
        getLoredeckAssistantDraftChanges: deps.getLoredeckAssistantDraftChanges,
        getLoredeckAssistantDraftCacheRecord: packId => assistantDraftCache.getRecord?.(packId),
        getLoredeckCreatorPipelineReadiness: deps.getLoredeckCreatorPipelineReadiness,
        isLoredeckHealthStatusStale: deps.isLoredeckHealthStatusStale,
    });
}
