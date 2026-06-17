import assert from 'node:assert/strict';
import {
  LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
} from '../../src/loredecks/loredeck-creator-generation-settings.js';
import {
  createLoredeckCreatorAdvancedGenerationSettings,
} from '../../src/loredecks/loredeck-creator-generation-settings-panel.js';

class FakeClassList {
  constructor(el) {
    this.el = el;
    this.values = new Set();
  }

  load(value) {
    this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
    this.sync();
  }

  sync() {
    this.el._className = [...this.values].join(' ');
  }

  add(...names) {
    for (const name of names) if (name) this.values.add(String(name));
    this.sync();
  }

  remove(...names) {
    for (const name of names) this.values.delete(String(name));
    this.sync();
  }

  contains(name) {
    return this.values.has(String(name));
  }
}

class FakeText {
  constructor(text = '') {
    this.textContent = String(text ?? '');
    this.parentNode = null;
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.nodeName = this.tagName;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.style = {};
    this.disabled = false;
    this.type = '';
    this.value = '';
    this.checked = false;
    this.open = false;
    this._className = '';
    this._textContent = '';
    this.classList = new FakeClassList(this);
  }

  set className(value) {
    this.classList.load(value);
  }

  get className() {
    return this._className;
  }

  set textContent(value) {
    this._textContent = String(value ?? '');
    this.children = [];
  }

  get textContent() {
    return this._textContent + this.children.map(child => child.textContent || '').join('');
  }

  appendChild(child) {
    if (!child) return child;
    if (child.parentNode) child.remove?.();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = [];
    this._textContent = '';
    for (const child of children) this.appendChild(child);
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes[String(name)] = String(value);
  }

  getAttribute(name) {
    return this.attributes[String(name)] ?? null;
  }

  removeAttribute(name) {
    delete this.attributes[String(name)];
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  async emit(type) {
    const event = {
      type,
      target: this,
      preventDefault() {},
      stopPropagation() {},
    };
    for (const handler of this.listeners[type] || []) await handler(event);
  }

  async click() {
    await this.emit('click');
  }

  matches(selector) {
    const raw = String(selector || '').trim();
    if (!raw) return false;
    if (raw.startsWith('.')) return this.classList.contains(raw.slice(1));
    if (raw.startsWith('#')) return this.getAttribute('id') === raw.slice(1);
    return this.tagName.toLowerCase() === raw.toLowerCase();
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      for (const child of node.children || []) {
        if (child.matches?.(selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super('#document');
    this.body = new FakeElement('body');
    this.appendChild(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  createTextNode(text) {
    return new FakeText(text);
  }

  createDocumentFragment() {
    return new FakeElement('#fragment');
  }
}

globalThis.document = new FakeDocument();
globalThis.window = { innerWidth: 1280, innerHeight: 720, document: globalThis.document };

function findInput(root, key) {
  return root.querySelectorAll('input')
    .find(input => input.dataset.sagaCreatorGenerationSetting === key);
}

let settings = {
  ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS,
  titleBatchLimit: 6,
  entryBatchSize: 2,
  retryAttempts: 1,
  useUtilityProviderForSplitRetries: false,
  showStreamingProgress: true,
};
const patches = [];
const toasts = [];
const panel = createLoredeckCreatorAdvancedGenerationSettings({ jobId: 'creator-settings' }, {
  getGenerationSettings: () => settings,
  setGenerationSettings: patch => {
    patches.push(patch);
    settings = { ...settings, ...patch };
    return { generationSettings: settings };
  },
  resetGenerationSettings: () => {
    settings = { ...LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS };
    return { generationSettings: settings };
  },
  toast: (message, tone) => toasts.push({ message, tone }),
});

assert.equal(panel.tagName, 'DETAILS');
assert.equal(panel.dataset.sagaCreatorAnchor, 'advanced-generation');
assert.ok(panel.textContent.includes('Advanced Generation Settings'));
assert.ok(panel.textContent.includes('6 titles/call'));
assert.ok(panel.textContent.includes('2 Lorecards/call'));
assert.ok(panel.textContent.includes('Utility split retries off'));

const titleLimit = findInput(panel, 'titleBatchLimit');
assert.ok(titleLimit, 'Title batch limit input should render.');
titleLimit.value = '99';
await titleLimit.emit('change');
assert.deepEqual(patches.at(-1), { titleBatchLimit: 12 }, 'Range inputs should clamp through the generation setting limits.');
assert.equal(titleLimit.value, '12');
assert.ok(panel.textContent.includes('12 titles/call'), 'Summary should refresh after range changes.');

const utilityToggle = findInput(panel, 'useUtilityProviderForSplitRetries');
assert.ok(utilityToggle, 'Utility split retry toggle should render.');
utilityToggle.checked = true;
await utilityToggle.emit('change');
assert.deepEqual(patches.at(-1), { useUtilityProviderForSplitRetries: true });
assert.equal(utilityToggle.parentNode.querySelector('.saga-loredeck-creator-generation-toggle-value').textContent, 'On');
assert.ok(panel.textContent.includes('Utility split retries on'), 'Summary should refresh after toggle changes.');

const resetButton = panel.querySelectorAll('button')
  .find(button => button.textContent === 'Reset Advanced Settings');
assert.ok(resetButton, 'Reset Advanced Settings button should render.');
await resetButton.click();
assert.equal(findInput(panel, 'titleBatchLimit').value, String(LOREDECK_CREATOR_GENERATION_SETTING_DEFAULTS.titleBatchLimit));
assert.equal(findInput(panel, 'useUtilityProviderForSplitRetries').checked, false);
assert.deepEqual(toasts.at(-1), {
  message: 'Deck Maker generation settings reset.',
  tone: 'info',
});

console.log('Deck Maker generation settings panel tests passed.');
