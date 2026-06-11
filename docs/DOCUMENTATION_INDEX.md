# Saga Documentation

Saga documentation is being organized into release-facing topic folders. Older implementation notes still live in `development/` until they are promoted, rewritten, or archived.

## Release-Facing Docs

- [Basic Workflow](user/BASIC_WORKFLOW.md): Basic Walkthrough module guide for First Run, Loredecks, Context, Lorecards, Continue Roleplay, and Settings without advanced prompt controls.
- [Advanced Workflow](user/ADVANCED_WORKFLOW.md): Advanced Walkthrough task-track guide for Library mastery, runtime control, Context, Lorecards, Injection, Continuity, Creator, Pack Health, Settings, and troubleshooting.
- [Wandlight To Saga](user/WANDLIGHT_TO_SAGA.md): concept mapping for users moving from old Wandlight mental models to Saga-native Loredecks, Context, Lorecards, and Injection.
- [Loredecks](loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md): Loredeck and Lorecard creation guidance, reference-deck expectations, authoring workflow, and schema links.
- [LLM Loredeck Generation](loredecks/LLM_LOREDECK_GENERATION_GUIDE.md): compact handoff for another LLM that needs to generate or revise Saga Loredecks and Lorecards.

## Development Notes

- [development](development/): active planning, audits, implementation notes, and pre-release engineering records. These files are not yet organized as end-user documentation.
- [Basic And Advanced Experience Modes Plan](development/SAGA_EXPERIENCE_MODES_PLAN.md): product and implementation plan for revising Saga's guided Basic workflow and full Advanced workflow.
- [Basic Experience Implementation Plan](development/SAGA_BASIC_EXPERIENCE_IMPLEMENTATION_PLAN.md): focused feature plan for hiding Injection in Basic mode while adding the Start Checklist and workflow-card Basic Walkthrough.
- [Basic Checklist Guided Tasks](development/SAGA_BASIC_CHECKLIST_GUIDED_TASKS.md): feature plan for checklist-launched guided task strips that help first-time Basic users complete setup steps and return to the Start Checklist.
- [Walkthrough Workflow Expansion Plan](development/SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md): coverage-driven implementation plan for the B01-B49 Basic modules and A01-A155 Advanced task tracks without fixed step-count limits.
- [Loredeck Zip Package Import/Export Plan](development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md): development plan for replacing front-facing Loredeck JSON import/export with bundled-folder-shaped `.saga-loredeck.zip` packages.
- [Alpha Repository Restructure Plan](development/SAGA_ALPHA_REPOSITORY_RESTRUCTURE_PLAN.md): production-alpha cleanup plan for moving root implementation code, bundled Loredecks, presets, passive assets, tests, and tools into durable repo domains.

When a development document becomes part of the product contract, move it into the relevant topic folder and update links from the old location.
