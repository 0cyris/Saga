<p align="center">
  <img src="assets/branding/saga-banner-full.png" alt="SAGA: Fandom Loresystem">
</p>

# SAGA

**SAGA: Fandom Loresystem.**

Saga is a SillyTavern extension for long-form fandom roleplay and fanfiction. It turns canon, alternate-universe, crossover, and user-created lore into modular **Loredecks**, reviewable **Lorecards**, context-aware retrieval, and prompt-ready injection.

Saga is not a wiki viewer and not a prompt preset. It is a runtime lore system for deciding what belongs in the story **now**: what is true, what is hidden, what has changed in this chat, and what the model should actually see before writing the next response.

## Status

Saga is in **pre-alpha integration hardening**.

The main systems exist and are being made reliable together: the runtime shelf, Basic and Advanced experiences, Loredeck Library, Active Stack, Context, Pack Health, Loredeck Creator, Pending Review, Continuity, Injection, import/export, and theme/icon support.

Expect active development, incomplete workflows, changing schemas, rough edges, and possible breakage. The recommended tester path is: start in **Basic**, get one chat working, then switch to **Advanced** when you need diagnostics, Creator workflows, Pack Health, Continuity, or full Injection controls.

## Contents

- [Fast Start](#fast-start)
- [What Saga Adds](#what-saga-adds)
- [Mental Model](#mental-model)
- [Operator's Manual](#operators-manual)
- [Documentation](#documentation)
- [For Contributors](#for-contributors)
- [Project Layout](#project-layout)
- [Authoring Loredecks](#authoring-loredecks)

## Fast Start

<p align="center">
  <img src="assets/documentation/renders/docs-shell-basic-start.png" alt="Saga Basic start checklist and runtime shelf" width="800">
</p>

1. Copy the Saga GitHub URL:

   ```text
   https://github.com/MentallyQuill/Saga
   ```

2. In SillyTavern, open **Extensions** and use **Install Extension** with the copied URL. Reload the page.
3. The Saga shelf should load on the left of the page. If it does not, open it from the **SAGA** extension dropdown: **Open SAGA Window**.
4. Start in **Basic Workflow**. Go to the **Session** tab, follow the **Start Checklist**, and consider viewing the **Basic Walkthrough** below it.

For guided walkthroughs, see [Basic Workflow](docs/user/BASIC_WORKFLOW.md) and [Advanced Workflow](docs/user/ADVANCED_WORKFLOW.md). The in-app walkthroughs are module-based: run the full pass, or start the exact workflow card you need.

## What Saga Adds

| Surface | What it does |
| --- | --- |
| **Loredecks** | Portable lore packages for fandom canon, AU branches, crossover rules, original settings, or user edits. |
| **Lorecards** | Reviewable facts and constraints that are focused enough to affect a scene. |
| **Context** | Story position: date, book, arc, chapter, episode, route, quest stage, stardate, or another coordinate system. |
| **Active Stack** | The ordered set of loaded Loredecks for the current chat. |
| **Pending Review** | A safety layer where generated or edited lore waits before becoming accepted content. |
| **Injection** | The final prompt layer that sends only eligible, relevant lore to the model. |
| **Pack Health** | Structural validation for Loredecks, tags, manifests, timelines, and Context references. |
| **Loredeck Creator** | A staged, review-first workflow for generating new Loredecks without one giant prompt. |

## Mental Model

Saga's main runtime path is:

```text
Loredeck Library -> Active Stack -> Context -> Lorecards -> Injection -> Model response
```

Saga's review path is:

```text
Generate or edit -> Pending Review -> Accept -> Pack Health -> Use in chat
```

The important rule is simple: source lore, generated drafts, accepted chat lore, live continuity, and prompt injection are separate layers. Saga is useful because it keeps those layers visible instead of silently mixing them together.

## Operator's Manual

### First Run Checklist

Basic Experience keeps the first-run path narrow. The Start Checklist is the operator's quick answer to: "Is Saga ready to influence this chat?"

Use it to confirm that Saga is active, Loredecks are loaded, Context is set, Lorecards are available, and injection has something useful to send.

<p align="center">
  <img src="assets/documentation/renders/docs-basic-walkthrough-modules.png" alt="Saga Basic Walkthrough module cards" width="800">
</p>

The **Basic Walkthrough** is organized as a short roleplay loop: First Run, Loredecks, Context, Lorecards, Continue Roleplay, and Settings. Use **Start Basic Walkthrough** for the first pass, or start a module when you only need one part of the setup loop.

### Session

<p align="center">
  <img src="assets/documentation/renders/docs-session-advanced-status.png" alt="Saga Advanced session controls and status" width="800">
</p>

The **Session** tab is the runtime control room. It shows the current experience mode, automation state, readiness, and active system status.

Use **Basic** when you want the guided path. Use **Advanced** when you need to inspect automation, run diagnostics, work with Continuity, manage prompt injection, or operate the Loredeck Creator.

<p align="center">
  <img src="assets/documentation/renders/docs-advanced-walkthrough-modules.png" alt="Saga Advanced Walkthrough task tracks" width="800">
</p>

The **Advanced Walkthrough** is organized as task tracks instead of a flat tab tour. It covers Library mastery, Session control, Context resolution, Lorecard review, Injection diagnostics, Continuity, Creator authoring, Pack Health and package work, Settings, and troubleshooting.

### Loredecks And Active Stack

<p align="center">
  <img src="assets/documentation/renders/docs-loredecks-overview.png" alt="Saga Loredecks tab overview" width="800">
</p>

A **Loredeck** is a portable, data-only lore package. It can represent canon, AU material, crossover logic, original setting lore, scenario rules, or user-authored additions.

<p align="center">
  <img src="assets/documentation/renders/docs-loredecks-library-launch.png" alt="Saga Loredeck Library launcher card" width="700">
</p>

Saga uses three public Lorepack types:

- **Bundled Lorepack**: shipped with Saga and human-vetted.
- **Generated Lorepack**: produced by the Loredeck Creator and still review-oriented.
- **Custom Lorepack**: user-created, duplicated, imported, edited, AU, crossover, or shared.

<p align="center">
  <img src="assets/documentation/renders/docs-loredeck-library-overview.png" alt="Saga Loredeck Library workbench" width="800">
</p>

The **Loredeck Library** is the long-term home for browsing, organizing, importing, exporting, duplicating, inspecting, and validating Loredecks.

<p align="center">
  <img src="assets/documentation/renders/docs-loredeck-library-active-stack.png" alt="Saga Active Stack panel" width="650">
</p>

The **Active Stack** is the ordered set of Loredecks loaded into the current chat. Stack priority matters when multiple decks can contribute lore. Enable, disable, reorder, or remove stack items to control what participates in Context, retrieval, and Injection.

<p align="center">
  <img src="assets/documentation/renders/docs-loredeck-library-selected-details.png" alt="Saga selected Loredeck details panel" width="800">
</p>

The selected Loredeck details area is where operators inspect metadata, source type, health state, stats, and deck actions. Use it before trusting a deck in a long-running story.

### Pack Health

<p align="center">
  <img src="assets/documentation/renders/docs-pack-health-overview.png" alt="Saga Pack Health overview" width="800">
</p>

**Pack Health** validates whether Saga can reliably load and reason over a Loredeck. It checks manifests, embedded metadata, entry structure, tag registries, timeline references, Context gates, stats, and other structural expectations.

Pack Health is not a canon-truth oracle. A clean report means the deck is structurally usable. It does not prove every lore claim is perfect.

<p align="center">
  <img src="assets/documentation/renders/docs-pack-health-issues.png" alt="Saga Pack Health grouped issues table" width="800">
</p>

The Issues view groups related findings so deck authors can repair problems systematically. Run Pack Health after importing, generating, duplicating, finalizing, or heavily editing a Loredeck.

### Loredeck Creator

<p align="center">
  <img src="assets/documentation/renders/docs-loredeck-creator-intake.png" alt="Saga Loredeck Creator intake screen" width="800">
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
  <img src="assets/documentation/renders/docs-loredeck-creator-current-task.png" alt="Saga Loredeck Creator current task area" width="800">
</p>

Generated material remains draft material until reviewed. A Generated Lorepack should become a Custom Lorepack only after its entries, Context, tags, and Pack Health are good enough to use.

### Context

<p align="center">
  <img src="assets/documentation/renders/docs-context-command-center.png" alt="Saga Context command center" width="800">
</p>

**Context** tells Saga where the current chat is inside each loaded Loredeck. It can be a date, anchor, chapter, book, arc, phase, route, season, quest stage, stardate, or custom coordinate system.

Context is how Saga avoids injecting lore too early, too late, or from the wrong branch of a story.

<p align="center">
  <img src="assets/documentation/renders/docs-context-loaded-loredecks.png" alt="Saga loaded Loredeck Context rows" width="800">
</p>

Loaded Loredeck Context rows show which decks have Context, whether that Context is manual or detected, and whether the operator locked it.

<p align="center">
  <img src="assets/documentation/renders/docs-context-workbench.png" alt="Saga Context workbench" width="800">
</p>

The Context workbench supports browsing and selecting story positions from loaded Loredecks.

<p align="center">
  <img src="assets/documentation/renders/docs-context-proposal-review.png" alt="Saga Context proposal review" width="800">
</p>

When Saga proposes Context changes, review them before applying. Reasoner output should guide the operator, not silently change the story's active position.

### Lorecards

<p align="center">
  <img src="assets/documentation/renders/docs-lorecards-overview.png" alt="Saga Lorecards tab overview" width="800">
</p>

A **Lorecard** is one reviewable unit of lore. It should be narrow enough to retrieve precisely and important enough to affect the next scene.

Good Lorecards are not broad wiki summaries. They describe specific facts, constraints, reveals, relationship states, knowledge boundaries, abilities, location conditions, or timeline events.

<p align="center">
  <img src="assets/documentation/renders/docs-lorecards-pending-review.png" alt="Saga Pending Lorecard Review section" width="800">
</p>

**Pending Review** is where generated or proposed Lorecards wait. Accept only content that should affect future responses. Reject or revise anything that is vague, premature, duplicated, too broad, or wrong for the current branch.

<p align="center">
  <img src="assets/documentation/renders/docs-lorecards-accepted-list.png" alt="Saga accepted Lorecards list" width="800">
</p>

Accepted Lorecards can be filtered by relevance, pinned, muted, edited, or inspected. Relevance tiers help Saga decide what deserves prompt space now.

<p align="center">
  <img src="assets/documentation/renders/docs-lorecards-workbench.png" alt="Saga Lorecard Workbench" width="800">
</p>

The Lorecard Workbench is for heavier review and batch management.

<p align="center">
  <img src="assets/documentation/renders/docs-lore-timeline.png" alt="Saga Lore Timeline" width="800">
</p>

The Lore Timeline shows how lore changed over time: accepted entries, rejected drafts, pin/mute changes, restores, and other review events.

### Continuity

<p align="center">
  <img src="assets/documentation/renders/docs-continuity-overview.png" alt="Saga Continuity tab overview" width="800">
</p>

Saga separates durable lore from live continuity. Lorecards are long-term facts and constraints. Continuity is lightweight current state: scene, characters, items, objectives, and active threads.

<p align="center">
  <img src="assets/documentation/renders/docs-continuity-scan.png" alt="Saga Continuity Scan controls" width="800">
</p>

Continuity scans help update live state from recent chat. Use them to keep the current scene coherent, not to build a second static lore database.

<p align="center">
  <img src="assets/documentation/renders/docs-continuity-character-state.png" alt="Saga active character continuity state" width="800">
</p>

Character state is for what is currently true in the chat: location, posture, clothing, physical state, emotional state, carried items, goals, and immediate notes.

### Injection

<p align="center">
  <img src="assets/documentation/renders/docs-injection-overview.png" alt="Saga Injection tab overview" width="800">
</p>

**Injection** is the final operator truth source for what Saga will send to the model. A Lorecard can exist, be accepted, and still not inject if it is muted, out of Context, disabled, lower priority, or outside the configured prompt budget.

<p align="center">
  <img src="assets/documentation/renders/docs-injection-placement.png" alt="Saga prompt placement controls" width="800">
</p>

Prompt placement controls decide where Continuity and each Lorecard relevance tier are inserted into the model context.

<p align="center">
  <img src="assets/documentation/renders/docs-injection-high-preview.png" alt="Saga High-Relevance Lore Injection preview" width="800">
</p>

The preview shows the actual text Saga is preparing for injection. Use it when debugging "why did the model know this?" or "why did the model forget this?"

### Settings, Providers, Themes

<p align="center">
  <img src="assets/documentation/renders/docs-settings-providers.png" alt="Saga provider settings" width="800">
</p>

Saga is model/provider agnostic. Use stronger reasoning models for Context proposals, Creator planning, and complex repairs. Use faster utility models for smaller, lower-risk suggestions. Treat all model output as draft until reviewed.

<p align="center">
  <img src="assets/documentation/renders/docs-settings-theme-pack.png" alt="Saga Theme Pack settings" width="800">
</p>

Theme Packs and Icon Sets are passive data. They can change the shelf's appearance without running code.

### Troubleshooting

| Problem | First check |
| --- | --- |
| Saga shelf does not open | Confirm the extension was installed from the Saga GitHub URL in SillyTavern's Extension installer, then reload SillyTavern. |
| No Loredecks are active | Open Loredecks, then Loredeck Library, and add a Loredeck to the Active Stack. |
| Lore seems from the wrong point in the story | Open Context and check the active Context for each loaded Loredeck. |
| Accepted Lorecards are not reaching the model | Open Injection and inspect the relevance preview, pin/mute state, Context gate, and injection enable toggles. |
| Imported or generated deck behaves strangely | Run Pack Health and review grouped issues. |
| Model-assisted actions fail | Check provider settings, model availability, and whether the action requires Utility or Reasoning configuration. |

## Documentation

Release-facing docs:

- [Documentation Index](docs/DOCUMENTATION_INDEX.md)
- [Basic Workflow](docs/user/BASIC_WORKFLOW.md)
- [Advanced Workflow](docs/user/ADVANCED_WORKFLOW.md)
- [Wandlight To Saga](docs/user/WANDLIGHT_TO_SAGA.md)
- [Loredeck And Lorecard Creation](docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md)
- [LLM Loredeck Generation Guide](docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md)
- [Loredeck Schema Reference](docs/loredecks/SAGA_LOREDECK_SCHEMA.md)
- [Saga Terminology](docs/development/SAGA_TERMINOLOGY.md)

Development notes live in [docs/development](docs/development/) until promoted, rewritten, or archived as release-facing docs.

## For Contributors

HP reference deck health and conformance:

```powershell
node tools\scripts\test-hp-loredeck-health.mjs
node tools\scripts\test-hp-loredeck-v3-conformance.mjs
node tools\scripts\test-hp-reference-deck-conformance.mjs
```

Context-sensitive checks:

```powershell
node tools\scripts\test-context-hp-phrase-fixtures.mjs
node tools\scripts\test-context-current-contract.mjs
```

Visual smoke checks:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\serve-visual-smoke.mjs --check --port 0
```

Local visual smoke server:

```powershell
node tools\scripts\serve-visual-smoke.mjs
```

Then open:

```text
http://127.0.0.1:8765/tests/browser/visual-smoke.html
```

## Project Layout

```text
content/loredecks/      Bundled Lorepack data and index.
assets/                 Branding, icons, screenshots, and passive assets.
content/presets/        Optional provider/preset data.
docs/loredecks/         Release-facing Loredeck authoring docs.
docs/development/       Planning, audits, runbooks, and implementation notes.
tools/scripts/          Local tests, smoke helpers, and deck maintenance scripts.
tests/                  Visual smoke harness fixtures.
```

Important runtime modules:

- `src/extension/index.js`: extension entrypoint and SillyTavern integration.
  `manifest.json` points here directly.
- `src/runtime/lore-panel.js`: current runtime shell/controller while decomposition continues.
- `src/loredecks/loredeck-loader.js`: Loredeck loading, validation, Context, tags, and Pack Health behavior.
- `src/loredecks/loredeck-library-panel.js`: Library UI.
- `src/loredecks/loredeck-health-panel.js`: Pack Health UI.
- `src/loredecks/loredeck-assistant.js`: model-assisted Creator and Lore Assistant prompt builders.
- `src/loredecks/loredeck-creator-projects.js`: Creator project state and review-stage helpers.
- `src/context/context-resolver.js`: Context resolution logic.
- `src/context/context-index.js`: searchable Context index over loaded decks.
- `src/continuity/prompt-injector.js`: prompt injection bridge.
- `src/state/state-manager.js`: persisted Saga state.

## Authoring Loredecks

Start with:

- [Loredeck And Lorecard Creation](docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md)
- [LLM Loredeck Generation Guide](docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md)
- [Loredeck Schema Reference](docs/loredecks/SAGA_LOREDECK_SCHEMA.md)

Reference-quality decks should be data-only, Context-aware, reviewable, and clean under Pack Health. Do not treat parsed JSON as finished content. A deck is ready to model future work only when it loads cleanly, retrieves at the right Context, keeps future lore gated, and has no outstanding health issues.

## License

See [LICENSE](LICENSE).
