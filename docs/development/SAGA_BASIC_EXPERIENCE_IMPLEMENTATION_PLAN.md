# Saga Basic Experience Implementation Plan

This feature plan implements the first concrete slice of [Saga Basic And Advanced Experience Modes Plan](SAGA_EXPERIENCE_MODES_PLAN.md): Basic Experience should hide the dedicated Injection tab, keep the core workflow small, and show only enough prompt-status information for a new user to trust that accepted Lorecards are ready for the next response.

## Feature Goal

Basic Experience should feel like:

```text
Session -> Loredecks -> Context -> Lorecards -> Settings
```

Advanced Experience should remain:

```text
Loredecks -> Session -> Context -> Continuity -> Lorecards -> Injection -> Settings
```

Basic users should not need a separate Prompt or Injection tab. They should use the Start Checklist for readiness and switch to Advanced when they want the full Injection Preview, placement controls, compression, or tier tuning.

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

- `src/runtime/lore-panel.js`
  - Header and Session Metrics already compute selected lore through `getSelectedLoreInjectionCount()`.
  - Session Metrics already compute character/token estimates through `getInjectionCharacterStats()`.
  - `renderBasicInjectionTab()` provided the simplified Injection tab. This should become Advanced-only or be retired after its useful summary pieces are moved into Lorecards.
  - `renderSessionTab()` already shows metrics, but the current copy is diagnostic, not a new-user readiness card.

- `tools/scripts/test-visual-smoke-harness.mjs`
  - The harness already checks runtime navigation and major surface strings.
  - It should gain assertions for Basic hidden tabs and Advanced visible tabs.

## Progress To Date

- Basic navigation now exposes Session, Loredecks, Context, Lorecards, and Settings while hiding Continuity and Injection.
- Basic guide steps now stay inside visible Basic tabs and follow the sectioned Alpha walkthrough: Loredecks, Session, Context, Lorecards, and Settings.
- Basic Session now has an expanded-by-default Start Checklist dropdown backed by the shared readiness model.
- Basic Lorecards now uses the shared Lorecard Generation, Pending Lorecard Review, and Accepted Lorecards sections while hiding prompt-engineering controls and adding an Advanced Injection handoff.
- The dedicated Basic Injection tab implementation has been retired.
- Basic Context now keeps shared Context labels while hiding Advanced Context diagnostics.
- Basic Loredecks now reuses the shared Loredeck Library loading section, keeps Import Deck visible, and hides Create Deck plus In-Progress Deck Maker Projects behind Advanced.
- Basic Settings now keeps Providers simplified while rendering the full shared Theme Pack section.
- Starter Basic and Advanced user workflow docs are in place.

## UX Contract

### Basic Visible Tabs

Basic must show only:

- `loredecks`
- `session`, presented as **Session**
- `context`
- `lore`, presented as **Lorecards**
- `settings`

Basic must hide:

- `continuity`
- `injection`

If Basic mode opens while the saved active tab is hidden, Saga should land on Session.

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

### Basic Injection Visibility

Basic should not show a dedicated selected-lore or prompt-status summary section. The Start Checklist owns readiness, Lorecards owns review and acceptance, and Advanced Injection owns exact prompt inspection.

### Basic Readiness Copy

Use plain action labels:

- Open Library.
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
- `src/runtime/lore-panel.js`

Tasks:

1. Remove `injection` from `BASIC_EXPERIENCE_TABS`.
2. Keep `continuity` hidden in Basic.
3. Keep shared display labels in both modes:
   - `session` remains **Session** in Basic.
   - `lore` remains **Lorecards** in Basic.
   - Basic must not teach alternate tab names.
4. Replace direct `TAB_LABELS[tab]` reads in rail/drawer rendering with a helper such as `getTabLabelForExperience(tab, settings)`.
5. Keep `normalizeTabForExperience()` as the authority for hidden-tab fallback.
6. Verify switching from Advanced `injection` to Basic lands on `session`.

Acceptance:

- Basic rail has no Injection tab.
- Advanced rail still has Injection.
- A saved Basic active tab of `injection` normalizes to `session`.

### Phase 2: Basic Walkthrough Cleanup

Detailed ordered coverage now lives in [Saga Walkthrough Workflow Expansion Plan](SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md). That plan treats Basic walkthrough coverage as workflow-complete rather than count-limited.

Files:

- `runtime-guide-content.js`
- `src/runtime/lore-panel.js`

Tasks:

1. Replace the current Basic guide with the Alpha workflow-card flow:
   - First Run.
   - Loredecks.
   - Context.
   - Lorecards.
   - Continue Roleplay.
   - Settings.
2. Keep the full Basic walkthrough action-oriented and workflow-complete, without a fixed maximum step count.
3. Render focused workflow starters instead of one visible list of every target.
4. Remove all Basic guide steps targeting hidden tabs.
5. Keep Advanced guide Injection steps unchanged.
6. Add a validation helper or test assertion that every Basic guide step targets a Basic-visible tab.

Acceptance:

- Basic walkthrough never navigates to `injection`.
- Basic walkthrough never navigates to `continuity`.
- Advanced walkthrough can still navigate to `injection`.

### Phase 3: Session Start Checklist Dropdown

Files:

- `src/runtime/lore-panel.js`
- `styles/saga.css`

Tasks:

1. Add a Basic-only readiness dropdown near the top of `renderSessionTab()`.
2. Derive readiness from existing state:
   - Saga active from `settings.enabled`.
   - Loredeck loaded from active stack state.
   - Context set from loaded Loredeck Context rows.
   - Review needed from pending entries or proposed Lorecards.
   - Lore selected from `getSelectedLoreInjectionCount()`.
   - Provider configured from existing provider readiness helpers.
3. Show one recommended next action.
4. Keep current Session Metrics available but visually secondary in Basic.
5. Do not add any automatic action.

Acceptance:

- Empty Basic install points to Open Library.
- Loaded deck without Context points to Set Context.
- Context with pending/proposed cards points to Review Lorecards.
- Accepted selected lore points to Continue roleplay.

### Phase 4: Basic Injection Summary Removal

Files:

- `src/runtime/lore-panel.js`
- `styles/saga.css`

Tasks:

1. Do not add a selected-lore prompt-status summary to Basic Session.
2. Do not add a selected-lore prompt-status summary to Basic Lorecards.
3. Keep exact prompt preview and placement controls in Advanced Injection.
4. Keep Basic readiness in the Start Checklist and review actions in Lorecards.

Acceptance:

- Basic users do not see **What Saga Will Send** or **What Accepted Lorecards Do** sections.
- Basic users can still review and accept Lorecards without opening Injection.
- No placement, compression, prompt-status, or tier controls appear in Basic.

### Phase 5: Lorecards Tab Simplification

Files:

- `src/runtime/lore-panel.js`
- `runtime-guide-content.js`

Tasks:

1. Keep suggested, pending, and accepted Lorecards visible in Basic.
2. Keep prompt-status summaries out of Basic.
3. Hide or collapse metadata-heavy workbench and bulk controls when Basic presentation can do so safely.
4. Keep single-card accept, dismiss, edit, pin, mute, and relevance controls if currently needed for the existing review flow.
5. Route deeper management and large-list workbenches to Advanced.

Acceptance:

- Basic Lorecards answers "Should this fact affect future responses?"
- Basic Lorecards does not become a prompt-engineering surface.

### Phase 6: Retire Basic Injection Tab Code

Files:

- `src/runtime/lore-panel.js`
- `src/state/constants.js`

Tasks:

1. Remove `renderBasicInjectionTab()` and any Basic-only Injection helper cards.
2. Remove retired `injection.basic.*` collapsed-section defaults.
3. Keep `renderAdvancedInjectionTab()` and all Advanced injection controls intact.

Acceptance:

- No Basic route renders a dedicated Injection tab.
- No misleading `Basic Injection Tab` implementation or `injection.basic.*` section IDs remain.

### Phase 7: Basic Context Surface Cleanup

Files:

- `src/runtime/lore-panel.js`
- `src/context/context-panel.js`
- `tools/scripts/test-visual-smoke-harness.mjs`

Tasks:

1. Keep loaded Loredeck Context rows visible in Basic.
2. Use the shared Context language in headers, command center, row actions, and status text.
3. Make **Browse Context** the Basic primary action and keep **Detect Context** secondary.
4. Present uncertain Context output as **proposals** in Basic.
5. Hide Advanced Context Brief, resolver actions, audit panels, manual-lock controls, timeline shortcuts, and confidence/candidate details in Basic.
6. Preserve Advanced Context Brief, resolver actions, audit panels, manual locks, timeline shortcuts, and diagnostic copy in Advanced.
7. Add smoke-harness contracts that prevent Advanced Context diagnostics from returning to Basic.

Acceptance:

- Basic Context does not show Advanced Context Brief.
- Advanced Context keeps the Advanced Context Brief section.
- Basic Context copy points users toward choosing Context.
- Basic Context exposes Browse Context as the primary path.
- Basic Context proposals remain reviewable before use.
- Basic Context does not show direct resolver, audit, manual-lock, confidence, or candidate controls.

### Phase 8: Basic Loredecks Loading Surface

Files:

- `loredecks-tab-panel.js`
- `src/runtime/lore-panel.js`
- `docs/user/BASIC_WORKFLOW.md`
- `tools/scripts/test-visual-smoke-harness.mjs`

Tasks:

1. Reuse the same Loredecks tab structure in Basic and Advanced.
2. Keep **Loredeck Library** as the visible loading section in both modes.
3. Keep **Import Deck** visible in Basic and Advanced.
4. Hide **Create Deck** and **In-Progress Deck Maker Projects** in Basic.
5. Do not introduce Basic-only stack cards, renamed buttons, or plain readiness labels that teach a different Loredecks workflow.
6. Let the Start checklist point users to the shared Library workflow.

Acceptance:

- Basic Loredecks shows **Loredeck Library**.
- Basic Loredecks shows **Import Deck**.
- Basic Loredecks does not show **Create Deck**.
- Basic Loredecks does not show **In-Progress Deck Maker Projects**.
- Basic and Advanced Loredecks share the Library loading workflow.
- The Start checklist directs users to open the Library and add a deck to the active stack.
- No Basic-only Loredecks layout or CSS remains.

### Phase 9: Basic Settings Setup Surface

Files:

- `src/runtime/lore-panel.js`
- `src/settings/settings-panel.js`
- `styles/saga.css`
- `tools/scripts/test-visual-smoke-harness.mjs`

Tasks:

1. Render a Basic-only Settings branch with:
   - **Providers**.
   - **Theme Pack**.
2. In Providers:
   - Show Utility and Reasoning provider readiness.
   - Expose **Test Utility** and **Test Reasoning**.
   - Allow a quick fallback to the current SillyTavern model.
   - Hand off profile, endpoint, model, generation, and compatibility controls to Advanced.
3. In Theme Pack:
   - Render the same Theme Pack section used in Advanced.
   - Let Basic users choose, import, export, reset, inspect, and tune Theme Packs without switching modes.
   - Keep this surface shared so Basic and Advanced theme behavior cannot drift.
4. Do not render an Experience Mode section in Basic Settings; the shelf owns Basic/Advanced switching.
5. Preserve the Advanced settings tab unchanged.

Acceptance:

- Basic Settings exposes Providers and Theme Pack.
- Basic Settings does not expose provider profile internals, generation parameters, or API compatibility flags.
- Advanced Settings still exposes the full Providers and Theme Pack surfaces.
- Basic provider setup remains optional until a model-backed action needs it.

### Phase 10: Tests And Smoke Coverage

Files:

- `tools/scripts/test-visual-smoke-harness.mjs`
- `tests/browser/visual-smoke.html`
- `README.md`
- `docs/user/BASIC_WORKFLOW.md`
- `docs/user/ADVANCED_WORKFLOW.md`
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
9. Basic Session and Lorecards do not contain selected-lore summary sections.
10. Basic Context hides Advanced Context Brief and other Advanced Context diagnostics.
11. Basic Context prioritizes Browse Context and presents proposals as proposals.
12. Basic Loredecks reuses the shared Loredecks tab structure.
13. Basic Loredecks shows Loredeck Library and Import Deck while hiding Create Deck and In-Progress Deck Maker Projects.
14. Basic Settings exposes Providers and Theme Pack.
15. Basic Settings keeps provider internals behind Advanced while sharing the full Theme Pack surface.

Recommended commands:

```powershell
node --check src/runtime/runtime-navigation.js
node --check src/runtime/runtime-experience-mode.js
node --check src/runtime/runtime-guide-content.js
node --check src/runtime/lore-panel.js
node --check src/loredecks/loredecks-tab-panel.js
node --check src/context/context-panel.js
node --check src/settings/settings-panel.js
node --check tools\scripts\test-visual-smoke-harness.mjs
node --check tools\scripts\test-basic-readiness.mjs
node --check tools\scripts\test-experience-modes.mjs
node tools\scripts\test-basic-readiness.mjs
node tools\scripts\test-experience-modes.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\serve-visual-smoke.mjs --check --port 0
```

Optional after implementation:

```powershell
node tools\scripts\serve-visual-smoke.mjs
```

Then inspect:

```text
http://127.0.0.1:8765/tests/browser/visual-smoke.html?mode=basic
http://127.0.0.1:8765/tests/browser/visual-smoke.html?mode=advanced&tab=injection
```

## Out Of Scope For This Slice

- Full Basic Loredeck curated-combination picker.
- Full Start Checklist redesign beyond readiness status.
- Continuity simplification.
- Full provider setup redesign beyond quick status, testing, and Advanced handoff.
- Deck Maker UX changes.
- Pack Health redesign.
- Import/export simplification.
- Full release-facing documentation beyond the starter Basic and Advanced workflow pages.

Those are part of the broader experience-mode plan, but this feature slice should stay focused enough to land and verify quickly.

## Risks

- Hiding Injection may make Basic users less aware that accepted Lorecards affect prompts.
  - Mitigation: Start Checklist readiness and Accepted Lorecards counts point users toward review without exposing prompt tuning.

- Basic guide steps may silently target hidden controls.
  - Mitigation: add a test that guide step tabs are visible for the selected mode.

- Advanced users may lose their selected Injection tab when toggling modes.
  - Mitigation: preserve Advanced settings backup and route Basic hidden tabs to Session only while Basic is active.

- Existing visual smoke assumptions may expect Injection in the rail.
  - Mitigation: update smoke checks to be mode-aware.

## Done Definition

This feature is done when:

- Basic mode rail hides Injection and Continuity.
- Basic mode has no selected-lore summary section in Session or Lorecards.
- Basic walkthrough targets only visible Basic tabs and is grouped into focused workflow starters.
- Basic Settings exposes Providers and the full shared Theme Pack surface without showing advanced provider internals.
- Advanced mode still exposes the full Injection tab and existing controls.
- Switching modes preserves saved stack, Context, pending Lorecards, accepted Lorecards, and backed-up managed settings.
- README and starter user docs point new users to the Basic workflow first.
- Local syntax checks and visual smoke harness pass.
