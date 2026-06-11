import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_JJK_LOREDECK_IDS } from '../../src/loredecks/loredeck-defaults.js';

const ROOT = path.join('content', 'loredecks');
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listJsonFiles(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return listJsonFiles(full);
    return entry.isFile() && entry.name.endsWith('.json') ? [full] : [];
  });
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

function getCategoryCounts(entries) {
  const counts = {};
  for (const entry of entries) {
    const category = entry.category || 'other';
    counts[category] = (counts[category] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

const allEntryIds = new Set();

for (const deckId of DEFAULT_JJK_LOREDECK_IDS) {
  const deckRoot = path.join(ROOT, deckId);
  const manifest = readJson(path.join(deckRoot, 'loredeck.json'));
  const timeline = readJson(path.join(deckRoot, 'timeline.json'));
  const anchorIds = new Set((timeline.anchors || []).map(anchor => anchor.id).filter(Boolean));

  assert.equal(manifest.id, deckId);
  assert.equal(manifest.entrySchemaVersion, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.compatibility?.sagaSchemaMin, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.compatibility?.sagaSchemaMax, ENTRY_SCHEMA_VERSION);
  assert.ok((manifest.stats?.entryCount || 0) > 0, `${deckId} should contain Lorecards.`);

  const manifestFiles = new Set((manifest.files || []).map(file => file.replace(/\\/g, '/')));
  assert.equal(manifestFiles.size, manifest.files.length, `${deckId} manifest files should be unique.`);
  const entryFiles = listJsonFiles(deckRoot)
    .map(file => ({
      file,
      relative: path.relative(deckRoot, file).replace(/\\/g, '/'),
      json: readJson(file),
    }))
    .filter(record => Array.isArray(record.json.entries));
  const unlistedEntryFiles = entryFiles.map(record => record.relative).filter(relative => !manifestFiles.has(relative));
  assert.deepEqual(unlistedEntryFiles, [], `${deckId} should list every entry file in its manifest.`);

  const entries = [];
  for (const record of entryFiles) {
    assert.equal(record.json.schemaVersion, ENTRY_SCHEMA_VERSION, `${deckId}/${record.relative} should use schemaVersion 3.`);
    for (const entry of record.json.entries) {
      entries.push(entry);
      assert.equal(entry.schemaVersion, ENTRY_SCHEMA_VERSION, `${entry.id} should use entry schemaVersion 3.`);
      assert.ok(entry.id, `${deckId}/${record.relative} entry should have an id.`);
      assert.equal(allEntryIds.has(entry.id), false, `${entry.id} should appear in only one JJK Loredeck.`);
      allEntryIds.add(entry.id);
      for (const key of Object.keys(entry)) {
        assert.equal(LEGACY_ENTRY_KEYS.has(key), false, `${entry.id} has legacy top-level field ${key}.`);
      }
      walkValues(entry, (key, _value, pathParts) => {
        if (!isAllowedNestedKey(pathParts, key)) {
          assert.equal(LEGACY_ENTRY_KEYS.has(key), false, `${entry.id} has legacy nested field ${[...pathParts, key].join('.')}.`);
        }
      });
      assert.ok(entry.content?.fact?.trim(), `${entry.id} content.fact cannot be empty.`);
      assert.ok(entry.content?.injection?.trim(), `${entry.id} content.injection cannot be empty.`);
      assert.ok(entry.context && typeof entry.context === 'object', `${entry.id} must have Context.`);
      assert.ok(['anchor', 'window', 'global'].includes(entry.context.scope), `${entry.id} must declare context.scope.`);
      assert.equal(Number.isFinite(Number(entry.context.sortKeyFrom)), true, `${entry.id} must have context.sortKeyFrom.`);
      assert.equal(Number.isFinite(Number(entry.context.sortKeyTo)), true, `${entry.id} must have context.sortKeyTo.`);
      assert.ok(entry.context.precision, `${entry.id} must have context.precision.`);
      assert.ok(entry.context.label, `${entry.id} must have context.label.`);
      if (entry.context.validFromAnchor) {
        assert.equal(anchorIds.has(entry.context.validFromAnchor), true, `${entry.id} validFromAnchor should exist in ${deckId} timeline.`);
      }
      if (entry.context.validToAnchor) {
        assert.equal(anchorIds.has(entry.context.validToAnchor), true, `${entry.id} validToAnchor should exist in ${deckId} timeline.`);
      }
      assert.ok(entry.retrieval?.activation, `${entry.id} must have retrieval.activation.`);
      assert.ok(entry.retrieval?.frequency, `${entry.id} must have retrieval.frequency.`);
      assert.ok(entry.retrieval?.contextBoost, `${entry.id} must have retrieval.contextBoost.`);
    }
  }

  assert.equal(entries.length, manifest.stats.entryCount, `${deckId} manifest entry count should match loaded entries.`);
  assert.deepEqual(getCategoryCounts(entries), manifest.stats.categoryCounts, `${deckId} category counts should match loaded entries.`);
}

console.log('JJK Loredeck v3 conformance tests passed.');
