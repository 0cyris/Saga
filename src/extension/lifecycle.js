/**
 * SillyTavern lifecycle hooks for Saga.
 */

import { DEFAULT_SETTINGS, LOG_PREFIX, getDefaultState } from '../state/constants.js';
import {
    createStateBackup,
    getState,
    recordStateSafetyEvent,
    saveSettings,
    saveState,
} from '../state/state-manager.js';
import { clearStoredSecret } from '../state/secure-keyring.js';
import { installInterceptor } from '../continuity/prompt-injector.js';
import { runRuntimeAction } from '../runtime/runtime-actions.js';
import { clearSagaPromptInjectionSafely, handleExtensionDisabled } from './events.js';

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

function backupLifecycleState(reason, label) {
    if (!canUseSagaContext()) return null;
    try {
        return createStateBackup(reason, { label, syncPrompt: false });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to create lifecycle backup "${reason}":`, e);
        return null;
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
    backupLifecycleState('before_extension_update', 'Before applying a Saga extension update hook.');
    if (canUseSagaContext()) {
        try {
            getState();
        } catch (e) {
            console.warn(`${LOG_PREFIX} Saga update hook could not normalize current chat state:`, e);
        }
    }
    recordLifecycleStateEvent('extension_update', 'Saga extension update hook completed.');
}

export async function sagaOnEnable() {
    recordLifecycleStateEvent('extension_enable', 'Saga extension enable hook completed.');
    try {
        installInterceptor();
        runRuntimeAction('prompt.sync');
    } catch (e) {
        console.warn(`${LOG_PREFIX} Saga enable hook could not sync prompt injection:`, e);
        clearSagaPromptInjectionSafely('recovering from enable hook prompt sync failure');
    }
}

export async function sagaOnDisable() {
    handleExtensionDisabled();
    recordLifecycleStateEvent('extension_disable', 'Saga extension disable hook cleared prompt injection and hid the runtime.');
}

export async function sagaOnDelete() {
    handleExtensionDisabled();
    backupLifecycleState('before_extension_delete', 'Before Saga extension delete hook.');
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
    backupLifecycleState('before_extension_clean', 'Before cleaning Saga current-chat state and settings.');
    if (previous) {
        try {
            const next = getDefaultState();
            next.stateSafety = previous.stateSafety;
            saveState(next, { syncPrompt: false });
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
