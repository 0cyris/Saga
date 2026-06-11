import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_JJK_LOREDECK_IDS } from '../../src/loredecks/loredeck-defaults.js';

const ROOT = process.cwd();
const LOREDECK_ROOT = path.join(ROOT, 'content', 'loredecks');
const MODULO_DECK_ID = 'jjk-modulo';
const MAINLINE_MODULO_BOUNDARY_ENTRY = 'jjk_shinjuku_epilogue_state_closes_manga_main';

const FORBIDDEN_MAINLINE_TAGS = new Set([
  'arc:modulo',
  'arc:modulo-resolution',
  'character:maru',
  'character:tsurugi-okkotsu',
  'character:yuka-okkotsu',
  'continuity:jjk-modulo',
  'faction:future-jujutsu-authorities',
  'relationship:okkotsu-siblings',
  'secret:modulo-final-resolution',
  'species:simurian',
  'topic:alien-jujutsu',
  'topic:coexistence-test',
  'topic:future-sorcery',
  'topic:okkotsu-legacy',
]);

const FORBIDDEN_MAINLINE_ENTITY_IDS = new Set([
  'jjk:future-jujutsu-authorities',
  'jjk:maru',
  'jjk:modulo-continuity',
  'jjk:okkotsu-siblings',
  'jjk:simurians',
  'jjk:tsurugi-okkotsu',
  'jjk:yuka-okkotsu',
]);

const FORBIDDEN_MAINLINE_TEXT_PATTERNS = [
  /\bJujutsu Kaisen Modulo\b/i,
  /\bModulo\b/i,
  /\bSimurians?\b/i,
  /\bMaru\b/i,
  /\bMarulu\b/i,
  /\bYuka Okkotsu\b/i,
  /\bTsurugi Okkotsu\b/i,
  /\bOkkotsu siblings\b/i,
  /\balien jujutsu\b/i,
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function entryText(entry = {}) {
  return JSON.stringify({
    id: entry.id,
    title: entry.title,
    scope: entry.scope,
    retrieval: entry.retrieval,
    content: entry.content,
    sourceInfo: entry.sourceInfo,
  });
}

function listEntries(deckRoot, manifest) {
  const entries = [];
  for (const file of manifest.files || []) {
    const shard = readJson(path.join(deckRoot, file));
    for (const entry of shard.entries || []) {
      entries.push({ entry, file });
    }
  }
  return entries;
}

for (const deckId of DEFAULT_JJK_LOREDECK_IDS) {
  if (deckId === MODULO_DECK_ID) continue;
  const deckRoot = path.join(LOREDECK_ROOT, deckId);
  const manifest = readJson(path.join(deckRoot, 'loredeck.json'));

  for (const { entry, file } of listEntries(deckRoot, manifest)) {
    const label = `${deckId}/${file}/${entry.id}`;
    const entryTags = Array.isArray(entry.tags) ? entry.tags : [];
    const entityIds = Array.isArray(entry.scope?.entityIds) ? entry.scope.entityIds : [];

    for (const tag of entryTags) {
      assert.equal(FORBIDDEN_MAINLINE_TAGS.has(tag), false, `${label} should not carry Modulo-only tag ${tag}.`);
    }

    for (const entityId of entityIds) {
      assert.equal(FORBIDDEN_MAINLINE_ENTITY_IDS.has(entityId), false, `${label} should not reference Modulo-only entity ${entityId}.`);
    }

    assert.notEqual(entry.sourceInfo?.work, 'Jujutsu Kaisen Modulo', `${label} should not cite Modulo as a mainline entry source.`);

    if (entry.id === MAINLINE_MODULO_BOUNDARY_ENTRY) {
      continue;
    }

    const text = entryText(entry);
    for (const pattern of FORBIDDEN_MAINLINE_TEXT_PATTERNS) {
      assert.equal(pattern.test(text), false, `${label} should not leak Modulo-only text matching ${pattern}.`);
    }
  }
}

const moduloRoot = path.join(LOREDECK_ROOT, MODULO_DECK_ID);
const moduloManifest = readJson(path.join(moduloRoot, 'loredeck.json'));
assert.equal(moduloManifest.continuity?.continuityId, 'jjk-modulo', 'Modulo deck should keep its sequel continuity id.');
assert.deepEqual(moduloManifest.library?.suggestedPath, ['Jujutsu Kaisen', 'Modulo'], 'Modulo deck should remain outside the manga-main shelf.');
assert.equal(moduloManifest.tags?.includes('continuity:jjk-manga-main'), false, 'Modulo manifest should not carry the manga-main continuity tag.');

console.log('JJK spoiler boundary checks passed.');
