/**
 * index.js - Saga
 * Extension entrypoint composition layer.
 */

import { bootstrapSagaExtension } from './bootstrap.js';
import { configureRuntimeActions } from './runtime-mount.js';
import { __sagaEventTestHooks } from './events.js';

export {
    sagaOnInstall,
    sagaOnUpdate,
    sagaOnEnable,
    sagaOnDisable,
    sagaOnDelete,
    sagaOnClean,
    sagaOnActivate,
} from './lifecycle.js';

configureRuntimeActions();

$(document).ready(async () => {
    'use strict';
    await bootstrapSagaExtension();
});

export const __sagaTestHooks = __sagaEventTestHooks;
