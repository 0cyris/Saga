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
- Slice 4 has started by saving detector evidence/uncertainty/story-position signals into `state.contextBrief`.

This explains why Harry Potter date workflows can work while One Piece, Star Trek, manga chapters, game quests, and other non-date structures still need detector and UI work before they feel first-class.

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
- Local fallback still mostly looks for dates, headings, canon boundary lines, branch lines, and time-travel hints.
- A narrow `loreContext` is still written for legacy date/canon-boundary consumers, but per-Loredeck resolution uses the richer brief-derived resolver context.
- Reasoner fallback is bounded to known candidates, which is the correct safety direction.

## Module Audit

| Module | Current Role | Current Gap |
| --- | --- | --- |
| `constants.js` | Defines the top-level Context detection prompt. | Prompt now asks for Context Brief; future work is prompt tuning after live provider QA. |
| `lore-generator.js` | Runs Context detection, local fallback, resolver, and canon proposal side effects. | Model output now starts from Context Brief; deterministic fallback is still narrow. |
| `lore-matrix.js` | Normalizes global `loreContext` and Lorecard entry Context gates. | Global `loreContext` intentionally remains a compatibility projection and still drops media fields. |
| `state-manager.js` | Normalizes and stores per-Loredeck `loredeckContexts` and `contextBrief`. | `contextBrief` now stores coordinates and detector signals; UI status metadata is still limited. |
| `context-index.js` | Aggregates timeline registries into searchable anchors/windows. | Slice 2 preserves rich anchor/window media fields; Lorecard-derived event candidates are still deferred/lazy. |
| `context-resolver.js` | Local date/alias resolver and bounded model resolver. | Slice 3 ranks anchors/windows together with structured media scoring; bounded model prompt receives derived fields but not the full nested evidence/uncertainty object yet. |
| `context-gating.js` | Evaluates entry Context gates against active Loredeck Context. | Gate support is broad; Slice 2 fixed empty-stardate coercion. |
| `lore-panel.js` | Context tab and fullscreen Context Workbench/Browser. | Compact Context tab still includes legacy global date/canon-boundary editor. |

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

### 1. Deterministic Fallback Is Still Too Narrow

The model detector output is now broad, but the no-response/parse-failure fallback still only extracts the old shape:

```json
{
  "sceneDate": "",
  "subjectiveDate": "",
  "canonBoundary": "",
  "branchId": "main",
  "timeTravelMode": "none",
  "summary": ""
}
```

It has no structured place for:

- Arc.
- Phase.
- Season.
- Episode.
- Chapter.
- Issue.
- Quest.
- Game stage.
- Stardate.
- Event labels.
- Fandom hints.
- Evidence.
- Uncertainty.

### 2. Global Context Drops Media Fields

`normalizeLoreContext()` keeps only the older global fields. If a detector result contains `arc`, `episode`, or `stardate`, those fields are not preserved on global `loreContext`.

### 3. Bounded Reasoner Prompt Is Still Not A Full Brief

The bounded Reasoner prompt is safe, but `currentStoryContext` currently includes:

- `sceneDate`
- `subjectiveDate`
- `canonBoundary`
- `branchId`
- `timeTravelMode`
- `summary`
- media fields such as arc, season, episode, chapter, quest, game stage, stardate, and coordinates

It does not yet include a full nested Context Brief with evidence and uncertainty.

### 4. Compact Context UI Is Still Legacy-Weighted

The Context tab has useful Loredeck Context and Browser surfaces, but the compact global editor still centers:

- Scene date.
- Canon reference point.
- Branch.

Those should become an advanced/global brief area, not the primary Context model.

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

## Slice 4 Started

The detector redesign has now:

- Replaced the model detector prompt with Context Brief extraction.
- Added `coordinates` to Context Brief signals.
- Exported and tested Context Brief normalization/projection helpers.
- Saved successful detector output to `state.contextBrief`.
- Projected detector output into legacy `loreContext` without letting stale legacy dates leak into fresh non-date briefs.
- Fed brief-derived media/story-position signals into Loredeck Context resolution.
- Kept local fallback behavior conservative and non-destructive when model detection fails.

## Baseline Tests

Phase 1 adds:

```powershell
node scripts\test-context-current-contract.mjs
```

This test now records the upgraded data-model behavior:

- Detector prompt asks for Context Brief signals, evidence, uncertainty, stardate, and coordinates.
- Global `normalizeLoreContext()` still drops media fields by design because it is now a compatibility projection.
- Context Brief normalization preserves media fields and coordinates.
- Brief projection feeds rich resolver context without forcing stardate into `sceneDate`.
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
```

## Contract For The Next Slice

The next Slice 4 increment should harden detector fallback and status behavior:

- Broaden deterministic extraction for obvious arc/chapter/episode/stardate phrases.
- Add a Context Brief repair pass for malformed detector JSON if needed.
- Preserve existing good Context on detection failure.
- Store last detector status/failure metadata for the Context UI.
- Keep model fallback bounded to known candidates and reviewable proposals.
