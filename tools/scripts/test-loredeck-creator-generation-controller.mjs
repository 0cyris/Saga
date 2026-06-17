import assert from 'node:assert/strict';
import {
  createLoredeckCreatorGenerationController,
} from '../../src/loredecks/loredeck-creator-generation-controller.js';

const signal = { type: 'abort-signal' };
const progressHandlers = [];
const depsSeenByRunner = [];

const controller = createLoredeckCreatorGenerationController({
  getGenerationSettings: () => ({ showStreamingProgress: false, retryAttempts: 2 }),
  getGenerationJobId: generation => generation?.jobId || 'fallback-job',
  getGenerationController: id => (id === 'generation-a' ? { signal } : null),
  makeProgressHandler(generation, options) {
    const handler = event => progressHandlers.push({ generation, options, event });
    progressHandlers.push({ generation, options, created: true });
    return handler;
  },
  waitForUiPaint: async () => 'painted',
  isGenerationCurrent: generation => generation?.status !== 'stale',
  updateGeneration: () => {},
  updateGenerationRun: () => {},
  updateGenerationUnit: () => {},
  extractResponseText: raw => raw?.text || '',
  buildFailureDiagnostic: () => ({ ok: true }),
  formatFailureMessage: () => 'formatted failure',
  warnFailure: () => {},
  runSingleUnitWithDeps: async (config, runnerDeps) => {
    depsSeenByRunner.push(runnerDeps);
    return {
      config,
      requestOptions: runnerDeps.createRequestOptions(config.generation, config.requestOptions || {}),
      jobId: runnerDeps.getGenerationJobId(config.generation),
      settings: runnerDeps.getGenerationSettings(),
      current: runnerDeps.isGenerationCurrent(config.generation),
      extracted: runnerDeps.extractResponseText({ text: 'response text' }),
      diagnostic: runnerDeps.buildFailureDiagnostic({ error: 'sample' }),
      formatted: runnerDeps.formatFailureMessage(new Error('x'), 'fallback', 'Unit'),
    };
  },
});

const defaultOptions = controller.createRequestOptions({ id: 'generation-a' }, {});
assert.equal(defaultOptions.stream, false, 'Request options should follow generation settings when no stream override is supplied.');
assert.equal(defaultOptions.providerKind, 'lore', 'Request options should default to the Lore provider.');
assert.equal(defaultOptions.forceVisibleOutput, true, 'Request options should require visible output by default.');
assert.equal(defaultOptions.signal, signal, 'Request options should include the active generation abort signal.');
assert.equal(typeof defaultOptions.onProgress, 'function', 'Request options should include the generation progress handler.');

const overrideOptions = controller.createRequestOptions({ id: 'generation-missing' }, {
  stream: true,
  providerKind: 'continuity',
  forceVisibleOutput: false,
});
assert.equal(overrideOptions.stream, true, 'Request options should honor explicit stream overrides.');
assert.equal(overrideOptions.providerKind, 'continuity', 'Request options should honor provider overrides.');
assert.equal(overrideOptions.forceVisibleOutput, false, 'Request options should honor visible-output overrides.');
assert.equal(overrideOptions.signal, undefined, 'Request options without an active controller should not include a signal.');

defaultOptions.onProgress({ type: 'phase', phase: 'requesting' });
assert.equal(progressHandlers.at(-1).event.phase, 'requesting', 'Progress handlers should be wired into request options.');

const runResult = await controller.runSingleUnitGeneration({
  generation: { id: 'generation-a', jobId: 'creator-job' },
  requestOptions: { stream: true },
});
assert.equal(runResult.jobId, 'creator-job', 'Single-unit generation should pass through the injected job-id resolver.');
assert.equal(runResult.settings.retryAttempts, 2, 'Single-unit generation should pass through generation settings.');
assert.equal(runResult.current, true, 'Single-unit generation should pass through current-generation checks.');
assert.equal(runResult.extracted, 'response text', 'Single-unit generation should pass through response extraction.');
assert.deepEqual(runResult.diagnostic, { ok: true }, 'Single-unit generation should pass through diagnostic construction.');
assert.equal(runResult.formatted, 'formatted failure', 'Single-unit generation should pass through failure formatting.');
assert.equal(runResult.requestOptions.stream, true, 'Single-unit generation should use controller-owned request option creation.');
assert.equal(depsSeenByRunner.length, 1, 'Single-unit generation should call the injected runner once.');
assert.equal(typeof depsSeenByRunner[0].waitForUiPaint, 'function', 'Single-unit generation should pass through UI-paint yielding.');
assert.equal(typeof depsSeenByRunner[0].updateGenerationRun, 'function', 'Single-unit generation should pass through run checkpoint updates.');
assert.equal(typeof depsSeenByRunner[0].updateGenerationUnit, 'function', 'Single-unit generation should pass through unit checkpoint updates.');

console.log('Deck Maker generation controller tests passed.');
