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
- Keep focused module walkthroughs; do not show one long visible list of every "Show" target.
- Let users run the full walkthrough or start a focused module.
- Do not cap either guide by step count.
- Every step should have a clear target, expected result, and "when to use this" note.
- Steps that require fullscreen overlays should declare a preparation action, such as opening the Loredeck Library or Deck Maker workbench.
- Basic steps must only target Basic-visible tabs and Basic-visible controls.
- Basic keeps **Import Deck** visible.
- Basic hides **Create Deck** and **In-Progress Deck Maker Projects**.
- Advanced includes Deck Maker, Continuity, Injection, Pack Health, package management, diagnostics, and repair workflows.
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
| `openContextBrowser` | Open Context Workbench before targeting timeline, story-position, anchor, resolver, and validation choices. |
| `openPendingLoreReview` | Bring the Pending Lorecard Review surface into view. |
| `openAcceptedLoreDetails` | Open an accepted Lorecard detail/editor surface. |
| `openInjectionPreview` | Bring the exact prompt preview into focus. |
| `openContinuityEditor` | Focus the relevant editable continuity block. |
| `openLoredeckCreator` | Open the staged Deck Maker workbench. |
| `openCreatorProject` | Resume an in-progress Deck Maker project. |
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

Basic does not teach Deck Maker, Continuity, Injection tuning, bulk management, package repair, or provider internals. It may point to Advanced when a user asks for those things.

### Basic Module Order

The full Basic Walkthrough should run modules in this order:

1. Session: orient the user and explain readiness.
2. Loredecks: load or import source Lorepacks.
3. Context: set the story position for loaded Lorepacks.
4. Lorecards: review what can affect future responses.
5. Session: confirm readiness and continue roleplay.
6. Settings: fix provider/theme setup only when needed.

The guide card should render these as workflow modules, while each module still points users at the relevant Basic tab. The full walkthrough should stitch them in the dependency order above.

### Basic Ordered Coverage

| Order | Step id | Module | Covers |
| --- | --- | --- | --- |
| B01 | `basic-session-orientation` | First Run | Basic mode is the focused setup and play loop: load Lorepacks, set Context, review useful Lorecards, then continue roleplay. |
| B02 | `basic-session-saga-active` | First Run | Saga Active pauses or resumes Saga behavior without deleting saved data. |
| B03 | `basic-session-start-checklist` | First Run | The Start Checklist turns the Basic workflow into one next action at a time. |
| B04 | `basic-session-next-action` | First Run | The checklist action button sends you to the right tab instead of making you inspect every control manually. |
| B05 | `basic-loredecks-overview` | Loredecks | Loredecks are source packs for Context, canon suggestions, retrieval, and accepted Lorecards. |
| B06 | `basic-loredecks-open-library` | Loredecks | Open the fullscreen Library to choose a Bundled Lorepack, Generated Lorepack, or Custom Lorepack. |
| B07 | `basic-library-layout` | Loredecks | The Library is split into the available Lorepack list, the add/remove controls, the active stack, and the selected pack details panel. |
| B08 | `basic-library-pack-types` | Loredecks | Bundled Lorepacks ship with Saga, Generated Lorepacks come from the Deck Maker workflow, and Custom Lorepacks are user-owned imports or editable copies. |
| B09 | `basic-library-search-filter` | Loredecks | Use Library search, special views, sorting, and folders to find the right Lorepack quickly. |
| B10 | `basic-library-pack-details` | Loredecks | Select a Lorepack to read its summary, type, source, Lorecard count, and basic metadata. |
| B11 | `basic-library-pack-health` | Loredecks | Pack Health is advisory readiness for the selected Lorepack or active stack, including warnings and errors that may affect reliability. |
| B12 | `basic-loredecks-import` | Loredecks | Import Deck installs a Saga Loredeck zip package into the Library. |
| B13 | `basic-library-import-preview` | Loredecks | Imported packages are previewed before install so you can confirm the package before it enters the Library. |
| B14 | `basic-library-add-deck-stack` | Loredecks | Add the selected Lorepack to the active stack so it can participate in Context, canon suggestions, retrieval, and Lorecards. |
| B15 | `basic-library-add-folder-stack` | Loredecks | If the Library is organized into folders, a folder group can load several related Lorepacks together. |
| B16 | `basic-library-stack-order` | Loredecks | The active stack is top-to-bottom priority; place the main source above supporting packs when order matters. |
| B17 | `basic-library-stack-enable` | Loredecks | Disable an active stack entry to pause it without deleting the Lorepack from the Library. |
| B18 | `basic-library-close-confirm` | Loredecks | Use Done to close the Library, then confirm the Loredecks tab shows the active count and active Lorecard count you expect. |
| B19 | `basic-context-overview` | Context | Context is the current story position for each loaded Lorepack. |
| B20 | `basic-context-loaded-rows` | Context | Each enabled Loredeck has a Context row showing whether its story position is unset, detected, manually selected, or locked. |
| B21 | `basic-context-browse` | Context | Browse Context is the trusted manual path for choosing the exact story position. |
| B22 | `basic-context-workbench-loredeck` | Context | In the Context Workbench, choose which loaded Lorepack you are setting before applying a story position. |
| B23 | `basic-context-anchors-windows` | Context | Anchors are exact story points. Windows are ranges between story points. Choose Story Position shows both so you can pick the right shape. |
| B24 | `basic-context-start-window` | Context | Use Start Here when the chat begins at one Anchor. Use Window when a listed Window already matches the whole active story range. |
| B25 | `basic-context-use-anchor` | Context | Search Choose Story Position and press Start Here to apply one exact Anchor. It is the precise-point version of Use Window. |
| B26 | `basic-context-after-before` | Context | Use After on the lower bound and Before on the upper bound to build a custom Window. Use Timeline when you need to inspect the source row. |
| B27 | `basic-context-phrase-resolver` | Context | Phrase Resolver tests loose story phrases against known timeline labels, aliases, dates, tags, and coordinates without calling a model. |
| B28 | `basic-context-select-position` | Context | Confirm the correct arc, chapter, date, episode, quest, event, Anchor, or Window for the loaded Lorepack. |
| B29 | `basic-context-manual-protects` | Context | Manual Context choices should be protected from accidental overwrite when they are more trustworthy than detection. |
| B30 | `basic-context-detect` | Context | Detect Context analyzes recent messages and updates unlocked loaded Loredeck Context rows. |
| B31 | `basic-context-proposals` | Context | Uncertain Context output should be reviewed as a proposal before you rely on it. |
| B32 | `basic-context-update-loop` | Context | Return to Context whenever the story crosses a meaningful boundary. |
| B33 | `basic-lorecards-overview` | Lorecards | Lorecards are reviewed facts that can affect future responses after they are accepted. |
| B34 | `basic-lorecards-generation-section` | Lorecards | The generation section gathers canon pack preview, story-lore scan, and manual Lorecard creation. |
| B35 | `basic-lorecards-preview-canon` | Lorecards | Preview Canon Packs queries local Loredeck data for Context-aware canon suggestions without a provider call. |
| B36 | `basic-lorecards-send-canon-review` | Lorecards | Selected canon suggestions go to Pending Lorecard Review instead of becoming accepted memory automatically. |
| B37 | `basic-lorecards-story-scan` | Lorecards | Scan Story Lore asks the configured provider to extract durable story-specific facts from recent chat. |
| B38 | `basic-lorecards-manual-add` | Lorecards | Manual Lorecards let you draft a known fact directly, then review it like generated entries. |
| B39 | `basic-lorecards-pending-review` | Lorecards | Pending Review is the gate between suggested facts and accepted memory. |
| B40 | `basic-lorecards-edit-pending` | Lorecards | Open or edit a pending proposal before accepting it so the durable fact is precise. |
| B41 | `basic-lorecards-accept-dismiss` | Lorecards | Accept useful durable facts and dismiss recap, noise, wrong canon, or facts that should stay transient. |
| B42 | `basic-lorecards-review-question` | Lorecards | Ask: should this fact affect future responses? |
| B43 | `basic-lorecards-accepted-list` | Lorecards | Accepted Lorecards are the durable facts Saga can select for future responses. |
| B44 | `basic-lorecards-open-accepted` | Lorecards | Open an accepted Lorecard to verify or correct its details. |
| B45 | `basic-lorecards-pin-mute` | Lorecards | Pin important accepted Lorecards for prominence or mute entries that should stay saved but not guide responses. |
| B46 | `basic-lorecards-search-cleanup` | Lorecards | Search accepted Lorecards and clean up entries that should no longer guide the model. |
| B47 | `basic-session-metrics` | Continue Roleplay | Metrics show whether Saga has pending Lorecards, accepted lore, selected injection, and a token estimate. |
| B48 | `basic-session-ready` | Continue Roleplay | The Start Checklist is ready when the active stack, Context, review state, and Saga Active status are in place. |
| B49 | `basic-session-continue-roleplay` | Continue Roleplay | Once lore is loaded, Context is set, and useful Lorecards are accepted, continue roleplay normally. |
| B50 | `basic-session-repeat-loop` | Continue Roleplay | After major story movement, update Context and review new Lorecards before continuing again. |
| B51 | `basic-settings-provider-status` | Settings | Provider setup is only needed for model-backed actions like story-lore scans and Context detection fallback. |
| B52 | `basic-settings-provider-test` | Settings | Use provider tests to confirm Utility or Reasoning routes are available before relying on model-backed features. |
| B53 | `basic-settings-current-model` | Settings | For the simplest Basic setup, use the current SillyTavern model when that route is available and sufficient. |
| B54 | `basic-settings-theme-pack` | Settings | Theme Pack controls the runtime shelf appearance, icons, and colors. |
| B55 | `basic-settings-advanced-handoff` | Settings | Switch to Advanced for provider internals, Deck Maker, Continuity, Injection, Pack Health repair, or diagnostics. |

### Basic Required Exclusions

Basic must not include steps for:

- **Create Deck**.
- **In-Progress Deck Maker Projects**.
- Deck Maker workbench stages.
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
7. Deck Maker And Generated Lorepack Authoring.
8. Pack Health, Repair, Import, Export, And Finalization.
9. Settings, Providers, Themes, And Diagnostics.
10. Troubleshooting Routes.

This order teaches dependencies before diagnostics: source packs first, then Context, then Lorecards, then what Saga sends.

### Advanced Ordered Coverage

| Order | Step id | Module | Covers |
| --- | --- | --- | --- |
| A01 | `advanced-loredecks-overview` | Loredeck Library Mastery | Read Library size, active stack count, active Lorecard count, and Pack Health summary. |
| A02 | `advanced-loredecks-open-library` | Loredeck Library Mastery | Open the fullscreen Library where stack, folders, package management, and details live. |
| A03 | `advanced-library-empty-selection` | Loredeck Library Mastery | The Library intentionally starts with no selected deck so details only appear after an explicit choice. |
| A04 | `advanced-library-special-views` | Loredeck Library Mastery | Use All, Bundled, Custom, active, and Unfiled views to inspect Library records without reorganizing folders. |
| A05 | `advanced-library-folder-tree` | Loredeck Library Mastery | Navigate folders and nested folder groups to understand curated pack organization. |
| A06 | `advanced-library-search-sort` | Loredeck Library Mastery | Search by title, tag, fandom, source, or manifest data and sort the visible Library list. |
| A07 | `advanced-library-pack-select` | Loredeck Library Mastery | Select a Lorepack and inspect its overview details before changing the stack. |
| A08 | `advanced-library-pack-source` | Loredeck Library Mastery | Identify Bundled Lorepack, Generated Lorepack, Custom Lorepack, imported, duplicated, and finalized source states. |
| A09 | `advanced-library-cover-metadata` | Loredeck Library Mastery | Inspect or update cover and metadata surfaces where the selected pack is editable. |
| A10 | `advanced-library-health-summary` | Loredeck Library Mastery | Read status, issue counts, and last validation time from the selected pack details. |
| A11 | `advanced-library-manifest-preview` | Loredeck Library Mastery | Load manifest preview and embedded Lorecard counts before export, repair, or deeper edits. |
| A12 | `advanced-library-entry-overrides` | Loredeck Library Mastery | Open per-entry override or editor surfaces for Custom or Generated packs when available. |
| A13 | `advanced-library-stack-pane` | Loredeck Library Mastery | Use the active stack pane as the source of runtime source eligibility. |
| A14 | `advanced-library-add-deck-stack` | Loredeck Library Mastery | Add a selected deck to the active stack so it participates in Context, retrieval, and canon suggestions. |
| A15 | `advanced-library-add-folder-stack` | Loredeck Library Mastery | Add a folder group when a curated folder represents the intended source set. |
| A16 | `advanced-library-reorder-stack` | Loredeck Library Mastery | Reorder stack items so priority and duplicate suppression follow the intended source hierarchy. |
| A17 | `advanced-library-enable-stack` | Loredeck Library Mastery | Enable, disable, collapse, or remove stack items without deleting Library records. |
| A18 | `advanced-library-bulk-select` | Loredeck Library Mastery | Select multiple packs for batch export, duplicate, delete, stack, or folder operations. |
| A19 | `advanced-library-export-selected` | Loredeck Library Mastery | Export selected packs as one .saga-loredeck.zip package. |
| A20 | `advanced-library-import-package` | Loredeck Library Mastery | Import a .saga-loredeck.zip package into the Library. |
| A21 | `advanced-library-import-preview` | Loredeck Library Mastery | Review package preview, source type, embedded counts, and install choices before accepting an import. |
| A22 | `advanced-library-duplicate-warnings` | Loredeck Library Mastery | Understand same-hash and possible-duplicate warnings before installing or updating a package. |
| A23 | `advanced-library-duplicate-custom` | Loredeck Library Mastery | Duplicate an existing Lorepack as a Custom Lorepack before making user-owned edits. |
| A24 | `advanced-library-folder-actions` | Loredeck Library Mastery | Create, rename, move, and remove Library folders without changing pack contents accidentally. |
| A25 | `advanced-library-open-workbench` | Loredeck Library Mastery | Launch deeper Loredeck workbench or editor routes from selected Library records. |
| A26 | `advanced-session-experience-mode` | Session And Runtime Control | Switch Basic and Advanced while keeping saved story state and understanding which controls are hidden. |
| A27 | `advanced-session-saga-active` | Session And Runtime Control | Toggle Saga Active without deleting data or changing saved Lorecards. |
| A28 | `advanced-session-automation-mode` | Session And Runtime Control | Compare Manual, Assisted, and Automatic automation modes before enabling background behavior. |
| A29 | `advanced-session-runtime-metrics` | Session And Runtime Control | Read pending, accepted, selected, continuity, and prompt-size metrics. |
| A30 | `advanced-session-guide-modules` | Session And Runtime Control | Use the guide card as a module launcher instead of treating Advanced as one long checklist. |
| A31 | `advanced-session-active-chat` | Session And Runtime Control | Confirm which chat state Saga is currently reading and updating. |
| A32 | `advanced-settings-danger-zone` | Settings And Providers | Find Active Chat and Global cleanup actions in Settings Danger Zone and understand their risk before using them. |
| A33 | `advanced-session-mode-recovery` | Session And Runtime Control | Recover when switching modes hides the previously active tab or control. |
| A34 | `advanced-context-command-center` | Context Resolution | Use Runtime Context as the status and action hub for story position. |
| A35 | `advanced-context-loaded-rows` | Context Resolution | Inspect per-Loredeck Context rows, source, lock state, and update state. |
| A36 | `advanced-context-browser-open` | Context Resolution | Open the Context Workbench for manual timeline, story-position, alias, resolver, and validation workflows. |
| A37 | `advanced-context-workbench-layout` | Context Resolution | Read the Workbench as one selected loaded Lorepack, one current Context editor, Choose Story Position, Phrase Resolver, and full timeline inspection. |
| A38 | `advanced-context-workbench-pack` | Context Resolution | Use the loaded-Lorepack rows or selector to choose which pack receives the next Context change. |
| A39 | `advanced-context-anchors-windows` | Context Resolution | Anchors are exact timeline points. Windows are bounded ranges. Context eligibility changes depending on whether the current row is a point or a range. |
| A40 | `advanced-context-start-here` | Context Resolution | Start Here applies one story position as the exact current starting Anchor and clears the need for a range. |
| A41 | `advanced-context-use-window` | Context Resolution | Use Window applies a first-class Window from the Lorepack timeline when the registry already has the correct lower and upper bounds. |
| A42 | `advanced-context-use-anchor` | Context Resolution | Search Choose Story Position and press Start Here to apply an exact Anchor as the current Context. |
| A43 | `advanced-context-after-before` | Context Resolution | After sets the lower bound and Before sets the upper bound for a custom Window when no existing Window is precise enough. |
| A44 | `advanced-context-timeline-action` | Context Resolution | Timeline opens the selected story position in the Timeline tab so you can inspect IDs, coordinates, aliases, attached Lorecards, and registry state. |
| A45 | `advanced-context-manual-select` | Context Resolution | Manually select exact or ranged Context for loaded Lorepacks when detection is not authoritative. |
| A46 | `advanced-context-phrase-resolver` | Context Resolution | Phrase Resolver tests casual story phrasing against local Anchor labels, IDs, aliases, dates, arcs, tags, coordinates, and optional Lorecard-derived candidates. |
| A47 | `advanced-context-phrase-debug` | Context Resolution | Review cleaned terms, ignored direction words, match reasons, weak matches, missing terms, and Load Lorecards before applying a phrase result. |
| A48 | `advanced-context-locks` | Context Resolution | Lock or unlock Context rows deliberately so detection does not overwrite trusted manual choices. |
| A49 | `advanced-context-detect` | Context Resolution | Run local detection against recent source messages. |
| A50 | `advanced-context-source-window` | Context Resolution | Tune the number of recent messages used by Context detection and Reasoner fallback. |
| A51 | `advanced-context-local-resolver` | Context Resolution | Use local resolver controls and understand confidence thresholds. |
| A52 | `advanced-context-reasoner` | Context Resolution | Ask the Reasoning provider for proposal-based Context resolution when local anchors are ambiguous. |
| A53 | `advanced-context-proposal-review` | Context Resolution | Apply or dismiss Context proposals before relying on them. |
| A54 | `advanced-context-audit` | Context Resolution | Read resolver and automation audit summaries to understand why Context changed. |
| A55 | `advanced-context-advanced-brief` | Context Resolution | Inspect or edit the Advanced Context Brief for branch-specific story detail. |
| A56 | `advanced-context-seed-from-brief` | Context Resolution | Seed loaded Loredeck rows from the brief when that is the fastest accurate starting point. |
| A57 | `advanced-context-reset` | Context Resolution | Reset stale Context safely when the story position is wrong or no longer applicable. |
| A58 | `advanced-context-index-summary` | Context Resolution | Use Context index summaries to understand which anchors and windows are available. |
| A59 | `advanced-context-workbench-routes` | Context Resolution | Route to timeline, story-position, alias, and validation workbenches for deeper source maintenance. |
| A60 | `advanced-context-eligibility-debug` | Context Resolution | Explain why Context allows or blocks a Lorecard. |
| A61 | `advanced-lore-generation-overview` | Lorecard Generation And Review | Understand canon preview, story scan, manual add, draft review, pending review, and accepted entries. |
| A62 | `advanced-lore-canon-preview` | Lorecard Generation And Review | Preview local Context-aware suggestions from active Lorepacks. |
| A63 | `advanced-lore-canon-selection` | Lorecard Generation And Review | Select useful canon suggestions for Pending Review rather than accepting them automatically. |
| A64 | `advanced-lore-story-scan` | Lorecard Generation And Review | Run model-backed story-lore scan for durable chat facts. |
| A65 | `advanced-lore-scan-scope` | Lorecard Generation And Review | Tune scan source scope where recent, range, and entire-chat controls are available. |
| A66 | `advanced-lore-manual-add` | Lorecard Generation And Review | Add a known important fact manually and route it through review. |
| A67 | `advanced-lore-assistant-drafts` | Lorecard Generation And Review | Review assistant or Deck Maker draft batches before they reach Pending Review. |
| A68 | `advanced-lore-pending-review` | Lorecard Generation And Review | Inspect Pending Lorecard Review as the gate before proposals affect prompts. |
| A69 | `advanced-lore-pending-edit` | Lorecard Generation And Review | Edit pending entries before acceptance so durable memory is precise. |
| A70 | `advanced-lore-pending-accept-reject` | Lorecard Generation And Review | Accept, reject, or dismiss entries based on future usefulness. |
| A71 | `advanced-lore-pending-bulk` | Lorecard Generation And Review | Use bulk review controls deliberately when many pending entries share the same decision. |
| A72 | `advanced-lore-accepted-list` | Lorecard Generation And Review | Inspect accepted Lorecards as durable memory. |
| A73 | `advanced-lore-accepted-search-filter` | Lorecard Generation And Review | Search and filter accepted entries by text, status, category, relevance, or suppression state. |
| A74 | `advanced-lore-accepted-open-edit` | Lorecard Generation And Review | Open and edit an accepted Lorecard when stored memory needs correction. |
| A75 | `advanced-lore-pin-mute` | Lorecard Generation And Review | Pin or mute accepted entries to control prominence and suppression without deleting them. |
| A76 | `advanced-lore-relevance-tier` | Lorecard Generation And Review | Set relevance tier and understand prompt eligibility for High, Normal, and Low lore. |
| A77 | `advanced-lore-tags-context` | Lorecard Generation And Review | Inspect tags, Context metadata, source metadata, and routing hints on accepted entries. |
| A78 | `advanced-lore-similarity-duplicates` | Lorecard Generation And Review | Understand duplicate and similarity guards before accepting overlapping lore. |
| A79 | `advanced-lore-auto-relevance` | Lorecard Generation And Review | Choose Lore Automation mode and review suggestions for large accepted-lore collections. |
| A80 | `advanced-lore-timeline-audit` | Lorecard Generation And Review | Use timeline and audit recovery for deleted, restored, pinned, muted, or changed lore. |
| A81 | `advanced-lore-workbench` | Lorecard Generation And Review | Open deeper Lorecard workbenches for large-list management and detailed editing. |
| A82 | `advanced-lore-review-first-policy` | Lorecard Generation And Review | Model-produced proposals must be reviewed before they can affect future responses. |
| A83 | `advanced-injection-overview` | Injection Diagnostics | Injection is the exact prompt and debugging surface for what Saga sends. |
| A84 | `advanced-injection-continuity-toggle` | Injection Diagnostics | Toggle Continuity injection independently from Lore injection. |
| A85 | `advanced-injection-lore-toggle` | Injection Diagnostics | Toggle Lore injection independently from Continuity injection. |
| A86 | `advanced-injection-high-tier` | Injection Diagnostics | Inspect High relevance behavior for immediate scene-critical facts. |
| A87 | `advanced-injection-normal-tier` | Injection Diagnostics | Inspect Normal relevance behavior for broader but still useful facts. |
| A88 | `advanced-injection-low-tier` | Injection Diagnostics | Inspect Low relevance behavior for distant or optional background facts. |
| A89 | `advanced-injection-direct-compressed` | Injection Diagnostics | Tune direct versus compressed handling for continuity and lore tiers. |
| A90 | `advanced-injection-placement` | Injection Diagnostics | Tune role, position, depth, and placement for injected prompt groups. |
| A91 | `advanced-injection-compression-prompts` | Injection Diagnostics | Inspect or edit compression prompts used for model-compressed blocks. |
| A92 | `advanced-injection-preview-lore` | Injection Diagnostics | Preview selected Lorecards by relevance tier before the next prompt. |
| A93 | `advanced-injection-preview-continuity` | Injection Diagnostics | Preview selected continuity state before the next prompt. |
| A94 | `advanced-injection-combined-preview` | Injection Diagnostics | Inspect the combined prompt block by reading the active continuity and lore previews together. |
| A95 | `advanced-injection-token-estimate` | Injection Diagnostics | Read token and character estimates to understand prompt pressure. |
| A96 | `advanced-injection-omission-reasons` | Injection Diagnostics | Diagnose omitted Lorecards: muted, disabled tier, Context blocked, stack disabled, token pressure, or not selected. |
| A97 | `advanced-injection-sync-diagnostics` | Injection Diagnostics | Debug prompt transport and sync behavior from the injection surface. |
| A98 | `advanced-continuity-overview` | Continuity Tracking | Continuity is live scene state, distinct from durable accepted Lorecards. |
| A99 | `advanced-continuity-scan` | Continuity Tracking | Run a continuity scan to update the current scene state. |
| A100 | `advanced-continuity-automation` | Continuity Tracking | Configure continuity automation cadence and understand when scans run. |
| A101 | `advanced-continuity-scope` | Continuity Tracking | Choose recent, custom range, or entire-chat continuity scan scope. |
| A102 | `advanced-continuity-custom-range` | Continuity Tracking | Use custom range for a missed section instead of rescanning the entire chat. |
| A103 | `advanced-continuity-performance` | Continuity Tracking | Tune chunking, overlap, concurrency, retries, and checkpoints. |
| A104 | `advanced-continuity-tracked-sections` | Continuity Tracking | Choose which live-state sections are scanned and injected. |
| A105 | `advanced-continuity-scene-state` | Continuity Tracking | Edit scene and timeline state for the immediate prompt context. |
| A106 | `advanced-continuity-active-characters` | Continuity Tracking | Edit active characters, current state, appearance, emotion, and immediate goals. |
| A107 | `advanced-continuity-items` | Continuity Tracking | Edit key items, owners, locations, and object status. |
| A108 | `advanced-continuity-goals-threads` | Continuity Tracking | Edit active goals, threads, and immediate objectives. |
| A109 | `advanced-continuity-emotional-freshness` | Continuity Tracking | Inspect or edit emotional freshness where available. |
| A110 | `advanced-continuity-injection-link` | Continuity Tracking | Understand how continuity state reaches the Injection tab and prompt preview. |
| A111 | `advanced-continuity-recovery` | Continuity Tracking | Recover from interrupted or failed long scans by adjusting scope, performance, or retry path. |
| A112 | `advanced-creator-create-deck` | Deck Maker And Generated Lorepack Authoring | Launch Create Deck to begin a Generated Lorepack project. |
| A113 | `advanced-creator-intake` | Deck Maker And Generated Lorepack Authoring | Enter fandom, scope, granularity, and notes for the generated project. |
| A114 | `advanced-creator-brief` | Deck Maker And Generated Lorepack Authoring | Generate and approve the scope brief before outline and title work. |
| A115 | `advanced-creator-outline` | Deck Maker And Generated Lorepack Authoring | Generate and approve the outline that drives title batches and planning. |
| A116 | `advanced-creator-title-pass` | Deck Maker And Generated Lorepack Authoring | Use Generate Next Title Batch or Generate Remaining after the Story Outline defines title sets. |
| A117 | `advanced-creator-title-review` | Deck Maker And Generated Lorepack Authoring | Select title rows, then use Approve Selected Titles, Revise Selected Titles, or Drop Selected before planning. |
| A118 | `advanced-creator-planning` | Deck Maker And Generated Lorepack Authoring | Use Plan Context and Tags to draft timeline and tag proposals for the next approved title set. |
| A119 | `advanced-creator-planning-review` | Deck Maker And Generated Lorepack Authoring | Review generated Context and tag proposals in the Deck Maker review queue before they shape Lorecard drafting. |
| A120 | `advanced-creator-entry-draft` | Deck Maker And Generated Lorepack Authoring | Use Draft Lorecards for one small resumable batch from approved planning and titles. |
| A121 | `advanced-creator-entry-auto-draft` | Deck Maker And Generated Lorepack Authoring | Use Auto-Draft All only after confirming the exact remaining Lorecard count and provider-call count. |
| A122 | `advanced-creator-draft-review` | Deck Maker And Generated Lorepack Authoring | Review Deck Maker Lorecard drafts in the Draft Review batch before they enter Pending Review. |
| A123 | `advanced-creator-send-to-review` | Deck Maker And Generated Lorepack Authoring | Use Send Selected to Review or Send All to Review when Deck Maker drafts are ready for normal Pending Review. |
| A124 | `advanced-creator-pending-review-link` | Deck Maker And Generated Lorepack Authoring | Jump from Deck Maker to the relevant review queue for generated entries. |
| A125 | `advanced-creator-current-task` | Deck Maker And Generated Lorepack Authoring | Retry, retry smaller, or cancel active generation from the current task card. |
| A126 | `advanced-creator-generation-settings` | Deck Maker And Generated Lorepack Authoring | Tune Deck Maker generation settings per project. |
| A127 | `advanced-creator-project-shelf` | Deck Maker And Generated Lorepack Authoring | Resume in-progress Deck Maker projects from the In-Progress Deck Maker Projects shelf. |
| A128 | `advanced-creator-project-manage` | Deck Maker And Generated Lorepack Authoring | Search, filter, select, move, rename, resume, or delete Deck Maker projects deliberately. |
| A129 | `advanced-creator-inspect-generated-pack` | Deck Maker And Generated Lorepack Authoring | Open the linked Generated Lorepack in Library details. |
| A130 | `advanced-creator-readiness-gate` | Deck Maker And Generated Lorepack Authoring | Read accepted coverage, draft blockers, Pack Health, and export readiness before finalization. |
| A131 | `advanced-health-center-open` | Pack Health And Packages | Open Pack Health Center from Library details or a generated pack readiness surface. |
| A132 | `advanced-health-status` | Pack Health And Packages | Use Refresh Scan, then read errors, warnings, notices, entry counts, and manifest health. |
| A133 | `advanced-health-issue-groups` | Pack Health And Packages | Inspect grouped health issues by severity, code, affected data, and suggested repair path. |
| A134 | `advanced-health-attempt-fixing` | Pack Health And Packages | Run Attempt Fixing for editable packs, then use saved sessions or model batches when the repair is not fully deterministic. |
| A135 | `advanced-health-manual-repair` | Pack Health And Packages | Use per-issue actions such as Accept As-Is, Verify Fixed, Queue Tag ID Review, or manual edits when Attempt Fixing cannot apply one clear fix. |
| A136 | `advanced-package-update` | Pack Health And Packages | Update or reinstall packages when a newer or corrected package is available. |
| A137 | `advanced-package-local-mod-warning` | Pack Health And Packages | Understand local modification warnings before overwriting or updating a package. |
| A138 | `advanced-package-export-bundled` | Pack Health And Packages | Export Bundled Lorepack references correctly so imports remain lightweight where possible. |
| A139 | `advanced-package-export-custom` | Pack Health And Packages | Export Custom Lorepacks with embedded data for sharing or backup. |
| A140 | `advanced-generated-finalize-custom` | Pack Health And Packages | Finalize a reviewed Generated Lorepack as a Custom Lorepack after review and readiness checks. |
| A141 | `advanced-generated-export-readiness` | Pack Health And Packages | Interpret generated export readiness without treating it as the only quality gate. |
| A142 | `advanced-settings-provider-overview` | Settings And Providers | Understand Utility and Reasoning provider roles. |
| A143 | `advanced-settings-provider-profile` | Settings And Providers | Select or edit provider profiles for model-backed Saga actions. |
| A144 | `advanced-settings-endpoint-model` | Settings And Providers | Configure endpoint and model details for provider routes. |
| A145 | `advanced-settings-provider-test` | Settings And Providers | Test configured providers before relying on scans, compression, Context Reasoner, or Deck Maker calls. |
| A146 | `advanced-settings-current-model` | Settings And Providers | Use the current SillyTavern model where that is the simplest provider route. |
| A147 | `advanced-settings-generation` | Settings And Providers | Tune generation parameters for model-backed Saga tasks. |
| A148 | `advanced-settings-provider-presets` | Settings And Providers | Use provider preset support to install or update bundled profile routing. |
| A149 | `advanced-settings-api-compat` | Settings And Providers | Inspect compatibility flags only when diagnosing provider behavior. |
| A150 | `advanced-settings-theme-pack` | Settings And Providers | Choose, import, export, reset, and inspect Theme Packs. |
| A151 | `advanced-settings-icon-set` | Settings And Providers | Choose icon sets from the Theme Pack controls. |
| A152 | `advanced-settings-colors` | Settings And Providers | Tune color controls and raw tokens for runtime visual polish. |
| A153 | `advanced-settings-diagnostics` | Settings And Providers | Use diagnostics or developer status when provider, runtime, or package behavior needs investigation. |
| A154 | `advanced-troubleshoot-no-loredeck` | Troubleshooting Routes | Route empty-stack issues to the Loredeck Library and active stack. |
| A155 | `advanced-troubleshoot-wrong-context` | Troubleshooting Routes | Route wrong suggestions to Context Workbench, locks, proposals, or Advanced Brief. |
| A156 | `advanced-troubleshoot-no-suggestions` | Troubleshooting Routes | Check active stack, Context, provider readiness, and canon/story generation paths. |
| A157 | `advanced-troubleshoot-pending-stuck` | Troubleshooting Routes | Clear draft and pending queues through review, accept, reject, or drop actions. |
| A158 | `advanced-troubleshoot-no-injection` | Troubleshooting Routes | Check Injection toggles, tiers, Context eligibility, stack enabled state, mute, and token pressure. |
| A159 | `advanced-troubleshoot-prompt-heavy` | Troubleshooting Routes | Tune tiers, compression, Low relevance, continuity sections, and prompt placement. |
| A160 | `advanced-troubleshoot-provider-failure` | Troubleshooting Routes | Route provider failures to Settings, request surfaces, and audit output. |
| A161 | `advanced-troubleshoot-continuity-stale` | Troubleshooting Routes | Rescan, adjust scope, inspect tracked sections, or recover interrupted scans. |
| A162 | `advanced-troubleshoot-package-duplicate` | Troubleshooting Routes | Resolve duplicate package import warnings before installing or updating. |
| A163 | `advanced-troubleshoot-health-warnings` | Troubleshooting Routes | Route Pack Health warnings to repair, ignore, duplicate-as-custom, or manual edit paths. |
| A164 | `advanced-troubleshoot-creator-failure` | Troubleshooting Routes | Retry, retry smaller, cancel, or adjust Deck Maker generation settings. |
| A165 | `advanced-troubleshoot-return-basic` | Troubleshooting Routes | Switch back to Basic when routine roleplay no longer needs advanced controls. |

## Section Cards

The guide launcher should show compact module cards. The visible card list should not enumerate every step.

Recommended Basic cards:

| Card | Starts at | Summary |
| --- | --- | --- |
| First Run | B01 | Get oriented, read readiness, and use the next action. |
| Loredecks | B05 | Load, import, inspect, and stack Lorepacks. |
| Context | B19 | Set story position and keep it current. |
| Lorecards | B33 | Generate, review, accept, and clean up durable facts. |
| Continue Roleplay | B47 | Confirm readiness and repeat the update loop. |
| Settings | B51 | Fix providers and Theme Pack basics. |

Recommended Advanced cards:

| Card | Starts at | Summary |
| --- | --- | --- |
| Loredeck Library Mastery | A01 | Manage Library, stack, folders, imports, exports, and details. |
| Session And Runtime Control | A26 | Manage mode, automation, active state, metrics, and guide routing. |
| Context Resolution | A34 | Resolve, audit, lock, and debug Story Position. |
| Lorecard Generation And Review | A61 | Generate, review, edit, tier, and audit Lorecards. |
| Injection Diagnostics | A83 | Inspect exactly what Saga sends and why. |
| Continuity Tracking | A98 | Track, tune, edit, and recover live scene state. |
| Deck Maker And Generated Lorepack Authoring | A112 | Create and complete Generated Lorepack projects. |
| Pack Health And Packages | A131 | Validate, repair, update, export, and finalize Lorepacks. |
| Settings And Providers | A32 | Configure providers, Theme Packs, icons, colors, State Safety, Danger Zone cleanup, and diagnostics. |
| Troubleshooting Routes | A154 | Route common failures to the right control surface. |

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

- Implement B01-B55 in `runtime-guide-content.js`.
- Add missing tour targets for Library internals and review surfaces.
- Keep Basic excluded controls unaddressable from Basic guide data.

### Phase 4: Expand Advanced Steps

- Implement A01-A165 in module groups.
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
- Basic guide source does not include Deck Maker, Continuity, or Injection targets.
- Advanced guide includes Loredecks, Session, Context, Continuity, Lorecards, Injection, Settings, Deck Maker, Pack Health, and troubleshooting modules.
- Every guide step has `expected` and `when`.
- Every step target is marked in runtime UI or declares a valid `prepare`.
- Every `prepare` action has a smoke-testable no-object fallback.

Recommended smoke coverage:

- Basic full walkthrough through B01-B55 with seeded HP Core/Year deck data.
- Basic Loredecks module with no stack, then with an imported package fixture.
- Basic Context module with unset Context, manual Context, detected Context, and proposals.
- Basic Lorecards module with pending, accepted, pinned, muted, and empty states.
- Advanced Library module with folders, bulk selection, import preview, export, and stack changes.
- Advanced Context module with local, Reasoner proposal, locks, audit, and Advanced Brief states.
- Advanced Injection module with included and omitted Lorecards.
- Advanced Continuity module with scan results and editable state blocks.
- Advanced Creator module with an in-progress project and generated pack.
- Advanced Pack Health module with Attempt Fixing, review-choice, and manual repair examples.

## Done Definition

This feature is done when:

- The Basic Walkthrough teaches the full routine roleplay loop without exposing hidden Basic controls.
- The Advanced Walkthrough is organized as task tracks and covers the full operating surface.
- The guide data is no longer constrained by maximum step counts.
- Users can run a full walkthrough or start a focused module.
- Fullscreen workflows can be prepared and targeted reliably.
- Static tests assert coverage by required ids and visible controls, not arbitrary guide size.
