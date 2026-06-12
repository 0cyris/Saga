import assert from 'node:assert/strict';
import {
  configureLoredeckCreatorPanel,
  createLoredeckCreatorStageGuide,
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

const stageDefs = [
  ['scope', 'Scope Brief', 'Approved', 'approved', 'scope-brief'],
  ['outline', 'Story Outline', 'Approved', 'approved', 'story-outline'],
  ['titles', 'Title Pass', '56 approved', 'approved', 'title-sets'],
  ['context', 'Context Plan', '7/7 accepted', 'approved', 'context-plan'],
  ['lorecards', 'Lorecards', '47 remaining', 'ready', 'lorecards'],
  ['review', 'Review Queue', 'Empty', 'empty', 'review-queue'],
  ['health', 'Deck Health', 'Ready', 'approved', 'deck-health'],
  ['finalize', 'Finalize', 'Ready', 'ready', 'finalize'],
];

function makeStages(overrides = {}) {
  return stageDefs.map(([id, label, detail, status, anchor]) => ({
    id,
    label,
    detail,
    status: overrides[id]?.status || status,
    dependency: overrides[id]?.dependency || '',
    anchor,
  }));
}

const generatedPack = {
  packId: 'generated-one-piece-arlong',
  type: 'generated',
  tagRegistry: {
    schemaVersion: 1,
    tags: {
      'character:nami': { id: 'character:nami', label: 'Nami' },
    },
  },
  timelineRegistry: {
    schemaVersion: 1,
    anchors: [{ id: 'arlong-arrives', label: 'Arlong arrives' }],
    windows: [],
  },
  entryOverrides: {
    'nami-secret-buyback-bargain': {
      id: 'nami-secret-buyback-bargain',
      extensions: { sagaLoredeckCreator: { jobId: 'creator_one_piece_arlong' } },
    },
  },
  pendingChanges: [
    {
      changeId: 'pending-entry',
      source: 'loredeck_creator',
      targetKind: 'entry',
      affectedEntryIds: ['nami-secret-buyback-bargain'],
    },
  ],
  healthStatus: 'warning',
  healthIssueStates: {
    missingTimeline: { status: 'open' },
  },
};

const cached = {
  jobId: 'creator_one_piece_arlong',
  approved: true,
  brief: { title: 'Arlong Park Arc' },
  outlineApproved: true,
  outline: { titleBatches: [{ id: 'characters-pressure' }] },
  titleDrafts: [{ titleId: 'nami-secret-buyback-bargain', title: 'Nami secret buyback bargain' }],
  approvedTitleDraftIds: ['nami-secret-buyback-bargain'],
  planningBatchAcceptedIds: ['characters-pressure'],
  generatedPackId: generatedPack.packId,
  draftChanges: [
    {
      changeId: 'draft-nami-secret',
      source: 'loredeck_creator',
      targetKind: 'entry',
      affectedEntryIds: ['nami-secret-buyback-bargain'],
    },
  ],
  coverageFinalizeAcknowledgement: { mode: 'finalize_anyway' },
};

let resetCalls = [];
configureLoredeckCreatorPanel({
  getLoredeckDefinition: packId => (packId === generatedPack.packId ? generatedPack : null),
  handleLoredeckCreatorResetToStep: async stepId => {
    resetCalls.push(stepId);
    return true;
  },
});

{
  const guide = createLoredeckCreatorStageGuide(cached, {
    stages: makeStages(),
    generatedPack,
    activeGeneration: null,
    currentStep: { id: 'lorecards' },
  });
  const resetButtons = guide.querySelectorAll('.saga-loredeck-creator-stage-reset');
  assert.equal(resetButtons.length, 7, 'Reset buttons should render for steps 1-7 when downstream Creator data exists.');
  assert.equal(
    resetButtons.some(button => button.getAttribute('aria-label') === 'Reset to Finalize'),
    false,
    'Finalize should never expose reset-to-this-step.'
  );
  const titleReset = resetButtons.find(button => button.getAttribute('aria-label') === 'Reset to Title Pass');
  assert.ok(titleReset, 'Title Pass should expose reset when Context Plan or later data exists.');
  assert.equal(titleReset.dataset.sagaTooltip, 'Reset to this step');
  await titleReset.click();
  assert.deepEqual(resetCalls, ['titles']);

  const resettableCard = guide.querySelector('.saga-loredeck-creator-stage-resettable');
  assert.equal(resettableCard.tagName, 'DIV', 'Resettable stage cards must not be button elements.');
  assert.ok(resettableCard.querySelector('.saga-loredeck-creator-stage-main'), 'Resettable cards must keep a separate main navigation button.');
}

{
  resetCalls = [];
  const guide = createLoredeckCreatorStageGuide({
    approved: true,
    brief: { title: 'Arlong Park Arc' },
    outlineApproved: true,
    outline: { titleBatches: [{ id: 'characters-pressure' }] },
    titleDrafts: [{ titleId: 'nami-secret-buyback-bargain', title: 'Nami secret buyback bargain' }],
    approvedTitleDraftIds: ['nami-secret-buyback-bargain'],
  }, {
    stages: makeStages({
      context: { status: 'ready' },
      lorecards: { status: 'locked' },
      health: { status: 'not-ready' },
      finalize: { status: 'locked' },
    }),
    generatedPack: null,
    activeGeneration: null,
    currentStep: { id: 'context' },
  });
  assert.equal(
    guide.querySelectorAll('.saga-loredeck-creator-stage-reset')
      .some(button => button.getAttribute('aria-label') === 'Reset to Title Pass'),
    false,
    'Title Pass should not expose reset when no later Creator data exists.'
  );
}

{
  resetCalls = [];
  const guide = createLoredeckCreatorStageGuide(cached, {
    stages: makeStages({ lorecards: { status: 'generating' } }),
    generatedPack,
    activeGeneration: { status: 'running', actionId: 'entry_batch_draft' },
    currentStep: { id: 'lorecards' },
  });
  const titleReset = guide.querySelectorAll('.saga-loredeck-creator-stage-reset')
    .find(button => button.getAttribute('aria-label') === 'Reset to Title Pass');
  assert.ok(titleReset, 'Running generation should keep reset visible for context but disabled.');
  assert.equal(titleReset.disabled, true);
  assert.equal(titleReset.dataset.sagaTooltip, 'Cancel or finish the current Creator generation before resetting.');
  await titleReset.click();
  assert.deepEqual(resetCalls, [], 'Disabled reset buttons should not invoke the reset handler.');
}

console.log('Loredeck Creator stage reset UI tests passed.');
