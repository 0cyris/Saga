import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const EVIDENCE_PATH = path.join(ROOT, 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json');
const UPDATED_AT = 1781740800000;
const ENTRY_SCHEMA_VERSION = 3;
const COVER_ASSET_PATH = 'assets/cover.png';

const SERIES = Object.freeze({
  TNG: {
    title: 'Star Trek: The Next Generation',
    shortTitle: 'Star Trek TNG',
    label: 'TNG',
    slug: 'tng',
    libraryPath: ['Star Trek', 'The Next Generation'],
    sortBase: 9000,
  },
  DS9: {
    title: 'Star Trek: Deep Space Nine',
    shortTitle: 'Star Trek DS9',
    label: 'DS9',
    slug: 'ds9',
    libraryPath: ['Star Trek', 'Deep Space Nine'],
    sortBase: 20000,
  },
  VOY: {
    title: 'Star Trek: Voyager',
    shortTitle: 'Star Trek Voyager',
    label: 'VOY',
    slug: 'voy',
    libraryPath: ['Star Trek', 'Voyager'],
    sortBase: 30000,
  },
});

const TNG_S4_FOCUS = Object.freeze({
  'The Best of Both Worlds, Part II': {
    characters: ['Jean-Luc Picard', 'William Riker', 'Data', 'Elizabeth Shelby'],
    factions: ['Starfleet', 'Borg Collective'],
    topics: ['Locutus rescue', 'Wolf 359', 'Borg cube'],
    event: 'Picard is recovered from Borg control after the Enterprise exploits his Locutus link, while Wolf 359 becomes a fleet-level trauma.',
    state: 'Picard is no longer Locutus, Riker returns from acting command, and Shelby remains a Borg-crisis specialist rather than permanent Enterprise crew.',
    guard: 'Do not import Hugh, the Borg Queen, Seven of Nine, or later Borg individuality arcs into this season-4 resolution.',
  },
  Family: {
    characters: ['Jean-Luc Picard', 'Robert Picard', 'Worf', 'Wesley Crusher'],
    factions: ['Starfleet', 'Klingon Empire'],
    topics: ['La Barre', 'Picard trauma', 'Rozhenko family', 'Jack Crusher message'],
    event: 'Picard recovery moves to La Barre, Worf receives Rozhenko family support, and Wesley receives a message from Jack Crusher.',
    state: 'Picard command competence coexists with anger and shame from assimilation; Worf family identity is both human-raised and Klingon.',
    guard: 'Do not treat Borg rescue as emotional reset, and do not make Jack Crusher alive or newly active.',
  },
  Brothers: {
    characters: ['Data', 'Lore', 'Noonien Soong'],
    factions: ['Starfleet'],
    topics: ['Soong homing signal', 'emotion chip', 'Terlina III'],
    event: 'Data is drawn by Soong programming to Terlina III, where he and Lore briefly reunite with Noonien Soong.',
    state: 'Data control risk is tied to a rare Soong homing command, while Lore steals the emotion chip meant for Data.',
    guard: 'Data does not receive stable emotions in season 4; block Generations-era emotion-chip behavior and later Lore outcomes.',
  },
  'Suddenly Human': {
    characters: ['Jono', 'Jean-Luc Picard', 'Endar'],
    factions: ['Talarians', 'Starfleet'],
    topics: ['Talarian custody', 'cultural identity', 'child trauma'],
    event: 'Jeremiah Rossa is Jono, a human-born child raised as Talarian by Captain Endar.',
    state: 'Picard cannot solve Jono identity through command authority alone; Jono chooses his Talarian family.',
    guard: 'Do not keep Jono aboard or force a human identity reset after the episode resolves.',
  },
  'Remember Me': {
    characters: ['Beverly Crusher', 'Wesley Crusher', 'The Traveler'],
    factions: ['Starfleet'],
    topics: ['warp bubble', 'pocket universe', 'Traveler'],
    event: 'Beverly Crusher becomes trapped in a shrinking warp-bubble reality created by Wesley experiment.',
    state: 'Wesley and the Traveler are tied to a rare thought-and-warp rescue mechanism, not routine Starfleet technology.',
    guard: 'Do not import later Traveler or Wesley destiny outcomes into this season-4 anomaly.',
  },
  Legacy: {
    characters: ['Ishara Yar', 'Tasha Yar', 'Data'],
    factions: ['Coalition', 'Alliance', 'Starfleet'],
    topics: ['Turkana IV', 'Tasha family', 'Ishara betrayal'],
    event: 'Ishara Yar appears as Tasha sister during a violent Turkana IV faction conflict.',
    state: 'Data trust in Ishara becomes a personal wound after she uses the Enterprise crew for faction goals.',
    guard: 'Do not make Ishara a Tasha replacement, permanent Enterprise crew member, or recurring Federation ally.',
  },
  Reunion: {
    characters: ['Worf', "K'Ehleyr", 'Alexander Rozhenko', 'Gowron', 'Duras'],
    factions: ['Klingon Empire', 'Starfleet'],
    topics: ['Klingon succession', 'Alexander', "K'Ehleyr death", 'Duras'],
    event: "K'mpec asks Picard to arbitrate Klingon succession, K'Ehleyr returns with Alexander, and Duras murders her.",
    state: 'Worf becomes a father, kills Duras in vengeance, and remains entangled in Klingon political fallout.',
    guard: 'Do not keep Duras alive after Reunion or import later Alexander and DS9-era Worf family outcomes.',
  },
  'Future Imperfect': {
    characters: ['William Riker', 'Barash'],
    factions: ['Starfleet'],
    topics: ['false future', 'illusion', 'Barash'],
    event: 'Riker is trapped in an invented future scenario that appears to make him captain years later.',
    state: 'The future details are illusion-only and collapse into Barash lonely attempt to create companionship.',
    guard: 'Block false-future ranks, deaths, and family facts from becoming normal continuity.',
  },
  'Final Mission': {
    characters: ['Wesley Crusher', 'Jean-Luc Picard', 'Dirgo'],
    factions: ['Starfleet'],
    topics: ['Wesley departure', 'desert moon', 'Academy'],
    event: 'Picard and Wesley are stranded during Wesley last Enterprise mission before Starfleet Academy.',
    state: 'Wesley saves Picard and leaves routine Enterprise bridge duty after this departure gate.',
    guard: 'Do not keep Wesley routinely aboard after Final Mission unless a later episode or deck returns him.',
  },
  'The Loss': {
    characters: ['Deanna Troi', 'Jean-Luc Picard'],
    factions: ['Starfleet'],
    topics: ['empathy loss', 'two-dimensional lifeforms', 'identity'],
    event: 'Troi temporarily loses her empathic sense while two-dimensional lifeforms pull the Enterprise into danger.',
    state: 'Troi impairment tests her counselor identity but is resolved within the episode window.',
    guard: 'Do not keep Troi permanently non-empathic or make the lifeforms recurring Federation politics.',
  },
  "Data's Day": {
    characters: ['Data', 'Bruce Maddox', "Miles O'Brien", 'Keiko Ishikawa', "T'Pel"],
    factions: ['Starfleet', 'Romulan Star Empire', 'Vulcans'],
    topics: ['Maddox letter', "O'Brien Keiko wedding", "T'Pel Selok reveal"],
    event: "Data records an ordinary Enterprise day for Bruce Maddox while O'Brien and Keiko marry and T'Pel is exposed as Selok.",
    state: 'Data observes social ritual and deception from an android perspective rather than through ordinary emotion.',
    guard: 'Do not import DS9 OBrien family arcs or turn Maddox into an active antagonist in this episode.',
  },
  'The Wounded': {
    characters: ['Jean-Luc Picard', 'Benjamin Maxwell', "Miles O'Brien", 'Gul Macet'],
    factions: ['Starfleet', 'Cardassian Union'],
    topics: ['Cardassians', 'post-war peace', 'Setlik III', 'rogue captain'],
    event: 'The Enterprise confronts a fragile Federation-Cardassian peace after Captain Maxwell attacks Cardassian targets.',
    state: "O'Brien carries explicit Cardassian-war trauma while Picard works to prevent Maxwell from reigniting war.",
    guard: 'Block DS9, Dukat, Bajoran occupation expansion, Maquis escalation, and later Alpha Quadrant war material from this TNG season gate.',
  },
  "Devil's Due": {
    characters: ['Jean-Luc Picard', 'Ardra'],
    factions: ['Starfleet'],
    topics: ['Ventax II', 'contract law', 'con artist'],
    event: 'Ardra claims mythic authority over Ventax II until Picard exposes the claim as technological fraud.',
    state: 'Picard defeats the crisis through law, evidence, and performance rather than supernatural acceptance.',
    guard: 'Do not write Ardra as a literal deity or durable cosmic claimant after the reveal.',
  },
  Clues: {
    characters: ['Jean-Luc Picard', 'Data'],
    factions: ['Starfleet', 'Paxans'],
    topics: ['memory erasure', 'missing day', 'Data deception'],
    event: 'The crew discovers a missing day created by Paxan memory erasure and Picard earlier secrecy order.',
    state: 'Data apparent dishonesty is an order-bound exception in a contact-secrecy crisis.',
    guard: 'Keep Paxans isolated after Clues; do not turn them into public Federation contacts.',
  },
  'First Contact': {
    characters: ['Jean-Luc Picard', 'William Riker', 'Mirasta Yale', 'Avel Durken'],
    factions: ['Malcorians', 'Starfleet'],
    topics: ['Malcor III', 'undercover Riker', 'warp threshold'],
    event: 'The Enterprise first-contact mission on Malcor III goes public after Riker undercover injury.',
    state: 'Mirasta Yale accepts spacefaring life, while Durken delays open contact until his people are ready.',
    guard: 'Do not make Malcor III a Federation member or broad galactic actor after the episode.',
  },
  "Galaxy's Child": {
    characters: ['Geordi La Forge', 'Leah Brahms', 'Jean-Luc Picard'],
    factions: ['Starfleet'],
    topics: ['real Leah Brahms', 'holodeck consent', 'spaceborne lifeform'],
    event: 'The real Leah Brahms comes aboard while a spaceborne lifeform offspring attaches to the Enterprise.',
    state: 'Geordi must distinguish the real Leah from his prior holodeck simulation and repair professional boundaries.',
    guard: 'Do not make Leah an ongoing romance or treat the old holoprogram as consent.',
  },
  'Night Terrors': {
    characters: ['Beverly Crusher', 'Deanna Troi'],
    factions: ['Starfleet'],
    topics: ['REM deprivation', 'dream contact', 'Tyken rift'],
    event: 'The crew suffers dream deprivation and hallucination while trapped in a rift.',
    state: 'Troi dream imagery becomes the specific communication key for the trapped aliens.',
    guard: 'Do not keep the crew impaired or turn dream contact into a general-purpose telepathic language.',
  },
  'Identity Crisis': {
    characters: ['Geordi La Forge', 'Susanna Leijten'],
    factions: ['Starfleet'],
    topics: ['Tarchannen III', 'transformation', 'holodeck clue'],
    event: 'Geordi and old away-team members face a hidden Tarchannen transformation.',
    state: 'Susanna Leijten ties Geordi to the old mission, and holodeck reconstruction provides the forensic clue.',
    guard: 'Keep the transformation local to this incident rather than a broad Starfleet medical condition.',
  },
  'The Nth Degree': {
    characters: ['Reginald Barclay', 'Jean-Luc Picard'],
    factions: ['Starfleet', 'Cytherians'],
    topics: ['Cytherian probe', 'Barclay enhancement', 'long-range contact'],
    event: 'A Cytherian probe temporarily enhances Barclay until he can bring the Enterprise to the Cytherians.',
    state: 'Barclay gains confidence from the experience but does not remain permanently superintelligent.',
    guard: 'Block Voyager Pathfinder outcomes and permanent all-powerful Barclay behavior from this season gate.',
  },
  Qpid: {
    characters: ['Jean-Luc Picard', 'Vash', 'Q'],
    factions: ['Starfleet', 'Q Continuum'],
    topics: ['Vash', 'Robin Hood fantasy', 'Q test'],
    event: 'Vash returns at an archaeology conference and Q traps Picard and crew in a Robin Hood fantasy.',
    state: 'Vash is a known Picard relationship by this point, but the Sherwood identities are Q-created scenario roles.',
    guard: 'Do not import later DS9 Vash or post-Qpid Q outcomes into this season deck.',
  },
  'The Drumhead': {
    characters: ['Jean-Luc Picard', 'Norah Satie', 'Simon Tarses', 'Worf'],
    factions: ['Starfleet', 'Romulan Star Empire'],
    topics: ['Satie inquiry', 'civil liberties', 'Romulan ancestry'],
    event: 'A sabotage investigation escalates into Satie paranoia and accusation.',
    state: 'Worf learns the cost of hardline security without evidence, while Tarses ancestry lie is not treason.',
    guard: 'Do not let security fear override civil-rights boundaries or turn Tarses privacy into proof of guilt.',
  },
  'Half a Life': {
    characters: ['Lwaxana Troi', 'Timicin'],
    factions: ['Kaelons', 'Federation'],
    topics: ['Kaelon Resolution', 'ritual death', 'Prime Directive'],
    event: 'Lwaxana forms a serious bond with Timicin while challenging the Kaelon Resolution ritual.',
    state: 'Timicin remains trapped between personal desire, scientific duty, and cultural law.',
    guard: 'Do not undo Timicin death or make the Federation forcibly reform Kaelon society.',
  },
  'The Host': {
    characters: ['Beverly Crusher', 'Odan', 'William Riker'],
    factions: ['Trill', 'Federation', 'Starfleet'],
    topics: ['Trill symbiont', 'host transfer', 'Crusher Odan relationship'],
    event: 'Odan is revealed as a Trill symbiont whose host can die while the symbiont continues.',
    state: 'Crusher relationship with Odan is real but does not survive the host-transfer boundary as an ongoing romance.',
    guard: 'Do not import Dax, DS9 Trill customs, symbiont pools, or later joined-Trill retcons into this TNG introduction.',
  },
  "The Mind's Eye": {
    characters: ['Geordi La Forge', 'Worf', 'Kell', 'Sela'],
    factions: ['Starfleet', 'Romulan Star Empire', 'Klingon Empire'],
    topics: ['Romulan conditioning', 'Duras conspiracy', 'Sela reveal guard'],
    event: 'Romulans condition Geordi as an unwitting assassin in a Klingon political plot.',
    state: 'Geordi is a victim of coercive conditioning, while Kell links the plot to Duras-aligned Klingon politics.',
    guard: 'Do not reveal Sela identity before Redemption, even when Romulan manipulation is visible.',
  },
  'In Theory': {
    characters: ['Data', "Jenna D'Sora", 'Jean-Luc Picard'],
    factions: ['Starfleet'],
    topics: ['Data relationship experiment', 'dark matter nebula', 'android boundaries'],
    event: "Data attempts a romantic relationship with Jenna D'Sora while the Enterprise faces a nebula hazard.",
    state: 'Data can follow relationship expectations procedurally without becoming emotionally human.',
    guard: 'Do not carry Jenna as an ongoing partner or write Data as emotionally in love after the episode.',
  },
  Redemption: {
    characters: ['Worf', 'Gowron', 'Lursa', "B'Etor", 'Toral', 'Sela'],
    factions: ['Klingon Empire', 'Romulan Star Empire', 'Starfleet'],
    topics: ['Klingon civil war', 'Duras sisters', 'Worf resigns', 'Sela reveal'],
    event: 'Gowron faces a Duras-family challenge backed by Romulan interests, and Worf leaves Starfleet duty to support the Klingon crisis.',
    state: 'Season 4 ends with Worf away from his normal post and Sela revealed as the Romulan face behind Duras support.',
    guard: 'Do not resolve Redemption Part II, the Klingon civil war, Worf Starfleet status, or later Sela consequences inside season 4.',
  },
});

const KNOWN_CHARACTER_NAMES = [
  'Jean-Luc Picard',
  'William Riker',
  'Data',
  'Worf',
  'Geordi La Forge',
  'Beverly Crusher',
  'Deanna Troi',
  'Wesley Crusher',
  'Guinan',
  'Reginald Barclay',
  'Miles O\'Brien',
  'Keiko Ishikawa',
  'Ro Laren',
  'Alexander Rozhenko',
  'Spock',
  'Sela',
  'Gowron',
  'Kurn',
  'Lursa',
  'B\'Etor',
  'Benjamin Sisko',
  'Kira Nerys',
  'Jadzia Dax',
  'Julian Bashir',
  'Odo',
  'Quark',
  'Jake Sisko',
  'Nog',
  'Rom',
  'Garak',
  'Dukat',
  'Weyoun',
  'Winn Adami',
  'Kathryn Janeway',
  'Chakotay',
  'Tuvok',
  'B\'Elanna Torres',
  'Tom Paris',
  'Harry Kim',
  'The Doctor',
  'Kes',
  'Neelix',
  'Seven of Nine',
];

const FACTION_PATTERNS = [
  ['Borg', 'Borg Collective'],
  ['Klingon', 'Klingon Empire'],
  ['Romulan', 'Romulan Star Empire'],
  ['Cardassian', 'Cardassian Union'],
  ['Bajoran', 'Bajorans'],
  ['Ferengi', 'Ferengi Alliance'],
  ['Dominion', 'Dominion'],
  ['Jem\'Hadar', 'Jem\'Hadar'],
  ['Founders', 'Founders'],
  ['Maquis', 'Maquis'],
  ['Trill', 'Trill'],
  ['Vulcan', 'Vulcans'],
  ['Q ', 'Q Continuum'],
  ['Qpid', 'Q Continuum'],
  ['Kazon', 'Kazon'],
  ['Vidiian', 'Vidiians'],
  ['Hirogen', 'Hirogen'],
  ['Species 8472', 'Species 8472'],
  ['Malcor', 'Malcorians'],
  ['Talarian', 'Talarians'],
];

const CHARACTER_ALIASES = Object.freeze({
  Picard: 'Jean-Luc Picard',
  Riker: 'William Riker',
  Crusher: 'Beverly Crusher',
  Troi: 'Deanna Troi',
  'La Forge': 'Geordi La Forge',
  Worf: 'Worf',
  Data: 'Data',
  OBrien: 'Miles O\'Brien',
  "O'Brien": 'Miles O\'Brien',
  Spock: 'Spock',
  Sisko: 'Benjamin Sisko',
  Kira: 'Kira Nerys',
  Dax: 'Jadzia Dax',
  Bashir: 'Julian Bashir',
  Odo: 'Odo',
  Quark: 'Quark',
  Janeway: 'Kathryn Janeway',
  Chakotay: 'Chakotay',
  Tuvok: 'Tuvok',
  Torres: 'B\'Elanna Torres',
  Paris: 'Tom Paris',
  Kim: 'Harry Kim',
  Neelix: 'Neelix',
  Kes: 'Kes',
});

const DESCRIPTION_OVERRIDES = Object.freeze({
  'star-trek-ds9-season-1': 'Draft season Loredeck for Deep Space Nine season 1, covering Sisko as Emissary, post-occupation Bajor, Cardassian pressure, the wormhole and Prophets, Odo, Dax, Ferengi station politics, Duet, and season-local spoiler guards.',
  'star-trek-voy-season-1': 'Draft season Loredeck for Voyager season 1, covering the Caretaker displacement, stranded Starfleet and Maquis crew integration, Kazon and Vidiian pressure, the Delta Quadrant survival baseline, Seska, and season-local spoiler guards.',
});

const SEASON_SPECS = Object.freeze({
  'star-trek-tng-season-4': {
    series: 'TNG',
    season: 4,
    year: '2367',
    familyOrder: 40,
    description: "Draft season Loredeck for the Borg aftermath, Picard recovery, Soong/Lore, Klingon succession, Cardassian first contact, Drumhead, Trill/Odan, Mind's Eye, and the Redemption cliffhanger.",
    entryFloor: 82,
    entryCeiling: 106,
    episodeFocus: TNG_S4_FOCUS,
    baselineCards: [
      {
        id: 'post-borg-enterprise-season-four-baseline',
        title: 'Season 4 starts from a repaired but changed Enterprise-D after the Borg crisis',
        fact: 'The Enterprise-D survives the Borg crisis, repairs at McKinley Station, and returns to exploration with the crew carrying visible Borg, family, and command consequences.',
        injection: 'Use TNG season 4 as a post-Borg recovery baseline. The ship is operational again, but Picard, Riker, Worf, and the wider Federation should not behave as if Wolf 359 never happened.',
        category: 'character',
        gateType: 'character_state',
        lorePurpose: 'behavior_constraint',
        characters: ['Jean-Luc Picard', 'William Riker', 'Worf', 'Beverly Crusher'],
        factions: ['Starfleet', 'Borg Collective'],
        topics: ['post-Borg baseline', 'Enterprise-D repair', 'season 4 crew'],
      },
      {
        id: 'picard-locutus-trauma-season-four',
        title: 'Picard carries Locutus trauma across season 4',
        fact: 'Picard is rescued from Borg assimilation, but Family makes clear the experience leaves anger, shame, and grief that he cannot simply command away.',
        injection: 'Write Picard after the Borg as functional but wounded. Do not treat his rescue as emotional reset, and do not import later film-era Borg revenge unless a later deck is active.',
        category: 'character',
        gateType: 'character_state',
        lorePurpose: 'behavior_constraint',
        characters: ['Jean-Luc Picard', 'Locutus', 'Robert Picard'],
        factions: ['Starfleet', 'Borg Collective'],
        topics: ['Locutus trauma', 'Picard recovery', 'Family'],
      },
      {
        id: 'worf-klingon-family-politics-season-four',
        title: 'Worf season 4 state is Starfleet duty under Klingon family pressure',
        fact: 'Worf begins the season still under discommendation pressure, gains explicit fatherhood through Alexander, and is pulled into the Gowron-Duras succession crisis.',
        injection: 'Use Worf as both Enterprise security chief and Klingon political actor. His Starfleet duty is real, but Klingon family and honor pressure can override it at Redemption.',
        category: 'character',
        gateType: 'character_state',
        lorePurpose: 'behavior_constraint',
        characters: ['Worf', 'Kurn', 'Alexander Rozhenko'],
        factions: ['Starfleet', 'Klingon Empire'],
        topics: ['Worf discommendation', 'Alexander', 'Klingon succession'],
      },
      {
        id: 'season-four-new-political-frontiers',
        title: 'Season 4 adds Cardassian, Malcorian, Kaelon, and Trill contact gates without DS9 outcomes',
        fact: 'The season expands the setting through Cardassian treaty tension, Malcorian first contact, Kaelon cultural law, and early Trill symbiont rules.',
        injection: 'Use these as TNG season 4 contact gates. Do not import later DS9-era political or species continuity unless those decks are loaded.',
        category: 'faction',
        gateType: 'knowledge_gate',
        lorePurpose: 'faction',
        characters: ['Jean-Luc Picard'],
        factions: ['Cardassian Union', 'Malcorians', 'Kaelons', 'Trill'],
        topics: ['Cardassians', 'first contact', 'Trill', 'Prime Directive'],
      },
      {
        id: 'season-four-romulan-klingon-pressure',
        title: 'Season 4 keeps Romulan manipulation tied to Klingon instability',
        fact: "Romulan pressure runs through The Mind's Eye and Redemption, where Klingon succession politics become vulnerable to covert outside support.",
        injection: 'Use Romulan involvement as covert political pressure until Redemption reveals Sela. Before that reveal, keep Sela identity guarded.',
        category: 'faction',
        gateType: 'knowledge_gate',
        lorePurpose: 'faction',
        characters: ['Sela', 'Worf', 'Gowron'],
        factions: ['Romulan Star Empire', 'Klingon Empire'],
        topics: ['Romulan manipulation', 'Duras family', 'Sela reveal'],
      },
      {
        id: 'season-four-later-series-guard',
        title: 'TNG season 4 should not import DS9, Voyager, film, or Picard-era material',
        fact: 'Season 4 has its own Borg, Cardassian, Trill, Klingon, Romulan, Data, and Picard family state before later shows and films change those subjects.',
        injection: 'Block DS9 war arcs, Maquis, Voyager, TNG film, and Picard-era material from this season unless another active deck supplies that later context.',
        category: 'secret',
        gateType: 'spoiler_guard',
        lorePurpose: 'knowledge_gate',
        characters: ['Jean-Luc Picard', 'Data', 'Worf'],
        factions: ['Starfleet', 'Borg Collective', 'Cardassian Union'],
        topics: ['future guard', 'DS9 spoiler', 'Voyager spoiler', 'film guard'],
      },
      {
        id: 'redemption-cliffhanger-season-boundary',
        title: 'Season 4 ends before Redemption resolves the Klingon civil-war crisis',
        fact: 'Redemption closes the season with the Klingon civil-war crisis active, Worf away from normal Starfleet duty, and Sela newly revealed.',
        injection: 'End TNG season 4 with the Redemption cliffhanger unresolved. Do not restore Worf or resolve Sela and the civil war until season 5 context is active.',
        category: 'secret',
        gateType: 'spoiler_guard',
        lorePurpose: 'knowledge_gate',
        characters: ['Worf', 'Sela', 'Gowron'],
        factions: ['Klingon Empire', 'Romulan Star Empire', 'Starfleet'],
        topics: ['Redemption cliffhanger', 'Klingon civil war', 'Sela'],
      },
    ],
  },
});

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tagId(prefix, label) {
  return `${prefix}:${slug(label)}`;
}

function titleCase(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function cleanDate(date) {
  return String(date || '').replace(/\[\[|\]\]/g, '').trim();
}

function cleanArc(value) {
  return String(value || '')
    .split('|')[0]
    .replace(/\}\}/g, '')
    .trim();
}

function parseDeckId(deckId) {
  const match = /^star-trek-(tng|ds9|voy)-season-(\d+)$/.exec(String(deckId || '').trim());
  if (!match) throw new Error(`Unsupported Star Trek season deck id: ${deckId}`);
  return {
    series: match[1].toUpperCase(),
    season: Number(match[2]),
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
}

function detectCharacters(record) {
  const haystack = `${record.title || ''} ${(record.keyEntities || []).join(' ')} ${(record.authoringSignals || []).join(' ')}`;
  const known = KNOWN_CHARACTER_NAMES.filter(name => new RegExp(`(^|[^A-Za-z])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z])`).test(haystack));
  const entityCandidates = (record.keyEntities || [])
    .filter(name => /^[A-Z][A-Za-z'-.]+(?:\s+[A-Z][A-Za-z'-.]+){0,2}$/.test(String(name || '')))
    .filter(name => !/^(Dr|Chief|Lt|Commander|Captain|Major|Admiral|Fleet Admiral|Enterprise|Federation|Starfleet|Romulan|Klingon|Cardassian|Bajoran|Ferengi|Vulcan|Borg|Data's|The|A|An)$/i.test(name))
    .filter(name => !/\b(?:system|cluster|sector|station|starbase|moon|planet|colony|bar|bridge|ship|class|field|nebula|shuttle|probe|weapon|program|computer|cavern|sun|continent|core|expanse|border|space|room|office|lounge|enterprise|ops|replimat|bird|birds|prey|iv|iii|ii|ix|vi|vii|viii)\b/i.test(name))
    .map(name => CHARACTER_ALIASES[name] || name)
    .slice(0, 5);
  return unique([...known, ...entityCandidates]).slice(0, 5);
}

function detectFactions(record, seriesConfig) {
  const haystack = `${record.title || ''} ${(record.keyEntities || []).join(' ')} ${(record.authoringSignals || []).join(' ')} ${record.arc || ''}`;
  const factions = ['Starfleet'];
  for (const [needle, faction] of FACTION_PATTERNS) {
    if (haystack.includes(needle)) factions.push(faction);
  }
  if (seriesConfig.slug === 'ds9') factions.push('Bajorans');
  if (seriesConfig.slug === 'voy') factions.push('USS Voyager crew');
  return unique(factions).slice(0, 6);
}

function buildTopics(record) {
  return unique([
    cleanArc(record.arc),
    ...(record.authoringSignals || []),
    ...(record.keyEntities || []).slice(0, 6),
    record.title,
  ]).slice(0, 8);
}

function buildGenericFocus(record, seriesConfig, spec) {
  const topics = buildTopics(record);
  const characters = detectCharacters(record);
  const factions = detectFactions(record, seriesConfig);
  const signalText = (record.authoringSignals || []).filter(Boolean).join('; ') || 'episode-local continuity';
  const firstTopic = topics[0] || record.title;
  return {
    characters: characters.length ? characters : [seriesConfig.label === 'VOY' ? 'Kathryn Janeway' : seriesConfig.label === 'DS9' ? 'Benjamin Sisko' : 'Jean-Luc Picard'],
    factions,
    topics,
    event: `${record.title} is a ${seriesConfig.label} season ${spec.season} story gate centered on ${firstTopic}; the evidence marks ${signalText}.`,
    state: `${record.title} constrains ${characters.slice(0, 3).join(', ') || 'the active cast'} around ${firstTopic} and the episode-local faction state.`,
    guard: `Keep ${record.title} facts inside ${seriesConfig.label} season ${spec.season}. Do not import later Star Trek outcomes unless another active Loredeck supplies that later Context.`,
  };
}

function buildGenericBaselineCards(spec, seriesConfig, records) {
  const firstTitle = records[0]?.title || `${seriesConfig.label} season ${spec.season}`;
  const arcs = unique(records.map(record => cleanArc(record.arc))).slice(0, 5);
  const signals = unique(records.flatMap(record => record.authoringSignals || [])).slice(0, 8);
  const signalText = signals.length ? signals.join(', ') : 'episode-local story gates';
  const arcText = arcs.length ? arcs.join(', ') : 'standalone episode gates';
  return [
    {
      id: `${seriesConfig.slug}-season-${spec.season}-baseline`,
      title: `${seriesConfig.label} season ${spec.season} has its own active cast and story baseline`,
      fact: `${seriesConfig.title} season ${spec.season} covers Memory Alpha story rows 1-${records.length}, anchored by ${arcText}.`,
      injection: `Use ${seriesConfig.label} season ${spec.season} as the active Star Trek context when those episode windows are selected. Do not substitute prior or later season status unless another active deck supplies it.`,
      category: 'character',
      gateType: 'character_state',
      lorePurpose: 'behavior_constraint',
      episodeTitle: firstTitle,
      characters: detectCharacters(records[0] || {}),
      factions: [seriesConfig.label === 'VOY' ? 'USS Voyager crew' : 'Starfleet'],
      topics: ['season baseline', ...arcs],
    },
    {
      id: `${seriesConfig.slug}-season-${spec.season}-major-arcs`,
      title: `${seriesConfig.label} season ${spec.season} major arcs stay season-local`,
      fact: `The season evidence highlights ${signalText}, with arcs and one-off episodes bounded by their Memory Alpha story rows.`,
      injection: `Treat season ${spec.season} arcs as Context-gated story state, not a license to import the final outcomes of later Star Trek episodes or series.`,
      category: 'event',
      gateType: 'anchor_window',
      lorePurpose: 'event_moment',
      episodeTitle: firstTitle,
      characters: detectCharacters(records[0] || {}),
      factions: [seriesConfig.label === 'VOY' ? 'USS Voyager crew' : 'Starfleet'],
      topics: ['major arcs', ...signals],
    },
    {
      id: `${seriesConfig.slug}-season-${spec.season}-faction-boundary`,
      title: `${seriesConfig.label} season ${spec.season} faction state should follow the loaded episode window`,
      fact: `Faction status in this deck comes from season ${spec.season} evidence rows and should not be flattened into all-era Star Trek politics.`,
      injection: `Use the currently active episode anchor before injecting faction status, especially for Klingon, Romulan, Cardassian, Bajoran, Borg, Dominion, Maquis, or Delta Quadrant material.`,
      category: 'faction',
      gateType: 'knowledge_gate',
      lorePurpose: 'faction',
      episodeTitle: firstTitle,
      characters: [],
      factions: [seriesConfig.label === 'VOY' ? 'USS Voyager crew' : 'Starfleet'],
      topics: ['faction boundary', ...signals],
    },
    {
      id: `${seriesConfig.slug}-season-${spec.season}-technology-and-anomaly-boundary`,
      title: `${seriesConfig.label} season ${spec.season} technology and anomaly facts are episode-bounded`,
      fact: `Season ${spec.season} includes technology, anomaly, medical, legal, and cultural constraints that are often local to one episode.`,
      injection: `Do not generalize an episode anomaly or technology into routine Starfleet capability unless a later active Loredeck explicitly broadens it.`,
      category: 'rule',
      gateType: 'lore_gate',
      lorePurpose: 'rule',
      episodeTitle: firstTitle,
      characters: [],
      factions: [seriesConfig.label === 'VOY' ? 'USS Voyager crew' : 'Starfleet'],
      topics: ['technology boundary', 'anomaly boundary', ...signals],
    },
    {
      id: `${seriesConfig.slug}-season-${spec.season}-future-guard`,
      title: `${seriesConfig.label} season ${spec.season} should not import later Star Trek outcomes`,
      fact: `This deck is a season-local draft reference for ${seriesConfig.title} season ${spec.season}, not an all-era Star Trek encyclopedia.`,
      injection: `Block later season, film, Picard-era, beta-canon, novel, comic, game, and fanon outcomes unless another active deck supplies that later Context.`,
      category: 'secret',
      gateType: 'spoiler_guard',
      lorePurpose: 'knowledge_gate',
      episodeTitle: firstTitle,
      characters: [],
      factions: [seriesConfig.label === 'VOY' ? 'USS Voyager crew' : 'Starfleet'],
      topics: ['future guard', 'spoiler guard'],
    },
  ];
}

function buildDefaultSpec(deckId, records) {
  const parsed = parseDeckId(deckId);
  const seriesConfig = SERIES[parsed.series];
  if (!seriesConfig) throw new Error(`Unknown Star Trek series ${parsed.series}.`);
  const years = unique(records.flatMap(record => record.years || []));
  const arcs = unique(records.map(record => cleanArc(record.arc))).slice(0, 5);
  const signals = unique(records.flatMap(record => record.authoringSignals || [])).slice(0, 5);
  const season = parsed.season;
  const spec = {
    series: parsed.series,
    season,
    year: years[0] || '',
    familyOrder: parsed.series === 'TNG' ? season * 10 : parsed.series === 'DS9' ? 100 + (season * 10) : 200 + (season * 10),
    description: DESCRIPTION_OVERRIDES[deckId] || `Draft season Loredeck for ${seriesConfig.title} season ${season}, covering ${arcs.length >= 3 ? arcs.join(', ') : signals.join(', ') || arcs.join(', ') || 'Memory Alpha episode evidence'} with season-local spoiler guards.`,
    entryFloor: records.length >= 20 ? 60 : 50,
    entryCeiling: 120,
    episodeFocus: {},
  };
  spec.baselineCards = buildGenericBaselineCards(spec, seriesConfig, records);
  return spec;
}

function seasonTag(spec, seriesConfig) {
  return `${seriesConfig.slug}-s${spec.season}`;
}

function baseTags(spec, seriesConfig) {
  return [
    'fandom:star-trek',
    'continuity:star-trek-prime',
    `series:${seriesConfig.slug}`,
    `season:${seasonTag(spec, seriesConfig)}`,
    'structure:season-split-loredeck',
    'quality:draft-reference',
  ];
}

function runtimeEpisodesFor(index) {
  return [index];
}

function buildAnchors(records, spec, seriesConfig, tags) {
  return records.map(record => {
    const titleSlug = slug(record.title);
    const sortKey = seriesConfig.sortBase + (spec.season * 1000) + ((record.memoryAlphaStoryEpisode - 1) * 20);
    const runtimeEpisodes = runtimeEpisodesFor(record.memoryAlphaStoryEpisode);
    const storyNumber = String(record.memoryAlphaStoryEpisode).padStart(2, '0');
    const aliases = new Set([
      record.title,
      `${seriesConfig.label} season ${spec.season} ${record.title}`,
      `${seriesConfig.label} S${spec.season} ${record.title}`,
      `${seriesConfig.label} ${spec.season}x${storyNumber} story`,
      `${seriesConfig.label} S${String(spec.season).padStart(2, '0')} story ${storyNumber}`,
    ]);
    for (const runtimeEpisode of runtimeEpisodes) {
      const runtimeNumber = String(runtimeEpisode).padStart(2, '0');
      aliases.add(`${seriesConfig.label} ${spec.season}x${runtimeNumber}`);
      aliases.add(`${seriesConfig.label} S${String(spec.season).padStart(2, '0')}E${runtimeNumber}`);
      aliases.add(`${seriesConfig.label} season ${spec.season} episode ${runtimeEpisode}`);
    }
    return {
      id: `${seriesConfig.slug}.s${spec.season}.e${storyNumber}.${titleSlug}`,
      label: record.title,
      contextType: 'story_anchor',
      sortKey,
      stardate: cleanDate(record.date),
      year: spec.year,
      series: seriesConfig.label,
      season: spec.season,
      storyEpisode: record.memoryAlphaStoryEpisode,
      runtimeEpisodes,
      episode: runtimeEpisodes.join(', '),
      aliases: [...aliases],
      tags: [...tags, tagId('episode', `${seasonTag(spec, seriesConfig)}-${titleSlug}`)],
      sourceInfo: {
        work: seriesConfig.title,
        sourceType: 'episode',
        title: record.title,
        series: seriesConfig.label,
        season: spec.season,
        storyEpisode: record.memoryAlphaStoryEpisode,
        runtimeEpisodes,
        memoryAlphaUrl: record.url,
        stardate: cleanDate(record.date),
        evidenceArtifact: 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json',
      },
    };
  });
}

function splitFile(prefix, season, suffix, storyEpisode) {
  return `${prefix}/season-${season}-${suffix}-${storyEpisode <= 13 ? 'a' : 'b'}.json`;
}

function buildCards(records, spec, seriesConfig) {
  const baseline = (spec.baselineCards || []).map(card => ({
    ...card,
    file: `crew/season-${spec.season}-baseline-and-season-guards.json`,
    episodeTitle: records[0]?.title || '',
    wide: true,
  }));
  const episodeCards = [];
  for (const record of records) {
    const focus = spec.episodeFocus?.[record.title] || buildGenericFocus(record, seriesConfig, spec);
    const signalText = (record.authoringSignals || []).filter(Boolean).join('; ');
    const topics = [...new Set([...(focus.topics || []), ...(record.authoringSignals || []).slice(0, 2), cleanArc(record.arc)].filter(Boolean))];
    const characters = focus.characters || (record.keyEntities || []).slice(0, 3);
    const factions = focus.factions || ['Starfleet'];
    const event = focus.event || `${record.title} supplies a season ${spec.season} Context gate for ${signalText || 'the episode-local plot'} using Memory Alpha story row ${record.memoryAlphaStoryEpisode}.`;
    const state = focus.state || `${record.title} constrains ${characters.slice(0, 2).join(' and ') || 'the active cast'} around ${topics[0] || 'episode-local continuity'}.`;
    const guard = focus.guard || `Keep ${record.title} facts inside the season ${spec.season} episode window and do not import later continuity unless another active deck supplies it.`;
    episodeCards.push({
      file: splitFile('episodes', spec.season, 'episode-gates', record.memoryAlphaStoryEpisode),
      id: `${slug(record.title)}-episode-gate`,
      title: `${record.title} anchors ${topics[0] || 'season continuity'}`,
      fact: `${record.title} (${cleanDate(record.date) || 'stardate unknown'}) is Memory Alpha story row ${record.memoryAlphaStoryEpisode} for this season. ${event}`,
      injection: `Use ${record.title} as the active episode Context gate when scenes reference ${topics.slice(0, 3).join(', ') || 'this story beat'}.`,
      category: 'event',
      gateType: 'anchor_window',
      lorePurpose: 'event_moment',
      episodeTitle: record.title,
      characters,
      factions,
      topics,
    });
    episodeCards.push({
      file: splitFile('crew', spec.season, 'character-and-faction-states', record.memoryAlphaStoryEpisode),
      id: `${slug(record.title)}-state-gate`,
      title: `${record.title} state gate for ${characters[0] || factions[0] || 'the crew'}`,
      fact: state,
      injection: `Inside ${record.title}, write ${characters.slice(0, 3).join(', ') || 'the involved characters'} with this season-local state and avoid replacing it with later outcomes.`,
      category: factions.length > 1 && characters.length < 2 ? 'faction' : 'character',
      gateType: factions.length > 1 && characters.length < 2 ? 'knowledge_gate' : 'character_state',
      lorePurpose: factions.length > 1 && characters.length < 2 ? 'faction' : 'character_snapshot',
      episodeTitle: record.title,
      characters,
      factions,
      topics,
    });
    episodeCards.push({
      file: splitFile('secrets', spec.season, 'reveal-and-future-guards', record.memoryAlphaStoryEpisode),
      id: `${slug(record.title)}-continuity-guard`,
      title: `${record.title} boundary: ${topics[1] || topics[0] || 'season-local continuity'}`,
      fact: guard,
      injection: `Before injecting ${record.title} material, preserve this boundary: ${guard}`,
      category: 'secret',
      gateType: 'spoiler_guard',
      lorePurpose: 'knowledge_gate',
      episodeTitle: record.title,
      characters,
      factions,
      topics: [...topics, 'continuity guard'],
    });
    if (records.length < 18) {
      episodeCards.push({
        file: splitFile('rules', spec.season, 'short-season-context-rules', record.memoryAlphaStoryEpisode),
        id: `${slug(record.title)}-short-season-context-rule`,
        title: `${record.title} context rule: ${topics[0] || 'episode-local survival'}`,
        fact: `${record.title} adds a compact but important season ${spec.season} rule or survival constraint around ${topics.slice(0, 3).join(', ') || 'the active episode premise'}.`,
        injection: `For short-season coverage, keep ${record.title} available as a distinct rule/context gate rather than collapsing it into a broad season summary.`,
        category: 'rule',
        gateType: 'lore_gate',
        lorePurpose: 'rule',
        episodeTitle: record.title,
        characters,
        factions,
        topics: [...topics, 'short season context'],
      });
    }
  }
  return [...baseline, ...episodeCards];
}

function contextFor(card, episodeMap, anchors, spec, seriesConfig) {
  const start = episodeMap.get(card.episodeTitle) || anchors[0];
  const explicitTo = card.validToEpisode ? episodeMap.get(card.validToEpisode) : null;
  const next = anchors[anchors.findIndex(anchor => anchor.id === start.id) + 1] || null;
  const fromAnchor = card.validFromEpisode ? episodeMap.get(card.validFromEpisode) || start : start;
  const toAnchor = explicitTo || (card.wide ? anchors[anchors.length - 1] : next || anchors[anchors.length - 1]);
  return {
    scope: 'window',
    validFromAnchor: fromAnchor.id,
    validToAnchor: toAnchor.id,
    series: seriesConfig.label,
    season: String(spec.season),
    storyEpisode: start.storyEpisode,
    runtimeEpisodes: start.runtimeEpisodes,
    sortKeyFrom: fromAnchor.sortKey,
    sortKeyTo: toAnchor.sortKey,
    precision: card.wide ? 'season_window' : 'episode_window',
    windowKind: card.wide ? 'season' : 'bounded',
    label: card.wide ? `${seriesConfig.label} season ${spec.season}` : `${seriesConfig.label} season ${spec.season}: ${start.label}`,
    approximate: false,
  };
}

function buildEntry(card, index, episodeMap, anchors, spec, seriesConfig, tags, deckId) {
  const anchor = episodeMap.get(card.episodeTitle) || anchors[0];
  const characterTags = (card.characters || []).map(name => tagId('character', name));
  const factionTags = (card.factions || []).map(name => tagId('faction', name));
  const topicTags = (card.topics || []).map(name => tagId('topic', name));
  const episodeTag = tagId('episode', `${seasonTag(spec, seriesConfig)}-${slug(anchor.label)}`);
  return {
    schemaVersion: ENTRY_SCHEMA_VERSION,
    id: `st_${seriesConfig.slug}_s${spec.season}_${card.id}`,
    title: card.title,
    kind: card.gateType,
    gateType: card.gateType,
    category: card.category,
    relevance: card.category === 'secret' || card.category === 'event' ? 'high' : 'normal',
    lorePurpose: card.lorePurpose,
    specificityScore: card.wide ? 78 : 84,
    injectableByDefault: true,
    canon: 'canon',
    canonStatus: 'canon',
    truthStatus: card.category === 'secret' ? 'hidden' : 'true',
    revealPolicy: card.category === 'secret' ? 'spoiler_guard' : 'contextual',
    priority: Math.max(45, 95 - index),
    status: 'active',
    protected: false,
    locked: true,
    userEditable: true,
    context: contextFor(card, episodeMap, anchors, spec, seriesConfig),
    coordinates: [
      { axis: 'series', id: seriesConfig.slug, label: seriesConfig.title, required: false },
      { axis: 'season', id: seasonTag(spec, seriesConfig), label: `${seriesConfig.label} season ${spec.season}`, required: false },
      { axis: 'episode', id: anchor.id, label: anchor.label, required: false },
    ],
    scope: {
      entityIds: [...(card.characters || []).map(name => `st:${slug(name)}`), ...(card.factions || []).map(name => `st:${slug(name)}`)],
      characters: card.characters || [],
      locations: [],
      objects: [],
      factions: card.factions || [],
      topics: card.topics || [],
    },
    tags: [...new Set([...tags, episodeTag, ...characterTags, ...factionTags, ...topicTags])],
    retrieval: {
      activation: 'topic_or_entity',
      frequency: card.wide ? 'low' : 'normal',
      contextBoost: card.wide ? 'low' : 'medium',
      triggers: {
        charactersAny: card.characters || [],
        factionsAny: card.factions || [],
        entitiesAny: [...(card.characters || []), ...(card.factions || [])],
        topicsAny: card.topics || [],
        keywordsAny: [...new Set([...(card.characters || []), ...(card.factions || []), ...(card.topics || []), anchor.label, `${seriesConfig.label} season ${spec.season}`])],
      },
    },
    continuity: {
      continuityId: 'star-trek-prime',
      canonTier: 'primary',
      adaptation: 'television',
      medium: 'television',
      variantOf: 'star-trek-prime',
      sourceBoundary: `${seriesConfig.title} season ${spec.season}, Memory Alpha story rows 1-${anchors.length}, runtime episode aliases 1-${anchors.length}, primary on-screen Prime continuity.`,
      notes: 'Draft reference deck. Excludes later Star Trek seasons, films, Picard-era material, beta canon, and fanon unless a card is an explicit future guard.',
    },
    content: {
      fact: card.fact,
      injection: card.injection,
      constraints: [
        `Keep this card inside ${seriesConfig.label} season ${spec.season} unless another active Star Trek deck provides a later Context window.`,
        'Use the episode and season Context gates before injecting this fact.',
      ],
      antiLore: [
        'Do not copy Memory Alpha prose or substitute a plot recap for this gate.',
        `Do not import later Star Trek, film, Picard-era, beta-canon, novel, comic, game, or fanon facts into this season ${spec.season} card.`,
      ],
      notes: '',
    },
    sourceInfo: {
      work: seriesConfig.title,
      sourceType: 'episode',
      title: anchor.label,
      series: seriesConfig.label,
      season: spec.season,
      storyEpisode: anchor.storyEpisode,
      runtimeEpisodes: anchor.runtimeEpisodes,
      memoryAlphaUrl: anchor.sourceInfo.memoryAlphaUrl,
      stardate: anchor.stardate,
      evidenceArtifact: 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json',
      confidence: 0.74,
      notes: 'Drafted from Saga Star Trek authoring plan and Memory Alpha evidence index; needs human canon spot check before reference-quality release.',
    },
    extensions: {
      sagaStarTrekDraft: {
        targetPackId: deckId,
        plan: 'docs/loredecks/STAR_TREK_TNG_DS9_VOY_AUTHORING_PLAN.md',
        generatedAt: '2026-06-17',
      },
    },
  };
}

function collectTags(entries, anchors, tags, spec, seriesConfig) {
  const registry = new Set(tags);
  for (const anchor of anchors) for (const tag of anchor.tags || []) registry.add(tag);
  for (const entry of entries) for (const tag of entry.tags || []) registry.add(tag);
  return Object.fromEntries([...registry].sort().map(tag => [tag, {
    label: titleCase(tag.split(':')[1] || tag),
    color: '#3f5666',
    textColor: '#ffffff',
    description: `${titleCase(tag)} tag for Star Trek ${seriesConfig.label} season ${spec.season} retrieval and filtering.`,
    aliases: [],
    parents: [],
    sensitive: tag.startsWith('secret:') || tag.includes('spoiler'),
    deprecated: false,
    replacement: '',
  }]));
}

function collectEntities(entries, spec, seriesConfig) {
  const entities = new Map();
  for (const entry of entries) {
    for (const name of entry.scope.characters || []) entities.set(`st:${slug(name)}`, {
      type: 'character',
      label: name,
      aliases: [name],
      canonicalNames: [name],
      tags: [tagId('character', name)],
    });
    for (const name of entry.scope.factions || []) entities.set(`st:${slug(name)}`, {
      type: 'faction',
      label: name,
      aliases: [name],
      canonicalNames: [name],
      tags: [tagId('faction', name)],
    });
  }
  return Object.fromEntries([...entities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, entity]) => [id, {
    ...entity,
    relationships: [],
    continuity: {
      continuityId: 'star-trek-prime',
      canonTier: 'primary',
      adaptation: 'television',
      medium: 'television',
      sourceBoundary: `${seriesConfig.title} season ${spec.season}.`,
    },
    sourceInfo: {
      work: seriesConfig.title,
      confidence: 0.74,
    },
    extensions: {},
  }]));
}

function categoryCounts(entries) {
  const counts = {};
  for (const entry of entries) counts[entry.category] = (counts[entry.category] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function groupedEntries(entries, cards) {
  const groups = new Map();
  for (const [index, entry] of entries.entries()) {
    const file = cards[index].file;
    if (!groups.has(file)) groups.set(file, []);
    groups.get(file).push(entry);
  }
  return groups;
}

function coverAssetsForTitle(title) {
  return {
    cover: {
      path: COVER_ASSET_PATH,
      alt: `${title} Loredeck cover`,
      aspect: '1:1',
      focalPoint: { x: 0.5, y: 0.5 },
    },
  };
}

async function readPreservedCover(deckRoot) {
  try {
    return await fs.readFile(path.join(deckRoot, COVER_ASSET_PATH));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(deckRoot, relativePath, value) {
  const file = path.join(deckRoot, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function updateIndex(deckId, manifest, tagCount, entityCount) {
  const indexPath = path.join(ROOT, 'content/loredecks/index.json');
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  const record = {
    packId: deckId,
    manifest: `${deckId}/loredeck.json`,
    type: 'bundled',
    title: manifest.title,
    description: manifest.description,
    library: manifest.library,
    entrySchemaVersion: ENTRY_SCHEMA_VERSION,
    version: manifest.version,
    author: 'Saga',
    fandom: 'Star Trek',
    era: manifest.era,
    tags: manifest.tags,
    updatedAt: UPDATED_AT,
    stats: {
      ...manifest.stats,
      tagCount,
      entityCount,
    },
  };
  if (manifest.assets && typeof manifest.assets === 'object') record.assets = manifest.assets;
  index.bundled = Array.isArray(index.bundled) ? index.bundled.filter(item => item.packId !== deckId) : [];
  index.bundled.push(record);
  index.bundled.sort((left, right) => String(left.packId).localeCompare(String(right.packId)));
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

function buildTimeline(anchors, spec, seriesConfig, tags) {
  const windows = [
    {
      id: `${seriesConfig.slug}.s${spec.season}.full-season`,
      label: `${seriesConfig.label} season ${spec.season} full window`,
      anchorFrom: anchors[0].id,
      anchorTo: anchors[anchors.length - 1].id,
      sortKeyFrom: anchors[0].sortKey,
      sortKeyTo: anchors[anchors.length - 1].sortKey,
      aliases: [`${seriesConfig.label} season ${spec.season}`, `${seriesConfig.title} season ${spec.season}`, `${seriesConfig.label} S${spec.season}`],
      tags,
    },
    ...anchors.slice(0, -1).map((anchor, index) => ({
      id: `${anchor.id}.window`,
      label: `${anchor.label} episode window`,
      anchorFrom: anchor.id,
      anchorTo: anchors[index + 1].id,
      sortKeyFrom: anchor.sortKey,
      sortKeyTo: anchors[index + 1].sortKey,
      aliases: [`during ${anchor.label}`, `after ${anchor.label}`],
      tags: anchor.tags,
    })),
  ];
  return {
    schemaVersion: 1,
    timelineMode: 'hybrid',
    defaultContextType: 'story_anchor',
    sortKeyScale: 'star_trek_24th_century',
    summary: `${seriesConfig.title} season ${spec.season} Context anchors and episode windows.`,
    axes: [
      { id: 'series', type: 'series', label: 'Series' },
      { id: 'season', type: 'season', label: 'Season' },
      { id: 'episode', type: 'episode', label: 'Episode' },
      { id: 'stardate', type: 'date', label: 'Stardate' },
    ],
    anchors,
    windows,
  };
}

function buildResolver(anchors, spec, seriesConfig) {
  return {
    schemaVersion: 1,
    summary: `Resolve ${seriesConfig.title} season ${spec.season} Context from episode titles, story rows, runtime aliases, and common ${seriesConfig.label} S${spec.season} labels.`,
    preferredFields: ['series', 'season', 'episode', 'stardate', 'beforeAfter', 'majorEvent'],
    ambiguousFallback: 'use_window',
    promptAddendum: `Prefer ${seriesConfig.label} season ${spec.season} anchors and before/after windows. Do not infer later Star Trek events unless their Loredecks are loaded.`,
    localPatterns: anchors.flatMap(anchor => anchor.aliases.map(alias => ({
      pattern: alias.toLowerCase(),
      result: {
        anchorFrom: anchor.id,
        label: anchor.label,
      },
    }))),
    modelOutputShape: {
      contextType: 'string',
      sceneDate: 'string',
      anchorId: 'string',
      anchorFrom: 'string',
      anchorTo: 'string',
      label: 'string',
      branchId: 'string',
      confidence: 'number',
      summary: 'string',
    },
  };
}

function buildManifest(deckId, spec, seriesConfig, tags, files, entries, anchors, windows, tagCount, entityCount, assets = null) {
  const manifest = {
    schemaVersion: 1,
    id: deckId,
    type: 'bundled',
    title: `${seriesConfig.shortTitle} Season ${spec.season}`,
    description: spec.description,
    fandom: 'Star Trek',
    era: `${seriesConfig.title.replace(/^Star Trek: /, '')} Season ${spec.season}`,
    contentKind: 'fandom',
    author: 'Saga',
    version: '0.1.0-dev',
    defaultLocale: 'en',
    generatedAt: '2026-06-17',
    databaseId: `saga.${deckId}`,
    deckFamilyId: 'star-trek-tng-ds9-voy-seasons',
    family: {
      id: 'star-trek-tng-ds9-voy-seasons',
      title: 'Star Trek: TNG, DS9, and Voyager',
      role: 'season',
    },
    recommendedStack: [deckId],
    library: {
      suggestedPath: seriesConfig.libraryPath,
      familyOrder: spec.familyOrder,
    },
    tags,
    source: {
      kind: 'bundled',
      url: 'https://memory-alpha.fandom.com/wiki/Portal:Main',
    },
    update: {
      checkForUpdates: false,
      url: '',
      lastCheckedAt: 0,
    },
    continuity: {
      continuityId: 'star-trek-prime',
      canonTier: 'primary',
      adaptation: 'television',
      medium: 'television',
      variantOf: 'star-trek-prime',
      sourceBoundary: `${seriesConfig.title} season ${spec.season}, Memory Alpha story rows 1-${anchors.length}, runtime episode aliases 1-${anchors.length}, primary on-screen Prime continuity. Excludes later Star Trek seasons, films, Picard-era material, beta canon, novels, comics, games, deleted scenes, production trivia, and fanon.`,
    },
    runtimeDefaults: {
      scanDepth: null,
      recursiveTriggers: false,
      tokenBudget: null,
    },
    registries: {
      taxonomy: 'taxonomy.json',
      tags: 'tags.json',
      entities: 'entities.json',
      timeline: 'timeline.json',
      gateTypes: 'gate-types.json',
      scoring: 'scoring.json',
    },
    resolver: 'resolver.json',
    files,
    compatibility: {
      sagaSchemaMin: ENTRY_SCHEMA_VERSION,
      sagaSchemaMax: ENTRY_SCHEMA_VERSION,
    },
    stats: {
      entryCount: entries.length,
      categoryCounts: categoryCounts(entries),
      timelineAnchorCount: anchors.length,
      timelineWindowCount: windows.length,
      tagCount,
      entityCount,
    },
    license: {
      name: 'Draft fan reference data',
      notes: 'For local testing. Requires human canon review before reference release.',
    },
    health: {
      status: 'needs_review',
      notes: `First-pass Star Trek ${seriesConfig.label} season ${spec.season} Loredeck generated from Saga authoring plan and Memory Alpha evidence artifacts.`,
    },
    entrySchemaVersion: ENTRY_SCHEMA_VERSION,
    updatedAt: UPDATED_AT,
  };
  if (assets && typeof assets === 'object') manifest.assets = assets;
  return manifest;
}

async function generateDeck(deckId) {
  const deckRoot = path.join(ROOT, `content/loredecks/${deckId}`);
  const expectedRoot = path.resolve(ROOT, `content/loredecks/${deckId}`);
  const resolvedRoot = path.resolve(ROOT);
  if (path.resolve(deckRoot) !== expectedRoot || !expectedRoot.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to regenerate unexpected deck path: ${deckRoot}`);
  }

  const preservedCover = await readPreservedCover(deckRoot);
  const evidence = JSON.parse(await fs.readFile(EVIDENCE_PATH, 'utf8'));
  const records = evidence.episodes.filter(episode => episode.deckId === deckId);
  if (!records.length) throw new Error(`No Memory Alpha evidence rows found for ${deckId}.`);
  const spec = SEASON_SPECS[deckId] || buildDefaultSpec(deckId, records);
  const seriesConfig = SERIES[spec.series];
  if (!seriesConfig) throw new Error(`Unknown Star Trek series ${spec.series}.`);

  const tags = baseTags(spec, seriesConfig);
  const anchors = buildAnchors(records, spec, seriesConfig, tags);
  const episodeMap = new Map(anchors.map(anchor => [anchor.label, anchor]));
  const cards = buildCards(records, spec, seriesConfig);
  const entries = cards.map((card, index) => buildEntry(card, index, episodeMap, anchors, spec, seriesConfig, tags, deckId));
  if (entries.length < spec.entryFloor || entries.length > spec.entryCeiling) {
    throw new Error(`${deckId} generated ${entries.length} entries, outside expected ${spec.entryFloor}-${spec.entryCeiling}.`);
  }
  const groups = groupedEntries(entries, cards);
  for (const [file, group] of groups.entries()) {
    if (group.length > 22) throw new Error(`${deckId}/${file} has ${group.length} entries; split it before writing.`);
  }
  const files = [...groups.keys()];
  const tagRegistry = collectTags(entries, anchors, tags, spec, seriesConfig);
  const entities = collectEntities(entries, spec, seriesConfig);
  const timeline = buildTimeline(anchors, spec, seriesConfig, tags);
  const resolver = buildResolver(anchors, spec, seriesConfig);
  const assets = preservedCover ? coverAssetsForTitle(`${seriesConfig.shortTitle} Season ${spec.season}`) : null;
  const manifest = buildManifest(deckId, spec, seriesConfig, tags, files, entries, anchors, timeline.windows, Object.keys(tagRegistry).length, Object.keys(entities).length, assets);

  await fs.rm(deckRoot, { recursive: true, force: true });
  await fs.mkdir(deckRoot, { recursive: true });
  if (preservedCover) {
    await fs.mkdir(path.dirname(path.join(deckRoot, COVER_ASSET_PATH)), { recursive: true });
    await fs.writeFile(path.join(deckRoot, COVER_ASSET_PATH), preservedCover);
  }
  await writeJson(deckRoot, 'loredeck.json', manifest);
  await writeJson(deckRoot, 'manifest.json', manifest);
  await writeJson(deckRoot, 'timeline.json', timeline);
  await writeJson(deckRoot, 'resolver.json', resolver);
  await writeJson(deckRoot, 'tags.json', { schemaVersion: 1, tags: tagRegistry });
  await writeJson(deckRoot, 'entities.json', { schemaVersion: 1, entities });
  await writeJson(deckRoot, 'taxonomy.json', {
    schemaVersion: 1,
    categories: {
      character: { label: 'Character', color: '#315c35', description: 'Character identity, role, behavior, or season-local status.' },
      event: { label: 'Event', color: '#8e5a2a', description: 'Episode event or durable story-state change.' },
      faction: { label: 'Faction', color: '#6f3c7a', description: 'Crew, polity, organization, or diplomatic state.' },
      knowledge: { label: 'Knowledge', color: '#59636f', description: 'Who knows, hides, or misunderstands season-local information.' },
      relationship: { label: 'Relationship', color: '#b04a7a', description: 'Social bond, trust state, obligation, or grief state.' },
      rule: { label: 'Rule', color: '#2e86c1', description: 'Technology, command, legal, cultural, or anomaly constraint.' },
      secret: { label: 'Secret', color: '#922b21', description: 'Hidden identity, reveal timing, spoiler guard, or unresolved truth.' },
      other: { label: 'Other', color: '#5d6d7e', description: 'Other Saga-compatible lore.' },
    },
  });
  await writeJson(deckRoot, 'gate-types.json', {
    schemaVersion: 1,
    gateTypes: {
      anchor_window: { label: 'Anchor Window', description: 'Lorecard is eligible inside a bounded episode or story window.' },
      character_state: { label: 'Character State', description: 'Lorecard constrains season-local character behavior or status.' },
      knowledge_gate: { label: 'Knowledge Gate', description: 'Lorecard controls what is known, hidden, or misunderstood in Context.' },
      lore_gate: { label: 'Lore Gate', description: 'Lorecard defines a durable setting, technology, faction, or command rule.' },
      reveal_gate: { label: 'Reveal Gate', description: 'Lorecard becomes eligible only after a season-local reveal.' },
      relationship_state: { label: 'Relationship State', description: 'Lorecard constrains a bond, obligation, grief state, or trust state.' },
      spoiler_guard: { label: 'Spoiler Guard', description: 'Lorecard prevents later canon from leaking backward.' },
    },
  });
  await writeJson(deckRoot, 'scoring.json', {
    schemaVersion: 1,
    scoringProfiles: {
      default: {
        label: `Star Trek ${seriesConfig.label} Season Default`,
        contextBoost: 'medium',
        retrievalBias: 'topic_or_entity',
        notes: 'Prefer specific episode, character, faction, and technology topics over broad Star Trek keywords.',
      },
    },
  });

  for (const [file, group] of groups) {
    await writeJson(deckRoot, file, {
      schemaVersion: ENTRY_SCHEMA_VERSION,
      entries: group,
    });
  }
  await updateIndex(deckId, manifest, Object.keys(tagRegistry).length, Object.keys(entities).length);
  return {
    deckId,
    entries: entries.length,
    files: files.length,
    anchors: anchors.length,
    windows: timeline.windows.length,
    tags: Object.keys(tagRegistry).length,
    entities: Object.keys(entities).length,
  };
}

const deckIds = process.argv.slice(2);
if (!deckIds.length) {
  console.error(`Usage: node ${path.relative(ROOT, import.meta.filename || 'tools/scripts/generate-star-trek-season-loredeck.mjs')} <deckId> [...]`);
  process.exit(1);
}

const results = [];
for (const deckId of deckIds) results.push(await generateDeck(deckId));
console.log(JSON.stringify(results, null, 2));
