import assert from 'node:assert/strict';
import { __canonLoreDbTestHooks } from '../canon-lore-db.js';

const {
  evaluateCanonEntryEligibility,
  buildCanonCandidateItem,
} = __canonLoreDbTestHooks;

const scoring = {
  weights: {
    dateMatch: 30,
    positionMatch: 30,
    positionUnresolvedPenalty: -8,
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
  lorepackContexts: {
    'mcu-infinity-saga': {
      packId: 'mcu-infinity-saga',
      anchorId: 'mcu.civil_war',
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
    sagaLorepack: {
      packId: 'mcu-infinity-saga',
    },
  },
};

const legacyDateOnly = {
  ...baseEntry,
  id: 'legacy_date_only',
  position: undefined,
  date: {
    validFrom: '2016-01-01',
    validTo: '2016-12-31',
  },
};
const dateEligible = buildCanonCandidateItem(legacyDateOnly, state, context, '2016-05-01', scoring, { positionIndex: index });
assert.equal(dateEligible.eligibility.matchedBy, 'date');
assert.equal(dateEligible.score > 0, true);

const dateMissing = buildCanonCandidateItem(legacyDateOnly, state, context, '', scoring, { positionIndex: index });
assert.equal(dateMissing, null);

const positionOnly = {
  ...baseEntry,
  id: 'position_only',
  date: undefined,
  position: {
    validFromAnchor: 'mcu.age_of_ultron',
    validToAnchor: 'mcu.civil_war',
    phase: 'Phase 3',
  },
};
const positionEligible = buildCanonCandidateItem(positionOnly, state, context, '', scoring, { positionIndex: index });
assert.equal(positionEligible.eligibility.matchedBy, 'position');
assert.equal(positionEligible.eligibility.positionGate.status, 'match');
assert.equal(positionEligible.score >= 30, true);

const positionMismatch = {
  ...baseEntry,
  id: 'position_mismatch',
  position: {
    validFromAnchor: 'mcu.infinity_war',
  },
};
const mismatch = buildCanonCandidateItem(positionMismatch, state, context, '2016-05-01', scoring, { positionIndex: index });
assert.equal(mismatch, null);

const unresolvedPositionOnly = {
  ...baseEntry,
  id: 'unresolved_position_only',
  extensions: {
    sagaLorepack: {
      packId: 'custom-pack',
    },
  },
  position: {
    anchorId: 'custom.first_arc',
  },
};
const unresolvedWithoutDate = buildCanonCandidateItem(unresolvedPositionOnly, state, context, '', scoring, { positionIndex: index });
assert.equal(unresolvedWithoutDate, null);

const unresolvedWithDate = buildCanonCandidateItem({
  ...unresolvedPositionOnly,
  date: {
    validFrom: '2016-01-01',
    validTo: '2016-12-31',
  },
}, state, context, '2016-05-01', scoring, { positionIndex: index });
assert.equal(unresolvedWithDate.eligibility.matchedBy, 'date_unresolved_position');
assert.equal(unresolvedWithDate.score > 0, true);

const dateContradictsPosition = evaluateCanonEntryEligibility({
  ...positionOnly,
  date: {
    validFrom: '2018-01-01',
    validTo: '2018-12-31',
  },
}, state, context, '2016-05-01', { positionIndex: index });
assert.equal(dateContradictsPosition.eligible, false);
assert.equal(dateContradictsPosition.matchedBy, 'date_contradicts_position');

console.log('Canon position retrieval tests passed.');
