# Saga Mobile Touch Interaction Redesign

## Purpose

This document defines the next mobile design layer after the initial mobile
shell and mobile UX revision. It supersedes the idea that mobile should expose
smaller versions of the desktop Library, stack manager, and Lorecard
workbenches.

The mobile UI should feel like a direct-touch product. Users should manipulate
Loredecks, Lorecards, Context rows, and session state by touching the objects
themselves: tap to select, tap selected objects to remove or collapse, tap-hold
to inspect, and use explicit modes only when a task needs them.

Desktop can keep explicit panes, resize handles, dense toolbars, transfer
controls, and specialized stack management. Mobile should preserve the same Saga
data model while replacing desktop operations with touch-first flows.

## Executive Direction

Mobile Saga should be:

- Object-first: default screens show readable objects before commands.
- Touch-native: state changes happen by tapping the object that owns the state.
- Mode-aware: action trays, grab handles, and bulk controls appear only in the
  mode where they are relevant.
- Progressively disclosed: details, health, metadata, repair, export, and edit
  tools are reachable without crowding the default screen.
- Visually explicit: selected objects, selected order, active state, and pending
  state are visible without explaining the UI in text.

The guiding rule:

```text
Default screen = readable objects.
Selected state = contextual actions.
Advanced state = explicit sheet or mode.
```

## Design Thesis

Mobile state should be visible on the object that owns it.

Instead of presenting users with toolbar rows and deeply nested controls:

- Tapping an object changes the primary state for the current screen.
- Selected objects show clear state marks, count badges, order badges, or inline
  trays.
- Tap-hold opens inspection and advanced controls.
- Mode bars appear only when a mode is active.
- Buttons are reserved for explicit commands that cannot be expressed as object
  manipulation.

This is not only a visual cleanup. It changes the mobile interaction model from
"find the right button" to "touch the thing you want to affect."

## Reference Patterns

Use these as pattern references, not visual themes.

| Product | Pattern To Borrow | Saga Application |
| --- | --- | --- |
| Apple Photos | Object grid/list first, selection mode reveals batch actions | Loredeck and Lorecard selection without permanent bulk buttons. |
| Apple Files | Folders open inline, files are objects, long-press opens secondary actions | Mobile Library folders and Loredeck details. |
| Spotify or Apple Music Queue | Selected objects form an ordered active list | Loredeck tap order becomes active stack order. |
| Google Maps | Compact preview expands into deeper sheet | Loredeck/Lorecard detail preview to full sheet. |
| Things or Todoist | Rows carry state; details appear after opening the item | Unified Lorecard list with Pending and Accepted states. |
| Lightroom Mobile | One selected object exposes mode-specific tools | Selected Lorecard or selected Loredeck action tray. |

What not to borrow:

- Hidden gesture-only critical actions.
- Unlabeled icon rows for Saga-specific concepts.
- Permanent command bars that duplicate every object action.
- Desktop-like nested panes inside a phone viewport.

## Gesture Vocabulary

These gestures should be consistent across mobile Saga.

| Gesture | Meaning | Notes |
| --- | --- | --- |
| Tap object | Primary state change for the current screen | Select Loredeck, select Lorecard, open folder, choose Context row. |
| Tap selected object | Toggle off or collapse, depending on screen | Removing selected Loredecks must renumber stack order. |
| Tap-hold object | Inspect, edit, or open object actions | Primary path for object details on mobile. |
| Tap chip | Toggle or filter when the chip represents state | Examples: `Pinned`, `Muted`, `In Stack`, `Health`, `Context`. |
| Swipe | Optional fast secondary action | Use sparingly; avoid conflicts with vertical scrolling. |
| Drag | Reorder only in explicit reorder mode | Do not show grab handles unless reorder mode is active. |

Accessibility requirement: every tap-hold or gesture-only action must also be
available through a visible selected-object sheet, overflow control, or keyboard
reachable action.

Discoverability requirement: the visible fallback must not become a permanent
`Inspect`, `Edit`, `Details`, `Rename`, or `i` button on every card. Use a
selected-object tray, long-press sheet, row-level overflow, or accessible
keyboard action instead.

## Mobile Information Architecture

Keep the mobile bottom bar aligned to the current Experience Mode.

Basic uses five labeled tabs:

```text
Loredecks | Session | Context | Lorecards | Settings
```

Advanced uses seven icon-only tabs:

```text
Loredecks | Session | Continuity | Context | Lorecards | Injection | Settings
```

Route-specific navigation can appear above the bottom bar when a route has
multiple peer workspaces. It must behave as tabs, not as another row of command
buttons.

Experience Mode selection lives at the top of `Settings`, not in the shell rail
or a transient mobile menu. Changing Experience Mode immediately updates the
bottom navigation contract above.

For the MVP, `Lorecards` owns a secondary bottom sub-tab bar. When the main
bottom nav route is `Lorecards`, the sub-tab bar animates out cleanly from the
Lorecards tab area and settles directly above the fixed main bottom bar:

```text
Generate | Automate | Lore
```

The sub-tab bar is route navigation. It is not an in-content `Lorecard Pipeline`
card, not a toolbar, and not a set of command buttons. It should reserve enough
bottom content padding so the active page is never hidden behind either bar.

Primary mobile route responsibilities:

| Route | Mobile Purpose | Default Interaction |
| --- | --- | --- |
| Loredecks | Choose active source decks by touching Loredeck objects | Tap Loredecks in order to activate them. |
| Session | See readiness and move to the next setup/play action | Tap readiness objects for details or next route. |
| Continuity | Advanced continuity tracking and timeline state | Tap timeline or state objects to inspect. |
| Context | Choose current story position | Tap Context rows or anchors directly. |
| Lorecards | Generate, review, and manage durable facts | Use the secondary sub-tab bar; tap Lorecards to select or activate. |
| Injection | Advanced prompt/injection diagnostics | Inspect injection objects and compression state. |
| Settings | Experience Mode, providers, themes, and configuration | Change mode at the top, then configure providers or appearance. |

## Shared Mobile Components

### Object Card

The object card is the core mobile primitive.

Required properties:

- Whole card is tappable.
- Selected state is visually obvious.
- Primary state badge appears near the title or visual anchor.
- Title gets priority over actions.
- Secondary metadata appears as chips.
- Long labels wrap before truncating.
- Actions are not shown permanently unless they are the main purpose of the
  current screen.

### Selected Strip

The selected strip appears when the user has active selections.

Uses:

- Shows count and ordered selected objects.
- Gives access to clear/review/reorder actions.
- Lives above the main bottom nav or above the current object list.
- Should not become a full toolbar.

Example:

```text
3 active   [1 HP Core] [2 Year 6] [3 Custom]   Clear
```

### Contextual Action Tray

The action tray appears only after selection, expansion, or detail open.

Allowed actions:

- One primary action.
- Two to three secondary actions.
- Overflow for rare actions.
- No inspect/edit/detail actions when the same object already opens details
  through tap-hold.

Examples:

```text
Pending selection: Accept | Reject | Clear | ...
Accepted Lorecard: Active | Pinned | Muted | ...
Loredeck detail: In Stack | Health | ...
```

`...` means an overflow or sheet action, not another row of equal text buttons.
Deep editing and examination live in the detail sheet reached by tap-hold.

### Detail Sheet

The detail sheet is the replacement for inline desktop details panels.

Required behavior:

- Opens from tap-hold, selected-object overflow, or keyboard/accessibility
  fallback.
- Can be collapsed, expanded, or closed.
- Owns metadata, health, export, duplicate, delete, repair, and edit actions.
- Does not obscure the list as a permanent inline panel.
- Uses one scroll owner.

Not allowed in normal card browse mode:

- Per-card `Inspect` buttons.
- Per-card `Edit` buttons.
- Per-card `Details` buttons.
- Per-card `i` buttons.
- Inline title rename/edit buttons.

Those affordances are valid inside detail sheets, explicit edit modes, desktop
views, or keyboard/accessibility overflow surfaces.

### Route Sub-Tab Bar

Route sub-tab bars are navigation for peer workspaces inside one main bottom
route. They are not command bars and must not be styled or announced as ordinary
buttons.

Lorecards required sub-tabs:

```text
Generate | Automate | Lore
```

Behavior:

- Appears only while the `Lorecards` main route is active.
- Animates out from the Lorecards bottom-tab area and rests above the main
  bottom nav.
- Uses tab semantics: one tablist, three tabs, one selected tab, and a matching
  tab panel.
- Can show compact count badges, but does not expose command actions.
- Stays visually attached to navigation rather than the page content.
- Disappears cleanly when the user leaves `Lorecards`.

Other route-specific mode controls, such as `Browse | Selected | Reorder` or
`Summary | Issues | Files`, may exist inside a page or sheet when they change a
mode within the current workspace. They should not reuse the Lorecards
route-sub-tab treatment unless they are true route-level peer pages.

## Mobile Loredeck Library Redesign

### Current Problem

The current mobile Library still behaves like the desktop Library:

- The selected details panel overlays the list.
- The active stack appears as another large pane.
- Resize handles and cover layouts are inherited from desktop behavior.
- Users manage an explicit stack instead of directly choosing active Loredecks.

This is the wrong model for mobile.

### New Model

Mobile Library becomes:

```text
Browse folders and Loredecks -> tap Loredecks to activate -> tap order becomes stack order
```

There is no separate active stack pane in the default mobile Library.

### Browse View

Purpose: find and activate source decks.

Visible content:

- Compact Library header with deck count and active count.
- Search/filter row.
- Expandable folder rows.
- Loredeck object cards.
- Selected strip when one or more Loredecks are active.

Default hidden content:

- Details panel.
- Per-card detail affordance buttons.
- Inline title rename/edit buttons.
- Active stack pane.
- Transfer pane.
- Resize handle.
- Desktop drag controls.
- Export/delete/duplicate controls unless a detail or selection mode asks for
  them.

### Folder Behavior

- Tap folder row to open or close it inline.
- Folder row shows total deck count and active deck count.
- Folder expansion preserves scroll position.
- Tap-hold folder row opens folder actions.
- Selecting a folder as a whole is out of MVP unless it can be expressed without
  confusing direct deck selection.

### Loredeck Selection Behavior

- Tap a Loredeck card to toggle it into the active set.
- The first selected Loredeck gets order badge `1`, second gets `2`, and so on.
- The numbered badge appears on the cover tile or top-right corner.
- The selected order is the runtime stack order.
- Tapping a selected Loredeck removes it from the active set.
- Removing a selected Loredeck renumbers the remaining selected Loredecks.
- Selection should write to the same active stack data used by desktop runtime
  behavior. Do not create a mobile-only stack that can drift from desktop.
- Tap-hold a Loredeck card opens the detail sheet without changing active order.
- Normal mobile browse cards must not show `i`, `Details`, `Inspect`, `Edit`,
  or rename affordance buttons.

### Selected Strip Behavior

The selected strip makes tap-order state visible.

Minimum state:

```text
3 active   [1 HP Core] [2 Year 6] [3 Custom]
```

Allowed controls:

- `Clear` to remove all selected Loredecks.
- `Review` or selected-strip tap to open selected order detail.
- `Reorder` only inside the selected order detail or explicit reorder mode.

The selected strip must remain compact. It should not become another active
stack pane.

### Detail Sheet Behavior

- Tap-hold a Loredeck card to open details.
- Accessibility fallback comes from selected-object overflow, keyboard action,
  or the selected strip detail path, not a permanent card-level detail button.
- Detail sheet shows cover, title, type/source chips, active badge, health,
  description, metadata, and advanced actions.
- Health opens Pack Health.
- Metadata/edit/export/duplicate/delete live in the sheet overflow or advanced
  section.
- Closing the sheet returns to the same browse scroll position.

### Reorder Mode

The default order is tap order. Reorder is optional and explicit.

- Enter from selected strip detail or detail sheet.
- Shows only selected Loredecks.
- Drag handles appear only in reorder mode.
- Each selected Loredeck keeps its numbered badge.
- Exiting reorder mode applies the order to the runtime stack.
- Cancel restores order from before entering reorder mode.

### Mobile Library Empty And Loading States

- Empty search result should show filter reset and folder scope.
- No active Loredecks should show direct instruction through object examples,
  not a large command panel.
- Opening the Library should show a visible shell quickly even if deck hydration
  is still running.

## Mobile Lorecards Redesign

### Route Structure

The mobile Lorecards route must use a secondary bottom sub-tab bar above the
main bottom bar:

```text
Generate | Automate | Lore
```

Each sub-tab has one job. `Generate` owns creation/suggestion. `Automate` owns
automation status and controls. `Lore` owns normal card management.

This is a navigation layer, not an in-content control. Do not render a mobile
`Lorecard Pipeline` card as the primary way to switch stages. Do not render
`Pending`, `Approved`, or `Active` as route-level pages or as a row of ordinary
buttons inside the page body. The active sub-tab selects the page, and the page
body starts with the selected workspace's objects.

Sub-tab bar behavior:

- Appears only when the active main bottom route is `Lorecards`.
- Animates up/out from the Lorecards tab area and settles above the fixed bottom
  nav.
- Uses the same SAGA Archive/Saga Hero visual language as the main nav, with a
  lower visual weight than the primary route bar.
- May show compact count badges for each sub-tab.
- Uses accessible tab semantics and exposes the selected tab state.
- Adds enough content inset for the main bottom bar plus the sub-tab bar.
- Leaves the page header and object list free of lifecycle navigation clutter.

Product vocabulary:

- `Lore` is the unified object workspace for pending, accepted, active, pinned,
  muted, and conflicted Lorecards.
- `Generate` is the creation/suggestion workspace.
- `Automate` is the Lore Automation workspace.
- `Pending Review`, `Accepted Lorecards`, `Active`, `Pinned`, and `Muted` are
  states or filters inside `Lore`, not route-level tabs.
- Detail copy can continue to say `Accepted Lorecards` when precision matters.

### Lore Page

Purpose: review and manage all Lorecards in one list.

Entry: selected by the `Lore` sub-tab in the secondary bottom bar.

Interaction:

- Pending and accepted cards appear together in the same list.
- Pending cards expose only `Accept` and `Reject`.
- Accepted cards use state chips, visual treatment, tap-hold, selected tray, or
  detail sheet actions for activate, pin, mute, edit, and history.
- Active cards use a strong accent edge/glow instead of a separate Active Set
  page.
- `Pinned`, `Muted`, `Context`, and `Deck` are compact chips or filters.
- Search and filters remain above the object list.
- Do not show permanent per-card `Inspect`, `Edit`, `Details`, or `i` controls
  in the normal Lore list.
- Do not show `Inspect`, `Pin`, `Mute`, and `Activate` as equal button rows on
  every card. Active, pinned, and muted state should read as object state or
  selected-object controls.

Primary filters:

```text
All | Needs Review | Active | Pinned | Muted | Conflicts
```

### Generate Page

Purpose: create or suggest new Lorecards.

Entry: selected by the `Generate` sub-tab in the secondary bottom bar.

Default screen:

- Current generation source/status.
- Source cards for manual note, story scan, and canon/Loredeck suggestion.
- One contextual primary next action.
- Recent generated proposals route into `Lore` with `Needs Review` visible.

Advanced controls:

- Provider/model controls go into a settings sheet.
- Bulk generation details go into expandable sections.
- Long-running generation shows in-place progress and does not block navigation.

### Lorecard Card Layout

Mobile Lorecard cards must prioritize readability before actions.

Default card:

```text
Title wraps to two lines
State/category chips
Tags
Fact text
Contextual action tray only when selected
```

Rules:

- Title spans the full card width.
- Title wraps to at least two lines before truncating.
- Selected or expanded cards can allow more title lines.
- Card height can grow to fit readable title and essential fact text.
- The card body is the primary inspect/select surface.
- `Inspect` should not be a permanent top-row button.
- `Edit`, `Details`, and `i` should not be permanent top-row or corner
  controls.
- Tier/relevance should be a compact chip or selector, not a large square
  competing with the title.
- Action tray belongs below content or in a selected sheet.

### Lorecard Detail Sheet

The detail sheet owns deep Lorecard editing.

Required sections:

- Title and fact.
- Source/origin.
- Deck and Context gates.
- Tags.
- Pin/mute/active state.
- Edit controls.
- Audit/relevance details when available.

Tap-hold opens this sheet. The visible fallback must be available through the
selected tray, selected-object overflow, keyboard action, or accessibility
surface, not a permanent per-card detail button.

## Applying The Pattern Across Saga

### Session

Session remains summary-first, but rows should become interactable objects where
possible.

Examples:

- Tap provider/readiness row for details.
- Tap active Loredeck summary to open Loredecks.
- Tap Context summary to open Context.
- Tap pending Lorecards summary to open `Pending`.

### Context

Context should use tap-to-choose rows instead of exposing many equivalent
buttons in a browse list.

Examples:

- Tap a timeline anchor/window to choose it.
- Tap-hold opens row details.
- Chips filter or toggle view state.
- `Use Anchor` and `Use Window` can remain visible in detail/edit contexts, but
  the browse list should make row selection feel direct.

### Creator

Deck Maker is a staged process and should keep its current-task focus.

Touch-first additions:

- Stage rail remains compact.
- Current task object is primary.
- Draft/review rows should be tappable.
- Batch actions appear after selection.
- Deep generation settings stay in a sheet or disclosure.

### Pack Health

Pack Health can remain tabbed, but issue rows should be object interactables.

Examples:

- Tap issue row to expand details.
- Tap-hold issue row for repair/copy actions.
- Repair choices appear in selected issue context, not as permanent buttons on
  every row.

### Settings And Advanced Routes

Settings is a direct bottom-nav destination in both Basic and Advanced. It owns
Experience Mode at the top of the page, followed by providers, Theme Packs, and
configuration surfaces.

Advanced-only routes such as Continuity and Injection are direct icon-only
bottom-nav destinations in Advanced mode. They should follow the same
object-first approach as the primary routes rather than being hidden behind a
catch-all menu.

## Button Demotion Inventory

The following mobile-visible controls violate the touch-first model and should
be demoted during implementation.

### Remove From Normal Mobile Cards

- Loredeck Library card `i` detail affordance: replace with card tap-hold plus
  selected strip/detail-sheet fallback.
- Loredeck Library inline title rename/edit affordance: move rename into the
  Loredeck detail sheet or an explicit edit mode.
- Loredeck Library folder-row edit affordances and normal-browse drag handles:
  replace with tap to expand/collapse, tap-hold folder details, and explicit
  reorder/move flows.
- Pending Lorecard selected tray `Edit`: move edit into tap-hold detail sheet
  or selected overflow.
- Accepted Lorecard card `i` detail affordance: replace with card tap-hold plus
  selected-object fallback.
- Active Set `Inspect` buttons: the active-set item itself should open details
  through tap-hold or selected-object overflow.

### Convert Root Detail Buttons Into Interactable Objects

- `Stack Details` on the mobile Loredecks root should become a tappable stack
  summary object or selected strip interaction.
- `Session Details` should become a tappable readiness/session summary object.
- `Context Details` should become a tappable Context summary object.

### Keep As Explicit Commands

These remain valid buttons because they commit state, close a mode, or launch a
distinct tool:

- `Accept`, `Reject`, and destructive/bulk confirmations.
- `Clear`, when it clears a current selection and is not duplicated on every
  object.
- `Done`, `Close`, and explicit mode exits.
- `Import`, `Create`, `Delete`, `Duplicate`, `Export`, and Pack Health repair
  actions when they appear inside a sheet, route, or explicit mode.

Rule of thumb: if the control means "look at this" or "edit this object's
metadata," make the object itself open the detail sheet. If the control means
"commit this change," an explicit button is appropriate.

## State And Data Contracts

### Loredeck Active Order

Mobile Library tap order must update the same active stack state consumed by
runtime retrieval and desktop UI.

Required behavior:

- Add selected Loredeck to the end of active order.
- Remove selected Loredeck from active order.
- Renumber visible badges after every add/remove/reorder.
- Preserve enabled/disabled semantics from desktop stack records where relevant.
- Do not create a second mobile-only order source.

### Loredeck Detail State

Detail sheet state is transient UI state.

- Opening details must not change active order.
- Closing details preserves Library browse scroll position.
- Metadata edits and health actions still write through existing Library/Pack
  Health storage paths.

### Lorecard Selection State

Lorecard list selection is screen-scoped unless it changes durable Lorecard
state.

- Pending selection is transient until accept/reject/edit.
- Accepted active selection changes active runtime state.
- Pin/mute changes durable accepted Lorecard state.
- Detail sheet edits follow existing Lorecard edit/repair paths.

## Visual Rules

- Default screen content is readable objects, not commands.
- A selected object must be visually unmistakable.
- Selection order must be visible when order matters.
- Action trays should be short and mode-specific.
- Avoid nested cards inside cards.
- Avoid desktop resize handles, transfer panes, and drag affordances unless a
  mobile mode explicitly needs them.
- Keep SAGA Archive and Saga Hero visual direction: dark archive surfaces, warm
  gold selection marks, restrained data accents.
- Use stable card dimensions where possible, but allow object cards to grow when
  text needs room.
- Do not shrink important titles into one-word ellipses.

## Accessibility And Discoverability

Touch gestures must be discoverable without explanatory copy filling the app.

Required affordances:

- Selected objects need visible state badges.
- Tap-hold actions need visible fallbacks.
- Detail sheets need close controls.
- Reorder mode needs explicit enter/exit.
- Drag handles appear only in reorder mode.
- Action trays must be keyboard reachable.
- Cards need accessible names that include title and selected state.
- Order badges need screen-reader text, such as `Selected order 2`.

## Implementation Phases

### Phase 1: Contracts And Fixtures

Goal: prevent another desktop-pane translation.

Work:

- Add static checks for the touch-first mobile redesign document.
- Add rendered smoke fixture data with enough Loredecks and long Lorecard titles
  to reproduce live-device failures.
- Add mobile assertions for:
  - no inline Library details panel in normal browse mode;
  - no Library resize handle in normal mobile mode;
  - selected Loredeck order badges;
  - tap order reflected in active stack order;
  - long Lorecard titles wrapping to at least two lines;
  - action trays appearing only after selection.

Done when:

- Static doc contract passes.
- Rendered harness can fail against the current bad Library/details layout and
  long-title Lorecard truncation.

### Phase 2: Mobile Library Browse Selection

Goal: replace the mobile active-stack pane with direct selection.

Work:

- Create a mobile-only Library browse surface.
- Implement folder tap expand/collapse.
- Implement Loredeck tap active toggling.
- Persist selected Loredeck order as stack order.
- Render numbered badges on selected cards.
- Render compact selected strip.
- Remove normal-mode mobile stack pane and resize handle.

Done when:

- Users can activate multiple Loredecks by tapping cards.
- The visible order badges match active stack order.
- Removing a card renumbers the remaining selected cards.
- Normal mobile browse mode does not render desktop stack pane, transfer pane,
  inline details panel, or resize handle.

### Phase 3: Mobile Library Detail And Reorder

Goal: keep advanced Library power without polluting browse mode.

Work:

- Add tap-hold detail sheet behavior with selected strip, overflow, keyboard,
  or accessibility fallback.
- Move metadata, health, export, duplicate, delete, and editor actions into the
  detail sheet.
- Remove permanent mobile card-level `i`, `Details`, `Inspect`, `Edit`, and
  inline rename affordances from normal Library browse.
- Remove normal-browse folder-row edit buttons and drag handles; folder rows
  tap open/closed and tap-hold into folder details/actions.
- Add explicit reorder mode for selected Loredecks.
- Ensure reorder mode is discoverable and exits cleanly.
- Preserve desktop Library behavior outside mobile breakpoints.

Done when:

- Tap-hold opens the detail sheet, and a non-per-card fallback reaches the same
  sheet for accessibility.
- Folder details/editing open through tap-hold/detail sheet rather than a
  visible folder-row edit button.
- Reorder mode shows handles only while active.
- Desktop Library still shows stack/details/resize affordances.

### Phase 4: Lorecards Workspace Flow

Goal: make Lorecards a set of singular-purpose workspaces.

Work:

- Add the animated secondary bottom sub-tab bar for `Lore | Generate |
  Automation`.
- Anchor the sub-tab bar above the fixed main bottom nav and animate it from
  the Lorecards tab area when the Lorecards route becomes active.
- Implement the sub-tab bar with tab semantics, selected state, and optional
  count badges.
- Remove the mobile `Lorecard Pipeline` card or in-content lifecycle button row
  as the primary stage switcher.
- Make each workspace own its page instead of stacking all flows together.
- Convert pending review into a `Needs Review` state inside `Lore`.
- Convert accepted/active management into object selection, visual state, and
  state chips inside `Lore`.
- Preserve existing lifecycle state and data contracts.

Done when:

- The secondary `Generate | Automate | Lore` tab bar appears above the
  main bottom nav only while `Lorecards` is active.
- The transition in and out of the sub-tab bar reads as a clean navigation
  animation, not a page content jump.
- Each mobile Lorecards workspace has one primary purpose.
- The mobile page body does not render a `Lorecard Pipeline` card or equal
  lifecycle button row.
- `Lore` renders pending and accepted/active cards in one list.
- Pending rows expose only `Accept` and `Reject`.
- Accepted management uses object cards, visual state, chips, selected
  affordances, and detail sheets rather than permanent button rows.

### Phase 5: Lorecard Card Redesign

Goal: make Lorecards readable and touch-native.

Work:

- Move title to full-width top line.
- Allow at least two title lines.
- Move actions below content or into selected tray.
- Convert relevance/tier and pin/mute to compact state controls.
- Keep tap-hold detail/edit path plus selected-object or accessibility fallback.
- Remove permanent mobile card-level `Inspect`, `Edit`, `Details`, and `i`
  controls from the normal Lore list.
- Remove separate Active Set object lists on mobile.

Done when:

- Long titles from the live-device screenshots are readable at phone width.
- No permanent action row steals the title line.
- Card height grows cleanly when title text wraps.
- Pending and accepted cards open details through tap-hold or selected fallback,
  not permanent inspect/edit buttons.

### Phase 6: Cross-Route Cleanup

Goal: apply the same interaction model consistently.

Work:

- Audit Session, Context, Continuity, Injection, Settings, Creator, and Pack
  Health for permanent button walls.
- Convert obvious rows/chips into object interactables.
- Convert `Stack Details`, `Session Details`, and `Context Details` buttons
  into tappable summary objects where the route root already has the relevant
  object on screen.
- Keep advanced controls reachable through sheets, details, or selected modes.

Done when:

- The top-level mobile routes follow the same object-first vocabulary.
- Advanced features remain reachable without dominating first viewport.
- Detail navigation is carried by object rows/cards instead of separate
  `Details` buttons when the object is already visible.

## Verification Plan

Static verification:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
```

Rendered verification must include:

- Real phone-width Library browse with folders and multiple selected Loredecks.
- Selected Loredeck order badges after tap sequence.
- Tap selected Loredeck removal and renumbering.
- Detail sheet open and close path.
- No card-level mobile Library `i` detail button or inline title edit affordance
  in normal browse.
- Reorder mode handle visibility only while reorder mode is active.
- Lorecards secondary `Generate | Automate | Lore` sub-tab bar animating
  above the fixed bottom nav.
- Lorecards `Generate`, `Automate`, and `Lore` workspaces.
- No mobile `Lorecard Pipeline` card or in-content lifecycle button row as the
  stage switcher.
- `Lore` renders Pending Review and Accepted/Active cards in one list.
- Pending rows expose only `Accept` and `Reject`.
- Accepted long-title Lorecard wrapping.
- No permanent mobile Lore list `Inspect`, `Edit`, `Details`, or `i`
  card controls.
- No mobile Active Set object list or `Inspect` button rows.
- No horizontal overflow at `360px`, `390px`, and `430px`.
- Tablet/desktop sanity pass proving desktop Library stack/details behavior
  remains available outside mobile breakpoint.

Suggested harness additions:

- `mobile-library-touch-harness`
- `mobile-lorecards-touch-harness`
- Live-device screenshot review checklist for Library and long-title Lorecards.

## Acceptance Criteria

The redesign is successful when:

- Mobile Library no longer renders the desktop active stack pane as the primary
  mobile stack-management surface.
- Mobile Library selected Loredecks show numbered order badges.
- Tap order determines active stack order on mobile.
- Library details open through object detail sheet behavior, not as an inline
  overlaying panel.
- Normal mobile Library cards do not expose per-card detail or rename buttons.
- Mobile normal browse mode does not render desktop resize handles.
- Desktop Library stack, transfer, details, resize, and drag behavior remain
  available outside mobile breakpoints.
- Lorecards mobile exposes `Lore`, `Generate`, and `Automation` as a
  secondary sub-tab bar above the fixed bottom nav while `Lorecards` is active.
- Lorecards mobile uses singular-purpose `Lore`, `Generate`, and `Automation`
  workspaces.
- Lorecards mobile does not use a page-body `Lorecard Pipeline` card or a row of
  equal stage buttons as the main stage switcher.
- `Lore` combines Pending Review and Accepted Lorecards into one object list.
- Active cards are visually indicated in that list instead of moved to a
  separate Active Set list.
- Lorecard titles are readable on phone widths and wrap to at least two lines.
- Lorecard action trays appear from selection or detail context instead of
  permanently crowding the title row.
- Pending and accepted Lorecard details/editing open through tap-hold,
  selected-object overflow, or accessibility fallback, not permanent per-card
  inspect/edit/detail buttons.
- Separate mobile Active Set cards do not appear in the normal route.
- `Stack Details`, `Session Details`, and `Context Details` are represented by
  tappable summary objects instead of standalone root buttons where feasible.
- Tap-hold paths have visible accessible alternatives.
- Rendered smoke screenshots show object-first surfaces rather than toolbar rows
  and desktop panes.
- The UI still reads as SAGA Archive and Saga Hero, not a generic mobile shell.

## Anti-Patterns

Avoid these during implementation:

- Moving desktop buttons into a bottom sheet without changing the interaction
  model.
- Keeping the active stack pane below the Library list on mobile.
- Showing drag handles when the user is not reordering.
- Letting detail panels permanently overlay browse content.
- Using tap-hold as the only way to inspect or edit.
- Replacing the Lorecards secondary sub-tab bar with an in-content pipeline card
  or a row of command buttons.
- Showing `Inspect`, `Pin`, `Mute`, and `Activate` as equal permanent buttons
  across every Lorecard row.
- Truncating Lorecard titles to one word at phone width.
- Creating mobile-only active stack state that can drift from desktop state.

## Open Questions

These should be resolved during implementation, not left to ad hoc UI choices:

- Should the selected strip live above the list or fixed above the bottom nav?
- Should Library detail sheet be half-height first, then expandable, or full
  screen immediately?
- Should `Lore` include an explicit `Select Active` mode, or should tapping
  always toggle active state?
- Should folder-level selection be part of the MVP or deferred?
- Which mobile routes need swipe actions, if any?

## Non-Goals

- Removing desktop stack management.
- Removing advanced Library operations.
- Making tap-hold the only access path for details or editing.
- Replacing the fixed bottom bar.
- Reordering the main mobile tabs.
- Re-skinning Saga away from SAGA Archive and Saga Hero.
