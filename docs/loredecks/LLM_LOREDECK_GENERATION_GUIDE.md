# LLM Loredeck Generation Guide

This guide is the handoff document for an LLM that needs to understand Saga well enough to help create Loredecks and Lorecards.

It is not the schema reference and it is not a replacement for Deck Health. Use this guide to understand the task, then use [SAGA_LOREDECK_SCHEMA.md](SAGA_LOREDECK_SCHEMA.md) for exact schemas and [LOREDECK_AND_LORECARD_CREATION_GUIDE.md](LOREDECK_AND_LORECARD_CREATION_GUIDE.md) for authoring principles.

Do not include the full Harry Potter reference Loredecks in a default LLM handoff. They are useful examples when structure or style needs comparison, but they are large and should not be the first context payload.

## Minimum File Bundle

Give another LLM these files first:

- `docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md`
- `docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md`
- `docs/loredecks/SAGA_LOREDECK_SCHEMA.md`
- `docs/development/SAGA_TERMINOLOGY.md`

That bundle explains Saga's public terms, the authoring target, the schema contract location, the generation workflow, and the quality bar.

## Implementation-Backed Bundle

If the LLM is expected to match Saga's current Creator workflow or produce data that fits the app, also include:

- `loredeck-assistant.js`: source of the current staged Creator prompt builders and output expectations.
- `loredeck-loader.js`: source of runtime loading, validation, Context, tag, and Deck Health behavior.
- `loredeck-creator-projects.js`: source of Creator stage state, review gates, and readiness concepts.
- `docs/development/LOREDECK_CREATOR_BATCHING_ARCHITECTURE.md`: design notes for staged generation, micro-batching, retry, partial success, and review boundaries.

Use these as implementation evidence. Do not ask the LLM to infer current behavior only from high-level docs when implementation files are available.

## Optional Context Bundle

If the LLM needs product direction, architecture rationale, or cross-system context, add:

- `docs/development/SAGA_PREPRODUCTION.md`
- `docs/development/SAGA_ALPHA_RELEASE_SYSTEMS.md`
- `docs/development/SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md`
- `docs/development/SAGA_CORE_INTEGRATION_TESTING.md`

These are broader planning documents. They can help explain why Saga emphasizes Context, active stacks, review, and deterministic health checks, but they should not override the schema reference or current implementation files.

## Harry Potter References

The bundled Harry Potter Loredecks are the current reference model for a large fandom deck family. Use them when the LLM needs concrete examples of:

- Splitting a large fandom into core plus era/year decks.
- Dense timeline registries.
- Context-gated Lorecards.
- Tag registry hygiene.
- Deck Health clean reference data.
- Manifest, index, and runtime-default consistency.

Do not include the full HP deck files in the default LLM bundle. Instead, provide only the specific deck files or snippets needed for the immediate task.

## What The LLM Must Understand

Saga is a fandom lore system for long-form roleplay and fanfiction. It helps a model use the right lore at the right moment without flooding the prompt or leaking future canon.

A Loredeck is a loadable data package. It should be portable, inspectable, editable, stackable, and validatable. It contains a manifest, Lorecard entry files, registries, and passive display assets.

A Lorecard is one reviewable unit of lore. It should contain a focused fact, state, constraint, reveal, relationship, rule, event, or knowledge boundary. It should be written for runtime retrieval and prompt injection, not as general prose documentation.

Context is the story-position system that decides whether a Lorecard is eligible. Context may be based on dates, arcs, chapters, episodes, quests, routes, seasons, phases, or other fandom-appropriate coordinates.

Deck Health is the release gate. A deck that parses but has health warnings is draft-quality, not reference-quality.

Pending Review is the safety layer. Model-generated content should remain reviewable before it affects a deck or runtime injection.

## Generation Mindset

The LLM should optimize for useful story behavior, not encyclopedic completeness.

Good generated Loredeck content:

- Helps a roleplay or fanfiction scene stay canon-aware.
- States what is true at a specific story point.
- Marks who knows, believes, hides, wants, fears, reveals, or misunderstands something when that matters.
- Protects secrets and future canon until the correct Context.
- Uses specific scopes and tags so retrieval can be precise.
- Produces compact model-facing injection text.
- Separates broad world rules from narrow event or state changes.
- Preserves source boundary, continuity, adaptation, route, and AU/fanon status.

Poor generated Loredeck content:

- Rewrites wiki summaries as Lorecards.
- Cramps whole character biographies into one card.
- Emits future spoilers as globally valid facts.
- Invents schema fields or registry shapes.
- Treats generated output as accepted canon.
- Creates many low-value tags, anchors, or cards just to appear comprehensive.
- Mixes incompatible continuities without declaring that choice.

## Staged Workflow

Saga's Creator is intentionally staged. A useful LLM should follow the same order even when working outside the app.

1. Scope Brief
   Define the fandom, source range, continuity, adaptation, rough granularity, assumptions, and risks. Do not generate Lorecards yet.

2. Story Outline And Context Plan
   Identify major beats, phases, reveals, windows, and story-position milestones. Do not generate full cards yet.

3. Title Pass
   Generate reviewable future Lorecard titles for one approved batch at a time. Titles should imply scene utility and retrieval value. Do not generate facts or injection text yet.

4. Timeline And Tag Planning
   Propose timeline anchors, timeline windows, and tag definitions that support the approved titles. Prefer durable high-value waypoints and useful namespaced tags over noisy coverage.

5. Lorecard Drafting
   Generate small batches of Lorecard proposals from accepted titles and accepted planning metadata. Use only schema-supported fields from the schema reference. Keep each card compact and Context-aware.

6. Review And Acceptance
   Treat generated cards, timeline records, and tag records as proposals until reviewed. Revise, accept, or reject them before they become deck content.

7. Deck Health
   Run health and conformance checks. Fix every error, warning, and suggestion before treating the deck as reference-quality.

## Output Rules For LLMs

When asked to emit Saga data, the LLM should:

- Read the schema reference first.
- Emit valid JSON only when JSON is requested.
- Avoid markdown around machine-ingested JSON.
- Keep batches small.
- Preserve stable IDs across revisions.
- Use existing accepted timeline anchors, windows, and tags instead of inventing replacements.
- Ask clarifying questions when the source range, continuity, or accepted planning metadata is insufficient.
- State assumptions and risks separately from deck data.
- Prefer fewer high-value cards over many thin cards.
- Avoid using hidden chain-of-thought or long visible reasoning in the final JSON payload.

If the LLM cannot see the schema reference, it should not fabricate a final Loredeck JSON structure. It can still draft a scope brief, outline, title list, or plain-language plan.

## Granularity Guidance

Use granularity to control density:

- Compact: only major constraints, critical secrets, durable world rules, and high-impact state changes.
- Focused: practical arc-level coverage for long-form play, including relationships, local pressure, obligations, powers, and important timing.
- Dense: many scene-relevant anchors, status changes, relationships, and consequences across a broad scope.
- Scene-dense: intensive coverage for a short span where moment-level Context matters.

The LLM should derive likely card count from scope, source density, and granularity. It should not ask users for an arbitrary number of Lorecards unless the user has a hard limit.

## Context Planning Guidance

A good Context plan gives users a useful map for choosing where their story is.

The LLM should propose:

- Major start/end boundaries.
- Reveals and irreversible state changes.
- Before/after pivots.
- Relationship, faction, ability, or knowledge-state shifts.
- Locations or arcs that strongly affect scene behavior.
- Windows broad enough for user selection but narrow enough to prevent spoiler leakage.

The LLM should avoid:

- A timeline anchor for every minor fact.
- Date-only planning for fandoms where arcs, chapters, episodes, or route stages are more natural.
- Context windows that overlap in confusing ways without a clear reason.
- Lorecards whose eligibility cannot be mapped to the planned Context.

## Tag Planning Guidance

Tags should support retrieval, filtering, and health checks. They are not decoration.

The LLM should propose tags for recurring retrieval concepts:

- Characters and aliases.
- Factions, teams, houses, crews, families, or organizations.
- Places and regions.
- Arcs, seasons, quests, routes, or eras.
- Powers, items, secrets, relationships, status changes, or major topics.

The LLM should keep tags namespaced, stable, and reusable. It should avoid tag spam and should not leave used tags undefined in reference-quality decks.

## Lorecard Drafting Guidance

Each Lorecard should have one main job.

Before drafting a card, the LLM should know:

- What story point or Context window makes it eligible.
- Which entities or topics should retrieve it.
- Whether it is safe, secret, future, public, hidden, rumored, or contested.
- What the model should do differently when the card is injected.
- Whether the same fact belongs in a broader core deck or a narrower era deck.

The card's human-facing fact should be clear enough for review. The model-facing injection text should be concise enough to use directly in a prompt.

## Review Checklist

Before calling a generated deck ready, check:

- The scope is narrow enough to be useful.
- The continuity and source boundary are explicit.
- The timeline or story-position model matches the fandom.
- The tags are reusable and defined.
- The Lorecards are granular and not wiki summaries.
- Secrets and spoilers are gated.
- Broad/global cards use conservative retrieval behavior according to the schema reference.
- Generated material is marked or routed for review.
- Deck Health has no errors, warnings, or suggestions.
- The deck has equivalent conformance tests before becoming a reference model.

## Suggested Prompt For Another LLM

Use this prompt when handing Saga Loredeck work to another model:

```text
You are helping create Saga Loredecks and Lorecards.

Read the provided Saga documentation before producing deck data. Use LLM_LOREDECK_GENERATION_GUIDE.md for the workflow, LOREDECK_AND_LORECARD_CREATION_GUIDE.md for authoring principles, SAGA_LOREDECK_SCHEMA.md for exact schemas, and SAGA_TERMINOLOGY.md for public terms.

Do not invent schema fields. Do not generate full Lorecards before scope, outline, title, timeline, and tag planning are approved. Do not write wiki summaries. Optimize for Context-aware roleplay/fanfiction utility, spoiler safety, precise retrieval, reviewability, and clean Deck Health.

If asked for JSON and the schema reference is available, return JSON only. If required source range or planning metadata is missing, ask concise clarifying questions instead of fabricating final deck data.
```

## Best Current Answer To "What Files Should I Provide?"

For a new LLM starting from scratch, provide:

1. `docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md`
2. `docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md`
3. `docs/loredecks/SAGA_LOREDECK_SCHEMA.md`
4. `docs/development/SAGA_TERMINOLOGY.md`

For an LLM expected to match the app's current Creator behavior, add:

5. `loredeck-assistant.js`
6. `loredeck-loader.js`
7. `loredeck-creator-projects.js`
8. `docs/development/LOREDECK_CREATOR_BATCHING_ARCHITECTURE.md`

For broader product context, add:

9. `docs/development/SAGA_PREPRODUCTION.md`
10. `docs/development/SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md`
11. `docs/development/SAGA_ALPHA_RELEASE_SYSTEMS.md`
12. `docs/development/SAGA_CORE_INTEGRATION_TESTING.md`

Only add Harry Potter reference deck files when the LLM needs concrete examples for a specific structure or quality comparison.
