# Saga Advanced Workflow

Use Advanced Experience when you want the full Saga control surface for authoring, diagnostics, automation, package work, and prompt tuning.

Advanced uses the same saved data as Basic. Loredecks, Context, pending Lorecards, accepted Lorecards, pin/mute choices, provider settings, Theme Packs, and stack state carry across mode changes.

## Advanced Walkthrough

The in-app **Advanced Walkthrough** is organized as task tracks. Use **Start Advanced Walkthrough** for the complete map, or start the module that matches the system you are inspecting.

### Loredeck Library Mastery

Coverage: A01-A25.

Use this track to manage Library records, source types, folders, search, sorting, selected-pack details, Pack Health summaries, active stack order, bulk selection, export, package import, duplicate warnings, Custom duplication, folder actions, and deeper workbench routes.

Start here when a chat has no active stack, the wrong stack order, a missing package, an unclear Lorepack source, or a package you need to inspect before runtime use.

### Session And Runtime Control

Coverage: A26-A33.

Use this track to manage Experience Mode, **Saga Active**, Automation Mode, runtime metrics, guide modules, active chat state, cleanup actions, and mode recovery.

Start here when you need to understand what Saga is allowed to do, whether automation is active, or whether the current chat has the expected Saga state.

### Context Resolution

Coverage: A34-A60.

Use this track to resolve story position with Runtime Context, loaded Loredeck Context rows, Context Workbench layout, Anchors versus Windows, Choose Story Position, Start Here, Use Window, After/Before bounds, Timeline inspection, manual selection, Phrase Resolver diagnostics, locks, Detect Context, source-message tuning, local resolver behavior, Reasoner proposals, proposal review, audits, Advanced Context Brief, reset paths, index summaries, workbench routes, and eligibility debugging.

Start here when canon suggestions, retrieval, or injection appear tied to the wrong arc, date, chapter, episode, quest, branch, or location.

### Lorecard Generation And Review

Coverage: A61-A82.

Use this track to manage canon preview, canon selection, story-lore scans, scan scope, manual Lorecards, assistant drafts, Pending Review, pending edits, accept/reject flows, bulk review, accepted Lorecards, search/filter, accepted entry editing, pin/mute, relevance tiers, tags, Context metadata, duplicate guards, Auto-Relevance, timeline audit, workbenches, and the review-first policy.

Start here after Context is current and the story has durable facts or canon constraints worth saving.

### Injection Diagnostics

Coverage: A83-A97.

Use this track to inspect exactly what Saga sends to the model. It covers Continuity and Lore toggles, High/Normal/Low relevance previews, direct versus compressed handling, prompt placement, compression prompts, combined prompt reading, token estimates, omission reasons, and sync diagnostics.

Start here when the model ignores important lore, sees stale state, receives too much prompt context, or appears influenced by something you cannot find.

### Continuity Tracking

Coverage: A98-A111.

Use this track to manage live scene state separately from durable Lorecards. It covers continuity scans, automation, scope, custom ranges, performance, tracked sections, scene state, active characters, key items, goals and threads, emotional freshness, the injection link, and recovery from failed or interrupted scans.

Start here when the next response needs current-scene state such as date, location, posture, emotions, possessions, or immediate objectives.

### Creator And Generated Lorepack Authoring

Coverage: A112-A130.

Use this track to create and complete Generated Lorepack projects. It covers **Create Deck**, intake, scope brief, outline, title pass, title review, Context and tag planning, planning review, Lorecard drafting, confirmed Auto-Draft All, Creator draft review, sending drafts to Pending Review, review queue jumps, current task controls, generation settings, project shelf, project management, generated-pack inspection, and readiness gates.

Start here when you need Saga to help author a new Generated Lorepack rather than import or edit an existing pack.

### Pack Health And Packages

Coverage: A131-A141.

Use this track to validate, repair, update, export, and finalize Lorepacks. It covers Pack Health Center, status, issue groups, safe repair, manual repair routes, package update, local modification warnings, Bundled Lorepack reference export, Custom Lorepack embedded export, Generated to Custom finalization, and generated export readiness.

Start here before sharing a pack, finalizing a Generated Lorepack, repairing package issues, or trusting a pack with warnings.

### Settings And Providers

Coverage: A142-A153.

Use this track to configure Utility and Reasoning provider roles, provider profiles, endpoints, models, provider tests, current SillyTavern model routing, generation parameters, provider presets, API compatibility flags, Theme Packs, icon sets, colors, and diagnostics.

Start here when model-backed actions fail, profile routing is unclear, generation behavior needs tuning, or the runtime surface needs visual configuration.

### Troubleshooting Routes

Coverage: A154-A165.

Use this track to route common symptoms to the right system: no Loredeck, wrong Context, no suggestions, stuck pending entries, no injection, prompt too heavy, provider failure, stale continuity, duplicate package warnings, Pack Health warnings, Creator failure, or returning to Basic.

Start here when the problem is clear but the right Saga surface is not.

## Recommended Advanced Workflow

1. Configure provider readiness in **Settings And Providers**.
2. Build and order the active stack in **Loredeck Library Mastery**.
3. Resolve story position in **Context Resolution**.
4. Generate and review durable facts in **Lorecard Generation And Review**.
5. Inspect what Saga sends in **Injection Diagnostics**.
6. Track live scene state in **Continuity Tracking** when current state matters.
7. Use **Creator And Generated Lorepack Authoring** when building a new Generated Lorepack.
8. Use **Pack Health And Packages** before finalizing, exporting, repairing, or trusting packages with warnings.
9. Use **Troubleshooting Routes** when you need the shortest diagnostic path.

Advanced should still remain review-first. Model-produced proposals should become pending or reviewable changes before they affect prompts.

## What Advanced Adds

- Full rail access, including **Continuity** and **Injection**.
- Automation and cadence controls.
- Context auditing, proposals, locks, workbenches, and Advanced Context Brief details.
- Lorecard workbenches, bulk actions, timeline/audit history, and Auto-Relevance.
- Full injection preview by relevance tier, prompt placement, compression, token estimates, omission reasons, and sync diagnostics.
- Pack Health, package import/update/export, duplication, repair, Generated to Custom finalization, Create Deck, and in-progress Creator projects.

## When To Return To Basic

Switch back to Basic when routine roleplay no longer needs Advanced controls visible. Basic keeps the same accepted Lorecards, Context, stack, pin/mute choices, and settings, but hides diagnostic and authoring surfaces.
