# Star Trek TNG, DS9, and Voyager Loredeck Authoring Plan

This is the production plan for building bundled Saga Loredecks for Star Trek: The Next Generation, Deep Space Nine, and Voyager. It is a planning document for authoring 21 season decks, not a recap document. Its job is to define source boundaries, deck density, evidence handling, Context behavior, spoiler discipline, and the validation bar before JSON authoring begins.

Use this alongside:

- `README.md`, especially `Authoring Loredecks`
- `docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md`
- `docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md`
- `docs/loredecks/SAGA_LOREDECK_SCHEMA.md`
- `docs/loredecks/LOREDECK_ZIP_PACKAGE_STRUCTURE.md`
- `docs/loredecks/ONE_PIECE_EAST_BLUE_ARABASTA_AUTHORING_PLAN.md`
- Existing bundled reference deck families in `content/loredecks/`, especially the Context-gated Harry Potter year decks and other clean Pack Health deck families.

## Source Boundary

- Fandom: Star Trek.
- Covered shows: Star Trek: The Next Generation, Star Trek: Deep Space Nine, and Star Trek: Voyager.
- Continuity: primary on-screen Prime continuity for the three covered 24th-century television shows.
- Deck unit: one Loredeck per show season.
- Required deliverable: 21 bundled season Loredecks.
- Package ID pattern: `star-trek-tng-season-1`, `star-trek-ds9-season-1`, `star-trek-voy-season-1`.
- Library placement: `Star Trek / The Next Generation`, `Star Trek / Deep Space Nine`, and `Star Trek / Voyager`.
- Primary external source: `https://memory-alpha.fandom.com/wiki/Portal:Main`, with per-episode Memory Alpha pages as the main evidence source for episode order, stardates, in-universe dates, first appearances, deaths, departures, promotions, command changes, relationship changes, faction turns, species rules, technology rules, and spoiler boundaries.
- Secondary check only: common streaming/DVD or episode-list numbering for user-facing runtime aliases.
- Excluded by default: TOS except where a covered episode explicitly invokes it, TNG films, Picard-era material, Lower Decks, Prodigy, Discovery-era retcons, novels, comics, games, beta canon, production trivia, deleted scenes, and fanon.
- Cross-show policy: write local facts in the season deck where they become relevant. When a season references another show or franchise-wide event, include only the runtime fact needed for that season and do not duplicate a full off-show plot.
- No shared `star-trek-core` deck is required for the first pass. A later core deck can be factored out only if it does not replace any of the 21 required season decks.

## Memory Alpha Evidence Workflow

The Star Trek deck family must be evidence-first. The generated evidence artifacts are an index, not Lorecard prose:

- Generator path: `tools/scripts/generate-star-trek-memory-alpha-evidence.mjs`
- Markdown evidence index: `docs/loredecks/STAR_TREK_TNG_DS9_VOY_MEMORY_ALPHA_EVIDENCE.md`
- Structured evidence: `docs/loredecks/star-trek-memory-alpha-episode-evidence.json`
- Current evidence baseline: 517 Memory Alpha story rows, 0 fetch failures.

Before drafting cards for any season:

1. Refresh the evidence artifacts if the generator, Memory Alpha route, season scope, or source fields change.
2. Confirm the story-row count and runtime alias count for the season.
3. Review every episode row for title, URL, stardate/date, year, arc label, key entities, and generated authoring signals.
4. Open the Memory Alpha per-episode page for every episode that creates a card candidate. Do not rely on generated `keyEntities` or `authoringSignals` alone.
5. Promote only durable runtime facts into Lorecards. Every episode gets a timeline/source anchor, but not every episode gets a standalone plot card.
6. Mark malformed generated data for manual correction before it enters `timeline.json` or `resolver.json`. Examples to watch for include template fragments in arc labels, polluted entity lists, and false-positive signal tags.

### Converting Evidence Into Deck Data

For every Memory Alpha story row, create or verify one timeline anchor.

Required anchor fields:

- Stable anchor ID, using the pattern `<series>.s<season>.e<storyNumber>.<slug>`, for example `tng.s1.e01.encounter-at-farpoint`.
- Human label: episode title.
- Sort key inside the season band. Leave gaps, usually 10 to 20 points per story row, so later before/after windows can be inserted.
- Date range or stardate range when Memory Alpha provides one.
- Aliases for episode title, common abbreviations, story-row numbering, runtime numbering, and split-hour titles where applicable.
- Source metadata pointing to the Memory Alpha episode URL.

For every runtime episode alias, add resolver support even when Memory Alpha has one feature-length story row.

Example alias requirements:

- `TNG 1x01`, `TNG S01E01`, `Encounter at Farpoint`, `Encounter at Farpoint Part I`, and `Encounter at Farpoint Part II` should all resolve into the correct TNG season 1 window.
- `DS9 S01E01`, `DS9 S01E02`, and `Emissary` should all resolve correctly even though Memory Alpha treats `Emissary` as one story row.
- `VOY S07E25`, `VOY S07E26`, and `Endgame` should resolve to the finale window even though Memory Alpha treats `Endgame` as one story row.

For every promoted Lorecard, add `sourceInfo` with at least:

```json
{
  "work": "Star Trek: Deep Space Nine",
  "sourceType": "episode",
  "title": "The Jem'Hadar",
  "series": "DS9",
  "season": 2,
  "storyEpisode": 26,
  "runtimeEpisodes": [26],
  "memoryAlphaUrl": "https://memory-alpha.fandom.com/wiki/The_Jem'Hadar_(episode)",
  "stardate": "Unknown (2370)",
  "evidenceArtifact": "docs/loredecks/star-trek-memory-alpha-episode-evidence.json"
}
```

Use `context` as the eligibility gate, not source metadata. Typical card windows:

- `scope: "anchor"` for a fact that should retrieve only during one episode or immediate event.
- `scope: "window"` with `validFromAnchor` for a status change that remains true after a reveal.
- `scope: "window"` with `validToAnchor` for a secret, mistaken belief, or cliffhanger that must stop once resolved.
- `windowKind: "wide"` only for durable season state, paired with conservative retrieval.

### Card Promotion Checklist

Promote an episode fact into a Lorecard only if it is one of these runtime gates:

- Secret, hidden identity, betrayal, cover story, or contested truth.
- Reveal timing that changes what characters know.
- Character trait over time, role, rank, trauma, belief, loyalty, or command posture.
- Relationship state or obligation.
- Death, survival uncertainty, injury, pregnancy, birth, departure, return, promotion, command transfer, or crew assignment change.
- Faction state, diplomatic posture, war status, occupation pressure, alliance, rebellion, or schism.
- Ship, station, route, resource, communications, holodeck, transporter, Borg, Q, wormhole, temporal, or medical rule that affects scene writing.
- Local political, religious, legal, or cultural context that changes behavior.
- Spoiler guard that prevents later canon from leaking backward.

Do not promote:

- Full plot sequence summaries.
- One-off guest alien biographies unless they establish a recurring rule or relationship.
- Every named technology, planet, shuttle, or substance.
- Production trivia, actor notes, dates of filming, ratings, script history, or behind-the-scenes references.
- Generated `episode-local fact/status gate` rows unless a concrete durable state is identified.
- Incidental signal matches such as `Klingon duty` from a casual Klingon reference, `Bajoran religion` from an incidental Bajoran noun, or `Data/Lore` from the word `data` when it is not the android.

## Story Rows, Runtime Aliases, And Density Targets

The table uses runtime episode units because users normally select Context from streaming/DVD-style episode lists. Memory Alpha story-row counts are preserved separately for source anchors.

| Deck | MA Story Rows | Runtime Aliases | In-Universe Span | Target | Acceptable Range | Alias Notes |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| `star-trek-tng-season-1` | 25 | 26 | 2364 | 78 | 66-90 | `Encounter at Farpoint` split aliases. |
| `star-trek-tng-season-2` | 22 | 22 | 2365 | 70 | 60-82 | No feature-length exception. |
| `star-trek-tng-season-3` | 26 | 26 | 2366 | 94 | 82-106 | No feature-length exception. |
| `star-trek-tng-season-4` | 26 | 26 | 2366-2367 | 100 | 88-112 | Borg aftermath starts the deck. |
| `star-trek-tng-season-5` | 26 | 26 | 2368 | 102 | 90-114 | No feature-length exception. |
| `star-trek-tng-season-6` | 26 | 26 | 2369 | 102 | 90-114 | DS9 overlap begins. |
| `star-trek-tng-season-7` | 25 | 26 | 2370 | 94 | 82-106 | `All Good Things...` split aliases. |
| `star-trek-ds9-season-1` | 19 | 20 | 2369 | 82 | 68-94 | `Emissary` split aliases. |
| `star-trek-ds9-season-2` | 26 | 26 | 2370 | 98 | 86-110 | No feature-length exception. |
| `star-trek-ds9-season-3` | 26 | 26 | 2371 | 106 | 94-118 | No feature-length exception. |
| `star-trek-ds9-season-4` | 25 | 26 | 2372 | 112 | 100-120 | `The Way of the Warrior` split aliases. |
| `star-trek-ds9-season-5` | 26 | 26 | 2373 | 116 | 104-120 | No feature-length exception. |
| `star-trek-ds9-season-6` | 26 | 26 | 2374 | 120 | 108-120 | Serialized war season. |
| `star-trek-ds9-season-7` | 25 | 26 | 2375 | 120 | 108-120 | `What You Leave Behind` split aliases. |
| `star-trek-voy-season-1` | 15 | 16 | 2371 | 78 | 66-90 | `Caretaker` split aliases. |
| `star-trek-voy-season-2` | 26 | 26 | 2371-2372 | 96 | 84-108 | No feature-length exception. |
| `star-trek-voy-season-3` | 26 | 26 | 2372-2374 | 96 | 84-108 | Includes late-season Borg setup. |
| `star-trek-voy-season-4` | 26 | 26 | 2374 | 112 | 100-120 | Seven and Hirogen density. |
| `star-trek-voy-season-5` | 25 | 26 | 2375 | 108 | 96-120 | `Dark Frontier` split aliases. |
| `star-trek-voy-season-6` | 26 | 26 | 2375-2376 | 104 | 92-116 | Pathfinder and Borg children. |
| `star-trek-voy-season-7` | 24 | 26 | 2377-2378 | 112 | 100-120 | `Flesh and Blood` and `Endgame` split aliases. |

Planned family total: 2,100 target Lorecards. The practical target remains the 60-120 card band per season, with DS9 seasons 5-7 and VOY seasons 4 and 7 intentionally near the ceiling because of serial density.

## Current-Plan Audit Findings

The original plan had the correct 21-deck shape and useful source boundaries. The revision tightens the plan by making these season-specific gates explicit. These are not extra summary topics; they are the minimum gates authors must account for in the production target tables below.

| Deck | Added Or Corrected Audit Focus |
| --- | --- |
| `star-trek-tng-season-1` | Keep launch crew roles, Troi/Riker prior state, Crusher/Wesley family state, Tasha Yar death aftermath, and Starfleet parasite/Romulan return as gates instead of broad first-year recap. |
| `star-trek-tng-season-2` | Add Ten Forward social baseline, K'Ehleyr/Worf history, Picard artificial-heart vulnerability, Moriarty sentience, and Pulaski's season-local medical posture. |
| `star-trek-tng-season-3` | Add Sela setup, Barclay coping, Lal's death, Sarek mind-meld strain, and the Borg cliffhanger guard that blocks season 4 resolution. |
| `star-trek-tng-season-4` | Correct Ro Laren out of season 4; add O'Brien/Keiko wedding, Odan/Trill identity guard, Wesley Academy departure, and K'Ehleyr/Alexander/Worf consequence gates. |
| `star-trek-tng-season-5` | Add Ro Laren/Bajoran context, Nova Squadron/Wesley discipline, Kataan memory, Hugh individuality, and Unification secrecy without later Romulan or Borg outcomes. |
| `star-trek-tng-season-6` | Add Thomas Riker, The Chase, Scotty displacement, DS9 Birthright touchpoint, and Chain of Command torture state without DS9 future leakage. |
| `star-trek-tng-season-7` | Add Force of Nature warp-speed restriction, Troi bridge-officer state, Juliana/Data secret, Pegasus secrecy, and strict film/Picard-era guards. |
| `star-trek-ds9-season-1` | Add Opaka, Jake/Nog, Keiko school conflict, Dax symbiont rules, Quark station economy, and Winn/Bareil religious politics. |
| `star-trek-ds9-season-2` | Add Li Nalas, Winn's Kai path, Mirror universe branch handling, Odo/Mora, Maquis formation, and Jem'Hadar reveal without Founder identity. |
| `star-trek-ds9-season-3` | Add Defiant cloak and militarization, Founder reveal, Thomas Riker, Kasidy, Nog Starfleet ambition, Obsidian Order/Tal Shiar disaster, and Sisko promotion. |
| `star-trek-ds9-season-4` | Add Worf's station integration, Odo losing shapeshifting, Kurn's memory outcome, Rom unionization, Kira/Odo/Shakaar tension, and Earth martial-law paranoia. |
| `star-trek-ds9-season-5` | Add real Martok/Bashir return, Bashir genetic secret, Cardassia joining the Dominion, Rom/Leeta and resistance setup, Odo restored shapeshifting, and station-loss cliffhanger. |
| `star-trek-ds9-season-6` | Add occupation phase gates, Ziyal death/Dukat collapse, Damar turn-seed, Section 31, In the Pale Moonlight secrecy, Odo/Kira, and Jadzia death. |
| `star-trek-ds9-season-7` | Add Sarah/Prophet reveal, Ezri transition, Nog trauma recovery, Section 31 cure, Kira/Cardassian resistance, Damar rebellion, Rom as Nagus, Odo return to Link, and Sisko fate. |
| `star-trek-voy-season-1` | Add Cavit/Stadi deaths and command vacancies, Tuvok undercover reveal, Torres appointment, no-contact home premise, and Seska hidden-loyalty reveal. |
| `star-trek-voy-season-2` | Add Paris fake defection, Suder, Samantha/Naomi Wildman duplicate survival, Deadlock, Tuvix, Vidiian body horror, and Basics ship-loss cliffhanger. |
| `star-trek-voy-season-3` | Add mobile emitter acquisition, Kazon/Seska closure, Q civil war, Doctor family, Worst Case Scenario, Borg space/Species 8472 cliffhanger, and a Seven-not-yet guard. |
| `star-trek-voy-season-4` | Add Seven/Kes handoff, Annika Hansen/Raven history, Alpha Quadrant messages, Hirogen, Year of Hell branch reset, Omega Directive, and Hope and Fear. |
| `star-trek-voy-season-5` | Add Paris demotion, Torres depression, One, Doctor ethical trauma, Devore telepath secrecy, Dark Frontier, Course: Oblivion, Relativity, and Equinox cliffhanger. |
| `star-trek-voy-season-6` | Add Pathfinder routine contact, Barclay/Troi support, Borg children/Icheb, Life Line/Zimmerman, Vaadwaur, Memorial, Good Shepherd, and Unimatrix Zero cliffhanger. |
| `star-trek-voy-season-7` | Add Repression Maquis sleeper-command, Doctor authorship and triage ethics, Flesh and Blood split-story handling, Paris/Torres pregnancy, Neelix departure, and Endgame future-branch/homecoming guard. |

## Hard Gates

- Every season deck must have at least 60 Lorecards and must stay at or below 120 unless this plan is explicitly revised.
- Every Memory Alpha story row must have a timeline anchor and sourceInfo path, even when no standalone card is created.
- Every runtime episode alias must resolve to a known anchor or window.
- Every deck must include `loredeck.json`, `tags.json`, `entities.json`, `timeline.json`, `resolver.json`, `taxonomy.json`, `gate-types.json`, and `scoring.json` where the bundled structure expects them.
- Every entry file must use `schemaVersion: 3`.
- Every Lorecard must include `content.fact`, `content.injection`, `context`, retrieval metadata, registered tags, and sourceInfo.
- Every episode-specific card must name the source episode and include the relevant Memory Alpha URL in `sourceInfo`.
- Every wide or season-level card must use conservative retrieval so it does not crowd out episode-specific gates.
- Every deck must pass Pack Health with no errors, warnings, or suggestions before it is reference-quality.
- Every deck must have deck-specific count floors in a Star Trek health test so a thin scaffold cannot pass.
- Every deck must have leak checks for later-series, film-era, Picard-era, beta-canon, novel, comic, and fanon terms.

## Shared Authoring Rules

### Card Shape

Each Lorecard should answer one focused runtime need. Prefer cards like `Sisko's Emissary status after the wormhole discovery`, `Seven's constrained early trust in Janeway`, or `Data's personhood ruling after the Maddox hearing` over `DS9 season 1 summary` or `Data biography`.

Required card traits:

- `content.fact` is compact, factual, and reviewable.
- `content.injection` is original prompt-usable guidance, not copied source prose.
- `retrieval.entities`, `retrieval.topics`, and `retrieval.keywords` are specific enough to avoid broad false positives.
- `context` defines season-local or episode-local eligibility.
- `tags` are registered and useful for filtering.
- Title is specific enough to review in a deck workbench.
- `sourceInfo` names series, season, episode title, story episode, runtime episode alias, Memory Alpha URL, and stardate/date when available.

### Context Model

Use one shared 24th-century sort-key scale so stacked TNG, DS9, and VOY decks behave predictably:

| Sort Key Band | In-Universe Year | Covered Material |
| ---: | --- | --- |
| 10000-10999 | 2364 | TNG season 1 |
| 11000-11999 | 2365 | TNG season 2 |
| 12000-12999 | 2366 | TNG season 3 and TNG season 4 opening aftermath |
| 13000-13999 | 2367 | TNG season 4 |
| 14000-14999 | 2368 | TNG season 5 |
| 15000-15999 | 2369 | TNG season 6, DS9 season 1 |
| 16000-16999 | 2370 | TNG season 7, DS9 season 2 |
| 17000-17999 | 2371 | DS9 season 3, VOY season 1, VOY season 2 opening |
| 18000-18999 | 2372 | DS9 season 4, VOY season 2 |
| 19000-19999 | 2373 | DS9 season 5, VOY season 3 |
| 20000-20999 | 2374 | DS9 season 6, VOY season 4 |
| 21000-21999 | 2375 | DS9 season 7, VOY season 5 |
| 22000-22999 | 2376 | VOY season 6 |
| 23000-23999 | 2377 | VOY season 7 |
| 24000-24999 | 2378 | VOY finale and immediate homecoming boundary |

Each season deck must include:

- Season start and season end windows.
- Per-episode anchors in runtime-recognizable order.
- Before/after windows for major reveals, deaths, command changes, relationship changes, faction turns, and finales.
- Split-story aliases for feature-length premieres and finales.
- Aliases for episode titles, stardates, ships, stations, factions, major places, ranks, and recurring character names.

Use stardates when available, but do not make stardate precision the only Context path. Users must be able to select phrases like `DS9 season 5 before Call to Arms`, `TNG season 4 after Family`, or `VOY season 4 after Seven joins` without knowing a stardate.

### Spoiler Discipline

Each season deck may include only facts known within its season boundary. Later truth can be represented as `unknown at this point` only when that prevents leakage.

Core examples:

- TNG season 3 may end on Picard's assimilation cliffhanger, but must not include the season 4 rescue or Locutus aftermath.
- TNG season 5 may cover Hugh's individuality in `I Borg`, but must not import later Borg Cooperative, Lore-led Borg resolution, or Voyager Borg outcomes.
- TNG season 7 may cover the alternate future in `All Good Things...` only as Q/time-anomaly material, not as film-era or Picard-era continuity.
- DS9 season 2 may introduce the Dominion and Jem'Hadar, but must not reveal Founder identities before `The Search` in DS9 season 3.
- DS9 season 5 may lead into the station-loss cliffhanger, but must not resolve the Dominion occupation of DS9.
- DS9 season 6 may end with Jadzia's death, Dukat's Pah-wraith act, and Sisko leaving, but must not resolve Ezri, the Orb of the Emissary, or the finale.
- VOY season 3 may end with Borg space and Species 8472 setup, but must not assume Seven of Nine has joined Voyager.
- VOY season 4 may cover Seven's early integration, Year of Hell, and Alpha Quadrant messages, but must not leak Pathfinder routine contact or the finale homecoming.
- VOY season 7 may use Admiral Janeway's future as a branch/temporal spoiler gate for `Endgame`, not as globally true post-series state before the finale.

### Cross-Show Spoiler Discipline

TNG/DS9 overlap and DS9/VOY overlap require extra leak control:

- DS9 season 1 can refer to Wolf 359, Locutus, Picard, and the USS Saratoga as Sisko-local trauma. It must not require TNG season 3-4 to be loaded and must not recap the full Borg crisis.
- TNG season 6 can include Deep Space 9 as a station touchpoint in `Birthright`, Quark as a local station figure, and Bajoran/Cardassian occupation context only to the extent used in the episode. It must not import DS9 season 1 plot resolutions.
- TNG season 7 can introduce the Maquis through the Federation/Cardassian border and Ro Laren's decision. It must not import DS9's later Maquis or Dominion War outcomes.
- DS9 season 2 owns the named Maquis political crisis for DS9. VOY season 1 may include only the Maquis facts needed for the Voyager crew premise and must not depend on DS9 cards.
- VOY season 1 can mention that the Maquis were set up by the Federation/Cardassian border conflict, but Chakotay, Torres, Seska, and Tuvok state must be local to Voyager's premiere.
- DS9 Dominion War facts must not retrieve in TNG scenes unless the user explicitly sets DS9 context.
- VOY Borg outcomes must not rewrite TNG Borg cards. TNG Borg cards should remain scoped to Enterprise-D encounters; VOY cards should carry Voyager-local Borg, Seven, Borg children, and transwarp facts.
- Crossover characters are owned by the season deck where the current appearance happens. Barclay in VOY season 6 belongs to VOY season 6 with aliases back to TNG, not a retroactive TNG update.
- Mirror universe DS9 cards must be branch-scoped and must not overwrite Prime DS9 character state.

### Registry Strategy

Each deck needs its own registries even when tags overlap across the family. Reuse stable tag IDs consistently.

Recommended shared tag families:

- `fandom:star-trek`
- `continuity:star-trek-prime`
- `series:tng`, `series:ds9`, `series:voy`
- `season:tng-s1`, `season:ds9-s5`, `season:voy-s4`
- `episode:*`
- `character:*`
- `ship:*`
- `station:*`
- `faction:*`
- `species:*`
- `location:*`
- `quadrant:*`
- `topic:*`
- `relationship:*`
- `technology:*`
- `secret:*`
- `spoiler:*`

Do not register tags that are never used by a Lorecard. Do not create one-off tags when a retrieval entity or topic is enough. Major entities belong in `entities.json`; casual nouns from Memory Alpha entity extraction do not.

### File Layout

Each deck should be split into multiple focused entry files. Target 8-18 cards per file, with at least six entry files for every season deck except an explicitly documented short-season exception.

Example:

```text
content/loredecks/star-trek-ds9-season-5/
  loredeck.json
  manifest.json
  taxonomy.json
  gate-types.json
  scoring.json
  timeline.json
  tags.json
  entities.json
  resolver.json
  entries/
    dominion-cardassia-and-war-countdown.json
    klingons-martok-and-worf.json
    bajor-prophets-and-sisko.json
    bashir-odo-kira-dukat-garak.json
    ferengi-rom-nog-leeta-and-quark.json
    episode-anchors-and-spoiler-gates.json
```

### Provenance And Copyright

- Use Memory Alpha and source pages to identify facts, source boundaries, dates, and episode order.
- Write original compact facts and original injection text.
- Do not copy Memory Alpha, Wikipedia, transcripts, subtitles, official summaries, or episode recaps into Lorecards.
- Use per-episode Memory Alpha URLs for `sourceInfo`; use the generated evidence file as an index, not as prose.
- Mark uncertain card candidates for review instead of presenting them as vetted canon.

## Cross-Deck Entity Plan

Shared entities should be aliased consistently across all season decks.

Core cross-show entities:

- United Federation of Planets: Federation, UFP
- Starfleet: Starfleet Command, Federation Starfleet
- Klingon Empire: Klingons, High Council, Klingon Defense Force where relevant
- Romulan Star Empire: Romulans, Tal Shiar where relevant
- Cardassian Union: Cardassians, Central Command, Obsidian Order where relevant
- Borg Collective: Borg, Collective
- Maquis: Maquis cell, Federation colonist resistance
- Bajor: Bajorans, Bajoran Provisional Government
- Dominion: Founders, Changelings, Jem'Hadar, Vorta
- Q Continuum: Q, Continuum

TNG entities:

- USS Enterprise-D: Enterprise-D, Enterprise
- Jean-Luc Picard: Picard, Captain Picard, Locutus only after the assimilation window
- William Riker: Riker, Will Riker, Number One
- Data: Lieutenant Commander Data, Soong-type android
- Worf: Lieutenant Worf, Klingon security officer
- Geordi La Forge: Geordi, La Forge
- Deanna Troi: Troi, Counselor Troi
- Beverly Crusher: Dr. Crusher, Beverly
- Katherine Pulaski: Dr. Pulaski, Pulaski
- Tasha Yar: Yar, Natasha Yar
- Wesley Crusher: Wesley
- Guinan: Guinan, Ten Forward bartender
- Ro Laren: Ensign Ro, Ro, Maquis only after `Preemptive Strike`

DS9 entities:

- Deep Space 9: DS9, Terok Nor
- Benjamin Sisko: Sisko, Commander Sisko, Captain Sisko, Emissary when context-valid
- Jake Sisko: Jake, Jake Sisko
- Kira Nerys: Kira, Major Kira, Colonel Kira when context-valid
- Odo: Constable Odo, Changeling, Founder-linked only after reveal
- Jadzia Dax: Dax, Lieutenant Dax
- Ezri Dax: Ezri, Counselor Ezri Dax
- Julian Bashir: Bashir, Dr. Bashir, genetically enhanced only after reveal
- Miles O'Brien: O'Brien, Chief O'Brien
- Keiko O'Brien: Keiko, Keiko O'Brien
- Quark: Quark, Ferengi bartender
- Rom: Rom, engineer and Nagus only in valid windows
- Nog: Nog, cadet, ensign only in valid windows
- Garak: Elim Garak, plain simple tailor, Obsidian Order ties only in valid windows
- Gul Dukat: Dukat, former prefect, Dominion ally, Pah-wraith vessel only in valid windows
- Kai Winn: Winn Adami, Vedek Winn before elevation, Kai Winn after elevation
- Martok: General Martok, Changeling impostor only in valid windows

VOY entities:

- USS Voyager: Voyager, Intrepid-class Voyager
- Kathryn Janeway: Janeway, Captain Janeway, Admiral Janeway only inside `Endgame` future branch
- Chakotay: Chakotay, Maquis commander
- Tuvok: Tuvok, Vulcan security chief
- B'Elanna Torres: Torres, B'Elanna, chief engineer after appointment
- Tom Paris: Paris, helmsman, rank changes by window
- Harry Kim: Kim, Ensign Kim
- The Doctor: EMH, Emergency Medical Hologram, Doctor, ECH only in valid windows
- Neelix: Neelix, Talaxian guide, ambassador only after departure
- Kes: Kes, Ocampa
- Seven of Nine: Seven, Seven of Nine, Annika Hansen only after reveal
- Naomi Wildman: Naomi, Naomi Wildman
- Icheb: Icheb, Borg child
- Reginald Barclay: Barclay, Reg Barclay, Pathfinder support only in valid windows

Alias policy:

- Put alternate spellings and ranks in resolver aliases, not in card titles unless the alias matters for the card.
- Use rank transitions only in the Context windows where they apply.
- Avoid later identity labels before the season reveals them.
- Do not register mirror-universe aliases as Prime aliases unless the card is branch-scoped.

## The Next Generation Production Targets

TNG primary utility:

- Establish Enterprise-D crew state, Starfleet norms, Federation diplomacy, and 2360s Alpha/Beta Quadrant politics.
- Gate Q, Borg, Klingon, Romulan, Cardassian, Bajoran, Data, Worf, and Picard status changes by season and episode.
- Support TNG-era scenes without leaking DS9, Voyager, TNG films, or Picard-era retcons.

| Deck | Actionable Lorecard Targets |
| --- | --- |
| `star-trek-tng-season-1` | Target 78. Target clusters: 18 crew launch/role cards; 10 Q/Farpoint/Humanity-on-Trial cards; 8 Data/Wesley/Traveler/Soong setup cards; 8 Ferengi/Romulan/Klingon political baseline cards; 7 holodeck/technology/Starfleet rule cards; 6 Yar death and security succession cards; 6 relationship/family cards including Crusher/Wesley and Troi/Riker prior state; 15 episode-local high-value gates. Avoid one card per early guest planet. |
| `star-trek-tng-season-2` | Target 70. Target clusters: 12 Pulaski/Guinan/Ten Forward and crew-shift cards; 8 Data personhood and Moriarty holodeck cards; 8 Worf/K'Ehleyr/Klingon exchange cards; 8 Borg/Q/Picard artificial-heart gates; 6 Riker family and command-pressure cards; 6 O'Brien/Enterprise operational baseline cards; 22 focused episode/state gates. Keep Pulaski's later absence out unless phrased as a season boundary. |
| `star-trek-tng-season-3` | Target 94. Target clusters: 12 mature Enterprise and Crusher-return cards; 12 Romulan/Sela/alternate-timeline gates; 10 Worf/Kurn/Duras/discommendation cards; 10 Data/Lal/Sarek/Barclay/Vash character-state cards; 8 Borg escalation and Picard-assimilation cliffhanger cards; 8 technology/anomaly/holodeck gates; 34 focused episode gates. Block the season 4 Borg resolution. |
| `star-trek-tng-season-4` | Target 100. Target clusters: 14 Locutus rescue, Wolf 359, and Picard trauma cards; 12 Worf/K'Ehleyr/Alexander/Duras/Klingon succession cards; 10 Data/Soong/Lore and android-family cards; 8 Cardassian/O'Brien/`The Wounded` border cards; 7 Wesley Academy departure cards; 6 O'Brien/Keiko wedding and crew-family cards; 6 Trill/Odan and medical/identity guards; 37 focused episode gates. Do not place Ro Laren here; her arrival is season 5. |
| `star-trek-tng-season-5` | Target 102. Target clusters: 12 Ro Laren/Bajoran occupation/Cardassian border cards; 12 Romulan reunification/Spock/Sela/Redemption aftermath cards; 10 Borg/Hugh/Crystalline Entity/Data cards; 10 Worf injury/ethics/Nova Squadron/Wesley cards; 8 Picard memory, archaeology, Darmok, and Kataan cards; 8 temporal/anomaly/technology gates; 42 focused episode gates. Block later Lore-led Borg and DS9 Bajoran politics. |
| `star-trek-tng-season-6` | Target 102. Target clusters: 12 Chain of Command/Jellico/Cardassian torture cards; 10 DS9 Birthright touchpoint and Klingon faith cards; 10 Romulan/Tal Shiar/reunification pressure cards; 8 Moriarty, Scotty, transporters, and holodeck reality cards; 8 Q/Tapestry/Picard life-path cards; 8 Thomas Riker, The Chase, Barclay, and Data emotion/Lore setup cards; 8 Borg/Descent cliffhanger cards; 38 focused episode gates. Do not resolve Thomas Riker's DS9 future here. |
| `star-trek-tng-season-7` | Target 94. Target clusters: 10 Descent resolution and Borg/Lore/Data state cards; 10 Pegasus/Riker/Starfleet secrecy cards; 10 Maquis/Cardassian/Ro/Journey's End cards; 8 Worf family, Alexander, and parallel identity cards; 8 Data/Juliana, Troi command, and final crew-state cards; 7 warp-speed restriction, holodeck, and technology/anomaly gates; 8 Lower Decks/Sito junior-officer cards; 8 Q/finale temporal cards; 25 focused episode gates. Block Generations, later films, and Picard-era outcomes. |

## Deep Space Nine Production Targets

DS9 primary utility:

- Support station, Bajor, Cardassian occupation aftermath, wormhole, Prophets, Ferengi commerce, Dominion escalation, and serialized war-state retrieval.
- Treat DS9 as more serialized than TNG; later seasons need tight phase windows and more status-change cards.
- Gate Bajoran religion, Sisko's Emissary role, Odo's identity, Bashir's secret, Dukat's status, Damar's role, Section 31, and Dominion War facts by season and episode.

| Deck | Actionable Lorecard Targets |
| --- | --- |
| `star-trek-ds9-season-1` | Target 82. Target clusters: 12 Sisko/Wolf 359/Jake/command cards; 12 Bajor/occupation/Prophets/Emissary cards; 8 Kira resistance and Bajoran politics cards; 8 Odo unknown-origin and station law cards; 8 Dax/Bashir/O'Brien/Keiko crew cards; 8 Quark/Ferengi station-economy cards; 8 wormhole/Gamma Quadrant route cards; 6 Opaka/Winn/Bareil/religious conflict cards; 12 focused episode gates including `Duet`. |
| `star-trek-ds9-season-2` | Target 98. Target clusters: 14 Circle/Li Nalas/Bajoran coup cards; 12 Cardassian orphan, occupation, Dukat, and Garak cards; 10 Maquis/Federation/Cardassian treaty cards; 8 Odo/Mora/Kira trust cards; 8 Ferengi/Zek/Rom/Nog cards; 8 Winn/Bareil/Kai politics cards; 8 Mirror universe branch cards; 8 Dominion/Jem'Hadar pre-Founder cards; 22 focused episode gates. Block Founder identity. |
| `star-trek-ds9-season-3` | Target 106. Target clusters: 12 Defiant, cloak, station militarization, and Sisko promotion cards; 12 Founder/Odo/Changeling identity cards; 12 Dominion/Gamma Quadrant strategic cards; 10 Cardassian/Romulan/Obsidian Order/Tal Shiar cards; 8 Kira/Shakaar/Bareil grief cards; 8 Thomas Riker/Maquis and Eddington setup cards; 8 Past Tense temporal branch cards; 8 Nog/Kasidy/Ferengi family cards; 28 focused episode gates. |
| `star-trek-ds9-season-4` | Target 112. Target clusters: 14 Worf arrival/Klingon-Cardassian war cards; 12 Changeling paranoia/Homefront/Paradise Lost cards; 10 Odo judgment and loss-of-shapeshifting cards; 10 Dukat/Ziyal/Kira/Cardassian status cards; 8 Dax/Rejoined and Worf/Jadzia setup cards; 8 Nog Academy and Ferengi labor/Rom cards; 8 Kira/Shakaar/Odo relationship cards; 8 Kurn/Martok/Klingon honor cards; 34 focused episode gates. |
| `star-trek-ds9-season-5` | Target 116. Target clusters: 14 Klingon war resolution/Martok/Worf cards; 14 Dominion prison camp/Bashir replacement/Cardassia joins Dominion cards; 12 Bashir genetic secret and Jack Pack setup cards; 10 Odo restored shapeshifting and Odo/Kira cards; 10 Sisko visions/Rapture/Bajoran admission cards; 10 Eddington/Maquis and Maquis collapse setup cards; 8 Worf/Jadzia and Kira/O'Brien baby cards; 8 Ferengi/Rom/Leeta/Nog cards; 8 station-loss cliffhanger cards; 22 focused episode gates. |
| `star-trek-ds9-season-6` | Target 120. Target clusters: 18 six-episode occupation/resistance/retaking-DS9 cards; 16 Dominion War strategy, fleets, casualties, and front-line ethics cards; 12 Sisko/Romulan alliance/In the Pale Moonlight cards; 10 Section 31/Bashir cards; 10 Worf/Jadzia marriage and Jadzia death cards; 10 Dukat/Ziyal/Damar breakdown and turn-seed cards; 8 Odo/Kira and Female Changeling cards; 8 Ferengi/Nog/Valiant wartime idealism cards; 8 Prophets/Pah-wraith cliffhanger cards; 20 focused episode gates. |
| `star-trek-ds9-season-7` | Target 120. Target clusters: 14 Sisko/Prophets/Sarah/Orb/Ezri transition cards; 14 Ezri identity and crew reintegration cards; 12 Nog AR-558 injury and trauma recovery cards; 14 Section 31 cure/Odo Link crisis cards; 16 Dominion War final chapter/Damar/Cardassian resistance cards; 10 Kira Starfleet commission/Garak/Cardassia cards; 10 Winn/Dukat/Pah-wraith endgame cards; 8 Ferengi succession/Rom/Nagus cards; 8 Bashir/Ezri/Worf relationship end-state cards; 14 finale departure/status cards. |

## Voyager Production Targets

VOY primary utility:

- Support Voyager's isolated Delta Quadrant premise, Starfleet/Maquis integration, crew-as-family state, resource scarcity, recurring Delta Quadrant species, Borg escalation, and homeward trajectory.
- Treat Alpha Quadrant contact as a season-gated status change.
- Keep Seven, Borg children, Pathfinder, Q, Seska, Kazon, Species 8472, and finale homecoming facts gated by season and episode.

| Deck | Actionable Lorecard Targets |
| --- | --- |
| `star-trek-voy-season-1` | Target 78. Target clusters: 14 Caretaker displacement, 70,000-light-year, array-destruction, and no-return cards; 12 Starfleet/Maquis integration and Chakotay/Tuvok/Torres/Seska cards; 10 Janeway command ethics and crew losses/replacements cards; 8 EMH activation, sickbay limits, and personhood baseline cards; 8 Kes/Neelix/Ocampa cards; 8 Kazon/Vidiian/Delta-local threat cards; 6 scarcity, bio-neural gel, and ship operations cards; 12 focused episode gates. |
| `star-trek-voy-season-2` | Target 96. Target clusters: 14 Kazon-Nistrim/Seska/Cullah/Basics cards; 12 Maquis trust strain, Paris fake defection, and Chakotay cards; 12 EMH autonomy and Denara Pel cards; 10 Vidiian Phage and medical/body-horror cards; 8 Suder/Tuvok/Meld ethics cards; 8 Q right-to-die and Continuum cards; 8 Deadlock/Wildman/Naomi duplicate-survival cards; 8 Tuvix/Janeway decision cards; 16 focused episode gates. |
| `star-trek-voy-season-3` | Target 96. Target clusters: 10 Basics recovery and Kazon/Seska closure cards; 10 EMH mobile emitter, Doctor family, and autonomy cards; 8 Future's End temporal cards; 8 Q civil-war and Continuum cards; 8 Kes possession/future-glimpse and Ocampa cards; 8 Borg remains/Borg space/Species 8472 cliffhanger cards; 8 Neelix/Fair Trade and Delta-local politics cards; 8 Maquis holoprogram/Worst Case Scenario cards; 28 focused episode gates. |
| `star-trek-voy-season-4` | Target 112. Target clusters: 16 Seven joins, Annika Hansen/Raven history, and early trust cards; 10 Kes departure and Gift aftermath cards; 14 Borg/Species 8472/Scorpion/Prey cards; 10 Paris/Torres relationship and crew-family cards; 10 Hirogen and Killing Game cards; 8 Krenim/Year of Hell temporal-reset branch cards; 8 Alpha Quadrant message and Hope and Fear cards; 8 Omega Directive and Starfleet secrecy cards; 8 Doctor autonomy/mobile-emitter cards; 20 focused episode gates. |
| `star-trek-voy-season-5` | Target 108. Target clusters: 12 Night/void morale and crew-risk cards; 12 Seven identity, One, Infinite Regress, and Borg Queen/Dark Frontier cards; 10 Janeway/Seven trust-conflict cards; 10 Torres depression, Paris demotion, and relationship cards; 8 Doctor ethical trauma and medical rules cards; 8 Species 8472 infiltration and Devore telepath secrecy cards; 8 Timeless/Relativity temporal branch cards; 8 Course: Oblivion duplicate-crew cards; 8 Equinox cliffhanger cards; 24 focused episode gates. |
| `star-trek-voy-season-6` | Target 104. Target clusters: 12 Equinox aftermath and Janeway ethical-line cards; 12 Pathfinder/Barclay/Troi/two-way-contact cards; 12 Seven ex-Borg survivors and Borg children/Icheb cards; 10 Doctor fantasy/Zimmerman/Life Line autonomy cards; 8 Vaadwaur and Delta politics cards; 8 Torres Klingon afterlife and family identity cards; 8 Blink of an Eye/Memorial/Good Shepherd episode-state cards; 8 Unimatrix Zero cliffhanger cards; 26 focused episode gates. |
| `star-trek-voy-season-7` | Target 112. Target clusters: 12 Unimatrix Zero resolution and Borg resistance cards; 12 Seven/Icheb cortical-node and human-emotion cards; 10 Paris/Torres pregnancy and family cards; 10 EMH rights, Author Author, Critical Care, and ECH cards; 8 Pathfinder/Inside Man and Alpha contact cards; 8 Hirogen hologram rebellion and Flesh and Blood split-story cards; 8 Maquis sleeper-command and Seska temporal cards; 8 Neelix/Homestead departure cards; 14 Endgame Admiral Janeway/Borg transwarp/homecoming branch cards; 22 focused episode gates. |

## Noisy Gate Rejection List

The evidence generator intentionally over-detects possible gates. Authors must reject noisy candidates before JSON authoring.

Reject cards based only on:

- Generic `episode-local fact/status gate` with no durable consequence.
- Incidental species or faction mentions that do not affect the season state.
- One-off medical conditions, guest planets, energy phenomena, or technobabble unless they change a recurring rule.
- Production notes, original airdates, ratings, script issues, and behind-the-scenes trivia.
- Full guest-character recaps.
- Broad season summaries such as `Dominion War state` without a narrower phase, faction, or character effect.
- Timeline/meta cards whose only purpose is to restate episode order. Episode order belongs in `timeline.json`, not in Lorecards.
- Prompt-instruction boilerplate such as `do not summarize` inside card content. That belongs in this plan and validation tests, not runtime lore.

A standalone card should survive review because it changes runtime writing behavior. If it does not alter who knows what, what is true now, what is dangerous, how a relationship behaves, how a faction acts, or which future facts are blocked, it should remain only as source evidence.

## Quality Targets By Card Type

Use these ranges as review diagnostics, not rigid quotas:

- 20-30 percent character and relationship state.
- 20-30 percent arc events and durable episode consequences.
- 10-20 percent factions, species, politics, religion, and diplomacy.
- 10-15 percent ships, stations, locations, routes, and local setting state.
- 10-15 percent technology, science, medicine, temporal rules, Borg rules, Q rules, holodeck rules, and anomaly rules.
- 5-10 percent secrets, future guards, reveal gates, branch guards, and contested truths.
- 5-10 percent source, timeline, and Context support cards where a card is justified by runtime behavior. Do not create pure index cards.

A lopsided deck fails review even if it meets count. Examples: no relationship cards in DS9 season 6, no faction cards in TNG season 7, no technology/route cards in Voyager, or dozens of plot-summary event cards with no retrieval value.

## Validation Plan

Create or update `tools/scripts/test-star-trek-loredeck-health.mjs` after the first JSON pass. It must enforce this plan, not just schema parsing.

Required assertions:

- Exact deck ID set matches the 21 season decks in this plan.
- Every deck exists in `content/loredecks/index.json` with the correct Library path.
- Every deck has `loredeck.json`, required registries, resolver, timeline, and entry files.
- Every entry file uses `schemaVersion: 3`.
- Every deck has `stats.entryCount` equal to the actual loaded entry count.
- Every deck meets its deck-specific minimum range floor and no deck has fewer than 60 cards.
- No deck exceeds its acceptable maximum unless this plan is updated.
- Every deck has at least six focused entry files; no entry file should exceed 22 cards unless documented.
- Every Memory Alpha story row in the evidence JSON has one matching timeline anchor.
- Every runtime episode alias listed in this plan resolves to an anchor or window.
- Feature-length stories have aliases for both single-story and split-hour numbering.
- Every episode-specific Lorecard has `sourceInfo.memoryAlphaUrl` and source episode metadata.
- Every episode-specific Lorecard has an episode anchor or valid before/after window.
- Every card has `content.fact`, `content.injection`, `context`, retrieval metadata, registered tags, and sourceInfo.
- Every card has at least one registered `series:*` tag and one registered `season:*` tag.
- Every deck has no unregistered tags and no unused registry tags except approved family-wide tags.
- Every `continuity.sourceBoundary` states show, season, in-universe years, Memory Alpha story-row count, runtime alias count, and excluded continuity.
- Every wide or global card has conservative retrieval and avoids `schema_v3_wide_lore_retrieval` warnings.
- Cross-show cards include sourceInfo and do not duplicate full off-show plots.
- Later-film, Picard-era, beta-canon, novel, comic, and fanon leakage terms fail unless they appear in an explicit future-guard allowlist.
- No card may contain copied wiki summary phrasing, generator boilerplate, or pure timeline metadata.
- Every deck has no Pack Health errors, warnings, or suggestions.

Recommended assertions:

- Every season has at least one spoiler/future-guard card for each major unresolved cliffhanger or hidden identity.
- Every season has at least one relationship-state card where the season materially changes relationships.
- Every season has at least one faction/politics card unless explicitly justified.
- Every season has at least one technology/rule card for recurring tech or anomaly constraints.
- Every DS9 season 5-7 deck has phase windows for the Dominion War state.
- Every Voyager season has a Delta Quadrant isolation or home-contact status window.
- Every TNG season has Enterprise-D crew state and command-state windows.
- No card title matches broad patterns like `Season Summary`, `Episode Summary`, `Character Biography`, `Complete History`, or `General Lore`.
- No source URL appears only in a deck-level note when episode-specific cards depend on it.

Suggested fixture tests:

- `DS9 season 2 before The Jem'Hadar` must not retrieve Founder identity.
- `DS9 season 3 after The Search` may retrieve Founder identity.
- `VOY season 3 Scorpion` must not retrieve Seven as a Voyager crew member.
- `VOY season 4 after The Gift` may retrieve Seven's early crew status and Kes departure.
- `TNG season 3 Best of Both Worlds` must not retrieve Picard's family recovery from season 4.
- `TNG season 7 Preemptive Strike` may retrieve Ro's Maquis turn but not Dominion War consequences.
- `DS9 season 1 Emissary` may retrieve Wolf 359 trauma but not a full TNG Borg recap.
- `VOY season 1 Caretaker` may retrieve local Maquis premise but not DS9 Dominion or later Maquis collapse.

## Production Sequence

1. Refresh Memory Alpha evidence artifacts if source routing or scope changes.
2. Repair or flag malformed generated evidence before timeline import.
3. Lock shared Star Trek ID, tag, entity, timeline, resolver, and sourceInfo conventions.
4. Build timeline anchors and resolver aliases for all 21 decks before drafting Lorecards.
5. Draft title lists by entry file and review them against the card promotion checklist.
6. Build TNG season decks first, establishing Enterprise-D, Borg, Q, Klingon, Romulan, Cardassian, Bajoran, Worf, Data, and Picard conventions.
7. Build DS9 season decks next, with extra care for Bajor/Prophets, Odo/Founder state, Maquis, Section 31, and Dominion War phase windows.
8. Build VOY season decks after DS9 baselines, with local Maquis and Borg handling that does not require TNG or DS9 decks to be loaded.
9. Register all 21 decks in `content/loredecks/index.json` with show-specific Library folders and family ordering.
10. Run Pack Health after each deck, not only after the whole family.
11. Run the Star Trek health/conformance test and Context fixture tests.
12. Review injected sample text from each deck for wiki-summary drift, overbroad retrieval, and spoiler leakage.
13. Treat the season decks as reference-quality bundled content only after all checks pass.

## Acceptance Criteria

The Star Trek bundled deck family is complete only when:

- All 21 season Loredecks exist and are registered.
- Every TNG, DS9, and VOY season has its own deck.
- Every deck meets its planned density range or this plan documents a revised range.
- Total family coverage remains roughly 1,950-2,100 Lorecards unless a future review revises it.
- The Memory Alpha evidence artifacts cover all 517 story rows with no fetch failures, or any revised count is documented here.
- Every Memory Alpha story row has a timeline anchor, sourceInfo route, and resolver path.
- Every feature-length story has story-row and split-runtime aliases.
- Every deck passes Pack Health cleanly.
- Every deck has episode-level Context anchors and major reveal windows.
- Cross-show overlap works without requiring unrelated deck families to be loaded.
- Season decks remain spoiler-aware across TNG, DS9, VOY, later films, and later Star Trek shows.
- The Star Trek health test fails on thin scaffolds, wiki-summary cards, missing sourceInfo, missing episode anchors, noisy generated gates, and leaked future facts.

## Revision Notes

- Corrected and expanded missing high-value season gates, including TNG season 4 Ro Laren placement, TNG season 7 warp-speed and Troi/Data gates, DS9 late-war Section 31 and Damar/Cardassian resistance gates, and Voyager Seven/EMH/Pathfinder/finale branch gates.
- Replaced vague required coverage with actionable per-season card cluster targets while preserving the 60-120 card production band.
- Added a concrete Memory Alpha evidence workflow for turning story rows into timeline anchors, resolver aliases, sourceInfo, Context windows, and card candidates.
- Added explicit noisy-gate rejection rules so generated evidence signals do not become low-value cards.
- Strengthened cross-show spoiler discipline for TNG/DS9 and DS9/VOY overlap, especially Wolf 359, Birthright, Maquis setup, Dominion War leakage, and Voyager Borg outcomes.
- Expanded validation so scaffolds, wiki summaries, missing sourceInfo, missing episode anchors, broken aliases, broad retrieval, and future-continuity leaks fail before bundled release.
