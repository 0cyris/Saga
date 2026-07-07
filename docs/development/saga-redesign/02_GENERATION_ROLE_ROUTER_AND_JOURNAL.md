# Addendum 02: Generation Role Router And Model-Call Journal

Status: Target architecture addendum.

Parent: [Saga Architecture Redesign](../SAGA_ARCHITECTURE_REDESIGN.md)

## Purpose

Saga already has response normalization and typed generation failures. The next step is centralizing model-call authority. Each model call should have a named role, provider lane, input contract, output contract, mutation authority, retry policy, and compact journal entry.

The router should make model behavior observable without turning raw prompts or raw provider responses into normal persisted data.

## Current Saga Seams

Relevant current files include:

- `F:\git\Saga\src\generation\generation-job-runner.js`
- `F:\git\Saga\src\providers\lore-llm-client.js`
- `F:\git\Saga\src\providers\lore-response-normalizer.js`
- `F:\git\Saga\src\loredecks\loredeck-creator-generation-runner.js`
- `F:\git\Saga\src\loredecks\loredeck-creator-generation-diagnostics.js`
- `F:\git\Saga\src\story-openers\story-opener-generation.js`
- `F:\git\Saga\src\context\context-resolver.js`
- `F:\git\Saga\src\context\auto-relevance.js`
- `F:\git\Saga\src\continuity\extractor.js`
- `F:\git\Saga\src\lorecards\lore-generator.js`

The Generation Hardening Plan establishes stable failure codes. This addendum turns those codes into a cross-product call contract.

## Role Registry

Create a central registry of generation roles:

| Role | Purpose | Lane | Mutation authority |
| --- | --- | --- | --- |
| `deck.scopeBrief` | Convert user request into Deck Maker scope | Utility | Proposal only. |
| `deck.storyOutline` | Build staged source/coverage outline | Utility or Reasoning | Proposal only. |
| `deck.titlePass` | Propose Lorecard/Loredeck titles | Utility | Proposal only. |
| `deck.contextTagPlan` | Propose context anchors, timeline, and tags | Utility | Proposal only. |
| `deck.lorecardDraft` | Draft schema-valid Lorecards | Reasoning | Proposal only. |
| `deck.healthRepair` | Propose Pack Health repairs | Utility or Reasoning | Proposal only. |
| `story.openerDraft` | Draft Story Maker variants | Reasoning | Proposal only. |
| `story.packageDraft` | Draft Story Package manifests | Reasoning | Proposal only. |
| `context.resolve` | Resolve active context from chat and stack | Utility | Read-only proposal. |
| `context.compress` | Compress context for prompt projection | Utility | Prompt-only output. |
| `retrieval.curate` | Select retrieval candidates from scored set | Utility | Read-only proposal. |
| `continuity.extract` | Extract candidate facts from selected source frames | Utility | Proposal only. |
| `continuity.loreCheck` | Check selected text against lore/graph | Reasoning | Report plus rewrite proposal. |
| `lore.automation` | Suggest automation actions | Utility | May mutate only through automation controller. |
| `source.summarize` | Summarize accepted source frames | Utility | Summary proposal only. |

Roles should be string constants with documented contracts. Local modules should not invent ad hoc role names.

## Authority Matrix

The authority matrix answers what a role may do:

| Authority | Meaning | Allowed examples |
| --- | --- | --- |
| `read` | Read source/context and return analysis. | Lore Check report, context recommendation. |
| `propose` | Return candidate state changes for review. | Lorecard drafts, health repairs, package drafts. |
| `prepareCommit` | Build a validated change set for a separate committer. | Pack repair patch after validation. |
| `commitThroughController` | Mutate state only through a deterministic controller. | Lore Automation actions after mode and ownership checks. |
| `promptOnly` | Produce text only for current prompt projection. | Context compression. |

No model role should write storage directly. Even roles with `commitThroughController` authority must pass through deterministic validators and action controllers.

## Router Contract

The router should accept a role request:

```js
await generationRouter.run({
  role: "deck.lorecardDraft",
  sourceIds: ["deck-project:hp-year-1:unit-04"],
  input,
  outputContract: "lorecardDraftBatch.v1",
  abortSignal,
  diagnosticsScope: "deck-maker",
});
```

The result should be normalized:

```json
{
  "ok": true,
  "role": "deck.lorecardDraft",
  "modelCallId": "model-call-20260630-001",
  "visibleText": "{\"entries\":[...]}",
  "parsed": { "entries": [] },
  "warnings": [],
  "diagnostics": {
    "providerKind": "lore",
    "visibleContentLength": 6211,
    "finishReason": "stop"
  }
}
```

Failures should preserve stable codes:

```json
{
  "ok": false,
  "role": "deck.lorecardDraft",
  "modelCallId": "model-call-20260630-002",
  "error": {
    "code": "json_invalid",
    "phase": "parse",
    "message": "Provider response did not contain valid JSON."
  }
}
```

## Provider Lane Selection

Settings should configure provider lanes by role group, not by every call site:

| Group | Roles |
| --- | --- |
| Deck Maker Utility | scope brief, outline, title pass, context/tag planning. |
| Deck Maker Reasoning | Lorecard drafting, dense coverage expansion. |
| Story Maker | opener variants, package manifests. |
| Context And Retrieval | context resolution, candidate curation, compression. |
| Continuity | extraction, lore check, conflict analysis. |
| Repairs | health repair, schema repair, migration assistance. |

The router should choose the provider profile through host capability and Saga settings, then hand off to the host generation adapter.

## Model-Call Journal

Every call should write a bounded journal entry:

```json
{
  "id": "model-call-20260630-001",
  "createdAt": "2026-06-30T15:42:10.000Z",
  "role": "deck.lorecardDraft",
  "roleGroup": "deckMakerReasoning",
  "sourceIds": ["deck-project:hp-year-1:unit-04"],
  "providerKind": "lore",
  "providerProfileId": "default-lore",
  "outputContract": "lorecardDraftBatch.v1",
  "status": "parsed",
  "errorCode": "",
  "visibleContentLength": 6211,
  "finishReason": "stop",
  "sample": "{\"entries\":[{\"id\":\"...",
  "rawStored": false
}
```

Rules:

- store no API keys, headers, or raw request bodies;
- store no hidden reasoning;
- store only a bounded text sample;
- use source IDs instead of copying source text;
- keep enough data to debug provider shape and parser phase;
- prune by count and age.

## Interaction With Existing Diagnostics

Deck Maker diagnostics should become a consumer of the model-call journal, not a parallel one-off system. Existing fields from `loredeck-creator-generation-diagnostics.js` can be mapped into the common journal:

- stage;
- unit ID;
- error code;
- result type;
- visible-content length;
- parse phase;
- repair attempts;
- salvage warnings.

Story Maker, Context Resolver, Auto-Relevance, Continuity, and Lore Assistant should follow the same structure.

## UI Surface

The main UI should not expose raw model traces. It should show:

- role name in failure details;
- short stable failure code;
- provider lane label;
- retry availability;
- copyable compact diagnostic summary;
- link to affected project/card/source when available.

Advanced diagnostics may show recent model-call journal entries with redacted samples.

## Loredeck And Lorecard Implications

Generated Lorecards should carry provenance:

```json
{
  "generation": {
    "role": "deck.lorecardDraft",
    "modelCallId": "model-call-20260630-001",
    "sourceIds": ["deck-project:hp-year-1:unit-04"],
    "acceptedAt": "2026-06-30T15:49:00.000Z",
    "acceptedBy": "user"
  }
}
```

The generation record should be compact. It should not store the prompt or raw response. A Lorecard can be trusted because it was accepted and validated, not because the raw model transcript is embedded in it.

## Required Updates

Implementation of this addendum will require updates to:

- new `F:\git\Saga\src\generation\generation-role-registry.js`;
- new `F:\git\Saga\src\generation\generation-authority-matrix.js`;
- new `F:\git\Saga\src\generation\generation-router.js`;
- new `F:\git\Saga\src\generation\model-call-journal.js`;
- provider client routing in `F:\git\Saga\src\providers`;
- Deck Maker generation runner and diagnostics;
- Story Maker generation;
- Context Resolver and Auto-Relevance;
- Continuity extractor and Lore Check;
- Settings provider lane UI;
- alpha gate fixtures for every role group.

## Verification

The slice is complete when:

1. Every provider-backed call has a registered role.
2. Unknown roles fail closed.
3. Role authority is enforced before mutation.
4. Existing typed provider errors survive through the router.
5. Model-call journals are bounded and sanitized.
6. Deck Maker, Story Maker, Context, Continuity, and Lore Automation can all report role-aware diagnostics.

