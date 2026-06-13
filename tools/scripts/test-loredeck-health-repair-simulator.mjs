import assert from 'node:assert/strict';

import {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
} from '../../src/loredecks/loredeck-health-repair-contracts.js';
import {
  buildLoredeckHealthRepairPlan,
} from '../../src/loredecks/loredeck-health-fix-planner.js';
import {
  applyLoredeckRepairPatchToSnapshot,
  simulateLoredeckHealthRepair,
} from '../../src/loredecks/loredeck-health-repair-simulator.js';
import {
  buildArlongStyleRepairPack,
  buildContentAliasRepairPack,
  buildExactAnchorNormalizationPack,
  buildManifestStatsMismatchPack,
  buildModelRepairPack,
  buildRepairHealth,
  buildRetrievalDefaultsRepairPack,
  buildWideRetrievalRepairPack,
  cloneRepairFixture,
} from './loredeck-health-repair-test-fixtures.mjs';

const arlongPack = buildArlongStyleRepairPack({ count: 12 });
const arlongHealth = buildRepairHealth(arlongPack);
const arlongResult = simulateLoredeckHealthRepair({
  pack: arlongPack,
  health: arlongHealth,
  healthEvaluator: buildRepairHealth,
});
assert.equal(arlongResult.initialHealth.summary.errorCount, 12);
assert.equal(arlongResult.finalHealth.summary.errorCount, 0);
assert.equal(arlongResult.finalHealth.summary.undefinedTagCount, 0);
assert.equal(arlongResult.choiceSets.length, 1);
assert.equal(arlongResult.summary.appliedPatchCount >= 2, true);
assert.equal(arlongResult.summary.outcome, 'needs_review');
assert.equal(arlongResult.summary.initialHealth.errorCount, 12);
assert.equal(arlongResult.summary.finalHealth.errorCount, 0);
assert.equal(arlongResult.summary.healthDelta.resolvedErrorCount, 12);
assert.equal(arlongResult.summary.choiceSetCount, 1);

const anchorChoice = arlongResult.choiceSets[0];
const chosen = applyLoredeckRepairPatchToSnapshot(arlongResult.finalPack, anchorChoice.options[0].patch);
assert.equal(buildRepairHealth(chosen).status, 'good');

const entryFilePack = buildArlongStyleRepairPack({ count: 4, packId: 'entry-file-snapshot-repair-pack' });
entryFilePack.entryFiles = [{
  file: 'entries.json',
  schemaVersion: 3,
  entries: Object.values(entryFilePack.entryOverrides || {}),
}];
entryFilePack.manifestData.files = ['entries.json'];
delete entryFilePack.entryOverrides;
const entryFileHealth = buildRepairHealth(entryFilePack);
assert.equal(entryFileHealth.summary.errorCount, 4);
const entryFileResult = simulateLoredeckHealthRepair({
  pack: entryFilePack,
  health: entryFileHealth,
  healthEvaluator: buildRepairHealth,
});
assert.equal(entryFileResult.finalHealth.summary.errorCount, 0);
assert.equal(Object.hasOwn(entryFileResult.finalPack, 'entryOverrides'), false);
for (const entry of entryFileResult.finalPack.entryFiles[0].entries) {
  assert.equal(Object.hasOwn(entry, 'fact'), false);
  assert.equal(Object.hasOwn(entry, 'date'), false);
  assert.equal(Object.hasOwn(entry, 'whoKnowsTruth'), false);
  assert.equal(entry.tags.includes('fact'), false);
  assert.equal(entry.tags.includes('other'), false);
}

const modelPack = buildModelRepairPack();
const modelHealth = buildRepairHealth(modelPack);
const modelPlan = buildLoredeckHealthRepairPlan({ pack: modelPack, health: modelHealth });
const unit = modelPlan.units.find(row => row.code === 'schema_v3_missing_content');
assert.ok(unit);
const modelEntry = cloneRepairFixture(modelPack.entryOverrides[unit.entryIds[0]]);
modelEntry.content = {
  fact: 'Nami keeps the buyback secret because Arlong controls Cocoyasi through money and violence.',
  injection: 'When Nami is pressured, treat her secrecy as coerced protection of Cocoyasi from Arlong.',
};
const modelResponses = {
  [unit.unitId]: JSON.stringify({
    repairs: [{
      repairId: 'repair_model_content',
      findingIds: unit.findingIds,
      confidence: 0.9,
      risk: 'low',
      applyMode: 'direct',
      patch: {
        operations: [{
          op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
          entryId: unit.entryIds[0],
          fields: ['content'],
          entry: modelEntry,
        }],
      },
    }],
    choices: [],
  }),
};
const modelResult = simulateLoredeckHealthRepair({
  pack: modelPack,
  health: modelHealth,
  healthEvaluator: buildRepairHealth,
  modelResponses,
});
assert.equal(modelResult.modelResults.length, 1);
assert.equal(modelResult.finalHealth.summary.errorCount, 0);
assert.equal(modelResult.finalHealth.status, 'good');
assert.equal(modelResult.summary.outcome, 'manual_remaining');
assert.equal(modelResult.summary.modelResultCount, 1);
assert.equal(modelResult.summary.healthDelta.resolvedErrorCount, 1);
assert.equal(modelResult.summary.finalPlan.manualOnlyCount, 1);
assert.equal(modelResult.summary.totalModelUnitCount, 0);

const noModelResult = simulateLoredeckHealthRepair({
  pack: modelPack,
  health: modelHealth,
  healthEvaluator: buildRepairHealth,
});
assert.equal(noModelResult.modelResults.length, 0);
assert.equal(noModelResult.finalHealth.summary.errorCount > 0, true);
assert.equal(noModelResult.summary.appliedPatchCount, 0);
assert.equal(noModelResult.summary.outcome, 'model_pending');
assert.equal(noModelResult.summary.totalModelUnitCount, 1);

const invalidChoiceResponses = {
  [unit.unitId]: JSON.stringify({
    repairs: [],
    choices: [{
      choiceSetId: 'choice_invalid_model',
      findingIds: unit.findingIds,
      question: 'Invalid model choice',
      options: [{
        optionId: 'A',
        label: 'Wrong entry',
        patch: {
          findingIds: unit.findingIds,
          operations: [{
            op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
            entryId: 'unrelated-entry',
            fields: ['content'],
            entry: { ...modelEntry, id: 'unrelated-entry' },
          }],
        },
      }],
    }],
  }),
};
const invalidChoiceResult = simulateLoredeckHealthRepair({
  pack: modelPack,
  health: modelHealth,
  healthEvaluator: buildRepairHealth,
  modelResponses: invalidChoiceResponses,
});
assert.equal(invalidChoiceResult.choiceSets.length, 0);
assert.ok(invalidChoiceResult.diagnostics.some(item => String(item.message || item).includes('unrelated entry')));

const manifestPack = buildManifestStatsMismatchPack();
const manifestHealth = buildRepairHealth(manifestPack);
assert.ok(manifestHealth.summary.warningCount >= 2);
const manifestResult = simulateLoredeckHealthRepair({
  pack: manifestPack,
  health: manifestHealth,
  healthEvaluator: buildRepairHealth,
});
assert.equal(manifestResult.finalPack.manifestData.stats.entryCount, 3);
assert.deepEqual(manifestResult.finalPack.manifestData.stats.categoryCounts, { other: 2, secret: 1 });
assert.equal(manifestResult.finalHealth.status, 'good');
assert.equal(manifestResult.finalHealth.summary.warningCount, 0);
assert.equal(manifestResult.summary.outcome, 'manual_remaining');
assert.equal(manifestResult.summary.healthDelta.resolvedWarningCount, 2);

const exactAnchorPack = buildExactAnchorNormalizationPack();
const exactAnchorHealth = buildRepairHealth(exactAnchorPack);
assert.ok(exactAnchorHealth.summary.warningCount >= 1);
const exactAnchorResult = simulateLoredeckHealthRepair({
  pack: exactAnchorPack,
  health: exactAnchorHealth,
  healthEvaluator: buildRepairHealth,
});
assert.equal(exactAnchorResult.finalPack.entryOverrides['namis-childhood-under-arlongs-rule'].context.validToAnchor, 'one-piece.arlong.end');
assert.equal(exactAnchorResult.finalHealth.status, 'good');
assert.equal(exactAnchorResult.finalHealth.summary.brokenAnchorReferenceCount, 0);
assert.equal(exactAnchorResult.finalHealth.summary.unmatchableContextGateCount, 0);

const widePack = buildWideRetrievalRepairPack();
const wideHealth = buildRepairHealth(widePack);
assert.equal(wideHealth.summary.warningCount, 1);
const wideResult = simulateLoredeckHealthRepair({
  pack: widePack,
  health: wideHealth,
  healthEvaluator: buildRepairHealth,
});
const wideEntry = wideResult.finalPack.entryOverrides['namis-childhood-under-arlongs-rule'];
assert.deepEqual(wideEntry.retrieval, {
  activation: 'topic_or_entity',
  frequency: 'low',
  contextBoost: 'low',
});
assert.equal(wideResult.finalHealth.status, 'good');
assert.equal(wideResult.finalHealth.summary.warningCount, 0);

const contentAliasPack = buildContentAliasRepairPack();
const contentAliasHealth = buildRepairHealth(contentAliasPack);
assert.equal(contentAliasHealth.summary.errorCount, 1);
const contentAliasResult = simulateLoredeckHealthRepair({
  pack: contentAliasPack,
  health: contentAliasHealth,
  healthEvaluator: buildRepairHealth,
});
const contentAliasEntry = contentAliasResult.finalPack.entryOverrides['namis-childhood-under-arlongs-rule'];
assert.equal(contentAliasEntry.content.fact, 'Nami hides the buyback deal because Arlong controls Cocoyasi through debt and fear.');
assert.equal(contentAliasEntry.content.injection, 'When Nami or Arlong Park pressure is relevant, treat Nami as hiding coerced payments from her friends.');
assert.equal(contentAliasResult.finalHealth.status, 'good');
assert.equal(contentAliasResult.finalHealth.summary.errorCount, 0);

const retrievalPack = buildRetrievalDefaultsRepairPack();
const retrievalHealth = buildRepairHealth(retrievalPack);
assert.equal(retrievalHealth.summary.errorCount, 2);
const retrievalResult = simulateLoredeckHealthRepair({
  pack: retrievalPack,
  health: retrievalHealth,
  healthEvaluator: buildRepairHealth,
});
assert.deepEqual(retrievalResult.finalPack.entryOverrides['arlong-style-entry-01'].retrieval, {
  activation: 'context_or_topic',
  frequency: 'normal',
  contextBoost: 'high',
});
assert.equal(retrievalResult.finalPack.entryOverrides['namis-childhood-under-arlongs-rule'].retrieval.activation, 'context_or_topic');
assert.equal(retrievalResult.finalPack.entryOverrides['namis-childhood-under-arlongs-rule'].retrieval.contextBoost, 'high');
assert.equal(retrievalResult.finalHealth.status, 'good');
assert.equal(retrievalResult.finalHealth.summary.errorCount, 0);

console.log('Loredeck health repair simulator tests passed.');
