# Saga Documentation

Saga documentation is being organized into release-facing topic folders. Older implementation notes still live in `development/` until they are promoted, rewritten, or archived.

## Release-Facing Docs

- [Basic Workflow](user/BASIC_WORKFLOW.md): Basic Walkthrough module guide for First Run, Loredecks, Context, Lorecards, Continue Roleplay, and Settings without advanced prompt controls.
- [Advanced Workflow](user/ADVANCED_WORKFLOW.md): Advanced Walkthrough task-track guide for Library mastery, runtime control, Context, Lorecards, Injection, Continuity, Creator, Pack Health, Settings, and troubleshooting.
- [Operator's Manual](user/OPERATOR_MANUAL.md): full screenshot-backed guide to Session, Loredecks, Pack Health, Creator, Context, Lorecards, Continuity, Injection, Settings, and troubleshooting.
- [Storage And State Safety](user/STORAGE_AND_STATE_SAFETY.md): operator guide for Saga's `/user/files` storage model, `settings.json` boundaries, import storage, State Safety maintenance, and Danger Zone cleanup.
- [Alpha Release Notes](release/0.1.0-alpha.1.md): versioned alpha compatibility, manual update, State Safety, and release-gate notes.
- [Loredecks](loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md): Loredeck and Lorecard creation guidance, reference-deck expectations, authoring workflow, and schema links.
- [Loredeck Zip Package Structure](loredecks/LOREDECK_ZIP_PACKAGE_STRUCTURE.md): importable `.saga-loredeck.zip` folder layout, package index requirements, deck-local cover image rules, and LLM handoff checklist.
- [LLM Loredeck Generation](loredecks/LLM_LOREDECK_GENERATION_GUIDE.md): compact handoff for another LLM that needs to generate or revise Saga Loredecks and Lorecards.

## Development Notes

- [development](development/): active planning, audits, implementation notes, and pre-release engineering records. These files are not yet organized as end-user documentation.
- [Basic And Advanced Experience Modes Plan](development/SAGA_EXPERIENCE_MODES_PLAN.md): product and implementation plan for revising Saga's guided Basic workflow and full Advanced workflow.
- [Basic Experience Implementation Plan](development/SAGA_BASIC_EXPERIENCE_IMPLEMENTATION_PLAN.md): focused feature plan for hiding Injection in Basic mode while adding the Start Checklist and workflow-card Basic Walkthrough.
- [Basic Checklist Mini-Tours](development/SAGA_BASIC_CHECKLIST_GUIDED_TASKS.md): implementation note for Start Checklist actions that launch external, button-by-button mini-tours.
- [Walkthrough Workflow Expansion Plan](development/SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md): coverage-driven implementation plan for the B01-B55 Basic modules and A01-A165 Advanced task tracks without fixed step-count limits.
- [Saga Mobile Support Feature](development/SAGA_MOBILE_SUPPORT_FEATURE.md): phone-first feature plan for replacing the desktop rail/drawer with a fixed bottom bar, mobile header, staged subviews, touch-density rules, and mobile smoke coverage.
- [Saga Mobile UX Revision Feature](development/SAGA_MOBILE_UX_REVISION_FEATURE.md): follow-up feature for refining the mobile MVP into an object-first, less toolbar-heavy, visually verified Saga phone experience.
- [Saga Mobile Support Parallelization Addendum](development/SAGA_MOBILE_SUPPORT_PARALLELIZATION_ADDENDUM.md): historical three-agent handoff plan for the initial mobile build; the active revision work continues through the Mobile UX Revision Feature.
- [Loredeck Zip Package Import/Export Plan](development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md): development plan for replacing front-facing Loredeck JSON import/export with bundled-folder-shaped `.saga-loredeck.zip` packages.
- [Loredeck Creator Reset To Step Plan](development/LOREDECK_CREATOR_RESET_TO_STEP_PLAN.md): destructive top-bar reset feature for returning a Creator project to an earlier stage and clearing downstream data without undo/history state.
- [Loredeck Creator Coverage Overhaul](development/LOREDECK_CREATOR_COVERAGE_OVERHAUL.md): alpha plan for semantic Creator Coverage, adaptive density, targeted title expansion, and underbuilt Generated Lorepack warnings without hard entry thresholds.
- [Loredeck Creator Lorecard Rejection Recovery Plan](development/LOREDECK_CREATOR_LORECARD_REJECTION_RECOVERY_PLAN.md): focused implementation plan for distinguishing provider failures from Saga-side schema rejections, preflighting Lorecard targets, preserving partial batches, and automatically retrying rejected titles.
- [Loredeck Health Auto-Fix System Plan](development/LOREDECK_HEALTH_AUTO_FIX_SYSTEM_PLAN.md): umbrella plan for replacing fragmented Pack Health repair actions with one `Attempt Fixing` workflow split into storage-safe parallel work and post-storage integration.
- [Loredeck Health Auto-Fix Stage 1](development/LOREDECK_HEALTH_AUTO_FIX_STAGE_1_PARALLEL_PLAN.md): parallel-safe foundation plan for pure repair planning, patch building, validation, model prompt/parser contracts, and tests that do not touch storage or UI wiring.
- [Loredeck Health Auto-Fix Stage 2](development/LOREDECK_HEALTH_AUTO_FIX_STAGE_2_STORAGE_INTEGRATION_PLAN.md): post-storage integration plan for wiring Stage 1 into external payload writes, repair sessions, Health Center UX, Creator readiness, and provider-backed repair batches.
- [Saga Storage Rework Design](development/SAGA_STORAGE_REWORK_DESIGN.md): detailed design for moving Saga-owned Lorepacks, Creator projects, Theme Packs, Icon Sets, and passive assets out of `settings.json` into flat `/user/files` JSON storage without server plugins.
- [Saga Storage Finalization Scope Plan](development/SAGA_STORAGE_FINALIZATION_SCOPE_PLAN.md): closeout plan and signoff evidence for collision-safe Theme/Icon imports, repair-session lifecycle, stale-write detection, storage-harness coverage, and real-profile audit.
- [Saga Danger Zone Global Cleanup Plan](development/SAGA_DANGER_ZONE_GLOBAL_CLEANUP_PLAN.md): implementation plan for relocating Danger Zone to Settings, splitting Active Chat and Global cleanup actions, and adding destructive custom-content and total cleanup workflows.
- [Saga Generation Hardening Plan](development/SAGA_GENERATION_HARDENING_PLAN.md): feature plan for normalizing provider response shapes, typed generation errors, Creator stage validators, and sanitized diagnostics.
- [Saga Chip Design Schema](development/SAGA_CHIP_DESIGN_SCHEMA.md): design schema for compact chip, pill, badge, and metadata-bubble hierarchy across Creator, Library, Lorecards, Context, Pack Health, and Settings.
- [Jujutsu Kaisen Loredeck Series Plan](development/JJK_LOREDECK_SERIES_PLAN.md): source-boundary, deck-family split, Context model, tag plan, and Pack Health bar for a manga-primary JJK Bundled Lorepack family.
- [Alpha Repository Restructure Plan](development/SAGA_ALPHA_REPOSITORY_RESTRUCTURE_PLAN.md): production-alpha cleanup plan for moving root implementation code, bundled Loredecks, presets, passive assets, tests, and tools into durable repo domains.
- [Alpha Refactor Plan](development/SAGA_ALPHA_REFACTOR_PLAN.md): pre-alpha to alpha decomposition plan for runtime, state, CSS, loader, startup, prompt injection globals, and Loredeck workflow UI.
- [Alpha Stabilization And UI Extraction](development/SAGA_ALPHA_STABILIZATION_AND_UI_EXTRACTION.md): next-pass checkpoint for proving the broad refactor behavior, then extracting shared Loredeck UI primitives.

When a development document becomes part of the product contract, move it into the relevant topic folder and update links from the old location.
