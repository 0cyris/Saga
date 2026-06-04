import assert from 'node:assert/strict';
import { normalizeLoreEntry, normalizeLorePosition } from '../lore-matrix.js';

const position = normalizeLorePosition({
  position: {
    anchorFrom: 'mcu.age_of_ultron',
    anchorTo: 'mcu.civil_war',
    phase: 'Phase 3',
    season: 2,
    episode: 8,
    positionType: 'anchor_window',
    label: 'After Age of Ultron, before Civil War',
  },
});

assert.equal(position.validFromAnchor, 'mcu.age_of_ultron');
assert.equal(position.validToAnchor, 'mcu.civil_war');
assert.equal(position.phase, 'Phase 3');
assert.equal(position.phaseId, 'Phase 3');
assert.equal(position.season, '2');
assert.equal(position.episode, '8');
assert.equal(position.precision, 'anchor_window');

const entry = normalizeLoreEntry({
  id: 'mcu_wanda_public_after_sokovia',
  title: 'Wanda Known After Sokovia',
  kind: 'knowledge_gate',
  category: 'character',
  canon: 'canon',
  priority: 75,
  date: {
    validFrom: '2015',
    validTo: '2016',
    precision: 'year',
  },
  position: {
    validFromAnchor: 'mcu.age_of_ultron',
    validToAnchor: 'mcu.civil_war',
    arc: 'Sokovia aftermath',
    phaseId: 'mcu.phase_3',
    chapter: 12,
    quest: 'Sokovia cleanup',
    sortKeyFrom: 2200,
    sortKeyTo: 2600,
    precision: 'anchor_window',
  },
  coordinates: [{
    axis: 'adaptation',
    id: 'mcu',
    label: 'MCU',
    required: true,
  }],
  content: {
    fact: 'After Sokovia, Wanda Maximoff is publicly associated with the Avengers and the Sokovia incident.',
    injection: 'After Sokovia, treat Wanda Maximoff as publicly associated with the Avengers and the Sokovia incident unless this story established otherwise.',
  },
});

assert.equal(entry.date.validFrom, '2015');
assert.equal(entry.date.validTo, '2016');
assert.equal(entry.position.validFromAnchor, 'mcu.age_of_ultron');
assert.equal(entry.position.validToAnchor, 'mcu.civil_war');
assert.equal(entry.position.arc, 'Sokovia aftermath');
assert.equal(entry.position.phase, 'mcu.phase_3');
assert.equal(entry.position.phaseId, 'mcu.phase_3');
assert.equal(entry.position.chapter, '12');
assert.equal(entry.position.quest, 'Sokovia cleanup');
assert.equal(entry.position.sortKeyFrom, 2200);
assert.equal(entry.position.sortKeyTo, 2600);
assert.equal(entry.coordinates.length, 1);
assert.equal(entry.coordinates[0].axis, 'adaptation');
assert.equal(entry.coordinates[0].id, 'mcu');
assert.equal(entry.extensions.unrecognized?.position, undefined);
assert.equal(entry.extensions.unrecognized?.coordinates, undefined);

console.log('Lore position normalization smoke passed.');
