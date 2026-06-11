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
| `src/loredecks/loredeck-creator-panel.js` | 1,670 lines | Creator stage/job/status UI. |
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
| Generated-to-Custom | Creator output, readiness, finalization, export/install. | Generated Lorepacks can become Custom Lorepacks without losing accepted content. |
| Pack Health | Scan, grouped issues, ignore/resolve, deterministic repair, assistant handoff. | Pack Health remains advisory where intended and queues reviewable changes for repairs. |
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
| Pending Review | Show queued entry/tag/timeline patches, accept/reject one, accept/reject all, jump from Creator/Assistant/Health. | Toast success must match saved state, not just local UI mutation. |
| Workbench | Open a Custom Lorepack, edit entries, overrides, tags, timeline records, and queue reviewable changes. | Editor actions must not bypass Pending Review or lose schema v3 Context/retrieval fields. |
| Pack Health | Scan selected and active Lorepacks, group issues, ignore/resolve advisories, run deterministic repairs, hand off assistant repairs. | Malformed timeline registries are health findings, not runtime render failures. |
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

Remaining feature passes:

- Active Stack.
- Pending Review.
- Workbench.
- Pack Health.
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

Extract shared validation result rendering from Pack Health, Workbench, Creator, and Assistant.

Focus areas:

- Severity summaries.
- Issue group rows.
- Advisory vs blocking language.
- Deterministic repair affordances.
- Assistant repair handoff shell.
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

Extract repeated job status rendering from Creator, Assistant, import/export, update checks, scans, and repairs.

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

#### Slice 2.5: Action Rows And Workflow Commands

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

Runtime follow-up is done when `lore-panel.js` no longer owns large domain-specific Pack Health, editor, tag, timeline, package, or Creator workflow renderers.

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
