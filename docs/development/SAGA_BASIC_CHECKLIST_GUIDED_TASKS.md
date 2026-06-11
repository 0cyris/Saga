# Saga Basic Checklist Guided Tasks

This development note defines a focused first-run feature update for Basic Experience: the Start Checklist should remain the user's home base, while each checklist action can launch a small guided task that helps the user complete the immediate setup step and return.

## Problem

The Basic Start Checklist is a strong first-run guidepost, but its current action buttons behave like simple navigation links. When a new user clicks a setup action such as **Open Library**, **Set Context**, **Review Lorecards**, or **Configure Provider**, Saga switches tabs and the user loses the checklist context.

That is especially costly during the first visit, when the user is still learning:

- why Saga sent them to the new tab;
- which control they should click next;
- how to tell whether the setup step is complete;
- how to get back to the checklist.

The feature should solve that first-run recovery problem without turning Basic Experience into a rigid wizard.

## Decision

Use a **checklist-launched guided task mode**.

The Start Checklist remains the persistent readiness dashboard. When the user clicks a checklist action, Saga should navigate to the relevant Basic tab and show a compact guided task strip for that one action.

Example:

```text
Start Checklist > Add Lorepack to Stack
[Back to Start Checklist] [Next] [Dismiss]
```

The guided task may highlight the target control, but it should not replace the existing Basic Walkthrough or become a full modal tour by default.

## Progress To Date

- Implemented the return foundation:
  - runtime panel `guidedTask` state;
  - checklist actions launching focused guided tasks instead of plain tab jumps;
  - Basic destination task strip with **Back to Start Checklist**, **Find Control**, and **Dismiss**;
  - target highlighting using existing `data-saga-tour` anchors;
  - done-state detection from the current Start Checklist readiness row;
  - cleanup when returning to the checklist, dismissing the strip, resetting layout, or switching to Advanced.
- Implemented the guided strip state slice:
  - persisted `active`, `target_missing`, and `done` statuses;
  - live readiness rows remain authoritative, so stale `done` state cannot mask an incomplete setup item;
  - **Open Library** appears only for the Lorepack stack task, where the next target is a concrete marked button;
  - missing targets style the whole strip and show task-specific recovery copy.
- Implemented the target-preparation slice:
  - guided tasks reuse existing walkthrough prepare handlers instead of duplicating fullscreen/section-opening logic;
  - automatic render-time focus only highlights visible targets, while explicit **Find Control** can prepare hidden targets;
  - task metadata carries `expandSections` and `prepare` so reopened panel state remains actionable.
- Implemented the first-run polish slice:
  - each guided task now has task-specific active and done copy;
  - when the Context checklist row first routes to the Library because no Lorepack is loaded, completion is tied to the Loredeck stack row;
  - starting a Basic or Advanced walkthrough clears any active checklist helper so the two guidance modes do not compete.

## Why Not A Full Tour As Primary Setup

A full walkthrough is useful as optional learning material, but it is not the best primary response to checklist actions.

- Full tours are heavier than the user's immediate goal.
- They can become brittle when a target is hidden, collapsed, empty, or inside a fullscreen overlay.
- First-time users often dismiss tours before they finish setup.
- A tour does not automatically solve the "how do I get back to the checklist?" problem after dismissal.

Saga should keep the **Basic Walkthrough** as a module-based learning tool. Checklist actions should launch focused task guidance.

## Why Not Only A Back Button

A simple **Back to Start Checklist** button is necessary but incomplete.

It solves navigation recovery, but it does not answer the first-time user's next question: "What am I supposed to click here?"

The guided task strip should include the back action, but also provide enough local instruction and target highlighting to complete the current checklist item.

## UX Contract

### Start Checklist

- Remains in the Basic Session tab.
- Remains the authoritative readiness summary for first-run setup.
- Continues to derive readiness from the shared `buildBasicReadinessModel()` path.
- Its action buttons launch guided tasks when the target step benefits from local guidance.

### Guided Task Strip

When active, the strip should:

- appear near the top of the destination Basic tab or relevant overlay;
- show the origin and current task, such as `Start Checklist > Set Story Context`;
- provide **Back to Start Checklist**;
- provide **Dismiss**;
- provide **Next** only when there is a concrete next target;
- avoid covering primary controls;
- survive ordinary rerenders while the task is active;
- switch to **Done** when the setup item becomes ready;
- disappear when dismissed or when returning to the checklist.

The strip should be slim. It is navigation scaffolding, not another card-heavy tutorial panel.

### Target Highlighting

Guided tasks may reuse the existing walkthrough target markers and highlight behavior, but the task strip should be independent from full walkthrough sequencing.

Target behavior:

- If the target exists, highlight it and keep the strip visible.
- If the target is hidden in a collapsed section, expand the section when safe.
- If the target is inside a fullscreen surface, open or focus that surface through a preparation action.
- If the target cannot be found, show a useful task-level empty state instead of failing silently.

### Return Behavior

Do not auto-return to the checklist when a step becomes ready. Auto-return can feel surprising and some setup actions do not have a clean completion event.

Instead:

- update the strip state to **Done** when readiness changes;
- keep **Back to Start Checklist** available;
- let the user continue working in the destination tab if they want.

## Initial Guided Tasks

| Checklist item | Action | Destination | Primary guidance |
| --- | --- | --- | --- |
| Saga Active | Enable Saga | Session | Toggle in place; no tab navigation needed. |
| Loredeck in stack | Open Library | Loredecks | Open Loredeck Library, choose a Lorepack, add it to the active stack. |
| Story Context set | Set Context | Context | Use loaded Lorepack Context rows or Browse Context to choose story position. |
| Lorecards reviewed | Review Lorecards | Lorecards | Review pending Lorecards and accept useful entries. |
| Lore ready | Review Lorecards | Lorecards | Confirm accepted Lorecards are selected and relevant. |
| Provider optional | Configure Provider | Settings | Pick Current Model, Connection Profile, or endpoint, then test if needed. |

## Proposed State Shape

Store the guided task state in runtime panel state, not settings.

Recommended shape:

```js
guidedTask: {
    id: 'basic.loredecks.stack',
    source: 'session.basicReadiness',
    sourceTab: 'session',
    targetTab: 'loredecks',
    target: 'loredecks.library.open',
    fallbackTarget: 'loredecks.library.launch',
    expandSections: ['loredecks.libraryLaunch'],
    prepare: 'openLoredeckLibrary',
    statusText: 'Open the Library, then add at least one Lorepack to the active stack.',
    doneText: 'A Lorepack is now in the active stack. Return to the Start Checklist to set Context.',
    nextLabel: 'Open Library',
    nextTarget: 'loredecks.library.open',
    readinessRowId: 'loredecks',
    status: 'active',
    startedAt: 0,
}
```

This is ephemeral UI state. It should not require migration scaffolding in pre-alpha; update the default state in place.

## Implementation Plan

### Phase 1: Return Foundation

- Extend checklist actions so they can call `navigateRuntimeTab(tabId, { guidedTask })`.
- Add runtime panel state for the active guided task.
- Render a slim **Back to Start Checklist** strip on destination Basic tabs.
- Clear the task when returning to `session.basicReadiness`, dismissing the strip, or switching to Advanced.

### Phase 2: Guided Task Strip

- Add task title, origin breadcrumb, and compact copy.
- Add **Dismiss** and optional **Next** actions.
- Add status transitions: `active`, `target_missing`, `done`.
- Detect readiness row completion by comparing the active task's `readinessRowId` against the latest `getBasicReadinessModel()`.

### Phase 3: Target Highlighting

- Reuse existing `markTourTarget()` data where possible.
- Add a helper to focus/highlight a target without starting a full walkthrough.
- Use existing prepare actions where they already fit, such as opening Library or Pending Review.
- If a target cannot be found, show the strip in `target_missing` state with concrete recovery copy.

Implemented with an important constraint: render-time focus does not run preparation automatically. Preparation only runs after the user clicks **Find Control**, so Saga does not surprise the user by opening fullscreen surfaces while merely rendering a destination tab.

### Phase 4: Full First-Run Polish

- Tune copy for each initial guided task.
- Verify the flow on an empty install and on a partially configured chat.
- Make sure the strip does not compete with the Basic Walkthrough card.

Implemented:

- Empty/first-run stack path: **Set Context** can route to the Library when no Lorepack is loaded, and that task completes once a Lorepack is in the active stack.
- Partial setup path: Context, Pending Review, Accepted Lorecards, and Provider tasks keep task-specific recovery copy instead of generic target messages.
- Walkthrough separation: starting a walkthrough clears the active checklist helper and its highlight.

## Code Touchpoints

- `runtime-basic-readiness.js`
  - Keep readiness derivation here.
  - Add guided-task metadata to rows if the model should own route intent.

- `lore-panel.js`
  - Update `getBasicReadinessAction()`.
  - Extend `navigateRuntimeTab()`.
  - Render guided task strip in Basic destination tabs.
  - Clear guided task state on return/dismiss/mode switch.

- `runtime-tour.js`
  - Reuse target lookup/highlighting helpers if they can be exposed without coupling guided tasks to full walkthrough state.

- `runtime-guide-content.js`
  - Do not make Basic Walkthrough the checklist action mechanism.
  - Shared target IDs can be reused by guided tasks.

- `scripts/test-visual-smoke-harness.mjs`
  - Add static checks for guided task metadata, return strip rendering, Basic-only visibility, and no forced full-tour launch from checklist actions.

## Acceptance Criteria

- A first-time Basic user can click the next Start Checklist action, complete or inspect the target step, and return to the checklist without manually hunting for the Session tab or section.
- Checklist-launched guidance is focused on one setup task at a time.
- The Basic Walkthrough remains optional and module-based.
- The guided task strip never blocks the primary setup control it is explaining.
- If the target control cannot be found, Saga shows an explanatory fallback instead of silently doing nothing.
- Readiness completion changes the strip to a done/recovery state but does not auto-navigate.
- The feature works with empty installs, no Lorepacks loaded, pending review absent, and provider settings incomplete.

## Non-Goals

- Do not replace the Basic Walkthrough.
- Do not add a modal wizard as the primary Basic setup path.
- Do not add new public terminology beyond Start Checklist and Basic Walkthrough.
- Do not expose Advanced-only concepts in Basic guided tasks.
- Do not add legacy compatibility migration scaffolding for this pre-alpha UI state.

## Resolved And Open Questions

- Guided task state should survive closing and reopening the runtime window during the same chat.
- Should the strip show a small progress count, such as `Step 1 of 2`, for multi-target tasks like adding a Lorepack?
- Should the **Back to Start Checklist** control live in the strip only, or also appear in the drawer header while a guided task is active?
- The Basic Walkthrough and guided task mode should remain separate. Starting a walkthrough clears active checklist guidance.
