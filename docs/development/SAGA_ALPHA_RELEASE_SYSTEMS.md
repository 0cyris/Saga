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

## Key Systems

### 1. Saga Runtime Shell

The shelf, tabs, fullscreen workbenches, reset behavior, settings routing, and overall Saga runtime surface. This includes removing or hiding stale Wandlight UI and ensuring major windows open, close, reset, and preserve scroll state correctly.

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

### 9. Timeline Registry System

The deck-authoring system for anchors, windows, aliases, sortable coordinates, and timeline validation. Runtime Context selection belongs in the Context tab; timeline registry editing belongs with Loredeck authoring tools.

### 10. Retrieval And Relevance System

Context-gated candidate selection, stack-priority scoring, relevance ranking, source chips, and wide-lore handling. This is the core system that decides which Lorecards should matter at a given moment.

### 11. Injection System

The final prompt-injection layer. It needs to account for pinned, muted, newly relevant, disabled, and Context-blocked Lorecards, and should provide a useful preview/debug surface for what will actually be injected.

### 12. Continuity System

Continuity tracking, scan cadence, status feedback, and integration with Context and injected lore. For alpha, this should remain responsive and avoid aggressive automatic background behavior.

### 13. Deck Health Center

Manifest/schema validation, tag validation, Context/timeline validation, coverage warnings, stale scan state, grouped issues, ignored/resolved issue state, deterministic repair actions, and Lore Assistant repair routing.

### 14. Tag System

Tag registry, namespaced tags, tag manager, bulk tag edits, malformed tag repair, deprecated/undefined tag warnings, alias/dependency checks, and tag preservation during import/export and duplication.

### 15. Import, Export, And Update System

Individual `.saga-loredeck.json` export, selected bulk export, local import, URL/GitHub import, update preview, content-hash comparison, collision handling, local modification warnings, and Custom-copy installation behavior.

### 16. Loredeck Creator

The staged generation workflow: scope brief, granularity, title pass, timeline/tag planning, micro-batched Lorecard drafting, Generated Loredeck shell creation, Pending Review integration, validation, and export readiness.

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

1. Finish the Harry Potter split-deck family and retire the old monolithic default.
2. Stabilize Loredeck Library folder/stack behavior at scale.
3. Verify Context selection and Context-gated retrieval against the split HP decks.
4. Harden Injection preview/debugging so active Lorecard behavior is inspectable.
5. Run repeatable local and live SillyTavern smoke passes after each major slice.
