# Loredeck Health Auto-Fix Stage 2: Storage Integration

Status: Phase 1 storage adapter, Phase 2 repair session persistence/lifecycle cleanup, Phase 3 Health Center UX cleanup, Phase 4 local Attempt Fixing core, Phase 5 model repair runner/session continuation/current-run guard/cancellation controls/retry-smaller hardening, the Phase 6 review-choice application and UX slices, Phase 7 Creator/Pending Review cleanup, Phase 8 legacy route removal, and the automated Phase 9 Verification slice are complete. The storage rework has stable external Lorepack payload APIs, the first storage-backed health repair adapter slice is in place, repair sessions can be written as compact storage-indexed JSON files, the main Health Center repair action now reads as `Attempt Fixing`, the shared editor command routes through storage-backed repair, model repair units can now run through a provider-injected batch runner that applies validated direct patches and persists compact progress, saved model-pending sessions can be continued or cancelled from the Health Center, same-pack repair commands are guarded against overlapping storage/model runs, truncated model repair output can retry with a smaller one-target prompt, saved review choices can now be applied or re-evaluated through the same storage-backed validator, saved review choices now show inline storage-change previews plus non-destructive skip controls, finished repair sessions expose clearable lifecycle state in the Health Center, Creator final readiness now blocks on compact saved health errors or stale health even when a full health report is not cached in the Creator panel, and automated verification covers the storage-backed repair workflow.

Stage 2 begins after the storage rework has stable external Lorepack payload APIs and the Stage 1 repair foundation exists. Stage 2 wires the pure planner, repair, model, and validation modules into real Pack Health, external payload writes, repair sessions, Health Center UI, Creator final readiness, and provider-backed model repair batches.

## Prerequisites

Do not begin Stage 2 until these are true:

- `SAGA_STORAGE_REWORK_DESIGN.md` has reached stable Lorepack payload storage APIs.
- Custom, generated, and imported Lorepacks can be loaded from external payload files.
- Pack Health can validate an external payload-backed pack.
- Pack payload mutations have a single storage service path.
- Library index health summaries can be updated without embedding full health reports in settings.
- Optional repair session files are supported or explicitly deferred.
- Stage 1 modules and tests are present or the Stage 1 plan is completed in the same branch first.

Expected storage adapter functions, names subject to final storage implementation:

```js
loadPackPayload(packId)
runPackHealth(packIdOrPayload, options)
applyPackRepairPatch(packId, patchSet, options)
writeRepairSession(session)
deleteRepairSession(sessionId)
updatePackHealthSummary(packId, summary)
refreshPackSurfaces(packId)
createRepairBackup(packId, details)
```

If storage exposes different names, create a thin health repair adapter instead of changing Stage 1 pure modules.

Stage 1 patch operations currently include `refresh_manifest_stats`. The Stage 2 adapter should translate that operation into the storage layer's manifest stats write, updating `stats.entryCount` and `stats.categoryCounts` in the external pack payload and then rerunning Pack Health before updating library summaries.

## Goal

Ship the real `Attempt Fixing` workflow:

- User clicks `Attempt Fixing`.
- Saga refreshes Pack Health.
- Saga plans local, model, choice, and manual-only repairs.
- Saga applies deterministic fixes through the storage service.
- Saga treats missing schema v3 content with safe alias text as local repair before model batches.
- Saga treats missing or incomplete schema v3 retrieval on otherwise valid entries as local repair before model batches.
- Saga reruns Pack Health.
- Saga runs reasoner repair batches for remaining eligible issues.
- Saga directly applies only validated unambiguous model patches.
- Saga shows `Review Choices` only for ambiguity.
- Saga stores user dispositions such as `Accept As-Is` in the external pack payload.
- Saga stores active repair session state outside settings.
- Saga updates Creator final readiness and Library/Workbench health surfaces.

## Storage Rules

Stage 2 must follow the storage design:

- Do not write full pack payloads to `settings.json`.
- Do not store full health reports in settings.
- Do not store model repair batch payloads in settings.
- Health repairs mutate external pack payload files through the storage service.
- Repair sessions use optional `saga-repair-session-<packId>-<sessionId>.v1.json` files only while active or while review choices remain.
- Completed repair sessions are summarized and deleted unless diagnostics are explicitly saved.
- `Accept As-Is` issue dispositions live in the pack payload.
- `Verify Fixed` reruns Pack Health and clears stale issue state only when the finding disappears.

## Phase 1: Storage Adapter

Objective: connect Stage 1 pure modules to the external storage service.

Tasks:

- Add a health repair storage adapter module.
- Implement pack payload loading for repair.
- Implement Pack Health refresh for repair checkpoints.
- Implement transactional patch application through the storage service.
- Implement repair backup creation.
- Implement health summary update in the library index.
- Implement surface refresh after repair writes.
- Normalize storage errors into repair diagnostics.

Acceptance:

- Adapter tests can load a pack, apply a no-op patch to a cloned or test payload, and rerun Pack Health.
- Failed writes do not update health summary.
- Repair code does not call legacy settings-backed persistence directly.

Implemented first slice:

- `src/loredecks/loredeck-health-repair-storage-adapter.js`
  - `loadPackPayload(packId, options)`
  - `runPackHealth(packOrId, options)`
  - `updatePackHealthSummary(packId, health, options)`
  - `applyPackRepairPatch(packId, patch, options)`
  - `applyPackRepairPatches(packId, patches, options)`
- The adapter loads compact external Library rows, hydrates payload files, runs Pack Health against payload data, validates Stage 1 patches with patch-scoped findings/buckets, applies direct patches to the external payload shape, writes through `upsertExternalLorepackPayloadSync()`, and updates the compact Library row through `upsertExternalLoredeckLibraryRecordSync()`.
- The adapter does not write settings, does not store full health reports, and does not wire UI buttons.
- Focused coverage lives in `tools/scripts/test-loredeck-health-repair-storage-adapter.mjs`.

Phase 1 closeout notes:

- Explicit repair backups are deferred to compact repair sessions plus external payload stale-write protection; no separate full-payload backup file is part of Stage 2.
- Surface refresh is owned by the shared editor action layer after storage writes flush, not by the storage-neutral adapter.
- A provider-neutral transaction ledger is not needed for Stage 2 because repair sessions store compact progress, applied patch IDs, diagnostics, and remaining work without storing full payloads or raw model output.

## Phase 2: Repair Session Persistence

Objective: make long repair runs resumable without bloating settings.

Tasks:

- Define repair session file schema using Stage 1 result contracts.
- Persist active run status, batch unit status, before/after summaries, diagnostics, and choice sets.
- Register repair session files in the storage index.
- Delete completed sessions after compact summary is stored, unless diagnostics are saved.
- Recover interrupted sessions on Health Center open.
- Handle missing or corrupt session files with clear diagnostics.

Acceptance:

- Closing and reopening the Health Center can show active or needs-review repair state.
- Completed sessions do not leave large stale files by default.
- Missing session files do not corrupt pack payloads.

Implemented first slice:

- `src/loredecks/loredeck-health-repair-session-storage.js`
  - `configureLoredeckHealthRepairSessionStorage(options)`
  - `createLoredeckHealthRepairSession(input, options)`
  - `normalizeLoredeckHealthRepairSession(input, options)`
  - `buildLoredeckHealthRepairSessionFileName(packId, sessionId, options)`
  - `buildLoredeckHealthRepairSessionPath(packId, sessionId, options)`
  - `writeLoredeckHealthRepairSession(session, options)`
  - `readLoredeckHealthRepairSession(packIdOrPath, sessionIdOrOptions, options)`
  - `listLoredeckHealthRepairSessions(packId, options)`
  - `deleteLoredeckHealthRepairSession(sessionOrPackId, sessionIdOrOptions, options)`
  - `buildLoredeckHealthRepairSessionLifecycle(session)`
  - `cleanupLoredeckHealthRepairSessions(packId, options)`
- Sessions use `saga-repair-session-<packId>-<sessionId>.v1.json` files under `/user/files/`.
- Session files are registered in the master storage index as `loredeck_health_repair_session` records in the `library` domain with `delete_with_owner` deletion.
- The normalized session schema stores compact run summaries, remaining choice/model/manual work, diagnostics, and applied patch IDs. It intentionally excludes full pack payloads and full health reports.
- Session storage can now be configured with the same file API/runtime options as the external payload and library stores, so editor-driven `Attempt Fixing` can save model-pending sessions in storage-backed tests and runtime surfaces.
- `attemptLoredeckHealthFixes(packId, { persistSession: true })` now writes a session when remaining work exists. Clean completed sessions are not persisted unless `persistCompletedSession: true` is passed.
- Session listing now uses the master storage index to find `loredeck_health_repair_session` files owned by a pack, reads valid sessions, and reports corrupt/missing session files as diagnostics without mutating pack payloads.
- Saved model-pending sessions now have a Health Center continuation action backed by the shared model runner.
- Focused coverage lives in `tools/scripts/test-loredeck-health-repair-session-storage.mjs`, with additional model-pending session coverage in `tools/scripts/test-loredeck-health-attempt-fixing.mjs`.

Implemented lifecycle polish slice:

- Repair sessions now carry a compact lifecycle summary with remaining work counts, diagnostic counts, applied patch count, retain reason, and clearability flags.
- Completed clean sessions can be identified as auto-clearable; completed diagnostic sessions remain visible until the user chooses to clear them.
- `cleanupLoredeckHealthRepairSessions()` deletes only completed sessions without remaining review/model/manual work by default, and can explicitly include completed diagnostic summaries.
- The Health Center shows `Clear Finished Sessions` when completed repair-session files are present. It keeps active, review, model, deferred, and manual sessions intact, refreshes the session list after cleanup, and reports how many finished sessions were cleared.
- Focused lifecycle cleanup coverage lives in `tools/scripts/test-loredeck-health-repair-session-storage.mjs` and `tools/scripts/test-loredeck-health-center-refresh.mjs`.

Phase 2 optional future work:

- Optional richer run history can be added later if the product needs audit-style repair logs beyond compact session summaries.

## Phase 3: Health Center UX

Objective: replace fragmented repair actions with one guided flow.

Tasks:

- Add `Attempt Fixing` as the primary repair action for editable packs with findings.
- Replace `Dismiss Finding` with `Accept As-Is`.
- Replace `Mark Fixed` with `Verify Fixed`.
- Remove legacy assistant repair drafting from Pack Health repair UI.
- Replace `Queue Tag ID Repair` with internal local repair handling.
- Add capability labels:
  - `Auto-fixable locally`
  - `Model can attempt`
  - `Needs choice`
  - `Manual`
  - `Accepted as-is`
  - `Verified fixed`
- Add progress states for local repair, health checkpoint, model batch, and final verification.
- Add no-op messages that name remaining strategy classes.

Acceptance:

- Users can tell the difference between fixing, accepting as-is, and verifying.
- A deterministic no-op explains why nothing changed.
- Health Center never implies that a user marker fixed an issue.

Implemented first slice:

- Health Center grouped issue rows now make `Attempt Fixing` the primary repair action.
- `Dismiss Finding` is renamed to `Accept As-Is`, with copy that says the finding remains in diagnostics.
- `Mark Fixed` is renamed to `Verify Fixed`, with copy that tells users to rerun Pack Health for confirmation.
- Legacy assistant repair drafting is removed from Pack Health grouped issue rows and Manifest Preview; `Attempt Fixing` owns the repair path.
- `Queue Tag ID Repair` is demoted to `Queue Tag ID Review`.
- Creator readiness, Library metadata, and Override actions now show `Attempt Fixing` instead of `Auto-Repair Safe Findings` or `Repair Overrides`.
- Pending Review source labels display `attempt_fixing` proposals as `Attempt Fixing`.
- Runtime walkthrough copy now teaches `Attempt Fixing` and review/manual routes instead of "Safe Repair".

Implemented second slice:

- Health Center now discovers saved repair sessions for the current pack when opened.
- Overview and Issues tabs show an `Attempt Fixing Session` panel when sessions are loading, present, or have diagnostics.
- The session panel shows saved session status plus `needs choice`, model batch, deferred model batch, and manual remaining counts.
- Session diagnostics from missing/corrupt session files are visible in the session panel instead of failing the whole Health Center.
- The session panel exposes `Refresh Sessions` and `Attempt Fixing` actions for editable packs.
- `Refresh Scan` reloads repair-session state after validation so the panel is not left stale.

Implemented third slice:

- Added `src/loredecks/loredeck-health-issue-state-storage.js`.
- `Accept As-Is`, `Clear Accept As-Is`, `Verify Fixed`, and `Clear Verification` now persist issue disposition state through the external pack payload path instead of relying on compact Library rows.
- The compact Library index continues to strip `healthIssueStates`, so issue dispositions do not bloat settings or the external Library index.

Phase 3 closeout notes:

- Visual smoke/static coverage now checks the primary Pack Health repair labels and confirms the legacy assistant repair drafting route is absent.
- Provider-backed runtime visual QA remains part of the manual Phase 9 Arlong-style deck pass.

## Phase 4: Whole-Pack Attempt Fixing

Objective: run local repair against real payloads.

Tasks:

- Implement `attemptLoredeckHealthFixes(packId, options)`.
- Run preflight Pack Health.
- Build the Stage 1 repair plan.
- Apply local direct patches through the storage adapter.
- Rerun Pack Health.
- Update library health summary.
- Store compact repair result summary.
- Surface remaining choices, model-eligible findings, and manual-only findings.

Acceptance:

- Arlong-style 56 schema errors can be repaired through real payload writes without model calls when only local schema issues remain.
- After reload, fixed entries stay fixed.
- Remaining warnings are visible and not silently dismissed.

Implemented first slice:

- `src/loredecks/loredeck-health-attempt-fixing.js`
  - `attemptLoredeckHealthFixes(packId, options)`
- The orchestrator runs storage-backed Pack Health preflight, builds the Stage 1 repair plan, builds deterministic local repairs, applies direct local patches through `applyPackRepairPatches()`, reruns health through the storage adapter, and returns compact summary, remaining choice sets, model units, deferred units, and manual buckets.
- If no deterministic local patch exists, it refreshes the compact payload/library health summary and returns `changed: false` with `model_pending`, `manual_remaining`, or other Stage 1 outcome labels rather than implying a fix happened.
- It still does not call providers or wire UI buttons.

Additional Phase 4 slice:

- `attemptLoredeckHealthFixes()` can now opt into compact repair session persistence through `{ persistSession: true }`.
- Model-pending and needs-review results can be resumed from storage-indexed session files without storing repair state in settings.
- Completed clean local-repair runs avoid leaving large stale session files by default.
- `attemptLoredeckHealthFixes()` is the shared exported command name for panel dependencies. It runs `attemptLoredeckHealthFixes(packId, { persistSession: true })` through external payload storage, waits for external payload/library writes, clears stale Pack Health caches, and reports local/model/review/manual remaining work.

Additional Phase 4/5 integration slice:

- `attemptLoredeckHealthFixes()` now continues from local Attempt Fixing into provider-backed model repair when model units remain and the Reasoning Provider is ready.
- If the provider is not ready, the command keeps the prior behavior: local fixes are saved, remaining model work is preserved in a repair session, and the toast explains that model batches still need provider setup.
- The shared command passes the local repair session into `runLoredeckHealthModelRepairBatches()` so model progress updates the same compact session instead of creating an unrelated run record.
- Model continuation uses the live Reasoning Provider request path through `sendLoreRequest()` with JSON-only visible-output constraints, while tests can inject `requestLoredeckHealthModelRepair` to avoid live provider calls.
- Button text now advances from health checking to model batch progress and saving while the shared action is running.

Phase 4 closeout notes:

- Cancellation controls and session lifecycle polish are covered by the Health Center focused tests; final copy validation remains part of the manual Phase 9 live provider pass.

## Phase 5: Provider-Backed Model Repair Batches

Objective: use the reasoner only after local repair cannot finish the job.

Tasks:

- [Complete] Convert remaining model-eligible buckets into generation units.
- [Complete] Reuse `runGenerationUnits()` for sequential repair batches.
- [Complete] Use Stage 1 prompt builders and parsers.
- [Complete] Preserve Stage 1 batch scoping: model unit finding IDs, prompt findings, and validation context are limited to the current unit target IDs.
- [Complete] Preserve Stage 1 model output constraints: send `allowedOperations` and `allowedFields`, reject oversized responses, reject hidden full-entry payload mutations outside declared field scope, and store only validated choice sets as reviewable choices.
- [Complete] Drain `deferredUnits` across additional provider passes or resumable sessions; do not treat the first `modelUnitLimit` units as the complete repair plan.
- [Complete] Apply retry-smaller on token-limit or truncated JSON.
- [Complete] Validate every model patch before apply.
- [Complete] Directly apply only patches that pass direct-apply safety.
- [Complete] Convert ambiguous or unsafe model output into choice sets.
- [Complete] Persist unit progress in repair session files.
- [Complete] Wire the runner to the live Reasoning provider request path.
- [Complete] Add current-run hardening at the UI action layer before raising live model repair batch limits.
- [Complete] Add explicit cancellation controls before raising live model repair batch limits.

Implemented Phase 5 slice:

- Added `src/loredecks/loredeck-health-model-repair-runner.js`.
- The runner accepts an injected `requestModelRepair` callback, builds Stage 1 prompt payloads, executes bounded units through `runGenerationUnits()`, parses and validates Stage 1 model repair JSON, applies only direct-safe patches through the storage adapter, stores valid model choice sets, and writes compact per-unit progress to repair sessions.
- Repair sessions now preserve `remaining.modelProgress` entries with unit status, patch ids, choice ids, diagnostics counts, and error text without storing prompt payloads or raw provider output.
- The runner can select both current `modelUnits` and `deferredUnits`, so large decks are not limited to the first planner `modelUnitLimit`.
- The shared `Attempt Fixing` command now invokes this runner after local repair when model units remain and the Reasoning Provider is available.
- The shared `Continue Model Batches` command resumes saved model-pending sessions through the same runner, provider validation, write flushing, cache invalidation, and outcome toasts.
- The Health Center repair session panel now shows `Continue Model Batches` when a saved session has model or deferred model units.
- Shared storage-mutating repair actions now use a pack-scoped active-run guard, so duplicate `Attempt Fixing`, `Continue Model Batches`, or repair-choice apply actions for the same deck do not race provider calls or payload writes.
- The shared health repair action layer now exposes active run lookup and cancellation, and the Health Center shows `Cancel Repair Run` while a pack has a cancellable active repair run.
- Model repair parsing now distinguishes truncated JSON from generic invalid JSON, and the runner can retry a failed model unit with a reduced one-entry/tag/timeline target set plus explicit compact-response instructions.
- The smaller retry still validates model output against the reduced repair unit before any storage write, applies only validated direct patches, and leaves the still-unfixed findings in the remaining model queue for a later continuation pass.

Acceptance:

- [Covered by runner tests] A 57-affected-item deck is split into bounded calls.
- [Covered by runner tests] Decks larger than one model-unit run continue from `deferredUnits` without losing remaining findings.
- [Covered by runner tests] Completed model units survive later failed units.
- [Partially covered by current-run guard] Same-pack overlapping runs cannot apply competing patches or issue duplicate provider calls.
- [Covered by cancellation tests] Explicit cancellation aborts the active model run and preserves remaining model work without applying stale patches.
- [Covered by sequential retry path and runner tests] Late provider responses cannot apply stale patches after retry.
- [Covered by Stage 1 and storage validation tests] Invalid model output does not mutate pack payload files.

## Phase 6: Review Choices UI

Objective: make review an exception path for real ambiguity.

Tasks:

- [Complete] Add `Review Choices` entrypoint when choice sets exist.
- [Complete] Render choice cards with affected finding, confidence, reason, and A/B/C options.
- [Complete] Add inline diff previews for selected choice options.
- [Complete] Add `Ask Model To Re-evaluate` for one choice set at a time.
- [Complete] Add `Skip For Now`.
- [Complete] Add `Accept As-Is` only when severity policy allows it.
- [Complete] Apply selected choices through the storage adapter and validator.
- [Complete] Rerun Pack Health after choice apply.
- [Complete] Clear choice sets when findings disappear.

Implemented Phase 6 slice:

- Added `src/loredecks/loredeck-health-review-choices.js`.
- Saved local and model review choices can now be selected by `choiceSetId` and `optionId`, converted into user-choice direct patches, validated through the same Stage 1 patch validator, written through the Stage 2 storage adapter, and followed by a Pack Health rerun.
- The apply path preserves compact model progress, clears resolved/stale choice sets when their findings disappear, keeps still-active choices, and updates or deletes repair sessions based on remaining choice/model/manual work.
- The shared editor action now exposes `applyLoredeckHealthRepairChoice()` with write flushing, cache invalidation, surface refresh, and outcome toasts.
- The Health Center repair session panel now renders saved choice questions and A/B/C option rows with `Apply` buttons.

Implemented Phase 6 UX slice:

- Saved review-choice options now render inline `Preview` blocks derived from their storage patch operations, including operation type, target, affected fields, and compact replacement values when the patch provides payload data.
- Review choices now expose `Skip For Now`, which hides the choice only in the current Health Center view so the user can move to the next saved choice without mutating the repair session.
- Skipped choices can be restored with `Show Skipped Choices`.
- Error-level Pack Health findings no longer expose `Accept As-Is`; warning/suggestion findings can still be accepted as intentional, and existing accepted markers can still be cleared.
- Review choices now expose `Ask Model To Re-evaluate`, which removes only that saved choice from a session copy, reruns one model repair unit for the choice finding IDs, and refreshes the saved repair session state after the model returns.

Acceptance:

- [Covered by focused tests] Users choose between concrete fixes, not generic proposal rows.
- [Covered by focused tests] Applying a choice writes the external pack payload and survives reload.
- [Covered by focused tests] Choice sets disappear only after Pack Health verifies the issue is gone.

## Phase 7: Creator And Pending Review Cleanup

Objective: align Creator final readiness and review queues with the new repair workflow.

Tasks:

- Replace Creator final-card `Repair Safe Issues` with `Attempt Fixing`.
- Ensure Creator final readiness opens Health Center directly to the relevant repair state.
- Ensure generated decks with health errors do not show `Finalize ready`.
- Allow Lorecard generation to continue to the next pending micro-batch while Creator Draft Review has unresolved drafts, unless a batch failed or active generation is running.
- Ensure `Send Selected to Review` and `Send All to Review` remove rows from Creator Draft Review immediately.
- Ensure Pending Review acceptance removes accepted rows immediately.
- Ensure health-impacting Pending Review acceptance marks health stale or reruns Pack Health through storage-backed validation.

Acceptance:

- The Creator Lorecards stage no longer feels blocked by review queues before all draft batches are generated.
- Draft Review and Pending Review rows behave consistently.
- Creator final readiness routes users to `Attempt Fixing` for health errors.

Implemented Phase 7 slice:

- Creator final readiness now treats compact generated-pack `healthStatus` as authoritative when the full Pack Health report is not cached. Saved `has_errors` status blocks finalization, shows `Pack Health: Errors`, opens the Health Center on `issues`, and exposes `Attempt Fixing`.
- Stale generated-pack health now blocks finalization until Pack Health is rerun instead of allowing a misleading `Finalize ready` state.
- Unscanned generated packs now remain blocked at the readiness gate until Pack Health has been run.
- Creator final-card health actions use the same `Attempt Fixing` label as the Health Center and Library repair route.
- Existing Creator Lorecard stage behavior is covered so Draft Review rows do not block additional Lorecard generation while remaining micro-batches exist.
- Draft Review handoff and Pending Review acceptance/rejection refresh contracts remain covered by focused tests so rows clear from the visible queues after mutation.

## Phase 8: Compatibility Wrapper Removal

Objective: retire old repair routes now that storage-backed repair is stable.

Tasks:

- Convert old `repairLoredeckSafeHealthIssues` callers to `attemptLoredeckHealthFixes`.
- Remove assistant repair planning entrypoints from Pack Health UI.
- Keep general Lore Assistant creative editing separate from Pack Health repair.
- Remove settings-backed repair state compatibility after external payload repair is proven.
- Update docs and guide copy.

Acceptance:

- Health Center, Library details, Workbench, and Creator final readiness use the same orchestrator.
- No primary UI path says `Auto-Repair Safe Findings` or `Draft Repair Batches`.
- No repair flow persists full issue lists or model batch payloads to settings.

Implemented Phase 8 slice:

- Runtime editor actions now export `attemptLoredeckHealthFixes` directly; old `repairLoredeckSafeHealthIssues` callers were converted.
- Health Center, Library details, entry override cards, and Creator final readiness all use the same Attempt Fixing orchestrator.
- The old settings-backed schema repair fallback and its Pending Review safe-repair proposal path were removed.
- Pack Health grouped issue rows and Manifest Preview no longer expose `Draft With Assistant` or assistant repair planning.
- General Lore Assistant drafting/revision remains available for creative Lorecard edits, separate from Pack Health repair.

## Phase 9: Verification And QA

Objective: prove the storage-backed workflow is reliable.

Tasks:

- Add integration tests for external payload repair.
- Add tests for repair session file create/resume/delete.
- [Covered by focused tests] Add tests for `Accept As-Is` persistence in pack payload.
- Add tests for `Verify Fixed` clearing issue state only after health passes.
- Add tests for model batch retry and partial success.
- Add visual smoke for:
  - local-fixable errors
  - model-eligible findings
  - choice sets
  - no-op/manual-only result
  - clean final state
- Run provider-backed QA with an Arlong-style generated deck.

Acceptance:

- Importing or generating a large deck does not bloat settings.
- `Attempt Fixing` mutates the external pack payload file.
- Pack Health reflects fixed entries after reload.
- The flow handles 50+ affected entries without response truncation.
- The final report makes it clear what changed and what remains.

Implemented Phase 9 slice:

- Focused coverage now verifies external payload repair, repair session create/resume/delete, issue-state persistence, model retry/partial success, review choices, a 57-entry model batch run, and source-wide legacy cleanup contracts.
- `Verify Fixed` now persists a verification marker immediately, keeps it while refreshed Pack Health still reports findings, and clears resolved verification markers only after a clean `good` scan.
- Visual smoke static coverage now asserts the Pack Health UI uses `Attempt Fixing` and does not expose the removed assistant repair drafting path.
- Verification exposed and fixed the external payload revision path: compact Library row hydration now preserves payload file revisions, Library upsert carries hydrated payload revisions into payload writes, and queued payload writes use an internal per-pack sequence guard so multi-batch model repair cannot lose middle-batch changes while earlier writes are still flushing.
- Payload storage coverage now directly blocks an older queued payload write from rolling back newer cached edits while later writes are still pending, then verifies the flushed payload preserves every queued edit.
- Legacy cleanup coverage now scans all source files for removed Pack Health repair labels and retired assistant repair entrypoints, rather than checking only a few known files.
- Automated Verification passed with focused Pack Health/storage tests, visual smoke, a clean legacy source scan for retired repair labels/entrypoints, and the full alpha gate.

Manual Phase 9 signoff:

- Run the live provider-backed QA checklist below with an Arlong-style generated deck in a configured runtime session and capture the final user-facing changed/remaining report.

Live provider QA checklist:

- Setup:
  - Use a runtime profile with a working Reasoning Provider.
  - Start from a generated or imported Arlong-style custom Loredeck with at least 50 affected Lorecards and no unrelated manual edits in progress.
  - Confirm the deck is external-payload backed before repair. The Library row should stay compact and the full Lorecard payload should live in `/user/files/saga-pack-<packId>.v1.json`.
  - Capture baseline: Pack Health status, error/warning counts, current repair sessions for the pack, payload file size, and whether `settings.json` contains any Lorecard payload text from the deck.
- Run:
  - Open Pack Health from Creator final readiness or Library details and confirm the primary action reads `Attempt Fixing`.
  - Click `Attempt Fixing`.
  - Observe local repair progress, model batch progress, cancellation availability while a model batch is active, and saved session state if the run pauses or needs provider setup.
  - If review choices appear, verify each choice shows concrete A/B/C options with previews; apply one choice and verify Pack Health clears the related finding only after rerun.
  - If the provider truncates output, verify the run retries a smaller target and leaves still-unfixed findings in remaining model work instead of marking them fixed.
  - Reload the app after repair, then reopen the same deck and Pack Health.
- Pass criteria:
  - `Attempt Fixing` mutates the external payload file, not `settings.json`.
  - Pack Health after reload reflects the repaired Lorecards.
  - 50+ affected entries are handled through bounded model calls without response truncation breaking the run.
  - Completed clean sessions are not left as stale repair files; active, review, model-pending, or diagnostic sessions remain visible with clear next actions.
  - The final Health Center/session copy clearly says what changed, what remains, and whether remaining work is review, model, or manual.
  - No primary UI path exposes `Auto-Repair Safe Findings`, `Repair Safe Issues`, `Draft Repair Batches`, or `Draft With Assistant` as Pack Health repair actions.
- Fail criteria:
  - Full Lorecard payloads, model responses, or full health reports are written into `settings.json`.
  - A model or local repair marks an issue resolved without a clean Pack Health rerun.
  - Mid-run reload loses remaining repair work or hides a needs-review state.
  - Later model batches roll back earlier repaired Lorecards.
  - The user-facing final state only reports generic success/failure without naming remaining work.

Live provider QA evidence template:

```md
## Live Provider QA Result

- Date:
- Tester:
- Saga commit:
- Runtime profile:
- Provider/model:
- Deck id:
- Deck source: generated / imported
- Affected Lorecard count:
- External payload file:
- Payload size before:
- Payload size after:
- Settings payload text present before: yes / no
- Settings payload text present after: yes / no

### Baseline Pack Health

- Status:
- Errors:
- Warnings:
- Suggestions:
- Repair sessions before:

### Run Observations

- Primary action label was `Attempt Fixing`: yes / no
- Local repair progress visible: yes / no / not applicable
- Model batch progress visible: yes / no / not applicable
- Cancel control visible during active model run: yes / no / not applicable
- Retry-smaller observed: yes / no / not applicable
- Review choices observed: yes / no / not applicable
- Review choice previews were concrete: yes / no / not applicable
- Reload/resume preserved remaining work: yes / no / not applicable

### Final Pack Health After Reload

- Status:
- Errors:
- Warnings:
- Suggestions:
- Repair sessions after:
- Completed sessions cleaned up: yes / no / not applicable
- Remaining work type: none / review / model / manual
- Final user-facing changed/remaining copy:

### Signoff

- Pass / fail:
- Blocking issues:
- Follow-up issues:
```

## Stage 2 Test Plan

Recommended tests:

- `tools/scripts/test-loredeck-health-repair-storage-adapter.mjs`
- `tools/scripts/test-loredeck-health-attempt-fixing.mjs`
- `tools/scripts/test-loredeck-health-attempt-fixing-model-continuation.mjs`
- `tools/scripts/test-loredeck-health-repair-session-storage.mjs`
- `tools/scripts/test-loredeck-health-issue-state-storage.mjs`
- `tools/scripts/test-loredeck-health-review-choices.mjs`
- `tools/scripts/test-loredeck-health-model-repair-runner.mjs`
- `tools/scripts/test-generated-loredeck-readiness-health.mjs`
- `tools/scripts/test-loredeck-generated-finalization-health.mjs`
- `tools/scripts/test-loredeck-health-center-refresh.mjs`

Also update storage tests so Pack Health repair is covered by the external payload lifecycle.

Implemented targeted tests:

- `tools/scripts/test-loredeck-health-repair-storage-adapter.mjs`
- `tools/scripts/test-loredeck-health-repair-session-storage.mjs`
- `tools/scripts/test-loredeck-health-attempt-fixing.mjs`
- `tools/scripts/test-loredeck-health-attempt-fixing-model-continuation.mjs`
- `tools/scripts/test-loredeck-health-center-refresh.mjs`
- `tools/scripts/test-loredeck-health-issue-state-storage.mjs`
- `tools/scripts/test-loredeck-health-model-repair-runner.mjs`
- `tools/scripts/test-loredeck-health-review-choices.mjs`
- `tools/scripts/test-saga-lorepack-health-external-payloads.mjs`
- `tools/scripts/test-saga-lorepack-payload-storage.mjs`
- `tools/scripts/test-loredeck-health-legacy-cleanup.mjs`
- `tools/scripts/test-visual-smoke-harness.mjs`
- `tools/scripts/run-alpha-gate.mjs`

## Stage 2 Done Criteria

Stage 2 is complete when:

- The `Attempt Fixing` button is the primary health repair route.
- Local repairs write through external payload storage.
- Model repair batches are bounded, resumable, and validated before apply.
- Review choices are stored outside settings and used only for ambiguity.
- Creator final readiness and Health Center use the same repair orchestrator.
- No full repair payloads, model outputs, or health reports are stored in `settings.json`.

Automated Stage 2 verification is complete. Product signoff should wait until the live provider QA checklist passes against an Arlong-style generated deck.
