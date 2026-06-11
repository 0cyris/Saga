import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const LOREDECK_ROOT = path.join(ROOT, 'content', 'loredecks');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function normalizeManifestRef(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^content\/loredecks\//, '');
}

function listEntries(deckRoot) {
  const entries = [];
  for (const name of fs.readdirSync(deckRoot, { withFileTypes: true })) {
    const full = path.join(deckRoot, name.name);
    if (name.isDirectory()) {
      entries.push(...listEntries(full));
      continue;
    }
    if (!name.isFile() || !name.name.endsWith('.json')) continue;
    const json = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!Array.isArray(json.entries)) continue;
    entries.push(...json.entries);
  }
  return entries;
}

function categoryCounts(entries) {
  const counts = {};
  for (const entry of entries) {
    const category = String(entry.category || 'other').trim() || 'other';
    counts[category] = (counts[category] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])));
}

function timelineWindowLikeCount(timeline = {}) {
  return [
    ...(Array.isArray(timeline.windows) ? timeline.windows : []),
    ...(Array.isArray(timeline.arcs) ? timeline.arcs : []),
    ...(Array.isArray(timeline.phases) ? timeline.phases : []),
  ].length;
}

globalThis.fetch = async function fetchLocalJson(url) {
  const resolved = url instanceof URL
    ? url
    : String(url || '').startsWith('file:')
      ? new URL(url)
      : pathToFileURL(String(url || ''));
  const text = await readFile(fileURLToPath(resolved), 'utf8');
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return JSON.parse(text);
    },
    async text() {
      return text;
    },
  };
};

const {
  DEFAULT_BUNDLED_LOREDECK_CONTEXTS,
  DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
  DEFAULT_JJK_LOREDECK_IDS,
} = await import('../../src/loredecks/loredeck-defaults.js');
const { loadLoredeckSourceById } = await import('../../src/loredecks/loredeck-loader.js');

const index = readJson('content/loredecks/index.json');
const bundled = Array.isArray(index.bundled) ? index.bundled : [];
const bundledIds = bundled.map(record => String(record.packId || '').trim());

for (const deckId of DEFAULT_JJK_LOREDECK_IDS) {
  assert.equal(bundledIds.includes(deckId), true, `${deckId} should exist in content/loredecks/index.json.`);

  const deckRoot = path.join(LOREDECK_ROOT, deckId);
  const manifest = JSON.parse(fs.readFileSync(path.join(deckRoot, 'loredeck.json'), 'utf8'));
  const duplicateManifest = JSON.parse(fs.readFileSync(path.join(deckRoot, 'manifest.json'), 'utf8'));
  const indexRecord = bundled.find(record => record.packId === deckId);
  const defaultRecord = DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId];
  const entries = listEntries(deckRoot);
  const timeline = JSON.parse(fs.readFileSync(path.join(deckRoot, 'timeline.json'), 'utf8'));

  assert.deepEqual(duplicateManifest, manifest, `${deckId} loredeck.json and manifest.json should stay identical.`);
  assert.ok(defaultRecord, `${deckId} should exist in default bundled library packs.`);
  assert.equal(normalizeManifestRef(defaultRecord.manifest), `${deckId}/loredeck.json`, `${deckId} default manifest reference should point to deck-local loredeck.json.`);
  assert.equal(normalizeManifestRef(indexRecord.manifest), `${deckId}/loredeck.json`, `${deckId} index manifest reference should point to deck-local loredeck.json.`);
  assert.deepEqual(defaultRecord.library?.suggestedPath, manifest.library?.suggestedPath, `${deckId} default suggested path should match manifest.`);
  assert.deepEqual(indexRecord.library?.suggestedPath, manifest.library?.suggestedPath, `${deckId} index suggested path should match manifest.`);
  assert.equal(DEFAULT_BUNDLED_LOREDECK_CONTEXTS[deckId].contextType, 'anchor_window', `${deckId} should use anchor-window Context defaults.`);

  for (const field of ['title', 'description', 'fandom', 'era', 'author', 'version', 'entrySchemaVersion', 'updatedAt']) {
    assert.deepEqual(indexRecord[field], manifest[field], `${deckId} index ${field} should match manifest.`);
    assert.deepEqual(defaultRecord[field], manifest[field], `${deckId} default ${field} should match manifest.`);
  }

  assert.deepEqual(indexRecord.library, manifest.library, `${deckId} index library metadata should match manifest.`);
  assert.deepEqual(defaultRecord.library, manifest.library, `${deckId} default library metadata should match manifest.`);
  assert.deepEqual(indexRecord.tags, manifest.tags, `${deckId} index tags should match manifest.`);
  assert.deepEqual(defaultRecord.tags, manifest.tags, `${deckId} default tags should match manifest.`);
  assert.deepEqual(indexRecord.stats, manifest.stats, `${deckId} index stats should match manifest.`);
  assert.deepEqual(defaultRecord.stats, manifest.stats, `${deckId} default stats should match manifest.`);
  assert.deepEqual(indexRecord.assets, manifest.assets, `${deckId} index assets should match manifest.`);
  assert.deepEqual(defaultRecord.assets, manifest.assets, `${deckId} default assets should match manifest.`);

  assert.equal(manifest.registries?.timeline, 'timeline.json', `${deckId} should expose timeline.json.`);
  assert.equal(manifest.registries?.tags, 'tags.json', `${deckId} should expose tags.json.`);
  assert.ok(fs.existsSync(path.join(deckRoot, 'tags.json')), `${deckId} should include tags.json.`);

  assert.equal(entries.length, manifest.stats.entryCount, `${deckId} entry count should match manifest stats.`);
  assert.deepEqual(categoryCounts(entries), manifest.stats.categoryCounts, `${deckId} category counts should match manifest stats.`);
  assert.equal((timeline.anchors || []).length, manifest.stats.timelineAnchorCount, `${deckId} timeline anchor count should match manifest stats.`);
  assert.equal(timelineWindowLikeCount(timeline), manifest.stats.timelineWindowCount, `${deckId} timeline window count should match manifest stats.`);

  if (deckId !== 'jjk-core') {
    const coreDependency = (manifest.dependencies || []).find(dependency => dependency?.packId === 'jjk-core');
    assert.ok(coreDependency, `${deckId} should declare a soft dependency on jjk-core.`);
    assert.equal(coreDependency.required, false, `${deckId} jjk-core dependency should be soft.`);
  }

  for (const file of manifest.files || []) {
    assert.ok(fs.existsSync(path.join(deckRoot, file)), `${deckId} manifest file should exist: ${file}`);
  }

  const source = await loadLoredeckSourceById(deckId);
  assert.equal(source.health.errors.length, 0, `${deckId} should have no Pack Health errors.`);
  assert.equal(source.health.warnings.length, 0, `${deckId} should have no Pack Health warnings.`);
  assert.equal(source.health.suggestions.length, 0, `${deckId} should have no Pack Health suggestions.`);
  assert.equal(source.health.status, 'good', `${deckId} Pack Health should be good.`);
}

console.log('JJK reference deck conformance tests passed.');
