import assert from 'node:assert/strict';

import {
  LOREDECK_HEALTH_REPAIR_STRATEGIES,
  normalizeRepairFindingsFromHealth,
} from '../../src/loredecks/loredeck-health-repair-contracts.js';
import {
  buildLoredeckHealthRepairPlan,
} from '../../src/loredecks/loredeck-health-fix-planner.js';
import {
  buildArlongStyleRepairPack,
  buildContentAliasRepairPack,
  buildExactAnchorNormalizationPack,
  buildLargeModelRepairPack,
  buildManifestStatsMismatchPack,
  buildRepairHealth,
  buildRetrievalDefaultsRepairPack,
  buildWideRetrievalRepairPack,
} from './loredeck-health-repair-test-fixtures.mjs';

const pack = buildArlongStyleRepairPack();
const health = buildRepairHealth(pack);
assert.equal(health.status, 'has_errors');
assert.equal(health.summary.errorCount, 56);
assert.equal(health.summary.schemaV3IssueCount, 56);
assert.ok(health.summary.undefinedTagCount > 0);
assert.equal(health.summary.brokenAnchorReferenceCount, 1);

const findings = normalizeRepairFindingsFromHealth(health);
const reversedFindings = normalizeRepairFindingsFromHealth({
  ...health,
  errors: [...health.errors].reverse(),
  warnings: [...health.warnings].reverse(),
  suggestions: [...health.suggestions].reverse(),
});
assert.deepEqual(
  new Set(findings.map(finding => finding.findingId)),
  new Set(reversedFindings.map(finding => finding.findingId)),
  'Finding IDs should remain stable when issue ordering changes.'
);

const plan = buildLoredeckHealthRepairPlan({ pack, health });
assert.equal(plan.summary.findingCount, findings.length);
assert.ok(plan.summary.localBulkCount >= 2);
assert.ok(plan.summary.localChoiceCount >= 1);
assert.ok(plan.summary.manualOnlyCount >= 1);

const schemaBucket = plan.buckets.find(bucket => bucket.code === 'schema_v3_legacy_timing_fields');
assert.ok(schemaBucket);
assert.equal(schemaBucket.strategy, LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK);
assert.equal(schemaBucket.affectedEntryIds.length, 56);
assert.equal(schemaBucket.estimatedUnits, 0);

const tagBucket = plan.buckets.find(bucket => bucket.code === 'undefined_tag' && bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK);
assert.ok(tagBucket);
assert.ok(tagBucket.affectedTagIds.includes('characternami'));
assert.ok(tagBucket.affectedTagIds.includes('characterarlong'));
assert.ok(tagBucket.affectedTagIds.includes('factionarlong-pirates'));
assert.ok(tagBucket.affectedTagIds.includes('conceptbuyback-deal'));

const contextChoiceBucket = plan.buckets.find(bucket => bucket.code === 'broken_anchor_reference' && bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_REVIEW_CHOICE);
assert.ok(contextChoiceBucket);
assert.deepEqual(contextChoiceBucket.affectedTimelineIds, ['one-piece.arlong.arlong-betrays-buyback-deal']);

assert.ok(plan.units.every(unit => unit.entryIds.length <= 8));
assert.ok(plan.units.length <= 8);

const manifestPack = buildManifestStatsMismatchPack();
const manifestHealth = buildRepairHealth(manifestPack);
assert.equal(manifestHealth.summary.errorCount, 0);
assert.ok(manifestHealth.warnings.some(issue => issue.code === 'manifest_entry_count_mismatch'));
assert.ok(manifestHealth.warnings.some(issue => issue.code === 'manifest_category_counts_mismatch'));

const manifestPlan = buildLoredeckHealthRepairPlan({ pack: manifestPack, health: manifestHealth });
const manifestBuckets = manifestPlan.buckets.filter(bucket => bucket.code.startsWith('manifest_'));
assert.equal(manifestBuckets.length, 2);
assert.ok(manifestBuckets.every(bucket => bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK));
assert.ok(manifestBuckets.every(bucket => bucket.targetKind === 'pack'));
assert.ok(manifestBuckets.every(bucket => bucket.estimatedUnits === 0));

const largeModelPack = buildLargeModelRepairPack({ count: 57 });
const largeModelHealth = buildRepairHealth(largeModelPack);
assert.equal(largeModelHealth.summary.errorCount, 57);
assert.ok(largeModelHealth.errors.every(issue => issue.code === 'schema_v3_missing_content'));
const largeModelPlan = buildLoredeckHealthRepairPlan({ pack: largeModelPack, health: largeModelHealth });
assert.equal(largeModelPlan.units.length, 8);
assert.equal(largeModelPlan.deferredUnits.length, 0);
assert.equal(largeModelPlan.summary.modelUnitCount, 8);
assert.equal(largeModelPlan.summary.deferredModelUnitCount, 0);
assert.equal(largeModelPlan.summary.totalModelUnitCount, 8);
assert.ok(largeModelPlan.units.every(unit => unit.code === 'schema_v3_missing_content'));
assert.ok(largeModelPlan.units.every(unit => unit.entryIds.length <= 8));
assert.ok(largeModelPlan.units.every(unit => unit.findingIds.length <= 8));
assert.equal(largeModelPlan.units.at(-1).entryIds.length, 1);
assert.equal(new Set(largeModelPlan.units.flatMap(unit => unit.entryIds)).size, 57);
assert.equal(new Set(largeModelPlan.units.flatMap(unit => unit.findingIds)).size, 57);

const contentAliasPack = buildContentAliasRepairPack();
const contentAliasHealth = buildRepairHealth(contentAliasPack);
assert.equal(contentAliasHealth.summary.errorCount, 1);
assert.equal(contentAliasHealth.errors[0].code, 'schema_v3_missing_content');
const contentAliasPlan = buildLoredeckHealthRepairPlan({ pack: contentAliasPack, health: contentAliasHealth });
const contentAliasBucket = contentAliasPlan.buckets.find(bucket => bucket.code === 'schema_v3_missing_content');
assert.ok(contentAliasBucket);
assert.equal(contentAliasBucket.strategy, LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK);
assert.equal(contentAliasBucket.estimatedUnits, 0);
assert.equal(contentAliasPlan.units.length, 0);

const retrievalPack = buildRetrievalDefaultsRepairPack();
const retrievalHealth = buildRepairHealth(retrievalPack);
assert.equal(retrievalHealth.summary.errorCount, 2);
const retrievalPlan = buildLoredeckHealthRepairPlan({ pack: retrievalPack, health: retrievalHealth });
const retrievalBuckets = retrievalPlan.buckets.filter(bucket => bucket.code.includes('retrieval'));
assert.equal(retrievalBuckets.length, 2);
assert.ok(retrievalBuckets.every(bucket => bucket.strategy === LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK));
assert.ok(retrievalBuckets.every(bucket => bucket.estimatedUnits === 0));
assert.equal(retrievalPlan.units.length, 0);

const deferredModelPack = buildLargeModelRepairPack({ count: 73, packId: 'deferred-model-repair-pack' });
const deferredModelHealth = buildRepairHealth(deferredModelPack);
const deferredModelPlan = buildLoredeckHealthRepairPlan({ pack: deferredModelPack, health: deferredModelHealth });
const deferredBucket = deferredModelPlan.buckets.find(bucket => bucket.code === 'schema_v3_missing_content');
assert.ok(deferredBucket);
assert.equal(deferredBucket.estimatedUnits, 10);
assert.equal(deferredModelPlan.units.length, 8);
assert.equal(deferredModelPlan.deferredUnits.length, 2);
assert.equal(deferredModelPlan.summary.modelUnitCount, 8);
assert.equal(deferredModelPlan.summary.deferredModelUnitCount, 2);
assert.equal(deferredModelPlan.summary.totalModelUnitCount, 10);
assert.ok(deferredModelPlan.deferredUnits.every(unit => unit.deferred === true));
assert.equal(new Set([
  ...deferredModelPlan.units.flatMap(unit => unit.entryIds),
  ...deferredModelPlan.deferredUnits.flatMap(unit => unit.entryIds),
]).size, 73);

const exactAnchorPack = buildExactAnchorNormalizationPack();
const exactAnchorHealth = buildRepairHealth(exactAnchorPack);
assert.ok(exactAnchorHealth.warnings.some(issue => issue.code === 'broken_anchor_reference'));
const exactAnchorPlan = buildLoredeckHealthRepairPlan({ pack: exactAnchorPack, health: exactAnchorHealth });
const exactAnchorBucket = exactAnchorPlan.buckets.find(bucket => bucket.code === 'broken_anchor_reference');
assert.ok(exactAnchorBucket);
assert.equal(exactAnchorBucket.strategy, LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK);
assert.deepEqual(exactAnchorBucket.affectedTimelineIds, ['one-piece.arlong.end']);
assert.equal(exactAnchorBucket.estimatedUnits, 0);

const widePack = buildWideRetrievalRepairPack();
const wideHealth = buildRepairHealth(widePack);
assert.equal(wideHealth.summary.warningCount, 1);
assert.equal(wideHealth.warnings[0].code, 'schema_v3_wide_lore_retrieval');
const widePlan = buildLoredeckHealthRepairPlan({ pack: widePack, health: wideHealth });
const wideBucket = widePlan.buckets.find(bucket => bucket.code === 'schema_v3_wide_lore_retrieval');
assert.ok(wideBucket);
assert.equal(wideBucket.strategy, LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK);
assert.equal(wideBucket.affectedEntryIds.length, 1);
assert.equal(wideBucket.estimatedUnits, 0);

console.log('Loredeck health repair planner tests passed.');
