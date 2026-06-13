# Saga Danger Zone Relocation And Global Cleanup Plan

Status: Complete. The Settings-bottom Danger Zone renders Active Chat and Global groups, Session no longer renders Danger Zone, and Active Chat destructive actions use visible busy-button states while mutating chat state. Active Chat summaries use normalized accepted and pending Lorecard counts, generation-state reset clears stale pending-review selection/expanded-entry state, and reset flows preserve current rail/drawer panel geometry while returning the user to Settings. Global Danger Zone counts render immediately from cached storage state, then refresh asynchronously from the read-only cleanup preview; refresh warnings and failures are shown in the row list so stale cache state does not silently mislead the user. `Reset All Settings` is Global, removes stored Saga API key material, and uses the shared busy-button action path. Storage-backed Global cleanup actions also show busy states while preflight storage counts are loading and while confirmation is pending. Focused source-contract coverage is wired into the alpha gate. The Global cleanup services for custom Theme/Icon removal, custom Loredeck removal, and Total Saga Cleanup are implemented and covered by focused cleanup regression tests. Custom Loredeck cleanup prunes unavailable active-chat stack references after storage cleanup, while preserving surviving bundled Library placements, ancestor folders, unrelated empty folders, and valid folder stack items in the external Library index. Scoped cleanup actions now disclose legacy settings-backed payloads and route users to State Safety migration or Total Saga Cleanup instead of reporting a misleading empty result. Mixed externalized-plus-legacy cleanup confirmations and completion toasts explicitly say legacy payloads will remain until migration. Scoped cleanup failure toasts include the first compact diagnostic and tell Basic users to switch to Advanced before checking State Safety and retrying. Total Saga Cleanup preview includes legacy settings-backed payload counts, its typed confirmation says cleanup is limited to tracked/known/referenced files and that unknown unindexed orphan files may remain, and partial failures from file deletion or service diagnostics keep storage bootstrap metadata, retain the master index when retry tracking is needed, and leave a compact `total_cleanup_warning` State Safety log in the fresh active-chat state. State Safety and Danger Zone diagnostics now describe read, hydration, and write adapter failures as storage errors rather than narrowing them to write errors only.

Status addendum: Total Saga Cleanup preview also exposes structured tracked-file, known-index, additional referenced-file, repair-session, settings/key-reset, active-chat-reset, domain payload count, and limitation fields so UI copy and tests can rely on explicit cleanup facts instead of parsing display text. The Global Danger Zone row list now uses those structured file-scope counts after the async preview refresh, while keeping the cached storage-diagnostics fallback for first paint. User docs now explain the `Cleanup file scope` row as a tracked/known/referenced file preflight count, not an orphan-file scan.

Latest validation:

- `node --check src\runtime\runtime-safety-panel.js`
- `node --check src\settings\runtime-settings-tab.js`
- `node --check src\runtime\advanced-runtime-panel.js`
- `node --check src\runtime\runtime-navigation.js`
- `node tools\scripts\test-saga-danger-zone-relocation.mjs`
- `node tools\scripts\test-saga-active-stack-pruning.mjs`
- `node tools\scripts\test-saga-global-cleanup.mjs`
- `node tools\scripts\test-state-safety-contract.mjs`
- `node tools\scripts\test-saga-storage-diagnostics.mjs`
- `node tools\scripts\test-visual-smoke-harness.mjs`
- `node tools\scripts\test-saga-creator-project-storage.mjs`
- `node tools\scripts\run-alpha-gate.mjs`

All targeted checks above pass. The full alpha gate also passes with the completed Danger Zone cleanup feature included. The global cleanup regression now covers the retry-safe partial failure path where Total Saga Cleanup retains the master storage index if a tracked file cannot be deleted.

## Objective

Relocate Saga's Danger Zone from the Session tab to the bottom of the Settings tab, split destructive actions by scope, and add a smaller set of global cleanup actions that match the new external storage model.

This feature should make destructive actions easier to understand:

- **Active Chat** actions affect only the current SillyTavern chat's Saga state.
- **Global** actions affect Saga settings, Saga-owned `/user/files` storage, installed custom content, or all Saga-owned data.

The new Global section should expose only these actions:

- **Reset All Settings**
- **Remove Custom Themes + Icon Packs**
- **Remove Custom Loredecks**
- **Total Saga Cleanup**

## Current State

The current Danger Zone is rendered by `createDangerZoneCard()` in `src/runtime/runtime-safety-panel.js` and appended at the end of the Session tab by `renderSessionTab()` in `src/runtime/advanced-runtime-panel.js`.

The card currently mixes scopes:

- `Delete All Lore` is active-chat scoped.
- `Reset Generation State` is active-chat scoped.
- `Reset All Settings` is global settings scoped.
- `Total Reset` is active-chat scoped despite sounding global.

The Settings tab already renders State Safety in Advanced mode through `renderSettingsTab()` in `src/settings/runtime-settings-tab.js`. State Safety owns backups, export/restore, storage migration, storage verification, write settling, and missing indexed-record cleanup. Those are maintenance and diagnostic actions, not destructive library cleanup actions.

## Product Decisions

### Danger Zone Location

Render Danger Zone at the bottom of the Settings tab.

Proposed visibility:

- Render in Basic and Advanced Settings, because the current Session Danger Zone is available during normal use and users need a way to recover without switching modes.
- Keep State Safety Advanced-only unless separately changed.
- Keep Danger Zone collapsed by default.
- Use red danger-zone styling, but split the card internally into clear `Active Chat` and `Global` groups.

### State Safety Relationship

State Safety remains the maintenance area:

- backup current chat state
- export and restore state
- migrate legacy storage
- verify storage
- settle queued writes
- clean missing indexed file records

Danger Zone becomes the destructive action area:

- delete current-chat Saga data
- reset settings
- delete installed custom Saga content
- remove all Saga-owned storage and settings

Do not move State Safety actions into Danger Zone.

### Active Chat Actions

Keep the existing active-chat actions, with one label cleanup:

- **Delete All Lore**
  - Deletes accepted lore, pending lore, and pin/mute selections for the active chat.
  - Leaves lightweight continuity state intact.
  - Creates a State Safety backup before mutation.

- **Reset Generation State**
  - Clears detected context, pending generated lore, pending continuity changes, and generation ledgers for the active chat.
  - Leaves accepted lore intact.
  - Creates a State Safety backup before mutation.

- **Reset Active Chat**
  - Renamed from `Total Reset`.
  - Resets all active-chat Saga runtime state, including continuity, accepted lore, pending lore, generation state, and Lore Timeline.
  - Preserves panel size and position.
  - Creates a State Safety backup before mutation.

Remove **Reset All Settings** from the Active Chat group.

### Global Actions

#### Reset All Settings

Reset Saga settings to defaults and clear Saga API key material.

In scope:

- Reset Saga preferences, workflow settings, provider selections, generation settings, injection settings, UI defaults, theme overrides, and active theme/icon selections to defaults.
- Clear stored Saga provider key material for both reasoning and utility providers.
- Refresh theme variables, shelf icons, panel body, and header after reset.
- Preserve enough storage bootstrap metadata to avoid hiding or orphaning existing external Saga content.

Out of scope:

- Deleting custom Loredecks.
- Deleting custom Theme Packs or Icon Sets.
- Deleting Creator projects.
- Deleting active-chat Saga state.

Implementation note:

The current reset path preserves stored API keys. This feature intentionally changes that behavior for the global Danger Zone action. The button tooltip and confirmation text must state that stored API keys will be removed.

#### Remove Custom Themes + Icon Packs

Delete user-installed custom Theme Packs and Icon Sets, including stored raster icon assets.

In scope:

- Delete external custom Theme Pack payload files.
- Delete external custom Icon Set payload files.
- Delete uploaded icon raster assets owned by custom Icon Sets.
- Remove records from the Theme Pack and Icon Set domain indexes.
- Reset active `themePackId` and `themeIconSetId` to bundled defaults.
- Refresh theme variables and shelf icon images immediately.
- Keep bundled Theme Packs and bundled Icon Sets available.

Out of scope:

- Resetting unrelated settings.
- Deleting custom Loredecks.
- Deleting Creator projects.

Preferred storage behavior:

- Use existing owner-file deletion patterns where possible.
- If a domain index becomes empty, keep or rewrite an empty domain index rather than treating storage as broken.
- Tolerate missing files during cleanup and remove their stale index records.

#### Remove Custom Loredecks

Delete custom, imported, and generated Loredecks from Saga's external Library storage.

In scope:

- Delete non-bundled external Loredeck payload files.
- Delete cover images and other passive assets owned by those Loredecks.
- Delete health repair session files owned by those Loredecks.
- Remove custom/generated/imported Library records.
- Clear folders, placements, and active stack references that only point at removed custom Loredecks.
- Clear generated-pack links in Creator project summaries if they point to removed Loredecks.
- Keep bundled Loredecks available.
- Refresh Loredeck Library surfaces after cleanup.

Out of scope:

- Deleting in-progress Creator project payloads.
- Deleting settings or provider keys.
- Deleting active-chat accepted Lorecards generated from those Loredecks.

Rationale:

Creator projects are drafts/workflows, not installed Loredecks. The standalone Loredeck cleanup should remove installed custom content without unexpectedly deleting in-progress Creator work. **Total Saga Cleanup** handles Creator projects.

#### Total Saga Cleanup

Remove all Saga-owned global data and reset the active chat's Saga state.

The confirmation warning must explicitly say this deletes all user-created, imported, and generated Loredecks.

In scope:

- Flush queued Saga storage writes before cleanup.
- Build a preflight cleanup preview with counts.
- Delete every file listed in `saga-storage-index.v1.json`, with the master index deleted last.
- Delete known Saga domain index files even if the master index is missing or corrupt:
  - `saga-library-index.v1.json`
  - `saga-creator-index.v1.json`
  - `saga-theme-index.v1.json`
  - `saga-iconset-index.v1.json`
  - `saga-storage-index.v1.json`
- Delete known Saga payload and asset files only when they are known through indexes or existing Saga records.
- Reset in-memory storage caches after deletion.
- Remove or reset `extensionSettings.saga`.
- Clear stored Saga provider API key material.
- Reset the active chat's Saga metadata to a fresh default state.
- Refresh runtime surfaces immediately.

Out of scope:

- Deleting bundled extension assets.
- Enumerating arbitrary unknown orphan files in `/user/files`.
- Sweeping Saga metadata from every SillyTavern chat, unless SillyTavern exposes a safe chat enumeration API and we explicitly add that feature.

Important limitation:

Saga's flat `/user/files` model does not assume folder-listing support. Total cleanup can confidently delete files that Saga tracks or knows by fixed index filename. It cannot promise to discover arbitrary orphan files if a file was written outside the master index and no domain index references it.

Post-cleanup requirement:

Saga must continue working without reinstalling the extension. After Total Saga Cleanup:

- storage hydration should treat missing indexes as a clean empty state
- new imports or Creator saves should recreate indexes through the existing missing-index tolerant write paths
- Settings should render normally from defaults
- the Library should show bundled content and no custom content
- State Safety should report uninitialized or empty storage without presenting it as a fatal error

## UX Structure

At the bottom of Settings:

```text
Danger Zone

Active Chat
  Delete All Lore
  Reset Generation State
  Reset Active Chat

Global
  Reset All Settings
  Remove Custom Themes + Icon Packs
  Remove Custom Loredecks
  Total Saga Cleanup
```

Each group should include compact counts:

Active Chat:

- accepted lore count
- pending Lorecards count
- pending continuity changes count

Global:

- custom Loredeck count
- custom Theme Pack count
- custom Icon Set count
- legacy settings-backed payload count when State Safety migration is still needed
- Creator project count for Total Saga Cleanup preview
- legacy settings-backed payload count in the Total Saga Cleanup preview
- tracked Saga file count
- last storage verification summary

Avoid a large explanatory paragraph. Use tooltips, confirmation dialogs, and preview rows.

## Confirmation Model

Use normal confirmation dialogs for scoped actions:

- `Delete All Lore`
- `Reset Generation State`
- `Reset Active Chat`
- `Reset All Settings`
- `Remove Custom Themes + Icon Packs`
- `Remove Custom Loredecks`

Use typed confirmation for **Total Saga Cleanup**.

Suggested typed phrase:

```text
DELETE SAGA
```

Suggested Total Saga Cleanup confirmation copy:

```text
This will delete Saga-owned storage files, reset Saga settings, remove stored Saga API keys, reset the active chat's Saga state, and delete all user-created, imported, and generated Saga Loredecks. Bundled extension content remains available. Unknown orphan files that Saga cannot see through its indexes may remain. Type DELETE SAGA to continue.
```

## Implementation Plan

### Phase 1: Relocate And Split Danger Zone UI

Files likely involved:

- `src/runtime/runtime-safety-panel.js`
- `src/runtime/advanced-runtime-panel.js`
- `src/settings/runtime-settings-tab.js`
- `src/runtime/runtime-guide-content.js`
- `tools/scripts/test-state-safety-contract.mjs`
- `tools/scripts/test-visual-smoke-harness.mjs`

Tasks:

1. Split `createDangerZoneCard()` into scoped helpers:
   - `createActiveChatDangerZoneCard(state)`
   - `createGlobalDangerZoneCard(state, settings)`
   - `createDangerZoneCard(state)` as the composed Settings card, if keeping the exported name reduces wiring churn.
2. Remove the Danger Zone append from `renderSessionTab()`.
3. Add a Settings-bottom Danger Zone section after Theme Pack and State Safety sections.
4. Ensure Basic Settings also renders Danger Zone at the bottom.
5. Move `Reset All Settings` into the Global group.
6. Rename active-chat `Total Reset` to `Reset Active Chat`.
7. Update walkthrough copy and targets:
   - Advanced cleanup route should point to Settings Danger Zone instead of Session metrics.
   - Basic route should still be able to find cleanup actions in Settings.
8. Preserve existing red danger-zone theme tokens.

Acceptance criteria:

- Session tab no longer renders Danger Zone.
- Settings tab renders Danger Zone at the bottom.
- Active Chat and Global groups are visually distinct.
- `Reset All Settings` is not shown under Active Chat.
- `Reset Active Chat` replaces the old active-chat `Total Reset` label.

### Phase 2: Add Global Cleanup Service

Create a storage/service module instead of placing cleanup logic directly in UI code.

Proposed file:

- `src/storage/saga-global-cleanup.js`

Proposed exported functions:

```js
buildSagaGlobalCleanupPreview(options)
resetSagaGlobalSettings(options)
removeSagaCustomThemeIconStorage(options)
removeSagaCustomLoredecks(options)
runTotalSagaCleanup(options)
```

The service should:

- use the files API through `createSagaFileApi()`
- use the master index through `createSagaStorageIndexStore()`
- use domain indexes where available
- tolerate 404/missing files during cleanup
- return structured results with counts and diagnostics
- avoid direct DOM work
- expose test injection points through options

Implemented preview result shape includes:

```js
{
  ok: true,
  customLoredeckCount,
  customThemePackCount,
  customIconSetCount,
  creatorProjectCount,
  trackedFileCount,
  knownIndexFileCount,
  referencedFileCount,
  untrackedReferencedFileCount,
  repairSessionCount,
  willClearSettings: true,
  willClearApiKeys: true,
  willResetActiveChat: true,
  limitations: []
}
```

### Phase 3: Implement Reset All Settings With Key Removal

Tasks:

1. Add a settings reset path that clears stored Saga provider key material.
2. Preserve storage bootstrap metadata as needed so external storage remains discoverable.
3. Reset active theme/icon IDs to bundled defaults.
4. Refresh theme surfaces, rail icons, panel body, and header.
5. Update confirmation text to state that API keys will be removed.

Acceptance criteria:

- Stored `loreOpenAI*` and `continuityOpenAI*` key material is removed.
- Settings are reset to defaults.
- External custom Loredecks and custom Theme/Icon files are not deleted.
- Existing external content remains visible after reset and reload.

### Phase 4: Implement Remove Custom Themes + Icon Packs

Tasks:

1. Read external Theme Pack and Icon Set domain indexes.
2. For each custom Theme Pack, delete owner files and explicit payload files.
3. For each custom Icon Set, delete owner files, payload files, and raster asset files.
4. Rewrite or clear the Theme Pack and Icon Set indexes.
5. Reset active theme/icon setting IDs to bundled defaults.
6. Reset theme/icon caches and refresh UI.

Acceptance criteria:

- Custom Theme Packs are gone after refresh and reload.
- Custom Icon Sets are gone after refresh and reload.
- Uploaded icon raster files are deleted.
- Bundled Theme Packs and Icon Sets remain available.
- Active theme/icon selection falls back to bundled defaults.

### Phase 5: Implement Remove Custom Loredecks

Tasks:

1. Read the external Library index.
2. Identify non-bundled Library records.
3. Delete each custom/generated/imported Loredeck payload file.
4. Delete owner assets and explicitly referenced cover/passive assets.
5. Delete repair session files owned by removed Loredecks.
6. Remove Library records, folders, deck placements, and active stack references that only point to removed custom Loredecks.
7. Prune the active chat's runtime stack after cleanup so deleted custom Loredecks and removed folder groups do not remain loaded in the current chat.
8. Keep Creator project payloads intact. Clearing generated-pack summary links is deferred until the Creator storage contract stops inferring `generatedPackId` from `brief.packId`, because that field also represents the intended target deck id for a draft.
9. Flush and verify storage.
10. Refresh Library and runtime surfaces.

Acceptance criteria:

- Custom/generated/imported Loredecks are gone after refresh and reload.
- Bundled Loredecks remain available.
- External payload files and cover/passive asset files are deleted.
- Health repair session files for deleted Loredecks are deleted.
- Library and active-chat stacks no longer reference deleted Loredecks or removed folder groups.
- Creator projects are not deleted by this standalone action.

### Phase 6: Implement Total Saga Cleanup

Tasks:

1. [x] Flush queued writes.
2. [x] Build a preflight cleanup preview.
3. [x] Require typed confirmation.
4. [x] Delete all files listed in the master storage index, sorted so `saga-storage-index.v1.json` is last.
5. [x] Delete known domain index files even if not listed.
6. [x] Delete known master index file last even if not listed.
7. [x] Reset all storage caches:
   - Lorepack Library storage cache
   - Lorepack payload storage cache
   - Creator project storage cache
   - Theme/Icon storage cache
8. [x] Reset active chat Saga state to defaults.
9. [x] Reset or remove `extensionSettings.saga`.
10. [x] Clear stored Saga provider key material.
11. [x] Refresh theme, rail, panel body, header, and prompt injection state.
12. [x] Present a compact result summary with deleted count and any failures.

Acceptance criteria:

- All indexed Saga files are deleted or reported as already missing.
- Known Saga index files are deleted or reported as already missing.
- `extensionSettings.saga` no longer contains custom Saga settings or provider key material.
- Active chat Saga state is reset.
- Saga still opens after cleanup without reinstalling.
- New custom content can be imported after cleanup and recreates storage indexes.
- Missing index diagnostics are treated as clean/uninitialized where appropriate.

Implementation note:

- Total Saga Cleanup retains the master storage index if any non-index file deletion fails or if cleanup reports storage errors before the master index is removed. This keeps enough tracking data for a retry instead of losing references to files that still exist.
- When Total Saga Cleanup partially fails from delete failures or service diagnostics, settings reset preserves storage bootstrap metadata instead of treating cleanup as fully fresh. The active-chat reset still clears prior State Safety backups, but it writes a compact `total_cleanup_warning` log so the user has a visible diagnosis after the panel refresh.

### Phase 7: Tests And Verification

Add focused tests:

- `tools/scripts/test-saga-global-cleanup.mjs`
  - fake files API
  - master index deletion
  - master index retention when a tracked file deletion fails
  - known index fallback deletion
  - missing file tolerance
  - Total Saga Cleanup post-cleanup recreate path

- `tools/scripts/test-saga-danger-zone-relocation.mjs`
  - Session source no longer appends Danger Zone
  - Settings source renders Danger Zone
  - Active Chat and Global labels exist
  - global actions are present
  - old active-chat `Total Reset` label is gone or replaced

- `tools/scripts/test-saga-active-stack-pruning.mjs`
  - removed custom Loredeck stack items are pruned
  - removed Library folder stack items are pruned
  - retained bundled/custom stack items preserve enabled state while priorities normalize

Update existing tests:

- `tools/scripts/test-state-safety-contract.mjs`
  - State Safety still owns maintenance actions.
  - Danger Zone owns destructive cleanup actions.

- `tools/scripts/test-visual-smoke-harness.mjs`
  - Settings renders relocated Danger Zone.
  - Session no longer renders Danger Zone.
  - Global cleanup labels are guarded.

- `tools/scripts/run-alpha-gate.mjs`
  - include new focused tests.

Manual verification:

1. Import a custom Loredeck with a cover image.
2. Import a custom Theme Pack.
3. Import a custom Icon Set with raster icons.
4. Create or resume a Creator project.
5. Run `Remove Custom Themes + Icon Packs`.
6. Verify bundled theme/icons remain and raster files are removed.
7. Run `Remove Custom Loredecks`.
8. Verify custom Loredecks and owned assets are removed while bundled Loredecks remain.
9. Reimport custom content.
10. Run `Total Saga Cleanup`.
11. Reload Saga.
12. Verify Saga opens cleanly without reinstall.
13. Import a new Loredeck and verify storage indexes are recreated.

## Safety Rules

- Destructive global actions must use `runBusyAction()` and visibly update button state.
- Cleanup must tolerate missing files and report them as already gone.
- Cleanup must not silently swallow non-missing delete failures.
- Scoped cleanup must not report "none found" when legacy settings-backed payloads still need State Safety migration.
- Scoped cleanup must not imply completion when externalized content was removed but legacy settings-backed payloads remain.
- Master index deletion happens last.
- UI refresh must happen after storage cache reset.
- Buttons should be disabled while the same cleanup action is running.
- Total cleanup must not claim to delete unknown orphan files it cannot enumerate.

## Documentation Updates

Update:

- `docs/user/STORAGE_AND_STATE_SAFETY.md`
- `docs/user/OPERATOR_MANUAL.md`
- `docs/DOCUMENTATION_INDEX.md` if a new user-facing Danger Zone doc is added.

User docs should explain:

- State Safety is maintenance.
- Danger Zone is destructive cleanup.
- Total Saga Cleanup deletes custom/imported/generated Loredecks.
- Bundled content remains because it ships with the extension.
- Saga can recreate storage after cleanup without reinstalling.
- Unknown unindexed orphan files may remain because the flat files API does not provide general folder scanning.

## Resolved Implementation Decisions

1. Should Total Saga Cleanup remove `extensionSettings.saga` entirely or replace it with default settings?

   Preferred first pass: replace it with sanitized defaults. This keeps the runtime predictable after the click and avoids code paths that assume the Saga settings bucket exists.

2. Should Reset All Settings preserve storage migration metadata?

   Preferred first pass: preserve storage bootstrap paths and migration metadata, but reset all user-facing preferences and clear key material. Reset All Settings should not make existing external custom content disappear.

3. Should Remove Custom Loredecks delete Creator projects linked to generated Loredecks?

   Preferred first pass: no. Keep Creator drafts intact and do not clear generated-pack target fields until the Creator storage contract separates draft target IDs from installed-pack links. Total Saga Cleanup deletes Creator projects.

4. Should Total Saga Cleanup delete State Safety backups?

   Preferred first pass: yes for the active chat reset. A total cleanup should be clearly irreversible. If recovery is desired, users should export before running it.

## Completion Checklist

- [x] Danger Zone moved from Session to Settings.
- [x] Active Chat and Global groups implemented.
- [x] Active Chat summaries use normalized accepted and pending Lorecard counts.
- [x] Active Chat destructive actions use visible busy-button states while mutating chat state.
- [x] `Delete All Lore` clears accepted bulk selections as well as pending-review selections.
- [x] Active Chat generation-state reset clears stale expanded-entry and pending-review selection state.
- [x] Active Chat resets preserve the current rail/drawer panel geometry while returning the user to Settings.
- [x] `Reset All Settings` clears Saga API key material.
- [x] `Reset All Settings` uses the shared busy-button action path.
- [x] Global Danger Zone counts refresh asynchronously from the read-only cleanup preview after initial cached render, with visible row diagnostics for refresh warnings or failures.
- [x] Storage-backed Global cleanup actions show busy preflight and confirmation states.
- [x] `Remove Custom Themes + Icon Packs` implemented and tested.
- [x] `Remove Custom Loredecks` implemented and tested.
- [x] `Remove Custom Loredecks` prunes unavailable active-chat stack references.
- [x] `Remove Custom Loredecks` preserves surviving bundled Library placements, ancestor folders, unrelated empty folders, and valid folder stack items while pruning custom-only layout references.
- [x] Scoped cleanup buttons disclose legacy settings-backed payloads before migration.
- [x] Scoped cleanup confirmations and completion toasts disclose mixed externalized-plus-legacy cleanup limits.
- [x] Scoped cleanup failure toasts include compact first-error detail and retry guidance.
- [x] Cleanup retry guidance tells Basic users to switch to Advanced before checking State Safety.
- [x] `Total Saga Cleanup` implemented and tested.
- [x] `Total Saga Cleanup` typed-confirmation preview includes legacy settings-backed payload counts.
- [x] `Total Saga Cleanup` preview exposes structured tracked-file, known-index, additional referenced-file, repair-session, reset-effect, domain payload count, and limitation fields.
- [x] Global Danger Zone visible file-scope counts use structured cleanup preview fields after async refresh.
- [x] User docs describe the Global Danger Zone `Cleanup file scope` row and its unknown-orphan-file boundary.
- [x] `Total Saga Cleanup` typed-confirmation copy discloses that cleanup is limited to tracked/known/referenced files and unknown unindexed orphan files may remain.
- [x] `Total Saga Cleanup` partial failures from delete failures or service diagnostics retain retryable storage metadata.
- [x] `Total Saga Cleanup` partial failures leave a compact State Safety warning after active-chat reset.
- [x] `Total Saga Cleanup` regression verifies the merged Library falls back to bundled Loredecks with no custom Loredecks immediately after cleanup.
- [x] Storage diagnostics report read, hydration, and write adapter failures as storage errors.
- [x] Post-cleanup storage recreation verified.
- [x] Basic and Advanced Settings render the relocated Danger Zone source contract.
- [x] Walkthrough targets updated.
- [x] User docs updated.
- [x] Alpha gate passes after completed cleanup service work.
