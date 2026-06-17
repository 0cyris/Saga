import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BUNDLED_LOREDECK_CONTEXTS,
  DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
  DEFAULT_ONE_PIECE_LOREDECK_IDS,
} from '../../src/loredecks/loredeck-defaults.js';
import { loadLoredeckSourceById } from '../../src/loredecks/loredeck-loader.js';

const ROOT = path.join('content', 'loredecks');
const ENTRY_SCHEMA_VERSION = 3;
const EXPECTED_ONE_PIECE_IDS = [
  'one-piece-romance-dawn',
  'one-piece-orange-town',
  'one-piece-syrup-village',
  'one-piece-baratie',
  'one-piece-arlong-park',
  'one-piece-loguetown',
  'one-piece-warship-island',
  'one-piece-reverse-mountain',
  'one-piece-whisky-peak',
  'one-piece-little-garden',
  'one-piece-drum-island',
  'one-piece-arabasta',
  'one-piece-post-arabasta',
];
const EAST_BLUE_IDS = new Set(EXPECTED_ONE_PIECE_IDS.slice(0, 7));
const ARABASTA_IDS = new Set(EXPECTED_ONE_PIECE_IDS.slice(7));
const SHOW_CONTINUITY_IDS = new Set([
  'one-piece-warship-island',
  'one-piece-post-arabasta',
]);
const LEGACY_ONE_PIECE_TAGS = new Set([
  'continuity:one-piece-hybrid-main',
  'adaptation:manga-anime-main',
  'quality:draft-reference',
]);
const EXPECTED_ONE_PIECE_PLAN = new Map([
  ['one-piece-romance-dawn', { target: 34, chapters: '1-7', episodes: '1-4' }],
  ['one-piece-orange-town', { target: 31, chapters: '8-21', episodes: '4-8' }],
  ['one-piece-syrup-village', { target: 37, chapters: '22-41', episodes: '9-18' }],
  ['one-piece-baratie', { target: 41, chapters: '42-68', episodes: '19-30' }],
  ['one-piece-arlong-park', { target: 41, chapters: '69-95', episodes: '31-44' }],
  ['one-piece-loguetown', { target: 35, chapters: '96-100', episodes: '45, 48-53' }],
  ['one-piece-warship-island', { target: 25, chapters: 'Filler arc', episodes: '54-61', showOnly: true }],
  ['one-piece-reverse-mountain', { target: 30, chapters: '101-105', episodes: '62-63' }],
  ['one-piece-whisky-peak', { target: 36, chapters: '106-114', episodes: '64-67' }],
  ['one-piece-little-garden', { target: 40, chapters: '115-129', episodes: '70-77' }],
  ['one-piece-drum-island', { target: 44, chapters: '130-154', episodes: '78-91' }],
  ['one-piece-arabasta', { target: 58, chapters: '155-217', episodes: '92-130' }],
  ['one-piece-post-arabasta', { target: 25, chapters: 'Filler arc', episodes: '131-135', showOnly: true }],
]);
const EXPECTED_ONE_PIECE_TOTAL = 477;
const ACCEPTED_LORE_PURPOSES = new Set([
  'character_snapshot',
  'event_moment',
  'knowledge_gate',
  'relationship_state',
  'lore_gate',
  'ability_gate',
  'objective',
  'faction',
  'rule',
  'timeline',
]);
const LOW_VALUE_TEXT_PATTERNS = [
  /This belongs to/i,
  /not as a broad series summary/i,
  /When writing .* material involving/i,
  /should retrieve from their own decks/i,
  /belongs to the next deck/i,
  /Generated from the Saga One Piece authoring plan/i,
  /requires human canon spot check/i,
];
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

globalThis.fetch = async (url) => {
  const filePath = fileURLToPath(url);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return JSON.parse(await readFile(filePath, 'utf8'));
    },
  };
};

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
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    visitor(key, item, pathParts);
    walkValues(item, visitor, [...pathParts, key]);
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

function timelineWindowLikeCount(timeline = {}) {
  return [
    ...(Array.isArray(timeline.windows) ? timeline.windows : []),
    ...(Array.isArray(timeline.arcs) ? timeline.arcs : []),
    ...(Array.isArray(timeline.phases) ? timeline.phases : []),
  ].length;
}

assert.deepEqual(Array.from(DEFAULT_ONE_PIECE_LOREDECK_IDS), EXPECTED_ONE_PIECE_IDS, 'Default One Piece deck IDs should match the East Blue, Warship Island, Arabasta, and Post-Arabasta arc plan.');

const index = readJson(path.join(ROOT, 'index.json'));
const bundledIds = (index.bundled || []).map(record => record.packId);
for (const deckId of EXPECTED_ONE_PIECE_IDS) {
  assert.equal(bundledIds.includes(deckId), true, `${deckId} should be registered in content/loredecks/index.json.`);
}

const allEntryIds = new Set();
let onePieceTotalEntries = 0;
for (const deckId of DEFAULT_ONE_PIECE_LOREDECK_IDS) {
  const expected = EXPECTED_ONE_PIECE_PLAN.get(deckId);
  const deckRoot = path.join(ROOT, deckId);
  const manifest = readJson(path.join(deckRoot, 'loredeck.json'));
  const duplicateManifest = readJson(path.join(deckRoot, 'manifest.json'));
  const timeline = readJson(path.join(deckRoot, 'timeline.json'));
  const anchorIds = new Set((timeline.anchors || []).map(anchor => anchor.id).filter(Boolean));
  const entries = [];

  assert.deepEqual(duplicateManifest, manifest, `${deckId} loredeck.json and manifest.json should stay identical.`);
  assert.equal(manifest.id, deckId);
  assert.equal(manifest.fandom, 'One Piece');
  assert.equal(manifest.entrySchemaVersion, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.compatibility?.sagaSchemaMin, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.compatibility?.sagaSchemaMax, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.stats?.entryCount, expected.target, `${deckId} should match the reviewed quality-pass Lorecard count.`);
  assert.ok((manifest.files || []).length >= 4, `${deckId} should split entries across focused files.`);
  if (deckId === 'one-piece-arabasta') {
    assert.ok((manifest.files || []).length >= 9, 'Arabasta should have at least nine focused entry files.');
  }
  if (expected.showOnly) {
    assert.equal(manifest.tags.includes('continuity:one-piece-anime-main'), true, `${deckId} should be tagged as anime continuity.`);
    assert.equal(manifest.tags.includes('adaptation:anime'), true, `${deckId} should be tagged as anime adaptation.`);
    assert.equal(manifest.tags.includes('topic:show-only'), true, `${deckId} should be tagged as show-only filler support.`);
    assert.equal(manifest.continuity?.continuityId, 'one-piece-anime-main', `${deckId} should use anime-main continuity metadata.`);
    assert.equal(manifest.continuity?.canonTier, 'anime-only', `${deckId} should stay anime-only.`);
    assert.equal(String(manifest.continuity?.sourceBoundary || '').includes('anime episodes'), true, `${deckId} should state anime episode coverage.`);
    assert.equal(String(manifest.continuity?.sourceBoundary || '').includes(expected.episodes), true, `${deckId} should include its exact anime episode range.`);
  } else {
    assert.equal(manifest.tags.includes('continuity:one-piece-manga-main'), true, `${deckId} should be tagged as manga-main continuity.`);
    assert.equal(manifest.continuity?.continuityId, 'one-piece-manga-main', `${deckId} should use manga-main continuity metadata.`);
    assert.equal(manifest.continuity?.adaptation, 'manga', `${deckId} should keep manga facts as the canon spine.`);
    assert.equal(String(manifest.continuity?.sourceBoundary || '').includes(`manga chapters ${expected.chapters}`), true, `${deckId} should include its exact manga chapter range.`);
    assert.equal(String(manifest.continuity?.sourceBoundary || '').includes(`anime episodes ${expected.episodes}`), true, `${deckId} should include its exact anime episode range.`);
    assert.equal(String(manifest.continuity?.sourceBoundary || '').includes('manga-main continuity'), true, `${deckId} should describe manga-main continuity with anime episode support.`);
  }
  assert.equal(manifest.tags.includes('quality:reviewed-baseline'), true, `${deckId} should carry the reviewed-baseline quality tag.`);
  for (const legacyTag of LEGACY_ONE_PIECE_TAGS) {
    assert.equal(manifest.tags.includes(legacyTag), false, `${deckId} should not retain legacy One Piece tag ${legacyTag}.`);
  }
  assert.equal(DEFAULT_BUNDLED_LOREDECK_CONTEXTS[deckId].contextType, 'anchor_window', `${deckId} should use anchor-window Context defaults.`);

  const expectedSaga = EAST_BLUE_IDS.has(deckId) ? 'East Blue Saga' : 'Arabasta Saga';
  assert.equal(ARABASTA_IDS.has(deckId) || EAST_BLUE_IDS.has(deckId), true, `${deckId} should belong to a planned One Piece saga.`);
  assert.deepEqual(DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId].library?.suggestedPath, ['One Piece', expectedSaga], `${deckId} should live in the correct One Piece saga folder.`);
  assert.deepEqual(manifest.library?.suggestedPath, ['One Piece', expectedSaga], `${deckId} manifest should use the correct One Piece saga folder.`);

  const manifestFiles = new Set((manifest.files || []).map(file => file.replace(/\\/g, '/')));
  assert.equal(manifestFiles.size, manifest.files.length, `${deckId} manifest files should be unique.`);
  const entryFiles = listJsonFiles(deckRoot)
    .map(file => ({
      file,
      relative: path.relative(deckRoot, file).replace(/\\/g, '/'),
      json: readJson(file),
    }))
    .filter(record => Array.isArray(record.json.entries));
  assert.deepEqual(entryFiles.map(record => record.relative).filter(relative => !manifestFiles.has(relative)), [], `${deckId} should list every entry file in its manifest.`);

  const factKeys = new Set();
  for (const record of entryFiles) {
    assert.equal(record.json.schemaVersion, ENTRY_SCHEMA_VERSION, `${deckId}/${record.relative} should use schemaVersion 3.`);
    assert.ok(record.json.entries.length <= 22, `${deckId}/${record.relative} should stay reviewable and not exceed 22 Lorecards.`);
    for (const entry of record.json.entries) {
      entries.push(entry);
      assert.equal(entry.schemaVersion, ENTRY_SCHEMA_VERSION, `${entry.id} should use entry schemaVersion 3.`);
      assert.ok(entry.id, `${deckId}/${record.relative} entry should have an id.`);
      assert.equal(allEntryIds.has(entry.id), false, `${entry.id} should appear in only one One Piece Loredeck.`);
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
      assert.notEqual(entry.category, 'timeline', `${entry.id} should not use a Lorecard for timeline/meta work that belongs in timeline.json.`);
      assert.equal(ACCEPTED_LORE_PURPOSES.has(entry.lorePurpose), true, `${entry.id} should declare a recognized lore purpose.`);
      assert.equal(/\s\([^)]+\)$/.test(entry.title || ''), false, `${entry.id} title should not end with a generated subject suffix.`);
      const factKey = String(entry.content.fact || '').trim().toLowerCase();
      assert.equal(factKeys.has(factKey), false, `${deckId} should not contain duplicate fact cards: ${entry.content.fact}`);
      factKeys.add(factKey);
      for (const pattern of LOW_VALUE_TEXT_PATTERNS) {
        assert.equal(pattern.test(entry.title || ''), false, `${entry.id} title contains generated low-value text.`);
        assert.equal(pattern.test(entry.content.fact || ''), false, `${entry.id} fact contains generated low-value text.`);
        assert.equal(pattern.test(entry.content.injection || ''), false, `${entry.id} injection contains generated low-value text.`);
      }
      assert.equal((entry.tags || []).includes(`arc:${manifest.id.replace(/^one-piece-/, '')}`), true, `${entry.id} should include its deck arc tag.`);
      assert.equal((entry.tags || []).includes('quality:reviewed-baseline'), true, `${entry.id} should carry reviewed-baseline quality.`);
      for (const legacyTag of LEGACY_ONE_PIECE_TAGS) {
        assert.equal((entry.tags || []).includes(legacyTag), false, `${entry.id} should not retain legacy One Piece tag ${legacyTag}.`);
      }
      if (SHOW_CONTINUITY_IDS.has(deckId)) {
        assert.equal((entry.tags || []).includes('continuity:one-piece-anime-main'), true, `${entry.id} should be anime-continuity tagged.`);
        assert.equal((entry.tags || []).includes('adaptation:anime'), true, `${entry.id} should be anime-adaptation tagged.`);
        assert.equal((entry.tags || []).includes('topic:show-only'), true, `${entry.id} should be show-only tagged.`);
        assert.equal(entry.continuity?.continuityId, 'one-piece-anime-main', `${entry.id} should use anime-main continuity metadata.`);
        assert.equal(entry.continuity?.canonTier, 'anime-only', `${entry.id} should stay anime-only.`);
      } else {
        assert.equal((entry.tags || []).includes('continuity:one-piece-manga-main'), true, `${entry.id} should be manga-main tagged.`);
        assert.equal(entry.continuity?.continuityId, 'one-piece-manga-main', `${entry.id} should use manga-main continuity metadata.`);
        assert.equal(entry.continuity?.adaptation, 'manga', `${entry.id} should keep manga facts as the canon spine.`);
      }
      assert.equal(Boolean(entry.extensions?.sagaOnePieceReviewedBaseline), true, `${entry.id} should retain reviewed-baseline provenance.`);
      assert.equal(Boolean(entry.extensions?.sagaOnePieceExpandedDraft), false, `${entry.id} should not retain expanded-draft provenance.`);
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
  onePieceTotalEntries += entries.length;
  assert.deepEqual(getCategoryCounts(entries), manifest.stats.categoryCounts, `${deckId} category counts should match loaded entries.`);
  assert.equal((timeline.anchors || []).length, manifest.stats.timelineAnchorCount, `${deckId} timeline anchor count should match manifest stats.`);
  assert.equal(timelineWindowLikeCount(timeline), manifest.stats.timelineWindowCount, `${deckId} timeline window count should match manifest stats.`);

  const source = await loadLoredeckSourceById(deckId);
  const issueSummary = [...source.health.errors, ...source.health.warnings, ...source.health.suggestions]
    .map(issue => `${issue.severity}:${issue.code}`)
    .join(', ');
  assert.equal(source.health.errors.length, 0, `${deckId} should have no Pack Health errors. ${issueSummary}`);
  assert.equal(source.health.warnings.length, 0, `${deckId} should have no Pack Health warnings. ${issueSummary}`);
  assert.equal(source.health.suggestions.length, 0, `${deckId} should have no Pack Health suggestions. ${issueSummary}`);
  assert.equal(source.health.status, 'good', `${deckId} should report good Pack Health.`);
}

assert.equal(onePieceTotalEntries, EXPECTED_ONE_PIECE_TOTAL, 'Expanded One Piece family should match the planned total Lorecard count.');

console.log('One Piece Loredeck health tests passed.');
