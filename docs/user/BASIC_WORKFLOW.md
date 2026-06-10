# Saga Basic Workflow

Use Basic Experience when you want the shortest path from "I opened Saga" to "the model has the right lore for this scene."

Basic keeps the workflow manual and review-first. It hides Continuity and the full Injection tab because those are diagnostic and tuning surfaces, not required first-run steps.

## Basic Walkthrough

The in-app **Basic Walkthrough** is split into small tab walkthroughs instead of one long checklist. Use the full walkthrough on first setup, or start only the section you need.

### Loredecks

Use **Loredecks** to open the Library, import a deck package when needed, choose a **Bundled Lorepack**, **Generated Lorepack**, or **Custom Lorepack**, and add the right decks or folder groups to the active stack. Basic does not show Creator project creation or the in-progress Creator shelf; switch to Advanced when you need to create or resume a Generated Lorepack project.

### Session

Use **Session** to confirm **Saga Active**, read the **Start Checklist**, understand the continue/update loop, and check runtime metrics such as pending Lorecards, accepted lore, selected injection, and token estimate.

### Context

Use **Context** to set the current story position for each loaded Loredeck. **Browse Context** is the trusted manual path. **Detect Context** can help after scene jumps, time skips, chapter changes, episode changes, quests, or major location shifts.

### Lorecards

Use **Lorecards** to preview canon packs, scan recent story, add a manual Lorecard, review Pending Lorecards, and inspect Accepted Lorecards. New facts should stay pending until you decide they should affect future responses.

### Settings

Use **Settings** to check provider readiness for model-backed actions and manage the runtime Theme Pack.

## Quick Start

1. Open the Saga shelf and choose **Basic** if Saga is not already in Basic Experience.
2. Open **Session** and confirm Saga is active.
3. Open **Loredecks**, open **Loredeck Library**, import a package if needed, and add the Bundled Lorepack, Generated Lorepack, or Custom Lorepack that matches the current chat to the active stack.
4. Open **Context** and set where the story currently is inside the loaded Loredeck.
5. Open **Lorecards** and use **Lorecard Generation** if you need suggestions from the loaded Context.
6. Accept only Lorecards that should affect future responses. Dismiss anything that should not matter.
7. Use **Add Lorecard** when you know a fact matters and Saga has not suggested it.
8. Confirm the **Start Checklist** is ready.
9. Open **Settings** if you want to test providers or manage Theme Packs.
10. Continue roleplay.

The core review question is:

```text
Should this fact affect future responses?
```

## What Basic Hides

Basic does not show the dedicated **Injection** tab. Use **Advanced Injection** when you need to inspect exactly what Saga will send.

Basic also hides the **Continuity** tab. Current-scene continuity is useful, but it is a second mental model. Basic focuses on loaded Loredecks, story Context, and accepted Lorecards.

Basic **Settings** keeps provider setup optional. Use it to test Utility or Reasoning providers, fall back to the current SillyTavern model, or manage Theme Packs. Use the shelf mode buttons to switch Experience Mode.

Switch to Advanced when you need provider profile internals, endpoint/model controls, prompt placement, full injection previews, automation, Continuity tools, Pack Health, Create Deck, in-progress Creator projects, bulk Lorecard management, or diagnostic details.

## Common Fixes

- **No Lorecards selected:** load a Loredeck, set Context, then accept relevant Lorecards in Lorecards.
- **Suggestions look wrong:** revisit Context and choose the correct Context manually.
- **A saved Lorecard should not affect responses:** mute it in Lorecards.
- **A Lorecard should always stay prominent:** pin it in Lorecards.
- **A model-backed action says provider setup is needed:** open Settings, test the provider, or use the current SillyTavern model.
- **You need to inspect exactly what Saga sends:** switch to Advanced and open **Injection**.
