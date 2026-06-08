import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const ST_URL = process.env.SAGA_ST_URL || 'http://127.0.0.1:8000/';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_DIR = process.env.SAGA_SMOKE_OUT || path.join(ROOT, 'Images', 'documentation', 'renders', 'saga-smoke');
const SMOKE_TARGET = process.env.SAGA_SMOKE_TARGET || 'live-st';
const VIEWPORT = {
    width: Number(process.env.SAGA_SMOKE_VIEWPORT_WIDTH) || (SMOKE_TARGET.endsWith('-narrow') ? 430 : 1280),
    height: Number(process.env.SAGA_SMOKE_VIEWPORT_HEIGHT) || (SMOKE_TARGET.endsWith('-narrow') ? 820 : 720),
};
const LIVE_CONTEXT_LOADED_PACK_ID = 'hp-year-6-half-blood-prince';
const LIVE_CONTEXT_LOADED_PACK_TITLE = 'Harry Potter Year 6: Half-Blood Prince';
const LIVE_CONTEXT_REASONER_TARGET = 'live-context-reasoner';
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

async function startVisualSmokeServer() {
    const host = '127.0.0.1';
    const port = await getFreePort();
    const server = http.createServer(async (req, res) => {
        if (!['GET', 'HEAD'].includes(req.method || '')) {
            sendStatic(res, 405, 'Method not allowed');
            return;
        }
        const decoded = decodeURIComponent(String(req.url || '/').split('?')[0] || '/');
        const relative = decoded === '/' ? 'tests/visual-smoke.html' : decoded.replace(/^\/+/, '');
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
    return {
        server,
        url: `http://${host}:${port}/tests/visual-smoke.html?tab=context&review=context-proposals`,
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
                return { browserWsUrl: version.webSocketDebuggerUrl, pageTargetId: page.id };
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
        this.ws = new RawWebSocket(this.wsUrl);
        this.ws.onMessage(async data => {
            try {
                const raw = await readWebSocketData(data);
                if (process.env.SAGA_SMOKE_DEBUG_FRAME) console.error(`CDP <= ${raw.slice(0, 500)}`);
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
        if (process.env.SAGA_SMOKE_DEBUG_FRAME) console.error(`CDP => ${message.slice(0, 500)}`);
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

async function waitFor(client, expression, label, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const value = await evaluate(client, expression).catch(() => false);
        if (value) return value;
        await wait(250);
    }
    throw new Error(`Timed out waiting for ${label}.`);
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

async function captureSagaMetadata(client) {
    return await evaluate(client, script(() => {
        const ctx = window.SillyTavern?.getContext?.();
        const metadata = ctx?.chatMetadata?.wandlight;
        return metadata && typeof metadata === 'object'
            ? JSON.parse(JSON.stringify(metadata))
            : null;
    }));
}

async function restoreSagaMetadata(client, snapshot) {
    return await evaluate(client, script(async saved => {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx?.chatMetadata) return { ok: false, reason: 'missing-chat-metadata' };
        if (saved && typeof saved === 'object') ctx.chatMetadata.wandlight = saved;
        else delete ctx.chatMetadata.wandlight;
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
        const settings = ctx?.extensionSettings?.wandlight;
        return settings && typeof settings === 'object'
            ? JSON.parse(JSON.stringify(settings))
            : null;
    }));
}

async function restoreSagaSettings(client, snapshot) {
    return await evaluate(client, script(async saved => {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx?.extensionSettings) return { ok: false, reason: 'missing-extension-settings' };
        if (saved && typeof saved === 'object') ctx.extensionSettings.wandlight = saved;
        else delete ctx.extensionSettings.wandlight;
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
        const body = document.querySelector('.wandlight-lore-panel-body');
        if (body) body.scrollTop = value;
    }, top));
}

async function scrollTextIntoView(client, text) {
    return await evaluate(client, script(label => {
        const candidates = [...document.querySelectorAll('.wandlight-runtime-drawer *')];
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
        const drawer = document.querySelector('.wandlight-runtime-drawer');
        const library = document.querySelector('.wandlight-loredeck-library-overlay');
        const health = document.querySelector('.wandlight-loredeck-health-center-overlay');
        const creator = document.querySelector('.wandlight-loredeck-creator-workbench-overlay');
        const settingsText = document.querySelector('#wandlight_settings')?.innerText || '';
        return {
            title: document.title,
            hasSagaCss: !!document.querySelector('#third-party_Saga-css'),
            hasSagaJs: !!document.querySelector('#third-party_Saga-js'),
            hasPanel: !!document.querySelector('#wandlight-lore-panel'),
            panelClass: document.querySelector('#wandlight-lore-panel')?.className || '',
            activeTab: document.querySelector('.wandlight-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
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

async function main() {
    await fs.mkdir(OUT_DIR, { recursive: true });
    const chrome = await findChrome();
    const port = await getFreePort();
    const userDataDir = path.join(ROOT, '.tmp', `saga-live-smoke-${Date.now()}`);
    await fs.mkdir(userDataDir, { recursive: true });
    const harness = SMOKE_TARGET === 'context-harness'
        ? await startVisualSmokeServer()
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
    let sagaMetadataSnapshot = null;
    let sagaMetadataRestored = false;
    let sagaSettingsSnapshot = null;
    let sagaSettingsRestored = false;
    let client;
    try {
        const { browserWsUrl, pageTargetId } = await waitForDevtools(port);
        await wait(1000);
        client = new CdpClient(browserWsUrl);
        await client.connect();
        const attached = await client.send('Target.attachToTarget', { targetId: pageTargetId, flatten: true });
        client.sessionId = attached.sessionId;

        client.on('Page.javascriptDialogOpening', payload => {
            dialogEvents.push(payload.params || {});
            void client.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
        });

        await client.send('Page.navigate', { url: smokeUrl });
        await waitFor(client, 'document.readyState === "complete"', SMOKE_TARGET === 'context-harness' ? 'Context smoke harness load' : 'SillyTavern load', 20000);
        await waitFor(client, '!!document.querySelector("#wandlight-lore-panel")', 'Saga runtime panel', 20000);
        await wait(2500);

        if (SMOKE_TARGET === 'context-harness') {
            await waitFor(client, 'window.__sagaSmokeReady === true', 'Context smoke ready marker', 20000);
            await waitFor(client, 'document.querySelector(".wandlight-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "context"', 'Context tab active', 10000);
            screenshots.push(await screenshot(client, 'context-harness-01-proposal-review'));
            const firstState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                const overlay = document.querySelector('#wandlight-context-proposal-review');
                return {
                    smokeMeta: window.__sagaContextSmoke || null,
                    activeTab: document.querySelector('.wandlight-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
                    hasRuntimeContext: text.includes('Runtime Context'),
                    hasBrowseContext: text.includes('Browse Context'),
                    hasReviewProposals: text.includes('Review Proposals'),
                    hasReasonerProposals: text.includes('Reasoner Proposals'),
                    hasLastResolver: text.includes('Last Resolver Check'),
                    hasLastAutomation: text.includes('Last Automation Check'),
                    hasAdvancedBrief: text.includes('Advanced Context Brief'),
                    hasLockedContext: /Manual lock|Locked/i.test(text),
                    overlayOpen: !!overlay,
                    overlayTitle: overlay?.querySelector('.wandlight-lore-workbench-title')?.textContent || '',
                    overlayHasApply: overlay?.innerText?.includes('Apply') || false,
                    overlayHasDismiss: overlay?.innerText?.includes('Dismiss') || false,
                    proposalRows: document.querySelectorAll('.wandlight-context-proposal-review-row').length,
                    contextRows: document.querySelectorAll('.wandlight-loredeck-context-row').length,
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

            await clickButtonText(client, 'Apply', { root: '#wandlight-context-proposal-review' });
            await wait(800);
            const applyState = await evaluate(client, script(() => ({
                overlayClosed: !document.querySelector('#wandlight-context-proposal-review'),
                proposalCount: window.__sagaSmokeContext?.chatMetadata?.wandlight?.lorePanel?.contextResolutionProposals?.length ?? null,
                context: window.__sagaSmokeContext?.chatMetadata?.wandlight?.loredeckContexts?.['smoke-arlong-park'] || null,
            })));
            if (!applyState.overlayClosed) findings.push('Applying the seeded Context proposal did not close the proposal review overlay.');
            if (applyState.proposalCount !== 0) findings.push('Applying the seeded Context proposal did not clear pending proposals.');
            if (applyState.context?.source !== 'model') findings.push('Applying the seeded Context proposal did not update the Loredeck Context source.');

            const browseClicked = await clickButtonText(client, 'Browse Context');
            if (!browseClicked) findings.push('Browse Context button was not clickable in the Context harness.');
            await waitFor(client, '!!document.querySelector("#wandlight-context-workbench")', 'Context Workbench overlay', 10000);
            await wait(800);
            screenshots.push(await screenshot(client, 'context-harness-02-workbench'));
            const workbenchState = await evaluate(client, script(() => {
                const overlay = document.querySelector('#wandlight-context-workbench');
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
                .map(event => event.params.entry.text);
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

            await clickSelector(client, '.wandlight-runtime-rail-tab[data-tab-id="loredecks"]');
            await waitFor(client, 'document.querySelector(".wandlight-runtime-drawer")?.innerText.includes("Loredecks")', 'Live Loredecks drawer', 10000);
            await wait(900);
            const libraryOpened = await clickButtonText(client, 'Open Loredeck Library');
            if (!libraryOpened) findings.push('Live loaded Context smoke could not open the Loredeck Library.');
            await waitFor(client, '!!document.querySelector(".wandlight-loredeck-library-overlay")', 'Live Loredeck Library overlay', 10000);
            await wait(900);

            await setInputValue(client, '.wandlight-loredeck-library-overlay .wandlight-loredeck-library-search', 'Half-Blood Prince', { eventName: 'change' });
            await waitFor(client, script(packId => !!document.querySelector(`.wandlight-loredeck-library-deck-card[data-pack-id="${packId}"]`), LIVE_CONTEXT_LOADED_PACK_ID), 'Live HP Year 6 Library card', 10000);
            const selectedDeck = await evaluate(client, script(packId => {
                const card = document.querySelector(`.wandlight-loredeck-library-deck-card[data-pack-id="${packId}"]`);
                if (!card) return false;
                card.scrollIntoView({ block: 'center', inline: 'center' });
                card.click();
                return true;
            }, LIVE_CONTEXT_LOADED_PACK_ID), { userGesture: true });
            if (!selectedDeck) findings.push('Live loaded Context smoke could not select the HP Year 6 Loredeck card.');
            await wait(700);

            let stackAddClicked = await clickButtonText(client, 'Add to Stack >', { root: '.wandlight-loredeck-library-overlay' });
            if (!stackAddClicked) {
                stackAddClicked = await clickButtonText(client, 'Add to Stack', { root: '.wandlight-loredeck-library-overlay' });
            }
            if (!stackAddClicked) findings.push('Live loaded Context smoke could not add HP Year 6 to the stack.');
            await wait(1200);

            const stackState = await evaluate(client, script(packId => {
                const ctx = window.SillyTavern?.getContext?.();
                const metadata = ctx?.chatMetadata?.wandlight || {};
                const stack = Array.isArray(metadata.loredeckStack) ? metadata.loredeckStack : [];
                const overlayText = document.querySelector('.wandlight-loredeck-library-overlay')?.innerText || '';
                return {
                    stack,
                    hasTargetInMetadata: stack.some(item => item?.packId === packId && item.enabled !== false),
                    hasTargetInOverlay: overlayText.includes('Harry Potter Year 6: Half-Blood Prince') && overlayText.includes('Active Stack'),
                    overlayText: overlayText.slice(0, 1600),
                };
            }, LIVE_CONTEXT_LOADED_PACK_ID));
            if (!stackState.hasTargetInMetadata) findings.push('HP Year 6 was not present as an enabled Loredeck stack item after Add to Stack.');

            await clickButtonText(client, 'Done', { root: '.wandlight-loredeck-library-overlay', enabledOnly: false });
            await wait(800);
            await clickSelector(client, '.wandlight-runtime-rail-tab[data-tab-id="context"]');
            await waitFor(client, 'document.querySelector(".wandlight-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "context"', 'Live loaded Context tab active', 10000);
            await waitFor(client, 'document.querySelector(".wandlight-runtime-drawer")?.innerText.includes("Runtime Context")', 'Live loaded Runtime Context command center', 10000);
            await wait(1000);
            await clearTransientToasts(client);
            await wait(200);
            screenshots.push(await screenshot(client, `${loadedContextScreenshotPrefix}-01-context-tab`));

            const loadedContextState = await evaluate(client, script(packId => {
                const text = document.body?.innerText || '';
                const rows = [...document.querySelectorAll('.wandlight-loredeck-context-row')];
                const rowText = rows.map(row => row.innerText || '').join('\n');
                return {
                    loadedChip: /1 loaded|[2-9] loaded/.test(text),
                    rowCount: rows.length,
                    hasTargetRow: rowText.includes('Harry Potter Year 6: Half-Blood Prince') || rowText.includes(packId),
                    hasBrowseContext: text.includes('Browse Context'),
                    hasAdvancedBrief: text.includes('Advanced Context Brief'),
                    drawerText: document.querySelector('.wandlight-runtime-drawer')?.innerText?.slice(0, 1800) || '',
                };
            }, LIVE_CONTEXT_LOADED_PACK_ID));
            if (!loadedContextState.loadedChip) findings.push('Live loaded Context tab did not show a non-empty loaded-Loredeck count.');
            if (!loadedContextState.hasTargetRow) findings.push('Live loaded Context tab did not render the HP Year 6 loaded Context row.');

            if (SMOKE_TARGET === LIVE_CONTEXT_REASONER_TARGET) {
                const seedState = await evaluate(client, script(async packId => {
                    const ctx = window.SillyTavern?.getContext?.();
                    if (!ctx?.chatMetadata || !ctx?.extensionSettings) return { ok: false, reason: 'missing-st-context' };
                    const settings = ctx.extensionSettings.wandlight ||= {};
                    settings.contextLocalApplyMinConfidence = 1;
                    settings.contextReasonerProposalMinConfidence = 0.5;
                    settings.experienceMode = 'advanced';
                    const state = ctx.chatMetadata.wandlight ||= {};
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

                const scrollBeforeReasoner = await evaluate(client, 'document.querySelector(".wandlight-lore-panel-body")?.scrollTop || 0');
                const reasonerClicked = await clickButtonText(client, 'Ask Reasoner');
                if (!reasonerClicked) findings.push('Live Context Reasoner smoke could not click Ask Reasoner.');
                await waitFor(client, script(packId => {
                    const ctx = window.SillyTavern?.getContext?.();
                    const state = ctx?.chatMetadata?.wandlight || {};
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
                    const state = ctx?.chatMetadata?.wandlight || {};
                    const panel = state.lorePanel || {};
                    const proposals = Array.isArray(panel.contextResolutionProposals) ? panel.contextResolutionProposals : [];
                    const audit = panel.contextResolutionAudit || null;
                    const rowContext = state.loredeckContexts?.[packId] || null;
                    const text = document.querySelector('.wandlight-runtime-drawer')?.innerText || document.body?.innerText || '';
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
                    await waitFor(client, '!!document.querySelector("#wandlight-context-proposal-review")', 'Live Context Reasoner proposal review overlay', 10000);
                    await wait(1000);
                    screenshots.push(await screenshot(client, 'live-context-reasoner-02-proposals'));
                    reasonerProposalState = await evaluate(client, script(() => {
                        const overlay = document.querySelector('#wandlight-context-proposal-review');
                        const text = overlay?.innerText || '';
                        return {
                            open: !!overlay,
                            rowCount: overlay?.querySelectorAll('.wandlight-context-proposal-review-row').length || 0,
                            hasApply: text.includes('Apply'),
                            hasDismiss: text.includes('Dismiss'),
                            text: text.slice(0, 1600),
                        };
                    }));
                    if (!reasonerProposalState.open || reasonerProposalState.rowCount < 1) findings.push('Live Context Reasoner proposal review did not render proposal rows.');
                    await clickButtonText(client, 'Close', { root: '#wandlight-context-proposal-review', enabledOnly: false });
                    await wait(500);
                }

                const scrollAfterReasoner = await evaluate(client, 'document.querySelector(".wandlight-lore-panel-body")?.scrollTop || 0');
                const restoreSettingsState = await restoreSagaSettings(client, sagaSettingsSnapshot);
                sagaSettingsRestored = true;
                const restoreState = await restoreSagaMetadata(client, sagaMetadataSnapshot);
                sagaMetadataRestored = true;
                const errors = client.events
                    .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                    .map(event => event.params.entry.text);
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
            await waitFor(client, '!!document.querySelector("#wandlight-context-workbench")', 'Live loaded Context Workbench overlay', 10000);
            await wait(1000);
            await clearTransientToasts(client);
            await wait(200);
            screenshots.push(await screenshot(client, `${loadedContextScreenshotPrefix}-02-workbench`));

            const workbenchState = await evaluate(client, script(packTitle => {
                const overlay = document.querySelector('#wandlight-context-workbench');
                const text = overlay?.innerText || '';
                return {
                    open: !!overlay,
                    hasPackTitle: text.includes(packTitle),
                    hasContextPicker: text.includes('Select From Timeline'),
                    hasTimeline: text.includes('Timeline'),
                    hasAliases: text.includes('Aliases'),
                    hasValidation: text.includes('Validation'),
                    hasManualLock: /Manual lock|Auto allowed/i.test(text),
                    text: text.slice(0, 1800),
                };
            }, LIVE_CONTEXT_LOADED_PACK_TITLE));
            if (!workbenchState.open) findings.push('Live loaded Context Workbench did not open.');
            if (!workbenchState.hasPackTitle) findings.push('Live loaded Context Workbench did not select HP Year 6.');
            if (!workbenchState.hasContextPicker) findings.push('Live loaded Context Workbench did not render the Context picker.');
            if (!workbenchState.hasTimeline || !workbenchState.hasAliases || !workbenchState.hasValidation) findings.push('Live loaded Context Workbench tabs did not render.');

            const contextPickerSearch = '#wandlight-context-workbench .wandlight-context-workbench-context-picker input[type="search"]';
            const aliasSearch = await setInputValue(client, contextPickerSearch, 'Ron dates the blonde girl', { eventName: 'change' });
            await wait(700);
            const aliasState = await evaluate(client, script(() => {
                const overlay = document.querySelector('#wandlight-context-workbench');
                const text = overlay?.innerText || '';
                return {
                    searched: true,
                    hasRonLavender: text.includes('Ron Lavender Start'),
                    rowCount: overlay?.querySelectorAll('.wandlight-context-workbench-context-picker-row').length || 0,
                    text: text.slice(0, 1400),
                };
            }));
            if (!aliasSearch) findings.push('Live loaded Context Workbench alias search input was not available.');
            if (!aliasState.hasRonLavender) findings.push('Live loaded Context Browser did not resolve the Ron/Lavender alias in visible results.');

            const afterSearch = await setInputValue(client, contextPickerSearch, 'Post Christmas Return', { eventName: 'change' });
            await wait(700);
            const afterClicked = await clickButtonInRow(
                client,
                '#wandlight-context-workbench',
                '.wandlight-context-workbench-context-picker-row',
                'Post Christmas Return',
                'After',
            );
            if (!afterSearch) findings.push('Live loaded Context Workbench lower-bound search input was not available.');
            if (!afterClicked) findings.push('Live loaded Context Browser could not apply Post Christmas Return as the After bound.');
            await wait(800);

            const beforeSearch = await setInputValue(client, contextPickerSearch, 'Apparition Lessons Begin', { eventName: 'change' });
            await wait(700);
            const beforeClicked = await clickButtonInRow(
                client,
                '#wandlight-context-workbench',
                '.wandlight-context-workbench-context-picker-row',
                'Apparition Lessons Begin',
                'Before',
            );
            if (!beforeSearch) findings.push('Live loaded Context Workbench upper-bound search input was not available.');
            if (!beforeClicked) findings.push('Live loaded Context Browser could not apply Apparition Lessons Begin as the Before bound.');
            await wait(900);

            const afterBeforeState = await evaluate(client, script(packId => {
                const ctx = window.SillyTavern?.getContext?.();
                const state = ctx?.chatMetadata?.wandlight || {};
                const context = state.loredeckContexts?.[packId] || null;
                const drawerText = document.querySelector('.wandlight-runtime-drawer')?.innerText || '';
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
                if (!ctx.chatMetadata.wandlight || typeof ctx.chatMetadata.wandlight !== 'object') ctx.chatMetadata.wandlight = {};
                const state = ctx.chatMetadata.wandlight;
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

            await clickButtonText(client, 'Done', { root: '#wandlight-context-workbench', enabledOnly: false });
            await wait(700);
            const proposalClicked = await clickButtonText(client, 'Review Proposals');
            if (!proposalClicked) findings.push('Live loaded Context Review Proposals button was not clickable after seeding.');
            await waitFor(client, '!!document.querySelector("#wandlight-context-proposal-review")', 'Live loaded Context Proposal Review overlay', 10000);
            await wait(1800);
            await clearTransientToasts(client);
            await wait(200);
            screenshots.push(await screenshot(client, `${loadedContextScreenshotPrefix}-03-proposals`));
            const proposalState = await evaluate(client, script(() => {
                const overlay = document.querySelector('#wandlight-context-proposal-review');
                const text = overlay?.innerText || '';
                return {
                    open: !!overlay,
                    rowCount: overlay?.querySelectorAll('.wandlight-context-proposal-review-row').length || 0,
                    hasTitle: text.includes('Context Proposal Review'),
                    hasRonLavender: text.includes('Ron Lavender Start'),
                    hasApply: text.includes('Apply'),
                    hasDismiss: text.includes('Dismiss'),
                    text: text.slice(0, 1400),
                };
            }));
            if (!proposalState.open || proposalState.rowCount < 1) findings.push('Live loaded Context Proposal Review did not render a populated proposal row.');
            if (!proposalState.hasRonLavender || !proposalState.hasApply || !proposalState.hasDismiss) findings.push('Live loaded Context Proposal Review row missed expected proposal actions/content.');
            await clickButtonText(client, 'Close', { root: '#wandlight-context-proposal-review', enabledOnly: false });
            await wait(500);

            const restoreState = await restoreSagaMetadata(client, sagaMetadataSnapshot);
            sagaMetadataRestored = true;

            const errors = client.events
                .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                .map(event => event.params.entry.text);
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
            await clickSelector(client, '.wandlight-runtime-rail-tab[data-tab-id="context"]');
            await waitFor(client, 'document.querySelector(".wandlight-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "context"', 'Live Context tab active', 10000);
            await waitFor(client, 'document.querySelector(".wandlight-runtime-drawer")?.innerText.includes("Runtime Context")', 'Live Runtime Context command center', 10000);
            await wait(1000);
            screenshots.push(await screenshot(client, 'live-context-01-context-tab'));

            const contextState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                const drawer = document.querySelector('.wandlight-runtime-drawer');
                const contextButton = document.querySelector('.wandlight-runtime-rail-tab[data-tab-id="context"]');
                return {
                    activeTab: document.querySelector('.wandlight-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
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
                const overlay = document.querySelector('#wandlight-context-workbench');
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
                    const overlay = document.querySelector('#wandlight-context-workbench');
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
                await clickButtonText(client, 'Done', { root: '#wandlight-context-workbench', enabledOnly: false });
                await wait(500);
            } else if (!browseState.blockedNoDecks) {
                findings.push('Live ST Browse Context neither opened the Workbench nor showed the no-loaded-Loredeck guard.');
            }

            const proposalClicked = await clickButtonText(client, 'Review Proposals');
            await wait(700);
            const proposalState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                return {
                    overlayOpen: !!document.querySelector('#wandlight-context-proposal-review'),
                    blockedEmpty: text.includes('No Context proposals are waiting for review.'),
                };
            }));
            if (!proposalClicked) findings.push('Live ST Review Proposals button was not clickable.');
            if (!proposalState.overlayOpen && !proposalState.blockedEmpty) findings.push('Live ST Review Proposals neither opened proposal review nor showed the empty-proposal guard.');

            const errors = client.events
                .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                .map(event => event.params.entry.text);
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

        await clickSelector(client, '.wandlight-runtime-rail-density');
        await wait(400);
        await clickSelector(client, '.wandlight-runtime-rail-tab[data-tab-id="loredecks"]');
        await waitFor(client, 'document.querySelector(".wandlight-runtime-drawer")?.innerText.includes("Loredecks")', 'Loredecks drawer');
        await wait(1500);
        screenshots.push(await screenshot(client, 'live-st-02-loredecks'));

        await clickButtonText(client, 'Open Loredeck Library');
        await waitFor(client, '!!document.querySelector(".wandlight-loredeck-library-overlay")', 'Loredeck Library');
        await wait(1000);
        screenshots.push(await screenshot(client, 'live-st-03-library'));

        const deleteProbe = await evaluate(client, script(() => {
            const overlay = document.querySelector('.wandlight-loredeck-library-overlay');
            const selected = overlay?.querySelector('.wandlight-loredeck-library-details');
            const deleteButton = [...(selected?.querySelectorAll('button') || [])].find(button => button.innerText.trim() === 'Delete Deck');
            return {
                hasDeleteDeck: !!deleteButton,
                deleteDisabledForSelected: deleteButton ? deleteButton.disabled : null,
                selectedText: selected?.innerText?.slice(0, 500) || '',
            };
        }));
        if (!deleteProbe.hasDeleteDeck) findings.push('Library selected deck did not expose a Delete Deck control.');
        if (deleteProbe.deleteDisabledForSelected !== true) findings.push('Bundled selected deck Delete Deck control was not disabled.');

        const customDeleteProbe = await evaluate(client, script(() => {
            const cards = [...document.querySelectorAll('.wandlight-loredeck-library-deck-card')];
            const custom = cards.find(card => /\bCustom\b/.test(card.innerText || ''));
            if (!custom) return { customFound: false };
            custom.click();
            return { customFound: true, cardText: custom.innerText.slice(0, 400) };
        }), { userGesture: true });
        await wait(600);
        if (customDeleteProbe.customFound) {
            const customDeleteState = await evaluate(client, script(() => {
                const detail = document.querySelector('.wandlight-loredeck-library-details');
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
                await clickButtonText(client, 'Delete Deck', { root: '.wandlight-loredeck-library-overlay' });
                await wait(800);
                const domDeletePrompt = await evaluate(client, script(() => {
                    const prompt = document.querySelector('.wandlight-confirm-overlay');
                    const text = prompt?.innerText || '';
                    return {
                        hasPrompt: !!prompt,
                        text,
                    };
                }));
                if (domDeletePrompt.hasPrompt && /Delete Loredeck\?|Delete ".+"/i.test(domDeletePrompt.text || '')) {
                    screenshots.push(await screenshot(client, 'live-st-03-delete-confirm'));
                    await clickButtonText(client, 'Cancel', { root: '.wandlight-confirm-overlay', enabledOnly: false });
                    await wait(500);
                    const promptClosed = await evaluate(client, '!document.querySelector(".wandlight-confirm-overlay")');
                    if (!promptClosed) findings.push('Delete Deck confirmation did not close after Cancel.');
                } else if (dialogEvents.length) {
                    findings.push('Delete Deck still opened a native browser confirmation dialog.');
                } else if (!dialogEvents.length) {
                    findings.push('Delete Deck click did not expose a detectable confirmation prompt.');
                }
            }
        } else {
            findings.push('No Custom deck was available for delete confirmation smoke.');
        }

        await evaluate(client, script(() => {
            const first = document.querySelector('.wandlight-loredeck-library-deck-card');
            if (first) first.click();
        }), { userGesture: true });
        await wait(500);

        await clickButtonText(client, 'Open Health Center', { root: '.wandlight-loredeck-library-overlay' });
        await waitFor(client, '!!document.querySelector(".wandlight-loredeck-health-center-overlay")', 'Deck Health Center');
        await wait(1000);
        screenshots.push(await screenshot(client, 'live-st-04-health'));
        await clickButtonText(client, 'Close', { root: '.wandlight-loredeck-health-center-overlay', enabledOnly: false });
        await wait(500);

        await clickButtonText(client, 'Create Deck', { root: '.wandlight-loredeck-library-overlay' });
        await waitFor(client, '!!document.querySelector(".wandlight-loredeck-creator-workbench-overlay")', 'Loredeck Creator');
        await wait(1000);
        screenshots.push(await screenshot(client, 'live-st-05-creator'));
        await clickButtonText(client, 'Close', { root: '.wandlight-loredeck-creator-workbench-overlay', enabledOnly: false });
        await wait(500);
        await clickButtonText(client, 'Done', { root: '.wandlight-loredeck-library-overlay', enabledOnly: false });
        await wait(800);

        await clickSelector(client, '.wandlight-runtime-rail-tab[data-tab-id="settings"]');
        await waitFor(client, 'document.querySelector(".wandlight-runtime-drawer")?.innerText.includes("Settings")', 'Settings drawer');
        if (!(await scrollTextIntoView(client, 'Theme Pack'))) await setDrawerScroll(client, 9999);
        await wait(800);
        screenshots.push(await screenshot(client, 'live-st-07-theme-pack'));

        await clickSelector(client, '.wandlight-runtime-rail-tab[data-tab-id="injection"]');
        await waitFor(client, 'document.querySelector(".wandlight-runtime-drawer")?.innerText.includes("High-Relevance Lore Injection")', 'Injection drawer');
        await wait(800);
        screenshots.push(await screenshot(client, 'live-st-08-injection'));

        const state = await collectState(client);
        const errors = client.events
            .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
            .map(event => event.params.entry.text);

        console.log(JSON.stringify({
            ok: true,
            target: SMOKE_TARGET,
            url: smokeUrl,
            screenshots,
            findings,
            errors,
            dialogEvents,
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
