# Saga Visual Smoke Runbook

This runbook covers the first visual smoke pass for Saga's runtime shelf and Loredeck workflows.

## Local Harness

The local harness renders the real `lore-panel.js` runtime shelf with a stubbed SillyTavern context. It is useful before testing inside a full SillyTavern install.

Start the no-dependency local server:

```powershell
node scripts\serve-visual-smoke.mjs
```

Open the printed URL:

```text
http://127.0.0.1:8765/tests/visual-smoke.html
```

The harness seeds:

- Expanded Saga shelf with the Loredecks tab open.
- A Custom Loredeck named `Smoke Test: Arlong Park`.
- A loaded Loredeck stack with the Custom deck above `hp-golden-trio`.
- Embedded schema v3 Lorecards.
- A Pending Review proposal on the Custom deck.
- A local update-source fixture for `Check Updates`.
- A story-lore and pending-lore sample for the Lore and Injection tabs.

## Quick Contract Check

Run:

```powershell
node scripts\test-visual-smoke-harness.mjs
node scripts\serve-visual-smoke.mjs --check --port 0
```

These checks do not replace a browser screenshot pass. They only verify that the harness, fixture, source hooks, and CSS hooks are still wired.

## Harness Checklist

Use a desktop-width browser first, then repeat at a narrow/mobile-ish width.

1. Shelf

- The rail renders without a blank screen.
- The rail shows the Saga brand signal and `Fandom Loresystem` in expanded mode.
- The Loredecks tab is present before the other runtime tabs.
- The Settings tab is present after the other runtime tabs.
- No rail button text, icon, metric, or status chip overlaps.

2. Loredecks

- The drawer title reads `Loredecks`.
- `Active Stack` shows at least two loaded decks.
- `Smoke Test: Arlong Park` is the selected Custom deck.
- The deck detail panel shows Custom/editable controls.
- `Check Updates`, `Save Metadata`, `Sync From Manifest`, `Repair Safe Issues`, and export controls fit cleanly.

3. Update Preview

- Click `Check Updates`.
- The modal title reads `Loredeck Update Preview`.
- The preview shows target/original ID, version, content hash, update URL, and duplicate review.
- A locally modified warning is visible.
- `Update This Deck`, `Install As New Copy`, and `Cancel` are visible and not clipped.
- Cancel closes the modal cleanly.

4. Pending Review

- The Custom deck detail panel shows `Pending Review Queue`.
- The seeded pending proposal is visible.
- Quality/risk/health-impact chips do not overlap.
- Accept/reject controls are visible and scoped to the pending change.

5. Creator

- `Loredeck Creator` is visible on the Loredecks tab.
- Fandom, Scope, Granularity, and Notes controls fit within the card.
- The action row is usable at desktop and narrow widths.

6. Settings

- Open the Settings tab from the rail.
- Provider/API settings are in the runtime drawer, not only the old dropdown panel.
- Theme controls and Theme Pack surfaces render without clipped labels.
- Color controls remain readable against the active theme.

7. Injection

- Open the Injection tab.
- Continuity and Lore injection controls render.
- High/Normal/Low relevance preview sections are visible.
- The seeded story-lore sample appears in the appropriate lore preview path when enabled.

## Real SillyTavern Checklist

After the harness pass, install or load the extension in SillyTavern and repeat the same workflow against the live extension.

Additional live checks:

- The extension initializes without console errors.
- The shelf launcher opens the runtime shelf.
- API/provider settings retain saved values after reload.
- `hp-golden-trio` loads from `Lorepacks/hp-golden-trio/lorepack.json`.
- Canon preview/suggestion still routes through the active Loredeck stack.
- Prompt injection sync runs without throwing.
- Chat reload preserves the active Loredeck stack and Story Position state.

## Screenshot Targets

Capture at least:

- Expanded shelf with Loredecks drawer.
- Loredeck detail for the seeded Custom deck.
- Update preview modal after `Check Updates`.
- Pending Review Queue.
- Loredeck Creator card.
- Settings tab with provider and theme controls.
- Injection tab with lore preview sections.
- Narrow-width Loredecks drawer.

Store screenshots under:

```text
Images/documentation/renders/saga-smoke/
```
