# Saga Alpha Repository Restructure Plan

Status: Direct nested manifest layout verified in the active SillyTavern install; reconstruction committed for alpha review.

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

## Initial Root Snapshot

Initial root folders before reconstruction:

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

Initial root runtime files included `index.js`, `style.css`, `settings.html`, `constants.js`, `state-manager.js`, `lore-panel.js`, `loredeck-loader.js`, `loredeck-library-panel.js`, `context-index.js`, `context-resolver.js`, `continuity-scanner.js`, and many other modules.

Important initial contracts:

- `manifest.json` points at `index.js` and `style.css`.
- `settings.html` is loaded through SillyTavern's `renderExtensionTemplateAsync(folder, 'settings')`.
- Runtime icon and branding paths used `Images/...`.
- Bundled Loredeck loading used `Loredecks/index.json` and per-deck folders.
- Provider preset constants pointed at `./Presets/Provider-1.2.json`.
- `.saga-loredeck.zip` packages mirrored `Loredecks/`.
- The local visual smoke harness imported `../style.css`, `../constants.js`, and `../lore-panel.js`.
- Many scripts imported root JS modules through paths like `../context-index.js`.

## Target Root

The production-alpha root should be limited to release metadata and durable top-level domains. The SillyTavern loader source supports nested JS/CSS manifest paths, and `renderExtensionTemplateAsync` can request a path-like template ID, so root entrypoint shims are not required.

```text
Saga/
  manifest.json
  README.md
  LICENSE
  src/
  styles/
  content/
  assets/
  docs/
  tests/
  tools/
```

Resolved manifest target:

```json
{
  "js": "src/extension/index.js",
  "css": "styles/saga.css"
}
```

Resolved settings template target:

```text
src/extension/settings.html
renderExtensionTemplateAsync(folder, 'src/extension/settings')
```

## Target Structure

```text
src/
  extension/
    index.js
    saga-tool-registry.js
  runtime/
    lore-panel.js
    runtime-shell.js
    runtime-navigation.js
    runtime-experience-mode.js
    runtime-basic-readiness.js
    runtime-guide-content.js
    runtime-tour.js
    runtime-formatters.js
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
    loredeck-assistant.js
    loredeck-creator-panel.js
    loredeck-creator-projects.js
    loredeck-defaults.js
    loredeck-health-panel.js
    loredeck-library-drag.js
    loredeck-library-index.js
    loredeck-library-panel.js
    loredeck-library-service.js
    loredeck-library-view.js
    loredeck-loader.js
    loredeck-package-service.js
    loredeck-package-zip.js
    loredecks-tab-panel.js
    loredeck-workbench-panel.js
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

The first alpha pass keeps descriptive filenames after moving them into domain folders. Shorter filenames such as `panel.js` or `loader.js` can be considered later during module decomposition, but they are not part of the path move. `shared/context-resolver-adapters.js` is a placeholder name for cross-domain glue only if needed. Avoid creating broad shared modules unless a moved import truly belongs to no domain.

## Path Map

### Entry And Runtime Code

| Current | Target |
| --- | --- |
| `index.js` | removed; `manifest.json` points to `src/extension/index.js` |
| `saga-tool-registry.js` | `src/extension/saga-tool-registry.js` |
| `settings.html` | `src/extension/settings.html` |
| `ui.js` | `src/ui/ui.js` |
| `style.css` | removed; `manifest.json` points to `styles/saga.css` |
| `runtime-*.js` | `src/runtime/runtime-*.js` |
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
| `lore-panel.js` | `src/runtime/lore-panel.js` |
| `lorecards-panel.js` | `src/lorecards/lorecards-panel.js` |
| `lore-generator.js` | `src/lorecards/lore-generator.js` |
| `lore-matrix.js` | `src/lorecards/lore-matrix.js` |
| `lore-relevance.js` | `src/lorecards/lore-relevance.js` |
| `lore-timeline*.js` | `src/lorecards/lore-timeline*.js` |
| `loredeck-*.js` | `src/loredecks/loredeck-*.js` |
| `loredecks-tab-panel.js` | `src/loredecks/loredecks-tab-panel.js` |
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
| `tmp-visual-smoke-server.all.log` | removed; root `tmp-*.log` files are ignored |

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
src/loredecks/loredeck-loader.js
src/loredecks/loredeck-package-service.js
```

Rules:

- Runtime code should not hardcode `Images/`, `Loredecks/`, or `Presets/`.
- Data loaders should resolve bundled data through one owned path helper.
- Theme and icon code should resolve passive assets through one owned asset helper.
- Package import/export code should own archive-internal paths separately from repo runtime paths.
- Tests should import from the target module path, not from root shims.

## Loredeck Package Format Impact

The earlier `.saga-loredeck.zip` plan mirrored root `Loredecks/`. The alpha contract now uses a lowercase package root before the format is locked.

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

Progress as of 2026-06-11:

- Phase 1 is complete: `manifest.json` points directly at `src/extension/index.js` and `styles/saga.css`, root `index.js`/`style.css` shims are removed, and settings render through `src/extension/settings.html`.
- Phase 2 is complete for the first alpha pass: root implementation modules moved into `src/` domain folders and scripts/tests import the new paths.
- Phase 3 is complete for passive assets: root `Images/` moved to `assets/`, runtime asset paths now use `./assets/...`, README/smoke docs point at `assets/documentation/renders/...`, and shared asset helpers resolve both `./assets`/`assets` and `./content`/`content` as extension-root asset paths.
- Phase 4 is complete for bundled repository data: root `Loredecks/` moved to `content/loredecks/`, root `Presets/` moved to `content/presets/`, and bundled loader/default/script paths now resolve against `content/`.
- Phase 5 is complete: developer scripts now live under `tools/scripts/`, and the browser smoke harness now lives under `tests/browser/visual-smoke.html`.
- Phase 6 is complete for the alpha package contract: `.saga-loredeck.zip` archives now use `loredecks/index.json`, the parser requires the lowercase package root, and package docs/tests reject the old uppercase archive root.
- Phase 7 is complete for the first alpha cleanup pass: old root folders are absent, the tracked root temp log was removed, root temp logs are ignored, copied validation commands use moved paths, old `Images/`/`Loredecks/`/`Presets/` runtime path allowances were removed, Provider-1.0/1.1 compatibility lookup was removed, and `tools/scripts/test-repository-layout.mjs` enforces the new layout.

Verification checkpoint as of 2026-06-11:

- `node tools\scripts\test-repository-layout.mjs` passes.
- `node tools\scripts\serve-visual-smoke.mjs --check --port 0` passes.
- All 46 `tools/scripts/test-*.mjs` scripts pass.
- Visible repo-local guide smoke passes with `SAGA_SMOKE_TARGET=guide-harness` and `SAGA_SMOKE_HEADLESS=0`; it writes 8 screenshots under `assets/documentation/renders/saga-smoke/` and reports no findings, console errors, or dialogs.
- Visible repo-local context smoke passes with `SAGA_SMOKE_TARGET=context-harness` and `SAGA_SMOKE_HEADLESS=0`; it writes 2 screenshots under `assets/documentation/renders/saga-smoke/` and reports no findings, console errors, or dialogs.
- Visible live-install smoke passes against `http://127.0.0.1:8000/` with `SAGA_SMOKE_TARGET=live-st` and `SAGA_SMOKE_HEADLESS=0`; it reports no findings, console errors, or dialogs after the active SillyTavern extension checkout is mirrored to the nested manifest layout.
- Runtime source and current-path conformance scripts no longer contain old escaped root path fallbacks such as `Images\/`, `Loredecks\/`, or `Presets\/`. The package ZIP test still constructs an uppercase `Loredecks/index.json` fixture only to verify that the old archive root is rejected.

### Phase 0: Loader Probe And Inventory

Objective: prove which root files must remain.

Tasks:

- Read the installed SillyTavern loader source to confirm `manifest.js`, `manifest.css`, and `renderExtensionTemplateAsync` support nested paths.
- Generate a current import graph for root JS modules.
- Generate a path-reference inventory for `Loredecks/`, `Presets/`, `Images/`, `scripts/`, `tests/`, `index.js`, `style.css`, and `settings.html`.
- Decide whether root `index.js`, `style.css`, and `settings.html` are shims or direct manifest/template targets.

Exit criteria:

- Loader contract is known.
- The migration path map is final enough to edit.
- No large file move has happened yet.

### Phase 1: Add Path Constants And Entry Targets

Objective: create a stable landing pad before moving files.

Tasks:

- Add or update path constants for content, bundled Loredecks, presets, and assets.
- Convert obvious asset/data hardcodes to those constants where the owning module is clear.
- Point `manifest.json` at `src/extension/index.js`.
- Point `manifest.json` at `styles/saga.css`.
- Render the nested settings template at `src/extension/settings.html`.

Exit criteria:

- Saga still loads from the manifest entry targets.
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
node --check src\extension\index.js
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\serve-visual-smoke.mjs --check --port 0
node tools\scripts\test-hp-reference-deck-conformance.mjs
node tools\scripts\test-loredeck-zip-package.mjs
node tools\scripts\test-repository-layout.mjs
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

Repo-local browser smoke commands:

```powershell
$env:SAGA_SMOKE_TARGET='guide-harness'; $env:SAGA_SMOKE_HEADLESS='0'; node tools\scripts\smoke-live-st-cdp.mjs
$env:SAGA_SMOKE_TARGET='context-harness'; $env:SAGA_SMOKE_HEADLESS='0'; node tools\scripts\smoke-live-st-cdp.mjs
```

## Risk Areas

### SillyTavern Loader Paths

The installed SillyTavern loader source builds extension JS and CSS URLs as `/scripts/extensions/${name}/${manifest.js}` and `/scripts/extensions/${name}/${manifest.css}`, so nested manifest paths are supported. `renderExtensionTemplateAsync` delegates to `renderTemplateAsync` with a full extension path, so `src/extension/settings` resolves to `src/extension/settings.html`. Keep this source-derived probe in mind when updating SillyTavern versions.

### ESM Relative Imports

Moving files across domains will break imports mechanically. Use a generated import map and verify with syntax checks plus module import smoke.

### Bundled Loredeck Loading

Bundled data is a runtime contract. Move it only after path constants and conformance tests are ready.

### Package Shape

Package import/export is a paired contract. Do not change exporter paths without updating parser tests, docs, and import preview behavior.

### Image Paths In Markdown

README and docs use direct relative image paths. After `Images/` moves, broken screenshots will be visible immediately on GitHub.

### Smoke Harness Routes

The visual smoke server previously assumed `tests/visual-smoke.html`. Phase 5 updates the route to `tests/browser/visual-smoke.html`; if a smoke check fails here, first verify the static server root and harness URL.

In the current desktop sandbox, headless Chrome can attach but may stop responding to CDP page commands before runtime evaluation. Use visible mode with `SAGA_SMOKE_HEADLESS=0` as the verified fallback for repo-local browser smoke. The repo-local static servers return 204 for `/favicon.ico` so missing favicon requests do not fail an otherwise clean smoke pass.

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

- Resolved: `manifest.json` points to nested `src/extension/index.js` and `styles/saga.css`.
- Resolved: `renderExtensionTemplateAsync` loads nested `src/extension/settings.html` through template ID `src/extension/settings`.
- Resolved: `tools/scripts/` was adopted after the runtime, asset, and data moves.
- Resolved: package archives use lowercase `loredecks/` before alpha instead of mirroring repo `content/loredecks/`.
- Resolved: `docs/development/SAGA_PREPRODUCTION.md` received a targeted broad refresh for stale implementation guidance. Historical migration notes stay, but the old root `Lore/` checklist is marked historical and the current restructure completion is recorded.

## Reconstruction Log

### 2026-06-11 Direct Install Smoke

The restructured workspace was mirrored into the active local SillyTavern extension checkout at:

```text
F:\SillyTavern\SillyTavern\data\default-user\extensions\Saga
```

Installed manifest verification:

```json
{
  "js": "src/extension/index.js",
  "css": "styles/saga.css"
}
```

Installed layout verification:

- Old root runtime and data entries are absent: `index.js`, `style.css`, `settings.html`, `Images/`, `Loredecks/`, `Presets/`, `scripts/`, and `tests/visual-smoke.html`.
- New runtime and content entries are present: `src/extension/index.js`, `src/extension/settings.html`, `styles/saga.css`, `content/loredecks/`, `content/presets/`, `assets/`, and `tools/scripts/`.

Live smoke command:

```powershell
$env:SAGA_SMOKE_TARGET='live-st'; $env:SAGA_SMOKE_HEADLESS='0'; node tools\scripts\smoke-live-st-cdp.mjs
```

Live smoke result:

- `ok: true`
- `findings: []`
- `errors: []`
- `dialogEvents: []`
- Screenshots captured for runtime load, Loredecks drawer, Library, Pack Health, and Settings Theme Pack.
- `creatorAvailable: false` and `injectionTabAvailable: false` because the live profile is in Basic Experience mode; repo-local guide smoke remains the Advanced-mode coverage for those surfaces.

Implementation notes from this smoke:

- The live profile had persisted bundled Library records from the old flat layout. They tried to load deck covers from `src/theme/Loredecks/...` after the module move.
- `normalizeLoredeckRegistry()` now treats shipped bundled pack IDs as current bundled defaults, so saved bundled records cannot keep stale `Loredecks/...` manifest or asset paths. This is an alpha in-place cleanup and does not add old root loader fallbacks.
- `tools/scripts/smoke-live-st-cdp.mjs` now understands the folderized Library selection path and treats Basic-mode hidden Advanced surfaces as optional live-smoke branches.

### 2026-06-11 Commit Checkpoint

The restructure was committed as a rename-heavy review set. Pre-commit staged status by class:

```text
A 74
D 1
M 26
R 757
```

No unstaged files or untracked non-ignored files remained before commit. Ignored `.tmp/saga-live-smoke-*` directories were left intact as local smoke evidence.

Staged verification:

- `git diff --cached --check`
- `node tools/scripts/test-repository-layout.mjs`
- `node tools/scripts/test-visual-smoke-harness.mjs`
- `node tools/scripts/serve-visual-smoke.mjs --check --port 0`

## Remaining Follow-Up

The first alpha restructure pass has executed and committed the original implementation slice. Remaining work before release staging:

1. Continue large-module decomposition after this folder ownership pass, especially around `src/runtime/lore-panel.js`, without mixing that refactor into the path move.
