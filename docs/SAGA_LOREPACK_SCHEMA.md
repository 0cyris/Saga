# Saga Lorepack Schema Draft

**SAGA: Fandom Loresystem.**

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

Custom and generated packs may eventually live in a user data location managed by SillyTavern or Saga. The loader should not assume every pack is bundled with the extension.

## Core Files

Every Lorepack should have:

- `lorepack.json`
- one or more entry files listed by `lorepack.json`

Recommended registries:

- `tags.json`
- `entities.json`
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
| `contentKind` | string | Internal content shape, such as `fandom`, `setting`, `scenario`, or `mechanics`. |
| `author` | string | Creator or maintainer. |
| `defaultLocale` | string | Locale code, usually `en`. |
| `tags` | string[] | Pack-level tags. |
| `registries` | object | Relative paths to registry files. |
| `resolver` | string | Relative path to resolver metadata. |
| `continuity` | object | Continuity, adaptation, or canon-tier metadata for the pack. |
| `runtimeDefaults` | object | Default retrieval/trigger/injection behavior for imported or keyword-heavy packs. |
| `compatibility` | object | Saga schema compatibility range. |
| `stats` | object | Optional cached entry/category counts. |

### Optional Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | object | Import/source metadata. |
| `update` | object | Update-check metadata. |
| `derivedFrom` | object | Source pack metadata if this pack was duplicated or generated from another pack. |
| `manifestData` | object | Library-only embedded manifest metadata for virtual Custom duplicates before durable local storage exists. |
| `entryOverrides` | object | Library-only map of edited or added lore entries keyed by entry ID. |
| `disabledEntryIds` | string[] | Library-only source entry IDs suppressed by this Custom Lorepack. |
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

### Virtual Custom Duplicates

Before full local zip/folder storage exists, Saga may represent a duplicated pack as a Custom library record that stores:

- `manifest`: the source manifest path used as the file-resolution base.
- `manifestData`: an embedded manifest copy with the new Custom `id`, type, title, tags, and derivation metadata.
- `derivedFrom`: the source pack ID, title, version, manifest path, and duplicate timestamp.

The UI still shows this as a Custom Lorepack. The virtual duplicate is loadable because entry files resolve relative to the source manifest, while runtime pack identity comes from `manifestData.id`.

### Custom Entry Overrides

Before Saga can write durable local pack folders, a Custom Lorepack may store entry-level changes in its library record:

```json
{
  "entryOverrides": {
    "entry_id": {
      "id": "entry_id",
      "title": "Edited or added lore entry",
      "fact": "The custom fact or override text."
    }
  },
  "disabledEntryIds": ["source_entry_id"]
}
```

When loading a pack, Saga applies `entryOverrides` before Pack Health and canon database normalization. An override with the same ID as a source entry replaces that entry for this Custom pack. An override with a new ID becomes an added entry. A disabled entry ID suppresses the matching source entry.

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
| `triggers` | object | Keyword, constant, probability, and recursive activation hints. |
| `scope` | object | Characters, locations, topics, objects, spells, factions, etc. |
| `date` | object | Calendar-style eligibility. |
| `position` | object | Saga Story Position eligibility. |
| `coordinates` | object[] | Multi-axis Story Position coordinates. |
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

`spell` should remain supported for Wandlight compatibility. Later Saga may add a generic `ability` category, with `spell` as a fandom-specific specialization or alias.

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

`contentKind` is manifest-level metadata. It is not a user-facing Lorepack type.

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

This can be useful as a Custom Lorepack, but Saga should not treat it as strongly Story Position-driven unless the pack defines an actual campaign/story timeline.

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

Saga's local canon suggestions should be Story Position and relevance driven, but imported lorebooks often rely on keyword triggers. Saga should preserve these semantics.

`triggers` allows Chub/SillyTavern/NovelAI-style lorebooks to import cleanly and gives Custom packs a precise activation layer when Story Position is not enough.

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

Saga should treat triggers as one input to relevance and suggestion, not as a replacement for Story Position.

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

Implementation status: entries normalize and preserve `position` metadata, Saga evaluates position gates against active Lorepack Story Position, retrieval/scoring now uses those gates, and suggested/pending lore cards display source plus position/gating chips.

### Position Fields

| Field | Type | Meaning |
| --- | --- | --- |
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
| `issue` | number/string | Comic issue or run position. |
| `quest` | string | Game quest, mission, route, or scenario marker. |
| `gameStage` | string | Broader game progression stage. |
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
    "phase": "Phase 3",
    "precision": "anchor_window",
    "label": "After Age of Ultron, before Civil War"
  }
}
```

Accepted aliases during normalization include `anchorFrom` for `validFromAnchor`, `anchorTo` for `validToAnchor`, and `positionType` or `type` for `precision`.

### Position Compatibility

When both `date` and `position` exist:

- `date` handles exact or approximate calendar filtering.
- `position` handles pack-local timeline filtering.
- An entry should generally be eligible if it matches the active Story Position and does not contradict a hard date bound.

For bundled Saga Lorepacks, `position` should become the primary entry gate. Calendar dates should live mainly in `timeline.json` as resolver coordinates, so a user can pick a date and Saga resolves it to the active Story Position. Date fallback remains for older imported packs and migration safety.

## Coordinates Block

`position` handles the common single-axis case. Some fandoms need multiple axes at the same time.

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

Entities should not be required for every Custom pack. They should be strongly recommended for Bundled packs and generated canon-scale packs.

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

### Runtime Position Index

Saga loads `registries.timeline` from each enabled Lorepack and builds a runtime Story Position Index.

The index is stack-aware:

- Packs are read in loaded Lorepack priority order.
- Each anchor keeps its `packId`, pack title, stack index, and pack priority.
- Anchor search is pack-local by default in the Story Position editor.
- Suggest Lore, preprocessing, and Relevance can later use the same index for pack-aware temporal promotion.

Missing `timeline.json` is allowed. Some Custom Lorepacks may be keyword-first, scenario-first, or still in early drafting. Pack Health may suggest adding timeline anchors, but Saga should not reject a pack only because it has no Story Position registry.

Timeline registries are not lore entry files. They are compact resolver/index data used to help map phrases like `after Shibuya`, `Civil War era`, `Year 4`, `post-war`, or `before the Battle of Hogwarts` into normalized Lorepack Context fields.

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

### Model Fallback Contract

Model fallback should be bounded by the active Story Position Index.

Saga should send the model:

- Current Story Context.
- Optional supporting user/header text.
- Target Lorepack IDs.
- Known timeline anchors for those packs.

The model should return only known anchor IDs or mark a pack unresolved.

Saga should reject:

- Anchor IDs that do not exist in the target pack.
- Results below the confidence threshold.
- Results for locked packs.
- Invented dates, arcs, phases, or labels that do not map to known anchors.

This makes the model a resolver, not an authority. The Lorepack remains the source of timeline truth.

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
    "positionMatch": 30,
    "positionUnresolvedPenalty": -8,
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
    "positionUnresolvedPenalty": -8,
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

- Entries with no `position` block keep legacy date-window behavior.
- Entries with a matching `position` block can qualify even when no parseable date exists.
- A mismatched `position` block blocks the entry.
- An unresolved `position` block falls back to legacy date matching and receives `positionUnresolvedPenalty` when it still qualifies by date.
- Bundled Saga packs should migrate toward position-native entries; date-only entry gates are compatibility support, not the desired long-term shape.

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
      "schemaVersion": 1,
      "packId": "hp-golden-trio",
      "positionType": "calendar",
      "label": "Order of the Phoenix, Year 5",
      "sceneDate": "1995-10-31",
      "subjectiveDate": "",
      "positionSortKey": 9434,
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
      "positionType": "anchor_window",
      "label": "After Age of Ultron, before Civil War",
      "sceneDate": "",
      "subjectiveDate": "",
      "positionSortKey": 2400,
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

`positionSortKey` is optional but important for date-capable packs. For Harry Potter, a picked date can resolve to a date-derived sort key while still preserving the chosen anchor/window label. Position-native entries can then use `position.sortKeyFrom` and `position.sortKeyTo` without every calendar day needing a named anchor.

### Context Sources

Suggested `source` values:

- `manual`
- `header`
- `local_alias`
- `model`
- `imported`
- `unknown`

### Position Type Values

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
    "undefinedTagCount": 1,
    "duplicateEntryIdCount": 0,
    "longEntryCount": 4,
    "timelineAnchorCount": 120,
    "timelineWindowCount": 18,
    "positionGateCount": 250,
    "brokenAnchorReferenceCount": 0,
    "invalidPositionWindowCount": 0,
    "unmatchablePositionGateCount": 0
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
- `unknown_entity_reference`
- `broken_anchor_reference`
- `invalid_date`
- `invalid_position_window`
- `unmatchable_position_gate`
- `story_position_timeline_invalid_ref`
- `story_position_timeline_load_failed`
- `duplicate_timeline_anchor_id`
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
- `position_gates_without_timeline`
- `story_position_timeline_empty`
- `broad_entry`
- `category_imbalance`
- `low_specificity`

Current Story Position health behavior:

- `broken_anchor_reference` warns when an entry or timeline window references an anchor not defined in the pack timeline registry.
- `invalid_position_window` warns when anchor sort order or explicit sort keys make a position window start after it ends.
- `unmatchable_position_gate` warns when an anchor/window-only entry gate cannot match known timeline anchors.
- `position_gates_without_timeline` is a suggestion, not a warning, because Custom Lorepacks may be useful before they have a timeline registry.
- Missing or empty timeline registries never block pack loading.

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
    "entities.json": {},
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
  entities.json
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

These fields can live under `extensions.sagaLorepack` if we want to avoid polluting the top-level entry schema.

## Imported Lorebook Compatibility

Saga's native model is Story Position plus relevance-tiered injection.

Many public lorebook ecosystems are keyword-first. Saga should preserve those semantics during import instead of forcing everything into Story Position.

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

Imported keyword-heavy packs may not have Story Position data. That should be allowed. Pack Health can suggest adding position gates without blocking the pack.

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

## Fandom Stress Test

The schema should be checked against popular roleplay universes before implementation hardens.

Saga's main target is canon with stories, but Custom packs may also represent themes, scenarios, mechanics, or looser settings.

| Universe | Saga Fit | Schema Pressure Points |
| --- | --- | --- |
| Call of Duty | Medium for theme/scenario packs, lower for canon-story packs. | `contentKind: scenario`, factions, operators, weapons, mission themes, low Story Position dependence. |
| My Hero Academia | High. | Arcs, school years, internships, hero names, Quirk progression, manga/anime/filler boundaries, entity aliases. |
| Marvel | High but complex. | MCU/comics/animated continuities, multiverse variants, phases, films, identities, teams, power systems. |
| DC / Batfamily | High but continuity-heavy. | Comic eras, fanon blends, aliases, family roster state, hero identities, city/location state. |
| Genshin Impact | High for story/setting packs. | Archon quests, nations, character story quests, Visions/elements, playable character unlock assumptions. |
| Resident Evil | High. | Game chronology, outbreak/location state, organizations, infection types, remakes versus originals. |
| Harry Potter | High and already proven by Wandlight. | Dates, school years, knowledge gates, spells, secrets, Marauders/Legacy era splits. |
| Wizarding World: Marauders / Legacy | High. | Era-separated packs, school years, character generations, game quest state, institutional state. |
| Star Wars | High. | Legends/Disney canon split, BBY/ABY dates, eras, factions, Force abilities, titles, locations. |
| Jujutsu Kaisen | High. | Manga/anime arcs, cursed techniques, domains, spoiler guards, character death/status changes. |
| Hazbin Hotel / Helluva Boss | Medium-high. | Series/episode position, Hell hierarchy, factions, character relationships, limited hard dates. |
| Demon Slayer | High. | Arcs, breathing styles, demon status, Corps ranks, spoiler/death guards. |
| Bungou Stray Dogs | High. | Organizations, ability names, arcs, aliases, manga/anime adaptation state. |
| FNAF | Medium-high but ambiguity-heavy. | Theories, timelines, game entries, animatronic identities, contested canon, route/ending variants. |
| Pokemon | Medium-high, depending on pack scope. | Regions, anime/game continuity, species/moves/types, mechanics, trainer parties, generational boundaries. |
| Honkai: Star Rail | High. | Trailblaze mission chapters, worlds/planets, factions, Aeons/Paths, character quest state. |
| Percy Jackson | High. | Book chronology, cabins, prophecy knowledge, gods/monsters, character age/status. |
| Sonic | Medium-high. | Game/comic/show continuities, zones, teams, transformations, loose chronology. |
| One Piece | High. | Arcs, islands, pre/post-timeskip, Devil Fruits, Haki, crews, bounties, spoiler/status guards. |
| Naruto | High. | Manga/anime/filler boundaries, arcs, villages, jutsu, kekkei genkai, ranks, team membership. |
| Arcane / League of Legends | High but continuity-sensitive. | Arcane versus League canon, regions, factions, champions, hextech/magic, season/act position. |
| ASOIAF / Game of Thrones | High. | Book/show split, houses, geography, political state, character death/status, prophecy knowledge. |
| Stranger Things | High. | Seasons, episode position, Upside Down knowledge, character status, Hawkins location state. |
| Cyberpunk 2077 | High for game-story packs. | Lifepath, quest state, endings, Edgerunners/TTRPG continuity, cyberware, factions. |
| Chainsaw Man | High. | Manga arcs, Devil contracts, Public Safety state, character death/status, spoiler guards. |
| Undertale / Deltarune | Medium-high. | Routes, timelines/resets, chapters, player choices, alternate worlds, entity aliases. |

Schema features added specifically for this stress test:

- `contentKind` for story packs versus scenario/theme/mechanics/style packs.
- `continuity` for canon tiers, adaptations, routes, and source boundaries.
- `coordinates` for multi-axis position state.
- `entities.json` for aliases, hero names, titles, transformations, and identity links.
- `ability` for non-HP power systems and mechanics.
- `triggers` for keyword-first imported lorebooks.
- `template` for placeholder-preserving imports.

If a future top fandom strains the schema, prefer adding pack-defined registries or optional metadata blocks over changing the core required entry fields.

## MVP Schema Scope

The first implementation should support:

- `lorepack.json`
- existing entry files with `entries`
- existing `taxonomy.json`
- existing `gate-types.json`
- existing `scoring.json`
- optional `tags.json`
- optional `entities.json`
- optional `timeline.json`
- optional `resolver.json`
- additive entry fields for `triggers`, `continuity`, `coordinates`, `ability`, and `template`
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
- Should keyword `triggers` be evaluated before Story Position gates, after Story Position gates, or both with different scoring weights?
- Should `contentKind: mechanics` packs be allowed into the same injection tiers as fandom-story packs, or get a separate handling path?
- Should `entities.json` eventually become required for Bundled Lorepacks?
