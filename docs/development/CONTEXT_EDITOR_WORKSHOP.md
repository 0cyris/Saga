# Context Browser And Timeline Registry Workshop

This document began as the Context Editor workshop. Clarified direction: **Context is the user-facing Context system**. The internal structured object may remain `context`, but users should browse, resolve, lock, and monitor **Context**.

Saga's Context system answers a simple runtime question:

> Where is this chat inside each loaded Loredeck's story?

The browser/workbench exists to make that answer precise enough to prevent future canon leakage, flexible enough for many fandom structures, and usable enough that casual users do not need to hand-build a thousand-row timeline before playing.

## Product Goal

Saga needs two related surfaces:

- **Context Browser** in the Context tab for runtime play.
- **Timeline Registry Workbench** in the Loredeck tab for deck creation/editing.

Together they should let users and creators:

- Set the current chat Context for each loaded Loredeck.
- Search and select known story anchors, windows, dates, arcs, chapters, episodes, quests, issues, routes, and AU branches.
- Edit a Loredeck's timeline registry through reviewable Custom overlays.
- Resolve user phrasing into Context through local candidates and the Reasoner Provider.
- See which Lorecards attach to each anchor/window.
- Fix timeline gaps, sparse coverage, broken windows, and unmatchable gates.
- Use AI assistance to draft or revise timeline structure without silently mutating accepted data.

This is not primarily a lore trivia editor. It is the map that allows Saga to decide which Lorecards are eligible at a given point in a story.

## Runtime Location

Runtime Context selection should live in the **Context tab**, not permanently in the Loredeck tab.

The existing Loredeck-side Context workbench can remain during transition, but the migration target is:

- Context tab: choose starting Context, browse Context, resolve from chat/phrase, lock/unlock, review suspected jumps.
- Loredeck tab: edit source timeline registries, inspect attached Lorecards, validate coverage, queue timeline patches.

The full Context Browser should be a fullscreen workbench launched from the Context tab. The compact Context panel should show current Context for loaded Loredecks and open the browser. It should not carry timeline registry editing, bulk registry operations, or deck-authoring workflows.

Reasons the workbench needs its own window:

- Large registries can contain hundreds or thousands of anchors/windows.
- Runtime Context browsing needs search, filters, candidate explanation, and per-deck state.
- Spreadsheet-style editing still needs horizontal and vertical room in the Timeline Registry Workbench.
- Reasoner resolution needs side-by-side input, candidate matches, explanations, and confirmation.
- Bulk edits and Pending Review need enough space to be inspected safely.
- Users and creators need to compare source timeline data, Custom overlays, and attached Lorecards.
- The UI should match Loredeck Library and Deck Health Center as a serious Saga workbench.

## Two Modes, Two Homes

The original Context workbench mixed two related but distinct jobs. The clarified plan separates their homes.

### 1. Context Browser

This is for runtime play. It sets the current chat's `loredeckContexts` for loaded Loredecks from the Context tab.

Examples:

- `Harry Potter: Golden Trio` -> Year 4, before the Yule Ball.
- `One Piece: Arlong Park` -> after Nami steals the Going Merry, before she asks Luffy for help.
- `MCU` -> after Civil War, before Infinity War.
- `Jujutsu Kaisen` -> post-Shibuya.

The browser should support manual locks, because user intent should outrank automatic resolver guesses.

### 2. Timeline Registry Workbench

This is for Loredeck creation/editing. It stays in the Loredeck tab and edits the timeline registry that makes Context selection possible.

It should edit accepted Custom overlays, not bundled source files directly. Saves should go through Pending Review.

## Core Concepts

Saga should not treat dates as the universal timeline model. Dates are one coordinate type.

### Anchor

A specific story point.

Examples:

- `hp.y4.yule-ball`
- `one-piece.arlong-park.nami-asks-for-help`
- `mcu.civil-war`
- `jjk.shibuya-incident`
- `genshin.mondstadt-act-3`

### Window

A range between anchors or broad story bounds.

Examples:

- `hp.year-4`
- `one-piece.arlong-park`
- `mcu.phase-3`
- `naruto.chunin-exams`
- `cyberpunk.act-2`

### Coordinate

One axis of story state. Coordinates let Saga support fandoms that are not date-heavy.

Common axes:

- Date.
- Year.
- Book.
- Season.
- Episode.
- Chapter.
- Issue.
- Arc.
- Phase.
- Quest.
- Route.
- Faction state.
- Relationship route.
- AU branch.
- Public knowledge state.

### Alias

Optional local resolver input.

Examples:

- `after Shibuya`
- `during Goblet`
- `Nami betrayal`
- `post Sokovia`
- `before the Battle of Hogwarts`

Aliases help exact/local matching, but Saga should not rely on exhaustive aliases to understand casual fandom phrasing. For large fandoms, hand-authoring every phrase a user might type would be unmaintainable. The Reasoner Provider should translate messy human phrasing into bounded known candidates.

## Fandom Flexibility

The editor should handle these common patterns:

| Fandom Type | Best Context Axes |
| --- | --- |
| Harry Potter | Dates, school years, books, chapters, school events, knowledge reveals. |
| One Piece | Arcs, episodes, chapters, island/location stage, crew membership, reveals. |
| Naruto | Arcs, missions, village state, exams, wars, character training stages. |
| Jujutsu Kaisen | Arcs, incidents, chapters/episodes, public/sorcerer knowledge state. |
| Demon Slayer | Arcs, missions, Hashira training, battles, character survival state. |
| MCU / DC | Films, phases, events, public knowledge, team status, post-credit shifts. |
| Star Wars Legends | Eras, wars, books, factions, Force orders, character allegiance. |
| ASOIAF / GOT | Books/seasons, POV chapters, wars, claims, location control, character travel. |
| Genshin / HSR | Regions, quests, Trailblaze/Archon stages, patches only where useful. |
| Pokemon | Region, badges, league stage, game/anime arc, team roster/state. |
| Cyberpunk 2077 | Act, quest state, faction route, ending branch, character survival state. |
| Stranger Things | Season, episode, investigation stage, Upside Down knowledge. |

The UI language should stay generic: `Context`, `Anchor`, `Window`, `Coordinate`, `Alias`. Specific fields can adapt to the selected axis.

## UX Principles

- Manual user selection is the most trusted path.
- Local resolver matching is a cheap candidate generator.
- Reasoner Provider resolution is the main natural-language path and must be bounded by known anchors/windows/Lorecard-derived candidates.
- Missing timeline registries are allowed; Deck Health should advise, not block.
- Large registries are expected, so search, filters, virtualization, and bulk edit matter.
- AI assistance drafts patches; it does not silently apply them.
- Pending Review remains the acceptance boundary.
- The workbench should be dense, practical, and consistent with Saga's fullscreen tools.

## Reasoner-Backed Context Resolution

The Context Browser should not attempt to solve every casual phrase locally.

Expected flow:

1. User chooses manually, or enters a phrase such as `after Christmas in sixth year`.
2. Saga runs a cheap local pass for exact dates, direct labels, direct aliases, and candidate narrowing.
3. If local resolution is weak or ambiguous, Saga sends a bounded candidate set to the Reasoner Provider.
4. The Reasoner returns a structured Context patch, a clarification question, or `unresolved`.
5. Saga shows the proposed Context and asks the user to apply it unless automatic updates are explicitly enabled.

The Reasoner should choose from known candidates, not invent active Context. Invented anchors may become Timeline Registry suggestions through Pending Review.

The existing Context-detection cadence still applies: local/structured resolution can run often, while Reasoner calls should happen only when Context is unset, the user asks, or a thresholded message/character-count check suggests a real timeline shift.

## Layout

Use a fullscreen overlay, visually aligned with Loredeck Library and Deck Health Center.

### Header

Left:

- `Context Workbench`
- Subtitle with selected pack or active stack context.

Status chips:

- Selected Loredeck.
- Current Context label.
- Manual lock state.
- Anchor/window counts.
- Attached Lorecard count.
- Deck Health state.

Actions:

- `Refresh Index`
- `Validate`
- `Draft With Assistant`
- `Export Timeline`
- `Done`

### Left Rail

Purpose: find and filter timeline objects quickly.

Controls:

- Search input.
- Loredeck selector.
- Type filters: `Anchors`, `Windows`, `Coordinates`, `Aliases`.
- State filters: `Source`, `Custom`, `Override`, `Disabled`, `Referenced`, `Warnings`.
- Scope filters: `Current arc`, `Loaded stack`, `Selected deck`.
- Sort selector: label, sort key, attachment count, warnings.

Below filters:

- Compact result list.
- Keyboard navigation.
- Click selects row in main grid.

### Main Grid

The primary surface should be a spreadsheet-style table, not a card grid.

Required behavior:

- Sticky headers.
- Scrollable body.
- Stable columns.
- Multi-select rows.
- Inline edit for safe fields.
- Row state chips.
- Warning markers.
- Attachment count column.
- Virtualized rendering once large registries are expected.

Anchor columns:

- State.
- ID.
- Label.
- Sort Key.
- Date / Range.
- Arc / Book / Season.
- Episode / Chapter / Quest.
- Aliases.
- Tags.
- Attached Lorecards.
- Warnings.

Window columns:

- State.
- ID.
- Label.
- Start Anchor.
- End Anchor.
- Sort From.
- Sort To.
- Arc / Phase.
- Aliases.
- Tags.
- Attached Lorecards.
- Warnings.

Coordinate columns:

- Axis.
- Value.
- Label.
- Sort Key.
- Applies To.
- Aliases.
- Notes.
- Warnings.

### Right Inspector

Purpose: edit one selected row with richer fields.

Sections:

- Identity: ID, label, state, source.
- Context: sort key, axis values, date range.
- Connections: start/end anchor, window membership, parent/child relation.
- Resolver: aliases, tags, notes.
- Usage: attached Lorecards and entry gates.
- Health: warnings and suggested fixes.

Actions:

- `Queue Change`
- `Disable Source`
- `Restore`
- `Duplicate`
- `Find Attached Lorecards`
- `Draft Fix`

### Bottom Drawer

Purpose: review generated or bulk actions without leaving the workbench.

Tabs:

- Pending Review.
- Resolver Test.
- Assistant Drafts.
- Validation.

The drawer can collapse to preserve grid space.

## Workbench Tabs

### Context

Set current chat Context for loaded Loredecks.

Must support:

- Per-loaded-Loredeck rows.
- Current label.
- Anchor/window selector.
- Alias/freeform input.
- Manual lock toggle.
- Confidence/source chips.
- `Resolve From Context`.
- `Model Fallback`.
- `Apply Selected`.

### Timeline

Spreadsheet for anchors and windows.

Must support:

- Source plus Custom overlay state.
- Create anchor/window.
- Edit selected.
- Disable/restore source definitions.
- Attachment counts.
- Bulk edit.

### Aliases

Focused view for resolver phrasing.

Must support:

- Alias search.
- Alias -> anchor/window mapping.
- Duplicate alias warnings.
- Bulk add aliases.
- Resolver test from selected alias.

### Validation

Deck Health-style diagnostics for the Context system.

Must show:

- Duplicate IDs.
- Dangling window references.
- Invalid sort ranges.
- Missing labels.
- Malformed dates.
- Missing aliases where helpful.
- Anchors referenced by entries but absent from registry.
- Entry gates that can never match.

### Assistant

AI helper for timeline generation and repair.

Useful prompts:

- `Draft missing anchors for this arc.`
- `Add aliases casual users might type.`
- `Densify this window with chapter-level moments.`
- `These anchors are too sparse for long-form roleplay. Suggest intermediate story beats.`
- `Rename these labels to be clearer without changing IDs.`
- `Create artificial sort keys for this anime arc.`

All output must become structured Pending Review proposals.

## Must-Have Features

- Fullscreen workbench shell.
- Keep runtime dropdown as quick launcher/selector.
- Search anchors/windows/aliases.
- Apply selected anchor/window to current Loredeck Context.
- Manual lock per Loredeck.
- Spreadsheet timeline table.
- Row inspector.
- Pending Review patch routing.
- Create/edit anchors and windows.
- Disable/restore source anchors/windows.
- Attachment counts from loaded entries.
- Resolver test input with explanation.
- Validation view.
- Bulk alias/tag/sort-key edits.
- Assistant handoff for selected rows and validation findings.

## Nice-To-Haves

- Visual horizontal timeline strip.
- Drag reorder with sort-key recalculation.
- CSV import/export.
- Timeline density heatmap.
- Branch/AU route visualization.
- Compare source timeline against Custom overlay.
- Conflict comparison across loaded Loredecks.
- Auto-suggest aliases from chat context.
- "Find gaps" assistant for sparse arcs.

## Accessibility And Interaction

- Keyboard navigation for grid rows and cells.
- Visible focus ring.
- Buttons have tooltips.
- Text should not clip in cells; use truncation with tooltip where needed.
- No color-only state: chips and labels must name state.
- Preserve scroll position after row edits.
- Bulk actions must show selection count.
- Destructive actions require confirmation or Pending Review.

## Data And Persistence

The Context Browser should edit:

- `loredeckContexts` for current runtime Context.

The Timeline Registry Workbench should edit:

- `timelineRegistry` overlays on Custom/Generated Loredeck records.
- Pending Review record patches for accepted/queued edits.

Both surfaces should read:

- Source `timeline.json`.
- Accepted Custom `timelineRegistry` overlays.
- Context Index.
- Loaded entries and entry gates.
- Deck Health diagnostics.
- Resolver metadata when available.

It should not directly edit bundled source files.

## Resolver Flow

Resolution priority:

1. Manual selection.
2. Structured context/header data.
3. Local exact/date/coordinate matching and candidate generation.
4. Reasoner Provider resolution using bounded known anchors/windows/Lorecard-derived candidates.

The Reasoner must reject invented active Context. Invented anchors may be returned as Timeline Registry suggestions for review, but the Loredeck registry remains the source of truth.

## Original MVP Build Path

1. Build fullscreen workbench shell.
2. Move the current manual Context controls into the `Context` tab.
3. Add searchable anchor/window table from the existing Context Index.
4. Add row inspector for anchors/windows.
5. Queue anchor/window edits through existing Pending Review.
6. Add resolver test panel.
7. Add validation tab using existing Deck Health issue logic.
8. Add bulk edits for aliases/tags/sort keys.
9. Add assistant draft handoff for selected rows and validation issues.
10. Add visual smoke coverage for opening, selecting, editing, queuing, and resolver testing.

## Revised MVP Build Path

1. Build fullscreen Context Browser shell from the Context tab.
2. Reuse loaded Loredeck stack state and current `loredeckContexts`.
3. Reuse the Context Index as Context Browser data.
4. Add browse/search for anchors, windows, dates, arcs, books, chapters, episodes, quests, and Lorecard-derived Context candidates.
5. Add `Start Here`, `Before`, `After`, `Between`, lock, and apply controls.
6. Move runtime manual Context controls and local phrase testing from the Loredeck tab into the Context Browser.
7. Add Reasoner-backed `Resolve Context` using bounded candidates.
8. Add suspected-jump review using the existing message-count and character-count threshold cadence.
9. Leave Timeline Registry editing, alias inspection, validation, and Pending Review timeline patches in the Loredeck tab.
10. Add visual smoke coverage for startup Context selection, manual apply, Reasoner proposal, apply/reject, and locked Context behavior.

## Open Design Questions

- Should the workbench initially edit only one Loredeck at a time, or allow a stack-wide compare mode?
- Should coordinates have a separate table in MVP, or be represented as optional columns on anchors/windows first?
- How much inline editing should be allowed before it becomes too easy to bypass review?
- Should assistant-generated anchors land in the bottom drawer first or directly in Pending Review?
- Should broad windows be visually separated from precise anchors?
- How aggressively should Deck Health warn about sparse timelines?

## Initial Decision

Build Context as a fullscreen browser/workbench launched from the Context tab. Keep compact Context UI only as a quick status surface and launcher.

The Loredeck-side workbench should focus on `Timeline`, `Aliases`, and `Validation` as deck-authoring tools. Coordinates can start as fields on anchors/windows and become their own richer tab once the table model is stable.

## Current Implementation Notes

The first fullscreen Context Workbench is implemented with these MVP surfaces:

- `Context`: loaded Loredeck stack, selected-deck manual Context editor, quick timeline picker, and local Phrase Resolver.
- `Timeline`: searchable spreadsheet-style anchor/window table with selected-row inspector and apply actions.
- `Aliases`: alias-focused table with duplicate warnings and apply actions.
- `Validation`: Context structure checks for labels, aliases, duplicate aliases, dangling windows, undefined anchors, and index issues.

The Phrase Resolver now explains cleaned terms, ignored direction words, match reasons, missing terms, weak matches, and no-match coverage gaps.

The Phrase Resolver can also load Lorecards and include Lorecard-derived Context candidates. This lets event-level prompts such as `after yule ball` resolve from a Lorecard's Context gate even when the active `timeline.json` is sparse. These rows are visually marked as Lorecard-derived, can be applied to the current chat Context, and can become real timeline anchors through Pending Review on editable decks. Bundled decks remain protected and route users to duplicate as Custom first.

This is a bridge, not the final Context UX. The clarified next development slice is to move runtime Context selection into a Context Browser and use the existing local resolver as candidate generation for Reasoner-backed Context resolution.

Do not expand this into an exhaustive local alias system. The long-term registry policy should add durable anchors for high-value recurring story moments, Creator output, accepted suggestions, and sparse coverage warnings. Casual phrasing should be handled by the Reasoner Provider selecting from bounded known candidates.
