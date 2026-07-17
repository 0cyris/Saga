# Scope Brief: <Canon Name>

## Fandom and source range

*What canon is covered, which specific sources back it, and exactly where coverage starts and stops. Name the editions/media so a reader can reproduce the boundary.*

- Covers: *e.g. "The Founding Trilogy" novels, books 1–3 (2011–2015 UK hardback editions).*
- Coverage starts at: *e.g. Book 1, Chapter 1.*
- Coverage stops at: *e.g. end of Book 3 epilogue. Companion short stories and the RPG sourcebook are out of range.*

## Continuity and canon tier

*Which continuity/adaptation this deck models, its canon tier, and what is explicitly out of bounds (crossovers, later reboots, fanon).*

- Continuity id: *e.g. `foundingverse-novels`.*
- Canon tier: *`primary` | `secondary` | `tertiary` — e.g. `primary` (author's original prose).*
- Adaptation: *e.g. none; or "2020 TV adaptation" if that is the modeled version.*
- Out of bounds: *e.g. the film adaptation's altered ending, tie-in comics, and community headcanon.*

## Deck split

*Single deck or a family. If a family, list each deck, its role (`core` or an era/arc slug), and why the split exists. Keep the split aligned to how a player consumes the story.*

- Shape: *`single` | `family`.*
- Decks (family only):
  - *`foundingverse-core` (role: core) — durable world rules, systems, and cross-era entities shared by every deck.*
  - *`foundingverse-book1` (role: era) — entities and reveals scoped to Book 1; recommends the core deck.*

## Story-coordinate model

*What Context is measured in for this canon — dates, book/chapter, season/episode, arc, route, campaign session. This drives the timeline axis and anchor design.*

- Primary axis: *e.g. book + chapter (story order), no in-world calendar.*
- Secondary markers: *e.g. named arcs ("The Siege", "The Reckoning") used for windows.*
- Notes: *e.g. flashbacks are common — sort by narrative reveal order, not in-universe chronology.*
- Multi-axis? *If the canon has more than one coordinate system readers actually use (calendar date, book/season, named arc), plan `timeline.json` as `timelineMode: "hybrid"` with an `axes[]` array — one axis per coordinate — rather than forcing everything onto a single label. Single-axis canons should skip this.*

## Spoiler philosophy

*What must stay gated and until when. Name the big reveals and the story point that unlocks each. When unsure, gate tighter.*

- Hard-gated reveals: *e.g. the mentor's betrayal (unlocks at Book 2 Ch. 14); the protagonist's true parentage (unlocks at Book 3 climax).*
- Default posture: *e.g. gate all deaths, identities, and prophecies to the scene where the text confirms them.*

## Assumptions and risks

*Anything uncertain, contested between sources, or deliberately deferred to a later pass.*

- *e.g. Two wiki pages disagree on the fall of the capital's date — recorded as contested, deferred until primary text is checked.*
- *e.g. Magic-system edge cases are under-specified in the text; will model only what is stated, mark the rest anti-lore.*
