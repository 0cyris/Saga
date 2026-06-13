<p align="center">
  <img src="assets/branding/saga-banner-full.png" alt="SAGA: Fandom Loresystem">
</p>

# SAGA

**SAGA: Fandom Loresystem.**

Saga is a SillyTavern extension for long-form fandom roleplay and fanfiction. It turns canon, alternate-universe, crossover, and user-created lore into modular **Loredecks**, reviewable **Lorecards**, context-aware retrieval, and prompt-ready injection.

Saga is not a wiki viewer and not a prompt preset. It is a runtime lore system for deciding what belongs in the story **now**: what is true, what is hidden, what has changed in this chat, and what the model should actually see before writing the next response.

Current alpha metadata uses `0.1.0-alpha.1`, requires SillyTavern `1.12.0` or newer, and automatic updates are disabled so testers update deliberately from the repository. The recommended first path is to start in **Basic**, get one chat working, then switch to **Advanced** when you need diagnostics, Creator workflows, Pack Health Center repairs, Continuity, or full Injection controls.

## Contents

- [Fast Start](#fast-start)
- [Key Features](#key-features)
- [Documentation](#documentation)
- [Security](#security)
- [Project Layout](#project-layout)
- [Storage](#storage)
- [Authoring Loredecks](#authoring-loredecks)
- [License](#license)

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

## Key Features

| Surface | What it does |
| --- | --- |
| **Loredeck Library** | Browse Bundled, Generated, and Custom Loredecks; import/export `.saga-loredeck.zip` packages; organize folders; manage the Active Stack; and run Pack Health checks. |
| **Loredeck Creator** | A staged, review-first workflow for drafting Loredecks with scope planning, Context planning, title batches, timeline/tag planning, Lorecard drafts, recovery, and finalization gates. |
| **Lorecard System** | Suggested lore, Scan Story Lore, auto-relevance, Pending Review, approved Lorecards, pin/mute controls, and reviewable edits before lore affects the prompt. |
| **Lore Timeline** | An audit and recovery ledger for manual lore, accepted Lorecard changes, restored entries, deleted versions, and continuity-related lore events. |
| **Injection System** | The final prompt layer that sends only eligible, relevant, Context-aware lore to the model, with Advanced controls for previewing and tuning prompt composition. |
| **Basic/Advanced Workflow Modes** | Basic gives new users the shortest guided path to a working chat. Advanced exposes diagnostics, Creator authoring, Pack Health repair, Continuity, provider settings, and full Injection controls. |
| **Custom Theme Packs** | User-imported Theme Packs and Icon Sets for changing Saga's runtime appearance without changing bundled content. |

## Documentation

Release-facing docs:

- [Documentation Index](docs/DOCUMENTATION_INDEX.md)
- [Alpha Release Notes](docs/release/0.1.0-alpha.1.md)
- [Operator's Manual](docs/user/OPERATOR_MANUAL.md)
- [Basic Workflow](docs/user/BASIC_WORKFLOW.md)
- [Advanced Workflow](docs/user/ADVANCED_WORKFLOW.md)
- [Loredeck And Lorecard Creation](docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md)
- [Loredeck Zip Package Structure](docs/loredecks/LOREDECK_ZIP_PACKAGE_STRUCTURE.md)
- [LLM Loredeck Generation Guide](docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md)
- [Loredeck Schema Reference](docs/loredecks/SAGA_LOREDECK_SCHEMA.md)
- [Saga Terminology](docs/development/SAGA_TERMINOLOGY.md)

Development notes live in [docs/development](docs/development/) until promoted, rewritten, or archived as release-facing docs.

## Security

Saga is a browser-side SillyTavern extension. It does not require a server plugin for its own storage model, and Loredeck packages are data-only zip archives. Package import rejects unsafe paths and active file types such as scripts, HTML, SVG, executables, shell scripts, and WebAssembly.

Imported Loredecks can affect prompt content after you load and use them, so treat packages from unknown sources as untrusted prompt material even when the archive itself is data-only.

Model-backed actions use two provider roles: **Utility Provider** for frequent scan and summary work, and **Reasoning Provider** for deeper Context and Loredeck generation work. You can load Loredecks, set Context, review existing Lorecards, and inject accepted lore without configuring a provider.

Provider access is explicit:

- **Current SillyTavern Model** uses SillyTavern's active generation route.
- **Connection Profile** routes through SillyTavern's Connection Manager and keeps provider routing and keys in SillyTavern. This is the preferred option for stronger key isolation.
- **OpenAI-Compatible Endpoint** sends browser `fetch` requests to the configured base URL with `credentials: 'omit'` and a bearer API key header. Direct keys are stored in Saga settings with browser WebCrypto AES-GCM when available; if WebCrypto is unavailable, Saga warns and uses fallback obfuscation instead of encryption. Decrypted keys live in browser memory while provider calls run, so direct key storage does not protect against malicious scripts in the same browser session.

Use a SillyTavern Connection Profile or backend proxy when possible. Use Saga's direct endpoint mode mainly for alpha testing or local endpoints you already trust.

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

## Storage

Saga keeps large custom content out of `settings.json` wherever SillyTavern's files API is available. `settings.json` should stay compact: preferences, provider selections, storage pointers, encrypted or obfuscated direct-key material when used, and lightweight diagnostics.

Saga-owned payloads live under SillyTavern `/user/files` as flat, tracked files:

- Library index and installed Custom/Generated Loredeck payloads.
- Creator project stage data and generated-pack links.
- Imported Theme Packs, Icon Set manifests, and passive raster assets.
- Imported Loredeck package payloads and cover images.
- State Safety indexes, diagnostics, backups, and cleanup records.

Bundled Loredecks, bundled Theme Packs, bundled Icon Sets, and bundled passive assets stay in the extension repository. Use **Advanced Settings > State Safety** to verify storage, settle queued writes, and clean stale missing-file records. Use **Danger Zone** only when you intentionally want to reset Saga settings, remove custom content, clear stored Saga API keys, or run a total Saga cleanup.

See [Storage And State Safety](docs/user/STORAGE_AND_STATE_SAFETY.md) for the full storage contract.

## Authoring Loredecks

Saga supports two Loredeck authoring paths:

1. **Use the Loredeck Creator.** In Advanced mode, Creator walks through scope, story outline, Context planning, title batches, timeline/tag planning, Lorecard drafting, review, Pack Health, and finalization. This is the in-app path for staged model-assisted authoring.
2. **Use the docs and a bundled Loredeck as a reference.** Hand the authoring docs, schema, package structure guide, and a relevant bundled Loredeck folder to another LLM. The output target is a compatible `.saga-loredeck.zip` package that can be imported through **Import Deck** and then checked in Pack Health.

Start with these docs:

- [Loredeck And Lorecard Creation](docs/loredecks/LOREDECK_AND_LORECARD_CREATION_GUIDE.md)
- [Loredeck Zip Package Structure](docs/loredecks/LOREDECK_ZIP_PACKAGE_STRUCTURE.md)
- [LLM Loredeck Generation Guide](docs/loredecks/LLM_LOREDECK_GENERATION_GUIDE.md)
- [Loredeck Schema Reference](docs/loredecks/SAGA_LOREDECK_SCHEMA.md)

Reference-quality decks should be data-only, Context-aware, reviewable, and clean in the Pack Health Center. Do not treat parsed JSON as finished content. A deck is ready to model future work only when it loads cleanly, retrieves at the right Context, keeps future lore gated, and has no outstanding health issues.

## License

See [LICENSE](LICENSE).
