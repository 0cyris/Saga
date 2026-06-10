function guideStep(id, title, body, tab, target, options = {}) {
    const section = options.section || tab || 'session';
    return Object.freeze({
        id,
        title,
        body,
        tab,
        target,
        section,
        actionLabel: 'Show',
        ...options,
    });
}

function freezeGuideSteps(steps) {
    return Object.freeze(steps.map(step => Object.freeze(step)));
}

function freezeGuideSections(sections) {
    return Object.freeze(sections.map(section => Object.freeze(section)));
}

function normalizeGuideMode(mode) {
    return String(mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
}

function getGuideSectionId(step) {
    return String(step?.section || step?.tab || 'session').trim() || 'session';
}

export const GUIDE_SECTIONS = Object.freeze({
    basic: freezeGuideSections([
        { id: 'loredecks', label: 'Loredecks', tab: 'loredecks', description: 'Load the active stack and install imported Lorepacks when needed.' },
        { id: 'session', label: 'Session', tab: 'session', description: 'Use the Start Checklist and runtime status before continuing roleplay.' },
        { id: 'context', label: 'Context', tab: 'context', description: 'Set the current story position for every loaded Loredeck.' },
        { id: 'lore', label: 'Lorecards', tab: 'lore', description: 'Suggest, scan, review, accept, and inspect Lorecards.' },
        { id: 'settings', label: 'Settings', tab: 'settings', description: 'Confirm providers and choose the Theme Pack used by the runtime shelf.' },
    ]),
    advanced: freezeGuideSections([
        { id: 'loredecks', label: 'Loredecks', tab: 'loredecks', description: 'Manage the active stack, imports, Creator entry points, and unfinished projects.' },
        { id: 'session', label: 'Session', tab: 'session', description: 'Control runtime mode, automation mode, activation, and diagnostic metrics.' },
        { id: 'context', label: 'Context', tab: 'context', description: 'Resolve story position with browser, local detection, Reasoner proposals, and manual overrides.' },
        { id: 'continuity', label: 'Continuity', tab: 'continuity', description: 'Tune live scene-state scanning, tracked sections, and editable current-state blocks.' },
        { id: 'lore', label: 'Lorecards', tab: 'lore', description: 'Generate canon/story Lorecards, review pending proposals, audit changes, and manage relevance.' },
        { id: 'injection', label: 'Injection', tab: 'injection', description: 'Inspect and tune exactly what Saga sends to the model.' },
        { id: 'settings', label: 'Settings', tab: 'settings', description: 'Configure providers, Provider preset support, Theme Packs, icons, and color controls.' },
    ]),
});

export const GUIDE_STEPS = Object.freeze({
    basic: freezeGuideSteps([
        guideStep('basic-loredecks-library-overview', 'Loredeck Library Overview', 'The Loredecks tab is where source decks enter the active chat stack.', 'loredecks', 'loredecks.library.launch', {
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'You can see how many Loredecks exist, how many are active, and whether Pack Health has warnings.',
            when: 'Start here for a new chat or whenever the story source changes.',
        }),
        guideStep('basic-loredecks-open-library', 'Open Loredeck Library', 'Open the fullscreen Library to choose a Bundled Lorepack, Generated Lorepack, or Custom Lorepack.', 'loredecks', 'loredecks.library.open', {
            fallbackTarget: 'loredecks.library.launch',
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'The Library opens with the active stack manager and available Loredecks.',
            when: 'Use it when the active stack is empty, incomplete, or in the wrong order.',
        }),
        guideStep('basic-loredecks-import', 'Import a Loredeck Package', 'Import Deck installs a Saga Loredeck zip package into the Library.', 'loredecks', 'loredecks.import', {
            fallbackTarget: 'loredecks.library.launch',
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'A shared or exported package can become a Custom Lorepack after preview and install.',
            when: 'Use this when the right Lorepack is not already in the Library.',
        }),
        guideStep('basic-loredecks-active-stack', 'Build the Active Stack', 'Move the Loredecks or folder groups for this story into the active stack.', 'loredecks', 'loredecks.library.launch', {
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'At least one enabled Loredeck participates in Context, canon suggestion, retrieval, and injection.',
            when: 'Do this before setting Context or scanning story lore.',
        }),
        guideStep('basic-session-active', 'Saga Active', 'Saga Active is the master switch for runtime behavior.', 'session', 'session.active', {
            expected: 'When enabled, accepted Lorecards and configured Saga behavior can affect the next response.',
            when: 'Pause Saga for chats where it should not inject or run tools, without deleting saved data.',
        }),
        guideStep('basic-session-start-checklist', 'Start Checklist', 'The Start Checklist turns the Basic workflow into one next action at a time.', 'session', 'session.basicReadiness', {
            expected: 'The checklist points to the next missing step: load Loredecks, set Context, review Lorecards, enable Saga, or continue roleplay.',
            when: 'Use this as the first Session stop in Basic mode.',
        }),
        guideStep('basic-session-ready-loop', 'Continue and Update Loop', 'Once the checklist is ready, continue roleplay, then update Context after jumps and review durable new facts.', 'session', 'session.basicReadiness', {
            expected: 'Basic work becomes a repeatable loop: play, update story position, review new Lorecards, continue.',
            when: 'Use this after the initial setup is complete.',
        }),
        guideStep('basic-session-metrics', 'Session Metrics', 'Metrics show whether Saga has pending Lorecards, accepted lore, selected injection, and a token estimate.', 'session', 'session.metrics', {
            expected: 'You can tell whether Saga has data and whether accepted Lorecards are selected for injection.',
            when: 'Check this if the model seems to ignore lore or if the prompt feels too heavy.',
        }),
        guideStep('basic-context-command-center', 'Runtime Context', 'Runtime Context is the Basic control center for story position.', 'context', 'context.commandCenter', {
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Loaded Loredecks can be browsed, detected, reviewed, and manually locked from one place.',
            when: 'Open this after loading Loredecks and whenever the story moves to a new arc, chapter, date, episode, quest, or event.',
        }),
        guideStep('basic-context-browser', 'Browse Context', 'Browse Context is the trusted manual path for choosing the exact story position.', 'context', 'context.browser', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Manual choices can set and lock the right Context for each loaded Loredeck.',
            when: 'Use this when you know the correct point or detection is uncertain.',
        }),
        guideStep('basic-context-detect', 'Detect Context', 'Detect Context analyzes recent messages and updates unlocked loaded Loredeck Context rows.', 'context', 'context.detect', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Saga stores a detector status and applies high-confidence story-position matches.',
            when: 'Run this after a scene jump, time skip, new episode/chapter, or major location change.',
        }),
        guideStep('basic-context-loaded-loredecks', 'Loaded Loredeck Contexts', 'Each loaded Loredeck gets its own current Context row.', 'context', 'context.loadedLoredecks', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.loadedLoredecks']),
            expected: 'Every enabled Loredeck shows whether Context is unset, detected, manually selected, or locked.',
            when: 'Verify this before canon suggestions or story-lore scans.',
        }),
        guideStep('basic-lorecards-generation', 'Lorecard Generation', 'The generation section gathers canon pack preview, story-lore scan, and manual Lorecard creation.', 'lore', 'lore.generation', {
            fallbackTarget: 'lore.generation.section',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'All new Lorecards still go to Pending Lorecard Review before they can affect prompts.',
            when: 'Use this when the story has new facts or when canon guardrails are needed for the current Context.',
        }),
        guideStep('basic-lorecards-canon-preview', 'Preview Canon Packs', 'Preview Canon Packs queries local Loredeck data for Context-aware canon suggestions without a provider call.', 'lore', 'lore.canon.preview', {
            fallbackTarget: 'lore.generation',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Matching canon entries appear as selectable packs, then selected entries can be sent to Pending Review.',
            when: 'Use this before scenes where canon constraints matter.',
        }),
        guideStep('basic-lorecards-story-scan', 'Scan Story Lore', 'Scan Story Lore asks the configured provider to extract durable story-specific facts from recent chat.', 'lore', 'lore.story.scan', {
            fallbackTarget: 'lore.generation',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Potential facts are proposed as Pending Lorecards, not accepted automatically.',
            when: 'Run it after substantial new roleplay or when you want to backfill recent story facts.',
        }),
        guideStep('basic-lorecards-manual-add', 'Add Lorecard Manually', 'Manual Lorecards let you draft a known fact directly, then review it like generated entries.', 'lore', 'lore.manual.add', {
            fallbackTarget: 'lore.generation',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Your draft lands in Pending Review for one last edit/accept step.',
            when: 'Use this for important facts you already trust and do not need a model to discover.',
        }),
        guideStep('basic-lorecards-pending-review', 'Pending Lorecard Review', 'Pending Review is the gate between suggested facts and accepted memory.', 'lore', 'lore.pending', {
            expandSections: Object.freeze(['lore.pendingReview']),
            expected: 'Accept only useful durable facts. Dismiss recap, noise, wrong canon, or facts that should stay transient.',
            when: 'Review after canon preview, story scan, or manual Lorecard creation.',
        }),
        guideStep('basic-lorecards-accepted', 'Accepted Lorecards', 'Accepted Lorecards are the durable facts Saga can select for future responses.', 'lore', 'lore.accepted', {
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'Accepted entries can be searched, opened, edited, and selected for injection by relevance rules.',
            when: 'Use this to confirm what Saga remembers and to clean up entries that should no longer guide the model.',
        }),
        guideStep('basic-settings-providers', 'Providers', 'Provider setup is only needed for model-backed actions like story-lore scans and Context detection fallback.', 'settings', 'settings.providers', {
            expected: 'Utility and Reasoning provider readiness is visible without exposing every Advanced tuning control.',
            when: 'Check this if model-backed actions fail, stall, or are unavailable.',
        }),
        guideStep('basic-settings-theme-pack', 'Theme Pack', 'Theme Pack controls the runtime shelf appearance, icons, and colors.', 'settings', 'settings.themePack', {
            expected: 'The active theme and icon set can be changed without affecting story data.',
            when: 'Use this for readability or visual preference before a long session.',
        }),
    ]),
    advanced: freezeGuideSteps([
        guideStep('advanced-loredecks-library-overview', 'Library and Stack Overview', 'The Loredecks tab summarizes the Library, active stack, active Lorecard count, and Pack Health warnings.', 'loredecks', 'loredecks.library.launch', {
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'You can see whether the active stack is populated and whether loaded decks need attention.',
            when: 'Use this as the first stop for stack, import, export, and authoring work.',
        }),
        guideStep('advanced-loredecks-open-library', 'Open Loredeck Library', 'Open the fullscreen Library for stack ordering, folders, details, package import/export, duplication, and Generated Lorepack to Custom Lorepack finalization.', 'loredecks', 'loredecks.library.open', {
            fallbackTarget: 'loredecks.library.launch',
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'The Library window exposes full deck management and details panels.',
            when: 'Use this whenever active-stack behavior or package management needs inspection.',
        }),
        guideStep('advanced-loredecks-active-stack', 'Active Stack and Folders', 'The active stack decides which Loredecks participate in Context, canon suggestions, retrieval, and injection.', 'loredecks', 'loredecks.library.launch', {
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'Stack order, enabled state, folder groups, and duplicate suppression are visible from the Library workflow.',
            when: 'Use this to debug why a Lorecard is or is not eligible.',
        }),
        guideStep('advanced-loredecks-import-update', 'Import or Update Packages', 'Import Deck installs Saga Loredeck zip packages and checks duplicate content or possible duplicate decks.', 'loredecks', 'loredecks.import', {
            fallbackTarget: 'loredecks.library.open',
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'Imported packages are previewed before installation and become Library records when accepted.',
            when: 'Use this for a Custom Lorepack, shared package, or updated bundled-family export.',
        }),
        guideStep('advanced-loredecks-create', 'Create a Generated Lorepack', 'Create Deck opens the staged Loredeck Creator for outlines, title passes, Context/tag planning, and Lorecard drafting.', 'loredecks', 'loredecks.creator.open', {
            fallbackTarget: 'loredecks.library.open',
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'A Generated Lorepack project can be started without leaving the runtime shelf.',
            when: 'Use this to build a new Lorepack from a scope brief.',
        }),
        guideStep('advanced-loredecks-projects', 'In-Progress Creator Projects', 'The project shelf resumes unfinished Generated Lorepacks and shows review/generation state.', 'loredecks', 'loredecks.creator.projects', {
            expandSections: Object.freeze(['loredecks.creatorProjects']),
            expected: 'Draft outlines, title batches, planned Context/tag sets, and Lorecard drafts remain recoverable.',
            when: 'Use this after interrupted generation or before finalizing a generated pack.',
        }),
        guideStep('advanced-session-experience-mode', 'Experience Mode', 'Experience Mode switches between focused Basic controls and the full Advanced toolset.', 'session', 'session.experienceMode', {
            expected: 'Advanced restores detailed controls and backed-up settings; Basic keeps the main roleplay workflow focused.',
            when: 'Use Basic for routine play and Advanced for automation, diagnostics, workbenches, or prompt tuning.',
        }),
        guideStep('advanced-session-automation-mode', 'Automation Mode', 'Automation Mode chooses whether Saga runs only when clicked or performs background continuity/context/lore work.', 'session', 'session.automation', {
            expected: 'Manual is explicit, Assisted tracks continuity, and Automatic runs broader configured automation.',
            when: 'Use Manual while configuring; move to Assisted or Automatic once the workflow is stable.',
        }),
        guideStep('advanced-session-active', 'Saga Active', 'Saga Active pauses or resumes Saga behavior without deleting state.', 'session', 'session.active', {
            expected: 'When active, injection and configured automation can run.',
            when: 'Use this to isolate Saga behavior during debugging.',
        }),
        guideStep('advanced-session-metrics', 'Session Metrics', 'Metrics expose pending continuity, pending Lorecards, accepted lore, selected injection, and prompt-size estimates.', 'session', 'session.metrics', {
            expected: 'You can quickly confirm whether data exists and whether injection is being selected.',
            when: 'Use this before deeper Injection or Lorecards diagnostics.',
        }),
        guideStep('advanced-context-command-center', 'Runtime Context Command Center', 'The Context command center brings loaded-deck Context, detection, proposals, locks, and browser access together.', 'context', 'context.commandCenter', {
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Current Context status and resolver actions are visible in one place.',
            when: 'Use this whenever Context might be stale or ambiguous.',
        }),
        guideStep('advanced-context-browser', 'Context Browser', 'Browse known timeline anchors and manually select the exact Context for loaded Loredecks.', 'context', 'context.browser', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Manual choices can override uncertain local or Reasoner detection.',
            when: 'Use this for precise canon points, alternate branches, and ambiguous scenes.',
        }),
        guideStep('advanced-context-detect', 'Detect Context', 'Detect Context analyzes recent messages and updates the Context Brief plus unlocked loaded Loredeck rows.', 'context', 'context.detect', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'Detector status, proposals, and high-confidence local matches update.',
            when: 'Run after time jumps, episode/chapter changes, location shifts, or new canon boundaries.',
        }),
        guideStep('advanced-context-source-window', 'Context Source Messages', 'Source Messages controls how much recent chat is sent to Context detection.', 'context', 'context.sourceMessages', {
            fallbackTarget: 'context.automation',
            expandSections: Object.freeze(['context.commandCenter']),
            expected: 'A larger window can improve detection but may cost more provider time when Reasoner fallback is needed.',
            when: 'Increase it when important date or arc cues appear earlier in the scene.',
        }),
        guideStep('advanced-context-loaded-loredecks', 'Loaded Loredeck Context Rows', 'Each enabled Loredeck has its own Context row, source, lock state, and update status.', 'context', 'context.loadedLoredecks', {
            fallbackTarget: 'context.commandCenter',
            expandSections: Object.freeze(['context.loadedLoredecks']),
            expected: 'You can see which decks are set, unset, locked, or still unresolved.',
            when: 'Use this to explain canon suggestion and retrieval eligibility.',
        }),
        guideStep('advanced-context-fields', 'Advanced Context Brief', 'The advanced brief edits the legacy global Context projection used by older canon-preview flows.', 'context', 'context.fields', {
            expandSections: Object.freeze(['context.advancedBrief']),
            expected: 'Manual edits affect generation and canon preview while loaded Loredeck rows remain authoritative for deck gates.',
            when: 'Use this for alternate universes, time travel, unclear dates, or custom branch labels.',
        }),
        guideStep('advanced-continuity-scan', 'Scan Continuity State', 'The continuity scanner updates lightweight live state for the current scene.', 'continuity', 'continuity.scan.button', {
            fallbackTarget: 'continuity.scan',
            expected: 'Scene, characters, items, and active threads update from the chosen message window.',
            when: 'Run after scene changes, long exchanges, or before prompt-sensitive continuity beats.',
        }),
        guideStep('advanced-continuity-automation', 'Continuity Automation', 'Continuity automation controls manual versus interval-based scanning.', 'continuity', 'continuity.automation', {
            expected: 'Automatic scans can maintain current-state blocks in the background.',
            when: 'Use this when live scene continuity should update without manual clicks.',
        }),
        guideStep('advanced-continuity-scope', 'Continuity Scan Scope', 'Scope chooses recent, custom range, or entire-chat continuity scanning.', 'continuity', 'continuity.scanScope', {
            expandSections: Object.freeze(['continuity.scanScope']),
            expected: 'Recent is maintenance; range and entire-chat are recovery/backfill tools.',
            when: 'Use custom ranges for a specific missed section.',
        }),
        guideStep('advanced-continuity-performance', 'Continuity Performance', 'Performance controls chunking, overlap, reducer concurrency, retries, and checkpoint behavior.', 'continuity', 'continuity.performance', {
            expandSections: Object.freeze(['continuity.scanPerformance']),
            expected: 'You can trade speed against provider stability and output reliability.',
            when: 'Tune this for large chats, weak providers, or repeated scan failures.',
        }),
        guideStep('advanced-continuity-tracked-sections', 'Tracked Sections', 'Tracked Sections decide which live-state blocks are scanned and injected.', 'continuity', 'continuity.trackedSections', {
            expandSections: Object.freeze(['continuity.trackedSections']),
            expected: 'Disabled sections preserve saved values but stop being updated and injected.',
            when: 'Use this to reduce prompt noise or focus continuity on the fields you care about.',
        }),
        guideStep('advanced-continuity-scene', 'Scene and Timeline', 'Scene and Timeline stores immediate date, location, activity, and canon boundary state.', 'continuity', 'continuity.scene', {
            expandSections: Object.freeze(['continuity.canonScene']),
            expected: 'Current scene state is editable without turning it into permanent lore.',
            when: 'Use this to correct the next prompt anchor.',
        }),
        guideStep('advanced-continuity-characters', 'Active Characters', 'Active Characters tracks current cast state, including posture, appearance detail, emotion, and immediate goals.', 'continuity', 'continuity.characters', {
            expandSections: Object.freeze(['continuity.characters']),
            expected: 'The model receives concise current-state cues without needing a full chat summary.',
            when: 'Use this for live character state that should not become durable lore.',
        }),
        guideStep('advanced-continuity-items', 'Key Items', 'Key Items tracks consequential current objects, possessions, and object status.', 'continuity', 'continuity.items', {
            expandSections: Object.freeze(['continuity.inventory']),
            expected: 'Important object state is available for continuity injection.',
            when: 'Use this when items affect the current scene.',
        }),
        guideStep('advanced-continuity-threads', 'Active Goals and Threads', 'Active Goals and Threads captures unresolved immediate objectives.', 'continuity', 'continuity.threads', {
            expandSections: Object.freeze(['continuity.activeGoalsThreads']),
            expected: 'The model gets concise reminders of current direction.',
            when: 'Use this for short-term plot pressure rather than permanent lore.',
        }),
        guideStep('advanced-lore-timeline', 'Lore Timeline', 'Lore Timeline audits accepted-lore creation, updates, deletion, restoration, pinning, muting, and metadata changes.', 'lore', 'lore.timeline.section', {
            expandSections: Object.freeze(['lore.timeline']),
            expected: 'Accepted-lore history and recovery paths are available.',
            when: 'Use this when you need to understand or undo lore changes.',
        }),
        guideStep('advanced-lore-generation', 'Lorecard Generation', 'Generation collects canon pack preview, story-lore scans, and manual Lorecard creation.', 'lore', 'lore.generation', {
            fallbackTarget: 'lore.generation.section',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'New entries route through Pending Lorecard Review before acceptance.',
            when: 'Use this after Context is current.',
        }),
        guideStep('advanced-lore-context-status', 'Lore Context Status', 'The Lorecards tab shows the Context currently driving canon and generation tools.', 'lore', 'lore.contextStatus', {
            expandSections: Object.freeze(['lore.generation']),
            expected: 'You can verify or refresh Context before generating or previewing.',
            when: 'Use this if canon packs look wrong or story-lore scan scope feels stale.',
        }),
        guideStep('advanced-lore-canon-preview', 'Preview Canon Packs', 'Preview Canon Packs locally queries active Loredecks for Context-aware canon suggestions.', 'lore', 'lore.canon.preview', {
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Results are grouped into selectable packs without a provider call.',
            when: 'Use this for date-aware guardrails and branch-sensitive canon constraints.',
        }),
        guideStep('advanced-lore-canon-detail', 'Canon Detail and Pack Selection', 'Detail and pack controls decide how broad canon preview results should be.', 'lore', 'lore.canon.detailFilter', {
            fallbackTarget: 'lore.canon.preview',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Core/Standard keeps regular play lean; Detailed/All exposes more audit material.',
            when: 'Use higher detail when auditing or preparing complex scenes.',
        }),
        guideStep('advanced-lore-canon-add', 'Add Canon to Pending', 'Selected canon entries move into Pending Lorecard Review, not straight into accepted memory.', 'lore', 'lore.canon.addPending', {
            fallbackTarget: 'lore.canon.preview',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'You retain final review before canon suggestions affect future responses.',
            when: 'Use selected entries for precision and pack add for trusted small packs.',
        }),
        guideStep('advanced-lore-canon-settings', 'Canon Suggestion Settings', 'Canon settings control local database use, auto-suggest behavior, and quick-add cap.', 'lore', 'lore.canon.settings', {
            expandSections: Object.freeze(['lore.generation', 'lore.canonSuggestionSettings']),
            expected: 'Settings affect canon preview and quick-add behavior, not story-lore model scans.',
            when: 'Tune this when canon suggestions are too broad, too sparse, or too automatic.',
        }),
        guideStep('advanced-lore-story-scan', 'Scan Story Lore', 'Story scanning extracts durable story-specific facts from recent, ranged, or entire-chat source text.', 'lore', 'lore.story.scan', {
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Facts are chunked, checkpointed, and proposed as Pending Lorecards.',
            when: 'Use after substantial new story content or for backfilling old chats.',
        }),
        guideStep('advanced-lore-story-scope', 'Story Lore Scope', 'Scope chooses recent maintenance, custom range, or entire-chat backfill.', 'lore', 'lore.story.scope', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.scanScope']),
            expected: 'The selected source window controls what the extractor can see.',
            when: 'Use custom range for targeted extraction and entire chat for first setup/backfill.',
        }),
        guideStep('advanced-lore-story-performance', 'Story Lore Performance', 'Performance controls chunk size, overlap, concurrency, retries, checkpoint cadence, and consolidation.', 'lore', 'lore.story.performance', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.performance']),
            expected: 'Lower chunk/concurrency settings are more reliable; higher settings are faster on strong providers.',
            when: 'Tune this for large scans or provider rate limits.',
        }),
        guideStep('advanced-lore-story-quality', 'Story Lore Quality', 'Quality controls breadth, fact targets, generated tags, duplicate guard, similarity routing, and strict gate behavior.', 'lore', 'lore.story.quality', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.quality']),
            expected: 'Generated proposals become more targeted before manual review.',
            when: 'Use this when scans produce recap/noise or miss important facts.',
        }),
        guideStep('advanced-lore-story-automation', 'Story Lore Automation', 'Story automation runs scans after enough words or turns have accumulated.', 'lore', 'lore.story.automation', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.automation']),
            expected: 'Automation remains conservative and still routes entries to Pending Review.',
            when: 'Enable after provider, scope, and quality settings are stable.',
        }),
        guideStep('advanced-lore-pending-review', 'Pending Lorecard Review', 'Pending Review handles canon proposals, story-scan proposals, manual drafts, similarity-routed updates, and dismissals.', 'lore', 'lore.pending', {
            expandSections: Object.freeze(['lore.pendingReview']),
            expected: 'Only accepted proposals become durable Lorecards.',
            when: 'Use this after any generation source creates proposals.',
        }),
        guideStep('advanced-lore-accepted', 'Accepted Lorecards', 'Accepted Lorecards can be searched, filtered, edited, pinned, muted, bulk edited, and opened in a workbench.', 'lore', 'lore.accepted', {
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'Stored lore can be refined separately from prompt selection.',
            when: 'Use this to clean up, prioritize, or inspect what Saga remembers.',
        }),
        guideStep('advanced-lore-auto-relevance', 'Auto-Relevance', 'Auto-Relevance can periodically suggest or apply relevance tier changes for accepted Lorecards.', 'lore', 'lore.autoRelevance', {
            expandSections: Object.freeze(['lore.autoRelevance']),
            expected: 'Large accepted-lore collections can be kept closer to current scene needs.',
            when: 'Use Suggest mode first, then apply high-confidence changes only after tuning.',
        }),
        guideStep('advanced-injection-toggles', 'Injection Toggles', 'Injection toggles turn Continuity and Lore blocks on or off independently.', 'injection', 'injection.toggles', {
            expected: 'Disabled blocks stay editable but are not sent.',
            when: 'Use this to isolate whether continuity or lore is influencing the model.',
        }),
        guideStep('advanced-injection-placement', 'Prompt Placement', 'Prompt Placement sets method, role, position, and depth for each injected prompt group.', 'injection', 'injection.promptPlacement', {
            expandSections: Object.freeze(['injection.promptPlacement']),
            expected: 'Depth and role tuning control how close and forceful each block is.',
            when: 'Use this when lore is too weak, too strong, or in the wrong prompt role.',
        }),
        guideStep('advanced-injection-continuity-preview', 'Continuity Injection Preview', 'The continuity preview shows the actual live-state block Saga plans to send.', 'injection', 'injection.preview.continuity', {
            expected: 'You can verify scene/timeline, characters, items, and goals before prompting.',
            when: 'Use this before scenes that depend on current-state precision.',
        }),
        guideStep('advanced-injection-high-lore', 'High-Relevance Lore Injection', 'High-Relevance lore is the closest, most scene-critical accepted lore block.', 'injection', 'injection.preview.high', {
            expected: 'Immediate constraints should appear here unless muted, context-blocked, or token-limited.',
            when: 'Use this to debug why the model is missing an important fact.',
        }),
        guideStep('advanced-injection-normal-low-lore', 'Normal and Low Lore Injection', 'Normal and Low tiers carry broader or distant context and can be direct, compressed, or disabled.', 'injection', 'injection.preview.normal', {
            fallbackTarget: 'injection.preview.low',
            expected: 'Background lore stays available without overwhelming the prompt.',
            when: 'Use this when broad context matters or prompt size needs reduction.',
        }),
        guideStep('advanced-injection-compression', 'Compression Prompts', 'Compression prompts shape model-compressed continuity and relevance-tiered lore blocks.', 'injection', 'injection.compression', {
            expandSections: Object.freeze(['injection.compressionPrompts']),
            expected: 'Reset restores bundled defaults; edited prompts change future compression output.',
            when: 'Use this when compressed text needs a stricter format or different style.',
        }),
        guideStep('advanced-settings-providers', 'Providers', 'Providers configure Utility and Reasoning model routing, endpoints, profiles, keys, and generation parameters.', 'settings', 'settings.providers', {
            expected: 'Each model-backed feature has a visible provider source and readiness status.',
            when: 'Use this when Context, continuity, story scan, compression, or Creator calls fail.',
        }),
        guideStep('advanced-settings-provider-preset', 'Provider Preset Support', 'Provider preset support checks the bundled thin preset and can install or update it for Connection Profile routing.', 'settings', 'settings.providers', {
            expected: 'Saga can route through SillyTavern profiles while keeping provider configuration inspectable.',
            when: 'Use this when setting up profiles or updating the bundled preset version.',
        }),
        guideStep('advanced-settings-theme-pack', 'Theme Pack', 'Theme Pack selects the runtime visual preset and manages installed theme packs.', 'settings', 'settings.themePack', {
            expected: 'Theme changes affect the runtime surface without touching story data.',
            when: 'Use this for readability, brand flavor, or checking bundled theme variants.',
        }),
        guideStep('advanced-settings-icons-colors', 'Icons and Color Controls', 'Icon sets, color overrides, raw tokens, and theme JSON live under the Theme Pack controls.', 'settings', 'settings.themePack', {
            expected: 'Advanced visual customization stays grouped with Theme Pack settings.',
            when: 'Use this when polishing the shelf or auditing final Alpha visual tokens.',
        }),
    ]),
});

export const GUIDE_CONTENT = Object.freeze({
    basic: Object.freeze({
        title: 'Basic Walkthrough',
        subtitle: 'guided basics',
        tooltip: 'Guided Basic walkthroughs for the visible roleplay workflow tabs.',
        lede: 'Use the full Basic walkthrough for a first pass, or start a smaller tab walkthrough for the part of the workflow you are using now.',
        note: 'Basic keeps Continuity and Injection tuning out of the way. Switch to Advanced when you need automation, diagnostics, workbenches, or prompt placement controls.',
        tourLabel: 'Start Basic Walkthrough',
    }),
    advanced: Object.freeze({
        title: 'Advanced Walkthrough',
        subtitle: 'tab workflows',
        tooltip: 'Guided Advanced walkthroughs grouped by Saga tab and workflow area.',
        lede: 'Use the full Advanced walkthrough as a complete map, or start a focused tab walkthrough for faster routing through a specific workflow.',
        note: '',
        tourLabel: 'Start Advanced Walkthrough',
    }),
});

export function getRuntimeGuideSteps(mode) {
    const normalized = normalizeGuideMode(mode);
    return GUIDE_STEPS[normalized] || GUIDE_STEPS.basic;
}

export function getRuntimeGuideSections(mode) {
    const normalized = normalizeGuideMode(mode);
    const steps = getRuntimeGuideSteps(normalized);
    const sections = GUIDE_SECTIONS[normalized] || GUIDE_SECTIONS.basic;
    return sections.map(section => {
        const sectionSteps = steps.filter(step => getGuideSectionId(step) === section.id);
        return Object.freeze({
            ...section,
            stepCount: sectionSteps.length,
            steps: Object.freeze(sectionSteps),
        });
    }).filter(section => section.stepCount > 0);
}

export function getRuntimeGuideContent(mode) {
    const normalized = normalizeGuideMode(mode);
    return GUIDE_CONTENT[normalized] || GUIDE_CONTENT.basic;
}
