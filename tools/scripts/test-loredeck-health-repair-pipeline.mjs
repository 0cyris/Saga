import assert from 'node:assert/strict';

import { normalizeLoredeckEntryForSchemaV3 } from '../../src/loredecks/schema-v3-health.js';
import {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
} from '../../src/loredecks/loredeck-health-repair-contracts.js';
import {
  buildLoredeckHealthRepairPlan,
} from '../../src/loredecks/loredeck-health-fix-planner.js';
import {
  buildLoredeckLocalRepairsForPlan,
} from '../../src/loredecks/loredeck-health-local-repairs.js';
import {
  buildLoredeckModelRepairPromptPayload,
  parseAndValidateLoredeckModelRepairResponse,
  parseLoredeckModelRepairResponse,
} from '../../src/loredecks/loredeck-health-model-repairs.js';
import {
  applyLoredeckRepairPatchToSnapshot,
  simulateLoredeckHealthRepair,
} from '../../src/loredecks/loredeck-health-repair-simulator.js';
import {
  validateLoredeckRepairChoiceSet,
  validateLoredeckRepairPatch,
} from '../../src/loredecks/loredeck-health-repair-validator.js';
import {
  buildArlongStyleRepairPack,
  buildRepairHealth,
  cloneRepairFixture,
} from './loredeck-health-repair-test-fixtures.mjs';

const pack = buildArlongStyleRepairPack();
const health = buildRepairHealth(pack);
const plan = buildLoredeckHealthRepairPlan({ pack, health });
const local = buildLoredeckLocalRepairsForPlan(pack, plan);
assert.ok(local.patches.length >= 2);
assert.ok(local.choiceSets.length >= 1);

for (const patch of local.patches) {
  const validation = validateLoredeckRepairPatch(pack, patch, {
    findings: plan.findings,
    buckets: plan.buckets,
  });
  assert.equal(validation.ok, true, validation.blocking.join('\n'));
  assert.equal(validation.directApply, true);
}

const simulated = simulateLoredeckHealthRepair({
  pack,
  health,
  healthEvaluator: buildRepairHealth,
});
assert.equal(simulated.finalHealth.summary.errorCount, 0);
assert.equal(simulated.finalHealth.summary.schemaV3IssueCount, 0);
assert.equal(simulated.finalHealth.summary.undefinedTagCount, 0);
assert.equal(simulated.finalHealth.status, 'needs_review');
assert.ok(simulated.finalHealth.summary.brokenAnchorReferenceCount > 0);
assert.ok(simulated.choiceSets.length >= 1);
assert.equal(simulated.summary.appliedPatchCount >= 2, true);

for (const entry of Object.values(simulated.finalPack.entryOverrides || {})) {
  assert.equal(Object.hasOwn(entry, 'fact'), false);
  assert.equal(Object.hasOwn(entry, 'date'), false);
  assert.equal(Object.hasOwn(entry, 'whoKnowsTruth'), false);
  assert.equal(entry.tags.includes('fact'), false);
  assert.equal(entry.tags.includes('other'), false);
}
assert.deepEqual(simulated.finalPack.entryOverrides['arlong-style-entry-01'].tags, [
  'character:nami',
  'faction:arlong-pirates',
  'concept:buyback-deal',
]);

const anchorChoice = simulated.choiceSets.find(choice => choice.code === 'broken_anchor_reference');
assert.ok(anchorChoice);
const choiceValidation = validateLoredeckRepairChoiceSet(simulated.finalPack, anchorChoice, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(choiceValidation.ok, true);
const chosenPack = applyLoredeckRepairPatchToSnapshot(simulated.finalPack, anchorChoice.options[0].patch);
const chosenHealth = buildRepairHealth(chosenPack);
assert.equal(chosenHealth.status, 'good');
assert.equal(chosenHealth.summary.warningCount, 0);

const targetEntry = normalizeLoredeckEntryForSchemaV3(cloneRepairFixture(chosenPack.entryOverrides['arlong-style-entry-01']));
targetEntry.content = {
  fact: 'Arlong uses fear and money to keep Cocoyasi trapped.',
  injection: 'When Arlong Park pressure is relevant, treat Cocoyasi as coerced by Arlong through violence and debt.',
};
const modelUnit = {
  unitId: 'repair:model:test',
  strategy: 'model_direct',
  code: 'schema_v3_missing_content',
  bucketId: 'bucket_model_content',
  findingIds: ['health_model_content'],
  entryIds: ['arlong-style-entry-01'],
  tagIds: [],
  timelineIds: [],
};
const modelPlan = {
  packId: chosenPack.packId,
  findings: [{
    findingId: 'health_model_content',
    code: 'schema_v3_missing_content',
    severity: 'error',
    entryIds: ['arlong-style-entry-01'],
    tagIds: [],
    timelineIds: [],
  }],
  buckets: [{
    bucketId: 'bucket_model_content',
    code: 'schema_v3_missing_content',
    strategy: 'model_direct',
    affectedEntryIds: ['arlong-style-entry-01'],
    affectedTagIds: [],
    affectedTimelineIds: [],
  }],
};
const promptPayload = buildLoredeckModelRepairPromptPayload(chosenPack, modelUnit, modelPlan);
assert.equal(promptPayload.targetEntries.length, 1);
assert.equal(promptPayload.selectedHealthFindings.length, 1);

const modelResponse = JSON.stringify({
  repairs: [{
    repairId: 'repair_1',
    findingIds: ['health_model_content'],
    confidence: 0.91,
    risk: 'low',
    applyMode: 'direct',
    patch: {
      operations: [{
        op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
        entryId: 'arlong-style-entry-01',
        fields: ['content'],
        entry: targetEntry,
      }],
    },
    reason: 'Rebuilt compact schema v3 content.',
  }],
  choices: [],
  warnings: [],
  clarifyingQuestions: [],
});
const parsedModel = parseAndValidateLoredeckModelRepairResponse(chosenPack, modelUnit, modelPlan, modelResponse);
assert.equal(parsedModel.repairs.length, 1);
assert.equal(parsedModel.repairs[0].directApply, true);
assert.equal(parsedModel.repairs[0].validation.ok, true);

assert.throws(
  () => parseLoredeckModelRepairResponse('not json'),
  /not valid JSON/
);

console.log('Loredeck health repair pipeline tests passed.');
