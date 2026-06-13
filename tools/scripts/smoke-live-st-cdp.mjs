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
const STORAGE_HARNESS_TARGET = 'storage-harness';
const REPO_LOCAL_HARNESS_TARGETS = new Set(['context-harness', 'guide-harness', 'creator-harness', STORAGE_HARNESS_TARGET]);
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

function sendJson(res, status, body = {}) {
    sendStatic(res, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

function readRequestJson(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

function createRepoLocalFilesApiMock() {
    const files = new Map();
    const deleted = [];
    const requests = [];

    function snapshot() {
        return {
            files: [...files.keys()].sort(),
            deleted: [...deleted],
            requests: [...requests],
        };
    }

    async function handle(req, res, decodedPath) {
        const method = req.method || 'GET';
        requests.push({ method, path: decodedPath });
        if (decodedPath === '/__saga-storage-smoke') {
            sendJson(res, 200, snapshot());
            return true;
        }

        if (decodedPath === '/api/files/upload' && method === 'POST') {
            const body = await readRequestJson(req);
            const name = String(body?.name || '').trim();
            const data = String(body?.data || '').trim();
            if (!/^saga-[a-z0-9_.-]+\.(?:json|png|jpe?g|webp|avif)$/i.test(name) || !data) {
                sendJson(res, 400, { error: 'Invalid Saga storage upload.' });
                return true;
            }
            const pathName = `/user/files/${name}`;
            files.set(pathName, {
                bytes: Buffer.from(data, 'base64'),
                contentType: getStaticMimeType(name),
            });
            sendJson(res, 200, { path: pathName });
            return true;
        }

        if (decodedPath === '/api/files/verify' && method === 'POST') {
            const body = await readRequestJson(req);
            const result = {};
            for (const url of Array.isArray(body?.urls) ? body.urls : []) {
                const pathName = String(url || '');
                result[pathName] = files.has(pathName);
            }
            sendJson(res, 200, result);
            return true;
        }

        if (decodedPath === '/api/files/delete' && method === 'POST') {
            const body = await readRequestJson(req);
            const pathName = String(body?.path || '').trim();
            if (!/^\/user\/files\/saga-[a-z0-9_.-]+\.(?:json|png|jpe?g|webp|avif)$/i.test(pathName)) {
                sendJson(res, 400, { error: 'Invalid Saga storage delete.' });
                return true;
            }
            deleted.push(pathName);
            files.delete(pathName);
            sendJson(res, 200, { ok: true, path: pathName });
            return true;
        }

        if (method === 'GET' && /^\/user\/files\/saga-[a-z0-9_.-]+\.(?:json|png|jpe?g|webp|avif)$/i.test(decodedPath)) {
            const file = files.get(decodedPath);
            if (!file) {
                sendStatic(res, 404, 'missing');
                return true;
            }
            sendStatic(res, 200, file.bytes, file.contentType);
            return true;
        }

        return false;
    }

    return { handle, snapshot };
}

function getVisualSmokeHarnessQuery(target = SMOKE_TARGET) {
    if (target === 'context-harness') return '?tab=context&review=context-proposals';
    if (target === 'guide-harness') return '?mode=basic&tab=session';
    if (target === 'creator-harness') return '?tab=loredecks';
    if (target === STORAGE_HARNESS_TARGET) return '?mode=advanced&tab=loredecks&storage=1';
    return '';
}

async function startVisualSmokeServer(target = SMOKE_TARGET) {
    const host = '127.0.0.1';
    const port = await getFreePort();
    const filesApiMock = target === STORAGE_HARNESS_TARGET ? createRepoLocalFilesApiMock() : null;
    const server = http.createServer(async (req, res) => {
        const decoded = decodeURIComponent(String(req.url || '/').split('?')[0] || '/');
        if (filesApiMock && await filesApiMock.handle(req, res, decoded)) {
            return;
        }
        if (!['GET', 'HEAD'].includes(req.method || '')) {
            sendStatic(res, 405, 'Method not allowed');
            return;
        }
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
        storage: filesApiMock,
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

    send(method, params = {}, options = {}) {
        const id = this.nextId++;
        const payload = { id, method, params };
        if (this.sessionId && !method.startsWith('Target.')) payload.sessionId = this.sessionId;
        const message = JSON.stringify(payload);
        if (process.env.SAGA_SMOKE_DEBUG_FRAME) console.error(`CDP => ${JSON.stringify(redactDiagnosticValue(payload)).slice(0, 500)}`);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP ${method} timed out.`));
            }, Math.max(1000, Number(options.timeoutMs) || 10000));
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

function createCdpStartupError(method, error, details = {}) {
    const transport = details.pageWsUrl ? 'page target WebSocket' : 'browser WebSocket with Target.attachToTarget';
    const message = [
        `CDP startup handshake failed at ${method}: ${error?.message || error || 'unknown error'}`,
        `Target: ${details.target || SMOKE_TARGET}; URL: ${details.smokeUrl || 'unknown'}; browser: ${details.chrome || 'unknown'}; headless: ${details.headless ? 'yes' : 'no'}; transport: ${transport}; pageTargetId: ${details.pageTargetId || 'missing'}.`,
        'The Chrome DevTools endpoint was reachable, but the page target did not answer a startup command before the smoke page ran.',
        'Retry with SAGA_SMOKE_NATIVE_WS=1 or SAGA_SMOKE_HEADLESS=0, and use SAGA_SMOKE_DEBUG_FRAME=1 to inspect raw CDP frames.',
    ].join('\n');
    const wrapped = new Error(message);
    wrapped.stack = `${message}\nCaused by: ${error?.stack || error?.message || error || 'unknown error'}`;
    return wrapped;
}

async function sendStartupCdpCommand(client, method, params, details) {
    try {
        return await client.send(method, params);
    } catch (error) {
        throw createCdpStartupError(method, error, details);
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
    let result = null;
    try {
        result = await client.send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
            userGesture: options.userGesture === true,
        }, {
            timeoutMs: options.timeoutMs,
        });
    } catch (error) {
        const label = options.label || String(expression || '').replace(/\s+/g, ' ').slice(0, 140);
        throw new Error(`${error?.message || error} during Runtime.evaluate: ${label}`);
    }
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

function isExpectedStorageHarness404(error = '') {
    const message = String(error || '');
    return SMOKE_TARGET === STORAGE_HARNESS_TARGET
        && /Failed to load resource: the server responded with a status of 404/i.test(message)
        && /\/user\/files\/saga-[^)\s]+/i.test(message);
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

async function openSummaryText(client, text, options = {}) {
    return await evaluate(client, script((label, rootSelector) => {
        const root = rootSelector ? document.querySelector(rootSelector) : document;
        if (!root) return false;
        const summaries = [...root.querySelectorAll('summary')];
        const target = summaries.find(summary => (summary.innerText || summary.textContent || '').includes(label));
        if (!target) return false;
        target.scrollIntoView({ block: 'center', inline: 'center' });
        const details = target.closest('details');
        if (details && !details.open) target.click();
        return true;
    }, text, options.root || ''), { userGesture: true });
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

async function switchSagaExperienceMode(client, mode) {
    const label = mode === 'advanced' ? 'Advanced' : 'Basic';
    const result = await evaluate(client, script(targetLabel => {
        const buttons = [...document.querySelectorAll('.saga-experience-switch button')];
        const button = buttons.find(candidate => (candidate.innerText || candidate.textContent || '').trim() === targetLabel);
        if (!button) {
            return {
                ok: false,
                reason: 'missing-experience-button',
                labels: buttons.map(candidate => (candidate.innerText || candidate.textContent || '').trim()).filter(Boolean),
            };
        }
        const alreadyActive = button.getAttribute('aria-checked') === 'true';
        if (!alreadyActive) {
            button.scrollIntoView({ block: 'center', inline: 'center' });
            button.click();
        }
        return { ok: true, changed: !alreadyActive };
    }, label), { userGesture: true });

    if (!result?.ok || !result.changed) return result;
    await waitFor(
        client,
        script(targetLabel => {
            const button = [...document.querySelectorAll('.saga-experience-switch button')]
                .find(candidate => (candidate.innerText || candidate.textContent || '').trim() === targetLabel);
            return button?.getAttribute('aria-checked') === 'true';
        }, label),
        `${label} Experience switch`,
        10000,
    );
    await wait(500);
    return result;
}

async function collectStateSafetyStorageSmoke(client) {
    return await evaluate(client, script(() => {
        const drawer = document.querySelector('.saga-runtime-drawer');
        const activeTab = document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '';
        const section = [...(drawer?.querySelectorAll('details') || [])]
            .find(details => (details.querySelector('summary')?.innerText || details.querySelector('summary')?.textContent || '').includes('State Safety'));
        if (!section) {
            return {
                present: false,
                activeTab,
                drawerText: drawer?.innerText?.slice(0, 1400) || '',
            };
        }
        if (!section.open) section.querySelector('summary')?.click();
        section.scrollIntoView({ block: 'start', inline: 'nearest' });
        const text = section.innerText || section.textContent || '';
        const buttons = [...section.querySelectorAll('button')].map(button => ({
            label: (button.innerText || button.textContent || '').trim(),
            disabled: !!button.disabled,
        })).filter(button => button.label);
        return {
            present: true,
            open: !!section.open,
            activeTab,
            text: text.slice(0, 1800),
            buttons,
            hasMigrationAction: buttons.some(button => ['Migrate Legacy Storage', 'Storage Current'].includes(button.label)),
            hasVerifyStorage: buttons.some(button => button.label === 'Verify Storage'),
            hasSettleStorageWrites: buttons.some(button => button.label === 'Settle Storage Writes'),
            hasCleanMissingRecords: buttons.some(button => button.label === 'Clean Missing Records'),
            hasStorageMigrationRow: text.includes('Storage migration'),
            hasStorageIntegrityRow: text.includes('Storage integrity'),
        };
    }), { userGesture: true });
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

async function runCreatorHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents) {
    await waitFor(client, 'window.__sagaSmokeReady === true', 'Creator smoke ready marker', 20000);
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "loredecks"', 'Creator smoke Loredecks tab active', 10000);
    const projectPanelOpened = await openSummaryText(client, 'In-Progress Creator Projects');
    if (!projectPanelOpened) findings.push('Creator harness could not open In-Progress Creator Projects.');
    await wait(700);
    const creatorOpened = await clickSelector(client, '.saga-loredeck-creator-project-card');
    if (!creatorOpened) findings.push('Creator harness could not resume the seeded Creator project.');
    await waitFor(client, '!!document.querySelector(".saga-loredeck-creator-workbench-overlay")', 'Creator harness workbench overlay', 10000);
    await wait(900);
    screenshots.push(await screenshot(client, 'creator-harness-01-reset-controls'));

    const resetState = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-creator-workbench-overlay');
        const buttons = [...overlay?.querySelectorAll('.saga-loredeck-creator-stage-reset') || []];
        const labels = buttons.map(button => button.getAttribute('aria-label') || '').filter(Boolean);
        const cards = [...overlay?.querySelectorAll('.saga-loredeck-creator-stage-item') || []];
        return {
            overlayOpen: !!overlay,
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
            resetCount: buttons.length,
            labels,
            disabledCount: buttons.filter(button => button.disabled).length,
            resettableCount: overlay?.querySelectorAll('.saga-loredeck-creator-stage-resettable').length || 0,
            finalizeHasReset: labels.some(label => label === 'Reset to Finalize'),
            hasNestedStageButtons: cards.some(card => !!card.querySelector('button button')),
            titleResetTooltip: buttons.find(button => button.getAttribute('aria-label') === 'Reset to Title Pass')?.dataset?.sagaTooltip || '',
            titleResetText: buttons.find(button => button.getAttribute('aria-label') === 'Reset to Title Pass')?.textContent || '',
            workbenchText: overlay?.innerText?.slice(0, 1200) || '',
        };
    }));
    if (!resetState.overlayOpen) findings.push('Creator harness workbench did not remain open for reset validation.');
    if (resetState.activeTab !== 'loredecks') findings.push('Creator harness did not remain on the Loredecks tab.');
    if (resetState.resetCount < 3) findings.push(`Creator harness rendered ${resetState.resetCount} reset controls instead of several completed-stage controls.`);
    if (resetState.disabledCount !== 0) findings.push('Creator harness reset controls were disabled even though no generation is active.');
    if (resetState.resettableCount !== resetState.resetCount) findings.push('Creator harness resettable card count did not match reset button count.');
    if (resetState.finalizeHasReset) findings.push('Creator harness exposed a reset control on Finalize.');
    if (resetState.hasNestedStageButtons) findings.push('Creator harness rendered nested buttons in the stage guide.');
    if (!resetState.labels.includes('Reset to Title Pass')) findings.push('Creator harness did not expose Reset to Title Pass.');
    if (!resetState.titleResetTooltip.includes('Reset to this step')) findings.push('Creator reset tooltip did not use the expected reset affordance copy.');
    if (!resetState.titleResetText.trim()) findings.push('Creator reset icon text did not render.');
    if (findings.length === 0) {
        const clickedReset = await clickSelector(client, '.saga-loredeck-creator-stage-reset[aria-label="Reset to Title Pass"]');
        if (!clickedReset) {
            findings.push('Creator harness could not click Reset to Title Pass.');
        } else {
            await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'Creator reset confirmation overlay', 10000);
            await wait(300);
            const confirmState = await evaluate(client, script(() => {
                const overlay = document.querySelector('.saga-confirm-overlay');
                const text = overlay?.innerText || '';
                return {
                    open: !!overlay,
                    text,
                    hasTitle: text.includes('Reset to Title Pass?'),
                    hasWarning: text.includes('permanently erase all Creator data after Title Pass'),
                    namesForwardSteps: text.includes('Context Plan') && text.includes('Lorecards') && text.includes('Review Queue') && text.includes('Pack Health') && text.includes('Finalize'),
                    hasConfirmLabel: [...overlay?.querySelectorAll('button') || []].some(button => (button.innerText || button.textContent || '').trim() === 'Reset to Title Pass'),
                    hasCancelLabel: [...overlay?.querySelectorAll('button') || []].some(button => (button.innerText || button.textContent || '').trim() === 'Cancel'),
                };
            }));
            if (!confirmState.open) findings.push('Creator reset confirmation did not open.');
            if (!confirmState.hasTitle) findings.push('Creator reset confirmation title was not target-specific.');
            if (!confirmState.hasWarning || !confirmState.namesForwardSteps) findings.push('Creator reset confirmation did not name the destructive forward-step wipe.');
            if (!confirmState.hasConfirmLabel || !confirmState.hasCancelLabel) findings.push('Creator reset confirmation did not render expected action labels.');
            screenshots.push(await screenshot(client, 'creator-harness-02-reset-confirm'));
            const cancelled = await clickButtonText(client, 'Cancel', { root: '.saga-confirm-overlay', enabledOnly: false });
            if (!cancelled) findings.push('Creator reset confirmation Cancel button was not clickable.');
            await wait(300);
            const closed = await evaluate(client, '!document.querySelector(".saga-confirm-overlay")');
            if (!closed) findings.push('Creator reset confirmation did not close after Cancel.');
            resetState.confirmState = confirmState;
        }
    }

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
        resetState,
    }, null, 2));
}

async function runStorageHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents, harness) {
    await waitFor(client, 'window.__sagaSmokeReady === true', 'Storage smoke ready marker', 20000);
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "loredecks"', 'Storage smoke Loredecks tab active', 10000);
    screenshots.push(await screenshot(client, 'storage-harness-01-initial'));

    const importState = await evaluate(client, script(async () => {
        const stateManager = await import('/src/state/state-manager.js');
        const libraryStorage = await import('/src/storage/saga-lorepack-library-storage.js');
        const payloadStorage = await import('/src/storage/saga-lorepack-payload-storage.js');
        const themeIconStorage = await import('/src/storage/saga-theme-icon-storage.js');
        libraryStorage.resetSagaLorepackLibraryStorageCache();
        payloadStorage.resetSagaLorepackPayloadStorageCache();
        themeIconStorage.resetSagaThemeIconStorageCache();

        const ctx = window.SillyTavern?.getContext?.();
        const packId = 'storage-smoke-arlong';
        const coverDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
        const pack = {
            packId,
            id: packId,
            type: 'custom',
            title: 'Storage Smoke Arlong Park',
            description: 'Browser storage smoke fixture.',
            fandom: 'One Piece',
            entrySchemaVersion: 3,
            source: {
                kind: 'imported_zip',
                importedFrom: 'storage-smoke.saga-loredeck.zip',
            },
            stats: { entryCount: 2, categoryCounts: { character: 1, event: 1 } },
            manifestData: {
                id: packId,
                title: 'Storage Smoke Arlong Park',
                entrySchemaVersion: 3,
                stats: { entryCount: 2 },
                files: [],
                registries: {},
                assets: {
                    cover: {
                        path: coverDataUrl,
                        alt: 'Storage smoke cover',
                    },
                },
            },
            assets: {
                cover: {
                    path: coverDataUrl,
                    alt: 'Storage smoke cover',
                },
            },
            entryOverrides: {
                storage_smoke_nami: {
                    id: 'storage_smoke_nami',
                    schemaVersion: 3,
                    title: 'Storage Smoke Nami',
                    category: 'character',
                    relevance: 'high',
                    tags: ['character:nami', 'arc:arlong-park'],
                    content: {
                        fact: 'Storage smoke unique fact: Nami bargains with Arlong.',
                        injection: 'Storage smoke unique injection: Nami hides fear while bargaining.',
                    },
                },
                storage_smoke_tribute: {
                    id: 'storage_smoke_tribute',
                    schemaVersion: 3,
                    title: 'Storage Smoke Tribute',
                    category: 'event',
                    relevance: 'normal',
                    tags: ['arc:arlong-park'],
                    content: {
                        fact: 'Storage smoke unique fact: Cocoyasi tribute pressure is active.',
                        injection: 'Storage smoke unique injection: villagers speak carefully about tribute.',
                    },
                },
            },
            tagRegistry: {
                schemaVersion: 1,
                tags: {
                    'character:nami': { id: 'character:nami', label: 'Nami' },
                    'arc:arlong-park': { id: 'arc:arlong-park', label: 'Arlong Park' },
                },
            },
            timelineRegistry: {
                schemaVersion: 1,
                anchors: [{ id: 'storage_smoke_arlong_start', title: 'Storage Smoke Arlong Park Start' }],
                windows: [],
            },
        };

        const upsert = stateManager.upsertLoredeckLibraryPack(pack);
        const payloadFlush = await payloadStorage.flushSagaLorepackPayloadStorageWrites();
        const libraryFlush = await libraryStorage.flushSagaLorepackLibraryStorageWrites();
        const themeImport = await themeIconStorage.importExternalThemePack({
            id: 'storage-smoke-theme',
            type: 'custom',
            title: 'Storage Smoke Theme',
            description: 'Browser storage smoke Theme Pack fixture.',
            author: 'Saga Smoke',
            version: '1.0.0',
            colors: {
                background: '#111111',
                surface: '#222222',
                accent: '#d7b56d',
                chipWarning: '#e0c184',
            },
            tags: ['theme:storage-smoke'],
            source: { kind: 'local', url: 'storage-smoke.theme.json' },
        }, { sourceFileName: 'storage-smoke.theme.json' });
        const iconImport = await themeIconStorage.importExternalIconSet({
            id: 'storage-smoke-icons',
            type: 'custom',
            title: 'Storage Smoke Icons',
            description: 'Browser storage smoke Icon Set fixture.',
            preferredSize: 256,
            icons: {
                'tab.loredecks': 'data:image/png;base64,iVBORw0KGgo=',
                'tab.settings': './assets/iconsets/saga-hero/hero-tab-settings-256.png',
            },
            tags: ['icons:storage-smoke'],
            source: { kind: 'local', url: 'storage-smoke.iconset.json' },
        }, { sourceFileName: 'storage-smoke.iconset.json' });
        if (themeImport.ok && iconImport.ok && ctx?.extensionSettings?.saga) {
            ctx.extensionSettings.saga.themePackId = 'storage-smoke-theme';
            ctx.extensionSettings.saga.themeIconSetId = 'storage-smoke-icons';
            ctx.saveSettingsDebounced?.();
        }
        const registry = stateManager.getLoredeckLibraryRegistry(stateManager.getState());
        const row = registry.packs?.[packId] || null;
        const payloadResponse = row?.payloadFile ? await fetch(row.payloadFile) : null;
        const payload = payloadResponse?.ok ? await payloadResponse.json() : null;
        const themePayloadResponse = themeImport.payloadFile ? await fetch(themeImport.payloadFile) : null;
        const themePayload = themePayloadResponse?.ok ? await themePayloadResponse.json() : null;
        const iconPayloadResponse = iconImport.payloadFile ? await fetch(iconImport.payloadFile) : null;
        const iconPayload = iconPayloadResponse?.ok ? await iconPayloadResponse.json() : null;
        const iconAssetFile = iconPayload?.icons?.['tab.loredecks'] || '';
        const verify = await stateManager.verifySagaStorageIntegrity({ write: true });
        const settingsText = JSON.stringify(ctx?.extensionSettings?.saga || {});
        const storageSnapshot = await (await fetch('/__saga-storage-smoke')).json();

        return {
            ok: !!(
                upsert.ok
                && payloadFlush.ok
                && libraryFlush.ok
                && themeImport.ok
                && iconImport.ok
                && row
                && payload
                && themePayload
                && iconPayload
                && iconAssetFile
                && verify.ok
            ),
            upsert,
            payloadFlush,
            libraryFlush,
            themeImport,
            iconImport,
            verify,
            row,
            payloadFile: row?.payloadFile || '',
            coverFile: row?.coverFile || payload?.assetRefs?.cover || payload?.assets?.cover?.path || '',
            payloadEntryCount: Object.keys(payload?.entryOverrides || {}).length,
            payloadHasUniqueFact: JSON.stringify(payload || {}).includes('Storage smoke unique fact'),
            themePayloadFile: themeImport.payloadFile || '',
            themePayloadOk: themePayload?.title === 'Storage Smoke Theme' && themePayload?.colors?.accent === '#d7b56d',
            iconPayloadFile: iconImport.payloadFile || '',
            iconAssetFile,
            iconPayloadOk: iconPayload?.title === 'Storage Smoke Icons' && String(iconAssetFile).startsWith('/user/files/saga-iconset-asset-storage-smoke-icons-tab-loredecks-'),
            activeThemeSaved: ctx?.extensionSettings?.saga?.themePackId === 'storage-smoke-theme',
            activeIconSetSaved: ctx?.extensionSettings?.saga?.themeIconSetId === 'storage-smoke-icons',
            settingsBytes: settingsText.length,
            settingsHasPayload: settingsText.includes('Storage smoke unique fact')
                || settingsText.includes('storage_smoke_nami')
                || settingsText.includes('Storage Smoke Theme')
                || settingsText.includes('Storage Smoke Icons'),
            storageSnapshot,
        };
    }));

    if (!importState.ok) findings.push('Storage harness could not import and externalize the browser fixture Loredeck.');
    if (!importState.row?.payloadFile) findings.push('Storage harness imported Library row did not keep a payloadFile pointer.');
    if (!importState.coverFile) findings.push('Storage harness did not materialize the imported cover asset.');
    if (importState.payloadEntryCount !== 2) findings.push(`Storage harness payload entry count was ${importState.payloadEntryCount || 0} instead of 2.`);
    if (!importState.payloadHasUniqueFact) findings.push('Storage harness payload file did not retain the unique fixture Lorecard content.');
    if (!importState.themePayloadOk) findings.push('Storage harness Theme Pack payload did not persist expected data.');
    if (!importState.iconPayloadOk) findings.push('Storage harness Icon Set payload did not persist expected data or materialize its raster asset.');
    if (importState.settingsHasPayload) findings.push('Storage harness wrote full Saga payload content into extension settings.');
    if (!importState.verify?.ok) findings.push(`Storage harness verify after import failed: ${importState.verify?.error || importState.verify?.status || 'unknown'}.`);
    if (!importState.storageSnapshot?.files?.includes(importState.row?.payloadFile)) findings.push('Storage harness server did not store the Lorepack payload file.');
    if (!importState.storageSnapshot?.files?.includes(importState.coverFile)) findings.push('Storage harness server did not store the materialized cover file.');
    if (!importState.storageSnapshot?.files?.includes(importState.themePayloadFile)) findings.push('Storage harness server did not store the Theme Pack payload file.');
    if (!importState.storageSnapshot?.files?.includes(importState.iconPayloadFile)) findings.push('Storage harness server did not store the Icon Set payload file.');
    if (!importState.storageSnapshot?.files?.includes(importState.iconAssetFile)) findings.push('Storage harness server did not store the Icon Set raster asset file.');
    screenshots.push(await screenshot(client, 'storage-harness-02-after-import'));

    await client.send('Page.navigate', { url: smokeUrl });
    await waitFor(client, script(url => location.href === url && document.readyState === 'complete', smokeUrl), 'Storage smoke reload', 20000);
    await waitFor(client, 'window.__sagaSmokeReady === true', 'Storage smoke ready after reload', 20000);
    await wait(800);

    const healthOpenState = await evaluate(client, script(async packId => {
        const libraryStorage = await import('/src/storage/saga-lorepack-library-storage.js');
        const healthPanel = await import('/src/loredecks/loredeck-health-panel.js');
        await libraryStorage.hydrateSagaLorepackLibraryStorage({ force: true });
        healthPanel.openLoredeckHealthCenter(packId, { tab: 'overview' });
        const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
        const text = overlay?.innerText || overlay?.textContent || '';
        return {
            opened: !!overlay,
            hasTitle: text.includes('Pack Health Center'),
            hasPackTitle: text.includes('Storage Smoke Arlong Park'),
            hasRefreshScan: [...(overlay?.querySelectorAll('button') || [])]
                .some(button => (button.innerText || button.textContent || '').trim() === 'Refresh Scan' && !button.disabled),
            text: text.slice(0, 1000),
        };
    }, 'storage-smoke-arlong'));
    if (!healthOpenState.opened) findings.push('Storage harness could not open Pack Health Center for the external Loredeck.');
    if (healthOpenState.opened && !healthOpenState.hasPackTitle) findings.push('Storage harness Pack Health Center did not identify the external Loredeck title.');
    if (healthOpenState.opened && !healthOpenState.hasRefreshScan) findings.push('Storage harness Pack Health Center did not expose an enabled Refresh Scan action.');
    screenshots.push(await screenshot(client, 'storage-harness-03-health-before-scan'));

    if (healthOpenState.opened && healthOpenState.hasRefreshScan) {
        const refreshClicked = await clickButtonText(client, 'Refresh Scan', { root: '.saga-loredeck-health-center-overlay' });
        if (!refreshClicked) {
            findings.push('Storage harness could not click Pack Health Center Refresh Scan.');
        } else {
            await waitFor(client, script(async packId => {
                const healthPanel = await import('/src/loredecks/loredeck-health-panel.js');
                return !!healthPanel.getCachedLoredeckHealthRecord(packId)?.health;
            }, 'storage-smoke-arlong'), 'Storage smoke Pack Health cache after Refresh Scan', 20000);
        }
    }

    const healthScanState = await evaluate(client, script(async packId => {
        const stateManager = await import('/src/state/state-manager.js');
        const healthPanel = await import('/src/loredecks/loredeck-health-panel.js');
        const payloadStorage = await import('/src/storage/saga-lorepack-payload-storage.js');
        await payloadStorage.flushSagaLorepackPayloadStorageWrites();
        const cached = healthPanel.getCachedLoredeckHealthRecord(packId);
        const registry = stateManager.getLoredeckLibraryRegistry(stateManager.getState());
        const row = registry.packs?.[packId] || null;
        const payloadResponse = row?.payloadFile ? await fetch(row.payloadFile) : null;
        const payload = payloadResponse?.ok ? await payloadResponse.json() : null;
        const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
        const overlayText = overlay?.innerText || overlay?.textContent || '';
        const settingsText = JSON.stringify(window.SillyTavern?.getContext?.()?.extensionSettings?.saga || {});
        return {
            ok: !!(cached?.health && row?.healthStatus && payload?.healthStatus && !settingsText.includes('Storage smoke unique fact')),
            cachedStatus: cached?.health?.status || '',
            cachedEntryCount: Number(cached?.health?.summary?.entryCount) || 0,
            rowHealthStatus: row?.healthStatus || '',
            payloadHealthStatus: payload?.healthStatus || '',
            payloadEntryCount: Object.keys(payload?.entryOverrides || {}).length,
            settingsHasPayload: settingsText.includes('Storage smoke unique fact') || settingsText.includes('storage_smoke_nami'),
            overlayHasScannedPack: overlayText.includes('Storage Smoke Arlong Park') && overlayText.includes('Pack Health Center'),
            overlayText: overlayText.slice(0, 1200),
        };
    }, 'storage-smoke-arlong'));
    if (!healthScanState.ok) findings.push(`Storage harness Pack Health Refresh Scan did not persist a clean external payload-backed health summary (${healthScanState.cachedStatus || 'missing'} / ${healthScanState.rowHealthStatus || 'missing'} / ${healthScanState.payloadHealthStatus || 'missing'}).`);
    if (healthScanState.cachedEntryCount !== 2) findings.push(`Storage harness Pack Health scanned ${healthScanState.cachedEntryCount || 0} Lorecards instead of 2.`);
    if (healthScanState.payloadEntryCount !== 2) findings.push(`Storage harness Pack Health payload retained ${healthScanState.payloadEntryCount || 0} Lorecards instead of 2.`);
    if (healthScanState.settingsHasPayload) findings.push('Storage harness Pack Health scan wrote Lorecard payload content into settings.');
    if (!healthScanState.overlayHasScannedPack) findings.push('Storage harness Pack Health Center did not remain open on the scanned external Loredeck.');
    screenshots.push(await screenshot(client, 'storage-harness-04-health-after-scan'));
    await clickButtonText(client, 'Close', { root: '.saga-loredeck-health-center-overlay', enabledOnly: false });
    await wait(400);

    await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="settings"]');
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "settings"', 'Storage smoke Settings tab active', 10000);
    await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Settings")', 'Storage smoke Settings drawer', 10000);
    if (!(await openSummaryText(client, 'Theme Pack', { root: '.saga-runtime-drawer' }))) {
        findings.push('Storage harness Settings drawer did not expose the Theme Pack section.');
    }
    await waitFor(client, '!!document.querySelector(".saga-settings-theme-card")', 'Storage smoke Theme Pack settings card', 10000);

    const themeIconUiState = {
        before: await evaluate(client, script(async () => {
            const stateManager = await import('/src/state/state-manager.js');
            const themeIconStorage = await import('/src/storage/saga-theme-icon-storage.js');
            const runtimeTheme = await import('/src/theme/runtime-theme.js');
            await themeIconStorage.hydrateSagaThemeIconStorage({ force: true });
            const settings = stateManager.getSettings();
            const activeTheme = runtimeTheme.getThemePreset(settings.themePackId, settings);
            const activeIconSet = runtimeTheme.getIconSetPreset(settings.themeIconSetId, settings);
            const themeRegistry = themeIconStorage.getExternalThemePackLibraryRegistry();
            const iconRegistry = themeIconStorage.getExternalThemeIconSetLibraryRegistry();
            const themeRow = themeRegistry.packs?.['storage-smoke-theme'] || null;
            const iconRow = iconRegistry.iconSets?.['storage-smoke-icons'] || null;
            const card = document.querySelector('.saga-settings-theme-card');
            const text = card?.innerText || card?.textContent || '';
            const buttons = [...(card?.querySelectorAll('button') || [])]
                .map(button => ({ label: (button.innerText || button.textContent || '').trim(), disabled: !!button.disabled }))
                .filter(button => button.label);
            return {
                ok: !!(
                    themeRow
                    && iconRow
                    && settings.themePackId === 'storage-smoke-theme'
                    && settings.themeIconSetId === 'storage-smoke-icons'
                    && activeTheme?.id === 'storage-smoke-theme'
                    && activeIconSet?.id === 'storage-smoke-icons'
                    && buttons.some(button => button.label === 'Forget Theme Pack' && !button.disabled)
                    && buttons.some(button => button.label === 'Forget Icon Set' && !button.disabled)
                ),
                activeThemeId: activeTheme?.id || '',
                activeIconSetId: activeIconSet?.id || '',
                settingsThemePackId: settings.themePackId || '',
                settingsIconSetId: settings.themeIconSetId || '',
                themePayloadFile: themeRow?.payloadFile || '',
                iconPayloadFile: iconRow?.payloadFile || '',
                iconAssetFile: iconRow?.icons?.['tab.loredecks'] || '',
                hasForgetThemePack: buttons.some(button => button.label === 'Forget Theme Pack' && !button.disabled),
                hasForgetIconSet: buttons.some(button => button.label === 'Forget Icon Set' && !button.disabled),
                text: text.slice(0, 1400),
                buttons,
            };
        })),
        iconForget: {},
        themeForget: {},
        after: {},
    };
    if (!themeIconUiState.before.ok) findings.push(`Storage harness Settings Theme/Icon card did not render active custom Theme/Icon forget controls (${themeIconUiState.before.activeThemeId || 'missing'} / ${themeIconUiState.before.activeIconSetId || 'missing'}).`);
    screenshots.push(await screenshot(client, 'storage-harness-05-theme-icon-before-forget'));

    const iconForgetClicked = await clickButtonText(client, 'Forget Icon Set', { root: '.saga-settings-theme-card' });
    themeIconUiState.iconForget.clicked = iconForgetClicked;
    if (!iconForgetClicked) {
        findings.push('Storage harness could not click the visible Forget Icon Set control.');
    } else {
        await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'Storage smoke Forget Icon Set confirmation', 10000);
        themeIconUiState.iconForget.prompt = await evaluate(client, script(() => {
            const prompt = document.querySelector('.saga-confirm-overlay');
            const text = prompt?.innerText || prompt?.textContent || '';
            const buttons = [...(prompt?.querySelectorAll('button') || [])].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            return {
                hasPrompt: !!prompt,
                hasTitle: text.includes('Forget Icon Set'),
                hasCustomName: text.includes('Storage Smoke Icons'),
                hasConfirm: buttons.includes('Confirm'),
                text: text.slice(0, 600),
                buttons,
            };
        }));
        if (!themeIconUiState.iconForget.prompt?.hasTitle || !themeIconUiState.iconForget.prompt?.hasConfirm) findings.push('Storage harness Forget Icon Set confirmation did not render the expected Saga dialog.');
        themeIconUiState.iconForget.confirmed = await clickButtonText(client, 'Confirm', { root: '.saga-confirm-overlay', enabledOnly: false });
        if (!themeIconUiState.iconForget.confirmed) findings.push('Storage harness could not confirm Forget Icon Set.');
        await waitFor(client, '!document.querySelector(".saga-confirm-overlay")', 'Storage smoke Forget Icon Set confirmation close', 10000);
        await wait(700);
    }

    const themeForgetClicked = await clickButtonText(client, 'Forget Theme Pack', { root: '.saga-settings-theme-card' });
    themeIconUiState.themeForget.clicked = themeForgetClicked;
    if (!themeForgetClicked) {
        findings.push('Storage harness could not click the visible Forget Theme Pack control.');
    } else {
        await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'Storage smoke Forget Theme Pack confirmation', 10000);
        themeIconUiState.themeForget.prompt = await evaluate(client, script(() => {
            const prompt = document.querySelector('.saga-confirm-overlay');
            const text = prompt?.innerText || prompt?.textContent || '';
            const buttons = [...(prompt?.querySelectorAll('button') || [])].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            return {
                hasPrompt: !!prompt,
                hasTitle: text.includes('Forget Theme Pack'),
                hasCustomName: text.includes('Storage Smoke Theme'),
                hasConfirm: buttons.includes('Confirm'),
                text: text.slice(0, 600),
                buttons,
            };
        }));
        if (!themeIconUiState.themeForget.prompt?.hasTitle || !themeIconUiState.themeForget.prompt?.hasConfirm) findings.push('Storage harness Forget Theme Pack confirmation did not render the expected Saga dialog.');
        themeIconUiState.themeForget.confirmed = await clickButtonText(client, 'Confirm', { root: '.saga-confirm-overlay', enabledOnly: false });
        if (!themeIconUiState.themeForget.confirmed) findings.push('Storage harness could not confirm Forget Theme Pack.');
        await waitFor(client, '!document.querySelector(".saga-confirm-overlay")', 'Storage smoke Forget Theme Pack confirmation close', 10000);
        await wait(900);
    }

    themeIconUiState.after = await evaluate(client, script(async before => {
        const stateManager = await import('/src/state/state-manager.js');
        const themeIconStorage = await import('/src/storage/saga-theme-icon-storage.js');
        const runtimeTheme = await import('/src/theme/runtime-theme.js');
        themeIconStorage.resetSagaThemeIconStorageCache();
        await themeIconStorage.hydrateSagaThemeIconStorage({ force: true });
        const settings = stateManager.getSettings();
        const activeTheme = runtimeTheme.getThemePreset(settings.themePackId, settings);
        const activeIconSet = runtimeTheme.getIconSetPreset(settings.themeIconSetId, settings);
        const themeRegistry = themeIconStorage.getExternalThemePackLibraryRegistry();
        const iconRegistry = themeIconStorage.getExternalThemeIconSetLibraryRegistry();
        const themeRead = before.themePayloadFile ? await fetch(before.themePayloadFile) : null;
        const iconRead = before.iconPayloadFile ? await fetch(before.iconPayloadFile) : null;
        const iconAssetRead = before.iconAssetFile ? await fetch(before.iconAssetFile) : null;
        const storageSnapshot = await (await fetch('/__saga-storage-smoke')).json();
        const card = document.querySelector('.saga-settings-theme-card');
        const text = card?.innerText || card?.textContent || '';
        return {
            ok: !!(
                settings.themePackId !== 'storage-smoke-theme'
                && settings.themeIconSetId !== 'storage-smoke-icons'
                && activeTheme?.id !== 'storage-smoke-theme'
                && activeIconSet?.id !== 'storage-smoke-icons'
                && !themeRegistry.packs?.['storage-smoke-theme']
                && !iconRegistry.iconSets?.['storage-smoke-icons']
                && (!before.themePayloadFile || themeRead?.status === 404)
                && (!before.iconPayloadFile || iconRead?.status === 404)
                && (!before.iconAssetFile || iconAssetRead?.status === 404)
                && !text.includes('Forget Theme Pack')
                && !text.includes('Forget Icon Set')
            ),
            settingsThemePackId: settings.themePackId || '',
            settingsIconSetId: settings.themeIconSetId || '',
            activeThemeId: activeTheme?.id || '',
            activeIconSetId: activeIconSet?.id || '',
            themeStillInstalled: !!themeRegistry.packs?.['storage-smoke-theme'],
            iconStillInstalled: !!iconRegistry.iconSets?.['storage-smoke-icons'],
            themePayloadReadStatusAfterForget: themeRead?.status || 0,
            iconPayloadReadStatusAfterForget: iconRead?.status || 0,
            iconAssetReadStatusAfterForget: iconAssetRead?.status || 0,
            hasForgetThemePack: text.includes('Forget Theme Pack'),
            hasForgetIconSet: text.includes('Forget Icon Set'),
            text: text.slice(0, 1400),
            storageSnapshot,
        };
    }, themeIconUiState.before));
    if (!themeIconUiState.after.ok) findings.push(`Storage harness visible Theme/Icon forget flow did not fully clean up external files and active settings (${themeIconUiState.after.activeThemeId || 'missing'} / ${themeIconUiState.after.activeIconSetId || 'missing'}).`);
    screenshots.push(await screenshot(client, 'storage-harness-06-theme-icon-after-forget'));

    await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="loredecks"]');
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "loredecks"', 'Storage smoke Loredecks tab active after Theme/Icon forget', 10000);

    const reloadState = await evaluate(client, script(async args => {
        const packId = args.packId;
        const stateManager = await import('/src/state/state-manager.js');
        const libraryStorage = await import('/src/storage/saga-lorepack-library-storage.js');
        const payloadStorage = await import('/src/storage/saga-lorepack-payload-storage.js');
        const themeIconStorage = await import('/src/storage/saga-theme-icon-storage.js');
        const loader = await import('/src/loredecks/loredeck-loader.js');
        const libraryPanel = await import('/src/loredecks/loredeck-library-panel.js');
        libraryStorage.resetSagaLorepackLibraryStorageCache();
        payloadStorage.resetSagaLorepackPayloadStorageCache();
        themeIconStorage.resetSagaThemeIconStorageCache();
        await libraryStorage.hydrateSagaLorepackLibraryStorage({ force: true });
        await themeIconStorage.hydrateSagaThemeIconStorage({ force: true });

        const registry = stateManager.getLoredeckLibraryRegistry(stateManager.getState());
        const row = registry.packs?.[packId] || null;
        const hydrated = row ? await payloadStorage.hydrateExternalLorepackPayloadRecord(row) : null;
        const loadedSource = row ? await loader.loadLoredeckSourceById(packId, { registry }) : null;
        const themeRegistry = themeIconStorage.getExternalThemePackLibraryRegistry();
        const iconRegistry = themeIconStorage.getExternalThemeIconSetLibraryRegistry();
        const themeRow = themeRegistry.packs?.['storage-smoke-theme'] || null;
        const iconRow = iconRegistry.iconSets?.['storage-smoke-icons'] || null;
        const verifyBeforeDelete = await stateManager.verifySagaStorageIntegrity({ write: true });

        const waitUntil = async (predicate, attempts = 50) => {
            for (let index = 0; index < attempts; index += 1) {
                if (predicate()) return true;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return false;
        };
        const uiDelete = {
            opened: false,
            hasTransferPane: false,
            hasDeleteButton: false,
            hasEnabledDeleteButton: false,
            deleteButtons: [],
            selectedCountText: '',
            clicked: false,
            hasPrompt: false,
            promptText: '',
            hasConfirmButton: false,
            confirmed: false,
            deleted: false,
        };
        if (row) {
            const getVisibleDeleteButton = overlay => {
                const buttons = [...(overlay?.querySelectorAll('button') || [])];
                const byAria = buttons.find(button => (button.getAttribute('aria-label') || '').trim() === 'Delete');
                if (byAria) return byAria;
                const groups = [...(overlay?.querySelectorAll('.saga-loredeck-library-square-action-group') || [])];
                for (const group of groups) {
                    const label = (group.querySelector('.saga-loredeck-library-square-action-label')?.innerText
                        || group.querySelector('.saga-loredeck-library-square-action-label')?.textContent
                        || '').trim();
                    if (label === 'Delete') return group.querySelector('button');
                }
                return null;
            };
            libraryPanel.openLoredeckLibraryDetails(packId);
            libraryPanel.setLoredeckLibraryBulkSelection([packId], packId);
            libraryPanel.renderLoredeckLibraryOverlay({ preserveScroll: true });
            await waitUntil(() => !!document.querySelector('.saga-loredeck-library-overlay .saga-loredeck-library-details'));
            await waitUntil(() => {
                const overlay = document.querySelector('.saga-loredeck-library-overlay');
                return !!overlay?.querySelector('.saga-loredeck-library-transfer-pane')
                    && !!getVisibleDeleteButton(overlay);
            });
            const overlay = document.querySelector('.saga-loredeck-library-overlay');
            uiDelete.opened = !!overlay;
            uiDelete.hasTransferPane = !!overlay?.querySelector('.saga-loredeck-library-transfer-pane');
            uiDelete.selectedCountText = [...(overlay?.querySelectorAll('.saga-loredeck-row-meta .saga-status-pill, .saga-status-pill') || [])]
                .map(item => (item.innerText || item.textContent || '').trim())
                .find(text => /\bselected\b/i.test(text)) || '';
            uiDelete.deleteButtons = [...(overlay?.querySelectorAll('.saga-loredeck-library-square-action-group') || [])]
                .map(group => {
                    const button = group.querySelector('button');
                    const label = (group.querySelector('.saga-loredeck-library-square-action-label')?.innerText
                        || group.querySelector('.saga-loredeck-library-square-action-label')?.textContent
                        || button?.getAttribute('aria-label')
                        || '').trim();
                    return {
                        label,
                        ariaLabel: button?.getAttribute('aria-label') || '',
                        disabled: button?.disabled === true,
                        className: button?.className || '',
                    };
                })
                .filter(button => button.label === 'Delete' || button.ariaLabel === 'Delete' || /delete/i.test(button.className));
            const deleteButton = getVisibleDeleteButton(overlay);
            uiDelete.hasDeleteButton = !!deleteButton;
            uiDelete.hasEnabledDeleteButton = !!deleteButton && deleteButton.disabled !== true;
            if (deleteButton) {
                deleteButton.scrollIntoView({ block: 'center', inline: 'center' });
                if (deleteButton.disabled !== true) {
                    deleteButton.click();
                    uiDelete.clicked = true;
                }
                await waitUntil(() => !!document.querySelector('.saga-confirm-overlay'));
                const prompt = document.querySelector('.saga-confirm-overlay');
                uiDelete.hasPrompt = !!prompt;
                uiDelete.promptText = (prompt?.innerText || prompt?.textContent || '').slice(0, 600);
                const confirmButton = [...(prompt?.querySelectorAll('button') || [])]
                    .find(button => (button.innerText || button.textContent || '').trim() === 'Confirm' && !button.disabled);
                uiDelete.hasConfirmButton = !!confirmButton;
                if (confirmButton) {
                    confirmButton.click();
                    uiDelete.confirmed = true;
                    await waitUntil(() => !stateManager.getLoredeckLibraryRegistry(stateManager.getState()).packs?.[packId]);
                }
            }
            uiDelete.deleted = !stateManager.getLoredeckLibraryRegistry(stateManager.getState()).packs?.[packId];
        }
        const remove = row
            ? {
                ok: uiDelete.deleted,
                uiDelete,
                error: uiDelete.deleted
                    ? ''
                    : (!uiDelete.opened ? 'library overlay did not open' : (!uiDelete.hasDeleteButton ? 'delete button missing' : (!uiDelete.hasEnabledDeleteButton ? 'delete button disabled' : (!uiDelete.hasPrompt ? 'delete confirmation missing' : (!uiDelete.hasConfirmButton ? 'delete confirmation button missing' : 'pack still present after UI delete'))))),
            }
            : { ok: false, error: 'missing row after reload', uiDelete };
        const payloadFlush = await payloadStorage.flushSagaLorepackPayloadStorageWrites();
        const libraryFlush = await libraryStorage.flushSagaLorepackLibraryStorageWrites();
        const verifyAfterDelete = await stateManager.verifySagaStorageIntegrity({ write: true });
        const payloadReadAfterDelete = row?.payloadFile ? await fetch(row.payloadFile) : null;
        const coverFile = row?.coverFile || hydrated?.assetRefs?.cover || hydrated?.assets?.cover?.path || '';
        const coverReadAfterDelete = coverFile ? await fetch(coverFile) : null;
        const themeReadAfterDelete = args.themePayloadFile ? await fetch(args.themePayloadFile) : null;
        const iconReadAfterDelete = args.iconPayloadFile ? await fetch(args.iconPayloadFile) : null;
        const iconAssetReadAfterDelete = args.iconAssetFile ? await fetch(args.iconAssetFile) : null;
        const registryAfterDelete = stateManager.getLoredeckLibraryRegistry(stateManager.getState());
        const themeRegistryAfterDelete = themeIconStorage.getExternalThemePackLibraryRegistry();
        const iconRegistryAfterDelete = themeIconStorage.getExternalThemeIconSetLibraryRegistry();
        const storageSnapshot = await (await fetch('/__saga-storage-smoke')).json();

        return {
            ok: !!(
                row
                && hydrated
                && loadedSource?.entryFiles?.[0]?.entries?.length === 2
                && verifyBeforeDelete.ok
                && remove.ok
                && payloadFlush.ok
                && libraryFlush.ok
                && verifyAfterDelete.ok
                && payloadReadAfterDelete
                && payloadReadAfterDelete.status === 404
                && (!coverFile || coverReadAfterDelete?.status === 404)
                && (!args.themePayloadFile || themeReadAfterDelete?.status === 404)
                && (!args.iconPayloadFile || iconReadAfterDelete?.status === 404)
                && (!args.iconAssetFile || iconAssetReadAfterDelete?.status === 404)
                && !registryAfterDelete.packs?.[packId]
                && !themeRegistryAfterDelete.packs?.['storage-smoke-theme']
                && !iconRegistryAfterDelete.iconSets?.['storage-smoke-icons']
            ),
            row,
            themeRow,
            iconRow,
            hydratedEntryCount: Object.keys(hydrated?.entryOverrides || {}).length,
            loadedEntryCount: loadedSource?.entryFiles?.[0]?.entries?.length || 0,
            verifyBeforeDelete,
            remove,
            payloadFlush,
            libraryFlush,
            verifyAfterDelete,
            payloadReadStatusAfterDelete: payloadReadAfterDelete?.status || 0,
            coverFile,
            coverReadStatusAfterDelete: coverReadAfterDelete?.status || 0,
            themePayloadFile: args.themePayloadFile || '',
            themePayloadReadStatusAfterDelete: themeReadAfterDelete?.status || 0,
            iconPayloadFile: args.iconPayloadFile || '',
            iconPayloadReadStatusAfterDelete: iconReadAfterDelete?.status || 0,
            iconAssetFile: args.iconAssetFile || '',
            iconAssetReadStatusAfterDelete: iconAssetReadAfterDelete?.status || 0,
            stillInLibraryAfterDelete: !!registryAfterDelete.packs?.[packId],
            themeStillInstalledAfterDelete: !!themeRegistryAfterDelete.packs?.['storage-smoke-theme'],
            iconStillInstalledAfterDelete: !!iconRegistryAfterDelete.iconSets?.['storage-smoke-icons'],
            storageSnapshot,
        };
    }, {
        packId: 'storage-smoke-arlong',
        themePayloadFile: themeIconUiState.before.themePayloadFile || importState.themePayloadFile || '',
        iconPayloadFile: themeIconUiState.before.iconPayloadFile || importState.iconPayloadFile || '',
        iconAssetFile: themeIconUiState.before.iconAssetFile || importState.iconAssetFile || '',
    }), { label: 'Storage harness reload/delete verification', timeoutMs: 30000 });

    if (!reloadState.row) findings.push('Storage harness did not hydrate the imported Loredeck from external Library storage after reload.');
    if (reloadState.hydratedEntryCount !== 2) findings.push(`Storage harness hydrated ${reloadState.hydratedEntryCount || 0} Lorecards after reload instead of 2.`);
    if (reloadState.loadedEntryCount !== 2) findings.push(`Storage harness loader returned ${reloadState.loadedEntryCount || 0} entries after reload instead of 2.`);
    if (!reloadState.verifyBeforeDelete?.ok) findings.push(`Storage harness verify before delete failed: ${reloadState.verifyBeforeDelete?.error || reloadState.verifyBeforeDelete?.status || 'unknown'}.`);
    if (!reloadState.remove?.ok) findings.push(`Storage harness delete failed: ${reloadState.remove?.error || 'unknown'}.`);
    if (!reloadState.payloadFlush?.ok || !reloadState.libraryFlush?.ok) findings.push('Storage harness queued delete writes did not flush cleanly.');
    if (!reloadState.verifyAfterDelete?.ok) findings.push(`Storage harness verify after delete failed: ${reloadState.verifyAfterDelete?.error || reloadState.verifyAfterDelete?.status || 'unknown'}.`);
    if (reloadState.payloadReadStatusAfterDelete !== 404) findings.push('Storage harness payload file was still readable after delete.');
    if (reloadState.coverFile && reloadState.coverReadStatusAfterDelete !== 404) findings.push('Storage harness cover asset was still readable after delete.');
    if (reloadState.themePayloadFile && reloadState.themePayloadReadStatusAfterDelete !== 404) findings.push('Storage harness Theme Pack payload file was still readable after visible forget.');
    if (reloadState.iconPayloadFile && reloadState.iconPayloadReadStatusAfterDelete !== 404) findings.push('Storage harness Icon Set payload file was still readable after visible forget.');
    if (reloadState.iconAssetFile && reloadState.iconAssetReadStatusAfterDelete !== 404) findings.push('Storage harness Icon Set raster asset was still readable after delete.');
    if (reloadState.stillInLibraryAfterDelete) findings.push('Storage harness Library registry still contained the deleted Loredeck.');
    if (reloadState.themeStillInstalledAfterDelete) findings.push('Storage harness Theme Pack registry still contained the deleted Theme Pack.');
    if (reloadState.iconStillInstalledAfterDelete) findings.push('Storage harness Icon Set registry still contained the deleted Icon Set.');
    if (!reloadState.storageSnapshot?.deleted?.includes(importState.row?.payloadFile)) findings.push('Storage harness server did not receive a payload delete request.');
    if (importState.coverFile && !reloadState.storageSnapshot?.deleted?.includes(importState.coverFile)) findings.push('Storage harness server did not receive a cover asset delete request.');
    if (themeIconUiState.before.themePayloadFile && !reloadState.storageSnapshot?.deleted?.includes(themeIconUiState.before.themePayloadFile)) findings.push('Storage harness visible Forget Theme Pack did not send a payload delete request.');
    if (themeIconUiState.before.iconPayloadFile && !reloadState.storageSnapshot?.deleted?.includes(themeIconUiState.before.iconPayloadFile)) findings.push('Storage harness visible Forget Icon Set did not send a payload delete request.');
    if (themeIconUiState.before.iconAssetFile && !reloadState.storageSnapshot?.deleted?.includes(themeIconUiState.before.iconAssetFile)) findings.push('Storage harness visible Forget Icon Set did not send a raster asset delete request.');
    if (!reloadState.ok) findings.push('Storage harness reload/delete persistence scenario did not satisfy all invariants.');
    screenshots.push(await screenshot(client, 'storage-harness-07-after-delete'));

    const errors = client.events
        .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
        .map(event => formatLogEntry(event.params.entry))
        .filter(error => !isExpectedStorageHarness404(error));
    console.log(JSON.stringify({
        ok: findings.length === 0 && errors.length === 0,
        target: SMOKE_TARGET,
        url: smokeUrl,
        screenshots,
            findings,
            errors,
            dialogEvents,
            importState,
            healthOpenState,
            healthScanState,
            reloadState,
            serverStorage: harness?.storage?.snapshot?.() || null,
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
    let sagaSettingsRestoreNeeded = false;
    let sagaSettingsRestored = false;
    let client;
    try {
        const { browserWsUrl, pageWsUrl, pageTargetId } = await waitForDevtools(port);
        await wait(1000);
        const cdpStartupDetails = {
            target: SMOKE_TARGET,
            smokeUrl,
            chrome,
            headless,
            browserWsUrl,
            pageWsUrl,
            pageTargetId,
        };
        client = new CdpClient(pageWsUrl || browserWsUrl);
        await client.connect();
        if (!pageWsUrl) {
            const attached = await sendStartupCdpCommand(client, 'Target.attachToTarget', { targetId: pageTargetId, flatten: true }, cdpStartupDetails);
            client.sessionId = attached.sessionId;
        }
        await sendStartupCdpCommand(client, 'Page.enable', {}, cdpStartupDetails);
        await sendStartupCdpCommand(client, 'Runtime.enable', {}, cdpStartupDetails);
        await sendStartupCdpCommand(client, 'Log.enable', {}, cdpStartupDetails);

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

        if (SMOKE_TARGET === 'creator-harness') {
            await runCreatorHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents);
            return;
        }

        if (SMOKE_TARGET === STORAGE_HARNESS_TARGET) {
            await runStorageHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents, harness);
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
                sagaSettingsRestoreNeeded = !!sagaSettingsSnapshot;
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
            findings.push(`Live ST could not select a Loredeck before opening Pack Health Center (${librarySelection.mode}).`);
        } else {
            const healthClicked = await clickButtonText(client, 'Open Pack Health Center', { root: '.saga-loredeck-library-overlay' });
            if (!healthClicked) {
                findings.push(`Live ST selected a Loredeck through ${librarySelection.mode}, but Open Pack Health Center was not clickable.`);
            } else {
                await waitFor(client, '!!document.querySelector(".saga-loredeck-health-center-overlay")', 'Pack Health Center');
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

        sagaSettingsSnapshot = await captureSagaSettings(client);
        const advancedModeState = await switchSagaExperienceMode(client, 'advanced');
        optionalSteps.advancedModeForStateSafety = advancedModeState;
        if (!advancedModeState?.ok) {
            findings.push(`Live ST smoke could not switch to Advanced Experience for State Safety: ${advancedModeState?.reason || 'unknown'}.`);
        } else if (advancedModeState.changed && sagaSettingsSnapshot) {
            sagaSettingsRestoreNeeded = true;
        }

        await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="settings"]');
        await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Settings")', 'Settings drawer');
        if (!(await scrollTextIntoView(client, 'State Safety'))) await setDrawerScroll(client, 9999);
        await wait(500);
        const stateSafetyStorage = await collectStateSafetyStorageSmoke(client);
        optionalSteps.stateSafetyStorage = stateSafetyStorage;
        if (!stateSafetyStorage.present) findings.push('Live ST Settings drawer did not render the Advanced State Safety section.');
        if (stateSafetyStorage.present && !stateSafetyStorage.open) findings.push('Live ST State Safety section did not open for storage checks.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasMigrationAction) findings.push('Live ST State Safety did not expose storage migration status/action.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasVerifyStorage) findings.push('Live ST State Safety did not expose Verify Storage.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasSettleStorageWrites) findings.push('Live ST State Safety did not expose Settle Storage Writes.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasCleanMissingRecords) findings.push('Live ST State Safety did not expose Clean Missing Records.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasStorageMigrationRow) findings.push('Live ST State Safety did not render Storage migration diagnostics.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasStorageIntegrityRow) findings.push('Live ST State Safety did not render Storage integrity diagnostics.');
        screenshots.push(await screenshot(client, 'live-st-07-state-safety'));

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
        if (client && sagaSettingsRestoreNeeded && !sagaSettingsRestored) {
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
