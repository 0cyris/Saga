# Saga Mobile UX Revision Feature

## Purpose

This feature follows the initial mobile support build. The first pass proved the
foundation: phone shell, fixed bottom bar, More route, mobile subviews, touch
targets, SAGA Archive theme, Saga Hero icons, and rendered smoke coverage.

The revision goal is different. Mobile should now feel less like dense desktop
panels adapted to a phone and more like a purpose-built operator surface. The
core shell stays. The next pass should refine the first screens, object flows,
and visual hierarchy.

The next redesign layer is documented in
`SAGA_MOBILE_TOUCH_INTERACTION_REDESIGN.md`. Use it for mobile work that replaces
desktop panes, visible button rows, and explicit stack controls with direct
touch selection, tap order, tap-hold details, contextual trays, and segmented
single-purpose pages.

The parallel agent plan is no longer the active development model for this
phase. Continue this feature in one coordinated thread unless the user explicitly
asks to split the work again.

## Current Baseline

Already achieved:

- Fixed bottom bar using the desktop tab order:

```text
Loredecks | divider | Session | Context | Lorecards | More
```

- Mobile shell class, full-viewport page model, safe-area header, fixed bottom
  navigation, More sheet, and subview stack primitives.
- SAGA Archive and Saga Hero visual direction: dark archive surfaces, warm gold
  trim, black cherry shell treatment, restrained data accents, and icon-led
  navigation.
- Mobile Lorecards route labels:

```text
Generation | Pending | Approved
```

Desktop and detail copy can still use precise product language such as
`Pending Review`, `Accepted Lorecards`, and active state when explaining what a
card will do. Mobile navigation should not expose `Active Set` as a fourth
stage.

- Visual smoke coverage for `360x740`, `390x844`, `430x820`, and `768x1024`
  targets.
- Saved rendered evidence under:

```text
assets/documentation/renders/saga-smoke/
```

The current MVP passes contract checks, but the review found that several first
screens still feel too toolbar-heavy or too far removed from the object the user
is trying to act on.

## Revision Principles

### Keep The Foundation

Do not reopen the mobile shell architecture unless a defect proves it necessary.
The bottom bar order, More route, Saga Hero icon treatment, safe-area behavior,
and desktop/tablet breakpoint contracts should remain stable.

### Make Mobile Object-First

The first visible content on a phone should be the thing the user can inspect,
move, activate, fix, or continue. Summary chips and route controls are useful,
but they should not push the working object below the fold.

### Prefer Dynamic Interactables

Buttons remain valid, but mobile should lean on:

- Tappable object cards.
- Compact segmented rails.
- Inline action trays that appear when an object is selected.
- Contextual next actions.
- Progressive disclosure for deep workbench tools.

### Preserve Product Vocabulary

Do not invent mobile-only names for Saga concepts. Keep `Loredecks`, `Session`,
`Context`, `Lorecards`, and `More` for the main routes. For mobile Lorecards,
use the secondary sub-tabs `Generation`, `Pending`, and `Approved`; use
`Pending Review`, `Accepted Lorecards`, and active-state language only inside
details, object chips, helper copy, or desktop/advanced contexts where that
precision matters.

### Treat Screenshots As Product Evidence

The revision is not done until the rendered smoke screenshots show the intended
hierarchy. Static assertions protect contracts, but the visual pass decides
whether the mobile screen actually reads correctly.

## Findings To Address

### 1. Approved Objects Start Below The Fold

In the current advanced mobile Lorecards screenshot, the selected active state
is visible, but the actual active and available Lorecard objects begin below
the first viewport. The mobile pipeline card is the wrong
navigation model: it keeps lifecycle switching inside the page body instead of
making `Generation`, `Pending`, and `Approved` feel like route-level sub-tabs.

Revision target:

- Replace the in-content mobile pipeline with a secondary `Generation | Pending
  | Approved` sub-tab bar that animates out above the fixed bottom nav when the
  main `Lorecards` tab is active.
- Keep counts visible as compact sub-tab badges when useful.
- Put the selected stage's object list in the first viewport.
- When `Approved` is selected, active/available Lorecard cards should be visible
  without scrolling past a lifecycle navigation card.
- Do not render the mobile lifecycle as a page-body button row.

### 2. Loredecks Root Still Reads As A Button Row

The Loredecks root does the right job, but it presents `Open Loredeck Library`,
`Import Deck`, `Stack Details`, and `Create Deck` as a row of text buttons. That
works mechanically, but it feels closer to desktop toolbar translation than a
mobile operator surface.

Revision target:

- Convert the root into a stack object summary.
- Expose one primary next action.
- Move secondary actions into icon-led controls or a compact action menu.
- Keep `Open Loredeck Library`, `Import Deck`, `Create Deck`, and stack details
  reachable, but avoid making four equal text buttons the first interaction.

### 3. More Route Has Redundant More Controls

The More sheet currently shows Back, header More, Close, active bottom More, and
the More route contents. This is not broken, but it feels redundant.

Revision target:

- When the user is on the More index, hide or disable the header More action.
- When the user is inside a More subroute, let the header More action return to
  the More index only if that is clearer than Back.
- Keep Close reachable.
- Keep the bottom More tab active for orientation.

### 4. Bottom Bar Labels Are Functional But Tight

The bottom bar icons look on-theme. The inactive text labels are small at phone
widths, especially on 360px screens.

Revision target:

- Preserve five slots and the divider.
- Keep every tab name readable at 360px without truncating the core labels.
- Prefer a modest label-size or active-label emphasis change over increasing the
  bar height dramatically.
- Do not remove labels entirely; Saga's concepts are too broad for unlabeled
  icons in the MVP.

### 5. Heavy Workbenches Still Expose Desktop Density

Pack Health, Creator, Library details, and Injection are usable, but some
surfaces still open with dense top bars or large control clusters before the
main task.

Revision target:

- Keep full-screen mobile shells for heavy workbenches.
- Prefer sticky compact headers and one primary task area.
- Let tabs or filters scroll horizontally when needed instead of compressing
  into unreadable labels.
- Move infrequent controls into overflow menus where that does not hide the
  next expected action.
- For Creator, prioritize the `Current Task` card above the stage roadmap on
  phones, then downgrade the roadmap to a compact horizontal rail.

## Feature Scope

### Phase 1: Revision Contracts

Goal: encode the revised UX targets before touching behavior.

Work:

- Add static checks for the new mobile revision document.
- Update visual smoke wording away from Agent 1/2/3 ownership.
- Add rendered-review checklist items for object-first Approved cards, Loredecks
  primary-action reduction, More header deduplication, and bottom label
  readability.

Done when:

- `node tools/scripts/test-visual-smoke-harness.mjs` passes.
- The runbook and feature doc name the same revision targets.

### Phase 2: Lorecards Object-First Revision

Goal: make the lifecycle feel like route-level sub-tabs plus object workflow,
not a control card.

Work:

- Add the animated secondary `Generation | Pending | Approved` sub-tab bar
  above the fixed main bottom nav while `Lorecards` is active.
- Remove the mobile `Lorecard Pipeline` card and any in-content lifecycle
  button row as the primary stage switcher.
- Render selected-stage objects immediately after the section header on mobile
  subviews.
- Ensure `Approved` shows active/available cards in the first viewport.
- Preserve object-level actions: inspect, activate, mute, pin, and unpin.

Done when:

- The `430x820` Advanced Lorecards screenshot shows the secondary sub-tab bar
  above the main bottom nav and object cards before the first viewport ends.
- Pending Review still supports selection and batch action drawer behavior.
- Accepted Lorecards and active-state filters still work.

### Phase 3: Loredecks Root Revision

Goal: make Loredecks feel like a stack console, not a toolbar.

Work:

- Rework the mobile root summary into an active-stack object card.
- Promote only the next useful action as the primary text button.
- Move import/create/details/library secondary actions into compact icon-led
  controls or an action menu.
- Keep walkthrough and tour targets resolvable for the same named actions.

Done when:

- The first Loredecks mobile viewport presents one dominant action and a clear
  active-stack object summary.
- Library, Import Deck, Create Deck, and Stack Details remain reachable.
- The `390x844` Basic and `430x820` Advanced smoke paths still pass.

### Phase 4: Shell Polish

Goal: remove small UX frictions without destabilizing the route system.

Work:

- Deduplicate the More header action on the More index.
- Improve bottom label readability at 360px and 390px.
- Verify header status pills do not crowd route titles on narrow screens.
- Preserve the bottom bar divider and active route styling.

Done when:

- The More screenshot no longer shows a redundant active More action in the
  header.
- Bottom labels remain readable in saved renders at 360px and 430px.
- No horizontal overflow appears in mobile smoke output.

### Phase 5: Heavy Workbench Polish

Goal: make advanced surfaces feel acceptable on phone widths without pretending
they are fully redesigned mobile apps.

Work:

- Audit Pack Health, Creator, Library details, and Injection screenshots.
- Reduce top-heavy toolbars where a single primary action is enough.
- Keep deep controls reachable through tabs, menus, or subviews.
- Do not remove power-user controls from desktop.

Done when:

- Saved mobile screenshots show the main task area above the fold for each
  heavy workbench where feasible.
- The Creator mobile screenshot shows `Current Task` before the stage roadmap,
  and the roadmap renders as a compact horizontal rail rather than eight
  stacked stage cards.
- The tablet desktop-shell sanity check still passes at `768x1024`.

## Acceptance Criteria

The revision is complete when:

- Existing mobile MVP acceptance criteria still pass.
- `Lorecards` exposes `Generation`, `Pending`, and `Approved` through a
  secondary sub-tab bar above the fixed bottom nav while the main `Lorecards`
  tab is active.
- `Approved` opens with active or available Lorecard objects in the first
  viewport.
- The selected Lorecards sub-tab owns the visual hierarchy on mobile.
- `Loredecks` root uses one dominant next action rather than a row of equal
  primary buttons.
- `More` index has no redundant header More action.
- Bottom bar labels remain readable at `360px`, `390px`, and `430px`.
- Heavy workbenches preserve reachability while reducing first-viewport toolbar
  density.
- Creator mobile opens with the current task before the stage roadmap, while
  keeping stage navigation reachable as a compact rail.
- The visual direction still reads as SAGA Archive and Saga Hero: hybrid
  mythic-tech, not fandom-specific fantasy, generic sci-fi, generic SaaS, or
  pure cyberpunk.
- Desktop shell behavior remains unchanged outside the mobile breakpoint.

## Verification Plan

Run the static gate after each meaningful source or CSS pass:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
```

Run the full alpha gate after completing an implementation phase:

```powershell
node tools\scripts\run-alpha-gate.mjs
```

Refresh rendered mobile evidence after visual/layout changes:

```powershell
$env:SAGA_SMOKE_TARGET='mobile-advanced-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='430'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='820'
$env:SAGA_SMOKE_NATIVE_WS='1'
$env:SAGA_SMOKE_HEADLESS='0'
node tools\scripts\smoke-live-st-cdp.mjs
```

Also rerun the Basic phone targets and tablet sanity target before signoff:

```powershell
$env:SAGA_SMOKE_TARGET='guide-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='390'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='844'
$env:SAGA_SMOKE_NATIVE_WS='1'
$env:SAGA_SMOKE_HEADLESS='0'
node tools\scripts\smoke-live-st-cdp.mjs

$env:SAGA_SMOKE_TARGET='context-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='360'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='740'
$env:SAGA_SMOKE_NATIVE_WS='1'
$env:SAGA_SMOKE_HEADLESS='0'
node tools\scripts\smoke-live-st-cdp.mjs

$env:SAGA_SMOKE_TARGET='tablet-advanced-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='768'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='1024'
$env:SAGA_SMOKE_NATIVE_WS='1'
$env:SAGA_SMOKE_HEADLESS='0'
node tools\scripts\smoke-live-st-cdp.mjs
```

## Non-Goals

- Replacing the fixed bottom bar.
- Reordering mobile tabs.
- Reintroducing the agent-parallelization workflow.
- Full redesign of every Advanced workflow.
- Native mobile app behavior.
- Fandom-specific visual skinning.
