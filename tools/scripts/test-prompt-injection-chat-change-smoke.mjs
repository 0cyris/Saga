import assert from 'node:assert/strict';

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
  },
  eventSource: {
    on(eventName, handler) {
      handlers.set(eventName, handler);
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
globalThis.document = {
  getElementById: () => null,
  querySelectorAll: () => [],
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const { __sagaTestHooks } = await import('../../src/extension/index.js');

__sagaTestHooks.wireEvents(ctx);

const chatChanged = handlers.get('CHAT_CHANGED');
assert.equal(typeof chatChanged, 'function', 'CHAT_CHANGED must be wired to a handler.');

chatChanged();

const promptKeys = [
  'saga_continuity_state',
  'saga_lore_entries',
  'saga_lore_high_relevance',
  'saga_lore_normal_relevance',
  'saga_lore_low_relevance',
];

assert(promptWrites.length >= promptKeys.length, 'Chat change must write prompt clears before rebuilding injection state.');
assert.deepEqual(
  promptWrites.slice(0, promptKeys.length).map(write => write.key),
  promptKeys,
  'Chat change must clear every Saga prompt key before syncing current prompt state.'
);
assert(
  promptWrites.slice(0, promptKeys.length).every(write => write.value === ''),
  'Chat change prompt-clear writes must use empty prompt values.'
);

console.log('Prompt injection chat-change smoke passed.');
