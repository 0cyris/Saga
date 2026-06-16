# Saga Public Release Change Inventory

Status: working release-audit ledger for the `mobile-support` public documentation refresh.

Baseline: `main` at `b1b8efd08bf1cc3a0a992a619012bcd75a4b69b9`.

Release candidate: `mobile-support` at `416e76f7a0c4e6913719ed95950a5981e9b1e394`.

## Audit Summary

`mobile-support` changes Saga from a desktop-first alpha surface into a desktop plus phone-width release candidate. The user-facing changes are not limited to the mobile shell: the branch also changes Lorecards control language, mobile object workflows, Lore Automation, Deck Maker progress/recovery, Context walkthrough coverage, Pack Health, storage safety, and the screenshot-backed documentation set.

At the start of this execution pass:

- `git diff --stat main...mobile-support` reported `122 files changed`, about `29,919 insertions`, and `3,669 deletions`.
- `.saga-doc-renderer/render-all.ps1` defined `70` render rows.
- `assets/documentation/renders` contained `47` committed top-level documentation PNGs.
- `23` render rows were missing committed outputs and must be generated or intentionally removed from the matrix.

## Change Matrix

| Change | User value | Source evidence | Desktop render | Mobile render | README impact | Manual/workflow impact | Walkthrough/checklist impact | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Phone-width mobile shell | Users can operate Saga on phones without using the desktop rail/drawer. | `src/runtime/runtime-shell.js`, `src/runtime/runtime-shell-view.js`, `src/runtime/runtime-navigation.js`, `styles/layout.css`, `docs/development/SAGA_MOBILE_SUPPORT_FEATURE.md` | Desktop preservation renders stay required. | `docs-mobile-basic-shell-start`, `docs-mobile-advanced-session-root` | Add mobile shell as shipped alpha capability; remove mobile support from roadmap. | Mobile manual starts from bottom navigation, `Exit`, Back, subviews, and detail sheets. | Mobile guide targets must not assume desktop rail knowledge. | Renderer matrix, mobile-redesign harness, mobile-advanced harness, live ST mobile smoke. |
| Basic mobile routes | Basic phone users get a complete roleplay loop through `Loredecks`, `Session`, `Context`, `Lorecards`, and `Settings`. | Runtime route filtering, `src/state/basic-profile.js`, mobile smoke assertions | `docs-shell-basic-start` | `docs-mobile-basic-*` family | Fast Start should mention Basic works on desktop and mobile. | Basic workflow and mobile manual must describe a full phone-first loop. | Basic checklist and Basic Walkthrough must route only to Basic-visible surfaces. | `test-visual-smoke-harness.mjs`, guide harness, renderer. |
| Advanced mobile routes | Advanced phone users can directly reach `Continuity` and `Injection` without an overflow menu. | Runtime navigation, mobile smoke assertions | `docs-session-advanced-status`, desktop Injection/Continuity renders | `docs-mobile-advanced-continuity-*`, `docs-mobile-advanced-injection-*` | Key Features should describe full Advanced diagnostics. | Mobile manual must explain why Continuity and Injection are Advanced-only. | Advanced walkthrough should cover route differences and direct mobile routes. | mobile-advanced harness, renderer. |
| Mobile Library touch workflow | Users browse, add, inspect, reorder, and validate Loredecks with tap order, long-press details, and sheets. | `src/loredecks/loredeck-library-panel.js`, `styles/review.css`, mobile touch redesign doc | Library overview, stack, selected details | `docs-mobile-basic-library-*`, `docs-mobile-advanced-library-*` | Loredeck Library feature needs mobile detail-sheet wording. | Mobile manual must teach tap versus long-press. Desktop manual must keep desktop controls. | Basic checklist Library mini-tour must land on the right mobile or desktop targets. | Renderer rows, mobile-redesign harness. |
| Mobile Lorecards workflow | Phone Lorecards use `Lore`, `Generate`, and Advanced `Automation` sub-tabs with object rows and long-press editing. | `src/lorecards/lorecards-panel.js`, `styles/review.css` | Lorecards overview/list/workbench/timeline | `docs-mobile-basic-lorecards-*`, `docs-mobile-advanced-lorecards-*` | Lorecard System should describe sub-tabs, review, Elevate, Mute, and automation. | Mobile manual must explain sub-tabs, Pending Review, Accepted rows, long-press editor, and tap relevance. | Basic and Advanced guide copy should cover mobile as a first-class workflow. | Renderer rows, mobile-redesign harness, guide harness. |
| Elevate and Mute control language | Users get one clear Accepted Lorecard control model: relevance tier, Mute, and Elevate/protection. | `src/lorecards/lore-selection.js`, `src/lorecards/lorecards-panel.js`, `docs/development/SAGA_LORECARDS_CONTROL_REVISION_PLAN.md` | Accepted list/workbench | Mobile Lorecards editor and Lore list | Replace stale `pin/pinned` public wording with `Elevate` and `Mute`. | Desktop/mobile manuals and Basic/Advanced workflow docs must use current labels. | Walkthrough step `basic-lorecards-pin-mute` and Advanced `advanced-lore-pin-mute` already present as Elevate/Mute copy, but stale docs must be fixed. | Stale-label `rg`, visual smoke source assertions, renderer inspection. |
| Lore Automation levels | Advanced users can choose Lore Automation authority levels and inspect/review automation activity. | `src/lorecards/lore-automation.js`, `src/context/auto-relevance.js`, `tools/scripts/test-lore-automation-levels.mjs` | Lorecards overview/accepted list | `docs-mobile-advanced-lorecards-automation` | Feature table and release notes need automation as implemented behavior. | Advanced workflow and manuals must explain inspectable/reversible automation and Elevated protection. | Advanced walkthrough has `advanced-lore-auto-relevance`; mobile Automation page needs guide coverage. | `test-lore-automation-levels.mjs`, visual smoke, live automation smoke where available. |
| Context Workbench and Phrase Resolver | Operators can set story position manually, resolve loose phrases, review proposals, and keep Context current. | `src/context/context-panel.js`, `src/context/context-workbench-panel.js`, `src/runtime/runtime-guide-content.js` | Context command center, loaded rows, workbench, proposals | Basic/Advanced mobile Context rows and overlays | README should identify Context as a core feature. | Basic workflow must teach `Start Here`, `Use Window`, `Use Anchor`, `After`, `Before`, `Timeline`, `Phrase Resolver`. | Context tour targets must remain button-level and mobile-resolvable. | `test-visual-smoke-harness.mjs`, guide harness, live-context, live-context-loaded. |
| Deck Maker staged authoring and recovery | Generated Lorepacks are created through reviewable stages with progress, retries, draft review, readiness, and finalization. | `src/loredecks/loredeck-creator-panel.js`, `src/state/lore-creator-state.js`, Creator live test docs | Deck Maker intake/current task | `docs-mobile-advanced-creator` | Feature table and release notes should mention staged workflow and recovery. | Desktop and mobile manuals should not describe one-shot generation. | Advanced walkthrough covers Deck Maker stages and fallback states. | Deck Maker project tests, guide harness, optional live-creator provider smoke. |
| Pack Health Center | Users can validate, inspect, repair, accept, verify, and report Lorepack structural issues. | `src/loredecks/loredeck-health-panel.js`, `src/runtime/loredeck-editor-actions.js` | Pack Health overview/issues | Basic/Advanced mobile Pack Health rows | Use `Pack Health`, not stale `Deck Health`. | Manuals and workflows must separate structural health from canon truth. | Advanced Pack Health walkthrough and Basic handoff need current wording. | Pack Health tests, renderer rows, visual smoke. |
| Settings, providers, State Safety, Danger Zone | Users configure providers, current model routing, themes, storage verification, and scoped cleanup in Settings. | `src/settings/runtime-settings-tab.js`, `src/settings/settings-panel.js`, `src/runtime/runtime-safety-panel.js`, `docs/user/STORAGE_AND_STATE_SAFETY.md` | Settings provider/theme renders | Mobile Settings provider/theme rows | README Security and Storage sections need current guidance. | Manuals must place Experience Mode, providers, Theme Pack, State Safety, and cleanup correctly. | Basic Settings handoff and Advanced Settings track need coverage. | manifest alpha test, visual smoke, live ST settings smoke. |
| Renderer matrix expansion | Docs now need a desktop plus mobile screenshot set rather than a desktop-only README set. | `.saga-doc-renderer/render-all.ps1`, `.saga-doc-renderer/README.md` | 30 desktop rows | 40 mobile rows | README should use a small curated subset and link manuals. | Manuals own the larger screenshot set. | Walkthrough screenshots come from renderer and guide harness. | `render-all.ps1`, `render-report.json`, missing-image scan. |

## Missing Render Outputs

These rows exist in `.saga-doc-renderer/render-all.ps1` but do not yet have top-level committed PNGs:

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

Decision: keep these rows in the matrix for now and generate the missing outputs during the render refresh. If a row proves redundant after visual inspection, remove it from `render-all.ps1` and rerun `-PruneOutput` only after docs no longer reference it.

## Stale Public Wording Audit

Current public wording decisions:

- Use `Elevate`, `Elevated`, `Remove Elevation`, `Mute`, and `Muted` for Accepted Lorecard controls.
- Do not use `Pin`, `Pinned`, `Active Set`, `Activate`, or `Disable Lore Automation` in release-facing docs except when explicitly describing old internal state names or historical plans.
- Use `Pack Health`, not `Deck Health`.
- Use `Saga for Desktop Operator's Manual` and `Saga for Mobile Operator's Manual`, not the old singular `Operator's Manual`.
- Treat mobile support as implemented alpha functionality, not a roadmap item.

Verification command:

```powershell
rg -n "Deck Health|OPERATOR_MANUAL|Active Set|Pinned|\\bPin\\b|Activate|Disable Lore Automation|Mobile Support" README.md docs/user docs/release docs/DOCUMENTATION_INDEX.md
```

## Completion Evidence To Collect

- Updated README, user docs, release notes, and documentation index.
- Generated `assets/documentation/renders/render-report.json` with no failed rows.
- Generated top-level PNGs for all accepted render matrix rows.
- Passing stale-public-wording scan or documented intentional exceptions.
- Passing missing-image-reference scan.
- Passing `node tools/scripts/test-manifest-alpha.mjs`.
- Passing `node tools/scripts/test-visual-smoke-harness.mjs`.
- Passing guide harness smoke.
- Passing `node tools/scripts/run-alpha-gate.mjs`.
- Live SillyTavern smoke against `http://127.0.0.1:8000/`.
