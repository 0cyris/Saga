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

async function waitForRefreshToSettle(deckId, entryPreviewCache) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
    const hasRestoredRefreshButton = buttonLabels().includes('Refresh Scan');
    const hasCachedHealth = !!entryPreviewCache.get(deckId)?.health;
    if (overlay && hasRestoredRefreshButton && hasCachedHealth) return;
    await wait(25);
  }
  throw new Error(`${deckId} Deck Health refresh did not settle.`);
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
    assert.ok(document.querySelector('.saga-loredeck-health-center-overlay'), `${deckId} should open the Deck Health Center.`);
    const refreshButton = document.body.querySelectorAll('button').find(button => button.textContent === 'Refresh Scan');
    assert.ok(refreshButton, `${deckId} should render a Refresh Scan button.`);

    await refreshButton.click();
    await waitForRefreshToSettle(deckId, entryPreviewCache);

    assert.ok(document.querySelector('.saga-loredeck-health-center-overlay'), `${deckId} should keep the Deck Health Center visible after refresh.`);
    assert.ok(buttonLabels().includes('Refresh Scan'), `${deckId} should restore the Refresh Scan button after refresh.`);
    assert.equal(entryPreviewCache.get(deckId)?.health?.status, 'good', `${deckId} should cache good Deck Health after refresh.`);
    assert.equal(errors.some(error => error.includes('Deck Health Center render failed')), false, `${deckId} should not hit the Health Center render fallback.`);
    assert.equal(errors.some(error => error.includes('normalizeLoredeckTagId')), false, `${deckId} should not crash on tag affected rows.`);
  } finally {
    console.error = originalConsoleError;
    closeLoredeckHealthCenter();
  }
}

for (const deckId of DEFAULT_MHA_LOREDECK_IDS) {
  await runHealthCenterRefresh(deckId);
}

console.log('Loredeck Health Center refresh tests passed for My Hero decks.');
