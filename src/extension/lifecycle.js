/**
 * SillyTavern lifecycle hooks for Saga.
 */

import { DEFAULT_SETTINGS, LOG_PREFIX, getDefaultState } from '../state/constants.js';
import {
    createStateBackupDurable,
    getState,
    getSettings,
    recordStateSafetyEvent,
    saveSettings,
    saveStateDurable,
} from '../state/state-manager.js';
import { clearStoredSecret } from '../state/secure-keyring.js';
import { installInterceptor } from '../continuity/prompt-injector.js';
import { runRuntimeAction } from '../runtime/runtime-actions.js';
import { clearSagaPromptInjectionSafely, handleExtensionDisabled, wireEvents } from './events.js';
import { exposeGlobalBridge } from './global-bridge.js';
import { registerSagaToolManagerTools } from './saga-tool-registry.js';
import { setChatOperationsEnabled } from '../state/chat-operation.js';

function canUseSagaContext() {
    try {
        return typeof globalThis.SillyTavern?.getContext === 'function' && !!globalThis.SillyTavern.getContext();
    } catch (e) {
        return false;
    }
}

function recordLifecycleStateEvent(type, message) {
    if (!canUseSagaContext()) return;
    try {
        recordStateSafetyEvent(type, message, { syncPrompt: false });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to record lifecycle state event "${type}":`, e);
    }
}

async function backupLifecycleState(reason, label) {
    if (!canUseSagaContext()) return null;
    try {
        const result = await createStateBackupDurable(reason, { label, syncPrompt: false });
        if (!result.ok) console.warn(`${LOG_PREFIX} Lifecycle backup ${reason} was not verified: ${result.error || result.status}. Export State preserves a recoverable copy.`);
        return result;
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to create lifecycle backup "${reason}":`, e);
        return { ok: false, persisted: false, error: e?.message || String(e) };
    }
}

function clearSagaDirectProviderKeys() {
    for (const secretName of ['loreOpenAI', 'continuityOpenAI']) {
        try {
            clearStoredSecret(secretName);
        } catch (e) {
            console.warn(`${LOG_PREFIX} Failed to clear ${secretName} provider key material:`, e);
        }
    }
}

function cloneSagaDefaultSettings() {
    try {
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    } catch (e) {
        return { ...DEFAULT_SETTINGS };
    }
}

export async function sagaOnInstall() {
    recordLifecycleStateEvent('extension_install', 'Saga extension install hook completed.');
}

export async function sagaOnUpdate() {
    const backup = await backupLifecycleState('before_extension_update', 'Before applying a Saga extension update hook.');
    if (backup && !backup.ok) return backup;
    if (canUseSagaContext()) {
        try {
            getState();
        } catch (e) {
            console.warn(`${LOG_PREFIX} Saga update hook could not normalize current chat state:`, e);
        }
    }
    recordLifecycleStateEvent('extension_update', 'Saga extension update hook completed.');
}

export function activateSagaResources(ctx = globalThis.SillyTavern?.getContext?.()) {
    if (getSettings().enabled === false) { handleExtensionDisabled(); return { ok: false, status: 'disabled' }; }
    setChatOperationsEnabled(true);
    if (ctx) { wireEvents(ctx); registerSagaToolManagerTools(ctx); }
    exposeGlobalBridge();
    try {
        installInterceptor();
        runRuntimeAction('prompt.sync');
        return { ok: true, status: 'enabled' };
    } catch (e) {
        console.warn(`${LOG_PREFIX} Saga enable hook could not sync prompt injection:`, e);
        clearSagaPromptInjectionSafely('recovering from enable hook prompt sync failure');
        return { ok: false, status: 'failed', error: e?.message || String(e) };
    }
}

export async function sagaOnEnable() {
    const result = activateSagaResources();
    if (result.ok) recordLifecycleStateEvent('extension_enable', 'Saga extension enable hook completed.');
    return result;
}

export async function sagaOnDisable() {
    handleExtensionDisabled();
    recordLifecycleStateEvent('extension_disable', 'Saga extension disable hook cleared prompt injection and hid the runtime.');
}

export async function sagaOnDelete() {
    handleExtensionDisabled();
    const backup = await backupLifecycleState('before_extension_delete', 'Before Saga extension delete hook.');
    if (backup && !backup.ok) return backup;
    recordLifecycleStateEvent('extension_delete', 'Saga extension delete hook completed.');
}

export async function sagaOnClean() {
    handleExtensionDisabled();
    let previous = null;
    if (canUseSagaContext()) {
        try {
            previous = getState();
        } catch (e) {
            console.warn(`${LOG_PREFIX} Saga clean hook could not read current chat state:`, e);
        }
    }
    const backup = await backupLifecycleState('before_extension_clean', 'Before cleaning Saga current-chat state and settings.');
    if (backup && !backup.ok) return backup;
    if (previous) {
        try {
            const next = getDefaultState();
            next.stateSafety = previous.stateSafety;
            const result = await saveStateDurable(next, { syncPrompt: false });
            if (!result.ok) return result;
            recordStateSafetyEvent('extension_clean', 'Saga clean hook reset current-chat Saga state and preserved State Safety records.', { syncPrompt: false });
        } catch (e) {
            console.warn(`${LOG_PREFIX} Saga clean hook could not reset current chat state:`, e);
        }
    }
    clearSagaDirectProviderKeys();
    try {
        saveSettings(cloneSagaDefaultSettings());
    } catch (e) {
        console.warn(`${LOG_PREFIX} Saga clean hook could not reset settings:`, e);
    }
}

export async function sagaOnActivate() {
    recordLifecycleStateEvent('extension_activate', 'Saga extension activate hook completed.');
}

export const __sagaLifecycleTestHooks = Object.freeze({
    canUseSagaContext,
    recordLifecycleStateEvent,
    backupLifecycleState,
    clearSagaDirectProviderKeys,
});
