function guideStep(id, title, body, tab, target, options = {}) {
    return Object.freeze({
        id,
        title,
        body,
        tab,
        target,
        actionLabel: 'Show',
        ...options,
    });
}

function freezeGuideSteps(steps) {
    return Object.freeze(steps.map(step => Object.freeze(step)));
}

export const GUIDE_STEPS = Object.freeze({
    basic: freezeGuideSteps([
        guideStep('active', 'Keep Saga Active', 'Saga Active is the master switch. Leave it on when you want accepted Lorecards to help the next response.', 'session', 'session.active', {
            expected: 'Saga can use accepted Lorecards and any manual tools you choose to run.',
            when: 'Turn it off only when this chat should ignore Saga without deleting saved lore.',
        }),
        guideStep('choose-loredeck', 'Open Library', 'Open the Loredeck Library and add the deck or deck group that matches the story to the active stack.', 'loredecks', 'loredecks.library.open', {
            fallbackTarget: 'loredecks.library.launch',
            expandSections: Object.freeze(['loredecks.libraryLaunch']),
            expected: 'At least one Loredeck is loaded into the active stack for this chat.',
            when: 'Do this first. Saga needs a loaded Loredeck before Context, review, and prompt selection mean much.',
        }),
        guideStep('set-context', 'Set Context', 'Set the current story position for the loaded Loredeck. Manual Context Browser choices are the trusted Basic path.', 'context', 'context.commandCenter', {
            expandSections: Object.freeze(['context.commandCenter', 'context.loadedLoredecks']),
            expected: 'The loaded Loredeck has a current Context row, such as an arc, chapter, date, episode, quest, or other story position.',
            when: 'Do this after loading a Loredeck and whenever the story jumps to a new major point.',
        }),
        guideStep('review-lorecards', 'Review Lorecards', 'Review suggested or generated Lorecards before they affect future responses.', 'lore', 'lore.pending', {
            expandSections: Object.freeze(['lore.pendingReview', 'lore.acceptedEntries']),
            expected: 'Useful facts become accepted Lorecards. Recap, noise, or wrong facts stay out.',
            when: 'Use this whenever Saga proposes Lorecards or when you add an important story fact manually.',
        }),
        guideStep('continue-update', 'Continue and Update', 'When accepted Lorecards are selected, continue roleplay. When the story jumps, return to Context; when new durable facts appear, review or scan recent story.', 'session', 'session.basicInjectionSummary', {
            fallbackTarget: 'session.basicReadiness',
            expected: 'Basic shows whether accepted Lorecards are selected for the next response without opening the full Injection tab.',
            when: 'Use this as the normal loop: play, update Context after jumps, and review important new lore.',
        }),
    ]),
    advanced: freezeGuideSteps([
        guideStep('experience-mode', 'Experience Mode', 'Switches between focused Basic controls and the full Advanced toolset.', 'session', 'session.experienceMode', {
            expected: 'Basic applies a simpler profile. Advanced restores detailed controls and backed-up settings.',
            when: 'Use Advanced when you need automation, continuity tuning, workbenches, timeline, or placement control.',
        }),
        guideStep('automation-mode', 'Automation Mode', 'Chooses whether Saga stays manual, scans continuity automatically, or runs broader automation.', 'session', 'session.automation', {
            expected: 'Manual only runs when clicked. Assisted tracks continuity. Automatic also runs context/lore automation.',
            when: 'Use Manual while configuring; use Assisted or Automatic once settings are stable.',
        }),
        guideStep('active', 'Saga Active', 'The master runtime switch for Saga behavior.', 'session', 'session.active', {
            expected: 'When enabled, prompt injection and configured automation can run.',
            when: 'Use this to pause Saga without deleting state.',
        }),
        guideStep('metrics', 'Session Metrics', 'Shows pending continuity, pending lore, accepted lore, selected injection count, and injection token estimate.', 'session', 'session.metrics', {
            expected: 'These values help diagnose whether Saga has data and whether it is injecting data.',
            when: 'Use this as a quick runtime status check.',
        }),
        guideStep('context-automation', 'Context Automation', 'Controls whether Context detection runs only on click or automatically after turns.', 'context', 'context.automation', {
            expected: 'Automatic detection can keep Context current during active roleplay.',
            when: 'Use automatic detection if your story frequently moves scenes or dates.',
        }),
        guideStep('context-window', 'Context Source Messages', 'Controls how many recent chat messages are sent to Context detection.', 'context', 'context.sourceMessages', {
            expected: 'Larger windows improve detection but cost more time when model fallback is needed.',
            when: 'Increase it if context detection misses dates stated earlier in the scene.',
        }),
        guideStep('context-detect', 'Detect Context', 'Runs Context detection immediately.', 'context', 'context.detect', {
            expected: 'The Context Brief, resolver audit, and unlocked loaded Loredeck Context rows update when Saga finds a reliable match.',
            when: 'Run before canon suggestions or after timeline, arc, chapter, episode, quest, or event jumps.',
        }),
        guideStep('context-fields', 'Advanced Context Brief', 'Manually correct the legacy global Context Brief projection when detection is ambiguous or the story is alternate-universe.', 'context', 'context.fields', {
            expandSections: Object.freeze(['context.advancedBrief']),
            expected: 'Manual edits immediately affect generation and canon pack previews, while per-Loredeck Context rows remain authoritative for Loredeck gates.',
            when: 'Use this for branches, time travel, unclear dates, or custom fanfiction canon points.',
        }),
        guideStep('continuity-automation', 'Continuity Automation', 'Controls whether continuity state scanning is manual or turn-interval based.', 'continuity', 'continuity.automation', {
            expected: 'Automatic scans update lightweight scene state at the configured interval.',
            when: 'Use this when you want Saga to maintain current-scene state in the background.',
        }),
        guideStep('continuity-scope', 'Continuity Scan Scope', 'Chooses recent, custom, or entire-chat scanning for continuity state.', 'continuity', 'continuity.scanScope', {
            expandSections: Object.freeze(['continuity.scanScope']),
            expected: 'Recent is best for maintenance. Custom or entire chat is for backfill.',
            when: 'Use custom ranges when a specific section of chat needs recovery.',
        }),
        guideStep('continuity-performance', 'Continuity Performance', 'Controls chunking, overlap, parallelism, retry behavior, and checkpoint recovery.', 'continuity', 'continuity.performance', {
            expandSections: Object.freeze(['continuity.scanPerformance']),
            expected: 'Smaller chunks are more reliable; higher concurrency is faster but heavier.',
            when: 'Tune this for large stories or provider instability.',
        }),
        guideStep('continuity-run', 'Scan Continuity State', 'Runs the adaptive continuity scanner now.', 'continuity', 'continuity.scan.button', {
            fallbackTarget: 'continuity.scan',
            expected: 'Continuity sections update with current scene, cast, items, and active threads.',
            when: 'Run after a scene changes or after a long section of roleplay.',
        }),
        guideStep('tracked-sections', 'Tracked Sections', 'Enables or disables which continuity state sections are updated and injected.', 'continuity', 'continuity.trackedSections', {
            expandSections: Object.freeze(['continuity.trackedSections']),
            expected: 'Disabled sections preserve saved data but stop being scanned and injected.',
            when: 'Use this to reduce noise or keep only the continuity sections you care about.',
        }),
        guideStep('character-fields', 'Active Character Fields', 'Appearance Detail and Emotional State are child fields inside Active Characters, not separate top-level continuity sections.', 'continuity', 'continuity.characterFields', {
            expandSections: Object.freeze(['continuity.trackedSections']),
            expected: 'Disabling a child field preserves saved values but prevents scans and injection from treating that field as live state.',
            when: 'Use this when clothing or emotion should stop influencing the next prompt without deleting character state.',
        }),
        guideStep('emotional-freshness', 'Emotional State Freshness', 'Controls how long emotional state is injected as current, recent, or omitted as stale.', 'continuity', 'continuity.emotionalState', {
            expandSections: Object.freeze(['continuity.trackedSections']),
            expected: 'Old emotions decay by message age so characters can naturally move out of prior moods.',
            when: 'Tune this if characters seem emotionally stuck or if scans run infrequently.',
        }),
        guideStep('scene-editor', 'Scene and Timeline', 'Edits current date, location, activity, and timeline state.', 'continuity', 'continuity.scene', {
            expandSections: Object.freeze(['continuity.canonScene']),
            expected: 'This is immediate state, not permanent lore.',
            when: 'Use this to correct the next-scene anchor.',
        }),
        guideStep('character-editor', 'Active Characters', 'Tracks current cast state such as posture, emotions, appearance, and immediate goals.', 'continuity', 'continuity.characters', {
            expandSections: Object.freeze(['continuity.characters']),
            expected: 'The model receives current-state cues without needing a full summary.',
            when: 'Use this for scene-level character state that should not become durable lore.',
        }),
        guideStep('character-emotion-summary', 'Emotional State Summary', 'Shows saved emotional state inside Active Characters and labels it as current, recent, stale, or disabled.', 'continuity', 'continuity.emotionalStateSummary', {
            expandSections: Object.freeze(['continuity.characters']),
            expected: 'Emotion remains visible for review while stale values stop acting like permanent character mood.',
            when: 'Use this to verify whether a character emotion is fresh enough to influence injection.',
        }),
        guideStep('items-editor', 'Key Items', 'Tracks consequential current items and object status.', 'continuity', 'continuity.items', {
            expandSections: Object.freeze(['continuity.inventory']),
            expected: 'Current item state stays available for continuity injection.',
            when: 'Use this for items currently affecting the scene.',
        }),
        guideStep('threads-editor', 'Active Goals and Threads', 'Tracks immediate unresolved goals and active story threads.', 'continuity', 'continuity.threads', {
            expandSections: Object.freeze(['continuity.activeGoalsThreads']),
            expected: 'The model gets concise reminders of current objectives.',
            when: 'Use this for short-term direction rather than permanent lore.',
        }),
        guideStep('timeline-summary', 'Lore Timeline Summary', 'Shows accepted-lore change history and opens the full timeline visualizer.', 'lore', 'lore.timeline', {
            expected: 'Creation, update, deletion, restoration, pin, mute, and metadata events are tracked.',
            when: 'Use this to audit or recover lore changes.',
        }),
        guideStep('timeline-open', 'Open Timeline', 'Opens the full Lore Timeline window.', 'lore', 'lore.timeline.open', {
            fallbackTarget: 'lore.timeline',
            expected: 'The visualizer can inspect lore events and restore entries back to pending review.',
            when: 'Use this for recovery or timeline-aware lore audits.',
        }),
        guideStep('new-lore', 'New Lore', 'Creates a manual lore draft with title, text, injection override, notes, tags, and metadata.', 'lore', 'lore.new', {
            expected: 'The draft goes to Pending Lore Review for editing and acceptance.',
            when: 'Use this when you know a detail should be remembered without running a model scan.',
        }),
        guideStep('lore-context', 'Lore Context Status', 'Shows the Context currently driving lore tools.', 'lore', 'lore.contextStatus', {
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Context should be current before canon preview or story-lore scan.',
            when: 'Use this as the Lorecards tab context sanity check.',
        }),
        guideStep('canon-preview', 'Preview Canon Packs', 'Runs the local canon database query and builds selectable lore packs.', 'lore', 'lore.canon.preview', {
            expandSections: Object.freeze(['lore.generation']),
            expected: 'No provider call is used. Results are grouped by relevance and pack.',
            when: 'Use this for date-aware canon guardrails.',
        }),
        guideStep('canon-detail', 'Canon Detail Level', 'Filters canon preview results from Core to All Active.', 'lore', 'lore.canon.detailFilter', {
            fallbackTarget: 'lore.canon.preview',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Higher detail shows more low-priority constraints.',
            when: 'Use Core/Standard for regular play; use Detailed/All when auditing.',
        }),
        guideStep('canon-packs', 'Canon Pack Selection', 'Switches between grouped canon packs for the current Context.', 'lore', 'lore.canon.packGrid', {
            fallbackTarget: 'lore.canon.preview',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Only the active pack\'s entries are shown below.',
            when: 'Use packs to add focused canon sets instead of dumping everything.',
        }),
        guideStep('canon-add', 'Add Canon to Pending', 'Adds selected or pack-wide canon entries to Pending Lore Review.', 'lore', 'lore.canon.addPending', {
            fallbackTarget: 'lore.canon.preview',
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Added entries remain pending until explicitly accepted.',
            when: 'Use selected entries for precision; pack add for trusted small packs.',
        }),
        guideStep('canon-settings', 'Canon Suggestion Settings', 'Controls local canon database use, auto-suggest behavior, and quick-add cap.', 'lore', 'lore.canon.settings', {
            expandSections: Object.freeze(['lore.generation', 'lore.canonSuggestionSettings']),
            expected: 'These settings affect preview/quick-add behavior, not story-lore model scans.',
            when: 'Use this to tune canon suggestions after context detection.',
        }),
        guideStep('story-scan', 'Scan Story Lore', 'Runs model-based extraction for story-specific lore.', 'lore', 'lore.story.scan', {
            expandSections: Object.freeze(['lore.generation']),
            expected: 'Results are chunked, checkpointed, and added to Pending Lore Review.',
            when: 'Use after substantial new story content or for backfilling old chats.',
        }),
        guideStep('story-scope', 'Story Lore Scan Scope', 'Chooses recent, custom range, or entire-chat story-lore scanning.', 'lore', 'lore.story.scope', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.scanScope']),
            expected: 'Recent is maintenance. Custom and entire chat are backfill tools.',
            when: 'Use custom ranges for targeted extraction.',
        }),
        guideStep('story-performance', 'Story Lore Performance', 'Controls chunk size, overlap, concurrency, retries, checkpoint cadence, and consolidation.', 'lore', 'lore.story.performance', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.performance']),
            expected: 'Lower chunk size and concurrency improve reliability; higher values speed up strong providers.',
            when: 'Tune this for large scans or provider rate limits.',
        }),
        guideStep('story-quality', 'Story Lore Quality', 'Controls scan breadth, fact targets, generated tags, duplicate guard, similarity routing, and quality gate.', 'lore', 'lore.story.quality', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.quality']),
            expected: 'Quality controls shape what becomes Pending Lore, but users still review entries.',
            when: 'Use this when scans produce too much recap or miss important story-specific facts.',
        }),
        guideStep('story-automation', 'Story Lore Automation', 'Runs story-lore scans after enough words or turns have accumulated.', 'lore', 'lore.story.automation', {
            expandSections: Object.freeze(['lore.generation', 'lore.storyGenerationSettings', 'lore.story.automation']),
            expected: 'Automatic scans remain conservative and still route entries to Pending Lore Review.',
            when: 'Use after the prompt and quality settings are stable.',
        }),
        guideStep('pending-entry', 'Pending Entry Anatomy', 'Shows generated operation, quality route, similarity route, relevance, priority, tags, fact, injection text, and review actions.', 'lore', 'lore.pending.entry', {
            fallbackTarget: 'lore.pending',
            expandSections: Object.freeze(['lore.pendingReview']),
            expected: 'Apply good durable lore; dismiss recap or low-value entries.',
            when: 'Use this for every canon or generated proposal.',
        }),
        guideStep('pending-actions', 'Pending Entry Actions', 'Applies, updates, separates, or dismisses a single pending entry.', 'lore', 'lore.pending.actions', {
            fallbackTarget: 'lore.pending.entry',
            expandSections: Object.freeze(['lore.pendingReview']),
            expected: 'Similarity-routed updates can merge into existing lore or be kept as new.',
            when: 'Use single-entry actions when batch acceptance would be too blunt.',
        }),
        guideStep('pending-bulk', 'Pending Bulk Actions', 'Selects and processes many pending entries at once.', 'lore', 'lore.pending.bulk', {
            fallbackTarget: 'lore.pending',
            expandSections: Object.freeze(['lore.pendingReview']),
            expected: 'Bulk actions respect current selection.',
            when: 'Use after reviewing a batch from canon preview or story scan.',
        }),
        guideStep('pending-workbench', 'Pending Workbench', 'Opens a larger pending-lore review workspace.', 'lore', 'lore.pending.workbench', {
            fallbackTarget: 'lore.pending',
            expandSections: Object.freeze(['lore.pendingReview']),
            expected: 'Dense rows and a detail pane make large batches practical.',
            when: 'Use this when the drawer list is too cramped.',
        }),
        guideStep('accepted-tabs', 'Accepted Category Tabs', 'Filters accepted lore by category, relevance, pin/mute state, and generated categories.', 'lore', 'lore.accepted.categoryTabs', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'The accepted list updates without leaving the Lorecards tab.',
            when: 'Use tabs to quickly isolate a type of lore.',
        }),
        guideStep('accepted-filters', 'Accepted Search and Source Filter', 'Searches accepted lore and filters by Canon Database, Story Generation, or Manual source.', 'lore', 'lore.accepted.filters', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'Only matching entries render in the accepted list.',
            when: 'Use this for cleanup or when finding a specific entry.',
        }),
        guideStep('accepted-pin-mute', 'Pin, Mute, and Relevance', 'Pin prioritizes, mute excludes from injection, and relevance assigns prompt tier.', 'lore', 'lore.accepted.pinMuteHelp', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'These controls determine what lore is stored versus injected.',
            when: 'Use this to reduce prompt noise without deleting lore.',
        }),
        guideStep('accepted-bulk', 'Accepted Bulk Edit', 'Bulk pin, mute, retag, reprioritize, or delete selected accepted entries.', 'lore', 'lore.accepted.bulk', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'Bulk changes are recorded in Lore Timeline.',
            when: 'Use this for large cleanup passes.',
        }),
        guideStep('accepted-entry', 'Accepted Entry Editor', 'Expand an entry to edit text, injection override, notes, metadata chips, tags, and priority.', 'lore', 'lore.accepted.entry', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'Saved edits update the accepted lore matrix and timeline.',
            when: 'Use this to refine generated entries into high-value durable lore.',
        }),
        guideStep('accepted-workbench', 'Accepted Workbench', 'Opens a full accepted-lore management window.', 'lore', 'lore.accepted.workbench', {
            fallbackTarget: 'lore.accepted',
            expandSections: Object.freeze(['lore.acceptedEntries']),
            expected: 'Use dense rows, filters, bulk tools, and detail editing in a larger surface.',
            when: 'Use for large accepted-lore collections.',
        }),
        guideStep('auto-toggle', 'Auto-Relevance Toggle', 'Enables periodic local relevance scoring for accepted lore.', 'lore', 'lore.autoRelevance.toggle', {
            fallbackTarget: 'lore.autoRelevance',
            expandSections: Object.freeze(['lore.autoRelevance']),
            expected: 'Auto-Relevance can suggest or apply tier changes, but does not pin or mute entries.',
            when: 'Use when accepted lore grows large enough that manual tiering is tedious.',
        }),
        guideStep('auto-mode', 'Auto-Relevance Mode', 'Chooses whether to suggest changes for review or apply high-confidence changes.', 'lore', 'lore.autoRelevance.mode', {
            fallbackTarget: 'lore.autoRelevance',
            expandSections: Object.freeze(['lore.autoRelevance']),
            expected: 'Suggest mode is safer. Apply high-confidence reduces review work.',
            when: 'Start with Suggest until you trust the tuning.',
        }),
        guideStep('auto-tuning', 'Auto-Relevance Tuning', 'Controls scan interval, recent-message window, candidate cap, and confidence threshold.', 'lore', 'lore.autoRelevance.tuning', {
            fallbackTarget: 'lore.autoRelevance',
            expandSections: Object.freeze(['lore.autoRelevance']),
            expected: 'Higher caps are broader but heavier; higher confidence is more conservative.',
            when: 'Use this to balance responsiveness and noise.',
        }),
        guideStep('auto-model', 'Utility Provider Adjudication', 'Optionally asks the Utility provider to review locally scored relevance candidates.', 'lore', 'lore.autoRelevance.model', {
            fallbackTarget: 'lore.autoRelevance',
            expandSections: Object.freeze(['lore.autoRelevance']),
            expected: 'Only the candidate subset is sent to the model.',
            when: 'Use when local scoring is not nuanced enough.',
        }),
        guideStep('injection-toggles', 'Injection Toggles', 'Turns Continuity and Lore injection on or off independently.', 'injection', 'injection.toggles', {
            expected: 'Disabled blocks remain editable but are not sent.',
            when: 'Use this to isolate whether continuity or lore is affecting model behavior.',
        }),
        guideStep('prompt-placement', 'Prompt Placement', 'Sets injection method, role, position, and depth for each prompt group.', 'injection', 'injection.promptPlacement', {
            expandSections: Object.freeze(['injection.promptPlacement']),
            expected: 'Depth 0 is closest to the latest chat message; larger depths place blocks earlier.',
            when: 'Use this to tune how strongly each prompt block influences the model.',
        }),
        guideStep('continuity-injection', 'Continuity Injection Preview', 'Shows the current continuity block and its direct/compressed handling controls.', 'injection', 'injection.preview.continuity', {
            expected: 'This is the actual continuity text Saga plans to send.',
            when: 'Use this to verify current-scene state before prompting.',
        }),
        guideStep('high-injection', 'High-Relevance Lore Injection', 'Shows scene-critical accepted lore and direct/compressed handling.', 'injection', 'injection.preview.high', {
            expected: 'High lore should stay close and usually direct unless token pressure is high.',
            when: 'Use this for immediately relevant constraints.',
        }),
        guideStep('normal-injection', 'Normal-Relevance Lore Injection', 'Shows useful background lore selected for the Normal tier.', 'injection', 'injection.preview.normal', {
            expected: 'Normal tier can carry broader context at a deeper prompt position.',
            when: 'Use this for medium-range context.',
        }),
        guideStep('low-injection', 'Low-Relevance Lore Injection', 'Shows distant background lore selected for the Low tier.', 'injection', 'injection.preview.low', {
            expected: 'Low tier is safest compressed or disabled unless broad context matters.',
            when: 'Use this when distant context is still useful.',
        }),
        guideStep('compression-prompts', 'Compression Prompts', 'Edits prompt templates used to compress continuity and relevance-tiered lore.', 'injection', 'injection.compression', {
            expandSections: Object.freeze(['injection.compressionPrompts']),
            expected: 'Reset restores defaults; copy helps audit prompts.',
            when: 'Use this when compression output needs better style or stricter constraints.',
        }),
    ]),
});

export const GUIDE_CONTENT = Object.freeze({
    basic: Object.freeze({
        title: 'Getting Started',
        subtitle: 'first steps',
        tooltip: 'A short guided setup for core Saga use.',
        lede: 'Begin by loading a Loredeck, setting Context, reviewing useful Lorecards, and then continuing the chat.',
        note: 'Basic keeps the prompt controls out of the way. Switch to Advanced only when you want automation, diagnostics, or the full Injection preview.',
        tourLabel: 'Start Walkthrough',
    }),
    advanced: Object.freeze({
        title: 'Saga Guide',
        subtitle: 'workflow + tools',
        tooltip: 'A guided map of Saga runtime tools and configuration areas.',
        lede: 'Use this guide to move through automation, context, continuity, lore generation, review, timeline recovery, and injection controls.',
        note: '',
        tourLabel: 'Start Advanced Walkthrough',
    }),
});

export function getRuntimeGuideSteps(mode) {
    const normalized = String(mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
    return GUIDE_STEPS[normalized] || GUIDE_STEPS.basic;
}

export function getRuntimeGuideContent(mode) {
    const normalized = String(mode || '').toLowerCase() === 'advanced' ? 'advanced' : 'basic';
    return GUIDE_CONTENT[normalized] || GUIDE_CONTENT.basic;
}
