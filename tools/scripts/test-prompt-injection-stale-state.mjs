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

const extensionIndex = await readText('src/extension/index.js');
const promptInjector = await readText('src/continuity/prompt-injector.js');
const runtimePanel = await readText('src/runtime/lore-panel.js');

assert(extensionIndex.includes('function clearSagaPromptInjectionSafely'), 'Extension handlers must use a safe prompt-clear helper.');
const safeClearBody = functionBody(extensionIndex, 'clearSagaPromptInjectionSafely');
assert(safeClearBody.includes('clearExtensionPrompts()'), 'Safe prompt-clear helper must clear SillyTavern prompt blocks.');

for (const handler of [
  'handleBeforePromptSync',
  'handleGenerationEnded',
  'handleGenerationInterrupted',
  'handleChatChanged',
  'handleExtensionDisabled',
]) {
  assert(extensionIndex.includes(`function ${handler}`), `${handler} must be a named event handler.`);
}

const beforePromptBody = functionBody(extensionIndex, 'handleBeforePromptSync');
assert(beforePromptBody.includes('syncPromptInjection()'), 'Before-prompt handler must sync Saga prompt blocks.');
assert(beforePromptBody.includes('clearSagaPromptInjectionSafely'), 'Before-prompt handler must clear prompt blocks after sync failure.');

const interruptedBody = functionBody(extensionIndex, 'handleGenerationInterrupted');
assertBefore(interruptedBody, 'clearSagaPromptInjectionSafely', 'syncPromptInjection()', 'Interrupted generation must clear stale blocks before rebuilding current prompt state.');

const chatChangedBody = functionBody(extensionIndex, 'handleChatChanged');
assertBefore(chatChangedBody, 'clearSagaPromptInjectionSafely', 'syncPromptInjection()', 'Chat changes must clear stale prompt blocks before rebuilding.');
assert(chatChangedBody.includes('refreshLorePanel()'), 'Chat changes must refresh the runtime preview.');
assert(chatChangedBody.includes('_sagaRefreshUI'), 'Chat changes must refresh the settings/state UI when present.');

const disabledBody = functionBody(extensionIndex, 'handleExtensionDisabled');
assert(disabledBody.includes('clearSagaPromptInjectionSafely'), 'Extension disable handler must clear prompt blocks.');
assert(disabledBody.includes('hideLorePanel()'), 'Extension disable handler must hide the Saga runtime.');

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
  assert(extensionIndex.includes(eventName), `Event handling must cover ${eventName}.`);
}

assert.match(
  extensionIndex,
  /registerEventHandlers\(ctx\.eventSource,[\s\S]*events\.GENERATION_STOPPED[\s\S]*events\.GENERATION_FAILED[\s\S]*events\.GENERATION_ABORTED[\s\S]*handleGenerationInterrupted[\s\S]*registerEventHandler\(ctx\.eventSource,[\s\S]*events\.CHAT_CHANGED[\s\S]*handleChatChanged[\s\S]*registerEventHandlers\(ctx\.eventSource,[\s\S]*events\.EXTENSION_DISABLED[\s\S]*events\.EXTENSION_DISABLE[\s\S]*handleExtensionDisabled/,
  'Primary eventSource path must register each stale-state lifecycle event with the same named handlers.'
);
assert.match(
  extensionIndex,
  /registerEventHandler\(bus,[\s\S]*handleChatChanged[\s\S]*registerEventHandler\(bus,[\s\S]*handleExtensionDisabled/,
  'eventBus fallback must use the same named stale-state handlers.'
);
assert.match(
  extensionIndex,
  /ctx\.eventTypes\[eventName\]\.push\(handler\)/,
  'eventTypes fallback must push the shared named handlers.'
);

const syncBody = functionBody(promptInjector, 'syncPromptInjection');
assertBefore(syncBody, 'if (!settings.enabled)', 'clearExtensionPrompts()', 'Disabled Saga injection must clear extension prompts.');
assert(syncBody.includes("transport: 'disabled'"), 'Disabled Saga injection should record disabled sync status.');
assert(syncBody.includes("transport: 'interceptor'"), 'Legacy interceptor mode should clear extension prompts and record fallback status.');
assert(syncBody.includes('clearExtensionPrompts();') && syncBody.includes('recordLoreInjectionAudit'), 'Sync path should clear stale blocks and audit the resulting prompt state.');

assert(runtimePanel.includes('getInjectionEmptyReason'), 'Injection preview must explain empty prompt reasons.');
assert(runtimePanel.includes('No Loredecks are loaded for Lore injection'), 'Lore preview must explain unloaded Loredeck state.');
assert(runtimePanel.includes('No accepted Lorecards are available to inject'), 'Lore preview must explain empty accepted Lorecard state.');
assert(runtimePanel.includes('Continuity injection has no scene'), 'Continuity preview must explain empty continuity state.');
assert(runtimePanel.includes('refreshInjectionPreviewOnly') && runtimePanel.includes('getInjectionEmptyReason'), 'Refresh-only path must preserve empty-reason text.');

console.log('Prompt injection stale-state contract passed.');
