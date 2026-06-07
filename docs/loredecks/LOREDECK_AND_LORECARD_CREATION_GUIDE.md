# Loredeck And Lorecard Creation

This guide explains how to think about Loredecks and Lorecards when creating reference-quality Saga content. It is written for human authors and for LLMs assisting with deck creation.

The exact schemas already exist and are the source of truth for field names, allowed values, required metadata, registry shapes, and health report details. Do not infer schema details from this guide. Use this guide for intent and workflow, then reference [SAGA_LOREDECK_SCHEMA.md](SAGA_LOREDECK_SCHEMA.md) for the detailed schema contract.

## What A Loredeck Is

A Loredeck is a portable, data-only package of fandom or story-setting knowledge. It can represent canon, alternate-universe facts, crossover material, original setting lore, scenario rules, or user-authored additions.

Saga treats a Loredeck as a package that can be loaded, displayed, stacked with other decks, validated, edited, exported, duplicated, and used during active writing. A deck should not contain executable code. It should consist of JSON data and passive display assets.

The main job of a Loredeck is not to summarize a fandom. Its job is to provide reliable, scoped facts and constraints that Saga can retrieve at the correct point in a story.

## What A Lorecard Is

A Lorecard is one reviewable unit of lore inside a Loredeck. It should carry one meaningful fact, state, constraint, reveal, relationship, location state, ability rule, timeline event, or knowledge boundary.

Good Lorecards are small enough to retrieve precisely and specific enough to help a model write correctly. They should make clear when the information is relevant, what entities or topics should retrieve it, and what should not leak too early.

Avoid treating a Lorecard as a wiki paragraph. If one entry tries to cover a whole character, arc, or faction, it usually needs to be split into smaller cards with clearer boundaries.

## How Saga Uses Loredecks

Saga uses Loredecks across several systems:

- Loredeck Library: stores, organizes, duplicates, imports, exports, and inspects decks.
- Active Stack: determines which decks are loaded for the current writing session and how their priority is ordered.
- Context: tracks where the story currently is inside each loaded deck's continuity, arc, route, season, year, quest, or other story coordinate.
- Retrieval: chooses Lorecards that match the current Context, scope, stack priority, relevance, pin/mute state, and search signals.
- Injection: turns selected Lorecards into prompt material for the model.
- Deck Health: validates that a deck is technically reliable enough to load, share, stack, or use as a reference model.
- Pending Review: keeps generated or assisted changes reviewable before they become accepted deck content.
- Loredeck Creator: helps draft and revise decks, while still routing important changes through review.

For an authoring LLM, this means a Loredeck should be written as runtime data, not prose documentation. Every card should be designed for retrieval, gating, and prompt use.

## Reference Model

The bundled Harry Potter Golden Trio deck family is the current reference model for future Saga Loredecks. It is split into a reusable core deck plus year and post-war decks so a large fandom can be loaded by story boundary instead of as one monolithic lore dump.

Use the Harry Potter decks as examples for:

- Splitting a large fandom into a deck family.
- Separating reusable world rules from era-specific facts.
- Writing Context-aware Lorecards.
- Keeping future canon and secret knowledge gated until the right story point.
- Maintaining timelines, tags, and manifests that pass Deck Health cleanly.
- Treating Deck Health as a release gate, not a rough suggestion.

The reference model should stay at full Deck Health before new deck families are modeled after it.

## Authoring Principles

Define the deck boundary before writing entries. A deck boundary may be a fandom, continuity, adaptation, era, arc, season, book, route, campaign, scenario, or original setting slice.

Decide whether the deck stands alone or belongs to a family. Large fandoms usually need a reusable core deck plus narrower era, arc, or source-range decks.

Prefer concrete runtime facts over encyclopedic summaries. A card should help answer what is true now, who knows it, what it affects, and whether it is safe to reveal.

Make time and story position explicit. If exact dates do not fit the fandom, use arcs, chapters, episodes, quests, routes, phases, or other sortable story coordinates.

Keep spoilers and secret knowledge gated. Deaths, betrayals, hidden identities, powers, prophecies, transformations, and future relationships should not retrieve before the story point where they become valid.

Use tags and scope consistently. Tags help filtering, search, and health checks. Scope helps retrieval choose relevant cards without flooding the prompt.

Write model-facing text deliberately. A Lorecard's prompt material should be concise, directive, and usable during generation. It should not include hedging, author notes, or unrelated context.

Preserve provenance and source boundaries. A deck should make clear what continuity or adaptation it covers and should not silently blend incompatible versions unless it is intentionally AU, crossover, or fanon.

## Guidance For LLM Authors

When an LLM is helping create or revise a Loredeck, it should follow these rules:

- Read this guide first to understand the intent of Saga Loredecks.
- Read the schema reference before emitting JSON.
- Inspect the Harry Potter reference decks before choosing structure for a new fandom.
- Do not invent field names, registry formats, or health report structures.
- Do not copy every fact into one large card.
- Do not write cards that only remind the model of obvious fandom knowledge unless the card adds a retrieval boundary, spoiler guard, local state, or Saga-specific constraint.
- Keep cards bounded to the deck's declared continuity and source range.
- Mark uncertain or generated material for review instead of presenting it as human-vetted canon.
- Route generated additions through Pending Review when working inside Saga workflows.
- After changes, run the relevant Deck Health and conformance checks.

The authoring target is not "a lot of lore." The target is a clean, Context-aware deck that retrieves the right information at the right time and stays quiet when it should.

## Creation Workflow

Use this workflow for new reference-quality Loredecks:

1. Define the deck boundary and source range.
2. Decide whether the deck is standalone or part of a family.
3. Choose the timeline, arc, route, or story-coordinate model before writing most cards.
4. Create or update the manifest according to the schema reference.
5. Create registries for timeline and tags when the deck needs them.
6. Draft Lorecards in focused topic folders.
7. Keep cards granular, retrieval-aware, and Context-aware.
8. Add passive display assets if the deck should appear polished in the Library.
9. Run Deck Health and fix every issue before sharing or using the deck as a model.
10. For bundled decks, verify the deck is registered, indexed, and synchronized with runtime defaults.

If the deck is generated or assisted by a model, add an explicit review pass after drafting. Generated content should not become reference material simply because it parses.

## Deck Health Release Bar

Deck Health is the practical release gate for Loredecks. A deck is reference-ready only when it has no Deck Health errors, warnings, or suggestions under the current health system.

Clean health means the deck is technically reliable. It does not prove the lore is canonically perfect, but it does prove Saga can load and reason over the package without known structural issues.

Do not treat a deck with warnings or suggestions as a reference model. Those states are acceptable during drafting, but reference decks should be clean before future decks are based on them.

## Validation Commands

The current Harry Potter reference checks are:

```powershell
node scripts\test-hp-loredeck-health.mjs
node scripts\test-hp-loredeck-v3-conformance.mjs
node scripts\test-hp-reference-deck-conformance.mjs
```

For Context-sensitive work, also run:

```powershell
node scripts\test-context-hp-phrase-fixtures.mjs
node scripts\test-context-current-contract.mjs
```

Future deck families should get equivalent health, conformance, and Context fixture checks before they are treated as reference models.

## Documentation Map

- [SAGA_LOREDECK_SCHEMA.md](SAGA_LOREDECK_SCHEMA.md): detailed Loredeck, Lorecard, registry, bundle, and Deck Health schema contract.
- [../DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md): top-level documentation index.
- [../development](../development): development notes and planning documents that have not yet been rewritten as release-facing docs.

Future Loredeck schema documents should live in this folder so authors do not have to search through development notes to find the contract.
