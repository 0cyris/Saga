# Saga MVP Implementation Plan

## Objective

Build the first Saga foundation without changing Wandlight's existing runtime behavior.

The MVP should prove that the current Harry Potter database can be loaded as a Bundled Loredeck while the old `Lore/manifest.json` path still works as a fallback.

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

For the first implementation, copy the current `Lore/` database into the pack instead of moving it. This avoids breaking legacy paths while the loader is being adapted.

### 2. Add Loredeck Loader Primitives

Add a small module or focused functions that can:

- Load `Loredecks/hp-golden-trio/loredeck.json`.
- Resolve registry paths relative to that Loredeck manifest.
- Resolve entry file paths relative to that Loredeck manifest.
- Annotate loaded entries with pack metadata.
- Fall back to `Lore/manifest.json` when the Loredeck manifest is unavailable.

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
- Verify legacy fallback still points at `Lore/manifest.json`.

## Success Criteria

- `Loredecks/hp-golden-trio/loredeck.json` exists.
- Current HP lore files are available under the Loredeck directory.
- The canon database loader can load the HP Loredeck.
- Existing canon preview/suggestion APIs still work.
- Legacy `Lore/manifest.json` fallback remains intact.
- No user-facing UI behavior changes are required yet.

