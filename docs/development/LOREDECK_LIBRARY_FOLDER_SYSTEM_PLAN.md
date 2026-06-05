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

- Keep the default view calm: users should see a compact folder tree, a focused current-folder list, and an active stack.
- Avoid requiring drag and drop. Drag and drop should be fast and intuitive, but every action needs a button, menu, or keyboard path.
- Preserve hierarchy in the Active Stack when a folder is added, but flatten deterministically at runtime.
- Make folder health visible but not dominant. Health should summarize folder contents and open the Health Center only when needed.
- Prefer disclosure and details-on-selection over always-visible dense controls.
- Do not make folders into another Loredeck type. Folders organize and group; Loredecks contain lore.

## Library Window Layout

The Loredeck Library should evolve into a three-column layout with a bottom details panel:

```text
+------------------+-------------------------------+----------------------+
| Folder Tree      | Current Folder Contents        | Active Stack         |
|                  |                               |                      |
| All Loredecks    | Breadcrumb                    | Stack Groups / Decks |
| Bundled          | Search / Filter / Sort         |                      |
| Custom           | Folder cards first             |                      |
| Unfiled          | Loredeck cards second          |                      |
|                  |                               |                      |
+------------------+-------------------------------+----------------------+
| Selected Folder or Loredeck Details                                      |
+-------------------------------------------------------------------------+
```

### Folder Tree

The left column should be a compact tree:

- Disclosure arrows for expanding and collapsing folders.
- Folder names with nested indentation.
- Small count chips such as `12 decks`, `3 active`, or `2 warnings`.
- Aggregated health status.
- Special library views:
  - `All Loredecks`
  - `Bundled`
  - `Custom`
  - `Generated`
  - `Unfiled`
  - `Recently Imported`

Special views should behave like filters, not actual folders. They cannot be moved or deleted.

### Current Folder Contents

The center column should show the selected folder or special view:

- Breadcrumb path at top, for example `One Piece > East Blue Saga > Arlong Park`.
- Search, filter, and sort controls scoped to the current view.
- Folders first, then Loredecks.
- Folder cards should be compact "deck box" cards.
- Loredeck cards should reuse the existing Library card visual language.
- Multi-select should work across folder and Loredeck cards.

Folder cards should show:

- Folder title.
- Child folder count.
- Loredeck count.
- Active count.
- Aggregated warning/error count.
- Optional folder icon/color.

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
- Delete folder.
- Add folder to stack.
- Expand or collapse folder.
- Move selected Loredecks to folder.
- Move selected folders to folder.

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

Deleting a folder should not delete Loredecks by default.

Recommended delete prompt:

```text
Delete folder "Arlong Park"?

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
- Drag Stack Group to reorder priority.
- Drag individual Loredeck within Stack Group if the group has been converted to manual order.

Drag affordances:

- Use visible drag handles on cards where practical.
- Highlight valid drop targets.
- Show invalid drop feedback for dropping a folder into itself or its own child.
- Show a compact drop preview such as `Move 8 decks to Arlong Park`.

Accessibility fallback:

- `Move To...` dialog.
- `Add To Stack` button.
- keyboard reorder controls in the stack.
- action menu on folders and selected cards.

## Stack Groups

Adding a folder to the stack should not simply add all child Loredecks as loose deck cards. It should add the folder as a Stack Group with hierarchy intact.

Example:

```text
Active Stack
  1. Harry Potter: Core
  2. Harry Potter Year 6: Half-Blood Prince
  3. One Piece > East Blue Saga > Arlong Park
     - Arlong Park: Core
     - Arlong Park: Straw Hats
     - Arlong Park: Arlong Pirates
     - Arlong Park: Cocoyasi Village
```

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

The details panel can show more:

- Health summary.
- Top issue.
- `Open Health Center` button.
- Affected child folders/decks.

## Search, Filters, And Tags

Search should be global by default from the Library header, with an option to scope to the selected folder.

Filters should include:

- Folder path.
- Type: Bundled, Custom, Generated.
- Fandom.
- Series/saga/arc.
- Health status.
- Active/inactive.
- Tags.

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

1. Create default special views.
2. Create folder paths from bundled Loredeck `library.suggestedPath` metadata.
3. Place bundled HP split decks into:

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

4. Place Custom and Generated Loredecks without known paths into `Unfiled`.
5. Preserve any existing active stack by converting deck IDs into top-level stack items.

## MVP Scope

MVP folder system:

1. Local library index with folders, deck placements, and active stack items.
2. Suggested folder path support in Loredeck manifests.
3. Folder tree in the Loredeck Library.
4. Breadcrumb and current-folder contents view.
5. Create, rename, move, and delete folders.
6. Bulk move selected Loredecks.
7. Add folder to Active Stack as a collapsible Stack Group.
8. Runtime stack flattening.
9. Duplicate suppression with visible summary.
10. Tests for nesting, moving, deletion behavior, stack resolution, and duplicate suppression.

Out of MVP:

- Smart folders.
- Folder export/import as full collections.
- Folder icon/color editing.
- Shared folder libraries.
- Advanced stack snapshots.
- Converting Stack Groups into fully manual custom stacks.

## Risks

- Drag/drop can become fragile if it is the only interaction path. Every drag action needs a non-drag fallback.
- Folder deletion can feel destructive if content handling is unclear. Never delete child Loredecks by default.
- Duplicates can quietly corrupt context if not surfaced. Duplicate suppression must be visible.
- Very deep folder trees can become slow or noisy. The tree should virtualize or lazily render if needed.
- Folder hierarchy and Tags can overlap conceptually. UI copy should keep folders as location and Tags as classification.

## Next Development Slice

Recommended next slice:

1. Add `library.suggestedPath` to bundled HP split Loredeck manifests through the scaffold.
2. Create a local Library Index module with folder normalization and validation.
3. Add tests for folder nesting and stack flattening.
4. Render a basic folder tree in the Loredeck Library.
5. Add folder Stack Groups to the Active Stack with duplicate suppression.
