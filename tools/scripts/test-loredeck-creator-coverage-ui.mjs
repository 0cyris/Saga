import assert from 'node:assert/strict';
import {
  configureLoredeckCreatorPanel,
  createLoredeckCreatorEntryDraftCard,
  createLoredeckCreatorPipelineReadinessCard,
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
    this.value = '';
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

  set id(value) {
    this.attributes.id = String(value || '');
  }

  get id() {
    return this.attributes.id || '';
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
    const event = {
      type: 'click',
      target: this,
      stopPropagation() {},
      preventDefault() {},
    };
    for (const handler of this.listeners.click || []) await handler(event);
    await Promise.resolve();
    await Promise.resolve();
  }

  matches(selector) {
    const raw = String(selector || '').trim();
    if (!raw) return false;
    if (raw.startsWith('.')) return this.classList.contains(raw.slice(1));
    if (raw.startsWith('#')) return this.id === raw.slice(1);
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

let ackCalls = 0;
let healthRunCalls = 0;
let healthOpenCall = null;
let safeRepairCalls = 0;
let readinessView = null;

configureLoredeckCreatorPanel({
  getLoredeckCreatorPipelineReadinessView: () => readinessView,
  acknowledgeLoredeckCreatorCoverageForFinalize: async () => {
    ackCalls += 1;
    return true;
  },
  validateLoredeckForEditor: async () => {
    healthRunCalls += 1;
    return { health: { status: 'good' } };
  },
  openLoredeckHealthCenter: (packId, options) => {
    healthOpenCall = { packId, options };
  },
  attemptLoredeckHealthFixes: async () => {
    safeRepairCalls += 1;
    return true;
  },
  getLoredeckCreatorGenerationSettings: () => ({ entryBatchSize: 3 }),
  getLoredeckCreatorApprovedTitleIds: cached => new Set(cached.approvedTitleDraftIds || []),
  getLoredeckCreatorPlanningAcceptedBatchIds: () => new Set(['characters-pressure']),
  getLoredeckCreatorPlanningQueuedBatchIds: () => new Set(['characters-pressure']),
  getLoredeckDefinition: packId => ({ packId, type: 'generated', title: 'Arlong Park Generated', entryOverrides: {}, pendingChanges: [] }),
  getLoredeckCreatorAcceptedPlanningStatus: () => ({
    ready: true,
    anchorCount: 2,
    windowCount: 1,
    tagCount: 4,
  }),
  getLoredeckCreatorDraftChanges: () => [],
  getLoredeckCreatorPendingEntryCount: () => 0,
  getLoredeckCreatorAcceptedEntryCount: () => 0,
  getLoredeckCreatorEntryDraftProgress: () => ({
    remainingCount: 0,
    batchSize: 3,
    eligibleBatchCount: 1,
    activeBatchLabel: 'Characters and pressure',
  }),
  getLoredeckCreatorEntryTargetTitles: () => [],
  getLoredeckCreatorPlanningBatchRows: () => [],
  refreshPanelBody: () => {},
  refreshHeader: () => {},
  markTourTarget: element => element,
});

readinessView = {
  readiness: {
    ready: false,
    blockers: ['Pack Health: 2 errors, 1 warning.'],
    warnings: [],
    healthScanned: true,
    healthStatus: 'has_errors',
    healthErrorCount: 2,
    healthWarningCount: 1,
    healthSuggestionCount: 0,
    healthSummary: 'Pack Health: 2 errors, 1 warning',
  },
  pipeline: {
    statusLabel: 'Deck Maker complete',
    titleBatchCount: 1,
    titleBatchDraftedCount: 1,
    eligiblePlanningBatchCount: 1,
    acceptedPlanningBatchCount: 1,
    approvedTitleCount: 4,
    approvedTitleAcceptedCount: 4,
    coverage: {
      available: true,
      statusLabel: 'Adequate',
      finalizeAcknowledgementRequired: false,
      finalizeAcknowledged: false,
    },
  },
};

const healthBlockedCard = createLoredeckCreatorPipelineReadinessCard({ packId: 'health-blocked-generated', type: 'generated' });
assert.ok(healthBlockedCard.textContent.includes('Needs review'));
assert.ok(healthBlockedCard.textContent.includes('Pack Health: 2 errors, 1 warning'));
assert.ok(healthBlockedCard.textContent.includes('Run Pack Health'));
assert.ok(healthBlockedCard.textContent.includes('Open Pack Health Center'));
assert.ok(healthBlockedCard.textContent.includes('Attempt Fixing'));

const runHealth = healthBlockedCard.querySelectorAll('button')
  .find(button => button.textContent === 'Run Pack Health');
await runHealth.click();
assert.equal(healthRunCalls, 1, 'Run Pack Health should invoke validation.');

const openHealth = healthBlockedCard.querySelectorAll('button')
  .find(button => button.textContent === 'Open Pack Health Center');
await openHealth.click();
assert.deepEqual(healthOpenCall, {
  packId: 'health-blocked-generated',
  options: { tab: 'issues' },
});

const attemptFixing = healthBlockedCard.querySelectorAll('button')
  .find(button => button.textContent === 'Attempt Fixing');
await attemptFixing.click();
assert.equal(safeRepairCalls, 1, 'Attempt Fixing should invoke deterministic repair.');

readinessView = {
  readiness: {
    ready: false,
    blockers: ['Pack Health has errors.'],
    warnings: [],
    healthScanned: true,
    healthStatus: 'has_errors',
    healthHasErrors: true,
    healthSummary: 'Pack Health: Errors',
  },
  pipeline: {
    statusLabel: 'Deck Maker complete',
    titleBatchCount: 1,
    titleBatchDraftedCount: 1,
    eligiblePlanningBatchCount: 1,
    acceptedPlanningBatchCount: 1,
    approvedTitleCount: 4,
    approvedTitleAcceptedCount: 4,
    coverage: {
      available: true,
      statusLabel: 'Adequate',
      finalizeAcknowledgementRequired: false,
      finalizeAcknowledged: false,
    },
  },
};

healthOpenCall = null;
const compactHealthBlockedCard = createLoredeckCreatorPipelineReadinessCard({ packId: 'compact-health-blocked-generated', type: 'generated' });
assert.ok(compactHealthBlockedCard.textContent.includes('Needs review'));
assert.ok(compactHealthBlockedCard.textContent.includes('Pack Health: Errors'));
assert.ok(compactHealthBlockedCard.textContent.includes('Attempt Fixing'));
const compactOpenHealth = compactHealthBlockedCard.querySelectorAll('button')
  .find(button => button.textContent === 'Open Pack Health Center');
await compactOpenHealth.click();
assert.deepEqual(healthOpenCall, {
  packId: 'compact-health-blocked-generated',
  options: { tab: 'issues' },
});

readinessView = {
  readiness: {
    ready: false,
    blockers: [
      'Deck Maker Coverage has unresolved missing or thin rows. Acknowledge intentionally light coverage or generate targeted title/Lorecard batches before finalizing as Custom.',
    ],
    warnings: ['Coverage: Missing or thin rows must be expanded or explicitly acknowledged before finalizing as Custom.'],
  },
  pipeline: {
    statusLabel: 'Deck Maker complete',
    titleBatchCount: 3,
    titleBatchDraftedCount: 3,
    eligiblePlanningBatchCount: 3,
    acceptedPlanningBatchCount: 3,
    approvedTitleCount: 12,
    approvedTitleAcceptedCount: 12,
    coverage: {
      available: true,
      statusLabel: 'Thin',
      finalizeAcknowledgementRequired: true,
      finalizeAcknowledged: false,
    },
  },
};

const blockedCard = createLoredeckCreatorPipelineReadinessCard({ packId: 'one-piece-arlong-generated' });
assert.ok(blockedCard, 'Coverage-blocked readiness card should render.');
assert.equal(blockedCard.dataset.sagaCreatorAnchor, 'finalize');
assert.ok(blockedCard.textContent.includes('Deck Maker Readiness Gate'));
assert.ok(blockedCard.textContent.includes('Needs review'));
assert.ok(blockedCard.textContent.includes('Coverage: Thin'));
assert.ok(blockedCard.textContent.includes('Open Coverage Plan'));
assert.ok(blockedCard.textContent.includes('Finalize Anyway'));

const openCoveragePlan = blockedCard.querySelectorAll('button')
  .find(button => button.textContent === 'Open Coverage Plan');
assert.ok(openCoveragePlan, 'Coverage-blocked readiness card should expose a constructive coverage expansion route.');

const finalizeAnyway = blockedCard.querySelectorAll('button')
  .find(button => button.textContent === 'Finalize Anyway');
assert.ok(finalizeAnyway, 'Coverage-blocked readiness card should expose Finalize Anyway.');
await finalizeAnyway.click();
assert.equal(ackCalls, 1, 'Finalize Anyway should call the coverage acknowledgement dependency.');
assert.equal(finalizeAnyway.disabled, false, 'Finalize Anyway button should unlock after acknowledgement handler settles.');

readinessView = {
  readiness: {
    ready: true,
    blockers: [],
    warnings: ['Coverage: Missing or thin rows were explicitly acknowledged for finalization.'],
  },
  pipeline: {
    statusLabel: 'Deck Maker complete',
    titleBatchCount: 1,
    titleBatchDraftedCount: 1,
    eligiblePlanningBatchCount: 1,
    acceptedPlanningBatchCount: 1,
    approvedTitleCount: 4,
    approvedTitleAcceptedCount: 4,
    coverage: {
      available: true,
      statusLabel: 'Thin',
      finalizeAcknowledgementRequired: false,
      finalizeAcknowledged: true,
    },
  },
};

const acknowledgedCard = createLoredeckCreatorPipelineReadinessCard({ packId: 'pac-man-rules-generated' });
assert.ok(acknowledgedCard.textContent.includes('Finalize ready'));
assert.ok(acknowledgedCard.textContent.includes('Coverage acknowledged'));
assert.equal(
  acknowledgedCard.querySelectorAll('button').some(button => button.textContent === 'Finalize Anyway'),
  false,
  'Acknowledged coverage should not continue to show Finalize Anyway.',
);

const lorecardRejectionCard = createLoredeckCreatorEntryDraftCard({}, {
  generatedPackId: 'one-piece-arlong-generated',
  titleDrafts: [{ titleId: 'genzos-vigil-over-cocoyashi', title: "Genzo's vigil over Cocoyashi" }],
  approvedTitleDraftIds: ['genzos-vigil-over-cocoyashi'],
  entryDraftLastBatchCount: 0,
  entryDraftLastTargetCount: 1,
  entryDraftLastRejectedCount: 1,
  entryDraftLastRejectedTargetIds: ['genzos-vigil-over-cocoyashi'],
  entryDraftLastRejectionSummary: {
    count: 1,
    targetCount: 1,
    targetEntryIds: ['genzos-vigil-over-cocoyashi'],
    unknownTags: ['location:cocoyashi'],
    unknownAnchors: ['one-piece.arlong.missing-anchor'],
    byReason: { unknown_tag: 1 },
  },
  entryDraftLastRejectionDiagnostics: [{
    targetTitleId: 'genzos-vigil-over-cocoyashi',
    targetEntryId: 'genzos-vigil-over-cocoyashi',
    title: "Genzo's vigil over Cocoyashi",
    reasonCode: 'unknown_tag',
    message: 'Unknown tag location:cocoyashi.',
    unknownTags: ['location:cocoyashi'],
  }],
  entryDraftLastPreflightSummary: {
    targetCount: 1,
    acceptedTagCount: 8,
    omittedTagCount: 1,
    ambiguousTagCount: 0,
    omittedAnchorCount: 0,
    omittedWindowCount: 1,
    planningGapCount: 2,
  },
  entryDraftLastPreflightDiagnostics: [{
    targetTitleId: 'genzos-vigil-over-cocoyashi',
    targetEntryId: 'genzos-vigil-over-cocoyashi',
    title: "Genzo's vigil over Cocoyashi",
    reasonCode: 'unknown_timeline_window',
    message: 'Title timeline window one-piece.arlong.missing-window is not in the accepted timeline registry.',
    unknownAnchors: ['one-piece.arlong.missing-window'],
  }],
  entryDraftWarnings: ['Rejected 1 Deck Maker Lorecard draft with invalid schema v3 references.'],
});
assert.ok(lorecardRejectionCard.textContent.includes('Last Lorecard pass'));
assert.ok(lorecardRejectionCard.textContent.includes('Last Lorecard preflight gaps'));
assert.ok(lorecardRejectionCard.textContent.includes('Last Lorecard rejection details'));
assert.ok(lorecardRejectionCard.textContent.includes('genzos-vigil-over-cocoyashi'));
assert.ok(lorecardRejectionCard.textContent.includes('location:cocoyashi'));
assert.ok(lorecardRejectionCard.textContent.includes('one-piece.arlong.missing-anchor'));
assert.ok(lorecardRejectionCard.textContent.includes('one-piece.arlong.missing-window'));
assert.ok(lorecardRejectionCard.textContent.includes('Title timeline window one-piece.arlong.missing-window'));
assert.ok(lorecardRejectionCard.textContent.includes('Unknown tag location:cocoyashi.'));

console.log('Deck Maker coverage UI tests passed.');
