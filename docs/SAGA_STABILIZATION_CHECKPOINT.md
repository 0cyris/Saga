# Saga Stabilization Checkpoint

**SAGA: Fandom Loresystem.**

## Purpose

This checkpoint records the current production baseline before starting position-aware Lorepack retrieval.

## Current Foundation

- Bundled Lorepack scaffold exists for `hp-golden-trio`.
- Lorepack loader reads bundled packs and preserves legacy `Lore/manifest.json` fallback.
- Canon lore loading routes through the active Lorepack stack.
- Lorepack tab supports library/stack handling, detail views, Pack Health, Custom duplication, and entry overrides.
- Story Position v1 exists with per-loaded-Lorepack context state, timeline index loading, manual editing, local resolver, and explicit model fallback.
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
- Direct Lorepack loader smoke: `hp-golden-trio` loads 417 entries.
- Direct legacy fallback smoke: forced missing Lorepack manifest falls back to `Lore/manifest.json` and loads 417 entries.
- Direct canon DB smoke: canon DB loads 417 entries from `hp-golden-trio`.
- JSON parse smoke across `Lorepacks`, `Lore`, `Presets`, and `manifest.json`.

## Known Non-Blockers

- `scripts\audit-canon-preview.mjs --json` reports 417 entries and 296 entries missing `ui.preview` metadata. This is existing lore-quality cleanup work, not a Story Position blocker.
- No browser/SillyTavern visual smoke was run in this checkpoint.
- The current Saga foundation is still uncommitted in the working tree.

## Next Production Slice

Position-aware Lorepack retrieval:

- Done: normalize entry-level `position` metadata.
- Done: evaluate entry position gates against loaded Lorepack Story Positions.
- Done: remove HP entry-local date gates and route canon suggestions through position-native eligibility.
- Done: add source chips and position/gating chips to suggested and pending lore cards.
- Done: expand Pack Health checks for invalid position references, broken anchor windows, and entries that can never match a known Story Position.
- Done: generalize the HP v3 conformance test into reusable Pack Health checks for schema v3 entries, manifest stats, duplicate manifest files, wide-lore retrieval policy, and date-derived timeline sort keys.
- Done: wire these Pack Health rules into Lorepack editor validation, validated Custom/Generated export, safe repair actions, and schema v3-safe override persistence.
- Done: add Story Position and retrieval fields to the Custom entry editor so new schema v3 entries can be authored fully instead of only preserving source entry positions.
- Done: add timeline anchor search/pickers and bulk Story Position editing to make v3 authoring less manual.
- Done: add bulk tag editing and a first Tag Manager surface for Custom Lorepack entries, including tag counts, tag filtering, add/remove/rename operations, and namespaced tag preservation.
- Done: wire Tag Manager into `tags.json` source loading plus embedded Custom/Generated tag registry editing for define/edit/rename/merge/deprecate workflows.
- Done: add Pack Health checks for undefined tags, deprecated tag usage, duplicate aliases, orphaned definitions, malformed namespaces, missing parent/replacement references, and entries using tags missing from `tags.json`.
- Done: build the Pending Review Queue foundation for Lorepack edits, including pending record patches, accept/reject actions, and routing current manual/bulk entry and tag edits through review before activation.
- Done: build the Timeline Registry Editor MVP with source `timeline.json` loading, Custom overlay anchor/window editing, Pending Review routing, and runtime/Pack Health merge support.
- Done: begin the Lore Assistant proposal pipeline with an editable Lorepack panel, structured JSON proposal parsing, and Pending Review queue integration for entry, tag, and timeline patches.
- Next: add assistant proposal preview/diff controls and Pack Health rerun hooks.
