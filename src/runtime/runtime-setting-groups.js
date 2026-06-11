/**
 * Runtime setting groups used by reset controls.
 */

export const CONTEXT_DETECTION_SETTING_KEYS = Object.freeze([
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

export const STORY_LORE_SCAN_SCOPE_SETTING_KEYS = Object.freeze([
    'loreBulkScanMode',
    'loreBulkRangeStart',
    'loreBulkRangeEnd',
    'loreSourceMessageCount',
]);

export const STORY_LORE_SCAN_PERFORMANCE_SETTING_KEYS = Object.freeze([
    'loreBulkChunkSize',
    'loreBulkOverlap',
    'loreBulkConcurrency',
    'loreBulkRetryAttempts',
    'loreBulkFullCheckpointEveryChunks',
    'loreBulkConsolidationChunkWindow',
]);

export const STORY_LORE_SCAN_QUALITY_SETTING_KEYS = Object.freeze([
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

export const STORY_LORE_AUTOMATION_SETTING_KEYS = Object.freeze([
    'loreGenerationMode',
    'loreGenerationAutoInterval',
    'loreGenerationAutoMinTurns',
    'loreGenerationAutoWordThreshold',
]);

export const CONTINUITY_SCAN_SCOPE_SETTING_KEYS = Object.freeze([
    'continuityScanMode',
    'continuityScanRangeStart',
    'continuityScanRangeEnd',
    'continuitySourceMessageCount',
]);

export const CONTINUITY_SCAN_PERFORMANCE_SETTING_KEYS = Object.freeze([
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

export const CONTINUITY_EMOTION_FRESHNESS_SETTING_KEYS = Object.freeze([
    'continuityEmotionRecencyEnabled',
    'continuityEmotionCurrentMessageWindow',
    'continuityEmotionRecentMessageWindow',
    'continuityEmotionStaleBehavior',
]);

export const PROMPT_PLACEMENT_SETTING_KEYS = Object.freeze([
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
