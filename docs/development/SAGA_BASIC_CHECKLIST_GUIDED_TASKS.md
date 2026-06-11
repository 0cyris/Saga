# Saga Basic Checklist Mini-Tours

This note records the current Basic Start Checklist guidance model. The checklist remains the readiness dashboard in the Basic Session tab, but checklist actions launch an external mini-tour popover instead of rendering guidance inside the Saga drawer.

## Problem

The in-panel guided task strip was not direct enough for first-run setup:

- guidance appeared inside the same Saga window the user was trying to operate;
- many targets were broad cards or sections instead of the actual button to press;
- dedicated surfaces such as Loredeck Library and Context Workbench were not opened as part of the flow;
- users still had to infer the next control from surrounding explanatory text.

The Start Checklist should behave more like the existing walkthrough popover: separate from the panel, attached to the current control, and able to open the window needed for the next step.

## Decision

Use **checklist-launched mini-tours**.

When a Basic checklist action needs guidance, it starts a short custom sequence through `startSagaTourSteps()`. The popover lives outside the Saga drawer, uses existing `data-saga-tour` anchors, and advances through concrete controls.

Examples:

```text
Start Checklist 1 / 5
Open Loredeck Library

Start Checklist 2 / 5
Open a Folder

Start Checklist 3 / 5
Select 1-2 Loredecks

Start Checklist 4 / 5
Add to Active Stack

Start Checklist 5 / 5
Confirm Stack
```

The Basic Walkthrough remains a separate module-based learning tool. The checklist mini-tour is only for the immediate setup task.

## UX Contract

### Start Checklist

- Stays in Basic Session.
- Remains the authoritative readiness summary from `buildBasicReadinessModel()`.
- Uses simple action buttons such as **Open Library**, **Browse Context**, **Review Lorecards**, and **Configure Provider**.
- Launches mini-tours for multi-step tasks; **Saga Active** still toggles in place.

### Mini-Tour Popover

- Uses the existing external tour popover, not an in-panel strip.
- Shows `Start Checklist` progress copy for checklist-launched flows.
- Provides a **Close** control that closes the guide, opens Basic Session, and expands the checklist.
- Uses **Next** to advance button-by-button through the task.
- Uses prepare hooks to open fullscreen/dedicated surfaces such as Loredeck Library, Context Workbench, Pending Lorecard Review, and Accepted Lorecards.
- Falls back to a centered explanatory popover when a target is not visible.

### Targeting

Checklist steps should prefer actual controls over large sections:

- Loredeck setup targets Library open, Library list, transfer controls, active stack, and Done.
- Context setup targets Browse Context, the loaded-Loredeck row, story waypoints, Context apply actions, and loaded Context rows.
- Lorecard review targets Preview Canon Packs, Scan Story Lore, Add Lorecard, pending entry cards, and apply/dismiss actions.
- Lore readiness targets Accepted Lorecards search/list/entry controls.
- Provider setup targets Utility Provider, Reasoning Provider, Test controls, and Advanced Provider Settings handoff.

## Implementation

- `src/runtime/runtime-tour.js`
  - `startSagaTourSteps(steps, options)` launches custom popover sequences.
  - Options include `progressLabel`, `closeLabel`, `finishLabel`, `className`, and `onClose`.

- `src/runtime/lore-panel.js`
  - `BASIC_CHECKLIST_TOUR_TASKS_BY_ROW` defines checklist mini-tour steps.
  - `launchBasicChecklistTour(row)` starts the external popover sequence.
  - The retired in-panel `guidedTask` strip is not part of the runtime state.

- `src/context/context-workbench-panel.js`
  - Adds workbench tour anchors for context picker, waypoint browser, loaded Context table, editor, and resolver controls.

- `src/settings/settings-panel.js`
  - Adds Basic provider anchors for Utility, Reasoning, provider test controls, and Advanced provider handoff.

- `tools/scripts/test-visual-smoke-harness.mjs`
  - Asserts mini-tour metadata, target coverage, retired strip removal, and external popover styling.

## Acceptance Criteria

- A first-time Basic user can click the next Start Checklist action and see an external popover pointing at the actual next control.
- The Loredeck checklist flow opens the Library, explains that folders contain Loredecks, and walks through selecting a Core plus story-position Loredeck for the active stack.
- The Context checklist flow can open Context Workbench and point to selector controls instead of only highlighting the whole Context card.
- The Lorecards checklist flow points to generation/review/apply controls, with pending-review preparation when needed.
- The Provider checklist flow points to concrete Basic provider rows and test controls.
- No Basic checklist action renders an in-panel guided task strip.
- No legacy checklist UI state is added to defaults or state normalization.

## Non-Goals

- Do not replace the Basic Walkthrough.
- Do not add a modal wizard.
- Do not expose Advanced-only concepts in Basic mini-tours except the explicit Advanced Provider Settings handoff.
- Do not add legacy compatibility scaffolding for the retired strip state in pre-alpha.
