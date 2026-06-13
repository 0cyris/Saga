<p align="center">
  <img src="assets/branding/saga-banner-full.png" alt="SAGA: Fandom Loresystem">
</p>

# SAGA

**SAGA: Fandom Loresystem.**

Saga is a SillyTavern extension for long-form fandom roleplay and fanfiction. It turns canon, alternate-universe, crossover, and user-created lore into modular **Loredecks**, reviewable **Lorecards**, context-aware retrieval, and prompt-ready injection.

Saga is not a wiki viewer and not a prompt preset. It is a runtime lore system for deciding what belongs in the story **now**: what is true, what is hidden, what has changed in this chat, and what the model should actually see before writing the next response.

## Status

Saga is in **pre-alpha integration hardening**. Current extension metadata uses `0.1.0-alpha.1`, requires SillyTavern `1.12.0` or newer, and keeps `auto_update` disabled so alpha testers update deliberately.

The main systems exist and are being made reliable together: the runtime shelf, Basic and Advanced experiences, Loredeck Library, Active Stack, Context, the Pack Health Center, Loredeck Creator, Pending Review, Continuity, Injection, import/export, and theme/icon support.

Expect active development, incomplete workflows, changing schemas, rough edges, and possible breakage. Because automatic updates are disabled for alpha, reinstall or update the extension from the repository when you want a newer build. The recommended tester path is: start in **Basic**, get one chat working, then switch to **Advanced** when you need diagnostics, Creator workflows, Pack Health Center repairs, Continuity, or full Injection controls.

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
3. Saga does not auto-open on first load. Open it from the **SAGA** extension dropdown: **Open SAGA Window**.
4. Start in **Basic Workflow**. Go to the **Session** tab, follow the **Start Checklist**, and consider viewing the **Basic Walkthrough** below it.

For guided walkthroughs, see [Basic Workflow](docs/user/BASIC_WORKFLOW.md) and [Advanced Workflow](docs/user/ADVANCED_WORKFLOW.md). For the full surface-by-surface guide with screenshots, see the [Operator's Manual](docs/user/OPERATOR_MANUAL.md).

## What Saga Adds

| Surface | What it does |
| --- | --- |
| **Loredecks** | Portable lore packages for fandom canon, AU branches, crossover rules, original settings, or user edits. |
| **Lorecards** | Reviewable facts and constraints that are focused enough to affect a scene. |
| **Context** | Story position: date, book, arc, chapter, episode, route, quest stage, stardate, or another coordinate system. |
| **Active Stack** | The ordered set of loaded Loredecks for the current chat. |
| **Pending Review** | A safety layer where generated or edited lore waits before becoming accepted content. |
| **Injection** | The final prompt layer that sends only eligible, relevant lore to the model. |
| **Pack Health Center** | Structural validation, grouped issue review, and repair sessions for Loredecks, tags, manifests, timelines, and Context references. |
| **Loredeck Creator** | A staged, review-first workflow with a Current Task panel, cached generation batches, draft recovery, Pack Health gates, and finalization checks. |

## Mental Model

Saga's main runtime path is:

```text
Loredeck Library -> Active Stack -> Context -> Lorecards -> Injection -> Model response
```

Saga's review path is:

```text
Generate or edit -> Pending Review -> Accept -> Pack Health Center -> Use in chat
```

The important rule is simple: source lore, generated drafts, accepted chat lore, live continuity, and prompt injection are separate layers. Saga is useful because it keeps those layers visible instead of silently mixing them together.

## Operator's Manual

The full operator guide lives in [docs/user/OPERATOR_MANUAL.md](docs/user/OPERATOR_MANUAL.md). It keeps the screenshot-heavy, surface-by-surface material out of the first-contact README while preserving it as release-facing documentation.

Use it when you need the detailed view of:

- First Run and walkthrough modules.
- Session controls and runtime state.
- Loredecks, Active Stack, Library, and the Pack Health Center.
- Loredeck Creator, Current Task guidance, and Generated Lorepack review flow.
- Context, Lorecards, Continuity, Injection, Settings, and troubleshooting.

## Documentation

Release-facing docs:

- [Documentation Index](docs/DOCUMENTATION_INDEX.md)
- [Alpha Release Notes](docs/release/0.1.0-alpha.1.md)
- [Operator's Manual](docs/user/OPERATOR_MANUAL.md)
- [Basic Workflow](docs/user/BASIC_WORKFLOW.md)
- [Advanced Workflow](docs/user/ADVANCED_WORKFLOW.md)
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
node tools\scripts\test-context-workbench-picker.mjs
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
- `src/loredecks/loredeck-health-panel.js`: Pack Health Center UI.
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

Reference-quality decks should be data-only, Context-aware, reviewable, and clean in the Pack Health Center. Do not treat parsed JSON as finished content. A deck is ready to model future work only when it loads cleanly, retrieves at the right Context, keeps future lore gated, and has no outstanding health issues.

## License

See [LICENSE](LICENSE).
