# Saga Storage Finalization Scope Plan

Status: Phase C implementation is alpha-gate verified and the repo-local CDP `storage-harness` now passes end to end. Same-ID Theme/Icon collision protection, durable repair-session lifecycle closeout, stale-write blocking for high-risk external JSON writes, external Pack Health refresh, visible Library delete, and Theme/Icon forget cleanup are implemented. Live State Safety migration has compacted the real SillyTavern profile to `external-files-v1`, and the read-only real-profile audit now passes with no warnings or errors.

This document defines the storage-finalization work considered before calling the Saga storage rework alpha-complete. It narrows three open areas from the main storage design into actionable implementation scopes:

- failed same-ID Theme/Icon overwrite imports
- durable repair session files for unresolved Pack Health review choices
- multi-tab stale-write detection

The purpose is not to reopen the full storage architecture. The core external-file model is already established: compact `settings.json` control-plane state, Saga-owned JSON payloads under `/user/files`, master/domain indexes, and passive assets as separate flat files.

## Finalization Principles

- Protect user data before adding convenience. If a feature cannot restore safely after partial failure, the alpha behavior should block or create a new ID instead of overwriting existing files.
- Keep storage readable. New files should remain pretty-printed JSON with stable Saga filename prefixes.
- Keep settings compact. None of these scopes should put Loredeck payloads, Creator project payloads, Theme Pack payloads, Icon Set payloads, or repair session details back into `settings.json`.
- Prefer explicit user recovery over silent merge. For alpha, stale writes should stop and ask the user to reload rather than trying to merge concurrent edits.
- Keep repair sessions temporary. Saga should persist unresolved repair work, not routine full health reports or completed repair history.

## Scope 1: Failed Same-ID Theme/Icon Overwrite Imports

### Problem

New Theme/Icon imports can now clean up newly-created payloads and raster assets when an index update fails. Same-ID replacement is harder because Theme/Icon payload filenames are deterministic:

- `saga-theme-pack-<themeId>.v1.json`
- `saga-iconset-<iconSetId>.v1.json`

If a custom Theme Pack or Icon Set with the same ID already exists, writing the new payload can replace the existing payload before the domain index update succeeds. If that later step fails, Saga may no longer have the prior payload content unless it explicitly read and preserved it first.

### Alpha Decision

For alpha, Saga should not perform implicit same-ID overwrites for custom Theme Packs or Icon Sets.

The acceptable alpha behavior is:

- UI imports auto-suffix colliding custom IDs, or
- storage adapter imports reject colliding custom IDs unless an explicit replace option is provided.

The safer default is auto-suffix in UI flows and reject at the storage adapter boundary when called directly without a collision policy.

### Implementation Notes

- Direct custom Theme Pack imports now reject an existing external Theme Pack ID before writing the deterministic payload file.
- Direct custom Icon Set imports now reject an existing external Icon Set ID before uploading raster assets or writing the deterministic payload file.
- Theme/Icon registry imports treat those collision rejections as skipped records and return `collisionCount` plus per-record skip metadata.
- The visible registry import toast distinguishes existing custom ID collisions from bundled or invalid records.
- The storage adapter has a reserved explicit replace policy, but no alpha UI exposes replacement because safe restore after partial overwrite remains out of scope.

### In Scope

- Add a storage-adapter-level collision policy for Theme Pack import.
- Add a storage-adapter-level collision policy for Icon Set import.
- Preserve the existing bundled-ID rejection behavior.
- Ensure direct storage adapter calls cannot accidentally overwrite an existing custom Theme/Icon payload.
- Ensure registry imports either skip colliding records or import them with unique IDs, depending on the selected policy.
- Add tests for:
  - new import with unused ID succeeds
  - bundled ID collision is rejected
  - custom ID collision without replace policy is rejected or auto-suffixed
  - failed same-ID import does not alter existing payload, domain index record, master index record, or runtime cache

### Out Of Scope For Alpha

- Full replace-existing UX.
- Interactive diff between old and new Theme/Icon payloads.
- Merge of old and new Icon Set slots.
- Automatic restore after same-ID replacement if replacement is explicitly allowed.

### Optional Post-Alpha Replacement Scope

If Saga later supports explicit replacement, it needs a true restore plan:

1. Read current domain index record.
2. Read current payload file.
3. Read current owned asset file list.
4. Upload new assets and payload.
5. Update domain index.
6. Update master index.
7. Refresh runtime cache only after all writes succeed.
8. If any step fails after the old payload was overwritten, restore the old payload and old index record.
9. Delete only newly-created assets from the failed replacement.
10. Leave old assets intact until replacement fully commits.

### Acceptance Criteria

- A same-ID custom Theme Pack import cannot corrupt an existing Theme Pack on failed index writes.
- A same-ID custom Icon Set import cannot corrupt an existing Icon Set on failed index writes.
- Runtime Theme/Icon caches update only after a committed import.
- Settings remain compact after successful and failed imports.
- The user-facing import result clearly says whether Saga imported a renamed copy, skipped a collision, or blocked replacement.

## Scope 2: Durable Repair Session Files

### Problem

Pack Health `Attempt Fixing` can leave unresolved work:

- model batches still need to run
- review choices require the user to choose A/B/C
- manual-only issues remain
- diagnostics need to survive reload while the repair is in progress

This work cannot live only in memory. It also should not be shoved into `settings.json` or into the Lorepack Library index. Durable repair sessions are the right temporary storage boundary.

### Current Direction

Repair sessions should be stored as files like:

```text
/user/files/saga-repair-session-<packId>-<sessionId>.v1.json
```

The main design already defines this as temporary storage for active repair workflows or unresolved review choices. Existing implementation work appears to have started around storage-backed repair sessions and Health Center session UI, so this scope is primarily about finishing lifecycle behavior, user clarity, and signoff.

### Implementation Notes

- Repair sessions are compact `/user/files/saga-repair-session-<packId>-<sessionId>.v1.json` files registered in the master storage index.
- Saved sessions persist review choices, model/deferred units, manual-only buckets, compact diagnostics, compact health summaries, and applied patch IDs without storing full Loredeck payloads or raw model transcripts.
- Session lifecycle metadata now distinguishes auto-cleanable completed sessions from user-clearable saved sessions.
- The Health Center exposes:
  - `Continue Model Batches` for model/deferred work.
  - saved review choice apply and re-evaluation controls.
  - `Clear Finished Sessions` for completed sessions.
  - `Export Diagnostics` for compact session diagnostics.
  - `Clear Saved Session` for explicit user discard of the selected saved session.
- `tools/scripts/test-loredeck-health-repair-session-storage.mjs` is now part of the alpha gate so compact storage, master-index registration, delete, and cleanup contracts cannot drift.

### In Scope

- Save a repair session only when `Attempt Fixing` leaves unresolved work.
- Store compact repair state:
  - pack ID
  - session ID
  - status
  - before/after compact health summaries
  - model units
  - deferred model units
  - review choice sets
  - manual-only buckets
  - diagnostics
  - applied patch IDs or compact progress markers
- Exclude heavy data:
  - full Loredeck payloads
  - full health reports
  - raw model transcripts
  - full prompt payloads
  - full before/after pack snapshots
- Register repair session files in the master storage index.
- List saved sessions in Pack Health Center.
- Continue model batches from a saved session.
- Apply review choices from a saved session.
- Refresh Pack Health after continuing batches or applying review choices.
- Delete or mark sessions complete when no unresolved work remains.
- Keep an explicit user action for exporting diagnostics, separate from normal session lifecycle.

### Out Of Scope For Alpha

- Permanent repair history.
- Storing all health scans as durable files.
- Storing raw model prompts/responses by default.
- Cross-pack repair sessions.
- Multi-user/collaborative repair queues.

### Lifecycle Rules

- `model_pending`: keep session until all model batches complete or fail.
- `needs_review`: keep session until all review choices are applied, dismissed, or converted to manual.
- `manual_remaining`: keep session until the user reruns repair successfully, exports diagnostics, clears the saved session, or manually resolves the remaining Pack Health findings.
- `complete`: delete by default after the UI has refreshed and Pack Health no longer reports the issue.
- `blocked`: keep with compact diagnostics until the user retries, exports diagnostics, or discards the session.

### Acceptance Criteria

- `Attempt Fixing` can be interrupted and resumed after reload.
- Review choices survive reload and show clear apply buttons.
- Applying a choice mutates the external Lorepack payload, not settings.
- Continuing model batches mutates external payloads and refreshes the session.
- Completed sessions do not accumulate indefinitely.
- Repair sessions remain compact and do not contain full Loredeck payloads.
- Settings remain compact throughout the workflow.

## Scope 3: Multi-Tab Stale-Write Detection

### Problem

SillyTavern's files API writes whole files. If two Saga panels or browser tabs edit the same Saga JSON file, a later write can overwrite a prior write without seeing it. This is most dangerous for:

- Lorepack payload edits and repairs
- Creator project updates during generation
- Library folder and placement edits
- Theme/Icon replacement flows if replacement is later allowed

The main design calls for revision/updatedAt-based detection. Alpha does not need automatic merge, but it should avoid silent data loss.

### Alpha Decision

For alpha, stale-write detection should block and ask the user to reload. It should not merge.

User-facing message shape:

```text
Storage changed. Reload this panel before saving.
```

Domain-specific variants can name the affected area:

- `Loredeck storage changed. Reload this Loredeck before saving.`
- `Creator project storage changed. Reload this project before continuing.`
- `Library storage changed. Reload the Library before changing folders.`
- `Theme/Icon storage changed. Reload Settings before importing again.`

### In Scope

- Add or standardize revision fields on mutable indexes and payloads where missing.
- Track the revision/updatedAt read into each cache.
- Before writing, fetch the latest index/payload header or full JSON where necessary.
- Compare current cached revision to latest stored revision.
- If latest is newer or revision differs unexpectedly, block the write.
- Return a structured stale-write result:
  - `ok: false`
  - `code: "storage_changed"`
  - `domain`
  - `path`
  - `message`
- Surface clear reload guidance in UI actions that save external storage.
- Add tests for two writers using the same starting revision.

### Implementation Notes

- `src/storage/saga-storage-stale-write.js` defines the shared `storage_changed` result/error contract and domain-specific reload messages.
- Generic domain index and payload writes can compare an expected revision to the latest stored JSON before committing.
- Library index writes compare the hydrated Library revision before committing folder, placement, active stack, or pack-row changes.
- Lorepack payload writes bump payload revisions and compare the cached payload revision before committing repair, validation, editor, or import mutations.
- Creator project writes bump project payload revisions and compare both the project payload and Creator index revision before committing generation checkpoints or shelf changes.
- Theme/Icon domain record upsert/remove operations re-check the domain index revision before committing the compact index change. Explicit same-ID replacement remains out of scope.
- `tools/scripts/test-saga-storage-stale-write-detection.mjs` simulates stale Library, Lorepack payload, and Creator project writers using the same starting revision and verifies the newer stored file is preserved.

### First Targets

Implement stale-write detection in this order:

1. Library index writes.
2. Lorepack payload writes.
3. Creator project payload/index writes.
4. Theme/Icon domain index writes.
5. Theme/Icon explicit replacement flow, if that flow is added.

### Out Of Scope For Alpha

- Per-field merge.
- Conflict resolution UI.
- CRDT-style collaborative editing.
- Background auto-refresh that silently overwrites local pending edits.
- Cross-device lock services.

### Acceptance Criteria

- Two stale Library folder writes cannot silently overwrite each other.
- A stale Lorepack payload repair cannot overwrite a newer payload.
- A stale Creator project checkpoint cannot overwrite a newer project file without a clear error.
- UI tells the user to reload the affected panel.
- Existing single-tab workflows remain fast and do not fetch every payload on startup.

## Recommended Finalization Order

### Phase A: Collision-Safe Theme/Icon Imports

Why first: bounded scope, direct data-loss prevention, and easy testability.

Deliverables:

- Theme/Icon import collision policy.
- UI/import result copy for collisions.
- tests for collision and failed replacement protection.

Exit criteria:

- Same-ID custom Theme/Icon import cannot overwrite an existing payload unless explicit replacement support exists.

### Phase B: Repair Session Lifecycle Signoff

Why second: repair sessions appear partially implemented, and this work closes the Health Center workflow users directly see.

Deliverables:

- lifecycle cleanup rules implemented and alpha-gate covered
- saved-session UI reviewed through Health Center session controls
- choice application and model continuation tests confirmed
- settings bloat guard verified by compact repair-session storage and external-payload tests

Exit criteria:

- met for alpha signoff: unresolved repair work survives reload, explicit saved-session clearing is available, and completed-session cleanup is scoped to finished sessions.

### Phase C: Stale-Write Detection

Why third: broader storage infrastructure change; highest blast radius.

Deliverables:

- stale write helper or shared convention implemented
- Library index stale-write test implemented
- Lorepack payload stale-write test implemented
- Creator project stale-write test implemented
- UI error copy for reload guidance implemented through domain-specific `storage_changed` messages

Exit criteria:

- met for alpha signoff: stale-write detection is implemented and covered by `tools/scripts/test-saga-storage-stale-write-detection.mjs`; the repo-local CDP `storage-harness` passes; `node tools/scripts/run-alpha-gate.mjs` passed with this coverage included.
- final storage signoff is complete: the read-only audit now passes in a real SillyTavern profile after State Safety migration.

## Real Profile Audit

Manual inspection is now supported by a repeatable read-only script:

```bash
node tools/scripts/audit-saga-storage-profile.mjs --profile <SillyTavern data/default-user path>
```

For a compact terminal summary, add `--text`.

The audit checks:

- `settings.json` contains `extension_settings.saga`.
- Saga external files under `/user/files` are valid flat `saga-*` JSON/raster files, and unsupported `saga-*` filenames are reported.
- every Saga JSON file under `/user/files` parses as valid JSON.
- known Saga JSON files have a valid `schemaVersion`, and revisioned mutable files have valid `revision` and `updatedAt` envelope fields for stale-write protection.
- the master storage index exists, has the expected managed domain records, uses valid `/user/files/saga-*` record paths, classifies known Saga index/payload/repair/asset files with the expected record metadata, keeps expected `ownerId`, MIME, and deletion-policy values for cleanup/delete ownership, and every tracked file is present.
- physical Saga files are registered in the master index, with no untracked orphans.
- Library, Creator, Theme, Icon Set, and repair-session records point at existing indexed files; domain indexes and JSON payload files use their expected `kind` values, and domain payload IDs match the index records that reference them.
- settings do not contain heavy Saga payload fields such as Lorecard entries, Creator drafts, Theme/Icon payloads, or repair sessions.
- profiles with external Saga files have `sagaStorage.migrationVersion === external-files-v1` so ordinary settings saves keep compact externalized shells.

The script is covered by `tools/scripts/test-saga-storage-profile-audit.mjs` and is part of the alpha gate.

Pre-migration local audit evidence:

- external file graph is healthy: 5 physical Saga files, 5 master-index records, no missing files, no orphan files.
- audit failed because the real profile had Saga external files but `sagaStorage.migrationVersion` was empty.
- settings compaction was pending: the stored settings still included 43 bundled Loredeck Library records because the external storage migration marker had not been set.
- migration hardening is in place: the migration executor hydrates existing external Library, Creator, Theme, and Icon indexes before merging settings-side records, so a partially externalized profile can be compacted without dropping existing external packs.
- external Library normalization now preserves explicit layout references to bundled Loredecks without writing bundled pack records into `/user/files` or auto-generating bundled suggested-folder placements.

Live State Safety preflight evidence:

- local SillyTavern responds at `http://127.0.0.1:8000/`.
- the installed Saga rail is in Advanced mode and renders **State Safety** in Settings.
- the collapsed State Safety section contains **Migrate Legacy Storage**, **Verify Storage**, **Settle Storage Writes**, and **Clean Missing Records** controls.
- **Migrate Legacy Storage** is enabled, matching the failed audit state.
- **Settle Storage Writes** is disabled, so there is no visible queued-write blocker before migration.
- the section reports `Storage migration: none` and `Storage integrity: not checked`, matching the profile's missing migration marker.

Approval boundary:

- running **Migrate Legacy Storage** mutates the real SillyTavern profile by writing compact Saga settings and external storage metadata.
- do not run the action as part of a read-only audit; get explicit user approval before clicking it or invoking the equivalent migration executor against `F:\SillyTavern\SillyTavern\data\default-user`.

Real profile signoff evidence:

- **State Safety > Migrate Legacy Storage** was run after user approval.
- State Safety created a `before_storage_migration` backup before mutation.
- State Safety changed the migration action to disabled **Storage Current**.
- State Safety reports `Storage migration: external-files-v1`.
- read-only audit command:

```bash
node tools/scripts/audit-saga-storage-profile.mjs --profile F:\SillyTavern\SillyTavern\data\default-user
```

- audit result: `ok: true`.
- audit warnings: none.
- audit errors: none.
- `settings.json` shrank from 1,188,115 bytes to 1,029,492 bytes.
- Saga settings payload shrank from 77,741 bytes to 13,573 bytes.
- `settings.sagaStorage.migrationVersion` is `external-files-v1`.
- settings compact shells now contain 0 Loredeck Library pack records, 0 Creator jobs, 0 Theme Packs, and 0 Icon Sets.
- external file graph remains healthy: 5 physical Saga files, 5 tracked master-index records, no missing tracked files, and no orphan Saga files.
- external Library still contains the generated Arlong pack.
- external Creator index still contains active project `one_piece_arlong_park_arc_mqcgv620`.
- repair session storage is empty.

Verification refresh:

- `node --check tools/scripts/audit-saga-storage-profile.mjs` passes.
- `node --check tools/scripts/test-saga-storage-profile-audit.mjs` passes.
- `node tools/scripts/test-saga-storage-profile-audit.mjs` passes, including missing-marker, compact migrated, settings-path/profile-path resolution, strict CLI argument handling, `--help`, `--text`, heavy migrated settings payload, missing tracked file, invalid master-index domain records, invalid master-index record path, invalid master-index record metadata, invalid master-index record owner/MIME/deletion policy, invalid storage JSON schema/revision/timestamp envelopes, invalid domain-index kind, invalid payload kind, invalid payload ID, orphan file, unsupported `saga-*` file, and invalid Saga JSON coverage.
- `node tools/scripts/audit-saga-storage-profile.mjs --profile F:\SillyTavern\SillyTavern\data\default-user` still returns `ok: true` with no warnings or errors.
- `node tools/scripts/audit-saga-storage-profile.mjs --text --profile F:\SillyTavern\SillyTavern\data\default-user` prints a passing compact summary.
- `node tools/scripts/run-alpha-gate.mjs` passes on the current tree with the storage profile audit included.

### Real Profile Signoff Runbook

Use this runbook for the final storage signoff against a real local SillyTavern profile.

1. Confirm SillyTavern is open on the profile being audited.
2. Run the read-only audit:

```bash
node tools/scripts/audit-saga-storage-profile.mjs --profile F:\SillyTavern\SillyTavern\data\default-user
```

3. Proceed only when the failing state is limited to the migration marker and settings compaction:
   - external file graph is healthy
   - no missing tracked files
   - no orphan Saga files
   - no heavy Theme/Icon/Creator/repair-session payloads remain in settings
   - `missing_storage_migration_marker` is the blocking error
4. Ask for explicit approval to mutate the real profile.
5. In Saga, open **Settings > State Safety** and run **Migrate Legacy Storage**.
6. Wait for the migration toast or status row to settle.
7. Run **Verify Storage** from State Safety, or rerun the audit script directly.
8. Rerun the read-only profile audit.
9. Mark signoff complete only when:
   - audit returns `ok: true`
   - `settings.sagaStorage.migrationVersion` is `external-files-v1`
   - bundled Loredeck Library records no longer bloat `settings.json`
   - external Library and Creator records still point at the Arlong generated pack and Creator project
   - no missing tracked files or orphan Saga files appear

If migration fails:

- do not manually edit `settings.json` as the first response.
- collect the State Safety latest migration log and browser console errors.
- rerun the audit and preserve the full JSON output.
- use the State Safety backup if settings were partially compacted but external files were not correctly indexed.
- only add a targeted migration repair after identifying whether the failure happened during hydration, external write, settings compaction, or settings save.

Completed remediation path:

- ran the in-app **State Safety > Migrate Legacy Storage** action so Saga wrote the `external-files-v1` marker and compact settings shells.
- reran `node tools/scripts/audit-saga-storage-profile.mjs --profile F:\SillyTavern\SillyTavern\data\default-user`.
- marked real-profile signoff complete after the audit returned `ok: true`.

## Final Scope Boundary

These items are included before declaring storage rework alpha-complete:

- collision-safe Theme/Icon imports
- repair session lifecycle cleanup/signoff
- stale-write block-and-reload detection for high-risk writes
- one successful repo-local CDP `storage-harness` run
- one passing real SillyTavern profile audit of `settings.json` and `/user/files`

These should stay post-alpha unless a signoff run exposes a real data-loss issue:

- explicit Theme/Icon replacement UX with restore-on-failure
- merge/conflict UI for stale writes
- permanent repair history
- orphan cleanup beyond indexed files
- raw zip backup retention

## Signoff Checklist

- [x] Alpha gate passes.
- [x] Repo-local CDP `storage-harness` smoke passes.
- [x] `node tools/scripts/audit-saga-storage-profile.mjs --profile F:\SillyTavern\SillyTavern\data\default-user` passes against a real SillyTavern profile.
- [x] Failed Theme/Icon import tests prove existing records remain intact.
- [x] Repair session tests prove unresolved choices survive reload and completed sessions are cleaned up.
- [x] Stale-write tests prove conflicting writes are blocked.
- [x] `settings.json` remains compact after import, repair, Creator, Theme/Icon, and settings-save workflows.
- [x] `/user/files` contains expected Saga JSON and passive asset files with no obvious orphan growth after delete/forget workflows.
