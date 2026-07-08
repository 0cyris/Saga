# Saga Architecture Redesign

Status: Target architecture redesign for a pre-alpha migration wave.

Date: 2026-06-30.

## Purpose

This document defines the next Saga architecture program after the Directive and Narrative Engine transfer review. It is not an implementation plan and does not change the current live product contract by itself. It is the design baseline for moving Saga from a Loredeck-centered prompt helper into a source-backed narrative runtime with portable content, auditable generation, retrieval-aware Loredecks, and scenario-level Story Packages.

Because Saga is still pre-alpha, this design assumes current data contracts can be replaced in place when the implementation wave begins. The migration should still be deliberate: every old field that survives should have a current reason, not a compatibility excuse.

## Related Documents

- [Saga Deep Refactor Target Audit](SAGA_DEEP_REFACTOR_TARGET_AUDIT.md): current refactor pressure points and module-size evidence.
- [Saga Storage Rework Design](SAGA_STORAGE_REWORK_DESIGN.md): flat `/user/files` storage model and storage ownership principles.
- [Saga Generation Hardening Plan](SAGA_GENERATION_HARDENING_PLAN.md): current provider response normalization and typed generation failures.
- [Saga Lore Automation Levels Plan](SAGA_LORE_AUTOMATION_LEVELS_PLAN.md): automation authority, run journals, and reversible lore operations.
- [Saga Loredeck Schema Reference](../loredecks/SAGA_LOREDECK_SCHEMA.md): current Loredeck and Lorecard data contract.
- [Addendum 01: Host Contract And Fake Host](saga-redesign/01_HOST_CONTRACT_AND_FAKE_HOST.md)
- [Addendum 02: Generation Role Router And Model-Call Journal](saga-redesign/02_GENERATION_ROLE_ROUTER_AND_JOURNAL.md)
- [Addendum 03: Source Frames And Recovery Ledgers](saga-redesign/03_SOURCE_FRAMES_AND_RECOVERY_LEDGERS.md)
- [Addendum 04: Prompt Projection And Audience-Safe Lanes](saga-redesign/04_PROMPT_PROJECTION_AND_AUDIENCE_LANES.md)
- [Addendum 05: Layered Context Contract](saga-redesign/05_LAYERED_CONTEXT_CONTRACT.md)
- [Addendum 06: Hybrid Retrieval And Archive Recall](saga-redesign/06_HYBRID_RETRIEVAL_AND_ARCHIVE_RECALL.md)
- [Addendum 07: Knowledge-Scoped Continuity Graph](saga-redesign/07_KNOWLEDGE_SCOPED_CONTINUITY_GRAPH.md)
- [Addendum 08: Story Package Layer](saga-redesign/08_STORY_PACKAGE_LAYER.md)
- [Addendum 09: Loredeck And Lorecard Evolution](saga-redesign/09_LOREDECK_AND_LORECARD_EVOLUTION.md)

## Design Inputs

The review found that Saga should not copy either comparison project wholesale.

Directive contributes the stronger runtime methods:

- explicit host contract boundaries;
- fake-host testing;
- model-call authority and journaling;
- source-frame and recovery ledgers;
- prompt provenance and source hashes;
- exact separation between accepted source truth and generated proposals.

Narrative Engine contributes the stronger memory and continuity methods:

- layered prompt/context packets;
- hybrid archive retrieval;
- rules and lore activation modes;
- knowledge-scoped facts with `knownBy` style boundaries;
- selected-text lore checking as a product workflow.

Saga already has valuable analogues:

- response normalization in `F:\git\Saga\src\providers\lore-response-normalizer.js`;
- prompt injection tiers in `F:\git\Saga\src\continuity\prompt-injector.js`;
- flat-file storage in `F:\git\Saga\src\storage`;
- Deck Maker generation diagnostics in `F:\git\Saga\src\loredecks`;
- retrieval and relevance surfaces in `F:\git\Saga\src\context` and `F:\git\Saga\src\lorecards`;
- substantial alpha gate coverage in `F:\git\Saga\tools\scripts`.

The migration should upgrade those seams instead of replacing them with another application's architecture.

## Problem Statement

Saga's current architecture is strong enough for the current alpha product, but it has four structural limits:

1. Host behavior is still too implicit. Saga has SillyTavern-specific assumptions in provider, prompt, storage, and runtime paths, while Lumiverse/Spindle support is emerging.
2. Generation is hardened at the response-shape level, but model authority is not yet centralized. Different workflows still decide locally what a model may generate, commit, retry, or diagnose.
3. Chat-derived truth lacks a durable source ledger. Lorecards, continuity notes, summaries, and Story Maker output can be derived from text without a reusable record of which visible source revision made them true.
4. Loredecks are rich, but still too card-centric. The next content layer needs explicit retrieval metadata, audience visibility, entity/fact registries, knowledge scope, provenance, and scenario composition.

The redesign resolves those limits by making Saga's runtime source-backed from the bottom up.

## Target Architecture

The target architecture has nine cooperating layers:

```text
Host Adapter
  -> Storage, chat, prompt, generation, files, lifecycle, notifications

Generation Router
  -> Role registry, provider lane, authority matrix, model-call journal

Source Ledger
  -> Source frames, selected variants, revisions, invalidation, recovery

Context Packet
  -> Stable layers, retrieval results, source trace, token budgets

Retrieval Engine
  -> Lexical, entity, timeline, archive, semantic-hint, rule/lore modes

Continuity Graph
  -> Facts, entities, knowledge scope, conflicts, supersession, reveal gates

Prompt Projection
  -> Audience-safe lanes, source hashes, omission reasons, prompt revisions

Loredeck System
  -> Portable canon/rules assets with retrieval, visibility, and provenance

Story Package Layer
  -> Scenario bundles that compose Loredecks into playable setup snapshots
```

The most important design choice is that generated text does not become truth simply because a model produced it. Truth enters Saga through accepted sources: bundled content, imported content, user edits, accepted generated proposals, selected chat source frames, and explicit Story Package seeds.

## Architectural Principles

### Host-Neutral First

Saga must be able to run the same domain logic against SillyTavern, Lumiverse, and fake tests. Host adapters translate capability and API shape; domain modules should not check random host globals directly.

### Proposal Before Mutation

Model-backed workflows should emit proposals. A role can mutate state only when the role's authority explicitly allows it and the output passes validation.

### Source Frames Own Chat Truth

Anything derived from chat text must carry a source frame. If the host text changes, the dependent data becomes stale, reviewable, or invalidated.

### Prompt Output Is A Projection

Prompt injection is not a dump of current state. It is a deterministic projection with lanes, audience rules, budgets, source hashes, and diagnostics.

### Loredecks Are Portable Content, Not Runtime State

Loredecks should remain data-only and portable. Runtime source ledgers, chat-derived facts, playthrough snapshots, and Story Package session choices should not be embedded into reusable bundled Loredecks.

### Story Packages Compose Loredecks

Story Packages should not replace Loredecks. A package points to required Loredecks, adds scenario overlays, and creates a playthrough snapshot.

## Migration Order

The redesign should land in this order:

1. Host contract and fake host.
2. Generation role router, authority matrix, and model-call journal.
3. Source frames and recovery ledgers.
4. Prompt projection lanes with source hashes.
5. Layered context packet.
6. Hybrid retrieval and archive recall.
7. Knowledge-scoped continuity graph.
8. Story Package layer.
9. Loredeck and Lorecard schema evolution across bundled, generated, and custom content.

The Loredeck/Lorecard work appears last in the list because it depends on all preceding contracts, but schema design should be drafted early. Implementation should not migrate bundled content until validation tools and Pack Health checks understand the new fields.

## System Ownership Map

The redesign should add or reshape modules around ownership rather than around UI panels.

| Domain | Target modules | Ownership |
| --- | --- | --- |
| Host boundary | `src/hosts`, `src/core/saga-host-contract.js`, `src/core/fake-saga-host.js` | Host capabilities and adapter-facing APIs. |
| Generation | `src/generation` | Role registry, authority matrix, router, journals, diagnostics. |
| Source truth | `src/sources` or `src/runtime/source-ledger` | Chat source frames, source revisions, recovery ledgers. |
| Context packet | `src/context` | Layered context assembly, budget allocation, trace records. |
| Retrieval | `src/retrieval` or focused `src/context` submodules | Candidate discovery, scoring, activation modes, archive recall. |
| Continuity graph | `src/continuity` | Entity/fact graph, knowledge scope, conflict/supersession. |
| Prompt projection | `src/prompt` plus current `src/continuity/prompt-injector.js` bridge | Prompt lanes, audience safety, hashes, host installation. |
| Loredecks | `src/loredecks`, `src/lorecards` | Data loading, normalization, health, authoring, review, import/export. |
| Story Packages | `src/story-packages` plus Story Maker integration | Scenario manifests, package projection, playthrough snapshots. |

The existing panel decomposition work should continue, but this redesign should not be implemented by making the panels smarter. Panels should call domain services and render diagnostics.

## Data Ownership

The storage contract should be:

| Data | Owner | Storage |
| --- | --- | --- |
| Bundled Loredecks | Extension content | `F:\git\Saga\content\loredecks` and bundled indexes. |
| Custom/imported Loredecks | User content | Saga flat-file payloads under `/user/files`. |
| Generated Loredecks | User content with provenance | Saga flat-file payloads plus Creator project records. |
| Source frames | Current chat/playthrough runtime | Chat metadata or Saga runtime payload, depending on host capability. |
| Model-call journal | Runtime diagnostic record | Compact bounded journal in chat/playthrough state. |
| Continuity graph | Playthrough state plus accepted reusable deck facts | Split between reusable deck registries and session graph overlay. |
| Prompt projection audit | Runtime diagnostic record | Bounded prompt sync/audit state, not raw prompts by default. |
| Story Package manifest | Portable content | Bundled package files or user-imported package payload. |
| Playthrough snapshot | User runtime state | Saga flat-file payload and/or host chat metadata. |

## Product Surface Changes

The redesign requires visible product changes:

- Library should distinguish Loredecks from Story Packages.
- Pack Health should become a compiler-like validation surface for schema, retrieval, knowledge, visibility, source, and package compatibility.
- Context Workbench should show why content was selected or omitted.
- Lorecards should show source/provenance and automation ownership without turning every card into a diagnostics wall.
- Story Maker should be able to start from a Story Package, a Loredeck stack, or a selected chat/source frame.
- Settings should configure generation roles and host capabilities at a high level, not expose every low-level route.

## Non-Goals

- Do not port Directive's Starfleet/campaign-specific product model.
- Do not port Narrative Engine's Express/Electron/SQLite/Pixi shell.
- Do not require a Saga server plugin.
- Do not store raw provider prompts/responses by default.
- Do not make every Lorecard a separate storage file.
- Do not preserve broad compatibility paths for stale pre-alpha state.
- Do not make Story Packages the only way to use Saga; direct Loredeck stacks should remain valid.

## Verification Strategy

The redesign should be protected by behavior contracts before broad migration:

- fake-host tests for prompt, storage, generation, and chat-source capabilities;
- provider/router fixtures for each generation role and error code;
- source-frame reconciliation fixtures for edit, delete, swipe, and re-observe cases;
- prompt projection golden packets with source hashes and omission reasons;
- retrieval fixtures for keyword, entity, timeline, rule, and semantic-hint activation;
- continuity graph fixtures for known/unknown, revealed/unrevealed, superseded, and contradictory facts;
- Story Package import/export/projection round trips;
- Loredeck schema and Pack Health fixtures for migrated bundled content;
- alpha gate integration once each slice has stable behavior.

## Exit Criteria

The redesign is complete when:

1. Saga domain logic can run against a fake host without SillyTavern globals.
2. All model calls route through named roles with authority and compact journals.
3. Chat-derived data has source-frame provenance and stale-state behavior.
4. Prompt injection emits lane-based projection audits with source hashes.
5. Retrieval can explain activation and omission across lore, rules, and archive context.
6. Continuity facts can represent who knows what and when it became true.
7. Story Packages compose Loredecks into playthrough snapshots without replacing direct Loredeck use.
8. Bundled, generated, and custom Loredecks can pass the new schema/health checks.

