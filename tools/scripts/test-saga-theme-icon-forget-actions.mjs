import assert from 'node:assert/strict';

class FakeStyle {
  constructor() {
    this.values = {};
  }

  setProperty(name, value) {
    this.values[String(name)] = String(value ?? '');
  }
}

class FakeClassList {
  constructor(el) {
    this.el = el;
    this.values = new Set();
  }

  load(value) {
    this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
    this.el._className = [...this.values].join(' ');
  }

  add(...names) {
    for (const name of names) {
      if (name) this.values.add(String(name));
    }
    this.el._className = [...this.values].join(' ');
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
    this.style = new FakeStyle();
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
    if (raw.startsWith('#')) return this.getAttribute('id') === raw.slice(1) || this.id === raw.slice(1);
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
    this.documentElement = new FakeElement('html');
    this.body = new FakeElement('body');
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  createDocumentFragment() {
    return new FakeElement('#fragment');
  }
}

const MODULE_KEY = 'saga';
const THEME_ID = 'storage-forget-theme';
const ICON_SET_ID = 'storage-forget-icons';
const tinyPngDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

const stored = new Map();
const fileCalls = [];
let saveSettingsCount = 0;

function response(ok, status, body = '') {
  return {
    ok,
    status,
    async text() {
      return body;
    },
  };
}

const { __sagaFileApiTestHooks, createSagaFileApi } = await import('../../src/storage/saga-file-api.js');

async function fakeFetch(url, init = {}) {
  const method = init.method || 'GET';
  const body = init.body ? JSON.parse(init.body) : null;
  fileCalls.push({ url, method, body });

  if (url === '/api/files/upload' && method === 'POST') {
    const path = `/user/files/${body.name}`;
    stored.set(path, __sagaFileApiTestHooks.base64ToUtf8(body.data));
    return response(true, 200, JSON.stringify({ path }));
  }

  if (url === '/api/files/verify' && method === 'POST') {
    return response(true, 200, JSON.stringify(Object.fromEntries((body.urls || []).map(path => [path, stored.has(path)]))));
  }

  if (url === '/api/files/delete' && method === 'POST') {
    stored.delete(body.path);
    return response(true, 200, JSON.stringify({ ok: true }));
  }

  if (method === 'GET') {
    if (!stored.has(url)) return response(false, 404, 'missing');
    return response(true, 200, stored.get(url));
  }

  return response(false, 404, 'unexpected request');
}

const extensionSettings = {
  [MODULE_KEY]: {
    themePackId: THEME_ID,
    themeIconSetId: ICON_SET_ID,
    themeCustomEnabled: false,
    themePackLibrary: { schemaVersion: 1, packs: {} },
    themeIconSetLibrary: { schemaVersion: 1, iconSets: {} },
  },
};

globalThis.document = new FakeDocument();
globalThis.window = { innerWidth: 1280, innerHeight: 720, document: globalThis.document };
globalThis.fetch = fakeFetch;
globalThis.SillyTavern = {
  getContext() {
    return {
      extensionSettings,
      chatMetadata: {},
      getRequestHeaders: () => ({ 'X-CSRF-Token': 'theme-forget-actions-test' }),
      saveSettingsDebounced() {
        saveSettingsCount += 1;
      },
      saveMetadata() {},
    };
  },
};

const fileApi = createSagaFileApi({
  getRequestHeaders: () => ({ 'X-CSRF-Token': 'theme-forget-actions-test' }),
  fetchImpl: fakeFetch,
});

const {
  getExternalThemeIconSetLibraryRegistry,
  getExternalThemePackLibraryRegistry,
  importExternalIconSet,
  importExternalThemePack,
  resetSagaThemeIconStorageCache,
} = await import('../../src/storage/saga-theme-icon-storage.js');
const {
  SAGA_STORAGE_DOMAIN_INDEX_FILES,
} = await import('../../src/storage/saga-storage-index.js');
const {
  configureThemeActions,
  forgetIconSet,
  forgetThemePack,
} = await import('../../src/settings/theme-actions.js');
const {
  getSettings,
} = await import('../../src/state/state-manager.js');
const {
  DEFAULT_ICONSET_ID,
  THEMEPACK_PRESETS,
  getIconSetPreset,
  getThemePreset,
} = await import('../../src/theme/runtime-theme.js');

resetSagaThemeIconStorageCache();

let refreshPanelCount = 0;
let refreshHeaderCount = 0;
let refreshRailCount = 0;
const panelRoot = document.createElement('div');
document.body.appendChild(panelRoot);

configureThemeActions({
  getPanelRoot: () => panelRoot,
  refreshPanelBody: () => {
    refreshPanelCount += 1;
  },
  refreshHeader: () => {
    refreshHeaderCount += 1;
  },
  refreshRuntimeRailIcons: () => {
    refreshRailCount += 1;
  },
});

const themeImport = await importExternalThemePack({
  id: THEME_ID,
  title: 'Storage Forget Theme',
  description: 'Theme used by the forget action behavior test.',
  author: 'Saga Test',
  version: '1.0.0',
  colors: {
    background: '#120c12',
    surface: '#2b1c1c',
    accent: '#d7b56d',
  },
  tags: ['theme:custom'],
}, { fileApi, now: () => 1000, sourceFileName: 'storage-forget.theme.json' });
assert.equal(themeImport.ok, true);

const iconImport = await importExternalIconSet({
  id: ICON_SET_ID,
  title: 'Storage Forget Icons',
  preferredSize: 256,
  icons: {
    'tab.loredecks': tinyPngDataUrl,
    'tab.settings': './assets/iconsets/saga-hero/hero-tab-settings-256.png',
  },
  tags: ['icons:custom'],
}, { fileApi, now: () => 2000, sourceFileName: 'storage-forget.iconset.json' });
assert.equal(iconImport.ok, true);

const iconPayload = JSON.parse(stored.get(iconImport.payloadFile));
const uploadedIconPath = iconPayload.icons['tab.loredecks'];

assert.equal(getThemePreset(THEME_ID, getSettings()).id, THEME_ID);
assert.equal(getIconSetPreset(ICON_SET_ID, getSettings()).id, ICON_SET_ID);
assert.equal(getSettings().themePackId, THEME_ID);
assert.equal(getSettings().themeIconSetId, ICON_SET_ID);

const iconForget = forgetIconSet(ICON_SET_ID);
let overlay = document.querySelector('.saga-confirm-overlay');
assert.ok(overlay, 'Forgetting an active external Icon Set should ask for confirmation.');
assert.equal(overlay.querySelector('.saga-confirm-title').textContent, 'Forget Icon Set');
assert.match(overlay.querySelector('.saga-confirm-message').textContent, /Storage Forget Icons/);
await overlay.querySelectorAll('button').find(button => button.textContent === 'Confirm').click();
await iconForget;

assert.equal(document.querySelector('.saga-confirm-overlay'), null);
assert.equal(stored.has(iconImport.payloadFile), false);
assert.equal(stored.has(uploadedIconPath), false);
assert.equal(getExternalThemeIconSetLibraryRegistry().iconSets[ICON_SET_ID], undefined);
assert.equal(getIconSetPreset(ICON_SET_ID, getSettings()).id, DEFAULT_ICONSET_ID);
assert.equal(getSettings().themeIconSetId, DEFAULT_ICONSET_ID);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.iconSets)).iconSets[ICON_SET_ID], undefined);
assert.ok(fileCalls.some(call => call.url === '/api/files/delete' && call.body.path === iconImport.payloadFile));
assert.ok(fileCalls.some(call => call.url === '/api/files/delete' && call.body.path === uploadedIconPath));
assert.ok(refreshRailCount >= 1, 'Forgetting the active Icon Set should refresh runtime rail icons.');

const themeForget = forgetThemePack(THEME_ID);
overlay = document.querySelector('.saga-confirm-overlay');
assert.ok(overlay, 'Forgetting an active external Theme Pack should ask for confirmation.');
assert.equal(overlay.querySelector('.saga-confirm-title').textContent, 'Forget Theme Pack');
assert.match(overlay.querySelector('.saga-confirm-message').textContent, /Storage Forget Theme/);
await overlay.querySelectorAll('button').find(button => button.textContent === 'Confirm').click();
await themeForget;

assert.equal(document.querySelector('.saga-confirm-overlay'), null);
assert.equal(stored.has(themeImport.payloadFile), false);
assert.equal(getExternalThemePackLibraryRegistry().packs[THEME_ID], undefined);
assert.equal(getThemePreset(THEME_ID, getSettings()).id, THEMEPACK_PRESETS[0].id);
assert.equal(getSettings().themePackId, THEMEPACK_PRESETS[0].id);
assert.equal(JSON.parse(stored.get(SAGA_STORAGE_DOMAIN_INDEX_FILES.themes)).packs[THEME_ID], undefined);
assert.ok(fileCalls.some(call => call.url === '/api/files/delete' && call.body.path === themeImport.payloadFile));
assert.ok(refreshPanelCount >= 1, 'Forgetting the active Theme Pack should refresh the Settings panel.');
assert.ok(refreshHeaderCount >= 1, 'Forgetting the active Theme Pack should refresh the runtime header.');
assert.ok(saveSettingsCount >= 2, 'Forgetting active Theme/Icon choices should persist reset compact settings.');

console.log('Saga Theme/Icon forget action tests passed.');
