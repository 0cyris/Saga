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

- Namespaced `namespace:value` ids (`fandom:`, `character:`, `faction:`, `place:`, `arc:`, `era:`, `power:`, `secret:`...), lowercase-kebab values.
- Every tag used by any entry or anchor MUST be defined in `tags.json` with a `label` (undefined tags are health issues). No tag spam; tags exist for retrieval, filtering, and health — not decoration.
- Keep one shared tag vocabulary across a deck family; the core deck's registry is the reference.

## Timeline registry

- `timeline.json`: `schemaVersion`, `timelineMode` (e.g. `story_anchor`), `defaultContextType`, `anchors[]`, `windows[]`.
- Anchors: stable `id` (`<canon>.<era>.<slug>`), `label`, `contextType`, monotonically ordered `sortKey`, `aliases` covering how a user would phrase the position. Optional `dateRange`, arc/era fields, `tags`.
- Prefer durable, high-value waypoints (starts/ends, reveals, irreversible changes, before/after pivots) over an anchor per minor fact. Windows should be broad enough to select, narrow enough to keep spoilers gated.

## Deck manifest (`loredeck.json`)

Skeleton comes from `init`. You must fill: `description`, `continuity` (`continuityId`, `canonTier`, `adaptation`, `sourceBoundary`), and keep `title`/`version` meaningful. `files[]` and `stats` are machine-managed — run `stats --write`; never hand-maintain them. Entry files live in category subfolders (`characters/`, `events/`, `rules/`, `knowledge/`...); root-level JSON is manifest + registries only.

## Quality bar

- Fewer high-value cards beat many thin cards. Skip cards that only restate obvious fandom knowledge unless they add a retrieval boundary, spoiler guard, or constraint.
- Stay inside the declared continuity/source boundary; mark AU/crossover/fanon explicitly via `canon`/`canonStatus` and the manifest continuity block.
- Strict-clean Pack Health (zero errors, warnings, suggestions) is the release bar — the same bar the bundled reference decks meet.
