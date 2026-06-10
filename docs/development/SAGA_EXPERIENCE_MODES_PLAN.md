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
- Pack Health diagnostics beyond readiness summaries.
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
- Pack Health Center diagnostics and repair routing.
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

1. **Session**
2. **Loredecks**
3. **Context**
4. **Lorecards**
5. **Settings**

Basic should use the same tab labels as Advanced so users do not learn one vocabulary and then unlearn it later:

| Internal Area | Visible Label | Basic Purpose |
| --- | --- | --- |
| `session` | Session | Start Checklist, status, next action, walkthrough, Saga Active |
| `loredecks` | Loredecks | Load deck, see active stack, open library when needed |
| `context` | Context | Choose or detect story position |
| `lore` | Lorecards | Review suggested, generated, manual, and accepted Lorecards |
| `settings` | Settings | Providers and Theme Pack |

Hide the `continuity` and `injection` tabs in Basic. Current-scene continuity is useful, but it is a second mental model. Full injection tuning is useful, but it is a diagnostic and control surface, not a required novice workflow. Basic should not add a separate prompt-status summary section; exact prompt inspection belongs in Advanced Injection.

### Basic Session Checklist

The Session tab should keep its Advanced name and include a Basic-only **Start Checklist** dropdown near the top, expanded by default.

Show a compact readiness checklist:

| Check | Ready State | Missing State | Primary Action |
| --- | --- | --- | --- |
| Saga Active | Saga is active | Saga is paused | Enable Saga |
| Loredeck in stack | Active Stack has at least one enabled deck | Open Loredeck Library and add a deck to the stack | Open Library |
| Story Context set | Loaded deck has current Context | Story position missing | Set Context |
| Lorecards reviewed | Accepted Lorecards exist or relevant pending/proposed Lorecards are available | Nothing accepted yet | Review Lorecards |
| Lore ready | Accepted Lorecards are selected for injection | Nothing selected for prompt | Review Lorecards |
| Provider optional | Provider configured for model-assisted actions | Provider not configured | Configure provider |

Below the checklist, show one recommended next action. Examples:

- "Open Library" when the stack is empty.
- "Set story position" when a deck is loaded but Context is missing.
- "Review suggested Lorecards" when Context produces candidates.
- "Continue roleplay" when the prompt is ready.

Do not make users read a long feature explanation before acting.

### Basic Walkthrough

Detailed ordered coverage now lives in [Saga Walkthrough Workflow Expansion Plan](SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md). That plan supersedes the earlier fixed-size target; Basic should be coverage-driven, not capped by a maximum guide count.

The Basic walkthrough should stay focused, but it should not be a single compressed first-run list. For Alpha, it is grouped by visible Basic tab sections:

- **Loredecks**: open the Library, import a deck package when needed, build the active stack, and understand Pack Health/active counts.
- **Session**: keep Saga Active, use the Start Checklist, understand the continue/update loop, and read Session Metrics.
- **Context**: use Runtime Context, Browse Context, Detect Context, and verify loaded Loredeck Context rows.
- **Lorecards**: use Lorecard Generation, preview canon packs, scan story lore, add a manual Lorecard, review Pending Lorecards, and inspect Accepted Lorecards.
- **Settings**: confirm Providers and Theme Pack.

The Session guide card should present these as smaller tab-section mini walkthroughs, not as one visible list of every "Show" highlight target.

### Basic Loredecks

Basic Loredecks should teach the same Library workflow as Advanced:

- Show the same **Loredeck Library** section as Advanced.
- Keep **Import Deck** visible in Basic.
- Hide **Create Deck** and **In-Progress Creator Projects** in Basic.
- Keep the shared Library section name, order, and launch card structure as Advanced.
- Do not rename the shared Library action to a Basic-only label.
- Do not add a separate Basic stack card or Basic-only readiness badges.
- Keep deeper Library, folders, import/export, updates, details, and health reachable through the same shared surfaces.
- Move Creator creation and resume workflows to Advanced.
- If a later pass reduces visible complexity here, reduce by collapsing or hiding sections without changing the learned workflow.

The key constraint is transfer learning: Basic can remove or collapse sections, but it should not teach a different Loredecks tab that users must unlearn when they switch to Advanced.

### Basic Context

Basic Context should be manual-first:

- Show loaded Loredecks and their current Context.
- Primary action: Browse Context.
- Secondary action: Detect Context.
- Keep Advanced Context Brief collapsed or hidden.
- Use "Story position" copy alongside "Context" where it helps comprehension.
- If Context detection returns uncertain output, show it as a proposal, not as an applied truth.
- Keep manual locks implicit in Basic: when the user chooses a Context manually, protect it from automatic overwrite.

### Basic Lorecards

Basic Lorecards should combine the pieces a new user expects:

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

### Basic Injection Visibility

Basic should not have a dedicated Prompt or Injection tab, and it should not show a separate selected-lore prompt-status summary section.

Basic should rely on:

- Start Checklist readiness.
- Lorecards review and accepted counts.
- Advanced Injection for exact prompt preview, placement, compression, and tier controls.

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
- Full shared Theme Pack controls.
- Advanced handoff for full provider controls.

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

- "Open Library"
- "Set Context"
- "Review Lorecards"
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
- Pack Health launch points.
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

Detailed ordered Advanced module coverage now lives in [Saga Walkthrough Workflow Expansion Plan](SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md). That plan supersedes a single long linear walkthrough and defines the task tracks in implementation order.

The Advanced guide should not be one huge walkthrough. It should be grouped into task tracks:

- Runtime setup.
- Stack and Context.
- Review and injection.
- Continuity.
- Loredeck authoring.
- Creator and Assistant.
- Pack Health and repair.
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
- If the active Advanced tab is hidden in Basic, land on Session.

## Implementation Plan

### Phase 1: Audit And Align The Experience Surface

- Confirm every visible Basic tab label and tooltip matches the shared Advanced workflow language.
- Do not rename Basic `Session` to `Start`.
- Do not rename Basic `Lorecards` to `Review`.
- Hide the Basic `Injection` tab without adding a separate Basic prompt-status summary.
- Remove or rewrite old Wandlight/Saga legacy copy in the Basic guide, especially "legacy global Context Brief" and "canon packs" framing where active-stack Lorecards are now the source of truth.
- Keep internal IDs stable unless a cleanup pass deliberately removes old names.

### Phase 2: Add Basic Start Checklist To Session

- Add a Basic-only Start Checklist dropdown to the Session tab, expanded by default.
- Add one recommended next action derived from current state.
- Keep Saga Active and Session Metrics, but make them secondary to next action.
- Keep the Basic walkthrough collapsed and short.
- Show provider setup as optional unless the next action needs a provider.

### Phase 3: Section Basic Walkthrough

- Replace the current Basic guide step list with the tab-section walkthrough structure in this plan.
- Keep the full Basic tour action-oriented and workflow-complete, without a fixed maximum step count.
- Ensure every Basic step lands on a visible Basic tab.
- Render mini walkthrough starters by tab section instead of one visible list of every target.
- Avoid Advanced-only targets in Basic guide steps.
- Add empty-state copy for each step where the target can be absent.

### Phase 4: Simplify Basic Loredeck And Context Paths

- Make "Open Library" and "Set Context" the first two successful actions.
- Keep the shared Loredeck Library path intact so Basic users learn the same loading workflow as Advanced users.
- Make Context Browser the primary trusted selector.
- Keep Reasoner detection secondary and reviewable.
- Apply manual lock when a Basic user selects Context manually.

### Phase 5: Simplify Basic Lorecards And Injection Status

- Present suggested, pending, and accepted Lorecards as one review workflow.
- Keep single-entry accept/dismiss/edit clear and visible.
- Hide bulk and metadata-heavy operations behind Advanced or details.
- Keep prompt-status summaries out of Basic.
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
- Basic Start Checklist next-action derivation for empty stack, missing Context, pending review, accepted lore, and ready prompt.
- Basic mode hides the Injection tab while still showing selected-lore status.
- Basic settings profile keeps automation off and lore injection on.
- Advanced restores backed-up managed settings.

Run visual smoke for:

- First-run Basic empty state.
- Basic with HP Core + Year deck loaded.
- Basic Context Browser selection.
- Basic Lorecards accepting a Lorecard.
- Basic Session and Lorecards without selected-lore summary sections.
- Advanced full rail.
- Advanced automation, continuity, Pack Health, Creator, and Injection controls.

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
