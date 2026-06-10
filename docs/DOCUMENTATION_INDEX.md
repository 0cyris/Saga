# Saga Documentation

Saga documentation is being organized into release-facing topic folders. Older implementation notes still live in `development/` until they are promoted, rewritten, or archived.

## Release-Facing Docs

- [Basic Workflow](user/BASIC_WORKFLOW.md): guided first-run workflow for loading lore, setting Context, reviewing Lorecards, and continuing roleplay without advanced prompt controls.
- [Advanced Workflow](user/ADVANCED_WORKFLOW.md): full control workflow for provider setup, automation, Context auditing, Continuity, Lorecards, Injection, Deck Health, Creator, and diagnostics.
- [Wandlight To Saga](user/WANDLIGHT_TO_SAGA.md): concept mapping for users moving from old Wandlight mental models to Saga-native Loredecks, Context, Lorecards, and Injection.
- [Loredecks](loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md): Loredeck and Lorecard creation guidance, reference-deck expectations, authoring workflow, and schema links.
- [LLM Loredeck Generation](loredecks/LLM_LOREDECK_GENERATION_GUIDE.md): compact handoff for another LLM that needs to generate or revise Saga Loredecks and Lorecards.

## Development Notes

- [development](development/): active planning, audits, implementation notes, and pre-release engineering records. These files are not yet organized as end-user documentation.
- [Basic And Advanced Experience Modes Plan](development/SAGA_EXPERIENCE_MODES_PLAN.md): product and implementation plan for revising Saga's guided Basic workflow and full Advanced workflow.
- [Basic Experience Implementation Plan](development/SAGA_BASIC_EXPERIENCE_IMPLEMENTATION_PLAN.md): focused feature plan for hiding Injection in Basic mode while adding compact selected-lore status.
- [Loredeck Zip Package Import/Export Plan](development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md): development plan for replacing front-facing Loredeck JSON import/export with bundled-folder-shaped `.saga-loredeck.zip` packages.

When a development document becomes part of the product contract, move it into the relevant topic folder and update links from the old location.
