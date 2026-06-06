# Saga MVP Implementation Plan

## Historical Status

This document is a historical implementation slice. It describes the first Saga foundation, when the goal was to move the original Wandlight lore database into a single bundled Loredeck without changing runtime behavior.

It is no longer the current roadmap. Current production work is tracked in:

- [SAGA_ALPHA_RELEASE_SYSTEMS.md](SAGA_ALPHA_RELEASE_SYSTEMS.md)
- [SAGA_CORE_INTEGRATION_TESTING.md](SAGA_CORE_INTEGRATION_TESTING.md)
- [SAGA_STABILIZATION_CHECKPOINT.md](SAGA_STABILIZATION_CHECKPOINT.md)

References below to `hp-golden-trio` describe the original scaffold state, not the current desired Harry Potter reference architecture. The current direction is the split HP family: `hp-core`, Years 1-7, and Epilogue/Post-War, with Context-native schema v3 Lorecards and dense timeline registries.

## Objective

Historical implementation slice: build the first Saga foundation without changing Wandlight's existing runtime behavior.

Current status: the HP database now loads as a Bundled Loredeck from `Loredecks/hp-golden-trio`, and the old root `Lore/manifest.json` fallback has been removed.

## Non-Goals For This Slice

- Full rebrand from Wandlight to Saga.
- Multi-pack stack UI.
- Loredeck editor.
- Import/export.
- GitHub updates.
- Full Context resolver.
- Loredeck Creator.
- Semantic conflict detection.

## Development Order

### 1. Scaffold The First Bundled Loredeck

Create:

```text
Loredecks/hp-golden-trio/
  loredeck.json
  ...current Lore files...
```

For the first implementation, the current `Lore/` database was copied into the pack while the loader was being adapted. Current development treats `Loredecks/hp-golden-trio` as the source of truth.

### 2. Add Loredeck Loader Primitives

Add a small module or focused functions that can:

- Load `Loredecks/hp-golden-trio/loredeck.json`.
- Resolve registry paths relative to that Loredeck manifest.
- Resolve entry file paths relative to that Loredeck manifest.
- Annotate loaded entries with pack metadata.
- Fail through Deck Health when the Loredeck manifest is unavailable.

### 3. Preserve Existing Canon Suggestion Behavior

`proposeCanonLoreForContext` and `previewCanonLoreForContext` should keep their current external behavior.

The only internal change should be that they receive database entries from the new Loredeck-aware loader.

### 4. Add Minimal Pack Health

For MVP, Pack Health can be internal-only and limited to:

- Missing manifest.
- Missing files.
- Invalid JSON.
- Duplicate entry IDs.
- Entry count.
- Category counts.

### 5. Add State Shape Without UI Dependency

Add default state fields for future Loredeck Stack support, but do not require the UI yet.

```json
{
  "loredeckStack": [
    {
      "packId": "hp-golden-trio",
      "enabled": true,
      "priority": 100
    }
  ],
  "loredeckContexts": {}
}
```

Existing `loreContext` remains the active runtime context for this slice.

### 6. Validate

Run focused checks:

- Existing lore tests, if they do not require a browser.
- A direct loader smoke test.
- JSON parse check for the new Loredeck manifest.
- Verify loaded entry count is nonzero.
- Verify a missing bundled Loredeck manifest produces a loader/Deck Health error instead of falling back to root `Lore/`.

## Success Criteria

- `Loredecks/hp-golden-trio/loredeck.json` exists.
- Current HP lore files are available under the Loredeck directory.
- The canon database loader can load the HP Loredeck.
- Existing canon preview/suggestion APIs still work.
- Legacy root `Lore/manifest.json` fallback is removed.
- No user-facing UI behavior changes are required yet.
