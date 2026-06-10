# Saga Basic Workflow

Use Basic Experience when you want the shortest path from "I opened Saga" to "the model has the right lore for this scene."

Basic keeps the workflow manual and review-first. It hides Continuity and the full Injection tab because those are diagnostic and tuning surfaces, not required first-run steps.

## Basic Loop

```text
Session -> Loredecks -> Context -> Lorecards -> continue roleplay
```

## Quick Start

1. Open the Saga shelf and choose **Basic** if Saga is not already in Basic Experience.
2. Open **Session** and confirm Saga is active.
3. Open **Loredecks**, open **Loredeck Library**, and add the bundled or custom Loredeck that matches the current chat to the active stack.
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

Switch to Advanced when you need provider profile internals, endpoint/model controls, prompt placement, full injection previews, automation, Continuity tools, Deck Health, Creator controls, bulk Lorecard management, or diagnostic details.

## Common Fixes

- **No Lorecards selected:** load a Loredeck, set Context, then accept relevant Lorecards in Lorecards.
- **Suggestions look wrong:** revisit Context and choose the correct Context manually.
- **A saved Lorecard should not affect responses:** mute it in Lorecards.
- **A Lorecard should always stay prominent:** pin it in Lorecards.
- **A model-backed action says provider setup is needed:** open Settings, test the provider, or use the current SillyTavern model.
- **You need to inspect exactly what Saga sends:** switch to Advanced and open **Injection**.
