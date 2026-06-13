import assert from 'node:assert/strict';

import {
  configureGeneratedLoredeckReadiness,
  getGeneratedLoredeckExportReadiness,
} from '../../src/runtime/loredeck-generated-readiness.js';

const pack = {
  packId: 'generated-health-pack',
  type: 'generated',
  manifestData: {
    id: 'generated-health-pack',
    type: 'generated',
    entrySchemaVersion: 3,
  },
  entrySchemaVersion: 3,
  entryOverrides: {
    entry_one: {
      id: 'entry_one',
      title: 'Entry One',
      schemaVersion: 3,
      content: { fact: 'Fact', injection: 'Injection' },
    },
  },
  timelineRegistry: {
    anchors: [{ id: 'start', sortKey: 1 }],
  },
  tagRegistry: {
    tags: { 'character:nami': { label: 'Nami' } },
  },
};

configureGeneratedLoredeckReadiness({
  getLoredeckPendingChanges: () => [],
  getLoredeckAssistantDraftChanges: () => [],
  getLoredeckAssistantDraftCacheRecord: () => ({}),
  getLoredeckCreatorPipelineReadiness: () => ({
    warnings: [],
    coverage: {
      finalizeAcknowledgementRequired: false,
      finalizeAcknowledged: false,
    },
  }),
  isLoredeckHealthStatusStale: () => false,
});

const healthWithErrors = {
  status: 'has_errors',
  errors: [{ code: 'schema_v3_missing_content', message: 'Missing content.' }, { code: 'broken_anchor_reference', message: 'Broken anchor.' }],
  warnings: [{ code: 'undefined_tag', message: 'Undefined tag.' }],
  suggestions: [],
  summary: {
    errorCount: 2,
    warningCount: 1,
    suggestionCount: 0,
  },
};

const blocked = getGeneratedLoredeckExportReadiness(pack, healthWithErrors);
assert.equal(blocked.ready, false);
assert.equal(blocked.healthScanned, true);
assert.equal(blocked.healthErrorCount, 2);
assert.equal(blocked.healthWarningCount, 1);
assert.equal(blocked.healthSummary, 'Pack Health: 2 errors, 1 warning');
assert.ok(blocked.blockers.includes('Pack Health: 2 errors, 1 warning.'));
const staleHealthWarning = ['Latest Deck', 'Health has errors'].join(' ');
assert.equal(blocked.warnings.some(warning => warning.includes(staleHealthWarning)), false);

const healthWithWarnings = {
  status: 'needs_review',
  errors: [],
  warnings: [{ code: 'undefined_tag', message: 'Undefined tag.' }],
  suggestions: [],
  summary: {
    errorCount: 0,
    warningCount: 1,
    suggestionCount: 0,
  },
};

const warningOnly = getGeneratedLoredeckExportReadiness(pack, healthWithWarnings);
assert.equal(warningOnly.ready, true);
assert.equal(warningOnly.healthErrorCount, 0);
assert.equal(warningOnly.healthWarningCount, 1);
assert.ok(warningOnly.warnings.includes('Pack Health: 0 errors, 1 warning.'));

const unscanned = getGeneratedLoredeckExportReadiness(pack, null);
assert.equal(unscanned.ready, true);
assert.equal(unscanned.healthScanned, false);
assert.equal(unscanned.healthSummary, 'Pack Health: Not scanned');
assert.ok(unscanned.warnings.includes('Pack Health has not been run for this Generated Loredeck.'));

console.log('Generated Loredeck readiness health tests passed.');
