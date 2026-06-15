/**
 * Runtime action registration for Saga.
 */

import {
    acceptPendingLoreEntries,
    getState,
    rejectPendingLoreEntries,
} from '../state/state-manager.js';
import { syncPromptInjection, clearExtensionPrompts, uninstallInterceptor } from '../continuity/prompt-injector.js';
import { onExtractionTriggered } from '../continuity/extractor.js';
import {
    runLoreContextDetection,
    runStoryLoreScan,
} from '../lorecards/lore-generator.js';
import { showLorePanel, hideLorePanel, refreshLorePanel, resetLorePanelLayout } from '../runtime/lore-panel.js';
import { registerRuntimeActions, runRuntimeAction } from '../runtime/runtime-actions.js';
import { runAutoRelevance } from '../context/auto-relevance.js';

export function configureRuntimeActions() {
    registerRuntimeActions([
        {
            id: 'runtime.show',
            category: 'runtime',
            label: 'Show runtime panel',
            handler: () => showLorePanel(),
        },
        {
            id: 'runtime.hide',
            category: 'runtime',
            label: 'Hide runtime panel',
            handler: () => hideLorePanel(),
        },
        {
            id: 'runtime.refresh',
            category: 'runtime',
            label: 'Refresh runtime panel',
            handler: () => refreshLorePanel(),
        },
        {
            id: 'runtime.open',
            category: 'runtime',
            label: 'Open runtime panel',
            handler: () => {
                showLorePanel();
                refreshLorePanel();
            },
        },
        {
            id: 'runtime.toggle',
            category: 'runtime',
            label: 'Toggle runtime panel',
            handler: () => {
                const state = getState();
                const isOpen = state?.lorePanel?.isOpen || false;
                if (isOpen) {
                    hideLorePanel();
                    return { isOpen: false };
                }
                showLorePanel();
                return { isOpen: true };
            },
        },
        {
            id: 'runtime.resetLayout',
            category: 'runtime',
            label: 'Reset runtime layout',
            handler: options => resetLorePanelLayout(options),
        },
        {
            id: 'ui.refresh',
            category: 'ui',
            label: 'Refresh Saga UI',
            handler: () => refreshStatePanel(),
        },
        {
            id: 'prompt.sync',
            category: 'prompt',
            label: 'Sync prompt injection',
            handler: () => syncPromptInjection(),
        },
        {
            id: 'prompt.clear',
            category: 'prompt',
            label: 'Clear prompt injection',
            handler: () => clearExtensionPrompts(),
        },
        {
            id: 'prompt.uninstall',
            category: 'prompt',
            label: 'Uninstall prompt injection',
            handler: () => uninstallInterceptor(),
        },
        {
            id: 'continuity.extract',
            category: 'continuity',
            label: 'Run continuity extraction',
            handler: options => onExtractionTriggered({ force: true, ...(options || {}) }),
        },
        {
            id: 'lore.context.detect',
            category: 'lorecards',
            label: 'Run Context detection',
            handler: options => runLoreContextDetection({ force: true, ...(options || {}) }),
        },
        {
            id: 'lore.story.scan',
            category: 'lorecards',
            label: 'Run story lore scan',
            handler: async options => {
                const result = await runStoryLoreScan({ force: true, source: 'manual', ...(options || {}) });
                refreshLorePanel();
                return result;
            },
        },
        {
            id: 'lore.pending.acceptAll',
            category: 'lorecards',
            label: 'Accept all Pending Review entries',
            handler: () => {
                const result = acceptPendingLoreEntries();
                refreshLorePanel();
                return result;
            },
        },
        {
            id: 'lore.pending.rejectAll',
            category: 'lorecards',
            label: 'Reject all Pending Review entries',
            handler: () => {
                const result = rejectPendingLoreEntries();
                refreshLorePanel();
                return result;
            },
        },
        {
            id: 'lore.autoRelevance.run',
            category: 'lorecards',
            label: 'Run Lore Automation',
            handler: options => runAutoRelevance(options || {}),
        },
    ], { replace: true });
}

function refreshStatePanel() {
    try {
        runRuntimeAction('runtime.refresh');
    } catch (e) {
        // Runtime panel may be closed.
    }
}
