import assert from 'node:assert/strict';

import {
  acceptLoredeckPendingChanges,
  configureLoredeckPendingChangeActions,
  rejectLoredeckPendingChanges,
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
  validateLoredeckForEditor: async (_pack, _button, options = {}) => {
    validationCalls += 1;
    assert.equal(options.updateLibrary, false);
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

const finalChange = createLoredeckRecordPatchChange({
  source: 'test',
  action: 'upsert_entry',
  targetKind: 'entry',
  title: 'Final pending payload',
  affectedEntryIds: ['final-entry'],
  payload: {
    entryOverrides: {
      'final-entry': {
        id: 'final-entry',
        title: 'Final entry',
        schemaVersion: 3,
      },
    },
  },
});

let finalPack = {
  packId: 'final-pending-review-health-pack',
  type: 'custom',
  title: 'Final Pending Review Health Pack',
  pendingChanges: [finalChange],
  entryOverrides: {},
};
let finalValidationCalls = 0;
configureLoredeckPendingChangeActions({
  toast: (message, type) => {
    toasts.push({ message, type });
  },
  persistLoredeckLibraryRecordMutation: (_pack, mutator, message) => {
    mutator(finalPack);
    if (message) persistMessages.push(message);
    return true;
  },
  getFreshLoredeckLibraryPack: () => finalPack,
  canValidateLoredeckInEditor: () => true,
  refreshLoredeckSurfaces: () => {},
  isGeneratedLoredeckPack: () => false,
  getAcceptedVirtualLoredeckEntries: () => [],
  validateLoredeckForEditor: async (_pack, _button, options = {}) => {
    finalValidationCalls += 1;
    assert.equal(options.updateLibrary, false);
    finalPack = {
      ...finalPack,
      pendingChanges: [finalChange],
      healthStatus: 'good',
    };
    return {
      health: {
        status: 'good',
        errors: [],
        warnings: [],
        summary: {
          errorCount: 0,
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

assert.equal(await acceptLoredeckPendingChanges(finalPack, [finalChange.changeId]), true);
assert.equal(finalValidationCalls, 1);
assert.deepEqual(finalPack.pendingChanges.map(change => change.changeId), []);
assert.equal(finalPack.entryOverrides['final-entry'].title, 'Final entry');
assert.deepEqual(toasts.at(-1), {
  message: 'Accepted 1 change and refreshed Pack Health: good (0 errors, 0 warnings).',
  type: 'success',
});

const alreadyAppliedChange = createLoredeckRecordPatchChange({
  source: 'test',
  action: 'upsert_entry',
  targetKind: 'entry',
  title: 'Already applied pending payload',
  affectedEntryIds: ['already-applied-entry'],
  payload: {
    entryOverrides: {
      'already-applied-entry': {
        id: 'already-applied-entry',
        title: 'Already applied entry',
        schemaVersion: 3,
      },
    },
    disabledEntryIdsRemove: ['already-applied-entry'],
  },
});

let alreadyAppliedPack = {
  packId: 'already-applied-pending-review-pack',
  type: 'custom',
  title: 'Already Applied Pending Review Pack',
  pendingChanges: [alreadyAppliedChange],
  entryOverrides: {
    'already-applied-entry': {
      id: 'already-applied-entry',
      title: 'Already applied entry',
      schemaVersion: 3,
    },
  },
};
configureLoredeckPendingChangeActions({
  toast: (message, type) => {
    toasts.push({ message, type });
  },
  persistLoredeckLibraryRecordMutation: (_pack, mutator, message) => {
    mutator(alreadyAppliedPack);
    if (message) persistMessages.push(message);
    return true;
  },
  getFreshLoredeckLibraryPack: () => alreadyAppliedPack,
  canValidateLoredeckInEditor: () => false,
  refreshLoredeckSurfaces: () => {},
  isGeneratedLoredeckPack: () => false,
  getAcceptedVirtualLoredeckEntries: () => [],
  refreshLoredeckCreatorWorkbenchBody: () => {},
  refreshHeader: () => {},
});

assert.equal(await acceptLoredeckPendingChanges(alreadyAppliedPack, [alreadyAppliedChange.changeId]), true);
assert.deepEqual(alreadyAppliedPack.pendingChanges, []);
assert.equal(alreadyAppliedPack.entryOverrides['already-applied-entry'].title, 'Already applied entry');

const rejectChange = createLoredeckRecordPatchChange({
  source: 'test',
  action: 'upsert_entry',
  targetKind: 'entry',
  title: 'Reject pending payload',
  affectedEntryIds: ['reject-entry'],
  payload: {
    entryOverrides: {
      'reject-entry': {
        id: 'reject-entry',
        title: 'Reject entry',
        schemaVersion: 3,
      },
    },
  },
});

let rejectPack = {
  packId: 'reject-pending-review-pack',
  type: 'custom',
  title: 'Reject Pending Review Pack',
  pendingChanges: [rejectChange],
  entryOverrides: {},
};
let flushCalls = 0;
configureLoredeckPendingChangeActions({
  toast: (message, type) => {
    toasts.push({ message, type });
  },
  persistLoredeckLibraryRecordMutation: (_pack, mutator) => {
    mutator(rejectPack);
    return true;
  },
  getFreshLoredeckLibraryPack: () => rejectPack,
  flushLoredeckStorageWrites: async () => {
    flushCalls += 1;
    return { ok: false, error: 'stale write test failure' };
  },
  refreshLoredeckCreatorWorkbenchBody: () => {},
  refreshHeader: () => {},
});

assert.equal(await rejectLoredeckPendingChanges(rejectPack, [rejectChange.changeId]), false);
assert.equal(flushCalls, 1);
assert.deepEqual(rejectPack.pendingChanges, []);
assert.equal(toasts.at(-1).type, 'error');
assert.ok(toasts.at(-1).message.includes('stale write test failure'));

console.warn = originalConsoleWarn;

console.log('Loredeck Pending Review health refresh tests passed.');
