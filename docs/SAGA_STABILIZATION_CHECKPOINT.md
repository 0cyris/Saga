# Saga Stabilization Checkpoint

**SAGA: Fandom Loresystem.**

Terminology note: public-facing Saga language is now **Loredeck**, **Lorecard**, and **Deck Health**. Internal filenames, persisted keys, and compatibility tests still use `lorepack` names until the alias/migration pass.

## Purpose

This checkpoint records the current production baseline before starting position-aware Loredeck retrieval.

## Current Foundation

- Bundled Loredeck scaffold exists for `hp-golden-trio`.
- Loredeck loader reads bundled decks and preserves legacy `Lore/manifest.json` fallback.
- Canon lore loading routes through the active Loredeck stack.
- Loredeck tab supports library/stack handling, detail views, Deck Health, Custom duplication, and entry overrides.
- Story Position v1 exists with per-loaded-Loredeck context state, timeline index loading, manual editing, local resolver, and explicit model fallback.
- Runtime Settings tab exists at the end of the shelf UI.
- Provider settings have moved from the extension dropdown into the runtime Settings tab.
- Theme Pack foundation exists for bundled and installed Custom Theme Packs, JSON import/export, color tokens, icon overrides, and advisory accessibility checks.
- Entry-level `position` metadata normalizes through the lore pipeline.
- Story Position gate evaluation exists as a reusable pure helper, and canon retrieval now requires position-native eligibility.

## Validation Run

Passed:

- `node --check constants.js`
- `node --check state-manager.js`
- `node --check lore-panel.js`
- `node --check lorepack-loader.js`
- `node --check canon-lore-db.js`
- `node --check index.js`
- `node scripts\test-lore-timeline.mjs`
- `node scripts\test-story-context-header-detection.mjs`
- `node scripts\test-generated-lore-overhaul.mjs`
- `node scripts\scan-secrets.mjs`
- Direct Loredeck loader smoke: `hp-golden-trio` loads 417 entries.
- Direct legacy fallback smoke: forced missing Loredeck manifest falls back to `Lore/manifest.json` and loads 417 entries.
- Direct canon DB smoke: canon DB loads 417 entries from `hp-golden-trio`.
- JSON parse smoke across `Lorepacks`, `Lore`, `Presets`, and `manifest.json`.
- Local visual smoke harness contract: validates the harness, seeded Custom Loredeck, update fixture, runtime panel strings, and CSS hooks.
- Local visual smoke server self-check: serves the harness and update fixture without external dependencies.
- First SillyTavern smoke pass: the extension loads without console errors, the shelf opens correctly, and the Loredecks tab renders well enough for focused UX feedback.

## Known Non-Blockers

- `scripts\audit-canon-preview.mjs --json` reports 417 entries and 296 entries missing `ui.preview` metadata. This is existing lore-quality cleanup work, not a Story Position blocker.
- Formal screenshot capture is still pending after the first SillyTavern smoke pass. The local harness, runbook, and server checks are ready for repeatable before/after comparison.
- The current Saga foundation is still uncommitted in the working tree.

## Next Production Slice

Position-aware Loredeck retrieval:

- Done: normalize entry-level `position` metadata.
- Done: evaluate entry position gates against loaded Loredeck Story Positions.
- Done: remove HP entry-local date gates and route canon suggestions through position-native eligibility.
- Done: add source chips and position/gating chips to suggested and pending lore cards.
- Done: expand Deck Health checks for invalid position references, broken anchor windows, and entries that can never match a known Story Position.
- Done: generalize the HP v3 conformance test into reusable Deck Health checks for schema v3 entries, manifest stats, duplicate manifest files, wide-lore retrieval policy, and date-derived timeline sort keys.
- Done: wire these Deck Health rules into Loredeck editor validation, validated Custom/Generated export, safe repair actions, and schema v3-safe override persistence.
- Done: add Story Position and retrieval fields to the Custom entry editor so new schema v3 entries can be authored fully instead of only preserving source entry positions.
- Done: add timeline anchor search/pickers and bulk Story Position editing to make v3 authoring less manual.
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
- Next: run a targeted visual smoke pass in SillyTavern against these fixes, including collapsed-section defaults, Reset Window behavior, Loredeck chip/title styling, HP Deck Health malformed namespace warnings, Creator wizard launch, granularity copy, stack arrows, and runtime header branding.
- Next: design individual Loredeck bulk export/import from selected Loredecks, producing one JSON file per deck and avoiding whole-library import/export.
- Next: audit Loredecks actions that still trigger full panel refreshes or scroll snap-to-top behavior.
- Next: run UX/UI studies before major implementation for Deck Health, the fullscreen Loredeck Library + Stack Loader workbench, and the Story Position editor.
