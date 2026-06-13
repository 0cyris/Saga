import assert from 'node:assert/strict';

import {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
  LOREDECK_HEALTH_REPAIR_SOURCES,
  LOREDECK_HEALTH_REPAIR_STRATEGIES,
  normalizeRepairPatch,
} from '../../src/loredecks/loredeck-health-repair-contracts.js';
import {
  buildLoredeckHealthRepairPlan,
} from '../../src/loredecks/loredeck-health-fix-planner.js';
import {
  buildLoredeckLocalRepairsForPlan,
} from '../../src/loredecks/loredeck-health-local-repairs.js';
import {
  validateLoredeckRepairChoiceSet,
  validateLoredeckRepairPatch,
} from '../../src/loredecks/loredeck-health-repair-validator.js';
import {
  buildArlongStyleRepairPack,
  buildManifestStatsMismatchPack,
  buildModelRepairPack,
  buildRepairHealth,
  cloneRepairFixture,
} from './loredeck-health-repair-test-fixtures.mjs';

const pack = buildArlongStyleRepairPack({ count: 3 });
const health = buildRepairHealth(pack);
const plan = buildLoredeckHealthRepairPlan({ pack, health });
const local = buildLoredeckLocalRepairsForPlan(pack, plan);
const validPatch = local.patches[0];
const valid = validateLoredeckRepairPatch(pack, validPatch, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(valid.ok, true);
assert.equal(valid.directApply, true);

const validChoiceSet = local.choiceSets[0];
assert.ok(validChoiceSet, 'Expected a local review choice set.');
const validChoiceResult = validateLoredeckRepairChoiceSet(pack, validChoiceSet, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(validChoiceResult.ok, true);
assert.equal(validChoiceResult.optionResults.length, validChoiceSet.options.length);

const emptyChoiceResult = validateLoredeckRepairChoiceSet(pack, {
  choiceSetId: 'choice_empty',
  findingIds: [plan.findings[0].findingId],
  options: [],
}, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(emptyChoiceResult.ok, false);
assert.ok(emptyChoiceResult.diagnostics.some(item => item.code === 'repair_choice_empty'));

const duplicateChoice = cloneRepairFixture(validChoiceSet);
duplicateChoice.options = [
  cloneRepairFixture(validChoiceSet.options[0]),
  cloneRepairFixture(validChoiceSet.options[0]),
];
const duplicateChoiceResult = validateLoredeckRepairChoiceSet(pack, duplicateChoice, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(duplicateChoiceResult.ok, false);
assert.ok(duplicateChoiceResult.diagnostics.some(item => item.code === 'repair_choice_duplicate_option'));

const unrelatedChoice = cloneRepairFixture(validChoiceSet);
unrelatedChoice.findingIds = ['unrelated-finding'];
const unrelatedChoiceResult = validateLoredeckRepairChoiceSet(pack, unrelatedChoice, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(unrelatedChoiceResult.ok, false);
assert.ok(unrelatedChoiceResult.diagnostics.some(item => item.code === 'repair_choice_unrelated_finding'));

const unrelatedEntry = cloneRepairFixture(validPatch);
unrelatedEntry.operations[0].entryId = 'unrelated-entry';
unrelatedEntry.operations[0].entry.id = 'unrelated-entry';
const unrelatedResult = validateLoredeckRepairPatch(pack, unrelatedEntry, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(unrelatedResult.ok, false);
assert.ok(unrelatedResult.blocking.some(message => message.includes('unrelated entry')));

const unknownTag = cloneRepairFixture(validPatch);
unknownTag.operations[0].fields = ['tags'];
unknownTag.operations[0].entry.tags = ['tag:missing'];
const unknownTagResult = validateLoredeckRepairPatch(pack, unknownTag, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(unknownTagResult.ok, false);
assert.ok(unknownTagResult.blocking.some(message => message.includes('unknown tag')));

const unknownAnchor = cloneRepairFixture(validPatch);
unknownAnchor.operations[0].fields = ['context.validToAnchor'];
unknownAnchor.operations[0].entry.context.validToAnchor = 'missing.anchor';
const unknownAnchorResult = validateLoredeckRepairPatch(pack, unknownAnchor, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(unknownAnchorResult.ok, false);
assert.ok(unknownAnchorResult.blocking.some(message => message.includes('unknown Context anchor')));

const confirmationPatch = normalizeRepairPatch({
  strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
  findingIds: [plan.findings[0].findingId],
  operations: [{
    op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
    entryId: plan.findings[0].entryIds[0],
    entry: validPatch.operations[0].entry,
    requiresConfirmation: true,
  }],
});
const confirmationResult = validateLoredeckRepairPatch(pack, confirmationPatch, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(confirmationResult.ok, false);
assert.equal(confirmationResult.directApply, false);
assert.ok(confirmationResult.blocking.some(message => message.includes('requires explicit confirmation')));

const manifestPack = buildManifestStatsMismatchPack();
const manifestHealth = buildRepairHealth(manifestPack);
const manifestPlan = buildLoredeckHealthRepairPlan({ pack: manifestPack, health: manifestHealth });
const manifestLocal = buildLoredeckLocalRepairsForPlan(manifestPack, manifestPlan);
const manifestPatch = manifestLocal.patches.find(patch => patch.operations[0]?.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS);
assert.ok(manifestPatch);
const manifestResult = validateLoredeckRepairPatch(manifestPack, manifestPatch, {
  findings: manifestPlan.findings,
  buckets: manifestPlan.buckets,
});
assert.equal(manifestResult.ok, true);
assert.equal(manifestResult.directApply, true);

const invalidManifestStats = cloneRepairFixture(manifestPatch);
invalidManifestStats.operations[0].stats.entryCount = -1;
const invalidManifestResult = validateLoredeckRepairPatch(manifestPack, invalidManifestStats, {
  findings: manifestPlan.findings,
  buckets: manifestPlan.buckets,
});
assert.equal(invalidManifestResult.ok, false);
assert.ok(invalidManifestResult.blocking.some(message => message.includes('invalid entryCount')));

const unrelatedManifestPatch = normalizeRepairPatch({
  strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
  findingIds: [plan.findings[0].findingId],
  operations: [{
    op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS,
    stats: { entryCount: 3, categoryCounts: { other: 3 } },
  }],
});
const unrelatedManifestResult = validateLoredeckRepairPatch(pack, unrelatedManifestPatch, {
  findings: plan.findings,
  buckets: plan.buckets,
});
assert.equal(unrelatedManifestResult.ok, false);
assert.ok(unrelatedManifestResult.blocking.some(message => message.includes('not tied to a manifest stats finding')));

const contentPack = buildModelRepairPack();
const contentHealth = buildRepairHealth(contentPack);
const contentPlan = buildLoredeckHealthRepairPlan({ pack: contentPack, health: contentHealth });
const contentBucket = contentPlan.buckets.find(bucket => bucket.code === 'schema_v3_missing_content');
assert.ok(contentBucket);
const contentEntryId = contentBucket.affectedEntryIds[0];
const contentEntry = cloneRepairFixture(contentPack.entryOverrides[contentEntryId]);
contentEntry.content = {
  fact: 'Nami hides the buyback plan under Arlong pressure.',
  injection: 'When Arlong Park pressure is relevant, treat Nami as hiding coerced payments.',
};

const broadContentPatch = normalizeRepairPatch({
  strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
  findingIds: contentBucket.findingIds,
  operations: [{
    op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
    entryId: contentEntryId,
    fields: ['content', 'tags'],
    entry: contentEntry,
  }],
});
const broadContentResult = validateLoredeckRepairPatch(contentPack, broadContentPatch, {
  findings: contentPlan.findings,
  buckets: [contentBucket],
});
assert.equal(broadContentResult.ok, false);
assert.ok(broadContentResult.blocking.some(message => message.includes('not allowed')));

const unscopedContentPatch = normalizeRepairPatch({
  strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
  findingIds: contentBucket.findingIds,
  operations: [{
    op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
    entryId: contentEntryId,
    entry: contentEntry,
  }],
});
const unscopedContentResult = validateLoredeckRepairPatch(contentPack, unscopedContentPatch, {
  findings: contentPlan.findings,
  buckets: [contentBucket],
});
assert.equal(unscopedContentResult.ok, false);
assert.ok(unscopedContentResult.blocking.some(message => message.includes('missing field scope')));

const hiddenRetrievalMutationEntry = cloneRepairFixture(contentEntry);
hiddenRetrievalMutationEntry.retrieval = {
  activation: 'manual',
  frequency: 'normal',
  contextBoost: 'high',
};
const hiddenRetrievalMutationPatch = normalizeRepairPatch({
  source: LOREDECK_HEALTH_REPAIR_SOURCES.MODEL,
  strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.MODEL_DIRECT,
  findingIds: contentBucket.findingIds,
  operations: [{
    op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
    entryId: contentEntryId,
    fields: ['content'],
    entry: hiddenRetrievalMutationEntry,
  }],
});
const hiddenRetrievalMutationResult = validateLoredeckRepairPatch(contentPack, hiddenRetrievalMutationPatch, {
  findings: contentPlan.findings,
  buckets: [contentBucket],
});
assert.equal(hiddenRetrievalMutationResult.ok, false);
assert.ok(hiddenRetrievalMutationResult.blocking.some(message => message.includes('outside declared field scope')));

console.log('Loredeck health repair validator tests passed.');
