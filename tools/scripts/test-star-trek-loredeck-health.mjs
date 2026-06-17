import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BUNDLED_LOREDECK_CONTEXTS,
  DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
  DEFAULT_STAR_TREK_LOREDECK_IDS,
} from '../../src/loredecks/loredeck-defaults.js';
import { loadLoredeckSourceById } from '../../src/loredecks/loredeck-loader.js';

const ROOT = path.join('content', 'loredecks');
const ENTRY_SCHEMA_VERSION = 3;
const EXPECTED_STAR_TREK_IDS = [
  'star-trek-tng-season-1',
  'star-trek-tng-season-2',
  'star-trek-tng-season-3',
  'star-trek-tng-season-4',
  'star-trek-tng-season-5',
  'star-trek-tng-season-6',
  'star-trek-tng-season-7',
  'star-trek-ds9-season-1',
  'star-trek-ds9-season-2',
  'star-trek-ds9-season-3',
  'star-trek-ds9-season-4',
  'star-trek-ds9-season-5',
  'star-trek-ds9-season-6',
  'star-trek-ds9-season-7',
  'star-trek-voy-season-1',
  'star-trek-voy-season-2',
  'star-trek-voy-season-3',
  'star-trek-voy-season-4',
  'star-trek-voy-season-5',
  'star-trek-voy-season-6',
  'star-trek-voy-season-7',
];
const EXPECTED_PLAN = new Map([
  ['star-trek-tng-season-1', {
    storyRows: 25,
    runtimeAliases: 26,
    minimumEntries: 66,
    maximumEntries: 90,
    expectedEntries: 75,
    libraryPath: ['Star Trek', 'The Next Generation'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:tng',
      'season:tng-s1',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-tng-season-2', {
    storyRows: 22,
    runtimeAliases: 22,
    minimumEntries: 60,
    maximumEntries: 82,
    expectedEntries: 70,
    libraryPath: ['Star Trek', 'The Next Generation'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:tng',
      'season:tng-s2',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-tng-season-3', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 82,
    maximumEntries: 106,
    expectedEntries: 85,
    libraryPath: ['Star Trek', 'The Next Generation'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:tng',
      'season:tng-s3',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-tng-season-4', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 82,
    maximumEntries: 106,
    expectedEntries: 85,
    libraryPath: ['Star Trek', 'The Next Generation'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:tng',
      'season:tng-s4',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-tng-season-5', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'The Next Generation'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:tng',
      'season:tng-s5',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-tng-season-6', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'The Next Generation'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:tng',
      'season:tng-s6',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-tng-season-7', {
    storyRows: 25,
    runtimeAliases: 25,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 80,
    libraryPath: ['Star Trek', 'The Next Generation'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:tng',
      'season:tng-s7',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-ds9-season-1', {
    storyRows: 19,
    runtimeAliases: 19,
    minimumEntries: 60,
    maximumEntries: 90,
    expectedEntries: 62,
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:ds9',
      'season:ds9-s1',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-ds9-season-2', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:ds9',
      'season:ds9-s2',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-ds9-season-3', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:ds9',
      'season:ds9-s3',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-ds9-season-4', {
    storyRows: 25,
    runtimeAliases: 25,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 80,
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:ds9',
      'season:ds9-s4',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-ds9-season-5', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:ds9',
      'season:ds9-s5',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-ds9-season-6', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:ds9',
      'season:ds9-s6',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-ds9-season-7', {
    storyRows: 25,
    runtimeAliases: 25,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 80,
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:ds9',
      'season:ds9-s7',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-voy-season-1', {
    storyRows: 15,
    runtimeAliases: 15,
    minimumEntries: 60,
    maximumEntries: 90,
    expectedEntries: 65,
    libraryPath: ['Star Trek', 'Voyager'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:voy',
      'season:voy-s1',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-voy-season-2', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Voyager'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:voy',
      'season:voy-s2',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-voy-season-3', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Voyager'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:voy',
      'season:voy-s3',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-voy-season-4', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Voyager'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:voy',
      'season:voy-s4',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-voy-season-5', {
    storyRows: 25,
    runtimeAliases: 25,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 80,
    libraryPath: ['Star Trek', 'Voyager'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:voy',
      'season:voy-s5',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-voy-season-6', {
    storyRows: 26,
    runtimeAliases: 26,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 83,
    libraryPath: ['Star Trek', 'Voyager'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:voy',
      'season:voy-s6',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
  ['star-trek-voy-season-7', {
    storyRows: 24,
    runtimeAliases: 24,
    minimumEntries: 60,
    maximumEntries: 120,
    expectedEntries: 77,
    libraryPath: ['Star Trek', 'Voyager'],
    requiredTags: [
      'fandom:star-trek',
      'continuity:star-trek-prime',
      'series:voy',
      'season:voy-s7',
      'structure:season-split-loredeck',
      'quality:draft-reference',
    ],
  }],
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

function categoryCounts(entries) {
  const counts = {};
  for (const entry of entries) {
    counts[entry.category || 'other'] = (counts[entry.category || 'other'] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => left[0].localeCompare(right[0])));
}

function timelineWindowLikeCount(timeline = {}) {
  return [
    ...(Array.isArray(timeline.windows) ? timeline.windows : []),
    ...(Array.isArray(timeline.arcs) ? timeline.arcs : []),
    ...(Array.isArray(timeline.phases) ? timeline.phases : []),
  ].length;
}

assert.deepEqual(Array.from(DEFAULT_STAR_TREK_LOREDECK_IDS), EXPECTED_STAR_TREK_IDS, 'Default Star Trek deck IDs should match the currently developed Star Trek deck set.');

const index = readJson(path.join(ROOT, 'index.json'));
const bundledIds = (index.bundled || []).map(record => record.packId);

for (const deckId of EXPECTED_STAR_TREK_IDS) {
  const expected = EXPECTED_PLAN.get(deckId);
  assert.equal(bundledIds.includes(deckId), true, `${deckId} should be registered in content/loredecks/index.json.`);
  assert.deepEqual(DEFAULT_BUNDLED_LOREDECK_CONTEXTS[deckId]?.contextType, 'anchor_window', `${deckId} should use anchor-window Context defaults.`);
  assert.deepEqual(DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId]?.library?.suggestedPath, expected.libraryPath, `${deckId} should live in the correct Star Trek library path.`);

  const deckRoot = path.join(ROOT, deckId);
  const manifest = readJson(path.join(deckRoot, 'loredeck.json'));
  const duplicateManifest = readJson(path.join(deckRoot, 'manifest.json'));
  const timeline = readJson(path.join(deckRoot, 'timeline.json'));
  const tagRegistry = readJson(path.join(deckRoot, 'tags.json'));
  const timelineAnchorIds = new Set((timeline.anchors || []).map(anchor => anchor.id).filter(Boolean));
  const manifestFiles = new Set((manifest.files || []).map(file => file.replace(/\\/g, '/')));
  const expectedSeriesTag = expected.requiredTags.find(tag => tag.startsWith('series:'));
  const expectedSeasonTag = expected.requiredTags.find(tag => tag.startsWith('season:'));
  const entryFiles = listJsonFiles(deckRoot)
    .map(file => ({
      file,
      relative: path.relative(deckRoot, file).replace(/\\/g, '/'),
      json: readJson(file),
    }))
    .filter(record => Array.isArray(record.json.entries));
  const entries = [];
  const entryIds = new Set();

  assert.deepEqual(duplicateManifest, manifest, `${deckId} loredeck.json and manifest.json should stay identical.`);
  assert.equal(manifest.id, deckId);
  assert.equal(manifest.fandom, 'Star Trek');
  assert.equal(manifest.entrySchemaVersion, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.compatibility?.sagaSchemaMin, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.compatibility?.sagaSchemaMax, ENTRY_SCHEMA_VERSION);
  assert.equal(manifest.stats?.entryCount, expected.expectedEntries, `${deckId} should match the current first-pass draft count.`);
  assert.ok(manifest.stats.entryCount >= expected.minimumEntries, `${deckId} should meet its range floor.`);
  assert.ok(manifest.stats.entryCount <= expected.maximumEntries, `${deckId} should stay inside its range ceiling.`);
  assert.ok((manifest.files || []).length >= 5, `${deckId} should split entries across focused files.`);
  assert.ok(String(manifest.continuity?.sourceBoundary || '').includes(`Memory Alpha story rows 1-${expected.storyRows}`), `${deckId} should state its Memory Alpha story row count.`);
  assert.ok(String(manifest.continuity?.sourceBoundary || '').includes(`runtime episode aliases 1-${expected.runtimeAliases}`), `${deckId} should state its runtime alias count.`);
  assert.deepEqual(manifest.library?.suggestedPath, expected.libraryPath, `${deckId} manifest should use the correct Star Trek folder.`);
  for (const tag of expected.requiredTags) {
    assert.equal((manifest.tags || []).includes(tag), true, `${deckId} should include manifest tag ${tag}.`);
    assert.ok(tagRegistry.tags?.[tag], `${deckId} should register manifest tag ${tag}.`);
  }
  assert.equal((timeline.anchors || []).length, expected.storyRows, `${deckId} should have one timeline anchor per Memory Alpha story row.`);
  assert.equal((timeline.anchors || []).some(anchor => (anchor.runtimeEpisodes || []).includes(expected.runtimeAliases)), true, `${deckId} should include the final runtime episode alias.`);
  assert.equal(manifestFiles.size, manifest.files.length, `${deckId} manifest files should be unique.`);
  assert.deepEqual(entryFiles.map(record => record.relative).filter(relative => !manifestFiles.has(relative)), [], `${deckId} should list every entry file in its manifest.`);

  for (const record of entryFiles) {
    assert.equal(record.json.schemaVersion, ENTRY_SCHEMA_VERSION, `${deckId}/${record.relative} should use schemaVersion 3.`);
    assert.ok(record.json.entries.length <= 22, `${deckId}/${record.relative} should stay reviewable and not exceed 22 Lorecards.`);
    for (const entry of record.json.entries) {
      entries.push(entry);
      assert.equal(entry.schemaVersion, ENTRY_SCHEMA_VERSION, `${entry.id} should use schemaVersion 3.`);
      assert.ok(entry.id, `${deckId}/${record.relative} entry should have an id.`);
      assert.equal(entryIds.has(entry.id), false, `${entry.id} should be unique within ${deckId}.`);
      entryIds.add(entry.id);
      assert.ok(entry.content?.fact?.trim(), `${entry.id} content.fact cannot be empty.`);
      assert.ok(entry.content?.injection?.trim(), `${entry.id} content.injection cannot be empty.`);
      assert.ok(entry.context && typeof entry.context === 'object', `${entry.id} must have Context.`);
      assert.ok(['anchor', 'window', 'global'].includes(entry.context.scope), `${entry.id} must declare context.scope.`);
      assert.ok(entry.retrieval?.activation, `${entry.id} must have retrieval.activation.`);
      assert.ok(entry.retrieval?.frequency, `${entry.id} must have retrieval.frequency.`);
      assert.ok(entry.retrieval?.contextBoost, `${entry.id} must have retrieval.contextBoost.`);
      assert.ok(entry.sourceInfo?.memoryAlphaUrl, `${entry.id} must include sourceInfo.memoryAlphaUrl.`);
      assert.ok(String(entry.sourceInfo.memoryAlphaUrl).startsWith('https://memory-alpha.fandom.com/wiki/'), `${entry.id} should point to Memory Alpha.`);
      assert.ok((entry.tags || []).includes(expectedSeriesTag), `${entry.id} should include ${expectedSeriesTag}.`);
      assert.ok((entry.tags || []).includes(expectedSeasonTag), `${entry.id} should include ${expectedSeasonTag}.`);
      for (const tag of entry.tags || []) {
        assert.ok(tagRegistry.tags?.[tag], `${entry.id} uses unregistered tag ${tag}.`);
      }
      if (entry.context.validFromAnchor) {
        assert.equal(timelineAnchorIds.has(entry.context.validFromAnchor), true, `${entry.id} validFromAnchor should exist in timeline.`);
      }
      if (entry.context.validToAnchor) {
        assert.equal(timelineAnchorIds.has(entry.context.validToAnchor), true, `${entry.id} validToAnchor should exist in timeline.`);
      }
      assert.equal(/Season Summary|Episode Summary|Character Biography|Complete History|General Lore/i.test(entry.title || ''), false, `${entry.id} should not use a broad summary title.`);
      assert.equal(/Dominion War consequences|Seven of Nine joins|Picard-era outcome/i.test(`${entry.content.fact} ${entry.content.injection}`), false, `${entry.id} should not leak later continuity into ${deckId} prose.`);
    }
  }

  assert.equal(entries.length, manifest.stats.entryCount, `${deckId} manifest entry count should match loaded entries.`);
  assert.deepEqual(categoryCounts(entries), manifest.stats.categoryCounts, `${deckId} category counts should match loaded entries.`);
  assert.equal((timeline.anchors || []).length, manifest.stats.timelineAnchorCount, `${deckId} timeline anchor count should match manifest stats.`);
  assert.equal(timelineWindowLikeCount(timeline), manifest.stats.timelineWindowCount, `${deckId} timeline window count should match manifest stats.`);

  const source = await loadLoredeckSourceById(deckId);
  const issueSummary = [...source.health.errors, ...source.health.warnings, ...source.health.suggestions]
    .map(issue => `${issue.severity}:${issue.code}`)
    .join(', ');
  assert.equal(source.health.errors.length, 0, `${deckId} should have no Pack Health errors. ${issueSummary}`);
  assert.equal(source.health.warnings.length, 0, `${deckId} should have no Pack Health warnings. ${issueSummary}`);
  assert.equal(source.health.suggestions.length, 0, `${deckId} should have no Pack Health suggestions. ${issueSummary}`);
}

console.log(`Star Trek Loredeck health test passed for ${EXPECTED_STAR_TREK_IDS.length} deck(s).`);
