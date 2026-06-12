import assert from 'node:assert/strict';
import {
  confirmAction,
} from '../../src/ui/runtime-ui-kit.js';

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
    for (const name of names) {
      if (name) this.values.add(String(name));
    }
    this.sync();
  }

  contains(name) {
    return this.values.has(String(name));
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
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
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

  removeEventListener(type, handler) {
    const list = this.listeners[type] || [];
    const index = list.indexOf(handler);
    if (index >= 0) list.splice(index, 1);
  }

  focus() {}

  async click() {
    const event = {
      type: 'click',
      target: this,
      stopPropagation() {},
      preventDefault() {},
    };
    for (const handler of this.listeners.click || []) await handler(event);
    await Promise.resolve();
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

  createDocumentFragment() {
    return new FakeElement('#fragment');
  }
}

globalThis.document = new FakeDocument();
globalThis.window = { innerWidth: 1280, innerHeight: 720, document: globalThis.document };
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);

{
  const pending = confirmAction('Delete Loredeck?', 'Delete this Loredeck?');
  const overlay = document.querySelector('.saga-confirm-overlay');
  assert.ok(overlay, 'Default confirmation should render an overlay.');
  const buttons = overlay.querySelectorAll('button');
  assert.deepEqual(buttons.map(button => button.textContent), ['Cancel', 'Confirm']);
  assert.equal(buttons[1].dataset.sagaTooltip, 'Confirm and continue.');
  assert.equal(buttons[1].classList.contains('saga-danger-button'), true);
  await buttons[1].click();
  assert.equal(await pending, true);
  assert.equal(document.querySelector('.saga-confirm-overlay'), null);
}

{
  const pending = confirmAction('Reset to Title Pass?', 'This cannot be undone.', {
    cancelLabel: 'Keep current step',
    confirmLabel: 'Reset to Title Pass',
    confirmTooltip: 'Permanently erase later Creator data and return to Title Pass.',
  });
  const overlay = document.querySelector('.saga-confirm-overlay');
  assert.ok(overlay, 'Custom confirmation should render an overlay.');
  const buttons = overlay.querySelectorAll('button');
  assert.deepEqual(buttons.map(button => button.textContent), ['Keep current step', 'Reset to Title Pass']);
  assert.equal(buttons[1].dataset.sagaTooltip, 'Permanently erase later Creator data and return to Title Pass.');
  assert.equal(buttons[1].classList.contains('saga-danger-button'), true);
  await buttons[0].click();
  assert.equal(await pending, false);
  assert.equal(document.querySelector('.saga-confirm-overlay'), null);
}

console.log('Runtime UI confirm dialog tests passed.');
