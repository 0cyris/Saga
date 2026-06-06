# Saga Context System Development Plan

**SAGA: Fandom Loresystem.**

## Purpose

This document defines the next Context development phase before expanding deterministic integration testing.

Saga's Context system must answer one runtime question:

> Where is this chat inside each loaded Loredeck's story?

The answer cannot be treated as a date. Dates are one possible coordinate. Saga must also support arcs, chapters, episodes, quests, game stages, stardates, branches, relationship routes, and broader story windows.

The current system has useful pieces, especially Loredeck-local Context state, timeline registries, anchors/windows, Context gates, and bounded Reasoner proposals. The next phase is to make the active detection workflow and the Context tab match that broader Saga model.

## Current Diagnosis

As of this planning pass, Context support is split between newer Saga infrastructure and older Wandlight-shaped runtime detection.

Strong pieces already present:

- Loredeck-local `loredeckContexts`.
- Timeline registries with anchors and windows.
- Context Index loading and anchor ranking.
- Context gates on Lorecards.
- Gate evaluation for anchors, windows, arcs, phases, season/episode, chapters, issues, quests, game stages, stardate ranges, and coordinates.
- Fullscreen Context Workbench/Browser surfaces.
- Bounded Reasoner proposal flow that chooses from known candidates instead of inventing active Context.

Weak or incomplete pieces:

- Slice 4 has started: the top-level detector now asks for a Context Brief with evidence, uncertainty, media/story-position signals, stardate, and coordinates.
- The global `loreContext` object intentionally remains date/canon-boundary oriented as a compatibility projection for older canon DB and UI readers.
- The deterministic fallback still mostly extracts dates, headings, canon boundary lines, branch lines, and time-travel hints.
- Slice 3 scores stardates, coordinates, arcs, chapters, and season/episode queries across anchors and windows before model fallback.
- The main Context tab still exposes legacy-feeling date/canon-boundary controls beside newer Browser controls.
- Automatic detection now saves `contextBrief` and resolves Loredeck Context from rich brief signals, but JSON repair/status UX still need more hardening.

This is good enough for date-heavy Harry Potter workflows, but not enough for One Piece, Star Trek, manga/anime chapter structures, games, comics, or loose cinematic timelines.

## Product Contract

The Context system should provide:

- Manual Context selection for users who know where they want to start.
- Automatic or assisted Context detection for users who want Saga to keep up with story progression.
- Per-Loredeck Context, because each loaded deck can use different story axes.
- Bounded model resolution, never open-ended timeline invention.
- Conservative background behavior so model calls do not stall SillyTavern.
- Clear review before applying uncertain model-derived changes.
- Manual locks that automatic detection never overwrites.
- A clean Context tab that exposes runtime Context, not deck-authoring internals.

## Story Shapes To Support

| Story Shape | Primary Context Axes | Notes |
| --- | --- | --- |
| Harry Potter / school-year canon | Dates, school years, books, chapters, recurring school events, specific anchors. | Dates are useful, but after/before windows remain important. |
| One Piece / long arc anime-manga | Saga, arc, island, chapter, episode, crew state, key reveals. | Avoid exhaustive aliases. Use high-value anchors/windows plus bounded Reasoner. |
| Star Trek TNG / VOY / DS9 | Series, season, episode, stardate, mission, status quo changes. | Episode/series order should be authoritative; stardates are supporting metadata because they are inconsistent. |
| MCU / DC film continuity | Films, phases, major events, public knowledge, team state. | Dates may be vague or contradictory; use event windows. |
| Manga/anime arcs | Arcs, incidents, chapters, episodes, training/battle stages. | Chapter/episode coordinates are useful, but exact adaptation mapping may be fuzzy. |
| Games | Quest, mission, act, route, faction state, ending branch. | Player choice means branch and route matter. |
| Comics / Legends EU | Era, run, issue, arc, faction state, character allegiance. | Continuity can be messy; Loredeck scope should remain narrow. |
| Crossovers / AU | Loaded-deck Contexts plus Custom deck branch state. | Custom Loredecks can define their own anchors/windows without special "bridge" terminology. |

## Target Data Model

Saga should distinguish a lightweight global scene brief from the authoritative per-Loredeck Contexts.

### Global Context Brief

The Context detector should produce a compact brief from recent chat messages. It should not try to solve every loaded Loredeck directly.

Recommended shape:

```json
{
  "schemaVersion": 1,
  "summary": "short scene-position summary",
  "branchId": "main",
  "timeTravelMode": "none|visitor_from_future|past_changed|alternate_branch",
  "evidence": [
    {
      "quote": "short phrase from recent chat",
      "signal": "date|arc|episode|chapter|event|timeskip|branch|uncertainty"
    }
  ],
  "signals": {
    "sceneDate": "",
    "subjectiveDate": "",
    "canonBoundary": "",
    "positionPhrases": [],
    "fandomHints": [],
    "arc": "",
    "phase": "",
    "season": "",
    "episode": "",
    "chapter": "",
    "issue": "",
    "quest": "",
    "gameStage": "",
    "stardate": "",
    "coordinates": {},
    "eventLabels": []
  },
  "uncertainty": {
    "level": "low|medium|high",
    "notes": []
  }
}
```

This object is an extraction product, not the final authority.

### Per-Loredeck Context

Each loaded Loredeck should store its own active Context:

```json
{
  "schemaVersion": 1,
  "packId": "one-piece-arlong-park",
  "contextType": "anchor_window",
  "label": "After Nami asks Luffy for help, before the march to Arlong Park",
  "sceneDate": "",
  "subjectiveDate": "",
  "stardate": "",
  "contextSortKey": null,
  "contextSortKeyFrom": 420,
  "contextSortKeyTo": 450,
  "anchorId": "",
  "anchorFrom": "op.arlong.nami-asks-luffy-for-help",
  "anchorTo": "op.arlong.walk-to-arlong-park",
  "arc": "Arlong Park",
  "phase": "Cocoyasi confrontation",
  "season": "",
  "episode": "",
  "chapter": "",
  "issue": "",
  "quest": "",
  "gameStage": "",
  "coordinates": {
    "saga": "East Blue",
    "location": "Cocoyasi Village"
  },
  "branchId": "main",
  "confidence": 0.92,
  "source": "manual|local|reasoner|detector|imported",
  "manualLock": false,
  "updatedAt": 0
}
```

Needed schema updates:

- Add first-class `stardate` to Loredeck Context.
- Preserve `coordinates` on Loredeck Context, not only on entry gates.
- Make timeline windows preserve structured media fields where useful: arc, phase, season, episode, chapter, issue, quest, game stage, coordinates, date range, and stardate range.
- Keep broad/wide Contexts valid. A Lorecard can intentionally span an entire deck, arc, year, season, or series if its retrieval policy and Context gate say so.

## Resolution Pipeline

The core workflow should be layered from cheapest and most trusted to most expensive and uncertain.

### 1. Manual Selection

Manual selection is the highest-trust path.

Users can:

- Open the Context Browser.
- Search anchors, windows, dates, arcs, episodes, chapters, quests, or events.
- Choose `Start Here`.
- Build an after/before window.
- Lock one or more Loredeck Contexts.

Manual locks protect against automatic overwrite.

### 2. Structured Extraction

Saga performs a cheap pass over recent messages and current state:

- Explicit date lines.
- Known scene heading style.
- Large time jumps.
- Arc/chapter/episode/stardate phrasing.
- Named events.
- Branch/AU/time-travel signals.
- Existing current Context.

This pass can be deterministic first, then model-backed only when needed.

### 3. Local Candidate Resolution

Saga uses the Context Index and loaded Loredeck stack to rank candidates:

- Exact anchor/window IDs.
- Labels.
- Tags.
- Aliases.
- Dates and sort keys.
- Arc/phase/season/episode/chapter fields.
- Lorecard-derived event waypoints when explicitly loaded or when cheap enough.

Local matching should generate candidates, not pretend to understand every casual phrase.

As of Slice 3, local candidate generation treats anchors and windows as one ranked candidate stream. Structured media fields are scored directly:

- `arc` and `phase` promote broader windows for arc-level queries.
- `chapter` and `issue` can match exact points or numeric ranges.
- `season` and `episode` support both episode anchors and season windows.
- `stardate` supports exact anchor matches and range window matches.
- `coordinates` help disambiguate series, saga, island, location, route, or other deck-defined axes.

This means a broad query such as `Arlong Park, chapter 82` can resolve to the Arlong Park window, while a precise query such as `Darmok, stardate 45047.2` resolves to the episode anchor.

### 4. Bounded Reasoner Resolution

Only when local resolution is weak, ambiguous, or user-requested, Saga asks the Reasoner Provider.

The model receives:

- Current Context Brief.
- Previous per-Loredeck Context.
- Recent message excerpt or compact recent delta.
- Top bounded candidates per loaded Loredeck.
- Candidate IDs, labels, aliases, metadata, and short descriptions.

The model must return:

- `resolved` with candidate ID.
- `unresolved` with reason.
- Optional clarification question.

The model must not invent anchors, windows, dates, arcs, episodes, chapters, or stardates as active Context. Invented timeline ideas can become timeline suggestions through Pending Review, not active runtime state.

### 5. Proposal And Apply

Application policy:

- Manual apply always allowed.
- High-confidence local results can apply automatically when the deck is unlocked.
- Reasoner results should default to review proposals.
- Automatic mode can apply high-confidence Reasoner results only if the user explicitly enables it.
- Medium/low confidence results should go to proposal review.
- Ambiguous results should open the Context Browser with candidate choices.

## Model Call Performance

Context checks must not become multi-minute generation jobs.

### Call Frequency

Recommended default:

- Manual mode: no background model calls.
- Assisted mode: local checks after a cadence, model fallback only when drift is likely.
- Automatic mode: same cadence, but high-confidence results may apply.

Initial cadence:

- Every 20 assistant turns, or
- After 8,000 to 12,000 new characters since the last Context check, or
- Immediately when explicit high-signal phrases appear, such as `weeks later`, `after the battle`, `chapter`, `episode`, `stardate`, `arc`, `season`, `before`, `after`, or a known anchor label.

The cadence should be configurable.

### Payload Limits

Do not send:

- Full chat history.
- Full Loredecks.
- Full timeline registries.
- Hundreds of candidates.
- Full Lorecard bodies unless explicitly needed for event-derived candidates.

Send:

- Previous Context Brief.
- Previous per-Loredeck Contexts.
- Recent message delta.
- Compact scene summary if available.
- Candidate set capped per deck.

Recommended starting caps:

- Recent excerpt: 4,000 to 8,000 characters.
- Candidates: 12 to 24 per loaded Loredeck.
- Candidate description: 300 characters max.
- Loaded decks per call: active enabled stack only.
- Evidence snippets: short quotes only.

### Cheap Drift Check

Before any model call, run a deterministic drift check:

- Has enough text accumulated?
- Did a high-signal phrase appear?
- Did the chat explicitly name a new date/arc/chapter/episode/stardate?
- Did the current Context already satisfy the recent signals?
- Are all loaded Loredeck Contexts locked?

If the answer is no meaningful drift, skip the model call.

### Caching

Cache:

- Context Index per stack signature.
- Ranked candidate sets per query/signature.
- Last Context Brief plus recent-message hash.
- Last unresolved result for the same recent-message hash and stack signature.

Do not repeatedly ask the model the same ambiguous question.

### Failure Behavior

If a model call fails, times out, returns invalid JSON, or hits token limits:

- Keep existing Context unchanged.
- Show status feedback.
- Store the failed attempt summary.
- Offer manual Context Browser fallback.
- Never clear good Context because detection failed.

Context calls should be abortable and should block duplicate in-flight calls.

## Modes

### Manual

Best for users who want full control.

- No background model calls.
- User can browse, set, lock, and manually ask Reasoner.
- Local search remains available.

### Assisted

Recommended default.

- Runs cheap local drift checks on cadence.
- Applies high-confidence local matches to unlocked decks.
- Stores Reasoner results as reviewable proposals.
- Does not overwrite manual locks.

### Automatic

Power-user mode.

- Same drift and local-first pipeline.
- May apply high-confidence Reasoner resolutions if enabled.
- Requires clear settings and audit history.
- Never overwrites locked Contexts.

## Runtime UI Direction

The Context tab should become a runtime control surface, not a deck-authoring panel.

### Compact Context Tab

Top section:

- Current Context per loaded Loredeck.
- Context label.
- Source chip.
- Confidence chip.
- Lock chip/control.
- Last checked.
- Index coverage chip.

Primary actions:

- `Browse Context`
- `Detect Context`
- `Review Proposals`

Automation controls:

- Manual / Assisted / Automatic.
- Check cadence.
- Character threshold.
- Reasoner fallback toggle.
- Auto-apply confidence threshold.

The old global `Scene date / Canon reference point / Branch` editor should become an advanced/global brief section, not the main mental model.

### Fullscreen Context Browser

The Browser should support:

- Stack-wide overview.
- Per-Loredeck selection.
- Search across anchors/windows.
- Filters for major points, anchors, windows, arcs, episodes, chapters, quests, and Lorecard-derived events.
- Candidate explanations.
- After/before window builder.
- Manual lock.
- Apply to one deck or selected unlocked decks.
- Proposal review.

### Timeline Registry Workbench

Deck-authoring features stay with Loredeck tools:

- Edit anchors/windows.
- Edit aliases/tags.
- Validate timelines.
- Densify sparse regions.
- Queue timeline patches through Pending Review.

Runtime users should not need to edit registries just to set Context.

## Multi-Loredeck Behavior

Multiple loaded Loredecks can resolve differently.

Example crossover stack:

- `Harry Potter Year 6`: after Christmas, before Apparition lessons.
- `Star Wars Legends: Thrawn Trilogy`: before Bilbringi.
- `Custom Crossover`: after first contact between Hogwarts and New Republic characters.

Rules:

- Stack priority affects retrieval and injection, not the truth of each deck's Context.
- Each deck can be locked/unlocked independently.
- Custom decks can define their own bridge/AU Context without special product terminology.
- Reasoner resolution should handle each deck independently using bounded candidates from that deck.

## Retrieval, Relevance, And Injection Integration

Context must feed the rest of Saga in a predictable order:

```text
Loaded Loredeck stack
  -> per-Loredeck Context
  -> Context-gated candidate selection
  -> relevance scoring
  -> pin/mute policy
  -> injection preview
  -> final prompt block
```

Requirements:

- Future/out-of-Context Lorecards should not be suggested.
- Accepted Lorecards should retain Context metadata.
- Wide Lorecards should remain eligible only when their gates say they are wide enough.
- Manual pins should not bypass hard future-canon gates unless the user explicitly allows it.
- Manual mutes should always exclude.
- Auto-Relevance should treat Context as input, not as an authority to silently change pin/mute unless that future mode is enabled.

## Deck Health Integration

Deck Health should help authors and users understand Context reliability.

Useful warnings:

- Missing timeline registry.
- Sparse anchors in a broad deck.
- Windows with missing anchors.
- Entries gated to impossible anchors/windows.
- Entries using media fields that the deck never defines.
- Stardate gates but no stardate-capable Context axis.
- Too many aliases on low-value anchors.
- Too few high-value anchors for user browsing.

These should usually be advisory, not blocking. A fun Custom deck may work even with imperfect health.

## Test Strategy After Development

Do not start with live model tests.

First deterministic tests should use synthetic or small bundled fixtures:

### Harry Potter

- Date-heavy and event-heavy.
- Check after Christmas Year 6 before Apparition lessons.
- Check later movement to Ron/Lavender, Apparition, Susan Bones, and Ron poisoning.

### One Piece

- Arc/chapter/episode structure.
- Example: Arlong Park.
- Resolve phrases such as `after Nami asks Luffy for help`, `before the march to Arlong Park`, and `during the Cocoyasi confrontation`.

### Star Trek

- Season/episode and stardate support.
- Example TNG/VOY synthetic anchors:
  - `TNG S05E02 Darmok`.
  - `VOY S04E08/S04E09 Year of Hell`.
- Stardate should help search, but episode/order/sort keys should be authoritative.

Test layers:

1. Data model normalization.
2. Context Index candidate generation.
3. Local resolver ranking.
4. Mocked bounded Reasoner resolution.
5. Manual lock protection.
6. Context-gated candidate selection.
7. Accepted Lorecard injection behavior.
8. UI smoke for Context tab and Browser.

Live provider testing should be optional QA, not default regression testing.

## Implementation Slices

### Slice 1: Current-Code Audit And Contract

- Document the current detector, resolver, state, and UI paths.
- Add small tests around the existing behavior so the overhaul has a baseline.
- Identify fields that are preserved, dropped, or only partially supported.

Status: in progress, first audit complete. See [SAGA_CONTEXT_SYSTEM_CURRENT_AUDIT.md](SAGA_CONTEXT_SYSTEM_CURRENT_AUDIT.md).

Current baseline script:

```powershell
node scripts\test-context-current-contract.mjs
```

The baseline started by recording the pre-upgrade limitations intentionally. After Slice 4 started, it now asserts the Context Brief detector contract, the compatibility projection into legacy `loreContext`, Loredeck Context `stardate`/`coordinates`, rich timeline windows, resolver candidate payloads, and stardate/coordinate gates.

### Slice 2: Data Model Upgrade

- Add `Context Brief` state.
- Add first-class `stardate` and `coordinates` to Loredeck Context.
- Preserve structured fields on windows.
- Ensure save/load/migration keeps existing Context state.

Status: done. Chat state schema now includes `contextBrief`; Loredeck Context preserves `stardate` and `coordinates`; timeline anchors/windows preserve stardate and media-axis metadata; resolver patches/prompts include stardate/coordinates; empty stardate gates now resolve as unresolved instead of numeric-zero mismatches.

### Slice 3: Context Index Upgrade

- Include stardate and coordinates in searchable/candidate text.
- Rank anchors and windows as first-class candidates.
- Keep Lorecard-derived candidates lazy/on-demand.

Status: done for the runtime resolver contract. Richer window normalization and candidate serialization are in place; local resolver candidate scoring now ranks anchors and windows together with structured scoring for stardate, coordinates, season/episode, chapter/issue ranges, and arc/phase queries. Lorecard-derived candidates remain deferred.

Current media-scoring script:

```powershell
node scripts\test-context-media-scoring.mjs
```

The synthetic fixture covers:

- One Piece-style arc/chapter resolution where an Arlong Park chapter query ranks the arc window above a specific anchor.
- Star Trek-style season/episode/stardate resolution where a broad season query ranks the season window, but an exact `Darmok` stardate/episode query ranks the episode anchor.

### Slice 4: Detector Redesign

- Replace the narrow date/canon-boundary detector with Context Brief extraction.
- Keep deterministic extraction first.
- Add strict JSON repair/fallback without clearing existing Context.
- Store brief status and evidence.

Status: started. The model prompt now requests a Context Brief instead of a narrow date/canon-boundary object. `runLoreContextDetection()` normalizes detector output into `state.contextBrief`, projects a narrow legacy `loreContext` for older consumers, and resolves Loredeck Context from the rich brief signals. The test contract covers media fields, coordinates, fallback brief projection, and prevention of stale legacy date signals leaking into fresh non-date briefs.

Remaining Slice 4 work:

- Broaden deterministic local extraction beyond dates/headings into obvious arc/chapter/episode/stardate phrases.
- Add a dedicated Context Brief JSON repair pass if malformed detector JSON becomes common.
- Record richer detector status/failure metadata for UI display.
- Feed nested evidence/uncertainty into bounded Reasoner prompts where useful.

### Slice 5: Resolver Orchestration

- Feed the Context Brief into local candidate generation.
- Apply high-confidence local matches where safe.
- Send only bounded candidate sets to Reasoner.
- Store proposal results for review.
- Protect manual locks and duplicate in-flight calls.

### Slice 6: Context Tab Redesign

- Make loaded Loredeck Context rows the main surface.
- Move legacy global fields into an advanced/collapsed brief section.
- Make Browser, Detect, and Review Proposals the primary actions.
- Add clear status feedback for running checks.

### Slice 7: Automation Settings

- Add Manual / Assisted / Automatic modes.
- Add message-count and character-count cadence settings.
- Add Reasoner fallback and auto-apply thresholds.
- Add clear audit/status messaging for last check, skipped check, and failed check.

### Slice 8: Tests

- Build deterministic synthetic HP, One Piece, and Star Trek fixtures.
- Mock Reasoner responses.
- Prove Context movement changes candidate eligibility.
- Prove locked Contexts are not overwritten.
- Prove stardate gates work without making stardate the only source of truth.

### Slice 9: Visual Smoke

- Smoke Context tab opening.
- Smoke Browser search.
- Smoke manual apply.
- Smoke after/before window creation.
- Smoke Reasoner proposal review with mocked data.
- Smoke locked Context behavior.

## Non-Goals For This Phase

- Fully automated understanding of every casual fandom phrase.
- Exhaustive alias authoring for every possible event phrasing.
- Full bundled Loredeck coverage for every fandom.
- Live model regression tests as the default test path.
- Silent model-driven timeline mutation.
- Conflict detection between unrelated fandom continuities.

## Development Gate

After this phase, Saga should be ready to resume broader core integration testing if:

- Context can be manually set for every loaded Loredeck.
- Context can be locally or Reasoner-resolved for date-heavy, arc-heavy, and episode-heavy fixtures.
- Context checks are bounded, cancellable, and do not duplicate in-flight model calls.
- The Context tab no longer presents date/canon-boundary as the primary model.
- Retrieval and injection can consume the resolved per-Loredeck Context without leaking obvious future lore.
