# Deck Maker Lorecard Rejection Recovery Plan

Status: complete. Phase 1 diagnostic foundation, Phase 2 target preflight, the first Phase 3 deterministic omitted-tag cleanup, Phase 4 partial-result metadata, Phase 5 all-rejected retryable failures, Phase 6 automatic smaller retry plus per-run rejected-target retry limits, Phase 7 rejected-target retry context and explicit timeline filtering, Phase 8 rejection/repair UX slices, Phase 9 progress-write coalescing, and Phase 10 verification are implemented. Deck Maker Lorecard prompts now receive explicit `allowedEntryTags`, `suggestedTags`, and `omittedTitleTags`; rejected guard results return compact structured diagnostics; title-sourced omitted tags can be dropped safely before Draft Review; entry micro-batch result refs include rejected-target metadata; all-rejected schema-guard batches become typed retryable failures; rejected targets are retried as one-title batches when smaller retries are enabled; one-title retries include compact `previousRejection` context; one-title retry prompts shrink accepted tags and explicit title-bound timeline IDs when available; split retries use the Reasoning Provider by default and can opt into the Utility Provider with automatic Reasoning fallback; exhausted retry targets are skipped for the rest of the current auto-draft run; Lorecards shows last preflight gaps, last rejection details, per-draft preflight notes, and per-draft repair notes; live Deck Maker generation progress writes coalesce while start/run/unit checkpoints remain immediate; repeated upload counts stay an internal storage regression signal rather than a State Safety warning; and the alpha gate passes with the rejection-recovery and Creator storage tests included.

This plan covers the Deck Maker failure mode where a Lorecard drafting provider call succeeds, but Saga rejects some or all returned Lorecard drafts before they reach Deck Maker Draft Review. It is a focused companion to the broader Health Center `Attempt Fixing` work and the Deck Maker batching architecture.

## Problem

Users can experience Lorecard drafting as "half the provider calls are rejected" even when the provider did return usable JSON. The current user-facing result is confusing because:

- The model call can finish normally with visible JSON and `finish_reason: stop`.
- Saga then guards the generated Lorecards against schema v3 tag and timeline references.
- Unknown tags or anchors can reject a draft before it appears in Deck Maker Draft Review.
- If every proposal in a micro-batch is rejected by the guard, the batch can look complete to the generation runner instead of retryable.
- `Retry attempts` helps malformed, empty, or failed provider units, but does not reliably help valid JSON that fails Creator schema guardrails.
- `Prefer smaller retries` exists, but the smaller-batch path is mostly a manual recovery affordance instead of the default automatic fallback.
- The console can be flooded by repeated Deck Maker project and storage index writes, making it harder to see the actual failure.

Observed Arlong Park example:

- A captured provider response returned valid JSON Lorecard proposals.
- The following prompt payload included title drafts with `location:cocoyashi`.
- The accepted tag registry shown in that prompt did not include `location:cocoyashi`.
- If the model repeats that title tag into the Lorecard entry, the strict schema v3 guard rejects the draft as an unknown tag reference.

The core issue is not "the provider rejected the call." It is that Saga needs a clearer recovery pipeline for provider-successful but schema-rejected Deck Maker Lorecard drafts.

## Goals

- Make Deck Maker Lorecard drafting distinguish provider failures from Saga-side draft rejections.
- Preflight target title drafts before a Lorecard model call so invalid title tags or anchors do not poison the prompt.
- Preserve valid Lorecards from a mixed-quality batch.
- Automatically retry only rejected titles, using smaller batches when useful.
- Treat an all-rejected micro-batch as a retryable unit instead of a silent no-op.
- Use deterministic local cleanup where safe before spending another provider call.
- Show clear draft rejection diagnostics in Deck Maker UI.
- Reduce noisy duplicate storage writes during multi-batch Creator runs.

## Non-Goals

- Do not relax schema v3 health requirements for final Lorecards.
- Do not auto-accept Lorecards into the generated pack. They still go through Deck Maker Draft Review and Pending Review.
- Do not bypass Context and Tag Planning. If title drafts depend on missing registry entries, Saga should either sanitize safe references or point to the planning gap.
- Do not make raw model output a normal user-facing surface.
- Do not parallelize Lorecard drafting by default.
- Do not store full model responses, full health reports, or full repair state in settings.

## Current Code Map

Primary files:

- `src/loredecks/loredeck-assistant.js`
  - Deck Maker Lorecard drafting prompt and payload contract.
- `src/runtime/lore-panel.js`
  - `requestLoredeckCreatorEntryResponse`
  - `repairLoredeckCreatorEntryResponse`
  - `validateLoredeckCreatorEntryDraftResult`
  - `buildLoredeckCreatorEntryDraftChanges`
  - `commitLoredeckCreatorEntryDraftResult`
  - `draftLoredeckCreatorEntryBatch`
  - `handleLoredeckCreatorEntryDraft`
  - `getLoredeckCreatorRetrySmallerConfig`
  - `retryLoredeckCreatorRecoverableUnit`
- `src/loredecks/loredeck-creator-entry-guard.js`
  - Strict Creator schema v3 draft guard.
- `src/loredecks/loredeck-schema-v3-entry-repair.js`
  - Deterministic tag and anchor repair helpers.
- `src/generation/generation-job-runner.js`
  - Shared unit lifecycle, retry, repair, parse, and commit flow.
- `src/storage/saga-creator-project-storage.js`
  - Deck Maker project persistence.
- `src/storage/saga-domain-storage.js`
  - Storage index persistence and domain write helpers.

Related planning docs:

- `docs/development/LOREDECK_CREATOR_BATCHING_ARCHITECTURE.md`
- `docs/development/SAGA_GENERATION_HARDENING_PLAN.md`
- `docs/development/LOREDECK_HEALTH_AUTO_FIX_SYSTEM_PLAN.md`
- `docs/development/LOREDECK_HEALTH_AUTO_FIX_STAGE_2_STORAGE_INTEGRATION_PLAN.md`

## Design Principles

- Provider success and Creator acceptance are separate states.
- Retry should be based on rejected target titles, not on the original whole batch.
- Deck Maker should keep every valid draft it can safely preserve.
- A title draft should never send an invalid registry reference to the Lorecard prompt as if it were allowed.
- The model should receive compact allowed reference lists, not contradictory "suggested but forbidden" references.
- All-rejected batches need typed errors, not generic empty results.
- User diagnostics should name the reason and affected titles, not just say "invalid schema v3 references."
- Storage writes should be durable at meaningful checkpoints, not duplicated for every small UI/cache refresh.

## Phase 1: Rejection Taxonomy and Diagnostics

Objective: make draft rejection reasons structured and visible.

Add a Deck Maker Lorecard rejection diagnostic shape:

```js
{
  targetTitleId: 'genzos-vigil-over-cocoyashi',
  targetEntryId: 'genzos-vigil-over-cocoyashi',
  stage: 'entry_micro_batch',
  phase: 'schema_guard',
  reasonCode: 'unknown_tag',
  message: 'Unknown tag location:cocoyashi.',
  unknownTags: ['location:cocoyashi'],
  unknownAnchors: [],
  retryable: true,
  safeLocalRepairAvailable: true
}
```

Tasks:

- Extend `buildLoredeckCreatorEntryDraftChanges` to return `rejectedTargets` and `rejectionDiagnostics`.
- Preserve the existing warning strings for compact UI display, but build them from structured diagnostics.
- Add diagnostic reason codes:
  - `unknown_tag`
  - `unknown_anchor`
  - `ambiguous_tag_reference`
  - `ambiguous_anchor_reference`
  - `outside_micro_batch`
  - `unsupported_action`
  - `missing_entry_payload`
  - `invalid_schema_shape`
  - `all_proposals_rejected`
- Store only compact diagnostics in Deck Maker generation state.
- Avoid storing raw model output in persistent Deck Maker project files.

Acceptance:

- A rejected draft can be traced to the exact title, entry ID, and guard reason.
- Deck Maker UI can say `Rejected 2 Lorecards: unknown tag location:cocoyashi` instead of a generic invalid schema message.
- Existing successful draft queueing behavior is unchanged for clean batches.

## Phase 2: Title Target Preflight

Objective: prevent invalid title draft references from entering the Lorecard prompt as allowed references.

Add a preflight helper near the Deck Maker entry drafting path:

```js
preflightLoredeckCreatorEntryTargets({
  targetTitles,
  tagRegistry,
  timelineRegistry,
  targetPlanningBatch,
  pack
})
```

For each target title, produce:

```js
{
  titleId,
  targetEntryId,
  title,
  suggestedTags,
  allowedEntryTags,
  omittedTitleTags,
  allowedAnchorIds,
  allowedWindowIds,
  planningGaps
}
```

Tasks:

- Compare `targetTitleDraft.tags` against `acceptedTagRegistry`.
- Put accepted tags in `allowedEntryTags`.
- Put missing tags in `omittedTitleTags`.
- Normalize compact/exact tag matches with the existing schema v3 repair helpers where deterministic.
- Do not include omitted tags in the prompt as normal title tags.
- Add a compact `planningGaps` field when a title draft depends on references not accepted by Context and Tag Planning.
- Pass preflighted targets to the Lorecard drafting prompt.
- Keep the original title semantics available as prose guidance, but clearly separate them from allowed IDs.

Prompt contract change:

- Replace ambiguous `targetTitleDrafts[].tags` usage with explicit fields:
  - `suggestedTags`: original title-stage hints, not safe to copy unless also allowed.
  - `allowedEntryTags`: the only tag IDs the model may emit.
  - `omittedTitleTags`: tags Saga removed because they are not accepted registry IDs.
- Add instruction: "Use only `allowedEntryTags` for each target. Do not copy `suggestedTags` or `omittedTitleTags` unless the same ID appears in `allowedEntryTags`."

Acceptance:

- A title draft with `location:cocoyashi` and no matching accepted tag sends that ID only in `omittedTitleTags`, never as an allowed entry tag.
- The model prompt no longer gives contradictory instructions where a target title contains a forbidden tag.
- Preflight diagnostics can identify planning gaps before a provider call is made.

## Phase 3: Deterministic Local Cleanup Before Rejection

Objective: safely repair simple registry-reference issues before spending another model call.

Tasks:

- Keep existing deterministic repairs:
  - compact/exact tag mapping.
  - compact/exact anchor mapping.
  - legacy field normalization.
  - generic tag dropping.
- Add a Creator-only safe cleanup rule for unknown tags:
  - If an unknown tag came from `omittedTitleTags`, remove it from the generated draft.
  - Only do this if the entry still has at least one accepted tag or the schema permits an empty tag list for that pack.
  - Add a quality warning to the draft preview naming the dropped tag.
- Do not silently drop unknown anchors.
- If a missing anchor can be deterministically normalized to one accepted anchor, repair it.
- If an anchor has multiple plausible replacements, reject the draft and route to retry or planning review.

Acceptance:

- A Lorecard that only repeats an invalid title-stage tag can still reach Deck Maker Draft Review after the tag is dropped.
- Unknown anchors remain strict unless deterministic repair is possible.
- Users can see that a tag was dropped before Draft Review.

## Phase 4: Partial Success Preservation

Objective: preserve valid drafts and retry only invalid targets.

Tasks:

- When a micro-batch contains mixed valid and invalid proposals, queue the valid `entry` changes immediately.
- Track rejected title IDs separately from queued title IDs.
- Update entry draft progress so queued valid drafts reduce the remaining count, while rejected titles remain pending.
- Ensure replacement logic only replaces the current unit's draft changes and does not remove unrelated Deck Maker Draft Review items.
- Add a compact result ref:

```js
{
  type: 'creator_entry_micro_batch',
  status: 'partial',
  draftCount: 2,
  rejectedCount: 1,
  rejectedTitleIds: ['genzos-vigil-over-cocoyashi']
}
```

Acceptance:

- If a 3-card batch has 2 valid drafts and 1 rejected draft, the 2 valid drafts appear in Deck Maker Draft Review.
- The rejected title remains pending and can be retried automatically.
- Re-running the failed unit does not delete previously queued valid drafts from a different unit.

## Phase 5: All-Rejected Batch Becomes Retryable

Objective: make `Retry attempts` meaningful for provider-successful but schema-rejected batches.

Current behavior to fix:

- The generation runner can treat a unit as complete after parsing and commit callback return.
- `commitLoredeckCreatorEntryDraftResult` can return `queued: false` when every proposal was rejected.
- That path should be considered a retryable Deck Maker entry drafting failure, not a successful empty unit.

Tasks:

- Add a typed Deck Maker generation error, tentatively:
  - `creator_entry_guard_rejected_all`
  - `creator_entry_guard_rejected_partial`
- In `commitParsedResult` for entry micro-batches:
  - If proposals exist and every relevant proposal was rejected by the schema guard, throw a retryable typed error.
  - Attach compact rejection diagnostics and target title IDs.
  - Preserve parse/repair diagnostics for the failure drawer.
- Teach the generation runner or Creator wrapper to classify this as retryable.
- Preserve current non-retry behavior for true clarifying-question responses.

Acceptance:

- A provider-successful response with all drafts rejected consumes retry attempts like other retryable generation failures.
- The recovery UI says the batch was rejected by schema guardrails, not that the provider returned no JSON.
- Retrying does not require the user to manually click `Retry Smaller` first.

## Phase 6: Automatic Smaller Retry and Target Splitting

Objective: make smaller-batch recovery the normal behavior, not a manual escape hatch.

Status: implemented for schema-guard rejection recovery. Rejected targets split into one-title retries, successful drafts are preserved, per-run attempted/exhausted target sets prevent repeated retries for the same bad title, and exhausted target IDs are excluded from later auto-draft batches in the same run.

Tasks:

- When `retrySmaller` is enabled and a micro-batch fails or is all-rejected:
  - If batch size is greater than 1, split rejected targets into smaller replacement units.
  - Prefer one-title units after a schema guard rejection.
  - Keep successfully queued drafts out of retry units.
- Reuse `getLoredeckCreatorRetrySmallerConfig` where possible, but make it target-aware.
- Add a retry limit per target title so one bad title cannot cause a provider loop.
- Add progress copy:
  - `Retrying 2 rejected Lorecards as smaller batches...`
  - `Retrying Genzo's vigil over Cocoyashi with stricter allowed tags...`
- If a one-title retry still fails because references are missing, surface a planning-gap diagnostic instead of continuing to call the model.

Acceptance:

- A failed 3-card micro-batch can automatically become three one-title retries.
- A title that keeps failing because of missing registry references stops with a clear planning-gap message.
- The manual `Retry Failed` and `Retry Smaller` buttons remain useful for explicit recovery, but are no longer the primary path.

## Phase 7: Prompt Hardening for Rejected Targets

Objective: improve retry quality after a schema guard rejection.

Status: implemented for rejected-target one-title retries. Rejection diagnostics now build compact retry context keyed by target entry ID; automatic smaller retries attach `targetTitleDraft.previousRejection` and a prompt-level `retryContext.previousRejections` payload. One-title retry prompts reduce the accepted tag registry to that target's `allowedEntryTags`. Title preflight also supports explicit title-bound timeline hints (`timelineAnchorIds`, `timelineWindowIds`, `anchorId`, `validFromAnchor`, `validToAnchor`, and related aliases); when those hints are present, one-title retries filter the accepted timeline registry to the accepted IDs and matching windows. Current generated title drafts do not carry per-title accepted timeline IDs by default, so those retry prompts correctly keep the full accepted timeline registry instead of guessing from prose labels.

Tasks:

- Add a compact retry context when a target is retried:

```js
{
  previousRejection: {
    reasonCode: 'unknown_tag',
    unknownTags: ['location:cocoyashi'],
    instruction: 'Do not emit omitted or unknown tags. Use only allowedEntryTags.'
  }
}
```

- For one-title retries, shrink context to:
  - approved brief summary.
  - target planning batch summary.
  - one target title.
  - accepted tag IDs needed for that title.
  - accepted timeline anchors/windows relevant to that title.
  - existing entry IDs.
- Keep the final-answer contract:
  - visible JSON only.
  - no markdown.
  - no hidden-reasoning-only response.
- Consider lowering or overriding max output for one-title retries if provider settings support it.

Acceptance:

- Retry prompts are smaller than the original batch prompt.
- Retry prompts explicitly mention prior invalid references.
- The model has fewer chances to copy forbidden IDs from the original title draft.

## Phase 8: Creator UX Cleanup

Objective: make the failure and recovery flow legible.

Status: implemented. The advanced generation toggle formerly labeled `Prefer smaller retries` is now `Auto split failed batches`, with tooltip copy that explicitly mentions Lorecard micro-batch failures and schema guardrail rejections. The Lorecards section now surfaces the last pass outcome, including queued Draft Review count, rejected draft count, affected target IDs, and compact warning detail. Deck Maker jobs now persist compact last-preflight and last-rejection summary/diagnostics, and the Lorecards section exposes non-raw `Last Lorecard preflight gaps` and `Last Lorecard rejection details` panels with reason counts, omitted or unknown references, affected targets, and compact guard messages. Preflight omissions now also attach to affected Deck Maker draft preview metadata and render as per-draft preflight notes in Deck Maker Lorecard Draft Review. Deterministic guard cleanup warnings attach separately and render as per-draft repair notes.

Tasks:

- In the Lorecards step, show a compact generation status when rejection recovery is active:
  - `Queued 2 drafts; retrying 1 rejected title.`
  - `Rejected 1 draft: unknown tag location:cocoyashi.`
- Update advanced generation setting labels:
  - Rename `Prefer smaller retries` to `Auto split failed batches`.
  - Keep tooltip copy precise: "When a Lorecard micro-batch fails or is rejected by schema guardrails, retry the affected titles in smaller batches."
- Add draft-review preview warnings for deterministic tag drops.
- Add a diagnostic action to view the last Deck Maker Lorecard rejection summary without raw provider output.
- Do not make users review a separate rejection list unless there are ambiguous choices.

Acceptance:

- Users can tell whether a provider call failed, Saga rejected draft references, or Saga is retrying.
- The UI does not imply a rejected draft was successfully queued.
- The settings language explains the behavior without sounding like a vague model preference.

## Phase 9: Storage Write Debouncing

Objective: reduce noisy repeated Deck Maker project and index writes during draft runs.

Status: implemented for live active-generation progress writes. `setLoredeckCreatorBriefCache` can opt into Deck Maker project storage write coalescing with `coalesceStorageWrite`; ticker and stream/progress updates use it, while generation start and runner run/unit checkpoints keep immediate writes. Deck Maker project persistence now also preserves explicit `activeGeneration`/`lastGenerationResult` clears and removes stale compact index task fields when a run is superseded or finished.

Observed console pattern:

- The Arlong Park console clip showed repeated uploads:
  - `saga-storage-index.v1.json`
  - `saga-creator-index.v1.json`
  - the active Deck Maker project file

Tasks:

- Audit Deck Maker generation progress and cache writes during `handleLoredeckCreatorEntryDraft`.
- Identify duplicate writes that happen inside the same UI refresh or generation checkpoint.
- Add a narrow write coalescing helper for Deck Maker project storage, tentatively:

```js
withCreatorProjectWriteBatch(projectId, async () => {
  // multiple project/index state updates
});
```

- Preserve durable checkpoints before and after provider calls.
- Coalesce synchronous or redundant writes between meaningful checkpoints.
- Do not reduce stale-write protection or active-run checkpoint reliability.
- Regression coverage lives in `tools/scripts/test-saga-creator-project-storage.mjs`; a burst of three coalesced updates persists the first write and the latest pending write, not all intermediate progress states.

Acceptance:

- A single Lorecard micro-batch does not upload the storage index dozens of times.
- Provider-call boundaries still have durable Creator run state.
- Failed or cancelled runs can still reopen with accurate status.

## Phase 10: Verification

Objective: prove the recovery behavior without requiring live provider calls.

Status: implemented and verified on 2026-06-13. The focused Deck Maker Lorecard rejection-recovery tests and Deck Maker project storage coalescing regression are registered in `tools/scripts/run-alpha-gate.mjs`, and the full alpha gate passes with those tests included.

Current verification:

```powershell
node tools/scripts/test-loredeck-creator-entry-preflight.mjs
node tools/scripts/test-loredeck-creator-entry-rejection-recovery.mjs
node tools/scripts/test-saga-creator-project-storage.mjs
node tools/scripts/test-loredeck-assistant.mjs
node tools/scripts/test-loredeck-health-attempt-fixing.mjs
node tools/scripts/test-loredeck-health-attempt-fixing-model-continuation.mjs
node tools/scripts/run-alpha-gate.mjs
```

Add focused tests:

- `tools/scripts/test-loredeck-creator-entry-preflight.mjs`
  - invalid title tags are moved to `omittedTitleTags`.
  - allowed entry tags contain only accepted registry IDs.
- `tools/scripts/test-loredeck-creator-entry-rejection-recovery.mjs`
  - unknown title-sourced tag is dropped when safe.
  - unknown anchor rejects the draft.
  - mixed valid/invalid batch queues valid drafts and returns rejected target diagnostics.
  - all-rejected batch throws a retryable typed error.
  - rejected targets are split for smaller retry when enabled.
- `tools/scripts/test-saga-creator-project-storage.mjs`
  - repeated cache updates inside a generation checkpoint do not create duplicate storage-index writes.
  - provider-boundary checkpoints still persist.
- Extend existing generation hardening coverage:
  - provider token limit remains distinct from schema guard rejection.
  - reasoning-only remains distinct from schema guard rejection.
  - malformed JSON still uses the repair path before retry.
- Extend visual smoke coverage:
  - Deck Maker Lorecards step shows rejection recovery status text.
  - advanced settings label and tooltip are present.

Run before completion:

```powershell
node tools/scripts/test-loredeck-creator-entry-preflight.mjs
node tools/scripts/test-loredeck-creator-entry-rejection-recovery.mjs
node tools/scripts/test-saga-creator-project-storage.mjs
node tools/scripts/test-loredeck-assistant.mjs
node tools/scripts/test-loredeck-health-attempt-fixing.mjs
node tools/scripts/run-alpha-gate.mjs
```

If the final implementation touches shared storage or generation runner behavior, also run the storage and generation hardening tests listed in `SAGA_STORAGE_REWORK_DESIGN.md` and `SAGA_GENERATION_HARDENING_PLAN.md`.

## Implementation Order

Recommended sequence:

1. Add preflight helper and tests.
2. Update the Lorecard prompt payload to use `allowedEntryTags` and `omittedTitleTags`.
3. Add structured rejection diagnostics in `buildLoredeckCreatorEntryDraftChanges`.
4. Add deterministic Creator-only unknown-tag cleanup.
5. Make all-rejected batches throw a retryable typed error.
6. Add target-aware automatic smaller retry.
7. Add UI status copy and settings label cleanup.
8. Add storage write coalescing.
9. Run focused tests, then alpha gate.

This order keeps the early work low risk: prompt inputs become cleaner before retry behavior changes, and typed rejection metadata exists before the automatic splitting path consumes it.

## Resolved Questions

- Planning-gap follow-up behavior: resolved for this phase as diagnostic-only. The Lorecards step now persists and surfaces compact preflight gaps, but does not create another review queue or planning batch automatically.
- Title-sourced omissions in Draft Review: resolved. Batch-level preflight gaps show what was omitted before the model call, and affected Deck Maker draft rows show per-draft preflight notes before Pending Review.
- One-title retry provider: resolved as opt-in. Split retries use the Reasoning Provider by default; `Use Utility for split retries` can route one-title schema-rejection retries through the Utility Provider when configured, with automatic fallback to Reasoning when Utility is unavailable.
- Repeated storage upload counts: resolved as an internal regression assertion. State Safety should stay focused on storage risks users can act on, such as missing indexed files, pending writes, and runtime storage errors. Creator upload-count noise is covered by `tools/scripts/test-saga-creator-project-storage.mjs`, where coalesced progress bursts must persist the first checkpoint and latest pending update without uploading every intermediate state.

## Completion Criteria

This feature is complete when:

- Invalid title-stage references no longer poison Lorecard prompts.
- Valid Lorecards in a mixed batch are preserved.
- All-rejected schema-guard batches retry automatically when retry attempts remain.
- Smaller retry splits affected target titles without user intervention.
- Persistent failure stops with a clear planning-gap or schema diagnostic.
- Users can see exactly why drafts were rejected.
- Storage writes during Deck Maker Lorecard runs are meaningfully quieter.
- Focused regression tests and the alpha gate pass.
