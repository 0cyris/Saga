# Loredeck Health Auto-Fix Stage 2: Storage Integration

Status: Waiting on storage stability.

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

## Phase 3: Health Center UX

Objective: replace fragmented repair actions with one guided flow.

Tasks:

- Add `Attempt Fixing` as the primary repair action for editable packs with findings.
- Replace `Dismiss Finding` with `Accept As-Is`.
- Replace `Mark Fixed` with `Verify Fixed`.
- Hide or demote `Draft Repair Batches` from Pack Health repair UI.
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

## Phase 5: Provider-Backed Model Repair Batches

Objective: use the reasoner only after local repair cannot finish the job.

Tasks:

- Convert remaining model-eligible buckets into generation units.
- Reuse `runGenerationUnits()` for sequential repair batches.
- Use Stage 1 prompt builders and parsers.
- Preserve Stage 1 batch scoping: model unit finding IDs, prompt findings, and validation context are limited to the current unit target IDs.
- Preserve Stage 1 model output constraints: send `allowedOperations` and `allowedFields`, reject oversized responses, reject hidden full-entry payload mutations outside declared field scope, and store only validated choice sets as reviewable choices.
- Drain `deferredUnits` across additional provider passes or resumable sessions; do not treat the first `modelUnitLimit` units as the complete repair plan.
- Apply retry-smaller on token-limit or truncated JSON.
- Validate every model patch before apply.
- Directly apply only patches that pass direct-apply safety.
- Convert ambiguous or unsafe model output into choice sets.
- Persist unit progress in repair session files.

Acceptance:

- A 57-affected-item deck is split into bounded calls.
- Decks larger than one model-unit run continue from `deferredUnits` without losing remaining findings.
- Completed model units survive later failed units.
- Late provider responses cannot apply stale patches after cancellation or retry.
- Invalid model output does not mutate pack payload files.

## Phase 6: Review Choices UI

Objective: make review an exception path for real ambiguity.

Tasks:

- Add `Review Choices` entrypoint when choice sets exist.
- Render choice cards with affected finding, diff preview, confidence, reason, and A/B/C options.
- Add `Ask Model To Re-evaluate` for one choice set at a time.
- Add `Skip For Now`.
- Add `Accept As-Is` only when severity policy allows it.
- Apply selected choices through the storage adapter and validator.
- Rerun Pack Health after choice apply.
- Clear choice sets when findings disappear.

Acceptance:

- Users choose between concrete fixes, not generic proposal rows.
- Applying a choice writes the external pack payload and survives reload.
- Choice sets disappear only after Pack Health verifies the issue is gone.

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

## Phase 8: Compatibility Wrapper Removal

Objective: retire old repair routes without breaking callers mid-migration.

Tasks:

- Convert old `repairLoredeckSafeHealthIssues` callers to `attemptLoredeckHealthFixes`.
- Remove or wrap assistant repair planning entrypoints from Pack Health UI.
- Keep general Lore Assistant creative editing separate from Pack Health repair.
- Remove settings-backed repair state compatibility after external payload repair is proven.
- Update docs and guide copy.

Acceptance:

- Health Center, Library details, Workbench, and Creator final readiness use the same orchestrator.
- No primary UI path says `Auto-Repair Safe Findings` or `Draft Repair Batches`.
- No repair flow persists full issue lists or model batch payloads to settings.

## Phase 9: Verification And QA

Objective: prove the storage-backed workflow is reliable.

Tasks:

- Add integration tests for external payload repair.
- Add tests for repair session file create/resume/delete.
- Add tests for `Accept As-Is` persistence in pack payload.
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

## Stage 2 Test Plan

Recommended tests:

- `tools/scripts/test-loredeck-health-repair-storage-adapter.mjs`
- `tools/scripts/test-loredeck-health-repair-session-storage.mjs`
- `tools/scripts/test-loredeck-health-attempt-fixing.mjs`
- `tools/scripts/test-loredeck-health-review-choices.mjs`
- `tools/scripts/test-loredeck-health-model-repair-runner.mjs`
- `tools/scripts/test-loredeck-creator-health-auto-fix-ui.mjs`

Also update storage tests so Pack Health repair is covered by the external payload lifecycle.

## Stage 2 Done Criteria

Stage 2 is complete when:

- The `Attempt Fixing` button is the primary health repair route.
- Local repairs write through external payload storage.
- Model repair batches are bounded, resumable, and validated before apply.
- Review choices are stored outside settings and used only for ambiguity.
- Creator final readiness and Health Center use the same repair orchestrator.
- No full repair payloads, model outputs, or health reports are stored in `settings.json`.
