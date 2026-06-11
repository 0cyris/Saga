# Saga Legacy Removal Audit

Date: 2026-06-05

This audit marks Saga-era features and assumptions that should be removed, renamed, or isolated before Saga's public-facing MVP hardens. The goal is not broad cosmetic churn for its own sake. The goal is to stop shipping Saga-specific product behavior as if it were Saga architecture.

Implementation status: the full Saga chat preset product path, fast reply-header Context detection, and root `Lore/` fallback have been removed from runtime scope. Remaining high-priority cleanup moves to slash/prompt/state namespace migration.

## Current Direction

Saga should not include the full Saga chat-completion preset in MVP. That preset was a Harry Potter/Saga workflow artifact, not a general Loredeck framework feature.

Because the preset is out of scope, fast reply-header Context detection has also left MVP scope. Context should be determined by the Context tab, Context Browser, manual Context locks, local structured/date resolution, and bounded Reasoner Provider proposals against known Loredeck candidates.

## Removal Priority

### P0: Remove From Product Scope

These are user-facing or runtime-active features that conflict with Saga's current direction.

1. Full Saga chat preset
   - Files and code:
     - `Presets/Saga-1.4.json`
     - `src/state/constants.js`: `SAGA_PRESET_NAME`, `SAGA_PRESET_VERSION`, `SAGA_PRESET_ASSET_PATH`
     - `src/runtime/lore-panel.js`: `createSagaPresetStatusCard`, `refreshSagaPresetStatusCard`, `getSagaPresetStatus`, `loadBundledSagaPreset`, `installBundledSagaPreset`, related version helpers, and Session-tab insertion
     - `src/runtime/lore-panel.js`: guide steps keyed to `session.preset`
   - Remove behavior:
     - No preset status card.
     - No install/update/download controls for the Saga preset.
     - No walkthrough steps that imply a preset is expected.
   - Replacement:
     - Session tab should describe Saga runtime status, loaded Loredecks, selected Context, and injection health.

2. Fast reply-header Context detection
   - Files and code:
     - `src/state/constants.js`: `contextHeaderDetectionEnabled` defaults and managed Basic settings
     - `src/lorecards/lore-generator.js`: `SAGA_REPLY_HEADER_RE`, `extractSagaReplyHeader`, `inferStoryContextFromReplyHeaders`, header-first branch in `runLoreContextDetection`
     - `src/runtime/lore-panel.js`: Fast reply-header toggle, tooltips, guide step `fast-header`
     - `tools/scripts/test-context-header-detection.mjs`
   - Remove behavior:
     - Do not scan assistant replies for a Saga date/time/location/weather header.
     - Do not skip Reasoner calls based on a preset-only header format.
   - Replacement:
     - Keep source-message count and Reasoner fallback threshold.
     - Use generic local date extraction only as a cheap structured hint, then resolve against loaded Loredeck Context candidates.

3. Harry Potter-specific Context detector prompt and correction path
   - Files and code:
     - `src/state/constants.js`: `LORE_CONTEXT_DETECTION_SYSTEM_PROMPT` is explicitly "Saga" and "Harry Potter / Hogwarts"
     - `src/lorecards/lore-generator.js`: `inferHarryPotterCanonBoundary`, `correctHarryPotterCanonContext`
     - `src/continuity/continuity-scanner.js`: `inferHpBoundaryFromText`
   - Remove behavior:
     - Do not bake HP school-year mapping into generic Saga runtime detection.
   - Replacement:
     - Context inference should receive loaded Loredeck candidates, known axes, anchors, windows, date ranges, and aliases.
     - HP date-to-year mapping belongs in the HP Golden Trio Loredeck timeline registry, not global runtime code.

4. Legacy root `Lore/` fallback
   - Status: removed. `content/loredecks/hp-golden-trio` is now the only bundled HP reference source.
   - Files and code:
     - Removed `Lore/` directory duplication.
     - Removed `src/loredecks/loredeck-loader.js` default-pack legacy fallback.
     - Updated `src/context/canon-lore-db.js` comments and UI text to describe active Loredecks.
   - Remove behavior:
     - Loading the bundled HP deck should fail loudly if `content/loredecks/hp-golden-trio/loredeck.json` is broken.
     - Do not silently fall back to `Lore/manifest.json`.
   - Replacement:
     - Treat `content/loredecks/hp-golden-trio` as the only bundled HP reference deck.
     - Keep validation/smoke tests strong enough that bundled deck breakage is caught during development.

### P1: Rename Or Isolate Before Public MVP

These are not necessarily bad features, but they still expose Saga implementation details.

1. Slash command namespace
   - Files and code:
     - `src/extension/index.js`: `/saga-extract`, `/saga-memo`, `/saga-state`, `/saga-lore-detect`, `/saga-lore-scan`, `/saga-lore-generate`, `/saga-lore-accept`, `/saga-lore-reject`, `/saga-lore-panel`
   - Target:
     - Add `/saga-*` commands.
     - Remove or hide `/saga-*` commands before public MVP unless we explicitly decide to keep compatibility aliases.

2. Prompt injection names and markers
   - Files and code:
     - `manifest.json`: active `generate_interceptor` now points at `sagaInterceptor`
     - `src/continuity/prompt-injector.js`: legacy aliases `sagaInterceptor`, `sagaSyncPromptInjection`, `sagaClearPromptInjection`, and prompt keys beginning `saga_`
     - `src/continuity/memo-builder.js` and `src/continuity/prompt-injector.js`: active model-visible wrappers now use `[SAGA ...]`
   - Target:
     - Rename active prompt keys and remaining global bridge functions to Saga.
     - Clear old Saga prompt keys once after migration so stale extension prompts do not remain injected.

3. Settings and chat metadata namespace
   - Files and code:
     - `src/state/constants.js`: `MODULE_KEY = 'saga'`
     - `src/state/state-manager.js`: reads/writes `extensionSettings.saga` and `chatMetadata.saga`
   - Target:
     - Move to `saga` settings/state keys.
     - Decide whether we perform one-time import from `saga` or intentionally start clean for Saga public builds.
   - Risk:
     - This touches persistence, migrations, prompt sync, and tests. Do this in a dedicated slice.

4. Provider preset naming
   - Files and code:
     - `content/presets/Provider-1.2.json`
     - `src/state/constants.js`: `SAGA_PROVIDER_PRESET_*`
     - `src/runtime/lore-panel.js` and `src/ui/ui.js`: Provider preset install/status helpers
   - Decision needed:
     - If Saga has no preset concept at all, remove this too.
     - If we keep it as a thin SillyTavern Connection Profile helper, rename it to a Saga utility profile/preset and make clear it is not a roleplay/chat preset.

5. Theme and icon legacy IDs
   - Files and code:
     - `src/state/constants.js`: default `themePackId: 'saga-default'`
     - `src/runtime/lore-panel.js`: bundled Theme Pack id `saga-default`
     - `assets/iconsets/saga-mystic` and `assets/iconsets/saga-relay` replace the retired `saga-gold` alternate icon set.
   - Target:
     - Rename active default theme id to a Saga name such as `saga-archive`.
     - Keep legacy saved `saga-gold` settings migrating to the default Hero set; do not ship the retired icon assets.

6. User-facing copy
   - Files and code:
     - `src/extension/index.js`, `src/context/auto-relevance.js`, `src/continuity/continuity-scanner.js`, `src/lorecards/lore-generator.js`, `src/runtime/lore-panel.js`, `src/continuity/memo-builder.js`, docs
   - Target:
     - Prompts and UI copy should say Saga, Context, Loredecks, and Lorecards.
     - Internal comments can lag if they are not user-visible, but model prompts should not identify as Saga.

### P2: Defer Or Avoid Unless It Blocks Work

These are broad internal implementation names. Changing them now is high-churn and low product value unless they block a specific migration.

1. CSS class namespace
   - Files and code:
     - `styles/saga.css` and most UI builders use `saga-*` classes.
   - Recommendation:
     - Leave for now. This is a large CSS/DOM churn slice with little MVP value.
     - Revisit only if we want clean extension internals after feature stabilization.

2. Legacy normalization aliases
   - Files and code:
     - `src/lorecards/lore-matrix.js`: lifecycle aliases, `activeWhen`, v2/v3 compatibility normalization
     - `src/state/state-manager.js`: `sagaGeneration`, `sagaPendingReview`
   - Recommendation:
     - Remove only after all bundled data, generated data, custom deck import/export, and pending review patches are schema-v3 native.
     - Until then, these helpers prevent data loss while we finish migration.

3. Existing documentation render filenames
   - Files and code:
     - `assets/documentation/renders/saga-*`
   - Recommendation:
     - Replace when new Saga screenshots are curated. Do not block runtime cleanup on image filename churn.

## Suggested Removal Sequence

1. Done: remove the full Saga preset UI and file.
2. Done: remove fast reply-header Context detection and its tests.
3. Done: replace the HP-specific Context system prompt with a Saga Context resolver prompt.
4. Done: remove the root `Lore/` fallback and update canon/health copy to refer to loaded Loredecks.
5. Partly done: Saga prompt wrappers, manifest interceptor, and Saga prompt globals are active. Next, add Saga slash commands, rename prompt keys, and remove Saga aliases.
6. Decide Provider preset fate: remove entirely or rename as a Saga utility preset.
7. Rename `MODULE_KEY` and persisted state only in a dedicated migration slice.

## Validation Checklist

After each removal slice:

- `node --check src/runtime/lore-panel.js`
- `node --check src/lorecards/lore-generator.js`
- `node --check src/loredecks/loredeck-loader.js`
- `node tools/scripts/test-visual-smoke-harness.mjs`
- Existing context, gating, HP conformance, and loredeck health tests affected by the slice

After removing header detection, add or update tests around:

- Manual Context Browser selection.
- Local date/anchor resolution without a preset header.
- Reasoner proposal storage when local resolution is unresolved and threshold conditions are met.
