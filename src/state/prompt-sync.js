/**
 * Prompt injection sync queue shared by settings and chat-state persistence.
 */

import { LOG_PREFIX } from './constants.js';

export function queuePromptInjectionSync(options = {}) {
    try {
        const syncPromptInjection = typeof globalThis.Saga?.promptInjection?.sync === 'function'
            ? globalThis.Saga.promptInjection.sync
            : null;
        if (typeof syncPromptInjection === 'function') {
            queueMicrotask(() => {
                if (options.isCurrent && !options.isCurrent()) return;
                try {
                    syncPromptInjection();
                } catch (e) {
                    console.warn(`${LOG_PREFIX} Failed to sync prompt injection after state/settings save`, e);
                }
            });
        }
    } catch (_) {
        // Never let prompt-sync bookkeeping break persistence.
    }
}
