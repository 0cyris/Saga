# Story Maker Guide for Desktop

This guide covers the desktop and tablet-width **Story Maker** UI. It assumes you are using the desktop rail and drawer, not the phone-width mobile shell.

Story Maker lives on the **Session** tab. It creates, revises, and copies an opening message for a roleplay scene by using the active Saga setup: loaded Loredecks, current Context, accepted Lorecards, and the Reasoning Provider.

Use Story Maker when you want Saga to help write the first post for a new chat, restart a scene cleanly, or produce a lore-aware opener without hand-copying facts from Loredecks and Lorecards.

## Requirements

Story Maker works best when:

- **Saga Active** is on.
- At least one Loredeck is loaded in the active stack.
- Context is selected for the loaded Loredecks.
- Useful Lorecards have been accepted or the active Loredecks contain enough eligible facts.
- A **Reasoning Provider** is configured for model-backed drafting.

Story Maker can still save inputs without a provider. Provider-backed actions such as packet building, brief generation, opener drafting, and revision require a working Reasoning Provider.

## Where It Lives

Open Saga, choose **Session**, and scroll to **Story Maker**. The desktop section appears after Session metrics and the walkthrough card in the current Session tab layout.

The section header shows the feature name and purpose. Open the section to see:

- **New Opener**
- **Saved openers**
- the active opener title
- status chips
- the stage bar
- the current stage card

## Saved Openers

Story Maker stores opener sessions in external Saga storage. The shelf shows **Saved openers (N)** with one row per saved opener.

Each opener row shows:

- opener title
- current stage
- source summary
- a **Delete** action

Use **New Opener** to create a fresh Story Maker session. Deleting an opener removes that saved Story Maker session and its payload file. It does not delete Loredecks, Lorecards, Context, or chat messages.

## Stage Bar

Story Maker uses a compact Deck Maker-style stage bar:

1. **Inputs**
2. **Context Packet**
3. **Opener Brief**
4. **Draft Variants**
5. **Review & Copy**

Click an unlocked stage to inspect it. Locked stages show the dependency that must be completed first. Completed stages can show a reset control. Resetting to a stage clears later generated work for that opener, so use it when the source setup or direction changed enough that downstream text should be rebuilt.

If no Loredeck stack is active, the **Context Packet** stage appears as **Add Loredecks**. Click it to open Loredecks, then add a Loredeck before building the packet.

When a provider-backed Story Maker action is running, Story Maker shows a compact live generation status row under the stage bar. It names the current stage, shows the current generation message, and updates elapsed time while the run is queued, running, retrying, drafting, or revising. Keep the section open if you want to watch long runs progress; the generated stage card updates when the run finishes.

## Inputs

<p align="center">
  <img src="../../assets/documentation/renders/docs-story-maker-desktop-inputs.png" alt="Story Maker desktop inputs" width="694">
</p>

The **Inputs** stage is where you define what the opener should do.

Fields:

- **Context**: the story position and situation the opener should start from.
- **Prose Style**: tone, voice, pacing, and style guidance.
- **User Prompt**: the concrete opening instruction.
- **Character Focus**: characters or factions to emphasize.
- **Opening Shape**: preset structural kind of opener. It defaults to **Scene Setting**. Choose **Custom** to reveal a custom shape field.
- **PoV**: segmented point-of-view choice: **1st**, **2nd**, or **3rd**.
- **Tense**: segmented tense choice: **Past**, **Present**, or **Future**.

Opening Shape presets:

- **Scene Setting**
- **Dialogue first**
- **Action first**
- **Introspective**
- **Cold open**
- **Mystery hook**
- **Custom**

Length controls:

- **Hook**: shortest opener.
- **Scene**: normal roleplay opener.
- **Chapter**: longer setup.

The **Variant Count** slider controls how many opener alternatives Story Maker drafts after the brief. Set it from **1** to **5** depending on how many options you want in one pass.

Actions:

- **Save Inputs**: saves the current fields without generating.
- **Build Context Packet**: resolves current sources and builds the lore packet.
- **Generate Full Pipeline**: builds packet, builds brief, and drafts opener variants in sequence.

Story Maker disables provider-backed input actions while another provider-backed Story Maker action is running, so **Build Context Packet** and **Generate Full Pipeline** cannot overlap.

Use **Save Inputs** before leaving the section if you have not generated yet.

## Source Actions

Above the input fields, Story Maker exposes source-management actions once an opener exists:

- **Refresh From Saved Sources**: keeps the saved source intent but resolves it against the latest Loredecks and Context.
- **Use Current Active Stack**: replaces the opener's saved source intent with the current active Loredeck stack and current Context.

Use **Refresh From Saved Sources** when the opener should keep its original plan but the underlying source data may have changed. Use **Use Current Active Stack** when you deliberately changed which Loredecks or Context should drive this opener.

## Context Packet

The **Context Packet** stage resolves the raw source setup into writing-safe lore constraints.

It shows:

- source resolution status
- detected fandoms
- eligible facts
- blocked facts
- opener Context
- must-use facts
- fresh/current-window facts
- must-avoid constraints

The must-avoid list is important. It is where Story Maker keeps future-only facts, hidden reveals, expired details, or Context-blocked material out of the opener.

Run **Build Context Packet** when:

- Context changed.
- the active stack changed.
- you accepted new Lorecards that should influence the opener.
- the previous opener draft seems to include stale or premature lore.

## Opener Brief

The **Opener Brief** stage turns the Context Packet and input direction into a writing plan.

It can include:

- premise
- style guidance
- opening shape
- target length
- character focus
- PoV and tense
- scene plan beats

Use **Build Opener Brief** when the packet is current but the writing plan has not been generated or needs to be rebuilt after input changes.

## Draft Variants

<p align="center">
  <img src="../../assets/documentation/renders/docs-story-maker-desktop-variants.png" alt="Story Maker desktop variants" width="694">
</p>

The **Draft Variants** stage holds generated opener text.

When more than one variant is drafted, the stage shows **Variant A**, **Variant B**, **Variant C**, and any additional variant tabs up to the selected count. Click a variant to make it the selected opener. The selected variant is the one used by **Review & Copy** and the copy buttons.

Use **Draft Opener** to generate opener text from the brief. If the draft is not close enough, update the input fields or revise the selected variant instead of accepting a weak opening.

## Review & Copy

<p align="center">
  <img src="../../assets/documentation/renders/docs-story-maker-desktop-review.png" alt="Story Maker desktop review and copy" width="694">
</p>

The **Review & Copy** stage is the final operator checkpoint.

Controls:

- **Revision Prompt**: instruction for changing the selected opener.
- **Copy Markdown to Clipboard**: copies the selected opener as raw Markdown.
- **Copy Rich-Text to Clipboard**: copies the selected opener with rendered Markdown and dialogue quote color.
- **Revise Selected**: asks the Reasoning Provider to revise only the selected opener.
- **Revision history**: shows prior revision instructions and snippets.

Use revision prompts for concrete changes such as:

- "Make Hermione more central."
- "Reduce exposition."
- "Start with dialogue."
- "Make the threat quieter and less obvious."
- "Remove future canon knowledge."

After copying, paste the opener into the SillyTavern chat or your preferred writing surface.

## Failure States

Story Maker shows failure cards when provider or validation work fails. Read the failure message and recovery hint before retrying.

For retryable provider problems, Story Maker automatically tries the affected unit up to three times. The live status row names the exact retry, such as **Retrying Opener Brief, attempt 2 of 3** or **Retrying Variant B, attempt 2 of 3**.

If some variants fail but at least one succeeds, Story Maker keeps the successful variants available for review and copy. Use **Retry Failed Variants** if you want to spend another pass only on the failed variant calls. Use the failure card's **Details** disclosure when you need the compact attempt history.

Common fixes:

- If source resolution fails, check active Loredecks and Context.
- If the provider fails, test the Reasoning Provider in Settings.
- If output includes premature facts, rebuild the Context Packet and check must-avoid constraints.
- If the opener is stylistically wrong, revise the selected variant or update **Prose Style** and rebuild.

## Desktop Workflow

1. Load Loredecks in **Loredecks**.
2. Set Context in **Context**.
3. Accept any useful Lorecards in **Lorecards**.
4. Open **Session > Story Maker**.
5. Click **New Opener**.
6. Fill **Context**, **Prose Style**, **User Prompt**, **Character Focus**, **Opening Shape**, **PoV**, **Tense**, target length, and **Variant Count**.
7. Set **Variant Count** above 1 if you want multiple options.
8. Click **Generate Full Pipeline**.
9. Review the Context Packet and Opener Brief if the output feels off.
10. Choose the best variant.
11. Use **Review & Copy** to revise or copy the opener.
