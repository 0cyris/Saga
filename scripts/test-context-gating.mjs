import assert from 'node:assert/strict';
import { evaluateEntryContextGate, CONTEXT_GATE_STATUSES } from '../context-gating.js';

const index = {
  anchors: [
    { id: 'mcu.age_of_ultron', packId: 'mcu-infinity-saga', label: 'Age of Ultron', sortKey: 2200 },
    { id: 'mcu.civil_war', packId: 'mcu-infinity-saga', label: 'Civil War', sortKey: 2600 },
    { id: 'mcu.infinity_war', packId: 'mcu-infinity-saga', label: 'Infinity War', sortKey: 3200 },
  ],
  windows: [{
    id: 'mcu.ultron_to_civil_war',
    packId: 'mcu-infinity-saga',
    anchorFrom: 'mcu.age_of_ultron',
    anchorTo: 'mcu.civil_war',
    sortKeyFrom: 2200,
    sortKeyTo: 2600,
  }],
};

const state = {
  loredeckContexts: {
    'mcu-infinity-saga': {
      packId: 'mcu-infinity-saga',
      anchorId: 'mcu.civil_war',
      phase: 'Phase 3',
      branchId: 'main',
    },
  },
};

const baseEntry = {
  id: 'mcu_wanda_public_after_sokovia',
  title: 'Wanda Known After Sokovia',
  category: 'character',
  canon: 'canon',
  content: {
    fact: 'After Sokovia, Wanda is publicly associated with the Avengers.',
  },
  extensions: {
    sagaLoredeck: {
      packId: 'mcu-infinity-saga',
    },
  },
};

const noGate = evaluateEntryContextGate({
  ...baseEntry,
  date: {
    validFrom: '2015',
    validTo: '2016',
  },
}, state, { index });
assert.equal(noGate.status, CONTEXT_GATE_STATUSES.NO_GATE);
assert.equal(noGate.eligible, true);

const matched = evaluateEntryContextGate({
  ...baseEntry,
  context: {
    validFromAnchor: 'mcu.age_of_ultron',
    validToAnchor: 'mcu.civil_war',
    phase: 'Phase 3',
  },
}, state, { index });
assert.equal(matched.status, CONTEXT_GATE_STATUSES.MATCH);
assert.equal(matched.eligible, true);

const mismatched = evaluateEntryContextGate({
  ...baseEntry,
  context: {
    validFromAnchor: 'mcu.infinity_war',
  },
}, state, { index });
assert.equal(mismatched.status, CONTEXT_GATE_STATUSES.MISMATCH);
assert.equal(mismatched.eligible, false);

const unresolvedDefault = evaluateEntryContextGate({
  ...baseEntry,
  extensions: {
    sagaLoredeck: {
      packId: 'custom-crossover',
    },
  },
  context: {
    anchorId: 'custom.first_arc',
  },
}, state, { index });
assert.equal(unresolvedDefault.status, CONTEXT_GATE_STATUSES.UNRESOLVED);
assert.equal(unresolvedDefault.eligible, true);

const unresolvedStrict = evaluateEntryContextGate({
  ...baseEntry,
  extensions: {
    sagaLoredeck: {
      packId: 'custom-crossover',
    },
  },
  context: {
    anchorId: 'custom.first_arc',
  },
}, state, { index, unresolvedEligible: false });
assert.equal(unresolvedStrict.status, CONTEXT_GATE_STATUSES.UNRESOLVED);
assert.equal(unresolvedStrict.eligible, false);

console.log('Context gating tests passed.');
