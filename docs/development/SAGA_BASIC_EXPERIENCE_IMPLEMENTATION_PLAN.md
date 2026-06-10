# Saga Basic Experience Implementation Plan

This feature plan implements the first concrete slice of [Saga Basic And Advanced Experience Modes Plan](SAGA_EXPERIENCE_MODES_PLAN.md): Basic Experience should hide the dedicated Injection tab, keep the core workflow small, and show only enough prompt-status information for a new user to trust that accepted Lorecards are ready for the next response.

## Feature Goal

Basic Experience should feel like:

```text
Start -> Loredecks -> Context -> Review -> Settings
```

Advanced Experience should remain:

```text
Loredecks -> Session -> Context -> Continuity -> Lorecards -> Injection -> Settings
```

Basic users should not need a separate Prompt or Injection tab. They should see a compact selected-lore summary in Start and Review, with a clear path to switch to Advanced when they want the full Injection Preview, placement controls, compression, or tier tuning.

## Starting Code State

Relevant implementation points when this feature slice started:

- `runtime-navigation.js`
  - `BASIC_EXPERIENCE_TABS` currently includes `injection`.
  - `TAB_LABELS` uses Advanced-facing names such as `Session`, `Lorecards`, and `Injection`.
  - `normalizeTabForExperience()` already routes hidden tabs back to `session`, so removing `injection` from Basic has a natural fallback path.

- `runtime-guide-content.js`
  - Basic guide steps currently include Injection targets:
    - `injection.loreToggle`
    - `injection.tier.high`
    - `injection.tier.normal`
    - `injection.tier.low`
  - These would become hidden-target walkthrough steps after the tab is removed.

- `lore-panel.js`
  - Header and Session Metrics already compute selected lore through `getSelectedLoreInjectionCount()`.
  - Session Metrics already compute character/token estimates through `getInjectionCharacterStats()`.
  - `renderBasicInjectionTab()` provided the simplified Injection tab. This should become Advanced-only or be retired after its useful summary pieces are moved into Start/Review.
  - `renderSessionTab()` already shows metrics, but the current copy is diagnostic, not a new-user readiness card.

- `scripts/test-visual-smoke-harness.mjs`
  - The harness already checks runtime navigation and major surface strings.
  - It should gain assertions for Basic hidden tabs and Advanced visible tabs.

## Progress To Date

- Basic navigation now exposes Start, Loredecks, Context, Review, and Settings while hiding Continuity and Injection.
- Basic guide steps now stay inside visible Basic tabs and follow the five-step first-run flow.
- Basic Start now has readiness and selected-lore summary cards backed by shared helper modules.
- Basic Review now foregrounds the review decision, keeps manual Lorecard creation available, hides prompt-engineering controls, and adds an Advanced Injection handoff.
- The dedicated Basic Injection tab implementation has been retired.
- Basic Context now uses story-position copy, prioritizes Browse Story Waypoints, presents uncertain detection as suggestions, and hides Advanced Context diagnostics while Advanced retains the full Context surface.
- Basic Loredecks now starts with Active Stack, uses Add Loredeck as the main Basic action, and presents plain stack readiness labels while keeping import/create secondary.
- Basic Settings now exposes Provider Quick Setup, Appearance, Experience Mode, and Reset Layout while keeping full provider/theme internals in Advanced.
- Starter Basic, Advanced, and Wandlight-to-Saga user workflow docs are in place.

## UX Contract

### Basic Visible Tabs

Basic must show only:

- `loredecks`
- `session`, presented as **Start**
- `context`
- `lore`, presented as **Review**
- `settings`

Basic must hide:

- `continuity`
- `injection`

If Basic mode opens while the saved active tab is hidden, Saga should land on Start.

### Advanced Visible Tabs

Advanced must continue to show every runtime tab:

- `loredecks`
- `session`
- `context`
- `continuity`
- `lore`
- `injection`
- `settings`

Advanced should keep existing labels unless a later broader UI pass renames them.

### Basic Selected-Lore Summary

Basic should show a compact summary in Start and Review:

- Lore injection on/off.
- Accepted Lorecards selected for the next prompt.
- Estimated injected lore tokens or a simple "empty" state.
- Context-blocked, muted, or disabled-tier warning if cheaply available.
- Action: **Open Advanced Injection** or **Switch to Advanced**.

The summary should not show:

- Prompt role.
- Prompt position.
- Depth.
- Direct/compressed handling controls.
- Compression prompt templates.
- Full injected text.
- High/Normal/Low tier tuning.

### Basic Readiness Copy

Use plain action labels:

- Choose Loredeck.
- Set Context.
- Review Lorecards.
- Continue roleplay.
- Switch to Advanced.

Avoid Basic-first labels such as:

- Prompt placement.
- Compression depth.
- Injection transport.
- Context-native eligibility.
- Similarity routing.

## Implementation Phases

### Phase 1: Navigation Contract

Files:

- `runtime-navigation.js`
- `lore-panel.js`

Tasks:

1. Remove `injection` from `BASIC_EXPERIENCE_TABS`.
2. Keep `continuity` hidden in Basic.
3. Add mode-aware display labels if feasible:
   - `session` -> `Start` in Basic.
   - `lore` -> `Review` in Basic.
   - Advanced labels stay unchanged.
4. Replace direct `TAB_LABELS[tab]` reads in rail/drawer rendering with a helper such as `getTabLabelForExperience(tab, settings)`.
5. Keep `normalizeTabForExperience()` as the authority for hidden-tab fallback.
6. Verify switching from Advanced `injection` to Basic lands on `session`.

Acceptance:

- Basic rail has no Injection tab.
- Advanced rail still has Injection.
- A saved Basic active tab of `injection` normalizes to `session`.

### Phase 2: Basic Guide Cleanup

Files:

- `runtime-guide-content.js`
- `lore-panel.js`

Tasks:

1. Replace the current Basic guide with the five-step flow:
   - Saga Active.
   - Choose Loredeck.
   - Set Context.
   - Review Lorecards.
   - Continue and update.
2. Remove all Basic guide steps targeting hidden tabs.
3. Keep Advanced guide Injection steps unchanged.
4. Add a validation helper or test assertion that every Basic guide step targets a Basic-visible tab.

Acceptance:

- Basic walkthrough never navigates to `injection`.
- Advanced walkthrough can still navigate to `injection`.

### Phase 3: Start Readiness Card

Files:

- `lore-panel.js`
- `style.css`

Tasks:

1. Add a Basic-only readiness card near the top of `renderSessionTab()`.
2. Derive readiness from existing state:
   - Saga active from `settings.enabled`.
   - Loredeck loaded from active stack state.
   - Context set from loaded Loredeck Context rows.
   - Review needed from pending entries or suggestions.
   - Lore selected from `getSelectedLoreInjectionCount()`.
   - Provider configured from existing provider readiness helpers.
3. Show one recommended next action.
4. Keep current Session Metrics available but visually secondary in Basic.
5. Do not add any automatic action.

Acceptance:

- Empty Basic install points to Choose Loredeck.
- Loaded deck without Context points to Set Context.
- Context with suggested/pending cards points to Review Lorecards.
- Accepted selected lore points to Continue roleplay.

### Phase 4: Basic Injection Summary Component

Files:

- `lore-panel.js`
- `style.css`

Tasks:

1. Create a shared component, for example `createBasicInjectionSummaryCard(state, settings, options)`.
2. Use existing helpers:
   - `getSelectedLoreInjectionCount(state, settings)`
   - `getInjectionCharacterStats(state, settings)`
   - `getPanelLoreState(state).counts`
3. Include status states:
   - Lore injection disabled.
   - No accepted Lorecards selected.
   - Accepted Lorecards selected.
   - Token estimate available.
   - Full preview available in Advanced.
4. Add the card to Basic Start.
5. Add a compact version to Basic Review near accepted Lorecards.
6. Add an Advanced handoff action:
   - Switch to Advanced.
   - Set active tab to `injection`.
   - Re-render the panel.

Acceptance:

- Basic users can see whether accepted Lorecards are selected without opening Injection.
- Basic users have a one-click path to Advanced Injection.
- No placement, compression, or tier controls appear in Basic.

### Phase 5: Review Tab Simplification

Files:

- `lore-panel.js`
- `runtime-guide-content.js`

Tasks:

1. Keep suggested, pending, and accepted Lorecards visible in Basic.
2. Add the compact injection summary where it helps users understand accepted Lorecards have an effect.
3. Hide or collapse metadata-heavy workbench and bulk controls when Basic presentation can do so safely.
4. Keep single-card accept, dismiss, edit, pin, mute, and relevance controls if currently needed for the existing review flow.
5. Route deeper management and large-list workbenches to Advanced.

Acceptance:

- Basic Review answers "Should this fact affect future responses?"
- Basic Review does not become a prompt-engineering surface.

### Phase 6: Retire Or Re-scope `renderBasicInjectionTab()`

Files:

- `lore-panel.js`

Tasks:

1. After Basic no longer routes to `injection`, decide whether `renderBasicInjectionTab()` should:
   - be removed, or
   - be renamed as a shared summary helper, or
   - remain only as dead-safe fallback during transition.
2. Prefer removal or extraction because the current function name will become misleading.
3. Keep `renderAdvancedInjectionTab()` and all Advanced injection controls intact.

Acceptance:

- No Basic route renders a dedicated Injection tab.
- No misleading `Basic Injection Tab` implementation remains unless explicitly documented as transitional.

### Phase 7: Basic Context Surface Cleanup

Files:

- `lore-panel.js`
- `context-panel.js`
- `scripts/test-visual-smoke-harness.mjs`

Tasks:

1. Keep loaded Loredeck Context rows visible in Basic.
2. Use "story position" language where the Basic Context header, command center, row actions, and status text need plain wording.
3. Make **Browse Story Waypoints** the Basic primary action and keep **Detect Context** secondary.
4. Present uncertain Context output as **suggestions** in Basic.
5. Hide Advanced Context Brief, resolver actions, audit panels, manual-lock controls, timeline shortcuts, and confidence/candidate details in Basic.
6. Preserve Advanced Context Brief, resolver actions, audit panels, manual locks, timeline shortcuts, and diagnostic copy in Advanced.
7. Add smoke-harness contracts that prevent Advanced Context diagnostics from returning to Basic.

Acceptance:

- Basic Context does not show Advanced Context Brief.
- Advanced Context keeps the Advanced Context Brief section.
- Basic Context copy points users toward choosing story position.
- Basic Context exposes Browse Story Waypoints as the primary path.
- Basic Context suggestions remain reviewable before use.
- Basic Context does not show direct resolver, audit, manual-lock, confidence, or candidate controls.

### Phase 8: Basic Loredecks Loading Surface

Files:

- `loredecks-tab-panel.js`
- `lore-panel.js`
- `style.css`
- `docs/user/BASIC_WORKFLOW.md`
- `scripts/test-visual-smoke-harness.mjs`

Tasks:

1. Show Active Stack before the Library launch in Basic.
2. Rename the Basic loading action to **Add Loredeck** while still opening the existing Library manager.
3. Use plain Basic readiness labels: **Ready**, **Needs review**, and **Not checked**.
4. Keep full Library management, import, Creator, details, folders, and Pack Health reachable but visually secondary in Basic.
5. Leave Advanced Loredecks unchanged.

Acceptance:

- Basic Loredecks opens with Active Stack.
- Basic Loredecks exposes Add Loredeck as the primary action.
- Basic Loredecks does not require users to choose between Bundled, Generated, and Custom as the first decision.
- Basic Loredecks uses plain readiness labels instead of diagnostic health counts as the first signal.
- Import and Creator remain reachable as an advanced path.

### Phase 9: Basic Settings Setup Surface

Files:

- `lore-panel.js`
- `settings-panel.js`
- `style.css`
- `scripts/test-visual-smoke-harness.mjs`

Tasks:

1. Render a Basic-only Settings branch with:
   - **Provider Quick Setup**.
   - **Appearance**.
   - **Experience Mode**.
2. In Provider Quick Setup:
   - Show Utility and Reasoning provider readiness.
   - Expose **Test Utility** and **Test Reasoning**.
   - Allow a quick fallback to the current SillyTavern model.
   - Hand off profile, endpoint, model, generation, and compatibility controls to Advanced.
3. In Appearance:
   - Let Basic users choose a Theme Pack.
   - Show simple color swatches as a visual confirmation.
   - Keep import, export, icon sets, color overrides, and raw JSON in Advanced.
4. In Experience Mode:
   - Show the existing Basic/Advanced switch.
   - Expose **Reset Layout**.
5. Preserve the Advanced settings tab unchanged.

Acceptance:

- Basic Settings exposes Provider Quick Setup, Appearance, Experience Mode, and Reset Layout.
- Basic Settings does not expose provider profile internals, generation parameters, API compatibility flags, or raw Theme Pack controls.
- Advanced Settings still exposes the full Providers and Theme Pack surfaces.
- Basic provider setup remains optional until a model-backed action needs it.

### Phase 10: Tests And Smoke Coverage

Files:

- `scripts/test-visual-smoke-harness.mjs`
- `tests/visual-smoke.html`
- `README.md`
- `docs/user/BASIC_WORKFLOW.md`
- `docs/user/ADVANCED_WORKFLOW.md`
- `docs/user/WANDLIGHT_TO_SAGA.md`
- possible new focused test script for navigation helpers

Add checks:

1. `BASIC_EXPERIENCE_TABS` does not include `injection`.
2. `BASIC_EXPERIENCE_TABS` does not include `continuity`.
3. `ADVANCED_EXPERIENCE_TABS` includes `injection`.
4. Basic guide step tabs are all Basic-visible.
5. Advanced guide still includes at least one Injection step.
6. Saved `activeTab: 'injection'` in Basic normalizes to `session`.
7. Visual smoke can open Basic mode and verify no rail Injection tab.
8. Visual smoke can switch to Advanced and verify rail Injection tab returns.
9. Basic Start/Review contains selected-lore summary text.
10. Basic Context hides Advanced Context Brief and other Advanced Context diagnostics.
11. Basic Context prioritizes Browse Story Waypoints and presents proposals as suggestions.
12. Basic Loredecks shows Active Stack before Add Loredeck.
13. Basic Loredecks uses Add Loredeck and plain readiness labels.
14. Basic Settings exposes Provider Quick Setup, Appearance, Experience Mode, and Reset Layout.
15. Basic Settings keeps provider/theme internals behind Advanced.

Recommended commands:

```powershell
node --check runtime-navigation.js
node --check runtime-experience-mode.js
node --check runtime-guide-content.js
node --check lore-panel.js
node --check loredecks-tab-panel.js
node --check context-panel.js
node --check settings-panel.js
node --check scripts\test-visual-smoke-harness.mjs
node --check scripts\test-basic-readiness.mjs
node --check scripts\test-experience-modes.mjs
node scripts\test-basic-readiness.mjs
node scripts\test-experience-modes.mjs
node scripts\test-visual-smoke-harness.mjs
node scripts\serve-visual-smoke.mjs --check --port 0
```

Optional after implementation:

```powershell
node scripts\serve-visual-smoke.mjs
```

Then inspect:

```text
http://127.0.0.1:8765/tests/visual-smoke.html?mode=basic
http://127.0.0.1:8765/tests/visual-smoke.html?mode=advanced&tab=injection
```

## Out Of Scope For This Slice

- Full Basic Loredeck curated-combination picker.
- Full Basic Start redesign beyond readiness and selected-lore status.
- Continuity simplification.
- Full provider setup redesign beyond quick status, testing, and Advanced handoff.
- Loredeck Creator UX changes.
- Deck Health redesign.
- Import/export simplification.
- Full release-facing documentation beyond the starter Basic, Advanced, and Wandlight-to-Saga workflow pages.

Those are part of the broader experience-mode plan, but this feature slice should stay focused enough to land and verify quickly.

## Risks

- Hiding Injection may make Basic users less aware that accepted Lorecards affect prompts.
  - Mitigation: selected-lore summary appears in Start and Review.

- Basic guide steps may silently target hidden controls.
  - Mitigation: add a test that guide step tabs are visible for the selected mode.

- Advanced users may lose their selected Injection tab when toggling modes.
  - Mitigation: preserve Advanced settings backup and route Basic hidden tabs to Start only while Basic is active.

- Existing visual smoke assumptions may expect Injection in the rail.
  - Mitigation: update smoke checks to be mode-aware.

## Done Definition

This feature is done when:

- Basic mode rail hides Injection and Continuity.
- Basic mode has selected-lore status in Start and Review.
- Basic walkthrough targets only visible Basic tabs.
- Basic Settings exposes provider quick setup, appearance, experience mode, and reset layout without showing advanced provider/theme internals.
- Advanced mode still exposes the full Injection tab and existing controls.
- Switching modes preserves saved stack, Context, pending Lorecards, accepted Lorecards, and backed-up managed settings.
- README and starter user docs point new users to the Basic workflow first.
- Local syntax checks and visual smoke harness pass.
