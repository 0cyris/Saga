import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const decks = [
  ['hp-core', 20, 6],
  ['hp-year-1-philosophers-stone', 55, 8],
  ['hp-year-2-chamber-of-secrets', 55, 8],
  ['hp-year-3-prisoner-of-azkaban', 55, 8],
  ['hp-year-4-goblet-of-fire', 55, 8],
  ['hp-year-5-order-of-the-phoenix', 55, 9],
  ['hp-year-6-half-blood-prince', 55, 12],
  ['hp-year-7-deathly-hallows', 60, 12],
  ['hp-epilogue-post-war', 25, 7],
];
const hpFolderPath = ['Harry Potter', 'Golden Trio'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function toDay(date) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
}

function timelineSpanDays(timeline) {
  const datedAnchors = timeline.anchors
    .filter(anchor => anchor.dateRange?.from)
    .map(anchor => toDay(anchor.dateRange.from))
    .sort((a, b) => a - b);
  return datedAnchors.at(-1) - datedAnchors[0];
}

for (const [deckId, minAnchors, minWindows] of decks) {
  const manifest = readJson(path.join('content', 'loredecks', deckId, 'loredeck.json'));
  const timeline = readJson(path.join('content', 'loredecks', deckId, 'timeline.json'));
  assert.equal(manifest.id, deckId, `${deckId} manifest ID should match folder.`);
  assert.equal(manifest.deckFamilyId, 'hp-golden-trio', `${deckId} should declare the HP deck family.`);
  assert.deepEqual(manifest.library?.suggestedPath, hpFolderPath, `${deckId} should declare the HP Golden Trio library folder path.`);
  assert.equal(manifest.assets?.cover?.path, 'assets/cover.png', `${deckId} should use a deck-local cover asset.`);
  assert.ok(fs.existsSync(path.join(root, 'content', 'loredecks', deckId, 'assets', 'cover.png')), `${deckId} should bundle assets/cover.png.`);
  assert.equal(manifest.registries.timeline, 'timeline.json', `${deckId} should expose a first-class timeline registry.`);
  if (deckId !== 'hp-epilogue-post-war') {
    assert.equal(manifest.registries.tags, 'tags.json', `${deckId} should expose a first-class tag registry.`);
    assert.ok(fs.existsSync(path.join(root, 'content', 'loredecks', deckId, 'tags.json')), `${deckId} should bundle tags.json.`);
  }
  assert.ok(Array.isArray(timeline.anchors) && timeline.anchors.length >= minAnchors, `${deckId} should have dense anchors.`);
  assert.ok(Array.isArray(timeline.windows) && timeline.windows.length >= minWindows, `${deckId} should have curated windows.`);
  assert.equal(new Set(timeline.anchors.map(anchor => anchor.id)).size, timeline.anchors.length, `${deckId} anchor IDs should be unique.`);
  assert.equal(new Set(timeline.windows.map(windowDef => windowDef.id)).size, timeline.windows.length, `${deckId} window IDs should be unique.`);
  for (const anchor of timeline.anchors) {
    assert.ok(anchor.sortKey !== undefined && Number.isFinite(Number(anchor.sortKey)), `${deckId}:${anchor.id} needs numeric sortKey.`);
    assert.ok(anchor.label, `${deckId}:${anchor.id} needs a label.`);
  }
}

const year6 = readJson(path.join('content', 'loredecks', 'hp-year-6-half-blood-prince', 'timeline.json'));
const y6AnchorIds = new Set(year6.anchors.map(anchor => anchor.id));
for (const id of [
  'hp.y6.slughorn_christmas_party',
  'hp.y6.post_christmas_return',
  'hp.y6.apparition_lessons_begin',
  'hp.y6.susan_bones_splinched',
]) {
  assert.ok(y6AnchorIds.has(id), `Year 6 timeline should include ${id}.`);
}
const postChristmas = year6.anchors.find(anchor => anchor.id === 'hp.y6.post_christmas_return');
const apparition = year6.anchors.find(anchor => anchor.id === 'hp.y6.apparition_lessons_begin');
const susan = year6.anchors.find(anchor => anchor.id === 'hp.y6.susan_bones_splinched');
assert.equal(postChristmas.dateRange.from, '1997-01-07');
assert.equal(apparition.dateRange.from, '1997-02-01');
assert.equal(susan.dateRange.from, '1997-02-01');
assert.ok(susan.aliases.includes('Susan Bones loses a leg'), 'Year 6 Susan Bones anchor should include casual phrase alias.');
const postChristmasWindow = year6.windows.find(windowDef => windowDef.id === 'hp.y6.window.post_christmas_before_apparition');
assert.equal(postChristmasWindow.validFromAnchor, 'hp.y6.post_christmas_return');
assert.equal(postChristmasWindow.validToAnchor, 'hp.y6.apparition_lessons_begin');

const yearDeckIds = decks
  .map(([deckId]) => deckId)
  .filter(deckId => deckId.startsWith('hp-year-'));
const yearAnchorCounts = yearDeckIds.map(deckId => readJson(path.join('content', 'loredecks', deckId, 'timeline.json')).anchors.length);
assert.ok(
  Math.max(...yearAnchorCounts) - Math.min(...yearAnchorCounts) <= 15,
  `HP year deck anchors should stay balanced. Counts: ${yearAnchorCounts.join(', ')}.`
);

const year7 = readJson(path.join('content', 'loredecks', 'hp-year-7-deathly-hallows', 'timeline.json'));
assert.ok(!year7.anchors.some(anchor => anchor.id === 'hp.y7.epilogue_optional'), 'Year 7 active timeline should not include the optional epilogue anchor.');
assert.ok(timelineSpanDays(year7) <= 400, 'Year 7 active timeline should stay within the main Deathly Hallows story span.');
for (const id of [
  'hp.y7.seven_potters_operation',
  'hp.y7.ministry_infiltration',
  'hp.y7.malfoy_manor_capture',
  'hp.y7.shell_cottage_refuge',
  'hp.y7.gringotts_breakin',
  'hp.y7.battle_hogwarts_begins',
  'hp.y7.voldemort_defeated',
]) {
  assert.ok(year7.anchors.some(anchor => anchor.id === id), `Year 7 timeline should include ${id}.`);
}

const epilogueManifest = readJson(path.join('content', 'loredecks', 'hp-epilogue-post-war', 'loredeck.json'));
const epilogue = readJson(path.join('content', 'loredecks', 'hp-epilogue-post-war', 'timeline.json'));
assert.equal(epilogueManifest.family.role, 'epilogue');
assert.equal(epilogueManifest.source.url, 'https://www.hp-lexicon.org/timeline/master-timeline/the-modern-era/the-second-rise-of-voldemort/post-war-years/');
assert.equal(epilogue.defaultContextType, 'story_anchor');
const epilogueAnchorIds = new Set(epilogue.anchors.map(anchor => anchor.id));
for (const id of [
  'hp.postwar.kingsley_caretaker_minister',
  'hp.postwar.dementors_removed_from_azkaban',
  'hp.postwar.harry_head_auror_department',
  'hp.postwar.dumbledores_army_reunited_world_cup',
  'hp.postwar.new_generation_kings_cross',
]) {
  assert.ok(epilogueAnchorIds.has(id), `Epilogue timeline should include ${id}.`);
}
const epilogueStart = epilogue.anchors.find(anchor => anchor.id === 'hp.postwar.kingsley_caretaker_minister');
const kingsCross = epilogue.anchors.find(anchor => anchor.id === 'hp.postwar.new_generation_kings_cross');
const azkaban = epilogue.anchors.find(anchor => anchor.id === 'hp.postwar.dementors_removed_from_azkaban');
assert.equal(epilogueStart.dateRange.from, '1998-05-02');
assert.equal(kingsCross.dateRange.from, '2017-09-01');
assert.equal(azkaban.dateRange.precision, 'decade');

const loredeckIndex = readJson(path.join('content', 'loredecks', 'index.json'));
const indexedIds = new Set((loredeckIndex.bundled || []).map(record => record.packId));
for (const [deckId] of decks) {
  assert.ok(indexedIds.has(deckId), `content/loredecks/index.json should include ${deckId}.`);
  const record = (loredeckIndex.bundled || []).find(item => item.packId === deckId);
  assert.equal(record?.assets?.cover?.path, 'assets/cover.png', `Indexed ${deckId} should expose its deck-local cover asset.`);
}
const indexedEpilogue = (loredeckIndex.bundled || []).find(record => record.packId === 'hp-epilogue-post-war');
assert.deepEqual(indexedEpilogue?.library?.suggestedPath, hpFolderPath, 'Indexed Epilogue deck should declare the HP Golden Trio folder path.');

console.log('HP Loredeck family scaffold tests passed.');
