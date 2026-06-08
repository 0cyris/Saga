# Saga Documentation

Saga documentation is being organized into release-facing topic folders. Older implementation notes still live in `development/` until they are promoted, rewritten, or archived.

## Release-Facing Docs

- [Loredecks](loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md): Loredeck and Lorecard creation guidance, reference-deck expectations, authoring workflow, and schema links.
- [LLM Loredeck Generation](loredecks/LLM_LOREDECK_GENERATION_GUIDE.md): compact handoff for another LLM that needs to generate or revise Saga Loredecks and Lorecards.

## Development Notes

- [development](development/): active planning, audits, implementation notes, and pre-release engineering records. These files are not yet organized as end-user documentation.
- [Loredeck Zip Package Import/Export Plan](development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md): development plan for replacing front-facing Loredeck JSON import/export with bundled-folder-shaped `.saga-loredeck.zip` packages.

When a development document becomes part of the product contract, move it into the relevant topic folder and update links from the old location.
