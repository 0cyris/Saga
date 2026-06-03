# Saga Lorepack Schema Draft

## Status

This is a pre-implementation schema draft for Saga Lorepacks.

The goal is to define enough structure for:

- A Lorepack loader.
- A Lorepack stack.
- Pack-aware Story Position.
- Tags.
- Pack Health.
- Import, export, and update metadata.
- Future Lorepack editing and generation.

This document is not final JSON Schema syntax yet. It is the product and data contract the first implementation should target.

## Design Goals

Saga Lorepacks should be:

- Pure data. No executable code in packs.
- Portable across local files, zip imports, URLs, and GitHub.
- Editable by users.
- Searchable and filterable.
- Pack-stack aware.
- Story-position aware.
- Compatible with existing Wandlight lore entry data.
- Strict enough to load safely.
- Flexible enough for fandoms without exact dates.

## User-Facing Pack Types

Saga exposes only three Lorepack types:

- `bundled`: shipped with Saga and human-vetted.
- `generated`: created by Saga's Lorepack Creator and not human-vetted by default.
- `custom`: user-made, user-shared, imported, duplicated, AU, crossover, or original.

Internal metadata may record source, derivation, update URLs, generation details, and local modifications, but the UI should still classify the pack using only these three types.

## Suggested File Layout

Bundled packs should live under `Lorepacks/`.

```text
Lorepacks/
  hp-golden-trio/
    lorepack.json
    taxonomy.json
    tags.json
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

Custom and generated packs may eventually live in a user data location managed by SillyTavern or Saga. The loader should not assume every pack is bundled with the extension.

## Core Files

Every Lorepack should have:

- `lorepack.json`
- one or more entry files listed by `lorepack.json`

Recommended registries:

- `tags.json`
- `timeline.json`
- `resolver.json`
- `taxonomy.json`
- `gate-types.json`
- `scoring.json`

Existing Wandlight packs can start with `lorepack.json` plus the current entry files and registries.

## lorepack.json

`lorepack.json` is the package manifest. It tells Saga what the pack is, how to display it, which files to load, which registries to use, and where update metadata lives.

### Required Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | number | Lorepack manifest schema version. MVP should start at `1`. |
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
| `author` | string | Creator or maintainer. |
| `defaultLocale` | string | Locale code, usually `en`. |
| `tags` | string[] | Pack-level tags. |
| `registries` | object | Relative paths to registry files. |
| `resolver` | string | Relative path to resolver metadata. |
| `compatibility` | object | Saga schema compatibility range. |
| `stats` | object | Optional cached entry/category counts. |

### Optional Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | object | Import/source metadata. |
| `update` | object | Update-check metadata. |
| `derivedFrom` | object | Source pack metadata if this pack was duplicated or generated from another pack. |
| `generatedBy` | object | Lorepack Creator metadata. |
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
    "timeline": "timeline.json",
    "gateTypes": "gate-types.json",
    "scoring": "scoring.json"
  },
  "resolver": "resolver.json",
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

## Pack IDs

Pack IDs should be stable and lowercase.

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

Entry files keep the existing Wandlight wrapper style.

```json
{
  "schemaVersion": 2,
  "entries": []
}
```

For Saga, entry file `schemaVersion` may remain `2` initially to preserve Wandlight compatibility. New Saga-only fields should be additive.

## Lore Entry Schema

Saga entries should remain compatible with current Wandlight lore entries.

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
| `scope` | object | Characters, locations, topics, objects, spells, factions, etc. |
| `date` | object | Calendar-style eligibility. |
| `position` | object | Saga Story Position eligibility. |
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

`spell` should remain supported for Wandlight compatibility. Later Saga may add a generic `ability` category, with `spell` as a fandom-specific specialization or alias.

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

### Entry Example

```json
{
  "schemaVersion": 2,
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
  "date": {
    "validFrom": "2015",
    "validTo": "2016",
    "precision": "year"
  },
  "position": {
    "validFromAnchor": "mcu.age_of_ultron",
    "validToAnchor": "mcu.civil_war",
    "precision": "anchor_window"
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
    "notes": "Generated or authored as a position gate, not a full plot summary."
  },
  "extensions": {}
}
```

## Date Block

The existing `date` block remains supported.

```json
{
  "date": {
    "validFrom": "1995-09-01",
    "validTo": "1996-06-30",
    "precision": "school_year",
    "schoolYear": 5,
    "book": "Order of the Phoenix",
    "era": "Golden Trio",
    "label": "Year 5",
    "approximate": false
  }
}
```

Supported date precision values:

```json
[
  "date",
  "month",
  "year",
  "school_year",
  "era",
  "approximate",
  "unknown"
]
```

## Position Block

`position` is the new Saga Story Position eligibility block.

It should be optional in MVP but should become the preferred cross-fandom timeline layer.

### Position Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `anchorId` | string | Entry applies at one anchor. |
| `validFromAnchor` | string | Entry starts at or after this anchor. |
| `validToAnchor` | string | Entry applies until this anchor. |
| `arcId` | string | Entry applies during this arc. |
| `phaseId` | string | Entry applies during this phase. |
| `season` | number/string | TV-style season. |
| `episode` | number/string | TV-style episode. |
| `stardateFrom` | string/number | Star Trek-style lower bound. |
| `stardateTo` | string/number | Star Trek-style upper bound. |
| `sortKeyFrom` | number | Normalized lower sort bound. |
| `sortKeyTo` | number | Normalized upper sort bound. |
| `precision` | string | `anchor`, `anchor_window`, `arc`, `phase`, etc. |
| `label` | string | Human-readable display label. |

### Position Example

```json
{
  "position": {
    "validFromAnchor": "mcu.age_of_ultron",
    "validToAnchor": "mcu.civil_war",
    "precision": "anchor_window",
    "label": "After Age of Ultron, before Civil War"
  }
}
```

### Position Compatibility

When both `date` and `position` exist:

- `date` handles exact or approximate calendar filtering.
- `position` handles pack-local timeline filtering.
- An entry should generally be eligible if it matches the active Story Position and does not contradict a hard date bound.

MVP may keep date matching primary for the HP pack, then add position matching incrementally.

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

## timeline.json

`timeline.json` defines a pack-local story position axis.

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

## resolver.json

`resolver.json` tells Saga how to map user phrasing, headers, notes, and model output into a Lorepack Context.

### Resolver Example

```json
{
  "schemaVersion": 1,
  "summary": "Resolve chat context to an MCU Infinity Saga story position.",
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
    "positionType": "string",
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

### Resolution Order

Saga should resolve Story Position in this order:

1. Manual user selection.
2. Local alias/header matching.
3. Model fallback.

Manual locks should prevent automatic overwrites.

## taxonomy.json

`taxonomy.json` can mostly preserve the existing Wandlight taxonomy format.

It controls display labels, colors, and descriptions for:

- Categories.
- Canon statuses.
- Truth statuses.
- Reveal policies.

Saga should merge missing values with safe defaults.

Bundled packs should stay within Saga's supported category values unless the UI and normalizer are updated.

## gate-types.json

`gate-types.json` can preserve the existing Wandlight format.

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

`scoring.json` should extend the current Wandlight scoring format.

Existing fields:

```json
{
  "schemaVersion": 2,
  "weights": {
    "dateMatch": 30,
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
    "positionMatch": 30,
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

These values are a draft. Pack stack order should influence tie-breaks and candidate ranking without making top packs blindly suppress useful lower-pack entries.

## Lorepack Stack State

The active stack is stored per chat, with future support for global defaults.

```json
{
  "lorepackStack": [
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

Accepted story lore is not part of the Lorepack stack. It should always outrank Lorepack entries.

## Lorepack Context State

Each active Lorepack can have its own context.

```json
{
  "lorepackContexts": {
    "hp-golden-trio": {
      "positionType": "calendar",
      "sceneDate": "1995-10-31",
      "anchorId": "hp.ootp.year_5",
      "anchorFrom": "",
      "anchorTo": "",
      "label": "Order of the Phoenix, Year 5",
      "branchId": "main",
      "confidence": 0.94,
      "manualLock": false,
      "source": "header",
      "updatedAt": 0
    },
    "mcu-infinity-saga": {
      "positionType": "anchor_window",
      "sceneDate": "",
      "anchorId": "",
      "anchorFrom": "mcu.age_of_ultron",
      "anchorTo": "mcu.civil_war",
      "label": "After Age of Ultron, before Civil War",
      "branchId": "main",
      "confidence": 0.82,
      "manualLock": true,
      "source": "manual",
      "updatedAt": 0
    }
  }
}
```

### Context Sources

Suggested `source` values:

- `manual`
- `header`
- `local_alias`
- `model`
- `imported`
- `unknown`

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
    "undefinedTagCount": 1,
    "duplicateEntryIdCount": 0,
    "longEntryCount": 4
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

Warnings:

- `duplicate_pack_loaded`
- `likely_duplicate_pack`
- `undefined_tag`
- `deprecated_tag`
- `broken_anchor_reference`
- `invalid_date`
- `invalid_position_window`
- `missing_injection`
- `entry_too_long`
- `likely_wiki_summary`
- `weak_scope`
- `missing_dependency`

Suggestions:

- `missing_tags`
- `missing_scope`
- `missing_resolver_aliases`
- `broad_entry`
- `category_imbalance`
- `low_specificity`

## Import And Export Bundle

Saga should support both loose-folder packs and bundled imports.

### JSON Bundle

A JSON bundle can embed every file in one document.

```json
{
  "bundleSchemaVersion": 1,
  "bundleType": "saga_lorepack",
  "manifest": {},
  "files": {
    "taxonomy.json": {},
    "tags.json": {},
    "timeline.json": {},
    "resolver.json": {},
    "entries/core.json": {
      "schemaVersion": 2,
      "entries": []
    }
  }
}
```

### Zip Bundle

A zip bundle should contain a `lorepack.json` at the root.

```text
my-pack.zip
  lorepack.json
  tags.json
  timeline.json
  entries/
    core.json
```

Saga should reject zip entries that try to escape the pack root with absolute paths or `..` traversal.

## Loader Output

The loader should produce a normalized runtime object, separate from raw pack files.

```json
{
  "packId": "hp-golden-trio",
  "manifest": {},
  "registries": {
    "taxonomy": {},
    "tags": {},
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

These fields can live under `extensions.sagaLorepack` if we want to avoid polluting the top-level entry schema.

## Suggested extensions.sagaLorepack Block

```json
{
  "extensions": {
    "sagaLorepack": {
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

The current `Lore/manifest.json` should map to:

```text
Lorepacks/hp-golden-trio/lorepack.json
Lorepacks/hp-golden-trio/taxonomy.json
Lorepacks/hp-golden-trio/gate-types.json
Lorepacks/hp-golden-trio/scoring.json
Lorepacks/hp-golden-trio/chronology/
Lorepacks/hp-golden-trio/characters/
Lorepacks/hp-golden-trio/knowledge_gates/
...
```

The initial HP pack can preserve its current entry files and add `tags.json`, `timeline.json`, and `resolver.json` over time.

MVP should keep legacy `Lore/manifest.json` fallback until the new loader is stable.

## MVP Schema Scope

The first implementation should support:

- `lorepack.json`
- existing entry files with `entries`
- existing `taxonomy.json`
- existing `gate-types.json`
- existing `scoring.json`
- optional `tags.json`
- optional `timeline.json`
- optional `resolver.json`
- single active Lorepack
- legacy `Lore/manifest.json` fallback
- basic Pack Health

It does not need to fully support:

- import/export zip
- GitHub updates
- full Story Position resolver
- full Lorepack Creator
- semantic conflict detection
- entry-level update merging

## Open Questions

- Should `position` live beside `date`, or should it eventually replace `date` with `date` as one coordinate type?
- Should `spell` remain a universal category, or become a pack-defined category alias for `ability`?
- Should Custom Lorepacks be allowed to define new categories before Saga UI supports them?
- Should unresolved dependency packs reduce scoring, or only show Pack Health warnings?
- Should Generated Lorepacks require user review before auto-suggest can use them?
- How should a pack declare adaptation variants, such as manga versus anime or theatrical versus extended cuts?
- Should tags be globally registered across packs, or merged only at runtime from loaded packs?

