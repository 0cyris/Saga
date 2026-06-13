import assert from 'node:assert/strict';

import {
  acceptLoredeckPendingChanges,
  configureLoredeckPendingChangeActions,
} from '../../src/runtime/loredeck-pending-change-actions.js';
import {
  createLoredeckRecordPatchChange,
  configureLoredeckPendingChangeModel,
} from '../../src/runtime/loredeck-pending-change-model.js';

configureLoredeckPendingChangeModel({
  normalizeLoredeckPatchEntryOverride: (_record, rawEntry, id) => {
    if (id === 'broken-entry') throw new Error('Broken entry payload');
    return rawEntry;
  },
});

const pendingChange = createLoredeckRecordPatchChange({
  source: 'test',
  action: 'upsert_entry',
  targetKind: 'entry',
  title: 'Accept Nami pressure',
  affectedEntryIds: ['nami-pressure'],
  payload: {
    entryOverrides: {
      'nami-pressure': {
        id: 'nami-pressure',
        title: 'Nami pressure',
        schemaVersion: 3,
        content: {
          fact: 'Nami is under Arlong pressure.',
          injection: 'Treat Nami as hiding coercion from Arlong.',
        },
      },
    },
  },
});

const badChange = createLoredeckRecordPatchChange({
  source: 'test',
  action: 'upsert_entry',
  targetKind: 'entry',
  title: 'Broken pending payload',
  affectedEntryIds: ['broken-entry'],
  payload: {
    entryOverrides: {
      'broken-entry': {
        id: 'broken-entry',
        title: 'Broken entry',
        schemaVersion: 3,
      },
    },
  },
});

let currentPack = {
  packId: 'pending-review-health-pack',
  type: 'custom',
  title: 'Pending Review Health Pack',
  pendingChanges: [pendingChange, badChange],
  entryOverrides: {},
};
const toasts = [];
const persistMessages = [];
let validationCalls = 0;
const consoleWarnings = [];
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  consoleWarnings.push(args);
};

configureLoredeckPendingChangeActions({
  toast: (message, type) => {
    toasts.push({ message, type });
  },
  persistLoredeckLibraryRecordMutation: (_pack, mutator, message) => {
    mutator(currentPack);
    persistMessages.push(message);
    return true;
  },
  getFreshLoredeckLibraryPack: () => currentPack,
  canValidateLoredeckInEditor: () => true,
  refreshLoredeckSurfaces: () => {},
  isGeneratedLoredeckPack: () => false,
  getAcceptedVirtualLoredeckEntries: () => [],
  validateLoredeckForEditor: async () => {
    validationCalls += 1;
    currentPack = {
      ...currentPack,
      healthStatus: 'has_errors',
    };
    return {
      health: {
        status: 'has_errors',
        errors: [{ code: 'schema_v3_legacy_timing_fields' }],
        warnings: [],
        summary: {
          errorCount: 1,
          warningCount: 0,
        },
      },
    };
  },
  clearCanonLoreDatabaseCache: () => {},
  clearContextIndexCache: () => {},
  normalizeLoredeckCreatorTitleId: (_value, fallback) => fallback,
  normalizeLoredeckCreatorTitleIdList: value => Array.isArray(value) ? value : [],
  refreshGeneratedLoredeckDerivedMetadata: pack => pack,
  getLoredeckCreatorBriefCache: () => ({}),
  setLoredeckCreatorBriefCache: () => {},
  isLoredeckCreatorPlanningPendingChange: () => false,
  refreshLoredeckCreatorWorkbenchBody: () => {},
  refreshHeader: () => {},
});

assert.equal(await acceptLoredeckPendingChanges(currentPack, [pendingChange.changeId, badChange.changeId]), true);
assert.equal(validationCalls, 1);
assert.deepEqual(currentPack.pendingChanges.map(change => change.changeId), [badChange.changeId]);
assert.equal(currentPack.entryOverrides['nami-pressure'].title, 'Nami pressure');
assert.ok(persistMessages.some(message => message.includes('Pack Health marked stale.')));
assert.ok(toasts.some(item => item.type === 'warning' && item.message.includes('Broken pending payload') && item.message.includes('remain in Pending Review')));
assert.deepEqual(toasts.at(-1), {
  message: 'Accepted 1 change and refreshed Pack Health: has_errors (1 error, 0 warnings). Open Pack Health Center for grouped findings.',
  type: 'error',
});

assert.equal(await acceptLoredeckPendingChanges(currentPack, [badChange.changeId]), false);
assert.deepEqual(currentPack.pendingChanges.map(change => change.changeId), [badChange.changeId]);
assert.equal(validationCalls, 1);
assert.ok(toasts.at(-1).message.includes('Broken pending payload'));
assert.equal(toasts.at(-1).type, 'error');
assert.equal(consoleWarnings.length, 2);

console.warn = originalConsoleWarn;

console.log('Loredeck Pending Review health refresh tests passed.');
