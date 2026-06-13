import assert from 'node:assert/strict';

import {
  configureLoredeckPendingReviewPanel,
  createLoredeckPendingReviewCard,
} from '../../src/runtime/loredeck-pending-review-panel.js';
import {
  appendLoredeckPendingQualityPills,
  createLoredeckPendingDiffList,
  createLoredeckPendingHealthImpactPill,
  createLoredeckPendingHealthStalePill,
  createLoredeckPendingQualityList,
  createLoredeckPendingRepairCandidateList,
  createLoredeckPendingRiskPill,
  doesLoredeckPendingChangeAffectPackHealth,
  formatLoredeckPendingActionLabel,
  formatLoredeckPendingSourceLabel,
  formatLoredeckPendingTargetKindLabel,
  getLoredeckPendingConfidence,
  getLoredeckPendingRisk,
  getLoredeckPendingSourceTooltip,
  isLoredeckHealthStatusStale,
} from '../../src/runtime/loredeck-review-helpers.js';
import {
  createLoredeckRecordPatchChange,
  getLoredeckPendingChanges,
  normalizeLoredeckPendingIdList,
} from '../../src/runtime/loredeck-pending-change-model.js';

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
  }

  matches(selector) {
    const raw = String(selector || '').trim();
    if (!raw) return false;
    if (raw.startsWith('.')) return this.classList.contains(raw.slice(1));
    if (raw.startsWith('#')) return this.attributes.id === raw.slice(1);
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
}

globalThis.document = new FakeDocument();
globalThis.window = { document: globalThis.document, innerWidth: 1280, innerHeight: 720 };

const currentEntry = {
  schemaVersion: 3,
  id: 'nami-secret',
  title: "Nami's Secret",
  category: 'secret',
  tags: ['character:nami'],
  context: {
    scope: 'window',
    validFromAnchor: 'arlong.start',
    validToAnchor: 'arlong.end.deal',
    sortKeyFrom: 10,
    sortKeyTo: 20,
    precision: 'anchor_window',
    label: 'Arlong pressure phase',
  },
  retrieval: {
    activation: 'context_or_topic',
    frequency: 'normal',
    contextBoost: 'high',
  },
  content: {
    fact: 'Nami hides her buyback deal from Arlong.',
    injection: 'Treat her thefts as cover for a hidden buyback plan.',
  },
};

const repairedEntry = {
  ...currentEntry,
  context: {
    ...currentEntry.context,
    validToAnchor: 'arlong.end',
  },
};

const repairChange = createLoredeckRecordPatchChange({
  source: 'safe_repair',
  action: 'review_schema_v3_context_anchor',
  targetKind: 'entry',
  title: "Review Context anchor repair: Nami's Secret",
  description: 'Proposes Context anchor replacements inferred from exact sort-key matches.',
  affectedEntryIds: ['nami-secret'],
  affectedTimelineIds: ['arlong.end.deal', 'arlong.end'],
  payload: {
    entryOverrides: {
      'nami-secret': repairedEntry,
    },
    disabledEntryIdsRemove: ['nami-secret'],
  },
  preview: {
    before: 'validToAnchor: arlong.end.deal',
    after: 'validToAnchor: arlong.end',
    schemaV3RepairCandidates: [{
      kind: 'context_anchor',
      field: 'validToAnchor',
      from: 'arlong.end.deal',
      to: 'arlong.end',
      sortKey: 20,
      reason: 'sort_key_match',
    }],
  },
});

const pack = {
  packId: 'pending-review-schema-v3-repair-pack',
  type: 'generated',
  title: 'Pending Review Schema V3 Repair Pack',
  entryOverrides: {
    'nami-secret': currentEntry,
  },
  disabledEntryIds: [],
  pendingChanges: [repairChange],
  healthStatus: 'needs_review',
};

let healthCenterCall = null;

configureLoredeckPendingReviewPanel({
  getLoredeckPendingChanges,
  doesLoredeckPendingChangeAffectPackHealth,
  isLoredeckHealthStatusStale,
  createLoredeckPendingHealthStalePill,
  createLoredeckPendingHealthImpactPill,
  formatLoredeckPendingActionLabel,
  formatLoredeckPendingTargetKindLabel,
  formatLoredeckPendingSourceLabel,
  getLoredeckPendingSourceTooltip,
  getLoredeckPendingConfidence,
  getLoredeckPendingRisk,
  createLoredeckPendingRiskPill,
  appendLoredeckPendingQualityPills,
  createLoredeckPendingDiffList,
  createLoredeckPendingRepairCandidateList,
  createLoredeckPendingQualityList,
  createStateBackup: () => {},
  confirmAction: async () => true,
  runBusyAction: async (_button, _label, action) => action(),
  acceptLoredeckPendingChanges: async () => true,
  rejectLoredeckPendingChanges: () => true,
  validateLoredeckForEditor: async () => null,
  canValidateLoredeckInEditor: () => true,
  openLoredeckHealthCenter: (packId, options) => {
    healthCenterCall = { packId, options };
  },
});

const card = createLoredeckPendingReviewCard(pack);
assert.ok(card.textContent.includes('Review Context anchor repair'));
assert.ok(card.textContent.includes('Context anchor repair: validToAnchor arlong.end.deal => arlong.end (sort key 20).'));
assert.ok(card.textContent.includes('Entry nami-secret | context to: arlong.end.deal => arlong.end'));
assert.ok(card.textContent.includes('Health impact'));
assert.ok(card.textContent.includes('Pack Health: Review'));
assert.ok(card.textContent.includes('Open Pack Health Center'));
assert.ok(card.querySelector('.saga-loredeck-pending-repair-candidate-list'));
assert.deepEqual(normalizeLoredeckPendingIdList(repairChange.affectedEntryIds), ['nami-secret']);

await card.querySelectorAll('button').find(button => button.textContent === 'Open Pack Health Center')?.click();
assert.deepEqual(healthCenterCall, {
  packId: pack.packId,
  options: { tab: 'issues' },
});

console.log('Loredeck Pending Review schema v3 repair UI tests passed.');
