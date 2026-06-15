# Saga for Desktop Operator's Manual

This manual is the detailed operating guide for Saga's desktop and tablet-width runtime surfaces. Use it after the README has given you the basic mental model and install path.

For phone-width operation, see [Saga for Mobile Operator's Manual](MOBILE_OPERATOR_MANUAL.md). For short workflow guides, see [Basic Workflow](BASIC_WORKFLOW.md) and [Advanced Workflow](ADVANCED_WORKFLOW.md).

## First Run Checklist

Basic Experience keeps the first-run path narrow. The Start Checklist is the operator's quick answer to: "Is Saga ready to influence this chat?"

Use it to confirm that Saga is active, Loredecks are loaded, Context has been browsed and selected in the Context Workbench, Lorecards are available, and injection has something useful to send.

<p align="center">
  <img src="../../assets/documentation/renders/docs-basic-walkthrough-modules.png" alt="Saga Basic Walkthrough module cards" width="800">
</p>

The **Basic Walkthrough** is organized as a short roleplay loop: First Run, Loredecks, Context, Lorecards, Continue Roleplay, and Settings. Use **Start Basic Walkthrough** for the first pass, or start a module when you only need one part of the setup loop.

## Session

<p align="center">
  <img src="../../assets/documentation/renders/docs-session-advanced-status.png" alt="Saga Advanced session controls and status" width="800">
</p>

The **Session** tab is the runtime control room. It shows the current experience mode, automation state, readiness, and active system status.

Use **Basic** when you want the guided path. Use **Advanced** when you need to inspect automation, run diagnostics, work with Continuity, manage prompt injection, or operate the Loredeck Creator.

<p align="center">
  <img src="../../assets/documentation/renders/docs-advanced-walkthrough-modules.png" alt="Saga Advanced Walkthrough task tracks" width="800">
</p>

The **Advanced Walkthrough** is organized as task tracks instead of a flat tab tour. It covers Library mastery, Session control, Context resolution, Lorecard review, Injection diagnostics, Continuity, Creator authoring, Pack Health and package work, Settings, and troubleshooting.

## Loredecks And Active Stack

<p align="center">
  <img src="../../assets/documentation/renders/docs-loredecks-overview.png" alt="Saga Loredecks tab overview" width="800">
</p>

A **Loredeck** is a portable, data-only lore package. It can represent canon, AU material, crossover logic, original setting lore, scenario rules, or user-authored additions.

<p align="center">
  <img src="../../assets/documentation/renders/docs-loredecks-library-launch.png" alt="Saga Loredeck Library launcher card" width="700">
</p>

Saga uses three public Lorepack types:

- **Bundled Lorepack**: shipped with Saga and human-vetted.
- **Generated Lorepack**: produced by the Loredeck Creator and still review-oriented.
- **Custom Lorepack**: user-created, duplicated, imported, edited, AU, crossover, or shared.

<p align="center">
  <img src="../../assets/documentation/renders/docs-loredeck-library-overview.png" alt="Saga Loredeck Library workbench" width="800">
</p>

The **Loredeck Library** is the long-term home for browsing, organizing, importing, exporting, duplicating, inspecting, and validating Loredecks.

<p align="center">
  <img src="../../assets/documentation/renders/docs-loredeck-library-active-stack.png" alt="Saga Active Stack panel" width="650">
</p>

The **Active Stack** is the ordered set of Loredecks loaded into the current chat. Stack priority matters when multiple decks can contribute lore. Enable, disable, reorder, or remove stack items to control what participates in Context, retrieval, and Injection.

<p align="center">
  <img src="../../assets/documentation/renders/docs-loredeck-library-selected-details.png" alt="Saga selected Loredeck details panel" width="800">
</p>

The selected Loredeck details area is where operators inspect metadata, source type, health state, stats, and deck actions. Use it before trusting a deck in a long-running story.

## Pack Health

<p align="center">
  <img src="../../assets/documentation/renders/docs-pack-health-overview.png" alt="Saga Pack Health overview" width="800">
</p>

**Pack Health** validates whether Saga can reliably load and reason over a Loredeck. It checks manifests, embedded metadata, entry structure, tag registries, timeline references, Context gates, stats, and other structural expectations.

Pack Health is not a canon-truth oracle. A clean report means the deck is structurally usable. It does not prove every lore claim is perfect.

<p align="center">
  <img src="../../assets/documentation/renders/docs-pack-health-issues.png" alt="Saga Pack Health grouped issues table" width="800">
</p>

The Issues view groups related findings so deck authors can repair problems systematically. Run Pack Health after importing, generating, duplicating, finalizing, or heavily editing a Loredeck.

## Loredeck Creator

<p align="center">
  <img src="../../assets/documentation/renders/docs-loredeck-creator-intake.png" alt="Saga Loredeck Creator intake screen" width="800">
</p>

The **Loredeck Creator** is a staged generation workflow. It is deliberately not "ask a model for a whole deck in one response."

The intended flow is:

1. Scope Brief.
2. Story outline and Context plan.
3. Lorecard title pass.
4. Timeline and tag planning.
5. Lorecard drafting.
6. Review and Pending Review.
7. Pack Health and finalization.

<p align="center">
  <img src="../../assets/documentation/renders/docs-loredeck-creator-current-task.png" alt="Saga Loredeck Creator current task area" width="800">
</p>

Generated material remains draft material until reviewed. A Generated Lorepack should become a Custom Lorepack only after its entries, Context, tags, and Pack Health are good enough to use.

During Lorecard drafting, Saga separates provider failures from Saga-side schema rejections. If a model returns usable JSON but some Lorecards contain unavailable tags, unknown timeline anchors, or the wrong micro-batch target, Saga keeps valid drafts, records compact rejection details, and can retry affected titles as smaller batches. Use **Auto split failed batches** in Creator generation settings for that automatic recovery path. The Lorecards step can show **Last Lorecard preflight gaps** and **Last Lorecard rejection details**; draft rows can also show **Creator preflight note** or **Creator repair note** before the drafts move to Pending Review.

## Context

<p align="center">
  <img src="../../assets/documentation/renders/docs-context-command-center.png" alt="Saga Context command center" width="800">
</p>

**Context** tells Saga where the current chat is inside each loaded Loredeck. It can be a date, anchor, chapter, book, arc, phase, route, season, quest stage, stardate, or custom coordinate system.

Context is how Saga avoids injecting lore too early, too late, or from the wrong branch of a story.

<p align="center">
  <img src="../../assets/documentation/renders/docs-context-loaded-loredecks.png" alt="Saga loaded Loredeck Context rows" width="800">
</p>

Loaded Loredeck Context rows show which decks have Context, whether that Context is manual or detected, and whether the operator locked it.

<p align="center">
  <img src="../../assets/documentation/renders/docs-context-workbench.png" alt="Saga Context workbench" width="800">
</p>

The Context Workbench supports browsing loaded Loredecks, choosing the current story position, and applying a waypoint or window before the story starts.

<p align="center">
  <img src="../../assets/documentation/renders/docs-context-proposal-review.png" alt="Saga Context proposal review" width="800">
</p>

When Saga proposes Context changes, review them before applying. Reasoner output should guide the operator, not silently change the story's active position.

## Lorecards

<p align="center">
  <img src="../../assets/documentation/renders/docs-lorecards-overview.png" alt="Saga Lorecards tab overview" width="800">
</p>

A **Lorecard** is one reviewable unit of lore. It should be narrow enough to retrieve precisely and important enough to affect the next scene.

Good Lorecards are not broad wiki summaries. They describe specific facts, constraints, reveals, relationship states, knowledge boundaries, abilities, location conditions, or timeline events.

<p align="center">
  <img src="../../assets/documentation/renders/docs-lorecards-pending-review.png" alt="Saga Pending Review section" width="800">
</p>

**Pending Review** is where generated or proposed Lorecards wait. Accept only content that should affect future responses. Reject or revise anything that is vague, premature, duplicated, too broad, or wrong for the current branch.

<p align="center">
  <img src="../../assets/documentation/renders/docs-lorecards-accepted-list.png" alt="Saga Accepted Lorecards list" width="800">
</p>

Accepted Lorecards can be filtered by relevance, pinned, muted, edited, or inspected. Relevance tiers help Saga decide what deserves prompt space now.

<p align="center">
  <img src="../../assets/documentation/renders/docs-lorecards-workbench.png" alt="Saga Lorecard Workbench" width="800">
</p>

The Lorecard Workbench is for heavier review and batch management.

<p align="center">
  <img src="../../assets/documentation/renders/docs-lore-timeline.png" alt="Saga Lore Timeline" width="800">
</p>

The Lore Timeline shows how lore changed over time: accepted entries, rejected drafts, pin/mute changes, restores, and other review events.

## Continuity

<p align="center">
  <img src="../../assets/documentation/renders/docs-continuity-overview.png" alt="Saga Continuity tab overview" width="800">
</p>

Saga separates durable lore from live continuity. Lorecards are long-term facts and constraints. Continuity is lightweight current state: scene, characters, items, objectives, and active threads.

<p align="center">
  <img src="../../assets/documentation/renders/docs-continuity-scan.png" alt="Saga Continuity Scan controls" width="800">
</p>

Continuity scans help update live state from recent chat. Use them to keep the current scene coherent, not to build a second static lore database.

<p align="center">
  <img src="../../assets/documentation/renders/docs-continuity-character-state.png" alt="Saga active character continuity state" width="800">
</p>

Character state is for what is currently true in the chat: location, posture, clothing, physical state, emotional state, carried items, goals, and immediate notes.

## Injection

<p align="center">
  <img src="../../assets/documentation/renders/docs-injection-overview.png" alt="Saga Injection tab overview" width="800">
</p>

**Injection** is the final operator truth source for what Saga will send to the model. A Lorecard can exist, be accepted, and still not inject if it is muted, out of Context, disabled, lower priority, or outside the configured prompt budget.

<p align="center">
  <img src="../../assets/documentation/renders/docs-injection-placement.png" alt="Saga prompt placement controls" width="800">
</p>

Prompt placement controls decide where Continuity and each Lorecard relevance tier are inserted into the model context.

<p align="center">
  <img src="../../assets/documentation/renders/docs-injection-high-preview.png" alt="Saga High-Relevance Lore Injection preview" width="800">
</p>

The preview shows the actual text Saga is preparing for injection. Use it when debugging "why did the model know this?" or "why did the model forget this?"

## Settings, Providers, Themes

<p align="center">
  <img src="../../assets/documentation/renders/docs-settings-providers.png" alt="Saga provider settings" width="800">
</p>

Saga is model/provider agnostic. Use stronger reasoning models for Context proposals, Creator planning, and complex repairs. Use faster utility models for smaller, lower-risk suggestions. Treat all model output as draft until reviewed.

<p align="center">
  <img src="../../assets/documentation/renders/docs-settings-theme-pack.png" alt="Saga Theme Pack settings" width="800">
</p>

Theme Packs and Icon Sets are passive data. They can change the shelf's appearance without running code.

## Storage And State Safety

Saga keeps large Saga-owned payloads in SillyTavern `/user/files` instead of storing full Loredecks, Creator projects, Theme Packs, Icon Sets, and passive assets inside `settings.json`.

Open **Settings**, switch to **Advanced**, then open **State Safety** to verify tracked storage files, settle queued writes, or clean missing non-index file records. State Safety is for maintenance and recovery.

Open **Settings**, then use **Danger Zone** at the bottom of the Settings tab for destructive cleanup. **Active Chat** actions affect only the current chat. **Global** actions can reset all Saga settings, remove custom Theme Packs and Icon Sets, remove custom/imported/generated Loredecks, or run **Total Saga Cleanup**.

The Global summary rows refresh from Saga's cleanup preview. **Cleanup file scope** is the preflight count of tracked/known/referenced Saga files Total Saga Cleanup can target, with tooltip detail for tracked files, known index files, additional referenced files, and Health repair sessions. It is not an orphan-file scan.

Saga does not migrate old settings-backed payloads in this pre-alpha line. If stale payloads from an older local build remain in settings, use **Total Saga Cleanup** for a full reset or reinstall Saga with a clean state.

Use **Total Saga Cleanup** only when you want a fresh Saga state. It requires typing `DELETE SAGA`, removes stored Saga API keys, deletes custom/imported/generated Loredecks, deletes Creator projects and custom appearance packs, resets the current chat's Saga state, and clears State Safety backups. Bundled content remains available, and Saga recreates storage indexes when new custom content is imported or saved. If cleanup partially fails, Saga leaves one compact State Safety warning in the reset chat so the retry reason remains visible; in Basic, switch to Advanced and open State Safety before retrying.

For the full storage contract, see [Storage And State Safety](STORAGE_AND_STATE_SAFETY.md).

## Troubleshooting

| Problem | First check |
| --- | --- |
| Saga shelf does not open | Confirm the extension was installed from the Saga GitHub URL in SillyTavern's Extension installer, then reload SillyTavern. |
| No Loredecks are active | Open Loredecks, then Loredeck Library, and add a Loredeck to the Active Stack. |
| Lore seems from the wrong point in the story | Open Context and check the active Context for each loaded Loredeck. |
| Accepted Lorecards are not reaching the model | Open Injection and inspect the relevance preview, pin/mute state, Context gate, and injection enable toggles. |
| Imported or generated deck behaves strangely | Run Pack Health and review grouped issues. |
| Saga storage reports missing files | Open Advanced Settings, run State Safety **Verify Storage**, then use **Clean Missing Records** only for stale indexed files. |
| You need to delete custom Loredecks or appearance packs | Open Settings, then **Danger Zone**. Use **Remove Custom Loredecks** or **Remove Custom Themes + Icon Packs**. |
| Model-assisted actions fail | Check provider settings, model availability, and whether the action requires Utility or Reasoning configuration. |
