import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'Loredecks/hp-golden-trio';
const DAY_MS = 86400000;
const ENTRY_SCHEMA_VERSION = 3;
const LEGACY_ENTRY_KEYS = new Set([
  'date',
  'canonTiming',
  'validFrom',
  'validTo',
  'activeWhen',
  'whoKnowsTruth',
  'whoSuspects',
  'whoBelievesPublicVersion',
  'publicVersion',
  'fact',
]);
const OLD_TERMINOLOGY = /\b(?:date-gated|date constraint|date-aware|date gate)\b/i;

function listJsonFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return listJsonFiles(full);
    return entry.isFile() && entry.name.endsWith('.json') ? [full] : [];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function parseIsoDate(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const epoch = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(epoch) ? Math.floor(epoch / DAY_MS) : null;
}

function walkValues(value, visitor, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkValues(item, visitor, [...pathParts, String(index)]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      visitor(key, item, pathParts);
      walkValues(item, visitor, [...pathParts, key]);
    }
  }
}

function isAllowedNestedKey(pathParts, key) {
  const parent = pathParts[pathParts.length - 1] || '';
  return parent === 'content' && ['fact', 'publicVersion'].includes(key);
}

const manifest = readJson(path.join(ROOT, 'loredeck.json'));
assert.equal(manifest.entrySchemaVersion, ENTRY_SCHEMA_VERSION);
assert.equal(manifest.compatibility?.sagaSchemaMin, ENTRY_SCHEMA_VERSION);
assert.equal(manifest.compatibility?.sagaSchemaMax, ENTRY_SCHEMA_VERSION);

const manifestFiles = new Set((manifest.files || []).map(file => file.replace(/\\/g, '/')));
assert.equal(manifestFiles.size, manifest.files.length);

const entryFiles = listJsonFiles(ROOT)
  .map(file => ({
    file,
    relative: path.relative(ROOT, file).replace(/\\/g, '/'),
    json: readJson(file),
  }))
  .filter(record => Array.isArray(record.json.entries));

const unlistedEntryFiles = entryFiles
  .map(record => record.relative)
  .filter(relative => !manifestFiles.has(relative));
assert.deepEqual(unlistedEntryFiles, []);

let entryCount = 0;
let wideContextCount = 0;
const categoryCounts = {};
for (const record of entryFiles) {
  assert.equal(record.json.schemaVersion, ENTRY_SCHEMA_VERSION, `${record.relative} should use schemaVersion 3`);
  for (const entry of record.json.entries) {
    entryCount += 1;
    categoryCounts[entry.category || 'other'] = (categoryCounts[entry.category || 'other'] || 0) + 1;
    assert.equal(entry.schemaVersion, ENTRY_SCHEMA_VERSION, `${entry.id} should use entry schemaVersion 3`);
    for (const key of Object.keys(entry)) {
      assert.equal(LEGACY_ENTRY_KEYS.has(key), false, `${entry.id} has legacy top-level field ${key}`);
    }
    walkValues(entry, (key, value, pathParts) => {
      if (!isAllowedNestedKey(pathParts, key)) {
        assert.equal(LEGACY_ENTRY_KEYS.has(key), false, `${entry.id} has legacy nested field ${[...pathParts, key].join('.')}`);
      }
      if (typeof value === 'string') {
        assert.equal(OLD_TERMINOLOGY.test(value), false, `${entry.id} has old timing terminology at ${[...pathParts, key].join('.')}`);
      }
    });
    assert.equal(typeof entry.content?.fact, 'string', `${entry.id} must have content.fact`);
    assert.equal(typeof entry.content?.injection, 'string', `${entry.id} must have content.injection`);
    assert.ok(entry.content.fact.trim(), `${entry.id} content.fact cannot be empty`);
    assert.ok(entry.content.injection.trim(), `${entry.id} content.injection cannot be empty`);
    assert.ok(entry.context && typeof entry.context === 'object', `${entry.id} must have Context`);
    assert.ok(['anchor', 'window', 'global'].includes(entry.context.scope), `${entry.id} must declare context.scope`);
    assert.equal(Number.isFinite(Number(entry.context.sortKeyFrom)), true, `${entry.id} must have context.sortKeyFrom`);
    assert.equal(Number.isFinite(Number(entry.context.sortKeyTo)), true, `${entry.id} must have context.sortKeyTo`);
    assert.ok(entry.context.precision, `${entry.id} must have context.precision`);
    assert.ok(entry.context.label, `${entry.id} must have context.label`);
    assert.ok(entry.retrieval?.activation, `${entry.id} must have retrieval.activation`);
    assert.ok(entry.retrieval?.frequency, `${entry.id} must have retrieval.frequency`);
    assert.ok(entry.retrieval?.contextBoost, `${entry.id} must have retrieval.contextBoost`);
    if (entry.context.scope === 'global' || ['series', 'wide'].includes(entry.context.windowKind)) {
      wideContextCount += 1;
      assert.equal(entry.retrieval.activation, 'topic_or_entity', `${entry.id} wide lore must require topic/entity retrieval`);
      assert.equal(entry.retrieval.frequency, 'low', `${entry.id} wide lore should be low-frequency`);
      assert.equal(entry.retrieval.contextBoost, 'low', `${entry.id} wide lore should have low Context boost`);
    }
  }
}

assert.equal(entryCount, manifest.stats.entryCount);
assert.deepEqual(
  Object.fromEntries(Object.entries(categoryCounts).sort((a, b) => a[0].localeCompare(b[0]))),
  manifest.stats.categoryCounts
);
assert.ok(wideContextCount > 0, 'HP pack should include explicit wide-Context lore for audit coverage');

const timeline = readJson(path.join(ROOT, 'timeline.json'));
assert.equal(timeline.sortKeyScale, 'date-derived-day');
for (const anchor of timeline.anchors || []) {
  const sortKey = parseIsoDate(anchor.dateRange?.from || '');
  if (sortKey !== null) assert.equal(anchor.sortKey, sortKey, `${anchor.id} sortKey should match dateRange.from`);
}
const anchorsById = new Map((timeline.anchors || []).map(anchor => [anchor.id, anchor]));
for (const window of timeline.windows || []) {
  const fromAnchor = anchorsById.get(window.anchorFrom);
  const toAnchor = anchorsById.get(window.anchorTo);
  if (fromAnchor) assert.equal(window.sortKeyFrom, fromAnchor.sortKey, `${window.id} sortKeyFrom should match anchorFrom`);
  if (toAnchor) {
    const toSortKey = parseIsoDate(toAnchor.dateRange?.to || toAnchor.dateRange?.from || '');
    assert.equal(window.sortKeyTo, toSortKey, `${window.id} sortKeyTo should match anchorTo range end`);
  }
}

console.log('HP Loredeck v3 conformance tests passed.');
