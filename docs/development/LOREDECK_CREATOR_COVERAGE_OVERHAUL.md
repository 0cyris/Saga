# Loredeck Creator Coverage Overhaul

Status: Development started. Slice 1 adds the adaptive coverage plan data path, Creator UI review card, and advisory readiness warnings. Slice 2 adds targeted title generation and user acknowledgement controls for missing/thin coverage rows. Slice 3 carries coverage metadata through planning and Lorecard drafting, with provisional evidence counts for drafts and Pending Review. Slice 4 adds finalization acknowledgement gating and finalized Custom Lorepack provenance for intentionally light coverage. Slice 5 adds focused readiness-card and source-contract regression coverage for the finalization acknowledgement path. Slice 6 wires the Library Generated Lorepack finalization button to the same readiness model so blocked finalization is visible before click. Slice 7 extracts the pure Creator Coverage model into a testable Loredeck helper and adds sparse/dense/acknowledgement model tests. Slice 8 makes the constructive expansion path first-class by routing coverage-blocked finalization surfaces directly to the Creator Coverage Plan. Slice 9 adds `Reopen` controls for intentionally light or not-applicable coverage rows so users can undo acknowledgements without redrafting the plan. Slice 10 blocks approved Creator jobs that have no adaptive coverage plan until the user redrafts coverage or explicitly acknowledges finalizing without it.

## Purpose

Saga's Loredeck Creator should help users create one strong Generated Lorepack for a chosen scope: a book, arc, chapter, episode range, game-rule slice, original-setting segment, or similar story boundary.

The Creator does not need a full Loredeck Series generator for alpha. Users can create several single-scope Loredecks and combine them manually in the Library and Active Stack.

The risk to solve is narrower and more important: a Generated Lorepack can currently complete its own staged pipeline with a small approved title plan, even when the requested source is dense enough that the resulting deck is clearly underbuilt compared with Saga's Harry Potter and My Hero Academia reference decks.

The overhaul should make Creator completion depend on semantic coverage, not an arbitrary entry-count threshold.

## Product Goal

Add a coverage-guided Creator workflow that answers:

- What kind of story/source slice is this?
- Which lore-bearing surfaces matter for this scope?
- Which surfaces are missing, thin, adequate, rich, or not applicable?
- What should Saga generate next to improve coverage?
- When is the deck intentionally light rather than accidentally underbuilt?

This lets sparse sources stay small. A Pac-Man-style scope should not be forced into 100 Lorecards. A dense My Hero Academia arc should not look complete after ten generic Lorecards.

## Non-Goals

- Do not add a Loredeck Series Creator for alpha.
- Do not add hard required entry counts such as "90 entries."
- Do not turn Pack Health into a canon or density judge.
- Do not bypass Scope Brief, Story Outline, Title Pass, Context and Tag Planning, Lorecard Draft Review, Pending Review, Pack Health, or finalization.
- Do not generate filler entries to satisfy a metric.
- Do not add public Lorepack types beyond Bundled Lorepack, Generated Lorepack, and Custom Lorepack.

## Core Concept: Creator Coverage

Creator Coverage is an authoring-readiness layer for Generated Lorepacks.

Pack Health answers whether a Lorepack is structurally valid. Creator Coverage answers whether the accepted/generated content appears sufficiently complete for the declared scope.

Creator Coverage should use advisory statuses:

- `missing`: an applicable surface has no meaningful plan or accepted content.
- `thin`: the surface has some content but likely misses important scene behavior.
- `adequate`: the surface has enough coverage for the declared scope and granularity.
- `rich`: the surface is strong for dense or scene-dense use.
- `not_applicable`: the surface does not matter for this source slice.
- `intentionally_light`: the user accepted a light deck despite thin coverage.

These statuses should be explainable. Every non-adequate row should have a short reason and a next action.

## Coverage Dimensions

The Creator should start with a default matrix and let the model mark dimensions as applicable or not applicable.

Recommended dimensions:

- Characters and entities.
- Relationships and social pressure.
- Factions and institutions.
- Timeline, Context anchors, and reveal boundaries.
- Powers, rules, abilities, items, and mechanics.
- Locations and setting state.
- Secrets, hidden knowledge, and future guards.
- Conflict stakes and consequences.
- Status changes, injuries, deaths, transformations, or role changes.
- Tone, constraints, and scene behavior.

The exact set can evolve, but the UI should keep rows compact and readable.

## Source Shape Classification

The Scope Brief should classify the source before detailed planning.

Suggested fields:

```json
{
  "storyShape": "sparse_game_rules",
  "storyDensity": "sparse",
  "scopeKind": "game_rules",
  "granularity": "focused",
  "coverageRationale": "This scope has durable mechanics and iconic entities, but little relationship, faction, or timeline lore.",
  "expectedCoverage": ["characters_entities", "rules_mechanics", "locations_setting"],
  "likelyNotApplicable": ["relationships_pressure", "factions_institutions", "future_guards"]
}
```

Dense story example:

```json
{
  "storyShape": "very_dense_battle_arc",
  "storyDensity": "very_dense",
  "scopeKind": "long_arc",
  "granularity": "dense",
  "coverageRationale": "This arc has many active factions, power-state changes, secrets, casualties, public consequences, and reveal boundaries.",
  "expectedCoverage": ["characters_entities", "relationships_pressure", "factions_institutions", "timeline_reveals", "powers_rules_items", "future_guards", "conflict_consequences"],
  "likelyNotApplicable": []
}
```

These fields should guide generation. They should not appear as noisy mandatory setup questions unless the model needs clarification.

## Coverage Plan

The Story Outline should include a Coverage Plan alongside beats, Context milestones, and title batches.

Each coverage row should include:

```json
{
  "id": "relationships_pressure",
  "label": "Relationships and pressure",
  "status": "thin",
  "applicability": "applicable",
  "reason": "The arc depends on trust, coercion, rivalry, and betrayal pressure.",
  "plannedTitleBatchIds": ["nami-pressure", "village-coercion"],
  "evidence": {
    "titleDraftCount": 0,
    "approvedTitleCount": 0,
    "acceptedEntryCount": 0
  },
  "nextAction": "Generate relationship-pressure title batch."
}
```

The model should justify `not_applicable`. Users should be able to override it during review.

## UI Direction

Keep the current fullscreen Loredeck Creator workbench and staged roadmap. Add a compact Creator Coverage surface rather than a new wizard.

Recommended placement:

- Add a Creator Coverage summary near the current task/readiness area.
- Show coverage rows as a compact matrix or checklist in the Creator workbench.
- Reuse existing status pills and restrained row styling.
- Keep detailed rationale in tooltips or secondary text.
- Do not add new theme tokens unless an existing variable cannot support the UI.

Summary card:

```text
Creator Coverage: Thin
Story Shape: Very dense battle arc
Main gaps: Relationships, faction state, future guards
Next action: Generate titles for missing coverage
```

Coverage row:

```text
Relationships and pressure    thin    8 titles / 3 accepted    Generate Titles
```

Rows should support:

- `Generate Titles` for a missing/thin surface.
- `Mark N/A` when a surface does not apply.
- `Mark Intentionally Light` when the user knowingly accepts partial coverage.
- `Reopen` when a light or not-applicable surface should become expandable again.
- `Revise Scope` when the scope is too broad for a useful single deck.

## Stage Behavior

### Scope Brief

Add source shape and expected coverage.

The user should review:

- Fandom/source.
- Scope boundary.
- Granularity.
- Story shape.
- Expected coverage surfaces.
- Likely not-applicable surfaces.
- Assumptions and risks.

### Story Outline

Add the Coverage Plan.

The outline is not complete if it has no plan for applicable high-value surfaces. A dense arc should naturally produce more title-batch slices than a sparse rules deck.

### Title Pass

Title batches should be tied to coverage dimensions.

The title review UI should show which coverage rows each title supports. The user should be able to generate more titles for a specific missing/thin coverage row.

### Context And Tag Planning

Planning should know which coverage dimensions the batch supports.

Timeline anchors/windows and tags should be judged against the Coverage Plan. For example, future guards and reveal boundaries should not be represented only as generic tags when they need Context gates.

### Lorecard Drafting

Accepted titles remain the source of entry drafting. The model should still draft one Lorecard proposal per target title.

Coverage evidence should update after drafts are queued and accepted. Draft-review items can be shown as provisional evidence, but they should not make final coverage look complete until accepted or intentionally acknowledged.

### Readiness And Finalization

Generated finalization should include Creator Coverage warnings alongside existing Generated readiness warnings.

Example:

```text
Creator Coverage is thin for a dense arc.
Missing: future guards, faction consequences.
Pack Health is good, but this deck may be underbuilt for the approved scope.
```

Actions:

- Expand Coverage.
- Mark Intentionally Light.
- Finalize Anyway.

Finalization may remain allowed after explicit acknowledgement, but the UI should not imply that structural Pack Health means authoring completeness.

## State Model

Store coverage data on the active Creator job. Pre-alpha can update the job shape in place without compatibility scaffolding.

Suggested field:

```json
{
  "coverage": {
    "schemaVersion": 1,
    "storyShape": "dense_arc",
    "storyDensity": "dense",
    "scopeKind": "long_arc",
    "overallStatus": "thin",
    "intentionalLight": false,
    "rationale": "Dense arc with active faction, relationship, power, and reveal pressure.",
    "dimensions": [
      {
        "id": "future_guards",
        "label": "Secrets and future guards",
        "status": "missing",
        "applicability": "applicable",
        "reason": "Late-arc spoilers and identity reveals need Context-safe gating.",
        "plannedTitleBatchIds": [],
        "approvedTitleIds": [],
        "acceptedEntryIds": [],
        "pendingEntryIds": [],
        "draftEntryIds": [],
        "nextAction": "Generate future-guard titles."
      }
    ],
    "updatedAt": 0
  }
}
```

Do not store only counts. Store short reasons and IDs so the UI can show evidence and route targeted generation.

## Prompt Contract Changes

Update Creator prompts in stages:

- Scope Brief: classify story shape and expected coverage surfaces.
- Story Outline: emit a Coverage Plan and link title batches to coverage dimensions.
- Title Pass: include `coverageDimensionIds` on every title draft.
- Context and Tag Planning: include coverage dimensions in planning batch context.
- Entry Drafting: preserve coverage metadata in draft provenance where useful.
- Repair prompts: preserve coverage fields when repairing malformed responses.

The model should be asked to stop because additional entries would be duplicate or low-value, not because a number was reached.

Good stop reason:

```text
Additional Pac-Man entries would mostly duplicate maze rules, ghost behavior, power-pellet state, and scoring/item mechanics already covered.
```

Bad stop reason:

```text
Generated enough entries.
```

## Readiness Rules

Creator Coverage should affect Generated readiness as warnings, not Pack Health errors.

Recommended behavior:

- Block silent finalization when overall coverage is `missing` or `thin` for applicable dimensions.
- Allow finalization after the user explicitly chooses `Mark Intentionally Light` or `Finalize Anyway`.
- Preserve that acknowledgement on the Creator job and finalized Custom Lorepack provenance.
- Continue to block unresolved draft-review and Pending Review state as the current Creator already does.

## Implementation Slices

1. Add coverage schema normalization helpers for Creator jobs.
2. Update Scope Brief parser/prompt/repair prompt to preserve source shape and expected coverage.
3. Update Story Outline parser/prompt/repair prompt to emit Coverage Plan rows and coverage-linked title batches.
4. Add Creator Coverage summary and matrix UI in the workbench.
5. Update Title Pass prompt/parser to attach coverage dimensions to title drafts.
6. Add targeted title generation for one missing/thin coverage row.
7. Update planning and entry-draft prompts to carry coverage metadata.
8. Add coverage evidence aggregation from title drafts, approved titles, pending proposals, draft-review items, and accepted entries.
9. Add Generated readiness warnings for missing/thin coverage.
10. Add `Mark N/A`, `Mark Intentionally Light`, and `Finalize Anyway` acknowledgement flows.
11. Add tests for sparse, moderate, and dense scopes.

## Test Plan

Unit tests:

- Scope Brief parsing preserves story shape, density, expected coverage, and not-applicable surfaces.
- Story Outline parsing preserves Coverage Plan rows and links title batches to coverage dimensions.
- Title drafts preserve coverage dimension IDs.
- Coverage aggregation counts only accepted entries as final evidence.
- Sparse scopes can reach adequate coverage with small accepted-entry counts.
- Dense scopes remain thin when high-value dimensions are missing.
- `not_applicable` and `intentionally_light` acknowledgements persist.
- `not_applicable` and `intentionally_light` acknowledgements can be reopened for expansion.
- Generated readiness includes Creator Coverage warnings without turning them into Pack Health errors.
- Generated finalization blocks on unresolved missing/thin Creator Coverage until the user expands coverage or chooses `Finalize Anyway`.
- Generated finalization blocks on a missing Creator Coverage plan for approved jobs until the user redrafts or explicitly acknowledges the missing plan.
- Finalized Custom Lorepacks preserve Creator Coverage acknowledgement provenance.
- Pure coverage-model tests cover sparse, dense, accepted, current-acknowledgement, and stale-acknowledgement cases.

UI smoke tests:

- Creator Coverage summary renders in the workbench.
- Missing/thin rows expose targeted generation actions.
- Not-applicable rows are visibly distinct but not noisy.
- Light and not-applicable rows expose `Reopen`.
- Readiness/finalization surfaces show Creator Coverage warnings separately from Pack Health.
- Readiness-card regression tests cover `Finalize Anyway` visibility and acknowledged-coverage state.
- Library finalization controls disable and explain `Finalize as Custom` when Generated readiness or Creator Coverage blocks finalization.
- Coverage-blocked readiness surfaces expose `Open Coverage Plan` as the primary route before `Finalize Anyway`.
- Text fits in compact and expanded shelf layouts.

Manual QA:

- Sparse game-rule source such as Pac-Man stays compact without filler.
- Dense anime/manga battle arc produces visible missing/thin warnings until multiple coverage surfaces are planned and accepted.
- A user can intentionally finalize a light Generated Lorepack, and the final Custom Lorepack retains clear provenance that coverage was acknowledged as light.

## Remaining Decisions

- Should `Creator Coverage` be the visible label, or should the public UI use a softer phrase such as `Coverage Review`?
- Should Basic Experience ever show Creator Coverage summaries for Generated Lorepacks, or should this stay Advanced-only for alpha?

## Recommendation

Build this as an authoring-quality layer inside the existing Loredeck Creator. Keep the current staged, micro-batched workflow. Add source-shape classification, coverage rows, targeted title expansion, and readiness warnings so the Creator can distinguish a legitimately small source from an underbuilt dense arc.
