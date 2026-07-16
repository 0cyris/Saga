# Global Runtime Window State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Saga runtime-window visibility as one global extension setting and restore it on startup and refresh.

**Architecture:** `runtimeWindowOpen` belongs in `DEFAULT_SETTINGS`, which is persisted in SillyTavern's extension-settings bucket. `showLorePanel()` and `hideLorePanel()` update that authority while maintaining chat-local `lorePanel.isOpen` as the existing renderer's mirror. Settings mount restores the global value only.

**Tech Stack:** Vanilla JavaScript ES modules, Node static contract harnesses, SillyTavern extension settings.

## Global Constraints

- New Saga installs default the runtime window to closed.
- Visibility is global across chats and is persisted through Saga extension settings.
- Reset Window preserves the current global visibility choice.
- Do not retain legacy visibility behavior for previous chat state; pre-alpha Saga updates in place.

---

### Task 1: Prove and implement the global visibility contract

**Files:**
- Modify: `tools/scripts/test-visual-smoke-harness.mjs:1411-1414`
- Modify: `src/state/default-settings.js`
- Modify: `src/extension/settings-mount.js:78-82`
- Modify: `src/runtime/lore-panel.js:1534-1591`

**Interfaces:**
- Consumes: `getSettings(): SagaSettings` and `saveSettings(settings): void` from `src/state/state-manager.js`.
- Produces: `SagaSettings.runtimeWindowOpen: boolean` as the sole persisted visibility authority.

- [ ] **Step 1: Write the failing static contract assertions**

```js
assert(defaultSettings.includes('runtimeWindowOpen: false'), 'Fresh Saga installs must default the global runtime window setting to closed.');
assert(settingsMount.includes("if (getSettings().runtimeWindowOpen === true)"), 'Startup must restore visibility from the global runtime-window setting.');
assert(!settingsMount.includes('state?.lorePanel?.isOpen === true'), 'Startup must not restore runtime visibility from chat-scoped panel state.');
assert(runtimePanelSource.includes('settings.runtimeWindowOpen = true;') && runtimePanelSource.includes('settings.runtimeWindowOpen = false;'), 'Runtime open and close actions must persist the global visibility setting.');
```

- [ ] **Step 2: Run the contract harness and verify it fails**

Run: `node tools/scripts/test-visual-smoke-harness.mjs`

Expected: failure stating that the global runtime-window default or persistence path is missing.

- [ ] **Step 3: Implement the smallest global-setting change**

```js
// src/state/default-settings.js
runtimeWindowOpen: false,

// src/extension/settings-mount.js
if (getSettings().runtimeWindowOpen === true) {
    runRuntimeAction('runtime.show');
}

// src/runtime/lore-panel.js
const settings = getSettings();
settings.runtimeWindowOpen = true; // showLorePanel
saveSettings(settings);

const settings = getSettings();
settings.runtimeWindowOpen = false; // hideLorePanel
saveSettings(settings);
```

Leave `state.lorePanel.isOpen` updates intact as the per-chat renderer mirror. Do not alter `resetLorePanelLayout()`, because it delegates only layout reset and must not write `runtimeWindowOpen`.

- [ ] **Step 4: Run the contract harness and verify it passes**

Run: `node tools/scripts/test-visual-smoke-harness.mjs`

Expected: `Visual smoke harness passed.`

- [ ] **Step 5: Commit the tested implementation**

```bash
git add src/state/default-settings.js src/extension/settings-mount.js src/runtime/lore-panel.js tools/scripts/test-visual-smoke-harness.mjs
git commit -m "fix(runtime): persist global window visibility"
```
