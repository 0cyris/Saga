import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const EVIDENCE_PATH = path.join(ROOT, 'docs/loredecks/star-trek-memory-alpha-episode-evidence.json');
const DECK_ROOT = path.join(ROOT, 'content/loredecks/star-trek-tng-season-3');
const DECK_ID = 'star-trek-tng-season-3';
const UPDATED_AT = 1781740800000;
const COVER_ASSET_PATH = 'assets/cover.png';

const BASE_TAGS = [
  'fandom:star-trek',
  'continuity:star-trek-prime',
  'series:tng',
  'season:tng-s3',
  'structure:season-split-loredeck',
  'quality:draft-reference',
];

const EPISODE_FILE = 'episodes/season-3-episode-gates.json';
const CREW_FILE = 'crew/mature-enterprise-crew-state.json';
const FACTION_FILE = 'factions/klingons-romulans-borg-and-federation.json';
const TECH_FILE = 'rules/android-holodeck-temporal-and-contact-rules.json';
const SECRET_FILE = 'secrets/season-3-reveal-gates.json';
const SECRET_GUARD_FILE = 'secrets/season-3-future-guards.json';

const CARD_BLUEPRINTS = [
  c(CREW_FILE, 'crusher-returns-as-chief-medical-officer', 'Crusher is back as Enterprise-D chief medical officer in season 3', 'Season 3 restores Beverly Crusher as chief medical officer, replacing the Pulaski season and reestablishing Crusher family and medical dynamics aboard the Enterprise-D.', 'Write Beverly Crusher as active Enterprise-D CMO in TNG season 3. Do not keep Pulaski aboard as the regular ship doctor unless a scene explicitly references season 2.', 'character', 'character_state', 'behavior_constraint', 'Evolution', ['Beverly Crusher', 'Jean-Luc Picard', 'Wesley Crusher'], ['Starfleet'], ['Crusher return', 'chief medical officer', 'season 3 crew'], { wide: true }),
  c(CREW_FILE, 'mature-enterprise-crew-baseline', 'Season 3 has the settled mature Enterprise-D command baseline', 'By season 3, Picard, Riker, Data, Worf, Geordi, Troi, Crusher, Wesley, and Guinan function as a more settled Enterprise-D ensemble.', 'Use TNG season 3 as a mature Enterprise-D baseline: roles are clearer, relationships are more practiced, and episode gates override only where they narrow this state.', 'character', 'character_state', 'behavior_constraint', 'Evolution', ['Jean-Luc Picard', 'William Riker', 'Data', 'Worf', 'Geordi La Forge', 'Beverly Crusher'], ['Starfleet'], ['mature Enterprise crew', 'season 3 baseline', 'Enterprise-D'], { wide: true }),
  c(CREW_FILE, 'geordi-engineering-authority-season-three', 'Geordi is the settled chief engineer throughout season 3', 'Season 3 treats Geordi as the Enterprise-D chief engineer with full technical responsibility and greater authority than his season 1 conn-officer role.', 'Write Geordi as the settled chief engineer in season 3, especially in engineering, anomaly, holodeck, and ship-risk scenes.', 'character', 'character_state', 'behavior_constraint', 'Evolution', ['Geordi La Forge'], ['Starfleet'], ['Geordi chief engineer', 'engineering authority', 'season 3 crew'], { wide: true }),
  c(CREW_FILE, 'worf-security-chief-season-three', 'Worf is the settled security chief before Klingon family revelations escalate', 'Season 3 continues Worf as Enterprise-D security chief while adding deeper Klingon family and honor stakes later in the season.', 'Use Worf as both Starfleet security chief and Klingon officer. Do not import discommendation before Sins of The Father.', 'character', 'character_state', 'behavior_constraint', 'Evolution', ['Worf'], ['Starfleet', 'Klingon Empire'], ['Worf security chief', 'Klingon honor', 'season 3 crew'], { wide: true }),
  c(CREW_FILE, 'wesley-season-three-acting-ensign', 'Wesley remains a gifted acting ensign in season 3', 'Wesley continues as a young acting ensign and technical contributor, including high-stakes mistakes such as the nanite accident in Evolution.', 'Write Wesley as brilliant but still young and accountable. His technical insight matters, but his choices can create real risk.', 'character', 'character_state', 'behavior_constraint', 'Evolution', ['Wesley Crusher'], ['Starfleet'], ['Wesley acting ensign', 'nanite accident', 'young officer'], { wide: true }),
  c(EPISODE_FILE, 'wesley-nanites-threaten-stellar-experiment', 'Evolution turns Wesley nanites into an emergent threat to the Kavis Alpha experiment', 'Wesley accidentally releases self-replicating nanites that interfere with Dr. Stubbs mission and endanger Enterprise systems.', 'Use Evolution as a Wesley accountability and emergent-technology gate. Do not treat the nanites as ordinary ship malware.', 'event', 'anchor_window', 'event_moment', 'Evolution', ['Wesley Crusher', 'Paul Stubbs', 'Data'], ['Starfleet'], ['nanites', 'Kavis Alpha', 'Wesley mistake']),
  c(TECH_FILE, 'nanites-recognized-as-emergent-life', 'Evolution recognizes the nanites as emergent life rather than mere contamination', 'The nanites develop enough organization and communication to force Picard to treat them as a lifeform instead of simply exterminating them.', 'After Evolution, use the nanites as an emergent-life precedent. Keep them local unless a later scene directly invokes nanotechnology or synthetic life recognition.', 'rule', 'lore_gate', 'rule', 'Evolution', ['Data', 'Jean-Luc Picard'], ['Starfleet'], ['nanite lifeform', 'sentience recognition', 'Evolution']),
  c(TECH_FILE, 'wesley-nanite-future-guard', 'Wesley nanite incident does not make him a rogue scientist', 'Evolution gives Wesley a serious mistake and learning moment, but it does not turn him into a reckless villain or remove him from Enterprise duty.', 'Use the nanite accident as accountability context, not as a permanent character rewrite. Later Wesley arcs belong to later windows.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Evolution', ['Wesley Crusher'], ['Starfleet'], ['Wesley future guard', 'nanite accident', 'Starfleet discipline']),
  c(FACTION_FILE, 'sheliak-treaty-legalism', 'The Ensigns of Command makes Sheliak legalism the main obstacle', 'The Sheliak insist on strict treaty terms and view the Tau Cygna V colonists as a legal removal problem rather than a humanitarian exception.', 'Use the Sheliak as precise, treaty-bound legal adversaries. Picard must win through contract language, not emotional appeal.', 'faction', 'knowledge_gate', 'faction', 'The Ensigns of Command', ['Jean-Luc Picard', 'Data'], ['Sheliak Corporate', 'Starfleet'], ['Sheliak', 'Tau Cygna V', 'treaty legalism']),
  c(CREW_FILE, 'data-colony-persuasion-tau-cygna', 'Data must persuade colonists who do not respond to authority alone', 'On Tau Cygna V, Data cannot rely on rank or android strength; he has to learn how to persuade stubborn colonists before the Sheliak deadline.', 'Use The Ensigns of Command to show Data learning social persuasion as a practical command skill, not just technical competence.', 'character', 'character_state', 'character_snapshot', 'The Ensigns of Command', ['Data'], ['Starfleet'], ['Data persuasion', 'Tau Cygna V', 'colonists']),
  c(TECH_FILE, 'tau-cygna-radiation-constraint', 'Tau Cygna V radiation makes normal human evacuation logistics urgent', 'The Tau Cygna V colony survives in an environment dangerous to ordinary humans, limiting simple Federation intervention and raising the stakes of Sheliak removal.', 'Keep Tau Cygna V conditions tied to this episode: harsh radiation, vulnerable colonists, and evacuation pressure under treaty constraints.', 'rule', 'lore_gate', 'rule', 'The Ensigns of Command', ['Data', 'Jean-Luc Picard'], ['Sheliak Corporate', 'Starfleet'], ['Tau Cygna V radiation', 'evacuation', 'colonists']),
  c(SECRET_FILE, 'kevin-uxbridge-douwd-secret', 'The Survivors reveals Kevin Uxbridge as a Douwd hiding genocide-level guilt', 'Kevin Uxbridge is not simply a grieving survivor; he is a Douwd who destroyed the Husnock in a single act after Rishon died.', 'After The Survivors, Kevin is a hidden-power and guilt gate. Do not treat Rana IV as a normal colony-survivor mystery once the truth is known.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Survivors', ['Kevin Uxbridge', 'Jean-Luc Picard'], ['Starfleet'], ['Douwd', 'Husnock genocide', 'Rana IV']),
  c(SECRET_FILE, 'rishon-recreation-boundary', 'Rishon on Rana IV is Kevin Uxbridge recreation, not the original survivor', 'The Rishon Picard meets is an artificial recreation maintained by Kevin, which changes how scenes after the reveal should treat her agency and truth status.', 'After the reveal, write Rishon as Kevin recreation, not as an independent surviving colonist. Before the reveal, keep the mystery intact.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Survivors', ['Kevin Uxbridge', 'Rishon Uxbridge'], ['Starfleet'], ['Rishon recreation', 'Rana IV', 'hidden truth']),
  c(SECRET_GUARD_FILE, 'douwd-power-future-guard', 'The Douwd reveal should stay local and not become a common species baseline', 'Kevin Uxbridge demonstrates enormous power, but season 3 does not make the Douwd a familiar, contactable, or recurring political species.', 'Use Douwd power narrowly for Kevin and Rana IV. Do not create broad Douwd politics or recurring abilities from this one reveal.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Survivors', ['Kevin Uxbridge'], ['Starfleet'], ['Douwd future guard', 'Kevin Uxbridge', 'Husnock']),
  c(TECH_FILE, 'mintakan-contact-contamination', 'Who Watches The Watchers shows accidental contact contamination among Mintakans', 'A damaged observation post exposes Mintakans to Federation technology and causes some to read Picard as a divine figure.', 'Use the Mintakan incident as a Prime Directive contamination gate: accidental exposure creates belief changes that must be corrected carefully.', 'rule', 'lore_gate', 'rule', 'Who Watches The Watchers', ['Jean-Luc Picard', 'Liko', 'Nuria'], ['Starfleet'], ['Mintakans', 'Prime Directive', 'contact contamination']),
  c(SECRET_FILE, 'picard-god-myth-must-be-dismantled', 'Picard must dismantle the Mintakan god myth rather than exploit it', 'Picard chooses transparency with Nuria and rejects being treated as a god, making the ethical response to contamination the durable lesson.', 'For Mintakan scenes, Picard should resist worship and restore agency rather than use false divinity for control.', 'secret', 'reveal_gate', 'knowledge_gate', 'Who Watches The Watchers', ['Jean-Luc Picard', 'Nuria'], ['Starfleet'], ['Picard god myth', 'Mintakan religion', 'Prime Directive']),
  c(EPISODE_FILE, 'mintakan-truth-boundary', 'Mintakan Federation knowledge remains narrow after the contamination repair', 'After Who Watches The Watchers, some Mintakans know enough to reject the Picard god myth, but they do not become Federation members or broad galactic actors.', 'Keep Mintakan knowledge narrow and local. Do not turn them into a recurring Federation contact society in season 3.', 'event', 'anchor_window', 'event_moment', 'Who Watches The Watchers', ['Jean-Luc Picard', 'Nuria', 'Liko'], ['Starfleet'], ['Mintakan aftermath', 'Nuria', 'contact boundary']),
  c(CREW_FILE, 'worf-bonds-with-jeremy-aster', 'The Bonding gives Worf a ritual bond with Jeremy Aster', 'After Marla Aster dies, Worf performs a Klingon bonding ritual with Jeremy, making his protective obligation personal and culturally specific.', 'Use Worf-Jeremy as a grief and obligation gate after The Bonding. Keep it local unless a scene invokes Jeremy or Worf family ritual.', 'relationship', 'relationship_state', 'relationship_state', 'The Bonding', ['Worf', 'Jeremy Aster'], ['Starfleet', 'Klingon Empire'], ['Jeremy Aster', 'Klingon bonding', 'Worf obligation']),
  c(EPISODE_FILE, 'marla-aster-death-away-mission', 'The Bonding starts with Marla Aster death on an away mission', 'Marla Aster dies under Picard command, making the episode about grief, command responsibility, and how the ship supports a bereaved child.', 'Use Marla Aster death as a crew grief and command-responsibility gate. Do not generalize it into broad ship casualty lore.', 'event', 'anchor_window', 'event_moment', 'The Bonding', ['Marla Aster', 'Jeremy Aster', 'Jean-Luc Picard'], ['Starfleet'], ['Marla Aster death', 'away mission casualty', 'crew grief']),
  c(SECRET_GUARD_FILE, 'bonding-alien-mother-illusion-local', 'The Bonding alien mother illusion is local grief manipulation', 'The Koinonian entity recreates Jeremy mother out of guilt, but the illusion is not a true resurrection or durable family state.', 'After The Bonding, do not write Marla as restored. Treat the illusion as resolved grief manipulation by the Koinonian entity.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Bonding', ['Jeremy Aster', 'Marla Aster'], ['Starfleet'], ['mother illusion', 'Koinonian', 'grief manipulation']),
  c(TECH_FILE, 'booby-trap-radiation-and-power-drain', 'Booby Trap makes the Promellian trap a radiation and power-drain crisis', 'The Enterprise is trapped by an ancient automated snare that punishes power use and creates lethal radiation pressure.', 'Use Booby Trap as a tactical energy-management crisis. Ship systems and impulse choices should matter more than simple weapons fire.', 'rule', 'lore_gate', 'rule', 'Booby Trap', ['Geordi La Forge', 'Jean-Luc Picard'], ['Starfleet'], ['Promellian trap', 'radiation', 'power drain']),
  c(CREW_FILE, 'geordi-leah-brahms-holoprogram-boundary', 'Geordi works with a holographic Leah Brahms simulation, not the real engineer', 'Booby Trap has Geordi collaborate with a computer-built Brahms simulation to solve the crisis, creating a later relationship boundary.', 'When using Booby Trap, distinguish holographic Leah from the real Leah Brahms. Do not treat the simulation as consent or a real relationship.', 'relationship', 'relationship_state', 'relationship_state', 'Booby Trap', ['Geordi La Forge', 'Leah Brahms'], ['Starfleet'], ['Leah Brahms hologram', 'Geordi', 'Booby Trap']),
  c(TECH_FILE, 'geordi-engineering-intuition-booby-trap', 'Booby Trap highlights Geordi engineering intuition under pressure', 'Geordi solves the trap by combining technical understanding, simulation support, and manual control rather than routine automatic systems.', 'Use this as Geordi chief-engineer competence context: he can improvise with systems under severe constraints.', 'character', 'character_state', 'character_snapshot', 'Booby Trap', ['Geordi La Forge'], ['Starfleet'], ['Geordi engineering', 'manual control', 'Promellian trap']),
  c(FACTION_FILE, 'romulan-rescue-and-worf-refusal', 'The Enemy forces Worf to confront Romulan hatred through a blood-donation request', 'Worf refuses to donate compatible blood to a dying Romulan because Romulans killed his parents, exposing deep unresolved trauma and prejudice.', 'After The Enemy, Worf can carry explicit Romulan hatred tied to family loss. Do not yet import full Khitomer or Kurn revelations before Sins of The Father.', 'character', 'character_state', 'behavior_constraint', 'The Enemy', ['Worf', 'Patahk'], ['Romulan Star Empire', 'Starfleet', 'Klingon Empire'], ['Worf Romulan hatred', 'blood donation refusal', 'family trauma']),
  c(EPISODE_FILE, 'geordi-bochra-survival-cooperation', 'The Enemy makes Geordi and Bochra cooperate to survive Galorndon Core', 'Geordi and Romulan officer Bochra survive only by cooperating despite enemy assumptions, giving the episode a local enemy-humanization gate.', 'Use Geordi-Bochra cooperation as episode-local proof that individual Romulans can work with Starfleet under survival pressure.', 'relationship', 'relationship_state', 'relationship_state', 'The Enemy', ['Geordi La Forge', 'Bochra'], ['Romulan Star Empire', 'Starfleet'], ['Bochra', 'Galorndon Core', 'enemy cooperation']),
  c(FACTION_FILE, 'romulan-neutral-zone-tension-season-three', 'The Enemy keeps Romulan tension active near the Neutral Zone', 'The Galorndon Core incident keeps Federation-Romulan contact dangerous, suspicious, and militarized without becoming open war.', 'Use season 3 Romulan encounters as tense and strategic. Do not import Sela or reunification material before their reveal windows.', 'faction', 'knowledge_gate', 'faction', 'The Enemy', ['Jean-Luc Picard', 'Tomalak'], ['Romulan Star Empire', 'Starfleet'], ['Romulan tension', 'Neutral Zone', 'Tomalak'], { wide: true }),
  c(TECH_FILE, 'barzan-wormhole-instability', 'The Price reveals the Barzan wormhole is not a stable prize', 'The Barzan wormhole appears commercially valuable but proves unstable, stranding Ferengi on the far end and invalidating easy strategic assumptions.', 'Use the Barzan wormhole as an instability gate. Do not treat it as a reliable Federation route or a DS9-style stable wormhole.', 'rule', 'lore_gate', 'rule', 'The Price', ['Deanna Troi', 'William Riker'], ['Ferengi Alliance', 'Starfleet'], ['Barzan wormhole', 'wormhole instability', 'Ferengi stranded']),
  c(CREW_FILE, 'troi-devinoni-ral-relationship-boundary', 'The Price gives Troi a romantic conflict with Devinoni Ral', 'Troi becomes involved with Devinoni Ral but his empathic manipulation and negotiation ethics make the relationship non-durable.', 'Use Troi-Ral only for The Price context. Do not carry it forward as an ongoing romance after the episode.', 'relationship', 'relationship_state', 'relationship_state', 'The Price', ['Deanna Troi', 'Devinoni Ral'], ['Starfleet'], ['Devinoni Ral', 'Troi romance', 'empathic manipulation']),
  c(SECRET_GUARD_FILE, 'ferengi-wormhole-future-guard', 'The stranded Ferengi from The Price should not resolve inside TNG season 3', 'The Price strands Arridor and Kol in the Delta Quadrant end of the unstable wormhole, but their later fate belongs outside this season deck.', 'Do not resolve the stranded Ferengi in TNG season 3. Keep the fact as a wormhole consequence and future guard.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Price', ['Arridor', 'Kol'], ['Ferengi Alliance'], ['stranded Ferengi', 'Barzan wormhole', 'future guard']),
  c(SECRET_FILE, 'yuta-assassin-reveal', 'The Vengeance Factor reveals Yuta as a long-lived assassin targeting Lornak clan members', 'Yuta hides inside Acamarian reconciliation politics while genetically conditioned to kill Lornak clan members across generations.', 'After The Vengeance Factor reveal, write Yuta as an assassin shaped by clan vengeance, not simply a servant or love interest.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Vengeance Factor', ['Yuta', 'William Riker'], ['Acamarians', 'Starfleet'], ['Yuta assassin', 'Lornak clan', 'Acamarian vengeance']),
  c(FACTION_FILE, 'acamarian-reconciliation-local', 'The Vengeance Factor is a local Acamarian reconciliation mission', 'Picard mediates between Acamarian Gatherers and Marouk government authority, but the durable issue is vengeance sabotage inside reconciliation.', 'Use Acamarian politics only when clan vengeance, Gatherers, or Marouk reconciliation are relevant. Keep it local.', 'faction', 'knowledge_gate', 'faction', 'The Vengeance Factor', ['Jean-Luc Picard', 'Yuta'], ['Acamarians', 'Starfleet'], ['Acamarian Gatherers', 'reconciliation', 'vengeance']),
  c(FACTION_FILE, 'jarok-defection-romulan-trap', 'The Defector uses Jarok defection to expose Romulan deception and tragedy', 'Admiral Jarok defects believing he can prevent war, but the Romulans use his information as a trap and leave him personally ruined.', 'Use Jarok as a tragic Romulan defector gate. His knowledge is sincere, but the larger situation is Romulan strategic deception.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Defector', ['Alidar Jarok', 'Jean-Luc Picard', 'Tomalak'], ['Romulan Star Empire', 'Starfleet'], ['Jarok defection', 'Romulan trap', 'Tomalak']),
  c(FACTION_FILE, 'picard-klingon-cloak-countermove', 'The Defector shows Picard using Klingon support to counter Romulan pressure', 'Picard secretly brings Klingon ships to expose Tomalak bluff, showing Federation-Klingon cooperation as a strategic deterrent.', 'Use The Defector as a Federation-Klingon cooperation gate. The Klingons can support Picard against Romulan pressure without becoming the story focus.', 'faction', 'knowledge_gate', 'faction', 'The Defector', ['Jean-Luc Picard', 'Tomalak'], ['Klingon Empire', 'Romulan Star Empire', 'Starfleet'], ['Klingon support', 'Romulan standoff', 'Picard strategy']),
  c(SECRET_GUARD_FILE, 'jarok-daughter-letter-boundary', 'Jarok leaves a private family legacy rather than a public Romulan turn', 'Jarok death leaves a message for his daughter but does not create a broad Romulan reform movement in season 3.', 'Keep Jarok aftermath personal and tragic. Do not import later Romulan dissident or reunification arcs.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Defector', ['Alidar Jarok'], ['Romulan Star Empire'], ['Jarok daughter', 'defector aftermath', 'Romulan future guard']),
  c(EPISODE_FILE, 'angosian-soldier-program-revolt', 'The Hunted reveals Angosia made unstable enhanced veterans', 'Angosia III seeks Federation membership while hiding that it chemically and psychologically altered soldiers it cannot reintegrate.', 'Use The Hunted as a veteran-treatment and engineered-soldier gate. The Angosian state should not read as cleanly Federation-ready.', 'event', 'anchor_window', 'event_moment', 'The Hunted', ['Jean-Luc Picard', 'Roga Danar'], ['Angosia III', 'Starfleet'], ['Angosian veterans', 'Roga Danar', 'Federation membership']),
  c(FACTION_FILE, 'federation-membership-ethics-angosia', 'The Hunted ties Federation membership to civil-rights scrutiny', 'Picard does not treat Angosia technical eligibility as enough; the treatment of veterans affects whether the planet deserves Federation entry.', 'Use Angosia as a Federation-membership ethics gate: internal civil-rights abuse matters to admission.', 'rule', 'lore_gate', 'rule', 'The Hunted', ['Jean-Luc Picard', 'Roga Danar'], ['United Federation of Planets', 'Angosia III'], ['Federation membership', 'civil rights', 'veterans']),
  c(EPISODE_FILE, 'rutan-terrorism-and-crusher-hostage', 'The High Ground puts Crusher inside Rutian insurgency politics', 'Crusher is kidnapped by Ansata separatists on Rutia IV, forcing Picard to confront terrorism, state violence, and medical hostage pressure.', 'Use The High Ground as a terrorism and hostage gate. Do not simplify the conflict into clean heroes and villains.', 'event', 'anchor_window', 'event_moment', 'The High Ground', ['Beverly Crusher', 'Jean-Luc Picard'], ['Starfleet'], ['Ansata', 'Rutia IV', 'hostage crisis']),
  c(TECH_FILE, 'ansata-dimensional-shift-cost', 'The Ansata dimensional transporter is effective but physically destructive', 'The Ansata use an interdimensional transport method that enables attacks but causes lethal cumulative harm to users.', 'Use the Ansata transporter as an episode-local insurgent technology with a severe biological cost.', 'rule', 'lore_gate', 'rule', 'The High Ground', ['Beverly Crusher'], ['Starfleet'], ['Ansata transporter', 'dimensional shift', 'terrorism technology']),
  c(FACTION_FILE, 'q-mortality-in-deja-q', 'Deja Q makes Q temporarily mortal and vulnerable', 'The Continuum strips Q of power and dumps him on the Enterprise, forcing the crew to deal with him as a vulnerable person instead of an omnipotent intruder.', 'Use Deja Q for mortal-Q scenes only inside and after this episode. Do not make Q permanently powerless afterward.', 'event', 'anchor_window', 'event_moment', 'Deja Q', ['Q', 'Jean-Luc Picard'], ['Q Continuum', 'Starfleet'], ['mortal Q', 'Q Continuum punishment', 'Deja Q']),
  c(CREW_FILE, 'data-q-friendship-gift-laugh', 'Deja Q gives Data a rare laughter gift from Q', 'Q thanks Data by briefly giving him the ability to laugh, making the moment a local Data-humanity beat rather than a permanent emotion upgrade.', 'After Deja Q, Data can remember laughing once, but he does not gain stable human emotions or full emotional capacity.', 'character', 'character_state', 'character_snapshot', 'Deja Q', ['Data', 'Q'], ['Q Continuum', 'Starfleet'], ['Data laughter', 'Q gift', 'humanity quest']),
  c(SECRET_GUARD_FILE, 'q-continuum-politics-stay-opaque', 'Deja Q hints at Continuum politics without explaining the Continuum', 'Q punishment reveals that the Continuum can discipline its members, but season 3 does not explain Q society in detail.', 'Keep Q Continuum politics opaque in season 3. Do not import later Q civil-war or Voyager Q lore.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Deja Q', ['Q'], ['Q Continuum'], ['Q Continuum future guard', 'mortal Q', 'Q politics']),
  c(TECH_FILE, 'holodeck-reconstruction-testimony', 'A Matter of Perspective uses holodeck reconstruction as contested evidence', 'The Enterprise uses holodeck reconstructions to compare conflicting testimony about Apgar death, but the simulation is interpretive rather than perfect truth.', 'Use holodeck reconstruction as investigative support, not absolute evidence. Witness perspective and technical interpretation still matter.', 'rule', 'lore_gate', 'rule', 'A Matter of Perspective', ['William Riker', 'Jean-Luc Picard'], ['Starfleet'], ['holodeck testimony', 'Apgar death', 'investigation']),
  c(EPISODE_FILE, 'riker-accusation-local', 'A Matter of Perspective is a local Riker accusation and forensic dispute', 'Riker is accused of murder after Dr. Apgar death, but the durable gate is contested testimony resolved by technical investigation.', 'Keep the Apgar accusation local. Do not treat Riker as carrying a continuing criminal status after the episode.', 'event', 'anchor_window', 'event_moment', 'A Matter of Perspective', ['William Riker', 'Nel Apgar'], ['Starfleet'], ['Riker accusation', 'Apgar', 'forensic dispute']),
  c(SECRET_FILE, 'yesterdays-enterprise-alternate-war-timeline', 'Yesterday\'s Enterprise creates an alternate war timeline when Enterprise-C appears', 'The Enterprise-C arrival changes history into a Federation-Klingon war timeline where the Enterprise-D is a warship and Tasha Yar is alive.', 'Use Yesterday\'s Enterprise as an alternate-timeline gate only inside that episode window. Do not overwrite the normal season 3 timeline after the timeline is repaired.', 'secret', 'reveal_gate', 'knowledge_gate', "Yesterday's Enterprise", ['Jean-Luc Picard', 'Tasha Yar', 'Guinan'], ['Starfleet', 'Klingon Empire'], ['Enterprise-C', 'alternate timeline', 'Federation-Klingon war']),
  c(SECRET_FILE, 'guinan-senses-wrong-timeline', 'Guinan senses the alternate timeline is wrong in Yesterday\'s Enterprise', 'Guinan does not remember normal history exactly, but she knows the war timeline is wrong and pushes Picard to send Enterprise-C back.', 'Use Guinan timeline perception as rare intuition, not omniscience. She can identify wrongness but cannot simply narrate all alternate facts.', 'secret', 'reveal_gate', 'knowledge_gate', "Yesterday's Enterprise", ['Guinan', 'Jean-Luc Picard'], ['Starfleet'], ['Guinan timeline sense', 'alternate history', 'Enterprise-C']),
  c(SECRET_GUARD_FILE, 'tasha-yar-alternate-departure', 'Alternate Tasha Yar chooses Enterprise-C and leaves the repaired timeline unresolved', 'The alternate Yar learns she died without meaning in the normal timeline and chooses to return with Enterprise-C, creating a hidden later consequence.', 'After Yesterday\'s Enterprise, do not put Yar back aboard the normal Enterprise-D. Her alternate departure is a future-guard thread, not a restored crew state.', 'secret', 'spoiler_guard', 'knowledge_gate', "Yesterday's Enterprise", ['Natasha Yar', 'Rachel Garrett'], ['Starfleet'], ['Tasha Yar alternate', 'Enterprise-C', 'future guard']),
  c(FACTION_FILE, 'enterprise-c-sacrifice-restores-khitomer-path', 'Enterprise-C sacrifice protects the Federation-Klingon peace path', 'Sending Enterprise-C back to Narendra III restores the history where Klingons view the sacrifice as honorable and the Federation is not at war with them.', 'Use Enterprise-C sacrifice as the reason the normal Federation-Klingon peace path matters. Do not keep the war timeline active after the repair.', 'faction', 'knowledge_gate', 'faction', "Yesterday's Enterprise", ['Rachel Garrett', 'Jean-Luc Picard'], ['Starfleet', 'Klingon Empire'], ['Enterprise-C sacrifice', 'Narendra III', 'Klingon peace']),
  c(SECRET_GUARD_FILE, 'sela-not-revealed-in-season-three', 'Yesterday\'s Enterprise sets up later Yar consequences but does not reveal Sela', 'Season 3 can carry alternate-Yar future-guard tension, but Sela is not revealed in this season deck.', 'Block Sela identity and later Romulan-Yar consequences in season 3. Keep only the Enterprise-C choice visible.', 'secret', 'spoiler_guard', 'knowledge_gate', "Yesterday's Enterprise", ['Natasha Yar'], ['Romulan Star Empire', 'Starfleet'], ['Sela future guard', 'Yar consequence', 'alternate timeline']),
  c(CREW_FILE, 'data-creates-lal-as-child', 'The Offspring makes Lal Data\'s created child, not a simple experiment', 'Data creates Lal as his offspring and treats parenthood as a serious relationship, forcing the crew and Starfleet to respond to an android family bond.', 'After The Offspring begins, write Lal as Data child and person, not just a device. Keep Data parenthood sincere and literal.', 'relationship', 'relationship_state', 'relationship_state', 'The Offspring', ['Data', 'Lal'], ['Starfleet'], ['Lal', 'Data parenthood', 'android child']),
  c(SECRET_FILE, 'starfleet-attempts-to-remove-lal', 'The Offspring tests whether Starfleet can remove Lal from Data custody', 'Admiral Haftel tries to take Lal away for supervised research, creating a family-autonomy gate after Data personhood ruling.', 'Use Haftel pressure as a Starfleet custody and android-rights conflict. Data personhood does not prevent Starfleet from trying to control Lal.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Offspring', ['Data', 'Lal', 'Anthony Haftel'], ['Starfleet'], ['Lal custody', 'android rights', 'Haftel']),
  c(SECRET_FILE, 'lal-dies-season-three', 'Lal dies in The Offspring and should not remain aboard afterward', 'Lal suffers a cascade failure and dies, leaving Data with a memory of parenthood rather than a living child aboard the Enterprise.', 'After The Offspring, do not write Lal as alive in normal continuity. Data retains the experience and loss, not a continuing child.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Offspring', ['Data', 'Lal'], ['Starfleet'], ['Lal death', 'Data grief', 'android child']),
  c(CREW_FILE, 'data-parenthood-memory-after-lal', 'Data carries Lal\'s memories after her death', 'After Lal dies, Data integrates her memories, making the parenthood experience part of him even without ordinary emotional grief.', 'Use Lal aftermath as Data lived memory and family context. Do not make him emotionally human; keep his response android-specific.', 'character', 'character_state', 'character_snapshot', 'The Offspring', ['Data', 'Lal'], ['Starfleet'], ['Lal memories', 'Data parenthood', 'android grief']),
  c(FACTION_FILE, 'kurn-revealed-as-worf-brother', 'Sins of The Father reveals Kurn as Worf\'s brother', 'Kurn arrives through the officer exchange and reveals he is Worf brother, opening the Mogh/Duras/Khitomer family trial.', 'After Sins of The Father, Kurn is Worf brother. Before that episode, keep his identity hidden.', 'secret', 'reveal_gate', 'knowledge_gate', 'Sins of The Father', ['Worf', 'Kurn'], ['Klingon Empire', 'Starfleet'], ['Kurn', 'Worf brother', 'House of Mogh']),
  c(FACTION_FILE, 'duras-family-framed-mogh', 'Sins of The Father reveals Duras family guilt behind the Khitomer accusation', 'Evidence points to Duras father as the Romulan collaborator, but Klingon politics protect Duras family by blaming Mogh.', 'Use Duras as a politically protected enemy after Sins of The Father. Worf knows truth but cannot expose it without destabilizing the Empire.', 'secret', 'reveal_gate', 'knowledge_gate', 'Sins of The Father', ['Worf', 'Duras', 'Kurn'], ['Klingon Empire', 'Romulan Star Empire'], ['Duras', 'Khitomer', 'Mogh accusation']),
  c(FACTION_FILE, 'worf-accepts-discommendation', 'Worf accepts discommendation to protect Klingon political stability', 'Worf accepts public disgrace even though Mogh is innocent, preserving Kurn life and avoiding a Klingon civil crisis.', 'After Sins of The Father, Worf is discommended in Klingon society. Use this status until a later deck changes it.', 'character', 'character_state', 'behavior_constraint', 'Sins of The Father', ['Worf', 'Kurn'], ['Klingon Empire', 'Starfleet'], ['Worf discommendation', 'Klingon politics', 'House of Mogh']),
  c(SECRET_GUARD_FILE, 'kurn-identity-and-discommendation-guard', 'Before Sins of The Father, Kurn and Worf discommendation are not known', 'Kurn being Worf brother and Worf accepting discommendation are reveal-gated by Sins of The Father.', 'Before Sins of The Father, block Kurn-as-brother, Duras guilt, and Worf discommendation facts.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Sins of The Father', ['Worf', 'Kurn', 'Duras'], ['Klingon Empire'], ['Kurn future guard', 'Duras spoiler guard', 'discommendation'], { validToEpisode: 'Sins of The Father' }),
  c(FACTION_FILE, 'klingon-high-council-political-risk', 'Sins of The Father makes Klingon justice subordinate to High Council politics', 'The Klingon High Council chooses political stability over truth, showing that honor rhetoric does not prevent institutional compromise.', 'Use this as a Klingon-politics gate after Sins of The Father: public honor and political survival can conflict.', 'faction', 'knowledge_gate', 'faction', 'Sins of The Father', ['Worf', 'Kurn', 'Duras'], ['Klingon Empire'], ['High Council', 'Klingon justice', 'political stability']),
  c(EPISODE_FILE, 'allegiance-picard-duplicate-command-test', 'Allegiance uses a Picard duplicate to test crew obedience', 'Aliens replace Picard with a duplicate while the real Picard is held with other captives, creating a command-authenticity and crew-obedience test.', 'Use Allegiance as episode-local command-authenticity context. Do not keep a duplicate Picard active after the episode.', 'event', 'anchor_window', 'event_moment', 'Allegiance', ['Jean-Luc Picard', 'William Riker'], ['Starfleet'], ['Picard duplicate', 'command test', 'captivity']),
  c(CREW_FILE, 'riker-challenges-false-picard', 'Allegiance shows Riker can challenge Picard-like orders when command behavior breaks pattern', 'Riker eventually resists the duplicate Picard as orders become dangerous and inconsistent, showing disciplined command skepticism.', 'Use Allegiance for Riker judgment: loyalty does not require blind obedience when a captain behaves impossibly out of character.', 'character', 'character_state', 'character_snapshot', 'Allegiance', ['William Riker', 'Jean-Luc Picard'], ['Starfleet'], ['Riker command skepticism', 'false Picard', 'bridge discipline']),
  c(CREW_FILE, 'vash-and-picard-risa-connection', 'Captain\'s Holiday introduces Vash as Picard\'s Risa adventure partner', 'Picard meets Vash on Risa and becomes drawn into an archaeological chase for the Tox Uthat, creating a recurring personal connection.', 'After Captain\'s Holiday, Vash is a known Picard romantic-adventure connection. Do not import later Qpid or DS9 Vash outcomes yet.', 'relationship', 'relationship_state', 'relationship_state', "Captain's Holiday", ['Jean-Luc Picard', 'Vash'], ['Starfleet'], ['Vash', 'Risa', 'Picard romance']),
  c(SECRET_FILE, 'tox-uthat-destroyed', 'Captain\'s Holiday ends with Picard destroying the Tox Uthat', 'The Tox Uthat is a dangerous future weapon hidden on Risa, and Picard destroys it rather than let any faction control it.', 'After Captain\'s Holiday, do not keep the Tox Uthat available as a usable artifact. It is destroyed in the season 3 event window.', 'secret', 'reveal_gate', 'knowledge_gate', "Captain's Holiday", ['Jean-Luc Picard', 'Vash'], ['Starfleet'], ['Tox Uthat', 'Risa artifact', 'future weapon']),
  c(TECH_FILE, 'tin-man-gomtuu-living-ship', 'Tin Man introduces Gomtuu as a living starship seeking a bond', 'Gomtuu is a living vessel around a dying star, and Tam Elbrun can communicate with it through exceptional telepathy.', 'Use Gomtuu as a rare living-ship contact gate. Do not treat living starships as common Starfleet technology.', 'rule', 'lore_gate', 'rule', 'Tin Man', ['Tam Elbrun', 'Jean-Luc Picard'], ['Starfleet', 'Romulan Star Empire'], ['Gomtuu', 'living ship', 'Tin Man']),
  c(CREW_FILE, 'tam-elbrun-telepathic-isolation', 'Tam Elbrun is brilliant but damaged by uncontrolled telepathic openness', 'Tam Elbrun senses other minds too intensely, making him socially difficult but uniquely able to bond with Gomtuu.', 'Use Tam as a telepathic-specialist gate: his behavior is shaped by overwhelming perception, not simple arrogance.', 'character', 'character_state', 'character_snapshot', 'Tin Man', ['Tam Elbrun'], ['Starfleet'], ['Tam Elbrun', 'telepathy', 'Gomtuu']),
  c(FACTION_FILE, 'romulan-race-for-gomtuu', 'Tin Man keeps Romulans competing for strategic anomalies', 'Romulans race the Enterprise to Gomtuu, reinforcing season 3 Romulan competition over rare strategic discoveries.', 'Use Tin Man as another Romulan strategic-pressure gate. Do not import later Romulan reconciliation arcs.', 'faction', 'knowledge_gate', 'faction', 'Tin Man', ['Jean-Luc Picard', 'Tam Elbrun'], ['Romulan Star Empire', 'Starfleet'], ['Romulan competition', 'Gomtuu', 'strategic anomaly']),
  c(CREW_FILE, 'barclay-anxiety-and-holodeck-coping', 'Hollow Pursuits introduces Barclay using holodeck fantasy to cope with anxiety', 'Reginald Barclay is a gifted but anxious engineer whose holodeck fantasies distort crew relationships and interfere with duty.', 'After Hollow Pursuits, write Barclay as anxious, talented, avoidant, and in need of support rather than as a joke or villain.', 'character', 'character_state', 'behavior_constraint', 'Hollow Pursuits', ['Reginald Barclay', 'Geordi La Forge', 'Deanna Troi'], ['Starfleet'], ['Barclay', 'holodeck coping', 'social anxiety']),
  c(TECH_FILE, 'barclay-holodeck-boundary', 'Barclay\'s holodeck recreations are coping artifacts, not real crew attitudes', 'Barclay creates distorted versions of crewmates in the holodeck, but those programs reflect his anxiety and fantasy rather than the crew real feelings.', 'Do not treat Barclay holodeck versions as evidence of real crew behavior. Use them only as his internal coping and avoidance pattern.', 'rule', 'lore_gate', 'rule', 'Hollow Pursuits', ['Reginald Barclay', 'Deanna Troi'], ['Starfleet'], ['Barclay holodeck', 'fantasy boundary', 'Hollow Pursuits']),
  c(SECRET_GUARD_FILE, 'barclay-future-pathfinder-guard', 'Hollow Pursuits should not import Barclay\'s later Pathfinder role', 'Season 3 introduces Barclay as an Enterprise engineer with anxiety and holodeck avoidance, not as Voyager Pathfinder support.', 'Block Voyager Pathfinder, later Barclay accomplishments, and future contact-home material from TNG season 3.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Hollow Pursuits', ['Reginald Barclay'], ['Starfleet'], ['Barclay future guard', 'Pathfinder spoiler', 'Voyager']),
  c(SECRET_FILE, 'fajo-kidnaps-data', 'The Most Toys has Kivas Fajo kidnap Data as a collectible person', 'Kivas Fajo fakes Data death and abducts him as a rare object, making the episode a personhood and coercive-ownership gate after Measure of a Man.', 'After The Most Toys reveal, treat Data as kidnapped and objectified by Fajo, not voluntarily absent or destroyed.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Most Toys', ['Data', 'Kivas Fajo'], ['Starfleet'], ['Kivas Fajo', 'Data kidnapped', 'collector']),
  c(CREW_FILE, 'data-lethal-choice-ambiguity', 'The Most Toys leaves ambiguity around Data willingness to fire on Fajo', 'Data is found with a weapon discharged during his final confrontation with Fajo, preserving ambiguity about whether he chose lethal force.', 'Use this as a Data ethics edge case. Do not simplify it into proof that Data feels rage or proof that he is incapable of lethal judgment.', 'character', 'character_state', 'character_snapshot', 'The Most Toys', ['Data', 'Kivas Fajo'], ['Starfleet'], ['Data ethics', 'lethal force ambiguity', 'The Most Toys']),
  c(SECRET_FILE, 'data-not-dead-most-toys', 'The Most Toys death report is false once Fajo abduction is revealed', 'The crew initially believes Data died in a shuttle explosion, but the truth is Fajo abduction and deception.', 'Before the reveal, Data death may be believed. After the reveal, do not keep Data dead or missing.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Most Toys', ['Data', 'Kivas Fajo'], ['Starfleet'], ['Data death false', 'Fajo deception', 'abduction']),
  c(CREW_FILE, 'sarek-bendii-syndrome', 'Sarek reveals the ambassador is losing emotional control to Bendii syndrome', 'Sarek diplomatic mission is compromised by Bendii syndrome, which leaks intense emotions into those around him.', 'After Sarek reveal, write Sarek as still dignified and important but medically compromised by Bendii syndrome.', 'character', 'character_state', 'character_snapshot', 'Sarek', ['Sarek', 'Jean-Luc Picard'], ['Vulcans', 'Starfleet'], ['Sarek', 'Bendii syndrome', 'Legaran treaty']),
  c(CREW_FILE, 'picard-sarek-mind-meld-burden', 'Picard carries Sarek emotional burden through a mind meld', 'Picard accepts a mind meld with Sarek so the ambassador can complete negotiations, exposing Picard to overwhelming Vulcan-suppressed emotion.', 'After Sarek, Picard can carry the memory of Sarek emotional burden. Do not import later Spock/Sarek resolutions before their windows.', 'character', 'character_state', 'character_snapshot', 'Sarek', ['Jean-Luc Picard', 'Sarek'], ['Vulcans', 'Starfleet'], ['Sarek mind meld', 'Picard emotion', 'Legaran treaty']),
  c(SECRET_GUARD_FILE, 'sarek-spock-future-guard', 'Sarek should not import later Spock reunification material in season 3', 'Sarek establishes the ambassador and Picard mind-meld bond, but Spock/Romulan reunification belongs to a later TNG season.', 'Block Unification, Spock-on-Romulus, and later Sarek family resolution from season 3 scenes.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Sarek', ['Sarek', 'Spock', 'Jean-Luc Picard'], ['Vulcans', 'Romulan Star Empire'], ['Sarek future guard', 'Spock spoiler', 'Unification']),
  c(EPISODE_FILE, 'lwaxana-ferengi-abduction-local', 'Ménage à Troi uses Ferengi abduction for Lwaxana and Troi family pressure', 'Ferengi abduct Lwaxana, Deanna, and Riker, making the episode a local Ferengi leverage and Troi-family crisis.', 'Keep Ménage à Troi local to Lwaxana, Ferengi coercion, and Troi/Riker dynamics. Do not import DS9 Ferengi family politics.', 'event', 'anchor_window', 'event_moment', 'Ménage à Troi', ['Lwaxana Troi', 'Deanna Troi', 'William Riker'], ['Ferengi Alliance', 'Starfleet'], ['Lwaxana abduction', 'Ferengi', 'Troi family']),
  c(EPISODE_FILE, 'wesley-academy-delay-menage', 'Ménage à Troi delays Wesley Academy departure by keeping him aboard', 'Wesley is preparing for Starfleet Academy but remains on the Enterprise after helping resolve the Ferengi crisis.', 'Use Ménage à Troi as a Wesley Academy-delay gate: he is moving toward Academy but is not gone yet.', 'character', 'character_state', 'knowledge_gate', 'Ménage à Troi', ['Wesley Crusher'], ['Starfleet'], ['Wesley Academy', 'acting ensign', 'season 3']),
  c(TECH_FILE, 'zalkonian-transformation-local', 'Transfigurations reveals John Doe undergoing Zalkonian transformation', 'John Doe is a Zalkonian transforming into an energy-like existence, making the medical mystery a local species-evolution gate.', 'Use Transfigurations as a local transformation and persecution story. Do not generalize Zalkonian abilities into common Federation science.', 'rule', 'lore_gate', 'rule', 'Transfigurations', ['John Doe', 'Beverly Crusher'], ['Zalkonians', 'Starfleet'], ['Zalkonian transformation', 'John Doe', 'Transfigurations']),
  c(EPISODE_FILE, 'john-doe-healing-boundary', 'John Doe healing ability is tied to his transformation state', 'John Doe can heal others during his transformation, but the ability is not a Federation medical technique or ordinary power available to the crew.', 'Use John Doe healing only inside Transfigurations context. Do not give Starfleet that healing ability afterward.', 'event', 'anchor_window', 'event_moment', 'Transfigurations', ['John Doe', 'Beverly Crusher'], ['Starfleet'], ['John Doe healing', 'Zalkonian', 'medical anomaly']),
  c(FACTION_FILE, 'borg-return-best-of-both-worlds', 'The Best of Both Worlds brings the Borg threat back as a direct invasion crisis', 'The Borg return in force, destroy Jouret IV, and move toward Federation space, escalating Q Who warning into active crisis.', 'Use The Best of Both Worlds as the Borg active-threat gate. The Borg are no longer just a distant warning by this episode.', 'event', 'reveal_gate', 'event_moment', 'The Best of Both Worlds', ['Jean-Luc Picard', 'William Riker', 'Elizabeth Shelby'], ['Borg Collective', 'Starfleet'], ['Borg return', 'Jouret IV', 'Best of Both Worlds']),
  c(FACTION_FILE, 'shelby-arrives-as-borg-specialist', 'Shelby arrives as an ambitious Borg specialist and Riker challenger', 'Commander Shelby joins the crisis as a Borg specialist whose ambition and directness pressure Riker command identity.', 'Use Shelby as a Borg-crisis specialist and Riker foil. Do not keep her as a permanent Enterprise-D officer beyond this arc unless a later deck says so.', 'character', 'character_state', 'character_snapshot', 'The Best of Both Worlds', ['Elizabeth Shelby', 'William Riker'], ['Starfleet', 'Borg Collective'], ['Shelby', 'Borg specialist', 'Riker command']),
  c(SECRET_FILE, 'picard-assimilated-as-locutus-cliffhanger', 'The Best of Both Worlds ends season 3 with Picard assimilated as Locutus', 'The season 3 cliffhanger has Picard captured and transformed into Locutus, with the Borg using him against the Federation.', 'At the end of TNG season 3, Picard is Locutus and the crisis is unresolved. Do not import the season 4 rescue or aftermath into this deck.', 'secret', 'reveal_gate', 'knowledge_gate', 'The Best of Both Worlds', ['Jean-Luc Picard', 'Locutus', 'William Riker'], ['Borg Collective', 'Starfleet'], ['Locutus', 'Picard assimilated', 'cliffhanger']),
  c(CREW_FILE, 'riker-takes-command-against-locutus', 'Riker becomes acting captain against Locutus at the season 3 cliffhanger', 'After Picard assimilation, Riker takes command and orders action against the Borg cube with Picard aboard as Locutus.', 'Use Riker as acting captain in the Best of Both Worlds cliffhanger. Do not resolve whether the order works until season 4.', 'character', 'character_state', 'character_snapshot', 'The Best of Both Worlds', ['William Riker', 'Jean-Luc Picard', 'Elizabeth Shelby'], ['Starfleet', 'Borg Collective'], ['Riker acting captain', 'Locutus', 'Borg cube']),
  c(SECRET_GUARD_FILE, 'best-of-both-worlds-resolution-guard', 'TNG season 3 must not resolve the Borg cliffhanger', 'Season 3 ends before Picard rescue, Wolf 359 fallout, family recovery, and the long-term Locutus trauma aftermath.', 'Block season 4 Borg resolution facts in TNG season 3. Keep the active endpoint as Riker facing Locutus and the Borg cube.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Best of Both Worlds', ['Jean-Luc Picard', 'William Riker'], ['Borg Collective', 'Starfleet'], ['Best of Both Worlds future guard', 'Wolf 359 spoiler', 'Picard rescue']),
  c(SECRET_GUARD_FILE, 'no-hugh-or-borg-queen-season-three', 'Season 3 Borg cards must not import Hugh, Borg Queen, or Voyager Borg outcomes', 'By the end of season 3, the Borg are an invading Collective threat using Locutus; later individuality, queen, and Voyager outcomes are not active knowledge.', 'Do not import Hugh, Borg Queen, Unimatrix Zero, Seven of Nine, or Voyager Borg details into TNG season 3.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Best of Both Worlds', ['Jean-Luc Picard'], ['Borg Collective'], ['Borg future guard', 'Hugh spoiler', 'Voyager Borg']),
  c(SECRET_GUARD_FILE, 'no-ds9-dominion-maquis-season-three', 'TNG season 3 should not import DS9-era Dominion or Maquis politics', 'TNG season 3 predates DS9 and Voyager political arcs, so Dominion, Maquis, Bajoran-Emissary, and Delta Quadrant outcomes remain outside this deck.', 'Block DS9 Dominion, Maquis, Voyager, and later Cardassian politics from TNG season 3 unless another active deck supplies that Context.', 'secret', 'spoiler_guard', 'knowledge_gate', 'Evolution', ['Jean-Luc Picard'], ['Starfleet'], ['DS9 future guard', 'Dominion spoiler', 'Maquis spoiler'], { wide: true }),
  c(SECRET_GUARD_FILE, 'data-lal-and-lore-boundary-season-three', 'Season 3 Data family gates include Lal but not later Lore-Borg outcomes', 'Season 3 can use Data autonomy, Lore history, and Lal parenthood, but the later Lore-led Borg arc belongs to a future season.', 'Keep Data family facts season-local: Lal dies, Lore is not active this season, and later Descent outcomes are blocked.', 'secret', 'spoiler_guard', 'knowledge_gate', 'The Offspring', ['Data', 'Lal', 'Lore'], ['Starfleet', 'Borg Collective'], ['Data future guard', 'Lal boundary', 'Lore Borg spoiler']),
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
    const sortKey = 12000 + ((record.memoryAlphaStoryEpisode - 1) * 20);
    const runtimeEpisodes = runtimeEpisodesFor(record.memoryAlphaStoryEpisode);
    const aliases = new Set([
      record.title,
      `TNG season 3 ${record.title}`,
      `TNG S3 ${record.title}`,
      `TNG 3x${String(record.memoryAlphaStoryEpisode).padStart(2, '0')} story`,
      `TNG S03 story ${String(record.memoryAlphaStoryEpisode).padStart(2, '0')}`,
    ]);
    for (const runtimeEpisode of runtimeEpisodes) {
      aliases.add(`TNG 3x${String(runtimeEpisode).padStart(2, '0')}`);
      aliases.add(`TNG S03E${String(runtimeEpisode).padStart(2, '0')}`);
      aliases.add(`TNG season 3 episode ${runtimeEpisode}`);
    }
    return {
      id: `tng.s3.e${String(record.memoryAlphaStoryEpisode).padStart(2, '0')}.${titleSlug}`,
      label: record.title,
      contextType: 'story_anchor',
      sortKey,
      stardate: cleanDate(record.date),
      year: '2366',
      series: 'TNG',
      season: 3,
      storyEpisode: record.memoryAlphaStoryEpisode,
      runtimeEpisodes,
      episode: runtimeEpisodes.join(', '),
      aliases: [...aliases],
      tags: [...BASE_TAGS, tagId('episode', `tng-s3-${titleSlug}`)],
      sourceInfo: {
        work: 'Star Trek: The Next Generation',
        sourceType: 'episode',
        title: record.title,
        series: 'TNG',
        season: 3,
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
    season: '3',
    storyEpisode: start.storyEpisode,
    runtimeEpisodes: start.runtimeEpisodes,
    sortKeyFrom: fromAnchor.sortKey,
    sortKeyTo: toAnchor.sortKey,
    precision: card.wide ? 'season_window' : 'episode_window',
    windowKind: card.wide ? 'season' : 'bounded',
    label: card.wide ? 'TNG season 3' : `TNG season 3: ${start.label}`,
    approximate: false,
  };
}

function buildEntry(card, index, episodeMap, anchors) {
  const anchor = episodeMap.get(card.episodeTitle) || anchors[0];
  const characterTags = card.characters.map(name => tagId('character', name));
  const factionTags = card.factions.map(name => tagId('faction', name));
  const topicTags = card.topics.map(name => tagId('topic', name));
  const episodeTag = tagId('episode', `tng-s3-${slug(anchor.label)}`);
  const tags = [...new Set([...BASE_TAGS, episodeTag, ...characterTags, ...factionTags, ...topicTags])];
  return {
    schemaVersion: 3,
    id: `st_tng_s3_${card.id}`,
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
      { axis: 'season', id: 'tng-s3', label: 'TNG season 3', required: false },
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
        keywordsAny: [...new Set([...card.characters, ...card.factions, ...card.topics, anchor.label, 'TNG season 3'])],
      },
    },
    continuity: {
      continuityId: 'star-trek-prime',
      canonTier: 'primary',
      adaptation: 'television',
      medium: 'television',
      variantOf: 'star-trek-prime',
      sourceBoundary: 'Star Trek: The Next Generation season 3, Memory Alpha story rows 1-26, runtime episode aliases 1-26, primary on-screen Prime continuity.',
      notes: 'Draft reference deck. Excludes later TNG seasons, TNG films, DS9, Voyager, Picard-era material, beta canon, and fanon unless a card is an explicit future guard.',
    },
    content: {
      fact: card.fact,
      injection: card.injection,
      constraints: [
        'Keep this card inside TNG season 3 unless another active Star Trek deck provides a later Context window.',
        'Use the episode and season Context gates before injecting this fact.',
      ],
      antiLore: [
        'Do not copy Memory Alpha prose or substitute a plot recap for this gate.',
        'Do not import later TNG, DS9, Voyager, film, Picard-era, beta-canon, novel, comic, or fanon facts into this season 3 card.',
      ],
      notes: '',
    },
    sourceInfo: {
      work: 'Star Trek: The Next Generation',
      sourceType: 'episode',
      title: anchor.label,
      series: 'TNG',
      season: 3,
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
    description: `${titleCase(tag)} tag for Star Trek TNG season 3 retrieval and filtering.`,
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
      sourceBoundary: 'Star Trek: The Next Generation season 3.',
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
  const expected = path.resolve(ROOT, 'content/loredecks/star-trek-tng-season-3');
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
  if (records.length !== 26) throw new Error(`Expected 26 TNG season 3 Memory Alpha story rows, found ${records.length}.`);

  const anchors = buildAnchors(records);
  const episodeMap = new Map(anchors.map(anchor => [anchor.label, anchor]));
  const entries = CARD_BLUEPRINTS.map((card, index) => buildEntry(card, index, episodeMap, anchors));
  const groups = groupedEntries(entries);
  const files = [...groups.keys()];
  const tags = collectTags(entries, anchors);
  const entities = collectEntities(entries);
  const windows = [
    {
      id: 'tng.s3.full-season',
      label: 'TNG season 3 full window',
      anchorFrom: anchors[0].id,
      anchorTo: anchors[anchors.length - 1].id,
      sortKeyFrom: anchors[0].sortKey,
      sortKeyTo: anchors[anchors.length - 1].sortKey,
      aliases: ['TNG season 3', 'Star Trek The Next Generation season 3', 'TNG S3'],
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
    summary: 'Star Trek: The Next Generation season 3 Context anchors and episode windows.',
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
    summary: 'Resolve Star Trek: The Next Generation season 3 Context from episode titles, story rows, runtime aliases, and common TNG S3 labels.',
    preferredFields: ['series', 'season', 'episode', 'stardate', 'beforeAfter', 'majorEvent'],
    ambiguousFallback: 'use_window',
    promptAddendum: 'Prefer TNG season 3 anchors and before/after windows. Do not infer later Star Trek events unless their Loredecks are loaded.',
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
    title: 'Star Trek TNG Season 3',
    description: 'Draft season Loredeck for the mature Enterprise-D baseline, Romulan pressure, Data/Lal, Worf/Kurn/Duras, Barclay, Sarek, Yesterday\'s Enterprise, and the Borg cliffhanger.',
    fandom: 'Star Trek',
    era: 'The Next Generation Season 3',
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
      familyOrder: 30,
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
      sourceBoundary: 'Star Trek: The Next Generation season 3, Memory Alpha story rows 1-26, runtime episode aliases 1-26, primary on-screen Prime continuity. Excludes later TNG seasons, TNG films, DS9, Voyager, Picard-era material, beta canon, novels, comics, games, deleted scenes, production trivia, and fanon.',
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
      notes: 'First-pass Star Trek TNG season 3 Loredeck generated from Saga authoring plan and Memory Alpha evidence artifacts.',
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
