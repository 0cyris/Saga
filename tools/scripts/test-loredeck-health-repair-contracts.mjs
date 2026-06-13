import assert from 'node:assert/strict';

import {
  LOREDECK_HEALTH_REPAIR_OPERATION_NAMES,
  LOREDECK_HEALTH_REPAIR_STRATEGIES,
  createRepairHealthSnapshotSummary,
  createRepairRunSummary,
  normalizeRepairBucket,
  normalizeRepairChoiceSet,
  normalizeRepairFinding,
  normalizeRepairFindingsFromHealth,
  normalizeRepairPatch,
} from '../../src/loredecks/loredeck-health-repair-contracts.js';

const malformed = normalizeRepairFinding(null, 0, { packId: 'pack-a', severity: 'error' });
assert.equal(malformed.packId, 'pack-a');
assert.equal(malformed.severity, 'error');
assert.equal(malformed.code, 'unknown_finding');
assert.ok(malformed.findingId.startsWith('health_'));

const issue = {
  code: 'undefined_tag',
  severity: 'warning',
  message: 'Tags are undefined.',
  tags: [
    { tag: 'characternami', entryIds: ['nami-secret'] },
    { tag: 'fact', entryIds: ['nami-secret'] },
  ],
  file: '__memory__',
};
const normalized = normalizeRepairFinding(issue, 0, { packId: 'pack-a' });
const normalizedAgain = normalizeRepairFinding({ ...issue, tags: [...issue.tags] }, 99, { packId: 'pack-a' });
assert.equal(normalized.findingId, normalizedAgain.findingId);
assert.deepEqual(normalized.entryIds, ['nami-secret']);
assert.deepEqual(normalized.tagIds, ['characternami', 'fact']);

const health = {
  packId: 'pack-a',
  errors: [{ code: 'schema_v3_legacy_timing_fields', severity: 'error', message: 'bad', entryIds: ['e1'] }],
  warnings: [issue],
  suggestions: [{ code: 'orphaned_tag_definition', severity: 'suggestion', message: 'orphan', tagIds: ['tag:unused'] }],
};
const findings = normalizeRepairFindingsFromHealth(health);
assert.equal(findings.length, 3);
assert.equal(findings[0].severity, 'error');
assert.equal(findings[1].severity, 'warning');
assert.equal(findings[2].severity, 'suggestion');

const findingsById = new Map(findings.map(finding => [finding.findingId, finding]));
const bucket = normalizeRepairBucket({
  strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
  findingIds: findings.slice(0, 2).map(finding => finding.findingId),
}, findingsById);
assert.equal(bucket.strategy, LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK);
assert.equal(bucket.severity, 'error');
assert.deepEqual(bucket.affectedEntryIds, ['e1', 'nami-secret']);
assert.deepEqual(bucket.affectedTagIds, ['characternami', 'fact']);

const patch = normalizeRepairPatch({
  findingIds: [findings[0].findingId],
  strategy: LOREDECK_HEALTH_REPAIR_STRATEGIES.LOCAL_BULK,
  operations: [{
    op: LOREDECK_HEALTH_REPAIR_OPERATION_NAMES.UPSERT_ENTRY_OVERRIDE,
    entryId: 'e1',
    entry: { id: 'e1' },
  }],
});
assert.ok(patch.patchId.startsWith('patch_'));
assert.equal(patch.operations.length, 1);
assert.equal(patch.confidence, 1);

const choice = normalizeRepairChoiceSet({
  findingIds: [findings[1].findingId],
  question: 'Choose tag',
  options: [{
    optionId: 'A',
    label: 'character:nami',
    patch,
  }],
});
assert.ok(choice.choiceSetId.startsWith('choice_'));
assert.equal(choice.options.length, 1);
assert.equal(choice.options[0].patch.operations[0].entryId, 'e1');

const healthSnapshot = createRepairHealthSnapshotSummary({
  status: 'needs_review',
  errors: [{ code: 'a' }, { code: 'b' }],
  warnings: [{ code: 'c' }],
  summary: {
    schemaV3IssueCount: 2,
    brokenAnchorReferenceCount: 1,
  },
});
assert.equal(healthSnapshot.status, 'needs_review');
assert.equal(healthSnapshot.errorCount, 2);
assert.equal(healthSnapshot.warningCount, 1);
assert.equal(healthSnapshot.issueCount, 3);
assert.equal(healthSnapshot.schemaV3IssueCount, 2);
assert.equal(healthSnapshot.brokenAnchorReferenceCount, 1);

const runSummary = createRepairRunSummary({
  initialHealth: {
    errors: [{ code: 'schema_v3_legacy_timing_fields' }, { code: 'schema_v3_missing_content' }],
    warnings: [{ code: 'broken_anchor_reference' }],
  },
  checkpointHealth: {
    errors: [{ code: 'schema_v3_missing_content' }],
    warnings: [{ code: 'broken_anchor_reference' }],
  },
  finalHealth: {
    status: 'needs_review',
    warnings: [{ code: 'broken_anchor_reference' }],
  },
  initialPlan: {
    findings,
    buckets: [bucket],
    units: [],
    deferredUnits: [],
  },
  checkpointPlan: {
    summary: {
      modelDirectCount: 1,
      modelChoiceCount: 0,
      manualOnlyCount: 0,
      modelUnitCount: 1,
      deferredModelUnitCount: 2,
      totalModelUnitCount: 3,
    },
  },
  local: {
    patches: [patch],
    choiceSets: [],
  },
  appliedPatches: [patch],
  choiceSets: [choice],
  diagnostics: [],
  modelResults: [{ unitId: 'unit_1' }],
});
assert.equal(runSummary.outcome, 'needs_review');
assert.equal(runSummary.initialHealth.errorCount, 2);
assert.equal(runSummary.finalHealth.warningCount, 1);
assert.equal(runSummary.healthDelta.resolvedErrorCount, 2);
assert.equal(runSummary.checkpointDelta.resolvedErrorCount, 1);
assert.equal(runSummary.localPatchCount, 1);
assert.equal(runSummary.appliedPatchCount, 1);
assert.equal(runSummary.choiceSetCount, 1);
assert.equal(runSummary.modelResultCount, 1);
assert.equal(runSummary.deferredModelUnitCount, 2);
assert.equal(runSummary.totalModelUnitCount, 3);

console.log('Loredeck health repair contract tests passed.');
