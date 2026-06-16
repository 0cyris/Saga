# Saga Public Release Documentation Refresh Plan

Status: planning document for preparing `mobile-support` for public release.

Branch scope: compare `main` as the current public release baseline against `mobile-support` as the release candidate. At the time this plan was drafted, `main` was `b1b8efd08bf1cc3a0a992a619012bcd75a4b69b9` and `mobile-support` was `416e76f7a0c4e6913719ed95950a5981e9b1e394`.

Pre-alpha rule: Saga does not need compatibility shims for old extension states, old docs, or old walkthrough wording. When a label, workflow, screenshot, or mental model is stale, update it in place to the best current contract.

## Purpose

This plan coordinates the release-facing documentation refresh after the large `mobile-support` branch changes. The work has five connected goals:

1. Identify every user-facing feature, behavior, and UI change between `main` and `mobile-support`.
2. Regenerate the documentation render set for desktop and mobile with `.saga-doc-renderer`.
3. Update the public README, desktop operator manual, mobile operator manual, Basic workflow, Advanced workflow, and alpha release notes.
4. Rework Basic and Advanced walkthroughs for both desktop and mobile, with mobile treated as a first-class entry path.
5. Update the desktop Basic checklist quickrun and validate as we go, fixing release-blocking bugs instead of documenting around them.

## Current Delta Snapshot

The committed branch delta is large enough that the docs pass should be treated as a release audit, not a copy edit.

- `git diff --stat main...mobile-support` currently reports `122 files changed`, about `29,908 insertions`, and `3,667 deletions`.
- The branch adds 20 commits over `main`, starting with `Mobile support initial commit` and ending with `Refine lorecards stages and mobile rename gestures`.
- The largest changed areas are `src/runtime`, `src/lorecards`, `src/context`, `src/state`, `styles`, `tools/scripts`, `docs/development`, and committed documentation renders.
- `docs/user/OPERATOR_MANUAL.md` has been renamed to `docs/user/DESKTOP_OPERATOR_MANUAL.md`.
- `docs/user/MOBILE_OPERATOR_MANUAL.md` has been added.
- `.saga-doc-renderer/render-all.ps1` currently defines 70 render rows, while `assets/documentation/renders` currently contains 47 top-level documentation PNGs. The 23 missing matrix outputs must be reconciled before final docs link to them.

Missing committed render outputs from the current matrix:

- `docs-mobile-basic-session-details`
- `docs-mobile-basic-library-overview`
- `docs-mobile-basic-pack-health`
- `docs-mobile-basic-context-root`
- `docs-mobile-basic-context-workbench`
- `docs-mobile-basic-context-proposals`
- `docs-mobile-basic-new-lore`
- `docs-mobile-basic-settings`
- `docs-mobile-basic-settings-theme-pack`
- `docs-mobile-advanced-library-overview`
- `docs-mobile-advanced-library-detail`
- `docs-mobile-advanced-session-root`
- `docs-mobile-advanced-session-details`
- `docs-mobile-advanced-continuity-root`
- `docs-mobile-advanced-continuity-character-state`
- `docs-mobile-advanced-context-root`
- `docs-mobile-advanced-context-details`
- `docs-mobile-advanced-lorecards-lore`
- `docs-mobile-advanced-lorecards-generate`
- `docs-mobile-advanced-new-lore`
- `docs-mobile-advanced-injection-root`
- `docs-mobile-advanced-injection-placement`
- `docs-mobile-advanced-settings-theme-pack`

## Release Change Inventory

Use this inventory as the first pass for the branch-delta audit. It is intentionally user-facing. Internal refactors matter only when they change what must be documented, rendered, toured, or tested.

| Area | User-facing change to audit | Primary files and docs to inspect | Documentation impact |
| --- | --- | --- | --- |
| Mobile shell | Phone-width Saga now uses a full-height mobile window, fixed bottom navigation, route pages, mobile subviews, safe-area padding, and an active-tab `Exit` action instead of the desktop rail/drawer. | `src/runtime/runtime-shell.js`, `src/runtime/runtime-shell-view.js`, `src/runtime/runtime-navigation.js`, `styles/layout.css`, `styles/runtime.css`, `docs/development/SAGA_MOBILE_SUPPORT_FEATURE.md` | README must present mobile as supported, mobile manual must teach navigation from scratch, walkthroughs must not assume desktop rail knowledge. |
| Mobile routes | Basic mobile exposes `Loredecks`, `Session`, `Context`, `Lorecards`, `Settings`. Advanced mobile also exposes `Continuity` and `Injection` as direct icon routes. | Runtime shell/navigation files, `docs/user/MOBILE_OPERATOR_MANUAL.md`, visual smoke assertions | Mobile docs and tours need route-specific coverage and mode-specific omissions. |
| Touch interaction model | Mobile shifts toward object-first rows, detail sheets, bottom-owned actions, long-press editing, tap order, and compact controls instead of desktop button rows. | `src/lorecards/lorecards-panel.js`, `src/loredecks/loredeck-library-panel.js`, `styles/review.css`, `docs/development/SAGA_MOBILE_TOUCH_INTERACTION_REDESIGN.md` | Mobile manual and walkthroughs must explain taps, long-press, sheets, subviews, Back, Close, and Exit directly. |
| Desktop preservation | Desktop rail/drawer behavior still matters at desktop and tablet widths, while phone width uses the mobile shell. | `src/runtime/runtime-shell.js`, `styles/layout.css`, `docs/development/SAGA_DESKTOP_BEVEL_SYSTEM.md`, `docs/development/SAGA_VISUAL_SMOKE.md` | Desktop manual needs current screenshots and should not borrow phone-only control assumptions. |
| Basic/Advanced modes | Basic remains the guided roleplay path. Advanced exposes diagnostics, Deck Maker, Pack Health repair, Continuity, Injection, provider internals, and deeper settings. | `src/state/basic-profile.js`, `src/runtime/session-basic-panel.js`, `src/runtime/runtime-guide-content.js`, user workflow docs | README, Basic workflow, Advanced workflow, and release notes must align on what each mode hides and exposes. |
| Session Readiness | Desktop Basic checklist and mini-tours now route users to next actions instead of making them scan all tabs. | `src/runtime/session-basic-panel.js`, `src/runtime/runtime-basic-readiness.js`, `src/runtime/runtime-tour.js` | Basic checklist quickrun must be revalidated on desktop and mobile; docs must explain readiness without overloading first-time users. |
| Walkthroughs | Basic and Advanced walkthroughs are module/task-track systems, not small tab tours. Basic has B01-B57 style coverage; Advanced has A01-A169 style coverage. | `src/runtime/runtime-guide-content.js`, `src/runtime/runtime-guide-prep.js`, `src/runtime/runtime-tour.js`, `docs/development/SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md` | Rework tours so desktop and mobile targets resolve, with mobile-first explanations where layout differs. |
| Loredeck Library | Library now covers folders, source types, active stack management, import/export, selected details, mobile detail sheets, stack ordering, and active-stack controls. | `src/loredecks/loredeck-library-panel.js`, `src/runtime/lore-panel.js`, `styles/review.css` | README/manuals need current Library screenshots and a clearer active-stack mental model. |
| Pack Health | Pack Health Center covers status, grouped issues, refresh, repair routing, accept-as-is, verify fixed, generated-readiness links, and mobile bottom actions. | `src/loredecks/loredeck-health-panel.js`, `src/runtime/loredeck-editor-actions.js`, `docs/user/DESKTOP_OPERATOR_MANUAL.md` | Docs must use `Pack Health`, not stale `Deck Health`, and explain structural health versus canon truth. |
| Deck Maker | Deck Maker is a staged workflow with current task/progress, draft review, title planning, context/tag planning, retry/retry-smaller, Auto-Draft All, generation settings, readiness, and finalization. | `src/loredecks/loredeck-creator-panel.js`, `src/state/lore-creator-state.js`, `docs/development/LOREDECK_CREATOR_LIVE_TEST_LOG.md` | Advanced manual, mobile manual, walkthroughs, and release notes need staged-authoring coverage rather than one-shot generation language. |
| Lorecards workspace | Lorecards have a unified review-first workspace with Pending Review, Accepted Lorecards, Generate, mobile `Generate | Automate | Lore` sub-tabs, and long-press mobile editor. | `src/lorecards/lorecards-panel.js`, `src/lorecards/lore-selection.js`, `styles/review.css` | Documentation must explain review gates, accepted object rows, editing, and mobile sub-tabs. |
| Accepted Lorecard controls | The current control model uses relevance tier, Mute, and Elevate/protection semantics. Older `Pin`, `Pinned`, `Active`, `Active Set`, and per-card `Disable Lore Automation` wording must be audited. | `src/lorecards/lore-selection.js`, `src/lorecards/lorecards-panel.js`, `docs/development/SAGA_LORECARDS_CONTROL_REVISION_PLAN.md` | Public docs and walkthrough copy must match current UI labels exactly. |
| Lore Automation | Advanced Lorecards include Lore Automation levels and inspectable automation state. Elevated cards should be protected from automation. | `src/lorecards/lore-automation.js`, `src/context/auto-relevance.js`, `src/lorecards/lore-relevance.js`, `tools/scripts/test-lore-automation-levels.mjs` | README and advanced docs should explain automation as inspectable/reversible, not a hidden background mystery. |
| Context | Context now centers Runtime Context, loaded Loredeck Context rows, Context Workbench, proposals, Start Here, Use Window, Use Anchor, After, Before, Timeline, and Phrase Resolver. | `src/context/context-panel.js`, `src/context/context-workbench-panel.js`, `src/runtime/runtime-guide-content.js` | Basic docs need enough manual Context coverage. Advanced docs need resolver/proposal/diagnostic depth. Mobile walkthroughs need Context from zero desktop assumptions. |
| Continuity | Continuity remains Advanced-only on mobile and desktop, covering scan controls, live scene state, active characters, items, goals, and injection link. | `src/continuity/*`, `src/runtime/advanced-runtime-panel.js`, `styles/continuity.css` | Desktop and mobile manuals need current Continuity screenshots and clear separation from durable Lorecards. |
| Injection | Advanced Injection exposes prompt placement, high/normal/low preview, continuity/lore toggles, compression behavior, omission reasons, and mobile inspection routes. | `src/runtime/injection-preview-panel.js`, `src/runtime/advanced-runtime-panel.js`, `styles/runtime.css` | Advanced docs must make Injection the truth source for what reaches the model. Basic docs should route users to Advanced when they need it. |
| Settings | Settings owns Experience Mode, providers, current-model routing, Theme Packs, Icon Sets, State Safety, and Danger Zone cleanup. | `src/settings/runtime-settings-tab.js`, `src/settings/settings-panel.js`, `src/settings/theme-actions.js`, `styles/settings.css` | README/manuals must update setup, provider, theme, State Safety, and cleanup guidance. |
| Storage and packages | `.saga-loredeck.zip` packages, externalized Saga storage, passive assets, Library index, Deck Maker projects, Theme/Icon assets, and cleanup are release-facing. | `src/state/*`, `docs/loredecks/*`, `docs/user/STORAGE_AND_STATE_SAFETY.md` | Docs must not imply old JSON-only import/export workflows or legacy migration support. |
| Visual smoke and renderer | Visual smoke now covers mobile, guide harnesses, tablet sanity, live ST smoke, and renderer output. | `tools/scripts/test-visual-smoke-harness.mjs`, `tools/scripts/smoke-live-st-cdp.mjs`, `.saga-doc-renderer/*`, `docs/development/SAGA_VISUAL_SMOKE.md` | Verification sections in docs and release notes should cite current commands and rendered evidence. |

## Workstream 1: Branch Delta Audit

Goal: produce a complete public-change ledger before rewriting docs. This prevents us from only documenting the most recent mobile work and missing older feature changes in the branch.

Commands:

```powershell
git status --short --branch
git log --oneline --decorate --no-merges main..mobile-support
git diff --stat main...mobile-support
git diff --name-status main...mobile-support
git diff --dirstat=files,0 main...mobile-support
```

Audit by source area:

```powershell
git diff --name-only main...mobile-support -- src styles docs tools assets
rg -n "Mobile|mobile|Lore Automation|Creator|Pack Health|Context Workbench|Phrase Resolver|Session Readiness|Advanced Walkthrough|Basic Walkthrough|Experience Mode|State Safety|Danger Zone" src docs tools
```

Audit for stale terminology:

```powershell
rg -n "Deck Health|OPERATOR_MANUAL|Active Set|Pinned|\\bPin\\b|Activate|Disable Lore Automation|Apply|Dismiss|overflow sheet|More sheet|old API|legacy|migration" README.md docs src
```

Deliverable: a delta matrix that maps every release-facing change to its docs, renders, walkthrough steps, and tests.

Matrix columns:

| Change | User value | Source evidence | Desktop render | Mobile render | README section | Manual section | Walkthrough/checklist impact | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Example: Mobile bottom nav | Phone users can operate Saga without desktop rail/drawer. | Runtime shell/navigation, styles, smoke harness | Not needed except desktop preservation | `docs-mobile-basic-shell-start`, `docs-mobile-advanced-session-root` | Fast Start, Key Features | Mobile Shell Basics | Mobile Basic/Advanced intro steps | visual smoke, renderer, live mobile smoke |

Acceptance criteria:

- Every changed public surface has at least one row in the matrix.
- Every row has an explicit doc decision: update, add, remove, or leave unchanged with reason.
- Every screenshot currently referenced by README/manuals exists in `assets/documentation/renders`.
- Every renderer row either has a committed output or is intentionally removed from the matrix.
- Stale terminology search has no public-doc hits except historical development notes or clearly intentional schema examples.

## Workstream 2: Documentation Render Refresh

Goal: regenerate all committed README/operator-manual images from the current UI, then prune stale renders.

Prerequisites:

- SillyTavern is running at `http://127.0.0.1:8000/`.
- The active installed Saga extension is synced from this workspace before live capture.
- The renderer browser profile has completed any one-time SillyTavern setup.
- The current `mobile-support` workspace is free of unrelated rendering changes that should not be captured.

Renderer commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -List
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -ContinueOnError
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -PruneOutput
```

Partial reruns:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -Only "docs-mobile-basic-*"
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -Only "docs-mobile-advanced-*"
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -Only "docs-context-*"
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -Only "docs-lorecards-*"
```

Desktop render families to refresh:

- Basic shell and Basic Walkthrough: `docs-shell-basic-start`, `docs-basic-walkthrough-modules`
- Advanced session and Advanced Walkthrough: `docs-session-advanced-status`, `docs-advanced-walkthrough-modules`
- Loredecks and Library: `docs-loredecks-overview`, `docs-loredecks-library-launch`, `docs-loredeck-library-overview`, `docs-loredeck-library-active-stack`, `docs-loredeck-library-selected-details`
- Pack Health: `docs-pack-health-overview`, `docs-pack-health-issues`
- Deck Maker: `docs-deck-maker-desktop-intake`, `docs-deck-maker-desktop-current-task`
- Context: `docs-context-command-center`, `docs-context-loaded-loredecks`, `docs-context-workbench`, `docs-context-proposal-review`
- Lorecards: `docs-lorecards-overview`, `docs-lorecards-pending-review`, `docs-lorecards-accepted-list`, `docs-lorecards-workbench`, `docs-lore-timeline`
- Continuity: `docs-continuity-overview`, `docs-continuity-scan`, `docs-continuity-character-state`
- Injection: `docs-injection-overview`, `docs-injection-placement`, `docs-injection-high-preview`
- Settings: `docs-settings-providers`, `docs-settings-theme-pack`

Basic mobile render families to refresh:

- Shell/session: `docs-mobile-basic-shell-start`, `docs-mobile-basic-session-details`
- Loredecks/Library/Health: `docs-mobile-basic-loredecks-root`, `docs-mobile-basic-library-overview`, `docs-mobile-basic-library-detail`, `docs-mobile-basic-pack-health`
- Context: `docs-mobile-basic-context-root`, `docs-mobile-basic-context-details`, `docs-mobile-basic-context-workbench`, `docs-mobile-basic-context-proposals`
- Lorecards: `docs-mobile-basic-lorecards-lore`, `docs-mobile-basic-lorecards-generate`, `docs-mobile-basic-new-lore`
- Settings: `docs-mobile-basic-settings`, `docs-mobile-basic-settings-theme-pack`

Advanced mobile render families to refresh:

- Loredecks/Library/Health/Deck Maker: `docs-mobile-advanced-loredecks-root`, `docs-mobile-advanced-library-overview`, `docs-mobile-advanced-library-detail`, `docs-mobile-advanced-pack-health`, `docs-mobile-advanced-creator`
- Session: `docs-mobile-advanced-session-root`, `docs-mobile-advanced-session-details`
- Continuity: `docs-mobile-advanced-continuity-root`, `docs-mobile-advanced-continuity-scan`, `docs-mobile-advanced-continuity-character-state`
- Context: `docs-mobile-advanced-context-root`, `docs-mobile-advanced-context-details`, `docs-mobile-advanced-context-workbench`, `docs-mobile-advanced-context-proposals`
- Lorecards: `docs-mobile-advanced-lorecards-lore`, `docs-mobile-advanced-lorecards-editor`, `docs-mobile-advanced-lorecards-generate`, `docs-mobile-advanced-lorecards-automation`, `docs-mobile-advanced-new-lore`
- Injection: `docs-mobile-advanced-injection-root`, `docs-mobile-advanced-injection-placement`, `docs-mobile-advanced-injection-high-preview`
- Settings: `docs-mobile-advanced-settings`, `docs-mobile-advanced-settings-providers`, `docs-mobile-advanced-settings-theme-pack`

Render quality checklist:

- No blank, dark, or half-loaded captures.
- No clipped bottom navigation, route labels, modal footers, or action bars.
- No text overlap in cards, buttons, chips, tabs, or walkthrough popovers.
- Mobile captures show the real mobile shell, not a squeezed desktop drawer.
- Desktop captures show the desktop rail/drawer and do not accidentally use mobile layout.
- Crops are tight enough for docs but not so tight that the user loses context.
- `render-report.json` has zero failed rows.
- `render-manifest.json` reflects the committed matrix.
- Stale PNGs are pruned only after the full matrix is accepted.

## Workstream 3: Release-Facing Documentation Update

Goal: make public docs describe the current product in the order a new operator needs it.

### README

Update `README.md` as the GitHub front door.

Required changes:

- Replace any remaining "mobile support" roadmap framing with shipped-current alpha wording.
- Add a compact mobile support summary to Fast Start or Key Features.
- Keep README lighter than the operator manuals; link out for full desktop/mobile operation.
- Ensure feature table covers mobile shell, Lore Automation, Creator recovery, Pack Health, Context Workbench, and Basic/Advanced workflows without internal churn.
- Use current screenshot references only.
- Keep public status honest: alpha release, manual updates, pre-alpha contracts still changing, but implemented features should be concrete.

### Desktop Operator Manual

Update `docs/user/DESKTOP_OPERATOR_MANUAL.md`.

Required changes:

- Verify every screenshot against the current desktop render.
- Ensure desktop manual does not describe mobile-only gestures as desktop requirements.
- Update Lorecards controls to current relevance, Mute, Elevate/protection, review, and editing language.
- Update Deck Maker stages with current task/progress/retry/review/readiness behavior.
- Update Context Workbench coverage with exact labels: `Start Here`, `Use Window`, `Use Anchor`, `After`, `Before`, `Timeline`, `Phrase Resolver`.
- Update Settings coverage for Experience Mode, providers, Theme Packs, Icon Sets, State Safety, and Danger Zone.

### Mobile Operator Manual

Update `docs/user/MOBILE_OPERATOR_MANUAL.md`.

Required changes:

- Treat mobile users as first-time Saga users, not desktop users on a smaller screen.
- Begin with the mobile shell model: bottom routes, active tab as `Exit`, Back, Close, subviews, detail sheets, and long-press.
- Explain Basic mobile as a complete roleplay loop.
- Explain Advanced mobile routes and why Continuity/Injection appear only in Advanced.
- Teach Loredeck Library detail sheets, mobile Pack Health, Context Workbench, proposal review, mobile Lorecards sub-tabs, mobile Accepted editor, and mobile Settings.
- Include troubleshooting for bottom-bar visibility, missing Advanced routes, long-press editing, Context confusion, provider readiness, and generated deck health.

### Basic Workflow

Update `docs/user/BASIC_WORKFLOW.md`.

Required changes:

- Align with current Basic module order: First Run, Loredecks, Context, Lorecards, Continue Roleplay, Settings.
- Keep Basic free of Deck Maker, Continuity, Injection tuning, repair internals, and provider profile internals.
- Make the Quick Start match the desktop Basic checklist and mobile Basic route flow.
- Preserve exact Context labels and explain enough for a user to set story position without Advanced knowledge.
- Replace stale `pin` wording if the current UI now uses `Elevate`.

### Advanced Workflow

Update `docs/user/ADVANCED_WORKFLOW.md`.

Required changes:

- Align task tracks with the current Advanced guide modules.
- Include mobile-specific notes only when layout or interaction differs materially.
- Cover Library mastery, Session/runtime, Context resolution, Lorecards, Injection, Continuity, Deck Maker, Pack Health/packages, Settings/providers, and troubleshooting.
- Update Lore Automation language around levels, ownership, protection, reviewability, and undo/inspection.

### Alpha Release Notes

Update `docs/release/0.1.0-alpha.1.md`.

Required changes:

- Keep the established structure: `Compatibility`, `Implemented Features`, `Alpha Boundaries`, `Verification`.
- Add mobile shell/support as an implemented feature.
- Add current Lore Automation, mobile Lorecards, Deck Maker progress/retry/review, Context Workbench/Phrase Resolver, and Pack Health/package details where release-facing.
- Preserve required alpha-contract wording checked by `tools/scripts/test-manifest-alpha.mjs`, including the exact sentence: `Unsupported old imported state schemas are rejected instead of partially migrated.`
- Keep internal churn out of release notes unless it changes user behavior.

### Documentation Index

Update `docs/DOCUMENTATION_INDEX.md`.

Required changes:

- Link this plan under Development Notes.
- Ensure release-facing docs point to `DESKTOP_OPERATOR_MANUAL.md` and `MOBILE_OPERATOR_MANUAL.md`.
- Remove or redirect stale references to `OPERATOR_MANUAL.md`.

## Workstream 4: Walkthrough And Checklist Overhaul

Goal: make in-app guidance match the current desktop and mobile UI. This is product work, not just docs copy.

Authoritative files:

- Main Basic and Advanced walkthrough data: `src/runtime/runtime-guide-content.js`
- Walkthrough preparation actions: `src/runtime/runtime-guide-prep.js`
- Tour runtime and target resolution: `src/runtime/runtime-tour.js`
- Basic checklist and mini-tours: `src/runtime/session-basic-panel.js`
- Context target anchors: `src/context/context-panel.js`, `src/context/context-workbench-panel.js`
- Visual smoke coverage: `tools/scripts/test-visual-smoke-harness.mjs`, `tools/scripts/smoke-live-st-cdp.mjs`

Rules:

- Basic walkthrough steps must only target Basic-visible controls.
- Mobile Basic must not assume the user knows the desktop rail, drawer, or desktop Library layout.
- Mobile tours need to teach bottom routes, active tab `Exit`, Back, subviews, detail sheets, bottom action bars, and long-press where relevant.
- Advanced can be deeper, but focused module starts must remain useful.
- Every step must have a concrete target or a preparation/fallback path.
- Add `markTourTarget(...)` markers for named controls instead of broad panel targets when the user needs to learn a specific button.
- Preserve exact user-facing labels for Context controls.
- Keep Basic checklist mini-tours separate from the full Basic Walkthrough. Passing one does not prove the other.

Basic desktop checklist quickrun must verify:

1. Start in Basic Session and read readiness.
2. Follow the next recommended action to Loredecks.
3. Open Loredeck Library and add a deck or folder to the Active Stack.
4. Return to Context and choose story position manually.
5. Open Lorecards and generate, draft, or review entries.
6. Accept useful Pending Review entries.
7. Return to Session and confirm Session Readiness is ready.
8. Continue roleplay, then repeat Context and Lorecards after major story movement.

Mobile Basic walkthrough must cover:

1. What the bottom bar is and why the active route says `Exit`.
2. How Session summary and Session Details differ.
3. How to open Loredecks, Library, and deck detail sheets.
4. How to set Context without desktop assumptions.
5. How to use Lorecards `Lore` and `Generate` sub-tabs.
6. How to review Pending Review and inspect Accepted Lorecards on phone.
7. How Settings handles providers, Experience Mode, Theme Pack, and cleanup.

Advanced walkthrough must cover:

- Library source types, folders, search/sort, details, active stack, import/export, and package warnings.
- Session runtime controls, automation mode, metrics, and mode recovery.
- Context Workbench, proposal review, locks, Phrase Resolver, local and Reasoner resolution, and diagnostics.
- Lorecard generation/review, relevance, Mute, Elevate/protection, automation, editing, timeline/audit, and review-first policy.
- Injection prompt placement, tier previews, compression, omission reasons, continuity link, and sync diagnostics.
- Continuity scan scope, tracked sections, active characters, state blocks, and recovery.
- Deck Maker staged authoring, progress/current task, planning, drafting, review, retries, project shelf, readiness, and finalization.
- Pack Health status, grouped issues, Attempt Fixing, manual repair, accept-as-is, verify fixed, package update/export/finalization.
- Settings providers, current model, generation parameters, Theme Packs, Icon Sets, State Safety, Danger Zone, and diagnostics.
- Troubleshooting routes back to the right surface.

Walkthrough verification:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
$env:SAGA_SMOKE_TARGET='guide-harness'
node tools\scripts\smoke-live-st-cdp.mjs
```

Required visual evidence:

- Basic guide card.
- Basic focused module.
- Basic prepared Library target.
- Basic full-tour first popover.
- Advanced guide card.
- Advanced focused module.
- Advanced Creator empty/resumable fallback.
- Advanced full-tour first popover.
- Phone-width guide behavior where the same target has a mobile layout.

## Workstream 5: Testing, Bug Logging, And Iteration

Goal: validate after each meaningful docs/render/walkthrough change, and fix product bugs that block accurate documentation.

Focused static checks:

```powershell
node tools\scripts\test-manifest-alpha.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-lore-automation-levels.mjs
node tools\scripts\test-runtime-ui-confirm-dialog.mjs
node tools\scripts\run-alpha-gate.mjs
git diff --check
```

Renderer checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.saga-doc-renderer\render-all.ps1 -ContinueOnError
```

Repo-local browser smoke:

```powershell
node tools\scripts\serve-visual-smoke.mjs --check --port 0
$env:SAGA_SMOKE_TARGET='mobile-redesign-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='360'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='740'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs

$env:SAGA_SMOKE_TARGET='mobile-advanced-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='430'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='820'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs

$env:SAGA_SMOKE_TARGET='tablet-advanced-harness'
$env:SAGA_SMOKE_VIEWPORT_WIDTH='768'
$env:SAGA_SMOKE_VIEWPORT_HEIGHT='1024'
$env:SAGA_SMOKE_NATIVE_WS='1'
node tools\scripts\smoke-live-st-cdp.mjs
```

Installed SillyTavern checks after syncing the workspace extension:

```powershell
node tools\scripts\smoke-live-st-cdp.mjs
$env:SAGA_SMOKE_TARGET='live-context'
node tools\scripts\smoke-live-st-cdp.mjs
$env:SAGA_SMOKE_TARGET='live-context-loaded'
node tools\scripts\smoke-live-st-cdp.mjs
```

Opt-in provider checks only when intentionally spending provider calls:

```powershell
$env:SAGA_SMOKE_TARGET='live-context-reasoner'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
node tools\scripts\smoke-live-st-cdp.mjs

$env:SAGA_SMOKE_TARGET='live-creator'
$env:SAGA_ALLOW_PROVIDER_CALLS='1'
$env:SAGA_ST_URL='http://127.0.0.1:8000/'
$env:SAGA_ST_USER_FILES_DIR='F:\SillyTavern\SillyTavern\data\default-user\user\files'
node tools\scripts\smoke-live-st-cdp.mjs
```

Bug log format:

| ID | Found during | Severity | Surface | Repro | Fix owner | Status | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DOCREL-001 | renderer row | Release blocker | Mobile Library | Screenshot missing detail sheet action bar | TBD | Open | rerun `docs-mobile-basic-library-detail` |

Bug severity:

- Release blocker: broken render, broken walkthrough target, missing public screenshot, impossible first-run path, misleading release note, or data-damaging UI.
- High: visible overlap, clipped action, incorrect route, stale label in public docs, or mobile interaction not discoverable.
- Medium: confusing copy, weak screenshot crop, missing troubleshooting route, or incomplete advanced coverage.
- Low: wording polish or development-doc cleanup.

## Recommended Sequence

1. Baseline the branch delta and fill the release-change matrix.
2. Run the renderer `-List` check and reconcile missing or obsolete render IDs.
3. Regenerate desktop renders, inspect them, and fix screenshot-blocking desktop UI bugs.
4. Regenerate Basic mobile renders, inspect them, and fix screenshot-blocking mobile Basic bugs.
5. Regenerate Advanced mobile renders, inspect them, and fix screenshot-blocking mobile Advanced bugs.
6. Update README and release notes from the completed feature/render matrix.
7. Update desktop and mobile operator manuals with the accepted renders.
8. Update Basic and Advanced workflow docs.
9. Rework in-app walkthroughs and Basic checklist quickrun targets.
10. Rerun visual smoke, guide harness, renderer, and alpha gate.
11. Prune stale renders only after every doc reference is updated.
12. Run final stale-label, missing-link, missing-image, and `git diff --check` passes.

## Done Definition

This release-doc refresh is done when:

- The main-to-mobile-support delta inventory covers all user-facing changes.
- README, desktop manual, mobile manual, Basic workflow, Advanced workflow, documentation index, and alpha release notes all match the current UI and labels.
- Desktop and mobile renders are regenerated from the current renderer matrix.
- No release-facing Markdown references missing images.
- The Basic desktop checklist quickrun reaches a successful first-run state.
- Basic and Advanced walkthroughs have updated desktop and mobile coverage.
- Guide targets resolve in static and browser smoke.
- Mobile docs are sufficient for a user who has never used the desktop UI.
- Stale public terminology is removed or intentionally retained with a clear reason.
- Release-blocking bugs found during render/docs/walkthrough work are fixed and verified.
- `node tools\scripts\run-alpha-gate.mjs` passes, or any failure is documented as unrelated to this release-doc work with evidence.

## Open Decisions

- Whether the README should remain a short front door with 3-6 renders, or include a larger visual tour now that separate desktop and mobile manuals exist.
- Whether all 70 renderer rows should be committed, or whether some should remain verification-only and be removed from the default documentation matrix.
- Whether to add a separate generated `RENDER_INVENTORY.md` mapping every committed PNG to its owning doc section.
- Whether mobile walkthrough copy should share the same step IDs as desktop where targets are equivalent, or introduce explicit mobile-only steps for route/subview education.
- Whether the release notes should stay `0.1.0-alpha.1` or move to a new alpha version before public release from `mobile-support`.
