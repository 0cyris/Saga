import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_HP_LOREDECK_IDS } from '../../src/loredecks/loredeck-defaults.js';

const root = process.cwd();

const TAG_MAP = new Map(Object.entries({
  '1991': 'calendar-year:1991',
  '1992': 'calendar-year:1992',
  '1993': 'calendar-year:1993',
  '1994': 'calendar-year:1994',
  '1995': 'calendar-year:1995',
  '1996': 'calendar-year:1996',
  '1997': 'calendar-year:1997',
  artifact: 'category:artifact',
  azkaban: 'place:azkaban',
  Britain: 'place:britain',
  castle: 'place:hogwarts-castle',
  'chamber-secrets': 'event:chamber-of-secrets',
  cloak: 'artifact:invisibility-cloak',
  continuity: 'function:continuity',
  'dark-magic': 'magic:dark-magic',
  'deathly-hallows': 'artifact:deathly-hallows',
  Defense: 'subject:defense-against-the-dark-arts',
  Draco: 'character:draco-malfoy',
  Dumbledore: 'character:albus-dumbledore',
  government: 'institution:government',
  Gryffindor: 'house:gryffindor',
  'half-blood-prince': 'artifact:half-blood-prince-book',
  Harry: 'character:harry-potter',
  headmaster: 'role:headmaster',
  Hermione: 'character:hermione-granger',
  Hogsmeade: 'place:hogsmeade',
  hogwarts: 'place:hogwarts',
  Hogwarts: 'place:hogwarts',
  horcrux: 'magic:horcrux',
  knowledge: 'category:knowledge',
  law: 'institution:law',
  Malfoy: 'family:malfoy',
  map: 'artifact:marauders-map',
  ministry: 'faction:ministry-of-magic',
  Ministry: 'faction:ministry-of-magic',
  Order: 'faction:order-of-the-phoenix',
  'order-phoenix': 'faction:order-of-the-phoenix',
  'philosophers-stone': 'artifact:philosophers-stone',
  Potions: 'subject:potions',
  protagonist: 'role:protagonist',
  'public-truth': 'knowledge:public-truth',
  reveal: 'knowledge:reveal-policy',
  rival: 'relationship:rival',
  Ron: 'character:ron-weasley',
  school: 'institution:school',
  secret: 'knowledge:secret',
  secrets: 'knowledge:secret',
  Slytherin: 'house:slytherin',
  Snape: 'character:severus-snape',
  stealth: 'tactic:stealth',
  student: 'role:student',
  students: 'role:student',
  triwizard: 'event:triwizard-tournament',
  village: 'place:village',
  voldemort: 'character:voldemort',
  war: 'event:second-wizarding-war',
  Weasley: 'family:weasley',
  'year-1': 'school-year:1',
  'year-2': 'school-year:2',
  'year-3': 'school-year:3',
  'year-4': 'school-year:4',
  'year-5': 'school-year:5',
  'year-6': 'school-year:6',
  'year-7': 'school-year:7',
}));

const EPILOGUE_SORT_KEY_TO = new Map(Object.entries({
  'hp.postwar.window.immediate_rebuilding': 10591,
  'hp.postwar.window.early_ministry_reforms': 14609,
  'hp.postwar.window.postwar_publications_and_sports': 14974,
  'hp.postwar.window.harry_auror_career': 13878,
  'hp.postwar.window.quidditch_world_cup_2014': 16282,
}));

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeJson(file, value) {
  await fs.writeFile(file, stableJson(value), 'utf8');
}

function labelFromTag(tagId) {
  const [, value = tagId] = String(tagId || '').split(':');
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map(part => /^\d+$/.test(part) ? part : `${part[0]?.toUpperCase() || ''}${part.slice(1)}`)
    .join(' ');
}

function descriptionFromTag(tagId) {
  const [namespace = 'tag'] = String(tagId || '').split(':');
  return `Harry Potter bundled Loredeck ${namespace.replace(/[-_]+/g, ' ')} tag.`;
}

function normalizeEntryTags(tags = [], deckId = '', file = '', entryId = '') {
  if (!Array.isArray(tags)) return tags;
  const next = [];
  const seen = new Set();
  for (const raw of tags) {
    const tag = String(raw || '').trim();
    if (!tag) continue;
    const mapped = TAG_MAP.get(tag) || tag;
    if (!mapped.includes(':')) {
      throw new Error(`No namespaced HP tag mapping for ${tag} in ${deckId}/${file}:${entryId}`);
    }
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    next.push(mapped);
  }
  return next;
}

async function repairEntryFiles(deckId, manifest) {
  const usedTags = new Set();
  for (const rel of manifest.files || []) {
    const file = path.join(root, 'content', 'loredecks', deckId, rel);
    const json = await readJson(file);
    const entries = Array.isArray(json.entries) ? json.entries : (Array.isArray(json) ? json : []);
    let changed = false;
    for (const entry of entries) {
      if (!Array.isArray(entry.tags)) continue;
      const nextTags = normalizeEntryTags(entry.tags, deckId, rel, entry.id || '');
      if (JSON.stringify(nextTags) !== JSON.stringify(entry.tags)) {
        entry.tags = nextTags;
        changed = true;
      }
      for (const tag of nextTags) usedTags.add(tag);
    }
    if (changed) await writeJson(file, json);
  }
  return [...usedTags].sort((a, b) => a.localeCompare(b));
}

async function writeTagRegistry(deckId, usedTags) {
  const tagsPath = path.join(root, 'content', 'loredecks', deckId, 'tags.json');
  if (!usedTags.length) {
    try {
      await fs.rm(tagsPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return false;
  }
  const registry = {
    schemaVersion: 1,
    tags: Object.fromEntries(usedTags.map(tagId => [tagId, {
      label: labelFromTag(tagId),
      description: descriptionFromTag(tagId),
    }])),
  };
  await writeJson(tagsPath, registry);
  return true;
}

function wireTagRegistry(manifest, hasTags) {
  const registries = manifest.registries && typeof manifest.registries === 'object' && !Array.isArray(manifest.registries)
    ? { ...manifest.registries }
    : {};
  if (hasTags) registries.tags = 'tags.json';
  else delete registries.tags;
  manifest.registries = Object.keys(registries).length ? registries : {};
}

async function repairManifestFiles(deckId, hasTags) {
  for (const name of ['loredeck.json', 'manifest.json']) {
    const file = path.join(root, 'content', 'loredecks', deckId, name);
    const manifest = await readJson(file);
    wireTagRegistry(manifest, hasTags);
    await writeJson(file, manifest);
  }
}

async function repairEpilogueTimeline() {
  const file = path.join(root, 'content', 'loredecks', 'hp-epilogue-post-war', 'timeline.json');
  const timeline = await readJson(file);
  let changed = false;
  for (const windowDef of timeline.windows || []) {
    if (!EPILOGUE_SORT_KEY_TO.has(windowDef.id)) continue;
    const next = EPILOGUE_SORT_KEY_TO.get(windowDef.id);
    if (windowDef.sortKeyTo !== next) {
      windowDef.sortKeyTo = next;
      changed = true;
    }
  }
  if (changed) await writeJson(file, timeline);
}

for (const deckId of DEFAULT_HP_LOREDECK_IDS) {
  const manifest = await readJson(path.join(root, 'content', 'loredecks', deckId, 'loredeck.json'));
  const usedTags = await repairEntryFiles(deckId, manifest);
  const hasTags = await writeTagRegistry(deckId, usedTags);
  await repairManifestFiles(deckId, hasTags);
}

await repairEpilogueTimeline();

console.log('HP Loredeck health repair complete.');
