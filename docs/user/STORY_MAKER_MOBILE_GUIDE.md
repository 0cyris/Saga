# Story Maker Guide for Mobile

This guide covers the phone-width **Story Maker** UI. It assumes you are using Saga's mobile shell with bottom navigation. You do not need to know the desktop Story Maker UI to use this guide.

Story Maker lives in the **Session** route. It creates, revises, and copies a lore-aware opening message from the current Saga setup: loaded Loredecks, selected Context, accepted Lorecards, and the Reasoning Provider.

Use Story Maker when you want help starting a new roleplay scene, restarting a chat from the right story position, or writing an opener that respects current canon boundaries.

## Mobile Requirements

Before generating, check that:

- Saga is active.
- the right Loredecks are loaded.
- Context is set for those Loredecks.
- useful Lorecards are accepted when needed.
- the Reasoning Provider works.

You can save Story Maker inputs without a provider. Building the Context Packet, Opener Brief, Draft Variants, and revisions requires the Reasoning Provider.

## Opening Story Maker

1. Open Saga on a phone-width viewport.
2. Tap **Session** on the bottom bar.
3. Scroll to **Story Maker**.
4. Open the section if it is collapsed.

The mobile Session route also contains readiness and runtime status. Story Maker is a full section inside the same route, not a separate bottom-tab route.

## Mobile Layout

<p align="center">
  <img src="../../assets/documentation/renders/docs-mobile-advanced-story-maker.png" alt="Story Maker mobile draft variants" width="421">
</p>

The mobile section keeps the same stages as desktop, but the cards stack vertically:

1. **Inputs**
2. **Context Packet**
3. **Opener Brief**
4. **Draft Variants**
5. **Review & Copy**

Tap a stage to inspect it. If the stage is locked, finish the required earlier stage first. Reset controls appear on eligible completed stages and clear later generated work for that opener.

If no Loredeck stack is active, the **Context Packet** stage becomes **Add Loredecks**. Tap it to open Loredecks, then add a Loredeck before returning to Story Maker.

When Story Maker is waiting on the Reasoning Provider, a compact live generation status row appears under the stage bar. It shows the active stage, the generation message, and elapsed time. On mobile, keep the Session route open if you want to watch the row update during longer packet, brief, variant, or revision runs.

## Saved Openers

At the top of Story Maker you can:

- create a new opener with **New Opener**
- review **Saved openers**
- select an existing opener
- delete an opener you no longer need

Saved openers are stored as Story Maker sessions. Deleting one does not remove Loredecks, Lorecards, Context, or chat messages.

## Inputs On Mobile

The **Inputs** card contains the same functional controls as desktop, arranged for scrolling:

- **Context**
- **Prose Style**
- **User Prompt**
- **Character Focus**
- **Opening Shape**
- **PoV**
- **Tense**
- target length buttons
- **Variant Count**
- **Save Inputs**
- **Build Context Packet**
- **Generate Full Pipeline**

Use short, direct mobile input text. You can still write detailed instructions, but shorter fields are easier to review on a phone.

**Opening Shape** is a dropdown. It defaults to **Scene Setting**. Choose **Custom** at the bottom of the list only when you want to type a custom shape; the custom field stays hidden otherwise.

Opening Shape presets:

- **Scene Setting**
- **Dialogue first**
- **Action first**
- **Introspective**
- **Cold open**
- **Mystery hook**
- **Custom**

**PoV** uses **1st**, **2nd**, and **3rd** segmented buttons. **Tense** uses **Past**, **Present**, and **Future** segmented buttons.

Target length:

- **Hook**
- **Scene**
- **Chapter**

Use **Save Inputs** if you are setting up the opener over multiple passes. Use **Generate Full Pipeline** when the inputs are ready and you want Saga to run all stages in order.

While a provider-backed Story Maker action is running, mobile disables the other provider-backed input action so **Build Context Packet** and **Generate Full Pipeline** cannot overlap.

## Source Controls

Story Maker can work from saved opener sources or the current Saga stack.

- **Refresh From Saved Sources** keeps the opener's saved source intent and re-resolves it against current stored Loredeck data.
- **Use Current Active Stack** replaces the opener's source intent with the current active Loredeck stack and Context.

On mobile, use **Use Current Active Stack** when you changed decks or Context from the mobile Loredecks/Context routes and want the opener to follow those changes.

## Context Packet

The **Context Packet** stage is the guardrail stage. It decides what Story Maker may use and what it must avoid.

It can show:

- resolved Context
- source status
- eligible facts
- blocked facts
- must-use facts
- fresh facts
- must-avoid facts

Read this stage if an opener includes stale, future, or wrong-branch material. The must-avoid list tells you whether Saga saw the blocked facts and told the writer not to use them.

## Opener Brief

The **Opener Brief** turns source facts and input directions into a writing plan.

Review it when:

- the output is structurally wrong
- the wrong character is centered
- the scene starts in the wrong place
- the prose style is not what you asked for
- the target length is off

Rebuild the brief after changing important inputs or source setup.

Use **Build Opener Brief** when the Context Packet is current and you want to rebuild only the writing plan before drafting variants.

## Draft Variants

The **Draft Variants** card shows the generated opener text. If **Variant Count** is above 1, use the variant buttons to switch between alternatives.

Only the selected variant is revised or copied. If Variant B is better than Variant A, tap **Variant B** before going to **Review & Copy**.

Use **Draft Opener** when the brief is ready and you only need to regenerate opener text without rebuilding the packet and brief.

Story Maker automatically retries retryable provider failures up to three times. If one variant fails but another succeeds, the successful variants stay available. The failure card can show compact attempt details and **Retry Failed Variants** when only specific variant calls need another pass.

## Review & Copy On Mobile

The **Review & Copy** stage contains:

- **Revision Prompt**
- **Copy Markdown to Clipboard**
- **Copy Rich-Text to Clipboard**
- **Revise Selected**
- **Revision history**

Write revision prompts as direct commands:

- "Make the opener quieter."
- "Start with dialogue."
- "Put Ron in the room sooner."
- "Remove future knowledge."
- "Make the hook shorter."

Tap **Copy Markdown to Clipboard** after the selected opener is ready when you want the raw Markdown text. Tap **Copy Rich-Text to Clipboard** when you want rendered emphasis and dialogue quote color on the clipboard.

## Mobile Workflow

1. Tap **Loredecks** and confirm the right decks are loaded.
2. Tap **Context** and choose the story position.
3. Tap **Lorecards** and accept useful durable facts if needed.
4. Tap **Session**.
5. Open **Story Maker**.
6. Tap **New Opener**.
7. Fill the input fields.
8. Choose an **Opening Shape**, length, and **Variant Count**.
9. Set **Variant Count** above 1 if you want alternatives.
10. Tap **Generate Full Pipeline**.
11. Review the variants.
12. Open **Review & Copy**.
13. Revise or copy the selected opener.

## Mobile Troubleshooting

| Problem | First check |
| --- | --- |
| Story Maker is empty | Tap **New Opener** or select a saved opener. |
| A stage is locked | Complete the earlier stage shown in the stage bar. |
| Generation fails | Read the failure card first, then check the Reasoning Provider in Settings if retries are exhausted. |
| The opener uses wrong lore | Recheck Context, then rebuild the Context Packet. |
| The output is too long | Choose **Hook** or **Scene**, then redraft or revise. |
| You cannot find the copied text | Use **Copy Markdown to Clipboard**, then paste into the chat input manually. |
