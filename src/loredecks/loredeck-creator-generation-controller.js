import {
    runLoredeckCreatorSingleUnitGeneration as runLoredeckCreatorSingleUnitGenerationWithDeps,
} from './loredeck-creator-generation-runner.js';

export function createLoredeckCreatorGenerationController(deps = {}) {
    const getGenerationSettings = typeof deps.getGenerationSettings === 'function' ? deps.getGenerationSettings : () => ({});
    const getGenerationJobId = typeof deps.getGenerationJobId === 'function' ? deps.getGenerationJobId : () => '';
    const getGenerationController = typeof deps.getGenerationController === 'function' ? deps.getGenerationController : () => null;
    const makeProgressHandler = typeof deps.makeProgressHandler === 'function' ? deps.makeProgressHandler : () => null;
    const waitForUiPaint = typeof deps.waitForUiPaint === 'function' ? deps.waitForUiPaint : null;
    const isGenerationCurrent = typeof deps.isGenerationCurrent === 'function' ? deps.isGenerationCurrent : () => true;
    const updateGeneration = typeof deps.updateGeneration === 'function' ? deps.updateGeneration : null;
    const updateGenerationRun = typeof deps.updateGenerationRun === 'function' ? deps.updateGenerationRun : null;
    const updateGenerationUnit = typeof deps.updateGenerationUnit === 'function' ? deps.updateGenerationUnit : null;
    const extractResponseText = typeof deps.extractResponseText === 'function' ? deps.extractResponseText : null;
    const buildFailureDiagnostic = typeof deps.buildFailureDiagnostic === 'function' ? deps.buildFailureDiagnostic : () => null;
    const formatFailureMessage = typeof deps.formatFailureMessage === 'function' ? deps.formatFailureMessage : null;
    const warnFailure = typeof deps.warnFailure === 'function' ? deps.warnFailure : null;
    const runSingleUnitWithDeps = typeof deps.runSingleUnitWithDeps === 'function'
        ? deps.runSingleUnitWithDeps
        : runLoredeckCreatorSingleUnitGenerationWithDeps;

    function createRequestOptions(generation = null, options = {}) {
        const controller = generation?.id ? getGenerationController(generation.id) : null;
        const settings = getGenerationSettings();
        const stream = options.stream !== undefined ? options.stream === true : settings.showStreamingProgress !== false;
        return {
            stream,
            providerKind: options.providerKind || 'lore',
            forceVisibleOutput: options.forceVisibleOutput !== undefined ? options.forceVisibleOutput === true : true,
            signal: controller?.signal,
            onProgress: makeProgressHandler(generation, options),
        };
    }

    async function runSingleUnitGeneration(config = {}) {
        return await runSingleUnitWithDeps(config, {
            getGenerationSettings,
            getGenerationJobId,
            createRequestOptions,
            waitForUiPaint,
            isGenerationCurrent,
            updateGeneration,
            updateGenerationRun,
            updateGenerationUnit,
            extractResponseText,
            buildFailureDiagnostic,
            formatFailureMessage,
            warnFailure,
        });
    }

    return {
        createRequestOptions,
        runSingleUnitGeneration,
    };
}
