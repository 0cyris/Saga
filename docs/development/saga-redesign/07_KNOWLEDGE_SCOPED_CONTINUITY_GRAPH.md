# Addendum 07: Knowledge-Scoped Continuity Graph

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga needs to represent not only what is true, but who knows it, when it became true, what source supports it, and whether it has been superseded. A knowledge-scoped continuity graph provides that model.

This graph should power prompt audience safety, Lore Check, reveal gates, character-specific knowledge, Pack Health, and Story Package setup.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\continuity\continuity-scanner.js`
- `F:\git\Saga\src\continuity\continuity-panel.js`
- `F:\git\Saga\src\continuity\extractor.js`
- `F:\git\Saga\src\continuity\memo-builder.js`
- `F:\git\Saga\src\state\continuity-state.js`
- `F:\git\Saga\src\context\canon-lore-db.js`
- `F:\git\Saga\content\loredecks`

Existing Loredeck content already contains knowledge gates, future guards, timeline data, and character baselines in several bundled packs. The graph should formalize those patterns.

## Graph Objects

The graph should contain typed nodes:

| Node type | Meaning |
| --- | --- |
| `entity` | Character, place, item, organization, species, concept. |
| `faction` | Group with shared knowledge or agenda. |
| `fact` | Atomic assertion that can be known, hidden, contradicted, or superseded. |
| `event` | Time-bound occurrence or scene-relevant event. |
| `timelineWindow` | Era, year, season, arc, episode, chapter, phase. |
| `relationship` | Relationship between entities. |
| `rule` | Operating rule or mechanics constraint. |
| `revealGate` | Condition under which hidden knowledge becomes available. |
| `source` | Source frame or reusable source reference. |

Edges should represent:

- entity participates in event;
- fact concerns entity;
- fact known by entity/faction/player/public;
- fact revealed by event/gate;
- fact supersedes fact;
- fact conflicts with fact;
- rule applies to entity/domain;
- source supports fact.

## Fact Shape

```json
{
  "id": "fact:snape-hidden-ally",
  "type": "fact",
  "summary": "Severus Snape is secretly acting against Voldemort while maintaining his cover.",
  "entityIds": ["entity:severus-snape", "entity:voldemort"],
  "sourceIds": ["lorecard:hp-core:secret-knowledge-snape"],
  "timelineIds": ["timeline:hp-books-1-6"],
  "canonStatus": "accepted",
  "audience": "narrator_private",
  "knownBy": [
    { "scope": "entity", "id": "entity:albus-dumbledore", "since": "timeline:pre-book-1" },
    { "scope": "narrator", "id": "narrator", "since": "always" }
  ],
  "unknownTo": [
    { "scope": "player", "id": "player", "until": "reveal:snape-truth" },
    { "scope": "public", "id": "public", "until": "reveal:snape-truth" }
  ],
  "revealGateIds": ["reveal:snape-truth"],
  "conflictKey": "snape.allegiance",
  "supersedes": [],
  "status": "current"
}
```

## Knowledge Scope

Knowledge scope should be explicit:

| Scope | Meaning |
| --- | --- |
| `narrator` | Model-level narrator may know this. |
| `player` | User/player may know this in UI/player-safe context. |
| `public` | Public knowledge inside the setting. |
| `entity` | Specific character/entity knows it. |
| `faction` | Group knows it. |
| `unknown` | Not known to any active actor yet. |

Prompt projection should use scope to avoid dialogue and narration leaks. A narrator-private fact can guide scene consistency, but a character should not speak from knowledge they do not have.

## Fact Lifecycle

Facts should move through clear states:

| State | Meaning |
| --- | --- |
| `candidate` | Extracted or generated, not accepted. |
| `accepted` | Trusted by current graph. |
| `session_overlay` | True for current playthrough but not reusable canon. |
| `superseded` | Replaced by a newer accepted fact. |
| `conflicted` | Competes with another fact and needs policy/review. |
| `invalidated` | Source removed or rejected. |
| `archived` | Not active but retained for trace. |

Only accepted and session-overlay facts should enter normal prompt projection.

## Conflict And Supersession

The graph should support conflict keys:

```json
{
  "conflictKey": "entity:draco-malfoy:year-2-location",
  "policy": "timeline_specific_wins",
  "winner": "fact:draco-in-slytherin-common-room-year-2",
  "losers": ["fact:draco-at-manor-year-2-same-date"]
}
```

Policies should be deterministic:

- timeline-specific wins over broad baseline;
- accepted user edit wins over generated proposal;
- Story Package session overlay wins inside that playthrough only;
- newer accepted source wins only when marked as superseding;
- unresolved conflicts are omitted or surfaced for review.

## Reveal Gates

Reveal gates should be graph nodes, not scattered card text:

```json
{
  "id": "reveal:tom-riddle-diary-identity",
  "conditions": [
    { "kind": "timelineAfter", "timelineId": "timeline:hp-year-2:finale" },
    { "kind": "sourceAccepted", "sourceId": "source-frame:diary-reveal" }
  ],
  "unlocksFactIds": ["fact:diary-is-horcrux"],
  "defaultAudienceBeforeReveal": "narrator_private",
  "defaultAudienceAfterReveal": "player_visible"
}
```

Reveal gates allow Pack Health to detect future spoiler leakage and allow prompt projection to decide what the model can know.

## Loredeck And Lorecard Implications

Loredecks should include or reference registries:

- `entities.json`;
- `facts.json`;
- `relationships.json`;
- `rules.json`;
- `reveal-gates.json`;
- `timeline.json`;
- `knowledge.json`.

Lorecards can remain the author-facing unit, but they should map to fact nodes. A card may contain multiple facts only when they share the same audience, source, activation, and conflict behavior. Dense cards with mixed scope should be split by Pack Health or Deck Maker.

## Required Updates

Implementation of this addendum will require updates to:

- new `F:\git\Saga\src\continuity\knowledge-graph.js`;
- new `F:\git\Saga\src\continuity\fact-lifecycle.js`;
- new `F:\git\Saga\src\continuity\knowledge-scope.js`;
- new `F:\git\Saga\src\continuity\conflict-resolution.js`;
- new graph-aware output from Continuity Extractor;
- Loredeck loader and normalizer;
- Pack Health;
- Prompt projection;
- Retrieval;
- Context Workbench and Continuity UI.

## Verification

The slice is complete when:

1. A fixture graph can answer whether a character, player, public, or narrator knows a fact.
2. Closed reveal gates prevent player-visible prompt projection.
3. Superseded facts are omitted in favor of winners.
4. Session overlay facts affect only the active playthrough.
5. Pack Health can flag mixed-scope cards and dangling entity/fact references.
6. Lore Check can report contradiction and knowledge leak evidence.

