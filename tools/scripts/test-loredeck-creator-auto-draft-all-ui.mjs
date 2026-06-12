import assert from 'node:assert/strict';
import {
  configureLoredeckCreatorPanel,
  createLoredeckCreatorEntryDraftCard,
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

  get innerText() {
    return this.textContent;
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

  async click() {
    if (this.disabled) return;
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

const generatedPack = {
  packId: 'generated-one-piece-arlong',
  type: 'generated',
  title: 'Generated Arlong Park',
};

const cached = {
  jobId: 'creator-one-piece-arlong',
  generatedPackId: generatedPack.packId,
  brief: {
    title: 'Arlong Park',
  },
  titleDrafts: [
    { titleId: 'nami-secret', title: 'Nami secret', creatorTitleBatchId: 'batch-a', creatorTitleBatchLabel: 'Characters' },
    { titleId: 'arlong-threat', title: 'Arlong threat', creatorTitleBatchId: 'batch-a', creatorTitleBatchLabel: 'Characters' },
    { titleId: 'cocoyasi-revolt', title: 'Cocoyasi revolt', creatorTitleBatchId: 'batch-b', creatorTitleBatchLabel: 'Village' },
    { titleId: 'pinwheel-memory', title: 'Pinwheel memory', creatorTitleBatchId: 'batch-b', creatorTitleBatchLabel: 'Village' },
  ],
  approvedTitleDraftIds: ['nami-secret', 'arlong-threat', 'cocoyasi-revolt', 'pinwheel-memory'],
  planningBatchAcceptedIds: ['batch-a', 'batch-b'],
};

const progress = {
  remainingCount: 7,
  batchCount: 3,
  batchSize: 3,
  eligibleBatchCount: 2,
  eligibleBatchIds: new Set(['batch-a', 'batch-b']),
  activeBatchId: 'batch-a',
  activeBatchLabel: 'Characters',
  preferred: cached.titleDrafts,
  totalRemaining: cached.titleDrafts,
};

let confirmCall = null;
let draftCall = null;

configureLoredeckCreatorPanel({
  getState: () => ({}),
  getLoredeckDefinition: packId => (packId === generatedPack.packId ? generatedPack : null),
  getFreshLoredeckLibraryPack: (packId, fallback) => (packId === generatedPack.packId ? generatedPack : fallback),
  getLoredeckCreatorBriefCache: () => cached,
  getLoredeckCreatorGenerationSettings: () => ({
    entryBatchSize: 3,
    entryRunRemainingLimit: 2,
  }),
  getLoredeckCreatorAcceptedPlanningStatus: () => ({
    ready: true,
    anchorCount: 1,
    windowCount: 1,
    tagCount: 5,
  }),
  getLoredeckCreatorPlanningAcceptedBatchIds: () => new Set(['batch-a', 'batch-b']),
  getLoredeckCreatorPlanningQueuedBatchIds: () => new Set(['batch-a', 'batch-b']),
  getLoredeckCreatorApprovedTitleIds: () => new Set(cached.approvedTitleDraftIds),
  getLoredeckCreatorEntryDraftProgress: () => progress,
  getLoredeckCreatorEntryTargetTitles: () => cached.titleDrafts,
  getLoredeckCreatorPlanningBatchRows: () => [
    { id: 'batch-a', label: 'Characters', order: 1 },
    { id: 'batch-b', label: 'Village', order: 2 },
  ],
  getLoredeckCreatorDraftChanges: () => [],
  getLoredeckCreatorPendingEntryCount: () => 0,
  getLoredeckCreatorAcceptedEntryCount: () => 0,
  applyLoredeckCreatorGenerationButtonLock: button => button,
  markTourTarget: element => element,
  confirmAction: async (title, message, options) => {
    confirmCall = { title, message, options };
    return true;
  },
  handleLoredeckCreatorEntryDraft: async (button, options) => {
    draftCall = { buttonText: button?.textContent || '', options };
    return { status: 'drafted' };
  },
});

const card = createLoredeckCreatorEntryDraftCard(cached.brief, cached);
const buttons = card.querySelectorAll('button');
const labels = buttons.map(button => button.textContent);

assert.ok(labels.includes('Draft Lorecards'), 'One-batch draft control should remain available.');
assert.ok(labels.includes('Auto-Draft All'), 'Lorecard drafting should expose Auto-Draft All.');
assert.equal(labels.some(label => label.startsWith('Auto-Draft Up To')), false, 'Old run-limited label should not render.');

const autoDraftAll = buttons.find(button => button.textContent === 'Auto-Draft All');
assert.ok(autoDraftAll, 'Auto-Draft All button should be discoverable.');
assert.equal(autoDraftAll.disabled, false, 'Auto-Draft All should be enabled when remaining Lorecards exist.');
await autoDraftAll.click();

assert.equal(confirmCall?.title, 'Auto-Draft All Lorecards?');
assert.ok(
  confirmCall?.message.includes('Are you sure you want to auto-generate 7 Lorecards?'),
  'Confirmation should name the exact remaining Lorecard count.'
);
assert.ok(confirmCall?.message.includes('up to 3 separate Reasoning Provider calls'));
assert.equal(confirmCall?.options?.confirmLabel, 'Auto-Draft 7 Lorecards');
assert.equal(confirmCall?.options?.confirmTooltip, 'Auto-generate 7 remaining Creator Lorecards.');
assert.equal(draftCall?.buttonText, 'Auto-Draft All');
assert.deepEqual(draftCall?.options, { maxBatches: 3, bypassRunLimit: true });

console.log('Loredeck Creator Auto-Draft All UI tests passed.');
