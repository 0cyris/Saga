/**
 * Document-ready bootstrap for Saga.
 */

import { LOG_PREFIX } from '../state/constants.js';
import { installInterceptor } from '../continuity/prompt-injector.js';
import { registerSagaToolManagerTools } from './saga-tool-registry.js';
import { wireEvents } from './events.js';
import { registerSlashCommands } from './slash-commands.js';
import { mountSettingsPanel } from './settings-mount.js';
import { exposeGlobalBridge } from './global-bridge.js';
import { hydrateSagaThemeIconStorage } from '../storage/saga-theme-icon-storage.js';
import { hydrateSagaLorepackLibraryStorage } from '../storage/saga-lorepack-library-storage.js';
import { hydrateSagaCreatorProjectStorage } from '../storage/saga-creator-project-storage.js';

export async function bootstrapSagaExtension() {
    console.log(`${LOG_PREFIX} Saga extension initializing...`);

    if (typeof SillyTavern === 'undefined' || !SillyTavern.getContext) {
        console.error(`${LOG_PREFIX} SillyTavern.getContext() not available. Extension cannot load.`);
        return;
    }

    const ctx = SillyTavern.getContext();
    if (!ctx) {
        console.error(`${LOG_PREFIX} SillyTavern context returned null. Extension cannot load.`);
        return;
    }

    installInterceptor();
    try {
        await hydrateSagaThemeIconStorage();
    } catch (e) {
        console.warn(`${LOG_PREFIX} Theme/Icon external storage could not be hydrated:`, e);
    }
    try {
        await hydrateSagaLorepackLibraryStorage();
    } catch (e) {
        console.warn(`${LOG_PREFIX} Lorepack Library external storage could not be hydrated:`, e);
    }
    try {
        await hydrateSagaCreatorProjectStorage();
    } catch (e) {
        console.warn(`${LOG_PREFIX} Deck Maker project external storage could not be hydrated:`, e);
    }
    wireEvents(ctx);
    registerSlashCommands(ctx);
    registerSagaToolManagerTools(ctx);
    await mountSettingsPanel(ctx);
    exposeGlobalBridge();

    console.log(`${LOG_PREFIX} Extension initialized successfully`);
}
