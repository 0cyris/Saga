import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const EVIDENCE_PATH = path.join(ROOT, 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json');
const DECK_ROOT = path.join(ROOT, 'content/loredecks/star-trek-tng-season-1');
const DECK_ID = 'star-trek-tng-season-1';
const UPDATED_AT = 1781740800000;
const COVER_ASSET_PATH = 'assets/cover.png';

const BASE_TAGS = [
  'fandom:star-trek',
  'continuity:star-trek-prime',
  'series:tng',
  'season:tng-s1',
  'structure:season-split-loredeck',
  'quality:draft-reference',
];

const EPISODE_FILE = 'episodes/season-1-episode-gates.json';
const CREW_FILE = 'crew/enterprise-d-crew-state.json';
const FACTION_FILE = 'factions/q-ferengi-klingons-romulans-starfleet.json';
const TECH_FILE = 'rules/technology-holodeck-and-anomalies.json';
const SECRET_FILE = 'secrets/reveal-and-future-guards.json';

const CARD_BLUEPRINTS = [
  c(CREW_FILE, 'picard-farpoint-command-baseline', 'Picard starts TNG as a controlled, formal Enterprise-D captain', 'At the Farpoint launch, Picard commands the new Enterprise-D with strict formality, strong Starfleet legal instincts, and a willingness to separate ship sections rather than expose civilians to Q.', 'Write Picard in TNG season 1 as controlled, formal, legally minded, and protective of the Enterprise-D crew and civilians. Do not import later warmth, Borg trauma, film-era action characterization, or Picard-era history.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Jean-Luc Picard'], ['Starfleet'], ['Enterprise-D launch', 'Picard command style', 'Farpoint mission']),
  c(CREW_FILE, 'riker-arrives-as-first-officer', 'Riker joins the Enterprise-D as Picard tests his command judgment', 'Riker arrives during the Farpoint mission as first officer, and Picard immediately treats his ability to protect the saucer section and challenge orders as part of the command test.', 'Use Riker as a newly arrived but confident first officer in early TNG season 1. He is ambitious, protective, tactically assertive, and still proving how he works with Picard.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['William Riker', 'Jean-Luc Picard'], ['Starfleet'], ['Riker first officer', 'Enterprise-D launch']),
  c(CREW_FILE, 'troi-riker-prior-bond', 'Troi and Riker already have an unresolved prior bond when the series opens', 'Troi and Riker are not strangers at Farpoint; their prior intimacy gives their professional interactions a private emotional undertone without making them a current couple.', 'When Troi and Riker interact in TNG season 1, preserve the prior bond and unresolved warmth while keeping them professional Starfleet officers aboard the Enterprise-D.', 'relationship', 'relationship_state', 'relationship_state', 'Encounter at Farpoint', ['Deanna Troi', 'William Riker'], ['Starfleet'], ['Troi Riker history', 'Imzadi', 'Enterprise-D crew relationships']),
  c(CREW_FILE, 'data-early-personhood-baseline', 'Data begins as a Starfleet officer seeking human understanding, not a human child', 'Data is already a competent lieutenant commander and operations officer, but he studies human idioms, humor, and social behavior because he lacks lived human intuition.', 'Write Data as precise, competent, curious, and socially literal in TNG season 1. Avoid infantilizing him; his humanity quest is a mature officer trying to understand behavior he cannot intuit.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Data'], ['Starfleet'], ['Data personhood', 'android officer', 'human behavior']),
  c(CREW_FILE, 'worf-security-klingon-baseline', 'Worf starts as a Starfleet Klingon officer balancing duty and heritage', 'Season 1 Worf is a Starfleet security officer whose Klingon identity informs his sense of honor, combat readiness, and discomfort with dishonorable conduct, but he serves Federation command.', 'Use Worf as a disciplined Starfleet officer with visible Klingon pride and martial instincts. Do not jump ahead to later family revelations, discommendation, Alexander, or Klingon High Council arcs.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Worf'], ['Starfleet', 'Klingon Empire'], ['Worf Klingon identity', 'security officer', 'Starfleet duty']),
  c(CREW_FILE, 'yar-security-baseline-before-death', 'Tasha Yar is the Enterprise-D security chief until Vagra II', 'Before Vagra II, Yar is the Enterprise-D security chief: direct, physically capable, shaped by a violent failed-colony childhood, and protective of ship safety.', 'Use Tasha Yar as active security chief only before Skin of Evil. Keep her direct, trauma-shaped, and duty-focused; after her death, use death-state cards instead.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Natasha Yar'], ['Starfleet'], ['Tasha Yar', 'security chief', 'Enterprise-D crew'], { validToEpisode: 'Skin Of Evil' }),
  c(CREW_FILE, 'beverly-wesley-family-state', 'Beverly and Wesley Crusher board with Jack Crusher already dead', 'Beverly Crusher serves as chief medical officer while raising Wesley, and Picard carries a quiet connection to the family through Jack Crusher rather than an openly resolved emotional history.', 'Keep Beverly and Wesley tied to Jack Crusher absence in TNG season 1. Use Picard family tension subtly; do not import later Picard-Beverly revelations or Wesley Traveler outcomes too early.', 'relationship', 'relationship_state', 'relationship_state', 'Encounter at Farpoint', ['Beverly Crusher', 'Wesley Crusher', 'Jean-Luc Picard'], ['Starfleet'], ['Crusher family', 'Jack Crusher', 'Picard Beverly Wesley']),
  c(CREW_FILE, 'geordi-conn-officer-baseline', 'Geordi begins season 1 as a conn officer, not chief engineer', 'In season 1, Geordi La Forge is primarily a conn officer and bridge problem-solver; his later chief-engineer status should not be imported into this deck.', 'Write Geordi in TNG season 1 as a bridge conn officer with technical aptitude, VISOR perspective, and growing competence, not yet the settled chief engineer of later seasons.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Geordi La Forge'], ['Starfleet'], ['Geordi season 1', 'conn officer', 'VISOR']),
  c(CREW_FILE, 'wesley-acting-ensign-boundary', 'Wesley is a gifted civilian youth before Picard grants him acting-ensign status', 'Wesley starts as Beverly Crusher\'s gifted son aboard the Enterprise-D; his access and authority change only after Picard grants acting-ensign status late in the season.', 'Before the acting-ensign window, keep Wesley brilliant but unofficial. After Coming of Age and the late-season bridge pattern, he can function as a provisional young officer under adult supervision.', 'character', 'character_state', 'knowledge_gate', 'Encounter at Farpoint', ['Wesley Crusher'], ['Starfleet'], ['Wesley Crusher', 'acting ensign', 'Starfleet Academy']),
  c(FACTION_FILE, 'enterprise-d-family-civilian-ship', 'The Enterprise-D is a family-bearing exploratory flagship', 'The Enterprise-D carries civilians and families as well as Starfleet personnel, which makes saucer separation, evacuation, and command risk different from a warship-only frame.', 'Treat the Enterprise-D as a large exploratory starship with families aboard. Command choices should account for civilian risk and diplomatic mission posture.', 'rule', 'lore_gate', 'rule', 'Encounter at Farpoint', ['Jean-Luc Picard', 'William Riker'], ['Starfleet'], ['Enterprise-D', 'civilians aboard', 'saucer separation']),

  c(FACTION_FILE, 'q-puts-humanity-on-trial', 'Q frames the Farpoint mission as a trial of humanity', 'Q does not merely harass the Enterprise at Farpoint; he places humanity on trial and uses Picard as the representative case for whether humans remain savage.', 'When Q appears in TNG season 1, frame him as an adversarial judge testing humanity and Picard, not yet a familiar trickster or mentor figure.', 'event', 'reveal_gate', 'knowledge_gate', 'Encounter at Farpoint', ['Q', 'Jean-Luc Picard'], ['Q Continuum'], ['Q trial', 'Humanity on Trial', 'Farpoint']),
  c(FACTION_FILE, 'farpoint-lifeform-revealed', 'Farpoint Station is tied to captive spaceborne lifeforms', 'The Farpoint mystery resolves when the crew discovers the station depends on a captive shape-changing spaceborne lifeform and its mate is attacking to free it.', 'For Farpoint-era scenes, treat the station mystery as a moral test about exploitation and recognition of non-humanoid life, not a conventional military threat.', 'event', 'knowledge_gate', 'knowledge_gate', 'Encounter at Farpoint', ['Jean-Luc Picard', 'William Riker', 'Q'], ['Starfleet'], ['Farpoint Station', 'spaceborne lifeform', 'Q trial']),
  c(FACTION_FILE, 'q-power-scale-season-one', 'Q can overpower the Enterprise-D through courtroom reality shifts', 'At Farpoint and Hide and Q, Q demonstrates reality-warping power far beyond Enterprise-D defenses, including forced transport, historical staging, and impossible tests.', 'Use Q power in season 1 as overwhelming and theatrical. Starfleet cannot fight him conventionally; Picard and crew respond through ethics, refusal, and judgment.', 'rule', 'lore_gate', 'rule', 'Hide And Q', ['Q', 'Jean-Luc Picard', 'William Riker'], ['Q Continuum', 'Starfleet'], ['Q powers', 'reality manipulation', 'Humanity on Trial']),
  c(FACTION_FILE, 'riker-rejects-q-power', 'Riker rejects Q-granted power after seeing its moral cost', 'In Hide and Q, Riker receives Q-like power but loses the crew\'s trust when gifts become coercive, and he ultimately rejects the offer.', 'If Riker is tempted by power in TNG season 1, use Hide and Q as the boundary: he learns that imposed miracles and superiority damage trust and command integrity.', 'character', 'character_state', 'relationship_state', 'Hide And Q', ['William Riker', 'Q'], ['Q Continuum', 'Starfleet'], ['Riker Q powers', 'temptation', 'command ethics']),
  c(SECRET_FILE, 'q-future-guard-before-later-q-arcs', 'Season 1 Q cards must not import later Q relationship beats', 'By the end of season 1, Q has tested the crew twice but has not yet introduced the Borg, lost his powers, or developed his later pattern with Picard.', 'Do not import Q Who, Deja Q, Tapestry, All Good Things, Voyager Q material, or later Q Continuum politics into season 1 scenes.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Hide And Q', ['Q', 'Jean-Luc Picard'], ['Q Continuum'], ['Q future guard', 'spoiler boundary', 'later Q arcs']),

  c(EPISODE_FILE, 'polywater-intoxication-crew-disruption', 'Polywater intoxication temporarily disrupts the Enterprise crew in The Naked Now', 'The Naked Now exposes the Enterprise-D crew to a Psi 2000-style intoxication that lowers inhibitions and threatens ship control without creating durable romance or competence changes.', 'Use the polywater incident as episode-local disinhibition and danger. Do not turn intoxicated behavior into stable characterization after the episode window closes.', 'event', 'anchor_window', 'event_moment', 'The Naked Now', ['Data', 'Natasha Yar', 'Jean-Luc Picard'], ['Starfleet'], ['polywater intoxication', 'The Naked Now', 'crew inhibition']),
  c(EPISODE_FILE, 'ligonian-vaccine-diplomacy', 'Code of Honor centers on vaccine diplomacy under cultural pressure', 'The Ligon II mission is valuable because Styris IV needs vaccine, forcing Picard to manage diplomacy while Yar is pulled into Ligonian power ritual.', 'Keep Code of Honor facts local: the durable gate is Picard balancing medical urgency against local political customs and Yar\'s safety.', 'event', 'anchor_window', 'event_moment', 'Code of Honor', ['Jean-Luc Picard', 'Natasha Yar'], ['Starfleet'], ['Ligon II', 'vaccine diplomacy', 'Tasha Yar']),
  c(FACTION_FILE, 'ferengi-first-major-contact', 'The Last Outpost establishes the Ferengi as a known but poorly understood rival power', 'At Delphi Ardu, the Enterprise-D crew treats the Ferengi as a significant rival they know mostly through reputation, not yet as the later comic-commercial baseline.', 'In season 1, write Ferengi encounters as uncertain and adversarial. Do not import Quark, Rules of Acquisition depth, or DS9 Ferengi family politics.', 'faction', 'reveal_gate', 'faction', 'The Last Outpost', ['Jean-Luc Picard', 'Data'], ['Ferengi Alliance', 'Starfleet'], ['Ferengi first contact', 'Delphi Ardu', 'Tkon outpost']),
  c(FACTION_FILE, 'tkon-portal-tests-both-crews', 'The Tkon Portal reframes the Ferengi standoff as an ancient test', 'The Ferengi standoff at Delphi Ardu is resolved only when the Tkon Portal judges the crews, shifting the conflict from simple enemy action to an ancient automated test.', 'Use the Tkon Portal as an episode-local ancient-power gate. It should not become recurring TNG technology unless specifically referenced.', 'event', 'anchor_window', 'event_moment', 'The Last Outpost', ['Data', 'Jean-Luc Picard'], ['Ferengi Alliance', 'Starfleet'], ['Tkon Empire', 'Portal 63', 'Ferengi standoff']),
  c(TECH_FILE, 'traveler-warp-thought-link', 'The Traveler links warp travel with thought and perception', 'Where No One Has Gone Before shows the Traveler amplifying the Enterprise beyond normal space, where thought and reality interact in ways Starfleet does not understand.', 'Use the Traveler incident as a rare space-thought anomaly. Do not generalize it into routine warp capability or reveal later Wesley outcomes before their windows.', 'rule', 'lore_gate', 'rule', 'Where No One Has Gone Before', ['The Traveler', 'Wesley Crusher', 'Jean-Luc Picard'], ['Starfleet'], ['Traveler', 'warp thought', 'Wesley aptitude']),
  c(CREW_FILE, 'wesley-traveler-potential-seed', 'The Traveler identifies unusual potential in Wesley', 'The Traveler notices Wesley Crusher\'s unusual insight during the warp experiment, planting a season 1 seed without yet making Wesley a Starfleet officer or Traveler initiate.', 'After Where No One Has Gone Before, Wesley can be treated as unusually gifted in a way a few adults notice. Do not jump ahead to later Traveler departure arcs.', 'character', 'reveal_gate', 'knowledge_gate', 'Where No One Has Gone Before', ['Wesley Crusher', 'The Traveler'], ['Starfleet'], ['Wesley potential', 'Traveler', 'genius youth']),
  c(EPISODE_FILE, 'lonely-among-us-possession-diplomacy', 'Lonely Among Us combines diplomatic escort duty with alien possession risk', 'The Enterprise is escorting Antican and Selay delegates when an energy being begins moving through ship systems and Picard, making the mission a command-contamination case.', 'Use Lonely Among Us as an episode-local possession and diplomacy case. Do not treat Antican/Selay details as broad recurring politics unless directly invoked.', 'event', 'anchor_window', 'event_moment', 'Lonely Among Us', ['Jean-Luc Picard', 'Data'], ['Starfleet'], ['Antican', 'Selay', 'alien possession']),
  c(EPISODE_FILE, 'edo-law-prime-directive-pressure', 'Justice tests Starfleet ethics against absolute local law', 'On Rubicun III, Wesley\'s accidental violation of Edo law creates a death-penalty crisis that Picard resolves by challenging blind obedience to local law and superior beings.', 'Use Justice as a Prime Directive and legal-ethics gate: Picard weighs local law, Starfleet duty, and proportional justice rather than treating rules as automatic.', 'rule', 'lore_gate', 'rule', 'Justice', ['Jean-Luc Picard', 'Wesley Crusher'], ['Starfleet'], ['Edo law', 'Prime Directive', 'death penalty']),
  c(EPISODE_FILE, 'stargazer-past-and-bok-revenge', 'The Battle exposes Picard\'s Stargazer past and Bok\'s revenge plot', 'DaiMon Bok uses the recovered Stargazer and the Battle of Maxia history to attack Picard psychologically, making Picard\'s pre-Enterprise command past active season 1 lore.', 'When Picard\'s past command is relevant in season 1, use the Stargazer and Maxia as known history. Keep Bok revenge local unless another Ferengi plot invokes it.', 'character', 'knowledge_gate', 'character_snapshot', 'The Battle', ['Jean-Luc Picard', 'Bok'], ['Ferengi Alliance', 'Starfleet'], ['USS Stargazer', 'Battle of Maxia', 'Bok revenge']),
  c(TECH_FILE, 'picard-maneuver-established', 'The Picard Maneuver is a known tactical legacy from Stargazer command', 'The Battle identifies the Picard Maneuver as a past warp-tactical trick associated with Picard and the Stargazer, not an Enterprise-D standard attack pattern.', 'Use the Picard Maneuver as a specific legacy tactic from Stargazer history. Do not make it a routine Enterprise-D combat solution.', 'rule', 'lore_gate', 'rule', 'The Battle', ['Jean-Luc Picard'], ['Starfleet'], ['Picard Maneuver', 'Stargazer', 'warp tactic']),
  c(EPISODE_FILE, 'troi-arranged-marriage-haven', 'Haven establishes Troi family obligations and Lwaxana pressure', 'Haven shows Deanna Troi bound by an old arranged-marriage contract while Lwaxana Troi publicly pressures the situation aboard the Enterprise.', 'Use Haven for Troi family/social obligation scenes: Deanna balances personal autonomy, Betazoid family pressure, and professionalism.', 'relationship', 'relationship_state', 'relationship_state', 'Haven', ['Deanna Troi', 'Lwaxana Troi', 'William Riker'], ['Starfleet'], ['Troi family', 'arranged marriage', 'Haven']),
  c(EPISODE_FILE, 'tarelian-plague-ship-boundary', 'Haven uses the Tarellian ship as a plague quarantine problem', 'The Tarellian vessel in Haven matters as a quarantine and compassion dilemma, not as a recurring galactic faction baseline.', 'Keep Tarellian plague-ship details local to Haven unless the scene directly invokes plague quarantine, Haven, or Wyatt Miller.', 'event', 'anchor_window', 'event_moment', 'Haven', ['Deanna Troi'], ['Starfleet'], ['Tarellian plague ship', 'Haven', 'quarantine']),
  c(TECH_FILE, 'dixon-hill-holodeck-danger', 'The Big Goodbye proves holodeck fiction can become operationally dangerous', 'The Dixon Hill malfunction traps Picard and guests in a program where safety assumptions break down, making holodeck risk a practical Enterprise-D rule.', 'Use early TNG holodeck scenes with caution: fictional settings can trap or endanger users when ship systems fail. Do not treat holodeck danger as impossible just because it is simulated.', 'rule', 'lore_gate', 'rule', 'The Big Goodbye', ['Jean-Luc Picard'], ['Starfleet'], ['Dixon Hill', 'holodeck safety', 'The Big Goodbye']),
  c(CREW_FILE, 'picard-dixon-hill-interest', 'Picard has an active Dixon Hill detective-fiction interest', 'The Big Goodbye establishes Picard\'s Dixon Hill program as a personal leisure interest, useful for his private tastes but not a command personality replacement.', 'Picard can enjoy Dixon Hill noir scenarios in season 1. Keep it as a personal hobby and occasional holodeck context, not his default command voice.', 'character', 'character_state', 'character_snapshot', 'The Big Goodbye', ['Jean-Luc Picard'], ['Starfleet'], ['Dixon Hill', 'Picard hobby', 'holodeck']),
  c(SECRET_FILE, 'lore-revealed-as-data-brother', 'Datalore reveals Lore as Data\'s dangerous Soong-type brother', 'On Omicron Theta, the crew discovers Lore: another Soong-type android with Data\'s face, emotional manipulation, and a lethal alliance with the Crystalline Entity.', 'After Datalore, Lore is known as Data\'s dangerous android brother. Do not import later Lore returns or Soong family expansions into season 1.', 'secret', 'reveal_gate', 'knowledge_gate', 'Datalore', ['Data', 'Lore'], ['Starfleet'], ['Lore', 'Soong-type android', 'Data brother']),
  c(SECRET_FILE, 'data-omicron-theta-origin', 'Datalore ties Data to Omicron Theta and the colony disaster', 'Datalore confirms Data was found on Omicron Theta after a colony catastrophe linked to the Crystalline Entity, leaving his origin partially known but not fully resolved.', 'Use Data\'s season 1 origin as Omicron Theta, Soong-type construction, and unresolved colony-loss history. Do not reveal later Soong details before their seasons.', 'knowledge', 'reveal_gate', 'knowledge_gate', 'Datalore', ['Data', 'Lore'], ['Starfleet'], ['Omicron Theta', 'Crystalline Entity', 'Data origin']),
  c(SECRET_FILE, 'crystalline-entity-season-one-boundary', 'The Crystalline Entity is a known threat after Datalore but unresolved in season 1', 'After Datalore, the crew knows the Crystalline Entity devastated Omicron Theta and can threaten worlds, but season 1 does not resolve the Entity\'s nature or fate.', 'Keep Crystalline Entity facts unresolved in season 1. Do not import later Silicon Avatar conclusions or moral framing.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Datalore', ['Data', 'Lore'], ['Starfleet'], ['Crystalline Entity', 'future guard', 'Omicron Theta']),
  c(EPISODE_FILE, 'angel-one-survivors-local-politics', 'Angel One is an episode-local gender-politics and survivor dispute', 'Angel One centers on Odin survivors living under Angel I gender politics and should not become a broad Federation political baseline.', 'Use Angel One only when the scene invokes Angel I, the Odin survivors, or local gendered power customs. Keep it narrow.', 'event', 'anchor_window', 'event_moment', 'Angel One', ['William Riker', 'Jean-Luc Picard'], ['Starfleet'], ['Angel I', 'Odin survivors', 'local politics']),
  c(TECH_FILE, 'bynars-steal-enterprise-for-planetary-repair', '11001001 establishes Bynars as computer-linked specialists with desperate motives', 'The Bynars hijack the Enterprise to save their homeworld computer system, making them a high-competence cybernetic culture rather than ordinary saboteurs.', 'When Bynars appear in season 1 context, write them as computer-dependent specialists whose deception is tied to survival of their planetary system.', 'faction', 'knowledge_gate', 'faction', '11001001', ['Jean-Luc Picard', 'William Riker'], ['Bynars', 'Starfleet'], ['Bynars', 'Enterprise hijack', 'computer repair']),
  c(TECH_FILE, 'minuet-holodeck-social-sophistication', 'Minuet shows the holodeck can create socially persuasive simulated people', 'Minuet is convincing enough to emotionally affect Riker, making the 11001001 holodeck incident a social-simulation gate as well as a ship-control plot.', 'Use Minuet as an early sign of holodeck social sophistication. Do not treat her as a free-standing person beyond this episode-local program context.', 'rule', 'lore_gate', 'rule', '11001001', ['William Riker', 'Jean-Luc Picard'], ['Starfleet', 'Bynars'], ['Minuet', 'holodeck simulation', 'Bynars']),
  c(EPISODE_FILE, 'jameson-youth-drug-secret', 'Too Short a Season centers on Admiral Jameson hiding his de-aging drug use', 'Admiral Mark Jameson secretly uses an alien drug to reverse aging before the Mordan IV hostage crisis, creating a command-trust and medical-risk gate.', 'Use Jameson as an episode-local warning: hidden medical manipulation and old political guilt destabilize command credibility.', 'secret', 'reveal_gate', 'knowledge_gate', 'Too Short A Season', ['Mark Jameson', 'Jean-Luc Picard'], ['Starfleet'], ['Mark Jameson', 'de-aging drug', 'Mordan IV']),
  c(EPISODE_FILE, 'aldea-children-abduction', 'When The Bough Breaks makes Aldea a child-abduction and infertility crisis', 'Aldea abducts Enterprise children because its society is sterile, turning a mythical advanced world into a coercive survival problem.', 'Use Aldea facts only for child abduction, infertility, planetary shield, and advanced isolation context. Keep it episode-local.', 'event', 'anchor_window', 'event_moment', 'When The Bough Breaks', ['Wesley Crusher', 'Jean-Luc Picard'], ['Starfleet'], ['Aldea', 'children abducted', 'sterility crisis']),
  c(EPISODE_FILE, 'home-soil-inorganic-life', 'Home Soil recognizes inorganic microbrain life as sentient', 'The Velara III terraforming crisis reveals inorganic microbrain life that the colonists had not recognized as sentient, forcing Starfleet to stop treating the site as empty matter.', 'Use Home Soil as a life-recognition gate: unknown non-organic intelligence can invalidate ordinary terraforming assumptions.', 'rule', 'lore_gate', 'rule', 'Home Soil', ['Jean-Luc Picard', 'Data'], ['Starfleet'], ['Velara III', 'microbrain', 'terraforming ethics']),
  c(CREW_FILE, 'wesley-academy-exam-context', 'Coming of Age places Wesley in a Starfleet Academy entrance-test context', 'Wesley competes for Starfleet Academy admission at Relva VII and does not simply become a normal cadet in season 1.', 'Use Coming of Age for Wesley\'s ambition and testing pressure. Do not make him a full Academy cadet after this episode.', 'character', 'character_state', 'knowledge_gate', 'Coming of Age', ['Wesley Crusher'], ['Starfleet'], ['Starfleet Academy', 'Relva VII', 'Wesley exam']),
  c(SECRET_FILE, 'remmick-audit-foreshadows-starfleet-conspiracy', 'Coming of Age sets up unease inside Starfleet before Conspiracy', 'Remmick\'s inspection and Quinn\'s warning make Starfleet internal suspicion active before the parasite reveal, without yet exposing the enemy.', 'Before Conspiracy, portray Starfleet Command suspicion as unresolved and procedural. Do not reveal the parasite infiltration early.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Coming of Age', ['Jean-Luc Picard', 'Gregory Quinn', 'Remmick'], ['Starfleet'], ['Remmick audit', 'Starfleet suspicion', 'Conspiracy setup'], { validToEpisode: 'Conspiracy' }),
  c(FACTION_FILE, 'worf-klingon-death-ritual', 'Heart of Glory establishes Worf performing a Klingon death howl', 'After Korris dies, Worf performs a Klingon death ritual, showing that his Starfleet service has not erased Klingon spiritual and warrior customs.', 'Use Heart of Glory to give Worf Klingon cultural depth in season 1. Keep it tied to honor, death, and identity rather than generic aggression.', 'character', 'character_state', 'behavior_constraint', 'Heart of Glory', ['Worf', 'Korris'], ['Klingon Empire', 'Starfleet'], ['Klingon death ritual', 'Worf heritage', 'Heart of Glory']),
  c(FACTION_FILE, 'klingon-fugitives-vs-starfleet-worf', 'Heart of Glory tests Worf against Klingon fugitives who reject peace', 'Korris and the other Klingon fugitives pressure Worf with warrior nostalgia, but Worf chooses Starfleet duty over their violent path.', 'When Worf faces Klingon identity pressure in season 1, keep his loyalty with Starfleet. He values Klingon honor but rejects undisciplined violence.', 'faction', 'knowledge_gate', 'faction', 'Heart of Glory', ['Worf', 'Korris'], ['Klingon Empire', 'Starfleet'], ['Klingon fugitives', 'Worf loyalty', 'Federation-Klingon peace']),
  c(TECH_FILE, 'geordi-command-arsenal', 'The Arsenal of Freedom gives Geordi a command-pressure episode', 'On Minos, Geordi commands the Enterprise during a crisis while senior officers are trapped below, showing early command competence before his engineering promotion era.', 'Use Arsenal of Freedom for season 1 Geordi competence under pressure. Do not conflate it with later chief-engineer authority.', 'character', 'character_state', 'character_snapshot', 'The Arsenal of Freedom', ['Geordi La Forge'], ['Starfleet'], ['Geordi command', 'Minos', 'Arsenal of Freedom']),
  c(TECH_FILE, 'minos-weapons-system-adapts', 'The Minos arsenal is an adaptive automated weapons-sales system', 'The Minos system keeps escalating because it is an automated arms demonstration built to adapt against buyers and intruders.', 'Use Minos as an episode-local adaptive weapon rule. Do not generalize it into recurring Federation technology.', 'rule', 'lore_gate', 'rule', 'The Arsenal of Freedom', ['Jean-Luc Picard', 'Geordi La Forge'], ['Starfleet'], ['Minos', 'adaptive weapon', 'arms merchant']),
  c(EPISODE_FILE, 'symbiosis-drug-exploitation', 'Symbiosis reveals an interplanetary addiction economy', 'The Ornaran-Brekkian trade depends on Brekka maintaining Ornaran addiction and false medical dependence, giving Picard a noninterference dilemma.', 'Use Symbiosis as a Prime Directive and exploitation gate: Picard can expose truth indirectly but avoids simply taking over another society.', 'rule', 'lore_gate', 'rule', 'Symbiosis', ['Jean-Luc Picard', 'Beverly Crusher'], ['Starfleet'], ['Ornara', 'Brekka', 'drug exploitation']),
  c(SECRET_FILE, 'tasha-yar-dies-on-vagra-ii', 'Skin of Evil kills Tasha Yar and changes the security roster', 'Tasha Yar dies on Vagra II after Armus attacks her, making her death a durable Enterprise-D crew-state change rather than an episode-local injury.', 'After Skin of Evil, do not write Yar as alive in ordinary Enterprise-D scenes. Use grief, memorial, and Worf/security transition cards instead.', 'event', 'reveal_gate', 'event_moment', 'Skin Of Evil', ['Natasha Yar', 'Worf', 'Deanna Troi'], ['Starfleet'], ['Tasha Yar death', 'Vagra II', 'Armus']),
  c(SECRET_FILE, 'worf-security-role-after-yar', 'Worf becomes the practical security lead after Yar dies', 'After Yar\'s death, Worf moves into the security-chief function aboard the Enterprise-D, changing his day-to-day bridge and away-team role.', 'After Skin of Evil, use Worf as the Enterprise-D security lead. Do not imply this was his settled role before Yar died.', 'character', 'character_state', 'character_snapshot', 'Skin Of Evil', ['Worf', 'Natasha Yar'], ['Starfleet'], ['Worf security chief', 'Yar death', 'crew status']),
  c(SECRET_FILE, 'yar-memorial-message-boundary', 'Yar leaves a personal memorial message for the crew', 'Yar\'s memorial message gives the crew emotional closure and confirms her chosen bonds aboard the Enterprise-D after a sudden death.', 'Use Yar\'s memorial as grief-state context after Skin of Evil. Avoid later alternate-timeline or Sela material in this season 1 deck.', 'relationship', 'relationship_state', 'relationship_state', 'Skin Of Evil', ['Natasha Yar', 'Data', 'Jean-Luc Picard'], ['Starfleet'], ['Yar memorial', 'crew grief', 'Data Yar']),
  c(SECRET_FILE, 'armus-local-threat-only', 'Armus is a Vagra II local threat, not a recurring season villain', 'Armus kills Yar and traps Troi, but season 1 leaves him as a contained Vagra II entity rather than an active recurring antagonist.', 'Use Armus only when Vagra II, Yar\'s death, or Troi\'s captivity are directly relevant. Do not turn him into a broad villain presence.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Skin Of Evil', ['Armus', 'Deanna Troi', 'Natasha Yar'], ['Starfleet'], ['Armus', 'Vagra II', 'Yar death']),
  c(EPISODE_FILE, 'paris-time-experiment-local', 'We\'ll Always Have Paris is a local time-distortion and Picard-past episode', 'The Manheim experiment creates time distortions while Picard confronts old regret with Jenice Manheim, but it does not alter the season timeline beyond the episode.', 'Use this episode for local time echoes and Picard personal history only. Do not create broad temporal mechanics from Manheim\'s experiment.', 'event', 'anchor_window', 'event_moment', "We'll Always Have Paris", ['Jean-Luc Picard'], ['Starfleet'], ['Manheim effect', 'Picard old romance', 'time distortion']),
  c(SECRET_FILE, 'starfleet-parasite-infiltration-revealed', 'Conspiracy reveals alien parasites inside Starfleet Command', 'Conspiracy confirms that the earlier Starfleet unease was caused by neural parasites infiltrating senior officers at Starfleet Command.', 'After Conspiracy, the parasite infiltration is known and violently exposed. Before Conspiracy, keep the threat as suspicion only.', 'secret', 'reveal_gate', 'knowledge_gate', 'Conspiracy', ['Jean-Luc Picard', 'William Riker'], ['Starfleet'], ['Starfleet parasites', 'Conspiracy', 'alien infiltration']),
  c(SECRET_FILE, 'conspiracy-signal-unresolved-guard', 'The parasite signal remains an unresolved thread after Conspiracy', 'After the parasite queen is destroyed, a signal is sent into deep space, leaving a threat thread unresolved without giving season 1 a later answer.', 'Keep the post-Conspiracy signal unresolved in season 1. Do not invent or import a later answer unless a future deck explicitly handles it.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Conspiracy', ['Jean-Luc Picard', 'William Riker'], ['Starfleet'], ['parasite signal', 'future guard', 'Conspiracy']),
  c(FACTION_FILE, 'romulans-return-neutral-zone', 'The Neutral Zone marks the Romulans returning to active contact', 'The Romulans reappear along the Neutral Zone after a long silence, with both sides aware that outposts have been destroyed by an unknown force.', 'After The Neutral Zone, Romulan contact is active again but cautious. Do not import later Sela, reunification, or Dominion-era Romulan politics.', 'faction', 'reveal_gate', 'faction', 'The Neutral Zone', ['Jean-Luc Picard', 'Worf'], ['Romulan Star Empire', 'Starfleet'], ['Romulan return', 'Neutral Zone', 'outpost destruction']),
  c(FACTION_FILE, 'unknown-outpost-destruction-no-borg-name-yet', 'Season 1 knows Neutral Zone outposts were destroyed but not the Borg explanation', 'The Neutral Zone leaves destroyed outposts as an unknown threat shared by Federation and Romulan observers; the Borg connection is not season 1 knowledge.', 'For season 1 scenes after The Neutral Zone, characters may know outposts vanished or were destroyed, but they should not identify the Borg yet.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Neutral Zone', ['Jean-Luc Picard'], ['Romulan Star Empire', 'Starfleet'], ['Neutral Zone mystery', 'Borg future guard', 'outpost destruction']),
  c(EPISODE_FILE, 'twentieth-century-survivors-culture-contrast', 'The Neutral Zone uses revived 20th-century humans as a culture-contrast gate', 'The cryonically revived humans let Picard contrast 20th-century money and status assumptions with 24th-century Federation values.', 'Use the revived 20th-century humans for culture contrast and Federation social values. Keep them episode-local unless directly invoked.', 'knowledge', 'knowledge_gate', 'knowledge_gate', 'The Neutral Zone', ['Jean-Luc Picard', 'Data'], ['Starfleet'], ['20th-century survivors', 'Federation values', 'cryonics']),

  c(CREW_FILE, 'picard-diplomacy-over-force-season-one', 'Season 1 Picard usually seeks legal and diplomatic solutions before force', 'Across season 1, Picard repeatedly treats first contact, local law, unknown life, and hostile powers as problems for judgment before weapons.', 'When no narrower card overrides it, write season 1 Picard as diplomacy-first and law-aware, but still capable of decisive defensive action.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Jean-Luc Picard'], ['Starfleet'], ['Picard diplomacy', 'command baseline', 'season 1'], { wide: true }),
  c(CREW_FILE, 'riker-away-team-and-risk-posture', 'Riker is the active away-team risk taker under Picard', 'Season 1 often uses Riker as the senior officer who enters risky field situations while Picard preserves command perspective from the Enterprise.', 'Use Riker as bold and physically present in away-team danger, while Picard holds strategic command unless the episode specifically places him at risk.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['William Riker', 'Jean-Luc Picard'], ['Starfleet'], ['Riker away team', 'first officer', 'command risk'], { wide: true }),
  c(CREW_FILE, 'troi-empathic-counselor-constraint', 'Troi senses emotions but does not provide omniscient truth', 'Season 1 Troi can read emotional states and deception pressure, but her empathic impressions are partial and can be overwhelmed by alien or artificial situations.', 'Use Troi as an empathic counselor, not a lie detector or telepathic narrator. Her impressions should guide suspicion, comfort, and diplomacy without solving every mystery.', 'character', 'character_state', 'rule', 'Encounter at Farpoint', ['Deanna Troi'], ['Starfleet'], ['Troi empathy', 'counselor', 'Betazoid'], { wide: true }),
  c(CREW_FILE, 'data-literalism-and-competence', 'Data combines literal social reading with exceptional technical competence', 'Season 1 Data may miss idioms or emotional subtext, but he is consistently capable with operations, analysis, strength, and fast problem solving.', 'Balance Data\'s literalism with competence. Do not make social naivete erase his rank, speed, strength, or operational reliability.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Data'], ['Starfleet'], ['Data competence', 'literalism', 'operations'], { wide: true }),
  c(CREW_FILE, 'beverly-medical-ethics-season-one', 'Beverly Crusher often challenges command when medical ethics require it', 'Season 1 Beverly is willing to push Picard or mission constraints when patient welfare, quarantine, addiction, or sentient-life recognition is at stake.', 'Use Beverly as warm but professionally forceful. Medical ethics can put her in principled tension with command decisions.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Beverly Crusher', 'Jean-Luc Picard'], ['Starfleet'], ['Beverly medical ethics', 'chief medical officer', 'Picard']),
  c(CREW_FILE, 'wesley-brilliance-with-boundaries', 'Wesley is brilliant but still a child under adult authority', 'Season 1 lets Wesley notice technical solutions and patterns, but adults still control access, discipline, and command authority.', 'Write Wesley as gifted and eager, with credible technical insight, but keep age, permissions, and adult supervision active.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Wesley Crusher'], ['Starfleet'], ['Wesley brilliance', 'child aboard', 'adult authority'], { wide: true }),
  c(CREW_FILE, 'yar-trauma-informed-security', 'Yar\'s failed-colony past informs her security posture before death', 'Before Skin of Evil, Yar\'s directness and protective instincts are tied to survival in a violent failed-colony environment, not generic aggression.', 'When Yar is alive in season 1, write her security style as trauma-informed, direct, protective, and professional.', 'character', 'character_state', 'behavior_constraint', 'Encounter at Farpoint', ['Natasha Yar'], ['Starfleet'], ['Tasha Yar trauma', 'security chief', 'failed colony'], { validToEpisode: 'Skin Of Evil' }),
  c(CREW_FILE, 'geordi-visor-perspective', 'Geordi\'s VISOR gives him a different sensory relationship to environments', 'Season 1 Geordi can perceive energy and visual spectra through his VISOR in ways other officers cannot, making him useful in anomalies and technical observation.', 'Use Geordi\'s VISOR as a practical sensory tool and lived difference. Avoid later ocular implant or chief-engineer assumptions.', 'character', 'character_state', 'rule', 'Encounter at Farpoint', ['Geordi La Forge'], ['Starfleet'], ['Geordi VISOR', 'sensory perception', 'technical observation'], { wide: true }),
  c(FACTION_FILE, 'federation-first-contact-ethic-season-one', 'Season 1 Federation contact favors recognition of unfamiliar sentience', 'Farpoint, Home Soil, and Justice all reinforce that the Enterprise-D should identify unfamiliar life and moral agency before imposing simple threat categories.', 'Use this as a season-level Federation ethic: unknown life, alien law, and nonhuman intelligence require investigation and restraint before force.', 'rule', 'lore_gate', 'rule', 'Home Soil', ['Jean-Luc Picard'], ['Starfleet', 'United Federation of Planets'], ['Federation ethics', 'sentience recognition', 'Prime Directive'], { wide: true }),
  c(FACTION_FILE, 'starfleet-command-can-be-politically-vulnerable', 'Season 1 Starfleet Command can be infiltrated or politically compromised', 'Coming of Age and Conspiracy establish that Starfleet institutions are not immune to paranoia, audit pressure, or alien infiltration.', 'Use Starfleet as principled but vulnerable in season 1. Do not make command automatically clean or automatically corrupt; gate parasite knowledge by Conspiracy.', 'faction', 'knowledge_gate', 'faction', 'Conspiracy', ['Jean-Luc Picard'], ['Starfleet'], ['Starfleet Command', 'Remmick audit', 'parasite infiltration']),
  c(FACTION_FILE, 'federation-klingon-peace-context', 'Klingons are not Federation enemies in season 1', 'Heart of Glory depends on a Federation-Klingon peace context: Worf serves in Starfleet, and Klingon fugitives are the problem, not the whole Empire.', 'For TNG season 1, avoid TOS-style default Federation-Klingon war framing. Klingon identity and warrior culture remain active, but open war is not the baseline.', 'faction', 'knowledge_gate', 'faction', 'Heart of Glory', ['Worf'], ['Klingon Empire', 'Starfleet'], ['Klingon peace', 'Worf Starfleet', 'Heart of Glory'], { wide: true }),
  c(FACTION_FILE, 'romulan-silence-before-neutral-zone', 'Before The Neutral Zone, Romulans are mostly a historical absence', 'Season 1 should not treat active Romulan politics as known until The Neutral Zone brings Romulan contact back into focus.', 'Before The Neutral Zone, keep Romulans as a historical or border concern, not an active recurring presence. Afterward, cautious contact resumes.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Neutral Zone', ['Jean-Luc Picard'], ['Romulan Star Empire', 'Starfleet'], ['Romulan absence', 'Neutral Zone', 'spoiler guard'], { validToEpisode: 'The Neutral Zone' }),
  c(TECH_FILE, 'holodeck-season-one-capability-boundary', 'Season 1 holodecks can be immersive but remain failure-prone', 'The Big Goodbye and 11001001 establish highly immersive holodeck characters and environments while also showing safety and control failures.', 'Use season 1 holodecks as convincing and useful but not perfectly safe. Do not import later Moriarty sentience or Vic Fontaine-style social permanence.', 'rule', 'lore_gate', 'rule', 'The Big Goodbye', ['Jean-Luc Picard', 'William Riker'], ['Starfleet'], ['holodeck capability', 'Dixon Hill', 'Minuet'], { wide: true }),
  c(TECH_FILE, 'transporter-and-pattern-risk-locality', 'Transporter events can solve crises but should stay episode-specific', 'Season 1 uses transporters in medical, possession, and crisis resolutions, but those solutions depend on local conditions rather than universal miracle repair.', 'Do not use the transporter as a generic reset button. Tie transporter fixes to the specific episode science and constraints.', 'rule', 'lore_gate', 'rule', 'Lonely Among Us', ['Data', 'Beverly Crusher'], ['Starfleet'], ['transporter limits', 'episode science', 'pattern risk'], { wide: true }),
  c(TECH_FILE, 'prime-directive-not-simple-noninterference', 'Season 1 treats the Prime Directive as judgment, not passivity', 'Justice, Symbiosis, and Home Soil show Picard weighing noninterference against proportionality, truth, and recognition of sentience.', 'Write Prime Directive scenes as command judgment under constraints. Picard may refuse direct rule-breaking while still seeking ethical ways to reduce harm.', 'rule', 'lore_gate', 'rule', 'Justice', ['Jean-Luc Picard'], ['Starfleet'], ['Prime Directive', 'noninterference', 'ethical command'], { wide: true }),
  c(SECRET_FILE, 'no-borg-before-q-who', 'TNG season 1 must not name the Borg as the Neutral Zone threat', 'The destroyed Neutral Zone outposts foreshadow a later threat, but season 1 characters do not know the Borg and should not identify them.', 'Block Borg knowledge in TNG season 1. Use unknown force, destroyed outposts, or unresolved threat language until Q Who in season 2.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Neutral Zone', ['Jean-Luc Picard'], ['Starfleet', 'Romulan Star Empire'], ['Borg spoiler guard', 'Neutral Zone outposts', 'Q Who']),
  c(SECRET_FILE, 'no-locutus-or-borg-trauma-in-season-one', 'Season 1 Picard has no Locutus trauma', 'Picard\'s season 1 stresses include Q, Stargazer history, command pressure, and Starfleet infiltration, but not assimilation or Locutus trauma.', 'Do not import Best of Both Worlds, Locutus, family-vineyard trauma, or later Borg recovery into season 1 Picard.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Encounter at Farpoint', ['Jean-Luc Picard'], ['Starfleet'], ['Locutus spoiler guard', 'Picard season 1', 'Borg future']),
  c(SECRET_FILE, 'no-later-data-family-before-datalore', 'Before Datalore, Data has no known brother aboard the Enterprise', 'Data\'s Soong-type family context is not available to the crew until Datalore reveals Lore and Omicron Theta details.', 'Before Datalore, do not reference Lore as Data\'s brother or reveal Soong-family specifics. After Datalore, keep later Soong developments out.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Datalore', ['Data', 'Lore'], ['Starfleet'], ['Data family spoiler guard', 'Lore reveal', 'Soong'], { validToEpisode: 'Datalore' }),
  c(SECRET_FILE, 'no-sela-or-yesterdays-enterprise-in-season-one', 'Yar\'s season 1 death must not import later alternate-timeline consequences', 'Season 1 ends with Yar dead in the main timeline; Sela, Yesterday\'s Enterprise, and alternate Yar consequences are later-story knowledge.', 'After Skin of Evil, use Yar death and memorial only. Do not mention Sela, alternate timelines, or Yesterday\'s Enterprise in season 1 scenes.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Skin Of Evil', ['Natasha Yar'], ['Starfleet', 'Romulan Star Empire'], ['Yar future guard', 'Sela spoiler guard', 'alternate timeline']),
  c(SECRET_FILE, 'no-ds9-cardassian-maquis-dominion-imports', 'TNG season 1 has no DS9-era Cardassian, Maquis, or Dominion state', 'The TNG season 1 deck should not import later 24th-century politics from DS9 or Voyager into early Enterprise-D scenes.', 'Block Cardassian border-war details, Bajoran occupation context, Maquis politics, Dominion knowledge, and Voyager outcomes unless a later deck is active.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Encounter at Farpoint', ['Jean-Luc Picard'], ['Starfleet'], ['DS9 future guard', 'Maquis spoiler guard', 'Dominion spoiler guard'], { wide: true }),
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
  if (index === 1) return [1, 2];
  return [index + 1];
}

function buildAnchors(records) {
  return records.map(record => {
    const titleSlug = slug(record.title);
    const sortKey = 10000 + ((record.memoryAlphaStoryEpisode - 1) * 20);
    const runtimeEpisodes = runtimeEpisodesFor(record.memoryAlphaStoryEpisode);
    const aliases = new Set([
      record.title,
      `TNG season 1 ${record.title}`,
      `TNG S1 ${record.title}`,
      `TNG 1x${String(record.memoryAlphaStoryEpisode).padStart(2, '0')} story`,
      `TNG S01 story ${String(record.memoryAlphaStoryEpisode).padStart(2, '0')}`,
    ]);
    for (const runtimeEpisode of runtimeEpisodes) {
      aliases.add(`TNG 1x${String(runtimeEpisode).padStart(2, '0')}`);
      aliases.add(`TNG S01E${String(runtimeEpisode).padStart(2, '0')}`);
      aliases.add(`TNG season 1 episode ${runtimeEpisode}`);
    }
    if (record.title === 'Encounter at Farpoint') {
      aliases.add('Encounter at Farpoint Part I');
      aliases.add('Encounter at Farpoint Part II');
      aliases.add('Encounter at Farpoint Part 1');
      aliases.add('Encounter at Farpoint Part 2');
    }
    return {
      id: `tng.s1.e${String(record.memoryAlphaStoryEpisode).padStart(2, '0')}.${titleSlug}`,
      label: record.title,
      contextType: 'story_anchor',
      sortKey,
      stardate: cleanDate(record.date),
      year: '2364',
      series: 'TNG',
      season: 1,
      storyEpisode: record.memoryAlphaStoryEpisode,
      runtimeEpisodes,
      episode: runtimeEpisodes.join(', '),
      aliases: [...aliases],
      tags: [...BASE_TAGS, tagId('episode', `tng-s1-${titleSlug}`)],
      sourceInfo: {
        work: 'Star Trek: The Next Generation',
        sourceType: 'episode',
        title: record.title,
        series: 'TNG',
        season: 1,
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
    label: card.wide ? 'TNG season 1' : `TNG season 1: ${start.label}`,
    approximate: false,
  };
}

function buildEntry(card, index, episodeMap, anchors) {
  const anchor = episodeMap.get(card.episodeTitle) || anchors[0];
  const characterTags = card.characters.map(name => tagId('character', name));
  const factionTags = card.factions.map(name => tagId('faction', name));
  const topicTags = card.topics.map(name => tagId('topic', name));
  const episodeTag = tagId('episode', `tng-s1-${slug(anchor.label)}`);
  const tags = [...new Set([...BASE_TAGS, episodeTag, ...characterTags, ...factionTags, ...topicTags])];
  return {
    schemaVersion: 3,
    id: `st_tng_s1_${card.id}`,
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
      { axis: 'season', id: 'tng-s1', label: 'TNG season 1', required: false },
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
        keywordsAny: [...new Set([...card.characters, ...card.factions, ...card.topics, anchor.label, 'TNG season 1'])],
      },
    },
    continuity: {
      continuityId: 'star-trek-prime',
      canonTier: 'primary',
      adaptation: 'television',
      medium: 'television',
      variantOf: 'star-trek-prime',
      sourceBoundary: 'Star Trek: The Next Generation season 1, Memory Alpha story rows 1-25, runtime episode aliases 1-26, primary on-screen Prime continuity.',
      notes: 'Draft reference deck. Excludes later TNG seasons, TNG films, DS9, Voyager, Picard-era material, beta canon, and fanon unless a card is an explicit future guard.',
    },
    content: {
      fact: card.fact,
      injection: card.injection,
      constraints: [
        'Keep this card inside TNG season 1 unless another active Star Trek deck provides a later Context window.',
        'Use the episode and season Context gates before injecting this fact.',
      ],
      antiLore: [
        'Do not copy Memory Alpha prose or substitute a plot recap for this gate.',
        'Do not import later TNG, DS9, Voyager, film, Picard-era, beta-canon, novel, comic, or fanon facts into this season 1 card.',
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
    description: `${titleCase(tag)} tag for Star Trek TNG season 1 retrieval and filtering.`,
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
      sourceBoundary: 'Star Trek: The Next Generation season 1.',
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

async function readPreservedCover() {
  try {
    return await fs.readFile(path.join(DECK_ROOT, COVER_ASSET_PATH));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(relativePath, value) {
  const file = path.join(DECK_ROOT, relativePath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function assertSafeDeckRoot() {
  const resolvedRoot = path.resolve(ROOT);
  const resolvedDeckRoot = path.resolve(DECK_ROOT);
  const expected = path.resolve(ROOT, 'content/loredecks/star-trek-tng-season-1');
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
  if (manifest.assets && typeof manifest.assets === 'object') record.assets = manifest.assets;
  index.bundled = Array.isArray(index.bundled) ? index.bundled.filter(item => item.packId !== DECK_ID) : [];
  index.bundled.push(record);
  index.bundled.sort((left, right) => String(left.packId).localeCompare(String(right.packId)));
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

async function main() {
  const preservedCover = await readPreservedCover();
  const evidence = JSON.parse(await fs.readFile(EVIDENCE_PATH, 'utf8'));
  const records = evidence.episodes.filter(episode => episode.deckId === DECK_ID);
  if (records.length !== 25) throw new Error(`Expected 25 TNG season 1 Memory Alpha story rows, found ${records.length}.`);

  const anchors = buildAnchors(records);
  const episodeMap = new Map(anchors.map(anchor => [anchor.label, anchor]));
  const entries = CARD_BLUEPRINTS.map((card, index) => buildEntry(card, index, episodeMap, anchors));
  const groups = groupedEntries(entries);
  const files = [...groups.keys()];
  const tags = collectTags(entries, anchors);
  const entities = collectEntities(entries);
  const windows = [
    {
      id: 'tng.s1.full-season',
      label: 'TNG season 1 full window',
      anchorFrom: anchors[0].id,
      anchorTo: anchors[anchors.length - 1].id,
      sortKeyFrom: anchors[0].sortKey,
      sortKeyTo: anchors[anchors.length - 1].sortKey,
      aliases: ['TNG season 1', 'Star Trek The Next Generation season 1', 'TNG S1'],
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
    summary: 'Star Trek: The Next Generation season 1 Context anchors and episode windows.',
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
    summary: 'Resolve Star Trek: The Next Generation season 1 Context from episode titles, story rows, runtime aliases, and common TNG S1 labels.',
    preferredFields: ['series', 'season', 'episode', 'stardate', 'beforeAfter', 'majorEvent'],
    ambiguousFallback: 'use_window',
    promptAddendum: 'Prefer TNG season 1 anchors and before/after windows. Do not infer later Star Trek events unless their Loredecks are loaded.',
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
    title: 'Star Trek TNG Season 1',
    description: 'Draft season Loredeck for the Enterprise-D launch year, Q at Farpoint, early crew baselines, Ferengi and Romulan contact, Data/Lore, Yar death, and season 1 spoiler guards.',
    fandom: 'Star Trek',
    era: 'The Next Generation Season 1',
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
      sourceBoundary: 'Star Trek: The Next Generation season 1, Memory Alpha story rows 1-25, runtime episode aliases 1-26, primary on-screen Prime continuity. Excludes later TNG seasons, TNG films, DS9, Voyager, Picard-era material, beta canon, novels, comics, games, deleted scenes, production trivia, and fanon.',
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
      notes: 'First-pass Star Trek TNG season 1 Loredeck generated from Saga authoring plan and Memory Alpha evidence artifacts.',
    },
    entrySchemaVersion: 3,
    updatedAt: UPDATED_AT,
  };
  if (preservedCover) manifest.assets = coverAssetsForTitle(manifest.title);

  assertSafeDeckRoot();
  await fs.rm(DECK_ROOT, { recursive: true, force: true });
  await fs.mkdir(DECK_ROOT, { recursive: true });
  if (preservedCover) {
    await fs.mkdir(path.dirname(path.join(DECK_ROOT, COVER_ASSET_PATH)), { recursive: true });
    await fs.writeFile(path.join(DECK_ROOT, COVER_ASSET_PATH), preservedCover);
  }
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
