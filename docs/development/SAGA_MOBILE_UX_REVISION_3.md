# Saga Mobile UX Revision 3

## Purpose

Revision 1 proved the mobile shell. Revision 2 moved Saga toward object-first
touch interactions. Revision 3 addresses the remaining mobile architecture
problem: the UI still carries too much desktop chrome, nested scrolling, hover
behavior, and top-weighted action placement into a phone experience.

The goal is to make the mobile shell feel like a native touch workflow:

- bottom navigation owns route movement;
- bottom action areas own persistent commands;
- each route has one primary scroll surface;
- top chrome is minimal or absent;
- hover tooltips are removed from mobile navigation;
- workbenches and overlays stop behaving like compressed desktop windows.

This document should guide the next implementation pass after
`SAGA_MOBILE_TOUCH_INTERACTION_REDESIGN.md`.

## Problem Statement

### Mobile Tooltips Are Broken UX

Current mobile tab and sub-tab tooltips flicker during route changes and can
appear at the upper-left corner of the window. Even when positioned correctly,
tooltips attached to bottom navigation and sub-tabs obscure the content the user
is trying to operate on.

Mobile navigation should not rely on hover tooltips.

### Nested Scrolling Is Breaking Touch Flow

Several mobile routes still contain scrollable lists inside scrollable pages.
The Lorecards `Approved` page is the most obvious case, but the same problem can
appear anywhere a desktop panel, workbench, or list region is embedded unchanged
inside the mobile shell.

Nested scroll regions make touch movement unpredictable. Users should not have
to discover which pane owns the gesture.

### Sub-Tab Pages Do Not Use Available Height

Lorecards sub-pages such as `Generation`, `Automation`, `Pending`, and
`Approved` currently read like embedded panels. Lists stop short even when there
is empty vertical space available. A selected sub-tab should behave like a real
page that owns the available mobile viewport between persistent shell controls.

### The Top Navbar Wastes Space

The mobile top bar repeats the active route title even though the bottom bar
already communicates the current section. It also duplicates Settings access now
that Settings is a direct bottom-nav route. On a phone, that top chrome costs
too much.

The only essential function currently living there is closing/exiting the Saga
runtime window.

### Persistent Commands Are Too Top-Heavy

Library, workbenches, and overlays still put many persistent commands at the
top. This conflicts with the rest of the mobile model, where route navigation
and primary thumb-zone controls live at the bottom.

If a command persists for the whole view, such as `Done`, `Close`, primary
commit, or current-mode actions, it should usually live in a bottom action area.
Top actions should be rare and local.

## Revision 3 Hard UX Contract

Revision 3 is not a visual polish pass. It is a mobile interaction contract.
Implementation should be rejected if it preserves the desktop structure and only
tries to make it narrower.

### Navigation Is Not A Toolbar

Mobile bottom tabs and Lorecards sub-tabs are navigation surfaces. They should
select a destination, not expose a row of command buttons.

Do:

- make the selected bottom tab and selected sub-tab communicate place;
- let the active page expose one clear primary workflow;
- use selected-object trays, bottom sheets, and long-press detail views for
  object operations.

Do not:

- attach hover/floating tooltips to mobile navigation;
- add adjacent `Edit`, `Inspect`, `Open`, or `Details` buttons when tap-hold can
  own the detail path;
- turn `Generation | Automation | Pending | Approved` into command buttons;
- duplicate the active route title in a top navbar.

### Content Starts The Page

The first useful pixels after browser chrome should be route content, not a
desktop-style title bar plus duplicated route controls.

The current bottom tab already tells the user where they are. The page content
should then show the current object, list, work queue, or selected state.

### Persistent Actions Live In The Thumb Zone

Persistent commands belong to the lowest persistent layer that makes sense:

- route navigation in the fixed bottom nav;
- route sub-navigation in a contextual sub-tab rail above the bottom nav;
- persistent page actions in a bottom action bar or bottom sheet;
- selected-object actions in a selected tray;
- local object edits inside long-press detail sheets.

If a command remains available across the whole mobile page, placing it in the
top toolbar is a design smell unless there is no practical bottom placement.

### One Gesture Should Own The Page

A mobile route should have one main vertical scroll gesture. When a user swipes
the page, the whole page should move predictably.

Nested scroll regions are only acceptable for:

- modal bottom sheets while the background page is inert;
- text editing fields while the user is editing text;
- deliberately bounded inspectors that are visually and behaviorally modal.

Desktop list boxes, embedded workbench panes, and max-height table regions do
not qualify.

### Exit Is A Shell Action

Closing Saga should remain reachable, but it should not justify keeping a full
top navbar. The exit path should be a shell-level action that fits the mobile
model, such as:

- a compact affordance attached to the active bottom route state;
- an active bottom tab that morphs into `Exit`;
- a bottom action affordance when the runtime is in a modal or overlay state.

The final design can choose the exact pattern during implementation, but it
must not reintroduce the redundant top bar just to preserve `Close`.

## Revision 3 Principles

### No Hover Tooltips On Mobile Navigation

Disable tooltip behavior for:

- bottom navigation tabs;
- Lorecards `Generation | Automation | Pending | Approved` sub-tabs;
- direct Settings, Continuity, and Injection mobile route tabs;
- persistent bottom action bars.

Accessible labels can remain in markup. Visual hover/floating tooltips should
not appear for these mobile controls.

### One Scroll Owner Per Mobile Page

Every mobile route or sub-route should have one primary scroll container.

Allowed:

- the route page scrolls;
- a modal bottom sheet scrolls while the page behind it is inert;
- an editor textarea scrolls inside an active text editing context.

Not allowed:

- route body scroll plus inner list scroll;
- page scroll plus workbench table scroll;
- sub-tab page scroll plus nested accepted/pending list scroll;
- hidden desktop max-height rules that keep lists short on mobile.

### Sub-Tabs Are Pages, Not Panels

`Generation`, `Automation`, `Pending`, and `Approved` should each occupy the
available mobile page space. The active sub-tab content should expand naturally
down to the bottom sub-tab bar and bottom nav boundary.

The selected sub-tab should not render as a short desktop list region inside a
larger scroll page.

### Minimize Or Remove Top Chrome

The mobile top navbar should be treated as expendable. It should not repeat the
current route title, and it should not duplicate Settings or route navigation.

The close/exit function must remain reachable. Candidate patterns:

- morph the active bottom tab into an exit affordance after a second tap or
  long-press;
- reserve a compact bottom action affordance for exit in the current route;
- expose exit through a minimal floating corner affordance only when the shell
  has no better bottom placement.

The chosen pattern must be obvious enough for first-use and must not compete
with normal route switching.

### Persistent Actions Belong Near The Bottom

For mobile views, persistent actions should move from top bars to bottom action
areas where possible.

Examples:

- Library `Done` should be bottom-owned.
- Workbench `Close`, `Done`, or commit actions should be bottom-owned.
- Overlay-level `Refresh`, `Import`, `Create`, or mode actions should become
  bottom sheet actions, overflow actions, or context-specific selected-object
  actions.

Top controls should be reserved for local object identity, status, and rare
escape hatches.

## Route-Level Targets

### Runtime Shell

Target:

- Remove visual tooltips from mobile bottom tabs.
- Remove or collapse the mobile top navbar.
- Preserve close/exit through a bottom-oriented or clearly discoverable compact
  interaction.
- Keep route names and active state clear in the bottom bar.
- Ensure safe-area behavior still works on phone browsers.

Revision 3 MVP decision:

- remove the mobile top navbar entirely;
- show a bottom-oriented shell `Back` action only when the current mobile state
  can actually go back;
- morph the active bottom tab into `Exit` as the explicit runtime close path;
- keep Settings as a normal bottom-nav route rather than an overflow entry.

### Lorecards

Target:

- Remove visual tooltips from `Generation | Automation | Pending | Approved`.
- Make each sub-tab a full-height page.
- Remove nested scroll regions from Pending and Approved lists.
- Let Pending and Approved cards flow in the primary route scroll.
- Keep selected-object trays and bottom action bars fixed or sticky only if
  they do not introduce a second list scroll.
- Ensure long Approved titles remain readable without an internal list box.

Acceptance direction:

- The page body scrolls once.
- The active sub-tab list extends to the available viewport.
- No accepted/pending list has an independent max-height scroll in mobile mode.

### Loredeck Library

Target:

- Treat the Library as a mobile route-like overlay with one primary scroll area.
- Move persistent commands such as `Done` toward the bottom.
- Keep folder open/close, Loredeck tap selection, selected strip, reorder, and
  tap-hold detail behavior.
- Avoid returning to top-heavy toolbar rows as the Library gains more features.

Potential bottom action model:

- bottom selected strip for active Loredeck order;
- bottom action bar for `Done`, `Import`, `Refresh`, and overflow;
- detail sheets own their local edit/health/export actions.

### Workbenches And Heavy Overlays

Target:

- Audit Deck Maker, Context Workbench, Pack Health, Injection diagnostics, Settings,
  and any generated editor surfaces for nested scroll regions.
- Keep only one primary scroll owner per mobile workbench.
- Move overlay-level close/commit actions to the bottom where practical.
- Keep local detail/edit controls inside object detail sheets or local sections.

Heavy workbenches can still be dense, but their first mobile viewport should not
feel like a desktop header plus a trapped scroll box.

### Settings And Advanced Routes

Target:

- Remove mobile tooltip behavior from direct route tabs.
- Keep Settings as the home for Experience Mode, providers, Theme Packs, and
  configuration.
- Keep Continuity and Injection as direct icon-only Advanced routes.
- Do not duplicate Settings or route navigation in top chrome.

## Implementation Phases

### Phase 1: Tooltip Suppression

Goal: remove mobile navigation tooltip flicker and content obstruction.

Work:

- Disable floating tooltip listeners for mobile bottom tabs.
- Disable floating tooltip listeners for Lorecards sub-tabs.
- Disable floating tooltip listeners for direct Settings, Continuity, and
  Injection route tabs.
- Preserve accessible labels where needed.
- Add a smoke/static check that route changes do not create a visible floating
  tooltip.

Done when:

- Changing tabs and sub-tabs does not show a tooltip.
- No tooltip appears in the upper-left corner during mobile route changes.
- Mobile navigation remains accessible by label/name.

### Phase 2: One-Scroll Lorecards

Goal: make Lorecards sub-tabs real mobile pages.

Work:

- Remove mobile max-height and overflow rules from nested Pending and Approved
  list regions.
- Let active sub-tab content fill available space.
- Confirm `Generation`, `Automation`, `Pending`, and `Approved` each use the
  route page as the scroll owner.
- Keep bottom sub-tabs and bottom nav fixed without trapping list scroll.

Done when:

- Lorecards pages have a single scroll gesture.
- Approved and Pending lists extend into available vertical space.
- No nested list scroll appears in the phone smoke screenshots.

### Phase 3: Top Chrome Reduction

Goal: reclaim vertical space and remove duplicated navigation.

Work:

- Remove repeated route title from the mobile top navbar.
- Remove Settings and route duplication from the top navbar.
- Design and implement the replacement close/exit path.
- Preserve safe-area behavior and route context.

Done when:

- The mobile first viewport gains usable vertical space.
- The user can still close the Saga runtime window.
- Route identity remains clear from the bottom nav and current page content.

### Phase 4: Bottom-Owned Persistent Actions

Goal: align overlays and workbenches with bottom-first mobile control placement.

Work:

- Audit Library, Deck Maker, Context Workbench, Pack Health, Settings, Injection,
  and other heavy surfaces for top toolbar commands.
- Move persistent commands such as `Done`, `Close`, and commit actions into
  bottom action areas where practical.
- Specifically move Pack Health `Refresh Scan`/`Export Report`/`Close`, Creator
  `Project Settings`/`Close`, Context Workbench `Refresh Index`/`Done`, and
  Context Proposal Review `Apply All`/`Dismiss All`/`Close` out of top action
  rows.
- Convert remaining top actions into local object actions, overflow actions, or
  selected-object trays.
- Keep destructive actions behind confirmation.

Done when:

- Persistent mobile commands are reachable near the bottom.
- Top bars no longer dominate the first viewport.
- Heavy overlays still expose required commands without desktop-style toolbar
  rows.
- Mobile Context Workbench tabs keep accessible labels without floating tab
  tooltips.

### Phase 5: Global Nested-Scroll Audit

Goal: prevent this issue from recurring outside Lorecards.

Work:

- Add a mobile smoke/assertion pass that detects nested scroll regions inside
  route pages.
- Review mobile CSS for `max-height`, `overflow: auto`, and `overflow-y: auto`
  under route/list/workbench selectors.
- Exempt only true modal sheets and text editing controls.
- Capture screenshots for Library, Lorecards, Deck Maker, Context, Pack Health,
  and Settings.

Done when:

- Known mobile routes have one primary scroll owner.
- Any intentional nested scroll has a documented reason.
- Smoke output reports no unexpected nested scroll regions.

## Acceptance Criteria

- Mobile bottom tabs and Lorecards sub-tabs do not show visual tooltips.
- No route change causes a tooltip flicker in the upper-left corner.
- Lorecards `Generation`, `Automation`, `Pending`, and `Approved` each occupy
  the available mobile route space.
- Pending and Approved lists do not use nested scroll boxes on mobile.
- Mobile routes and major overlays have one primary scroll owner, except for
  modal sheets and text editing controls.
- The mobile top navbar is removed, collapsed, or reduced enough that it no
  longer repeats route title or Settings/route access.
- Saga runtime exit remains clear and reachable.
- Library and heavy workbenches move persistent commands toward bottom action
  areas.
- Pack Health, Deck Maker, Context Workbench, and Context Proposal Review expose
  persistent mobile actions from bottom action bars, not header action rows.
- Desktop behavior remains unchanged outside the mobile breakpoint.
- Rendered phone screenshots show more working content in the first viewport
  than the current header-heavy layout.

## Verification Plan

Required checks:

```powershell
node tools/scripts/test-visual-smoke-harness.mjs

$env:SAGA_SMOKE_TARGET='mobile-redesign-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='360'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='740'
node tools/scripts/smoke-live-st-cdp.mjs

$env:SAGA_SMOKE_TARGET='mobile-advanced-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='430'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='820'
node tools/scripts/smoke-live-st-cdp.mjs

$env:SAGA_SMOKE_TARGET='guide-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='390'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='844'
node tools/scripts/smoke-live-st-cdp.mjs
```

Add or extend smoke assertions for:

- no visible floating tooltip after route or sub-tab changes;
- no unexpected nested scroll owners in mobile route pages;
- Lorecards sub-page list height reaches available route space;
- top navbar removal or reduction;
- close/exit reachability;
- bottom action placement for Library, Pack Health, Deck Maker, Context Workbench,
  and Context Proposal Review.

## Non-Goals

- Reordering the main mobile tabs.
- Replacing the SAGA Archive / Saga Hero visual direction.
- Removing desktop tooltips from desktop pointer contexts.
- Removing all buttons from mobile.
- Building native mobile app behavior outside the web extension shell.
- Perfecting every Advanced workbench in one pass before the shell/layout
  contract is fixed.
