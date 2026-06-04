# Saga Pre-Production

**SAGA: Fandom Loresystem.**

Terminology note: Saga's public language is **Loredeck**, **Lorecard**, and **Deck Health**. Internal code, schema keys, folder names, and migration notes may still use `lorepack`, `packId`, `Lorepacks/`, and `lorepack.json` until the compatibility alias pass is designed and tested.

## Purpose

Saga is the planned evolution of Wandlight from a Harry Potter-focused SillyTavern lore extension into SAGA: Fandom Loresystem, a general framework for fandom-specific, date-aware, arc-aware, and story-position-aware lore support.

Wandlight already proves the core product idea:

- A local canon constraint database is useful because LLMs are lore-rich but timeline-poor.
- Proposed lore should enter review before it affects generation.
- Durable story lore and lightweight continuity should be separate systems.
- Prompt injection needs relevance tiers, placement controls, and compression.

Saga keeps that foundation and generalizes the fandom-specific layer into Loredecks.

## Product Thesis

Saga should be a lore arbitration framework, not a wiki browser.

The extension should help users answer:

- What lore is true at this point in the story?
- What facts are not known yet?
- What future canon should not leak?
- What has this specific chat changed?
- Which loaded fandom decks should influence the next prompt?
- Which lore is important enough to inject now?

Saga should support single-fandom campaigns, alternate universes, crossovers, custom settings, and user-created decks without forcing every fandom into Harry Potter's calendar-shaped structure.

Saga's lore target is high-value scene context, not wiki completeness. A good Saga entry should change how the model writes a scene: what characters know, hide, want, fear, misunderstand, expect, avoid, or react to at the current Story Position.

## Product Terms

Only three Loredeck types should be exposed in the UI.

### Bundled Loredeck

A Loredeck shipped with Saga. These are tailored and human-vetted for quality.

Examples:

- Harry Potter: Golden Trio
- Hogwarts Legacy
- Star Wars Legends: New Republic Era
- MCU: Infinity Saga
- Star Trek: TNG + DS9 + VOY

### Generated Loredeck

A draft Loredeck created by Saga's built-in creator tool. Generated Loredecks are useful immediately but should be treated as unvetted until reviewed by the user.

### Custom Loredeck

Any user-made, user-edited, user-shared, imported, duplicated, AU, crossover, or original Loredeck.

Custom Loredecks can be small or canon-scale. A crossover deck is simply a Custom Loredeck with entries that connect or reinterpret other loaded decks.

Do not expose "bridge deck", "overlay", "installed deck", or "forked deck" as user-facing product terms. Internally, Saga may still track source, derivation, and update metadata.

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

Add a dedicated Loredeck rail button above the existing runtime tabs. This button opens the Loredeck tab, which owns all deck loading, editing, importing, exporting, health checks, and creation workflows.

Current rail order should evolve toward:

1. Loredecks
2. Session
3. Context
4. Continuity
5. Lore
6. Injection
7. Settings

The Loredeck tab is intentionally above the rest because the active Loredeck stack determines what Context, Lore, Relevance, and Injection mean.

The existing Lore tab should continue to handle chat-specific pending and accepted lore. The new Loredeck tab handles source decks.

The Settings tab should sit at the end because it configures Saga itself rather than the active roleplay state. It now absorbs the extension-menu API settings so users can configure providers from the same runtime surface they use during play.

## Runtime Settings And Themepacks

Saga's runtime Settings tab has three main areas:

- Provider settings: Utility provider and Reasoning provider configuration, including profile selection, OpenAI-compatible endpoint settings, generation parameters, and test actions.
- Appearance settings: colors, density, rail/drawer styling, card surfaces, borders, accent colors, status colors, and text contrast.
- Themepacks: named presets that bundle appearance colors and icon/button theme metadata.

The extension-menu settings panel remains as a compatibility and recovery surface. The runtime Settings tab is the primary user-facing home for provider controls.

### Themepack Draft

Themepacks should be pure data, like Loredecks. They should not contain executable code.

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
    "brand.compact": "./Images/branding/saga-s-256.png",
    "brand.expanded": "./Images/branding/saga-banner-512.png",
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

Accessibility should be handled like Deck Health: advisory and visible, not gatekeeping. The runtime Settings tab should report contrast checks for primary text, muted text, button text, accent controls, focus rings, and danger surfaces. Targets should follow common WCAG-style ratios: 4.5:1 for normal text and 3:1 for UI affordances.

## Loredeck Stack

Saga should support loading multiple Loredecks at the same time.

The active stack is ordered from highest priority to lowest priority:

```text
1. My HP/SW Custom Crossover
2. Harry Potter: Golden Trio
3. Star Wars Legends: New Republic Era
```

Pack priority should influence retrieval, suggestion, preprocessing, and relevance scoring. It should not blindly delete lower-priority entries.

Accepted story lore created in the current chat always outranks Loredeck entries.

### Loader UI

The Loredeck tab should include a two-column loader workbench.

Left column: Loredeck Library

- Search bar.
- Filters by type, fandom, era, tags, author, source, health status, installed/bundled/custom/generated.
- Pack cards with title, description, type, entry count, category counts, tags, version, source, and health summary.

Right column: Active Stack

- Loaded Loredecks in priority order.
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

Saga should keep Loredeck library metadata globally, while each chat keeps only its active stack and per-deck story context.

Global extension settings own:

- Bundled, Custom, and Generated Loredeck metadata.
- Manifest paths or source URLs.
- Update metadata.
- Deck tags, author, version, source, and cached stats.

Per-chat state owns:

- `lorepackStack`: loaded pack IDs, enabled state, and order.
- `lorepackContexts`: Story Position per loaded pack.
- Chat-specific accepted lore and pending lore.

Older Wandlight/Saga builds temporarily stored `lorepackRegistry` in chat state. That registry remains a compatibility fallback, and opening an older chat should promote missing registry records into the global library when possible.

### Import/Export Staging

The first import/export slice should support:

- Registering a fetchable `lorepack.json` path or URL into the global library.
- Exporting global Loredeck Library metadata as JSON.
- Importing previously exported Loredeck Library metadata JSON.

This does not yet mean Saga can persist arbitrary local folder contents from a browser file picker. Browser-selected local manifests do not grant durable access to sibling entry files. Full local pack support should come through a zip importer or a SillyTavern-managed storage location.

For now, registered Custom Loredecks are expected to use manifest paths or URLs that remain fetchable by the browser. Entry files resolve relative to the registered manifest.

### Custom Duplicate Staging

Until Saga has durable zip/local pack storage, duplicating a pack creates a Custom Loredeck library record with:

- A new Custom pack ID and editable metadata.
- `derivedFrom` metadata pointing at the source pack.
- Embedded `manifestData` with the Custom identity.
- The source `manifest` path retained as the base for resolving entry files.

This makes the duplicate loadable immediately without writing a new folder. If the original and duplicate are both loaded, stack priority and duplicate-entry handling determine which entries win. Later entry-level editing can layer changed entries into the Custom pack.

The first entry-editing slice stores that layer as library metadata:

- `entryOverrides`: edited or newly added Lorecards keyed by entry ID.
- `disabledEntryIds`: source entry IDs suppressed by the Custom pack.
- `timelineRegistry`: accepted Custom/Generated timeline anchor/window overlays, including disabled source anchor/window IDs.
- `tagRegistry`: accepted Custom/Generated tag definition overlays.
- `pendingChanges`: proposed entry, tag, disable, delete, or bulk edits awaiting review.

The loader applies these before Deck Health and canon database normalization, so the active stack sees the Custom pack's edited entry set instead of the untouched source files.

Pending changes are not applied by the loader. They become runtime-active only after the user accepts them in the Pending Review Queue.

## Story Position And Loredeck Context

Wandlight currently centers on a story date. Saga needs a more general primitive: Story Position.

Story Position answers:

```text
Where is this chat located inside this Loredeck's canon or story structure?
```

For Harry Potter, that may be a calendar date and school year.

For MCU, that may be "after Age of Ultron, before Civil War."

For My Hero Academia, that may be a school arc or anime/manga arc.

For Star Trek, that may be a season, episode range, stardate, or Dominion War phase.

For Star Wars, that may be BBY/ABY, era, conflict, book series, or before/after a major event.

Coverage determines what a Loredeck contains. Story Position determines what Saga is allowed to inject from that pack at runtime.

This distinction matters for large and modular fandom packs. A Loredeck can contain future canon as long as its entries are position-native and properly gated. Saga should prevent future canon leakage through Story Position eligibility, exclusionary lore, retrieval scoring, and manual locks, not through a pack-level spoiler boundary.

### Loredeck Context

Each loaded Loredeck can have its own context slot.

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
- Every loaded Loredeck receives a Story Position slot.
- The Loredecks tab exposes a manual editor for date, label, branch, arc, phase, season, episode, chapter, issue, quest, game stage, anchors, alias, notes, source, confidence, and manual lock.
- Manual field edits set `source: "manual"`, `manualLock: true`, and high confidence by default.
- The editor can seed a pack position from the legacy Story Context fields while Saga transitions from one global date to per-deck positions.
- Automated alias/model resolvers should respect `manualLock` in later slices.

### Timeline Modes

Loredecks should declare what kind of story position they support.

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

### Timeline Registry Editor

The Timeline Registry Editor defines a Loredeck's Story Position coordinate system. It does not primarily edit Lorecards. It edits the map that entries attach to.

The editor should support three primary object types:

- Anchors: specific story positions, such as `Harry arrives at Hogwarts`, `Arlong Park begins`, `Battle of New York`, `Episode 31`, or `Chapter 69`.
- Windows: ranges across the story, such as `First Year`, `Arlong Park Arc`, `Book One: Water`, `Infinity Saga`, or `Post-Marineford`.
- Coordinates: normalized ordering values and optional media fields that let Saga compare story positions across date-heavy and date-light fandoms.

The registry should work for many timeline styles:

- Date-driven timelines, such as Harry Potter.
- Arc-driven timelines, such as One Piece or My Hero Academia.
- Episode/chapter-driven timelines, common in anime and manga.
- Phase-driven timelines, such as MCU.
- Era-driven timelines, such as Star Wars.
- Artificial indexed timelines, where Saga creates stable sort keys because the fandom has no reliable hard dates.

Required editor tools:

- Searchable anchor/window list.
- Anchor and window create/edit/duplicate/delete.
- Stable ID editing with duplicate warnings.
- Label, alias, tag, date range, sort key, and notes editing.
- Start/end anchor selection for windows.
- Bulk edit for aliases, tags, sort-key ranges, labels, and window assignment.
- Drag/reorder support where a registry uses artificial ordering.
- Preview of Lorecards attached to an anchor or window.
- Validation for duplicate IDs, dangling window references, invalid sort ranges, missing labels, malformed dates, and anchors that are referenced by entries but absent from the registry.

Large registries should be expected. Harry Potter alone may eventually have hundreds or thousands of anchors when dates, events, school years, knowledge reveals, and wide windows are all represented. That is acceptable if the editor and runtime use:

- Stable IDs instead of labels as references.
- Numeric sort keys for comparisons.
- Cached lookup maps.
- Indexed local search.
- Lazy UI rendering.
- Deck Health warnings instead of fragile hard failures for advisory issues.

The Timeline Registry Editor should use model assistance heavily because building large registries by hand is tedious. The model can draft anchors, windows, aliases, artificial sort keys, missing-event suggestions, and bulk revisions. The model should not silently mutate the registry. It should return structured patches with before/after previews that the user accepts, rejects, or edits.

### Timeline Registry Editor MVP

The first production slice is implemented as a Custom/Generated overlay editor rather than a direct `timeline.json` file writer.

Implemented MVP behavior:

- Loads source `timeline.json` into the editor cache when available.
- Shows source plus accepted Custom timeline overlays in one searchable anchor/window list.
- Displays source/custom/disabled/undefined state chips.
- Displays loaded-entry attachment counts for anchors and windows.
- Creates and edits anchors with stable IDs, labels, sort keys, dates, arc/phase/episode/chapter fields, aliases, tags, and notes.
- Creates and edits windows with stable IDs, labels, start/end anchors, sort-key bounds, dates, aliases, tags, and notes.
- Queues anchor/window saves, overlay removal, and source definition enable/disable actions through Pending Review.
- Accepting timeline proposals updates the library record's `timelineRegistry`.
- Runtime Story Position indexing and Deck Health merge source `timeline.json` with accepted `timelineRegistry` overlays.
- Export Timeline downloads the active merged timeline registry for review or external pack authoring.

Not included yet:

- Drag/reorder artificial sort-key editing.
- Timeline bulk edit operations.
- AI-assisted timeline generation and revision.
- Visual timeline graphing.
- Direct durable writes to local pack folders or zip contents.

### Position Index v1 Implementation

Step 3 adds a runtime Story Position Index:

- `registries.timeline` points at a Loredeck-owned `timeline.json`.
- `story-position-index.js` loads timeline registries from enabled Loredecks.
- The aggregate index preserves pack priority, stack order, anchor IDs, aliases, tags, dates, arcs, phases, and media-specific coordinates.
- The Loredecks tab shows index status and per-deck anchor counts.
- The Story Position editor can search a pack's local anchors and apply one into normalized Loredeck Context.

The first concrete registry is `Lorepacks/hp-golden-trio/timeline.json`. It includes Golden Trio book/year anchors, major event anchors, and broad windows like pre-Hogwarts, canon Hogwarts years, and post-war.

Design constraint: missing timeline registries are allowed. Saga should treat timeline support as a Deck Health/advisory dimension, not as a hard validity gate, because some Custom Loredecks may be scenario-first, keyword-first, or still under construction.

### Local Resolver v1 Implementation

Step 4 adds a local, non-model resolver:

- `story-position-resolver.js` resolves unlocked loaded Loredecks from current Story Context.
- Date matching compares `sceneDate` / `subjectiveDate` against pack-local anchor date ranges.
- Alias matching searches anchor labels, aliases, tags, books, arcs, phases, and other timeline fields.
- Manual locks are respected unless a future caller explicitly forces overwrite.
- Context detection now runs the local Story Position resolver after header/model/local Story Context detection.
- The Loredecks tab can manually run `Resolve From Context`.

This keeps the common path free: a structured reply header or clear context note can update pack-specific Story Position without a model call.

### Model Fallback Resolver v1 Implementation

Step 5 adds a controlled model fallback:

- The Loredecks tab exposes `Model Fallback`.
- The action first applies confident local matches, then sends only unresolved unlocked Loredecks to the Reasoning Provider.
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

Saga v3 entries should not use entry-local date gates. Calendar dates belong in `timeline.json`, and entries should reference the resolved Story Position:

```json
{
  "position": {
    "scope": "window",
    "validFromAnchor": "hp.ootp.year_5",
    "validToAnchor": "hp.ootp.year_5",
    "sortKeyFrom": 9374,
    "sortKeyTo": 9739,
    "precision": "school_year_window",
    "windowKind": "school_year",
    "label": "Year 5: Order of the Phoenix"
  }
}
```

### Story Position Resolution

Resolution should happen in three layers:

1. Manual user selection.
2. Local alias/header matching.
3. Model fallback using Loredeck resolver instructions.

Manual selection should be the preferred and most trusted path. Users should be able to search anchors, choose before/after windows, set approximate eras, and lock the result.

Local alias matching should use:

- Structured headers.
- User notes.
- Loredeck anchor aliases.
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

- Deck tags.
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

The Loredeck tab should eventually include a Tag Manager:

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

## Deck Health

Deck Health should be advisory, not gatekeeping.

Saga should say:

```text
Deck Health helps creators find likely issues. It never decides whether a deck is allowed to run.
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
- Deprecated tags used by entries.
- Duplicate tag aliases.
- Malformed tag namespaces.
- Orphaned tag definitions.
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

The first runtime Deck Health report should show:

- Active stack status and summary counts.
- Loaded entry/file counts.
- Error, warning, and suggestion lists.
- Per-Deck Health rows.
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
- Custom pack derived from a Bundled Loredeck loaded alongside the original with mostly identical entries.
- Missing dependencies.
- Broken tag or anchor references.
- Explicit `replaces`, `suppresses`, or `derivedFrom` metadata if present.

Actual AU contradictions should usually be handled by:

- Accepted story lore outranking Loredeck lore.
- Stack order affecting score.
- Custom packs being placed above Bundled packs.
- User review in Pending Lore Review.

## Relevance, Suggest Lore, And Preprocessing

Loredeck priority should influence but not dominate relevance.

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

Accepted chat-specific story lore should stay outside the Loredeck stack and rank above all loaded packs.

Suggested Lore should show which pack each candidate came from. Pack source chips should be visible on preview cards and pending entries.

Preprocessing should consider:

- Active Loredeck Stack order.
- Loredeck Context / Story Position.
- Tags.
- Entry position gates.
- Current scene characters, locations, and topics.
- Canon/AU status.
- Pack type: Bundled, Custom, Generated.
- Deck Health warnings.

Generated packs should not be blocked from injection, but their source should be visible and their confidence may start lower until user-reviewed.

## Loredeck Manifest Draft

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

Saga should support pure-data Loredecks only. No executable code should be allowed inside packs.

Import sources:

- Local JSON.
- Local zip.
- URL.
- GitHub URL.

Export targets:

- Single JSON bundle.
- Zip bundle.

Update support:

- Custom Loredecks imported from GitHub or URL can remember their source.
- Users can check for updates.
- Saga can compare version, manifest ID, and content hash.
- Updates should never overwrite user-edited local changes without explicit confirmation.
- If a user edits an imported Custom Loredeck, Saga should mark it as locally modified.

This source/update metadata is internal. The UI type remains Custom Loredeck.

## Loredeck Creator

The built-in Loredeck Creator is a major differentiating feature.

It should create Generated Loredecks from a small, natural-language intake:

- Fandom.
- Loredeck scope / coverage range.
- Granularity.

Optional supporting context can include user notes, existing chat/story history, a pasted outline, or an existing Loredeck used as a starting point. These should help generation without becoming required front-door questions.

The creator should not feel like a taxonomy form. It should feel like the user asks for the pack they want, Saga narrows scope when needed, then shows reviewable drafts before spending model calls on full entries.

### Creator Intake

The only front-facing required fields should be:

1. Fandom.
2. Loredeck Scope / Coverage Range.
3. Granularity.

Do not ask casual users to define adaptation, continuity, canon line, intended use, spoiler boundary, included/excluded characters, or approximate entry count during the core flow.

Saga is for long-form fanfic and roleplay, so intended use is already known. Fandoms should be treated broadly unless the user naturally scopes the pack to a distinct source line in plain language, such as `Star Wars Legends`, `MCU`, or `Hogwarts Legacy`. That source distinction belongs in the pack title, scope, source notes, and generated metadata, not as a required abstract intake question.

Approximate entry count should not be front-facing. Saga should derive it dynamically from:

- Scope size.
- Story density.
- Number of major characters.
- Number of factions/groups.
- Number of locations.
- Number of major events.
- Number of power systems, items, concepts, or social rules.
- Chosen granularity.

The user chooses density, not a number. Saga may estimate count internally after it understands the scope, but the review surface should focus on granularity, coverage, and generated title batches rather than asking the user to approve a number.

Granularity presets:

- Lean: core characters, core setting, essential events, and must-not-leak constraints only.
- Standard: major cast, major locations, important relationships, key events, factions, and core concepts.
- Detailed: secondary cast, sub-events, recurring objects, faction details, local social context, and more retrieval metadata.
- Exhaustive: minor cast, granular timeline moments, aliases, variants, edge-case concepts, dense tags, and dense Story Position metadata.

### Creator Scope Negotiation

Many users will request something too broad, such as `One Piece Loredeck` or `Marvel Loredeck`.

Saga should respond by helping narrow the request to a useful coverage range:

- An arc.
- A book.
- A season.
- A game chapter.
- A film phase.
- A tightly bounded era.
- A character-centered slice if the user is intentionally creating a focused pack.

The assistant should avoid overwhelming the user with formal options. It should ask a small number of practical clarifying questions only when the request is too large or ambiguous.

Good scope:

```text
One Piece: Arlong Park Arc, standard granularity.
```

Too broad:

```text
One Piece, exhaustive granularity.
```

The output of scope negotiation should be a short pack brief:

- Fandom.
- Coverage range.
- Granularity.
- Expected timeline style inferred by Saga.
- Derived generation scale kept as internal planning data.
- Any assumptions Saga will use.

The user approves or revises the brief before generation proceeds.

### Creator Readiness Gate

Before Saga begins full Loredeck Creator development, the review layer must be strong enough to safely inspect model-generated batches.

The Creator will eventually generate timelines, tag registries, title lists, and entry batches. That means a weak Pending Review surface would make generated packs feel opaque and risky. The next production work should harden review before broad generation:

- Field-level diffs for entries, tags, timeline anchors, and timeline windows.
- Clear proposal provenance, especially `lore_assistant`, `manual`, `bulk_edit`, `safe_repair`, and later `creator`.
- Assistant proposal reason, confidence, and risk display.
- Deck Health rerun or stale-health warning after accepting generated or assistant patches.
- Acceptance warnings for changes that affect Story Position gates, disable entries, create undefined tags, or alter timeline anchors/windows.
- Batch review affordances so generated title and entry batches can be accepted, rejected, or revised in chunks.

This is the bridge from Lore Assistant MVP to Loredeck Creator. The Creator should reuse the same Pending Review and diff machinery instead of inventing a separate approval workflow.

### Creator Flow

1. User requests a Loredeck.
2. Saga identifies fandom, coverage range, and granularity.
3. Saga narrows vague or oversized scope when needed.
4. Saga produces a pack brief with assumptions and internal derived generation scale.
5. User approves or revises the brief.
6. Saga drafts entry titles only as a reviewable planning batch.
7. User adds, removes, merges, splits, revises, or approves titles.
8. Saga drafts timeline anchors/windows and tag/entity definitions appropriate to the approved coverage and title shape.
9. User reviews the timeline/tag planning proposals in Pending Review.
10. User accepts selected planning metadata into the Generated Loredeck.
11. Saga uses accepted planning metadata plus approved titles as the full-entry generation context.
12. Saga drafts full schema v3 entries for approved titles into an edit-before-queue draft batch.
13. User reviews, edits, drops, revises, or queues selected entry drafts into Pending Review.
14. User accepts selected entry proposals into the Generated Loredeck.
15. Saga runs Deck Health and export validation on the accepted Generated Loredeck.

No full card generation should happen until the scope, title list, timeline, and tag/entity registry have been reviewed.

The initial title pass is intentionally allowed before timeline and tag generation because titles are cheap to review and expose scope mistakes early. Approved titles are not entries; they are planning records that guide later timeline, tag, and full-entry stages.

### Coverage Versus Injection

The creator should not ask for a spoiler boundary as a required field.

A Loredeck's coverage range determines what Saga generates. Story Position determines what Saga injects.

For example, an `Arlong Park Arc` pack can contain late-arc reveals and consequences. Those entries should not inject before their Story Position becomes eligible. This is handled by `position`, timeline anchors/windows, exclusionary lore, retrieval scoring, and current Loredeck Context.

### Creator Quality Goals

The creator should generate usable roleplay/fanfic context, not wiki summaries.

The generator should prefer specific scene constraints:

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

### Lore Value Rubric

Saga should steer generation and revision toward high-value lore. A strong entry should score well on most of these criteria:

- Scene Utility: improves dialogue, action, tension, characterization, or setting behavior.
- Activation Clarity: has a clear Story Position, window, trigger, or retrieval purpose.
- Behavioral Impact: changes what characters do, say, know, believe, hide, avoid, or expect.
- Relationship Impact: affects trust, suspicion, allegiance, intimacy, rivalry, family pressure, or social standing.
- Conflict / Stakes: adds meaningful danger, obligation, taboo, mystery, leverage, consequence, or pressure.
- Non-Redundancy: is distinct from nearby entries and does not repeat generic canon summary.
- Injection Quality: is concise, direct, and useful when placed into the prompt.
- Story Position Fit: avoids future leakage and matches the intended activation window.

The creator should use the rubric in title generation, content generation, revision, and Deck Health suggestions.

Strong title examples:

- `Nami hides her bargain with Arlong`.
- `Arlong Park villagers live under tribute pressure`.
- `Zoro is badly wounded after Mihawk`.

Weak title examples:

- `Nami biography`.
- `Arlong facts`.
- `Cocoyasi Village summary`.

Deck Health should eventually warn softly when a Generated Loredeck has too many biography-style entries, vague activation, repeated summary content, bloated injections, missing tags, or no behavioral implication.

## Lore Assistant

The Lore Assistant is Saga's AI helper for creating, revising, repairing, and expanding Loredecks. It should be available from the Loredeck Creator, Loredeck Editor, Timeline Registry Editor, Tag Manager, Deck Health report, and Lorecards workbenches.

Core rule:

```text
The Lore Assistant proposes changes into Pending. Users promote them into Accepted.
```

The assistant is not the source of truth. Saga's schema, Story Position system, Deck Health checks, and user approval remain the authority.

### Assistant Capabilities

The assistant should support:

- Loredeck generation from fandom, coverage range, and granularity.
- Timeline anchor/window drafting.
- Tag and entity registry drafting.
- New entry suggestions.
- Existing entry revision.
- Bulk lore revision from natural-language instructions.
- Metadata repair for tags, scope, retrieval, category, and Story Position fields.
- Deck Health issue repair suggestions.
- Low-value lore cleanup, such as reducing wiki tone or splitting overloaded entries.

Example request:

```text
Arlong and crew are too kind. Revise their character cards to make them more evil.
```

For subjective revisions, the assistant should clarify intent before editing:

```text
Do you want them to be more openly sadistic, more manipulative, more greedy, more violent, or some combination?
```

After clarification, it should propose a patch across affected entries, not directly modify accepted content.

### Pending And Accepted Integration

Assistant output should flow through the same lifecycle as human-edited lore:

- Pending New Entry: a proposed new lore card.
- Pending Edit: a proposed change to an existing accepted entry.
- Pending Delete / Deprecation: a proposed removal, suppression, or retirement.

The assistant should never silently overwrite Accepted lore.

For a revision of existing entries:

1. User selects accepted entries.
2. User gives a revision instruction.
3. Assistant proposes field-level changes.
4. Proposed changes appear as Pending edits tied to their original entries.
5. User reviews diffs.
6. User accepts selected changes.
7. Accepted entries update only after approval.

For new entries:

1. Assistant proposes missing entries.
2. They enter as Pending new entries.
3. User reviews, edits, accepts, or rejects them.
4. Accepted entries become part of the Loredeck.

This workflow should apply to Generated, Custom, and imported Custom Loredecks. Bundled Loredecks remain read-only.

### Bundled Pack Protection

Bundled Loredecks should never be edited in place.

If a user wants to revise a Bundled pack through the assistant, Saga should force one of these paths:

- Duplicate it into an editable Custom Loredeck.
- Create Custom overrides layered above the Bundled Loredeck.

Assistant proposals may target Bundled content for review, but accepted results must save into user-owned editable data.

### Patch-Based Assistant Output

The assistant should return structured patches rather than raw rewritten files.

A patch should include:

- Target pack.
- Affected entries.
- Output mode: pending new, pending edit, or pending delete/deprecation.
- Field-level changes.
- Before/after preview.
- Reason for each change.
- Confidence or risk level.
- Whether the change is mechanical, metadata-focused, or creative.

The user should be able to:

- Accept all.
- Accept selected.
- Reject selected.
- Edit before accepting.
- Ask for another pass.

### Assistant Guardrails

The assistant should:

- Preserve IDs unless intentionally creating new entries.
- Preserve namespaced tags unless asked to change them.
- Avoid future canon leakage in entries whose Story Position is earlier.
- Use known timeline anchors instead of inventing anchor IDs.
- Ask clarifying questions for subjective creative changes.
- Avoid claiming perfect canon certainty.
- Prefer high-value scene context over wiki summaries.
- Run Deck Health after major changes.

### Lore Assistant Proposal Pipeline MVP

The first production slice is implemented as a safe proposal pipeline, not a full autonomous Loredeck generator.

Implemented MVP behavior:

- Adds a Lore Assistant panel to editable Custom/Generated Loredeck detail.
- Uses the configured Reasoning Provider.
- Sends the user instruction, selected mode, target scope, pack metadata, current Story Position, known tags, known timeline anchors, and up to 60 target entries.
- Supports modes for entry revision, missing-entry suggestions, tag drafting, timeline drafting, and mixed proposals.
- Requires JSON-only structured model output.
- Parses assistant responses with tolerant JSON/fence/reasoning cleanup.
- Supports assistant proposals for entry upserts, entry disable/restore, tag definitions, timeline anchors, and timeline windows.
- Converts supported proposals into the same `pendingChanges` record-patch shape used by manual tools.
- Marks proposal source as `lore_assistant`.
- Shows clarifying questions when the assistant asks instead of proposing patches.
- Pending Review now renders field-level diffs for entry, tag, and timeline record patches.
- Requests Lore Value Rubric metadata for assistant proposals and surfaces scene utility, behavioral impact, Story Position fit, wiki-summary risk, rubric notes, and local quality flags in Pending Review.
- Drafts now land in an Assistant Draft Batch first, where users can select proposals, queue selected/all into Pending Review, drop selected proposals, edit draft JSON, or ask the assistant to revise selected proposals before queueing.
- Deck Health validation issues can now be selected from the editor validation preview and sent to the Lore Assistant as repair-planning context; returned repairs land in the Assistant Draft Batch before Pending Review.
- Loredeck Creator intake now drafts an approval-gated pack brief from fandom, scope, granularity, and notes. The brief records internal derived generation scale, Story Position approach, timeline/tag/title-pass plans, assumptions, exclusions, risks, and next stage before any generated entries exist.
- Loredeck Creator title-pass and planning now generate reviewable titles first, then queue timeline anchors/windows and tag definitions onto a Generated Loredeck shell through Pending Review before full entry generation exists.
- Loredeck Creator entry drafting now uses accepted planning metadata plus approved titles to draft schema v3 entry proposals into the same edit-before-queue batch used by the Lore Assistant before they can enter Pending Review.
- Generated Loredecks now validate and export from accepted Creator entries without requiring a fetchable manifest path; the virtual generated manifest derives entry stats, local timeline/tag registries feed Deck Health, and export readiness blocks unresolved Pending Review or draft-batch state.
- Leaves runtime behavior unchanged until the user accepts queued Pending Review items.

Not included yet:

- Multi-turn assistant chat memory.
- Import/install/update polish for exported Loredeck bundles.
- Automatic Deck Health rerun after accepting assistant proposals.

## Loredeck Editor

The Loredeck tab should eventually include a full editor, similar in spirit to the accepted/pending lore workbenches.

Required views:

- Pack Library.
- Active Stack.
- Pack Detail.
- Entry Workbench.
- Pending Review Queue.
- Bulk Edit.
- Tag Manager.
- Timeline Registry Editor.
- Resolver Alias Editor.
- Deck Health Report.
- Import / Export / Update.
- Loredeck Creator.
- Lore Assistant panel.

### Entry Workbench

The entry workbench should support:

- Search.
- Category filters.
- Tag filters.
- Pack source filters.
- Entry state filters: source, override, pending new, pending edit, pending delete, accepted.
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
- Assistant revise selected entries.
- Assistant suggest missing entries from the current filter/search result.
- Diff preview for pending edits.
- Accept/reject selected pending changes.
- Promote accepted Bundled-pack edits into Custom overrides rather than mutating Bundled files.

### Pending Review Queue

The Pending Review Queue is the shared review surface for human and assistant proposals.

It should support:

- Pending new entries.
- Pending edits tied to accepted/source entries.
- Pending delete, deprecation, or disable proposals.
- Field-level diffs.
- Deck Health validation before acceptance.
- Accept all / accept selected / reject selected.
- Edit before accepting.
- Source chips showing whether a proposal came from manual editing, bulk editing, import repair, Deck Health repair, or Lore Assistant.

Accepted chat-specific story lore still outranks Loredeck entries at runtime. Pending Loredeck changes should not affect runtime injection until accepted.

Implementation status: the first Pending Review Queue stores pending changes on Custom/Generated Loredeck records, accepts or rejects individual/all proposals, and routes manual entry edits, entry disable/restore, bulk tag edits, bulk Story Position edits, tag definition edits, tag definition removal, and tag rename/merge through pending record patches.

## Migration From Wandlight

The migration should be behavior-preserving first.

Milestone 1 should not change how current Harry Potter lore suggestions behave at runtime. It should route them through the new Loredeck structure.

This does not mean reference Loredecks should preserve legacy entry schema. The bundled Harry Potter pack should be the example pack for Saga v3: Story Position-native, timeline-registry-driven, and free of legacy entry-local date gates.

Migration tasks:

1. Rebrand manifest and UI to Saga.
2. Preserve old `wandlight` settings and chat state keys.
3. Add `saga` state while reading legacy Wandlight state.
4. Keep old Wandlight slash commands as aliases.
5. Add new Saga slash commands.
6. Move current `Lore/` data into `Lorepacks/hp-golden-trio/`.
7. Keep legacy `Lore/manifest.json` fallback temporarily.
8. Update canon loader to load active Loredeck files.
9. Add single active Loredeck defaulting to Harry Potter: Golden Trio.
10. Add stack state and UI after single-pack loading is stable.

## MVP

The first shippable Saga milestone should include:

- Product rename to Saga with Wandlight compatibility.
- Current Harry Potter data converted into a Bundled Loredeck.
- Loredeck manifest and loader.
- Single active Loredeck support.
- Loredeck tab rail button above the existing tabs.
- Loredeck Library and Active Stack UI skeleton.
- Pack cards with title, description, type, entry count, category counts, and tags.
- Active stack order stored per chat.
- Canon suggestions still working through the Loredeck loader.
- Basic Deck Health for manifest, duplicate IDs, missing files, undefined tags, and entry counts.

Do not include the full Loredeck Creator in MVP. Design for it, then build it after the loader, stack, and editor foundations exist.

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
- Timeline Registry Editor foundation.
- Pack-specific Loredeck Context.
- Manual Story Position selector.
- Anchor aliases.
- Basic local resolver.
- Model fallback resolver.
- Position-aware retrieval.

### Milestone 4: Editor And Deck Health

- Entry workbench.
- Pending Review Queue.
- Bulk edit.
- Tag manager.
- Timeline Registry Editor.
- Expanded Deck Health.
- Import/export JSON.
- Import/export zip.

### Milestone 5: Custom Pack Sharing

- Import from URL.
- Import from GitHub URL.
- Source metadata.
- Check for updates.
- Version/hash comparison.
- Local modification warnings.

### Milestone 6: Loredeck Creator

- Simple creator intake: fandom, coverage range, and granularity.
- Scope negotiation and pack brief approval.
- Timeline anchor generation.
- Tag/entity registry generation.
- Entry title generation before full entry generation.
- High-value lore rubric.
- Batch entry generation.
- Pending review queue integration.
- Deck Health loop.
- Save as Generated Loredeck.
- Validate/export accepted Generated Loredecks.
- Convert reviewed Generated Loredeck to Custom Loredeck.

### Milestone 7: Lore Assistant

- Assistant panel in Loredeck Editor.
- Assistant panel in Timeline Registry Editor.
- Assistant panel in Tag Manager.
- Natural-language bulk revision.
- Structured patch output.
- Pending new/edit/delete proposals.
- Bundled-pack protection through Custom overrides or duplication.
- Deck Health repair suggestions.

## Open Questions

- Should pack stack order be global, per character, per chat, or both global default plus per-chat override?
- Should Story Position be edited in the Context tab, Loredeck tab, or both?
- How much of Deck Health should run live versus on demand?
- Should pack updates merge at entry level or replace the whole pack when unmodified?
- What is the minimum useful Story Position schema for MVP?
- Should tag namespaces be required for Bundled packs?
- How strict should low-value-lore Deck Health warnings be without discouraging fun user-made packs?
- What is the minimum assistant patch schema needed before we expose natural-language bulk editing?
- How large should generation batches be before review becomes tedious?

## Risks

### Story Position Complexity

Risk: The abstraction becomes too complex and delays the project.

Mitigation: MVP can keep the old date-based HP behavior and introduce Story Position as schema first, UI second.

### Loredeck Editor Scope

Risk: The editor becomes a project inside the project.

Mitigation: Start with pack library, stack, and read-only detail views. Add editing after loading works.

### Generated Loredeck Quality

Risk: Generated packs hallucinate, overgeneralize, or become wiki dumps.

Mitigation: Generated packs are drafts. Use staged generation, title-first review, Pending acceptance, Deck Health, confidence metadata, source notes, and the Lore Value Rubric.

### Assistant Overreach

Risk: The Lore Assistant rewrites too much, changes accepted entries without enough review, invents anchors, or flattens characterization into generic summaries.

Mitigation: Assistant output is patch-based, lands in Pending, preserves IDs and namespaced tags by default, uses known timeline anchors, and runs Deck Health before acceptance.

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

The initial Loredeck foundation is implemented: `hp-golden-trio` is scaffolded, the Loredeck loader preserves legacy `Lore/manifest.json` fallback, canon suggestions route through the active stack, the Loredeck tab owns library/stack workflows, Story Position v1 exists, Theme Packs exist, and provider settings now live in the runtime Settings tab.

Recent production completed **position-native Loredeck retrieval and HP reference-deck conformance**.

1. Done: normalize entry-level `position` metadata in the Lorecard pipeline.
2. Done: evaluate entry `position` gates against each loaded Loredeck's `lorepackContexts`.
3. Done: route position eligibility into canon suggestion candidate selection and relevance scoring.
4. Done: add visible source and position/gating chips on suggested and pending lore cards.
5. Done: expand Deck Health for broken anchor references, invalid position windows, and entries that can never match a known Story Position.
6. Done: migrate the bundled Harry Potter Loredeck to schema v3 Story Position-native entries with no legacy entry date gates.
7. Done: generalize the HP v3 conformance baseline into reusable Deck Health checks for schema v3 shape, manifest stats, duplicate manifest files, wide-lore retrieval policy, and date-derived timeline sort keys.
8. Done: wire reusable Deck Health checks into Loredeck editor validation, validated Custom/Generated export, safe metadata/override repair actions, and schema v3-safe override persistence.
9. Done: add Story Position and retrieval fields to the Custom entry editor so new schema v3 entries can be authored fully instead of only preserving source entry positions.
10. Done: add timeline anchor search/pickers and bulk Story Position editing to make v3 authoring less manual.
11. Done: add bulk tag editing and a first Tag Manager surface for Custom Loredeck entries, including tag counts, tag filtering, add/remove/rename operations, and namespaced tag preservation.
12. Done: capture the Creator, Timeline Registry Editor, Lore Assistant, Pending/Accepted lifecycle, and high-value lore rubric in preproduction.
13. Done: wire Tag Manager into `tags.json` source loading plus embedded Custom/Generated tag registry editing for define/edit/rename/merge/deprecate workflows.
14. Done: add Deck Health checks for undefined tags, deprecated tag usage, duplicate aliases, orphaned definitions, malformed namespaces, missing parent/replacement references, and entries using tags missing from `tags.json`.
15. Done: build the Pending Review Queue foundation for Loredeck edits, including pending record patches, accept/reject actions, and routing current manual/bulk entry and tag edits through review before activation.
16. Done: build the Timeline Registry Editor MVP with source timeline loading, Custom overlay anchor/window editing, Pending Review routing, and runtime/Deck Health merge support.
17. Done: begin the Lore Assistant proposal pipeline with an editable Loredeck panel, structured JSON proposal parsing, and Pending Review queue integration for entry, tag, and timeline patches.
18. Done: add field-level Pending Review diffs for entry, tag, and timeline record patches so assistant/manual proposals are inspectable before acceptance.
19. Done: add assistant proposal provenance/risk display polish and Deck Health rerun hooks so accepted entry/tag/timeline patches mark Deck Health stale until validation reruns.
20. Done: add Lore Assistant quality-rubric guardrails and proposal review affordances so AI revisions steer toward high-value Saga lore instead of generic wiki summaries.
21. Done: add assistant batch review controls for edit-before-queue, queue selected/all, drop selected, edit draft JSON, and revise selected proposals before they enter Pending Review.
22. Done: wire Deck Health issue repair planning into the Lore Assistant so users can turn selected health warnings into reviewable repair proposals.
23. Done: begin the Loredeck Creator intake scaffold with staged scope briefing, granularity selection, generated pack brief review, revision, and approval.
24. Done: add Creator title-pass generation from an approved brief, with selectable title drafts, approve/drop controls, revise-selected generation, and JSON editing before full entries exist.
25. Done: add Creator timeline/tag planning from the approved brief and title shape, creating a Generated Loredeck shell and routing generated anchors/windows/tag definitions through Pending Review before full entry generation.
26. Done: generate full schema v3 entry drafts from approved titles plus accepted planning metadata, landing them in the same edit-before-queue and Pending Review pipeline before activation.
27. Done: harden Generated Loredeck validation/export for accepted Creator entries, including virtual generated manifest stats, Deck Health rerun affordances, runtime loading for virtual generated entries, and export readiness checks.
28. Done: build JSON import/install handling for exported Saga Loredeck bundles, including Generated-to-Custom installation, collision-safe deck IDs, embedded virtual Custom Lorecard loading, and source/update metadata capture.
29. Done: add a fuller install preview and duplicate-deck review surface, including content-hash comparison, editable deck update/reinstall choices, local-modification warnings, and clearer duplicate-match reasons.
30. Done: add source/update handling for installed Loredecks, including check-for-updates from URL/GitHub metadata, GitHub raw/blob URL normalization, content-hash current-version detection, update/reinstall preview prompts, and local-modification warnings.
31. Done: add a local visual smoke harness and contract test for the Saga runtime shelf, seeded Custom Loredeck, Pending Review content, update-source preview fixture, Creator surface, and runtime CSS hooks.
32. Done: add a no-dependency visual smoke server and runbook so the harness can be opened in a normal browser or repeated inside SillyTavern with a concrete screenshot checklist.
33. Done: complete the first real SillyTavern smoke pass. The shelf opens without console errors, the Loredecks tab renders, and the first UX feedback pass is captured.
34. Done: apply the first low-risk Loredecks feedback fixes: collapsible Loredeck sections with reset defaults, stricter tag ID normalization, HP reference-deck tag cleanup, Lorecard-aligned metadata chips and titles, fullscreen Creator launcher, Saga-styled granularity labels/blurbs, stack arrow controls, individual-deck install focus, and Saga banner/minimized branding assets.
35. Next: run a targeted visual smoke pass in SillyTavern against these fixes, including collapsed-section defaults, Reset Window behavior, Loredeck chip/title styling, HP Deck Health malformed namespace warnings, Creator wizard launch, granularity copy, stack arrows, and runtime header branding.
36. Next: design and test individual Loredeck bulk export/import. Export should operate from selected Loredecks, produce one JSON file per deck, avoid whole-library export/import, and treat URL/GitHub updates as a previewed import/reinstall flow that protects locally modified decks.
37. Next: complete a scroll-preservation audit for Loredecks actions that still trigger full panel refreshes or snap the runtime window to the top.
38. Next: run UX/UI studies before major implementation for Deck Health, the fullscreen Loredeck Library + Stack Loader workbench, and the Story Position editor. Deck Health especially needs an advisory report model that is clearer without becoming punitive or visually noisy.
