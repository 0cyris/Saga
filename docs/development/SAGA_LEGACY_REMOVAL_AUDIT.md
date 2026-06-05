# Saga Legacy Removal Audit

Date: 2026-06-05

This audit marks Wandlight-era features and assumptions that should be removed, renamed, or isolated before Saga's public-facing MVP hardens. The goal is not broad cosmetic churn for its own sake. The goal is to stop shipping Wandlight-specific product behavior as if it were Saga architecture.

Implementation status: the full Wandlight chat preset product path and fast reply-header Context detection have been removed from runtime scope. Remaining high-priority cleanup starts with the root `Lore/` fallback and then moves to slash/prompt/state namespace migration.

## Current Direction

Saga should not include the full Wandlight chat-completion preset in MVP. That preset was a Harry Potter/Wandlight workflow artifact, not a general Loredeck framework feature.

Because the preset is out of scope, fast reply-header Context detection has also left MVP scope. Context should be determined by the Context tab, Context Browser, manual Context locks, local structured/date resolution, and bounded Reasoner Provider proposals against known Loredeck candidates.

## Removal Priority

### P0: Remove From Product Scope

These are user-facing or runtime-active features that conflict with Saga's current direction.

1. Full Wandlight chat preset
   - Files and code:
     - `Presets/Wandlight-1.4.json`
     - `constants.js`: `WANDLIGHT_PRESET_NAME`, `WANDLIGHT_PRESET_VERSION`, `WANDLIGHT_PRESET_ASSET_PATH`
     - `lore-panel.js`: `createWandlightPresetStatusCard`, `refreshWandlightPresetStatusCard`, `getWandlightPresetStatus`, `loadBundledWandlightPreset`, `installBundledWandlightPreset`, related version helpers, and Session-tab insertion
     - `lore-panel.js`: guide steps keyed to `session.preset`
   - Remove behavior:
     - No preset status card.
     - No install/update/download controls for the Wandlight preset.
     - No walkthrough steps that imply a preset is expected.
   - Replacement:
     - Session tab should describe Saga runtime status, loaded Loredecks, selected Context, and injection health.

2. Fast reply-header Context detection
   - Files and code:
     - `constants.js`: `contextHeaderDetectionEnabled` defaults and managed Basic settings
     - `lore-generator.js`: `WANDLIGHT_REPLY_HEADER_RE`, `extractWandlightReplyHeader`, `inferStoryContextFromReplyHeaders`, header-first branch in `runLoreContextDetection`
     - `lore-panel.js`: Fast reply-header toggle, tooltips, guide step `fast-header`
     - `scripts/test-context-header-detection.mjs`
   - Remove behavior:
     - Do not scan assistant replies for a Wandlight date/time/location/weather header.
     - Do not skip Reasoner calls based on a preset-only header format.
   - Replacement:
     - Keep source-message count and Reasoner fallback threshold.
     - Use generic local date extraction only as a cheap structured hint, then resolve against loaded Loredeck Context candidates.

3. Harry Potter-specific Context detector prompt and correction path
   - Files and code:
     - `constants.js`: `LORE_CONTEXT_DETECTION_SYSTEM_PROMPT` is explicitly "Wandlight" and "Harry Potter / Hogwarts"
     - `lore-generator.js`: `inferHarryPotterCanonBoundary`, `correctHarryPotterCanonContext`
     - `continuity-scanner.js`: `inferHpBoundaryFromText`
   - Remove behavior:
     - Do not bake HP school-year mapping into generic Saga runtime detection.
   - Replacement:
     - Context inference should receive loaded Loredeck candidates, known axes, anchors, windows, date ranges, and aliases.
     - HP date-to-year mapping belongs in the HP Golden Trio Loredeck timeline registry, not global runtime code.

4. Legacy root `Lore/` fallback
   - Files and code:
     - `Lore/` directory duplicates the migrated HP data outside the Loredeck package.
     - `loredeck-loader.js`: `LEGACY_LORE_MANIFEST_URL`, `LEGACY_LORE_INDEX_URL`, and default-pack legacy fallback.
     - `canon-lore-db.js`: comments and UI text still describe `Lore/` as the canon database root.
   - Remove behavior:
     - Loading the bundled HP deck should fail loudly if `Loredecks/hp-golden-trio/loredeck.json` is broken.
     - Do not silently fall back to `Lore/manifest.json`.
   - Replacement:
     - Treat `Loredecks/hp-golden-trio` as the only bundled HP reference deck.
     - Keep validation/smoke tests strong enough that bundled deck breakage is caught during development.

### P1: Rename Or Isolate Before Public MVP

These are not necessarily bad features, but they still expose Wandlight implementation details.

1. Slash command namespace
   - Files and code:
     - `index.js`: `/wandlight-extract`, `/wandlight-memo`, `/wandlight-state`, `/wandlight-lore-detect`, `/wandlight-lore-scan`, `/wandlight-lore-generate`, `/wandlight-lore-accept`, `/wandlight-lore-reject`, `/wandlight-lore-panel`
   - Target:
     - Add `/saga-*` commands.
     - Remove or hide `/wandlight-*` commands before public MVP unless we explicitly decide to keep compatibility aliases.

2. Prompt injection names and markers
   - Files and code:
     - `manifest.json`: `generate_interceptor: "wandlightInterceptor"`
     - `prompt-injector.js`: `wandlightInterceptor`, `wandlightSyncPromptInjection`, `wandlightClearPromptInjection`, prompt keys beginning `wandlight_`, and prompt wrappers `[WANDLIGHT ...]`
     - `memo-builder.js`: `[WANDLIGHT CONTINUITY STATE]`
   - Target:
     - Rename active prompt keys and global bridge functions to Saga.
     - Clear old Wandlight prompt keys once after migration so stale extension prompts do not remain injected.

3. Settings and chat metadata namespace
   - Files and code:
     - `constants.js`: `MODULE_KEY = 'wandlight'`
     - `state-manager.js`: reads/writes `extensionSettings.wandlight` and `chatMetadata.wandlight`
   - Target:
     - Move to `saga` settings/state keys.
     - Decide whether we perform one-time import from `wandlight` or intentionally start clean for Saga public builds.
   - Risk:
     - This touches persistence, migrations, prompt sync, and tests. Do this in a dedicated slice.

4. Provider preset naming
   - Files and code:
     - `Presets/Provider-1.2.json`
     - `constants.js`: `WANDLIGHT_PROVIDER_PRESET_*`
     - `lore-panel.js` and `ui.js`: Provider preset install/status helpers
   - Decision needed:
     - If Saga has no preset concept at all, remove this too.
     - If we keep it as a thin SillyTavern Connection Profile helper, rename it to a Saga utility profile/preset and make clear it is not a roleplay/chat preset.

5. Theme and icon legacy IDs
   - Files and code:
     - `constants.js`: default `themePackId: 'wandlight-default'`
     - `lore-panel.js`: bundled Theme Pack id `wandlight-default`
     - `Images/iconsets/saga-gold` remains a valid alternate icon set.
   - Target:
     - Rename active default theme id to a Saga name such as `saga-archive`.
     - Keep `saga-gold` only as an alternate icon set, not a Wandlight-era default.

6. User-facing copy
   - Files and code:
     - `index.js`, `auto-relevance.js`, `continuity-scanner.js`, `lore-generator.js`, `lore-panel.js`, `memo-builder.js`, docs
   - Target:
     - Prompts and UI copy should say Saga, Context, Loredecks, and Lorecards.
     - Internal comments can lag if they are not user-visible, but model prompts should not identify as Wandlight.

### P2: Defer Or Avoid Unless It Blocks Work

These are broad internal implementation names. Changing them now is high-churn and low product value unless they block a specific migration.

1. CSS class namespace
   - Files and code:
     - `style.css` and most UI builders use `wandlight-*` classes.
   - Recommendation:
     - Leave for now. This is a large CSS/DOM churn slice with little MVP value.
     - Revisit only if we want clean extension internals after feature stabilization.

2. Legacy normalization aliases
   - Files and code:
     - `lore-matrix.js`: lifecycle aliases, `activeWhen`, v2/v3 compatibility normalization
     - `state-manager.js`: `wandlightGeneration`, `wandlightPendingReview`
   - Recommendation:
     - Remove only after all bundled data, generated data, custom deck import/export, and pending review patches are schema-v3 native.
     - Until then, these helpers prevent data loss while we finish migration.

3. Existing documentation render filenames
   - Files and code:
     - `Images/documentation/renders/wandlight-*`
   - Recommendation:
     - Replace when new Saga screenshots are curated. Do not block runtime cleanup on image filename churn.

## Suggested Removal Sequence

1. Done: remove the full Wandlight preset UI and file.
2. Done: remove fast reply-header Context detection and its tests.
3. Done: replace the HP-specific Context system prompt with a Saga Context resolver prompt.
4. Next: remove the root `Lore/` fallback and update canon/health copy to refer to loaded Loredecks.
5. Add Saga slash commands and Saga prompt/global names, then remove Wandlight aliases.
6. Decide Provider preset fate: remove entirely or rename as a Saga utility preset.
7. Rename `MODULE_KEY` and persisted state only in a dedicated migration slice.

## Validation Checklist

After each removal slice:

- `node --check lore-panel.js`
- `node --check lore-generator.js`
- `node --check loredeck-loader.js`
- `node scripts/test-visual-smoke-harness.mjs`
- Existing context, gating, HP conformance, and loredeck health tests affected by the slice

After removing header detection, add or update tests around:

- Manual Context Browser selection.
- Local date/anchor resolution without a preset header.
- Reasoner proposal storage when local resolution is unresolved and threshold conditions are met.
