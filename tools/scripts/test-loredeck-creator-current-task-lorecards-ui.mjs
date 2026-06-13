import assert from 'node:assert/strict';

import {
  configureLoredeckCreatorPanel,
  createLoredeckCreatorCurrentTaskCard,
} from '../../src/loredecks/loredeck-creator-panel.js';

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

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.contains(name) : Boolean(force);
    if (shouldAdd) this.add(name);
    else this.remove(name);
    return shouldAdd;
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
    this.title = '';
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

configureLoredeckCreatorPanel({
  getState: () => ({}),
  getLoredeckCreatorDraftInputs: () => ({}),
  getLoredeckCreatorGenerationSettings: () => ({}),
  markTourTarget: element => element,
  formatRelativeHealthTime: () => '-',
  formatLoredeckCreatorGranularity: value => String(value || 'focused'),
  createLoredeckCreatorCurrentTaskActions: () => document.createDocumentFragment(),
});

const cached = {
  approved: true,
  brief: { fandom: 'One Piece', scope: 'Arlong Park' },
  updatedAt: 1000,
};

const withRemaining = createLoredeckCreatorCurrentTaskCard(cached, {
  currentStep: { id: 'lorecards' },
  remainingEntryCount: 4,
  draftChanges: [{ changeId: 'draft-1' }],
  approvedTitles: [{ titleId: 'nami-secret' }],
});
assert.equal(
  withRemaining.querySelector('.saga-loredeck-creator-current-title')?.textContent,
  'Draft More Lorecards',
  'Current task should keep generation primary while more Lorecards remain.'
);

const reviewOnly = createLoredeckCreatorCurrentTaskCard(cached, {
  currentStep: { id: 'lorecards' },
  remainingEntryCount: 0,
  draftChanges: [{ changeId: 'draft-1' }],
  approvedTitles: [{ titleId: 'nami-secret' }],
});
assert.equal(
  reviewOnly.querySelector('.saga-loredeck-creator-current-title')?.textContent,
  'Review Lorecard Drafts',
  'Current task should switch to draft review only after remaining Lorecards are exhausted.'
);

console.log('Loredeck Creator current-task Lorecards UI tests passed.');
