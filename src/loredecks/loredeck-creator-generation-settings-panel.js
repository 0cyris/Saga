import {
    LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
    LOREDECK_CREATOR_GENERATION_SETTING_LIMITS,
    clampLoredeckCreatorInteger,
    normalizeLoredeckCreatorGenerationSettings,
} from './loredeck-creator-generation-settings.js';
import {
    addTooltip,
    createButton,
    createStatusPill,
    setChipTone,
} from '../ui/runtime-ui-kit.js';
import {
    createLoredeckActionRow,
} from './loredeck-action-rows.js';
import {
    createLoredeckCreatorArtifactDisclosure,
} from './loredeck-creator-panel.js';

function callOrFallback(fn, fallback, ...args) {
    return typeof fn === 'function' ? fn(...args) : fallback;
}

function getSettingsFromDeps(cached = {}, deps = {}) {
    return normalizeLoredeckCreatorGenerationSettings(callOrFallback(deps.getGenerationSettings, {}, cached));
}

function setSettingsWithDeps(patch = {}, deps = {}) {
    return callOrFallback(deps.setGenerationSettings, null, patch);
}

function resetSettingsWithDeps(deps = {}) {
    return callOrFallback(deps.resetGenerationSettings, null);
}

function toastWithDeps(message = '', tone = '', deps = {}) {
    callOrFallback(deps.toast, null, message, tone);
}

export function createLoredeckCreatorGenerationRangeRow(settings = {}, key = '', labelText = '', tooltip = '', deps = {}, options = {}) {
    const [min, max] = LOREDECK_CREATOR_GENERATION_SETTING_LIMITS[key] || [0, 10];
    const suffix = options.suffix || '';
    const onChange = typeof options.onChange === 'function' ? options.onChange : null;
    const row = document.createElement('label');
    row.className = 'saga-loredeck-creator-generation-row';
    const label = document.createElement('span');
    label.className = 'saga-loredeck-creator-generation-label';
    addTooltip(label, tooltip);
    const value = document.createElement('strong');
    const renderLabel = nextValue => {
        value.textContent = `${nextValue}${suffix}`;
        label.replaceChildren(document.createTextNode(`${labelText}: `), value);
    };
    const initial = clampLoredeckCreatorInteger(settings[key], min, max, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS[key]);
    renderLabel(initial);
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(initial);
    input.dataset.sagaCreatorGenerationSetting = key;
    input.addEventListener('input', () => {
        renderLabel(clampLoredeckCreatorInteger(input.value, min, max, initial));
    });
    input.addEventListener('change', () => {
        const nextValue = clampLoredeckCreatorInteger(input.value, min, max, initial);
        input.value = String(nextValue);
        renderLabel(nextValue);
        const nextSettings = setSettingsWithDeps({ [key]: nextValue }, deps)?.generationSettings;
        onChange?.(nextSettings || getSettingsFromDeps({}, deps));
    });
    row.appendChild(input);
    return {
        element: row,
        setValue(nextSettings = {}) {
            const nextValue = clampLoredeckCreatorInteger(nextSettings[key], min, max, LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS[key]);
            input.value = String(nextValue);
            renderLabel(nextValue);
        },
    };
}

export function createLoredeckCreatorGenerationToggleRow(settings = {}, key = '', labelText = '', tooltip = '', deps = {}, options = {}) {
    const onChange = typeof options.onChange === 'function' ? options.onChange : null;
    const defaultValue = options.defaultValue !== undefined ? options.defaultValue === true : true;
    const getChecked = nextSettings => Object.prototype.hasOwnProperty.call(nextSettings || {}, key)
        ? nextSettings[key] === true
        : defaultValue;
    const row = document.createElement('label');
    row.className = 'saga-loredeck-creator-generation-toggle';
    addTooltip(row, tooltip);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = getChecked(settings);
    input.dataset.sagaCreatorGenerationSetting = key;
    row.appendChild(input);
    const label = document.createElement('span');
    label.textContent = labelText;
    row.appendChild(label);
    const state = createStatusPill(input.checked ? 'On' : 'Off', `${labelText}: ${input.checked ? 'On' : 'Off'}`, {
        tone: input.checked ? 'success' : 'muted',
        kind: 'status',
        density: 'compact',
        className: 'saga-loredeck-creator-generation-toggle-value',
    });
    const renderState = () => {
        const text = input.checked ? 'On' : 'Off';
        state.textContent = text;
        state.dataset.sagaTooltip = `${labelText}: ${text}`;
        state.setAttribute('aria-label', `${labelText}: ${text}`);
        setChipTone(state, input.checked ? 'success' : 'muted');
    };
    renderState();
    row.appendChild(state);
    input.addEventListener('change', () => {
        renderState();
        const nextSettings = setSettingsWithDeps({ [key]: input.checked }, deps)?.generationSettings;
        onChange?.(nextSettings || getSettingsFromDeps({}, deps));
    });
    return {
        element: row,
        setValue(nextSettings = {}) {
            input.checked = getChecked(nextSettings);
            renderState();
        },
    };
}

export function renderLoredeckCreatorGenerationSettingsSummary(summary, settings = {}) {
    if (!summary) return;
    summary.replaceChildren(
        createStatusPill(`${settings.titleBatchLimit} titles/call`, 'Maximum title drafts requested in one Title Pass call.', { kind: 'metadata' }),
        createStatusPill(`${settings.entryBatchSize} Lorecards/call`, 'Maximum Lorecards requested in one Lorecard drafting call.', { kind: 'metadata' }),
        createStatusPill(`${settings.retryAttempts} retry${settings.retryAttempts === 1 ? '' : 'ies'}`, 'Automatic retry attempts for failed units before surfacing failure.', { kind: 'metadata' }),
        createStatusPill(settings.useUtilityProviderForSplitRetries ? 'Utility split retries on' : 'Utility split retries off', 'Whether one-title schema-rejection split retries may use the Utility Provider when it is configured.', { tone: settings.useUtilityProviderForSplitRetries ? 'success' : 'muted', kind: 'status' }),
        createStatusPill(settings.showStreamingProgress ? 'Streaming snippets on' : 'Streaming snippets off', 'Whether active model calls show short transient streaming snippets.', { tone: settings.showStreamingProgress ? 'success' : 'muted', kind: 'status' }),
    );
}

export function createLoredeckCreatorAdvancedGenerationSettings(cached = {}, deps = {}) {
    const settings = getSettingsFromDeps(cached, deps);
    const body = document.createElement('div');
    body.className = 'saga-loredeck-creator-generation-settings';
    const summary = document.createElement('div');
    summary.className = 'saga-loredeck-entry-summary';
    renderLoredeckCreatorGenerationSettingsSummary(summary, settings);
    body.appendChild(summary);
    const refreshSummary = nextSettings => {
        renderLoredeckCreatorGenerationSettingsSummary(summary, normalizeLoredeckCreatorGenerationSettings(nextSettings));
    };

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Advanced controls for provider reliability and batching. Smaller values cost more calls but reduce overlong-response failures.';
    body.appendChild(help);

    const rows = [];
    const grid = document.createElement('div');
    grid.className = 'saga-loredeck-creator-generation-grid';
    for (const row of [
        createLoredeckCreatorGenerationRangeRow(settings, 'titleBatchLimit', 'Title batch limit', 'Maximum title drafts Saga asks for in one Title Pass provider call.', deps, { onChange: refreshSummary }),
        createLoredeckCreatorGenerationRangeRow(settings, 'planningProposalLimit', 'Planning proposals', 'Maximum Context and Tag proposals Saga asks for in one planning call.', deps, { onChange: refreshSummary }),
        createLoredeckCreatorGenerationRangeRow(settings, 'entryBatchSize', 'Lorecards per call', 'Maximum full Lorecards Saga asks for in one micro-batch call.', deps, { onChange: refreshSummary }),
        createLoredeckCreatorGenerationRangeRow(settings, 'titleRunRemainingLimit', 'Title run limit', 'Maximum separate title-batch calls made by Generate Remaining.', deps, { onChange: refreshSummary }),
        createLoredeckCreatorGenerationRangeRow(settings, 'retryAttempts', 'Retry attempts', 'Automatic retry attempts after a malformed, empty, or failed generation unit.', deps, { onChange: refreshSummary }),
    ]) {
        rows.push(row);
        grid.appendChild(row.element);
    }
    body.appendChild(grid);

    const toggles = document.createElement('div');
    toggles.className = 'saga-loredeck-creator-generation-toggles';
    for (const row of [
        createLoredeckCreatorGenerationToggleRow(settings, 'retrySmaller', 'Auto split failed batches', 'When a Lorecard micro-batch fails or is rejected by schema guardrails, retry the affected titles in smaller batches.', deps, { onChange: refreshSummary }),
        createLoredeckCreatorGenerationToggleRow(settings, 'useUtilityProviderForSplitRetries', 'Use Utility for split retries', 'When Auto split failed batches retries one rejected Lorecard target, use the Utility Provider if it is configured; otherwise Saga falls back to the Reasoning Provider.', deps, { onChange: refreshSummary, defaultValue: false }),
        createLoredeckCreatorGenerationToggleRow(settings, 'showStreamingProgress', 'Show streaming progress snippets', 'Show short transient snippets while a provider call is running. Completed raw output is not rendered.', deps, { onChange: refreshSummary }),
    ]) {
        rows.push(row);
        toggles.appendChild(row.element);
    }
    body.appendChild(toggles);

    const actions = createLoredeckActionRow();
    actions.appendChild(createButton('Reset Advanced Settings', 'Restore conservative Deck Maker generation defaults.', () => {
        const next = resetSettingsWithDeps(deps)?.generationSettings || { ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS };
        for (const row of rows) row.setValue(next);
        refreshSummary(next);
        toastWithDeps('Deck Maker generation settings reset.', 'info', deps);
    }));
    body.appendChild(actions);

    return createLoredeckCreatorArtifactDisclosure(
        'Advanced Generation Settings',
        body,
        { open: false, state: 'Batching & retries', anchor: 'advanced-generation' }
    );
}
