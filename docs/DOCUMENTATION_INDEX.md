# Saga Documentation

Saga documentation is being organized into release-facing topic folders. Older implementation notes still live in `development/` until they are promoted, rewritten, or archived.

## Release-Facing Docs

- [Basic Workflow](user/BASIC_WORKFLOW.md): Basic Walkthrough module guide for First Run, Loredecks, Context, Lorecards, Continue Roleplay, and Settings without advanced prompt controls.
- [Advanced Workflow](user/ADVANCED_WORKFLOW.md): Advanced Walkthrough task-track guide for Library mastery, runtime control, Context, Lorecards, Injection, Continuity, Creator, Pack Health, Settings, and troubleshooting.
- [Alpha Release Notes](release/0.1.0-alpha.1.md): versioned alpha compatibility, manual update, State Safety, and release-gate notes.
- [Wandlight To Saga](user/WANDLIGHT_TO_SAGA.md): concept mapping for users moving from old Wandlight mental models to Saga-native Loredecks, Context, Lorecards, and Injection.
- [Loredecks](loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md): Loredeck and Lorecard creation guidance, reference-deck expectations, authoring workflow, and schema links.
- [LLM Loredeck Generation](loredecks/LLM_LOREDECK_GENERATION_GUIDE.md): compact handoff for another LLM that needs to generate or revise Saga Loredecks and Lorecards.

## Development Notes

- [development](development/): active planning, audits, implementation notes, and pre-release engineering records. These files are not yet organized as end-user documentation.
- [Basic And Advanced Experience Modes Plan](development/SAGA_EXPERIENCE_MODES_PLAN.md): product and implementation plan for revising Saga's guided Basic workflow and full Advanced workflow.
- [Basic Experience Implementation Plan](development/SAGA_BASIC_EXPERIENCE_IMPLEMENTATION_PLAN.md): focused feature plan for hiding Injection in Basic mode while adding the Start Checklist and workflow-card Basic Walkthrough.
- [Basic Checklist Mini-Tours](development/SAGA_BASIC_CHECKLIST_GUIDED_TASKS.md): implementation note for Start Checklist actions that launch external, button-by-button mini-tours.
- [Walkthrough Workflow Expansion Plan](development/SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md): coverage-driven implementation plan for the B01-B55 Basic modules and A01-A165 Advanced task tracks without fixed step-count limits.
- [Loredeck Zip Package Import/Export Plan](development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md): development plan for replacing front-facing Loredeck JSON import/export with bundled-folder-shaped `.saga-loredeck.zip` packages.
- [Loredeck Creator Coverage Overhaul](development/LOREDECK_CREATOR_COVERAGE_OVERHAUL.md): alpha plan for semantic Creator Coverage, adaptive density, targeted title expansion, and underbuilt Generated Lorepack warnings without hard entry thresholds.
- [Saga Generation Hardening Plan](development/SAGA_GENERATION_HARDENING_PLAN.md): feature plan for normalizing provider response shapes, typed generation errors, Creator stage validators, and sanitized diagnostics.
- [Saga Chip Design Schema](development/SAGA_CHIP_DESIGN_SCHEMA.md): design schema for compact chip, pill, badge, and metadata-bubble hierarchy across Creator, Library, Lorecards, Context, Pack Health, and Settings.
- [Jujutsu Kaisen Loredeck Series Plan](development/JJK_LOREDECK_SERIES_PLAN.md): source-boundary, deck-family split, Context model, tag plan, and Pack Health bar for a manga-primary JJK Bundled Lorepack family.
- [Alpha Repository Restructure Plan](development/SAGA_ALPHA_REPOSITORY_RESTRUCTURE_PLAN.md): production-alpha cleanup plan for moving root implementation code, bundled Loredecks, presets, passive assets, tests, and tools into durable repo domains.
- [Alpha Refactor Plan](development/SAGA_ALPHA_REFACTOR_PLAN.md): pre-alpha to alpha decomposition plan for runtime, state, CSS, loader, startup, prompt injection globals, and Loredeck workflow UI.
- [Alpha Stabilization And UI Extraction](development/SAGA_ALPHA_STABILIZATION_AND_UI_EXTRACTION.md): next-pass checkpoint for proving the broad refactor behavior, then extracting shared Loredeck UI primitives.

When a development document becomes part of the product contract, move it into the relevant topic folder and update links from the old location.
