# Saga Deep Refactor Target Audit

Status: Current-code refactor planning audit.

Date: 2026-06-16.

## Purpose

Saga has already gone through several major alpha cleanups: repository layout, stylesheet split, state/default splits, extension bootstrap split, Loredeck loader and health extraction, shared action rows, and many runtime Loredeck subpanel extractions.

This audit updates the refactor target list against the current checkout instead of restating the older broad plan. The goal is to identify where the next deep refactor will buy the most reliability, velocity, and frontend stability.

Because Saga is still pre-alpha, this plan assumes we can update current implementation and saved-state contracts in place. Do not preserve broad compatibility paths for old internal module names, old default state fields, old UI labels, or old source shapes unless current SillyTavern integration requires them.

## Related Documents

- [SAGA_ALPHA_REFACTOR_PLAN.md](SAGA_ALPHA_REFACTOR_PLAN.md): older broad decomposition plan and target architecture.
- [SAGA_ALPHA_STABILIZATION_AND_UI_EXTRACTION.md](SAGA_ALPHA_STABILIZATION_AND_UI_EXTRACTION.md): stabilization and extraction log after the first broad split.
- [SAGA_ALPHA_REPOSITORY_RESTRUCTURE_PLAN.md](SAGA_ALPHA_REPOSITORY_RESTRUCTURE_PLAN.md): completed root-to-domain repository structure plan.
- [SAGA_VISUAL_SMOKE.md](SAGA_VISUAL_SMOKE.md): visual smoke harness and browser verification notes.

## Executive Summary

The next refactor should not start with another repository move or a loader split. Those earlier goals are mostly complete. The highest-value work now is to remove the remaining central frontend orchestrators and replace brittle source-shape tests with behavior-level contracts.

The current architecture has three main pressure points:

1. `src/runtime/lore-panel.js` is still the runtime control plane. It is smaller than the oldest plan, but it remains about 14,953 lines with 92 relative imports and dozens of `configure*` dependency maps.
2. The largest user-facing frontend panels are still mixed responsibility files: `lorecards-panel.js` at about 6,469 lines and `loredeck-library-panel.js` at about 6,005 lines.
3. The fast smoke harness is enforcing exact implementation strings in places where the frontend is changing quickly. That catches regressions, but it also creates false blockers and discourages clean refactors.

The safest next program is:

1. Stabilize the guardrails and fix stale or brittle assertions.
2. Extract runtime dependency composition out of `lore-panel.js`.
3. Move Creator generation/controller behavior out of `lore-panel.js`.
4. Split Lorecards and Loredeck Library by workflow ownership.
5. Re-split CSS by current frontend ownership, especially `runtime.css`.
6. Remove pre-alpha compatibility aliases and old migration baggage after the new boundaries are tested.

## Current Evidence

### Fast Checks Run

Passing:

```powershell
node tools\scripts\test-repository-layout.mjs
node tools\scripts\test-state-safety-contract.mjs
node tools\scripts\test-css-sanity.mjs
node --check src\runtime\lore-panel.js
node --check src\lorecards\lorecards-panel.js
node --check src\loredecks\loredeck-library-panel.js
node --check src\runtime\injection-preview-panel.js
```

Failing:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
```

Failure:

```text
Mobile Loredeck Library header must remove the S emblem and compact title/meta/subtitle chrome.
```

Current source appears to implement the intended mobile behavior: mobile title is `Library`, meta is desktop-only, and subtitle is desktop-only. This looks like a brittle source-shape or line-ending assertion, not necessarily a product regression.

```powershell
node tools\scripts\test-prompt-injection-stale-state.mjs
```

Failure:

```text
Injection preview refresh-only sync must update visible prompt sync status.
```

Current source does call `syncPromptInjection()` and `refreshPromptInjectionStatusUi(info)` in the refresh-only path, but the assertion expects an exact source string. Treat this as a stale or brittle assertion candidate unless live UI inspection proves the chip is not updating.

### Largest Source Files

| File | Lines | Primary risk |
| --- | ---: | --- |
| `src/runtime/lore-panel.js` | 14,953 | Runtime composition, Creator actions, Context workbench glue, Loredeck edit dialogs, canon/lore generation panels, and refresh lifecycle are still centralized. |
| `src/lorecards/lorecards-panel.js` | 6,469 | Pending Review, Accepted Lorecards, automation cockpit, mobile gestures, workbench overlay, filters, selection, cards, and editing share one panel file. |
| `src/loredecks/loredeck-library-panel.js` | 6,005 | Library overlay, folders, Active Stack, mobile sheets, drag controllers, metadata editor, cover assets, health summary, and package actions share one file. |
| `src/lorecards/lore-generator.js` | 2,505 | Context detection, story lore scan, JSON repair, bulk scan, and provider orchestration remain mixed. |
| `src/loredecks/loredeck-creator-panel.js` | 2,502 | Creator rendering is extracted, but it still owns many stage renderers and title/planning/draft UI helpers. |
| `src/loredecks/loredeck-workbench-panel.js` | 2,485 | Editor rendering, save/autosave, tag/timeline forms, selection, and direct mutation helpers remain coupled. |
| `src/loredecks/loredeck-health-panel.js` | 2,395 | Pack Health UI, issue grouping, advice text, report export, and stack insights are mixed. |
| `src/context/auto-relevance.js` | 2,295 | Local scoring, model curation, cadence, retirement, undo, and automation run orchestration share one module. |
| `src/context/context-resolver.js` | 1,956 | Context resolver logic is large enough to deserve narrower resolver/model/result modules. |
| `src/context/context-workbench-panel.js` | 1,838 | Workbench routes, timeline/context/alias/validation panes, and mobile action layout are in one frontend file. |

### Largest Directories

| Directory | Files | Lines |
| --- | ---: | ---: |
| `src/runtime` | 50 | 31,154 |
| `src/loredecks` | 47 | 29,293 |
| `src/lorecards` | 11 | 13,260 |
| `src/context` | 8 | 10,173 |
| `src/state` | 23 | 8,606 |
| `src/storage` | 12 | 5,984 |

### Stylesheet Sizes

| File | Lines | Refactor signal |
| --- | ---: | --- |
| `styles/runtime.css` | 7,394 | Too broad. Owns shell, chips, runtime tabs, mobile shell, Library, Lorecards, and many domain details. |
| `styles/review.css` | 3,320 | Lorecards and review surfaces are still heavily centralized. |
| `styles/settings.css` | 1,914 | Large but bounded. |
| `styles/layout.css` | 1,828 | Runtime geometry, rail, drawer, mobile shell, and nested scrolling are mixed. |
| `styles/workbench.css` | 1,383 | Workbench styles are closer to owned but still spans multiple domains. |
| `styles/saga.css` | 14 | Entry aggregator is achieved. |

### Import Graph Signals

Most imported modules:

| Module | Incoming imports | Meaning |
| --- | ---: | --- |
| `src/ui/runtime-ui-kit.js` | 49 | Good shared primitive, but changes here have broad blast radius. |
| `src/state/state-manager.js` | 45 | Still the public state facade. Acceptable for now, but keep it thin. |
| `src/state/constants.js` | 35 | Facade is still widely imported after defaults split. |
| `src/lorecards/lore-matrix.js` | 25 | Lore entry normalization remains core shared domain behavior. |
| `src/lorecards/lore-relevance.js` | 16 | Relevance tier contract is central and should stay stable. |

Most outgoing modules:

| Module | Outgoing relative imports | Meaning |
| --- | ---: | --- |
| `src/runtime/lore-panel.js` | 92 | Central composition/control bottleneck. Highest refactor target. |
| `src/state/state-manager.js` | 27 | Facade still knows many implementation modules. Watch, but not first target. |
| `src/loredecks/loredeck-library-panel.js` | 13 | Library panel remains broad and dependency-heavy. |
| `src/runtime/loredeck-editor-actions.js` | 13 | Extracted action module is useful but still broad. |
| `src/runtime/runtime-safety-panel.js` | 13 | Safety panel has high coupling for its size. |

Import cycles found: none.

This is important. The codebase is not blocked by tangled circular dependencies. We can refactor in vertical slices without first untangling cycles.

## Highest Priority Refactor Targets

### P0: Stabilize Guardrails Before More Extraction

Current state:

- Fast syntax checks pass.
- Repository layout, CSS sanity, and state safety contracts pass.
- Two fast smoke/source-contract tests fail.
- Several high-value tests inspect raw source strings instead of public behavior, DOM state, exported test hooks, or stable data attributes.

Why this matters:

Deep refactors will move code across modules. If the guardrails assert exact source snippets, they will fail when behavior is preserved. That makes every extraction look dangerous and encourages patching tests around old source shapes.

Target changes:

- Convert exact string assertions to one of:
  - DOM assertions in the repo-local browser harness.
  - Exported test hooks for pure behavior.
  - Stable `data-saga-*` markers.
  - Small source-shape assertions only for truly dangerous regressions.
- Add a line-ending tolerant helper for source tests if raw source checks remain.
- Separate tests into `behavior smoke`, `source ownership`, and `deprecated source absence` groups.
- Fix the two current failing fast guards before starting large code movement.

Exit criteria:

- `node tools\scripts\test-visual-smoke-harness.mjs` passes.
- `node tools\scripts\test-prompt-injection-stale-state.mjs` passes.
- The alpha gate can fail only on real behavior or contract breakage, not formatting/source-shape drift.

### P1: Runtime Composition And Dependency Injection

Current state:

- `lore-panel.js` is the only public runtime facade, which is fine.
- But it also imports 92 modules and configures almost every domain panel.
- The configure block alone wires editor actions, entry overrides, timeline registry, tag manager, pending review, assistant review, health, Library, Creator, Context, settings, tour, shell, Lorecards, and theme actions.
- It also still owns large behavior clusters:
  - Creator generation runner and recovery.
  - Creator reset/finalization bridge.
  - Context workbench render/apply glue.
  - Loredeck tag/timeline/override dialogs.
  - Assistant proposal builders.
  - Canon preview and story lore generation panels.

Why this matters:

The previous extraction produced many useful leaf modules, but `lore-panel.js` remains the central dependency injector and mutation bridge. That means unrelated domains still need to coordinate through the largest file.

Target architecture:

Keep `lore-panel.js` as the public facade, but move composition into focused runtime composition modules:

| New module | Responsibility |
| --- | --- |
| `src/runtime/runtime-composition.js` | Configure shell, tabs, tour, settings, common UI refresh dependencies. |
| `src/runtime/loredeck-editor-composition.js` | Wire editor fields, loader, validation, metadata actions, tag/timeline/override panels. |
| `src/runtime/loredeck-workflow-composition.js` | Wire Library, Workbench, Pack Health, package install/export, generated export readiness. |
| `src/runtime/creator-composition.js` | Wire Creator UI to Creator controller/actions. |
| `src/runtime/context-composition.js` | Wire Context panel/workbench/resolver dependencies. |
| `src/runtime/lorecards-composition.js` | Wire Lorecards panel, automation, generation, timeline, and review dependencies. |

Do not move behavior and dependency composition in the same slice unless the behavior owner is already clear. First split the dependency maps, then move domain logic.

Exit criteria:

- `lore-panel.js` retains `showLorePanel`, `hideLorePanel`, `refreshLorePanel`, and `resetLorePanelLayout`.
- `lore-panel.js` no longer imports most domain leaf modules directly.
- New composition modules own dependency wiring by domain.
- Runtime render bugs can be traced to shell, tab registry, composition, or domain module without reading the full runtime file.

### P1: Lorecards Frontend Split

Current state:

`src/lorecards/lorecards-panel.js` owns:

- Panel dependency wrapper.
- Pending Review workspace and bulk actions.
- Accepted Lorecards filters, cards, bulk controls, and row refresh.
- Lore Automation cockpit.
- Manual New Lore dialog.
- Lorecard lifecycle workspace.
- Mobile Accepted Lorecard editor.
- Long-press and double-tap mobile gestures.
- Relevance/elevate/mute controls.
- Source/context badges and search scoring.

Why this matters:

This is now one of the biggest user-facing frontend risk areas. Recent product changes around Accepted Lorecards, Elevate/Mute, relevance tiers, mobile long-press, and automation all meet here.

Target split:

| New module | Responsibility |
| --- | --- |
| `src/lorecards/lorecards-panel.js` | Public render facade only. |
| `src/lorecards/pending-review-panel.js` | Pending Review sections, cards, workbench view, bulk accept/reject. |
| `src/lorecards/accepted-lore-panel.js` | Accepted Lorecards list, filters, cards, detail pane, row refresh. |
| `src/lorecards/lore-automation-panel.js` | Automation cockpit and run/suggestion/undo UI. |
| `src/lorecards/lorecard-workspace-panel.js` | Combined lifecycle workspace and mobile/desktop detail routing. |
| `src/lorecards/lorecard-actions.js` | Elevate, mute, relevance, bulk update, delete, tag mutation action owner. |
| `src/lorecards/mobile-lorecard-gestures.js` | Long-press, double-tap, native-selection guards, mobile haptic/visual feedback. |
| `src/lorecards/lorecard-badges.js` | Source, Context, category, purpose, relevance, and status badge rendering. |
| `src/lorecards/lorecard-filters.js` | Search, scoring, deck/context/source/type filters. |

Exit criteria:

- Automation changes do not require reading mobile gesture code.
- Mobile Lorecard editor changes do not touch Pending Review.
- Badge/source/context display is shared by Pending and Accepted cards without one file owning both workflows.
- Existing exact labels such as `Pending Review`, `Accepted Lorecards`, `Elevate`, and `Mute` stay stable.

### P1: Loredeck Library Split

Current state:

`src/loredecks/loredeck-library-panel.js` owns:

- Overlay open/close/render.
- Progressive hydration.
- Header and desktop/mobile controls.
- Folder hierarchy render model.
- Folder rows and deck cards.
- Active Stack pane.
- Mobile selected strip, reorder sheet, detail sheet, and bottom actions.
- Shift/range selection and selection refresh.
- Drag and drop for decks, folders, and stack items.
- Metadata editor.
- Cover asset import/encoding/storage.
- Health summaries and stack stats.
- Package/import/export/finalize action entry points through dependencies.

Why this matters:

The Library is central to everyday Saga usage. It has both dense desktop workflows and a specialized mobile version. It is also where many perceived-latency, compactness, drag, long-press, cover asset, and stack bugs cluster.

Target split:

| New module | Responsibility |
| --- | --- |
| `src/loredecks/library/loredeck-library-panel.js` | Public overlay facade. |
| `src/loredecks/library/library-overlay.js` | Shell, header, opening state, refresh scheduling. |
| `src/loredecks/library/library-model.js` | Visible pack filtering, folder render model, search model, selected folder model. |
| `src/loredecks/library/library-selection.js` | Bulk selection, range selection, native-selection suppression. |
| `src/loredecks/library/library-folder-tree.js` | Folder rows, folder details, folder actions, move/create/rename/delete. |
| `src/loredecks/library/library-deck-card.js` | Deck card, visual, health chips, stack toggle. |
| `src/loredecks/library/library-active-stack.js` | Active Stack pane, stack folder preview, stack reorder controls. |
| `src/loredecks/library/library-drag-controller.js` | Deck/folder/stack drag state, feedback, auto-scroll, finish handlers. |
| `src/loredecks/library/library-mobile.js` | Mobile browse pane, selected strip, detail sheets, reorder sheet, bottom actions. |
| `src/loredecks/library/library-metadata-editor.js` | Metadata editor card and save/sync/export/finalize action rows. |
| `src/loredecks/library/library-cover-assets.js` | Cover import, data URL reading, canvas encoding, asset ref resolution. |
| `src/loredecks/library/library-health-summary.js` | Pack scoped health and visible health summary helpers. |

Exit criteria:

- Mobile compactness changes stay in `library-mobile.js`.
- Drag bugs stay in `library-drag-controller.js`.
- Cover asset bugs stay in `library-cover-assets.js`.
- Active Stack behavior has one owner shared by desktop, mobile, and runtime shell calls.
- The Library facade exports only open/close/refresh/detail APIs and narrow test hooks.

### P1: Creator Controller And Generation Pipeline

Current state:

Creator rendering has moved into `src/loredecks/loredeck-creator-panel.js`, but a large amount of Creator behavior still lives in `src/runtime/lore-panel.js`, especially from the Creator generation and recovery sections.

Runtime still owns:

- Live generation maps and controllers.
- Creator generation defaults and limits.
- Request option building.
- Single-unit model call runner.
- Retry/recovery behavior.
- Coverage finalization.
- Reset-to-step behavior.
- Brief, outline, title, planning, and entry model-call handlers.
- Generated-pack record construction.
- Draft batch and preflight orchestration.
- Finalization bridge and generated-pack retirement.

Why this matters:

Deck Maker is one of the most complex workflows in Saga. It is long-running, stateful, provider-backed, and heavily UI-visible. Keeping controller behavior in the runtime composition file makes generation bugs harder to isolate.

Target split:

| New module | Responsibility |
| --- | --- |
| `src/loredecks/creator/creator-controller.js` | Stage command dispatch, current job cache, refresh hooks, public Creator actions. |
| `src/loredecks/creator/creator-generation-runner.js` | Generation controller maps, unit lifecycle, progress events, cancellation, retry smaller. |
| `src/loredecks/creator/creator-stage-brief.js` | Brief request/repair/parse/apply behavior. |
| `src/loredecks/creator/creator-stage-outline.js` | Outline request/repair/parse/apply behavior. |
| `src/loredecks/creator/creator-stage-titles.js` | Title batch model, approval, revision, run remaining. |
| `src/loredecks/creator/creator-stage-planning.js` | Context/tag/timeline planning generation and pending change construction. |
| `src/loredecks/creator/creator-stage-entries.js` | Entry drafting, preflight, guard handling, retry rejected targets. |
| `src/loredecks/creator/creator-finalization.js` | Generated pack readiness, coverage acknowledgement, finalization bridge. |
| `src/loredecks/creator/creator-generation-settings.js` | Settings defaults, limits, local no-project settings behavior. |

Exit criteria:

- Runtime file does not own model call sequencing for Creator.
- Creator panel renders from a model/controller instead of reaching through runtime dependencies.
- Provider-backed Creator smoke can target the controller without loading the full runtime panel.

### P2: Context, Canon Preview, And Story Lore Generation Boundaries

Current state:

Context and lore generation are split across:

- `src/context/context-resolver.js`
- `src/context/context-index.js`
- `src/context/context-panel.js`
- `src/context/context-workbench-panel.js`
- `src/context/canon-lore-db.js`
- `src/lorecards/lore-generator.js`
- `src/runtime/lore-panel.js`

Runtime still owns Context workbench refresh/render glue and canon/story lore panels.

Target changes:

- Move Context Workbench runtime glue into `src/context/context-workbench-runtime.js`.
- Move canon preview UI and selection refresh into `src/context/canon-preview-panel.js` or `src/lorecards/canon-preview-panel.js`.
- Split JSON extraction and repair helpers out of `lore-generator.js` into a shared provider response utility.
- Keep local Context resolver, model resolver, and proposal application as separate stages.
- Ensure `Phrase Resolver`, `Use Window`, `Use Anchor`, `After`, `Before`, and `Timeline` labels stay exact.

Exit criteria:

- Context tab bugs do not require editing `lore-panel.js`.
- Canon preview selection refresh is local to the canon preview module.
- Story lore scan and Context detection share provider/repair utilities without sharing UI code.

### P2: CSS Ownership Re-Split

Current state:

`styles/saga.css` is an aggregator, which is good. But the owned files no longer match current ownership well enough:

- `runtime.css` is still too large and contains many domain styles.
- `layout.css` owns both shell geometry and mobile shell details.
- `review.css` owns broad Lorecards/review/mobile editor styles.
- `components.css` still has stale header comments from the old root `style.css`.
- Some comments display mojibake in terminal output, which should be cleaned while editing nearby CSS.

Target split:

| Target CSS file | Responsibility |
| --- | --- |
| `styles/tokens.css` | Variables and theme-scoped tokens only. |
| `styles/runtime-shell.css` | Floating panel, rail, drawer, bottom nav, shell geometry. |
| `styles/runtime-components.css` | Runtime cards, chips, buttons, forms, tabs, generic status rows. |
| `styles/lorecards.css` | Accepted Lorecards, Pending Review, automation cockpit, mobile Lorecard editor. |
| `styles/loredeck-library.css` | Library overlay, folders, stack, mobile Library sheets, drag. |
| `styles/loredeck-creator.css` | Deck Maker staged panels, generation status, title/planning/draft review. |
| `styles/loredeck-health.css` | Pack Health Center, issue groups, repair sessions, health exports. |
| `styles/context.css` | Context panel and Context Workbench. |
| `styles/injection.css` | Injection preview and prompt placement controls. |
| `styles/settings.css` | Runtime/settings provider/theme surfaces. |
| `styles/continuity.css` | Continuity only. |

Refactor rules:

- Preserve selector order inside each moved block unless a visual smoke proves a dead selector.
- Do not combine selector renames with mechanical file moves.
- Add a selector inventory before moving blocks.
- After the split, add dead-selector scanning by mounted smoke harness DOM, not just grep.

Exit criteria:

- No domain-specific Library/Lorecards/Creator styles remain in broad `runtime.css`.
- Mobile layout bugs can be searched in one likely CSS owner file.
- `styles/saga.css` imports files in cascade order, with tokens first unless a deliberate cascade reason is documented.

### P2: State Facade And Pre-Alpha Compatibility Cleanup

Current state:

The state layer is much healthier than the old plan:

- `src/state/constants.js` is a small facade.
- defaults are split.
- storage safety has its own module.
- Loredeck Library and Creator stores exist.

Remaining pressure:

- `state-manager.js` still has 45 importers and 27 outgoing imports.
- It still owns relevance migration, tier compression status migration, mobile panel normalization, import/export, backup/restore, storage diagnostics, and facade re-exports.
- Several modules still mention legacy aliases or compatibility fields for old pre-alpha states.

Target changes:

- Decide the current minimum active saved-state shape.
- Delete compatibility paths that only protect old internal pre-alpha states.
- Move `migrateLoreEntryToRelevance`, `migrateLoreCollectionsToRelevance`, `ensureTierCompressionStatus`, and mobile panel normalization into a focused current-state migration/normalization module.
- Keep `state-manager.js` as the app-facing facade, but make it mostly re-exports and orchestration.
- Audit `default-settings.js`, `default-state.js`, `lore-matrix.js`, and `lore-state-normalizers.js` for old aliases that no current UI path needs.

Exit criteria:

- State facade remains stable for app modules.
- Old lifecycle/active/pinned compatibility code is removed where Elevate/Relevance is the real current model.
- Migration code documents only current alpha state protection, not speculative historical support.

### P2: Source Contract And Test Architecture

Current state:

The tests are valuable but many are source-level contract checks. This is understandable for a fast-moving no-build extension, but it is becoming a refactor blocker.

Target changes:

- Keep source scans for dangerous regressions:
  - removed global aliases returning,
  - unsafe package import paths,
  - missing hook exports,
  - forbidden stale root paths.
- Move UI behavior checks to DOM harnesses when feasible.
- Replace exact implementation snippets with semantic helpers:
  - `assertSourceIncludesAll(source, [...])`
  - `assertSourceExcludesAll(source, [...])`
  - line-ending normalized source reads,
  - exported test hook inspection.
- Break the large `test-visual-smoke-harness.mjs` into smaller files:
  - `test-mobile-ui-contract.mjs`
  - `test-lorecards-ui-contract.mjs`
  - `test-loredeck-library-ui-contract.mjs`
  - `test-context-ui-contract.mjs`
  - `test-runtime-shell-ui-contract.mjs`
  - `test-live-smoke-targets-contract.mjs`

Exit criteria:

- A refactor can move code without rewriting unrelated test assertions.
- Failing test names identify a domain owner.
- UI regressions are still caught, but behavior is tested closer to behavior.

## Areas That Are Not First Targets

### Repository Layout

The direct manifest layout is already in place:

- `manifest.json` points to `src/extension/index.js`.
- `manifest.json` points to `styles/saga.css`.
- root implementation/data sprawl is gone.

Do not spend the next deep refactor on another folder move unless it is tied to a specific domain split.

### Extension Entrypoint

`src/extension/index.js` is already a small composition layer. The extension bootstrap is not the next bottleneck.

### Constants Facade

`src/state/constants.js` is already a facade over schema/default/settings/provider/prompt modules. It is still widely imported, but it is not a high-risk monolith anymore.

### Loredeck Loader

`src/loredecks/loredeck-loader.js` is down to about 493 lines and describes itself as data-only. It still imports health modules, but the old loader/health monolith risk is much lower than the frontend panel risks.

### Import Cycles

No source import cycles were detected. Do not spend time on a general dependency-cycle cleanup unless new cycles appear during extraction.

## Recommended Refactor Sequence

### Phase 0: Guardrail Stabilization

Tasks:

- Fix or rewrite the two currently failing fast checks.
- Add source-read normalization for line endings in source-inspection tests.
- Split the largest source-inspection harness into domain files or at least domain sections with separate failure prefixes.
- Run the alpha gate after the fixes.

Validation:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-prompt-injection-stale-state.mjs
node tools\scripts\run-alpha-gate.mjs
```

### Phase 1: Runtime Composition Split

Tasks:

- Create domain composition modules.
- Move configure maps out of `lore-panel.js`.
- Keep behavior in place for this phase.
- Re-run syntax and fast UI contracts after each domain composition move.

Validation:

```powershell
node --check src\runtime\lore-panel.js
node tools\scripts\test-repository-layout.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

### Phase 2: Creator Controller Extraction

Tasks:

- Move Creator generation settings, live generation state, runner, retry/recovery, stage handlers, and finalization bridge into Creator-owned modules.
- Keep Creator panel UI separate from controller actions.
- Preserve in-button progress, resumable job behavior, and diagnostic export behavior.

Validation:

```powershell
node --check src\loredecks\creator\creator-controller.js
node --check src\loredecks\creator\creator-generation-runner.js
node tools\scripts\test-loredeck-creator-generation-progress-persistence.mjs
node tools\scripts\test-loredeck-creator-auto-draft-all-ui.mjs
node tools\scripts\test-loredeck-creator-stage-reset-ui.mjs
node tools\scripts\test-loredeck-generated-finalization-health.mjs
```

### Phase 3: Lorecards Panel Split

Tasks:

- Extract Pending Review, Accepted Lorecards, automation, mobile gestures, badges, filters, and actions.
- Keep `renderLorecardsTab` as the public facade.
- Preserve exact user-facing labels and mobile density decisions.

Validation:

```powershell
node --check src\lorecards\lorecards-panel.js
node tools\scripts\test-lore-automation-levels.mjs
node tools\scripts\test-retrieval-audit.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

### Phase 4: Loredeck Library Split

Tasks:

- Extract Library mobile, drag, folder tree, Active Stack, metadata editor, cover assets, health summary, and selection modules.
- Keep public open/close/refresh/detail exports stable.
- Preserve progressive open and mobile long-press behavior.

Validation:

```powershell
node --check src\loredecks\loredeck-library-panel.js
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-library-transfer-actions.mjs
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

### Phase 5: CSS Ownership Split

Tasks:

- Inventory selectors by mounted DOM usage.
- Split `runtime.css` into shell, components, Lorecards, Library, Creator, Health, Context, and Injection files.
- Clean stale comments and mojibake while moving nearby blocks.
- Avoid selector renames until after mechanical ownership move.

Validation:

```powershell
node tools\scripts\test-css-sanity.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

### Phase 6: Pre-Alpha Compatibility Removal

Tasks:

- Delete old internal compatibility aliases now that Saga is pre-alpha.
- Remove stale lifecycle/active/pinned compatibility paths where current Elevate/Relevance behavior is authoritative.
- Remove old default state/settings keys that only exist for removed UI.
- Update tests and docs in place.

Validation:

```powershell
node tools\scripts\test-state-safety-contract.mjs
node tools\scripts\test-saga-settings-compaction.mjs
node tools\scripts\test-repository-layout.mjs
node tools\scripts\run-alpha-gate.mjs
```

## Refactor Principles For This Pass

- Move ownership first, then redesign UI.
- Do not preserve old internal paths just because they existed in pre-alpha.
- Keep public SillyTavern hooks stable: manifest entrypoint, CSS entrypoint, lifecycle hooks, and `sagaInterceptor`.
- Keep `lore-panel.js` and `state-manager.js` as facades while removing internals.
- Prefer domain action modules over passing giant dependency maps into render modules.
- Keep render helpers mostly stateless.
- Keep model calls and provider repair logic out of render files.
- Make mobile behavior first-class, not a pile of conditionals inside desktop renderers.
- Treat tests as product contracts, not source-layout contracts, unless source layout itself is the product contract.

## Success Definition

The deep refactor is successful when:

- `src/runtime/lore-panel.js` is a small facade plus shell refresh orchestration, not a domain workflow owner.
- Lorecards, Library, and Creator each have clear frontend/controller/action boundaries.
- `styles/runtime.css` no longer acts as the catch-all stylesheet for current UI.
- Current alpha tests pass without requiring exact source snippets for normal UI behavior.
- Pre-alpha compatibility aliases are removed unless current SillyTavern requires them.
- Live SillyTavern smoke can be used as the final confidence pass after each behavior-affecting slice, not as the only way to discover basic regressions.
