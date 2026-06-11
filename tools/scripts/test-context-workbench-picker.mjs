import assert from 'node:assert/strict';

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
    this.checked = false;
    this.selected = false;
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
    await this.dispatchEvent({ type: 'click', target: this });
  }

  async dispatchEvent(event) {
    const evt = {
      target: this,
      stopPropagation() {},
      preventDefault() {},
      ...event,
    };
    for (const handler of this.listeners[evt.type] || []) await handler(evt);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 };
  }

  matches(selector) {
    const raw = String(selector || '').trim();
    if (!raw) return false;
    const alternatives = raw.split(',').map(part => part.trim()).filter(Boolean);
    if (alternatives.length > 1) return alternatives.some(part => this.matches(part));
    if (raw.includes(' ')) return false;
    const parts = raw.match(/[#.]?[^#.]+/g) || [];
    return parts.every(part => {
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      if (part.startsWith('#')) return this.id === part.slice(1);
      return this.tagName.toLowerCase() === part.toLowerCase();
    });
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return [];
    const matches = [];
    const visit = node => {
      for (const child of node.children || []) {
        if (matchesSelectorChain(child, parts)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }
}

function matchesSelectorChain(node, parts) {
  let current = node;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (!current?.matches?.(parts[index])) return false;
    if (index === 0) return true;
    let parent = current.parentNode;
    while (parent && !parent.matches?.(parts[index - 1])) parent = parent.parentNode;
    if (!parent) return false;
    current = parent;
    index -= 1;
  }
  return true;
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
globalThis.window = { innerWidth: 1280, innerHeight: 720 };

const calls = [];
let storyPositionQuery = '';
let storyPositionFilter = 'major';
let entryRows = [];

const PACK_ID = 'hp-year-6-half-blood-prince';
const pack = { packId: PACK_ID, title: 'Harry Potter Year 6: Half-Blood Prince', type: 'bundled' };
const state = {
  loredeckStack: [{ packId: PACK_ID, enabled: true, stackIndex: 0 }],
  loredeckContexts: {},
};

const items = [
  {
    kind: 'anchor',
    id: 'hp.y6.privet_summer_after_sirius',
    definition: {
      id: 'hp.y6.privet_summer_after_sirius',
      label: 'Privet Summer After Sirius',
      sortKey: 9692,
      aliases: ['summer after Sirius'],
      tags: ['year-6'],
      dateRange: { from: '1996-07-15' },
      book: 'Half-Blood Prince',
    },
    entryIds: ['hp-y6-privet'],
    source: 'timeline',
  },
  {
    kind: 'anchor',
    id: 'hp.y6.ron_lavender_start',
    definition: {
      id: 'hp.y6.ron_lavender_start',
      label: 'Ron Lavender Start',
      sortKey: 9848,
      aliases: ['Ron dates the blonde girl'],
      tags: ['relationship'],
      dateRange: { from: '1996-12-18' },
      book: 'Half-Blood Prince',
    },
    entryIds: ['hp-y6-ron-lavender'],
    source: 'timeline',
  },
  {
    kind: 'window',
    id: 'hp.y6.window.christmas_return',
    definition: {
      id: 'hp.y6.window.christmas_return',
      label: 'Window Christmas Return',
      anchorFrom: 'hp.y6.post_christmas_return',
      anchorTo: 'hp.y6.apparition_lessons_begin',
      sortKeyFrom: 9880,
      sortKeyTo: 9900,
      aliases: ['after Christmas before apparition'],
    },
    entryIds: ['hp-y6-window'],
    source: 'timeline',
  },
  {
    kind: 'anchor',
    id: 'hp.y6.post_christmas_return',
    definition: {
      id: 'hp.y6.post_christmas_return',
      label: 'Post Christmas Return',
      sortKey: 9880,
      aliases: ['after Christmas return'],
      tags: ['year-6'],
      dateRange: { from: '1997-01-07' },
      book: 'Half-Blood Prince',
    },
    entryIds: ['hp-y6-post-christmas'],
    source: 'timeline',
  },
  {
    kind: 'anchor',
    id: 'hp.y6.apparition_lessons_begin',
    definition: {
      id: 'hp.y6.apparition_lessons_begin',
      label: 'Apparition Lessons Begin',
      sortKey: 9900,
      aliases: ['apparition lessons start'],
      tags: ['lesson'],
      dateRange: { from: '1997-01-14' },
      book: 'Half-Blood Prince',
    },
    entryIds: ['hp-y6-apparition'],
    source: 'timeline',
  },
];

const contextIndex = {
  summary: { packCount: 1, issueCount: 0 },
  packs: {
    [PACK_ID]: { hasIndex: true, anchorCount: 4, windowCount: 1 },
  },
};

const {
  configureContextWorkbenchPanel,
  createContextWorkbenchContextView,
} = await import('../../src/context/context-workbench-panel.js');

function renderView(context = {}) {
  state.loredeckContexts[PACK_ID] = { packId: PACK_ID, source: 'manual', confidence: 1, ...context };
  document.body.children = [];
  const view = createContextWorkbenchContextView(state, contextIndex);
  document.body.appendChild(view);
  return view;
}

function textOf(root = document.body) {
  return root.textContent;
}

function buttonsWithText(root, label) {
  return root.querySelectorAll('button').filter(button => button.textContent.trim() === label);
}

configureContextWorkbenchPanel({
  markTourTarget: (element, target) => {
    element.dataset.tourTarget = target;
    return element;
  },
  getContextWorkbenchTab: () => 'context',
  setContextWorkbenchTab: tab => calls.push(['setTab', tab]),
  getContextWorkbenchPackId: () => PACK_ID,
  setContextWorkbenchPackId: packId => calls.push(['setPack', packId]),
  clearContextWorkbenchSelectedKey: () => calls.push(['clearSelected']),
  renderContextWorkbench: () => calls.push(['render']),
  closeContextWorkbench: () => calls.push(['close']),
  refreshContextHeader: () => calls.push(['refreshHeader']),
  clearContextIndexCache: () => calls.push(['clearIndex']),
  loadContextIndex: async () => contextIndex,
  getRuntimeState: () => state,
  getContextWorkbenchStack: () => [{ packId: PACK_ID, enabled: true, stackIndex: 0 }],
  getContextWorkbenchPack: () => pack,
  getContextWorkbenchTimelineItems: () => items,
  filterContextWorkbenchTimelineItems: sourceItems => sourceItems,
  getContextTimelineItemKey: item => `${item.kind}:${item.id}`,
  getContextTimelineItemContextText: item => item.kind === 'window'
    ? `${item.definition.sortKeyFrom} -> ${item.definition.sortKeyTo}`
    : String(item.definition.sortKey),
  getContextTimelineItemCoordinateText: item => [
    item.definition.dateRange?.from,
    item.definition.book,
  ].filter(Boolean).join(' | '),
  getLoredeckContext: (currentState, packId) => currentState.loredeckContexts[packId] || { packId },
  getLoredeckDisplayName: () => pack.title,
  getContextTypeLabel: value => value || 'Custom',
  formatContextSummary: context => context.label || context.anchorId || context.anchorFrom || 'Unset.',
  formatContextSource: value => value || 'Unknown',
  getContextWorkbenchQuery: () => '',
  setContextWorkbenchQuery: () => {},
  getContextWorkbenchSelectedKey: () => '',
  setContextWorkbenchSelectedKey: itemKey => calls.push(['selectTimeline', itemKey]),
  getContextWorkbenchTypeFilter: () => 'all',
  setContextWorkbenchTypeFilter: () => {},
  getContextWorkbenchStoryPositionQuery: () => storyPositionQuery,
  setContextWorkbenchStoryPositionQuery: query => {
    storyPositionQuery = String(query || '').trim();
    calls.push(['setStoryPositionQuery', storyPositionQuery]);
  },
  getContextWorkbenchStoryPositionFilter: () => storyPositionFilter,
  setContextWorkbenchStoryPositionFilter: filter => {
    storyPositionFilter = String(filter || 'major');
    calls.push(['setStoryPositionFilter', storyPositionFilter]);
  },
  getContextWorkbenchResolverQuery: () => '',
  setContextWorkbenchResolverQuery: () => {},
  resolveContextsFromContext: async () => {},
  modelResolveContexts: async () => {},
  setLoredeckContextManualLock: () => {},
  resetLoredeckContextFromWorkbench: async () => {},
  seedLoredeckContextFromRuntimeContext: () => {},
  appendContextManualFields: container => {
    const stub = document.createElement('div');
    stub.className = 'manual-field-stub';
    container.appendChild(stub);
  },
  applyContextTimelineItem: (packId, item) => calls.push(['applyTimeline', packId, item.id]),
  applyContextAnchor: (packId, anchor) => calls.push(['applyAnchor', packId, anchor.id]),
  applyContextEntryCandidate: (packId, match) => calls.push(['applyEntry', packId, match.row?.id, match.query, match.score]),
  applyContextAnchorBoundary: (packId, item, mode) => calls.push(['applyBoundary', packId, item.id, mode]),
  commitLoredeckContextPatch: (packId, patch, options) => calls.push(['patchContext', packId, patch, options]),
  validateLoredeckForEditor: async () => {},
  loadLoredeckEntriesForEditor: async () => {},
  canValidateLoredeckInEditor: () => false,
  getLoredeckEntryPreview: () => entryRows.length ? { loadedAt: 1, entries: entryRows.map(row => row.entry) } : null,
  getContextWorkbenchEntryRows: () => entryRows,
  buildContextEntryDerivedAnchor: (sourcePack, row) => {
    if (!row?.entry?.context) return null;
    return {
      id: `entry:${row.id}`,
      label: row.entry.context.label || row.entry.title || row.id,
      sortKey: row.entry.context.sortKeyFrom ?? row.entry.context.sortKey,
      aliases: row.entry.context.aliases || [],
      tags: [row.entry.category, row.entry.lorePurpose].filter(Boolean),
      chapter: row.entry.context.chapter || '',
      arc: row.entry.context.arc || '',
    };
  },
  getContextResolverMissReasons: () => [],
  getContextEntryResolverMatches: () => [],
  queueContextEntryCandidateTimelineAnchor: () => false,
  openDuplicateLoredeckDialog: () => {},
  normalizeLoredeckTimelineId: value => String(value || '').trim().toLowerCase(),
  normalizeLoredeckTimelineNumber: value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  },
  openLoredeckEditorForQuery: (packId, query, message) => calls.push(['openLorecard', packId, query, message]),
  openLoredeckTimelineAnchorDialog: () => {},
  openLoredeckTimelineWindowDialog: () => {},
  setLoredeckTimelineItemDisabled: () => {},
  removeLoredeckTimelineDefinition: () => {},
  exportContextWorkbenchTimelineRegistry: () => {},
});

let view = renderView();
assert.match(textOf(view), /Choose Story Position/);
assert.equal(view.querySelector('.saga-context-workbench-story-position-picker')?.dataset.tourTarget, 'context.workbench.storyPosition');
assert.equal(view.querySelectorAll('.saga-context-workbench-waypoint-row').length, 0);
assert.equal(view.querySelector('[data-tour-target="context.workbench.waypoints"]'), null);
assert.doesNotMatch(textOf(view), /Browse Story Waypoints/);
assert.doesNotMatch(textOf(view), /Select From Timeline/);
assert.equal(view.querySelectorAll('.saga-context-workbench-context-picker-row').length, 0);
assert.equal(view.querySelectorAll('.saga-context-workbench-story-position-row').length, 5);

view = renderView({
  contextType: 'anchor',
  anchorId: 'hp.y6.ron_lavender_start',
  label: 'Ron Lavender Start',
});
const pinnedRows = view.querySelectorAll('.saga-context-workbench-story-position-row');
assert.match(pinnedRows[0].textContent, /Ron Lavender Start/);
assert.equal(pinnedRows[0].classList.contains('saga-context-workbench-row-active'), true);
assert.match(textOf(view), /Current pinned/);

view = renderView({
  contextType: 'anchor_window',
  anchorFrom: 'hp.y6.post_christmas_return',
  label: 'After Post Christmas Return',
});
let pinnedRangeRows = view.querySelectorAll('.saga-context-workbench-story-position-row');
assert.match(pinnedRangeRows[0].textContent, /Post Christmas Return/);
assert.doesNotMatch(pinnedRangeRows[0].textContent, /Window Christmas Return/);
assert.equal(pinnedRangeRows[0].classList.contains('saga-context-workbench-row-active'), true);

view = renderView({
  contextType: 'anchor_window',
  anchorFrom: 'hp.y6.post_christmas_return',
  anchorTo: 'hp.y6.apparition_lessons_begin',
  label: 'Window Christmas Return',
});
pinnedRangeRows = view.querySelectorAll('.saga-context-workbench-story-position-row');
assert.match(pinnedRangeRows[0].textContent, /Window Christmas Return/);
assert.equal(pinnedRangeRows[0].classList.contains('saga-context-workbench-row-active'), true);

storyPositionQuery = 'Ron dates the blonde girl';
view = renderView();
assert.equal(view.querySelectorAll('.saga-context-workbench-story-position-row').length, 1);
assert.match(textOf(view), /Ron Lavender Start/);
assert.doesNotMatch(textOf(view), /Privet Summer After Sirius/);

calls.length = 0;
let row = view.querySelectorAll('.saga-context-workbench-story-position-row')[0];
await buttonsWithText(row, 'Timeline')[0].click();
assert.deepEqual(calls, [
  ['selectTimeline', 'anchor:hp.y6.ron_lavender_start'],
  ['setTab', 'timeline'],
  ['render'],
]);

calls.length = 0;
await buttonsWithText(row, 'Start Here')[0].click();
assert.deepEqual(calls[0], ['applyTimeline', PACK_ID, 'hp.y6.ron_lavender_start']);

calls.length = 0;
await buttonsWithText(row, 'After')[0].click();
assert.deepEqual(calls[0], ['applyBoundary', PACK_ID, 'hp.y6.ron_lavender_start', 'from']);

storyPositionQuery = 'Window Christmas Return';
view = renderView();
assert.equal(view.querySelectorAll('.saga-context-workbench-story-position-row').length, 1);
calls.length = 0;
row = view.querySelectorAll('.saga-context-workbench-story-position-row')[0];
await buttonsWithText(row, 'Use Window')[0].click();
assert.deepEqual(calls[0], ['applyTimeline', PACK_ID, 'hp.y6.window.christmas_return']);

entryRows = [{
  id: 'hp-y6-sectumsempra-lesson',
  packId: PACK_ID,
  entry: {
    id: 'hp-y6-sectumsempra-lesson',
    title: 'Sectumsempra Lesson',
    category: 'event',
    lorePurpose: 'scene',
    context: {
      scope: 'anchor_window',
      sortKeyFrom: 9950,
      sortKeyTo: 9950,
      arc: 'Half-Blood Prince',
      chapter: '24',
      label: 'Sectumsempra Lesson',
      aliases: ['Harry uses Sectumsempra'],
    },
    content: {
      fact: 'Harry uses Sectumsempra in the bathroom confrontation.',
    },
  },
}];
storyPositionQuery = 'Sectumsempra';
view = renderView();
assert.equal(view.querySelectorAll('.saga-context-workbench-story-position-row').length, 1);
assert.match(textOf(view), /Sectumsempra Lesson/);
assert.match(textOf(view), /Lorecard event/);
row = view.querySelectorAll('.saga-context-workbench-story-position-row')[0];
assert.equal(buttonsWithText(row, 'Lorecard').length, 1);

calls.length = 0;
await buttonsWithText(row, 'Start Here')[0].click();
assert.deepEqual(calls[0], ['applyEntry', PACK_ID, 'hp-y6-sectumsempra-lesson', 'Sectumsempra', 120]);

calls.length = 0;
await buttonsWithText(row, 'After')[0].click();
assert.equal(calls[0][0], 'patchContext');
assert.equal(calls[0][1], PACK_ID);
assert.equal(calls[0][2].anchorFrom, 'entry:hp-y6-sectumsempra-lesson');
assert.equal(calls[0][2].contextType, 'anchor_window');
assert.equal(calls[0][2].source, 'manual');
assert.match(calls[0][2].notes, /Lorecard-derived story position/);
assert.equal(calls[0][3], undefined);

calls.length = 0;
await buttonsWithText(row, 'Lorecard')[0].click();
assert.deepEqual(calls[0], [
  'openLorecard',
  PACK_ID,
  'hp-y6-sectumsempra-lesson',
  'Loredeck editor filtered to the source Lorecard.',
]);

entryRows = [];
storyPositionQuery = '';
view = renderView({
  contextType: 'anchor',
  anchorId: 'hp.y6.ron_lavender_start',
  label: 'Ron Lavender Start',
});
const clearSelection = buttonsWithText(view, 'Clear Selection')[0];
assert.equal(clearSelection.disabled, false);
calls.length = 0;
await clearSelection.click();
assert.deepEqual(calls[0], ['patchContext', PACK_ID, {
  anchorFrom: '',
  anchorTo: '',
  anchorId: '',
  contextType: 'custom',
  label: '',
  contextSortKey: null,
  contextSortKeyFrom: null,
  contextSortKeyTo: null,
}, undefined]);

console.log('Context Workbench picker contract passed.');
