/**
 * ui.js - Saga
 * Renders the settings panel and model provider UI.
 *
 * Exports: renderSettingsPanel
 * Imported by: src/extension/index.js
 */

import {
    DEFAULT_SETTINGS,
    SAGA_PROVIDER_PRESET_ASSET_PATH,
    SAGA_PROVIDER_PRESET_NAME,
    SAGA_PROVIDER_PRESET_VERSION,
} from '../state/constants.js';
import { getSettings, saveSettings } from '../state/state-manager.js';
import { storeNamedApiKey, deleteNamedApiKey, getNamedApiKeyStorageInfo } from '../state/secure-keyring.js';
import {
    clearCachedApiKey,
    loadApiKey,
    fetchLoreModels,
    testLoreConnection,
    validateLoreProviderConfigurationAsync,
    getAvailableConnectionProfiles,
} from '../providers/lore-llm-client.js';

/**
 * Renders the settings panel HTML into the container.
 * Since src/extension/settings.html is loaded via renderExtensionTemplateAsync(), this
 * function populates dynamic provider values and wires API/model controls.
 *
 * @param {HTMLElement} container - The settings panel div
 */
export function renderSettingsPanel(container) {
    if (!container) return;
    removeLegacyProviderSettingsDrawer(container);
}

function removeLegacyProviderSettingsDrawer(container) {
    for (const header of container.querySelectorAll('.inline-drawer-header')) {
        const text = String(header.textContent || '').trim();
        if (!/Provider Settings|API\s*(?:and|&|\+|\/)\s*Model|API\/Model/i.test(text)) continue;
        header.closest('.inline-drawer')?.remove();
    }
    for (const el of container.querySelectorAll('[id^="saga_continuity_provider"], [id^="saga_lore_provider"], [id*="_openai_"], [id*="_fetch_models"], [id*="_test_connection"]')) {
        el.closest('.inline-drawer, .flex-container, .saga-provider-panel, .saga-provider-runtime-block')?.remove();
    }
}

function setupLoreProviderPanel(container) {
    if (!container) return;
    setupProviderControls(container, 'continuity', 'Utility');
    setupProviderControls(container, 'lore', 'Reasoning');
}

function settingPrefix(kind) {
    return kind === 'continuity' ? 'continuity' : 'lore';
}

function secretNameForProvider(kind) {
    return `${settingPrefix(kind)}OpenAI`;
}

function parseNumericSetting(input, fallback, min, max, integer = false) {
    const parsed = Number(input?.value);
    if (!Number.isFinite(parsed)) return fallback;
    const clamped = Math.min(max, Math.max(min, parsed));
    return integer ? Math.round(clamped) : clamped;
}

const CHAT_COMPLETION_PRESET_API_ID = 'openai';
let bundledProviderPresetCache = null;
let providerPresetInstallConfirmed = false;

const EXTENSION_ROOT_URL = new URL('../../', import.meta.url);
const EXTENSION_ROOT_ASSET_PATTERN = /^(?:\.\/)?(?:content|assets)\//;

function getLocalAssetSrc(assetPath) {
    if (!assetPath) return '';
    try {
        if (EXTENSION_ROOT_ASSET_PATTERN.test(assetPath)) {
            return new URL(assetPath.replace(/^\.\//, ''), EXTENSION_ROOT_URL).href;
        }
        return new URL(assetPath, import.meta.url).href;
    } catch (_) {
        return assetPath;
    }
}

function cloneJson(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
}

function isPlainObjectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
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

function formatComparableProviderPresetVersion(value) {
    const match = String(value || '').trim().match(/(?:Provider[-\s]*)?v?(\d+(?:\.\d+){0,3})/i);
    return match?.[1] || '';
}

function compareProviderPresetVersions(installed, bundled) {
    const a = formatComparableProviderPresetVersion(installed);
    const b = formatComparableProviderPresetVersion(bundled);
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

function getProviderPresetMetadata(preset, fallbackVersion = '') {
    const ext = isPlainObjectValue(preset?.extensions?.saga) ? preset.extensions.saga : {};
    const notes = String(preset?.notes || '');
    const noteMatch = notes.match(/\bProvider[-\s]+v?(\d+(?:\.\d+){0,3})\b/i);
    const rawVersion = ext.presetVersion || ext.version || (noteMatch ? noteMatch[1] : '') || fallbackVersion || '';
    const comparable = formatComparableProviderPresetVersion(rawVersion);
    return {
        presetName: ext.presetName || '',
        displayVersion: comparable ? `Provider-${comparable}` : '',
        comparable,
        providerPreset: ext.providerPreset === true,
    };
}

function getPresetByName(pm, name) {
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

function getInstalledProviderPreset(pm) {
    const names = typeof pm?.getAllPresets === 'function' ? pm.getAllPresets() : [];
    let installedName = '';
    if (Array.isArray(names)) {
        installedName = names.find(name => String(name || '').trim().toLowerCase() === SAGA_PROVIDER_PRESET_NAME.toLowerCase()) || '';
    }
    if (!installedName) {
        installedName = getPresetByName(pm, SAGA_PROVIDER_PRESET_NAME) ? SAGA_PROVIDER_PRESET_NAME : '';
    }
    if (installedName) {
        return {
            name: installedName,
            preset: getPresetByName(pm, installedName),
        };
    }
    return providerPresetInstallConfirmed
        ? { name: SAGA_PROVIDER_PRESET_NAME, preset: null, assumed: true }
        : null;
}

function ensureProviderPresetMetadata(preset) {
    const next = cloneJson(preset || {});
    next.extensions = isPlainObjectValue(next.extensions) ? next.extensions : {};
    next.extensions.saga = {
        ...(isPlainObjectValue(next.extensions.saga) ? next.extensions.saga : {}),
        presetName: SAGA_PROVIDER_PRESET_NAME,
        presetVersion: SAGA_PROVIDER_PRESET_VERSION,
        version: formatComparableProviderPresetVersion(SAGA_PROVIDER_PRESET_VERSION) || '1.0',
        providerPreset: true,
        supportsReplyHeaders: false,
    };
    return next;
}

async function loadBundledProviderPreset() {
    if (bundledProviderPresetCache) return cloneJson(bundledProviderPresetCache);
    const response = await fetch(getLocalAssetSrc(SAGA_PROVIDER_PRESET_ASSET_PATH), { cache: 'no-store' });
    if (!response.ok) throw new Error(`${SAGA_PROVIDER_PRESET_NAME} preset could not be loaded.`);
    const preset = ensureProviderPresetMetadata(await response.json());
    bundledProviderPresetCache = preset;
    return cloneJson(preset);
}

async function installBundledProviderPreset() {
    const pm = getChatCompletionPresetManager();
    if (!pm || typeof pm.savePreset !== 'function') {
        throw new Error('SillyTavern chat-completion preset manager is unavailable.');
    }

    const preset = await loadBundledProviderPreset();
    const previousValue = typeof pm.getSelectedPreset === 'function' ? pm.getSelectedPreset() : '';
    const previousName = typeof pm.getSelectedPresetName === 'function' ? pm.getSelectedPresetName() : '';

    await pm.savePreset(SAGA_PROVIDER_PRESET_NAME, preset);
    providerPresetInstallConfirmed = true;

    if (previousValue && typeof pm.selectPreset === 'function') {
        try {
            const currentName = typeof pm.getSelectedPresetName === 'function' ? pm.getSelectedPresetName() : '';
            if (currentName !== previousName) pm.selectPreset(previousValue);
        } catch (e) {
            console.warn('[Saga] Could not restore previous preset after importing provider preset:', e);
        }
    }
}

async function refreshProviderPresetInstallStatus(button, statusEl) {
    if (!button && !statusEl) return;
    const pm = getChatCompletionPresetManager();
    if (!pm) {
        if (button) button.disabled = true;
        if (statusEl) {
            statusEl.textContent = 'Preset manager unavailable.';
            statusEl.style.color = '#cc8888';
        }
        return;
    }

    const installed = getInstalledProviderPreset(pm);
    const installedMeta = getProviderPresetMetadata(installed?.preset, installed?.assumed ? SAGA_PROVIDER_PRESET_VERSION : '');
    const installedVersion = installedMeta.displayVersion || 'version unknown';
    const comparison = installed ? compareProviderPresetVersions(installedMeta.displayVersion, SAGA_PROVIDER_PRESET_VERSION) : null;
    const isCurrent = installed && comparison === 0;
    const needsUpdate = installed && !isCurrent;

    if (button) {
        button.disabled = false;
        button.textContent = !installed ? 'Install Provider' : needsUpdate ? 'Update Provider' : 'Reinstall Provider';
    }
    if (statusEl) {
        if (!installed) {
            statusEl.textContent = 'Provider preset not installed.';
            statusEl.style.color = '#d6b35a';
        } else if (isCurrent) {
            statusEl.textContent = `Provider current (${SAGA_PROVIDER_PRESET_VERSION}). Select it in your SillyTavern profile.`;
            statusEl.style.color = '#88cc88';
        } else {
            statusEl.textContent = `Provider ${installedVersion} installed; update to ${SAGA_PROVIDER_PRESET_VERSION}.`;
            statusEl.style.color = '#d6b35a';
        }
    }
}

function setupProviderControls(container, kind, label) {
    const prefix = settingPrefix(kind);
    const settings = getSettings();

    const providerSelect = container.querySelector(`#saga_${prefix}_provider`);
    const profileRow = container.querySelector(`#saga_${prefix}_profile_row`);
    const profileIdSelect = container.querySelector(`#saga_${prefix}_profile_id`);
    const providerPresetInstallBtn = container.querySelector(`#saga_${prefix}_provider_preset_install`);
    const providerPresetStatus = container.querySelector(`#saga_${prefix}_provider_preset_status`);
    const openaiRow = container.querySelector(`#saga_${prefix}_openai_row`);
    const openaiBaseUrl = container.querySelector(`#saga_${prefix}_openai_base_url`);
    const openaiModel = container.querySelector(`#saga_${prefix}_openai_model`);
    const openaiModelSearch = container.querySelector(`#saga_${prefix}_openai_model_search`);
    const openaiKey = container.querySelector(`#saga_${prefix}_openai_key`);
    const openaiKeySaveBtn = container.querySelector(`#saga_${prefix}_openai_key_save`);
    const openaiKeyClearBtn = container.querySelector(`#saga_${prefix}_openai_key_clear`);
    const openaiKeyStatus = container.querySelector(`#saga_${prefix}_openai_key_status`);
    const fetchModelsBtn = container.querySelector(`#saga_${prefix}_fetch_models`);
    const testConnectionBtn = container.querySelector(`#saga_${prefix}_test_connection`);
    const resetDefaultsBtn = container.querySelector(`#saga_${prefix}_provider_reset_defaults`);
    const connectionStatus = container.querySelector(`#saga_${prefix}_connection_status`);
    const temperatureInput = container.querySelector(`#saga_${prefix}_temperature`);
    const topPInput = container.querySelector(`#saga_${prefix}_top_p`);
    const maxTokensInput = container.querySelector(`#saga_${prefix}_max_tokens`);
    const generationParametersHeader = container.querySelector(`#saga_${prefix}_generation_parameters_header`);
    const generationParameters = container.querySelector(`#saga_${prefix}_generation_parameters`);
    const generationParametersNote = container.querySelector(`#saga_${prefix}_generation_parameters_note`);

    const providerKey = `${prefix}Provider`;
    const profileKey = `${prefix}ProfileId`;
    const presetKey = `${prefix}CompletionPresetId`;
    const baseUrlKey = `${prefix}OpenAIBaseUrl`;
    const modelKey = `${prefix}OpenAIModel`;
    const temperatureKey = `${prefix}Temperature`;
    const topPKey = `${prefix}TopP`;
    const maxTokensKey = `${prefix}MaxTokens`;
    const providerSettingKeys = [
        providerKey,
        profileKey,
        presetKey,
        baseUrlKey,
        modelKey,
        temperatureKey,
        topPKey,
        maxTokensKey,
    ];

    if (providerSelect) providerSelect.value = settings[providerKey] || 'st';
    if (openaiBaseUrl) openaiBaseUrl.value = settings[baseUrlKey] || '';
    if (openaiModelSearch) openaiModelSearch.value = settings[modelKey] || '';
    if (openaiModel) openaiModel.value = settings[modelKey] || '';
    if (temperatureInput) temperatureInput.value = settings[temperatureKey] ?? 0.7;
    if (topPInput) topPInput.value = settings[topPKey] ?? 0.98;
    if (maxTokensInput) maxTokensInput.value = settings[maxTokensKey] ?? 8192;

    function refreshProviderRows() {
        const provider = providerSelect?.value || 'st';
        if (profileRow) profileRow.style.display = provider === 'profile' ? '' : 'none';
        if (openaiRow) openaiRow.style.display = provider === 'openai_compatible' ? '' : 'none';
        if (provider === 'profile') refreshProviderPresetInstallStatus(providerPresetInstallBtn, providerPresetStatus);
        const profileControlled = provider === 'profile';
        if (generationParametersHeader) generationParametersHeader.style.opacity = profileControlled ? '0.62' : '';
        if (generationParameters) {
            generationParameters.style.opacity = profileControlled ? '0.42' : '';
            generationParameters.style.pointerEvents = profileControlled ? 'none' : '';
        }
        if (generationParametersNote) generationParametersNote.style.display = profileControlled ? '' : 'none';
        for (const input of [temperatureInput, topPInput, maxTokensInput]) {
            if (!input) continue;
            input.disabled = profileControlled;
            input.title = profileControlled
                ? `${label} generation parameters are controlled by the selected SillyTavern Connection Profile and its Provider preset.`
                : input.dataset.sagaDefaultTitle || input.title;
        }
    }

    function getProfileWarningText() {
        return `${label} connection profiles include a settings preset. For Saga provider tasks, use a SillyTavern profile saved with ${SAGA_PROVIDER_PRESET_NAME}, then test the profile.`;
    }

    function showProfileWarning() {
        const warning = getProfileWarningText();
        if (connectionStatus) {
            connectionStatus.textContent = warning;
            connectionStatus.style.color = '#d6b35a';
        }
        if (typeof toastr !== 'undefined') toastr.warning(warning);
    }

    if (providerSelect) {
        providerSelect.addEventListener('change', () => {
            const next = getSettings();
            next[providerKey] = providerSelect.value;
            saveLoreProviderSettings(next);
            if (connectionStatus) connectionStatus.textContent = '';
            refreshProviderRows();
            if (providerSelect.value === 'profile') showProfileWarning();
        });
    }

    function populateProfiles() {
        if (profileIdSelect) {
            const current = profileIdSelect.value || getSettings()[profileKey] || '';
            profileIdSelect.innerHTML = '<option value="">Select Profile</option>';
            const profiles = getAvailableConnectionProfiles();
            if (!profiles.length) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No profiles found in this SillyTavern session';
                profileIdSelect.appendChild(opt);
            }
            for (const p of profiles) {
                const id = p.id || p.name || p.profileId || p.uuid || p.profile_id || p.label || '';
                if (!id) continue;
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = p.name || p.label || p.id || p.profileId || p.profile_id || id;
                profileIdSelect.appendChild(opt);
            }
            profileIdSelect.value = current;
        }

    }

    populateProfiles();
    if (profileIdSelect) {
        profileIdSelect.addEventListener('focus', populateProfiles);
        profileIdSelect.addEventListener('click', populateProfiles);
        profileIdSelect.addEventListener('change', () => {
            const next = getSettings();
            next[profileKey] = profileIdSelect.value;
            saveLoreProviderSettings(next);
        });
    }
    if (providerPresetInstallBtn) {
        providerPresetInstallBtn.addEventListener('click', async () => {
            const original = providerPresetInstallBtn.textContent;
            providerPresetInstallBtn.disabled = true;
            providerPresetInstallBtn.textContent = 'Installing...';
            if (providerPresetStatus) {
                providerPresetStatus.textContent = `Installing ${SAGA_PROVIDER_PRESET_NAME}...`;
                providerPresetStatus.style.color = '';
            }
            try {
                await installBundledProviderPreset();
                const next = getSettings();
                next[presetKey] = '';
                saveLoreProviderSettings(next);
                populateProfiles();
                await refreshProviderPresetInstallStatus(providerPresetInstallBtn, providerPresetStatus);
                if (typeof toastr !== 'undefined') toastr.success(`${SAGA_PROVIDER_PRESET_NAME} installed. Select it in your SillyTavern ${label.toLowerCase()} connection profile, then update that profile.`);
            } catch (e) {
                providerPresetInstallBtn.textContent = original;
                if (providerPresetStatus) {
                    providerPresetStatus.textContent = e?.message || String(e);
                    providerPresetStatus.style.color = '#cc8888';
                }
                if (typeof toastr !== 'undefined') toastr.error(`Failed to install ${SAGA_PROVIDER_PRESET_NAME}: ` + (e?.message || e));
            } finally {
                providerPresetInstallBtn.disabled = false;
            }
        });
    }

    if (openaiBaseUrl) {
        openaiBaseUrl.addEventListener('change', () => {
            const next = getSettings();
            next[baseUrlKey] = openaiBaseUrl.value.trim();
            saveLoreProviderSettings(next);
        });
    }

    let fetchedModels = [];
    function saveModel(value) {
        const next = getSettings();
        next[modelKey] = String(value || '').trim();
        saveLoreProviderSettings(next);
    }

    function renderModelOptions(filter = '') {
        if (!openaiModel) return;
        const currentSettings = getSettings();
        const query = String(filter || '').trim().toLowerCase();
        const current = currentSettings[modelKey] || '';
        const matches = fetchedModels
            .filter(m => {
                const id = String(m.id || '');
                const name = String(m.name || m.id || '');
                return !query || id.toLowerCase().includes(query) || name.toLowerCase().includes(query);
            })
            .slice(0, 200);

        openaiModel.innerHTML = '';
        const typed = String(openaiModelSearch?.value || current || '').trim();
        const first = document.createElement('option');
        first.value = typed || '';
        first.textContent = typed ? `Use typed model: ${typed}` : (fetchedModels.length ? 'Select a fetched model' : 'Fetch models or type a model ID above');
        openaiModel.appendChild(first);

        for (const m of matches) {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id;
            openaiModel.appendChild(opt);
        }

        openaiModel.value = current || typed || '';
    }

    if (openaiModelSearch) {
        openaiModelSearch.addEventListener('input', () => {
            const typed = openaiModelSearch.value.trim();
            saveModel(typed);
            renderModelOptions(typed);
        });
        openaiModelSearch.addEventListener('change', () => saveModel(openaiModelSearch.value.trim()));
    }

    if (openaiModel) {
        openaiModel.addEventListener('change', () => {
            const selected = openaiModel.value.trim();
            if (openaiModelSearch) openaiModelSearch.value = selected;
            saveModel(selected);
            renderModelOptions(selected);
        });
    }

    function wireNumericInput(input, key, fallback, min, max, integer = false) {
        if (!input) return;
        input.addEventListener('change', () => {
            const next = getSettings();
            const value = parseNumericSetting(input, fallback, min, max, integer);
            input.value = String(value);
            next[key] = value;
            saveLoreProviderSettings(next);
        });
    }

    wireNumericInput(temperatureInput, temperatureKey, 0.7, 0, 2);
    wireNumericInput(topPInput, topPKey, 0.98, 0, 1);
    wireNumericInput(maxTokensInput, maxTokensKey, 8192, 64, 16384, true);
    for (const input of [temperatureInput, topPInput, maxTokensInput]) {
        if (input && !input.dataset.sagaDefaultTitle) input.dataset.sagaDefaultTitle = input.title || '';
    }

    if (resetDefaultsBtn) {
        resetDefaultsBtn.addEventListener('click', () => {
            const next = getSettings();
            for (const key of providerSettingKeys) {
                if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
                    next[key] = DEFAULT_SETTINGS[key];
                }
            }
            saveLoreProviderSettings(next);
            if (providerSelect) providerSelect.value = next[providerKey] || 'st';
            if (profileIdSelect) profileIdSelect.value = next[profileKey] || '';
            if (openaiBaseUrl) openaiBaseUrl.value = next[baseUrlKey] || '';
            if (openaiModelSearch) openaiModelSearch.value = next[modelKey] || '';
            if (temperatureInput) temperatureInput.value = String(next[temperatureKey] ?? 0.7);
            if (topPInput) topPInput.value = String(next[topPKey] ?? 0.98);
            if (maxTokensInput) maxTokensInput.value = String(next[maxTokensKey] ?? 8192);
            populateProfiles();
            if (profileIdSelect) profileIdSelect.value = next[profileKey] || '';
            renderModelOptions(next[modelKey] || '');
            refreshProviderRows();
            if (connectionStatus) connectionStatus.textContent = '';
            if (typeof toastr !== 'undefined') toastr.info(`${label} provider settings reset to defaults. Stored API keys were preserved.`);
        });
    }

    async function refreshKeyStatus() {
        if (!openaiKeyStatus) return;
        const info = getNamedApiKeyStorageInfo(secretNameForProvider(kind));
        try {
            const key = await loadApiKey(kind);
            if (key) {
                if (info.compatibilityStorage) {
                    openaiKeyStatus.textContent = 'Key stored with fallback encryption; use HTTPS/localhost for browser encryption';
                    openaiKeyStatus.style.color = '#d6b35a';
                } else {
                    openaiKeyStatus.textContent = 'Key stored (encrypted at rest)';
                    openaiKeyStatus.style.color = '#88cc88';
                }
            } else if (info.isStored) {
                openaiKeyStatus.textContent = info.webCryptoAvailable
                    ? 'Stored key could not be read; store it again'
                    : 'Stored key needs browser encryption support; store it again to use fallback storage';
                openaiKeyStatus.style.color = '#cc8888';
            } else {
                openaiKeyStatus.textContent = 'No key stored';
                openaiKeyStatus.style.color = '';
            }
        } catch (_) {
            openaiKeyStatus.textContent = 'Keyring unavailable';
            openaiKeyStatus.style.color = '#cc8888';
        }
    }

    if (openaiKeySaveBtn && openaiKey) {
        openaiKeySaveBtn.addEventListener('click', async () => {
            const raw = openaiKey.value.trim();
            if (!raw) {
                if (typeof toastr !== 'undefined') toastr.warning('Enter an API key first.');
                return;
            }
            try {
                const result = await storeNamedApiKey(secretNameForProvider(kind), raw);
                clearCachedApiKey(kind);
                openaiKey.value = '';
                if (typeof toastr !== 'undefined') {
                    if (result?.encryptedAtRest === false) {
                        toastr.warning(`${label} API key stored. Browser encryption is unavailable in this context, so Saga used fallback storage.`);
                    } else {
                        toastr.success(`${label} API key encrypted and stored.`);
                    }
                }
                await refreshKeyStatus();
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error('Failed to store key: ' + e.message);
            }
        });
    }

    if (openaiKeyClearBtn) {
        openaiKeyClearBtn.addEventListener('click', async () => {
            try {
                await deleteNamedApiKey(secretNameForProvider(kind));
                clearCachedApiKey(kind);
                if (openaiKey) openaiKey.value = '';
                if (typeof toastr !== 'undefined') toastr.success(`${label} API key removed.`);
                await refreshKeyStatus();
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error('Failed to clear key: ' + e.message);
            }
        });
    }

    if (fetchModelsBtn) {
        fetchModelsBtn.addEventListener('click', async () => {
            fetchModelsBtn.disabled = true;
            const original = fetchModelsBtn.textContent;
            fetchModelsBtn.textContent = 'Fetching...';
            try {
                fetchedModels = await fetchLoreModels(kind);
                renderModelOptions(openaiModelSearch?.value || getSettings()[modelKey] || '');
                if (typeof toastr !== 'undefined') toastr.success(`${fetchedModels.length} ${label.toLowerCase()} model(s) fetched; showing up to 200 matching results.`);
            } catch (e) {
                if (typeof toastr !== 'undefined') toastr.error(`${label} model fetch failed: ` + e.message);
            } finally {
                fetchModelsBtn.disabled = false;
                fetchModelsBtn.textContent = original;
            }
        });
    }

    if (testConnectionBtn) {
        testConnectionBtn.addEventListener('click', async () => {
            const original = testConnectionBtn.textContent;
            testConnectionBtn.disabled = true;
            testConnectionBtn.textContent = 'Testing...';
            if (connectionStatus) {
                connectionStatus.textContent = `Testing ${label.toLowerCase()} provider...`;
                connectionStatus.style.color = '';
            }
            try {
                const validation = await validateLoreProviderConfigurationAsync(kind);
                if (!validation.ok) throw new Error(validation.message);
                const result = await testLoreConnection(kind);
                if (connectionStatus) {
                    connectionStatus.textContent = `Connected via ${result.provider}.`;
                    connectionStatus.style.color = '#88cc88';
                }
                if (typeof toastr !== 'undefined') toastr.success(`${label} provider connection succeeded.`);
            } catch (e) {
                if (connectionStatus) {
                    connectionStatus.textContent = e?.message || String(e);
                    connectionStatus.style.color = '#cc8888';
                }
                if (typeof toastr !== 'undefined') toastr.error(`${label} connection test failed: ` + (e?.message || e));
            } finally {
                testConnectionBtn.disabled = false;
                testConnectionBtn.textContent = original;
            }
        });
    }

    renderModelOptions(settings[modelKey] || '');
    refreshProviderRows();
    refreshKeyStatus();
}

function saveLoreProviderSettings(settings) {
    try {
        saveSettings(settings);
    } catch (e) {
        console.warn('[Saga] Failed to save model provider role settings:', e);
    }
}
