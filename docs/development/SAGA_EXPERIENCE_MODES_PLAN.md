# Saga Basic And Advanced Experience Modes Plan

This plan revises Saga's Basic and Advanced experience modes for the current pre-alpha product direction. It assumes Saga is no longer a Wandlight-compatible preset workflow. Legacy Wandlight concepts should be translated into Saga-native concepts or removed from the visible experience.

## Purpose

Saga needs two coherent user experiences:

- **Basic Experience**: a guided runtime path for a new or less software-fluent user who wants Saga to help a chat quickly without learning every system.
- **Advanced Experience**: the full control surface for fluent SillyTavern, LLM, and Saga users who want automation, authoring, diagnostics, deck creation, tuning, and repair workflows.

The modes should differ in disclosure, defaults, labels, and recommended actions. They should not fork Saga's underlying data model. A user should be able to graduate from Basic to Advanced without redoing setup or losing work.

## Product Framing

### What Changed From Wandlight

Old Wandlight asked users to:

1. Import a prompt preset.
2. Pick a model.
3. Create a lightweight story card.
4. Paste or write an opening scene.
5. Optionally add manual canon anchoring through Author's Note or Lorebooks.
6. Toggle prompt modules for length, tense, perspective, character sets, dynamic canon, and anti-slop behavior.

Saga should not recreate that as a preset checklist. Saga replaces the old workflow with:

1. Install and open the extension shelf.
2. Load one or more Loredecks into the Active Stack.
3. Set the current story Context for those Loredecks.
4. Review relevant Lorecards before they affect the prompt.
5. Trust a compact injection summary, or switch to Advanced to inspect the full Injection Preview.
6. Continue roleplay and update story memory when the chat changes.

The old Wandlight lesson is still important: users need a short, confident path to "the model now knows the right lore." Basic Experience should preserve that simplicity while using Saga-native tools.

### Mode Boundary

Experience Mode is about complexity and learning path.

Automation Mode is about whether Saga runs actions only when clicked or after roleplay turns.

Basic should default to manual, guided actions. Advanced may expose Manual, Assisted, and Automatic automation modes. Do not make "Basic" mean "automatic" or "Advanced" mean "manual."

## User Profiles

### Basic User

The Basic user may be new to Saga, new to SillyTavern extensions, or less comfortable with dense tool surfaces.

They need:

- A first-run path that works without understanding schema, tags, prompt depth, relevance scoring, or provider tuning.
- Clear "what to do next" direction.
- Safe defaults that avoid silent model mutation and avoid automatic background work.
- A simple mental model: load lore, choose story position, review cards, send useful lore to the model.
- Small numbers of choices at each step.
- Recovery language that explains what is missing: no deck loaded, no Context set, no accepted Lorecards, no provider configured.

They should not need:

- Continuity section tuning.
- Prompt placement controls.
- Compression prompt editing.
- Bulk scan performance settings.
- Tag registry editing.
- Timeline registry editing.
- Raw JSON editing.
- Deck Health diagnostics beyond readiness summaries.
- Import/export/update collision details unless they explicitly go looking.

### Advanced User

The Advanced user knows SillyTavern, understands LLM provider tradeoffs, and wants full control.

They need:

- Full visibility into the Active Stack, Context resolution, retrieval, relevance, and injection.
- Automation modes and cadence controls.
- Continuity tracking and live state editing.
- Story-lore scan scope, batching, retries, and quality gates.
- Auto-Relevance controls.
- Prompt placement, direct versus compressed handling, and compression templates.
- Library organization, import/export, update previews, duplicate handling, and package details.
- Deck Health Center diagnostics and repair routing.
- Loredeck Creator, Lore Assistant, Pending Review, and generated-to-custom finalization.
- Timeline, tag, and Context authoring tools.
- Debuggable previews and audits for why lore did or did not inject.

They should still get a coherent workflow, not only a bag of controls. Advanced should preserve the same runtime loop as Basic, then expose the extra levers around it.

## Core Principle

Both modes should orbit the same end-to-end loop:

```text
Active Stack
  -> Context
  -> Relevant Lorecards
  -> Pending Review
  -> Accepted Lorecards
  -> Injection Preview
  -> Prompt output
```

Basic should show the loop as a guided checklist.

Advanced should show the loop as a debuggable, configurable system.

## Basic Experience Plan

### Basic Navigation

Recommended Basic rail:

1. **Start**
2. **Loredecks**
3. **Context**
4. **Review**
5. **Settings**

Implementation can keep internal tab IDs such as `session` and `lore`, but Basic labels should be friendlier:

| Internal Area | Basic Label | Basic Purpose |
| --- | --- | --- |
| `session` | Start | Status, next action, walkthrough, Saga Active |
| `loredecks` | Loredecks | Load deck, see active stack, open library when needed |
| `context` | Context | Choose or detect story position |
| `lore` | Review | Review suggested, generated, manual, and accepted Lorecards |
| `settings` | Settings | Provider quick setup, appearance, mode switch |

Hide the `continuity` and `injection` tabs in Basic. Current-scene continuity is useful, but it is a second mental model. Full injection tuning is useful, but it is a diagnostic and control surface, not a required novice workflow. In Basic, expose injection only as compact status inside Start and Review: whether lore injection is on, how many accepted Lorecards are selected, and whether anything obvious is blocked.

### Basic Start Screen

The Start tab should become the Basic command center.

Show a compact readiness checklist:

| Check | Ready State | Missing State | Primary Action |
| --- | --- | --- | --- |
| Saga Active | Saga is active | Saga is paused | Enable Saga |
| Loredeck loaded | Active Stack has at least one enabled deck | No Loredeck loaded | Choose Loredeck |
| Story Context set | Loaded deck has current Context | Story position missing | Set Context |
| Lorecards reviewed | Accepted Lorecards exist or relevant suggestions are available | Nothing accepted yet | Review Lorecards |
| Lore ready | Accepted Lorecards are selected for injection | Nothing selected for prompt | Review Lorecards |
| Provider optional | Provider configured for model-assisted actions | Provider not configured | Configure provider |

Below the checklist, show one recommended next action. Examples:

- "Choose a Loredeck" when the stack is empty.
- "Set story position" when a deck is loaded but Context is missing.
- "Review suggested Lorecards" when Context produces candidates.
- "Continue roleplay" when the prompt is ready.

Do not make users read a long feature explanation before acting.

### Basic First-Run Workflow

The Basic walkthrough should be five steps maximum:

1. **Open Saga and keep Saga Active on.**
   Explain only that Saga can add accepted lore to the next prompt.

2. **Choose a Loredeck.**
   Offer bundled decks first. For the HP reference family, use a simple picker such as "Core + Year 6" instead of making a novice understand stack composition immediately.

3. **Set story position.**
   Use the Context Browser as the trusted path. The primary control should be "Start Here" or "Use This Context." Model detection is secondary.

4. **Review Lorecards.**
   Show relevant suggestions and Pending Review in one place. The user accepts only cards that should affect future responses.

5. **Continue and update when the story changes.**
   Give the user two clear repeat actions: "Set Context again" for timeline jumps and "Scan recent story" for durable chat-specific facts if a provider is configured.

### Basic Loredecks

Basic Loredecks should focus on loading and trust:

- Show Active Stack first.
- Show "Add Loredeck" as the main action.
- Offer curated bundled deck combinations.
- Use plain readiness badges: Ready, Needs review, Not checked.
- Keep full Library, folders, import/export, updates, details, and health actions reachable but visually secondary.
- Do not require users to know Bundled, Generated, and Custom on the first screen. Use those labels in details, not as the first decision.
- If no bundled deck matches the user's fandom, route to "Create or import a Loredeck" with a short explanation that this is an Advanced path.

### Basic Context

Basic Context should be manual-first:

- Show loaded Loredecks and their current Context.
- Primary action: Browse Story Waypoints.
- Secondary action: Detect Context.
- Keep Advanced Context Brief collapsed or hidden.
- Use "Story position" copy alongside "Context" where it helps comprehension.
- If Context detection returns uncertain output, show it as a proposal, not as an applied truth.
- Keep manual locks implicit in Basic: when the user chooses a Context manually, protect it from automatic overwrite.

### Basic Review

Basic Review should combine the pieces a new user expects:

- Suggested Lorecards for current Context.
- Pending Review.
- Accepted Lorecards.
- Manual "Add Lorecard" for a fact the user knows matters.
- A simple "Scan recent story" action if a provider is configured.

The primary review question should be:

```text
Should this fact affect future responses?
```

Basic should not foreground source metadata, routing, similarity decisions, generated operation types, bulk repair machinery, or timeline event history. Keep those details available through "Details" or Advanced.

### Basic Injection Summary

Basic should not have a dedicated Prompt or Injection tab. A compact injection summary should appear inside Start and Review instead.

The Basic injection summary should answer:

- Is lore injection on?
- How many accepted Lorecards are selected for the next prompt?
- Is the selected lore within a reasonable token estimate?
- Is anything obvious blocked by Context, muted, or disabled?
- Where can the user switch to Advanced for the full Injection Preview?

Default Basic injection profile:

- Lore injection on.
- Continuity injection off.
- High relevance on and direct.
- Normal relevance on and direct.
- Low relevance off.
- Prompt placement hidden.
- Compression controls hidden unless token pressure is visible.

This matches the current `BASIC_EXPERIENCE_SETTINGS` direction and should remain conservative.

### Basic Settings

Basic Settings should expose:

- Provider quick setup.
- Test provider connection.
- Appearance/theme selection.
- Experience Mode switch.
- Reset layout.

Hide or collapse:

- Multiple provider profile internals.
- Generation parameters.
- API compatibility flags.
- Raw prompt templates.
- Automation cadence.
- Developer diagnostics.

If a Basic action requires a provider, say so at the point of action: "Provider needed for Scan recent story." Do not force provider setup before a user can load decks, set Context, review existing Lorecards, or inject accepted lore.

### Basic Defaults

Basic should remain safe and quiet:

- `automationMode`: `manual`
- `contextDetectionMode`: `manual`
- `loreGenerationMode`: `manual`
- `continuityTrackingMode`: `manual`
- `canonLoreAutoPropose`: `false`
- `autoRelevanceEnabled`: `false`
- `injectLore`: `true`
- `injectContinuity`: `false`
- `loreLowInjectionEnabled`: `false`

When switching from Advanced to Basic, keep the existing backup-and-restore approach for managed settings. Basic can overwrite the active profile because the project is pre-alpha, but it should not strand advanced users who temporarily switch modes.

### Basic Copy Rules

Use concrete action labels:

- "Choose Loredeck"
- "Set Context"
- "Review Lorecards"
- "See what Saga will send"
- "Scan recent story"
- "Add Lorecard"

Avoid first-screen labels such as:

- "Resolver audit"
- "Context-native eligibility"
- "Schema v3"
- "Compression depth"
- "Similarity routing"
- "Timeline registry"
- "Extraction strategy"

Those are valid Advanced terms, not Basic onboarding terms.

## Advanced Experience Plan

### Advanced Navigation

Recommended Advanced rail:

1. **Loredecks**
2. **Session**
3. **Context**
4. **Continuity**
5. **Lorecards**
6. **Injection**
7. **Settings**

This matches the current Saga direction: Loredecks come first because the Active Stack determines what Context, retrieval, and injection mean.

### Advanced Session

Advanced Session should include:

- Saga Active.
- Experience Mode.
- Automation Mode: Manual, Assisted, Automatic.
- Runtime metrics.
- Guide grouped by workflow, not a long linear tutorial.
- Destructive cleanup actions.
- Diagnostic status for active chat, state keys, and pending work where useful.

Automation Mode should stay Advanced-visible by default. A Basic user can use manual buttons without understanding automation cadence.

### Advanced Loredecks

Advanced Loredecks should expose the full Library and source-deck toolchain:

- Active Stack ordering, enable/disable, priority, drag/drop, and folder stack items.
- Bundled, Custom, Generated, imported, duplicated, and finalized decks.
- Full Library, folders, multi-select, details, covers, metadata, source/update state.
- `.saga-loredeck.zip` import/export.
- Update/reinstall previews and local modification warnings.
- Duplicate as Custom.
- Generated-to-Custom finalization.
- Deck Health launch points.
- Loredeck Creator launch points.
- Workbench editor launch points.

### Advanced Context

Advanced Context should expose:

- Per-Loredeck Context rows.
- Manual locks.
- Context Browser.
- Local resolver.
- Reasoner fallback.
- Candidate confidence.
- Context source and audit details.
- After/before windows.
- Context reset.
- Timeline and alias authoring routes for Custom/Generated decks.
- Model proposal review before applying uncertain Context.

The Advanced user should be able to answer why a Lorecard is eligible or blocked.

### Advanced Continuity

Advanced should own the Continuity tab:

- Manual and automatic continuity scan controls.
- Scan scope: recent, custom range, entire chat.
- Chunking, overlap, concurrency, retries, checkpoint recovery.
- Tracked sections.
- Active Characters, scene/timeline, items, threads, objectives.
- Emotional freshness.
- Continuity injection preview and controls.

Keep continuity distinct from durable Lorecards. Continuity is live scene state; Lorecards are durable story or deck lore.

### Advanced Lorecards

Advanced Lorecards should expose:

- Suggested Lorecards.
- Pending Review.
- Accepted Lorecards.
- Manual Lorecard creation.
- Story-lore generation and scan controls.
- Canon/stack preview controls until the UI is fully renamed to stack-native suggestions.
- Similarity routing and duplicate guards.
- Quality gates.
- Source metadata.
- Bulk actions.
- Workbenches.
- Timeline recovery.
- Auto-Relevance.
- Pin, mute, relevance tiers, tags, and metadata editing.

Any model-produced proposal should remain review-first.

### Advanced Injection

Advanced Injection should expose:

- Continuity and Lore toggles.
- High, Normal, Low relevance tiers.
- Direct versus compressed handling.
- Prompt role, position, and depth.
- Prompt transport.
- Compression prompt templates.
- Token and character estimates.
- Split previews.
- Combined preview.
- Audit reasons for omitted Lorecards: muted, disabled tier, Context blocked, stack disabled, token pressure, or not selected.

This is the main debugging surface when the model ignores or overuses lore.

### Advanced Settings

Advanced Settings should expose:

- Utility provider.
- Reasoning provider.
- Connection profiles.
- Model parameters.
- API key storage and test actions.
- Theme Packs.
- Icon Sets.
- Color overrides.
- Accessibility checks.
- Developer or diagnostic settings where needed.

Settings should stay in the runtime shelf, not the legacy extension dropdown.

### Advanced Guide Structure

The Advanced guide should not be one huge walkthrough. It should be grouped into task tracks:

- Runtime setup.
- Stack and Context.
- Review and injection.
- Continuity.
- Loredeck authoring.
- Creator and Assistant.
- Deck Health and repair.
- Import/export/update.
- Diagnostics.

Each track should have a short "Open related controls" action. Advanced users need fast routing more than hand-holding.

## Graduation Path

Basic should include explicit, respectful Advanced entry points:

- "Need automation or continuity? Switch to Advanced."
- "Need to import, export, repair, or create Loredecks? Open Advanced tools."
- "Need prompt placement or compression controls? Switch to Advanced."

When a Basic user switches to Advanced:

- Keep their active stack.
- Keep selected Context.
- Keep accepted and pending Lorecards.
- Restore backed-up advanced settings when available.
- Land them on the equivalent Advanced tab when possible.

When an Advanced user switches to Basic:

- Apply the Basic managed settings profile.
- Hide advanced tabs and controls.
- Keep all saved data.
- Preserve an advanced settings backup for later restoration.
- If the active Advanced tab is hidden in Basic, land on Start.

## Implementation Plan

### Phase 1: Audit And Rename The Experience Surface

- Confirm every visible Basic tab label and tooltip uses Saga-native language.
- Rename Basic `Session` presentation to `Start` if mode-specific labels are feasible.
- Rename Basic `Lorecards` presentation to `Review` if mode-specific labels are feasible.
- Hide the Basic `Injection` tab and replace it with compact injection status in Start and Review.
- Remove or rewrite old Wandlight/Saga legacy copy in the Basic guide, especially "legacy global Context Brief" and "canon packs" framing where active-stack Lorecards are now the source of truth.
- Keep internal IDs stable unless a cleanup pass deliberately removes old names.

### Phase 2: Rebuild Basic Start

- Replace the current instructions-heavy Basic Start area with a readiness checklist.
- Add one recommended next action derived from current state.
- Keep Saga Active and Session Metrics, but make them secondary to next action.
- Keep the Basic walkthrough collapsed and short.
- Show provider setup as optional unless the next action needs a provider.

### Phase 3: Shorten Basic Walkthrough

- Replace the current Basic guide step list with the six-step flow in this plan.
- Keep each step action-oriented.
- Ensure every step lands on a visible Basic tab.
- Avoid Advanced-only targets in Basic guide steps.
- Add empty-state copy for each step.

### Phase 4: Simplify Basic Loredeck And Context Paths

- Make "Choose Loredeck" and "Set Context" the first two successful actions.
- Add curated bundled deck combinations where the bundled family supports it.
- Make Context Browser the primary trusted selector.
- Keep Reasoner detection secondary and reviewable.
- Apply manual lock when a Basic user selects Context manually.

### Phase 5: Simplify Basic Review And Injection Status

- Present suggested, pending, and accepted Lorecards as one review workflow.
- Keep single-entry accept/dismiss/edit clear and visible.
- Hide bulk and metadata-heavy operations behind Advanced or details.
- Add a compact "what Saga will send" summary to Start and Review.
- Route users who need full prompt preview, placement, compression, or tier tuning to Advanced.
- Keep Low relevance hidden or off by default.

### Phase 6: Reframe Advanced Guide

- Replace the long linear Advanced walkthrough with task tracks.
- Keep all current advanced controls reachable.
- Add "why did this inject?" and "why did this not inject?" routing from Injection to Context, Lorecards, and Active Stack.
- Add direct routing to workbenches and health/repair tools.

### Phase 7: Documentation

- Split release-facing user docs into:
  - `docs/user/BASIC_WORKFLOW.md`
  - `docs/user/ADVANCED_WORKFLOW.md`
  - `docs/user/WANDLIGHT_TO_SAGA.md`
- Update README Quick Start to point new users to Basic Workflow first.
- Keep development details in `docs/development`.
- Keep schema and authoring details in `docs/loredecks`.

### Phase 8: Validation

Add or update checks for:

- Basic mode visible tabs.
- Advanced mode visible tabs.
- Switching Basic -> Advanced -> Basic preserves stack, Context, pending, accepted, and backup settings.
- Basic guide steps target only visible Basic controls.
- Basic Start next-action derivation for empty stack, missing Context, pending review, accepted lore, and ready prompt.
- Basic mode hides the Injection tab while still showing selected-lore status.
- Basic settings profile keeps automation off and lore injection on.
- Advanced restores backed-up managed settings.

Run visual smoke for:

- First-run Basic empty state.
- Basic with HP Core + Year deck loaded.
- Basic Context Browser selection.
- Basic Review accepting a Lorecard.
- Basic Start/Review selected-lore summary.
- Advanced full rail.
- Advanced automation, continuity, Deck Health, Creator, and Injection controls.

## Acceptance Criteria

Basic is successful when a new user can:

- Open Saga.
- Load a bundled Loredeck or curated bundled deck combination.
- Set story Context manually.
- Review and accept relevant Lorecards.
- See whether accepted Lorecards are selected for the next prompt without opening a separate Injection tab.
- Continue roleplay without touching automation, continuity, prompt placement, schema, tags, health diagnostics, or raw JSON.

Advanced is successful when a fluent user can:

- Configure providers and automation.
- Manage a multi-deck Active Stack.
- Resolve or audit Context.
- Track continuity.
- Generate, review, edit, and tier Lorecards.
- Inspect and tune prompt injection.
- Validate and repair Loredecks.
- Create, import, export, update, duplicate, and finalize decks.
- Diagnose why a card did or did not affect the prompt.

The overall system is successful when both modes share one data model and one runtime loop, with Basic acting as a guided lane through the core loop and Advanced acting as the full instrumentation and authoring surface around it.
