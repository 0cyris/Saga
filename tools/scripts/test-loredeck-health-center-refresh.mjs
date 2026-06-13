import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS,
  DEFAULT_MHA_LOREDECK_IDS,
} from '../../src/loredecks/loredeck-defaults.js';
import { loadLoredeckSourceById } from '../../src/loredecks/loredeck-loader.js';
import {
  closeLoredeckHealthCenter,
  configureLoredeckHealthPanel,
  openLoredeckHealthCenter,
} from '../../src/loredecks/loredeck-health-panel.js';
import {
  normalizeLoredeckLibraryIndex,
  resolveLoredeckStackItems,
} from '../../src/loredecks/loredeck-library-index.js';

const ROOT = process.cwd();

globalThis.fetch = async function fetchLocalJson(url) {
  const resolved = url instanceof URL
    ? url
    : String(url || '').startsWith('file:')
      ? new URL(url)
      : pathToFileURL(path.resolve(ROOT, String(url || '')));
  const text = await readFile(fileURLToPath(resolved), 'utf8');
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return JSON.parse(text);
    },
    async text() {
      return text;
    },
  };
};

class FakeClassList {
  constructor(el) {
    this.el = el;
    this.values = new Set();
  }

  sync() {
    this.el._className = [...this.values].join(' ');
  }

  load(value) {
    this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
    this.sync();
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

  toggle(name, force) {
    const value = String(name);
    const shouldAdd = force === undefined ? !this.values.has(value) : !!force;
    if (shouldAdd) this.values.add(value);
    else this.values.delete(value);
    this.sync();
    return shouldAdd;
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.nodeName = this.tagName;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.disabled = false;
    this.hidden = false;
    this.open = false;
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

  removeEventListener(type, handler) {
    this.listeners[type] = (this.listeners[type] || []).filter(item => item !== handler);
  }

  async click() {
    const event = {
      type: 'click',
      target: this,
      stopPropagation() {},
      preventDefault() {},
    };
    for (const handler of this.listeners.click || []) await handler(event);
  }

  focus() {}

  select() {}

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 };
  }

  contains(node) {
    return node === this || this.children.some(child => child.contains?.(node));
  }

  matches(selector) {
    const value = String(selector || '').trim();
    if (!value) return false;
    if (value.startsWith('.')) return this.classList.contains(value.slice(1));
    if (value.startsWith('#')) return this.id === value.slice(1);
    return this.tagName.toLowerCase() === value.toLowerCase();
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
    this.documentElement = new FakeElement('html');
    this.scrollingElement = this.documentElement;
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function installFakeDom() {
  globalThis.document = new FakeDocument();
  globalThis.window = { innerWidth: 1200, innerHeight: 800, document: globalThis.document };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { clipboard: { async writeText() {} } },
  });
  globalThis.requestAnimationFrame = callback => {
    callback();
    return 1;
  };
}

function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buttonLabels() {
  return document.body.querySelectorAll('button').map(button => button.textContent);
}

function bodyText() {
  return document.body.textContent || '';
}

async function waitForRefreshToSettle(deckId, entryPreviewCache) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
    const hasRestoredRefreshButton = buttonLabels().includes('Refresh Scan');
    const hasCachedHealth = !!entryPreviewCache.get(deckId)?.health;
    if (overlay && hasRestoredRefreshButton && hasCachedHealth) return;
    await wait(25);
  }
  throw new Error(`${deckId} Pack Health refresh did not settle.`);
}

async function waitForBodyText(text) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (bodyText().includes(text)) return;
    await wait(25);
  }
  throw new Error(`Pack Health Center never rendered expected text: ${text}`);
}

async function runHealthCenterRefresh(deckId) {
  installFakeDom();

  const pack = { ...DEFAULT_BUNDLED_LOREDECK_LIBRARY_PACKS[deckId] };
  const state = {
    loredeckStack: [{ packId: deckId, enabled: true, priority: 100 }],
    loredeckRegistry: { schemaVersion: 1, packs: { [deckId]: pack } },
  };
  const entryPreviewCache = new Map();
  const manifestPreviewCache = new Map();

  configureLoredeckHealthPanel({
    getState: () => state,
    getCanonLoreDatabaseSync: () => null,
    getLoredeckLibrary: () => [pack],
    getLoredeckStack: () => state.loredeckStack,
    getLoredeckLibraryIndexForPacks: (currentState, library = [pack]) => normalizeLoredeckLibraryIndex(currentState.loredeckRegistry || {}, {
      packs: Object.fromEntries((library || []).map(item => [item.packId, item])),
    }),
    resolveLoredeckStackItems,
    buildLoredeckPackScopedHealth: () => null,
    getLoredeckPackSummaryCounts: (currentPack, cached, _loadedMeta, health) => ({
      entryCount: Number(health?.summary?.entryCount) || Number(cached?.entryCount) || Number(currentPack?.stats?.entryCount) || 0,
      fileCount: Number(health?.summary?.fileCount) || Number(cached?.fileCount) || Number(currentPack?.stats?.fileCount) || 0,
      loadedFileCount: Number(health?.summary?.loadedFileCount) || Number(cached?.loadedFileCount) || 0,
      categoryCounts: health?.summary?.categoryCounts || currentPack?.stats?.categoryCounts || {},
    }),
    getLoredeckTypeLabel: () => 'Bundled',
    getLoredeckEntryPreviewCacheRecord: id => entryPreviewCache.get(String(id || '').trim()) || null,
    getLoredeckManifestPreviewCacheRecord: id => manifestPreviewCache.get(String(id || '').trim()) || null,
    validateLoredeckForEditor: async currentPack => {
      const source = await loadLoredeckSourceById(currentPack.packId);
      manifestPreviewCache.set(currentPack.packId, {
        manifest: source.manifest,
        health: source.health,
        loadedAt: Date.now(),
      });
      entryPreviewCache.set(currentPack.packId, {
        manifest: source.manifest,
        entryFiles: source.entryFiles,
        health: source.health,
        loadedAt: Date.now(),
      });
      return { health: source.health, manifest: source.manifest, entryCache: { entryFiles: source.entryFiles } };
    },
    refreshLoredeckSurfaces: () => {},
    clearCanonLoreDatabaseCache: () => {},
    clearContextIndexCache: () => {},
    loadCanonLoreDatabase: async () => null,
    refreshPanelBody: () => {},
    refreshHeader: () => {},
    sanitizeFileStem: value => String(value || 'deck-health').replace(/[^a-z0-9._-]+/gi, '-'),
    downloadJson: () => {},
    openDuplicateLoredeckDialog: () => {},
    handleLoredeckAssistantHealthRepairDraft: async () => {},
    normalizeLoredeckHealthGroupIssuesForRepair: group => group?.issues || [],
    canValidateLoredeckInEditor: () => true,
    isLoredeckMalformedTagIssueGroup: () => false,
    queueLoredeckMalformedTagRepairFromHealthGroup: async () => {},
    repairLoredeckSafeHealthIssues: async () => {},
    normalizeLoredeckHealthIssueStates: value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
    normalizeLoredeckPendingIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
    normalizeLoredeckPendingTimelineIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
  });

  const errors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    errors.push(args.map(arg => arg?.stack || String(arg)).join(' '));
    originalConsoleError(...args);
  };

  try {
    openLoredeckHealthCenter(deckId);
    assert.ok(document.querySelector('.saga-loredeck-health-center-overlay'), `${deckId} should open the Pack Health Center.`);
    const refreshButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Refresh Scan');
    assert.ok(refreshButton, `${deckId} should render a Refresh Scan button.`);

    await refreshButton.click();
    await waitForRefreshToSettle(deckId, entryPreviewCache);

    assert.ok(document.querySelector('.saga-loredeck-health-center-overlay'), `${deckId} should keep the Pack Health Center visible after refresh.`);
    assert.ok(buttonLabels().includes('Refresh Scan'), `${deckId} should restore the Refresh Scan button after refresh.`);
    assert.equal(entryPreviewCache.get(deckId)?.health?.status, 'good', `${deckId} should cache good Pack Health after refresh.`);
    assert.equal(errors.some(error => error.includes('Pack Health Center render failed')), false, `${deckId} should not hit the Health Center render fallback.`);
    assert.equal(errors.some(error => error.includes('normalizeLoredeckTagId')), false, `${deckId} should not crash on tag affected rows.`);
  } finally {
    console.error = originalConsoleError;
    closeLoredeckHealthCenter();
  }
}

for (const deckId of DEFAULT_MHA_LOREDECK_IDS) {
  await runHealthCenterRefresh(deckId);
}

async function runHealthCenterRepairSessionPanel() {
  installFakeDom();
  const pack = {
    packId: 'health-session-ui-pack',
    title: 'Health Session UI Pack',
    type: 'custom',
    stats: { entryCount: 2, categoryCounts: { knowledge: 2 } },
  };
  const health = {
    packId: pack.packId,
    status: 'has_errors',
    summary: {
      errorCount: 1,
      warningCount: 1,
      suggestionCount: 0,
      issueCount: 2,
      entryCount: 2,
      categoryCounts: { knowledge: 2 },
    },
    errors: [{
      severity: 'error',
      code: 'schema_v3_missing_content',
      message: 'Missing schema v3 content.',
      entryIds: ['entry-1'],
    }],
    warnings: [{
      severity: 'warning',
      code: 'broken_anchor_reference',
      message: 'Broken Context anchor.',
      entryIds: ['entry-2'],
      timelineIds: ['old-anchor'],
    }],
    suggestions: [],
  };
  const state = {
    loredeckStack: [{ packId: pack.packId, enabled: true, priority: 100 }],
    loredeckRegistry: { schemaVersion: 1, packs: { [pack.packId]: pack } },
  };
  let loadCount = 0;
  let appliedChoice = null;
  let continuedSession = null;
  let activeRun = {
    runId: 'run-ui-model-pending',
    packId: pack.packId,
    label: 'Continue Model Batches',
    startedAt: Date.now(),
    cancellable: true,
  };
  let cancelRunCount = 0;

  configureLoredeckHealthPanel({
    getState: () => state,
    getCanonLoreDatabaseSync: () => null,
    getLoredeckLibrary: () => [pack],
    getLoredeckStack: () => state.loredeckStack,
    getLoredeckLibraryIndexForPacks: (currentState, library = [pack]) => normalizeLoredeckLibraryIndex(currentState.loredeckRegistry || {}, {
      packs: Object.fromEntries((library || []).map(item => [item.packId, item])),
    }),
    resolveLoredeckStackItems,
    buildLoredeckPackScopedHealth: () => health,
    getLoredeckPackSummaryCounts: () => ({
      entryCount: 2,
      fileCount: 1,
      loadedFileCount: 1,
      categoryCounts: { knowledge: 2 },
    }),
    getLoredeckTypeLabel: () => 'Custom',
    getLoredeckEntryPreviewCacheRecord: () => null,
    getLoredeckManifestPreviewCacheRecord: () => null,
    validateLoredeckForEditor: async () => ({ health }),
    refreshLoredeckSurfaces: () => {},
    clearCanonLoreDatabaseCache: () => {},
    clearContextIndexCache: () => {},
    loadCanonLoreDatabase: async () => null,
    refreshPanelBody: () => {},
    refreshHeader: () => {},
    sanitizeFileStem: value => String(value || 'deck-health').replace(/[^a-z0-9._-]+/gi, '-'),
    downloadJson: () => {},
    openDuplicateLoredeckDialog: () => {},
    handleLoredeckAssistantHealthRepairDraft: async () => {},
    normalizeLoredeckHealthGroupIssuesForRepair: group => group?.issues || [],
    canValidateLoredeckInEditor: () => true,
    isLoredeckMalformedTagIssueGroup: () => false,
    queueLoredeckMalformedTagRepairFromHealthGroup: async () => {},
    getLoredeckHealthRepairActiveRun: () => activeRun,
    cancelLoredeckHealthRepairRun: () => {
      cancelRunCount += 1;
      activeRun = null;
      return true;
    },
    applyLoredeckHealthRepairChoice: async (_pack, choice, option, session) => {
      appliedChoice = {
        choiceSetId: choice?.choiceSetId,
        optionId: option?.optionId,
        sessionId: session?.sessionId,
      };
      return {
        ok: true,
        changed: true,
        summary: {
          initialHealth: { errorCount: 1, warningCount: 1, suggestionCount: 0 },
          finalHealth: { errorCount: 0, warningCount: 1, suggestionCount: 0 },
        },
        remaining: { choiceSets: [], modelUnits: [], deferredUnits: [], manualBuckets: [] },
      };
    },
    continueLoredeckHealthModelRepairSession: async (_pack, session) => {
      continuedSession = session?.sessionId || '';
      return {
        ok: true,
        changed: true,
        appliedPatches: [{ patchId: 'patch-model-1' }],
        summary: {
          initialHealth: { errorCount: 1, warningCount: 1, suggestionCount: 0 },
          finalHealth: { errorCount: 0, warningCount: 1, suggestionCount: 0 },
        },
        remaining: { choiceSets: [], modelUnits: [], deferredUnits: [], manualBuckets: [] },
      };
    },
    repairLoredeckSafeHealthIssues: async () => {},
    normalizeLoredeckHealthIssueStates: value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
    normalizeLoredeckPendingIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
    normalizeLoredeckPendingTimelineIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
    loadLoredeckHealthRepairSessions: async () => {
      loadCount += 1;
      await wait(0);
      return {
        ok: true,
        sessions: [{
          sessionId: 'session-ui-model-pending',
          packId: pack.packId,
          status: 'model_pending',
          outcome: 'model_pending',
          updatedAt: Date.now(),
          summary: {
            finalHealth: { status: 'has_errors', errorCount: 1, warningCount: 1, suggestionCount: 0, issueCount: 2 },
          },
          remaining: {
            choiceSets: [{
              choiceSetId: 'choice-1',
              findingIds: ['finding-1'],
              severity: 'warning',
              code: 'broken_anchor_reference',
              question: 'Which Context anchor should be used?',
              reason: 'Multiple anchors could match this repair.',
              options: [{
                optionId: 'A',
                label: 'Use arlong.start',
                confidence: 0.75,
                reason: 'The anchor shares the expected sort key.',
                patch: {
                  operations: [{ op: 'upsert_entry_override', entryId: 'entry-2', fields: ['context.validFromAnchor'] }],
                },
              }],
            }],
            choiceSetCount: 1,
            modelUnits: [{ unitId: 'unit-1' }],
            deferredUnits: [{ unitId: 'unit-2', deferred: true }],
            manualBuckets: [{ bucketId: 'manual-1' }],
          },
          diagnostics: [],
        }],
        diagnostics: [],
      };
    },
  });

  openLoredeckHealthCenter(pack.packId);
  assert.ok(bodyText().includes('Continue Model Batches running'), 'Health Center should show active repair run state before session loading text.');
  await waitForBodyText('Model pending');
  assert.ok(bodyText().includes('1 needs choice'), 'Health Center should show saved review choice count.');
  assert.ok(bodyText().includes('Which Context anchor should be used?'), 'Health Center should render saved review choice questions.');
  assert.ok(bodyText().includes('Use arlong.start'), 'Health Center should render saved review choice options.');
  assert.ok(bodyText().includes('1 model batch'), 'Health Center should show saved model batch count.');
  assert.ok(bodyText().includes('1 deferred'), 'Health Center should show deferred model batch count.');
  assert.ok(bodyText().includes('1 manual'), 'Health Center should show manual remaining count.');
  assert.ok(bodyText().includes('Continue Model Batches running'), 'Health Center should show the active repair run state.');
  assert.ok(buttonLabels().includes('Refresh Sessions'), 'Health Center should expose repair session refresh.');
  assert.ok(buttonLabels().includes('Cancel Repair Run'), 'Health Center should expose an active repair cancellation action.');
  assert.ok(buttonLabels().includes('Continue Model Batches'), 'Health Center should expose a model continuation action for model-pending sessions.');
  assert.ok(buttonLabels().includes('Attempt Fixing'), 'Health Center should expose Attempt Fixing from the repair session card.');
  assert.ok(buttonLabels().includes('Apply A'), 'Health Center should expose an apply button for saved review choices.');
  assert.equal(loadCount, 1, 'Health Center should load repair sessions once on open.');
  const cancelButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Cancel Repair Run');
  await cancelButton.click();
  await wait(25);
  assert.equal(cancelRunCount, 1, 'Health Center should call the active repair cancellation action.');
  const continueButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Continue Model Batches');
  await continueButton.click();
  await wait(25);
  assert.equal(continuedSession, 'session-ui-model-pending', 'Health Center should pass the saved repair session to the model continuation action.');
  const applyButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Apply A');
  await applyButton.click();
  await wait(25);
  assert.deepEqual(appliedChoice, {
    choiceSetId: 'choice-1',
    optionId: 'A',
    sessionId: 'session-ui-model-pending',
  }, 'Health Center should pass the selected review choice to the repair action.');
  assert.equal(loadCount, 3, 'Continuing model batches and applying a review choice should refresh saved repair sessions.');
  closeLoredeckHealthCenter();
}

await runHealthCenterRepairSessionPanel();

console.log('Loredeck Pack Health Center refresh and repair session tests passed.');
