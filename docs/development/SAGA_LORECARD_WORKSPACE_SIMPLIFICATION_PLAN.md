# Saga Lorecards Workspace Simplification Plan

Status: proposed two-stage target architecture for simplifying Lorecards across desktop and mobile. No compatibility scaffolding is required; Saga is pre-alpha, so old surfaces should be replaced in place when implementation starts.

This plan redesigns the Lorecards tab around one canonical object workspace instead of a pipeline of stacked sections. Delivery is intentionally staged: desktop establishes the shared model and primary workspace first, then mobile adopts the same model with a cleaner `Generate | Automate | Lore` route structure.

The design rule is:

```text
visual state first, direct object interaction second, buttons only for decisions or explicit edit mode
```

## Delivery Strategy

This is a two-stage redesign:

1. Desktop Update.
2. Mobile Update.

Stage 1 replaces the desktop stacked lifecycle surfaces with the unified Lorecards workspace. It owns the shared row model, default sorting, visual state language, detail-pane interaction, and retirement of the desktop Pipeline, Active Set, Pending Review, and Accepted Lorecards sections as separate primary blocks.

Stage 2 updates mobile after the shared model is in place. Mobile should not be a separate product direction; it should express the same Lorecards model through phone-sized workspaces: `Generate | Automate | Lore`.

Do not begin by redesigning mobile first. Mobile depends on the row model and interaction budget created in Stage 1, and implementing both at once is likely to blur the ownership boundaries between generation, automation, review, and accepted-card management.

## Problem

The current desktop Lorecards tab has grown into several overlapping management surfaces:

- Lorecard Pipeline.
- Capture / Suggest.
- Lore Automation.
- Pending Review.
- Active Set.
- Accepted Lorecards.
- Lore Timeline.
- Pending and Accepted workbench launch rows.

This makes Lorecards feel like objects are being shuffled through multiple lists. It also makes users decide which surface owns a task before they can act.

The worst duplication is `Active Set`: active state is already an attribute of accepted Lorecards, but the UI presents it as another list. Pending Review has a similar problem. Pending is a real review state, but it does not need to be a whole standalone page block when it can be represented as a state inside the same Lorecards list.

## Decision

Replace the stacked desktop Lorecards flow with one primary workspace:

```text
Lorecards = search + filters + unified list + selected detail pane
```

Pending, accepted, active, pinned, muted, conflict, source, type, deck, and Context are row attributes. They are not folders and not separate places where cards live.

The default view is `All Lorecards`, sorted by attention:

1. Pending Review.
2. Active accepted cards.
3. Pinned accepted cards.
4. Recently changed accepted cards.
5. Everything else.

Quick filters can narrow the same list, but cards should not appear to move between workflow buckets as the primary interaction model.

## Rejected Direction: Folders

Do not model Lorecards like Loredeck Library folders.

Loredecks are stable source objects, so folder browsing works. Lorecards are working records with changing operational states. If pending, accepted, active, pinned, and muted become folders, the product will constantly move cards around and make users hunt for where Saga put them.

Filters can look folder-like when useful, but they must be saved views over one list, not ownership containers.

## Non-Goals

- Do not build a new folder tree for Lorecards.
- Do not preserve the current `Lorecard Pipeline` surface.
- Do not preserve `Active Set` as a separate desktop section.
- Do not keep separate `Pending Review` and `Accepted Lorecards` page blocks as the primary desktop UI.
- Do not add row-level button sprawl for pending cards.
- Do not make users choose between Apply Update, Apply as New, Inspect, Edit, and Reject on every pending row.
- Do not remove the underlying pending review state or acceptance contract.
- Do not remove Lore Timeline; it becomes audit/history, not part of the working list.

## Target UX Contract

### Page Structure

The desktop Lorecards tab should read as:

1. Header with compact counters.
2. Search and filter bar.
3. Unified Lorecards list.
4. Selected Lorecard detail pane.
5. Compact utilities for `Capture / Suggest`, `Lore Automation`, and `Timeline`.

The list is the product. Capture, automation, and timeline are supporting tools.

### Header

The header should expose only the operational summary:

- `Needs Review: N`
- `Active: N`
- `Selected: N`

The total Accepted count belongs in the list summary. Muted belongs in filters unless muted cards are currently selected or blocking active state. Keep labels compact. Avoid explaining the whole feature in visible body copy.

### Filters

Primary filter chips:

- `All`
- `Needs Review`
- `Active`
- `Pinned`
- `Muted`
- `Conflicts`

Secondary filters:

- Source.
- Deck.
- Context.
- Type.
- Canon/story status.
- Relevance.

Secondary filters should not render as a full visible control wall by default. Use a compact filter popover, overflow, or collapsible advanced filter row.

Card chips should do useful work:

- state chips can filter by that state;
- source chips can filter by source;
- deck chips can filter by deck;
- Context chips can filter by Context;
- type chips can filter by type.

Do not duplicate every chip as a separate always-visible toolbar control. Filters must be views over the unified row model. Changing a filter should never imply a card has moved to a different storage location.

### Sort

Default sort should prioritize action and prompt impact:

1. Pending Review.
2. Active high-relevance cards.
3. Pinned cards.
4. Conflict or duplicate warnings.
5. Recently changed cards.
6. Remaining accepted cards by relevance and title.

Users can switch sort order, but the default should make the next useful action obvious.

## Interaction Budget

The simplified workspace must not replace section sprawl with toolbar or row-action sprawl.

Always visible on a normal row:

- title;
- short fact preview;
- visual state treatment;
- two to four high-value chips.

Pending row permanent actions:

- `Accept`;
- `Reject`.

Accepted row permanent actions:

- none by default, or at most compact icon-led active/pin/mute toggles when the design has room;
- no permanent text buttons.

Hover, focus, or selected-row actions:

- activate/deactivate;
- pin/unpin;
- mute/unmute;
- open overflow.

Detail-pane actions:

- edit;
- delete;
- history;
- automation ownership;
- advanced metadata;
- source inspection.

Bulk actions:

- appear only after selection.

Rare tools:

- live in overflow, detail pane, modal, or a dedicated utility surface.

The default row should read as an object with state, not as a mini toolbar.

## Card States And Actions

### Pending Review Cards

Pending cards should have exactly two primary row actions:

```text
Accept | Reject
```

That is the clean default. No Apply Update, Apply as New, Inspect, Edit, or Dismiss button row.

Prefer compact check/X actions on the row with accessible labels and tooltips. Text buttons are acceptable in the detail pane, selected action tray, or accessibility fallback, but the default row must stay visually light.

Pending rows should show state through chips and visual treatment:

- `Pending Review`
- `Conflict`
- `Duplicate`
- `Low confidence`
- `Updates existing`
- source and Context chips when useful

Clicking or selecting a pending row opens the detail pane. If a pending entry needs routing clarification, the detail pane can show the destination and let the user adjust the target before choosing `Accept`. The row still remains clean and still has only `Accept` and `Reject` as primary actions.

### Accepted Cards

Accepted cards use the same list and become the normal durable object state.

Accepted rows should prioritize state indicators over visible commands. When row controls are needed, they should be compact icon-led toggles with tooltips:

- Activate/deactivate.
- Pin/unpin.
- Mute/unmute.

Do not render permanent accepted-row text buttons. Editing, deletion, notes, injection override, source inspection, automation ownership, and history should live in the detail pane or overflow, not as permanent row commands.

### Active Cards

Active is not a section. Active is an accepted-card state.

Active cards should be visually obvious:

- theme-accent left edge;
- soft accent glow;
- `Active` chip;
- optional top sort priority in `All`;
- quick deactivate toggle only on hover, focus, selection, or in the detail pane.

The current `saga-lore-entry-active` class is the right hook, but the visual styling needs to become much stronger than a subtle border color.

### Muted Cards

Muted cards stay in the same list and should be visually subdued:

- reduced surface contrast;
- `Muted` chip;
- quick unmute toggle only on hover, focus, selection, or in the detail pane;
- excluded from active styling.

### Pinned Cards

Pinned is a priority marker, not a location.

Pinned cards should show:

- `Pinned` chip or marker;
- quick unpin toggle only on hover, focus, selection, or in the detail pane;
- sort boost when default sort is active.

Active, muted, and pinned chips are indicators first. Where practical, clicking them should filter to the matching state. They should not become another row of command buttons.

## Detail Pane

The selected detail pane is where dense information belongs, but it should still use progressive disclosure. The first pane state should read as a summary, not an always-editable form.

For pending cards, show:

- full fact text;
- source;
- reason suggested;
- affected Context;
- duplicate/conflict details;
- target accepted card when applicable;
- `Accept`;
- `Reject`.

For accepted cards, show:

- title;
- lore text/fact;
- category/type;
- canon/story status;
- relevance;
- priority;
- active reason;
- pin/mute state;
- automation ownership;
- history/timeline link.

Accepted detail sections can reveal advanced fields only after an explicit edit or expand action:

- injection override;
- notes;
- tags;
- source inspection;
- delete;
- low-level metadata.

The pane can expose advanced edits without polluting the list, but those edits should not be the first visual impression.

## Supporting Tools

### Capture / Suggest

`Capture / Suggest` should be the one primary creation affordance. It can open a drawer or compact panel that feeds pending rows into the unified list.

It should not be a full section permanently occupying the first desktop viewport unless the current state has no Lorecards at all.

### Lore Automation

Lore Automation operates on accepted cards. It should appear as an automation status chip or compact utility, not as a lifecycle stage and not as another full row of controls.

The main list should show automation ownership per accepted card through a compact chip such as `LA managed` or `LA protected`.

### Timeline

Timeline remains valuable as audit and recovery.

It should be reachable through a compact history/timeline icon or utility affordance and should open as the existing larger visualizer/workbench. It should not compete with the main list as a daily card-management surface.

## Mobile Alignment

The mobile redesign already proved the useful principle:

```text
one selected workspace, object-first body, no in-content pipeline card
```

The new Lorecards model should update mobile too. Otherwise desktop and mobile will teach different mental models.

Mobile should move from:

```text
Generation | Automation | Pending | Approved
```

to:

```text
Generate | Automate | Lore
```

`Generate` is the creation/suggestion workspace.

`Automate` is the Lore Automation workspace.

`Lore` is the unified object workspace. Pending, accepted, active, pinned, muted, conflict, source, type, deck, and Context are states or filters inside `Lore`, not separate mobile routes.

### Mobile Route Responsibilities

| Sub-tab | Purpose | Default Interaction |
| --- | --- | --- |
| `Lore` | Review and manage all Lorecards in one object list | Tap cards, chips, or compact state controls; pending cards expose only Accept/Reject. |
| `Generate` | Create or suggest new Lorecards | Run manual note, story scan, or canon/Loredeck suggestion flows. |
| `Automation` | Configure and review Lore Automation | Inspect mode/status, run now, pause, undo, and recent activity. |

Mobile default routing:

- If pending or accepted Lorecards exist, open `Lore`.
- If no Lorecards exist, open `Generate`.
- After `Generate` creates pending entries, route or highlight back to `Lore` with `Needs Review` visible.

`Pending`, `Approved`, and `Active` should not be mobile route-level tabs after this update. They become state chips and filters inside `Lore`.

### Mobile Lore Page

The `Lore` page renders the same unified row model as desktop:

```text
pendingLoreEntries + loreMatrix -> lorecardRows
```

Default mobile sort should match desktop:

1. Pending Review / Needs Review.
2. Active accepted cards.
3. Pinned accepted cards.
4. Conflict or duplicate warnings.
5. Recently changed cards.
6. Remaining accepted cards.

Primary mobile filters inside `Lore`:

- `All`
- `Needs Review`
- `Active`
- `Pinned`
- `Muted`
- `Conflicts`

Secondary filters should live in a compact filter sheet:

- source;
- deck;
- Context;
- type;
- canon/story status;
- relevance.

Mobile card behavior follows the same interaction budget:

- pending cards expose only compact `Accept` and `Reject` actions;
- accepted cards rely on visual state, chips, tap, tap-hold, selected tray, and detail sheet;
- active cards get the same strong accent edge/glow as desktop;
- pinned and muted are visual states, not route destinations;
- chips should filter the `Lore` list where practical.

### Mobile Generate Page

`Generate` replaces the old `Generation` label.

It should contain only creation/suggestion workflows:

- manual note;
- story scan;
- canon/Loredeck suggestions;
- current generation status;
- recent output handoff into `Lore`.

It should not include pending review management. Generated entries become pending rows in `Lore`.

### Mobile Automation Page

`Automation` remains only if it stays a real workspace:

- mode/status;
- run now;
- pause;
- undo last run;
- recent activity;
- provider/status warnings;
- automation ownership summary.

It should not participate in card lifecycle navigation.

### Mobile Timeline / History

Do not add Timeline as a mobile sub-tab.

Timeline and history should be reachable from:

- card detail sheet;
- overflow/history icon;
- automation activity when relevant.

Timeline is audit and recovery, not a daily mobile route.

### Desktop Relationship

Desktop should not literally copy the mobile bottom sub-tab structure. It should copy the product model:

- one primary workspace;
- objects first;
- state is visual;
- supporting tools are secondary;
- no lifecycle control card as the first thing users must process.

Mobile keeps route-level sub-tabs because phone screens need one workspace at a time. Desktop uses one dense workspace with filters and a detail pane.

## Data And Render Architecture

Create a unified Lorecard row view model that combines current pending entries and accepted lore entries:

```text
pendingLoreEntries + loreMatrix -> lorecardRows
```

Each row should expose:

- id;
- title;
- fact;
- source;
- deck;
- Context metadata;
- status: pending or accepted;
- isPending;
- isAccepted;
- isActive;
- isPinned;
- isMuted;
- hasConflict;
- hasDuplicate;
- confidence;
- relevance;
- priority;
- updatedAt or timeline timestamp;

The UI should render from this model. Do not store an `available actions` list in the row model. Actions should be derived by the renderer from row state so the product does not grow another action framework. Derived actions can still call the existing pending/accepted mutation helpers underneath.

## Surfaces To Retire Or Replace

Retire from desktop:

- `createLorecardPipelineSurface`.
- desktop `createLorecardActiveSetCollapsible`.
- desktop standalone `createLorecardPendingCollapsible`.
- desktop standalone `createLorecardAcceptedCollapsible`.
- desktop pending and accepted workbench launch rows as compensating UI.

Retire from mobile during Stage 2:

- `Generation | Automation | Pending | Approved` as the Lorecards sub-tab contract.
- route-level `Pending` and `Approved` pages.
- any separate mobile Active Set management page or list.
- smoke/doc expectations that require `Pending` and `Approved` as sub-tabs.

Replace desktop surfaces with:

- `createLorecardWorkspace`.
- workspace toolbar helpers owned by `createLorecardWorkspace`.
- unified list helpers owned by the shared row model.
- `createLorecardWorkspaceDetailPane`.
- `createLorecardUtilityActions`.

Replace mobile surfaces with:

- `Generate | Automate | Lore` sub-tabs.
- `Generate` page that owns creation/suggestion only.
- `Automate` page that owns automation mode/status/activity only.
- unified mobile `Lore` page backed by the shared row model.

The exact function names can change, but the ownership boundary should be clear: one workspace owns normal Lorecards management.

## Two-Stage Delivery Plan

### Stage 1: Desktop Update

Goal: establish the unified row model and replace the desktop stacked Lorecards tab with one canonical workspace.

#### Phase 1: Shared Row Model

- Add the unified Lorecard row model.
- Preserve existing mutation helpers.
- Add focused tests for pending/accepted merge ordering and state flags.
- Confirm pending rows expose only `Accept` and `Reject` as primary row actions.
- Confirm row actions are derived by the renderer from state instead of stored as row data.

#### Phase 2: Desktop Workspace Shell

- Replace stacked desktop rendering with the unified workspace.
- Move Capture / Suggest, Lore Automation, and Timeline into compact utilities.
- Add default filters and sort.
- Add detail pane selection.
- Keep secondary filters behind compact disclosure.
- Keep mobile route behavior functionally unchanged during Stage 1 unless shared helpers require a small adapter.

#### Phase 3: Desktop Visual State Pass

- Strengthen active accepted-card styling through the existing active class.
- Add distinct pending, muted, pinned, conflict, and selected treatments.
- Replace text-heavy row action buttons with compact indicators and object interactions.
- Ensure accepted-row controls appear only on hover, focus, selection, compact icon affordance, overflow, or in the detail pane.
- Verify long titles and chips wrap cleanly at desktop and tablet widths.

#### Phase 4: Desktop Contract Cleanup

- Delete unused pipeline, active-set, pending-section, and accepted-section renderers.
- Update tour targets and walkthrough text.
- Update documentation screenshots.
- Update static smoke assertions that currently expect separate sections.

### Stage 2: Mobile Update

Goal: align mobile with the same object-first model after the shared row model and desktop workspace prove the approach.

#### Phase 1: Mobile Navigation Contract

- Replace mobile Lorecards sub-tabs with `Generate | Automate | Lore`.
- Update `src/runtime/runtime-shell.js` mobile Lorecards stage constants and normalization.
- Update `src/runtime/runtime-shell-view.js` sub-tab metadata, label order, count badges, and tab rendering.
- Normalize old mobile stage values during pre-alpha cleanup:
  - `pending`, `accepted`, and `active` -> `lore`;
  - `suggested` and `generation` -> `generate`;
  - `automation` -> `automation`.
- Update fallback/default routing:
  - first entry into the Lorecards route -> `Generate`;
  - explicit user selection or persisted stage -> selected stage;
  - no rows exist -> `Generate`;
  - generation creates pending rows -> route or highlight `Lore`.

#### Phase 2: Mobile Lore Page

- Update `src/lorecards/lorecards-panel.js` mobile stage rendering so `Lore` owns the object list.
- Render pending and accepted rows together from the shared row model.
- Remove route-level `Pending`, `Approved`, and Active Set page bodies.
- Add mobile `Lore` filters for `All`, `Needs Review`, `Active`, `Pinned`, `Muted`, and `Conflicts`.
- Put secondary filters in a compact filter sheet.
- Keep pending card actions limited to `Accept` and `Reject`.
- Use selected trays, tap-hold, detail sheets, and compact icon affordances for accepted-card controls.

#### Phase 3: Mobile Generate And Automation Pages

- Rename `Generation` to `Generate`.
- Keep creation/suggestion workflows on `Generate`.
- Ensure generated entries hand off into `Lore` as pending rows.
- Keep `Automation` as mode/status/activity only.
- Keep Timeline/history out of the mobile sub-tab bar.

#### Phase 4: Mobile Visual And Test Cleanup

- Update `styles/layout.css` and `styles/review.css` for the three-sub-tab mobile layout and unified card states.
- Convert the mobile sub-tab layout from four slots to three.
- Strengthen mobile active, pending, pinned, muted, conflict, and selected visual states.
- Update mobile visual smoke screenshots.
- Update static assertions and docs that expect `Generation | Automation | Pending | Approved`.
- Add assertions that `Lore` renders both pending and accepted/active rows from the unified model.

## Verification

Focused checks:

- Pending row primary actions are only `Accept` and `Reject`.
- Active cards render inside the same list as accepted cards.
- Active cards have strong visual state.
- Muted cards cannot render as active.
- Accepted rows do not render permanent text-button toolbars.
- Clickable chips filter instead of duplicating a large visible filter wall.
- Secondary filters stay behind compact disclosure by default.
- Filters do not mutate card state.
- Default sort places pending cards before active/pinned accepted cards.
- Timeline remains reachable.
- Capture / Suggest can add new pending rows that appear in the unified list.
- After Stage 2, mobile Lorecards sub-tabs are exactly `Generate | Automate | Lore`.
- After Stage 2, mobile `Generate` creates pending rows without owning review management.
- After Stage 2, mobile `Automate` owns automation mode/status/activity only.
- After Stage 2, mobile `Lore` renders pending and accepted/active cards in one list.
- After Stage 2, mobile Timeline/history is reachable without becoming a sub-tab.

Broad checks:

- `node tools/scripts/test-visual-smoke-harness.mjs`
- rendered desktop Lorecards screenshot refresh after Stage 1;
- mobile Lorecards smoke after Stage 2 to confirm `Generate | Automate | Lore`;
- alpha gate if implementation touches shared state contracts.

## Open Questions

- Should desktop keep a two-pane split permanently, or collapse the detail pane below the list on narrower tablet widths?
- Should bulk actions exist only behind selection, or should the first implementation remove bulk edit entirely until the unified list proves stable?
- Should rejected pending rows become timeline-only recovery events, or should there be a hidden/recoverable rejected filter later?

These are implementation choices. They should not reopen the core decision: Lorecards are managed through one list, with pending and active as states.
