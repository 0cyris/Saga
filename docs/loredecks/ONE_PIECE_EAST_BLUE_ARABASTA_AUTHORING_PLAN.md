# One Piece East Blue and Arabasta Loredeck Authoring Plan

## Changelog

- Reframed the plan from expansion targets into a production authoring and audit plan for runtime Loredecks.
- Removed quota-driven language, broad coverage language, and file targets that encouraged padding.
- Preserved the reviewed 477-card family total as the current baseline, but made all count changes quality-driven and review-documented.
- Added per-arc source boundaries, continuity stance, roleplay utility goals, expected Lorecard categories, character snapshots, event gates, knowledge gates, anti-spoiler rules, world-state constraints, and include/exclude examples.
- Clarified the hybrid manga/anime policy: manga remains the canon spine; anime choices are supported where they matter for roleplay continuity; Warship Island and Post-Arabasta are explicitly anime-only/filler decks.
- Replaced wiki-summary card clusters with retrieval-oriented card prompts: lore gates, knowledge gates, character states, relationship pivots, faction pressure, setting constraints, and event moments.
- Added audit rules to keep filler from contaminating manga-primary deck assumptions unless a card is explicitly anime-continuity aware.

Workspace note: this plan has been revised against the authoring docs, the checked-in `content/loredecks/one-piece-*` deck folders, the Story Arcs source ranges, and `ONE_PIECE_LOREDECK_REVIEW_REPORT.md` as the reviewed-state source. Future count or coverage changes should update the review report with a retrieval-value reason.

## Source Boundary

- Fandom: One Piece.
- Deliverable: one Saga Loredeck per arc from Romance Dawn through Post-Arabasta.
- Primary range reference: One Piece Wiki, Story Arcs page, checked 2026-06-17.
- Covered manga range: chapters 1-217, volumes 1-24.
- Covered anime range: episodes 1-135, including anime-only Warship Island and Post-Arabasta.
- Deck family stance: hybrid manga/anime reference support for fanfic and roleplay, with strict continuity labeling.
- Canon spine: manga-backed events and reveals control manga-primary assumptions.
- Anime support: anime episode ranges, adaptation-specific pacing, and anime-only arcs may be used when they improve runtime continuity, scene placement, or shipboard roleplay support.
- Filler containment: filler material must not alter manga-primary assumptions unless the card is explicitly marked as anime-continuity or adaptation-specific.

The Story Arcs page notes that arc divisions are fluid and are commonly understood by where the Straw Hats land and leave. Use wiki ranges as source-routing metadata, not as a license to write broad arc summaries.

## Arc Decks

East Blue Saga:

- `one-piece-romance-dawn`
- `one-piece-orange-town`
- `one-piece-syrup-village`
- `one-piece-baratie`
- `one-piece-arlong-park`
- `one-piece-loguetown`
- `one-piece-warship-island` - anime-only/filler bridge

Arabasta Saga:

- `one-piece-reverse-mountain`
- `one-piece-whisky-peak`
- `one-piece-little-garden`
- `one-piece-drum-island`
- `one-piece-arabasta`
- `one-piece-post-arabasta` - anime-only/filler aftermath

## Chapter and Episode Matrix

Use this table for manifest source boundaries, timeline planning, Context windows, and audit fixtures. If a future source check disagrees with a range, mark the deck for verification instead of guessing.

| Deck | Manga Chapters | Volumes | Anime Episodes | Continuity Notes |
| --- | --- | --- | --- | --- |
| `one-piece-romance-dawn` | 1-7 | 1 | 1-4 | Manga-backed. Wiki overview also lists 1-3; use the detailed arc range 1-4 and treat episode 4 as transition overlap with Orange Town. |
| `one-piece-orange-town` | 8-21 | 1-3 | 4-8 | Manga-backed. Episode 4 overlaps transition from Romance Dawn. |
| `one-piece-syrup-village` | 22-41 | 3-5 | 9-18 | Manga-backed. Boundaries align cleanly. |
| `one-piece-baratie` | 42-68 | 5-8 | 19-30 | Manga-backed. Boundaries align cleanly. |
| `one-piece-arlong-park` | 69-95 | 8-11 | 31-44 | Manga-backed. Boundaries align cleanly. |
| `one-piece-loguetown` | 96-100 | 11-12 | 45, 48-53 | Manga-backed with anime-filler support. Episodes 50-51 are filler inside Loguetown. Episodes 46-47 adapt Buggy cover-serial material and are supplemental, not a main deck in this batch. |
| `one-piece-warship-island` | Filler arc | n/a | 54-61 | Anime-only/filler. Episodes 55 and 61 loosely adapt chapter 101 material; keep core Reverse Mountain facts in `one-piece-reverse-mountain`. |
| `one-piece-reverse-mountain` | 101-105 | 12 | 62-63 | Manga-backed. Episode 61's chapter-101 overlap belongs to Warship bridge support; Laboon, Crocus, Twin Cape, and Log Pose cards belong here. |
| `one-piece-whisky-peak` | 106-114 | 12-13 | 64-67 | Manga-backed. Episodes 68-69 adapt Diary of Koby-Meppo cover-serial material and are supplemental Marine-side support only. |
| `one-piece-little-garden` | 115-129 | 13-15 | 70-77 | Manga-backed. Boundaries align cleanly. |
| `one-piece-drum-island` | 130-154 | 15-17 | 78-91 | Manga-backed. Boundaries align cleanly. |
| `one-piece-arabasta` | 155-217 | 17-24 | 92-130 | Manga-backed with anime-filler support. Episodes 93, 98-99, and 101-102 are filler; include only show-relevant support cards if they retrieve better than canon cards. |
| `one-piece-post-arabasta` | Filler arc | n/a | 131-135 | Anime-only/filler. Character-centered aftermath immediately after Arabasta. Exclude Goat Island, Ruluka Island, Jaya, and Sky Island. |

## Card Count Governance

The reviewed family total is 477 Lorecards after removal of duplicate, meta, and wiki-like cards. Treat these counts as the current reviewed baseline, not as production quotas.

| Deck | Reviewed Lorecards | Count Posture |
| --- | ---: | --- |
| `one-piece-romance-dawn` | 34 | Stable unless a missing early-crew gate or duplicate card is found. |
| `one-piece-orange-town` | 31 | Stable unless Nami/Buggy/trio retrieval gaps are found. |
| `one-piece-syrup-village` | 37 | Stable unless Kuro deception, Usopp, or Going Merry gates are missing. |
| `one-piece-baratie` | 41 | Stable unless Sanji/Zeff, Mihawk/Zoro, or Nami departure gates are missing. |
| `one-piece-arlong-park` | 41 | Stable unless Nami/Cocoyasi/occupation gates need split cards. |
| `one-piece-loguetown` | 35 | Stable unless anime-filler support or Smoker/Tashigi gates are under-specified. |
| `one-piece-warship-island` | 25 | Stable. Add only for anime-only bridge retrieval gaps. |
| `one-piece-reverse-mountain` | 30 | Stable unless Log Pose/Laboon/Baroque Works reveal gating is weak. |
| `one-piece-whisky-peak` | 36 | Stable unless Vivi identity, Baroque Works hierarchy, or trap-town gates are weak. |
| `one-piece-little-garden` | 40 | Stable unless giant-honor, wax tactics, or illness-bridge gates are weak. |
| `one-piece-drum-island` | 44 | Stable unless Chopper/medicine/political-state gates need split cards. |
| `one-piece-arabasta` | 58 | Stable but audit Ace/Vivre Card coverage; add only if absent and retrieval-value justification is recorded. |
| `one-piece-post-arabasta` | 25 | Stable. Do not pad character vignettes into generic crew-trait cards. |

A count change is acceptable only when it creates meaningful retrieval value. Add a card when it supplies one of these missing runtime functions:

- A reveal gate or knowledge boundary that prevents spoilers.
- A character snapshot at a distinct story state.
- A relationship state change that affects dialogue, loyalty, trust, or conflict.
- An event moment that changes future scene behavior.
- A location, route, or faction constraint that affects what can happen in a scene.
- An anime-only continuity bridge that should retrieve only in an anime-aware stack.

Remove a card when it is any of these:

- A duplicate fact variant.
- A timeline anchor disguised as a Lorecard.
- A tag, manifest, or source-boundary note disguised as runtime lore.
- A broad character biography, faction summary, or arc recap.
- A future spoiler card that retrieves before the reveal window.
- A generic personality card that does not depend on the arc boundary.

Every count change must update the review report or an equivalent audit note with the card ID, deck, delta, and reason.

## Runtime Authoring Rules

### Lorecard Jobs

Each Lorecard must do one runtime job. Valid jobs include:

- Character snapshot: what a character knows, wants, hides, fears, believes, can do, cannot do, or is likely to attempt at a specific story point.
- Event gate: a moment that changes the scene state, route, faction pressure, relationship state, or available knowledge.
- Knowledge gate: information that is public, private, hidden, rumored, misunderstood, or not yet revealed.
- Relationship state: trust, suspicion, loyalty, obligation, rivalry, debt, deception, protection, or emotional pivot.
- Setting constraint: location access, geography, climate, local law, travel condition, ship state, medical limit, or battlefield condition.
- Faction pressure: active pursuit, occupation, bounty-hunter trap, Marine pressure, Baroque Works secrecy, rebel/royal conflict, or local authority.
- Ability/rule constraint: Devil Fruit behavior as the arc presents it, weapon limitation, combat matchup logic, Log Pose routing, or sea hazard.
- Anti-lore guard: a negative instruction that prevents future canon or filler from leaking when the retrieval condition is likely to trigger leakage.

A card should make the model behave differently in-scene. If a card only says what an arc is about, delete it or rewrite it into one of the jobs above.

### Card Shape

For each card, the author must be able to answer these before drafting:

- What current Context window makes this card eligible?
- What exact words, entities, or topics should retrieve it?
- Who knows this information at this point?
- Is the information true, hidden, rumored, contested, misunderstood, or future-locked?
- What should the model do differently when this card is injected?
- What future canon or filler should this card block?

Use schema-supported categories only. For One Piece, common categories should be:

- `character` for snapshots.
- `event` for irreversible moments.
- `relationship` for trust, loyalty, debt, rivalry, deception, or protection states.
- `knowledge` or `secret` for reveal gates and hidden facts.
- `location` for scene constraints.
- `faction` for organizations and active pressure.
- `rule` for Devil Fruit, navigation, sea, combat, or local political constraints.
- `item` for named objects such as the straw hat, Going Merry, Log Pose, Clima-Tact, swords, Vivre Card, Poneglyph, Pluton, or weapons.

Avoid using `timeline` unless the card has runtime injection value beyond what belongs in `timeline.json`.

### Context Model

Use one shared One Piece chronology scale so stacked decks behave predictably:

| Sort Key Band | Scope |
| ---: | --- |
| 1000-1999 | Romance Dawn |
| 2000-2999 | Orange Town |
| 3000-3999 | Syrup Village |
| 4000-4999 | Baratie |
| 5000-5999 | Arlong Park |
| 6000-6999 | Loguetown |
| 7000-7999 | Warship Island |
| 8000-8999 | Reverse Mountain |
| 9000-9999 | Whisky Peak |
| 10000-10999 | Little Garden |
| 11000-11999 | Drum Island |
| 12000-12999 | Arabasta |
| 13000-13999 | Post-Arabasta |

Each deck should define timeline windows broad enough for user selection and narrow enough to prevent spoiler leakage:

- Arc start.
- Local arrival or first contact.
- Pre-reveal state.
- Reveal or betrayal state.
- Active conflict or battle state.
- Climax state.
- Aftermath and departure state.

Do not create a Lorecard merely to restate a timeline window. Timeline windows belong in `timeline.json`; Lorecards should retrieve because they change scene behavior.

### Continuity and Filler Policy

Use these labels consistently:

- Manga-backed card: `continuity:one-piece-manga-main`, plus arc tag.
- Anime-aware adaptation card inside a manga-backed arc: `continuity:one-piece-anime-main`, `adaptation:anime`, and an episode-specific source note if possible.
- Anime-only/filler deck card: `continuity:one-piece-anime-main`, `adaptation:anime`, `topic:show-only`, and the arc tag.
- Filler containment card, if needed: narrow `retrieval` and `context` so show-only material retrieves only when the active story is explicitly anime-continuity aware.

Warship Island and Post-Arabasta may be loaded for anime-continuity sessions. Manga-primary sessions should be able to omit those decks without losing manga-required facts.

### Global Spoiler Discipline

Do not import later canon into these decks unless the covered source itself presents it. Specifically exclude:

- Haki explanations, Haki naming before source support, Gear techniques, awakening, or later Devil Fruit taxonomy.
- Later truth about Luffy's Devil Fruit.
- Later Shanks, Dragon, Mihawk, Smoker, Tashigi, Buggy, Alvida, Coby, or Helmeppo developments.
- Sogeking, Usopp's later weapons, Sanji's family history, Zoro's later sword lore, Nami's later Clima-Tact upgrades, or Chopper's later forms.
- Brook, Laboon's later crew connection, and later Grand Line history.
- Jinbe, Fisher Tiger, Sun Pirates history, Fish-Man Island history, or later Fish-Man discrimination exposition beyond what Arlong Park itself supports.
- Robin's Ohara backstory, CP9, Enies Lobby, Void Century exposition beyond the Arabasta-presented terms.
- Pluton, Poneglyph, Ancient Weapon, Void Century, or World Government explanations beyond Arabasta-presented knowledge.
- Jaya, Skypiea, Goat Island, Ruluka Island, G-8, and later anime-only arcs.

A card may mention a future-locked topic only as an anti-spoiler guard if there is a real risk of leakage. Do not create standalone cards whose only purpose is to say later material belongs elsewhere.

### Registry Strategy

Each deck needs deck-local registries for tags, timeline anchors, and major aliases. Shared tag names should remain stable across the family.

Recommended tag families:

- `fandom:one-piece`
- `continuity:one-piece-manga-main`
- `continuity:one-piece-anime-main`
- `adaptation:anime`
- `saga:east-blue`
- `saga:arabasta`
- `arc:*`
- `character:*`
- `crew:straw-hats`
- `faction:*`
- `location:*`
- `item:*`
- `topic:*`
- `relationship:*`
- `spoiler:*`

Do not register unused tags. Do not create one-off tags when `retrieval.entities`, `retrieval.topics`, `scope`, or keywords are enough.

### File Layout

Entry files should be grouped by authoring function, not by artificial quotas. Most decks should have multiple focused files, but small anime-only decks do not need padding.

Recommended file groups:

- `characters-and-snapshots.json`
- `relationships-and-crew-state.json`
- `locations-and-setting-constraints.json`
- `factions-and-pressure.json`
- `events-and-state-changes.json`
- `knowledge-and-spoiler-gates.json`
- `rules-items-and-abilities.json`

Use arc-specific filenames where clearer, for example `nami-cocoyasi-and-arlong.json` or `baroque-works-endgame.json`. Avoid `timeline-and-spoiler-gates.json` as a bucket for meta cards; timeline belongs in `timeline.json`, and spoiler gates should sit beside the runtime facts they protect.

### Cross-Deck Entity and Alias Rules

Use aliases consistently, but do not expose future aliases early.

- Monkey D. Luffy: Luffy, Straw Hat, Mugiwara when useful.
- Roronoa Zoro: Zoro, Pirate Hunter Zoro; avoid later sword-title overreach.
- Nami: Nami, navigator, thief, cat burglar only where arc-appropriate.
- Usopp: Usopp; exclude Sogeking until later continuity.
- Sanji: Sanji, cook; exclude later family material and later title dependence.
- Tony Tony Chopper: Chopper, Tony Tony Chopper.
- Going Merry: Merry, Going Merry.
- Vivi: Miss Wednesday before reveal; Nefertari Vivi or Princess Vivi after reveal.
- Igaram: Mr. 8 before reveal; Igaram after reveal.
- Crocodile: Sir Crocodile or Mr. 0 only where source window supports the identity.
- Nico Robin: Miss All Sunday before name reveal; Nico Robin after reveal.
- Arabasta: use `Arabasta` as deck spelling and include `Alabasta` as an alias.

Keep Japanese honorifics out unless a card is specifically about a named relationship or source line where the honorific changes roleplay behavior.

## Deck Plan: Romance Dawn

Package ID: `one-piece-romance-dawn`

Reviewed baseline: 34 Lorecards.

### Source Boundary

- Manga: chapters 1-7, volume 1.
- Anime: episodes 1-4.
- Continuity stance: manga-backed with anime episode 4 treated as a transition overlap into Orange Town.

### Roleplay Utility Goals

- Establish early Luffy without later fruit, family, or world-role spoilers.
- Establish Koby's courage pivot and Marine aspiration.
- Establish Zoro's first crew-state: feared bounty hunter, captive swordsman, conditional ally.
- Support Foosha flashback, Alvida ship, Shells Town, Morgan tyranny, and first crew formation scenes.

### Expected Lorecard Categories

- `character`: Luffy, Shanks, Koby, Alvida, Zoro, Morgan, Helmeppo, Rika.
- `relationship`: Luffy/Koby, Luffy/Zoro, Shanks/Luffy promise.
- `event`: straw hat promise, Koby defiance, Zoro release, Morgan defeat.
- `location`: Foosha Village, Alvida ship, Shells Town, execution yard.
- `rule`: rubber-body basics as observed, early pirate/Marine reputation rules.
- `item`: straw hat, Zoro's swords.

### Key Character Snapshots

- Luffy after leaving Foosha: determined to become Pirate King, already defined by Shanks's promise, reckless but loyalty-driven.
- Shanks in flashback: pirate mentor and straw-hat giver; no later status details.
- Koby before and after Luffy's intervention: captive cowardice to stated Marine dream.
- Zoro at Shells Town: restrained by promise, hungry, reputation-heavy, not yet loyal to Luffy until the rescue choice.
- Morgan and Helmeppo: corrupt local Marine authority; not a general Marine summary.

### Key Event Gates

- `op-romance-dawn-foosha-flashback`
- `op-romance-dawn-alvida-ship`
- `op-romance-dawn-coby-defiance`
- `op-romance-dawn-shells-town-arrival`
- `op-romance-dawn-zoro-execution-yard`
- `op-romance-dawn-morgan-defeat`
- `op-romance-dawn-departure`

### Key Knowledge Gates

- Gomu Gomu behavior is strange rubber-body behavior only; do not explain later Devil Fruit classes.
- Koby knows Luffy helped him but chooses Marines, not piracy.
- Shells Town civilians know Morgan's rule has fallen after the climax.
- Zoro's loyalty starts as a direct consequence of Luffy retrieving the swords and opposing Morgan.

### Anti-Spoiler and Anti-Lore Rules

- No later Shanks status, Haki, Nika, Revolutionary Army, Marineford, or East Blue future-bounty facts.
- No later Coby or Helmeppo development.
- No broad Marine hierarchy beyond local base corruption.
- No full Straw Hat crew summary.

### Location/Faction/World-State Constraints

- East Blue sea travel is small-boat and low-resource at this point.
- The crew is not yet a formal shipboard group; navigation is an unresolved need.
- Marines are morally variable; Morgan is local corruption, not proof that all Marines are corrupt.

### High-Value Cards To Include

- `Luffy's Straw Hat Promise Before Crew Formation`
- `Koby States His Marine Dream After Luffy's Challenge`
- `Zoro's Execution-Yard Restraint Under Helmeppo's Broken Promise`
- `Luffy Returns Zoro's Swords And Creates The First Crew Bond`

### Low-Value/Wiki-Like Cards To Exclude

- `Romance Dawn Arc Summary`
- `Monkey D. Luffy Biography`
- `All Early Marines Explained`
- `The Straw Hat Pirates Full Crew History`

## Deck Plan: Orange Town

Package ID: `one-piece-orange-town`

Reviewed baseline: 31 Lorecards.

### Source Boundary

- Manga: chapters 8-21, volumes 1-3.
- Anime: episodes 4-8.
- Continuity stance: manga-backed with episode 4 transition overlap.

### Roleplay Utility Goals

- Support provisional Luffy/Zoro/Nami scenes before true crew trust.
- Gate Nami's anti-pirate stance and hidden motive without revealing Arlong Park.
- Establish Buggy's danger, theatrical cruelty, and Devil Fruit contrast.
- Support Orange Town civilian stakes, Chouchou, Boodle, pet shop, and treasure conflict.

### Expected Lorecard Categories

- `character`: Nami, Buggy, Cabaji, Mohji, Richie, Boodle, Chouchou.
- `relationship`: provisional trio trust, Nami/Buggy bargain, Luffy/Nami early trust gap.
- `event`: cage/cannon pressure, pet shop destruction, Cabaji duel, Buggy defeat.
- `location`: Orange Town, pet shop, Buggy occupation space.
- `faction`: Buggy Pirates.
- `rule`: Chop-Chop combat implications, rubber/slicing contrast.

### Key Character Snapshots

- Nami as thief-navigator who hates pirates and cooperates transactionally.
- Luffy as instantly trustful but unwilling to accept attacks on loyalty or civilians.
- Zoro as injured but still combat-reliable.
- Buggy as comedic in presentation but dangerous to the town.
- Chouchou as nonverbal loyalty stake; not a generic animal card.

### Key Event Gates

- `op-orange-town-arrival`
- `op-orange-town-nami-bargain`
- `op-orange-town-buggy-occupation`
- `op-orange-town-pet-shop`
- `op-orange-town-cabaji-duel`
- `op-orange-town-buggy-defeat`
- `op-orange-town-departure`

### Key Knowledge Gates

- Nami's Arlong connection is hidden; her money motive should read as unexplained or private.
- Buggy and Shanks history can be mentioned only as arc-relevant rivalry, not later crew/world context.
- Nami is not yet a fully trusted or emotionally open crewmate.

### Anti-Spoiler and Anti-Lore Rules

- Do not reveal Arlong, Bellemere, Cocoyasi, or Nami's true reason for collecting money.
- Do not import Buggy's later status or broader Roger/Shanks past.
- Do not create generic treasure or clown cards.

### Location/Faction/World-State Constraints

- Orange Town is under active pirate occupation during the arc.
- Civilian damage and evacuation matter to scene stakes.
- The trio lacks a stable shipboard routine and formal navigator trust.

### High-Value Cards To Include

- `Nami Cooperates Without Calling Herself A Pirate`
- `Buggy Ball As Civilian Intimidation`
- `Chouchou Guards The Pet Shop As Local Emotional Stake`
- `Zoro Fights Cabaji While Injured`

### Low-Value/Wiki-Like Cards To Exclude

- `Buggy The Clown Full Character Summary`
- `Nami's Complete Backstory`
- `Orange Town Arc Plot Recap`
- `Devil Fruits Explained Generally`

## Deck Plan: Syrup Village

Package ID: `one-piece-syrup-village`

Reviewed baseline: 37 Lorecards.

### Source Boundary

- Manga: chapters 22-41, volumes 3-5.
- Anime: episodes 9-18.
- Continuity stance: manga-backed.

### Roleplay Utility Goals

- Support Usopp's liar/coward/defender tension at precise scene states.
- Gate Kuro's Klahadore persona and assassination plot.
- Support Kaya mansion, village defense, children, and Going Merry handoff scenes.
- Establish Going Merry as first proper ship without later Water 7 material.

### Expected Lorecard Categories

- `character`: Usopp, Kaya, Merry, Kuro/Klahadore, Jango, Buchi, Sham, Usopp Pirates.
- `relationship`: Usopp/Kaya, Usopp/village, Luffy/Usopp recruitment recognition.
- `secret`: Klahadore identity, Kuro plan, hypnosis threat.
- `event`: plan reveal, slope defense, Kuro defeat, Merry gift.
- `location`: Syrup Village, Kaya's mansion, coast/slope battlefield.
- `item`: Going Merry.

### Key Character Snapshots

- Usopp before reveal: liar and storyteller whose social credibility is damaged.
- Usopp after plot reveal: terrified but committed to defending a village that does not believe him.
- Kaya before betrayal: sheltered, ill, emotionally reliant on Usopp's visits.
- Kuro as Klahadore: controlled servant persona hiding contempt and murder plan.
- Merry: loyal household steward and ship-gift bridge.

### Key Event Gates

- `op-syrup-village-arrival`
- `op-syrup-village-kaya-visits`
- `op-syrup-village-kuro-plan-reveal`
- `op-syrup-village-village-defense`
- `op-syrup-village-kuro-defeat`
- `op-syrup-village-going-merry-gift`
- `op-syrup-village-departure`

### Key Knowledge Gates

- Before reveal, Klahadore's identity should not retrieve as Kuro unless the scene has the correct Context.
- The village generally does not believe Usopp because of prior lies.
- Going Merry is a gratitude gift, not loot.
- Usopp joins without public credit for saving the village.

### Anti-Spoiler and Anti-Lore Rules

- No Sogeking, Kabuto, later sniper upgrades, or Water 7 Going Merry spirit material.
- Do not turn Usopp's father wound into later Red Hair crew exposition.
- Do not write a Black Cat Pirates encyclopedia card.

### Location/Faction/World-State Constraints

- The mansion, coast, and slope determine ambush routes and defense timing.
- The Black Cat Pirates are a returning threat under Kuro's hidden plan, not a permanent East Blue institution.
- Kaya's illness and isolation constrain what she can know or do.

### High-Value Cards To Include

- `Klahadore Persona Before Kuro Reveal`
- `Usopp Tells The Truth No One Believes`
- `Slope Defense Timing Against Black Cat Landing`
- `Going Merry Given As Gratitude After The Battle`

### Low-Value/Wiki-Like Cards To Exclude

- `Syrup Village Arc Summary`
- `Usopp Complete Personality Profile`
- `Going Merry Full Ship History`
- `Black Cat Pirates General Overview`

## Deck Plan: Baratie

Package ID: `one-piece-baratie`

Reviewed baseline: 41 Lorecards.

### Source Boundary

- Manga: chapters 42-68, volumes 5-8.
- Anime: episodes 19-30.
- Continuity stance: manga-backed.

### Roleplay Utility Goals

- Support Sanji/Zeff food ethics, debt, dream, and goodbye.
- Establish Baratie as rough neutral refuge and siege location.
- Establish Grand Line power scale through Krieg's collapse and Mihawk's arrival.
- Gate Nami's departure as unresolved betrayal/agenda without Arlong Park reveal.

### Expected Lorecard Categories

- `character`: Sanji, Zeff, Don Krieg, Gin, Pearl, Mihawk, Patty, Carne.
- `relationship`: Sanji/Zeff debt, Luffy/Sanji recruitment, Zoro/Luffy vow, Nami/crew trust fracture.
- `event`: Gin fed, Krieg siege, Mihawk duel, Nami departure, Sanji goodbye.
- `location`: Baratie restaurant/deck, sea battlefield.
- `faction`: Krieg Pirates, Baratie cooks.
- `rule`: feeding the hungry, hands-for-cooking rule, Grand Line scale shock.

### Key Character Snapshots

- Sanji before joining: cook who fights with kicks, protects his hands, feeds the hungry, and hides attachment to Zeff behind conflict.
- Zeff: hard authority figure whose cruelty is often protective pressure.
- Gin: enemy subordinate with hunger debt and loyalty conflict.
- Krieg: armored opportunist trying to seize Baratie after Grand Line failure.
- Zoro after Mihawk duel: defeated but vow-bound to never lose again before Luffy.

### Key Event Gates

- `op-baratie-arrival`
- `op-baratie-gin-fed`
- `op-baratie-krieg-landing`
- `op-baratie-mihawk-arrival`
- `op-baratie-zoro-duel`
- `op-baratie-nami-departure`
- `op-baratie-krieg-siege`
- `op-baratie-sanji-goodbye`
- `op-baratie-arlong-course`

### Key Knowledge Gates

- Mihawk may be framed as the world's greatest swordsman and extreme scale-setter; do not expand into later Warlord system details beyond this arc's use.
- Nami's departure should retrieve as suspicious and urgent, not as her full backstory.
- Sanji's All Blue dream is valid recruitment motivation; no later lineage.
- Krieg's Grand Line loss should read as threat-scale evidence, not as a full Grand Line guide.

### Anti-Spoiler and Anti-Lore Rules

- No Sanji family, Germa, later techniques, or bounty/title material.
- No later Mihawk/Shanks relationship details beyond arc-supported rivalry/scale.
- No Arlong Park backstory before pursuit Context.
- No complete Seven Warlords explainer.

### Location/Faction/World-State Constraints

- Baratie is a ship-restaurant with cooks who can fight and a moral rule about feeding hungry people.
- The siege damages the restaurant and creates debt/obligation pressure.
- The crew is split once Nami leaves with the ship and treasure.

### High-Value Cards To Include

- `Sanji Feeds Starving Gin Despite Enemy Risk`
- `Zeff's Debt Holds Sanji At Baratie Until Goodbye`
- `Mihawk Duel Resets Zoro's Dream State`
- `Nami Leaves With The Going Merry And Unexplained Agenda`

### Low-Value/Wiki-Like Cards To Exclude

- `Sanji Full Backstory And Future Family`
- `The Seven Warlords Explained`
- `Baratie Arc Summary`
- `Grand Line Complete Worldbuilding`

## Deck Plan: Arlong Park

Package ID: `one-piece-arlong-park`

Reviewed baseline: 41 Lorecards.

### Source Boundary

- Manga: chapters 69-95, volumes 8-11.
- Anime: episodes 31-44.
- Continuity stance: manga-backed.

### Roleplay Utility Goals

- Support Nami's pre-reveal mask, post-reveal vulnerability, and official crew bond.
- Establish Cocoyasi's occupation, tribute system, map-room coercion, and Marine corruption.
- Support Arlong Park battles with matchup-specific constraints.
- Gate fish-man, Warlord, and Jinbe mentions as arc-local knowledge only.

### Expected Lorecard Categories

- `character`: Nami, Bellemere, Nojiko, Genzo, Arlong, Hachi, Kuroobi, Chew, Nezumi.
- `relationship`: Nami/Luffy trust pivot, Nami/Cocoyasi burden, Nami/Nojiko, Bellemere/daughters.
- `secret`: Nami's village-saving motive, Arlong's false buyback promise, Nezumi betrayal.
- `event`: Nami backstory reveal, Nezumi confiscation, help request, Arlong Park march, map-room destruction.
- `location`: Cocoyasi Village, orange grove, Arlong Park, map room.
- `faction`: Arlong Pirates, corrupt Marines.
- `rule`: fish-man strength and underwater advantage as arc-local combat facts.

### Key Character Snapshots

- Nami before reveal: apparently betrays crew for money; true motive hidden.
- Nami after Nezumi betrayal: broken strategy, asks Luffy for help, accepts hat trust.
- Arlong: occupier who uses money, violence, fish-man superiority rhetoric, and coercion.
- Nojiko and Genzo: protect Nami emotionally while understanding her burden.
- Luffy: refuses to process explanations until Nami personally asks, then treats her prison as the enemy.

### Key Event Gates

- `op-arlong-park-arrival`
- `op-arlong-park-cocoyasi-tension`
- `op-arlong-park-nami-backstory`
- `op-arlong-park-nezumi-betrayal`
- `op-arlong-park-help-request`
- `op-arlong-park-assault`
- `op-arlong-park-map-room`
- `op-arlong-park-aftermath`

### Key Knowledge Gates

- Before the backstory window, Nami's true motive and Bellemere history are hidden.
- Arlong's buyback promise is believed or acted upon by Nami until betrayal; after betrayal, it is exposed as control.
- Jinbe and Warlord mentions are name/rumor-level, not later history.
- Nami officially joins only after the conflict resolves.

### Anti-Spoiler and Anti-Lore Rules

- No Fish-Man Island, Fisher Tiger, Sun Pirates, Jinbe history, or later fish-man politics.
- No future Hachi redemption unless active Context reaches later canon.
- No later Nami weather tools or crew dynamics.
- Do not turn Arlong's prejudice into a general-series race-history essay.

### Location/Faction/World-State Constraints

- Cocoyasi is an occupied community under tribute and intimidation.
- Arlong Park is a fortress and symbol of rule.
- The map room is Nami's prison/workplace; its destruction changes her emotional state.
- Marines can be corrupt locally through Nezumi without making all Marines corrupt.

### High-Value Cards To Include

- `Nami's Money Hoard As Cocoyasi Buyback Strategy`
- `Nezumi Confiscates The Savings And Breaks Nami's Plan`
- `Luffy Gives Nami The Straw Hat After She Asks For Help`
- `Map Room Destruction As Nami's Prison Breaking`

### Low-Value/Wiki-Like Cards To Exclude

- `Nami Biography`
- `Fish-Men Full Race History`
- `Arlong Pirates Overview`
- `Arlong Park Arc Summary`

## Deck Plan: Loguetown

Package ID: `one-piece-loguetown`

Reviewed baseline: 35 Lorecards.

### Source Boundary

- Manga: chapters 96-100, volumes 11-12.
- Anime: episodes 45 and 48-53.
- Continuity stance: manga-backed with anime support. Episodes 50-51 are filler inside Loguetown; episodes 46-47 are Buggy cover-serial adaptation and supplemental only.

### Roleplay Utility Goals

- Support Loguetown as Grand Line threshold and Roger legacy site.
- Establish Smoker and Tashigi as Marine pressure with distinct justice behaviors.
- Support Buggy/Alvida revenge pressure and execution-platform scene.
- Keep Dragon mysterious and unexplainable inside this source boundary.

### Expected Lorecard Categories

- `character`: Smoker, Tashigi, Buggy, Alvida, Dragon, Luffy, Zoro.
- `relationship`: Smoker/Luffy pursuit, Tashigi/Zoro resemblance tension, enemy alliance pressure.
- `event`: provisioning, sword shop, execution platform, lightning/storm escape, Grand Line departure.
- `location`: Loguetown, execution platform, Marine base, shops, harbor.
- `faction`: Marines, Buggy/Alvida alliance.
- `rule`: Smoke power as early hard counter, seastone if source-supported, Grand Line entry pressure.
- `item`: Sandai Kitetsu, Yubashiri, Log Pose if applicable to preparation scenes.

### Key Character Snapshots

- Smoker: local Marine captain who does not treat pirate escape as acceptable; physically difficult for Luffy at this stage.
- Tashigi: sword-focused Marine whose resemblance affects Zoro but does not equal later lore.
- Buggy and Alvida: hostile returnees using public execution chaos.
- Dragon: unidentified intervention; no motive explanation.
- Crew: final East Blue readiness before Grand Line entry.

### Key Event Gates

- `op-loguetown-arrival`
- `op-loguetown-shopping`
- `op-loguetown-smoker-contact`
- `op-loguetown-sword-shop`
- `op-loguetown-platform`
- `op-loguetown-storm-escape`
- `op-loguetown-reverse-mountain-course`

### Key Knowledge Gates

- Roger's execution platform is public legend and motivation; do not explain later pirate-era history beyond this arc.
- Dragon's identity, role, and motives are unknown.
- Alvida's changed body/power is visible, but later alliance/status material is excluded.
- Smoker's smoke power can be treated as a practical early combat problem without broader Logia taxonomy unless source-specific.

### Anti-Spoiler and Anti-Lore Rules

- No Revolutionary Army explanation.
- No later Smoker/Tashigi Grand Line arcs.
- No later Buggy/Alvida status.
- No Haki, Gear, or later Roger history.
- Do not create cards for episodes 50-51 unless they provide distinct anime-session retrieval value.

### Location/Faction/World-State Constraints

- Loguetown is the last major stop before the Grand Line.
- Marines have active control and Smoker applies direct pursuit pressure.
- Storm, harbor, and Reverse Mountain course constrain departure.

### High-Value Cards To Include

- `Smoker's Smoke Power Blocks Early Luffy's Usual Fighting Logic`
- `Tashigi's Sword Interest And Zoro Resemblance Tension`
- `Execution Platform Turns Roger Legacy Into Immediate Luffy Risk`
- `Dragon Intervention Remains Unexplained At Loguetown Boundary`

### Low-Value/Wiki-Like Cards To Exclude

- `Gol D. Roger Complete History`
- `Revolutionary Army Explained`
- `Logia Devil Fruits Full Taxonomy`
- `Loguetown Arc Summary`

## Deck Plan: Warship Island

Package ID: `one-piece-warship-island`

Reviewed baseline: 25 Lorecards.

### Source Boundary

- Manga: none; anime-only/filler arc.
- Anime: episodes 54-61.
- Continuity stance: anime-only. Include only when the active stack is anime-continuity aware.

### Roleplay Utility Goals

- Provide a clean anime bridge between Loguetown and Reverse Mountain.
- Support Apis, Ryu, Lost Island, Warship Island, Eric, Nelson, and dragon-protection scenes.
- Prevent show-only dragon lore from leaking into manga-primary decks.
- Route episode-55 and episode-61 chapter-101 overlaps without moving Laboon/Crocus facts out of Reverse Mountain.

### Expected Lorecard Categories

- `character`: Apis, Ryu, Eric, Nelson Royale, Straw Hat snapshots during detour.
- `relationship`: Apis/crew trust, Apis/Ryu protection bond.
- `event`: Apis rescue, Lost Island search, Marine chase, dragon resolution, Reverse Mountain bridge.
- `location`: Warship Island, Lost Island, sea route toward Reverse Mountain.
- `faction`: Nelson's Marine force, Eric as antagonist.
- `rule`: anime-only dragon-lore and pursuit constraints.

### Key Character Snapshots

- Apis: runaway child tied to Warship Island and Ryu; show-only continuity.
- Ryu: elderly Thousand Year Dragon requiring protection; no manga species assumption.
- Eric: wind-cutting threat as anime-only antagonist.
- Nelson Royale: Marine antagonist pursuing dragon-bone/selfish motive as show presents it.
- Straw Hats: willing to help without changing the manga-core Grand Line route.

### Key Event Gates

- `op-warship-island-post-loguetown`
- `op-warship-island-apis-rescue`
- `op-warship-island-ryu-protection`
- `op-warship-island-lost-island-search`
- `op-warship-island-marine-pursuit`
- `op-warship-island-dragon-resolution`
- `op-warship-island-reverse-mountain-bridge`

### Key Knowledge Gates

- All dragon lore in this deck is anime-only.
- Chapter-101 overlap should not duplicate Laboon, Crocus, or core Log Pose cards.
- Reverse Mountain approach can retrieve here only as route bridge, not as Twin Cape resolution.

### Anti-Spoiler and Anti-Lore Rules

- Do not add dragons or Apis to manga-primary world assumptions.
- Do not rewrite Marine behavior in manga decks based on Nelson's conduct.
- Do not create generic Straw Hat personality cards from filler scenes.
- Omit uncertain Warship details rather than inventing continuity glue.

### Location/Faction/World-State Constraints

- This arc exists between East Blue departure and Grand Line entry only in anime continuity.
- Warship/Lost Island geography should not be referenced by manga-primary navigation cards.
- Marine pursuit is local to this filler conflict.

### High-Value Cards To Include

- `Apis And Ryu Are Anime-Only Protection Stakes`
- `Lost Island Search As Show-Continuity Detour`
- `Eric's Wind-Cutting Threat During Marine Pursuit`
- `Episode-61 Bridge Does Not Own Laboon Or Crocus Facts`

### Low-Value/Wiki-Like Cards To Exclude

- `One Piece Dragons Explained`
- `Warship Island Arc Summary`
- `All Anime Filler Continuity Notes`
- `Generic Straw Hat Crew Helps Children`

## Deck Plan: Reverse Mountain

Package ID: `one-piece-reverse-mountain`

Reviewed baseline: 30 Lorecards.

### Source Boundary

- Manga: chapters 101-105, volume 12.
- Anime: episodes 62-63, with episode 61 overlap handled as Warship bridge.
- Continuity stance: manga-backed.

### Roleplay Utility Goals

- Establish Grand Line entry mechanics and the first navigation shock.
- Support Twin Cape, Laboon, Crocus, whale interior, and promise scenes.
- Gate Miss Wednesday/Mr. 9 as Baroque Works agents before Vivi reveal.
- Establish Log Pose basics without turning the deck into a navigation encyclopedia.

### Expected Lorecard Categories

- `character`: Laboon, Crocus, Miss Wednesday, Mr. 9, Luffy.
- `relationship`: Luffy/Laboon promise, Crocus/Laboon caretaking.
- `event`: Reverse Mountain crossing, whale collision, Laboon fight-promise, Whisky Peak invitation.
- `location`: Reverse Mountain, Red Line, Twin Cape, lighthouse, Laboon interior.
- `rule`: currents, Grand Line weather, Log Pose island-magnetism basics.
- `faction`: Baroque Works first contact.

### Key Character Snapshots

- Laboon: lonely whale waiting at Twin Cape, hurting himself against the mountain.
- Crocus: lighthouse keeper/doctor, caretaker, knowledgeable but not a full exposition machine.
- Miss Wednesday and Mr. 9: suspicious whale hunters; true identities gated.
- Luffy: reframes Laboon's grief into a promise by fighting him and marking him.

### Key Event Gates

- `op-reverse-mountain-approach`
- `op-reverse-mountain-current`
- `op-reverse-mountain-twin-cape`
- `op-reverse-mountain-laboon-interior`
- `op-reverse-mountain-laboon-promise`
- `op-reverse-mountain-baroque-hook`
- `op-reverse-mountain-departure`

### Key Knowledge Gates

- Miss Wednesday's royal identity is hidden.
- Baroque Works should read as a suspicious organization, not fully explained.
- Laboon's later connection to Brook is future-locked.
- Log Pose basics should cover immediate route behavior only.
- Laugh Tale/Raftel, if referenced, must stay term-level and source-bound.

### Anti-Spoiler and Anti-Lore Rules

- No Brook or Rumbar Pirates reveal.
- No full Grand Line geography beyond current route need.
- No Vivi identity before Whisky Peak reveal.
- No Baroque Works full hierarchy before Whisky Peak/Arabasta gates.

### Location/Faction/World-State Constraints

- Reverse Mountain currents are dangerous and directional.
- Twin Cape is the first Grand Line stop.
- The crew now needs Log Pose logic rather than East Blue navigation habits.

### High-Value Cards To Include

- `Reverse Mountain Current Forces The Grand Line Entry Route`
- `Crocus Treats Laboon Without Solving His Waiting Grief`
- `Luffy's Painted Mark Turns Laboon's Pain Into A Promise`
- `Miss Wednesday And Mr. 9 Are Suspicious Before Vivi Reveal`

### Low-Value/Wiki-Like Cards To Exclude

- `Grand Line Complete Geography`
- `Laboon Full Series History`
- `Baroque Works Explained Entirely`
- `Reverse Mountain Arc Summary`

## Deck Plan: Whisky Peak

Package ID: `one-piece-whisky-peak`

Reviewed baseline: 36 Lorecards.

### Source Boundary

- Manga: chapters 106-114, volumes 12-13.
- Anime: episodes 64-67.
- Continuity stance: manga-backed. Episodes 68-69 cover-serial adaptation is supplemental Marine-side material, not part of this deck's main scope.

### Roleplay Utility Goals

- Establish Whisky Peak as a bounty-hunter trap town.
- Gate Baroque Works hierarchy, codenames, and secrecy without revealing all Arabasta endgame facts.
- Support Vivi/Igaram identity reveal and escort decision.
- Support Zoro's trap read and Luffy/Zoro misunderstanding.

### Expected Lorecard Categories

- `character`: Vivi/Miss Wednesday, Igaram/Mr. 8, Zoro, Nami, Luffy, Mr. 5, Miss Valentine, Miss Monday, Mr. 9, Miss All Sunday.
- `relationship`: Vivi/crew escort trust, Igaram/Vivi protection, Luffy/Zoro misunderstanding, Nami/crew practicality.
- `secret`: Vivi's identity, Igaram's identity, Mr. 0 hidden leadership.
- `event`: trap reveal, Zoro's solo fight, Vivi reveal, officer-agent attack, Igaram decoy, Robin pressure.
- `location`: Whisky Peak, celebration streets, harbor.
- `faction`: Baroque Works, bounty hunters.
- `rule`: codename hierarchy and punishment for exposed identities.

### Key Character Snapshots

- Vivi before reveal: Miss Wednesday, apparently comic threat tied to Baroque Works.
- Vivi after reveal: princess acting undercover to save Arabasta.
- Igaram: protector whose theatrical habits do not reduce his loyalty.
- Zoro: alert enough to read the trap while others sleep.
- Miss All Sunday: ominous outsider with unclear allegiance and superior knowledge.

### Key Event Gates

- `op-whisky-peak-arrival`
- `op-whisky-peak-trap-sprung`
- `op-whisky-peak-zoro-fight`
- `op-whisky-peak-vivi-reveal`
- `op-whisky-peak-officer-agents`
- `op-whisky-peak-igarams-decoy`
- `op-whisky-peak-departure`

### Key Knowledge Gates

- Before the reveal, use Miss Wednesday/Mr. 8 identities; after reveal, use Vivi/Igaram.
- Mr. 0 is still hidden; Crocodile identity must not retrieve yet unless later Context is active.
- Baroque Works hierarchy can be partial: codenames, officer agents, billions/millions, secrecy.
- Arabasta civil war is known as mission pressure, not fully detailed yet.

### Anti-Spoiler and Anti-Lore Rules

- No Crocodile-as-Mr. 0 reveal before the correct window.
- No full Robin/Nico Robin explanation.
- No complete Arabasta civil war resolution.
- Do not include episodes 68-69 as Whisky Peak cards unless creating explicitly supplemental Marine cover-serial support.

### Location/Faction/World-State Constraints

- Whisky Peak's celebration is a trap designed to incapacitate pirates.
- Bounty hunters are embedded as townspeople.
- The crew leaves under pursuit pressure and escort obligation.

### High-Value Cards To Include

- `Whisky Peak Hospitality Is A Bounty-Hunter Trap`
- `Zoro Stays Awake And Reads The Celebration Correctly`
- `Miss Wednesday Reveals Herself As Princess Vivi`
- `Igaram's Decoy Creates Immediate Pursuit Risk`

### Low-Value/Wiki-Like Cards To Exclude

- `Baroque Works Full Organization Summary`
- `Vivi Complete Biography`
- `Whisky Peak Arc Summary`
- `All Officer Agents Explained`

## Deck Plan: Little Garden

Package ID: `one-piece-little-garden`

Reviewed baseline: 40 Lorecards.

### Source Boundary

- Manga: chapters 115-129, volumes 13-15.
- Anime: episodes 70-77.
- Continuity stance: manga-backed.

### Roleplay Utility Goals

- Support Little Garden's forced-stay ecology and prehistoric hazards.
- Establish Dorry/Brogy honor, duel rhythm, and sabotage stakes.
- Support Baroque Works officer-agent tactics without generic villain summaries.
- Bridge Nami's illness and need for a doctor into Drum Island.

### Expected Lorecard Categories

- `character`: Dorry, Brogy, Mr. 3, Miss Goldenweek, Mr. 5, Miss Valentine, Vivi, Usopp, Nami, Sanji.
- `relationship`: Dorry/Brogy honor-friendship, Usopp/giant admiration, crew/Vivi mission pressure.
- `event`: giant duel, sabotage, wax capture, agent defeat, Nami illness onset.
- `location`: Little Garden, jungle, volcano signal, dinosaur terrain.
- `faction`: Baroque Works officer agents.
- `rule`: Log Pose delay, wax constraints, color trap effects, island ecology.

### Key Character Snapshots

- Dorry and Brogy: warriors and friends locked in century-long duel by honor.
- Usopp: deeply affected by giant-warrior courage and the idea of Elbaf.
- Mr. 3: strategy/capture threat, not raw-power villain.
- Miss Goldenweek: behavior manipulation threat through color traps as arc presents it.
- Nami: illness begins as route-changing urgency.

### Key Event Gates

- `op-little-garden-arrival`
- `op-little-garden-first-duel`
- `op-little-garden-sabotage`
- `op-little-garden-wax-capture`
- `op-little-garden-agent-defeat`
- `op-little-garden-nami-illness`
- `op-little-garden-departure`

### Key Knowledge Gates

- Elbaf is only a giant homeland/dream hook here; no later Elbaf exposition.
- Crocodile can be introduced as Baroque Works leadership pressure only if source window supports it; avoid Arabasta endgame detail.
- Sanji's independent movement and intercepted call should be event-specific.
- Nami's illness should trigger medical urgency without summarizing Drum.

### Anti-Spoiler and Anti-Lore Rules

- No later Elbaf lore.
- No Dorry/Brogy later appearances or broader giant history.
- No Mr. 3 later role outside this arc.
- Do not turn Baroque Works into a full Arabasta recap.

### Location/Faction/World-State Constraints

- Little Garden's Log Pose delay forces a dangerous stay.
- Prehistoric ecology affects travel, hunting, and combat staging.
- Baroque Works is targeting Vivi and the crew under secrecy pressure.

### High-Value Cards To Include

- `Volcano Signal Structures Dorry And Brogy's Duel Timing`
- `Sabotaged Alcohol Breaks The Honor Duel State`
- `Mr. 3's Wax Capture Changes The Battlefield`
- `Nami's Illness Forces The Doctor Detour`

### Low-Value/Wiki-Like Cards To Exclude

- `Little Garden Arc Summary`
- `Giants In One Piece Explained`
- `Elbaf Full Lore`
- `Baroque Works Officer Agents Complete List`

## Deck Plan: Drum Island

Package ID: `one-piece-drum-island`

Reviewed baseline: 44 Lorecards.

### Source Boundary

- Manga: chapters 130-154, volumes 15-17.
- Anime: episodes 78-91.
- Continuity stance: manga-backed.

### Roleplay Utility Goals

- Support medical urgency, winter terrain, mountain climb, and castle scenes.
- Establish Chopper's rejection, Hiriluk bond, Kureha training, and recruitment state.
- Establish Drum's political damage under Wapol and Dalton's duty.
- Gate Blackbeard/Ace/Will of D. mentions as narrow reported-world hooks only.

### Expected Lorecard Categories

- `character`: Chopper, Hiriluk, Kureha, Wapol, Dalton, Chess, Kuromarimo, Nami, Luffy, Sanji, Vivi.
- `relationship`: Chopper/Hiriluk, Chopper/Kureha, Dalton/citizens, Luffy/Chopper recruitment, Vivi/civilian diplomacy.
- `event`: Nami illness crisis, village standoff, mountain climb, Chopper backstory, Wapol return, castle battle, sakura sendoff.
- `location`: Drum Island, Drum Castle, Drum Rockies, villages, ropeway/snow terrain.
- `faction`: Isshi-20, Wapol's faction, Drum citizens.
- `rule`: medical scarcity, Human-Human Fruit as arc-presented, Chopper transformations if source-supported, winter survival.

### Key Character Snapshots

- Chopper before joining: rejected reindeer/human hybrid, insecure, trained doctor, wants acceptance but fears humans.
- Hiriluk: failed but hope-driven doctor whose flag and dream shape Chopper.
- Kureha: harsh teacher, effective doctor, protective without softening language.
- Wapol: exiled king returning after abandoning the country, treats medicine as control.
- Dalton: duty-bound former servant turned protector of citizens.
- Vivi: prioritizes diplomacy with armed villagers because Arabasta urgency does not erase civilian fear.

### Key Event Gates

- `op-drum-island-arrival`
- `op-drum-island-village-standoff`
- `op-drum-island-mountain-climb`
- `op-drum-island-chopper-backstory`
- `op-drum-island-wapol-return`
- `op-drum-island-castle-battle`
- `op-drum-island-sakura-sendoff`
- `op-drum-island-chopper-joins`
- `op-drum-island-departure`

### Key Knowledge Gates

- Blackbeard's attack is a reported prior event; no powers, crew details, or later role.
- Ace presence/message/search, if carded, must stay source-bound and not explain brotherhood or Whitebeard context beyond what is shown.
- Will of D., Levely, and Roger name references should be term-level only if source-bound and retrieval-useful.
- Chopper's forms should cover only what the arc demonstrates.

### Anti-Spoiler and Anti-Lore Rules

- No later Blackbeard powers or Marineford setup.
- No later Chopper forms, Monster Point, post-timeskip medicine, or mascot framing.
- No full Will of D. explanation.
- No later Wapol world role.

### Location/Faction/World-State Constraints

- Nami's fever creates time pressure and route deviation.
- Winter terrain and the mountain climb restrict movement and survival.
- The kingdom lacks normal medical access because Wapol monopolized doctors.
- Drum's political state is unstable but not an all-series kingdom-politics summary.

### High-Value Cards To Include

- `Vivi Defuses The Armed Village Standoff Despite Arabasta Urgency`
- `Luffy Carries Nami And Sanji Up The Drum Rockies Under Medical Time Pressure`
- `Chopper's Poison Mushroom Tragedy Shapes His Doctor Identity`
- `Wapol's Doctor Monopoly Makes Medicine A Political Weapon`

### Low-Value/Wiki-Like Cards To Exclude

- `Tony Tony Chopper Complete Biography`
- `The Will Of D. Explained`
- `Blackbeard Future Role`
- `Drum Island Arc Summary`

## Deck Plan: Arabasta

Package ID: `one-piece-arabasta`

Reviewed baseline: 58 Lorecards.

### Source Boundary

- Manga: chapters 155-217, volumes 17-24.
- Anime: episodes 92-130.
- Continuity stance: manga-backed with anime support. Episodes 93, 98-99, and 101-102 are filler; card them only when they add anime-session retrieval value.

### Roleplay Utility Goals

- Support kingdom-scale conflict through precise local states instead of a civil-war summary.
- Gate Crocodile/Mr. 0, Baroque Works endgame, drought manipulation, rebellion, and royal pressure.
- Support Vivi leadership scenes, Straw Hat split-role scenes, Alubarna matchups, bomb-clock pressure, and farewell.
- Gate Robin/Miss All Sunday, Poneglyph, Pluton, Ancient Weapon, and Void Century terms as Arabasta-presented knowledge only.
- Audit Ace/Vivre Card coverage. If absent, add narrow cards only because they support scene retrieval and future-safe item state.

### Expected Lorecard Categories

- `character`: Vivi, Karoo, Cobra, Crocodile, Robin/Miss All Sunday, Koza, Toto, Chaka, Pell, Igaram, Ace, Smoker, Tashigi, Baroque Works agents, Straw Hats.
- `relationship`: Vivi/Straw Hats, Vivi/Koza, Cobra/Vivi, Crocodile/Robin, Smoker/Tashigi, Mr. 2/Straw Hats if source-useful, crew farewell marks.
- `secret`: Crocodile as Mr. 0, Baroque Works manipulation, Poneglyph/Pluton knowledge, Robin's withheld truth, bomb placement.
- `event`: Nanohana arrival, Yuba failure, Rainbase trap, desert return, Alubarna battle, matchup victories, clock tower bomb, tomb confrontation, Crocodile defeat, civil war stop, Vivi farewell, Robin joins.
- `location`: Nanohana, Yuba, Sandora Desert, Rainbase, Rain Dinners, Alubarna, palace, clock tower, royal tomb.
- `faction`: Baroque Works, Royal Army, Rebel Army, Marines.
- `rule`: sand power as presented, water/blood vulnerability discovery, Dance Powder suspicion, Clima-Tact use, steel-cutting breakthrough, Vivre Card behavior if source-bound.
- `item`: Clima-Tact, Poneglyph, Pluton as named target, X marks, Vivre Card.

### Key Character Snapshots

- Vivi on return: princess trying to stop war without demonizing rebels; emotionally strained by time and responsibility.
- Crocodile: public hero and secret manipulator using drought, Baroque Works, casino power, and Pluton motive.
- Koza: rebel leader whose anger is rooted in real suffering and childhood trust with Vivi.
- Cobra: king under blame and manipulation, not villain.
- Robin/Miss All Sunday before reveal: dangerous agent with independent motives; after reveal, unresolved ally risk.
- Luffy: repeatedly refuses Crocodile's worldview and returns after defeat.
- Nami: uses Clima-Tact as an unstable new weapon in a specific matchup.
- Zoro: steel-cutting breakthrough is an event-state card, not a general power-scaling essay.
- Ace: brief brother/contact role if carded; no Marineford or Whitebeard exposition beyond source.

### Key Event Gates

- `op-arabasta-arrival-nanohana`
- `op-arabasta-ace-contact`
- `op-arabasta-yuba-rebel-context`
- `op-arabasta-rainbase-trap`
- `op-arabasta-desert-return`
- `op-arabasta-alubarna-battle-start`
- `op-arabasta-officer-agent-matchups`
- `op-arabasta-palace-and-clock-tower`
- `op-arabasta-royal-tomb`
- `op-arabasta-crocodile-defeat`
- `op-arabasta-civil-war-resolution`
- `op-arabasta-vivi-farewell`
- `op-arabasta-robin-joins`

### Key Knowledge Gates

- Crocodile's public hero status and secret Mr. 0 identity must be gated separately.
- Dance Powder suspicion, drought, and rebellion should be distinct cards because they drive different retrieval needs.
- Poneglyph, Pluton, Ancient Weapons, and Void Century stay term-level and Arabasta-presented.
- Robin can read the Poneglyph and withholds Crocodile's desired answer; do not reveal Ohara/CP9/backstory.
- Pell sacrifice/survival should follow the covered arc's presentation and deck policy. If uncertain, mark for verification rather than writing a definitive unsupported state.
- Ace/Vivre Card cards, if added, must be narrow: immediate meeting, brotherly recognition as source-presented, and item/contact behavior without future war spoilers.

### Anti-Spoiler and Anti-Lore Rules

- No Ohara, CP9, Enies Lobby, Road Poneglyphs, full Void Century, or full Ancient Weapon exposition.
- No Crocodile later history beyond Arabasta status change.
- No Whitebeard crew summary, Marineford, Sabo, Haki, Gear, or later Ace fate.
- No later Nami Clima-Tact upgrades.
- No Jaya setup beyond Robin's unresolved presence on the ship.
- Filler episodes inside Arabasta must be tagged and must not overwrite manga route logic.

### Location/Faction/World-State Constraints

- Arabasta is a desert kingdom under drought, misinformation, and factional escalation.
- Rebel and royal forces are both manipulated toward war.
- Rainbase/Rain Dinners are Crocodile-controlled spaces with trap logic.
- Alubarna has multi-front battle pressure and a hidden bomb clock.
- Royal tomb knowledge is restricted and should not leak into public scenes.

### High-Value Cards To Include

- `Crocodile's Hero Cover Masks Mr. 0 Control Of Baroque Works`
- `Vivi Tries To Stop Rebels Without Treating Them As Enemies`
- `Rainbase Seastone Trap Turns Crocodile's Public Power Into Immediate Captivity`
- `X Marks Defeat Bon Clay's Disguise And Become The Farewell Signal`
- `Robin Reads The Poneglyph But Does Not Give Crocodile Pluton`
- `Ace Gives A Future-Safe Contact Token Without Marineford Spoilers` - add only if missing and source-supported.

### Low-Value/Wiki-Like Cards To Exclude

- `Arabasta Arc Summary`
- `Crocodile Complete Biography`
- `Ancient Weapons Explained`
- `Nico Robin Full Backstory`
- `All Baroque Works Agents Listed`
- `Whitebeard Pirates Overview`

## Deck Plan: Post-Arabasta

Package ID: `one-piece-post-arabasta`

Reviewed baseline: 25 Lorecards.

### Source Boundary

- Manga: none; anime-only/filler arc.
- Anime: episodes 131-135.
- Continuity stance: anime-only. Character-centered aftermath immediately after Arabasta.

### Roleplay Utility Goals

- Support anime-continuity shipboard decompression after Vivi's farewell.
- Establish Robin's earliest onboard tension as the anime depicts it without later backstory.
- Support Chopper, Nami, Sanji, Usopp, Zoro, Luffy, and Going Merry routine snapshots only when tied to episodes 131-135.
- Keep this deck from becoming a bucket for generic Straw Hat personality cards.

### Expected Lorecard Categories

- `character`: Robin, Chopper, Nami, Sanji, Usopp, Zoro, Luffy.
- `relationship`: Robin/crew suspicion, crew/Vivi absence, Chopper/crew fit, shipboard argument/comedy states.
- `event`: post-farewell reset, individual vignette moments, Robin onboard adjustment, before-Jaya boundary.
- `location`: Going Merry.
- `rule`: anime-only aftermath continuity, shipboard routine constraints.

### Key Character Snapshots

- Robin: calm new presence, not fully trusted, no later Ohara/CP9 material.
- Chopper: new crewmate adjusting to non-emergency crew life.
- Nami: navigator and practical authority during calmer shipboard rhythm.
- Sanji/Usopp/Zoro: episode-specific routine snapshots only, not full personality cards.
- Luffy: captain during decompression, still emotionally tied to Vivi farewell but moving forward.

### Key Event Gates

- `op-post-arabasta-after-vivi`
- `op-post-arabasta-chopper-crew-life`
- `op-post-arabasta-nami-routine`
- `op-post-arabasta-sanji-usopp-zoro-vignettes`
- `op-post-arabasta-robin-onboard`
- `op-post-arabasta-before-jaya`

### Key Knowledge Gates

- Robin has joined the ship but her past, motives, and danger level remain unresolved.
- Vivi is absent but emotionally relevant; do not reopen Arabasta conflict as active.
- Next-saga facts are excluded except a hard boundary that this deck stops before Jaya.

### Anti-Spoiler and Anti-Lore Rules

- No Jaya, Skypiea, Goat Island, Ruluka Island, G-8, or later anime-filler arcs.
- No Robin Ohara/CP9/Enies Lobby material.
- No generic crew traits unless tied to a specific episode 131-135 retrieval condition.
- No manga-primary assumption changes.

### Location/Faction/World-State Constraints

- Going Merry is the main setting.
- The crew is between major conflicts and recovering from Arabasta.
- The deck should retrieve for anime-continuity shipboard aftermath, not for all Straw Hat ship scenes.

### High-Value Cards To Include

- `Robin's Calm Onboard Presence Creates Early Crew Suspicion`
- `Chopper Adjusts From Emergency Doctor To Everyday Crewmate`
- `Vivi's Absence Remains Emotional After The Silent Farewell`
- `Episode-131-135 Shipboard Routine Is Anime-Only Continuity`

### Low-Value/Wiki-Like Cards To Exclude

- `Post-Arabasta Arc Summary`
- `Nico Robin Full Backstory`
- `The Straw Hat Crew Personality Guide`
- `All Shipboard Life In One Piece`

## Validation Plan

Update or create One Piece-specific health and conformance tests. These tests should enforce this plan as an authoring standard, not only JSON syntax.

Required assertions:

- Exact deck ID set matches the thirteen arc decks listed in this plan.
- Every deck exists in `content/loredecks/index.json` and has a valid `loredeck.json` manifest.
- Every entry file uses `schemaVersion: 3`.
- Every deck has valid timeline and tag registries when referenced.
- Manifest `stats.entryCount` and `stats.categoryCounts` match loaded entries.
- Card count matches the reviewed baseline or a checked-in count-delta review note.
- No duplicate normalized `content.fact` strings within a deck.
- No generator boilerplate, including phrases like `This belongs to`, `not as a broad series summary`, or `as a runtime lorecard`.
- No Lorecards whose only job is timeline metadata, source-boundary metadata, tag registry information, or deck-scope disclaimers.
- Every card has `content.fact`, `content.injection`, `context`, retrieval metadata, and at least one registered arc tag.
- Every card can be classified as a lore gate, knowledge gate, character snapshot, relationship state, setting constraint, faction pressure, rule, item state, or event moment.
- Warship Island and Post-Arabasta are marked as anime-only/filler support with `continuity:one-piece-anime-main`, `adaptation:anime`, and `topic:show-only` or equivalent tags.
- Manga-backed decks do not require Warship Island or Post-Arabasta to retrieve manga-required facts.
- Filler episodes inside manga-backed arcs are marked as anime support and do not override manga-primary states.
- No unregistered tags and no unused registry tags except explicitly approved family-wide tags.

Recommended assertions:

- Source-boundary text exists in every manifest and includes chapters/episodes or filler status.
- Context anchors cover all event gates named in this plan.
- No entry file is a giant unreviewable bucket; flag unusually large files for manual review.
- Broad terms such as `pirates`, `Marines`, `Grand Line`, `Devil Fruit`, and `Straw Hats` do not by themselves retrieve a deck's most specific cards.
- High-risk spoiler terms are absent from early decks unless inside anti-spoiler guards: Haki, Nika, CP9, Ohara, Brook, Sogeking, Germa, Road Poneglyph, Marineford.
- Sample injection tests confirm that pre-reveal contexts do not expose Vivi, Robin, Nami, Crocodile, Laboon/Brook, or later Dragon facts early.

## Production Sequence

1. Verify the actual `content/loredecks/one-piece-*` files against this plan and the review report.
2. Re-check Story Arcs ranges before committing source-boundary metadata.
3. Audit each deck's current card IDs, categories, facts, tags, timeline anchors, and source notes.
4. Remove or rewrite cards that are duplicates, meta cards, timeline cards, broad summaries, or future-spoiler leaks.
5. Update timeline registries before authoring new cards so every new card has a Context window.
6. Update tag and alias registries only for tags/entities actually used.
7. Run a title pass for any missing cards; reject broad titles before drafting content.
8. Draft or revise cards in small batches by deck and runtime job.
9. Run Pack Health after each deck, not only after the whole family.
10. Run One Piece health/conformance tests and Context fixture tests.
11. Review sampled prompt injections for each deck to catch wiki-summary drift and spoiler leakage.
12. Update the review report if card counts change.
13. Treat the family as reference-quality only after clean Pack Health, clean tests, and a human/LLM audit pass against this plan.

## Acceptance Criteria

The rebuild is complete only when:

- All thirteen arc Loredecks are present and source-bounded.
- The family total remains 477 reviewed Lorecards, or every count delta has a documented retrieval-value reason.
- Pack Health has no errors, warnings, or suggestions for every deck.
- Bundled defaults and index registration load correctly.
- Every card is Context-aware, retrieval-aware, spoiler-aware, and source-boundary-aware.
- Manga-primary decks do not depend on anime-only/filler decks.
- Anime-only/filler decks are clearly labeled and do not contaminate manga assumptions.
- Duplicate facts, generator boilerplate, broad summaries, and timeline/meta Lorecards are absent.
- Pre-reveal Context fixtures prove that Nami, Vivi, Crocodile, Robin, Laboon/Brook, Dragon, and later-world facts do not leak early.
- The deck family is useful for fanfic and roleplay scenes without behaving like a general One Piece wiki.
