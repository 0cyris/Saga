# Loredeck Health Auto-Fix Stage 1: Parallel Foundation

Status: Core implementation pass complete. Pure contracts, planner, local repair patch builders, validator, model prompt/parser helpers, simulator, and targeted tests are in place. Runtime storage/UI wiring remains reserved for Stage 2.

Stage 1 builds the storage-neutral repair intelligence for Pack Health auto-fix. It must not wire UI actions, mutate persistent pack records, write settings, write external payload files, or create durable repair sessions. Its output is pure modules, contracts, fixtures, and tests that Stage 2 can connect to the storage layer later.

## Goal

Make the hard repair decisions testable before storage integration:

- Normalize Pack Health issues into stable repair findings.
- Group findings into repair buckets.
- Classify buckets as local, model, review-choice, or manual-only.
- Build deterministic local repair patches without persisting them.
- Validate patch scope and direct-apply eligibility.
- Build and parse bounded model repair requests without requiring live provider calls.
- Prove high-volume cases, especially Arlong-style 50+ entry failures, are planned as batches instead of giant prompts, with excess model units reported as deferred.

## Hard Boundaries

Stage 1 must not edit or depend on unstable storage surfaces:

- Do not modify `src/state/settings-store.js`.
- Do not modify `src/state/state-manager.js`.
- Do not modify `src/state/loredeck-library-store.js`.
- Do not modify `src/state/lore-creator-store.js`.
- Do not modify `src/storage/**` unless the storage owner explicitly asks for a contract change.
- Do not write `settings.json`.
- Do not call `upsertLoredeckLibraryPack()` from new code.
- Do not add repair job persistence.
- Do not change Health Center buttons or Creator final-card behavior.

Allowed work:

- New pure modules under `src/loredecks`.
- New fixtures under tests or tools.
- New Node tests under `tools/scripts`.
- Documentation updates that do not change storage design decisions.
- Read-only use of existing schema/tag/timeline repair helpers.

## Proposed Stage 1 Modules

Names can change if the implementation finds a better local pattern, but keep the boundaries:

- `src/loredecks/loredeck-health-repair-contracts.js`
  - Shared normalizers and constants for findings, buckets, repair units, patches, choices, diagnostics, and result summaries.

- `src/loredecks/loredeck-health-fix-planner.js`
  - Converts Pack Health reports or grouped issues into repair plans.
  - Assigns strategy, priority, target scope, and model batch units.

- `src/loredecks/loredeck-health-local-repairs.js`
  - Builds deterministic patch proposals from a pack snapshot and planned bucket.
  - Reuses schema v3 entry repair helpers where possible.

- `src/loredecks/loredeck-health-repair-validator.js`
  - Validates patch scope, allowed fields, affected IDs, schema compatibility, and direct-apply eligibility.

- `src/loredecks/loredeck-health-model-repairs.js`
  - Builds compact model prompts and parses model repair JSON.
  - Does not call providers directly in Stage 1.

- `src/loredecks/loredeck-health-repair-simulator.js`
  - Optional in-memory orchestrator for tests.
  - Applies patch objects to cloned pack snapshots and uses injected health evaluators.

## Patch Contract

Stage 1 should define a storage-neutral patch contract. Stage 2 can translate it into external payload writes.

```json
{
  "patchId": "patch_schema_v3_legacy_timing_fields_1",
  "source": "local_repair",
  "findingIds": ["health_abc123"],
  "strategy": "local_bulk",
  "confidence": 1,
  "risk": "low",
  "operations": [
    {
      "op": "upsert_entry_override",
      "entryId": "nami-secret-buyback-bargain",
      "entry": {}
    }
  ],
  "diagnostics": ["Removed schema v3 legacy timing fields."]
}
```

Do not use storage-specific paths, index file paths, settings keys, or UI action IDs in this contract.

## Choice Contract

Ambiguity should become an explicit choice set:

```json
{
  "choiceSetId": "choice_context_anchor_1",
  "findingIds": ["health_def456"],
  "severity": "warning",
  "question": "Which Context anchor should replace the broken anchor?",
  "options": [
    {
      "optionId": "A",
      "label": "Arlong betrays buyback",
      "confidence": 0.82,
      "patch": {}
    }
  ],
  "reason": "Several anchors share the same sort key."
}
```

Stage 1 only creates and validates choice sets. Stage 2 stores and renders them.

## Phase 1: Contracts And Test Harness

Objective: create stable repair data shapes before planner logic spreads.

Tasks:

- Add contract normalizers for findings, buckets, units, patches, choices, and result summaries.
- Add constants for repair strategies, issue code families, and patch operation names.
- Add helpers for stable IDs and input hashes.
- Add test utilities for cloning pack snapshots and compact health reports.
- Add a compact Arlong-style fixture derived from the observed issue shape:
  - 56 `schema_v3_legacy_timing_fields` errors
  - 1 `broken_anchor_reference` warning
  - 1 `unmatchable_context_gate` warning
  - 1 `undefined_tag` warning containing multiple tag references
  - 1 `orphaned_tag_definition` suggestion

Acceptance:

- Contract normalizers are deterministic.
- Invalid or malformed health issue records normalize without throwing.
- Stable finding IDs do not change when issue ordering changes.
- Tests do not require a browser, storage files, or live settings.

## Phase 2: Repair Planner

Objective: turn a health report into a bounded repair plan.

Tasks:

- Normalize raw health issues into findings.
- Group findings by issue code, affected entry IDs, affected tag IDs, affected timeline IDs, and severity.
- Classify buckets:
  - schema v3 legacy fields -> `local_bulk`
  - schema v3 wide retrieval activation -> `local_bulk`
  - unique compact tag mapping -> `local_bulk`
  - ambiguous tag mapping -> `local_review_choice`
  - exact anchor normalization -> `local_bulk`
  - ambiguous anchor candidates -> `local_review_choice`
  - missing schema v3 content with safe alias text -> `local_bulk`
  - missing schema v3 content without safe alias text -> `model_direct`
  - missing or incomplete schema v3 retrieval with otherwise valid entry shape -> `local_bulk`
  - missing or incomplete schema v3 retrieval on invalid entries -> `model_direct`
  - unsupported semantic rewrites -> `model_direct` or `model_review_choice`
  - suggestions such as orphaned tags -> low-priority review or manual-only by default
- Build repair units from buckets with batch sizes:
  - model entry repair: 6 to 8 entries
  - model tag repair: 10 to 15 tags
  - model timeline repair: 3 to 5 anchor/window issues
  - per-run model unit default: 8
- Return a plan summary with local, model, choice, manual-only, and estimated unit counts.

Acceptance:

- The Arlong fixture plans 56 schema errors as one local bulk bucket.
- Undefined tag and anchor warnings are separated from schema errors.
- High-volume findings never produce one giant model unit.
- Manual-only findings explain why they are not auto-fixed.

## Phase 3: Local Repair Patch Builders

Objective: make deterministic repair useful without persistence.

Tasks:

- Build patch objects for schema v3 legacy field cleanup.
- Build patch objects for schema v3 wide retrieval gating.
- Build patch objects for missing or incomplete schema v3 retrieval defaults when the rest of the entry validates.
- Build patch objects for restoring `content.fact` and `content.injection` from safe aliases.
- Build patch objects for schema v3 entry normalization.
- Build patch objects for dropping generic schema tags when they are not registry-defined tags.
- Build patch objects for compacted tag IDs when the registry match is unique.
- Build choice sets for ambiguous tag mappings.
- Build patch objects for exact Context anchor normalization.
- Build choice sets for ambiguous Context anchor candidates.
- Build patch objects for manifest stat refresh as a pure computed patch, if possible without storage coupling.

Acceptance:

- Local patch builders do not mutate input pack snapshots.
- Schema v3 cleanup can produce a patch for all 56 affected Arlong-style entries.
- Wide/global schema v3 entries can produce local `retrieval` patches that set `activation`, `frequency`, and `contextBoost` to conservative values.
- Missing schema v3 content can produce local `content` patches only when existing safe alias fields can fill both `content.fact` and `content.injection`.
- Missing schema v3 content without safe alias fields remains model-eligible.
- Missing or incomplete schema v3 retrieval can produce local `retrieval` patches when `context` and `content` already validate.
- Unknown specific tags are preserved unless a unique registry target exists.
- Ambiguous candidates become choices, not direct patches.
- Manifest stats drift can produce a storage-neutral `refresh_manifest_stats` patch with computed `entryCount` and sorted `categoryCounts`.

## Phase 4: Patch Validator

Objective: define direct-apply safety before any real writes exist.

Tasks:

- Validate that every operation targets one or more planned findings.
- Validate operation names against allowed issue code families.
- Validate entry operation field scopes against allowed issue code families.
- For model-sourced entry payloads, diff the supplied full entry against the current entry and reject hidden changes outside declared field scope.
- Reject operations that touch unrelated entries, tags, or timeline IDs.
- Reject destructive operations unless explicitly marked confirm-required.
- Validate schema v3 entry shape after entry override operations.
- Validate tag IDs against the supplied registry snapshot.
- Validate Context anchors/windows against the supplied timeline snapshot.
- Validate review choice sets for non-empty options, unique option IDs, and choice-level finding scope.
- Return structured validation diagnostics with severity and blocking flags.

Acceptance:

- A valid schema cleanup patch passes.
- A patch that edits an unrelated entry fails.
- A patch that creates an unrelated tag fails.
- A patch that deletes entries fails unless its strategy explicitly allows destructive repair.
- A model patch that declares `content` but also changes `retrieval`, tags, or Context fields fails.
- Empty choice sets, duplicate choice option IDs, and choices referencing unrelated findings fail validation.
- Validator output is suitable for Stage 2 UI and logs.

## Phase 5: Model Repair Prompt And Parser

Objective: prepare reasoner repair without live provider or storage coupling.

Tasks:

- Build compact JSON prompt payloads for one repair unit.
- Include only affected entries and relevant registry/timeline slices.
- Define allowed patch operations per issue code.
- Define allowed entry fields per issue code.
- Require model output with `repairs`, `choices`, `warnings`, and `clarifyingQuestions`.
- Parse model repair JSON.
- Reject prose-only, malformed, or oversized output.
- Convert model `repairs` into patch objects.
- Convert model `choices` into choice sets.
- Run parsed patches through the validator.
- Run parsed choice sets through the validator and surface invalid choices as diagnostics.

Acceptance:

- Model prompts for a 57-item affected deck split into bounded unit prompts.
- Model prompt findings are scoped to the current batch, not the whole bucket.
- Model prompt payloads include `allowedOperations`, `allowedFields`, and a response `maxChars` limit.
- Model units beyond the current `modelUnitLimit` are reported in `deferredUnits`, not silently dropped.
- Parser rejects malformed JSON without mutating anything.
- Parser rejects oversized model responses before JSON parsing.
- Validator rejects known-code entry override operations that omit `fields` or include out-of-family fields.
- Validator rejects model entry payloads that hide unrelated field mutations behind an otherwise allowed field list.
- Unsafe model patches are marked non-direct and become review choices or unresolved diagnostics.
- Invalid model choice sets are not added to reviewable choices. Model choice option patches are normalized as model-sourced patches before validation.
- Tests use fixture strings and mocked outputs only.

## Phase 6: In-Memory Repair Simulator

Objective: test the whole decision pipeline before storage integration.

Tasks:

- Create a simulator that accepts:
  - pack snapshot
  - health report
  - repair plan
  - optional mocked model responses
  - injected health evaluator
- Run phases in memory:
  - local plan
  - local patch validation
  - local patch apply to clone
  - health checkpoint
  - model unit parse/validation
  - choice generation
  - final summary
- Produce before/after counts and diagnostics.
- Produce a compact run summary with initial/checkpoint/final health counts, resolved counts, strategy counts, choice counts, deferred model unit counts, and an outcome label.

Acceptance:

- Arlong-style schema errors reduce in the simulated local phase.
- Failed model units do not discard local simulation output.
- Choice sets are carried forward without pretending they are fixed.
- Snapshot patch application updates existing `entryOverrides`, `entries`, or `entryFiles[].entries` surfaces instead of assuming settings-style overrides.
- Simulator summaries distinguish `clean`, `needs_review`, `model_pending`, `manual_remaining`, `blocked`, and `unresolved` outcomes.
- No persistent state is written.

## Phase 7: Stage 2 Handoff Package

Objective: leave clear integration instructions for the post-storage implementer.

Tasks:

- Document exported functions and expected inputs/outputs.
- Document which Stage 1 tests are required gates before Stage 2.
- Document adapter functions Stage 2 must provide:
  - `loadPackPayload(packId)`
  - `runPackHealth(packIdOrPayload)`
  - `applyPackRepairPatch(packId, patchSet, options)`
  - `writeRepairSession(session)`
  - `deleteRepairSession(sessionId)`
  - `updatePackHealthSummary(packId, summary)`
  - `refreshPackSurfaces(packId)`
- Update Stage 2 plan if Stage 1 discovers better contract names.

Acceptance:

- A new LLM can read Stage 1 and Stage 2 plans and understand exactly what is already implemented.
- Stage 2 does not need to reverse-engineer Stage 1 tests to know how to call the modules.

## Stage 1 Test Plan

Recommended tests:

- `tools/scripts/test-loredeck-health-repair-stage1.mjs`
- `tools/scripts/test-loredeck-health-repair-contracts.mjs`
- `tools/scripts/test-loredeck-health-fix-planner.mjs`
- `tools/scripts/test-loredeck-health-local-repairs.mjs`
- `tools/scripts/test-loredeck-health-repair-validator.mjs`
- `tools/scripts/test-loredeck-health-model-repairs.mjs`
- `tools/scripts/test-loredeck-health-repair-simulator.mjs`

Do not add these tests to storage migration gates until the storage owner agrees. They can run as targeted tests during parallel development.

Implemented targeted tests:

- `tools/scripts/test-loredeck-health-repair-stage1.mjs`
- `tools/scripts/test-loredeck-health-repair-contracts.mjs`
- `tools/scripts/test-loredeck-health-repair-planner.mjs`
- `tools/scripts/test-loredeck-health-local-repairs.mjs`
- `tools/scripts/test-loredeck-health-repair-validator.mjs`
- `tools/scripts/test-loredeck-health-model-repairs.mjs`
- `tools/scripts/test-loredeck-health-repair-simulator.mjs`
- `tools/scripts/test-loredeck-health-repair-pipeline.mjs`

Shared fixtures live in `tools/scripts/loredeck-health-repair-test-fixtures.mjs`.

## Stage 2 Handoff

Implemented Stage 1 exports:

- `buildLoredeckHealthRepairPlan({ pack, health, batchLimits })`
- `buildLoredeckLocalRepairsForPlan(pack, plan)`
- `validateLoredeckRepairPatch(pack, patch, context)`
- `validateLoredeckRepairChoiceSet(pack, choiceSet, context)`
- `buildLoredeckModelRepairPromptPayload(pack, unit, plan)`
- `parseLoredeckModelRepairResponse(text)`
- `parseAndValidateLoredeckModelRepairResponse(pack, unit, plan, text)`
- `createRepairHealthSnapshotSummary(health)`
- `createRepairRunSummary({ initialHealth, checkpointHealth, finalHealth, initialPlan, checkpointPlan, finalPlan, local, modelResults, appliedPatches, choiceSets, diagnostics })`
- `simulateLoredeckHealthRepair({ pack, health, healthEvaluator, modelResponses, batchLimits })`
- `applyLoredeckRepairPatchToSnapshot(pack, patch)`

`applyLoredeckRepairPatchToSnapshot()` is for tests and dry-run simulation only. It writes entry override operations back to the entry surface already present in the cloned snapshot: `entryOverrides`, top-level `entries`, or `entryFiles[].entries`. It falls back to `entryOverrides` only when the target entry is not present on any existing surface.

Implemented patch operation names include:

- `upsert_entry_override`
- `upsert_tag_definition`
- `upsert_timeline_anchor`
- `upsert_timeline_window`
- `refresh_manifest_stats`

Model repair units are batch-scoped: `unit.findingIds`, prompt `selectedHealthFindings`, and model-response validation context are limited to the current batch target IDs.

Model repair prompt payloads expose `allowedOperations` and `allowedFields` for the unit's issue code. `parseAndValidateLoredeckModelRepairResponse()` validates both `repairs` and `choices`; invalid choices are returned in `invalidChoices` and should not be rendered as reviewable choices.

Model-sourced entry repair payloads are validated by diffing the proposed full entry against the current entry. Every changed path must be covered by the operation's declared `fields`. This prevents a response from declaring `content` while quietly mutating `retrieval`, tags, Context, or other entry fields. The same rule applies to model-generated review choice option patches.

Plans may include `deferredUnits` when model-eligible findings exceed the current `modelUnitLimit`. `summary.modelUnitCount` counts currently scheduled units, `summary.deferredModelUnitCount` counts deferred units, and `summary.totalModelUnitCount` counts both.

Timeline quality suggestions such as `timeline_candidate_sparse`, `timeline_anchor_coverage_concentrated`, and `timeline_windows_missing` are manual-only in Stage 1. They should not generate model batches by default.

Stage 2 should provide storage adapters for:

- loading a fresh external pack payload
- running Pack Health against the payload
- applying validated repair patches transactionally
- writing and deleting active repair session files
- updating compact library health summaries
- refreshing Library, Workbench, Health Center, and Deck Maker surfaces

Stage 2 must not bypass the Stage 1 validator. Direct model repairs should be applied only after `validateLoredeckRepairPatch()` returns `directApply: true`.

## Stage 1 Done Criteria

Stage 1 is complete when:

- Planner, local repair builders, validator, model parser, and simulator are implemented as pure modules.
- Arlong-style high-volume health failures are covered by tests.
- No settings, storage, library store, Creator store, Health Center UI, or Creator UI files were modified for runtime wiring.
- Stage 2 can consume Stage 1 through documented contracts.
