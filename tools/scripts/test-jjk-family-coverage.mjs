import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_BUNDLED_LOREDECK_CONTEXTS,
  DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
  DEFAULT_JJK_LOREDECK_IDS,
} from '../../src/loredecks/loredeck-defaults.js';

const ROOT = process.cwd();
const LOREDECK_ROOT = path.join(ROOT, 'content', 'loredecks');
const MAINLINE_PATH = Object.freeze(['Jujutsu Kaisen', 'Manga Main']);
const MODULO_PATH = Object.freeze(['Jujutsu Kaisen', 'Modulo']);
const MODULO_SOURCE_URL = 'https://www.viz.com/shonenjump/chapters/jujutsu-kaisen-modulo';

const EXPECTED_MAINLINE_IDS = Object.freeze([
  'jjk-core',
  'jjk-zero',
  'jjk-origin-death-painting',
  'jjk-hidden-inventory-premature-death',
  'jjk-shibuya-incident',
  'jjk-post-shibuya-preparation',
  'jjk-culling-game-colonies',
  'jjk-culling-game-convergence',
  'jjk-shinjuku-showdown',
]);
const EXPECTED_JJK_IDS = Object.freeze([
  ...EXPECTED_MAINLINE_IDS,
  'jjk-modulo',
]);
const EXPECTED_FAMILY_ORDER = Object.freeze(new Map([
  ['jjk-core', 10],
  ['jjk-zero', 20],
  ['jjk-origin-death-painting', 30],
  ['jjk-hidden-inventory-premature-death', 40],
  ['jjk-shibuya-incident', 50],
  ['jjk-post-shibuya-preparation', 60],
  ['jjk-culling-game-colonies', 70],
  ['jjk-culling-game-convergence', 80],
  ['jjk-shinjuku-showdown', 90],
  ['jjk-modulo', 110],
]));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getSoftDependency(manifest, packId) {
  return (manifest.dependencies || []).find(dependency => dependency?.packId === packId && dependency.required === false);
}

const index = readJson(path.join(ROOT, 'content', 'loredecks', 'index.json'));
const bundled = Array.isArray(index.bundled) ? index.bundled : [];
const bundledJjkIds = bundled
  .map(record => String(record.packId || '').trim())
  .filter(packId => packId.startsWith('jjk-'));

assert.deepEqual(Array.from(DEFAULT_JJK_LOREDECK_IDS), EXPECTED_JJK_IDS, 'Default JJK deck IDs should match the planned family exactly.');
assert.deepEqual(bundledJjkIds, EXPECTED_JJK_IDS, 'Bundled index should expose the planned JJK family in order.');

let previousFamilyOrder = 0;
for (const deckId of EXPECTED_JJK_IDS) {
  const deckRoot = path.join(LOREDECK_ROOT, deckId);
  const manifest = readJson(path.join(deckRoot, 'loredeck.json'));
  const indexRecord = bundled.find(record => record.packId === deckId);
  const defaultRecord = DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId];
  const expectedPath = deckId === 'jjk-modulo' ? MODULO_PATH : MAINLINE_PATH;
  const expectedFamilyOrder = EXPECTED_FAMILY_ORDER.get(deckId);

  assert.ok(indexRecord, `${deckId} should be present in content/loredecks/index.json.`);
  assert.ok(defaultRecord, `${deckId} should be present in default bundled packs.`);
  assert.equal(manifest.id, deckId, `${deckId} manifest id should match its folder.`);
  assert.equal(manifest.type, 'bundled', `${deckId} should remain a bundled Loredeck.`);
  assert.equal(manifest.entrySchemaVersion, 3, `${deckId} should use Lorecard schema v3 entries.`);
  assert.equal(DEFAULT_BUNDLED_LOREDECK_CONTEXTS[deckId].contextType, 'anchor_window', `${deckId} should use anchor-window Context defaults.`);
  assert.equal(manifest.health?.status, 'good', `${deckId} manifest should report good draft health.`);
  assert.equal(manifest.library?.familyOrder, expectedFamilyOrder, `${deckId} familyOrder should match the JJK plan.`);
  assert.deepEqual(manifest.library?.suggestedPath, expectedPath, `${deckId} should live in the intended JJK library path.`);
  assert.deepEqual(indexRecord.library, manifest.library, `${deckId} index library metadata should match manifest.`);
  assert.deepEqual(defaultRecord.library, manifest.library, `${deckId} default library metadata should match manifest.`);
  assert.ok(manifest.tags?.includes('fandom:jjk'), `${deckId} should carry the JJK fandom tag.`);
  assert.ok(manifest.tags?.includes('quality:draft-reference'), `${deckId} should remain marked as draft-reference until human canon review.`);
  assert.ok(expectedFamilyOrder > previousFamilyOrder, `${deckId} should keep strict JJK family ordering.`);
  previousFamilyOrder = expectedFamilyOrder;

  if (deckId === 'jjk-core') {
    continue;
  }

  assert.ok(getSoftDependency(manifest, 'jjk-core'), `${deckId} should keep a soft dependency on jjk-core.`);
}

for (const deckId of EXPECTED_MAINLINE_IDS) {
  const manifest = readJson(path.join(LOREDECK_ROOT, deckId, 'loredeck.json'));
  assert.notEqual(manifest.continuity?.continuityId, 'jjk-modulo', `${deckId} should not use Modulo continuity.`);
  assert.equal(manifest.tags?.includes('continuity:jjk-modulo'), false, `${deckId} should not carry the Modulo continuity tag.`);
}

const modulo = readJson(path.join(LOREDECK_ROOT, 'jjk-modulo', 'loredeck.json'));
assert.equal(modulo.continuity?.continuityId, 'jjk-modulo', 'Modulo should use its own continuity id.');
assert.ok(modulo.tags?.includes('continuity:jjk-modulo'), 'Modulo should carry the Modulo continuity tag.');
assert.equal(modulo.tags?.includes('continuity:jjk-manga-main'), false, 'Modulo manifest should not pretend to be manga-main.');
assert.equal(modulo.source?.url, MODULO_SOURCE_URL, 'Modulo should keep the official VIZ chapter-list source boundary URL.');
assert.ok(getSoftDependency(modulo, 'jjk-shinjuku-showdown'), 'Modulo should keep a soft dependency on the Shinjuku ending boundary.');

console.log('JJK family coverage contract passed.');
