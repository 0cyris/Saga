/**
 * SillyTavern event wiring for Saga.
 */

import { LOG_PREFIX } from '../state/constants.js';
import { runRuntimeAction } from '../runtime/runtime-actions.js';
import { clearExtensionPrompts, uninstallInterceptor } from '../continuity/prompt-injector.js';
import { onGenerationEndedAutomation, resetExtractionCounter } from '../continuity/extractor.js';
import { onGenerationEndedAutoRelevance } from '../context/auto-relevance.js';

export function clearSagaPromptInjectionSafely(reason = 'clearing prompt injection') {
    try {
        clearExtensionPrompts();
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed while ${reason}:`, e);
    }
}

export function handleBeforePromptSync() {
    try {
        runRuntimeAction('prompt.sync');
    } catch (e) {
        console.error(`${LOG_PREFIX} Error syncing Saga prompt injection before prompt assembly:`, e);
        clearSagaPromptInjectionSafely('recovering from prompt assembly sync failure');
    }
}

export function handleGenerationEnded() {
    try {
        onGenerationEndedAutomation();
        onGenerationEndedAutoRelevance();
        runRuntimeAction('prompt.sync');
    } catch (e) {
        console.error(`${LOG_PREFIX} Error in generation-ended handler:`, e);
        clearSagaPromptInjectionSafely('recovering from generation-ended prompt sync failure');
    }
}

export function handleGenerationInterrupted() {
    try {
        clearSagaPromptInjectionSafely('clearing prompt injection after interrupted generation');
        runRuntimeAction('prompt.sync');
    } catch (e) {
        console.error(`${LOG_PREFIX} Error clearing Saga prompt injection after interrupted generation:`, e);
        clearSagaPromptInjectionSafely('recovering from interrupted generation prompt sync failure');
    }
}

export function handleChatChanged() {
    try {
        resetExtractionCounter();
        clearSagaPromptInjectionSafely('clearing prompt injection after chat switch');
        runRuntimeAction('runtime.refresh');
        if (typeof globalThis._sagaRefreshUI === 'function') {
            globalThis._sagaRefreshUI();
        }
        runRuntimeAction('prompt.sync');
    } catch (e) {
        console.error(`${LOG_PREFIX} Error in chat-changed handler:`, e);
        clearSagaPromptInjectionSafely('recovering from chat-changed prompt sync failure');
    }
}

export function handleExtensionDisabled() {
    clearSagaPromptInjectionSafely('disabling Saga prompt injection');
    try {
        uninstallInterceptor();
    } catch (e) {
        console.error(`${LOG_PREFIX} Error while uninstalling Saga prompt injection during disable:`, e);
    }
    try {
        runRuntimeAction('runtime.hide');
    } catch (e) {
        console.error(`${LOG_PREFIX} Error while hiding Saga runtime during disable:`, e);
    }
}

function registerEventHandler(source, eventName, handler) {
    if (!source || !eventName || typeof source.on !== 'function') return false;
    source.on(eventName, handler);
    return true;
}

function registerEventHandlers(source, eventNames, handler) {
    const registered = new Set();
    for (const eventName of eventNames) {
        if (!eventName || registered.has(eventName)) continue;
        if (registerEventHandler(source, eventName, handler)) {
            registered.add(eventName);
        }
    }
    return registered.size;
}

export function wireEvents(ctx) {
    if (ctx.eventSource && ctx.event_types) {
        const events = ctx.event_types;
        registerEventHandlers(ctx.eventSource, [
            events.GENERATE_BEFORE_COMBINE_PROMPTS,
            events.GENERATION_STARTED,
        ], handleBeforePromptSync);
        registerEventHandler(ctx.eventSource, events.GENERATION_ENDED, handleGenerationEnded);
        registerEventHandlers(ctx.eventSource, [
            events.GENERATION_STOPPED,
            events.GENERATION_FAILED,
            events.GENERATION_ABORTED,
        ], handleGenerationInterrupted);
        registerEventHandler(ctx.eventSource, events.CHAT_CHANGED, handleChatChanged);
        registerEventHandlers(ctx.eventSource, [
            events.EXTENSION_DISABLED,
            events.EXTENSION_DISABLE,
        ], handleExtensionDisabled);
        console.log(`${LOG_PREFIX} Events wired via eventSource`);
        return;
    }

    const bus = ctx.eventBus || (typeof eventBus !== 'undefined' ? eventBus : null);
    if (bus && bus.on) {
        registerEventHandler(bus, 'GENERATE_BEFORE_COMBINE_PROMPTS', handleBeforePromptSync);
        registerEventHandler(bus, 'GENERATION_STARTED', handleBeforePromptSync);
        registerEventHandler(bus, 'GENERATION_ENDED', handleGenerationEnded);
        registerEventHandler(bus, 'GENERATION_STOPPED', handleGenerationInterrupted);
        registerEventHandler(bus, 'GENERATION_FAILED', handleGenerationInterrupted);
        registerEventHandler(bus, 'GENERATION_ABORTED', handleGenerationInterrupted);
        registerEventHandler(bus, 'CHAT_CHANGED', handleChatChanged);
        registerEventHandler(bus, 'EXTENSION_DISABLED', handleExtensionDisabled);
        console.log(`${LOG_PREFIX} Events wired via eventBus`);
        return;
    }

    if (ctx.eventTypes) {
        for (const [eventName, handler] of [
            ['GENERATE_BEFORE_COMBINE_PROMPTS', handleBeforePromptSync],
            ['GENERATION_STARTED', handleBeforePromptSync],
            ['GENERATION_ENDED', handleGenerationEnded],
            ['GENERATION_STOPPED', handleGenerationInterrupted],
            ['GENERATION_FAILED', handleGenerationInterrupted],
            ['GENERATION_ABORTED', handleGenerationInterrupted],
            ['CHAT_CHANGED', handleChatChanged],
            ['EXTENSION_DISABLED', handleExtensionDisabled],
        ]) {
            ctx.eventTypes[eventName] = ctx.eventTypes[eventName] || [];
            ctx.eventTypes[eventName].push(handler);
        }
        console.log(`${LOG_PREFIX} Events wired via eventTypes object`);
        return;
    }

    console.warn(`${LOG_PREFIX} No event API found. Manual extraction via slash command is still available.`);
}

export const __sagaEventTestHooks = Object.freeze({
    wireEvents,
    handleBeforePromptSync,
    handleGenerationEnded,
    handleGenerationInterrupted,
    handleChatChanged,
    handleExtensionDisabled,
});
