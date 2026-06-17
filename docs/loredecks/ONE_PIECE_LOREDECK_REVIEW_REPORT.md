# One Piece Loredeck Quality Review

This review pass applied the authoring guidance that Lorecards should be focused runtime gates, character snapshots, knowledge boundaries, relationship states, rules, or event moments. It removed formulaic density padding and rewrote the kept cards so they no longer read like generated wiki notes.

Review criteria:

- Remove duplicate fact cards inside a deck.
- Remove timeline/meta cards whose job belongs in `timeline.json` or `context`, not in runtime lore.
- Remove cards that only say later material belongs elsewhere.
- Rewrite kept cards to remove generator boilerplate.
- Rebuild tags/entities from the kept cards to avoid orphaned registry definitions.

Total before: 1022 Lorecards.
Total after: 477 Lorecards.
Removed: 545 Lorecards (459 duplicate fact cards, 86 low-value or meta cards).

Development pass 2026-06-17:

- Preserved the 477-card reviewed baseline.
- Normalized manga-backed decks from the old hybrid continuity tag to `continuity:one-piece-manga-main`.
- Kept Warship Island and Post-Arabasta as anime-continuity decks and added `topic:show-only`.
- Replaced `quality:draft-reference` and generated-draft provenance with `quality:reviewed-baseline` and reviewed-baseline provenance.
- Updated One Piece health tests to enforce the continuity, quality, show-only, and no-legacy-marker contract.

Arc development pass 2026-06-17:

- Completed Romance Dawn in-place without changing its 34-card count.
- Rewrote all Romance Dawn cards from summary-style facts into runtime instructions for Luffy's straw-hat promise, Coby's fear/dream pivot, Zoro's execution-yard restraint, Morgan/Helmeppo local authority abuse, small-boat travel constraints, and early Devil Fruit anti-spoiler gates.
- Updated Romance Dawn source references to the Romance Dawn Arc source page and added `sagaOnePieceArcDevelopment.pass = romance-dawn-runtime-lore` provenance to each revised card.
- Completed Orange Town in-place without changing its 31-card count.
- Rewrote Orange Town around Buggy's occupied-town pressure, Nami's private money motive, provisional Luffy/Zoro/Nami trust, Chouchou and Boodle civilian stakes, and tactical Devil Fruit combat gates.
- Updated Orange Town source references to the Orange Town Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = orange-town-runtime-lore` provenance to each revised card.
- Completed Syrup Village in-place without changing its 37-card count.
- Rewrote Syrup Village around Usopp's credibility collapse, Kaya and Klahadore/Kuro reveal gates, slope-defense logistics, Black Cat Pirates battle pressure, Going Merry provenance, and Usopp's quiet departure boundary.
- Updated Syrup Village source references to the Syrup Village Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = syrup-village-runtime-lore` provenance to each revised card.
- Completed Baratie in-place without changing its 41-card count.
- Rewrote Baratie around Sanji and Zeff food ethics, starvation debt, Don Krieg siege pressure, Gin's loyalty fracture, Mihawk and Zoro scale shock, Nami's unresolved departure, and Sanji's goodbye.
- Updated Baratie source references to the Baratie Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = baratie-runtime-lore` provenance to each revised card.
- Completed Arlong Park in-place without changing its 41-card count.
- Rewrote Arlong Park around Nami's reveal timing, Cocoyasi occupation, Arlong's tribute and buyback control, Nezumi's confiscation, the help-request hat handoff, map-room liberation, and matchup-specific combat gates.
- Updated Arlong Park source references to the Arlong Park Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = arlong-park-runtime-lore` provenance to each revised card.
- Completed Loguetown in-place without changing its 35-card count.
- Rewrote Loguetown around Roger threshold symbolism, Smoker and Tashigi pressure, Seastone and smoke-power combat constraints, Buggy and Alvida's execution-platform trap, Dragon's unexplained intervention, storm-assisted escape, and Grand Line departure boundaries.
- Updated Loguetown source references to the Loguetown Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = loguetown-runtime-lore` provenance to each revised card.
- Completed Warship Island in-place without changing its 25-card count.
- Rewrote Warship Island as show-continuity support for Apis and Ryu protection stakes, Lost Island and Sennenryu boundaries, Branch 8 pursuit, Eric and Nelson pressure, Calm Belt/Sea King bridge hazards, and Reverse Mountain handoff rules.
- Updated Warship Island source references to the Warship Island Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = warship-island-runtime-lore` provenance to each revised card.
- Completed Reverse Mountain in-place without changing its 30-card count.
- Rewrote Reverse Mountain around Grand Line entry mechanics, Red Line route constraints, Laboon's waiting grief and visible promise, Crocus's caretaker and information limits, Log Pose navigation gates, Miss Wednesday/Mr. 9 first contact, and Baroque Works mystery boundaries.
- Updated Reverse Mountain source references to the Reverse Mountain Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = reverse-mountain-runtime-lore` provenance to each revised card.
- Completed Whisky Peak in-place without changing its 36-card count.
- Rewrote Whisky Peak around bounty-hunter hospitality, performative trap-town pressure, Baroque Works codenames and lethal secrecy, Zoro's trap read, Luffy and Zoro's misunderstanding, Vivi and Igaram reveal windows, officer-agent escalation, Miss All Sunday ambiguity, and Arabasta mission handoff.
- Updated Whisky Peak source references to the Whisky Peak Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = whisky-peak-runtime-lore` provenance to each revised card.
- Completed Little Garden in-place without changing its 40-card count.
- Rewrote Little Garden around prehistoric island hazards, Log Pose forced-stay constraints, Dorry and Brogy's honor-bound friendship, Elbaf boundary gates, Usopp's brave-warrior model, Baroque Works sabotage, wax/color tactical rules, Sanji's independent route recovery, Nami's illness bridge, and Drum Island handoff limits.
- Updated Little Garden source references to the Little Garden Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = little-garden-runtime-lore` provenance to each revised card.
- Completed Drum Island in-place without changing its 44-card count.
- Rewrote Drum Island around medical scarcity, winter terrain pressure, Wapol's doctor monopoly, Dalton and citizen trauma, Vivi's standoff diplomacy, Luffy's mountain rescue, Chopper's rejection and poison-mushroom wound, Hiriluk/Kureha legacy, castle battle symbolism, sakura farewell, recruitment state, and narrow Ace/Blackbeard/Roger hooks.
- Updated Drum Island source references to the Drum Island Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = drum-island-runtime-lore` provenance to each revised card.
- Completed Arabasta in-place without changing its 58-card count.
- Rewrote Arabasta around engineered civil-war pressure, Dance Powder suspicion, Crocodile's hero/Mr. 0 reveal gate, Rainbase Seastone captivity, Baroque Works staging, Vivi/Koza/Cobra citizen-state constraints, Luffy's Yuba pivot, Alubarna split-role matchups, Clima-Tact and steel-cutting gates, clock-tower bomb pressure, Pell climax framing, Crocodile water/blood vulnerability, Poneglyph/Pluton/Robin term-level secrets, the X-mark farewell, Robin boarding, and public cover-up aftermath.
- Replaced one weaker Nanohana overview card with a source-bound Ace contact-token card, preserving count while adding the plan's requested Ace/Vivre Card retrieval value without later-war spoilers.
- Updated Arabasta source references to the Arabasta Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = arabasta-runtime-lore` provenance to each revised card.
- Completed Post-Arabasta in-place without changing its 25-card count.
- Rewrote Post-Arabasta as anime-only episode 131-135 support: Chopper's Rumble Ball/Doctorine memory, Nami's durable map paper and world-map work, Sanji's Tajio curry mentorship under Marine fog pressure, Usopp's Kodama fireworks bravery vignette, Zoro's Johnny/Yosaku flashback, Robin's calm early onboard suspicion, Vivi's felt absence, Going Merry aftercare, and strict next-island containment.
- Updated Post-Arabasta source references to the Post-Arabasta Arc source page, regenerated its tag/entity registries from actual entry usage, and added `sagaOnePieceArcDevelopment.pass = post-arabasta-runtime-lore` provenance to each revised card.

| Deck | Before | After | Removed | Duplicate Removed | Low-Value Removed | Files |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `one-piece-arabasta` | 120 | 58 | 62 | 62 | 0 | 11 |
| `one-piece-arlong-park` | 104 | 41 | 63 | 46 | 17 | 8 |
| `one-piece-baratie` | 92 | 41 | 51 | 45 | 6 | 8 |
| `one-piece-drum-island` | 92 | 44 | 48 | 45 | 3 | 9 |
| `one-piece-little-garden` | 82 | 40 | 42 | 37 | 5 | 8 |
| `one-piece-loguetown` | 66 | 35 | 31 | 22 | 9 | 7 |
| `one-piece-orange-town` | 64 | 31 | 33 | 25 | 8 | 6 |
| `one-piece-post-arabasta` | 60 | 25 | 35 | 27 | 8 | 5 |
| `one-piece-reverse-mountain` | 62 | 30 | 32 | 26 | 6 | 6 |
| `one-piece-romance-dawn` | 68 | 34 | 34 | 28 | 6 | 6 |
| `one-piece-syrup-village` | 76 | 37 | 39 | 35 | 4 | 7 |
| `one-piece-warship-island` | 64 | 25 | 39 | 29 | 10 | 5 |
| `one-piece-whisky-peak` | 72 | 36 | 36 | 32 | 4 | 7 |

Source range reference remains https://onepiece.fandom.com/wiki/Story_Arcs.
