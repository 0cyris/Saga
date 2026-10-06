import assert from 'node:assert/strict';

const PROMPT_KEYS = [
  'saga_continuity_state',
  'saga_lore_entries',
  'saga_lore_high_relevance',
  'saga_lore_normal_relevance',
  'saga_lore_low_relevance',
];

const promptWrites = [];
const handlers = new Map();
const chatMetadata = {};
const extensionSettings = {
  saga: {
    enabled: true,
    injectionTransport: 'extension_prompt',
  },
};

const ctx = {
  chatMetadata,
  extensionSettings,
  event_types: {
    GENERATE_BEFORE_COMBINE_PROMPTS: 'GENERATE_BEFORE_COMBINE_PROMPTS',
    GENERATION_STARTED: 'GENERATION_STARTED',
    GENERATION_ENDED: 'GENERATION_ENDED',
    GENERATION_STOPPED: 'GENERATION_STOPPED',
    GENERATION_FAILED: 'GENERATION_FAILED',
    GENERATION_ABORTED: 'GENERATION_ABORTED',
    CHAT_CHANGED: 'CHAT_CHANGED',
    EXTENSION_DISABLED: 'EXTENSION_DISABLED',
    EXTENSION_DISABLE: 'EXTENSION_DISABLE',
  },
  eventSource: {
    on(eventName, handler) {
      const list = handlers.get(eventName) || [];
      list.push(handler);
      handlers.set(eventName, list);
    },
    off(eventName, handler) {
      handlers.set(eventName, (handlers.get(eventName) || []).filter(item => item !== handler));
    },
  },
  extension_prompt_types: {
    IN_PROMPT: 0,
    IN_CHAT: 1,
    BEFORE_PROMPT: 2,
  },
  extension_prompt_roles: {
    SYSTEM: 0,
    USER: 1,
    ASSISTANT: 2,
  },
  setExtensionPrompt(key, value, position, depth, scan, role) {
    promptWrites.push({ key, value, position, depth, scan, role });
  },
  saveMetadata() {},
  saveSettingsDebounced() {},
};

globalThis.$ = () => ({ ready() {} });
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
};
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({
    appendChild() {},
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    dataset: {},
  }),
  body: { appendChild() {} },
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const { __sagaTestHooks } = await import('../../src/extension/index.js');

__sagaTestHooks.wireEvents(ctx);

function getHandler(eventName) {
  const list = handlers.get(eventName) || [];
  assert.equal(list.length, 1, `${eventName} must be wired exactly once on the primary eventSource path.`);
  return list[0];
}

function assertPromptClearPrefix(label) {
  assert(promptWrites.length >= PROMPT_KEYS.length, `${label} must write prompt clears.`);
  assert.deepEqual(
    promptWrites.slice(0, PROMPT_KEYS.length).map(write => write.key),
    PROMPT_KEYS,
    `${label} must clear every Saga prompt key before any resync writes.`
  );
  assert(
    promptWrites.slice(0, PROMPT_KEYS.length).every(write => write.value === ''),
    `${label} prompt-clear writes must use empty prompt values.`
  );
}

for (const eventName of [
  'GENERATE_BEFORE_COMBINE_PROMPTS',
  'GENERATION_STARTED',
  'GENERATION_STOPPED',
  'GENERATION_FAILED',
  'GENERATION_ABORTED',
  'CHAT_CHANGED',
  'EXTENSION_DISABLED',
  'EXTENSION_DISABLE',
]) {
  getHandler(eventName);
}

for (const eventName of ['GENERATION_STOPPED', 'GENERATION_FAILED', 'GENERATION_ABORTED']) {
  promptWrites.length = 0;
  getHandler(eventName)();
  assertPromptClearPrefix(eventName);
}

const staleBeforePrompt = getHandler('GENERATE_BEFORE_COMBINE_PROMPTS');
promptWrites.length = 0;
getHandler('EXTENSION_DISABLED')();
assertPromptClearPrefix('EXTENSION_DISABLED');
assert([...handlers.values()].every(list => list.length === 0), 'Disable must remove host listeners.');
const latestPrompts = new Map(promptWrites.map(write => [write.key, write.value]));
assert(PROMPT_KEYS.every(key => latestPrompts.get(key) === ''), 'Disable must leave every Saga prompt key empty.');

extensionSettings.saga.enabled = false;
promptWrites.length = 0;
staleBeforePrompt();
assert.equal(promptWrites.length, 0, 'A disposed event callback must remain inert.');

extensionSettings.saga.enabled = true;
const { sagaOnEnable } = await import('../../src/extension/lifecycle.js');
await sagaOnEnable();
getHandler('GENERATE_BEFORE_COMBINE_PROMPTS');
assert.equal(typeof globalThis.Saga.bridge.refreshUI, 'function', 'Enable must restore the UI bridge.');

console.log('Prompt injection event lifecycle smoke passed.');
