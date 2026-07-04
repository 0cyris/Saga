# Loredeck Zip Package Structure

This document describes the importable `.saga-loredeck.zip` package shape for Saga Loredecks. Use it when a Loredeck is authored outside Saga, especially when handing work to another LLM and expecting a package that can be imported through **Import Deck**.

To build a package of this exact shape with tooling that assembles and verifies it for you, use the `loredeck-builder` skill and its `tools/loredeck/` CLI — see [LOREDECK_BUILDER_TOOLKIT.md](LOREDECK_BUILDER_TOOLKIT.md).

The zip package is a data container. It must contain JSON data and passive assets only. It must not contain executable code.

## Required Archive Shape

Use the `.saga-loredeck.zip` extension.

```text
my-fandom-pack.saga-loredeck.zip
  saga-package.json
  loredecks/
    index.json
    my-fandom-core/
      loredeck.json
      tags.json
      timeline.json
      assets/
        cover.png
      entries/
        core.json
```

Required for import:

- `loredecks/index.json` at exactly that lowercase path.
- At least one record in `loredecks/index.json` under `loredecks`.
- A `packId` for every listed Loredeck.
- A manifest file for every listed Loredeck. Use `manifest: "deck-folder/loredeck.json"` in the index record.
- Every entry file referenced by the manifest's `files` array.

Recommended for every shared package:

- `saga-package.json` with package title, author, version, and deck count.
- One deck folder per Loredeck under `loredecks/`.
- Deck-local `tags.json`, `timeline.json`, and passive assets when the manifest references them.
- Folder metadata in `loredecks/index.json` when a multi-deck package should import with a Library folder structure.

Saga installs package Loredecks as Custom user content, even if package metadata uses another type.

## Package Metadata

`saga-package.json` is package metadata, not runtime lore.

```json
{
  "packageSchemaVersion": 1,
  "packageType": "saga_loredeck_package",
  "title": "My Fandom Loredecks",
  "description": "Importable Saga Loredecks for a specific source range.",
  "author": "Creator Name",
  "version": "1.0.0",
  "deckCount": 1
}
```

## Package Index

`loredecks/index.json` tells Saga which Loredecks are inside the archive.

```json
{
  "schemaVersion": 2,
  "packageType": "saga_loredeck_index",
  "loredecks": [
    {
      "packId": "my-fandom-core",
      "manifest": "my-fandom-core/loredeck.json",
      "type": "custom",
      "title": "My Fandom Core",
      "library": {
        "suggestedPath": ["My Fandom", "Core"]
      },
      "assets": {
        "cover": {
          "path": "assets/cover.png",
          "alt": "My Fandom Core cover"
        }
      },
      "entrySchemaVersion": 3,
      "stats": {
        "entryCount": 24,
        "categoryCounts": {}
      }
    }
  ],
  "folders": [],
  "deckPlacements": []
}
```

Index records should use paths relative to the `loredecks/` folder. A record with `"manifest": "my-fandom-core/loredeck.json"` resolves to `loredecks/my-fandom-core/loredeck.json` inside the archive.

## Deck Manifest

Each deck folder needs a `loredeck.json` manifest. Follow [SAGA_LOREDECK_SCHEMA.md](SAGA_LOREDECK_SCHEMA.md) for exact field rules.

```json
{
  "id": "my-fandom-core",
  "type": "custom",
  "title": "My Fandom Core",
  "entrySchemaVersion": 3,
  "files": ["entries/core.json"],
  "registries": {
    "tags": "tags.json",
    "timeline": "timeline.json"
  },
  "assets": {
    "cover": {
      "path": "assets/cover.png",
      "alt": "My Fandom Core cover"
    }
  },
  "stats": {
    "entryCount": 24,
    "categoryCounts": {}
  }
}
```

Manifest file paths are resolved relative to the deck folder. Do not use absolute paths, remote URLs, parent-directory traversal, or platform-specific separators for package-local files.

## Entry Files

Entry files are JSON files referenced by the manifest's `files` array.

```json
{
  "schemaVersion": 3,
  "entries": [
    {
      "id": "my-fandom.rule.example",
      "schemaVersion": 3,
      "title": "Example Runtime Rule",
      "category": "knowledge",
      "content": {
        "fact": "A concise reviewable fact.",
        "injection": "A compact model-facing instruction."
      }
    }
  ]
}
```

Keep entry files grouped by useful authoring categories such as `characters/`, `places/`, `events/`, `relationships/`, `abilities/`, `rules/`, or `entries/`. The folder names are authoring structure; the manifest and entry schema are the contract.

## Cover Images

A cover is optional for import, but shareable packages should include one deck-local cover image unless the deck is intentionally text-only.

Cover requirements:

- Put the cover inside the deck folder, usually `assets/cover.png`.
- Reference it from `loredecks/index.json` and `loredeck.json` as `assets.cover.path`.
- Use a passive raster image: `.png`, `.jpg`, `.jpeg`, or `.webp`.
- Do not use SVG, HTML, JavaScript, shell scripts, executable files, remote image URLs, or data URLs in package assets.
- Include meaningful `alt` text.
- Keep the source image under 12 MB. Smaller square or poster-like images are better for Library browsing.

Example:

```json
"assets": {
  "cover": {
    "path": "assets/cover.png",
    "alt": "My Fandom Core cover",
    "fit": "cover"
  }
}
```

Saga resolves `assets/cover.png` relative to the deck folder, so the actual archive path is `loredecks/my-fandom-core/assets/cover.png`.

## Folder Metadata

For multi-deck packages, use `folders` and `deckPlacements` in `loredecks/index.json` when you want Saga to preserve a Library hierarchy.

```json
{
  "folders": [
    { "id": "my-fandom", "title": "My Fandom", "parentId": "" },
    { "id": "my-fandom-core-folder", "title": "Core", "parentId": "my-fandom" }
  ],
  "deckPlacements": [
    { "deckId": "my-fandom-core", "folderId": "my-fandom-core-folder" }
  ]
}
```

If no explicit folders are provided, Saga can still use `library.suggestedPath` from index records and manifests as placement guidance.

## Rejected Package Content

Saga rejects unsafe zip entries before import:

- Absolute paths.
- Windows drive-letter paths.
- Empty path segments.
- `.` or `..` traversal.
- NUL characters.
- Backslash traversal after path normalization.
- Executable or active content extensions such as `.js`, `.mjs`, `.html`, `.htm`, `.exe`, `.bat`, `.cmd`, `.ps1`, `.sh`, `.svg`, `.wasm`, and similar files.
- Symlink-style entries.

Packages should contain only ordinary files and directories.

## LLM Handoff Checklist

When asking another LLM to produce an importable package, provide:

1. [LLM_LOREDECK_GENERATION_GUIDE.md](LLM_LOREDECK_GENERATION_GUIDE.md)
2. [LOREDECK_AND_LORECARD_CREATION_GUIDE.md](LOREDECK_AND_LORECARD_CREATION_GUIDE.md)
3. [SAGA_LOREDECK_SCHEMA.md](SAGA_LOREDECK_SCHEMA.md)
4. This package structure guide.
5. One relevant bundled Loredeck folder from `content/loredecks/` and the root `content/loredecks/index.json` as a concrete reference.

Ask for a folder tree first, then JSON files, then the final zip assembly. After import, run Pack Health and fix every issue before treating the deck as reference-quality.
