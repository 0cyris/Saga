# Saga Alpha Repository Restructure Plan

Status: Draft.

Date: 2026-06-11.

## Purpose

Saga's repository should be cleaned up before production alpha so the folder layout communicates the product architecture instead of exposing early prototyping history. The current root is too crowded: runtime modules, data, images, presets, smoke harnesses, local tooling, and release docs all compete at the same level.

This plan defines a comprehensive alpha restructure. It covers JavaScript modules, styles, bundled Loredeck data, provider presets, passive image assets, tests, local scripts, documentation references, package import/export paths, and release verification.

Because Saga is still pre-alpha, this pass should update the repo in place to the best alpha structure. Do not preserve stale root paths through compatibility aliases unless a SillyTavern loader contract requires a tiny root shim.

## Goals

- Make the root small enough to scan.
- Put implementation code under `src/`.
- Put bundled runtime data under `content/`.
- Put passive visual assets under `assets/`.
- Keep docs under `docs/`, but update every documented path.
- Keep tests and tools clearly separate from shipped runtime code.
- Move `Loredecks/`, `Presets/`, and `Images/` out of root.
- Update import/export, bundled loading, visual smoke, README images, and scripts together.
- Preserve the release behavior: Saga loads in SillyTavern, opens the runtime shelf, loads bundled Loredecks, resolves Context, displays assets, exports packages, imports packages, and passes smoke.

## Non-Goals

- Do not redesign Saga's UI during the restructure.
- Do not rename persisted state keys unless required by file-path contracts.
- Do not rename schema fields such as `packId` or `loredeck.json` in the same pass.
- Do not split every large module at once. Folder ownership is the first alpha cleanup. Decomposition can continue in follow-up passes.
- Do not keep broad legacy loaders for old root data paths. If the path is internal to this repo, update it everywhere.

## Current Root Snapshot

Current root folders:

```text
.codex/
.git/
.saga-doc-renderer/
.tmp/
docs/
Images/
Loredecks/
Presets/
scripts/
tests/
```

Current root runtime files include `index.js`, `style.css`, `settings.html`, `constants.js`, `state-manager.js`, `lore-panel.js`, `loredeck-loader.js`, `loredeck-library-panel.js`, `context-index.js`, `context-resolver.js`, `continuity-scanner.js`, and many other modules.

Important current contracts:

- `manifest.json` points at `index.js` and `style.css`.
- `settings.html` is loaded through SillyTavern's `renderExtensionTemplateAsync(folder, 'settings')`.
- Runtime icon and branding paths currently use `Images/...`.
- Bundled Loredeck loading currently uses `Loredecks/index.json` and per-deck folders.
- Provider preset constants currently point at `./Presets/Provider-1.2.json`.
- `.saga-loredeck.zip` packages currently mirror `Loredecks/`.
- The local visual smoke harness imports `../style.css`, `../constants.js`, and `../lore-panel.js`.
- Many scripts import root JS modules through paths like `../context-index.js`.

## Target Root

The production-alpha root should be limited to release metadata, loader shims if needed, and durable top-level domains:

```text
Saga/
  manifest.json
  README.md
  LICENSE
  index.js
  style.css
  settings.html
  src/
  styles/
  content/
  assets/
  docs/
  tests/
  tools/
```

Root `index.js`, `style.css`, and `settings.html` are allowed only if SillyTavern requires root entrypoints. They should be thin loader/template files, not implementation homes.

If a Phase 0 loader probe proves SillyTavern accepts nested `manifest.json` paths and nested extension templates, the cleaner target is:

```json
{
  "js": "src/extension/index.js",
  "css": "styles/saga.css"
}
```

If nested paths do not work reliably, keep:

```text
index.js      imports ./src/extension/index.js
style.css     imports ./styles/saga.css
settings.html root template shell
```

## Target Structure

```text
src/
  extension/
    index.js
    settings-template.js
    tool-registry.js
  runtime/
    panel.js
    shell.js
    navigation.js
    experience-mode.js
    basic-readiness.js
    guide-content.js
    tour.js
    formatters.js
  state/
    state-manager.js
    constants.js
    secure-keyring.js
  lorecards/
    lorecards-panel.js
    lore-generator.js
    lore-injection-filter.js
    lore-matrix.js
    lore-relevance.js
    lore-timeline.js
    lore-timeline-panel.js
    pending-lore-preprocessor.js
    retrieval-audit.js
  loredecks/
    assistant.js
    creator-panel.js
    creator-projects.js
    defaults.js
    health-panel.js
    library-drag.js
    library-index.js
    library-panel.js
    library-service.js
    library-view.js
    loader.js
    package-service.js
    package-zip.js
    tab-panel.js
    workbench-panel.js
  context/
    auto-relevance.js
    canon-lore-db.js
    context-gating.js
    context-index.js
    context-panel.js
    context-resolver.js
    context-workbench-panel.js
  continuity/
    continuity-panel.js
    continuity-scanner.js
    extractor.js
    memo-builder.js
    prompt-injector.js
  providers/
    lore-llm-client.js
  settings/
    settings-panel.js
    theme-actions.js
    theme-panel.js
  theme/
    runtime-theme.js
  ui/
    runtime-ui-kit.js
    ui.js
  generation/
    generation-job-runner.js
  shared/
    context-resolver-adapters.js

styles/
  saga.css

content/
  loredecks/
    index.json
    hp-core/
    hp-year-1-philosophers-stone/
    ...
  presets/
    Provider-1.2.json

assets/
  branding/
  iconsets/
  loredeck-library/
  lore-timeline-icons/
  documentation/
    renders/

tests/
  browser/
    visual-smoke.html
  fixtures/

tools/
  scripts/
  doc-renderer/
```

`shared/context-resolver-adapters.js` is a placeholder name for cross-domain glue only if needed. Avoid creating broad shared modules unless a moved import truly belongs to no domain.

## Path Map

### Entry And Runtime Code

| Current | Target |
| --- | --- |
| `index.js` | `src/extension/index.js` plus optional root shim |
| `saga-tool-registry.js` | `src/extension/tool-registry.js` |
| `settings.html` | root shim, or `src/extension/settings.html` if SillyTavern supports nested templates |
| `ui.js` | `src/ui/ui.js` |
| `style.css` | `styles/saga.css` plus optional root shim |
| `runtime-*.js` | `src/runtime/*.js` |
| `runtime-ui-kit.js` | `src/ui/runtime-ui-kit.js` |
| `runtime-theme.js` | `src/theme/runtime-theme.js` |

### State, Settings, And Provider Code

| Current | Target |
| --- | --- |
| `constants.js` | `src/state/constants.js` |
| `state-manager.js` | `src/state/state-manager.js` |
| `secure-keyring.js` | `src/state/secure-keyring.js` |
| `settings-panel.js` | `src/settings/settings-panel.js` |
| `theme-actions.js` | `src/settings/theme-actions.js` |
| `theme-panel.js` | `src/settings/theme-panel.js` |
| `lore-llm-client.js` | `src/providers/lore-llm-client.js` |

### Lorecards, Loredecks, Context, And Continuity

| Current | Target |
| --- | --- |
| `lore-panel.js` | `src/runtime/panel.js` |
| `lorecards-panel.js` | `src/lorecards/lorecards-panel.js` |
| `lore-generator.js` | `src/lorecards/lore-generator.js` |
| `lore-matrix.js` | `src/lorecards/lore-matrix.js` |
| `lore-relevance.js` | `src/lorecards/lore-relevance.js` |
| `lore-timeline*.js` | `src/lorecards/lore-timeline*.js` |
| `loredeck-*.js` | `src/loredecks/*.js` with shorter file names where obvious |
| `loredecks-tab-panel.js` | `src/loredecks/tab-panel.js` |
| `canon-lore-db.js` | `src/context/canon-lore-db.js` |
| `context-*.js` | `src/context/*.js` |
| `auto-relevance.js` | `src/context/auto-relevance.js` |
| `continuity-*.js` | `src/continuity/*.js` |
| `extractor.js` | `src/continuity/extractor.js` |
| `memo-builder.js` | `src/continuity/memo-builder.js` |
| `prompt-injector.js` | `src/continuity/prompt-injector.js` |

### Data And Assets

| Current | Target |
| --- | --- |
| `Loredecks/index.json` | `content/loredecks/index.json` |
| `Loredecks/<deck>/...` | `content/loredecks/<deck>/...` |
| `Presets/Provider-1.2.json` | `content/presets/Provider-1.2.json` |
| `Images/branding/...` | `assets/branding/...` |
| `Images/iconsets/...` | `assets/iconsets/...` |
| `Images/loredeck-library/...` | `assets/loredeck-library/...` |
| `Images/lore-timeline-icons/...` | `assets/lore-timeline-icons/...` |
| `Images/documentation/renders/...` | `assets/documentation/renders/...` |

### Tests, Scripts, And Local Tooling

| Current | Target |
| --- | --- |
| `scripts/*.mjs` | `tools/scripts/*.mjs` |
| `tests/visual-smoke.html` | `tests/browser/visual-smoke.html` |
| `tests/fixtures/...` | `tests/fixtures/...` |
| `.saga-doc-renderer/` | `tools/doc-renderer/` if it becomes tracked; otherwise ignored local tooling |
| `.tmp/` | ignored local temp folder, not part of release structure |
| `tmp-visual-smoke-server.all.log` | `.tmp/visual-smoke-server.all.log` or remove |

## Runtime Path Strategy

Add a small path helper during the restructure so root-relative paths do not spread again.

Suggested constants:

```js
export const SAGA_CONTENT_ROOT = './content';
export const SAGA_LOREDECK_ROOT = './content/loredecks';
export const SAGA_PRESET_ROOT = './content/presets';
export const SAGA_ASSET_ROOT = './assets';
```

Suggested helper ownership:

```text
src/state/constants.js
src/theme/runtime-theme.js
src/loredecks/loader.js
src/loredecks/package-service.js
```

Rules:

- Runtime code should not hardcode `Images/`, `Loredecks/`, or `Presets/`.
- Data loaders should resolve bundled data through one owned path helper.
- Theme and icon code should resolve passive assets through one owned asset helper.
- Package import/export code should own archive-internal paths separately from repo runtime paths.
- Tests should import from the target module path, not from root shims.

## Loredeck Package Format Impact

The current `.saga-loredeck.zip` plan mirrors `Loredecks/`. The alpha restructure should intentionally update this before alpha locks the package contract.

Target package archive layout:

```text
example.saga-loredeck.zip
  saga-package.json
  loredecks/
    index.json
    one-piece-arlong-park-core/
      loredeck.json
      manifest.json
      tags.json
      timeline.json
      assets/
        cover.png
      entries/
        core.json
```

Repo layout and package layout should not be identical:

- Repo bundled data lives under `content/loredecks/`.
- Package archives use `loredecks/` because they are data containers, not repo checkouts.
- Import/export must be updated as a paired contract.
- Package docs and tests must stop advertising uppercase `Loredecks/` before alpha.
- Since Saga is pre-alpha, old uppercase package paths do not need a broad user-facing compatibility layer. A temporary developer assertion can point contributors to the new package shape if needed.

## Documentation Impact

Update these classes of references in the same branch:

- README image links from `Images/...` to `assets/...`.
- README repository layout section.
- `docs/loredecks/SAGA_LOREDECK_SCHEMA.md` bundled path examples.
- `docs/development/LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md` package path examples.
- `docs/development/SAGA_ALPHA_RELEASE_SYSTEMS.md` references to `Loredecks/index.json`.
- `docs/development/SAGA_VISUAL_SMOKE.md` screenshot paths.
- `docs/development/SAGA_PREPRODUCTION.md` implementation-status references.
- Script command examples if `scripts/` moves to `tools/scripts/`.
- Any "Deck Health" remnants touched by this pass should be corrected to "Pack Health" in user-facing text.

Do not rewrite historical planning sections purely for style. Update references that would mislead someone trying to run, verify, or author alpha content.

## Implementation Phases

### Phase 0: Loader Probe And Inventory

Objective: prove which root files must remain.

Tasks:

- Test whether `manifest.json` can load nested JS and CSS paths.
- Test whether `renderExtensionTemplateAsync(folder, 'settings')` can load a nested settings template or only root `settings.html`.
- Generate a current import graph for root JS modules.
- Generate a path-reference inventory for `Loredecks/`, `Presets/`, `Images/`, `scripts/`, `tests/`, `index.js`, `style.css`, and `settings.html`.
- Decide whether root `index.js`, `style.css`, and `settings.html` are shims or direct manifest targets.

Exit criteria:

- Loader contract is known.
- The migration path map is final enough to edit.
- No large file move has happened yet.

### Phase 1: Add Path Constants And Root Shims

Objective: create a stable landing pad before moving files.

Tasks:

- Add or update path constants for content, bundled Loredecks, presets, and assets.
- Convert obvious asset/data hardcodes to those constants where the owning module is clear.
- Convert root `index.js` to a thin import shim if nested manifest JS is not used.
- Convert root `style.css` to a thin CSS import shim if nested manifest CSS is not used.
- Keep root `settings.html` only if the template loader requires it.

Exit criteria:

- Saga still loads from the current root.
- Path constants exist.
- Existing tests still pass.

### Phase 2: Move Implementation Modules To `src/`

Objective: get runtime code out of root.

Tasks:

- Move modules by domain according to the path map.
- Rewrite all ESM imports.
- Prefer domain-local imports over deep cross-domain paths where ownership is obvious.
- Keep public facade exports stable for `showLorePanel`, `hideLorePanel`, `refreshLorePanel`, and `resetLorePanelLayout`.
- Update scripts and tests to import target paths, not root shims.

Exit criteria:

- Root no longer contains implementation JS except loader shims.
- `node --check` passes for moved modules.
- ES module import smoke passes for non-browser modules.

### Phase 3: Move Styles And Passive Assets

Objective: make assets release-readable and remove `Images/` from runtime paths.

Tasks:

- Move `style.css` implementation to `styles/saga.css`.
- Move `Images/branding` to `assets/branding`.
- Move `Images/iconsets` to `assets/iconsets`.
- Move `Images/loredeck-library` to `assets/loredeck-library`.
- Move `Images/lore-timeline-icons` to `assets/lore-timeline-icons`.
- Move `Images/documentation/renders` to `assets/documentation/renders`.
- Update `runtime-theme.js`, icon manifests, README image links, visual smoke docs, and `.gitignore`.

Exit criteria:

- No runtime code references `Images/`.
- README renders with the new asset paths.
- Theme/icon switching still resolves all bundled assets.
- Visual smoke screenshots write to the new documentation render path.

### Phase 4: Move Bundled Loredecks And Presets

Objective: make runtime data an explicit `content/` domain.

Tasks:

- Move `Loredecks/` to `content/loredecks/`.
- Move `Presets/` to `content/presets/`.
- Update `SAGA_PROVIDER_PRESET_ASSET_PATH`.
- Update bundled Loredeck loader paths.
- Update context index loading.
- Update Pack Health and conformance scripts.
- Update scaffold and maintenance scripts.
- Update docs and schema path examples.

Exit criteria:

- Bundled Loredecks load from `content/loredecks/index.json`.
- Provider preset install/download still resolves from `content/presets/Provider-1.2.json`.
- HP reference-deck conformance passes.
- Core integration harnesses pass against moved bundled data.

### Phase 5: Move Tools And Test Harnesses

Objective: separate release code from developer operations.

Tasks:

- Move `scripts/` to `tools/scripts/`.
- Update README command examples.
- Update docs that list script paths.
- Move `tests/visual-smoke.html` to `tests/browser/visual-smoke.html`.
- Update visual smoke server routes.
- Update live smoke helper assumptions.
- Keep `tests/fixtures/` as test data.

Exit criteria:

- Documented commands use `node tools/scripts/...`.
- Local visual smoke still serves the harness.
- Live smoke helper still supports repo-local and installed-SillyTavern targets.

### Phase 6: Update Package Import/Export Shape

Objective: align alpha package transport with the cleaned data contract.

Tasks:

- Change package archive paths from `Loredecks/` to `loredecks/`.
- Update `loredeck-package-service.js` parser logic.
- Update `loredeck-package-zip.js` tests and unsafe-path checks.
- Update package export staging.
- Update import preview copy where it mentions folder shape.
- Update schema and package docs.

Exit criteria:

- Exported `.saga-loredeck.zip` packages contain `loredecks/index.json`.
- Imported alpha packages install as editable Custom Loredecks.
- Package tests reject executable files and path traversal under the new path shape.

### Phase 7: Final Reference Cleanup

Objective: remove stale root-path assumptions.

Tasks:

- Run `rg` for old root paths:
  - `Loredecks/`
  - `Images/`
  - `Presets/`
  - `../lore-panel.js`
  - `../context-index.js`
  - `scripts/`
- Update docs where references are operational.
- Leave historical references only when they clearly describe past state.
- Remove or move root temp logs.
- Confirm `.gitignore` matches new render, temp, and local-tool paths.

Exit criteria:

- Root is clean.
- Operational docs point at real paths.
- Stale root paths do not appear in runtime code or test code.

## Verification Plan

Minimum local checks after each major phase:

```powershell
node --check index.js
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\serve-visual-smoke.mjs --check --port 0
node tools\scripts\test-hp-reference-deck-conformance.mjs
node tools\scripts\test-loredeck-zip-package.mjs
```

Until `scripts/` is moved, use the current paths:

```powershell
node scripts\test-visual-smoke-harness.mjs
node scripts\serve-visual-smoke.mjs --check --port 0
node scripts\test-hp-reference-deck-conformance.mjs
node scripts\test-loredeck-zip-package.mjs
```

Core integration checks to keep green after bundled data moves:

```powershell
node tools\scripts\test-core-integration-hp-year1.mjs
node tools\scripts\test-core-integration-hp-year2.mjs
node tools\scripts\test-core-integration-hp-year3.mjs
node tools\scripts\test-core-integration-hp-year4.mjs
node tools\scripts\test-core-integration-hp-year5.mjs
node tools\scripts\test-core-integration-hp-year6.mjs
node tools\scripts\test-core-integration-hp-year6-progression.mjs
node tools\scripts\test-core-integration-hp-year6-accepted-context.mjs
node tools\scripts\test-core-integration-hp-year7.mjs
node tools\scripts\test-core-integration-hp-epilogue-post-war.mjs
```

Browser smoke after the full move:

- Saga loads in SillyTavern without console errors.
- Runtime shelf opens.
- Loredecks tab opens.
- Library opens and shows bundled data.
- Pack Health opens for a bundled Loredeck.
- Context tab opens.
- Context Browser guard works with no loaded stack.
- Settings tab renders provider and theme sections.
- Theme/icon assets render from `assets/`.
- README image paths render from `assets/documentation/renders`.

## Risk Areas

### SillyTavern Loader Paths

The manifest and template loader may require root files. Keep root shims if needed. This is not compatibility clutter if the host requires it.

### ESM Relative Imports

Moving files across domains will break imports mechanically. Use a generated import map and verify with syntax checks plus module import smoke.

### Bundled Loredeck Loading

Bundled data is a runtime contract. Move it only after path constants and conformance tests are ready.

### Package Shape

Package import/export is a paired contract. Do not change exporter paths without updating parser tests, docs, and import preview behavior.

### Image Paths In Markdown

README and docs use direct relative image paths. After `Images/` moves, broken screenshots will be visible immediately on GitHub.

### Smoke Harness Routes

The visual smoke server currently assumes `tests/visual-smoke.html`. Moving the harness requires route updates and docs updates.

## Alpha Release Definition For This Plan

This restructure is alpha-ready when:

- The root has no implementation sprawl.
- Runtime code lives under `src/`.
- Bundled data lives under `content/`.
- Passive assets live under `assets/`.
- Tests and tools do not look like shipped runtime code.
- Saga loads in SillyTavern through the chosen loader strategy.
- Bundled Loredecks, presets, icons, branding, and documentation renders all resolve.
- `.saga-loredeck.zip` import/export uses the alpha package shape.
- Current deterministic harnesses and visual smoke pass.
- Operational docs no longer point users or contributors at removed root paths.

## Open Decisions

- Can `manifest.json` safely point to nested JS and CSS files in the installed SillyTavern extension?
- Can `renderExtensionTemplateAsync` load nested templates, or must `settings.html` remain root?
- Should `tools/scripts/` be adopted in one pass, or should `scripts/` remain top-level until after the runtime/data/asset move?
- Should package archives use lowercase `loredecks/` before alpha, or should they mirror repo `content/loredecks/`?
- Should `docs/development/SAGA_PREPRODUCTION.md` be updated broadly during this pass, or only where stale paths block implementation?

## First Implementation Slice

The safest first implementation slice is:

1. Run the Phase 0 loader probe.
2. Add path constants.
3. Create root shims if needed.
4. Move a low-risk module cluster into `src/runtime/` or `src/ui/`.
5. Update imports and smoke.

Do not start by moving `content/loredecks/` or `assets/`. Those are broader blast-radius moves and should happen after the module path strategy is proven.
