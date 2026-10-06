# Saga reliability review — 2026-10-06

Saga's main reliability risks are asynchronous state ownership and persistence semantics. Several operations can write into the wrong chat, remove an existing payload while attempting rollback, lose storage-index records, or report success after a failed write. Reproducible Context-gating and cache defects also undermine timeline-safe retrieval.

The first stabilization pass should establish three invariants: **a job only commits to its originating chat; a failed save preserves the last durable payload; and a completed generation result is never replayed because its checkpoint failed.** Broad frontend decomposition becomes safer after these boundaries have behavioral tests.

## Scope and verification

- Initial revision: `2294dd1ec61fee33e49eede297871ec0fcaa99e1`, branch `main`, release `0.4.0-alpha.4`.
- Reviewed storage/state, continuity/Lore Automation, provider adapters/generation runners, Context indexing/gating, package import, extension lifecycle, runtime composition, and verification workflows. This was a risk-focused review, not a line-by-line certification of every module.
- All **209 JavaScript source files passed syntax checks**.
- A sequential run of **164 discovered test scripts passed 162**; its two failures are explained below. The run also passed the alpha gate's 99 configured syntax checks.
- Two concurrently added Creator planning tests passed separately. One was already discovered by the broader run; these are not two additional unique tests in the 164 count.
- In-memory fixtures reproduced rollback loss, lost master-index updates, masked queue failures, committed-unit replay, auth retries, a Context-cache race, three gate defects, and supported-import migration failure. A fixture proved the save primitive writes A-owned state into B after a context switch; full live scans were not exercised.
- GitHub CLI authentication was valid. Remote Actions history showed successful Loredeck Builder workflows; no open issues or PRs were returned at review time.
- This review changed no production source. Concurrent Creator UI, storage hydration, test, alpha-gate, and Deck Maker guide edits were preserved. References and test results describe the observed checkout during this review; the assessed failure paths remain present after those edits.

**Evidence:** `Reproduced` means an isolated fixture demonstrated the behavior. `Traced` means production flow establishes the failure path without running the complete host workflow. `Improvement` means a guardrail or architectural opportunity, not an observed incident.

**Priority:** P1 means address early for data integrity, chat isolation, or core eligibility. P2 means recovery, resource limits, lifecycle, or verification hardening. No live incident or P0 outage is claimed.

## Prioritized findings

### 1. P1 — Rollback can delete an existing canonical payload

**Reproduced.** [saga-domain-storage.js](F:/git/Saga/src/storage/saga-domain-storage.js:360)

`writePayload()` overwrites a deterministic path, then registers it in the master index. If registration fails, rollback deletes that same path. On updates, this removes the user's canonical payload; the domain record can still point to it. The fixture observed write-existing-path → delete-same-path → `payloadExistsAfterFailure:false`. Current rollback coverage tests a new file, which does not establish update safety.

**Fix:** write a versioned replacement, verify it, switch the owning index pointer, and garbage-collect the prior version after commit. If temporarily retaining deterministic paths, preserve/restore prior bytes and distinguish new-file cleanup from update rollback.

**Regression:** seed an existing payload, fail each later commit step, reopen, and assert its previous durable contents remain readable.

### 2. P1 — Async continuity and Lore Automation can mutate another chat

**Traced; shared save primitive reproduced.** [continuity checkpoints](F:/git/Saga/src/continuity/continuity-scanner.js:387), [finalization](F:/git/Saga/src/continuity/continuity-scanner.js:1118), [relevance commit](F:/git/Saga/src/context/auto-relevance.js:2141), [classifier callback](F:/git/Saga/src/context/auto-relevance.js:2219), [saveState](F:/git/Saga/src/state/state-manager.js:394)

Start work in A, switch to B while the provider awaits, and let it complete. Continuity checkpoints/finalization reacquire current state and write A's observations/delta into it. Auto-Relevance retains state across awaits, then saves through the current context; its classifier reacquires current state too. `saveState()` targets the context returned at call time. A mock captured A, switched to B, and saved A: B's location became `Chat A` and B held the exact A object.

**Fix:** capture stable chat identity and job generation at entry; require both before every checkpoint/commit. Invalidate/cancel on switch and disable. Use a bound persistence adapter only if background-chat completion is intentionally supported.

**Regression:** defer continuity, adjudicator, and classifier independently; switch A → B; resolve; B's ledger, state, cadence, delta, and prompt remain untouched.

### 3. P1 — Default API instances bypass master-index serialization

**Reproduced.** [saga-storage-index.js](F:/git/Saga/src/storage/saga-storage-index.js:419), [default adapter construction](F:/git/Saga/src/storage/saga-lorepack-payload-storage.js:71)

The queue is keyed by `fileApi` object identity, but domain helpers create fresh APIs by default. Stores sharing the same backend index can both read an old index and overwrite each other's registration. The existing concurrency test shares one API. The distinct-adapter fixture lost `race-a`, retaining only `race-b`.

**Fix:** one coordinator per account/backend/index path for every mutation, including verification. Add server conditional writes/revision enforcement where available for cross-tab safety; a process-local queue cannot guarantee that alone.

**Regression:** distinct adapters retain both simultaneous registrations; exercise register/unregister/verification overlap and stale writes across tabs.

### 4. P1 — Later success erases earlier queued save failures

**Reproduced.** [payload queue](F:/git/Saga/src/storage/saga-lorepack-payload-storage.js:407), [flush](F:/git/Saga/src/storage/saga-lorepack-payload-storage.js:682)

A successful operation clears the scalar `lastPayloadWriteError`. If A fails and unrelated B succeeds, flush reports `ok:true`, empty error, and zero pending writes. The fixture reproduced precisely that. Library, Creator, and Story Maker queues use the same pattern.

**Fix:** keep per-operation outcomes, owner IDs, and retryable failure records. Flush reports every failure within its boundary; unrelated success never acknowledges a failed operation. Keep unsaved content recoverable.

**Regression:** first-fail/second-success remains a failed flush identifying A; successful retry acknowledges only A's error.

### 5. P1 — Payload and owning-index writes are separate optimistic operations

**Traced.** [library save](F:/git/Saga/src/state/loredeck-library-store.js:158), [deletion](F:/git/Saga/src/state/loredeck-library-store.js:185)

Payload and library-index mutations use independent queues and return `ok:true` before becoming durable. Settings cleanup can remove inline data. A successful index plus failed payload can leave a durable dangling pointer; deletion has the inverse partial-failure problem. Masked queue errors weaken caller detection further.

**Fix:** distinguish `queued` from `persisted`. Commit payload/assets → verify → owning index → old-data compaction, with transaction/outbox records that survive reload. Tombstone/remove the owning record before physical garbage collection.

**Regression:** fail each boundary and restart from persisted files only: retain a complete old or new version, with no acknowledged record lacking a recoverable payload.

### 6. P1 — Checkpoint failure replays an already committed unit

**Reproduced.** [commit/checkpoint](F:/git/Saga/src/generation/generation-job-runner.js:419), [retry catch](F:/git/Saga/src/generation/generation-job-runner.js:445), [Deck checkpoint adapter](F:/git/Saga/src/loredecks/loredeck-creator-generation-runner.js:100)

Commit and completion checkpoint share one retry block. A checkpoint exception after a successful commit reruns the provider and commit. The fixture returned `complete` after **two calls and two commits** for one unit. The Deck adapter also ignores returned `{ok:false}` checkpoint results.

**Fix:** separate request/parse/commit/checkpoint phases. Use an idempotency key based on job/run/unit/input. After commit, retry only the checkpoint and retain the committed result/reference for reconciliation. Validate adapter results.

**Regression:** completion checkpoint fails after commit: exactly one provider call/logical commit, recoverable pending checkpoint. Test returned failure and thrown failure.

### 7. P1 — Slow Context loading overwrites the current stack's cache

**Reproduced.** [context-index.js](F:/git/Saga/src/context/context-index.js:409)

Loads share mutable signature/promise/cache fields. Completion publishes unconditionally and `finally` clears the shared promise without ownership checks. Start A, finish B, then finish A: the signature identifies B while cached data is A. The fixture observed `initialB:['b']`, then `cachedB:['a']`. Invalidation also leaves old loads able to publish.

**Fix:** bind publication and cleanup to an immutable signature plus monotonic request token. Store result/signature together or cache by signature. Invalidation revokes publication rights for prior requests.

**Regression:** both completion orders, invalidation in flight, and forced refresh for the same signature; stale work cannot overwrite or clear newer work.

### 8. P1 — Missing timeline boundaries and unset positions pass gates

**Reproduced.** [position conversion](F:/git/Saga/src/context/context-gating.js:123), [window evaluation](F:/git/Saga/src/context/context-gating.js:178), [strict injection caller](F:/git/Saga/src/lorecards/lore-injection-filter.js:26)

Even with `unresolvedEligible:false`, a missing `validFromAnchor` passes when Context has a numeric position: unresolved bounds remain null and never reject. Separately, `Number(null)` turns unset `contextSortKey` into zero, making lore valid through position 10 eligible with no comparable selected position. Both fixtures returned `match`/`eligible:true`, bypassing callers' strict unresolved handling.

**Fix:** test numeric presence before coercion. Unresolvable required bounds return `unresolved`; validate malformed/reversed ranges and fail closed at final injection.

**Regression:** deleted/missing anchors, unavailable index, null/undefined/empty/nonnumeric positions, unresolved one-sided ranges, and legitimate zero; assert final prompt output too.

### 9. P1 — Substring matching confuses distinct media identifiers

**Reproduced.** [context-gating.js](F:/git/Saga/src/context/context-gating.js:214)

Containment in either direction makes season `1` match `10`, or episode `2` match `12`. Season 1 versus 10 returned `match`/`eligible:true`. Phase, chapter, issue, and other media fields share this helper.

**Fix:** canonicalize identifiers by field and compare exactly. Represent human-readable aliases explicitly; allow token-aware matching only where the field contract permits it.

**Regression:** 1/10, 2/12, Phase 1/10, leading zeros, and supported display aliases through retrieval and injection.

### 10. P2 — Supported state imports skip version migrations

**Reproduced.** [importState](F:/git/Saga/src/state/state-manager.js:943), [v25 migration](F:/git/Saga/src/state/state-manager.js:697), [supported import versions](F:/git/Saga/src/state/import-export.js:10)

Import merges defaults and stamps `_version` to the current schema before `migrateState()`. Supported older versions skip version-gated transforms. A v24 manual Auto-Relevance lock imported successfully with no `loreAutomation` conversion; direct migration produced `enabled:false`, `disabledReason:'legacy_manual_relevance'`. Automation eligibility can lose the user's manual lock.

**Fix:** preserve source version through ordered migration, normalize afterward, and stamp current only after successful migration. Keep unsupported old/future schema rejection explicit.

**Regression:** each supported version agrees with direct migration on semantic fields, including manual opt-outs, Context, cadence, and workspace defaults.

### 11. P2 — Chat saves do not expose asynchronous persistence failure

**Traced.** [saveState](F:/git/Saga/src/state/state-manager.js:392), [restore callers](F:/git/Saga/src/state/state-manager.js:1145)

`saveState()` updates live metadata but neither returns nor awaits `saveMetadata()`. If the host rejects asynchronously, callers cannot catch failure; restore/backup flows can report success and prompt sync proceeds. This is a failure-handling gap, not a claim that every host save returns a Promise.

**Fix:** an explicit awaited persistence boundary with operation IDs, failure propagation, and chat identity. Separate optimistic mutation from durable acknowledgement; preserve unsaved state for retry.

**Regression:** synchronous throw, rejected Promise, absent save API, and chat switch during save; restore never reports durable success after rejection.

### 12. P2 — Retry policy repeats permanent failures without rate-limit delay

**Reproduced and traced.** [retry policy](F:/git/Saga/src/generation/generation-job-runner.js:320), [immediate retry](F:/git/Saga/src/generation/generation-job-runner.js:460)

Every non-abort exception defaults to retryable. Deck Maker supplies no narrowing policy. A fixture with two retries made **three calls for HTTP 401**. Contract/schema errors and commit failures use the same policy; 429 receives no runner-level delay.

**Fix:** classify by phase and stable code. Retry transient transport/server/rate-limit errors with capped delay/jitter and supported retry hints. Stop auth/config errors; keep parse repair separate; retry commits only with proven idempotency.

**Regression:** 401/config calls once; 429 waits; abort interrupts the wait; exhausted retries retain output and diagnostics.

### 13. P2 — Host cancellation does not reach requests; streams are unbounded

**Traced; ignored-signal timeout fixture exercised during generation review.** [ST raw adapter](F:/git/Saga/src/providers/lore-llm-client.js:763), [profile adapter](F:/git/Saga/src/providers/lore-llm-client.js:878), [Story timeout](F:/git/Saga/src/story-openers/story-opener-generation.js:105), [stream reader](F:/git/Saga/src/providers/lore-llm-client.js:520)

ST raw/quiet and profile adapters check cancellation before starting but omit the signal from the underlying call. Story Maker can time out its outer wait and retry while preceding work remains active. Deck Maker has no equivalent total request deadline. Direct-endpoint streaming appends buffers until EOF without enforced output-size or idle limits; provider `max_tokens` is not a client-side bound.

**Fix:** one adapter contract for cancellation capability, total/idle deadlines, and bounded output. Pass signals where the host supports them. Serialize uncancellable routes and quarantine late completions before replacements. Cancel/release readers after failure, overflow, and abort.

**Regression:** never-resolving host calls, late responses after cancel, slow/oversized/malformed SSE, and profile cancellation; assert no late commits and bounded active requests/memory.

### 14. P2 — Recovery reports success after a refused state update

**Reproduced during generation review.** [generation recovery](F:/git/Saga/src/loredecks/loredeck-creator-generation-recovery.js:125)

Recovery ignores `update.ok` when clearing controllers/live state and returns `recovered:true` using a local patched job after failed persistence. A fixture returning `{ok:false,error:'disk full'}` still reported recovery and cleared runtime evidence. Reload can reveal the old running job.

**Fix:** require acknowledged recovery before success/metadata cleanup. Return a distinct retryable pending/failed status and retain reconciliation evidence. Separate cancelling a controller from destroying its recovery metadata.

**Regression:** refused, throwing, and asynchronously failed updates followed by reload/retry; saved batches remain and status is truthful.

### 15. P2 — Automation overlaps; enable/disable resources are asymmetric

**Traced.** [event dispatch](F:/git/Saga/src/extension/events.js:29), [global guard](F:/git/Saga/src/continuity/extractor.js:66), [event registration](F:/git/Saga/src/extension/events.js:82), [tool handler](F:/git/Saga/src/extension/saga-tool-registry.js:97), [enable](F:/git/Saga/src/extension/lifecycle.js:79), [bridge removal](F:/git/Saga/src/extension/global-bridge.js:65)

Generation-ended dispatch launches automation without awaiting a serialized boundary and syncs prompts immediately. A second event can overlap; the global extraction guard drops its continuity work instead of coalescing the latest turn. Other automation continues independently.

Disable removes bridge/interceptor but retains subscriptions and tools. The proposal tool lacks an invocation-time enabled check. Enable restores the interceptor but not removed bridge/actions; UI refresh through that bridge can remain a no-op. These are code-path findings; host hot-toggle behavior needs integration coverage.

**Fix:** a per-chat automation queue with latest-turn coalescing and cancellation on switch/disable; sync prompts after commits. Use one resource owner for symmetric event/tool/timer/global registration and disposal. Guard mutation-tool invocation and support replacement host managers without stale registration state.

**Regression:** rapid events around a deferred scan; switch; disable → enable; replace tool manager. No dropped latest turn, disabled mutation, missing bridge, or duplicate listener.

### 16. P2 — ZIP expansion budgets are checked after allocation

**Reproduced.** [inflation](F:/git/Saga/src/loredecks/loredeck-package-zip.js:198), [declared-size check](F:/git/Saga/src/loredecks/loredeck-package-zip.js:284), [actual-size check](F:/git/Saga/src/loredecks/loredeck-package-zip.js:341)

Declared sizes are checked before decompression, but actual output is fully materialized before length verification. An understated size can exhaust browser memory before rejection. The small fixture declared one byte with a 16-byte budget; **65,536 bytes inflated** before rejection. This proves delayed enforcement, not acceptance or script execution.

**Fix:** count actual bytes while reading; cancel at per-file/cumulative limits. Check Blob/File input size before materialization where possible. Retain existing path, active-type, symlink, encryption, and CRC checks.

**Regression:** understated sizes, over-budget expansion, malformed headers, large File input, and cumulative exhaustion; reading stops before allocating complete expanded output.

### 17. P2 — Completed Story variants lack individual durable checkpoints

**Traced.** [variant fan-out](F:/git/Saga/src/story-openers/story-opener-generation.js:1075), [UI persistence](F:/git/Saga/src/runtime/story-opener-panel.js:1025)

Variants launch together and return after `Promise.allSettled`. The UI saves afterward. A completed sibling remains in memory while another is slow; reload/crash loses completed work. Fan-out competes for host generation slots and compounds retry pressure.

**Fix:** provider-aware concurrency; persist each validated variant on completion; resume by stable unit identity without regenerating saved siblings.

**Regression:** finish one variant, defer another, reopen from storage; retain success. Check maximum concurrency and cancellation.

## Verification and architecture improvements

### A. Put runtime behavioral checks in CI and the release gate

**Improvement, with a concrete coverage gap.** [workflow](F:/git/Saga/.github/workflows/loredeck-builder-build-check.yml:4), [gate list](F:/git/Saga/tools/scripts/run-alpha-gate.mjs:109)

Only Loredeck Builder workflows exist. Their path filters omit core runtime, state/storage, providers, continuity, and most Context changes; the job runs a small CLI/package subset. Passing remote checks do not establish extension reliability.

The manually enumerated alpha gate omitted Year 6 progression, generation job runner, several recovery/repair tests, and other core integration fixtures at broad-run time. Concurrent planning work added two entries during review, illustrating list drift. The Year 6 failure is a fixture issue, but still invisible to the gate.

**Change:** automatic discovery within explicit categories and an auditable exclusion list. Run fast state/storage/gating/job contracts on relevant PRs; full core integration, package round-trips, and browser failure/lifecycle smoke for release. Pin supported Node versions; exercise Windows and Linux; make archive-tool requirements explicit.

### B. Replace source assertions with behavior at failure boundaries

**Improvement.** [prompt contracts](F:/git/Saga/tools/scripts/test-prompt-injection-stale-state.mjs:61), [visual source assertions](F:/git/Saga/tools/scripts/test-visual-smoke-harness.mjs:911)

A scan found 46 test scripts combining file reads and text assertions—a heuristic signal, not a coverage percentage. Presence of expected code or UI strings cannot prove async ownership, teardown, or durable acknowledgement. Existing tests pass despite the reproduced failure modes.

**Change:** retain limited source-ownership/forbidden-pattern guards. Test deferred requests, rejected writes, corrupt/missing files, out-of-order loads, DOM lifecycle, and restart from persisted state. Assert final prompt eligibility, not just helper return values.

### C. Decompose the control plane after stabilizing its contracts

**Improvement.** [lore-panel.js](F:/git/Saga/src/runtime/lore-panel.js), [composition](F:/git/Saga/src/runtime/runtime-composition.js:18)

Measured during review, `lore-panel.js` was approximately 12,536 lines with 110 imports; Lorecards and Library panels were approximately 6,482 and 6,005 lines. Sizes are maintenance signals, not proof of bugs. Central runtime composition still connects unrelated mutations, model actions, dialogs, caches, and refresh paths. Optional dependency calls can make missing configuration resemble intentionally unavailable features.

**Change:** preserve the public facade and extract vertical owners for Creator, Lorecards, Library/package workflow, and Context. Validate required dependencies at construction; explicitly model optional host capabilities. Views should not decide durable-save success. Give each feature a disposer and refresh/error boundary; continue existing composition modules.

**Exit:** feature logic is testable without importing the central controller; missing required dependencies fail clearly; rendering failure does not prevent current-chat prompt synchronization. Current `handleChatChanged` places refresh and prompt sync in the same try, so a renderer exception skips rebuilding the prompt.

### D. Make settings externalization support explicit

**Upgrade-policy risk; not classified as a supported migration bug.** [compaction](F:/git/Saga/src/state/settings-store.js:100), [hydration](F:/git/Saga/src/extension/bootstrap.js:31)

Normalization replaces old inline Library/Creator/theme/icon registries with empty externalized registries. Bootstrap loads external files without migrating those inline payloads. Current tests intentionally require compact settings, and development docs permit pre-alpha compatibility breaks, so this needs a support decision.

If those installations are supported, back up/export and transactionally migrate before compaction. If unsupported, document the boundary and provide a detectable recovery/export path. Test the chosen policy so supported content cannot disappear silently.

## Test failures and review limits

1. **Year 6 progression fixture:** [test setup](F:/git/Saga/tools/scripts/test-core-integration-hp-year6-progression.mjs:376) clears elevation and forces a protected Ron-poisoning card to `low` after acceptance disabled its automation. The scorer intentionally excludes disabled cards. Independent local scoring produced `high`, score 112; this failure does not establish a scoring regression. Explicitly enable automation when seeding this scenario or use a non-protected card, retaining protected-card opt-out tests.
2. **Plugin bundle tooling:** [build-skill-file.mjs](F:/git/Saga/plugins/loredeck-builder/scripts/build-skill-file.mjs:66) requires `zip` or `python3`; neither usable executable was available here. This is an environment/tooling failure. Preflight requirements, surface child-process errors clearly, or use portable archiving. No dependencies were installed.
3. The first sandboxed alpha-gate attempt stopped at a CLI test because Node child-process spawning returned `EPERM`. The broader run used approved execution outside that sandbox; its failures above are separate.
4. No live SillyTavern UI/provider run, server storage fault injection, or browser-memory stress test was performed. Host cancellation/unregistration and server conditional-write/atomicity capabilities need verification against supported host versions. Client read-then-write revision checks alone cannot prove cross-tab atomicity.

## Recommended sequence

| Order | Work | Acceptance criterion |
| --- | --- | --- |
| 1 | Behavioral failure fixtures in CI; correct stale progression setup; explicit archive tooling. | Fixtures run consistently and cannot be excluded accidentally. |
| 2 | Bind jobs to chats; serialize/coalesce automation; symmetric lifecycle. | Switch/disable blocks late commits; enable restores exactly one complete set of resources. |
| 3 | Safe rollback; shared index coordinator; per-operation outcomes; ordered content/index commit. | Faults plus reload preserve previous content, expose every failed operation, and leave no acknowledged dangling record. |
| 4 | Separate commit/checkpoint; idempotency; honest recovery and adapter error propagation. | Committed units never replay; failed checkpoints are recoverable and never reported durably complete. |
| 5 | Context cache ownership, strict boundary/number/identifier handling, supported-import migration. | Out-of-order loads retain ownership; unresolved/future lore never reaches prompts; imports preserve manual constraints. |
| 6 | Provider/output/archive budgets; per-variant persistence. | Late work cannot mutate state; actual resource limits hold; successful variants survive reload. |
| 7 | Extract feature owners and dependency contracts behind these tests. | Smaller modules preserve the invariants and can be tested without the central controller. |

Start with small boundary fixes that prevent corruption and lost work. A rewrite or language migration is not required to deliver these gains.

## Local evidence artifacts

- [Test results](F:/git/Saga/.tmp/reliability-review-tests.json) and [full output](F:/git/Saga/.tmp/reliability-review-tests.log).
- [All-source syntax results](F:/git/Saga/.tmp/reliability-review-syntax-all.json).
- [Context/generation/import fixtures](F:/git/Saga/.tmp/reliability-review-reproductions.mjs) and [observations](F:/git/Saga/.tmp/reliability-review-reproductions.out).
- [Storage fixtures](F:/git/Saga/.tmp/reliability-storage-review.mjs) and [observations](F:/git/Saga/.tmp/reliability-storage-review.out).

Run the harnesses from the repository root:

```powershell
node .tmp/reliability-review-reproductions.mjs
node .tmp/reliability-storage-review.mjs
```

They use small in-memory fixtures and do not call live providers or write live user storage. `.tmp` artifacts are ignored by Git; this report is the durable review deliverable.
