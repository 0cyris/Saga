import {
    DEFAULT_SETTINGS,
    SAGA_PROVIDER_PRESET_ASSET_PATH,
    SAGA_PROVIDER_PRESET_NAME,
    SAGA_PROVIDER_PRESET_VERSION,
} from '../state/constants.js';
import {
    getSettings,
    saveSettings,
} from '../state/state-manager.js';
import {
    clearCachedApiKey,
    fetchLoreModels,
    getAvailableConnectionProfiles,
    getProviderModelStatus,
    loadApiKey,
    testLoreConnection,
    validateLoreProviderConfiguration,
} from '../providers/lore-llm-client.js';
import {
    deleteNamedApiKey,
    getNamedApiKeyStorageInfo,
    storeNamedApiKey,
} from '../state/secure-keyring.js';
import {
    addTooltip,
    confirmAction,
    createButton,
    createCompactPresetStat,
    createStatusPill,
    isPlainObjectValue,
    runBusyAction,
    setChipTone,
    showNoticePopup,
    toast,
} from '../ui/runtime-ui-kit.js';
import {
    getLocalAssetSrc,
} from '../theme/runtime-theme.js';

const CHAT_COMPLETION_PRESET_API_ID = 'openai';

let settingsPanelDeps = {};
let bundledProviderPresetCache = null;

export function configureSettingsPanel(deps = {}) {
    settingsPanelDeps = { ...settingsPanelDeps, ...(deps || {}) };
}

function dep(name, fallback = null) {
    const value = settingsPanelDeps?.[name];
    if (typeof value === 'function') return value;
    if (typeof fallback === 'function') return fallback;
    throw new Error(`Saga Settings panel dependency is not configured: ${name}`);
}

function refreshSettingsPanel(options = {}) {
    return dep('refreshSettingsPanel', () => null)(options);
}

function refreshRuntimeHeader() {
    return dep('refreshRuntimeHeader', () => null)();
}

function openAdvancedSettings() {
    return dep('openAdvancedSettings', () => null)();
}

function downloadJson(data, filename) {
    return dep('downloadJson', () => null)(data, filename);
}

function markTourTarget(el, target) {
    return dep('markTourTarget', element => element)(el, target);
}

export function createProviderSettingsCard(settings = getSettings()) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-settings-provider-card';
    const title = document.createElement('h4');
    title.textContent = 'Providers';
    card.appendChild(title);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Configure the Utility and Reasoning providers used by Saga model-backed workflows.';
    card.appendChild(help);

    const providers = document.createElement('div');
    providers.className = 'saga-provider-runtime-list';
    providers.appendChild(createRuntimeProviderBlock('continuity', settings));
    providers.appendChild(createRuntimeProviderBlock('lore', settings));
    card.appendChild(providers);

    card.appendChild(createProviderPresetStatusCard());
    return card;
}

export function createBasicProviderQuickSetupCard(settings = getSettings()) {
    const card = document.createElement('div');
    card.className = 'saga-runtime-card saga-settings-basic-provider-card';
    const title = document.createElement('h4');
    title.textContent = 'Providers';
    card.appendChild(title);

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Provider setup is only needed for model-backed actions. You can load Loredecks, set Context, review existing Lorecards, and inject Accepted Lorecards without configuring a provider first.';
    card.appendChild(help);

    const providers = document.createElement('div');
    providers.className = 'saga-provider-runtime-list saga-basic-provider-list';
    providers.appendChild(createBasicProviderQuickSetupRow('continuity', settings));
    providers.appendChild(createBasicProviderQuickSetupRow('lore', settings));
    card.appendChild(providers);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-basic-provider-actions';
    actions.appendChild(markTourTarget(createButton('Open Advanced Provider Settings', 'Switch to Advanced Experience for provider profiles, endpoints, models, generation parameters, and API compatibility flags.', openAdvancedSettings), 'settings.provider.advanced'));
    card.appendChild(actions);

    return card;
}

function createBasicProviderQuickSetupRow(kind, settings = getSettings()) {
    const cfg = getProviderUiConfig(kind);
    const prefix = getProviderPrefix(kind);
    const provider = settings[`${prefix}Provider`] || 'st';
    const validation = safeValidateProviderConfiguration(kind);
    const modelStatus = getProviderModelStatus(kind, settings);

    const block = document.createElement('section');
    block.className = `saga-provider-runtime-block saga-basic-provider-block saga-provider-runtime-${kind}`;
    markTourTarget(block, kind === 'continuity' ? 'settings.provider.utility' : 'settings.provider.reasoning');

    const header = document.createElement('div');
    header.className = 'saga-provider-runtime-header';
    const titleGroup = document.createElement('div');
    titleGroup.className = 'saga-provider-runtime-title-group';
    const blockTitle = document.createElement('h5');
    blockTitle.textContent = `${cfg.shortTitle} Provider`;
    titleGroup.appendChild(blockTitle);
    const description = document.createElement('div');
    description.className = 'saga-runtime-help';
    description.textContent = kind === 'continuity'
        ? 'Used when Saga scans, summarizes, or checks recent story.'
        : 'Used when Saga creates Lorecards, detects Context with a model, or builds generated lore.';
    titleGroup.appendChild(description);
    header.appendChild(titleGroup);
    const status = createStatusPill(validation.ok ? 'Ready' : 'Needs setup', validation.message || `${cfg.shortTitle} provider status.`, { tone: validation.ok ? 'success' : 'warning', kind: 'status' });
    header.appendChild(status);
    block.appendChild(header);

    const summary = document.createElement('div');
    summary.className = 'saga-basic-provider-summary';
    summary.appendChild(createBasicProviderSummaryRow('Source', getProviderLabel(provider), `Current ${cfg.shortTitle.toLowerCase()} provider source.`));
    summary.appendChild(createBasicProviderSummaryRow('Model', modelStatus.label, modelStatus.tooltip || `Current ${cfg.shortTitle.toLowerCase()} provider model.`));
    summary.appendChild(createBasicProviderSummaryRow('Status', validation.ok ? 'Ready for model actions' : (validation.message || 'Needs setup'), validation.message || `${cfg.shortTitle} provider validation result.`));
    block.appendChild(summary);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-provider-runtime-actions';
    markTourTarget(actions, 'settings.provider.test');
    actions.appendChild(createButton(`Test ${cfg.shortTitle}`, `Send a tiny JSON test request through the ${cfg.shortTitle} provider.`, async (btn) => {
        await runBusyAction(btn, 'Testing...', async () => {
            const result = await testLoreConnection(kind);
            toast(`${cfg.shortTitle} provider connected: ${String(result.response || '').slice(0, 80)}`, 'success');
            refreshSettingsPanel({ preserveScroll: true, preserveWindowScroll: true });
        });
    }, 'saga-primary-button'));
    if (provider !== 'st') {
        actions.appendChild(createButton('Use Current Model', `Use the active SillyTavern model for ${cfg.shortTitle.toLowerCase()} tasks.`, () => {
            saveProviderSetting(kind, 'Provider', 'st');
            toast(`${cfg.shortTitle} provider now uses the current SillyTavern model.`, 'info');
        }));
    }
    block.appendChild(actions);

    return block;
}

function createBasicProviderSummaryRow(labelText, valueText, tooltip) {
    const row = document.createElement('div');
    row.className = 'saga-basic-provider-summary-row';
    addTooltip(row, tooltip || labelText);
    const label = document.createElement('span');
    label.className = 'saga-basic-provider-summary-label';
    label.textContent = labelText;
    row.appendChild(label);
    const value = document.createElement('span');
    value.className = 'saga-basic-provider-summary-value';
    value.textContent = valueText || 'Not set';
    row.appendChild(value);
    return row;
}

function createRuntimeProviderBlock(kind, settings = getSettings()) {
    const cfg = getProviderUiConfig(kind);
    const prefix = getProviderPrefix(kind);
    const provider = settings[`${prefix}Provider`] || 'st';
    const validation = safeValidateProviderConfiguration(kind);

    const block = document.createElement('section');
    block.className = `saga-provider-runtime-block saga-provider-runtime-${kind}`;

    const header = document.createElement('div');
    header.className = 'saga-provider-runtime-header';
    const titleGroup = document.createElement('div');
    titleGroup.className = 'saga-provider-runtime-title-group';
    const blockTitle = document.createElement('h5');
    blockTitle.textContent = cfg.title;
    titleGroup.appendChild(blockTitle);
    const description = document.createElement('div');
    description.className = 'saga-runtime-help';
    description.textContent = cfg.description;
    titleGroup.appendChild(description);
    header.appendChild(titleGroup);
    const status = createStatusPill(validation.ok ? 'Ready' : 'Needs setup', validation.message || `${cfg.title} provider status.`, { tone: validation.ok ? 'success' : 'warning', kind: 'status' });
    header.appendChild(status);
    block.appendChild(header);

    block.appendChild(createProviderChoiceField(kind, settings));

    if (provider === 'profile') block.appendChild(createProviderProfileSection(kind, settings));
    if (provider === 'openai_compatible') block.appendChild(createProviderOpenAiSection(kind, settings));

    block.appendChild(createProviderGenerationSection(kind, settings));

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions saga-provider-runtime-actions';
    actions.appendChild(createButton(`Test ${cfg.shortTitle}`, `Send a tiny JSON test request through the ${cfg.shortTitle} provider.`, async (btn) => {
        await runBusyAction(btn, 'Testing...', async () => {
            const result = await testLoreConnection(kind);
            toast(`${cfg.shortTitle} provider connected: ${String(result.response || '').slice(0, 80)}`, 'success');
            refreshSettingsPanel({ preserveScroll: true, preserveWindowScroll: true });
        });
    }, 'saga-primary-button'));
    actions.appendChild(createButton('Reset Defaults', `Reset ${cfg.shortTitle} provider settings to bundled defaults. Stored API keys are preserved.`, async () => {
        const proceed = await confirmAction(`Reset ${cfg.shortTitle} provider?`, `This resets the ${cfg.shortTitle} provider selection, endpoint, model, and generation parameters to bundled defaults. Stored API keys are preserved. Continue?`);
        if (!proceed) return;
        resetProviderSettingsToDefaults(kind);
    }));
    block.appendChild(actions);

    if (!validation.ok && validation.message) {
        const note = document.createElement('div');
        note.className = 'saga-provider-connection-status saga-provider-connection-warning';
        note.textContent = validation.message;
        block.appendChild(note);
    }

    return block;
}

function getProviderUiConfig(kind) {
    if (kind === 'continuity') {
        return {
            prefix: 'continuity',
            title: 'Utility Provider',
            shortTitle: 'Utility',
            secretName: 'continuityOpenAI',
            description: 'Used by compression and scene continuity scans. Choose a fast, inexpensive model for frequent background work.',
        };
    }
    return {
        prefix: 'lore',
        title: 'Reasoning Provider',
        shortTitle: 'Reasoning',
        secretName: 'loreOpenAI',
        description: 'Used by Detect Context, Story Lore generation, and Context model fallback. Choose a stronger model for structured reasoning.',
    };
}

function getProviderPrefix(kind) {
    return getProviderUiConfig(kind).prefix;
}

function getProviderSettingKey(kind, suffix) {
    return `${getProviderPrefix(kind)}${suffix}`;
}

function getProviderLabel(provider) {
    const labels = {
        st: 'Current SillyTavern Model',
        profile: 'Connection Profile',
        openai_compatible: 'OpenAI-Compatible Endpoint',
    };
    return labels[provider] || provider || 'Unknown';
}

function safeValidateProviderConfiguration(kind) {
    try {
        return validateLoreProviderConfiguration(kind);
    } catch (e) {
        return { ok: false, provider: '', kind, message: e?.message || String(e) };
    }
}

function createProviderChoiceField(kind, settings = getSettings()) {
    const prefix = getProviderPrefix(kind);
    const cfg = getProviderUiConfig(kind);
    const select = document.createElement('select');
    select.id = `saga_${prefix}_provider_runtime`;
    select.appendChild(createOption('st', 'Current SillyTavern Model'));
    select.appendChild(createOption('profile', 'Connection Profile'));
    select.appendChild(createOption('openai_compatible', 'OpenAI-Compatible Endpoint'));
    select.value = settings[`${prefix}Provider`] || 'st';
    select.addEventListener('change', () => {
        saveProviderSetting(kind, 'Provider', select.value);
    });
    return createProviderField('Provider', `Select which model source Saga uses for ${cfg.shortTitle.toLowerCase()} tasks.`, select);
}

function createProviderProfileSection(kind, settings = getSettings()) {
    const cfg = getProviderUiConfig(kind);
    const prefix = getProviderPrefix(kind);
    const section = createProviderRuntimeSection('Connection Profile');

    const help = document.createElement('div');
    help.className = 'saga-runtime-help';
    help.textContent = 'Connection Profiles keep provider routing and keys in SillyTavern. Use the thin Provider preset with the selected profile.';
    section.appendChild(help);

    const select = document.createElement('select');
    select.id = `saga_${prefix}_profile_id_runtime`;
    const profiles = getNormalizedConnectionProfiles();
    select.appendChild(createOption('', profiles.length ? 'Select Profile' : 'No connection profiles found'));
    for (const profile of profiles) {
        select.appendChild(createOption(profile.id, profile.label));
    }
    select.value = settings[`${prefix}ProfileId`] || '';
    select.disabled = profiles.length === 0;
    select.addEventListener('change', () => {
        saveProviderSetting(kind, 'ProfileId', select.value);
    });
    section.appendChild(createProviderField('Profile', `Connection Profile used for ${cfg.shortTitle.toLowerCase()} tasks.`, select));
    return section;
}

function getNormalizedConnectionProfiles() {
    let profiles = [];
    try {
        profiles = getAvailableConnectionProfiles() || [];
    } catch (e) {
        console.warn('[Saga] Could not list connection profiles:', e);
    }
    const seen = new Set();
    const out = [];
    for (const item of profiles) {
        if (!item || typeof item !== 'object') continue;
        const id = String(item.id || item.name || item.profileId || item.uuid || item.profile_id || item.label || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const label = String(item.name || item.label || item.profileName || item.model || id).trim();
        out.push({ id, label });
    }
    return out;
}

function createProviderOpenAiSection(kind, settings = getSettings()) {
    const cfg = getProviderUiConfig(kind);
    const prefix = getProviderPrefix(kind);
    const section = createProviderRuntimeSection('OpenAI-Compatible Endpoint');

    const baseInput = createProviderTextControl({
        id: `saga_${prefix}_openai_base_url_runtime`,
        value: settings[`${prefix}OpenAIBaseUrl`] || '',
        placeholder: 'https://api.openai.com',
        tooltip: `OpenAI-compatible base URL for ${cfg.shortTitle.toLowerCase()} tasks.`,
    });
    baseInput.addEventListener('change', () => saveProviderSetting(kind, 'OpenAIBaseUrl', baseInput.value.trim(), { refresh: false }));
    baseInput.addEventListener('keydown', (event) => commitProviderTextOnEnter(event, kind, 'OpenAIBaseUrl', baseInput));
    section.appendChild(createProviderField('Base URL', `OpenAI-compatible base URL for ${cfg.shortTitle.toLowerCase()} tasks.`, baseInput));

    const modelInput = createProviderTextControl({
        id: `saga_${prefix}_openai_model_search_runtime`,
        value: settings[`${prefix}OpenAIModel`] || '',
        placeholder: 'Search or type model ID...',
        tooltip: 'Type to filter fetched models, or type an exact model ID.',
    });
    modelInput.addEventListener('change', () => saveProviderSetting(kind, 'OpenAIModel', modelInput.value.trim(), { refresh: false }));
    modelInput.addEventListener('keydown', (event) => commitProviderTextOnEnter(event, kind, 'OpenAIModel', modelInput));

    const modelSelect = document.createElement('select');
    modelSelect.id = `saga_${prefix}_openai_model_runtime`;
    modelSelect.disabled = true;
    modelSelect.appendChild(createOption('', 'Fetch models or type a model ID above'));

    let fetchedModels = [];
    modelInput.addEventListener('input', () => {
        if (fetchedModels.length) renderProviderModelOptions(modelSelect, fetchedModels, modelInput.value, modelInput.value);
    });
    modelSelect.addEventListener('change', () => {
        if (!modelSelect.value) return;
        modelInput.value = modelSelect.value;
        saveProviderSetting(kind, 'OpenAIModel', modelSelect.value);
    });

    const modelStatus = createProviderRuntimeStatusPill(
        settings[`${prefix}OpenAIModel`] ? `Saved model: ${settings[`${prefix}OpenAIModel`]}` : 'Fetch models or type an exact model ID.',
        settings[`${prefix}OpenAIModel`] ? `Saved ${cfg.shortTitle.toLowerCase()} model ID.` : `Fetch models from the ${cfg.shortTitle.toLowerCase()} endpoint or type an exact model ID.`,
        { tone: settings[`${prefix}OpenAIModel`] ? 'source' : 'muted', kind: settings[`${prefix}OpenAIModel`] ? 'source' : 'status' }
    );

    const modelRow = document.createElement('div');
    modelRow.className = 'saga-provider-runtime-control-row';
    modelRow.appendChild(modelInput);
    modelRow.appendChild(createButton('Fetch Models', `Fetch available models from the ${cfg.shortTitle.toLowerCase()} API endpoint.`, async (btn) => {
        await runBusyAction(btn, 'Fetching...', async () => {
            saveProviderSetting(kind, 'OpenAIBaseUrl', baseInput.value.trim(), { refresh: false });
            saveProviderSetting(kind, 'OpenAIModel', modelInput.value.trim(), { refresh: false });
            updateProviderRuntimeStatusPill(modelStatus, 'Fetching models...', `Fetching models from the ${cfg.shortTitle.toLowerCase()} endpoint.`, 'info');
            fetchedModels = await fetchLoreModels(kind);
            renderProviderModelOptions(modelSelect, fetchedModels, modelInput.value, modelInput.value);
            updateProviderRuntimeStatusPill(
                modelStatus,
                `${fetchedModels.length} model${fetchedModels.length === 1 ? '' : 's'} fetched.`,
                `Fetched ${fetchedModels.length} model${fetchedModels.length === 1 ? '' : 's'} from the ${cfg.shortTitle.toLowerCase()} endpoint.`,
                fetchedModels.length ? 'success' : 'warning'
            );
        });
    }));

    const modelField = document.createElement('div');
    modelField.className = 'saga-provider-runtime-field saga-provider-runtime-model-field';
    const modelLabel = document.createElement('span');
    modelLabel.textContent = 'Model';
    addTooltip(modelLabel, 'Model used by this OpenAI-compatible provider.');
    modelField.appendChild(modelLabel);
    const modelControls = document.createElement('div');
    modelControls.className = 'saga-provider-runtime-field-stack';
    modelControls.appendChild(modelRow);
    modelControls.appendChild(modelSelect);
    modelControls.appendChild(modelStatus);
    modelField.appendChild(modelControls);
    section.appendChild(modelField);

    section.appendChild(createProviderApiKeyField(kind, settings));
    return section;
}

function getProviderRuntimeStatusTone(text = '') {
    const value = String(text || '').trim().toLowerCase();
    if (!value || value.includes('not stored') || value.includes('fetch models') || value.includes('type an exact model')) return 'muted';
    if (value.includes('fallback obfuscation') || value.includes('unavailable') || value.includes('no matching')) return 'warning';
    if (value.includes('fetching')) return 'info';
    if (value.includes('fetched') || value.includes('encrypted at rest')) return 'success';
    if (value.includes('saved model') || value === 'stored.' || value.includes('stored with')) return 'source';
    return 'neutral';
}

function getProviderRuntimeStatusKind(text = '') {
    return /\b\d+\b/.test(String(text || '')) ? 'count' : 'status';
}

function createProviderRuntimeStatusPill(text = '', tooltip = '', options = {}) {
    const label = String(text || '').trim() || 'Not set.';
    return createStatusPill(label, tooltip || label, {
        tone: options.tone || getProviderRuntimeStatusTone(label),
        kind: options.kind || getProviderRuntimeStatusKind(label),
        density: 'compact',
        className: `saga-provider-runtime-status ${options.className || ''}`.trim(),
        maxChars: options.maxChars || 64,
    });
}

function updateProviderRuntimeStatusPill(pill, text = '', tooltip = '', tone = '') {
    if (!pill) return;
    const label = String(text || '').trim() || 'Not set.';
    pill.textContent = label;
    if (tooltip || pill.dataset?.sagaTooltip) {
        pill.dataset.sagaTooltip = tooltip || label;
        pill.setAttribute('aria-label', tooltip || label);
    }
    setChipTone(pill, tone || getProviderRuntimeStatusTone(label));
}

function renderProviderModelOptions(select, models, filterText = '', currentModel = '') {
    if (!select) return;
    const filter = String(filterText || '').trim().toLowerCase();
    const matches = (Array.isArray(models) ? models : [])
        .filter(model => {
            const id = String(model?.id || '').trim();
            const name = String(model?.name || '').trim();
            if (!id) return false;
            if (!filter) return true;
            return id.toLowerCase().includes(filter) || name.toLowerCase().includes(filter);
        })
        .slice(0, 200);

    select.textContent = '';
    select.disabled = matches.length === 0;
    select.appendChild(createOption('', matches.length ? 'Select fetched model' : 'No matching models'));
    for (const model of matches) {
        const id = String(model.id || '').trim();
        const name = String(model.name || id).trim();
        select.appendChild(createOption(id, name && name !== id ? `${id} - ${name}` : id));
    }
    if (matches.some(model => String(model.id || '') === currentModel)) select.value = currentModel;
}

async function confirmProviderDirectApiKeyStorage(kind) {
    const cfg = getProviderUiConfig(kind);
    const info = getNamedApiKeyStorageInfo(cfg.secretName);
    const storageLabel = info.webCryptoAvailable
        ? 'Saga will use browser WebCrypto encryption at rest, but decrypted keys still live in browser memory for provider calls.'
        : 'This browser context does not expose WebCrypto, so Saga will use fallback obfuscation, not encryption.';
    return confirmAction(
        `Store ${cfg.shortTitle} API key directly in Saga?`,
        `${cfg.shortTitle} direct API key storage is intended for alpha testing. Prefer a SillyTavern Connection Profile or backend proxy when possible.\n\n${storageLabel}\n\nStore this key directly in Saga anyway?`
    );
}

function createProviderApiKeyField(kind, settings = getSettings()) {
    const cfg = getProviderUiConfig(kind);
    const prefix = getProviderPrefix(kind);
    const secretName = cfg.secretName;
    const storageInfo = getNamedApiKeyStorageInfo(secretName);

    const field = document.createElement('div');
    field.className = 'saga-provider-runtime-field saga-provider-key-field';
    const label = document.createElement('span');
    label.textContent = 'API Key';
    addTooltip(label, `API key stored encrypted locally for ${cfg.shortTitle.toLowerCase()} tasks.`);
    field.appendChild(label);

    const stack = document.createElement('div');
    stack.className = 'saga-provider-runtime-field-stack';
    const row = document.createElement('div');
    row.className = 'saga-provider-runtime-control-row';
    const input = document.createElement('input');
    input.id = `saga_${prefix}_openai_key_runtime`;
    input.type = 'password';
    input.placeholder = storageInfo.isStored ? 'Stored key is hidden' : 'Enter API key';
    addTooltip(input, `API key stored encrypted locally for ${cfg.shortTitle.toLowerCase()} tasks.`);
    row.appendChild(input);

    row.appendChild(createButton('Store', `Encrypt and store the entered ${cfg.shortTitle.toLowerCase()} API key.`, async (btn) => {
        await runBusyAction(btn, 'Storing...', async () => {
            const value = String(input.value || '').trim();
            if (!value) throw new Error('Enter an API key first.');
            const proceed = await confirmProviderDirectApiKeyStorage(kind);
            if (!proceed) return;
            const result = await storeNamedApiKey(secretName, value);
            clearCachedApiKey(kind);
            await loadApiKey(kind);
            input.value = '';
            if (result?.encryptedAtRest === false) {
                toast(`${cfg.shortTitle} API key stored with fallback obfuscation, not encryption. Prefer a SillyTavern Connection Profile or backend proxy.`, 'warning');
            } else {
                toast(`${cfg.shortTitle} API key encrypted and stored. Prefer a SillyTavern Connection Profile or backend proxy for stronger isolation.`, 'success');
            }
            refreshSettingsPanel({ preserveScroll: true, preserveWindowScroll: true });
        });
    }));
    row.appendChild(createButton('Clear', `Remove the stored ${cfg.shortTitle.toLowerCase()} API key.`, async (btn) => {
        await runBusyAction(btn, 'Clearing...', async () => {
            await deleteNamedApiKey(secretName);
            clearCachedApiKey(kind);
            toast(`${cfg.shortTitle} API key cleared.`, 'info');
            refreshSettingsPanel({ preserveScroll: true, preserveWindowScroll: true });
        });
    }, 'saga-danger-button'));
    stack.appendChild(row);

    const status = createProviderRuntimeStatusPill(
        formatProviderKeyStorageInfo(storageInfo, settings[`${prefix}OpenAIKeySet`]),
        getProviderKeyStorageTooltip(storageInfo),
        {
            tone: getProviderKeyStorageTone(storageInfo, settings[`${prefix}OpenAIKeySet`]),
            kind: 'status',
        }
    );
    stack.appendChild(status);

    field.appendChild(stack);
    return field;
}

function formatProviderKeyStorageInfo(info, keySetFallback = false) {
    if (!info?.isStored && !keySetFallback) return 'Not stored.';
    if (info?.compatibilityStorage) return 'Stored with fallback obfuscation.';
    if (info?.encryptedAtRest) return 'Stored encrypted at rest.';
    return 'Stored.';
}

function getProviderKeyStorageTone(info, keySetFallback = false) {
    if (!info?.isStored && !keySetFallback) return 'muted';
    if (info?.compatibilityStorage) return 'warning';
    if (info?.encryptedAtRest) return 'success';
    return 'source';
}

function getProviderKeyStorageTooltip(info) {
    if (!info?.isStored) return 'No local API key is currently stored for this provider role.';
    if (info.compatibilityStorage) return 'Stored with fallback obfuscation, not encryption, because WebCrypto was unavailable.';
    return info.webCryptoAvailable ? 'Stored with browser WebCrypto AES-GCM.' : 'Stored key metadata exists, but WebCrypto is unavailable in this session.';
}

function createProviderGenerationSection(kind, settings = getSettings()) {
    const cfg = getProviderUiConfig(kind);
    const prefix = getProviderPrefix(kind);
    const provider = settings[`${prefix}Provider`] || 'st';
    const disabled = provider === 'profile';
    const section = createProviderRuntimeSection(`${cfg.shortTitle} Generation Parameters`);

    if (disabled) {
        const note = document.createElement('div');
        note.className = 'saga-runtime-help';
        note.textContent = 'Controlled by the selected Connection Profile and Provider preset.';
        section.appendChild(note);
    }

    const grid = document.createElement('div');
    grid.className = 'saga-provider-runtime-grid';
    grid.appendChild(createProviderNumberField(kind, 'Temperature', 'Temperature', settings[`${prefix}Temperature`] ?? 0.7, {
        min: 0,
        max: 2,
        step: 0.05,
        disabled,
        tooltip: `Temperature for ${cfg.shortTitle.toLowerCase()} calls.`,
    }));
    grid.appendChild(createProviderNumberField(kind, 'Top P', 'TopP', settings[`${prefix}TopP`] ?? 0.98, {
        min: 0,
        max: 1,
        step: 0.05,
        disabled,
        tooltip: `Top-p sampling value for ${cfg.shortTitle.toLowerCase()} calls.`,
    }));
    grid.appendChild(createProviderNumberField(kind, 'Max Tokens', 'MaxTokens', settings[`${prefix}MaxTokens`] ?? 8192, {
        min: 64,
        max: 16384,
        step: 64,
        disabled,
        integer: true,
        tooltip: `Maximum response tokens for ${cfg.shortTitle.toLowerCase()} calls.`,
    }));
    section.appendChild(grid);
    return section;
}

function createProviderNumberField(kind, labelText, suffix, value, options = {}) {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.min = String(options.min ?? '');
    input.max = String(options.max ?? '');
    input.step = String(options.step ?? 1);
    input.disabled = !!options.disabled;
    addTooltip(input, options.tooltip || labelText);
    input.addEventListener('change', () => {
        const normalized = normalizeProviderNumber(input.value, value, options);
        input.value = String(normalized);
        saveProviderSetting(kind, suffix, normalized, { refresh: false });
    });
    return createProviderField(labelText, options.tooltip || labelText, input, 'saga-provider-number-field');
}

function normalizeProviderNumber(value, fallback, options = {}) {
    let next = Number(value);
    if (!Number.isFinite(next)) next = Number(fallback);
    if (!Number.isFinite(next)) next = 0;
    if (Number.isFinite(Number(options.min))) next = Math.max(Number(options.min), next);
    if (Number.isFinite(Number(options.max))) next = Math.min(Number(options.max), next);
    if (options.integer) next = Math.round(next);
    return Number(next.toFixed(options.integer ? 0 : 3));
}

function createProviderField(labelText, tooltip, control, className = '') {
    const field = document.createElement('label');
    field.className = `saga-provider-runtime-field ${className}`.trim();
    const label = document.createElement('span');
    label.textContent = labelText;
    addTooltip(label, tooltip || labelText);
    field.appendChild(label);
    field.appendChild(control);
    return field;
}

function createProviderRuntimeSection(titleText) {
    const section = document.createElement('div');
    section.className = 'saga-provider-runtime-section';
    const title = document.createElement('div');
    title.className = 'saga-provider-runtime-section-title';
    title.textContent = titleText;
    section.appendChild(title);
    return section;
}

function createProviderTextControl({ id, value = '', placeholder = '', tooltip = '' }) {
    const input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.value = value;
    input.placeholder = placeholder;
    addTooltip(input, tooltip);
    return input;
}

function commitProviderTextOnEnter(event, kind, suffix, input) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    saveProviderSetting(kind, suffix, input.value.trim(), { refresh: false });
}

function createOption(value, label) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    return option;
}

function saveProviderSetting(kind, suffix, value, options = {}) {
    const next = getSettings();
    next[getProviderSettingKey(kind, suffix)] = value;
    saveSettings(next);
    refreshRuntimeHeader();
    if (options.refresh !== false) {
        refreshSettingsPanel({ preserveScroll: true, preserveWindowScroll: true });
    }
}

function resetProviderSettingsToDefaults(kind) {
    const prefix = getProviderPrefix(kind);
    const cfg = getProviderUiConfig(kind);
    const keys = [
        'Provider',
        'ProfileId',
        'CompletionPresetId',
        'OpenAIBaseUrl',
        'OpenAIModel',
        'OpenAIUseJsonMode',
        'OpenAIUseSTProxy',
        'Temperature',
        'TopP',
        'MaxTokens',
    ];
    const next = getSettings();
    for (const suffix of keys) {
        const key = `${prefix}${suffix}`;
        if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
            next[key] = cloneJson(DEFAULT_SETTINGS[key]);
        }
    }
    saveSettings(next);
    clearCachedApiKey(kind);
    refreshSettingsPanel({ preserveScroll: true, preserveWindowScroll: true });
    refreshRuntimeHeader();
    toast(`${cfg.shortTitle} provider settings reset. Stored API keys were preserved.`, 'info');
}

export function getProviderStatusText(kind, settings = getSettings()) {
    const prefix = kind === 'continuity' ? 'continuity' : 'lore';
    const provider = settings[`${prefix}Provider`] || 'st';
    const modelStatus = getProviderModelStatus(kind, settings);
    let status = '';
    try {
        const validation = validateLoreProviderConfiguration(kind);
        status = validation?.ok ? 'ready' : 'needs setup';
    } catch (_) {
        status = 'unknown';
    }
    return `${modelStatus.label || getProviderLabel(provider)} | ${status}`;
}

function createProviderPresetStatusCard() {
    const card = document.createElement('div');
    card.className = 'saga-provider-preset-status-card';
    card.textContent = 'Checking Provider preset...';
    refreshProviderPresetStatusCard(card);
    return card;
}

async function refreshProviderPresetStatusCard(card) {
    if (!card) return;
    card.textContent = '';

    let status;
    try {
        status = await getProviderPresetStatus();
    } catch (e) {
        status = {
            state: 'error',
            pill: 'Error',
            message: e?.message || 'Could not check Provider preset.',
            installedVersion: 'unknown',
            bundledVersion: SAGA_PROVIDER_PRESET_VERSION,
            canDownload: true,
        };
    }

    const header = document.createElement('div');
    header.className = 'saga-provider-preset-header';
    const title = document.createElement('div');
    title.className = 'saga-provider-runtime-section-title';
    title.textContent = 'Provider Preset';
    addTooltip(title, 'Thin bundled preset for SillyTavern Connection Profile provider calls.');
    header.appendChild(title);
    header.appendChild(createStatusPill(status.pill || 'Unknown', status.message || 'Provider preset status', { tone: getProviderPresetStatusChipTone(status), kind: 'status' }));
    card.appendChild(header);

    const message = document.createElement('div');
    message.className = 'saga-provider-preset-message';
    message.textContent = status.message || '';
    card.appendChild(message);

    const meta = document.createElement('div');
    meta.className = 'saga-provider-preset-meta';
    meta.appendChild(createCompactPresetStat('Installed', status.installedVersion || 'not found'));
    meta.appendChild(createCompactPresetStat('Bundled', status.bundledVersion || SAGA_PROVIDER_PRESET_VERSION));
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'saga-primary-actions';
    if (status.actionLabel) {
        actions.appendChild(createButton(status.actionLabel, status.actionTooltip || status.actionLabel, async (btn) => {
            await handleInstallProviderPreset(btn, card, status);
        }, status.primaryAction ? 'saga-primary-button' : ''));
    }
    if (status.canDownload) {
        actions.appendChild(createButton('Download JSON', 'Download the bundled Provider preset for manual import.', async (btn) => {
            await runBusyAction(btn, 'Downloading...', async () => {
                const preset = await loadBundledProviderPreset();
                downloadJson(preset, `${SAGA_PROVIDER_PRESET_VERSION}.json`);
                toast('Bundled Provider preset downloaded.', 'info');
            });
        }));
    }
    if (actions.childElementCount) card.appendChild(actions);
}

function getProviderPresetStatusChipTone(status = {}) {
    const state = String(status.state || '').toLowerCase();
    if (['current', 'ahead'].includes(state)) return 'success';
    if (['missing', 'behind', 'unknown'].includes(state)) return 'warning';
    if (state === 'error') return 'danger';
    if (state === 'unavailable') return 'muted';
    return 'info';
}

async function getProviderPresetStatus() {
    const bundled = await loadBundledProviderPreset();
    const bundledMeta = getProviderPresetMetadata(bundled, { fallbackVersion: SAGA_PROVIDER_PRESET_VERSION });
    const bundledVersion = bundledMeta.displayVersion || SAGA_PROVIDER_PRESET_VERSION;
    const pm = getChatCompletionPresetManager();

    if (!pm) {
        return {
            state: 'unavailable',
            pill: 'Manual',
            message: 'Preset manager unavailable. Download the bundled JSON and import it manually.',
            installedVersion: 'unknown',
            bundledVersion,
            canDownload: true,
        };
    }

    const installed = getInstalledProviderPreset(pm);
    if (!installed.preset) {
        return {
            state: 'missing',
            pill: 'Not Installed',
            message: 'Install the thin Provider preset, then assign it to SillyTavern Connection Profiles used by Saga providers.',
            installedVersion: 'not found',
            bundledVersion,
            actionLabel: 'Install',
            actionTooltip: 'Import the bundled Provider preset into Chat Completion presets.',
            primaryAction: true,
            canInstall: true,
            canDownload: true,
        };
    }

    const installedMeta = getProviderPresetMetadata(installed.preset);
    const installedVersion = installedMeta.displayVersion || 'unknown';
    const comparison = compareProviderPresetVersions(installedVersion, bundledVersion);
    if (comparison === null || comparison < 0) {
        return {
            state: comparison === null ? 'unknown' : 'behind',
            pill: comparison === null ? 'Version Unknown' : 'Update Available',
            message: comparison === null
                ? 'A Provider preset is installed, but its version metadata is missing or unreadable.'
                : 'The installed Provider preset is older than the bundled preset.',
            installedVersion,
            bundledVersion,
            actionLabel: 'Update',
            actionTooltip: 'Replace the installed Provider preset with the bundled version.',
            primaryAction: true,
            canInstall: true,
            canDownload: true,
        };
    }
    if (comparison > 0) {
        return {
            state: 'ahead',
            pill: 'Newer Installed',
            message: 'The installed Provider preset appears newer than the bundled preset. No update needed.',
            installedVersion,
            bundledVersion,
            canDownload: true,
        };
    }
    return {
        state: 'current',
        pill: 'Current',
        message: 'The installed Provider preset matches the bundled version.',
        installedVersion,
        bundledVersion,
        actionLabel: 'Reinstall',
        actionTooltip: 'Reset the installed Provider preset to bundled defaults.',
        canInstall: true,
        canDownload: true,
    };
}

function getInstalledProviderPreset(pm) {
    const name = SAGA_PROVIDER_PRESET_NAME;
    const preset = getProviderPresetByName(pm, name);
    return { name: preset ? name : '', preset };
}

function getProviderPresetByName(pm, name) {
    if (!name) return null;
    let preset = null;
    if (typeof pm?.getCompletionPresetByName === 'function') {
        preset = pm.getCompletionPresetByName(name) || null;
    }
    if (!preset && typeof pm?.readPresetExtensionField === 'function') {
        const sagaMeta = pm.readPresetExtensionField({ name, path: 'saga' });
        if (sagaMeta) preset = { extensions: { saga: sagaMeta } };
    }
    return preset;
}

function getChatCompletionPresetManager() {
    try {
        if (typeof SillyTavern === 'undefined' || typeof SillyTavern.getContext !== 'function') return null;
        const ctx = SillyTavern.getContext();
        if (!ctx || typeof ctx.getPresetManager !== 'function') return null;
        return ctx.getPresetManager(CHAT_COMPLETION_PRESET_API_ID) || null;
    } catch (_) {
        return null;
    }
}

async function loadBundledProviderPreset() {
    if (bundledProviderPresetCache) return cloneJson(bundledProviderPresetCache);
    const response = await fetch(getLocalAssetSrc(SAGA_PROVIDER_PRESET_ASSET_PATH), { cache: 'no-store' });
    if (!response.ok) throw new Error('Bundled Provider preset could not be loaded.');
    const preset = ensureProviderPresetMetadata(await response.json());
    bundledProviderPresetCache = preset;
    return cloneJson(preset);
}

function ensureProviderPresetMetadata(preset) {
    const next = cloneJson(preset || {});
    next.extensions = isPlainObjectValue(next.extensions) ? next.extensions : {};
    next.extensions.saga = {
        ...(isPlainObjectValue(next.extensions.saga) ? next.extensions.saga : {}),
        presetName: SAGA_PROVIDER_PRESET_NAME,
        presetVersion: SAGA_PROVIDER_PRESET_VERSION,
        version: formatProviderPresetVersion(SAGA_PROVIDER_PRESET_VERSION) || '1.2',
        providerPreset: true,
        supportsReplyHeaders: false,
    };
    return next;
}

function getProviderPresetMetadata(preset, options = {}) {
    const ext = isPlainObjectValue(preset?.extensions?.saga) ? preset.extensions.saga : {};
    const notes = String(preset?.notes || '');
    const explicit = ext.presetVersion || ext.version || '';
    const noteMatch = notes.match(/\bProvider[-\s]+v?(\d+(?:\.\d+){0,3})\b/i);
    const rawVersion = explicit || (noteMatch ? noteMatch[1] : '') || options.fallbackVersion || '';
    const comparable = formatProviderPresetVersion(rawVersion);
    return {
        displayVersion: comparable ? `Provider-${comparable}` : '',
        comparable,
    };
}

function formatProviderPresetVersion(value) {
    const match = String(value || '').trim().match(/(?:Provider[-\s]*)?v?(\d+(?:\.\d+){0,3})/i);
    return match?.[1] || '';
}

function compareProviderPresetVersions(installed, bundled) {
    const a = formatProviderPresetVersion(installed);
    const b = formatProviderPresetVersion(bundled);
    if (!a || !b) return null;
    const left = a.split('.').map(v => Number(v) || 0);
    const right = b.split('.').map(v => Number(v) || 0);
    const length = Math.max(left.length, right.length, 3);
    for (let i = 0; i < length; i += 1) {
        const av = left[i] || 0;
        const bv = right[i] || 0;
        if (av < bv) return -1;
        if (av > bv) return 1;
    }
    return 0;
}

async function handleInstallProviderPreset(btn, card, status) {
    const isReinstall = status.state === 'current';
    const busyLabel = status.state === 'missing' ? 'Installing...' : isReinstall ? 'Reinstalling...' : 'Updating...';
    await runBusyAction(btn, busyLabel, async () => {
        if (status.state !== 'missing') {
            const title = isReinstall ? 'Reinstall Provider preset?' : 'Update Provider preset?';
            const message = isReinstall
                ? "This resets the Provider preset's values to bundled defaults. It will not intentionally switch your active preset."
                : 'This replaces the installed Provider preset with the bundled version. It will not intentionally switch your active preset.';
            const proceed = await confirmAction(title, `${message} Continue?`);
            if (!proceed) return;
        }

        const result = await installBundledProviderPreset();
        await refreshProviderPresetStatusCard(card);
        toast(status.state === 'missing' ? 'Provider preset installed.' : isReinstall ? 'Provider preset reinstalled.' : 'Provider preset updated.', 'success');
        if (result?.selectionTouched) {
            await showNoticePopup(
                'Preset saved',
                'SillyTavern may briefly change the active preset while importing. I restored the previous selection where possible; verify your active preset and connection profiles before generating.'
            );
        }
    });
}

async function installBundledProviderPreset() {
    const pm = getChatCompletionPresetManager();
    if (!pm || typeof pm.savePreset !== 'function') {
        throw new Error('SillyTavern preset manager is unavailable.');
    }

    const preset = await loadBundledProviderPreset();
    const previousValue = typeof pm.getSelectedPreset === 'function' ? pm.getSelectedPreset() : '';
    const previousName = typeof pm.getSelectedPresetName === 'function' ? pm.getSelectedPresetName() : '';

    await pm.savePreset(SAGA_PROVIDER_PRESET_NAME, preset);

    let restored = false;
    if (previousValue && typeof pm.selectPreset === 'function') {
        try {
            const currentName = typeof pm.getSelectedPresetName === 'function' ? pm.getSelectedPresetName() : '';
            if (currentName !== previousName) {
                pm.selectPreset(previousValue);
                restored = true;
            }
        } catch (e) {
            console.warn('[Saga] Could not restore previous preset after importing Provider preset:', e);
        }
    }

    return { selectionTouched: previousName !== SAGA_PROVIDER_PRESET_NAME, restored };
}

function cloneJson(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}
