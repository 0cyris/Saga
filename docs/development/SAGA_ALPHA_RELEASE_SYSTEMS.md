# Saga Alpha Release Systems

This document identifies the major systems Saga needs working for an alpha release. Alpha does not require every system to be feature-complete, but each system below should be coherent enough that a tester can use Saga in SillyTavern without broken core workflows, stale Wandlight assumptions, or confusing placeholder surfaces.

## Alpha Definition

Saga alpha is ready when users can:

- Load and manage Loredecks.
- Build an active Loredeck stack.
- Set or resolve Context.
- Retrieve and inject the correct Lorecards for the current Context.
- Inspect, edit, validate, import, export, and duplicate Loredecks safely.
- Use the extension in SillyTavern without major console errors, broken windows, or severe interaction lag.

Alpha is not the same as public polish. It can still have limited bundled fandom coverage, incomplete advanced automation, and rougher creator workflows, but the foundational architecture should be stable enough that user feedback is meaningful.

## Current Development Stage

Saga is currently in **pre-alpha integration hardening**.

Most foundational systems now exist in some form: the runtime shell, Loredeck Library, active stack, Context tab/browser, Deck Health Center, Theme/Icon Sets, Lore Assistant groundwork, Loredeck Creator batching, Pending Review, and the split Harry Potter reference deck family.

The main risk has shifted from missing features to cross-system correctness. The next phase must prove that the core runtime loop works end to end:

```text
loaded Loredecks
  -> selected or resolved Context
  -> Context-gated Lorecard candidates
  -> relevance, pin, mute, and stack priority
  -> final injection preview and prompt output
```

The detailed test prework lives in [SAGA_CORE_INTEGRATION_TESTING.md](SAGA_CORE_INTEGRATION_TESTING.md).

The first deterministic HP Year 6 harness now exists at `scripts/test-core-integration-hp-year6.mjs`. It validates stack loading, date-based Context resolution, Context-gated suggestions, Pending Review acceptance, pin/mute behavior, and final lore memo output without live model calls.

The next progression harness, `scripts/test-core-integration-hp-year6-progression.mjs`, validates Context movement from post-Christmas Year 6 to Ron's poisoning, suggestion-set changes, accepted Lorecards across checkpoints, Auto-Relevance tier changes, and final injection output.

The accepted-injection harness, `scripts/test-core-integration-hp-year6-accepted-context.mjs`, validates that accepted Lorecards are still checked against active Loredeck Context before prompt injection. A stale accepted Year 6 Lorecard remains accepted after Context advances, but is omitted from memo output and audited as `context_blocked`; current matching lore still injects.

The expanded HP harness family now covers `hp-core` plus Year 1, Year 2, Year 3, Year 4, Year 5, Year 7, and Epilogue/Post-War split decks. These harnesses validate Context progression, suggestion-set changes, accepted stale-lore Context blocking, and current-lore injection across early-school, mystery, tournament, Ministry, late-war, and post-war/epilogue story structures.

The HP reference-deck conformance check now exists at `scripts/test-hp-reference-deck-conformance.mjs`. It verifies the bundled HP defaults, `Loredecks/index.json`, duplicated manifests, Deck Health summaries, deck-local covers, tag registries, file lists, empty active-stack defaults, and absence of the legacy monolithic `hp-golden-trio` deck from runtime defaults.

## Key Systems

### 1. Saga Runtime Shell

The shelf, tabs, fullscreen workbenches, reset behavior, settings routing, and overall Saga runtime surface. This includes removing or hiding stale Wandlight UI and ensuring major windows open, close, reset, and preserve scroll state correctly.

`lore-panel.js` has grown into a monolithic runtime/controller file. The decomposition roadmap lives in [SAGA_LORE_PANEL_DECOMPOSITION_PLAN.md](SAGA_LORE_PANEL_DECOMPOSITION_PLAN.md) and should be followed as a cross-system hardening effort rather than a UI redesign pass.

### 2. Settings System

Provider/API settings, Reasoner Provider settings, automation thresholds, theme/icon preferences, and persistent user configuration. API/model settings should live in the Saga Settings tab, not the legacy SillyTavern extension dropdown.

### 3. Loredeck Schema System

The durable data contract for Loredecks: manifests, schema v3 Lorecards, tags, timeline registry, assets, covers, source/update metadata, and validation expectations. This needs to be stable because user-created and bundled decks will depend on it.

### 4. Loredeck Loader

Bundled, Custom, and Generated Loredeck loading. The loader must support active stack loading, embedded Custom/Generated entries, deck-local assets, and loud failures when required bundled manifests are missing. Legacy root lore fallback should remain removed.

### 5. Loredeck Library

The fullscreen Library for browsing, organizing, selecting, duplicating, deleting, importing, exporting, and inspecting Loredecks. This includes folders, nested folders, deck covers, multi-select, drag/drop, details panels, and clean bulk actions.

### 6. Loredeck Stack Manager

The active-session stack of loaded Loredecks. It must support multiple loaded decks, priority order, enable/disable controls, folder/deck stack items, drag reorder, and clean add/remove behavior.

### 7. Lorecard System

Accepted Lorecards, Pending Review, manual editing, bulk edit, metadata chips, Context fields, retrieval fields, source metadata, and reviewable changes. Lorecards should be schema v3-native and should not depend on legacy date gates.

### 8. Context System

The user-facing system for determining where the chat is inside each loaded Loredeck's story. This includes the Context tab, Context Browser, manual selection, locks, after/before windows, local resolver, bounded Reasoner proposals, and review before applying model-derived Context.

Current development gate: finish the broader Context system hardening described in [SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md](SAGA_CONTEXT_SYSTEM_DEVELOPMENT_PLAN.md) before treating integration testing as complete. The existing schema/resolver pieces are ahead of the active detector and compact Context UI; the next slice should make Context flexible across dates, arcs, chapters, episodes, quests, stardates, and loose story windows.

### 9. Timeline Registry System

The deck-authoring system for anchors, windows, aliases, sortable coordinates, and timeline validation. Runtime Context selection belongs in the Context tab; timeline registry editing belongs with Loredeck authoring tools.

### 10. Retrieval And Relevance System

Context-gated candidate selection, stack-priority scoring, relevance ranking, source chips, and wide-lore handling. This is the core system that decides which Lorecards should matter at a given moment.

Auto-Relevance currently owns High/Normal/Low tier changes. Planned expansion: allow optional pin/mute recommendations or high-confidence pin/mute application as a separate, explicitly configured layer. This should not be treated as a silent side effect of tier scoring because pin and mute are stronger injection controls.

### 11. Injection System

The final prompt-injection layer. It needs to account for pinned, muted, newly relevant, disabled, and Context-blocked Lorecards, and should provide a useful preview/debug surface for what will actually be injected.

### 12. Continuity System

Continuity tracking, scan cadence, status feedback, and integration with Context and injected lore. For alpha, this should remain responsive and avoid aggressive automatic background behavior.

### 13. Deck Health Center

Manifest/schema validation, tag validation, Context/timeline validation, coverage warnings, stale scan state, automatic post-accept reruns when possible, grouped issues, ignored/resolved issue state, deterministic repair actions, and Lore Assistant repair routing.

### 14. Tag System

Tag registry, namespaced tags, tag manager, bulk tag edits, malformed tag repair, deprecated/undefined tag warnings, alias/dependency checks, and tag preservation during import/export and duplication.

### 15. Import, Export, And Update System

Individual `.saga-loredeck.json` export, selected bulk export, local import, URL/GitHub import, update preview, canonical content-hash comparison, declared-hash mismatch warnings, collision handling, local modification warnings, and Custom-copy installation behavior.

### 16. Loredeck Creator

The staged generation workflow: compact Scope Brief, granularity, Story Outline and Context plan, outline-batched title pass, title-batch timeline/tag planning, planning-aware micro-batched Lorecard drafting, Generated Loredeck shell creation, Pending Review integration, validation, deterministic Creator-pipeline export readiness, and reviewed Generated-to-Custom finalization.

### 17. Lore Assistant

The patch-based AI helper for entries, tags, timelines, Deck Health repairs, and natural-language bulk revision. It should steer users toward high-value Saga lore and route proposed changes through Pending Review instead of silently editing decks.

### 18. Theme Pack And Icon Set System

Theme packs, color overrides, icon set switching, passive asset loading, deck-local visual assets, imported user-made theme/icon sets, and accessibility checks. Theme and icon assets must remain data-only and non-executable.

### 19. Bundled Reference Decks

The alpha bundled deck set. The Harry Potter split family should become the reference example: Core, Years 1-7, and Epilogue/Post-War, with deck-local covers, dense anchors, correct entry counts, and no stale monolithic Golden Trio deck as the default.

### 20. Visual Smoke And Diagnostics System

Local smoke harness, SillyTavern smoke checklist, console-error checks, screenshot pass, and regression tests for major windows and workflows. Alpha should have repeatable ways to prove that the extension opens and core surfaces still work.

### 21. Performance And Responsiveness System

Large-library responsiveness, no full-window rerenders for small interactions, stable scroll position, animation budget, ResizeObserver/layout discipline, and interaction-lag audits. The UI should feel responsive inside SillyTavern, not only in the local harness.

### 22. Legacy Removal And Terminology Cleanup

Consistent Saga terminology: Loredecks, Lorecards, Context, Theme Packs, Icon Sets. Remove visible Wandlight product behavior, old preset assumptions, legacy extension-menu settings, changelog-style UI copy, and incomplete-feature placeholder messaging.

## Alpha Blockers

The main alpha blockers are:

- Loredecks cannot be reliably loaded, stacked, imported, exported, duplicated, or deleted.
- Context cannot be set, locked, browsed, or resolved well enough for runtime use.
- Retrieval or injection includes future/out-of-Context lore in ordinary workflows.
- Pending Review or editing workflows can silently corrupt Loredecks.
- Deck Health reports misleading counts, stale warnings, or cross-deck leakage.
- Bundled HP reference decks are visibly incomplete, miscounted, or still superseded by the old monolithic deck.
- SillyTavern live smoke testing shows console errors, broken fullscreen windows, native dialog leaks, or severe lag.
- The Context-to-injection loop cannot be proven deterministically for a realistic story progression.

## Alpha Non-Blockers

These can remain incomplete for alpha if the underlying architecture is stable:

- Dozens of bundled fandoms.
- Fully polished Loredeck Creator output quality.
- Fully automated Context detection for every vague phrase.
- Semantic conflict detection between unrelated fandoms.
- Advanced Theme Pack marketplace behavior.
- Perfect coverage and anchor density in every Custom or Generated deck.

## Current Focus

The highest-value path toward alpha is:

1. Update the development docs so historical MVP notes, current alpha systems, and near-term testing plans agree.
2. Keep the deterministic HP harness family passing. Years 1, 2, 3, 4, 5, 7, and Epilogue/Post-War now have Context progression/injection harnesses, accepted-Lorecard Context gate behavior is covered by `scripts/test-core-integration-hp-year6-accepted-context.mjs`, and the known Jan. 25 / `before Apparition lessons` resolver edge is covered in `scripts/test-context-resolver.mjs`.
3. Keep HP reference-deck conformance passing so `hp-core`, Years 1-7, and Epilogue/Post-War remain the clean bundled example.
4. Stabilize remaining Loredeck Library and stack behavior at scale, especially folders, drag/drop, selection, and active-stack persistence.
5. Keep running local and live SillyTavern smoke passes after each major slice to catch UI regressions, console errors, and interaction lag.
