# Saga Lore Panel Decomposition Plan

Status: Phase 7 Context tab display-card, command-center, advanced brief, automation settings, proposal review, Context Workbench shell, Workbench Context table/editor shell, Workbench Timeline view, Workbench waypoint browser, Workbench resolver tester, Workbench Context picker, Workbench Aliases view, and Workbench Validation view extraction implemented. Next queued phase: Phase 8 Settings and Theme panel extraction.

Date: 2026-06-07.

## Purpose

`lore-panel.js` has become the runtime shell, tab router, fullscreen window manager, feature controller, UI helper library, and DOM event hub for most of Saga. It is now too large to change safely without creating regressions in unrelated systems.

This plan describes how to de-monolithize `lore-panel.js` without a risky rewrite. The goal is to keep Saga working through every slice while moving feature ownership into smaller modules with clear boundaries.

## Current Audit Snapshot

Latest audit:

- `lore-panel.js` is 38,316 lines.
- It contains roughly 1,492 function-like declarations.
- The public export surface is small: `showLorePanel`, `hideLorePanel`, `refreshLorePanel`, and `resetLorePanelLayout`.
- Most functions are not individually huge; the issue is broad responsibility and shared top-level mutable state.
- Existing domain modules already exist for several systems, but their UI composition still lives in `lore-panel.js`.

Phase 1 progress:

- `runtime-ui-kit.js` now contains the first extracted shared UI helpers.
- `lore-panel.js` now imports the shared display, button, tooltip, dialog, toast, and small UI primitive helpers.
- Current post-extraction line count after Phase 2 cleanup: `lore-panel.js` is 34,252 lines, and `runtime-ui-kit.js` is 507 lines.

Phase 2 progress:

- `runtime-theme.js` now contains Theme Pack presets, Icon Set presets, passive asset normalization, theme/icon lookup, runtime CSS token application, and theme contrast reporting.
- `lore-panel.js` now imports runtime theme/icon helpers instead of defining them inline.
- Panel-only state, Creator caches, tab labels, and category labels remain in `lore-panel.js`; `runtime-theme.js` is limited to theme/icon ownership.
- Current post-extraction line count after Phase 3 cleanup: `lore-panel.js` is 32,779 lines, `runtime-theme.js` is 740 lines, and `runtime-ui-kit.js` is 507 lines.
- Validation passed with `node --check` on `runtime-ui-kit.js`, `runtime-theme.js`, `lore-panel.js`, and `index.js`, plus ES module import smoke for `runtime-theme.js` and `lore-panel.js`.

Phase 3 progress:

- `loredeck-health-panel.js` now owns the Deck Health Center fullscreen window state, tabs, render tree, report export, scan refresh, grouped issue display, status descriptors, report building, issue grouping, file rows, and relative health time formatting.
- `lore-panel.js` configures the Health Center module through `configureLoredeckHealthPanel(...)` with narrow callbacks for state access, library/stack lookup, cache reads, validation, refresh, export, duplicate-as-custom, deterministic repair actions, and assistant repair drafting.
- `lore-panel.js` imports the health helpers still needed by Library details, pending-review health normalization, malformed-tag repair planning, and Context status timestamps.
- Editor-specific repair planner UI remains in `lore-panel.js` until the Loredeck editor/detail surfaces are extracted.
- Current post-extraction line count: `lore-panel.js` is 32,779 lines, `loredeck-health-panel.js` is 1,580 lines, `runtime-theme.js` is 740 lines, and `runtime-ui-kit.js` is 507 lines.
- Validation passed with `node --check` on `loredeck-health-panel.js`, `lore-panel.js`, `index.js`, `runtime-theme.js`, and `runtime-ui-kit.js`; ES module import smoke passed for `loredeck-health-panel.js` and `lore-panel.js`; a fake-data helper smoke passed for cached health, grouped issues, and status descriptors.
- Direct ES module import of `index.js` is not a valid Node smoke because it expects SillyTavern browser globals such as `$`; keep `node --check index.js` for this slice and use browser smoke for runtime behavior.

Phase 4 progress:

- `loredeck-library-panel.js` now owns the fullscreen Loredeck Library open/close state, render tree, search/sort/filter state, details-panel height/collapse state, folder collapse state, bulk selection state, drag state, cover resize observer, Library scroll preservation, inline folder rows, Active Stack rows, details tabs, cover import/remove UI, and Library folder management UI.
- `lore-panel.js` configures the Library module through `configureLoredeckLibraryPanel(...)` with callbacks for state access, stack mutations, validation, Creator launch/finalize flows, import/export, duplicate/delete, metadata editing, manifest preview, and editor-detail panels that still live outside the Library module.
- `lore-panel.js` imports the Library helpers still needed by the compact Loredecks tab, Creator project shelf, Context/Creator cross-links, import/export flows, duplicate/delete flows, stack mutations, and Health Center context.
- The Library extraction intentionally leaves mutation-heavy helpers and editor/assistant repair surfaces in `lore-panel.js` until their owner modules are extracted. This avoids pulling Creator, pending-review, and metadata editor code into the Library module.
- Current post-extraction line count: `lore-panel.js` is 28,904 lines, `loredeck-library-panel.js` is 4,103 lines, `loredeck-health-panel.js` is 1,580 lines, `runtime-theme.js` is 740 lines, and `runtime-ui-kit.js` is 507 lines.
- Validation passed with `node --check` on `loredeck-library-panel.js`, `loredeck-health-panel.js`, `lore-panel.js`, and `index.js`; ES module import smoke passed for `loredeck-library-panel.js`, `loredeck-health-panel.js`, and `lore-panel.js`; a fake-data helper smoke passed for Library index, pack map, folder assignment, and open-state access; a conservative unresolved-call inventory found no real missing Library bridge functions.
- Browser visual smoke is still required for drag/drop, details collapse, cover import/remove, and click-off close behavior.

Phase 5 progress:

- `loredecks-tab-panel.js` now owns the compact Loredecks tab render surface, Loredeck Library launch card, in-progress Creator project shelf, Creator project search/filter/folder-filter state, Creator project bulk selection state, project shelf cards, project folder move UI, project delete/rename/open actions, and Creator project shelf resume routing.
- `lore-panel.js` configures the tab module through `configureLoredecksTabPanel(...)` with callbacks for panel refreshes, tour target marking, deck import, Creator workbench opening, Library and Creator cross-links, Generated Loredeck readiness, active generation attachment/recovery, and current Creator draft input synchronization.
- `loredecks-tab-panel.js` imports durable project registry actions from `state-manager.js`, Creator project view-model construction from `loredeck-creator-projects.js`, Library folder helpers from the existing Library modules, and reusable UI primitives from `runtime-ui-kit.js`.
- Current post-extraction line count: `lore-panel.js` is 28,275 lines, `loredecks-tab-panel.js` is 728 lines, `loredeck-library-panel.js` is 4,103 lines, `loredeck-health-panel.js` is 1,580 lines, `runtime-theme.js` is 740 lines, and `runtime-ui-kit.js` is 507 lines.
- Validation passed with `node --check` on `loredecks-tab-panel.js`, `lore-panel.js`, `loredeck-library-panel.js`, `loredeck-health-panel.js`, and `index.js`; ES module import smoke passed for the Loredecks tab, Library, Health, and panel modules; a conservative unresolved-call inventory found no real missing Loredecks tab bridge functions.
- Browser visual smoke is still required for Open Library, Create Deck, Creator project resume, Creator project rename/delete, project folder filtering, bulk selection, and linked Generated Loredeck Library routing.

Phase 6 progress:

- `loredeck-creator-panel.js` now owns the Creator fullscreen overlay shell, workbench body refresh, scroll-anchor preservation, queued workbench refresh scheduling, generation status row rendering, generation elapsed/snippet formatting, wait-message text, pipeline header, stage roadmap, workbench anchor scrolling, shared Creator artifact disclosure shell, current-task display card, current-task output grid, current-task sidebar panels, Scope Brief review display, Story Outline review display, outline row normalization/display, shared assumptions/risks list rendering, Title Pass draft normalization, Title Pass batch lookup helpers, Title Pass revision compaction, Title Pass quality-warning counting, the read-only Title Set Plan renderer, the Title Pass card shell, the Title Pass action row, the Title Pass revision form, Title Pass row rendering, the Context Plan card shell, Context Plan batch planner rows, the Lorecard Drafts card shell/action UI, the Creator-specific Pending Review wrapper, and the Deck Health/Finalize readiness-card shell.
- `lore-panel.js` configures the Creator panel through `configureLoredeckCreatorPanel(...)` with callbacks for state access, Creator job cache lookup, pipeline model construction, card rendering, interrupted-generation recovery, active generation cancellation, current draft input labels, granularity label formatting, current-task action rendering, recoverable-unit lookup, recovery-stage labels, relative time formatting, Scope Brief revision-form rendering, Story Outline action-form rendering, Title Pass selection lookup, Title Pass generation settings, Title Pass generation/remaining handlers, Title Pass selection mutations, Title Pass revision-instruction storage, Title Pass quality pill/list rendering, Title Pass JSON editor opening, Context Plan batch lookup, Context Plan pending-count lookup, Context Plan generation handling, Generated Loredeck lookup, Library detail opening, stack lookup, stack mutation, Lorecard Draft progress lookup, Lorecard Draft generation handling, draft-review cache lookup, draft-review batch rendering, generic Pending Review card rendering, Deck Health/Finalize readiness view-model construction, and confirmation prompts.
- The completed Phase 6 slices intentionally leave current-task action behavior, Scope Brief revision behavior, Story Outline draft/revision/approval behavior, Title Pass provider-call behavior, Title Pass selection/cache mutation behavior, Title Pass JSON editor mutation behavior, Context Plan provider-call behavior, Context Plan generated-pack mutation behavior, Lorecard Draft provider-call behavior, Lorecard Draft review-cache mutation behavior, the generic Pending Review card and its mutation paths, Deck Health validation/finalization actions, generated-export readiness calculation, model-call execution, response repair, and retry/recovery unit actions in `lore-panel.js` until they can be moved in smaller stage-specific passes.
- Current post-extraction line count: `lore-panel.js` is 27,067 lines, `loredeck-creator-panel.js` is 1,489 lines, `loredecks-tab-panel.js` is 728 lines, `loredeck-library-panel.js` is 4,103 lines, `loredeck-health-panel.js` is 1,580 lines, `runtime-theme.js` is 740 lines, and `runtime-ui-kit.js` is 507 lines.
- Validation passed with `node --check` on `loredeck-creator-panel.js`, `lore-panel.js`, `loredecks-tab-panel.js`, `loredeck-library-panel.js`, `loredeck-health-panel.js`, and `index.js`; ES module import smoke passed for the Creator panel and main panel modules after Deck Health/Finalize readiness-card extraction.
- SillyTavern browser smoke passed at `http://127.0.0.1:8000/`: Saga loaded, Loredecks tab opened, the in-progress Creator project resumed, all eight Creator stages rendered, extracted Pending Review and Deck Health/Finalize cards rendered, Pending Review routing scrolled to the queue after smooth-scroll settle, close/reopen restored the Creator, and no browser console errors were observed. No model-call buttons were pressed during smoke, so duplicate-click suppression was preserved by avoiding new generation calls.
- The standalone visual-smoke server at `http://127.0.0.1:8776/` was not running during this pass; the smoke used the live SillyTavern page instead.

Phase 7 progress:

- `context-panel.js` now owns the Context command center, loaded Loredeck Contexts card, per-Loredeck Context row rendering, Last Resolver Check panel, Last Automation Check panel, Reasoner Proposals compact panel, Detector status chip rendering for the command center, Advanced Context Brief collapsible shell/summary, Context automation settings card, Context proposal review overlay/shell/rows, and small Context index summary helpers used by both the Context tab and existing Context Workbench.
- `lore-panel.js` configures the Context panel through `configureContextPanel(...)` with callbacks for loaded stack lookup, pack Context lookup, display labels, proposal lookup, workbench opening, lock/seed/reset actions, proposal apply/dismiss actions, current resolver/model/detect actions, generation-status rendering, Detector status-card rendering, the existing advanced Context editor card, and settings get/save/reset/refresh functions for the extracted automation controls.
- `context-workbench-panel.js` now owns the Context Workbench shell, title/header chips, tab strip, Refresh Index/Done controls, loaded-Loredeck pack selector, Workbench Context table, selected-pack Context editor shell, Timeline view/table/inspector/controls, waypoint browser, current-window summary, waypoint rows/search/filtering, Phrase Resolver UI, resolver diagnostics, resolver result rows, Context picker UI, Context picker rows/current selection, Workbench Aliases view, alias rows/duplicate detection, Workbench Validation view, validation issue rows, validation summary, and shared Context validation issue builder.
- `lore-panel.js` configures the Workbench module through `configureContextWorkbenchPanel(...)` with callbacks for Workbench state, shared Workbench query state, Timeline type-filter state, waypoint query/filter state, resolver query state, Context picker query state, stack lookup, selected-pack lookup, Context labels/summaries, timeline-item lookup/filtering, selected-key updates, manual-lock/reset/seed actions, resolver/reasoner actions, waypoint/resolver entry cache/loading, Lorecard-derived anchor construction, Lorecard-derived resolver matching and miss reasons, timeline/Lorecard Context application, alias target application, index reload, Deck Health validation, timeline ID/number normalization, timeline edit/disable/remove/export actions, attached-Lorecard editor routing, header refresh, and close/rerender behavior.
- The completed Phase 7 slices intentionally leave local/model resolver implementation beyond the extracted test UI, Context mutation/snapshot behavior, provider calls, resolver cache internals, timeline edit dialog mutation behavior, and automation cadence in `lore-panel.js` until they can be moved in smaller behavior-specific passes.
- Current post-extraction line count: `lore-panel.js` is 26,990 lines, `context-panel.js` is 841 lines, `context-workbench-panel.js` is 1,858 lines, `loredeck-creator-panel.js` is 1,615 lines, `loredecks-tab-panel.js` is 793 lines, `loredeck-library-panel.js` is 4,402 lines, `loredeck-health-panel.js` is 1,668 lines, `runtime-theme.js` is 776 lines, and `runtime-ui-kit.js` is 584 lines.
- Validation passed with `node --check` on `context-workbench-panel.js`, `context-panel.js`, `lore-panel.js`, `loredeck-creator-panel.js`, `loredecks-tab-panel.js`, `loredeck-library-panel.js`, `loredeck-health-panel.js`, `runtime-theme.js`, `runtime-ui-kit.js`, and `index.js`; ES module import smoke passed for the Workbench, Context panel, and main panel modules after Workbench Context table/editor shell extraction, waypoint browser extraction, resolver tester extraction, Context picker extraction, Aliases extraction, Validation extraction, and Timeline view extraction. Fake-DOM module smoke verified the extracted Workbench shell renders header/tabs/content, switches tabs through callbacks, updates the selected Loredeck through the pack selector, closes through the Done action, renders the extracted Context table/editor shell, routes selected-pack, resolver, reasoner, manual-lock, seed, and reset actions through configured callbacks, renders the extracted waypoint browser with timeline and Lorecard-derived event waypoints, routes Use Window/After/Lorecard/Reload Events actions through configured callbacks, renders the extracted resolver tester with first-class timeline and Lorecard-derived matches, routes Apply/After/Timeline/Apply Lorecard/Queue Anchor/Find Lorecard/Reload Lorecards through configured callbacks, renders the extracted Context picker with current window and timeline anchors, routes Find/Use Window/Use Anchor/After/Before through configured callbacks, renders the extracted Aliases table, detects duplicate aliases, updates shared query state, routes Select back to Timeline, calls the alias Apply callback, renders the extracted Validation layout/table, detects invalid window bounds and duplicate aliases, routes issue rows back to Timeline selection, renders the extracted Timeline spreadsheet/inspector, updates search/type filters, sets default selected timeline row, and routes Apply/Edit/Disable/Forget/Find Lorecards/Export actions through configured callbacks.
- SillyTavern browser smoke passed at `http://127.0.0.1:8000/`: after reload, the Context rail tab opened, the extracted Runtime Context command card rendered, the moved Loaded Loredeck Contexts card rendered, the extracted Advanced Context Brief and Automation sections remained available, the Review Proposals button followed the expected no-proposal path with no overlay opened, and no browser console errors were observed.
- SillyTavern browser smoke for this Workbench shell slice passed at `http://127.0.0.1:8000/`: after reload, the Context rail tab opened, Browse Context rendered, the no-loaded-Loredeck guard toast fired instead of opening the Workbench, and no browser console errors were observed. Full live Workbench-open smoke still needs an active Loredeck stack; the extracted shell itself is covered by the fake-DOM smoke above.
- SillyTavern browser smoke for the Workbench waypoint browser extraction passed at `http://127.0.0.1:8000/`: after reload, Saga mounted, the Context rail tab opened, Browse Context remained present, and no browser console errors were observed. Full live waypoint-browser interaction still needs an active Loredeck stack; waypoint rendering and actions are covered by the fake-DOM smoke above.
- SillyTavern browser smoke for the Workbench resolver tester extraction was limited by browser automation click timeouts on the Context rail tab. After reload, Saga mounted, the runtime shelf was present, the page reached `complete`, Context rail text was present, and no browser console errors were observed. Resolver tester rendering/action behavior is covered by the fake-DOM smoke above.
- SillyTavern browser smoke for the Workbench Context picker extraction passed at the mount level: after reload, Saga mounted, the runtime shelf was present, the page reached `complete`, Context rail text was present, and no browser console errors were observed. Context picker rendering/action behavior is covered by the fake-DOM smoke above.

Large responsibility clusters:

```text
1-1902        imports, constants, runtime settings, top-level UI state
1903-2342     public panel API and runtime shell
2343-8082     Loredecks tab, Creator project shelf, Loredeck Library
8083-13172    Loredeck Creator pipeline and workbench
13173-16450   Context tab, Context rows, Context Workbench
16451-19057   Deck Health Center
19058-26000   import/export, duplicate, metadata, override, tag/timeline dialogs
26001-33459   Settings, themes, session, context, lore generation, injection
33460-36818   Lorecard review/workbench/timeline/cards
36819-38316   tags, mutations, drag/resize, dialogs, tooltips, UI helpers
```

## Core Principle

Do not rewrite `lore-panel.js` in one pass.

Use a strangler pattern:

1. Keep `lore-panel.js` as the stable public facade.
2. Extract low-risk shared helpers first.
3. Extract self-contained fullscreen windows next.
4. Extract state-heavy systems after the shared panel API is stable.
5. Run syntax, deterministic, and visual smoke checks after every slice.

## Non-Goals

- Do not rename all `wandlight-*` CSS classes during this effort.
- Do not redesign UI while extracting modules unless a small change is required to preserve behavior.
- Do not change persisted state shape unless the slice explicitly requires a migration.
- Do not combine feature work with mechanical extraction.
- Do not move model-call logic and UI rendering in the same slice unless they are already inseparable.

The visible product can continue moving to Saga terminology separately. Internal compatibility names should be handled in a later CSS/state migration pass.

## Target Architecture

### `lore-panel.js`

Long-term role: public facade and compatibility entrypoint.

Responsibilities:

- Export `showLorePanel`.
- Export `hideLorePanel`.
- Export `refreshLorePanel`.
- Export `resetLorePanelLayout`.
- Import and delegate to the runtime shell.
- Preserve existing callers from `index.js`.

Target size: 200-500 lines after full decomposition.

### `runtime-shell.js`

Responsibilities:

- Runtime shelf and drawer.
- Rail rendering.
- Tab routing.
- Header refresh.
- runtime panel geometry.
- drag and resize for the runtime shell.
- close/reset behavior.
- shell-level render error boundary.

Target size: 2k-5k lines.

### `runtime-ui-kit.js`

Responsibilities:

- Buttons.
- Icon buttons.
- metadata chips and status pills.
- key/value rows.
- empty states.
- collapsible sections.
- text inputs/select rows.
- tooltips.
- confirm/prompt/choice dialogs.
- fullscreen overlay shell helper.
- busy-action/status helpers.

This should be UI-only. It should not import feature modules.

Target size: 1k-2k lines.

### `runtime-panel-context.js`

Responsibilities:

- Provide feature modules with a small dependency object.
- Avoid feature modules importing the shell directly.
- Centralize access to shared state helpers, settings helpers, refresh functions, toast helpers, UI helpers, and close-window behavior.

Expected shape:

```js
export function createRuntimePanelContext() {
  return {
    getState,
    saveState,
    getSettings,
    saveSettings,
    refreshPanelBody,
    refreshHeader,
    toast,
    confirmAction,
    promptTextAction,
  };
}
```

Exact names can change, but the rule should not: feature modules receive a context object instead of reaching across module boundaries.

### `runtime-theme.js`

Responsibilities:

- Theme preset lookup.
- icon set lookup.
- local passive asset resolution.
- runtime CSS token application.
- active theme color derivation.

This should be extracted before `settings-panel.js`, because Settings and the shelf both depend on theme/icon resolution.

### `loredecks-tab-panel.js`

Responsibilities:

- The compact Loredecks tab.
- Loredeck Library launcher.
- Creator project shelf.
- In-progress Generated Loredeck cards.

This module should not contain the fullscreen Library itself.

### `loredeck-library-panel.js`

Responsibilities:

- Fullscreen Loredeck Library rendering.
- Library search and sort controls.
- folder rows and cover strips.
- Library selection and bulk toolbar.
- Active Stack UI.
- Library details panel.
- cover import/remove controls.
- Library window drag/drop orchestration.

Existing pure helper modules should remain separate:

- `loredeck-library-index.js`
- `loredeck-library-service.js`
- `loredeck-library-drag.js`
- `loredeck-library-view.js`

### `loredeck-health-panel.js`

Responsibilities:

- Deck Health Center fullscreen window.
- Health category tabs.
- grouped issue display.
- issue detail display.
- deterministic repair actions.
- scan refresh behavior.

Validation rules should remain in `loredeck-loader.js` or dedicated health helpers, not in the panel module.

### `loredeck-creator-panel.js`

Responsibilities:

- Creator workbench shell.
- stage header.
- current task panel.
- status/progress UI.
- generated project review surfaces.
- Creator action buttons.
- Pending Review routing from the Creator.

Generation orchestration should stay in `generation-job-runner.js`, `loredeck-creator-projects.js`, and `loredeck-assistant.js` where possible.

### `context-panel.js`

Responsibilities:

- Context tab.
- loaded Loredeck Context rows.
- manual Context edit surfaces.
- Context Browser launcher.
- resolver audit/proposal display.
- Context automation settings card.

### `context-workbench-panel.js`

Responsibilities:

- Fullscreen Context Workbench shell.
- Workbench title/header chips.
- Workbench tab strip.
- Workbench refresh/close controls.
- loaded-Loredeck pack selector.
- Workbench Context table.
- Workbench selected-pack Context editor shell.
- Workbench waypoint browser.
- Workbench waypoint search/filter rows.
- Workbench current-window summary.
- Workbench resolver tester.
- Workbench resolver diagnostics/result rows.
- Workbench Context picker.
- Workbench Context picker current selection/rows.
- Workbench Aliases view.
- Context alias row builder.
- Workbench Validation view.
- Context validation issue builder.

Current extracted role: shell plus Context table/editor shell, waypoint browser, resolver tester, Context picker, Aliases view, and Validation view. The timeline table, resolver action/controller behavior, timeline mutation actions, and model-call controller behavior still live in `lore-panel.js` until they can be moved in smaller Workbench-specific slices.

### `settings-panel.js`

Responsibilities:

- Runtime Settings tab.
- provider/API settings.
- automation settings.
- danger-zone/settings reset cards.

This is distinct from existing `ui.js`, which currently owns legacy SillyTavern extension dropdown cleanup and provider settings wiring.

### `theme-panel.js`

Responsibilities:

- Theme Pack section.
- installed Theme Pack gallery.
- color overrides.
- icon set selector.
- accessibility summary.

This depends on `runtime-theme.js` and `runtime-ui-kit.js`.

### `lorecards-panel.js`

Responsibilities:

- Lorecards tab.
- accepted Lorecard list.
- pending Lorecard review section.
- bulk edit controls.
- Lorecard entry cards.
- tag chip UI.
- new Lorecard dialog.

### `lore-timeline-panel.js`

Responsibilities:

- Lore timeline window.
- timeline graph.
- minimap.
- timeline event detail.
- timeline recovery actions.

May be extracted before or after `lorecards-panel.js` depending on coupling.

### `runtime-tour.js`

Responsibilities:

- guide steps.
- active walkthrough state.
- target highlighting.
- popover positioning.
- tour keyboard behavior.

This is optional for alpha and can be extracted late.

## Shared-State Strategy

Top-level UI state is the main coupling risk. It should be migrated in stages.

Current state classes:

- Shell state: `panelRoot`, drag offsets, resize state, tooltip state.
- Library state: open flag, query, sort, selected IDs, folder collapse, drag state, details height.
- Creator state: input fields, revision instructions, selected projects, generation controllers, live generation jobs.
- Context state: open flag, selected pack/key, queries, filters.
- Lorecard state: workbench mode, selected entry, search timers, timeline state.

Near-term rule:

- Move each feature's top-level mutable state into the feature module when that feature is extracted.
- Keep persisted state in `state-manager.js`.
- Keep cross-feature state access behind the runtime panel context object.

Long-term rule:

- Feature modules should expose `open`, `close`, `refresh`, and `render` methods where needed.
- Runtime shell should not know internal feature state beyond whether a surface is open.

## Extraction Phases

### Phase 0: Baseline And Guardrails

Goal: document the current state and prevent regressions.

Tasks:

- Record current line count and main section ranges.
- Record public exports and current callers.
- Confirm `index.js` imports only the public facade.
- Add this plan to docs.
- Identify the minimum validation commands for every extraction slice.

Exit criteria:

- This document exists.
- No runtime behavior changes.
- Baseline validation commands are known.

### Phase 1: Extract Runtime UI Kit

Goal: move generic helper functions out of the bottom of `lore-panel.js`.

Candidates:

- `createButton`
- `createKeyValue`
- `createStatusPill`
- `createEmptyMessage`
- `addTooltip`
- tooltip render/update helpers
- `confirmAction`
- `promptTextAction`
- choice dialog helpers
- shared icon/button helpers that do not depend on feature state

Constraints:

- Preserve CSS class names.
- Preserve button handler semantics.
- Keep toast/progress dependencies injected or imported from stable utilities.
- Do not move feature-specific card builders.

Exit criteria:

- `lore-panel.js` imports generic UI helpers from `runtime-ui-kit.js`.
- Syntax checks pass.
- Runtime shelf, Library, Health Center, Creator, Settings, and Lorecards still open.

### Phase 2: Extract Runtime Theme Helpers

Goal: separate theme/icon lookup from panel rendering.

Candidates:

- local passive asset resolution.
- theme pack library lookup.
- icon set library lookup.
- active theme color derivation.
- runtime CSS variable application.
- tab icon and brand logo resolution.

Constraints:

- Do not alter Theme Pack schema.
- Do not alter icon set file naming or asset paths.
- Do not rewrite Settings UI in this phase.

Exit criteria:

- Shelf icons still render.
- Theme Pack switching still applies immediately.
- Settings tab still opens.
- Visual smoke catches no missing icon paths.

### Phase 3: Extract Deck Health Center

Goal: move a self-contained fullscreen window first.

Why first:

- It has a clear open/render/close lifecycle.
- It builds from loader health results.
- It is less central than Library or Creator.

Tasks:

- Move Health Center open/close/render state into `loredeck-health-panel.js`.
- Keep health computation in loader/health helpers.
- Pass shell helpers through runtime panel context.
- Preserve scroll-position behavior on refresh scan.

Exit criteria:

- Opening Health Center from Library still works.
- Refresh Scan does not snap to top.
- grouped issues, category tabs, inventory, files, and repair actions still render.

### Phase 4: Extract Loredeck Library

Goal: move the largest standalone UI surface.

Tasks:

- Move Library open/close/render state to `loredeck-library-panel.js`.
- Move Library selection state with it.
- Move Library drag state with it.
- Keep pure helper modules unchanged unless they need small exported additions.
- Keep deck/folder mutations in `loredeck-library-service.js`.
- Keep list ordering/view models in `loredeck-library-view.js`.
- Keep drag feedback decisions in `loredeck-library-drag.js`.

Constraints:

- Do not redesign Library during extraction.
- Do not alter folder schema.
- Do not alter active stack persisted shape.
- Do not reintroduce default active stack items.

Exit criteria:

- Library opens and closes.
- click-off close still works.
- search, sort, folder expand/collapse, selection, shift-select, duplicate, delete, import, export, cover import/remove, active stack add/remove, folder stack groups, drag reorder, drag between columns, and details collapse still work.
- No scroll snap regressions.

### Phase 5: Extract Loredecks Tab And Creator Project Shelf

Goal: separate the compact Loredecks tab from the fullscreen Library and Creator.

Tasks:

- Move `renderLoredecksTab`.
- Move Library launch card.
- Move Creator project shelf.
- Keep project mutations in `loredeck-creator-projects.js` or dedicated project helpers.

Exit criteria:

- Loredecks tab renders.
- Open Library and Create Deck buttons work.
- unfinished Generated Loredeck projects still display and resume.

### Phase 6: Extract Loredeck Creator Panel

Goal: isolate the staged Creator UI after the UI kit and project shelf are stable.

Tasks:

- Move Creator workbench shell and stage rendering.
- Move Creator status/progress UI.
- Move stage cards one stage at a time if needed:
  - Scope Brief.
  - Story Outline.
  - Title Pass.
  - Context Plan.
  - Lorecards.
  - Review Queue.
  - Deck Health.
  - Finalize.
- Keep generation job execution in `generation-job-runner.js`.
- Keep prompt construction and parsing in `loredeck-assistant.js`.
- Keep durable project state in `loredeck-creator-projects.js` and `state-manager.js`.

Constraints:

- Do not change model prompts during extraction.
- Do not change batching behavior during extraction.
- Preserve duplicate-click suppression.
- Preserve interrupted job recovery.
- Preserve no-raw-output UI behavior.

Exit criteria:

- Resume in-progress projects.
- Draft brief, outline, titles, planning, and entries still work.
- Active model-call status survives closing/reopening the Creator.
- Pending Review routing still works.

### Phase 7: Extract Context Tab And Context Workbench

Goal: isolate the Context runtime UI without changing resolver behavior.

Tasks:

- Move Context tab rendering.
- Move Context row rendering.
- Move resolver audit/proposal display.
- Move Context Workbench shell/header/selector into `context-workbench-panel.js`.
- Move Context Workbench Context table/editor shell into `context-workbench-panel.js`.
- Move Context Workbench Aliases view into `context-workbench-panel.js`.
- Move Context Workbench Validation view into `context-workbench-panel.js`.
- Move Context Workbench waypoint browser into `context-workbench-panel.js`.
- Move Context Workbench resolver tester into `context-workbench-panel.js`.
- Move Context Workbench Context picker subtool into `context-workbench-panel.js`.
- Move Context Workbench Timeline content view into `context-workbench-panel.js`.
- Keep resolver logic in `context-resolver.js`.
- Keep index/search logic in `context-index.js`.

Constraints:

- Do not move runtime Context responsibility back into the Loredecks tab.
- Do not add new model-call behavior in this extraction.
- Preserve manual mode and automatic cadence settings.

Exit criteria:

- Context tab renders loaded Loredeck Contexts.
- Context Browser opens; shell/header/selector render through `context-workbench-panel.js`.
- Workbench Context table/editor shell renders through `context-workbench-panel.js` and still delegates subtools/mutations through configured callbacks.
- Workbench waypoint browser renders through `context-workbench-panel.js` and still routes Use Window, Start Here, After, Before, Lorecard, Timeline, and Load/Reload Events actions through configured callbacks.
- Workbench resolver tester renders through `context-workbench-panel.js` and still routes local anchor application, Lorecard-derived application, queueing, source-Lorecard lookup, and Lorecard loading through configured callbacks.
- Workbench Context picker renders through `context-workbench-panel.js` and still routes Find, Use Window, Use Anchor, After, and Before through configured callbacks.
- Workbench Aliases view renders through `context-workbench-panel.js` and still routes Select/Apply actions through configured callbacks.
- Workbench Validation view renders through `context-workbench-panel.js` and still routes issue rows back to Timeline.
- Workbench Timeline view renders through `context-workbench-panel.js` and still routes search/type filtering, row selection, apply, edit, disable/restore, forget overlay, attached-Lorecard filtering, and timeline export through configured callbacks.
- Workbench content views can still route local/model resolver and timeline mutation actions.
- Manual before/after/lock edits persist.
- local resolver and model fallback buttons still route through review/proposal surfaces.

### Phase 8: Extract Settings And Theme Panels

Goal: split provider/settings UI from Theme Pack UI.

Tasks:

- Move Settings tab provider/API sections to `settings-panel.js`.
- Move Theme Pack UI to `theme-panel.js`.
- Use `runtime-theme.js` for theme/icon lookups.

Constraints:

- Do not resurrect the SillyTavern extension dropdown provider controls.
- Keep API/model settings in the runtime Settings tab.
- Preserve installed Theme Pack and Icon Set switching.

Exit criteria:

- Settings tab no longer crashes or vanishes.
- provider profiles, model settings, API key storage, Theme Packs, Icon Sets, color overrides, and accessibility checks still work.

### Phase 9: Extract Lorecards Panel And Timeline

Goal: move Lorecard review/editing out of the runtime shell.

Tasks:

- Move accepted Lorecard list.
- Move Pending Review card rendering.
- Move bulk edit controls.
- Move entry cards and tag chips.
- Move new Lorecard dialog.
- Move timeline graph/minimap/event detail to `lore-timeline-panel.js` if separate extraction is cleaner.

Constraints:

- Preserve Pending Review accept/reject persistence.
- Preserve selection and last-item clearing behavior.
- Preserve schema v3 Context/source metadata chips.
- Preserve Auto-Relevance display.

Exit criteria:

- accepted/pending Lorecards render.
- bulk accept/reject/edit works.
- tags can be edited.
- entry expansion works.
- timeline opens and displays events.

### Phase 10: Extract Runtime Tour And Remaining Utilities

Goal: finish the leftovers after core surfaces are independent.

Tasks:

- Move walkthrough/tour logic.
- Move remaining feature-neutral utilities.
- Remove dead wrappers that no extracted module uses.
- Re-run line-count audit.

Exit criteria:

- `lore-panel.js` is a facade/router rather than a feature module.
- No hidden feature state remains in `lore-panel.js` except shell state.
- All major windows still work in SillyTavern.

## Validation Gates

Run after every extraction slice:

```powershell
node --check lore-panel.js
node --check index.js
```

Also run `node --check` for each new module.

Run relevant deterministic scripts when the slice touches the related system:

```powershell
node scripts\test-core-integration-hp-year6.mjs
node scripts\test-core-integration-hp-year6-progression.mjs
node scripts\test-core-integration-hp-year6-accepted-context.mjs
node scripts\test-hp-reference-deck-conformance.mjs
```

Run visual smoke when the slice touches UI surfaces:

```text
tests/visual-smoke.html
```

For major UI extractions, also test in live SillyTavern:

```text
http://127.0.0.1:8000/
```

Minimum manual smoke checklist:

- Saga shelf loads.
- shelf expands and collapses.
- all sidebar tabs switch without disappearing.
- Loredeck Library opens and closes.
- Deck Health Center opens and refreshes without scroll snap.
- Loredeck Creator opens and resumes project state.
- Context tab renders loaded Loredeck Context rows.
- Lorecards tab renders accepted and pending entries.
- Settings tab opens.
- Theme Pack/Icon Set section works.
- Injection preview renders.
- browser console has no new errors.

## Code Review Checklist For Each Slice

- Public exports remain stable unless explicitly changed.
- No unrelated UI redesign included.
- No broad CSS class renames.
- No persisted state key rename without migration.
- No feature module imports the shell directly if a context object would avoid coupling.
- No circular imports.
- Model-call prompts and parsing stay unchanged unless that is the explicit slice.
- Existing helper modules remain pure where they are already pure.
- Button handlers still prevent default where needed.
- Scroll position is preserved on refresh actions.
- Fullscreen overlays close on click-off and Escape where expected.

## Risk Register

### Circular Imports

Risk: feature modules may need shell refresh helpers while the shell imports feature modules.

Mitigation: pass a runtime panel context object into feature render/open functions. Avoid importing shell functions directly into feature modules.

### Shared Top-Level State

Risk: state hidden in `lore-panel.js` can break when moved.

Mitigation: move one feature's state at a time. Prefer a feature-local state object exported through explicit functions.

### Scroll Snap Regressions

Risk: rerendering entire overlays can reset scroll.

Mitigation: preserve scroll in refresh helpers, and avoid full overlay rerender for selection-only updates.

### UI Helper Drift

Risk: extracted UI helpers become too generic or start importing feature logic.

Mitigation: keep `runtime-ui-kit.js` DOM-only. Feature-specific helpers belong in feature modules.

### Legacy Naming Cleanup

Risk: changing `wandlight-*` IDs/classes while extracting code will break CSS and tests.

Mitigation: leave internal names alone during decomposition. Do a later alias/migration pass.

### Live Model-Call State

Risk: Creator extraction can lose active generation state when windows close.

Mitigation: keep active job/run state in durable stores and make UI state a projection of saved job state.

## Recommended First Implementation Slice

Start with Phase 1: extract `runtime-ui-kit.js`.

Why:

- It reduces coupling for all later slices.
- It is mostly mechanical.
- It gives every future module a stable toolkit.
- It avoids the highest-risk systems first.

Suggested first PR/slice:

1. Create `runtime-ui-kit.js`.
2. Move `createButton`, `createKeyValue`, `createStatusPill`, `createEmptyMessage`, `addTooltip`, `confirmAction`, `promptTextAction`, and choice dialog helpers.
3. Export them.
4. Import them into `lore-panel.js`.
5. Run syntax checks.
6. Open visual smoke harness.
7. Confirm shelf, Library, Creator, Health Center, Lorecards, and Settings still render.

Do not move feature-specific UI in the first slice.

## Target End State

`lore-panel.js` should become a thin compatibility facade and runtime router. The end state should look roughly like:

```text
lore-panel.js
runtime-shell.js
runtime-ui-kit.js
runtime-theme.js
runtime-panel-context.js
loredecks-tab-panel.js
loredeck-library-panel.js
loredeck-health-panel.js
loredeck-creator-panel.js
context-panel.js
context-workbench-panel.js
settings-panel.js
theme-panel.js
lorecards-panel.js
lore-timeline-panel.js
runtime-tour.js
```

Target line-count direction:

- `lore-panel.js`: under 500 lines.
- `runtime-shell.js`: under 5k lines.
- feature panel modules: ideally under 5k lines each.
- pure service/helper modules: small and testable.

The real success metric is not line count alone. The success metric is that a change to the Loredeck Library no longer risks breaking Creator generation, Context resolution, Theme Packs, or Lorecard review.
