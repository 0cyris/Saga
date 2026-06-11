# Saga Alpha Refactor Plan

Status: Planning baseline for the pre-alpha to alpha refactor.

Date: 2026-06-11.

## Purpose

Saga is far enough along that the largest alpha risk is no longer missing code. The risk is that too many unrelated behaviors are still coupled together, making bugs hard to isolate before testers start using the extension in SillyTavern.

This plan defines the refactor program that should happen before alpha release. It is not a rewrite plan and it is not a polish pass. The goal is to make the runtime, state layer, stylesheet, loader, startup, and Loredeck workbench code modular enough that a bug report can usually be traced to one owner module.

Because Saga is still pre-alpha, update the implementation in place to the best current architecture. Do not add broad legacy compatibility layers for old internal paths, old default states, or old helper names unless SillyTavern itself requires a small public hook.

## Related Documents

- [SAGA_ALPHA_RELEASE_SYSTEMS.md](SAGA_ALPHA_RELEASE_SYSTEMS.md): alpha system definition and release blockers.
- [SAGA_ALPHA_REPOSITORY_RESTRUCTURE_PLAN.md](SAGA_ALPHA_REPOSITORY_RESTRUCTURE_PLAN.md): completed root-to-domain folder restructure.
- [SAGA_LORE_PANEL_DECOMPOSITION_PLAN.md](SAGA_LORE_PANEL_DECOMPOSITION_PLAN.md): detailed running history for the `lore-panel.js` extraction.
- [SAGA_ALPHA_STABILIZATION_AND_UI_EXTRACTION.md](SAGA_ALPHA_STABILIZATION_AND_UI_EXTRACTION.md): immediate stabilization gates and Loredeck UI extraction slices after the broad split.
- [SAGA_CORE_INTEGRATION_TESTING.md](SAGA_CORE_INTEGRATION_TESTING.md): deterministic Context-to-injection verification.
- [LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md](LOREDECK_ZIP_PACKAGE_IMPORT_EXPORT_PLAN.md): import/export package contract.

## Current Audit Snapshot

Current measured sizes after the repository restructure and partial runtime decomposition:

| File | Lines | Bytes | Alpha risk |
| --- | ---: | ---: | --- |
| `src/runtime/lore-panel.js` | 19,597 | 1,022,229 | Runtime shell, panel routing, cross-system controller behavior, and residual UI helpers still share one file. |
| `src/state/state-manager.js` | 5,037 | 262,669 | Settings, chat state, migrations, normalizers, import/export, and storage safety share one facade implementation. |
| `styles/saga.css` | 10,412 | 314,696 | Tokens, layout, components, runtime panels, Loredeck surfaces, Context, review, settings, and themes share one stylesheet. |
| `src/state/constants.js` | 781 | 34,288 | Schema versioning, settings defaults, Basic profile, state defaults, provider defaults, UI defaults, and prompts share one constants module. |
| `src/loredecks/loredeck-loader.js` | 1,861 | 87,704 | Fetching, parsing, normalization, schema health, Context health, timeline health, and tag health are mixed. |
| `src/loredecks/loredeck-workbench-panel.js` | 2,326 | 118,140 | Workbench rendering and editing workflow logic still need shared UI primitives. |
| `src/loredecks/loredeck-health-panel.js` | 1,647 | 91,370 | Pack Health rendering is extracted, but validation rendering should become reusable across panels. |
| `src/loredecks/loredeck-creator-panel.js` | 1,512 | 95,551 | Creator shell is extracted, but stage/job/status UI overlaps with other async workflows. |
| `src/loredecks/loredeck-assistant.js` | 1,351 | 64,428 | Assistant workflow should share validation/result rendering and action plumbing. |
| `src/continuity/prompt-injector.js` | 325 | 16,180 | Global registration is small but duplicated and should have an explicit uninstall path. |
| `src/extension/index.js` | 472 | 26,396 | Startup, events, slash commands, settings, global bridge, and runtime mounting still share one entrypoint. |

## Refactor Rules

- Keep behavior stable through each slice. Do not combine UI redesign with module extraction.
- Keep public facades stable while moving internals: `lore-panel.js`, `state-manager.js`, `styles/saga.css`, and `src/extension/index.js` can remain public entrypoints during the transition.
- Delete obsolete internal paths instead of carrying compatibility aliases. The project is pre-alpha.
- Preserve Saga vocabulary in user-facing UI and docs: `Bundled Lorepack`, `Generated Lorepack`, `Custom Lorepack`, `Lorepack stack`, `Story Position`, and `Pack Health`.
- Keep the existing shelf/rail runtime shell. The refactor should isolate it, not replace it.
- Use small vertical slices with syntax checks, deterministic tests, and visual smoke before starting the next risky slice.
- Treat importer and exporter behavior as a paired contract. If one side changes, update the other side and package tests in the same slice.
- Prefer domain modules over generic dumping grounds. Add `shared/` only when code truly belongs to more than one domain.

## Target Architecture

### Runtime Shell And Panels

Keep `src/runtime/lore-panel.js` as the public composition layer only.

Target responsibility:

- Export `showLorePanel`.
- Export `hideLorePanel`.
- Export `refreshLorePanel`.
- Export `resetLorePanelLayout`.
- Configure runtime modules.
- Wire panel modules to the shared action registry.

Target modules:

| Module | Responsibility |
| --- | --- |
| `src/runtime/runtime-shell.js` | Panel mount, open/close, rail/drawer geometry, resize/drag, focus, viewport clamping, shell lifecycle. |
| `src/runtime/tab-registry.js` | Tab metadata, routing IDs, mode availability, labels, icons, and ordering. Existing `runtime-navigation.js` can either become this module or delegate to it. |
| `src/runtime/session-basic-panel.js` | Basic Start Checklist, Basic workflow cards, guided task entry points, Basic readiness presentation. |
| `src/runtime/advanced-runtime-panel.js` | Advanced entry card, advanced workflow summary, advanced-only entry points that do not belong to a domain panel. |
| `src/runtime/active-stack-panel.js` | Loaded Lorepack stack summary, stack ordering controls, stack readiness states, stack action calls. |
| `src/context/context-panel.js` | Context command center and Context Browser entry points. Keep this in the Context domain, not under `runtime/`. |
| `src/lorecards/review-panel.js` | Pending Review overview and review workflow entry points if the extracted Lorecards panel remains too broad. |
| `src/continuity/continuity-panel.js` | Continuity status and continuity review UI. |
| `src/continuity/injection-preview-panel.js` | Prompt injection preview, audit, and transport status. |
| `src/runtime/runtime-actions.js` | Shared command/action registry used by UI buttons, slash commands, toolbar/menu actions, and global bridge calls. |
| `src/runtime/runtime-readiness.js` | Alpha readiness and runtime checklist state. Existing `runtime-basic-readiness.js` can remain if the scope stays Basic-only. |

Alpha target:

- `lore-panel.js` drops below roughly 3,000 lines.
- Each rail tab has one owner module.
- Shared action behavior is registered once and called from every surface.
- Runtime panel bugs can be isolated to shell, tab registry, panel renderer, or action implementation.

### State Layer

Keep `src/state/state-manager.js` as the public facade so the rest of the app does not churn while internals move.

Target modules:

| Module | Responsibility |
| --- | --- |
| `src/state/state-manager.js` | Public facade and compatibility import surface for current app modules. |
| `src/state/state-store.js` | Read/write facade around SillyTavern extension settings, save semantics, and storage access. |
| `src/state/settings-store.js` | Settings read/write, default application, settings validation. |
| `src/state/chat-state-store.js` | Per-chat Saga state read/write, chat-scoped persistence, chat-state byte safety. |
| `src/state/lore-state-store.js` | Lore entries, Pending Review, accepted Lorecards, Loredeck registry, stack, Creator registry, and related mutations. |
| `src/state/migration-runner.js` | Ordered schema update execution and migration bookkeeping. |
| `src/state/migrations/vNN.js` | Current schema migrations that still matter for the active pre-alpha state shape. Avoid speculative migration scaffolding. |
| `src/state/import-export.js` | State export/import, package-aware state contracts, and paired import/export validation. |
| `src/state/state-normalizers.js` | Shared normalizers for current state shape. Split further only when a domain boundary is clear. |
| `src/state/state-backup.js` | Backup creation, restore helpers, and user-facing safety copies. |
| `src/state/storage-safety.js` | Size limits, clone guards, object-shape guards, and safe serialization helpers. |

Alpha target:

- `state-manager.js` exposes the same app-facing functions but contains little domain logic.
- Migrations are separated from normal runtime normalization.
- Settings changes, chat-state mutations, Loredeck registry mutations, and import/export behavior can be tested independently.
- Old internal migration baggage is removed rather than preserved for hypothetical pre-alpha users.

### Constants And Defaults

Split `src/state/constants.js` so migrations and defaults stop depending on a broad grab bag.

Target modules:

| Module | Responsibility |
| --- | --- |
| `src/state/schema.js` | `SCHEMA_VERSION`, module key, extension folder constants, schema-level IDs. |
| `src/state/default-state.js` | `getDefaultState()` and default chat-state objects. |
| `src/state/default-settings.js` | `DEFAULT_SETTINGS` and settings library defaults. |
| `src/state/basic-profile.js` | Basic Experience profile version, managed setting keys, and Basic defaults. |
| `src/state/provider-defaults.js` | Provider preset names, provider preset asset path, and model/provider defaults. |
| `src/state/ui-defaults.js` | Collapsed sections, layout defaults, UI mode defaults, and theme selection defaults. |
| `src/state/prompt-defaults.js` | Context detector prompt, JSON repair prompt, memo limits, and prompt budget constants. |

Alpha target:

- Migrations import only schema/default-state/default-settings modules they need.
- Prompt defaults do not force UI or state defaults into unrelated imports.
- UI defaults can change without scanning provider or prompt constants.

### Stylesheet

Keep `styles/saga.css` as the manifest CSS entrypoint, but make it an aggregator.

Target files:

| File | Responsibility |
| --- | --- |
| `styles/tokens.css` | Variables, spacing, typography, z-index, radii, animation durations. |
| `styles/layout.css` | Runtime panel/window/grid/shelf layout and shell geometry. |
| `styles/components.css` | Buttons, cards, forms, badges, drawers, dialogs, toasts, generic controls. |
| `styles/runtime.css` | Runtime tab surfaces, Start Checklist, status panels, readiness, runtime-specific controls. |
| `styles/loredecks.css` | Library, Workbench, Creator, Assistant, Pack Health, stack, package UI. |
| `styles/review.css` | Pending Review, accepted Lorecards, validation result rows, bulk review controls. |
| `styles/context.css` | Context command center, Context Browser, resolver, story-position picker, timeline controls. |
| `styles/settings.css` | Settings, Theme Packs, Icon Sets, provider controls. |
| `styles/themes.css` | Theme pack variable overrides and theme-specific selectors. |

Alpha target:

- `styles/saga.css` contains only `@import` statements and short comments.
- No selector renames during the mechanical split unless the selector is proven dead.
- Dead-selector scanning happens after runtime panel extraction, when panel ownership is clear.
- Visual smoke checks cover desktop and narrow widths after each layout-impacting slice.

### Loredeck Loader And Health

Keep `src/loredecks/loredeck-loader.js` data-only.

Target modules:

| Module | Responsibility |
| --- | --- |
| `src/loredecks/loredeck-loader.js` | Fetch index, fetch manifests/files, parse package records, combine loaded sources. |
| `src/loredecks/loredeck-normalizer.js` | Normalize manifests, entries, embedded records, stack source metadata. |
| `src/loredecks/loredeck-validator.js` | Validation orchestration for manifests, files, package shape, and required fields. |
| `src/loredecks/loredeck-health-engine.js` | Pack Health summary construction, severity aggregation, issue grouping. |
| `src/loredecks/context-health.js` | Context gate, timeline coordinate, anchor/window, and story-position health. |
| `src/loredecks/schema-v3-health.js` | Schema v3 Lorecard checks and deterministic repair helpers. |
| `src/loredecks/tag-registry-health.js` | Tag registry, tag use, malformed tags, aliases, dependencies, and undefined tags. |

Alpha target:

- Loader code can be read without reading health logic.
- Pack Health can be tested against in-memory manifests without network fetch behavior.
- Context health, schema health, and tag health can each fail independently.
- Import/export keeps the same package contract while loader internals move.

### Loredeck Panels And Shared Workflow UI

The large Loredeck panels should stop recreating the same UI patterns.

Shared primitives to extract:

- Card/list rendering.
- Search, sort, and filter controls.
- Status badges and Pack Health chips.
- Drawer, accordion, and details behavior.
- Empty, error, loading, and disabled states.
- Async job state and progress rows.
- Validation result rendering.
- Import/export action rows.
- Bulk selection toolbars.
- Confirmation and destructive-action rows.

Preferred module names:

| Module | Responsibility |
| --- | --- |
| `src/loredecks/loredeck-ui-kit.js` | Loredeck-specific cards, rows, chips, and empty states that are too domain-specific for `runtime-ui-kit.js`. |
| `src/loredecks/loredeck-filter-controls.js` | Shared filter/search/sort UI and state helpers. |
| `src/loredecks/loredeck-validation-view.js` | Pack Health and validation issue renderers used by Library, Workbench, Creator, and Assistant. |
| `src/loredecks/loredeck-job-view.js` | Async generation/import/export job status rendering. |
| `src/loredecks/loredeck-actions.js` | Loredeck action registry adapter for import, export, duplicate, delete, finalize, validate, and repair. |

Alpha target:

- Library, Workbench, Creator, Assistant, and Pack Health do not each render their own status and validation dialect.
- Shared UI modules stay domain-specific and do not become a generic application framework.
- Mutations still route through state facades and action registries, not through rendering helpers.

### Prompt Injector Globals

SillyTavern requires a global `generate_interceptor`-style hook for the legacy path, and Saga still needs `globalThis.sagaInterceptor` for manifest/runtime compatibility. Keep that one public hook but stop scattering debug globals.

Target structure:

- `installInterceptor()` registers `globalThis.sagaInterceptor`.
- `installInterceptor()` registers a single namespace at `globalThis.Saga`.
- Debug helpers live under `globalThis.Saga.promptInjection`.
- Duplicate assignments are removed.
- The old `sagaContinuityInterceptor` alias is removed unless current live smoke proves SillyTavern still calls it.
- `uninstallInterceptor()` clears Saga-owned globals and prompt state for disable/reload cleanup.

Alpha target:

- Global registration is idempotent.
- The install and uninstall paths are testable.
- Prompt sync status can be inspected through one namespace.

### Extension Entrypoint

Keep `src/extension/index.js` as the manifest entrypoint, but make it bootstrap only.

Target modules:

| Module | Responsibility |
| --- | --- |
| `src/extension/bootstrap.js` | SillyTavern context guard, startup order, top-level initialization. |
| `src/extension/events.js` | Event registration, generation/chat handlers, cleanup registration. |
| `src/extension/slash-commands.js` | Slash command registration and argument parsing. |
| `src/extension/menu-button.js` | Toolbar/menu button mount, labels, click handling. |
| `src/extension/global-bridge.js` | `globalThis.Saga` namespace and temporary underscore bridge functions while they are still needed. |
| `src/extension/settings-mount.js` | Settings template loading and settings panel render lifecycle. |
| `src/extension/runtime-mount.js` | Runtime shelf mount, refresh, and panel lifecycle calls. |

Action routing:

- UI buttons, slash commands, toolbar/menu actions, and global bridge calls should call `runtime-actions.js` or a domain action adapter.
- Do not let each surface implement slightly different behavior for the same action.
- Audit the current `runAutoRelevance` import. If it is unused, remove it during the entrypoint split.

Alpha target:

- `index.js` is roughly 50-100 lines.
- Event handlers can be tested without mounting settings UI.
- Slash commands can be tested without the runtime shelf.
- Global bridge cleanup is centralized.

## Implementation Phases

### Phase 0: Baseline And Guardrails

Purpose: make the refactor measurable before moving more code.

Tasks:

- Capture current line counts and dependency edges for all files in the audit snapshot.
- Record current public exports for `lore-panel.js`, `state-manager.js`, `constants.js`, `loredeck-loader.js`, and `index.js`.
- Add or update small ownership scans where a boundary is already clear.
- Confirm which existing tests are stable enough to serve as gates.

Validation:

```powershell
node --check src\runtime\lore-panel.js
node --check src\state\state-manager.js
node --check src\state\constants.js
node --check src\loredecks\loredeck-loader.js
node --check src\extension\index.js
node tools\scripts\test-repository-layout.mjs
```

Exit criteria:

- Current sizes and public exports are known.
- The team agrees which tests must pass after each refactor slice.

### Phase 1: Shared Action Registry

Purpose: reduce behavior drift before moving more UI and startup code.

Tasks:

- Create `src/runtime/runtime-actions.js`.
- Register high-value actions first: open runtime, close runtime, refresh runtime, reset layout, open Library, open Creator, open Context Browser, run Auto-Relevance, sync prompt injection, export state, import package, open Pack Health.
- Convert obvious UI, toolbar, slash command, and global bridge calls to dispatch through the registry.
- Keep domain-specific behavior in domain modules; the registry should route, not own business logic.

Validation:

```powershell
node --check src\runtime\runtime-actions.js
node --check src\runtime\lore-panel.js
node --check src\extension\index.js
node tools\scripts\test-basic-readiness.mjs
```

Exit criteria:

- Same action has one implementation path across UI, slash command, and global bridge surfaces.
- Runtime actions can be smoke-tested without reading the full panel file.

### Phase 2: Entrypoint And Prompt Injector Cleanup

Purpose: isolate startup and global registration before deeper runtime/state extraction.

Tasks:

- Split `src/extension/index.js` into bootstrap, events, slash commands, menu button, global bridge, settings mount, and runtime mount modules.
- Move debug/global bridge registration into `global-bridge.js`.
- Remove unused imports such as `runAutoRelevance` if confirmed unused.
- Refactor `installInterceptor()` to register globals once.
- Add `uninstallInterceptor()`.
- Move prompt injection debug helpers under `globalThis.Saga.promptInjection`.

Validation:

```powershell
node --check src\extension\index.js
node --check src\extension\bootstrap.js
node --check src\extension\events.js
node --check src\extension\slash-commands.js
node --check src\extension\global-bridge.js
node --check src\continuity\prompt-injector.js
node tools\scripts\smoke-live-st-cdp.mjs
```

Exit criteria:

- Saga still initializes in SillyTavern.
- Prompt injection still syncs before generation.
- Global bridge functions are discoverable in one namespace.

### Phase 3: Constants And Defaults Split

Purpose: make state and migration work less risky.

Tasks:

- Split `constants.js` into schema, default-state, default-settings, basic-profile, provider-defaults, ui-defaults, and prompt-defaults.
- Keep a temporary `constants.js` re-export facade if that minimizes churn during the first slice.
- Update imports by domain rather than continuing to import everything from `constants.js`.
- Remove stale default keys that only exist for old pre-alpha behavior.

Validation:

```powershell
node --check src\state\constants.js
node --check src\state\schema.js
node --check src\state\default-state.js
node --check src\state\default-settings.js
node --check src\state\basic-profile.js
node --check src\state\provider-defaults.js
node --check src\state\ui-defaults.js
node --check src\state\prompt-defaults.js
node tools\scripts\test-basic-readiness.mjs
node tools\scripts\test-experience-modes.mjs
```

Exit criteria:

- Defaults are owned by clear modules.
- No unrelated feature import needs the full constants bundle.

### Phase 4: State Facade Split

Purpose: isolate persistence, settings, chat state, Loredeck mutations, migrations, and storage safety.

Tasks:

- Extract low-level read/write helpers into `state-store.js`.
- Move settings behavior into `settings-store.js`.
- Move chat-scoped state read/write into `chat-state-store.js`.
- Move current schema migrations into `migration-runner.js` and focused `migrations/vNN.js` files.
- Move import/export behavior into `import-export.js`.
- Move size/clone/serialization guards into `storage-safety.js`.
- Move Loredeck registry, stack, Creator registry, and Lorecard-state mutations into `lore-state-store.js` or narrower domain stores if the file gets too broad.
- Keep `state-manager.js` as the app-facing facade.

Validation:

```powershell
node --check src\state\state-manager.js
node --check src\state\state-store.js
node --check src\state\settings-store.js
node --check src\state\chat-state-store.js
node --check src\state\lore-state-store.js
node --check src\state\migration-runner.js
node --check src\state\import-export.js
node --check src\state\state-normalizers.js
node --check src\state\state-backup.js
node --check src\state\storage-safety.js
node tools\scripts\test-pending-context-storage.mjs
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-creator-projects.mjs
node tools\scripts\test-loredeck-zip-package.mjs
```

Exit criteria:

- A settings bug, storage bug, migration bug, or Loredeck registry bug can be isolated to a focused state module.
- `state-manager.js` is a facade rather than a monolith.

### Phase 5: Runtime Panel Ownership

Purpose: finish enough `lore-panel.js` decomposition that runtime bugs are isolated before alpha.

Tasks:

- Create or clarify `tab-registry.js`.
- Move Basic Start Checklist UI into `session-basic-panel.js`.
- Move advanced runtime entry UI into `advanced-runtime-panel.js`.
- Move active-stack rendering and stack controls into `active-stack-panel.js`.
- Move injection preview/audit UI into `injection-preview-panel.js`.
- Keep Context and Continuity panels in their existing domain folders.
- Create `review-panel.js` only if `lorecards-panel.js` remains too broad after the runtime split.
- Keep `lore-panel.js` as composition and facade only.

Validation:

```powershell
node --check src\runtime\lore-panel.js
node --check src\runtime\runtime-shell.js
node --check src\runtime\tab-registry.js
node --check src\runtime\session-basic-panel.js
node --check src\runtime\advanced-runtime-panel.js
node --check src\runtime\active-stack-panel.js
node --check src\continuity\injection-preview-panel.js
node tools\scripts\test-basic-readiness.mjs
node tools\scripts\test-experience-modes.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

Exit criteria:

- `lore-panel.js` is composition-only enough that future panel work does not require reading a 1 MB controller.
- Basic and Advanced runtime surfaces route through shared action calls.
- Visual smoke proves the shelf/rail shell still opens and major tabs render.

### Phase 6: Stylesheet Split

Purpose: make styling searchable and reduce layout regression blast radius.

Tasks:

- Create the target CSS files and make `styles/saga.css` import them.
- Move token declarations first.
- Move shell/window/grid layout next.
- Move reusable components before domain-specific panels.
- Move runtime, Loredeck, review, Context, settings, and theme styles by ownership.
- Do not rename selectors during the split unless a selector is proven dead.
- After panel decomposition stabilizes, add a dead-selector scan.

Validation:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\smoke-live-st-cdp.mjs
```

Exit criteria:

- A layout bug can be searched in one likely CSS file.
- Theme variables are centralized.
- Component styles are separated from domain panel styles.

### Phase 7: Loredeck Loader And Health Split

Purpose: make loader behavior data-only and make Pack Health testable by domain.

Tasks:

- Move entry/manifest normalizers into `loredeck-normalizer.js`.
- Move validation orchestration into `loredeck-validator.js`.
- Move health aggregation into `loredeck-health-engine.js`.
- Move Context/timeline health into `context-health.js`.
- Move schema v3 checks into `schema-v3-health.js`.
- Move tag registry checks into `tag-registry-health.js`.
- Keep import/export package shape in sync with loader expectations.

Validation:

```powershell
node --check src\loredecks\loredeck-loader.js
node --check src\loredecks\loredeck-normalizer.js
node --check src\loredecks\loredeck-validator.js
node --check src\loredecks\loredeck-health-engine.js
node --check src\loredecks\context-health.js
node --check src\loredecks\schema-v3-health.js
node --check src\loredecks\tag-registry-health.js
node tools\scripts\test-hp-reference-deck-conformance.mjs
node tools\scripts\test-hp-loredeck-health.mjs
node tools\scripts\test-jjk-loredeck-health.mjs
node tools\scripts\test-loredeck-context-health.mjs
node tools\scripts\test-loredeck-zip-package.mjs
```

Exit criteria:

- Bundled Lorepacks still load from `content/loredecks/index.json`.
- Pack Health output remains stable.
- Context, schema, and tag health tests can fail independently.

### Phase 8: Loredeck Panel Shared UI

Purpose: reduce duplicated UI and workflow behavior across Library, Workbench, Creator, Assistant, and Pack Health.

Tasks:

- Extract Loredeck-specific UI primitives into `loredeck-ui-kit.js`.
- Extract shared filter/search/sort controls.
- Extract validation result rendering.
- Extract async job status rendering.
- Route import/export/duplicate/delete/finalize/repair actions through a shared action adapter.
- Keep mutation behavior out of render helpers.

Validation:

```powershell
node --check src\loredecks\loredeck-ui-kit.js
node --check src\loredecks\loredeck-filter-controls.js
node --check src\loredecks\loredeck-validation-view.js
node --check src\loredecks\loredeck-job-view.js
node --check src\loredecks\loredeck-actions.js
node --check src\loredecks\loredeck-library-panel.js
node --check src\loredecks\loredeck-workbench-panel.js
node --check src\loredecks\loredeck-creator-panel.js
node --check src\loredecks\loredeck-health-panel.js
node --check src\loredecks\loredeck-assistant.js
node tools\scripts\test-loredeck-library-folders.mjs
node tools\scripts\test-loredeck-creator-projects.mjs
node tools\scripts\test-loredeck-assistant.mjs
node tools\scripts\test-loredeck-health-center-refresh.mjs
node tools\scripts\test-visual-smoke-harness.mjs
```

Exit criteria:

- Loredeck panels share status, validation, empty-state, and action-row behavior.
- Pack Health, Creator, Assistant, and Workbench no longer render incompatible validation dialects.

### Phase 9: Dead Code, Selector, And Import Audit

Purpose: remove leftover scaffolding after ownership boundaries are clear.

Tasks:

- Scan for unused exports and stale imports.
- Remove obsolete global aliases and pre-alpha compatibility helpers.
- Run dead-selector scans after CSS and panel ownership settle.
- Search docs, tests, and tooling for old module names and stale paths.
- Re-run alpha release system tests and live smoke.

Validation:

```powershell
node tools\scripts\test-repository-layout.mjs
node tools\scripts\test-basic-readiness.mjs
node tools\scripts\test-experience-modes.mjs
node tools\scripts\test-hp-reference-deck-conformance.mjs
node tools\scripts\test-jjk-reference-deck-conformance.mjs
node tools\scripts\test-core-integration-hp-year6.mjs
node tools\scripts\test-core-integration-hp-year6-progression.mjs
node tools\scripts\test-core-integration-hp-year6-accepted-context.mjs
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\smoke-live-st-cdp.mjs
```

Exit criteria:

- No stale imports to removed modules.
- No known dead selectors from removed panel structures.
- No broad pre-alpha compatibility code remains without a current SillyTavern reason.

## Alpha Completion Criteria

This refactor plan is alpha-complete when:

- `lore-panel.js` is a composition layer with narrow public exports.
- `state-manager.js` is a facade over focused state modules.
- `constants.js` is either removed or a small re-export facade.
- `styles/saga.css` is an aggregator over owned CSS files.
- `loredeck-loader.js` is data-loading code, not the home of every health rule.
- Startup is split from events, settings mount, runtime mount, slash commands, and global bridge code.
- Prompt injection has one install path, one namespace, and a cleanup path.
- Loredeck panels share UI primitives for repeated workflow states.
- Deterministic core integration tests and live SillyTavern smoke pass after the final slice.

## Risk Register

| Risk | Mitigation |
| --- | --- |
| Circular imports after facade splits | Keep facades thin, push shared constants downward, and avoid domain modules importing from composition layers. |
| State mutation behavior changes during extraction | Move one mutation family at a time and run storage/import/export tests before continuing. |
| CSS split changes cascade order | Preserve original selector order inside imported files and make `saga.css` import files in cascade order. |
| Runtime visual regressions | Run visual smoke after each runtime or CSS slice, not only at the end. |
| Action registry becomes a new monolith | Registry routes actions only. Domain modules still own implementation. |
| Loader split breaks package import/export | Pair loader changes with `test-loredeck-zip-package.mjs` and package docs updates. |
| Global bridge cleanup breaks debugging | Move helpers under `globalThis.Saga` before deleting underscore bridge aliases. |
| Existing pre-alpha migrations obscure current state shape | Keep only migrations that protect current active testers or current saved state. Delete speculative migration paths. |

## Recommended First Slice

Start with Phase 1, the shared action registry, then Phase 2, entrypoint and prompt injector cleanup.

Reason: runtime panel extraction and startup splitting both need a stable way to invoke the same behavior from UI buttons, slash commands, toolbar/menu actions, and debug globals. Creating the action registry first reduces duplicate behavior before the larger file moves begin.
