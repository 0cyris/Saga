# Saga Chip Design Schema

Status: Design schema.

This document defines Saga's small text chips, pills, badges, and metadata bubbles. The goal is to restore the compact, color-coded scanability that worked in Lorecards without turning the runtime shelf, Loredeck Library, Creator, or workbenches into visual clutter.

For consistency, this document uses **chip** as the product/design term. Existing code may still call them `pill`, `badge`, `meta`, or `status`.

## Problem

Saga now uses chip-like UI in many places:

- Runtime shelf header status.
- Loredeck Library cards, stack rows, folder rows, and detail panels.
- Loredeck Creator project shelf, stage guide, Scope Brief, Story Outline, Title Pass, Context Plan, Lorecard drafting, Pending Review handoff, Pack Health, and finalization surfaces.
- Context panels and Context Workbench.
- Lorecard cards, Pending Review, Accepted Lorecards, and tag rows.
- Pack Health issue cards and readiness panels.
- Settings provider/theme status summaries.

The style has drifted into several competing systems:

- `createStatusPill(...)` and `createBadge(...)` both route through `createChip(...)`, but older call sites and CSS bridge classes still need migration discipline.
- Many rows use `.saga-loredeck-row-meta`.
- Creator project model chips already carry a `tone`, but not every render path uses that tone.
- Specialized classes exist for Pack Health, folder previews, stage labels, provider states, and tag chips.

The visible failure is not just size. It is hierarchy collapse:

- Some chips appear larger or heavier than card titles.
- Many chips use the same dark neutral fill, so metadata, status, severity, and counts all read the same.
- Creator surfaces can show many chips at once, making every stage look equally important.
- Color coding is either absent or too local to one older Lorecard surface.

## Design Goal

Chips should be fast annotations. They should answer one compact question:

- What kind is this?
- What state is this in?
- How severe is this?
- How many are involved?
- Where did this come from?

Chips should not behave like headings, cards, buttons, paragraphs, or alert banners.

## Principles

1. Chips are lower than titles in the visual hierarchy.

   A chip must never compete with a card title, section title, or primary action. If a chip draws more attention than the object name, the chip is too large, too saturated, or too bold.

2. Most chips are quiet.

   The default chip is neutral metadata. It should be compact and readable, but it should not scream for attention.

3. Color has a job.

   Color should mean kind, state, or severity. Do not add new colors only for ornament.

4. Strong color is reserved for action-driving state.

   Errors, blockers, warnings, pending review, active generation, and ready/approved states deserve stronger cues. Ordinary counts and metadata do not.

5. Use few semantic color families.

   Avoid one color per feature. Saga should use a small shared set of tones across the shelf, Creator, Library, Context, Lorecards, Settings, and Pack Health.

6. Creator needs stricter limits than ordinary cards.

   Creator repeats chips across stages. It needs caps, grouping, and tonal restraint more than any other surface.

7. Labels stay literal.

   Chip text should be compact and concrete: `Generated`, `Needs review`, `3 pending`, `High`, `Character`, `Bundled`, `Locked`. Avoid clever labels inside chips.

8. Tooltips carry secondary explanation.

   If a chip needs a long explanation, keep the chip short and put the explanation in the tooltip or adjacent detail text.

## Chip Taxonomy

### Metadata Chip

Use for stable descriptive facts.

Examples:

- `Bundled`
- `Generated`
- `Custom`
- `One Piece`
- `Arlong Park`
- `Character`
- `High`
- `folder: East Blue`

Visual rule:

- Quiet neutral surface.
- Optional subtle type/category accent only when it materially helps scanning.
- No strong fill.

Recommended tone:

- `neutral` by default.
- `source` for Lorepack type/source.
- `category` for Lorecard category.
- `relevance` for Lorecard relevance.

### Status Chip

Use for current workflow state.

Examples:

- `Draft`
- `Generated`
- `Approved`
- `Needs review`
- `Running`
- `Waiting`
- `Locked`
- `Editable`
- `Read-only`

Visual rule:

- Clearer than metadata.
- Strong enough to scan, not strong enough to overpower the card.
- State colors are allowed.

Recommended tone:

- `muted` for waiting/locked/unavailable.
- `info` for generated/in progress.
- `review` for needs review.
- `success` for approved/ready.
- `warning` for waiting on user action.

### Severity Chip

Use for risk, blockers, errors, warnings, and Pack Health issue severity.

Examples:

- `2 errors`
- `5 warnings`
- `Blocked`
- `Health stale`
- `Risk: High`
- `Quality flag`

Visual rule:

- Strongest chip family.
- Still compact.
- Error and warning colors should be unmistakable but not saturated banners.

Recommended tone:

- `danger`
- `warning`
- `success`
- `muted`

### Count Chip

Use for numbers that summarize content.

Examples:

- `80 Lorecards`
- `3 pending`
- `12 accepted`
- `4 anchors`
- `2 windows`
- `5 selected`

Visual rule:

- Neutral unless the count indicates a problem or review state.
- Counts should not all become warning colors.

Recommended tone:

- `neutral` for ordinary counts.
- `review` for pending/review counts.
- `warning` or `danger` only when the count is a problem.

### Source Chip

Use for origin or ownership.

Examples:

- `Bundled`
- `Generated`
- `Custom`
- `Imported`
- `Resumable job`
- `tags.json loaded`
- `custom overlay`

Visual rule:

- Subtle accent.
- Source chips should help users understand mutability and trust, not create new public product terms.

Recommended tone:

- `source-bundled`
- `source-generated`
- `source-custom`
- `source-local`

Public terminology remains:

- `Bundled Lorepack`
- `Generated Lorepack`
- `Custom Lorepack`

Chips can use compact forms such as `Bundled`, `Generated`, and `Custom` when the surrounding surface already says Lorepack.

### Tag Chip

Use for user or deck-defined tags.

Examples:

- `character:nami`
- `arc:arlong-park`
- `source:canon`

Visual rule:

- Smallest chip family.
- Lower contrast than state/severity chips.
- Can wrap in rows where tags are the primary content, but should be capped in cards.

Recommended tone:

- `tag`
- `tag-sensitive`
- `tag-deprecated`

### Action Chip

Use sparingly for chips that are also controls.

Examples:

- removable tags
- filter chips
- selected chips
- compact mode toggles

Visual rule:

- Keep the visual chip compact.
- Increase the clickable hit target with padding, not text size.
- Include focus state and selected state.

Recommended tone:

- `action`
- `selected`
- `disabled`

## Visual Anatomy

A standard chip has:

- Text label.
- Optional tooltip.
- Optional tone.
- Optional dot or hairline accent.
- Optional compact icon only when the chip is interactive or severity-critical.

A standard chip should not have:

- Multi-line explanatory text.
- Large icons.
- Heading-scale font.
- Heavy shadow.
- Saturated full fill unless it is a severe/action-driving state.
- Rounded card styling that makes it read as a small button unless it is interactive.

## Size Schema

### Compact Chip

Use inside dense card rows, Creator lists, Lorecard metadata, Library rows, and workbench tables.

Recommended CSS target:

```css
font-size: 10px;
line-height: 14px;
min-height: 14px;
padding: 0 4px;
border-radius: 6px;
gap: 3px;
font-weight: 400;
```

Use when:

- Chips sit under a title.
- A row can contain more than three chips.
- Chips are repeated in lists.
- The surface is a workbench or Creator stage.

### Standard Chip

Use in headers, summaries, section tops, and less dense cards.

Recommended CSS target:

```css
font-size: 10px;
line-height: 15px;
min-height: 15px;
padding: 0 5px;
border-radius: 7px;
gap: 4px;
font-weight: 400;
```

Use when:

- The chip appears in a header summary.
- There are one to four chips total.
- The row has enough space and needs quick scanning.

### Touch Chip

Use only for interactive filter chips, removable tags, or mobile-first controls.

Recommended CSS target:

```css
font-size: 10px;
line-height: 15px;
min-height: 24px;
padding: 2px 8px;
border-radius: 8px;
gap: 4px;
font-weight: 400;
```

Use when:

- The chip itself is clicked.
- The control appears in a toolbar.
- The chip must meet a larger hit target.

Do not use Touch Chip sizing for passive metadata.

## Color Schema

Saga should use a small semantic palette. These names are design tokens, not necessarily final CSS variable names.

### Neutral

Purpose:

- Ordinary metadata.
- Ordinary counts.
- Stable facts.

Visual:

- Low contrast dark surface.
- Soft border.
- Muted text.

Example use:

- `80 Lorecards`
- `4 anchors`
- `Unfiled`
- `Updated 2m ago`

### Source

Purpose:

- Lorepack source and mutability.
- Data origin.

Visual:

- Slight accent distinct from neutral.
- Still quiet.

Example use:

- `Bundled`
- `Generated`
- `Custom`
- `custom overlay`
- `tags.json loaded`

### Info

Purpose:

- Active non-danger workflow information.
- Generated/in-progress state.

Visual:

- Theme-native subdued accent border/text, warm by default.
- Low-saturation fill.

Example use:

- `Running`
- `Generated`
- `In flight skipped`
- `Local match`

### Review

Purpose:

- User review required.
- Draft/pending items.

Visual:

- Selected/review accent, usually warm gold or amber.
- More visible than neutral, less urgent than warning.
- Purple or blue-violet belongs here only when the active Theme Pack is explicitly cool or neon.

Example use:

- `Needs review`
- `3 pending`
- `7 drafted`
- `Pending Review`

### Success

Purpose:

- Ready, accepted, approved, clear, active.

Visual:

- Green accent.
- Low fill.

Example use:

- `Approved`
- `Ready`
- `Health clear`
- `12 accepted`
- `Active`

### Warning

Purpose:

- User attention needed.
- Non-blocking risk.
- Stale validation.

Visual:

- Amber accent.
- Visible but not alarmist.

Example use:

- `5 warnings`
- `Health stale`
- `Quality flag`
- `Waiting`

### Danger

Purpose:

- Error, blocked, destructive, failed.

Visual:

- Red accent.
- Strongest chip fill, still compact.

Example use:

- `2 errors`
- `Blocked`
- `Failed`
- `Delete selected`

### Muted

Purpose:

- Disabled, unavailable, locked, not applicable.

Visual:

- Low contrast.
- Desaturated border/text.

Example use:

- `Locked`
- `Disabled`
- `Not applicable`
- `Events unloaded`

## Tone Mapping

| Tone | Use For | Strength |
| --- | --- | --- |
| `neutral` | ordinary metadata and counts | quiet |
| `source` | source/mutability metadata | quiet-accent |
| `category` | Lorecard category | quiet-accent |
| `relevance` | Lorecard relevance | quiet-accent |
| `info` | generated, running, local, cached | medium |
| `review` | needs review, drafted, pending | medium |
| `success` | approved, ready, active, clear | medium |
| `warning` | stale, quality flag, caution | strong |
| `danger` | errors, blockers, failed | strongest |
| `muted` | locked, disabled, unavailable | quiet |
| `selected` | selected filter or chip control | medium |

## Shape And Fill Rules

Use one shared compact rounded rectangle shape for chips:

- Radius: 6-8px.
- Border: always present or visually reserved.
- Fill: low opacity by default.
- Text: semantic tone when useful.
- Optional dot: useful for category/source color without filling the whole chip.

Avoid fully filled saturated chips for normal metadata. If everything is filled, nothing stands out.

## Typography Rules

Chips should use the UI's normal font family.

Recommended:

- Font size: 11px compact, 12px standard.
- Font weight: 500 default.
- Letter spacing: 0.
- Text transform: none by default.
- All-caps only for true short codes, not general labels.

Avoid:

- 13-14px passive metadata chips inside cards.
- Bold chips under normal card titles.
- Long labels with repeated prefixes.

Prefer:

- `High` instead of `Relevance: High` when the row context already implies relevance.
- `Character` instead of `Category: Character` when paired with other Lorecard metadata.
- `3 pending` instead of `Pending Review Items: 3`.

Use prefixes only when ambiguity is real:

- `Risk: High`
- `Priority 2`
- `After: Stone mystery`
- `Before: Graveyard return`

## Row Layout Rules

### Card Rows

Cards should show only the chips needed for first-pass scanning.

Default cap:

- 3 chips for compact cards.
- 5 chips for larger cards.
- 7 chips only for details panels or workbench headers.

If more chips exist:

- Collapse into `+N`.
- Move lower-priority chips to tooltip/detail.
- Put tags into a separate tag row only when tags are the main task.

### Header Rows

Headers can show summary chips, but should not become dashboards.

Default cap:

- 4 chips in runtime drawer headers.
- 6 chips in fullscreen workbench headers.

When a header needs more state, use a compact summary sentence or a secondary details panel instead.

### Creator Stage Rows

Creator stage cards are chip-dense by nature. Use stricter ordering:

1. Workflow state: `Ready`, `Needs review`, `Running`, `Blocked`.
2. One primary count: `12 titles`, `3 pending`, `5 accepted`.
3. One quality/readiness cue if relevant: `Quality flag`, `Health stale`, `Coverage thin`.
4. Optional source/scope cue only if it disambiguates the row.

Do not show every possible count in every Creator row.

### Tag Rows

Tag rows can wrap, but only where tags are being edited or reviewed.

In cards:

- Show first 4-6 tags.
- Add `+N` for the rest.

In tag manager or entry editor:

- Wrapping is acceptable.
- Interactive tag chips may use Touch Chip hit targets.

## Content Priority

When choosing which chips to show, use this order:

1. Action-driving severity: error, blocked, failed.
2. Required user action: needs review, pending, draft.
3. Current workflow state: running, approved, ready, locked.
4. Source/mutability: Bundled, Generated, Custom, editable, read-only.
5. Primary kind: category, relevance, Context type.
6. Primary count: Lorecards, pending, anchors/windows.
7. Secondary metadata: folder, updated time, model/source, file.
8. Tags and long IDs.

Long IDs should almost never be visible as chips in cards. They belong in details panels, tooltips, copy controls, or debug surfaces.

## Creator-Specific Schema

The Loredeck Creator should use the following chip groups.

### Project Shelf Card

Required chips:

- Source/state: `Draft` or `Generated`.
- Stage: `Scope Brief`, `Title Pass`, `Lorecards`, `Needs review`, etc.
- One review/count chip if present: `3 pending`, `7 drafted`, `12 accepted`.
- One issue chip if present: `2 issues`, `Blocked`.

Optional chips:

- Folder.
- Readiness state.
- Updated time only if not already shown elsewhere.

Cap:

- 4 chips plus folder, or 5 total.

Tone:

- `Draft`: muted.
- `Generated`: source/info.
- Stage neutral or info.
- `Needs review`: review.
- `Running`: info.
- `Blocked`/issues: danger.

### Stage Guide

The stage guide should primarily use structure, not chips.

Recommended:

- Use row state classes and small stage numbers.
- Avoid adding multiple chips inside each stage item.
- One state indicator per row is enough.

### Scope Brief

Recommended chips:

- `Needs approval` or `Approved`.
- Granularity label.
- Optional `N questions` if clarification is required.

Avoid:

- Fandom and scope as chips when they are already visible as form fields or headings.

### Story Outline

Recommended chips:

- `Ready`, `Needs approval`, or `Approved`.
- `N beats`.
- `N Context`.
- `N title sets`.
- `N questions` only when present.

Cap:

- 4 chips.

### Title Pass

Recommended chips:

- `Drafted` or `Ready`.
- `N titles`.
- `X/Y batches`.
- `N selected` only while selection exists.
- `N quality flags` only when present.

Avoid:

- Showing title batch label, category, relevance, priority, context hints, and coverage IDs together in compact rows.

### Context And Tag Planning

Recommended chips:

- `Draft`, `Approved`, or `Needs review`.
- `N anchors`.
- `N windows`.
- `N tags`.
- `N pending` if queued to review.

Avoid:

- Long anchor IDs as chips in row cards.

### Lorecard Drafting

Recommended chips:

- `Draft`.
- `Approved`.
- `Sent to review`.
- Category.
- Relevance.
- `Priority N` only if priority is a decision point.

Cap:

- 4 chips per draft row.

### Pending Review Handoff

Recommended chips:

- `N pending`.
- `N Lorecards`.
- `Health impact` only when true.
- `Risk: High/Medium/Low` when available.

Tone:

- Pending/review: review.
- Health impact: warning.
- High risk: danger.

### Readiness And Finalization

Recommended chips:

- `Ready`.
- `Blocked`.
- `Coverage thin`.
- `Pack Health stale`.
- `N blockers`.

Avoid:

- Treating advisory Pack Health as a pass/fail gate unless the actual workflow is blocked.

## Lorecard-Specific Schema

Lorecards are the model for compact useful chips.

Recommended chips:

- Canon/AU truth mode.
- Category.
- Relevance.
- Pending/accepted state if relevant.
- Priority only when exposed for review or sorting.
- Pinned/muted only when true.
- Context blocked/unresolved only when relevant.

Color can be more categorical here because users scan Lorecards by kind and relevance. Keep it subtle:

- Tinted text.
- Low-opacity background.
- Soft border.

Do not turn every Lorecard tag into a first-class colored chip in compact cards.

## Library And Pack Health Schema

### Loredeck Library Cards

Recommended chips:

- `Bundled`, `Generated`, or `Custom`.
- Entry count.
- Health summary only when not clear, or `Health clear` in details.
- Stack state if relevant: `In Stack`, `Disabled`, `Priority N`.

Avoid:

- Showing fandom, era, source, tags, health, stack, priority, and entry counts all at once in the card list.

### Active Stack Rows

Recommended chips:

- Enabled/disabled state.
- `Priority N`.
- Suppression/kept state if relevant.
- Health errors/warnings if present.

### Pack Health Cards

Recommended chips:

- Severity.
- Affected count.
- File only in detailed issue rows.
- Fix state only when actionable.

Tone:

- Error: danger.
- Warning: warning.
- Suggestion: info or neutral.
- Resolved: success.
- Ignored: muted.

## Context Schema

Context chips should distinguish selection state from diagnostics.

Recommended chips:

- `Context selected` or `No Context set`.
- `Locked` or `Unlocked`.
- Context type: `Anchor`, `Window`, `Global`.
- Confidence percentage only where resolver confidence matters.
- `N anchors / N windows` in summaries.
- `No index` as warning/muted depending on severity.

Avoid:

- Long anchor IDs in compact rows.
- Showing updated timestamps in every row when space is constrained.

## Settings Schema

Settings chips should be calm and utilitarian.

Recommended chips:

- Provider status: `Ready`, `No model`, `Error`.
- Preset state: `Current`, `Update available`, `Manual`.
- Theme source: `Bundled`, `Custom`, `JSON-only`.

Tone:

- Ready/current: success.
- Missing setup: warning.
- Error: danger.
- Data-only/source metadata: neutral/source.

## Accessibility

Chips must not rely on color alone.

Requirements:

- Chip text must carry the meaning: `Warning`, `Blocked`, `Needs review`, `Approved`.
- Tooltip can explain, but cannot be required to understand the basic state.
- Contrast should meet readable UI standards against the chip background.
- Interactive chips need focus-visible styling.
- Interactive chips should have sufficient hit target via padding or surrounding control structure.
- Do not use color-only dots without clear text for severity.

## Responsive Rules

On narrow drawers or mobile:

- Chips stay compact.
- Rows can wrap, but only to two lines in card lists.
- Long chips truncate with tooltip if necessary.
- Secondary chips collapse before primary chips.
- Details panels can show more chips than list cards.

Recommended behavior:

- Card list: one or two chip rows maximum.
- Workbench header: wrap allowed, but avoid pushing primary actions below the fold.
- Creator stage list: preserve vertical rhythm; do not let chip rows make one stage much taller than adjacent stages unless it contains warnings/blockers.

## Data Schema

Future chip models should use a shared object shape:

```js
{
  label: 'Needs review',
  tooltip: 'This stage has generated drafts waiting for manual review.',
  kind: 'status',
  tone: 'review',
  weight: 'standard',
  density: 'compact',
  priority: 20,
  maxChars: 32,
  interactive: false,
  testId: 'creator-stage-review-chip'
}
```

### Fields

| Field | Purpose |
| --- | --- |
| `label` | Visible chip text. Required. |
| `tooltip` | Explanation or longer context. Optional but recommended. |
| `kind` | `metadata`, `status`, `severity`, `count`, `source`, `tag`, or `action`. |
| `tone` | Shared semantic tone. |
| `weight` | `quiet`, `standard`, or `strong`. |
| `density` | `compact`, `standard`, or `touch`. |
| `priority` | Lower numbers render first and survive caps. |
| `maxChars` | Optional truncation limit. |
| `interactive` | Whether it is a control. |
| `testId` | Optional stable test selector for important chips. |

## Rendering Schema

The shared helper separates chip content from CSS classes:

```js
createChip({
  label: 'Needs review',
  tooltip: 'This stage has drafts waiting for review.',
  kind: 'status',
  tone: 'review',
  density: 'compact',
});
```

It should produce:

```html
<span class="saga-chip saga-chip-kind-status saga-chip-tone-review saga-chip-density-compact">
  Needs review
</span>
```

Current bridge path:

- `createStatusPill(text, tooltip, options)` wraps `createChip`.
- `createBadge(text, tooltip, options)` wraps `createChip` for Lorecard metadata.
- Existing specialized classes stay only as bridge hooks for layout, truncation, and surface-specific spacing.

## CSS Token Schema

Suggested shared variables:

```css
:root {
  --saga-chip-font-size-compact: 10px;
  --saga-chip-font-size-standard: 10px;
  --saga-chip-line-height-compact: 14px;
  --saga-chip-line-height-standard: 15px;
  --saga-chip-radius: 6px;
  --saga-chip-gap: 3px;
  --saga-chip-padding-compact: 0 4px;
  --saga-chip-padding-standard: 0 5px;
}
```

Tone variables are derived from eight Theme Pack metadata chip base colors. Theme Packs expose those base colors in the `Metadata Chips` color group, while runtime CSS derives fill, border, and foreground variables from them. Do not expose separate public knobs for every fill/border/foreground token.

Theme Pack color fields:

```js
chipNeutral
chipSource
chipInfo
chipReview
chipSuccess
chipWarning
chipDanger
chipMuted
```

Suggested tone variables:

```css
--saga-chip-neutral-bg
--saga-chip-neutral-border
--saga-chip-neutral-fg
--saga-chip-info-bg
--saga-chip-info-border
--saga-chip-info-fg
--saga-chip-review-bg
--saga-chip-review-border
--saga-chip-review-fg
--saga-chip-success-bg
--saga-chip-success-border
--saga-chip-success-fg
--saga-chip-warning-bg
--saga-chip-warning-border
--saga-chip-warning-fg
--saga-chip-danger-bg
--saga-chip-danger-border
--saga-chip-danger-fg
--saga-chip-muted-bg
--saga-chip-muted-border
--saga-chip-muted-fg
```

Default Saga Archive metadata chips should stay warm, low-saturation, and secondary to headings/actions. Other Theme Packs may shift the base colors, but the fill and border opacities should keep passive metadata quieter than buttons.

## Class Schema

Recommended final class names:

```css
.saga-chip
.saga-chip-density-compact
.saga-chip-density-standard
.saga-chip-density-touch
.saga-chip-kind-metadata
.saga-chip-kind-status
.saga-chip-kind-severity
.saga-chip-kind-count
.saga-chip-kind-source
.saga-chip-kind-tag
.saga-chip-kind-action
.saga-chip-tone-neutral
.saga-chip-tone-source
.saga-chip-tone-info
.saga-chip-tone-review
.saga-chip-tone-success
.saga-chip-tone-warning
.saga-chip-tone-danger
.saga-chip-tone-muted
.saga-chip-tone-selected
```

Legacy bridge classes:

```css
.saga-status-pill
.saga-lore-badge
.saga-lore-tag-chip
.saga-lore-timeline-ref-chip
.saga-continuity-filter-chip
.saga-context-workbench-resolver-score
.saga-lore-registry-badge
.saga-lore-meta-select-wrap
.saga-loredeck-creator-project-stage
.saga-loredeck-library-stack-folder-preview-chip
.saga-loredeck-library-folder-loredeck-entry-count
.saga-loredeck-library-folder-loredeck-health
.saga-loredeck-library-drag-copy
.saga-loredeck-library-detail-kicker
.saga-theme-accessibility-score
.saga-preset-status-stat-value
```

These should inherit base chip sizing and shared tone classes. They may constrain placement, max width, truncation, or grid alignment, but they should not declare chip typography, padding, radius, fill, border, or text color.

CSS pseudo-element chips, such as Library drag/drop target labels, cannot use `createChip`. They should still use shared chip tokens for size, radius, border, fill, and text color.

## Implementation Notes

Current relevant implementation points:

- `src/ui/runtime-ui-kit.js` owns `createStatusPill(...)` and `createBadge(...)`.
- `styles/runtime.css` owns the generic chip base, tone classes, Loredecks tab overrides, Creator stage labels, and many Library/Pack Health chip layout classes.
- `styles/components.css` and `styles/continuity.css` may still contain Lorecard layout rules, but text-derived Lorecard badge color classes have been removed.
- `.saga-loredeck-row-meta` is the common metadata row wrapper.
- `src/loredecks/loredeck-creator-projects.js` already creates chip objects with `tone`, which should be preserved and rendered.
- Status pill call sites in `src/` pass schema options so each chip declares semantic kind/tone at creation time.
- `tools/scripts/test-visual-smoke-harness.mjs` guards against adding a new `createStatusPill(...)` or `createBadge(...)` call without the schema options argument, and blocks the removed text-derived badge/status/health palette classes.

Do not do a broad visual rewrite without first establishing the shared classes and a small target surface.

## Migration Status

### Completed Foundation

- `createChip` is the shared DOM chip helper.
- `createStatusPill` and `createBadge` route through `createChip`.
- Chip kind, tone, and density classes are emitted for every helper-created chip.
- The helper can infer count, source, severity, status, and muted/review/success/warning/danger tones as a fallback, but source call sites are migrated to explicit schema options.
- Shared chip tokens live in `styles/tokens.css`.
- Shared chip base and tone classes live in `styles/runtime.css`.

### Completed Surface Migration

- Loredeck Creator project shelf stage and metadata chips.
- Loredeck Creator project stage chips keep only layout styling; review/running/warning/success colors come from shared schema tones.
- Loredeck Creator header, brief, outline, title set planner, title-pass rows, Context/Tag planning, Lorecard draft summaries, adaptive coverage, and readiness summaries.
- Loredeck Workbench registries, tag/timeline manager rows, entry override rows, generated export snapshot, and package install summaries.
- Loredeck Library header, folder rows, Active Stack rows, detail panels, package install, folder previews, and drag/drop metadata labels.
- Loredeck Library stack folder preview chips keep only the compact layout hook; stack status and health colors come from shared schema tones.
- Loredeck Library folder detail health chips keep only the compact layout hook; error/warning/OK colors come from shared schema tones.
- Loredeck Library drag-copy feedback renders through `createStatusPill` and updates tone with `setChipTone`; drag/drop pseudo labels use shared warning/danger chip tokens.
- Loredeck Library detail kickers render through `createStatusPill` with the `selected` tone instead of local gold chip styling.
- Pack Health hero, issue groups, issue state chips, Pack Health repair planning, and pack rows.
- Pack Health issue severity, affected scope, file, auto-fix, and ignored/resolved chips use shared schema tones with no local health-chip palette.
- Lorecard badges, read-only tag chips, editable tag chips, pending status badge, timeline filter chips, and timeline reference chips.
- Lorecard badge, tag-chip, and timeline-reference bridge classes are layout-only; shared schema tone classes own color, fill, and borders.
- Lorecard and Context Workbench count indicators render through schema-backed compact count chips instead of bespoke muted count text.
- Lore Timeline filter chips use shared `selected`/`muted` tones instead of per-filter chip color variables.
- Lore Timeline summary status and per-event change counts render through schema-backed compact count chips instead of bespoke muted count text.
- The unused legacy `saga-lore-panel-badge` class was removed.
- Lorecard registry badges, context gate badges, source metadata, and editable metadata dropdown chips now carry schema tone/kind/density classes; their wrapper CSS only constrains layout.
- Editable metadata dropdown chips use transparent inner selects; the schema-backed wrapper owns the chip fill, radius, padding, and type size. Accepted Lorecards relevance uses the dedicated one-click dot segmented control instead of a dropdown chip.
- Context command summary, automation mode chip, loaded Loredeck Context rows, Context proposal review, Context Workbench browser/resolver/validation chips, Context brief status chips, and resolver score bubbles.
- Context Workbench resolver score bubbles render through `createStatusPill` and keep only grid placement and width CSS on the score class.
- Advanced walkthrough instruction-card pills rely on shared schema sizing; `info`, `count`, and `source` tones come from the chip schema.
- Canon Preview selected-count feedback renders through `createStatusPill` and updates `selected`/`muted` tone through `setChipTone`.
- Assistant Draft Review and Pending Review summaries and proposal metadata rows.
- Assistant Draft Review risk/quality/health-impact chips now use schema tones instead of legacy risk/quality/health status-pill classes.
- Runtime shelf, Basic readiness, State Safety, and advanced walkthrough chips.
- Prompt Injection Current sync values render as schema-backed compact status pills inside the existing key/value row so in-place sync refreshes keep working.
- Theme Pack, Icon Set, color override, provider, provider preset, and accessibility summary chips.
- Theme accessibility score chips use schema success/warning tones instead of row-local score colors.
- Provider setup status pills rely on shared success/warning schema tones; `saga-provider-status-ready` and `saga-provider-status-warning` local palettes were removed.
- Provider preset compact stat values render through schema source/muted chips instead of bespoke `strong` value bubbles.
- Provider runtime model/key storage statuses and Theme Icon Set coverage status render through schema-backed compact status pills instead of bespoke small-text status labels.
- Loredeck Creator sidebar inputs, queue counts, job/cache values, failure diagnostic values, and generation toggle states render through schema-backed compact status pills instead of bespoke `strong` value bubbles.

### Remaining Guardrails

- New chip-like UI should use `createChip`, `createStatusPill`, or `createBadge`.
- CSS-only chip-like controls must use the shared chip tokens for size, radius, border, fill, and text color.
- Bridge classes such as `.saga-lore-badge`, `.saga-lore-badge-saga-meta`, `.saga-lore-tag-chip`, `.saga-lore-timeline-ref-chip`, `.saga-lore-timeline-event-counts`, `.saga-continuity-filter-chip`, `.saga-continuity-status`, `.saga-lore-workbench-count`, `.saga-lore-meta-select-wrap`, `.saga-instructions-section-header .saga-status-pill`, `.saga-context-workbench-resolver-score`, `.saga-canon-preview-selected-count`, `.saga-provider-runtime-status`, `.saga-prompt-sync-status-value`, `.saga-theme-icon-status`, `.saga-loredeck-creator-side-value`, `.saga-loredeck-creator-queue-value`, `.saga-loredeck-creator-diagnostic-value`, `.saga-loredeck-creator-generation-toggle-value`, and the Loredeck Library/Creator chip hooks must not declare their own color, background, border, border-color, font-size, font-weight, line-height, padding, border-radius, height, or min-height.
- Dynamic chips should update `saga-chip-tone-*` through `setChipTone` instead of adding action-specific palette suffix classes like `*-warning`, `*-remove`, or `*-invalid`.
- Legacy bridge classes should not reintroduce grey-black fills, `999px` pill radii, or font sizes below the compact 11px baseline.

## Acceptance Criteria

The chip system is successful when:

- Passive metadata chips are visibly smaller than titles.
- Creator cards no longer show rows of equally loud black/gray bubbles.
- Lorecard category/relevance chips retain useful color-coded scanning.
- Errors, warnings, review states, and ready states stand out without saturated clutter.
- Most card rows show 3-5 chips.
- Long IDs and secondary facts no longer dominate compact rows.
- The same tone means the same thing across Creator, Library, Context, Lorecards, Pack Health, and Settings.
- Adding a new chip in code requires choosing `kind`, `tone`, and `density`, not hand-writing ad hoc CSS.

## Anti-Patterns

Avoid these:

- Every chip uses the same neutral dark fill.
- Every chip gets a unique color.
- Passive metadata uses warning/error-level contrast.
- Chips are taller than 20px in dense card rows.
- Chip text is larger than adjacent descriptions or close to title size.
- Creator rows show all counts, all source fields, all statuses, and all IDs at once.
- Long machine IDs are visible by default in compact cards.
- Theme settings expose dozens of chip-specific knobs.

## Short Rule

Default to compact neutral chips. Add color only for kind, state, or severity. Use strong color only when the user needs to notice or act.
