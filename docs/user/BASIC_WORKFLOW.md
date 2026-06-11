# Saga Basic Workflow

Use Basic Experience when you want the shortest path from "I opened Saga" to "the model has the right lore for this scene."

Basic keeps the workflow manual and review-first. It shows the roleplay-critical surfaces: Session, Loredecks, Context, Lorecards, and Settings. It hides Continuity, Injection tuning, Create Deck, and in-progress Creator projects so routine play stays focused.

## Basic Walkthrough

The in-app **Basic Walkthrough** is split into compact workflow cards. Use **Start Basic Walkthrough** for the full first pass, or start the module that matches the work you are doing now.

### First Run

Start here when you are new to a chat. This module explains what Basic mode is for, confirms **Saga Active**, shows the **Start Checklist**, and teaches the recommended next action.

Use this module when the checklist is not ready and you want Saga to tell you the next setup step instead of scanning every tab.

### Loredecks

Use **Loredecks** to open **Loredeck Library**, import a `.saga-loredeck.zip` package when needed, inspect the Library layout, identify **Bundled Loredeck**, **Generated Loredeck**, and **Custom Loredeck** types, read **Pack Health**, and build the active stack.

The active stack decides which Loredecks participate in Context, canon suggestions, retrieval, and Lorecards. You can add individual Loredecks, add folder groups, adjust stack order, and disable stack entries without deleting Library data.

Basic keeps **Import Deck** available. Basic does not show **Create Deck** or in-progress Creator projects; switch to Advanced for Generated Loredeck authoring.

### Context

Use **Context** to set the current story position for each loaded Loredeck. **Browse Context** is the trusted manual path when you know the correct arc, chapter, date, episode, quest, or event.

In the Context Workbench, **Anchors** are exact story points and **Windows** are ranges between points. Use **Start Here** for one exact Anchor, **Use Window** for a predefined range, **Use Anchor** from timeline search for a precise row, and **After**/**Before** to build a custom range. **Timeline** opens the source row when you need to inspect it.

Use **Phrase Resolver** when you remember a loose story phrase but not the exact timeline row. It tests local labels, aliases, dates, tags, and coordinates before you apply a match.

Use **Detect Context** after scene jumps, time skips, chapter changes, episode changes, travel, or major plot turns. Treat uncertain detection as a proposal until you verify it.

Return to Context whenever the story crosses a meaningful boundary. Correct Context is what keeps canon suggestions and Lorecard eligibility aligned with the current scene.

### Lorecards

Use **Lorecards** to preview canon packs, scan recent story, add a manual Lorecard, review Pending Lorecards, and inspect Accepted Lorecards.

New facts should stay pending until you decide they should affect future responses. Edit useful proposals before accepting them, dismiss recap/noise/wrong canon, and use pin or mute to adjust accepted Lorecard behavior without deleting data.

The core review question is:

```text
Should this fact affect future responses?
```

### Continue Roleplay

Use **Continue Roleplay** after Loredecks are loaded, Context is current, useful Lorecards are accepted, and the **Start Checklist** is ready.

Session metrics help confirm whether Saga has pending Lorecards, accepted lore, selected injection, and a prompt-size estimate. After major story movement, repeat the loop: update Context, review new Lorecards, then continue roleplay.

### Settings

Use **Settings** when model-backed actions fail or are unavailable. Check provider readiness, test Utility or Reasoning routes, use the current SillyTavern model when that is the simplest path, and choose the runtime **Theme Pack**.

Switch to Advanced for provider profile internals, endpoint/model controls, Creator, Continuity, Injection, Pack Health repair, package diagnostics, or bulk management.

## Quick Start

1. Open the Saga shelf and choose **Basic** if Saga is not already in Basic Experience.
2. Start **First Run** and confirm **Saga Active**.
3. Open **Loredeck Library**, import a package if needed, and add the right Loredecks to the active stack.
4. Use **Browse Context** to select the current story position for each loaded Loredeck before the story starts.
5. Open **Lorecards** and generate or add only the facts you need.
6. Review Pending Lorecards. Accept useful durable facts and dismiss anything that should not guide future responses.
7. Confirm the **Start Checklist** is ready.
8. Continue roleplay.
9. Repeat Context update and Lorecard review after major story movement.

## What Basic Hides

Basic does not show:

- **Create Deck**.
- In-progress Creator projects.
- Creator workbench stages.
- Continuity tab controls.
- Injection tab controls.
- Advanced Context Brief internals.
- Context resolver audit panels.
- Bulk Lorecard management.
- Raw JSON editing.
- Package repair/update conflict resolution.
- Provider profile internals.

Those workflows still use the same saved Loredecks, Context, pending Lorecards, accepted Lorecards, pin/mute choices, and settings. Switch to Advanced when you need the full control surface, then return to Basic for routine roleplay.

## Common Fixes

- **No Lorecards selected:** load a Loredeck, browse Context, then accept relevant Lorecards.
- **The Library is empty or incomplete:** use **Import Deck** or switch to Advanced if you need Creator.
- **Suggestions look wrong:** revisit Context and choose the correct story position manually.
- **A saved Lorecard should not affect responses:** mute it in Lorecards.
- **A Lorecard should stay prominent:** pin it in Lorecards.
- **A model-backed action says provider setup is needed:** open Settings, test the provider, or use the current SillyTavern model.
- **You need to inspect exactly what Saga sends:** switch to Advanced and open **Injection**.
