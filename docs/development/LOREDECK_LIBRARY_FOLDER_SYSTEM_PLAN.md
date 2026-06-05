# Loredeck Library Folder System Plan

## Purpose

Saga needs a folder system for the Loredeck Library before bundled and custom collections grow beyond a small handful of decks. Harry Potter already wants Core, Years 1-7, and Epilogue. A fandom like One Piece may need dozens of Loredecks across sagas, arcs, crews, locations, factions, and special-purpose decks.

The folder system should visually condense large libraries without making Loredeck loading feel like file management. It should support deep organization, fast browsing, bulk actions, and folder-level stacking while preserving the current Library's deck-card clarity.

## Core Mental Model

Folders organize the Library. Tags classify across folders. Stack Groups load folders.

This keeps three concepts separate:

- Folders answer: "Where does this Loredeck live in my library?"
- Tags answer: "What is this Loredeck about, across all locations?"
- Stack Groups answer: "What grouped set of Loredecks am I loading for this session?"

A Loredeck should have one primary library location. If a user wants cross-cutting collections such as `villains`, `romance`, `canon-divergence`, or `high-priority`, those should be Tags or saved filters rather than duplicate folder placements.

Example structure:

```text
One Piece
  East Blue Saga
    Romance Dawn
    Orange Town
    Syrup Village
    Baratie
    Arlong Park
      Arlong Park: Core
      Arlong Park: Straw Hats
      Arlong Park: Arlong Pirates
      Arlong Park: Cocoyasi Village
      Arlong Park: Maps & Locations
      Arlong Park: Powers & Combat
```

## UX Principles

- Keep the default view calm: users should see one hierarchical Library column, a compact action/transfer lane, and an active stack.
- Avoid requiring drag and drop. Drag and drop should be fast and intuitive, but every action needs a button, menu, or keyboard path.
- Preserve hierarchy in the Active Stack when a folder is added, but flatten deterministically at runtime.
- Make folder health visible but not dominant. Health should summarize folder contents and open the Health Center only when needed.
- Prefer disclosure and details-on-selection over always-visible dense controls.
- Do not make folders into another Loredeck type. Folders organize and group; Loredecks contain lore.
- Do not use a separate side-folder tree as the primary model. Folders should be first-class Library items, not a disconnected filter menu.

## Library Window Layout

The Loredeck Library should keep the current Library/Stack workbench shape, but the Library column becomes a hierarchical deck-box list. Folders appear inline as expandable bars among Loredecks instead of living in a separate left-side tree.

```text
Library                           Transfer / Actions      Active Stack
+-------------------------------+----------------------+----------------------+
| Search / filters / sort       | Add to Stack         | Stack Groups / Decks |
|                               | Remove from Stack    |                      |
| v Harry Potter                | Add All Matching     | 1. HP Golden Trio    |
|   v Golden Trio               | Clear Stack          |    8 decks           |
|     Harry Potter: Core        | Duplicate / Delete   |                      |
|     Year 1                    |                      | 2. Custom AU Folder  |
|     Year 2                    |                      |                      |
| > One Piece                   |                      |                      |
| Unfiled                       |                      |                      |
+-------------------------------+----------------------+----------------------+
| Selected Folder or Loredeck Details                                      |
+-------------------------------------------------------------------------+
```

The old side-folder-tree approach is deprecated. It costs horizontal space, separates folder manipulation from deck manipulation, and makes folder-to-stack loading feel indirect.

### Inline Hierarchical Library Column

The Library column should show folders and Loredecks in one scrollable hierarchy:

- Folder rows are compact horizontal bars with a disclosure arrow, drag handle, folder icon, title, and metadata chips.
- Expanded folders reveal child folders and Loredecks with indentation.
- Collapsed folders show only the folder bar and aggregate counts.
- Loredeck cards keep the existing Library card visual language, but nest under folders.
- Root-level Loredecks and root-level folders share the same list.
- `Unfiled` can appear as a pinned root folder-like section for decks without placement, but it is a system section and cannot be renamed or removed.
- Type filters such as `All`, `Bundled`, `Custom`, `Generated`, `Warnings`, and `Recently Imported` should live in filter chips, dropdowns, or saved views, not as folders.

Folder rows should show:

- Disclosure state.
- Folder title.
- Cover tile strip from representative child Loredecks.
- Child folder count.
- Loredeck count.
- Active count.
- Aggregated warning/error count.
- Optional folder icon/color after MVP.

### Folder Cover Tile Strip

Folder rows should use Loredeck covers as small overlapping tiles, like books or files visible inside a folder. This gives large fandom collections a stronger visual identity without requiring users to open every folder.

Visual treatment:

- Place the cover tile strip below the folder title and above or beside metadata chips, depending on available width.
- Use 3-5 square cover tiles at most.
- Overlap tiles left to right with a small offset, similar to a hand of cards or files in a folder.
- Use the same beveled/clipped cover treatment as Loredeck preview images.
- Add a final `+N` tile when the folder has more covered Loredecks than displayed.
- Keep tiles decorative and compact; the folder title and chips remain the primary readable information.
- On hover, the tile fan can spread by a few pixels if reduced-motion is not enabled.

Representative cover selection:

1. Use directly contained Loredecks first, ordered by folder sort order.
2. If fewer than 3 covers exist directly, pull from nested child folders in deterministic folder order.
3. Prefer Loredecks with `assets.cover.path`.
4. If the folder is in the Active Stack, optionally bias active/loaded child Loredecks first.
5. If no covers exist, fall back to a folder icon, monogram, or theme icon.

Performance and accessibility:

- Lazy-load cover images.
- Do not load more than the displayed tile count plus one count tile.
- Mark cover tiles as decorative with text alternatives handled by the folder title.
- Respect reduced-motion settings for hover spread and expand/collapse animation.

Selecting a folder should show folder details in the bottom details panel. Selecting a Loredeck should show Loredeck details.

Folder details should include:

- Path.
- Total nested Loredecks.
- Direct child folders.
- Direct Loredecks.
- Aggregated health.
- Actions: add to stack, create subfolder, rename, remove folder.

The Library column still needs filter and search controls above the hierarchy. Search results should preserve the hierarchy by showing matching branches rather than flattening all matches into a loose list.

### Active Stack

The right column should support both individual Loredecks and folder Stack Groups.

When a folder is added to the stack, it becomes a collapsible Stack Group:

- Shows folder title and path.
- Shows total resolved Loredeck count.
- Shows enabled count.
- Shows aggregated health.
- Can be collapsed or expanded.
- Can be dragged as one stack item.
- Can be disabled as one stack item.
- Can be removed as one stack item.

Expanded Stack Groups should preserve folder hierarchy visually, but runtime injection should flatten them into a deterministic ordered list.

## Required Folder Actions

Folder actions for MVP:

- Create folder.
- Create subfolder.
- Rename folder.
- Move folder.
- Remove folder without deleting contained Loredecks.
- Add folder to stack.
- Expand or collapse folder.
- Move selected Loredecks to folder.
- Move selected folders to folder.

These actions should be available through the selected-folder details panel and a compact folder row action menu. Drag and drop is the fast path, not the only path.

Folder actions after MVP:

- Duplicate folder structure.
- Export folder as a Loredeck bundle/zip.
- Assign folder icon or color.
- Saved smart folders from filters.
- Folder-level notes.

## Required Loredeck Actions

Loredeck actions should continue to live in the Library, but folder support adds:

- Move to folder.
- Move to parent folder.
- Move to Unfiled.
- Add selected Loredecks to stack.
- Add selected Loredecks to a new folder.
- Bulk move selected Loredecks.
- Bulk remove selected Loredecks from current folder.

Removing a folder should not delete Loredecks by default.

Recommended remove prompt:

```text
Remove folder "Arlong Park"?

Choose what happens to its contents:

[Move contents to parent folder]
[Move contents to Unfiled]
[Cancel]
```

Deleting Custom or Generated Loredecks should remain a separate destructive action with its own confirmation.

## Drag And Drop

Drag and drop should support:

- Drag Loredeck into folder.
- Drag selected Loredecks into folder.
- Drag folder into folder.
- Drag folder out to parent.
- Drag folder to Active Stack.
- Drag selected folders and Loredecks to Active Stack.
- Drag folder rows within the Library column to reorder folders.
- Drag Loredeck cards within the Library column to reorder them inside their folder.
- Drag Stack Group to reorder priority.
- Drag individual Loredeck within Stack Group if the group has been converted to manual order.

Drag affordances:

- Use visible drag handles on cards where practical.
- Highlight valid drop targets.
- Show invalid drop feedback for dropping a folder into itself or its own child.
- Show a compact drop preview such as `Move 8 decks to Arlong Park`.
- Auto-scroll the Library or Stack column when dragging near the top or bottom edge.
- Animate folder expansion/collapse and reorder displacement smoothly.

Accessibility fallback:

- `Move To...` dialog.
- `Add To Stack` button.
- `Add Folder To Stack` action in the folder details panel.
- keyboard reorder controls in the stack.
- action menu on folders and selected cards.

## Stack Groups

Adding a folder to the stack should not simply add all child Loredecks as loose deck cards. It should add the folder as a Stack Group with hierarchy intact.

Users should be able to add a folder to the stack by:

- Dragging the folder row from the Library column into the Active Stack column.
- Selecting the folder and clicking `Add Folder To Stack` in the details panel.
- Using a folder row action menu.

Example:

```text
Active Stack
  1. Harry Potter > Golden Trio
     8 decks
     - Harry Potter: Core
     - Year 1: Philosopher's Stone
     - Year 2: Chamber of Secrets

  2. One Piece > East Blue Saga > Arlong Park
     - Arlong Park: Core
     - Arlong Park: Straw Hats
     - Arlong Park: Arlong Pirates
     - Arlong Park: Cocoyasi Village
```

Stack Group cards should show:

- Folder title and compact path.
- Resolved nested Loredeck count.
- Enabled/disabled state.
- Duplicate suppression count when applicable.
- Aggregated health.
- Collapse/expand state.

Runtime resolution:

1. Read Active Stack top to bottom.
2. If item is a Loredeck, add it.
3. If item is a Stack Group, recursively collect folder contents in folder sort order.
4. Apply enabled/disabled state.
5. Suppress duplicates.
6. Preserve first/highest-priority occurrence.

Duplicate behavior:

- Highest-priority occurrence wins.
- Later duplicate is suppressed.
- UI should show a small summary such as `3 duplicates suppressed`.
- Details should reveal which decks were suppressed and where the winning copy is loaded.

## Data Model

The user's folder organization should live in a local library index, not inside the Loredeck manifest. Loredeck manifests can suggest default paths, but the user's local placement wins.

Suggested local index shape:

```json
{
  "schemaVersion": 1,
  "folders": [
    {
      "id": "folder_one_piece",
      "parentId": null,
      "title": "One Piece",
      "sortOrder": 100,
      "icon": "compass",
      "color": "gold",
      "createdAt": 1780000000000,
      "updatedAt": 1780000000000
    }
  ],
  "deckPlacements": [
    {
      "deckId": "onepiece-arlong-park-core",
      "folderId": "folder_arlong_park",
      "sortOrder": 100,
      "updatedAt": 1780000000000
    }
  ],
  "activeStack": [
    {
      "id": "stack_item_arlong_park",
      "type": "folder",
      "folderId": "folder_arlong_park",
      "includeNested": true,
      "enabled": true,
      "sortOrder": 300
    }
  ]
}
```

Suggested Loredeck manifest addition:

```json
{
  "library": {
    "suggestedPath": ["One Piece", "East Blue Saga", "Arlong Park"],
    "familyOrder": 30
  }
}
```

Bundled Loredecks should use suggested paths so first-run organization is automatic.

Custom/Generated Loredecks can start in `Unfiled` unless they declare a suggested path or the user chooses a destination during import/creation.

## Folder Health

Folder health should aggregate child folder and Loredeck health:

- Error count.
- Warning count.
- Suggestion count.
- Disabled deck count.
- Duplicate suppression count when stacked.
- Missing file/icon/poster count if assets become part of Loredeck packages.

The folder card should only show the most important summary:

```text
12 decks | 0 errors | 3 warnings
```

The folder row should also show representative cover tiles, but missing cover art should not itself make a folder unhealthy. Missing cover art belongs in optional asset coverage details unless a Theme Pack or Loredeck explicitly declares the asset as required.

The details panel can show more:

- Health summary.
- Top issue.
- `Open Health Center` button.
- Affected child folders/decks.

## Search, Filters, And Tags

Search should be global by default from the Library header, with an option to scope to the selected folder or branch.

When search is active, Saga should preserve hierarchy:

- If a nested Loredeck matches, show its parent folders.
- Temporarily expand matching branches.
- Add match chips such as `3 matches` to folder rows.
- Hide nonmatching sibling branches unless they are needed to show the path.
- Restore the user's prior expanded/collapsed state when search clears.

Filters should include:

- Folder path.
- Type: Bundled, Custom, Generated.
- Fandom.
- Series/saga/arc.
- Health status.
- Active/inactive.
- Tags.

Filters should behave like list constraints, not folders. A `Bundled` filter can show bundled decks while still preserving their folder branches. A `Custom` filter can show custom decks without requiring a `Custom` folder.

Tags should remain separate from folders. A Loredeck in:

```text
One Piece > East Blue Saga > Arlong Park
```

can still have tags such as:

```text
character:arlong
faction:arlong-pirates
location:cocoyasi-village
theme:oppression
```

This avoids forcing one folder tree to solve every organizational need.

## Import And Creation Flow

Import flow should ask for folder destination:

- Use suggested path.
- Choose folder.
- Create new folder.
- Place in Unfiled.

Loredeck Creator should ask for destination late in the wizard, after scope has been approved:

- Suggested destination from fandom/saga/arc.
- Existing folder picker.
- Create folder path.

If an imported Loredeck declares a suggested path that does not exist, Saga can offer:

```text
Create suggested folders?
One Piece > East Blue Saga > Arlong Park
```

## Migration

Initial migration should:

1. Create folder paths from bundled Loredeck `library.suggestedPath` metadata.
2. Render those paths as inline expandable folder rows in the Library column.
3. Keep special views as filters or saved views, not folders.
4. Place bundled HP split decks into:

```text
Harry Potter
  Golden Trio
    Core
    Year 1: Philosopher's Stone
    Year 2: Chamber of Secrets
    Year 3: Prisoner of Azkaban
    Year 4: Goblet of Fire
    Year 5: Order of the Phoenix
    Year 6: Half-Blood Prince
    Year 7: Deathly Hallows
    Post-War Years & Epilogue
```

5. Place Custom and Generated Loredecks without known paths into `Unfiled`.
6. Preserve any existing active stack by converting deck IDs into top-level stack items.

## MVP Scope

MVP folder system:

1. Local library index with folders, deck placements, and active stack items.
2. Suggested folder path support in Loredeck manifests.
3. Inline expandable folder rows inside the Loredeck Library column.
4. Folder selection details in the bottom details panel.
5. Representative folder cover tile strips using child Loredeck cover assets.
6. Create, rename, move, and remove folders without deleting contained Loredecks.
7. Bulk move selected Loredecks.
8. Add folder to Active Stack as a collapsible Stack Group.
9. Runtime stack flattening.
10. Duplicate suppression with visible summary.
11. Hierarchy-preserving search behavior.
12. Tests for nesting, moving, removal behavior, folder cover selection, stack resolution, search branch display, and duplicate suppression.

Out of MVP:

- Smart folders.
- Folder export/import as full collections.
- Folder icon/color editing.
- Shared folder libraries.
- Advanced stack snapshots.
- Converting Stack Groups into fully manual custom stacks.

## Risks

- Drag/drop can become fragile if it is the only interaction path. Every drag action needs a non-drag fallback.
- Folder removal can feel destructive if content handling is unclear. Never delete child Loredecks by default.
- Duplicates can quietly corrupt context if not surfaced. Duplicate suppression must be visible.
- Very deep folder hierarchies can become slow or noisy. The Library hierarchy should virtualize or lazily render if needed.
- Folder hierarchy and Tags can overlap conceptually. UI copy should keep folders as location and Tags as classification.
- Inline hierarchy can become visually dense. Folder rows should stay compact, collapsed by default where appropriate, and rely on details-on-selection for deeper information.
- Search can become confusing if it flattens results. Search should preserve matching branches and restore expansion state afterward.

## Implementation Status

Done:

1. `library.suggestedPath` metadata exists on the bundled HP split Loredecks.
2. `Loredecks/index.json` registers the bundled HP split deck family.
3. `loredeck-library-index.js` normalizes folders, deck placements, suggested paths, and folder stack resolution.
4. Folder/index tests cover nested folders, suggested paths, stack flattening, and duplicate suppression.
5. The Loredeck Library now loads the bundled index and derives folders from suggested paths.
6. Deprecated/transitional: the current UI renders a separate folder browser with special views and scoped deck lists. This should be replaced by inline expandable folder rows inside the Library column.

Recommended next slice:

1. Replace the side folder browser with inline expandable folder rows in the Library column.
2. Render Loredecks nested under expanded folders, with compact indentation and smooth expand/collapse animation.
3. Add folder row selection and folder details in the bottom details panel.
4. Add folder mutation controls: create folder, create subfolder, rename folder, remove folder without deleting contained Loredecks, and move selected decks to folder.
5. Add drag/drop for folder rows and Loredeck cards: reorder, move into folders, move out to parent/root, and drag folders to Active Stack.
6. Add folder Stack Groups to the Active Stack with collapsible hierarchy and visible duplicate suppression.
7. Replace the remaining monolithic `hp-golden-trio` default stack/library references with the split HP deck family once entry migration is ready.
8. Expand tests for inline hierarchy rendering, folder mutation behavior, invalid moves, removal-content handling, stack groups, hierarchy-preserving search, and Library UI smoke selectors.
