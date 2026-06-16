# Deck Maker Health Improvement Plan

Status: Implementation pass complete. Regression coverage, schema-aware persistence, Deck Maker entry guardrails, Pending Review hardening, final Pack Health UX, deterministic repair, and the alpha-gate verification sweep are in place. The only deferred item is an optional resolver UI for ambiguous repairs.

## Problem Statement

A recently generated `one-piece-arlong-park` Generated Loredeck reached the final Creator readiness card with `healthStatus: "has_errors"`. Pack Health reproduced:

- 56 schema v3 errors, one per accepted Lorecard, because schema v3 entries still contained legacy top-level fields such as `date`, `canonTiming`, `validFrom`, `validTo`, `activeWhen`, `whoKnowsTruth`, `whoSuspects`, `whoBelievesPublicVersion`, `publicVersion`, and `fact`.
- One broken Context anchor reference: `one-piece.arlong.arlong-betrays-buyback-deal` instead of the accepted registry anchor `one-piece.arlong.arlong-betrays-buyback`.
- Undefined entry tags such as `characternami`, while the accepted tag registry contained namespaced tags such as `character:nami`.
- Generic `kind` / `category` tags such as `fact`, `secret`, and `other` appearing on entries.

The likely root cause is local persistence, not the initial Creator prompt. `normalizeLoredeckEntryOverrides()` currently routes saved Loredeck `entryOverrides` through the general `normalizeLoreEntry()` path. That older general normalizer is useful for chat lore, but it is not schema v3-safe for Loredeck overrides: it adds legacy fields, compacts tags with `normalizeLoreTag()`, strips namespaced tag punctuation, and appends `kind` / `category` as tags.

The Deck Maker entry stage also accepts too much on trust. It asks the provider for schema v3 entries and calls the schema v3 scrubber during entry-change construction, but the stage validator only confirms that at least one supported `upsert_entry` proposal exists. It does not reject unknown anchor IDs, tags missing from the accepted registry, or health-breaking output before Draft Review.

## Goals

- Keep Generated Loredeck entries schema v3-clean through Draft Review, Pending Review, acceptance, save, reload, Pack Health, export, and Generated-to-Custom finalization.
- Treat Pack Health errors as real blockers at Deck Maker final readiness gate.
- Give users direct issue visibility and repair actions from the final Deck Maker surface.
- Prevent future Deck Maker batches from saving unknown anchor/tag references when accepted planning metadata already exists.
- Repair the current class of generated-pack errors deterministically without adding long-term compatibility scaffolding.

## Non-Goals

- Do not introduce legacy migration layers. Saga is pre-alpha; fix the current normalized shape in place.
- Do not weaken schema v3 health checks to hide the issue.
- Do not make Pack Health judge subjective canon completeness. Deck Maker Coverage remains separate from structural Pack Health.
- Do not bypass Draft Review or Pending Review.

## Phase 1: Lock The Failure With Tests

Status: Implemented for schema v3 override persistence, accepted Deck Maker-style entry changes, and semantic-gate fixtures.

Objective: make the observed failure reproducible without depending on the user's live `settings.json`.

Tasks:

- Add a compact Generated Loredeck fixture with one schema v3 entry, one namespaced tag, and one timeline anchor.
- Save that fixture through the same library persistence path used by `upsertLoredeckLibraryPack()`.
- Assert the saved entry does not gain legacy top-level fields.
- Assert namespaced tags such as `character:nami` remain unchanged.
- Assert `kind` and `category` do not get appended as entry tags for schema v3 Loredeck overrides.
- Add a regression variant that accepts a Deck Maker-style pending entry change and then reruns Pack Health.

Acceptance:

- The test fails on the current persistence normalizer.
- The test passes only when a schema v3 Generated/Custom Loredeck override survives save and reload with clean Pack Health.

## Phase 2: Make Loredeck Override Persistence Schema-Aware

Status: Implemented. Schema v3 `entryOverrides` use the schema-aware Loredeck path, and Pending Review patch application sanitizes schema v3 entry overrides before writing them into a live pack.

Objective: stop the shared settings normalizer from converting schema v3 Loredeck overrides back into hybrid v2/v3 entries.

Tasks:

- Replace `normalizeLoredeckEntryOverrides()` with a schema-aware path:
  - For schema v3 overrides, preserve Loredeck-specific fields and call `normalizeLoredeckEntryForSchemaV3()`.
  - Do not run schema v3 overrides through tag-compacting `normalizeLoreEntry()` unless followed by a v3 cleanup that also restores namespaced tags.
  - Preserve `context`, `retrieval`, `content`, `coordinates`, `extensions`, `source`, and existing explicit `tags`.
  - Keep only minimal identity/default cleanup: `id`, `title`, `schemaVersion`, `category`, `canon/canonStatus`, `relevance`, `priority`, and edit flags.
- Keep the old `normalizeLoreEntry()` behavior for chat `loreMatrix` and `pendingLoreEntries`.
- Review any secondary library pack normalizers that pass `entryOverrides` through without schema-aware cleanup.

Acceptance:

- Saving a Generated or Custom Loredeck with schema v3 `entryOverrides` no longer creates `schema_v3_legacy_timing_fields`.
- Registry tags with `:` survive save/reload.
- Existing chat lore normalization behavior is unchanged.

## Phase 3: Add Creator Entry Semantic Gates

Status: Implemented. Deck Maker Lorecard drafts run through deterministic schema v3 guardrails before entering Draft Review. Regression coverage includes malformed context, retrieval, content, unknown tag, unknown anchor, wrong micro-batch payloads, Lorecards stage continuation, current-task UI, and Draft Review handoff state.

Objective: reject or repair bad Deck Maker Lorecard drafts before they can become accepted Generated Loredeck entries.

Tasks:

- After `buildLoredeckAssistantEntryChange()` creates an entry change, run a Deck Maker entry validation step against the current generated pack.
- Validate:
  - No schema v3 legacy top-level fields remain.
  - `context.scope`, sort keys, `precision`, `label`, `retrieval.activation`, `retrieval.frequency`, and `retrieval.contextBoost` are present.
  - `anchorId`, `validFromAnchor`, and `validToAnchor` reference accepted timeline anchors when present.
  - Entry tags either exist in the accepted tag registry or are intentionally allowed generated pack tags.
  - The entry ID is one of the current micro-batch target IDs.
- For invalid drafts, prefer deterministic repair when safe:
  - Map compacted tags to exact registry IDs when the mapping is unambiguous.
  - Drop generic `kind` / `category` tags from schema v3 Loredeck entries.
  - Replace an obvious anchor typo only when there is one exact normalized candidate.
- If repair is not safe, keep the draft out of Draft Review and show a Deck Maker generation warning with affected entry IDs.

Acceptance:

- Implemented: compacted tags are mapped to accepted registry IDs only when unambiguous, generic `kind` / `category` tags are dropped, unknown tags are rejected, unknown Context anchor references are rejected, and entry IDs outside the micro-batch are rejected.
- Covered: malformed provider payloads with missing context labels, reversed sort keys, missing retrieval fields, missing content, unknown tags, unknown anchors, and wrong micro-batch IDs are rejected before Draft Review.
- Covered: UI contract tests verify Lorecards-stage continuation, current-task copy, and Draft Review queue handoff state.

## Phase 4: Harden Pending Review And Acceptance

Status: Implemented. `applyLoredeckRecordPatch()` accepts a schema-aware entry override sanitizer from runtime configuration and uses it before writing `entryOverrides`. Pending Review surfaces non-clean Pack Health status with a direct `Open Pack Health Center` route, and health-impacting acceptance reports refreshed Pack Health issue counts.

Objective: make the review pipeline preserve the same schema guarantees as the Deck Maker stage.

Tasks:

- Before `applyLoredeckRecordPatch()` writes `entryOverrides`, apply the same schema-aware entry sanitizer used by library persistence.
- When accepting health-impacting changes, rerun Pack Health and keep the existing stale-health feedback.
- If acceptance produces Pack Health errors, surface the issue summary immediately and keep the Health Center route visible.
- Ensure Draft Review rows are removed after queueing to Pending Review, and Pending Review rows are removed after accept/reject.

Acceptance:

- A clean Draft Review entry remains clean after Pending Review acceptance.
- A malformed manually edited pending change cannot silently poison a Generated Loredeck.
- Implemented: acceptance reruns Pack Health after health-impacting changes, reports `Pack Health: status (N errors, M warnings)`, and points users to the Pack Health Center when errors remain.
- Implemented: Pending Review cards with `has_errors` or `needs_review` Pack Health expose `Open Pack Health Center` directly to the Issues tab.
- Covered: the review lists behave consistently after Draft Review queue handoff and Pending Review accept/reject.

## Phase 5: Fix Creator Final Readiness And Health UX

Status: Implemented. Creator readiness receives cached Pack Health, treats cached Pack Health errors as blockers, summarizes issue counts, opens the Pack Health Center to Issues when errors exist, exposes final-card Pack Health actions, and uses `Pack Health` wording across the primary Creator, Library, Workbench, Pending Review, Attempt Fixing, and validation routes.

Objective: make the final Deck Maker surface explain and block structural health problems.

Tasks:

- Pass cached Pack Health into `getLoredeckCreatorPipelineModel()` instead of computing generated readiness with `health = null`.
- Change generated readiness so Pack Health errors are blockers, not warnings.
- Keep warnings confirmable only for non-error conditions such as stale health or intentionally light Deck Maker Coverage.
- Add final-card actions:
  - `Run Pack Health`
  - `Open Pack Health Center`
  - `Attempt Fixing` when repairable findings are available
- Replace generic latest-health error copy with a compact summary such as `Pack Health: 56 errors, 3 warnings`.
- Let Pack Health Center open directly to the Issues tab for packs with errors.
- Align user-facing health labels so Deck Maker final gate, Pending Review, Library, Workbench, and Health Center all refer to `Pack Health`.

Acceptance:

- Implemented: the final card cannot display `Finalize ready` while cached Pack Health contains errors.
- Implemented: the final card shows `Pack Health: N errors, M warnings` and exposes `Run Pack Health`, `Open Pack Health Center`, and `Attempt Fixing` when issue counts exist.
- Implemented: the health overlay now presents as `Pack Health Center`, and Library/Workbench buttons use `Open Pack Health Center`, `Open Pack Health`, or `Run Pack Health`.
- Covered: Generated-to-Custom finalization blocks on Pack Health errors and still succeeds for a clean validated Generated Loredeck.

## Phase 6: Add Deterministic Repair For Existing Generated Packs

Status: Superseded by Stage 2 Attempt Fixing. `Attempt Fixing` now runs the storage-backed repair orchestrator, applies deterministic local fixes, saves model/review/manual leftovers to repair sessions, and keeps full payload repair state out of settings. The older settings-backed safe-repair fallback and its direct Pending Review proposal path have been removed.

Objective: provide a practical recovery path for packs already affected by this bug.

Tasks:

- Extend `Attempt Fixing` for editable Generated/Custom Loredecks:
  - Strip schema v3 legacy top-level fields.
  - Rebuild `content.fact` / `content.injection` when missing from safe legacy aliases.
  - Canonicalize tags against the active tag registry when unambiguous.
  - Remove generic `kind` / `category` tags from schema v3 Loredeck entries.
  - Offer anchor typo fixes only when there is exactly one safe target.
- Queue ambiguous repairs through Pending Review instead of applying silently.
- Rerun Pack Health after repair and report before/after issue counts.

Acceptance:

- Implemented: the affected Arlong Park-style compact-tag/generic-tag/schema-v3-residue shape repairs to `good` without manual JSON editing.
- Implemented: ambiguous or unknown specific tags and anchors are not silently changed; they remain visible in Pack Health and the repair toast reports that review is still needed.
- Implemented: a Context anchor typo with exactly one sort-key-matched anchor target queues a `Review Context Anchor Repair` Pending Review patch; accepting it applies the concrete entry override and can clear the Pack Health warning.
- Implemented: queued Context anchor repair rows show the specific field, original anchor, proposed anchor, and sort-key reason before acceptance.
- Implemented: multiple-candidate compact-tag and sort-key anchor matches remain unqueued and visible as unresolved Pack Health review work.
- Bundled Loredecks still route to duplicate-as-Custom before direct repair.
- Deferred: optional future resolver UI for selecting among multiple candidates; current behavior intentionally avoids silent or no-op changes.

## Phase 7: Verification And Smoke Coverage

Status: Implemented for automated contract coverage. `tools/scripts/run-alpha-gate.mjs` now includes Deck Maker, Pending Review, Pack Health, library, workbench, visual smoke, schema guard, and repair tests added during this cycle.

Objective: prove the full improvement cycle works from generation through finalization.

Tasks:

- Unit tests:
  - schema v3 override persistence
  - tag namespace preservation
  - no generic tag leakage
  - schema v3 Attempt Fixing
- Creator integration tests:
  - mocked provider output with valid schema v3 entries
  - mocked compacted tags requiring deterministic mapping
  - mocked unknown anchor rejected before Draft Review
  - Draft Review to Pending Review to accepted override health loop
- Pack Health tests:
  - generated virtual pack validates cleanly after accepted Creator entries
  - readiness treats health errors as blockers
  - finalization action blocks Pack Health errors before Custom conversion
  - queued schema v3 Context anchor repair preview is visible in Pending Review
  - Pending Review cards expose a Pack Health Center route when saved Pack Health is non-clean
  - multiple-candidate schema v3 repairs do not create no-op Pending Review rows
- Visual smoke:
  - Creator final card with clean health
  - Creator final card with health errors
  - Health Center opens to Issues from the final card
  - Attempt Fixing path refreshes the final readiness card

Acceptance:

- `node --check` passes for touched JS modules.
- Targeted Creator and Pack Health tests pass.
- Visual smoke confirms the final Creator gate is understandable and actionable.

## Recommended Implementation Order

1. Add failing persistence and health regression tests.
2. Fix `normalizeLoredeckEntryOverrides()` and any library save path that still uses the v2 normalizer for schema v3 overrides.
3. Add schema-aware sanitization to pending patch application.
4. Add Creator semantic gates for tags and anchors.
5. Update readiness and final-card Pack Health UX.
6. Expand deterministic repair and validate it on the affected generated-pack shape.
7. Run focused tests and visual smoke.

This order fixes the data corruption layer first, then prevents bad generated drafts, then improves user-facing recovery.
