# Saga Visual Smoke Runbook

This runbook covers repeatable visual smoke passes for Saga's runtime shelf, Loredeck workflows, Deck Health, Creator, Theme Pack, and import/update surfaces.

## Local Harness

The local harness renders the real `src/runtime/lore-panel.js` runtime shelf with a stubbed SillyTavern context. It is useful before testing inside a full SillyTavern install.

Start the no-dependency local server:

```powershell
node tools\scripts\serve-visual-smoke.mjs
```

Open the printed URL:

```text
http://127.0.0.1:8765/tests/browser/visual-smoke.html
```

Context-specific harness URLs:

```text
http://127.0.0.1:8765/tests/browser/visual-smoke.html?tab=context
http://127.0.0.1:8765/tests/browser/visual-smoke.html?tab=context&review=context-proposals
```

The harness seeds:

- Expanded Saga shelf with the Loredecks tab open.
- A Custom Loredeck named `Smoke Test: Arlong Park`.
- A normalized in-progress Deck Maker project named `Smoke Deck Maker Project`.
- A loaded Loredeck stack with the Custom deck above `hp-golden-trio`.
- Embedded schema v3 Lorecards.
- A Pending Review proposal on the Custom deck.
- A story-lore and pending-lore sample for the Lore and Injection tabs.

## Quick Contract Check

Run:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\serve-visual-smoke.mjs --check --port 0
```

These checks do not replace a browser screenshot pass. They only verify that the harness, fixture, source hooks, and CSS hooks are still wired.

## Mobile Workbench Matrix

The mobile revision feature owns the final mobile verification matrix. It consumes the shared mobile shell contracts from the initial mobile build, then verifies that mobile workbenches now follow the touch-first redesign rather than a compressed desktop pane model:

| Viewport | Mode | Workbench Coverage |
| --- | --- | --- |
| `360x740` | Basic | Basic mobile nav: Loredecks, Session, Context, Lorecards, Settings; Loredeck Library direct browse, folder tap open/close, no default mobile stack pane, Loredeck tap-selection order badges, Pack Health summary and scan without Health Center repair routes, Context Workbench, removed runtime top header, bottom shell back action, active bottom tab becomes `Exit`, active tab state exposure, Lorecards secondary `Generate | Lore` sub-tab bar, unified Lore list with Pending Review and Accepted/Active cards, Accepted long-title object cards, bottom-bar safe-area padding, no horizontal overflow. |
| `390x844` | Basic | Session, Loredecks, and Context next-actions, Basic bottom nav includes Settings, Library details and folder/order touch alternatives, Context story-position and Use Anchor controls, Deck Maker stage guide/current task, visible touch targets. |
| `430x820` | Advanced | Advanced icon-only bottom nav with Loredecks, Session, Continuity, Context, Lorecards, Injection, Settings; Lorecards secondary sub-tabs, unified Lore object list, active/pinned/muted visual states, Accepted long-press editing without permanent Edit/Inspect buttons, Pack Health tabs and bottom actions, Deck Maker current-task priority and bottom actions, Library object actions, Context proposal review bottom actions. |
| `768x1024` | Advanced | Tablet sanity for Library, Context Workbench, Pack Health, Creator, desktop rail/drawer preservation, and desktop shell coexistence above the mobile breakpoint. |

Current static coverage verifies that phone-width fullscreen workbenches use full-viewport shells, stacked Context layouts, Context story-position and `Use Anchor` actions, hidden Library resize handles, visible Library cover/title actions, Library folder and active-order touch alternatives, Basic Pack Health summary/scan without repair routes, Advanced full-viewport Pack Health Center shell, Advanced bottom-owned Pack Health Center actions, Advanced scrollable Deck Maker workbench body, Advanced bottom-owned Deck Maker workbench actions, bottom-owned Context Workbench actions, current-task priority before the Deck Maker roadmap, the compact horizontal Deck Maker roadmap rail, touch-sized Deck Maker current-task controls, Deck Maker review-queue anchors/actions, reachable Advanced Health/Deck Maker close affordances, scrollable Health tabs, bottom-owned Context proposal review actions, Basic bottom nav includes Settings, Advanced icon-only bottom nav with direct Continuity, Injection, and Settings routes, Basic/Advanced walkthrough target resolvability, Basic Session next-action, Loredecks static Library launch card, Context operator next-action, and the 768px tablet sanity viewport staying above the shared mobile-shell breakpoint. It also verifies shared shell contracts for the fixed bottom bar, bottom-bar safe-area padding, compact content padding, active tab state exposure, dynamic route-count columns, removed runtime top header, bottom shell back action, active bottom tab becomes `Exit`, tooltip-free mobile navigation, subview helpers, Saga Hero route icons, Saga Archive mobile visual treatment, and no horizontal runtime overflow, plus touch-redesign contracts for Loredeck folder tap open/close, Loredeck tap order reflected as runtime stack order, selected Loredeck order badges, bottom-owned mobile Library actions, one-scroll Library browse, the mode-aware Lorecards secondary sub-tab bar (`Generate | Lore` in Basic, `Generate | Automate | Lore` in Advanced), object-first Lorecards page bodies, one-scroll Lorecards workspaces, unified Lore page ownership, Pending Review Accept/Reject-only rows, Accepted/Active object cards, Accepted long-press editing without tap-to-edit or permanent Edit/Inspect buttons, Accepted long-title wrapping, full-window mobile Lorecard editing, mobile Lore filters, and no mobile `Lorecard Pipeline` card or in-content lifecycle button row as the stage switcher. The browser pass should still capture the matrix above to confirm bottom-bar routing, bottom-bar safe-area padding, compact content padding, active tab state exposure, removed runtime top header, bottom shell back action, active bottom tab becomes `Exit`, direct Settings route reachability, direct Continuity and Injection route reachability in Advanced, walkthrough popover target reachability after mobile routing, subview back behavior, Basic health-summary-only behavior, Advanced Health/Deck Maker bottom actions, Context Workbench bottom actions, Session next-action routing, Loredecks static Library launch routing, Context next-action routing, Library folder/order touch behavior, Library bottom actions, Lorecards secondary sub-tab animation and placement, unified Lore list ownership, Pending Review rows with only Accept/Reject, Accepted long-press edit access, global nested-scroll audit results, active-card visual treatment without redundant active chips, Accepted object-card visibility, Accepted long-title wrapping, Deck Maker current-task actions, Deck Maker current-task priority before the roadmap, Creator compact roadmap rail, Deck Maker review-queue routing, Context proposal review bottom actions, 768px tablet desktop-shell coexistence, Advanced full-viewport Pack Health rendering, Advanced Pack Health bottom actions, Saga Hero route icons, warm gold/data-accent active styling, and no horizontal overflow in rendered pixels at each viewport.

Mobile UX revision review should additionally confirm that the Lorecards secondary sub-tab bar appears only while `Lorecards` is active, hides `Automate` in Basic, animates above the fixed bottom nav without content jumps, and leaves the page body to the selected singular-purpose workspace with one dominant next action; the Loredecks mobile root presents the static Loredeck Library launch card instead of an Active Stack summary; the runtime top header is absent; the active bottom tab becomes `Exit`; Basic keeps Pack Health to summary/scan actions; Advanced Pack Health, Creator, and Context Proposal Review persistent actions sit in bottom bars; Creator opens with the current task above the stage roadmap; Basic bottom bar labels stay readable; and Advanced uses icon-only bottom navigation.

Rendered Accepted object-action review should confirm unified Lore rows expose object-state chips, desktop detail-pane controls, and mobile long-press editing without showing equal permanent row buttons across every card.

Rendered Pending wording review should confirm card guidance, destination hints, and Auto-Relevance pending-only warning use Accept/Reject wording, with pending rows exposing only Accept and Reject and editing reached through selected context or detail affordance without falling back to Apply/Dismiss copy.

Rendered visual review should also confirm hybrid mythic-tech/source-franchise-free styling: the mobile shell should read as Saga Archive/Saga Hero with warm gold and data accents, not fandom-specific fantasy, generic sci-fi, generic SaaS, or pure cyberpunk treatment.

Rendered desktop preservation review should confirm desktop rail/drawer preservation at desktop widths alongside the 768px tablet desktop-shell coexistence check.

## Repo-Local Desktop Lorecards Helper

Run the current-code desktop Lorecards workspace smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='desktop-lorecards-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='1600'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='900'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs
```

This captures:

```text
assets/documentation/renders/saga-smoke/desktop-lorecards-harness-01-workspace.png
```

It verifies the desktop Lorecards workspace renders without a duplicate inner title/header, inline list editors, `Save Entry` buttons inside object rows, tag-wall rows, clipped toolbar buttons, horizontal overflow, unreadably small row/detail text, or a detail pane that escapes the workspace bounds.

## Repo-Local Context Screenshot Helper

Run the current-code Context smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='context-harness'
node tools\scripts\smoke-live-st-cdp.mjs
```

For the mobile Context row in the matrix, run the same repo-local target at phone width:

```powershell
$env:SAGA_SMOKE_TARGET='context-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='360'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='740'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs
```

This starts the local harness, opens the Context tab with seeded Reasoner proposals, captures:

```text
assets/documentation/renders/saga-smoke/context-harness-01-proposal-review.png
assets/documentation/renders/saga-smoke/context-harness-02-workbench.png
```

It verifies the Runtime Context command center, proposal review overlay, proposal apply flow, loaded Loredeck Context rows, lock state, and Context Workbench tabs.

## Repo-Local Creator Reset Screenshot Helper

Run the current-code Deck Maker reset smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='creator-harness'
node tools\scripts\smoke-live-st-cdp.mjs
```

This starts the local harness, opens the Loredecks tab, resumes the seeded in-progress Deck Maker project, clicks `Reset to Title Pass`, and cancels the destructive confirmation. It captures:

```text
assets/documentation/renders/saga-smoke/creator-harness-01-reset-controls.png
assets/documentation/renders/saga-smoke/creator-harness-02-reset-confirm.png
```

It verifies the top-bar reset buttons render outside the main stage navigation button, `Finalize` has no reset control, the reset controls are enabled when generation is not active, and the confirmation names the target step plus the later steps that will be erased.

## Repo-Local Walkthrough Screenshot Helper

Run the current-code Basic and Advanced walkthrough smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='guide-harness'
node tools\scripts\smoke-live-st-cdp.mjs
```

This starts the local harness, opens the Basic Session guide, then reloads the harness in Advanced mode. It captures:

```text
assets/documentation/renders/saga-smoke/guide-harness-01-basic-card.png
assets/documentation/renders/saga-smoke/guide-harness-02-basic-module.png
assets/documentation/renders/saga-smoke/guide-harness-03-basic-prepared-library.png
assets/documentation/renders/saga-smoke/guide-harness-04-basic-tour.png
assets/documentation/renders/saga-smoke/guide-harness-05-advanced-card.png
assets/documentation/renders/saga-smoke/guide-harness-06-advanced-module.png
assets/documentation/renders/saga-smoke/guide-harness-07-advanced-creator-empty-project.png
assets/documentation/renders/saga-smoke/guide-harness-08-advanced-tour.png
```

It verifies Basic module cards, Advanced task-track cards, hidden Basic rail tabs, Advanced rail availability, focused module starts, prepared fullscreen Library targeting, missing-project or resumable-project Creator state, and the first full-tour popover for both walkthroughs.

## Repo-Local Mobile Touch Redesign Helper

Run the focused mobile touch redesign smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='mobile-redesign-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='360'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='740'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs
```

Repeat the same target at `390x844` and `430x820` before closing the mobile redesign feature.

This starts the local harness in Advanced mobile mode and captures:

```text
assets/documentation/renders/saga-smoke/mobile-redesign-360x740-01-library-browse.png
assets/documentation/renders/saga-smoke/mobile-redesign-360x740-02-library-detail.png
assets/documentation/renders/saga-smoke/mobile-redesign-360x740-03-library-reorder.png
assets/documentation/renders/saga-smoke/mobile-redesign-360x740-04-lorecards-automation.png
assets/documentation/renders/saga-smoke/mobile-redesign-360x740-05-lorecards-lore.png
assets/documentation/renders/saga-smoke/mobile-redesign-360x740-06-lorecards-generate.png
assets/documentation/renders/saga-smoke/mobile-redesign-360x740-07-lorecards-automation.png
```

It verifies the mobile Library browse surface hides desktop stack/details/resize/grab handles, deck taps update active-stack order badges, the selected strip opens detail and selected-only reorder sheets, the Lorecards route shows a mode-aware animated secondary sub-tab bar above the fixed bottom nav, the Lorecards page body does not use a `Lorecard Pipeline` card or lifecycle button row as the stage switcher, Lore combines Pending Review and Accepted/Active Lorecards in one object list, Pending Review rows expose only Accept and Reject, Accepted rows use readable two-line titles and long-press editing instead of full row-action buttons, Generate stays focused on creation/suggestion, Advanced Automate stays focused on automation status and controls, Basic hides Automate, and all checked surfaces avoid horizontal overflow.

## Repo-Local Advanced Mobile Matrix Helper

Run the current-code `430x820` Advanced mobile matrix smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='mobile-advanced-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='430'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='820'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs
```

This starts the local harness in Advanced mode and should stay aligned with the mobile touch redesign captures:

```text
assets/documentation/renders/saga-smoke/mobile-advanced-harness-01-loredecks-root.png
assets/documentation/renders/saga-smoke/mobile-advanced-harness-02-injection-route.png
assets/documentation/renders/saga-smoke/mobile-advanced-harness-04-active-set.png
assets/documentation/renders/saga-smoke/mobile-advanced-harness-05-library-actions.png
assets/documentation/renders/saga-smoke/mobile-advanced-harness-06-pack-health.png
assets/documentation/renders/saga-smoke/mobile-advanced-harness-07-creator-review-queue.png
assets/documentation/renders/saga-smoke/mobile-advanced-harness-08-context-proposals.png
```

It verifies the Advanced icon-only bottom routes for Loredecks, Session, Continuity, Context, Lorecards, Injection, and Settings; direct Settings with Experience Mode at the top; direct Injection and Continuity routing; absence of the removed overflow sheet; Lorecards secondary sub-tabs; unified Lore object-card controls; Library object actions; Pack Health close/content; Deck Maker Review Queue/current-task state; Deck Maker review-queue routing; Context proposal review overlay/actions; and no horizontal overflow on the mobile Loredecks root.

## Repo-Local Advanced Tablet Matrix Helper

Run the current-code `768x1024` Advanced tablet matrix smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='tablet-advanced-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='768'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='1024'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs
```

This starts the local harness in Advanced mode above the shared mobile-shell breakpoint and captures:

```text
assets/documentation/renders/saga-smoke/tablet-advanced-harness-01-loredecks-desktop-shell.png
assets/documentation/renders/saga-smoke/tablet-advanced-harness-02-library-details.png
assets/documentation/renders/saga-smoke/tablet-advanced-harness-03-pack-health.png
assets/documentation/renders/saga-smoke/tablet-advanced-harness-04-creator-review-queue.png
assets/documentation/renders/saga-smoke/tablet-advanced-harness-05-context-workbench.png
```

It verifies 768px tablet desktop-shell coexistence: the desktop rail and drawer remain rendered, the mobile bottom bar and mobile route sheet are absent, Loredecks opens with Library/Deck Maker actions, the selected Library details and Pack Health Center render without horizontal overflow, Creator shows Review Queue/current-task state, Context opens through the desktop rail, and Context Workbench shows Timeline, Aliases, Validation, Story Position, and Phrase Resolver controls.

## Live ST Screenshot Helper

After syncing the current workspace into the active SillyTavern extension directory, run the dependency-free CDP helper:

```powershell
node tools\scripts\smoke-live-st-cdp.mjs
```

In restricted desktop contexts, headless Chromium may crash. Use visible Chrome mode instead:

```powershell
$env:SAGA_SMOKE_HEADLESS='0'
node tools\scripts\smoke-live-st-cdp.mjs
```

The helper writes `live-st-*.png` screenshots to:

```text
assets/documentation/renders/saga-smoke/
```

These screenshots are local generated artifacts and are ignored by Git. Do not commit them to the extension install payload.

The helper safely clicks Custom `Delete Deck`, verifies the Saga-owned confirmation modal, captures `live-st-03-delete-confirm.png`, and clicks `Cancel`. Native browser confirmation dialogs should not appear in this flow.

## Live ST Context Screenshot Helper

To validate the installed Context tab specifically, run:

```powershell
$env:SAGA_SMOKE_TARGET='live-context'
node tools\scripts\smoke-live-st-cdp.mjs
```

This target opens the live installed shelf at `http://127.0.0.1:8000/`, switches to the Context tab, captures:

```text
assets/documentation/renders/saga-smoke/live-context-01-context-tab.png
```

It verifies:

- `Runtime Context`, `Browse Context`, `Detect Context`, and `Review Proposals` render in the installed shelf.
- Manual, Assisted, and Automatic automation modes render.
- `Advanced Context Brief` is available without making date/canon-boundary fields the primary UI.
- The old Context tooltip/date-first primary fields are absent.
- `Browse Context` either opens the Context Workbench or shows the no-loaded-Loredeck guard.
- `Review Proposals` either opens proposal review or shows the empty-proposal guard.

The latest empty-stack pass after syncing the active installed extension copy produced `live-context-01-context-tab.png` with no findings, no console errors, and no browser dialogs. The active ST chat had no enabled Loredecks, so the Browser and Proposal Review checks exercised guard states.

To validate the installed Context flow with an enabled Loredeck stack, run:

```powershell
$env:SAGA_SMOKE_TARGET='live-context-loaded'
node tools\scripts\smoke-live-st-cdp.mjs
```

This target snapshots the current Saga metadata, adds `Harry Potter Year 6: Half-Blood Prince` through the real Loredeck Library UI, opens the Context Browser, verifies casual alias search for `Ron dates the blonde girl`, applies `Post Christmas Return` as the after-bound, applies `Apparition Lessons Begin` as the before-bound, seeds a synthetic populated proposal review row, captures:

```text
assets/documentation/renders/saga-smoke/live-context-loaded-01-context-tab.png
assets/documentation/renders/saga-smoke/live-context-loaded-02-workbench.png
assets/documentation/renders/saga-smoke/live-context-loaded-03-proposals.png
```

It restores the original Saga metadata before exiting. The latest pass completed with no findings, no console errors, and no browser dialogs.

For the compact loaded Context pass, run:

```powershell
$env:SAGA_SMOKE_TARGET='live-context-loaded-narrow'
node tools\scripts\smoke-live-st-cdp.mjs
```

The narrow target uses a compact default viewport and writes:

```text
assets/documentation/renders/saga-smoke/live-context-loaded-narrow-01-context-tab.png
assets/documentation/renders/saga-smoke/live-context-loaded-narrow-02-workbench.png
assets/documentation/renders/saga-smoke/live-context-loaded-narrow-03-proposals.png
```

The latest compact pass completed with no findings, no console errors, no browser dialogs, and no obvious text overlap in the Context tab or proposal overlay.

For an opt-in live Reasoning Provider Context check, run:

```powershell
$env:SAGA_SMOKE_TARGET='live-context-reasoner'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
node tools\scripts\smoke-live-st-cdp.mjs
```

This target spends one bounded Reasoning Provider call. It snapshots current chat metadata and Saga settings, loads `Harry Potter Year 6: Half-Blood Prince`, seeds a loose non-date Context Brief, clicks `Ask Reasoner`, verifies bounded proposal state, then restores metadata and settings.

Expected artifacts when proposals render:

```text
assets/documentation/renders/saga-smoke/live-context-reasoner-01-result.png
assets/documentation/renders/saga-smoke/live-context-reasoner-02-proposals.png
```

Without `SAGA_ALLOW_PROVIDER_CALLS=1`, the target exits before modifying metadata or calling the provider.

## Live ST Deck Maker Provider Smoke

To run the installed Deck Maker end-to-end against real SillyTavern providers:

```powershell
$env:SAGA_SMOKE_TARGET='live-creator'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_ST_URL='http://127.0.0.1:8000/'
$env:SAGA_ST_USER_FILES_DIR='F:\SillyTavern\SillyTavern\data\default-user\user\files'
node tools\scripts\smoke-live-st-cdp.mjs
```

This target snapshots Saga metadata/settings, opens the real Library and Creator UI, drafts and approves the Scope Brief, drafts and approves the Story Outline, drafts all title batches, approves one title, plans Context/tags, accepts planning through Pending Review, drafts one Lorecard, sends it to Pending Review, accepts it, runs Pack Health, finalizes as Custom, verifies the finalized Library record and referenced files, then deletes the finalized Custom deck and restores the original metadata/settings snapshot.

If a prior interrupted automated Deck Maker smoke project is active, the harness cancels any live smoke generation and resets that smoke project back to intake before applying the new inputs. If the active project does not look like an automated smoke project, the target stops instead of resetting it.

The finalized-deck verification runs before cleanup. It first verifies the finalized Custom record and payload through `/user/files`, then uses the Library UI when the page remains responsive. The check verifies the Generated working deck was retired, verifies the Custom record links back to the Generated source, checks that at least one accepted Lorecard persisted with no pending changes, verifies entries now reference the Custom pack instead of the Generated pack, and checks that Creator-only entry markers were retired.

Cleanup tries the visible Library delete flow first. If the live page is wedged after finalization, the target falls back to SillyTavern's files API, and then to the local filesystem only when `SAGA_ST_USER_FILES_DIR` or `SAGA_ST_DATA_DIR` is set. The filesystem fallback is scoped to the smoke run's linked Library pack IDs, generated pack IDs, Deck Maker job IDs, indexed payload files, and indexed Deck Maker project files.

Expected artifacts:

```text
assets/documentation/renders/saga-smoke/live-creator-01-intake.png
assets/documentation/renders/saga-smoke/live-creator-02-scope-brief.png
assets/documentation/renders/saga-smoke/live-creator-03-story-outline.png
assets/documentation/renders/saga-smoke/live-creator-04-title-batch.png
assets/documentation/renders/saga-smoke/live-creator-05-title-batches-complete.png
assets/documentation/renders/saga-smoke/live-creator-06-title-approved.png
assets/documentation/renders/saga-smoke/live-creator-07-context-tags.png
assets/documentation/renders/saga-smoke/live-creator-08-planning-accepted.png
assets/documentation/renders/saga-smoke/live-creator-09-lorecard-draft.png
assets/documentation/renders/saga-smoke/live-creator-10-drafts-to-review.png
assets/documentation/renders/saga-smoke/live-creator-11-lorecard-accepted.png
assets/documentation/renders/saga-smoke/live-creator-12-pack-health.png
assets/documentation/renders/saga-smoke/live-creator-13-finalized.png
assets/documentation/renders/saga-smoke/live-creator-14-finalized-library.png
assets/documentation/renders/saga-smoke/live-creator-report.json
```

The JSON report includes `steps`, `providerUnits`, `staleSmokeResetState`, `finalizedVerificationState`, `cleanupState`, and restore results. Saga does not retain complete raw provider text after parsing; the report surfaces each generation unit's stage, status, elapsed time, received character count, result references, diagnostics, and the short streaming snippet when available.

By default the smoke adds the generated run id to the scope so repeated runs do not collide with the same deterministic Deck Maker project id. Set `SAGA_LIVE_CREATOR_SCOPE` when you intentionally want to reproduce a fixed project id.

Useful overrides:

```powershell
$env:SAGA_LIVE_CREATOR_FANDOM='One Piece'
$env:SAGA_LIVE_CREATOR_SCOPE='Arlong Park arc focused on Nami, Arlong, Cocoyasi Village, and the final confrontation.'
$env:SAGA_LIVE_CREATOR_GRANULARITY='compact'
$env:SAGA_LIVE_CREATOR_TIMEOUT_MS='300000'
$env:SAGA_SMOKE_REPORT='F:\git\Saga\assets\documentation\renders\saga-smoke\live-creator-report.json'
$env:SAGA_LIVE_CREATOR_CLEANUP='0'
$env:SAGA_LIVE_CREATOR_FINALIZE='0'
```

Use `SAGA_LIVE_CREATOR_CLEANUP=0` when investigating a failed finalization or file check and you want to inspect the generated artifacts manually.

## Harness Checklist

Use a desktop-width browser first, then repeat at a narrow/mobile-ish width.

1. Shelf

- The rail renders without a blank screen.
- The rail shows the Saga brand signal and `Fandom Loresystem` in expanded mode.
- The Loredecks tab is present before the other runtime tabs.
- The Settings tab is present after the other runtime tabs.
- No rail button text, icon, metric, or status chip overlaps.

2. Loredecks Runtime Tab

- The drawer title reads `Loredecks`.
- The tab shows the static Library launcher card first, not an `Active Stack` section.
- `Smoke Test: Arlong Park` is available through the fullscreen Library.
- The tab shows the Library launcher card, not a dropdown/collapsible `Loredeck Library` list.
- The deck detail panel shows Custom/editable controls.
- `Save Metadata`, `Sync From Manifest`, `Attempt Fixing`, and zip-package export controls fit cleanly.
- Remaining collapsible sections, such as In-Progress Deck Maker Projects, have visible dropdown arrows.
- `Reset Window` from the SillyTavern extension menu restores the expected default open/closed section state, default tab, shelf mode, and safe position/size.

3. Fullscreen Loredeck Library

- Click `Open Loredeck Library`.
- The Library opens as a fullscreen two-column workbench.
- Left side shows searchable/filterable available Loredecks.
- Right side shows Active Stack with priority order, enable toggles, up/down controls, and remove controls.
- Selected deck details update when a Library card or stack card is clicked.
- Click selects one deck, Ctrl/Cmd-click toggles decks, and Shift-click selects a visible range.
- Selected count, Select Visible, Clear, and Export Selected controls are visible and fit the Library pane.
- Export Selected downloads one `.saga-loredeck.zip` package for the selected deck set rather than one whole-library file.
- Selecting a local `.saga-loredeck.zip` package from Import Deck opens the package preview and installs checked decks as Custom Loredecks.
- Custom/Generated decks expose `Delete Deck`; Bundled decks are protected from deletion.
- Create/import/duplicate/delete actions refresh the Library without requiring a manual `Refresh Library` click.
- Controls, chips, titles, and buttons match the runtime style and do not look oversized.

4. Zip Package Import Preview

- Click `Import Deck` and select a local `.saga-loredeck.zip` fixture.
- The modal title reads `Import Loredeck Package`.
- Package chips show installable deck count, Lorecard count, folder count, and selected zip filename.
- Duplicate package rows are unchecked by default when the content hash already exists.
- `Install Selected` and `Cancel` are visible and not clipped.
- Cancel closes the modal cleanly.

5. Pending Review

- The Custom deck detail panel shows `Pending Review Queue`.
- The seeded pending proposal is visible.
- Quality/risk/health-impact chips do not overlap.
- Accept/reject controls are visible and scoped to the pending change.

6. Pack Health Center

- Click `Open Pack Health Center`.
- The fullscreen Pack Health Center opens without a layout jump.
- Malformed tag issue details show `Queue Tag ID Review` for Custom/Generated decks and `Duplicate as Custom` for Bundled decks.
- Custom/Generated issue details show `Accept As-Is`, `Verify Fixed`, and `Attempt Fixing`; accepted groups get an `Accepted as-is` chip and drop out of Overview priority issues while remaining visible in the Issues tab.
- Repair workflow copy tells users to run Attempt Fixing, apply review choices or continue model batches when present, then rerun Refresh Scan.
- Overview, Issues, Coverage, Files, and Advanced behave like tabs.
- Severity cards show errors, warnings, suggestions, and checked counts.
- Priority issues use metadata chips for passive metadata and button styling for actions.
- Health categories and details remain scrollable without clipping.
- Bundled-deck repair guidance points users toward duplication or Custom repair paths.

7. Creator

- `Deck Maker` is visible on the Loredecks tab.
- `Open Deck Maker` opens the fullscreen Deck Maker surface.
- Fandom, Scope, Granularity, and Notes controls fit within the wizard.
- Granularity copy updates when the dropdown changes.
- Buttons, inputs, sliders, and tabs use the same runtime visual scale.

8. Settings And Theme Packs

- Open the Settings tab from the rail.
- Provider/API settings are in the runtime drawer, not only the old dropdown panel.
- Theme Pack surfaces render without clipped labels.
- Installed Theme Packs scroll when there are many bundled presets.
- Live Preview shows rail, card, buttons, inputs, status states, and focus ring.
- Metadata Chips color controls are visible and remain visually quieter than primary actions.
- Accessibility ratios are visible and advisory.
- Icon Set preview shows loaded/missing icon state.
- Color controls remain readable against the active theme.

9. Injection

- Open the Injection tab.
- Continuity and Lore injection controls render.
- High/Normal/Low relevance preview sections are visible.
- The seeded story-lore sample appears in the appropriate lore preview path when enabled.

## Real SillyTavern Checklist

After the harness pass, install or load the extension in SillyTavern and repeat the same workflow against the live extension.

Before treating a live pass as current-code validation, verify SillyTavern is serving the current workspace build:

- The served `/scripts/extensions/third-party/Saga/src/runtime/lore-panel.js` contains current workflow markers such as `refreshLoredeckSurfaces` and `Delete Deck`.
- The installed extension menu is reduced to the runtime handoff and `Reset Window`; the old API/model settings dropdown is absent.
- If those markers are missing, sync or reinstall the extension into the active SillyTavern user extension directory before capturing screenshots.
- If the direct `src/extension/settings.html` endpoint is current but the extension menu still shows old copy, restart SillyTavern or clear the extension template cache before treating branding text as validated.

Additional live checks:

- The extension initializes without console errors.
- The shelf launcher opens the runtime shelf.
- The runtime banner and minimized Saga mark fit their containers.
- API/provider settings retain saved values after reload.
- The old extension-menu API/model dropdown is absent.
- `hp-core` loads from `content/loredecks/hp-core/loredeck.json`.
- Canon preview/suggestion still routes through the active Loredeck stack.
- Prompt injection sync runs without throwing.
- Chat reload preserves the active Loredeck stack and Context state.
- Fullscreen windows render correctly with SillyTavern fonts, not just harness/browser defaults.
- No Loredeck Library, Health Center, Creator, Theme Pack, import/update, or delete action snaps the runtime drawer unexpectedly to the top.

## Screenshot Targets

Capture at least:

- Expanded shelf with Loredecks drawer.
- Fullscreen Loredeck Library with selected Custom deck details.
- Active Stack controls inside the Library.
- Custom Loredeck delete confirmation modal after clicking `Delete Deck`, canceled before deletion.
- Pack Health Center overview.
- Pack Health Center issue details.
- Zip package import preview modal.
- Pending Review Queue.
- Fullscreen Deck Maker wizard.
- Settings tab with provider controls.
- Theme Pack section with Live Preview and Installed Theme Packs.
- Injection tab with lore preview sections.
- Narrow-width Loredecks drawer.

Store screenshots under:

```text
assets/documentation/renders/saga-smoke/
```
