# Saga MVP Implementation Plan

## Objective

Build the first Saga foundation without changing Wandlight's existing runtime behavior.

The MVP should prove that the current Harry Potter database can be loaded as a Bundled Lorepack while the old `Lore/manifest.json` path still works as a fallback.

## Non-Goals For This Slice

- Full rebrand from Wandlight to Saga.
- Multi-pack stack UI.
- Lorepack editor.
- Import/export.
- GitHub updates.
- Full Story Position resolver.
- Lorepack Creator.
- Semantic conflict detection.

## Development Order

### 1. Scaffold The First Bundled Lorepack

Create:

```text
Lorepacks/hp-golden-trio/
  lorepack.json
  ...current Lore files...
```

For the first implementation, copy the current `Lore/` database into the pack instead of moving it. This avoids breaking legacy paths while the loader is being adapted.

### 2. Add Lorepack Loader Primitives

Add a small module or focused functions that can:

- Load `Lorepacks/hp-golden-trio/lorepack.json`.
- Resolve registry paths relative to that Lorepack manifest.
- Resolve entry file paths relative to that Lorepack manifest.
- Annotate loaded entries with pack metadata.
- Fall back to `Lore/manifest.json` when the Lorepack manifest is unavailable.

### 3. Preserve Existing Canon Suggestion Behavior

`proposeCanonLoreForContext` and `previewCanonLoreForContext` should keep their current external behavior.

The only internal change should be that they receive database entries from the new Lorepack-aware loader.

### 4. Add Minimal Pack Health

For MVP, Pack Health can be internal-only and limited to:

- Missing manifest.
- Missing files.
- Invalid JSON.
- Duplicate entry IDs.
- Entry count.
- Category counts.

### 5. Add State Shape Without UI Dependency

Add default state fields for future Lorepack Stack support, but do not require the UI yet.

```json
{
  "lorepackStack": [
    {
      "packId": "hp-golden-trio",
      "enabled": true,
      "priority": 100
    }
  ],
  "lorepackContexts": {}
}
```

Existing `loreContext` remains the active runtime context for this slice.

### 6. Validate

Run focused checks:

- Existing lore tests, if they do not require a browser.
- A direct loader smoke test.
- JSON parse check for the new Lorepack manifest.
- Verify loaded entry count is nonzero.
- Verify legacy fallback still points at `Lore/manifest.json`.

## Success Criteria

- `Lorepacks/hp-golden-trio/lorepack.json` exists.
- Current HP lore files are available under the Lorepack directory.
- The canon database loader can load the HP Lorepack.
- Existing canon preview/suggestion APIs still work.
- Legacy `Lore/manifest.json` fallback remains intact.
- No user-facing UI behavior changes are required yet.

