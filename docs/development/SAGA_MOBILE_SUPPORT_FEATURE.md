# Saga Mobile Support Feature

## Status

Planning document for adding first-class mobile support to Saga's runtime UI.

Saga is still pre-alpha, so this plan does not preserve old layout behavior for compatibility. The implementation should update the shell, layout state, and affected panel contracts in place where that produces a cleaner mobile foundation.

## Purpose

Saga currently has narrow-responsive pieces, but the product is not mobile-supported. The main blocker is the runtime shell: the desktop rail and side drawer model does not fit phone portrait widths, and several dense panels assume desktop workbench space.

The mobile feature should introduce a phone-first runtime shell built around a fixed bottom bar. The goal is a usable MVP on common phone portrait sizes without attempting a full mobile redesign of every advanced workflow.

## Product Goal

A user on a phone should be able to:

1. Open Saga.
2. Reach the core runtime tabs.
3. Load or inspect Loredecks.
4. Set or review Context.
5. Review Lorecards.
6. Inspect important status and settings.
7. Close, go back, and recover from every screen without relying on desktop hover, drag, or resize behavior.

The MVP should preserve Saga's current vocabulary and visible tab labels. It should change the interaction shape, not rename core concepts.

## Target Viewports

Mobile MVP targets:

- `360px` wide narrow phone portrait.
- `390px` wide common phone portrait.
- `430px` wide large phone portrait.
- `768px` wide tablet sanity.

Landscape phone optimization is out of scope for the MVP. Tablet may continue using the desktop shell if it fits cleanly, but the implementation should verify that tablet widths do not inherit phone-only compromises.

## Design Principle

The mobile UI should not be a shrunken desktop drawer. It should use a different shell:

```text
Compact Header
Active tab title, status, back/close, overflow menu

Main Content
One active tab or subview, full width, one primary vertical scroll

Fixed Bottom Bar
Primary navigation
```

Desktop:

```text
Rail + side drawer + resize/drag affordances
```

Mobile:

```text
Bottom nav + full-width active page + staged subviews
```

## Mobile Simplification Strategy

Saga is extensive. Mobile should not attempt to expose the full desktop workbench at once. The mobile experience should function as an operator console: it surfaces readiness, the current task, and focused actions. Desktop remains the deep workbench for broad authoring, diagnostics, and tuning.

### Core Rule

Each primary mobile tab should answer one question:

| Tab | Mobile Question |
| --- | --- |
| Loredecks | What lore is loaded? |
| Session | Is Saga ready, and what should I do next? |
| Context | Where are we in the story? |
| Lorecards | What facts should affect future responses? |
| Settings | Which experience mode, provider, and appearance settings are active? |
| Continuity | Advanced only: what continuity state needs attention? |
| Injection | Advanced only: what prompt/injection state needs attention? |

If a mobile screen cannot be summarized by one question, it should be split into subviews.

### Summary First

Mobile screens should start with the current state and the next useful action. Details, diagnostics, and batch tools move behind rows, sheets, menus, or Advanced-only subviews.

Example Loredecks first screen:

```text
Active Stack summary
Current readiness
Primary action: Open Library
Recent or important deck cards
```

The full Library, deck details, health diagnostics, import/export, and Creator tools remain reachable. They should not all compete on the first screen.

### Progressive Disclosure

Use disclosure as the simplification mechanism:

- Basic shows the smallest useful set of choices.
- Advanced exposes more direct bottom-nav routes, overflow menus, and subviews.
- Both modes keep the same vocabulary and core labels.
- Deep controls remain reachable, but the first mobile screen should prioritize the next task.

Do not simplify by renaming Saga concepts into parallel mobile-only concepts. Users should not have to relearn the product when moving between mobile and desktop.

### Action Promotion

Mobile should promote actions over dense control clusters.

Prefer:

- Set Context
- Review Lorecards
- Open Library
- Scan Recent Story
- Inspect Injection

Avoid placing tuning controls, diagnostics, and repair machinery beside the primary action unless they are needed to complete the current task.

### Hard UX Constraints

- No mobile screen should require side-by-side panes.
- No critical action should depend on hover, drag, or resize.
- No first mobile screen should expose every advanced control.
- Every advanced capability should still be reachable.
- Exact existing control labels should be preserved where the user already knows them, especially Context controls such as `Start Here`, `Use Window`, `Use Anchor`, `After`, `Before`, `Timeline`, and `Phrase Resolver`.

## Mobile Visual Identity

The mobile UI should use Saga's own visual language, not a fandom-specific fantasy theme and not a generic sci-fi dashboard. The target aesthetic is hybrid mythic-tech: heroic illustrated emblems, dark operational surfaces, warm gold linework, and selective data accents.

### Theme And Icon Sources

Mobile should start from the bundled runtime appearance:

- Theme Pack: `SAGA Archive` (`saga-default`).
- Icon Set: `Saga Hero` (`saga-hero`).
- Icon mapping source: `TAB_ICON_PATHS` and the bundled `saga-hero` icon set.

The `SAGA Archive` palette provides the dark shell, warm trim, and readable text. The `Saga Hero` icon set provides the visual personality: fuller illustrated tab emblems with glowing gold artifact shapes.

### Aesthetic Target

Use:

- Dark carbon, black cherry, and deep graphite panels.
- Antique gold and amber linework for active states, icon outlines, key dividers, and high-signal borders.
- Parchment-cream text for readability, not parchment-scroll surfaces.
- Small teal or cyan data accents for live status, route signals, scan progress, and active telemetry.
- Compact heroic emblems for tabs and important state objects.
- Thin luminous borders, grid traces, data rails, and restrained glow.
- Modest card radius, generally `6px` to `8px`.

Avoid:

- Harry Potter-coded or wizard-school visual language.
- Wands, spell particles, castles, owls, potions, candlelit old libraries, gothic arches, parchment scrolls, and medieval manuscript styling.
- Pure cyberpunk neon or generic blue SaaS treatment.
- Fantasy illustration as background decoration.
- Oversized rounded cards or bubbly pill-heavy surfaces.

### Icon Treatment

Bottom bar and header icons should use the `Saga Hero` visual direction:

- Illustrated, emblem-like, and warm gold by default.
- Active icons may glow or gain a stronger gold edge.
- Inactive icons should remain readable without becoming full-color distractions.
- Settings, utility, and future mobile-only icons should match the `Saga Hero` family instead of falling back to unrelated generic symbols.

The mobile shell should feel like Saga's operator console: half mythic archive artifact, half advanced routing tool. It should not feel like a specific fandom skin.

## Lorecard Lifecycle Interaction Model

The Lorecards mobile surface should rely less on simple button rows and more on dynamic interactables that move Lorecards through visible states.

The user should experience Lorecards as objects moving through a lifecycle:

```text
Capture / Suggest
  -> Pending Review
  -> Accepted Lorecards
  -> Active Set
```

Use `Accepted Lorecards` as the visible product label unless Saga deliberately renames that concept everywhere. `Approved` may describe the lifecycle action, but the UI should not casually mix `Approved` and `Accepted` as separate labels.

### Pipeline Surface

The Lorecards tab should act like a lifecycle surface:

```text
Lorecard Pipeline

Capture
Recent story scan, manual note, generated suggestion

Pending Review
Swipe, tap, batch select, inspect conflicts

Accepted Lorecards
Trusted and saved facts

Active Set
Facts currently affecting prompt output
```

Buttons remain available, but they should be secondary affordances inside the flow. The primary interaction should be selecting, reviewing, promoting, muting, pinning, or inspecting Lorecard objects.

### Dynamic Entry State

The Lorecards tab should open to the most useful working area:

- If suggestions exist, open with suggested Lorecards.
- If pending items exist, open with Pending Review.
- If no Lorecards are active but accepted cards exist, open with Active Set management.
- If there is no current work, open with the Active Set summary and a compact Capture prompt.

The top summary should also act as a filter rail:

```text
12 suggested | 4 pending | 18 accepted | 6 active
```

Tapping a count filters the lifecycle surface instead of opening a separate button-driven mode.

### Capture

Manual creation and generated suggestions should share one Capture surface.

```text
Capture Lore

Recent Story Scan
Find new facts from the current chat.

Manual Lore Note
Write a fact that should matter.

Context Suggestions
Suggest facts for the current story position.
```

Each source produces the same object type: a draft or suggested Lorecard that enters Pending Review. This avoids separate create and suggest workflows competing for attention.

### Pending Review

Pending Review should feel like a review stack.

Each pending card should show:

- Title.
- Short fact summary.
- Source: Manual, Story Scan, Creator, or Context Suggestion.
- Conflict, duplicate, or confidence hint when available.
- Relevance, scope, or Context chips.
- Destination preview.

Primary interactions:

- Tap card to inspect details.
- Tap check to accept.
- Tap dismiss to reject or archive.
- Swipe as an optional shortcut, never the only path.
- Long press or checkbox to enter batch mode.

Card detail should open as a sheet or subview:

```text
Lorecard Detail

Fact
Why suggested
Affected Context
Similar existing cards
Destination
Accept / Edit / Reject
```

### Accepted Lorecards And Active Set

Accepted Lorecards are trusted and saved. Active Lorecards are currently eligible to affect prompt output. Keep that distinction visible.

Recommended states:

| State | Meaning |
| --- | --- |
| Active | Currently eligible for prompt injection |
| Pinned | Always included when relevant |
| Available | Accepted but not currently active |
| Muted | Accepted but temporarily excluded |
| Needs Review | Waiting for user decision |
| Conflict | Needs comparison before trust |
| Duplicate | Likely overlaps another Lorecard |

The Active Set should be managed visually:

```text
Active Set
[Forest clue] [Hermione knows X] [Voldemort rumor]

Available Accepted Lorecards
[+] activate   [-] mute   [pin] keep active
```

Interactions:

- Tap an active chip or card to inspect it.
- Toggle active state directly from an accepted card.
- Pin or mute through a visible control or overflow menu.
- Filter by Context, deck, tag, source, or priority.
- Show "why active" as a short reason in the detail sheet, not as a separate diagnostics panel.

### Dynamic Interactables

Use these patterns before adding more plain button rows:

- Pipeline counters that also filter.
- Review stack cards.
- Active Set tray.
- Composer card for manual lore capture.
- Scan progress card with live results appearing below it.
- Conflict chips that open comparison sheets.
- Batch selection drawer that appears only after selecting cards.
- Context-aware empty states with one next action.

Gesture interactions can make the flow faster, but every critical action needs a visible tap target.

## Information Architecture

### Bottom Bar

Use fixed bottom navigation whose route set is driven by Experience Mode.

Basic uses five labeled slots:

| Slot | Label | Purpose |
| --- | --- | --- |
| 1 | Loredecks | Active Stack, Library entry point, deck readiness, Creator entry when available |
| 2 | Session | Current status, Start Checklist, next action, Saga activity state |
| 3 | Context | Story position, Context selection, resolver status |
| 4 | Lorecards | Suggested, pending, accepted, manual, and generated Lorecards |
| 5 | Settings | Experience Mode, provider setup, Theme Packs, and configuration |

Advanced uses seven icon-only slots:

| Slot | Label | Purpose |
| --- | --- | --- |
| 1 | Loredecks | Active Stack, Library entry point, deck readiness, Creator entry when available |
| 2 | Session | Current status, next action, Saga activity state |
| 3 | Continuity | Continuity tracking, timeline state, and continuity diagnostics |
| 4 | Context | Story position, Context selection, resolver status |
| 5 | Lorecards | Generation, Automation, Pending, and Approved Lorecards |
| 6 | Injection | Prompt preview, injection state, and compression diagnostics |
| 7 | Settings | Experience Mode, provider setup, Theme Packs, and configuration |

Do not make the primary navigation horizontally scrollable unless a later
usability pass proves it necessary; hidden navigation is a poor default for a
repeated-use tool. Advanced solves the space issue by using icon-only tabs for
memorized power-user destinations.

### Basic And Advanced Modes

Basic and Advanced should share the same mobile shell.

Basic bottom bar:

```text
Loredecks | Session | Context | Lorecards | Settings
```

Advanced bottom bar:

```text
Loredecks | Session | Continuity | Context | Lorecards | Injection | Settings
```

Experience Mode selection lives at the top of `Settings`. Changing the mode
updates the bottom-nav route set in place.

## Shell Specification

### Mobile Detection

Use viewport and capability signals, not user agent strings.

Recommended initial contract:

- Mobile shell when the Saga runtime viewport is `<= 640px` wide.
- Consider coarse pointer as a density hint, not the only mobile trigger.
- Tablet widths may stay desktop unless direct verification shows the desktop shell overflows.

### Header

The first mobile pass allowed a compact header. The current design direction is
to remove the redundant runtime top navbar wherever possible because the bottom
nav already communicates the active section.

Required shell affordances without a persistent top navbar:

- Back action when inside a subview.
- Exit action by morphing the active bottom tab into `Exit`.
- Overflow menu for lower-frequency actions.
- Compact status row only inside page content when it changes the next action.

Example:

```text
[Back]  Deck Details              [Menu]
        41 cards, 2 warnings
```

Header rules:

- Never hide the only way to leave a screen.
- Do not carry desktop rail metrics into a mobile top bar.
- Status chips may wrap to a second row only if they remain readable.
- Keep exact user-facing labels for existing features and controls.

### Bottom Bar

The bottom bar is fixed to the bottom of the Saga surface.

Required behavior:

- Safe-area aware padding.
- Stable slots for the active Experience Mode.
- Basic labels remain visible; Advanced labels are visually hidden so seven
  routes fit as icon-only tabs.
- 44px minimum interactive target per slot.
- Icon plus short label in Basic; icon-only in Advanced.
- Clear active state.
- No hover-only state.
- Content area includes bottom padding so controls do not sit under the bar.

Visual direction:

- Keep it compact and utilitarian.
- Use `Saga Hero` illustrated tab emblems for the bottom bar icon language.
- Use antique-gold active states, restrained glow, and thin luminous dividers.
- Use small teal/cyan signal accents only for live status or active data.
- Use a top border or elevation to separate it from content.
- Active state can be a top indicator, accent icon, or restrained filled state.
- Avoid large pill treatments that reduce available label width.

### Settings Route

Settings is a direct bottom-nav route in both Basic and Advanced.

Required top-of-page order:

- Experience Mode selector.
- Provider setup.
- Theme Pack and icon set controls.
- Remaining configuration groups.

Continuity and Injection are direct Advanced routes rather than Settings
children or overflow-menu entries.

## Subview Model

Mobile should use staged subviews instead of multi-pane desktop layouts.

Subview examples:

```text
Loredecks
  -> Library
  -> Deck Details
  -> Active Stack
  -> Creator Projects
  -> Creator Draft
```

```text
Context
  -> Overview
  -> Timeline
  -> Phrase Resolver
  -> Proposal Review
```

```text
Continuity
  -> Status
  -> Timeline / Graph
  -> Selected Item Detail
```

Subview rules:

- A subview owns the header title and back button.
- A subview should have one primary scroll owner.
- Detail panes should become pushed subviews or sheets, not side-by-side columns.
- Desktop hover tooltips should not be required to understand available actions.

## Touch And Control Rules

Mobile MVP requires a touch-density layer.

Required changes:

- Primary buttons, icon buttons, selects, tab slots, row actions, and menu triggers should have 40-44px hit targets.
- Small checkboxes may remain visually compact, but their labels or rows must be tappable.
- Hover-revealed actions must become visible, moved to overflow menus, or exposed in row/action sheets.
- Drag-only critical workflows need tap alternatives.
- Resize handles are hidden in mobile mode.
- Desktop tooltips remain for keyboard and pointer contexts but are not part of the mobile interaction contract.

## Tab Scope

### Session

MVP scope:

- Show Saga activity state.
- Show Start Checklist and recommended next action.
- Keep status summaries readable in one column.
- Keep walkthrough entry reachable.

Defer:

- Mobile-specific onboarding redesign.
- Dense diagnostic summaries.

### Loredecks

MVP scope:

- Start with an Active Stack summary and current deck readiness.
- Active Stack summary is readable and actionable.
- Library can open in mobile mode.
- Library uses staged views: Library list, stack/details, deck details.
- Import and core deck actions remain reachable.
- Creator entry is reachable in Advanced, but Creator workflows can remain MVP-simple if usable.

Defer:

- Touch drag-and-drop parity.
- Fully redesigned Library organization.
- Fully redesigned Creator authoring flow.

### Context

MVP scope:

- Current story position is visible.
- Browse Context and Detect Context remain reachable.
- `Start Here`, `Use Window`, `Use Anchor`, `After`, `Before`, `Timeline`, and `Phrase Resolver` remain exact labels where they appear.
- Dense Context Workbench panes become staged views.
- Overview shows the current story position and the next useful Context action before resolver diagnostics.

Defer:

- Full mobile optimization of every resolver diagnostic.
- Gesture-based timeline navigation.

### Lorecards

MVP scope:

- Suggested, pending, and accepted Lorecards are reachable.
- Capture, Pending Review, Accepted Lorecards, and Active Set appear as lifecycle states, not unrelated panels.
- Pipeline counters act as filters for suggested, pending, accepted, and active cards.
- Manual notes, story scans, and Context suggestions feed the same review flow.
- Review actions are tappable.
- Accepted Lorecards can be activated, muted, pinned, and inspected without relying on drag or hover.
- Generation controls stack cleanly.
- Lists avoid nested scroll traps.
- Review screens foreground the decision before source metadata, routing, and timeline details.

Defer:

- Perfect mobile bulk-review ergonomics beyond basic selection and batch action support.
- Advanced timeline/minimap polish.

### Continuity

MVP scope:

- Reachable as a direct icon-only Advanced bottom-nav route.
- Status and selected item detail are readable.
- Graph or timeline interactions have tap-to-select behavior.

Defer:

- Full graph editing ergonomics.
- Hover tooltip parity.

### Injection

MVP scope:

- Reachable as a direct icon-only Advanced bottom-nav route.
- Prompt preview, placement controls, and compression status are readable.
- Tiny placement controls are touch-sized.

Defer:

- Full mobile power-user prompt editing experience.

### Settings

MVP scope:

- Reachable as a direct Basic and Advanced bottom-nav route.
- Experience Mode selector appears at the top of the page.
- Provider setup works.
- Theme Pack controls wrap cleanly.
- Danger Zone remains explicit and confirmable.

Defer:

- Complete mobile reorganization of every settings group.

## Layout And CSS Architecture

Recommended implementation shape:

- Add a mobile class on the Saga runtime root, such as `.saga-runtime-mobile`.
- Keep mobile shell styles in the runtime shell/layout layer rather than scattering global overrides through every panel.
- Add shared touch-density tokens for control height, icon button size, row padding, and bottom-bar height.
- Use `100dvh` where supported for mobile-height surfaces.
- Include `env(safe-area-inset-bottom)` and `env(safe-area-inset-top)` padding where fixed bars are used.
- Prefer container-aware layout inside panels after the shell provides a sane width.

Avoid:

- Per-panel hacks to fight the desktop drawer minimum.
- Mobile-only `!important` cascades except for narrowly contained migrations from existing important-heavy areas.
- User-agent-specific styles.

## Runtime State Implications

The current desktop shell stores rail position, drawer side, drawer width, and drawer height. Mobile should not treat those as active controls.

Mobile state should track:

- Active bottom-bar route.
- Subview stack for the current tab.
- Optional scroll restoration per tab if needed.

Desktop state may keep rail and drawer geometry. Mobile should ignore or reset geometry that cannot fit.

Because Saga is pre-alpha, state migration can be direct:

- Normalize old desktop geometry into valid desktop defaults.
- Do not preserve invalid mobile drawer widths for compatibility.
- Add a layout version if it makes shell-state cleanup explicit.

## Accessibility Contract

Mobile MVP should include:

- Keyboard-focusable bottom bar and route subviews.
- `aria-current` or equivalent active tab state.
- Accessible names for icon buttons.
- Focus return after closing subviews.
- Escape/back behavior for sheets where applicable.
- Visible focus styles retained from desktop.
- No essential action available only through hover.

## Mobile Support Integration Plan

The mobile work should land in dependency phases. Each phase should leave the product in a coherent state, preserve desktop behavior at desktop widths, and add enough verification that the next phase is not guessing about the foundation.

### Phase 0: Baseline And Contracts

Goal: make the current desktop behavior and mobile requirements explicit before changing the shell.

Scope:

- Identify the runtime shell, tab registry, layout CSS, state normalization, and visual smoke harness entry points that will change.
- Record the mobile bottom-bar orders:
  `Loredecks | Session | Context | Lorecards | Settings` in Basic and
  `Loredecks | Session | Continuity | Context | Lorecards | Injection |
  Settings` in Advanced.
- Confirm the mobile viewport contract: `360px`, `390px`, `430px`, and `768px`.
- Confirm the visual identity contract: `SAGA Archive` dark shell, `Saga Hero` icon language, hybrid mythic-tech accents.
- Confirm the Lorecards lifecycle contract: Capture / Suggest -> Pending Review -> Accepted Lorecards -> Active Set.

Deliverables:

- Mobile shell implementation checklist.
- Visual smoke checklist for shell overflow, bottom-bar reachability, and key tab routing.
- List of desktop shell behaviors that must remain valid at desktop widths.

Exit criteria:

- Current desktop smoke coverage still passes.
- The mobile acceptance criteria are mapped to concrete files, selectors, or test harness responsibilities.
- No implementation starts from an undefined tab order, viewport target, or visual direction.

### Phase 1: Shell Foundation

Goal: replace the phone-width desktop rail/drawer with a real mobile shell.

Scope:

- Add viewport-based mobile shell detection.
- Add a mobile root class such as `.saga-runtime-mobile`.
- Render the active tab as a full-width mobile page.
- Remove the redundant runtime top navbar at phone width.
- Render the fixed bottom bar with safe-area padding.
- Morph the active bottom tab into `Exit` so Saga can close without a top-bar
  close button.
- Disable rail dragging and drawer resizing in mobile mode.
- Stop enforcing desktop drawer minimums on phone-width surfaces.
- Add bottom padding so content and sticky actions do not sit under the bottom bar.

Deliverables:

- Mobile shell rendering path.
- Header and bottom-bar structure.
- Desktop shell remains available outside the mobile breakpoint.
- First mobile shell CSS layer in the runtime layout area.

Exit criteria:

- At `360px`, `390px`, and `430px`, the shell itself has no horizontal overflow.
- Bottom bar is reachable and uses the required tab order.
- Back appears only for pushed subviews, and the active bottom tab provides the
  primary `Exit` affordance.
- Desktop rail/drawer behavior still works at desktop widths.

### Phase 2: Navigation And Subviews

Goal: make every mobile route reachable without exposing every desktop panel at once.

Scope:

- Wire the Basic five-slot bottom bar.
- Wire the Advanced seven-slot icon-only bottom bar.
- Keep Settings direct in both modes.
- Keep Continuity and Injection direct in Advanced.
- Add a subview stack primitive for pushed mobile flows.
- Add back behavior and focus return for sheets and subviews.
- Map existing runtime tabs into mobile routes without renaming core labels.

Deliverables:

- Reachable routes for Session, Loredecks, Context, Lorecards, Continuity, Injection, and Settings.
- Subview stack state and back behavior.
- Basic and Advanced mode route filtering.

Exit criteria:

- Every Basic tab is reachable from the bottom bar.
- Every Advanced tab is reachable from the icon-only bottom bar.
- Settings exposes Experience Mode at the top.
- Back and close never depend on desktop rail behavior.

### Phase 3: Visual Identity And Touch System

Goal: make the mobile shell feel like Saga and behave like a touch interface.

Scope:

- Apply `SAGA Archive` colors to mobile shell surfaces.
- Render `Saga Hero` style icons in the bottom bar and header entry points.
- Add or extend shared touch-density tokens.
- Raise primary controls, icon buttons, row actions, tab slots, and menu triggers to 40-44px targets.
- Replace hover-only critical actions with visible controls or overflow menu entries.
- Keep the hybrid mythic-tech aesthetic while avoiding fandom-specific fantasy cues and generic sci-fi treatment.

Deliverables:

- Mobile touch-density CSS tokens.
- Bottom-bar icon treatment.
- Header icon and action treatment.
- Visual identity checklist for mobile screenshots.

Exit criteria:

- Critical controls meet the touch target contract.
- No essential action depends on hover.
- Mobile screenshots visibly use `Saga Hero` icon language.
- The shell avoids source-franchise styling, generic blue SaaS, and pure cyberpunk treatment.

### Phase 4: Operator Console Tabs

Goal: convert the primary mobile tabs into summary-first operator screens.

Scope:

- Apply the one-question-per-tab simplification rule.
- Session opens with readiness and the next useful action.
- Loredecks opens with Active Stack status, deck readiness, and Library access.
- Context opens with current story position and the next Context action before diagnostics.
- Settings remains directly reachable and starts with Experience Mode.
- Continuity and Injection remain directly reachable in Advanced with readable
  status-first layouts.

Deliverables:

- Session mobile layout.
- Loredecks mobile layout.
- Context mobile layout.
- Settings, Continuity, and Injection mobile reachability.
- Context label preservation for `Start Here`, `Use Window`, `Use Anchor`, `After`, `Before`, `Timeline`, and `Phrase Resolver`.

Exit criteria:

- Each primary tab opens with a summary and next useful action.
- Dense desktop control clusters are behind subviews, sheets, or Advanced routes.
- Context controls preserve exact existing labels.
- Basic remains lightweight while Advanced preserves deeper access.

### Phase 5: Lorecards Lifecycle Flow

Goal: turn Lorecards into a dynamic object lifecycle instead of a button-heavy panel.

Scope:

- Build the lifecycle surface: Capture / Suggest, Pending Review, Accepted Lorecards, Active Set.
- Make pipeline counters filter suggested, pending, accepted, and active cards.
- Route manual notes, story scans, Creator drafts, and Context suggestions into the same review flow.
- Add review-stack cards with visible accept, edit, reject, and inspect controls.
- Add Active Set tray behavior for inspect, activate, mute, and pin actions.
- Add basic batch-selection support without requiring drag, swipe, or hover.

Deliverables:

- Lorecards lifecycle layout.
- Capture surface.
- Pending Review stack.
- Accepted Lorecards and Active Set management.
- Object-level action controls and detail sheet/subview.

Exit criteria:

- A Lorecard can move through Capture / Suggest -> Pending Review -> Accepted Lorecards -> Active Set on mobile.
- Active Lorecards can be inspected, activated, muted, and pinned from visible controls.
- Suggested, pending, accepted, and active filters are reachable.
- The flow does not reintroduce redundant create entry points.

### Phase 6: Heavy Workbench Adaptation

Goal: make the densest desktop surfaces usable without side-by-side panes.

Scope:

- Convert Loredeck Library into staged mobile views.
- Convert Context Workbench into overview, timeline, resolver, and proposal review subviews.
- Adapt Health Center to a mobile shell.
- Adapt Creator project and draft surfaces enough for mobile MVP usability.
- Ensure large overlays use mobile header/back behavior instead of desktop-only close paths.

Deliverables:

- Loredeck Library mobile staged views.
- Context Workbench mobile staged views.
- Health Center mobile route or sheet.
- Creator mobile MVP surface.

Exit criteria:

- Loredeck Library does not require multiple desktop columns on phone widths.
- Context Workbench does not require side-by-side desktop panes on phone widths.
- Health and Creator surfaces have reachable close/back controls.
- Touch alternatives exist for critical drag-heavy or hover-heavy workflows.

### Phase 7: Verification, Walkthroughs, And Release Readiness

Goal: prove the mobile MVP across target viewports and update dependent guidance.

Scope:

- Extend visual smoke harness coverage for mobile viewports.
- Add no-horizontal-overflow checks.
- Add bottom-bar, active-tab exit, direct Settings, Advanced direct-route, and
  subview checks.
- Add touch-target checks for critical controls.
- Add Lorecards lifecycle checks.
- Add visual review checks for `Saga Hero` icon usage and hybrid mythic-tech styling.
- Update walkthrough targets and guide copy if mobile routing changes target availability.
- Run the broader alpha gate after runtime, docs, or walkthrough contracts change.

Deliverables:

- Mobile visual smoke matrix.
- Updated guide/walkthrough target coverage where needed.
- Verification notes for desktop and mobile shells.
- Final pass against acceptance criteria.

Exit criteria:

- Phone and tablet visual smoke coverage passes.
- Desktop runtime shell coverage still passes.
- Walkthrough targets remain resolvable.
- `node tools\scripts\test-visual-smoke-harness.mjs` passes.
- `node tools\scripts\run-alpha-gate.mjs` passes after the implementation touches runtime, docs, walkthroughs, or release-facing contracts.

## Acceptance Criteria

Mobile support MVP is done when:

- At `360px`, `390px`, and `430px` widths, Saga has no horizontal page overflow in the runtime shell.
- The bottom bar is always reachable and does not cover active controls.
- Every Basic tab is reachable.
- Every Advanced tab is reachable through the icon-only bottom bar.
- Every active mobile screen has a visible way to go back or close.
- Primary controls meet the touch target contract.
- Each primary mobile tab opens with a summary and next useful action, not a dense desktop control cluster.
- Session, Loredecks, Context, Lorecards, Settings, Continuity, and Injection are usable without desktop hover.
- Lorecards move through Capture, Pending Review, Accepted Lorecards, and Active Set without relying on scattered button rows.
- Active Lorecards can be inspected, activated, muted, and pinned from visible object-level controls.
- Loredeck Library and Context Workbench do not require side-by-side desktop panes on phone widths.
- Existing desktop runtime shell behavior still works at desktop widths.
- The mobile shell uses the `Saga Hero` icon language and hybrid mythic-tech visual direction rather than generic sci-fi, generic SaaS, or fandom-specific fantasy styling.
- Visual smoke coverage includes phone and tablet viewport checks.

## Non-Goals

- Full mobile redesign of every Advanced workflow.
- Drag-and-drop parity on touch.
- Landscape phone optimization.
- Gesture navigation.
- Native app packaging.
- Perfect graph editing on mobile.
- Fandom-specific mobile skins or visual language tied to a single source franchise.
- Backwards compatibility for old pre-alpha shell state that conflicts with the new layout.

## Open Decisions

- Whether the mobile header should be sticky inside Saga's surface or fixed to the viewport.
- Whether tablet should use desktop shell, mobile shell, or a hybrid shell.
- Whether Health Center belongs under Loredecks, Settings, or its own Advanced
  route later.

## Verification Plan

Minimum commands after implementation:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\run-alpha-gate.mjs
```

Recommended visual matrix:

| Viewport | Mode | Required Coverage |
| --- | --- | --- |
| `360x740` | Basic | Session, Loredecks, Context, Lorecards, Settings |
| `390x844` | Basic | Start Checklist, Library entry, Context actions, Lorecard review |
| `430x820` | Advanced | Icon-only nav, Continuity, Injection, Settings, Lorecard Active Set |
| `768x1024` | Advanced | Tablet shell decision, overlays, Library, Context Workbench |

Automated checks should include:

- No horizontal overflow.
- Bottom bar visible and safe-area padded.
- Subview back and active-tab `Exit` visible when required.
- Active tab state exposed.
- `Saga Hero` icons render in the bottom bar and header entry points.
- Screens preserve the hybrid mythic-tech aesthetic without source-franchise cues.
- Critical controls have minimum touch target size.
- Settings, Continuity, and Injection direct routes open without an overflow
  sheet.
- Lorecard lifecycle filters for suggested, pending, accepted, and active states are reachable.
- Lorecard accept, reject, activate, mute, pin, and inspect actions have visible tap targets.
- Existing guide and walkthrough targets remain resolvable after layout changes.
