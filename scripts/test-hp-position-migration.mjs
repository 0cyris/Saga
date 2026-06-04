import assert from 'node:assert/strict';
import {
  buildPositionFromDateRange,
  migrateEntryToPosition,
  migrateLorepackRoot,
  parseIsoDate,
} from './migrate-hp-lorepack-to-position.mjs';

const parsed = parseIsoDate('1995-06-24');
assert.equal(parsed.iso, '1995-06-24');
assert.equal(parsed.sortKey, Math.floor(Date.UTC(1995, 5, 24) / 86400000));
assert.equal(parseIsoDate('1995-02-31'), null);

const position = buildPositionFromDateRange({
  from: '1995-06-24',
  to: '1995-06-30',
  precision: 'date',
});
assert.equal(position.scope, 'window');
assert.equal(position.sortKeyFrom, Math.floor(Date.UTC(1995, 5, 24) / 86400000));
assert.equal(position.sortKeyTo, Math.floor(Date.UTC(1995, 5, 30) / 86400000));
assert.equal(position.precision, 'event_window');
assert.equal(position.label, '1995-06-24 to 1995-06-30');

const migrated = migrateEntryToPosition({
  id: 'hp_test',
  title: 'HP Test',
  date: {
    validFrom: '1994-09-01',
    validTo: '1995-08-31',
    precision: 'date',
  },
  content: {
    fact: 'HP Test fact.',
    injection: 'HP Test injection.',
  },
});
assert.equal(migrated.changed, true);
assert.equal(migrated.status, 'position_native');
assert.equal(migrated.entry.schemaVersion, 3);
assert.equal(migrated.entry.date, undefined);
assert.equal(migrated.entry.canonTiming, undefined);
assert.equal(migrated.entry.validFrom, undefined);
assert.equal(migrated.entry.validTo, undefined);
assert.equal(migrated.entry.position.sortKeyFrom, Math.floor(Date.UTC(1994, 8, 1) / 86400000));
assert.equal(migrated.entry.position.sortKeyTo, Math.floor(Date.UTC(1995, 7, 31) / 86400000));
assert.equal(migrated.entry.retrieval.activation, 'topic_or_entity');

const existing = migrateEntryToPosition({
  id: 'hp_existing',
  title: 'HP Existing',
  position: {
    scope: 'window',
    sortKeyFrom: 1,
    sortKeyTo: 2,
    precision: 'date_window',
    label: 'Existing position',
  },
  content: {
    fact: 'Already positioned.',
    injection: 'Already positioned.',
  },
});
assert.equal(existing.changed, true);
assert.equal(existing.status, 'position_native_existing');
assert.equal(existing.entry.position.scope, 'window');

const report = migrateLorepackRoot('Lorepacks/hp-golden-trio', { write: false });
assert.equal(report.entryCount, 431);
assert.equal(report.invalidDateCount, 0);
assert.equal(report.noDateCount, 0);
assert.equal(report.changedEntryCount, report.entryCount);
assert.equal(report.manifestEntryCount, report.entryCount);

console.log('HP position migration tests passed.');
