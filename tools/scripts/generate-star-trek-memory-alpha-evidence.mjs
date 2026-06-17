import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://memory-alpha.fandom.com/api.php';
const OUTPUT_JSON = 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json';
const OUTPUT_MD = 'docs/loredecks/STAR_TREK_TNG_DS9_VOY_MEMORY_ALPHA_EVIDENCE.md';

const SERIES = [
  {
    code: 'TNG',
    title: 'Star Trek: The Next Generation',
    deckPrefix: 'star-trek-tng-season',
    templatePrefix: 'TNG Season',
    seasons: [
      { season: 1, runtimeEpisodes: 26, inUniverseSpan: '2364' },
      { season: 2, runtimeEpisodes: 22, inUniverseSpan: '2365' },
      { season: 3, runtimeEpisodes: 26, inUniverseSpan: '2366' },
      { season: 4, runtimeEpisodes: 26, inUniverseSpan: '2367' },
      { season: 5, runtimeEpisodes: 26, inUniverseSpan: '2368' },
      { season: 6, runtimeEpisodes: 26, inUniverseSpan: '2369' },
      { season: 7, runtimeEpisodes: 26, inUniverseSpan: '2370' },
    ],
  },
  {
    code: 'DS9',
    title: 'Star Trek: Deep Space Nine',
    deckPrefix: 'star-trek-ds9-season',
    templatePrefix: 'DS9 Season',
    seasons: [
      { season: 1, runtimeEpisodes: 20, inUniverseSpan: '2369' },
      { season: 2, runtimeEpisodes: 26, inUniverseSpan: '2370' },
      { season: 3, runtimeEpisodes: 26, inUniverseSpan: '2371' },
      { season: 4, runtimeEpisodes: 26, inUniverseSpan: '2372' },
      { season: 5, runtimeEpisodes: 26, inUniverseSpan: '2373' },
      { season: 6, runtimeEpisodes: 26, inUniverseSpan: '2374' },
      { season: 7, runtimeEpisodes: 26, inUniverseSpan: '2375' },
    ],
  },
  {
    code: 'VOY',
    title: 'Star Trek: Voyager',
    deckPrefix: 'star-trek-voy-season',
    templatePrefix: 'VOY Season',
    seasons: [
      { season: 1, runtimeEpisodes: 16, inUniverseSpan: '2371' },
      { season: 2, runtimeEpisodes: 26, inUniverseSpan: '2371-2372' },
      { season: 3, runtimeEpisodes: 26, inUniverseSpan: '2373' },
      { season: 4, runtimeEpisodes: 26, inUniverseSpan: '2374' },
      { season: 5, runtimeEpisodes: 26, inUniverseSpan: '2375' },
      { season: 6, runtimeEpisodes: 26, inUniverseSpan: '2376' },
      { season: 7, runtimeEpisodes: 26, inUniverseSpan: '2377-2378' },
    ],
  },
];

const SKIP_LINKS = new Set([
  'Act',
  'Admiral',
  'Alien',
  'Ambassador',
  'Artificial intelligence',
  'Assistant',
  'Away team',
  'Battle',
  'Biobed',
  'Bridge',
  'Captain',
  'Captain\'s log',
  'Cargo bay',
  'Class M',
  'Class',
  'Colony',
  'Combadge',
  'Command chair',
  'Commanding officer',
  'Communication',
  'Commander',
  'Computer',
  'Corridor',
  'Counselor',
  'Crew',
  'Day',
  'Doctor',
  'Earth',
  'Ensign',
  'Federation',
  'Federation starship',
  'First officer',
  'Hail',
  'Holodeck',
  'Human',
  'Humanoid',
  'Impulse',
  'Lieutenant Commander',
  'Lieutenant',
  'Lieutenant commander',
  'Life sign',
  'Log',
  'Main engines',
  'Milky Way Galaxy',
  'Orbit',
  'Planet',
  'Probe',
  'Quarters',
  'Ready room',
  'Red alert',
  'Replicator',
  'Sensor',
  'Shuttlecraft',
  'Sickbay',
  'Science officer',
  'Sector',
  'Senior officer',
  'Space',
  'Starbase',
  'Stardate',
  'Starfleet',
  'Starfleet officer',
  'Starship',
  'Subspace',
  'Tactical',
  'Transporter',
  'Turbolift',
  'USS',
  'Vessel',
  'Viewsreen',
  'Viewscreen',
  'Warp drive',
  'Warp field',
  'Warp core breach',
  'Year',
]);
const SKIP_LINK_KEYS = new Set([...SKIP_LINKS].map(link => link.toLowerCase()));

const SIGNAL_RULES = [
  ['Borg', 'Borg encounter/assimilation gate'],
  ['Locutus', 'Locutus/Picard trauma gate'],
  ['Q', 'Q intervention or trial gate', 'exact'],
  ['Lore', 'Data/Lore android-family gate'],
  ['Lal', 'Data family/personhood gate'],
  ['Soong', 'Soong android lineage gate'],
  ['Klingon', 'Klingon duty/faction-status gate'],
  ['Romulan', 'Romulan secrecy/political pressure gate'],
  ['Cardassian', 'Cardassian occupation or border-pressure gate'],
  ['Bajor', 'Bajoran occupation/religion gate'],
  ['Bajoran', 'Bajoran occupation/religion gate'],
  ['Prophet', 'Prophets/Emissary gate'],
  ['Pah-wraith', 'Pah-wraith secrecy/endgame gate'],
  ['Dominion', 'Dominion strategic-threat gate'],
  ['Jem\'Hadar', 'Jem\'Hadar reveal or war gate'],
  ['Founder', 'Founder identity/Changeling gate'],
  ['Changeling', 'Changeling identity/Founder gate'],
  ['Section 31', 'Section 31 secrecy gate'],
  ['Maquis', 'Maquis political/crew-loyalty gate'],
  ['Bajoran wormhole', 'Bajoran wormhole route gate'],
  ['wormhole', 'wormhole/anomaly route gate', 'word'],
  ['Defiant', 'Defiant/station militarization gate'],
  ['genetic', 'genetic secret gate'],
  ['Ferengi', 'Ferengi family/rule-of-acquisition gate'],
  ['Caretaker', 'Caretaker displacement gate'],
  ['Delta Quadrant', 'Delta Quadrant isolation gate'],
  ['Kazon', 'Kazon conflict gate'],
  ['Seska', 'Seska betrayal/Kazon arc gate'],
  ['Vidiian', 'Vidiian Phage/body-horror gate'],
  ['The Doctor', 'EMH autonomy/identity gate'],
  ['Emergency Medical Hologram', 'EMH autonomy/identity gate'],
  ['EMH', 'EMH autonomy/identity gate', 'word'],
  ['Seven of Nine', 'Seven/Borg recovery gate'],
  ['Species 8472', 'Species 8472/Borg conflict gate'],
  ['Hirogen', 'Hirogen hunt-culture gate'],
  ['Krenim', 'Krenim temporal-war gate'],
  ['Equinox', 'Equinox ethics gate'],
  ['Pathfinder', 'Alpha Quadrant contact gate'],
  ['Barclay', 'Barclay Pathfinder support gate'],
  ['Q Continuum', 'Q Continuum gate'],
  ['Mirror universe', 'Mirror universe branch gate'],
  ['holodeck', 'holodeck reality/safety gate'],
  ['temporal', 'temporal anomaly/status gate'],
  ['death', 'death/status-change gate'],
  ['dies', 'death/status-change gate'],
  ['killed', 'death/status-change gate'],
  ['joins', 'crew-join/status-change gate'],
  ['promoted', 'rank/status-change gate'],
  ['assimilated', 'assimilation status gate'],
  ['married', 'relationship-status gate'],
  ['marriage', 'relationship-status gate'],
  ['betray', 'betrayal/hidden-loyalty gate'],
  ['traitor', 'betrayal/hidden-loyalty gate'],
  ['secret', 'secret-knowledge gate'],
  ['reveal', 'reveal timing gate'],
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(params) {
  const url = `${API}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SagaLoredeckEvidenceBot/0.1 (local authoring evidence generation)',
        Accept: 'application/json',
      },
    });
    if (response.ok) return response.json();
    if (attempt === 4) {
      throw new Error(`Memory Alpha request failed ${response.status} ${response.statusText}: ${url}`);
    }
    await sleep(500 * attempt);
  }
}

async function getWikitext(page) {
  const json = await api({
    action: 'parse',
    format: 'json',
    page,
    prop: 'wikitext',
    redirects: '1',
  });
  if (!json.parse?.wikitext?.['*']) {
    throw new Error(`No wikitext for ${page}`);
  }
  return {
    title: json.parse.title,
    pageid: json.parse.pageid,
    wikitext: json.parse.wikitext['*'],
  };
}

function parseRows(wikitext) {
  const rows = [];
  const rowPattern = /\{\{row\|([^{}\n]+?)\}\}/g;
  let match;
  while ((match = rowPattern.exec(wikitext))) {
    const parts = match[1].split('|').map(part => part.trim());
    const title = parts[0];
    if (!title || title.toLowerCase().startsWith('header') || title.toLowerCase().startsWith('footer')) continue;
    rows.push({
      title,
      stardateFromTemplate: parts[1] || '',
      stardateToTemplate: parts[2] || '',
    });
  }
  return rows;
}

function findTemplate(wikitext, name) {
  const lower = wikitext.toLowerCase();
  const marker = `{{${name.toLowerCase()}`;
  const start = lower.indexOf(marker);
  if (start < 0) return '';
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i += 1) {
    const pair = wikitext.slice(i, i + 2);
    if (pair === '{{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (pair === '}}') {
      depth -= 1;
      i += 1;
      if (depth === 0) return wikitext.slice(start, i + 1);
    }
  }
  return '';
}

function parseSidebar(wikitext) {
  const template = findTemplate(wikitext, 'sidebar episode');
  const fields = {};
  if (!template) return fields;
  for (const rawLine of template.split(/\r?\n/)) {
    const line = rawLine.replace(/<!--.*?-->/g, '').trim();
    if (!line.startsWith('|')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(1, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key) fields[key] = cleanInline(value);
  }
  return fields;
}

function leadBlock(wikitext) {
  const beforeSummary = wikitext.split(/\n==\s*Summary\s*==/i)[0] || '';
  return beforeSummary
    .split(/\r?\n/)
    .filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('{{') && !trimmed.startsWith('|') && !trimmed.startsWith('[[');
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstSummarySlice(wikitext) {
  const summaryIndex = wikitext.search(/\n==\s*Summary\s*==/i);
  if (summaryIndex < 0) return '';
  return wikitext.slice(summaryIndex, summaryIndex + 3200);
}

function cleanInline(value) {
  return value
    .replace(/\{\{small\|([^{}]+)\}\}/g, '$1')
    .replace(/\{\{d\|([^|{}]+)\|([^|{}]+)\|([^|{}]+)\}\}/g, '$1 $2 $3')
    .replace(/\{\{m\|([^|{}]+)\|([^|{}]+)\}\}/g, '$1 $2')
    .replace(/\{\{y\|([^|{}]+)\}\}/g, '$1')
    .replace(/\{\{s\|([^|{}]+)\}\}/g, '$1')
    .replace(/\{\{USS\|([^|{}]+)\|([^|{}]+)\|?([^|{}]*)\}\}/g, (_, ship, registry, suffix) => `USS ${ship}${suffix || ''}`)
    .replace(/\{\{USSr\|([^|{}]+)\}\}/g, 'USS $1')
    .replace(/\{\{Class\|([^|{}]+)\}\}/gi, '$1-class')
    .replace(/\{\{[A-Za-z0-9 _-]+\|([^{}]+)\}\}/g, '$1')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/''+/g, '')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLinks(text) {
  const links = [];
  const wikiLinkPattern = /\[\[([^|\]#]+)(?:#[^|\]]+)?(?:\|([^\]]+))?\]\]/g;
  let match;
  while ((match = wikiLinkPattern.exec(text))) {
    const target = cleanInline(match[1]);
    const display = cleanInline(match[2] || match[1]);
    if (!target || target.includes(':') || SKIP_LINK_KEYS.has(target.toLowerCase()) || SKIP_LINK_KEYS.has(display.toLowerCase())) continue;
    links.push(display);
  }
  const ussPattern = /\{\{USS\|([^|{}]+)\|([^|{}]+)\|?([^|{}]*)\}\}/g;
  while ((match = ussPattern.exec(text))) {
    const suffix = match[3] || '';
    links.push(`USS ${match[1]}${suffix}`);
  }
  const unique = [];
  const seen = new Set();
  for (const link of links) {
    const normalized = link.replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique.slice(0, 14);
}

function extractYears(dateText) {
  const years = new Set();
  for (const match of dateText.matchAll(/\b(23\d{2}|24\d{2})\b/g)) years.add(match[1]);
  return [...years];
}

function extractSignals({ title, lead, sidebar, links }) {
  const text = `${title} ${lead} ${Object.values(sidebar).join(' ')} ${links.join(' ')}`;
  const lower = text.toLowerCase();
  const signals = [];
  for (const [needle, signal, mode] of SIGNAL_RULES) {
    if (matchesSignal(lower, needle, mode) && !signals.includes(signal)) {
      signals.push(signal);
    }
  }
  if (!signals.length) {
    signals.push('episode-local fact/status gate');
  }
  return signals.slice(0, 5);
}

function matchesSignal(lowerText, needle, mode = 'phrase') {
  const escaped = needle.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (mode === 'exact' || mode === 'word') {
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lowerText);
  }
  return lowerText.includes(needle.toLowerCase());
}

function episodePageCandidates(title) {
  const normalized = title.replace(/_/g, ' ').trim();
  return [
    `${normalized} (episode)`,
    normalized,
  ];
}

async function fetchEpisodePage(title) {
  const errors = [];
  for (const candidate of episodePageCandidates(title)) {
    try {
      return await getWikitext(candidate);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(errors.join('; '));
}

function markdownEscape(text) {
  return String(text || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function makeEpisodeRecord({ series, season, episodeIndex, row, page }) {
  const sidebar = parseSidebar(page.wikitext);
  const lead = leadBlock(page.wikitext);
  const linkSource = `${lead} ${firstSummarySlice(page.wikitext)}`;
  const links = extractLinks(linkSource);
  const date = sidebar.date || [
    row.stardateFromTemplate,
    row.stardateToTemplate && row.stardateToTemplate !== row.stardateFromTemplate ? row.stardateToTemplate : '',
  ].filter(Boolean).join('-');
  const arc = sidebar.arc || '';
  const years = extractYears(date || season.inUniverseSpan);
  const signals = extractSignals({ title: row.title, lead, sidebar, links });
  return {
    series: series.code,
    seriesTitle: series.title,
    season: season.season,
    deckId: `${series.deckPrefix}-${season.season}`,
    memoryAlphaStoryEpisode: episodeIndex,
    title: page.title.replace(/ \(episode\)$/i, ''),
    pageTitle: page.title,
    url: `https://memory-alpha.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
    stardateFromTemplate: row.stardateFromTemplate,
    stardateToTemplate: row.stardateToTemplate,
    date,
    years,
    arc,
    arcNumber: sidebar['arc number'] || '',
    arcCount: sidebar['arc count'] || '',
    keyEntities: links,
    authoringSignals: signals,
  };
}

function buildMarkdown(evidence) {
  const lines = [];
  lines.push('# Star Trek Memory Alpha Episode Evidence');
  lines.push('');
  lines.push('Generated from Memory Alpha season templates and per-episode pages. This is an authoring evidence index, not Lorecard prose and not a wiki replacement.');
  lines.push('');
  lines.push('Use it to plan Context anchors, sourceInfo, high-value gates, secrets, character-state shifts, relationship-state shifts, faction-state shifts, and spoiler windows before writing any JSON.');
  lines.push('');
  lines.push('Columns:');
  lines.push('');
  lines.push('- `MA #`: Memory Alpha story-episode order. Feature-length stories may count as one Memory Alpha story episode while Saga should still support split runtime episode aliases.');
  lines.push('- `Date`: Memory Alpha `sidebar episode` date/stardate field when available, falling back to season-template stardates.');
  lines.push('- `Entities`: high-signal linked entities from the lead and early summary, filtered to avoid generic terms.');
  lines.push('- `Authoring signals`: generated gate hints. Review them against the episode page before turning them into Lorecards.');
  lines.push('');
  for (const series of SERIES) {
    lines.push(`## ${series.title}`);
    lines.push('');
    const seriesRecords = evidence.episodes.filter(ep => ep.series === series.code);
    for (const season of series.seasons) {
      const deckId = `${series.deckPrefix}-${season.season}`;
      const records = seriesRecords.filter(ep => ep.season === season.season);
      lines.push(`### ${series.code} Season ${season.season} - \`${deckId}\``);
      lines.push('');
      lines.push(`Memory Alpha story episodes: ${records.length}. Saga runtime episode aliases to support: ${season.runtimeEpisodes}. In-universe span: ${season.inUniverseSpan}.`);
      lines.push('');
      lines.push('| MA # | Episode | Date | Arc | Entities | Authoring signals |');
      lines.push('| ---: | --- | --- | --- | --- | --- |');
      for (const ep of records) {
        lines.push(`| ${ep.memoryAlphaStoryEpisode} | [${markdownEscape(ep.title)}](${ep.url}) | ${markdownEscape(ep.date)} | ${markdownEscape(ep.arc)} | ${markdownEscape(ep.keyEntities.slice(0, 8).join(', '))} | ${markdownEscape(ep.authoringSignals.join('; '))} |`);
      }
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const evidence = {
    generatedAt: new Date().toISOString(),
    source: 'Memory Alpha API season templates and per-episode wikitext',
    episodes: [],
    failures: [],
  };
  for (const series of SERIES) {
    for (const season of series.seasons) {
      const templatePage = `Template:${series.templatePrefix} ${season.season}`;
      const template = await getWikitext(templatePage);
      const rows = parseRows(template.wikitext);
      console.log(`${series.code} season ${season.season}: ${rows.length} Memory Alpha story rows`);
      let index = 0;
      for (const row of rows) {
        index += 1;
        try {
          const page = await fetchEpisodePage(row.title);
          evidence.episodes.push(makeEpisodeRecord({ series, season, episodeIndex: index, row, page }));
        } catch (error) {
          evidence.failures.push({
            series: series.code,
            season: season.season,
            episodeIndex: index,
            title: row.title,
            message: error.message,
          });
        }
        await sleep(80);
      }
    }
  }

  evidence.summary = {
    episodeCount: evidence.episodes.length,
    failureCount: evidence.failures.length,
    byDeck: Object.fromEntries(
      SERIES.flatMap(series => series.seasons.map(season => {
        const deckId = `${series.deckPrefix}-${season.season}`;
        return [deckId, evidence.episodes.filter(ep => ep.deckId === deckId).length];
      })),
    ),
  };

  await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(evidence, null, 2)}\n`);
  await fs.writeFile(OUTPUT_MD, buildMarkdown(evidence));
  console.log(`Wrote ${OUTPUT_JSON}`);
  console.log(`Wrote ${OUTPUT_MD}`);
  if (evidence.failures.length) {
    console.error(`Failures: ${evidence.failures.length}`);
    for (const failure of evidence.failures) {
      console.error(`${failure.series} S${failure.season} #${failure.episodeIndex} ${failure.title}: ${failure.message}`);
    }
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
