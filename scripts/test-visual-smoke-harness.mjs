import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const harnessPath = path.join(root, 'tests', 'visual-smoke.html');
const loredeckIndexPath = path.join(root, 'Loredecks', 'index.json');
const panelPath = path.join(root, 'lore-panel.js');
const libraryPanelPath = path.join(root, 'loredeck-library-panel.js');
const loredecksTabPanelPath = path.join(root, 'loredecks-tab-panel.js');
const creatorPanelPath = path.join(root, 'loredeck-creator-panel.js');
const healthPanelPath = path.join(root, 'loredeck-health-panel.js');
const contextPanelPath = path.join(root, 'context-panel.js');
const settingsPanelPath = path.join(root, 'settings-panel.js');
const themePanelPath = path.join(root, 'theme-panel.js');
const themeActionsPath = path.join(root, 'theme-actions.js');
const runtimeThemePath = path.join(root, 'runtime-theme.js');
const runtimeUiKitPath = path.join(root, 'runtime-ui-kit.js');
const assistantPath = path.join(root, 'loredeck-assistant.js');
const llmClientPath = path.join(root, 'lore-llm-client.js');
const creatorProjectsPath = path.join(root, 'loredeck-creator-projects.js');
const stateManagerPath = path.join(root, 'state-manager.js');
const constantsPath = path.join(root, 'constants.js');
const stylePath = path.join(root, 'style.css');
const settingsTemplatePath = path.join(root, 'settings.html');
const liveSmokePath = path.join(root, 'scripts', 'smoke-live-st-cdp.mjs');
const sagaHeroIconPath = path.join(root, 'Images', 'iconsets', 'saga-hero', 'hero-tab-loredecks-256.png');
const sagaHeroManifestPath = path.join(root, 'Images', 'iconsets', 'saga-hero', 'icons.json');
const sagaMysticIconPath = path.join(root, 'Images', 'iconsets', 'saga-mystic', 'mystic-tab-loredecks-256.png');
const sagaMysticManifestPath = path.join(root, 'Images', 'iconsets', 'saga-mystic', 'icons.json');
const sagaRelayIconPath = path.join(root, 'Images', 'iconsets', 'saga-relay', 'relay-tab-loredecks-256.png');
const sagaRelayManifestPath = path.join(root, 'Images', 'iconsets', 'saga-relay', 'icons.json');
const hpCoreCoverPath = path.join(root, 'Loredecks', 'hp-core', 'assets', 'cover.png');
const hpYearOneCoverPath = path.join(root, 'Loredecks', 'hp-year-1-philosophers-stone', 'assets', 'cover.png');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const harness = read(harnessPath);
const loredeckIndex = JSON.parse(read(loredeckIndexPath));
const panel = read(panelPath);
const runtimePanelSource = [
    panel,
    read(libraryPanelPath),
    read(loredecksTabPanelPath),
    read(creatorPanelPath),
    read(healthPanelPath),
    read(contextPanelPath),
    read(settingsPanelPath),
    read(themePanelPath),
    read(themeActionsPath),
    read(runtimeThemePath),
    read(runtimeUiKitPath),
].join('\n');
const assistant = read(assistantPath);
const llm = read(llmClientPath);
const creatorProjects = read(creatorProjectsPath);
const loreGenerator = read(path.join(root, 'lore-generator.js'));
const extractor = read(path.join(root, 'extractor.js'));
const stateManager = read(stateManagerPath);
const constants = read(constantsPath);
const style = read(stylePath);
const settingsTemplate = read(settingsTemplatePath);
const liveSmoke = read(liveSmokePath);

assert(harness.includes("import { showLorePanel } from '../lore-panel.js';"), 'Harness must import the real runtime panel.');
assert(fs.existsSync(sagaHeroIconPath), 'Bundled Saga Hero Loredecks icon must exist.');
assert(JSON.parse(read(sagaHeroManifestPath)).id === 'saga-hero', 'Bundled Saga Hero Icon Set manifest must exist.');
assert(fs.existsSync(sagaMysticIconPath), 'Bundled Saga Mystic Loredecks icon must exist.');
assert(JSON.parse(read(sagaMysticManifestPath)).id === 'saga-mystic', 'Bundled Saga Mystic Icon Set manifest must exist.');
assert(fs.existsSync(sagaRelayIconPath), 'Bundled Saga Relay Loredecks icon must exist.');
assert(JSON.parse(read(sagaRelayManifestPath)).id === 'saga-relay', 'Bundled Saga Relay Icon Set manifest must exist.');
assert(fs.existsSync(hpCoreCoverPath), 'Bundled HP Core Loredeck cover must be deck-local.');
assert(fs.existsSync(hpYearOneCoverPath), 'Bundled HP Year 1 Loredeck cover must be deck-local.');
assert((loredeckIndex.bundled || []).some(record => record.packId === 'hp-core' && record.assets?.cover?.path === 'assets/cover.png'), 'Bundled HP index records must expose deck-local cover paths.');
assert(harness.includes('window.SillyTavern'), 'Harness must stub SillyTavern before importing modules.');
assert(harness.includes('window.__sagaSmokeReady = true'), 'Harness must expose a smoke-ready marker.');
assert(harness.includes('new URLSearchParams(window.location.search)'), 'Harness must support query-param visual smoke variants.');
assert(harness.includes("smokeParams.get('tab')"), 'Harness must allow direct tab selection for targeted smoke tests.');
assert(harness.includes("activeTab: smokeActiveTab"), 'Harness must open directly to the requested smoke tab.');
assert(harness.includes("smokeParams.get('review') === 'context-proposals'"), 'Harness must support opening Context proposal review for visual smoke.');
assert(harness.includes('window.__sagaContextSmoke'), 'Harness must expose Context smoke metadata.');
assert(harness.includes("selectedLoredeckId: customPack.packId"), 'Harness must select the seeded Custom Loredeck.');
assert(harness.includes('pendingChanges'), 'Harness must seed Pending Review content.');
assert(harness.includes("kind: 'custom'"), 'Harness must seed a Custom Loredeck source.');
assert(harness.includes('contextResolutionProposals'), 'Harness must seed reviewable Context proposals for Context visual smoke.');
assert(harness.includes('contextResolutionAudit'), 'Harness must seed resolver audit state for Context visual smoke.');
assert(harness.includes('contextAutomationAudit'), 'Harness must seed automation audit state for Context visual smoke.');
assert(harness.includes('state.contextBrief = {'), 'Harness must seed a rich Context Brief for Context visual smoke.');
assert(harness.includes('state.loreContext = {'), 'Harness must seed the legacy global Context projection for compatibility smoke.');
assert(!settingsTemplate.includes('Provider Settings'), 'Extension menu settings must not expose the old Provider Settings dropdown.');
assert(!settingsTemplate.includes('API and model controls'), 'Extension menu settings must not expose legacy API/model controls.');
assert(runtimePanelSource.includes('writeRuntimeThemeVars(document.documentElement'), 'Runtime themes must publish CSS tokens globally for fullscreen windows.');
assert(runtimePanelSource.includes("'--wandlight-red-surface'"), 'Runtime themes must expose derived danger surface tokens.');
const workbenchThemeScope = style.match(/\.wandlight-lore-workbench-shell,\s*[\r\n]+\.wandlight-new-lore-shell\s*\{[\s\S]*?\}/)?.[0] || '';
assert(!workbenchThemeScope.includes('--wandlight-bg:'), 'Fullscreen workbench shells must not redeclare default theme tokens locally.');
assert(style.includes('var(--wandlight-red-surface'), 'Danger Zone and health danger surfaces must use runtime theme tokens.');
assert(!style.includes('border-color: rgba(190, 80, 80, 0.45) !important;'), 'Danger buttons must not use hardcoded late-cascade red borders.');
assert(!style.includes('background: rgba(120, 30, 38, 0.22) !important;'), 'Danger buttons must not use hardcoded late-cascade red backgrounds.');
assert(!style.includes('folder-cover-tile:nth-child(odd)'), 'Folder cover previews must not randomly tilt odd covers.');
assert(!style.includes('folder-cover-tile:nth-child(even)'), 'Folder cover previews must not randomly tilt even covers.');
assert(!runtimePanelSource.includes('LEGACY_ICONSET_ID'), 'Theme icon resolution must not reference the removed legacy icon set.');
assert(!runtimePanelSource.includes('Images/runtime-icons'), 'Runtime icon resolution must not reference the discontinued runtime icon folder.');
assert(!runtimePanelSource.includes('Drop support is queued'), 'Loredeck Library must not expose queued drop-support placeholder copy.');
assert(!runtimePanelSource.includes("['contents', 'Contents'"), 'Loredeck Library details must not expose the low-value Contents tab.');
assert(!runtimePanelSource.includes("['activation', 'Activation'"), 'Loredeck Library details must not expose the low-value Activation tab.');
assert(!runtimePanelSource.includes("createButton('Delete Folder'"), 'Folder details must not expose a redundant Delete Folder button.');
assert(!runtimePanelSource.includes("createButton('Remove', 'Remove this Loredeck from the current stack.'"), 'Loredeck details must not expose a redundant Remove button.');
assert(!runtimePanelSource.includes('createLoredeckLibraryCurrentViewHeader'), 'Loredeck Library must not render the obsolete current-view side-tree summary strip.');
assert(!style.includes('wandlight-loredeck-library-current-view'), 'Loredeck Library CSS must not keep obsolete current-view side-tree styles.');
assert(runtimePanelSource.includes('buildLoredeckPackScopedHealth'), 'Loredeck Library deck stats must scope aggregate stack health back to a single pack.');
assert(runtimePanelSource.includes('report?.databaseId === packId'), 'Loredeck Library deck counts must guard against aggregate stack report summaries.');
assert(!runtimePanelSource.includes('entryCount: Number(report.summary?.entryCount) || Number(loadedMeta?.entryCount)'), 'Loredeck Library deck counts must not prefer aggregate report entry totals over per-pack metadata.');
assert(runtimePanelSource.includes('function refreshLoredeckLibrarySelectionSurfaces'), 'Loredeck Library card selection must support in-place surface refreshes.');
assert(runtimePanelSource.includes('function refreshLoredeckLibrarySelectionHighlights'), 'Loredeck Library folder selection must update highlights before rebuilding heavier surfaces.');
assert(runtimePanelSource.includes('function scheduleLoredeckLibrarySelectionSurfaceRefresh'), 'Loredeck Library folder selection must schedule in-place surface refreshes.');
assert(runtimePanelSource.includes('requestAnimationFrame(() =>') && runtimePanelSource.includes('refreshLoredeckLibrarySelectionSurfaces();'), 'Loredeck Library folder selection refresh should defer heavier detail work to an animation frame.');
assert(runtimePanelSource.includes('scheduleLoredeckLibrarySelectionSurfaceRefresh();'), 'Loredeck Library folder clicks must use the in-place selection refresh path.');
assert(runtimePanelSource.includes('function refreshLoredeckLibraryHierarchyList'), 'Loredeck Library folder disclosure toggles must refresh only the hierarchy list.');
assert(runtimePanelSource.includes('function scheduleLoredeckLibraryHierarchyRefresh'), 'Loredeck Library folder disclosure toggles must schedule a lightweight hierarchy refresh.');
assert(runtimePanelSource.includes('updateLoredeckLibraryFolderDisclosureDom(id, !collapsed);') && runtimePanelSource.includes('scheduleLoredeckLibraryHierarchyRefresh();'), 'Loredeck Library folder disclosure toggles must update arrow state before the list refresh.');
const folderToggleBody = (runtimePanelSource.split('function toggleLoredeckLibraryFolderCollapsed')[1] || '').split('function createLoredeckLibraryFolderCoverStrip')[0] || '';
assert(folderToggleBody && !folderToggleBody.includes('renderLoredeckLibraryOverlay();'), 'Loredeck Library folder disclosure toggles must not rebuild the full overlay.');
assert(runtimePanelSource.includes('function updateLoredeckLibraryDetailsCollapsedDom'), 'Loredeck Library details expand/collapse must update the existing DOM in place.');
assert(runtimePanelSource.includes('if (!updateLoredeckLibraryDetailsCollapsedDom(next)) renderLoredeckLibraryOverlay();'), 'Loredeck Library details collapse should only rerender when the overlay DOM is missing.');
assert(runtimePanelSource.includes('loredeckLibraryExpandedFolderIds'), 'Loredeck Library must track explicit expanded folder overrides for default-collapsed bundled folders.');
assert(runtimePanelSource.includes('isLoredeckLibraryBundledFolder'), 'Loredeck Library must detect bundled folders for default-collapsed folder state.');
assert(runtimePanelSource.includes('createContextCommandCenterCard'), 'Context tab must render the Phase 6 command center.');
assert(runtimePanelSource.includes('Runtime Context'), 'Context command center must use runtime Context language.');
assert(runtimePanelSource.includes('Browse Context'), 'Context command center must expose the Context Browser as a primary action.');
assert(runtimePanelSource.includes('Review Proposals'), 'Context command center must expose proposal review as a primary action.');
assert(runtimePanelSource.includes("['assisted', 'Assisted'"), 'Context automation must expose Assisted mode.');
assert(runtimePanelSource.includes('contextDetectionAutoMinTurns'), 'Context automation must expose minimum-turn cadence settings.');
assert(runtimePanelSource.includes('contextDetectionAutoCharacterThreshold'), 'Context automation must expose character-threshold cadence settings.');
assert(runtimePanelSource.includes('contextReasonerFallbackEnabled'), 'Context automation must expose a Reasoner fallback toggle.');
assert(runtimePanelSource.includes('contextLocalApplyMinConfidence'), 'Context automation must expose local auto-apply confidence.');
assert(runtimePanelSource.includes('contextReasonerProposalMinConfidence'), 'Context automation must expose bounded Reasoner proposal confidence.');
assert(runtimePanelSource.includes('CONTEXT_PROPOSAL_REVIEW_ID'), 'Context proposal review must use a stable fullscreen overlay id.');
assert(runtimePanelSource.includes('openContextProposalReview'), 'Context command center must open the proposal review overlay.');
assert(runtimePanelSource.includes('createContextProposalReviewShell'), 'Context proposal review must render a dedicated fullscreen shell.');
assert(runtimePanelSource.includes('Apply All'), 'Context proposal review must expose an apply-all action.');
assert(runtimePanelSource.includes('Dismiss All'), 'Context proposal review must expose a dismiss-all action.');
assert(runtimePanelSource.includes('createContextProposalReviewRow'), 'Context proposal review must render per-proposal rows.');
assert(runtimePanelSource.includes('formatContextPatchSummary'), 'Context proposal review must summarize proposed Context patches.');
assert(runtimePanelSource.includes('createContextAdvancedBriefSection'), 'Context tab must move legacy global fields into an advanced brief section.');
assert(runtimePanelSource.includes("'context.advancedBrief'"), 'Advanced Context Brief section must have a stable collapsible id.');
assert(!runtimePanelSource.includes('container.appendChild(createContextDetectionCard(state));'), 'Context tab must not render the old standalone detection card.');
assert(runtimePanelSource.includes('toggleLoredeckContextManualLock'), 'Loaded Loredeck Context rows must expose a direct lock/unlock control.');
assert(runtimePanelSource.includes('Seed From Brief'), 'Loaded Loredeck Context rows must seed from the rich Context Brief projection.');
assert(runtimePanelSource.includes('getContextBriefSignalSummary'), 'Advanced Context Brief must summarize non-date detector signals.');
assert(runtimePanelSource.includes('createContextBriefStatusCard'), 'Context tab must surface the latest Context Brief detector status.');
assert(runtimePanelSource.includes("markTourTarget(row, 'context.briefStatus')"), 'Context Brief status row must have a tour target.');
assert(runtimePanelSource.includes('No loaded Loredecks'), 'Context tab must show an empty-stack state instead of stale aggregate Context counts.');
assert(runtimePanelSource.includes('if (stack.length) {') && runtimePanelSource.includes('formatContextIndexSummary(contextIndex)'), 'Context index summaries must be gated behind a loaded Loredeck stack.');
assert(runtimePanelSource.includes('state?.contextBrief'), 'Context Brief status UI must read from chat state.');
assert(runtimePanelSource.includes('refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });'), 'Context detection completion must preserve runtime scroll position.');
assert(style.includes('wandlight-context-brief-status'), 'Context Brief status row must have dedicated compact styling.');
assert(runtimePanelSource.includes('createContextResolutionAuditPanel'), 'Context tab must surface the latest resolver audit summary.');
assert(runtimePanelSource.includes('contextResolutionAudit'), 'Context resolver audit metadata must be persisted in runtime panel state.');
assert(runtimePanelSource.includes('createContextAutomationAuditPanel'), 'Context tab must surface the latest background automation audit summary.');
assert(runtimePanelSource.includes('contextAutomationAudit'), 'Context automation audit metadata must be persisted in runtime panel state.');
assert(runtimePanelSource.includes('Last Automation Check'), 'Context automation audit must use clear user-facing copy.');
assert(runtimePanelSource.includes('Reasoner choices remain review proposals through alpha'), 'Context automation UI must state the alpha Reasoner review-only policy.');
assert(runtimePanelSource.includes('storeContextResolutionProposalsFromResult'), 'Manual Context Reasoner results must persist reviewable proposals.');
assert(runtimePanelSource.includes("if (result?.status === 'in_flight') return getContextResolutionProposals().length;"), 'Manual duplicate in-flight Context checks must preserve existing proposals.');
assert(runtimePanelSource.includes('contextResolutionProposalMeta'), 'Manual Context proposal metadata must be stored for the review panel.');
assert(runtimePanelSource.includes("'manual_reasoner_cached'"), 'Manual Context proposal metadata must identify cached Reasoner results.');
assert(runtimePanelSource.includes('Apply Proposals'), 'Context tab must expose reviewable proposal application.');
assert(runtimePanelSource.includes('clearContextResolutionProposals();'), 'Context proposal application/dismissal must clear review state explicitly.');
assert(loreGenerator.includes('function storeContextResolutionProposals'), 'Automatic Context detection must persist resolver proposals.');
assert(loreGenerator.includes("source: 'automatic_context_detection'"), 'Automatic Context detection must record resolver audit source.');
assert(loreGenerator.includes('settings.contextReasonerFallbackEnabled === false'), 'Automatic Context detection must respect the Reasoner fallback toggle.');
assert(loreGenerator.includes('contextLocalApplyMinConfidence'), 'Automatic Context detection must pass the local confidence setting to the resolver.');
assert(loreGenerator.includes('contextReasonerProposalMinConfidence'), 'Automatic Context detection must pass the Reasoner confidence setting to the resolver.');
assert(loreGenerator.includes('context_reasoner_fallback_disabled'), 'Automatic Context detection must audit disabled Reasoner fallback skips.');
assert(loreGenerator.includes("if (result?.status === 'in_flight')"), 'Automatic duplicate in-flight Context checks must preserve proposal state.');
assert(loreGenerator.includes('state.lorePanel.contextResolutionCache = result.cacheRecord;'), 'Automatic Context detection must persist repeated-check cache records.');
assert(loreGenerator.includes("source: 'reasoner_context_resolution'"), 'Automatic Reasoner proposals must record review metadata source.');
assert(!loreGenerator.includes('applyModel: true'), 'Automatic Context detection must not auto-apply Reasoner output during alpha.');
assert(extractor.includes('recordContextAutomationAudit'), 'Context automation skips must persist a background audit record.');
assert(extractor.includes('context_manual_mode'), 'Context automation must audit Manual-mode skips.');
assert(extractor.includes('context_cadence_not_reached'), 'Context automation must audit cadence skips.');
assert(extractor.includes('context_provider_not_configured'), 'Context automation must audit missing-provider skips.');
assert(extractor.includes('context_all_loredecks_locked'), 'Context automation must audit all-locked-stack skips.');
assert(extractor.includes('context_no_loaded_loredecks'), 'Context automation must audit no-loaded-Loredeck skips.');
assert(stateManager.includes('contextBrief'), 'State manager must preserve Context Brief state.');
assert(constants.includes('contextAutomationAudit'), 'Default state must preserve Context automation audit state.');
assert(style.includes('wandlight-context-command-card'), 'Context command center must have dedicated layout styling.');
assert(style.includes('wandlight-context-automation-audit'), 'Context automation audit must have dedicated styling.');
assert(style.includes('wandlight-context-proposal-review-shell'), 'Context proposal review overlay must have dedicated shell styling.');
assert(style.includes('wandlight-context-proposal-review-row'), 'Context proposal review rows must have dedicated styling.');
assert(style.includes('wandlight-context-advanced-brief-content'), 'Advanced Context Brief content must have dedicated styling.');
assert(style.includes('wandlight-context-proposal-focus'), 'Context proposal review jump must have a visible focus animation.');
assert(style.includes('.wandlight-context-workbench-window-builder > .wandlight-primary-actions'), 'Context Workbench window-builder actions must use explicit grid placement.');
assert(liveSmoke.includes('SAGA_SMOKE_TARGET'), 'Live smoke helper must support targeted smoke modes.');
assert(liveSmoke.includes("SMOKE_TARGET === 'context-harness'"), 'Live smoke helper must support the repo-local Context harness target.');
assert(liveSmoke.includes('context-harness-01-proposal-review'), 'Context harness smoke must capture the proposal-review screenshot.');
assert(liveSmoke.includes('context-harness-02-workbench'), 'Context harness smoke must capture the Context Workbench screenshot.');
assert(liveSmoke.includes('#wandlight-context-workbench'), 'Context harness smoke must verify the Context Workbench opens.');
assert(liveSmoke.includes('Applying the seeded Context proposal'), 'Context harness smoke must verify seeded proposal application.');
assert(liveSmoke.includes("SMOKE_TARGET === 'live-context'"), 'Live smoke helper must support the installed SillyTavern Context target.');
assert(liveSmoke.includes('live-context-01-context-tab'), 'Live Context smoke must capture the installed Context tab screenshot.');
assert(liveSmoke.includes('hasOldContextTooltip'), 'Live Context smoke must guard against the legacy Context tooltip returning.');
assert(liveSmoke.includes('Load a Loredeck before opening the Context Browser.'), 'Live Context smoke must accept the no-loaded-Loredeck Browser guard state.');
assert(liveSmoke.includes('No Context proposals are waiting for review.'), 'Live Context smoke must accept the empty proposal-review guard state.');
assert(liveSmoke.includes("'live-context-loaded'"), 'Live smoke helper must support the installed SillyTavern loaded-Loredeck Context target.');
assert(liveSmoke.includes('loadedContextScreenshotPrefix'), 'Loaded live Context smoke must use a reusable screenshot prefix.');
assert(liveSmoke.includes('-01-context-tab'), 'Loaded live Context smoke must capture the loaded Context tab screenshot.');
assert(liveSmoke.includes('-02-workbench'), 'Loaded live Context smoke must capture the Context Workbench screenshot.');
assert(liveSmoke.includes('-03-proposals'), 'Loaded live Context smoke must capture populated proposal review.');
assert(liveSmoke.includes("'live-context-loaded-narrow'"), 'Live smoke helper must support the narrow loaded-Loredeck Context target.');
assert(liveSmoke.includes('live-context-loaded-narrow'), 'Narrow loaded live Context smoke must use a separate screenshot prefix.');
assert(liveSmoke.includes("SMOKE_TARGET.endsWith('-narrow') ? 430 : 1280"), 'Narrow live Context smoke must use a compact viewport by default.');
assert(liveSmoke.includes('Ron dates the blonde girl'), 'Loaded live Context smoke must verify casual alias search through the Browser.');
assert(liveSmoke.includes('hp.y6.post_christmas_return'), 'Loaded live Context smoke must verify the lower after-bound anchor.');
assert(liveSmoke.includes('hp.y6.apparition_lessons_begin'), 'Loaded live Context smoke must verify the upper before-bound anchor.');
assert(liveSmoke.includes('restoreSagaMetadata'), 'Loaded live Context smoke must restore live SillyTavern metadata after testing.');
assert(liveSmoke.includes('live-context-reasoner'), 'Live smoke helper must support the opt-in installed Context Reasoner target.');
assert(liveSmoke.includes('SAGA_ALLOW_PROVIDER_CALLS=1'), 'Live Context Reasoner smoke must require explicit provider-call opt-in.');
assert(liveSmoke.includes('captureSagaSettings'), 'Live Context Reasoner smoke must snapshot extension settings before temporary tuning.');
assert(liveSmoke.includes('restoreSagaSettings'), 'Live Context Reasoner smoke must restore extension settings after testing.');
assert(liveSmoke.includes('live_reasoner_smoke'), 'Live Context Reasoner smoke must seed a temporary Context Brief.');
assert(liveSmoke.includes('Ask Reasoner'), 'Live Context Reasoner smoke must click the real Ask Reasoner control.');
assert(liveSmoke.includes('contextResolutionProposals'), 'Live Context Reasoner smoke must verify bounded proposals are persisted.');
assert(liveSmoke.includes('live-context-reasoner-02-proposals'), 'Live Context Reasoner smoke must capture the live provider proposal review overlay.');
assert(runtimePanelSource.includes('LOREDECK_CREATOR_ENTRY_BATCH_SIZE = 3'), 'Creator entry drafting must keep the default micro-batch size small.');
assert(runtimePanelSource.includes('Draft Lorecards'), 'Creator entry drafting must expose a guided one-batch action.');
assert(runtimePanelSource.includes('Auto-Draft Up To ${entryRunLimit}'), 'Creator entry drafting must expose a settings-driven bounded advanced auto-draft action.');
assert(runtimePanelSource.includes('Review the current Lorecard drafts before drafting more.'), 'Creator entry drafting must block additional generation while review drafts are open.');
assert(runtimePanelSource.includes('Creator Lorecard Draft Review'), 'Creator draft review must use Creator-specific review language.');
assert(runtimePanelSource.includes('Send Selected to Review'), 'Creator draft review must expose explicit Pending Review handoff language.');
assert(runtimePanelSource.includes('getLoredeckCreatorPipelineModel'), 'Creator wizard must derive a checkpointed production pipeline model.');
assert(style.includes('wandlight-loredeck-creator-stage-guide'), 'Creator roadmap must have dedicated styling.');
assert(runtimePanelSource.includes('getLoredeckCreatorWorkbenchScrollAnchor'), 'Creator workbench must preserve section anchors during rerenders.');
assert(runtimePanelSource.includes('restoreLoredeckCreatorWorkbenchScrollAnchor'), 'Creator workbench must restore section anchors after rerenders.');
assert(runtimePanelSource.includes("wrap.dataset.sagaCreatorAnchor = 'lorecards'"), 'Creator Lorecard stage must expose a stable scroll anchor.');
assert(runtimePanelSource.includes("wrap.dataset.sagaCreatorAnchor = 'finalize'"), 'Creator readiness stage must expose a stable scroll anchor.');
assert(runtimePanelSource.includes("panel.dataset.sagaCreatorAnchor = 'review-status'"), 'Creator sidebar review status must not steal the actionable Pending Review anchor.');
assert(runtimePanelSource.includes('createLoredeckCreatorPendingReviewCard'), 'Creator wizard must render an actionable Pending Review card after planning proposals are queued.');
assert(runtimePanelSource.includes('Review Context and Tags'), 'Creator Context stage must guide users to review queued Context and Tag proposals.');
assert(runtimePanelSource.includes('openLoredeckLibraryDetails'), 'Creator deck inspection buttons must open the visible Loredeck Library details window.');
assert(runtimePanelSource.includes("card.dataset.sagaCreatorAnchor = 'review-queue'"), 'Creator Pending Review card must expose a direct review-queue anchor.');
assert(runtimePanelSource.includes('No pending review queue is available yet.'), 'Creator review-queue jump must report when no queue is rendered.');
assert(runtimePanelSource.includes('wandlight-loredeck-creator-done-button'), 'Creator Context rows must show planned sets as compact Done controls.');
assert(style.includes('wandlight-loredeck-creator-done-button'), 'Creator Context Done controls must have a dedicated success style.');
assert(!runtimePanelSource.includes("appendLoredeckCreatorGenerationStatus(main, cached, ['planning_batch_draft'], { batchId: batch.id, compact: true });"), 'Creator Context rows must not render duplicate compact success bars.');
assert(!runtimePanelSource.includes("appendLoredeckCreatorGenerationStatus(wrap, cached, ['planning_batch_draft']);"), 'Creator Context card must not render a duplicate bottom success bar.');
assert(assistant.includes('currentMicroBatchOnly'), 'Creator entry prompt context must mark entry drafting as a micro-batch.');
assert(assistant.includes('coverageSummary'), 'Creator brief prompt must use the compact scope-brief coverage summary field.');
assert(assistant.includes('timeline plans, tag plans, title-pass plans'), 'Creator brief prompt must prohibit first-pass generation plans.');
assert(assistant.includes('compactCreatorBriefForPrompt'), 'Creator brief revisions must compact older saved briefs before prompting.');
assert(assistant.includes('buildLoredeckCreatorOutlineSystemPrompt'), 'Creator must expose a dedicated outline-stage prompt.');
assert(assistant.includes('parseLoredeckCreatorOutlineResponse'), 'Creator must parse outline-stage responses.');
assert(assistant.includes('Context milestones'), 'Creator outline prompt must ask for major Context browser points.');
assert(assistant.includes('targetTitleBatch'), 'Creator title prompt must target one outline title batch per call.');
assert(assistant.includes('currentTitleBatchOnly'), 'Creator title prompt must prohibit drifting into other title batches.');
assert(assistant.includes('targetPlanningBatch'), 'Creator planning prompt must target one approved title batch per call.');
assert(assistant.includes('currentPlanningBatchOnly'), 'Creator planning prompt must prohibit drifting into other planning batches.');
assert(assistant.includes('acceptedPlanningBatchIds'), 'Creator entry prompt must receive accepted planning batch IDs.');
assert(runtimePanelSource.includes('buildLoredeckCreatorPlanningGenerationUnitId'), 'Creator planning must use stable unit IDs for one planning batch per provider call.');
assert(runtimePanelSource.includes('commitLoredeckCreatorPlanningResult'), 'Creator planning must commit through an idempotent Pending Review helper.');
assert(runtimePanelSource.includes('upsertLoredeckCreatorPlanningPendingChanges'), 'Creator planning must replace same-batch Pending Review proposals instead of appending duplicates.');
assert(runtimePanelSource.includes('creator_planning_batch:'), 'Creator planning unit IDs must be namespaced for runner checkpoints.');
assert(runtimePanelSource.includes('buildLoredeckCreatorEntryGenerationUnitId'), 'Creator Lorecard drafting must use stable micro-batch unit IDs.');
assert(runtimePanelSource.includes('commitLoredeckCreatorEntryDraftResult'), 'Creator Lorecard drafting must commit through an idempotent draft-review helper.');
assert(runtimePanelSource.includes('upsertLoredeckCreatorEntryDraftChanges'), 'Creator Lorecard drafting must replace same-unit draft-review records instead of appending duplicates.');
assert(runtimePanelSource.includes('creator_entry_micro_batch:'), 'Creator Lorecard unit IDs must be namespaced for runner checkpoints.');
assert(runtimePanelSource.includes('entry_micro_batch'), 'Creator Lorecard drafting must run through the generation runner as entry micro-batches.');
assert(runtimePanelSource.includes('draft-review items exist'), 'Creator Lorecard auto-draft must stop when draft-review items exist.');
assert(runtimePanelSource.includes('createLoredeckCreatorAdvancedGenerationSettings'), 'Creator wizard must expose a collapsed Advanced Generation Settings panel.');
assert(runtimePanelSource.includes('getLoredeckCreatorGenerationSettings'), 'Creator generation must read normalized per-project generation settings.');
assert(runtimePanelSource.includes('setLoredeckCreatorGenerationSettings'), 'Creator generation settings must persist per project.');
assert(runtimePanelSource.includes('showStreamingProgress'), 'Creator generation settings must control streaming progress snippets.');
assert(runtimePanelSource.includes('forceVisibleOutput'), 'Creator generation requests must ask reasoning profiles for visible final output on the first call.');
assert(llm.includes('prepareLoreRequestPrompts'), 'Lore LLM client must prepare first-pass visible-output prompts when requested.');
assert(llm.includes('options.forceVisibleOutput === true'), 'Lore LLM client must expose an explicit visible-output opt-in.');
assert(runtimePanelSource.includes('titleRunRemainingLimit'), 'Creator title Generate Remaining must use a configurable run limit.');
assert(runtimePanelSource.includes('entryRunRemainingLimit'), 'Creator Lorecard auto-draft must use a configurable run limit.');
assert(runtimePanelSource.includes('retryAttempts: Number.isFinite(Number(config.retryAttempts))'), 'Creator runner calls must support configured retry attempts.');
assert(stateManager.includes('generationSettings'), 'Creator project persistence must preserve generation settings.');
assert(runtimePanelSource.includes('unitMeta'), 'Creator generation units must persist compact retry metadata.');
assert(runtimePanelSource.includes('getLoredeckCreatorLatestRecoverableUnit'), 'Creator recovery must locate the latest failed or interrupted unit.');
assert(runtimePanelSource.includes('retryLoredeckCreatorRecoverableUnit'), 'Creator recovery must retry failed generation units.');
assert(runtimePanelSource.includes('markLoredeckCreatorRecoveryUnitSuperseded'), 'Creator Retry Smaller must supersede the previous failed unit after creating a replacement.');
assert(runtimePanelSource.includes('buildLoredeckCreatorRetryUnitId'), 'Creator Retry Smaller must create a distinct replacement unit ID.');
assert(runtimePanelSource.includes('Retry Failed'), 'Creator current task controls must expose Retry Failed.');
assert(runtimePanelSource.includes('Retry Smaller'), 'Creator current task controls must expose Retry Smaller.');
assert(runtimePanelSource.includes('Cancel Generation'), 'Creator current task controls must expose Cancel while a generation is active.');
assert(runtimePanelSource.includes('titlePassLimitOverride'), 'Creator Retry Smaller must reduce Title Pass batch size.');
assert(runtimePanelSource.includes('planningProposalLimitOverride'), 'Creator Retry Smaller must reduce Context/Tag planning proposal size.');
assert(runtimePanelSource.includes('targetTitleIds'), 'Creator Lorecard retries must preserve target title IDs.');
assert(runtimePanelSource.includes('getLoredeckCreatorPipelineReadiness'), 'Generated Loredeck export must inspect staged Creator pipeline readiness.');
assert(runtimePanelSource.includes('Creator Readiness Gate'), 'Creator wizard must expose deterministic readiness feedback.');
assert(runtimePanelSource.includes('titles covered'), 'Generated export readiness must show approved-title coverage.');
assert(runtimePanelSource.includes('No linked Creator job was found'), 'Generated export readiness must warn when Creator job metadata is missing.');
assert(runtimePanelSource.includes('acceptLoredeckPendingChanges(pack, pending.map(change => change.changeId))'), 'Loredeck Pending Review Accept All must pass explicit pending change IDs.');
assert(runtimePanelSource.includes('const freshPack = getFreshLoredeckLibraryPack(pack?.packId, pack);'), 'Loredeck pending acceptance must re-read the freshest pack before applying changes.');
assert(runtimePanelSource.includes('else next.pendingChanges = [];'), 'Loredeck pending acceptance must pass an explicit empty pendingChanges field through persistence.');
assert(runtimePanelSource.includes("generated_shell_without_entries"), 'Generated Loredeck planning accepts must skip health rerun while the shell has no accepted Lorecards.');
assert(!runtimePanelSource.includes('no valid manifest or accepted embedded data yet'), 'Generated Loredeck planning accepts must not warn about missing embedded data after each proposal.');
assert(stateManager.includes('clearableOptionalFields'), 'Loredeck library upsert must track optional fields that were intentionally supplied.');
assert(stateManager.includes('delete nextPack[key]'), 'Loredeck library upsert must clear optional fields that normalize to empty.');
assert(runtimePanelSource.includes('Finalize as Custom'), 'Generated Loredecks must expose reviewed Generated-to-Custom finalization.');
assert(runtimePanelSource.includes('buildFinalizedCustomLoredeckRecordFromGenerated'), 'Generated-to-Custom finalization must use an explicit conversion builder.');
assert(runtimePanelSource.includes('generated_finalized'), 'Finalized Custom Loredecks must retain generated-source provenance.');
assert(runtimePanelSource.includes('Generated Loredeck is not export-ready'), 'Selected export must enforce Generated Loredeck readiness.');
assert(runtimePanelSource.includes('refreshLoredeckHealthAfterAcceptedPendingChanges'), 'Pending Review acceptance must rerun Deck Health after health-impact changes.');
assert(runtimePanelSource.includes('and refreshed Deck Health'), 'Pending Review health rerun must report refreshed Deck Health to the user.');
assert(runtimePanelSource.includes('hashLoredeckBundleJson'), 'Loredeck package import must use a canonical content hash.');
assert(runtimePanelSource.includes('Import Loredeck Package'), 'Loredeck package import must use the zip package preview dialog.');
assert(runtimePanelSource.includes('installed Loredeck') && runtimePanelSource.includes('same content hash'), 'Loredeck package import must warn about exact duplicate package content.');
assert(runtimePanelSource.includes('possible duplicate Loredeck'), 'Loredeck package import must warn about possible duplicate Loredecks.');
assert(runtimePanelSource.includes('embeddedEntryCount'), 'Loredeck package import must track embedded Lorecard counts.');

for (const token of [
    'Pending Review',
    'Loredeck Creator',
    'getActiveLoredeckCreatorJob',
    'getLoredeckCreatorProjectRegistry',
    'activateLoredeckCreatorJob',
    'updateLoredeckCreatorProject',
    'upsertLoredeckCreatorJob',
    'clearLoredeckCreatorJob',
    'inferLoredeckCreatorUiStage',
    'refreshLoredeckCreatorWorkbenchBody',
    'queueLoredeckCreatorWorkbenchRefresh',
    'startLoredeckCreatorGeneration',
    'createLoredeckCreatorRequestOptions',
    'appendLoredeckCreatorGenerationStatus',
    'cancelLoredeckCreatorGeneration',
    'ignoreStaleLoredeckCreatorGeneration',
    'recoverLoredeckCreatorInterruptedActiveGeneration',
    'recoverLoredeckCreatorCurrentActiveGenerationOnOpen',
    'isLoredeckCreatorActiveGenerationStillLive',
    'buildLoredeckCreatorInterruptedResult',
    "status: 'interrupted'",
    'Saved batches are preserved',
    'applyLoredeckCreatorGenerationButtonLock',
    'loredeckCreatorGenerationControllers',
    'loredeckCreatorLiveGenerationsByJobId',
    'attachLoredeckCreatorLiveGeneration',
    'activeGenerationByJobId: getLoredeckCreatorActiveGenerationByJobIdMap()',
    'getLoredeckCreatorPipelineModel',
    'createLoredeckCreatorPipelineHeader',
    'createLoredeckCreatorStageGuide',
    'createLoredeckCreatorCurrentTaskCard',
    'createLoredeckCreatorCurrentTaskActions',
    'createLoredeckCreatorArtifactDisclosure',
    'Draft Story Outline',
    'Approve Outline and Unlock Title Pass',
    'Finalize as Custom Loredeck',
    'localJob?.activeGeneration',
    'normalized.activeGeneration',
    'requestLoredeckCreatorBriefResponse',
    'repairLoredeckCreatorBriefResponse',
    'requestLoredeckCreatorOutlineResponse',
    'repairLoredeckCreatorOutlineResponse',
    'markLoredeckCreatorOutlineFailed',
    'createLoredeckCreatorProjectShelf',
    'getLoredeckCreatorProjectShelfModels',
    'createLoredeckCreatorProjectControls',
    'createLoredeckCreatorProjectBulkToolbar',
    'appendLoredeckCreatorProjectFolderFilterOptions',
    'appendLoredeckCreatorProjectMoveOptions',
    'moveLoredeckCreatorProjectsToFolder',
    'getFilteredLoredeckCreatorProjectModels',
    'matchesLoredeckCreatorProjectFolderFilter',
    'setLoredeckCreatorProjectSelected',
    'openLoredeckCreatorProject',
    'renameLoredeckCreatorProjectTitle',
    'deleteLoredeckCreatorProjectWithConfirm',
    'deleteSelectedLoredeckCreatorProjectsWithConfirm',
    'buildLoredeckCreatorProjectCardModels',
    'Search projects...',
    'Delete Selected',
    'Move to: Unfiled',
    'Resume unfinished Generated Loredecks',
    'Scope Brief',
    'Creator Story Outline',
    'handleLoredeckCreatorOutlineDraft',
    'approveLoredeckCreatorOutline',
    'Approve the Story Outline before drafting titles',
    'Generate Next Title Batch',
    'Generate Remaining',
    'handleLoredeckCreatorRemainingTitleBatches',
    'performLoredeckCreatorRemainingTitleBatches',
    'getLoredeckCreatorRemainingTitleBatches',
    'LOREDECK_CREATOR_TITLE_AUTORUN_BATCHES',
    'createLoredeckCreatorTitleBatchPlanner',
    'getLoredeckCreatorNextTitleBatch',
    'creatorTitleBatchId',
    'runGenerationUnits',
    'runLoredeckCreatorSingleUnitGeneration',
    'buildLoredeckCreatorTitleGenerationUnitId',
    'commitLoredeckCreatorTitleDraftResult',
    'creator_title_batch',
    'result.commitResult?.titleCommit',
    'Plan Context and Tags',
    'createLoredeckCreatorPlanningBatchPlanner',
    'getLoredeckCreatorNextPlanningBatch',
    'creatorPlanningBatch',
    'getLoredeckCreatorEntryEligibleBatchIds',
    'Accept at least one planned Context and Tag set before drafting Lorecards',
    'creatorEntryBatch',
    'Open Loredeck Library',
    'Loredeck Library',
    'Import Deck',
    'Install Selected',
    'Add to Stack >',
    'Clear Stack',
    'Deck Health Center',
    'Open Health Center',
    'Run Validation',
    'captureLoredeckHealthCenterScrollState',
    'restoreLoredeckHealthCenterScrollState',
    'Duplicate',
    'Delete',
    'Add Folder to Stack',
    'deleteLoredeckLibraryPackWithConfirm',
    'deleteLoredeckLibraryPacksWithConfirm',
    'moveLoredecksToLibraryFolder',
    'folderDropTarget',
    'createLoredeckLibraryHierarchyList',
    'createLoredeckLibraryInlineFolderRow',
    'createLoredeckLibraryFolderCoverStrip',
    'updateLoredeckLibraryFolderCoverStrip',
    'createLoredeckLibraryFolderDetailsPanel',
    'createLoredeckLibraryFolderLoredeckRow',
    'loredeckLibrarySelectedFolderDetailsId',
    'wandlight-grip-dot-rows',
    'promptCreateLoredeckLibraryFolder',
    'promptRenameLoredeckLibraryFolder',
    'deleteLoredeckLibraryFolderWithConfirm',
    'promptLoredeckLibraryFolderRemovalStrategy',
    'applyLoredeckLibraryFolderRemoval',
    'duplicateLoredeckLibraryPacksWithConfirm',
    'duplicateLoredeckLibraryFolderWithContents',
    'wireOverlayBackdropClose',
    'showSagaChoiceDialog',
    'saveLoredeckLibraryDeckPlacementAssignments',
    'getTargetFolderId',
    'appendLoredeckLibraryFolderMoveOptions',
    'appendLoredeckLibraryFolderParentOptions',
    'showSagaInputDialog',
    'getLoredeckStackFolderPreviewModel',
    'formatLoredeckStackSourceLabel',
    'createLoredeckStackFolderPreview',
    'addLoredeckFolderToStack',
    'createLoredeckStackFolderKey',
    'setLoredeckStackItemCollapsed',
    'createLoredeckLibraryDetailKicker',
    'createLoredeckLibraryEditableTitle',
    'renameLoredeckLibraryDeckTitle',
    'aria-current',
    'resolveLoredeckLibraryDragFeedback',
    'sortLoredeckLibraryPacks',
    'updateLoredeckLibraryDragFeedback',
    'ensureLoredeckLibraryDragCopyLabel',
    'getLoredeckLibraryPackSearchText',
    'getLoredeckLibraryHierarchySearchModel',
    'getLoredeckLibraryFolderSearchState',
    'Expand Details',
    'refreshLoredeckSurfaces',
    'LOREDECK_INDEX_URL',
    'createLoredeckLibraryHeaderMeta',
    'createLoredeckLibrarySquareIconAction',
    'renderSettingsTab',
    'ICONSET_SCHEMA_VERSION',
    'BUNDLED_ICONSET_PRESETS',
    'saga-hero',
    'Images/iconsets/saga-hero/hero-tab-loredecks-256.png',
    'saga-mystic',
    'Images/iconsets/saga-mystic/mystic-tab-loredecks-256.png',
    'saga-relay',
    'Images/iconsets/saga-relay/relay-tab-loredecks-256.png',
    'createThemeIconSetSelector',
    'applyThemeIconSet',
    'createLoredeckDeckVisual',
    'assets.cover',
    'Theme Pack',
    'Installed Theme Packs',
    'Royal Chronicle',
    'Void Reliquary',
    'Stellar Cartography',
    'Neon District',
    'Hero Campus',
    'Sea Map Odyssey',
    'Monster Index',
    'Holo Rail',
    'Midnight Evidence',
    'Shelf Icon Set',
    'Color Overrides',
]) {
    assert(runtimePanelSource.includes(token), `Runtime panel is missing expected smoke token: ${token}`);
}
assert(!runtimePanelSource.includes('main.appendChild(snippet)'), 'Creator generation status must not render raw model output snippets.');
assert(!runtimePanelSource.includes('Draft This Set'), 'Creator Title Pass must not expose per-row title-batch draft buttons.');
assert(!runtimePanelSource.includes('Redraft Set'), 'Creator Title Pass must not expose per-row title-batch redraft buttons.');

for (const token of [
    'emitLoreRequestProgress',
    'readOpenAICompatibleStream',
    'wantsStreamingResponse',
    'stream: shouldStream',
    'streamSupported: false',
]) {
    assert(llm.includes(token), `LLM client is missing expected streaming token: ${token}`);
}

for (const token of [
    'LOREDECK_CREATOR_PROJECT_STAGE_ORDER',
    'normalizeLoredeckCreatorProjectStage',
    'inferLoredeckCreatorProjectStage',
    'getLoredeckCreatorProjectStageDescriptor',
    'getLoredeckCreatorProjectCounts',
    'getLoredeckCreatorProjectNextAction',
    'isLoredeckCreatorProjectUnfinished',
    'buildLoredeckCreatorProjectCardModel',
    'buildLoredeckCreatorProjectCardModels',
    'Review Draft Lorecards',
    'Review Pending Lorecards',
]) {
    assert(creatorProjects.includes(token), `Creator project model is missing expected token: ${token}`);
}

for (const token of [
    'loredeckCreator',
    'loredeckCreatorProjects',
    'normalizeLoredeckCreatorRegistry',
    'normalizeLoredeckCreatorJob',
    'getLoredeckCreatorRegistry',
    'getLoredeckCreatorProjectRegistry',
    'getActiveLoredeckCreatorJob',
    'activateLoredeckCreatorJob',
    'updateLoredeckCreatorProject',
    'upsertLoredeckCreatorJob',
    'clearLoredeckCreatorJob',
    'outline_approved',
    'outlineApproved',
    'titleBatchDraftedIds',
    'planningBatchQueuedIds',
    'planningBatchAcceptedIds',
]) {
    assert(stateManager.includes(token), `State manager is missing expected Creator job token: ${token}`);
}

for (const token of [
    'wandlight-loredeck-install-shell',
    'wandlight-runtime-rail',
    'wandlight-runtime-drawer',
    'wandlight-loredeck-creator-project-shelf',
    'wandlight-loredeck-creator-project-card',
    'wandlight-loredeck-creator-project-controls',
    'wandlight-loredeck-creator-project-search',
    'wandlight-loredeck-creator-project-filter',
    'wandlight-loredeck-creator-project-folder-filter',
    'wandlight-loredeck-creator-project-move-select',
    'wandlight-loredeck-creator-project-bulk',
    'wandlight-loredeck-creator-project-card-selected',
    'wandlight-loredeck-creator-project-progress',
    'wandlight-loredeck-creator-project-delete',
    'wandlight-loredeck-creator-project-select-active',
    'wandlight-loredeck-creator-pipeline-header',
    'wandlight-loredeck-creator-stage-guide',
    'wandlight-loredeck-creator-stage-active',
    'wandlight-loredeck-creator-stage-needs-review',
    'wandlight-loredeck-creator-current-task',
    'wandlight-loredeck-creator-current-sidebar',
    'wandlight-loredeck-creator-output-grid',
    'wandlight-loredeck-creator-artifact',
    'wandlight-loredeck-library-details',
    'wandlight-loredeck-library-resize-handle',
    'wandlight-loredeck-library-resize-track-left',
    'wandlight-loredeck-library-resize-label-arrow',
    'wandlight-loredeck-metadata-shell',
    'wandlight-loredeck-library-shell',
    'wandlight-loredeck-library-columns',
    'wandlight-loredeck-library-hierarchy-list',
    'wandlight-loredeck-library-title-meta',
    'wandlight-loredeck-library-details-collapsed',
    'wandlight-loredeck-library-inline-folder-row',
    'wandlight-loredeck-library-folder-cover-strip',
    'wandlight-loredeck-library-folder-cover-tile',
    'wandlight-loredeck-library-folder-row-drop-enabled',
    'wandlight-loredeck-library-folder-move-select',
    'wandlight-loredeck-library-folder-parent-control',
    'wandlight-loredeck-library-folder-actions',
    'wandlight-confirm-input',
    'wandlight-confirm-choice-list',
    'wandlight-loredeck-library-stack-folder-preview',
    'wandlight-loredeck-library-stack-disclosure-button',
    'wandlight-loredeck-library-stack-folder-card-has-suppressed',
    'wandlight-loredeck-library-stack-card-suppressed',
    'wandlight-loredeck-library-stack-duplicate-summary',
    'wandlight-loredeck-library-stack-folder-preview-chip-kept',
    'wandlight-loredeck-library-drag-copy',
    'wandlight-loredeck-library-drag-copy-remove',
    'wandlight-loredeck-library-drag-drop-invalid',
    'wandlight-loredeck-library-root-drop-active',
    'wandlight-loredeck-library-stack-remove-active',
    'wandlight-loredeck-library-search-match',
    'wandlight-loredeck-library-search-context',
    'wandlight-loredeck-library-transfer-footer',
    'wandlight-loredeck-library-stack-card',
    'wandlight-loredeck-library-stack-grip',
    'wandlight-loredeck-library-inline-title',
    'wandlight-loredeck-library-title-edit-action',
    'wandlight-loredeck-library-title-input',
    'wandlight-loredeck-library-stack-ghost',
    'wandlight-loredeck-library-center-actions',
    'wandlight-loredeck-library-square-action',
    'wandlight-loredeck-library-icon-action',
    'wandlight-loredeck-library-stack-toggle-button',
    'wandlight-loredeck-library-detail-kicker',
    'wandlight-loredeck-library-deck-card.wandlight-loredeck-library-deck-selected',
    'wandlight-loredeck-library-inline-folder-row.wandlight-loredeck-library-folder-row-active',
    'wandlight-loredeck-library-stack-card.wandlight-loredeck-library-stack-card-selected',
    'wandlight-lore-workbench-shell .wandlight-runtime-button',
    'wandlight-loredeck-health-center-shell',
    'wandlight-loredeck-health-severity-card',
    'wandlight-theme-top-grid',
    'wandlight-theme-gallery',
    'wandlight-theme-iconset-selector',
    'wandlight-theme-iconset-strip',
    'wandlight-theme-icon-grid',
    'wandlight-loredeck-library-visual-cover',
    'wandlight-loredeck-library-visual-cover::after',
    'border-radius: inherit',
    'scrollbar-gutter: stable',
]) {
    assert(style.includes(token), `Stylesheet is missing expected smoke selector: ${token}`);
}

assert(!style.includes('max-height: 160px;'), 'Folder details contained Loredeck list must expand with the resized details panel.');
assert(/\.wandlight-loredeck-library-details\s*\{[\s\S]*?height:\s*100%;/.test(style), 'Loredeck Library details panel must fill the resized details region.');
assert(/\.wandlight-loredeck-library-folder-detail-visual\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?justify-self:\s*start;/.test(style), 'Folder detail cover previews must stay pinned to the top-left while details resize.');
assert(style.includes('display: inline-grid !important;') && style.includes('grid-area: 1 / 1;'), 'Loredeck Library square icon actions must center their SVG artwork.');
assert(style.includes('var(--wandlight-chip-bg') && style.includes('var(--wandlight-chip-fg'), 'Loredeck Library metadata/status pills must use theme chip tokens.');
assert(style.includes('calc(var(--wandlight-grip-dot-rows, 6) * 7px)'), 'Loredeck Library drag handles must size dot grids without clipping short 2x2 or 2x3 handles.');

console.log('Visual smoke harness contract passed.');
