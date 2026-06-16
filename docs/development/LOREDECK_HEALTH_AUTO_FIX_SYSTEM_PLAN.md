# Loredeck Health Auto-Fix System Plan

Status: Split-stage planning. The original single health auto-fix plan is now divided into a safe parallel Stage 1 plan and a storage-dependent Stage 2 plan.

This split exists because `SAGA_STORAGE_REWORK_DESIGN.md` is moving Saga-owned Lorepacks, Deck Maker projects, and repair state out of `settings.json` and into external `/user/files` payloads. Health auto-fix work can start now, but only where it stays storage-neutral.

## Stage Documents

- [Stage 1: Parallel Foundation](LOREDECK_HEALTH_AUTO_FIX_STAGE_1_PARALLEL_PLAN.md)
  - Can begin now while the storage rework is in progress.
  - Builds pure repair planning, local repair patch builders, validation contracts, model prompt/parser contracts, and in-memory tests.
  - Does not write to settings, pack payload files, storage indexes, repair sessions, Health Center UI, or Creator UI.

- [Stage 2: Storage Integration](LOREDECK_HEALTH_AUTO_FIX_STAGE_2_STORAGE_INTEGRATION_PLAN.md)
  - Begins only after the storage service and external Lorepack payload APIs are stable.
  - Wires `Attempt Fixing` into real Pack Health, external pack payload writes, repair session files, Health Center UI, Creator final readiness, and provider-backed model repair batches.

## Product Target

Replace the current fragmented Pack Health repair surface with one guided workflow:

- Primary action: `Attempt Fixing`
- Secondary action: `Review Choices`, shown only when unresolved fixes require a user decision
- Triage action: `Accept As-Is`, for intentionally accepted non-blocking findings
- Verification action: `Verify Fixed`, which reruns Pack Health instead of storing a user-only fixed marker

`Attempt Fixing` should eventually:

1. Run or refresh Pack Health.
2. Build an issue-aware repair plan.
3. Apply known deterministic fixes locally.
4. Rerun Pack Health.
5. For remaining eligible findings, call the reasoning model in bounded batches.
6. Directly apply model fixes only when they pass strict local validation and have one clear repair path.
7. Create `Needs Review` choices only when there are multiple plausible fixes, risky semantic edits, or low-confidence model output.
8. Rerun Pack Health again and show before/after results.

## Shared Concepts

### Repair Finding

A normalized finding is one health issue plus stable affected-data references:

```json
{
  "findingId": "health_abc123",
  "severity": "error",
  "code": "schema_v3_legacy_timing_fields",
  "entryIds": ["nami-secret-buyback-bargain"],
  "tagIds": [],
  "timelineIds": [],
  "file": "__saga_embedded_entries__",
  "message": "Schema v3 entry still has legacy timing fields."
}
```

### Repair Bucket

A bucket groups findings that can be repaired with the same strategy:

```json
{
  "bucketId": "schema_v3_legacy_timing_fields:entries",
  "strategy": "local_bulk",
  "code": "schema_v3_legacy_timing_fields",
  "severity": "error",
  "affectedEntryIds": ["..."],
  "findingIds": ["..."],
  "estimatedUnits": 1
}
```

### Repair Strategies

- `local_bulk`: deterministic transform that can apply to many records at once.
- `local_review_choice`: deterministic candidates exist, but Saga needs a user choice.
- `model_direct`: reasoner can produce a constrained patch that Saga may apply automatically if validation passes.
- `model_review_choice`: reasoner must propose choices because the fix is ambiguous or semantically risky.
- `manual_only`: unsupported or requires source knowledge not present in the deck.

## Direct-Apply Safety Rules

A repair patch may be applied without user review only when all of these are true:

- It targets only findings included in the repair unit.
- It touches only allowed fields for the issue code.
- If it came from a model response, its full payload diff touches only the declared allowed fields.
- It does not create new entry IDs, tag IDs, or timeline IDs unless the strategy explicitly allows that code.
- It does not delete entries unless the issue code is specifically about duplicate or invalid entries and the user confirmed destructive repair.
- It preserves schema version and passes schema-specific validation.
- It preserves namespaced tag syntax and validates against the registry or adds a matching registry definition.
- It validates Context anchors and windows against the active timeline registry.
- It reduces or preserves Pack Health error count for the targeted findings.
- It does not increase total Pack Health error count.
- It records an audit summary in repair history.

If any rule fails, Saga should not apply the patch directly. It should retry a smaller model batch, convert the result into a `Needs Review` choice, or mark the finding unresolved.

## Storage Boundary

Until `SAGA_STORAGE_REWORK_DESIGN.md` reaches stable Lorepack payload APIs, Stage 1 must not touch:

- `settings-store.js`
- `state-manager.js`
- `loredeck-library-store.js`
- `lore-creator-store.js`
- external storage files or indexes
- pack payload persistence
- repair session persistence
- Health Center UI wiring
- Creator final-card UI wiring

Stage 1 should produce pure modules and tests that Stage 2 can call through storage adapters later.

## How To Use These Plans

While storage work is active, feed the LLM:

1. This umbrella plan.
2. [Stage 1: Parallel Foundation](LOREDECK_HEALTH_AUTO_FIX_STAGE_1_PARALLEL_PLAN.md).
3. [Saga Storage Rework Design](SAGA_STORAGE_REWORK_DESIGN.md) for boundaries only.

After storage is stable, feed the LLM:

1. This umbrella plan.
2. [Stage 1: Parallel Foundation](LOREDECK_HEALTH_AUTO_FIX_STAGE_1_PARALLEL_PLAN.md), including completed deliverables.
3. [Stage 2: Storage Integration](LOREDECK_HEALTH_AUTO_FIX_STAGE_2_STORAGE_INTEGRATION_PLAN.md).
4. [Saga Storage Rework Design](SAGA_STORAGE_REWORK_DESIGN.md), especially the Pack Health and repair integration section.

The Stage 2 implementer should reuse Stage 1 modules instead of re-solving planner, repair, prompt, and validation logic.
