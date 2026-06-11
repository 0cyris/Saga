# Saga Loredeck Schema Reference

**SAGA: Fandom Loresystem.**

## Status

This is the working schema and product/data contract for Saga Loredecks. It is still evolving with the extension, but it is no longer stored with broad development notes because deck authors need a stable place to find the contract.

Terminology note: public-facing Saga language is now **Loredeck**, **Lorecard**, **Context**, and **Pack Health**. The three public package type labels are **Bundled Lorepack**, **Generated Lorepack**, and **Custom Lorepack**. Internal implementation identifiers such as `packId` remain explicit until Saga has a separate deck-id migration plan.

The goal is to define enough structure for:

- A Loredeck loader.
- A Loredeck stack.
- Deck-aware Context.
- Tags.
- Pack Health.
- Import, export, and update metadata.
- Future Loredeck editing and generation.

This document is not final JSON Schema syntax yet. It is the product and data contract the implementation and bundled reference decks should target.

## Design Goals

Saga Loredecks should be:

- Pure data. No executable code in decks.
- Portable across local files, zip imports, URLs, and GitHub.
- Editable by users.
- Searchable and filterable.
- Deck-stack aware.
- Context-aware.
- Context-native instead of dependent on legacy entry-local date gates.
- Strict enough to load safely.
- Flexible enough for fandoms without exact dates.

## User-Facing Lorepack Types

Saga exposes only three public Lorepack type labels over the internal `type` values:

- `bundled`: **Bundled Lorepack**, shipped with Saga and human-vetted.
- `generated`: **Generated Lorepack**, created by Saga's Loredeck Creator and not human-vetted by default.
- `custom`: **Custom Lorepack**, user-made, user-shared, imported, duplicated, AU, crossover, or original.

Internal metadata may record source, derivation, update URLs, generation details, and local modifications, but the UI should still classify the deck using only these three Lorepack types.

## Suggested File Layout

Bundled Lorepacks should live under `content/loredecks/`.

```text
content/
  loredecks/
    hp-golden-trio/
      loredeck.json
      assets/
        cover.png
        banner.png
      taxonomy.json
      tags.json
      entities.json
      timeline.json
      resolver.json
      gate-types.json
      scoring.json
      chronology/
      characters/
      knowledge_gates/
      future_guards/
      user/
```

Custom and Generated Lorepacks may eventually live in a user data location managed by SillyTavern or Saga. The loader should not assume every pack is bundled with the extension.

User-shared bundles should eventually use a zip container so JSON and passive image assets can travel together:

```text
manifest.json
loredecks/
  arlong-park/
    loredeck.json
    assets/
      cover.png
themes/
  sea-map-odyssey/
    theme.json
iconsets/
  saga-hero/
    icons.json
    hero-tab-loredecks-256.png
    hero-tab-lorecards-256.png
  saga-mystic/
    icons.json
    mystic-tab-loredecks-256.png
  saga-relay/
    icons.json
    relay-tab-loredecks-256.png
    icons.json
    256/
      loredecks.png
      lorecards.png
```

Bundle contents remain data-only: JSON and passive images. No scripts, HTML, executables, absolute paths, or `../` traversal paths should be accepted.

## Core Files

Every Loredeck should have:

- `loredeck.json`
- one or more entry files listed by `loredeck.json`

Recommended registries:

- `tags.json`
- `entities.json`
- `timeline.json`
- `resolver.json`
- `taxonomy.json`
- `gate-types.json`
- `scoring.json`

Optional passive assets:

- `assets/cover.png` or another image referenced by `assets.cover`.
- `assets/banner.png` or another image referenced by `assets.banner`.

Deck assets are display-only. They must not contain executable code. Saga should initially allow `.png`, `.jpg`, `.jpeg`, and `.webp`; SVG should stay out of the MVP unless a sanitizer is added.

Existing Saga packs can start with `loredeck.json` plus the current entry files and registries.

## loredeck.json

`loredeck.json` is the package manifest. It tells Saga what the pack is, how to display it, which files to load, which registries to use, and where update metadata lives.

### Required Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | number | Loredeck manifest schema version. MVP should start at `1`. |
| `id` | string | Stable globally unique pack ID. |
| `type` | string | `bundled`, `generated`, or `custom`. |
| `title` | string | Human-facing pack title. |
| `description` | string | Short human-facing description. |
| `version` | string | Pack version. Semver preferred. |
| `files` | string[] | Entry files relative to this manifest. |

### Recommended Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `fandom` | string | Fandom or setting name. |
| `era` | string | Era, scope, adaptation, arc, or continuity range. |
| `contentKind` | string | Internal content shape, such as `fandom`, `setting`, `scenario`, or `mechanics`. |
| `author` | string | Creator or maintainer. |
| `defaultLocale` | string | Locale code, usually `en`. |
| `tags` | string[] | Pack-level tags. |
| `registries` | object | Relative paths to registry files. |
| `resolver` | string | Relative path to resolver metadata. |
| `continuity` | object | Continuity, adaptation, or canon-tier metadata for the pack. |
| `runtimeDefaults` | object | Default retrieval/trigger/injection behavior for imported or keyword-heavy packs. |
| `assets` | object | Optional display assets such as a Deck Cover or banner. Paths are relative to `loredeck.json` unless they use a bundled Saga path, data image URL, or remote image URL. |
| `compatibility` | object | Saga schema compatibility range. |
| `stats` | object | Optional cached entry/category counts. |

### Optional Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | object | Import/source metadata. |
| `update` | object | Update-check metadata. |
| `derivedFrom` | object | Source pack metadata if this pack was duplicated or generated from another pack. |
| `manifestData` | object | Library-only embedded manifest metadata for virtual Custom duplicates before durable local storage exists. |
| `entryOverrides` | object | Library-only map of edited or added Lorecards keyed by entry ID. |
| `disabledEntryIds` | string[] | Library-only source entry IDs suppressed by this Custom Lorepack. |
| `timelineRegistry` | object | Library-only Custom/Generated Lorepack timeline overlay for accepted anchor/window edits before durable pack-folder writes exist. |
| `tagRegistry` | object | Library-only Custom/Generated Lorepack tag overlay for accepted tag definition edits before durable pack-folder writes exist. |
| `pendingChanges` | object[] | Library-only review queue for proposed Loredeck edits that have not been accepted yet. |
| `generatedBy` | object | Loredeck Creator metadata. |
| `license` | object | Pack license and usage notes. |
| `health` | object | Last known Pack Health summary. |
| `dependencies` | object[] | Optional pack compatibility hints. |
| `extensions` | object | Future or creator-specific metadata. |

### Manifest Example

```json
{
  "schemaVersion": 1,
  "id": "hp-golden-trio",
  "type": "bundled",
  "title": "Harry Potter: Golden Trio",
  "description": "Chronology, knowledge gates, future guards, spells, ages, behavior, and event constraints for the seven-book Harry Potter era.",
  "fandom": "Harry Potter",
  "era": "Golden Trio",
  "contentKind": "fandom",
  "author": "Saga",
  "version": "1.0.0",
  "defaultLocale": "en",
  "tags": [
    "fandom:harry-potter",
    "era:golden-trio",
    "structure:school-year",
    "quality:human-vetted"
  ],
  "source": {
    "kind": "bundled",
    "url": ""
  },
  "update": {
    "checkForUpdates": false,
    "url": "",
    "lastCheckedAt": 0
  },
  "registries": {
    "taxonomy": "taxonomy.json",
    "tags": "tags.json",
    "entities": "entities.json",
    "timeline": "timeline.json",
    "gateTypes": "gate-types.json",
    "scoring": "scoring.json"
  },
  "resolver": "resolver.json",
  "assets": {
    "cover": {
      "path": "assets/cover.png",
      "alt": "Deck Cover for Harry Potter: Golden Trio",
      "aspect": "3:4",
      "focalPoint": {
        "x": 0.5,
        "y": 0.42
      }
    },
    "banner": {
      "path": "assets/banner.png",
      "alt": "Wide banner for Harry Potter: Golden Trio"
    }
  },
  "continuity": {
    "continuityId": "hp-books",
    "canonTier": "primary",
    "adaptation": "book",
    "sourceBoundary": "Seven-book Golden Trio era"
  },
  "runtimeDefaults": {
    "scanDepth": null,
    "recursiveTriggers": false,
    "tokenBudget": null
  },
  "files": [
    "chronology/school_years.json",
    "knowledge_gates/core_knowledge_gates.json",
    "future_guards/major_spoilers.json"
  ],
  "compatibility": {
    "sagaSchemaMin": 1,
    "sagaSchemaMax": 1
  },
  "stats": {
    "entryCount": 0,
    "categoryCounts": {}
  }
}
```

## Deck IDs

Deck IDs should be stable and lowercase.

Recommended pattern:

```text
fandom-scope
```

Examples:

```text
hp-golden-trio
hp-hogwarts-legacy
mcu-infinity-saga
sw-legends-new-republic
star-trek-tng-ds9-voy
my-hp-sw-crossover
```

Saga should warn when two loaded packs share a pack ID. It should not try to silently merge them.

## Source And Update Metadata

Source metadata is internal and should not create extra user-facing pack types.

### Source Kinds

Suggested `source.kind` values:

- `bundled`
- `local_json`
- `local_zip`
- `url`
- `github`
- `generated`
- `unknown`

### GitHub Source Example

```json
{
  "source": {
    "kind": "github",
    "url": "https://github.com/example/saga-pack-mcu",
    "ref": "main",
    "path": ""
  },
  "update": {
    "checkForUpdates": true,
    "url": "https://github.com/example/saga-pack-mcu",
    "strategy": "manifest_version",
    "lastCheckedAt": 0,
    "lastKnownVersion": "1.2.0",
    "lastKnownHash": ""
  }
}
```

### Local Modification Metadata

```json
{
  "localState": {
    "modified": true,
    "modifiedAt": 0,
    "baseContentHash": "",
    "currentContentHash": ""
  }
}
```

If a user edits an imported Custom Lorepack, Saga should mark it as locally modified and avoid overwriting it during updates without explicit confirmation.

### Virtual Custom Duplicates

Before full local zip/folder storage exists, Saga may represent a duplicated pack as a Custom library record that stores:

- `manifest`: the source manifest path used as the file-resolution base.
- `manifestData`: an embedded manifest copy with the new Custom `id`, type, title, tags, and derivation metadata.
- `derivedFrom`: the source pack ID, title, version, manifest path, and duplicate timestamp.

The UI still shows this as a Custom Lorepack. The virtual duplicate is loadable because entry files resolve relative to the source manifest, while runtime pack identity comes from `manifestData.id`.

### Custom Editable Layers

Before Saga can write durable local pack folders, a Custom Lorepack may store accepted edits in its library record:

```json
{
  "entryOverrides": {
    "entry_id": {
      "id": "entry_id",
      "title": "Edited or added lore entry",
      "fact": "The custom fact or override text."
    }
  },
  "disabledEntryIds": ["source_entry_id"],
  "timelineRegistry": {
    "schemaVersion": 1,
    "timelineMode": "hybrid",
    "sortKeyScale": "pack_local",
    "anchors": [
      {
        "id": "custom.arc.start",
        "label": "Custom arc begins",
        "sortKey": 100
      }
    ],
    "windows": [
      {
        "id": "custom.arc.full",
        "label": "Custom arc",
        "anchorFrom": "custom.arc.start",
        "anchorTo": "custom.arc.end",
        "sortKeyFrom": 100,
        "sortKeyTo": 200
      }
    ],
    "disabledAnchorIds": ["source.anchor.to_suppress"],
    "disabledWindowIds": []
  },
  "pendingChanges": [
    {
      "schemaVersion": 1,
      "changeId": "lpchg_upsert_entry_...",
      "status": "pending",
      "source": "manual",
      "action": "upsert_entry",
      "targetKind": "entry",
      "title": "Save entry: Edited lore",
      "affectedEntryIds": ["entry_id"],
      "payload": {
        "entryOverrides": {
          "entry_id": {}
        },
        "disabledEntryIdsRemove": ["entry_id"]
      }
    }
  ]
}
```

When loading a pack, Saga applies `entryOverrides` before Pack Health and canon database normalization. An override with the same ID as a source entry replaces that entry for this Custom Lorepack. An override with a new ID becomes an added entry. A disabled entry ID suppresses the matching source entry.

`timelineRegistry` overlays source `timeline.json`: custom anchors/windows with the same ID replace source definitions, new IDs extend the timeline, and `disabledAnchorIds` / `disabledWindowIds` suppress source definitions. Accepted timeline overlays affect Pack Health, Context search, resolver behavior, and runtime Context gating.

`pendingChanges` are not applied during loading. They are accepted or rejected in the Loredeck editor. Accepting a pending change applies its record patch into `entryOverrides`, `disabledEntryIds`, `timelineRegistry`, and/or `tagRegistry`; rejecting it removes the proposal without changing runtime-active lore.

Pending change `source` should identify the proposer, such as `manual`, `bulk_edit`, `safe_repair`, or `lore_assistant`. Assistant-sourced proposals use the same record-patch payload shape as manual edits and remain inactive until accepted.

## Dependencies

Dependencies are advisory in MVP.

They help Saga warn users when a Custom Lorepack expects another pack to be loaded.

```json
{
  "dependencies": [
    {
      "packId": "hp-golden-trio",
      "versionMin": "1.0.0",
      "versionMax": "",
      "required": false,
      "reason": "This custom crossover pack references Harry Potter tags and anchors."
    }
  ]
}
```

Missing optional dependencies should be warnings. Missing required dependencies can be errors for that pack's advanced features, but should not crash Saga.

## Entry Files

Entry files keep the existing Saga wrapper style.

```json
{
  "schemaVersion": 3,
  "entries": []
}
```

Saga reference packs should use entry file `schemaVersion: 3`. Schema v3 entries use `context` for Context eligibility and should not store legacy entry-local `date`, `validFrom`, `validTo`, or `canonTiming` gates.

## Lorecard Schema

Saga v3 entries are Context-native. Dates may still exist in `timeline.json` as resolver coordinates, but entry eligibility belongs in `context`.

### Required Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable entry ID within the pack. |
| `title` | string | Short human-facing title. |
| `category` | string | User-facing category. |
| `priority` | number | Priority inside the same relevance tier. |
| `content.fact` | string | Human-readable fact or constraint. |
| `content.injection` | string | Model-facing prompt text. Falls back to fact if missing. |

### Recommended Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | number | Entry schema version. |
| `kind` | string | Behavior or gate kind. |
| `relevance` | string | `high`, `normal`, or `low`. |
| `canon` | string | `canon` or `au`. |
| `lorePurpose` | string | Specific lore purpose. |
| `specificityScore` | number | 0 to 100 quality/specificity score. |
| `injectableByDefault` | boolean | Whether the entry should be considered for injection. |
| `truthStatus` | string | `true`, `hidden`, `rumor`, etc. |
| `revealPolicy` | string | Reveal behavior. |
| `tags` | string[] | Search/scoring tags. |
| `triggers` | object | Keyword, constant, probability, and recursive activation hints. |
| `scope` | object | Characters, locations, topics, objects, spells, factions, etc. |
| `context` | object | Saga Context eligibility. |
| `coordinates` | object[] | Multi-axis Context coordinates. |
| `retrieval` | object | Activation and frequency hints after Context eligibility passes. |
| `continuity` | object | Entry-level continuity, adaptation, route, or canon-tier metadata. |
| `ability` | object | Generic ability-system metadata for spells, quirks, jutsu, Force abilities, cyberware, etc. |
| `template` | object | Placeholder/template variable metadata for imported lorebook entries. |
| `visibility` | object | Who knows what and when. |
| `effects` | object | Search, blocking, protection, or injection effects. |
| `sourceInfo` | object | Work/source metadata. |
| `ui` | object | Display metadata. |
| `extensions` | object | Future metadata. |

### Categories

Use the existing supported category values for MVP:

```json
[
  "character",
  "event",
  "location",
  "item",
  "spell",
  "faction",
  "relationship",
  "rule",
  "timeline",
  "knowledge",
  "secret",
  "other"
]
```

`spell` should remain supported for Saga compatibility. Later Saga may add a generic `ability` category, with `spell` as a fandom-specific specialization or alias.

### Reserved Future Categories

Saga should reserve, but not necessarily expose in MVP, these broader categories:

```json
[
  "ability",
  "mechanic",
  "scenario",
  "style",
  "organization",
  "species",
  "technology"
]
```

These are important for non-HP packs:

- `ability`: Quirks, jutsu, cursed techniques, Devil Fruits, Haki, Force powers, cyberware, spells.
- `mechanic`: Pokemon type rules, game stats, TTRPG systems, combat mechanics.
- `scenario`: Operator themes, mission setups, roleplay premises, custom campaigns.
- `style`: Imported style or prose-guidance lorebooks that are not Saga's primary focus but may appear in imported packs.

Until the UI supports these directly, packs can store them as tags, `kind`, `lorePurpose`, or `extensions`.

### Lore Purposes

Use the existing specific-lore purpose set:

```json
[
  "temporal_gate",
  "knowledge_gate",
  "ability_gate",
  "status_change",
  "event_anchor",
  "branch_fact",
  "relationship_state",
  "secret",
  "objective",
  "item_state",
  "location_state",
  "rule_constraint",
  "behavior_constraint",
  "age_gate"
]
```

These are more important than categories for Pack Health and generated pack quality.

## Content Kind

`contentKind` is manifest-level metadata. It is not a user-facing Loredeck type.

It describes what sort of content the pack mainly contains.

Suggested values:

```json
[
  "fandom",
  "setting",
  "scenario",
  "characterbook",
  "mechanics",
  "style",
  "mixed"
]
```

Saga's main focus is canon with stories, so `fandom` and `setting` packs are the primary target. However, imported lorebook ecosystems also contain operator themes, RPG systems, prose styles, and scenario packs. `contentKind` lets Saga represent those without pretending every pack is a story-canon pack.

Example:

```json
{
  "contentKind": "scenario",
  "fandom": "Call of Duty",
  "era": "Modern military operator theme"
}
```

This can be useful as a Custom Lorepack, but Saga should not treat it as strongly Context-driven unless the pack defines an actual campaign/story timeline.

## Continuity Block

`canon: canon|au` is intentionally simple for the user-facing card model. It is not enough for major multimedia fandoms.

Use `continuity` for deeper metadata about adaptation, canon tier, route, game path, or source family.

### Continuity Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `continuityId` | string | Stable continuity ID, such as `mcu`, `dc-batfamily`, `star-wars-legends`, or `naruto-manga`. |
| `canonTier` | string | `primary`, `secondary`, `filler`, `legends`, `expanded`, `fanon`, `au`, or pack-defined tier. |
| `adaptation` | string | `book`, `film`, `comics`, `manga`, `anime`, `game`, `novel`, `show`, `ttrpg`, etc. |
| `medium` | string | Optional broader medium label. |
| `route` | string | Game route, ending, lifepath, romance route, or branch. |
| `sourceBoundary` | string | Human-readable boundary, such as "Manga through Shibuya Incident". |
| `variantOf` | string | Parent continuity or adaptation ID. |
| `notes` | string | Human-readable clarification. |

### Continuity Example

```json
{
  "continuity": {
    "continuityId": "cyberpunk-2077-game",
    "canonTier": "primary",
    "adaptation": "game",
    "route": "streetkid",
    "sourceBoundary": "Base game before Phantom Liberty",
    "notes": "Quest and ending state may vary by user-selected route."
  }
}
```

This is important for:

- Marvel: MCU versus comics versus animated continuities.
- DC/Batfamily: Post-Crisis, New 52, Rebirth, fanon Batfamily blends.
- Star Wars: Legends versus Disney canon.
- Naruto/One Piece/JJK/Chainsaw Man: manga versus anime, filler, movie continuity.
- Cyberpunk 2077: lifepath, quest state, endings, Edgerunners, TTRPG lore.

## Trigger Block

Saga's local canon suggestions should be Context and relevance driven, but imported lorebooks often rely on keyword triggers. Saga should preserve these semantics.

`triggers` allows Chub/SillyTavern/NovelAI-style lorebooks to import cleanly and gives Custom Lorepacks a precise activation layer when Context is not enough.

### Trigger Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `keywords` | string[] | Primary trigger keywords. |
| `secondaryKeywords` | string[] | Optional secondary required/context keywords. |
| `excludeKeywords` | string[] | Keywords that suppress activation. |
| `logic` | string | `any`, `all`, `keyword_and_secondary`, `expression`, or `manual`. |
| `expression` | string | Optional expression for advanced trigger logic. |
| `caseSensitive` | boolean | Whether keyword case must match. |
| `wholeWord` | boolean | Whether keyword should match whole words only. |
| `recursive` | boolean | Whether this entry can trigger additional scans. |
| `constant` | boolean | Whether the entry is always eligible when pack/context gates pass. |
| `probability` | number | 0 to 1 activation probability for imported systems that support it. |
| `scanDepth` | number/null | Message depth override. |
| `tokenBudget` | number/null | Entry-specific token budget hint. |
| `insertionOrder` | number | Imported lorebook insertion ordering hint. |
| `matchTags` | string[] | Tags that can act as semantic triggers. |

### Trigger Example

```json
{
  "triggers": {
    "keywords": [
      "Sokovia Accords",
      "Civil War"
    ],
    "secondaryKeywords": [
      "Tony Stark",
      "Steve Rogers"
    ],
    "excludeKeywords": [],
    "logic": "any",
    "caseSensitive": false,
    "wholeWord": true,
    "recursive": false,
    "constant": false,
    "probability": 1,
    "scanDepth": null,
    "tokenBudget": null,
    "insertionOrder": 100,
    "matchTags": [
      "event:sokovia-accords"
    ]
  }
}
```

Saga should treat triggers as one input to relevance and suggestion, not as a replacement for Context.

### Entry Example

```json
{
  "schemaVersion": 3,
  "id": "mcu_wanda_public_after_sokovia",
  "title": "Wanda Known After Sokovia",
  "kind": "knowledge_gate",
  "category": "character",
  "relevance": "normal",
  "canon": "canon",
  "lorePurpose": "knowledge_gate",
  "specificityScore": 82,
  "injectableByDefault": true,
  "truthStatus": "true",
  "revealPolicy": "private",
  "priority": 75,
  "context": {
    "scope": "window",
    "validFromAnchor": "mcu.age_of_ultron",
    "validToAnchor": "mcu.civil_war",
    "sortKeyFrom": 2200,
    "sortKeyTo": 2600,
    "precision": "anchor_window",
    "windowKind": "bounded",
    "label": "After Age of Ultron, before Civil War"
  },
  "scope": {
    "characters": [
      "Wanda Maximoff"
    ],
    "locations": [
      "Sokovia"
    ],
    "topics": [
      "Avengers",
      "Sokovia incident"
    ],
    "objects": [],
    "spells": [],
    "factions": [
      "Avengers"
    ]
  },
  "tags": [
    "character:wanda-maximoff",
    "event:sokovia",
    "knowledge:public",
    "mcu:phase-2"
  ],
  "retrieval": {
    "activation": "topic_or_entity",
    "frequency": "normal",
    "contextBoost": "medium",
    "triggers": {
      "charactersAny": [
        "Wanda Maximoff"
      ],
      "topicsAny": [
        "Avengers",
        "Sokovia incident"
      ]
    }
  },
  "content": {
    "fact": "After Sokovia, Wanda Maximoff is publicly associated with the Avengers and the Sokovia incident.",
    "injection": "After Sokovia, treat Wanda Maximoff as publicly associated with the Avengers and the Sokovia incident unless this story established otherwise.",
    "constraints": [
      "Before this point, ordinary civilians should not casually know Wanda as an Avenger."
    ],
    "antiLore": [
      "Do not treat the Sokovia Accords as enacted law before Civil War."
    ],
    "notes": ""
  },
  "sourceInfo": {
    "work": "Marvel Cinematic Universe",
    "sourceType": "film",
    "title": "Avengers: Age of Ultron",
    "confidence": 0.85,
    "notes": "Generated or authored as a Context gate, not a full plot summary."
  },
  "extensions": {}
}
```

## Timeline Calendar Coordinates

Calendar dates belong in `timeline.json`, not in entry-local gates.

```json
{
  "id": "hp.ootp.year_5",
  "label": "Year 5: Order of the Phoenix",
  "contextType": "calendar",
  "sortKey": 9374,
  "dateRange": {
    "from": "1995-09-01",
    "to": "1996-08-31"
  },
  "book": "Order of the Phoenix",
  "schoolYear": "5"
}
```

This lets users pick a date while keeping the entry schema Context-native.

## Context Eligibility Block (`context`)

`context` is the Saga Context eligibility block. Reference Loredecks should define it on every entry.

Implementation status: entries normalize and preserve `context` metadata, Saga evaluates Context gates against active Loredeck Context, retrieval/scoring now uses those gates, and suggested/pending lore cards display source plus Context/gating chips.

### `context` Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `scope` | string | `anchor`, `window`, or `global`; validity breadth, not injection frequency. |
| `anchorId` | string | Entry applies at one anchor. |
| `validFromAnchor` | string | Entry starts at or after this anchor. |
| `validToAnchor` | string | Entry applies until this anchor. |
| `arc` | string | Named story arc or normalized arc label. |
| `arcId` | string | Entry applies during this arc. |
| `phase` | string | Named phase or era label. |
| `phaseId` | string | Entry applies during this phase. |
| `season` | number/string | TV-style season. |
| `episode` | number/string | TV-style episode. |
| `chapter` | number/string | Book, manga, webnovel, or comic chapter. |
| `issue` | number/string | Comic issue or run context. |
| `quest` | string | Game quest, mission, route, or scenario marker. |
| `gameStage` | string | Broader game progression stage. |
| `stardateFrom` | string/number | Star Trek-style lower bound. |
| `stardateTo` | string/number | Star Trek-style upper bound. |
| `sortKeyFrom` | number | Normalized lower sort bound. |
| `sortKeyTo` | number | Normalized upper sort bound. |
| `precision` | string | `anchor`, `anchor_window`, `arc`, `phase`, etc. |
| `windowKind` | string | Optional breadth hint such as `event`, `bounded`, `school_year`, `wide`, `series`, or `era`. |
| `label` | string | Human-readable display label. |

### `context` Example

```json
{
  "context": {
    "scope": "window",
    "validFromAnchor": "mcu.age_of_ultron",
    "validToAnchor": "mcu.civil_war",
    "phase": "Phase 3",
    "sortKeyFrom": 2200,
    "sortKeyTo": 2600,
    "precision": "anchor_window",
    "windowKind": "bounded",
    "label": "After Age of Ultron, before Civil War"
  }
}
```

Accepted aliases during normalization include `anchorFrom` for `validFromAnchor`, `anchorTo` for `validToAnchor`, and `contextType` or `type` for `precision`.

### Context-Native Rule

Schema v3 entries should use `context` as the eligibility gate.

Calendar dates should live in `timeline.json` as resolver coordinates. A user can pick a date, Saga resolves that date to Loredeck Context, and entries match by Context ranges, anchors, or coordinates.

Wide Context windows mean "valid here," not "inject often." Wide entries should pair `context.windowKind: "wide"` or `"series"` with conservative `retrieval` metadata.

```json
{
  "context": {
    "scope": "window",
    "sortKeyFrom": 7913,
    "sortKeyTo": 10469,
    "precision": "date_window",
    "windowKind": "wide",
    "label": "Golden Trio Hogwarts Years"
  },
  "retrieval": {
    "activation": "topic_or_entity",
    "frequency": "low",
    "contextBoost": "low"
  }
}
```

## Coordinates Block

`context` handles the common single-axis case. Some fandoms need multiple axes at the same time.

Use `coordinates` when an entry depends on more than one story dimension.

Examples:

- One Piece: arc plus pre/post-timeskip.
- Naruto: arc plus manga/anime/filler status.
- Cyberpunk 2077: quest state plus lifepath plus ending route.
- DC/Batfamily: continuity era plus family roster state.
- Genshin Impact: nation/archon quest chapter plus character story quest progress.
- Honkai: Star Rail: Trailblaze mission chapter plus world/planet.

### Coordinate Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `axis` | string | Coordinate axis, such as `arc`, `phase`, `adaptation`, `route`, `quest`, `power_stage`, or `roster_state`. |
| `id` | string | Stable coordinate ID. |
| `label` | string | Human-readable label. |
| `from` | string/number | Optional lower bound. |
| `to` | string/number | Optional upper bound. |
| `confidence` | number | Optional 0 to 1 confidence. |
| `required` | boolean | Whether this coordinate must match for eligibility. |

### Coordinates Example

```json
{
  "coordinates": [
    {
      "axis": "arc",
      "id": "one-piece.enies-lobby",
      "label": "Enies Lobby",
      "required": true
    },
    {
      "axis": "power_stage",
      "id": "one-piece.pre-timeskip",
      "label": "Pre-timeskip",
      "required": true
    },
    {
      "axis": "adaptation",
      "id": "manga",
      "label": "Manga continuity",
      "required": false
    }
  ]
}
```

Saga should not require all packs to use coordinates. They exist for fandoms whose story state is not a single clean date or anchor.

## Ability Block

`spell` is too Harry Potter-specific for Saga's broader target set.

Use `ability` for fandom power systems, skills, supernatural techniques, technology, cyberware, or game mechanics.

### Ability Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `system` | string | Power or ability system, such as `spell`, `quirk`, `jutsu`, `haki`, `devil_fruit`, `cursed_technique`, `force`, `cyberware`, `pokemon_move`, or `vision`. |
| `name` | string | Ability name. |
| `stage` | string | Training/mastery/progression stage. |
| `ownerEntityIds` | string[] | Entity IDs for known users/owners. |
| `requiredTags` | string[] | Tags needed for eligibility. |
| `constraints` | string[] | Ability limitations or plausibility rules. |
| `antiLore` | string[] | Common ability mistakes to prevent. |

### Ability Example

```json
{
  "ability": {
    "system": "quirk",
    "name": "One For All",
    "stage": "early_training",
    "ownerEntityIds": [
      "mha:midoriya-izuku"
    ],
    "constraints": [
      "Early Izuku cannot use One For All at full power without serious injury."
    ],
    "antiLore": [
      "Do not portray early Izuku as casually controlling One For All at 100%."
    ]
  }
}
```

This keeps HP spells, MHA Quirks, Naruto jutsu, One Piece Haki/Devil Fruits, JJK cursed techniques, Star Wars Force abilities, Pokemon moves, Genshin Visions, and Cyberpunk cyberware in one schema family.

## Template Block

Imported lorebooks may contain placeholders such as `{{char}}`, `{{user}}`, or SillyTavern/NovelAI-style variables.

Saga should preserve placeholders instead of stripping or blindly expanding them.

### Template Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `mode` | string | `sillytavern`, `novelai`, `generic`, or pack-defined mode. |
| `variables` | string[] | Known variables used by the entry. |
| `unsafeVariables` | string[] | Variables Saga should not expand automatically. |
| `preserveRaw` | boolean | Whether to preserve raw template syntax on export. |

### Template Example

```json
{
  "template": {
    "mode": "sillytavern",
    "variables": [
      "char",
      "user"
    ],
    "unsafeVariables": [],
    "preserveRaw": true
  }
}
```

Pack Health should warn about unknown or malformed variables, but imported packs should remain usable.

## Entity References

Entries may reference entities by ID through:

- `scope.entityIds`
- `ability.ownerEntityIds`
- `visibility.knownByEntityIds`
- `tags`
- `extensions`

Entity IDs are optional in MVP, but they will become important for serious Custom and Bundled Lorepacks.

Example:

```json
{
  "scope": {
    "entityIds": [
      "dc:bruce-wayne",
      "dc:batman"
    ],
    "characters": [
      "Bruce Wayne",
      "Batman"
    ]
  }
}
```

## tags.json

Tags are first-class search, filter, scoring, and health-check metadata.

### Tag ID Rules

Recommended tag ID format:

```text
namespace:value
```

Examples:

```text
fandom:harry-potter
era:ootp
hp:horcruxes
character:hermione-granger
sw:jedi
meta:crossover
meta:future-guard
```

Namespaces are not mandatory for all user-created packs, but Bundled Lorepacks should use namespaces consistently.

### Tag Registry Example

```json
{
  "schemaVersion": 1,
  "tags": {
    "hp:horcruxes": {
      "label": "Horcruxes",
      "color": "#4c1d95",
      "textColor": "#f3e8ff",
      "description": "Horcrux-related lore, knowledge gates, and spoiler guards.",
      "aliases": [
        "horcrux",
        "soul fragment"
      ],
      "parents": [
        "hp:dark-magic"
      ],
      "sensitive": true,
      "deprecated": false,
      "replacement": ""
    }
  }
}
```

### Tag Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `label` | string | Display label. |
| `color` | string | Chip background color. |
| `textColor` | string | Chip text color. |
| `description` | string | Tooltip/help text. |
| `aliases` | string[] | Search and resolver aliases. |
| `parents` | string[] | Parent tag IDs. |
| `sensitive` | boolean | Useful for spoilers/secrets. |
| `deprecated` | boolean | Whether the tag should be replaced. |
| `replacement` | string | Replacement tag ID. |

Undefined tags should be Pack Health warnings, not load blockers.

## entities.json

`entities.json` defines canonical entity IDs, names, aliases, and metadata.

Tags are good for search and grouping. Entities are better for identity.

This matters because major fandoms often have:

- Civilian names and hero names.
- Multiple titles.
- Transformed states.
- Team memberships.
- Family names.
- Aliases and epithets.
- Translation variants.
- Fandom shorthand.

Examples:

- Bruce Wayne / Batman.
- Izuku Midoriya / Deku.
- Monkey D. Luffy / Straw Hat Luffy.
- Anakin Skywalker / Darth Vader.
- Satoru Gojo / Gojo-sensei.
- Harry Potter / The Boy Who Lived.

### Entity Registry Example

```json
{
  "schemaVersion": 1,
  "entities": {
    "dc:bruce-wayne": {
      "type": "character",
      "label": "Bruce Wayne",
      "aliases": [
        "Batman",
        "The Dark Knight",
        "Master Bruce"
      ],
      "canonicalNames": [
        "Bruce Wayne",
        "Batman"
      ],
      "tags": [
        "character:bruce-wayne",
        "dc:batfamily",
        "role:vigilante"
      ],
      "relationships": [
        {
          "type": "identity_alias",
          "targetEntityId": "dc:batman"
        }
      ],
      "continuity": {
        "continuityId": "dc-batfamily",
        "canonTier": "primary"
      },
      "sourceInfo": {
        "work": "DC Comics",
        "confidence": 0.9
      }
    }
  }
}
```

### Entity Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | string | `character`, `location`, `faction`, `item`, `ability`, `species`, `technology`, `event`, etc. |
| `label` | string | Display name. |
| `aliases` | string[] | Search and resolver aliases. |
| `canonicalNames` | string[] | Important formal names. |
| `tags` | string[] | Entity tags. |
| `relationships` | object[] | Lightweight identity/team/family/ownership links. |
| `continuity` | object | Continuity metadata. |
| `sourceInfo` | object | Source metadata. |
| `extensions` | object | Future metadata. |

Entities should not be required for every Custom Lorepack. They should be strongly recommended for Bundled Lorepacks and generated canon-scale Lorepacks.

## timeline.json

`timeline.json` defines a pack-local Context axis.

It is the answer to fandoms that do not have hard dates.

### Timeline Modes

Allowed `timelineMode` values:

```json
[
  "calendar",
  "anchor",
  "anchor_window",
  "arc",
  "phase",
  "season_episode",
  "stardate",
  "relative",
  "hybrid"
]
```

Most packs should use `hybrid` once they support more than one coordinate style.

### Timeline Registry Example

```json
{
  "schemaVersion": 1,
  "timelineMode": "hybrid",
  "sortKeyScale": "pack_local",
  "anchors": [
    {
      "id": "mcu.age_of_ultron",
      "label": "Avengers: Age of Ultron",
      "sortKey": 2200,
      "dateRange": {
        "from": "2015",
        "to": "2015"
      },
      "aliases": [
        "Ultron",
        "Age of Ultron",
        "after Sokovia"
      ],
      "tags": [
        "mcu:phase-2",
        "event:sokovia"
      ],
      "sourceInfo": {
        "work": "Marvel Cinematic Universe",
        "sourceType": "film",
        "title": "Avengers: Age of Ultron"
      }
    },
    {
      "id": "mcu.civil_war",
      "label": "Captain America: Civil War",
      "sortKey": 2600,
      "dateRange": {
        "from": "2016",
        "to": "2016"
      },
      "aliases": [
        "Civil War",
        "Sokovia Accords"
      ],
      "tags": [
        "mcu:phase-3",
        "event:sokovia-accords"
      ],
      "sourceInfo": {
        "work": "Marvel Cinematic Universe",
        "sourceType": "film",
        "title": "Captain America: Civil War"
      }
    }
  ],
  "arcs": [],
  "phases": [
    {
      "id": "mcu.phase-2",
      "label": "MCU Phase Two",
      "sortKeyFrom": 2000,
      "sortKeyTo": 2999,
      "aliases": [
        "Phase 2",
        "Phase Two"
      ],
      "tags": [
        "mcu:phase-2"
      ]
    }
  ]
}
```

### Anchor Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable anchor ID. |
| `label` | string | Display label. |
| `sortKey` | number | Pack-local ordering key. |
| `dateRange` | object | Optional real or in-universe dates. |
| `aliases` | string[] | Local resolver aliases. |
| `tags` | string[] | Anchor tags. |
| `sourceInfo` | object | Source metadata. |
| `extensions` | object | Future metadata. |

### Sort Keys

`sortKey` is pack-local. It does not need to line up with other packs.

Recommended practice:

- Leave gaps between anchors.
- Use broad ranges for phases/arcs.
- Do not encode real dates directly unless that is useful for the pack.

Example:

```text
1000 = first major anchor
1100 = event after that anchor
2000 = next film/book/arc
```

### Runtime Context Index

Saga loads `registries.timeline` from each enabled Loredeck and builds a runtime Context Index.

The index is stack-aware:

- Packs are read in loaded Loredeck priority order.
- Each anchor keeps its `packId`, pack title, stack index, and pack priority.
- Anchor search is pack-local by default in the Context editor.
- Suggest Lore, preprocessing, and Relevance can later use the same index for deck-aware temporal promotion.

Missing `timeline.json` is allowed. Some Custom Lorepacks may be keyword-first, scenario-first, or still in early drafting. Pack Health may suggest adding timeline anchors, but Saga should not reject a pack only because it has no Context registry.

Timeline registries are not Lorecard files. They are compact resolver/index data used to help map phrases like `after Shibuya`, `Civil War era`, `Year 4`, `post-war`, or `before the Battle of Hogwarts` into normalized Loredeck Context fields.

## resolver.json

`resolver.json` tells Saga how to map user phrasing, headers, notes, and model output into a Loredeck Context.

### Resolver Example

```json
{
  "schemaVersion": 1,
  "summary": "Resolve chat context to an MCU Infinity Saga Context.",
  "preferredFields": [
    "phase",
    "film",
    "beforeAfter",
    "majorEvent"
  ],
  "ambiguousFallback": "use_window",
  "promptAddendum": "Prefer before/after film or major event windows over invented exact dates.",
  "localPatterns": [
    {
      "pattern": "before civil war",
      "result": {
        "anchorTo": "mcu.civil_war",
        "label": "Before Civil War"
      }
    },
    {
      "pattern": "after ultron",
      "result": {
        "anchorFrom": "mcu.age_of_ultron",
        "label": "After Age of Ultron"
      }
    }
  ],
  "modelOutputShape": {
    "contextType": "string",
    "sceneDate": "string",
    "anchorId": "string",
    "anchorFrom": "string",
    "anchorTo": "string",
    "label": "string",
    "branchId": "string",
    "confidence": "number",
    "summary": "string"
  }
}
```

### Context Resolution Order

Saga should resolve Context in this order:

1. Manual user selection.
2. Local exact/header/date/candidate matching.
3. Reasoner Provider resolution against bounded candidates.

Manual locks should prevent automatic overwrites.

### Reasoner Resolver Contract

Reasoner resolution should be bounded by the active Context Index and a shortlist of known Lorecard-derived Context candidates.

Saga should send the model:

- Current Context.
- Optional supporting user/header text.
- Target Loredeck IDs.
- Known timeline anchors/windows for those packs.
- Bounded Lorecard-derived Context candidates when useful.

The model should return only known target IDs, request clarification, or mark a pack unresolved.

Saga should reject:

- Anchor/window/Lorecard target IDs that do not exist in the target pack candidate set.
- Results below the confidence threshold.
- Results for locked packs.
- Invented dates, arcs, phases, or labels that do not map to known candidates.

This makes the model a resolver, not an authority. The Loredeck remains the source of timeline truth.

Local aliases remain useful for exact shortcuts, but Loredeck authors should not be expected to encode every casual phrase a fandom user might type. Large-fandom natural language belongs to the Reasoner path.

## taxonomy.json

`taxonomy.json` can mostly preserve the existing Saga taxonomy format.

It controls display labels, colors, and descriptions for:

- Categories.
- Canon statuses.
- Truth statuses.
- Reveal policies.

Saga should merge missing values with safe defaults.

Bundled Lorepacks should stay within Saga's supported category values unless the UI and normalizer are updated.

## gate-types.json

`gate-types.json` can preserve the existing Saga format.

It controls behavior-oriented `kind` metadata.

Example:

```json
{
  "schemaVersion": 2,
  "gateTypes": {
    "knowledge_gate": {
      "label": "Knowledge Gate",
      "description": "Controls who knows a fact and when.",
      "defaultPriority": 90,
      "injectionRole": "knowledge_constraint"
    }
  }
}
```

Saga should allow packs to define new gate types. New gate types may not have special logic unless Saga adds code support for them, but they can still display and score generically.

## scoring.json

`scoring.json` should extend the current Saga scoring format.

Existing fields:

```json
{
  "schemaVersion": 2,
  "weights": {
    "dateMatch": 30,
    "contextMatch": 30,
    "contextUnresolvedPenalty": -8,
    "characterMatch": 25,
    "locationMatch": 12,
    "topicMatch": 18,
    "priority": 15,
    "futureGuard": 20,
    "conflictPenalty": -50
  },
  "kindBoosts": {
    "future_guard": 20,
    "knowledge_gate": 18
  }
}
```

Saga additions:

```json
{
  "schemaVersion": 3,
  "weights": {
    "contextMatch": 30,
    "contextUnresolvedPenalty": -8,
    "anchorProximity": 16,
    "tagMatch": 18,
    "packStack": 10,
    "sourceConfidence": 8,
    "healthWarningPenalty": -4,
    "duplicatePenalty": -25
  },
  "packTypeBoosts": {
    "bundled": 4,
    "custom": 2,
    "generated": 0
  }
}
```

Current retrieval behavior:

- Entries with no `context` block are not valid schema v3 canon candidates.
- Entries with a matching `context` block qualify through the active Loredeck Context.
- A mismatched `context` block blocks the entry.
- An unresolved `context` block is not eligible for canon suggestions.
- Wide Context windows remain eligible but receive conservative Context boost and should require topic/entity retrieval.

These values are a draft. Pack stack order should influence tie-breaks and candidate ranking without making top packs blindly suppress useful lower-pack entries.

## Loredeck Stack State

The active stack is stored per chat, with future support for global defaults.

```json
{
  "loredeckStack": [
    {
      "packId": "my-hp-sw-crossover",
      "enabled": true,
      "priority": 300,
      "locked": false,
      "addedAt": 0
    },
    {
      "packId": "hp-golden-trio",
      "enabled": true,
      "priority": 200,
      "locked": false,
      "addedAt": 0
    },
    {
      "packId": "sw-legends-new-republic",
      "enabled": true,
      "priority": 100,
      "locked": false,
      "addedAt": 0
    }
  ]
}
```

The UI should present stack order rather than numeric priority.

Accepted story lore is not part of the Loredeck stack. It should always outrank Loredeck entries.

## Loredeck Context State

Each active Loredeck can have its own context.

```json
{
  "loredeckContexts": {
    "hp-golden-trio": {
      "schemaVersion": 1,
      "packId": "hp-golden-trio",
      "contextType": "calendar",
      "label": "Order of the Phoenix, Year 5",
      "sceneDate": "1995-10-31",
      "subjectiveDate": "",
      "contextSortKey": 9434,
      "contextSortKeyFrom": 9434,
      "contextSortKeyTo": 9434,
      "anchorId": "hp.ootp.year_5",
      "anchorFrom": "",
      "anchorTo": "",
      "arc": "Order of the Phoenix",
      "phase": "",
      "season": "",
      "episode": "",
      "chapter": "",
      "issue": "",
      "quest": "",
      "gameStage": "",
      "alias": "Year 5 Halloween",
      "notes": "",
      "branchId": "main",
      "confidence": 0.94,
      "manualLock": false,
      "source": "header",
      "updatedAt": 0
    },
    "mcu-infinity-saga": {
      "schemaVersion": 1,
      "packId": "mcu-infinity-saga",
      "contextType": "anchor_window",
      "label": "After Age of Ultron, before Civil War",
      "sceneDate": "",
      "subjectiveDate": "",
      "contextSortKey": 2400,
      "contextSortKeyFrom": 2200,
      "contextSortKeyTo": 2600,
      "anchorId": "",
      "anchorFrom": "mcu.age_of_ultron",
      "anchorTo": "mcu.civil_war",
      "arc": "",
      "phase": "Phase 3",
      "season": "",
      "episode": "",
      "chapter": "",
      "issue": "",
      "quest": "",
      "gameStage": "",
      "alias": "pre-Civil War",
      "notes": "",
      "branchId": "main",
      "confidence": 0.82,
      "manualLock": true,
      "source": "manual",
      "updatedAt": 0
    }
  }
}
```

`contextSortKey` is the best single-point estimate when Saga has one. `contextSortKeyFrom` and `contextSortKeyTo` define the selected runtime range when the user chooses `After` one waypoint and `Before` another. For exact starts, all three values may be the same. For approximate windows, entry gates compare against the selected range so Saga can allow lore that overlaps the chosen Context while blocking lore entirely outside it.

For Harry Potter, a picked date can resolve to a date-derived sort key while still preserving the chosen anchor/window label. Context-native entries can then use `context.sortKeyFrom` and `context.sortKeyTo` without every calendar day needing a named anchor.

### Context Sources

Suggested `source` values:

- `manual`
- `header`
- `local_alias`
- `model`
- `imported`
- `unknown`

### `context.type` Values

```json
[
  "calendar",
  "anchor",
  "anchor_window",
  "arc",
  "phase",
  "season_episode",
  "stardate",
  "relative",
  "hybrid",
  "custom"
]
```

### V1 State Rules

- `manualLock: true` means automated resolvers should not overwrite this pack context.
- Manual UI edits should set `source: "manual"` and confidence to `1` unless the user edits confidence directly.
- `label` is the human-readable display value. `alias` preserves user phrasing for later local alias matching.
- Empty media-coordinate fields are allowed. A fandom does not need to use season, episode, chapter, issue, quest, and date simultaneously.
- `branchId` defaults to `main` and can represent AU, crossover, time-travel, or custom continuity branches.

## Pack Health Report

Pack Health is advisory. It should not block packs for subjective quality issues.

Only technical load failures should be errors.

### Health Status Values

```json
[
  "unknown",
  "excellent",
  "good",
  "needs_review",
  "has_errors"
]
```

### Health Report Example

```json
{
  "schemaVersion": 1,
  "packId": "mcu-infinity-saga",
  "generatedAt": 0,
  "status": "good",
  "errors": [],
  "warnings": [
    {
      "code": "undefined_tag",
      "severity": "warning",
      "message": "Tag character:scarlet-witch is used but not defined.",
      "entryIds": [
        "mcu_wanda_public_after_sokovia"
      ],
      "file": "characters/wanda.json",
      "fix": "Define the tag or replace it with character:wanda-maximoff."
    }
  ],
  "suggestions": [
    {
      "code": "missing_scope",
      "severity": "suggestion",
      "message": "12 entries have no scope fields. Add characters, topics, or locations to improve retrieval.",
      "entryIds": []
    }
  ],
  "summary": {
    "entryCount": 420,
    "errorCount": 0,
    "warningCount": 8,
    "suggestionCount": 31,
    "tagRegistryTagCount": 120,
    "undefinedTagCount": 1,
    "deprecatedTagUsageCount": 0,
    "duplicateTagAliasCount": 0,
    "orphanedTagCount": 0,
    "malformedTagCount": 0,
    "duplicateEntryIdCount": 0,
    "longEntryCount": 4,
    "timelineAnchorCount": 120,
    "timelineWindowCount": 18,
    "contextGateCount": 250,
    "brokenAnchorReferenceCount": 0,
    "invalidContextWindowCount": 0,
    "unmatchableContextGateCount": 0
  }
}
```

### Health Codes For MVP

Errors:

- `invalid_json`
- `missing_manifest`
- `missing_pack_id`
- `missing_entry_id`
- `duplicate_entry_id`
- `missing_entry_file`
- `unsupported_schema`
- `schema_v3_legacy_timing_fields`
- `schema_v3_missing_context`
- `schema_v3_invalid_context_scope`
- `schema_v3_missing_context_sort_keys`
- `schema_v3_missing_context_precision`
- `schema_v3_missing_context_label`
- `schema_v3_missing_retrieval`
- `schema_v3_incomplete_retrieval`
- `schema_v3_missing_content`

Warnings:

- `duplicate_pack_loaded`
- `likely_duplicate_pack`
- `duplicate_manifest_file`
- `manifest_entry_count_mismatch`
- `manifest_category_counts_mismatch`
- `undefined_tag`
- `deprecated_tag_used`
- `duplicate_tag_alias`
- `malformed_tag_namespace`
- `tag_registry_invalid_ref`
- `tag_registry_load_failed`
- `tag_parent_missing`
- `deprecated_tag_replacement_missing`
- `unknown_entity_reference`
- `broken_anchor_reference`
- `invalid_date`
- `invalid_context_window`
- `unmatchable_context_gate`
- `context_timeline_invalid_ref`
- `context_timeline_load_failed`
- `timeline_anchor_sortkey_mismatch`
- `timeline_window_sortkey_mismatch`
- `duplicate_timeline_anchor_id`
- `schema_v3_wide_lore_retrieval`
- `invalid_trigger_expression`
- `unknown_template_variable`
- `missing_injection`
- `entry_too_long`
- `likely_wiki_summary`
- `weak_scope`
- `missing_dependency`

Suggestions:

- `missing_tags`
- `missing_entities`
- `missing_scope`
- `missing_triggers`
- `missing_resolver_aliases`
- `tag_registry_missing`
- `orphaned_tag_definition`
- `unnamespaced_bundled_tag`
- `context_gates_without_timeline`
- `context_timeline_empty`
- `broad_entry`
- `category_imbalance`
- `low_specificity`

Current Context health behavior:

- `broken_anchor_reference` warns when an entry or timeline window references an anchor not defined in the pack timeline registry.
- `invalid_context_window` warns when anchor sort order or explicit sort keys make a Context window start after it ends.
- `unmatchable_context_gate` warns when an anchor/window-only entry gate cannot match known timeline anchors.
- `timeline_anchor_sortkey_mismatch` and `timeline_window_sortkey_mismatch` warn when date-derived-day timelines drift from their date ranges.
- `context_gates_without_timeline` is a suggestion, not a warning, because Custom Lorepacks may be useful before they have a timeline registry.
- Missing or empty timeline registries never block pack loading.

Current schema v3 health behavior:

- Schema v3 entries must be Context-native and use `context` instead of legacy top-level date/timing fields.
- Schema v3 entries must include `content.fact`, `content.injection`, and retrieval metadata.
- Wide or global lore remains allowed, but Pack Health warns when it is not configured for conservative topic/entity retrieval.
- Manifest `stats.entryCount` and `stats.categoryCounts` are checked against loaded entries as warnings, not load blockers.
- Editor validation, validated Custom/Generated Lorepack export, and safe repair actions should call the same Pack Health rules as runtime loading.
- The Custom entry editor should expose Context fields, timeline anchor search/pickers, retrieval metadata, and bulk Context edits for schema v3 entries.
- The Tag Manager preserves namespaced entry tags, supports bulk add/remove/rename through Custom Lorepack override layers, loads source `tags.json` when declared, and stores editable Custom/Generated Lorepack tag definitions in an embedded `tagRegistry` layer.

Current tag health behavior:

- `undefined_tag` warns when entries use tags that are not defined by source `tags.json` or the embedded Custom/Generated Lorepack `tagRegistry` layer.
- `deprecated_tag_used` warns when entries still use a tag marked deprecated.
- `duplicate_tag_alias` warns when the same alias points at multiple tag definitions.
- `malformed_tag_namespace` warns when tag IDs or tag references have unsupported characters, whitespace, or incomplete namespace syntax such as `tag:`.
- `tag_parent_missing` and `deprecated_tag_replacement_missing` warn when registry relationships point at unknown tags.
- `tag_registry_missing` is a suggestion, not a warning, because imported or early Custom Lorepacks may use entry tags before defining `tags.json`.
- `orphaned_tag_definition` is a suggestion for registry definitions not used by entries or registry relationships.

## Import And Export Packages

Saga's current public Loredeck import/export format is a zip package with a `loredecks/` root inside the archive. The active development plan lives in [../development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md](../development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md).

Front-facing `.saga-loredeck.json` import/export was legacy interim behavior and should not appear in the Library UI. Public sharing should use `.saga-loredeck.zip` packages.

Preferred package extension:

```text
.saga-loredeck.zip
```

Preferred package shape:

```text
my-pack.saga-loredeck.zip
  saga-package.json
  loredecks/
    index.json
    my-pack-core/
      loredeck.json
      manifest.json
      tags.json
      timeline.json
      assets/
        cover.png
      entries/
        core.json
```

`loredecks/index.json` should list the package's included Loredecks and folder metadata. Package exports use a neutral `loredecks` array, and package import installs those decks as Custom user content.

Saga should reject zip entries that try to escape the package root with absolute paths, drive-letter paths, `..` traversal, NUL characters, or backslash-normalized traversal. Saga should also reject executable or active content inside Loredeck packages; packages are data-only containers.

## Loader Output

The loader should produce a normalized runtime object, separate from raw pack files.

```json
{
  "packId": "hp-golden-trio",
  "manifest": {},
  "registries": {
    "taxonomy": {},
    "tags": {},
    "entities": {},
    "timeline": {},
    "gateTypes": {},
    "scoring": {}
  },
  "entries": [],
  "health": {},
  "contentHash": "",
  "loadedAt": 0
}
```

The runtime object should annotate each normalized entry with:

```json
{
  "packId": "hp-golden-trio",
  "packType": "bundled",
  "packTitle": "Harry Potter: Golden Trio",
  "packPriority": 200
}
```

These fields can live under `extensions.sagaLoredeck` if we want to avoid polluting the top-level entry schema.

## Imported Lorebook Compatibility

Saga's native model is Context plus relevance-tiered injection.

Many public lorebook ecosystems are keyword-first. Saga should preserve those semantics during import instead of forcing everything into Context.

The schema should preserve common imported lorebook concepts:

- Primary keywords.
- Secondary keywords.
- Constant insertion.
- Selective insertion.
- Recursive scanning.
- Scan depth.
- Token budget.
- Insertion order.
- Case sensitivity.
- Whole-word matching.
- Activation probability.
- Template variables such as `{{char}}` and `{{user}}`.

These map mainly to:

- `triggers`
- `template`
- `runtimeDefaults`
- `priority`
- `content.injection`
- `extensions.import`

Example import metadata:

```json
{
  "extensions": {
    "import": {
      "sourceFormat": "chub_lorebook",
      "sourceEntryId": "12345",
      "originalKeys": {},
      "importedAt": 0
    }
  }
}
```

Imported keyword-heavy packs may not have Context data. That should be allowed. Pack Health can suggest adding Context gates without blocking the pack.

## Suggested extensions.sagaLoredeck Block

```json
{
  "extensions": {
    "sagaLoredeck": {
      "packId": "hp-golden-trio",
      "packType": "bundled",
      "packTitle": "Harry Potter: Golden Trio",
      "file": "knowledge_gates/core_knowledge_gates.json",
      "stackPriority": 200,
      "contentHash": "",
      "loadedAt": 0
    }
  }
}
```

## HP Golden Trio Migration Example

The old root `Lore/manifest.json` migration mapped to:

```text
content/loredecks/hp-golden-trio/loredeck.json
content/loredecks/hp-golden-trio/taxonomy.json
content/loredecks/hp-golden-trio/gate-types.json
content/loredecks/hp-golden-trio/scoring.json
content/loredecks/hp-golden-trio/chronology/
content/loredecks/hp-golden-trio/characters/
content/loredecks/hp-golden-trio/knowledge_gates/
...
```

The HP bundled family now lives under `content/loredecks/` and should remain the source of truth for bundled reference decks. Root `Lore/` fallback loading has been removed.

## Fandom Stress Test

The schema should be checked against popular roleplay universes before implementation hardens.

Saga's main target is canon with stories, but Custom Lorepacks may also represent themes, scenarios, mechanics, or looser settings.

| Universe | Saga Fit | Schema Pressure Points |
| --- | --- | --- |
| Call of Duty | Medium for theme/scenario packs, lower for canon-story packs. | `contentKind: scenario`, factions, operators, weapons, mission themes, low Context dependence. |
| My Hero Academia | High. | Arcs, school years, internships, hero names, Quirk progression, manga/anime/filler boundaries, entity aliases. |
| Marvel | High but complex. | MCU/comics/animated continuities, multiverse variants, phases, films, identities, teams, power systems. |
| DC / Batfamily | High but continuity-heavy. | Comic eras, fanon blends, aliases, family roster state, hero identities, city/location state. |
| Genshin Impact | High for story/setting packs. | Archon quests, nations, character story quests, Visions/elements, playable character unlock assumptions. |
| Resident Evil | High. | Game chronology, outbreak/location state, organizations, infection types, remakes versus originals. |
| Harry Potter | High and already proven by Saga. | Dates, school years, knowledge gates, spells, secrets, Marauders/Legacy era splits. |
| Wizarding World: Marauders / Legacy | High. | Era-separated packs, school years, character generations, game quest state, institutional state. |
| Star Wars | High. | Legends/Disney canon split, BBY/ABY dates, eras, factions, Force abilities, titles, locations. |
| Jujutsu Kaisen | High. | Manga/anime arcs, cursed techniques, domains, spoiler guards, character death/status changes. |
| Hazbin Hotel / Helluva Boss | Medium-high. | Series/episode context, Hell hierarchy, factions, character relationships, limited hard dates. |
| Demon Slayer | High. | Arcs, breathing styles, demon status, Corps ranks, spoiler/death guards. |
| Bungou Stray Dogs | High. | Organizations, ability names, arcs, aliases, manga/anime adaptation state. |
| FNAF | Medium-high but ambiguity-heavy. | Theories, timelines, game entries, animatronic identities, contested canon, route/ending variants. |
| Pokemon | Medium-high, depending on pack scope. | Regions, anime/game continuity, species/moves/types, mechanics, trainer parties, generational boundaries. |
| Honkai: Star Rail | High. | Trailblaze mission chapters, worlds/planets, factions, Aeons/Paths, character quest state. |
| Percy Jackson | High. | Book chronology, cabins, prophecy knowledge, gods/monsters, character age/status. |
| Sonic | Medium-high. | Game/comic/show continuities, zones, teams, transformations, loose chronology. |
| One Piece | High. | Arcs, islands, pre/post-timeskip, Devil Fruits, Haki, crews, bounties, spoiler/status guards. |
| Naruto | High. | Manga/anime/filler boundaries, arcs, villages, jutsu, kekkei genkai, ranks, team membership. |
| Arcane / League of Legends | High but continuity-sensitive. | Arcane versus League canon, regions, factions, champions, hextech/magic, season/act context. |
| ASOIAF / Game of Thrones | High. | Book/show split, houses, geography, political state, character death/status, prophecy knowledge. |
| Stranger Things | High. | Seasons, episode context, Upside Down knowledge, character status, Hawkins location state. |
| Cyberpunk 2077 | High for game-story packs. | Lifepath, quest state, endings, Edgerunners/TTRPG continuity, cyberware, factions. |
| Chainsaw Man | High. | Manga arcs, Devil contracts, Public Safety state, character death/status, spoiler guards. |
| Undertale / Deltarune | Medium-high. | Routes, timelines/resets, chapters, player choices, alternate worlds, entity aliases. |

Schema features added specifically for this stress test:

- `contentKind` for story packs versus scenario/theme/mechanics/style packs.
- `continuity` for canon tiers, adaptations, routes, and source boundaries.
- `coordinates` for multi-axis Context state.
- `entities.json` for aliases, hero names, titles, transformations, and identity links.
- `ability` for non-HP power systems and mechanics.
- `triggers` for keyword-first imported lorebooks.
- `template` for placeholder-preserving imports.

If a future top fandom strains the schema, prefer adding pack-defined registries or optional metadata blocks over changing the core required entry fields.

## MVP Schema Scope

The first implementation should support:

- `loredeck.json`
- existing entry files with `entries`
- existing `taxonomy.json`
- existing `gate-types.json`
- existing `scoring.json`
- optional `tags.json`
- optional `entities.json`
- optional `timeline.json`
- optional `resolver.json`
- additive entry fields for `triggers`, `continuity`, `coordinates`, `ability`, and `template`
- single active Loredeck
- bundled `hp-golden-trio` schema v3 conformance
- basic Pack Health

It does not need to fully support:

- import/export zip
- GitHub updates
- full Context resolver
- full Loredeck Creator
- semantic conflict detection
- entry-level update merging

## Open Questions

- Should calendar coordinates remain only in `timeline.json`, or should any entry-level factual date metadata be allowed outside eligibility gates?
- Should `spell` remain a universal category, or become a pack-defined category alias for `ability`?
- Should Custom Lorepacks be allowed to define new categories before Saga UI supports them?
- Should unresolved dependency packs reduce scoring, or only show Pack Health warnings?
- Should Generated Lorepacks require user review before auto-suggest can use them?
- How should a pack declare adaptation variants, such as manga versus anime or theatrical versus extended cuts?
- Should tags be globally registered across packs, or merged only at runtime from loaded packs?
- Should keyword `triggers` be evaluated before Context gates, after Context gates, or both with different scoring weights?
- Should `contentKind: mechanics` packs be allowed into the same injection tiers as fandom-story packs, or get a separate handling path?
- Should `entities.json` eventually become required for Bundled Lorepacks?
