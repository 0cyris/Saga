import { getPanelLoreState } from '../lorecards/lore-matrix.js';
import { getSettings, saveSettings } from '../state/state-manager.js';
import {
    addTooltip,
    createButton,
    createKeyValue,
    createSectionHeader,
    createStatusPill,
    createToggleCard,
} from '../ui/runtime-ui-kit.js';
import { formatActiveChatMetricName } from './runtime-formatters.js';
import { createBasicStartReadinessCard } from './session-basic-panel.js';
import {
    formatGuideStartLabel,
    getRuntimeGuideContent,
    getRuntimeGuideSections,
    getRuntimeGuideSteps,
} from './runtime-guide-content.js';
import { startSagaTour } from './runtime-tour.js';
import {
    AUTOMATION_MODES,
    getAutomationLabel,
    getTabLabelForExperience,
    isBasicExperience,
    normalizeAutomationMode,
    normalizeExperienceMode,
} from './runtime-navigation.js';

let advancedRuntimePanelDeps = {};

export function configureAdvancedRuntimePanel(deps = {}) {
    advancedRuntimePanelDeps = { ...advancedRuntimePanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = advancedRuntimePanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Advanced Runtime panel dependency is not configured: ${name}`);
}

function createCollapsibleSection(...args) { return dep('createCollapsibleSection')(...args); }
function createDangerZoneCard(state) { return dep('createDangerZoneCard')(state); }
function getInjectionCharacterStats(state, settings) { return dep('getInjectionCharacterStats', () => ({ totalChars: 0, totalTokens: 0 }))(state, settings); }
function getSelectedLoreInjectionCount(state, settings) { return dep('getSelectedLoreInjectionCount', () => 0)(state, settings); }
function markTourTarget(element, target) { return dep('markTourTarget', value => value)(element, target); }
function refreshPanelBody(options = {}) { return dep('refreshPanelBody', () => null)(options); }
function refreshHeader() { return dep('refreshHeader', () => null)(); }

function setAutomationMode(mode) {
    const normalized = normalizeAutomationMode(mode);
    const settings = getSettings();
    settings.automationMode = normalized;
    settings.workflowMode = normalized;
    Object.assign(settings, AUTOMATION_MODES[normalized].settings);
    saveSettings(settings);
}

function getActiveChatMetricName() {
    try {
        const ctx = globalThis.SillyTavern?.getContext?.();
        const candidates = [
            ctx?.chatName,
            ctx?.chat_name,
            ctx?.currentChat,
            ctx?.current_chat,
            ctx?.chatFile,
            ctx?.chat_file,
            ctx?.chatId,
            ctx?.chat_id,
            ctx?.chatMetadata?.chatName,
            ctx?.chatMetadata?.name,
        ];
        for (const candidate of candidates) {
            const name = formatActiveChatMetricName(candidate);
            if (name) return name;
        }
        const characterName = formatActiveChatMetricName(ctx?.name2);
        if (characterName) return `${characterName} chat`;
    } catch (_e) {
        // Ignore unavailable SillyTavern context in static harnesses.
    }
    return 'Current chat';
}

function startRuntimeWalkthrough(mode, options = {}) {
    startSagaTour(mode, options);
}

export function renderSessionTab(container, state) {
    const settings = getSettings();
    const basic = isBasicExperience(settings);
    const guideMode = basic ? 'basic' : 'advanced';
    const guide = getRuntimeGuideContent(guideMode);

    container.appendChild(createSectionHeader(
        'Session Controls',
        basic ? 'Review the Start Checklist and runtime state for this chat.' : 'Set how Saga behaves during roleplay.'
    ));

    const toggles = document.createElement('div');
    toggles.className = 'saga-runtime-grid';
    toggles.appendChild(markTourTarget(createToggleCard(
        'Saga Active',
        settings.enabled,
        'Master switch for Saga runtime behavior. Pausing disables prompt injection, automatic extraction, and generation actions.',
        (checked) => {
            const next = getSettings();
            next.enabled = checked;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: false });
            refreshHeader();
        }
    ), 'session.active'));
    container.appendChild(toggles);

    if (basic) {
        container.appendChild(createBasicStartReadinessCard(state, settings));
    }

    if (!basic) {
        const modeCard = document.createElement('div');
        modeCard.className = 'saga-runtime-card';

        const modeTitle = document.createElement('div');
        modeTitle.className = 'saga-runtime-card-title';
        modeTitle.textContent = 'Automation Mode';
        addTooltip(modeTitle, 'Automation Mode controls whether Saga scans and generates only when clicked, or automatically after roleplay turns. Experience Mode lives on the shelf.');
        modeCard.appendChild(modeTitle);

        const modeButtons = document.createElement('div');
        modeButtons.className = 'saga-mode-buttons';
        for (const [mode, cfg] of Object.entries(AUTOMATION_MODES)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'saga-mode-button';
            if (normalizeAutomationMode(settings.automationMode || settings.workflowMode) === mode) btn.classList.add('saga-mode-button-active');
            btn.textContent = cfg.label;
            addTooltip(btn, cfg.description);
            btn.addEventListener('click', () => {
                setAutomationMode(mode);
                refreshPanelBody({ preserveScroll: false });
                refreshHeader();
            });
            modeButtons.appendChild(btn);
        }
        modeCard.appendChild(modeButtons);

        const modeDesc = document.createElement('div');
        modeDesc.className = 'saga-runtime-help';
        modeDesc.textContent = AUTOMATION_MODES[normalizeAutomationMode(settings.automationMode || settings.workflowMode)].description;
        modeCard.appendChild(modeDesc);

        const currentMode = normalizeAutomationMode(settings.automationMode || settings.workflowMode);
        const automationSection = createCollapsibleSection(
            'session.automationMode',
            'Automation Mode',
            getAutomationLabel(currentMode),
            true,
            modeCard,
            { tooltip: 'Choose whether Saga runs only when clicked or automatically after roleplay turns.' }
        );
        markTourTarget(automationSection, 'session.automation');
        container.appendChild(automationSection);
    }

    const instructionsSection = createCollapsibleSection(
        `session.instructions.${guideMode}`,
        guide.title,
        guide.subtitle,
        false,
        createInstructionsCard(guideMode),
        { tooltip: guide.tooltip }
    );
    markTourTarget(instructionsSection, basic ? 'session.instructions.basic' : 'session.instructions.advanced');
    container.appendChild(instructionsSection);

    const stats = document.createElement('div');
    stats.className = 'saga-runtime-card';
    markTourTarget(stats, 'session.metrics');
    const statsTitle = document.createElement('div');
    statsTitle.className = 'saga-runtime-card-title';
    statsTitle.textContent = 'Session Metrics';
    addTooltip(statsTitle, 'Runtime counters for pending changes, accepted Lorecards, relevance tiers, and current injection size.');
    stats.appendChild(statsTitle);
    const counts = getPanelLoreState(state).counts;
    const selectedLoreCount = getSelectedLoreInjectionCount(state, settings);
    const injectionStats = getInjectionCharacterStats(state, settings);
    stats.appendChild(createKeyValue('Active chat', getActiveChatMetricName(), 'The active SillyTavern chat whose Saga metrics and chat metadata are being shown.'));
    stats.appendChild(createKeyValue('Pending continuity changes', state?.lastDelta ? '1' : '0', 'Legacy extracted state delta waiting in the Continuity tab. New scans apply directly to Continuity sections.'));
    stats.appendChild(createKeyValue('Pending Lorecards', String((state?.pendingLoreEntries || []).length), 'Generated Lorecards waiting in the Lorecards tab Pending Lorecard Review section.'));
    stats.appendChild(createKeyValue('Accepted lore entries', String(counts.all - counts.pending), 'Lore entries currently stored in the accepted lore matrix.'));
    stats.appendChild(createKeyValue('High-relevance lore entries', String(counts.active), 'Accepted lore entries currently assigned to the High-Relevance injection tier.'));
    stats.appendChild(createKeyValue('Lore selected for injection', String(selectedLoreCount), 'Accepted lore entries selected for Lore Injection after pin/mute rules, Context activation, and fallback priority selection. There is no hidden entry cap; mute entries to exclude them.'));
    stats.appendChild(createKeyValue('Injection token estimate', injectionStats.totalChars ? `${injectionStats.totalTokens} tokens` : 'empty', 'Approximate token count for the combined Continuity + Lore injection previews.'));
    stats.appendChild(createKeyValue('Total chars injected', `${injectionStats.totalChars} chars`, 'Combined character count of Continuity Injection plus Lore Injection using current Injection tab toggles and handling modes.'));
    container.appendChild(stats);

    container.appendChild(createDangerZoneCard(state));
}

function createInstructionsCard(guideMode = normalizeExperienceMode(getSettings().experienceMode)) {
    const wrap = document.createElement('div');
    wrap.className = 'saga-instructions-card';
    const mode = normalizeExperienceMode(guideMode);
    const guide = getRuntimeGuideContent(mode);
    const sections = getRuntimeGuideSections(mode);
    const allSteps = getRuntimeGuideSteps(mode);

    const intro = document.createElement('p');
    intro.className = 'saga-instructions-lede';
    intro.textContent = guide.lede;
    wrap.appendChild(intro);

    const actions = document.createElement('div');
    actions.className = 'saga-guide-actions';
    actions.appendChild(createButton(guide.tourLabel || 'Start Walkthrough', 'Open a guided walkthrough that moves through the related Saga tabs and controls.', () => {
        startRuntimeWalkthrough(mode);
    }, 'saga-primary-button'));
    wrap.appendChild(actions);

    const flow = document.createElement('div');
    flow.className = 'saga-instructions-flow saga-instructions-section-list';

    for (const section of sections) {
        const firstStep = section.steps?.[0] || null;
        const firstStepIndex = firstStep ? allSteps.findIndex(step => step.id === firstStep.id) : -1;
        const card = document.createElement('div');
        card.className = 'saga-instructions-section-card';
        const main = document.createElement('div');
        main.className = 'saga-instructions-section-main';
        const header = document.createElement('div');
        header.className = 'saga-instructions-section-header';
        const title = document.createElement('div');
        title.className = 'saga-instructions-section-title';
        title.textContent = section.label;
        header.appendChild(title);
        if (firstStepIndex >= 0) {
            header.appendChild(createStatusPill(formatGuideStartLabel(mode, firstStepIndex), `Starts at ${firstStep?.title || section.label}.`));
        }
        main.appendChild(header);
        const body = document.createElement('div');
        body.className = 'saga-instructions-section-body';
        body.textContent = section.description || `Walk through the ${section.label} tab.`;
        main.appendChild(body);
        const meta = document.createElement('div');
        meta.className = 'saga-instructions-section-meta';
        meta.appendChild(createStatusPill(`${section.stepCount} guided stop${section.stepCount === 1 ? '' : 's'}`, `${section.label} module stops; this is a guide path, not a feature limit.`));
        meta.appendChild(createStatusPill(getTabLabelForExperience(section.tab, getSettings()), `Opens the ${getTabLabelForExperience(section.tab, getSettings())} tab first.`));
        main.appendChild(meta);
        card.appendChild(main);
        const action = createButton('Start', `Start the ${section.label} walkthrough.`, () => {
            startRuntimeWalkthrough(mode, { sectionId: section.id });
        }, 'saga-mini-button saga-guide-step-button');
        card.appendChild(action);
        flow.appendChild(card);
    }

    wrap.appendChild(flow);

    if (String(guide.note || '').trim()) {
        const close = document.createElement('p');
        close.className = 'saga-instructions-note';
        close.textContent = guide.note;
        wrap.appendChild(close);
    }

    return wrap;
}
