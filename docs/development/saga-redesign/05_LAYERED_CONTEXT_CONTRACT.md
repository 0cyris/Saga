# Addendum 05: Layered Context Contract

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga needs one context packet contract shared by runtime prompt injection, Story Maker, Deck Maker, Lore Check, retrieval, and continuity extraction. The packet should preserve layers, budgets, source traces, and volatility so each consumer stops rebuilding its own partial context shape.

This borrows the useful method from Narrative Engine's layered prompt assembly while keeping Saga frontend-only and host-neutral.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\context\context-resolver.js`
- `F:\git\Saga\src\context\context-index.js`
- `F:\git\Saga\src\context\context-formatters.js`
- `F:\git\Saga\src\context\context-gating.js`
- `F:\git\Saga\src\context\context-workbench-panel.js`
- `F:\git\Saga\src\continuity\memo-builder.js`
- `F:\git\Saga\src\story-openers\story-opener-generation.js`
- `F:\git\Saga\src\loredecks\loredeck-creator-generation-requests.js`

Several workflows already need the same data, but the data is not yet expressed as a common packet.

## Context Packet Shape

```json
{
  "id": "context-packet-20260630-0002",
  "createdAt": "2026-06-30T17:40:00.000Z",
  "purpose": "runtime_prompt",
  "hostId": "sillytavern",
  "activeStackHash": "sha256:...",
  "sourceLedgerRevision": 8,
  "continuityGraphRevision": 4,
  "layers": [],
  "budgets": {
    "targetTokens": 4200,
    "usedTokens": 3820
  },
  "trace": [],
  "warnings": []
}
```

The packet is not the final prompt. Prompt projection consumes it and decides lanes.

## Layers

| Layer | Stability | Purpose |
| --- | --- | --- |
| `contract` | Stable | Saga operating rules and role instructions. |
| `package` | Stable per playthrough | Story Package setup, player role, scenario assumptions. |
| `deckStack` | Stable until stack changes | Active Loredeck manifest summaries and global constraints. |
| `rules` | Stable/retrieved | Active mechanics, gates, system constraints. |
| `continuity` | Revisioned | Accepted graph facts and invariants. |
| `retrievedLore` | Volatile per context | Lorecards selected by retrieval. |
| `archiveRecall` | Volatile per context | Source-backed summaries and older scene recall. |
| `recentSource` | Volatile per chat | Recent source frames and selected text. |
| `sessionState` | Volatile | Current scene, location, activity, present characters. |
| `task` | Per call | Current Story Maker/Deck Maker/Lore Check/runtime task. |

Each layer should have source IDs, budget, audience, and volatility metadata.

## Layer Item Shape

```json
{
  "id": "context-item-001",
  "layer": "retrievedLore",
  "kind": "lorecard",
  "content": "The Chamber of Secrets is hidden beneath Hogwarts and tied to Slytherin's heir.",
  "sourceIds": ["lorecard:hp-year-2:chamber-location"],
  "entityIds": ["entity:hogwarts", "entity:chamber-of-secrets"],
  "factIds": ["fact:chamber-hidden-beneath-school"],
  "audience": "narrator_private",
  "priority": 82,
  "tokenEstimate": 24,
  "volatility": "stable",
  "cachePolicy": "cacheable"
}
```

## Budget Allocation

Budgeting should happen before final prompt projection:

| Bucket | Default posture |
| --- | --- |
| Contract | Reserved floor. |
| Package/setup | Reserved floor while package is active. |
| Continuity invariants | Reserved floor for critical facts. |
| Rules | Reserved floor for active rules. |
| High lore | Competitive priority. |
| Normal lore | Competitive priority. |
| Low lore | Best effort. |
| Archive recall | Competitive with normal lore. |
| Recent source | Capped by recency and task. |
| Task instructions | Reserved floor. |

Budget pressure should produce explicit omissions, not silent truncation.

## Cache Policy

Some hosts or providers may support prompt caching. Saga should mark layer cacheability even when the current host cannot use it:

| Policy | Meaning |
| --- | --- |
| `cacheable` | Stable across many calls until a named revision changes. |
| `session_cacheable` | Stable for current playthrough/session. |
| `not_cacheable` | Recent source, task, or volatile state. |
| `must_recompute` | Depends on current selected source or unresolved stale state. |

Cache metadata should not change product behavior when unsupported by the host.

## Consumers

The same packet contract should support:

- runtime prompt projection;
- Story Maker opener generation;
- Story Package drafting;
- Deck Maker scope and coverage planning;
- Pack Health repair;
- Lore Check;
- Continuity extraction;
- Auto-Relevance/Lore Automation;
- retrieval diagnostics.

Consumers can request a purpose-specific packet:

```js
await contextPacketBuilder.build({
  purpose: "lore_check",
  targetSourceFrameIds: ["source-frame-chat-20260630-0004"],
  targetBudget: 3000,
});
```

## Conflict Handling

The context builder should not hide conflicts. It should annotate them:

```json
{
  "code": "context_conflict_detected",
  "conflictKey": "entity:snape:allegiance",
  "winner": "fact:snape-hidden-ally",
  "losers": ["fact:snape-loyal-deatheater"],
  "policy": "newer_accepted_fact"
}
```

Prompt projection decides whether to include the winner, omit losers, or include a conflict instruction.

## Loredeck And Lorecard Implications

Loredeck content must classify cleanly into context layers. A single card can still be simple, but its metadata should state whether it is:

- canon fact;
- operating rule;
- reveal gate;
- timeline anchor;
- entity profile;
- relationship;
- spoiler guard;
- style/voice guidance;
- scenario overlay;
- volatile session note.

Deck Maker should generate these classifications instead of leaving Pack Health to infer everything later.

## Required Updates

Implementation of this addendum will require updates to:

- new `F:\git\Saga\src\context\context-packet-builder.js`;
- new `F:\git\Saga\src\context\context-layer-contract.js`;
- `F:\git\Saga\src\context\context-resolver.js`;
- `F:\git\Saga\src\continuity\memo-builder.js`;
- Story Maker generation requests;
- Deck Maker generation requests;
- prompt projection builder;
- retrieval engine outputs;
- Loredeck schema and Creator prompts.

## Verification

The slice is complete when:

1. Runtime prompt, Story Maker, Deck Maker, and Lore Check can all request context packets through one builder.
2. Packets preserve source IDs and layer budgets.
3. Budget overflow produces explicit omissions.
4. Cache policy metadata is stable and host-neutral.
5. Conflict annotations survive into prompt projection diagnostics.
6. Existing Context Workbench behavior can be expressed through the packet contract.

