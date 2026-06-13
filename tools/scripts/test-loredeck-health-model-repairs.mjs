import assert from 'node:assert/strict';

import {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
  LOREDECK_HEALTH_REPAIR_SOURCES,
  LOREDECK_HEALTH_REPAIR_STRATEGIES,
} from '../../src/loredecks/loredeck-health-repair-contracts.js';
import {
  buildLoredeckHealthRepairPlan,
} from '../../src/loredecks/loredeck-health-fix-planner.js';
import {
  DEFAULT_MODEL_REPAIR_RESPONSE_LIMIT,
  buildLoredeckModelRepairPromptPayload,
  parseAndValidateLoredeckModelRepairResponse,
  parseLoredeckModelRepairResponse,
} from '../../src/loredecks/loredeck-health-model-repairs.js';
import {
  buildLargeModelRepairPack,
  buildModelRepairPack,
  buildRepairHealth,
  cloneRepairFixture,
} from './loredeck-health-repair-test-fixtures.mjs';

const pack = buildModelRepairPack();
const health = buildRepairHealth(pack);
const plan = buildLoredeckHealthRepairPlan({ pack, health, batchLimits: { modelEntryLimit: 1 } });
const unit = plan.units.find(row => row.code === 'schema_v3_missing_content');
assert.ok(unit, 'Expected a model repair unit for missing content.');

const prompt = buildLoredeckModelRepairPromptPayload(pack, unit, plan);
assert.equal(prompt.targetEntries.length, 1);
assert.equal(prompt.selectedHealthFindings.length, 1);
assert.equal(prompt.tagRegistry.length >= 1, true);
assert.equal(prompt.timeline.anchors.length >= 1, true);
assert.deepEqual(prompt.allowedOperations, [LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE]);
assert.deepEqual(prompt.allowedFields, ['content']);
assert.equal(prompt.responseLimits.maxChars, DEFAULT_MODEL_REPAIR_RESPONSE_LIMIT);

const entry = cloneRepairFixture(pack.entryOverrides[unit.entryIds[0]]);
entry.content = {
  fact: 'Nami privately carries the buyback burden under Arlong.',
  injection: 'When Arlong Park pressure is relevant, treat Nami as hiding a coerced buyback plan from her friends.',
};
const response = JSON.stringify({
  repairs: [{
    repairId: 'repair_content',
    findingIds: unit.findingIds,
    confidence: 0.93,
    risk: 'low',
    applyMode: 'direct',
    patch: {
      operations: [{
        op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
        entryId: unit.entryIds[0],
        fields: ['content'],
        entry,
      }],
    },
    reason: 'Filled missing schema v3 content.',
  }],
  choices: [],
  warnings: [],
  clarifyingQuestions: [],
});
const parsed = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, response);
assert.equal(parsed.repairs.length, 1);
assert.equal(parsed.repairs[0].validation.ok, true);
assert.equal(parsed.repairs[0].directApply, true);

const unsafeEntry = cloneRepairFixture(entry);
unsafeEntry.id = 'unrelated-entry';
const unsafeResponse = JSON.stringify({
  repairs: [{
    repairId: 'repair_unsafe',
    findingIds: unit.findingIds,
    confidence: 0.93,
    risk: 'low',
    applyMode: 'direct',
    patch: {
      operations: [{
        op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
        entryId: 'unrelated-entry',
        fields: ['content'],
        entry: unsafeEntry,
      }],
    },
  }],
  choices: [],
});
const unsafe = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, unsafeResponse);
assert.equal(unsafe.repairs[0].validation.ok, false);
assert.equal(unsafe.repairs[0].directApply, false);

const disallowedOperationResponse = JSON.stringify({
  repairs: [{
    repairId: 'repair_wrong_family',
    findingIds: unit.findingIds,
    confidence: 0.88,
    risk: 'low',
    applyMode: 'direct',
    patch: {
      operations: [{
        op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_TAG_DEFINITION,
        tagId: 'character:nami',
        tagDefinition: { label: 'Nami' },
      }],
    },
  }],
  choices: [],
});
const disallowedOperation = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, disallowedOperationResponse);
assert.equal(disallowedOperation.repairs[0].validation.ok, false);
assert.ok(disallowedOperation.repairs[0].validation.blocking.some(message => message.includes('not allowed')));

const disallowedFieldResponse = JSON.stringify({
  repairs: [{
    repairId: 'repair_wrong_field',
    findingIds: unit.findingIds,
    confidence: 0.9,
    risk: 'low',
    applyMode: 'direct',
    patch: {
      operations: [{
        op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
        entryId: unit.entryIds[0],
        fields: ['content', 'retrieval'],
        entry,
      }],
    },
  }],
  choices: [],
});
const disallowedField = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, disallowedFieldResponse);
assert.equal(disallowedField.repairs[0].validation.ok, false);
assert.ok(disallowedField.repairs[0].validation.blocking.some(message => message.includes('not allowed')));

const hiddenRetrievalEntry = cloneRepairFixture(entry);
hiddenRetrievalEntry.retrieval = {
  activation: 'manual',
  frequency: 'normal',
  contextBoost: 'high',
};
const hiddenMutationResponse = JSON.stringify({
  repairs: [{
    repairId: 'repair_hidden_mutation',
    findingIds: unit.findingIds,
    confidence: 0.9,
    risk: 'low',
    applyMode: 'direct',
    patch: {
      operations: [{
        op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
        entryId: unit.entryIds[0],
        fields: ['content'],
        entry: hiddenRetrievalEntry,
      }],
    },
  }],
  choices: [],
});
const hiddenMutation = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, hiddenMutationResponse);
assert.equal(hiddenMutation.repairs[0].validation.ok, false);
assert.ok(hiddenMutation.repairs[0].validation.blocking.some(message => message.includes('outside declared field scope')));

const largePack = buildLargeModelRepairPack({ count: 57 });
const largeHealth = buildRepairHealth(largePack);
const largePlan = buildLoredeckHealthRepairPlan({ pack: largePack, health: largeHealth });
assert.equal(largePlan.units.length, 8);
for (const largeUnit of largePlan.units) {
  const largePrompt = buildLoredeckModelRepairPromptPayload(largePack, largeUnit, largePlan);
  assert.ok(largePrompt.targetEntries.length <= 8);
  assert.ok(largePrompt.selectedHealthFindings.length <= 8);
}

const firstLargeUnit = largePlan.units[0];
const crossBatchEntryId = largePlan.units[1].entryIds[0];
const crossBatchEntry = cloneRepairFixture(largePack.entryOverrides[crossBatchEntryId]);
crossBatchEntry.content = {
  fact: 'This should not be accepted for a different batch.',
  injection: 'This response targets an entry outside the current model unit.',
};
const crossBatchResponse = JSON.stringify({
  repairs: [{
    repairId: 'repair_cross_batch',
    findingIds: firstLargeUnit.findingIds,
    confidence: 0.91,
    risk: 'low',
    applyMode: 'direct',
    patch: {
      operations: [{
        op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
        entryId: crossBatchEntryId,
        fields: ['content'],
        entry: crossBatchEntry,
      }],
    },
  }],
  choices: [],
});
const crossBatch = parseAndValidateLoredeckModelRepairResponse(largePack, firstLargeUnit, largePlan, crossBatchResponse);
assert.equal(crossBatch.repairs[0].validation.ok, false);
assert.ok(crossBatch.repairs[0].validation.blocking.some(message => message.includes('unrelated entry')));

const choiceEntry = cloneRepairFixture(entry);
choiceEntry.content = {
  fact: 'Nami hides the buyback plan while Arlong controls Cocoyasi.',
  injection: 'When Arlong Park pressure is relevant, treat Nami as hiding coerced payments from her friends.',
};
const validChoiceResponse = JSON.stringify({
  repairs: [],
  choices: [{
    choiceSetId: 'choice_content',
    findingIds: unit.findingIds,
    question: 'Which content repair should apply?',
    options: [{
      optionId: 'A',
      label: 'Coerced buyback',
      patch: {
        findingIds: unit.findingIds,
        operations: [{
          op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
          entryId: unit.entryIds[0],
          fields: ['content'],
          entry: choiceEntry,
        }],
      },
    }],
  }],
});
const validatedChoice = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, validChoiceResponse);
assert.equal(validatedChoice.choices.length, 1);
assert.equal(validatedChoice.choiceResults[0].validation.ok, true);
assert.equal(validatedChoice.invalidChoices.length, 0);

const duplicateOptionChoiceResponse = JSON.stringify({
  repairs: [],
  choices: [{
    choiceSetId: 'choice_duplicate_options',
    findingIds: unit.findingIds,
    question: 'Duplicate option IDs should fail validation.',
    options: [{
      optionId: 'A',
      label: 'First',
      patch: {
        findingIds: unit.findingIds,
        operations: [{
          op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
          entryId: unit.entryIds[0],
          fields: ['content'],
          entry: choiceEntry,
        }],
      },
    }, {
      optionId: 'A',
      label: 'Second',
      patch: {
        findingIds: unit.findingIds,
        operations: [{
          op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
          entryId: unit.entryIds[0],
          fields: ['content'],
          entry: choiceEntry,
        }],
      },
    }],
  }],
});
const duplicateOptionChoice = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, duplicateOptionChoiceResponse);
assert.equal(duplicateOptionChoice.choices.length, 0);
assert.equal(duplicateOptionChoice.invalidChoices.length, 1);
assert.ok(duplicateOptionChoice.choiceResults[0].validation.diagnostics.some(item => item.code === 'repair_choice_duplicate_option'));

const hiddenChoiceEntry = cloneRepairFixture(choiceEntry);
hiddenChoiceEntry.retrieval = {
  activation: 'manual',
  frequency: 'normal',
  contextBoost: 'high',
};
const hiddenChoiceResponse = JSON.stringify({
  repairs: [],
  choices: [{
    choiceSetId: 'choice_hidden_mutation',
    findingIds: unit.findingIds,
    question: 'Hidden mutation choice',
    options: [{
      optionId: 'A',
      label: 'Hidden retrieval change',
      patch: {
        findingIds: unit.findingIds,
        operations: [{
          op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
          entryId: unit.entryIds[0],
          fields: ['content'],
          entry: hiddenChoiceEntry,
        }],
      },
    }],
  }],
});
const hiddenChoice = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, hiddenChoiceResponse);
assert.equal(hiddenChoice.choices.length, 0);
assert.equal(hiddenChoice.invalidChoices.length, 1);
assert.ok(hiddenChoice.choiceResults[0].validation.diagnostics.some(item => item.code === 'repair_payload_field_not_declared'));

const invalidChoiceResponse = JSON.stringify({
  repairs: [],
  choices: [{
    choiceSetId: 'choice_invalid',
    findingIds: unit.findingIds,
    question: 'Invalid choice',
    options: [{
      optionId: 'A',
      label: 'Wrong entry',
      patch: {
        findingIds: unit.findingIds,
        operations: [{
          op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
          entryId: 'unrelated-entry',
          fields: ['content'],
          entry: { ...choiceEntry, id: 'unrelated-entry' },
        }],
      },
    }],
  }],
});
const invalidChoice = parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, invalidChoiceResponse);
assert.equal(invalidChoice.choices.length, 0);
assert.equal(invalidChoice.invalidChoices.length, 1);
assert.equal(invalidChoice.choiceResults[0].validation.ok, false);

const choiceOnly = parseLoredeckModelRepairResponse(JSON.stringify({
  repairs: [],
  choices: [{
    choiceSetId: 'choice_context',
    findingIds: unit.findingIds,
    question: 'Pick one',
    options: [{
      optionId: 'A',
      label: 'Use compact repair',
      patch: { operations: [] },
    }],
  }],
  warnings: ['needs review'],
  clarifyingQuestions: ['Which source boundary should apply?'],
}));
assert.equal(choiceOnly.choices.length, 1);
assert.equal(choiceOnly.choices[0].options[0].patch.source, LOREDECK_HEALTH_REPAIR_SOURCES.MODEL);
assert.equal(choiceOnly.choices[0].options[0].patch.strategy, LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_REVIEW_CHOICE);
assert.deepEqual(choiceOnly.warnings, ['needs review']);
assert.deepEqual(choiceOnly.clarifyingQuestions, ['Which source boundary should apply?']);

assert.throws(
  () => parseLoredeckModelRepairResponse(' '.repeat(DEFAULT_MODEL_REPAIR_RESPONSE_LIMIT + 1)),
  /exceeded/
);

assert.throws(
  () => parseLoredeckModelRepairResponse('The answer is to fix it manually.'),
  /not valid JSON/
);

console.log('Loredeck health model repair tests passed.');
