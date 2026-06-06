# Saga Core Integration Testing

**SAGA: Fandom Loresystem.**

## Purpose

This document prepares the next development phase: deterministic integration tests for Saga's core runtime loop.

Saga has many major systems implemented in slices. The next risk is not whether each system exists. The next risk is whether they cooperate correctly in SillyTavern-like conditions:

```text
loaded Loredecks
  -> selected or resolved Context
  -> Context-gated Lorecard candidates
  -> relevance, pin, mute, and stack priority
  -> final injection preview and prompt output
```

These tests should make failures local. If a story does not get the right injected lore, we need to know whether Context detection failed, Loredeck loading failed, Context gates failed, relevance scoring failed, pin/mute state failed, or prompt injection failed.

## Current Development Stage

Saga is in pre-alpha integration hardening.

The MVP foundation is historical. The relevant question for alpha is now:

Can a tester load the correct Loredecks, set or resolve Context, approve useful Lorecards, and trust Saga to dynamically include or exclude the right lore as the story advances?

## First Implemented Harness

The first committed data-level integration harness is:

```powershell
node scripts\test-core-integration-hp-year6.mjs
```

It currently proves the first HP Year 6 baseline:

- Mocks `SillyTavern.getContext()` without opening the browser.
- Explicitly loads `hp-core` and `hp-year-6-half-blood-prince`.
- Builds the Context index through the runtime loader path.
- Resolves `Saturday, Jan 25, 1997` to `hp.y6.window.post_christmas_before_apparition`.
- Previews Context-gated Lorecard candidates.
- Verifies previewed Lorecards come only from the loaded stack.
- Accepts a small slice of suggested Lorecards through Pending Review.
- Verifies accepted Lorecards preserve Loredeck and Context metadata.
- Verifies pin and mute behavior in the injection audit and final lore memo.

The script also supports a local-only SillyTavern JSONL chat path:

```powershell
node scripts\test-core-integration-hp-year6.mjs --chat="F:\SillyTavern\SillyTavern\data\default-user\chats\Story\Story - 2026-05-12@13h18m39s841ms.jsonl" --message-counts=40,80,120,200
```

That mode does not commit or copy the chat. It only reads progressive slices and reports Context signal counts such as Christmas, Lavender, Apparition, Susan Bones, Slughorn, and Dumbledore. This is the staging point for the next test: feeding progressive transcript slices into Context detection and asserting Context movement over time.

The second committed progression harness is:

```powershell
node scripts\test-core-integration-hp-year6-progression.mjs
```

It proves the next downstream layer:

- Emulates a progressive story fixture from post-Christmas Year 6 to Ron's poisoning.
- Converts fixture chat signals into Context objects without live model calls.
- Runs the real Context resolver against the loaded HP stack.
- Confirms the early Context resolves to `hp.y6.window.post_christmas_before_apparition`.
- Confirms the later Context resolves to `hp.y6.ron_love_potion`.
- Confirms early-only suggestions such as `lexcal_y6_horcrux_memory_task` leave the preview when the Context advances.
- Confirms later-only suggestions such as `lexcal_y6_ron_poisoned_bezoar` appear when the Context advances.
- Accepts Lorecards from both checkpoints.
- Runs Auto-Relevance in local apply mode.
- Confirms current Ron poisoning lore is promoted and stale earlier memory-sequence lore is demoted.
- Confirms final injection includes the promoted current Lorecard.

Important product boundary: current Auto-Relevance changes relevance tiers only. It does **not** change mute or pin state. Manual pin/mute behavior is covered by the first harness. If Saga later adds automatic pinning or automatic muting, that should be a distinct feature with explicit UI copy, review behavior, and its own integration harness.

## Core Runtime Contract

The first deterministic integration harness should prove this contract:

1. Given a known test story or transcript slice, Saga can derive or accept the expected Context.
2. Given an active Loredeck stack, Saga only loads and considers Lorecards from enabled stack items.
3. Given a selected Context, Saga blocks Lorecards that are outside the active story position.
4. Given eligible Lorecards, Saga ranks candidates by stack priority, relevance, retrieval hints, and specificity.
5. Given accepted Lorecards, Saga respects manual pin and mute state.
6. Given a later Context, Saga updates eligibility without corrupting accepted Lorecards.
7. Given the final accepted set, Saga's injection preview matches the prompt text that would be injected.

## Deterministic Test Layers

### 1. Fixture Loading

Proves that a fixture state can load without SillyTavern:

- Settings.
- Loredeck library records.
- Active stack.
- Loredeck Context state.
- Accepted Lorecards.
- Pin/mute state.

This layer should fail before any Context or retrieval logic runs if the fixture is malformed.

### 2. Context Resolution

Proves that known phrases or transcript windows resolve to expected Context patches.

This should use deterministic fixtures first:

- Manual Context values.
- Local structured/date resolver outputs.
- Mocked Reasoner Provider responses for vague phrases.

Live model calls should not be part of default regression tests. Model-backed Context tests can exist as optional QA scripts, but the core test suite must run offline and produce stable results.

Known follow-up: local alias scoring can currently override a clean date result when the Context text contains phrases like `before Apparition lessons`. A date-based Jan. 25, 1997 checkpoint correctly resolves to the post-Christmas/pre-Apparition window when the boundary text is neutral, but the phrase `before Apparition lessons` can pull the resolver toward the Apparition anchor. This should become a targeted resolver test before we trust vague phrase handling.

### 3. Context-Gated Retrieval

Proves that eligible and ineligible Lorecards are separated correctly.

Example target:

- Active stack: `hp-core` plus `hp-year-6-half-blood-prince`.
- Context: after Christmas in Year 6, before Apparition lessons.
- Expected behavior: Year 6 post-Christmas baseline lore is eligible, pre-existing Core lore is eligible, future Apparition/Susan Bones/Dumbledore-death style lore is blocked until the Context advances.

### 4. Suggestion And Approval Flow

Proves that suggested Lorecards can move through Pending Review into Accepted Lorecards without losing schema v3 fields:

- Deck/source metadata.
- Context gates.
- Retrieval metadata.
- Tags.
- Content injection text.
- Relevance tier.

This should test the data path, not the visual card layout.

### 5. Dynamic Pin/Mute/Relevance Behavior

Proves that accepted Lorecards remain stable while their injection eligibility changes:

- Pinned Lorecards are prioritized when eligible.
- Muted Lorecards are excluded even when eligible.
- Context-gated suggestions change as the loaded Loredeck Context advances.
- Relevance tiers control injection grouping and compression budget.
- Auto-Relevance can promote and demote accepted Lorecards based on current scene and recent messages.
- Manual pin/mute choices survive Context changes.

Current implementation note: accepted Lorecard injection does not yet re-run full Loredeck Context gates for every accepted Lorecard. Context gates currently govern candidate suggestion/retrieval. Accepted injection uses relevance, lifecycle, branch/date windows, pin/mute, and tier caps. If alpha requires accepted canon Lorecards to auto-drop purely by Loredeck Context gate, add that as a separate implementation step and test.

### 6. Injection Output

Proves that the final prompt blocks match expectations:

- High/normal/low relevance groups are built correctly.
- Muted lore is absent.
- Context-blocked lore is absent.
- Pinned eligible lore remains prominent.
- The preview/debug surface and actual prompt injector agree.

## Real Chat Fixture Policy

Real SillyTavern chats are valuable for integration QA, but they should not be committed raw.

Use real chats in one of three ways:

- Local-only input path supplied to a script.
- Redacted/minimized fixture derived from the chat.
- Synthetic transcript recreated from the relevant Context beats.

The provided private Story chat is a good candidate for local-only HP Year 6 QA because it contains strong progression signals around Christmas, Lavender, Apparition, Susan Bones, Slughorn, Dumbledore, Quidditch, and Half-Blood Prince references.

Do not copy that raw chat into the repository. If we need committed fixtures, derive compact synthetic slices that preserve only the minimum text needed to trigger expected Context and retrieval behavior.

## First HP Scenario Family

The first integration family should target the split Harry Potter reference decks because they are Saga's bundled example and because HP gives us date, school-year, arc, and event-window stress tests.

Recommended starting stack:

```text
hp-core
hp-year-6-half-blood-prince
```

Recommended Context checkpoints:

- Year 6 baseline after winter holiday references.
- Before Apparition becomes story-current.
- After Apparition becomes story-current.
- After Susan Bones is mentioned.
- Later Year 6 checkpoints that should still block Year 7 and Epilogue/Post-War lore.

The point is not to assert every possible canon fact. The point is to assert clear, high-value inclusion and exclusion behavior.

## Integration Boundaries

The harness should exercise these modules together:

- `loredeck-loader.js`
- `context-index.js`
- `context-resolver.js`
- `context-gating.js`
- `canon-lore-db.js`
- `lore-relevance.js`
- `memo-builder.js`
- `prompt-injector.js`
- relevant state helpers from `state-manager.js`

UI tests should come later. The first harness should be data-level and deterministic so it runs quickly and explains failures clearly.

## Optional Live Provider QA

Reasoner/Utility provider testing should be a separate opt-in QA layer, not part of the default regression suite.

Recommended provider matrix:

- Reasoner Provider: Deepseek-V4.
- Reasoner Provider: GLM-5.1.
- Utility Provider: Minimax-M2.7.

Live-provider QA should use the user's already-configured SillyTavern instance at `http://127.0.0.1:8000/` only after deterministic tests pass. The goal is not to assert exact prose. The goal is to assert bounded behavior:

- The resolver returns only provided candidate IDs.
- It does not invent anchors, windows, dates, or lore.
- It chooses a plausible Context for vague phrases when local resolution is insufficient.
- Failed or overlong model responses surface as reviewable failures, not silent state corruption.
- No duplicate model calls are launched from repeated button clicks.
- In-progress generation or resolver state survives closing and reopening Saga windows.

Live-provider QA should never commit API keys, provider settings, raw private chats, or raw model transcripts. If a model response becomes a useful fixture, reduce it to a small mocked JSON response and store that in a deterministic test.

## Success Criteria

Before alpha, Saga should have deterministic tests proving:

- Split HP Loredecks load through the same loader path used by runtime.
- Context patches select the expected timeline windows.
- Future Lorecards are blocked at the right Context positions.
- Candidate suggestions come from the enabled stack only.
- Accepted Lorecards preserve schema v3 metadata.
- Pin, mute, relevance, and Context gates combine predictably.
- Injection preview and prompt output agree.
- Context progression changes suggested Lorecards over time.
- Auto-Relevance can promote current lore and demote stale lore without mutating pin/mute state.

## Non-Goals

These are not required for the first integration harness:

- Live Reasoner Provider calls.
- Browser automation.
- Visual layout checks.
- Full Loredeck Creator QA.
- Dozens of fandom fixtures.
- Semantic conflict detection between unrelated Loredecks.

## Open Decisions

- Whether the first committed fixtures should be compact synthetic transcripts or small redacted slices from real chats.
- Whether Context progression tests should mutate one state object step-by-step or run separate isolated states per checkpoint.
- Whether accepted Lorecard tests should accept real suggested cards or seed accepted Lorecards directly to isolate injection behavior.
- Whether prompt-injection tests should call the full SillyTavern extension prompt bridge or stop at Saga's prompt text builder.
- Whether `loadLoredeckStackSources([])` should keep falling back to `hp-core` internally or respect a truly empty stack in all runtime paths.
