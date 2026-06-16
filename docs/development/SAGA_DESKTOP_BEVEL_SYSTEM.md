# Saga Desktop Bevel System

Status: draft audit and design guide
Date: 2026-06-15

## Problem

Desktop Saga uses too many nearby bevel values for the same visual job. The Lorecards workspace makes this especially visible: Search, the A/P/R sort button, Capture/Suggest, Automation, Timeline, filter chips, Lorecard rows, the detail card, and edit/action buttons all sit in one control cluster but currently read as different component families.

This is not just a Lorecards issue. A repository-wide CSS audit found these `border-radius` values across the primary Saga styles:

| Radius | Count | Current meaning |
| --- | ---: | --- |
| `7px` | 82 | Most common interior drift value; cards, rows, launch surfaces, assorted controls. |
| `6px` | 47 | Runtime buttons, compact tabs, chip base, several controls. |
| `8px` | 30 | Larger interior cards, mobile/touch controls, some workbench rows. |
| `999px` | 23 | True pills, switches, progress tracks, but also some controls that should not be pills. |
| `5px` | 13 | Small fields/tiles and some local controls. |
| `0` | 11 | Joined rows, flush mobile/workbench regions. |
| `50%` | 11 | Circular icons/spinners/toggles. |
| `4px` | 9 | Tiny controls, selects, tiles. |
| `10px` | 7 | Runtime rail, drawer, workbench shells. |
| `3px` | 6 | Legacy close/search/tab controls. |

The practical issue is that `6px`, `7px`, and `8px` are used interchangeably. That makes dense desktop UI look like it was assembled from unrelated systems.

## Design Decision

Use a small bevel scale with explicit jobs:

```css
--saga-radius-window: 10px;
--saga-radius-surface: 8px;
--saga-radius-control: 6px;
--saga-radius-micro: 4px;
--saga-radius-none: 0;
--saga-radius-round: 999px;
```

### Tier Meanings

| Token | Value | Use |
| --- | ---: | --- |
| `--saga-radius-window` | `10px` | Exterior Saga shell surfaces: desktop rail, drawer, fullscreen workbench shells, modal shells. |
| `--saga-radius-surface` | `8px` | Large interior framed surfaces that read as cards or panels, especially when they contain multiple controls. |
| `--saga-radius-control` | `6px` | Default desktop interior bevel. Buttons, inputs, compact cards, list rows, detail cards, segmented controls, filter chips, edit boxes. This matches the current `.saga-runtime-button` radius and chip radius. |
| `--saga-radius-micro` | `4px` | Very small affordances, thumbnails, tiny select boxes, icon-in-icon details where `6px` visibly rounds too much. |
| `--saga-radius-none` | `0` | Joined elements, flush subregions, tab bodies connected to a header, deliberate square art/canvas edges. |
| `--saga-radius-round` | `999px` | Only true pills/tracks: switches, progress tracks, order dots, avatars, circular indicators. Not default for segmented controls or filter buttons. |

## Core Rule

Desktop interior UI defaults to `6px`.

Do not introduce new one-off radii like `5px`, `7px`, or `9px` unless the element is in a documented exception category. Existing `7px` should migrate to either `6px` or `8px` based on whether the component behaves like an interior control/list row or a larger panel.

## Desktop Lorecards Target

The Lorecards workspace should become the first implementation target because its top bar exposes the current inconsistency in one viewport.

Conform these to `--saga-radius-control`:

- Search Lorecards input.
- A/P/R square sort cycle button.
- Capture/Suggest, Automation, and Timeline buttons.
- Filter chips: All, Needs Review, Active, Pinned, Muted, Conflicts.
- Lorecard list rows.
- Lorecard detail card.
- Detail action buttons: Pin, Mute, Edit.
- Inline edit boxes and textareas.

Keep only semantic exceptions:

- Active Lorecard status dot remains circular.
- Switch sliders remain rounded tracks.
- True chips created through the chip schema use `--saga-chip-radius`, which should resolve to the same `6px` control radius.

The A/P/R sort control should not look like a separate pill family. It should read as a compact square cycle button aligned to the Search Lorecards input bevel, with typography scaled below the main buttons.

## Desktop Shell Target

Conform these to `--saga-radius-window`:

- Runtime rail exterior.
- Runtime drawer exterior.
- Fullscreen Library, Creator, Context, Pack Health, Timeline, and modal workbench shells.
- Confirmation shell.

Do not apply `--saga-radius-window` inside the workspace body. That makes dense controls too soft and visually competes with the outer shell.

## Surface Target

Use `--saga-radius-surface` for large framed panels that are clearly below the outer shell but above individual controls:

- Major cards containing several rows or tool clusters.
- Collapsible section bodies when they visually read as a container.
- Mobile touch cards where a slightly larger radius helps affordance and finger targeting.

Avoid nesting many `8px` surfaces. If a card contains repeated rows, the rows should use `6px`.

## Token Placement

Add the bevel tokens to the same runtime token scope that owns current Saga theme variables:

```css
.saga-lore-panel {
  --saga-radius-window: 10px;
  --saga-radius-surface: 8px;
  --saga-radius-control: 6px;
  --saga-radius-micro: 4px;
  --saga-radius-none: 0;
  --saga-radius-round: 999px;
  --saga-chip-radius: var(--saga-radius-control);
}
```

Once tokens exist, new CSS should use tokens instead of literals:

```css
.saga-runtime-button,
.saga-lore-search,
.saga-lorecard-workspace-row {
  border-radius: var(--saga-radius-control);
}
```

## Migration Plan

1. Add bevel tokens and static guardrails.
2. Normalize the desktop Lorecards workspace top bar and card/detail surfaces.
3. Normalize the shared runtime controls: `.saga-runtime-button`, inputs, selects, status chips, compact action rows.
4. Normalize the desktop rail/drawer/workbench shell exteriors to `--saga-radius-window`.
5. Migrate the largest `7px` clusters to either `6px` or `8px`.
6. Leave `999px` only for true round/pill semantics and document each remaining use.
7. Add a static audit script or smoke assertion that rejects new literal `7px`, `5px`, or `9px` radii in desktop Saga CSS unless explicitly allowlisted.

## Acceptance Criteria

- Desktop Lorecards top bar reads as one component family.
- Shelf/drawer/workbench exteriors share one broad bevel.
- Interior controls share a sharper bevel matching runtime buttons.
- Chips no longer drift into pill shapes unless they are intentionally round/toggle elements.
- Future components choose from named bevel tokens rather than literal radii.
- Visual smoke covers at least one dense desktop workspace after migration.

## Open Questions

- Should `--saga-radius-surface` be used often, or should most interior cards collapse directly to `--saga-radius-control`? The Lorecards first pass should answer this visually.
- Should mobile keep `8px` as the default touch-card radius, or should mobile also inherit the `6px` desktop control radius for smaller rows?
- Should legacy `components.css` be normalized now or left until the active runtime extraction is complete?
