import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { redactDiagnosticText, redactDiagnosticValue } from '../../src/runtime/runtime-redaction.js';

const ST_URL = process.env.SAGA_ST_URL || 'http://127.0.0.1:8000/';
const ROOT = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_DIR = process.env.SAGA_SMOKE_OUT || path.join(ROOT, 'assets', 'documentation', 'renders', 'saga-smoke');
const SMOKE_TARGET = process.env.SAGA_SMOKE_TARGET || 'live-st';
const VIEWPORT = {
    width: Number(process.env.SAGA_SMOKE_VIEWPORT_WIDTH) || (SMOKE_TARGET.endsWith('-narrow') ? 430 : 1280),
    height: Number(process.env.SAGA_SMOKE_VIEWPORT_HEIGHT) || (SMOKE_TARGET.endsWith('-narrow') ? 820 : 720),
};
const LIVE_CONTEXT_LOADED_PACK_ID = 'hp-year-6-half-blood-prince';
const LIVE_CONTEXT_LOADED_PACK_TITLE = 'Harry Potter Year 6: Half-Blood Prince';
const LIVE_CONTEXT_REASONER_TARGET = 'live-context-reasoner';
const REPO_LOCAL_HARNESS_TARGETS = new Set(['context-harness', 'guide-harness']);
const LIVE_CONTEXT_METADATA_TARGETS = new Set([
    'live-context-loaded',
    'live-context-loaded-narrow',
    LIVE_CONTEXT_REASONER_TARGET,
]);
const ALLOW_PROVIDER_CALLS = process.env.SAGA_ALLOW_PROVIDER_CALLS === '1';

const COMMON_CHROME_PATHS = [
    process.env.SAGA_CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function findChrome() {
    for (const candidate of COMMON_CHROME_PATHS) {
        if (await exists(candidate)) return candidate;
    }
    throw new Error('No Chrome or Edge executable found. Set SAGA_CHROME_PATH to a Chromium-compatible browser.');
}

async function getFreePort() {
    return await new Promise((resolve, reject) => {
        const server = net.createServer();
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : null;
            server.close(() => port ? resolve(port) : reject(new Error('Could not allocate a port.')));
        });
    });
}

function httpJson(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(body));
                } catch (error) {
                    reject(error);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
            req.destroy(new Error('HTTP request timed out.'));
        });
    });
}

function sendStatic(res, status, body, contentType = 'text/plain; charset=utf-8') {
    res.writeHead(status, {
        'content-type': contentType,
        'cache-control': 'no-store',
    });
    res.end(body);
}

function getStaticMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.svg': 'image/svg+xml; charset=utf-8',
        '.ico': 'image/x-icon',
    };
    return types[ext] || 'application/octet-stream';
}

function getVisualSmokeHarnessQuery(target = SMOKE_TARGET) {
    if (target === 'context-harness') return '?tab=context&review=context-proposals';
    if (target === 'guide-harness') return '?mode=basic&tab=session';
    return '';
}

async function startVisualSmokeServer(target = SMOKE_TARGET) {
    const host = '127.0.0.1';
    const port = await getFreePort();
    const server = http.createServer(async (req, res) => {
        if (!['GET', 'HEAD'].includes(req.method || '')) {
            sendStatic(res, 405, 'Method not allowed');
            return;
        }
        const decoded = decodeURIComponent(String(req.url || '/').split('?')[0] || '/');
        if (decoded === '/favicon.ico') {
            sendStatic(res, 204, '');
            return;
        }
        const relative = decoded === '/' ? 'tests/browser/visual-smoke.html' : decoded.replace(/^\/+/, '');
        const filePath = path.resolve(ROOT, relative);
        if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
            sendStatic(res, 403, 'Forbidden');
            return;
        }
        try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile()) {
                sendStatic(res, 404, 'Not found');
                return;
            }
            const contentType = getStaticMimeType(filePath);
            if (req.method === 'HEAD') {
                res.writeHead(200, {
                    'content-type': contentType,
                    'cache-control': 'no-store',
                });
                res.end();
                return;
            }
            sendStatic(res, 200, await fs.readFile(filePath), contentType);
        } catch (error) {
            sendStatic(res, error?.code === 'ENOENT' ? 404 : 500, error?.message || 'Server error');
        }
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
    });
    const query = getVisualSmokeHarnessQuery(target);
    return {
        server,
        url: `http://${host}:${port}/tests/browser/visual-smoke.html${query}`,
    };
}

async function waitForDevtools(port) {
    const endpoint = `http://127.0.0.1:${port}/json`;
    const versionEndpoint = `http://127.0.0.1:${port}/json/version`;
    const deadline = Date.now() + 10000;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            const version = await httpJson(versionEndpoint);
            const targets = await httpJson(endpoint);
            if (process.env.SAGA_SMOKE_DEBUG) {
                console.error(JSON.stringify({ version, targets }, null, 2));
            }
            const page = targets.find(target => target.type === 'page');
            if (version?.webSocketDebuggerUrl && page?.id) {
                return {
                    browserWsUrl: version.webSocketDebuggerUrl,
                    pageWsUrl: page.webSocketDebuggerUrl || '',
                    pageTargetId: page.id,
                };
            }
        } catch (error) {
            lastError = error;
        }
        await wait(150);
    }
    throw lastError || new Error('Chrome DevTools endpoint did not become ready.');
}

class CdpClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.nextId = 1;
        this.pending = new Map();
        this.events = [];
        this.eventHandlers = new Map();
    }

    async connect() {
        this.ws = process.env.SAGA_SMOKE_NATIVE_WS === '1' && typeof WebSocket === 'function'
            ? new NativeWebSocket(this.wsUrl)
            : new RawWebSocket(this.wsUrl);
        this.ws.onMessage(async data => {
            try {
                const raw = await readWebSocketData(data);
                if (process.env.SAGA_SMOKE_DEBUG_FRAME) console.error(`CDP <= ${redactDiagnosticText(raw).slice(0, 500)}`);
                const payload = JSON.parse(raw);
                if (payload.id && this.pending.has(payload.id)) {
                    const { resolve, reject } = this.pending.get(payload.id);
                    this.pending.delete(payload.id);
                    if (payload.error) reject(new Error(`${payload.error.message || 'CDP error'} ${payload.error.data || ''}`.trim()));
                    else resolve(payload.result || {});
                    return;
                }
                if (payload.method) {
                    this.events.push(payload);
                    const handlers = this.eventHandlers.get(payload.method) || [];
                    for (const handler of handlers) {
                        void handler(payload);
                    }
                }
            } catch (error) {
                if (process.env.SAGA_SMOKE_DEBUG) console.error(`CDP message parse failed: ${error.stack || error.message}`);
            }
        });
        await this.ws.connect();
        this.ws.onClose(() => {
            for (const [id, pending] of this.pending.entries()) {
                pending.reject(new Error(`CDP WebSocket closed before response ${id}.`));
            }
            this.pending.clear();
        });
    }

    send(method, params = {}) {
        const id = this.nextId++;
        const payload = { id, method, params };
        if (this.sessionId && !method.startsWith('Target.')) payload.sessionId = this.sessionId;
        const message = JSON.stringify(payload);
        if (process.env.SAGA_SMOKE_DEBUG_FRAME) console.error(`CDP => ${JSON.stringify(redactDiagnosticValue(payload)).slice(0, 500)}`);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP ${method} timed out.`));
            }, 10000);
            this.pending.set(id, {
                resolve: value => {
                    clearTimeout(timer);
                    resolve(value);
                },
                reject: error => {
                    clearTimeout(timer);
                    reject(error);
                },
            });
            this.ws.send(message);
        });
    }

    close() {
        try {
            this.ws?.close();
        } catch {
            // no-op
        }
    }

    on(method, handler) {
        const handlers = this.eventHandlers.get(method) || [];
        handlers.push(handler);
        this.eventHandlers.set(method, handlers);
    }
}

class NativeWebSocket {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.messageHandlers = [];
        this.closeHandlers = [];
    }

    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    onClose(handler) {
        this.closeHandlers.push(handler);
    }

    async connect() {
        this.ws = new WebSocket(this.wsUrl);
        this.ws.addEventListener('message', event => {
            for (const handler of this.messageHandlers) handler(event.data);
        });
        this.ws.addEventListener('close', () => {
            for (const handler of this.closeHandlers) handler();
        });
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Native WebSocket connect timed out.')), 5000);
            this.ws.addEventListener('open', () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
            this.ws.addEventListener('error', () => {
                clearTimeout(timer);
                reject(new Error('Native WebSocket connection failed.'));
            }, { once: true });
        });
    }

    send(message) {
        this.ws.send(message);
    }

    close() {
        this.ws?.close();
    }
}

async function readWebSocketData(data) {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
    if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
    if (data && typeof data.text === 'function') return await data.text();
    return String(data);
}

class RawWebSocket {
    constructor(wsUrl) {
        this.url = new URL(wsUrl);
        this.buffer = Buffer.alloc(0);
        this.messageHandlers = [];
        this.closeHandlers = [];
        this.fragments = [];
    }

    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    onClose(handler) {
        this.closeHandlers.push(handler);
    }

    async connect() {
        if (this.url.protocol !== 'ws:') throw new Error('RawWebSocket only supports ws:// CDP URLs.');
        const port = Number(this.url.port) || 80;
        this.socket = net.createConnection({ host: this.url.hostname, port });
        this.socket.on('error', error => {
            if (process.env.SAGA_SMOKE_DEBUG) console.error(`Raw WebSocket error: ${error.message}`);
        });
        this.socket.on('close', () => {
            for (const handler of this.closeHandlers) handler();
        });

        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Raw WebSocket TCP connect timed out.')), 5000);
            this.socket.once('connect', () => {
                clearTimeout(timer);
                resolve();
            });
            this.socket.once('error', error => {
                clearTimeout(timer);
                reject(error);
            });
        });

        const key = crypto.randomBytes(16).toString('base64');
        const request = [
            `GET ${this.url.pathname}${this.url.search} HTTP/1.1`,
            `Host: ${this.url.host}`,
            'Upgrade: websocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Key: ${key}`,
            'Sec-WebSocket-Version: 13',
            'Origin: http://127.0.0.1',
            '',
            '',
        ].join('\r\n');

        await new Promise((resolve, reject) => {
            let handshake = Buffer.alloc(0);
            const timer = setTimeout(() => reject(new Error('Raw WebSocket handshake timed out.')), 5000);
            const onData = chunk => {
                handshake = Buffer.concat([handshake, chunk]);
                const boundary = handshake.indexOf('\r\n\r\n');
                if (boundary < 0) return;
                this.socket.off('data', onData);
                clearTimeout(timer);
                const head = handshake.subarray(0, boundary).toString('utf8');
                if (!/^HTTP\/1\.1 101\b/i.test(head)) {
                    reject(new Error(`Raw WebSocket handshake failed: ${head.split('\r\n')[0] || 'no response'}`));
                    return;
                }
                const rest = handshake.subarray(boundary + 4);
                this.socket.on('data', chunk => this.handleData(chunk));
                if (rest.length) this.handleData(rest);
                resolve();
            };
            this.socket.on('data', onData);
            this.socket.write(request);
        });
    }

    send(text) {
        this.sendFrame(0x1, Buffer.from(text, 'utf8'));
    }

    sendFrame(opcode, payload) {
        const length = payload.length;
        let headerLength = 2;
        if (length >= 126 && length <= 65535) headerLength += 2;
        else if (length > 65535) headerLength += 8;
        const header = Buffer.alloc(headerLength + 4);
        header[0] = 0x80 | opcode;
        let offset = 2;
        if (length < 126) {
            header[1] = 0x80 | length;
        } else if (length <= 65535) {
            header[1] = 0x80 | 126;
            header.writeUInt16BE(length, offset);
            offset += 2;
        } else {
            header[1] = 0x80 | 127;
            header.writeBigUInt64BE(BigInt(length), offset);
            offset += 8;
        }
        const mask = crypto.randomBytes(4);
        mask.copy(header, offset);
        const masked = Buffer.alloc(length);
        for (let index = 0; index < length; index += 1) {
            masked[index] = payload[index] ^ mask[index % 4];
        }
        this.socket.write(Buffer.concat([header, masked]));
    }

    handleData(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        while (this.buffer.length >= 2) {
            const first = this.buffer[0];
            const second = this.buffer[1];
            const fin = (first & 0x80) !== 0;
            const opcode = first & 0x0f;
            const masked = (second & 0x80) !== 0;
            let length = second & 0x7f;
            let offset = 2;
            if (length === 126) {
                if (this.buffer.length < offset + 2) return;
                length = this.buffer.readUInt16BE(offset);
                offset += 2;
            } else if (length === 127) {
                if (this.buffer.length < offset + 8) return;
                const bigLength = this.buffer.readBigUInt64BE(offset);
                if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('WebSocket frame too large.');
                length = Number(bigLength);
                offset += 8;
            }
            let mask = null;
            if (masked) {
                if (this.buffer.length < offset + 4) return;
                mask = this.buffer.subarray(offset, offset + 4);
                offset += 4;
            }
            if (this.buffer.length < offset + length) return;
            let payload = this.buffer.subarray(offset, offset + length);
            this.buffer = this.buffer.subarray(offset + length);
            if (mask) {
                const unmasked = Buffer.alloc(payload.length);
                for (let index = 0; index < payload.length; index += 1) {
                    unmasked[index] = payload[index] ^ mask[index % 4];
                }
                payload = unmasked;
            }
            this.handleFrame(opcode, fin, payload);
        }
    }

    handleFrame(opcode, fin, payload) {
        if (opcode === 0x8) {
            this.close();
            return;
        }
        if (opcode === 0x9) {
            this.sendFrame(0xA, payload);
            return;
        }
        if (opcode === 0xA) return;
        if (opcode === 0x1 || opcode === 0x2) {
            if (fin) {
                this.emitMessage(payload);
                return;
            }
            this.fragments = [payload];
            return;
        }
        if (opcode === 0x0) {
            this.fragments.push(payload);
            if (fin) {
                const complete = Buffer.concat(this.fragments);
                this.fragments = [];
                this.emitMessage(complete);
            }
        }
    }

    emitMessage(payload) {
        for (const handler of this.messageHandlers) {
            void handler(payload);
        }
    }

    close() {
        try {
            this.socket?.end();
        } catch {
            // no-op
        }
    }
}

async function evaluate(client, expression, options = {}) {
    const result = await client.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: options.userGesture === true,
    });
    if (result.exceptionDetails) {
        const text = result.exceptionDetails.text || result.exceptionDetails.exception?.description || 'Runtime evaluation failed.';
        throw new Error(text);
    }
    return result.result?.value;
}

function script(fn, ...args) {
    return `(${fn.toString()})(...${JSON.stringify(args)})`;
}

function formatLogEntry(entry = {}) {
    const text = entry.text || 'Log error';
    return entry.url ? `${text} (${entry.url})` : text;
}

async function waitFor(client, expression, label, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
        const value = await evaluate(client, expression).catch(error => {
            lastError = error;
            return false;
        });
        if (value) return value;
        await wait(250);
    }
    let diagnostics = null;
    try {
        diagnostics = await evaluate(client, script(() => ({
            url: location.href,
            readyState: document.readyState,
            title: document.title,
            bodyText: document.body?.innerText?.slice(0, 300) || '',
        })));
    } catch (error) {
        diagnostics = { error: error?.message || 'diagnostics unavailable' };
    }
    const details = diagnostics ? ` ${JSON.stringify(diagnostics)}` : '';
    const last = lastError ? ` Last evaluation error: ${lastError.message || lastError}` : '';
    throw new Error(`Timed out waiting for ${label}.${details}${last}`);
}

async function clickSelector(client, selector) {
    return await evaluate(client, script(sel => {
        const element = document.querySelector(sel);
        if (!element) return false;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
        return true;
    }, selector), { userGesture: true });
}

async function clickButtonText(client, text, options = {}) {
    return await evaluate(client, script((label, rootSelector, enabledOnly) => {
        const root = rootSelector ? document.querySelector(rootSelector) : document;
        if (!root) return false;
        const buttons = [...root.querySelectorAll('button')];
        const target = buttons.find(button => {
            const clean = (button.innerText || button.textContent || '').trim();
            if (clean !== label) return false;
            if (enabledOnly && button.disabled) return false;
            return true;
        });
        if (!target) return false;
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return true;
    }, text, options.root || '', options.enabledOnly !== false), { userGesture: true });
}

async function setInputValue(client, selector, value, options = {}) {
    return await evaluate(client, script((sel, nextValue, eventName) => {
        const input = document.querySelector(sel);
        if (!input) return false;
        input.scrollIntoView({ block: 'center', inline: 'center' });
        input.focus?.();
        input.value = nextValue;
        input.dispatchEvent(new Event(eventName || 'input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }, selector, value, options.eventName || 'input'), { userGesture: true });
}

async function clickButtonInRow(client, rootSelector, rowSelector, rowText, buttonText) {
    return await evaluate(client, script((rootSel, rowSel, needle, label) => {
        const root = rootSel ? document.querySelector(rootSel) : document;
        if (!root) return false;
        const rows = [...root.querySelectorAll(rowSel)];
        const targetRow = rows.find(row => (row.innerText || row.textContent || '').includes(needle));
        if (!targetRow) return false;
        const button = [...targetRow.querySelectorAll('button')]
            .find(candidate => (candidate.innerText || candidate.textContent || '').trim() === label && !candidate.disabled);
        if (!button) return false;
        button.scrollIntoView({ block: 'center', inline: 'center' });
        button.click();
        return true;
    }, rootSelector || '', rowSelector, rowText, buttonText), { userGesture: true });
}

async function selectFirstLoredeckInLibrary(client) {
    const firstPass = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        if (!overlay) return { selected: false, mode: 'missing-library' };

        const directDeck = overlay.querySelector('.saga-loredeck-library-deck-card[data-pack-id]');
        if (directDeck) {
            directDeck.scrollIntoView({ block: 'center', inline: 'center' });
            directDeck.click();
            return {
                selected: true,
                mode: 'deck-card',
                packId: directDeck.getAttribute('data-pack-id') || '',
                text: (directDeck.innerText || directDeck.textContent || '').slice(0, 240),
            };
        }

        const stackDeck = overlay.querySelector('.saga-loredeck-library-stack-card[data-pack-id]');
        if (stackDeck) {
            stackDeck.scrollIntoView({ block: 'center', inline: 'center' });
            stackDeck.click();
            return {
                selected: true,
                mode: 'stack-card',
                packId: stackDeck.getAttribute('data-pack-id') || '',
                text: (stackDeck.innerText || stackDeck.textContent || '').slice(0, 240),
            };
        }

        const folder = overlay.querySelector('.saga-loredeck-library-inline-folder-row[data-folder-id]');
        if (folder) {
            folder.scrollIntoView({ block: 'center', inline: 'center' });
            folder.click();
            return {
                selected: false,
                mode: 'folder-opened',
                folderId: folder.getAttribute('data-folder-id') || '',
                text: (folder.innerText || folder.textContent || '').slice(0, 240),
            };
        }

        return {
            selected: false,
            mode: 'no-selectable-deck',
            text: (overlay.innerText || overlay.textContent || '').slice(0, 500),
        };
    }), { userGesture: true });

    if (firstPass.selected || firstPass.mode !== 'folder-opened') return firstPass;

    await waitFor(
        client,
        '!!document.querySelector(".saga-loredeck-library-folder-loredeck-row")',
        'Loredeck rows inside selected folder',
        10000,
    );

    const secondPass = await evaluate(client, script(() => {
        const row = document.querySelector('.saga-loredeck-library-folder-loredeck-row');
        if (!row) return { selected: false, mode: 'missing-folder-loredeck-row' };
        row.scrollIntoView({ block: 'center', inline: 'center' });
        row.click();
        return {
            selected: true,
            mode: 'folder-loredeck-row',
            text: (row.innerText || row.textContent || '').slice(0, 240),
        };
    }), { userGesture: true });

    if (secondPass.selected) {
        await waitFor(
            client,
            'document.querySelector(".saga-loredeck-library-details")?.innerText.includes("Selected Loredeck")',
            'Selected Loredeck details',
            10000,
        );
    }

    return secondPass;
}

async function captureSagaMetadata(client) {
    return await evaluate(client, script(() => {
        const ctx = window.SillyTavern?.getContext?.();
        const metadata = ctx?.chatMetadata?.saga;
        return metadata && typeof metadata === 'object'
            ? JSON.parse(JSON.stringify(metadata))
            : null;
    }));
}

async function restoreSagaMetadata(client, snapshot) {
    return await evaluate(client, script(async saved => {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx?.chatMetadata) return { ok: false, reason: 'missing-chat-metadata' };
        if (saved && typeof saved === 'object') ctx.chatMetadata.saga = saved;
        else delete ctx.chatMetadata.saga;
        try {
            if (typeof ctx.saveMetadata === 'function') {
                await ctx.saveMetadata();
            }
            return { ok: true };
        } catch (error) {
            return { ok: true, saveError: error?.message || String(error) };
        }
    }, snapshot));
}

async function captureSagaSettings(client) {
    return await evaluate(client, script(() => {
        const ctx = window.SillyTavern?.getContext?.();
        const settings = ctx?.extensionSettings?.saga;
        return settings && typeof settings === 'object'
            ? JSON.parse(JSON.stringify(settings))
            : null;
    }));
}

async function restoreSagaSettings(client, snapshot) {
    return await evaluate(client, script(async saved => {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx?.extensionSettings) return { ok: false, reason: 'missing-extension-settings' };
        if (saved && typeof saved === 'object') ctx.extensionSettings.saga = saved;
        else delete ctx.extensionSettings.saga;
        try {
            if (typeof ctx.saveSettingsDebounced === 'function') {
                ctx.saveSettingsDebounced();
            }
            return { ok: true };
        } catch (error) {
            return { ok: true, saveError: error?.message || String(error) };
        }
    }, snapshot));
}

async function clearTransientToasts(client) {
    return await evaluate(client, script(() => {
        for (const node of document.querySelectorAll('#toast-container, .toast')) node.remove();
        return true;
    })).catch(() => false);
}

async function setDrawerScroll(client, top) {
    await evaluate(client, script(value => {
        const body = document.querySelector('.saga-lore-panel-body');
        if (body) body.scrollTop = value;
    }, top));
}

async function scrollTextIntoView(client, text) {
    return await evaluate(client, script(label => {
        const candidates = [...document.querySelectorAll('.saga-runtime-drawer *')];
        const target = candidates.find(element => (element.innerText || element.textContent || '').trim() === label);
        if (!target) return false;
        target.scrollIntoView({ block: 'start', inline: 'nearest' });
        return true;
    }, text));
}

async function screenshot(client, name) {
    const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    const file = path.join(OUT_DIR, `${name}.png`);
    await fs.writeFile(file, Buffer.from(result.data, 'base64'));
    return file;
}

async function collectState(client) {
    return await evaluate(client, script(() => {
        const text = document.body?.innerText || '';
        const drawer = document.querySelector('.saga-runtime-drawer');
        const library = document.querySelector('.saga-loredeck-library-overlay');
        const health = document.querySelector('.saga-loredeck-health-center-overlay');
        const creator = document.querySelector('.saga-loredeck-creator-workbench-overlay');
        const settingsText = document.querySelector('#saga_settings')?.innerText || '';
        return {
            title: document.title,
            hasSagaCss: !!document.querySelector('#third-party_Saga-css'),
            hasSagaJs: !!document.querySelector('#third-party_Saga-js'),
            hasPanel: !!document.querySelector('#saga-lore-panel'),
            panelClass: document.querySelector('#saga-lore-panel')?.className || '',
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
            drawerText: drawer?.innerText?.slice(0, 2000) || '',
            libraryText: library?.innerText?.slice(0, 2000) || '',
            healthText: health?.innerText?.slice(0, 2000) || '',
            creatorText: creator?.innerText?.slice(0, 2000) || '',
            settingsMenuHasOldApi: /API\\s+and\\s+Model|Utility Provider|Reasoning Provider/i.test(settingsText),
            settingsMenuText: settingsText,
            bodySample: text.slice(0, 1000),
        };
    }));
}

async function clickTourNextUntilTitle(client, expectedTitle, maxClicks = 20) {
    const expected = String(expectedTitle || '').trim();
    for (let index = 0; index <= maxClicks; index += 1) {
        const title = await evaluate(client, 'document.querySelector("#saga-tour-popover .saga-tour-title")?.textContent?.trim() || ""');
        if (title === expected) return true;
        if (index === maxClicks) break;
        const clicked = await clickButtonText(client, 'Next', { root: '#saga-tour-popover' });
        if (!clicked) return false;
        await wait(500);
    }
    return false;
}

async function runGuideHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents) {
    await waitFor(client, 'window.__sagaSmokeReady === true', 'Guide smoke ready marker', 20000);
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "session"', 'Guide smoke Session tab active', 10000);

    const basicInitial = await evaluate(client, script(() => {
        const text = document.body?.innerText || '';
        const section = document.querySelector('[data-saga-tour="session.instructions.basic"]');
        if (section && !section.open) section.querySelector('summary')?.click();
        const buttonLabels = [...document.querySelectorAll('button')]
            .map(node => (node.innerText || node.textContent || '').trim())
            .filter(Boolean);
        return {
            smokeMode: window.__sagaSmokeMode || '',
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
            hasBasicTitle: text.includes('Basic Walkthrough'),
            hasBasicStart: buttonLabels.includes('Start Basic Walkthrough'),
            moduleTitles: [...document.querySelectorAll('.saga-instructions-section-title')].map(node => node.textContent?.trim()).filter(Boolean),
            stopPills: [...document.querySelectorAll('.saga-instructions-section-meta')].map(node => node.textContent || ''),
            railTabs: [...document.querySelectorAll('.saga-runtime-rail-tab')].map(node => node.getAttribute('data-tab-id') || ''),
            hiddenActionButtons: buttonLabels.filter(label => /Create Deck|In-Progress Creator Projects|Prompt Placement/.test(label)),
        };
    }));
    const expectedBasicModules = ['First Run', 'Loredecks', 'Context', 'Lorecards', 'Continue Roleplay', 'Settings'];
    if (basicInitial.smokeMode !== 'basic') findings.push('Guide harness did not open in Basic mode.');
    if (basicInitial.activeTab !== 'session') findings.push('Guide harness did not open the Basic Session tab.');
    if (!basicInitial.hasBasicTitle || !basicInitial.hasBasicStart) findings.push('Basic guide card did not render the expected title and full walkthrough action.');
    for (const label of expectedBasicModules) {
        if (!basicInitial.moduleTitles.includes(label)) findings.push(`Basic guide card is missing module: ${label}.`);
    }
    if (basicInitial.moduleTitles.length !== expectedBasicModules.length) findings.push(`Basic guide card rendered ${basicInitial.moduleTitles.length} modules instead of ${expectedBasicModules.length}.`);
    if (basicInitial.railTabs.includes('injection') || basicInitial.railTabs.includes('continuity')) findings.push('Basic rail exposed hidden Injection or Continuity tabs.');
    if (basicInitial.hiddenActionButtons.length) findings.push(`Basic guide Session surface exposed Advanced-only action buttons: ${basicInitial.hiddenActionButtons.join(', ')}.`);
    if (!basicInitial.stopPills.every(text => text.includes('guided stop'))) findings.push('Basic guide modules did not show guided stop metadata.');
    screenshots.push(await screenshot(client, 'guide-harness-01-basic-card'));

    const basicModuleStarted = await clickButtonInRow(client, '', '.saga-instructions-section-card', 'Loredecks', 'Start');
    if (!basicModuleStarted) findings.push('Basic Loredecks module Start button was not clickable.');
    await waitFor(client, '!!document.querySelector("#saga-tour-popover")', 'Basic Loredecks module popover', 10000);
    await wait(500);
    const basicModuleTour = await evaluate(client, script(() => {
        const popover = document.querySelector('#saga-tour-popover');
        const text = popover?.innerText || '';
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            highlightedTargets: document.querySelectorAll('.saga-tour-highlight').length,
            targetVisible: !!document.querySelector('[data-saga-tour="loredecks.library.launch"]'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
        };
    }));
    if (!basicModuleTour.hasPopover || basicModuleTour.title !== 'Loredecks as Source Packs') findings.push('Basic Loredecks module did not open on the expected first step.');
    if (basicModuleTour.progress !== '1 / 14') findings.push(`Basic Loredecks module progress was ${basicModuleTour.progress || 'missing'} instead of 1 / 14.`);
    if (!basicModuleTour.hasWhen || !basicModuleTour.hasExpected) findings.push('Basic Loredecks module popover did not include When to use and Expected result details.');
    if (!basicModuleTour.targetVisible || basicModuleTour.activeTab !== 'loredecks') findings.push('Basic Loredecks module did not navigate to the visible Library launch target.');
    screenshots.push(await screenshot(client, 'guide-harness-02-basic-module'));

    await clickButtonText(client, 'Next', { root: '#saga-tour-popover' });
    await waitFor(client, 'document.querySelector("#saga-tour-popover .saga-tour-title")?.textContent?.trim() === "Open Loredeck Library"', 'Basic Loredecks module second step', 10000);
    await clickButtonText(client, 'Next', { root: '#saga-tour-popover' });
    await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay") && document.querySelector("#saga-tour-popover .saga-tour-title")?.textContent?.trim() === "Library Layout"', 'Basic prepared Library Layout step', 10000);
    await wait(600);
    const basicPreparedLibrary = await evaluate(client, script(() => {
        const popover = document.querySelector('#saga-tour-popover');
        const text = popover?.innerText || '';
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            overlayOpen: !!overlay,
            targetVisible: !!document.querySelector('[data-saga-tour="loredecks.library.header"]'),
            hasDone: [...(overlay?.querySelectorAll('button') || [])].some(button => (button.innerText || button.textContent || '').trim() === 'Done'),
        };
    }));
    if (!basicPreparedLibrary.hasPopover || basicPreparedLibrary.title !== 'Library Layout') findings.push('Basic Loredecks prepared Library step did not open on the expected tour step.');
    if (basicPreparedLibrary.progress !== '3 / 14') findings.push(`Basic Loredecks prepared Library progress was ${basicPreparedLibrary.progress || 'missing'} instead of 3 / 14.`);
    if (!basicPreparedLibrary.hasWhen || !basicPreparedLibrary.hasExpected) findings.push('Basic Loredecks prepared Library popover did not include When to use and Expected result details.');
    if (!basicPreparedLibrary.overlayOpen || !basicPreparedLibrary.targetVisible || !basicPreparedLibrary.hasDone) findings.push('Basic Loredecks prepared Library step did not open the fullscreen Library with the expected header target.');
    screenshots.push(await screenshot(client, 'guide-harness-03-basic-prepared-library'));

    await clickButtonText(client, 'Close', { root: '#saga-tour-popover', enabledOnly: false });
    await waitFor(client, '!document.querySelector("#saga-tour-popover")', 'Basic Loredecks module close', 10000);
    await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false });
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-overlay")', 'Basic Library overlay close after prepared step', 10000);
    await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="session"]');
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "session"', 'Basic Session tab restored after module smoke', 10000);
    await wait(600);

    const basicStarted = await clickButtonText(client, 'Start Basic Walkthrough');
    if (!basicStarted) findings.push('Start Basic Walkthrough button was not clickable.');
    await waitFor(client, '!!document.querySelector("#saga-tour-popover")', 'Basic walkthrough popover', 10000);
    await wait(500);
    const basicTour = await evaluate(client, script(() => {
        const popover = document.querySelector('#saga-tour-popover');
        const text = popover?.innerText || '';
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            highlightedTargets: document.querySelectorAll('.saga-tour-highlight').length,
        };
    }));
    if (!basicTour.hasPopover || basicTour.title !== 'Basic Workflow Orientation') findings.push('Basic walkthrough did not open on the expected first tour step.');
    if (basicTour.progress !== '1 / 49') findings.push(`Basic walkthrough progress was ${basicTour.progress || 'missing'} instead of 1 / 49.`);
    if (!basicTour.hasWhen || !basicTour.hasExpected) findings.push('Basic walkthrough popover did not include When to use and Expected result details.');
    if (basicTour.highlightedTargets < 1) findings.push('Basic walkthrough did not highlight a runtime target.');
    screenshots.push(await screenshot(client, 'guide-harness-04-basic-tour'));
    await clickButtonText(client, 'Close', { root: '#saga-tour-popover', enabledOnly: false });
    await waitFor(client, '!document.querySelector("#saga-tour-popover")', 'Basic walkthrough close', 10000);

    const advancedUrl = smokeUrl.replace(/([?&])mode=basic\b/, '$1mode=advanced');
    await client.send('Page.navigate', { url: advancedUrl });
    await waitFor(client, script(url => location.href === url && document.readyState === 'complete', advancedUrl), 'Advanced guide harness reload', 20000);
    await waitFor(client, '!!document.querySelector("#saga-lore-panel")', 'Advanced guide runtime panel', 20000);
    await waitFor(client, 'window.__sagaSmokeReady === true && window.__sagaSmokeMode === "advanced"', 'Advanced guide smoke ready marker', 20000);
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "session"', 'Advanced guide smoke Session tab active', 10000);
    await wait(1200);

    const advancedInitial = await evaluate(client, script(() => {
        const text = document.body?.innerText || '';
        const section = document.querySelector('[data-saga-tour="session.instructions.advanced"]');
        if (section && !section.open) section.querySelector('summary')?.click();
        const buttonLabels = [...document.querySelectorAll('button')]
            .map(node => (node.innerText || node.textContent || '').trim())
            .filter(Boolean);
        return {
            smokeMode: window.__sagaSmokeMode || '',
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
            hasAdvancedTitle: text.includes('Advanced Walkthrough'),
            hasAdvancedStart: buttonLabels.includes('Start Advanced Walkthrough'),
            moduleTitles: [...document.querySelectorAll('.saga-instructions-section-title')].map(node => node.textContent?.trim()).filter(Boolean),
            railTabs: [...document.querySelectorAll('.saga-runtime-rail-tab')].map(node => node.getAttribute('data-tab-id') || ''),
            hasAdvancedControls: text.includes('Automation Mode') && text.includes('Session Metrics'),
        };
    }));
    const expectedAdvancedModules = [
        'Loredeck Library Mastery',
        'Session And Runtime Control',
        'Context Resolution',
        'Lorecard Generation And Review',
        'Injection Diagnostics',
        'Continuity Tracking',
        'Creator And Generated Lorepack Authoring',
        'Pack Health And Packages',
        'Settings And Providers',
        'Troubleshooting Routes',
    ];
    if (advancedInitial.smokeMode !== 'advanced') findings.push('Guide harness did not reload in Advanced mode.');
    if (!advancedInitial.hasAdvancedTitle || !advancedInitial.hasAdvancedStart) findings.push('Advanced guide card did not render the expected title and full walkthrough action.');
    for (const label of expectedAdvancedModules) {
        if (!advancedInitial.moduleTitles.includes(label)) findings.push(`Advanced guide card is missing task track: ${label}.`);
    }
    if (advancedInitial.moduleTitles.length !== expectedAdvancedModules.length) findings.push(`Advanced guide card rendered ${advancedInitial.moduleTitles.length} modules instead of ${expectedAdvancedModules.length}.`);
    if (!advancedInitial.railTabs.includes('injection') || !advancedInitial.railTabs.includes('continuity')) findings.push('Advanced rail did not expose Injection and Continuity tabs.');
    if (!advancedInitial.hasAdvancedControls) findings.push('Advanced Session surface did not show expected runtime controls.');
    screenshots.push(await screenshot(client, 'guide-harness-05-advanced-card'));

    const advancedModuleStarted = await clickButtonInRow(client, '', '.saga-instructions-section-card', 'Injection Diagnostics', 'Start');
    if (!advancedModuleStarted) findings.push('Advanced Injection Diagnostics module Start button was not clickable.');
    await waitFor(client, '!!document.querySelector("#saga-tour-popover")', 'Advanced Injection module popover', 10000);
    await wait(500);
    const advancedModuleTour = await evaluate(client, script(() => {
        const popover = document.querySelector('#saga-tour-popover');
        const text = popover?.innerText || '';
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            targetVisible: !!document.querySelector('[data-saga-tour="injection.toggles"]'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
        };
    }));
    if (!advancedModuleTour.hasPopover || advancedModuleTour.title !== 'Injection Overview') findings.push('Advanced Injection Diagnostics module did not open on the expected first step.');
    if (advancedModuleTour.progress !== '1 / 15') findings.push(`Advanced Injection Diagnostics module progress was ${advancedModuleTour.progress || 'missing'} instead of 1 / 15.`);
    if (!advancedModuleTour.hasWhen || !advancedModuleTour.hasExpected) findings.push('Advanced Injection Diagnostics module popover did not include When to use and Expected result details.');
    if (!advancedModuleTour.targetVisible || advancedModuleTour.activeTab !== 'injection') findings.push('Advanced Injection Diagnostics module did not navigate to the visible Injection target.');
    screenshots.push(await screenshot(client, 'guide-harness-06-advanced-module'));
    await clickButtonText(client, 'Close', { root: '#saga-tour-popover', enabledOnly: false });
    await waitFor(client, '!document.querySelector("#saga-tour-popover")', 'Advanced Injection module close', 10000);
    await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="session"]');
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "session"', 'Advanced Session tab restored after module smoke', 10000);
    await wait(600);

    const advancedCreatorStarted = await clickButtonInRow(client, '', '.saga-instructions-section-card', 'Creator And Generated Lorepack Authoring', 'Start');
    if (!advancedCreatorStarted) findings.push('Advanced Creator module Start button was not clickable.');
    await waitFor(client, '!!document.querySelector("#saga-tour-popover")', 'Advanced Creator module popover', 10000);
    const reachedCreatorFallback = await clickTourNextUntilTitle(client, 'Creator Draft Review', 14);
    if (!reachedCreatorFallback) findings.push('Advanced Creator module did not reach the no-project Creator Draft Review step.');
    await wait(700);
    const advancedCreatorFallback = await evaluate(client, script(() => {
        const popover = document.querySelector('#saga-tour-popover');
        const text = popover?.innerText || '';
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasPreparation: text.includes('Preparation:'),
            hasNoProjectMessage: text.includes('Loredeck Creator is open, but there is no in-progress Creator project to resume yet.'),
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            creatorOpen: !!document.querySelector('.saga-loredeck-creator-workbench-overlay'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
        };
    }));
    if (!advancedCreatorFallback.hasPopover || advancedCreatorFallback.title !== 'Creator Draft Review') findings.push('Advanced Creator fallback did not land on the expected tour step.');
    if (advancedCreatorFallback.progress !== '11 / 19') findings.push(`Advanced Creator fallback progress was ${advancedCreatorFallback.progress || 'missing'} instead of 11 / 19.`);
    if (!advancedCreatorFallback.hasPreparation || !advancedCreatorFallback.hasNoProjectMessage) findings.push('Advanced Creator fallback did not show the missing in-progress project Preparation message.');
    if (!advancedCreatorFallback.hasWhen || !advancedCreatorFallback.hasExpected) findings.push('Advanced Creator fallback popover did not include When to use and Expected result details.');
    if (!advancedCreatorFallback.creatorOpen || advancedCreatorFallback.activeTab !== 'loredecks') findings.push('Advanced Creator fallback did not keep the Creator workbench open on the Loredecks tab.');
    screenshots.push(await screenshot(client, 'guide-harness-07-advanced-creator-empty-project'));
    await clickButtonText(client, 'Close', { root: '#saga-tour-popover', enabledOnly: false });
    await waitFor(client, '!document.querySelector("#saga-tour-popover")', 'Advanced Creator fallback close', 10000);
    await clickButtonText(client, 'Close', { root: '.saga-loredeck-creator-workbench-overlay', enabledOnly: false });
    await waitFor(client, '!document.querySelector(".saga-loredeck-creator-workbench-overlay")', 'Advanced Creator workbench close after fallback smoke', 10000);
    await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="session"]');
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "session"', 'Advanced Session tab restored after Creator fallback smoke', 10000);
    await wait(600);

    const advancedStarted = await clickButtonText(client, 'Start Advanced Walkthrough');
    if (!advancedStarted) findings.push('Start Advanced Walkthrough button was not clickable.');
    await waitFor(client, '!!document.querySelector("#saga-tour-popover")', 'Advanced walkthrough popover', 10000);
    await wait(500);
    const advancedTour = await evaluate(client, script(() => {
        const popover = document.querySelector('#saga-tour-popover');
        const text = popover?.innerText || '';
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            highlightedTargets: document.querySelectorAll('.saga-tour-highlight').length,
            targetVisible: !!document.querySelector('[data-saga-tour="loredecks.library.launch"]'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
        };
    }));
    if (!advancedTour.hasPopover || advancedTour.title !== 'Library Overview') findings.push('Advanced walkthrough did not open on the expected first tour step.');
    if (advancedTour.progress !== '1 / 155') findings.push(`Advanced walkthrough progress was ${advancedTour.progress || 'missing'} instead of 1 / 155.`);
    if (!advancedTour.hasWhen || !advancedTour.hasExpected) findings.push('Advanced walkthrough popover did not include When to use and Expected result details.');
    if (!advancedTour.targetVisible || advancedTour.activeTab !== 'loredecks') findings.push('Advanced walkthrough did not navigate to the visible Loredeck Library launch target.');
    screenshots.push(await screenshot(client, 'guide-harness-08-advanced-tour'));

    const errors = client.events
        .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
        .map(event => formatLogEntry(event.params.entry));
    console.log(JSON.stringify({
        ok: findings.length === 0 && errors.length === 0,
        target: SMOKE_TARGET,
        url: smokeUrl,
        screenshots,
        findings,
        errors,
        dialogEvents,
        basicInitial,
        basicModuleTour,
        basicPreparedLibrary,
        basicTour,
        advancedInitial,
        advancedModuleTour,
        advancedCreatorFallback,
        advancedTour,
    }, null, 2));
}

async function main() {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const chrome = await findChrome();
    const port = await getFreePort();
    const userDataDir = path.join(ROOT, '.tmp', `saga-live-smoke-${Date.now()}`);
    await fs.mkdir(userDataDir, { recursive: true });
    const harness = REPO_LOCAL_HARNESS_TARGETS.has(SMOKE_TARGET)
        ? await startVisualSmokeServer(SMOKE_TARGET)
        : null;
    const smokeUrl = harness?.url || ST_URL;

    const headless = process.env.SAGA_SMOKE_HEADLESS !== '0';
    const chromeArgs = [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-extensions',
        '--remote-allow-origins=*',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
        'about:blank',
    ];
    if (headless) {
        chromeArgs.unshift(
            '--headless=new',
            '--disable-gpu',
            '--disable-gpu-sandbox',
            '--disable-gpu-compositing',
            '--disable-accelerated-2d-canvas',
            '--disable-accelerated-video-decode',
            '--disable-dev-shm-usage',
            '--use-gl=swiftshader',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--disable-features=VizDisplayCompositor',
        );
    } else {
        chromeArgs.unshift('--new-window');
    }

    const proc = spawn(chrome, chromeArgs, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', chunk => {
        stderr += chunk.toString();
    });

    const screenshots = [];
    const findings = [];
    const dialogEvents = [];
    const optionalSteps = {};
    let sagaMetadataSnapshot = null;
    let sagaMetadataRestored = false;
    let sagaSettingsSnapshot = null;
    let sagaSettingsRestored = false;
    let client;
    try {
        const { browserWsUrl, pageWsUrl, pageTargetId } = await waitForDevtools(port);
        await wait(1000);
        client = new CdpClient(browserWsUrl);
        await client.connect();
        const attached = await client.send('Target.attachToTarget', { targetId: pageTargetId, flatten: true });
        client.sessionId = attached.sessionId;
        await client.send('Page.enable');
        await client.send('Runtime.enable');
        await client.send('Log.enable');

        client.on('Page.javascriptDialogOpening', payload => {
            dialogEvents.push(payload.params || {});
            void client.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
        });

        await client.send('Page.navigate', { url: smokeUrl });
        await waitFor(client, 'document.readyState === "complete"', REPO_LOCAL_HARNESS_TARGETS.has(SMOKE_TARGET) ? 'Repo-local smoke harness load' : 'SillyTavern load', 20000);
        await waitFor(client, '!!document.querySelector("#saga-lore-panel")', 'Saga runtime panel', 20000);
        await wait(2500);

        if (SMOKE_TARGET === 'guide-harness') {
            await runGuideHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents);
            return;
        }

        if (SMOKE_TARGET === 'context-harness') {
            await waitFor(client, 'window.__sagaSmokeReady === true', 'Context smoke ready marker', 20000);
            await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "context"', 'Context tab active', 10000);
            screenshots.push(await screenshot(client, 'context-harness-01-proposal-review'));
            const firstState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                const overlay = document.querySelector('#saga-context-proposal-review');
                return {
                    smokeMeta: window.__sagaContextSmoke || null,
                    activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
                    hasRuntimeContext: text.includes('Runtime Context'),
                    hasBrowseContext: text.includes('Browse Context'),
                    hasReviewProposals: text.includes('Review Proposals'),
                    hasReasonerProposals: text.includes('Reasoner Proposals'),
                    hasLastResolver: text.includes('Last Resolver Check'),
                    hasLastAutomation: text.includes('Last Automation Check'),
                    hasAdvancedBrief: text.includes('Advanced Context Brief'),
                    hasLockedContext: /Manual lock|Locked/i.test(text),
                    overlayOpen: !!overlay,
                    overlayTitle: overlay?.querySelector('.saga-lore-workbench-title')?.textContent || '',
                    overlayHasApply: overlay?.innerText?.includes('Apply') || false,
                    overlayHasDismiss: overlay?.innerText?.includes('Dismiss') || false,
                    proposalRows: document.querySelectorAll('.saga-context-proposal-review-row').length,
                    contextRows: document.querySelectorAll('.saga-loredeck-context-row').length,
                };
            }));
            if (firstState.activeTab !== 'context') findings.push('Context harness did not open with the Context tab active.');
            if (!firstState.hasRuntimeContext) findings.push('Context harness did not render Runtime Context command center copy.');
            if (!firstState.hasBrowseContext) findings.push('Context harness did not render Browse Context action.');
            if (!firstState.hasReviewProposals) findings.push('Context harness did not render Review Proposals action.');
            if (!firstState.hasReasonerProposals) findings.push('Context harness did not render Reasoner Proposals panel.');
            if (!firstState.hasLastResolver) findings.push('Context harness did not render Last Resolver Check.');
            if (!firstState.hasLastAutomation) findings.push('Context harness did not render Last Automation Check.');
            if (!firstState.hasAdvancedBrief) findings.push('Context harness did not render Advanced Context Brief.');
            if (!firstState.hasLockedContext) findings.push('Context harness did not expose locked Context state.');
            if (!firstState.overlayOpen || firstState.overlayTitle !== 'Context Proposal Review') findings.push('Context proposal review overlay did not open from smoke fixture.');
            if (firstState.proposalRows < 1) findings.push('Context proposal review overlay did not render proposal rows.');
            if (firstState.contextRows < 1) findings.push('Context harness did not render loaded Loredeck Context rows.');

            await clickButtonText(client, 'Apply', { root: '#saga-context-proposal-review' });
            await wait(800);
            const applyState = await evaluate(client, script(() => ({
                overlayClosed: !document.querySelector('#saga-context-proposal-review'),
                proposalCount: window.__sagaSmokeContext?.chatMetadata?.saga?.lorePanel?.contextResolutionProposals?.length ?? null,
                context: window.__sagaSmokeContext?.chatMetadata?.saga?.loredeckContexts?.['smoke-arlong-park'] || null,
            })));
            if (!applyState.overlayClosed) findings.push('Applying the seeded Context proposal did not close the proposal review overlay.');
            if (applyState.proposalCount !== 0) findings.push('Applying the seeded Context proposal did not clear pending proposals.');
            if (applyState.context?.source !== 'model') findings.push('Applying the seeded Context proposal did not update the Loredeck Context source.');

            const browseClicked = await clickButtonText(client, 'Browse Context');
            if (!browseClicked) findings.push('Browse Context button was not clickable in the Context harness.');
            await waitFor(client, '!!document.querySelector("#saga-context-workbench")', 'Context Workbench overlay', 10000);
            await wait(800);
            screenshots.push(await screenshot(client, 'context-harness-02-workbench'));
            const workbenchState = await evaluate(client, script(() => {
                const overlay = document.querySelector('#saga-context-workbench');
                const text = overlay?.innerText || '';
                return {
                    open: !!overlay,
                    hasTimeline: text.includes('Timeline'),
                    hasAliases: text.includes('Aliases'),
                    hasValidation: text.includes('Validation'),
                    hasManualLock: /Manual lock|Auto allowed/i.test(text),
                    hasPackTitle: text.includes('Smoke Test: Arlong Park'),
                };
            }));
            if (!workbenchState.open) findings.push('Context Workbench did not open.');
            if (!workbenchState.hasTimeline || !workbenchState.hasAliases || !workbenchState.hasValidation) findings.push('Context Workbench tabs did not render.');
            if (!workbenchState.hasManualLock) findings.push('Context Workbench did not expose lock state.');
            if (!workbenchState.hasPackTitle) findings.push('Context Workbench did not select the smoke Loredeck.');

            const errors = client.events
                .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                .map(event => formatLogEntry(event.params.entry));
            console.log(JSON.stringify({
                ok: findings.length === 0 && errors.length === 0,
                target: SMOKE_TARGET,
                url: smokeUrl,
                screenshots,
                findings,
                errors,
                dialogEvents,
                firstState,
                applyState,
                workbenchState,
            }, null, 2));
            return;
        }

        if (LIVE_CONTEXT_METADATA_TARGETS.has(SMOKE_TARGET)) {
            if (SMOKE_TARGET === LIVE_CONTEXT_REASONER_TARGET && !ALLOW_PROVIDER_CALLS) {
                console.log(JSON.stringify({
                    ok: false,
                    target: SMOKE_TARGET,
                    url: smokeUrl,
                    skipped: true,
                    findings: ['Live Context Reasoner smoke is opt-in. Set SAGA_ALLOW_PROVIDER_CALLS=1 to spend one bounded Reasoning Provider call.'],
                    errors: [],
                    dialogEvents,
                }, null, 2));
                return;
            }
            const loadedContextScreenshotPrefix = SMOKE_TARGET === 'live-context-loaded-narrow'
                ? 'live-context-loaded-narrow'
                : (SMOKE_TARGET === LIVE_CONTEXT_REASONER_TARGET ? 'live-context-reasoner' : 'live-context-loaded');
            sagaMetadataSnapshot = await captureSagaMetadata(client);
            if (SMOKE_TARGET === LIVE_CONTEXT_REASONER_TARGET) {
                sagaSettingsSnapshot = await captureSagaSettings(client);
            }

            await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="loredecks"]');
            await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Loredecks")', 'Live Loredecks drawer', 10000);
            await wait(900);
            const libraryOpened = await clickButtonText(client, 'Open Loredeck Library');
            if (!libraryOpened) findings.push('Live loaded Context smoke could not open the Loredeck Library.');
            await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay")', 'Live Loredeck Library overlay', 10000);
            await wait(900);

            await setInputValue(client, '.saga-loredeck-library-overlay .saga-loredeck-library-search', 'Half-Blood Prince', { eventName: 'change' });
            await waitFor(client, script(packId => !!document.querySelector(`.saga-loredeck-library-deck-card[data-pack-id="${packId}"]`), LIVE_CONTEXT_LOADED_PACK_ID), 'Live HP Year 6 Library card', 10000);
            const selectedDeck = await evaluate(client, script(packId => {
                const card = document.querySelector(`.saga-loredeck-library-deck-card[data-pack-id="${packId}"]`);
                if (!card) return false;
                card.scrollIntoView({ block: 'center', inline: 'center' });
                card.click();
                return true;
            }, LIVE_CONTEXT_LOADED_PACK_ID), { userGesture: true });
            if (!selectedDeck) findings.push('Live loaded Context smoke could not select the HP Year 6 Loredeck card.');
            await wait(700);

            let stackAddClicked = await clickButtonText(client, 'Add to Stack >', { root: '.saga-loredeck-library-overlay' });
            if (!stackAddClicked) {
                stackAddClicked = await clickButtonText(client, 'Add to Stack', { root: '.saga-loredeck-library-overlay' });
            }
            if (!stackAddClicked) findings.push('Live loaded Context smoke could not add HP Year 6 to the stack.');
            await wait(1200);

            const stackState = await evaluate(client, script(packId => {
                const ctx = window.SillyTavern?.getContext?.();
                const metadata = ctx?.chatMetadata?.saga || {};
                const stack = Array.isArray(metadata.loredeckStack) ? metadata.loredeckStack : [];
                const overlayText = document.querySelector('.saga-loredeck-library-overlay')?.innerText || '';
                return {
                    stack,
                    hasTargetInMetadata: stack.some(item => item?.packId === packId && item.enabled !== false),
                    hasTargetInOverlay: overlayText.includes('Harry Potter Year 6: Half-Blood Prince') && overlayText.includes('Active Stack'),
                    overlayText: overlayText.slice(0, 1600),
                };
            }, LIVE_CONTEXT_LOADED_PACK_ID));
            if (!stackState.hasTargetInMetadata) findings.push('HP Year 6 was not present as an enabled Loredeck stack item after Add to Stack.');

            await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false });
            await wait(800);
            await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="context"]');
            await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "context"', 'Live loaded Context tab active', 10000);
            await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Runtime Context")', 'Live loaded Runtime Context command center', 10000);
            await wait(1000);
            await clearTransientToasts(client);
            await wait(200);
            screenshots.push(await screenshot(client, `${loadedContextScreenshotPrefix}-01-context-tab`));

            const loadedContextState = await evaluate(client, script(packId => {
                const text = document.body?.innerText || '';
                const rows = [...document.querySelectorAll('.saga-loredeck-context-row')];
                const rowText = rows.map(row => row.innerText || '').join('\n');
                return {
                    loadedChip: /1 loaded|[2-9] loaded/.test(text),
                    rowCount: rows.length,
                    hasTargetRow: rowText.includes('Harry Potter Year 6: Half-Blood Prince') || rowText.includes(packId),
                    hasBrowseContext: text.includes('Browse Context'),
                    hasAdvancedBrief: text.includes('Advanced Context Brief'),
                    drawerText: document.querySelector('.saga-runtime-drawer')?.innerText?.slice(0, 1800) || '',
                };
            }, LIVE_CONTEXT_LOADED_PACK_ID));
            if (!loadedContextState.loadedChip) findings.push('Live loaded Context tab did not show a non-empty loaded-Loredeck count.');
            if (!loadedContextState.hasTargetRow) findings.push('Live loaded Context tab did not render the HP Year 6 loaded Context row.');

            if (SMOKE_TARGET === LIVE_CONTEXT_REASONER_TARGET) {
                const seedState = await evaluate(client, script(async packId => {
                    const ctx = window.SillyTavern?.getContext?.();
                    if (!ctx?.chatMetadata || !ctx?.extensionSettings) return { ok: false, reason: 'missing-st-context' };
                    const settings = ctx.extensionSettings.saga ||= {};
                    settings.contextLocalApplyMinConfidence = 1;
                    settings.contextReasonerProposalMinConfidence = 0.5;
                    settings.experienceMode = 'advanced';
                    const state = ctx.chatMetadata.saga ||= {};
                    state.contextBrief = {
                        schemaVersion: 1,
                        source: 'live_reasoner_smoke',
                        summary: 'Harry Potter Year 6 after the winter holiday break, with romantic tension about to become public and school travel instruction not yet underway.',
                        signals: {
                            fandom: 'Harry Potter',
                            scope: 'Year 6: Half-Blood Prince',
                            arc: 'Year 6: Half-Blood Prince',
                            phase: 'mid-school-year',
                            positionPhrases: [
                                'after the winter holiday break in sixth year',
                                'Rons public romance is about to start',
                                'school travel instruction has not started yet',
                            ],
                            eventLabels: [
                                'winter holiday return',
                                'upcoming relationship drama',
                                'upcoming travel lessons',
                            ],
                        },
                        evidence: [
                            {
                                quote: 'After the winter break in sixth year, before the dating drama becomes public and before the school begins transport lessons.',
                                source: 'live reasoner smoke seed',
                            },
                        ],
                        uncertainty: {
                            level: 'medium',
                            notes: ['Loose user phrasing intentionally avoids exact anchor titles so bounded Reasoner selection is exercised.'],
                        },
                        status: {
                            state: 'detected',
                            source: 'live_reasoner_smoke',
                            updatedAt: Date.now(),
                            message: 'Seeded by live Context Reasoner smoke.',
                        },
                        updatedAt: Date.now(),
                    };
                    state.loreContext = {
                        sceneDate: '',
                        canonBoundary: '',
                        branchId: 'main',
                        timeTravelMode: 'none',
                        source: 'live_reasoner_smoke',
                        confidence: 0.45,
                    };
                    state.loredeckContexts ||= {};
                    delete state.loredeckContexts[packId];
                    const panel = state.lorePanel ||= {};
                    panel.contextResolutionProposals = [];
                    panel.contextResolutionProposalMeta = null;
                    panel.contextResolutionAudit = null;
                    panel.contextResolutionCache = null;
                    try {
                        if (typeof ctx.saveMetadata === 'function') await ctx.saveMetadata();
                        if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
                    } catch (error) {
                        return { ok: true, saveError: error?.message || String(error) };
                    }
                    return { ok: true, localConfidence: settings.contextLocalApplyMinConfidence };
                }, LIVE_CONTEXT_LOADED_PACK_ID));
                if (!seedState?.ok) findings.push(`Live Context Reasoner smoke could not seed temporary Context Brief: ${seedState?.reason || 'unknown'}.`);
                await wait(500);

                const scrollBeforeReasoner = await evaluate(client, 'document.querySelector(".saga-lore-panel-body")?.scrollTop || 0');
                const reasonerClicked = await clickButtonText(client, 'Ask Reasoner');
                if (!reasonerClicked) findings.push('Live Context Reasoner smoke could not click Ask Reasoner.');
                await waitFor(client, script(packId => {
                    const ctx = window.SillyTavern?.getContext?.();
                    const state = ctx?.chatMetadata?.saga || {};
                    const panel = state.lorePanel || {};
                    const toastText = document.body?.innerText || '';
                    return !!(
                        (Array.isArray(panel.contextResolutionProposals) && panel.contextResolutionProposals.length)
                        || panel.contextResolutionAudit?.status
                        || toastText.includes('Reasoning Provider is not ready')
                        || toastText.includes('Reasoner fallback did not find')
                        || state.loredeckContexts?.[packId]?.source
                    );
                }, LIVE_CONTEXT_LOADED_PACK_ID), 'Live Context Reasoner result', Number(process.env.SAGA_PROVIDER_SMOKE_TIMEOUT_MS) || 180000);
                await wait(1200);
                await clearTransientToasts(client);
                await wait(200);
                screenshots.push(await screenshot(client, 'live-context-reasoner-01-result'));

                const reasonerState = await evaluate(client, script(packId => {
                    const ctx = window.SillyTavern?.getContext?.();
                    const state = ctx?.chatMetadata?.saga || {};
                    const panel = state.lorePanel || {};
                    const proposals = Array.isArray(panel.contextResolutionProposals) ? panel.contextResolutionProposals : [];
                    const audit = panel.contextResolutionAudit || null;
                    const rowContext = state.loredeckContexts?.[packId] || null;
                    const text = document.querySelector('.saga-runtime-drawer')?.innerText || document.body?.innerText || '';
                    return {
                        proposals,
                        proposalCount: proposals.length,
                        audit,
                        rowContext,
                        providerNotReady: text.includes('Reasoning Provider is not ready'),
                        fallbackMiss: text.includes('Reasoner fallback did not find'),
                        hasResolverCheck: text.includes('Last Resolver Check'),
                        hasReasonerProposalPanel: text.includes('Reasoner Proposals'),
                        drawerText: text.slice(0, 2200),
                    };
                }, LIVE_CONTEXT_LOADED_PACK_ID));
                if (reasonerState.providerNotReady) findings.push('Reasoning Provider was not ready for live Context Reasoner smoke.');
                if (reasonerState.rowContext?.source === 'local_alias') findings.push('Live Context Reasoner smoke resolved locally instead of exercising the provider.');
                if (reasonerState.audit?.status === 'resolved_locally') findings.push('Live Context Reasoner smoke stopped at local resolution instead of exercising the provider.');
                if (!reasonerState.hasResolverCheck) findings.push('Live Context Reasoner smoke did not render Last Resolver Check after the provider path.');
                if (!reasonerState.proposalCount) findings.push('Live Context Reasoner smoke did not produce a reviewable bounded proposal.');

                let reasonerProposalState = null;
                if (reasonerState.proposalCount > 0) {
                    const proposalClicked = await clickButtonText(client, 'Review Proposals');
                    if (!proposalClicked) findings.push('Live Context Reasoner Review Proposals button was not clickable.');
                    await waitFor(client, '!!document.querySelector("#saga-context-proposal-review")', 'Live Context Reasoner proposal review overlay', 10000);
                    await wait(1000);
                    screenshots.push(await screenshot(client, 'live-context-reasoner-02-proposals'));
                    reasonerProposalState = await evaluate(client, script(() => {
                        const overlay = document.querySelector('#saga-context-proposal-review');
                        const text = overlay?.innerText || '';
                        return {
                            open: !!overlay,
                            rowCount: overlay?.querySelectorAll('.saga-context-proposal-review-row').length || 0,
                            hasApply: text.includes('Apply'),
                            hasDismiss: text.includes('Dismiss'),
                            text: text.slice(0, 1600),
                        };
                    }));
                    if (!reasonerProposalState.open || reasonerProposalState.rowCount < 1) findings.push('Live Context Reasoner proposal review did not render proposal rows.');
                    await clickButtonText(client, 'Close', { root: '#saga-context-proposal-review', enabledOnly: false });
                    await wait(500);
                }

                const scrollAfterReasoner = await evaluate(client, 'document.querySelector(".saga-lore-panel-body")?.scrollTop || 0');
                const restoreSettingsState = await restoreSagaSettings(client, sagaSettingsSnapshot);
                sagaSettingsRestored = true;
                const restoreState = await restoreSagaMetadata(client, sagaMetadataSnapshot);
                sagaMetadataRestored = true;
                const errors = client.events
                    .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                    .map(event => formatLogEntry(event.params.entry));
                console.log(JSON.stringify({
                    ok: findings.length === 0 && errors.length === 0,
                    target: SMOKE_TARGET,
                    url: smokeUrl,
                    packId: LIVE_CONTEXT_LOADED_PACK_ID,
                    screenshots,
                    findings,
                    errors,
                    dialogEvents,
                    stackState,
                    loadedContextState,
                    seedState,
                    reasonerState,
                    reasonerProposalState,
                    scrollBeforeReasoner,
                    scrollAfterReasoner,
                    restoreSettingsState,
                    restoreState,
                }, null, 2));
                return;
            }

            const browseClicked = await clickButtonText(client, 'Browse Context');
            if (!browseClicked) findings.push('Live loaded Context Browse Context button was not clickable.');
            await waitFor(client, '!!document.querySelector("#saga-context-workbench")', 'Live loaded Context Workbench overlay', 10000);
            await wait(1000);
            await clearTransientToasts(client);
            await wait(200);
            screenshots.push(await screenshot(client, `${loadedContextScreenshotPrefix}-02-workbench`));

            const workbenchState = await evaluate(client, script(packTitle => {
                const overlay = document.querySelector('#saga-context-workbench');
                const text = overlay?.innerText || '';
                return {
                    open: !!overlay,
                    hasPackTitle: text.includes(packTitle),
                    hasStoryPositionPicker: text.includes('Choose Story Position'),
                    hasOldBrowseStoryWaypoints: text.includes('Browse Story Waypoints'),
                    hasOldSelectFromTimeline: text.includes('Select From Timeline'),
                    oldWaypointRows: overlay?.querySelectorAll('.saga-context-workbench-waypoint-row').length || 0,
                    oldWaypointTargets: overlay?.querySelectorAll('[data-tour-target="context.workbench.waypoints"]').length || 0,
                    hasTimeline: text.includes('Timeline'),
                    hasAliases: text.includes('Aliases'),
                    hasValidation: text.includes('Validation'),
                    hasManualLock: /Manual lock|Auto allowed/i.test(text),
                    text: text.slice(0, 1800),
                };
            }, LIVE_CONTEXT_LOADED_PACK_TITLE));
            if (!workbenchState.open) findings.push('Live loaded Context Workbench did not open.');
            if (!workbenchState.hasPackTitle) findings.push('Live loaded Context Workbench did not select HP Year 6.');
            if (!workbenchState.hasStoryPositionPicker) findings.push('Live loaded Context Workbench did not render the story-position picker.');
            if (workbenchState.hasOldBrowseStoryWaypoints || workbenchState.hasOldSelectFromTimeline) findings.push('Live loaded Context Workbench still rendered a retired picker label.');
            if (workbenchState.oldWaypointRows || workbenchState.oldWaypointTargets) findings.push('Live loaded Context Workbench still rendered retired waypoint picker selectors or targets.');
            if (!workbenchState.hasTimeline || !workbenchState.hasAliases || !workbenchState.hasValidation) findings.push('Live loaded Context Workbench tabs did not render.');

            const storyPositionSearch = '#saga-context-workbench .saga-context-workbench-story-position-picker input[type="search"]';
            const aliasSearch = await setInputValue(client, storyPositionSearch, 'Ron dates the blonde girl', { eventName: 'change' });
            await wait(700);
            const aliasState = await evaluate(client, script(() => {
                const overlay = document.querySelector('#saga-context-workbench');
                const text = overlay?.innerText || '';
                return {
                    searched: true,
                    hasRonLavender: text.includes('Ron Lavender Start'),
                    rowCount: overlay?.querySelectorAll('.saga-context-workbench-story-position-row').length || 0,
                    oldRowCount: overlay?.querySelectorAll('.saga-context-workbench-waypoint-row').length || 0,
                    text: text.slice(0, 1400),
                };
            }));
            if (!aliasSearch) findings.push('Live loaded Context Workbench alias search input was not available.');
            if (!aliasState.hasRonLavender) findings.push('Live loaded Context Browser did not resolve the Ron/Lavender alias in visible results.');
            if (aliasState.oldRowCount) findings.push('Live loaded Context Workbench alias search rendered retired waypoint rows.');

            const afterSearch = await setInputValue(client, storyPositionSearch, 'Post Christmas Return', { eventName: 'change' });
            await wait(700);
            const afterClicked = await clickButtonInRow(
                client,
                '#saga-context-workbench',
                '.saga-context-workbench-story-position-row',
                'Post Christmas Return',
                'After',
            );
            if (!afterSearch) findings.push('Live loaded Context Workbench lower-bound search input was not available.');
            if (!afterClicked) findings.push('Live loaded Context Browser could not apply Post Christmas Return as the After bound.');
            await wait(800);

            const beforeSearch = await setInputValue(client, storyPositionSearch, 'Apparition Lessons Begin', { eventName: 'change' });
            await wait(700);
            const beforeClicked = await clickButtonInRow(
                client,
                '#saga-context-workbench',
                '.saga-context-workbench-story-position-row',
                'Apparition Lessons Begin',
                'Before',
            );
            if (!beforeSearch) findings.push('Live loaded Context Workbench upper-bound search input was not available.');
            if (!beforeClicked) findings.push('Live loaded Context Browser could not apply Apparition Lessons Begin as the Before bound.');
            await wait(900);

            const afterBeforeState = await evaluate(client, script(packId => {
                const ctx = window.SillyTavern?.getContext?.();
                const state = ctx?.chatMetadata?.saga || {};
                const context = state.loredeckContexts?.[packId] || null;
                const drawerText = document.querySelector('.saga-runtime-drawer')?.innerText || '';
                return {
                    context,
                    hasFrom: context?.anchorFrom === 'hp.y6.post_christmas_return',
                    hasTo: context?.anchorTo === 'hp.y6.apparition_lessons_begin',
                    locked: context?.manualLock === true,
                    source: context?.source || '',
                    drawerMentionsWindow: drawerText.includes('hp.y6.post_christmas_return') || drawerText.includes('Post Christmas Return'),
                };
            }, LIVE_CONTEXT_LOADED_PACK_ID));
            if (!afterBeforeState.hasFrom || !afterBeforeState.hasTo) findings.push('Live loaded Context after/before window did not persist the expected anchor bounds.');
            if (!afterBeforeState.locked || afterBeforeState.source !== 'manual') findings.push('Live loaded Context Browser did not save a manual locked Context.');

            const seededProposal = await evaluate(client, script(packId => {
                const ctx = window.SillyTavern?.getContext?.();
                if (!ctx?.chatMetadata) return 0;
                if (!ctx.chatMetadata.saga || typeof ctx.chatMetadata.saga !== 'object') ctx.chatMetadata.saga = {};
                const state = ctx.chatMetadata.saga;
                const panel = state.lorePanel ||= {};
                panel.contextResolutionProposals = [{
                    packId,
                    candidateId: 'anchor:hp.y6.ron_lavender_start',
                    candidateType: 'anchor',
                    label: 'Ron Lavender Start',
                    summary: 'Synthetic live smoke proposal for populated Context proposal review.',
                    confidence: 0.88,
                    patch: {
                        contextType: 'anchor',
                        anchorId: 'hp.y6.ron_lavender_start',
                        anchorFrom: '',
                        anchorTo: '',
                        label: 'Ron Lavender Start',
                        arc: 'Year 6: Half-Blood Prince',
                        source: 'model',
                        confidence: 0.88,
                        manualLock: false,
                    },
                }];
                panel.contextResolutionProposalMeta = {
                    source: 'manual_reasoner',
                    createdAt: Date.now(),
                    smoke: true,
                };
                return panel.contextResolutionProposals.length;
            }, LIVE_CONTEXT_LOADED_PACK_ID));
            if (seededProposal !== 1) findings.push('Live loaded Context smoke could not seed a populated proposal review fixture.');

            await clickButtonText(client, 'Done', { root: '#saga-context-workbench', enabledOnly: false });
            await wait(700);
            const proposalClicked = await clickButtonText(client, 'Review Proposals');
            if (!proposalClicked) findings.push('Live loaded Context Review Proposals button was not clickable after seeding.');
            await waitFor(client, '!!document.querySelector("#saga-context-proposal-review")', 'Live loaded Context Proposal Review overlay', 10000);
            await wait(1800);
            await clearTransientToasts(client);
            await wait(200);
            screenshots.push(await screenshot(client, `${loadedContextScreenshotPrefix}-03-proposals`));
            const proposalState = await evaluate(client, script(() => {
                const overlay = document.querySelector('#saga-context-proposal-review');
                const text = overlay?.innerText || '';
                return {
                    open: !!overlay,
                    rowCount: overlay?.querySelectorAll('.saga-context-proposal-review-row').length || 0,
                    hasTitle: text.includes('Context Proposal Review'),
                    hasRonLavender: text.includes('Ron Lavender Start'),
                    hasApply: text.includes('Apply'),
                    hasDismiss: text.includes('Dismiss'),
                    text: text.slice(0, 1400),
                };
            }));
            if (!proposalState.open || proposalState.rowCount < 1) findings.push('Live loaded Context Proposal Review did not render a populated proposal row.');
            if (!proposalState.hasRonLavender || !proposalState.hasApply || !proposalState.hasDismiss) findings.push('Live loaded Context Proposal Review row missed expected proposal actions/content.');
            await clickButtonText(client, 'Close', { root: '#saga-context-proposal-review', enabledOnly: false });
            await wait(500);

            const restoreState = await restoreSagaMetadata(client, sagaMetadataSnapshot);
            sagaMetadataRestored = true;

            const errors = client.events
                .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                .map(event => formatLogEntry(event.params.entry));
            console.log(JSON.stringify({
                ok: findings.length === 0 && errors.length === 0,
                target: SMOKE_TARGET,
                url: smokeUrl,
                packId: LIVE_CONTEXT_LOADED_PACK_ID,
                screenshots,
                findings,
                errors,
                dialogEvents,
                stackState,
                loadedContextState,
                workbenchState,
                aliasState,
                afterBeforeState,
                proposalState,
                restoreState,
            }, null, 2));
            return;
        }

        if (SMOKE_TARGET === 'live-context') {
            await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="context"]');
            await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "context"', 'Live Context tab active', 10000);
            await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Runtime Context")', 'Live Runtime Context command center', 10000);
            await wait(1000);
            screenshots.push(await screenshot(client, 'live-context-01-context-tab'));

            const contextState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                const drawer = document.querySelector('.saga-runtime-drawer');
                const contextButton = document.querySelector('.saga-runtime-rail-tab[data-tab-id="context"]');
                return {
                    activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
                    contextTooltip: contextButton?.getAttribute('title') || contextButton?.getAttribute('aria-label') || '',
                    hasRuntimeContext: text.includes('Runtime Context'),
                    hasBrowseContext: text.includes('Browse Context'),
                    hasDetectContext: text.includes('Detect Context'),
                    hasReviewProposals: text.includes('Review Proposals'),
                    hasAutomation: text.includes('Automation'),
                    hasManualMode: text.includes('Manual'),
                    hasAssistedMode: text.includes('Assisted'),
                    hasAutomaticMode: text.includes('Automatic'),
                    hasAdvancedBrief: text.includes('Advanced Context Brief'),
                    hasOldContextTooltip: text.includes('Detect, automatically update, view, and edit context: scene date, canon reference point, branch, and source range.'),
                    hasOldPrimaryFields: text.includes('Scene date') && text.includes('Canon reference point') && !text.includes('Advanced Context Brief'),
                    drawerText: drawer?.innerText?.slice(0, 1600) || '',
                };
            }));
            if (contextState.activeTab !== 'context') findings.push('Live ST Context tab did not become active.');
            if (!contextState.hasRuntimeContext) findings.push('Live ST Context tab did not render Runtime Context.');
            if (!contextState.hasBrowseContext) findings.push('Live ST Context tab did not render Browse Context.');
            if (!contextState.hasDetectContext) findings.push('Live ST Context tab did not render Detect Context.');
            if (!contextState.hasReviewProposals) findings.push('Live ST Context tab did not render Review Proposals.');
            if (!contextState.hasAutomation || !contextState.hasManualMode || !contextState.hasAssistedMode || !contextState.hasAutomaticMode) findings.push('Live ST Context automation modes did not render.');
            if (!contextState.hasAdvancedBrief) findings.push('Live ST Context tab did not render Advanced Context Brief.');
            if (contextState.hasOldContextTooltip || contextState.hasOldPrimaryFields) findings.push('Live ST Context tab still appears to expose the legacy date/canon-boundary-first UI.');

            const browseClicked = await clickButtonText(client, 'Browse Context');
            await wait(900);
            const browseState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                const overlay = document.querySelector('#saga-context-workbench');
                return {
                    clicked: true,
                    overlayOpen: !!overlay,
                    overlayText: overlay?.innerText?.slice(0, 800) || '',
                    blockedNoDecks: text.includes('Load a Loredeck before opening the Context Browser.'),
                };
            }));
            if (!browseClicked) findings.push('Live ST Browse Context button was not clickable.');
            if (browseState.overlayOpen) {
                screenshots.push(await screenshot(client, 'live-context-02-workbench'));
                const workbenchState = await evaluate(client, script(() => {
                    const overlay = document.querySelector('#saga-context-workbench');
                    const text = overlay?.innerText || '';
                    return {
                        hasContext: text.includes('Context'),
                        hasTimeline: text.includes('Timeline'),
                        hasAliases: text.includes('Aliases'),
                        hasValidation: text.includes('Validation'),
                    };
                }));
                if (!workbenchState.hasContext || !workbenchState.hasTimeline || !workbenchState.hasAliases || !workbenchState.hasValidation) {
                    findings.push('Live ST Context Workbench did not render expected tabs.');
                }
                await clickButtonText(client, 'Done', { root: '#saga-context-workbench', enabledOnly: false });
                await wait(500);
            } else if (!browseState.blockedNoDecks) {
                findings.push('Live ST Browse Context neither opened the Workbench nor showed the no-loaded-Loredeck guard.');
            }

            const proposalClicked = await clickButtonText(client, 'Review Proposals');
            await wait(700);
            const proposalState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                return {
                    overlayOpen: !!document.querySelector('#saga-context-proposal-review'),
                    blockedEmpty: text.includes('No Context proposals are waiting for review.'),
                };
            }));
            if (!proposalClicked) findings.push('Live ST Review Proposals button was not clickable.');
            if (!proposalState.overlayOpen && !proposalState.blockedEmpty) findings.push('Live ST Review Proposals neither opened proposal review nor showed the empty-proposal guard.');

            const errors = client.events
                .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                .map(event => formatLogEntry(event.params.entry));
            console.log(JSON.stringify({
                ok: findings.length === 0 && errors.length === 0,
                target: SMOKE_TARGET,
                url: smokeUrl,
                screenshots,
                findings,
                errors,
                dialogEvents,
                contextState,
                browseState,
                proposalState,
            }, null, 2));
            return;
        }

        screenshots.push(await screenshot(client, 'live-st-01-initial'));

        await clickSelector(client, '.saga-runtime-rail-density');
        await wait(400);
        await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="loredecks"]');
        await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Loredecks")', 'Loredecks drawer');
        await wait(1500);
        screenshots.push(await screenshot(client, 'live-st-02-loredecks'));

        await clickButtonText(client, 'Open Loredeck Library');
        await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay")', 'Loredeck Library');
        await wait(1000);
        screenshots.push(await screenshot(client, 'live-st-03-library'));

        const deleteProbe = await evaluate(client, script(() => {
            const overlay = document.querySelector('.saga-loredeck-library-overlay');
            const selected = overlay?.querySelector('.saga-loredeck-library-details');
            const deleteButton = [...(selected?.querySelectorAll('button') || [])].find(button => button.innerText.trim() === 'Delete Deck');
            return {
                hasDeleteDeck: !!deleteButton,
                deleteDisabledForSelected: deleteButton ? deleteButton.disabled : null,
                selectedText: selected?.innerText?.slice(0, 500) || '',
            };
        }));
        if (deleteProbe.hasDeleteDeck && deleteProbe.deleteDisabledForSelected !== true) findings.push('Bundled selected deck Delete Deck control was not disabled.');

        const customDeleteProbe = await evaluate(client, script(() => {
            const cards = [...document.querySelectorAll('.saga-loredeck-library-deck-card')];
            const custom = cards.find(card => /\bCustom\b/.test(card.innerText || ''));
            if (!custom) return { customFound: false };
            custom.click();
            return { customFound: true, cardText: custom.innerText.slice(0, 400) };
        }), { userGesture: true });
        await wait(600);
        if (customDeleteProbe.customFound) {
            const customDeleteState = await evaluate(client, script(() => {
                const detail = document.querySelector('.saga-loredeck-library-details');
                const del = [...(detail?.querySelectorAll('button') || [])].find(button => button.innerText.trim() === 'Delete Deck');
                return {
                    hasDeleteDeck: !!del,
                    deleteDisabled: del ? del.disabled : null,
                    selectedText: detail?.innerText?.slice(0, 500) || '',
                };
            }));
            if (!customDeleteState.hasDeleteDeck || customDeleteState.deleteDisabled) {
                findings.push('Custom deck did not expose an enabled Delete Deck control.');
            } else {
                await clickButtonText(client, 'Delete Deck', { root: '.saga-loredeck-library-overlay' });
                await wait(800);
                const domDeletePrompt = await evaluate(client, script(() => {
                    const prompt = document.querySelector('.saga-confirm-overlay');
                    const text = prompt?.innerText || '';
                    return {
                        hasPrompt: !!prompt,
                        text,
                    };
                }));
                if (domDeletePrompt.hasPrompt && /Delete Loredeck\?|Delete ".+"/i.test(domDeletePrompt.text || '')) {
                    screenshots.push(await screenshot(client, 'live-st-03-delete-confirm'));
                    await clickButtonText(client, 'Cancel', { root: '.saga-confirm-overlay', enabledOnly: false });
                    await wait(500);
                    const promptClosed = await evaluate(client, '!document.querySelector(".saga-confirm-overlay")');
                    if (!promptClosed) findings.push('Delete Deck confirmation did not close after Cancel.');
                } else if (dialogEvents.length) {
                    findings.push('Delete Deck still opened a native browser confirmation dialog.');
                } else if (!dialogEvents.length) {
                    findings.push('Delete Deck click did not expose a detectable confirmation prompt.');
                }
            }
        } else {
            // Delete confirmation is covered only when the live library has an editable Custom deck.
        }

        const librarySelection = await selectFirstLoredeckInLibrary(client);
        await wait(500);
        if (!librarySelection.selected) {
            findings.push(`Live ST could not select a Loredeck before opening Deck Health Center (${librarySelection.mode}).`);
        } else {
            const healthClicked = await clickButtonText(client, 'Open Health Center', { root: '.saga-loredeck-library-overlay' });
            if (!healthClicked) {
                findings.push(`Live ST selected a Loredeck through ${librarySelection.mode}, but Open Health Center was not clickable.`);
            } else {
                await waitFor(client, '!!document.querySelector(".saga-loredeck-health-center-overlay")', 'Deck Health Center');
                await wait(1000);
                screenshots.push(await screenshot(client, 'live-st-04-health'));
                await clickButtonText(client, 'Close', { root: '.saga-loredeck-health-center-overlay', enabledOnly: false });
                await wait(500);
            }
        }

        const creatorClicked = await clickButtonText(client, 'Create Deck', { root: '.saga-loredeck-library-overlay' });
        optionalSteps.creatorAvailable = creatorClicked;
        if (creatorClicked) {
            await waitFor(client, '!!document.querySelector(".saga-loredeck-creator-workbench-overlay")', 'Loredeck Creator');
            await wait(1000);
            screenshots.push(await screenshot(client, 'live-st-05-creator'));
            await clickButtonText(client, 'Close', { root: '.saga-loredeck-creator-workbench-overlay', enabledOnly: false });
            await wait(500);
        }
        await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false });
        await wait(800);

        await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="settings"]');
        await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Settings")', 'Settings drawer');
        if (!(await scrollTextIntoView(client, 'Theme Pack'))) await setDrawerScroll(client, 9999);
        await wait(800);
        screenshots.push(await screenshot(client, 'live-st-07-theme-pack'));

        const injectionTabAvailable = await evaluate(client, '!!document.querySelector(".saga-runtime-rail-tab[data-tab-id=\\"injection\\"]")');
        optionalSteps.injectionTabAvailable = injectionTabAvailable;
        if (injectionTabAvailable) {
            await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="injection"]');
            await waitFor(
                client,
                'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "injection" && !!document.querySelector(".saga-injection-preview")',
                'Injection drawer'
            );
            await wait(800);
            screenshots.push(await screenshot(client, 'live-st-08-injection'));
        }

        const state = await collectState(client);
        const errors = client.events
            .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
            .map(event => formatLogEntry(event.params.entry));

        console.log(JSON.stringify({
            ok: findings.length === 0 && errors.length === 0,
            target: SMOKE_TARGET,
            url: smokeUrl,
            screenshots,
            findings,
            errors,
            dialogEvents,
            optionalSteps,
            state,
        }, null, 2));
    } finally {
        if (client && SMOKE_TARGET === LIVE_CONTEXT_REASONER_TARGET && !sagaSettingsRestored) {
            await restoreSagaSettings(client, sagaSettingsSnapshot).catch(() => null);
        }
        if (client && LIVE_CONTEXT_METADATA_TARGETS.has(SMOKE_TARGET) && !sagaMetadataRestored) {
            await restoreSagaMetadata(client, sagaMetadataSnapshot).catch(() => null);
        }
        client?.close();
        proc.kill();
        if (harness?.server) {
            await new Promise(resolve => harness.server.close(resolve)).catch(() => {});
        }
        await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
        if (stderr && process.env.SAGA_SMOKE_DEBUG) console.error(stderr);
    }
}

main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error.message, stack: error.stack }, null, 2));
    process.exitCode = 1;
});
