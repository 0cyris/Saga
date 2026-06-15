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
import { createBasicStartReadinessCard, getBasicReadinessAction, getBasicReadinessModel } from './session-basic-panel.js';
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
import {
    getRuntimeMobileActiveSubview,
    isRuntimeMobileShell,
    pushRuntimeMobileSubview,
} from './runtime-shell.js';

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
    const mobileSubview = getSessionMobileSubview(state, settings);
    container.classList.add('saga-operator-tab', 'saga-session-operator-tab');

    container.appendChild(createSectionHeader(
        'Session Controls',
        basic ? 'Review Session Readiness and runtime state for this chat.' : 'Set how Saga behaves during roleplay.'
    ));
    container.appendChild(createSessionOperatorSummary(state, settings, { basic, guideMode, mobileSubview }));
    if (isRuntimeMobileShell() && !mobileSubview) return;

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
        addTooltip(modeTitle, 'Automation Mode controls whether Saga scans and generates only when clicked, or automatically after roleplay turns. Experience Mode lives in Settings.');
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
    addTooltip(statsTitle, 'Runtime counters for Pending Review entries, Accepted Lorecards, relevance tiers, and current injection size.');
    stats.appendChild(statsTitle);
    const counts = getPanelLoreState(state).counts;
    const selectedLoreCount = getSelectedLoreInjectionCount(state, settings);
    const injectionStats = getInjectionCharacterStats(state, settings);
    stats.appendChild(createKeyValue('Active chat', getActiveChatMetricName(), 'The active SillyTavern chat whose Saga metrics and chat metadata are being shown.'));
    stats.appendChild(createKeyValue('Pending continuity changes', state?.lastDelta ? '1' : '0', 'Legacy extracted state delta waiting in the Continuity tab. New scans apply directly to Continuity sections.'));
    stats.appendChild(createKeyValue('Pending Review', String((state?.pendingLoreEntries || []).length), 'Generated Lorecards waiting in the Lorecards tab Pending Review section.'));
    stats.appendChild(createKeyValue('Accepted Lorecards', String(counts.all - counts.pending), 'Accepted Lorecards currently stored in the lore matrix.'));
    stats.appendChild(createKeyValue('High-relevance Accepted Lorecards', String(counts.active), 'Accepted Lorecards currently assigned to the High-Relevance injection tier.'));
    stats.appendChild(createKeyValue('Lorecards selected for injection', String(selectedLoreCount), 'Accepted Lorecards selected for Lore Injection after pin/mute rules, Context activation, and fallback priority selection. There is no hidden entry cap; mute entries to exclude them.'));
    stats.appendChild(createKeyValue('Injection token estimate', injectionStats.totalChars ? `${injectionStats.totalTokens} tokens` : 'empty', 'Approximate token count for the combined Continuity + Lore injection previews.'));
    stats.appendChild(createKeyValue('Total chars injected', `${injectionStats.totalChars} chars`, 'Combined character count of Continuity Injection plus Lore Injection using current Injection tab toggles and handling modes.'));
    container.appendChild(stats);
}

function getSessionMobileSubview(state, settings = getSettings()) {
    if (!isRuntimeMobileShell()) return null;
    return getRuntimeMobileActiveSubview(state?.lorePanel, 'session', settings);
}

function openSessionMobileDetails() {
    pushRuntimeMobileSubview('session', {
        id: 'session-details',
        title: 'Session Details',
    });
}

function createBasicSessionNextActionButton(readiness) {
    const row = readiness?.nextAction;
    if (!row || row.ready || !row.actionLabel || row.actionId === 'enable-saga') return null;
    const action = getBasicReadinessAction(row);
    if (typeof action !== 'function') return null;
    return createButton(`Next: ${row.actionLabel}`, row.missingText || 'Open the next Basic workflow step.', action, 'saga-primary-button');
}

function createSessionOperatorSummary(state, settings, options = {}) {
    const basic = options.basic === true;
    const guideMode = options.guideMode || (basic ? 'basic' : 'advanced');
    const mobileSubview = options.mobileSubview || null;
    const readiness = basic ? getBasicReadinessModel(state, settings) : null;
    const counts = getPanelLoreState(state).counts;
    const pendingLore = (state?.pendingLoreEntries || []).length;
    const selectedLore = getSelectedLoreInjectionCount(state, settings);
    const injectionStats = getInjectionCharacterStats(state, settings);
    const enabled = settings.enabled !== false;
    const currentMode = normalizeAutomationMode(settings.automationMode || settings.workflowMode);
    const mobileRoot = isRuntimeMobileShell() && !mobileSubview;

    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-operator-summary-card saga-session-operator-summary';
    markTourTarget(card, 'session.operator.summary');

    const header = document.createElement('div');
    header.className = 'saga-operator-summary-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'saga-operator-summary-title-wrap';
    const title = document.createElement('div');
    title.className = 'saga-runtime-card-title saga-operator-summary-title';
    title.textContent = 'Session Readiness';
    addTooltip(title, 'Mobile operator summary for Saga runtime readiness and the next useful Session action.');
    titleWrap.appendChild(title);
    const subtitle = document.createElement('div');
    subtitle.className = 'saga-runtime-help saga-operator-summary-subtitle';
    subtitle.textContent = readiness?.nextAction?.ready
        ? 'Saga is ready for the next response.'
        : (readiness?.nextAction?.missingText || (enabled ? AUTOMATION_MODES[currentMode].description : 'Saga is paused for this chat.'));
    titleWrap.appendChild(subtitle);
    header.appendChild(titleWrap);

    const chips = document.createElement('div');
    chips.className = 'saga-loredeck-row-meta saga-operator-summary-chips';
    chips.appendChild(createStatusPill(enabled ? 'Saga Active' : 'Paused', enabled ? 'Saga runtime behavior is enabled.' : 'Saga runtime behavior is paused.', { tone: enabled ? 'success' : 'muted', kind: 'status' }));
    chips.appendChild(createStatusPill(getAutomationLabel(currentMode), 'Current automation mode for runtime actions.', { tone: currentMode === 'manual' ? 'muted' : 'info', kind: 'status' }));
    if (pendingLore) chips.appendChild(createStatusPill(`${pendingLore} pending`, 'Pending Review entries waiting for review.', { tone: 'review', kind: 'count' }));
    chips.appendChild(createStatusPill(`${selectedLore} selected`, 'Accepted Lorecards selected for the next injection.', { tone: selectedLore ? 'selected' : 'muted', kind: 'count' }));
    header.appendChild(chips);
    if (mobileRoot) {
        header.classList.add('saga-operator-summary-header-tappable');
        header.tabIndex = 0;
        header.setAttribute('role', 'button');
        addTooltip(header, 'Tap to open runtime toggles, walkthrough notes, and Session metrics.');
        header.setAttribute('aria-label', 'Open Session Details');
        const openDetails = event => {
            if (event?.target?.closest?.('button, input, select, textarea, label, a')) return;
            openSessionMobileDetails();
        };
        header.addEventListener('click', openDetails);
        header.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openDetails(event);
        });
        markTourTarget(header, 'session.operator.details');
    }
    card.appendChild(header);

    const stats = document.createElement('div');
    stats.className = 'saga-operator-stat-grid';
    stats.appendChild(createKeyValue('Active chat', getActiveChatMetricName(), 'The active SillyTavern chat whose Saga runtime state is shown.'));
    if (mobileRoot) {
        stats.appendChild(createKeyValue('Pending Review', String(pendingLore), 'Generated Lorecards waiting in Pending Review.'));
        stats.appendChild(createKeyValue('Accepted Lorecards', String(Math.max(0, (counts?.all || 0) - (counts?.pending || 0))), 'Accepted Lorecards stored in the lore matrix.'));
        stats.appendChild(createKeyValue('High relevance', String(counts?.active || 0), 'Accepted Lorecards currently assigned to the High-Relevance injection tier.'));
        stats.appendChild(createKeyValue('Selected for injection', String(selectedLore), 'Accepted Lorecards selected for the next injection.'));
        stats.appendChild(createKeyValue('Injection estimate', injectionStats.totalChars ? `${injectionStats.totalTokens} tokens` : 'empty', 'Approximate current injection token count.'));
    } else {
        stats.appendChild(createKeyValue('Accepted Lorecards', String(Math.max(0, (counts?.all || 0) - (counts?.pending || 0))), 'Accepted Lorecards stored in the lore matrix.'));
        stats.appendChild(createKeyValue('Injection estimate', injectionStats.totalChars ? `${injectionStats.totalTokens} tokens` : 'empty', 'Approximate current injection token count.'));
    }
    card.appendChild(stats);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-operator-summary-actions';
    if (!enabled) {
        actions.appendChild(createButton('Enable Saga', 'Turn Saga runtime behavior back on for this chat.', () => {
            const next = getSettings();
            next.enabled = true;
            saveSettings(next);
            refreshPanelBody({ preserveScroll: false });
            refreshHeader();
        }, 'saga-primary-button'));
    }
    const nextAction = basic && mobileRoot
        ? createBasicSessionNextActionButton(readiness)
        : null;
    if (nextAction) actions.appendChild(nextAction);
    actions.appendChild(createButton(
        basic ? 'Start Guided Tour' : 'Start Walkthrough',
        basic ? 'Open the Basic guided tour from Session Readiness.' : 'Open the Advanced runtime walkthrough.',
        () => startRuntimeWalkthrough(guideMode),
        enabled && !nextAction ? 'saga-primary-button' : ''
    ));
    card.appendChild(actions);
    return card;
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
            header.appendChild(createStatusPill(formatGuideStartLabel(mode, firstStepIndex), `Starts at ${firstStep?.title || section.label}.`, { tone: 'info', kind: 'status' }));
        }
        main.appendChild(header);
        const body = document.createElement('div');
        body.className = 'saga-instructions-section-body';
        body.textContent = section.description || `Walk through the ${section.label} tab.`;
        main.appendChild(body);
        const meta = document.createElement('div');
        meta.className = 'saga-instructions-section-meta';
        meta.appendChild(createStatusPill(`${section.stepCount} guided stop${section.stepCount === 1 ? '' : 's'}`, `${section.label} module stops; this is a guide path, not a feature limit.`, { kind: 'count' }));
        meta.appendChild(createStatusPill(getTabLabelForExperience(section.tab, getSettings()), `Opens the ${getTabLabelForExperience(section.tab, getSettings())} tab first.`, { tone: 'source', kind: 'source' }));
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
