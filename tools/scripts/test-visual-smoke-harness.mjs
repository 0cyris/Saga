import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const sourcePath = (...parts) => path.join(root, 'src', ...parts);
const harnessPath = path.join(root, 'tests', 'browser', 'visual-smoke.html');
const loredeckIndexPath = path.join(root, 'content', 'loredecks', 'index.json');
const panelPath = sourcePath('runtime', 'lore-panel.js');
const libraryPanelPath = sourcePath('loredecks', 'loredeck-library-panel.js');
const loredecksTabPanelPath = sourcePath('loredecks', 'loredecks-tab-panel.js');
const loredeckWorkbenchPanelPath = sourcePath('loredecks', 'loredeck-workbench-panel.js');
const loredeckUiKitPath = sourcePath('loredecks', 'loredeck-ui-kit.js');
const loredeckFilterControlsPath = sourcePath('loredecks', 'loredeck-filter-controls.js');
const loredeckSelectionToolbarPath = sourcePath('loredecks', 'loredeck-selection-toolbar.js');
const loredeckValidationViewPath = sourcePath('loredecks', 'loredeck-validation-view.js');
const loredeckJobViewPath = sourcePath('loredecks', 'loredeck-job-view.js');
const loredeckActionRowsPath = sourcePath('loredecks', 'loredeck-action-rows.js');
const lorecardsPanelPath = sourcePath('lorecards', 'lorecards-panel.js');
const loreTimelinePanelPath = sourcePath('lorecards', 'lore-timeline-panel.js');
const creatorPanelPath = sourcePath('loredecks', 'loredeck-creator-panel.js');
const creatorCoveragePath = sourcePath('loredecks', 'loredeck-creator-coverage.js');
const healthPanelPath = sourcePath('loredecks', 'loredeck-health-panel.js');
const continuityPanelPath = sourcePath('continuity', 'continuity-panel.js');
const injectionPanelPath = sourcePath('runtime', 'injection-preview-panel.js');
const contextPanelPath = sourcePath('context', 'context-panel.js');
const contextWorkbenchPanelPath = sourcePath('context', 'context-workbench-panel.js');
const settingsPanelPath = sourcePath('settings', 'settings-panel.js');
const runtimeSettingsTabPath = sourcePath('settings', 'runtime-settings-tab.js');
const themePanelPath = sourcePath('settings', 'theme-panel.js');
const themeActionsPath = sourcePath('settings', 'theme-actions.js');
const runtimeThemePath = sourcePath('theme', 'runtime-theme.js');
const runtimeUiKitPath = sourcePath('ui', 'runtime-ui-kit.js');
const runtimeActiveStackPanelPath = sourcePath('runtime', 'active-stack-panel.js');
const runtimeLoredeckGeneratedExportCardPath = sourcePath('runtime', 'loredeck-generated-export-card.js');
const runtimeLoredeckGeneratedReadinessPath = sourcePath('runtime', 'loredeck-generated-readiness.js');
const runtimeLoredeckEditorActionsPath = sourcePath('runtime', 'loredeck-editor-actions.js');
const runtimeLoredeckEntryOverridesPath = sourcePath('runtime', 'loredeck-entry-overrides-panel.js');
const runtimeLoredeckTimelineRegistryPath = sourcePath('runtime', 'loredeck-timeline-registry-panel.js');
const runtimeLoredeckTagManagerPath = sourcePath('runtime', 'loredeck-tag-manager-panel.js');
const runtimeLoredeckPendingReviewPath = sourcePath('runtime', 'loredeck-pending-review-panel.js');
const runtimeLoredeckAssistantReviewPath = sourcePath('runtime', 'loredeck-assistant-review-panel.js');
const runtimeLoredeckReviewHelpersPath = sourcePath('runtime', 'loredeck-review-helpers.js');
const runtimeLoredeckPendingChangeModelPath = sourcePath('runtime', 'loredeck-pending-change-model.js');
const runtimeLoredeckPendingChangeActionsPath = sourcePath('runtime', 'loredeck-pending-change-actions.js');
const runtimeLoredeckEditProposalsPath = sourcePath('runtime', 'loredeck-edit-proposals.js');
const runtimeLoredeckEditorFieldsPath = sourcePath('runtime', 'loredeck-editor-fields.js');
const runtimeLoredeckEditorLoaderPath = sourcePath('runtime', 'loredeck-editor-loader.js');
const runtimeLoredeckEditorValidationPath = sourcePath('runtime', 'loredeck-editor-validation.js');
const runtimeLoredeckManifestFormattersPath = sourcePath('runtime', 'loredeck-manifest-formatters.js');
const runtimeLoredeckManifestPreviewPath = sourcePath('runtime', 'loredeck-manifest-preview.js');
const runtimeLoredeckManifestPath = sourcePath('runtime', 'loredeck-manifest-runtime.js');
const runtimeLoredeckPackageExportPath = sourcePath('runtime', 'loredeck-package-export.js');
const runtimeLoredeckPackageHelpersPath = sourcePath('runtime', 'loredeck-package-helpers.js');
const runtimeLoredeckPackageInstallPath = sourcePath('runtime', 'loredeck-package-install.js');
const runtimeLoredeckPackageInstallPanelPath = sourcePath('runtime', 'loredeck-package-install-panel.js');
const runtimeLoredeckSourceSummaryPath = sourcePath('runtime', 'loredeck-source-summary.js');
const runtimeLoredeckVirtualDataPath = sourcePath('runtime', 'loredeck-virtual-data.js');
const runtimeCollapsiblePath = sourcePath('runtime', 'runtime-collapsible.js');
const runtimeSafetyPanelPath = sourcePath('runtime', 'runtime-safety-panel.js');
const runtimeFeatureProgressPath = sourcePath('runtime', 'runtime-feature-progress.js');
const runtimeLoreRegistryPath = sourcePath('runtime', 'runtime-lore-registry.js');
const runtimeRailMetricsPath = sourcePath('runtime', 'runtime-rail-metrics.js');
const runtimeShellPath = sourcePath('runtime', 'runtime-shell.js');
const runtimeShellViewPath = sourcePath('runtime', 'runtime-shell-view.js');
const runtimeTabRegistryPath = sourcePath('runtime', 'tab-registry.js');
const runtimeNavigationPath = sourcePath('runtime', 'runtime-navigation.js');
const runtimeBasicReadinessPath = sourcePath('runtime', 'runtime-basic-readiness.js');
const runtimeAdvancedPanelPath = sourcePath('runtime', 'advanced-runtime-panel.js');
const runtimeGuidePrepPath = sourcePath('runtime', 'runtime-guide-prep.js');
const runtimeSettingControlsPath = sourcePath('runtime', 'runtime-setting-controls.js');
const runtimeSessionBasicPanelPath = sourcePath('runtime', 'session-basic-panel.js');
const runtimeGuideContentPath = sourcePath('runtime', 'runtime-guide-content.js');
const runtimeTourPath = sourcePath('runtime', 'runtime-tour.js');
const assistantPath = sourcePath('loredecks', 'loredeck-assistant.js');
const llmClientPath = sourcePath('providers', 'lore-llm-client.js');
const creatorProjectsPath = sourcePath('loredecks', 'loredeck-creator-projects.js');
const stateManagerPath = sourcePath('state', 'state-manager.js');
const loreCreatorStatePath = sourcePath('state', 'lore-creator-state.js');
const loredeckLibraryStorePath = sourcePath('state', 'loredeck-library-store.js');
const themeLibraryStorePath = sourcePath('state', 'theme-library-store.js');
const constantsPath = sourcePath('state', 'constants.js');
const defaultSettingsPath = sourcePath('state', 'default-settings.js');
const defaultStatePath = sourcePath('state', 'default-state.js');
const stylePath = path.join(root, 'styles', 'saga.css');
const settingsTemplatePath = sourcePath('extension', 'settings.html');
const liveSmokePath = path.join(root, 'tools', 'scripts', 'smoke-live-st-cdp.mjs');
const basicWorkflowDocPath = path.join(root, 'docs', 'user', 'BASIC_WORKFLOW.md');
const advancedWorkflowDocPath = path.join(root, 'docs', 'user', 'ADVANCED_WORKFLOW.md');
const documentationIndexPath = path.join(root, 'docs', 'DOCUMENTATION_INDEX.md');
const sagaHeroIconPath = path.join(root, 'assets', 'iconsets', 'saga-hero', 'hero-tab-loredecks-256.png');
const sagaHeroManifestPath = path.join(root, 'assets', 'iconsets', 'saga-hero', 'icons.json');
const sagaMysticIconPath = path.join(root, 'assets', 'iconsets', 'saga-mystic', 'mystic-tab-loredecks-256.png');
const sagaMysticManifestPath = path.join(root, 'assets', 'iconsets', 'saga-mystic', 'icons.json');
const sagaRelayIconPath = path.join(root, 'assets', 'iconsets', 'saga-relay', 'relay-tab-loredecks-256.png');
const sagaRelayManifestPath = path.join(root, 'assets', 'iconsets', 'saga-relay', 'icons.json');
const hpCoreCoverPath = path.join(root, 'content', 'loredecks', 'hp-core', 'assets', 'cover.png');
const hpYearOneCoverPath = path.join(root, 'content', 'loredecks', 'hp-year-1-philosophers-stone', 'assets', 'cover.png');

function read(file) {
    return fs.readFileSync(file, 'utf8');
}

function readCssBundle(file, seen = new Set()) {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) return '';
    seen.add(resolved);
    const source = read(resolved);
    const dir = path.dirname(resolved);
    const imports = [];
    source.replace(/@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/g, (_match, importPath) => {
        imports.push(path.resolve(dir, importPath));
        return _match;
    });
    return [source, ...imports.map(importFile => readCssBundle(importFile, seen))].join('\n');
}

function listJsFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...listJsFiles(file));
        else if (/\.(js|mjs)$/.test(entry.name)) files.push(file);
    }
    return files;
}

function getLineNumber(source, index) {
    return source.slice(0, index).split(/\r?\n/).length;
}

function skipQuoted(source, index, quote) {
    for (let i = index + 1; i < source.length; i += 1) {
        if (source[i] === '\\') {
            i += 1;
            continue;
        }
        if (source[i] === quote) return i;
    }
    return source.length - 1;
}

function skipTemplate(source, index) {
    for (let i = index + 1; i < source.length; i += 1) {
        if (source[i] === '\\') {
            i += 1;
            continue;
        }
        if (source[i] === '`') return i;
        if (source[i] === '$' && source[i + 1] === '{') {
            i += 2;
            let depth = 1;
            for (; i < source.length; i += 1) {
                if (source[i] === '"' || source[i] === "'") {
                    i = skipQuoted(source, i, source[i]);
                    continue;
                }
                if (source[i] === '`') {
                    i = skipTemplate(source, i);
                    continue;
                }
                if (source[i] === '\\') {
                    i += 1;
                    continue;
                }
                if (source[i] === '{') depth += 1;
                else if (source[i] === '}') {
                    depth -= 1;
                    if (depth === 0) break;
                }
            }
        }
    }
    return source.length - 1;
}

function countTopLevelCommas(source) {
    let depth = 0;
    let commas = 0;
    for (let i = 0; i < source.length; i += 1) {
        const char = source[i];
        if (char === '"' || char === "'") {
            i = skipQuoted(source, i, char);
            continue;
        }
        if (char === '`') {
            i = skipTemplate(source, i);
            continue;
        }
        if (char === '(' || char === '{' || char === '[') depth += 1;
        else if (char === ')' || char === '}' || char === ']') depth = Math.max(0, depth - 1);
        else if (char === ',' && depth === 0) commas += 1;
    }
    return commas;
}

function findUntypedChipWrapperCalls(source, functionName) {
    const calls = [];
    const prefix = `${functionName}(`;
    let searchIndex = 0;
    while (true) {
        const start = source.indexOf(prefix, searchIndex);
        if (start < 0) break;
        let depth = 1;
        let end = start + prefix.length;
        for (; end < source.length; end += 1) {
            const char = source[end];
            if (char === '"' || char === "'") {
                end = skipQuoted(source, end, char);
                continue;
            }
            if (char === '`') {
                end = skipTemplate(source, end);
                continue;
            }
            if (char === '(' || char === '{' || char === '[') depth += 1;
            else if (char === ')' || char === '}' || char === ']') {
                depth -= 1;
                if (depth === 0) break;
            }
        }
        if (depth === 0) {
            const args = source.slice(start + prefix.length, end);
            if (countTopLevelCommas(args) < 2) calls.push(getLineNumber(source, start));
            searchIndex = end + 1;
        } else {
            searchIndex = start + prefix.length;
        }
    }
    return calls;
}

function findUntypedStatusPills(source) {
    return findUntypedChipWrapperCalls(source, 'createStatusPill');
}

function findUntypedBadges(source) {
    return findUntypedChipWrapperCalls(source, 'createBadge');
}

function getUntypedStatusPillCalls() {
    const calls = [];
    for (const file of listJsFiles(sourcePath())) {
        const lines = findUntypedStatusPills(read(file));
        for (const line of lines) calls.push(`${path.relative(root, file)}:${line}`);
    }
    return calls;
}

function getUntypedBadgeCalls() {
    const calls = [];
    for (const file of listJsFiles(sourcePath())) {
        const lines = findUntypedBadges(read(file));
        for (const line of lines) calls.push(`${path.relative(root, file)}:${line}`);
    }
    return calls;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cssRuleDeclares(source, selector, properties = []) {
    const prop = new RegExp(`(?:^|\\n)\\s*(?:${properties.map(escapeRegex).join('|')})\\s*:`, 'm');
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    return [...String(source || '').matchAll(rule)].some(match => {
        const selectors = String(match[1] || '').split(',').map(part => part.trim());
        return selectors.includes(selector) && prop.test(match[2] || '');
    });
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
        'basic-context-workbench-loredeck',
        'basic-context-anchors-windows',
        'basic-context-start-window',
        'basic-context-use-anchor',
        'basic-context-after-before',
        'basic-context-phrase-resolver',
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
        'advanced-context-workbench-layout',
        'advanced-context-workbench-pack',
        'advanced-context-anchors-windows',
        'advanced-context-start-here',
        'advanced-context-use-window',
        'advanced-context-use-anchor',
        'advanced-context-after-before',
        'advanced-context-timeline-action',
        'advanced-context-manual-select',
        'advanced-context-phrase-resolver',
        'advanced-context-phrase-debug',
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
const loreTimelinePanel = read(loreTimelinePanelPath);
const creatorPanel = read(creatorPanelPath);
const creatorCoverage = read(creatorCoveragePath);
const continuityPanel = read(continuityPanelPath);
const injectionPanel = read(injectionPanelPath);
const contextPanel = read(contextPanelPath);
const contextWorkbenchPanel = read(contextWorkbenchPanelPath);
const settingsPanel = read(settingsPanelPath);
const loredeckWorkbenchPanel = read(loredeckWorkbenchPanelPath);
const loredeckUiKit = read(loredeckUiKitPath);
const loredeckFilterControls = read(loredeckFilterControlsPath);
const loredeckSelectionToolbar = read(loredeckSelectionToolbarPath);
const loredeckValidationView = read(loredeckValidationViewPath);
const loredeckJobView = read(loredeckJobViewPath);
const loredeckActionRows = read(loredeckActionRowsPath);
const healthPanel = read(healthPanelPath);
const runtimeSettingsTab = read(runtimeSettingsTabPath);
const runtimeActiveStackPanel = read(runtimeActiveStackPanelPath);
const runtimeLoredeckGeneratedExportCard = read(runtimeLoredeckGeneratedExportCardPath);
const runtimeLoredeckGeneratedReadiness = read(runtimeLoredeckGeneratedReadinessPath);
const runtimeLoredeckEditorActions = read(runtimeLoredeckEditorActionsPath);
const runtimeLoredeckEntryOverrides = read(runtimeLoredeckEntryOverridesPath);
const runtimeLoredeckTimelineRegistry = read(runtimeLoredeckTimelineRegistryPath);
const runtimeLoredeckTagManager = read(runtimeLoredeckTagManagerPath);
const runtimeLoredeckPendingReview = read(runtimeLoredeckPendingReviewPath);
const runtimeLoredeckAssistantReview = read(runtimeLoredeckAssistantReviewPath);
const runtimeLoredeckReviewHelpers = read(runtimeLoredeckReviewHelpersPath);
const runtimeLoredeckPendingChangeModel = read(runtimeLoredeckPendingChangeModelPath);
const runtimeLoredeckPendingChangeActions = read(runtimeLoredeckPendingChangeActionsPath);
const runtimeLoredeckEditProposals = read(runtimeLoredeckEditProposalsPath);
const runtimeLoredeckEditorFields = read(runtimeLoredeckEditorFieldsPath);
const runtimeLoredeckEditorLoader = read(runtimeLoredeckEditorLoaderPath);
const runtimeLoredeckEditorValidation = read(runtimeLoredeckEditorValidationPath);
const runtimeLoredeckManifestFormatters = read(runtimeLoredeckManifestFormattersPath);
const runtimeLoredeckManifestPreview = read(runtimeLoredeckManifestPreviewPath);
const runtimeLoredeckManifest = read(runtimeLoredeckManifestPath);
const runtimeLoredeckPackageExport = read(runtimeLoredeckPackageExportPath);
const runtimeLoredeckPackageHelpers = read(runtimeLoredeckPackageHelpersPath);
const runtimeLoredeckPackageInstall = read(runtimeLoredeckPackageInstallPath);
const runtimeLoredeckPackageInstallPanel = read(runtimeLoredeckPackageInstallPanelPath);
const runtimeLoredeckSourceSummary = read(runtimeLoredeckSourceSummaryPath);
const runtimeLoredeckVirtualData = read(runtimeLoredeckVirtualDataPath);
const runtimeAdvancedPanel = read(runtimeAdvancedPanelPath);
const runtimeGuidePrep = read(runtimeGuidePrepPath);
const runtimeSessionBasicPanel = read(runtimeSessionBasicPanelPath);
const runtimeSafetyPanel = read(runtimeSafetyPanelPath);
const runtimeFeatureProgress = read(runtimeFeatureProgressPath);
const runtimeLoreRegistry = read(runtimeLoreRegistryPath);
const runtimeRailMetrics = read(runtimeRailMetricsPath);
const runtimeShell = read(runtimeShellPath);
const runtimeShellView = read(runtimeShellViewPath);
const runtimeTabRegistry = read(runtimeTabRegistryPath);
const runtimeSettingControls = read(runtimeSettingControlsPath);
const runtimeUiKit = read(runtimeUiKitPath);
const themePanel = read(themePanelPath);
const runtimeTheme = read(runtimeThemePath);
const runtimePanelSource = [
    panel,
    runtimeActiveStackPanel,
    runtimeLoredeckGeneratedExportCard,
    runtimeLoredeckGeneratedReadiness,
    runtimeLoredeckEditorActions,
    runtimeLoredeckEntryOverrides,
    runtimeLoredeckTimelineRegistry,
    runtimeLoredeckTagManager,
    runtimeLoredeckPendingReview,
    runtimeLoredeckAssistantReview,
    runtimeLoredeckReviewHelpers,
    runtimeLoredeckPendingChangeModel,
    runtimeLoredeckPendingChangeActions,
    runtimeLoredeckEditProposals,
    runtimeLoredeckEditorFields,
    runtimeLoredeckEditorLoader,
    runtimeLoredeckEditorValidation,
    runtimeLoredeckManifestFormatters,
    runtimeLoredeckManifestPreview,
    runtimeLoredeckManifest,
    runtimeLoredeckPackageExport,
    runtimeLoredeckPackageHelpers,
    runtimeLoredeckPackageInstall,
    runtimeLoredeckPackageInstallPanel,
    runtimeLoredeckSourceSummary,
    runtimeLoredeckVirtualData,
    runtimeAdvancedPanel,
    runtimeGuidePrep,
    runtimeSessionBasicPanel,
    runtimeSafetyPanel,
    runtimeFeatureProgress,
    runtimeLoreRegistry,
    runtimeRailMetrics,
    runtimeShell,
    runtimeShellView,
    runtimeTabRegistry,
    runtimeSettingControls,
    lorecardsPanel,
    libraryPanel,
    loredecksTabPanel,
    loredeckWorkbenchPanel,
    loredeckUiKit,
    loredeckFilterControls,
    loredeckSelectionToolbar,
    loredeckValidationView,
    loredeckJobView,
    loredeckActionRows,
    read(creatorPanelPath),
    healthPanel,
    continuityPanel,
    injectionPanel,
    contextPanel,
    contextWorkbenchPanel,
    settingsPanel,
    runtimeSettingsTab,
    themePanel,
    read(themeActionsPath),
    runtimeTheme,
    runtimeUiKit,
    read(runtimeCollapsiblePath),
].join('\n');
const assistant = read(assistantPath);
const llm = read(llmClientPath);
const creatorProjects = read(creatorProjectsPath);
const loreGenerator = read(sourcePath('lorecards', 'lore-generator.js'));
const extractor = read(sourcePath('continuity', 'extractor.js'));
const stateManager = read(stateManagerPath);
const loreCreatorState = read(loreCreatorStatePath);
const loredeckLibraryStore = read(loredeckLibraryStorePath);
const themeLibraryStore = read(themeLibraryStorePath);
const stateSource = [stateManager, loreCreatorState, loredeckLibraryStore].join('\n');
const constants = read(constantsPath);
const defaultSettings = read(defaultSettingsPath);
const defaultState = read(defaultStatePath);
const defaultSource = [constants, defaultSettings, defaultState].join('\n');
const runtimeNavigation = read(runtimeNavigationPath);
const runtimeBasicReadiness = read(runtimeBasicReadinessPath);
const runtimeGuideContent = read(runtimeGuideContentPath);
const runtimeTour = read(runtimeTourPath);
const style = readCssBundle(stylePath);
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

assert(harness.includes("import { showLorePanel } from '../../src/runtime/lore-panel.js';"), 'Harness must import the real runtime panel.');
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
assert(/lorePanel:\s*\{[\s\S]*isOpen:\s*true,[\s\S]*collapsed:\s*true,[\s\S]*railMode:\s*'compact',[\s\S]*drawerOpen:\s*false,/.test(defaultState), 'Fresh Saga installs must show the runtime shelf while keeping the drawer closed.');
assert(defaultState.includes('hasOpenedRuntime: false') && defaultState.includes('launcherDismissed: false'), 'Fresh Saga installs must track first-open/onboarding separately from panel visibility.');
assert(runtimePanelSource.includes('state.lorePanel.hasOpenedRuntime = true') && runtimePanelSource.includes('state.lorePanel.firstOpenedAt') && runtimePanelSource.includes('state.lorePanel.lastOpenedAt'), 'Opening the runtime must stamp first-open state separately from isOpen.');
assert(runtimePanelSource.includes("focused: 'Chapter Lens (balanced)'"), 'Creator granularity labels must pair mystical names with plain descriptors.');
assert(runtimePanelSource.includes('Balanced default. Best for one arc, season, book section, or scenario;'), 'Creator granularity blurbs must explain practical scope plainly.');
assert(runtimeUiKit.includes('export function createChip') && runtimeUiKit.includes('export function setChipTone') && runtimeUiKit.includes('inferChipKindFromLabel') && runtimeUiKit.includes('saga-chip-kind-${kind}') && runtimeUiKit.includes('saga-chip-tone-${tone}') && runtimeUiKit.includes('chip.dataset.sagaChipTone = tone'), 'Runtime UI kit must expose shared semantic chip helpers with inferred kind/tone metadata.');
assert(style.includes('--saga-chip-font-size-compact: 10px') && style.includes('--saga-chip-line-height-compact: 14px') && style.includes('--saga-chip-padding-compact: 0 4px') && style.includes('.saga-chip-tone-review') && style.includes('.saga-chip-tone-danger') && style.includes('.saga-chip-tone-tag') && style.includes('font-size: var(--saga-chip-font-size-compact, 10px)') && style.includes('font-weight: 400;'), 'Runtime stylesheet must define smaller regular-weight semantic chip tokens and tones.');
assert(style.includes('.saga-status-pill') && !/\\.saga-status-pill,\\s*\\n\\.saga-runtime-card/.test(style), 'Theme token layer must not force status pills to share card surface styling.');
const untypedStatusPills = getUntypedStatusPillCalls();
assert(untypedStatusPills.length === 0, `Status pills must pass chip schema options. Untyped calls: ${untypedStatusPills.slice(0, 12).join(', ')}`);
const untypedBadges = getUntypedBadgeCalls();
assert(untypedBadges.length === 0, `Lore badges must pass chip schema options. Untyped calls: ${untypedBadges.slice(0, 12).join(', ')}`);
const legacyChipSource = [
    style,
    panel,
    libraryPanel,
    loredecksTabPanel,
    healthPanel,
    contextWorkbenchPanel,
    runtimeUiKit,
    lorecardsPanel,
    loreTimelinePanel,
    runtimeLoreRegistry,
    runtimeLoredeckReviewHelpers,
].join('\n');
assert(!/saga-status-pill-(?:risk|quality|health)|saga-provider-status-(?:ready|warning)|saga-loredeck-health-chip(?:-[a-z0-9-]+)?|saga-loredeck-creator-project-stage-(?:review|running|warning|success)|saga-loredeck-library-folder-loredeck-health-(?:error|warning|ok)|saga-loredeck-library-stack-folder-preview-(?:chip-(?:active|suppressed|disabled|kept)|health-chip(?:-[a-z0-9-]+)?)|saga-loredeck-library-drag-copy-(?:invalid|root|remove)|saga-loredeck-library-deck-side|saga-lore-badge-(?:character|event|item|knowledge|place|faction|spell|artifact|divergent|fanon|unknown|true|false|public-belief|contested|hidden|public|private|do-not-reveal|only-if-knower-present|only-if-user-reveals|muted|pinned|canon|au|secret|rumor|lie|relationship|location|rule|timeline|truth|pending|priority|source|source-detail|context|context-match|date-gate|context-unresolved|context-blocked|clickable)/.test(legacyChipSource), 'Migrated chips must not reintroduce legacy text-derived badge/status-palette classes.');
assert(!runtimeUiKit.includes('getLoreBadgeClass') && !runtimeLoreRegistry.includes('applyLoreRegistryStyle') && !lorecardsPanel.includes('applyLoreRegistryStyle'), 'Chip color semantics must route through shared tone/kind classes, not text-derived or registry inline style helpers.');
const migratedChipBridgeSelectors = [
    '.saga-lore-badge',
    '.saga-lore-badge-saga-meta',
    '.saga-lore-tag-chip',
    '.saga-lore-timeline-ref-chip',
    '.saga-lore-timeline-event-counts',
    '.saga-continuity-filter-chip',
    '.saga-continuity-status',
    '.saga-lore-registry-badge',
    '.saga-lore-workbench-count',
    '.saga-lore-meta-select-wrap',
    '.saga-lore-lifecycle-select-wrap',
    '.saga-instructions-section-header .saga-status-pill',
    '.saga-context-workbench-resolver-score',
    '.saga-canon-preview-selected-count',
    '.saga-loredeck-creator-project-stage',
    '.saga-loredeck-library-stack-folder-preview-chip',
    '.saga-loredeck-library-folder-loredeck-entry-count',
    '.saga-loredeck-library-folder-loredeck-health',
    '.saga-loredeck-library-drag-copy',
    '.saga-loredeck-library-detail-kicker',
    '.saga-loredeck-health-card .saga-status-pill',
    '.saga-loredeck-health-center-overlay .saga-status-pill',
    '.saga-theme-accessibility-score',
    '.saga-theme-icon-status',
    '.saga-provider-runtime-status',
    '.saga-prompt-sync-status-value',
    '.saga-preset-status-stat-value',
    '.saga-loredeck-creator-side-value',
    '.saga-loredeck-creator-queue-value',
    '.saga-loredeck-creator-diagnostic-value',
    '.saga-loredeck-creator-generation-toggle-value',
];
for (const selector of migratedChipBridgeSelectors) {
    assert(!cssRuleDeclares(style, selector, ['background', 'border', 'border-color', 'color']), `${selector} must stay layout-only; shared chip tone classes own color, fill, and border.`);
    assert(!cssRuleDeclares(style, selector, ['font-size', 'font-weight', 'line-height', 'padding', 'padding-inline', 'padding-left', 'padding-right', 'border-radius', 'min-height', 'height']), `${selector} must not restate chip density; shared chip density classes own size, padding, radius, and typography.`);
}
assert(!style.includes('.saga-lore-panel-badge'), 'Unused legacy lore panel badge class must not return.');
assert(!style.includes('.saga-continuity-filter-chip-active') && !legacyChipSource.includes('--wl-chip-color'), 'Lore Timeline filter chips must use selected/muted schema tones instead of local chip color variables.');
assert(!cssRuleDeclares(style, '.saga-lore-meta-select', ['height', 'min-height', 'border-radius', 'padding', 'font-size', 'font-weight', 'line-height']) && !/\.saga-lore-meta-select\s*\{[^}]*background:\s*rgba/.test(style), 'Editable metadata dropdowns must let the schema chip wrapper own density and visible fill.');
assert(!cssRuleDeclares(style, '.saga-lore-lifecycle-select', ['height', 'min-height', 'border-radius', 'padding', 'font-size', 'font-weight', 'line-height']) && !/\.saga-lore-lifecycle-select\s*\{[^}]*background:\s*rgba/.test(style), 'Editable lifecycle dropdowns must let the schema chip wrapper own density and visible fill.');
assert(lorecardsPanel.includes("className: 'saga-lore-workbench-count'") && contextWorkbenchPanel.includes("className: 'saga-lore-workbench-count'") && !/(?:count|filterCount)\.className = 'saga-lore-workbench-count'/.test(`${lorecardsPanel}\n${contextWorkbenchPanel}`), 'Lorecard and Context workbench count indicators must render through schema-backed count chips.');
assert(loreTimelinePanel.includes("className: 'saga-continuity-status'") && loreTimelinePanel.includes("className: 'saga-lore-timeline-event-counts'") && !/status\.className = 'saga-continuity-status'|counts\.className = 'saga-lore-timeline-event-counts'/.test(loreTimelinePanel), 'Lore Timeline summary and event counts must render through schema-backed count chips.');
assert(contextWorkbenchPanel.includes('createContextWorkbenchResolverScorePill') && !/score\.className = 'saga-context-workbench-resolver-score'/.test(contextWorkbenchPanel), 'Context resolver score bubbles must render through schema-backed status pills.');
assert(panel.includes("className: 'saga-canon-preview-selected-count'") && panel.includes('setChipTone(count') && !/count\.className = 'saga-canon-preview-selected-count'/.test(panel), 'Canon Preview selected count must render through a schema chip and update semantic tone directly.');
assert(libraryPanel.includes("createStatusPill('', 'Current Loredeck drag action.'") && libraryPanel.includes('setChipTone(label') && !/saga-loredeck-library-drag-copy-(?:invalid|root|remove)/.test(libraryPanel), 'Loredeck Library drag-copy feedback must render through a schema chip and update semantic tone directly.');
assert(/saga-loredeck-library-root-drop-active::before[\s\S]{0,520}var\(--saga-chip-warning-border/.test(style) && /saga-loredeck-library-stack-remove-active::before[\s\S]{0,220}var\(--saga-chip-danger-border/.test(style), 'Loredeck Library pseudo drag/drop labels must use shared semantic chip token colors.');
assert(/function createLoredeckLibraryDetailKicker[\s\S]{0,220}createStatusPill/.test(libraryPanel), 'Loredeck Library detail kicker must render through a schema-backed status pill.');
assert(themePanel.includes('function createThemeAccessibilityRow') && themePanel.includes('const score = createStatusPill(') && themePanel.includes("className: 'saga-theme-accessibility-score'"), 'Theme accessibility score chips must render through schema-backed status pills.');
assert(themePanel.includes("className: 'saga-theme-icon-status'") && !/status\.className = 'saga-theme-icon-status'/.test(themePanel), 'Theme Icon Set coverage status must render through a schema-backed status pill.');
assert(!settingsPanel.includes('saga-provider-status-ready') && !settingsPanel.includes('saga-provider-status-warning'), 'Provider setup status pills must rely on shared success/warning schema tones without local palette suffix classes.');
assert(settingsPanel.includes('function createProviderRuntimeStatusPill') && settingsPanel.includes('updateProviderRuntimeStatusPill(modelStatus') && !/saga-provider-runtime-status';[\s\S]{0,140}(?:textContent|appendChild\(status\))/.test(settingsPanel), 'Provider runtime model/key statuses must render through schema-backed status pills.');
assert(injectionPanel.includes('function createPromptInjectionStatusRow') && injectionPanel.includes("className: 'saga-prompt-sync-status-value'") && injectionPanel.includes('setChipTone(value') && !/row\?\.querySelector\('\.saga-value'\)/.test(injectionPanel), 'Prompt injection sync status value must render through a schema-backed status pill and update tone in place.');
assert(/function createCompactPresetStat[\s\S]{0,520}createStatusPill/.test(runtimeUiKit) && !/function createCompactPresetStat[\s\S]{0,360}document\.createElement\('strong'\)/.test(runtimeUiKit), 'Provider preset compact stats must render value chips through schema-backed status pills.');
assert(creatorPanel.includes('function createLoredeckCreatorSideValueChip') && creatorPanel.includes("className: options.className || 'saga-loredeck-creator-side-value'") && !/saga-loredeck-creator-side-row[\s\S]{0,260}document\.createElement\('strong'\)/.test(creatorPanel), 'Loredeck Creator sidebar metadata values must render through schema-backed status pills.');
assert(creatorPanel.includes("className: 'saga-loredeck-creator-queue-value'") && creatorPanel.includes("className: 'saga-loredeck-creator-diagnostic-value'") && !/saga-loredeck-creator-(?:queue|diagnostic)-row[\s\S]{0,260}document\.createElement\('strong'\)/.test(creatorPanel), 'Loredeck Creator queue and diagnostic values must render through schema-backed status pills.');
assert(panel.includes("className: 'saga-loredeck-creator-generation-toggle-value'") && panel.includes('setChipTone(state') && !/createLoredeckCreatorGenerationToggleRow[\s\S]{0,520}document\.createElement\('strong'\)/.test(panel), 'Loredeck Creator generation toggle states must render through schema-backed status pills and update semantic tone directly.');
assert(loredecksTabPanel.includes("tone: chip.tone") && loredecksTabPanel.includes("kind: chip.label?.match"), 'Creator project shelf must render model chip tone metadata.');
assert(creatorProjects.includes('createProjectChipDescriptor') && !creatorProjects.includes('function createChip('), 'Creator project models must produce chip descriptors without shadowing the shared createChip DOM helper.');
assert(lorecardsPanel.includes("createChip({") && lorecardsPanel.includes("className: 'saga-lore-tag-chip'"), 'Lorecard tag rows must render through the shared chip helper.');
assert(!/saga-loredeck-creator-project-stage[\s\S]{0,260}border-radius:\s*999px/.test(style), 'Creator project stage chips must not use legacy full-pill radius styling.');
assert(/\.saga-loredeck-creator-project-card\s*\{[\s\S]*var\(--saga-border-soft/.test(style) && /\.saga-loredeck-creator-project-card-selected\s*\{[\s\S]*var\(--saga-border-strong/.test(style) && /saga-loredeck-creator-project-progress span\s*\{[\s\S]*var\(--saga-gold-soft/.test(style), 'Creator project cards and progress bars must adopt active Theme Pack surface, border, and accent tokens.');
assert(/\.saga-lore-entry-card\s*\{[\s\S]*background:\s*var\(--saga-surface-2[\s\S]*border:\s*1px solid var\(--saga-border-soft/.test(style) && /\.saga-lore-panel \.saga-accepted-lore-section \.saga-accepted-lore-scroll-region\s*\{[\s\S]*scrollbar-color:\s*var\(--saga-border-strong[\s\S]*var\(--saga-input/.test(style) && !/saga-accepted-lore-scroll-region[\s\S]{0,520}scrollbar-color:\s*rgba/.test(style), 'Accepted Lorecard list cards and scrollbars must follow active Theme Pack surface, border, accent, and input tokens.');
assert(/\.saga-loredeck-creator-stage-guide\s*\{[\s\S]*border:\s*1px solid var\(--saga-border-soft[\s\S]*linear-gradient\(135deg,\s*var\(--saga-bg-gradient-start/.test(style)
    && /\.saga-loredeck-creator-current-task\s*\{[\s\S]*var\(--saga-gold-surface[\s\S]*linear-gradient\(135deg,\s*var\(--saga-surface/.test(style)
    && /\.saga-generation-live-status-error\s*\{[\s\S]*border-color:\s*var\(--saga-red-soft[\s\S]*background:\s*linear-gradient\(135deg,\s*var\(--saga-red-surface/.test(style)
    && !/\.saga-generation-live-status-error\s*\{[\s\S]{0,260}background:\s*linear-gradient\(135deg,\s*rgba/.test(style), 'Loredeck Creator stage guide, current task, and generation status rows must use active Theme Pack surfaces and danger tokens.');
assert(!cssRuleDeclares(style, '.saga-loredeck-health-card .saga-status-pill', ['font-size']) && !cssRuleDeclares(style, '.saga-loredeck-health-center-overlay .saga-status-pill', ['font-size']), 'Pack Health status chips must not override the compact chip font with legacy tiny/large em sizing.');
assert(defaultState.includes('stateSafety:') && defaultSettings.includes("'settings.stateSafety'"), 'Default state and settings collapse map must expose State Safety.');
assert(runtimePanelSource.includes('createStateSafetyCard') && runtimePanelSource.includes("'settings.stateSafety'"), 'Advanced settings must render the State Safety backup/export/restore card.');
assert(runtimePanelSource.includes('before_loredeck_package_import') && runtimePanelSource.includes('before_total_reset'), 'Destructive import and reset actions must create State Safety backups.');
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
assert(settingsPanel.includes('confirmProviderDirectApiKeyStorage') && settingsPanel.includes('fallback obfuscation, not encryption') && !settingsPanel.includes('compatibility encryption'), 'Provider settings must warn before direct API key storage and must not describe fallback storage as encryption.');
assert(runtimePanelSource.includes('function getSettingsProviderRailMetricLines') && runtimePanelSource.includes("settings: getSettingsProviderRailMetricLines(settings)") && runtimePanelSource.includes('saga-runtime-rail-metric-line') && !runtimePanelSource.includes("settings: getThemePreset(settings.themePackId)?.title || 'Theme'"), 'Settings shelf metric must show stacked compact provider model status instead of the active theme.');
assert(runtimePanelSource.includes('function getRailMetricTooltips') && runtimePanelSource.includes('getSettingsProviderRailTooltip(settings)'), 'Clipped Settings shelf model metrics must keep a full provider-model tooltip.');
assert(!runtimePanelSource.includes('truncateRailMetricText'), 'Settings shelf model names must rely on CSS ellipsis instead of fixed character-count truncation.');
const stackedRailMetricRule = style.match(/\.saga-runtime-rail-metric-line \+ \.saga-runtime-rail-metric-line\s*\{[^}]*\}/)?.[0] || '';
assert(/\.saga-runtime-rail-metric\s*\{[\s\S]*flex: 0 1 auto;[\s\S]*max-width: 106px;[\s\S]*font-size: 0\.66em;/.test(style) && /\.saga-runtime-rail-expanded \.saga-runtime-rail-metric-stack\s*\{[\s\S]*align-items: flex-start;[\s\S]*text-align: left;[\s\S]*transform: translateX\(-5px\);/.test(style) && /\.saga-runtime-rail-metric-line\s*\{[\s\S]*display: inline-block;[\s\S]*box-sizing: border-box;/.test(style) && stackedRailMetricRule.includes('margin-top: 2px;') && !stackedRailMetricRule.includes('border-top'), 'Runtime rail metrics must stay shrinkable, left-aligned, and stacked without a visual divider between model/profile text.');
const basicGuideSource = runtimeGuideContent.split('basic: freezeGuideSteps([')[1]?.split('advanced: freezeGuideSteps(buildAdvancedGuideSteps())')[0] || '';
const advancedGuideSource = runtimeGuideContent.split('function buildAdvancedGuideSteps()')[1]?.split('export const GUIDE_SECTIONS')[0] || '';
const basicGuideStepCount = (basicGuideSource.match(/guideStep\(/g) || []).length;
const advancedGuideStepCount = (advancedGuideSource.match(/advancedStep\(/g) || []).length;
const markedTourTargets = collectMarkedTourTargets(runtimePanelSource);
assert(runtimeGuideContent.includes("title: 'Basic Walkthrough'") && runtimeGuideContent.includes("title: 'Advanced Walkthrough'"), 'Runtime guides must use Alpha walkthrough titles.');
assert(runtimeGuideContent.includes('GUIDE_SECTIONS') && runtimeGuideContent.includes("label: 'Loredecks'") && runtimeGuideContent.includes("label: 'Injection Diagnostics'"), 'Runtime guides must expose section walkthrough metadata.');
assert(runtimeTour.includes("dep('prepareGuideStep'") && runtimeTour.includes('prepareGuideStep(step)') && runtimeTour.includes('getTourStepPrepareAction(step)'), 'Runtime tour must run optional guide prepare actions before locating targets.');
assert(runtimeTour.includes('renderSagaTourPopover(step, target, prepareResult)') && runtimeTour.includes("appendSagaTourDetail(popover, 'Preparation'") && runtimeTour.includes('!target && !hasPrepare'), 'Prepared walkthrough steps must fall back to an explanatory centered popover instead of being skipped.');
assert(runtimePanelSource.includes('function prepareRuntimeGuideStep') && panel.includes('prepareGuideStep: prepareRuntimeGuideStep'), 'Runtime tour must receive concrete prepare handlers from the runtime guide prep module.');
for (const prepare of VALID_GUIDE_PREPARES) {
    assert(runtimePanelSource.includes(`case '${prepare}':`), `Runtime guide prepare action is missing a runtime handler: ${prepare}`);
}
assert(basicGuideSteps.length === basicGuideStepCount && advancedGuideSteps.length === advancedGuideStepCount, 'Runtime guide exports must include every source guideStep call.');
assert(basicGuideSteps.length >= countRequiredGuideStepIds(REQUIRED_BASIC_GUIDE_STEP_IDS), 'Basic guide must include all required workflow coverage steps.');
assert(advancedGuideSteps.length >= countRequiredGuideStepIds(REQUIRED_ADVANCED_GUIDE_STEP_IDS), 'Advanced guide must include all required workflow coverage steps.');
assert(advancedGuideSteps.length === 165, 'Advanced guide must implement the planned A01-A165 workflow coverage.');
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
assert(documentationIndex.includes('SAGA_WALKTHROUGH_WORKFLOW_EXPANSION_PLAN.md') && documentationIndex.includes('B01-B55') && documentationIndex.includes('A01-A165'), 'Documentation index must link the walkthrough expansion plan with Basic and Advanced coverage ranges.');
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
assert(basicGuideSource.includes("'context.workbench.storyPosition'") && basicGuideSource.includes("'context.workbench.startHere'") && basicGuideSource.includes("'context.workbench.useWindow'") && basicGuideSource.includes("'context.workbench.after'") && basicGuideSource.includes("'context.workbench.phraseResolver'"), 'Basic guide must teach Context Workbench anchors/windows, Start Here, Use Window, After/Before, and Phrase Resolver.');
assert(basicGuideSource.includes("'context.proposals.review'") && contextPanel.includes("'context.proposals.review'"), 'Basic Context proposal review must target the Review Proposals button when it is present.');
assert(!basicGuideSource.includes('Advanced Context Brief') && !basicGuideSource.includes('Prompt Placement') && !basicGuideSource.includes('Auto-Relevance'), 'Basic guide must not expose advanced diagnostic, injection, or automation tour steps.');
assert(advancedGuideSource.includes("'injection'"), 'Advanced guide must retain Injection walkthrough targets.');
assert(advancedGuideSource.includes("'context.workbench.timelineAction'") && advancedGuideSource.includes("'context.workbench.phraseResolverInput'") && advancedGuideSource.includes("'context.workbench.resolverLoadLorecards'") && advancedGuideSource.includes('ignored direction words'), 'Advanced guide must teach Context Workbench Timeline actions, Phrase Resolver input, and resolver diagnostics.');
assert(advancedGuideSource.includes("'context.resolve.local'") && advancedGuideSource.includes("'context.resolve.reasoner'") && advancedGuideSource.includes("'context.proposals.review'") && advancedGuideSource.includes("'context.loadedLoredeck.lock'") && advancedGuideSource.includes("'context.loadedLoredeck.seedFromBrief'") && advancedGuideSource.includes("'context.loadedLoredeck.reset'"), 'Advanced guide must target concrete Context action buttons instead of broad cards for resolver, proposal, lock, seed, and reset prompts.');
assert(runtimePanelSource.includes('getRuntimeGuideSections') && runtimePanelSource.includes('startRuntimeWalkthrough(mode, { sectionId: section.id })'), 'Runtime guide card must render module-level walkthrough starts through the walkthrough handoff.');
assert(runtimeTour.includes('export function startSagaTourSteps') && runtimeTour.includes('progressLabel') && runtimeTour.includes('closeLabel') && runtimeTour.includes('getFinishLabel') && runtimeTour.includes('onFinish') && runtimeTour.includes('onClose'), 'Runtime tour must support custom checklist mini-tour sequences.');
assert(runtimePanelSource.includes('formatGuideStartLabel') && runtimePanelSource.includes('guided stop'), 'Runtime guide cards must show each module starting point and guided stop count.');
assert(!runtimePanelSource.includes('showGuideStep(item'), 'Runtime guide card must not render one Show button per walkthrough target.');
assert(panel.includes("from './session-basic-panel.js'") && panel.includes('configureSessionBasicPanel({') && runtimePanelSource.includes('createBasicStartReadinessCard(state, settings)'), 'Runtime shell must compose the extracted Basic Session panel.');
assert(runtimePanelSource.includes('function createBasicStartReadinessCard'), 'Basic Session must render the Start Checklist dropdown.');
assert(/createBasicStartReadinessCard[\s\S]*createCollapsibleSection\(\s*'session\.basicReadiness'[\s\S]*true[\s\S]*'saga-basic-readiness-card'/.test(runtimePanelSource), 'Basic Session Start Checklist must be an expanded-by-default dropdown.');
assert(runtimePanelSource.includes('function getBasicReadinessModel'), 'Basic Session readiness must derive from runtime state.');
assert(!defaultSource.includes('guidedTask') && !stateManager.includes('guidedTask'), 'Runtime panel state must not keep retired in-panel checklist strip state.');
const basicChecklistTourBlock = (runtimePanelSource.split('const BASIC_CHECKLIST_REVIEW_GENERATION_STEPS')[1] || '').split('function getBasicChecklistTourConfig')[0] || '';
assert(runtimePanelSource.includes('BASIC_CHECKLIST_TOUR_TASKS_BY_ROW') && runtimePanelSource.includes('function launchBasicChecklistTour') && runtimePanelSource.includes('startSagaTourSteps(steps'), 'Basic Start Checklist actions must launch external checklist mini-tours.');
assert(!/\bLorepacks?\b/.test(basicChecklistTourBlock), 'Basic Start Checklist mini-tour copy must use Loredeck terminology.');
assert(runtimePanelSource.includes("progressLabel: 'Start Checklist'") && runtimePanelSource.includes("closeLabel: 'Close'") && runtimePanelSource.includes('onClose: returnToBasicStartChecklist'), 'Checklist mini-tours must use the external tour popover and a clear close affordance.');
assert(runtimePanelSource.includes('function getNextBasicChecklistTourRow') && runtimePanelSource.includes('function finishBasicChecklistTour') && runtimePanelSource.includes('getFinishLabel: () => getBasicChecklistTourFinishLabel(row)') && runtimePanelSource.includes('onFinish: () => finishBasicChecklistTour(row)'), 'Checklist mini-tours must continue to the next outstanding checklist item before showing Done.');
assert(runtimePanelSource.includes("'loredecks.library.open'") && runtimePanelSource.includes("'loredecks.library.folderDisclosure'") && runtimePanelSource.includes("'loredecks.library.deckCard'") && runtimePanelSource.includes("'loredecks.library.transfer'") && runtimePanelSource.includes("'loredecks.library.done'"), 'Loredeck checklist mini-tour must walk through Library open, folder expansion, Loredeck selection, stack transfer, and Done controls.');
assert(libraryPanel.includes("markTourTarget(disclosure, 'loredecks.library.folderDisclosure')") && libraryPanel.includes("markTourTarget(card, 'loredecks.library.deckCard')"), 'Loredeck Library must expose concrete checklist anchors for folder disclosure and Loredeck rows.');
assert(runtimePanelSource.includes("'context.browser'") && runtimePanelSource.includes("'context.workbench.loadedLoredeck'") && runtimePanelSource.includes("'context.workbench.storyPosition'") && runtimePanelSource.includes("'context.workbench.applyContext'") && runtimePanelSource.includes("'context.loadedLoredecks'"), 'Context checklist mini-tour must open the Context Workbench and target manual browsing/selection controls before Lorecards.');
assert(!basicChecklistTourBlock.includes("'context.detect'"), 'Basic Start Checklist Browse Context path must not substitute automatic detection for manual first-time context selection.');
assert(contextWorkbenchPanel.includes("markTourTarget(row, 'context.workbench.loadedLoredeck')") && contextWorkbenchPanel.includes("'context.workbench.applyContext'") && contextWorkbenchPanel.includes("'context.workbench.startHere'") && contextWorkbenchPanel.includes("'context.workbench.useWindow'") && contextWorkbenchPanel.includes("'context.workbench.phraseResolver'"), 'Context Workbench must expose concrete checklist anchors for loaded Loredeck rows, Context actions, and Phrase Resolver.');
assert(contextPanel.includes("'context.resolve.local'") && contextPanel.includes("'context.resolve.reasoner'") && contextPanel.includes("'context.proposals.review'") && contextPanel.includes("'context.loadedLoredeck.lock'") && contextPanel.includes("'context.loadedLoredeck.seedFromBrief'") && contextPanel.includes("'context.loadedLoredeck.reset'"), 'Context panel must mark concrete buttons used by the Advanced walkthrough.');
assert(contextWorkbenchPanel.includes("'context.workbench.resolveFromContext'") && contextWorkbenchPanel.includes("'context.workbench.resolveWithReasoner'") && contextWorkbenchPanel.includes("'context.workbench.openSelectedTimeline'") && contextWorkbenchPanel.includes("'context.workbench.storyPositionFind'") && contextWorkbenchPanel.includes("'context.workbench.loadEvents'") && contextWorkbenchPanel.includes("'context.workbench.lockRange'") && contextWorkbenchPanel.includes("'context.workbench.clearSelection'") && contextWorkbenchPanel.includes("'context.workbench.phraseUseContext'") && contextWorkbenchPanel.includes("'context.workbench.phraseClear'") && contextWorkbenchPanel.includes("'context.workbench.resolverLoadLorecards'"), 'Context Workbench must mark redesigned action buttons mentioned by walkthrough copy and helper text.');
assert(contextWorkbenchPanel.includes('createContextWorkbenchStoryPositionPicker') && contextWorkbenchPanel.includes('getContextWorkbenchStoryPositionQuery') && contextWorkbenchPanel.includes('saga-context-workbench-story-position-row') && contextWorkbenchPanel.includes("'context.workbench.storyPosition'"), 'Context Workbench picker internals must use story-position naming.');
assert(!contextWorkbenchPanel.includes('createContextWorkbenchWaypointBrowser') && !contextWorkbenchPanel.includes('getContextWorkbenchWaypointQuery') && !contextWorkbenchPanel.includes('saga-context-workbench-waypoint') && !contextWorkbenchPanel.includes("'context.workbench.waypoints'"), 'Context Workbench must not keep retired waypoint picker internals.');
assert(style.includes('.saga-context-workbench-story-position-picker') && style.includes('.saga-context-workbench-story-position-row'), 'Context Workbench story-position picker styles must be present.');
assert(!style.includes('.saga-context-workbench-waypoint'), 'Retired Context Workbench waypoint selectors must not remain in CSS.');
assert(runtimePanelSource.includes("'lore.canon.preview'") && runtimePanelSource.includes("'lore.story.scan'") && runtimePanelSource.includes("'lore.manual.add'") && runtimePanelSource.includes("'lore.pending.actions'"), 'Lorecard checklist mini-tour must guide generation, manual add, pending review, and apply/dismiss actions.');
assert(runtimePanelSource.includes("'settings.provider.utility'") && runtimePanelSource.includes("'settings.provider.reasoning'") && runtimePanelSource.includes("'settings.provider.test'") && runtimePanelSource.includes("'settings.provider.advanced'"), 'Provider checklist mini-tour must target concrete Basic provider rows and handoff controls.');
assert(!runtimePanelSource.includes('createBasicGuidedTaskStrip') && !runtimePanelSource.includes('saga-guided-task-highlight') && !style.includes('.saga-basic-guided-task-strip'), 'Retired in-panel guided task strip implementation must not remain active.');
assert(style.includes('.saga-checklist-tour-popover') && style.includes('.saga-tour-highlight'), 'Checklist mini-tours must reuse the external tour highlight surface with checklist-specific styling.');
assert(/\.saga-floating-tooltip\s*\{[\s\S]*z-index:\s*2147483647;/.test(style) && /\.saga-tour-popover\s*\{[\s\S]*z-index:\s*2147483000;/.test(style), 'Floating tooltips must render above the external tour popover.');
assert(runtimeBasicReadiness.includes('export function buildBasicReadinessModel') && runtimePanelSource.includes('buildBasicReadinessModel({'), 'Basic Session readiness decision order must live in the shared model helper.');
assert(!runtimePanelSource.includes('function createBasicInjectionSummaryCard') && !runtimePanelSource.includes('What Saga Will Send'), 'Basic Session must not render the selected-lore prompt summary.');
assert(!lorecardsPanel.includes('function createBasicReviewInjectionSummary') && !lorecardsPanel.includes('What Accepted Lorecards Do'), 'Basic Lorecards must not render the selected-lore prompt summary.');
assert(runtimePanelSource.includes('function createManualLorecardPanel') && runtimePanelSource.includes('openNewLoreDialog({ basicReview: isBasicExperience(getSettings()) })'), 'Manual Lorecard creation must live in the shared Lorecard Generation card and use the compact dialog only in Basic.');
assert(!defaultSettings.includes("'lore.basic.acceptedEntries'") && !defaultSettings.includes("'injection.basic."), 'Collapsed-section defaults must not keep retired Basic-only Lorecards or Injection section ids.');
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
assert(/function saveProviderSetting[\s\S]*saveSettings\(next\);[\s\S]*refreshRuntimeHeader\(\);[\s\S]*if \(options\.refresh !== false\)/.test(settingsPanel), 'Provider setting saves must update runtime rail/header metrics even when field-level saves skip panel rerender.');
assert(runtimePanelSource.includes("'settings.providers'") && runtimePanelSource.includes("'settings.themePack'") && !runtimePanelSource.includes("'settings.experienceMode'"), 'Basic Settings must expose Providers and Theme Pack without a redundant Experience Mode section.');
assert(!runtimePanelSource.includes('function createBasicAppearanceSettingsCard') && /if \(basic\)[\s\S]*'settings\.themePack'[\s\S]*createThemeSettingsCard\(settings\)/.test(runtimePanelSource), 'Basic Settings must render the same Theme Pack section as Advanced.');
assert(!runtimePanelSource.includes('function createBasicExperienceSettingsCard') && !style.includes('saga-basic-experience-switch-wrap'), 'Basic Settings must not keep a dedicated Experience Mode card.');
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
assert(runtimeTheme.includes("['Chip Metadata', 'themeChipNeutralColor', 'chipNeutral']") && runtimeTheme.includes("['Chip Warning', 'themeChipWarningColor', 'chipWarning']"), 'Runtime themes must expose Theme Pack color fields for metadata chip tones.');
assert(runtimeTheme.includes("target.style.setProperty('--saga-chip-neutral-bg', hexToRgba(colors.chipNeutral, 0.08))") && runtimeTheme.includes("target.style.setProperty('--saga-chip-warning-border', hexToRgba(colors.chipWarning, 0.32))"), 'Runtime themes must derive quiet chip fill/border CSS tokens from Theme Pack chip colors.');
assert(runtimeTheme.includes("merged.chipSuccess = merged.chipSuccess || '#b9d8b8'") && runtimeTheme.includes("merged.chipDanger = merged.chipDanger || '#e1a0a0'"), 'Incomplete Theme Packs must fall back to readable chip foreground colors instead of dark status surfaces.');
assert(defaultSettings.includes("themeChipNeutralColor: '#d8c6a3'") && defaultSettings.includes("themeChipWarningColor: '#e0c184'"), 'Default settings must include warm Saga Archive metadata chip color overrides.');
assert(themePanel.includes("createThemeColorGroup('Metadata Chips'") && themePanel.includes("['Source / Tag', 'themeChipSourceColor', 'chipSource']"), 'Theme settings must expose a Metadata Chips color group.');
assert(themeLibraryStore.includes("'chipNeutral'") && themeLibraryStore.includes("'chipDanger'"), 'Theme Pack import/export sanitization must preserve metadata chip color keys.');
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
assert(defaultState.includes("selectedLoredeckId: ''"), 'New Saga installs must not preselect a Loredeck in the Library details panel.');
assert(runtimePanelSource.includes('No Loredecks or Folders Selected'), 'Loredeck Library details must show an explicit empty-selection state.');
assert(runtimePanelSource.includes('function clearLoredeckLibrarySelection'), 'Loredeck Library must provide a shared empty-space selection clear helper.');
assert(runtimePanelSource.includes('function wireLoredeckLibraryBlankSelectionClear'), 'Loredeck Library columns must clear selection when their blank space is clicked.');
assert(runtimePanelSource.includes('return selectedId ? (library.find(pack => pack.packId === selectedId) || null) : null;'), 'Loredeck Library details must not fall back to the first deck when nothing is selected.');
assert(style.includes('saga-loredeck-library-details-empty'), 'Loredeck Library empty-selection details panel must have centered styling.');
assert(style.includes('.saga-loredeck-library-details-empty .saga-lore-empty::before') && style.includes('.saga-loredeck-library-details-empty .saga-lore-empty::after'), 'Loredeck Library empty-selection label must use CSS divider lines instead of literal dashes.');
assert(runtimePanelSource.includes('source.originalType || pack.type || manifest.type') && runtimePanelSource.includes("kind: 'package_export'"), 'Loredeck package exporter must write original source type into package index metadata.');
assert(runtimeLoredeckPackageExport.includes('sourceInfo.originalType || fresh.type || source.manifest.type'), 'Loredeck package exporter manifest metadata must preserve original source type before current library type.');
assert(runtimePanelSource.includes('sourceInfo.originalType || indexRecord.originalType') && runtimePanelSource.includes("storageMode: 'bundled_manifest_reference'"), 'Loredeck package importer must use exported original type for lightweight bundled reimports.');
assert(loredeckLibraryStore.includes('importedPackIds.push(packId)') && loredeckLibraryStore.includes('skippedPackIds.push(packId)'), 'Loredeck library import must report exact imported and skipped pack IDs.');
assert(runtimeLoredeckPackageInstallPanel.includes('new Set(Array.isArray(result.importedPackIds) ? result.importedPackIds : [])'), 'Loredeck package install panel must use imported pack IDs instead of selected rows when caching installed decks.');
assert(runtimeLoredeckPackageInstallPanel.includes('No Custom Loredecks were installed from package.') && runtimeLoredeckPackageInstallPanel.includes('Installed ${installedCount} Custom Loredeck'), 'Loredeck package install toast must report the actual imported count, including zero-install skips.');
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
assert(/function renderContextTab[\s\S]*const basic = isBasicExperienceMode\(\);[\s\S]*if \(!basic\) container\.appendChild\(createContextAdvancedBriefSection\(state\)\);/.test(runtimePanelSource), 'Basic Context must hide the Advanced Context Brief section.');
assert(runtimePanelSource.includes("'Set and audit where this chat sits inside each loaded Loredeck.'"), 'Basic Context header must use the shared Advanced Context header copy.');
assert(contextPanel.includes('function isBasicExperienceMode') && panel.includes('isBasicExperience: () => isBasicExperience(getSettings())'), 'Context panel must receive the active experience mode.');
assert(contextPanel.includes("'Runtime Context'") && contextPanel.includes('Browse Context'), 'Basic Context command center must use shared Advanced Context labels.');
assert(contextPanel.includes('Reasoner Proposals') && contextPanel.includes('Context Proposal Review') && contextPanel.includes('Review Proposals'), 'Basic Context proposals must use shared Advanced proposal labels.');
assert(/if \(!basic\)\s*{\s*const resolverActions/.test(contextPanel), 'Basic Context must hide Resolve Local and Ask Reasoner controls.');
assert(/if \(!basic\)\s*{\s*card\.appendChild\(createContextResolutionAuditPanel\(state\)\);\s*card\.appendChild\(createContextAutomationAuditPanel\(state\)\);/.test(contextPanel), 'Basic Context must hide resolver and automation audit panels.');
assert(/if \(!basic\)\s*{\s*actions\.appendChild\((?:markTourTarget\()?createButton\(context\.manualLock \? 'Unlock' : 'Lock'/.test(contextPanel), 'Basic Loredeck Context rows must hide direct manual lock controls.');
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
assert(panel.includes('function openPendingLoreReviewSections()') && panel.includes("setSectionCollapsed('lore.pendingReview', false);"), 'Canon add actions must have a local Pending Lore Review opener after guide prep extraction.');
assert(panel.includes('function refreshCanonPreviewSelectionUi()'), 'Canon preview selection must refresh row/count/button state without rebuilding the full Lorecards tab.');
assert(panel.includes("addSelected.dataset.sagaCanonPreviewAction = 'add-selected';"), 'Canon preview Add Selected button must be addressable by selection refresh.');
assert(panel.includes("row.dataset.canonPreviewEntryId = id;"), 'Canon preview rows must expose entry ids for in-place selection state refresh.');
assert(panel.includes('if (!refreshCanonPreviewSelectionUi()) refreshPanelBody({ preserveScroll: true, preserveWindowScroll: true });'), 'Canon preview selection fallback must preserve drawer and page scroll if a full refresh is needed.');
assert(runtimeShell.includes("'.saga-canon-preview-list'"), 'Canon preview list must participate in nested scroll preservation and wheel handoff.');
assert(panel.includes('function refreshLoredeckAssistantDraftSelectionUi(pack)'), 'Assistant draft selection must refresh row/count/button state without rebuilding the full Lorecards tab.');
assert(panel.includes('if (options.refresh && !refreshLoredeckAssistantDraftSelectionUi(pack))'), 'Assistant draft checkbox fallback must preserve drawer and page scroll if a full refresh is needed.');
assert(panel.includes("Object.prototype.hasOwnProperty.call(current, 'selectedDraftChangeIds')") && panel.includes('delete currentForMutation.selectedDraftChangeIds'), 'Assistant draft cache updates must preserve default-all selection when no explicit selection exists.');
assert(runtimeLoredeckAssistantReview.includes("queueSelected.dataset.sagaAssistantDraftAction = 'queue-selected';"), 'Assistant draft Queue Selected button must be addressable by selection refresh.');
assert(runtimeLoredeckAssistantReview.includes("row.dataset.sagaAssistantDraftChangeId = change.changeId || '';"), 'Assistant draft rows must expose change ids for in-place selection state refresh.');
assert(runtimeShell.includes("'.saga-loredeck-assistant-draft-list'"), 'Assistant draft list must participate in nested scroll preservation and wheel handoff.');
assert(style.includes('.saga-loredeck-assistant-draft-row-selected'), 'Assistant draft selected rows must have dedicated runtime styling.');
assert(loredeckUiKit.includes('export function createLoredeckRenderErrorCard') && loredeckUiKit.includes('export function appendLoredeckStatusPills'), 'Loredeck UI kit must own shared render-error and status-pill helpers.');
assert(libraryPanel.includes("from './loredeck-ui-kit.js'") && libraryPanel.includes('createLoredeckRenderErrorBody') && libraryPanel.includes('appendLoredeckStatusPills(meta'), 'Loredeck Library must use shared Loredeck UI kit primitives for render errors and header status.');
assert(loredeckWorkbenchPanel.includes("from './loredeck-ui-kit.js'") && loredeckWorkbenchPanel.includes('createLoredeckEmptyState') && loredeckWorkbenchPanel.includes('appendLoredeckStatusPills(chips'), 'Loredeck Workbench must use shared Loredeck UI kit primitives for shell empty/status surfaces.');
assert(healthPanel.includes("from './loredeck-ui-kit.js'") && healthPanel.includes('createLoredeckRenderErrorCard') && healthPanel.includes('appendLoredeckStatusPills(meta'), 'Pack Health Center must use shared Loredeck UI kit primitives for render errors and hero status.');
assert(loredeckFilterControls.includes('export function createLoredeckSearchInput') && loredeckFilterControls.includes('export function createLoredeckSelectControl') && loredeckFilterControls.includes('export function createLoredeckFilterCount'), 'Loredeck filter controls must own shared search, select, and count primitives.');
assert(loredeckSelectionToolbar.includes('export function createLoredeckSelectionSummary') && loredeckSelectionToolbar.includes('export function formatLoredeckSelectionSummary'), 'Loredeck selection toolbar must own shared selection summary rendering.');
assert(libraryPanel.includes("from './loredeck-filter-controls.js'") && libraryPanel.includes('createLoredeckSearchInput({') && libraryPanel.includes('createLoredeckSelectControl({'), 'Loredeck Library must use shared filter controls for search, view, and sort controls.');
assert(libraryPanel.includes("from './loredeck-selection-toolbar.js'") && libraryPanel.includes('createLoredeckSelectionSummary({') && libraryPanel.includes('visibleSelectedCount: selectedVisibleCount'), 'Loredeck Library must use shared selection summary rendering.');
assert(loredeckWorkbenchPanel.includes("from './loredeck-filter-controls.js'") && loredeckWorkbenchPanel.includes('createLoredeckSearchInput({') && loredeckWorkbenchPanel.includes('createLoredeckFilterCount({') && loredeckWorkbenchPanel.includes('return createLoredeckSelectControl({'), 'Loredeck Workbench must use shared filter controls for search, selects, and filtered counts.');
assert(loredeckWorkbenchPanel.includes("from './loredeck-selection-toolbar.js'") && loredeckWorkbenchPanel.includes("emptyText: 'No bulk selection'"), 'Loredeck Workbench bulk toolbar must use shared selection summary rendering.');
assert(loredeckValidationView.includes('export function createLoredeckValidationSeverityGrid') && loredeckValidationView.includes('export function createLoredeckValidationIssueList'), 'Loredeck validation view must own shared severity-grid and issue-list primitives.');
assert(loredeckValidationView.includes('export function createLoredeckValidationMetric') && loredeckValidationView.includes('export function createLoredeckValidationCategoryList'), 'Loredeck validation view must own shared metric and category-list primitives.');
assert(healthPanel.includes("from './loredeck-validation-view.js'") && healthPanel.includes('createLoredeckValidationSeverityGrid([') && healthPanel.includes('return createLoredeckValidationIssueList(titleText, issues'), 'Pack Health Center must use shared validation view primitives for severity and raw issue lists.');
assert(healthPanel.includes('return createLoredeckValidationCategoryList(getLoredeckHealthCategories(context.report)') && healthPanel.includes('return createLoredeckValidationMetric(label, value, tooltip);'), 'Pack Health Center must use shared validation view primitives for categories and metrics.');
assert(loredeckJobView.includes('export function createLoredeckJobStatusRow') && loredeckJobView.includes('export function formatLoredeckJobElapsed') && loredeckJobView.includes('export function createLoredeckJobProgressBar'), 'Loredeck job view must own shared async job status-row and progress-bar primitives.');
assert(creatorPanel.includes("from './loredeck-job-view.js'") && creatorPanel.includes('return createLoredeckJobStatusRow({') && creatorPanel.includes('cancelLoredeckCreatorGeneration(model.id)'), 'Loredeck Creator generation status must render through the shared job view while retaining Creator-owned cancellation.');
assert(loredecksTabPanel.includes("from './loredeck-job-view.js'") && loredecksTabPanel.includes('createLoredeckJobProgressBar(model.progress'), 'Loredecks Creator project shelf must render progress bars through the shared job view.');
assert(loredeckActionRows.includes('export function createLoredeckActionRow') && loredeckActionRows.includes('export function setLoredeckActionButtonBusy') && loredeckActionRows.includes('export async function withLoredeckActionButtonBusy') && loredeckActionRows.includes('export async function withLoredeckConfirmedActionButton'), 'Loredeck action rows must own shared action-row and busy-button primitives.');
assert(runtimeLoredeckPackageInstallPanel.includes("from '../loredecks/loredeck-action-rows.js'") && runtimeLoredeckPackageInstallPanel.includes('createLoredeckActionRow()') && runtimeLoredeckPackageInstallPanel.includes("withLoredeckActionButtonBusy(button, { busyText: 'Installing...'"), 'Loredeck package install panel must use shared action row and busy-button helpers.');
assert(runtimeLoredeckPackageExport.includes("from '../loredecks/loredeck-action-rows.js'") && runtimeLoredeckPackageExport.includes("withLoredeckActionButtonBusy(button, { busyText: 'Exporting...'"), 'Loredeck package export must use shared busy-button helper.');
assert(healthPanel.includes("from './loredeck-action-rows.js'") && healthPanel.includes("withLoredeckActionButtonBusy(button, { busyText: 'Scanning...'"), 'Pack Health refresh scan must use shared busy-button helper.');
assert(healthPanel.includes('function createLoredeckHealthIssueActionRow') && healthPanel.includes('panel.appendChild(createLoredeckHealthIssueActionRow(group, context, issueState, editable));') && healthPanel.includes("Queue Tag ID Repair") && healthPanel.includes("Draft With Assistant"), 'Pack Health grouped issue repair actions must be isolated behind the shared action-row helper.');
assert(runtimeLoredeckEditorLoader.includes("from '../loredecks/loredeck-action-rows.js'") && runtimeLoredeckEditorLoader.includes('setLoredeckActionButtonBusy(button,') && runtimeLoredeckEditorValidation.includes("from '../loredecks/loredeck-action-rows.js'"), 'Loredeck editor loader and validation must use the shared busy-button helper.');
assert(runtimeLoredeckEditorFields.includes('export function createLoredeckCheckbox') && panel.includes('createLoredeckCheckbox,') && !panel.includes('function createLoredeckCheckbox(container'), 'Runtime Loredeck checkbox field creation must live in the shared editor field module.');
assert(runtimeLoredeckEditorActions.includes("from '../loredecks/loredeck-action-rows.js'") && runtimeLoredeckEditorActions.includes("setLoredeckActionButtonBusy(button, 'Finalizing...'") && runtimeLoredeckEditorActions.includes("setLoredeckActionButtonBusy(button, 'Creating...'") && runtimeLoredeckEditorActions.includes("setLoredeckActionButtonBusy(button, 'Repairing...'"), 'Runtime Loredeck editor actions must use the shared busy-button helper for finalize, duplicate, and repair flows.');
assert(runtimeLoredeckEditorActions.includes('export function configureLoredeckEditorActions') && runtimeLoredeckEditorActions.includes('export async function repairLoredeckSafeHealthIssues') && runtimeLoredeckEditorActions.includes('export async function finalizeGeneratedLoredeckAsCustom'), 'Runtime Loredeck editor actions must live in the extracted action module.');
assert(panel.includes("} from './loredeck-editor-actions.js';") && panel.includes('configureLoredeckEditorActions({') && panel.includes('repairLoredeckSafeHealthIssues,') && panel.includes('finalizeGeneratedLoredeckAsCustom,') && !panel.includes('repairLoredeckSafeHealthIssuesAction'), 'Runtime panel must import shared Loredeck editor actions directly from loredeck-editor-actions.');
assert(runtimeLoredeckEntryOverrides.includes('export function configureLoredeckEntryOverridesPanel') && runtimeLoredeckEntryOverrides.includes('export function createLoredeckEntryOverrideCard') && runtimeLoredeckEntryOverrides.includes('export function createLoredeckEntryOverrideRow'), 'Runtime Loredeck entry override card and row renderers must live in the extracted entry overrides panel.');
assert(panel.includes("from './loredeck-entry-overrides-panel.js'") && panel.includes('configureLoredeckEntryOverridesPanel({') && !panel.includes('function createLoredeckEntryOverrideCard(pack)'), 'Runtime panel must delegate Loredeck entry override rendering to loredeck-entry-overrides-panel.');
assert(runtimeLoredeckTimelineRegistry.includes('export function configureLoredeckTimelineRegistryPanel') && runtimeLoredeckTimelineRegistry.includes('export function createLoredeckTimelineRegistryCard') && runtimeLoredeckTimelineRegistry.includes('export function createLoredeckTimelineRegistryRow'), 'Runtime Loredeck timeline registry card and row renderers must live in the extracted timeline registry panel.');
assert(panel.includes("from './loredeck-timeline-registry-panel.js'") && panel.includes('configureLoredeckTimelineRegistryPanel({') && !panel.includes('function createLoredeckTimelineRegistryCard(pack'), 'Runtime panel must delegate Loredeck timeline registry rendering to loredeck-timeline-registry-panel.');
assert(runtimeLoredeckTagManager.includes('export function configureLoredeckTagManagerPanel') && runtimeLoredeckTagManager.includes('export function createLoredeckTagManagerCard') && runtimeLoredeckTagManager.includes('export function createLoredeckTagManagerRow'), 'Runtime Loredeck tag manager card and row renderers must live in the extracted tag manager panel.');
assert(panel.includes("from './loredeck-tag-manager-panel.js'") && panel.includes('configureLoredeckTagManagerPanel({') && !panel.includes('function createLoredeckTagManagerCard(pack'), 'Runtime panel must delegate Loredeck tag manager rendering to loredeck-tag-manager-panel.');
assert(runtimeLoredeckPendingReview.includes('export function configureLoredeckPendingReviewPanel') && runtimeLoredeckPendingReview.includes('export function createLoredeckPendingReviewCard') && runtimeLoredeckPendingReview.includes('export function createLoredeckPendingChangeRow') && runtimeLoredeckPendingReview.includes('const actions = createLoredeckActionRow();') && runtimeLoredeckPendingReview.includes('Accept All'), 'Runtime Loredeck Pending Review card and row renderers must live in the extracted pending review panel.');
assert(panel.includes("from './loredeck-pending-review-panel.js'") && panel.includes('configureLoredeckPendingReviewPanel({') && !panel.includes('function createLoredeckPendingReviewCard(pack'), 'Runtime panel must delegate Loredeck Pending Review rendering to loredeck-pending-review-panel.');
assert(runtimeLoredeckAssistantReview.includes('export function configureLoredeckAssistantReviewPanel') && runtimeLoredeckAssistantReview.includes('export function createLoredeckAssistantCard') && runtimeLoredeckAssistantReview.includes('export function createLoredeckAssistantDraftBatchCard') && runtimeLoredeckAssistantReview.includes('export function createLoredeckAssistantDraftRow') && runtimeLoredeckAssistantReview.includes('queueSelected.dataset.sagaAssistantDraftAction'), 'Runtime Loredeck Assistant review card, batch, and row renderers must live in the extracted assistant review panel.');
assert(panel.includes("from './loredeck-assistant-review-panel.js'") && panel.includes('configureLoredeckAssistantReviewPanel({') && !panel.includes('function createLoredeckAssistantCard(pack') && !panel.includes('function createLoredeckAssistantDraftBatchCard(pack'), 'Runtime panel must delegate Loredeck Assistant review rendering to loredeck-assistant-review-panel.');
assert(runtimePanelSource.includes('async function requestAndParseLoredeckAssistantResponse') && runtimePanelSource.includes('annotateLoredeckAssistantParseError') && runtimePanelSource.includes('warnLoredeckAssistantRequestFailure'), 'Direct Lore Assistant generation flows must share a code-aware request and parse helper.');
assert(runtimePanelSource.includes("stage: 'pack_health_repair'") && runtimePanelSource.includes("stage: 'assistant_draft_revision'") && runtimePanelSource.includes("stage: 'assistant_draft'"), 'Lore Assistant repair, revision, and draft flows must identify their generation stage for diagnostics.');
assert(!/const responseText = await sendLoreRequest\(\s*buildLoredeckAssistantSystemPrompt\(\)/.test(runtimePanelSource) && (runtimePanelSource.match(/parseLoredeckAssistantResponse\(responseText\)/g) || []).length === 1, 'Lore Assistant generation flows must not bypass normalized request parsing.');
assert(runtimeLoredeckReviewHelpers.includes('export function configureLoredeckReviewHelpers') && runtimeLoredeckReviewHelpers.includes('export function createLoredeckPendingDiffList') && runtimeLoredeckReviewHelpers.includes('export function createLoredeckPendingRepairCandidateList') && runtimeLoredeckReviewHelpers.includes('export function appendLoredeckPendingQualityPills') && runtimeLoredeckReviewHelpers.includes('export function doesLoredeckPendingChangeAffectPackHealth') && runtimeLoredeckReviewHelpers.includes('export function normalizeLoredeckPendingRubricLevel'), 'Runtime Loredeck review diff, repair preview, quality, rubric, and health-impact helpers must live in the extracted review helper module.');
assert(panel.includes('normalizeLoredeckPendingRubricLevel,') && panel.includes('normalizeLoredeckAssistantRubricForPreview'), 'Runtime panel must import the shared rubric-level normalizer before building Assistant or Creator proposal previews.');
assert(panel.includes("from './loredeck-review-helpers.js'") && panel.includes('configureLoredeckReviewHelpers({') && !panel.includes('function createLoredeckPendingDiffList(pack') && !panel.includes('function appendLoredeckPendingQualityPills(meta') && !panel.includes('function doesLoredeckPendingChangeAffectPackHealth(change'), 'Runtime panel must delegate Loredeck review helpers to loredeck-review-helpers.');
assert(runtimeLoredeckPendingChangeModel.includes('export function configureLoredeckPendingChangeModel') && runtimeLoredeckPendingChangeModel.includes('export function normalizeLoredeckPendingChanges') && runtimeLoredeckPendingChangeModel.includes('export function createLoredeckRecordPatchChange') && runtimeLoredeckPendingChangeModel.includes('export function applyLoredeckRecordPatch'), 'Runtime Loredeck pending-change normalization and patch application must live in the extracted pending-change model.');
assert(panel.includes("from './loredeck-pending-change-model.js'") && panel.includes('configureLoredeckPendingChangeModel({') && !panel.includes('function normalizeLoredeckPendingChanges(value') && !panel.includes('function createLoredeckRecordPatchChange(fields') && !panel.includes('function applyLoredeckRecordPatch(record'), 'Runtime panel must delegate pending-change model helpers to loredeck-pending-change-model.');
assert(runtimeLoredeckPendingChangeActions.includes('export function configureLoredeckPendingChangeActions') && runtimeLoredeckPendingChangeActions.includes('export function queueLoredeckPendingChange') && runtimeLoredeckPendingChangeActions.includes('export async function acceptLoredeckPendingChanges') && runtimeLoredeckPendingChangeActions.includes('export function rejectLoredeckPendingChanges') && runtimeLoredeckPendingChangeActions.includes('refreshLoredeckHealthAfterAcceptedPendingChanges'), 'Runtime Loredeck pending-change queue, accept, reject, and health refresh lifecycle must live in the extracted pending-change action module.');
assert(panel.includes("from './loredeck-pending-change-actions.js'") && panel.includes('configureLoredeckPendingChangeActions({') && !panel.includes('function queueLoredeckPendingChange(pack') && !panel.includes('async function acceptLoredeckPendingChanges(pack') && !panel.includes('function rejectLoredeckPendingChanges(pack'), 'Runtime panel must delegate pending-change actions to loredeck-pending-change-actions.');
assert(runtimeLoredeckEditProposals.includes('export function configureLoredeckEditProposals') && runtimeLoredeckEditProposals.includes('export function saveLoredeckEntryOverride') && runtimeLoredeckEditProposals.includes('export function queueLoredeckBulkTagUpdate') && runtimeLoredeckEditProposals.includes('export function queueLoredeckBulkContextUpdate') && runtimeLoredeckEditProposals.includes('export function queueLoredeckTagRenameProposal') && runtimeLoredeckEditProposals.includes('export function buildBulkLoredeckTagOverrideEntry') && runtimeLoredeckEditProposals.includes('export function computeLoredeckBulkTagUpdates'), 'Runtime Loredeck edit proposal queue builders must live in the extracted edit proposal module.');
assert(panel.includes("from './loredeck-edit-proposals.js'") && panel.includes('configureLoredeckEditProposals({') && !panel.includes('function saveLoredeckEntryOverride(pack') && !panel.includes('function saveLoredeckTimelineAnchorDefinition(pack') && !panel.includes('function saveLoredeckTagRegistryDefinition(pack') && !panel.includes('function buildBulkLoredeckTagOverrideEntry(pack') && !panel.includes('function computeLoredeckBulkTagUpdates(pack') && panel.includes('queueLoredeckBulkTagUpdate(pack, {') && panel.includes('queueLoredeckBulkContextUpdate(pack, { entries, contextGate })') && panel.includes('queueLoredeckTagRenameProposal(pack, {'), 'Runtime panel must delegate Loredeck edit proposal builders to loredeck-edit-proposals.');
assert(libraryPanel.includes("from './loredeck-action-rows.js'") && libraryPanel.includes("setLoredeckActionButtonBusy(button, 'Refreshing...'"), 'Loredeck Library refresh must use the shared busy-button helper.');
assert(healthPanel.includes("setLoredeckActionButtonBusy(button, 'Refreshing...'"), 'Pack Health report refresh must use the shared busy-button helper.');
assert(loredeckWorkbenchPanel.includes("from './loredeck-action-rows.js'") && loredeckWorkbenchPanel.includes("setLoredeckActionButtonBusy(button, 'Saving...'") && loredeckWorkbenchPanel.includes("setLoredeckActionButtonBusy(button, 'Loading...'") && loredeckWorkbenchPanel.includes("setLoredeckActionButtonBusy(btn, 'Creating...'"), 'Loredeck Workbench save, create, and load flows must use the shared busy-button helper.');
assert(loredeckWorkbenchPanel.includes('withLoredeckConfirmedActionButton,') && loredeckWorkbenchPanel.includes("busyText: 'Deleting...'") && loredeckWorkbenchPanel.includes("busyText: 'Applying...'") && loredeckWorkbenchPanel.includes("busyText: 'Restoring...'") && loredeckWorkbenchPanel.includes("busyText: 'Duplicating...'"), 'Loredeck Workbench delete, bulk, restore, and duplicate confirmations must use the shared confirmed-busy helper.');
assert(libraryPanel.includes('createLoredeckActionRow({ className:') && healthPanel.includes('createLoredeckActionRow({ className:') && loredeckWorkbenchPanel.includes('createLoredeckActionRow({ className:'), 'Loredeck Library, Health, and Workbench primary action rows must use the shared action-row helper.');
assert(/export function createLoredeckAssistantDraftBatchCard[\s\S]*const actions = createLoredeckActionRow\(\);[\s\S]*queueSelected\.dataset\.sagaAssistantDraftAction[\s\S]*const reviseActions = createLoredeckActionRow\(\);/.test(runtimeLoredeckAssistantReview), 'Runtime Assistant draft review and revision actions must use the shared action-row helper.');
assert(/function openDuplicateLoredeckDialog[\s\S]*const actions = createLoredeckActionRow\(\);[\s\S]*Create Custom Loredeck/.test(panel), 'Runtime duplicate-as-Custom dialog must use the shared action-row helper.');
assert(/function openLoredeckEntryOverrideDialog[\s\S]*const actions = createLoredeckActionRow\(\);[\s\S]*Queue Change/.test(panel), 'Runtime entry override review handoff must use the shared action-row helper.');
assert(/function openLoredeckBulkTagsDialog[\s\S]*const actions = createLoredeckActionRow\(\);[\s\S]*Queue Tags/.test(panel) && /function openLoredeckBulkContextDialog[\s\S]*const actions = createLoredeckActionRow\(\);[\s\S]*Queue For Review/.test(panel), 'Runtime bulk tag and Context review handoffs must use the shared action-row helper.');
assert(creatorPanel.includes('export function refreshLoredeckCreatorTitleSelectionUi()'), 'Creator title selection must refresh row/count/button state without rebuilding the Creator workbench.');
assert(panel.includes('refreshLoredeckCreatorTitleSelectionUi') && panel.includes("button.dataset.sagaCreatorGenerationLocked = 'true';"), 'Creator title selection refresh must preserve generation-locked button state.');
assert(creatorPanel.includes("approveSelected.dataset.sagaCreatorTitleAction = 'approve-selected';"), 'Creator title Approve Selected button must be addressable by selection refresh.');
assert(creatorPanel.includes("row.dataset.sagaCreatorTitleId = draft.titleId || '';"), 'Creator title rows must expose title ids for in-place selection state refresh.');
assert(runtimeShell.includes("'.saga-loredeck-creator-title-list'"), 'Creator title list must participate in nested scroll preservation and wheel handoff.');
assert(style.includes('.saga-loredeck-creator-title-row-selected'), 'Creator title selected rows must have dedicated runtime styling.');
assert(loredeckWorkbenchPanel.includes('captureLoredeckWorkbenchScrollState') && loredeckWorkbenchPanel.includes('restoreLoredeckWorkbenchScrollState'), 'Loredeck Workbench rerenders must preserve selectable table scroll.');
assert(loredeckWorkbenchPanel.includes("['.saga-loredeck-workbench-table', snapshot.table]"), 'Loredeck Workbench must restore the table scroll position after selection rerenders.');
assert(loredeckWorkbenchPanel.includes('overlay.focus?.({ preventScroll: true });'), 'Loredeck Workbench rerender focus must not scroll the overlay back to the top.');
assert(runtimePanelSource.includes('captureContextWorkbenchScrollState') && runtimePanelSource.includes('restoreContextWorkbenchScrollState'), 'Context Workbench rerenders must preserve selectable table scroll.');
assert(runtimePanelSource.includes("['.saga-context-workbench-table', overlay.querySelector('.saga-context-workbench-table')?.scrollTop || 0]"), 'Context Workbench must capture timeline table scroll before rerenders.');
assert(contextWorkbenchPanel.includes('row.dataset.sagaContextWorkbenchItemKey = key;'), 'Context Workbench timeline rows must expose stable item keys for selection refresh and diagnostics.');
assert(contextWorkbenchPanel.includes('row.dataset.sagaContextWorkbenchPackId = item.packId;'), 'Context Workbench context rows must expose stable pack ids for selection refresh and diagnostics.');
assert(runtimePanelSource.includes('overlay.focus?.({ preventScroll: true });'), 'Context Workbench rerender focus must not scroll the overlay back to the top.');
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
assert(defaultState.includes('contextAutomationAudit'), 'Default state must preserve Context automation audit state.');
assert(style.includes('saga-context-command-card'), 'Context command center must have dedicated layout styling.');
assert(style.includes('saga-context-automation-audit'), 'Context automation audit must have dedicated styling.');
assert(style.includes('saga-context-proposal-review-shell'), 'Context proposal review overlay must have dedicated shell styling.');
assert(style.includes('saga-context-proposal-review-row'), 'Context proposal review rows must have dedicated styling.');
assert(style.includes('saga-context-advanced-brief-content'), 'Advanced Context Brief content must have dedicated styling.');
assert(style.includes('saga-context-proposal-focus'), 'Context proposal review jump must have a visible focus animation.');
assert(style.includes('.saga-context-workbench-window-builder > .saga-primary-actions'), 'Context Workbench window-builder actions must use explicit grid placement.');
assert(liveSmoke.includes('SAGA_SMOKE_TARGET'), 'Live smoke helper must support targeted smoke modes.');
assert(liveSmoke.includes('REPO_LOCAL_HARNESS_TARGETS') && liveSmoke.includes("'guide-harness'"), 'Live smoke helper must support repo-local walkthrough guide smoke.');
assert(liveSmoke.includes("'creator-harness'") && liveSmoke.includes("SMOKE_TARGET === 'creator-harness'"), 'Live smoke helper must support the repo-local Creator reset harness target.');
assert(liveSmoke.includes('openSummaryText(client, \'In-Progress Creator Projects\')') && liveSmoke.includes("clickSelector(client, '.saga-loredeck-creator-project-card')"), 'Creator reset smoke must open the project shelf disclosure and seeded project card instead of depending on action-button labels.');
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
assert(liveSmoke.includes('hasOldBrowseStoryWaypoints') && liveSmoke.includes('hasOldSelectFromTimeline'), 'Live loaded Context smoke must guard against retired picker labels.');
assert(liveSmoke.includes('oldWaypointRows') && liveSmoke.includes('oldWaypointTargets'), 'Live loaded Context smoke must guard against retired waypoint selectors and tour targets.');
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
assert(creatorPanel.includes('Draft More Lorecards'), 'Creator current task must keep Lorecard generation primary while review drafts exist and more Lorecards remain.');
assert(creatorPanel.includes("createButton('Auto-Draft All'"), 'Creator entry drafting must expose a full remaining-count auto-draft action.');
assert(creatorPanel.includes("'Auto-Draft All Lorecards?'") && creatorPanel.includes('auto-generate ${remainingCount} Lorecard'), 'Creator Auto-Draft All must confirm the exact Lorecard count before repeated generation.');
assert(creatorPanel.includes('confirmLabel: `Auto-Draft ${remainingCount} Lorecard'), 'Creator Auto-Draft All confirmation must name the destructive bulk action on the confirm button.');
assert(runtimePanelSource.includes('Current Lorecard drafts can stay here while you draft more batches.'), 'Creator entry drafting must allow additional generation while review drafts are open.');
assert(runtimePanelSource.includes('refreshLoredeckAssistantDraftSurfaces') && runtimePanelSource.includes('refreshLoredeckCreatorWorkbenchBody({ preserveScroll: true });'), 'Creator draft review handoff must refresh the workbench overlay after queueing or dropping drafts.');
assert(runtimePanelSource.includes('Creator Lorecard Draft Review'), 'Creator draft review must use Creator-specific review language.');
assert(runtimePanelSource.includes('Send Selected to Review'), 'Creator draft review must expose explicit Pending Review handoff language.');
assert(runtimePanelSource.includes('getLoredeckCreatorPipelineModel'), 'Creator wizard must derive a checkpointed production pipeline model.');
assert(style.includes('saga-loredeck-creator-stage-guide'), 'Creator roadmap must have dedicated styling.');
assert(creatorPanel.includes('getLoredeckCreatorResetAvailability') && creatorPanel.includes("className = 'saga-loredeck-creator-stage-reset'") && creatorPanel.includes('Reset to this step'), 'Creator roadmap must expose the reset-to-step affordance with reset-specific tooltip copy.');
assert(creatorPanel.includes("const item = document.createElement('div')") && creatorPanel.includes("const main = document.createElement('button')"), 'Creator roadmap reset controls must not be nested inside the main stage navigation button.');
assert(runtimePanelSource.includes('handleLoredeckCreatorResetToStep') && runtimePanelSource.includes('resetLoredeckCreatorJobAfterStep') && runtimePanelSource.includes('resetGeneratedLoredeckPackAfterStep'), 'Creator reset controls must be wired to the runtime reset handler and shared reset rules.');
assert(runtimePanelSource.includes('removeLoredeckLibraryPack(creatorPack.packId, { clearCreatorProjects: false })'), 'Creator reset before Context Plan must remove the generated shell without deleting the active Creator project.');
assert(runtimePanelSource.includes('} else if (packId) {') && runtimePanelSource.includes('clearLoredeckCreatorResetPackCaches(packId'), 'Creator reset must clear stale generated-pack caches even when the pack record is already missing.');
assert(runtimeUiKit.includes('options.confirmLabel') && runtimePanelSource.includes('confirmLabel: `Reset to ${label}`'), 'Creator reset confirmation must name the destructive reset action on the confirm button.');
assert(runtimeUiKit.includes('saga-runtime-button-spinner') && runtimeUiKit.includes('await action({ setText })') && runtimeUiKit.includes("btn.setAttribute('aria-busy', 'true')"), 'Runtime busy buttons must support spinner-backed live text updates.');
assert(style.includes('.saga-runtime-button-spinner') && style.includes('animation: saga-generation-spin 0.9s linear infinite'), 'Runtime busy buttons must render the shared generation spinner animation.');
assert(style.includes('saga-loredeck-creator-stage-reset') && style.includes('saga-loredeck-creator-stage-resettable'), 'Creator reset buttons must have dedicated roadmap styling.');
assert(harness.includes("jobId: 'smoke-creator-project'") && harness.includes("brief: {") && harness.includes("outline: {") && harness.includes("currentStage: 'entries_drafted'"), 'Visual smoke harness must seed a normalized in-progress Creator project for reset controls.');
assert(liveSmoke.includes('creator-harness-01-reset-controls') && liveSmoke.includes('creator-harness-02-reset-confirm') && liveSmoke.includes('Reset to Title Pass?'), 'Creator reset smoke must capture reset controls and destructive confirmation copy.');
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
assert(!runtimePanelSource.includes('draft-review items exist'), 'Creator Lorecard auto-draft must not stop solely because draft-review items exist.');
assert(runtimePanelSource.includes('createLoredeckCreatorAdvancedGenerationSettings'), 'Creator wizard must expose a collapsed Advanced Generation Settings panel.');
assert(runtimePanelSource.includes('getLoredeckCreatorGenerationSettings'), 'Creator generation must read normalized per-project generation settings.');
assert(runtimePanelSource.includes('setLoredeckCreatorGenerationSettings'), 'Creator generation settings must persist per project.');
assert(runtimePanelSource.includes('showStreamingProgress'), 'Creator generation settings must control streaming progress snippets.');
assert(runtimePanelSource.includes('options.bypassRunLimit === true') && creatorPanel.includes('bypassRunLimit: true'), 'Creator Auto-Draft All must bypass the old run cap after confirming the full remaining count.');
assert(runtimePanelSource.includes('updateLoredeckCreatorEntryDraftBusyProgress') && runtimePanelSource.includes('getLoredeckCreatorEntryDraftProgressForOptions') && runtimePanelSource.includes('busy.setText(`${prefix} | ${remainingCount} remain`)'), 'Creator Lorecard drafting must update the active button with fresh remaining-count progress.');
assert(/\.saga-loredeck-creator-generation-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*300px\),\s*1fr\)\)/.test(style)
    && /\.saga-loredeck-creator-generation-row input\[type="range"\]\s*\{[\s\S]*width:\s*calc\(100% - 14px\);[\s\S]*max-width:\s*calc\(100% - 14px\);[\s\S]*margin-inline:\s*7px;[\s\S]*justify-self:\s*center;/.test(style),
    'Creator advanced generation sliders must reserve range thumb space inside their setting cards.');
assert(runtimePanelSource.includes('forceVisibleOutput'), 'Creator generation requests must ask reasoning profiles for visible final output on the first call.');
assert(llm.includes('prepareLoreRequestPrompts'), 'Lore LLM client must prepare first-pass visible-output prompts when requested.');
assert(llm.includes('options.forceVisibleOutput === true'), 'Lore LLM client must expose an explicit visible-output opt-in.');
assert(llm.includes('createLoreResponseError') && llm.includes('LORE_RESPONSE_ERROR_CODES.TOKEN_LIMIT') && llm.includes('LORE_RESPONSE_ERROR_CODES.REASONING_ONLY') && llm.includes('LORE_RESPONSE_ERROR_CODES.EMPTY_CONTENT'), 'Lore LLM client must throw shared typed provider response errors for token-limit, reasoning-only, and empty-content failures.');
assert(runtimePanelSource.includes('titleRunRemainingLimit'), 'Creator title Generate Remaining must use a configurable run limit.');
assert(creatorPanel.includes('const callCount = Math.max(0, Number(freshProgress?.batchCount) || 0);'), 'Creator Auto-Draft All must derive its run count from remaining Lorecard batches.');
assert(runtimePanelSource.includes('retryAttempts: Number.isFinite(Number(config.retryAttempts))'), 'Creator runner calls must support configured retry attempts.');
assert(stateSource.includes('generationSettings'), 'Creator project persistence must preserve generation settings.');
assert(runtimePanelSource.includes('unitMeta'), 'Creator generation units must persist compact retry metadata.');
assert(runtimePanelSource.includes('getLoredeckCreatorLatestRecoverableUnit'), 'Creator recovery must locate the latest failed or interrupted unit.');
assert(runtimePanelSource.includes('retryLoredeckCreatorRecoverableUnit'), 'Creator recovery must retry failed generation units.');
assert(runtimePanelSource.includes('markLoredeckCreatorRecoveryUnitSuperseded'), 'Creator Retry Smaller must supersede the previous failed unit after creating a replacement.');
assert(runtimePanelSource.includes('buildLoredeckCreatorRetryUnitId'), 'Creator Retry Smaller must create a distinct replacement unit ID.');
assert(runtimePanelSource.includes('Retry Failed'), 'Creator current task controls must expose Retry Failed.');
assert(runtimePanelSource.includes('Retry Smaller'), 'Creator current task controls must expose Retry Smaller.');
assert(runtimePanelSource.includes('Cancel Generation'), 'Creator current task controls must expose Cancel while a generation is active.');
assert(creatorPanel.includes('createLoredeckCreatorDiagnosticBlock') && creatorPanel.includes('Failure Diagnostic') && creatorPanel.includes('buildLoredeckCreatorDiagnosticCopyPayload') && creatorPanel.includes('globalThis.navigator.clipboard.writeText(JSON.stringify(payload, null, 2))'), 'Creator Job panel must expose a copyable compact sanitized failure diagnostic.');
assert(style.includes('saga-loredeck-creator-diagnostic') && style.includes('saga-loredeck-creator-diagnostic-sample'), 'Creator failure diagnostics must have dedicated compact sidebar styling.');
assert(runtimePanelSource.includes('formatLoredeckCreatorGenerationFailureMessage') && runtimePanelSource.includes('provider_reasoning_only') && runtimePanelSource.includes('json_invalid') && runtimePanelSource.includes('commit_failed'), 'Creator generation failures must map stable provider/parser/commit codes to user-facing messages.');
assert(runtimePanelSource.includes('warnLoredeckCreatorGenerationFailure(error, { stage, unitId, unitLabel })'), 'Creator generation failures must log stage, unit, and error code diagnostics without raw provider payloads.');
assert(runtimePanelSource.includes("prepareLoredeckCreatorStageFailure(e, 'Context and Tag Planning generation failed.', 'Context and Tag Planning')"), 'Creator Context and Tag Planning failures must use code-aware stage messages.');
assert(runtimePanelSource.includes("prepareLoredeckCreatorStageFailure(e, 'Lorecard entry drafting failed.', 'Lorecard Drafting')"), 'Creator Lorecard drafting failures must use code-aware stage messages.');
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
assert(runtimePanelSource.includes('refreshOpenLoredeckMetadataEditor(next.packId)'), 'Loredeck pending mutations must refresh an already-open metadata editor instead of leaving stale Pending Review counts.');
assert(runtimePanelSource.includes("console.warn('[Saga] Loredeck save succeeded, but surface refresh failed:'") && runtimePanelSource.includes('throwOnFailure: options.throwOnFailure === true'), 'Loredeck pending mutation commits must distinguish actual save failures from post-save surface refresh failures.');
assert(runtimePanelSource.includes("console.warn('[Saga] Creator planning proposals were queued, but job cache refresh failed:'") && runtimePanelSource.includes("error.code = 'creator_planning_queue_empty'") && runtimePanelSource.includes("error.code = 'loredeck_queue_failed'"), 'Creator planning commits must not turn queued proposals into generic commit failures when post-queue cache refresh or normalization fails.');
assert(runtimePanelSource.includes('input.description || input.notes') && runtimePanelSource.includes('raw.sortKeyFrom ?? raw.fromSortKey ?? raw.sortKeyStart'), 'Creator planning normalization must preserve model tag notes and timeline-window sortKeyStart/sortKeyEnd aliases.');
assert(runtimePanelSource.includes("generated_shell_without_entries"), 'Generated Loredeck planning accepts must skip health rerun while the shell has no accepted Lorecards.');
assert(!runtimePanelSource.includes('no valid manifest or accepted embedded data yet'), 'Generated Loredeck planning accepts must not warn about missing embedded data after each proposal.');
assert(stateSource.includes('clearableOptionalFields'), 'Loredeck library upsert must track optional fields that were intentionally supplied.');
assert(stateSource.includes('delete nextPack[key]'), 'Loredeck library upsert must clear optional fields that normalize to empty.');
assert(runtimePanelSource.includes('Finalize as Custom'), 'Generated Loredecks must expose reviewed Generated-to-Custom finalization.');
assert(libraryPanel.includes('getGeneratedLoredeckExportReadiness'), 'Loredeck Library finalization controls must read Generated readiness.');
assert(libraryPanel.includes('finalizeButton.disabled = !editorCanValidate || generatedReadiness?.ready === false'), 'Loredeck Library finalize button must disable when Generated readiness blocks finalization.');
assert(libraryPanel.includes('Finalization waits:'), 'Loredeck Library finalize UI must explain readiness blockers beside the disabled button.');
assert(libraryPanel.includes('Open Coverage Plan'), 'Loredeck Library blocked finalization must offer a direct Creator Coverage route.');
assert(libraryPanel.includes("openLoredeckCreatorWorkbench({ generatedPackId: pack.packId, anchor: 'coverage-plan' })"), 'Loredeck Library coverage route must target the linked Creator coverage plan.');
assert(creatorPanel.includes('options.anchor'), 'Creator workbench opener must support targeted anchor navigation.');
assert(creatorPanel.includes("scrollLoredeckCreatorWorkbenchToAnchor(anchor)"), 'Creator workbench opener must scroll to requested anchors after opening.');
assert(runtimePanelSource.includes('buildFinalizedCustomLoredeckRecordFromGenerated'), 'Generated-to-Custom finalization must use an explicit conversion builder.');
assert(runtimePanelSource.includes('generated_finalized'), 'Finalized Custom Loredecks must retain generated-source provenance.');
assert(runtimePanelSource.includes('LOREDECK_CREATOR_COVERAGE_FINALIZE_BLOCKER'), 'Creator Coverage must have a dedicated finalization blocker.');
assert(runtimePanelSource.includes("from '../loredecks/loredeck-creator-coverage.js'"), 'Runtime must use the extracted Creator Coverage helper module.');
assert(creatorCoverage.includes('buildLoredeckCreatorCoverageModel'), 'Creator Coverage module must own the pure coverage model builder.');
assert(creatorCoverage.includes('buildLoredeckCreatorCoverageFinalizationProvenance'), 'Creator Coverage module must own finalization provenance formatting.');
assert(runtimePanelSource.includes('coverageFinalizeAcknowledgement'), 'Creator Coverage finalization acknowledgement must persist on the Creator job.');
assert(runtimePanelSource.includes('Finalize Anyway with light coverage?'), 'Creator Coverage finalization acknowledgement must require explicit user confirmation.');
assert(runtimePanelSource.includes('Finalize Anyway without Creator Coverage?'), 'Missing Creator Coverage plans must require explicit finalization acknowledgement.');
assert(creatorCoverage.includes('no-coverage-plan:approved'), 'Creator Coverage model must block approved jobs that have no coverage plan.');
assert(runtimePanelSource.includes('creatorCoverageProvenance'), 'Generated-to-Custom finalization must preserve Creator Coverage provenance.');
assert(runtimePanelSource.includes('derivedFrom') && runtimePanelSource.includes('creatorCoverage'), 'Finalized Custom Loredecks must store Creator Coverage provenance under derivedFrom.');
assert(runtimePanelSource.includes('reopenLoredeckCreatorCoverageDimension'), 'Creator Coverage light/N/A row acknowledgements must be reopenable.');
assert(runtimePanelSource.includes('Coverage row reopened for expansion.'), 'Creator Coverage reopen action must report the restored expansion path.');
assert(runtimePanelSource.includes("createButton('Reopen'"), 'Creator Coverage rows must expose visible Reopen controls.');
assert(runtimePanelSource.includes('Export is available now. Pending or drafted material is reported here'), 'Generated export readiness must inform without blocking export.');
assert(!runtimePanelSource.includes('Generated Loredeck is not export-ready'), 'Selected export must not enforce Generated Loredeck readiness.');
assert(runtimePanelSource.includes('Export this Bundled Loredeck as a .saga-loredeck.zip package.'), 'Bundled Loredecks must remain exportable.');
assert(runtimePanelSource.includes('refreshLoredeckHealthAfterAcceptedPendingChanges'), 'Pending Review acceptance must rerun Pack Health after health-impact changes.');
assert(runtimePanelSource.includes('and refreshed Pack Health'), 'Pending Review health rerun must report refreshed Pack Health to the user.');
assert(runtimePanelSource.includes('Open Pack Health Center') && runtimePanelSource.includes('openLoredeckHealthCenter(pack.packId, { tab: healthState.tab })'), 'Pending Review health errors must expose a direct Pack Health Center route.');
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
    'renderLoredeckCreatorGenerationSettingsSummary',
    'onChange?.(nextSettings || getLoredeckCreatorGenerationSettings())',
    'refreshSummary(next)',
    'hasPersistableLoredeckCreatorProject',
    'setLocalLoredeckCreatorGenerationSettings',
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
    'getLoredeckCreatorPlanningPendingBatchIds',
    'getLoredeckCreatorPlanningPlannedBatchIds',
    'getLoredeckCreatorEntryEligibleBatchIds',
    'Accept at least one planned Context and Tag set before drafting Lorecards',
    'creatorEntryBatch',
    'Open Loredeck Library',
    'Loredeck Library',
    'Import Deck',
    'Install Selected',
    'Add to Stack >',
    'Clear Stack',
    'Pack Health Center',
    'Open Pack Health Center',
    'Run Pack Health',
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
    'assets/iconsets/saga-hero/hero-tab-loredecks-256.png',
    'saga-mystic',
    'assets/iconsets/saga-mystic/mystic-tab-loredecks-256.png',
    'saga-relay',
    'assets/iconsets/saga-relay/relay-tab-loredecks-256.png',
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
    assert(stateSource.includes(token), `State manager is missing expected Creator job token: ${token}`);
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
    'saga-loredeck-library-stack-folder-preview-chip',
    'saga-loredeck-library-drag-copy',
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
assert(style.includes('var(--saga-chip-neutral-bg') && style.includes('var(--saga-chip-source-fg') && style.includes('var(--saga-chip-review-bg'), 'Loredeck Library metadata/status pills must use semantic theme chip tokens.');
assert(style.includes('--saga-chip-source-fg: #d6bd86') && style.includes('--saga-chip-review-fg: #d8b66d') && !style.includes('--saga-chip-source-fg: #c5d6f2') && !style.includes('--saga-chip-review-fg: #d8c8ff'), 'Static chip fallbacks must use warm Saga Archive colors instead of the old cool badge palette.');
assert(style.includes('calc(var(--saga-grip-dot-rows, 6) * 7px)'), 'Loredeck Library drag handles must size dot grids without clipping short 2x2 or 2x3 handles.');

console.log('Visual smoke harness contract passed.');
