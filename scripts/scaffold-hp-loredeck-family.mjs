import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const planPath = path.join(root, 'docs', 'development', 'HP_LOREDECK_SPLIT_ANCHOR_PLAN.md');
const loredeckRoot = path.join(root, 'Loredecks');
const generatedAt = '2026-06-05';
const DAY_MS = 86400000;

const decks = [
  {
    section: 'Core Loredeck',
    id: 'hp-core',
    title: 'Harry Potter: Core',
    era: 'Golden Trio Core',
    description: 'Reusable Hogwarts, magical Britain, school-cycle, and world-rule scaffolding for Harry Potter Golden Trio Loredecks.',
    schoolYear: '',
    startDate: '1991-01-01',
    endDate: '1998-12-31',
  },
  {
    section: "Year 1: Philosopher's Stone",
    id: 'hp-year-1-philosophers-stone',
    title: "Harry Potter Year 1: Philosopher's Stone",
    era: "Year 1: Philosopher's Stone",
    schoolYear: '1',
    book: "Philosopher's Stone",
    description: "Year 1 Golden Trio Loredeck for Philosopher's Stone, from pre-Hogwarts discovery through the Stone incident aftermath.",
    startDate: '1991-06-23',
    endDate: '1992-06-20',
  },
  {
    section: 'Year 2: Chamber of Secrets',
    id: 'hp-year-2-chamber-of-secrets',
    title: 'Harry Potter Year 2: Chamber of Secrets',
    era: 'Year 2: Chamber of Secrets',
    schoolYear: '2',
    book: 'Chamber of Secrets',
    description: 'Year 2 Golden Trio Loredeck for Dobby, the Chamber attacks, Polyjuice investigation, and the basilisk climax.',
    startDate: '1992-07-31',
    endDate: '1993-06-20',
  },
  {
    section: 'Year 3: Prisoner of Azkaban',
    id: 'hp-year-3-prisoner-of-azkaban',
    title: 'Harry Potter Year 3: Prisoner of Azkaban',
    era: 'Year 3: Prisoner of Azkaban',
    schoolYear: '3',
    book: 'Prisoner of Azkaban',
    description: 'Year 3 Golden Trio Loredeck for Sirius, Dementors, Hogsmeade, Patronus training, Buckbeak, and the Time-Turner rescue.',
    startDate: '1993-07-31',
    endDate: '1994-06-20',
  },
  {
    section: 'Year 4: Goblet of Fire',
    id: 'hp-year-4-goblet-of-fire',
    title: 'Harry Potter Year 4: Goblet of Fire',
    era: 'Year 4: Goblet of Fire',
    schoolYear: '4',
    book: 'Goblet of Fire',
    description: 'Year 4 Golden Trio Loredeck for the Quidditch World Cup, Triwizard Tournament, graveyard return, and Voldemort aftermath.',
    startDate: '1994-08-15',
    endDate: '1995-06-25',
  },
  {
    section: 'Year 5: Order of the Phoenix',
    id: 'hp-year-5-order-of-the-phoenix',
    title: 'Harry Potter Year 5: Order of the Phoenix',
    era: 'Year 5: Order of the Phoenix',
    schoolYear: '5',
    book: 'Order of the Phoenix',
    description: 'Year 5 Golden Trio Loredeck for Ministry denial, Umbridge, Dumbledore’s Army, Occlumency, OWLs, and the Department of Mysteries.',
    startDate: '1995-08-02',
    endDate: '1996-06-25',
  },
  {
    section: 'Year 6: Half-Blood Prince',
    id: 'hp-year-6-half-blood-prince',
    title: 'Harry Potter Year 6: Half-Blood Prince',
    era: 'Year 6: Half-Blood Prince',
    schoolYear: '6',
    book: 'Half-Blood Prince',
    description: 'Year 6 Golden Trio Loredeck for Slughorn, the Prince book, Draco suspicion, Apparition lessons, Horcrux memory, Sectumsempra, and the Tower crisis.',
    startDate: '1996-07-15',
    endDate: '1997-06-30',
  },
  {
    section: 'Year 7: Deathly Hallows',
    id: 'hp-year-7-deathly-hallows',
    title: 'Harry Potter Year 7: Deathly Hallows',
    era: 'Year 7: Deathly Hallows',
    schoolYear: '7',
    book: 'Deathly Hallows',
    description: 'Year 7 Golden Trio Loredeck for the Seven Potters, Horcrux hunt, Hallows, Malfoy Manor, Shell Cottage, Gringotts, Hogwarts return, and Battle of Hogwarts.',
    startDate: '1997-07-01',
    endDate: '1998-05-03',
  },
  {
    section: 'Epilogue: Post-War Years',
    id: 'hp-epilogue-post-war',
    title: 'Harry Potter: Post-War Years & Epilogue',
    era: 'Post-War Years & Epilogue',
    role: 'epilogue',
    book: 'Deathly Hallows Epilogue',
    anchorPrefix: 'hp.postwar.',
    description: 'Post-war Golden Trio Loredeck for wizarding reconstruction, Ministry reforms, Harry as an Auror, the 2014 Quidditch World Cup, and the 2017 new-generation platform scene.',
    sourceUrl: 'https://www.hp-lexicon.org/timeline/master-timeline/the-modern-era/the-second-rise-of-voldemort/post-war-years/',
    startDate: '1998-05-02',
    endDate: '2017-09-01',
  },
];

const dateOverrides = {
  'hp.y6.slughorn_christmas_party': '1996-12-20',
  'hp.y6.snape_draco_overheard': '1996-12-20',
  'hp.y6.christmas_break_burrow': '1996-12-21',
  'hp.y6.post_christmas_return': '1997-01-07',
  'hp.y6.horcrux_memory_task_assigned': '1997-01-10',
  'hp.y6.apparition_lessons_announced': '1997-01-20',
  'hp.y6.apparition_lessons_begin': '1997-02-01',
  'hp.y6.susan_bones_splinched': '1997-02-01',
  'hp.y6.ron_love_potion': '1997-03-01',
  'hp.y6.ron_poisoned': '1997-03-01',
  'hp.y6.harry_bezoar_save': '1997-03-01',
  'hp.y6.ron_hospital_phase': '1997-03-02',
  'hp.y6.felix_felicis_used': '1997-04-20',
  'hp.y6.aragog_burial': '1997-04-20',
  'hp.y6.true_slughorn_memory_obtained': '1997-04-20',
  'hp.y6.horcrux_truth_revealed': '1997-04-21',
  'hp.y6.sectumsempra_attack': '1997-05-15',
  'hp.y6.harry_ginny_start': '1997-05-20',
  'hp.y6.dumbledore_cave_mission': '1997-06-06',
  'hp.y6.astronomy_tower_crisis': '1997-06-07',
  'hp.y6.dumbledore_killed': '1997-06-07',
  'hp.y6.funeral': '1997-06-30',
  'hp.postwar.kingsley_caretaker_minister': '1998-05-02',
  'hp.postwar.wizarding_reconstruction_begins': '1998-05-03',
  'hp.postwar.comic_relief_schoolbooks_published': '2001-03-12',
  'hp.postwar.quidditch_world_cup_2014_opening': '2014-04-12',
  'hp.postwar.quidditch_world_cup_2014_first_round': '2014-04-13',
  'hp.postwar.liechtenstein_chad_marathon_match': '2014-05-17',
  'hp.postwar.hans_augurey_kidnapped': '2014-06-08',
  'hp.postwar.hans_augurey_returned': '2014-06-09',
  'hp.postwar.quidditch_world_cup_2014_semifinals': '2014-07-04',
  'hp.postwar.dumbledores_army_reunited_world_cup': '2014-07-08',
  'hp.postwar.quidditch_world_cup_2014_final': '2014-07-11',
  'hp.postwar.james_sirius_sorted_gryffindor': '2015-09-01',
  'hp.postwar.james_sirius_second_year': '2016-09-01',
  'hp.postwar.new_generation_kings_cross': '2017-09-01',
  'hp.postwar.albus_rose_scorpius_start_hogwarts': '2017-09-01',
  'hp.postwar.teddy_lupin_and_victoire_platform': '2017-09-01',
  'hp.postwar.draco_family_platform': '2017-09-01',
};

const dateRangeOverrides = {
  'hp.postwar.kingsley_elected_minister': { from: '1998-05-03', to: '1998-12-31', precision: 'approximate_year' },
  'hp.postwar.quidditch_world_cup_1998': { from: '1998-05-03', to: '1998-12-31', precision: 'approximate_year' },
  'hp.postwar.harry_joins_aurors': { from: '1998-05-03', to: '1998-12-31', precision: 'approximate_year' },
  'hp.postwar.dementors_removed_from_azkaban': { from: '2000-01-01', to: '2009-12-31', precision: 'decade' },
  'hp.postwar.ministry_reforms_established': { from: '2000-01-01', to: '2009-12-31', precision: 'decade' },
  'hp.postwar.quidditch_world_cup_2002': { from: '2002-01-01', to: '2002-12-31', precision: 'year' },
  'hp.postwar.viktor_krum_international_retirement': { from: '2002-01-01', to: '2002-12-31', precision: 'year' },
  'hp.postwar.quidditch_world_cup_2006': { from: '2006-01-01', to: '2006-12-31', precision: 'year' },
  'hp.postwar.harry_head_auror_department': { from: '2007-01-01', to: '2007-12-31', precision: 'year' },
  'hp.postwar.macusa_quahog_era': { from: '2010-01-01', to: '2019-12-31', precision: 'decade' },
  'hp.postwar.quidditch_world_cup_2010': { from: '2010-01-01', to: '2010-12-31', precision: 'year' },
  'hp.postwar.ginny_reports_gobstones_league': { from: '2014-07-01', to: '2014-07-31', precision: 'month' },
};

const aliasOverrides = {
  'hp.y6.post_christmas_return': ['after Christmas in sixth year', 'January sixth year', 'post-Christmas Year 6'],
  'hp.y6.apparition_lessons_begin': ['Apparition lessons begin', 'before Apparition lessons', 'when Apparition lessons start'],
  'hp.y6.susan_bones_splinched': ['Susan Bones splinched', 'Susan Bones loses a leg', 'Apparition lesson splinching'],
  'hp.y6.ron_lavender_start': ['Ron starts dating Lavender', 'Ron and Lavender start', 'Ron dates the blonde girl'],
  'hp.y6.slughorn_christmas_party': ['Slughorn Christmas party', 'Christmas party Year 6', 'Harry brings Luna to Slughorn party'],
  'hp.y4.cedric_killed': ['Cedric dies', 'Cedric Diggory dies', 'when Cedric dies'],
  'hp.y4.voldemort_reborn': ['Voldemort comes back', 'Voldemort returns', 'Voldemort reborn'],
  'hp.postwar.kingsley_caretaker_minister': ['Kingsley becomes Minister', 'caretaker Minister for Magic', 'right after Voldemort is defeated'],
  'hp.postwar.wizarding_reconstruction_begins': ['after the war', 'post-war rebuilding', 'wizarding reconstruction'],
  'hp.postwar.dementors_removed_from_azkaban': ['Dementors removed from Azkaban', 'Azkaban reform', 'Kingsley removes Dementors'],
  'hp.postwar.harry_head_auror_department': ['Harry becomes Head Auror', 'Harry leads the Auror Department', 'Head of the Auror Department'],
  'hp.postwar.dumbledores_army_reunited_world_cup': ['Dumbledore\'s Army reunion', 'DA reunion at the World Cup', '2014 DA reunion'],
  'hp.postwar.quidditch_world_cup_2014_final': ['2014 Quidditch World Cup final', 'Viktor Krum wins the World Cup', 'Brazil versus Bulgaria final'],
  'hp.postwar.james_sirius_sorted_gryffindor': ['James Sirius starts Hogwarts', 'James Sirius sorted into Gryffindor', 'Harry and Ginny\'s eldest starts Hogwarts'],
  'hp.postwar.new_generation_kings_cross': ['nineteen years later', '19 years later', 'King\'s Cross epilogue', 'new generation at King\'s Cross'],
  'hp.postwar.albus_rose_scorpius_start_hogwarts': ['Albus starts Hogwarts', 'Rose starts Hogwarts', 'Scorpius starts Hogwarts', 'Albus Rose and Scorpius board the train'],
  'hp.postwar.teddy_lupin_and_victoire_platform': ['Teddy Lupin and Victoire', 'Teddy sees Victoire off', 'Victoire Weasley at King\'s Cross'],
};

const windowRangeOverrides = {
  'hp.y6.window.post_christmas_before_apparition': ['hp.y6.post_christmas_return', 'hp.y6.apparition_lessons_begin'],
  'hp.y6.window.apparition_lessons': ['hp.y6.apparition_lessons_begin', 'hp.y6.susan_bones_splinched'],
  'hp.y6.window.ron_lavender_active': ['hp.y6.ron_lavender_start', 'hp.y6.ron_love_potion'],
  'hp.y6.window.christmas_party_and_break': ['hp.y6.slughorn_christmas_party', 'hp.y6.post_christmas_return'],
  'hp.y7.window.shell_cottage': ['hp.y7.shell_cottage_refuge', 'hp.y7.gringotts_breakin'],
  'hp.y7.window.gringotts': ['hp.y7.gringotts_breakin', 'hp.y7.dragon_escape'],
  'hp.y7.window.hogwarts_return': ['hp.y7.hogwarts_return_plan', 'hp.y7.battle_hogwarts_begins'],
  'hp.y7.window.final_duel': ['hp.y7.narcissa_lies', 'hp.y7.voldemort_defeated'],
  'hp.postwar.window.immediate_rebuilding': ['hp.postwar.kingsley_caretaker_minister', 'hp.postwar.harry_joins_aurors'],
  'hp.postwar.window.early_ministry_reforms': ['hp.postwar.kingsley_elected_minister', 'hp.postwar.ministry_reforms_established'],
  'hp.postwar.window.postwar_publications_and_sports': ['hp.postwar.comic_relief_schoolbooks_published', 'hp.postwar.quidditch_world_cup_2010'],
  'hp.postwar.window.harry_auror_career': ['hp.postwar.harry_joins_aurors', 'hp.postwar.harry_head_auror_department'],
  'hp.postwar.window.quidditch_world_cup_2014': ['hp.postwar.quidditch_world_cup_2014_opening', 'hp.postwar.ginny_reports_gobstones_league'],
  'hp.postwar.window.next_generation_hogwarts': ['hp.postwar.james_sirius_sorted_gryffindor', 'hp.postwar.new_generation_kings_cross'],
  'hp.postwar.window.kings_cross_epilogue': ['hp.postwar.new_generation_kings_cross', 'hp.postwar.draco_family_platform'],
};

function parseIsoDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function isoFromEpoch(epoch) {
  return new Date(epoch).toISOString().slice(0, 10);
}

function sortKeyFromIso(value) {
  return Math.floor(parseIsoDate(value) / DAY_MS);
}

function titleCase(value) {
  return String(value || '')
    .replace(/\by(\d)\b/gi, 'Year $1')
    .replace(/\bhbp\b/gi, 'Half-Blood Prince')
    .replace(/\bpoa\b/gi, 'Prisoner of Azkaban')
    .replace(/\bgof\b/gi, 'Goblet of Fire')
    .replace(/\bootp\b/gi, 'Order of the Phoenix')
    .replace(/\bdh\b/gi, 'Deathly Hallows')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(word => {
      if (/^(DA|OWL|RAB)$/i.test(word)) return word.toUpperCase();
      if (/^(of|and|the|to|at|in|with|from)$/i.test(word)) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/^Hp /, '')
    .replace(/\bDumbledore\b/g, 'Dumbledore')
    .replace(/\bHogwarts\b/g, 'Hogwarts')
    .replace(/\bVoldemort\b/g, 'Voldemort')
    .replace(/\bSnape\b/g, 'Snape')
    .replace(/\bDraco\b/g, 'Draco')
    .replace(/\bHarry\b/g, 'Harry')
    .replace(/\bRon\b/g, 'Ron')
    .replace(/\bHermione\b/g, 'Hermione');
}

function labelFromId(id) {
  const parts = id.split('.');
  const meaningful = parts.slice(2).join(' ');
  return titleCase(meaningful);
}

function getSection(markdown, title) {
  const start = markdown.indexOf(`## ${title}`);
  if (start < 0) throw new Error(`Could not find section: ${title}`);
  const next = markdown.indexOf('\n## ', start + 4);
  return markdown.slice(start, next < 0 ? markdown.length : next);
}

function extractIds(section, prefix, wantWindows = false) {
  const ids = [];
  const seen = new Set();
  const pattern = new RegExp('`(' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^`]+)`', 'g');
  let match = null;
  while ((match = pattern.exec(section))) {
    const id = match[1].trim();
    const isWindow = id.includes('.window.');
    if (isWindow !== wantWindows || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function distributedDate(deck, index, total) {
  const start = parseIsoDate(deck.startDate);
  const end = parseIsoDate(deck.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || total <= 1) return deck.startDate;
  const epoch = start + ((end - start) * index / (total - 1));
  return isoFromEpoch(epoch);
}

function dateRangeForAnchor(deck, id, index, total) {
  if (dateRangeOverrides[id]) return dateRangeOverrides[id];
  const explicitDate = dateOverrides[id];
  if (explicitDate) {
    return {
      from: explicitDate,
      to: explicitDate,
      precision: 'known_or_curated',
    };
  }
  const date = distributedDate(deck, index, total);
  return {
    from: date,
    to: date,
    precision: 'approximate',
  };
}

function aliasesForAnchor(id, label, deck) {
  const aliases = new Set([
    label,
    label.replace(/^Year \d+ /, ''),
    id.split('.').slice(2).join(' '),
  ]);
  if (deck.schoolYear) {
    aliases.add(`Year ${deck.schoolYear} ${label}`);
    aliases.add(`${label} Year ${deck.schoolYear}`);
  }
  for (const alias of aliasOverrides[id] || []) aliases.add(alias);
  return [...aliases].map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 16);
}

function tagsForDeck(deck) {
  const tags = ['fandom:harry-potter', 'era:golden-trio', 'structure:split-loredeck', 'quality:human-vetted'];
  if (deck.schoolYear) tags.push(`school-year:${deck.schoolYear}`);
  else if ((deck.role || '') === 'epilogue') tags.push('scope:post-war', 'era:post-war');
  else tags.push('scope:core');
  for (const tag of deck.tags || []) tags.push(tag);
  return tags;
}

function buildAnchor(deck, id, index, total) {
  const dateRange = dateRangeForAnchor(deck, id, index, total);
  const label = labelFromId(id);
  const tags = tagsForDeck(deck);
  if (deck.book) tags.push(`book:${deck.book.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`);
  return {
    id,
    label,
    contextType: id.startsWith('hp.core.') ? 'recurring_context' : 'story_anchor',
    sortKey: sortKeyFromIso(dateRange.from),
    dateRange,
    book: deck.book || '',
    schoolYear: deck.schoolYear || '',
    arc: deck.era,
    aliases: aliasesForAnchor(id, label, deck),
    tags,
  };
}

function buildWindow(deck, id, index, windows, anchors) {
  const byId = new Map(anchors.map(anchor => [anchor.id, anchor]));
  let range = windowRangeOverrides[id];
  if (!range) {
    const span = Math.max(1, Math.ceil(anchors.length / Math.max(1, windows.length)));
    const fromIndex = Math.min(anchors.length - 1, index * span);
    const toIndex = Math.min(anchors.length - 1, Math.max(fromIndex, ((index + 1) * span) - 1));
    range = [anchors[fromIndex]?.id, anchors[toIndex]?.id];
  }
  const fromAnchor = byId.get(range?.[0]) || anchors[0];
  const toAnchor = byId.get(range?.[1]) || anchors[anchors.length - 1];
  return {
    id,
    label: labelFromId(id),
    contextType: 'window',
    windowKind: id.startsWith('hp.core.') ? 'recurring_cycle' : 'story_phase',
    validFromAnchor: fromAnchor?.id || '',
    validToAnchor: toAnchor?.id || '',
    sortKeyFrom: fromAnchor?.sortKey ?? null,
    sortKeyTo: toAnchor?.sortKey ?? null,
    aliases: [
      labelFromId(id),
      id.split('.').slice(2).join(' '),
    ],
    tags: tagsForDeck(deck),
  };
}

function buildTimeline(deck, anchorIds, windowIds) {
  const anchors = anchorIds.map((id, index) => buildAnchor(deck, id, index, anchorIds.length));
  const windows = windowIds.map((id, index) => buildWindow(deck, id, index, windowIds, anchors));
  const axes = [
    { id: 'calendar', type: 'calendar', label: 'Calendar Date' },
    { id: 'book', type: 'anchor', label: 'Book' },
  ];
  if (deck.schoolYear || deck.id === 'hp-core') axes.push({ id: 'schoolYear', type: 'phase', label: 'School Year' });
  axes.push({ id: 'arc', type: 'arc', label: 'Story Arc' });
  return {
    schemaVersion: 1,
    timelineMode: 'hybrid',
    defaultContextType: deck.id === 'hp-core' ? 'recurring_context' : 'story_anchor',
    sortKeyScale: 'date-derived-day',
    summary: `${deck.title} Context anchors and phase windows for Saga's Harry Potter Golden Trio deck family.`,
    axes,
    anchors,
    windows,
  };
}

function buildLoredeck(deck, timeline) {
  return {
    schemaVersion: 1,
    entrySchemaVersion: 3,
    id: deck.id,
    type: 'bundled',
    title: deck.title,
    description: deck.description,
    fandom: 'Harry Potter',
    era: deck.era,
    contentKind: 'fandom',
    author: 'Saga',
    version: '0.1.0',
    defaultLocale: 'en',
    generatedAt,
    databaseId: `saga.${deck.id}`,
    deckFamilyId: 'hp-golden-trio',
    family: {
      id: 'hp-golden-trio',
      title: 'Harry Potter: Golden Trio',
      role: deck.role || (deck.id === 'hp-core' ? 'core' : 'year'),
      recommendedCoreDeckId: deck.id === 'hp-core' ? '' : 'hp-core',
    },
    recommendedStack: deck.id === 'hp-core' ? [] : ['hp-core', deck.id],
    tags: tagsForDeck(deck),
    source: { kind: 'bundled', url: deck.sourceUrl || '' },
    update: { checkForUpdates: false, url: '', lastCheckedAt: 0 },
    continuity: {
      continuityId: 'hp-books',
      canonTier: 'primary',
      adaptation: 'book',
      sourceBoundary: deck.era,
    },
    runtimeDefaults: {
      scanDepth: null,
      recursiveTriggers: false,
      tokenBudget: null,
    },
    registries: {
      timeline: 'timeline.json',
    },
    files: [],
    compatibility: {
      sagaSchemaMin: 3,
      sagaSchemaMax: 3,
    },
    stats: {
      entryCount: 0,
      categoryCounts: {},
      timelineAnchorCount: timeline.anchors.length,
      timelineWindowCount: timeline.windows.length,
    },
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, stableJson(value), 'utf8');
}

async function main() {
  const plan = await fs.readFile(planPath, 'utf8');
  const report = [];
  for (const deck of decks) {
    const section = getSection(plan, deck.section);
    const prefix = deck.anchorPrefix || (deck.id === 'hp-core' ? 'hp.core.' : `hp.y${deck.schoolYear}.`);
    const anchorIds = extractIds(section, prefix, false);
    const windowIds = extractIds(section, prefix, true);
    if (!anchorIds.length) throw new Error(`No anchors found for ${deck.id}`);
    const timeline = buildTimeline(deck, anchorIds, windowIds);
    const manifest = buildLoredeck(deck, timeline);
    const outDir = path.join(loredeckRoot, deck.id);
    await writeJson(path.join(outDir, 'timeline.json'), timeline);
    await writeJson(path.join(outDir, 'loredeck.json'), manifest);
    await writeJson(path.join(outDir, 'manifest.json'), {
      ...manifest,
      schemaVersion: 2,
      databaseId: manifest.databaseId,
    });
    report.push({
      id: deck.id,
      anchors: timeline.anchors.length,
      windows: timeline.windows.length,
    });
  }
  console.log(JSON.stringify({ generated: report }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
