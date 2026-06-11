import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readText(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

function functionBody(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist.`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `${name} must have a body.`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`${name} body did not close.`);
}

function assertBefore(source, first, second, message) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert(firstIndex >= 0, `${message}: missing ${first}`);
  assert(secondIndex >= 0, `${message}: missing ${second}`);
  assert(firstIndex < secondIndex, message);
}

const extensionEvents = await readText('src/extension/events.js');
const promptInjector = await readText('src/continuity/prompt-injector.js');
const promptSync = await readText('src/state/prompt-sync.js');
const runtimePanel = await readText('src/runtime/lore-panel.js');
const injectionPanel = await readText('src/runtime/injection-preview-panel.js');
const runtimeInjectionSource = `${runtimePanel}\n${injectionPanel}`;

assert(extensionEvents.includes('function clearSagaPromptInjectionSafely'), 'Extension handlers must use a safe prompt-clear helper.');
const safeClearBody = functionBody(extensionEvents, 'clearSagaPromptInjectionSafely');
assert(safeClearBody.includes('clearExtensionPrompts()'), 'Safe prompt-clear helper must clear SillyTavern prompt blocks.');

for (const handler of [
  'handleBeforePromptSync',
  'handleGenerationEnded',
  'handleGenerationInterrupted',
  'handleChatChanged',
  'handleExtensionDisabled',
]) {
  assert(extensionEvents.includes(`function ${handler}`), `${handler} must be a named event handler.`);
}

const beforePromptBody = functionBody(extensionEvents, 'handleBeforePromptSync');
assert(beforePromptBody.includes("runRuntimeAction('prompt.sync')"), 'Before-prompt handler must sync Saga prompt blocks through the shared action registry.');
assert(beforePromptBody.includes('clearSagaPromptInjectionSafely'), 'Before-prompt handler must clear prompt blocks after sync failure.');

const interruptedBody = functionBody(extensionEvents, 'handleGenerationInterrupted');
assertBefore(interruptedBody, 'clearSagaPromptInjectionSafely', "runRuntimeAction('prompt.sync')", 'Interrupted generation must clear stale blocks before rebuilding current prompt state.');

const chatChangedBody = functionBody(extensionEvents, 'handleChatChanged');
assertBefore(chatChangedBody, 'clearSagaPromptInjectionSafely', "runRuntimeAction('prompt.sync')", 'Chat changes must clear stale prompt blocks before rebuilding.');
assert(chatChangedBody.includes("runRuntimeAction('runtime.refresh')"), 'Chat changes must refresh the runtime preview through the shared action registry.');
assert(chatChangedBody.includes('_sagaRefreshUI'), 'Chat changes must refresh the settings/state UI when present.');

const disabledBody = functionBody(extensionEvents, 'handleExtensionDisabled');
assert(disabledBody.includes('clearSagaPromptInjectionSafely'), 'Extension disable handler must clear prompt blocks.');
assert(disabledBody.includes('uninstallInterceptor()'), 'Extension disable handler must uninstall prompt injection globals.');
assert(disabledBody.includes("runRuntimeAction('runtime.hide')"), 'Extension disable handler must hide the Saga runtime through the shared action registry.');

const hideLorePanelBody = functionBody(runtimePanel, 'hideLorePanel');
assert(hideLorePanelBody.includes('closeRuntimeFullscreenSurfaces()'), 'Runtime hide must close fullscreen workbench surfaces through the shared teardown helper.');
const closeRuntimeFullscreenSurfacesBody = functionBody(runtimePanel, 'closeRuntimeFullscreenSurfaces');
assert(closeRuntimeFullscreenSurfacesBody.includes('closeLoreWorkbench()'), 'Runtime teardown must close the Lorecard Workbench.');
assert(closeRuntimeFullscreenSurfacesBody.includes('closeLoredeckWorkbench()'), 'Runtime teardown must close the Loredeck Workbench.');
assert(closeRuntimeFullscreenSurfacesBody.includes('closeContextWorkbench()'), 'Runtime teardown must close the Context Workbench.');
assert(closeRuntimeFullscreenSurfacesBody.includes('saga-loredeck-library-overlay'), 'Runtime teardown must close the Loredeck Library overlay.');
assert(!runtimePanel.includes('closeLoreWorkbench();\n    removeLorePanel();'), 'Runtime hide must not call an undefined legacy workbench closer directly.');

for (const eventName of [
  'GENERATE_BEFORE_COMBINE_PROMPTS',
  'GENERATION_STARTED',
  'GENERATION_ENDED',
  'GENERATION_STOPPED',
  'GENERATION_FAILED',
  'GENERATION_ABORTED',
  'CHAT_CHANGED',
  'EXTENSION_DISABLED',
]) {
  assert(extensionEvents.includes(eventName), `Event handling must cover ${eventName}.`);
}

assert.match(
  extensionEvents,
  /registerEventHandlers\(ctx\.eventSource,[\s\S]*events\.GENERATION_STOPPED[\s\S]*events\.GENERATION_FAILED[\s\S]*events\.GENERATION_ABORTED[\s\S]*handleGenerationInterrupted[\s\S]*registerEventHandler\(ctx\.eventSource,[\s\S]*events\.CHAT_CHANGED[\s\S]*handleChatChanged[\s\S]*registerEventHandlers\(ctx\.eventSource,[\s\S]*events\.EXTENSION_DISABLED[\s\S]*events\.EXTENSION_DISABLE[\s\S]*handleExtensionDisabled/,
  'Primary eventSource path must register each stale-state lifecycle event with the same named handlers.'
);
assert.match(
  extensionEvents,
  /registerEventHandler\(bus,[\s\S]*handleChatChanged[\s\S]*registerEventHandler\(bus,[\s\S]*handleExtensionDisabled/,
  'eventBus fallback must use the same named stale-state handlers.'
);
assert.match(
  extensionEvents,
  /ctx\.eventTypes\[eventName\]\.push\(handler\)/,
  'eventTypes fallback must push the shared named handlers.'
);

const syncBody = functionBody(promptInjector, 'syncPromptInjection');
assertBefore(syncBody, 'if (!settings.enabled)', 'clearExtensionPrompts()', 'Disabled Saga injection must clear extension prompts.');
assert(syncBody.includes("transport: 'disabled'"), 'Disabled Saga injection should record disabled sync status.');
assert(syncBody.includes("transport: 'interceptor'"), 'Legacy interceptor mode should clear extension prompts and record fallback status.');
assert(syncBody.includes('clearExtensionPrompts();') && syncBody.includes('recordLoreInjectionAudit'), 'Sync path should clear stale blocks and audit the resulting prompt state.');
assert(promptInjector.includes('globalThis.Saga') && promptInjector.includes('promptInjection.sync'), 'Prompt injector must expose sync helpers under globalThis.Saga.promptInjection.');
assert(promptInjector.includes('export function uninstallInterceptor'), 'Prompt injector must expose an uninstall path for disable/cleanup handling.');
assert(!promptInjector.includes('globalThis.sagaSyncPromptInjection =') && !promptInjector.includes('globalThis.sagaClearPromptInjection =') && !promptInjector.includes('globalThis.sagaGetInjectionStatus ='), 'Prompt injector must not publish scattered prompt helper globals.');
assert(!promptSync.includes('sagaSyncPromptInjection') && !runtimeInjectionSource.includes('sagaGetInjectionStatus') && !runtimeInjectionSource.includes('sagaSyncPromptInjection'), 'Prompt sync callers must use globalThis.Saga.promptInjection instead of legacy helper globals.');
assert(!promptInjector.includes('globalThis.sagaContinuityInterceptor ='), 'Prompt injector must not recreate the old continuity interceptor alias.');

assert(runtimeInjectionSource.includes('getInjectionEmptyReason'), 'Injection preview must explain empty prompt reasons.');
assert(runtimeInjectionSource.includes('No Loredecks are loaded for Lore injection'), 'Lore preview must explain unloaded Loredeck state.');
assert(runtimeInjectionSource.includes('No accepted Lorecards are available to inject'), 'Lore preview must explain empty accepted Lorecard state.');
assert(runtimeInjectionSource.includes('Continuity injection has no scene'), 'Continuity preview must explain empty continuity state.');
assert(runtimeInjectionSource.includes('refreshInjectionPreviewOnly') && runtimeInjectionSource.includes('getInjectionEmptyReason'), 'Refresh-only path must preserve empty-reason text.');

console.log('Prompt injection stale-state contract passed.');
