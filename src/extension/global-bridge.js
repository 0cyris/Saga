/**
 * Global bridge exports for Saga.
 */

import { LOG_PREFIX } from '../state/constants.js';
import { getState } from '../state/state-manager.js';
import { buildMemo } from '../continuity/memo-builder.js';
import { hasRuntimeAction, listRuntimeActions, runRuntimeAction } from '../runtime/runtime-actions.js';
import { getLastLoreInjectionAudit, getLastLoredeckRetrievalAudit, searchAcceptedLorecards } from '../lorecards/retrieval-audit.js';
import { registerSagaToolManagerTools } from './saga-tool-registry.js';

export function exposeGlobalBridge() {
    const sagaNamespace = globalThis.Saga && typeof globalThis.Saga === 'object'
        ? globalThis.Saga
        : {};
    globalThis.Saga = sagaNamespace;
    sagaNamespace.actions = {
        has: hasRuntimeAction,
        list: listRuntimeActions,
        run: runRuntimeAction,
    };

    globalThis._sagaBuildMemo = buildMemo;
    globalThis._sagaRefreshUI = () => runRuntimeAction('ui.refresh');
    globalThis._sagaGetState = getState;
    globalThis._sagaShowLorePanel = () => runRuntimeAction('runtime.show');
    globalThis._sagaHideLorePanel = () => runRuntimeAction('runtime.hide');
    globalThis._sagaRefreshLorePanel = () => runRuntimeAction('runtime.refresh');
    globalThis._sagaRunAction = runRuntimeAction;
    globalThis._sagaListActions = listRuntimeActions;
    globalThis._sagaGetLastLoreInjectionAudit = getLastLoreInjectionAudit;
    globalThis._sagaGetLastLoredeckRetrievalAudit = getLastLoredeckRetrievalAudit;
    globalThis._sagaSearchLorecards = (query, options = {}) => searchAcceptedLorecards(getState(), query, options);
    globalThis._sagaRegisterToolManagerTools = registerSagaToolManagerTools;
    console.log(`${LOG_PREFIX} Global bridge exposed`);
}
