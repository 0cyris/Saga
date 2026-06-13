# Saga Storage Rework Design

Status: Phase 8 implementation in progress. Theme/Icon externalization, Lorepack Library index persistence, Lorepack payload files, Creator project index files, Creator project payload files, async Creator project resume after cold reload, the first migration planner/executor, the State Safety migration action, State Safety storage integrity diagnostics, Pack Health external-payload validation coverage, Pack Health repair hydration/writes, indexed cleanup/write-settle actions, initial live browser smoke coverage, a repo-local storage persistence smoke target, and release-facing storage/operator docs are in place. Remaining hardening work is executing broader storage smoke in an environment with a working Chrome CDP transport and following up on any failures found by that run.

## Executive Summary

Saga currently treats `settings.json` as both control-plane storage and content storage. That is the wrong long-term shape. `settings.json` should keep compact preferences, active selections, and bootstrap pointers. Large Saga-owned documents should live as separate flat JSON files in SillyTavern's `/user/files` area, with passive image/icon assets stored as sibling flat files.

The target model is:

- `settings.json`: small Saga preferences and one pointer to the Saga storage index.
- `/user/files/saga-storage-index.v1.json`: master manifest of Saga-owned files.
- `/user/files/saga-library-index.v1.json`: Lorepack Library organization, folders, placement, ordering, lightweight metadata, and payload pointers.
- `/user/files/saga-pack-<packId>.v1.json`: actual imported, generated, or custom Lorepack payloads.
- `/user/files/saga-creator-index.v1.json`: resumable Creator project index and project pointers.
- `/user/files/saga-creator-project-<projectId>.v1.json`: full in-progress Creator project state.
- `/user/files/saga-theme-index.v1.json`: installed custom Theme Pack index.
- `/user/files/saga-theme-pack-<themeId>.v1.json`: custom Theme Pack payload.
- `/user/files/saga-iconset-index.v1.json`: installed custom Icon Set index.
- `/user/files/saga-iconset-<iconSetId>.v1.json`: custom Icon Set mapping payload.
- `/user/files/saga-pack-asset-...` and `/user/files/saga-iconset-asset-...`: passive cover/icon/image assets referenced by payload JSON.

This design deliberately avoids SillyTavern server plugins. The SillyTavern community is understandably sensitive to extension security, and a storage design that requires enabling or installing backend code would be more off-putting than the problem it solves. Saga can get most of the needed storage benefits by using the existing SillyTavern files API from frontend code.

The file API is flat. Saga cannot create `/user/files/saga/packs/...` through the built-in upload endpoint because upload filenames reject slashes. That is acceptable if Saga owns its own indexes and uses disciplined filename prefixes.

The core invariant:

```text
settings.json -> saga-storage-index -> domain indexes -> payload files -> passive assets
```

## Goals

- Stop storing large Loredeck, Creator, Theme Pack, Icon Set, and asset payloads in `settings.json`.
- Keep Saga installation and usage frontend-only from the user's perspective.
- Avoid server plugins, custom backend routes, executable import formats, and any workflow that looks like installing arbitrary code.
- Preserve the full feature set: imported Lorepacks, generated Lorepacks, custom editable decks, library folders, cover images, Theme Packs, Icon Sets, icons, Creator projects, Pack Health, repair, import/export, and delete cleanup.
- Make storage inspectable and recoverable by using JSON documents with stable filenames.
- Make deletion reliable: forgetting a pack/project/theme/icon set must remove index records and owned payload/assets.
- Keep bundled content out of user storage. Bundled Lorepacks, bundled Theme Packs, and bundled Icon Sets should be loaded from extension files/code/assets.
- Keep chat-specific runtime state in chat metadata when it truly belongs to the current chat.
- Keep settings small enough that unrelated SillyTavern settings saves are not carrying Saga's content database.
- Design the rework in slices that can be tested without shipping a fragile one-shot migration.

## Non-Goals

- Do not add a SillyTavern server plugin.
- Do not create hidden directories through unsupported browser behavior.
- Do not store every Lorecard as a separate file. Flat file storage makes one-file-per-card too noisy and hard to clean up.
- Do not store raw imported zip packages by default. Saga should import them into structured payload files and export a fresh package when requested.
- Do not persist routine full Pack Health reports by default. Compute on demand and store only compact summaries unless a repair session needs a durable ledger.
- Do not move normal chat/session continuity data into `/user/files`. Chat metadata is still the right place for current-chat state.
- Do not preserve old storage compatibility indefinitely. This is pre-alpha, so migration can be direct and cleanup can be aggressive after validation.

## Current Problems

### `settings.json` Is Being Used As A Data Warehouse

Current Saga settings can include:

- `loredeckLibrary`
- `loredeckCreatorProjects`
- `themePackLibrary`
- `themeIconSetLibrary`
- large custom/imported Loredeck records
- generated Loredeck shell data
- embedded entries and registries
- cover and asset data in some paths
- pending changes
- health issue state

This means normal settings persistence can write a huge file for unrelated UI changes.

### Imported Loredecks Are Embedded

The current package import flow parses `.saga-loredeck.zip`, builds a registry, and imports records into `settings.loredeckLibrary`. For custom imports, entries can be stored under fields such as `entryOverrides`, `tagRegistry`, `timelineRegistry`, `manifestData`, and assets. That makes imported packages grow the global SillyTavern settings file.

There is a lighter bundled-reference path for imports that map back to a bundled original, but normal custom imports remain settings-backed.

### Creator Projects Are Too Heavy For Settings

Creator state is staged and resumable:

- intake
- brief
- outline
- title batches
- Context/tag planning
- Lorecard drafting
- Creator draft review
- Pending Review handoff
- Pack Health and finalization

That can produce large draft pools, batch ledgers, generation diagnostics, failed output snippets, project metadata, and generated-pack links. None of that belongs in global settings.

### Theme And Icon Libraries Are Currently Settings-Backed

Theme Packs are small today, but the same architecture should apply to them so user-owned content has a consistent storage rule.

Icon Sets can include many asset paths or imported images. Those should not be embedded in settings either. The mapping document can be JSON, while icon files live as passive assets in `/user/files`.

### Data Ownership Is Ambiguous

The current model blurs:

- bundled extension content
- user-imported content
- generated content
- in-progress Creator work
- chat-specific active stack
- global library organization
- temporary health and repair diagnostics

The rework should make ownership obvious.

## SillyTavern Storage Constraints

### Available Built-In Files API

SillyTavern exposes a user files API:

- `POST /api/files/upload`
- `POST /api/files/verify`
- `POST /api/files/delete`

The upload endpoint accepts:

```json
{
  "name": "saga-example.v1.json",
  "data": "base64..."
}
```

It writes into the current user's files directory and returns a client-relative path such as:

```text
/user/files/saga-example.v1.json
```

Saga can read stored files using normal `fetch()` against the returned path.

### Validation Results From Local Probe

A tiny JSON probe succeeded with the protected API flow:

- upload succeeded for `saga-storage-probe-20260612-204421.json`
- verify returned `true`
- delete returned status `200`
- verify after delete returned `false`

A subfolder upload failed:

```text
saga/probe-subdir-test.json
```

The rejection is expected because SillyTavern validates upload names as filenames, not paths.

### Filename Constraints

Saga filenames must be flat and should use only:

- letters
- numbers
- `_`
- `-`
- `.`

Avoid spaces. Avoid path separators. Avoid leading dots. Avoid executable extensions.

Use names like:

```text
saga-storage-index.v1.json
saga-pack-one-piece-arlong-park-custom.v1.json
saga-pack-asset-one-piece-arlong-park-custom-cover-8f2c91a4.png
saga-iconset-asset-mystic-tabs-tab-loredecks-a83f21c2.webp
```

### No Folder Listing

The built-in files API can verify known files, but it does not provide a Saga-scoped folder listing. Saga must maintain its own index files. Index integrity is therefore central to this design.

## Storage Principles

### 1. Settings Are Control Plane Only

`settings.json` may contain:

- Saga enabled flags
- user preferences
- provider settings
- theme and icon active IDs
- current UI mode
- compact storage bootstrap pointer
- compact migration flags
- lightweight fallback pointers needed to recover the storage index

`settings.json` must not contain:

- full Lorecard arrays
- imported deck payloads
- generated deck payloads
- Creator stage artifacts
- embedded image data
- full Theme Pack libraries
- full Icon Set libraries
- full Pack Health reports
- model repair batch payloads

### 2. User-Owned Content Lives In Flat Saga Files

Anything the user imports, generates, edits, or installs as reusable content should become a Saga-owned file under `/user/files`.

### 3. Bundled Content Stays Bundled

Bundled Lorepacks, Theme Packs, and Icon Sets should remain in extension code/assets/content. Settings and indexes may record active bundled IDs, but they should not copy bundled payloads.

### 4. Payload Files Own Content, Index Files Own Organization

The library index decides what exists in the library and how it is organized. Pack payload files hold actual deck content.

This is important for library folders:

- folder tree belongs in `saga-library-index.v1.json`
- pack-to-folder placement belongs in `saga-library-index.v1.json`
- manual sort order belongs in `saga-library-index.v1.json`
- full Lorecards belong in `saga-pack-<packId>.v1.json`

### 5. Chat-Specific State Stays Chat-Specific

The active stack for the current chat should remain in `chatMetadata.saga.loredeckStack`, because it is part of the chat runtime state.

The global Library index should not be the source of truth for "what this chat has loaded right now."

### 6. Import Formats Are Not Storage Formats

`.saga-loredeck.zip` remains the sharing/import/export transport. After import, Saga should not keep the raw zip by default. It should materialize the package into indexed payload files and passive assets.

### 7. Assets Are Separate Passive Files

Cover images, banners, and icon images should be uploaded as asset files and referenced by path. Avoid base64 inside JSON except possibly tiny internal thumbnails, and even those should be optional.

### 8. Every File Has An Owner Or It Is Garbage

Every Saga-owned file should appear in `saga-storage-index.v1.json` with:

- file path
- kind
- owner domain
- owner ID
- content hash if known
- created/updated timestamps
- deletion behavior

This is how Saga can clean up without a folder listing.

### 9. Repairs Must Validate Through The Storage Layer

Pack Health repair should modify payload files only through the same storage service used by imports and editors. A repair should never patch an in-memory object and leave the underlying file stale.

### 10. No Executable Imports

Saga imports data only. JSON documents and passive images are allowed. JavaScript, HTML, arbitrary SVG, and other executable or scriptable content should be rejected.

## Storage Layer Overview

### Logical Layers

```text
SillyTavern settings.json
  extension_settings.saga
    sagaStorage pointer and compact preferences

SillyTavern chat metadata
  chatMetadata.saga
    active stack, Context choices, accepted/pending lore for the current chat,
    continuity state, UI runtime state

SillyTavern user files
  /user/files/saga-storage-index.v1.json
  /user/files/saga-library-index.v1.json
  /user/files/saga-pack-*.v1.json
  /user/files/saga-creator-*.v1.json
  /user/files/saga-theme-*.v1.json
  /user/files/saga-iconset-*.v1.json
  /user/files/saga-*-asset-*.<ext>

Bundled extension content
  content/loredecks/**
  assets/iconsets/**
  runtime theme presets in code
```

### Proposed Module Boundaries

New storage modules should sit below existing domain stores:

```text
src/storage/saga-file-api.js
  Low-level wrapper over /api/files/upload, /api/files/verify, /api/files/delete,
  plus JSON fetch/read helpers.

src/storage/saga-storage-index.js
  Master index read/write/repair, file registration, ownership tracking,
  orphan detection, bootstrap fallback.

src/storage/saga-domain-storage.js
  Shared helpers for domain indexes and payload writes.

src/storage/saga-storage-migration.js
  One-time migration out of settings-backed content.

src/state/loredeck-library-store.js
  Uses storage layer for library index and pack payload pointers.

src/state/lore-creator-store.js
  Uses storage layer for Creator project index and project files.

src/state/theme-library-store.js
  Uses storage layer for custom Theme Pack and Icon Set indexes.
```

The public domain APIs should stay mostly stable:

```text
getLoredeckLibraryRegistry()
upsertLoredeckLibraryPack()
removeLoredeckLibraryPack()
importLoredeckLibraryRegistry()
getLoredeckCreatorProjectRegistry()
upsertLoredeckCreatorJob()
clearLoredeckCreatorJob()
getThemePackLibraryRegistry()
upsertThemePackLibraryPack()
getThemeIconSetLibraryRegistry()
upsertThemeIconSetLibraryPack()
```

Internally, these APIs should stop writing large payloads to `saveSettings()`.

## File Inventory

### Required Core Files

| File | Required | Purpose |
| --- | --- | --- |
| `saga-storage-index.v1.json` | Yes after migration | Master list of Saga-owned files and domain indexes. |
| `saga-library-index.v1.json` | Yes if any custom/generated/imported packs or library organization exists | Lorepack Library organization and pack payload pointers. |
| `saga-creator-index.v1.json` | Yes if any Creator project exists | Creator shelf/project pointers. |
| `saga-theme-index.v1.json` | Yes if any custom Theme Pack exists | Theme Pack library pointers. |
| `saga-iconset-index.v1.json` | Yes if any custom Icon Set exists | Icon Set library pointers. |

### Lorepack Files

| File Pattern | Purpose |
| --- | --- |
| `saga-pack-<packId>.v1.json` | Full custom/generated/imported Lorepack payload. |
| `saga-pack-asset-<packId>-cover-<hash>.<ext>` | Cover image asset. |
| `saga-pack-asset-<packId>-banner-<hash>.<ext>` | Optional banner image asset. |
| `saga-pack-asset-<packId>-<role>-<hash>.<ext>` | Future passive asset roles. |

### Creator Files

| File Pattern | Purpose |
| --- | --- |
| `saga-creator-project-<projectId>.v1.json` | Full resumable Creator project state. |
| `saga-creator-artifact-<projectId>-<artifactId>.v1.json` | Optional future split artifact if one project file becomes too large. |

The initial implementation should prefer one project file per project. Split artifacts should be a later optimization only if project files become unwieldy.

### Theme Files

| File Pattern | Purpose |
| --- | --- |
| `saga-theme-pack-<themeId>.v1.json` | Custom Theme Pack payload. |

Theme Packs are small, but using external files keeps the storage rule consistent and avoids re-growing settings later.

### Icon Set Files

| File Pattern | Purpose |
| --- | --- |
| `saga-iconset-<iconSetId>.v1.json` | Custom Icon Set metadata and slot-to-path mapping. |
| `saga-iconset-asset-<iconSetId>-<slot>-<hash>.<ext>` | Imported icon asset. |

### Optional Repair Files

| File Pattern | Purpose |
| --- | --- |
| `saga-repair-session-<packId>-<sessionId>.v1.json` | Durable Pack Health repair session, only while an active repair workflow needs resumability. |

Routine health results should not produce files by default.

## `settings.json` Target Shape

The settings record should retain normal preferences, but heavy content keys should become small pointers or disappear.

Target storage fields:

```json
{
  "sagaStorage": {
    "schemaVersion": 1,
    "enabled": true,
    "masterIndexFile": "/user/files/saga-storage-index.v1.json",
    "libraryIndexFile": "/user/files/saga-library-index.v1.json",
    "creatorIndexFile": "/user/files/saga-creator-index.v1.json",
    "themeIndexFile": "/user/files/saga-theme-index.v1.json",
    "iconSetIndexFile": "/user/files/saga-iconset-index.v1.json",
    "lastVerifiedAt": 0,
    "lastMigrationAt": 0,
    "migrationVersion": "external-files-v1"
  },
  "themePackId": "saga-default",
  "themeIconSetId": "saga-hero",
  "experienceMode": "basic"
}
```

The settings record may also keep a compact emergency fallback:

```json
{
  "sagaStorageFallback": {
    "libraryIndexFile": "/user/files/saga-library-index.v1.json",
    "creatorIndexFile": "/user/files/saga-creator-index.v1.json",
    "themeIndexFile": "/user/files/saga-theme-index.v1.json",
    "iconSetIndexFile": "/user/files/saga-iconset-index.v1.json",
    "updatedAt": 0
  }
}
```

This fallback is not a second source of truth. It exists only so Saga can recover if the master index pointer is missing.

Fields to remove or shrink:

- `loredeckLibrary`: replace with a compact generated view or remove after migration.
- `loredeckCreatorProjects`: replace with a compact generated view or remove after migration.
- `themePackLibrary`: replace with a compact generated view or remove after migration.
- `themeIconSetLibrary`: replace with a compact generated view or remove after migration.

During the transition, domain getters may synthesize these fields in memory for existing UI code, but `saveSettings()` must not persist the heavy synthesized version.

## Master Storage Index Schema

`/user/files/saga-storage-index.v1.json`

Purpose: list all Saga-owned files, record domain index paths, and support cleanup without folder listing.

```json
{
  "schemaVersion": 1,
  "kind": "saga_storage_index",
  "createdAt": 0,
  "updatedAt": 0,
  "revision": 1,
  "domains": {
    "library": {
      "indexFile": "/user/files/saga-library-index.v1.json",
      "updatedAt": 0
    },
    "creator": {
      "indexFile": "/user/files/saga-creator-index.v1.json",
      "updatedAt": 0
    },
    "themes": {
      "indexFile": "/user/files/saga-theme-index.v1.json",
      "updatedAt": 0
    },
    "iconSets": {
      "indexFile": "/user/files/saga-iconset-index.v1.json",
      "updatedAt": 0
    }
  },
  "files": {
    "/user/files/saga-library-index.v1.json": {
      "kind": "library_index",
      "domain": "library",
      "ownerId": "library",
      "mime": "application/json",
      "sha256": "optional",
      "bytes": 1234,
      "createdAt": 0,
      "updatedAt": 0,
      "deletion": "managed"
    },
    "/user/files/saga-pack-one-piece-arlong-park-custom.v1.json": {
      "kind": "lorepack_payload",
      "domain": "library",
      "ownerId": "one-piece-arlong-park-custom",
      "mime": "application/json",
      "sha256": "optional",
      "bytes": 100000,
      "createdAt": 0,
      "updatedAt": 0,
      "deletion": "delete_with_owner"
    }
  },
  "lastIntegrityCheck": {
    "checkedAt": 0,
    "missingFiles": [],
    "orphanedFiles": [],
    "status": "unknown"
  }
}
```

### Deletion Modes

- `managed`: owned by Saga and may be deleted if the domain record is removed.
- `delete_with_owner`: delete when the owner pack/project/theme/icon set is deleted.
- `shared_asset`: delete only when no remaining owner references it.
- `external_reference`: never delete. This points to a path not created by Saga.

## Lorepack Library Index Schema

`/user/files/saga-library-index.v1.json`

Purpose: save all Library changes, including folder structure, pack placement, manual ordering, lightweight metadata, and payload pointers.

The library index should save:

- installed/imported/generated/custom pack list
- folder structure
- nested folder parent IDs
- pack-to-folder placement
- manual sort order
- source type labels
- lightweight display metadata
- cover asset pointers
- payload file pointers
- compact Pack Health summary
- update/package metadata
- duplicate/package-origin metadata

It should not save:

- full Lorecards
- full Creator projects
- raw imported zip files
- full health reports
- embedded image data

Example:

```json
{
  "schemaVersion": 1,
  "kind": "saga_library_index",
  "createdAt": 0,
  "updatedAt": 0,
  "revision": 12,
  "packs": {
    "one-piece-arlong-park-custom": {
      "packId": "one-piece-arlong-park-custom",
      "type": "custom",
      "title": "One Piece: Arlong Park",
      "description": "Custom Arlong Park lorepack.",
      "sourceKind": "imported_package",
      "payloadFile": "/user/files/saga-pack-one-piece-arlong-park-custom.v1.json",
      "coverFile": "/user/files/saga-pack-asset-one-piece-arlong-park-custom-cover-a83f21c2.png",
      "entryCount": 56,
      "tagCount": 42,
      "timelineEventCount": 18,
      "healthSummary": {
        "status": "errors",
        "errorCount": 2,
        "warningCount": 7,
        "noticeCount": 0,
        "checkedAt": 0,
        "engineVersion": "schema-v3"
      },
      "package": {
        "packageId": "one-piece-arlong-park",
        "packageVersion": "1.0.0",
        "contentHash": "optional",
        "importedFrom": "one-piece-arlong-park.saga-loredeck.zip",
        "installedAt": 0,
        "updatedAt": 0
      },
      "createdAt": 0,
      "updatedAt": 0
    }
  },
  "folders": {
    "one-piece": {
      "folderId": "one-piece",
      "title": "One Piece",
      "parentId": "",
      "sortOrder": 10,
      "collapsed": false,
      "createdAt": 0,
      "updatedAt": 0
    },
    "one-piece.arlong": {
      "folderId": "one-piece.arlong",
      "title": "Arlong Park",
      "parentId": "one-piece",
      "sortOrder": 20,
      "collapsed": false,
      "createdAt": 0,
      "updatedAt": 0
    }
  },
  "deckPlacements": {
    "one-piece-arlong-park-custom": {
      "packId": "one-piece-arlong-park-custom",
      "folderId": "one-piece.arlong",
      "sortOrder": 10,
      "updatedAt": 0
    }
  },
  "views": {
    "lastFilter": "all",
    "lastSort": "manual"
  }
}
```

### Bundled Pack Representation

Bundled packs should not need payload files.

The Library view can merge:

- bundled pack definitions from extension defaults
- custom/imported/generated pack entries from `saga-library-index.v1.json`

If the user creates local overrides of a bundled pack, store only the override payload as a custom file or a bundled-reference delta.

### Active Stack Boundary

The current chat's active stack belongs in chat metadata:

```json
{
  "loredeckStack": [
    {
      "packId": "one-piece-arlong-park-custom",
      "enabled": true,
      "priority": 10
    }
  ]
}
```

The Library index may later support reusable stack profiles, but it should not be the source of truth for the current chat's active stack.

## Lorepack Payload Schema

`/user/files/saga-pack-<packId>.v1.json`

Purpose: hold the actual user-owned Lorepack content.

The payload should be normalized around the runtime loader's needs and avoid the old "settings record is both metadata and payload" shape.

Example:

```json
{
  "schemaVersion": 1,
  "kind": "saga_lorepack_payload",
  "packId": "one-piece-arlong-park-custom",
  "type": "custom",
  "title": "One Piece: Arlong Park",
  "description": "Custom Arlong Park lorepack.",
  "createdAt": 0,
  "updatedAt": 0,
  "source": {
    "kind": "imported_package",
    "packageId": "one-piece-arlong-park",
    "packageVersion": "1.0.0",
    "originalType": "custom",
    "originalPackId": "one-piece-arlong-park",
    "importedFrom": "one-piece-arlong-park.saga-loredeck.zip"
  },
  "manifest": {
    "schemaVersion": 3,
    "id": "one-piece-arlong-park-custom",
    "title": "One Piece: Arlong Park",
    "description": "Custom Arlong Park lorepack.",
    "coverImage": {
      "path": "/user/files/saga-pack-asset-one-piece-arlong-park-custom-cover-a83f21c2.png",
      "mime": "image/png",
      "sha256": "a83f21c2..."
    }
  },
  "entries": [
    {
      "id": "nami-secret-buyback-bargain",
      "title": "Nami's Secret Buyback Bargain",
      "content": "...",
      "tags": ["nami", "arlong-park"],
      "context": {}
    }
  ],
  "tagRegistry": {
    "schemaVersion": 1,
    "tags": {}
  },
  "timelineRegistry": {
    "schemaVersion": 1,
    "events": {}
  },
  "pendingChanges": [],
  "healthIssueStates": {},
  "assetRefs": {
    "cover": "/user/files/saga-pack-asset-one-piece-arlong-park-custom-cover-a83f21c2.png"
  }
}
```

### Embedded Versus Materialized Entries

Use one JSON payload file per pack. Store entries inside the pack payload. Do not create one file per Lorecard.

Reasons:

- `/user/files` is flat, so many files would be noisy.
- Delete cleanup becomes harder with hundreds of entries.
- Import/export can materialize entries into zip package structure when needed.
- Pack Health normally needs the whole pack anyway.

### Bundled Reference Delta Payload

For user-owned edits to a bundled pack, a payload can store deltas instead of a full copy:

```json
{
  "schemaVersion": 1,
  "kind": "saga_lorepack_payload",
  "packId": "hp-core-customized",
  "type": "custom",
  "source": {
    "kind": "bundled_manifest_reference",
    "bundledPackId": "hp-core"
  },
  "entryOverrides": {},
  "disabledEntryIds": [],
  "addedEntries": [],
  "tagRegistryOverrides": {},
  "timelineRegistryOverrides": {}
}
```

This should be used only when it genuinely points to an installed bundled source. Normal imported custom packs should be self-contained payload files.

## Creator Storage Schema

### Creator Index

`/user/files/saga-creator-index.v1.json`

Purpose: drive the In-Progress Creator Projects shelf without loading every project file.

```json
{
  "schemaVersion": 1,
  "kind": "saga_creator_index",
  "createdAt": 0,
  "updatedAt": 0,
  "revision": 7,
  "activeProjectId": "creator-one-piece-arlong-park",
  "lastProjectId": "creator-one-piece-arlong-park",
  "projects": {
    "creator-one-piece-arlong-park": {
      "projectId": "creator-one-piece-arlong-park",
      "jobId": "creator-one-piece-arlong-park",
      "title": "One Piece: Arlong Park",
      "fandom": "One Piece",
      "stage": "entries_drafted",
      "status": "unfinished",
      "folderId": "one-piece.arlong",
      "linkedGeneratedPackId": "one-piece-arlong-park-generated",
      "projectFile": "/user/files/saga-creator-project-creator-one-piece-arlong-park.v1.json",
      "progress": {
        "acceptedTitleSets": 7,
        "acceptedContextSets": 7,
        "acceptedEntryCount": 56,
        "draftEntryCount": 57,
        "pendingReviewCount": 0
      },
      "currentTask": {
        "label": "",
        "status": "idle",
        "updatedAt": 0
      },
      "createdAt": 0,
      "updatedAt": 0
    }
  }
}
```

### Creator Project Payload

`/user/files/saga-creator-project-<projectId>.v1.json`

Purpose: full resumable Creator state.

It should include:

- project metadata
- intake inputs
- scope brief
- story outline
- title sets
- title review state
- Context planning batches
- tag planning batches
- Lorecard draft batches
- Creator Draft Review list
- Pending Review handoff state
- accepted/rejected IDs
- generation settings
- active generation ledger
- latest generation diagnostics
- linked Generated Lorepack ID
- finalization/readiness state

Example shape:

```json
{
  "schemaVersion": 1,
  "kind": "saga_creator_project",
  "projectId": "creator-one-piece-arlong-park",
  "jobId": "creator-one-piece-arlong-park",
  "title": "One Piece: Arlong Park",
  "fandom": "One Piece",
  "stage": "entries_drafted",
  "status": "unfinished",
  "folderId": "one-piece.arlong",
  "linkedGeneratedPackId": "one-piece-arlong-park-generated",
  "brief": {},
  "outline": {},
  "titlePass": {
    "sets": [],
    "acceptedSetIds": [],
    "rejectedSetIds": []
  },
  "planning": {
    "sets": [],
    "acceptedSetIds": [],
    "rejectedSetIds": []
  },
  "entryDrafting": {
    "batches": [],
    "draftPool": [],
    "sentToReviewIds": [],
    "acceptedEntryIds": [],
    "rejectedEntryIds": []
  },
  "generation": {
    "activeGeneration": null,
    "runs": {},
    "units": {},
    "latestResult": null
  },
  "settings": {
    "batchSize": 0,
    "modelProfile": ""
  },
  "createdAt": 0,
  "updatedAt": 0
}
```

### Creator And Generated Pack Relationship

A Creator project may own or link to a Generated Lorepack.

The relationship should be explicit in both directions:

- Creator index record has `linkedGeneratedPackId`.
- Generated pack library index record has `creatorProjectId`.
- Generated pack payload has `source.kind = "creator"` and `source.creatorProjectId`.

Deleting a Creator project should not always delete its linked Generated pack. The UI should choose between:

- delete project only
- delete project and linked Generated pack

Deleting a Generated pack should clear or update its Creator link so the pack does not rehydrate from stale Creator state.

## Theme Storage Schema

### Theme Index

`/user/files/saga-theme-index.v1.json`

Purpose: list installed custom Theme Packs.

```json
{
  "schemaVersion": 1,
  "kind": "saga_theme_index",
  "createdAt": 0,
  "updatedAt": 0,
  "revision": 2,
  "packs": {
    "royal-chronicle-custom": {
      "themeId": "royal-chronicle-custom",
      "title": "Royal Chronicle Custom",
      "type": "custom",
      "payloadFile": "/user/files/saga-theme-pack-royal-chronicle-custom.v1.json",
      "author": "",
      "version": "1.0.0",
      "tags": [],
      "createdAt": 0,
      "updatedAt": 0
    }
  }
}
```

### Theme Pack Payload

`/user/files/saga-theme-pack-<themeId>.v1.json`

```json
{
  "schemaVersion": 1,
  "kind": "saga_theme_pack",
  "id": "royal-chronicle-custom",
  "type": "custom",
  "title": "Royal Chronicle Custom",
  "description": "Custom Theme Pack exported from Saga.",
  "author": "",
  "version": "1.0.0",
  "colors": {
    "background": "#120c12",
    "surface": "#2b1c1c",
    "accent": "#d7b56d"
  },
  "tags": [],
  "source": {
    "kind": "local",
    "importedFrom": "royal-chronicle.theme.json"
  },
  "createdAt": 0,
  "updatedAt": 0
}
```

Theme Packs must remain data-only. They cannot include Icon Set fields.

## Icon Set Storage Schema

### Icon Set Index

`/user/files/saga-iconset-index.v1.json`

```json
{
  "schemaVersion": 1,
  "kind": "saga_iconset_index",
  "createdAt": 0,
  "updatedAt": 0,
  "revision": 2,
  "iconSets": {
    "mystic-tabs": {
      "iconSetId": "mystic-tabs",
      "title": "Mystic Tabs",
      "type": "custom",
      "payloadFile": "/user/files/saga-iconset-mystic-tabs.v1.json",
      "preferredSize": 256,
      "iconCount": 7,
      "assetCount": 7,
      "createdAt": 0,
      "updatedAt": 0
    }
  }
}
```

### Icon Set Payload

`/user/files/saga-iconset-<iconSetId>.v1.json`

```json
{
  "schemaVersion": 1,
  "kind": "saga_iconset",
  "id": "mystic-tabs",
  "type": "custom",
  "title": "Mystic Tabs",
  "description": "Imported shelf icon set.",
  "author": "",
  "version": "1.0.0",
  "preferredSize": 256,
  "icons": {
    "tab.loredecks": "/user/files/saga-iconset-asset-mystic-tabs-tab-loredecks-a83f21c2.png",
    "tab.session": "/user/files/saga-iconset-asset-mystic-tabs-tab-session-4db912ee.png",
    "tab.context": "/user/files/saga-iconset-asset-mystic-tabs-tab-context-1138cc9a.png",
    "tab.settings": "/user/files/saga-iconset-asset-mystic-tabs-tab-settings-92aa01bc.png"
  },
  "assets": {
    "/user/files/saga-iconset-asset-mystic-tabs-tab-loredecks-a83f21c2.png": {
      "slot": "tab.loredecks",
      "mime": "image/png",
      "sha256": "a83f21c2...",
      "bytes": 43210
    }
  },
  "tags": [],
  "source": {
    "kind": "local",
    "importedFrom": "mystic-tabs.saga-iconset.zip"
  },
  "createdAt": 0,
  "updatedAt": 0
}
```

### Icon Asset Restrictions

Allowed imported icon formats should be conservative:

- `png`
- `webp`
- `jpg` / `jpeg`
- possibly `avif` if browser support is acceptable

Avoid imported SVG for now. Even when SVG is displayed as an image, avoiding it is simpler for a security-sensitive audience and easier to explain: imported visual assets are passive raster files.

## Asset Storage

### Asset Filename Rules

Asset filenames should include:

- Saga prefix
- owner domain
- owner ID
- role or slot
- short content hash
- extension

Examples:

```text
saga-pack-asset-one-piece-arlong-park-custom-cover-a83f21c2.png
saga-iconset-asset-mystic-tabs-tab-loredecks-4db912ee.webp
```

Use content hashes to avoid collisions and enable deduplication checks.

### Asset References

Payload files should store asset references as paths plus metadata:

```json
{
  "path": "/user/files/saga-pack-asset-one-piece-arlong-park-custom-cover-a83f21c2.png",
  "mime": "image/png",
  "sha256": "a83f21c2...",
  "bytes": 123456,
  "width": 1024,
  "height": 576
}
```

### Asset Ownership

The master index should decide whether an asset can be deleted.

An asset may be:

- owned by one pack
- owned by one icon set
- shared by multiple records because the same imported file hash was reused
- external because the path was provided by the user and not uploaded by Saga

Delete only owned assets.

## Import Flows

### Loredeck Zip With Cover Image

Target flow:

1. User selects `.saga-loredeck.zip`.
2. Saga reads and validates zip entries in-browser.
3. Saga rejects unsafe paths and executable-like files.
4. Saga validates package metadata, deck manifests, registries, entries, and cover assets.
5. Saga previews selected decks.
6. Saga uploads cover images as passive asset files.
7. Saga writes one pack payload JSON file per imported deck.
8. Saga updates `saga-library-index.v1.json`.
9. Saga updates `saga-storage-index.v1.json`.
10. Saga writes only compact storage pointers to settings.

The imported pack payload stores cover references by path. The library index stores the display cover path for quick rendering.

### Loredeck Package With Multiple Decks

For a package containing multiple decks:

- upload each deck cover separately
- write one payload file per deck
- update library folders and placements from package metadata
- remap folder IDs when conflicts exist
- update library index in one final write after all payloads are verified

If one deck fails during import, Saga should allow:

- cancel full import and clean up already uploaded files
- import only valid decks and show skipped deck reasons

### Bundled Reference Import

If an imported package declares that it is a light reference to a bundled deck, and the local bundled deck exists:

- write a delta payload instead of a full entry copy
- set `source.kind = "bundled_manifest_reference"`
- store only overrides, disabled IDs, added entries, and metadata

If the bundled source does not exist locally:

- either reject the lightweight reference with a clear message
- or require the package to include a full fallback payload

### Theme Pack JSON Import

Theme Pack import should:

1. Read JSON.
2. Reject Icon Set fields.
3. Normalize theme ID.
4. Write `saga-theme-pack-<themeId>.v1.json`.
5. Update `saga-theme-index.v1.json`.
6. Register both files in master storage index.
7. Keep `settings.themePackId` unchanged until the user applies it.

### Icon Set JSON Import

If JSON maps icon slots to existing paths:

1. Normalize icon set ID.
2. Validate icon keys.
3. Validate path strings.
4. Write `saga-iconset-<iconSetId>.v1.json`.
5. Update icon set index.

If JSON includes data URLs:

1. Decode and validate each image.
2. Upload each image as a flat asset file.
3. Rewrite icon mappings to returned `/user/files/...` paths.
4. Write icon set payload.

### Icon Set Zip Import

Preferred icon-set package shape:

```text
mystic-tabs.saga-iconset.zip
  saga-iconset.json
  icons/
    tab-loredecks.png
    tab-session.png
    tab-context.png
    tab-settings.png
```

Import should:

1. Read zip.
2. Reject unsafe paths.
3. Reject executable entries.
4. Read `saga-iconset.json`.
5. Resolve relative icon file references.
6. Upload images as passive assets.
7. Rewrite mappings to `/user/files/...`.
8. Write icon set payload.
9. Update icon set index and master storage index.

## Export Flows

### Loredeck Export

Export should read:

- library index record
- pack payload file
- cover/banner assets
- registries

Then create `.saga-loredeck.zip` with the bundled-folder-shaped package layout. The storage format does not need to match the export layout. Export materializes a shareable package.

### Theme Pack Export

Export can either:

- read the active bundled/custom theme and download a single `.theme.json`
- or export installed custom Theme Pack library as a JSON library file

This remains simple because Theme Packs are JSON-only.

### Icon Set Export

For JSON-only icon sets with external paths, export can download one JSON file.

For icon sets with Saga-owned uploaded assets, prefer a zip export:

```text
mystic-tabs.saga-iconset.zip
  saga-iconset.json
  icons/
    tab-loredecks.png
    tab-session.png
```

The export should rewrite `/user/files/...` paths to relative package paths.

## Write Semantics

### Whole-File Replacement

The built-in upload endpoint writes a whole file by name. Saga should treat each JSON write as replacing the prior file.

This is acceptable if:

- payload files are domain-sized, not enormous monoliths
- writes are debounced for frequent UI edits
- revision numbers detect stale writes
- failed writes do not update indexes

### Write Order

For creating a new payload:

1. Build normalized payload.
2. Upload passive assets.
3. Verify uploaded assets.
4. Upload payload JSON.
5. Verify payload JSON.
6. Update domain index.
7. Verify domain index.
8. Update master index.
9. Save compact settings pointers if needed.
10. Refresh in-memory cache.

For updating an existing payload:

1. Read current cached payload and revision.
2. Apply mutation to normalized object.
3. Upload new payload JSON using same filename.
4. Verify payload.
5. Update index summary fields.
6. Update master index metadata.
7. Refresh cache.

For deleting an owner:

1. Load domain index.
2. Resolve payload and owned asset paths.
3. Remove domain record.
4. Upload updated domain index.
5. Upload updated master index with file records removed or marked deleting.
6. Delete payload/assets through `/api/files/delete`.
7. Verify deletion.
8. If deletion fails, mark file record as `delete_failed` so cleanup can retry.

### Why Index Update Comes Before Delete

Deleting files first risks losing the only metadata needed to recover if the browser crashes midway. Removing the domain record first makes the product state correct, then file cleanup can retry.

### Stale Write Detection

Each index and payload should include:

```json
{
  "revision": 12,
  "updatedAt": 0,
  "contentHash": "optional"
}
```

In a single browser session, Saga can compare the cached revision to the latest fetched revision before overwriting. Multi-tab editing is not a primary alpha target, but stale-write detection should produce a clear "Storage changed, reload this panel" message instead of silently overwriting.

## Read Semantics

### Boot Sequence

1. Read `extensionSettings.saga`.
2. If `settings.sagaStorage.masterIndexFile` exists, fetch it.
3. If master index fetch succeeds, fetch domain indexes lazily as panels need them.
4. If master index is missing but fallback domain pointers exist, attempt fallback fetches.
5. If no external storage exists but legacy settings contain heavy records, offer or run pre-alpha migration.
6. If neither external storage nor legacy records exist, initialize empty indexes.

### Lazy Hydration

Do not fetch every pack payload on startup.

Fetch:

- library index when opening Library/Loredecks surfaces
- individual pack payload when inspecting details, loading active stack, editing, exporting, or running Pack Health
- creator index for Creator shelf
- individual project payload when opening that project
- theme index when rendering Theme Pack library
- icon set index when rendering Icon Set library

### Cache Rules

Use in-memory caches for fetched indexes and payloads.

Cache invalidation triggers:

- successful write
- explicit refresh
- import/export action
- delete/forget action
- stale revision detection
- storage integrity repair

Do not rely on settings object identity for content freshness.

## Migration Plan

Because Saga is pre-alpha, migration should favor correctness and simplicity over indefinite backward compatibility.

### Migration Inputs

Legacy settings may contain:

- `settings.loredeckLibrary`
- `settings.loredeckCreatorProjects`
- `settings.themePackLibrary`
- `settings.themeIconSetLibrary`

Legacy chat metadata may contain:

- `state.loredeckRegistry`
- `state.loredeckCreator`
- `state.loredeckStack`
- `state.loredeckContexts`

### Migration Outputs

Migration should create:

- master storage index
- library index
- pack payload files for custom/generated/imported packs
- Creator index
- Creator project files
- theme index and theme payload files
- icon set index and icon set payload files
- passive asset files where legacy payloads contain data URLs or embedded assets

Settings should be rewritten to compact pointers.

Chat metadata should keep:

- current active stack
- current Context selections
- current accepted/pending lore
- current continuity/runtime state

Chat metadata should not keep:

- duplicated library pack payloads
- duplicated Creator project payloads

### Migration Procedure

1. Detect heavy legacy storage.
2. Create an in-memory migration plan.
3. Validate all generated filenames.
4. Convert custom/generated/imported pack records into payload files.
5. Convert library organization into library index.
6. Convert Creator jobs into project files and Creator index records.
7. Convert custom Theme Packs into theme payload files and theme index.
8. Convert custom Icon Sets into icon set payload files and icon set index.
9. Upload payload files and assets.
10. Verify uploaded files.
11. Upload domain indexes.
12. Upload master index.
13. Rewrite settings to compact pointers and migration marker.
14. Remove heavy legacy settings fields.
15. Save settings.
16. Clear duplicated chat-local library/Creator payloads if they are global copies.
17. Save chat metadata when changed.
18. Run integrity check.
19. Show migration result in State Safety or Settings diagnostics.

### Migration Failure Behavior

If migration fails before settings are rewritten:

- leave legacy settings intact
- delete newly uploaded files where possible
- show a compact error

If migration fails after some files were uploaded but before index commit:

- legacy settings remain source of truth
- uploaded files are orphan candidates
- retry cleanup using the migration plan's uploaded file list

If migration fails after settings are rewritten:

- external indexes are source of truth
- run integrity check
- allow repair from master/domain indexes

### No Long-Term Dual Writes

Do not keep writing both legacy settings and external files for a long period. Dual writes would create more bugs than it prevents.

Accept a short internal transition window while domain stores are updated, then remove heavy legacy writes.

## Settings Store Changes

`settings-store.js` currently normalizes and writes heavy registries. The new rule should be:

- `getSettings()` returns compact settings plus optional synthesized registry views only when needed.
- `saveSettings()` strips heavy externalized fields before persisting.
- domain stores own storage writes for their content.
- settings writes should not normalize full Loredeck/Creator/Theme/Icon payloads.

Suggested helper:

```js
function stripExternalizedStorageFields(settings) {
    delete settings.loredeckLibrary;
    delete settings.loredeckCreatorProjects;
    delete settings.themePackLibrary;
    delete settings.themeIconSetLibrary;
    return settings;
}
```

During transition, the function may preserve compact generated views:

```json
{
  "loredeckLibrary": {
    "schemaVersion": 1,
    "externalized": true,
    "indexFile": "/user/files/saga-library-index.v1.json"
  }
}
```

But the final goal should be explicit `sagaStorage` fields, not fake old registries.

## Domain Store Changes

### Loredeck Library Store

Current responsibilities:

- merge global library and chat-local registry
- upsert pack records
- remove packs
- import registry
- promote chat registry to settings

Target responsibilities:

- load bundled defaults from code
- load custom/generated/imported records from `saga-library-index.v1.json`
- load individual payload files on demand
- upsert pack payload file, then index record
- remove pack index record, payload file, owned assets, and linked Creator references
- import package into payload files, not settings records
- stop promoting chat-local pack payloads into settings

### Creator Store

Current responsibilities:

- save Creator project registry into settings and/or chat metadata
- update active jobs
- clear jobs
- manage generated pack links

Target responsibilities:

- save Creator shelf index externally
- save each project externally
- keep only active project ID in compact settings or index
- allow chat metadata to reference active project ID if the chat is using it
- update linked generated pack metadata through the library store

### Theme Library Store

Current responsibilities:

- normalize and write custom Theme Pack registry to settings
- normalize and write custom Icon Set registry to settings

Target responsibilities:

- read bundled presets from code
- read custom Theme Pack index and payloads from files
- read custom Icon Set index and payloads from files
- write custom imports to external files
- keep active IDs in settings

## Pack Health And Repair

### Health Reports

Pack Health should generally be computed on demand.

The library index may store a compact summary:

```json
{
  "healthSummary": {
    "status": "errors",
    "errorCount": 2,
    "warningCount": 7,
    "noticeCount": 0,
    "checkedAt": 0,
    "engineVersion": "schema-v3",
    "packRevision": 18
  }
}
```

Do not store full issue lists by default.

### Issue State

User dispositions such as "Accept As-Is" can be stored in the pack payload because they are user decisions about that pack:

```json
{
  "healthIssueStates": {
    "issue-stable-id": {
      "state": "accepted_as_is",
      "reason": "",
      "updatedAt": 0
    }
  }
}
```

Do not store "fixed" markers as proof. `Verify Fixed` should rerun Pack Health and clear resolved issues only when the issue no longer appears.

### Repair Sessions

The proposed `Attempt Fixing` workflow can use an optional durable repair session file only while a repair is active or review choices remain:

```json
{
  "schemaVersion": 1,
  "kind": "saga_repair_session",
  "packId": "one-piece-arlong-park-custom",
  "sessionId": "repair-20260613-001",
  "status": "needs_review",
  "startedAt": 0,
  "updatedAt": 0,
  "beforeSummary": {},
  "afterSummary": {},
  "batches": [],
  "reviewChoices": []
}
```

Completed repair sessions should be summarized and deleted unless the user explicitly saves diagnostics.

## Library Changes And Folder Structure

All Library organization changes should be saved externally in `saga-library-index.v1.json`.

This includes:

- creating folders
- renaming folders
- deleting folders
- nesting folders
- collapsing folders if collapse state is treated as library state
- moving packs between folders
- manual pack ordering
- package folder placement on import
- bulk move operations
- Creator project folder association if the project shelf filters by Library folders

The folder system should not be encoded into pack payloads. A pack can be moved without rewriting the pack file.

Recommended split:

```text
Library index:
  folder tree
  pack placement
  display order

Pack payload:
  actual deck content

Creator index:
  project folderId for shelf filtering

Chat metadata:
  current active stack and current Context choices
```

## Deletion And Cleanup

### Delete Custom Lorepack

1. Confirm deletion.
2. Load library index.
3. Remove pack record and deck placement.
4. Write library index.
5. If pack was active in current chat stack, remove or disable current chat stack entry.
6. Load master index.
7. Identify payload file and owned assets.
8. Delete files.
9. Verify deletion.
10. Update master index.
11. Clear linked Creator references if requested by user.

### Delete Creator Project

1. Confirm deletion.
2. Check for active generation. If active, require cancellation first.
3. Remove project from Creator index.
4. Delete project payload file.
5. Clear active/last project IDs if needed.
6. If user selected "also delete generated pack", call Delete Custom/Generated Lorepack flow.
7. If generated pack remains, clear stale back-reference or mark source project missing.

### Forget Theme Pack

1. Remove from theme index.
2. Delete theme payload file.
3. If active theme is deleted, switch to default bundled theme.
4. Update settings active theme ID.

### Forget Icon Set

1. Remove from icon set index.
2. Delete icon set payload file.
3. Delete owned icon assets not referenced by another icon set.
4. If active icon set is deleted, switch to default bundled icon set.
5. Update settings active icon set ID.

### Storage Cleanup Tool

Add a Settings or State Safety diagnostic:

- `Verify Saga Storage` / `Verify Storage`: implemented in the State Safety card for files known to the master index.
- `Repair Storage Index` / `Clean Missing Records`: implemented for missing non-index file records that are already listed in the master index.
- `Clean Up Unused Saga Files`: still limited to indexed or explicitly selected files because SillyTavern does not expose folder listing.

Because there is no folder listing, cleanup can only act on files known to the master index or files explicitly selected by the user.

## Error Handling

### Missing Master Index

If settings points to a missing master index:

1. Try fallback domain index pointers from settings.
2. If domain indexes exist, rebuild master index.
3. If domain indexes are missing but legacy settings payloads exist, rerun migration.
4. If nothing is recoverable, show "Saga storage index is missing" and offer to initialize an empty index.

### Missing Domain Index

If a domain index is missing:

- show that domain as unavailable
- keep other domains usable
- allow reinitializing an empty index for that domain
- do not delete payload files unless they are known orphaned through another index

### Missing Pack Payload

If a library pack points to a missing payload:

- keep the library row visible with status `Missing file`
- disable load/edit/export
- allow removing the broken library record
- allow user to reinstall/update the package

### Corrupt JSON

If a JSON file cannot parse:

- do not overwrite it automatically
- show file path and parse error summary
- allow export/download of corrupt text for manual recovery if possible
- allow replacing by reimporting

### Asset Missing

If a cover/icon asset is missing:

- fall back to text/default icon
- mark asset missing in diagnostics
- keep the parent record usable

## Security Model

This design is intentionally conservative:

- No server plugin.
- No executable imports.
- No HTML imports.
- No JavaScript imports.
- No arbitrary SVG imports in the first pass.
- JSON is parsed as data and normalized.
- Zip import rejects unsafe paths.
- Assets are passive raster files.
- Filenames are sanitized and flat.
- Saga writes only through SillyTavern's existing authenticated files API.

Imported JSON should be treated as untrusted data. It cannot define code, event handlers, scripts, URLs to execute, or dynamic CSS.

Theme Packs should remain color/token data only. They should not import CSS.

Icon Sets should remain slot-to-image-path data only.

Lorepacks should remain schema-bound lore data only.

## UX Requirements

### Storage Should Be Invisible Most Of The Time

Users should not need to understand the storage files to use Saga. Normal UI should still say:

- Import Deck
- Export Selected
- Create Deck
- Installed Theme Packs
- Shelf Icon Set
- Pack Health

### Diagnostics Should Be Concrete

If storage breaks, messages should name the affected domain:

- "Lorepack payload file is missing."
- "Creator project file could not be loaded."
- "Icon Set asset is missing; using text fallback."
- "Saga storage index could not be verified."

Avoid vague "settings failed" messages for external content issues.

### Import Success Must Mean Durable Storage

Do not show success until:

- payload file is uploaded
- required assets are uploaded
- domain index is updated
- master index is updated or queued for retry

### Buttons Should Reflect Real Mutation

When users delete, import, repair, or apply changes, verify the underlying file/index state changed. Do not trust a toast alone.

## Performance

### Expected Sizes

Reasonable initial targets:

- Theme Pack payload: under 50 KB
- Icon Set payload: under 100 KB, excluding assets
- Icon asset: under 1 MB each
- Cover image: under 5 MB each after optional resize/compression
- Pack payload: under 25 MB for normal use
- Creator project payload: under 25 MB for normal use
- Master/domain indexes: under 2 MB

These are product limits, not SillyTavern hard limits. They keep the UI responsive.

### Lazy Loading Is Required

Opening the runtime should not fetch every pack and every Creator project. Fetch indexes first; fetch heavy payloads on demand.

### Batch Writes

High-frequency mutations should debounce:

- Creator project updates during generation
- draft pool changes
- health repair batch progress
- library sort operations

Critical transitions should flush immediately:

- import commit
- delete commit
- finalization
- repair apply
- active project switch

## Development Phases

### Phase 0: Storage Proof And Contracts

Deliverables:

- Document storage constraints.
- Add low-level file API wrapper.
- Add filename sanitizer and deterministic filename builder.
- Add JSON read/write helpers.
- Add tests for filename validation, base64 encode/decode, and path normalization.

Acceptance:

- Can write, read, verify, and delete a small JSON file through the existing files API.
- Cannot create subfolders, and code accounts for that.
- No server plugin is required.

### Phase 1: Master Storage Index

Deliverables:

- `saga-storage-index.v1.json` schema and normalizer.
- bootstrap pointer in settings.
- master index create/read/write/verify.
- file registration and ownership helpers.
- recovery path for missing master index with known domain pointers.

Acceptance:

- New installs initialize compact storage pointers.
- Settings stays small.
- Master index can register and unregister files.
- Integrity check reports missing files accurately.

### Phase 2: Theme Pack And Icon Set Externalization

Start with Theme/Icon because they are smaller and lower-risk than Lorepacks.

Deliverables:

- External theme index and payload writes.
- External icon set index and payload writes.
- Icon asset upload and mapping rewrite.
- Theme/Icon import actions write external files.
- Theme/Icon forget actions clean up payloads/assets.
- Settings keeps only active IDs and storage pointers.

Acceptance:

- Import Theme Pack no longer increases `settings.json` by the full theme payload.
- Import Icon Set with images writes icon asset files and payload file.
- Active Theme Pack and Icon Set still apply immediately.
- Forget deletes external records and falls back when deleting active custom records.

### Phase 3: Lorepack Library Index

Deliverables:

- External library index.
- Folder tree persistence.
- Deck placement persistence.
- Library row models merged from bundled defaults and external custom/generated/imported records.
- Pack payload pointer model.
- Delete/forget updates index and cleanup plan.

Acceptance:

- Creating, renaming, deleting, nesting, and moving folders persists in `saga-library-index.v1.json`.
- Imported/custom/generated pack rows appear from the external index.
- Bundled pack rows still come from bundled defaults.
- Current chat active stack still works from chat metadata.

Implementation notes:

- `src/storage/saga-lorepack-library-storage.js` owns the external Library index cache and provides synchronous cache mutation helpers backed by queued flat-file writes. Runtime UI can update immediately while persistence flushes to `/user/files/saga-library-index.v1.json`.
- `src/state/loredeck-library-store.js` routes generated/custom/imported pack upsert, import, remove, and chat promotion through the external Library index instead of embedding those rows into `settings.loredeckLibrary`.
- `src/loredecks/loredeck-library-panel.js` routes folder, nesting, manual order, deck placement, and folder removal mutations through the state/storage layer instead of saving the full Library registry back to settings.
- This is a transitional Phase 3 shape: external Library rows may still carry rich pack record fields until Phase 4 splits actual pack payloads into `saga-pack-<packId>.v1.json` files and leaves only lightweight metadata/pointers in the Library index.

### Phase 4: Lorepack Payload Externalization

Deliverables:

- Convert custom/generated/imported pack records into payload files.
- Load payloads on demand for details, active stack, Pack Health, editing, and export.
- Import `.saga-loredeck.zip` writes payload files and cover assets.
- Export reads payload files and materializes zip package.
- Pack Health reads payload files.

Acceptance:

- Importing the Arlong test deck writes a pack payload file and cover asset, not a huge settings record.
- Library index contains only metadata and pointers.
- Pack Health can load and validate external payloads.
- Export produces the same expected `.saga-loredeck.zip` package.

Implementation notes:

- `src/storage/saga-lorepack-payload-storage.js` owns the external Lorepack payload cache, queued payload writes, lazy payload hydration, and delete cleanup for payload files and owned passive assets.
- Custom, Generated, and imported pack upserts now write a normalized payload cache/file first, then write a compact Library index record with `payloadFile`, counts, summary metadata, and `coverFile` when available.
- Imported package data URL assets are materialized to flat passive files such as `saga-pack-asset-<packId>-cover-<hash>.png`; the payload JSON stores the passive `/user/files/...` path instead of the base64 data URL.
- `loadLoredeckSourceById` hydrates compact Library records from external payload files on demand, so active stack loading, Pack Health, and export can resolve payload-backed virtual packs after reload.
- `loredeck-package-export.js` now uses the hydrated loader record for tag registries, timeline registries, and assets, rather than only the compact Library row.
- `normalizeLoredeckRegistry` preserves lightweight `payloadFile` and `coverFile` pointers, while the external Library index still strips heavy payload fields such as `manifestData`, `entryOverrides`, registries, assets, and health issue state.
- `upsertLoredeckLibraryPack` refuses to save over an external payload-backed pack from a compact, unhydrated row. Editors and validation paths hydrate the payload before mutating so a rename or metadata edit cannot silently replace the real entries with an empty normalized shell.

### Phase 5: Creator Project Externalization

Deliverables:

- External Creator index.
- One external project file per Creator project.
- Project shelf reads Creator index.
- Opening project fetches project payload.
- Generation updates write project payload.
- Generated pack linkage updates external Library index/payload.

Acceptance:

- Starting and progressing a Creator project does not bloat `settings.json`.
- Closing/reloading can resume project from external file.
- Creator shelf remains fast because it reads the index, not every project.
- Deleting a project removes its project file and updates index.

Implementation notes:

- `src/storage/saga-creator-project-storage.js` owns the external Creator index cache, full Creator project payload cache, queued project/index writes, lazy project payload hydration helpers, and project-file deletion cleanup.
- `src/state/lore-creator-store.js` routes project creation, update, activation, generation checkpoints, deletion, and chat-local promotion through external Creator storage instead of writing full jobs into `settings.loredeckCreatorProjects`.
- The active chat mirror remains full and synchronous for now. This preserves in-progress generation behavior while the external project service takes over global storage.
- Compact Creator index rows preserve lightweight `projectFile`, title, status, stage, folder, generated-pack link, and progress metadata, but they do not retain stage artifacts, title drafts, draft changes, generation unit payloads, or diagnostics.
- Compact external Creator rows are guarded against stale overwrites: the store refuses to mutate an unloaded external project unless the full payload is already cached or available from the active chat mirror.
- `bootstrapSagaExtension` hydrates the external Creator index on startup so the In-Progress Creator Projects shelf can be populated from the index without loading every project payload.
- Deleting a linked Generated Loredeck clears external Creator projects as well as legacy settings/chat-local mirrors.
- `openLoredeckCreatorProject` uses `activateLoredeckCreatorJobAsync` so clicking an unloaded compact Creator row fetches its `projectFile`, hydrates the payload cache, then activates the project.

### Phase 6: Migration Out Of Legacy Settings

Deliverables:

- Migration planner.
- Migration executor.
- Upload verification.
- settings shrink step.
- chat metadata cleanup for duplicated global payloads.
- rollback behavior before commit.
- integrity report after commit.

Acceptance:

- Existing settings-backed custom/generated/imported decks become external files.
- Existing Creator projects become external files.
- Existing custom Theme/Icon records become external files.
- `settings.json` shrinks substantially.
- App behavior remains equivalent after reload.

Implementation notes:

- `src/storage/saga-storage-migration.js` owns the first migration planner, executor, compact-settings rewrite helper, and optional chat-local cleanup helper.
- The planner separates payload migration from settings compaction. This matters because settings may contain bulky bundled/default records that should be compacted away without writing bundled payload files to `/user/files`.
- The executor routes legacy custom/generated/imported Lorepacks, Creator projects, custom Theme Packs, and custom Icon Sets through the existing storage adapters rather than hand-writing domain files.
- Migration writes are sequenced by domain and flushed before the next shared master-index writer begins. Lorepack payload/index writes finish before Creator writes, and Creator writes finish before Theme/Icon imports, preventing queued storage writes from clobbering one another's master-index registrations.
- The compact settings helper preserves small control-plane preferences such as selected Theme Pack/Icon Set IDs while replacing heavy legacy registries with empty compact shells and setting `sagaStorage.migrationVersion` to `external-files-v1`.
- `src/state/state-manager.js` exposes `getSagaStorageMigrationPlan` and `runSagaStorageMigration` so runtime UI can trigger migration without importing storage adapters directly.
- The Advanced Settings State Safety card shows migration readiness, exposes `Migrate Legacy Storage` when the planner finds legacy payloads, creates a pre-migration chat backup, and logs migration success/failure into the State Safety lifecycle log.
- `src/state/settings-store.js` now preserves externalized compact settings after migration. When `sagaStorage.migrationVersion` is `external-files-v1`, ordinary settings saves keep `loredeckLibrary`, `loredeckCreatorProjects`, `themePackLibrary`, and `themeIconSetLibrary` as compact empty shells instead of re-expanding bundled or payload-heavy records into `settings.json`.

### Phase 7: Pack Health And Repair Integration

Deliverables:

- Pack Health loads external payloads.
- `Attempt Fixing` writes through storage service.
- health summaries update library index.
- optional repair session files for resumable review choices.
- issue dispositions live in pack payload.

Acceptance:

- Health repairs mutate the pack payload file.
- After reload, fixed issues stay fixed.
- No repair flow writes full issue data to settings.

### Phase 8: Diagnostics, Docs, And Gate

Deliverables:

- Storage diagnostics UI.
- developer docs.
- user-facing docs where needed.
- alpha gate checks.
- visual smoke paths.

Acceptance:

- `settings.json` no longer contains heavy Saga payloads.
- import/export tests pass.
- Creator resume tests pass.
- Pack Health tests pass.
- Theme/Icon tests pass.
- delete cleanup tests pass.
- browser smoke shows no console errors.

Implementation notes:

- `src/storage/saga-storage-diagnostics.js` owns the first diagnostics service. It summarizes runtime storage adapter status, pending writes, write errors, and master-index verification results.
- `src/state/state-manager.js` exposes `getSagaStorageDiagnostics` and `verifySagaStorageIntegrity`, updates `sagaStorage.lastVerifiedAt`, and records State Safety lifecycle log entries for successful checks and warnings.
- The State Safety card exposes `Verify Storage`, shows the latest compact storage-integrity summary, and reports missing master index or missing indexed files without trying to infer unknown orphaned files.
- This diagnostic is intentionally index-based. `Clean Missing Records` can remove stale non-index file records from the master index after verification, but broader unused-file cleanup remains limited because SillyTavern's flat files API does not list Saga-owned files.
- Pack Health external payload wiring is now covered by `tools/scripts/test-saga-lorepack-health-external-payloads.mjs`. The runtime validation path hydrates a compact external Lorepack payload after a cold cache reset, saves the updated health summary through the external payload service, and keeps the Library index/settings compact.
- Pack Health repair entry points now hydrate payload-backed Lorepacks before building repair writes. Deterministic safe repair writes repaired Lorecards to the external payload file, while assistant repair drafting and malformed-tag repair planning hydrate before reading rows or queueing review changes.
- The State Safety card exposes `Settle Storage Writes` for queued adapter writes and `Clean Missing Records` for verified missing non-index records. These actions are intentionally named around their actual scope rather than implying Saga can discover arbitrary orphan files.

## Test Plan

### Unit Tests

- filename sanitizer accepts valid Saga flat filenames.
- filename sanitizer rejects slashes, spaces if disallowed, leading dots, executable extensions.
- storage index normalizer preserves known file records.
- storage index normalizer drops invalid records.
- library index normalizer preserves folders and placements.
- pack payload normalizer preserves entries, registries, pending changes, and health issue states.
- Creator index normalizer preserves project summaries.
- Creator project normalizer preserves stage artifacts.
- theme/icon normalizers preserve payload references.

### Mocked Files API Tests

- upload JSON payload.
- verify uploaded payload.
- delete payload.
- handle upload failure without updating index.
- handle index write failure after payload write by registering cleanup.
- handle delete failure by marking `delete_failed`.

### Migration Tests

- migrate settings-backed custom deck to payload file.
- migrate generated deck plus Creator project link.
- migrate theme library.
- migrate icon set with existing path mappings.
- migrate icon set with data URL assets.
- migrate library folders and deck placements.
- remove heavy settings fields after success.
- preserve active chat stack.
- preserve Context selections.
- handle corrupt legacy pack without deleting original settings.

### Import/Export Tests

- import `.saga-loredeck.zip` with cover image.
- import multi-deck zip with folder placements.
- reject zip with unsafe paths.
- reject executable zip entries.
- export external payload back to `.saga-loredeck.zip`.
- import Theme Pack JSON.
- reject Theme Pack JSON that contains icon fields.
- import Icon Set JSON with existing paths.
- import Icon Set zip with raster icons.
- reject imported SVG icon in first pass.

### Browser Smoke

Current implemented coverage:

- live SillyTavern smoke temporarily switches to Advanced Experience.
- open Settings.
- open State Safety.
- verify storage migration status/action is rendered.
- verify **Verify Storage** is rendered.
- verify **Settle Storage Writes** is rendered.
- verify **Clean Missing Records** is rendered.
- verify Storage migration and Storage integrity rows are rendered.
- capture a State Safety storage screenshot.
- restore the user's original Saga settings when the smoke had to switch modes.
- repo-local `storage-harness` target starts a mocked SillyTavern files API for `/api/files/upload`, `/api/files/verify`, `/api/files/delete`, and `/user/files/*` reads.
- `storage-harness` imports a fixture Loredeck through the runtime Library store path, flushes payload and Library writes, verifies the payload and cover asset land in `/user/files`, and fails if unique Lorecard payload content appears in settings.
- `storage-harness` reloads the smoke page, hydrates the external Library index, loads the external payload through the Loredeck loader, deletes the pack through the visible Library delete action and Saga confirmation dialog, flushes delete writes, and verifies payload/asset files are deleted.
- `storage-harness` imports custom Theme Pack and Icon Set fixtures through the external storage adapters, verifies Theme/Icon payload files and raster icon assets land in `/user/files`, reloads and hydrates those indexes, saves them as active compact settings, verifies the active choices resolve from hydrated external Theme/Icon storage, removes them through the visible Settings **Forget Theme Pack** and **Forget Icon Set** controls, and verifies payload/asset cleanup.
- `storage-harness` opens Pack Health Center for the external payload-backed Loredeck after reload, runs **Refresh Scan**, verifies cached health updates, verifies Library/payload health status writes stay external, and fails if Lorecard payload content leaks into settings.
- `storage-harness` is source-contract covered by `test-visual-smoke-harness.mjs`.

Expanded persistence smoke still desired before an alpha tag or release candidate:

- run `SAGA_SMOKE_TARGET=storage-harness node tools/scripts/smoke-live-st-cdp.mjs` in an environment where the CDP helper can complete `Page.enable`.
- review the resulting storage-harness Pack Health screenshots and JSON output.
- review visible Settings Theme/Icon forget screenshots and follow up on any UI regressions from that run.

Current local blocker:

- On this workstation, the Chrome/Edge DevTools endpoint becomes reachable and exposes a page WebSocket, but the page target does not answer startup commands such as `Page.enable` before any Saga page code runs.
- The failure reproduces for `storage-harness`, `guide-harness`, and minimal direct CDP probes, so it is tracked as a local CDP transport issue rather than a storage regression.
- The live smoke helper now reports this as `CDP startup handshake failed at ...` with the target, URL, browser path, headless mode, transport, and retry flags.
- Retry knobs: `SAGA_SMOKE_NATIVE_WS=1`, `SAGA_SMOKE_HEADLESS=0`, `SAGA_SMOKE_DEBUG=1`, and `SAGA_SMOKE_DEBUG_FRAME=1`.

### Manual Inspection

After a representative test run, inspect:

- `settings.json` contains only compact Saga storage pointers and preferences.
- `/user/files` contains expected `saga-*.json` and passive asset files.
- library folder changes appear in `saga-library-index.v1.json`.
- pack payload files contain entries.
- Creator project files contain stage artifacts.
- no unexpected base64 image blobs appear in settings.

## Code Impact Map

Likely high-impact files:

- `src/state/settings-store.js`
- `src/state/state-manager.js`
- `src/state/loredeck-library-store.js`
- `src/state/lore-creator-store.js`
- `src/state/lore-creator-state.js`
- `src/state/theme-library-store.js`
- `src/runtime/loredeck-package-install.js`
- `src/runtime/loredeck-package-install-panel.js`
- `src/runtime/loredeck-package-export.js`
- `src/loredecks/loredeck-loader.js`
- `src/loredecks/loredeck-health-panel.js`
- `src/loredecks/schema-v3-health.js`
- `src/settings/theme-actions.js`
- `src/theme/runtime-theme.js`
- tests under `tools/scripts` and `tests`

Likely new files:

- `src/storage/saga-file-api.js`
- `src/storage/saga-storage-index.js`
- `src/storage/saga-storage-filenames.js`
- `src/storage/saga-domain-storage.js`
- `src/storage/saga-storage-migration.js`
- `tools/scripts/test-saga-file-storage.mjs`
- `tools/scripts/test-saga-storage-migration.mjs`
- `tools/scripts/test-saga-external-lorepack-storage.mjs`
- `tools/scripts/test-saga-external-theme-icon-storage.mjs`

## Open Questions

### Should Theme Packs Be External If They Are Small?

Recommendation: yes. It keeps the model consistent and prevents later drift.

### Should Active Stack Stay In Chat Metadata?

Recommendation: yes. The active stack is current-chat runtime state. The Library index can later store reusable stack profiles if needed.

### Should Full Health Reports Be Stored?

Recommendation: no by default. Store compact summaries. Use temporary repair session files only for active repair workflows.

### Should Imported SVG Icons Be Allowed?

Recommendation: no for the first pass. Restrict to passive raster files.

### Should Raw Imported Zip Files Be Kept?

Recommendation: no by default. Export can recreate a package from payload files. Add an explicit backup option later if users ask for it.

### Should Payload Files Be Pretty-Printed?

Recommendation: yes for JSON payloads and indexes. They are user-visible files in `/user/files`, and readability helps support and recovery. For very large payloads, compact JSON could be considered later, but alpha should optimize inspectability.

## Success Criteria

The rework is successful when:

- importing a large Lorepack does not materially bloat `settings.json`
- generating a large Creator project does not materially bloat `settings.json`
- library folders, placements, and ordering persist externally
- custom Theme Packs and Icon Sets persist externally
- cover and icon images are stored as passive files, not embedded settings blobs
- Pack Health and repair operate against external payloads
- delete/forget actions remove index records and owned payload/assets
- reload behavior is stable
- settings-backed heavy registries are gone or reduced to compact pointers
- no server plugin or backend install step is required

## Implementation Checklist

- [x] Add storage filename utilities.
- [x] Add low-level files API wrapper.
- [x] Add master storage index normalizer and writer.
- [x] Add compact settings bootstrap fields.
- [x] Add generic domain storage helper.
- [x] Externalize Theme Pack imports.
- [x] Externalize Icon Set imports and raster assets.
- [x] Add Icon Set zip import.
- [x] Add Theme/Icon forget cleanup for external records.
- [x] Add Lorepack Library index adapter and hydration cache.
- [x] Add cache-first queued Library index mutation API.
- [x] Externalize Library index.
- [x] Route Library folder and placement writes to external storage.
- [x] Add Lorepack payload storage adapter and queued writes.
- [x] Externalize pack payload files.
- [x] Materialize imported Lorepack data URL assets to passive files.
- [x] Update Loredeck zip import to write payload/assets.
- [x] Update Loredeck loader/export to read external payload/assets.
- [x] Guard compact external Lorepack rows from stale payload overwrites.
- [x] Externalize Creator index.
- [x] Externalize Creator project payloads.
- [x] Wire async Creator project payload hydration on open after fresh reload.
- [x] Add migration planner.
- [x] Add migration executor.
- [x] Wire migration into State Safety runtime action.
- [x] Strip heavy fields from migrated and subsequent saved settings.
- [x] Add storage diagnostics.
- [x] Wire Pack Health to external payloads.
- [x] Wire repair flows to external payload writes.
- [x] Add cleanup and retry behavior.
- [x] Add unit and mocked files API tests.
- [x] Add migration tests.
- [x] Add browser smoke coverage.
- [x] Update user/operator docs after implementation.
