import assert from 'node:assert/strict';

import {
  buildLoredeckCreatorEntryRejectionDiagnostics,
  buildLoredeckCreatorEntryRetryContextByTarget,
  createLoredeckCreatorEntryGuardRejectedAllError,
  getLoredeckCreatorEntryRejectedTargetIds,
  isLoredeckCreatorEntryGuardRejectedAllError,
  LOREDECK_CREATOR_ENTRY_GUARD_REJECTED_ALL,
  summarizeLoredeckCreatorEntryRejections,
} from '../../src/loredecks/loredeck-creator-entry-rejection-diagnostics.js';

const diagnostics = buildLoredeckCreatorEntryRejectionDiagnostics({
  entryId: 'genzos-vigil-over-cocoyashi',
  targetTitle: {
    titleId: 'genzos-vigil-over-cocoyashi',
    targetEntryId: 'genzos-vigil-over-cocoyashi',
    title: "Genzo's vigil over Cocoyashi",
  },
  errors: [
    'Unknown tag location:cocoyashi.',
    'Unknown validToAnchor one-piece.arlong.missing-anchor.',
    'Entry genzos-vigil-over-cocoyashi is outside this Creator micro-batch.',
    'genzos-vigil-over-cocoyashi: Missing context.label.',
  ],
});

assert.equal(diagnostics.length, 4);

assert.equal(diagnostics[0].reasonCode, 'unknown_tag');
assert.equal(diagnostics[0].retryable, true);
assert.equal(diagnostics[0].safeLocalRepairAvailable, true);
assert.deepEqual(diagnostics[0].unknownTags, ['location:cocoyashi']);

assert.equal(diagnostics[1].reasonCode, 'unknown_anchor');
assert.equal(diagnostics[1].anchorField, 'validToAnchor');
assert.equal(diagnostics[1].retryable, true);
assert.equal(diagnostics[1].safeLocalRepairAvailable, false);
assert.deepEqual(diagnostics[1].unknownAnchors, ['one-piece.arlong.missing-anchor']);

assert.equal(diagnostics[2].reasonCode, 'outside_micro_batch');
assert.equal(diagnostics[2].retryable, false);

assert.equal(diagnostics[3].reasonCode, 'invalid_schema_shape');
assert.equal(diagnostics[3].retryable, true);
assert.equal(diagnostics[3].targetTitleId, 'genzos-vigil-over-cocoyashi');
assert.equal(diagnostics[3].title, "Genzo's vigil over Cocoyashi");

const summary = summarizeLoredeckCreatorEntryRejections(diagnostics);
assert.equal(summary.count, 4);
assert.equal(summary.targetCount, 1);
assert.deepEqual(summary.targetEntryIds, ['genzos-vigil-over-cocoyashi']);
assert.deepEqual(summary.unknownTags, ['location:cocoyashi']);
assert.deepEqual(summary.unknownAnchors, ['one-piece.arlong.missing-anchor']);
assert.equal(summary.byReason.unknown_tag, 1);
assert.equal(summary.byReason.unknown_anchor, 1);
assert.equal(summary.byReason.outside_micro_batch, 1);
assert.equal(summary.byReason.invalid_schema_shape, 1);

const retryContextByTarget = buildLoredeckCreatorEntryRetryContextByTarget({ rejectionDiagnostics: diagnostics });
const retryContext = retryContextByTarget.get('genzos-vigil-over-cocoyashi');
assert.equal(retryContext.title, "Genzo's vigil over Cocoyashi");
assert.deepEqual(retryContext.reasonCodes, ['unknown_tag', 'unknown_anchor', 'outside_micro_batch', 'invalid_schema_shape']);
assert.deepEqual(retryContext.unknownTags, ['location:cocoyashi']);
assert.deepEqual(retryContext.unknownAnchors, ['one-piece.arlong.missing-anchor']);
assert.ok(retryContext.instruction.includes('Use only targetTitleDraft.allowedEntryTags'));

const rejectedAllError = createLoredeckCreatorEntryGuardRejectedAllError({
  invalidCount: 4,
  rejectionDiagnostics: diagnostics,
  rejectionSummary: summary,
});
assert.equal(rejectedAllError.name, 'LoredeckCreatorEntryGuardRejectedAllError');
assert.equal(rejectedAllError.code, LOREDECK_CREATOR_ENTRY_GUARD_REJECTED_ALL);
assert.equal(rejectedAllError.retrySmallerPreferred, true);
assert.equal(isLoredeckCreatorEntryGuardRejectedAllError(rejectedAllError), true);
assert.deepEqual(getLoredeckCreatorEntryRejectedTargetIds(rejectedAllError), ['genzos-vigil-over-cocoyashi']);
assert.deepEqual(getLoredeckCreatorEntryRejectedTargetIds({
  diagnostic: {
    errorCode: LOREDECK_CREATOR_ENTRY_GUARD_REJECTED_ALL,
    rejectionSummary: summary,
  },
}), ['genzos-vigil-over-cocoyashi']);
assert.equal(isLoredeckCreatorEntryGuardRejectedAllError({
  diagnostic: { errorCode: LOREDECK_CREATOR_ENTRY_GUARD_REJECTED_ALL },
}), true);
assert.equal(isLoredeckCreatorEntryGuardRejectedAllError({ code: 'commit_failed' }), false);

console.log('Loredeck Creator entry rejection recovery tests passed.');
