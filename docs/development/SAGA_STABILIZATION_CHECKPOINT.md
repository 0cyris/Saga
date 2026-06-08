# Saga Stabilization Checkpoint

**SAGA: Fandom Loresystem.**

Terminology note: public-facing Saga language is now **Loredeck**, **Lorecard**, and **Deck Health**. Internal filenames, persisted keys, and compatibility tests still use `loredeck` names until the alias/migration pass.

## Purpose

This checkpoint records the current production baseline before starting Context-aware Loredeck retrieval.

## 2026-06-06 Status Update

This file now contains both historical checkpoint evidence and current stabilization direction.

The older `hp-golden-trio` notes describe the first Loredeck scaffold and the first Context-aware retrieval baseline. They should not be read as the current desired HP reference architecture. Current production direction is the split HP family:

```text
hp-core
hp-year-1-philosophers-stone
hp-year-2-chamber-of-secrets
hp-year-3-prisoner-of-azkaban
hp-year-4-goblet-of-fire
hp-year-5-order-of-the-phoenix
hp-year-6-half-blood-prince
hp-year-7-deathly-hallows
hp-epilogue-post-war
```

Saga is now in pre-alpha integration hardening. The immediate goal is no longer simply proving that a Loredeck loads. The immediate goal is proving the core runtime loop deterministically:

```text
active Loredeck stack
  -> selected/resolved Context
  -> eligible Lorecard candidates
  -> suggested and accepted Lorecards
  -> dynamic pin, mute, and relevance behavior
  -> injection preview and prompt output
```

The next test-planning document is [SAGA_CORE_INTEGRATION_TESTING.md](SAGA_CORE_INTEGRATION_TESTING.md).

## Current Foundation

- Bundled Loredeck scaffold exists for `hp-golden-trio`.
- Loredeck loader reads bundled decks from `Loredecks/`; root `Lore/` fallback has been removed.
- Canon lore loading routes through the active Loredeck stack.
- Loredeck tab supports library/stack handling, detail views, Deck Health, Custom duplication, and entry overrides.
- Context v1 exists with per-loaded-Loredeck context state, timeline index loading, manual editing, local resolver, and explicit model fallback.
- Runtime Settings tab exists at the end of the shelf UI.
- Provider settings have moved from the extension dropdown into the runtime Settings tab.
- Theme Pack foundation exists for bundled and installed Custom Theme Packs, JSON import/export, color tokens, icon overrides, and advisory accessibility checks.
- Entry-level `context` metadata normalizes through the lore pipeline.
- Context gate evaluation exists as a reusable pure helper, and canon retrieval now requires Context-native eligibility.

## Validation Run

Passed:

- `node --check constants.js`
- `node --check state-manager.js`
- `node --check lore-panel.js`
- `node --check loredeck-loader.js`
- `node --check canon-lore-db.js`
- `node --check index.js`
- `node scripts\test-lore-timeline.mjs`
- `node scripts\test-generated-lore-overhaul.mjs`
- `node scripts\scan-secrets.mjs`
- Direct Loredeck loader smoke: `hp-golden-trio` loads 417 entries.
- Missing bundled Loredeck manifests now fail through Deck Health instead of falling back to root `Lore/`.
- Direct canon DB smoke: canon DB loads 417 entries from `hp-golden-trio`.
- JSON parse smoke across `Loredecks`, `Presets`, and `manifest.json`.
- Local visual smoke harness contract: validates the harness, seeded Custom Loredeck, update fixture, runtime panel strings, and CSS hooks.
- Local visual smoke server self-check: serves the harness and update fixture without external dependencies.
- First SillyTavern smoke pass: the extension loads without console errors, the shelf opens correctly, and the Loredecks tab renders well enough for focused UX feedback.
- Targeted current-code visual smoke harness pass: runtime shelf, fullscreen Loredeck Library, Active Stack, Deck Health Center, Creator wizard, update preview, Settings/Theme Packs, and Injection preview render without browser console errors.
- Live SillyTavern screenshot pass after syncing the current workspace into `data/default-user/extensions/Saga`: saved `live-st-01-initial.png`, `live-st-02-loredecks.png`, `live-st-03-library.png`, `live-st-03-delete-confirm.png`, `live-st-04-health.png`, `live-st-05-creator.png`, `live-st-07-theme-pack.png`, and `live-st-08-injection.png` under `Images/documentation/renders/saga-smoke/`; the final pass reported no findings, no browser console errors, and no native dialog events.

## Known Non-Blockers

- `scripts\audit-canon-preview.mjs --json` reports 417 entries and 296 entries missing `ui.preview` metadata. This is existing lore-quality cleanup work, not a Context blocker.
- URL/GitHub package import and update checks are deferred; the current Library workflow should expose local `.saga-loredeck.zip` import/export only.
- The current Saga foundation is still uncommitted in the working tree.

## Completed Production Slice

Context-aware Loredeck retrieval:

- Done: normalize entry-level `context` metadata.
- Done: evaluate entry Context gates against loaded Loredeck Contexts.
- Done: remove HP entry-local date gates and route canon suggestions through Context-native eligibility.
- Done: add source chips and Context/gating chips to suggested and pending lore cards.
- Done: expand Deck Health checks for invalid Context references, broken anchor windows, and entries that can never match a known Context.
- Done: generalize the HP v3 conformance test into reusable Deck Health checks for schema v3 entries, manifest stats, duplicate manifest files, wide-lore retrieval policy, and date-derived timeline sort keys.
- Done: wire these Deck Health rules into Loredeck editor validation, validated Custom/Generated export, safe repair actions, and schema v3-safe override persistence.
- Done: add Context and retrieval fields to the Custom entry editor so new schema v3 entries can be authored fully instead of only preserving source entry Context gates.
- Done: add timeline anchor search/pickers and bulk Context editing to make v3 authoring less manual.
- Done: add bulk tag editing and a first Tag Manager surface for Custom Loredeck entries, including tag counts, tag filtering, add/remove/rename operations, and namespaced tag preservation.
- Done: wire Tag Manager into `tags.json` source loading plus embedded Custom/Generated tag registry editing for define/edit/rename/merge/deprecate workflows.
- Done: add Deck Health checks for undefined tags, deprecated tag usage, duplicate aliases, orphaned definitions, malformed namespaces, missing parent/replacement references, and entries using tags missing from `tags.json`.
- Done: build the Pending Review Queue foundation for Loredeck edits, including pending record patches, accept/reject actions, and routing current manual/bulk entry and tag edits through review before activation.
- Done: build the Timeline Registry Editor MVP with source `timeline.json` loading, Custom overlay anchor/window editing, Pending Review routing, and runtime/Deck Health merge support.
- Done: begin the Lore Assistant proposal pipeline with an editable Loredeck panel, structured JSON proposal parsing, and Pending Review queue integration for entry, tag, and timeline patches.
- Done: add field-level Pending Review diffs for entry, tag, and timeline record patches.
- Done: add assistant proposal provenance/risk display polish and Deck Health rerun hooks.
- Done: add Lore Assistant quality-rubric guardrails and proposal review affordances before deeper Loredeck Creator work.
- Done: add assistant batch review controls for edit-before-queue, queue selected/all, drop selected, edit draft JSON, and revise selected proposals before they enter Pending Review.
- Done: wire Deck Health issue repair planning into the Lore Assistant so users can turn selected health warnings into reviewable repair proposals.
- Done: begin the Loredeck Creator intake scaffold with staged scope briefing, granularity selection, generated deck brief review, revision, and approval.
- Done: add Creator title-pass generation from an approved brief, with selectable title drafts, approve/drop controls, revise-selected generation, and JSON editing before full entries exist.
- Done: add Creator timeline/tag planning from the approved brief and title shape, creating a Generated Loredeck shell and routing generated anchors/windows/tag definitions through Pending Review before full entry generation.
- Done: generate full schema v3 entry drafts from approved titles plus accepted planning metadata, landing them in the same edit-before-queue and Pending Review pipeline before activation.
- Done: harden Generated Loredeck validation/export for accepted Creator entries, including virtual generated manifest stats, Deck Health rerun affordances, runtime loading for virtual generated entries, and export readiness checks.
- Done: build JSON import/install handling for exported Saga Loredeck bundles, including Generated-to-Custom installation, collision-safe deck IDs, embedded virtual Custom Lorecard loading, and source/update metadata capture.
- Done: add a fuller install preview and duplicate-deck review surface, including content-hash comparison, editable deck update/reinstall choices, local-modification warnings, and clearer duplicate-match reasons.
- Done: add source/update handling for installed Loredecks, including check-for-updates from URL/GitHub metadata, GitHub raw/blob URL normalization, content-hash current-version detection, update/reinstall preview prompts, and local-modification warnings.
- Done: add a local visual smoke harness and contract test for the Saga runtime shelf, seeded Custom Loredeck, Pending Review content, update-source preview fixture, Creator surface, and runtime CSS hooks.
- Done: add a no-dependency visual smoke server and runbook so the harness can be opened in a normal browser or repeated inside SillyTavern with a concrete screenshot checklist.
- Done: complete the first real SillyTavern smoke pass and capture focused Loredecks UX feedback.
- Done: apply the first low-risk Loredecks feedback fixes: collapsible Loredeck sections with reset defaults, stricter tag ID normalization, HP reference-deck tag cleanup, Lorecard-aligned metadata chips and titles, fullscreen Creator launcher, Saga-styled granularity labels/blurbs, stack arrow controls, individual-deck install focus, and Saga banner/minimized branding assets.
- Done: start the Deck Health redesign with a fullscreen Deck Health Center for readiness, severity cards, grouped priority issues, health categories, deck inventory, files, coverage, and advanced diagnostics.
- Done: resolve the live-ST smoke findings around Theme Pack responsiveness, Deck Health unscanned/readiness copy, extension-menu branding cache, and automation-safe delete confirmation.
- Done: implement selected-Loredeck package import/export in the fullscreen Library, including click/Ctrl/Shift selection, selected-count actions, one `.saga-loredeck.zip` package for selected decks, zip package preview, and Custom-copy installation.
- Done: expand Deck Health remediation. Grouped Health Center issues can persist ignored/resolved advisory state, queue deterministic malformed-tag fixes through Pending Review, hand a single group to the Lore Assistant for repair drafts, and route Bundled decks to Duplicate as Custom before repairs.
- Done: migrate runtime Context controls from the Loredeck tab into the Context tab, including loaded-Loredeck Context review, current-context resolving, Reasoner fallback launch, quick anchors, manual locks, reset actions, and fullscreen Context Browser access.
- Done: upgrade Reasoner-backed Context resolution so automatic fallback follows the existing message-count and character-count cadence, chooses from bounded anchor/window candidates, and stores structured, confirmable Context patches for user review.
- Done: revise timeline densification policy around high-value candidate quality rather than alias sprawl. Deck Health now gives non-blocking sparse-candidate, concentrated-anchor, and missing-window suggestions.
- Done: chunk Loredeck Creator full-entry drafting into resumable micro-batches. The Creator now drafts the next small approved-title set per provider call, can optionally run a bounded sequence of separate calls, and preserves successful draft batches if a later call fails.
- Done: make accepted Lorecard injection Context-aware. Accepted Lorecards now remain in the accepted set when Context advances, but prompt memo selection and injection audit re-check active Loredeck Context gates and report stale accepted entries as `context_blocked` instead of injecting future/out-of-window lore.
- Done: lock the Jan. 25, 1997 / `before Apparition lessons` resolver edge. Explicit `sceneDate` now remains authoritative over loose supporting boundary text, so the resolver selects the post-Christmas/pre-Apparition window instead of jumping to the upcoming Apparition anchor.
- Done: expand deterministic core integration coverage into Year 1 with `scripts/test-core-integration-hp-year1.mjs`. The Year 1 harness validates Core + Philosopher's Stone stack loading, Sorting to Stone-aftermath Context progression, late Quirrell/Stone suggestion blocking/activation, accepted stale-lore Context blocking, and current aftermath-lore injection.
- Done: expand deterministic core integration coverage into Year 2 with `scripts/test-core-integration-hp-year2.mjs`. The Year 2 harness validates Core + Chamber of Secrets stack loading, first-attack to Ginny-rescue Context progression, pre-reveal spoiler guard preview/blocking, active Chamber-crisis stale-lore Context blocking, and current Chamber-resolution injection.
- Done: expand deterministic core integration coverage beyond Year 6 with `scripts/test-core-integration-hp-year3.mjs`. The Year 3 harness validates Core + Prisoner of Azkaban stack loading, winter-to-rescue Context progression, suggestion-set changes, accepted stale-lore Context blocking, and current rescue-lore injection.
- Done: expand deterministic core integration coverage into Year 4 with `scripts/test-core-integration-hp-year4.mjs`. The Year 4 harness validates Core + Goblet of Fire stack loading, early Triwizard setup to post-graveyard Context progression, late Voldemort-return suggestion blocking/activation, accepted stale-lore Context blocking, and current aftermath-lore injection.
- Done: expand deterministic core integration coverage into Year 5 with `scripts/test-core-integration-hp-year5.mjs`. The Year 5 harness validates Core + Order of the Phoenix stack loading, DA-formation to post-Department Context progression, late Sirius/public-return suggestion blocking/activation, accepted stale-lore Context blocking, and current aftermath-lore injection.
- Done: expand deterministic core integration coverage into Year 7 with `scripts/test-core-integration-hp-year7.mjs`. The Year 7 harness validates Core + Deathly Hallows stack loading, locket-camping to Battle Aftermath Context progression, Battle death-state guard preview/blocking, accepted stale-lore Context blocking, and current aftermath-lore injection.
- Done: expand deterministic core integration coverage into Epilogue/Post-War with `scripts/test-core-integration-hp-epilogue-post-war.mjs`. The Post-War harness validates Core + Post-War stack loading, 1998 rebuilding to 2014 World Cup to 2017 King's Cross Context progression, pre-epilogue guard blocking, accepted stale-lore Context blocking, and current epilogue-lore injection.
- Done: scaffold the Harry Potter Golden Trio split-deck family. `hp-core` plus Year 1-7 folders now exist with dense first-class timelines generated from the anchor plan, including the Year 6 post-Christmas/Apparition window and a single dense Year 7 deck. These are intentionally not registered as bundled Library decks until entries are split and conformance checks pass.
- Done: add HP reference-deck conformance coverage with `scripts/test-hp-reference-deck-conformance.mjs`. It verifies the bundled HP defaults, `Loredecks/index.json`, duplicated manifests, Deck Health summaries, deck-local covers, tag registries, file lists, empty active-stack defaults, and absence of the legacy monolithic `hp-golden-trio` deck from runtime defaults.
## Next Production Slice

Loredeck Library and stack stabilization:

- Stabilize folders, drag/drop, selection, bulk actions, and active-stack persistence at larger Library scale.
- Prove Library and stack state survive refresh/reopen without stale selections, duplicated stack records, or unexpected scroll resets.
- Keep HP reference-deck conformance and deterministic integration coverage passing as the baseline regression suite.
- Keep proving candidate suggestions only come from enabled stack items.
- Keep proving accepted Lorecards preserve schema v3 Context and retrieval metadata across different year decks.
- Keep real SillyTavern chat files local-only; derive compact synthetic fixtures before committing anything.
