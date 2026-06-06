# Saga Context System Current Audit

**SAGA: Fandom Loresystem.**

This audit records the current Context implementation during the broader Context system overhaul. It is a baseline for the remaining detector, resolver, and UI work.

Companion plan: [SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md](SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md).

## Audit Summary

Saga already has meaningful Context infrastructure, but the active runtime path is mixed:

- Lower layers understand many Context shapes.
- The automatic detector now emits a Saga Context Brief, then projects a narrow legacy `loreContext` for older consumers.
- The compact Context UI still foregrounds date/canon-boundary fields.
- Slice 2 now preserves stardate, coordinates, and richer media fields on Loredeck Context state and timeline windows.
- Slice 3 now ranks anchors and windows together with structured scoring for arcs, chapters, episodes, stardates, and coordinates.
- Slice 4 now saves detector evidence/uncertainty/story-position signals into `state.contextBrief`, repairs malformed detector JSON before fallback, surfaces detector status in the Context tab, and feeds compact brief evidence into bounded Reasoner prompts.
- Slice 5 now routes automatic and manual Context checks through the same rich resolver context, stores bounded Reasoner proposals for review, caches repeated checks, protects manual locks, and records resolver audit metadata.

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
| `constants.js` | Defines the top-level Context detection prompt. | Prompt now asks for Context Brief; future work is prompt tuning after live provider QA. |
| `lore-generator.js` | Runs Context detection, repair, local fallback, resolver, and canon proposal side effects. | Model output and deterministic fallback both produce Context Briefs; remaining work is live-provider prompt tuning. |
| `lore-matrix.js` | Normalizes global `loreContext` and Lorecard entry Context gates. | Global `loreContext` intentionally remains a compatibility projection and still drops media fields. |
| `state-manager.js` | Normalizes and stores per-Loredeck `loredeckContexts` and `contextBrief`. | `contextBrief` now stores coordinates, detector signals, and detector status metadata. |
| `context-index.js` | Aggregates timeline registries into searchable anchors/windows. | Slice 2 preserves rich anchor/window media fields; Lorecard-derived event candidates are still deferred/lazy. |
| `context-resolver.js` | Local structured resolver and bounded model resolver. | Slice 5 uses rich Context Brief signals for automatic/manual resolution, caches repeated checks, blocks duplicate in-flight model calls, and audits lock/low-confidence/proposal outcomes. |
| `context-gating.js` | Evaluates entry Context gates against active Loredeck Context. | Gate support is broad; Slice 2 fixed empty-stardate coercion. |
| `lore-panel.js` | Context tab and fullscreen Context Workbench/Browser. | Compact Context tab now surfaces detector status, but still includes legacy global date/canon-boundary editor. |

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

### 4. Compact Context UI Is Still Legacy-Weighted

The Context tab has useful Loredeck Context and Browser surfaces, but the compact global editor still centers:

- Scene date.
- Canon reference point.
- Branch.

Those should become an advanced/global brief area, not the primary Context model.

### 5. Context Tab Needs Slice 6 Redesign

Resolver internals are now ahead of the compact UI. The Context tab should foreground per-Loredeck Context rows, proposal review, locks, last-check audit, automation mode, and Browser access. Legacy global date/canon-boundary fields should move into an advanced brief section.

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

## Baseline Tests

Phase 1 adds:

```powershell
node scripts\test-context-current-contract.mjs
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
node scripts\test-context-gating.mjs
node scripts\test-context-resolver.mjs
node scripts\test-context-model-resolver.mjs
node scripts\test-lore-context-normalization.mjs
node scripts\test-context-media-scoring.mjs
node scripts\test-context-local-extraction.mjs
node scripts\test-visual-smoke-harness.mjs
```

## Contract For The Next Slice

Slice 6 should redesign the Context tab around the Saga mental model:

- Loaded Loredeck Context rows as the primary surface.
- Browser, Detect, and Review Proposals as the primary actions.
- Manual locks and latest resolver audit visible at a glance.
- Automation mode/cadence controls grouped clearly.
- Legacy global date/canon-boundary fields moved to an advanced Context Brief section.
- Live-provider tuning treated as QA after the redesigned surface makes status and proposals understandable.
