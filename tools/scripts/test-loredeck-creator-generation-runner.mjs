import assert from 'node:assert/strict';
import {
  buildLoredeckCreatorRunnerUnitId,
  handleLoredeckCreatorRunnerProgress,
  runLoredeckCreatorSingleUnitGeneration,
} from '../../src/loredecks/loredeck-creator-generation-runner.js';

assert.equal(
  buildLoredeckCreatorRunnerUnitId({ id: 'generation one' }, 'title batch'),
  'generation_one:title_batch',
  'Runner unit ids should be stable storage-safe generation/stage ids.',
);

{
  const updates = [];
  handleLoredeckCreatorRunnerProgress(
    { id: 'generation-progress' },
    { type: 'unit_retrying' },
    'Title batch',
    (_generation, event) => updates.push(event),
  );
  assert.deepEqual(updates[0], {
    type: 'phase',
    phase: 'retry',
    message: 'Retrying Title batch...',
  }, 'Runner progress should map retry events into UI phase updates.');
}

{
  const generation = {
    id: 'generation-success',
    label: 'Scope Brief',
    currentStage: 'scope_brief',
  };
  const events = [];
  const runCheckpoints = [];
  const unitCheckpoints = [];
  let painted = false;

  const result = await runLoredeckCreatorSingleUnitGeneration({
    generation,
    stage: 'scope_brief',
    unitLabel: 'Scope Brief',
    requestContext: { fandom: 'One Piece' },
    requestOptions: { providerKind: 'lore' },
    requestResponse: async (context, requestOptions) => {
      assert.equal(context.fandom, 'One Piece');
      assert.equal(requestOptions.providerKind, 'lore');
      return { text: '{"summary":"Ready"}' };
    },
    parseResponse: text => JSON.parse(text),
    validateParsedResult: parsed => parsed.summary === 'Ready',
    commitParsedResult: async ({ parsedResult, unitId, stage, requestContext }) => {
      assert.equal(parsedResult.summary, 'Ready');
      assert.equal(unitId, 'generation-success:scope_brief');
      assert.equal(stage, 'scope_brief');
      assert.equal(requestContext.fandom, 'One Piece');
      return {
        outputHash: 'hash-ready',
        resultRef: { accepted: true },
      };
    },
  }, {
    getGenerationSettings: () => ({ retryAttempts: 0 }),
    getGenerationJobId: () => 'creator-job',
    createRequestOptions: (_generation, options) => options,
    waitForUiPaint: async () => {
      painted = true;
    },
    isGenerationCurrent: () => true,
    updateGeneration: (_generation, event) => events.push(event),
    updateGenerationRun: (_jobId, run, checkpointOptions) => runCheckpoints.push({ run, checkpointOptions }),
    updateGenerationUnit: (_jobId, _unitId, unit, checkpointOptions) => unitCheckpoints.push({ unit, checkpointOptions }),
    extractResponseText: raw => raw.text,
  });

  assert.equal(painted, true, 'Runner should yield to UI paint before provider calls by default.');
  assert.equal(result.aborted, false);
  assert.equal(result.parsed.summary, 'Ready');
  assert.equal(result.responseText, '{"summary":"Ready"}');
  assert.equal(result.commitResult.resultRef.accepted, true);
  assert.equal(result.commitResult.resultRef.type, 'scope_brief');
  assert.equal(result.commitResult.resultRef.summary, 'Ready');
  assert.ok(events.some(event => event.phase === 'requesting'), 'Runner should publish requesting progress.');
  assert.ok(runCheckpoints.some(entry => entry.run.status === 'complete'), 'Runner should checkpoint completed runs.');
  assert.ok(unitCheckpoints.some(entry => entry.unit.status === 'complete'), 'Runner should checkpoint completed units.');
  assert.ok(unitCheckpoints.every(entry => entry.checkpointOptions.currentStage === 'scope_brief'), 'Runner checkpoints should carry current stage metadata.');
}

{
  const warned = [];
  let diagnosticPayload = null;
  await assert.rejects(
    () => runLoredeckCreatorSingleUnitGeneration({
      generation: { id: 'generation-failure', label: 'Planning' },
      stage: 'context_tag_planning',
      unitLabel: 'Context plan',
      requestResponse: async () => ({ text: '{"plans":[]}' }),
      parseResponse: text => JSON.parse(text),
      validateParsedResult: () => 'No planning proposals were returned.',
    }, {
      getGenerationSettings: () => ({ retryAttempts: 0 }),
      getGenerationJobId: () => 'creator-job',
      createRequestOptions: () => ({ providerKind: 'lore' }),
      isGenerationCurrent: () => true,
      extractResponseText: raw => raw.text,
      buildFailureDiagnostic: payload => {
        diagnosticPayload = payload;
        return {
          errorCode: 'creator_planning_no_proposals',
          sample: '{"plans":[]}',
        };
      },
      formatFailureMessage: (_error, fallback, label) => `${label}: ${fallback}`,
      warnFailure: (error, context) => warned.push({ error, context }),
    }),
    error => {
      assert.equal(error.message, 'Context plan: Context plan generation failed.');
      assert.equal(error.diagnostic.errorCode, 'creator_planning_no_proposals');
      return true;
    },
  );
  assert.equal(diagnosticPayload.unit.stage, 'context_tag_planning', 'Runner diagnostics should receive the failed unit context.');
  assert.equal(warned.length, 1, 'Runner failures should be logged through the injected warning hook.');
  assert.equal(warned[0].context.stage, 'context_tag_planning');
}

console.log('Deck Maker generation runner tests passed.');
