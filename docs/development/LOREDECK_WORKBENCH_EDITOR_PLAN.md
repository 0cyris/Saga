# Loredeck Workbench Editor Plan

Status: implementation in progress
Last updated: 2026-06-09

## Purpose

Saga needs a dedicated Loredeck Workbench for inspecting and editing the Lorecards inside a selected Loredeck. The Loredeck Library manages decks, folders, stack membership, covers, health summaries, import/export, and deck-level metadata. The new workbench should manage the deck's internal Lorecards and supporting registries.

The workbench should open from the Loredeck Library details panel when a Loredeck is selected. It should use the same fullscreen workbench language as the Lorecard Workbench, Loredeck Library, Context Browser, and Health Center.

## Product Decision

The Loredeck Workbench is a direct editor, not a review queue.

Manual edits should not create persistent pending changes. A user editing a Custom Loredeck should be able to click a field, edit it, and have the change saved cleanly without an accept/reject workflow. Queued edits are too heavy for normal editor UX and would make the workbench feel bureaucratic.

Use this rule:

- Manual field edits: direct edit with autosave.
- Bulk edits: confirmation, then direct apply.
- Delete actions: confirmation, then direct apply.
- AI revisions: diff preview, then direct apply.
- Bundled Loredecks: read-only until duplicated.

## Entry Point

In the Loredeck Library details panel, add an `Open Loredeck` action to the right of `Add to Stack`.

Suggested details-panel action row:

- `Add to Stack`
- `Open Loredeck`
- `Open Health Report`
- `Duplicate`
- `Delete`

The `Open Loredeck` button should open a fullscreen editor for the currently selected Loredeck.

Behavior by deck type:

- Bundled Loredeck: read-only. Show `Duplicate to Edit`.
- Custom Loredeck: editable.
- Generated Loredeck: editable if finalized into the Library or still associated with a Creator project.

## Workbench Shape

Use existing workbench shell classes and layout patterns where possible:

- `wandlight-lore-workbench-overlay`
- `wandlight-lore-workbench-shell`
- `wandlight-lore-workbench-header`
- `wandlight-lore-workbench-title-wrap`
- `wandlight-lore-workbench-mode-tabs`
- `wandlight-lore-workbench-body`
- `wandlight-lore-workbench-main`
- `wandlight-lore-workbench-table`
- `wandlight-lore-workbench-detail`

The visual result should feel like the Accepted/Pending Lorecard Workbench, but scoped to a single Loredeck.

Suggested main layout:

- Header: cover thumbnail, Loredeck title, deck type, entry count, health status, save status, close button.
- Tab row: `Lorecards`, `Registries`, `Health`, `Files`.
- Body: left table/list and right selected-item detail/editor for the `Lorecards` tab.
- Footer/status strip if needed: current filter count, selection count, last saved time, stale health indicator.

## Tabs

### Lorecards

Primary view. Browse, search, filter, select, inspect, and edit Lorecards inside the selected deck.

Expected controls:

- Search by title, ID, summary, tags, source file, Context labels.
- Filter by relevance tier: `All`, `High`, `Normal`, `Low`.
- Filter by category/type: character, event, faction, location, object, rule/system, relationship, item, spell, custom.
- Filter by canon status: canon, AU, custom, generated, unknown.
- Filter by Context gate: always valid, bounded, missing gate, invalid gate, disabled.
- Filter by health state: clean, warning, error, suggestion.
- Filter by source file.
- Filter by tags.
- Select visible.
- Select filtered.
- Clear selection.
- Shift-select range.

Rows should reuse Lorecard row/card rendering patterns from the Lorecard Workbench where possible. Metadata chips should match Accepted Lorecards and Loredeck Library chip sizing and typography.

The detail/editor panel should show:

- Title
- Machine ID
- Summary/body
- Category/type
- Relevance
- Canon/truth/reveal status
- Tags
- Context gates
- Source file
- Enabled/disabled state
- Notes/source metadata
- Health issues affecting this card

### Registries

Manage deck-level registries that many Lorecards refer to.

Expected sections:

- Tag registry
- Timeline/Context anchors
- Timeline windows
- Category/type registry if deck-defined
- Source file grouping
- ID namespace overview

This should not become the full Context Browser. It is an editor for deck-owned registry data. Deep timeline browsing can still route to the Context Browser/Timeline registry workbench when needed.

### Health

Compact health view scoped to the current deck.

Expected controls:

- `Refresh Scan`
- health summary chips
- top issues
- affected Lorecards count
- `Open Health Center`

This tab should not duplicate the entire Health Center. It should expose the most useful summary plus a route to the dedicated Health Center.

### Files

Advanced package/file view.

Expected sections:

- `loredeck.json`
- entry files
- registry files
- cover assets
- package assets
- import/export path metadata

Most users should not need this tab, but it is valuable for user-made packages and health debugging.

## Save Model

Use a shared Workbench Save State pattern across the Loredeck Workbench and Accepted Lore Workbench.

Do not add a traditional document-style `Save` button as the main path. Saga already behaves like a live runtime/editor tool. The simplest consistent model is autosave with visible state.

Save states:

- `Saved`
- `Saving...`
- `Unsaved changes`
- `Save failed`
- `Read-only`

Autosave behavior:

- Text fields save on blur or Enter.
- Larger text fields can use a short debounce.
- Selects/toggles save immediately.
- Bulk edits save after confirmation.
- AI revisions save only after preview approval.

The save status should be visible in the workbench header, probably as a compact chip.

Storage target:

- Accepted Lore Workbench saves to active chat state.
- Loredeck Workbench saves to the editable Loredeck Library record.
- Bundled Loredecks do not save. They require duplicate-to-Custom before editing.

## Undo and Safety

Do not store undo snapshots in active chat state.

Persistent snapshot stacks would bloat saved state, slow refreshes, and make unrelated chats carry editor history. Loredeck editing is library-level work, not chat-level runtime memory.

Use lightweight, ephemeral undo only while the workbench is open:

- Keep a small in-memory operation history.
- Do not persist it to chat state.
- Drop it when the workbench closes.
- Store operation patches, not whole deck snapshots.

Example operation record:

```js
{
  type: 'edit_field',
  entryId: 'hp-year-6.ron-lavender-start',
  field: 'summary',
  before: 'old value',
  after: 'new value'
}
```

For large bulk edits, keep at most one temporary rollback patch in memory while the workbench is open.

Safety rules:

- Field edits do not need confirmation.
- Delete selected requires confirmation.
- Bulk edit selected requires a concise confirmation summary.
- AI revise selected requires a diff preview before applying.
- Editing a Bundled Loredeck prompts duplication instead of mutating the bundled source.

## AI Revision Assistant

The Loredeck Workbench should support AI-assisted deck editing, but AI changes should not apply blindly.

Flow:

1. User selects one or more Lorecards or filters a subset.
2. User asks the assistant for a revision.
3. Assistant may ask clarifying questions if the instruction is underspecified.
4. Assistant returns proposed changes as a diff/preview.
5. User applies or cancels.
6. Applied changes save directly and mark Deck Health stale.

Examples:

- "Make Arlong and his crew more cruel and predatory."
- "Normalize all context gates to this arc."
- "These entries are too wiki-like. Rewrite them as high-value roleplay constraints."
- "Add missing tags for factions and relationships."

The assistant should be steered toward Saga's high-value lore philosophy:

- constraints over trivia
- actionable roleplay behavior
- knowledge boundaries
- Context-aware gating
- secrets and reveal timing
- relationship/status changes
- current-scene utility

It should not produce piles of generic wiki facts.

## Bulk Actions

Bulk actions should mirror the Accepted Lore Workbench where possible.

Expected bulk actions:

- Set relevance
- Set category/type
- Set canon status
- Set truth status
- Set reveal policy
- Add tag
- Remove tag
- Replace tag
- Normalize IDs
- Rename ID prefix
- Set Context gate
- Disable selected
- Enable selected
- Duplicate selected
- Delete selected
- Move selected to source file/group

Bulk actions should show:

- number of selected Lorecards
- action being applied
- whether Deck Health will become stale
- whether the deck is editable

## Reuse Strategy

Do not build the Loredeck Workbench as an isolated UI system.

Create a new module:

- `loredeck-workbench-panel.js`

Extract or reuse shared primitives from:

- `lorecards-panel.js`
- `loredeck-library-panel.js`
- `runtime-ui-kit.js`
- `loredeck-health-panel.js`

Likely shared primitives:

- workbench overlay shell
- workbench header
- mode tabs
- search/filter row
- table/list row layout
- selected detail panel layout
- metadata chip rendering
- bulk toolbar layout
- selection helpers
- scroll preservation helpers
- save status chip

Use data adapters rather than duplicating logic:

Accepted Lore adapter:

- reads from `state.loreMatrix`
- writes to active chat state
- uses chat-specific pin/mute state

Loredeck adapter:

- reads from selected Loredeck entries
- writes to editable Library record
- uses deck-level source files and registries
- marks deck health stale after edits

## Performance Requirements

The workbench must be careful with large decks.

Requirements:

- Do not render thousands of detail cards at once.
- Use paged or virtualized table/list rendering.
- Keep filtering deterministic and local where possible.
- Debounce search.
- Preserve scroll position when selecting a row.
- Selecting a Lorecard should not reload the entire Library.
- Saving a field should not refresh the whole workbench unless necessary.
- Health scans should be explicit, not run on every edit.
- Mark health stale on edit; do not automatically rescan.

## Integration With Loredeck Library

Library details panel changes:

- Add `Open Loredeck` beside `Add to Stack`.
- Use selected Loredeck ID to open the workbench.
- If the selected item is a folder, do not show `Open Loredeck`; show folder details/actions instead.
- If the selected deck is Bundled, show read-only status in the details panel and workbench.
- If the selected deck is Custom/Generated, enable editor mode.

After edits:

- Update Library detail counts if entry count changes.
- Mark health stale in Library details.
- Do not reset Library scroll.
- Do not close the workbench.
- Do not force-refresh the entire runtime drawer.

## Accepted Lore Workbench Alignment

Because this introduces a visible save-state pattern, the Accepted Lore Workbench should receive the same pattern.

Shared behavior:

- autosave
- visible save state
- failed-save warning
- field-level direct edit
- confirm destructive actions
- confirm bulk edits
- no persistent undo stack

Different storage:

- Accepted Lore saves to active chat state.
- Loredeck Workbench saves to Loredeck Library data.

This prevents Saga from feeling like two different editors.

## MVP Slice

Phase 1:

- Add `Open Loredeck` button in Library details panel for selected decks.
- Create `loredeck-workbench-panel.js`.
- Open/close fullscreen workbench.
- Header with deck title, cover, type, entry count, health status, save state.
- Read-only Lorecard list for selected deck.
- Search and basic filters.
- Selected Lorecard detail panel.

Implementation status: complete.

Phase 2:

- Editable Custom/Generated deck fields.
- Autosave state chip.
- Dirty/saving/saved/failed state.
- Mark Deck Health stale on edit.
- Bundled read-only guard and `Duplicate to Edit`.

Implementation status: started. The first Phase 2 slice adds direct inline editing for the selected Lorecard's title, category, relevance, canon status, tags, lore text, injection text, and notes. Text fields save on blur or Ctrl+Enter, selects save immediately, successful edits write through the Loredeck Library record mutation path, and edited decks are marked `healthStatus: stale`. New Lorecard creation and bulk actions are intentionally deferred until their direct-edit flows replace the older Pending Review dialog.

Phase 3:

- Selection and bulk toolbar.
- Bulk relevance/category/tag/context-gate edits.
- Delete confirmation.
- Direct save after confirmation.

Phase 4:

- Registries tab.
- Tag registry editor.
- Timeline/Context registry summary and basic editor routes.

Phase 5:

- Health tab summary.
- Refresh scan action.
- Open Health Center route.
- Health issue filters in Lorecards tab.

Phase 6:

- AI revision assistant with diff preview.
- Apply/cancel flow.
- High-value-lore guidance in prompts.

Phase 7:

- Shared workbench primitives extracted for Accepted Lore and Loredeck Workbench.
- Accepted Lore Workbench save-state alignment.

## Non-Goals For Initial Build

- Persistent edit queues for manual edits.
- Full deck snapshot undo stored in chat state.
- Automatic health scan after every edit.
- Editing Bundled Loredecks in place.
- Replacing the Loredeck Library details panel.
- Replacing the Context Browser.

## Open Questions

- Should autosave be field-level only, or should large body edits use an explicit inline `Apply`/`Cancel` while the textarea is focused?
- Should generated-but-unfinalized Creator decks open through this workbench, or should they stay inside the Creator until finalized?
- Should the Files tab allow moving entries between files in MVP, or only display file ownership until package export is fully stable?
- Should AI diff previews reuse the Creator/Assistant diff card format, or do we need a simpler side-by-side field diff for normal users?
