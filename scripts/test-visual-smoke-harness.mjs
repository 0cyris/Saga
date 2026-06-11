import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const harnessPath = path.join(root, 'tests', 'visual-smoke.html');
const loredeckIndexPath = path.join(root, 'Loredecks', 'index.json');
const panelPath = path.join(root, 'lore-panel.js');
const libraryPanelPath = path.join(root, 'loredeck-library-panel.js');
const loredecksTabPanelPath = path.join(root, 'loredecks-tab-panel.js');
const lorecardsPanelPath = path.join(root, 'lorecards-panel.js');
const creatorPanelPath = path.join(root, 'loredeck-creator-panel.js');
const healthPanelPath = path.join(root, 'loredeck-health-panel.js');
const contextPanelPath = path.join(root, 'context-panel.js');
const settingsPanelPath = path.join(root, 'settings-panel.js');
const themePanelPath = path.join(root, 'theme-panel.js');
const themeActionsPath = path.join(root, 'theme-actions.js');
const runtimeThemePath = path.join(root, 'runtime-theme.js');
const runtimeUiKitPath = path.join(root, 'runtime-ui-kit.js');
const runtimeNavigationPath = path.join(root, 'runtime-navigation.js');
const runtimeBasicReadinessPath = path.join(root, 'runtime-basic-readiness.js');
const runtimeGuideContentPath = path.join(root, 'runtime-guide-content.js');
const runtimeTourPath = path.join(root, 'runtime-tour.js');
const assistantPath = path.join(root, 'loredeck-assistant.js');
const llmClientPath = path.join(root, 'lore-llm-client.js');
const creatorProjectsPath = path.join(root, 'loredeck-creator-projects.js');
const stateManagerPath = path.join(root, 'state-manager.js');
const constantsPath = path.join(root, 'constants.js');
const stylePath = path.join(root, 'style.css');
const settingsTemplatePath = path.join(root, 'settings.html');
const liveSmokePath = path.join(root, 'scripts', 'smoke-live-st-cdp.mjs');
const basicWorkflowDocPath = path.join(root, 'docs', 'user', 'BASIC_WORKFLOW.md');
const advancedWorkflowDocPath = path.join(root, 'docs', 'user', 'ADVANCED_WORKFLOW.md');
const documentationIndexPath = path.join(root, 'docs', 'DOCUMENTATION_INDEX.md');
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

function parseSingleQuotedValues(source) {
    return [...String(source || '').matchAll(/'([^']+)'/g)].map(match => match[1]);
}

const VALID_GUIDE_PREPARES = new Set([
    'openLoredeckLibrary',
    'openLoredeckDetails',
    'openContextBrowser',
    'openPendingLoreReview',
    'openAcceptedLoreDetails',
    'openInjectionPreview',
    'openContinuityEditor',
    'openLoredeckCreator',
    'openCreatorProject',
    'openDeckHealthCenter',
    'openAdvancedSettingsSection',
]);

const REQUIRED_BASIC_GUIDE_STEP_IDS = Object.freeze({
    session: Object.freeze([
        'basic-session-orientation',
        'basic-session-saga-active',
        'basic-session-start-checklist',
        'basic-session-next-action',
        'basic-session-metrics',
        'basic-session-ready',
        'basic-session-continue-roleplay',
        'basic-session-repeat-loop',
    ]),
    loredecks: Object.freeze([
        'basic-loredecks-overview',
        'basic-loredecks-open-library',
        'basic-library-layout',
        'basic-library-pack-types',
        'basic-library-search-filter',
        'basic-library-pack-details',
        'basic-library-pack-health',
        'basic-loredecks-import',
        'basic-library-import-preview',
        'basic-library-add-deck-stack',
        'basic-library-add-folder-stack',
        'basic-library-stack-order',
        'basic-library-stack-enable',
        'basic-library-close-confirm',
    ]),
    context: Object.freeze([
        'basic-context-overview',
        'basic-context-loaded-rows',
        'basic-context-browse',
        'basic-context-select-position',
        'basic-context-manual-protects',
        'basic-context-detect',
        'basic-context-proposals',
        'basic-context-update-loop',
    ]),
    lorecards: Object.freeze([
        'basic-lorecards-overview',
        'basic-lorecards-generation-section',
        'basic-lorecards-preview-canon',
        'basic-lorecards-send-canon-review',
        'basic-lorecards-story-scan',
        'basic-lorecards-manual-add',
        'basic-lorecards-pending-review',
        'basic-lorecards-edit-pending',
        'basic-lorecards-accept-dismiss',
        'basic-lorecards-review-question',
        'basic-lorecards-accepted-list',
        'basic-lorecards-open-accepted',
        'basic-lorecards-pin-mute',
        'basic-lorecards-search-cleanup',
    ]),
    settings: Object.freeze([
        'basic-settings-provider-status',
        'basic-settings-provider-test',
        'basic-settings-current-model',
        'basic-settings-theme-pack',
        'basic-settings-advanced-handoff',
    ]),
});

const REQUIRED_ADVANCED_GUIDE_STEP_IDS = Object.freeze({
    libraryMastery: Object.freeze([
        'advanced-loredecks-overview',
        'advanced-loredecks-open-library',
        'advanced-library-empty-selection',
        'advanced-library-special-views',
        'advanced-library-folder-tree',
        'advanced-library-search-sort',
        'advanced-library-pack-select',
        'advanced-library-pack-source',
        'advanced-library-cover-metadata',
        'advanced-library-health-summary',
        'advanced-library-manifest-preview',
        'advanced-library-entry-overrides',
        'advanced-library-stack-pane',
        'advanced-library-add-deck-stack',
        'advanced-library-add-folder-stack',
        'advanced-library-reorder-stack',
        'advanced-library-enable-stack',
        'advanced-library-bulk-select',
        'advanced-library-export-selected',
        'advanced-library-import-package',
        'advanced-library-import-preview',
        'advanced-library-duplicate-warnings',
        'advanced-library-duplicate-custom',
        'advanced-library-folder-actions',
        'advanced-library-open-workbench',
    ]),
    sessionControl: Object.freeze([
        'advanced-session-experience-mode',
        'advanced-session-saga-active',
        'advanced-session-automation-mode',
        'advanced-session-runtime-metrics',
        'advanced-session-guide-modules',
        'advanced-session-active-chat',
        'advanced-session-cleanup-actions',
        'advanced-session-mode-recovery',
    ]),
    contextResolution: Object.freeze([
        'advanced-context-command-center',
        'advanced-context-loaded-rows',
        'advanced-context-browser-open',
        'advanced-context-manual-select',
        'advanced-context-locks',
        'advanced-context-detect',
        'advanced-context-source-window',
        'advanced-context-local-resolver',
        'advanced-context-reasoner',
        'advanced-context-proposal-review',
        'advanced-context-audit',
        'advanced-context-advanced-brief',
        'advanced-context-seed-from-brief',
        'advanced-context-reset',
        'advanced-context-index-summary',
        'advanced-context-workbench-routes',
        'advanced-context-eligibility-debug',
    ]),
    loreReview: Object.freeze([
        'advanced-lore-generation-overview',
        'advanced-lore-canon-preview',
        'advanced-lore-canon-selection',
        'advanced-lore-story-scan',
        'advanced-lore-scan-scope',
        'advanced-lore-manual-add',
        'advanced-lore-assistant-drafts',
        'advanced-lore-pending-review',
        'advanced-lore-pending-edit',
        'advanced-lore-pending-accept-reject',
        'advanced-lore-pending-bulk',
        'advanced-lore-accepted-list',
        'advanced-lore-accepted-search-filter',
        'advanced-lore-accepted-open-edit',
        'advanced-lore-pin-mute',
        'advanced-lore-relevance-tier',
        'advanced-lore-tags-context',
        'advanced-lore-similarity-duplicates',
        'advanced-lore-auto-relevance',
        'advanced-lore-timeline-audit',
        'advanced-lore-workbench',
        'advanced-lore-review-first-policy',
    ]),
    injectionDiagnostics: Object.freeze([
        'advanced-injection-overview',
        'advanced-injection-continuity-toggle',
        'advanced-injection-lore-toggle',
        'advanced-injection-high-tier',
        'advanced-injection-normal-tier',
        'advanced-injection-low-tier',
        'advanced-injection-direct-compressed',
        'advanced-injection-placement',
        'advanced-injection-compression-prompts',
        'advanced-injection-preview-lore',
        'advanced-injection-preview-continuity',
        'advanced-injection-combined-preview',
        'advanced-injection-token-estimate',
        'advanced-injection-omission-reasons',
        'advanced-injection-sync-diagnostics',
    ]),
    continuityTracking: Object.freeze([
        'advanced-continuity-overview',
        'advanced-continuity-scan',
        'advanced-continuity-automation',
        'advanced-continuity-scope',
        'advanced-continuity-custom-range',
        'advanced-continuity-performance',
        'advanced-continuity-tracked-sections',
        'advanced-continuity-scene-state',
        'advanced-continuity-active-characters',
        'advanced-continuity-items',
        'advanced-continuity-goals-threads',
        'advanced-continuity-emotional-freshness',
        'advanced-continuity-injection-link',
        'advanced-continuity-recovery',
    ]),
    creatorAuthoring: Object.freeze([
        'advanced-creator-create-deck',
        'advanced-creator-intake',
        'advanced-creator-brief',
        'advanced-creator-outline',
        'advanced-creator-title-pass',
        'advanced-creator-title-review',
        'advanced-creator-planning',
        'advanced-creator-planning-review',
        'advanced-creator-entry-draft',
        'advanced-creator-entry-auto-draft',
        'advanced-creator-draft-review',
        'advanced-creator-send-to-review',
        'advanced-creator-pending-review-link',
        'advanced-creator-current-task',
        'advanced-creator-generation-settings',
        'advanced-creator-project-shelf',
        'advanced-creator-project-manage',
        'advanced-creator-inspect-generated-pack',
        'advanced-creator-readiness-gate',
    ]),
    packHealth: Object.freeze([
        'advanced-health-center-open',
        'advanced-health-status',
        'advanced-health-issue-groups',
        'advanced-health-safe-repair',
        'advanced-health-manual-repair',
        'advanced-package-update',
        'advanced-package-local-mod-warning',
        'advanced-package-export-bundled',
        'advanced-package-export-custom',
        'advanced-generated-finalize-custom',
        'advanced-generated-export-readiness',
    ]),
    settingsDiagnostics: Object.freeze([
        'advanced-settings-provider-overview',
        'advanced-settings-provider-profile',
        'advanced-settings-endpoint-model',
        'advanced-settings-provider-test',
        'advanced-settings-current-model',
        'advanced-settings-generation',
        'advanced-settings-provider-presets',
        'advanced-settings-api-compat',
        'advanced-settings-theme-pack',
        'advanced-settings-icon-set',
        'advanced-settings-colors',
        'advanced-settings-diagnostics',
    ]),
    troubleshooting: Object.freeze([
        'advanced-troubleshoot-no-loredeck',
        'advanced-troubleshoot-wrong-context',
        'advanced-troubleshoot-no-suggestions',
        'advanced-troubleshoot-pending-stuck',
        'advanced-troubleshoot-no-injection',
        'advanced-troubleshoot-prompt-heavy',
        'advanced-troubleshoot-provider-failure',
        'advanced-troubleshoot-continuity-stale',
        'advanced-troubleshoot-package-duplicate',
        'advanced-troubleshoot-health-warnings',
        'advanced-troubleshoot-creator-failure',
        'advanced-troubleshoot-return-basic',
    ]),
});

function countRequiredGuideStepIds(requiredGroups = {}) {
    return Object.values(requiredGroups).reduce((sum, ids) => sum + ids.length, 0);
}

function assertRequiredGuideStepIds(mode, steps = [], requiredGroups = {}) {
    const stepIds = new Set(steps.map(step => step?.id).filter(Boolean));
    for (const [group, ids] of Object.entries(requiredGroups)) {
        for (const id of ids) {
            assert(stepIds.has(id), `${mode} walkthrough is missing required ${group} guide step: ${id}`);
        }
    }
}

function assertGuideStepMetadata(mode, steps = []) {
    for (const step of steps) {
        assert(typeof step?.id === 'string' && step.id.trim(), `${mode} walkthrough contains a step without an id.`);
        assert(typeof step?.target === 'string' && step.target.trim(), `${mode} walkthrough step ${step.id} is missing a target.`);
        assert(typeof step?.expected === 'string' && step.expected.trim(), `${mode} walkthrough step ${step.id} is missing expected-result copy.`);
        assert(typeof step?.when === 'string' && step.when.trim(), `${mode} walkthrough step ${step.id} is missing usage-timing copy.`);
        if (step.prepare) {
            assert(VALID_GUIDE_PREPARES.has(step.prepare), `${mode} walkthrough step ${step.id} declares unknown prepare action: ${step.prepare}`);
        }
    }
}

function assertGuideTargetsResolvable(steps = [], markedTargets = new Set()) {
    for (const step of steps) {
        const prepareIsValid = step?.prepare && VALID_GUIDE_PREPARES.has(step.prepare);
        for (const key of ['target', 'fallbackTarget']) {
            const target = step?.[key];
            if (!target) continue;
            assert(markedTargets.has(target) || prepareIsValid, `Walkthrough ${key} is not marked in the runtime UI and has no valid prepare action: ${target}`);
        }
    }
}

function assertDocSectionHeadings(docName, docSource = '', sections = []) {
    for (const section of sections) {
        assert(docSource.includes(`### ${section.label}`), `${docName} must document walkthrough module: ${section.label}`);
    }
}

function getCoverageLabel(mode, index) {
    const prefix = mode === 'advanced' ? 'A' : 'B';
    return `${prefix}${String(index + 1).padStart(2, '0')}`;
}

function collectMarkedTourTargets(source = '') {
    const targets = new Set();
    const pattern = /['"]([a-z][a-zA-Z0-9_-]*(?:\.[a-zA-Z0-9_-]+)+)['"]/g;
    const text = String(source || '');
    let index = text.indexOf('markTourTarget(');
    while (index >= 0) {
        const chunk = text.slice(index, index + 5000);
        for (const match of chunk.matchAll(pattern)) {
            targets.add(match[1]);
        }
        index = text.indexOf('markTourTarget(', index + 1);
    }
    return targets;
}

const harness = read(harnessPath);
const loredeckIndex = JSON.parse(read(loredeckIndexPath));
const panel = read(panelPath);
const libraryPanel = read(libraryPanelPath);
const loredecksTabPanel = read(loredecksTabPanelPath);
const lorecardsPanel = read(lorecardsPanelPath);
const contextPanel = read(contextPanelPath);
const settingsPanel = read(settingsPanelPath);
const runtimePanelSource = [
    panel,
    lorecardsPanel,
    libraryPanel,
    loredecksTabPanel,
    read(creatorPanelPath),
    read(healthPanelPath),
    contextPanel,
    settingsPanel,
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
const runtimeNavigation = read(runtimeNavigationPath);
const runtimeBasicReadiness = read(runtimeBasicReadinessPath);
const runtimeGuideContent = read(runtimeGuideContentPath);
const runtimeTour = read(runtimeTourPath);
const style = read(stylePath);
const settingsTemplate = read(settingsTemplatePath);
const liveSmoke = read(liveSmokePath);
const basicWorkflowDoc = read(basicWorkflowDocPath);
const advancedWorkflowDoc = read(advancedWorkflowDocPath);
const documentationIndex = read(documentationIndexPath);
const runtimeGuideModule = await import(pathToFileURL(runtimeGuideContentPath).href);
const basicGuideSteps = runtimeGuideModule.getRuntimeGuideSteps('basic');
const advancedGuideSteps = runtimeGuideModule.getRuntimeGuideSteps('advanced');
const basicGuideSections = runtimeGuideModule.getRuntimeGuideSections('basic');
const advancedGuideSections = runtimeGuideModule.getRuntimeGuideSections('advanced');

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
assert(runtimePanelSource.includes("tab.classList.add('saga-runtime-rail-tab-global')"), 'Loredecks shelf tab must keep a subtle global accent class.');
assert(runtimePanelSource.includes("divider.className = 'saga-runtime-rail-tab-divider'"), 'Loredecks shelf tab must be visually grouped with a thin divider.');
assert(!runtimePanelSource.includes("scope.textContent = 'Global'"), 'Loredecks shelf grouping must not add a visible Global text chip.');
assert(style.includes('.saga-runtime-rail-tab-global') && style.includes('.saga-runtime-rail-tab-divider'), 'Loredecks shelf grouping must have dedicated accent and divider styling.');
assert(style.includes('border-color: var(--saga-border') && style.includes('var(--saga-border-soft'), 'Loredecks shelf accent must reuse existing theme border variables.');
assert(!style.includes('2px 0 0 rgba(215, 181, 109') && !style.includes('2px 0 0 rgba(212, 200, 168'), 'Loredecks shelf accent must not use a left inset that visually offsets the tab.');
assert(/lorePanel:\s*\{[\s\S]*isOpen:\s*true,[\s\S]*collapsed:\s*false,[\s\S]*railMode:\s*'expanded',[\s\S]*drawerOpen:\s*true,/.test(constants), 'Fresh Saga installs must start with the expanded shelf and drawer open.');
assert(harness.includes('window.SillyTavern'), 'Harness must stub SillyTavern before importing modules.');
const basicTabsSource = runtimeNavigation.match(/BASIC_EXPERIENCE_TABS\s*=\s*Object\.freeze\(\[([^\]]*)\]\)/)?.[1] || '';
const tabLabelsSource = runtimeNavigation.match(/TAB_LABELS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/)?.[1] || '';
const basicVisibleTabs = new Set(parseSingleQuotedValues(basicTabsSource));
const advancedVisibleTabs = new Set([...tabLabelsSource.matchAll(/^\s*([a-zA-Z0-9_]+):/gm)].map(match => match[1]));
assert(basicTabsSource.includes("'session'") && basicTabsSource.includes("'loredecks'") && basicTabsSource.includes("'context'") && basicTabsSource.includes("'lore'") && basicTabsSource.includes("'settings'"), 'Basic Experience must keep the guided Session/Loredecks/Context/Lorecards/Settings tabs.');
assert(!basicTabsSource.includes("'injection'") && !basicTabsSource.includes("'continuity'"), 'Basic Experience must hide Injection and Continuity tabs.');
assert(runtimeNavigation.includes('export const ADVANCED_EXPERIENCE_TABS = Object.freeze(Object.keys(TAB_LABELS));'), 'Advanced Experience must continue exposing the full tab set.');
assert(!runtimeNavigation.includes('BASIC_TAB_LABELS') && !runtimeNavigation.includes('BASIC_TAB_TOOLTIPS'), 'Basic Experience must not rename shared Advanced tab labels.');
assert(runtimeNavigation.includes("session: 'Session'") && runtimeNavigation.includes("lore: 'Lorecards'"), 'Basic Experience must reuse Advanced Session and Lorecards labels.');
assert(runtimeNavigation.includes('function getTabLabelForExperience') && runtimeNavigation.includes('function getTabTooltipForExperience'), 'Runtime navigation must provide experience-aware tab label and tooltip helpers.');
assert(runtimePanelSource.includes('getTabLabelForExperience(tabId, settings)') && runtimePanelSource.includes('getTabTooltipForExperience(tabId, settings)'), 'Runtime rail must render experience-aware tab labels and tooltips.');
assert(llm.includes('export function getProviderModelStatus') && llm.includes('getConnectionProfileModelName'), 'Provider model display status must be resolved through the shared provider client.');
assert(runtimePanelSource.includes('function getSettingsProviderRailMetricLines') && runtimePanelSource.includes("settings: getSettingsProviderRailMetricLines(settings)") && runtimePanelSource.includes('saga-runtime-rail-metric-line') && !runtimePanelSource.includes("settings: getThemePreset(settings.themePackId)?.title || 'Theme'"), 'Settings shelf metric must show stacked compact provider model status instead of the active theme.');
assert(runtimePanelSource.includes('function getRailMetricTooltips') && runtimePanelSource.includes('getSettingsProviderRailTooltip(settings)'), 'Clipped Settings shelf model metrics must keep a full provider-model tooltip.');
assert(/\.saga-runtime-rail-metric\s*\{[\s\S]*flex: 0 1 auto;[\s\S]*max-width: 106px;[\s\S]*font-size: 0\.66em;/.test(style) && /\.saga-runtime-rail-expanded \.saga-runtime-rail-metric-stack\s*\{[\s\S]*align-items: stretch;[\s\S]*text-align: left;[\s\S]*transform: translateX\(-20px\);/.test(style) && style.includes('.saga-runtime-rail-metric-line + .saga-runtime-rail-metric-line'), 'Runtime rail metrics must stay shrinkable, left-aligned, and divided for stacked model/profile text.');
const basicGuideSource = runtimeGuideContent.split('basic: freezeGuideSteps([')[1]?.split('advanced: freezeGuideSteps(buildAdvancedGuideSteps())')[0] || '';
const advancedGuideSource = runtimeGuideContent.split('function buildAdvancedGuideSteps()')[1]?.split('export const GUIDE_SECTIONS')[0] || '';
const basicGuideStepCount = (basicGuideSource.match(/guideStep\(/g) || []).length;
const advancedGuideStepCount = (advancedGuideSource.match(/advancedStep\(/g) || []).length;
const markedTourTargets = collectMarkedTourTargets(runtimePanelSource);
assert(runtimeGuideContent.includes("title: 'Basic Walkthrough'") && runtimeGuideContent.includes("title: 'Advanced Walkthrough'"), 'Runtime guides must use Alpha walkthrough titles.');
assert(runtimeGuideContent.includes('GUIDE_SECTIONS') && runtimeGuideContent.includes("label: 'Loredecks'") && runtimeGuideContent.includes("label: 'Injection Diagnostics'"), 'Runtime guides must expose section walkthrough metadata.');
assert(runtimeTour.includes("dep('prepareGuideStep'") && runtimeTour.includes('prepareGuideStep(step)') && runtimeTour.includes('getTourStepPrepareAction(step)'), 'Runtime tour must run optional guide prepare actions before locating targets.');
assert(runtimeTour.includes('renderSagaTourPopover(step, target, prepareResult)') && runtimeTour.includes("appendSagaTourDetail(popover, 'Preparation'") && runtimeTour.includes('!target && !hasPrepare'), 'Prepared walkthrough steps must fall back to an explanatory centered popover instead of being skipped.');
assert(panel.includes('function prepareRuntimeGuideStep') && panel.includes('prepareGuideStep: prepareRuntimeGuideStep'), 'Runtime tour must receive concrete prepare handlers from the lore panel.');
for (const prepare of VALID_GUIDE_PREPARES) {
    assert(panel.includes(`case '${prepare}':`), `Runtime guide prepare action is missing a lore-panel handler: ${prepare}`);
}
assert(basicGuideSteps.length === basicGuideStepCount && advancedGuideSteps.length === advancedGuideStepCount, 'Runtime guide exports must include every source guideStep call.');
assert(basicGuideSteps.length >= countRequiredGuideStepIds(REQUIRED_BASIC_GUIDE_STEP_IDS), 'Basic guide must include all required workflow coverage steps.');
assert(advancedGuideSteps.length >= countRequiredGuideStepIds(REQUIRED_ADVANCED_GUIDE_STEP_IDS), 'Advanced guide must include all required workflow coverage steps.');
assert(advancedGuideSteps.length === 155, 'Advanced guide must implement the planned A01-A155 workflow coverage.');
assertRequiredGuideStepIds('Basic', basicGuideSteps, REQUIRED_BASIC_GUIDE_STEP_IDS);
assertRequiredGuideStepIds('Advanced', advancedGuideSteps, REQUIRED_ADVANCED_GUIDE_STEP_IDS);
assertGuideStepMetadata('Basic', basicGuideSteps);
assertGuideStepMetadata('Advanced', advancedGuideSteps);
assert(basicGuideSections.reduce((sum, section) => sum + section.stepCount, 0) === basicGuideSteps.length, 'Basic walkthrough sections must account for every exported step.');
assert(advancedGuideSections.reduce((sum, section) => sum + section.stepCount, 0) === advancedGuideSteps.length, 'Advanced walkthrough sections must account for every exported step.');
assert(basicGuideSections.map(section => section.id).join(',') === 'firstRun,loredecks,context,lore,continueRoleplay,settings', 'Basic guide cards must follow the planned First Run/Loredecks/Context/Lorecards/Continue Roleplay/Settings order.');
assert(advancedGuideSections.map(section => section.id).join(',') === 'libraryMastery,sessionControl,contextResolution,loreReview,injectionDiagnostics,continuityTracking,creatorAuthoring,packHealth,settingsDiagnostics,troubleshooting', 'Advanced guide cards must follow the planned workflow module order.');
assertDocSectionHeadings('Basic Workflow doc', basicWorkflowDoc, basicGuideSections);
assertDocSectionHeadings('Advanced Workflow doc', advancedWorkflowDoc, advancedGuideSections);
for (const [index, section] of advancedGuideSections.entries()) {
    const startLabel = getCoverageLabel('advanced', advancedGuideSteps.findIndex(step => step.id === section.steps[0]?.id));
    const endLabel = getCoverageLabel('advanced', advancedGuideSteps.findIndex(step => step.id === section.steps.at(-1)?.id));
    assert(advancedWorkflowDoc.includes(`Coverage: ${startLabel}-${endLabel}.`), `Advanced Workflow doc must document coverage range ${startLabel}-${endLabel} for ${section.label}.`);
    assert(index === 0 || advancedGuideSections[index - 1].steps.at(-1)?.id !== section.steps[0]?.id, `Advanced section ${section.label} must start at a unique walkthrough step.`);
}
assert(basicWorkflowDoc.includes('Basic does not show:') && basicWorkflowDoc.includes('Create Deck') && basicWorkflowDoc.includes('Injection tab controls'), 'Basic Workflow doc must document Basic exclusions.');
assert(basicWorkflowDoc.includes('Basic keeps **Import Deck** available.'), 'Basic Workflow doc must explicitly keep Import Deck in Basic.');
assert(!basicWorkflowDoc.includes('tab walkthroughs') && !advancedWorkflowDoc.includes('organized by tab'), 'Workflow docs must not describe the old tab-only walkthrough organization.');
assert(documentationIndex.includes('[Basic Workflow](user/BASIC_WORKFLOW.md)') && documentationIndex.includes('[Advanced Workflow](user/ADVANCED_WORKFLOW.md)'), 'Documentation index must link the Basic and Advanced workflow docs.');
assert(documentationIndex.includes('SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md') && documentationIndex.includes('B01-B49') && documentationIndex.includes('A01-A155'), 'Documentation index must link the walkthrough expansion plan with Basic and Advanced coverage ranges.');
for (const step of basicGuideSteps) {
    assert(basicVisibleTabs.has(step.tab), `Basic walkthrough step ${step.id} targets hidden tab: ${step.tab}`);
}
for (const step of advancedGuideSteps) {
    assert(advancedVisibleTabs.has(step.tab), `Advanced walkthrough step ${step.id} targets unknown tab: ${step.tab}`);
}
assertGuideTargetsResolvable([...basicGuideSteps, ...advancedGuideSteps], markedTourTargets);
assert(!basicGuideSource.includes("'injection'"), 'Basic guide steps must not target hidden Injection controls.');
assert(!basicGuideSource.includes("'continuity'"), 'Basic guide steps must not target hidden Continuity controls.');
assert(basicGuideSource.includes("'loredecks.library.open'") && basicGuideSource.includes("'context.commandCenter'") && basicGuideSource.includes("'lore.pending'") && basicGuideSource.includes("'settings.themePack'") && basicGuideSource.includes("'session.basicReadiness'"), 'Basic guide must route through Loredecks, Context, Lorecards, Settings, and the Start Checklist.');
assert(!basicGuideSource.includes('Advanced Context Brief') && !basicGuideSource.includes('Prompt Placement') && !basicGuideSource.includes('Auto-Relevance'), 'Basic guide must not expose advanced diagnostic, injection, or automation tour steps.');
assert(advancedGuideSource.includes("'injection'"), 'Advanced guide must retain Injection walkthrough targets.');
assert(runtimePanelSource.includes('getRuntimeGuideSections') && runtimePanelSource.includes('startSagaTour(mode, { sectionId: section.id })'), 'Runtime guide card must render module-level walkthrough starts.');
assert(runtimePanelSource.includes('formatGuideStartLabel') && runtimePanelSource.includes('guided stop'), 'Runtime guide cards must show each module starting point and guided stop count.');
assert(!runtimePanelSource.includes('showGuideStep(item'), 'Runtime guide card must not render one Show button per walkthrough target.');
assert(runtimePanelSource.includes('function createBasicStartReadinessCard'), 'Basic Session must render the Start Checklist dropdown.');
assert(/createBasicStartReadinessCard[\s\S]*createCollapsibleSection\(\s*'session\.basicReadiness'[\s\S]*true[\s\S]*'saga-basic-readiness-card'/.test(runtimePanelSource), 'Basic Session Start Checklist must be an expanded-by-default dropdown.');
assert(runtimePanelSource.includes('function getBasicReadinessModel'), 'Basic Session readiness must derive from runtime state.');
assert(runtimeBasicReadiness.includes('export function buildBasicReadinessModel') && runtimePanelSource.includes('buildBasicReadinessModel({'), 'Basic Session readiness decision order must live in the shared model helper.');
assert(!runtimePanelSource.includes('function createBasicInjectionSummaryCard') && !runtimePanelSource.includes('What Saga Will Send'), 'Basic Session must not render the selected-lore prompt summary.');
assert(!lorecardsPanel.includes('function createBasicReviewInjectionSummary') && !lorecardsPanel.includes('What Accepted Lorecards Do'), 'Basic Lorecards must not render the selected-lore prompt summary.');
assert(runtimePanelSource.includes('function createManualLorecardPanel') && runtimePanelSource.includes('openNewLoreDialog({ basicReview: isBasicExperience(getSettings()) })'), 'Manual Lorecard creation must live in the shared Lorecard Generation card and use the compact dialog only in Basic.');
assert(!constants.includes("'lore.basic.acceptedEntries'") && !constants.includes("'injection.basic."), 'Collapsed-section defaults must not keep retired Basic-only Lorecards or Injection section ids.');
assert(loredecksTabPanel.includes('function isBasicExperienceMode') && !loredecksTabPanel.includes('createBasicLoredeck'), 'Basic Loredecks must use the shared Loredecks tab with mode-gated Creator controls.');
assert(loredecksTabPanel.includes("'Loredeck Library'") && loredecksTabPanel.includes("'In-Progress Creator Projects'"), 'Loredecks tab must keep the shared Library section and Advanced Creator Projects section.');
assert(loredecksTabPanel.includes("createButton('Import Deck'") && basicGuideSource.includes("'loredecks.import'"), 'Basic Loredecks must keep Import Deck in the shared Library launch workflow.');
assert(/if \(!basic\)\s*\{[\s\S]*createLoredeckCreatorProjectShelf\(state, projectModels\)/.test(loredecksTabPanel), 'Basic Loredecks must hide the In-Progress Creator Projects shelf.');
assert(/if \(!basic\)\s*\{[\s\S]*createButton\('Create Deck'/.test(loredecksTabPanel), 'Basic Loredecks must hide the Create Deck launch action.');
assert(libraryPanel.includes('function isBasicExperienceMode') && /if \(!basic\)\s*\{[\s\S]*createButton\('Create Deck'/.test(libraryPanel), 'Basic Loredeck Library must hide the fullscreen Create Deck header action.');
assert(!style.includes('saga-basic-loredeck-stack-card') && !style.includes('saga-basic-loredeck-stack-row'), 'Basic Loredecks must not keep dedicated layout styling.');
assert(settingsPanel.includes('export function createBasicProviderQuickSetupCard') && settingsPanel.includes('function createBasicProviderQuickSetupRow'), 'Basic Settings must render a simplified Providers surface.');
assert(settingsPanel.includes('getProviderModelStatus') && settingsPanel.includes("createBasicProviderSummaryRow('Model'"), 'Basic provider setup must summarize the resolved model or fallback profile label.');
assert(settingsPanel.includes('Open Advanced Provider Settings') && settingsPanel.includes('Use Current Model') && settingsPanel.includes('Test ${cfg.shortTitle}'), 'Basic Providers must test providers and hand off to Advanced provider controls.');
assert(panel.includes("'settings.providers'") && panel.includes("'settings.themePack'") && !panel.includes("'settings.experienceMode'"), 'Basic Settings must expose Providers and Theme Pack without a redundant Experience Mode section.');
assert(!panel.includes('function createBasicAppearanceSettingsCard') && /if \(basic\)[\s\S]*'settings\.themePack'[\s\S]*createThemeSettingsCard\(settings\)/.test(panel), 'Basic Settings must render the same Theme Pack section as Advanced.');
assert(!panel.includes('function createBasicExperienceSettingsCard') && !style.includes('saga-basic-experience-switch-wrap'), 'Basic Settings must not keep a dedicated Experience Mode card.');
assert(panel.includes('function openAdvancedSettingsTab') && panel.includes('openAdvancedSettings: openAdvancedSettingsTab'), 'Basic Settings advanced handoffs must switch to the Advanced settings surface.');
assert(style.includes('saga-settings-basic-provider-card') && !style.includes('saga-basic-theme-swatches') && !style.includes('saga-basic-experience-switch-wrap'), 'Basic Settings must not keep retired Basic-only theme or Experience Mode styling.');
assert(!panel.includes('function renderBasicInjectionTab') && !panel.includes('function createBasicLoreTierInjectionCard') && !panel.includes("'injection.basic'"), 'Basic Experience must not keep a dedicated Basic Injection tab implementation.');
assert(!style.includes('saga-basic-injection-controls') && !style.includes('saga-basic-injection-mode-buttons') && !style.includes('saga-basic-injection-status'), 'Retired Basic Injection tab styling must not remain.');
assert(!lorecardsPanel.includes('function createBasicReviewActionsCard') && !style.includes('saga-basic-review-actions-card'), 'Basic Lorecards must not add a separate Basic-only actions card.');
assert(lorecardsPanel.includes('createPendingLoreReviewSection(state, { basicReview: basic })') && lorecardsPanel.includes('createAcceptedLoreEntriesSection(state, { basicReview: basic })'), 'Basic Lorecards must render pending and accepted sections through Basic-aware paths.');
assert(/if \(!basicReview\)\s*{\s*section\.appendChild\(createLoreWorkbenchLaunchRow/.test(lorecardsPanel) && /if \(!basicReview\)\s*{\s*section\.appendChild\(markTourTarget\(createPendingLoreBulkControls/.test(lorecardsPanel), 'Basic Lorecards must hide default workbench and pending bulk controls.');
assert(lorecardsPanel.includes('const filtered = basicReview ? getBasicAcceptedLoreEntries(state) : getFilteredLoreEntries(state);'), 'Basic accepted Lorecards must not inherit hidden Advanced filters.');
assert(style.includes('saga-basic-advanced-handoff') && style.includes('saga-basic-review-entry-card'), 'Basic Lorecards simplification must keep compact entry and Advanced handoff styling.');
assert(style.includes('saga-basic-readiness-card') && !style.includes('saga-basic-injection-summary-card'), 'Basic readiness styling must remain without selected-lore summary styling.');
assert(harness.includes('window.__sagaSmokeReady = true'), 'Harness must expose a smoke-ready marker.');
assert(harness.includes('new URLSearchParams(window.location.search)'), 'Harness must support query-param visual smoke variants.');
assert(harness.includes("smokeParams.get('tab')"), 'Harness must allow direct tab selection for targeted smoke tests.');
assert(harness.includes("const smokeMode = smokeParams.get('mode') === 'basic' ? 'basic' : 'advanced';"), 'Harness must allow direct Basic and Advanced smoke modes.');
assert(harness.includes("experienceMode: smokeMode"), 'Harness settings must honor the requested smoke mode.');
assert(harness.includes('window.__sagaSmokeMode = smokeMode'), 'Harness must expose requested smoke mode metadata.');
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
assert(runtimePanelSource.includes("'--saga-red-surface'"), 'Runtime themes must expose derived danger surface tokens.');
const workbenchThemeScope = style.match(/\.saga-lore-workbench-shell,\s*[\r\n]+\.saga-new-lore-shell\s*\{[\s\S]*?\}/)?.[0] || '';
assert(!workbenchThemeScope.includes('--saga-bg:'), 'Fullscreen workbench shells must not redeclare default theme tokens locally.');
assert(style.includes('var(--saga-red-surface'), 'Danger Zone and health danger surfaces must use runtime theme tokens.');
assert(!style.includes('border-color: rgba(190, 80, 80, 0.45) !important;'), 'Danger buttons must not use hardcoded late-cascade red borders.');
assert(!style.includes('background: rgba(120, 30, 38, 0.22) !important;'), 'Danger buttons must not use hardcoded late-cascade red backgrounds.');
assert(!style.includes('folder-cover-tile:nth-child(odd)'), 'Folder cover previews must not randomly tilt odd covers.');
assert(!style.includes('folder-cover-tile:nth-child(even)'), 'Folder cover previews must not randomly tilt even covers.');
assert(runtimePanelSource.includes('LOREDECK_LIBRARY_FOLDER_COVER_MAX_VISIBLE = 15'), 'Folder cover previews must cap visible deck covers at 15 before the overflow tile.');
assert(!read(libraryPanelPath).includes('slice(0, 20)'), 'Folder cover preview collection must not retain the old 20-cover cap.');
assert(runtimePanelSource.includes("getPropertyValue('--saga-folder-cover-size')"), 'Folder cover layout must read the current CSS cover size.');
assert(!runtimePanelSource.includes('LEGACY_ICONSET_ID'), 'Theme icon resolution must not reference the removed legacy icon set.');
assert(!runtimePanelSource.includes('Images/runtime-icons'), 'Runtime icon resolution must not reference the discontinued runtime icon folder.');
assert(!runtimePanelSource.includes('Drop support is queued'), 'Loredeck Library must not expose queued drop-support placeholder copy.');
assert(!runtimePanelSource.includes("['contents', 'Contents'"), 'Loredeck Library details must not expose the low-value Contents tab.');
assert(!runtimePanelSource.includes("['activation', 'Activation'"), 'Loredeck Library details must not expose the low-value Activation tab.');
assert(!runtimePanelSource.includes("createButton('Delete Folder'"), 'Folder details must not expose a redundant Delete Folder button.');
assert(!runtimePanelSource.includes("createButton('Remove', 'Remove this Loredeck from the current stack.'"), 'Loredeck details must not expose a redundant Remove button.');
assert(!runtimePanelSource.includes('createLoredeckLibraryCurrentViewHeader'), 'Loredeck Library must not render the obsolete current-view side-tree summary strip.');
assert(!style.includes('saga-loredeck-library-current-view'), 'Loredeck Library CSS must not keep obsolete current-view side-tree styles.');
assert(runtimePanelSource.includes('buildLoredeckPackScopedHealth'), 'Loredeck Library deck stats must scope aggregate stack health back to a single pack.');
assert(runtimePanelSource.includes('report?.databaseId === packId'), 'Loredeck Library deck counts must guard against aggregate stack report summaries.');
assert(!runtimePanelSource.includes('entryCount: Number(report.summary?.entryCount) || Number(loadedMeta?.entryCount)'), 'Loredeck Library deck counts must not prefer aggregate report entry totals over per-pack metadata.');
assert(runtimePanelSource.includes('function refreshLoredeckLibrarySelectionSurfaces'), 'Loredeck Library card selection must support in-place surface refreshes.');
assert(runtimePanelSource.includes('function refreshLoredeckLibrarySelectionHighlights'), 'Loredeck Library folder selection must update highlights before rebuilding heavier surfaces.');
assert(runtimePanelSource.includes('function scheduleLoredeckLibrarySelectionSurfaceRefresh'), 'Loredeck Library folder selection must schedule in-place surface refreshes.');
assert(constants.includes("selectedLoredeckId: ''"), 'New Saga installs must not preselect a Loredeck in the Library details panel.');
assert(runtimePanelSource.includes('No Loredecks or Folders Selected'), 'Loredeck Library details must show an explicit empty-selection state.');
assert(runtimePanelSource.includes('function clearLoredeckLibrarySelection'), 'Loredeck Library must provide a shared empty-space selection clear helper.');
assert(runtimePanelSource.includes('function wireLoredeckLibraryBlankSelectionClear'), 'Loredeck Library columns must clear selection when their blank space is clicked.');
assert(runtimePanelSource.includes('return selectedId ? (library.find(pack => pack.packId === selectedId) || null) : null;'), 'Loredeck Library details must not fall back to the first deck when nothing is selected.');
assert(style.includes('saga-loredeck-library-details-empty'), 'Loredeck Library empty-selection details panel must have centered styling.');
assert(style.includes('.saga-loredeck-library-details-empty .saga-lore-empty::before') && style.includes('.saga-loredeck-library-details-empty .saga-lore-empty::after'), 'Loredeck Library empty-selection label must use CSS divider lines instead of literal dashes.');
assert(runtimePanelSource.includes('source.originalType || pack.type || manifest.type') && runtimePanelSource.includes("kind: 'package_export'"), 'Loredeck package exporter must write original source type into package index metadata.');
assert(runtimePanelSource.includes('sourceInfo.originalType || indexRecord.originalType') && runtimePanelSource.includes("storageMode: 'bundled_manifest_reference'"), 'Loredeck package importer must use exported original type for lightweight bundled reimports.');
assert(runtimePanelSource.includes('requestAnimationFrame(() =>') && runtimePanelSource.includes('refreshLoredeckLibrarySelectionSurfaces();'), 'Loredeck Library folder selection refresh should defer heavier detail work to an animation frame.');
assert(runtimePanelSource.includes('scheduleLoredeckLibrarySelectionSurfaceRefresh();'), 'Loredeck Library folder clicks must use the in-place selection refresh path.');
assert(runtimePanelSource.includes('function scheduleLoredeckLibraryOverlayRefresh'), 'Loredeck Library stack/drop refreshes must support deferred overlay rebuilds.');
assert(runtimePanelSource.includes('refreshLoredeckSurfaces({ renderLibrary: false });') && runtimePanelSource.includes('scheduleLoredeckLibraryOverlayRefresh();'), 'Loredeck stack mutations must refresh drawer surfaces without immediately rebuilding the Library overlay.');
assert(runtimePanelSource.includes('refreshLoredeckLibrarySelectionSurfaces();') && runtimePanelSource.includes("overlay.querySelector('.saga-loredeck-library-pane-stack')"), 'Loredeck stack mutations must refresh the visible Active Stack pane before the deferred full overlay rebuild.');
assert(!runtimePanelSource.includes('addLoredecksToStack(actionIds);\n        renderLoredeckLibraryOverlay();'), 'Loredeck Library stack add button must not force an immediate duplicate overlay rebuild.');
assert(!runtimePanelSource.includes('addLoredecksToStack(packIds);\n        renderLoredeckLibraryOverlay();'), 'Loredeck Library stack drop handler must not rebuild before the drag release can paint.');
assert(!runtimePanelSource.includes("function commitLoredeckStackMutation(message, mutator)") && !runtimePanelSource.includes("commitLoredeckStackMutation(`Added"), 'Loredeck Library stack mutations must pass the mutator directly after snapshot-history removal.');
const retiredSnapshotApiName = 'pushState' + 'Snapshot';
const retiredTimelineHistoryKey = 'state' + 'History';
const retiredMemoHistoryKey = 'memo' + 'History';
assert(!stateManager.includes(retiredSnapshotApiName) && !runtimePanelSource.includes(retiredSnapshotApiName), 'Snapshot history helpers must stay removed from state and panel code.');
assert(!stateManager.includes(retiredTimelineHistoryKey) && !stateManager.includes(retiredMemoHistoryKey), 'Retired snapshot storage fields must not be persisted by state-manager.');
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
assert(/function renderContextTab[\s\S]*const basic = isBasicExperience\(settings\);[\s\S]*if \(!basic\) container\.appendChild\(createContextAdvancedBriefSection\(state\)\);/.test(panel), 'Basic Context must hide the Advanced Context Brief section.');
assert(panel.includes("'Set and audit where this chat sits inside each loaded Loredeck.'"), 'Basic Context header must use the shared Advanced Context header copy.');
assert(contextPanel.includes('function isBasicExperienceMode') && panel.includes('isBasicExperience: () => isBasicExperience(getSettings())'), 'Context panel must receive the active experience mode.');
assert(contextPanel.includes("'Runtime Context'") && contextPanel.includes('Browse Context'), 'Basic Context command center must use shared Advanced Context labels.');
assert(contextPanel.includes('Reasoner Proposals') && contextPanel.includes('Context Proposal Review') && contextPanel.includes('Review Proposals'), 'Basic Context proposals must use shared Advanced proposal labels.');
assert(/if \(!basic\)\s*{\s*const resolverActions/.test(contextPanel), 'Basic Context must hide Resolve Local and Ask Reasoner controls.');
assert(/if \(!basic\)\s*{\s*card\.appendChild\(createContextResolutionAuditPanel\(state\)\);\s*card\.appendChild\(createContextAutomationAuditPanel\(state\)\);/.test(contextPanel), 'Basic Context must hide resolver and automation audit panels.');
assert(/if \(!basic\)\s*{\s*actions\.appendChild\(createButton\(context\.manualLock \? 'Unlock' : 'Lock'/.test(contextPanel), 'Basic Loredeck Context rows must hide direct manual lock controls.');
assert(contextPanel.includes("createContextProposalReviewRow(proposal, { basic })") && contextPanel.includes("createButton('Apply', 'Apply this Context proposal.'"), 'Basic Context proposal review rows must use shared Apply wording.');
assert(panel.includes("label.textContent = 'Detector'"), 'Basic Context status row must use the shared Detector label.');
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
assert(style.includes('saga-context-brief-status'), 'Context Brief status row must have dedicated compact styling.');
assert(runtimePanelSource.includes("createKeyValue('Active chat', getActiveChatMetricName()"), 'Session Metrics must identify the active chat before showing counters.');
assert(harness.includes("chatName: 'Saga Smoke Harness Chat'"), 'Visual smoke harness must seed an active chat name for Session Metrics.');
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
assert(style.includes('saga-context-command-card'), 'Context command center must have dedicated layout styling.');
assert(style.includes('saga-context-automation-audit'), 'Context automation audit must have dedicated styling.');
assert(style.includes('saga-context-proposal-review-shell'), 'Context proposal review overlay must have dedicated shell styling.');
assert(style.includes('saga-context-proposal-review-row'), 'Context proposal review rows must have dedicated styling.');
assert(style.includes('saga-context-advanced-brief-content'), 'Advanced Context Brief content must have dedicated styling.');
assert(style.includes('saga-context-proposal-focus'), 'Context proposal review jump must have a visible focus animation.');
assert(style.includes('.saga-context-workbench-window-builder > .saga-primary-actions'), 'Context Workbench window-builder actions must use explicit grid placement.');
assert(liveSmoke.includes('SAGA_SMOKE_TARGET'), 'Live smoke helper must support targeted smoke modes.');
assert(liveSmoke.includes('REPO_LOCAL_HARNESS_TARGETS') && liveSmoke.includes("'guide-harness'"), 'Live smoke helper must support repo-local walkthrough guide smoke.');
assert(liveSmoke.includes('guide-harness-01-basic-card') && liveSmoke.includes('guide-harness-02-basic-module') && liveSmoke.includes('guide-harness-03-basic-prepared-library') && liveSmoke.includes('guide-harness-04-basic-tour'), 'Guide harness smoke must capture Basic guide card, focused module, prepared Library, and full tour screenshots.');
assert(liveSmoke.includes('guide-harness-05-advanced-card') && liveSmoke.includes('guide-harness-06-advanced-module') && liveSmoke.includes('guide-harness-07-advanced-creator-empty-project') && liveSmoke.includes('guide-harness-08-advanced-tour'), 'Guide harness smoke must capture Advanced guide card, focused module, no-object fallback, and full tour screenshots.');
assert(liveSmoke.includes('Start Basic Walkthrough') && liveSmoke.includes('Start Advanced Walkthrough'), 'Guide harness smoke must click both full walkthrough launch actions.');
assert(liveSmoke.includes('Loredecks as Source Packs') && liveSmoke.includes('Injection Overview'), 'Guide harness smoke must verify focused Basic and Advanced module start steps.');
assert(liveSmoke.includes('Basic Workflow Orientation') && liveSmoke.includes('Library Layout') && liveSmoke.includes('Creator Draft Review') && liveSmoke.includes('Library Overview'), 'Guide harness smoke must verify the expected Basic prepared Library, Creator fallback, and full-tour steps.');
assert(liveSmoke.includes('1 / 14') && liveSmoke.includes('3 / 14') && liveSmoke.includes('1 / 15') && liveSmoke.includes('11 / 19') && liveSmoke.includes('1 / 49') && liveSmoke.includes('1 / 155'), 'Guide harness smoke must verify Basic prepared, Creator fallback, Basic full, Advanced module, and Advanced full walkthrough progress counts.');
assert(liveSmoke.includes('saga-loredeck-library-overlay') && liveSmoke.includes('loredecks.library.header'), 'Guide harness smoke must verify prepared fullscreen Library targeting.');
assert(liveSmoke.includes('there is no in-progress Creator project to resume yet') && liveSmoke.includes('saga-loredeck-creator-workbench-overlay'), 'Guide harness smoke must verify no-object Creator fallback messaging.');
assert(liveSmoke.includes('hiddenActionButtons'), 'Guide harness smoke must guard Basic against Advanced-only action buttons.');
assert(liveSmoke.includes("SMOKE_TARGET === 'context-harness'"), 'Live smoke helper must support the repo-local Context harness target.');
assert(liveSmoke.includes('context-harness-01-proposal-review'), 'Context harness smoke must capture the proposal-review screenshot.');
assert(liveSmoke.includes('context-harness-02-workbench'), 'Context harness smoke must capture the Context Workbench screenshot.');
assert(liveSmoke.includes('#saga-context-workbench'), 'Context harness smoke must verify the Context Workbench opens.');
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
assert(style.includes('saga-loredeck-creator-stage-guide'), 'Creator roadmap must have dedicated styling.');
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
assert(runtimePanelSource.includes('saga-loredeck-creator-done-button'), 'Creator Context rows must show planned sets as compact Done controls.');
assert(style.includes('saga-loredeck-creator-done-button'), 'Creator Context Done controls must have a dedicated success style.');
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
assert(runtimePanelSource.includes('Export is available now. Pending or drafted material is reported here'), 'Generated export readiness must inform without blocking export.');
assert(!runtimePanelSource.includes('Generated Loredeck is not export-ready'), 'Selected export must not enforce Generated Loredeck readiness.');
assert(runtimePanelSource.includes('Export this Bundled Loredeck as a .saga-loredeck.zip package.'), 'Bundled Loredecks must remain exportable.');
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
    'saga-grip-dot-rows',
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
    'saga-loredeck-install-shell',
    'saga-runtime-rail',
    'saga-runtime-drawer',
    'saga-loredeck-creator-project-shelf',
    'saga-loredeck-creator-project-card',
    'saga-loredeck-creator-project-controls',
    'saga-loredeck-creator-project-search',
    'saga-loredeck-creator-project-filter',
    'saga-loredeck-creator-project-folder-filter',
    'saga-loredeck-creator-project-move-select',
    'saga-loredeck-creator-project-bulk',
    'saga-loredeck-creator-project-card-selected',
    'saga-loredeck-creator-project-progress',
    'saga-loredeck-creator-project-delete',
    'saga-loredeck-creator-project-select-active',
    'saga-loredeck-creator-pipeline-header',
    'saga-loredeck-creator-stage-guide',
    'saga-loredeck-creator-stage-active',
    'saga-loredeck-creator-stage-needs-review',
    'saga-loredeck-creator-current-task',
    'saga-loredeck-creator-current-sidebar',
    'saga-loredeck-creator-output-grid',
    'saga-loredeck-creator-artifact',
    'saga-loredeck-library-details',
    'saga-loredeck-library-resize-handle',
    'saga-loredeck-library-resize-track-left',
    'saga-loredeck-library-resize-label-arrow',
    'saga-loredeck-metadata-shell',
    'saga-loredeck-library-shell',
    'saga-loredeck-library-columns',
    'saga-loredeck-library-hierarchy-list',
    'saga-loredeck-library-title-meta',
    'saga-loredeck-library-details-collapsed',
    'saga-loredeck-library-inline-folder-row',
    'saga-loredeck-library-folder-cover-strip',
    'saga-loredeck-library-folder-cover-tile',
    'saga-loredeck-library-folder-row-drop-enabled',
    'saga-loredeck-library-folder-move-select',
    'saga-loredeck-library-folder-parent-control',
    'saga-loredeck-library-folder-actions',
    'saga-confirm-input',
    'saga-confirm-choice-list',
    'saga-loredeck-library-stack-folder-preview',
    'saga-loredeck-library-stack-disclosure-button',
    'saga-loredeck-library-stack-folder-card-has-suppressed',
    'saga-loredeck-library-stack-card-suppressed',
    'saga-loredeck-library-stack-duplicate-summary',
    'saga-loredeck-library-stack-folder-preview-chip-kept',
    'saga-loredeck-library-drag-copy',
    'saga-loredeck-library-drag-copy-remove',
    'saga-loredeck-library-drag-drop-invalid',
    'saga-loredeck-library-root-drop-active',
    'saga-loredeck-library-stack-remove-active',
    'saga-loredeck-library-search-match',
    'saga-loredeck-library-search-context',
    'saga-loredeck-library-transfer-footer',
    'saga-loredeck-library-stack-card',
    'saga-loredeck-library-stack-grip',
    'saga-loredeck-library-inline-title',
    'saga-loredeck-library-title-edit-action',
    'saga-loredeck-library-title-input',
    'saga-loredeck-library-stack-ghost',
    'saga-loredeck-library-center-actions',
    'saga-loredeck-library-square-action',
    'saga-loredeck-library-icon-action',
    'saga-loredeck-library-stack-toggle-button',
    'saga-loredeck-library-detail-kicker',
    'saga-loredeck-library-deck-card.saga-loredeck-library-deck-selected',
    'saga-loredeck-library-inline-folder-row.saga-loredeck-library-folder-row-active',
    'saga-loredeck-library-stack-card.saga-loredeck-library-stack-card-selected',
    'saga-lore-workbench-shell .saga-runtime-button',
    'saga-loredeck-health-center-shell',
    'saga-loredeck-health-severity-card',
    'saga-theme-top-grid',
    'saga-theme-gallery',
    'saga-theme-iconset-selector',
    'saga-theme-iconset-strip',
    'saga-theme-icon-grid',
    'saga-loredeck-library-visual-cover',
    'saga-loredeck-library-visual-cover::after',
    'border-radius: inherit',
    'scrollbar-gutter: stable',
]) {
    assert(style.includes(token), `Stylesheet is missing expected smoke selector: ${token}`);
}

assert(!style.includes('max-height: 160px;'), 'Folder details contained Loredeck list must expand with the resized details panel.');
assert(/\.saga-loredeck-library-details\s*\{[\s\S]*?height:\s*100%;/.test(style), 'Loredeck Library details panel must fill the resized details region.');
assert(/\.saga-loredeck-library-folder-detail-visual\s*\{[\s\S]*?align-self:\s*start;[\s\S]*?justify-self:\s*start;/.test(style), 'Folder detail cover previews must stay pinned to the top-left while details resize.');
assert(style.includes('display: inline-grid !important;') && style.includes('grid-area: 1 / 1;'), 'Loredeck Library square icon actions must center their SVG artwork.');
assert(style.includes('var(--saga-chip-bg') && style.includes('var(--saga-chip-fg'), 'Loredeck Library metadata/status pills must use theme chip tokens.');
assert(style.includes('calc(var(--saga-grip-dot-rows, 6) * 7px)'), 'Loredeck Library drag handles must size dot grids without clipping short 2x2 or 2x3 handles.');

console.log('Visual smoke harness contract passed.');
