# Addendum 08: Story Package Layer

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga needs a scenario layer above Loredecks. Loredecks provide reusable canon, rules, timelines, and context. Story Packages compose Loredecks into a playable setup: active stack, opener seeds, player assumptions, scenario overlays, starting context, optional arcs, and playthrough state.

Story Packages should make Saga better at starting and maintaining roleplay without turning every Loredeck into a one-off scenario.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\story-openers\story-opener-state.js`
- `F:\git\Saga\src\story-openers\story-opener-source.js`
- `F:\git\Saga\src\story-openers\story-opener-generation.js`
- `F:\git\Saga\src\runtime\story-opener-panel.js`
- `F:\git\Saga\src\storage\saga-story-opener-storage.js`
- `F:\git\Saga\src\loredecks\loredeck-library-service.js`
- `F:\git\Saga\src\loredecks\loredeck-package-service.js`
- `F:\git\Saga\src\storage\saga-domain-storage.js`

Story Maker already has part of the product surface. Story Packages make the durable content layer explicit.

## Product Distinction

| Object | Purpose |
| --- | --- |
| Loredeck | Reusable canon/rules/context asset. |
| Lorecard | Atomic retrievable card/fact/rule unit. |
| Story Package | Playable scenario bundle that references Loredecks and adds setup. |
| Playthrough Snapshot | User-specific runtime state created from a Story Package or direct stack. |

A user should still be able to use Saga with only Loredecks. Story Packages are a higher-level workflow, not a required product mode.

## Story Package Manifest

```json
{
  "schemaVersion": 1,
  "id": "story-package-hp-year-2-diary-mystery",
  "title": "The Diary Mystery",
  "description": "A Year 2 Hogwarts mystery setup centered on the diary, rumors, and early Chamber tension.",
  "version": "1.0.0",
  "type": "bundled",
  "fandom": "Harry Potter",
  "requiredLoredecks": [
    { "packId": "hp-core", "minVersion": "1.0.0", "role": "foundation" },
    { "packId": "hp-year-2-chamber-of-secrets", "minVersion": "1.0.0", "role": "era" }
  ],
  "optionalLoredecks": [],
  "startingContext": {
    "timelineId": "timeline:hp-year-2:autumn",
    "locationId": "entity:hogwarts",
    "activity": "students are reacting to strange rumors after a tense week at school"
  },
  "playerAssumptions": {
    "role": "student",
    "knowledgeProfile": "player_safe_year_2"
  },
  "openerSeeds": [],
  "scenarioFacts": [],
  "retrievalProfile": "balanced_story_package",
  "promptProfile": "story_package_default"
}
```

## Package Contents

A package can include:

- manifest;
- opener seeds;
- scenario facts;
- package-specific Lorecards or overlays;
- recommended active Loredeck stack;
- context defaults;
- character/entity focus;
- starting timeline/location/activity;
- arcs/objectives;
- reveal gates;
- retrieval profile;
- prompt profile;
- passive assets;
- author notes.

Package overlays should not modify bundled Loredecks directly. They should layer on top of them in a playthrough snapshot.

## Playthrough Projection

Starting a Story Package should create a snapshot:

```json
{
  "id": "playthrough-20260630-0001",
  "packageId": "story-package-hp-year-2-diary-mystery",
  "packageVersion": "1.0.0",
  "activeLoredeckStack": ["hp-core", "hp-year-2-chamber-of-secrets"],
  "contextDefaults": {},
  "sessionFacts": [],
  "sourceLedgerId": "source-ledger-20260630-0001",
  "continuityGraphOverlayId": "graph-overlay-20260630-0001",
  "promptProfile": "story_package_default",
  "createdAt": "2026-06-30T18:25:00.000Z"
}
```

The snapshot is user runtime state. The package remains reusable content.

## Story Maker Integration

Story Maker should support three starting modes:

1. Direct prompt from current active Loredeck stack.
2. Story Package selection.
3. Selected source frame or chat text.

When a Story Package is selected, Story Maker should:

- load required Loredecks or report missing requirements;
- use package opener seeds;
- include package scenario facts in the context packet;
- respect package reveal gates and player assumptions;
- generate opener variants with model-call role `story.openerDraft`;
- record source and package provenance.

## Deck Maker Integration

Deck Maker should be able to generate either:

- a Loredeck;
- a Story Package;
- a Loredeck plus a companion Story Package.

Generated Story Packages should remain drafts until accepted. Package generation uses different validation from Lorecard drafting because it composes existing content and session setup.

## Storage And Import/Export

Story Packages should use the same flat-file storage principles as Loredecks:

```text
saga-story-package-index.v1.json
saga-story-package-<packageId>.v1.json
saga-story-package-asset-<packageId>-cover-<hash>.png
saga-playthrough-index.v1.json
saga-playthrough-<playthroughId>.v1.json
```

Export format should be data-only:

```text
manifest.json
story-packages/
  hp-year-2-diary-mystery/
    story-package.json
    assets/
      cover.png
loredecks/
  optional referenced custom decks
```

Bundled package exports should reference bundled Loredecks by manifest identity instead of duplicating all bundled payloads unless the user explicitly exports a self-contained archive.

## UI Surface

Library should gain a Story Packages view or section:

- package shelf;
- required Loredeck readiness;
- start package;
- duplicate/customize;
- export/import;
- package details;
- opener seeds;
- package health.

Story Maker should show package context without turning the first screen into a marketing page. The useful first screen is package selection or opener workflow.

## Loredeck And Lorecard Implications

Loredecks should gain package compatibility metadata:

- `suggestedStoryPackageRoles`;
- `compatiblePackageIds`;
- `packageOverlayPolicy`;
- `requiredByPackageIds` for bundled curated sets;
- `scenarioSafe` flags where appropriate.

Lorecards should distinguish reusable canon from package/session overlay. A package-specific Lorecard can be valid inside the package without being merged into a general fandom Loredeck.

## Required Updates

Implementation of this addendum will require updates to:

- new `F:\git\Saga\src\story-packages`;
- Story Maker state and generation;
- storage domain indexes;
- Library UI and package install/export services;
- prompt/context packet builder;
- retrieval profiles;
- continuity graph overlays;
- Loredeck schema and Pack Health;
- user docs for Story Maker and Library.

## Verification

The slice is complete when:

1. A bundled Story Package can reference bundled Loredecks and start a playthrough snapshot.
2. Missing required Loredecks produce a clear readiness report.
3. Package overlays do not mutate reusable Loredecks.
4. Story Maker can draft openers from a package.
5. Export/import round trips package metadata and passive assets.
6. Prompt projection can include package setup with source/provenance.

