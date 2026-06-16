# Saga Alpha Stabilization And UI Extraction

Status: Active next-pass plan after the broad alpha refactor split.

Date: 2026-06-11.

## Purpose

The broad alpha refactor has already moved most of the largest infrastructure files into owned modules. The next risk is different: further extraction can accidentally break working flows if Saga does not first lock down the current behavior.

This document defines two immediate passes:

1. Stabilization: prove the current refactor is behaviorally sound before more slicing.
2. Loredeck UI extraction: remove repeated UI and workflow rendering from the largest remaining Loredeck panels.

The goal is not elegance for its own sake. The alpha goal is that a bug report can be isolated to a small owner module instead of requiring a search through a large controller or one-off panel implementation.

Because Saga is still pre-alpha, update the current code in place. Do not add broad compatibility wrappers for old internal module paths or old helper names.

## Related Documents

- [SAGA_ALPHA_REFACTOR_PLAN.md](SAGA_ALPHA_REFACTOR_PLAN.md): full decomposition plan and target architecture.
- [SAGA_LORE_PANEL_DECOMPOSITION_PLAN.md](SAGA_LORE_PANEL_DECOMPOSITION_PLAN.md): runtime panel extraction history and runtime ownership goals.
- [SAGA_CORE_INTEGRATION_TESTING.md](SAGA_CORE_INTEGRATION_TESTING.md): deterministic Context-to-injection test strategy.
- [SAGA_VISUAL_SMOKE.md](SAGA_VISUAL_SMOKE.md): visual smoke harness and browser checklist.
- [LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md](LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md): Lorepack package import/export contract.

## Current Refactor Snapshot

Measured in the current worktree on 2026-06-11:

| Area | File | Current size | Status |
| --- | --- | ---: | --- |
| Runtime controller | `src/runtime/lore-panel.js` | 15,466 lines | Improved, but still the largest remaining controller. |
| State facade | `src/state/state-manager.js` | 991 lines | Structural split is largely met. Keep facade stable. |
| CSS entrypoint | `styles/saga.css` | 13 lines | Split into imported owned CSS files. |
| Constants facade | `src/state/constants.js` | 44 lines | Structural split is largely met. |
| Loredeck loader | `src/loredecks/loredeck-loader.js` | 465 lines | Loader is much closer to data-only. |
| Extension entrypoint | `src/extension/index.js` | 27 lines | Startup is split into focused extension modules. |
| Prompt injector | `src/continuity/prompt-injector.js` | 431 lines | Small enough for alpha, but lifecycle/global cleanup still matters. |

Largest remaining Loredeck UI files:

| File | Current size | Primary concern |
| --- | ---: | --- |
| `src/loredecks/loredeck-library-panel.js` | 4,830 lines | Library, folders, selection, import/export, stack actions, and package surfaces. |
| `src/loredecks/loredeck-workbench-panel.js` | 2,513 lines | Editor workflows and repeated card/list controls. |
| `src/loredecks/loredeck-health-panel.js` | 1,748 lines | Pack Health rendering and remediation views. |
| `src/loredecks/loredeck-creator-panel.js` | 1,670 lines | Deck Maker stage/job/status UI. |
| `src/loredecks/loredeck-assistant.js` | 1,448 lines | Assistant proposal, validation, and repair workflow UI. |

Current passing contract checks:

```powershell
node tools\scripts\test-repository-layout.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-state-safety-contract.mjs
node tools\scripts\test-prompt-injection-stale-state.mjs
```

## Observed Stabilization Blockers

### S1: Null Timeline Registry Crashes Loredecks And Context

Status: Fixed in the first stabilization slice on 2026-06-11.

Observed in live runtime screenshots on 2026-06-11:

- Loredecks tab fails with `TypeError: Cannot read properties of null (reading 'anchors')`.
- Context tab fails with the same error.
- Both traces pass through `getLoredeckTimelineRegistryCount`, `normalizeLoredeckLibraryPack`, and `getLoredeckLibrary`.

Likely owner modules:

- `src/loredecks/loredeck-normalizer.js`
- `src/loredecks/loredeck-loader.js`
- `src/state/loredeck-library-store.js`
- `src/loredecks/loredeck-library-panel.js`
- `src/context/context-panel.js`

Required fix:

- Treat a missing or `null` timeline registry as invalid data, not as a render-fatal exception.
- Normalize current Lorepack records so timeline registries always expose safe empty arrays for `anchors` and related collections.
- Make `getLoredeckTimelineRegistryCount` null-safe.
- Surface malformed or missing timeline data through Pack Health where the user can diagnose it.
- Add regression coverage for a Lorepack/library record with `timelineRegistry: null`, `timeline: null`, missing `anchors`, and missing windows.
- Verify both Loredecks and Context render with the same corrupted fixture.

Exit criteria:

- Loredecks tab renders instead of showing the runtime error panel.
- Context tab renders instead of showing the runtime error panel.
- Pack Health reports the malformed timeline data as an issue.
- No code path silently fabricates a healthy timeline; the fallback is safe rendering plus explicit health feedback.

Implementation notes:

- `getLoredeckTimelineRegistryCount` and `getLoredeckTagRegistryCount` now tolerate the normalizers' `null` result.
- `normalizeLoredeckRegistry` and runtime library-pack normalization preserve `timelineRegistryIssue` for explicit malformed timeline overlays.
- Pack Health reports malformed timeline overlays with `context_timeline_registry_malformed`.
- `tools/scripts/test-loredeck-null-timeline-registry.mjs` covers `timelineRegistry: null`, malformed `anchors`/`windows`, Library-pack normalization, and Pack Health reporting.

Verification passed:

```powershell
node tools\scripts\test-loredeck-null-timeline-registry.mjs
node tools\scripts\test-loredeck-manifest-runtime.mjs
node tools\scripts\test-repository-layout.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-state-safety-contract.mjs
node tools\scripts\test-prompt-injection-stale-state.mjs
node tools\scripts\test-loredeck-context-health.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-hp-reference-deck-conformance.mjs
node tools\scripts\test-jjk-reference-deck-conformance.mjs
node tools\scripts\test-hp-loredeck-health.mjs
node tools\scripts\test-jjk-loredeck-health.mjs
```

Live SillyTavern verification passed after syncing the changed source files into the active local extension checkout at `F:\SillyTavern\SillyTavern\data\default-user\extensions\Saga`:

- `http://127.0.0.1:8000/` served the patched `src/runtime/loredeck-package-helpers.js`.
- Loredecks tab rendered its Library launch content instead of the `Loredecks could not render` error.
- Context tab rendered Runtime Context content instead of the `Context could not render` error.
- No new browser console errors appeared during the Loredecks/Context pass.

### S2: Bundled Manifest Paths Resolve From `src/runtime`

Status: Fixed during the Pending Review smoke pass on 2026-06-11.

Observed in live runtime while duplicating a bundled Lorepack as Custom:

- Duplicate stayed open and showed `Manifest failed to load: HTTP 404`.
- The failing source manifest was `content/loredecks/hp-year-6-half-blood-prince/loredeck.json`.
- The runtime manifest helper resolved that path relative to `src/runtime/` instead of the extension content root.

Required fix:

- Resolve `content/loredecks/...` paths from the extension `content/loredecks/` root.
- Preserve existing behavior for remote URLs and non-content relative paths.
- Add a resolver contract covering bundled content paths and remote URLs.

Implementation notes:

- `src/runtime/loredeck-manifest-runtime.js` now maps `content/loredecks/...` and other `content/...` references from the extension root.
- `tools/scripts/test-loredeck-manifest-runtime.mjs` covers bundled content paths, dot-slash content paths, runtime-relative paths, and remote URLs.

### S3: Pending Review Queue Mutations Leave Open Metadata Editor Stale

Status: Fixed during the Pending Review smoke pass on 2026-06-11.

Observed in live runtime after queuing a new Custom Lorecard proposal:

- The toast reported `Queued pending entry change for codex smoke pending review entry.`
- Closing and reopening the metadata editor showed `1 pending`, proving persistence worked.
- The already-open editor still showed `0 pending`, so the visible queue state lagged behind saved state.

Required fix:

- Refresh an already-open Loredeck metadata editor after shared Loredeck record mutations.
- Keep the refresh scoped so mutations do not open metadata windows that were not already open.

Implementation notes:

- `persistLoredeckLibraryRecordMutation` now calls `refreshOpenLoredeckMetadataEditor(next.packId)` after saving and refreshing shared surfaces.
- `tools/scripts/test-visual-smoke-harness.mjs` asserts the mutation path keeps open metadata Pending Review counts fresh.

### S4: Deck Maker Generation Settings Summary Goes Stale

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed in live runtime while smoke-testing Deck Maker empty-project path:

- Opening Creator from the Library rendered the staged roadmap and `Draft the Scope Brief` task.
- Toggling `Show streaming progress snippets` changed the row state from `On` to `Off`.
- The Advanced Generation Settings summary still showed `Streaming snippets on`, so the compact summary disagreed with the control state.

Required fix:

- Re-render the Deck Maker generation settings summary after range, toggle, and reset actions persist a new value.
- Keep the update local to the settings disclosure; do not refresh the whole Deck Maker workbench for every control change.

Implementation notes:

- `renderLoredeckCreatorGenerationSettingsSummary` now owns the compact Advanced Generation Settings summary pills.
- Range rows, toggle rows, and `Reset Advanced Settings` call the shared summary refresh hook after they update settings.
- `tools/scripts/test-visual-smoke-harness.mjs` asserts the summary-refresh wiring exists.

### S5: Creator Advanced Settings Can Create A Blank Resumable Project

Status: Fixed locally on 2026-06-11. Live installed-extension retest and cleanup are pending.

Observed in live runtime after resetting Creator advanced settings with no Scope Brief project:

- Closing and reopening Creator changed the header from no active project to `Resumable job`.
- The Job & Cache panel showed `Last activity just now`.
- No actual Scope Brief, Fandom, Scope, generated pack, or project card existed, so the settings action had created an empty persisted Deck Maker job.

Required fix:

- Do not upsert a Deck Maker project when generation settings are changed before a real Deck Maker project exists.
- Keep no-project settings changes local to the open Creator session.
- Continue persisting settings changes for real Deck Maker projects, active generations, generated packs, or jobs with meaningful project data.

Implementation notes:

- `hasPersistableLoredeckCreatorProject` now gates whether generation settings should be written through `setLoredeckCreatorBriefCache`.
- `setLocalLoredeckCreatorGenerationSettings` stores no-project settings in the local Creator cache without assigning job metadata or `updatedAt`.
- The visual smoke harness asserts both guard helpers remain wired.

### S6: Canon Preview Add Selected And Selection Scroll Stability

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed in live runtime while adding selected canon suggestions:

- First click showed `Action failed: openPendingLoreReviewSections is not defined`.
- Second click showed `Select at least one new canon preview entry first.` because the failed path had already cleared the selected preview ids.
- Selecting suggested canon rows rebuilt the Lorecards tab and could snap the runtime scroll back to the top.

Required fix:

- Restore the local Pending Lore Review opener needed by canon add/suggest actions after the guide-prep extraction.
- Treat canon preview checkbox/select-pack/clear changes as selection-only updates that refresh rows, counts, and add buttons in place.
- Add the canon preview list to runtime nested-scroll preservation and wheel handoff.
- Audit similar selectable scroll surfaces and patch any missing scroll snapshot.

Implementation notes:

- `openPendingLoreReviewSections` now opens `lore.pendingReview` locally in `src/runtime/lore-panel.js`.
- `refreshCanonPreviewSelectionUi` updates canon preview row classes, checkboxes, selected count, and Add buttons without rebuilding the Lorecards tab.
- `src/runtime/runtime-shell.js` now treats `.saga-canon-preview-list` as a nested scroll surface.
- `src/loredecks/loredeck-workbench-panel.js` now captures/restores Workbench body, table, and detail scroll around row-selection rerenders.
- The visual smoke harness asserts the missing opener, in-place canon selection refresh, canon nested-scroll registration, and Loredeck Workbench scroll restore.

### S7: Assistant Draft Selection Scroll Stability

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during selectable-scroll audit after S6:

- Assistant and Deck Maker draft batch checkboxes updated `selectedDraftChangeIds`, then refreshed the full Lorecards tab.
- The draft list uses the same nested-scroll shape as canon preview and pending review, so selection-only changes could lose the user's scroll position in long draft batches.

Required fix:

- Keep Assistant/Deck Maker draft selection changes in the draft cache as the source of truth.
- Refresh selected counts, row selected state, checkboxes, and selection-dependent buttons in place.
- Keep full panel refreshes for queue/drop/revision paths because those paths change the draft list contents.
- Add the Assistant draft list to runtime nested-scroll preservation and wheel handoff.

Implementation notes:

- `refreshLoredeckAssistantDraftSelectionUi` updates Assistant/Deck Maker draft row classes, checkboxes, selected-count pills, and Queue/Drop/Revise/Select All/Clear Selection button states without rebuilding the Lorecards tab.
- Draft batch rows and action buttons now expose stable `data-saga-assistant-*` hooks for selection refresh.
- `src/runtime/runtime-shell.js` now treats `.saga-loredeck-assistant-draft-list` as a nested scroll surface.
- `styles/runtime.css` adds a dedicated selected-row state for Assistant/Deck Maker draft rows.
- The visual smoke harness asserts the in-place Assistant selection refresh, nested-scroll registration, and selected-row styling.

### S8: Deck Maker Title Selection Scroll Stability

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during selectable-scroll audit after S7:

- Deck Maker Title Pass checkboxes updated `selectedTitleDraftIds`, then refreshed the full Deck Maker workbench for a selection-only change.
- Long title batches use the same scrollable list pattern as Assistant drafts, so checkbox selection could lose position while reviewing generated title sets.

Required fix:

- Keep Deck Maker title selection changes in the runtime-owned Creator cache as the source of truth.
- Let `loredeck-creator-panel.js` refresh selected counts, row state, checkboxes, and selection-dependent buttons in place.
- Preserve active-generation button locks while updating selection-dependent revision affordances.
- Add the Deck Maker title list to runtime nested-scroll preservation and wheel handoff.

Implementation notes:

- `refreshLoredeckCreatorTitleSelectionUi` updates Deck Maker Title Pass row classes, checkboxes, selected-count pills, and Approve/Unapprove/Drop/Revise/Select All/Clear Selection button states without rebuilding the Deck Maker workbench.
- Title rows and action buttons now expose stable `data-saga-creator-title-*` hooks for selection refresh.
- `applyLoredeckCreatorGenerationButtonLock` marks generation-locked buttons so in-place refreshes do not re-enable them.
- `src/runtime/runtime-shell.js` now treats `.saga-loredeck-creator-title-list` as a nested scroll surface.
- `styles/runtime.css` adds a dedicated selected-row state for Deck Maker title rows.
- The visual smoke harness asserts the in-place Deck Maker title selection refresh, generation-lock preservation, nested-scroll registration, and selected-row styling.

### S9: Context Workbench Selection Scroll Stability

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during selectable-scroll audit after S8:

- Context Workbench timeline and loaded-Loredeck rows update selection state by re-rendering the workbench shell.
- Timeline, context, alias, validation, and inspector panes are independent scroll regions, so row selection or tab transitions could reset the user's position in long Context lists.

Required fix:

- Preserve Context Workbench scroll positions across centralized workbench rerenders.
- Focus the workbench overlay without moving page or overlay scroll.
- Add stable row keys for timeline items and loaded-Loredeck context rows so future partial refreshes and diagnostics do not depend on display text.

Implementation notes:

- `captureContextWorkbenchScrollState` and `restoreContextWorkbenchScrollState` preserve timeline, inspector, context, alias, and validation pane scroll positions around `renderContextWorkbench`.
- Context Workbench rerender focus now uses `preventScroll`.
- Timeline and loaded-Loredeck rows expose stable `data-saga-context-workbench-*` keys.
- The visual smoke harness asserts Context Workbench scroll capture/restore, row data hooks, and prevent-scroll focus.

### S10: Global Bridge Namespace And Cleanup

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during prompt-injector lifecycle audit:

- `src/continuity/prompt-injector.js` already exposes prompt helpers under `globalThis.Saga.promptInjection` and keeps the required `globalThis.sagaInterceptor` manifest/runtime hook.
- Other modules still published scattered debug helpers such as `_sagaBuildMemo`, `_sagaRefreshUI`, and extraction helpers directly on `globalThis`.
- Extension disable hid the runtime and uninstalled the prompt interceptor, but did not remove the debug bridge namespace.

Required fix:

- Keep `globalThis.sagaInterceptor` as the only required top-level runtime hook.
- Move debug and bridge helpers under `globalThis.Saga`.
- Keep prompt sync helpers under `globalThis.Saga.promptInjection`.
- Move UI/action/debug helpers under `globalThis.Saga.bridge`.
- Move continuity automation debug helpers under `globalThis.Saga.continuity`.
- Remove the bridge namespace during extension disable.

Implementation notes:

- `src/saga-namespace.js` now owns shared `globalThis.Saga` namespace creation.
- `src/extension/global-bridge.js` exposes `Saga.actions` and `Saga.bridge` instead of publishing `_saga*` globals, and exports `removeGlobalBridge` for disable cleanup.
- `src/extension/events.js` refreshes chat-change UI through `Saga.bridge.refreshUI` and removes the global bridge on extension disable.
- `src/continuity/extractor.js` publishes debug helpers under `Saga.continuity` and refreshes through `Saga.bridge.refreshUI`.
- `src/continuity/memo-builder.js` no longer publishes `_sagaBuildMemo`; `Saga.bridge.buildMemo` owns that helper.
- `src/continuity/prompt-injector.js` now uses the shared Saga namespace helper for `Saga.promptInjection`.
- Prompt lifecycle smoke contracts assert the namespace shape and the absence of scattered `_saga*` publications.

### S11: Package Export Original Source Type

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Package Import/Export contract audit:

- The package index helper already writes `source.originalType || pack.type || manifest.type`.
- The exported per-deck manifest still computed `source.originalType` as `fresh.type || sourceInfo.originalType || source.manifest.type`.
- That ordering can erase the original source type when a Custom copy was imported from a Bundled or Generated Lorepack and then exported again.

Required fix:

- Preserve exported original source type before the current library record type.
- Keep importer behavior paired with exporter behavior so lightweight bundled reimports can detect exported Bundled origins.

Implementation notes:

- `src/runtime/loredeck-package-export.js` now writes exported manifest source metadata with `sourceInfo.originalType || fresh.type || source.manifest.type`.
- `src/runtime/loredeck-package-install.js` already reads `sourceInfo.originalType || indexRecord.originalType` before choosing bundled reference import behavior.
- The visual smoke harness now asserts the per-deck manifest metadata ordering as well as the package index ordering.
- `tools/scripts/test-loredeck-zip-package.mjs` continues to pass for package parse/zip safety.

### S12: Provider Setting Saves Refresh Runtime Metrics

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Settings contract audit:

- Provider select changes rebuilt the Settings panel and refreshed the runtime header.
- Provider text fields such as OpenAI-compatible base URL and model used `refresh: false` to avoid rebuilding the form while the user was editing.
- Those field-level saves persisted settings but skipped the runtime header/rail refresh, so the compact Settings rail metric could show the previous provider/model until another full refresh.

Required fix:

- Keep field-level provider saves lightweight.
- Refresh runtime header/rail metrics for every persisted provider setting change.
- Continue avoiding full Settings panel rerenders for text-field commits.

Implementation notes:

- `saveProviderSetting` now calls `refreshRuntimeHeader()` immediately after `saveSettings(next)`.
- `options.refresh === false` now only suppresses the Settings panel body rerender, not runtime metric refresh.
- The visual smoke harness asserts provider setting saves update runtime rail/header metrics before the optional panel rerender branch.

### S13: Injection Sync Status Refresh

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Injection Preview contract audit:

- `Sync Injection Now` rebuilt SillyTavern prompt blocks and showed a toast.
- The `Current sync` row in Prompt Placement stayed stale until the whole Injection tab rerendered.
- `Refresh Injection Text` could also resync prompts without updating the visible sync status row.

Required fix:

- Keep prompt sync status visible without forcing a full Injection tab rebuild.
- Update the status row after manual sync and refresh-only sync.
- Preserve existing empty-reason and compression preview behavior.

Implementation notes:

- `getPromptInjectionStatusText` centralizes Prompt Placement status formatting.
- `refreshPromptInjectionStatusUi` updates the `.saga-prompt-sync-status` value in place.
- `Sync Injection Now` and `refreshInjectionPreviewOnly` now refresh the visible prompt sync status after `syncPromptInjection()`.
- Prompt stale-state and compression contracts continue to pass.

### S14: Settings Reset Refreshes Runtime Surfaces

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Settings and State Safety contract audit:

- Provider field saves now refresh runtime metrics, but shared settings reset helpers still only saved settings and rebuilt the panel body.
- Section resets are used by prompt placement, story lore automation, Context detection, Continuity scan, and Auto-Relevance settings.
- `Reset All Settings` can also change Theme Pack and Icon Set values, so the shelf icons and theme variables can stay stale after the success toast.

Required fix:

- Keep settings section resets lightweight.
- Refresh runtime header metrics after section reset saves.
- Refresh theme variables and shelf icon images after section resets and `Reset All Settings`.
- Keep State Safety state restore paths unchanged because exported state restore is state-only, not global settings restore.

Implementation notes:

- `resetSettingKeysToDefaults` now refreshes runtime theme/rail surfaces and the runtime header after saving defaulted keys.
- `Reset All Settings` now refreshes theme variables and rail icons from the saved default settings before rebuilding the body.
- `configureRuntimeSafetyPanel` wires the safety panel to the shell-owned `applyRuntimeTheme` and `refreshRuntimeRailIcons` path.
- `tools/scripts/test-state-safety-contract.mjs` now guards the settings reset refresh path.

### S15: Assistant Draft Cache Preserves Default Selection

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Assistant contract audit:

- Fresh Assistant and Deck Maker draft batches are intended to start with every draft selected for review actions.
- `updateLoredeckAssistantDraftCache` normalized missing `selectedDraftChangeIds` to an empty array before calling mutators.
- Future callers that upsert drafts through the helper without explicit selection metadata could accidentally turn the default selection from "all selected" into "nothing selected."

Required fix:

- Preserve the difference between no explicit draft selection and an explicit empty selection.
- Keep queue/drop/revise actions review-first and leave accepted Lorepacks untouched until Pending Review actions are accepted.
- Keep the existing in-place selection refresh and nested scroll behavior.

Implementation notes:

- `updateLoredeckAssistantDraftCache` now only normalizes `selectedDraftChangeIds` when the property is actually present.
- Missing `selectedDraftChangeIds` continues to mean "select every current draft" through `getLoredeckAssistantSelectedDraftIds`.
- The visual smoke harness now guards the helper-level selection default.
- `tools/scripts/test-loredeck-assistant.mjs` continues to pass for Assistant prompt/parse contracts.

### S16: Package Install Toasts Match Imported Records

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Package Import/Export contract audit:

- Package install used the number of selected preview rows as a fallback when the library import reported zero imported records.
- The commit path cached and selected every checked install row even when the store skipped a record.
- A skipped bundled-ID conflict could therefore produce a success-looking toast and transient UI state that did not match saved library state.

Required fix:

- Make the library import facade report exact imported and skipped pack IDs.
- Cache/select only records that were actually imported into the saved library.
- Report zero-import package installs as zero imports instead of falling back to selected count.

Implementation notes:

- `importLoredeckLibraryRegistry` now returns `importedPackIds` and `skippedPackIds` alongside counts.
- `commitLoredeckPackageInstall` now builds installed records from `result.importedPackIds`.
- The package install toast now uses the actual installed record count and has a zero-install message for all-skipped imports.
- `tools/scripts/test-loredeck-zip-package.mjs` and the visual smoke source contract cover the paired import/export path.

### S17: Injection Setting Changes Resync Prompt Blocks

Status: Fixed locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Injection Preview contract audit:

- `Sync Injection Now` and `Refresh Injection Text` updated visible sync status after S13.
- Injection toggles, relevance-tier enable switches, tier/direct mode buttons, and prompt placement controls still only saved settings and rebuilt the panel.
- Disabling Lore/Continuity injection or changing prompt placement could leave older SillyTavern extension prompt blocks live until a later lifecycle sync.

Required fix:

- Immediately resync prompt blocks after injection-affecting settings are saved.
- Keep compression-level sliders on the existing preview refresh path because it already rebuilds and syncs prompt text.
- Keep the visible `Current sync` row updated when it exists, and let full body rerenders read the latest sync status after redraw.

Implementation notes:

- `syncPromptInjectionFromCurrentSettings` centralizes best-effort prompt sync plus visible status refresh.
- Injection toggles, tier enable/mode controls, placement select/number controls, and legacy/direct mode buttons now call the helper after `saveSettings`.
- `tools/scripts/test-prompt-injection-stale-state.mjs` now guards immediate sync after injection-affecting settings saves.

### S18: Creator Local Contract Sweep

Status: Verified locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Creator contract audit:

- The earlier live Creator pass remains partial because installed-extension retest has not yet been rerun after S4/S5/S8 fixes.
- Deterministic Creator contracts cover project registry promotion, project-card models, generation recovery, coverage modeling, and coverage UI.
- Title selection, generation-button locking, scroll anchor restoration, generated export readiness, and finalization blockers are guarded by the visual smoke source contract.

Verification notes:

- `tools/scripts/test-loredeck-creator-projects.mjs` passed.
- `tools/scripts/test-loredeck-creator-project-models.mjs` passed.
- `tools/scripts/test-loredeck-creator-generation-recovery.mjs` passed.
- `tools/scripts/test-loredeck-creator-coverage-model.mjs` passed.
- `tools/scripts/test-loredeck-creator-coverage-ui.mjs` passed.
- No additional Creator mutation patch was made in this sweep; remaining risk is live workflow behavior.

### S19: Loredeck UI Kit Baseline

Status: Started locally on 2026-06-11. Live installed-extension retest is pending.

Observed during the UI extraction pass:

- Library, Workbench, and Deck Health all rendered similar empty, error, and status-pill surfaces directly.
- The generic `runtime-ui-kit.js` already owns base DOM primitives, so the Loredeck extraction should layer feature-specific helpers on top of it instead of creating a competing UI framework.
- The first slice should prove the helper boundary without moving state mutation, validation, package import/export, or editor workflows.

Implementation notes:

- Added `src/loredecks/loredeck-ui-kit.js` as a UI-only helper module.
- Library render-error fallback now uses `createLoredeckRenderErrorBody`.
- Library, Workbench, and Deck Health header/hero status surfaces now use `appendLoredeckStatusPills`.
- Workbench shell empty state now uses `createLoredeckEmptyState`.
- Deck Health render-error fallback now uses `createLoredeckRenderErrorCard`.
- `tools/scripts/test-visual-smoke-harness.mjs` now asserts the helper module exists and is used by Library, Workbench, and Deck Health.

Verification notes:

- `node --check src/loredecks/loredeck-ui-kit.js` passed.
- `node --check src/loredecks/loredeck-library-panel.js` passed.
- `node --check src/loredecks/loredeck-workbench-panel.js` passed.
- `node --check src/loredecks/loredeck-health-panel.js` passed.
- `node tools/scripts/test-visual-smoke-harness.mjs` passed.
- `node tools/scripts/test-loredeck-library-folders.mjs` passed.
- `node tools/scripts/test-loredeck-health-center-refresh.mjs` passed.
- `node tools/scripts/test-loredeck-assistant.mjs` passed.

Live smoke note:

- `tools/scripts/smoke-live-st-cdp.mjs` still blocks before navigation with `CDP Page.enable timed out`, including the repo-local `guide-harness` target. Treat this as smoke-harness infrastructure risk, not evidence that the installed extension passed or failed.

### S20: Filter And Selection Control Extraction

Status: Started locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Slice 2.2:

- Library and Workbench both hand-built search inputs, select filters, filtered-count summaries, and selection-count summaries.
- The behavior-specific parts are still different: Library owns folder/view/sort state, while Workbench owns row filters, selection, and direct bulk edit actions.
- The shared extraction should render the common controls while keeping refresh, mutation, and bulk action behavior in each panel.

Implementation notes:

- Added `src/loredecks/loredeck-filter-controls.js` for shared search inputs, select controls, and filtered-count text.
- Added `src/loredecks/loredeck-selection-toolbar.js` for shared selection summary formatting/rendering.
- Library search, view, sort, and selection summary now use the shared helpers.
- Workbench Lorecard search, relevance/category/status filters, filtered count, and bulk selection summary now use the shared helpers.
- Bulk action buttons, folder moves, exports, and Workbench direct edit actions remain owned by their existing panels.
- `tools/scripts/test-visual-smoke-harness.mjs` now asserts the helper modules exist and are adopted by Library and Workbench.

Verification notes:

- `node --check src/loredecks/loredeck-filter-controls.js` passed.
- `node --check src/loredecks/loredeck-selection-toolbar.js` passed.
- `node --check src/loredecks/loredeck-library-panel.js` passed.
- `node --check src/loredecks/loredeck-workbench-panel.js` passed.
- `node --check tools/scripts/test-visual-smoke-harness.mjs` passed.
- `node tools/scripts/test-visual-smoke-harness.mjs` passed.
- `node tools/scripts/test-loredeck-library-folders.mjs` passed.

### S21: Validation View Baseline

Status: Started locally on 2026-06-11. Live installed-extension retest is pending.

Observed during Slice 2.3:

- Deck Health severity cards and raw issue lists were still rendered directly in `loredeck-health-panel.js`.
- The issue grouping, issue-state mutation, repair actions, repair sessions, review choices, and health report construction are still feature-specific and should not move in the first validation-view slice.
- A useful extraction boundary is the reusable validation display shell: severity cards, severity grids, and raw issue-list rendering.

Implementation notes:

- Added `src/loredecks/loredeck-validation-view.js` as a UI-only validation/Pack Health helper module.
- Deck Health severity grid now delegates to `createLoredeckValidationSeverityGrid`.
- Deck Health raw issue sections now delegate to `createLoredeckValidationIssueList`.
- Deck Health issue grouping, ignore/resolved state, Attempt Fixing controls, repair-session actions, review-choice actions, and export behavior remain in `src/loredecks/loredeck-health-panel.js`.
- `tools/scripts/test-visual-smoke-harness.mjs` now asserts the helper module exists and is adopted by Deck Health.

Verification notes:

- `node --check src/loredecks/loredeck-validation-view.js` passed.
- `node --check src/loredecks/loredeck-health-panel.js` passed.
- `node --check tools/scripts/test-visual-smoke-harness.mjs` passed.
- `node tools/scripts/test-visual-smoke-harness.mjs` passed.
- `node tools/scripts/test-loredeck-health-center-refresh.mjs` passed.
- `node tools/scripts/test-hp-loredeck-health.mjs` passed.
- `node tools/scripts/test-jjk-loredeck-health.mjs` passed.

### S22: Validation Metrics And Category Lists

Status: Continued locally on 2026-06-11. Live installed-extension retest is pending.

Observed during the next Slice 2.3 pass:

- Deck Health coverage and advanced views still rendered compact metric tiles locally.
- Health category rows were also local display-only code.
- These surfaces are reusable validation-display primitives and do not own issue state or repairs.

Implementation notes:

- `src/loredecks/loredeck-validation-view.js` now exports `createLoredeckValidationMetric`.
- `src/loredecks/loredeck-validation-view.js` now exports `createLoredeckValidationCategoryList`.
- Deck Health metric tiles now delegate through `createLoredeckHealthMetric` to the shared validation helper.
- Deck Health category rows now delegate through `createLoredeckHealthCategoryList` to the shared validation helper.
- `tools/scripts/test-visual-smoke-harness.mjs` now asserts metric/category helper ownership and Pack Health adoption.

Verification notes:

- `node --check src/loredecks/loredeck-validation-view.js` passed.
- `node --check src/loredecks/loredeck-health-panel.js` passed.
- `node --check tools/scripts/test-visual-smoke-harness.mjs` passed.
- `node tools/scripts/test-visual-smoke-harness.mjs` passed.
- `node tools/scripts/test-loredeck-health-center-refresh.mjs` passed.
- `node tools/scripts/test-hp-loredeck-health.mjs` passed.
- `node tools/scripts/test-jjk-loredeck-health.mjs` passed.

## Pass 1: Stabilization

### Goal

Prove the current split works as a user-facing extension before further extraction. This pass should catch wiring mistakes, stale imports, CSS cascade mistakes, broken action routes, and state persistence regressions.

### Non-Goals

- Do not redesign the runtime shell.
- Do not rename user-facing concepts.
- Do not start a broad dead-selector cleanup yet.
- Do not add legacy compatibility layers for pre-alpha internal paths.
- Do not combine new features with stabilization unless the feature is required to fix a blocker.

### Stabilization Checklist

| Area | What to verify | Pass criteria |
| --- | --- | --- |
| Extension boot | SillyTavern loads Saga and opens the shelf. | No console errors from `src/extension/index.js` or split bootstrap modules. |
| Runtime shell | Open, close, minimize, resize, focus, and tab routing. | Shell geometry and focus behavior survive tab changes and reopen. |
| Basic workflow | Start Checklist, readiness, guided task entry points. | Checklist state and action buttons route through the shared action path. |
| Advanced workflow | Advanced rail entries and domain panel entry points. | Advanced-only panels remain reachable and do not leak into Basic mode. |
| Lorepack Library | Empty state, selection, folders, stack controls, package controls, malformed timeline data. | No accidental first-deck auto-selection, stale selection, duplicated stack rows, or null-registry render crashes. |
| Package import/export | Local `.saga-loredeck.zip` export, preview, install, duplicate handling. | Exported packages import as expected and preserve source/update metadata. |
| Generated-to-Custom | Deck Maker output, readiness, finalization, export/install. | Generated Lorepacks can become Custom Lorepacks without losing accepted content. |
| Pack Health | Scan, grouped issues, ignore/resolve, Attempt Fixing, repair sessions, and review choices. | Pack Health remains advisory where intended and saves remaining review/model/manual work with clear next actions. |
| Context | Current Context controls, resolver fallback, manual lock/reset, Context Browser entry, malformed active-stack data. | Context changes persist, affect candidate/injection behavior, and do not crash when a Lorepack timeline registry is incomplete. |
| Injection preview | Preview, stale accepted Lorecard blocking, prompt injector state. | Context-blocked entries do not inject and the audit explains why. |
| Settings | Provider, Basic/Advanced mode, theme, and runtime settings. | Settings save, survive reopen, and update the runtime surfaces. |
| Prompt injector lifecycle | Global registration, debug namespace, uninstall path if present. | Only required SillyTavern globals are exposed; cleanup does not leave stale hooks. |

### Feature-By-Feature Functionality Pass

Stabilization should proceed feature by feature. Each feature must prove its normal path, empty path, malformed-data path, persistence path, and cross-feature handoff before the next UI extraction slice depends on it.

| Feature | Functionality to prove | Regression focus |
| --- | --- | --- |
| Runtime frame | Mount, open, close, minimize, reset window, mode switch, tab switch, error boundary recovery. | A failed tab must not collapse the whole runtime or strand the user without `Return to Session` and `Reset Window`. |
| Lorepack Library | Load bundled, Custom, and Generated Lorepacks; render no-selection empty state; select/de-select; folder navigation; bulk selection; stack add/remove/reorder; local package import/export. | Null or malformed timeline registry data must not crash `getLoredeckLibrary` or the Library tab. |
| Active Stack | Show enabled stack, ordering, source type, Pack Health status, and action affordances. | Stack rows must not duplicate or preserve deleted/stale records after refresh. |
| Context | Render selected/loaded Lorepack Contexts, manual lock/reset, resolver fallback, Context Browser launch, current Story Position. | Context must tolerate incomplete active-stack Lorepack metadata and report invalid data through health surfaces. |
| Pending Review | Show queued entry/tag/timeline patches, accept/reject one, accept/reject all, jump from Deck Maker/Assistant/Health. | Toast success must match saved state, not just local UI mutation. |
| Workbench | Open a Custom Lorepack, edit entries, overrides, tags, timeline records, and queue reviewable changes. | Editor actions must not bypass Pending Review or lose schema v3 Context/retrieval fields. |
| Pack Health | Scan selected and active Lorepacks, group issues, ignore/resolve advisories, run Attempt Fixing, continue repair sessions, and apply review choices. | Malformed timeline registries are health findings, not runtime render failures. |
| Creator | Create brief, titles, timeline/tag plan, micro-batch entries, review generated content, finalize to Generated Lorepack, export/install as Custom. | Partial generation failures must preserve completed batches and not unlock downstream steps prematurely. |
| Assistant | Parse proposals, edit JSON, select/drop/queue proposals, revise selected proposals, create repair drafts from health findings. | Assistant proposals must remain review-first and should not directly mutate active Lorepacks. |
| Package Import/Export | Export selected Lorepacks, preview package, install Custom copy, detect duplicate/update choices, preserve source/update metadata. | Import and export remain a paired contract for Bundled, Generated, and Custom sources. |
| Injection Preview | Preview prompt output, show active and blocked accepted Lorecards, explain Context blocks, verify prompt injector status. | Stale accepted Lorecards must remain stored but not inject outside active Context gates. |
| Settings | Save provider, mode, theme, automation, prompt, and runtime settings; reopen and confirm state. | Settings UI success must reflect persisted state. |

Do not mark a feature stable from a render-only pass. At minimum, each feature needs one state-changing action and one refresh/reopen check when the feature owns persisted data.

### Feature Pass Log

Current live pass notes:

| Date | Feature | Result | Evidence |
| --- | --- | --- | --- |
| 2026-06-11 | Runtime frame | Pass | Live SillyTavern runtime opened; density toggle changed rail mode from expanded to compact; close removed the shell; reopen restored it; reset left the shell visible with drawer closed; no new console errors. |
| 2026-06-11 | Lorepack Library | Pass | Live Library overlay opened; selected `hp-year-6-half-blood-prince`; added it to the active stack; removed it back to zero active stack items; closed the overlay; no render errors or new console errors. |
| 2026-06-11 | Context | Pass | Live Context tab rendered Runtime Context content after the S1 fix; no `Context could not render` card and no new console errors. |
| 2026-06-11 | Active Stack | Pass | Live Library Active Stack pane added `hp-year-6-half-blood-prince` as priority 1 with 59 Lorecards, then removed it back to the `No active stack` empty state; no render errors or new console errors. |
| 2026-06-11 | Pack Health | Pass | Live Deck Health Center opened for `hp-year-6-half-blood-prince`; Overview, Issues, Coverage, Files, and Advanced tabs rendered; Refresh Scan updated the report; closed cleanly with no render errors or new console errors. |
| 2026-06-11 | Pending Review | Pass | Live Custom duplicate flow exposed and fixed bundled manifest resolution; queued a new Lorecard proposal, verified it persisted after reopen, fixed stale open-editor Pending Review counts, rejected it through confirmation, and deleted the temporary Custom copy back to 43 decks; no new console errors. |
| 2026-06-11 | Workbench | Pass | Live Custom duplicate opened in Workbench with 59 Lorecards; Registries rendered without error; a Lorecard note edit saved, survived full page reload, and reopened with the persisted value; temporary Custom copy was deleted back to 43 decks; no new console errors. |
| 2026-06-11 | Creator | Partial | Live empty-project Creator path opened from Library and rendered the staged roadmap/current task; advanced settings mutation exposed S4 stale summary and S5 blank resumable-project creation; both are fixed locally and covered by targeted checks, but installed-extension sync/live retest is pending. |

Remaining feature passes:

- Creator.
- Assistant.
- Package Import/Export.
- Injection Preview.
- Settings.

### Deterministic Validation

Run the fast contracts before and after stabilization fixes:

```powershell
node tools\scripts\test-repository-layout.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-state-safety-contract.mjs
node tools\scripts\test-prompt-injection-stale-state.mjs
```

Run targeted tests when the touched area overlaps them:

```powershell
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-creator-projects.mjs
node tools\scripts\test-loredeck-assistant.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-hp-reference-deck-conformance.mjs
node tools\scripts\test-jjk-reference-deck-conformance.mjs
```

Add or update targeted regression coverage for S1:

```powershell
node tools\scripts\test-loredeck-null-timeline-registry.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

Run syntax checks on touched modules:

```powershell
node --check src\runtime\lore-panel.js
node --check src\loredecks\loredeck-library-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check src\loredecks\loredeck-health-panel.js
node --check src\loredecks\loredeck-creator-panel.js
node --check src\loredecks\loredeck-assistant.js
node --check src\extension\index.js
node --check src\continuity\prompt-injector.js
```

### Manual Smoke Notes

Record manual findings as short, reproducible notes:

```text
Area:
Setup:
Steps:
Expected:
Actual:
Console:
State persistence:
Screenshot or fixture:
```

Keep real SillyTavern chat data local. If a bug needs a committed fixture, reduce it to a compact synthetic fixture first.

### Stabilization Exit Criteria

The stabilization pass is complete when:

- S1 is fixed and covered by regression tests.
- The fast contract checks pass.
- The primary runtime shelf opens and navigates without console errors.
- Library, Pack Health, Context, Creator, and Injection Preview each complete one manual smoke path.
- Each row in the feature-by-feature functionality pass has a current pass/fail note.
- Settings and core state mutations survive reopen or refresh.
- No blocker requires reverting the module split.
- Follow-up issues are either fixed or documented with owner module, reproduction, and severity.

## Pass 2: Loredeck UI Extraction

### Goal

Reduce repeated UI and workflow rendering across Library, Workbench, Creator, Assistant, and Pack Health without changing product behavior. Rendering helpers should make panels smaller and more consistent while state mutations remain in stores, services, or action modules.

### Extraction Rules

- Extract behavior by repeated pattern, not by line count alone.
- Helpers should receive explicit data and callbacks.
- Rendering helpers should not import `state-manager.js` directly.
- Shared modules should stay Loredeck-specific. Do not build a generic app framework.
- Keep user-facing terms tight: `Bundled Lorepack`, `Generated Lorepack`, `Custom Lorepack`, and `Pack Health`.
- Preserve CSS selector behavior during extraction. Selector cleanup comes after the UI ownership pass.
- Route import, export, duplicate, delete, finalize, validate, and repair behavior through action adapters instead of one-off panel handlers where practical.

### Target Modules

| Module | Responsibility |
| --- | --- |
| `src/loredecks/loredeck-ui-kit.js` | Cards, rows, chips, section headers, empty states, error states, and small repeated Loredeck controls. |
| `src/loredecks/loredeck-filter-controls.js` | Search, sort, filter, folder filter, status filter, and matching state helpers. |
| `src/loredecks/loredeck-validation-view.js` | Pack Health summaries, validation issue rows, severity chips, grouped result views, and repair affordance shells. |
| `src/loredecks/loredeck-job-view.js` | Async generation, import, export, update, scan, and repair progress rows. |
| `src/loredecks/loredeck-action-rows.js` | Shared action bars for import, export, duplicate, delete, install, finalize, validate, repair, and review queue handoff. |
| `src/loredecks/loredeck-selection-toolbar.js` | Multi-select counts, range-select affordances, bulk action enablement, and selection summaries. |

If an existing module already owns part of this work, extend it instead of creating a competing helper.

### Recommended Slice Order

#### Slice 2.1: UI Kit Baseline

Status: Started in S19. The baseline helper module exists and is adopted by Library, Workbench, and Deck Health for low-risk shell surfaces.

Extract the lowest-risk repeated render helpers first:

- Empty states.
- Loading states.
- Error states.
- Status chips.
- Small metadata rows.
- Repeated section headers.

Start with `loredeck-library-panel.js`, then adopt the helpers in Workbench and Pack Health.

Validation:

```powershell
node --check src\loredecks\loredeck-ui-kit.js
node --check src\loredecks\loredeck-library-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check src\loredecks\loredeck-health-panel.js
node tools\scripts\test-visual-smoke-harness.mjs
```

#### Slice 2.2: Filters, Search, And Selection

Status: Started in S20. Shared filter/search/count and selection-summary helpers exist and are adopted by Library and Workbench for the first low-risk controls.

Extract search/filter/sort controls and selection toolbar behavior from Library and Workbench.

Focus areas:

- Query input rendering.
- Filter button groups.
- Sort menus.
- Folder and source filters.
- Selected count text.
- Bulk action enablement.
- Clear selection actions.

Validation:

```powershell
node --check src\loredecks\loredeck-filter-controls.js
node --check src\loredecks\loredeck-selection-toolbar.js
node --check src\loredecks\loredeck-library-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

#### Slice 2.3: Validation And Pack Health Views

Status: Continued through S22. The shared validation view helper exists and Deck Health uses it for severity grids, raw issue sections, metric tiles, and category lists; grouped issue triage and repair actions remain panel-owned.

Extract shared validation result rendering from Pack Health, Workbench, Creator, and Assistant.

Focus areas:

- Severity summaries.
- Issue group rows.
- Advisory vs blocking language.
- Attempt Fixing affordances.
- Repair-session and review-choice shells.
- Validation result details.

Validation:

```powershell
node --check src\loredecks\loredeck-validation-view.js
node --check src\loredecks\loredeck-health-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check src\loredecks\loredeck-creator-panel.js
node --check src\loredecks\loredeck-assistant.js
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-loredeck-assistant.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

#### Slice 2.4: Async Job And Progress Views

Status: Continued through S24. The shared job view helper exists; Deck Maker uses it for live generation status rows, and the Loredecks Deck Maker project shelf uses it for staged progress bars. Deck Maker still owns generation state, cancellation, and recovery behavior. Assistant, import/export, update checks, scans, and repairs still need adoption.

Extract repeated job status rendering from Deck Maker, Assistant, import/export, update checks, scans, and repairs.

Focus areas:

- Pending/running/succeeded/failed rows.
- Retry affordances.
- Partial success summaries.
- Provider call progress.
- Batch progress and resumable job state display.

Validation:

```powershell
node --check src\loredecks\loredeck-job-view.js
node --check src\loredecks\loredeck-creator-panel.js
node --check src\loredecks\loredeck-assistant.js
node --check src\loredecks\loredeck-library-panel.js
node tools\scripts\test-loredeck-creator-projects.mjs
node tools\scripts\test-loredeck-assistant.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

### S23: Loredeck Job View Baseline

What changed:

- Added `src/loredecks/loredeck-job-view.js` as a UI-only async job/progress row helper.
- Moved Creator live generation row markup into `createLoredeckJobStatusRow`.
- Kept Creator-specific wait messaging, generation matching, cancellation, and recovery in `src/loredecks/loredeck-creator-panel.js`.
- Added visual harness assertions that the shared job view exists and Creator routes generation status through it.

Validation:

```powershell
node --check src\loredecks\loredeck-job-view.js
node --check src\loredecks\loredeck-creator-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-creator-projects.mjs
node tools\scripts\test-loredeck-creator-generation-recovery.mjs
node tools\scripts\test-loredeck-creator-project-models.mjs
node tools\scripts\test-loredeck-creator-coverage-ui.mjs
node tools\scripts\test-repository-layout.mjs
```

### S24: Deck Maker Project Progress Bar Extraction

What changed:

- Added shared progress-bar rendering to `src/loredecks/loredeck-job-view.js`.
- Moved the Deck Maker project shelf progress meter in `src/loredecks/loredecks-tab-panel.js` through `createLoredeckJobProgressBar`.
- Kept project filtering, selection, folder moves, resume, Library handoff, and deletion behavior in the Loredecks tab panel.
- Added visual harness assertions that Deck Maker project shelf progress uses the shared job view helper.

Validation:

```powershell
node --check src\loredecks\loredeck-job-view.js
node --check src\loredecks\loredecks-tab-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-creator-projects.mjs
node tools\scripts\test-loredeck-creator-project-models.mjs
node tools\scripts\test-repository-layout.mjs
```

#### Slice 2.5: Action Rows And Workflow Commands

Status: Continued through S31. The shared action-row helper exists and busy-button lifecycle adoptions now cover package install/export, Deck Health refresh, Loredeck editor load/validation, runtime metadata/finalize/duplicate/repair flows, Library refresh, and Workbench save/delete/restore/duplicate/load flows. Library, Health, Workbench, and runtime Loredeck review-handoff rows also use the shared row helper. Workbench delete, bulk edit, restore, and duplicate confirmations now share the confirmed-busy lifecycle helper. Deck Health grouped issue repair actions are isolated behind a dedicated action-row builder.

Extract repeated action row rendering and command wiring. Keep implementation in domain services, stores, or action registries.

Focus areas:

- Import/export buttons.
- Duplicate/delete confirmation rows.
- Install/update/reinstall choices.
- Finalize Generated Lorepack.
- Validate/rerun Pack Health.
- Queue repair to Pending Review.
- Open in Workbench, Creator, Assistant, Context, or Runtime.

Validation:

```powershell
node --check src\loredecks\loredeck-action-rows.js
node --check src\loredecks\loredeck-library-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check src\loredecks\loredeck-health-panel.js
node --check src\loredecks\loredeck-creator-panel.js
node --check src\loredecks\loredeck-assistant.js
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

### S25: Action Row And Busy Button Baseline

What changed:

- Added `src/loredecks/loredeck-action-rows.js` as a UI-only action-row and async button lifecycle helper.
- Moved package install and package export button busy handling through `withLoredeckActionButtonBusy`.
- Moved Deck Health refresh scan busy handling through the shared helper.
- Moved Loredeck editor loader and validation button busy handling through `setLoredeckActionButtonBusy`.
- Kept import/export, validation, backup, cache, scan, and persistence behavior in their existing domain modules.
- Added visual harness assertions that the shared action helper exists and the first adoption points stay wired.

Validation:

```powershell
node --check src\loredecks\loredeck-action-rows.js
node --check src\runtime\loredeck-package-install-panel.js
node --check src\runtime\loredeck-package-export.js
node --check src\loredecks\loredeck-health-panel.js
node --check src\runtime\loredeck-editor-loader.js
node --check src\runtime\loredeck-editor-validation.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S26: Runtime Loredeck Action Busy Lifecycle Adoption

What changed:

- Moved runtime Loredeck metadata registration, Attempt Fixing, package export, manifest sync, metadata save, Generated-to-Custom finalization, and duplicate-as-Custom busy-button handling through `setLoredeckActionButtonBusy`.
- Kept runtime editor/finalization logic in `src/runtime/lore-panel.js`; this pass only removes repeated button disable/text/restore boilerplate.
- Added visual harness assertions that runtime finalize, duplicate, and repair flows use the shared action helper.

Validation:

```powershell
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S27: Library And Workbench Busy Lifecycle Adoption

What changed:

- Moved Loredeck Library refresh busy-button handling through `setLoredeckActionButtonBusy`.
- Moved Deck Health report refresh busy-button handling through the same helper.
- Moved Loredeck Workbench tag/timeline save/delete, bulk apply/delete/restore/duplicate, new Lorecard create, and Lorecard row loading busy states through the shared helper.
- Kept Workbench persistence, confirmation, selection, cache reload, and Deck Health stale-state logic in `src/loredecks/loredeck-workbench-panel.js`.
- Added visual harness assertions that Library, Health, and Workbench use the shared busy-button helper.

Validation:

```powershell
node --check src\loredecks\loredeck-library-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check src\loredecks\loredeck-health-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S28: Shared Action Row Adoption

What changed:

- Moved straightforward `saga-primary-actions` row creation in Loredeck Library, Deck Health, and Loredeck Workbench through `createLoredeckActionRow`.
- Left the Library cover action overlay as a local custom control because it is not a primary action row.
- Kept button creation, command handlers, confirmation, persistence, and navigation owned by the existing panels.
- Added visual harness assertions that Library, Health, and Workbench use the shared action-row helper.

Validation:

```powershell
node --check src\loredecks\loredeck-library-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check src\loredecks\loredeck-health-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S29: Runtime Review-Handoff Action Row Adoption

What changed:

- Moved runtime Loredeck Pending Review bulk actions through `createLoredeckActionRow`.
- Moved Assistant draft batch Queue/Send/Drop/Select/Clear and revision actions through the shared action-row helper.
- Moved runtime duplicate-as-Custom, entry override, bulk tag, tag definition, tag rename, bulk Context, timeline anchor, and timeline window review-handoff dialog rows through the helper.
- Left confirmation, backup, queueing, persistence, and validation logic in `src/runtime/lore-panel.js`.
- Left generation-specific action rows local because they carry additional generation styling and are not part of the Loredeck action-row extraction target.
- Added visual harness assertions for Pending Review, Assistant draft handoff, duplicate, entry override, bulk tag, and bulk Context action rows.

Validation:

```powershell
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-repository-layout.mjs
```

### S30: Workbench Confirmed Busy Action Lifecycle

What changed:

- Added `withLoredeckConfirmedActionButton` to `src/loredecks/loredeck-action-rows.js`.
- Moved Loredeck Workbench tag delete, timeline delete, bulk apply, selected delete, selected restore, and selected duplicate flows through the confirmed-busy helper.
- Kept confirmation titles/messages, validation guards, persistence mutations, and Workbench save-state updates owned by `src/loredecks/loredeck-workbench-panel.js`.
- Updated the visual harness so save/create/load still assert the direct busy helper, while destructive and bulk Workbench flows assert the confirmed-busy helper.

Validation:

```powershell
node --check src\loredecks\loredeck-action-rows.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S31: Deck Health Grouped Repair Action Row Extraction

What changed:

- Added `createLoredeckHealthIssueActionRow` inside `src/loredecks/loredeck-health-panel.js`.
- Moved grouped issue copy, file-copy, duplicate-as-Custom, ignore/resolved state, malformed tag review, and Attempt Fixing buttons out of the issue detail renderer.
- Kept issue-state mutation, repair commands, repair-session controls, review-choice controls, and overlay refresh logic in the Deck Health panel.
- Added visual harness coverage so grouped Deck Health repair actions remain isolated behind the shared action-row helper.

Validation:

```powershell
node --check src\loredecks\loredeck-health-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

## Runtime Follow-Up After UI Extraction

After the shared Loredeck UI helpers are in place, return to `src/runtime/lore-panel.js` for one focused trim. Do not keep extracting runtime code while the Loredeck panel ownership is still moving.

Preferred follow-up modules:

| Module | Responsibility |
| --- | --- |
| `src/runtime/loredeck-health-repair-panel.js` | Runtime-facing Pack Health repair groups, issue selection, and repair entry points. |
| `src/runtime/loredeck-editor-actions.js` | Save, sync, duplicate, finalize, invalidate, and refresh actions shared by runtime editor surfaces. |
| `src/runtime/loredeck-entry-overrides-panel.js` | Entry override rendering and override-specific action wiring. |
| `src/runtime/loredeck-tag-manager-panel.js` | Runtime tag registry and tag editing shell if it still lives in `lore-panel.js`. |
| `src/runtime/loredeck-timeline-registry-panel.js` | Runtime timeline registry and anchor/window editing shell if it still lives in `lore-panel.js`. |
| `src/runtime/generated-loredeck-workflow.js` | Generated-to-Custom and Creator bridge behavior still embedded in the runtime controller. |

Runtime follow-up is done when `lore-panel.js` no longer owns large domain-specific Pack Health, editor, tag, timeline, package, or Deck Maker workflow renderers.

### S32: Runtime Loredeck Editor Actions Extraction

Status: Started the runtime follow-up trim after the Loredeck UI helper pass.

What changed:

- Added `src/runtime/loredeck-editor-actions.js` as the command owner for runtime Loredeck metadata save/sync, Attempt Fixing, package export, duplicate-as-Custom, and Generated-to-Custom finalization.
- Moved duplicate record construction, Generated finalization record construction, finalized entry rewriting, duplicate tag defaults, and unique pack-id generation into the action module.
- Kept `src/runtime/lore-panel.js` as the composition layer by importing the extracted action functions directly for current call sites.
- Kept local rendering, open-dialog wiring, pending-review mutation, tag/timeline editors, and registry normalizers in `lore-panel.js` for later focused panel extractions.
- Added visual harness coverage that the action module owns the implementations and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-editor-actions.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S33: Runtime Entry Override Card Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-entry-overrides-panel.js` for the runtime Lorecard Overrides card and entry row renderer.
- Moved Load/New/Bulk Tags/Bulk Context/Repair Overrides action row rendering, entry search, source-entry list display, edit/disable/remove row actions, and empty/error states out of `src/runtime/lore-panel.js`.
- Kept Pending Review, Assistant, timeline registry, and tag manager subpanels injected from `lore-panel.js`; timeline and tag manager rendering were extracted in later passes.
- Kept mutation functions such as disable/remove override and dialog openers in `lore-panel.js` for now.
- Added visual harness coverage that the entry override card and row live in the extracted module and `lore-panel.js` delegates rendering to it.

Validation:

```powershell
node --check src\runtime\loredeck-entry-overrides-panel.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S34: Runtime Timeline Registry Card Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-timeline-registry-panel.js` for the runtime Timeline Registry card and row renderer.
- Moved timeline summary pills, source-cache error display, Load/New/Export action row, timeline search, timeline list rendering, and row actions out of `src/runtime/lore-panel.js`.
- Kept timeline registry item builders, merged export data construction, anchor/window dialogs, and timeline mutation functions in `lore-panel.js` for later focused data/action extraction.
- Kept the small date-range formatter in `lore-panel.js` because Context Workbench timeline coordinates still use it outside the registry card.
- Added visual harness coverage that timeline registry rendering lives in the extracted module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-timeline-registry-panel.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S35: Runtime Tag Manager Card Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-tag-manager-panel.js` for the runtime Tag Manager card and row renderer.
- Moved tag summary pills, source-cache error display, Load/New/Bulk/Export action row, tag search, tag list rendering, and row actions out of `src/runtime/lore-panel.js`.
- Kept tag registry item builders, merged export data construction, tag definition/rename dialogs, and tag mutation functions in `lore-panel.js` for later focused data/action extraction.
- Added visual harness coverage that tag manager rendering lives in the extracted module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-tag-manager-panel.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S36: Runtime Pending Review Card Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-pending-review-panel.js` for the runtime Pending Review Queue card and pending-change row renderer.
- Moved pending summary pills, Accept All/Reject All/Validate Deck action row, empty state, pending list cap, and per-change Accept/Reject row actions out of `src/runtime/lore-panel.js`.
- Kept shared pending diff, quality, risk, and health-impact helpers in `lore-panel.js` because Assistant draft review rows still use the same helper output.
- Kept pending acceptance/rejection persistence and Deck Health refresh lifecycle in `lore-panel.js`.
- Added visual harness coverage that Pending Review rendering lives in the extracted module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-pending-review-panel.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S37: Runtime Assistant Review Card Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-assistant-review-panel.js` for the runtime Lore Assistant card, Assistant Draft Batch card, and draft row renderer.
- Moved assistant summary pills, instruction/mode/target controls, Draft Proposals/Load Context action row, result summary, draft selection controls, revise-selected form, and per-draft Queue/Edit JSON/Drop row actions out of `src/runtime/lore-panel.js`.
- Kept assistant generation, revision, draft cache mutation, queue/drop persistence, JSON editor, and provider calls in `lore-panel.js`.
- Reused the existing Pending Review diff, quality, risk, and health-impact helpers through the extracted panel dependency map so Assistant draft rows and Pending Review rows keep identical review language.
- Added visual harness coverage that Assistant review rendering lives in the extracted module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-assistant-review-panel.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S38: Runtime Review Helper Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-review-helpers.js` for shared Pending Review and Assistant review helper logic.
- Moved pending action/target/source formatting, confidence/risk parsing, risk pills, quality rubric pills/lists, health-impact/stale pills, and pending diff preview construction out of `src/runtime/lore-panel.js`.
- Configured the helper module with read-only access to entry preview cache, tag/timeline registry readers, and normalizers so diff previews remain behaviorally identical without giving the helper module persistence ownership.
- Kept pending change creation, acceptance/rejection, patch application, and Deck Health refresh lifecycle in `lore-panel.js`.
- Added visual harness coverage that review diff/quality/health-impact helpers live in the extracted module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-review-helpers.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S39: Runtime Pending Change Model Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-pending-change-model.js` for runtime pending-change ID normalization, pending-change normalization, record-patch creation, and record-patch application.
- Moved pure pending-change model helpers and tag/timeline patch application helpers out of `src/runtime/lore-panel.js`.
- Configured the model module with the existing tag and timeline normalizers so accepted pending changes continue to apply entry, tag registry, and timeline registry patches identically.
- Kept queueing, acceptance/rejection, persistence, Deck Maker planning acknowledgement, Deck Health refresh, and UI refresh lifecycle in `lore-panel.js`.
- Added visual harness coverage that pending-change normalization and patch application live in the extracted module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-pending-change-model.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S40: Runtime Pending Change Action Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-pending-change-actions.js` for pending-change queue, accept, reject, and post-accept Deck Health refresh lifecycle.
- Moved queueing, acceptance, rejection, accepted-change patch application, stale-health marking, generated-pack derived metadata refresh, Deck Maker planning accepted-batch tracking, and post-action UI refresh out of `src/runtime/lore-panel.js`.
- Kept the action module configured by `lore-panel.js` with persistence, validation, Creator cache, provider cache clearing, and UI refresh dependencies.
- Left edit proposal builders for a later focused slice so S40 stayed limited to pending-change persistence and lifecycle behavior.
- Added visual harness coverage that pending-change actions live in the extracted action module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-pending-change-actions.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S41: Runtime Edit Proposal Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Added `src/runtime/loredeck-edit-proposals.js` for runtime Loredeck edit proposal queue builders.
- Moved entry override, entry disable/restore, tag definition, tag rename, timeline anchor/window, timeline disable/restore, bulk tag update, and bulk Context update pending-change payload creation out of `src/runtime/lore-panel.js`.
- Kept dialog rendering, field validation, row-to-entry conversion, and editor-specific form helpers in `lore-panel.js` so this slice only changes proposal ownership.
- Replaced the inline bulk Context queue payload with `queueLoredeckBulkContextUpdate`, which also keeps the preview label tied to the built `contextGate`.
- Added visual harness coverage that proposal builders live in the extracted module and `lore-panel.js` delegates to it.

Validation:

```powershell
node --check src\runtime\loredeck-edit-proposals.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S42: Runtime Loredeck Checkbox Field Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Moved the generic runtime Loredeck checkbox/toggle field helper from `src/runtime/lore-panel.js` into `src/runtime/loredeck-editor-fields.js`.
- Kept tag registry and tag rename dialogs in `lore-panel.js`, but made them use the shared editor field helper alongside the existing input/select/section helpers.
- Added visual harness coverage that checkbox field creation lives in the shared editor field module and is imported by `lore-panel.js`.

Validation:

```powershell
node --check src\runtime\loredeck-editor-fields.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

### S43: Runtime Bulk Tag Model Extraction

Status: Continued the runtime follow-up trim.

What changed:

- Moved bulk tag set operations, bulk tag override row construction, and bulk tag update calculation from `src/runtime/lore-panel.js` into `src/runtime/loredeck-edit-proposals.js`.
- Configured the edit proposal module with the existing entry schema, Lorecard normalization, schema v3 normalization, and entry tag readers used by the old panel-local implementation.
- Kept tag stats, tag manager rendering, malformed-tag repair orchestration, and bulk tag dialog UI in `lore-panel.js`; they now call the extracted bulk tag model helpers.
- Added visual harness coverage that the bulk tag model helpers live in the extracted module and are no longer declared in `lore-panel.js`.

Validation:

```powershell
node --check src\runtime\loredeck-edit-proposals.js
node --check src\runtime\lore-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-repository-layout.mjs
```

## Dead Selector And Import Audit

Run this only after the stabilization and UI extraction passes.

Audit targets:

- CSS selectors left behind by moved panels.
- Imports that still point at old implementation modules.
- Internal compatibility aliases created during extraction.
- Duplicated action handlers in UI, slash commands, menu actions, and debug bridge.
- Test fixtures or docs that describe old file ownership.

Suggested commands:

```powershell
node tools\scripts\test-repository-layout.mjs
node tools\scripts\test-visual-smoke-harness.mjs
rg "lore-panel" src docs tools tests
rg "Deck Health" src docs tools tests
rg "TODO|FIXME|compat|legacy" src docs tools tests
```

Use the results carefully. Some terms may be intentional internal names or historical documentation.

## Completion Criteria

These passes are complete when:

- Stabilization smoke has no unresolved alpha blockers.
- The fast contract checks pass after every extraction slice.
- Loredeck Library, Workbench, Creator, Assistant, and Pack Health share UI primitives for empty states, filters, status, validation, jobs, and actions.
- Rendering helpers are mostly stateless and do not own persistence.
- Pack Health language and behavior are consistent across panels.
- Package import/export remains a paired contract.
- Generated Lorepacks can still finalize, install, export, and reload as Custom Lorepacks.
- Runtime `lore-panel.js` has a clear remaining owner map for any code not yet extracted.
- Dead-selector and stale-import cleanup has a bounded list of known findings or is complete.

Line counts are secondary signals, not the contract. Still, the desired direction is clear: no remaining Loredeck panel should be large because it reimplements common controls, and `lore-panel.js` should continue moving toward a composition layer rather than a domain workflow owner.
