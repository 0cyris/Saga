# Authoring Rules (condensed)

The full contract is `docs/loredecks/SAGA_LOREDECK_SCHEMA.md`; authoring intent is `docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md`. Read the schema doc before emitting deck JSON. These are the rules that matter most in practice, including ones the health engine enforces.

## Card anatomy

One card = one job: a fact, state, constraint, reveal, relationship, rule, event, or knowledge boundary. Never a wiki paragraph, never a whole biography.

- `content.fact`: the human-reviewable statement of what is true.
- `content.injection`: compact, directive, model-facing text usable in a prompt verbatim. No hedging, no author notes.
- `content.constraints[]` / `content.antiLore[]`: optional do/don't lists for the model.
- Ask before drafting: what story point makes it eligible, what should retrieve it, is it safe/secret/future, and what should the model do differently when it fires?

## Required and expected entry fields (schema v3)

Required: `id`, `title`, `category`, `priority`, `content.fact`, `content.injection`, `schemaVersion: 3`.
Expected on quality decks: `kind`/`gateType`, `relevance`, `lorePurpose`, `specificityScore`, `injectableByDefault`, `canon`/`canonStatus`, `truthStatus`, `revealPolicy`, `status`, `context`, `scope`, `retrieval`, `tags`, `sourceInfo`.

- `id`: stable, namespaced, lowercase (`<canon>.<topic>.<slug>`), unique across the whole deck. Never renumber ids between revisions.
- `category`: one of `character|event|location|item|spell|faction|relationship|rule|timeline|knowledge|secret|other`.
- `sourceInfo.evidenceRefs`: array of accepted evidence keys (`<scope>/<recordId>`) — required by this workflow for every card.
- Do NOT use legacy entry-local `date`/`validFrom`/`validTo`/`canonTiming`; calendar dates live only in `timeline.json`.

## Context gating

- `context.scope`: `window` for era/arc-bounded cards; `global` only for durable world rules.
- **Every card needs a full `context` block, including global cards.** `global` scope does NOT mean "omit the context fields" — schema v3 health requires `sortKeyFrom`, `sortKeyTo`, `precision`, and `label` on *every* entry (health errors `schema_v3_missing_context_sort_keys` / `_precision` / `_label` fire otherwise). For a global card, set the span to cover the whole timeline (`sortKeyFrom` = your lowest anchor sortKey, `sortKeyTo` = your highest), a `precision` like `whole_story`, a `label` like `"Whole story"`, and `windowKind: "series"`. It stays always-eligible but is topic/entity-gated (see Retrieval).
- Windows reference timeline anchors: `validFromAnchor`/`validToAnchor` MUST exist in `timeline.json` (broken references are health errors), plus `sortKeyFrom`/`sortKeyTo` matching those anchors' sortKeys.
- Secrets, deaths, betrayals, identities, prophecies, future relationships: gate them so they cannot retrieve before the story point where they become valid. When unsure, gate tighter.

## Retrieval (health-enforced)

**Wide entries** — `context.scope: "global"`, `windowKind` of `series`/`wide`, or a sortKey span ≥ 365 — MUST use `retrieval.activation: "topic_or_entity"` (with conservative `frequency`/`contextBoost`, typically `low`). Broad window + aggressive activation is a health warning (`schema_v3_wide_lore_retrieval`). Narrow, scene-level cards may use `context_or_topic` with higher frequency/boost.

`retrieval.triggers` (`charactersAny`, `locationsAny`, `topicsAny`, ...) should mirror `scope` so retrieval is precise.

## Tags

- Namespaced `namespace:value` ids (`fandom:`, `character:`, `faction:`, `place:`, `arc:`, `era:`, `power:`, `secret:`, `book:`/`episode:`/`issue:` for the canon's source unit...), lowercase-kebab values.
- Every tag used by any entry or anchor MUST be defined in `tags.json` with a `label` (undefined tags are health issues). No tag spam; tags exist for retrieval, filtering, and health — not decoration.
- Keep one shared tag vocabulary across a deck family; the core deck's registry is the reference.

## Timeline registry

- `timeline.json`: `schemaVersion`, `timelineMode` (e.g. `story_anchor`), `defaultContextType`, `anchors[]`, `windows[]`.
- Anchors: stable `id` (`<canon>.<era>.<slug>`), `label`, `contextType`, monotonically ordered `sortKey`, `aliases` covering how a user would phrase the position. Optional `dateRange`, arc/era fields, `tags`.
- Prefer durable, high-value waypoints (starts/ends, reveals, irreversible changes, before/after pivots) over an anchor per minor fact. Windows should be broad enough to select, narrow enough to keep spoilers gated.
- **Multi-axis canons can use `timelineMode: "hybrid"` plus an `axes[]` array.** The HP reference deck's `timeline.json` declares axes for `calendar`, `book`, `schoolYear`, and `arc` (each `{id, type, label}`), then tags each anchor with the matching fields (`book`, `schoolYear`, `arc`) alongside `sortKey`. Use this when a canon has more than one simultaneous coordinate system a user might phrase Context in (calendar date *and* book/season *and* named arc) — a single linear `sortKey` axis still drives retrieval, the extra axes just make anchors addressable by whichever coordinate the story uses.

## Deck manifest (`loredeck.json`)

Skeleton comes from `init`. You must fill: `description`, `continuity` (`continuityId`, `canonTier`, `adaptation`, `sourceBoundary`), and keep `title`/`version` meaningful. `files[]` and `stats` are machine-managed — run `stats --write`; never hand-maintain them. Root-level JSON is manifest + registries only.

**Name entry files by topic, not by generation batch.** The schema doesn't care how many files exist or what they're called — `stats --write` will happily accept `entries/batch-1.json`, `entries/batch-2.json`, etc. But generic batch-numbered files are a maintenance dead end: nobody can tell what's inside one without opening it, diffs are noisy, and later edits have nowhere obvious to go. Use category subfolders instead — `characters/`, `events/`, `rules/`, `knowledge/`, `secrets/`, `relationships/`, `locations/`, `factions/` — mirroring the bundled reference decks (`content/loredecks/hp-core`: `ages/`, `characters/`, `knowledge_gates/`, `places/`, `spell_gates/`, etc.). If a category grows large, split it further by sub-topic (`characters/adult_baselines.json`, `characters/core_students.json`), never by arbitrary sequence number.

**Batch-numbered filenames aren't the only version of this mistake — watch for disguised batches too.** A filename that describes *when or how a card was added* rather than *what it's about* is the same anti-pattern wearing a topic costume. The HP reference deck itself has this: `ages/core_character_ages.json` (7 entries) sits next to `ages/expanded_character_ages.json` (4 more characters, same topic), and `knowledge_gates/` fragments into five files — `core_knowledge_gates.json`, `added_contextual_gates.json`, `expanded_knowledge_gates.json`, `consolidated_story_gates.json`, `relevance_timing_guards.json` — split only by authoring pass, not by any real sub-topic. Don't copy this. When you're revising or extending an already-drafted deck, add new cards to the existing topic file (or, if it's genuinely a new sub-topic, give the new file a topic name, not an `added_`/`expanded_`/`consolidated_`/`additional_`/`more_` prefix).

**Isolate gated reveals in their own file.** The HP reference deck keeps every character-death reveal in one dedicated file (`characters/death_states.json`) rather than scattering them across general character files. This makes a spoiler audit trivial — one file to check, not a tag-grep across the whole deck. Do the same for any category with a meaningful number of `revealPolicy: private` / gated-secret cards: give them a sibling file (`characters/death_states.json`, `secrets/major_reveals.json`) instead of mixing them into the baseline-facts file for that category.

**`knowledge_gates/` and `knowledge/` are different things.** `knowledge/` holds static facts (durable, non-time-sensitive information). `knowledge_gates/` (or a `knowledge_gate` `kind`/`gateType`) models *who knows what, when* — reveal machinery tied to a story point, not the fact itself. Keep them in separate files even when they're about the same topic, so it's clear at a glance which cards are "this is true" versus "this becomes knowable/revealed here."

**Family decks get a nested Library path.** `init --size family` gives the core deck `library.suggestedPath: [title, "Core"]` and each era deck `[title, deckId]`, mirroring the bundled reference decks' two-level convention (`['Harry Potter', 'Golden Trio']`, `['Star Wars', 'Legends']`). Hand-edit the second segment to something more readable than the raw deck id if you want (e.g. `"Golden Trio"` instead of `"hp-year-1-philosophers-stone"`) — the generated value is a deterministic placeholder, not a final label.

**Manifest `tags[]` (not the `tags.json` registry) signals deck maturity.** Every bundled reference deck carries a top-level `tags[]` array on `loredeck.json`/`manifest.json` with a quality marker: `init` seeds new decks with `quality:draft-reference` (matching JJK's still-in-progress decks), and family decks additionally get `structure:split-loredeck`. Upgrade `quality:draft-reference` to `quality:human-vetted` plus `quality:relevance-curated` at Stage 7 (Package), once every gate in the stage loop has been approved and `promote` is strict-clean — that's the same bar the HP family meets. Don't upgrade early; the tag is a claim that a human has actually reviewed the whole deck, not that it validated.

**`stats --write` and `conformance` also track timeline shape.** `manifest.stats` includes `timelineAnchorCount`/`timelineWindowCount` alongside `entryCount`/`categoryCounts`, and `conformance` cross-checks all four against both a raw file recount *and* the live Pack Health engine's summary — catching manifest drift that a naive recount alone might miss. Always run `stats --write` after editing `timeline.json`, not just after editing entry files.

## Quality bar

- Fewer high-value cards beat many thin cards. Skip cards that only restate obvious fandom knowledge unless they add a retrieval boundary, spoiler guard, or constraint.
- Stay inside the declared continuity/source boundary; mark AU/crossover/fanon explicitly via `canon`/`canonStatus` and the manifest continuity block.
- Strict-clean Pack Health (zero errors, warnings, suggestions) is the release bar — the same bar the bundled reference decks meet.
