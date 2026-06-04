# Saga Pre-Production

**SAGA: Fandom Loresystem.**

## Purpose

Saga is the planned evolution of Wandlight from a Harry Potter-focused SillyTavern lore extension into SAGA: Fandom Loresystem, a general framework for fandom-specific, date-aware, arc-aware, and story-position-aware lore support.

Wandlight already proves the core product idea:

- A local canon constraint database is useful because LLMs are lore-rich but timeline-poor.
- Proposed lore should enter review before it affects generation.
- Durable story lore and lightweight continuity should be separate systems.
- Prompt injection needs relevance tiers, placement controls, and compression.

Saga keeps that foundation and generalizes the fandom-specific layer into Lorepacks.

## Product Thesis

Saga should be a lore arbitration framework, not a wiki browser.

The extension should help users answer:

- What lore is true at this point in the story?
- What facts are not known yet?
- What future canon should not leak?
- What has this specific chat changed?
- Which loaded fandom packs should influence the next prompt?
- Which lore is important enough to inject now?

Saga should support single-fandom campaigns, alternate universes, crossovers, custom settings, and user-created packs without forcing every fandom into Harry Potter's calendar-shaped structure.

## Product Terms

Only three Lorepack types should be exposed in the UI.

### Bundled Lorepack

A Lorepack shipped with Saga. These are tailored and human-vetted for quality.

Examples:

- Harry Potter: Golden Trio
- Hogwarts Legacy
- Star Wars Legends: New Republic Era
- MCU: Infinity Saga
- Star Trek: TNG + DS9 + VOY

### Generated Lorepack

A draft Lorepack created by Saga's built-in creator tool. Generated Lorepacks are useful immediately but should be treated as unvetted until reviewed by the user.

### Custom Lorepack

Any user-made, user-edited, user-shared, imported, duplicated, AU, crossover, or original Lorepack.

Custom Lorepacks can be small or canon-scale. A crossover pack is simply a Custom Lorepack with entries that connect or reinterpret other loaded packs.

Do not expose "bridge pack", "overlay", "installed pack", or "forked pack" as user-facing product terms. Internally, Saga may still track source, derivation, and update metadata.

## Existing Wandlight Foundation

The current project already has several reusable core systems:

- Runtime shelf and drawer UI.
- Session, Context, Continuity, Lore, and Injection tabs.
- Local canon database loader.
- Pending Lore Review.
- Accepted lore workbench.
- Relevance tiers: High, Normal, Low.
- Canon/AU distinction.
- Story Context detection.
- Continuity scanning.
- Auto-Relevance.
- Prompt injection and compression.
- Provider settings.

Saga should not rewrite these systems immediately. The first goal is to extract fandom-specific data and assumptions from them.

## Runtime UI Direction

Keep the current Wandlight/Saga shelf design.

Add a dedicated Lorepack rail button above the existing runtime tabs. This button opens the Lorepack tab, which owns all pack loading, editing, importing, exporting, health checks, and creation workflows.

Current rail order should evolve toward:

1. Lorepacks
2. Session
3. Context
4. Continuity
5. Lore
6. Injection
7. Settings

The Lorepack tab is intentionally above the rest because the active Lorepack stack determines what Context, Lore, Relevance, and Injection mean.

The existing Lore tab should continue to handle chat-specific pending and accepted lore. The new Lorepack tab handles source packs.

The Settings tab should sit at the end because it configures Saga itself rather than the active roleplay state. It now absorbs the extension-menu API settings so users can configure providers from the same runtime surface they use during play.

## Runtime Settings And Themepacks

Saga's runtime Settings tab has three main areas:

- Provider settings: Utility provider and Reasoning provider configuration, including profile selection, OpenAI-compatible endpoint settings, generation parameters, and test actions.
- Appearance settings: colors, density, rail/drawer styling, card surfaces, borders, accent colors, status colors, and text contrast.
- Themepacks: named presets that bundle appearance colors and icon/button theme metadata.

The extension-menu settings panel remains as a compatibility and recovery surface. The runtime Settings tab is the primary user-facing home for provider controls.

### Themepack Draft

Themepacks should be pure data, like Lorepacks. They should not contain executable code.

```json
{
  "schemaVersion": 1,
  "id": "saga-archive",
  "title": "Saga Archive",
  "type": "bundled",
  "description": "Bundled dark archive theme for SAGA: Fandom Loresystem.",
  "iconPackId": "wandlight-default",
  "colors": {
    "background": "#120c12",
    "backgroundAlt": "#241018",
    "gradientStart": "#120c12",
    "gradientEnd": "#090c12",
    "surface": "#2b1c1c",
    "surfaceAlt": "#121218",
    "border": "#b98b36",
    "borderStrong": "#d7b56d",
    "accent": "#d7b56d",
    "danger": "#5c1724",
    "success": "#1f4a38",
    "warning": "#b9903c",
    "focus": "#ffeaa7",
    "button": "#18121a",
    "buttonHover": "#5c1724",
    "buttonText": "#f1ead8",
    "input": "#121218",
    "inputBorder": "#b98b36",
    "text": "#f1ead8",
    "mutedText": "#cfc5ad"
  },
  "icons": {
    "brand.compact": "./Images/branding/wandlight-logo-minimized-256.png",
    "brand.expanded": "./Images/branding/wandlight-logo-expanded-512.png",
    "tab.lorepacks": "./Images/runtime-icons/saga_tab_lorepacks_256.png"
  },
  "tags": [
    "theme:dark",
    "style:archive"
  ]
}
```

The first implementation stores theme settings in normal extension settings and applies them as CSS variables on the runtime panel. Bundled presets live in code. User-made Theme Packs install into a global `themePackLibrary` registry in extension settings.

Reasonable first-wave color tokens:

- Backgrounds: base background, alternate background, gradient start, gradient end.
- Surfaces: card/panel surface and nested/secondary surface.
- Borders: normal border and stronger selected/focus-adjacent border.
- Controls: button, button hover, button text, input background, input border.
- Status and accents: accent, danger, success, warning, focus.
- Text: primary text and muted/help text.

Theme Pack icon overrides are keyed by UI target, such as `brand.compact`, `brand.expanded`, `tab.lorepacks`, `tab.context`, or `tab.settings`. Values must be passive image paths, data URLs, or fetchable image URLs. They do not grant code execution.

Installed Custom Theme Packs should be importable from a single Theme Pack JSON file or a Theme Pack Library JSON file. Custom imports must not overwrite Bundled Theme Pack IDs.

Accessibility should be handled like Pack Health: advisory and visible, not gatekeeping. The runtime Settings tab should report contrast checks for primary text, muted text, button text, accent controls, focus rings, and danger surfaces. Targets should follow common WCAG-style ratios: 4.5:1 for normal text and 3:1 for UI affordances.

## Lorepack Stack

Saga should support loading multiple Lorepacks at the same time.

The active stack is ordered from highest priority to lowest priority:

```text
1. My HP/SW Custom Crossover
2. Harry Potter: Golden Trio
3. Star Wars Legends: New Republic Era
```

Pack priority should influence retrieval, suggestion, preprocessing, and relevance scoring. It should not blindly delete lower-priority entries.

Accepted story lore created in the current chat always outranks Lorepack entries.

### Loader UI

The Lorepack tab should include a two-column loader workbench.

Left column: Lorepack Library

- Search bar.
- Filters by type, fandom, era, tags, author, source, health status, installed/bundled/custom/generated.
- Pack cards with title, description, type, entry count, category counts, tags, version, source, and health summary.

Right column: Active Stack

- Loaded Lorepacks in priority order.
- Drag-and-drop reordering.
- Enable/disable per pack.
- Pack priority indicators.
- Total loaded entries.
- Category totals.
- Missing dependency warnings.
- Duplicate warnings.
- Health summary for the stack.

### Stack State Draft

```json
{
  "lorepackStack": [
    {
      "packId": "my-hp-sw-crossover",
      "enabled": true,
      "priority": 300,
      "locked": false
    },
    {
      "packId": "hp-golden-trio",
      "enabled": true,
      "priority": 200,
      "locked": false
    },
    {
      "packId": "sw-legends-new-republic",
      "enabled": true,
      "priority": 100,
      "locked": false
    }
  ]
}
```

The numeric priority can be internal. The UI should mostly show order.

### Library Ownership

Saga should keep Lorepack library metadata globally, while each chat keeps only its active stack and per-pack story context.

Global extension settings own:

- Bundled, Custom, and Generated Lorepack metadata.
- Manifest paths or source URLs.
- Update metadata.
- Pack tags, author, version, source, and cached stats.

Per-chat state owns:

- `lorepackStack`: loaded pack IDs, enabled state, and order.
- `lorepackContexts`: Story Position per loaded pack.
- Chat-specific accepted lore and pending lore.

Older Wandlight/Saga builds temporarily stored `lorepackRegistry` in chat state. That registry remains a compatibility fallback, and opening an older chat should promote missing registry records into the global library when possible.

### Import/Export Staging

The first import/export slice should support:

- Registering a fetchable `lorepack.json` path or URL into the global library.
- Exporting global Lorepack Library metadata as JSON.
- Importing previously exported Lorepack Library metadata JSON.

This does not yet mean Saga can persist arbitrary local folder contents from a browser file picker. Browser-selected local manifests do not grant durable access to sibling entry files. Full local pack support should come through a zip importer or a SillyTavern-managed storage location.

For now, registered Custom Lorepacks are expected to use manifest paths or URLs that remain fetchable by the browser. Entry files resolve relative to the registered manifest.

### Custom Duplicate Staging

Until Saga has durable zip/local pack storage, duplicating a pack creates a Custom Lorepack library record with:

- A new Custom pack ID and editable metadata.
- `derivedFrom` metadata pointing at the source pack.
- Embedded `manifestData` with the Custom identity.
- The source `manifest` path retained as the base for resolving entry files.

This makes the duplicate loadable immediately without writing a new folder. If the original and duplicate are both loaded, stack priority and duplicate-entry handling determine which entries win. Later entry-level editing can layer changed entries into the Custom pack.

The first entry-editing slice stores that layer as library metadata:

- `entryOverrides`: edited or newly added lore entries keyed by entry ID.
- `disabledEntryIds`: source entry IDs suppressed by the Custom pack.

The loader applies these before Pack Health and canon database normalization, so the active stack sees the Custom pack's edited entry set instead of the untouched source files.

## Story Position And Lorepack Context

Wandlight currently centers on a story date. Saga needs a more general primitive: Story Position.

Story Position answers:

```text
Where is this chat located inside this Lorepack's canon or story structure?
```

For Harry Potter, that may be a calendar date and school year.

For MCU, that may be "after Age of Ultron, before Civil War."

For My Hero Academia, that may be a school arc or anime/manga arc.

For Star Trek, that may be a season, episode range, stardate, or Dominion War phase.

For Star Wars, that may be BBY/ABY, era, conflict, book series, or before/after a major event.

### Lorepack Context

Each loaded Lorepack can have its own context slot.

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

Manual locks are important. If a user chooses "before Civil War", Saga should not overwrite that just because later chat text mentions Civil War in dialogue or comparison.

### Story Position v1 Implementation

The first production implementation is manual-first:

- `lorepackContexts` is normalized during state migration.
- Every loaded Lorepack receives a Story Position slot.
- The Lorepacks tab exposes a manual editor for date, label, branch, arc, phase, season, episode, chapter, issue, quest, game stage, anchors, alias, notes, source, confidence, and manual lock.
- Manual field edits set `source: "manual"`, `manualLock: true`, and high confidence by default.
- The editor can seed a pack position from the legacy Story Context fields while Saga transitions from one global date to per-pack positions.
- Automated alias/model resolvers should respect `manualLock` in later slices.

### Timeline Modes

Lorepacks should declare what kind of story position they support.

Supported modes should include:

- `calendar`: exact or approximate real/in-universe dates.
- `anchor`: one selected event, book, film, arc, season, or episode.
- `anchor_window`: after one anchor and before another.
- `arc`: named story arcs.
- `phase`: broad phase/era structures, useful for MCU or long franchises.
- `season_episode`: television-style ordering.
- `stardate`: Star Trek-style chronology.
- `relative`: before/after major events without exact dates.
- `hybrid`: multiple coordinate types.

Calendar dates should be one timeline coordinate, not the universal foundation.

### Timeline Registry Draft

```json
{
  "schemaVersion": 1,
  "timelineMode": "hybrid",
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
        "after Sokovia",
        "Age of Ultron"
      ],
      "tags": [
        "mcu:phase-2",
        "event:sokovia"
      ]
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
      ]
    }
  ]
}
```

`sortKey` is the internal ordering mechanism. It lets Saga compare story positions without pretending every fandom has exact dates.

### Position Index v1 Implementation

Step 3 adds a runtime Story Position Index:

- `registries.timeline` points at a Lorepack-owned `timeline.json`.
- `story-position-index.js` loads timeline registries from enabled Lorepacks.
- The aggregate index preserves pack priority, stack order, anchor IDs, aliases, tags, dates, arcs, phases, and media-specific coordinates.
- The Lorepacks tab shows index status and per-pack anchor counts.
- The Story Position editor can search a pack's local anchors and apply one into normalized Lorepack Context.

The first concrete registry is `Lorepacks/hp-golden-trio/timeline.json`. It includes Golden Trio book/year anchors, major event anchors, and broad windows like pre-Hogwarts, canon Hogwarts years, and post-war.

Design constraint: missing timeline registries are allowed. Saga should treat timeline support as a Pack Health/advisory dimension, not as a hard validity gate, because some Custom Lorepacks may be scenario-first, keyword-first, or still under construction.

### Local Resolver v1 Implementation

Step 4 adds a local, non-model resolver:

- `story-position-resolver.js` resolves unlocked loaded Lorepacks from current Story Context.
- Date matching compares `sceneDate` / `subjectiveDate` against pack-local anchor date ranges.
- Alias matching searches anchor labels, aliases, tags, books, arcs, phases, and other timeline fields.
- Manual locks are respected unless a future caller explicitly forces overwrite.
- Context detection now runs the local Story Position resolver after header/model/local Story Context detection.
- The Lorepacks tab can manually run `Resolve From Context`.

This keeps the common path free: a structured reply header or clear context note can update pack-specific Story Position without a model call.

### Model Fallback Resolver v1 Implementation

Step 5 adds a controlled model fallback:

- The Lorepacks tab exposes `Model Fallback`.
- The action first applies confident local matches, then sends only unresolved unlocked Lorepacks to the Reasoning Provider.
- The prompt includes only known timeline anchors from the active Story Position Index.
- Model output is accepted only when it references a known anchor ID for that pack.
- Low-confidence and invented-anchor results are rejected as unresolved.
- Manual locks remain protected.

The model fallback is intentionally explicit rather than automatic. It is for ambiguous fandom phrasing, arc names, user notes, and non-date-heavy settings where local matching is not enough.

### Entry Gating Draft

Entries can be gated by dates, anchors, windows, arcs, or relative positions.

```json
{
  "id": "mcu_wanda_public_after_sokovia",
  "title": "Wanda Known After Sokovia",
  "category": "character",
  "relevance": "normal",
  "canon": "canon",
  "priority": 75,
  "position": {
    "validFromAnchor": "mcu.age_of_ultron",
    "validToAnchor": "mcu.civil_war"
  },
  "scope": {
    "characters": [
      "Wanda Maximoff"
    ],
    "topics": [
      "Sokovia",
      "Avengers"
    ]
  },
  "tags": [
    "character:wanda-maximoff",
    "event:sokovia",
    "knowledge:public"
  ],
  "content": {
    "fact": "After Sokovia, Wanda Maximoff is publicly associated with the Avengers and the Sokovia incident.",
    "injection": "After Sokovia, treat Wanda Maximoff as publicly associated with the Avengers and the Sokovia incident unless this story established otherwise."
  }
}
```

Existing date fields should remain supported for compatibility:

```json
{
  "date": {
    "validFrom": "1995-09-01",
    "validTo": "1996-06-30",
    "precision": "school_year"
  },
  "position": {
    "anchorId": "hp.ootp.year_5"
  }
}
```

### Story Position Resolution

Resolution should happen in three layers:

1. Manual user selection.
2. Local alias/header matching.
3. Model fallback using Lorepack resolver instructions.

Manual selection should be the preferred and most trusted path. Users should be able to search anchors, choose before/after windows, set approximate eras, and lock the result.

Local alias matching should use:

- Structured headers.
- User notes.
- Lorepack anchor aliases.
- Tags.
- Known date formats.
- Known arc/film/book/season labels.

Model fallback should only run when local resolution is insufficient or the user requests it.

### Resolver Registry Draft

```json
{
  "resolver": {
    "summary": "Resolve chat context to an MCU Infinity Saga story position.",
    "preferredFields": [
      "phase",
      "film",
      "beforeAfter",
      "majorEvent"
    ],
    "ambiguousFallback": "use_window",
    "promptAddendum": "Prefer before/after film or major event windows over invented exact dates.",
    "aliases": {
      "before Civil War": {
        "anchorTo": "mcu.civil_war"
      },
      "after Ultron": {
        "anchorFrom": "mcu.age_of_ultron"
      }
    }
  }
}
```

## Tags

Tags should be first-class. They should support search, filtering, bulk edit, scoring, health checks, and cross-pack concept alignment.

Tags exist at multiple levels:

- Pack tags.
- Entry tags.
- Anchor tags.
- System tags.

Examples:

```text
hp:magic
hp:wand-magic
sw:force
sw:jedi
meta:crossover
meta:secret
meta:future-guard
era:ootp
character:hermione-granger
character:luke-skywalker
```

### Tag Registry Draft

```json
{
  "schemaVersion": 1,
  "tags": {
    "hp:horcruxes": {
      "label": "Horcruxes",
      "color": "#4c1d95",
      "description": "Horcrux-related lore, knowledge gates, and spoiler guards.",
      "aliases": [
        "horcrux",
        "soul-fragment"
      ],
      "parents": [
        "hp:dark-magic"
      ],
      "sensitive": true,
      "deprecated": false
    }
  }
}
```

### Tag UX

The Lorepack tab should eventually include a Tag Manager:

- Search tags.
- Filter entries by `ANY`, `ALL`, and `NOT`.
- Bulk add tags.
- Bulk remove tags.
- Rename tags.
- Merge duplicate tags.
- Show undefined tags.
- Show deprecated tags.
- Show entries affected by a tag.
- Edit tag labels, colors, descriptions, aliases, and parent tags.

## Pack Health

Pack Health should be advisory, not gatekeeping.

Saga should say:

```text
Pack Health helps creators find likely issues. It never decides whether a pack is allowed to run.
```

Only technical failures should block loading, such as invalid JSON or missing required IDs. Content quality issues should be warnings or suggestions.

### Health Categories

Errors:

- Invalid JSON.
- Missing manifest.
- Missing required pack ID.
- Duplicate entry IDs inside the same pack.
- Unsupported schema version with no migration path.
- Broken required file reference.

Warnings:

- Duplicate pack loaded twice.
- Pack appears to be an unedited duplicate of another loaded pack.
- Missing dependencies.
- Undefined tags.
- Broken anchor references.
- Invalid date or position window.
- Entries with no injection text.
- Very long entries.
- Entries that look like broad wiki summaries.
- Entries with weak scope.
- Entries with no tags.
- Entries not eligible under any known Story Position.

Suggestions:

- Add tags.
- Add scope characters/topics/locations.
- Split very broad entries.
- Convert glossary-style entries into specific constraints.
- Add resolver aliases.
- Add category counts or pack description.

### Health Report Draft

```json
{
  "packId": "mcu-infinity-saga",
  "status": "good",
  "errors": [],
  "warnings": [
    {
      "code": "undefined_tag",
      "message": "Tag character:scarlet-witch is used but not defined.",
      "entryIds": [
        "mcu_wanda_public_after_sokovia"
      ]
    }
  ],
  "suggestions": [
    {
      "code": "missing_scope",
      "message": "12 entries have no scope fields. Add characters, topics, or locations to improve retrieval."
    }
  ],
  "summary": {
    "entryCount": 420,
    "errorCount": 0,
    "warningCount": 8,
    "suggestionCount": 31
  }
}
```

### Runtime Health Report Slice

The first runtime Pack Health report should show:

- Active stack status and summary counts.
- Loaded entry/file counts.
- Error, warning, and suggestion lists.
- Per-pack health rows.
- Custom override/addition/disabled-entry counts.
- Duplicate entry IDs resolved by stack priority.
- Likely duplicate Custom pack insights.
- Exportable `saga-pack-health.json`.

This report remains advisory. Users can still load and use packs with warnings.

## Duplicate And Conflict Handling

Do not overbuild semantic conflict detection for v1.

Crossovers and AUs intentionally contradict canon. Saga should not run large model calls to decide which lore is "true" across thousands of entries.

Initial conflict handling should focus on deterministic pack hygiene:

- Same pack ID loaded twice.
- Same source pack loaded under two names.
- Duplicate entry IDs.
- Identical content fingerprints.
- Near-identical title plus subject plus position window.
- Custom pack derived from a Bundled Lorepack loaded alongside the original with mostly identical entries.
- Missing dependencies.
- Broken tag or anchor references.
- Explicit `replaces`, `suppresses`, or `derivedFrom` metadata if present.

Actual AU contradictions should usually be handled by:

- Accepted story lore outranking Lorepack lore.
- Stack order affecting score.
- Custom packs being placed above Bundled packs.
- User review in Pending Lore Review.

## Relevance, Suggest Lore, And Preprocessing

Lorepack priority should influence but not dominate relevance.

Draft scoring shape:

```text
finalScore =
  storyPositionMatch
+ anchorProximity
+ dateMatch
+ tagOverlap
+ characterMatch
+ locationMatch
+ topicMatch
+ entryPriority
+ lorePurposeBoost
+ packStackBoost
+ sourceConfidenceBoost
- duplicatePenalty
- brokenReferencePenalty
```

Accepted chat-specific story lore should stay outside the Lorepack stack and rank above all loaded packs.

Suggested Lore should show which pack each candidate came from. Pack source chips should be visible on preview cards and pending entries.

Preprocessing should consider:

- Active Lorepack Stack order.
- Lorepack Context / Story Position.
- Tags.
- Entry position gates.
- Current scene characters, locations, and topics.
- Canon/AU status.
- Pack type: Bundled, Custom, Generated.
- Pack Health warnings.

Generated packs should not be blocked from injection, but their source should be visible and their confidence may start lower until user-reviewed.

## Lorepack Manifest Draft

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
    "url": ""
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
    "knowledge_gates/core_knowledge_gates.json"
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

## Import, Export, And Updates

Saga should support pure-data Lorepacks only. No executable code should be allowed inside packs.

Import sources:

- Local JSON.
- Local zip.
- URL.
- GitHub URL.

Export targets:

- Single JSON bundle.
- Zip bundle.

Update support:

- Custom Lorepacks imported from GitHub or URL can remember their source.
- Users can check for updates.
- Saga can compare version, manifest ID, and content hash.
- Updates should never overwrite user-edited local changes without explicit confirmation.
- If a user edits an imported Custom Lorepack, Saga should mark it as locally modified.

This source/update metadata is internal. The UI type remains Custom Lorepack.

## Lorepack Creator

The built-in Lorepack Creator is a major differentiating feature.

It should create Generated Lorepacks from:

- Fandom and scope entered by the user.
- User notes.
- Existing chat/story history.
- Pasted outline.
- Existing Lorepack used as a starting point.
- Model knowledge, clearly marked as generated and lower confidence.

The creator should produce reviewable draft entries, not pretend to produce final authority packs.

### Creator Flow

1. Choose fandom and scope.
2. Choose timeline style: date, arc, phase, season/episode, anchor window, hybrid.
3. Define spoiler boundary or story position.
4. Generate/propose timeline anchors.
5. Generate/propose tags.
6. Generate candidate lore entries in batches.
7. Run Pack Health.
8. Review entries in a workbench.
9. Bulk edit, accept, reject, merge, or regenerate.
10. Save as Generated Lorepack.
11. Optional: user marks as reviewed and converts to Custom Lorepack.

### Creator Quality Goals

The generator should prefer specific constraints:

```text
Before Civil War, Tony should not treat the Sokovia Accords as enacted law.
```

It should avoid broad wiki facts:

```text
Tony Stark is Iron Man and a genius billionaire.
```

Generated entries should include:

- Title.
- Category.
- Canon/AU.
- Relevance.
- Priority.
- Lore purpose.
- Tags.
- Scope.
- Story Position gates.
- Fact text.
- Injection text.
- Constraints and anti-lore when useful.
- Confidence.
- Source note or generation note.

## Lorepack Editor

The Lorepack tab should eventually include a full editor, similar in spirit to the accepted/pending lore workbenches.

Required views:

- Pack Library.
- Active Stack.
- Pack Detail.
- Entry Workbench.
- Bulk Edit.
- Tag Manager.
- Timeline / Story Position Editor.
- Resolver Alias Editor.
- Pack Health Report.
- Import / Export / Update.
- Lorepack Creator.

### Entry Workbench

The entry workbench should support:

- Search.
- Category filters.
- Tag filters.
- Pack source filters.
- Relevance filters.
- Canon/AU filters.
- Story Position filters.
- Bulk category edit.
- Bulk tag add/remove.
- Bulk priority edit.
- Bulk relevance edit.
- Bulk canon/AU edit.
- Bulk scope edit where safe.
- Duplicate detection.
- Entry clone.
- Entry disable.
- Entry delete.

## Migration From Wandlight

The migration should be behavior-preserving first.

Milestone 1 should not change how current Harry Potter lore suggestions work. It should only route them through the new Lorepack structure.

Migration tasks:

1. Rebrand manifest and UI to Saga.
2. Preserve old `wandlight` settings and chat state keys.
3. Add `saga` state while reading legacy Wandlight state.
4. Keep old Wandlight slash commands as aliases.
5. Add new Saga slash commands.
6. Move current `Lore/` data into `Lorepacks/hp-golden-trio/`.
7. Keep legacy `Lore/manifest.json` fallback temporarily.
8. Update canon loader to load active Lorepack files.
9. Add single active Lorepack defaulting to Harry Potter: Golden Trio.
10. Add stack state and UI after single-pack loading is stable.

## MVP

The first shippable Saga milestone should include:

- Product rename to Saga with Wandlight compatibility.
- Current Harry Potter data converted into a Bundled Lorepack.
- Lorepack manifest and loader.
- Single active Lorepack support.
- Lorepack tab rail button above the existing tabs.
- Lorepack Library and Active Stack UI skeleton.
- Pack cards with title, description, type, entry count, category counts, and tags.
- Active stack order stored per chat.
- Canon suggestions still working through the Lorepack loader.
- Basic Pack Health for manifest, duplicate IDs, missing files, undefined tags, and entry counts.

Do not include the full Lorepack Creator in MVP. Design for it, then build it after the loader, stack, and editor foundations exist.

## Later Milestones

### Milestone 2: Multi-Pack Runtime

- Load multiple packs at once.
- Priority-aware scoring.
- Source chips on suggested/pending lore.
- Stack reorder UI.
- Duplicate pack warnings.
- Category totals across stack.

### Milestone 3: Story Position

- Timeline registry.
- Pack-specific Lorepack Context.
- Manual Story Position selector.
- Anchor aliases.
- Basic local resolver.
- Model fallback resolver.
- Position-aware retrieval.

### Milestone 4: Editor And Pack Health

- Entry workbench.
- Bulk edit.
- Tag manager.
- Timeline editor.
- Expanded Pack Health.
- Import/export JSON.
- Import/export zip.

### Milestone 5: Custom Pack Sharing

- Import from URL.
- Import from GitHub URL.
- Source metadata.
- Check for updates.
- Version/hash comparison.
- Local modification warnings.

### Milestone 6: Lorepack Creator

- Creator wizard.
- Timeline anchor generation.
- Tag generation.
- Entry generation.
- Batch review.
- Pack Health loop.
- Save as Generated Lorepack.
- Convert reviewed Generated Lorepack to Custom Lorepack.

## Open Questions

- Should pack stack order be global, per character, per chat, or both global default plus per-chat override?
- Should Story Position be edited in the Context tab, Lorepack tab, or both?
- How much of Pack Health should run live versus on demand?
- Should generated packs be allowed to auto-suggest immediately, or should they require a first review pass?
- How should Saga represent manga/anime divergence, where arcs exist in multiple adaptation orders?
- Should pack updates merge at entry level or replace the whole pack when unmodified?
- What is the minimum useful Story Position schema for MVP?
- Should tag namespaces be required for Bundled packs?

## Risks

### Story Position Complexity

Risk: The abstraction becomes too complex and delays the project.

Mitigation: MVP can keep the old date-based HP behavior and introduce Story Position as schema first, UI second.

### Lorepack Editor Scope

Risk: The editor becomes a project inside the project.

Mitigation: Start with pack library, stack, and read-only detail views. Add editing after loading works.

### Generated Lorepack Quality

Risk: Generated packs hallucinate, overgeneralize, or become wiki dumps.

Mitigation: Generated packs are drafts. Use review, Pack Health, confidence metadata, and source notes.

### Duplicate Custom Packs

Risk: Users load duplicated or barely edited packs together.

Mitigation: Deterministic duplicate detection and stack warnings.

### Wandlight Compatibility

Risk: Existing chats lose state or behavior.

Mitigation: Preserve legacy keys, fallback loader paths, and slash command aliases until migration is mature.

### Performance

Risk: Loading many large packs slows preview and relevance scoring.

Mitigation: Build a runtime index, cache loaded manifests, score candidates in stages, and cap expensive operations.

## Immediate Next Steps

1. Finalize this pre-production document.
2. Draft concrete JSON schemas for `lorepack.json`, `timeline.json`, `tags.json`, and stack state.
3. Add a `Lorepacks/hp-golden-trio/` directory and move/copy current HP lore data into it.
4. Add a Lorepack loader that can read the new manifest while preserving the old `Lore/manifest.json` fallback.
5. Add a placeholder Lorepack rail tab above existing runtime tabs.
6. Route current canon suggestions through the active Lorepack.
