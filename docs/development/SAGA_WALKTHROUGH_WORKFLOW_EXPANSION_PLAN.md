# Saga Walkthrough Workflow Expansion Plan

This plan expands the in-app **Basic Walkthrough** and **Advanced Walkthrough** for Alpha. It replaces fixed guide-size targets with workflow coverage targets: each guide should teach the user how to operate Saga at the right depth for the selected experience mode.

## Purpose

The current walkthroughs prove the sectioned guide model, but they are still sized around earlier numeric limits. That is the wrong constraint for Alpha. The new constraint is:

```text
The walkthrough is done when the user can complete the workflow it claims to teach.
```

Basic should teach the routine roleplay loop. Advanced should teach the full operator, diagnostic, and authoring surface.

## Design Rules

- Keep the visible guide titles **Basic Walkthrough** and **Advanced Walkthrough**.
- Keep tab-section mini walkthroughs; do not show one long visible list of every "Show" target.
- Let users run the full walkthrough or start a focused module.
- Do not cap either guide by step count.
- Every step should have a clear target, expected result, and "when to use this" note.
- Steps that require fullscreen overlays should declare a preparation action, such as opening the Loredeck Library or Creator workbench.
- Basic steps must only target Basic-visible tabs and Basic-visible controls.
- Basic keeps **Import Deck** visible.
- Basic hides **Create Deck** and **In-Progress Creator Projects**.
- Advanced includes Creator, Continuity, Injection, Pack Health, package management, diagnostics, and repair workflows.
- Public Lorepack terminology should stay limited to **Bundled Lorepack**, **Generated Lorepack**, and **Custom Lorepack**. Use **Pack Health** for validation/readiness framing.

## Guide Data Requirements

The current `guideStep()` shape can support the next pass, but overlay workflows need richer metadata.

Recommended guide step shape:

```js
{
    id,
    title,
    body,
    mode,
    tab,
    section,
    target,
    fallbackTarget,
    prepare,
    close,
    expandSections,
    expected,
    when,
}
```

Recommended preparation actions:

| Prepare action | Purpose |
| --- | --- |
| `openLoredeckLibrary` | Open the fullscreen Loredeck Library before targeting Library internals. |
| `openLoredeckDetails` | Select a Library pack and open its details panel. |
| `openContextBrowser` | Open Context Browser before targeting timeline/anchor choices. |
| `openPendingLoreReview` | Bring the Pending Lorecard Review surface into view. |
| `openAcceptedLoreDetails` | Open an accepted Lorecard detail/editor surface. |
| `openInjectionPreview` | Bring the exact prompt preview into focus. |
| `openContinuityEditor` | Focus the relevant editable continuity block. |
| `openLoredeckCreator` | Open the staged Loredeck Creator workbench. |
| `openCreatorProject` | Resume an in-progress Creator project. |
| `openDeckHealthCenter` | Open Pack Health diagnostics and repair routing. |
| `openAdvancedSettingsSection` | Focus a provider, theme, or diagnostic settings section. |

If a preparation action cannot find its object, the walkthrough should show a useful empty-state explanation instead of failing silently.

## Basic Walkthrough

Basic teaches this loop:

```text
Session orientation
  -> Load Lorepacks
  -> Set Context
  -> Review Lorecards
  -> Continue roleplay
  -> Update Context and Lorecards when the story changes
```

Basic does not teach Creator, Continuity, Injection tuning, bulk management, package repair, or provider internals. It may point to Advanced when a user asks for those things.

### Basic Module Order

The full Basic Walkthrough should run modules in this order:

1. Session: orient the user and explain readiness.
2. Loredecks: load or import source Lorepacks.
3. Context: set the story position for loaded Lorepacks.
4. Lorecards: review what can affect future responses.
5. Session: confirm readiness and continue roleplay.
6. Settings: fix provider/theme setup only when needed.

The guide card can still render modules by tab. The full walkthrough should stitch them in the dependency order above.

### Basic Ordered Coverage

| Order | Step id | Module | Covers |
| --- | --- | --- | --- |
| B01 | `basic-session-orientation` | Session | What Basic Experience is for and how the Start Checklist owns readiness. |
| B02 | `basic-session-saga-active` | Session | Confirm **Saga Active** and explain pause versus delete. |
| B03 | `basic-session-start-checklist` | Session | Read the Start Checklist and identify the next missing action. |
| B04 | `basic-session-next-action` | Session | Use the primary recommended action instead of scanning every tab manually. |
| B05 | `basic-loredecks-overview` | Loredecks | Understand that Loredecks are source packs for Context, retrieval, and Lorecards. |
| B06 | `basic-loredecks-open-library` | Loredecks | Open **Loredeck Library** from the shared launch card. |
| B07 | `basic-library-layout` | Loredecks | Recognize Library list, details panel, and active stack areas. |
| B08 | `basic-library-pack-types` | Loredecks | Distinguish **Bundled Lorepack**, **Generated Lorepack**, and **Custom Lorepack**. |
| B09 | `basic-library-search-filter` | Loredecks | Find the right Lorepack through search, filters, or folder navigation. |
| B10 | `basic-library-pack-details` | Loredecks | Select a Lorepack and read summary, type, source, counts, and basic metadata. |
| B11 | `basic-library-pack-health` | Loredecks | Read **Pack Health** as advisory readiness, warnings, or errors. |
| B12 | `basic-loredecks-import` | Loredecks | Use **Import Deck** when a `.saga-loredeck.zip` package is not already in the Library. |
| B13 | `basic-library-import-preview` | Loredecks | Understand that imported packages are previewed before install. |
| B14 | `basic-library-add-deck-stack` | Loredecks | Add a Lorepack to the active stack. |
| B15 | `basic-library-add-folder-stack` | Loredecks | Add a folder group to the active stack when the Library is organized that way. |
| B16 | `basic-library-stack-order` | Loredecks | Order the active stack so the main source sits above supporting packs when needed. |
| B17 | `basic-library-stack-enable` | Loredecks | Enable or disable active stack entries without deleting Library data. |
| B18 | `basic-library-close-confirm` | Loredecks | Close the Library and confirm the Loredecks tab shows active count and Lorecard count. |
| B19 | `basic-context-overview` | Context | Understand Context as the current story position for each loaded Lorepack. |
| B20 | `basic-context-loaded-rows` | Context | Read loaded Loredeck Context rows and identify unset, detected, manual, or locked states. |
| B21 | `basic-context-browse` | Context | Open **Browse Context** as the trusted manual path. |
| B22 | `basic-context-select-position` | Context | Pick the correct arc, chapter, date, episode, quest, or event. |
| B23 | `basic-context-manual-protects` | Context | Understand that manual Context should be protected from accidental overwrite. |
| B24 | `basic-context-detect` | Context | Use **Detect Context** after a scene jump, time skip, or location/story change. |
| B25 | `basic-context-proposals` | Context | Review uncertain Context output as proposals before relying on it. |
| B26 | `basic-context-update-loop` | Context | Return here whenever the story crosses a meaningful boundary. |
| B27 | `basic-lorecards-overview` | Lorecards | Understand Lorecards as reviewed facts that can affect future responses. |
| B28 | `basic-lorecards-generation-section` | Lorecards | Find Lorecard Generation and understand that generated items go to review. |
| B29 | `basic-lorecards-preview-canon` | Lorecards | Use **Preview Canon Packs** for local Context-aware suggestions from loaded Lorepacks. |
| B30 | `basic-lorecards-send-canon-review` | Lorecards | Send useful canon suggestions to Pending Lorecard Review. |
| B31 | `basic-lorecards-scan-story` | Lorecards | Use **Scan Story Lore** for durable chat facts when a provider is ready. |
| B32 | `basic-lorecards-manual-add` | Lorecards | Add a known important fact manually. |
| B33 | `basic-lorecards-pending-review` | Lorecards | Read Pending Lorecard Review as the gate before lore can affect prompts. |
| B34 | `basic-lorecards-edit-pending` | Lorecards | Edit a proposed fact before accepting it. |
| B35 | `basic-lorecards-accept-dismiss` | Lorecards | Accept useful durable facts and dismiss recap, noise, or wrong canon. |
| B36 | `basic-lorecards-review-question` | Lorecards | Apply the core question: "Should this fact affect future responses?" |
| B37 | `basic-lorecards-accepted-list` | Lorecards | Inspect Accepted Lorecards as durable memory. |
| B38 | `basic-lorecards-open-accepted` | Lorecards | Open an accepted Lorecard to verify or correct its details. |
| B39 | `basic-lorecards-pin-mute` | Lorecards | Use pin and mute as simple prominence/suppression controls. |
| B40 | `basic-lorecards-search-cleanup` | Lorecards | Search accepted Lorecards and clean up entries that should no longer guide the model. |
| B41 | `basic-session-metrics` | Session | Read metrics for pending, accepted, selected lore, and token estimate. |
| B42 | `basic-session-ready` | Session | Confirm the Start Checklist is ready. |
| B43 | `basic-session-continue-roleplay` | Session | Continue roleplay once lore is loaded, Context is set, and useful Lorecards are accepted. |
| B44 | `basic-session-repeat-loop` | Session | Repeat Context update and Lorecard review after major story movement. |
| B45 | `basic-settings-provider-status` | Settings | Check provider readiness only when model-backed actions fail or are unavailable. |
| B46 | `basic-settings-provider-test` | Settings | Test Utility or Reasoning provider readiness. |
| B47 | `basic-settings-current-model` | Settings | Use the current SillyTavern model when that is the simplest provider path. |
| B48 | `basic-settings-theme-pack` | Settings | Choose a Theme Pack for readability and preference. |
| B49 | `basic-settings-advanced-handoff` | Settings | Switch to Advanced for provider internals, Creator, Continuity, Injection, Pack Health repair, or diagnostics. |

### Basic Required Exclusions

Basic must not include steps for:

- **Create Deck**.
- **In-Progress Creator Projects**.
- Creator workbench stages.
- Continuity tab controls.
- Injection tab controls.
- Advanced Context Brief internals.
- Context resolver audit panels.
- Bulk Lorecard management.
- Raw JSON editing.
- Package repair/update conflict resolution.
- Provider profile internals.

## Advanced Walkthrough

Advanced teaches Saga as a complete operating system:

```text
Manage sources
  -> Resolve Context
  -> Generate and review lore
  -> Inspect and tune injection
  -> Track continuity
  -> Create, repair, import, export, and diagnose Lorepacks
```

Advanced should be module-first. A full walkthrough can run everything in order, but the primary user value is focused task tracks.

### Advanced Module Order

The full Advanced Walkthrough should run modules in this order:

1. Loredeck Library Mastery.
2. Session And Runtime Control.
3. Context Resolution.
4. Lorecard Generation And Review.
5. Injection Diagnostics.
6. Continuity Tracking.
7. Creator And Generated Lorepack Authoring.
8. Pack Health, Repair, Import, Export, And Finalization.
9. Settings, Providers, Themes, And Diagnostics.
10. Troubleshooting Routes.

This order teaches dependencies before diagnostics: source packs first, then Context, then Lorecards, then what Saga sends.

### Advanced Ordered Coverage

| Order | Step id | Module | Covers |
| --- | --- | --- | --- |
| A01 | `advanced-loredecks-overview` | Loredeck Library Mastery | Read Library, active stack, active Lorecard count, and Pack Health summary. |
| A02 | `advanced-loredecks-open-library` | Loredeck Library Mastery | Open the fullscreen Loredeck Library. |
| A03 | `advanced-library-empty-selection` | Loredeck Library Mastery | Understand the explicit empty details state when no deck is selected. |
| A04 | `advanced-library-special-views` | Loredeck Library Mastery | Use All, Bundled, Custom, and Unfiled views. |
| A05 | `advanced-library-folder-tree` | Loredeck Library Mastery | Navigate folders and nested folder groups. |
| A06 | `advanced-library-search-sort` | Loredeck Library Mastery | Search and sort Library records. |
| A07 | `advanced-library-pack-select` | Loredeck Library Mastery | Select a Lorepack and inspect overview details. |
| A08 | `advanced-library-pack-source` | Loredeck Library Mastery | Identify Bundled, Generated, Custom, imported, duplicated, and finalized source states. |
| A09 | `advanced-library-cover-metadata` | Loredeck Library Mastery | Inspect or update cover and metadata surfaces where available. |
| A10 | `advanced-library-health-summary` | Loredeck Library Mastery | Read Pack Health status, issue counts, and last validation time. |
| A11 | `advanced-library-manifest-preview` | Loredeck Library Mastery | Load manifest preview and embedded Lorecard counts. |
| A12 | `advanced-library-entry-overrides` | Loredeck Library Mastery | Open per-entry override/editor surfaces for Custom or Generated packs. |
| A13 | `advanced-library-stack-pane` | Loredeck Library Mastery | Understand the active stack pane as the source of runtime eligibility. |
| A14 | `advanced-library-add-deck-stack` | Loredeck Library Mastery | Add a deck to the active stack. |
| A15 | `advanced-library-add-folder-stack` | Loredeck Library Mastery | Add a folder group to the active stack. |
| A16 | `advanced-library-reorder-stack` | Loredeck Library Mastery | Reorder active stack items. |
| A17 | `advanced-library-enable-stack` | Loredeck Library Mastery | Enable, disable, collapse, or remove stack items without deleting Library records. |
| A18 | `advanced-library-bulk-select` | Loredeck Library Mastery | Select multiple packs for batch actions. |
| A19 | `advanced-library-export-selected` | Loredeck Library Mastery | Export selected packs as `.saga-loredeck.zip`. |
| A20 | `advanced-library-import-package` | Loredeck Library Mastery | Import a `.saga-loredeck.zip` package. |
| A21 | `advanced-library-import-preview` | Loredeck Library Mastery | Review package preview, source type, embedded counts, and install choices. |
| A22 | `advanced-library-duplicate-warnings` | Loredeck Library Mastery | Understand same-hash and possible-duplicate warnings. |
| A23 | `advanced-library-duplicate-custom` | Loredeck Library Mastery | Duplicate an existing Lorepack as Custom. |
| A24 | `advanced-library-folder-actions` | Loredeck Library Mastery | Create, rename, move, and remove Library folders. |
| A25 | `advanced-library-open-workbench` | Loredeck Library Mastery | Launch deeper Loredeck workbench/editor routes. |
| A26 | `advanced-session-experience-mode` | Session And Runtime Control | Switch Basic/Advanced and understand what carries across modes. |
| A27 | `advanced-session-saga-active` | Session And Runtime Control | Toggle Saga Active without deleting data. |
| A28 | `advanced-session-automation-mode` | Session And Runtime Control | Compare Manual, Assisted, and Automatic automation modes. |
| A29 | `advanced-session-runtime-metrics` | Session And Runtime Control | Read pending, accepted, selected, continuity, and prompt-size metrics. |
| A30 | `advanced-session-guide-modules` | Session And Runtime Control | Use the guide card as a module launcher rather than a long checklist. |
| A31 | `advanced-session-active-chat` | Session And Runtime Control | Confirm the active chat/state target. |
| A32 | `advanced-session-cleanup-actions` | Session And Runtime Control | Find cleanup or reset actions and understand their risk. |
| A33 | `advanced-session-mode-recovery` | Session And Runtime Control | Recover when switching modes hides the previous active tab. |
| A34 | `advanced-context-command-center` | Context Resolution | Use Runtime Context command center as the status and action hub. |
| A35 | `advanced-context-loaded-rows` | Context Resolution | Inspect per-Loredeck Context rows, source, lock state, and update state. |
| A36 | `advanced-context-browser-open` | Context Resolution | Open Context Browser. |
| A37 | `advanced-context-manual-select` | Context Resolution | Manually select exact Context for loaded Lorepacks. |
| A38 | `advanced-context-locks` | Context Resolution | Lock or unlock Context rows deliberately. |
| A39 | `advanced-context-detect` | Context Resolution | Run local detection against recent source messages. |
| A40 | `advanced-context-source-window` | Context Resolution | Tune source-message window size. |
| A41 | `advanced-context-local-resolver` | Context Resolution | Use local resolver controls and understand confidence thresholds. |
| A42 | `advanced-context-reasoner` | Context Resolution | Ask Reasoner for proposal-based Context resolution. |
| A43 | `advanced-context-proposal-review` | Context Resolution | Apply or dismiss Context proposals in review. |
| A44 | `advanced-context-audit` | Context Resolution | Read resolver and automation audit summaries. |
| A45 | `advanced-context-advanced-brief` | Context Resolution | Edit or inspect the Advanced Context Brief when branch-specific detail matters. |
| A46 | `advanced-context-seed-from-brief` | Context Resolution | Seed loaded Loredeck rows from the brief when useful. |
| A47 | `advanced-context-reset` | Context Resolution | Reset stale Context safely. |
| A48 | `advanced-context-index-summary` | Context Resolution | Use Context index summaries to understand available anchors. |
| A49 | `advanced-context-workbench-routes` | Context Resolution | Route to timeline, waypoint, alias, and validation workbenches. |
| A50 | `advanced-context-eligibility-debug` | Context Resolution | Explain why Context allows or blocks a Lorecard. |
| A51 | `advanced-lore-generation-overview` | Lorecard Generation And Review | Understand canon preview, story scan, manual add, draft review, pending review, and accepted entries. |
| A52 | `advanced-lore-canon-preview` | Lorecard Generation And Review | Preview local Context-aware suggestions from active Lorepacks. |
| A53 | `advanced-lore-canon-selection` | Lorecard Generation And Review | Select useful canon suggestions for Pending Review. |
| A54 | `advanced-lore-story-scan` | Lorecard Generation And Review | Run model-backed story-lore scan. |
| A55 | `advanced-lore-scan-scope` | Lorecard Generation And Review | Tune scan source scope where controls are available. |
| A56 | `advanced-lore-manual-add` | Lorecard Generation And Review | Add a manual Lorecard. |
| A57 | `advanced-lore-assistant-drafts` | Lorecard Generation And Review | Review assistant/Creator draft batches before they reach Pending Review. |
| A58 | `advanced-lore-pending-review` | Lorecard Generation And Review | Inspect Pending Lorecard Review. |
| A59 | `advanced-lore-pending-edit` | Lorecard Generation And Review | Edit pending entries before acceptance. |
| A60 | `advanced-lore-pending-accept-reject` | Lorecard Generation And Review | Accept, reject, or dismiss entries. |
| A61 | `advanced-lore-pending-bulk` | Lorecard Generation And Review | Use bulk review controls deliberately. |
| A62 | `advanced-lore-accepted-list` | Lorecard Generation And Review | Inspect accepted Lorecards. |
| A63 | `advanced-lore-accepted-search-filter` | Lorecard Generation And Review | Search and filter accepted entries. |
| A64 | `advanced-lore-accepted-open-edit` | Lorecard Generation And Review | Open and edit an accepted Lorecard. |
| A65 | `advanced-lore-pin-mute` | Lorecard Generation And Review | Pin or mute accepted entries. |
| A66 | `advanced-lore-relevance-tier` | Lorecard Generation And Review | Set relevance tier and understand prompt eligibility. |
| A67 | `advanced-lore-tags-context` | Lorecard Generation And Review | Inspect tags, Context metadata, and source metadata. |
| A68 | `advanced-lore-similarity-duplicates` | Lorecard Generation And Review | Understand duplicate and similarity guards. |
| A69 | `advanced-lore-auto-relevance` | Lorecard Generation And Review | Run, apply, or reject Auto-Relevance suggestions. |
| A70 | `advanced-lore-timeline-audit` | Lorecard Generation And Review | Use timeline/audit recovery for deleted or changed lore. |
| A71 | `advanced-lore-workbench` | Lorecard Generation And Review | Open deeper Lorecard workbenches for large-list management. |
| A72 | `advanced-lore-review-first-policy` | Lorecard Generation And Review | Reinforce that model-produced proposals must be reviewed before affecting prompts. |
| A73 | `advanced-injection-overview` | Injection Diagnostics | Understand Injection as the exact prompt/debugging surface. |
| A74 | `advanced-injection-continuity-toggle` | Injection Diagnostics | Toggle Continuity injection. |
| A75 | `advanced-injection-lore-toggle` | Injection Diagnostics | Toggle Lore injection. |
| A76 | `advanced-injection-high-tier` | Injection Diagnostics | Inspect High relevance behavior. |
| A77 | `advanced-injection-normal-tier` | Injection Diagnostics | Inspect Normal relevance behavior. |
| A78 | `advanced-injection-low-tier` | Injection Diagnostics | Inspect Low relevance behavior. |
| A79 | `advanced-injection-direct-compressed` | Injection Diagnostics | Tune direct versus compressed handling. |
| A80 | `advanced-injection-placement` | Injection Diagnostics | Tune role, position, depth, and placement. |
| A81 | `advanced-injection-compression-prompts` | Injection Diagnostics | Inspect or edit compression prompts. |
| A82 | `advanced-injection-preview-lore` | Injection Diagnostics | Preview selected Lorecards by tier. |
| A83 | `advanced-injection-preview-continuity` | Injection Diagnostics | Preview selected continuity state. |
| A84 | `advanced-injection-combined-preview` | Injection Diagnostics | Inspect the combined prompt block. |
| A85 | `advanced-injection-token-estimate` | Injection Diagnostics | Read token and character estimates. |
| A86 | `advanced-injection-omission-reasons` | Injection Diagnostics | Diagnose omitted Lorecards: muted, disabled tier, Context blocked, stack disabled, token pressure, or not selected. |
| A87 | `advanced-injection-sync-diagnostics` | Injection Diagnostics | Debug prompt transport and sync behavior. |
| A88 | `advanced-continuity-overview` | Continuity Tracking | Understand continuity as live scene state, distinct from durable Lorecards. |
| A89 | `advanced-continuity-scan` | Continuity Tracking | Run a continuity scan. |
| A90 | `advanced-continuity-automation` | Continuity Tracking | Configure continuity automation cadence. |
| A91 | `advanced-continuity-scope` | Continuity Tracking | Choose recent, custom range, or entire chat scan scope. |
| A92 | `advanced-continuity-custom-range` | Continuity Tracking | Use custom range for a missed section. |
| A93 | `advanced-continuity-performance` | Continuity Tracking | Tune chunking, overlap, concurrency, retries, and checkpoints. |
| A94 | `advanced-continuity-tracked-sections` | Continuity Tracking | Choose tracked sections. |
| A95 | `advanced-continuity-scene-state` | Continuity Tracking | Edit scene and timeline state. |
| A96 | `advanced-continuity-active-characters` | Continuity Tracking | Edit active characters. |
| A97 | `advanced-continuity-items` | Continuity Tracking | Edit key items. |
| A98 | `advanced-continuity-goals-threads` | Continuity Tracking | Edit goals, threads, and objectives. |
| A99 | `advanced-continuity-emotional-freshness` | Continuity Tracking | Inspect or edit emotional freshness where available. |
| A100 | `advanced-continuity-injection-link` | Continuity Tracking | Understand how continuity state reaches Injection. |
| A101 | `advanced-continuity-recovery` | Continuity Tracking | Recover from interrupted or failed long scans. |
| A102 | `advanced-creator-create-deck` | Creator And Generated Lorepack Authoring | Launch **Create Deck**. |
| A103 | `advanced-creator-intake` | Creator And Generated Lorepack Authoring | Enter fandom, scope, granularity, and notes. |
| A104 | `advanced-creator-brief` | Creator And Generated Lorepack Authoring | Generate and approve the scope brief. |
| A105 | `advanced-creator-outline` | Creator And Generated Lorepack Authoring | Generate and approve the outline. |
| A106 | `advanced-creator-title-pass` | Creator And Generated Lorepack Authoring | Generate title batches. |
| A107 | `advanced-creator-title-review` | Creator And Generated Lorepack Authoring | Accept, revise, or reject titles. |
| A108 | `advanced-creator-planning` | Creator And Generated Lorepack Authoring | Generate Context and tag planning proposals. |
| A109 | `advanced-creator-planning-review` | Creator And Generated Lorepack Authoring | Review Context/tag proposals before downstream drafting. |
| A110 | `advanced-creator-entry-draft` | Creator And Generated Lorepack Authoring | Draft Lorecards in small batches. |
| A111 | `advanced-creator-entry-auto-draft` | Creator And Generated Lorepack Authoring | Use bounded auto-draft controls when appropriate. |
| A112 | `advanced-creator-draft-review` | Creator And Generated Lorepack Authoring | Review Creator Lorecard drafts before Pending Review. |
| A113 | `advanced-creator-send-to-review` | Creator And Generated Lorepack Authoring | Send Creator drafts to Pending Lorecard Review. |
| A114 | `advanced-creator-pending-review-link` | Creator And Generated Lorepack Authoring | Jump from Creator to the relevant review queue. |
| A115 | `advanced-creator-current-task` | Creator And Generated Lorepack Authoring | Retry, retry smaller, or cancel active generation. |
| A116 | `advanced-creator-generation-settings` | Creator And Generated Lorepack Authoring | Tune Creator generation settings per project. |
| A117 | `advanced-creator-project-shelf` | Creator And Generated Lorepack Authoring | Resume in-progress Creator projects. |
| A118 | `advanced-creator-project-manage` | Creator And Generated Lorepack Authoring | Rename, move, select, or delete Creator projects. |
| A119 | `advanced-creator-inspect-generated-pack` | Creator And Generated Lorepack Authoring | Open the linked Generated Lorepack in Library details. |
| A120 | `advanced-creator-readiness-gate` | Creator And Generated Lorepack Authoring | Read Creator readiness, accepted coverage, draft blockers, and export status. |
| A121 | `advanced-health-center-open` | Pack Health, Repair, Import, Export, And Finalization | Open Pack Health Center from Library or details. |
| A122 | `advanced-health-status` | Pack Health, Repair, Import, Export, And Finalization | Read errors, warnings, notices, entry counts, and manifest health. |
| A123 | `advanced-health-issue-groups` | Pack Health, Repair, Import, Export, And Finalization | Inspect grouped health issues. |
| A124 | `advanced-health-safe-repair` | Pack Health, Repair, Import, Export, And Finalization | Run safe repair actions when available. |
| A125 | `advanced-health-manual-repair` | Pack Health, Repair, Import, Export, And Finalization | Route unresolved issues to workbench/manual edits. |
| A126 | `advanced-package-update` | Pack Health, Repair, Import, Export, And Finalization | Update or reinstall packages when available. |
| A127 | `advanced-package-local-mod-warning` | Pack Health, Repair, Import, Export, And Finalization | Understand local modification warnings before overwrite/update. |
| A128 | `advanced-package-export-bundled` | Pack Health, Repair, Import, Export, And Finalization | Export Bundled Lorepack references correctly. |
| A129 | `advanced-package-export-custom` | Pack Health, Repair, Import, Export, And Finalization | Export Custom Lorepacks with embedded data. |
| A130 | `advanced-generated-finalize-custom` | Pack Health, Repair, Import, Export, And Finalization | Finalize a reviewed Generated Lorepack as Custom. |
| A131 | `advanced-generated-export-readiness` | Pack Health, Repair, Import, Export, And Finalization | Interpret generated export readiness without treating it as a hard gate. |
| A132 | `advanced-settings-provider-overview` | Settings, Providers, Themes, And Diagnostics | Understand Utility and Reasoning provider roles. |
| A133 | `advanced-settings-provider-profile` | Settings, Providers, Themes, And Diagnostics | Select or edit provider profiles. |
| A134 | `advanced-settings-endpoint-model` | Settings, Providers, Themes, And Diagnostics | Configure endpoint and model details. |
| A135 | `advanced-settings-provider-test` | Settings, Providers, Themes, And Diagnostics | Test configured providers. |
| A136 | `advanced-settings-current-model` | Settings, Providers, Themes, And Diagnostics | Use current SillyTavern model where appropriate. |
| A137 | `advanced-settings-generation` | Settings, Providers, Themes, And Diagnostics | Tune generation parameters. |
| A138 | `advanced-settings-provider-presets` | Settings, Providers, Themes, And Diagnostics | Use provider preset support. |
| A139 | `advanced-settings-api-compat` | Settings, Providers, Themes, And Diagnostics | Inspect compatibility flags only when diagnosing provider behavior. |
| A140 | `advanced-settings-theme-pack` | Settings, Providers, Themes, And Diagnostics | Choose, import, export, reset, and inspect Theme Packs. |
| A141 | `advanced-settings-icon-set` | Settings, Providers, Themes, And Diagnostics | Choose icon sets. |
| A142 | `advanced-settings-colors` | Settings, Providers, Themes, And Diagnostics | Tune color controls. |
| A143 | `advanced-settings-diagnostics` | Settings, Providers, Themes, And Diagnostics | Use diagnostics or developer status when needed. |
| A144 | `advanced-troubleshoot-no-loredeck` | Troubleshooting Routes | Route empty-stack issues to Loredeck Library. |
| A145 | `advanced-troubleshoot-wrong-context` | Troubleshooting Routes | Route wrong suggestions to Context Browser, locks, proposals, or Advanced Brief. |
| A146 | `advanced-troubleshoot-no-suggestions` | Troubleshooting Routes | Check active stack, Context, provider readiness, and canon/story generation paths. |
| A147 | `advanced-troubleshoot-pending-stuck` | Troubleshooting Routes | Clear draft/pending queues through review, accept, reject, or drop actions. |
| A148 | `advanced-troubleshoot-no-injection` | Troubleshooting Routes | Check Injection toggles, tiers, Context eligibility, stack enabled state, mute, and token pressure. |
| A149 | `advanced-troubleshoot-prompt-heavy` | Troubleshooting Routes | Tune tiers, compression, low relevance, continuity, and prompt placement. |
| A150 | `advanced-troubleshoot-provider-failure` | Troubleshooting Routes | Route provider failures to Settings and request/audit surfaces. |
| A151 | `advanced-troubleshoot-continuity-stale` | Troubleshooting Routes | Re-scan, adjust scope, inspect tracked sections, or recover interrupted scans. |
| A152 | `advanced-troubleshoot-package-duplicate` | Troubleshooting Routes | Resolve duplicate package import warnings. |
| A153 | `advanced-troubleshoot-health-warnings` | Troubleshooting Routes | Route Pack Health warnings to repair or manual edit paths. |
| A154 | `advanced-troubleshoot-creator-failure` | Troubleshooting Routes | Retry, retry smaller, cancel, or adjust Creator generation settings. |
| A155 | `advanced-troubleshoot-return-basic` | Troubleshooting Routes | Switch back to Basic when routine roleplay no longer needs advanced controls. |

## Section Cards

The guide launcher should show compact module cards. The visible card list should not enumerate every step.

Recommended Basic cards:

| Card | Starts at | Summary |
| --- | --- | --- |
| First Run | B01 | Get oriented, read readiness, and use the next action. |
| Loredecks | B05 | Load, import, inspect, and stack Lorepacks. |
| Context | B19 | Set story position and keep it current. |
| Lorecards | B27 | Generate, review, accept, and clean up durable facts. |
| Continue Roleplay | B41 | Confirm readiness and repeat the update loop. |
| Settings | B45 | Fix providers and Theme Pack basics. |

Recommended Advanced cards:

| Card | Starts at | Summary |
| --- | --- | --- |
| Loredeck Library Mastery | A01 | Manage Library, stack, folders, imports, exports, and details. |
| Session And Runtime Control | A26 | Manage mode, automation, active state, metrics, and guide routing. |
| Context Resolution | A34 | Resolve, audit, lock, and debug Story Position. |
| Lorecard Generation And Review | A51 | Generate, review, edit, tier, and audit Lorecards. |
| Injection Diagnostics | A73 | Inspect exactly what Saga sends and why. |
| Continuity Tracking | A88 | Track, tune, edit, and recover live scene state. |
| Creator And Generated Lorepack Authoring | A102 | Create and complete Generated Lorepack projects. |
| Pack Health And Packages | A121 | Validate, repair, update, export, and finalize Lorepacks. |
| Settings And Providers | A132 | Configure providers, Theme Packs, icons, colors, and diagnostics. |
| Troubleshooting Routes | A144 | Route common failures to the right control surface. |

## Implementation Phases

### Phase 1: Replace Count-Based Contracts

- Remove exact Basic and Advanced step-count assertions.
- Replace them with required-step-id coverage assertions.
- Keep checks that Basic never targets hidden tabs.
- Keep checks that all guide targets are marked or have a valid preparation path.

### Phase 2: Add Preparation Actions

- Extend runtime tour start logic to run optional `prepare` before locating a target.
- Add no-op fallback behavior when a preparation action cannot complete.
- Keep each preparation action small and local to an existing surface.

### Phase 3: Expand Basic Steps

- Implement B01-B49 in `runtime-guide-content.js`.
- Add missing tour targets for Library internals and review surfaces.
- Keep Basic excluded controls unaddressable from Basic guide data.

### Phase 4: Expand Advanced Steps

- Implement A01-A155 in module groups.
- Add overlay targets incrementally, starting with Library, Context, Lorecards, and Injection.
- Defer Creator and Pack Health overlay targeting only if the implementation would be too large for one pass, but keep the ordered ids stable.

### Phase 5: Update Guide Card UI

- Keep cards compact.
- Show step count per card if useful, but do not frame counts as limits.
- Show the full walkthrough start plus module starts.
- Do not render one button per target.

### Phase 6: Update User Docs

- Update `docs/user/BASIC_WORKFLOW.md` to match the expanded Basic module order.
- Update `docs/user/ADVANCED_WORKFLOW.md` to present Advanced modules as task tracks.
- Link this plan from `docs/DOCUMENTATION_INDEX.md`.

## Validation Contract

Required static checks:

- Basic guide includes every `Bxx` required id.
- Advanced guide includes every `Axx` required id, or an explicit implementation phase marker for deferred overlay-only ids.
- Basic guide step tabs are all in `BASIC_EXPERIENCE_TABS`.
- Basic guide source does not include Creator, Continuity, or Injection targets.
- Advanced guide includes Loredecks, Session, Context, Continuity, Lorecards, Injection, Settings, Creator, Pack Health, and troubleshooting modules.
- Every guide step has `expected` and `when`.
- Every step target is marked in runtime UI or declares a valid `prepare`.
- Every `prepare` action has a smoke-testable no-object fallback.

Recommended smoke coverage:

- Basic full walkthrough through B01-B49 with seeded HP Core/Year deck data.
- Basic Loredecks module with no stack, then with an imported package fixture.
- Basic Context module with unset Context, manual Context, detected Context, and proposals.
- Basic Lorecards module with pending, accepted, pinned, muted, and empty states.
- Advanced Library module with folders, bulk selection, import preview, export, and stack changes.
- Advanced Context module with local, Reasoner proposal, locks, audit, and Advanced Brief states.
- Advanced Injection module with included and omitted Lorecards.
- Advanced Continuity module with scan results and editable state blocks.
- Advanced Creator module with an in-progress project and generated pack.
- Advanced Pack Health module with safe repair and manual repair examples.

## Done Definition

This feature is done when:

- The Basic Walkthrough teaches the full routine roleplay loop without exposing hidden Basic controls.
- The Advanced Walkthrough is organized as task tracks and covers the full operating surface.
- The guide data is no longer constrained by maximum step counts.
- Users can run a full walkthrough or start a focused module.
- Fullscreen workflows can be prepared and targeted reliably.
- Static tests assert coverage by required ids and visible controls, not arbitrary guide size.
