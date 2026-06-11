# Context Workbench Story Position Picker Consolidation Plan

Status: implemented first slice. Runtime consolidation, guidance updates, renamed story-position tour targets, story-position dependency/class names, smoke expectations, and a focused picker contract test are included. The focused contract now covers the merged picker label, removed duplicate sections, current-row pinning, partial-bound versus exact-window pinning, timeline alias search, source jumps, timeline/window application, Lorecard-derived event application, Lorecard-derived boundaries, and clearing selection. In-app browser live smoke confirmed the consolidated picker renders against a loaded Year 6 Loredeck, while the existing CDP helper is still blocked by `Page.enable timed out` in this environment.

This plan consolidates the Context Workbench's duplicate story-position pickers into one runtime selection surface. The goal is to preserve the high-value selection capabilities while removing the need for users to understand why `Browse Story Waypoints` and `Select From Timeline` both appear to set the same Context.

## Problem

The current Context Workbench Context tab mounts both:

- legacy `createContextWorkbenchWaypointBrowser(...)`, labeled `Browse Story Waypoints`.
- `createContextWorkbenchContextPicker(...)`, labeled `Select From Timeline`.

Both surfaces search timeline anchors/windows and both can apply the selected Loredeck Context. The first is friendlier and supports Lorecard-derived story events. The second is more registry-exact and pins the current timeline row. The functional overlap makes the Context tab feel like it has two answers to the same user question:

> Where is this chat inside this loaded Loredeck's story?

This is especially harmful in Basic Experience, where Context selection should remain lightweight, checklist-centered, and direct.

## Decision

Replace the two visible picker sections with one primary section:

**Choose Story Position**

This section becomes the trusted manual selection path for loaded Loredeck Context. It should combine the useful behavior from both existing pickers:

- major timeline browsing from `Browse Story Waypoints`;
- exact timeline-row search from `Select From Timeline`;
- current selection pinning from `Select From Timeline`;
- event-level Lorecard-derived story events from `Browse Story Waypoints`;
- `Start Here`, `Use Window`, `After`, and `Before` actions;
- source inspection through `Timeline` or `Lorecard`.

The full `Timeline` tab remains the dense registry inspection and authoring surface. The combined picker should not absorb registry editing, validation, alias management, export, or bulk operations.

## Non-Goals

- Do not redesign the whole Context Workbench shell.
- Do not remove the full `Timeline`, `Aliases`, or `Validation` tabs.
- Do not remove manual Context fields; they remain the advanced fallback.
- Do not weaken manual locks or the rule that manual user selection is the most trusted Context source.
- Do not build an exhaustive local natural-language resolver. Phrase Resolver and Reasoner-backed bounded candidates remain separate.
- Do not add compatibility scaffolding for the old two-picker UI; Saga is pre-alpha, so update references in place.

## Target UX Contract

### Context Tab Order

The selected Loredeck Context editor should read as:

1. Selected Loredeck title and status chips.
2. Current Context summary.
3. **Choose Story Position**.
4. Phrase Resolver.
5. Advanced/manual fields.
6. Seed, Timeline, and Reset actions.

The user should see one primary way to choose the story position, then optional tools for phrase matching or manual override.

### Choose Story Position

Controls:

- Search input for anchors, windows, aliases, tags, coordinates, attached Lorecard IDs, and loaded story events.
- Filter selector:
  - `Major`
  - `Windows`
  - `Anchors`
  - `Events`
  - `Lorecards`
  - `All`
- `Find` action.
- `Load Events` / `Reload Events` action for Lorecard-derived story events.
- Coverage chips:
  - timeline row count;
  - story-event loaded/unloaded state;
  - shown count;
  - current filter state.

Rows:

- Anchor row actions:
  - `Start Here`
  - `After`
  - `Before`
  - `Timeline`
- Window row actions:
  - `Use Window`
  - `Timeline`
- Lorecard-derived event row actions:
  - `Start Here`
  - `After`
  - `Before`
  - `Lorecard`

Current selection:

- The current exact anchor, exact window, or active lower/upper bounds must be visibly marked.
- A partial `After` or `Before` selection must pin the selected bound anchor, not a predefined window that happens to share one bound.
- When search is empty, the current matching row should remain pinned above the default result set when possible.
- The current window summary should stay visible near the picker and continue to show `After`, `Before`, and lock state.

### Copy

Use user-facing copy that describes the task, not the implementation:

- Section title: `Choose Story Position`.
- Search placeholder: `Search anchors, windows, events, aliases...`.
- Empty state with no timeline rows: `No story positions are loaded for this Loredeck yet.`
- Empty state with no event data: `Load Events to include Lorecard-derived moments.`
- Keep `Timeline` as a source-inspection action, not a second picker label.

Avoid exposing `Select From Timeline` in the main Context tab after consolidation.

## Feature Preservation Matrix

| Existing Capability | Current Home | New Home | Keep? |
| --- | --- | --- | --- |
| Browse major anchors/windows | Browse Story Waypoints | Choose Story Position | Yes |
| Optional Lorecard-derived story events | Browse Story Waypoints | Choose Story Position | Yes |
| Exact anchor application | Select From Timeline | `Start Here` on anchor row | Yes |
| Whole window application | Both | `Use Window` on window row | Yes |
| Custom lower/upper bounds | Both | `After` / `Before` on anchor or event row | Yes |
| Exact timeline-row search | Select From Timeline | Choose Story Position search + `All` filter | Yes |
| Current row pinning | Select From Timeline | Choose Story Position current-row pin | Yes |
| Timeline source inspection | Browse Story Waypoints / Timeline tab | `Timeline` source action + Timeline tab | Yes |
| Registry editing/export/validation | Timeline tab | Timeline tab | Yes |
| Separate visible `Select From Timeline` section | Context tab | Removed | No |

## Implementation Plan

### Phase 1: Rename And Reframe The Primary Picker

Files:

- `src/context/context-workbench-panel.js`

Steps:

1. Rename the visible label in `createContextWorkbenchStoryPositionPicker()` from `Browse Story Waypoints` to `Choose Story Position`.
2. Update tooltip and empty-state text to describe story-position selection.
3. Rename the old `context.workbench.waypoints` tour target to `context.workbench.storyPosition` and update guide/test references in place.
4. Replace `Current Window` with `Selected Range` so range-building reads as the current selection rather than a separate builder concept.

Acceptance:

- The Context tab has one obvious primary selector title.
- Existing `Start Here`, `Use Window`, `After`, and `Before` actions still function.

### Phase 2: Port Precision From Select From Timeline

Files:

- `src/context/context-workbench-panel.js`

Steps:

1. Move `getContextWorkbenchCurrentTimelineItem(...)` behavior into the combined picker path.
2. Pin the current exact anchor/window/boundary row above the default unsearched list when it is not already visible.
3. Preserve active row styling for:
   - exact `anchorId`;
   - `anchorFrom`;
   - `anchorTo`;
   - exact matching `window`.
4. Ensure empty search shows the current row plus the normal major result set, capped to the existing result limit.
5. Make the search path cover the same fields as `Select From Timeline`: labels, IDs, aliases, tags, arcs, dates, episodes, chapters, attached Lorecard IDs, and coordinates.

Acceptance:

- A user can perform every precise `Select From Timeline` action from `Choose Story Position`.
- The current Context remains visible even when the normal `Major` filter would not show it.

### Phase 3: Remove The Duplicate Picker

Files:

- `src/context/context-workbench-panel.js`

Steps:

1. Remove the `panel.appendChild(createContextWorkbenchContextPicker(...))` call from `createContextWorkbenchContextEditor(...)`.
2. Remove `createContextWorkbenchContextPicker(...)` and `createContextWorkbenchContextPickerRow(...)` if no longer referenced.
3. Remove or repurpose `contextWorkbenchContextQuery`, `getContextWorkbenchContextQuery`, and `setContextWorkbenchContextQuery` if they become dead state.
4. Keep `contextWorkbenchStoryPositionQuery` as the single picker query state.

Acceptance:

- `rg "Select From Timeline"` returns no runtime UI references.
- No dead picker functions or query state remain.

### Phase 4: Adjust Guidance, Docs, And Tour Targets

Files:

- `src/runtime/lore-panel.js`
- `docs/user/BASIC_WORKFLOW.md`
- `docs/user/ADVANCED_WORKFLOW.md`
- `docs/development/CONTEXT_EDITOR_WORKSHOP.md`
- `docs/development/SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md`
- `docs/development/SAGA_VISUAL_SMOKE.md`

Steps:

1. Update Basic checklist guidance from `Browse Story Waypoints` / `Select From Timeline` language to `Choose Story Position`.
2. Replace walkthrough rows that explain `Use Anchor` from `Select From Timeline` with `Start Here` from `Choose Story Position`.
3. Keep `Timeline` described as inspection/authoring, not as the normal place to choose Context.
4. Update visual smoke documentation to mention the consolidated picker and current-row behavior.

Acceptance:

- Documentation gives one normal manual selection path.
- Advanced docs still explain Timeline tab inspection and registry authoring.

### Phase 5: Verification

Minimum local checks:

```powershell
node --check src\context\context-workbench-panel.js
node --check src\runtime\lore-panel.js
node tools\scripts\test-context-workbench-picker.mjs
node tools\scripts\test-experience-modes.mjs
node tools\scripts\test-context-current-contract.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

Targeted behavior checks:

- Open Context Workbench with a loaded Loredeck.
- Search a timeline anchor by label.
- Search a timeline anchor by exact ID.
- Apply `Start Here`.
- Apply a predefined `Use Window`.
- Apply `After` and `Before` to create a custom window.
- Load Events and apply a Lorecard-derived story event.
- Open a row with `Timeline` and verify the Timeline tab selects the source row.
- Open a Lorecard-derived row with `Lorecard` and verify the Loredeck editor is filtered to the source.
- Reset Context and confirm the picker returns to an unset state.

Live smoke target:

- Re-run the loaded-stack Context Browser flow that searches `Ron dates the blonde girl`, applies an after-bound and before-bound, and verifies the saved manual locked Context window.

Current verification notes:

- Passing: `node --check src\context\context-workbench-panel.js`
- Passing: `node --check src\runtime\lore-panel.js`
- Passing: `node --check src\runtime\runtime-guide-content.js`
- Passing: `node --check tools\scripts\test-context-workbench-picker.mjs`
- Passing: `node --check tools\scripts\smoke-live-st-cdp.mjs`
- Passing: `node --check tools\scripts\test-visual-smoke-harness.mjs`
- Passing: `node tools\scripts\test-context-workbench-picker.mjs`, including rendered-DOM guards against retired `context.workbench.waypoints` targets and `.saga-context-workbench-waypoint-*` rows.
- Passing: `node tools\scripts\test-experience-modes.mjs`
- Passing: `node tools\scripts\test-context-current-contract.mjs`
- Passing: `node tools\scripts\test-visual-smoke-harness.mjs`, including static guards for story-position dependency names/selectors and against retired waypoint picker internals/styles.
- Passing: live CDP smoke script static coverage now checks the loaded-Loredeck Workbench for retired `Browse Story Waypoints`, `Select From Timeline`, `.saga-context-workbench-waypoint-row`, and `context.workbench.waypoints` output.
- Passing: `node tools\scripts\run-alpha-gate.mjs`; the gate now syntax-checks the Context Workbench and runtime guide modules, and includes `tools/scripts/test-experience-modes.mjs` plus `tools/scripts/test-context-workbench-picker.mjs`.
- Passing: static target/copy check confirms runtime guide and checklist routes use `context.workbench.storyPosition`; the old `context.workbench.waypoints` target remains only as a historical note in this plan.
- Passing: active SillyTavern server module check confirms `context-workbench-panel.js` serves `Choose Story Position` and `context.workbench.storyPosition`, with no served `Browse Story Waypoints`, `Select From Timeline`, or `context.workbench.waypoints` strings.
- Passing: active SillyTavern server module/CSS check confirms the served Context Workbench, runtime panel, and CSS use story-position dependency/state/selectors, with no served `Waypoint` dependency/state/selectors.

## Risks And Mitigations

### Risk: The combined picker becomes too dense.

Mitigation: Keep registry editing, export, validation, aliases, and bulk operations in the Timeline/Aliases/Validation tabs. The combined picker only chooses runtime Context.

### Risk: Precision users lose the exact row workflow.

Mitigation: Port current-row pinning and exact row search before removing `Select From Timeline`.

### Risk: Basic checklist targets break.

Mitigation: Update `markTourTarget` references and run visual smoke checks in the same slice.

### Risk: Story events overwhelm the default list.

Mitigation: Keep Events unloaded by default, keep `Major` as the default filter, and only show dense Lorecard-derived rows after search or explicit event loading.

### Risk: Users confuse `Timeline` action with the selection flow.

Mitigation: Use `Timeline` only as a source-inspection action. The primary apply actions remain `Start Here`, `Use Window`, `After`, and `Before`.

## Done Criteria

The feature update is done when:

- the Context tab has one primary story-position picker;
- all previous `Select From Timeline` selection capabilities are reachable from that picker;
- the full Timeline tab still supports inspection/authoring;
- Basic and Advanced guidance no longer teaches two duplicate selection surfaces;
- automated smoke checks pass;
- a live or harnessed Context Browser flow verifies search, exact selection, custom window bounds, manual lock persistence, and source inspection.
