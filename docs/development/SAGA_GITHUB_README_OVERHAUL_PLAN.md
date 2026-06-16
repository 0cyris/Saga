# Saga GitHub README Overhaul Plan

This plan defines the next README shape before rewriting `README.md`.

The README pacing target is a light opener, quick setup, visual feature tour, then practical operating notes. Saga needs that readability, but with a fuller operator's manual because Saga is an extension with persistent state, Loredecks, Context, review queues, Pack Health, and prompt injection.

## Goals

- Make the README useful as Saga's public GitHub front door.
- Preserve a lightweight first impression before the manual begins.
- Explain the product model clearly enough that a new tester can operate Saga without reading every development note.
- Keep deep schema, authoring, and engineering detail linked out to focused docs.
- Use the curated renderer set instead of expanding back toward the old 80-image batch.
- Keep public terminology consistent: Loredeck, Lorecard, Loredeck Library, Active Stack, Context, Pending Review, Deck Maker, Bundled Lorepack, Generated Lorepack, Custom Lorepack, and Pack Health.

## Proposed README Shape

### 1. Banner And Identity

Keep the existing banner and `# SAGA` heading.

Opening copy should be short:

- One-line identity: `SAGA: Fandom Loresystem.`
- One paragraph: Saga is a SillyTavern extension for long-form fandom roleplay and fanfiction that keeps lore modular, contextual, reviewable, and prompt-ready.
- One paragraph: Saga is not a wiki viewer or a preset. It is a runtime lore system for deciding what lore applies now.

Use one image here at most:

- `assets/branding/saga-banner-full.png`

### 2. Current Status

Short, candid status block near the top.

Include:

- Pre-alpha integration hardening.
- Built for testers and collaborators, not polished public release users.
- Schemas and workflows may change.
- Recommended path is Basic Experience first, Advanced after the first successful run.

Avoid turning this into the full feature list.

### 3. Fast Start

Start with actionable setup steps.

Recommended steps:

1. Install Saga as a SillyTavern third-party extension.
2. Reload SillyTavern.
3. Open Saga shelf.
4. Start in Basic Experience.
5. Open Loredecks and load a Loredeck into the Active Stack.
6. Browse Context and select the story position in the Context Workbench.
7. Review or add Lorecards.
8. Confirm the Start Checklist.
9. Continue roleplay and use Advanced only when needed.

Use one image:

- `docs-shell-basic-start.png`

Keep detailed Basic/Advanced workflow links immediately after this section.

### 4. What Saga Adds

This should be the lightweight feature tour before the manual.

Use short feature blocks rather than dense subsections:

- Loredecks: modular fandom and custom lore packages.
- Lorecards: reviewable units of lore that can affect the next response.
- Context: story position, timing, arc, chapter, route, or other coordinate system.
- Active Stack: ordered loaded Loredecks for the current chat.
- Pending Review: model-assisted changes stay draft until accepted.
- Injection: only eligible, relevant lore reaches the model.
- Pack Health: validate structure before trusting a Loredeck.
- Creator: staged generation for new Loredecks.

Suggested images:

- `docs-loredecks-overview.png`
- `docs-context-command-center.png`
- `docs-lorecards-overview.png`
- `docs-injection-high-preview.png`

### 5. Mental Model

Short conceptual bridge before the operator's manual.

Explain the flow:

```text
Loredeck Library -> Active Stack -> Context -> Lorecards -> Injection -> Model response
```

Then explain the review loop:

```text
Generate or edit -> Pending Review -> Accept -> Pack Health -> Use in chat
```

This should be prose plus small diagrams or text blocks, not more screenshots.

### 6. Operator's Manual

This is the comprehensive body of the README. It should be practical, sectioned by the actual way an operator uses Saga.

#### 6.1 First Run Checklist

Cover Basic Experience and the Start Checklist.

Image:

- `docs-shell-basic-start.png`

#### 6.2 Session

Cover runtime status, Basic vs Advanced, automation mode, and when to use Session controls.

Image:

- `docs-session-advanced-status.png`

#### 6.3 Loredecks And Active Stack

Cover:

- Bundled Lorepack, Generated Lorepack, Custom Lorepack.
- Loredeck Library.
- Active Stack priority.
- Enabling/disabling deck participation.
- Selected Loredeck details.
- Import/export at a high level, with detailed package rules linked out.

Images:

- `docs-loredecks-overview.png`
- `docs-loredeck-library-overview.png`
- `docs-loredeck-library-active-stack.png`
- `docs-loredeck-library-selected-details.png`

#### 6.4 Pack Health

Cover:

- What Pack Health validates.
- Difference between structural health and canon accuracy.
- How grouped issues support repair.
- When to run Pack Health.

Images:

- `docs-pack-health-overview.png`
- `docs-pack-health-issues.png`

#### 6.5 Deck Maker

Cover:

- Deck Maker is staged generation, not one giant deck prompt.
- Scope Brief first.
- Current task area.
- Generated material remains draft until reviewed and finalized.

Images:

- `docs-deck-maker-desktop-intake.png`
- `docs-deck-maker-desktop-current-task.png`

#### 6.6 Context

Cover:

- Context as story position.
- Manual, detected, and reviewed Context.
- Loaded Loredeck Context rows.
- Browse Context workbench.
- Proposal review.

Images:

- `docs-context-command-center.png`
- `docs-context-loaded-loredecks.png`
- `docs-context-workbench.png`
- `docs-context-proposal-review.png`

#### 6.7 Lorecards

Cover:

- Accepted vs Pending.
- Relevance tiers.
- Pin, mute, edit, merge, and review behavior.
- Why broad wiki summaries are weaker than targeted Lorecards.

Images:

- `docs-lorecards-overview.png`
- `docs-lorecards-pending-review.png`
- `docs-lorecards-accepted-list.png`
- `docs-lorecards-workbench.png`
- `docs-lore-timeline.png`

#### 6.8 Continuity

Cover:

- Lightweight live state vs durable Lorecards.
- Scan controls.
- Character state and current scene state.
- Why Continuity should not become a second static lore database.

Images:

- `docs-continuity-overview.png`
- `docs-continuity-scan.png`
- `docs-continuity-character-state.png`

#### 6.9 Injection

Cover:

- Prompt placement.
- Split relevance tiers.
- Direct vs compressed handling.
- Context gates, pin/mute, and eligible Lorecards.
- Why the preview is the operator's truth source for what Saga will send.

Images:

- `docs-injection-overview.png`
- `docs-injection-placement.png`
- `docs-injection-high-preview.png`

#### 6.10 Settings, Providers, Themes

Cover:

- Utility vs Reasoning providers.
- Model output is draft until reviewed.
- Theme Packs and Icon Sets are passive data, not executable extensions.

Images:

- `docs-settings-providers.png`
- `docs-settings-theme-pack.png`

#### 6.11 Troubleshooting

Keep this compact in README and link deeper docs.

Recommended topics:

- Saga shelf does not open.
- No Loredecks loaded.
- Context is missing or wrong.
- Lorecards are accepted but not injected.
- Pack Health shows issues.
- Provider calls fail.
- Visual smoke and renderer commands.

### 7. Built-In Reference Lorepacks

Keep the HP split-family list, but make it shorter and more purposeful.

Explain:

- `hp-core` is reusable baseline.
- Year decks narrow Context and reduce future-canon leakage.
- Reference decks model the target authoring quality for future Bundled Lorepacks.

Avoid long per-deck descriptions in the README.

### 8. Documentation Links

Keep links to release-facing docs:

- Basic Workflow
- Advanced Workflow
- Loredeck And Lorecard Creation
- LLM Loredeck Generation Guide
- Loredeck Schema Reference
- Documentation Index

Development notes should be secondary.

### 9. Development Checks

Move most current check commands into a compact "For contributors" block.

Keep only:

- Health/conformance tests.
- Visual smoke.
- Documentation renderer.

Detailed command suites belong in development docs.

## Image Budget

The README should use about 25-30 images, matching the current renderer matrix. It should not show every tiny control when a parent screenshot already captures that UI.

Current accepted image set: 30 rendered PNGs in `assets/documentation/renders`.

The two newest required captures are the module-based walkthrough cards:

- `docs-basic-walkthrough-modules.png`
- `docs-advanced-walkthrough-modules.png`

Use all 30 only if the operator's manual remains in the GitHub README. If the README is later split into a short front page plus separate manual docs, reduce the README itself to 8-12 images and move the rest to docs.

## Content To Move Out Or Link Out

Keep out of the README body unless a short summary is needed:

- Full schema field references.
- Detailed Loredeck package internals.
- Long Creator architecture details.
- Full development roadmap.
- Exhaustive troubleshooting.
- Test implementation detail.
- Historical migration notes beyond the current Saga docs.

## Open Decisions

- Whether to introduce an image table at the bottom mapping screenshot filenames to manual sections.

## Decisions Made In First Rewrite

- Use **Pack Health** as the public label. Treat older **Deck Health** wording as stale or internal historical wording.
- Use **Loredeck** and **Lorecard** for the main object model.
- Use **Bundled Lorepack**, **Generated Lorepack**, and **Custom Lorepack** only for the three public package type labels.
- Keep the operator's manual inline in the GitHub README for the first overhaul pass.
- Commit the curated README screenshot PNGs under `assets/documentation/renders`, while keeping the local `.saga-doc-renderer` harness ignored.

## Suggested Implementation Sequence

1. Draft the new README skeleton with headings and image placements.
2. Move excessive current README detail into linked docs where needed.
3. Insert curated screenshot references from `assets/documentation/renders`.
4. Re-read as a first-time tester and trim repeated explanations.
5. Run markdown link checks and a quick rendered preview pass.
