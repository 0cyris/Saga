# Addendum 09: Loredeck And Lorecard Evolution

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

The eight architecture features require a deliberate evolution of Loredecks and Lorecards. This addendum defines the required content-model changes, schema direction, bundled content migration, Deck Maker changes, Pack Health checks, and documentation updates.

This document does not replace `F:\git\Saga\docs\loredecks\SAGA_LOREDECK_SCHEMA.md` yet. It defines the next schema wave that should be promoted into that reference when implementation begins.

## Current Content Model

Saga already supports rich Lorepack structure:

- bundled content under `F:\git\Saga\content\loredecks`;
- `loredeck.json` manifests;
- `tags.json`;
- `timeline.json`;
- entity-like and gate-like files in bundled packs;
- schema v3-style Lorecard validation and repair modules;
- import/export zip structure;
- Pack Health;
- Deck Maker staged generation;
- Pending Review and generated pack provenance.

The redesign should preserve those strengths while making the implicit structures first-class.

## Schema Direction

The next schema should be treated as a major pre-alpha schema replacement. A practical label is `schemaVersion: 4` for entries and a corresponding manifest compatibility bump. The exact number can be chosen during implementation, but the migration should be in-place and direct.

The schema needs to support:

- host-neutral identity;
- source provenance;
- retrieval activation;
- audience and visibility;
- prompt lane projection;
- entity/fact/rule registries;
- knowledge scope;
- reveal gates;
- conflict and supersession;
- package compatibility;
- generation provenance;
- automation ownership.

## Manifest Changes

Add or formalize these manifest sections:

```json
{
  "schemaVersion": 4,
  "id": "hp-year-2-chamber-of-secrets",
  "contentKind": "fandom",
  "registries": {
    "tags": "tags.json",
    "timeline": "timeline.json",
    "entities": "entities.json",
    "facts": "facts.json",
    "relationships": "relationships.json",
    "rules": "rules.json",
    "revealGates": "reveal-gates.json",
    "retrieval": "retrieval.json"
  },
  "runtimeDefaults": {
    "retrievalProfile": "balanced",
    "promptProfile": "fandom_default",
    "audienceProfile": "player_safe"
  },
  "packageCompatibility": {
    "suggestedRoles": ["foundation", "era"],
    "compatiblePackageIds": [],
    "overlayPolicy": "allow_session_overlay"
  },
  "schemaCapabilities": [
    "sourceRefs",
    "retrievalModes",
    "knowledgeScope",
    "promptLanes",
    "storyPackageCompatibility"
  ]
}
```

## Lorecard Entry Shape

A next-wave Lorecard should be able to express this:

```json
{
  "id": "hp-year-2-chamber-location",
  "type": "lore",
  "title": "The Chamber Is Hidden Beneath Hogwarts",
  "text": "The Chamber of Secrets is hidden beneath Hogwarts and tied to Slytherin's heir.",
  "summary": "The Chamber is beneath Hogwarts.",
  "sourceRefs": [
    {
      "kind": "bundled_source",
      "id": "hp-year-2-canon-source",
      "confidence": "curated"
    }
  ],
  "retrieval": {
    "activationModes": ["keyword", "entityOverlap", "timelineOverlap"],
    "primaryTriggers": ["Chamber of Secrets", "Slytherin's heir"],
    "secondaryTriggers": ["Hogwarts", "basilisk", "diary"],
    "semanticHints": ["hidden chamber under the school", "monster attacks in corridors"],
    "relatedEntityIds": ["entity:hogwarts", "entity:chamber-of-secrets"],
    "timelineIds": ["timeline:hp-year-2"],
    "weight": 0.82
  },
  "projection": {
    "defaultLane": "saga.lore.high",
    "audience": "narrator_private",
    "criticality": "important",
    "compressionEligible": true,
    "priority": 80
  },
  "continuity": {
    "factIds": ["fact:chamber-hidden-beneath-hogwarts"],
    "revealGateIds": ["reveal:chamber-location"],
    "conflictKey": "hp.chamber.location"
  },
  "generation": {
    "role": "",
    "modelCallId": "",
    "acceptedAt": "",
    "acceptedBy": ""
  },
  "automation": {
    "owner": "saga",
    "enabled": true
  }
}
```

Not every card needs every field. Pack Health should distinguish optional absence from invalid absence. Critical cards need richer metadata than flavor cards.

## Registries

### entities.json

Entities should be stable references:

```json
{
  "entities": [
    {
      "id": "entity:hogwarts",
      "type": "location",
      "name": "Hogwarts",
      "aliases": ["Hogwarts School of Witchcraft and Wizardry"],
      "tags": ["location:school"]
    }
  ]
}
```

### facts.json

Facts should support knowledge scope:

```json
{
  "facts": [
    {
      "id": "fact:chamber-hidden-beneath-hogwarts",
      "summary": "The Chamber of Secrets is beneath Hogwarts.",
      "entityIds": ["entity:hogwarts", "entity:chamber-of-secrets"],
      "knownBy": [{ "scope": "narrator", "id": "narrator" }],
      "unknownTo": [{ "scope": "player", "id": "player", "until": "reveal:chamber-location" }],
      "sourceRefs": ["hp-year-2-chamber-location"],
      "conflictKey": "hp.chamber.location"
    }
  ]
}
```

### rules.json

Rules should be separate from lore:

```json
{
  "rules": [
    {
      "id": "rule:parseltongue-understanding",
      "summary": "Only Parselmouths can naturally understand Parseltongue.",
      "ruleType": "ability_constraint",
      "entityIds": ["entity:parseltongue"],
      "projectionLane": "saga.rules.active",
      "criticality": "must_keep"
    }
  ]
}
```

### retrieval.json

Retrieval profiles should be data:

```json
{
  "profiles": [
    {
      "id": "balanced",
      "candidateCaps": {
        "rules": 8,
        "highLore": 18,
        "normalLore": 24,
        "archive": 8
      },
      "alwaysModePolicy": "critical_only"
    }
  ]
}
```

## Bundled Loredeck Migration

Bundled decks need a content pass, not just a mechanical schema bump.

Required migration work:

- assign stable entity IDs;
- extract or normalize facts;
- split mixed-scope cards;
- label rules separately from lore;
- add activation modes and triggers;
- add prompt projection defaults;
- add reveal gates and spoiler guards;
- add conflict keys for facts likely to vary by era/adaptation;
- mark package compatibility roles;
- keep passive assets host-neutral;
- regenerate Pack Health summaries.

High-risk bundled families include any deck with:

- hidden identities;
- future deaths;
- faction secrets;
- timeline-specific power/age states;
- adaptation/canon variants;
- arc-specific locations;
- player-knowledge constraints.

## Generated And Custom Loredecks

Generated Loredecks should be created in the new shape from the beginning of the migration wave. The Deck Maker pipeline should add:

- entity planning;
- fact planning;
- retrieval trigger planning;
- rule/lore classification;
- prompt lane classification;
- reveal-gate planning;
- conflict-key suggestions;
- package compatibility hints;
- provenance fields.

Custom Loredecks imported from older alpha shapes can be reset or converted in place because Saga is pre-alpha. If a direct conversion cannot safely infer scope, mark the card `needsReview` and keep it out of critical prompt lanes.

## Lorecard Authoring UI

The editor should avoid making users fill every advanced field manually. It should group fields:

- Content: title, text, summary.
- Retrieval: triggers, related entities, timeline.
- Projection: lane, priority, audience, criticality.
- Continuity: fact links, reveal gates, conflict key.
- Source: provenance and stale status.
- Automation: whether Saga may manage this card.

Advanced sections can be collapsed, but Pack Health must surface missing critical metadata.

## Pack Health Evolution

Pack Health should become the compiler for the new content model. It should detect:

- invalid schema shape;
- missing stable IDs;
- dangling entity/fact/rule/reveal references;
- dead retrieval triggers;
- overbroad `always` activation;
- critical cards without prompt lanes;
- future secrets marked player-visible;
- mixed-scope cards;
- generated cards without provenance;
- package references to missing Loredecks;
- rules stored as normal flavor lore;
- stale or invalidated source dependencies;
- conflict keys with unresolved winners.

Repair can propose fixes, but acceptance remains deterministic and review-gated.

## Import/Export Changes

The `.saga-loredeck.zip` contract should grow without allowing executable content:

```text
manifest.json
loredecks/
  pack-id/
    loredeck.json
    entries/
    registries/
      entities.json
      facts.json
      rules.json
      reveal-gates.json
      retrieval.json
    assets/
story-packages/
  optional-package-id/
    story-package.json
```

Imports should validate:

- no executable files;
- no path traversal;
- no raw host paths as primary identity;
- registry references resolve;
- schema version is supported;
- package references are explicit.

## Documentation Updates

When this schema wave is implemented, update:

- `F:\git\Saga\docs\loredecks\SAGA_LOREDECK_SCHEMA.md`;
- `F:\git\Saga\docs\loredecks\LOREDECK_AND_LORECARD_CREATION_GUIDE.md`;
- `F:\git\Saga\docs\loredecks\LLM_LOREDECK_GENERATION_GUIDE.md`;
- `F:\git\Saga\docs\loredecks\LOREDECK_ZIP_PACKAGE_STRUCTURE.md`;
- Deck Maker desktop/mobile guides;
- Story Maker desktop/mobile guides;
- Basic and Advanced workflow docs;
- release notes for the migration release.

## Required Updates

Implementation of this addendum will require updates to:

- Loredeck loader and normalizer;
- schema v3 health/repair modules and their successor;
- Deck Maker generation prompts and validators;
- Lorecard editor;
- Pack Health engine;
- package import/export service;
- bundled content index and defaults;
- runtime retrieval and prompt projection;
- Story Package compatibility checks.

## Verification

The slice is complete when:

1. Migrated bundled decks load through the new schema without compatibility shims.
2. Pack Health can validate retrieval, projection, knowledge, source, and package metadata.
3. Deck Maker can generate new-shape cards and registries.
4. Import/export round trips new registries and passive assets.
5. Prompt projection can use migrated fields without guessing.
6. Story Packages can reference migrated Loredecks by stable IDs and roles.

