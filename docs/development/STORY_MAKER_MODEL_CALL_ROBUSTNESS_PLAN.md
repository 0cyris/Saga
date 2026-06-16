# Story Maker Model Call Robustness Pass Plan

Status: Implemented on 2026-06-16. This document defines the focused robustness pass for Story Maker provider calls after observed testing failures where roughly one in three generation attempts returned no usable result.

Saga is pre-alpha, so this pass should update the Story Maker call path in place. It does not need compatibility shims for old Story Maker internals beyond keeping current saved opener sessions loadable.

## Purpose

Story Maker now runs a multi-stage model pipeline:

- optional source fact refinement during Context Packet and Opener Brief preparation
- Opener Brief generation
- 1-5 parallel Draft Variant generations
- revision through the same draft path
- malformed JSON repair for JSON stages

With one-shot provider calls, a transient provider failure, empty visible output, token-limit stop, or malformed response can make the whole feature feel unreliable. The fix should be a stage-aware retry, diagnostics, and partial-success pass that keeps usable output, retries only the failed unit, and tells the user what actually failed when Saga cannot recover.

## Goals

- Give Story Maker up to 3 attempts for retryable provider units.
- Retry with different strategies based on the failure class instead of blindly sending the same prompt.
- Preserve successful variants when sibling variant calls fail.
- Retry failed variants individually instead of restarting the whole draft stage.
- Make retry progress visible with exact stage labels such as `Retrying Variant B, attempt 2 of 3`.
- Store compact sanitized attempt diagnostics on the opener session.
- Explain final failures clearly, especially token-limit, empty visible output, reasoning-only output, malformed JSON, and provider configuration failures.
- Keep Story Maker on the Reasoning Provider unless the user explicitly chooses otherwise in a future design.
- Reuse the shared provider response normalizer and Story Maker JSON repair path.
- Add regression coverage with fake provider failures so this does not depend on live-provider luck.

## Non-Goals

- Do not auto-send openers to chat.
- Do not silently switch to another provider for final opener prose.
- Do not expose raw provider payloads in normal UI.
- Do not store hidden reasoning text by default.
- Do not add a large new user-facing settings surface for retries.
- Do not make all Story Maker calls sequential unless rate limiting proves it is required.
- Do not use exact word-count policing as a hard failure for opener prose.

## Current Code Map

Primary files:

- `src/story-openers/story-opener-generation.js`
  - `refineStoryOpenerFacts(...)`
  - `buildStoryOpenerBrief(...)`
  - `writeStoryOpenerVariant(...)`
  - `writeStoryOpenerVariants(...)`
  - `parseStoryOpenerJsonResponse(...)`
  - `repairStoryOpenerJsonWithProvider(...)`
  - `normalizeProviderFailure(...)`
- `src/story-openers/story-opener-state.js`
  - `normalizeStoryOpenerRun(...)`
  - `normalizeStoryOpenerFailure(...)`
  - `recordStoryOpenerRun(...)`
  - `normalizeStoryOpenerSession(...)`
- `src/runtime/story-opener-panel.js`
  - `STORY_OPENER_GENERATION_STATUSES`
  - `runContextPacketStage(...)`
  - `runBriefStage(...)`
  - `runDraftStage(...)`
  - `createStoryOpenerGenerationStatus(...)`
  - `createFailureCard(...)`
- `src/providers/lore-response-normalizer.js`
  - `assertLoreResponseText(...)`
  - `getLoreResponseFailure(...)`
  - typed failures for `provider_empty_content`, `provider_reasoning_only`, and `provider_token_limit`

Focused tests:

- `tools/scripts/test-story-opener-pipeline.mjs`
- `tools/scripts/test-saga-story-opener-storage.mjs`
- `tools/scripts/test-generation-response-shapes.mjs`
- `tools/scripts/test-loredeck-creator-generation-recovery.mjs`
- `tools/scripts/test-generation-job-runner.mjs`

Important current behavior:

- Story Maker already uses the shared visible-response normalizer through `assertLoreResponseText(...)`.
- JSON stages already strip reasoning blocks, extract balanced JSON, repair common JSON, and can ask the provider to repair malformed JSON.
- Draft variants already preserve partial successes when at least one variant succeeds.
- The UI status allowlist includes `retrying`, but the run normalizer currently preserves only `queued`, `running`, `complete`, `error`, and `interrupted`. The robustness pass must align these contracts before storing retry progress.

## Failure Taxonomy

### Retryable

These should normally get up to 3 attempts:

| Code | Meaning | Retry strategy |
| --- | --- | --- |
| `provider_timeout` | Provider request timed out or was aborted by infrastructure, not the user. | Backoff and retry same payload first. |
| `provider_rate_limited` | Provider returned 429 or an equivalent rate-limit signal. | Respect retry-after if available, then retry with backoff. |
| `provider_request_failed` | Generic transient provider or network failure. | Backoff and retry same payload first. |
| `provider_empty_content` | Provider returned no visible content. | Retry with visible-output-only instructions. |
| `provider_reasoning_only` | Provider spent output on hidden/visible reasoning and returned no final answer. | Retry with final-only visible output instructions and lower-output pressure. |
| `provider_token_limit` | Provider hit max output/completion tokens. | Retry with compacted payload or shorter output instruction. |
| `json_invalid` | JSON could not be parsed after local cleanup. | Attempt JSON repair, then retry with stricter JSON-only prompt if repair fails. |
| `json_repair_failed` | Provider repair call did not produce valid JSON. | Retry original stage with schema-first prompt. |
| `stage_contract_failed` | Valid JSON omitted required Story Maker fields. | Retry with missing-field guidance and a compact schema. |
| `opener_empty_or_rejected` | Draft prose normalized to empty or JSON-like output. | Retry with plain-prose-only instruction. |

### Non-Retryable

These should fail fast with a clear user message:

| Code | Meaning | User guidance |
| --- | --- | --- |
| `provider_missing_config` | Reasoning Provider is not configured. | Open Settings and configure/test the Reasoning Provider. |
| `provider_auth_failed` | API key, profile, endpoint, or model authorization failed. | Review provider settings and API credentials. |
| `user_cancelled` | User cancelled the run. | No recovery warning beyond cancelled state. |
| `source_missing` | Required local inputs are missing. | Fill User Prompt, Context, and active Loredecks. |
| `source_resolution_failed` | Latest lore sources cannot be resolved. | Refresh sources or add Loredecks. |
| `guardrail_blocked` | Local guardrails say the requested output would violate current Context. | Adjust Context, prompt, or source stack. |

## Retry Policy

Default policy:

```js
{
  maxAttempts: 3,
  retryableCodes: [...],
  backoffMs: [0, 600, 1800],
  jitterMs: 250,
  providerKind: "lore"
}
```

The policy should be internal at first. Story Maker already has enough visible controls, and retry count is an implementation detail unless repeated failures require an Advanced diagnostic setting later.

### Attempt 1

Use the normal stage prompt.

### Attempt 2

Use the failure-specific recovery prompt:

- JSON stage malformed or contract failure: compact schema first, `Return valid JSON only. No markdown. No commentary.`
- prose stage empty or JSON-like: `Return only visible opener prose. Do not return JSON. Do not include labels, commentary, or analysis.`
- reasoning-only: `Return the final answer in visible assistant content only. Do not place the answer in reasoning.`
- transient provider error: retry same payload after backoff.

### Attempt 3

Use the safer payload:

- Keep `mustAvoid`, high-score `mustUse`, `fresh`, direct Context, controls, and brief.
- Trim lower-ranked supporting facts.
- Trim examples, diagnostics, and redundant packet metadata.
- For prose only, preserve the selected target length label but add compactness guidance if token-limit or empty-output failures repeat.

Attempt 3 should not silently mutate session controls. It is a retry payload strategy, not a change to the user's saved inputs.

## JSON Repair Contract

JSON repair should remain part of the JSON-stage recovery path, but it should not create an unbounded retry tree.

Recommended flow for each JSON stage attempt:

1. Call the stage provider.
2. Normalize visible text with `assertLoreResponseText(...)`.
3. Try `parseStoryOpenerJsonResponse(...)`.
4. If parsing fails, run one repair call through `repairStoryOpenerJsonWithProvider(...)`.
5. If repair succeeds, accept the repaired JSON and record `repairAttempted: true`.
6. If repair fails, classify as `json_repair_failed` and decide whether the outer stage attempt can retry.

Repair calls should use the same response normalizer and produce their own compact diagnostic entry, but they should not recursively invoke another repair call.

## Variant Recovery

Draft Variants is the highest-risk stage because the user can request 1-5 simultaneous provider calls.

Required behavior:

- Start the requested variant calls in one pass.
- Isolate results with `Promise.allSettled(...)` or equivalent defensive handling.
- Keep every successful variant.
- Retry only failed variants.
- Preserve original variant labels across retries: `Variant A`, `Variant B`, etc.
- Do not fail Draft Variants if at least one variant succeeds.
- If some variants fail after all attempts, show a warning and keep the stage usable.

Example final messages:

- `Created 5 variants.`
- `Created 4 of 5 variants. Variant C failed after 3 attempts.`
- `No variants were usable after 3 attempts.`

Rate-limit note:

- Cost is not the main constraint for this feature.
- Provider rate limiting can still cause false failures.
- If 5 parallel calls repeatedly trigger 429s, retry failed variants with backoff and jitter before considering a concurrency cap.

## Progress And UI Copy

Use exact labels. Avoid vague verbs like `Thinking`, `Making`, `Crafting`, or `Polishing`.

Suggested stage labels:

- `Resolving Story Maker Sources`
- `Building Context Packet`
- `Selecting Source Facts`
- `Retrying Source Fact Selection, attempt 2 of 3`
- `Drafting Opener Brief`
- `Repairing Opener Brief JSON`
- `Retrying Opener Brief, attempt 2 of 3`
- `Drafting Variant A`
- `Retrying Variant A, attempt 2 of 3`
- `Revising Variant A`
- `Retrying Revision, attempt 2 of 3`
- `Finalizing Variant Results`

State model requirement:

- Either add `retrying` to `normalizeStoryOpenerRun(...)` and active-generation detection, or keep run status as `running` while storing `phase: "retrying"`.
- Prefer adding `retrying` as a real run status because `story-opener-panel.js` already recognizes it.
- Active generation detection must treat `retrying` as active so buttons stay locked and progress remains visible.

## Failure Card UX

Final failure messages should be actionable and stage-specific.

Examples:

### Empty output

`The Reasoning Provider returned empty visible output after 3 attempts. This often means the model is spending output on reasoning, the response was truncated, or the selected API/model is not returning assistant content. Increase Max Tokens, lower reasoning effort, or try a different Reasoning model/API.`

### Token limit

`The Reasoning Provider hit its output token limit after 3 attempts. Increase Reasoning Provider Max Tokens, reduce opener scope, or use a model/provider with a larger output limit.`

### Malformed JSON

`The Reasoning Provider returned malformed Opener Brief JSON after repair and retry. Retry the stage, or simplify Context and User Prompt if this repeats.`

### Stage contract failure

`The Reasoning Provider returned JSON, but it omitted required Opener Brief fields: scenePlan, styleGuidance. Saga retried with stricter schema instructions and still could not build a usable brief.`

### Partial variants

`Created 3 of 5 variants. Variant B and Variant E failed after 3 attempts. You can review the successful variants or retry failed variants.`

UI actions:

- `Retry Failed Stage`
- `Retry Failed Variants` when there are partial variant failures
- compact `Details` disclosure for attempts and provider diagnostics

## Attempt Diagnostics

Store compact, sanitized attempt history. Do not store raw provider payloads by default.

Proposed attempt shape:

```json
{
  "attemptId": "attempt-opener_brief-2-mabc123",
  "stage": "opener_brief",
  "unitId": "opener_brief",
  "variantIndex": null,
  "variantLabel": "",
  "attempt": 2,
  "maxAttempts": 3,
  "status": "error",
  "strategy": "json_schema_retry",
  "providerTitle": "Reasoning",
  "errorCode": "json_invalid",
  "message": "Model response was not valid JSON.",
  "recovery": "Retrying with stricter JSON-only instructions.",
  "finishReason": "",
  "maxTokens": 4096,
  "visibleContentLength": 0,
  "repairAttempted": true,
  "startedAt": 0,
  "completedAt": 0
}
```

Add run-level fields:

```json
{
  "attempts": [],
  "attemptCount": 0,
  "failedUnitCount": 0,
  "succeededUnitCount": 0,
  "partial": false
}
```

Normalization requirements:

- Limit attempts per run to a compact maximum, such as 40.
- Strip raw prompts and raw model output from persisted diagnostics.
- Keep visible content length and short sanitized sample only when useful.
- Preserve existing `failure` shape for simple UI compatibility.

## Prompt Strategy By Stage

### Source Fact Refinement

Retryable failures:

- provider transport
- empty visible output
- malformed JSON
- stage contract failure

Attempt 3 should shrink candidate facts:

- keep direct Context facts
- keep highest-score `mustUse`
- keep `fresh`
- keep all `mustAvoid`
- trim supporting facts

If fact refinement fails but the unrefined Context Packet is still locally valid, Story Maker may continue without provider refinement and record a warning. This is a degraded-but-usable path, not a full blocker.

### Opener Brief

Opener Brief is the highest-value structured call. It should be retried before failing.

Retry prompt additions:

- include the exact required JSON shape
- name missing fields from the previous attempt
- repeat that `mustAvoid` is a hard exclusion
- ask for compact arrays instead of verbose prose

If all attempts fail, stop before Draft Variants. Do not draft directly from an invalid or missing brief.

### Draft Variants

Retry prompt additions:

- final prose only
- no JSON
- no commentary
- no labels
- no title
- no analysis

For token-limit failures:

- keep the target length control unchanged
- add compactness guidance on retry
- do not erase the user's selected `Chapter` target from saved controls

### Revision

Revision should use the same variant retry system but with revision-specific labels:

- `Revising Variant A`
- `Retrying Revision, attempt 2 of 3`

If revision fails, preserve the original selected variant and record the failed revision attempt. Never replace a selected opener with an empty or failed result.

## Implementation Slices

### Slice 1: Retry Helper And Failure Classifier

Add a Story Maker provider unit helper, either in `src/story-openers/story-opener-generation.js` or a new focused module such as `src/story-openers/story-opener-provider-retry.js`.

Core API sketch:

```js
async function runStoryOpenerProviderUnit({
  stage,
  unitId,
  variantIndex,
  variantLabel,
  buildPrompt,
  parse,
  validate,
  repair,
  compact,
  maxAttempts = 3,
  maxTokens,
  signal,
  onProgress
})
```

Tasks:

- Add retryable/non-retryable classification.
- Map provider/network/status errors into stable codes.
- Add backoff and jitter.
- Emit attempt progress events.
- Return `{ ok, value, attempts, failure }`.
- Keep provider routing on the Reasoning Provider path.

Acceptance:

- A fake empty-output first attempt and successful second attempt produces one final success with attempt diagnostics.
- A non-retryable config failure fails after one attempt.

### Slice 2: Run State And Diagnostics

Update `src/story-openers/story-opener-state.js`.

Tasks:

- Preserve `retrying` in `normalizeStoryOpenerRun(...)`.
- Treat `retrying` as active in `normalizeStoryOpenerSession(...)` and `recordStoryOpenerRun(...)`.
- Add normalized run attempt fields.
- Add compact attempt diagnostics.
- Keep older sessions loadable by defaulting missing attempt fields.

Update `src/runtime/story-opener-panel.js`.

Tasks:

- Render retry labels and attempt counts.
- Keep provider-backed buttons disabled while status is `queued`, `running`, or `retrying`.
- Keep scroll behavior stable during progress updates.

Acceptance:

- A retrying run does not disappear from `activeGeneration`.
- Build Context Packet and Generate Full Pipeline remain mutually locked during retries.

### Slice 3: JSON Stage Integration

Update:

- `refineStoryOpenerFacts(...)`
- `buildStoryOpenerBrief(...)`
- `repairStoryOpenerJsonWithProvider(...)`

Tasks:

- Run refinement and brief calls through the retry helper.
- Keep one repair call per stage attempt.
- Convert parse failures and contract failures into retryable unit failures.
- Continue without refinement if refinement fails but the local Context Packet is still valid.
- Stop on Opener Brief failure.

Acceptance:

- Malformed JSON can be repaired.
- Malformed JSON that cannot be repaired retries with stricter schema instructions.
- Valid JSON missing required fields retries with missing-field guidance.

### Slice 4: Variant Integration

Update:

- `writeStoryOpenerVariant(...)`
- `writeStoryOpenerVariants(...)`

Tasks:

- Wrap each variant unit with retry attempts.
- Retry only failed variants.
- Use `Promise.allSettled(...)` or equivalent defensive isolation.
- Store per-variant failure diagnostics.
- Keep successful variants even when some fail.
- Only fail the stage when zero variants are usable.

Acceptance:

- 5 requested variants with 2 transient failures can finish with all 5 after retries.
- 5 requested variants with 2 permanent failures finishes with 3 usable variants and a warning.
- A failed revision leaves the original selected opener intact.

### Slice 5: Failure UI And Manual Recovery

Update `createFailureCard(...)` and related stage cards.

Tasks:

- Add clear final failure summaries.
- Add compact details disclosure.
- Add `Retry Failed Stage`.
- Add `Retry Failed Variants` for partial variant failures.
- Keep copy/review available when at least one variant exists.

Acceptance:

- User can understand whether the issue was provider config, max tokens, empty output, malformed JSON, or a local contract failure.
- Partial variant failures do not block Review & Copy.

### Slice 6: Tests And Smoke Coverage

Add or extend:

- `tools/scripts/test-story-opener-pipeline.mjs`
- `tools/scripts/test-saga-story-opener-storage.mjs`
- `tools/scripts/test-generation-response-shapes.mjs`

Test cases:

- empty visible output, then success
- reasoning-only output, then visible final output
- token-limit failure, then compact retry success
- malformed JSON, local repair success
- malformed JSON, provider repair success
- malformed JSON, repair failure, retry success
- valid JSON missing required Opener Brief fields, retry success
- non-retryable provider config failure fails once
- 5 variants, some fail then recover
- 5 variants, some permanently fail, partial success preserved
- all variants fail after 3 attempts
- retrying run state persists and remains active
- failed revision preserves original selected variant

Manual/visual checks:

- Desktop Story Maker progress row shows exact retry labels.
- Mobile Story Maker progress row fits without clipped text.
- Provider-backed buttons remain locked during retry.
- Failure card is readable on desktop and mobile.
- Partial variant warning does not push Review & Copy into an awkward layout.

## Acceptance Criteria

- Story Maker model-backed stages use a shared retry policy with up to 3 attempts for retryable failures.
- Retry progress is visible and uses exact labels.
- `retrying` state is preserved or equivalent active retry phase is stored correctly.
- Opener Brief failures distinguish provider, JSON parse, repair, and stage-contract issues.
- Variant drafting preserves partial successes and retries only failed variants.
- Final failures include concrete guidance for token settings, reasoning-only output, provider settings, or model/API selection.
- Attempt diagnostics are stored compactly and sanitized.
- Tests cover retry success, retry exhaustion, non-retryable failure, and partial variant success.
- Desktop and mobile Story Maker UI remain usable during retry, failure, and partial-success states.

## Implementation Evidence

Implemented files:

- `src/story-openers/story-opener-generation.js`
- `src/story-openers/story-opener-state.js`
- `src/runtime/story-opener-panel.js`
- `styles/runtime.css`
- `tools/scripts/test-story-opener-pipeline.mjs`
- `docs/user/STORY_MAKER_DESKTOP_GUIDE.md`
- `docs/user/STORY_MAKER_MOBILE_GUIDE.md`

Verification run:

- `node tools/scripts/test-story-opener-pipeline.mjs`
- `node tools/scripts/test-saga-story-opener-storage.mjs`
- `node tools/scripts/test-generation-response-shapes.mjs`
- `node tools/scripts/test-generation-job-runner.mjs`
- `node tools/scripts/test-loredeck-creator-generation-recovery.mjs`

## Open Decisions

- Should `retrying` be a real run status, or should Saga keep `status: "running"` with `phase: "retrying"`? This plan prefers a real status because the panel already recognizes it.
- Should failed fact refinement degrade to local packet for every failure, or only after retryable failures are exhausted? This plan prefers degrading after exhausted retryable failures when the local packet is valid.
- Should retry attempt count remain fixed at 3, or should Advanced diagnostics expose it later? This plan keeps it fixed for now.
- Should provider repair calls use the same full retry helper? This plan treats repair as one sub-attempt per outer attempt to avoid recursive retry trees.
