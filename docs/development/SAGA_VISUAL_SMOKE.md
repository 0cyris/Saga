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

## Repo-Local Context Screenshot Helper

Run the current-code Context smoke without depending on the installed SillyTavern extension copy:

```powershell
$env:SAGA_SMOKE_TARGET='context-harness'
node tools\scripts\smoke-live-st-cdp.mjs
```

This starts the local harness, opens the Context tab with seeded Reasoner proposals, captures:

```text
assets/documentation/renders/saga-smoke/context-harness-01-proposal-review.png
assets/documentation/renders/saga-smoke/context-harness-02-workbench.png
```

It verifies the Runtime Context command center, proposal review overlay, proposal apply flow, loaded Loredeck Context rows, lock state, and Context Workbench tabs.

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

It verifies Basic module cards, Advanced task-track cards, hidden Basic rail tabs, Advanced rail availability, focused module starts, prepared fullscreen Library targeting, no-object Creator fallback messaging, and the first full-tour popover for both walkthroughs.

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
- `Active Stack` shows at least two loaded decks.
- `Smoke Test: Arlong Park` is the selected Custom deck.
- The tab shows the Library launcher card, not a second inline `Loredeck Library` dropdown/list.
- The deck detail panel shows Custom/editable controls.
- `Save Metadata`, `Sync From Manifest`, `Repair Safe Issues`, and zip-package export controls fit cleanly.
- Collapsible sections have visible dropdown arrows.
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

6. Deck Health Center

- Click `Open Health Center` or `Health Report`.
- The fullscreen Deck Health Center opens without a layout jump.
- Malformed tag issue details show `Queue Tag ID Repair` for Custom/Generated decks and `Duplicate as Custom` for Bundled decks.
- Custom/Generated issue details show `Ignore Issue`, `Mark Resolved`, and `Draft With Assistant`; ignored groups get an `Ignored` chip and drop out of Overview priority issues while remaining visible in the Issues tab.
- Repair workflow copy tells users to queue/draft repairs, review Pending Review, accept changes, then rerun Refresh Scan.
- Overview, Issues, Coverage, Files, and Advanced behave like tabs.
- Severity cards show errors, warnings, suggestions, and checked counts.
- Priority issues use metadata chips for passive metadata and button styling for actions.
- Health categories and details remain scrollable without clipping.
- Bundled-deck repair guidance points users toward duplication or Custom repair paths.

7. Creator

- `Loredeck Creator` is visible on the Loredecks tab.
- `Open Creator Wizard` opens the fullscreen Creator surface.
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
- Deck Health Center overview.
- Deck Health Center issue details.
- Zip package import preview modal.
- Pending Review Queue.
- Fullscreen Loredeck Creator wizard.
- Settings tab with provider controls.
- Theme Pack section with Live Preview and Installed Theme Packs.
- Injection tab with lore preview sections.
- Narrow-width Loredecks drawer.

Store screenshots under:

```text
assets/documentation/renders/saga-smoke/
```
