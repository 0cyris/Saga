/**
 * Slash command registration for Saga.
 */

import { LOG_PREFIX } from '../state/constants.js';
import { getSettings, getState, exportSagaState } from '../state/state-manager.js';
import { buildMemo } from '../continuity/memo-builder.js';
import { runRuntimeAction } from '../runtime/runtime-actions.js';

function registerSagaSlashCommand(ctx, name, callback, helpString, category = 'Saga') {
    const parser = ctx?.SlashCommandParser || globalThis.SlashCommandParser;
    const commandFactory = ctx?.SlashCommand || globalThis.SlashCommand;

    if (parser && typeof parser.addCommandObject === 'function') {
        const commandProps = {
            name,
            callback,
            helpString,
            category,
            returns: 'none',
        };
        const command = commandFactory && typeof commandFactory.fromProps === 'function'
            ? commandFactory.fromProps(commandProps)
            : commandProps;
        parser.addCommandObject(command);
        return true;
    }

    if (typeof registerSlashCommand === 'function') {
        registerSlashCommand(name, callback, undefined, helpString, category);
        return true;
    }

    return false;
}

async function confirmSlashBulkPendingAction(ctx, verb, count) {
    if (!count) {
        if (typeof toastr !== 'undefined') toastr.info(`No Pending Review entries to ${verb.toLowerCase()}.`);
        return false;
    }
    const message = `${verb} all ${count} Pending Review entr${count === 1 ? 'y' : 'ies'}? This affects every Pending Review item in the current chat.`;
    const popup = ctx?.callGenericPopup || globalThis.callGenericPopup;
    const popupTypes = ctx?.POPUP_TYPE || globalThis.POPUP_TYPE || {};
    if (typeof popup === 'function') {
        const result = await popup(message, popupTypes.CONFIRM || 'confirm');
        return result === true || result === 'ok' || result === 'confirm' || result === 1;
    }
    if (typeof globalThis.confirm === 'function') return globalThis.confirm(message);
    if (typeof toastr !== 'undefined') toastr.warning(`${verb} all requires confirmation, but no confirmation UI is available.`);
    return false;
}

export function registerSlashCommands(ctx) {
    const parser = ctx?.SlashCommandParser || globalThis.SlashCommandParser;
    if (!parser?.addCommandObject && typeof registerSlashCommand !== 'function') {
        console.warn(`${LOG_PREFIX} Slash command registration unavailable`);
        return;
    }

    const register = (name, callback, helpString, category = 'Saga') => registerSagaSlashCommand(ctx, name, callback, helpString, category);

    register('saga-extract', async () => {
        await runRuntimeAction('continuity.extract', { force: true });
    }, '\uD83D\uDC41\uFE0F Manually run continuity state extraction', 'Saga');

    register('saga-memo', async () => {
        const state = getState();
        const memo = buildMemo(state);
        if (!memo) {
            if (typeof toastr !== 'undefined') toastr.info('No continuity state to build memo from.');
        } else {
            navigator.clipboard.writeText(memo).then(() => {
                if (typeof toastr !== 'undefined') toastr.success('Continuity memo copied to clipboard');
            }).catch(() => {
                if (typeof toastr !== 'undefined') toastr.info(`[Saga State]\n${memo}`);
            });
        }
    }, '\uD83D\uDCCB Copy continuity memo to clipboard', 'Saga');

    register('saga-state', async () => {
        const state = getState();
        const json = exportSagaState(state);
        navigator.clipboard.writeText(json).then(() => {
            if (typeof toastr !== 'undefined') toastr.success('Saga state export JSON copied to clipboard');
        }).catch(() => {
            if (typeof toastr !== 'undefined') toastr.info(`State JSON (${json.length} chars) ready; clipboard unavailable`);
        });
    }, '\uD83D\uDCC4 Export Saga state as JSON', 'Saga');

    register('saga-lore-detect', async () => {
        try {
            if (typeof toastr !== 'undefined') toastr.info('Running lore context detection...');
            await runRuntimeAction('lore.context.detect', { force: true });
            if (typeof toastr !== 'undefined') toastr.success('Lore context detection completed');
        } catch (e) {
            console.error(`${LOG_PREFIX} Lore detection failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Lore detection failed: ${e.message}`);
        }
    }, '\uD83D\uDD0D Re-run Context detection', 'Saga Lorecards');

    const runManualLoreScanCommand = async () => {
        try {
            if (typeof toastr !== 'undefined') toastr.info('Scanning story lore...');
            await runRuntimeAction('lore.story.scan', { force: true, source: 'manual' });
            if (typeof toastr !== 'undefined') toastr.success('Story lore scan completed');
        } catch (e) {
            console.error(`${LOG_PREFIX} Lore scan failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Lore scan failed: ${e.message}`);
        }
    };

    register('saga-lore-scan', runManualLoreScanCommand, '\u2728 Scan story lorecards', 'Saga Lorecards');
    register('saga-lore-generate', runManualLoreScanCommand, '\u2728 Scan story lorecards', 'Saga Lorecards');

    register('saga-lore-accept', async () => {
        try {
            if ((getSettings().experienceMode || 'basic') !== 'advanced') {
                if (typeof toastr !== 'undefined') toastr.warning('/saga-lore-accept is available in Advanced mode only. Review selected Lorecards in Basic.');
                return;
            }
            const state = getState();
            const pendingCount = (state?.pendingLoreEntries || []).length;
            const confirmed = await confirmSlashBulkPendingAction(ctx, 'Accept', pendingCount);
            if (!confirmed) return;
            await runRuntimeAction('lore.pending.acceptAll');
            if (typeof toastr !== 'undefined') toastr.success(`Accepted ${pendingCount} Pending Review entr${pendingCount === 1 ? 'y' : 'ies'}`);
        } catch (e) {
            console.error(`${LOG_PREFIX} Accept lore failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Accept lore failed: ${e.message}`);
        }
    }, '\u2705 Accept all Pending Review entries after confirmation', 'Saga Lorecards');

    register('saga-lore-reject', async () => {
        try {
            if ((getSettings().experienceMode || 'basic') !== 'advanced') {
                if (typeof toastr !== 'undefined') toastr.warning('/saga-lore-reject is available in Advanced mode only. Review selected Lorecards in Basic.');
                return;
            }
            const state = getState();
            const pendingCount = (state?.pendingLoreEntries || []).length;
            const confirmed = await confirmSlashBulkPendingAction(ctx, 'Reject', pendingCount);
            if (!confirmed) return;
            await runRuntimeAction('lore.pending.rejectAll');
            if (typeof toastr !== 'undefined') toastr.success(`Rejected ${pendingCount} Pending Review entr${pendingCount === 1 ? 'y' : 'ies'}`);
        } catch (e) {
            console.error(`${LOG_PREFIX} Reject lore failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Reject lore failed: ${e.message}`);
        }
    }, '\u274C Reject all Pending Review entries after confirmation', 'Saga Lorecards');

    register('saga-lore-panel', async () => {
        try {
            const result = runRuntimeAction('runtime.toggle');
            if (result?.isOpen === false) {
                if (typeof toastr !== 'undefined') toastr.info('Lore panel hidden');
            } else {
                if (typeof toastr !== 'undefined') toastr.info('Lore panel shown');
            }
        } catch (e) {
            console.error(`${LOG_PREFIX} Toggle lore panel failed:`, e);
            if (typeof toastr !== 'undefined') toastr.error(`Toggle lore panel failed: ${e.message}`);
        }
    }, '\uD83D\uDCD6 Toggle the Saga runtime panel', 'Saga Lorecards');

    console.log(`${LOG_PREFIX} Slash commands registered`);
}

export const __sagaSlashCommandTestHooks = Object.freeze({
    registerSagaSlashCommand,
    confirmSlashBulkPendingAction,
});
