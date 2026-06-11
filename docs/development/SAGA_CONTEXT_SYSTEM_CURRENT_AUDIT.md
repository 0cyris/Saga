# Saga Context System Current Audit

**SAGA: Fandom Loresystem.**

This audit records the current Context implementation during the broader Context system overhaul. It is a baseline for the remaining detector, resolver, and UI work.

Companion plan: [SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md](SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md).

## Audit Summary

Saga already has meaningful Context infrastructure, but the active runtime path is mixed:

- Lower layers understand many Context shapes.
- The automatic detector now emits a Saga Context Brief, then projects a narrow legacy `loreContext` for older consumers.
- The compact Context UI now starts with a runtime command center and loaded Loredeck Context rows; legacy date/canon-boundary fields are collapsed under Advanced Context Brief.
- Slice 2 now preserves stardate, coordinates, and richer media fields on Loredeck Context state and timeline windows.
- Slice 3 now ranks anchors and windows together with structured scoring for arcs, chapters, episodes, stardates, and coordinates.
- Slice 4 now saves detector evidence/uncertainty/story-position signals into `state.contextBrief`, repairs malformed detector JSON before fallback, surfaces detector status in the Context tab, and feeds compact brief evidence into bounded Reasoner prompts.
- Slice 5 now routes automatic and manual Context checks through the same rich resolver context, stores bounded Reasoner proposals for review, caches repeated checks, protects manual locks, and records resolver audit metadata.
- Slice 7 has started by exposing Manual / Assisted / Automatic Context modes, conservative turn-plus-character cadence, Reasoner fallback controls, and local/model confidence thresholds.
- Slice 7 now also persists skipped background automation audits without overwriting the latest real resolver audit.

This explains why Harry Potter date workflows are already the most mature path while One Piece, Star Trek, manga chapters, game quests, and other non-date structures still need live-provider tuning and Context-tab redesign before they feel first-class.

## Current Runtime Path

```text
Recent chat messages
  -> runLoreContextDetection()
  -> LORE_CONTEXT_DETECTION_SYSTEM_PROMPT
  -> normalizeDetectedContextBrief()
  -> setContextBrief()
  -> buildLoreContextFromContextBrief()
  -> setLoreContext()
  -> buildResolverContextFromContextBrief()
  -> maybeResolveContextsFromContext()
  -> resolveAndApplyContextsFromContext()
  -> optional resolveContextsWithModel()
  -> loredeckContexts proposals or patches
```

Important current behavior:

- The detector asks for a `Context Brief` with summary, branch, time-travel mode, evidence, structured signals, uncertainty, stardate, and coordinates.
- Local fallback now also extracts obvious arc, chapter, issue, season/episode, stardate, quest/mission, game-stage, before/after/during phrases, fandom hints, and simple coordinate lines.
- A narrow `loreContext` is still written for legacy date/canon-boundary consumers, but per-Loredeck resolution uses the richer brief-derived resolver context.
- Reasoner fallback is bounded to known candidates, which is the correct safety direction.

## Module Audit

| Module | Current Role | Current Gap |
| --- | --- | --- |
| `src/state/constants.js` | Defines the top-level Context detection prompt. | Prompt now asks for Context Brief; future work is prompt tuning after live provider QA. |
| `src/lorecards/lore-generator.js` | Runs Context detection, repair, local fallback, resolver, and canon proposal side effects. | Model output and deterministic fallback both produce Context Briefs; remaining work is live-provider prompt tuning. |
| `lore-matrix.js` | Normalizes global `loreContext` and Lorecard entry Context gates. | Global `loreContext` intentionally remains a compatibility projection and still drops media fields. |
| `src/state/state-manager.js` | Normalizes and stores per-Loredeck `loredeckContexts` and `contextBrief`. | `contextBrief` now stores coordinates, detector signals, and detector status metadata. |
| `src/context/context-index.js` | Aggregates timeline registries into searchable anchors/windows. | Slice 2 preserves rich anchor/window media fields; Lorecard-derived event candidates are still deferred/lazy. |
| `src/context/context-resolver.js` | Local structured resolver and bounded model resolver. | Slice 5 uses rich Context Brief signals for automatic/manual resolution, caches repeated checks, blocks duplicate in-flight model calls, and audits lock/low-confidence/proposal outcomes. |
| `context-gating.js` | Evaluates entry Context gates against active Loredeck Context. | Gate support is broad; Slice 2 fixed empty-stardate coercion. |
| `src/runtime/lore-panel.js` | Context tab and fullscreen Context Workbench/Browser. | Slice 6 first pass now makes the command center and loaded Loredeck Context rows primary; remaining work is live visual QA and proposal-review UX refinement. |

## What Works Today

### Context Gates

The gate engine can evaluate:

- Anchor matches.
- Anchor window matches.
- Sort-key ranges.
- Arc/phase.
- Season/episode.
- Chapter/issue.
- Quest/game stage.
- Stardate ranges.
- Coordinates.

This is a strong foundation for Saga.

### Context Index

The index can load:

- Built-in Loredeck timeline registries.
- Custom/Generated embedded timeline registries.
- Folder-based stack items.
- Anchor aliases/tags.
- Anchor media fields.
- Window media fields.
- Stardates and coordinates.

### Resolver Safety

The model resolver already uses bounded known candidates and rejects invented candidate IDs. This should remain a hard design rule.

## Known Current Gaps

### 1. Deterministic Fallback Is Pattern-Based, Not Semantic

The no-response/parse-failure fallback now produces the same Context Brief shape as the detector and extracts obvious non-date signals:

- Arc and phase phrasing.
- Season/episode.
- Chapter and issue.
- Quest/mission.
- Game stage.
- Stardate.
- Before/after/during position phrases.
- Fandom hints.
- Simple coordinate lines such as `Series: TNG` or `Saga: East Blue`.
- Evidence and uncertainty metadata.

This is intentionally conservative. It is useful for explicit structure, but it should not try to understand vague fandom prose. Ambiguous cases should flow to local candidate ranking and bounded Reasoner proposals.

### 2. Global Context Drops Media Fields

`normalizeLoreContext()` keeps only the older global fields. If a detector result contains `arc`, `episode`, or `stardate`, those fields are not preserved on global `loreContext`.

### 3. Bounded Reasoner Prompt Is Compact, Not Freeform

The bounded Reasoner prompt is safe and now includes `currentStoryContext.contextBrief`, but it is intentionally compact. `currentStoryContext` includes:

- `sceneDate`
- `subjectiveDate`
- `canonBoundary`
- `branchId`
- `timeTravelMode`
- `summary`
- media fields such as arc, season, episode, chapter, quest, game stage, stardate, and coordinates
- compact Context Brief summary, evidence, uncertainty, source, detector status, and limited signal lists

It still must choose only from known candidate IDs and cannot invent timeline facts from the brief.

### 4. Context Tab Needs Narrow And Provider QA

The Context tab now foregrounds:

- Runtime command center.
- Browser, Detect, and Review Proposals primary actions.
- Loaded Loredeck Context rows.
- Manual Lock/Unlock controls.
- Last resolver audit and detector status.
- Collapsed Advanced Context Brief for legacy global date/canon fields.

The live installed shelf has passed empty-stack, loaded-stack, and compact loaded-stack Context smoke. The remaining risk is live-provider status copy and behavior when the Reasoner handles loose non-date fandom phrasing.

## Slice 2 Resolved Gaps

The data-model upgrade has now:

- Added default and migrated `contextBrief` state.
- Added first-class `stardate` to Loredeck Context.
- Added `coordinates` to Loredeck Context.
- Preserved structured media fields on timeline windows.
- Preserved stardate metadata on timeline anchors/windows.
- Included stardate and coordinates in resolver text and bounded model candidate payloads.
- Fixed empty current stardate handling so missing stardate returns unresolved instead of numeric-zero mismatch.

## Slice 3 Resolved Gaps

The Context Index/resolver upgrade has now:

- Ranked anchors and windows as one candidate stream for local resolution and bounded model prompts.
- Scored `arc`, `phase`, `season`, `episode`, `chapter`, `issue`, `quest`, `gameStage`, `stardate`, and deck-defined `coordinates` directly.
- Allowed numeric chapter/issue queries to match range windows.
- Allowed exact stardate queries to prefer precise anchors while broad season/stardate-range queries can prefer windows.
- Replaced the local alias resolver's anchor-only path with the shared anchor/window candidate builder.
- Preserved stronger duplicate candidate scores when a candidate is found by multiple routes.

## Slice 4 Progress

The detector redesign has now:

- Replaced the model detector prompt with Context Brief extraction.
- Added `coordinates` to Context Brief signals.
- Exported and tested Context Brief normalization/projection helpers.
- Saved successful detector output to `state.contextBrief`.
- Projected detector output into legacy `loreContext` without letting stale legacy dates leak into fresh non-date briefs.
- Fed brief-derived media/story-position signals into Loredeck Context resolution.
- Expanded local fallback to populate Context Brief signals for obvious non-date structures.
- Added a Context Brief-specific repair pass for malformed detector JSON before local fallback.
- Added `contextBrief.status` metadata for detected, repaired, fallback, empty, and failed detector outcomes.
- Kept local fallback behavior conservative and non-destructive when model detection fails.

## Slice 5 Progress

The resolver orchestration upgrade has now:

- Shared rich Context Brief-to-resolver conversion between automatic and manual Context actions.
- Kept local auto-apply conservative with a high-confidence threshold.
- Routed weak local matches to bounded Reasoner proposal review instead of silently applying them.
- Preserved existing proposal review state when duplicate model calls are skipped as in-flight.
- Stored repeated-check cache records in `lorePanel.contextResolutionCache`.
- Returned cached unresolved/proposed checks without another provider call.
- Stored `contextResolutionAudit` records for local applied, proposed, cached, skipped locked, skipped low-confidence, unresolved, and in-flight outcomes.
- Surfaced the latest resolver audit in the Context tab as a compact Last Resolver Check strip.
- Added deterministic tests for local lock protection, model lock protection, in-flight audit state, cache reuse, proposal persistence smoke coverage, low-confidence skips, and invented-candidate rejection.

## Slice 6 Progress

The first Context tab redesign slice has now:

- Replaced the old rendered detection-card-first layout with a Phase 6 runtime command center.
- Exposed `Browse Context`, `Detect Context`, and `Review Proposals` as the primary Context actions.
- Kept local resolver and Reasoner actions visible but secondary.
- Moved automation controls into a compact panel inside the command center.
- Made loaded Loredeck Context rows the main runtime state surface.
- Added row-level Lock/Unlock controls without resetting existing coordinates.
- Added last-updated and anchor/window coverage chips to loaded Context rows.
- Removed the compact row quick-anchor search in favor of the fullscreen Context Browser.
- Added a dedicated fullscreen Context Proposal Review overlay for bounded Reasoner proposals.
- Added proposal patch summaries plus Apply All, Dismiss All, and per-proposal Apply/Dismiss actions.
- Upgraded `Seed From Brief` to copy rich Context Brief fields, including arc, season/episode, chapter, quest, stardate, and coordinates.
- Moved legacy global `Scene date`, `Canon reference point`, and `Branch` fields into a collapsed `Advanced Context Brief` section with signal diagnostics.
- Reworded adjacent Lore/canon-preview UI copy so date/canon-boundary is described as a legacy global Context projection, not the whole Context model.

## Slice 7 Progress

The first automation settings slice has now:

- Added `assisted` as a first-class Context automation mode in the Context command center.
- Migrated old 5-turn Context automation defaults to Saga's conservative cadence when users have not customized them.
- Added minimum-turn, maximum-turn, and new-character thresholds for automatic Context checks.
- Added a Reasoner fallback toggle plus a minimum recent-message character threshold before automatic Reasoner proposals are requested.
- Exposed local auto-apply confidence and bounded Reasoner proposal confidence settings.
- Passed those confidence settings into automatic detection, manual local resolve, and manual Reasoner resolve paths.
- Locked the alpha policy: high-confidence local Context can apply automatically when unlocked, but model-derived Reasoner Context remains reviewable proposals and never silently applies.
- Added `contextAutomationAudit` records for background checks skipped by Manual mode, cadence, no loaded Loredecks, all locked Loredecks, and missing provider settings.
- Added resolver audit handling for disabled Reasoner fallback when local Context resolution leaves Loredecks unresolved.
- Added a compact `Last Automation Check` surface in the Context command center so users can see why a background check did or did not run.

## Baseline Tests

Phase 1 adds:

```powershell
node tools\scripts\test-context-current-contract.mjs
```

This test now records the upgraded data-model behavior:

- Detector prompt asks for Context Brief signals, evidence, uncertainty, stardate, and coordinates.
- Global `normalizeLoreContext()` still drops media fields by design because it is now a compatibility projection.
- Context Brief normalization preserves media fields and coordinates.
- Context Brief status metadata preserves detector state, repair/fallback flags, errors, and bounded raw response previews.
- Brief projection feeds rich resolver context without forcing stardate into `sceneDate`.
- Bounded Reasoner prompts include compact nested Context Brief evidence, uncertainty, source, and status without allowing candidate invention.
- The Context tab surfaces the latest `contextBrief.status` in the detector card.
- Default state includes `contextBrief`.
- Per-Loredeck Context preserves `stardate` and `coordinates`.
- Anchors and windows preserve media fields, stardates, and coordinates.
- Resolver text/model prompt include stardate and coordinates.
- Raw and normalized stardate/coordinate gates can match.
- Missing stardate now returns unresolved.

Related context tests:

```powershell
node tools\scripts\test-context-gating.mjs
node tools\scripts\test-context-resolver.mjs
node tools\scripts\test-context-model-resolver.mjs
node tools\scripts\test-context-cross-fandom-fixtures.mjs
node tools\scripts\test-context-hp-phrase-fixtures.mjs
node tools\scripts\test-lore-context-normalization.mjs
node tools\scripts\test-context-media-scoring.mjs
node tools\scripts\test-context-local-extraction.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

`test-context-cross-fandom-fixtures.mjs` covers One Piece arc/chapter Context, Star Trek TNG episode/stardate Context, Star Trek VOY two-part episode-window Context, mocked Reasoner proposal review, manual-lock protection, and Context-gate eligibility movement.

`test-context-hp-phrase-fixtures.mjs` covers the brittle natural-language HP phrases from the Story Position/Context discussion, including post-Christmas Year 6, Ron/Lavender as "the blonde girl", first Hogsmeade, Voldemort's return, and the common `Cedrick` misspelling.

## Contract For The Next Slice

The next Context increments should focus on live-provider tuning:

- Keep deterministic fixtures current for non-HP Context shapes, including arcs/chapters, episodes, and stardates.
- Keep live-provider tuning as QA after the redesigned surface makes status and proposals understandable.

Latest local SillyTavern Context check: after syncing the active installed extension copy from this repo, `SAGA_SMOKE_TARGET=live-context node tools\scripts\smoke-live-st-cdp.mjs` passed against `http://127.0.0.1:8000/` with no findings, no console errors, and no browser dialogs. It produced `live-context-01-context-tab.png`, verified the Runtime Context command center, Browser/Detect/Review actions, Manual/Assisted/Automatic modes, Advanced Context Brief, absence of the old date/canon-boundary-first tooltip, and safe guard states for Browser/Proposal Review when no Loredecks are enabled.

Latest loaded-stack SillyTavern Context check: `SAGA_SMOKE_TARGET=live-context-loaded node tools\scripts\smoke-live-st-cdp.mjs` temporarily loaded `hp-year-6-half-blood-prince` through the real Loredeck Library UI, opened the Context Browser, verified `Ron dates the blonde girl` finds `Ron Lavender Start`, applied `Post Christmas Return` as After and `Apparition Lessons Begin` as Before, verified the saved manual locked Context window, opened a populated synthetic Context Proposal Review row, restored the original Saga metadata, and passed with no findings, console errors, or browser dialogs. It produced `live-context-loaded-01-context-tab.png`, `live-context-loaded-02-workbench.png`, and `live-context-loaded-03-proposals.png`.

Latest compact loaded-stack SillyTavern Context check: `SAGA_SMOKE_TARGET=live-context-loaded-narrow node tools\scripts\smoke-live-st-cdp.mjs` ran the same loaded-stack workflow at the compact default viewport, restored the original Saga metadata, and passed with no findings, console errors, or browser dialogs. It produced `live-context-loaded-narrow-01-context-tab.png`, `live-context-loaded-narrow-02-workbench.png`, and `live-context-loaded-narrow-03-proposals.png`.

Opt-in live-provider Context Reasoner QA is now wired through `SAGA_SMOKE_TARGET=live-context-reasoner`. It is intentionally gated by `SAGA_ALLOW_PROVIDER_CALLS=1` so routine visual smoke runs do not spend provider tokens. When enabled, the target snapshots chat metadata and extension settings, temporarily loads HP Year 6, seeds a loose non-date Context Brief, raises local auto-apply confidence, clicks the real `Ask Reasoner` control, verifies bounded proposal state, captures `live-context-reasoner-01-result.png` plus `live-context-reasoner-02-proposals.png` when proposals render, and restores metadata/settings. This target still needs a live run against the user's configured Reasoning Provider.

Repo-local visual smoke has started independently of the installed ST copy: `tests/browser/visual-smoke.html?tab=context` opens the Context tab, and `tests/browser/visual-smoke.html?tab=context&review=context-proposals` opens the seeded Context Proposal Review path through the local harness.

Automated repo-local Context visual smoke is now available through `SAGA_SMOKE_TARGET=context-harness node tools\scripts\smoke-live-st-cdp.mjs`. The latest pass produced `context-harness-01-proposal-review.png` and `context-harness-02-workbench.png` with no findings or console errors, and it caught/fixed a `Selected Range` overlap in the Context Workbench story-position picker.
