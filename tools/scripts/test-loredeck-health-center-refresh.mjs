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
    canValidateLoredeckInEditor: () => true,
    isLoredeckMalformedTagIssueGroup: () => false,
    queueLoredeckMalformedTagRepairFromHealthGroup: async () => {},
    attemptLoredeckHealthFixes: async () => {},
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
      warningCount: 0,
      suggestionCount: 0,
      issueCount: 1,
      entryCount: 2,
      categoryCounts: { knowledge: 2 },
    },
    errors: [{
      severity: 'error',
      code: 'schema_v3_missing_content',
      message: 'Missing schema v3 content.',
      entryIds: ['entry-1'],
    }],
    warnings: [],
    suggestions: [],
  };
  const state = {
    loredeckStack: [{ packId: pack.packId, enabled: true, priority: 100 }],
    loredeckRegistry: { schemaVersion: 1, packs: { [pack.packId]: pack } },
  };
  let loadCount = 0;
  let appliedChoice = null;
  let reevaluatedChoice = null;
  let continuedSession = null;
  let cleanupCalls = 0;
  let finishedSessionsCleared = false;
  let savedSessionCleared = false;
  let deletedSessionId = '';
  let confirmCount = 0;
  let downloadedDiagnostics = null;
  let downloadedDiagnosticsFilename = '';
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
    downloadJson: (data, filename) => {
      downloadedDiagnostics = data;
      downloadedDiagnosticsFilename = filename;
    },
    openDuplicateLoredeckDialog: () => {},
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
    reevaluateLoredeckHealthRepairChoice: async (_pack, choice, session) => {
      reevaluatedChoice = {
        choiceSetId: choice?.choiceSetId,
        sessionId: session?.sessionId,
      };
      return {
        ok: true,
        changed: false,
        choiceSets: [{ choiceSetId: 'choice-1b' }],
        summary: {
          initialHealth: { errorCount: 1, warningCount: 1, suggestionCount: 0 },
          finalHealth: { errorCount: 1, warningCount: 1, suggestionCount: 0 },
        },
        remaining: { choiceSets: [{ choiceSetId: 'choice-1b' }], modelUnits: [], deferredUnits: [], manualBuckets: [] },
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
    cleanupLoredeckHealthRepairSessions: async () => {
      cleanupCalls += 1;
      finishedSessionsCleared = true;
      return {
        ok: true,
        deletedCount: 1,
        deleted: [{ sessionId: 'session-ui-complete' }],
        diagnostics: [],
      };
    },
    deleteLoredeckHealthRepairSession: async session => {
      deletedSessionId = session?.sessionId || '';
      savedSessionCleared = true;
      return {
        ok: true,
        path: session?.sessionFile || `/user/files/saga-repair-session-${session?.sessionId || 'session'}.v1.json`,
      };
    },
    confirmAction: async () => {
      confirmCount += 1;
      return true;
    },
    attemptLoredeckHealthFixes: async () => {},
    normalizeLoredeckHealthIssueStates: value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
    normalizeLoredeckPendingIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
    normalizeLoredeckPendingTimelineIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
    loadLoredeckHealthRepairSessions: async () => {
      loadCount += 1;
      await wait(0);
      const sessions = [];
      if (!savedSessionCleared) {
        sessions.push({
          sessionId: 'session-ui-model-pending',
          sessionFile: '/user/files/saga-repair-session-health-session-ui-pack-session-ui-model-pending.v1.json',
          packId: pack.packId,
          status: 'model_pending',
          outcome: 'model_pending',
          updatedAt: Date.now(),
          lifecycle: {
            canUserDelete: true,
            canAutoDelete: false,
            remainingWorkCount: 4,
            diagnosticCount: 1,
          },
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
          diagnostics: [{ severity: 'warning', code: 'saved_session_note', message: 'Compact saved diagnostic.' }],
          appliedPatchIds: ['patch-local-1'],
        });
      }
      if (!finishedSessionsCleared) {
        sessions.push({
          sessionId: 'session-ui-complete',
          packId: pack.packId,
          status: 'complete',
          outcome: 'complete',
          updatedAt: Date.now() - 1000,
          lifecycle: {
            canUserDelete: true,
            canAutoDelete: true,
            remainingWorkCount: 0,
            diagnosticCount: 0,
          },
          summary: {
            finalHealth: { status: 'ok', errorCount: 0, warningCount: 0, suggestionCount: 0, issueCount: 0 },
          },
          remaining: {},
          diagnostics: [],
        });
      }
      return {
        ok: true,
        sessions,
        diagnostics: [],
      };
    },
  });

  openLoredeckHealthCenter(pack.packId);
  assert.ok(bodyText().includes('Continue Model Batches running'), 'Health Center should show active repair run state before session loading text.');
  await waitForBodyText('Model pending');
  assert.equal(buttonLabels().includes('Accept As-Is'), false, 'Error-level Pack Health findings should not expose Accept As-Is.');
  assert.ok(bodyText().includes('1 needs choice'), 'Health Center should show saved review choice count.');
  assert.ok(bodyText().includes('Which Context anchor should be used?'), 'Health Center should render saved review choice questions.');
  assert.ok(bodyText().includes('Use arlong.start'), 'Health Center should render saved review choice options.');
  assert.ok(bodyText().includes('Preview'), 'Health Center should render inline repair choice previews.');
  assert.ok(bodyText().includes('context.validFromAnchor'), 'Repair choice preview should name affected fields.');
  assert.ok(bodyText().includes('1 model batch'), 'Health Center should show saved model batch count.');
  assert.ok(bodyText().includes('1 deferred'), 'Health Center should show deferred model batch count.');
  assert.ok(bodyText().includes('1 manual'), 'Health Center should show manual remaining count.');
  assert.ok(bodyText().includes('Continue Model Batches running'), 'Health Center should show the active repair run state.');
  assert.ok(buttonLabels().includes('Refresh Sessions'), 'Health Center should expose repair session refresh.');
  assert.ok(buttonLabels().includes('Cancel Repair Run'), 'Health Center should expose an active repair cancellation action.');
  assert.ok(buttonLabels().includes('Continue Model Batches'), 'Health Center should expose a model continuation action for model-pending sessions.');
  assert.ok(buttonLabels().includes('Attempt Fixing'), 'Health Center should expose Attempt Fixing from the repair session card.');
  assert.ok(buttonLabels().includes('Clear Finished Sessions'), 'Health Center should expose cleanup for completed repair sessions.');
  assert.ok(buttonLabels().includes('Export Diagnostics'), 'Health Center should expose compact diagnostics export for saved repair sessions.');
  assert.ok(buttonLabels().includes('Clear Saved Session'), 'Health Center should expose explicit saved-session clearing.');
  const activeClearSavedButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Clear Saved Session');
  assert.equal(activeClearSavedButton.disabled, true, 'Health Center should not clear a saved session while a repair run is active.');
  assert.ok(buttonLabels().includes('Ask Model To Re-evaluate'), 'Health Center should expose model re-evaluation for saved review choices.');
  assert.ok(buttonLabels().includes('Apply A'), 'Health Center should expose an apply button for saved review choices.');
  assert.equal(loadCount, 1, 'Health Center should load repair sessions once on open.');
  const clearFinishedButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Clear Finished Sessions');
  await clearFinishedButton.click();
  await wait(25);
  assert.equal(cleanupCalls, 1, 'Health Center should call repair session cleanup for finished sessions.');
  assert.equal(buttonLabels().includes('Clear Finished Sessions'), false, 'Completed repair sessions should disappear after cleanup reloads sessions.');
  const reevaluateButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Ask Model To Re-evaluate');
  await reevaluateButton.click();
  await wait(25);
  assert.deepEqual(reevaluatedChoice, {
    choiceSetId: 'choice-1',
    sessionId: 'session-ui-model-pending',
  }, 'Health Center should pass the selected review choice to the model re-evaluation action.');
  const cancelButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Cancel Repair Run');
  await cancelButton.click();
  await wait(25);
  assert.equal(cancelRunCount, 1, 'Health Center should call the active repair cancellation action.');
  const continueButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Continue Model Batches');
  await continueButton.click();
  await wait(25);
  assert.equal(continuedSession, 'session-ui-model-pending', 'Health Center should pass the saved repair session to the model continuation action.');
  const skipButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Skip For Now');
  await skipButton.click();
  await wait(25);
  assert.ok(bodyText().includes('All review choices are skipped for now'), 'Skipping a repair choice should hide it without applying it.');
  assert.equal(
    document.body.querySelectorAll('button').some(button => button.textContent === 'Apply A'),
    false,
    'Skipped repair choices should not keep their apply button visible.'
  );
  const showSkippedButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Show Skipped Choices');
  await showSkippedButton.click();
  await wait(25);
  const applyButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Apply A');
  await applyButton.click();
  await wait(25);
  assert.deepEqual(appliedChoice, {
    choiceSetId: 'choice-1',
    optionId: 'A',
    sessionId: 'session-ui-model-pending',
  }, 'Health Center should pass the selected review choice to the repair action.');
  assert.equal(loadCount, 5, 'Cleanup, model re-evaluation, continuing model batches, and applying a review choice should refresh saved repair sessions.');
  const exportButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Export Diagnostics');
  await exportButton.click();
  await wait(25);
  assert.equal(downloadedDiagnostics.kind, 'saga_loredeck_health_repair_session_diagnostics');
  assert.equal(downloadedDiagnostics.sessionId, 'session-ui-model-pending');
  assert.equal(downloadedDiagnostics.remainingCounts.reviewChoices, 1);
  assert.equal(downloadedDiagnostics.diagnostics[0].code, 'saved_session_note');
  assert.equal(downloadedDiagnostics.entryOverrides, undefined, 'Repair session diagnostics export should stay compact.');
  assert.match(downloadedDiagnosticsFilename, /health-session-ui-pack-session-ui-model-pending-repair-session-diagnostics\.json$/);
  const clearSavedButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Clear Saved Session');
  assert.equal(clearSavedButton.disabled, false, 'Health Center should allow saved-session clearing after the active run ends.');
  await clearSavedButton.click();
  await wait(25);
  assert.equal(confirmCount, 1, 'Clearing a saved repair session should confirm first.');
  assert.equal(deletedSessionId, 'session-ui-model-pending', 'Health Center should delete the selected saved repair session.');
  assert.equal(loadCount, 6, 'Clearing a saved repair session should refresh saved repair sessions.');
  assert.equal(buttonLabels().includes('Clear Saved Session'), false, 'Cleared saved sessions should disappear after reload.');
  closeLoredeckHealthCenter();
}

async function runHealthCenterVerifyFixedClearsAfterCleanScan() {
  installFakeDom();
  const pack = {
    packId: 'verify-fixed-ui-pack',
    title: 'Verify Fixed UI Pack',
    type: 'custom',
    healthIssueStates: {},
    stats: { entryCount: 1, categoryCounts: { knowledge: 1 } },
  };
  const warningHealth = {
    packId: pack.packId,
    status: 'needs_review',
    summary: {
      errorCount: 0,
      warningCount: 1,
      suggestionCount: 0,
      issueCount: 1,
      entryCount: 1,
      categoryCounts: { knowledge: 1 },
    },
    errors: [],
    warnings: [{
      severity: 'warning',
      code: 'manifest_entry_count_mismatch',
      message: 'Manifest stats.entryCount is 2, but Pack Health counted 1 loaded Lorecard.',
      expectedEntryCount: 2,
      actualEntryCount: 1,
    }],
    suggestions: [],
  };
  const cleanHealth = {
    packId: pack.packId,
    status: 'good',
    summary: {
      errorCount: 0,
      warningCount: 0,
      suggestionCount: 0,
      issueCount: 0,
      entryCount: 1,
      categoryCounts: { knowledge: 1 },
    },
    errors: [],
    warnings: [],
    suggestions: [],
  };
  let currentHealth = warningHealth;
  let validationHealth = warningHealth;
  const state = {
    loredeckStack: [{ packId: pack.packId, enabled: true, priority: 100 }],
    loredeckRegistry: { schemaVersion: 1, packs: { [pack.packId]: pack } },
  };
  const persistedStates = [];

  configureLoredeckHealthPanel({
    getState: () => state,
    getCanonLoreDatabaseSync: () => null,
    getLoredeckLibrary: () => [pack],
    getLoredeckStack: () => state.loredeckStack,
    getLoredeckLibraryIndexForPacks: (currentState, library = [pack]) => normalizeLoredeckLibraryIndex(currentState.loredeckRegistry || {}, {
      packs: Object.fromEntries((library || []).map(item => [item.packId, item])),
    }),
    resolveLoredeckStackItems,
    buildLoredeckPackScopedHealth: () => currentHealth,
    getLoredeckPackSummaryCounts: () => ({
      entryCount: 1,
      fileCount: 1,
      loadedFileCount: 1,
      categoryCounts: { knowledge: 1 },
    }),
    getLoredeckTypeLabel: () => 'Custom',
    getLoredeckEntryPreviewCacheRecord: () => ({ health: currentHealth, loadedAt: Date.now() }),
    getLoredeckManifestPreviewCacheRecord: () => ({ health: currentHealth, loadedAt: Date.now() }),
    validateLoredeckForEditor: async () => {
      currentHealth = validationHealth;
      return { health: validationHealth };
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
    canValidateLoredeckInEditor: () => true,
    isLoredeckMalformedTagIssueGroup: () => false,
    queueLoredeckMalformedTagRepairFromHealthGroup: async () => {},
    getLoredeckHealthRepairActiveRun: () => null,
    attemptLoredeckHealthFixes: async () => {},
    normalizeLoredeckHealthIssueStates: value => (value && typeof value === 'object' && !Array.isArray(value) ? value : {}),
    normalizeLoredeckPendingIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
    normalizeLoredeckPendingTimelineIdList: value => (Array.isArray(value) ? value : [value]).map(item => String(item || '').trim()).filter(Boolean),
    getFreshLoredeckLibraryPack: (_packId, fallback) => pack || fallback,
    persistLoredeckHealthIssueState: async (_pack, issueKey, stateRecord) => {
      persistedStates.push({ issueKey, stateRecord });
      if (stateRecord) pack.healthIssueStates = { ...pack.healthIssueStates, [issueKey]: stateRecord };
      else {
        const next = { ...pack.healthIssueStates };
        delete next[issueKey];
        pack.healthIssueStates = next;
      }
      return { ok: true, healthIssueStates: pack.healthIssueStates };
    },
    loadLoredeckHealthRepairSessions: async () => ({ ok: true, sessions: [], diagnostics: [] }),
  });

  openLoredeckHealthCenter(pack.packId, { tab: 'issues' });
  assert.ok(buttonLabels().includes('Verify Fixed'), 'Warning-level Pack Health findings should expose Verify Fixed.');
  const verifyButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Verify Fixed');
  await verifyButton.click();
  await wait(25);
  assert.equal(persistedStates.length, 1, 'Verify Fixed should persist a verification marker.');
  const issueKey = persistedStates[0].issueKey;
  assert.equal(pack.healthIssueStates[issueKey].status, 'resolved');
  assert.ok(bodyText().includes('Verification requested'), 'Verify Fixed should show a verification marker before the next scan.');

  validationHealth = warningHealth;
  const firstRefresh = document.body.querySelectorAll('button').find(button => button.textContent === 'Refresh Scan');
  await firstRefresh.click();
  await wait(25);
  assert.equal(pack.healthIssueStates[issueKey].status, 'resolved', 'Refresh Scan should not clear verification while Pack Health still reports findings.');
  assert.equal(persistedStates.filter(call => call.stateRecord === null).length, 0, 'Still-failing scans should not clear verification markers.');

  validationHealth = cleanHealth;
  const secondRefresh = document.body.querySelectorAll('button').find(button => button.textContent === 'Refresh Scan');
  await secondRefresh.click();
  await wait(25);
  assert.equal(pack.healthIssueStates[issueKey], undefined, 'Clean Refresh Scan should clear resolved verification markers.');
  assert.equal(persistedStates.filter(call => call.stateRecord === null).length, 1, 'Clean scans should clear each verified marker once.');
  closeLoredeckHealthCenter();
}

await runHealthCenterRepairSessionPanel();
await runHealthCenterVerifyFixedClearsAfterCleanScan();

console.log('Loredeck Pack Health Center refresh and repair session tests passed.');
