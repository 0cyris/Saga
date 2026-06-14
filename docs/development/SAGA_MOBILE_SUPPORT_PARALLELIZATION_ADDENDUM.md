# Saga Mobile Support Parallelization Addendum

## Purpose

This addendum splits the Saga mobile support work into one prep workstream and three parallel implementation workstreams. It is designed so a coordinator can hand the same repository and this document to agents, then assign one of:

```text
You are Agent 0.
You are Agent 1.
You are Agent 2.
You are Agent 3.
```

Each agent should read this addendum and the main [Saga Mobile Support Feature](SAGA_MOBILE_SUPPORT_FEATURE.md) before making changes.

## Coordination Model

Do not ask three agents to independently implement "mobile support." That will create overlapping shell, state, and CSS changes. Instead:

- Agent 0 owns baseline prep, shared contract confirmation, and initial handoff.
- Agent 1 owns the mobile shell primitives and shared contract.
- Agent 2 consumes those primitives for the core operator tabs and Lorecards lifecycle.
- Agent 3 consumes those primitives for heavy workbenches, overlays, visual smoke coverage, and final verification.

Agent 0 should run before Agents 1, 2, and 3 begin implementation. Agent 0 does not build the feature; Agent 0 prepares the branch, confirms contracts, records current worktree state, and leaves the initial handoff. After Agent 0 is complete, Agents 1, 2, and 3 may work in parallel.

Merge order should be:

1. Agent 0.
2. Agent 1.
3. Agent 2.
4. Agent 3.

Agent 2 and Agent 3 may start analysis, component planning, and low-conflict local panel work before Agent 1 merges. They should not invent alternate shell primitives, route state, bottom-bar markup, or touch tokens.

## Same-Branch Parallel Work Rules

If all agents are working on the same git branch, treat the branch as a shared mutable workspace. The goal is not just to avoid merge conflicts; it is to avoid three coherent local changes combining into an incoherent product.

### Before Editing

Each agent should start by checking the working tree:

```powershell
git status --short
```

Before editing any file, the agent should inspect current content and any existing diff for that file. If a file already has changes from another agent, work with those changes. Do not overwrite, reset, or revert them.

### Shared Branch Rules

- Never use `git reset --hard`, `git checkout -- <file>`, broad cleanup commands, or force pushes to resolve coordination problems.
- Do not stage unrelated files. Prefer explicit paths over `git add -A`.
- Keep commits small enough that another agent can understand and integrate them.
- Use commit message prefixes when committing on the shared branch:
  - `mobile-agent0: ...`
  - `mobile-agent1: ...`
  - `mobile-agent2: ...`
  - `mobile-agent3: ...`
- Before pushing, pull or fetch the latest branch state using the repository's normal safe workflow. If the push is rejected, integrate the latest branch state and resolve only conflicts in files you understand.
- If a conflict touches another agent's owned logic and the resolution is not obvious, stop and report the conflict instead of guessing.

### When A Needed Primitive Is Missing

If an agent needs something another agent owns:

1. Check whether the primitive already exists in the branch.
2. If it exists, consume it as written.
3. If it does not exist and the work can continue locally, proceed behind a narrow integration point in the agent's owned files.
4. If continuing would require inventing the other agent's owned primitive, do not implement a duplicate. Leave a handoff note with:
   - the primitive needed,
   - the expected call shape or selector,
   - the files that will consume it,
   - the behavior blocked until it exists.
5. If the missing primitive blocks meaningful progress, stop after leaving the handoff note.

Examples:

- Agent 2 may draft Lorecards mobile markup that consumes `.saga-runtime-mobile`, but should not define the shell's mobile route state.
- Agent 3 may add visual smoke expectations for a More sheet, but should not implement a second More sheet if Agent 1 has not landed one.
- Agent 1 may add shell smoke hooks, but should not decide the final Lorecards lifecycle labels beyond the shared contract.

### When Another Agent Needs Your Work

Each agent should leave a concise handoff note in their final report. Do not rely on unstated assumptions in code comments.

The handoff note should include:

- files changed,
- exported helpers, class names, selectors, state fields, or route names,
- behavior intentionally left for another agent,
- known blockers,
- verification run and verification skipped.

Do not create or edit a shared handoff-notes file unless the coordinator explicitly asks for one. A shared notes file becomes another conflict point during parallel work.

### Shared File Conflict Rules

Some files are likely to be touched by more than one agent. Use these rules:

- `styles/tokens.css`: Agent 1 owns shared tokens. Other agents should use existing tokens or add local panel rules outside token definitions.
- `styles/layout.css`: Agent 1 owns shell layout. Other agents should avoid broad layout overrides here unless consuming Agent 1 primitives.
- `styles/review.css`: Agent 2 owns Lorecards mobile behavior. Agent 3 may add verification-driven fixes but should avoid rewriting Agent 2's lifecycle layout.
- `tools/scripts/test-visual-smoke-harness.mjs`: Agent 3 owns the final matrix. Agent 1 may add minimal shell checks; Agent 2 should request coverage in handoff notes unless a small assertion is clearly local.
- walkthrough files: Agent 3 owns final target coverage. Agent 2 should preserve exact labels and report any target moves.

### Stop Conditions

An agent should stop and report instead of continuing when:

- The next change requires redefining another agent's owned primitive.
- A shared file has conflicting changes and the correct resolution is product-level, not mechanical.
- A visual smoke or alpha-gate failure appears unrelated to the agent's changes.
- The agent cannot preserve the fixed bottom-bar order, exact Context labels, or Lorecards lifecycle labels without changing another workstream.

## Shared Product Contract

All agents must preserve these decisions:

- Mobile bottom bar order: `Loredecks | divider | Session | Context | Lorecards | More`.
- The divider after **Loredecks** is visual spacing, not a sixth tab.
- Mobile shell target widths: `360px`, `390px`, `430px`, and `768px` tablet sanity.
- Visual direction: `SAGA Archive` dark shell, `Saga Hero` icon language, hybrid mythic-tech styling.
- Avoid fandom-specific fantasy styling, generic sci-fi dashboards, and generic SaaS visuals.
- Primary mobile tabs are summary-first operator screens.
- No phone-width screen should require side-by-side desktop panes.
- No critical action may depend on hover, drag, or resize.
- Exact Context labels stay exact where they appear: `Start Here`, `Use Window`, `Use Anchor`, `After`, `Before`, `Timeline`, `Phrase Resolver`.
- Lorecards lifecycle: `Capture / Suggest -> Pending Review -> Accepted Lorecards -> Active Set`.
- Keep `Accepted Lorecards` as the visible product label unless the product deliberately renames that concept everywhere.
- Saga is pre-alpha. It is acceptable to update shell state and layout contracts in place instead of preserving incompatible old pre-alpha behavior.

## Shared Technical Contract

Agent 1 owns final names, but all agents should plan around this shape unless Agent 1 documents a replacement before merge:

```text
.saga-runtime-mobile
.saga-mobile-header
.saga-mobile-bottom-bar
.saga-mobile-bottom-tab
.saga-mobile-more-sheet
.saga-mobile-subview
.saga-mobile-touch
```

Expected route/state concepts:

- active mobile route
- active More route
- per-tab subview stack
- mobile close/back behavior
- desktop drawer/rail geometry ignored at phone widths

Expected shared touch tokens:

- mobile control height
- mobile icon button size
- mobile row action size
- mobile bottom bar height
- mobile safe-area padding

If an agent needs a different primitive, they should add a short handoff note explaining the reason and the consuming files.

## File Ownership Boundaries

These are ownership defaults, not absolute locks. If an agent must edit outside their area, the change should be small, documented, and coordinated in the handoff notes.

| Area | Primary Owner | Notes |
| --- | --- | --- |
| Baseline contracts, initial branch state, ownership map, initial verification checklist | Agent 0 | Prepares implementation work; should avoid building feature behavior. |
| Runtime shell, mobile class, bottom bar, header, More, subview stack | Agent 1 | Other agents should consume these primitives. |
| Shared layout and touch tokens | Agent 1 | Agent 2/3 may add local panel rules after shared tokens exist. |
| Session, Loredecks summary, Context summary, Lorecards lifecycle | Agent 2 | Avoid changing shell routing primitives. |
| Loredeck Library, Context Workbench, Health Center, Creator surfaces | Agent 3 | Avoid duplicating Agent 2's core tab summaries. |
| Visual smoke harness and mobile verification matrix | Agent 3 | Agent 1 may add minimal shell smoke checks if needed. |
| Walkthrough and guide target updates | Agent 3 | Coordinate exact labels with Agent 2 if Context UI moves. |
| Documentation updates | Coordinator or owning agent | Keep implementation docs scoped to changed behavior. |

## Shared Verification Baseline

Each agent should run the narrowest relevant checks they can. Final integration must run the broader checks.

Minimum per-agent expectations:

- Syntax or module checks for touched JavaScript where practical.
- `node tools\scripts\test-visual-smoke-harness.mjs` when visual smoke targets, guide targets, routing, or major UI contracts change.
- Focused manual or screenshot verification for the affected mobile viewport when browser tooling is available.

Final integration expectations:

```powershell
node tools\scripts\test-visual-smoke-harness.mjs
node tools\scripts\run-alpha-gate.mjs
```

If browser measurement is blocked, use direct breakpoint calculations plus the visual smoke harness rather than bypassing browser policy.

## Agent 0 Brief: Baseline And Contract Prep

### Assignment

You are Agent 0. Prepare the shared branch and implementation contract so Agent 1, Agent 2, and Agent 3 can begin in parallel without inventing incompatible primitives.

### Must Read

- [Saga Mobile Support Feature](SAGA_MOBILE_SUPPORT_FEATURE.md)
- This addendum
- Current git status and diffs before editing
- Runtime shell, navigation, visual smoke, Lorecards, Context, and workbench source maps before writing the handoff

### Primary Objective

Create the baseline map and handoff notes for parallel work. Agent 0 should remove ambiguity, not implement the mobile feature.

### Owned Phase

- Phase 0: Baseline And Contracts

### Likely Files

Agent 0 should prefer documentation and lightweight test-planning changes. Agent 0 may inspect many files, but should edit only when it clarifies the shared contract.

Likely edit targets:

- `docs/development/SAGA_MOBILE_SUPPORT_FEATURE.md`
- `docs/development/SAGA_MOBILE_SUPPORT_PARALLELIZATION_ADDENDUM.md`
- `docs/development/SAGA_VISUAL_SMOKE.md`, only if adding an initial mobile smoke checklist is useful
- small placeholder assertions or comments in `tools/scripts/test-visual-smoke-harness.mjs`, only if they are explicitly preparatory and do not block Agent 3

### Deliverables

- Current branch/worktree status summary.
- Confirmation of any pre-existing dirty files.
- File ownership map for Agent 1, Agent 2, and Agent 3.
- Initial selector/class/state proposal or confirmation of the shared technical contract.
- Initial mobile viewport verification checklist.
- Known dependency list, especially what Agent 2 and Agent 3 need from Agent 1.
- Explicit "ready for parallel work" handoff note.

### Do Not Own

- Mobile shell implementation.
- Bottom bar rendering.
- More sheet implementation.
- Lorecards lifecycle implementation.
- Heavy workbench mobile implementation.
- Final visual smoke matrix.

### Exit Criteria

- Agent 1 knows exactly which shell primitives to create.
- Agent 2 knows which shell primitives to wait for or consume.
- Agent 3 knows which verification and workbench areas are theirs.
- The current dirty worktree is documented so agents do not overwrite unrelated work.
- No feature behavior has been partially implemented in a way that forces Agents 1, 2, or 3 into Agent 0's assumptions.

### Handoff Notes To Leave

Agent 0 should leave a short handoff note with:

- current branch name and dirty-file summary,
- confirmed bottom-bar order,
- confirmed viewport targets,
- confirmed visual identity,
- expected shared class/state/token names,
- ownership boundaries,
- files inspected,
- checks run,
- checks intentionally skipped.

## Agent 1 Brief: Mobile Shell And Shared Primitives

### Assignment

You are Agent 1. Own the mobile shell foundation, shared layout primitives, navigation contract, and touch/visual system.

### Must Read

- [Saga Mobile Support Feature](SAGA_MOBILE_SUPPORT_FEATURE.md)
- This addendum
- Agent 0 handoff notes
- Runtime shell and navigation source files before editing

### Primary Objective

Replace the phone-width desktop rail/drawer behavior with reusable mobile primitives that Agent 2 and Agent 3 can consume.

### Owned Phases

- Phase 1: Shell Foundation
- Phase 2: Navigation, More, And Subviews
- Phase 3: Visual Identity And Touch System

### Likely Files

- `src/runtime/runtime-shell.js`
- `src/runtime/runtime-shell-view.js`
- `src/runtime/runtime-navigation.js`
- `src/runtime/tab-registry.js`
- `src/state/default-state.js`
- `src/state/state-manager.js`
- `styles/layout.css`
- `styles/tokens.css`
- relevant visual smoke shell fixtures if needed

### Deliverables

- Viewport-based mobile shell detection.
- `.saga-runtime-mobile` or documented equivalent.
- Fixed bottom bar in the required order.
- Visual divider after **Loredecks**.
- Compact mobile header.
- More sheet or route.
- Subview stack primitive.
- Mobile close/back behavior.
- Mobile touch-density tokens.
- `SAGA Archive` and `Saga Hero` visual treatment for shell icons and active states.
- Desktop shell behavior preserved outside the mobile breakpoint.

### Do Not Own

- Lorecards lifecycle implementation.
- Loredeck Library mobile staged views.
- Context Workbench mobile staged views.
- Creator mobile workflow.
- Full visual smoke matrix.

### Exit Criteria

- At `360px`, `390px`, and `430px`, the shell itself has no horizontal overflow.
- Bottom bar is visible, safe-area padded, and ordered correctly.
- Header exposes title and back/close where required.
- More routes are reachable.
- Other agents have stable primitives to consume.
- Desktop rail/drawer behavior still works at desktop widths.

### Handoff Notes To Leave

Agent 1 should leave a short handoff note with:

- Final class names.
- Final route/state shape.
- How a tab pushes/pops a mobile subview.
- How a tab opens a More route.
- Any shared token names.
- Any known shell limitations.

## Agent 2 Brief: Operator Tabs And Lorecards Lifecycle

### Assignment

You are Agent 2. Own the summary-first mobile operator tabs and the Lorecards lifecycle flow.

### Must Read

- [Saga Mobile Support Feature](SAGA_MOBILE_SUPPORT_FEATURE.md)
- This addendum
- Agent 0 handoff notes
- Agent 1 handoff notes, once available
- Existing Session, Loredecks, Context, and Lorecards renderers before editing

### Primary Objective

Make the core mobile tabs usable as operator-console screens, with Lorecards moving through a visible object lifecycle instead of scattered button rows.

### Owned Phases

- Phase 4: Operator Console Tabs
- Phase 5: Lorecards Lifecycle Flow

### Likely Files

- `src/runtime/lore-panel.js`
- Session runtime tab files
- Loredecks runtime summary files
- Context runtime tab files
- `src/lorecards/*`
- `styles/review.css`
- local panel CSS needed for core tab mobile layouts

### Deliverables

- Session opens with readiness and next useful action.
- Loredecks opens with Active Stack status, deck readiness, and Library access.
- Context opens with current story position and next Context action before diagnostics.
- Context preserves exact labels: `Start Here`, `Use Window`, `Use Anchor`, `After`, `Before`, `Timeline`, `Phrase Resolver`.
- Lorecards lifecycle surface:
  - Capture / Suggest
  - Pending Review
  - Accepted Lorecards
  - Active Set
- Pipeline counters filter suggested, pending, accepted, and active cards.
- Manual notes, story scans, Creator drafts, and Context suggestions feed the same review flow.
- Pending cards have visible accept, edit, reject, and inspect controls.
- Active Lorecards can be inspected, activated, muted, and pinned without hover or drag.

### Do Not Own

- Mobile shell class names.
- Bottom bar implementation.
- More sheet implementation.
- Touch token definitions.
- Loredeck Library full mobile staged views.
- Context Workbench full staged views.
- Visual smoke harness ownership.

### Exit Criteria

- Each primary tab opens with a summary and next useful action.
- Lorecards can move through `Capture / Suggest -> Pending Review -> Accepted Lorecards -> Active Set`.
- The flow does not reintroduce redundant create entry points.
- Critical Lorecards actions have visible tap targets.
- Basic remains lightweight while Advanced preserves deeper access.

### Handoff Notes To Leave

Agent 2 should leave a short handoff note with:

- Which tab surfaces changed.
- Which Agent 1 primitives were consumed.
- The final Lorecards state labels and filters.
- Any mobile-only data or state assumptions.
- Any visual smoke or walkthrough targets Agent 3 needs to cover.

## Agent 3 Brief: Heavy Workbenches, Walkthroughs, And Verification

### Assignment

You are Agent 3. Own the dense workbench adaptations, overlay behavior, visual smoke matrix, walkthrough target updates, and final verification.

### Must Read

- [Saga Mobile Support Feature](SAGA_MOBILE_SUPPORT_FEATURE.md)
- This addendum
- Agent 0 handoff notes
- Agent 1 handoff notes
- Agent 2 handoff notes
- Existing visual smoke documentation and harness

### Primary Objective

Make the densest Saga surfaces usable on mobile and prove the mobile MVP across target viewports.

### Owned Phases

- Phase 6: Heavy Workbench Adaptation
- Phase 7: Verification, Walkthroughs, And Release Readiness

### Likely Files

- `src/loredecks/loredeck-library-panel.js`
- `src/context/context-workbench-panel.js`
- `src/context/context-panel.js`
- Health Center files
- Creator project and draft files
- `tools/scripts/test-visual-smoke-harness.mjs`
- `docs/development/SAGA_VISUAL_SMOKE.md`
- walkthrough files if target routing changes

### Deliverables

- Loredeck Library mobile staged views.
- Context Workbench mobile staged views.
- Health Center mobile route or sheet.
- Creator mobile MVP surface.
- Large overlays use mobile header/back behavior.
- Mobile visual smoke matrix for `360x740`, `390x844`, `430x820`, and `768x1024`.
- Checks for bottom bar, header, More, subviews, touch targets, and no horizontal overflow.
- Checks for Lorecards lifecycle reachability.
- Visual review checks for `Saga Hero` icons and hybrid mythic-tech styling.
- Walkthrough/guide target updates if mobile routing changes target availability.

### Do Not Own

- Shell primitive definitions.
- Bottom bar order or shell state.
- Core Lorecards lifecycle state labels.
- Session/Loredecks/Context summary-first primary layouts unless needed for verification fixes.

### Exit Criteria

- Loredeck Library does not require multiple desktop columns at phone widths.
- Context Workbench does not require side-by-side desktop panes at phone widths.
- Health and Creator surfaces have reachable close/back controls.
- Walkthrough targets remain resolvable.
- Phone and tablet visual smoke coverage passes.
- Desktop runtime shell coverage still passes.
- `node tools\scripts\test-visual-smoke-harness.mjs` passes.
- `node tools\scripts\run-alpha-gate.mjs` passes after integration.

### Handoff Notes To Leave

Agent 3 should leave a short handoff note with:

- Final verification commands and results.
- Mobile viewport coverage.
- Any unresolved visual or interaction risks.
- Any walkthrough target changes.
- Any deferred non-MVP mobile issues.

## Coordinator Merge Checklist

Before merging Agent 0:

- Confirm current branch/worktree status is documented.
- Confirm ownership boundaries are explicit.
- Confirm shared class/state/token proposals are documented.
- Confirm Agent 0 did not partially implement feature behavior that belongs to Agents 1, 2, or 3.
- Confirm the branch is ready for parallel work.

Before merging Agent 1:

- Confirm bottom bar order and divider.
- Confirm mobile shell does not overflow at phone widths.
- Confirm desktop shell still works.
- Confirm Agent 1 handoff names are clear.

Before merging Agent 2:

- Confirm it consumes Agent 1 primitives instead of redefining them.
- Confirm exact Context labels remain exact.
- Confirm Lorecards lifecycle labels remain consistent.
- Confirm no redundant create/suggest entry points were reintroduced.

Before merging Agent 3:

- Confirm heavy workbenches use mobile subviews or sheets.
- Confirm visual smoke matrix exists.
- Confirm walkthrough targets still resolve.
- Confirm the final checks pass or failures are explicitly documented.

## Copyable Assignment Prompts

### Agent 0 Prompt

```text
You are Agent 0 for Saga mobile support. Read docs/development/SAGA_MOBILE_SUPPORT_PARALLELIZATION_ADDENDUM.md and docs/development/SAGA_MOBILE_SUPPORT_FEATURE.md. Follow the same-branch parallel work rules. Own only the Baseline And Contract Prep workstream. Document the current branch/worktree state, confirm ownership boundaries, confirm the fixed bottom bar order, viewport targets, Saga Hero visual direction, shared class/state/token proposal, and mobile verification checklist. Leave clear handoff notes for Agent 1, Agent 2, and Agent 3. Do not implement the mobile shell, Lorecards lifecycle, or heavy workbench mobile views.
```

### Agent 1 Prompt

```text
You are Agent 1 for Saga mobile support. Read docs/development/SAGA_MOBILE_SUPPORT_PARALLELIZATION_ADDENDUM.md and docs/development/SAGA_MOBILE_SUPPORT_FEATURE.md. Follow the same-branch parallel work rules before editing or pushing. Own only the Mobile Shell And Shared Primitives workstream. Implement the mobile shell foundation, fixed bottom bar, mobile header, More routing, subview primitive, touch-density tokens, and Saga Hero visual shell treatment. Leave clear handoff notes for Agent 2 and Agent 3. Do not implement Lorecards lifecycle or heavy workbench mobile views.
```

### Agent 2 Prompt

```text
You are Agent 2 for Saga mobile support. Read docs/development/SAGA_MOBILE_SUPPORT_PARALLELIZATION_ADDENDUM.md and docs/development/SAGA_MOBILE_SUPPORT_FEATURE.md. Follow the same-branch parallel work rules before editing or pushing. Own only the Operator Tabs And Lorecards Lifecycle workstream. Consume Agent 1's shell primitives. Implement summary-first Session, Loredecks, Context, and Lorecards mobile layouts, including the Capture / Suggest -> Pending Review -> Accepted Lorecards -> Active Set lifecycle. Preserve exact Context labels. Do not redefine the mobile shell, bottom bar, More sheet, or touch token contract.
```

### Agent 3 Prompt

```text
You are Agent 3 for Saga mobile support. Read docs/development/SAGA_MOBILE_SUPPORT_PARALLELIZATION_ADDENDUM.md and docs/development/SAGA_MOBILE_SUPPORT_FEATURE.md. Follow the same-branch parallel work rules before editing or pushing. Own only the Heavy Workbenches, Walkthroughs, And Verification workstream. Consume Agent 1 shell primitives and Agent 2 lifecycle labels. Adapt Loredeck Library, Context Workbench, Health Center, and Creator surfaces for mobile staged views, then extend visual smoke coverage and walkthrough target checks. Do not redefine the mobile shell or core Lorecards lifecycle.
```
