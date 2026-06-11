# Loredeck Zip Package Import/Export Plan

## Purpose

Saga should retire front-facing `.saga-loredeck.json` import/export and replace it with zip packages that carry the same kind of complete folder structure used by bundled Loredecks.

The user workflow should be simple:

1. A creator builds one or more Loredecks, including manifests, index metadata, entry files, registries, folders, and cover images.
2. They zip the package.
3. Another user clicks `Import Deck`.
4. Saga validates the package, previews what will be installed, and imports everything as editable Custom Loredecks with folder placement and covers intact.

The package is a data container only. Loredeck packages must never run code.

## Current State

The product direction is documented in broad terms, and the implementation is now in the first zip-package stage. Export and local package import are wired; the remaining work is retiring the front-facing JSON fallback, improving package update flows, and expanding tests around end-to-end Library persistence.

Current code paths:

- `loredeck-library-panel.js` wires the Library header `Import Deck` button to `installLoredeckBundleFromFile()`.
- `loredeck-library-panel.js` wires `Export Selected` to `exportSelectedLoredeckBundles(selectedPacks, btn)`.
- `src/runtime/lore-panel.js` now exports selected Loredecks as one `.saga-loredeck.zip` package through the package staging helpers and `createLoredeckZipPackage()`.
- `src/runtime/lore-panel.js` imports local `.saga-loredeck.zip` packages through `parseLoredeckZipPackage()`, opens a package preview, persists selected decks as virtual Custom Loredecks, and preserves package folder placement with folder ID remapping.
- Existing installer behavior already handles duplicate review, content-hash comparison, bundled-deck overwrite protection, local-modification warnings, and install-as-Custom semantics.
- Current custom cover import stores resized passive image assets on editable deck records; bundled covers resolve from deck-relative paths such as `assets/cover.png`.

Bundled Loredecks already provide the desired authoring model under repo content:

```text
content/loredecks/
  index.json
  hp-core/
    loredeck.json
    manifest.json
    tags.json
    timeline.json
    assets/
      cover.png
    characters/
      core_students.json
    knowledge/
      secret_knowledge.json
```

The zip package work should preserve the existing install-preview and collision-resolution logic, but replace the transport format, asset handling, and export writer.

## Implementation Status

Current as of June 8, 2026:

- Package planning doc created and linked from the documentation index.
- Schema docs now identify `.saga-loredeck.zip` as the public import/export direction and `.saga-loredeck.json` as legacy interim behavior.
- `loredeck-package-zip.js` added as a small data-only zip foundation. It can create standard store-method zip archives, read central-directory zip archives, reject unsafe paths, reject executable entry types, verify CRCs, and safely accept ordinary directory entries.
- `loredeck-package-service.js` added as the first Loredeck package parser layer. It reads `saga-package.json`, `loredecks/index.json`, deck manifests, manifest file references, and asset references.
- `tools/scripts/test-loredeck-zip-package.mjs` added for the initial package round-trip, folder/index parsing, cover-path resolution, blocked executable path checks, unsafe path checks, and missing-file errors.
- `Export Selected` now stages selected Loredecks into one `.saga-loredeck.zip` package instead of downloading one JSON file per deck. The package includes `saga-package.json`, `loredecks/index.json`, one folder per deck, `loredeck.json`, materialized entry files, copied registry references, folder placement metadata, and passive cover/banner assets when available.
- Editable Loredeck detail exports also validate first, then use the same `.saga-loredeck.zip` package builder instead of downloading a JSON draft bundle.
- The Library and Loredecks tab copy now describes package export instead of JSON export.
- The Library import path accepts `.saga-loredeck.zip` packages, parses the package, opens a package preview, and installs selected decks as editable Custom Loredecks. Legacy JSON helpers remain only as internal update/migration code until they are removed in cleanup.

## Why JSON Import/Export Should Be Removed

JSON bundles were useful as an early transport because they were easy to hash, preview, and persist. They are not the right long-term authoring format.

Problems with JSON bundles:

- They do not mirror how bundled Loredecks are authored.
- They are awkward for creators who want to share covers, banners, registries, and multiple entry files.
- They push large images into JSON strings or omit assets entirely.
- They make multi-deck packages feel like a set of unrelated files.
- They encourage exporting one file per deck instead of exporting a coherent Loredeck package.
- They make manual authoring harder because users cannot naturally edit a folder tree and zip it.

For alpha, `.json` import/export should be removed from the normal Library UI. If needed during migration, legacy JSON import/export can temporarily live behind an internal developer-only path, but it should not be presented as the user workflow.

## Target Package Shape

Saga zip packages should mirror the bundled Loredeck directory shape under a package root.

Preferred extension:

```text
.saga-loredeck.zip
```

Preferred package layout:

```text
arlong-park.saga-loredeck.zip
  saga-package.json
  loredecks/
    index.json
    one-piece-arlong-park-core/
      loredeck.json
      manifest.json
      tags.json
      timeline.json
      assets/
        cover.png
      characters/
        arlong_pirates.json
      places/
        cocoyasi_village.json
      events/
        arlong_park_arc.json
    one-piece-arlong-park-straw-hats/
      loredeck.json
      tags.json
      timeline.json
      assets/
        cover.webp
      characters/
        straw_hats.json
```

`saga-package.json` is package metadata, not runtime lore:

```json
{
  "packageSchemaVersion": 1,
  "packageType": "saga_loredeck_package",
  "title": "One Piece: Arlong Park Loredecks",
  "description": "A creator-shared Loredeck package for the Arlong Park arc.",
  "author": "Creator Name",
  "version": "1.0.0",
  "exportedAt": 1780617600000,
  "deckCount": 2
}
```

`loredecks/index.json` should describe the decks included in the package. Package exports use a neutral `loredecks` array:

```json
{
  "schemaVersion": 2,
  "packageType": "saga_loredeck_index",
  "loredecks": [
    {
      "packId": "one-piece-arlong-park-core",
      "manifest": "one-piece-arlong-park-core/loredeck.json",
      "type": "custom",
      "title": "One Piece: Arlong Park Core",
      "library": {
        "suggestedPath": ["One Piece", "East Blue Saga", "Arlong Park"]
      },
      "assets": {
        "cover": {
          "path": "assets/cover.png",
          "alt": "One Piece: Arlong Park Core cover"
        }
      },
      "entrySchemaVersion": 3,
      "updatedAt": 1780617600000,
      "stats": {
        "entryCount": 120,
        "categoryCounts": {}
      }
    }
  ],
  "folders": [],
  "deckPlacements": {}
}
```

Alpha importer contract:

- Require `loredecks/index.json`.
- Require package index records under `loredecks`.
- Do not accept bundled-style `bundled` indexes or single root `loredeck.json` packages as public alpha package formats.
- Install package records as Custom user content.

## Import Semantics

Package import should produce installed Custom Loredecks.

Rules:

- A package cannot overwrite a Bundled Loredeck.
- A package cannot install executable files.
- A package can contain one Loredeck, many Loredecks, folders, nested folders, and passive image assets.
- Imported Loredecks become `type: "custom"` even if the package author marked them as `bundled`.
- Original package identity should be preserved under `source` and `derivedFrom`.
- Existing duplicate detection should still check package hash, deck content hash, original ID, title/version, and fandom.
- Default action should be `Install Selected`, with collision matches installed as new Custom copies under safe unique IDs.
- `Update Existing` is deferred until we design safe in-place package updates for editable Custom decks.
- Pending Creator/Assistant proposals should not be imported unless the package explicitly declares a supported draft package mode later.

Folder import:

- Preserve folder hierarchy when the package declares `folders` and `deckPlacements`.
- If no explicit folder registry exists, infer folders from `library.suggestedPath`.
- Default install should preserve the package's top-level folder structure instead of scattering decks into unrelated Library areas.
- If folder IDs collide, remap IDs while preserving visible folder titles and paths.
- If the user selects an existing destination folder in a future UI, import under that destination.

Asset import:

- Resolve deck-local asset paths relative to each deck folder.
- Allow passive images: `.png`, `.jpg`, `.jpeg`, `.webp`, and possibly `.gif` if current cover handling still supports it.
- Reuse the existing cover normalization behavior where practical: decode, limit size, and store as a passive asset reference.
- Preserve asset alt text, fit mode, dimensions, focal point, and title when provided.
- If an asset cannot be decoded or is too large, import the deck without the cover and show a package warning.

## Export Semantics

Export should create a zip package, not individual JSON files.

Supported export selections:

- One Loredeck selected: export one `.saga-loredeck.zip` containing one deck folder and a package index.
- Multiple Loredecks selected: export one `.saga-loredeck.zip` containing all selected deck folders and a package index.
- Folder selected: export one `.saga-loredeck.zip` containing the folder's Loredecks, nested folders, and placement metadata.
- Mixed folder and deck selection: deduplicate deck IDs and export one coherent package.

Non-goals:

- Do not export the entire user's Library by default.
- Do not export active stack state by default.
- Do not export API settings, theme settings, chat state, accepted story-specific Lorecards, or SillyTavern configuration.

Export should include:

- `saga-package.json`.
- `loredecks/index.json`.
- One folder per exported Loredeck.
- Each deck's `loredeck.json`.
- Entry files grouped by category or existing manifest file layout when available.
- `tags.json`, `timeline.json`, and other registries when present.
- `assets/cover.*` when a cover exists and can be packaged.
- Deck-level content hash and package-level content hash metadata.

For virtual Custom/Generated decks:

- Build a real folder package during export.
- Convert accepted `entryOverrides` into one or more physical entry JSON files.
- Keep disabled entry IDs only when they are meaningful against included source entries.
- Generated decks should pass existing export-readiness checks before packaging.
- Exported Generated decks should install elsewhere as Custom unless a future explicit Generated-draft package mode is added.

## Security And Validation

Zip import must be strict because it accepts user-supplied archives.

Reject or ignore unsafe package entries:

- Absolute paths.
- Windows drive-letter paths.
- Paths containing `..` traversal.
- Paths containing NUL characters.
- Backslash traversal after path normalization.
- Executable or active content extensions such as `.js`, `.mjs`, `.html`, `.htm`, `.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`, `.wasm`, and similar.
- Symlinks or zip entry types that are not ordinary files/directories.

Recommended limits:

- Maximum compressed zip size.
- Maximum total uncompressed bytes.
- Maximum file count.
- Maximum single JSON file size.
- Maximum single image file size.
- Maximum deck count per package before requiring confirmation.
- Maximum nested folder depth.

Validation steps:

1. Read central directory and normalize paths.
2. Validate allowed paths and extensions before extracting content.
3. Parse `saga-package.json` if present.
4. Parse `loredecks/index.json`.
5. Validate every referenced manifest path exists inside the package.
6. Validate every manifest and entry file as schema v3-native Saga data.
7. Validate tag registry, timeline registry, and asset references.
8. Compute deterministic package and deck hashes from normalized content.
9. Build an install preview with warnings and duplicate matches.
10. Install only after the user confirms.

## UI/UX Changes

Library header:

- Rename `Import Deck` tooltip to `Import a Saga Loredeck zip package.`
- Change accepted file types to `.saga-loredeck.zip,.zip`.
- Rename export tooltip to explain that selected decks/folders export as one zip package.
- Update export success toast from JSON wording to zip-package wording.

Import preview:

- Title should be `Import Loredeck Package`.
- Show package title, version, author, deck count, folder count, package size, and warnings.
- Show deck cards using the same Library card style.
- Show duplicate matches per deck.
- Offer `Install All As New Copies`.
- Offer per-deck replacement only for editable Custom targets.
- Warn clearly if any deck in the package failed validation.

Export preview, if needed:

- For one deck, direct export is acceptable.
- For multiple decks/folders, a short confirmation preview is useful: package name, included folders, included decks, warnings, and estimated size.

## Implementation Phases

### Phase 1: Package Contract And Test Fixtures

- Add this development plan.
- Revise the schema docs so zip packages are the preferred public import/export contract and JSON bundles are legacy-only.
- Create small fixture packages for one deck, multiple decks, folder hierarchy, cover assets, and invalid path traversal.

### Phase 2: Zip Service

Add a small isolated zip package service instead of mixing archive parsing into `src/runtime/lore-panel.js`.

Candidate module:

```text
loredeck-package-zip.js
```

Responsibilities:

- Read zip files.
- List normalized entries.
- Reject unsafe paths before extraction.
- Read text JSON files.
- Read passive image bytes.
- Create zip packages for export.
- Provide deterministic file ordering.

Dependency rule:

- Prefer a bundled, audited, local-only zip library if browser-native APIs are insufficient.
- Do not fetch zip tooling from a CDN at runtime.
- Do not allow package contents to execute code.

### Phase 3: Package Parser And Normalizer

Candidate module:

```text
loredeck-package-service.js
```

Responsibilities:

- Convert package files into an internal install model.
- Parse package metadata, index records, manifests, registries, entry files, and assets.
- Normalize imported records into Custom deck records.
- Build virtual manifests and entry caches compatible with the existing loader.
- Reuse existing content-hash and duplicate-match logic where possible.

### Phase 4: Export Builder

Replace the old JSON export builder with package staging and zip download.

Responsibilities:

- Resolve selected deck and folder inputs.
- Deduplicate deck IDs.
- Fetch or read cached manifests and entry files.
- Write `loredecks/index.json`.
- Write one deck folder per deck.
- Write deck-local assets.
- Convert virtual custom/generated entries into physical files.
- Download one zip per export action.

### Phase 5: Import UI

Replace `installLoredeckBundleFromFile()` with package import.

Responsibilities:

- Accept `.saga-loredeck.zip`.
- Parse and validate before opening a preview.
- Show package-level and deck-level warnings.
- Reuse existing duplicate review and install actions.
- Support multi-deck install with partial failure reporting.
- Refresh Library, Context, and Health surfaces after install.

### Phase 6: Remove Front-Facing JSON Import/Export

- Remove JSON wording from Library buttons and toasts.
- Remove JSON file accept filters for Loredeck import.
- Remove individual JSON-per-deck export behavior.
- Keep any old JSON helpers only if still needed internally during migration.
- Update visual smoke docs and alpha systems docs to describe zip packages.

### Phase 7: Update And URL/GitHub Follow-Up

After local zip import/export works:

- Support package update URLs that point to `.saga-loredeck.zip`.
- Support GitHub raw/release URLs for package downloads.
- Preserve current local-modification warnings.
- Keep bundled-deck overwrite protection.
- Decide whether package update checks compare whole-package hashes, deck hashes, or both.

## Test Plan

Unit-style tests:

- Valid one-deck package imports.
- Valid multi-deck package imports.
- Folder hierarchy imports and ID collision remapping.
- Cover image imports and missing-cover warnings.
- Packages missing `loredecks/index.json` are rejected.
- Old uppercase `Loredecks/index.json` package paths are rejected.
- Existing deck collision installs as a new copy.
- Editable Custom deck update works with confirmation.
- Bundled deck update is blocked.
- Traversal paths are rejected.
- Absolute paths are rejected.
- Executable extensions are rejected.
- Oversized packages fail before install.
- Content hashes are stable across export/import round trips.

Integration tests:

- Export a bundled HP deck to zip, import it, verify it becomes Custom with cover, tags, timeline, and entry count.
- Export a folder with multiple HP decks, import it, verify folder hierarchy and deck placements.
- Export a Generated deck after finalization, import it, verify accepted entries load as normal Custom Lorecards.
- Import a package, add imported decks/folders to stack, verify Context and retrieval can see the imported Lorecards.
- Import package with malformed deck and valid deck, verify preview isolates failures and can install valid decks.

Visual smoke:

- Library import button opens zip picker.
- Import preview uses current theme styles.
- Package deck cards do not overflow.
- Duplicate review is readable for multi-deck packages.
- Export button disabled state and busy state remain responsive.

## Acceptance Criteria

This feature is alpha-ready when:

- Users can import a `.saga-loredeck.zip` that uses the alpha `loredecks/` package structure.
- Imported decks appear in the Library as Custom decks with titles, metadata, folders, entry counts, registries, and covers.
- Exporting selected decks/folders creates one package zip that can be imported into a clean Saga install.
- The Library no longer exposes `.saga-loredeck.json` import/export as the normal workflow.
- Unsafe zip entries are rejected before extraction.
- Bundled decks cannot be overwritten by package import.
- Duplicate and update previews remain at least as safe as the current JSON importer.
- Package import/export has deterministic tests covering valid packages, collisions, covers, folders, and unsafe archives.

## Open Decisions

- Zip implementation library: choose a small local dependency or a browser-native strategy if it can handle both read and write reliably.
- Package size limits: set concrete alpha limits after testing HP, MHA, and Middle-earth packages with covers.
- Package root behavior: decide whether imports should preserve top-level folders exactly or optionally nest the package under an `Imported` folder.
- Update URL format: decide whether GitHub update checks should target release assets, raw zip files, or a package manifest that points to a zip.
- Schema doc promotion: once implemented, move the package contract from this development note into `docs/loredecks/SAGA_LOREDECK_SCHEMA.md`.
