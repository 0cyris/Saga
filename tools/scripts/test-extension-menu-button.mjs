import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { installExtensionsMenuButton } from '../../src/extension/menu-button.js';
import { __runtimeActionTestHooks, registerRuntimeAction } from '../../src/runtime/runtime-actions.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

class FakeElement {
    constructor(tagName, ownerDocument, namespaceURI = null) {
        this.tagName = tagName;
        this.ownerDocument = ownerDocument;
        this.namespaceURI = namespaceURI;
        this.children = [];
        this.attributes = new Map();
        this.eventListeners = new Map();
        this.parentNode = null;
        this.className = '';
        this.textContent = '';
        this.title = '';
        this._id = '';
    }

    get id() {
        return this._id;
    }

    set id(value) {
        this._id = String(value || '');
        this.ownerDocument.registerElement(this);
    }

    setAttribute(name, value) {
        const normalized = String(value);
        this.attributes.set(name, normalized);
        if (name === 'id') this.id = normalized;
        if (name === 'class') this.className = normalized;
    }

    getAttribute(name) {
        return this.attributes.get(name) || null;
    }

    append(...nodes) {
        for (const node of nodes) {
            this.appendChild(node);
        }
    }

    appendChild(node) {
        node.parentNode = this;
        this.children.push(node);
        this.ownerDocument.registerTree(node);
        return node;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        }
        this.ownerDocument.unregisterTree(this);
        this.parentNode = null;
    }

    addEventListener(type, handler) {
        this.eventListeners.set(type, handler);
    }

    click() {
        const handler = this.eventListeners.get('click');
        if (handler) handler({ type: 'click', target: this });
    }
}

class FakeDocument {
    constructor() {
        this.elementsById = new Map();
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }

    createElementNS(namespaceURI, tagName) {
        return new FakeElement(tagName, this, namespaceURI);
    }

    getElementById(id) {
        return this.elementsById.get(id) || null;
    }

    registerElement(element) {
        if (element.id) {
            this.elementsById.set(element.id, element);
        }
    }

    registerTree(element) {
        this.registerElement(element);
        for (const child of element.children) {
            this.registerTree(child);
        }
    }

    unregisterTree(element) {
        if (element.id && this.elementsById.get(element.id) === element) {
            this.elementsById.delete(element.id);
        }
        for (const child of element.children) {
            this.unregisterTree(child);
        }
    }
}

async function readText(relativePath) {
    return readFile(path.join(repoRoot, relativePath), 'utf8');
}

const fakeDocument = new FakeDocument();
globalThis.document = fakeDocument;

const menu = fakeDocument.createElement('div');
menu.id = 'extensionsMenu';

const placeholder = fakeDocument.createElement('div');
placeholder.id = 'extensionsMenuDefault';
menu.appendChild(placeholder);

let openCount = 0;
__runtimeActionTestHooks.clearRuntimeActions();
registerRuntimeAction('runtime.open', () => {
    openCount += 1;
});

installExtensionsMenuButton();

const button = fakeDocument.getElementById('saga-extensions-menu-button');
assert(button, 'Saga should install a quick-bar menu button.');
assert.equal(fakeDocument.getElementById('extensionsMenuDefault'), null, 'Saga should remove the default placeholder.');
assert.equal(menu.children.includes(button), true, 'Saga button should be appended to the extensions menu.');
assert.equal(button.className, 'list-group-item flex-container flexGap5 interactable');
assert.equal(button.title, 'Open the SAGA runtime window.');

const [icon, label] = button.children;
assert.equal(icon.tagName, 'i', 'Saga quick-bar icon should use SillyTavern-style Font Awesome markup.');
assert.equal(icon.className, 'fa-solid fa-compass saga-extensions-menu-icon');
assert.equal(icon.getAttribute('aria-hidden'), 'true');
assert.equal(label.tagName, 'span');
assert.equal(label.textContent, 'SAGA');

button.click();
assert.equal(openCount, 1, 'Saga quick-bar button should open the runtime window.');

installExtensionsMenuButton();
assert.equal(
    menu.children.filter(child => child.id === 'saga-extensions-menu-button').length,
    1,
    'Saga should not install duplicate quick-bar buttons.'
);

const menuButtonSource = await readText('src/extension/menu-button.js');
assert(!menuButtonSource.includes('\\uD83E\\uDE84'), 'Saga quick-bar button should not use the unsupported wand emoji escape.');
assert(!menuButtonSource.includes(String.fromCodePoint(0x1fa84)), 'Saga quick-bar button should not use the unsupported wand emoji literal.');

const componentsCss = await readText('styles/components.css');
assert(componentsCss.includes('.saga-extensions-menu-icon'), 'Saga quick-bar icon CSS should be present.');
assert(componentsCss.includes('color: inherit'), 'Saga quick-bar icon should inherit SillyTavern menu color.');

__runtimeActionTestHooks.clearRuntimeActions();
delete globalThis.document;

console.log('Extension menu button contract passed.');
