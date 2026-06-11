# Loredeck Creator Batching Architecture

Status: Phase 11 implemented. The Creator generation architecture now has dedicated regression coverage for duplicate-click dedupe, late/superseded responses, interrupted reopen recovery, token-limit retry, and partial success preservation.

## Purpose

Saga's Loredeck Creator must stop relying on large single model calls. Reasoning models can spend most of an 8k response budget on hidden or visible thinking, then return truncated JSON, no titles, or no usable outline. Users can also accidentally launch duplicate calls, leave the Creator while a call is running, and later receive late duplicate results.

The correct direction is a fresh Creator batching design that reuses the proven mechanics from Scan Story Lore:

- Small bounded provider calls.
- Durable job state.
- Per-batch checkpoints.
- Retry and repair behavior.
- Partial success preservation.
- Interrupted-run recovery.
- UI state that survives closing and reopening the Creator.

The Creator should not directly call the story-scan bulk engine. Story scan chunks are chat-message ranges. Creator chunks are planned creation units: scope brief, story outline, title batches, Context/tag planning batches, and Lorecard micro-batches.

## Goals

- Make every Creator model call small enough to finish inside modest max-token limits.
- Prevent duplicate button presses from launching duplicate calls for the same work unit.
- Preserve every successful batch immediately.
- Make late provider responses idempotent so they cannot append duplicate titles or proposals.
- Let users leave and reopen the Creator while a generation call is running.
- Support cancel, retry failed batch, rerun selected batch, and run remaining batches.
- Keep the Creator guided for novice users.
- Give advanced users a default-collapsed settings panel for batch sizing and generation behavior.
- Keep all generated content reviewable before it affects runtime injection.
- Reuse existing provider, streaming, retry, repair, and checkpoint concepts without forcing Creator work into chat-scan semantics.

## Non-Goals

- Do not parallelize Creator calls by default.
- Do not generate an entire Loredeck in one provider response.
- Do not bypass Scope Brief, Story Outline, Title Pass, Context/Tag Planning, Lorecard Draft Review, Pending Review, or Deck Health.
- Do not make raw model output a persistent UI surface.
- Do not expose token math as a required user-facing configuration.
- Do not force streaming on unless it provides useful progress feedback in the UI.

## Existing Systems To Reuse

### Provider Client

`lore-llm-client.js` already provides:

- Reasoning/Utility provider selection.
- OpenAI-compatible and SillyTavern profile dispatch.
- Streaming progress hooks.
- Reasoning-only retry prompts.
- Token-limit finish-reason detection.
- Abort signal support.

The Creator should use this directly.

### Story Scan Patterns

`lore-generator.js` and `state-manager.js` already demonstrate:

- Bulk plan construction.
- Stable chunk IDs.
- Running/retrying/complete/failed/interrupted statuses.
- Immediate lightweight chunk checkpoints.
- Periodic full checkpoints.
- Partial result consolidation.
- Failed chunk retry.
- Stale running chunk recovery.

These patterns should be extracted into a shared runner layer instead of copy-pasted into Creator-specific code.

### Pending Review

The Creator should continue using the existing Loredeck Pending Review and draft-review pipeline. Generated planning and Lorecard content should remain proposals until the user accepts them.

## Proposed Shared Layer

Add a UI-free shared generation job module, tentatively:

```text
generation-job-runner.js
```

It should not know about chat messages, Loredecks, or Lorecards. It should run generic units of work.

### Core Concepts

`generationJob`

```json
{
  "jobId": "creator_one_piece_arlong",
  "kind": "loredeck_creator",
  "status": "running",
  "activeRunId": "run_...",
  "lastRunId": "run_...",
  "createdAt": 0,
  "updatedAt": 0
}
```

`generationRun`

```json
{
  "runId": "run_creator_one_piece_arlong_titles_...",
  "jobId": "creator_one_piece_arlong",
  "kind": "loredeck_creator",
  "stage": "titles",
  "status": "running",
  "mode": "run_next",
  "totalUnits": 4,
  "completedUnits": 1,
  "failedUnits": 0,
  "createdAt": 0,
  "updatedAt": 0
}
```

`generationUnit`

```json
{
  "unitId": "creator_one_piece_arlong:titles:characters_pressure",
  "runId": "run_...",
  "jobId": "creator_one_piece_arlong",
  "stage": "titles",
  "status": "complete",
  "attempts": 1,
  "inputHash": "stable-hash",
  "outputHash": "stable-hash",
  "resultRef": {
    "type": "creator_title_batch",
    "batchId": "characters_pressure"
  },
  "error": "",
  "createdAt": 0,
  "updatedAt": 0
}
```

### Runner Responsibilities

- Accept a list of units.
- Lock active unit execution by `jobId + stage + unitId`.
- Run units sequentially by default.
- Optionally support bounded concurrency later.
- Checkpoint unit status before and after provider calls.
- Retry retryable failures.
- Call a stage-specific repair function when parsing fails.
- Commit successful results through a stage-specific `commitResult` callback.
- Ignore late responses when the generation ID was cancelled or superseded.
- Return a structured summary to the UI.

### Runner API Sketch

```js
runGenerationUnits({
  jobId,
  kind: 'loredeck_creator',
  stage: 'titles',
  mode: 'run_next',
  units,
  concurrency: 1,
  retryAttempts: 1,
  signal,
  onProgress,
  callUnit,
  parseResult,
  repairResult,
  commitResult,
  shouldSkipUnit,
});
```

The runner controls lifecycle. The Creator supplies domain-specific behavior.

## Creator Batch Model

### Stage 1: Scope Brief

Unit count: one.

Stable unit ID:

```text
{jobId}:scope:{inputHash}
```

The brief is already compact. It should still use the shared runner so UI state, locking, cancellation, and retry behavior are consistent.

Commit rule:

- Replace the unapproved brief draft for the current job.
- Do not duplicate brief drafts.
- Mark `briefDraftedAt`.

### Stage 2: Story Outline

Unit count: normally one.

Stable unit ID:

```text
{jobId}:outline:{approvedBriefHash}
```

The outline should remain compact and reviewable. If this still fails for broad scopes, the retry prompt should force stricter limits, such as fewer beats, fewer Context milestones, and fewer title batches.

Commit rule:

- Replace the unapproved outline draft for the current approved brief hash.
- Preserve approved outline unless the user explicitly redrafts it.
- Mark `outlineDraftedAt`.

### Stage 3: Title Pass

Unit count: one per approved Story Outline title batch.

Stable unit ID:

```text
{jobId}:titles:{titleBatchId}:{approvedOutlineHash}
```

Each unit asks for titles only for one `targetTitleBatch`.

Commit rule:

- Upsert title drafts by `titleId`.
- Record `creatorTitleBatchId`.
- Mark `titleBatchDraftedIds`.
- Store the title batch input hash.
- If the same unit completes twice, replace that batch's drafts or ignore exact duplicates. Never append duplicates.

Recommended default:

- `titlePassLimit`: 6-10 titles per batch depending on granularity.
- Creator concurrency: 1.
- Button labels: `Generate Next Title Batch`, `Generate Remaining Title Batches`.

### Stage 4: Context And Tag Planning

Unit count: one per approved title batch or selected title set.

Stable unit ID:

```text
creator_planning_batch:{planningBatchId}:{approvedTitlesHash}
```

Each unit receives:

- Approved brief.
- Approved outline.
- One target planning batch.
- Approved titles for that batch only.
- Existing timeline IDs.
- Existing tag IDs.

Commit rule:

- Create Pending Review proposals for anchors/windows/tags.
- Upsert proposal records by stable proposal ID.
- Replace existing Pending Review proposals for the same Creator planning batch before adding the new batch slice.
- Record `planningBatchQueuedIds`.
- Do not apply proposals until Pending Review acceptance.
- If exact unit output arrives late, dedupe by proposal ID and batch marker.

### Stage 5: Lorecard Drafting

Unit count: one per Lorecard micro-batch, usually 1-3 titles.

Stable unit ID:

```text
creator_entry_micro_batch:{planningBatchId}:{titleIdHash}
```

Each unit receives:

- Approved brief.
- Target planning batch.
- Accepted timeline registry.
- Accepted tag registry.
- Only the current `targetTitleDrafts`.
- Existing entry IDs.

Commit rule:

- Store proposals in Creator Lorecard Draft Review, not Pending Review directly.
- Upsert draft-review records by stable Creator entry draft IDs.
- Replace existing draft-review records for the same micro-batch unit before adding the new batch slice.
- Mark drafted title IDs with the micro-batch unit ID that produced them.
- Do not draft more entries while draft-review proposals are unresolved unless the user explicitly drops or queues them.

Recommended default:

- `entryBatchLimit`: 3.
- `Run Remaining Lorecard Batches` should stop when any batch fails, asks clarification, or creates non-empty draft-review items.
- If a batch creates drafts, the UI must visibly acknowledge the new draft-review items before stopping: update the draft count, show the new draft cards or a compact `new drafts ready` row, and expose a clear `Review Drafts` action.
- Do not silently continue Lorecard drafting while the draft-review queue is non-empty. Review is the safety boundary for full Lorecard content.

### Stage 6: Deck Health And Finalize

No model batching is required.

Health should run after accepted generated content changes. Generated-to-Custom finalization should remain blocked until unresolved draft, pending, and health issues are cleared or explicitly acknowledged where allowed.

## State Placement

Short term: store Creator run/unit data inside each Creator job in `state.loredeckCreator.jobs[jobId]`.

Recommended fields:

```json
{
  "generationRuns": {},
  "generationUnits": {},
  "activeGeneration": {
    "id": "run_or_unit_id",
    "runId": "run_...",
    "unitId": "creator_one_piece_arlong:titles:characters_pressure",
    "stage": "titles",
    "label": "Generating title batch 1 of 4",
    "status": "running",
    "startedAt": 0,
    "updatedAt": 0
  },
  "completedUnitIds": [],
  "failedUnitIds": [],
  "cancelledUnitIds": []
}
```

Long term: if more Saga systems need this runner, move generic ledgers to:

```text
state.generationJobs
```

The first implementation can avoid a broad state migration by keeping generic runner records under Creator jobs and extracting later.

## Idempotency Rules

Every Creator unit needs deterministic identity and deterministic result merging.

Required checks:

- Same `unitId` cannot run twice simultaneously.
- A unit that is `running` must disable related buttons.
- A late result whose generation ID is no longer active should be ignored unless its unit is still marked running/retrying.
- A completed unit with the same `inputHash` and `outputHash` should be ignored.
- A completed unit with the same `inputHash` but different `outputHash` should only replace its previous unit output if the user requested redraft/retry.
- Title drafts dedupe by `titleId`.
- Planning proposals dedupe by proposal ID/action/target ID.
- Entry drafts dedupe by `entryId`.

This is the main fix for duplicate title dumps caused by repeated button presses and late model responses.

## Token Strategy

Batching is the primary solution. Max-token overrides are secondary.

Recommended policy:

- Scope Brief: 1024-1536 output tokens.
- Story Outline: 2048-4096 output tokens.
- Title Batch: 2048-4096 output tokens, no more than 6-10 titles.
- Planning Batch: 2048-4096 output tokens, no more than 8-16 proposals.
- Lorecard Micro-Batch: 4096-6144 output tokens, no more than 3 entries.

Do not blindly force 16k for all Creator calls. That masks over-broad prompts, costs more, and still fails on providers/models with lower real limits or heavy reasoning overhead.

### Advanced Batch Settings

Novice users should not need to understand batch sizing, but advanced users should be able to tune it.

Add a default-collapsed `Advanced Generation Settings` disclosure in the Creator, similar in spirit to Story Lore Scan settings. It should include:

- Title batch size / title limit per model call.
- Planning proposal limit per model call.
- Lorecard micro-batch size.
- Run-remaining call limit.
- Retry attempts.
- Retry smaller behavior.
- Streaming progress toggle.

Implemented defaults are conservative:

- Title batch limit: 8.
- Planning proposal limit: 12.
- Lorecard micro-batch size: 3.
- Run-remaining call limit: 5.
- Retry attempts: 1.
- Retry smaller: on.
- Streaming progress: on because Creator status uses short transient snippets as the live progress surface.

Implemented behavior:

- Settings are saved on the active Creator project as `generationSettings`.
- Scope Brief, Story Outline, Title Pass, Context/Tag Planning, and Lorecard Drafting share the configured retry count through the generation runner.
- Title Pass uses `titleBatchLimit` for title count and `titleRunRemainingLimit` for `Generate Remaining`.
- Context/Tag Planning uses `planningProposalLimit`.
- Lorecard Drafting uses `entryBatchSize` for micro-batches and `entryRunRemainingLimit` for Auto-Draft.
- The streaming toggle controls whether provider calls request live snippets; completed raw output is still not rendered.
- The `retrySmaller` preference is persisted for explicit Retry Smaller controls and future automatic retry behavior.

The UI copy should frame these as performance/reliability controls, not required creative choices.

When a token-limit failure is detected:

1. Mark the unit failed with a retryable reason.
2. Offer `Retry Smaller`.
3. Automatically reduce the unit size if possible.
4. Use repair only when a partial usable response exists.
5. Preserve already completed units.

## UI Behavior

The Creator should feel like a guided queue, not a field-heavy tool.

Required behavior:

- One primary action per current stage.
- Clear disabled/running state on buttons.
- Status row under any model-call button.
- Running state survives closing and reopening the Creator.
- No scroll snapping after generation, approval, retry, cancel, or refresh.
- Raw model output is not rendered after completion.
- Progress text should show stage and unit, such as `Generating title batch 2 of 5`.
- `Run Remaining` should clearly say it runs separate calls and stops for review/failure.
- `Run Remaining` should update visible progress after every completed unit: completed count, failed count, current unit label, and any new review items created.
- If a completed unit creates a non-empty draft-review queue, stop the run, show the new draft count/cards/CTA, and require user review before more Lorecard batches run.
- Advanced batch settings should be available but collapsed by default.

Suggested controls:

- `Generate Next`
- `Generate Remaining`
- `Retry Failed`
- `Retry Smaller`
- `Cancel`
- `Review Drafts`

Avoid:

- Multiple per-batch buttons that can all be clicked at once.
- Ambiguous `Queue Draft` labels.
- Hidden background generation that continues after the UI appears idle.

## Streaming Status

Streaming should be used for reassurance, not as a content surface.

Default policy:

- Streaming snippets should be disabled by default unless we are actively using the stream to show meaningful progress.
- If the implementation uses streaming to drive real progress feedback under the active generation button, the setting can default on.
- If streaming only shows decorative snippets and does not improve user understanding of progress, default it off.
- The advanced settings panel should include a `Show streaming progress snippets` toggle.
- If future work can populate review cards incrementally from validated partial JSON, streaming can become more prominent. Until then, final parsed batch commits remain the source of truth.

Keep:

- Phase/status messages.
- Elapsed time.
- Received visible character count.
- Maybe one short transient snippet while running.

Remove:

- Persistent raw output boxes after completion.
- Long generated JSON previews below model-call status.

If snippets are shown, they should be temporary and replaced by parsed review UI when the unit finishes.

## Stale And Interrupted Recovery

The Creator can be closed, reopened, or reloaded while a provider request was previously marked active. On open:

- If the active generation still has a live in-memory generation record and controller, keep it running and restart the status ticker.
- If the saved `activeGeneration` has no matching live generation/controller, treat it as interrupted.
- Mark the matching `generationRuns[runId]` and `generationUnits[unitId]` as `interrupted` when available.
- Clear `activeGeneration` so buttons unlock.
- Preserve completed title batches, planning proposals, draft-review Lorecards, Pending Review items, and generated deck data.
- Write `lastGenerationResult.status = "interrupted"` so the user sees what happened instead of a silent reset.

Do not retry automatically on open. The user should decide whether to rerun the current stage, retry smaller, revise inputs, or continue reviewing already-created outputs.

## Failure Handling

Failure should be unit-local.

Statuses:

- `queued`
- `running`
- `retrying`
- `complete`
- `failed`
- `cancelled`
- `interrupted`
- `superseded`

Failure classes:

- `provider_error`
- `token_limit`
- `empty_visible_output`
- `parse_failed`
- `no_usable_items`
- `clarification_required`
- `cancelled`
- `interrupted`

Recovery actions:

- Retry same unit.
- Retry smaller unit.
- Redraft selected unit.
- Skip unit.
- Ask clarification.
- Cancel run.

Implemented recovery behavior:

- Each Creator unit stores compact `meta` for the target stage, batch/window, selected title IDs, and effective batch/proposal limits.
- `Retry Failed` reruns the latest failed/interrupted unit with the same unit ID so the checkpoint replaces the failed status.
- `Retry Smaller` creates a new retry unit ID with a smaller request size, then marks the older failed unit `superseded` once the replacement unit exists.
- Smaller retry is available for Title Pass batches, Context/Tag planning, and Lorecard micro-batches.
- Scope Brief and Story Outline can retry the failed unit, but they do not expose Retry Smaller because they are not currently split into reducible units.
- Active generations still show `Cancel Generation` in the current task action bar and `Cancel` in the active status row.

## Implementation Slices

1. Done: Create `generation-job-runner.js` with generic sequential unit execution, lifecycle statuses, progress callback wiring, and cancellation checks.
2. Done: Add Creator job fields for `generationRuns`, `generationUnits`, and active unit tracking.
3. Done: Migrate Scope Brief and Story Outline calls to the runner without changing output behavior.
4. Done: Migrate Title Pass to unit-based execution and idempotent upsert by title batch.
5. Done: Replace multiple title batch buttons with guided `Generate Next` / `Generate Remaining`.
6. Done: Migrate Context/Tag Planning to unit-based execution and idempotent Pending Review proposal creation.
7. Done: Migrate Lorecard Drafting to runner-managed micro-batches and idempotent draft-review writes.
8. Done: Add stale/interrupted active-generation recovery when the Creator opens.
9. Done: Add the default-collapsed Advanced Generation Settings panel for batch limits, run-remaining limits, retry behavior, and streaming progress.
10. Done: Add `Retry Failed`, `Retry Smaller`, and `Cancel` controls.
11. Done: Add tests for duplicate clicks, late responses, interrupted reopen, token-limit retry, and partial success preservation.
12. Next: Run provider-backed Creator QA in SillyTavern and use the results to tune batch-size defaults, retry copy, and any remaining stage-specific status text.

## Test Plan

Unit tests:

- Runner executes units sequentially.
- Runner blocks duplicate active unit.
- Cancel marks active unit cancelled and ignores late commit.
- Failed unit preserves completed units.
- Retry smaller creates a new superseding unit ID or revision counter.
- Completed title unit cannot append duplicate titles.
- Completed planning unit cannot append duplicate proposals.
- Completed entry unit cannot append duplicate draft Lorecards.
- `tools/scripts/test-loredeck-creator-generation-recovery.mjs` exercises Creator-specific regression paths:
  - duplicate unit IDs from repeated clicks run only one provider call;
  - superseded late responses do not commit;
  - interrupted reopen state clears `activeGeneration` while preserving failed unit metadata;
  - token-limit retry checkpoints `retrying` and completes on the next attempt;
  - partial runs preserve completed units and failed-unit metadata in the same Creator job.

Integration tests:

- Creator Scope Brief still drafts and approves.
- Story Outline parsing fills the UI.
- Title Pass runs one outline batch per call.
- `Generate Remaining` uses separate calls.
- `Generate Remaining` stops when Lorecard draft-review items appear and visually advertises the new review work.
- Closing and reopening Creator preserves running state.
- Token-limit error surfaces as retryable and does not wipe previous batches.
- Review queues remain the only path to activation.

Visual tests:

- Buttons show running/disabled state.
- Status row updates under the active action.
- No raw output box remains after completion.
- Advanced generation settings are collapsed by default.
- Streaming snippets are hidden by default unless enabled or used for meaningful progress feedback.
- No scroll snap after generation or approval.
- Failed unit shows a clear retry action.

## Resolved Decisions

- `Run Remaining` should continue across separate calls until the draft-review queue becomes non-empty, a unit fails, a unit asks for clarification, the configured call limit is reached, or the stage is complete.
- When a Lorecard batch creates draft-review items, Saga should stop and visually surface those drafts instead of continuing silently.
- Users should have a default-collapsed advanced settings dropdown for batch sizes and generation behavior.
- Streaming snippets should default on only if streaming is actually used to show meaningful progress; otherwise snippets default off and remain user-configurable.

## Open Decisions

- Should generic generation ledgers remain embedded under Creator jobs for alpha, or move immediately to `state.generationJobs`?
- Can we eventually parse streaming JSON safely enough to populate draft cards incrementally, or should cards always wait for final parsed batch commits?

## Recommendation

Build the shared runner now, but keep the first storage implementation inside Creator jobs. That gets the benefits of durable batching and idempotent writes without a broad state migration. Once the Creator is stable, the same runner can be used by story Lorecard generation and other Saga model-assisted workflows.
