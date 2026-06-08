import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const LOREDECK_ROOT = path.join(ROOT, 'Loredecks');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeManifestRef(value = '') {
  return String(value || '').replace(/\\/g, '/').replace(/^Loredecks\//, '');
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

function installFileFetchMock() {
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
}

installFileFetchMock();

const {
  DEFAULT_BUNDLED_LOREDECK_CONTEXTS,
  DEFAULT_BUNDLED_LOREDECK_IDS,
  DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
  DEFAULT_BUNDLED_LOREDECK_LIBRARY_RECORDS,
  DEFAULT_HP_LOREDECK_CONTEXTS,
  DEFAULT_HP_LOREDECK_ID,
  DEFAULT_HP_LOREDECK_IDS,
  DEFAULT_HP_LOREDECK_LIBRARY_PACKS,
  DEFAULT_HP_LOREDECK_STACK,
  DEFAULT_LOTR_LOREDECK_IDS,
  HP_LEGACY_LOREDECK_ID,
} = await import('../loredeck-defaults.js');
const { DEFAULT_SETTINGS, getDefaultState } = await import('../constants.js');
const {
  createFolderIdFromPath,
  getFolderPath,
  normalizeLoredeckLibraryIndex,
} = await import('../loredeck-library-index.js');
const { loadLoredeckSourceById } = await import('../loredeck-loader.js');

const index = readJson('Loredecks/index.json');
const bundled = Array.isArray(index.bundled) ? index.bundled : [];
const bundledIds = bundled.map(record => String(record.packId || '').trim());
const bundledDefaultIds = Array.from(DEFAULT_BUNDLED_LOREDECK_IDS);
const bundledDefaultRecords = Array.from(DEFAULT_BUNDLED_LOREDECK_LIBRARY_RECORDS);
const hpDefaultIds = Array.from(DEFAULT_HP_LOREDECK_IDS);
const lotrDefaultIds = Array.from(DEFAULT_LOTR_LOREDECK_IDS);
const hpFolderPath = ['Harry Potter', 'Golden Trio'];
const lotrFolderPath = ['Lord of The Rings', 'War of the Ring'];
const lotrFolderId = createFolderIdFromPath(lotrFolderPath);
const defaultState = getDefaultState();
const defaultLibraryIndex = normalizeLoredeckLibraryIndex(defaultState.loredeckRegistry, {
  packs: defaultState.loredeckRegistry.packs,
});

assert.equal(DEFAULT_HP_LOREDECK_ID, 'hp-core', 'Default selected HP Loredeck should be hp-core.');
assert.deepEqual(DEFAULT_HP_LOREDECK_STACK, [], 'Built-in HP active stack defaults should be empty.');
assert.deepEqual(DEFAULT_SETTINGS.loredeckLibrary.activeStack, [], 'Settings default Loredeck active stack should be empty.');
assert.deepEqual(defaultState.loredeckStack, [], 'State default Loredeck active stack should be empty.');
assert.equal(defaultState.lorePanel.selectedLoredeckId, DEFAULT_HP_LOREDECK_ID, 'State default selected Loredeck should be hp-core.');

assert.equal(hpDefaultIds.includes(HP_LEGACY_LOREDECK_ID), false, 'Default HP deck IDs must not include legacy hp-golden-trio.');
assert.equal(Object.hasOwn(DEFAULT_HP_LOREDECK_LIBRARY_PACKS, HP_LEGACY_LOREDECK_ID), false, 'Default HP library packs must not include legacy hp-golden-trio.');
assert.equal(Object.hasOwn(DEFAULT_HP_LOREDECK_CONTEXTS, HP_LEGACY_LOREDECK_ID), false, 'Default HP Contexts must not include legacy hp-golden-trio.');
assert.equal(bundledIds.includes(HP_LEGACY_LOREDECK_ID), false, 'Loredecks/index.json must not register legacy hp-golden-trio.');

assert.deepEqual(bundledIds, bundledDefaultIds, 'Bundled Loredeck index order should match default bundled Loredeck IDs.');
assert.deepEqual(bundledDefaultRecords.map(record => record.packId), bundledDefaultIds, 'Default bundled library record order should match default bundled Loredeck IDs.');
assert.deepEqual(Object.keys(DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS), bundledDefaultIds, 'Default bundled library pack map keys should match default bundled Loredeck IDs.');
assert.deepEqual(Object.keys(DEFAULT_BUNDLED_LOREDECK_CONTEXTS), bundledDefaultIds, 'Default bundled Context map keys should match default bundled Loredeck IDs.');
assert.deepEqual(Object.keys(DEFAULT_SETTINGS.loredeckLibrary.packs), bundledDefaultIds, 'Settings default Loredeck Library packs should include every bundled deck.');
assert.deepEqual(Object.keys(defaultState.loredeckRegistry.packs), bundledDefaultIds, 'State default Loredeck registry should include every bundled deck.');
assert.deepEqual(Object.keys(defaultState.loredeckContexts), bundledDefaultIds, 'State default Loredeck Contexts should include every bundled deck.');
assert.deepEqual(hpDefaultIds, bundledDefaultIds.slice(0, hpDefaultIds.length), 'HP bundled decks should remain first in bundled order.');
assert.deepEqual(lotrDefaultIds, bundledDefaultIds.slice(hpDefaultIds.length), 'LOTR bundled decks should follow HP bundled decks.');
assert.deepEqual(getFolderPath(lotrFolderId, defaultLibraryIndex), lotrFolderPath, 'Default Library index should create the Lord of The Rings War of the Ring folder.');

for (const deckId of hpDefaultIds) {
  assert.deepEqual(DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId].library?.suggestedPath, hpFolderPath, `${deckId} should stay in the HP Golden Trio folder.`);
  assert.equal(DEFAULT_BUNDLED_LOREDECK_CONTEXTS[deckId].contextType, 'calendar', `${deckId} should keep calendar Context defaults.`);
}

for (const deckId of lotrDefaultIds) {
  assert.deepEqual(DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId].library?.suggestedPath, lotrFolderPath, `${deckId} should live under the Lord of The Rings War of the Ring folder.`);
  assert.equal(DEFAULT_BUNDLED_LOREDECK_CONTEXTS[deckId].contextType, 'anchor_window', `${deckId} should use anchor-window Context defaults.`);
  assert.equal(defaultLibraryIndex.deckPlacements.find(item => item.deckId === deckId)?.folderId, lotrFolderId, `${deckId} should be placed in the default Lord of The Rings folder.`);
}

for (const deckId of bundledDefaultIds) {
  const deckRoot = path.join(LOREDECK_ROOT, deckId);
  const manifestPath = path.join(deckRoot, 'loredeck.json');
  const duplicateManifestPath = path.join(deckRoot, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const duplicateManifest = JSON.parse(fs.readFileSync(duplicateManifestPath, 'utf8'));
  const indexRecord = bundled.find(record => record.packId === deckId);
  const defaultRecord = DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId];
  const entries = listEntries(deckRoot);
  const timeline = JSON.parse(fs.readFileSync(path.join(deckRoot, 'timeline.json'), 'utf8'));

  assert.deepEqual(duplicateManifest, manifest, `${deckId} loredeck.json and manifest.json should stay identical.`);
  assert.ok(indexRecord, `${deckId} should exist in Loredecks/index.json.`);
  assert.ok(defaultRecord, `${deckId} should exist in default bundled library packs.`);
  assert.equal(normalizeManifestRef(defaultRecord.manifest), `${deckId}/loredeck.json`, `${deckId} default manifest reference should point to deck-local loredeck.json.`);
  assert.equal(normalizeManifestRef(indexRecord.manifest), `${deckId}/loredeck.json`, `${deckId} index manifest reference should point to deck-local loredeck.json.`);

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
  assert.equal(manifest.assets?.cover?.path, 'assets/cover.png', `${deckId} manifest should use a deck-local cover.`);
  assert.equal(indexRecord.assets?.cover?.path, 'assets/cover.png', `${deckId} index should use a deck-local cover.`);
  assert.equal(defaultRecord.assets?.cover?.path, 'assets/cover.png', `${deckId} defaults should use a deck-local cover.`);
  assert.ok(fs.existsSync(path.join(deckRoot, manifest.assets.cover.path)), `${deckId} cover asset should exist.`);

  assert.equal(manifest.registries?.timeline, 'timeline.json', `${deckId} should expose timeline.json.`);
  assert.equal(manifest.registries?.tags, 'tags.json', `${deckId} should expose tags.json.`);
  assert.ok(fs.existsSync(path.join(deckRoot, 'tags.json')), `${deckId} should include tags.json.`);

  assert.equal(entries.length, manifest.stats.entryCount, `${deckId} entry count should match manifest stats.`);
  assert.deepEqual(categoryCounts(entries), manifest.stats.categoryCounts, `${deckId} category counts should match manifest stats.`);
  assert.equal((timeline.anchors || []).length, manifest.stats.timelineAnchorCount, `${deckId} timeline anchor count should match manifest stats.`);
  assert.equal(timelineWindowLikeCount(timeline), manifest.stats.timelineWindowCount, `${deckId} timeline window count should match manifest stats.`);

  for (const file of manifest.files || []) {
    assert.ok(fs.existsSync(path.join(deckRoot, file)), `${deckId} manifest file should exist: ${file}`);
  }

  const source = await loadLoredeckSourceById(deckId);
  assert.equal(source.health.errors.length, 0, `${deckId} should have no Deck Health errors.`);
  if (hpDefaultIds.includes(deckId)) {
    assert.equal(source.health.status, 'good', `${deckId} Deck Health should be good.`);
    assert.equal(source.health.warnings.length, 0, `${deckId} should have no Deck Health warnings.`);
    assert.equal(source.health.suggestions.length, 0, `${deckId} should have no Deck Health suggestions.`);
  }
  assert.equal(source.health.summary.entryCount, manifest.stats.entryCount, `${deckId} health entry count should match manifest.`);
  assert.deepEqual(clone(source.health.summary.categoryCounts), manifest.stats.categoryCounts, `${deckId} health category counts should match manifest.`);
  assert.equal(source.health.summary.timelineAnchorCount, manifest.stats.timelineAnchorCount, `${deckId} health timeline anchor count should match manifest.`);
  assert.equal(source.health.summary.timelineWindowCount, manifest.stats.timelineWindowCount, `${deckId} health timeline window count should match manifest.`);
}

console.log('Bundled reference deck conformance tests passed.');
