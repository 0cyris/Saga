# Deck Maker Guide for Mobile

This guide covers the phone-width **Deck Maker** UI. It assumes you are using Saga's mobile shell with bottom navigation. You do not need to know the desktop Deck Maker UI to use this guide.

Deck Maker creates **Generated Loredecks** through staged, review-first authoring. Mobile Deck Maker uses the same generation pipeline as desktop, but the workbench is arranged for touch, vertical reading, and tighter current-task focus.

## Requirements

Deck Maker is an Advanced mobile workflow.

Before using it:

- switch Saga to **Advanced**
- configure a **Reasoning Provider**
- decide the fandom and scope
- be ready to review generated output
- run Pack Health before trusting or finalizing the deck

## Opening Deck Maker On Mobile

1. Open Saga on a phone-width viewport.
2. Tap **Loredecks** in the bottom bar.
3. Tap **Create Deck**.
4. If you already have a project, use **In Progress** to resume it.

<p align="center">
  <img src="../../assets/documentation/renders/docs-mobile-advanced-creator.png" alt="Deck Maker mobile workbench" width="360">
</p>

If **Create Deck** is not visible, switch to Advanced. Basic mobile keeps Deck Maker hidden.

## Mobile Workbench Layout

The mobile Deck Maker workbench focuses on:

- current task first
- compact stage roadmap
- touch-sized stage actions
- review queue visibility
- bottom-owned actions where the overlay requires them
- vertical reading instead of side-by-side desktop panes

The stages are:

1. **Scope Brief**
2. **Story Outline**
3. **Title Pass**
4. **Context Plan**
5. **Lorecards**
6. **Review Queue**
7. **Pack Health**
8. **Finalize**

Tap stage cards to inspect progress. Locked stages explain what needs to happen first. Reset controls can appear for completed stages and remove downstream work after that step.

## Current Task

The **Current Task** card is the first place to look. It tells you the next action and what the current stage needs.

It can show:

- the next generation action
- the current review action
- running generation status
- retry or cancel controls
- short guidance about what unlocks the next stage

On mobile, use Current Task before scrolling through the rest of the workbench. It is the fastest way to avoid getting lost in a long project.

## Project Inputs And Settings

Use project settings to define or inspect:

- fandom
- scope
- granularity
- project title
- generated deck identity
- notes and coverage direction
- generation settings exposed for the project

Change inputs before approving downstream stages. If the scope changes after you already generated later stages, reset to the affected stage instead of continuing with mismatched data.

## Scope Brief

The **Scope Brief** is the first approval gate.

It confirms:

- title
- generated deck ID
- fandom
- scope
- coverage summary
- granularity

Approve it only when the generated deck should be built from that plan. If it is too broad, too narrow, or aimed at the wrong story range, revise before continuing.

## Story Outline

The **Story Outline** defines the story shape. It can include:

- major beats
- Context milestones
- title-batch slices
- assumptions or clarification questions

Review the outline carefully on mobile. A wrong outline creates weak title batches and usually causes later Context or Lorecard problems.

## Title Pass

The **Title Pass** drafts candidate Lorecard titles in planned sets.

Mobile controls can include:

- **Generate Next Title Batch**
- **Generate Remaining**
- title selection
- **Approve Selected Titles**
- **Unapprove Selected**
- **Drop Selected**
- **Select All**
- **Clear Selection**
- **Revise Selected Titles**
- per-title **Edit JSON**
- per-title **Drop**

Titles are plans, not Lorecards. Approve only titles that should become actual generated entries.

## Context Plan

The **Context Plan** stage builds the Generated Loredeck's timeline and tags.

It can draft:

- anchors
- windows
- tag definitions
- usage links for approved titles

Controls can include:

- **Plan Context and Tags**
- **Plan This Set**
- **Open Context Plan**
- **Add to Stack**

Generated Context and tag proposals remain reviewable. They must be accepted before they become registry data used by Lorecard drafting.

## Lorecard Drafting

The **Lorecards** stage drafts schema v3 Lorecards from approved titles and accepted Context/tag plans.

Controls can include:

- **Draft Lorecards**
- **Auto-Draft All**

On mobile, use **Auto-Draft All** only after reading the confirmation count. It may run multiple Reasoning Provider calls. Small batches are easier to recover when one draft fails validation.

Deck Maker can preserve valid drafts while reporting rejected drafts separately. Watch for:

- preflight gaps
- rejected draft counts
- repair notes
- unknown tag or timeline references
- retry-smaller guidance

## Review Queue And Draft Review

Mobile Deck Maker keeps review queues visible so you can see what is waiting before continuing.

Queue types include:

- planning proposals
- Lorecard drafts
- Pending Lorecards
- repairs or fixes

Draft Review can include:

- **Send Selected to Review**
- **Send All to Review**
- **Drop Selected**
- **Select All**
- **Clear Selection**
- **Revise Selected**
- per-draft **Send to Review**
- per-draft **Edit JSON**
- per-draft **Drop**

Sending drafts to review moves them into the normal Pending Review flow. It does not accept them automatically.

## Pack Health And Finalization

Before trusting a Generated Loredeck, run Pack Health from Deck Maker or the Loredeck detail sheet.

Deck Maker readiness can show:

- pipeline progress
- title-set progress
- accepted Context set progress
- accepted title coverage
- Pack Health status
- adaptive coverage status
- blockers and warnings
- remaining entry count

Actions can include:

- **Run Pack Health**
- **Open Pack Health Center**
- **Attempt Fixing**
- **Open Coverage Plan**
- **Finalize Anyway**

Do not finalize just because the deck generated successfully. Finalize only after review, accepted entries, Pack Health, and coverage warnings make sense for the intended scope.

## In-Progress Projects On Mobile

The mobile Loredecks route can show in-progress Deck Maker projects.

Use it to:

- resume unfinished projects
- see current stage
- inspect generated/draft status
- rename projects when available
- delete stale projects
- manage project/folder organization when exposed

Cancel running generation before deleting a project.

## Mobile Workflow

1. Tap **Loredecks**.
2. Tap **Create Deck**.
3. Fill project inputs.
4. Generate and approve the **Scope Brief**.
5. Generate and approve the **Story Outline**.
6. Generate title batches.
7. Approve useful titles.
8. Plan Context and Tags.
9. Review and accept planning proposals.
10. Draft Lorecards.
11. Review Deck Maker drafts.
12. Send useful drafts to Pending Review.
13. Accept or reject Pending Review entries.
14. Run Pack Health.
15. Resolve blockers and coverage warnings.
16. Finalize only when the Generated Loredeck is ready.

## Mobile Troubleshooting

| Problem | First check |
| --- | --- |
| Create Deck is missing | Switch to Advanced. |
| You do not know what to do next | Read the Current Task card. |
| A stage is locked | Complete and approve the previous stage. |
| A title batch is wrong | Revise or drop titles before approving them. |
| Lorecard drafting is blocked | Accept Context and Tag proposals first. |
| Drafts fail validation | Read rejection details and retry smaller. |
| Finalize is blocked | Run Pack Health and resolve readiness blockers. |

