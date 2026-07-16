# Global Runtime Window State

## Goal

Saga's runtime window must remain closed on SillyTavern startup and page refresh unless the user last left it open. The choice applies globally across all chats, matching SillyTavern extension conventions.

## Scope

- Add a global extension setting named `runtimeWindowOpen`, defaulting to `false`.
- Make startup restoration read that setting instead of the active chat's `lorePanel.isOpen` value.
- Make runtime open and close actions write the global setting immediately.
- Keep `lorePanel.isOpen` as a per-chat render-time mirror so existing panel rendering and refresh paths remain stable.
- Preserve the current open/closed choice when Reset Window resets geometry and panel layout.

## Design

`DEFAULT_SETTINGS` gains `runtimeWindowOpen: false`. The settings store already deep-merges global Saga settings with defaults, so existing installations without this key safely begin closed after updating.

`showLorePanel()` sets `runtimeWindowOpen` to `true` and saves settings before continuing to update the active chat's `lorePanel.isOpen` render mirror. `hideLorePanel()` similarly writes `false` while retaining its existing cleanup and mirror update.

During settings mount, Saga consults `runtimeWindowOpen`: it opens the runtime only when that global value is true. This prevents a prior chat's persisted `lorePanel.isOpen` state from reopening the window after startup, refresh, or a chat switch.

## Data flow

1. User opens or closes Saga's runtime window.
2. Saga persists the global boolean in extension settings.
3. Saga updates the active chat mirror for its existing renderer.
4. On startup or refresh, Saga reads the global boolean and opens only when it is true.

## Error handling and migration

No explicit migration is needed: a missing global key resolves to `false`. A settings write failure follows the existing Saga settings-store behavior; the current in-memory window action still completes for the page session.

## Tests

Add a focused static/runtime contract test that verifies:

- the global default is closed;
- mounting reads the global setting rather than chat-scoped `isOpen`;
- open and close write the global setting; and
- Reset Window does not overwrite global visibility.

Run the new test and the existing visual smoke harness, whose current assertion expects a fresh runtime shelf to open and will be updated to the new closed-by-default contract.
