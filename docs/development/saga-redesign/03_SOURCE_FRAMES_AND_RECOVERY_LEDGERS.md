# Addendum 03: Source Frames And Recovery Ledgers

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga needs a durable way to answer where chat-derived truth came from and what should happen when that source changes. A source frame is the canonical record of a visible host source at a specific revision. A recovery ledger records how Saga reacts when the host source is edited, deleted, re-selected, swiped, regenerated, or re-observed.

This is the foundation for safe Lorecard generation from chat, continuity extraction, selected-text Lore Check, prompt projection provenance, and Story Package playthrough snapshots.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\story-openers\story-opener-source.js`
- `F:\git\Saga\src\state\lore-generation-state.js`
- `F:\git\Saga\src\lorecards\retrieval-audit.js`
- `F:\git\Saga\src\lorecards\lore-selection.js`
- `F:\git\Saga\src\continuity\extractor.js`
- `F:\git\Saga\src\context\context-resolver.js`
- `F:\git\Saga\src\storage\saga-story-opener-storage.js`

The current system can capture source-like inputs, but source identity is not yet a shared runtime contract.

## Source Frame Model

A source frame should be immutable for a specific source revision:

```json
{
  "id": "source-frame-chat-20260630-0004",
  "kind": "chat_message",
  "hostId": "sillytavern",
  "chatId": "chat-abc",
  "hostMessageId": "42",
  "hostVariantId": "selected",
  "sourceOrder": 42,
  "author": "assistant",
  "role": "assistant",
  "textHash": "sha256:...",
  "textLength": 1840,
  "excerpt": "Harry lowered his wand...",
  "capturedAt": "2026-06-30T16:10:00.000Z",
  "revision": 3,
  "visibility": "selected",
  "status": "active",
  "supersedes": "source-frame-chat-20260630-0003"
}
```

Rules:

- source frames store bounded excerpts, not full chat transcripts by default;
- full text can be reread from host chat when available;
- `textHash` determines whether a visible source changed;
- `hostVariantId` identifies selected swipe/variant where the host exposes it;
- source frames do not themselves make a fact true; accepted downstream artifacts do.

## Source Kinds

Saga should support these source kinds:

| Kind | Example |
| --- | --- |
| `chat_message` | A visible host chat message. |
| `chat_selection` | A selected text span inside a message. |
| `loredeck_entry` | Bundled/imported/generated Lorecard source. |
| `story_package_seed` | Scenario seed fact from a Story Package. |
| `user_note` | User-authored note accepted into Saga. |
| `generated_proposal` | Model output before acceptance. |
| `external_import` | Imported package or file source record. |

Only accepted sources should feed canon/continuity. Generated proposals remain non-authoritative until accepted.

## Dependent Artifact Records

Every derived artifact should be able to list its source frames:

```json
{
  "artifactId": "lorecard-accepted-001",
  "artifactKind": "lorecard",
  "sourceFrameIds": ["source-frame-chat-20260630-0004"],
  "sourceHashes": ["sha256:..."],
  "derivationRole": "continuity.extract",
  "status": "current"
}
```

Supported artifact kinds:

- Lorecard proposal;
- accepted Lorecard;
- continuity fact;
- context summary;
- archive recall summary;
- prompt projection lane;
- Story Maker opener;
- Story Package playthrough snapshot;
- Lore Check report.

## Recovery Ledger

The recovery ledger records host-source events and Saga responses:

```json
{
  "id": "recovery-20260630-0007",
  "sourceFrameId": "source-frame-chat-20260630-0004",
  "event": "host_message_edited",
  "detectedAt": "2026-06-30T16:22:10.000Z",
  "oldTextHash": "sha256:old",
  "newTextHash": "sha256:new",
  "dependentArtifacts": [
    "lorecard-accepted-001",
    "continuity-fact-017"
  ],
  "action": "marked_stale",
  "status": "resolved"
}
```

Events:

| Event | Required response |
| --- | --- |
| `host_message_edited` | Create new source revision; mark dependents stale or review-required. |
| `host_message_deleted` | Mark source invalidated; stale dependents depending on authority. |
| `host_message_reobserved` | Clear stale deletion only if hash and variant match or a new revision is accepted. |
| `selected_variant_changed` | Invalidate dependents from unselected variant. |
| `host_order_changed` | Update source order; do not change fact truth by itself. |
| `source_accepted` | Mark proposal source accepted and available to downstream systems. |
| `source_rejected` | Mark proposal non-authoritative. |

## Stale-State Policy

Dependent artifacts need deterministic states:

| State | Meaning |
| --- | --- |
| `current` | All source hashes still match. |
| `stale_source_changed` | A source frame changed after derivation. |
| `stale_source_deleted` | A source frame was deleted or became unavailable. |
| `stale_variant_unselected` | The artifact depends on an unselected host variant. |
| `needs_review` | Saga cannot safely auto-resolve the stale condition. |
| `invalidated` | Artifact should not be used in prompts/retrieval. |
| `relinked` | User or deterministic process mapped it to a new accepted source revision. |

Prompt projection and retrieval must exclude `invalidated` artifacts and visibly mark `needs_review` artifacts.

## Storage Ownership

Source ledgers are runtime/playthrough state, not reusable bundled Loredeck content. They may be stored in chat metadata when host support is reliable, or in Saga flat-file playthrough payloads when a Story Package/playthrough layer exists.

The bounded ledger should include:

- source frame index;
- dependent artifact index;
- recovery events;
- latest reconciliation cursor;
- compaction marker for old resolved events.

Old resolved events can be compacted into summaries, but active stale relationships must remain explicit.

## UI Surface

Source provenance should be visible but not noisy:

- Lorecard detail: show source status, source type, short excerpt, and stale warning.
- Pending Review: show derived-from source and whether source is still current.
- Context Workbench: show why a source was selected or omitted.
- Lore Check: show checked source span and evidence sources.
- State Safety: show unresolved source recovery issues.

The primary action for stale accepted content should be `Review Source`, not silent repair.

## Loredeck And Lorecard Implications

Reusable Loredecks should carry source provenance for imported/generated content, but not chat-specific source frame IDs from a user's playthrough unless exported as a session package. A generated Loredeck can include generation provenance and source references; a reusable bundled Loredeck should include stable content sources and registries.

Lorecards should support:

- `sourceFrameIds` for playthrough-local derived cards;
- `sourceRefs` for reusable package/import provenance;
- `sourceStatus`;
- `staleReason`;
- `acceptedSourceHash`;
- `derivationRole`.

## Required Updates

Implementation of this addendum will require updates to:

- new `F:\git\Saga\src\sources\source-frame.js`;
- new `F:\git\Saga\src\sources\source-ledger.js`;
- new `F:\git\Saga\src\sources\source-reconciler.js`;
- Story Opener source capture;
- Lorecard generation state;
- Continuity extraction;
- Context Resolver;
- retrieval audit;
- storage payloads for runtime/playthrough state;
- UI details in Lorecards, Pending Review, Context Workbench, and State Safety.

## Verification

The slice is complete when:

1. A generated Lorecard from chat records a source frame.
2. Editing the source message marks dependent artifacts stale.
3. Deleting the source message prevents dependent artifacts from prompt projection unless reviewed.
4. Changing selected swipe invalidates artifacts derived from the old selection.
5. Re-observing a matching source revision clears stale deletion without losing audit history.
6. Source-frame fixtures run against fake host.

