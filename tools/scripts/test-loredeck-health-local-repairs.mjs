import assert from 'node:assert/strict';

import {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
  LOREDECK_HEALTH_REPAIR_STRATEGIES,
} from '../../src/loredecks/loredeck-health-repair-contracts.js';
import {
  buildLoredeckHealthRepairPlan,
} from '../../src/loredecks/loredeck-health-fix-planner.js';
import {
  buildLoredeckLocalRepairForBucket,
  buildLoredeckLocalRepairsForPlan,
} from '../../src/loredecks/loredeck-health-local-repairs.js';
import {
  validateLoredeckRepairChoiceSet,
  validateLoredeckRepairPatch,
} from '../../src/loredecks/loredeck-health-repair-validator.js';
import {
  buildAmbiguousTagRepairPack,
  buildArlongStyleRepairPack,
  buildContentAliasRepairPack,
  buildExactAnchorNormalizationPack,
  buildManifestStatsMismatchPack,
  buildRepairHealth,
  buildRetrievalDefaultsRepairPack,
  buildWideRetrievalRepairPack,
  cloneRepairFixture,
} from './loredeck-health-repair-test-fixtures.mjs';

const pack = buildArlongStyleRepairPack({ count: 4 });
const originalJson = JSON.stringify(pack);
const health = buildRepairHealth(pack);
const plan = buildLoredeckHealthRepairPlan({ pack, health });
const local = buildLoredeckLocalRepairsForPlan(pack, plan);

assert.equal(JSON.stringify(pack), originalJson, 'Local patch building must not mutate the source pack.');
assert.ok(local.patches.length >= 2);
assert.ok(local.choiceSets.length >= 1);

const schemaPatch = local.patches.find(patch => patch.operations.length === 4);
assert.ok(schemaPatch, 'Expected a schema cleanup patch for all four entries.');
for (const operation of schemaPatch.operations) {
  assert.equal(Object.hasOwn(operation.entry, 'fact'), false);
  assert.equal(Object.hasOwn(operation.entry, 'date'), false);
  assert.equal(Object.hasOwn(operation.entry, 'whoKnowsTruth'), false);
}
assert.equal(validateLoredeckRepairPatch(pack, schemaPatch, {
  findings: plan.findings,
  buckets: plan.buckets,
}).ok, true);

const tagPatch = local.patches.find(patch => patch.operations.some(operation => operation.fields.includes('tags')));
assert.ok(tagPatch, 'Expected a deterministic tag repair patch.');
for (const operation of tagPatch.operations) {
  assert.equal(operation.entry.tags.includes('fact'), false);
  assert.equal(operation.entry.tags.includes('other'), false);
  assert.ok(operation.entry.tags.every(tag => tag.includes(':')));
}

const contextChoice = local.choiceSets.find(choice => choice.code === 'broken_anchor_reference');
assert.ok(contextChoice, 'Expected a Context anchor choice set.');
assert.equal(contextChoice.options.length, 1);
assert.equal(validateLoredeckRepairChoiceSet(pack, contextChoice, {
  findings: plan.findings,
  buckets: plan.buckets,
}).ok, true);

const ambiguousPack = buildAmbiguousTagRepairPack();
const ambiguousHealth = buildRepairHealth(ambiguousPack);
const ambiguousPlan = buildLoredeckHealthRepairPlan({ pack: ambiguousPack, health: ambiguousHealth });
const ambiguousTagBucket = ambiguousPlan.buckets.find(bucket => bucket.code === 'undefined_tag' && bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE);
assert.ok(ambiguousTagBucket, 'Expected ambiguous compact tag bucket.');
const ambiguousResult = buildLoredeckLocalRepairForBucket(ambiguousPack, ambiguousTagBucket);
assert.equal(ambiguousResult.patches.length, 0);
assert.equal(ambiguousResult.choiceSets.length, 1);
assert.deepEqual(ambiguousResult.choiceSets[0].options.map(option => option.label), ['character:nami', 'character_nami']);

const beforeAmbiguous = cloneRepairFixture(ambiguousPack);
assert.deepEqual(ambiguousPack, beforeAmbiguous, 'Ambiguous choice building must not mutate the source pack.');

const manifestPack = buildManifestStatsMismatchPack();
const manifestHealth = buildRepairHealth(manifestPack);
const manifestPlan = buildLoredeckHealthRepairPlan({ pack: manifestPack, health: manifestHealth });
const manifestLocal = buildLoredeckLocalRepairsForPlan(manifestPack, manifestPlan);
const manifestPatches = manifestLocal.patches.filter(patch => patch.operations.some(operation => operation.op === LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.REFRESH_MANIFEST_STATS));
assert.equal(manifestPatches.length, 2);
for (const patch of manifestPatches) {
  const operation = patch.operations[0];
  assert.equal(operation.stats.entryCount, 3);
  assert.deepEqual(operation.stats.categoryCounts, { other: 2, secret: 1 });
  assert.equal(validateLoredeckRepairPatch(manifestPack, patch, {
    findings: manifestPlan.findings,
    buckets: manifestPlan.buckets,
  }).ok, true);
}

const exactAnchorPack = buildExactAnchorNormalizationPack();
const exactAnchorHealth = buildRepairHealth(exactAnchorPack);
const exactAnchorPlan = buildLoredeckHealthRepairPlan({ pack: exactAnchorPack, health: exactAnchorHealth });
const exactAnchorLocal = buildLoredeckLocalRepairsForPlan(exactAnchorPack, exactAnchorPlan);
const exactAnchorPatch = exactAnchorLocal.patches.find(patch => patch.operations.some(operation => operation.fields.includes('context')));
assert.ok(exactAnchorPatch, 'Expected exact Context anchor normalization patch.');
assert.equal(exactAnchorPatch.operations.length, 1);
assert.equal(exactAnchorPatch.operations[0].entry.context.validToAnchor, 'one-piece.arlong.end');
assert.equal(validateLoredeckRepairPatch(exactAnchorPack, exactAnchorPatch, {
  findings: exactAnchorPlan.findings,
  buckets: exactAnchorPlan.buckets,
}).ok, true);

const widePack = buildWideRetrievalRepairPack();
const wideHealth = buildRepairHealth(widePack);
const widePlan = buildLoredeckHealthRepairPlan({ pack: widePack, health: wideHealth });
const wideLocal = buildLoredeckLocalRepairsForPlan(widePack, widePlan);
const widePatch = wideLocal.patches.find(patch => patch.findingIds.some(id => widePlan.findings.find(finding => finding.findingId === id)?.code === 'schema_v3_wide_lore_retrieval'));
assert.ok(widePatch, 'Expected local wide retrieval patch.');
assert.equal(widePatch.operations.length, 1);
assert.deepEqual(widePatch.operations[0].fields, ['retrieval']);
assert.deepEqual(widePatch.operations[0].entry.retrieval, {
  activation: 'topic_or_entity',
  frequency: 'low',
  contextBoost: 'low',
});
assert.equal(validateLoredeckRepairPatch(widePack, widePatch, {
  findings: widePlan.findings,
  buckets: widePlan.buckets,
}).ok, true);

const contentAliasPack = buildContentAliasRepairPack();
const contentAliasHealth = buildRepairHealth(contentAliasPack);
const contentAliasPlan = buildLoredeckHealthRepairPlan({ pack: contentAliasPack, health: contentAliasHealth });
const contentAliasLocal = buildLoredeckLocalRepairsForPlan(contentAliasPack, contentAliasPlan);
const contentAliasPatch = contentAliasLocal.patches.find(patch => patch.findingIds.some(id => contentAliasPlan.findings.find(finding => finding.findingId === id)?.code === 'schema_v3_missing_content'));
assert.ok(contentAliasPatch, 'Expected local content alias patch.');
assert.equal(contentAliasPatch.operations.length, 1);
assert.deepEqual(contentAliasPatch.operations[0].fields, ['content']);
assert.deepEqual(contentAliasPatch.operations[0].entry.content, {
  fact: 'Nami hides the buyback deal because Arlong controls Cocoyasi through debt and fear.',
  injection: 'When Nami or Arlong Park pressure is relevant, treat Nami as hiding coerced payments from her friends.',
});
assert.equal(validateLoredeckRepairPatch(contentAliasPack, contentAliasPatch, {
  findings: contentAliasPlan.findings,
  buckets: contentAliasPlan.buckets,
}).ok, true);

const retrievalPack = buildRetrievalDefaultsRepairPack();
const retrievalHealth = buildRepairHealth(retrievalPack);
const retrievalPlan = buildLoredeckHealthRepairPlan({ pack: retrievalPack, health: retrievalHealth });
const retrievalLocal = buildLoredeckLocalRepairsForPlan(retrievalPack, retrievalPlan);
const retrievalPatches = retrievalLocal.patches.filter(patch => patch.findingIds.some(id => retrievalPlan.findings.find(finding => finding.findingId === id)?.code.includes('retrieval')));
assert.equal(retrievalPatches.length, 2);
for (const patch of retrievalPatches) {
  assert.equal(patch.operations.length, 1);
  assert.deepEqual(patch.operations[0].fields, ['retrieval']);
  assert.equal(validateLoredeckRepairPatch(retrievalPack, patch, {
    findings: retrievalPlan.findings,
    buckets: retrievalPlan.buckets,
  }).ok, true);
}
const missingRetrievalPatch = retrievalPatches.find(patch => patch.operations[0].entryId === 'arlong-style-entry-01');
assert.deepEqual(missingRetrievalPatch.operations[0].entry.retrieval, {
  activation: 'context_or_topic',
  frequency: 'normal',
  contextBoost: 'high',
});
const incompleteRetrievalPatch = retrievalPatches.find(patch => patch.operations[0].entryId === 'namis-childhood-under-arlongs-rule');
assert.deepEqual(incompleteRetrievalPatch.operations[0].entry.retrieval, {
  frequency: 'normal',
  activation: 'context_or_topic',
  contextBoost: 'high',
});

console.log('Loredeck health local repair tests passed.');
