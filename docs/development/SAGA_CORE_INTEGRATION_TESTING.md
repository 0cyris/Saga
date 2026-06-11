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
node tools\scripts\test-core-integration-hp-year6.mjs
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
node tools\scripts\test-core-integration-hp-year6.mjs --chat="F:\SillyTavern\SillyTavern\data\default-user\chats\Story\Story - 2026-05-12@13h18m39s841ms.jsonl" --message-counts=40,80,120,200
```

That mode does not commit or copy the chat. It only reads progressive slices and reports Context signal counts such as Christmas, Lavender, Apparition, Susan Bones, Slughorn, and Dumbledore. This is the staging point for the next test: feeding progressive transcript slices into Context detection and asserting Context movement over time.

The second committed progression harness is:

```powershell
node tools\scripts\test-core-integration-hp-year6-progression.mjs
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

Important product boundary: current Auto-Relevance changes relevance tiers only. It does **not** change mute or pin state. Manual pin/mute behavior is covered by the first harness.

The third accepted-injection harness is:

```powershell
node tools\scripts\test-core-integration-hp-year6-accepted-context.mjs
```

It proves the alpha-critical accepted Lorecard behavior:

- Accepts a narrow post-Christmas Year 6 Lorecard while its Context gate matches.
- Confirms that accepted Lorecard injects while the active Loredeck Context is inside its gate.
- Advances Context to Ron's poisoning.
- Accepts current Ron poisoning lore.
- Forces both stale and current accepted Lorecards to High relevance.
- Confirms the stale accepted Lorecard remains accepted but is blocked from injection by its Context gate.
- Confirms the current accepted Lorecard injects.
- Confirms the injection audit reports the stale Lorecard as `context_blocked`.

The fourth committed harness expands coverage beyond Year 6:

```powershell
node tools\scripts\test-core-integration-hp-year3.mjs
```

It proves the same Context-to-injection contract against `hp-core` plus `hp-year-3-prisoner-of-azkaban`:

- Resolves a winter Year 3 checkpoint to `hp.y3.dementor_quidditch_collapse`.
- Confirms early active suggestions include Hermione's hidden Time-Turner schedule state.
- Confirms late rescue/reveal lore is blocked before the story reaches that Context.
- Advances Context to `hp.y3.sirius_escapes`.
- Confirms the late Time-Turner rescue and Shrieking Shack reveal Lorecards enter the suggestion set.
- Accepts lore from both checkpoints.
- Confirms stale accepted Year 3 lore remains accepted but is blocked from prompt injection by active Loredeck Context.
- Confirms current late Year 3 rescue lore injects and the audit reports the stale Lorecard as `context_blocked`.

The fifth committed harness expands the same contract into Year 4:

```powershell
node tools\scripts\test-core-integration-hp-year4.mjs
```

It proves `hp-core` plus `hp-year-4-goblet-of-fire` against tournament-to-aftermath progression:

- Resolves early Year 4 setup to `hp.y4.moody_unforgivables_lesson`.
- Confirms early active suggestions include Triwizard selection/binding constraints.
- Confirms graveyard aftermath and third-task reveal lore are blocked before the story reaches the climax.
- Advances Context to `hp.y4.train_home_after_cedric`.
- Confirms post-graveyard Voldemort-return lore and the third-task graveyard reveal enter the suggestion set.
- Accepts lore from both checkpoints.
- Confirms stale accepted tournament setup lore remains accepted but is blocked from prompt injection by active Loredeck Context.
- Confirms current graveyard aftermath lore injects and the audit reports the stale Lorecard as `context_blocked`.

The HP split-deck family now also includes deterministic progression harnesses for Year 1, Year 2, Year 5, Year 7, and Epilogue/Post-War:

```powershell
node tools\scripts\test-core-integration-hp-year1.mjs
node tools\scripts\test-core-integration-hp-year2.mjs
node tools\scripts\test-core-integration-hp-year5.mjs
node tools\scripts\test-core-integration-hp-year7.mjs
node tools\scripts\test-core-integration-hp-epilogue-post-war.mjs
```

The Epilogue/Post-War harness proves the transition from immediate 1998 rebuilding to the 2014 Quidditch World Cup/DA reunion and then to the 2017 King's Cross epilogue. It confirms that pre-epilogue next-generation guards stop appearing when epilogue Context is current, stale immediate-rebuilding lore remains accepted but becomes `context_blocked`, and current 2017 platform lore injects.

Planned extension: Auto-Relevance should eventually support optional pin/mute recommendations or high-confidence actions. This should be treated as stronger than High/Normal/Low tiering because pin and mute directly affect injection authority. It needs explicit user-facing controls, review behavior, and its own integration coverage before it is enabled.

Recommended future modes:

- `tiers_only`: current behavior; Auto-Relevance can promote or demote High/Normal/Low.
- `suggest_pin_mute`: Auto-Relevance writes reviewable pin/mute suggestions, but does not mutate `loreSelection`.
- `apply_high_confidence_pin_mute`: Auto-Relevance can apply pin/mute only when confidence is high and settings allow it.

Recommended guardrails:

- Never auto-mute user-pinned Lorecards unless the user enables an override.
- Never auto-pin muted Lorecards unless the user accepts a suggestion or enables an override.
- Distinguish temporary relevance from durable user intent. A temporary scene hit should usually promote to High, not pin.
- Auto-mute should be reserved for clear out-of-context, expired, disabled, duplicate, or contradicted entries, not merely "less relevant right now."
- All automatic pin/mute actions should be visible in the injection audit and timeline/history log.

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

Implemented resolver edge coverage: `tools/scripts/test-context-resolver.mjs` now asserts that a clean `sceneDate` remains authoritative when supporting Context text contains loose boundary phrases such as `before Apparition lessons`. The Jan. 25, 1997 checkpoint resolves to `hp.y6.window.post_christmas_before_apparition`, not the upcoming Apparition anchor. Phrase-only inputs remain covered by `tools/scripts/test-context-hp-phrase-fixtures.mjs`.

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
- Future Auto-Relevance can optionally suggest or apply pin/mute state when configured.
- Manual pin/mute choices survive Context changes.

Current implementation note: accepted Lorecard injection now re-runs Loredeck Context gates before memo construction and injection audit selection. Accepted Lorecards remain in the user's accepted set when Context advances, but mismatched gated entries are omitted from prompt output and audited as `context_blocked`. Pin remains an ordering/authority signal for eligible Lorecards; it does not override Context gates.

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

The first integration family targets the split Harry Potter reference decks because they are Saga's bundled example and because HP gives us date, school-year, arc, and event-window stress tests.

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

The family has now expanded into the main HP reference split decks. Year 1 stresses early-school onboarding, Sorting, first-year gates, and late Philosopher's Stone aftermath. Year 2 stresses Chamber mystery progression, pre-reveal spoiler guards, and late basilisk/Riddle resolution. Year 3 stresses broad fugitive/security lore, hidden knowledge, Hogsmeade/Map gates, and late Time-Turner/Shack reveal gates. Year 4 stresses tournament/task structure and late Voldemort-return leakage. Year 5 stresses Ministry denial, Umbridge/DA progression, and Department of Mysteries escalation. Year 7 stresses Horcrux-hunt pressure, Battle of Hogwarts spoiler guards, and post-battle aftermath activation. Epilogue/Post-War stresses the shift from immediate rebuilding to mid-postwar public life and then to the 2017 next-generation platform scene.

## Integration Boundaries

The harness should exercise these modules together:

- `src/loredecks/loredeck-loader.js`
- `src/context/context-index.js`
- `src/context/context-resolver.js`
- `context-gating.js`
- `src/context/canon-lore-db.js`
- `lore-relevance.js`
- `memo-builder.js`
- `prompt-injector.js`
- relevant state helpers from `src/state/state-manager.js`

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
- HP bundled defaults, `content/loredecks/index.json`, duplicated manifests, Pack Health summaries, covers, tag registries, file lists, and empty active-stack defaults stay aligned.
- Context patches select the expected timeline windows.
- Multiple HP years prove the Context-to-suggestion-to-injection loop, not only Year 6.
- Future Lorecards are blocked at the right Context positions.
- Candidate suggestions come from the enabled stack only.
- Accepted Lorecards preserve schema v3 metadata.
- Pin, mute, relevance, and Context gates combine predictably.
- Injection preview and prompt output agree.
- Context progression changes suggested Lorecards over time.
- Auto-Relevance can promote current lore and demote stale lore without mutating pin/mute state.
- Future optional Auto-Relevance pin/mute behavior is covered separately, including suggestion mode, high-confidence apply mode, user override protection, and injection-audit visibility.

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
