/**
 * Shared Saga runtime action registry.
 *
 * The registry owns action lookup and dispatch only. Domain modules still own
 * the actual behavior so this does not become another runtime controller.
 */

const runtimeActions = new Map();

function normalizeActionId(id) {
    const value = String(id || '').trim();
    if (!value) {
        throw new Error('Saga runtime action id is required.');
    }
    return value;
}

function normalizeActionDefinition(id, definition, options = {}) {
    const actionId = normalizeActionId(id);
    const source = typeof definition === 'function'
        ? { handler: definition }
        : { ...(definition || {}) };
    const handler = source.handler;
    if (typeof handler !== 'function') {
        throw new Error(`Saga runtime action "${actionId}" must provide a handler.`);
    }
    delete source.handler;
    delete source.id;
    delete source.replace;

    return {
        id: actionId,
        category: options.category || source.category || 'runtime',
        label: options.label || source.label || actionId,
        description: options.description || source.description || '',
        handler,
    };
}

export function registerRuntimeAction(id, definition, options = {}) {
    const actionId = normalizeActionId(id);
    const replace = options.replace === true || definition?.replace === true;
    if (runtimeActions.has(actionId) && !replace) {
        throw new Error(`Saga runtime action "${actionId}" is already registered.`);
    }
    const action = normalizeActionDefinition(actionId, definition, options);
    runtimeActions.set(actionId, action);
    return action;
}

export function registerRuntimeActions(actions = [], options = {}) {
    const registered = [];
    for (const action of actions) {
        if (!action) continue;
        if (Array.isArray(action)) {
            registered.push(registerRuntimeAction(action[0], action[1], options));
            continue;
        }
        registered.push(registerRuntimeAction(action.id, action, options));
    }
    return registered;
}

export function hasRuntimeAction(id) {
    return runtimeActions.has(normalizeActionId(id));
}

export function getRuntimeAction(id) {
    return runtimeActions.get(normalizeActionId(id)) || null;
}

export function listRuntimeActions() {
    return Array.from(runtimeActions.values()).map(({ handler, ...metadata }) => ({ ...metadata }));
}

export function runRuntimeAction(id, payload = {}, context = {}) {
    const actionId = normalizeActionId(id);
    const action = runtimeActions.get(actionId);
    if (!action) {
        throw new Error(`Saga runtime action "${actionId}" is not registered.`);
    }
    return action.handler(payload, context, action);
}

export const dispatchRuntimeAction = runRuntimeAction;

export const __runtimeActionTestHooks = Object.freeze({
    clearRuntimeActions: () => runtimeActions.clear(),
});
