# Jujutsu Kaisen Loredeck Series Plan

Status: implementation started
Last source-status check: 2026-06-11
Target package type: Bundled Lorepack family

## Goal

Build a manga-primary Jujutsu Kaisen Loredeck family that covers the full mainline story through chapter 271 and the final volume, while keeping every Lorecard granular, Context-aware, spoiler-safe, retrieval-useful, and clean under Pack Health.

This is not a wiki coverage project. The family should help Saga answer what is true at the current story point, what is hidden or unknown, which cursed techniques or rules matter in-scene, and which deaths, identities, power states, and faction shifts must not leak early.

## Source Boundary

Initial recommendation:

- Primary continuity: Jujutsu Kaisen manga mainline by Gege Akutami, including Jujutsu Kaisen 0 as a prequel deck and the main series through chapter 271.
- Default family scope: manga-primary, not anime-primary.
- Optional later overlays: anime adaptation differences, movies, light novels, games, official guides, and Jujutsu Kaisen Modulo.
- Modulo is implemented as a separate sequel/spinoff continuity deck under its own `Jujutsu Kaisen / Modulo` library path, not merged into the manga-main stack.

Source status verified from official VIZ pages:

- VIZ lists Jujutsu Kaisen by Gege Akutami and exposes chapter listings from 0.x and chapter 1 through chapter 271, with volume 30 marked as the final volume: https://www.viz.com/shonenjump/chapters/jujutsu-kaisen
- VIZ's series page marks Jujutsu Kaisen, Vol. 30 as the final volume: https://www.viz.com/jujutsu-kaisen
- VIZ lists Jujutsu Kaisen Modulo as a separate series by Gege Akutami and Yuji Iwasaki, with chapter 1 on 2025-09-07 and chapter 25 on 2026-03-08: https://www.viz.com/shonenjump/chapters/jujutsu-kaisen-modulo

These links are source-boundary references only. Actual Lorecard drafting still needs human canon review against licensed source material.

## Saga Authoring Constraints

Follow these repo guides:

- `docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md`
- `docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md`
- `docs/loredecks/SAGA_LOREDECK_SCHEMA.md`
- `docs/development/SAGA_TERMINOLOGY.md`

Required behavior:

- Use `Loredeck`, `Lorecard`, `Context`, and `Pack Health` in public-facing docs.
- Use the package label Bundled Lorepack once these are shipped with Saga.
- Keep on-disk fields such as `packId` and `loredeck.json`; bundled deck folders should be authored under `content/loredecks/`.
- Register bundled defaults in `src/loredecks/loredeck-defaults.js`.
- Put validation scripts under `tools/scripts/`.
- Do not draft full Lorecards before the scope, source-range split, timeline model, tag model, and title batches are reviewed.
- Do not preserve legacy compatibility scaffolding. This repo is pre-alpha, so update generated plans and future implementation in place.

## Recommended Family

Use the MHA family as the nearest structural reference: one reusable core deck plus ordered arc decks. Do not make one monolithic JJK deck.

| Order | Pack ID | Title | Source range | Role |
| --- | --- | --- | --- | --- |
| 10 | `jjk-core` | Jujutsu Kaisen: Core | Cross-series manga fundamentals | Cursed energy rules, jujutsu society, schools, clans, curses, sorcerer grades, basic technique/domain rules, conservative identity and knowledge gates. |
| 20 | `jjk-zero` | Jujutsu Kaisen 0 | Prequel volume / chapter 0.x material | Yuta, Rika, Geto's earlier faction state, Tokyo Jujutsu High first-year roster, and pre-mainline reveal guards. |
| 30 | `jjk-origin-death-painting` | Jujutsu Kaisen: Origin through Death Painting | Mainline opening through Death Painting | Yuji's entry, Sukuna vessel status, early Tokyo students, detention center, Junpei/Mahito, Kyoto Goodwill, and Death Painting aftermath. |
| 40 | `jjk-hidden-inventory-premature-death` | Jujutsu Kaisen: Hidden Inventory and Premature Death | Gojo's Past arc | Star Plasma Vessel mission, teen Gojo/Geto states, Toji, Tengen, and the ideological split that later powers major secrets. |
| 50 | `jjk-shibuya-incident` | Jujutsu Kaisen: Shibuya Incident | Shibuya setup through aftermath | High-density incident deck for sealing, death/status changes, faction losses, curse-user moves, and public/sorcerer knowledge shifts. |
| 60 | `jjk-post-shibuya-preparation` | Jujutsu Kaisen: Post-Shibuya and Perfect Preparation | Itadori Extermination through Perfect Preparation | Yuji's sentence, Yuta's return, Tengen exposition, Zenin clan collapse, Maki state changes, and Culling Game setup. |
| 70 | `jjk-culling-game-colonies` | Jujutsu Kaisen: Culling Game Colonies | Early and middle Culling Game colony action | Game rules, colony locations, point/rule mechanics, player states, Hakari, Higuruma, Sendai, Tokyo colonies, and tactical reveals. |
| 80 | `jjk-culling-game-convergence` | Jujutsu Kaisen: Culling Game Convergence | Late Culling Game through Gojo unsealing | Kenjaku, Tengen, military incursion, Sakurajima, Angel, Prison Realm resolution, and endgame setup. |
| 90 | `jjk-shinjuku-showdown` | Jujutsu Kaisen: Shinjuku Showdown and Aftermath | Final battle through chapter 271 | Gojo/Sukuna battle, rotating plans, death/status reveals, final Sukuna resolution, epilogue states, and late-series spoiler guards. |
| 110 | `jjk-modulo` | Jujutsu Kaisen Modulo | Sequel/spinoff chapters 1-25 | Separate future-continuity deck for Simurians, Maru, Yuka and Tsurugi Okkotsu, alien jujutsu, coexistence-test stakes, and Modulo spoiler guards. |

Default stack should usually be:

```text
1. User Custom Lorepack, if present
2. Current arc deck
3. Jujutsu Kaisen: Core
4. Jujutsu Kaisen 0 only when prequel/Yuta/Geto/Rika context matters
```

## Context Model

Use `anchor_window` Context for every bundled JJK deck.

Primary axes:

- `arc`: broad story arc or incident.
- `chapter`: manga chapter or chapter range.
- `knowledge_state`: what ordinary people, jujutsu society, students, villains, or specific characters know.
- `sukuna_vessel_state`: Yuji/Sukuna and later host-state boundaries.
- `gojo_status`: active, past, sealed, unsealed, final battle, aftermath.
- `culling_game_state`: inactive, rules introduced, active colonies, convergence, resolved.

Optional later axis:

- `adaptation`: manga, anime, film, light novel, game, guidebook. This should not affect the manga-primary family unless an overlay deck is loaded.

Candidate global anchors:

| Sort key band | Anchor ID | Label |
| --- | --- | --- |
| 0-900 | `jjk.zero.yuta-enters-tokyo-jujutsu-high` | Yuta enters Tokyo Jujutsu High |
| 1000 | `jjk.main.yuji-eats-sukuna-finger` | Yuji becomes Sukuna's vessel |
| 1600 | `jjk.main.detention-center-sukuna-emerges` | Detention center Sukuna emergence |
| 2300 | `jjk.main.mahito-junpei-incident` | Junpei and Mahito incident |
| 3100 | `jjk.main.kyoto-goodwill-event` | Kyoto Goodwill Event |
| 3800 | `jjk.main.death-painting-aftermath` | Death Painting aftermath |
| 4500 | `jjk.past.star-plasma-vessel-mission` | Star Plasma Vessel mission |
| 5200 | `jjk.past.geto-breaks-from-jujutsu-society` | Geto breaks from jujutsu society |
| 6500 | `jjk.shibuya.gojo-sealed` | Gojo is sealed in Shibuya |
| 7200 | `jjk.shibuya.aftermath` | Shibuya aftermath |
| 7900 | `jjk.postshibuya.yuta-execution-order` | Yuta receives Yuji execution order |
| 8500 | `jjk.preparation.zenin-clan-collapse` | Zenin clan collapse |
| 9300 | `jjk.culling.rules-established` | Culling Game rules established |
| 10100 | `jjk.culling.tokyo-colony-one` | Tokyo No. 1 Colony focus |
| 10900 | `jjk.culling.sendai-colony` | Sendai Colony focus |
| 11700 | `jjk.culling.sakurajima-colony` | Sakurajima Colony focus |
| 12600 | `jjk.culling.gojo-unsealed` | Gojo is unsealed |
| 13400 | `jjk.shinjuku.showdown-begins` | Shinjuku Showdown begins |
| 15000 | `jjk.shinjuku.final-aftermath` | Final aftermath |

Each deck should also define local windows so users can select natural phrases like `post-Shibuya`, `during Hidden Inventory`, `before Gojo is sealed`, `early Culling Game`, or `after Gojo is unsealed` without loading future facts.

## Tag Model

Initial tag namespaces:

- `fandom:jjk`
- `continuity:jjk-manga-main`
- `continuity:jjk-zero`
- `continuity:jjk-modulo`
- `adaptation:manga`
- `arc:*`
- `character:*`
- `faction:*`
- `clan:*`
- `curse:*`
- `location:*`
- `technique:*`
- `domain:*`
- `item:*`
- `secret:*`
- `status:*`
- `knowledge:*`
- `topic:*`

Pack Health implication: every used tag must be defined in `tags.json`; no placeholder tags should survive into a reference-ready deck.

## File Layout Pattern

Each deck should use the current bundled layout:

```text
content/loredecks/jjk-core/
  loredeck.json
  taxonomy.json
  tags.json
  entities.json
  timeline.json
  resolver.json
  gate-types.json
  scoring.json
  assets/
    cover.png
    banner.png
  core/
    cursed_energy_rules.json
    jujutsu_society.json
    factions_schools_and_clans.json
    techniques_domains_and_binding_vows.json
    identity_aliases.json
    core_knowledge_gates.json
    status_and_death_guards.json
```

Arc decks should use one topic folder per deck, for example:

```text
content/loredecks/jjk-shibuya-incident/
  shibuya_incident/
    setup_and_barriers.json
    gojo_and_prison_realm.json
    station_battles.json
    mahito_and_transfigured_humans.json
    sukuna_shibuya_state.json
    losses_status_and_aftermath.json
    cross_arc_guards.json
```

## Lorecard Density Targets

Use focused-to-dense coverage, not exhaustive wiki coverage.

Initial target bands:

- Core: 90-130 Lorecards.
- Jujutsu Kaisen 0: 45-70 Lorecards.
- Smaller arc decks: 60-90 Lorecards.
- Shibuya and Shinjuku: 120-170 Lorecards each.
- Culling Game split decks: 90-140 Lorecards each.
- Modulo, if included: 50-90 Lorecards until its role is clearer.

Density should be earned by scene utility. Add cards for state changes, reveal gates, technique rules, relationship shifts, faction moves, and irreversible consequences. Do not add cards that only restate obvious character biography.

## Health Requirements

Before any JJK deck can be treated as reference-ready:

- `loredeck.json` uses `schemaVersion: 1`, `entrySchemaVersion: 3`, `type: "bundled"`, and compatibility min/max 3.
- Every entry file uses `schemaVersion: 3`.
- Every Lorecard has a stable `id`, `title`, `category`, `priority`, `content.fact`, and `content.injection`.
- Every schema v3 Lorecard has `context.scope`, `context.precision`, `context.label`, `context.sortKeyFrom`, and `context.sortKeyTo`.
- No entry uses legacy top-level timing fields such as `date`, `validFrom`, `validTo`, or `canonTiming`.
- Every Lorecard has `retrieval.activation`, `retrieval.frequency`, and `retrieval.contextBoost`.
- Wide or global Lorecards use conservative `topic_or_entity` retrieval with low frequency unless there is a specific reason.
- Every used tag exists in `tags.json`.
- Every timeline anchor/window referenced by entries exists in `timeline.json`.
- Manifest `stats.entryCount`, `stats.categoryCounts`, `timelineAnchorCount`, and `timelineWindowCount` match loaded data.
- Pack Health reports `status: "good"` with zero errors, zero warnings, and zero suggestions.
- Human canon review has been completed or the deck remains marked as draft-quality.

## Validation Plan

Add JJK equivalents of the HP checks when the first implementation begins:

```powershell
node tools\scripts\test-jjk-loredeck-suite.mjs
```

Use the individual checks below when diagnosing a suite failure:

```powershell
node tools\scripts\test-jjk-family-coverage.mjs
node tools\scripts\test-jjk-canon-review-readiness.mjs
node tools\scripts\test-jjk-spoiler-boundaries.mjs
node tools\scripts\test-jjk-loredeck-health.mjs
node tools\scripts\test-jjk-loredeck-v3-conformance.mjs
node tools\scripts\test-jjk-reference-deck-conformance.mjs
```

Generate a review-facing coverage report with:

```powershell
node tools\scripts\report-jjk-loredeck-coverage.mjs
node tools\scripts\report-jjk-loredeck-coverage.mjs --json
```

The health test should mirror `tools/scripts/test-hp-loredeck-health.mjs`: load every `DEFAULT_JJK_LOREDECK_IDS` entry, assert zero errors, warnings, and suggestions, and assert `status === "good"`.

The reference conformance test should verify:

- Every JJK bundled pack is present in `content/loredecks/index.json`.
- Every JJK bundled pack is represented in `src/loredecks/loredeck-defaults.js`.
- `library.suggestedPath` is `["Jujutsu Kaisen", "Manga Main"]` for mainline decks.
- `familyOrder` matches this plan.
- Each manifest and index record agree on title, description, version, stats, assets, and tags.
- Every non-core mainline deck declares a soft dependency on `jjk-core`.
- Modulo, if implemented, uses a separate suggested path or continuity marker and is not silently mixed into the manga-main stack.
- `test-jjk-family-coverage.mjs` should lock the planned JJK deck list, chronological order, mainline shelf, Modulo shelf, and sequel-boundary dependencies.
- `test-jjk-canon-review-readiness.mjs` should verify draft-reference review markers, sourceInfo fields, confidence values, and human canon review notes across every JJK Lorecard.
- `test-jjk-spoiler-boundaries.mjs` should prevent Modulo-only tags, entities, source titles, and cast/species text from leaking into manga-main Lorecards, except for the explicit Shinjuku deck boundary card.

## Generation Workflow

1. Approve this family split and source boundary.
2. Build a source outline per deck with arc windows, reveal pivots, character status shifts, technique/domain introductions, and faction state changes.
3. Draft timeline anchors/windows for `jjk-core` first, then per-arc local timelines.
4. Draft `tags.json` and `entities.json` before writing entries.
5. Run a title pass per deck. Review titles before any full Lorecard JSON.
6. Draft Lorecards in small batches, keeping every card focused on a retrieval job.
7. Run Pack Health after each batch, not only at the end.
8. Register completed decks in `content/loredecks/index.json` and `src/loredecks/loredeck-defaults.js`.
9. Add JJK health/conformance tests.
10. Treat the family as Bundled Lorepack material only after clean Pack Health plus human canon review.

## Implementation Slice 1

Started with `jjk-core` under `content/loredecks/jjk-core/`.

Current scope:

- Core manifest, duplicate `manifest.json`, timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Eight draft-reference Lorecards covering cursed energy, innate techniques, Domain Expansion, Binding Vows, jujutsu society secrecy, Sukuna vessel Context, Gojo status Context, and death/injury spoiler gates.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- JJK-specific validation scripts under `tools/scripts/`.

Current validation:

```powershell
node tools\scripts\test-jjk-loredeck-suite.mjs
node tools\scripts\report-jjk-loredeck-coverage.mjs
node tools\scripts\test-jjk-family-coverage.mjs
node tools\scripts\test-jjk-canon-review-readiness.mjs
node tools\scripts\test-jjk-spoiler-boundaries.mjs
node tools\scripts\test-jjk-loredeck-health.mjs
node tools\scripts\test-jjk-loredeck-v3-conformance.mjs
node tools\scripts\test-jjk-reference-deck-conformance.mjs
node tools\scripts\test-hp-reference-deck-conformance.mjs
node tools\scripts\test-repository-layout.mjs
```

Generated cover/banner assets are intentionally deferred until the data shape is stable. This first slice is structurally clean but still draft fan reference data pending human canon review.

## Implementation Slice 2

Added `jjk-zero` under `content/loredecks/jjk-zero/`.

Current scope:

- Prequel manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Ten draft-reference Lorecards covering Yuta's early haunted status, Rika's cursed-spirit bond, Yuta training and classmate trust, Gojo's prequel mentor role, Geto's pre-mainline faction state, Night Parade climax pressure, and prequel aftermath guards.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` so core power-system assumptions stay reusable but not mandatory.

Current guardrails:

- `jjk-zero` uses `continuity:jjk-zero` and should avoid leaking later mainline outcomes.
- Mainline implications after the prequel should move into later arc decks unless needed only as bridge metadata.
- Generated cover/banner assets remain deferred.

## Implementation Slice 3

Added `jjk-origin-death-painting` under `content/loredecks/jjk-origin-death-painting/`.

Current scope:

- Mainline opening manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering Yuji becoming Sukuna's vessel, suspended execution, the early Tokyo first-year trio, detention center consequences, private-training secrecy, Junpei and Mahito, Kyoto Goodwill pressure, Hanami's attack, Black Flash, and Death Painting aftermath.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` for cursed energy, jujutsu society, Sukuna vessel, and spoiler-gate assumptions.

Current guardrails:

- Later Choso, Shibuya, Culling Game, Shinjuku, and post-series outcomes remain gated to later decks unless explicitly loaded.
- Death Painting aftermath can carry emotional consequences, but broader family reveals must not leak forward.
- Generated cover/banner assets remain deferred.

## Implementation Slice 4

Added `jjk-hidden-inventory-premature-death` under `content/loredecks/jjk-hidden-inventory-premature-death/`.

Current scope:

- Pre-mainline flashback manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering Gojo and Geto's student-era bond, the Star Plasma Vessel mission, Riko Amanai's agency and fate guard, Q and Time Vessel Association mission pressure, Toji's disruption, Gojo's reverse cursed technique awakening, sorcerer attrition, Haibara's death, Geto's spiral, and the Geto defection boundary.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` for cursed energy, jujutsu society, technique, and spoiler-gate assumptions.

Current guardrails:

- This deck explains pre-mainline causes without automatically revealing Jujutsu Kaisen 0, Shibuya, Culling Game, Shinjuku, Kenjaku, or later Tengen outcomes.
- Student-era Gojo/Geto state and post-defection Geto state are separated by timeline anchors.
- Generated cover/banner assets remain deferred.

## Implementation Slice 5

Added `jjk-shibuya-incident` under `content/loredecks/jjk-shibuya-incident/`.

Current scope:

- Shibuya manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering curtains and civilian containment, coordinated Gojo sealing pressure, Prison Realm state, Mechamaru contingency support, Toji's revived battlefield anomaly, station battle attrition, Sukuna's finger-flood control, Mahoraga devastation, Mahito's Idle Transfiguration pressure, Nanami/Nobara status guards, Kenjaku/Geto-body identity reveal, and immediate aftermath status quo break.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` for cursed energy, jujutsu society, curse, technique, and spoiler-gate assumptions.

Current guardrails:

- Post-Shibuya execution orders, Perfect Preparation, Culling Game, Gojo unsealing, Shinjuku, and final-arc outcomes remain gated to later decks.
- Shibuya status cards are spoiler guards, not complete post-incident biographies.
- Generated cover/banner assets remain deferred.

## Implementation Slice 6

Added `jjk-post-shibuya-preparation` under `content/loredecks/jjk-post-shibuya-preparation/`.

Current scope:

- Post-Shibuya and Perfect Preparation manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering Yuji's reinstated execution order, Yuta's return as executioner, Yuta's concealed support for Yuji, jujutsu society's punitive crisis state, Tengen's briefing, Culling Game rule setup, Tsumiki and Prison Realm urgency, preparation to enter the game, Maki's return to the Zenin clan, Mai's sacrifice, Zenin clan collapse, and future guards for colony/endgame leaks.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` for cursed energy, jujutsu society, Sukuna vessel, technique, and spoiler-gate assumptions.

Current guardrails:

- Culling Game colony battles, Higuruma, Hakari, Sendai, Angel details, Gojo unsealing, Sukuna vessel changes, Shinjuku, and final-arc outcomes remain gated to later decks.
- Perfect Preparation cards separate Maki's pre-sacrifice, post-sacrifice, and post-collapse states by timeline anchor.
- Generated cover/banner assets remain deferred.

## Implementation Slice 7

Added `jjk-culling-game-colonies` under `content/loredecks/jjk-culling-game-colonies/`.

Current scope:

- Culling Game Colonies manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering colony entry as an active rule field, points and added-rule survival math, the mixed participant pool, split-team communication limits, Yuji and Higuruma in Tokyo No. 1, point transfer, Megumi and Reggie, Sendai's multi-way deadlock, Yuta's Sendai resolution, Kashimo's ancient-player pressure, Hakari and Kashimo in Tokyo No. 2, and future guards for late convergence/Tsumiki spoilers.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` for cursed energy, jujutsu society, Sukuna vessel, technique, and spoiler-gate assumptions.

Current guardrails:

- Late Culling Game convergence, Sakurajima, Angel, Prison Realm resolution, Gojo unsealing, Shinjuku, and final-arc outcomes remain gated to later decks.
- Colony cards preserve split-team uncertainty and do not assume cross-colony omniscience.
- Generated cover/banner assets remain deferred.

## Implementation Slice 8

Added `jjk-culling-game-convergence` under `content/loredecks/jjk-culling-game-convergence/`.

Current scope:

- Late Culling Game Convergence manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering Maki's Sakurajima continuation, Maki's matured post-Zenin combat state, Angel and Hana as the Prison Realm route, military incursion, Yuki/Choso/Tengen defending against Kenjaku, Kenjaku gaining Tengen, Sukuna taking Megumi as vessel, Tsumiki/Yorozu reveal, Gojo unsealing, ally regrouping for Shinjuku, Gojo/Sukuna showdown setup, and future guards for Shinjuku/final outcome leaks.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` for cursed energy, jujutsu society, Sukuna vessel, technique, and spoiler-gate assumptions.

Current guardrails:

- Shinjuku battle sequence, Gojo/Sukuna result, Kenjaku's final fate, Sukuna's final resolution, epilogue states, and post-series material remain gated to the Shinjuku deck.
- Gojo's sealed/unsealed state, Tengen's defended/captured state, and Sukuna's vessel state are separated by timeline anchors.
- Generated cover/banner assets remain deferred.

## Implementation Slice 9

Added `jjk-shinjuku-showdown` under `content/loredecks/jjk-shinjuku-showdown/`.

Current scope:

- Shinjuku Showdown and Aftermath manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering the Gojo/Sukuna opening, domain and adaptation phase, Gojo's fall, Kashimo's post-Gojo entry, rotating allied plans, Higuruma and Yuji pressure, Yuta's backup/domain layer, Maki's ambush pressure, Yuji targeting Sukuna/Megumi separation, Megumi rescue stakes, Sukuna's defeat, and the chapter 271 epilogue-state close.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js`.
- Soft dependency on `jjk-core` for cursed energy, jujutsu society, Sukuna vessel, technique, domain, and spoiler-gate assumptions.

Current guardrails:

- Jujutsu Kaisen Modulo remains an optional sequel/spinoff deck, not part of the default manga-main stack.
- Anime-only changes, guidebook-only material, games, and light novels remain out of scope for the manga-primary bundled family unless added as explicit overlay decks.
- Generated cover/banner assets remain deferred.
- These cards are draft-reference scaffolds and still require human canon review before reference release.

## Implementation Slice 10

Added `jjk-modulo` under `content/loredecks/jjk-modulo/`.

Current scope:

- Modulo manifest, duplicate `manifest.json`, local timeline, tags, entities, resolver, taxonomy, gate types, and scoring registries.
- Twelve draft-reference Lorecards covering the Modulo future-continuity boundary, future jujutsu world state, Simurian arrival, Maru's diplomatic mission, Yuka and Tsurugi Okkotsu as future leads, Okkotsu legacy spoiler boundaries, alien jujutsu rules, coexistence-test escalation, Modulo conflict boundaries, final-resolution spoiler guards, epilogue-state separation, and future-cast leakage guards.
- Registration in `content/loredecks/index.json`.
- Default library/context wiring in `src/loredecks/loredeck-defaults.js` under `Jujutsu Kaisen / Modulo`, with family order after the manga-main stack.
- Soft dependencies on `jjk-core` for cursed energy and jujutsu society assumptions, and `jjk-shinjuku-showdown` for sequel-boundary guardrails.

Current guardrails:

- Modulo remains a separate sequel/spinoff continuity. It should not leak future cast, Simurian premise, Okkotsu legacy, or final-resolution details into manga-main scenes unless explicitly loaded.
- Anime-only changes, guidebook-only material, games, and light novels remain separate overlay candidates.
- Generated cover/banner assets remain deferred.
- These cards are draft-reference scaffolds and still require human canon review before reference release.

## Implementation Slice 11

Added `tools/scripts/test-jjk-family-coverage.mjs`.

Current scope:

- Locks the planned JJK bundled family list in order: core, Zero, manga-main arc decks through Shinjuku, then Modulo.
- Verifies mainline decks remain under `Jujutsu Kaisen / Manga Main` while `jjk-modulo` remains under `Jujutsu Kaisen / Modulo`.
- Verifies family order, anchor-window Context defaults, draft-reference health status, `jjk-core` soft dependencies, and Modulo's soft dependency on `jjk-shinjuku-showdown`.
- Verifies Modulo keeps its VIZ chapter-list source-boundary URL and does not carry the manga-main continuity tag.

Current guardrails:

- Future JJK overlays or denser scene splits must update the family coverage contract intentionally rather than appearing as unreviewed bundled drift.
- The test is a structural coverage contract only; it does not replace human canon review.

## Implementation Slice 12

Added `tools/scripts/test-jjk-loredeck-suite.mjs`.

Current scope:

- Provides one offline validation command for the JJK Loredeck family.
- Runs the JJK family coverage contract, Pack Health check, v3 conformance check, JJK reference conformance check, broad bundled reference conformance check, and repository layout contract in order.
- Adds the suite script to the repository layout contract's current-path conformance script list.

Current guardrails:

- The suite is the default command for JJK-family regression checks.
- Individual scripts remain listed for diagnosing a specific failure.

## Implementation Slice 13

Added `tools/scripts/test-jjk-canon-review-readiness.mjs`.

Current scope:

- Verifies every JJK bundled manifest stays marked `quality:draft-reference` until human canon review is complete.
- Verifies manifest license and health notes do not imply canon approval just because structural health passes.
- Verifies every JJK Lorecard has review-facing `sourceInfo.work`, `sourceInfo.sourceType`, `sourceInfo.title`, `sourceInfo.chapterRange`, numeric confidence, and source notes that preserve the human canon review requirement.
- Verifies every JJK Lorecard keeps its `extensions.sagaJjkScaffold.targetPackId` and scaffold status for audit traceability.
- Adds the readiness check to `tools/scripts/test-jjk-loredeck-suite.mjs` and the repository layout contract.

Current guardrails:

- Pack Health passing remains a structural bar, not canon approval.
- Human review can now rely on the deterministic readiness check to catch missing source metadata before reading the cards.

## Implementation Slice 14

Added `tools/scripts/test-jjk-spoiler-boundaries.mjs`.

Current scope:

- Verifies manga-main JJK Lorecards do not carry Modulo-only tags, entities, or `sourceInfo.work`.
- Verifies manga-main JJK Lorecard content does not leak standalone Modulo cast/species/premise terms.
- Allows the single Shinjuku epilogue boundary card to mention Modulo only as an explicit out-of-scope sequel/spinoff guard.
- Verifies the Modulo manifest remains under `Jujutsu Kaisen / Modulo` with `continuityId: "jjk-modulo"` and without the manga-main manifest tag.
- Adds the spoiler-boundary check to `tools/scripts/test-jjk-loredeck-suite.mjs` and the repository layout contract.

Current guardrails:

- Modulo can be referenced by manga-main only as a boundary warning, not as content, cast, source, tag, or entity data.
- Future sequel/spinoff decks should add their own boundary exceptions deliberately rather than weakening the manga-main checks.

## Implementation Slice 15

Added `tools/scripts/report-jjk-loredeck-coverage.mjs`.

Current scope:

- Generates a human-readable or `--json` review handoff report for the bundled JJK family.
- Summarizes deck count, Lorecard count, timeline anchor/window totals, library paths, continuity IDs, review/health status, category mix, reveal policy mix, file count, and source-confidence range per deck.
- Adds the report script to the repository layout contract's current-path script list.

Current guardrails:

- The report is for reviewer visibility, not a replacement for validation.
- `tools/scripts/test-jjk-loredeck-suite.mjs` remains the pass/fail command.

## Open Decisions

- Whether anime adaptation overlays are in scope before the manga-primary family is clean.
- Whether generated cover/banner assets should be created now or deferred until the data family passes Pack Health.
- Whether Shibuya and Shinjuku need scene-dense sub-splits after human review, if one deck becomes too heavy for release-quality coverage.
