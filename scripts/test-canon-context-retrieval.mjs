import assert from 'node:assert/strict';
import { __canonLoreDbTestHooks } from '../canon-lore-db.js';

const {
  evaluateCanonEntryEligibility,
  buildCanonCandidateItem,
} = __canonLoreDbTestHooks;

const scoring = {
  weights: {
    dateMatch: 30,
    contextMatch: 30,
    contextUnresolvedPenalty: -8,
    characterMatch: 25,
    locationMatch: 12,
    topicMatch: 18,
    priority: 15,
    futureGuard: 20,
  },
  kindBoosts: {
    knowledge_gate: 18,
  },
};

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
      contextSortKey: 2400,
      phase: 'Phase 3',
      branchId: 'main',
    },
  },
  scene: {
    presentCharacters: ['Wanda Maximoff'],
    nearbyCharacters: [],
    location: 'Avengers Compound',
    currentActivity: 'Sokovia Accords discussion',
  },
  canon: {
    era: 'MCU Phase 3',
  },
};

const context = {
  canonBoundary: 'After Age of Ultron, before Civil War',
  branchId: 'main',
};

const baseEntry = {
  id: 'mcu_wanda_public_after_sokovia',
  title: 'Wanda Known After Sokovia',
  kind: 'knowledge_gate',
  category: 'character',
  lorePurpose: 'knowledge_gate',
  canon: 'canon',
  priority: 75,
  scope: {
    characters: ['Wanda Maximoff'],
    topics: ['Sokovia Accords'],
  },
  tags: ['character:wanda-maximoff', 'event:sokovia'],
  content: {
    fact: 'After Sokovia, Wanda Maximoff is publicly associated with the Avengers.',
    injection: 'After Sokovia, treat Wanda Maximoff as publicly associated with the Avengers.',
  },
  extensions: {
    sagaLoredeck: {
      packId: 'mcu-infinity-saga',
    },
  },
};

const dateOnly = {
  ...baseEntry,
  id: 'date_only',
  context: undefined,
  date: {
    validFrom: '2016-01-01',
    validTo: '2016-12-31',
  },
};
const dateEligible = buildCanonCandidateItem(dateOnly, state, context, '2016-05-01', scoring, { contextIndex: index });
assert.equal(dateEligible, null);

const dateMissing = buildCanonCandidateItem(dateOnly, state, context, '', scoring, { contextIndex: index });
assert.equal(dateMissing, null);

const contextOnly = {
  ...baseEntry,
  id: 'context_only',
  context: {
    scope: 'window',
    validFromAnchor: 'mcu.age_of_ultron',
    validToAnchor: 'mcu.civil_war',
    phase: 'Phase 3',
    sortKeyFrom: 2200,
    sortKeyTo: 2500,
  },
};
const contextEligible = buildCanonCandidateItem(contextOnly, state, context, '', scoring, { contextIndex: index });
assert.equal(contextEligible.eligibility.matchedBy, 'context');
assert.equal(contextEligible.eligibility.contextGate.status, 'match');
assert.equal(contextEligible.score >= 30, true);

const contextMismatch = {
  ...baseEntry,
  id: 'context_mismatch',
  context: {
    scope: 'window',
    validFromAnchor: 'mcu.infinity_war',
  },
};
const mismatch = buildCanonCandidateItem(contextMismatch, state, context, '2016-05-01', scoring, { contextIndex: index });
assert.equal(mismatch, null);

const unresolvedContextOnly = {
  ...baseEntry,
  id: 'unresolved_context_only',
  extensions: {
    sagaLoredeck: {
      packId: 'custom-pack',
    },
  },
  context: {
    scope: 'anchor',
    anchorId: 'custom.first_arc',
  },
};
const unresolvedWithoutDate = buildCanonCandidateItem(unresolvedContextOnly, state, context, '', scoring, { contextIndex: index });
assert.equal(unresolvedWithoutDate, null);

const unresolvedWithDate = buildCanonCandidateItem({
  ...unresolvedContextOnly,
  date: {
    validFrom: '2016-01-01',
    validTo: '2016-12-31',
  },
}, state, context, '2016-05-01', scoring, { contextIndex: index });
assert.equal(unresolvedWithDate, null);

const dateDoesNotContradictContext = evaluateCanonEntryEligibility({
  ...contextOnly,
  date: {
    validFrom: '2018-01-01',
    validTo: '2018-12-31',
  },
}, state, context, '2016-05-01', { contextIndex: index });
assert.equal(dateDoesNotContradictContext.eligible, true);
assert.equal(dateDoesNotContradictContext.matchedBy, 'context');

const wideContext = {
  ...baseEntry,
  id: 'wide_position',
  context: {
    scope: 'window',
    sortKeyFrom: 1000,
    sortKeyTo: 5000,
    windowKind: 'wide',
  },
};
const wideEligible = buildCanonCandidateItem(wideContext, {
  ...state,
  loredeckContexts: {
    'mcu-infinity-saga': {
      packId: 'mcu-infinity-saga',
      contextSortKey: 2400,
      branchId: 'main',
    },
  },
}, context, '', scoring, { contextIndex: index });
assert.equal(wideEligible.eligibility.matchedBy, 'context');
assert.equal(wideEligible.score < contextEligible.score, true);

console.log('Canon Context retrieval tests passed.');
