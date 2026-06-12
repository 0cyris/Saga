# Loredeck Creator Reset To Step Plan

Status: Implemented in first pass. Keep this feature destructive, simple, and local to the active Creator project.

## Purpose

Loredeck Creator is an eight-step staged workflow. Users can discover late that an earlier decision was wrong, but the current workflow makes it awkward to return to an earlier step without manually deleting downstream generated data.

Add a small `Reset to this step` control to completed step cards in the Creator top bar. The control destructively clears all Creator data after the selected step and sends the project back to that stage.

This is not undo, history, restore, or checkpointing. It is a forward-data wipe with a clear warning.

## Implementation Record

The first implementation keeps the feature split across three small surfaces:

- Reset rules and warning copy live in `src/loredecks/loredeck-creator-reset.js`.
- The top-bar affordance lives in `src/loredecks/loredeck-creator-panel.js` and `styles/runtime.css`.
- Runtime persistence, generated-pack cleanup, confirmation, cache clearing, and workbench refresh live in `src/runtime/lore-panel.js`.

The confirmation dialog now accepts custom button labels/tooltips through `src/ui/runtime-ui-kit.js`, which lets this feature show `Reset to <step>` without introducing a reset-specific modal.

Current regression coverage:

- `tools/scripts/test-loredeck-creator-reset.mjs`
- `tools/scripts/test-loredeck-creator-stage-reset-ui.mjs`
- `tools/scripts/test-runtime-ui-confirm-dialog.mjs`
- `tools/scripts/test-visual-smoke-harness.mjs`
- `tools/scripts/run-alpha-gate.mjs`

## Goals

- Let users return to an earlier Creator step without deleting the whole project.
- Keep the selected step and all earlier steps intact.
- Delete all data owned by later steps.
- Use a small back-arrow or rollback icon in the upper-right corner of eligible step cards.
- Warn clearly before deleting anything.
- Keep the implementation predictable enough to maintain in pre-alpha.

## Non-Goals

- Do not add undo state.
- Do not add checkpoint restoration.
- Do not create a generic reset-plan system.
- Do not support reset to `Finalize`; it is the last step, so there is no downstream Creator data to clear.
- Do not delete unrelated Loredeck Library packs, external exports, or non-Creator user content.
- Do not preserve stale downstream state just because it was expensive to generate.

## User Model

The action is named:

```text
Reset to this step
```

Meaning:

- Keep the target step's current data.
- Keep all earlier step data.
- Permanently erase Creator data from every later step.
- Return the workflow to the selected step.

Examples:

- Reset to `Title Pass`: keep Scope Brief, Story Outline, and Title Pass; clear Context Plan, Lorecards, Review Queue, Pack Health, and finalization state.
- Reset to `Context Plan`: keep Scope Brief, Story Outline, Title Pass, and Context Plan; clear Lorecards, Review Queue, Pack Health, and finalization state.
- Reset to `Lorecards`: keep drafted Lorecard review data if it is the target step; clear Pending Review, accepted Generated Lorecards, Pack Health, and finalization state.

If users need to delete the target step itself, that should be a separate in-section action such as `Clear and redo this step`.

## UI

Add a small icon button inside each eligible step card in the Creator top bar.

Placement:

- Upper-right corner of the step card.
- Do not put the button inside the numbered status circle.

Icon:

- Prefer a compact rollback/back-arrow icon.
- If using Lucide, `Undo2`, `RotateCcw`, or a similar rollback glyph is acceptable.

Tooltip:

```text
Reset to this step
```

Visibility:

- Hidden or very low opacity until hover/focus on desktop.
- Keyboard focusable.
- Visible or moved into a compact step menu on touch/mobile.
- Disabled while a Creator generation job is running.
- Hidden on locked future steps.
- Hidden on `Finalize`.

Visual tone:

- Muted by default.
- Danger tone on hover/focus.
- The button should read as a destructive affordance only once inspected, not as the dominant step-card action.

## Confirmation

Use a normal destructive confirmation modal. Do not require typed confirmation for the first version.

Title pattern:

```text
Reset to Title Pass?
```

Body pattern:

```text
This will permanently erase all Creator data after Title Pass, including Context Plan, Lorecards, Review Queue, Pack Health, and Finalize progress. This cannot be undone.
```

Buttons:

```text
Cancel
Reset to Title Pass
```

The warning should name the exact target step and list the later step labels that will be cleared. Counting individual artifacts is optional and not required for the first implementation.

## Stage Map

Use a small hardcoded stage list that matches the top bar.

```js
const LOREDECK_CREATOR_RESET_STEPS = [
  { id: 'scope', label: 'Scope Brief' },
  { id: 'outline', label: 'Story Outline' },
  { id: 'titles', label: 'Title Pass' },
  { id: 'context', label: 'Context Plan' },
  { id: 'lorecards', label: 'Lorecards' },
  { id: 'review', label: 'Review Queue' },
  { id: 'health', label: 'Pack Health' },
  { id: 'finalize', label: 'Finalize' },
];
```

Reset is available for steps `scope` through `health`.

Downstream steps are computed by index:

```js
function getCreatorResetForwardSteps(targetStepId) {
  const index = LOREDECK_CREATOR_RESET_STEPS.findIndex(step => step.id === targetStepId);
  return index >= 0 ? LOREDECK_CREATOR_RESET_STEPS.slice(index + 1) : [];
}
```

## Clearing Rules

The implementation should use direct stage-owned clearing rules, not a history system.

### Reset To Scope Brief

Keep:

- Creator intake fields.
- Scope Brief.
- Scope Brief approval.

Clear:

- Story Outline.
- Title drafts and title approvals.
- Context planning.
- Generated Lorepack shell and generated-pack link.
- Creator Lorecard drafts.
- Pending Review items owned by Creator.
- Accepted Generated Lorecards owned by Creator.
- Pack Health and finalization state.

### Reset To Story Outline

Keep:

- Scope Brief.
- Story Outline.
- Story Outline approval.

Clear:

- Title drafts and title approvals.
- Context planning.
- Generated Lorepack shell and generated-pack link.
- Creator Lorecard drafts.
- Pending Review items owned by Creator.
- Accepted Generated Lorecards owned by Creator.
- Pack Health and finalization state.

### Reset To Title Pass

Keep:

- Scope Brief.
- Story Outline.
- Title drafts.
- Title selections and approvals.

Clear:

- Context planning.
- Generated Lorepack planning registries.
- Creator Lorecard drafts.
- Pending Review items owned by Creator.
- Accepted Generated Lorecards owned by Creator.
- Pack Health and finalization state.

### Reset To Context Plan

Keep:

- Scope Brief.
- Story Outline.
- Title Pass.
- Accepted Context Plan data.

Clear:

- Creator Lorecard drafts.
- Pending Review Lorecards owned by Creator.
- Accepted Generated Lorecards owned by Creator.
- Pack Health and finalization state.

### Reset To Lorecards

Keep:

- Scope Brief.
- Story Outline.
- Title Pass.
- Context Plan.
- Creator Lorecard draft-review items.

Clear:

- Pending Review items owned by Creator.
- Accepted Generated Lorecards owned by Creator.
- Pack Health and finalization state.

### Reset To Review Queue

Keep:

- Scope Brief.
- Story Outline.
- Title Pass.
- Context Plan.
- Lorecard draft state.
- Pending Review state.
- Accepted Generated Lorecards owned by Creator.

Clear:

- Pack Health and finalization state.

### Reset To Pack Health

Keep:

- Scope Brief.
- Story Outline.
- Title Pass.
- Context Plan.
- Lorecards.
- Review Queue.
- Accepted Generated Lorecards owned by Creator.
- Latest Pack Health state if it belongs to the target step.

Clear:

- Finalization state.

### Reset To Finalize

Not supported in the top bar.

## Data Boundaries

Clear only data tied to the active Creator project and its Generated Lorepack.

Creator-owned data can be identified with existing provenance:

- Active Creator job id.
- `generatedPackId`.
- Generated pack type/source metadata.
- Pending changes with `source: 'loredeck_creator'`.
- Entries with `extensions.sagaLoredeckCreator`.
- Draft-review changes with `source: 'loredeck_creator'`.

Do not delete:

- Unrelated Custom Lorepacks.
- Bundled Lorepack records.
- External `.saga-loredeck.zip` exports.
- User-created Library packs that only happen to share a fandom or title.
- Manual user edits that are not attached to the active Creator Generated Lorepack.

## Implementation Notes

Add one reset handler in runtime code:

```js
async function handleLoredeckCreatorResetToStep(targetStepId) {
  const cached = getLoredeckCreatorBriefCache();
  if (cached.activeGeneration) {
    toast('Wait for the current Creator generation to finish or cancel it before resetting.', 'warning');
    return;
  }

  const availability = getLoredeckCreatorResetAvailability(cached, targetStepId, creatorPack);
  if (!availability.available) return;

  const confirmed = await confirmAction(
    `Reset to ${getCreatorResetStepLabel(targetStepId)}?`,
    buildLoredeckCreatorResetWarning(targetStepId),
    {
      confirmLabel: `Reset to ${getCreatorResetStepLabel(targetStepId)}`,
      confirmTooltip: `Permanently erase later Creator data and return to ${getCreatorResetStepLabel(targetStepId)}.`
    }
  );
  if (!confirmed) return;

  resetLoredeckCreatorJobAfterStep(cached, targetStepId);
  resetGeneratedLoredeckPackAfterStep(creatorPack, targetStepId);
  refreshLoredeckCreatorWorkbenchBody({ preserveScroll: false });
}
```

The actual mutator should update both persistence surfaces that currently matter:

- `settings.loredeckCreatorProjects`
- the chat-local Creator mirror in state/chat metadata

When a Generated Lorepack exists, update or remove the generated pack record through the same library-store path used by existing Generated Lorepack cleanup so the global Library record and chat-local mirror stay in sync.

## Suggested Field Ownership

Field ownership can be refined during implementation, but the first version should start with this practical mapping.

Creator job fields:

- Scope: `brief`, `approved`, `approvedAt`, intake fields, project settings.
- Outline: `outline`, `outlineApproved`, `outlineDraftedAt`, `outlineApprovedAt`, `outlineSummary`.
- Title Pass: `titleDrafts`, `selectedTitleDraftIds`, `approvedTitleDraftIds`, `titleBatchDraftedIds`, `titleBatch`, `titlePassSummary`, `approvedTitleDraftAt`, `titleDraftedAt`.
- Context Plan: `planningBatchQueuedIds`, `planningBatchAcceptedIds`, `planningCurrentBatchId`, `planningCurrentBatchLabel`, `planningQueuedCount`, `planningQueuedAt`, `planningAcceptedAt`, `planningSummary`.
- Lorecards: `draftChanges`, `entryDraftSummary`, `entryDraftQuestions`, `entryDraftWarnings`, `entryDraftCount`, `entryDraftLastBatchCount`, `entryDraftLastTargetCount`, `entryDraftRemainingCount`, `entryDraftBatchSize`, `entryDraftCurrentBatchId`, `entryDraftCurrentBatchLabel`, `entryDraftedAt`.
- Generation bookkeeping: clear generation runs/units whose stage is later than the reset target.
- Finalization: clear generated-to-custom finalize markers or references if present.

Generated pack fields:

- Context Plan: Creator-owned `timelineRegistry` and `tagRegistry` data from planning.
- Review Queue: Creator-owned `pendingChanges`.
- Accepted Generated Lorecards: Creator-owned `entryOverrides`.
- Pack Health: cached health/validation state for the Generated Lorepack.
- Finalize: derived Custom Lorepack linkage, finalize acknowledgement, and export/finalization metadata.

## Eligibility

Show the reset icon when all are true:

- The step is not `Finalize`.
- The step is not locked/future.
- At least one later step has materialized Creator data.
- No Creator generation is currently running.

If generation is running, either hide the button or show it disabled with a tooltip:

```text
Cancel or finish the current Creator generation before resetting.
```

## Acceptance Criteria

- Completed step cards 1-7 show a `Reset to this step` affordance only when downstream data exists.
- Clicking the affordance opens a destructive confirmation with the target step and cleared later step names.
- Confirming reset clears all Creator-owned data after the target step.
- Confirming reset returns the Creator workbench to the target step.
- Reset refuses to run while generation is active.
- Reset to `Finalize` is not available.
- Generated pack records and Creator jobs do not drift between settings and chat-local mirrors.
- Manual, unrelated Library data is not removed.
- The UI refreshes without stale badges, stale Draft Review rows, stale Pending Review rows, or stale Pack Health readiness.

## Test Coverage

Add focused tests for:

- Stage-list downstream-step calculation.
- Reset to each supported step clears expected job fields.
- Reset to `Title Pass` clears planning, lorecards, review, health, and finalization while preserving approved titles.
- Reset to `Context Plan` preserves accepted planning and clears lorecard/review/finalize state.
- Reset to `Lorecards` preserves draft-review rows and clears Pending Review/accepted generated entries.
- Reset blocks while `activeGeneration` is running.
- Generated pack cleanup updates both settings and chat-local mirrors.
- Creator-owned data is cleared without removing unrelated packs or manual non-Creator data.

## Implementation Slices

1. Add the stage map, warning copy builder, and reset eligibility helper.
2. Add the reset icon to step cards in the Creator top bar.
3. Add the destructive confirmation and runtime reset handler.
4. Implement Creator job clearing rules.
5. Implement Generated Lorepack clearing rules using existing library-store persistence paths.
6. Add regression tests for each supported reset target.
7. Run a visual smoke pass for the Creator top bar, confirmation modal, and post-reset stage state.

## Validation

Run the full pre-alpha gate after any reset-rule or persistence change:

```powershell
node tools\scripts\run-alpha-gate.mjs
```

For faster local iteration, run the focused reset checks:

```powershell
node tools\scripts\test-loredeck-creator-reset.mjs
node tools\scripts\test-loredeck-creator-stage-reset-ui.mjs
node tools\scripts\test-runtime-ui-confirm-dialog.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

For a rendered browser pass against the repo-local harness:

```powershell
$env:SAGA_SMOKE_TARGET='creator-harness'
node tools\scripts\smoke-live-st-cdp.mjs
```

This opens the seeded in-progress Creator project, captures the reset controls, clicks `Reset to Title Pass`, verifies the destructive confirmation copy, and cancels without resetting the fixture.
