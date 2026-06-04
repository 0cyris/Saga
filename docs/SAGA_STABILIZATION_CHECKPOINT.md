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

## Known Non-Blockers

- `scripts\audit-canon-preview.mjs --json` reports 417 entries and 296 entries missing `ui.preview` metadata. This is existing lore-quality cleanup work, not a Story Position blocker.
- No browser/SillyTavern visual smoke was run in this checkpoint.
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
- Next: build import/install handling for exported Saga Loredeck bundles, including Generated-to-Custom install choices, duplicate-deck warnings, and update-source metadata for creator-shared decks.
