# Saga State History Removal Feature

## Purpose

Saga no longer needs full state snapshot history as an in-chat recovery system. Export/import is the intended save and recovery path, while Lore Timeline owns accepted-lore recovery and audit behavior.

The old snapshot history path still writes `stateHistory` and `memoHistory` during routine mutations. That adds synchronous overhead, increases chat metadata size, complicates import/export, and preserves an undo model that is no longer exposed as a user feature.

This feature removes that history machinery completely.

## Implementation Status

Implemented in the current removal pass.

- Runtime code no longer exports or imports the snapshot-history API.
- State defaults, migration, sanitize, import, export, delta application, reset, and append-pending paths no longer preserve snapshot history.
- Mutation call sites now save the intended state change directly.
- The visual smoke harness now asserts the removed APIs and fields stay absent from runtime source.

## Original Audit

### Removable State History Fields

The original audit found history storage in defaults:

- `src/state/constants.js`
  - `DEFAULT_SETTINGS.maxSnapshots`
  - default state `memoHistory`
  - default state `stateHistory`

These fields should be removed from defaults and no longer written to chat metadata.

### Removable State Manager Functions

`src/state/state-manager.js` contained the old undo/history implementation:

- `pushStateSnapshot(state, summary, maxSnapshots)`
- `undoLastChange(state)`
- `saveStateWithSnapshot(state, maxSnapshots)`

The same module also normalized, sanitized, imported, exported, and copied history:

- `getState()` initializes `memoHistory` and `stateHistory`.
- `sanitizeLoreArraysForStorage()` trims and rewrites `stateHistory`.
- `migrateState()` recreates `memoHistory` and `stateHistory`.
- `applyDelta()` copies `memoHistory` and `stateHistory`.
- `importState()` accepts imported `memoHistory` and `stateHistory`.
- `exportState()` serializes the raw state, including history when present.
- `appendPendingLoreEntries()` exposes `snapshot` and `snapshotLabel` options.

All of these references should be removed or changed so exported state is the actual current Saga state, not an accumulated undo stack.

### Removable Call Sites

Direct `pushStateSnapshot()` imports and calls existed in:

- `src/continuity/continuity-panel.js`
- `src/continuity/continuity-scanner.js`
- `src/context/canon-lore-db.js`
- `src/runtime/lore-panel.js`

Snapshot option plumbing existed in:

- `src/context/context-panel.js`
- `src/lorecards/lore-generator.js`
- `src/lorecards/lorecards-panel.js`
- `src/extension/saga-tool-registry.js`
- `src/state/state-manager.js` via `appendPendingLoreEntries()`

The recent smoke assertion that expects optimized snapshot cloning should also be removed and replaced with absence assertions.

## Do Not Remove

Some similarly named concepts are not this feature:

- Lore Timeline entry history in `lore-timeline.js`. This is current lore audit/recovery behavior.
- `sceneSnapshot` in `src/continuity/continuity-scanner.js`. This is model output structure for recent scene observations.
- Scroll-position snapshots in Library and Health Center overlays.
- Live smoke metadata/settings snapshots in `tools/scripts/smoke-live-st-cdp.mjs`.
- Documentation references to chat history or audit history unless they explicitly describe the removed `stateHistory`/`memoHistory` feature.

## Target Behavior

After this feature:

- Routine state mutations do not clone or store full state snapshots.
- Chat metadata does not grow because of undo history.
- Exported state does not include `memoHistory` or `stateHistory`.
- Imported state ignores any legacy `memoHistory` or `stateHistory` keys.
- No runtime feature references `maxSnapshots`.
- Undo/history helpers are absent from the runtime API.
- Lore Timeline remains available for accepted-lore recovery.
- Destructive flows continue to say they cannot be undone unless import or Lore Timeline recovery applies.

## Implementation Plan

### 1. Remove Defaults

Delete:

- `DEFAULT_SETTINGS.maxSnapshots`
- default state `memoHistory`
- default state `stateHistory`

Check any settings reset or UI code that may iterate over `DEFAULT_SETTINGS` and ensure it does not assume `maxSnapshots`.

### 2. Remove State Manager History API

Delete:

- `pushStateSnapshot()`
- `undoLastChange()`
- `saveStateWithSnapshot()`

Update the file header from "snapshot history and undo" language to current state CRUD, settings I/O, migration, delta merging, export/import, and storage safety.

### 3. Remove History Normalization and Preservation

In `src/state/state-manager.js`:

- Stop initializing `memoHistory` and `stateHistory` in `getState()`.
- Remove `stateHistory` sanitization from `sanitizeLoreArraysForStorage()`.
- Stop recreating history arrays in `migrateState()`.
- Stop copying history arrays in `applyDelta()`.
- Stop importing history arrays in `importState()`.
- Make `exportState()` either stringify a cleaned copy or rely on state no longer having those fields.

Because there are no users yet, no formal migration is needed. For local development resilience, `importState()` can simply ignore legacy history keys if they appear in old test data.

### 4. Remove Mutation Snapshot Calls

Delete `pushStateSnapshot()` imports and calls from:

- `src/continuity/continuity-panel.js`
- `src/continuity/continuity-scanner.js`
- `src/context/canon-lore-db.js`
- `src/runtime/lore-panel.js`

Do not replace them with another history mechanism. The mutation should proceed directly to applying the change and saving state.

### 5. Remove Snapshot Options

In `appendPendingLoreEntries()`:

- Remove `snapshot` and `snapshotLabel` from options.
- Remove the conditional call to `pushStateSnapshot()`.
- Keep `syncPrompt` and `full` options if still useful.

Then remove `snapshot` / `snapshotLabel` arguments from:

- `src/context/context-panel.js`
- `src/lorecards/lore-generator.js`
- `src/lorecards/lorecards-panel.js`
- `src/extension/saga-tool-registry.js`

### 6. Update Reset and Export Semantics

In the Danger Zone:

- Remove explicit clearing of `defaults.stateHistory` and `defaults.memoHistory`.
- Keep destructive confirmation language clear.

For export/import:

- Ensure exported Saga state omits history fields even if stale local metadata still has them.
- Ensure import does not restore history fields from old JSON.

### 7. Update Tests and Contracts

Replace the recent snapshot optimization smoke assertion with absence checks:

- No `pushStateSnapshot`.
- No `undoLastChange`.
- No `saveStateWithSnapshot`.
- No `stateHistory`.
- No `memoHistory`.
- No `maxSnapshots`.
- No `snapshotLabel`.
- No `snapshot:` options in runtime source, except unrelated live-smoke metadata snapshots if the assertion scope includes scripts.

Keep the existing Lore Timeline tests.

## Verification

Run syntax checks for touched modules:

```powershell
node --check src/state/state-manager.js
node --check src/runtime/lore-panel.js
node --check src/context/canon-lore-db.js
node --check src/continuity/continuity-panel.js
node --check src/continuity/continuity-scanner.js
node --check src/context/context-panel.js
node --check src/lorecards/lore-generator.js
node --check src/lorecards/lorecards-panel.js
node --check src/extension/saga-tool-registry.js
```

Run focused contract tests:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\test-lore-timeline.mjs
node tools\scripts\test-loredeck-library-folders.mjs
```

Run source absence checks:

```powershell
rg -n "stateHistory|memoHistory|pushStateSnapshot|undoLastChange|saveStateWithSnapshot|maxSnapshots|snapshotLabel" -S src\state\constants.js src\state\state-manager.js src\runtime\lore-panel.js src\context\canon-lore-db.js src\continuity\continuity-panel.js src\continuity\continuity-scanner.js src\context\context-panel.js src\lorecards\lore-generator.js src\lorecards\lorecards-panel.js src\extension\saga-tool-registry.js tools\scripts\test-visual-smoke-harness.mjs
```

Expected result: no matches, except intentional unrelated documentation if the search scope is broadened.

## Acceptance Criteria

- Stack add/drop no longer pays any snapshot-history cost.
- Continuity scan apply, context proposal apply, canon proposal, and generated-lore append no longer write undo snapshots.
- Exported Saga state contains current state only.
- Imported Saga state ignores old history fields.
- Existing Lore Timeline recovery remains intact.
- Visual smoke and Lore Timeline tests pass.
