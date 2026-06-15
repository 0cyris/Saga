# Saga Lorecards Control Revision Plan

Status: implemented replacement contract for Accepted Lorecard controls. Saga is pre-alpha, so this replaces the old Active/Pin/Lore Automation toggle model in place instead of preserving compatibility scaffolding.

This plan resolves the current overlap between Active, Pin, Mute, relevance tiers, and per-card Lore Automation toggles. Accepted Lorecards should expose one compact control model per card:

```text
Desktop/tablet: Relevance dots | Mute toggle | Elevate toggle
Mobile: Relevance tap-cycle symbol | Mute toggle | double-tap/long-press gestures
```

The card should make three concepts visually and behaviorally distinct:

- Relevance is the card's base injection tier: Low, Normal, or High.
- Mute is a hard exclusion from prompt injection.
- Elevate is a temporary operator override that protects and directly injects the card.

## Goals

- Bring back the three relevance-tier dot buttons on each Accepted Lorecard.
- Replace the visible Active and Pin distinction with one status: Elevated.
- Remove the per-card Disable Lore Automation toggle button.
- Make Elevate the user-facing way to protect a card from Lore Automation.
- Ensure Elevated cards inject directly when High relevance is otherwise compressed.
- Restore every overridden field when elevation is disabled.

## Shared Control Contract

The shared model is the same on desktop and mobile:

- Relevance has three tiers: Low, Normal, High.
- Mute is a direct icon toggle.
- Elevate is a protected, direct-injection override.

Desktop and mobile must not share assumptions about visible controls. They share state helpers, relevance computation, mute/elevation behavior, automation protection, and injection behavior, but their card interaction layers are different.

## Desktop And Tablet Contract

Every desktop/tablet Accepted Lorecard card should contain these controls in the upper-right action cluster:

1. Relevance-tier combination button.
2. Mute icon toggle.
3. Elevate green toggle.

Visual order is fixed: the relevance dot combination button sits immediately to the left of Mute, and Mute sits immediately to the left of the green Elevate button.

The relevance-tier control uses the previous dot language:

| Tier | Visual | Meaning |
| --- | --- | --- |
| Low | 1 dot | Background lore. Lowest prompt priority and most compressible. |
| Normal | 2 dots | Useful lore. Standard prompt priority and compression behavior. |
| High | 3 dots in triangle configuration | Current/high-importance lore. Highest tier before elevation. |

The dots should behave as one segmented/combination button, not three unrelated text buttons. The selected tier is visually active. On elevated cards, the High dot state is selected because elevation temporarily overrides effective relevance to High.

The Mute control should be an icon toggle:

- Unmuted: microphone icon.
- Muted: microphone-slash icon.

Use the existing icon system if available; otherwise add the smallest local icon primitive needed for a microphone and microphone-slash state. This should read as an icon toggle, not a text button.

The Elevate control should use the current green glowing button language. The glow belongs to Elevated, not Active. Copy should use:

- `Elevate` for the action.
- `Elevated` for the active status.
- `Unelevate` or `Remove Elevation` for reversal.

## Mobile Card Contract

Every mobile Accepted Lorecard card should use the compact upper-right cluster:

1. Current relevance-tier symbol.
2. Mute icon toggle.

On mobile, the relevance symbol sits immediately to the left of the mic/mic-slash toggle. The green Elevate button is not required on the card face because mobile elevation is handled by double-tap.

The mobile relevance symbol is an explicit tap-cycle control:

- Low shows 1 dot.
- Normal shows 2 dots.
- High shows 3 dots in triangle configuration.
- Elevated shows the effective High 3-dot symbol plus the Elevated glow/status.

Tapping the relevance symbol rotates the stored base tier in this order:

Low -> Normal -> High -> Low

The relevance symbol is a real button, not a hidden card-body gesture. It must stop propagation so it does not trigger double-tap Elevate or long-press Edit. Elevated cards still show effective High; relevance changes are blocked until Elevation is removed.

The mobile Mute control remains explicit because Mute is a hard exclusion state and should not depend on hidden gestures.

On mobile, the glow/status still communicates Elevated even when the card face does not render the green Elevate button.

## Mobile Gesture Contract

Mobile cards use gestures to replace desktop button density. Gestures are mobile-only; desktop/tablet should keep explicit controls.

| Gesture | Action |
| --- | --- |
| Single tap | No action. |
| Double tap | Toggle Elevate / Remove Elevation. |
| Long press | Edit the Lorecard. |
| Tap relevance symbol | Rotate relevance tier: Low -> Normal -> High -> Low. |

Single tap intentionally does nothing. Mobile does not have room for tap-to-inspect on the card body, and accidental card taps should not mutate prompt behavior.

Double tap is the only card-body elevation gesture. It must show immediate feedback:

- Apply or remove the green Elevated glow.
- Show a brief toast with undo where practical.
- Do nothing if the double tap starts on the mic toggle or another explicit control.

Mobile relevance tier changes must not use horizontal swipes. Swiping felt slower and less intuitive than an explicit control, and it competes with scroll ownership in long lists.

## Mobile Gesture Feedback

Relevance taps should feel immediate and physical, not like a hidden setting changed silently.

When tapping raises relevance:

- The relevance symbol flashes the new tier.
- Dot geometry should appear to power up.
- A subtle green or warm pulse moves across the card.
- A short `Low`, `Normal`, or `High` label can pop near the relevance symbol and fade quickly.

When tapping wraps High back to Low:

- The relevance symbol flashes the new tier.
- Dot geometry should appear to power down.
- A cooler dimming pulse moves across the card.
- A short `Low`, `Normal`, or `High` label can pop near the relevance symbol and fade quickly.

Use animation as feedback, not decoration:

- Keep it under roughly 350ms.
- Do not shift layout.
- Respect reduced-motion settings by replacing sweeps with a brief opacity/color pulse.
- Use one animation per committed tier step.
- Optional haptic feedback may use a very short vibration where supported.

## Removed Controls

Remove these from Accepted Lorecard cards and detail panes:

- Activate / Deactivate.
- Pin / Unpin.
- Disable Lore Automation / Enable Lore Automation per-card toggle.

Users who want manual protection use Elevate. Users who want injection exclusion use Mute. Users who want normal priority tuning use the relevance dots.

Bulk actions should be revised the same way:

- Keep Mute / Unmute.
- Add Elevate / Remove Elevation if bulk elevation is useful.
- Remove Pin / Unpin.
- Do not expose bulk Disable Lore Automation as a primary Lorecards action.

## Elevated Behavior

Elevating a card is a temporary override, not a destructive rewrite of the card's authored relevance.

When a card is Elevated:

1. The card receives the green glow and an Elevated status.
2. Its effective relevance becomes High.
3. The relevance dot control shows the 3-dot High state selected.
4. Mute is temporarily cleared, with the previous mute state stored for restoration.
5. Lore Automation must not change the card.
6. The card must inject as direct, uncompressed text.
7. If High-relevance injection mode is compressed, the direct Elevated text is appended alongside the compressed High block.
8. If High-relevance injection mode is direct, the normal High direct block already carries the card and should not duplicate it unnecessarily.

When elevation is removed:

1. Restore the card's previous base relevance.
2. Restore the previous mute state unless the user explicitly muted the card while removing elevation.
3. Restore the previous per-card Lore Automation state.
4. Remove the Elevated glow/status.
5. Return injection behavior to the normal relevance-tier and compression rules.

## State Contract

Use an explicit elevation overlay so that reversal is reliable.

Target shape:

```js
loreSelection: {
  elevated: {
    [entryId]: {
      elevatedAt,
      previousRelevance,
      previousIsActive,
      previousMuted,
      previousLoreAutomation
    }
  },
  suppressedIds: []
}
```

Implementation details:

- `previousRelevance` stores the authored/base tier before elevation.
- `previousIsActive` is transitional only if current code still has `isActive`; the final product should not expose Active.
- `previousMuted` stores whether the card was muted before elevation temporarily cleared it.
- `previousLoreAutomation` stores enough of the per-card automation object to restore it exactly.
- Elevated state should be the source of truth for `isElevated`.
- Effective relevance should be computed from elevation first, then base relevance.
- Mute and Elevate are mutually exclusive. Elevate temporarily clears mute so the direct injection guarantee is real. Muting an Elevated card should remove elevation and leave the card muted.

Because Saga is pre-alpha, legacy `pinnedIds` and visible Active semantics should be removed or migrated in place during implementation. Do not carry both Pin and Elevate as user-facing concepts.

## Relevance Rules

Accepted Lorecards have a base relevance:

- Low.
- Normal.
- High.

Base relevance is edited by the dot control and saved on the card.

Effective relevance is:

```text
Elevated -> High
Muted -> excluded
Otherwise -> base relevance
```

If a user attempts to edit relevance while Elevated, prefer one of these behaviors:

1. Disable relevance edits with tooltip: `Remove Elevation to edit base relevance.`
2. Allow editing the stored base relevance while the displayed effective state remains High.

The safer first implementation is option 1 because it avoids hidden base-state changes.

## Lore Automation Rules

Remove the user-facing per-card Lore Automation toggle from cards. Elevate becomes the manual protection mechanism.

Lore Automation must skip Elevated cards for:

- Auto-Relevance promotion/demotion.
- Automation muting/unmuting.
- Automation elevation changes.
- Curation retirement or rewrite behavior.
- Any future automation-owned direct mutation.

Automation status should be inspectable in diagnostics, but the card action surface should not expose a separate automation toggle. If the UI needs an explanation, use a compact status chip or tooltip:

```text
Elevated: protected from Lore Automation.
```

## Injection And Compression Rules

Current lore injection groups entries by relevance tier and can inject each tier as direct or compressed. Elevation adds a direct bypass for protected cards.

High direct mode:

```text
## High-Relevance Lore
- Elevated card text
- Other high-relevance card text
```

High compressed mode:

```text
## High-Relevance Lore (Compressed)
...cached/model-compressed high lore...

## Elevated Lorecards
- Exact elevated card text
```

Rules:

- Elevated direct text should bypass compression.
- Elevated cards should appear before normal high cards when direct ordering matters.
- Elevated cards should not be dropped by High tier caps.
- If a compressed High cache already includes an Elevated card, appending the direct Elevated text is still acceptable. The direct duplicate is intentional because elevation means exact prompt presence.
- Injection Preview must show the appended Elevated section so the operator can verify it.
- Retrieval/injection audit should report `elevated_direct` or equivalent when a card is direct-injected because of elevation.

## UI Copy

Preferred labels:

- Relevance: `Low`, `Normal`, `High`.
- Status: `Elevated`.
- Action: `Elevate`.
- Removal action: `Unelevate` or `Remove Elevation`.
- Mute action: `Mute` / `Unmute`.

Avoid these visible labels in Lorecards after the revision:

- `Active`.
- `Active Set`.
- `Pin`.
- `Pinned`.
- `Activate`.
- `Deactivate`.
- `Disable Lore Automation`.

If an internal helper still uses those names during migration, it should not leak into user-facing copy.

## Implementation Outline

### Shared Work

1. Add elevation state helpers.
   - Read/write `loreSelection.elevated`.
   - Compute `isElevated`.
   - Compute effective relevance.
   - Store and restore prior relevance, mute, and automation state.

2. Add shared relevance helpers.
   - Read base relevance from the card.
   - Compute effective relevance from Elevated and Muted state.
   - Apply one-step relevance changes through helpers that desktop clicks and mobile relevance-button taps can call.

3. Update list filters and labels.
   - Replace `Pinned` filters/chips with `Elevated`.
   - Replace `Active Set` surfaces with High/Elevated language or remove the separate section when the unified workspace plan lands.
   - Keep `Muted` as its own filter/status.

4. Update automation.
   - Treat Elevated as an immutable manual override.
   - Remove card-level automation toggle UI.
   - Ensure automation audit records skipped Elevated entries.

5. Update injection.
   - Effective relevance feeds tier selection.
   - Elevated cards bypass compression.
   - High compressed preview and memo append direct Elevated text.
   - Injection audit explains elevated direct inclusion.

6. Update docs and walkthrough copy.
   - Replace Pin/Active language with Elevate/Relevance/Mute.
   - Update operator manuals, basic/advanced guides, and visual smoke expectations.

### Desktop And Tablet Work

1. Restore the relevance dot combination button in the card upper-right action row.
2. Add the microphone / microphone-slash mute icon toggle.
3. Convert the glowing green active button into the Elevate toggle.
4. Remove visible Pin and per-card Lore Automation buttons.
5. Keep desktop/tablet actions explicit; do not require gestures for relevance, mute, elevation, or edit.

### Mobile Work

1. Render only the compact upper-right card cluster:
   - Current relevance-tier symbol.
   - Mic/mic-slash mute toggle.

2. Add mobile card-body gestures:
   - Single tap does nothing.
   - Double tap toggles Elevate / Remove Elevation.
   - Long press opens the Lorecard editor.
   - Tapping the relevance symbol cycles Low -> Normal -> High -> Low.

3. Implement relevance tap handling:
   - Use a real button for the mobile relevance symbol.
   - Stop propagation so the relevance tap does not trigger card double-tap or long-press handlers.
   - Apply exactly one tier change per tap.
   - Do not use horizontal swipe, drag, or card-body movement to edit relevance.
   - Keep vertical scroll ownership on the page.
   - Block relevance edits while Elevated because Elevated temporarily owns the effective High tier.

4. Implement mobile feedback animations:
   - Power-up animation when the tap raises relevance.
   - Power-down animation when the tap wraps High back to Low.
   - Relevance-symbol flash and short tier label pop.
   - Reduced-motion fallback pulse.
   - Optional short haptic pulse where supported.

### Do Not Cross Wires

- Desktop/tablet must not rely on mobile gestures for core actions.
- Mobile must not require the desktop green Elevate button on the card face.
- Shared state helpers must not assume a specific visual control exists.
- Mobile tap and gesture code must call shared relevance/elevation helpers rather than duplicating state mutation.
- Desktop control handlers must call the same shared helpers so tests cover one behavior contract.

## Verification

### Shared Verification

- Relevance dots render on Accepted Lorecard cards.
- The selected dot reflects base relevance when normal and effective High when Elevated.
- Mute icon toggles between microphone and microphone-slash states.
- Elevate applies glow and Elevated status.
- Elevate stores previous relevance, mute state, and automation state.
- Unelevate restores previous relevance, mute state, and automation state.
- Lore Automation skips Elevated cards.
- Compressed High injection appends direct Elevated text.
- Direct High injection does not duplicate Elevated text unnecessarily.
- Elevated cards are not dropped by High tier caps.
- Injection Preview shows direct Elevated text when High mode is compressed.
- User-facing Lorecards copy no longer exposes Active, Active Set, Pin, Pinned, Activate, or Disable Lore Automation.

### Desktop And Tablet Verification

- Desktop/tablet cards render relevance dots, mic/mic-slash Mute, and green Elevate in that order.
- Desktop/tablet relevance dots change tiers through explicit click/tap controls.
- Desktop/tablet green Elevate toggles Elevated state without requiring double tap.
- Desktop/tablet cards do not expose Pin or per-card Disable Lore Automation controls.

### Mobile Verification

- Mobile Accepted Lorecards render only the compact relevance symbol plus mic/mic-slash control in the upper-right card cluster.
- Mobile single tap on a Lorecard body does not mutate state.
- Mobile double tap toggles Elevate and Remove Elevation.
- Mobile long press opens the Lorecard editor.
- Mobile tapping the relevance symbol cycles Low -> Normal -> High -> Low, one tier per tap.
- Mobile horizontal swipes do not change relevance.
- Mobile vertical scroll does not trigger relevance changes.
- Mobile relevance-symbol feedback fires on committed tier changes.
- Mobile power-up and power-down card animations do not shift layout.
- Mobile reduced-motion mode replaces sweep animations with a brief pulse.

Broad gates:

- `node tools/scripts/test-visual-smoke-harness.mjs`
- `node tools/scripts/test-lore-automation-levels.mjs`
- `node tools/scripts/test-prompt-compression-contract.mjs`
- `node tools/scripts/run-alpha-gate.mjs`

Rendered checks should include desktop and mobile card rows because the upper-right control cluster is dense and must not wrap badly at phone width.
