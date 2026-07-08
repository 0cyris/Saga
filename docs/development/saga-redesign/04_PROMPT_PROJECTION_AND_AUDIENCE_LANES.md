# Addendum 04: Prompt Projection And Audience-Safe Lanes

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga's prompt injection should become a deterministic projection of accepted state, not a direct dump of currently active cards. The projection must explain what entered the prompt, why it entered, which audience may see it, which sources backed it, what was omitted, and what hash/revision the host received.

This addendum defines prompt lanes, audience safety, source hashes, and prompt projection audits.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\core\prompt-injection-plan.js`
- `F:\git\Saga\src\continuity\prompt-injector.js`
- `F:\git\Saga\src\state\prompt-sync.js`
- `F:\git\Saga\src\state\prompt-defaults.js`
- `F:\git\Saga\src\continuity\memo-builder.js`
- `F:\git\Saga\src\lorecards\lore-injection-filter.js`
- `F:\git\Saga\src\context\context-resolver.js`

Current high/normal/low lore injection is useful, but it needs source-backed lanes and audience rules before knowledge-scoped continuity can be trusted.

## Projection Model

A prompt projection is an immutable packet for a single install attempt:

```json
{
  "id": "prompt-projection-20260630-0002",
  "revision": 12,
  "createdAt": "2026-06-30T17:12:00.000Z",
  "hostId": "sillytavern",
  "contextPacketId": "context-packet-20260630-0002",
  "lanes": [],
  "sourceHashes": [],
  "omissions": [],
  "tokenBudget": {
    "target": 4200,
    "used": 3880
  },
  "status": "ready"
}
```

Host adapters install this packet. They should not construct it.

## Prompt Lanes

Saga should use explicit lanes:

| Lane | Purpose | Typical inputs |
| --- | --- | --- |
| `saga.contract` | Non-negotiable Saga operating rules. | Safety of canon use, no spoiler leaks, source obedience. |
| `saga.context.active` | Current setting, time, scene, player role. | Context Workbench and Story Package playthrough snapshot. |
| `saga.continuity.invariants` | Critical facts that must not drift. | Accepted continuity graph facts. |
| `saga.rules.active` | Active game/world mechanics and constraints. | Rules Lorecards and package rule overlays. |
| `saga.lore.high` | Immediately relevant lore. | Elevated/critical Lorecards. |
| `saga.lore.normal` | Relevant supporting lore. | Accepted retrieval results. |
| `saga.lore.low` | Background hints when budget allows. | Low-priority cards and optional flavor. |
| `saga.recap.committed` | Accepted recap of prior source frames. | Source-backed summaries. |
| `saga.recap.revolving` | Volatile short-term scene reminders. | Recent chat context, current scene cues. |
| `saga.instructions.task` | Immediate generation/task instruction. | Story Maker, Lore Check, repair, runtime action. |

Not every host will support named prompt blocks. The projection still uses lanes internally; the host adapter can flatten lanes if required.

## Audience Model

Every projected item should carry audience metadata:

| Audience | Meaning |
| --- | --- |
| `player_visible` | Safe for the user/player to see. |
| `narrator_private` | Model may use it, but UI should avoid exposing it casually. |
| `character_known` | Known only to specific characters/entities. |
| `faction_known` | Known to a group/faction. |
| `public_knowledge` | Known broadly in the setting. |
| `future_secret` | Must not appear before reveal gates are satisfied. |
| `system_only` | Operational instructions, not lore content. |

Prompt projection must decide whether the target model audience may receive each item. For roleplay generation, the model often needs narrator-private knowledge, but character-specific knowledge still matters because the model should not write dialogue as if every character knows every fact.

## Projection Item Shape

```json
{
  "id": "projection-item-001",
  "lane": "saga.lore.high",
  "content": "Snape is secretly working against Voldemort, but this must not be revealed before the appropriate story gate.",
  "audience": "narrator_private",
  "sourceIds": ["lorecard:hp-core:secret-knowledge-snape"],
  "factIds": ["fact:snape-allegiance-hidden"],
  "priority": 95,
  "criticality": "must_keep",
  "tokenEstimate": 28,
  "hash": "sha256:...",
  "compression": {
    "eligible": false,
    "reason": "critical_secret"
  }
}
```

## Omission Records

Omissions are as important as inclusions:

```json
{
  "itemId": "lorecard:hp-year-6:future-death",
  "reason": "reveal_gate_closed",
  "audience": "future_secret",
  "sourceIds": ["lorecard:hp-year-6:major-spoiler"],
  "wouldHaveLane": "saga.continuity.invariants"
}
```

Omission reasons should include:

- `budget_exhausted`;
- `reveal_gate_closed`;
- `audience_not_allowed`;
- `source_stale`;
- `source_invalidated`;
- `lower_priority_duplicate`;
- `conflict_loser`;
- `retrieval_score_too_low`;
- `manual_disabled`;
- `host_capability_limit`.

## Source Hashes And Prompt Revisions

Each projection should record:

- context packet ID;
- active Loredeck stack hash;
- continuity graph revision;
- source-frame ledger revision;
- retrieval result hash;
- final lane hash;
- host install status.

This allows Saga to answer whether the host prompt reflects the current accepted state or a stale projection.

## Compression Policy

Compression is allowed only after lane and audience decisions. Critical facts, spoiler guards, and source-sensitive rules should be protected from lossy compression. Lower-priority lore and recap lanes can be compressed by a generation role with `promptOnly` authority.

Compressed items must retain source IDs and a compression trace:

```json
{
  "compressedFrom": ["lorecard:a", "lorecard:b"],
  "compressionRole": "context.compress",
  "modelCallId": "model-call-20260630-004",
  "hash": "sha256:..."
}
```

## UI Surface

Injection preview should show:

- current prompt projection revision;
- install status;
- lane sizes;
- top included sources;
- top omissions and reasons;
- stale source warnings;
- audience-leak warnings;
- last host install error if any.

The normal user does not need a wall of text. The advanced/debug view should provide the projection audit.

## Loredeck And Lorecard Implications

Lorecards need fields that projection can trust:

- `injectionLane`;
- `audience`;
- `visibility`;
- `criticality`;
- `priority`;
- `compressionEligible`;
- `revealGateIds`;
- `sourceRefs`;
- `factIds`;
- `conflictKey`;
- `automationOwnership`.

Pack Health should flag cards that are critical but have no lane, cards that are always injected without a reason, future-secret cards with player-visible audience, and cards whose source is stale.

## Required Updates

Implementation of this addendum will require updates to:

- `F:\git\Saga\src\core\prompt-injection-plan.js`;
- `F:\git\Saga\src\continuity\prompt-injector.js`;
- `F:\git\Saga\src\state\prompt-sync.js`;
- Context Resolver output;
- retrieval result shape;
- continuity graph fact output;
- Lorecard schema and normalizer;
- injection preview UI;
- prompt sync tests and alpha gate.

## Verification

The slice is complete when:

1. Prompt projection output is deterministic for a fixture stack.
2. Projection lanes record source hashes.
3. Closed reveal gates produce omission records.
4. Stale source artifacts do not enter prompt lanes.
5. Host prompt install status can distinguish current, stale, failed, and unsupported.
6. Injection preview can explain included and omitted content.

