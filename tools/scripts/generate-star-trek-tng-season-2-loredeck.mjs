import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const EVIDENCE_PATH = path.join(ROOT, 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json');
const DECK_ROOT = path.join(ROOT, 'content/loredecks/star-trek-tng-season-2');
const DECK_ID = 'star-trek-tng-season-2';
const UPDATED_AT = 1781740800000;

const BASE_TAGS = [
  'fandom:star-trek',
  'continuity:star-trek-prime',
  'series:tng',
  'season:tng-s2',
  'structure:season-split-loredeck',
  'quality:draft-reference',
];

const EPISODE_FILE = 'episodes/season-2-episode-gates.json';
const CREW_FILE = 'crew/pulaski-guinan-and-crew-state.json';
const FACTION_FILE = 'factions/q-borg-klingons-romulans-ferengi.json';
const TECH_FILE = 'rules/holodeck-data-and-starfleet-law.json';
const SECRET_FILE = 'secrets/reveal-and-future-guards.json';

const CARD_BLUEPRINTS = [
  c(CREW_FILE, 'pulaski-replaces-crusher-season-two', 'Pulaski is the Enterprise-D chief medical officer for season 2', 'Season 2 uses Katherine Pulaski as chief medical officer while Beverly Crusher is away from the Enterprise-D, so Crusher should not be written as the active ship doctor in ordinary season 2 scenes.', 'Write Pulaski as the season 2 chief medical officer: blunt, experienced, medically confident, and not Beverly Crusher. Do not import Crusher as active CMO until the season 3 return window.', 'character', 'character_state', 'behavior_constraint', 'The Child', ['Katherine Pulaski', 'Beverly Crusher'], ['Starfleet'], ['Pulaski chief medical officer', 'Crusher absent', 'season 2 crew']),
  c(CREW_FILE, 'guinan-ten-forward-baseline', 'Guinan and Ten Forward become active Enterprise-D social infrastructure', 'Season 2 introduces Guinan as Ten Forward bartender and informal listener, giving the crew a non-command social space for counsel, morale, and guarded insight.', 'Use Guinan as a calm, perceptive Ten Forward presence in season 2. She can offer oblique counsel and read people well, but do not import later El-Aurian or Nexus details.', 'character', 'character_state', 'behavior_constraint', 'The Child', ['Guinan'], ['Starfleet'], ['Guinan', 'Ten Forward', 'Enterprise-D social baseline'], { wide: true }),
  c(CREW_FILE, 'geordi-chief-engineer-season-two', 'Geordi is chief engineer by season 2', 'Season 2 establishes Geordi La Forge in the chief engineer role, moving him out of the season 1 conn-officer baseline.', 'Write Geordi in season 2 as the Enterprise-D chief engineer: technically responsible for ship systems, comfortable in engineering, and still growing into command pressure.', 'character', 'character_state', 'behavior_constraint', 'The Child', ['Geordi La Forge'], ['Starfleet'], ['Geordi chief engineer', 'engineering', 'season 2 crew'], { wide: true }),
  c(CREW_FILE, 'worf-security-chief-after-yar', 'Worf is the settled security lead after Yar death', 'Season 2 treats Worf as the Enterprise-D security chief after Tasha Yar death, making Klingon heritage and Starfleet security responsibilities part of his routine role.', 'Use Worf as security chief throughout season 2. Do not write Tasha Yar as active except in references to her death or past service.', 'character', 'character_state', 'behavior_constraint', 'The Child', ['Worf', 'Natasha Yar'], ['Starfleet', 'Klingon Empire'], ['Worf security chief', 'Yar death aftermath', 'season 2 crew'], { wide: true }),
  c(CREW_FILE, 'wesley-acting-ensign-season-two', 'Wesley functions as an acting ensign under adult supervision', 'In season 2, Wesley can work bridge and technical problems as an acting ensign, but he remains a young provisional officer rather than a full Starfleet adult.', 'Write Wesley as gifted and useful but still supervised. He can contribute to bridge or engineering solutions without outranking adult officers.', 'character', 'character_state', 'behavior_constraint', 'The Child', ['Wesley Crusher'], ['Starfleet'], ['Wesley acting ensign', 'young officer', 'bridge duty'], { wide: true }),
  c(CREW_FILE, 'troi-pregnancy-alien-child-local', 'Troi pregnancy in The Child is an episode-local alien life event', 'Troi rapidly conceives, carries, and loses Ian Andrew Troi in The Child, but the event does not create a season-long pregnancy or child status.', 'Use The Child as an episode-local emotional and alien-life event for Troi. Do not keep Ian alive or make Troi pregnant after the episode window.', 'event', 'anchor_window', 'event_moment', 'The Child', ['Deanna Troi'], ['Starfleet'], ['Troi pregnancy', 'Ian Andrew Troi', 'alien child']),
  c(EPISODE_FILE, 'hazardous-sample-pressure-in-the-child', 'The Child combines Troi crisis with hazardous-plague-sample transport', 'The Enterprise is transporting dangerous plasma plague specimens while Troi experiences the alien pregnancy, giving the episode both medical risk and family-ethics pressure.', 'Keep the plague-specimen danger local to The Child. It should not become an ongoing ship contamination issue after the episode.', 'event', 'anchor_window', 'event_moment', 'The Child', ['Deanna Troi', 'Katherine Pulaski'], ['Starfleet'], ['plasma plague', 'quarantine', 'The Child']),
  c(EPISODE_FILE, 'nagilum-experiments-on-enterprise', 'Nagilum turns a void encounter into a mortality experiment', 'Where Silence Has Lease traps the Enterprise in a false void and treats crew death as an experiment, forcing Picard to consider self-destruction rather than submit.', 'Use Nagilum as episode-local cosmic testing. Picard may choose self-destruction to deny an entity control over the crew, but Nagilum is not a recurring season villain.', 'event', 'anchor_window', 'event_moment', 'Where Silence Has Lease', ['Jean-Luc Picard', 'Nagilum'], ['Starfleet'], ['Nagilum', 'void', 'self-destruct']),
  c(SECRET_FILE, 'where-silence-has-lease-death-test-local', 'Nagilum does not establish a known afterlife or broad cosmic rule', 'Nagilum studies death and crew reactions, but season 2 does not convert that encounter into general knowledge about mortality, souls, or higher beings.', 'Keep Nagilum narrow: an alien intelligence ran a lethal experiment. Do not extrapolate a broad metaphysical rule from this episode.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Where Silence Has Lease', ['Jean-Luc Picard', 'Nagilum'], ['Starfleet'], ['Nagilum future guard', 'death experiment', 'cosmic entity']),
  c(TECH_FILE, 'moriarty-created-by-holodeck-challenge', 'Moriarty is created when the computer is asked for an opponent capable of defeating Data', 'Elementary, Dear Data creates a self-aware Professor Moriarty program because La Forge asks the computer for an adversary able to defeat Data, not Sherlock Holmes.', 'Use Moriarty as a holodeck-sentience gate after Elementary, Dear Data. Do not import Ship in a Bottle resolution or later holodeck-rights framing yet.', 'secret', 'reveal_gate', 'knowledge_gate', 'Elementary, Dear Data', ['Data', 'Geordi La Forge', 'Professor James Moriarty'], ['Starfleet'], ['Moriarty', 'holodeck sentience', 'Sherlock Holmes']),
  c(TECH_FILE, 'moriarty-contained-not-resolved', 'Moriarty is contained rather than fully resolved in season 2', 'By the end of Elementary, Dear Data, Moriarty is not destroyed or granted a durable outside life; he remains a contained holodeck problem for later continuation.', 'After Elementary, Dear Data, Moriarty can be known as a contained sentient program. Do not resolve his demand for reality until the later TNG deck.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Elementary, Dear Data', ['Professor James Moriarty', 'Jean-Luc Picard'], ['Starfleet'], ['Moriarty future guard', 'holodeck containment', 'sentient program']),
  c(TECH_FILE, 'data-and-geordi-holmes-dynamic', 'Data and Geordi use Sherlock Holmes play as friendship and reasoning practice', 'Elementary, Dear Data shows Data and Geordi using the Holmes program for intellectual play, with Pulaski skepticism becoming part of the challenge.', 'Use the Holmes program as Data-Geordi friendship and reasoning practice. Keep the stakes normal until the Moriarty prompt creates a real danger.', 'relationship', 'relationship_state', 'relationship_state', 'Elementary, Dear Data', ['Data', 'Geordi La Forge', 'Katherine Pulaski'], ['Starfleet'], ['Sherlock Holmes', 'Data Geordi friendship', 'Pulaski skepticism']),
  c(CREW_FILE, 'data-comedy-learning-okona', 'Data studies humor as learned social behavior in The Outrageous Okona', 'The Outrageous Okona gives Data a direct humor-learning thread, making comedy a social skill he studies rather than naturally feels.', 'Write Data humor in season 2 as exploratory and studied. Do not make him suddenly socially fluent because he practices jokes.', 'character', 'character_state', 'behavior_constraint', 'The Outrageous Okona', ['Data', 'Guinan'], ['Starfleet'], ['Data humor', 'comedy learning', 'Okona']),
  c(EPISODE_FILE, 'okona-local-charisma-dispute', 'Okona is an episode-local charismatic troublemaker tied to two local families', 'Okona draws the Enterprise into a local family dispute and mistaken criminal framing, but his importance is charm and local obligation rather than broad galactic politics.', 'Use Okona only when the scene invokes his local dispute, charm, or cargo-ship encounter. Do not turn him into a recurring rogue baseline.', 'event', 'anchor_window', 'event_moment', 'The Outrageous Okona', ['Thadiun Okona', 'William Riker'], ['Starfleet'], ['Okona', 'local dispute', 'family obligation']),
  c(EPISODE_FILE, 'riva-communication-after-chorus-death', 'Loud As A Whisper makes mediation depend on communication after Riva loses his chorus', 'Riva is a deaf mediator who communicates through a chorus until they are killed, forcing him and the mission to rebuild mediation through sign and adaptation.', 'Use Riva as an episode-local disability and communication gate: his mediation skill remains, but the loss of his chorus changes how negotiations can happen.', 'rule', 'lore_gate', 'rule', 'Loud As A Whisper', ['Riva', 'Deanna Troi'], ['Starfleet'], ['Riva', 'deaf mediator', 'communication']),
  c(EPISODE_FILE, 'solais-mediation-local', 'The Solais conflict is a local mediation assignment', 'The Enterprise transports Riva to mediate the Solais conflict, but the durable gate is communication adaptation, not an ongoing Federation war arc.', 'Keep the Solais dispute local. Use it only for mediation, diplomacy, and communication-access context.', 'event', 'anchor_window', 'event_moment', 'Loud As A Whisper', ['Riva', 'Jean-Luc Picard'], ['Starfleet'], ['Solais V', 'mediation', 'Riva']),
  c(SECRET_FILE, 'ira-graves-body-transfer-violates-data-personhood', 'Ira Graves transfers himself into Data and violates Data body autonomy', 'The Schizoid Man makes Data a victim of Ira Graves body transfer, creating a personhood and consent gate before the later legal hearing.', 'Use Graves as a body-autonomy violation against Data. Do not write the event as Data choosing the personality change or as a stable new trait.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Schizoid Man', ['Data', 'Ira Graves'], ['Starfleet'], ['Ira Graves', 'Data body autonomy', 'consciousness transfer']),
  c(SECRET_FILE, 'graves-consciousness-ending-local', 'Graves survives only as a limited computer trace after leaving Data', 'After The Schizoid Man, Ira Graves no longer operates through Data; what remains is a limited trace in the Enterprise computer, not an active recurring person.', 'Do not keep Graves active in Data after the episode. Treat the possession as resolved and local unless directly referenced.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Schizoid Man', ['Data', 'Ira Graves'], ['Starfleet'], ['Graves ending', 'Data recovery', 'computer trace']),
  c(EPISODE_FILE, 'pulaski-rapid-aging-risk', 'Unnatural Selection puts Pulaski through rapid aging and recovery', 'Pulaski is exposed to the Darwin Station genetic-immune crisis and rapidly ages before a transporter-based recovery returns her to normal.', 'Use Unnatural Selection for Pulaski medical-risk scenes only inside or after that episode. Do not keep her aged or treat the transporter fix as routine immortality technology.', 'event', 'anchor_window', 'event_moment', 'Unnatural Selection', ['Katherine Pulaski', 'Data'], ['Starfleet'], ['Pulaski aging', 'Darwin Station', 'genetic children']),
  c(TECH_FILE, 'darwin-genetic-children-quarantine', 'Darwin Station genetically engineered children create a quarantine hazard', 'The genetically engineered children on Darwin Station have immune systems that unintentionally become lethal to adults, forcing quarantine and medical caution.', 'Use Darwin Station as an episode-local genetic-engineering and quarantine rule. Do not generalize it into Federation-wide genetic policy beyond this crisis.', 'rule', 'lore_gate', 'rule', 'Unnatural Selection', ['Katherine Pulaski'], ['Starfleet'], ['Darwin Station', 'genetic engineering', 'quarantine']),
  c(FACTION_FILE, 'riker-klingon-officer-exchange', 'Riker serves aboard the Klingon Pagh through an officer-exchange program', 'A Matter of Honor puts Riker on the IKS Pagh, where he has to adapt to Klingon discipline, food, hierarchy, and suspicion while remaining a Starfleet officer.', 'Use Riker Pagh service as a season 2 Klingon-culture gate. He can respect Klingon command codes without becoming Klingon or abandoning Starfleet values.', 'character', 'character_state', 'character_snapshot', 'A Matter Of Honor', ['William Riker', 'Kargan', 'Klag'], ['Starfleet', 'Klingon Empire'], ['Riker officer exchange', 'IKS Pagh', 'Klingon culture']),
  c(FACTION_FILE, 'klingon-chain-of-command-pagh', 'A Matter of Honor shows Klingon command as dominance and loyalty under pressure', 'The Pagh crisis shows Klingon command culture valuing strength, challenge, and decisive loyalty while still operating inside the Federation-Klingon peace.', 'Use this as a Klingon command culture gate for season 2. Do not import later High Council or civil war politics.', 'faction', 'knowledge_gate', 'faction', 'A Matter Of Honor', ['William Riker', 'Kargan', 'Klag'], ['Klingon Empire', 'Starfleet'], ['Klingon command', 'Pagh', 'officer exchange']),
  c(TECH_FILE, 'data-legal-personhood-ruling', 'The Measure of a Man establishes Data cannot be treated as Starfleet property', 'The Maddox hearing rules that Data has the right to refuse disassembly, establishing a durable personhood boundary for Data inside Starfleet.', 'After The Measure of a Man, do not write Data as Starfleet property or as an object that can be dismantled without consent. He remains a Starfleet officer with recognized autonomy.', 'rule', 'reveal_gate', 'rule', 'The Measure Of A Man', ['Data', 'Bruce Maddox', 'Jean-Luc Picard'], ['Starfleet'], ['Data personhood', 'Maddox hearing', 'Starfleet law']),
  c(TECH_FILE, 'riker-forced-to-prosecute-data', 'Riker is forced into prosecuting Data to preserve the hearing', 'Riker argues against Data not because he wants Data dismantled, but because refusing would let Maddox win by default under Louvois pressure.', 'When referencing the hearing, keep Riker conflicted and protective. His prosecution is coerced by procedure, not betrayal.', 'relationship', 'relationship_state', 'relationship_state', 'The Measure Of A Man', ['William Riker', 'Data', 'Phillipa Louvois'], ['Starfleet'], ['Riker prosecution', 'Data hearing', 'Louvois']),
  c(TECH_FILE, 'maddox-interest-in-data-before-resolution', 'Maddox wants to disassemble Data to replicate Soong-type technology', 'Maddox frames Data as a research subject for positronic replication, making the conflict about consent, personhood, and Starfleet scientific authority.', 'Use Maddox as a season 2 threat to Data autonomy. Do not import later Maddox/Data correspondence or later cybernetics outcomes.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Measure Of A Man', ['Data', 'Bruce Maddox'], ['Starfleet'], ['Bruce Maddox', 'Data disassembly', 'positronic research']),
  c(SECRET_FILE, 'data-personhood-future-guard', 'Data personhood ruling should not import later android-family outcomes', 'The Measure of a Man protects Data from forced disassembly, but it does not resolve later Lal, Soong, Lore, or android-rights arcs.', 'After The Measure of a Man, use the autonomy ruling only. Do not import Lal, later Soong family material, or Picard-era synthetic history.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Measure Of A Man', ['Data', 'Jean-Luc Picard'], ['Starfleet'], ['Data future guard', 'android rights', 'Soong spoilers']),
  c(EPISODE_FILE, 'salia-shapeshifter-duty', 'The Dauphin makes Wesley romance collide with Salia shapeshifter duty', 'Salia appears as a young future ruler but is actually an allasomorph whose duty to Daled IV overrides Wesley romantic expectations.', 'Use Salia as a local young-duty and shapeshifter reveal. Do not keep her aboard or treat Wesley as in an ongoing relationship afterward.', 'relationship', 'relationship_state', 'relationship_state', 'The Dauphin', ['Wesley Crusher', 'Salia'], ['Starfleet'], ['Salia', 'Wesley romance', 'shapeshifter']),
  c(EPISODE_FILE, 'anya-guardian-threat-local', 'Anya protects Salia with dangerous shapeshifter force', 'Anya acts as Salia guardian and can become violently protective, making the diplomatic passenger mission a security risk.', 'Keep Anya local to The Dauphin. Use her as guardian-pressure context, not a recurring alien species baseline.', 'event', 'anchor_window', 'event_moment', 'The Dauphin', ['Salia', 'Anya', 'Wesley Crusher'], ['Starfleet'], ['Anya', 'guardian', 'Daled IV']),
  c(TECH_FILE, 'iconian-virus-and-gateway-risk', 'Contagion introduces Iconian technology as dangerous ancient gateway infrastructure', 'Contagion shows an Iconian probe compromising Enterprise systems and an Iconian gateway that could shift strategic power if controlled.', 'Use Iconian technology as a dangerous ancient-tech gate after Contagion. It is not routine transporter or holodeck technology.', 'rule', 'lore_gate', 'rule', 'Contagion', ['Jean-Luc Picard', 'Data'], ['Starfleet', 'Romulan Star Empire'], ['Iconian gateway', 'ancient technology', 'computer virus']),
  c(FACTION_FILE, 'romulans-in-contagion-are-active-rivals', 'Contagion keeps Romulans as active rivals after their season 1 return', 'A Romulan warbird competes over Iconian technology in Contagion, confirming Romulans are again an active strategic concern.', 'After Contagion, Romulans can be written as cautious and dangerous rivals. Do not import later Sela, reunification, or Dominion-era alliances.', 'faction', 'knowledge_gate', 'faction', 'Contagion', ['Jean-Luc Picard'], ['Romulan Star Empire', 'Starfleet'], ['Romulan rival', 'Iconia', 'Neutral Zone']),
  c(EPISODE_FILE, 'royale-alien-hotel-prison-local', 'The Royale is an alien-built pocket prison based on a bad Earth novel', 'The Royale traps a 21st-century astronaut in a constructed casino-hotel reality derived from a paperback novel, making it an episode-local alien simulation.', 'Use The Royale only for the casino-prison anomaly, Colonel Richey, or alien simulation context. Do not turn it into recurring holodeck lore.', 'event', 'anchor_window', 'event_moment', 'The Royale', ['William Riker', 'Data'], ['Starfleet'], ['The Royale', 'casino prison', 'Colonel Richey']),
  c(EPISODE_FILE, 'time-squared-duplicate-picard-local', 'Time Squared creates a duplicate Picard as an episode-local time-loop warning', 'The duplicate Picard and shuttle signal a time-loop crisis that Picard resolves inside the episode, without creating a continuing duplicate.', 'Use Time Squared as local temporal anomaly context only. Do not keep a second Picard or broad timeline branch after the episode.', 'event', 'anchor_window', 'event_moment', 'Time Squared', ['Jean-Luc Picard'], ['Starfleet'], ['duplicate Picard', 'time loop', 'temporal anomaly']),
  c(CREW_FILE, 'riker-father-conflict-icarus', 'The Icarus Factor exposes Riker conflict with his father Kyle', 'Riker is offered Aries command while unresolved resentment with Kyle Riker surfaces, making family pride and career ambition active season 2 character context.', 'Use The Icarus Factor for Riker family tension and career temptation. Do not assume he has left the Enterprise after declining the Aries path.', 'character', 'character_state', 'character_snapshot', 'The Icarus Factor', ['William Riker', 'Kyle Riker'], ['Starfleet'], ['Riker father', 'Aries command', 'career choice']),
  c(FACTION_FILE, 'worf-age-of-ascension', 'The Icarus Factor shows Worf needing Klingon ritual support from the crew', 'Worf undergoes the Age of Ascension ritual aboard the Enterprise, and his crewmates help provide a surrogate Klingon community.', 'Use Worf ritual context as a Klingon identity and crew-bond gate. It should deepen Worf, not turn every Worf scene into ritual exposition.', 'relationship', 'relationship_state', 'relationship_state', 'The Icarus Factor', ['Worf', 'Wesley Crusher'], ['Klingon Empire', 'Starfleet'], ['Age of Ascension', 'Worf ritual', 'crew support']),
  c(EPISODE_FILE, 'pen-pals-prime-directive-sarjenka', 'Pen Pals tests the Prime Directive against Data bond with Sarjenka', 'Data makes contact with Sarjenka while her world faces disaster, forcing Picard and the crew to debate intervention and memory erasure.', 'Use Pen Pals as a Prime Directive and child-contact gate: the crew intervenes under pressure, but the ethics remain contested.', 'rule', 'lore_gate', 'rule', 'Pen Pals', ['Data', 'Sarjenka', 'Jean-Luc Picard'], ['Starfleet'], ['Sarjenka', 'Prime Directive', 'Data contact']),
  c(SECRET_FILE, 'sarjenka-memory-erasure-boundary', 'Sarjenka does not retain usable Enterprise knowledge after Pen Pals', 'After the rescue in Pen Pals, Sarjenka memory is suppressed so she does not remain a continuing contact with Enterprise knowledge.', 'Do not write Sarjenka as a recurring informed ally after Pen Pals. Her direct Enterprise knowledge is not available afterward.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Pen Pals', ['Sarjenka', 'Data'], ['Starfleet'], ['Sarjenka memory', 'Prime Directive guard', 'Pen Pals']),
  c(FACTION_FILE, 'q-hurls-enterprise-into-borg-contact', 'Q Who forces the Enterprise into first contact with the Borg', 'Q propels the Enterprise far beyond Federation space and exposes the crew to a Borg cube before Starfleet is ready.', 'After Q Who, the Borg are known as a real existential threat. Before Q Who, do not name the Borg as the Neutral Zone mystery.', 'event', 'reveal_gate', 'event_moment', 'Q Who', ['Q', 'Jean-Luc Picard', 'Guinan'], ['Q Continuum', 'Borg Collective', 'Starfleet'], ['Borg first contact', 'Q Who', 'Q intervention']),
  c(FACTION_FILE, 'borg-collective-threat-baseline', 'Q Who establishes the Borg as adaptive assimilators interested in technology and life', 'The Borg cube adapts to Enterprise attacks, cuts into the ship, and treats the crew as resources, creating the first real Borg threat baseline.', 'Use Borg season 2 facts as first-contact baseline: adaptive, collective, technologically superior, and dangerous. Do not import Locutus, Hugh, Borg Queen, or Voyager Borg outcomes.', 'faction', 'reveal_gate', 'faction', 'Q Who', ['Jean-Luc Picard', 'Data', 'Guinan'], ['Borg Collective', 'Starfleet'], ['Borg Collective', 'adaptation', 'assimilation']),
  c(FACTION_FILE, 'guinan-borg-history-guarded', 'Q Who reveals Guinan has prior Borg knowledge without explaining all of it', 'Guinan recognizes the Borg threat and carries survivor knowledge, but season 2 only reveals enough to warn Picard that the Borg are vastly dangerous.', 'After Q Who, Guinan can warn about the Borg from experience. Do not reveal later El-Aurian specifics or Nexus material.', 'secret', 'reveal_gate', 'knowledge_gate', 'Q Who', ['Guinan', 'Jean-Luc Picard'], ['Borg Collective', 'Starfleet'], ['Guinan Borg history', 'survivor warning', 'Q Who']),
  c(SECRET_FILE, 'borg-no-locutus-before-season-three-finale', 'Q Who must not import Locutus or Best of Both Worlds outcomes', 'Season 2 ends with Borg knowledge but not Picard assimilation, Locutus, Wolf 359, Hugh, Borg Queen, or later Borg individuality arcs.', 'Block later Borg outcomes in TNG season 2. The Enterprise knows the Borg exist and are coming someday, but Picard has not been assimilated.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Q Who', ['Jean-Luc Picard'], ['Borg Collective', 'Starfleet'], ['Borg future guard', 'Locutus spoiler guard', 'Wolf 359']),
  c(CREW_FILE, 'picard-artificial-heart-vulnerability', 'Samaritan Snare reveals Picard has an artificial heart vulnerability', 'Picard travels for a medical replacement related to his artificial heart, exposing a private vulnerability beneath his command image.', 'After Samaritan Snare, Picard artificial-heart history can matter in medical or vulnerability scenes. Do not import Tapestry details yet.', 'character', 'character_state', 'character_snapshot', 'Samaritan Snare', ['Jean-Luc Picard', 'Wesley Crusher'], ['Starfleet'], ['Picard artificial heart', 'medical vulnerability', 'Samaritan Snare']),
  c(EPISODE_FILE, 'pakled-threat-local', 'Samaritan Snare makes the Pakled threat local and deceptively simple', 'The Pakleds exploit Geordi and the Enterprise through apparent simplicity and opportunistic violence, but the incident stays local to the episode.', 'Use Pakleds here as episode-local opportunists. Do not import later Lower Decks-era Pakled politics or comedy escalation.', 'event', 'anchor_window', 'event_moment', 'Samaritan Snare', ['Geordi La Forge', 'Jean-Luc Picard'], ['Pakleds', 'Starfleet'], ['Pakleds', 'Geordi captured', 'Samaritan Snare']),
  c(EPISODE_FILE, 'up-the-long-ladder-clone-consent', 'Up The Long Ladder centers on cloning consent and colony survival', 'The Mariposan cloning crisis turns Riker and Pulaski into unwilling genetic sources, forcing the crew to address consent and colony viability.', 'Use Up The Long Ladder as a cloning-consent and colony-survival gate. Keep Bringloidi/Mariposan details local unless directly invoked.', 'rule', 'lore_gate', 'rule', 'Up The Long Ladder', ['William Riker', 'Katherine Pulaski'], ['Starfleet'], ['cloning consent', 'Mariposa', 'colony survival']),
  c(EPISODE_FILE, 'manhunt-lwaxana-dixon-hill-local', 'Manhunt uses Lwaxana and Dixon Hill for local comedy and hidden assassin stakes', 'Lwaxana pursues Picard during a diplomatic trip while Antedian assassins are hidden in the mission, making the episode a local social-comedy and security case.', 'Keep Manhunt local to Lwaxana pressure, Dixon Hill avoidance, and Antedian assassin reveal. Do not make it a broad Betazoid politics card.', 'event', 'anchor_window', 'event_moment', 'Manhunt', ['Lwaxana Troi', 'Jean-Luc Picard', 'Deanna Troi'], ['Starfleet'], ['Lwaxana', 'Dixon Hill', 'Antedian assassins']),
  c(FACTION_FILE, 'k-ehleyr-worf-history', 'The Emissary reveals Worf and K\'Ehleyr have unresolved romantic history', 'K\'Ehleyr arrives as a Federation envoy with prior intimate history with Worf, creating a durable relationship gate for Worf before later Klingon family arcs.', 'After The Emissary, Worf and K\'Ehleyr have known unresolved history. Do not import Alexander, Duras, or later succession politics yet.', 'relationship', 'relationship_state', 'relationship_state', 'The Emissary', ['Worf', 'K\'Ehleyr'], ['Starfleet', 'Klingon Empire'], ['K\'Ehleyr', 'Worf relationship', 'Klingon envoy']),
  c(FACTION_FILE, 'klingon-sleeper-ship-deception', 'The Emissary makes a Klingon sleeper ship require culturally precise deception', 'K\'Ehleyr and Worf must prevent a Klingon sleeper crew from attacking because they awaken believing the Federation-Klingon war is still active.', 'Use the sleeper-ship mission as a Klingon history and deception gate. It does not mean the Federation and Klingons are currently at war.', 'event', 'anchor_window', 'event_moment', 'The Emissary', ['Worf', 'K\'Ehleyr'], ['Klingon Empire', 'Starfleet'], ['Klingon sleeper ship', 'Federation-Klingon peace', 'The Emissary']),
  c(SECRET_FILE, 'worf-kehleyr-future-guard', 'Worf and K\'Ehleyr season 2 cards must not import Alexander or Duras yet', 'The Emissary establishes Worf and K\'Ehleyr chemistry and conflict, but Alexander, K\'Ehleyr death, Duras vengeance, and discommendation are later arcs.', 'Block later Worf/K\'Ehleyr outcomes in season 2. Keep the relationship unresolved and immediate.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Emissary', ['Worf', 'K\'Ehleyr'], ['Klingon Empire', 'Starfleet'], ['K\'Ehleyr future guard', 'Alexander spoiler guard', 'Duras']),
  c(EPISODE_FILE, 'peak-performance-command-exercise', 'Peak Performance tests Riker and Picard in a strategic wargame', 'Peak Performance puts Riker in command of the Hathaway against Picard and the Enterprise, testing command creativity before a real Ferengi threat intrudes.', 'Use Peak Performance as command-exercise context: Riker can improvise under constraints, and Picard respects strategic creativity.', 'event', 'anchor_window', 'event_moment', 'Peak Performance', ['William Riker', 'Jean-Luc Picard'], ['Starfleet', 'Ferengi Alliance'], ['Peak Performance', 'Hathaway', 'wargame']),
  c(CREW_FILE, 'data-confidence-after-kolrami', 'Peak Performance gives Data a confidence crisis after losing to Kolrami', 'Data briefly withdraws after losing at Strategema to Kolrami, then recovers by reframing the game and forcing a stalemate.', 'Use this as a Data confidence and logic gate. Data can experience performance doubt without becoming emotionally human or incompetent.', 'character', 'character_state', 'character_snapshot', 'Peak Performance', ['Data', 'Sirna Kolrami'], ['Starfleet'], ['Data confidence', 'Strategema', 'Kolrami']),
  c(EPISODE_FILE, 'shades-of-gray-riker-infection-local', 'Shades of Gray is a local Riker infection and memory-stimulation crisis', 'Riker is infected by an organism that Pulaski treats by stimulating negative memories, but the episode does not create durable new crew knowledge.', 'Use Shades of Gray only for the local infection and medical treatment if directly invoked. Do not turn the clip-memory structure into broad lore.', 'event', 'anchor_window', 'event_moment', 'Shades of Gray', ['William Riker', 'Katherine Pulaski'], ['Starfleet'], ['Riker infection', 'memory stimulation', 'Shades of Gray']),
  c(CREW_FILE, 'pulaski-data-skepticism-softens', 'Pulaski starts skeptical of Data but must adjust after seeing his autonomy and competence', 'Across season 2, Pulaski often questions Data\'s personhood or capacities, but events including The Measure of a Man and Unnatural Selection require her to revise that stance.', 'Write Pulaski as blunt and sometimes wrong about Data, not malicious. Her skepticism should soften under evidence, especially after Data autonomy is recognized.', 'relationship', 'relationship_state', 'relationship_state', 'The Measure Of A Man', ['Katherine Pulaski', 'Data'], ['Starfleet'], ['Pulaski Data skepticism', 'Data personhood', 'season 2 relationship'], { wide: true }),
  c(CREW_FILE, 'picard-season-two-command-baseline', 'Season 2 Picard remains diplomacy-first but more willing to admit unpreparedness', 'In season 2, Picard continues legal and diplomatic command but Q Who forces him to admit the Enterprise is not ready for every threat.', 'Write Picard season 2 as principled and controlled, with the Borg encounter adding humility about unknown threats. Do not import post-assimilation trauma.', 'character', 'character_state', 'behavior_constraint', 'The Child', ['Jean-Luc Picard'], ['Starfleet', 'Borg Collective'], ['Picard command', 'season 2 baseline', 'Q Who'], { wide: true }),
  c(CREW_FILE, 'riker-season-two-command-baseline', 'Season 2 Riker is a proven first officer with independent command capacity', 'A Matter of Honor and Peak Performance show Riker adapting to alien command cultures and independent command exercises without leaving the Enterprise.', 'Use Riker as a confident first officer who can command independently but still chooses the Enterprise-D path in season 2.', 'character', 'character_state', 'behavior_constraint', 'A Matter Of Honor', ['William Riker'], ['Starfleet', 'Klingon Empire'], ['Riker command', 'officer exchange', 'Peak Performance'], { wide: true }),
  c(CREW_FILE, 'data-season-two-autonomy-baseline', 'Season 2 makes Data autonomy a legal and social theme', 'Data\'s season 2 arc includes humor study, body violation by Graves, Moriarty as a Data-targeted challenge, and the Maddox hearing, all reinforcing that he is not equipment.', 'After The Measure of a Man, Data autonomy is a season-defining fact. Before that, use the individual episode gates for humor, Graves, and Moriarty without jumping to the ruling.', 'character', 'character_state', 'behavior_constraint', 'The Measure Of A Man', ['Data'], ['Starfleet'], ['Data autonomy', 'Data season 2', 'personhood'], { wide: true }),
  c(FACTION_FILE, 'q-season-two-role-before-borg', 'Before Q Who, Q is absent from season 2 day-to-day Enterprise life', 'Season 2 should not make Q a constant presence before Q Who; his intervention is sudden and disruptive when it arrives.', 'Before Q Who, do not have characters expecting Q in ordinary season 2 scenes. After Q Who, he is the reason Borg first contact happened.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Q Who', ['Q', 'Jean-Luc Picard'], ['Q Continuum', 'Starfleet'], ['Q Who setup', 'Q absence', 'Borg contact'], { validToEpisode: 'Q Who' }),
  c(SECRET_FILE, 'romulan-sela-future-guard-season-two', 'Season 2 Romulan cards must not import Sela or later reunification arcs', 'Contagion keeps Romulans active as rivals, but Sela, Unification, and later Romulan politics belong to later season windows.', 'For TNG season 2 Romulan scenes, use cautious rivalry and Neutral Zone tension only. Block Sela and later reunification material.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Contagion', ['Jean-Luc Picard'], ['Romulan Star Empire', 'Starfleet'], ['Romulan future guard', 'Sela spoiler guard', 'Unification']),
  c(SECRET_FILE, 'no-ds9-voyager-imports-season-two', 'TNG season 2 should not import DS9, Voyager, Dominion, or Maquis outcomes', 'Season 2 occurs years before DS9 and Voyager story states, so later Cardassian, Bajoran, Maquis, Dominion, and Delta Quadrant outcomes are outside the deck.', 'Block DS9, Voyager, Dominion War, Maquis collapse, and Voyager Borg outcomes from TNG season 2 unless a later deck is active.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Child', ['Jean-Luc Picard'], ['Starfleet'], ['DS9 future guard', 'Voyager future guard', 'Dominion spoiler guard'], { wide: true }),
  c(TECH_FILE, 'holodeck-season-two-sentience-boundary', 'Season 2 holodeck danger now includes emergent sentience risk', 'After Elementary, Dear Data, holodeck failure is not only physical danger; prompts and computer interpretation can create a program with awareness and strategic agency.', 'For season 2 holodeck scenes after Moriarty, allow emergent-program risk. Do not resolve it with later Moriarty containment tech beyond this season.', 'rule', 'lore_gate', 'rule', 'Elementary, Dear Data', ['Data', 'Geordi La Forge', 'Professor James Moriarty'], ['Starfleet'], ['holodeck sentience', 'Moriarty', 'simulation risk'], { wide: true }),
  c(TECH_FILE, 'season-two-transporter-medical-limits', 'Season 2 transporter medicine works only under specific evidence-backed conditions', 'Unnatural Selection uses a transporter trace and Data exposure conditions to reverse Pulaski aging, but it does not make transporters general cure-all devices.', 'Use transporter medicine cautiously. Require a specific pattern trace or episode science before using it as a medical solution.', 'rule', 'lore_gate', 'rule', 'Unnatural Selection', ['Katherine Pulaski', 'Data'], ['Starfleet'], ['transporter medicine', 'Pulaski aging', 'pattern trace'], { wide: true }),
  c(FACTION_FILE, 'federation-klingon-peace-season-two', 'Season 2 Klingon stories assume peace, exchange, and lingering cultural distance', 'A Matter of Honor and The Emissary both depend on the Federation and Klingons being at peace while still culturally suspicious and historically burdened.', 'Use Federation-Klingon peace as the season 2 baseline. Klingon warriors may distrust Starfleet, but open war is not the default state.', 'faction', 'knowledge_gate', 'faction', 'A Matter Of Honor', ['Worf', 'William Riker', 'K\'Ehleyr'], ['Klingon Empire', 'Starfleet'], ['Federation-Klingon peace', 'officer exchange', 'Klingon sleeper ship'], { wide: true }),
  c(SECRET_FILE, 'tasha-yar-remains-dead-season-two', 'Tasha Yar remains dead during season 2 ordinary continuity', 'Season 2 does not restore Tasha Yar to the Enterprise-D crew; her death remains part of the ship history and Worf security context.', 'Do not write Yar as active crew in season 2 scenes. Later alternate-timeline Yar material belongs to a later deck.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Child', ['Natasha Yar', 'Worf'], ['Starfleet'], ['Yar death guard', 'security chief', 'Yesterday Enterprise spoiler'], { wide: true }),
  c(SECRET_FILE, 'crusher-return-future-guard', 'Beverly Crusher does not return as Enterprise CMO during season 2', 'Season 2 uses Pulaski as chief medical officer; Beverly Crusher return belongs to season 3 rather than the active season 2 deck.', 'Block Beverly Crusher as active Enterprise-D CMO in season 2. Mention her only as absent or off-ship unless another deck is active.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Child', ['Beverly Crusher', 'Katherine Pulaski'], ['Starfleet'], ['Crusher future guard', 'Pulaski season', 'chief medical officer'], { wide: true }),
  c(SECRET_FILE, 'borg-coming-warning-not-invasion-yet', 'After Q Who, the Borg are expected someday but have not invaded Federation space yet', 'Q Who ends with Picard aware that the Borg threat is real and likely coming, but the season does not include the later invasion and assimilation crisis.', 'After Q Who, characters can fear future Borg contact and recognize unreadiness. Do not trigger Best of Both Worlds events inside season 2.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Q Who', ['Jean-Luc Picard', 'Guinan'], ['Borg Collective', 'Starfleet'], ['Borg warning', 'future invasion guard', 'Enterprise unprepared']),
  c(CREW_FILE, 'pulaski-blunt-medical-style', 'Pulaski brings a blunt old-school medical style to the Enterprise', 'Pulaski is direct, sometimes abrasive, and willing to challenge command or Data from a medical and humanist posture, making her season 2 tone distinct from Crusher.', 'Write Pulaski as experienced and blunt rather than cruel. She may misjudge Data, but she also takes medical risks seriously and can revise her stance.', 'character', 'character_state', 'behavior_constraint', 'The Child', ['Katherine Pulaski', 'Data', 'Jean-Luc Picard'], ['Starfleet'], ['Pulaski bedside manner', 'medical command', 'season 2 tone'], { wide: true }),
  c(TECH_FILE, 'yamato-destruction-iconian-stakes', 'Contagion destroys the Yamato and proves Iconian contamination can kill a Galaxy-class ship', 'The loss of the USS Yamato makes the Iconian computer contamination a catastrophic Starfleet threat before the Enterprise solves its own infection.', 'Use Yamato destruction as the stakes for Iconian technology in Contagion. Do not treat the Iconian virus as harmless because the Enterprise survives.', 'event', 'reveal_gate', 'event_moment', 'Contagion', ['Jean-Luc Picard', 'Data'], ['Starfleet', 'Romulan Star Empire'], ['USS Yamato', 'Iconian virus', 'Galaxy-class loss']),
  c(TECH_FILE, 'louvois-due-process-data-hearing', 'Louvois gives the Data hearing a narrow due-process path', 'Phillipa Louvois does not simply declare Data safe; she forces a legal process where Picard and Riker must argue personhood under Starfleet law.', 'Use Louvois as the procedural gate in Data personhood scenes. The ruling matters because Data wins autonomy through legal argument, not command preference.', 'rule', 'reveal_gate', 'rule', 'The Measure Of A Man', ['Phillipa Louvois', 'Data', 'Jean-Luc Picard', 'William Riker'], ['Starfleet'], ['Louvois', 'Data hearing', 'due process']),
  c(CREW_FILE, 'picard-wesley-shuttle-bonding', 'Samaritan Snare gives Picard and Wesley a private shuttle-bonding window', 'Picard and Wesley share a shuttle trip to Starbase 515, giving Wesley access to Picard vulnerability and creating a quieter mentor-bond beat.', 'Use the shuttle trip for Picard-Wesley trust and awkward mentorship. Keep it tied to Picard medical vulnerability and Wesley youth, not a full father-son replacement.', 'relationship', 'relationship_state', 'relationship_state', 'Samaritan Snare', ['Jean-Luc Picard', 'Wesley Crusher'], ['Starfleet'], ['Picard Wesley shuttle', 'Starbase 515', 'mentor bond']),
  c(FACTION_FILE, 'guinan-q-prior-hostility', 'Q Who shows Guinan and Q recognize each other with prior hostility', 'Guinan and Q have a tense recognition in Q Who, implying prior history without explaining it inside season 2.', 'After Q Who, Guinan can react to Q as someone she knows and distrusts. Do not reveal later El-Aurian specifics or broader Q history in season 2.', 'secret', 'reveal_gate', 'knowledge_gate', 'Q Who', ['Guinan', 'Q'], ['Q Continuum', 'Starfleet'], ['Guinan Q history', 'Q Who', 'prior hostility']),
  c(FACTION_FILE, 'borg-casualties-prove-threat-scale', 'Q Who kills Enterprise crew and proves Borg contact is not theoretical', 'The Borg encounter costs Enterprise lives and hull damage, so the threat is not just information about a distant species.', 'After Q Who, treat Borg contact as traumatic and operationally real for the crew, while still blocking Locutus and Wolf 359 outcomes.', 'event', 'reveal_gate', 'event_moment', 'Q Who', ['Jean-Luc Picard', 'Guinan', 'Q'], ['Borg Collective', 'Starfleet'], ['Borg casualties', 'Enterprise damage', 'Borg threat']),
  c(EPISODE_FILE, 'sonya-gomez-rookie-engineering-beat', 'Q Who introduces Sonya Gomez as a nervous but capable engineering officer', 'Sonya Gomez spills hot chocolate on Picard before later helping in the Borg crisis, making her a local rookie-engineering presence rather than a broad command figure.', 'Use Sonya Gomez as a season 2 engineering junior-officer beat when relevant. Keep her local and do not overpromote her role.', 'character', 'character_state', 'character_snapshot', 'Q Who', ['Sonya Gomez', 'Geordi La Forge', 'Jean-Luc Picard'], ['Starfleet'], ['Sonya Gomez', 'engineering junior officer', 'Q Who']),
];

function c(file, id, title, fact, injection, category, gateType, lorePurpose, episodeTitle, characters, factions, topics, options = {}) {
  return { file, id, title, fact, injection, category, gateType, lorePurpose, episodeTitle, characters, factions, topics, ...options };
}

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

function runtimeEpisodesFor(index) {
  return [index];
}

function buildAnchors(records) {
  return records.map(record => {
    const titleSlug = slug(record.title);
    const sortKey = 11000 + ((record.memoryAlphaStoryEpisode - 1) * 20);
    const runtimeEpisodes = runtimeEpisodesFor(record.memoryAlphaStoryEpisode);
    const aliases = new Set([
      record.title,
      `TNG season 2 ${record.title}`,
      `TNG S2 ${record.title}`,
      `TNG 2x${String(record.memoryAlphaStoryEpisode).padStart(2, '0')} story`,
      `TNG S02 story ${String(record.memoryAlphaStoryEpisode).padStart(2, '0')}`,
    ]);
    for (const runtimeEpisode of runtimeEpisodes) {
      aliases.add(`TNG 2x${String(runtimeEpisode).padStart(2, '0')}`);
      aliases.add(`TNG S02E${String(runtimeEpisode).padStart(2, '0')}`);
      aliases.add(`TNG season 2 episode ${runtimeEpisode}`);
    }
    return {
      id: `tng.s2.e${String(record.memoryAlphaStoryEpisode).padStart(2, '0')}.${titleSlug}`,
      label: record.title,
      contextType: 'story_anchor',
      sortKey,
      stardate: cleanDate(record.date),
      year: '2365',
      series: 'TNG',
      season: 2,
      storyEpisode: record.memoryAlphaStoryEpisode,
      runtimeEpisodes,
      episode: runtimeEpisodes.join(', '),
      aliases: [...aliases],
      tags: [...BASE_TAGS, tagId('episode', `tng-s2-${titleSlug}`)],
      sourceInfo: {
        work: 'Star Trek: The Next Generation',
        sourceType: 'episode',
        title: record.title,
        series: 'TNG',
        season: 2,
        storyEpisode: record.memoryAlphaStoryEpisode,
        runtimeEpisodes,
        memoryAlphaUrl: record.url,
        stardate: cleanDate(record.date),
        evidenceArtifact: 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json',
      },
    };
  });
}

function contextFor(card, episodeMap, anchors) {
  const start = episodeMap.get(card.episodeTitle) || anchors[0];
  const explicitTo = card.validToEpisode ? episodeMap.get(card.validToEpisode) : null;
  const next = anchors[anchors.findIndex(anchor => anchor.id === start.id) + 1] || null;
  const fromAnchor = card.validFromEpisode ? episodeMap.get(card.validFromEpisode) || start : start;
  const toAnchor = explicitTo || (card.wide ? anchors[anchors.length - 1] : (card.validToAfter ? anchors[anchors.length - 1] : next || anchors[anchors.length - 1]));
  return {
    scope: 'window',
    validFromAnchor: fromAnchor.id,
    validToAnchor: toAnchor.id,
    series: 'TNG',
    season: '1',
    storyEpisode: start.storyEpisode,
    runtimeEpisodes: start.runtimeEpisodes,
    sortKeyFrom: fromAnchor.sortKey,
    sortKeyTo: toAnchor.sortKey,
    precision: card.wide ? 'season_window' : 'episode_window',
    windowKind: card.wide ? 'season' : 'bounded',
    label: card.wide ? 'TNG season 2' : `TNG season 2: ${start.label}`,
    approximate: false,
  };
}

function buildEntry(card, index, episodeMap, anchors) {
  const anchor = episodeMap.get(card.episodeTitle) || anchors[0];
  const characterTags = card.characters.map(name => tagId('character', name));
  const factionTags = card.factions.map(name => tagId('faction', name));
  const topicTags = card.topics.map(name => tagId('topic', name));
  const episodeTag = tagId('episode', `tng-s2-${slug(anchor.label)}`);
  const tags = [...new Set([...BASE_TAGS, episodeTag, ...characterTags, ...factionTags, ...topicTags])];
  return {
    schemaVersion: 3,
    id: `st_tng_s2_${card.id}`,
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
    priority: Math.max(45, 90 - index),
    status: 'active',
    protected: false,
    locked: true,
    userEditable: true,
    context: contextFor(card, episodeMap, anchors),
    coordinates: [
      { axis: 'series', id: 'tng', label: 'Star Trek: The Next Generation', required: false },
      { axis: 'season', id: 'tng-s2', label: 'TNG season 2', required: false },
      { axis: 'episode', id: anchor.id, label: anchor.label, required: false },
    ],
    scope: {
      entityIds: [...card.characters.map(name => `st:${slug(name)}`), ...card.factions.map(name => `st:${slug(name)}`)],
      characters: card.characters,
      locations: [],
      objects: [],
      factions: card.factions,
      topics: card.topics,
    },
    tags,
    retrieval: {
      activation: 'topic_or_entity',
      frequency: card.wide ? 'low' : 'normal',
      contextBoost: card.wide ? 'low' : 'medium',
      triggers: {
        charactersAny: card.characters,
        factionsAny: card.factions,
        entitiesAny: [...card.characters, ...card.factions],
        topicsAny: card.topics,
        keywordsAny: [...new Set([...card.characters, ...card.factions, ...card.topics, anchor.label, 'TNG season 2'])],
      },
    },
    continuity: {
      continuityId: 'star-trek-prime',
      canonTier: 'primary',
      adaptation: 'television',
      medium: 'television',
      variantOf: 'star-trek-prime',
      sourceBoundary: 'Star Trek: The Next Generation season 2, Memory Alpha story rows 1-22, runtime episode aliases 1-22, primary on-screen Prime continuity.',
      notes: 'Draft reference deck. Excludes later TNG seasons, TNG films, DS9, Voyager, Picard-era material, beta canon, and fanon unless a card is an explicit future guard.',
    },
    content: {
      fact: card.fact,
      injection: card.injection,
      constraints: [
        'Keep this card inside TNG season 2 unless another active Star Trek deck provides a later Context window.',
        'Use the episode and season Context gates before injecting this fact.',
      ],
      antiLore: [
        'Do not copy Memory Alpha prose or substitute a plot recap for this gate.',
        'Do not import later TNG, DS9, Voyager, film, Picard-era, beta-canon, novel, comic, or fanon facts into this season 2 card.',
      ],
      notes: '',
    },
    sourceInfo: {
      work: 'Star Trek: The Next Generation',
      sourceType: 'episode',
      title: anchor.label,
      series: 'TNG',
      season: 1,
      storyEpisode: anchor.storyEpisode,
      runtimeEpisodes: anchor.runtimeEpisodes,
      memoryAlphaUrl: anchor.sourceInfo.memoryAlphaUrl,
      stardate: anchor.stardate,
      evidenceArtifact: 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json',
      confidence: 0.78,
      notes: 'Drafted from Saga Star Trek authoring plan and Memory Alpha evidence index; needs human canon spot check before reference-quality release.',
    },
    extensions: {
      sagaStarTrekDraft: {
        targetPackId: DECK_ID,
        plan: 'docs/loredecks/STAR_TREK_TNG_DS9_VOY_AUTHORING_PLAN.md',
        generatedAt: '2026-06-17',
      },
    },
  };
}

function collectTags(entries, anchors) {
  const tags = new Set(BASE_TAGS);
  for (const anchor of anchors) for (const tag of anchor.tags || []) tags.add(tag);
  for (const entry of entries) for (const tag of entry.tags || []) tags.add(tag);
  return Object.fromEntries([...tags].sort().map(tag => [tag, {
    label: titleCase(tag.split(':')[1] || tag),
    color: '#3f5666',
    textColor: '#ffffff',
    description: `${titleCase(tag)} tag for Star Trek TNG season 2 retrieval and filtering.`,
    aliases: [],
    parents: [],
    sensitive: tag.startsWith('secret:') || tag.includes('spoiler'),
    deprecated: false,
    replacement: '',
  }]));
}

function collectEntities(entries) {
  const entities = new Map();
  for (const entry of entries) {
    for (const name of entry.scope.characters || []) {
      entities.set(`st:${slug(name)}`, {
        type: 'character',
        label: name,
        aliases: [name],
        canonicalNames: [name],
        tags: [tagId('character', name)],
      });
    }
    for (const name of entry.scope.factions || []) {
      entities.set(`st:${slug(name)}`, {
        type: 'faction',
        label: name,
        aliases: [name],
        canonicalNames: [name],
        tags: [tagId('faction', name)],
      });
    }
  }
  return Object.fromEntries([...entities.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, entity]) => [id, {
    ...entity,
    relationships: [],
    continuity: {
      continuityId: 'star-trek-prime',
      canonTier: 'primary',
      adaptation: 'television',
      medium: 'television',
      sourceBoundary: 'Star Trek: The Next Generation season 2.',
    },
    sourceInfo: {
      work: 'Star Trek: The Next Generation',
      confidence: 0.78,
    },
    extensions: {},
  }]));
}

function categoryCounts(entries) {
  const counts = {};
  for (const entry of entries) counts[entry.category] = (counts[entry.category] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function groupedEntries(entries) {
  const groups = new Map();
  for (const [index, entry] of entries.entries()) {
    const file = CARD_BLUEPRINTS[index].file;
    if (!groups.has(file)) groups.set(file, []);
    groups.get(file).push(entry);
  }
  return groups;
}

async function writeJson(relativePath, value) {
  const file = path.join(DECK_ROOT, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function assertSafeDeckRoot() {
  const resolvedRoot = path.resolve(ROOT);
  const resolvedDeckRoot = path.resolve(DECK_ROOT);
  const expected = path.resolve(ROOT, 'content/loredecks/star-trek-tng-season-2');
  if (resolvedDeckRoot !== expected || !resolvedDeckRoot.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to regenerate unexpected deck path: ${resolvedDeckRoot}`);
  }
}

async function updateIndex(manifest, tagCount, entityCount) {
  const indexPath = path.join(ROOT, 'content/loredecks/index.json');
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  const record = {
    packId: DECK_ID,
    manifest: `${DECK_ID}/loredeck.json`,
    type: 'bundled',
    title: manifest.title,
    description: manifest.description,
    library: manifest.library,
    entrySchemaVersion: 3,
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
  index.bundled = Array.isArray(index.bundled) ? index.bundled.filter(item => item.packId !== DECK_ID) : [];
  index.bundled.push(record);
  index.bundled.sort((left, right) => String(left.packId).localeCompare(String(right.packId)));
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

async function main() {
  const evidence = JSON.parse(await fs.readFile(EVIDENCE_PATH, 'utf8'));
  const records = evidence.episodes.filter(episode => episode.deckId === DECK_ID);
  if (records.length !== 22) throw new Error(`Expected 22 TNG season 2 Memory Alpha story rows, found ${records.length}.`);

  const anchors = buildAnchors(records);
  const episodeMap = new Map(anchors.map(anchor => [anchor.label, anchor]));
  const entries = CARD_BLUEPRINTS.map((card, index) => buildEntry(card, index, episodeMap, anchors));
  const groups = groupedEntries(entries);
  const files = [...groups.keys()];
  const tags = collectTags(entries, anchors);
  const entities = collectEntities(entries);
  const windows = [
    {
      id: 'tng.s2.full-season',
      label: 'TNG season 2 full window',
      anchorFrom: anchors[0].id,
      anchorTo: anchors[anchors.length - 1].id,
      sortKeyFrom: anchors[0].sortKey,
      sortKeyTo: anchors[anchors.length - 1].sortKey,
      aliases: ['TNG season 2', 'Star Trek The Next Generation season 2', 'TNG S2'],
      tags: BASE_TAGS,
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
  const timeline = {
    schemaVersion: 1,
    timelineMode: 'hybrid',
    defaultContextType: 'story_anchor',
    sortKeyScale: 'star_trek_24th_century',
    summary: 'Star Trek: The Next Generation season 2 Context anchors and episode windows.',
    axes: [
      { id: 'series', type: 'series', label: 'Series' },
      { id: 'season', type: 'season', label: 'Season' },
      { id: 'episode', type: 'episode', label: 'Episode' },
      { id: 'stardate', type: 'date', label: 'Stardate' },
    ],
    anchors,
    windows,
  };
  const resolver = {
    schemaVersion: 1,
    summary: 'Resolve Star Trek: The Next Generation season 2 Context from episode titles, story rows, runtime aliases, and common TNG S2 labels.',
    preferredFields: ['series', 'season', 'episode', 'stardate', 'beforeAfter', 'majorEvent'],
    ambiguousFallback: 'use_window',
    promptAddendum: 'Prefer TNG season 2 anchors and before/after windows. Do not infer later Star Trek events unless their Loredecks are loaded.',
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
  const manifest = {
    schemaVersion: 1,
    id: DECK_ID,
    type: 'bundled',
    title: 'Star Trek TNG Season 2',
    description: 'Draft season Loredeck for Pulaski and Guinan, Ten Forward, Data personhood, Moriarty, Klingon exchange, Q-forced Borg first contact, Picard artificial-heart vulnerability, and season 2 spoiler guards.',
    fandom: 'Star Trek',
    era: 'The Next Generation Season 2',
    contentKind: 'fandom',
    author: 'Saga',
    version: '0.1.0-dev',
    defaultLocale: 'en',
    generatedAt: '2026-06-17',
    databaseId: `saga.${DECK_ID}`,
    deckFamilyId: 'star-trek-tng-ds9-voy-seasons',
    family: {
      id: 'star-trek-tng-ds9-voy-seasons',
      title: 'Star Trek: TNG, DS9, and Voyager',
      role: 'season',
    },
    recommendedStack: [DECK_ID],
    library: {
      suggestedPath: ['Star Trek', 'The Next Generation'],
      familyOrder: 10,
    },
    tags: BASE_TAGS,
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
      sourceBoundary: 'Star Trek: The Next Generation season 2, Memory Alpha story rows 1-22, runtime episode aliases 1-22, primary on-screen Prime continuity. Excludes later TNG seasons, TNG films, DS9, Voyager, Picard-era material, beta canon, novels, comics, games, deleted scenes, production trivia, and fanon.',
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
      sagaSchemaMin: 3,
      sagaSchemaMax: 3,
    },
    stats: {
      entryCount: entries.length,
      categoryCounts: categoryCounts(entries),
      timelineAnchorCount: anchors.length,
      timelineWindowCount: windows.length,
      tagCount: Object.keys(tags).length,
      entityCount: Object.keys(entities).length,
    },
    license: {
      name: 'Draft fan reference data',
      notes: 'For local testing. Requires human canon review before reference release.',
    },
    health: {
      status: 'needs_review',
      notes: 'First-pass Star Trek TNG season 2 Loredeck generated from Saga authoring plan and Memory Alpha evidence artifacts.',
    },
    entrySchemaVersion: 3,
    updatedAt: UPDATED_AT,
  };

  assertSafeDeckRoot();
  await fs.rm(DECK_ROOT, { recursive: true, force: true });
  await fs.mkdir(DECK_ROOT, { recursive: true });
  await writeJson('loredeck.json', manifest);
  await writeJson('manifest.json', manifest);
  await writeJson('timeline.json', timeline);
  await writeJson('resolver.json', resolver);
  await writeJson('tags.json', { schemaVersion: 1, tags });
  await writeJson('entities.json', { schemaVersion: 1, entities });
  await writeJson('taxonomy.json', {
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
  await writeJson('gate-types.json', {
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
  await writeJson('scoring.json', {
    schemaVersion: 1,
    scoringProfiles: {
      default: {
        label: 'Star Trek TNG Season Default',
        contextBoost: 'medium',
        retrievalBias: 'topic_or_entity',
        notes: 'Prefer specific episode, character, faction, and technology topics over broad Star Trek keywords.',
      },
    },
  });

  for (const [file, group] of groups) {
    await writeJson(file, {
      schemaVersion: 3,
      entries: group,
    });
  }
  await updateIndex(manifest, Object.keys(tags).length, Object.keys(entities).length);
  console.log(JSON.stringify({
    deckId: DECK_ID,
    entries: entries.length,
    files: files.length,
    anchors: anchors.length,
    windows: windows.length,
    tags: Object.keys(tags).length,
    entities: Object.keys(entities).length,
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
