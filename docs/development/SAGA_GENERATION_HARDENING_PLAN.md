# Saga Generation Hardening Plan

Status: Slice 6 code and focused regression coverage are complete. Slice 1 added a shared provider response normalizer, Deck Maker parser wiring, and regression fixtures for chat-completion object responses. Slice 2/3 now include typed provider response failures for token-limit, reasoning-only, and empty-content outputs. Slice 3 now annotates uncoded parser failures as `json_invalid`, salvaged truncated row parses as `json_truncated_salvaged`, and commit callback failures as `commit_failed`. Slice 3 also maps those stable codes to Deck Maker stage messages and structured console warnings so user notifications do not leak parser/eval-style text. Slice 3/4 added typed generation validation results and Deck Maker stage-contract validators that can trigger repair before commit. Slice 5 records compact sanitized diagnostics on failed Deck Maker generation units and surfaces them from Deck Maker Job panel with a copy action, without storing raw provider responses. Slice 6 hardens non-Creator parser boundaries and parse-failure codes for Lore Assistant drafting, Context resolution, Auto-Relevance, Continuity scanning, Story Lore generation, and Injection compression. Remaining validation is live-provider manual QA and the broader alpha gate.

## Purpose

Saga model calls should fail clearly, recover when a response contains usable visible content, and preserve enough sanitized diagnostics to debug provider-specific behavior.

The immediate issue came from a valid chat-completion response whose usable JSON lived in `choices[0].message.content`. The Planning Context & Tags path treated the raw result like plain text, which can degrade an object into an unparsable string. The fix should become a durable generation contract rather than a one-stage workaround.

## Problem Statement

Saga currently has several model-backed paths with different assumptions about provider output:

- OpenAI-compatible endpoints usually return chat-completion objects.
- SillyTavern connection profiles can return strings, objects, or provider-shaped responses.
- Some reasoning models may return hidden reasoning, empty visible content, token-limit finish reasons, or partial JSON.
- Deck Maker stages need stage-specific proposal validation after generic JSON parsing.

When these assumptions drift, the user sees generic parse, eval, or failed-generation messages even when the response contains recoverable JSON.

## Goals

- Make `sendLoreRequest()` and generation runners expose a stable visible-text contract.
- Keep Deck Maker generation steps hardened consistently: Scope Brief, Story Outline, Title Pass, Context and Tag Planning, and Lorecard drafting.
- Add deterministic fixtures for common provider response shapes.
- Produce stage-specific failure messages that identify whether extraction, JSON parsing, schema validation, or commit failed.
- Store small sanitized diagnostics for failed generation units.
- Audit and harden similar model-call paths outside Deck Maker.

## Non-Goals

- Do not add legacy compatibility layers for old Creator states.
- Do not store full raw model transcripts by default.
- Do not make raw provider payloads a normal user-facing surface.
- Do not replace staged Deck Maker workflow, Pending Review, or Pack Health.
- Do not rely on prompt wording as the primary fix for provider-shape issues.

## Hardening Layers

### 1. Response Extraction Contract

All model-backed generation should normalize provider output before parsing.

Supported visible-content shapes:

```json
{ "choices": [{ "message": { "content": "{...json...}" } }] }
```

```json
{ "message": { "content": "{...json...}" } }
```

```json
{ "content": [{ "type": "text", "text": "{...json...}" }] }
```

```json
{ "text": "{...json...}" }
```

Expected behavior:

- If visible content exists, return that text.
- If only hidden reasoning exists, throw a typed reasoning-only error with a short preview.
- If finish reason indicates a token limit, throw a typed token-limit error.
- If the object already has Saga response shape, stringify it for local tests and direct parser use.
- If no supported content exists, throw a typed empty-content error.

### 2. Parser And Salvage Contract

Parsers should accept either normalized text or known chat-completion objects. They should:

- Strip markdown fences and reasoning tags.
- Parse balanced JSON objects or arrays.
- Salvage complete rows from truncated `proposals`, `titleDrafts`, or `entries` arrays.
- Preserve warnings that explain when salvage occurred.
- Add `json_truncated_salvaged` as a machine-readable warning code when row salvage is used.
- Avoid using `String(rawObject)` as the first fallback for plain provider objects.

### 3. Stage-Specific Validation

Generic JSON parsing is not enough. Each Deck Maker stage needs validation that names the failed contract:

- Scope Brief: valid JSON but no usable `brief`.
- Story Outline: valid JSON but no usable `outline`.
- Title Pass: valid JSON but no supported `titleDrafts`.
- Context and Tag Planning: valid JSON but no supported `upsert_timeline_anchor`, `upsert_timeline_window`, or `upsert_tag_definition` proposals.
- Lorecard drafting: valid JSON but no supported schema v3 `upsert_entry` proposals.

The user-facing failure should distinguish these from provider transport errors.

### 4. Sanitized Diagnostics

Failed generation units should store compact diagnostics in job state:

```json
{
  "stage": "context_tag_planning",
  "providerKind": "lore",
  "resultType": "object",
  "finishReason": "stop",
  "visibleContentLength": 4120,
  "parsePhase": "stage_validation",
  "errorCode": "creator_planning_no_supported_actions",
  "errorMessage": "Valid JSON returned no supported Context or Tag planning proposals.",
  "sample": "{\"summary\":\"...\""
}
```

Rules:

- Redact API keys and request headers.
- Store at most a short text sample.
- Prefer error codes over long prose.
- Do not persist hidden reasoning unless explicitly added to a developer-only diagnostic export later.

## Implementation Slices

### Slice 1: Lock Creator Response Normalization

Scope:

- Keep the shared Deck Maker runner using normalized visible text for parse, repair, commit result references, and saved `responseText`.
- Add runner-level tests where `callUnit()` returns a chat-completion object.
- Assert parse, repair, commit, and result history receive visible assistant JSON.

Acceptance:

- All five Deck Maker stages use the same normalized raw-result path.
- A chat-completion object does not produce `[object Object]`, object-inspection text, or generic invalid JSON errors.
- `test-loredeck-assistant.mjs`, `test-loredeck-creator-generation-recovery.mjs`, and `test-generation-job-runner.mjs` cover the path.

### Slice 2: Provider Contract Tests

Scope:

- Add fixture tests for visible-content variants:
  - `choices[0].message.content`.
  - `message.content`.
  - `content` as text parts.
  - plain `text`.
  - direct Saga-shaped JSON object.
- Add negative fixtures:
  - reasoning-only response.
  - empty visible content.
  - token-limit finish reason.
  - malformed JSON with salvageable rows.

Acceptance:

- Provider extraction behavior is deterministic and documented in tests.
- Error messages preserve the provider title and a short actionable reason.

Progress:

- `getLoreResponseFailure()` identifies `provider_token_limit`, `provider_reasoning_only`, and `provider_empty_content` deterministically.
- `createLoreResponseError()` preserves the stable `error.code` and compact details for diagnostics.
- Provider client token-limit, reasoning-only, and empty-content failures now throw shared typed response errors.

### Slice 3: Typed Generation Errors

Scope:

- Introduce a small error model for generation failures:
  - `provider_empty_content`.
  - `provider_reasoning_only`.
  - `provider_token_limit`.
  - `json_invalid`.
  - `json_truncated_salvaged`.
  - `creator_stage_contract_failed`.
  - `commit_failed`.
- Keep existing toasts compact, but let detail panels and logs show the error code.

Acceptance:

- User notifications no longer use vague eval-style wording for Deck Maker stages.
- Developer console warnings include stage, unit ID, and error code.

Progress:

- Provider failures preserve `provider_empty_content`, `provider_reasoning_only`, and `provider_token_limit` through parser boundaries.
- Generation parser exceptions without an existing code are normalized to `json_invalid`.
- Truncated Assistant proposal/title/entry responses that salvage complete rows return `warningCodes: ["json_truncated_salvaged"]`.
- Repair callbacks receive the original parser error name plus the stable `json_invalid` code.
- Commit callback exceptions without an existing code are normalized to `commit_failed`.
- Deck Maker stage catch paths format stable codes into stage-specific user messages for Scope Brief, Story Outline, Title Pass, Context and Tag Planning, and Lorecard drafting.
- Creator runner failures write structured console warnings with stage, unit ID, error code, phase, finish reason, and visible-content length.

### Slice 4: Stage-Specific Validators

Scope:

- Add pure validators for Creator parsed results.
- Use validators before committing pending changes.
- Make repair prompts receive the normalized visible text and the validation failure code.

Acceptance:

- Planning repair only runs when JSON extraction or planning contract validation fails.
- Lorecard drafting cannot silently accept non-entry proposals.
- Clarifying-question responses remain valid and do not show as failures.

### Slice 5: Failure Diagnostics In Job State

Scope:

- Extend generation unit checkpoints with sanitized diagnostic fields.
- Surface a compact failed-unit detail in the Deck Maker job row.
- Add a copyable diagnostic summary for developer troubleshooting.

Acceptance:

- A failed unit records result type, extracted length, finish reason, parse phase, and error code.
- No full raw provider response is stored by default.
- Reopening Deck Maker preserves the diagnostic summary.

Progress:

- Failed units persist only the allowlisted diagnostic fields.
- Deck Maker Job panel shows the latest recoverable unit's compact diagnostic summary.
- The diagnostic copy action serializes the same allowlisted fields and excludes raw provider payloads and provider headers.

### Slice 6: Audit Non-Creator Model Calls

Scope:

Audit and harden these paths for the same response-shape assumptions:

- Lore Assistant proposal drafting.
- Context resolver model proposals.
- Auto-Relevance.
- Continuity scan and reducers.
- Story-lore generation and repair.
- Injection compression.

Acceptance:

- Each model-backed path either uses the shared normalized response contract or has a documented reason not to.
- Tests cover at least one object-response fixture per parser family.

Progress:

- Lore Assistant revision and draft flows share one normalized JSON request/parse helper with stable `json_invalid` parse annotation and compact code-aware console warnings.
- Context resolver model responses normalize provider-shaped visible text before JSON parsing and report malformed model JSON as `model_parse_failed` with `json_invalid`.
- Auto-Relevance adjudication responses normalize provider-shaped visible text before JSON parsing and report malformed model JSON as `failed_parse` with `json_invalid`.
- Continuity observation and reducer parsers normalize provider-shaped visible text before JSON parsing; reducer parse failures carry `json_invalid`.
- Context detection and Story Lore bulk extraction normalize provider-shaped visible text before parsing or repair; unrepaired visible malformed extraction responses carry `json_invalid`.
- Injection compression cleanup normalizes provider-shaped visible text before fence stripping and validation.
- `test-generation-response-shapes.mjs` covers chat-completion object fixtures across parser families.

#### Slice 6 Request Boundary Audit

- Deck Maker stage requests in `src/runtime/lore-panel.js` all request `expectedOutput: 'json'` and flow through the hardened Deck Maker generation runner or shared Lore Assistant JSON helper before parsing or committing.
- Context resolution in `src/context/context-resolver.js` requests JSON, parses provider-shaped visible text, and reports malformed visible JSON as `model_parse_failed` with `json_invalid`.
- Auto-Relevance in `src/context/auto-relevance.js` requests JSON, parses provider-shaped visible text, and returns `failed_parse` with `json_invalid` when visible JSON is malformed.
- Continuity observation, reducer, and delta requests in `src/continuity/continuity-scanner.js` request JSON and parse provider-shaped visible text; reducer parse failures carry `json_invalid`.
- Story Lore generation in `src/lorecards/lore-generator.js` defaults quiet generation requests to JSON, normalizes visible text, and records `json_invalid` for visible malformed bulk extraction responses that cannot be repaired.
- Injection compression in `src/runtime/injection-preview-panel.js` intentionally requests `expectedOutput: 'text'`; cleanup still normalizes provider-shaped visible text before fence stripping and length/content validation.
- `src/providers/lore-llm-client.js` remains the provider boundary for token-limit, reasoning-only, and empty-content failures, while parser-level normalization stays as a defensive layer for tests and direct helper inputs.

## Test Plan

Focused commands:

```powershell
node tools\scripts\test-loredeck-assistant.mjs
node tools\scripts\test-loredeck-creator-generation-recovery.mjs
node tools\scripts\test-generation-job-runner.mjs
node tools\scripts\test-generation-response-shapes.mjs
node tools\scripts\test-context-model-resolver.mjs
node tools\scripts\test-prompt-compression-contract.mjs
```

Broader release-gate command:

```powershell
node tools\scripts\run-alpha-gate.mjs
```

Manual QA:

- Use a reasoning model through a connection profile.
- Generate Scope Brief, Story Outline, Title Pass, Context and Tag Planning, and one Lorecard micro-batch.
- Confirm that a successful generation queues proposals.
- Confirm that a malformed response gives a stage-specific failure or a repair attempt.
- Confirm that the failed-unit job row exposes a compact diagnostic without raw transcript storage.

## Open Questions

- Should normalized response extraction live only in `lore-llm-client.js`, or should parser-level fallback remain as a defensive layer?
- Should failed generation diagnostics be exportable through State Safety, or kept only in active job state?
- Should stage validators return user-facing copy directly, or return codes that the UI maps to copy?

## Completion Definition

This hardening track is complete when:

- Deck Maker generation no longer depends on provider responses being plain strings.
- Similar object-response failures are covered by deterministic tests across parser families.
- Failed generation units identify the failing phase and stage contract.
- Sanitized diagnostics make provider-specific failures debuggable without storing full model transcripts.
