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
const LIVE_CREATOR_TARGET = 'live-creator';
const STORAGE_HARNESS_TARGET = 'storage-harness';
const MOBILE_ADVANCED_HARNESS_TARGET = 'mobile-advanced-harness';
const MOBILE_REDESIGN_HARNESS_TARGET = 'mobile-redesign-harness';
const TABLET_ADVANCED_HARNESS_TARGET = 'tablet-advanced-harness';
const REPO_LOCAL_HARNESS_TARGETS = new Set(['context-harness', 'guide-harness', 'creator-harness', MOBILE_ADVANCED_HARNESS_TARGET, MOBILE_REDESIGN_HARNESS_TARGET, TABLET_ADVANCED_HARNESS_TARGET, STORAGE_HARNESS_TARGET]);
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

async function fetchTextWithTimeout(url, options = {}) {
    if (typeof fetch !== 'function') throw new Error('Fetch is not available in this Node runtime.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Number(options.timeoutMs) || 10000));
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body,
            signal: controller.signal,
        });
        const text = await response.text();
        return {
            ok: response.ok,
            status: response.status,
            text,
        };
    } finally {
        clearTimeout(timeout);
    }
}

function userFileUrl(smokeUrl, userPath = '') {
    return new URL(String(userPath || '').replace(/^\/+/, '/'), smokeUrl).toString();
}

async function readLiveUserJson(smokeUrl, userPath = '', options = {}) {
    const result = await fetchTextWithTimeout(userFileUrl(smokeUrl, userPath), {
        headers: options.headers || {},
        timeoutMs: options.timeoutMs || 10000,
    });
    if (!result.ok) {
        return {
            ok: false,
            status: result.status,
            error: `HTTP ${result.status}`,
        };
    }
    try {
        return {
            ok: true,
            status: result.status,
            value: JSON.parse(result.text),
            bytes: result.text.length,
        };
    } catch (error) {
        return {
            ok: false,
            status: result.status,
            error: error?.message || String(error),
            bytes: result.text.length,
        };
    }
}

function mergeLiveJsonHeaders(headers = {}) {
    return {
        ...(headers || {}),
        'Content-Type': headers?.['Content-Type'] || headers?.['content-type'] || 'application/json',
    };
}

function base64EncodeUtf8(text = '') {
    return Buffer.from(String(text || ''), 'utf8').toString('base64');
}

async function postLiveFilesApiJson(smokeUrl, endpoint = '', body = {}, headers = {}, options = {}) {
    const result = await fetchTextWithTimeout(new URL(endpoint, smokeUrl).toString(), {
        method: 'POST',
        headers: mergeLiveJsonHeaders(headers),
        body: JSON.stringify(body || {}),
        timeoutMs: options.timeoutMs || 15000,
    });
    if (!result.ok) {
        return {
            ok: false,
            status: result.status,
            error: result.text.slice(0, 500) || `HTTP ${result.status}`,
        };
    }
    let value = null;
    if (result.text) {
        try {
            value = JSON.parse(result.text);
        } catch {
            value = result.text;
        }
    }
    return {
        ok: true,
        status: result.status,
        value,
    };
}

async function uploadLiveUserJson(smokeUrl, fileName = '', value = {}, headers = {}) {
    return postLiveFilesApiJson(smokeUrl, '/api/files/upload', {
        name: fileName,
        data: base64EncodeUtf8(`${JSON.stringify(value ?? null, null, 2)}\n`),
    }, headers);
}

async function deleteLiveUserFile(smokeUrl, userPath = '', headers = {}) {
    return postLiveFilesApiJson(smokeUrl, '/api/files/delete', {
        path: userPath,
    }, headers);
}

function getLiveCreatorUserFilesDir() {
    const explicit = String(process.env.SAGA_LIVE_CREATOR_USER_FILES_DIR || process.env.SAGA_ST_USER_FILES_DIR || '').trim();
    if (explicit) return path.resolve(explicit);
    const dataDir = String(process.env.SAGA_LIVE_CREATOR_DATA_DIR || process.env.SAGA_ST_DATA_DIR || '').trim();
    return dataDir ? path.join(path.resolve(dataDir), 'user', 'files') : '';
}

function normalizeLiveUserFilesPath(userPath = '') {
    let normalized = String(userPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    normalized = normalized.replace(/^user\/files\//i, '');
    const parts = normalized.split('/').filter(Boolean);
    if (!parts.length || parts.some(part => part === '.' || part === '..')) return '';
    return parts.join('/');
}

function liveUserFileFilesystemPath(userFilesDir = '', userPath = '') {
    const base = path.resolve(String(userFilesDir || '').trim());
    const normalized = normalizeLiveUserFilesPath(userPath);
    if (!base || !normalized) return '';
    const target = path.resolve(base, ...normalized.split('/'));
    if (target !== base && !target.startsWith(`${base}${path.sep}`)) return '';
    return target;
}

async function readLiveUserJsonFromFilesystem(userFilesDir = '', userPath = '') {
    const filePath = liveUserFileFilesystemPath(userFilesDir, userPath);
    if (!filePath) return { ok: false, status: 0, error: 'invalid-user-file-path' };
    try {
        const text = await fs.readFile(filePath, 'utf8');
        return {
            ok: true,
            status: 200,
            value: JSON.parse(text),
            bytes: text.length,
            path: filePath,
        };
    } catch (error) {
        return {
            ok: false,
            status: error?.code === 'ENOENT' ? 404 : 0,
            error: error?.message || String(error),
            path: filePath,
        };
    }
}

async function writeLiveUserJsonToFilesystem(userFilesDir = '', userPath = '', value = {}) {
    const filePath = liveUserFileFilesystemPath(userFilesDir, userPath);
    if (!filePath) return { ok: false, status: 0, error: 'invalid-user-file-path' };
    try {
        await fs.writeFile(filePath, `${JSON.stringify(value ?? null, null, 2)}\n`, 'utf8');
        return { ok: true, status: 200, path: filePath };
    } catch (error) {
        return { ok: false, status: 0, error: error?.message || String(error), path: filePath };
    }
}

async function deleteLiveUserFileFromFilesystem(userFilesDir = '', userPath = '') {
    const filePath = liveUserFileFilesystemPath(userFilesDir, userPath);
    if (!filePath) return { ok: false, status: 0, error: 'invalid-user-file-path', path: userPath };
    try {
        await fs.unlink(filePath);
        return { ok: true, status: 200, path: userPath, filesystemPath: filePath };
    } catch (error) {
        if (error?.code === 'ENOENT') return { ok: true, status: 404, path: userPath, filesystemPath: filePath };
        return { ok: false, status: 0, error: error?.message || String(error), path: userPath, filesystemPath: filePath };
    }
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
    if (target === MOBILE_ADVANCED_HARNESS_TARGET) return '?mode=advanced&tab=loredecks';
    if (target === MOBILE_REDESIGN_HARNESS_TARGET) return '?mode=advanced&tab=loredecks';
    if (target === TABLET_ADVANCED_HARNESS_TARGET) return '?mode=advanced&tab=loredecks';
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
                    pageWsUrl: process.env.SAGA_SMOKE_BROWSER_WS === '1' ? '' : (page.webSocketDebuggerUrl || ''),
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
        const timeoutMs = Number(process.env.SAGA_SMOKE_CDP_STARTUP_TIMEOUT_MS) || 30000;
        return await client.send(method, params, { timeoutMs });
    } catch (error) {
        throw createCdpStartupError(method, error, details);
    }
}

async function connectCdpClientWithRetry(wsUrl, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    while (Date.now() < deadline) {
        const client = new CdpClient(wsUrl);
        try {
            await client.connect();
            return client;
        } catch (error) {
            lastError = error;
            client.close();
            await wait(250);
        }
    }
    throw lastError || new Error('CDP WebSocket did not become ready.');
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

function formatRuntimeException(details = {}) {
    const exception = details.exception || {};
    const text = exception.description || details.text || 'Runtime exception';
    const url = details.url || '';
    const line = Number.isFinite(Number(details.lineNumber)) ? Number(details.lineNumber) + 1 : 0;
    const column = Number.isFinite(Number(details.columnNumber)) ? Number(details.columnNumber) + 1 : 0;
    const location = url ? ` (${url}${line ? `:${line}${column ? `:${column}` : ''}` : ''})` : '';
    return `${text}${location}`;
}

function collectClientErrors(client) {
    return (client?.events || [])
        .flatMap(event => {
            if (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error') {
                return [formatLogEntry(event.params.entry)];
            }
            if (event.method === 'Runtime.exceptionThrown') {
                return [formatRuntimeException(event.params?.exceptionDetails || {})];
            }
            return [];
        });
}

function isExpectedStorageHarness404(error = '') {
    const message = String(error || '');
    return SMOKE_TARGET === STORAGE_HARNESS_TARGET
        && /Failed to load resource: the server responded with a status of 404/i.test(message)
        && /\/user\/files\/saga-[^)\s]+/i.test(message);
}

function isExpectedLiveCreator404(error = '') {
    const message = String(error || '');
    return SMOKE_TARGET === LIVE_CREATOR_TARGET
        && /Failed to load resource: the server responded with a status of 404/i.test(message)
        && /\/user\/files\/saga-(?:theme-index|iconset-index|creator-project-[^)\s]+)\.v1\.json/i.test(message);
}

function isExpectedRepoLocalHarnessStorageError(error = '') {
    const message = String(error || '');
    return ['context-harness', 'guide-harness', 'creator-harness', MOBILE_ADVANCED_HARNESS_TARGET, MOBILE_REDESIGN_HARNESS_TARGET, TABLET_ADVANCED_HARNESS_TARGET].includes(SMOKE_TARGET)
        && (
            (/Failed to load resource: the server responded with a status of 404/i.test(message)
                && /\/user\/files\/saga-(?:theme-index|iconset-index|library-index|storage-index|creator-index|creator-project-[^)\s]+|pack-smoke-[^)\s]+)\.v1\.json/i.test(message))
            || (/Failed to load resource: the server responded with a status of 405/i.test(message)
                && /\/api\/files\/upload/i.test(message))
        );
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
            sagaRoot: (() => {
                const root = document.querySelector('#saga-lore-panel');
                return root ? {
                    className: root.className || '',
                    mobileRoute: root.dataset?.mobileRoute || '',
                    mobileActiveTab: root.dataset?.mobileActiveTab || '',
                    mobileLorecardsStage: root.dataset?.mobileLorecardsStage || '',
                } : null;
            })(),
            visibleMobileNav: [...document.querySelectorAll('.saga-mobile-bottom-tab')].map(element => {
                const rect = element.getBoundingClientRect?.();
                const style = getComputedStyle(element);
                return {
                    route: element.getAttribute('data-mobile-route') || '',
                    text: (element.innerText || element.textContent || '').trim(),
                    visible: !!rect && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
                    left: Math.round(rect?.left || 0),
                    top: Math.round(rect?.top || 0),
                    width: Math.round(rect?.width || 0),
                    height: Math.round(rect?.height || 0),
                };
            }),
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

async function expandMobileLibraryFolders(client, maxPasses = 6) {
    let total = 0;
    for (let pass = 0; pass < maxPasses; pass += 1) {
        const expanded = await evaluate(client, script(() => {
            const buttons = [...document.querySelectorAll('.saga-loredeck-library-mobile-list .saga-loredeck-library-folder-disclosure')];
            const closed = buttons.filter(button => {
                const row = button.closest('.saga-loredeck-library-inline-folder-row');
                return row?.getAttribute('aria-expanded') === 'false' || (button.textContent || '').trim() === '>';
            });
            for (const button of closed.slice(0, 16)) button.click();
            return closed.length;
        }), { userGesture: true }).catch(() => 0);
        total += Number(expanded || 0);
        if (!expanded) break;
        await wait(500);
    }
    return total;
}

async function getVisibleMobileLibraryDeckCandidates(client, excludedPackIds = []) {
    return await evaluate(client, script(excluded => {
        const excludedIds = new Set((excluded || []).map(value => String(value || '').trim()).filter(Boolean));
        const cards = [...document.querySelectorAll('.saga-loredeck-library-deck-mobile-touch[data-pack-id]')];
        const candidates = [];
        for (const card of cards) {
            const packId = String(card.getAttribute('data-pack-id') || '').trim();
            if (!packId || excludedIds.has(packId)) continue;
            const rect = card.getBoundingClientRect?.();
            const style = getComputedStyle(card);
            if (!rect || rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') continue;
            const title = card.querySelector('.saga-loredeck-library-deck-title, .saga-loredeck-library-inline-title-label')?.textContent?.trim()
                || card.textContent?.trim()?.split('\n')?.[0]
                || packId;
            candidates.push({ packId, title });
        }
        return candidates;
    }, excludedPackIds));
}

function sagaActiveTabExpression(tabId) {
    const expected = JSON.stringify(String(tabId || ''));
    return `document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === ${expected} || document.querySelector("#saga-lore-panel")?.dataset?.mobileActiveTab === ${expected}`;
}

function sagaMobileRouteExpression(routeId) {
    const expected = JSON.stringify(String(routeId || ''));
    return `document.querySelector("#saga-lore-panel.saga-runtime-mobile")?.dataset?.mobileRoute === ${expected}`;
}

async function clickRuntimeRoute(client, routeId) {
    const route = String(routeId || '').trim();
    if (!route) return false;
    return await evaluate(client, script(targetRoute => {
        const mobileShell = !!document.querySelector('#saga-lore-panel.saga-runtime-mobile');
        const selectors = mobileShell
            ? [
                `.saga-mobile-bottom-tab[data-mobile-route="${targetRoute}"]`,
                `.saga-runtime-rail-tab[data-tab-id="${targetRoute}"]`,
            ]
            : [
                `.saga-runtime-rail-tab[data-tab-id="${targetRoute}"]`,
                `.saga-mobile-bottom-tab[data-mobile-route="${targetRoute}"]`,
            ];
        const isVisible = element => {
            const rect = element?.getBoundingClientRect?.();
            const style = element ? getComputedStyle(element) : null;
            return !!rect
                && rect.width > 0
                && rect.height > 0
                && style?.display !== 'none'
                && style?.visibility !== 'hidden';
        };
        for (const selector of selectors) {
            const element = [...document.querySelectorAll(selector)].find(isVisible);
            if (!element) continue;
            element.scrollIntoView({ block: 'center', inline: 'center' });
            element.click();
            return true;
        }
        return false;
    }, route), { userGesture: true }).catch(() => false);
}

async function clickMobileShellBack(client) {
    return await evaluate(client, script(() => {
        const isVisible = element => {
            const rect = element?.getBoundingClientRect?.();
            const style = element ? getComputedStyle(element) : null;
            return !!rect
                && rect.width > 0
                && rect.height > 0
                && style?.display !== 'none'
                && style?.visibility !== 'hidden';
        };
        const element = [...document.querySelectorAll('.saga-mobile-shell-back')].find(isVisible);
        if (!element) return false;
        element.scrollIntoView({ block: 'center', inline: 'center' });
        element.click();
        return true;
    }), { userGesture: true }).catch(() => false);
}

async function getVisibleFloatingTooltipState(client) {
    return await evaluate(client, script(() => {
        const tooltip = document.querySelector('.saga-floating-tooltip');
        const style = tooltip ? getComputedStyle(tooltip) : null;
        const rect = tooltip?.getBoundingClientRect?.();
        const visible = !!tooltip
            && style?.display !== 'none'
            && style?.visibility !== 'hidden'
            && Number(style?.opacity || 1) !== 0
            && !!rect
            && rect.width > 0
            && rect.height > 0;
        return {
            visible,
            text: tooltip?.textContent?.trim() || '',
            left: rect?.left ?? null,
            top: rect?.top ?? null,
            display: style?.display || '',
            visibility: style?.visibility || '',
        };
    }));
}

async function getNestedScrollStyleState(client, selectors = []) {
    return await evaluate(client, script(inputSelectors => {
        const regions = (inputSelectors || []).flatMap(selector => [...document.querySelectorAll(selector)].map(element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect?.();
            const visible = !!rect
                && rect.width > 0
                && rect.height > 0
                && style.display !== 'none'
                && style.visibility !== 'hidden';
            const maxHeight = style.maxHeight || '';
            const overflowY = style.overflowY || '';
            const nestedScrollStyle = /auto|scroll/i.test(overflowY) || (!!maxHeight && maxHeight !== 'none');
            return {
                selector,
                className: element.className || '',
                visible,
                overflowY,
                maxHeight,
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                nestedScrollStyle,
            };
        }));
        return {
            regions,
            offenders: regions.filter(region => region.visible && region.nestedScrollStyle),
        };
    }, selectors));
}

async function getMobileNestedScrollAuditState(client, options = {}) {
    return await evaluate(client, script(input => {
        const scopeSelector = String(input?.scopeSelector || '#saga-lore-panel.saga-runtime-mobile').trim();
        const scope = document.querySelector(scopeSelector) || document.querySelector('#saga-lore-panel.saga-runtime-mobile') || document.body;
        const allowedSelectors = Array.isArray(input?.allowedSelectors) ? input.allowedSelectors.filter(Boolean) : [];
        const ignoredSelectors = [
            'textarea',
            'select',
            '[contenteditable="true"]',
            '.saga-floating-tooltip',
            '.saga-mobile-bottom-bar',
            '.saga-mobile-lorecards-subtabs',
            '.saga-mobile-shell-action-bar',
            ...(Array.isArray(input?.ignoredSelectors) ? input.ignoredSelectors.filter(Boolean) : []),
        ];
        const matchesAny = (element, selectors) => selectors.some(selector => {
            try {
                return element.matches?.(selector) || element.closest?.(selector);
            } catch {
                return false;
            }
        });
        const matchesSelf = (element, selectors) => selectors.some(selector => {
            try {
                return element.matches?.(selector);
            } catch {
                return false;
            }
        });
        const visible = element => {
            const rect = element?.getBoundingClientRect?.();
            const style = element ? getComputedStyle(element) : null;
            return !!rect
                && rect.width > 0
                && rect.height > 0
                && style?.display !== 'none'
                && style?.visibility !== 'hidden';
        };
        const selectorFor = element => {
            const parts = [];
            let current = element;
            while (current && current.nodeType === 1 && current !== document.body && parts.length < 5) {
                const tag = String(current.tagName || '').toLowerCase();
                const id = current.id ? `#${current.id}` : '';
                const classes = String(current.className || '')
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 3)
                    .map(name => `.${name}`)
                    .join('');
                parts.unshift(`${tag}${id}${classes}`);
                current = current.parentElement;
            }
            return parts.join(' > ');
        };
        const candidates = [scope, ...scope.querySelectorAll('*')].filter(element => visible(element) && !matchesAny(element, ignoredSelectors));
        const regions = candidates.map(element => {
            const style = getComputedStyle(element);
            const overflowY = style.overflowY || '';
            const overflow = style.overflow || '';
            const maxHeight = style.maxHeight || '';
            const verticalScrollStyle = /auto|scroll|overlay/i.test(overflowY) || /auto|scroll|overlay/i.test(overflow);
            const actuallyScrollable = element.scrollHeight > element.clientHeight + 2;
            const boundedScrollStyle = maxHeight && maxHeight !== 'none' && verticalScrollStyle;
            const allowed = matchesSelf(element, allowedSelectors);
            return {
                selector: selectorFor(element),
                className: element.className || '',
                tagName: element.tagName || '',
                overflowY,
                overflow,
                maxHeight,
                clientHeight: element.clientHeight,
                scrollHeight: element.scrollHeight,
                allowed,
                verticalScrollStyle,
                actuallyScrollable,
                boundedScrollStyle,
            };
        });
        const offenders = regions.filter(region => !region.allowed && region.verticalScrollStyle && (region.actuallyScrollable || region.boundedScrollStyle));
        return {
            label: input?.label || scopeSelector,
            scopeSelector,
            allowedSelectors,
            regions: regions.filter(region => region.verticalScrollStyle || region.maxHeight !== 'none'),
            offenders,
        };
    }, options));
}

function addMobileNestedScrollFindings(findings, audit) {
    if (!audit?.offenders?.length) return;
    const summary = audit.offenders
        .slice(0, 4)
        .map(item => `${item.selector || item.className || item.tagName} (${item.overflowY || item.overflow || 'overflow'}, ${item.scrollHeight}/${item.clientHeight})`)
        .join('; ');
    findings.push(`Mobile nested scroll audit failed for ${audit.label || audit.scopeSelector}: ${summary}.`);
}

async function getMobileFontAuditState(client, options = {}) {
    return await evaluate(client, script((input) => {
        const scopeSelector = input?.scopeSelector || '#saga-lore-panel.saga-runtime-mobile';
        const root = document.querySelector(scopeSelector);
        if (!root) return { label: input?.label || scopeSelector, present: false, min: 0, max: 0, ratio: 0, smallest: [], largest: [] };
        const selectorFor = (element) => {
            if (!element) return '';
            if (element.id) return `#${element.id}`;
            const parts = [];
            let current = element;
            while (current && current !== root && parts.length < 4) {
                const tag = current.tagName ? current.tagName.toLowerCase() : 'node';
                const cls = String(current.className || '').split(/\s+/).filter(Boolean).slice(0, 3).map(name => `.${name}`).join('');
                parts.unshift(`${tag}${cls}`);
                current = current.parentElement;
            }
            return parts.join(' > ');
        };
        const elements = [...root.querySelectorAll('button, label, span, div, p, h1, h2, h3, h4, strong, small, input, textarea, select')];
        const samples = [];
        for (const element of elements) {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || 1) === 0) continue;
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) continue;
            const tag = String(element.tagName || '').toLowerCase();
            const text = (tag === 'input' || tag === 'textarea' || tag === 'select')
                ? (element.value || element.getAttribute('placeholder') || element.getAttribute('aria-label') || '')
                : (element.innerText || element.textContent || '');
            if (!String(text || '').trim()) continue;
            const size = Number.parseFloat(style.fontSize || '0');
            if (!Number.isFinite(size) || size <= 0) continue;
            samples.push({
                selector: selectorFor(element),
                text: String(text || '').trim().replace(/\s+/g, ' ').slice(0, 80),
                size,
            });
        }
        samples.sort((a, b) => a.size - b.size);
        const min = samples[0]?.size || 0;
        const max = samples[samples.length - 1]?.size || 0;
        return {
            label: input?.label || scopeSelector,
            present: true,
            count: samples.length,
            min,
            max,
            ratio: min > 0 ? max / min : 0,
            smallest: samples.slice(0, 5),
            largest: samples.slice(-5).reverse(),
        };
    }, options));
}

function addMobileFontFindings(findings, audit) {
    if (!audit?.present || !audit.count) return;
    if (audit.min <= 0 || audit.max <= 0 || audit.ratio <= 2.001) return;
    const largest = (audit.largest || [])
        .slice(0, 3)
        .map(item => `${item.size}px ${item.selector || item.text}`)
        .join('; ');
    const smallest = (audit.smallest || [])
        .slice(0, 3)
        .map(item => `${item.size}px ${item.selector || item.text}`)
        .join('; ');
    findings.push(`Mobile font audit failed for ${audit.label}: ${audit.min}px-${audit.max}px (${audit.ratio.toFixed(2)}x). Smallest: ${smallest}. Largest: ${largest}.`);
}

async function openMobileSessionDetailsForGuide(client) {
    const state = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel.saga-runtime-mobile');
        if (!root) return { mobile: false, opened: true, reason: 'desktop-shell' };
        const guideSelector = '[data-saga-tour="session.instructions.basic"], [data-saga-tour="session.instructions.advanced"]';
        const hasGuideCard = !!document.querySelector(guideSelector);
        if (hasGuideCard) return { mobile: true, opened: true, alreadyOpen: true };
        const target = document.querySelector('.saga-session-operator-summary .saga-operator-summary-header-tappable[aria-label="Open Session Details"]');
        if (!target) {
            return {
                mobile: true,
                opened: false,
                reason: 'missing-session-details',
                headers: [...document.querySelectorAll('.saga-operator-summary-header-tappable')]
                    .map(header => header.getAttribute('aria-label') || (header.innerText || header.textContent || '').trim())
                    .filter(Boolean)
                    .slice(0, 20),
            };
        }
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return { mobile: true, opened: true, clicked: true };
    }), { userGesture: true });
    if (state?.mobile && state?.opened) {
        await waitFor(
            client,
            '!!document.querySelector("[data-saga-tour=\\"session.instructions.basic\\"], [data-saga-tour=\\"session.instructions.advanced\\"]")',
            'Mobile Session Details guide surface',
            10000,
        );
        await wait(500);
    }
    return state;
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

async function clickVisibleButtonText(client, text, options = {}) {
    return await evaluate(client, script((label, rootSelector, enabledOnly, allowIncludes) => {
        const root = rootSelector ? document.querySelector(rootSelector) : document;
        if (!root) return { clicked: false, reason: 'missing-root', rootSelector };
        const isVisible = button => {
            const rects = button.getClientRects?.();
            if (!rects || !rects.length) return false;
            const style = window.getComputedStyle?.(button);
            return style?.display !== 'none' && style?.visibility !== 'hidden';
        };
        const buttons = [...root.querySelectorAll('button')];
        const target = buttons.find(button => {
            const clean = (button.innerText || button.textContent || '').trim();
            if (!clean) return false;
            if (enabledOnly && button.disabled) return false;
            if (!isVisible(button)) return false;
            return allowIncludes ? clean.includes(label) : clean === label;
        });
        if (!target) {
            return {
                clicked: false,
                reason: 'missing-visible-button',
                labels: buttons
                    .map(button => ({
                        label: (button.innerText || button.textContent || '').trim(),
                        disabled: !!button.disabled,
                        visible: isVisible(button),
                    }))
                    .filter(item => item.label)
                    .slice(0, 120),
            };
        }
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return { clicked: true, label: (target.innerText || target.textContent || '').trim() };
    }, text, options.root || '', options.enabledOnly !== false, options.includes === true), { userGesture: true });
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

async function selectLoredeckInLibraryByPackId(client, packId, title = '') {
    const id = String(packId || '').trim();
    const name = String(title || '').trim();
    if (!id) return { selected: false, mode: 'missing-pack-id' };

    const clickVisibleCard = async (mode) => await evaluate(client, script((targetId, targetTitle, selectionMode) => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        if (!overlay) return { selected: false, mode: 'missing-library' };

        const collapsedHandle = overlay.querySelector('.saga-loredeck-library-resize-handle[aria-expanded="false"]');
        if (collapsedHandle) collapsedHandle.click();

        const matchesTarget = element => {
            const elementPackId = String(element?.getAttribute?.('data-pack-id') || '').trim();
            const text = element?.innerText || element?.textContent || '';
            return elementPackId === targetId || (!!targetTitle && text.includes(targetTitle));
        };
        const candidates = [
            ...overlay.querySelectorAll('.saga-loredeck-library-deck-card[data-pack-id]'),
            ...overlay.querySelectorAll('.saga-loredeck-library-folder-loredeck-row'),
        ];
        const target = candidates.find(matchesTarget);
        if (!target) {
            return {
                selected: false,
                mode: selectionMode || 'target-not-visible',
                visiblePackIds: candidates.map(element => element.getAttribute?.('data-pack-id') || '').filter(Boolean).slice(0, 80),
                text: (overlay.innerText || overlay.textContent || '').slice(0, 800),
            };
        }
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return {
            selected: true,
            mode: selectionMode || 'visible-card',
            packId: target.getAttribute?.('data-pack-id') || targetId,
            text: (target.innerText || target.textContent || '').slice(0, 400),
        };
    }, id, name, mode), { userGesture: true });

    let result = await clickVisibleCard('direct-card');
    if (!result.selected) {
        const searchSet = await setInputValue(client, '.saga-loredeck-library-overlay .saga-loredeck-library-search', name || id).catch(() => false);
        if (searchSet) {
            await wait(700);
            result = await clickVisibleCard('search-card');
        }
    }

    if (!result.selected) {
        result = await evaluate(client, script(async targetId => {
            try {
                const library = await import('/src/loredecks/loredeck-library-panel.js');
                const selected = library.openLoredeckLibraryDetails(targetId);
                if (selected && typeof library.renderLoredeckLibraryOverlay === 'function') {
                    library.renderLoredeckLibraryOverlay({ preserveScroll: false, progressiveOpen: false });
                }
                return { selected: !!selected, mode: selected ? 'open-details-api' : 'open-details-api-false', packId: targetId };
            } catch (error) {
                return {
                    selected: false,
                    mode: 'open-details-api-error',
                    error: error?.message || String(error),
                };
            }
        }, id), { userGesture: true, timeoutMs: 20000 });
    }

    if (result.selected) {
        result.detailsExpansion = await evaluate(client, script(() => {
            const overlay = document.querySelector('.saga-loredeck-library-overlay');
            const body = overlay?.querySelector('.saga-loredeck-library-body');
            const handle = overlay?.querySelector('.saga-loredeck-library-resize-handle');
            const wasCollapsed = !!body?.classList?.contains('saga-loredeck-library-details-collapsed')
                || handle?.getAttribute('aria-expanded') === 'false';
            if (wasCollapsed && handle) handle.click();
            const details = overlay?.querySelector('.saga-loredeck-library-details');
            details?.scrollIntoView({ block: 'end', inline: 'nearest' });
            return {
                overlay: !!overlay,
                details: !!details,
                wasCollapsed,
                expanded: !body?.classList?.contains('saga-loredeck-library-details-collapsed')
                    && handle?.getAttribute('aria-expanded') !== 'false',
                detailsText: (details?.textContent || '').slice(0, 400),
            };
        }), { userGesture: true }).catch(error => ({
            overlay: false,
            details: false,
            error: error?.message || String(error),
        }));
        await wait(400);
        const detailsReady = await waitFor(
            client,
            script((targetId, targetTitle) => {
                const details = document.querySelector('.saga-loredeck-library-details');
                const text = details?.textContent || details?.innerText || '';
                return !!details
                    && text.includes('Selected Loredeck')
                    && (text.includes(targetId) || (!!targetTitle && text.includes(targetTitle)));
            }, id, name),
            `Loredeck Library details for ${id}`,
            10000,
        ).then(() => true).catch(error => {
            result.detailsWaitError = error?.message || String(error);
            return false;
        });
        if (!detailsReady) {
            result.detailsDiagnostics = await evaluate(client, script(targetId => {
                const overlay = document.querySelector('.saga-loredeck-library-overlay');
                const details = overlay?.querySelector('.saga-loredeck-library-details');
                const selectedCards = [...overlay?.querySelectorAll('[aria-current="true"], .saga-loredeck-library-deck-selected, .saga-loredeck-library-stack-card-selected') || []]
                    .map(element => ({
                        className: element.className || '',
                        packId: element.getAttribute?.('data-pack-id') || '',
                        text: (element.innerText || element.textContent || '').slice(0, 300),
                    }));
                return {
                    overlay: !!overlay,
                    bodyCollapsed: !!overlay?.querySelector('.saga-loredeck-library-body')?.classList?.contains('saga-loredeck-library-details-collapsed'),
                    details: !!details,
                    detailsText: (details?.textContent || details?.innerText || '').slice(0, 1200),
                    selectedCards,
                    targetCards: [...overlay?.querySelectorAll(`[data-pack-id="${targetId}"]`) || []].map(element => ({
                        className: element.className || '',
                        text: (element.innerText || element.textContent || '').slice(0, 300),
                    })),
                    overlayText: (overlay?.textContent || overlay?.innerText || '').slice(0, 1600),
                };
            }, id)).catch(error => ({ error: error?.message || String(error) }));
            result.selected = false;
        }
    }

    return result;
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

async function captureSillyTavernRequestHeaders(client) {
    return await evaluate(client, script(() => {
        const ctx = window.SillyTavern?.getContext?.();
        const headers = typeof ctx?.getRequestHeaders === 'function'
            ? ctx.getRequestHeaders()
            : { 'Content-Type': 'application/json' };
        return headers && typeof headers === 'object' && !Array.isArray(headers)
            ? JSON.parse(JSON.stringify(headers))
            : { 'Content-Type': 'application/json' };
    })).catch(() => ({ 'Content-Type': 'application/json' }));
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
        const removedMigrationActionLabels = new Set([
            ['Migrate', 'Legacy', 'Storage'].join(' '),
            ['Storage', 'Current'].join(' '),
        ]);
        return {
            present: true,
            open: !!section.open,
            activeTab,
            text: text.slice(0, 1800),
            buttons,
            hasRemovedStorageMigrationAction: buttons.some(button => removedMigrationActionLabels.has(button.label)),
            hasVerifyStorage: buttons.some(button => button.label === 'Verify Storage'),
            hasSettleStorageWrites: buttons.some(button => button.label === 'Settle Storage Writes'),
            hasCleanMissingRecords: buttons.some(button => button.label === 'Clean Missing Records'),
            hasRemovedStorageMigrationRow: text.includes(['Storage', 'migration'].join(' ')),
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

async function writeSmokeReport(target, report) {
    const file = process.env.SAGA_SMOKE_REPORT || path.join(OUT_DIR, `${target}-report.json`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(report, null, 2));
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

function getLiveCreatorSmokeConfig() {
    const runId = String(process.env.SAGA_LIVE_CREATOR_RUN_ID || `live-creator-${Date.now().toString(36)}`).trim();
    const providerTimeoutMs = Number(process.env.SAGA_LIVE_CREATOR_TIMEOUT_MS || process.env.SAGA_PROVIDER_SMOKE_TIMEOUT_MS) || 900000;
    const defaultScope = [
        'Arlong Park arc focused on Nami, Arlong, Cocoyasi Village, Bellemere fallout, and the moment Luffy takes the burden from Nami.',
        `Use ${runId} only as an automated smoke-run label; do not treat it as lore.`,
    ].join(' ');
    return {
        runId,
        fandom: String(process.env.SAGA_LIVE_CREATOR_FANDOM || 'One Piece').trim(),
        scope: String(process.env.SAGA_LIVE_CREATOR_SCOPE || defaultScope).trim(),
        granularity: String(process.env.SAGA_LIVE_CREATOR_GRANULARITY || 'compact').trim(),
        notes: String(process.env.SAGA_LIVE_CREATOR_NOTES || `Automated live Creator smoke ${runId}. Keep this intentionally small. Prefer one sharp Lorecard about pressure, secrets, village stakes, or timing instead of broad biography.`).trim(),
        providerTimeoutMs,
        finalize: process.env.SAGA_LIVE_CREATOR_FINALIZE !== '0',
        cleanup: process.env.SAGA_LIVE_CREATOR_CLEANUP !== '0',
        screenshotPrefix: String(process.env.SAGA_LIVE_CREATOR_SCREENSHOT_PREFIX || 'live-creator').trim() || 'live-creator',
        generationSettings: {
            titleBatchLimit: Number(process.env.SAGA_LIVE_CREATOR_TITLE_BATCH_LIMIT) || 4,
            planningProposalLimit: Number(process.env.SAGA_LIVE_CREATOR_PLANNING_PROPOSAL_LIMIT) || 6,
            entryBatchSize: Number(process.env.SAGA_LIVE_CREATOR_ENTRY_BATCH_SIZE) || 1,
            titleRunRemainingLimit: Number(process.env.SAGA_LIVE_CREATOR_TITLE_RUN_LIMIT) || 10,
            retryAttempts: Number(process.env.SAGA_LIVE_CREATOR_RETRY_ATTEMPTS) || 1,
        },
    };
}

async function installLiveCreatorStateProbe(client) {
    return await evaluate(client, script(() => {
        const summarizeValue = (value, depth = 0) => {
            if (value === null || value === undefined) return value;
            if (typeof value === 'string') return value.slice(0, 900);
            if (typeof value !== 'object') return value;
            if (Array.isArray(value)) return value.slice(0, 12).map(item => summarizeValue(item, depth + 1));
            const entries = Object.entries(value).slice(0, depth > 1 ? 12 : 24);
            const output = {};
            for (const [key, nested] of entries) {
                if (depth >= 3 && nested && typeof nested === 'object') {
                    output[key] = Array.isArray(nested) ? `[${nested.length} items]` : `{${Object.keys(nested).slice(0, 8).join(', ')}}`;
                } else {
                    output[key] = summarizeValue(nested, depth + 1);
                }
            }
            return output;
        };
        const objectValues = value => value && typeof value === 'object' && !Array.isArray(value)
            ? Object.values(value)
            : [];
        const objectKeys = value => value && typeof value === 'object' && !Array.isArray(value)
            ? Object.keys(value)
            : [];
        const countObject = value => objectKeys(value).length;
        const mergeRecords = (...records) => {
            const output = {};
            for (const record of records) {
                if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
                Object.assign(output, record);
            }
            return output;
        };
        const getMostRecentJob = jobs => objectValues(jobs)
            .filter(job => job && typeof job === 'object')
            .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))[0] || null;
        const summarizeUnit = unit => ({
            unitId: unit?.unitId || unit?.id || '',
            runId: unit?.runId || '',
            actionId: unit?.actionId || '',
            stage: unit?.stage || '',
            label: unit?.label || '',
            status: unit?.status || '',
            attempts: Number(unit?.attempts || 0),
            elapsedMs: Number(unit?.elapsedMs || 0),
            receivedChars: Number(unit?.receivedChars || 0),
            createdAt: Number(unit?.createdAt || 0),
            startedAt: Number(unit?.startedAt || 0),
            completedAt: Number(unit?.completedAt || 0),
            failedAt: Number(unit?.failedAt || 0),
            error: String(unit?.error || '').slice(0, 900),
            resultRef: summarizeValue(unit?.resultRef || null),
            diagnostic: summarizeValue(unit?.diagnostic || null),
            meta: summarizeValue(unit?.meta || null),
        });
        const summarizeGenerationResult = result => result && typeof result === 'object' ? {
            id: result.id || '',
            runId: result.runId || '',
            unitId: result.unitId || '',
            actionId: result.actionId || '',
            stage: result.stage || '',
            label: result.label || '',
            status: result.status || '',
            message: String(result.message || '').slice(0, 900),
            elapsedMs: Number(result.elapsedMs || 0),
            receivedChars: Number(result.receivedChars || 0),
            snippet: String(result.snippet || '').slice(0, 900),
            batchId: result.batchId || '',
            batchLabel: result.batchLabel || '',
        } : null;
        window.__sagaLiveCreatorSmokeState = () => {
            const ctx = window.SillyTavern?.getContext?.();
            const metadata = ctx?.chatMetadata?.saga || {};
            const settings = ctx?.extensionSettings?.saga || {};
            const localCreator = metadata.loredeckCreator || {};
            const settingsCreator = settings.loredeckCreatorProjects || {};
            const jobs = mergeRecords(settingsCreator.jobs, localCreator.jobs);
            const activeJobId = localCreator.activeJobId || settingsCreator.activeJobId || localCreator.lastJobId || settingsCreator.lastJobId || '';
            const job = (activeJobId && jobs[activeJobId]) ? jobs[activeJobId] : getMostRecentJob(jobs);
            const jobId = job?.jobId || job?.id || activeJobId || '';
            const generatedPackId = String(job?.generatedPackId || job?.brief?.packId || '').trim();
            const packs = mergeRecords(settings.loredeckLibrary?.packs, metadata.loredeckLibrary?.packs);
            const generatedPack = generatedPackId ? (packs[generatedPackId] || null) : null;
            const selectedLoredeckId = String(metadata.lorePanel?.selectedLoredeckId || '').trim();
            const selectedPack = selectedLoredeckId ? (packs[selectedLoredeckId] || null) : null;
            const finalizedPacks = objectValues(packs)
                .filter(pack => {
                    if (!pack || typeof pack !== 'object') return false;
                    if (generatedPackId && (pack.source?.originalPackId === generatedPackId || pack.derivedFrom?.packId === generatedPackId)) return true;
                    return !!(jobId && pack.derivedFrom?.creatorJobId === jobId);
                })
                .map(pack => ({
                    packId: pack.packId || pack.id || '',
                    title: pack.title || '',
                    type: pack.type || '',
                    originalPackId: pack.source?.originalPackId || pack.derivedFrom?.packId || '',
                    creatorJobId: pack.derivedFrom?.creatorJobId || '',
                    entryCount: countObject(pack.entryOverrides),
                }));
            const overlay = document.querySelector('.saga-loredeck-creator-workbench-overlay');
            const library = document.querySelector('.saga-loredeck-library-overlay');
            const confirm = document.querySelector('.saga-confirm-overlay');
            const metadataEditor = document.querySelector('.saga-loredeck-metadata-overlay');
            const buttonRecords = [...document.querySelectorAll('button')]
                .map(button => ({
                    label: (button.innerText || button.textContent || '').trim(),
                    disabled: !!button.disabled,
                    busy: button.getAttribute('aria-busy') === 'true' || button.dataset.sagaActionBusy === 'true',
                }))
                .filter(button => button.label);
            const titleBatches = Array.isArray(job?.outline?.titleBatches) ? job.outline.titleBatches : [];
            const titleDrafts = Array.isArray(job?.titleDrafts) ? job.titleDrafts : [];
            const approvedTitleIds = Array.isArray(job?.approvedTitleDraftIds) ? job.approvedTitleDraftIds : [];
            const titleBatchDraftedIds = Array.isArray(job?.titleBatchDraftedIds) ? job.titleBatchDraftedIds : [];
            const planningQueuedIds = Array.isArray(job?.planningBatchQueuedIds) ? job.planningBatchQueuedIds : [];
            const planningAcceptedIds = Array.isArray(job?.planningBatchAcceptedIds) ? job.planningBatchAcceptedIds : [];
            const draftChanges = Array.isArray(job?.draftChanges) ? job.draftChanges : [];
            const pendingChanges = Array.isArray(generatedPack?.pendingChanges) ? generatedPack.pendingChanges : [];
            const acceptedEntryCount = countObject(generatedPack?.entryOverrides);
            const generationUnits = objectValues(job?.generationUnits)
                .sort((a, b) => Number(a.startedAt || a.createdAt || 0) - Number(b.startedAt || b.createdAt || 0))
                .map(summarizeUnit);
            const activeGeneration = job?.activeGeneration && typeof job.activeGeneration === 'object' ? {
                id: job.activeGeneration.id || '',
                runId: job.activeGeneration.runId || '',
                unitId: job.activeGeneration.unitId || '',
                actionId: job.activeGeneration.actionId || '',
                stage: job.activeGeneration.stage || '',
                currentStage: job.activeGeneration.currentStage || '',
                label: job.activeGeneration.label || '',
                status: job.activeGeneration.status || '',
                phase: job.activeGeneration.phase || '',
                elapsedMs: Number(job.activeGeneration.elapsedMs || 0),
                receivedChars: Number(job.activeGeneration.receivedChars || 0),
                snippet: String(job.activeGeneration.snippet || '').slice(0, 900),
                batchLabel: job.activeGeneration.batchLabel || '',
                batchIndex: job.activeGeneration.batchIndex,
                batchTotal: job.activeGeneration.batchTotal,
            } : null;
            const text = overlay?.innerText || document.body?.innerText || '';
            return {
                hasContext: !!ctx,
                activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
                overlayOpen: !!overlay,
                libraryOpen: !!library,
                confirmOpen: !!confirm,
                metadataEditorOpen: !!metadataEditor,
                providerNotReady: /Reasoning Provider is not ready|Provider setup is needed|No provider/i.test(text),
                actionFailed: /Action failed|Generation failed|failed before|could not/i.test(text),
                selectedLoredeckId,
                selectedPack: selectedPack ? {
                    packId: selectedPack.packId || selectedPack.id || '',
                    title: selectedPack.title || '',
                    type: selectedPack.type || '',
                    entryCount: countObject(selectedPack.entryOverrides),
                    originalPackId: selectedPack.source?.originalPackId || selectedPack.derivedFrom?.packId || '',
                    creatorJobId: selectedPack.derivedFrom?.creatorJobId || '',
                } : null,
                generatedPack: generatedPack ? {
                    packId: generatedPack.packId || generatedPack.id || '',
                    title: generatedPack.title || '',
                    type: generatedPack.type || '',
                    pendingChangeCount: pendingChanges.length,
                    pendingEntryChangeCount: pendingChanges.filter(change => Array.isArray(change?.affectedEntryIds) && change.affectedEntryIds.length).length,
                    acceptedEntryCount,
                    healthStatus: generatedPack.healthStatus || generatedPack.health?.status || '',
                    tagCount: countObject(generatedPack.tagRegistry?.tags || generatedPack.tagRegistry),
                    timelineCount: countObject(generatedPack.timelineRegistry?.anchors || generatedPack.timelineRegistry?.events || generatedPack.timelineRegistry),
                } : null,
                finalizedPacks,
                job: job ? {
                    jobId,
                    status: job.status || '',
                    currentStage: job.currentStage || '',
                    fandom: job.fandom || '',
                    scope: job.scope || '',
                    granularity: job.granularity || '',
                    generatedPackId,
                    generatedPackTitle: job.generatedPackTitle || generatedPack?.title || '',
                    briefReady: !!job.brief,
                    briefApproved: job.approved === true,
                    outlineReady: !!job.outline,
                    outlineApproved: job.outlineApproved === true,
                    titleBatchTotal: titleBatches.length,
                    titleBatchDraftedCount: titleBatchDraftedIds.length,
                    titleDraftCount: titleDrafts.length,
                    approvedTitleCount: approvedTitleIds.length,
                    planningQueuedCount: planningQueuedIds.length,
                    planningAcceptedCount: planningAcceptedIds.length,
                    draftChangeCount: draftChanges.length,
                    pendingChangeCount: pendingChanges.length,
                    acceptedEntryCount,
                    entryDraftCount: Number(job.entryDraftCount || draftChanges.length || 0),
                    entryDraftRemainingCount: Number(job.entryDraftRemainingCount || 0),
                    coverageFinalizeAcknowledgement: summarizeValue(job.coverageFinalizeAcknowledgement || null),
                    activeGeneration,
                    lastGenerationResult: summarizeGenerationResult(job.lastGenerationResult),
                    generationUnits,
                } : null,
                visible: {
                    creatorText: (overlay?.innerText || '').slice(0, 2400),
                    libraryText: (library?.innerText || '').slice(0, 1200),
                    confirmText: (confirm?.innerText || '').slice(0, 1000),
                    metadataEditorText: (metadataEditor?.innerText || '').slice(0, 1000),
                    buttonLabels: buttonRecords.map(button => button.label).slice(0, 180),
                    disabledButtons: buttonRecords.filter(button => button.disabled).map(button => button.label).slice(0, 120),
                    busyButtons: buttonRecords.filter(button => button.busy).map(button => button.label).slice(0, 60),
                },
            };
        };
        return true;
    }));
}

async function collectLiveCreatorState(client) {
    await installLiveCreatorStateProbe(client);
    const state = await evaluate(client, 'window.__sagaLiveCreatorSmokeState?.() || null');
    return redactDiagnosticValue(state ? JSON.parse(JSON.stringify(state)) : state);
}

async function recordLiveCreatorStep(client, steps, label, screenshots, screenshotName = '') {
    await clearTransientToasts(client);
    await wait(250);
    let shot = '';
    if (screenshotName) {
        shot = await screenshot(client, screenshotName);
        screenshots.push(shot);
    }
    const state = await collectLiveCreatorState(client);
    steps.push({
        label,
        at: new Date().toISOString(),
        ...(shot ? { screenshot: shot } : {}),
        state,
    });
    return state;
}

async function clickButtonMatching(client, matcher = {}, options = {}) {
    return await evaluate(client, script((rawMatcher, rootSelector, enabledOnly, preferLast) => {
        const roots = rootSelector ? [...document.querySelectorAll(rootSelector)] : [document];
        if (!roots.length) return { clicked: false, reason: 'missing-root', rootSelector };
        const labels = Array.isArray(rawMatcher.labels) ? rawMatcher.labels.map(item => String(item || '').trim()).filter(Boolean) : [];
        const includes = String(rawMatcher.includes || '').trim();
        const pattern = String(rawMatcher.pattern || '').trim();
        const regex = pattern ? new RegExp(pattern) : null;
        const records = roots.flatMap((root, rootIndex) => [...root.querySelectorAll('button')].map(button => ({
            button,
            rootIndex,
            label: (button.innerText || button.textContent || '').trim(),
        })));
        const matches = records.filter(record => {
            const { button, label } = record;
            if (!label) return false;
            if (enabledOnly && button.disabled) return false;
            if (labels.includes(label)) return true;
            if (includes && label.includes(includes)) return true;
            return regex ? regex.test(label) : false;
        });
        const target = preferLast ? matches.at(-1) : matches[0];
        if (!target) {
            return {
                clicked: false,
                reason: 'missing-button',
                rootCount: roots.length,
                labels: records.map(record => ({
                    label: record.label,
                    disabled: !!record.button.disabled,
                    rootIndex: record.rootIndex,
                })).filter(record => record.label).slice(0, 100),
            };
        }
        target.button.scrollIntoView({ block: 'center', inline: 'center' });
        target.button.click();
        return { clicked: true, label: target.label, rootIndex: target.rootIndex, rootCount: roots.length };
    }, matcher, options.root || '', options.enabledOnly !== false, options.preferLast === true), { userGesture: true });
}

async function requireButtonMatching(client, matcher = {}, label = 'button', options = {}) {
    const deadline = Date.now() + Number(options.timeoutMs || 30000);
    let result = null;
    do {
        result = await clickButtonMatching(client, matcher, options);
        if (result?.clicked) return result;
        if (Date.now() >= deadline) break;
        await wait(250);
    } while (Date.now() < deadline);
    result = await clickButtonMatching(client, matcher, options);
    if (result?.clicked) return result;
    if (!result?.clicked) {
        throw new Error(`Could not click ${label}: ${JSON.stringify(redactDiagnosticValue(result))}`);
    }
    return result;
}

async function confirmLiveCreatorDialog(client, expectedPattern = '', options = {}) {
    return await evaluate(client, script(pattern => {
        const overlay = document.querySelector('.saga-confirm-overlay');
        if (!overlay) return { clicked: false, reason: 'missing-confirm-overlay' };
        const regex = pattern ? new RegExp(pattern) : null;
        const buttons = [...overlay.querySelectorAll('button')];
        const target = buttons.find(button => {
            const label = (button.innerText || button.textContent || '').trim();
            if (!label || button.disabled) return false;
            if (/^cancel$/i.test(label)) return false;
            return regex ? regex.test(label) : true;
        });
        if (!target) {
            return {
                clicked: false,
                reason: 'missing-confirm-button',
                text: (overlay.innerText || '').slice(0, 1000),
                labels: buttons.map(button => ({
                    label: (button.innerText || button.textContent || '').trim(),
                    disabled: !!button.disabled,
                })).filter(button => button.label),
            };
        }
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return {
            clicked: true,
            label: (target.innerText || target.textContent || '').trim(),
            text: (overlay.innerText || '').slice(0, 1000),
        };
    }, expectedPattern), { userGesture: true, timeoutMs: Number(options.timeoutMs) || 60000 });
}

async function cancelLiveCreatorDialogIfPresent(client) {
    const result = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-confirm-overlay');
        if (!overlay) return { cancelled: false, reason: 'missing-confirm-overlay' };
        const buttons = [...overlay.querySelectorAll('button')];
        const target = buttons.find(button => /^cancel$/i.test((button.innerText || button.textContent || '').trim()))
            || buttons.find(button => /^(close|no)$/i.test((button.innerText || button.textContent || '').trim()));
        if (!target) {
            return {
                cancelled: false,
                reason: 'missing-cancel-button',
                text: (overlay.innerText || '').slice(0, 1000),
                labels: buttons.map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean),
            };
        }
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return {
            cancelled: true,
            label: (target.innerText || target.textContent || '').trim(),
            text: (overlay.innerText || '').slice(0, 1000),
        };
    }), { userGesture: true, timeoutMs: 15000 }).catch(error => ({
        cancelled: false,
        reason: error?.message || String(error),
    }));
    if (result?.cancelled) {
        await waitFor(client, '!document.querySelector(".saga-confirm-overlay")', 'live Creator stale confirmation close', 15000).catch(() => null);
    }
    return result;
}

async function setLiveCreatorField(client, label, value) {
    return await evaluate(client, script((fieldLabel, nextValue) => {
        const overlay = document.querySelector('.saga-loredeck-creator-workbench-overlay');
        if (!overlay) return { ok: false, reason: 'missing-creator-overlay' };
        const fields = [...overlay.querySelectorAll('label')];
        const field = fields.find(candidate => {
            const text = (candidate.querySelector('span')?.innerText || candidate.querySelector('span')?.textContent || candidate.innerText || '').trim();
            return text === fieldLabel || text.startsWith(`${fieldLabel}:`);
        });
        if (!field) return { ok: false, reason: 'missing-field', label: fieldLabel };
        const input = field.querySelector('input, textarea, select');
        if (!input) return { ok: false, reason: 'missing-input', label: fieldLabel };
        input.scrollIntoView({ block: 'center', inline: 'center' });
        input.focus?.();
        input.value = String(nextValue || '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, label: fieldLabel };
    }, label, value), { userGesture: true });
}

async function setLiveCreatorGenerationSetting(client, key, value) {
    return await evaluate(client, script((settingKey, nextValue) => {
        const input = document.querySelector(`.saga-loredeck-creator-workbench-overlay [data-saga-creator-generation-setting="${settingKey}"]`);
        if (!input) return { ok: false, reason: 'missing-generation-setting', key: settingKey };
        if (input.type === 'checkbox') {
            input.checked = nextValue === true || nextValue === 'true';
        } else {
            const min = Number(input.min);
            const max = Number(input.max);
            const numeric = Number(nextValue);
            const bounded = Number.isFinite(numeric)
                ? Math.max(Number.isFinite(min) ? min : numeric, Math.min(Number.isFinite(max) ? max : numeric, Math.round(numeric)))
                : Number(input.value || 0);
            input.value = String(bounded);
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, key: settingKey, value: input.type === 'checkbox' ? input.checked : input.value };
    }, key, value), { userGesture: true });
}

async function waitForLiveCreatorState(client, expression, label, timeoutMs) {
    await installLiveCreatorStateProbe(client);
    return await waitFor(client, expression, label, timeoutMs);
}

async function waitForLiveCreatorSettled(client, label, timeoutMs) {
    return await waitForLiveCreatorState(
        client,
        '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); return !!state?.overlayOpen && !state?.job?.activeGeneration && !state?.visible?.busyButtons?.length && !state?.visible?.buttonLabels?.includes("Cancel Generation"); })()',
        label,
        timeoutMs,
    );
}

async function waitForLiveCreatorGenerationState(client, readyPredicateSource, readyCheck, label, timeoutMs) {
    const expression = `(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const labels = state?.visible?.buttonLabels || []; const result = state?.job?.lastGenerationResult || {}; return (${readyPredicateSource}) || state?.providerNotReady || state?.actionFailed || labels.includes("Retry Failed") || result.status === "error" || result.status === "failed"; })()`;
    await waitForLiveCreatorState(client, expression, label, timeoutMs);
    let state = await collectLiveCreatorState(client);
    if (readyCheck(state)) return state;
    if ((state.visible?.buttonLabels || []).includes('Retry Failed')) {
        await requireButtonMatching(client, { labels: ['Retry Failed'] }, `${label} retry`, { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorState(client, expression, `${label} retry result`, timeoutMs);
        state = await collectLiveCreatorState(client);
    }
    return state;
}

async function clearLiveCreatorActiveProjectPointers(client) {
    return await evaluate(client, script(async () => {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return { ok: false, reason: 'missing-st-context' };
        const sagaState = ctx.chatMetadata?.saga || {};
        const sagaSettings = ctx.extensionSettings?.saga || {};
        const cleared = {
            metadataActiveJobId: sagaState.loredeckCreator?.activeJobId || '',
            metadataLastJobId: sagaState.loredeckCreator?.lastJobId || '',
            settingsActiveJobId: sagaSettings.loredeckCreatorProjects?.activeJobId || '',
            settingsLastJobId: sagaSettings.loredeckCreatorProjects?.lastJobId || '',
        };
        let metadataChanged = false;
        let settingsChanged = false;
        if (sagaState.loredeckCreator && typeof sagaState.loredeckCreator === 'object') {
            if (sagaState.loredeckCreator.activeJobId) {
                sagaState.loredeckCreator.activeJobId = '';
                metadataChanged = true;
            }
            if (sagaState.loredeckCreator.lastJobId) {
                sagaState.loredeckCreator.lastJobId = '';
                metadataChanged = true;
            }
        }
        if (sagaSettings.loredeckCreatorProjects && typeof sagaSettings.loredeckCreatorProjects === 'object') {
            if (sagaSettings.loredeckCreatorProjects.activeJobId) {
                sagaSettings.loredeckCreatorProjects.activeJobId = '';
                settingsChanged = true;
            }
            if (sagaSettings.loredeckCreatorProjects.lastJobId) {
                sagaSettings.loredeckCreatorProjects.lastJobId = '';
                settingsChanged = true;
            }
        }
        if (metadataChanged && typeof ctx.saveMetadata === 'function') await ctx.saveMetadata();
        if (settingsChanged && typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
        return {
            ok: true,
            cleared,
            metadataChanged,
            settingsChanged,
        };
    }), { userGesture: true });
}

function buildLiveCreatorSmokeProjectCheckExpression() {
    return '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const job = state?.job || {}; const text = [job.fandom, job.scope, job.generatedPackId, job.generatedPackTitle, job.lastGenerationResult?.message, state?.visible?.creatorText].filter(Boolean).join("\\n"); const hasJob = !!job.jobId; const visiblePending = /Review Queue\\s+[1-9]\\d* pending|Pending Review\\s+[1-9]\\d*/i.test(text); const hasGeneratedPack = !!String(job.generatedPackId || "").trim(); const empty = !hasJob ? !visiblePending : ((!job.currentStage || job.currentStage === "intake") && !hasGeneratedPack && !job.briefReady && !job.outlineReady && !(job.titleDraftCount || 0) && !(job.approvedTitleCount || 0) && !(job.planningQueuedCount || 0) && !(job.planningAcceptedCount || 0) && !(job.draftChangeCount || 0) && !(job.acceptedEntryCount || 0) && !visiblePending); const smokeLike = /Automated live Creator smoke|live-creator-|Arlong Park arc focused on Nami|one-piece-arlong/i.test(text); return { hasJob, empty, smokeLike, visiblePending, jobId: job.jobId || "", currentStage: job.currentStage || "", generatedPackId: job.generatedPackId || "" }; })()';
}

async function resetLiveCreatorSmokeProjectToIntakeIfNeeded(client) {
    await installLiveCreatorStateProbe(client);
    const check = await evaluate(client, buildLiveCreatorSmokeProjectCheckExpression(), { timeoutMs: 15000 });
    if (!check?.hasJob || check.empty) {
        return { ok: true, reset: false, reason: check?.hasJob ? 'already-intake' : 'no-active-job', check };
    }
    if (!check.smokeLike) {
        return { ok: false, reset: false, reason: 'active-project-is-not-automated-smoke', check };
    }
    const clicked = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-creator-workbench-overlay');
        if (!overlay) return { clicked: false, reason: 'missing-creator-overlay' };
        const resetButtons = [...overlay.querySelectorAll('button')]
            .map(button => ({
                button,
                label: (button.innerText || button.textContent || '').trim(),
                disabled: !!button.disabled,
            }))
            .filter(item => item.label.includes(String.fromCharCode(0x21b6)) && !item.disabled);
        const target = resetButtons[0]?.button || null;
        if (!target) {
            return {
                clicked: false,
                reason: 'missing-enabled-reset-button',
                labels: [...overlay.querySelectorAll('button')]
                    .map(button => ({ label: (button.innerText || button.textContent || '').trim(), disabled: !!button.disabled }))
                    .filter(item => item.label)
                    .slice(0, 80),
            };
        }
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return { clicked: true, label: (target.innerText || target.textContent || '').trim() };
    }), { userGesture: true, timeoutMs: 30000 });
    if (!clicked?.clicked) return { ok: false, reset: false, reason: clicked?.reason || 'reset-click-failed', check, clicked };
    await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'live Creator stale smoke reset confirmation', 10000);
    const confirmed = await confirmLiveCreatorDialog(client, '', { timeoutMs: 60000 });
    if (!confirmed?.clicked) return { ok: false, reset: false, reason: confirmed?.reason || 'reset-confirm-failed', check, clicked, confirmed };
    let waitError = '';
    try {
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const job = state?.job || {}; const text = state?.visible?.creatorText || ""; return (!job.currentStage || job.currentStage === "intake") && !String(job.generatedPackId || "").trim() && !job.briefReady && !job.outlineReady && !(job.titleDraftCount || 0) && !(job.approvedTitleCount || 0) && !(job.planningQueuedCount || 0) && !(job.planningAcceptedCount || 0) && !(job.draftChangeCount || 0) && !(job.acceptedEntryCount || 0) && !/Review Queue\\s+[1-9]\\d* pending|Pending Review\\s+[1-9]\\d*/i.test(text); })()',
            'live Creator stale smoke reset to intake',
            60000,
        );
    } catch (error) {
        waitError = error?.message || String(error);
    }
    const after = await collectLiveCreatorState(client);
    const lateClean = await evaluate(client, buildLiveCreatorSmokeProjectCheckExpression(), { timeoutMs: 15000 }).catch(() => null);
    if (waitError && !lateClean?.empty) {
        return { ok: false, reset: false, reason: waitError, check, clicked, confirmed, after, lateClean };
    }
    return {
        ok: true,
        reset: true,
        ...(waitError ? { waitRecovered: true, waitError } : {}),
        check,
        clicked,
        confirmed: redactDiagnosticValue(confirmed),
        after,
        lateClean,
    };
}

async function openLiveCreatorWorkbench(client) {
    await switchSagaExperienceMode(client, 'advanced');
    await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="loredecks"]');
    await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "loredecks"', 'Live Creator Loredecks tab active', 10000);
    await waitFor(client, 'document.querySelector(".saga-runtime-drawer")?.innerText.includes("Loredecks")', 'Live Creator Loredecks drawer', 10000);
    await wait(700);
    const directCreateOpened = await clickButtonText(client, 'Create Deck');
    if (directCreateOpened) {
        const directCreatorReady = await waitFor(
            client,
            '!!document.querySelector(".saga-loredeck-creator-workbench-overlay")',
            'Live Creator direct workbench overlay',
            20000,
        ).then(() => true).catch(() => false);
        if (directCreatorReady) {
            await installLiveCreatorStateProbe(client);
            await wait(700);
            return;
        }
    }
    const libraryAlreadyOpen = await evaluate(client, '!!document.querySelector(".saga-loredeck-library-overlay")').catch(() => false);
    if (!libraryAlreadyOpen) {
        const libraryOpened = await clickButtonText(client, 'Open Loredeck Library');
        if (!libraryOpened) throw new Error('Could not open Loredeck Library for live Creator smoke.');
    }
    await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay")', 'Live Creator Library overlay', 90000);
    await wait(700);
    const createOpened = await clickButtonText(client, 'Create Deck', { root: '.saga-loredeck-library-overlay' });
    if (!createOpened) throw new Error('Could not open Loredeck Creator from the live Library.');
    await waitFor(client, '!!document.querySelector(".saga-loredeck-creator-workbench-overlay")', 'Live Creator workbench overlay', 90000);
    await installLiveCreatorStateProbe(client);
    await wait(700);
}

async function openLiveCreatorLibraryPack(client, packId = '') {
    const id = String(packId || '').trim();
    if (!id) return { ok: false, reason: 'missing-pack-id' };
    await evaluate(client, script(() => {
        document.querySelector('.saga-loredeck-metadata-overlay')?.remove();
        document.querySelector('.saga-loredeck-creator-workbench-overlay')?.remove();
        document.querySelector('.saga-confirm-overlay')?.remove();
        return true;
    }), { userGesture: true }).catch(() => false);
    await clickSelector(client, '.saga-runtime-rail-tab[data-tab-id="loredecks"]').catch(() => false);
    await wait(500);
    const libraryOpen = await evaluate(client, '!!document.querySelector(".saga-loredeck-library-overlay")');
    if (!libraryOpen) {
        const opened = await clickButtonText(client, 'Open Loredeck Library').catch(() => false);
        if (!opened) return { ok: false, reason: 'library-open-failed' };
        await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay")', 'Live Creator finalized Library overlay', 10000);
    }
    await wait(700);
    return await evaluate(client, script(packIdToSelect => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        if (!overlay) return { ok: false, reason: 'missing-library-overlay' };
        const search = overlay.querySelector('.saga-loredeck-library-search');
        if (search) {
            search.value = '';
            search.dispatchEvent(new Event('input', { bubbles: true }));
            search.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const card = [...overlay.querySelectorAll('[data-pack-id]')]
            .find(element => element.getAttribute('data-pack-id') === packIdToSelect);
        if (!card) {
            return {
                ok: false,
                reason: 'missing-pack-card',
                cards: [...overlay.querySelectorAll('[data-pack-id]')].map(element => element.getAttribute('data-pack-id')).filter(Boolean).slice(0, 120),
                text: (overlay.innerText || '').slice(0, 1400),
            };
        }
        card.scrollIntoView({ block: 'center', inline: 'center' });
        card.click();
        return {
            ok: true,
            packId: packIdToSelect,
            cardText: (card.innerText || card.textContent || '').slice(0, 600),
        };
    }, id), { userGesture: true });
}

async function verifyLiveCreatorFinalizedDeck(client, created = {}, screenshots, screenshotName = '') {
    const sourceGeneratedPackIds = [...new Set(created.generatedPackIds || [])].filter(Boolean);
    const creatorJobIds = [...new Set(created.jobIds || [])].filter(Boolean);
    const before = await collectLiveCreatorState(client).catch(() => null);
    const externalCandidate = await evaluate(client, script(async args => {
        const sourceIds = new Set(args.sourceGeneratedPackIds || []);
        const jobIds = new Set(args.creatorJobIds || []);
        const readJson = async url => {
            try {
                const response = await fetch(url, { cache: 'no-store' });
                if (!response.ok) return null;
                return await response.json();
            } catch (_) {
                return null;
            }
        };
        const index = await readJson('/user/files/saga-library-index.v1.json');
        const packs = index?.packs && typeof index.packs === 'object' && !Array.isArray(index.packs)
            ? Object.values(index.packs)
            : [];
        return packs
            .filter(pack => {
                if (!pack || typeof pack !== 'object') return false;
                if (pack.type !== 'custom') return false;
                const sourceId = String(pack.source?.originalPackId || pack.derivedFrom?.packId || '').trim();
                const jobId = String(pack.derivedFrom?.creatorJobId || '').trim();
                return (sourceId && sourceIds.has(sourceId)) || (jobId && jobIds.has(jobId));
            })
            .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
            .map(pack => pack.packId || pack.id || '')
            .find(Boolean) || '';
    }, {
        sourceGeneratedPackIds,
        creatorJobIds,
    })).catch(() => '');
    const finalizedPackId = [
        ...(created.finalizedPackIds || []),
        ...(before?.finalizedPacks || []).map(pack => pack.packId),
        before?.selectedPack?.type === 'custom' && (before.selectedPack.originalPackId || before.selectedPack.creatorJobId)
            ? before.selectedPack.packId
            : '',
        externalCandidate,
    ].filter(Boolean).at(-1) || '';
    if (!finalizedPackId) {
        return {
            ok: false,
            reason: 'missing-finalized-pack-id',
            before,
            externalCandidate,
        };
    }

    const openState = await openLiveCreatorLibraryPack(client, finalizedPackId);
    await wait(900);
    let shot = '';
    if (screenshotName) {
        shot = await screenshot(client, screenshotName);
        screenshots.push(shot);
    }

    const check = await evaluate(client, script(async args => {
        const finalizedId = args.finalizedPackId;
        const sourceIds = new Set(args.sourceGeneratedPackIds || []);
        const ctx = window.SillyTavern?.getContext?.();
        const metadata = ctx?.chatMetadata?.saga || {};
        const settings = ctx?.extensionSettings?.saga || {};
        const readFile = async url => {
            const cleanUrl = String(url || '').trim();
            if (!cleanUrl) return { url: '', skipped: true, ok: true };
            try {
                const response = await fetch(cleanUrl, { cache: 'no-store' });
                const text = await response.text().catch(() => '');
                let json = null;
                try {
                    json = text ? JSON.parse(text) : null;
                } catch (_) {
                    json = null;
                }
                return {
                    url: cleanUrl,
                    ok: response.ok,
                    status: response.status,
                    contentType: response.headers.get('content-type') || '',
                    bytes: text.length,
                    json,
                    textSample: json ? '' : text.slice(0, 300),
                };
            } catch (error) {
                return {
                    url: cleanUrl,
                    ok: false,
                    status: 0,
                    error: error?.message || String(error),
                };
            }
        };
        const libraryIndexRead = await readFile('/user/files/saga-library-index.v1.json');
        const externalPacks = libraryIndexRead.json?.packs && typeof libraryIndexRead.json.packs === 'object' && !Array.isArray(libraryIndexRead.json.packs)
            ? libraryIndexRead.json.packs
            : {};
        const packs = {
            ...externalPacks,
            ...(settings.loredeckLibrary?.packs || {}),
            ...(metadata.loredeckLibrary?.packs || {}),
        };
        const row = packs[finalizedId] || null;
        const sourceRows = [...sourceIds].map(id => ({
            packId: id,
            present: !!packs[id],
            type: packs[id]?.type || '',
            title: packs[id]?.title || '',
        }));
        const rowEntryCount = row?.entryOverrides && typeof row.entryOverrides === 'object' && !Array.isArray(row.entryOverrides)
            ? Object.keys(row.entryOverrides).length
            : 0;
        const payloadRead = await readFile(row?.payloadFile || '');
        const payload = payloadRead.json && typeof payloadRead.json === 'object' && !Array.isArray(payloadRead.json)
            ? payloadRead.json
            : null;
        const effective = payload ? { ...row, ...payload } : row;
        const effectiveEntries = effective?.entryOverrides && typeof effective.entryOverrides === 'object' && !Array.isArray(effective.entryOverrides)
            ? effective.entryOverrides
            : {};
        const effectiveEntryCount = Object.keys(effectiveEntries).length;
        const pendingChanges = Array.isArray(effective?.pendingChanges) ? effective.pendingChanges : [];
        const sourceOriginalPackId = effective?.source?.originalPackId || effective?.derivedFrom?.packId || row?.source?.originalPackId || row?.derivedFrom?.packId || '';
        const sourceMatches = sourceIds.size ? sourceIds.has(sourceOriginalPackId) : !!sourceOriginalPackId;
        const coverFile = row?.coverFile
            || effective?.coverFile
            || effective?.assetRefs?.cover
            || effective?.assets?.cover?.path
            || '';
        const coverRead = await readFile(coverFile);
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const overlayText = overlay?.innerText || '';
        const selectedId = String(metadata.lorePanel?.selectedLoredeckId || '').trim();
        const selectedVisible = [...(overlay?.querySelectorAll('[data-pack-id]') || [])]
            .some(element => element.getAttribute('data-pack-id') === finalizedId);
        const buttons = [...(overlay?.querySelectorAll('button') || [])]
            .map(button => ({
                label: (button.innerText || button.textContent || '').trim(),
                ariaLabel: button.getAttribute('aria-label') || '',
                disabled: !!button.disabled,
            }))
            .filter(button => button.label || button.ariaLabel);
        const hasDelete = buttons.some(button => (button.label === 'Delete' || button.ariaLabel === 'Delete') && !button.disabled)
            || overlayText.includes('Delete');
        const hasCustomSignal = overlayText.includes('Custom') || row?.type === 'custom';
        const settingsText = JSON.stringify(settings);
        const rowJson = JSON.stringify(row || {});
        const payloadMode = row?.payloadFile ? 'external' : 'embedded';
        const payloadOk = payloadMode === 'embedded' || (payloadRead.ok && !!payload);
        const payloadReferencesOwnPack = !payload || !payload.packId || payload.packId === finalizedId;
        const sourceRetired = sourceRows.every(item => !item.present);
        const settingsHasFullEntryPayloadHint = Object.keys(effectiveEntries).some(entryId => entryId && settingsText.includes(entryId)) && payloadMode === 'external';
        const ok = !!(
            row
            && row.type === 'custom'
            && hasCustomSignal
            && sourceRetired
            && sourceMatches
            && effectiveEntryCount >= 1
            && pendingChanges.length === 0
            && payloadOk
            && payloadReferencesOwnPack
            && coverRead.ok
            && selectedId === finalizedId
            && selectedVisible
            && hasDelete
            && !settingsHasFullEntryPayloadHint
        );
        return {
            ok,
            finalizedPackId: finalizedId,
            sourceGeneratedPackIds: [...sourceIds],
            selectedLoredeckId: selectedId,
            selectedVisible,
            hasDelete,
            hasCustomSignal,
            row: row ? {
                packId: row.packId || row.id || '',
                title: row.title || '',
                type: row.type || '',
                payloadFile: row.payloadFile || '',
                coverFile: row.coverFile || '',
                sourceKind: row.source?.kind || '',
                sourceOriginalPackId: row.source?.originalPackId || '',
                derivedFromPackId: row.derivedFrom?.packId || '',
                derivedFromType: row.derivedFrom?.type || '',
                creatorJobId: row.derivedFrom?.creatorJobId || '',
                healthStatus: row.healthStatus || '',
                rowEntryCount,
                rowBytes: rowJson.length,
            } : null,
            payloadMode,
            payloadRead: payloadRead.skipped ? payloadRead : {
                url: payloadRead.url,
                ok: payloadRead.ok,
                status: payloadRead.status,
                contentType: payloadRead.contentType,
                bytes: payloadRead.bytes,
                error: payloadRead.error || '',
                payloadPackId: payload?.packId || payload?.id || '',
                payloadType: payload?.type || '',
                payloadHealthStatus: payload?.healthStatus || '',
                payloadEntryCount: payload && payload.entryOverrides && typeof payload.entryOverrides === 'object' && !Array.isArray(payload.entryOverrides)
                    ? Object.keys(payload.entryOverrides).length
                    : 0,
                pendingChangeCount: Array.isArray(payload?.pendingChanges) ? payload.pendingChanges.length : 0,
            },
            coverRead: coverRead.skipped ? coverRead : {
                url: coverRead.url,
                ok: coverRead.ok,
                status: coverRead.status,
                contentType: coverRead.contentType,
                bytes: coverRead.bytes,
                error: coverRead.error || '',
            },
            sourceRows,
            sourceRetired,
            sourceMatches,
            effectiveEntryCount,
            pendingChangeCount: pendingChanges.length,
            payloadReferencesOwnPack,
            settingsHasFullEntryPayloadHint,
            libraryIndexRead: libraryIndexRead.skipped ? libraryIndexRead : {
                ok: libraryIndexRead.ok,
                status: libraryIndexRead.status,
                bytes: libraryIndexRead.bytes,
                error: libraryIndexRead.error || '',
            },
            overlayText: overlayText.slice(0, 1600),
        };
    }, {
        finalizedPackId,
        sourceGeneratedPackIds,
    }));

    return redactDiagnosticValue({
        ok: !!(openState?.ok && check?.ok),
        finalizedPackId,
        sourceGeneratedPackIds,
        screenshot: shot,
        openState,
        check,
    });
}

function getLiveCreatorSmokeLinkSets(created = {}) {
    return {
        generatedPackIds: new Set([...(created.generatedPackIds || [])].map(value => String(value || '').trim()).filter(Boolean)),
        finalizedPackIds: new Set([...(created.finalizedPackIds || [])].map(value => String(value || '').trim()).filter(Boolean)),
        jobIds: new Set([...(created.jobIds || [])].map(value => String(value || '').trim()).filter(Boolean)),
    };
}

function isLiveCreatorSmokeLinkedPack(packId = '', pack = {}, created = {}) {
    const links = getLiveCreatorSmokeLinkSets(created);
    const id = String(pack?.packId || pack?.id || packId || '').trim();
    const sourceId = String(pack?.source?.originalPackId || pack?.derivedFrom?.packId || '').trim();
    const creatorJobId = String(pack?.derivedFrom?.creatorJobId || '').trim();
    if (id && (links.generatedPackIds.has(id) || links.finalizedPackIds.has(id))) return true;
    if (sourceId && links.generatedPackIds.has(sourceId)) return true;
    if (creatorJobId && links.jobIds.has(creatorJobId)) return true;
    return false;
}

function summarizeLiveCreatorFinalizedPayload(payload = null) {
    if (!payload || typeof payload !== 'object') return null;
    const packId = String(payload.packId || payload.id || '').trim();
    const entries = payload.entryOverrides && typeof payload.entryOverrides === 'object' && !Array.isArray(payload.entryOverrides)
        ? Object.values(payload.entryOverrides)
        : [];
    return {
        packId,
        type: payload.type || '',
        title: payload.title || '',
        sourceKind: payload.source?.kind || '',
        originalPackId: payload.source?.originalPackId || payload.derivedFrom?.packId || '',
        creatorJobId: payload.derivedFrom?.creatorJobId || '',
        entryCount: entries.length,
        pendingChangeCount: Array.isArray(payload.pendingChanges) ? payload.pendingChanges.length : 0,
        disabledEntryCount: Array.isArray(payload.disabledEntryIds) ? payload.disabledEntryIds.length : 0,
        manifestId: payload.manifestData?.id || '',
        manifestType: payload.manifestData?.type || '',
        payloadFile: payload.payloadFile || '',
        finalizedEntryIds: entries.map(entry => entry?.id || '').filter(Boolean).slice(0, 20),
        entriesReferenceCustomPack: !!packId && entries.every(entry => String(entry?.source || '').includes(`:${packId}:custom`)),
        entriesRetiredCreatorMarker: entries.every(entry => !entry?.extensions?.sagaLoredeckCreator),
        entriesHaveFinalizedFrom: entries.every(entry => !!entry?.extensions?.sagaLoredeckFinalizedFrom?.packId),
    };
}

async function findLiveCreatorFinalizedDeckViaFiles(smokeUrl, created = {}, headers = {}) {
    const libraryRead = await readLiveUserJson(smokeUrl, '/user/files/saga-library-index.v1.json', { headers });
    if (!libraryRead.ok) {
        return { ok: false, reason: 'library-index-read-failed', libraryRead };
    }
    const packs = libraryRead.value?.packs && typeof libraryRead.value.packs === 'object' && !Array.isArray(libraryRead.value.packs)
        ? libraryRead.value.packs
        : {};
    const matches = Object.entries(packs)
        .map(([packId, pack]) => ({ packId, pack }))
        .filter(({ packId, pack }) => String(pack?.type || '').trim() === 'custom' && isLiveCreatorSmokeLinkedPack(packId, pack, created))
        .sort((a, b) => Number(b.pack?.updatedAt || b.pack?.createdAt || 0) - Number(a.pack?.updatedAt || a.pack?.createdAt || 0));
    if (!matches.length) {
        return {
            ok: false,
            reason: 'finalized-pack-not-found',
            libraryRead: { ok: true, bytes: libraryRead.bytes, packCount: Object.keys(packs).length },
        };
    }
    const match = matches[0];
    const payloadFile = String(match.pack?.payloadFile || `/user/files/saga-pack-${match.packId}.v1.json`).trim();
    const payloadRead = await readLiveUserJson(smokeUrl, payloadFile, { headers });
    const payloadSummary = summarizeLiveCreatorFinalizedPayload(payloadRead.ok ? payloadRead.value : null);
    const sourceGeneratedPackIds = [...getLiveCreatorSmokeLinkSets(created).generatedPackIds];
    const sourceRetired = sourceGeneratedPackIds.every(sourceId => !packs[sourceId]);
    const check = {
        ok: !!(
            payloadRead.ok
            && payloadSummary
            && payloadSummary.type === 'custom'
            && payloadSummary.entryCount > 0
            && payloadSummary.pendingChangeCount === 0
            && payloadSummary.entriesReferenceCustomPack
            && payloadSummary.entriesRetiredCreatorMarker
            && payloadSummary.entriesHaveFinalizedFrom
            && sourceRetired
        ),
        finalizedPackId: match.packId,
        libraryRecord: {
            packId: match.pack?.packId || match.packId,
            type: match.pack?.type || '',
            title: match.pack?.title || '',
            payloadFile,
            originalPackId: match.pack?.source?.originalPackId || match.pack?.derivedFrom?.packId || '',
            creatorJobId: match.pack?.derivedFrom?.creatorJobId || '',
            entryCount: match.pack?.entryCount || match.pack?.stats?.entryCount || 0,
            healthStatus: match.pack?.healthStatus || '',
            coverageAcknowledged: !!match.pack?.derivedFrom?.creatorCoverage?.acknowledged,
        },
        payloadRead: payloadRead.ok ? { ok: true, status: payloadRead.status, bytes: payloadRead.bytes } : payloadRead,
        payloadSummary,
        sourceGeneratedPackIds,
        sourceRetired,
    };
    return { ok: check.ok, finalizedPackId: match.packId, check };
}

async function waitForLiveCreatorFinalizedDeckViaFiles(smokeUrl, created = {}, headers = {}, timeoutMs = 90000) {
    const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 90000);
    let last = null;
    while (Date.now() < deadline) {
        last = await findLiveCreatorFinalizedDeckViaFiles(smokeUrl, created, headers).catch(error => ({
            ok: false,
            reason: error?.message || String(error),
        }));
        if (last?.ok) return last;
        await wait(1000);
    }
    return { ok: false, reason: 'timeout', last };
}

function cleanupLiveCreatorIndexValue(indexValue = {}, created = {}, deleteFiles = new Set()) {
    const links = getLiveCreatorSmokeLinkSets(created);
    const index = indexValue && typeof indexValue === 'object' && !Array.isArray(indexValue)
        ? indexValue
        : {};
    const projects = index.projects && typeof index.projects === 'object' && !Array.isArray(index.projects)
        ? index.projects
        : {};
    const removedCreatorProjectIds = [];
    let changed = false;
    for (const [projectId, project] of Object.entries(projects)) {
        const id = String(project?.jobId || project?.projectId || projectId || '').trim();
        const generatedPackId = String(project?.generatedPackId || project?.linkedGeneratedPackId || '').trim();
        const projectFile = String(project?.projectFile || project?.payloadFile || '').trim();
        const smokeOwned = links.jobIds.has(id)
            || links.jobIds.has(projectId)
            || links.generatedPackIds.has(generatedPackId)
            || (projectFile && deleteFiles.has(projectFile));
        if (!smokeOwned) continue;
        delete projects[projectId];
        if (projectFile) deleteFiles.add(projectFile);
        removedCreatorProjectIds.push(projectId);
        changed = true;
    }
    index.projects = projects;
    const removed = new Set(removedCreatorProjectIds);
    const remaining = Object.entries(projects)
        .map(([projectId, project]) => ({
            projectId,
            jobId: String(project?.jobId || project?.projectId || projectId || '').trim(),
            updatedAt: Number(project?.updatedAt || project?.createdAt || 0),
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt || a.projectId.localeCompare(b.projectId));
    const fallbackId = remaining[0]?.jobId || remaining[0]?.projectId || '';
    for (const key of ['activeJobId', 'activeProjectId', 'lastJobId', 'lastProjectId']) {
        const value = String(index[key] || '').trim();
        if (value && (removed.has(value) || !projects[value])) {
            index[key] = fallbackId;
            changed = true;
        }
    }
    if (changed) {
        index.updatedAt = Date.now();
        index.revision = Math.max(1, Number(index.revision || 0) + 1);
    }
    return {
        index,
        changed,
        removedCreatorProjectIds,
    };
}

async function deleteLiveCreatorPackById(client, packId = '') {
    const id = String(packId || '').trim();
    if (!id) return { ok: false, packId: id, reason: 'missing-pack-id' };
    const selected = await openLiveCreatorLibraryPack(client, id);
    if (!selected?.ok) return { ok: false, packId: id, reason: selected?.reason || 'select-failed', details: selected };
    await wait(700);
    const deleteClicked = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        if (!overlay) return { ok: false, reason: 'missing-library-overlay' };
        const buttons = [...overlay.querySelectorAll('button')];
        let target = buttons.find(button => (button.getAttribute('aria-label') || '').trim() === 'Delete' && !button.disabled);
        if (!target) {
            for (const group of overlay.querySelectorAll('.saga-loredeck-library-square-action-group')) {
                const label = (group.querySelector('.saga-loredeck-library-square-action-label')?.innerText
                    || group.querySelector('.saga-loredeck-library-square-action-label')?.textContent
                    || '').trim();
                const button = group.querySelector('button');
                if (label === 'Delete' && button && !button.disabled) {
                    target = button;
                    break;
                }
            }
        }
        if (!target) {
            return {
                ok: false,
                reason: 'missing-delete-button',
                buttons: buttons.map(button => ({
                    label: (button.innerText || button.textContent || '').trim(),
                    ariaLabel: button.getAttribute('aria-label') || '',
                    disabled: !!button.disabled,
                })).filter(button => button.label || button.ariaLabel).slice(0, 80),
            };
        }
        target.scrollIntoView({ block: 'center', inline: 'center' });
        target.click();
        return { ok: true };
    }), { userGesture: true });
    if (!deleteClicked?.ok) return { ok: false, packId: id, reason: deleteClicked?.reason || 'delete-click-failed', details: deleteClicked };
    await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'cleanup delete confirmation', 10000);
    const confirmed = await confirmLiveCreatorDialog(client, 'Confirm|Delete');
    if (!confirmed?.clicked) return { ok: false, packId: id, reason: 'delete-confirm-failed', details: confirmed };
    await waitFor(client, script(packIdToDelete => {
        const ctx = window.SillyTavern?.getContext?.();
        const packs = {
            ...(ctx?.extensionSettings?.saga?.loredeckLibrary?.packs || {}),
            ...(ctx?.chatMetadata?.saga?.loredeckLibrary?.packs || {}),
        };
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const visible = [...(overlay?.querySelectorAll('[data-pack-id]') || [])]
            .some(element => element.getAttribute('data-pack-id') === packIdToDelete);
        return !packs[packIdToDelete] && !visible;
    }, id), `cleanup pack ${id} removed`, 15000);
    return { ok: true, packId: id };
}

async function cleanupLiveCreatorArtifactsViaFilesApi(smokeUrl, created = {}, headers = {}) {
    const libraryRead = await readLiveUserJson(smokeUrl, '/user/files/saga-library-index.v1.json', { headers });
    const storageRead = await readLiveUserJson(smokeUrl, '/user/files/saga-storage-index.v1.json', { headers });
    const creatorRead = await readLiveUserJson(smokeUrl, '/user/files/saga-creator-index.v1.json', { headers });
    const links = getLiveCreatorSmokeLinkSets(created);
    const deleted = [];
    const failed = [];
    const removedPackIds = [];
    const removedCreatorProjectIds = [];
    const removedStoragePaths = [];
    const payloadFiles = new Set();
    const deleteFiles = new Set();
    if (!libraryRead.ok) {
        return {
            ok: false,
            via: 'files-api',
            reason: 'library-index-read-failed',
            libraryRead,
            storageRead,
            creatorRead,
            deleted,
            failed,
        };
    }

    const library = libraryRead.value && typeof libraryRead.value === 'object' && !Array.isArray(libraryRead.value)
        ? libraryRead.value
        : {};
    const packs = library.packs && typeof library.packs === 'object' && !Array.isArray(library.packs)
        ? library.packs
        : {};
    for (const [packId, pack] of Object.entries(packs)) {
        if (!isLiveCreatorSmokeLinkedPack(packId, pack, created)) continue;
        removedPackIds.push(packId);
        const payloadFile = String(pack?.payloadFile || '').trim();
        if (payloadFile) {
            payloadFiles.add(payloadFile);
            deleteFiles.add(payloadFile);
        }
        delete packs[packId];
    }
    library.packs = packs;
    if (Array.isArray(library.activeStack)) {
        library.activeStack = library.activeStack.filter(item => !removedPackIds.includes(String(item?.packId || item?.deckId || '').trim()));
    }
    if (Array.isArray(library.deckPlacements)) {
        library.deckPlacements = library.deckPlacements.filter(item => !removedPackIds.includes(String(item?.packId || item?.deckId || '').trim()));
    }
    if (removedPackIds.length) {
        library.updatedAt = Date.now();
        library.revision = Math.max(1, Number(library.revision || 0) + 1);
        const upload = await uploadLiveUserJson(smokeUrl, 'saga-library-index.v1.json', library, headers);
        if (!upload.ok) failed.push({ kind: 'library-index-upload', ...upload });
    }

    if (storageRead.ok) {
        const storage = storageRead.value && typeof storageRead.value === 'object' && !Array.isArray(storageRead.value)
            ? storageRead.value
            : {};
        const files = storage.files && typeof storage.files === 'object' && !Array.isArray(storage.files)
            ? storage.files
            : {};
        for (const [file, record] of Object.entries(files)) {
            const ownerId = String(record?.ownerId || '').trim();
            const smokeOwned = removedPackIds.includes(ownerId)
                || links.generatedPackIds.has(ownerId)
                || links.finalizedPackIds.has(ownerId)
                || links.jobIds.has(ownerId);
            if (payloadFiles.has(file) || smokeOwned) {
                delete files[file];
                deleteFiles.add(file);
                removedStoragePaths.push(file);
            }
        }
        if (removedStoragePaths.length) {
            storage.files = files;
            storage.updatedAt = Date.now();
            storage.revision = Math.max(1, Number(storage.revision || 0) + 1);
            const upload = await uploadLiveUserJson(smokeUrl, 'saga-storage-index.v1.json', storage, headers);
            if (!upload.ok) failed.push({ kind: 'storage-index-upload', ...upload });
        }
    }

    if (creatorRead.ok) {
        const creatorCleanup = cleanupLiveCreatorIndexValue(creatorRead.value, created, deleteFiles);
        removedCreatorProjectIds.push(...creatorCleanup.removedCreatorProjectIds);
        if (creatorCleanup.changed) {
            const upload = await uploadLiveUserJson(smokeUrl, 'saga-creator-index.v1.json', creatorCleanup.index, headers);
            if (!upload.ok) failed.push({ kind: 'creator-index-upload', ...upload });
        }
    }

    for (const file of deleteFiles) {
        const result = await deleteLiveUserFile(smokeUrl, file, headers).catch(error => ({
            ok: false,
            error: error?.message || String(error),
        }));
        if (result.ok || result.status === 404) deleted.push(file);
        else failed.push({ kind: 'payload-delete', path: file, ...result });
    }

    const verify = [];
    for (const file of deleteFiles) {
        const read = await fetchTextWithTimeout(userFileUrl(smokeUrl, file), { headers, timeoutMs: 10000 }).catch(error => ({
            ok: false,
            status: 0,
            text: error?.message || String(error),
        }));
        verify.push({ path: file, status: read.status, deleted: read.status === 404 });
        if (read.status !== 404) failed.push({ kind: 'payload-still-readable', path: file, status: read.status });
    }

    return {
        ok: failed.length === 0,
        via: 'files-api',
        removedPackIds,
        removedCreatorProjectIds,
        payloadFiles: [...payloadFiles],
        deletedFiles: [...deleteFiles],
        deleted,
        removedStoragePaths,
        failed,
        verify,
    };
}

async function cleanupLiveCreatorArtifactsViaFilesystem(created = {}) {
    const userFilesDir = getLiveCreatorUserFilesDir();
    const deleted = [];
    const failed = [];
    const removedPackIds = [];
    const removedCreatorProjectIds = [];
    const removedStoragePaths = [];
    const payloadFiles = new Set();
    const deleteFiles = new Set();
    if (!userFilesDir) {
        return {
            ok: false,
            via: 'filesystem',
            skipped: true,
            reason: 'missing-user-files-dir',
            env: [
                'SAGA_LIVE_CREATOR_USER_FILES_DIR',
                'SAGA_ST_USER_FILES_DIR',
                'SAGA_LIVE_CREATOR_DATA_DIR',
                'SAGA_ST_DATA_DIR',
            ],
            deleted,
            failed,
        };
    }

    const links = getLiveCreatorSmokeLinkSets(created);
    const libraryRead = await readLiveUserJsonFromFilesystem(userFilesDir, 'saga-library-index.v1.json');
    const storageRead = await readLiveUserJsonFromFilesystem(userFilesDir, 'saga-storage-index.v1.json');
    const creatorRead = await readLiveUserJsonFromFilesystem(userFilesDir, 'saga-creator-index.v1.json');
    if (!libraryRead.ok) {
        return {
            ok: false,
            via: 'filesystem',
            reason: 'library-index-read-failed',
            userFilesDir,
            libraryRead,
            storageRead,
            creatorRead,
            deleted,
            failed,
        };
    }

    const library = libraryRead.value && typeof libraryRead.value === 'object' && !Array.isArray(libraryRead.value)
        ? libraryRead.value
        : {};
    const packs = library.packs && typeof library.packs === 'object' && !Array.isArray(library.packs)
        ? library.packs
        : {};
    for (const [packId, pack] of Object.entries(packs)) {
        if (!isLiveCreatorSmokeLinkedPack(packId, pack, created)) continue;
        removedPackIds.push(packId);
        const payloadFile = String(pack?.payloadFile || '').trim();
        if (payloadFile) {
            payloadFiles.add(payloadFile);
            deleteFiles.add(payloadFile);
        }
        delete packs[packId];
    }
    library.packs = packs;
    if (Array.isArray(library.activeStack)) {
        library.activeStack = library.activeStack.filter(item => !removedPackIds.includes(String(item?.packId || item?.deckId || '').trim()));
    }
    if (Array.isArray(library.deckPlacements)) {
        library.deckPlacements = library.deckPlacements.filter(item => !removedPackIds.includes(String(item?.packId || item?.deckId || '').trim()));
    }
    if (removedPackIds.length) {
        library.updatedAt = Date.now();
        library.revision = Math.max(1, Number(library.revision || 0) + 1);
        const written = await writeLiveUserJsonToFilesystem(userFilesDir, 'saga-library-index.v1.json', library);
        if (!written.ok) failed.push({ kind: 'library-index-write', ...written });
    }

    if (storageRead.ok) {
        const storage = storageRead.value && typeof storageRead.value === 'object' && !Array.isArray(storageRead.value)
            ? storageRead.value
            : {};
        const files = storage.files && typeof storage.files === 'object' && !Array.isArray(storage.files)
            ? storage.files
            : {};
        for (const [file, record] of Object.entries(files)) {
            const ownerId = String(record?.ownerId || '').trim();
            const smokeOwned = removedPackIds.includes(ownerId)
                || links.generatedPackIds.has(ownerId)
                || links.finalizedPackIds.has(ownerId)
                || links.jobIds.has(ownerId);
            if (payloadFiles.has(file) || smokeOwned) {
                delete files[file];
                deleteFiles.add(file);
                removedStoragePaths.push(file);
            }
        }
        if (removedStoragePaths.length) {
            storage.files = files;
            storage.updatedAt = Date.now();
            storage.revision = Math.max(1, Number(storage.revision || 0) + 1);
            const written = await writeLiveUserJsonToFilesystem(userFilesDir, 'saga-storage-index.v1.json', storage);
            if (!written.ok) failed.push({ kind: 'storage-index-write', ...written });
        }
    } else {
        failed.push({ kind: 'storage-index-read', ...storageRead });
    }

    if (creatorRead.ok) {
        const creatorCleanup = cleanupLiveCreatorIndexValue(creatorRead.value, created, deleteFiles);
        removedCreatorProjectIds.push(...creatorCleanup.removedCreatorProjectIds);
        if (creatorCleanup.changed) {
            const written = await writeLiveUserJsonToFilesystem(userFilesDir, 'saga-creator-index.v1.json', creatorCleanup.index);
            if (!written.ok) failed.push({ kind: 'creator-index-write', ...written });
        }
    } else {
        failed.push({ kind: 'creator-index-read', ...creatorRead });
    }

    for (const file of deleteFiles) {
        const result = await deleteLiveUserFileFromFilesystem(userFilesDir, file);
        if (result.ok) deleted.push(file);
        else failed.push({ kind: 'payload-delete', ...result });
    }

    const verify = [];
    for (const file of deleteFiles) {
        const filePath = liveUserFileFilesystemPath(userFilesDir, file);
        const stillExists = filePath ? await exists(filePath) : true;
        verify.push({ path: file, deleted: !stillExists });
        if (stillExists) failed.push({ kind: 'payload-still-present', path: file, filesystemPath: filePath });
    }

    return {
        ok: failed.length === 0,
        via: 'filesystem',
        userFilesDir,
        removedPackIds,
        removedCreatorProjectIds,
        payloadFiles: [...payloadFiles],
        deletedFiles: [...deleteFiles],
        deleted,
        removedStoragePaths,
        failed,
        verify,
    };
}

async function cleanupLiveCreatorArtifacts(client, created = {}, findings = []) {
    const state = await collectLiveCreatorState(client).catch(() => null);
    const packIds = new Set([
        ...(created.finalizedPackIds || []),
        ...(state?.finalizedPacks || []).map(pack => pack.packId),
    ].filter(Boolean));
    if (state?.selectedPack?.type === 'custom' && (state.selectedPack.originalPackId || state.selectedPack.creatorJobId)) {
        packIds.add(state.selectedPack.packId);
    }
    const attempted = [];
    for (const packId of packIds) {
        const result = await deleteLiveCreatorPackById(client, packId).catch(error => ({
            ok: false,
            packId,
            reason: error?.message || String(error),
        }));
        attempted.push(redactDiagnosticValue(result));
        if (!result.ok) findings.push(`Live Creator cleanup could not delete ${packId}: ${result.reason || 'unknown failure'}.`);
    }
    return {
        attempted,
        deleted: attempted.filter(item => item.ok).map(item => item.packId),
        failed: attempted.filter(item => !item.ok),
    };
}

async function cleanupPreviousLiveCreatorSmokeResidue(client) {
    return await evaluate(client, script(async () => {
        const ctx = window.SillyTavern?.getContext?.();
        if (!ctx) return { ok: false, reason: 'missing-st-context' };
        const metadata = ctx.chatMetadata?.saga || {};
        const settings = ctx.extensionSettings?.saga || {};
        const localCreator = metadata.loredeckCreator || {};
        const settingsCreator = settings.loredeckCreatorProjects || {};
        const removed = {
            jobIds: [],
            generatedPackIds: [],
            packIds: [],
        };
        const generatedPackIds = new Set();
        const jobIds = new Set();
        const isSmokeJob = job => {
            const text = [
                job?.notes,
                job?.summary,
                job?.scope,
                job?.fandom,
                job?.generatedPackId,
                job?.brief?.packId,
            ].filter(Boolean).join('\n');
            return /Automated live Creator smoke|live-creator-/i.test(text)
                || (
                    /One Piece/i.test(String(job?.fandom || ''))
                    && /Arlong Park arc focused on Nami/i.test(String(job?.scope || ''))
                    && /one-piece-arlong-nami-compact/i.test(String(job?.generatedPackId || job?.brief?.packId || ''))
                );
        };
        const collectSmokeJobs = registry => {
            const jobs = registry?.jobs && typeof registry.jobs === 'object' && !Array.isArray(registry.jobs)
                ? registry.jobs
                : {};
            for (const [id, job] of Object.entries(jobs)) {
                if (!isSmokeJob(job)) continue;
                jobIds.add(id);
                const packId = String(job?.generatedPackId || job?.brief?.packId || '').trim();
                if (packId) generatedPackIds.add(packId);
            }
        };
        collectSmokeJobs(localCreator);
        collectSmokeJobs(settingsCreator);
        const scrubCreatorRegistry = registry => {
            if (!registry || typeof registry !== 'object' || Array.isArray(registry)) return false;
            let changed = false;
            if (registry.jobs && typeof registry.jobs === 'object' && !Array.isArray(registry.jobs)) {
                for (const id of jobIds) {
                    if (registry.jobs[id]) {
                        delete registry.jobs[id];
                        changed = true;
                    }
                }
            }
            if (jobIds.has(String(registry.activeJobId || ''))) {
                registry.activeJobId = '';
                changed = true;
            }
            if (jobIds.has(String(registry.lastJobId || ''))) {
                registry.lastJobId = '';
                changed = true;
            }
            return changed;
        };
        const scrubLibrary = library => {
            if (!library || typeof library !== 'object' || Array.isArray(library)) return false;
            let changed = false;
            const packs = library.packs && typeof library.packs === 'object' && !Array.isArray(library.packs)
                ? library.packs
                : {};
            const removePackIds = new Set();
            for (const [packId, pack] of Object.entries(packs)) {
                const id = String(pack?.packId || pack?.id || packId || '').trim();
                const sourceId = String(pack?.source?.originalPackId || pack?.derivedFrom?.packId || '').trim();
                const creatorJobId = String(pack?.derivedFrom?.creatorJobId || '').trim();
                if (generatedPackIds.has(id) || generatedPackIds.has(sourceId) || jobIds.has(creatorJobId)) {
                    removePackIds.add(packId);
                    if (id) removePackIds.add(id);
                }
            }
            for (const id of removePackIds) {
                if (packs[id]) {
                    delete packs[id];
                    changed = true;
                    removed.packIds.push(id);
                }
            }
            if (Array.isArray(library.activeStack)) {
                const before = library.activeStack.length;
                library.activeStack = library.activeStack.filter(item => {
                    const packId = String(item?.packId || item?.deckId || '').trim();
                    return !removePackIds.has(packId);
                });
                changed = changed || library.activeStack.length !== before;
            }
            if (Array.isArray(library.deckPlacements)) {
                const before = library.deckPlacements.length;
                library.deckPlacements = library.deckPlacements.filter(item => {
                    const packId = String(item?.packId || item?.deckId || '').trim();
                    return !removePackIds.has(packId);
                });
                changed = changed || library.deckPlacements.length !== before;
            }
            return changed;
        };
        const metadataChanged = scrubCreatorRegistry(metadata.loredeckCreator) || scrubLibrary(metadata.loredeckLibrary);
        const settingsChanged = scrubCreatorRegistry(settings.loredeckCreatorProjects) || scrubLibrary(settings.loredeckLibrary);
        removed.jobIds = [...jobIds];
        removed.generatedPackIds = [...generatedPackIds];
        removed.packIds = [...new Set(removed.packIds)];
        try {
            if (metadataChanged && typeof ctx.saveMetadata === 'function') await ctx.saveMetadata();
            if (settingsChanged && typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
        } catch (error) {
            return {
                ok: true,
                removed,
                metadataChanged,
                settingsChanged,
                saveError: error?.message || String(error),
            };
        }
        return {
            ok: true,
            removed,
            metadataChanged,
            settingsChanged,
        };
    }), { userGesture: true });
}

async function cancelLiveCreatorSmokeGenerationIfPresent(client) {
    const state = await collectLiveCreatorState(client).catch(() => null);
    const job = state?.job || {};
    const isSmokeJob = /Automated live Creator smoke|live-creator-/i.test([
        job.fandom,
        job.scope,
        job.generatedPackId,
        job.lastGenerationResult?.message,
        job.lastGenerationResult?.snippet,
    ].filter(Boolean).join('\n'))
        || (
            /One Piece/i.test(String(job.fandom || ''))
            && /Arlong Park arc focused on Nami/i.test(String(job.scope || ''))
            && /one-piece-arlong-nami-compact/i.test(String(job.generatedPackId || ''))
        );
    const hasCancel = state?.visible?.buttonLabels?.includes('Cancel Generation');
    if (!isSmokeJob || !hasCancel) {
        return {
            ok: true,
            cancelled: false,
            reason: !isSmokeJob ? 'not-smoke-job' : 'no-cancel-generation',
            jobId: job.jobId || '',
            activeGeneration: job.activeGeneration || null,
        };
    }
    const clicked = await clickButtonText(client, 'Cancel Generation', { root: '.saga-loredeck-creator-workbench-overlay' });
    if (!clicked) {
        return {
            ok: false,
            cancelled: false,
            reason: 'cancel-click-failed',
            jobId: job.jobId || '',
            activeGeneration: job.activeGeneration || null,
        };
    }
    await waitForLiveCreatorState(
        client,
        '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); return !state?.job?.activeGeneration && !state?.visible?.buttonLabels?.includes("Cancel Generation"); })()',
        'live Creator stale smoke generation cancelled',
        15000,
    ).catch(() => false);
    const after = await collectLiveCreatorState(client).catch(() => null);
    return {
        ok: !after?.job?.activeGeneration,
        cancelled: true,
        jobId: job.jobId || '',
        before: {
            activeGeneration: job.activeGeneration || null,
            currentStage: job.currentStage || '',
        },
        after: {
            activeGeneration: after?.job?.activeGeneration || null,
            currentStage: after?.job?.currentStage || '',
            buttonLabels: after?.visible?.buttonLabels?.slice(0, 80) || [],
        },
    };
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
    await waitFor(client, sagaActiveTabExpression('session'), 'Guide smoke Session tab active', 10000);
    const basicDetailsState = await openMobileSessionDetailsForGuide(client);
    if (basicDetailsState?.mobile && !basicDetailsState.opened) {
        findings.push(`Mobile Basic Session Details did not open for guide checks: ${basicDetailsState.reason || 'unknown'}.`);
    }

    const basicInitial = await evaluate(client, script(() => {
        const text = document.body?.innerText || '';
        const section = document.querySelector('[data-saga-tour="session.instructions.basic"]');
        if (section && !section.open) section.querySelector('summary')?.click();
        const buttonLabels = [...document.querySelectorAll('button')]
            .map(node => (node.innerText || node.textContent || '').trim())
            .filter(Boolean);
        return {
            smokeMode: window.__sagaSmokeMode || '',
            mobileShell: !!document.querySelector('#saga-lore-panel.saga-runtime-mobile'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || document.querySelector('#saga-lore-panel')?.dataset?.mobileActiveTab || '',
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
    if (!basicInitial.mobileShell && (basicInitial.railTabs.includes('injection') || basicInitial.railTabs.includes('continuity'))) findings.push('Basic rail exposed hidden Injection or Continuity tabs.');
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
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            highlightedTargets: document.querySelectorAll('.saga-tour-highlight').length,
            targetVisible: !!document.querySelector('[data-saga-tour="loredecks.library.launch"]'),
            mobileShell: !!document.querySelector('#saga-lore-panel.saga-runtime-mobile'),
            overlayOpen: !!overlay,
            headerTargetVisible: !!document.querySelector('[data-saga-tour="loredecks.library.header"]'),
            hasDone: [...(overlay?.querySelectorAll('button') || [])].some(button => (button.innerText || button.textContent || '').trim() === 'Done'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || document.querySelector('#saga-lore-panel')?.dataset?.mobileActiveTab || '',
        };
    }));
    const basicModuleLandedOnPreparedLibrary = basicModuleTour.mobileShell
        && basicModuleTour.title === 'Library Layout'
        && basicModuleTour.progress === '3 / 14';
    if (!basicModuleLandedOnPreparedLibrary && (!basicModuleTour.hasPopover || basicModuleTour.title !== 'Loredecks as Source Packs')) findings.push('Basic Loredecks module did not open on the expected first step.');
    if (!basicModuleLandedOnPreparedLibrary && basicModuleTour.progress !== '1 / 14') findings.push(`Basic Loredecks module progress was ${basicModuleTour.progress || 'missing'} instead of 1 / 14.`);
    if (!basicModuleTour.hasWhen || !basicModuleTour.hasExpected) findings.push('Basic Loredecks module popover did not include When to use and Expected result details.');
    if (!basicModuleLandedOnPreparedLibrary && (!basicModuleTour.targetVisible || basicModuleTour.activeTab !== 'loredecks')) findings.push('Basic Loredecks module did not navigate to the visible Library launch target.');
    screenshots.push(await screenshot(client, 'guide-harness-02-basic-module'));

    let basicPreparedLibrary = null;
    if (basicModuleLandedOnPreparedLibrary) {
        basicPreparedLibrary = {
            hasPopover: basicModuleTour.hasPopover,
            title: basicModuleTour.title,
            progress: basicModuleTour.progress,
            hasWhen: basicModuleTour.hasWhen,
            hasExpected: basicModuleTour.hasExpected,
            overlayOpen: basicModuleTour.overlayOpen,
            targetVisible: basicModuleTour.headerTargetVisible,
            hasDone: basicModuleTour.hasDone,
        };
    } else {
        await clickButtonText(client, 'Next', { root: '#saga-tour-popover' });
        await waitFor(client, 'document.querySelector("#saga-tour-popover .saga-tour-title")?.textContent?.trim() === "Open Loredeck Library"', 'Basic Loredecks module second step', 10000);
        await clickButtonText(client, 'Next', { root: '#saga-tour-popover' });
        await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay") && document.querySelector("#saga-tour-popover .saga-tour-title")?.textContent?.trim() === "Library Layout"', 'Basic prepared Library Layout step', 10000);
        await wait(600);
        basicPreparedLibrary = await evaluate(client, script(() => {
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
    }
    if (!basicPreparedLibrary.hasPopover || basicPreparedLibrary.title !== 'Library Layout') findings.push('Basic Loredecks prepared Library step did not open on the expected tour step.');
    if (basicPreparedLibrary.progress !== '3 / 14') findings.push(`Basic Loredecks prepared Library progress was ${basicPreparedLibrary.progress || 'missing'} instead of 3 / 14.`);
    if (!basicPreparedLibrary.hasWhen || !basicPreparedLibrary.hasExpected) findings.push('Basic Loredecks prepared Library popover did not include When to use and Expected result details.');
    if (!basicPreparedLibrary.overlayOpen || !basicPreparedLibrary.targetVisible || !basicPreparedLibrary.hasDone) findings.push('Basic Loredecks prepared Library step did not open the fullscreen Library with the expected header target.');
    screenshots.push(await screenshot(client, 'guide-harness-03-basic-prepared-library'));

    await clickButtonText(client, 'Close', { root: '#saga-tour-popover', enabledOnly: false });
    await waitFor(client, '!document.querySelector("#saga-tour-popover")', 'Basic Loredecks module close', 10000);
    await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false });
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-overlay")', 'Basic Library overlay close after prepared step', 10000);
    await clickRuntimeRoute(client, 'session');
    await waitFor(client, sagaActiveTabExpression('session'), 'Basic Session tab restored after module smoke', 10000);
    await wait(600);
    const basicReturnDetailsState = await openMobileSessionDetailsForGuide(client);
    if (basicReturnDetailsState?.mobile && !basicReturnDetailsState.opened) {
        findings.push(`Mobile Basic Session Details did not reopen for full walkthrough: ${basicReturnDetailsState.reason || 'unknown'}.`);
    }

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
    if (basicTour.progress !== '1 / 55') findings.push(`Basic walkthrough progress was ${basicTour.progress || 'missing'} instead of 1 / 55.`);
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
    await waitFor(client, sagaActiveTabExpression('session'), 'Advanced guide smoke Session tab active', 10000);
    await wait(1200);
    const advancedDetailsState = await openMobileSessionDetailsForGuide(client);
    if (advancedDetailsState?.mobile && !advancedDetailsState.opened) {
        findings.push(`Mobile Advanced Session Details did not open for guide checks: ${advancedDetailsState.reason || 'unknown'}.`);
    }

    const advancedInitial = await evaluate(client, script(() => {
        const text = document.body?.innerText || '';
        const section = document.querySelector('[data-saga-tour="session.instructions.advanced"]');
        if (section && !section.open) section.querySelector('summary')?.click();
        const buttonLabels = [...document.querySelectorAll('button')]
            .map(node => (node.innerText || node.textContent || '').trim())
            .filter(Boolean);
        return {
            smokeMode: window.__sagaSmokeMode || '',
            mobileShell: !!document.querySelector('#saga-lore-panel.saga-runtime-mobile'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || document.querySelector('#saga-lore-panel')?.dataset?.mobileActiveTab || '',
            hasAdvancedTitle: text.includes('Advanced Walkthrough'),
            hasAdvancedStart: buttonLabels.includes('Start Advanced Walkthrough'),
            moduleTitles: [...document.querySelectorAll('.saga-instructions-section-title')].map(node => node.textContent?.trim()).filter(Boolean),
            railTabs: [...document.querySelectorAll('.saga-runtime-rail-tab')].map(node => node.getAttribute('data-tab-id') || ''),
            hasSessionReadiness: text.includes('Session Readiness') && (text.includes('Start Guided Tour') || text.includes('Start Walkthrough')),
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
    if (!advancedInitial.mobileShell && (!advancedInitial.railTabs.includes('injection') || !advancedInitial.railTabs.includes('continuity'))) findings.push('Advanced rail did not expose Injection and Continuity tabs.');
    if (advancedInitial.mobileShell) {
        if (!advancedInitial.hasSessionReadiness) findings.push('Advanced mobile Session surface did not show the summary readiness path.');
    } else if (!advancedInitial.hasAdvancedControls) findings.push('Advanced Session surface did not show expected runtime controls.');
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
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || document.querySelector('#saga-lore-panel')?.dataset?.mobileActiveTab || '',
        };
    }));
    if (!advancedModuleTour.hasPopover || advancedModuleTour.title !== 'Injection Overview') findings.push('Advanced Injection Diagnostics module did not open on the expected first step.');
    if (advancedModuleTour.progress !== '1 / 15') findings.push(`Advanced Injection Diagnostics module progress was ${advancedModuleTour.progress || 'missing'} instead of 1 / 15.`);
    if (!advancedModuleTour.hasWhen || !advancedModuleTour.hasExpected) findings.push('Advanced Injection Diagnostics module popover did not include When to use and Expected result details.');
    if (!advancedModuleTour.targetVisible || advancedModuleTour.activeTab !== 'injection') findings.push('Advanced Injection Diagnostics module did not navigate to the visible Injection target.');
    screenshots.push(await screenshot(client, 'guide-harness-06-advanced-module'));
    await clickButtonText(client, 'Close', { root: '#saga-tour-popover', enabledOnly: false });
    await waitFor(client, '!document.querySelector("#saga-tour-popover")', 'Advanced Injection module close', 10000);
    await clickRuntimeRoute(client, 'session');
    await waitFor(client, sagaActiveTabExpression('session'), 'Advanced Session tab restored after module smoke', 10000);
    await wait(600);
    const advancedModuleReturnDetailsState = await openMobileSessionDetailsForGuide(client);
    if (advancedModuleReturnDetailsState?.mobile && !advancedModuleReturnDetailsState.opened) {
        findings.push(`Mobile Advanced Session Details did not reopen for Creator module: ${advancedModuleReturnDetailsState.reason || 'unknown'}.`);
    }

    const advancedCreatorStarted = await clickButtonInRow(client, '', '.saga-instructions-section-card', 'Creator And Generated Lorepack Authoring', 'Start');
    if (!advancedCreatorStarted) findings.push('Advanced Creator module Start button was not clickable.');
    await waitFor(client, '!!document.querySelector("#saga-tour-popover")', 'Advanced Creator module popover', 10000);
    const reachedCreatorFallback = await clickTourNextUntilTitle(client, 'Creator Draft Review', 14);
    if (!reachedCreatorFallback) findings.push('Advanced Creator module did not reach the no-project Creator Draft Review step.');
    await wait(700);
    const advancedCreatorFallback = await evaluate(client, script(() => {
        const popover = document.querySelector('#saga-tour-popover');
        const text = popover?.innerText || '';
        const creator = document.querySelector('.saga-loredeck-creator-workbench-overlay');
        const creatorText = creator?.innerText || '';
        const combinedText = `${text}\n${creatorText}`;
        return {
            hasPopover: !!popover,
            title: popover?.querySelector('.saga-tour-title')?.textContent?.trim() || '',
            progress: popover?.querySelector('.saga-tour-progress')?.textContent?.trim() || '',
            hasPreparation: text.includes('Preparation:'),
            hasNoProjectMessage: text.includes('Loredeck Creator is open, but there is no in-progress Creator project to resume yet.'),
            hasCreatorProjectState: combinedText.includes('Generated Loredeck draft') || combinedText.includes('Resumable job') || combinedText.includes('Scope Brief') || combinedText.includes('Review Queue'),
            hasWhen: text.includes('When to use:'),
            hasExpected: text.includes('Expected result:'),
            creatorOpen: !!creator,
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || document.querySelector('#saga-lore-panel')?.dataset?.mobileActiveTab || '',
        };
    }));
    if (!advancedCreatorFallback.hasPopover || advancedCreatorFallback.title !== 'Creator Draft Review') findings.push('Advanced Creator fallback did not land on the expected tour step.');
    if (advancedCreatorFallback.progress !== '11 / 19') findings.push(`Advanced Creator fallback progress was ${advancedCreatorFallback.progress || 'missing'} instead of 11 / 19.`);
    if (!advancedCreatorFallback.hasNoProjectMessage && !advancedCreatorFallback.hasCreatorProjectState) findings.push('Advanced Creator step did not show a missing-project message or a resumable Creator project state.');
    if (!advancedCreatorFallback.hasWhen || !advancedCreatorFallback.hasExpected) findings.push('Advanced Creator fallback popover did not include When to use and Expected result details.');
    if (!advancedCreatorFallback.creatorOpen || advancedCreatorFallback.activeTab !== 'loredecks') findings.push('Advanced Creator fallback did not keep the Creator workbench open on the Loredecks tab.');
    screenshots.push(await screenshot(client, 'guide-harness-07-advanced-creator-empty-project'));
    await clickButtonText(client, 'Close', { root: '#saga-tour-popover', enabledOnly: false });
    await waitFor(client, '!document.querySelector("#saga-tour-popover")', 'Advanced Creator fallback close', 10000);
    await clickButtonText(client, 'Close', { root: '.saga-loredeck-creator-workbench-overlay', enabledOnly: false });
    await waitFor(client, '!document.querySelector(".saga-loredeck-creator-workbench-overlay")', 'Advanced Creator workbench close after fallback smoke', 10000);
    await clickRuntimeRoute(client, 'session');
    await waitFor(client, sagaActiveTabExpression('session'), 'Advanced Session tab restored after Creator fallback smoke', 10000);
    await wait(600);
    const advancedReturnDetailsState = await openMobileSessionDetailsForGuide(client);
    if (advancedReturnDetailsState?.mobile && !advancedReturnDetailsState.opened) {
        findings.push(`Mobile Advanced Session Details did not reopen for full walkthrough: ${advancedReturnDetailsState.reason || 'unknown'}.`);
    }

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
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || document.querySelector('#saga-lore-panel')?.dataset?.mobileActiveTab || '',
        };
    }));
    const advancedTourLandedOnPreparedLibrary = advancedTour.title === 'Empty Selection State' && advancedTour.progress === '3 / 165';
    if (!advancedTourLandedOnPreparedLibrary && (!advancedTour.hasPopover || advancedTour.title !== 'Library Overview')) findings.push('Advanced walkthrough did not open on the expected first tour step.');
    if (!advancedTourLandedOnPreparedLibrary && advancedTour.progress !== '1 / 165') findings.push(`Advanced walkthrough progress was ${advancedTour.progress || 'missing'} instead of 1 / 165.`);
    if (!advancedTour.hasWhen || !advancedTour.hasExpected) findings.push('Advanced walkthrough popover did not include When to use and Expected result details.');
    if (!advancedTourLandedOnPreparedLibrary && (!advancedTour.targetVisible || advancedTour.activeTab !== 'loredecks')) findings.push('Advanced walkthrough did not navigate to the visible Loredeck Library launch target.');
    screenshots.push(await screenshot(client, 'guide-harness-08-advanced-tour'));

    const errors = client.events
        .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
        .map(event => formatLogEntry(event.params.entry))
        .filter(error => !isExpectedLiveCreator404(error))
        .filter(error => !isExpectedRepoLocalHarnessStorageError(error));
    const report = {
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
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
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
        .map(event => formatLogEntry(event.params.entry))
        .filter(error => !isExpectedRepoLocalHarnessStorageError(error));
    const report = {
        ok: findings.length === 0 && errors.length === 0,
        target: SMOKE_TARGET,
        url: smokeUrl,
        screenshots,
        findings,
        errors,
        dialogEvents,
        resetState,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
}

async function runMobileAdvancedHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents) {
    await waitFor(client, 'window.__sagaSmokeReady === true && window.__sagaSmokeMode === "advanced"', 'Mobile Advanced smoke ready marker', 20000);
    await waitFor(client, sagaActiveTabExpression('loredecks'), 'Mobile Advanced Loredecks route active', 10000);
    await wait(800);

    const initialState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const text = document.body?.innerText || '';
        const primaryActions = [...document.querySelectorAll('.saga-loredecks-mobile-primary-actions button')].map(node => (node.innerText || node.textContent || '').trim()).filter(Boolean);
        const secondaryActions = [...document.querySelectorAll('.saga-loredecks-mobile-secondary-actions button')].map(node => (node.innerText || node.textContent || '').trim()).filter(Boolean);
        const stackDetailsHeaders = [...document.querySelectorAll('.saga-operator-summary-header-tappable, [data-saga-tour="loredecks.operator.details"]')]
            .map(node => ({
                ariaLabel: node.getAttribute('aria-label') || '',
                tour: node.getAttribute('data-saga-tour') || '',
                className: node.className || '',
                text: (node.innerText || node.textContent || '').trim().slice(0, 160),
            }));
        return {
            mobileShell: !!root?.classList?.contains('saga-runtime-mobile'),
            activeTab: root?.dataset?.mobileActiveTab || document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || '',
            bottomRoutes: [...document.querySelectorAll('.saga-mobile-bottom-tab')].map(node => node.getAttribute('data-mobile-route') || ''),
            activeBottomLabel: document.querySelector('.saga-mobile-bottom-tab-active .saga-mobile-bottom-label')?.textContent?.trim() || '',
            activeBottomHasExitIcon: !!document.querySelector('.saga-mobile-bottom-tab-active .saga-mobile-bottom-exit-icon .saga-mobile-shell-action-symbol-close'),
            hasActiveStack: text.includes('Active Stack'),
            hasOpenLibrary: text.includes('Open Loredeck Library'),
            hasCreateDeck: text.includes('Create Deck'),
            hasStackDetailsHeader: stackDetailsHeaders.some(item => item.ariaLabel === 'Open Stack Details'
                || item.tour === 'loredecks.operator.details'
                || item.text.includes('Active Stack')),
            stackDetailsHeaders,
            noHorizontalOverflow: !root || root.scrollWidth <= root.clientWidth + 1,
            primaryActions,
            secondaryActions,
        };
    }));
    if (!initialState.mobileShell) findings.push('Mobile Advanced harness did not render the mobile shell at 430px.');
    if (initialState.activeTab !== 'loredecks') findings.push('Mobile Advanced harness did not start on Loredecks.');
    if (initialState.activeBottomLabel !== 'Exit' || !initialState.activeBottomHasExitIcon) findings.push('Mobile Advanced active Loredecks bottom tab did not morph into the Exit control.');
    for (const route of ['loredecks', 'session', 'continuity', 'context', 'lore', 'injection', 'settings']) {
        if (!initialState.bottomRoutes.includes(route)) findings.push(`Mobile Advanced bottom bar missing route: ${route}.`);
    }
    if (!initialState.hasActiveStack || !initialState.hasOpenLibrary || !initialState.hasCreateDeck) findings.push('Mobile Advanced Loredecks root did not render stack, Library, and Creator actions.');
    if (!initialState.hasStackDetailsHeader) findings.push('Mobile Advanced Loredecks root did not expose Stack Details through the tappable summary header.');
    if (initialState.primaryActions.length !== 1) findings.push('Mobile Advanced Loredecks root did not render exactly one dominant primary action.');
    if (!initialState.primaryActions.includes('Open Loredeck Library')) findings.push('Mobile Advanced Loredecks dominant action did not expose Open Loredeck Library.');
    if ([...initialState.primaryActions, ...initialState.secondaryActions].some(label => /^Next:/.test(label))) findings.push('Mobile Advanced Loredecks root exposed checklist-style Next actions.');
    if (initialState.primaryActions.includes('Open Loredeck Library') && initialState.secondaryActions.includes('Open Loredeck Library')) findings.push('Mobile Advanced Loredecks duplicated the Open Loredeck Library action.');
    if (initialState.secondaryActions.length < 2) findings.push('Mobile Advanced Loredecks secondary actions were not available after primary-action reduction.');
    if (!initialState.noHorizontalOverflow) findings.push('Mobile Advanced Loredecks root has horizontal overflow.');
    const loredecksRootScrollAudit = await getMobileNestedScrollAuditState(client, {
        label: 'Loredecks route',
        scopeSelector: '#saga-lore-panel.saga-runtime-mobile',
        allowedSelectors: ['.saga-runtime-tab-body'],
    });
    addMobileNestedScrollFindings(findings, loredecksRootScrollAudit);
    const loredecksFontAudit = await getMobileFontAuditState(client, {
        label: 'Mobile Advanced Loredecks route',
        scopeSelector: '#saga-lore-panel.saga-runtime-mobile',
    });
    addMobileFontFindings(findings, loredecksFontAudit);
    screenshots.push(await screenshot(client, 'mobile-advanced-harness-01-loredecks-root'));

    await clickRuntimeRoute(client, 'session');
    await waitFor(client, sagaActiveTabExpression('session'), 'Mobile Advanced Session route active', 10000);
    await wait(400);
    const sessionRootState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const text = document.body?.innerText || '';
        return {
            activeTab: root?.dataset?.mobileActiveTab || '',
            activeBottomLabel: document.querySelector('.saga-mobile-bottom-tab-active .saga-mobile-bottom-label')?.textContent?.trim() || '',
            hasSessionReadiness: text.includes('Session Readiness'),
            hasPendingReview: text.includes('Pending Review'),
            hasAcceptedLorecards: text.includes('Accepted Lorecards'),
            hasHighRelevance: text.includes('High relevance'),
            hasSelectedForInjection: text.includes('Selected for injection'),
            hasInjectionEstimate: text.includes('Injection estimate'),
        };
    }));
    if (sessionRootState.activeTab !== 'session') findings.push('Mobile Advanced Session route did not become active.');
    if (sessionRootState.activeBottomLabel !== 'Exit') findings.push('Mobile Advanced active Session bottom tab did not morph into Exit.');
    if (!sessionRootState.hasSessionReadiness || !sessionRootState.hasPendingReview || !sessionRootState.hasAcceptedLorecards || !sessionRootState.hasHighRelevance || !sessionRootState.hasSelectedForInjection || !sessionRootState.hasInjectionEstimate) {
        findings.push('Mobile Advanced Session root did not render the useful session metrics.');
    }
    const sessionRootScrollAudit = await getMobileNestedScrollAuditState(client, {
        label: 'Session route',
        scopeSelector: '#saga-lore-panel.saga-runtime-mobile',
        allowedSelectors: ['.saga-runtime-tab-body'],
    });
    addMobileNestedScrollFindings(findings, sessionRootScrollAudit);

    await clickRuntimeRoute(client, 'injection');
    await waitFor(client, sagaActiveTabExpression('injection'), 'Mobile Advanced Injection route active', 10000);
    await waitFor(client, '!!document.querySelector("[data-saga-tour=\\"injection.toggles\\"]")', 'Mobile Advanced Injection toggles', 10000);
    await wait(500);
    const injectionState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const text = document.body?.innerText || '';
        return {
            activeTab: root?.dataset?.mobileActiveTab || '',
            overflowSheetClosed: !document.querySelector('.saga-mobile-more-sheet'),
            hasInjection: text.includes('Injection'),
            hasToggles: text.includes('Inject Continuity') && text.includes('Inject Lore'),
            targetVisible: !!document.querySelector('[data-saga-tour="injection.toggles"]'),
        };
    }));
    if (injectionState.activeTab !== 'injection') findings.push('Mobile Advanced Injection route did not update active tab state.');
    if (!injectionState.overflowSheetClosed) findings.push('Mobile Advanced rendered a removed overflow sheet after selecting Injection.');
    if (!injectionState.hasInjection || !injectionState.hasToggles || !injectionState.targetVisible) findings.push('Mobile Advanced Injection route did not render the expected toggles.');
    const injectionScrollAudit = await getMobileNestedScrollAuditState(client, {
        label: 'Injection route',
        scopeSelector: '#saga-lore-panel.saga-runtime-mobile',
        allowedSelectors: ['.saga-runtime-tab-body'],
    });
    addMobileNestedScrollFindings(findings, injectionScrollAudit);
    screenshots.push(await screenshot(client, 'mobile-advanced-harness-02-injection-route'));

    await clickRuntimeRoute(client, 'settings');
    await waitFor(client, sagaActiveTabExpression('settings'), 'Mobile Advanced Settings route active', 10000);
    await wait(500);
    const settingsState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const text = document.body?.innerText || '';
        return {
            activeTab: root?.dataset?.mobileActiveTab || '',
            hasSettings: text.includes('Settings'),
            hasExperienceMode: text.includes('Experience Mode'),
            hasProviders: text.includes('Provider') || text.includes('Providers'),
            overflowSheetClosed: !document.querySelector('.saga-mobile-more-sheet'),
        };
    }));
    if (settingsState.activeTab !== 'settings') findings.push('Mobile Advanced Settings route did not update active tab state.');
    if (!settingsState.hasSettings || !settingsState.hasExperienceMode || !settingsState.hasProviders || !settingsState.overflowSheetClosed) findings.push('Mobile Advanced Settings route did not render expected settings/provider content.');
    const settingsScrollAudit = await getMobileNestedScrollAuditState(client, {
        label: 'Settings route',
        scopeSelector: '#saga-lore-panel.saga-runtime-mobile',
        allowedSelectors: ['.saga-runtime-tab-body'],
    });
    addMobileNestedScrollFindings(findings, settingsScrollAudit);

    await clickRuntimeRoute(client, 'continuity');
    await waitFor(client, sagaActiveTabExpression('continuity'), 'Mobile Advanced Continuity route active', 10000);
    await wait(500);
    const continuityState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const text = document.body?.innerText || '';
        return {
            activeTab: root?.dataset?.mobileActiveTab || '',
            hasContinuity: text.includes('Continuity'),
            hasScanOrState: text.includes('Scan') || text.includes('State') || text.includes('Timeline'),
            overflowSheetClosed: !document.querySelector('.saga-mobile-more-sheet'),
        };
    }));
    if (continuityState.activeTab !== 'continuity') findings.push('Mobile Advanced Continuity route did not update active tab state.');
    if (!continuityState.hasContinuity || !continuityState.hasScanOrState || !continuityState.overflowSheetClosed) findings.push('Mobile Advanced Continuity route did not render expected continuity content.');
    const continuityScrollAudit = await getMobileNestedScrollAuditState(client, {
        label: 'Continuity route',
        scopeSelector: '#saga-lore-panel.saga-runtime-mobile',
        allowedSelectors: ['.saga-runtime-tab-body'],
    });
    addMobileNestedScrollFindings(findings, continuityScrollAudit);

    await clickRuntimeRoute(client, 'lore');
    await waitFor(client, sagaMobileRouteExpression('lore'), 'Mobile Advanced Lorecards mobile route active', 10000);
    await waitFor(client, sagaActiveTabExpression('lore'), 'Mobile Advanced Lorecards route active', 10000);
    await waitFor(client, '!!document.querySelector(".saga-mobile-lorecards-subtabs")', 'Mobile Advanced Lorecards secondary sub-tabs', 10000);
    const loreClicked = await clickSelector(client, '.saga-mobile-lorecards-subtab[data-stage="lore"]').catch(() => false);
    if (!loreClicked) findings.push('Mobile Advanced Lore sub-tab was not clickable.');
    await waitFor(client, 'document.querySelector(".saga-lorecards-lifecycle-tab")?.dataset?.sagaLoreLifecycleStage === "lore"', 'Mobile Advanced Lore page active', 10000);
    await waitFor(client, '!document.querySelector(".saga-mobile-lorecards-loading-shell") && !!document.querySelector(".saga-lorecard-workspace-list")', 'Mobile Advanced Lore deferred content', 10000);
    await wait(500);
    const activeSetState = await evaluate(client, script(() => {
        const text = document.body?.innerText || '';
        const rows = [...document.querySelectorAll('.saga-lorecard-workspace-row')];
        const activeItems = rows.filter(row => row.classList.contains('saga-lore-entry-active'));
        const acceptedItems = rows.filter(row => row.dataset.lorecardWorkspaceStatus === 'accepted');
        const pendingItems = rows.filter(row => row.dataset.lorecardWorkspaceStatus === 'pending');
        const labels = [...document.querySelectorAll('.saga-lorecard-workspace-row .saga-lore-entry-actions button')].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        const bottomBarTop = document.querySelector('.saga-mobile-bottom-bar')?.getBoundingClientRect?.().top || window.innerHeight;
        const firstObject = activeItems[0] || acceptedItems[0] || pendingItems[0] || null;
        const firstObjectRect = firstObject?.getBoundingClientRect?.();
        return {
            hasWorkspace: !!document.querySelector('.saga-lorecard-workspace'),
            hasLoreHeading: text.includes('Lore'),
            hasSubtabs: !!document.querySelector('.saga-mobile-lorecards-subtabs'),
            activeSubtab: document.querySelector('.saga-mobile-lorecards-subtab[aria-selected="true"]')?.getAttribute('data-stage') || '',
            hasPipelineCard: !!document.querySelector('.saga-lorecard-pipeline'),
            firstObjectVisibleAboveBottomBar: !!firstObjectRect && firstObjectRect.top < bottomBarTop - 8,
            activeItems: activeItems.length,
            acceptedItems: acceptedItems.length,
            pendingItems: pendingItems.length,
            labels,
            activeText: activeItems.map(item => item.innerText || '').join('\n'),
            acceptedText: acceptedItems.map(item => item.innerText || '').join('\n'),
        };
    }));
    if (!activeSetState.hasWorkspace || activeSetState.acceptedItems < 1) findings.push('Mobile Advanced Lore workspace did not render Accepted Lorecards.');
    if (activeSetState.activeItems < 1) findings.push('Mobile Advanced Lore workspace did not render active Lorecards with active state.');
    if (!activeSetState.hasSubtabs || activeSetState.activeSubtab !== 'lore' || activeSetState.hasPipelineCard) findings.push('Mobile Advanced Lore page did not use the secondary sub-tab bar or still rendered the mobile pipeline card.');
    if (!activeSetState.firstObjectVisibleAboveBottomBar) findings.push('Mobile Advanced Lore workspace did not show a Lorecard object in the first viewport.');
    for (const label of ['Inspect', 'Pin', 'Mute', 'Activate']) {
        if (activeSetState.labels.includes(label)) findings.push(`Mobile Advanced Lore workspace still exposed permanent action button: ${label}.`);
    }
    screenshots.push(await screenshot(client, 'mobile-advanced-harness-04-lore-workspace'));

    const activeSetInspectOpened = await evaluate(client, script(() => {
        const item = document.querySelector('.saga-lorecard-workspace-row[data-lorecard-workspace-status="accepted"]');
        if (!item) return false;
        item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
        return true;
    }), { userGesture: true }).catch(() => false);
    if (!activeSetInspectOpened) findings.push('Mobile Advanced Lore workspace item did not accept tap-hold/context-menu inspection.');
    await waitFor(client, '!!document.querySelector(".saga-mobile-lorecard-editor-shell")', 'Mobile Advanced Lore workspace full-window Lorecard editor', 10000).catch(error => findings.push(error.message));
    const editorState = await evaluate(client, script(() => {
        const overlay = document.querySelector('#saga-mobile-lorecard-editor');
        const footer = overlay?.querySelector('.saga-mobile-lorecard-editor-footer');
        const header = overlay?.querySelector('.saga-mobile-lorecard-editor-header');
        const footerLabels = [...footer?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        const tagStack = overlay?.querySelector('.saga-mobile-lorecard-tags-chip-stack');
        const tagChips = [...tagStack?.querySelectorAll('.saga-mobile-lorecard-tags-chip') || []];
        return {
            open: !!overlay,
            hasFooter: !!footer,
            footerLabels,
            headerCloseButtons: [...header?.querySelectorAll('button') || []].filter(button => /close/i.test((button.innerText || button.textContent || '').trim())).length,
            hasTagStack: !!tagStack,
            tagChipCount: tagChips.length,
            tagRemoveCount: tagChips.filter(chip => !!chip.querySelector('.saga-mobile-lorecard-tags-remove')).length,
            hasTagAddRow: !!overlay?.querySelector('.saga-mobile-lorecard-tags-add-row .saga-mobile-lorecard-tags-input'),
            hasCommaTagsField: [...overlay?.querySelectorAll('.saga-lore-editor-field') || []].some(field => {
                const label = field.querySelector('span')?.textContent?.trim();
                return label === 'Tags' && !!field.querySelector('input.saga-lore-editor-input:not(.saga-mobile-lorecard-tags-input)');
            }),
        };
    }));
    if (!editorState.open || !editorState.hasFooter || !editorState.footerLabels.includes('Save Entry') || !editorState.footerLabels.includes('Close')) findings.push('Mobile Advanced Lorecard editor did not put Save Entry and Close in the bottom footer.');
    if (editorState.headerCloseButtons > 0) findings.push('Mobile Advanced Lorecard editor still rendered Close in the header.');
    if (!editorState.hasTagStack || !editorState.hasTagAddRow || editorState.tagChipCount < 1 || editorState.tagRemoveCount !== editorState.tagChipCount || editorState.hasCommaTagsField) findings.push('Mobile Advanced Lorecard editor did not render mobile tag chips with remove controls and add row.');
    addMobileFontFindings(findings, await getMobileFontAuditState(client, {
        label: 'Mobile Advanced Lorecard Editor',
        scopeSelector: '#saga-mobile-lorecard-editor',
    }));
    await evaluate(client, script(() => {
        document.querySelector('#saga-mobile-lorecard-editor')?.remove();
        return true;
    }));

    await clickRuntimeRoute(client, 'loredecks');
    await waitFor(client, sagaActiveTabExpression('loredecks'), 'Mobile Advanced Loredecks restored before Library', 10000);
    await wait(500);
    const libraryClick = await clickVisibleButtonText(client, 'Open Loredeck Library', { root: '#saga-lore-panel', includes: true });
    let libraryOpened = false;
    if (libraryClick?.clicked) {
        libraryOpened = await waitFor(
            client,
            '!!document.querySelector(".saga-loredeck-library-overlay")',
            'Mobile Advanced Library overlay after visible click',
            6000,
        ).then(() => true).catch(() => false);
    }
    if (!libraryOpened) {
        if (!libraryClick?.clicked) findings.push(`Mobile Advanced Open Loredeck Library action was not clickable (${libraryClick?.reason || 'unknown'}).`);
        else findings.push('Mobile Advanced Open Loredeck Library visible click did not open the overlay.');
        await evaluate(client, script(async () => {
            const library = await import('/src/loredecks/loredeck-library-panel.js');
            library.openLoredeckLibraryWindow();
            return true;
        }), { userGesture: true, timeoutMs: 20000 });
        await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay")', 'Mobile Advanced Library overlay fallback', 10000);
    }
    await wait(700);
    const librarySelection = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        if (!overlay) return { selected: false, mode: 'missing-library' };
        const card = overlay.querySelector('.saga-loredeck-library-deck-mobile-touch[data-pack-id="smoke-arlong-park"]');
        if (!card) {
            return {
                selected: false,
                mode: 'target-not-visible',
                visiblePackIds: [...overlay.querySelectorAll('.saga-loredeck-library-deck-mobile-touch[data-pack-id]')]
                    .map(element => element.getAttribute?.('data-pack-id') || '')
                    .filter(Boolean)
                    .slice(0, 80),
                text: (overlay.innerText || overlay.textContent || '').slice(0, 800),
            };
        }
        card.scrollIntoView({ block: 'center', inline: 'center' });
        card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
        return {
            selected: true,
            mode: 'mobile-detail-sheet',
            packId: card.getAttribute?.('data-pack-id') || 'smoke-arlong-park',
            text: (card.innerText || card.textContent || '').slice(0, 400),
        };
    }), { userGesture: true });
    if (!librarySelection.selected) findings.push(`Mobile Advanced Library could not open the seeded Loredeck detail sheet (${librarySelection.mode || 'unknown'}).`);
    await waitFor(client, '!!document.querySelector(".saga-loredeck-library-mobile-detail-sheet")', 'Mobile Advanced Library detail sheet', 10000).catch(error => findings.push(error.message));
    await wait(700);
    await clickButtonText(client, 'Overview', { root: '.saga-loredeck-library-mobile-detail-sheet', enabledOnly: false }).catch(() => false);
    await wait(300);
    const libraryOverviewState = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const sheet = overlay?.querySelector('.saga-loredeck-library-mobile-detail-sheet');
        const details = sheet?.querySelector('.saga-loredeck-library-details');
        const overlayLabels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        const detailLabels = [...details?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        const text = details?.innerText || '';
        return {
            open: !!overlay,
            sheetOpen: !!sheet,
            hasPackTitle: text.includes('Smoke Test: Arlong Park'),
            hasObjectActions: detailLabels.includes('Open Loredeck')
                && detailLabels.includes('Open Pack Health Center')
                && (detailLabels.includes('Edit Metadata') || detailLabels.includes('View Metadata'))
                && detailLabels.includes('Export'),
            hasClose: overlayLabels.includes('Close'),
            hasDone: overlayLabels.includes('Done'),
            hasDetailPanel: !!sheet?.querySelector('.saga-loredeck-library-mobile-detail-panel'),
            detailLabels,
            overlayLabels,
        };
    }));
    const healthTabClicked = await clickButtonText(client, 'Health', { root: '.saga-loredeck-library-mobile-detail-sheet', enabledOnly: false });
    if (!healthTabClicked) findings.push('Mobile Advanced Library Health detail tab was not clickable.');
    await wait(400);
    await evaluate(client, script(() => {
        const sheet = document.querySelector('.saga-loredeck-library-mobile-detail-sheet');
        const details = sheet?.querySelector('.saga-loredeck-library-details');
        if (sheet && details) {
            details.scrollIntoView({ block: 'start', inline: 'nearest' });
        } else {
            details?.scrollIntoView({ block: 'start', inline: 'nearest' });
        }
        return !!details;
    }), { userGesture: true }).catch(() => false);
    await wait(250);
    const libraryState = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const sheet = overlay?.querySelector('.saga-loredeck-library-mobile-detail-sheet');
        const details = sheet?.querySelector('.saga-loredeck-library-details');
        const text = details?.innerText || '';
        const detailLabels = [...details?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        const overlayLabels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        return {
            open: !!overlay,
            sheetOpen: !!sheet,
            hasPackTitle: text.includes('Smoke Test: Arlong Park'),
            hasHealthTab: text.includes('Status') && text.includes('Last Scan'),
            hasHealthActions: detailLabels.includes('Open Pack Health Center') && detailLabels.includes('Run Pack Health'),
            hasClose: overlayLabels.includes('Close'),
            hasDone: overlayLabels.includes('Done'),
            detailLabels,
            overlayLabels,
        };
    }));
    if (!libraryState.open || !libraryState.sheetOpen || !libraryState.hasPackTitle) findings.push('Mobile Advanced Library did not render selected Loredeck detail sheet.');
    if (!libraryOverviewState.sheetOpen || !libraryOverviewState.hasObjectActions || !libraryOverviewState.hasDetailPanel) findings.push('Mobile Advanced Library detail sheet did not render selected object actions.');
    if (!libraryState.hasHealthTab || !libraryState.hasHealthActions) findings.push('Mobile Advanced Library did not render Health detail actions.');
    if (!libraryState.hasClose || !libraryState.hasDone) findings.push('Mobile Advanced Library did not expose Close and Done actions.');
    screenshots.push(await screenshot(client, 'mobile-advanced-harness-05-library-actions'));

    const healthClicked = await clickButtonText(client, 'Open Pack Health Center', { root: '.saga-loredeck-library-mobile-detail-sheet' })
        || await clickButtonText(client, 'Open Pack Health Center', { root: '.saga-loredeck-library-overlay' });
    if (!healthClicked) findings.push('Mobile Advanced Open Pack Health Center action was not clickable.');
    let healthState = { open: false, hasTitle: false, hasPack: false, hasTabsOrActions: false, hasClose: false };
    if (healthClicked) {
        await waitFor(client, '!!document.querySelector(".saga-loredeck-health-center-overlay")', 'Mobile Advanced Pack Health overlay', 10000);
        await wait(700);
        healthState = await evaluate(client, script(() => {
            const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
            const text = overlay?.innerText || '';
            const labels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            const headerActionLabels = [...overlay?.querySelectorAll('.saga-loredeck-health-center-header .saga-loredeck-health-center-actions button') || []]
                .map(button => (button.innerText || button.textContent || '').trim())
                .filter(Boolean);
            const bottomActionLabels = [...overlay?.querySelectorAll('.saga-loredeck-health-center-bottom-actions button') || []]
                .map(button => (button.innerText || button.textContent || '').trim())
                .filter(Boolean);
            return {
                open: !!overlay,
                hasTitle: text.includes('Pack Health Center'),
                hasPack: text.includes('Smoke Test: Arlong Park') || text.includes('Harry Potter'),
                hasTabsOrActions: text.includes('Summary') || text.includes('Issues') || labels.includes('Refresh Scan') || labels.includes('Run Scan'),
                hasClose: labels.includes('Close'),
                headerActionLabels,
                bottomActionLabels,
            };
        }));
        if (!healthState.open || !healthState.hasTitle || !healthState.hasPack || !healthState.hasTabsOrActions) findings.push('Mobile Advanced Pack Health Center did not render expected mobile content.');
        if (!healthState.hasClose) findings.push('Mobile Advanced Pack Health Center did not expose Close.');
        if (healthState.headerActionLabels.length) findings.push(`Mobile Advanced Pack Health Center still rendered persistent header actions: ${healthState.headerActionLabels.join(', ')}.`);
        for (const label of ['Refresh Scan', 'Export Report', 'Close']) {
            if (!healthState.bottomActionLabels.includes(label)) findings.push(`Mobile Advanced Pack Health Center bottom action bar missing: ${label}.`);
        }
        const healthScrollAudit = await getMobileNestedScrollAuditState(client, {
            label: 'Pack Health Center',
            scopeSelector: '.saga-loredeck-health-center-overlay',
            allowedSelectors: ['.saga-loredeck-health-center-content'],
        });
        addMobileNestedScrollFindings(findings, healthScrollAudit);
        addMobileFontFindings(findings, await getMobileFontAuditState(client, {
            label: 'Mobile Advanced Pack Health Center',
            scopeSelector: '.saga-loredeck-health-center-overlay',
        }));
        screenshots.push(await screenshot(client, 'mobile-advanced-harness-06-pack-health'));
        await clickButtonText(client, 'Close', { root: '.saga-loredeck-health-center-overlay', enabledOnly: false }).catch(() => false);
        await wait(400);
    }
    await clickButtonText(client, 'Close', { root: '.saga-loredeck-library-mobile-detail-sheet', enabledOnly: false }).catch(() => false);
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-mobile-detail-backdrop")', 'Mobile Advanced Library detail sheet closed', 10000).catch(error => findings.push(error.message));
    await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false }).catch(() => false);
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-overlay")', 'Mobile Advanced Library overlay closed before Creator', 10000).catch(error => findings.push(error.message));

    const creatorClicked = await clickButtonText(client, 'Create Deck', { root: '.saga-loredeck-library-overlay' })
        || await clickButtonText(client, 'Create Deck');
    if (!creatorClicked) findings.push('Mobile Advanced Create Deck action was not clickable.');
    let creatorState = {
        open: false,
        hasTitle: false,
        hasReviewQueue: false,
        hasCurrentTask: false,
        hasClose: false,
        currentTaskBeforeStageGuide: false,
        currentTaskVisibleEarly: false,
        stageRailHorizontal: false,
        labels: [],
    };
    if (creatorClicked) {
        await waitFor(client, '!!document.querySelector(".saga-loredeck-creator-workbench-overlay")', 'Mobile Advanced Creator overlay', 10000);
        await wait(800);
        creatorState = await evaluate(client, script(() => {
            const overlay = document.querySelector('.saga-loredeck-creator-workbench-overlay');
            const body = overlay?.querySelector('.saga-loredeck-creator-workbench-body');
            const currentTask = overlay?.querySelector('.saga-loredeck-creator-current-task');
            const stageGuide = overlay?.querySelector('.saga-loredeck-creator-stage-guide');
            const stageList = overlay?.querySelector('.saga-loredeck-creator-stage-list');
            const bodyRect = body?.getBoundingClientRect?.();
            const currentRect = currentTask?.getBoundingClientRect?.();
            const stageRect = stageGuide?.getBoundingClientRect?.();
            const text = overlay?.innerText || '';
            const labels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            const headerActionLabels = [...overlay?.querySelectorAll('.saga-loredeck-creator-pipeline-header .saga-loredeck-creator-header-actions button') || []]
                .map(button => (button.innerText || button.textContent || '').trim())
                .filter(Boolean);
            const bottomActionLabels = [...overlay?.querySelectorAll('.saga-loredeck-creator-workbench-bottom-actions button') || []]
                .map(button => (button.innerText || button.textContent || '').trim())
                .filter(Boolean);
            return {
                open: !!overlay,
                hasTitle: text.includes('Loredeck Creator'),
                hasReviewQueue: text.includes('Review Queue'),
                hasCurrentTask: text.includes('Current Task') || text.includes('Plan') || text.includes('Draft'),
                hasClose: labels.includes('Close'),
                headerActionLabels,
                bottomActionLabels,
                currentTaskBeforeStageGuide: !!currentRect && !!stageRect && currentRect.top <= stageRect.top,
                currentTaskVisibleEarly: !!currentRect && !!bodyRect && currentRect.top < bodyRect.top + Math.min(260, bodyRect.height * 0.34),
                stageRailHorizontal: !!stageList && stageList.scrollWidth > stageList.clientWidth + 2,
                currentTaskTop: currentRect ? Math.round(currentRect.top) : -1,
                stageGuideTop: stageRect ? Math.round(stageRect.top) : -1,
                stageGuideHeight: stageRect ? Math.round(stageRect.height) : -1,
                labels,
            };
        }));
        if (!creatorState.open || !creatorState.hasTitle || !creatorState.hasReviewQueue || !creatorState.hasCurrentTask) findings.push('Mobile Advanced Creator did not render Review Queue/current-task state.');
        if (!creatorState.hasClose) findings.push('Mobile Advanced Creator did not expose Close.');
        if (creatorState.headerActionLabels.length) findings.push(`Mobile Advanced Creator still rendered persistent header actions: ${creatorState.headerActionLabels.join(', ')}.`);
        for (const label of ['Project Settings', 'Close']) {
            if (!creatorState.bottomActionLabels.includes(label)) findings.push(`Mobile Advanced Creator bottom action bar missing: ${label}.`);
        }
        if (!creatorState.currentTaskBeforeStageGuide || !creatorState.currentTaskVisibleEarly) findings.push('Mobile Advanced Creator did not prioritize the current task before the stage roadmap.');
        if (!creatorState.stageRailHorizontal) findings.push('Mobile Advanced Creator stage roadmap did not render as a compact horizontal rail.');
        const creatorScrollAudit = await getMobileNestedScrollAuditState(client, {
            label: 'Loredeck Creator workbench',
            scopeSelector: '.saga-loredeck-creator-workbench-overlay',
            allowedSelectors: ['.saga-loredeck-creator-workbench-body'],
        });
        addMobileNestedScrollFindings(findings, creatorScrollAudit);
        creatorState.scrollAudit = creatorScrollAudit;
        addMobileFontFindings(findings, await getMobileFontAuditState(client, {
            label: 'Mobile Advanced Creator',
            scopeSelector: '.saga-loredeck-creator-workbench-overlay',
        }));
        screenshots.push(await screenshot(client, 'mobile-advanced-harness-07-creator-review-queue'));
        await clickButtonText(client, 'Close', { root: '.saga-loredeck-creator-workbench-overlay', enabledOnly: false }).catch(() => false);
        await wait(400);
    }
    await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false }).catch(() => false);
    await wait(500);

    await clickRuntimeRoute(client, 'context');
    await waitFor(client, sagaActiveTabExpression('context'), 'Mobile Advanced Context route active', 10000);
    await wait(700);
    const proposalClick = await clickVisibleButtonText(client, 'Review Proposals', { root: '#saga-lore-panel', includes: true });
    const proposalsClicked = proposalClick?.clicked
        || await clickButtonText(client, 'Review Proposals');
    if (!proposalsClicked) findings.push('Mobile Advanced Review Proposals action was not clickable.');
    let proposalState = { open: false, hasTitle: false, rows: 0, hasActions: false };
    if (proposalsClicked) {
        await waitFor(client, '!!document.querySelector("#saga-context-proposal-review")', 'Mobile Advanced Context Proposal Review overlay', 10000);
        await wait(700);
        proposalState = await evaluate(client, script(() => {
            const overlay = document.querySelector('#saga-context-proposal-review');
            const text = overlay?.innerText || '';
            const labels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            const headerActionLabels = [...overlay?.querySelectorAll('.saga-context-proposal-review-header .saga-context-proposal-review-actions button') || []]
                .map(button => (button.innerText || button.textContent || '').trim())
                .filter(Boolean);
            const bottomActionLabels = [...overlay?.querySelectorAll('.saga-context-proposal-review-bottom-actions button') || []]
                .map(button => (button.innerText || button.textContent || '').trim())
                .filter(Boolean);
            return {
                open: !!overlay,
                hasTitle: text.includes('Context Proposal Review'),
                rows: overlay?.querySelectorAll('.saga-context-proposal-review-row').length || 0,
                hasActions: labels.includes('Apply') && labels.includes('Dismiss'),
                headerActionLabels,
                bottomActionLabels,
            };
        }));
        if (!proposalState.open || !proposalState.hasTitle || proposalState.rows < 1 || !proposalState.hasActions) findings.push('Mobile Advanced Context Proposal Review did not render expected proposal row/actions.');
        if (proposalState.headerActionLabels.length) findings.push(`Mobile Advanced Context Proposal Review still rendered persistent header actions: ${proposalState.headerActionLabels.join(', ')}.`);
        for (const label of ['Apply All', 'Dismiss All', 'Close']) {
            if (!proposalState.bottomActionLabels.includes(label)) findings.push(`Mobile Advanced Context Proposal Review bottom action bar missing: ${label}.`);
        }
        const proposalScrollAudit = await getMobileNestedScrollAuditState(client, {
            label: 'Context Proposal Review',
            scopeSelector: '#saga-context-proposal-review',
            allowedSelectors: ['.saga-context-proposal-review-body'],
        });
        addMobileNestedScrollFindings(findings, proposalScrollAudit);
        proposalState.scrollAudit = proposalScrollAudit;
        addMobileFontFindings(findings, await getMobileFontAuditState(client, {
            label: 'Mobile Advanced Context Proposal Review',
            scopeSelector: '#saga-context-proposal-review',
        }));
        screenshots.push(await screenshot(client, 'mobile-advanced-harness-08-context-proposals'));
    }

    const errors = client.events
        .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
        .map(event => formatLogEntry(event.params.entry))
        .filter(error => !isExpectedRepoLocalHarnessStorageError(error));
    const report = {
        ok: findings.length === 0 && errors.length === 0,
        target: SMOKE_TARGET,
        url: smokeUrl,
        screenshots,
        findings,
        errors,
        dialogEvents,
        initialState,
        loredecksRootScrollAudit,
        sessionRootState,
        sessionRootScrollAudit,
        injectionState,
        injectionScrollAudit,
        settingsState,
        settingsScrollAudit,
        continuityState,
        continuityScrollAudit,
        activeSetState,
        libraryClick,
        librarySelection,
        libraryOverviewState,
        libraryState,
        healthState,
        creatorState,
        proposalClick,
        proposalState,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
}

async function runMobileRedesignHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents) {
    const shotPrefix = `mobile-redesign-${VIEWPORT.width}x${VIEWPORT.height}`;
    await waitFor(client, 'window.__sagaSmokeReady === true && window.__sagaSmokeMode === "advanced"', 'Mobile redesign smoke ready marker', 20000);
    await waitFor(client, sagaActiveTabExpression('loredecks'), 'Mobile redesign Loredecks route active', 10000);
    await wait(800);

    const shellState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        return {
            viewport: { width: window.innerWidth, height: window.innerHeight },
            mobileShell: !!root?.classList?.contains('saga-runtime-mobile'),
            activeTab: root?.dataset?.mobileActiveTab || '',
            bottomRoutes: [...document.querySelectorAll('.saga-mobile-bottom-tab')].map(node => node.getAttribute('data-mobile-route') || ''),
            activeBottomLabel: document.querySelector('.saga-mobile-bottom-tab-active .saga-mobile-bottom-label')?.textContent?.trim() || '',
            activeBottomHasExitIcon: !!document.querySelector('.saga-mobile-bottom-tab-active .saga-mobile-bottom-exit-icon .saga-mobile-shell-action-symbol-close'),
            mobileHeaders: document.querySelectorAll('.saga-mobile-header').length,
            noHorizontalOverflow: !root || root.scrollWidth <= root.clientWidth + 1,
        };
    }));
    if (!shellState.mobileShell) findings.push(`Mobile redesign harness did not render the mobile shell at ${VIEWPORT.width}x${VIEWPORT.height}.`);
    if (shellState.activeTab !== 'loredecks') findings.push('Mobile redesign harness did not start on Loredecks.');
    if (shellState.activeBottomLabel !== 'Exit' || !shellState.activeBottomHasExitIcon) findings.push('Mobile redesign active Loredecks bottom tab did not morph into the Exit control.');
    for (const route of ['loredecks', 'session', 'continuity', 'context', 'lore', 'injection', 'settings']) {
        if (!shellState.bottomRoutes.includes(route)) findings.push(`Mobile redesign bottom bar missing route: ${route}.`);
    }
    if (shellState.mobileHeaders > 0) findings.push('Mobile redesign shell rendered the removed mobile top header.');
    if (!shellState.noHorizontalOverflow) findings.push('Mobile redesign shell has horizontal overflow on the Loredecks root.');

    const directStackSeed = await evaluate(client, script(() => {
        const saga = window.__sagaSmokeContext?.chatMetadata?.saga;
        if (!saga) return { ok: false, reason: 'missing-saga-state' };
        saga.loredeckStack = [
            { packId: 'smoke-arlong-park', enabled: true, priority: 100, locked: false, addedAt: Date.now() },
        ];
        return {
            ok: true,
            stackDeckIds: saga.loredeckStack.map(item => item.packId || item.folderId || ''),
        };
    }), { userGesture: true }).catch(error => ({ ok: false, reason: error?.message || String(error) }));
    if (!directStackSeed?.ok) findings.push(`Mobile redesign could not seed direct mobile Library stack (${directStackSeed?.reason || 'unknown'}).`);

    const libraryClick = await clickVisibleButtonText(client, 'Open Loredeck Library', { root: '#saga-lore-panel', includes: true });
    let libraryOpened = false;
    if (libraryClick?.clicked) {
        libraryOpened = await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay")', 'Mobile redesign Library overlay after click', 8000)
            .then(() => true)
            .catch(() => false);
    }
    if (!libraryOpened) {
        findings.push(`Mobile redesign Open Loredeck Library action did not open normally (${libraryClick?.reason || 'unknown'}).`);
        await evaluate(client, script(async () => {
            const library = await import('/src/loredecks/loredeck-library-panel.js');
            library.openLoredeckLibraryWindow();
            return true;
        }), { userGesture: true, timeoutMs: 20000 });
        await waitFor(client, '!!document.querySelector(".saga-loredeck-library-overlay")', 'Mobile redesign Library overlay fallback', 10000);
    }
    await wait(800);

    const libraryInitial = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const root = overlay?.querySelector('.saga-loredeck-library-shell-mobile');
        const body = overlay?.querySelector('.saga-loredeck-library-mobile-body');
        const browse = overlay?.querySelector('.saga-loredeck-library-mobile-browse');
        const cards = [...overlay?.querySelectorAll('.saga-loredeck-library-deck-mobile-touch') || []];
        const headerActionLabels = [...overlay?.querySelectorAll('.saga-loredeck-library-header-actions button') || []]
            .map(button => (button.innerText || button.textContent || '').trim())
            .filter(Boolean);
        const bottomActionLabels = [...overlay?.querySelectorAll('.saga-loredeck-library-mobile-bottom-actions button') || []]
            .map(button => (button.innerText || button.textContent || '').trim())
            .filter(Boolean);
        return {
            open: !!overlay,
            mobileShell: !!root,
            mobileBody: !!body,
            mobileBrowse: !!browse,
            headerActionLabels,
            bottomActionLabels,
            title: overlay?.querySelector('.saga-loredeck-library-header .saga-lore-workbench-title')?.textContent?.trim() || '',
            hasHeaderEmblem: !!overlay?.querySelector('.saga-loredeck-library-emblem'),
            headerSubtitle: overlay?.querySelector('.saga-loredeck-library-header .saga-lore-workbench-subtitle')?.textContent?.trim() || '',
            noDesktopColumns: !overlay?.querySelector('.saga-loredeck-library-columns'),
            noInlineDetails: !overlay?.querySelector('.saga-loredeck-library-details'),
            noResizeHandle: !overlay?.querySelector('.saga-loredeck-library-resize-handle'),
            noDefaultDragHandles: !overlay?.querySelector('.saga-loredeck-library-deck-grip')
                && !overlay?.querySelector('.saga-loredeck-library-mobile-list .saga-loredeck-library-folder-grip'),
            noInlineTitleEdits: !overlay?.querySelector('.saga-loredeck-library-mobile-list .saga-loredeck-library-title-edit-action'),
            folderRows: overlay?.querySelectorAll('.saga-loredeck-library-folder-mobile-touch[data-folder-id]').length || 0,
            selectedStrip: overlay?.querySelector('.saga-loredeck-library-mobile-selected-strip')?.innerText || '',
            deckCards: cards.length,
            generatedVisible: !!overlay?.querySelector('.saga-loredeck-library-deck-mobile-touch[data-pack-id="smoke-generated-creator-project"]'),
            noHorizontalOverflow: !overlay || overlay.scrollWidth <= overlay.clientWidth + 1,
        };
    }));
    const libraryScrollState = await getNestedScrollStyleState(client, ['.saga-loredeck-library-mobile-list']);
    if (!libraryInitial.open || !libraryInitial.mobileShell || !libraryInitial.mobileBody || !libraryInitial.mobileBrowse) findings.push('Mobile redesign Library did not render the mobile browse surface.');
    if (libraryInitial.title !== 'Library' || libraryInitial.hasHeaderEmblem || libraryInitial.headerSubtitle) findings.push('Mobile redesign Library header was not compacted for mobile.');
    if (libraryInitial.headerActionLabels.length) findings.push(`Mobile redesign Library still rendered persistent header actions: ${libraryInitial.headerActionLabels.join(', ')}.`);
    for (const label of ['Import', 'Refresh', 'Done']) {
        if (!libraryInitial.bottomActionLabels.includes(label)) findings.push(`Mobile redesign Library bottom action bar missing: ${label}.`);
    }
    if (libraryScrollState.offenders.length) findings.push(`Mobile redesign Library still has nested mobile list scroll styling: ${JSON.stringify(libraryScrollState.offenders)}`);
    if (!libraryInitial.noDesktopColumns || !libraryInitial.noInlineDetails || !libraryInitial.noResizeHandle || !libraryInitial.noDefaultDragHandles) findings.push('Mobile redesign Library default browse still exposed desktop columns/details/resize/drag affordances.');
    if (!libraryInitial.noInlineTitleEdits) findings.push('Mobile redesign Library default browse still exposed inline title edit affordances.');
    if (!libraryInitial.selectedStrip.includes('active') || libraryInitial.deckCards < 2 || !libraryInitial.generatedVisible) findings.push('Mobile redesign Library did not show active selected strip and multiple tappable deck cards.');
    if (!libraryInitial.noHorizontalOverflow) findings.push('Mobile redesign Library browse has horizontal overflow.');
    screenshots.push(await screenshot(client, `${shotPrefix}-01-library-browse`));

    const folderDetailClicked = await evaluate(client, script(() => {
        const row = document.querySelector('.saga-loredeck-library-folder-mobile-touch[data-folder-id]:not([data-folder-id="unfiled"])');
        if (!row) return false;
        row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
        return true;
    }), { userGesture: true });
    if (!folderDetailClicked) findings.push('Mobile redesign Library folder row was not available for tap-hold detail.');
    await waitFor(client, '!!document.querySelector(".saga-loredeck-library-mobile-detail-backdrop")', 'Mobile redesign Library folder detail sheet', 10000).catch(error => findings.push(error.message));
    const folderDetailState = await evaluate(client, script(() => {
        const sheet = document.querySelector('.saga-loredeck-library-mobile-detail-sheet');
        const text = sheet?.innerText || '';
        return {
            open: !!sheet,
            hasFolderTitle: text.includes('Harry Potter') || text.includes('Jujutsu Kaisen') || text.includes('Lord of The Rings'),
            hasFolderActions: text.includes('New Subfolder') || text.includes('Move Selected Here') || text.includes('Add Folder to Stack'),
            hasClose: [...sheet?.querySelectorAll('button') || []].some(button => (button.innerText || button.textContent || '').trim() === 'Close'),
        };
    }));
    if (!folderDetailState.open || !folderDetailState.hasFolderTitle || !folderDetailState.hasFolderActions || !folderDetailState.hasClose) findings.push('Mobile redesign Library folder detail sheet did not expose expected folder details/actions.');
    await clickButtonText(client, 'Close', { root: '.saga-loredeck-library-mobile-detail-sheet', enabledOnly: false });
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-mobile-detail-backdrop")', 'Mobile redesign Library folder detail sheet closed', 10000).catch(error => findings.push(error.message));

    await expandMobileLibraryFolders(client);
    const libraryCandidates = await getVisibleMobileLibraryDeckCandidates(client, ['smoke-arlong-park']);
    let libraryTarget = null;
    const libraryCandidateAttempts = [];
    if (!libraryCandidates?.length) findings.push('Mobile redesign Library could not find a visible second Loredeck after expanding folders.');
    const preferredCandidates = [...(libraryCandidates || [])]
        .sort((a, b) => {
            const aPreferred = a.packId === 'smoke-generated-creator-project' ? 0 : 1;
            const bPreferred = b.packId === 'smoke-generated-creator-project' ? 0 : 1;
            return aPreferred - bPreferred;
        });
    for (const candidate of preferredCandidates.slice(0, 16)) {
        const selector = `.saga-loredeck-library-deck-mobile-touch[data-pack-id="${candidate.packId}"]`;
        await evaluate(client, script(() => {
            const overlay = document.querySelector('.saga-loredeck-library-overlay');
            const body = document.querySelector('.saga-loredeck-library-mobile-body');
            if (overlay) overlay.dataset.smokePreserveOverlay = 'true';
            if (body && body.scrollHeight > body.clientHeight + 48) body.scrollTop = Math.min(96, body.scrollHeight - body.clientHeight);
            return true;
        })).catch(() => false);
        const tapped = await clickSelector(client, selector).catch(() => false);
        if (!tapped) continue;
        await wait(700);
        const selected = await evaluate(client, script(targetId => {
            const overlay = document.querySelector('.saga-loredeck-library-overlay');
            const body = document.querySelector('.saga-loredeck-library-mobile-body');
            const card = document.querySelector(`.saga-loredeck-library-deck-mobile-touch[data-pack-id="${targetId}"]`);
            const stack = window.__sagaSmokeContext?.chatMetadata?.saga?.loredeckStack || [];
            const stackDeckIds = stack.filter(item => item?.packId && item.enabled !== false).map(item => item.packId);
            const badge = card?.querySelector('.saga-loredeck-library-mobile-order-badge')?.textContent?.trim() || '';
            const pressed = card?.getAttribute('aria-pressed') || '';
            return {
                pressed,
                badge,
                stackDeckIds,
                selected: (pressed === 'true' && badge === '2') || stackDeckIds[1] === targetId,
                overlayPreserved: overlay?.dataset?.smokePreserveOverlay === 'true',
                mobileBodyScrollTop: body?.scrollTop || 0,
                stripText: document.querySelector('.saga-loredeck-library-mobile-selected-strip')?.innerText || '',
            };
        }, candidate.packId)).catch(() => false);
        libraryCandidateAttempts.push({ ...candidate, tapped, ...(selected && typeof selected === 'object' ? selected : { selected: false }) });
        if (selected?.selected) {
            libraryTarget = candidate;
            break;
        }
    }
    if (!libraryTarget?.packId) findings.push('Mobile redesign Library could not select a visible second Loredeck into order 2.');
    if (libraryCandidateAttempts.some(item => item.selected && item.overlayPreserved === false)) findings.push('Mobile redesign Library rebuilt the overlay after a mobile active-stack tap.');
    const targetDeckSelector = libraryTarget?.packId
        ? `.saga-loredeck-library-deck-mobile-touch[data-pack-id="${libraryTarget.packId}"]`
        : '.saga-loredeck-library-deck-mobile-touch[data-pack-id]';
    const librarySelected = await evaluate(client, script(targetId => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const cardFor = id => overlay?.querySelector(`.saga-loredeck-library-deck-mobile-touch[data-pack-id="${id}"]`);
        const badgeFor = id => cardFor(id)?.querySelector('.saga-loredeck-library-mobile-order-badge')?.textContent?.trim() || '';
        const strip = overlay?.querySelector('.saga-loredeck-library-mobile-selected-strip');
        const stack = window.__sagaSmokeContext?.chatMetadata?.saga?.loredeckStack || [];
        return {
            stripText: strip?.innerText || '',
            arlongBadge: badgeFor('smoke-arlong-park'),
            targetBadge: badgeFor(targetId),
            targetPackId: targetId,
            ariaPressed: cardFor(targetId)?.getAttribute('aria-pressed') || '',
            stackDeckIds: stack.filter(item => item?.packId && item.enabled !== false).map(item => item.packId),
            selectedChips: [...strip?.querySelectorAll('.saga-loredeck-library-mobile-selected-chip') || []].map(node => node.textContent?.trim() || ''),
        };
    }, libraryTarget?.packId || ''));
    if (!librarySelected.stripText.includes('2 active') || librarySelected.arlongBadge !== '1' || librarySelected.targetBadge !== '2') findings.push('Mobile redesign Library tap order did not render selected strip and order badges.');
    if (librarySelected.stackDeckIds[0] !== 'smoke-arlong-park' || librarySelected.stackDeckIds[1] !== libraryTarget?.packId) findings.push(`Mobile redesign Library tap order did not update shared stack order (${librarySelected.stackDeckIds.join(', ')}).`);

    await clickSelector(client, targetDeckSelector).catch(() => false);
    await waitFor(client, script(targetId => {
        const card = document.querySelector(`.saga-loredeck-library-deck-mobile-touch[data-pack-id="${targetId}"]`);
        return card?.getAttribute('aria-pressed') === 'false';
    }, libraryTarget?.packId || ''), 'Mobile redesign second Loredeck removed', 10000).catch(error => findings.push(error.message));
    const libraryRemoved = await evaluate(client, script(targetId => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const cardFor = id => overlay?.querySelector(`.saga-loredeck-library-deck-mobile-touch[data-pack-id="${id}"]`);
        const badgeFor = id => cardFor(id)?.querySelector('.saga-loredeck-library-mobile-order-badge')?.textContent?.trim() || '';
        return {
            stripText: overlay?.querySelector('.saga-loredeck-library-mobile-selected-strip')?.innerText || '',
            arlongBadge: badgeFor('smoke-arlong-park'),
            targetBadge: badgeFor(targetId),
        };
    }, libraryTarget?.packId || ''));
    if (!libraryRemoved.stripText.includes('1 active') || libraryRemoved.arlongBadge !== '1' || libraryRemoved.targetBadge) findings.push('Mobile redesign Library removal did not renumber remaining active Loredecks.');

    await waitFor(client, script(targetId => !!document.querySelector(`.saga-loredeck-library-deck-mobile-touch[data-pack-id="${targetId}"]`), libraryTarget?.packId || ''), 'Mobile redesign target deck visible for reselect', 10000).catch(error => findings.push(error.message));
    const reselectTarget = await clickSelector(client, targetDeckSelector).catch(() => false);
    if (!reselectTarget) findings.push('Mobile redesign Library target deck card was not tappable for reselect.');
    await waitFor(client, 'document.querySelector(".saga-loredeck-library-mobile-selected-strip")?.innerText.includes("2 active")', 'Mobile redesign reselected two decks', 10000).catch(error => findings.push(error.message));
    await waitFor(client, '!!document.querySelector(".saga-loredeck-library-deck-mobile-touch[data-pack-id=\\"smoke-arlong-park\\"]")', 'Mobile redesign Arlong deck visible after clearing search', 10000).catch(error => findings.push(error.message));

    const detailClicked = await evaluate(client, script(() => {
        const card = document.querySelector('.saga-loredeck-library-deck-mobile-touch[data-pack-id="smoke-arlong-park"]');
        if (!card) return false;
        card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
        return true;
    }), { userGesture: true });
    if (!detailClicked) findings.push('Mobile redesign Library deck card was not available for tap-hold detail.');
    await waitFor(client, '!!document.querySelector(".saga-loredeck-library-mobile-detail-backdrop")', 'Mobile redesign Library detail sheet', 10000).catch(error => findings.push(error.message));
    const detailState = await evaluate(client, script(() => {
        const sheet = document.querySelector('.saga-loredeck-library-mobile-detail-sheet');
        const text = sheet?.innerText || '';
        return {
            open: !!sheet,
            hasTitle: text.includes('Smoke Test: Arlong Park'),
            hasHealth: text.includes('Health') || text.includes('Open Pack Health Center'),
            hasClose: [...sheet?.querySelectorAll('button') || []].some(button => (button.innerText || button.textContent || '').trim() === 'Close'),
            oneScrollOwner: !!sheet?.querySelector('.saga-loredeck-library-mobile-detail-panel'),
        };
    }));
    if (!detailState.open || !detailState.hasTitle || !detailState.hasHealth || !detailState.hasClose || !detailState.oneScrollOwner) findings.push('Mobile redesign Library detail sheet did not expose expected detail/health/close content.');
    screenshots.push(await screenshot(client, `${shotPrefix}-02-library-detail`));
    await clickButtonText(client, 'Close', { root: '.saga-loredeck-library-mobile-detail-sheet', enabledOnly: false });
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-mobile-detail-backdrop")', 'Mobile redesign Library detail sheet closed', 10000).catch(error => findings.push(error.message));

    const reorderClicked = await clickButtonText(client, 'Reorder', { root: '.saga-loredeck-library-mobile-selected-strip' });
    if (!reorderClicked) findings.push('Mobile redesign Library Reorder action was not clickable from the selected strip.');
    await waitFor(client, '!!document.querySelector(".saga-loredeck-library-mobile-reorder-sheet")', 'Mobile redesign Library reorder sheet', 10000).catch(error => findings.push(error.message));
    const reorderState = await evaluate(client, script(() => {
        const sheet = document.querySelector('.saga-loredeck-library-mobile-reorder-sheet');
        return {
            open: !!sheet,
            rows: sheet?.querySelectorAll('.saga-loredeck-library-mobile-reorder-row').length || 0,
            grips: sheet?.querySelectorAll('.saga-loredeck-library-mobile-reorder-grip').length || 0,
            browseGrips: document.querySelectorAll('.saga-loredeck-library-mobile-browse .saga-loredeck-library-deck-grip').length,
            rowTitles: [...sheet?.querySelectorAll('.saga-loredeck-library-mobile-reorder-label') || []].map(node => node.textContent?.trim() || ''),
            buttons: [...sheet?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean),
        };
    }));
    if (!reorderState.open || reorderState.rows !== 2 || reorderState.grips !== 2 || reorderState.browseGrips !== 0) findings.push('Mobile redesign Library reorder mode did not show selected-only rows with handles only inside the reorder sheet.');
    if (!reorderState.buttons.includes('Done') || !reorderState.buttons.includes('Down')) findings.push('Mobile redesign Library reorder sheet did not expose explicit Done and movement controls.');
    const movedDown = await clickButtonInRow(client, '', '.saga-loredeck-library-mobile-reorder-row', 'Smoke Test: Arlong Park', 'Down');
    if (!movedDown) findings.push('Mobile redesign Library reorder Down control was not clickable.');
    await wait(700);
    const reorderMoved = await evaluate(client, script(() => {
        const rows = [...document.querySelectorAll('.saga-loredeck-library-mobile-reorder-row')];
        const stack = window.__sagaSmokeContext?.chatMetadata?.saga?.loredeckStack || [];
        return {
            firstTitle: rows[0]?.innerText || '',
            stackDeckIds: stack.filter(item => item?.packId && item.enabled !== false).map(item => item.packId),
        };
    }));
    if (movedDown && reorderMoved.stackDeckIds[0] !== libraryTarget?.packId) findings.push('Mobile redesign Library reorder did not apply to shared active stack order.');
    screenshots.push(await screenshot(client, `${shotPrefix}-03-library-reorder`));
    await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-mobile-reorder-sheet', enabledOnly: false }).catch(() => false);
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-mobile-reorder-sheet")', 'Mobile redesign Library reorder sheet closed', 10000).catch(error => findings.push(error.message));
    await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false }).catch(() => false);
    await waitFor(client, '!document.querySelector(".saga-loredeck-library-overlay")', 'Mobile redesign Library overlay closed', 10000).catch(error => findings.push(error.message));

    await clickRuntimeRoute(client, 'settings');
    await waitFor(client, sagaActiveTabExpression('settings'), 'Mobile redesign Settings route after Library', 10000).catch(error => findings.push(error.message));
    await wait(300);
    const mobileSettingsTooltipState = await getVisibleFloatingTooltipState(client);
    const mobileSettingsState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const text = document.body?.innerText || '';
        return {
            activeTab: root?.dataset?.mobileActiveTab || '',
            hasSettings: text.includes('Settings'),
            hasModeLabel: text.includes('Experience Mode'),
            hasProviders: text.includes('Providers') || text.includes('Provider'),
            hasOverflowSheet: !!document.querySelector('.saga-mobile-more-sheet'),
            shellBackActions: document.querySelectorAll('.saga-mobile-shell-back').length,
            activeBottomLabel: document.querySelector('.saga-mobile-bottom-tab-active .saga-mobile-bottom-label')?.textContent?.trim() || '',
            mobileHeaders: document.querySelectorAll('.saga-mobile-header').length,
        };
    }));
    if (mobileSettingsState.activeTab !== 'settings' || !mobileSettingsState.hasSettings || !mobileSettingsState.hasModeLabel || !mobileSettingsState.hasProviders) findings.push('Mobile redesign Settings route did not expose Settings, Experience Mode, and Providers.');
    if (mobileSettingsState.hasOverflowSheet) findings.push('Mobile redesign rendered the removed overflow sheet.');
    if (mobileSettingsState.shellBackActions > 0) findings.push('Mobile redesign Settings route rendered a shell Back action.');
    if (mobileSettingsState.activeBottomLabel !== 'Exit') findings.push('Mobile redesign Settings active bottom tab did not morph into Exit.');
    if (mobileSettingsState.mobileHeaders > 0) findings.push('Mobile redesign Settings route rendered the removed mobile top header.');
    if (mobileSettingsTooltipState.visible) findings.push(`Mobile redesign Settings route change showed a floating tooltip: ${mobileSettingsTooltipState.text || 'blank'}.`);

    await clickRuntimeRoute(client, 'lore');
    await waitFor(client, sagaMobileRouteExpression('lore'), 'Mobile redesign Lorecards mobile route active', 10000);
    await waitFor(client, sagaActiveTabExpression('lore'), 'Mobile redesign Lorecards route active', 10000);
    await waitFor(client, '!!document.querySelector(".saga-mobile-lorecards-subtabs")', 'Mobile redesign Lorecards secondary sub-tabs', 10000);
    const loreRouteTooltipState = await getVisibleFloatingTooltipState(client);
    const lorecardsRoot = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const page = document.querySelector('.saga-runtime-tab-body-lore');
        const pageStyle = page ? getComputedStyle(page) : null;
        const subtab = document.querySelector('.saga-mobile-lorecards-subtabs');
        const subtabRect = subtab?.getBoundingClientRect?.();
        const bottomRect = document.querySelector('.saga-mobile-bottom-bar')?.getBoundingClientRect?.();
        const labels = [...document.querySelectorAll('.saga-mobile-lorecards-subtab-label')].map(node => node.textContent?.trim() || '').filter(Boolean);
        const activeBottom = document.querySelector('.saga-mobile-bottom-tab-active');
        const bottomContextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window });
        activeBottom?.dispatchEvent(bottomContextEvent);
        return {
            labels,
            noHorizontalOverflow: !root || root.scrollWidth <= root.clientWidth + 1,
            noPipeline: !document.querySelector('.saga-lorecard-pipeline'),
            activeStage: root?.dataset?.mobileLorecardsStage || '',
            subtabsAboveBottom: !!subtabRect && !!bottomRect && subtabRect.height > 0 && subtabRect.top < bottomRect.top,
            pageOverflowY: pageStyle?.overflowY || '',
            pageTouchAction: pageStyle?.touchAction || '',
            bottomContextPrevented: bottomContextEvent.defaultPrevented,
        };
    }));
    if (lorecardsRoot.labels.join('|') !== 'Lore|Generate|Automation') findings.push(`Mobile redesign Lorecards root rendered lifecycle labels ${lorecardsRoot.labels.join(', ')} instead of Lore, Generate, Automation.`);
    if (!lorecardsRoot.noPipeline) findings.push('Mobile redesign Lorecards root still rendered the page-body Lorecard Pipeline card.');
    if (!lorecardsRoot.subtabsAboveBottom) findings.push('Mobile redesign Lorecards sub-tabs were not positioned above the main bottom bar.');
    if (!lorecardsRoot.noHorizontalOverflow) findings.push('Mobile redesign Lorecards root has horizontal overflow.');
    if (lorecardsRoot.pageOverflowY !== 'auto' || !/pan-y/i.test(lorecardsRoot.pageTouchAction)) findings.push(`Mobile redesign Lorecards page is not configured as the finger-scroll owner (${lorecardsRoot.pageOverflowY}, ${lorecardsRoot.pageTouchAction}).`);
    if (!lorecardsRoot.bottomContextPrevented) findings.push('Mobile redesign active bottom tab did not suppress Android long-press context menu.');
    if (loreRouteTooltipState.visible) findings.push(`Mobile redesign Lorecards route change showed a floating tooltip: ${loreRouteTooltipState.text || 'blank'}.`);
    addMobileFontFindings(findings, await getMobileFontAuditState(client, {
        label: 'Mobile redesign Lorecards route',
        scopeSelector: '#saga-lore-panel.saga-runtime-mobile',
    }));

    const automationClicked = await clickSelector(client, '.saga-mobile-lorecards-subtab[data-stage="automation"]').catch(() => false);
    if (!automationClicked) findings.push('Mobile redesign Automation page button was not clickable.');
    await waitFor(client, 'document.querySelector(".saga-lorecards-lifecycle-tab")?.dataset?.sagaLoreLifecycleStage === "automation"', 'Mobile redesign Automation page active', 10000).catch(error => findings.push(error.message));
    await waitFor(client, '!document.querySelector(".saga-mobile-lorecards-loading-shell") && !!document.querySelector(".saga-mobile-lore-automation-page .saga-auto-relevance-card")', 'Mobile redesign Automation deferred content', 10000).catch(error => findings.push(error.message));
    await wait(500);
    const automationTooltipState = await getVisibleFloatingTooltipState(client);
    const automationState = await evaluate(client, script(() => {
        const page = document.querySelector('.saga-mobile-lore-automation-page');
        const text = page?.innerText || '';
        const labels = [...page?.querySelectorAll('button, select, input') || []].map(node => {
            if (node.tagName === 'SELECT') return node.closest('label')?.innerText?.trim() || '';
            if (node.tagName === 'INPUT') return node.closest('label')?.innerText?.trim() || '';
            return (node.innerText || node.textContent || '').trim();
        }).filter(Boolean);
        return {
            page: !!page,
            activeStage: document.querySelector('.saga-lorecards-lifecycle-tab')?.dataset?.sagaLoreLifecycleStage || '',
            hasMode: text.includes('Mode') && text.includes('ARMP') && text.includes('ARMPC'),
            hasStyle: text.includes('Style') && text.includes('Balanced'),
            hasPacing: text.includes('Pacing'),
            modeButtons: page?.querySelectorAll('.saga-lore-automation-choice-group[data-choice-group="mode"] .saga-lore-automation-choice-button').length || 0,
            styleButtons: page?.querySelectorAll('.saga-lore-automation-choice-group[data-choice-group="style"] .saga-lore-automation-choice-button').length || 0,
            pacingButtons: page?.querySelectorAll('.saga-lore-automation-choice-group[data-choice-group="pacing"] .saga-lore-automation-choice-button').length || 0,
            selectCount: page?.querySelectorAll('select').length || 0,
            hasStatus: text.includes('Status'),
            hasCardControl: text.includes('Card control'),
            hasCurrentTiers: text.includes('Current tiers'),
            hasRunNow: labels.includes('Run Now'),
            hasPauseResume: labels.includes('Pause') || labels.includes('Resume'),
            hasUndo: labels.includes('Undo Last Run'),
            hasActivity: text.includes('Recent Activity'),
            hasLoreWorkspace: !!document.querySelector('.saga-lorecard-workspace-list'),
            noHorizontalOverflow: !page || page.scrollWidth <= page.clientWidth + 1,
        };
    }));
    if (!automationState.page || automationState.activeStage !== 'automation') findings.push('Mobile redesign Automation page did not become the active Lorecards sub-page.');
    if (!automationState.hasMode || !automationState.hasStyle || !automationState.hasPacing || !automationState.hasStatus || !automationState.hasCardControl || !automationState.hasCurrentTiers || !automationState.hasRunNow || !automationState.hasPauseResume || !automationState.hasUndo || !automationState.hasActivity) {
        findings.push('Mobile redesign Automation page did not render the full Lore Automation cockpit.');
    }
    if (automationState.modeButtons !== 3 || automationState.styleButtons !== 3 || automationState.pacingButtons !== 3 || automationState.selectCount > 0) findings.push('Mobile redesign Automation controls did not render as three-button segmented groups.');
    if (automationState.hasLoreWorkspace) findings.push('Mobile redesign Automation page leaked the Lore object list.');
    if (!automationState.noHorizontalOverflow) findings.push('Mobile redesign Automation page has horizontal overflow.');
    if (automationTooltipState.visible) findings.push(`Mobile redesign Automation sub-tab showed a floating tooltip: ${automationTooltipState.text || 'blank'}.`);
    screenshots.push(await screenshot(client, `${shotPrefix}-04-lorecards-automation`));

    const pendingClicked = await clickSelector(client, '.saga-mobile-lorecards-subtab[data-stage="lore"]').catch(() => false);
    if (!pendingClicked) findings.push('Mobile redesign Lore page button was not clickable.');
    await waitFor(client, 'document.querySelector(".saga-lorecards-lifecycle-tab")?.dataset?.sagaLoreLifecycleStage === "lore"', 'Mobile redesign Lore page active', 10000).catch(error => findings.push(error.message));
    await waitFor(client, '!document.querySelector(".saga-mobile-lorecards-loading-shell") && !!document.querySelector(".saga-lorecard-workspace-list")', 'Mobile redesign Lore deferred content', 10000).catch(error => findings.push(error.message));
    await wait(500);
    const pendingTooltipState = await getVisibleFloatingTooltipState(client);
    const pendingScrollState = await getNestedScrollStyleState(client, [
        '.saga-lorecards-lifecycle-tab .saga-lorecard-workspace-list',
    ]);
    const pendingCardClicked = await clickSelector(client, '.saga-pending-review-entry-card-tappable');
    if (!pendingCardClicked) findings.push('Mobile redesign Pending card was not tappable.');
    const pendingState = await evaluate(client, script(() => {
        const pendingCard = document.querySelector('.saga-lorecard-workspace-row[data-lorecard-workspace-status="pending"]');
        const labels = [...pendingCard?.querySelectorAll('.saga-pending-entry-actions button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        return {
            hasPendingCard: !!pendingCard,
            labels,
            selectedCards: document.querySelectorAll('.saga-pending-review-entry-card.saga-review-lore-card-selected').length,
            permanentActionRows: document.querySelectorAll('.saga-pending-entry-actions').length,
            hasAcceptAll: labels.includes('Accept All'),
            hasRejectAll: labels.includes('Reject All'),
            lifecycleStage: document.querySelector('.saga-lorecards-lifecycle-tab')?.dataset?.sagaLoreLifecycleStage || '',
            tagRows: document.querySelectorAll('.saga-pending-readonly-tags, .saga-pending-review-entry-card .saga-lore-entry-tags').length,
        };
    }));
    if (!pendingState.hasPendingCard) findings.push('Mobile redesign Lore page did not render a Pending Review card.');
    for (const label of ['Accept', 'Reject']) {
        if (!pendingState.labels.includes(label)) findings.push(`Mobile redesign Pending row missing action: ${label}.`);
    }
    if (pendingState.labels.includes('Edit') || pendingState.labels.includes('Clear')) findings.push('Mobile redesign Pending row exposed more than Accept/Reject.');
    if (pendingState.hasAcceptAll || pendingState.hasRejectAll) findings.push('Mobile redesign Lore page still exposed default Accept All/Reject All.');
    if (pendingState.tagRows !== 0) findings.push('Mobile redesign Pending cards showed tag rows despite the default hidden mobile tag setting.');
    if (pendingTooltipState.visible) findings.push(`Mobile redesign Lore sub-tab showed a floating tooltip: ${pendingTooltipState.text || 'blank'}.`);
    if (pendingScrollState.offenders.length) findings.push(`Mobile redesign Lore page still has nested list scroll styling: ${JSON.stringify(pendingScrollState.offenders)}`);
    screenshots.push(await screenshot(client, `${shotPrefix}-05-lorecards-lore`));
    await evaluate(client, script(() => {
        const card = document.querySelector('.saga-pending-review-entry-card-tappable');
        card?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, view: window }));
        return !!card;
    }), { userGesture: true }).catch(() => false);
    await waitFor(client, '!!document.querySelector(".saga-pending-lore-edit-details, .saga-mobile-lorecard-editor-shell")', 'Mobile redesign Pending detail affordance', 10000).catch(error => findings.push(error.message));

    const approvedTooltipState = await getVisibleFloatingTooltipState(client);
    const approvedScrollState = await getNestedScrollStyleState(client, [
        '.saga-lorecards-lifecycle-tab .saga-lorecard-workspace-list',
    ]);
    await evaluate(client, script(() => {
        document.querySelector('.saga-lore-entry-card[data-entry-id="smoke_long_title_lore"]')?.scrollIntoView({ block: 'center', inline: 'nearest' });
        return true;
    }), { userGesture: true }).catch(() => false);
    await wait(300);
    const approvedState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const longCard = document.querySelector('.saga-lore-entry-card[data-entry-id="smoke_long_title_lore"]');
        const title = longCard?.querySelector('.saga-lore-entry-title');
        const titleRect = title?.getBoundingClientRect?.();
        const titleStyle = title ? getComputedStyle(title) : null;
        const lineHeight = titleStyle ? Number.parseFloat(titleStyle.lineHeight) || 0 : 0;
        const unexpandedAcceptedCards = [...document.querySelectorAll('.saga-lorecard-workspace-row[data-lorecard-workspace-status="accepted"]:not(.saga-lore-entry-expanded)')];
        return {
            workspaceVisible: !!document.querySelector('.saga-lorecard-workspace'),
            acceptedVisible: !!document.querySelector('.saga-lorecard-workspace-row[data-lorecard-workspace-status="accepted"]'),
            longCard: !!longCard,
            titleText: title?.textContent || '',
            titleHeight: titleRect?.height || 0,
            lineHeight,
            wrapsAtLeastTwoLines: !!titleRect && !!lineHeight && titleRect.height >= lineHeight * 1.75,
            cardHeight: longCard?.getBoundingClientRect?.().height || 0,
            detailButtons: longCard?.querySelectorAll('.saga-lore-entry-details-btn').length || 0,
            defaultActionRows: unexpandedAcceptedCards.filter(card => !!card.querySelector('.saga-lore-entry-actions')).length,
            tagRows: document.querySelectorAll('.saga-lore-entry-card .saga-lore-entry-tags').length,
            acceptedSectionClips: false,
            noHorizontalOverflow: !root || root.scrollWidth <= root.clientWidth + 1,
        };
    }));
    if (!approvedState.workspaceVisible || !approvedState.acceptedVisible) findings.push('Mobile redesign Lore page did not include Accepted Lorecards in the unified workspace.');
    if (!approvedState.longCard || !approvedState.wrapsAtLeastTwoLines || approvedState.cardHeight <= approvedState.titleHeight) findings.push(`Mobile redesign Accepted long title did not wrap/read cleanly (title height ${approvedState.titleHeight}, line ${approvedState.lineHeight}).`);
    if (approvedState.detailButtons !== 0 || approvedState.defaultActionRows !== 0) findings.push('Mobile redesign Accepted cards still exposed permanent detail buttons or default full action rows.');
    if (approvedState.tagRows !== 0) findings.push('Mobile redesign Accepted cards showed tag rows despite the default hidden mobile tag setting.');
    if (!approvedState.noHorizontalOverflow) findings.push('Mobile redesign Lore page has horizontal overflow.');
    if (approvedTooltipState.visible) findings.push(`Mobile redesign Lore sub-tab showed a floating tooltip: ${approvedTooltipState.text || 'blank'}.`);
    if (approvedScrollState.offenders.length) findings.push(`Mobile redesign Lore page still has nested list scroll styling: ${JSON.stringify(approvedScrollState.offenders)}`);

    const longCardTapped = await clickSelector(client, '.saga-lore-entry-card[data-entry-id="smoke_long_title_lore"]');
    if (!longCardTapped) findings.push('Mobile redesign Accepted long-title card was not tappable.');
    await waitFor(client, '!!document.querySelector(".saga-mobile-lorecard-editor-shell")', 'Mobile redesign Accepted card detail editor', 10000).catch(error => findings.push(error.message));
    const approvedActiveState = await evaluate(client, script(() => {
        const card = document.querySelector('.saga-lore-entry-card[data-entry-id="smoke_long_title_lore"]');
        const activeCard = document.querySelector('.saga-lorecard-workspace-row.saga-lore-entry-active');
        return {
            activeClass: !!card?.classList?.contains('saga-lore-entry-active'),
            hasActiveBadge: /active/i.test(card?.innerText || ''),
            anyActiveClass: !!activeCard,
            anyActiveBadge: /active/i.test(activeCard?.innerText || ''),
        };
    }));
    if (!approvedActiveState.anyActiveClass || !approvedActiveState.anyActiveBadge) findings.push('Mobile redesign Accepted active state was not visible on an object card.');
    screenshots.push(await screenshot(client, `${shotPrefix}-06-lorecards-lore-active`));
    await clickButtonText(client, 'Close', { root: '#saga-mobile-lorecard-editor' }).catch(() => false);
    await waitFor(client, '!document.querySelector("#saga-mobile-lorecard-editor")', 'Mobile redesign Accepted editor closed', 10000).catch(error => findings.push(error.message));

    const generationClicked = await clickSelector(client, '.saga-mobile-lorecards-subtab[data-stage="generate"]').catch(() => false);
    if (!generationClicked) findings.push('Mobile redesign Generate page button was not clickable.');
    await waitFor(client, 'document.querySelector(".saga-lorecards-lifecycle-tab")?.dataset?.sagaLoreLifecycleStage === "generate"', 'Mobile redesign Generate page active', 10000).catch(error => findings.push(error.message));
    await waitFor(client, '!document.querySelector(".saga-mobile-lorecards-loading-shell") && !!document.querySelector(".saga-lore-generation-collapsible")', 'Mobile redesign Generate deferred content', 10000).catch(error => findings.push(error.message));
    const generationTooltipState = await getVisibleFloatingTooltipState(client);
    const generationScrollState = await getNestedScrollStyleState(client, [
        '.saga-lorecards-lifecycle-tab .saga-lorecard-workspace-list',
    ]);
    const generationState = await evaluate(client, script(() => ({
        hasGenerationWorkspace: document.body.innerText.includes('Capture / Suggest') || document.body.innerText.includes('Manual Lore Note'),
        pendingVisible: !!document.querySelector('.saga-lore-pending-collapsible:not([hidden])') && getComputedStyle(document.querySelector('.saga-lore-pending-collapsible')).display !== 'none',
        acceptedVisible: !!document.querySelector('.saga-lore-accepted-collapsible:not([hidden])') && getComputedStyle(document.querySelector('.saga-lore-accepted-collapsible')).display !== 'none',
    })));
    if (!generationState.hasGenerationWorkspace || generationState.pendingVisible || generationState.acceptedVisible) findings.push('Mobile redesign Generate page did not stay focused on creation/suggestion only.');
    if (generationTooltipState.visible) findings.push(`Mobile redesign Generate sub-tab showed a floating tooltip: ${generationTooltipState.text || 'blank'}.`);
    if (generationScrollState.offenders.length) findings.push(`Mobile redesign Generate page still has nested list scroll styling: ${JSON.stringify(generationScrollState.offenders)}`);
    screenshots.push(await screenshot(client, `${shotPrefix}-07-lorecards-generate`));

    const errors = collectClientErrors(client)
        .filter(error => !isExpectedRepoLocalHarnessStorageError(error));
    const report = {
        ok: findings.length === 0 && errors.length === 0,
        target: SMOKE_TARGET,
        viewport: VIEWPORT,
        url: smokeUrl,
        screenshots,
        findings,
        errors,
        dialogEvents,
        shellState,
        directStackSeed,
        libraryInitial,
        folderDetailState,
        libraryCandidateAttempts: libraryCandidateAttempts.slice(0, 4),
        libraryScrollState,
        librarySelected,
        libraryRemoved,
        detailState,
        reorderState,
        reorderMoved,
        mobileSettingsState,
        mobileSettingsTooltipState,
        lorecardsRoot,
        loreRouteTooltipState,
        automationState,
        automationTooltipState,
        pendingState,
        pendingTooltipState,
        pendingScrollState,
        approvedState,
        approvedTooltipState,
        approvedScrollState,
        approvedActiveState,
        generationState,
        generationTooltipState,
        generationScrollState,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
}

async function runTabletAdvancedHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents) {
    await waitFor(client, 'window.__sagaSmokeReady === true && window.__sagaSmokeMode === "advanced"', 'Tablet Advanced smoke ready marker', 20000);
    await waitFor(client, sagaActiveTabExpression('loredecks'), 'Tablet Advanced Loredecks route active', 10000);
    await wait(800);

    const shellState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const drawer = document.querySelector('.saga-runtime-drawer');
        const drawerContent = drawer?.querySelector('.saga-runtime-tab-body, .saga-lore-panel-body') || drawer;
        const railTabs = [...document.querySelectorAll('.saga-runtime-rail-tab')].map(node => node.getAttribute('data-tab-id') || '').filter(Boolean);
        const text = document.body?.innerText || '';
        return {
            mobileShell: !!root?.classList?.contains('saga-runtime-mobile'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || root?.dataset?.mobileActiveTab || '',
            drawer: !!drawer,
            drawerText: (drawer?.innerText || '').slice(0, 900),
            railTabs,
            mobileBottomTabs: document.querySelectorAll('.saga-mobile-bottom-tab').length,
            overflowSheet: !!document.querySelector('.saga-mobile-more-sheet'),
            hasActiveStack: text.includes('Active Stack'),
            hasOpenLibrary: text.includes('Open Loredeck Library'),
            hasCreateDeck: text.includes('Create Deck'),
            rootClientWidth: root?.clientWidth || 0,
            rootScrollWidth: root?.scrollWidth || 0,
            drawerClientWidth: drawerContent?.clientWidth || 0,
            drawerScrollWidth: drawerContent?.scrollWidth || 0,
            bodyClientWidth: document.documentElement?.clientWidth || 0,
            bodyScrollWidth: document.documentElement?.scrollWidth || 0,
            noHorizontalOverflow: (!drawerContent || drawerContent.scrollWidth <= drawerContent.clientWidth + 2)
                && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
        };
    }));
    if (shellState.mobileShell) findings.push('Tablet Advanced harness rendered the mobile shell at 768px instead of the desktop rail/drawer path.');
    if (shellState.activeTab !== 'loredecks') findings.push('Tablet Advanced harness did not start on Loredecks.');
    if (!shellState.drawer) findings.push('Tablet Advanced harness did not render the desktop drawer above the mobile breakpoint.');
    for (const route of ['loredecks', 'session', 'context', 'lore', 'continuity', 'injection', 'settings']) {
        if (!shellState.railTabs.includes(route)) findings.push(`Tablet Advanced rail missing route: ${route}.`);
    }
    if (shellState.mobileBottomTabs > 0 || shellState.overflowSheet) findings.push('Tablet Advanced harness rendered mobile bottom-bar or overflow-sheet UI above the mobile breakpoint.');
    if (!shellState.hasActiveStack || !shellState.hasOpenLibrary || !shellState.hasCreateDeck) findings.push('Tablet Advanced Loredecks drawer did not render stack, Library, and Creator actions.');
    if (!shellState.noHorizontalOverflow) findings.push(`Tablet Advanced shell has horizontal overflow (drawer ${shellState.drawerScrollWidth}/${shellState.drawerClientWidth}, body ${shellState.bodyScrollWidth}/${shellState.bodyClientWidth}).`);
    screenshots.push(await screenshot(client, 'tablet-advanced-harness-01-loredecks-desktop-shell'));

    const libraryClick = await clickVisibleButtonText(client, 'Open Loredeck Library', { root: '#saga-lore-panel', includes: true });
    const hydratedLibraryExpression = '!!document.querySelector(".saga-loredeck-library-overlay:not(.saga-loredeck-library-overlay-opening) .saga-loredeck-library-body:not(.saga-loredeck-library-body-opening)")';
    let libraryOpened = false;
    if (libraryClick?.clicked) {
        libraryOpened = await waitFor(
            client,
            hydratedLibraryExpression,
            'Tablet Advanced hydrated Library overlay after visible click',
            10000,
        ).then(() => true).catch(() => false);
    }
    if (!libraryOpened) {
        if (!libraryClick?.clicked) findings.push(`Tablet Advanced Open Loredeck Library action was not clickable (${libraryClick?.reason || 'unknown'}).`);
        else findings.push('Tablet Advanced Open Loredeck Library visible click did not open the overlay.');
        await evaluate(client, script(async () => {
            const library = await import('/src/loredecks/loredeck-library-panel.js');
            library.openLoredeckLibraryWindow();
            if (typeof library.renderLoredeckLibraryOverlay === 'function') {
                library.renderLoredeckLibraryOverlay({ preserveScroll: false, progressiveOpen: false });
            }
            return true;
        }), { userGesture: true, timeoutMs: 20000 });
        await waitFor(client, hydratedLibraryExpression, 'Tablet Advanced hydrated Library overlay fallback', 10000);
    }
    await wait(700);
    const librarySelection = await selectLoredeckInLibraryByPackId(client, 'smoke-arlong-park', 'Smoke Test: Arlong Park');
    if (!librarySelection.selected) findings.push(`Tablet Advanced Library could not select the seeded Loredeck (${librarySelection.mode || 'unknown'}).`);
    await wait(700);
    await evaluate(client, script(() => {
        const body = document.querySelector('.saga-loredeck-library-body');
        const details = document.querySelector('.saga-loredeck-library-details');
        if (body && details) {
            body.scrollTop = Math.max(0, details.offsetTop - body.offsetTop - 8);
            details.scrollTop = 0;
        } else {
            details?.scrollIntoView({ block: 'start', inline: 'nearest' });
        }
        return !!details;
    }), { userGesture: true }).catch(() => false);
    await wait(250);
    const libraryState = await evaluate(client, script(() => {
        const overlay = document.querySelector('.saga-loredeck-library-overlay');
        const details = overlay?.querySelector('.saga-loredeck-library-details');
        const text = details?.innerText || '';
        const overlayLabels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        const detailLabels = [...details?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
        return {
            open: !!overlay,
            desktopBody: !!overlay?.querySelector('.saga-loredeck-library-body'),
            hasPackTitle: text.includes('Smoke Test: Arlong Park'),
            hasObjectActions: detailLabels.includes('Open Loredeck')
                && detailLabels.includes('Open Pack Health Center')
                && (detailLabels.includes('Edit Metadata') || detailLabels.includes('View Metadata'))
                && detailLabels.includes('Export'),
            hasCreateDeck: overlayLabels.includes('Create Deck'),
            hasDone: overlayLabels.includes('Done'),
            noHorizontalOverflow: !overlay || overlay.scrollWidth <= overlay.clientWidth + 2,
            detailLabels,
            overlayLabels,
        };
    }));
    if (!libraryState.open || !libraryState.hasPackTitle) findings.push('Tablet Advanced Library did not render selected Loredeck details.');
    if (!libraryState.hasObjectActions) findings.push('Tablet Advanced Library did not render selected object actions.');
    if (!libraryState.hasCreateDeck || !libraryState.hasDone) findings.push('Tablet Advanced Library did not expose Create Deck and Done actions.');
    if (!libraryState.noHorizontalOverflow) findings.push('Tablet Advanced Library overlay has horizontal overflow.');
    screenshots.push(await screenshot(client, 'tablet-advanced-harness-02-library-details'));

    const healthClicked = await clickButtonText(client, 'Open Pack Health Center', { root: '.saga-loredeck-library-details' })
        || await clickButtonText(client, 'Open Pack Health Center', { root: '.saga-loredeck-library-overlay' });
    if (!healthClicked) findings.push('Tablet Advanced Open Pack Health Center action was not clickable.');
    let healthState = { open: false, hasTitle: false, hasPack: false, hasTabsOrActions: false, hasClose: false };
    if (healthClicked) {
        await waitFor(client, '!!document.querySelector(".saga-loredeck-health-center-overlay")', 'Tablet Advanced Pack Health overlay', 10000);
        await wait(700);
        healthState = await evaluate(client, script(() => {
            const overlay = document.querySelector('.saga-loredeck-health-center-overlay');
            const text = overlay?.innerText || '';
            const labels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            return {
                open: !!overlay,
                hasTitle: text.includes('Pack Health Center'),
                hasPack: text.includes('Smoke Test: Arlong Park') || text.includes('Harry Potter'),
                hasTabsOrActions: text.includes('Summary') || text.includes('Issues') || labels.includes('Refresh Scan') || labels.includes('Run Scan'),
                hasClose: labels.includes('Close'),
                noHorizontalOverflow: !overlay || overlay.scrollWidth <= overlay.clientWidth + 2,
            };
        }));
        if (!healthState.open || !healthState.hasTitle || !healthState.hasPack || !healthState.hasTabsOrActions) findings.push('Tablet Advanced Pack Health Center did not render expected content.');
        if (!healthState.hasClose) findings.push('Tablet Advanced Pack Health Center did not expose Close.');
        if (!healthState.noHorizontalOverflow) findings.push('Tablet Advanced Pack Health Center has horizontal overflow.');
        screenshots.push(await screenshot(client, 'tablet-advanced-harness-03-pack-health'));
        await clickButtonText(client, 'Close', { root: '.saga-loredeck-health-center-overlay', enabledOnly: false }).catch(() => false);
        await wait(400);
    }

    const creatorClicked = await clickButtonText(client, 'Create Deck', { root: '.saga-loredeck-library-overlay' })
        || await clickButtonText(client, 'Create Deck');
    if (!creatorClicked) findings.push('Tablet Advanced Create Deck action was not clickable.');
    let creatorState = { open: false, hasTitle: false, hasReviewQueue: false, hasCurrentTask: false, hasClose: false };
    if (creatorClicked) {
        await waitFor(client, '!!document.querySelector(".saga-loredeck-creator-workbench-overlay")', 'Tablet Advanced Creator overlay', 10000);
        await wait(800);
        creatorState = await evaluate(client, script(() => {
            const overlay = document.querySelector('.saga-loredeck-creator-workbench-overlay');
            const text = overlay?.innerText || '';
            const labels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            return {
                open: !!overlay,
                hasTitle: text.includes('Loredeck Creator'),
                hasReviewQueue: text.includes('Review Queue'),
                hasCurrentTask: text.includes('Current Task') || text.includes('Plan') || text.includes('Draft'),
                hasClose: labels.includes('Close'),
                noHorizontalOverflow: !overlay || overlay.scrollWidth <= overlay.clientWidth + 2,
                labels,
            };
        }));
        if (!creatorState.open || !creatorState.hasTitle || !creatorState.hasReviewQueue || !creatorState.hasCurrentTask) findings.push('Tablet Advanced Creator did not render Review Queue/current-task state.');
        if (!creatorState.hasClose) findings.push('Tablet Advanced Creator did not expose Close.');
        if (!creatorState.noHorizontalOverflow) findings.push('Tablet Advanced Creator has horizontal overflow.');
        screenshots.push(await screenshot(client, 'tablet-advanced-harness-04-creator-review-queue'));
        await clickButtonText(client, 'Close', { root: '.saga-loredeck-creator-workbench-overlay', enabledOnly: false }).catch(() => false);
        await wait(400);
    }
    await clickButtonText(client, 'Done', { root: '.saga-loredeck-library-overlay', enabledOnly: false }).catch(() => false);
    await wait(500);

    await clickRuntimeRoute(client, 'context');
    await waitFor(client, sagaActiveTabExpression('context'), 'Tablet Advanced Context route active', 10000);
    await wait(700);
    const contextRouteState = await evaluate(client, script(() => {
        const root = document.querySelector('#saga-lore-panel');
        const drawer = document.querySelector('.saga-runtime-drawer');
        const drawerContent = drawer?.querySelector('.saga-runtime-tab-body, .saga-lore-panel-body') || drawer;
        const text = drawer?.innerText || document.body?.innerText || '';
        return {
            mobileShell: !!root?.classList?.contains('saga-runtime-mobile'),
            activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || root?.dataset?.mobileActiveTab || '',
            drawer: !!drawer,
            hasRuntimeContext: text.includes('Runtime Context'),
            hasBrowseContext: text.includes('Browse Context'),
            hasStoryPosition: text.includes('Story Position'),
            drawerClientWidth: drawerContent?.clientWidth || 0,
            drawerScrollWidth: drawerContent?.scrollWidth || 0,
            bodyClientWidth: document.documentElement?.clientWidth || 0,
            bodyScrollWidth: document.documentElement?.scrollWidth || 0,
            noHorizontalOverflow: (!drawerContent || drawerContent.scrollWidth <= drawerContent.clientWidth + 2)
                && document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2,
        };
    }));
    if (contextRouteState.mobileShell || contextRouteState.activeTab !== 'context' || !contextRouteState.drawer) findings.push('Tablet Advanced Context route did not stay on the desktop rail/drawer path.');
    if (!contextRouteState.hasRuntimeContext || !contextRouteState.hasBrowseContext || !contextRouteState.hasStoryPosition) findings.push('Tablet Advanced Context drawer did not render Runtime Context, Browse Context, and Story Position.');
    if (!contextRouteState.noHorizontalOverflow) findings.push(`Tablet Advanced Context route has horizontal overflow (drawer ${contextRouteState.drawerScrollWidth}/${contextRouteState.drawerClientWidth}, body ${contextRouteState.bodyScrollWidth}/${contextRouteState.bodyClientWidth}).`);

    const browseClicked = await clickButtonText(client, 'Browse Context');
    if (!browseClicked) findings.push('Tablet Advanced Browse Context action was not clickable.');
    let workbenchState = { open: false, hasTimeline: false, hasAliases: false, hasValidation: false, hasStoryPosition: false, hasPhraseResolver: false, hasClose: false };
    if (browseClicked) {
        await waitFor(client, '!!document.querySelector("#saga-context-workbench")', 'Tablet Advanced Context Workbench overlay', 10000);
        await wait(800);
        workbenchState = await evaluate(client, script(() => {
            const overlay = document.querySelector('#saga-context-workbench');
            const text = overlay?.innerText || '';
            const labels = [...overlay?.querySelectorAll('button') || []].map(button => (button.innerText || button.textContent || '').trim()).filter(Boolean);
            const contextRow = overlay?.querySelector('.saga-context-workbench-context-row:not(.saga-context-workbench-row-header)');
            const contextRowRect = contextRow?.getBoundingClientRect?.();
            const contextRowHeight = Math.round(contextRowRect?.height || 0);
            const contextRowScrollHeight = contextRow?.scrollHeight || 0;
            return {
                open: !!overlay,
                hasTimeline: text.includes('Timeline'),
                hasAliases: text.includes('Aliases'),
                hasValidation: text.includes('Validation'),
                hasStoryPosition: text.includes('Choose Story Position') || text.includes('Story Position'),
                hasPhraseResolver: text.includes('Phrase Resolver'),
                hasPackTitle: text.includes('Smoke Test: Arlong Park') || text.includes('Harry Potter: Core') || text.includes('loaded Loredecks'),
                hasClose: labels.includes('Done') || labels.includes('Close'),
                noHorizontalOverflow: !overlay || overlay.scrollWidth <= overlay.clientWidth + 2,
                contextRowHeight,
                contextRowScrollHeight,
                contextRowsFit: !contextRow || contextRowHeight + 1 >= contextRowScrollHeight,
            };
        }));
        if (!workbenchState.open) findings.push('Tablet Advanced Context Workbench did not open.');
        if (!workbenchState.hasTimeline || !workbenchState.hasAliases || !workbenchState.hasValidation) findings.push('Tablet Advanced Context Workbench tabs did not render.');
        if (!workbenchState.hasStoryPosition || !workbenchState.hasPhraseResolver || !workbenchState.hasPackTitle) findings.push('Tablet Advanced Context Workbench did not render loaded Context controls.');
        if (!workbenchState.hasClose) findings.push('Tablet Advanced Context Workbench did not expose Done/Close.');
        if (!workbenchState.noHorizontalOverflow) findings.push('Tablet Advanced Context Workbench has horizontal overflow.');
        if (!workbenchState.contextRowsFit) findings.push(`Tablet Advanced Context Workbench collapsed rows are visually compressed (${workbenchState.contextRowHeight}/${workbenchState.contextRowScrollHeight}).`);
        screenshots.push(await screenshot(client, 'tablet-advanced-harness-05-context-workbench'));
    }

    const errors = client.events
        .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
        .map(event => formatLogEntry(event.params.entry))
        .filter(error => !isExpectedRepoLocalHarnessStorageError(error));
    console.log(JSON.stringify({
        ok: findings.length === 0 && errors.length === 0,
        target: SMOKE_TARGET,
        url: smokeUrl,
        screenshots,
        findings,
        errors,
        dialogEvents,
        shellState,
        libraryClick,
        librarySelection,
        libraryState,
        healthState,
        creatorState,
        contextRouteState,
        browseClicked,
        workbenchState,
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

async function runLiveCreatorSmoke(client, screenshots, findings, smokeUrl, dialogEvents) {
    const config = getLiveCreatorSmokeConfig();
    const steps = [];
    const created = {
        jobIds: new Set(),
        generatedPackIds: new Set(),
        finalizedPackIds: new Set(),
    };
    const rememberArtifacts = state => {
        const job = state?.job || {};
        if (job.jobId) created.jobIds.add(job.jobId);
        if (job.generatedPackId) created.generatedPackIds.add(job.generatedPackId);
        for (const pack of state?.finalizedPacks || []) {
            if (pack?.packId) created.finalizedPackIds.add(pack.packId);
        }
        if (state?.selectedPack?.type === 'custom' && (state.selectedPack.originalPackId || state.selectedPack.creatorJobId)) {
            created.finalizedPackIds.add(state.selectedPack.packId);
        }
    };
    const snapshotArtifacts = () => ({
        jobIds: [...created.jobIds],
        generatedPackIds: [...created.generatedPackIds],
        finalizedPackIds: [...created.finalizedPackIds],
    });
    const stage = async (label, screenshotName = '') => {
        const state = await recordLiveCreatorStep(client, steps, label, screenshots, screenshotName ? `${config.screenshotPrefix}-${screenshotName}` : '');
        rememberArtifacts(state);
        return state;
    };
    const timeout = config.providerTimeoutMs;
    let metadataSnapshot = null;
    let settingsSnapshot = null;
    let preflightDialogCancelState = null;
    let preflightCleanupState = null;
    let freshStartState = null;
    let preflightCancelState = null;
    let staleSmokeResetState = null;
    let postInputCancelState = null;
    let postCancelResetState = null;
    let restoreState = null;
    let restoreSettingsState = null;
    let cleanupState = null;
    let finalDialogCancelState = null;
    let finalizedVerificationState = null;
    let requestHeaders = { 'Content-Type': 'application/json' };
    let thrown = null;

    try {
        preflightDialogCancelState = await cancelLiveCreatorDialogIfPresent(client);
        preflightCleanupState = await cleanupPreviousLiveCreatorSmokeResidue(client).catch(error => ({
            ok: false,
            error: error?.message || String(error),
        }));
        metadataSnapshot = await captureSagaMetadata(client);
        settingsSnapshot = await captureSagaSettings(client);
        requestHeaders = await captureSillyTavernRequestHeaders(client);
        freshStartState = await clearLiveCreatorActiveProjectPointers(client).catch(error => ({
            ok: false,
            error: error?.message || String(error),
        }));

        await openLiveCreatorWorkbench(client);
        preflightCancelState = await cancelLiveCreatorSmokeGenerationIfPresent(client).catch(error => ({
            ok: false,
            error: error?.message || String(error),
        }));
        staleSmokeResetState = await resetLiveCreatorSmokeProjectToIntakeIfNeeded(client).catch(error => ({
            ok: false,
            error: error?.message || String(error),
        }));
        if (staleSmokeResetState && staleSmokeResetState.ok === false) {
            throw new Error(`Live Creator smoke refused to reset active project: ${staleSmokeResetState.reason || staleSmokeResetState.error || 'unknown state'}`);
        }
        await openSummaryText(client, 'Advanced Generation Settings', { root: '.saga-loredeck-creator-workbench-overlay' }).catch(() => false);
        for (const [key, value] of Object.entries(config.generationSettings)) {
            const result = await setLiveCreatorGenerationSetting(client, key, value);
            if (!result?.ok) findings.push(`Live Creator smoke could not set generation setting ${key}: ${result?.reason || 'unknown'}.`);
        }
        for (const [label, value] of [
            ['Fandom', config.fandom],
            ['Scope', config.scope],
            ['Granularity', config.granularity],
            ['Notes', config.notes],
        ]) {
            const result = await setLiveCreatorField(client, label, value);
            if (!result?.ok) throw new Error(`Could not set Creator ${label}: ${result?.reason || 'unknown'}`);
        }
        postInputCancelState = await cancelLiveCreatorSmokeGenerationIfPresent(client).catch(error => ({
            ok: false,
            error: error?.message || String(error),
        }));
        if (postInputCancelState?.cancelled) await wait(800);
        postCancelResetState = await resetLiveCreatorSmokeProjectToIntakeIfNeeded(client).catch(error => ({
            ok: false,
            error: error?.message || String(error),
        }));
        if (postCancelResetState && postCancelResetState.ok === false) {
            throw new Error(`Live Creator smoke refused to clear stale smoke residue after cancellation: ${postCancelResetState.reason || postCancelResetState.error || 'unknown state'}`);
        }
        await stage('intake-ready', '01-intake');

        await requireButtonMatching(client, { labels: ['Draft Scope Brief'] }, 'Draft Scope Brief', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorGenerationState(
            client,
            '!!state?.job?.briefReady',
            state => !!state?.job?.briefReady,
            'live Creator Scope Brief result',
            timeout,
        );
        let state = await stage('scope-brief-drafted', '02-scope-brief');
        if (state.providerNotReady) throw new Error('Reasoning Provider was not ready for the live Creator Scope Brief call.');
        if (!state.job?.briefReady) throw new Error('Live Creator Scope Brief did not produce a brief.');

        await requireButtonMatching(client, { labels: ['Approve Scope Brief'] }, 'Approve Scope Brief', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const labels = state?.visible?.buttonLabels || []; const text = state?.visible?.creatorText || ""; return labels.includes("Draft Story Outline") || text.includes("Draft Story Outline"); })()',
            'live Creator Scope Brief approval UI',
            60000,
        );
        await stage('scope-brief-approved');

        await requireButtonMatching(client, { labels: ['Draft Story Outline'] }, 'Draft Story Outline', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorGenerationState(
            client,
            '!!state?.job?.outlineReady',
            state => !!state?.job?.outlineReady,
            'live Creator Story Outline result',
            timeout,
        );
        state = await stage('story-outline-drafted', '03-story-outline');
        if (!state.job?.outlineReady) throw new Error('Live Creator Story Outline did not produce an outline.');

        await requireButtonMatching(client, { labels: ['Approve Outline and Unlock Title Pass'] }, 'Approve Outline and Unlock Title Pass', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const labels = state?.visible?.buttonLabels || []; const text = state?.visible?.creatorText || ""; return labels.includes("Generate Next Title Batch") || text.includes("Generate Next Title Batch"); })()',
            'live Creator Story Outline approval UI',
            60000,
        );
        await stage('story-outline-approved');

        await requireButtonMatching(client, { labels: ['Generate Next Title Batch'] }, 'Generate Next Title Batch', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorGenerationState(
            client,
            '(state?.job?.titleDraftCount || 0) >= 1',
            state => (state?.job?.titleDraftCount || 0) >= 1,
            'live Creator first Title Batch result',
            timeout,
        );
        state = await stage('first-title-batch-drafted', '04-title-batch');
        if ((state.job?.titleDraftCount || 0) < 1) throw new Error('Live Creator title pass did not produce any title drafts.');

        if ((state.job?.titleBatchTotal || 0) > (state.job?.titleBatchDraftedCount || 0)) {
            await requireButtonMatching(client, { pattern: '^Generate Remaining' }, 'Generate Remaining title batches', { root: '.saga-loredeck-creator-workbench-overlay' });
            await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'live Creator Generate Remaining confirmation', 10000);
            const confirmed = await confirmLiveCreatorDialog(client);
            if (!confirmed?.clicked) throw new Error(`Could not confirm Generate Remaining title batches: ${JSON.stringify(redactDiagnosticValue(confirmed))}`);
            await waitForLiveCreatorGenerationState(
                client,
                '((state?.job?.titleBatchTotal || 0) > 0 && (state?.job?.titleBatchDraftedCount || 0) >= (state?.job?.titleBatchTotal || 0) && !state?.job?.activeGeneration && !labels.includes("Cancel Generation") && !(state?.visible?.busyButtons || []).length)',
                state => {
                    const total = state?.job?.titleBatchTotal || 0;
                    const drafted = state?.job?.titleBatchDraftedCount || 0;
                    const labels = state?.visible?.buttonLabels || [];
                    return total > 0
                        && drafted >= total
                        && !state?.job?.activeGeneration
                        && !labels.includes('Cancel Generation')
                        && !(state?.visible?.busyButtons || []).length;
                },
                'live Creator remaining Title Batches result',
                timeout * 2,
            );
            state = await stage('all-title-batches-drafted', '05-title-batches-complete');
        }
        if ((state.job?.titleBatchTotal || 0) > (state.job?.titleBatchDraftedCount || 0)) {
            throw new Error(`Live Creator title batches are incomplete (${state.job?.titleBatchDraftedCount || 0}/${state.job?.titleBatchTotal || 0}).`);
        }

        await requireButtonMatching(client, { labels: ['Approve'] }, 'Approve first title draft', { root: '.saga-loredeck-creator-title-list' });
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const text = state?.visible?.creatorText || ""; return (state?.job?.approvedTitleCount || 0) >= 1 || text.includes("1 approved") || text.includes("Plan Context and Tags") || text.includes("Plan This Set"); })()',
            'live Creator approved title state',
            120000,
        );
        await stage('one-title-approved', '06-title-approved');

        await requireButtonMatching(client, { labels: ['Plan Context and Tags', 'Plan This Set'] }, 'Plan Context and Tags', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorGenerationState(
            client,
            '(state?.generatedPack?.pendingChangeCount || 0) >= 1 || (state?.job?.planningQueuedCount || 0) >= 1',
            state => (state?.generatedPack?.pendingChangeCount || 0) >= 1 || (state?.job?.planningQueuedCount || 0) >= 1,
            'live Creator Context and Tag planning result',
            timeout,
        );
        state = await stage('context-tags-planned', '07-context-tags');
        if ((state.generatedPack?.pendingChangeCount || 0) < 1 && (state.job?.planningQueuedCount || 0) < 1) {
            throw new Error('Live Creator Context and Tag planning did not create reviewable changes.');
        }

        await requireButtonMatching(client, { labels: ['Accept All'] }, 'Accept All planning changes', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'live Creator planning Accept All confirmation', 10000);
        let confirmed = await confirmLiveCreatorDialog(client);
        if (!confirmed?.clicked) throw new Error(`Could not confirm planning Accept All: ${JSON.stringify(redactDiagnosticValue(confirmed))}`);
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); return (state?.job?.planningAcceptedCount || 0) >= 1 && (state?.generatedPack?.pendingChangeCount || 0) === 0; })()',
            'live Creator planning accepted',
            30000,
        );
        state = await stage('context-tags-accepted', '08-planning-accepted');

        await requireButtonMatching(client, { labels: ['Draft Lorecards'] }, 'Draft Lorecards', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorGenerationState(
            client,
            '(state?.job?.draftChangeCount || 0) >= 1',
            state => (state?.job?.draftChangeCount || 0) >= 1,
            'live Creator Lorecard draft result',
            timeout,
        );
        state = await stage('lorecard-drafted', '09-lorecard-draft');
        if ((state.job?.draftChangeCount || 0) < 1) throw new Error('Live Creator Lorecard drafting did not create Creator Draft Review items.');

        await requireButtonMatching(client, { labels: ['Send All to Review', 'Send Selected to Review'] }, 'Send Creator drafts to Pending Review', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const text = state?.visible?.creatorText || ""; return (state?.job?.draftChangeCount || 0) === 0 && ((state?.generatedPack?.pendingChangeCount || 0) >= 1 || /Review Queue\\s+[1-9]\\d* pending/i.test(text) || /Pending Review\\s+[1-9]\\d*/i.test(text)); })()',
            'live Creator drafts sent to Pending Review',
            30000,
        );
        state = await stage('drafts-sent-to-review', '10-drafts-to-review');

        if (!state.visible?.buttonLabels?.includes('Accept All') && state.visible?.buttonLabels?.includes('Open Review Queue')) {
            await requireButtonMatching(client, { labels: ['Open Review Queue'] }, 'Open Review Queue', { root: '.saga-loredeck-creator-workbench-overlay' });
            await waitForLiveCreatorState(
                client,
                '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const labels = state?.visible?.buttonLabels || []; const text = state?.visible?.creatorText || ""; return labels.includes("Accept All") || text.includes("Accept All") || text.includes("Pending Review"); })()',
                'live Creator Review Queue opened',
                15000,
            );
        }
        await requireButtonMatching(client, { labels: ['Accept All'] }, 'Accept All Lorecard changes', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'live Creator Lorecard Accept All confirmation', 10000);
        confirmed = await confirmLiveCreatorDialog(client);
        if (!confirmed?.clicked) throw new Error(`Could not confirm Lorecard Accept All: ${JSON.stringify(redactDiagnosticValue(confirmed))}`);
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const text = state?.visible?.creatorText || ""; const labels = state?.visible?.buttonLabels || []; return ((state?.generatedPack?.pendingChangeCount || 0) === 0 && (state?.generatedPack?.acceptedEntryCount || 0) >= 1) || labels.includes("Run Pack Health") || (/Review Queue\\s+Empty/i.test(text) && /Pack Health/i.test(text)); })()',
            'live Creator Lorecard accepted',
            30000,
        );
        state = await stage('lorecard-accepted', '11-lorecard-accepted');

        await requireButtonMatching(client, { labels: ['Run Pack Health'] }, 'Run Pack Health', { root: '.saga-loredeck-creator-workbench-overlay' });
        await waitForLiveCreatorState(
            client,
            '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const status = String(state?.generatedPack?.healthStatus || "").trim().toLowerCase(); const labels = state?.visible?.buttonLabels || []; return (!!status && status !== "draft" && status !== "stale") || labels.includes("Finalize as Custom Loredeck") || labels.includes("Finalize Anyway"); })()',
            'live Creator Pack Health result',
            60000,
        );
        await waitForLiveCreatorSettled(client, 'live Creator Pack Health settled', 60000);
        state = await stage('pack-health-run', '12-pack-health');

        if (config.finalize) {
            if (state.visible?.buttonLabels?.includes('Finalize Anyway')) {
                await requireButtonMatching(client, { labels: ['Finalize Anyway'] }, 'Finalize Anyway coverage acknowledgement', { root: '.saga-loredeck-creator-workbench-overlay', preferLast: true });
                await waitFor(client, '!!document.querySelector(".saga-confirm-overlay")', 'live Creator coverage acknowledgement confirmation', 60000);
                confirmed = await confirmLiveCreatorDialog(client, 'Confirm', { timeoutMs: 60000 });
                if (!confirmed?.clicked) throw new Error(`Could not confirm Creator coverage acknowledgement: ${JSON.stringify(redactDiagnosticValue(confirmed))}`);
                await waitForLiveCreatorState(
                    client,
                    '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); const labels = state?.visible?.buttonLabels || []; const disabled = state?.visible?.disabledButtons || []; return !state?.confirmOpen && (!!state?.job?.coverageFinalizeAcknowledgement || (labels.includes("Finalize as Custom Loredeck") && !disabled.includes("Finalize as Custom Loredeck"))); })()',
                    'live Creator coverage acknowledgement settled',
                    60000,
                );
                state = await stage('coverage-acknowledged');
            }
            await requireButtonMatching(client, { labels: ['Finalize as Custom Loredeck'] }, 'Finalize as Custom Loredeck', { root: '.saga-loredeck-creator-workbench-overlay' });
            const finalizeUiState = await waitForLiveCreatorState(
                client,
                '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); return state?.confirmOpen || state?.metadataEditorOpen || (state?.selectedPack?.type === "custom" && (state?.selectedPack?.originalPackId || state?.selectedPack?.creatorJobId)) || (state?.finalizedPacks || []).length > 0; })()',
                'live Creator finalization confirmation or completion',
                30000,
            ).then(() => collectLiveCreatorState(client)).catch(error => ({
                error: error?.message || String(error),
            }));
            if (finalizeUiState?.confirmOpen) {
                confirmed = await confirmLiveCreatorDialog(client);
                if (!confirmed?.clicked) throw new Error(`Could not confirm finalization warnings: ${JSON.stringify(redactDiagnosticValue(confirmed))}`);
            }
            const finalizedViaFiles = await waitForLiveCreatorFinalizedDeckViaFiles(smokeUrl, snapshotArtifacts(), requestHeaders, 90000);
            if (finalizedViaFiles?.ok && finalizedViaFiles.finalizedPackId) {
                created.finalizedPackIds.add(finalizedViaFiles.finalizedPackId);
                finalizedVerificationState = {
                    ok: true,
                    via: 'files',
                    ...finalizedViaFiles,
                    finalizeUiState,
                };
                const staged = await waitForLiveCreatorState(
                    client,
                    '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); return state?.metadataEditorOpen || (state?.selectedPack?.type === "custom" && (state?.selectedPack?.originalPackId || state?.selectedPack?.creatorJobId)) || (state?.finalizedPacks || []).length > 0; })()',
                    'live Creator finalized Custom Loredeck UI',
                    5000,
                ).then(() => stage('finalized-as-custom', '13-finalized')).catch(error => ({
                    error: error?.message || String(error),
                }));
                if (!staged?.error) state = staged;
                else {
                    finalizedVerificationState.uiStage = staged;
                    findings.push(`Live Creator finalized Custom deck verified through files, but the UI did not settle after finalization: ${staged.error}`);
                }
            } else {
                await waitForLiveCreatorState(
                    client,
                    '(() => { const state = window.__sagaLiveCreatorSmokeState?.(); return state?.metadataEditorOpen || (state?.selectedPack?.type === "custom" && (state?.selectedPack?.originalPackId || state?.selectedPack?.creatorJobId)) || (state?.finalizedPacks || []).length > 0; })()',
                    'live Creator finalized Custom Loredeck',
                    90000,
                );
                state = await stage('finalized-as-custom', '13-finalized');
                if (!state.selectedPack && !(state.finalizedPacks || []).length) {
                    throw new Error('Live Creator finalization did not leave a detectable Custom Loredeck record.');
                }
                finalizedVerificationState = await verifyLiveCreatorFinalizedDeck(
                    client,
                    snapshotArtifacts(),
                    screenshots,
                    `${config.screenshotPrefix}-14-finalized-library`,
                );
            }
            if (!finalizedVerificationState?.ok) {
                findings.push(`Live Creator finalized Custom deck verification failed: ${finalizedVerificationState?.check?.reason || finalizedVerificationState?.openState?.reason || 'unexpected finalized deck/library/file state'}.`);
            }
        }
    } catch (error) {
        thrown = {
            message: error?.message || String(error),
            stack: error?.stack || '',
        };
        findings.push(`Live Creator smoke failed: ${thrown.message}`);
        await stage('failure-state', '99-failure').catch(() => null);
    } finally {
        const createdSnapshot = snapshotArtifacts();
        finalDialogCancelState = await cancelLiveCreatorDialogIfPresent(client);
        if (config.cleanup) {
            const cleanupFindings = [];
            const uiCleanup = await cleanupLiveCreatorArtifacts(client, createdSnapshot, cleanupFindings).catch(error => ({
                ok: false,
                error: error?.message || String(error),
            }));
            const needsFileCleanup = !!(
                createdSnapshot.finalizedPackIds?.length
                && (!uiCleanup?.deleted?.length || uiCleanup?.failed?.length || uiCleanup?.ok === false)
            );
            if (needsFileCleanup) {
                const fileCleanup = await cleanupLiveCreatorArtifactsViaFilesApi(smokeUrl, createdSnapshot, requestHeaders).catch(error => ({
                    ok: false,
                    via: 'files-api',
                    error: error?.message || String(error),
                }));
                const filesystemCleanup = fileCleanup?.ok ? null : await cleanupLiveCreatorArtifactsViaFilesystem(createdSnapshot).catch(error => ({
                    ok: false,
                    via: 'filesystem',
                    error: error?.message || String(error),
                }));
                const fallbackCleaned = !!filesystemCleanup?.ok;
                cleanupState = {
                    ui: uiCleanup,
                    file: fileCleanup,
                    filesystem: filesystemCleanup,
                    attempted: [
                        ...(uiCleanup?.attempted || []),
                        ...(fileCleanup?.removedPackIds || []).map(packId => ({ ok: fileCleanup.ok, packId, via: 'files-api' })),
                        ...(filesystemCleanup?.removedPackIds || []).map(packId => ({ ok: filesystemCleanup.ok, packId, via: 'filesystem' })),
                    ],
                    deleted: [
                        ...(uiCleanup?.deleted || []),
                        ...(fileCleanup?.ok ? (fileCleanup.removedPackIds || []) : []),
                        ...(fallbackCleaned ? (filesystemCleanup.removedPackIds || []) : []),
                    ],
                    failed: fileCleanup?.ok || fallbackCleaned ? (uiCleanup?.failed || []) : [
                        ...(uiCleanup?.failed || []),
                        ...(fileCleanup?.failed || []),
                        ...(filesystemCleanup?.failed || []),
                    ],
                };
                if (!fileCleanup?.ok && !fallbackCleaned) {
                    findings.push(...cleanupFindings);
                    const fallbackReason = filesystemCleanup?.reason || filesystemCleanup?.error || '';
                    findings.push(`Live Creator files-api cleanup failed: ${fileCleanup?.reason || fileCleanup?.error || 'unknown failure'}${fallbackReason ? `; filesystem fallback failed: ${fallbackReason}` : ''}.`);
                }
            } else {
                cleanupState = uiCleanup;
                findings.push(...cleanupFindings);
            }
        }
        if (settingsSnapshot !== null) {
            restoreSettingsState = await restoreSagaSettings(client, settingsSnapshot).catch(error => ({
                ok: false,
                error: error?.message || String(error),
            }));
        }
        if (metadataSnapshot !== null) {
            restoreState = await restoreSagaMetadata(client, metadataSnapshot).catch(error => ({
                ok: false,
                error: error?.message || String(error),
            }));
        }
    }

    const errors = collectClientErrors(client)
        .filter(error => !isExpectedLiveCreator404(error));
    const finalCreated = snapshotArtifacts();
    const providerUnits = steps
        .flatMap(step => step.state?.job?.generationUnits || [])
        .filter((unit, index, units) => units.findIndex(candidate => candidate.unitId === unit.unitId) === index);
    const ok = !thrown && findings.length === 0 && errors.length === 0;
    const reportPath = process.env.SAGA_SMOKE_REPORT || path.join(OUT_DIR, `${SMOKE_TARGET}-report.json`);
    const report = redactDiagnosticValue({
        ok,
        target: SMOKE_TARGET,
        url: smokeUrl,
        reportPath,
        providerCallsOptIn: ALLOW_PROVIDER_CALLS,
        config: {
            runId: config.runId,
            fandom: config.fandom,
            scope: config.scope,
            granularity: config.granularity,
            finalize: config.finalize,
            cleanup: config.cleanup,
            providerTimeoutMs: config.providerTimeoutMs,
            generationSettings: config.generationSettings,
        },
        screenshots,
        findings,
        errors,
        dialogEvents,
        created: finalCreated,
        providerUnits,
        steps,
        preflightDialogCancelState,
        preflightCleanupState,
        freshStartState,
        preflightCancelState,
        staleSmokeResetState,
        postInputCancelState,
        postCancelResetState,
        cleanupState,
        finalDialogCancelState,
        finalizedVerificationState,
        restoreSettingsState,
        restoreState,
        thrown,
    });
    await writeSmokeReport(SMOKE_TARGET, report);
    console.log(JSON.stringify(report, null, 2));
    if (!ok) process.exitCode = 1;
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
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--remote-allow-origins=*',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
        'about:blank',
    ];
    if (headless) {
        const headlessArg = String(process.env.SAGA_SMOKE_HEADLESS_MODE || 'new').trim();
        chromeArgs.unshift(
            headlessArg ? `--headless=${headlessArg}` : '--headless',
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
        if (process.env.SAGA_SMOKE_DISABLE_GPU === '1') {
            chromeArgs.unshift(
                '--disable-gpu',
                '--disable-gpu-sandbox',
                '--disable-gpu-compositing',
                '--disable-accelerated-2d-canvas',
                '--disable-accelerated-video-decode',
                '--disable-dev-shm-usage',
            );
        }
    }
    const extraChromeArgs = String(process.env.SAGA_SMOKE_CHROME_EXTRA_ARGS || '')
        .split(/\s+/)
        .map(value => value.trim())
        .filter(Boolean);
    chromeArgs.unshift(...extraChromeArgs);

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
        const devtools = await waitForDevtools(port);
        const { browserWsUrl } = devtools;
        let { pageWsUrl, pageTargetId } = devtools;
        await wait(1000);
        const createFreshTarget = process.env.SAGA_SMOKE_CREATE_TARGET === '1';
        if (createFreshTarget) pageWsUrl = '';
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
        if (createFreshTarget) {
            const created = await sendStartupCdpCommand(client, 'Target.createTarget', { url: 'about:blank' }, cdpStartupDetails);
            pageTargetId = created.targetId || pageTargetId;
            cdpStartupDetails.pageTargetId = pageTargetId;
        }
        if (!pageWsUrl) {
            const attached = await sendStartupCdpCommand(client, 'Target.attachToTarget', { targetId: pageTargetId, flatten: true }, cdpStartupDetails);
            client.sessionId = attached.sessionId;
        }
        if (process.env.SAGA_SMOKE_SKIP_PAGE_ENABLE !== '1') {
            await sendStartupCdpCommand(client, 'Page.enable', {}, cdpStartupDetails);
        }
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

        if (SMOKE_TARGET === MOBILE_ADVANCED_HARNESS_TARGET) {
            await runMobileAdvancedHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents);
            return;
        }

        if (SMOKE_TARGET === MOBILE_REDESIGN_HARNESS_TARGET) {
            await runMobileRedesignHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents);
            return;
        }

        if (SMOKE_TARGET === TABLET_ADVANCED_HARNESS_TARGET) {
            await runTabletAdvancedHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents);
            return;
        }

        if (SMOKE_TARGET === STORAGE_HARNESS_TARGET) {
            await runStorageHarnessSmoke(client, screenshots, findings, smokeUrl, dialogEvents, harness);
            return;
        }

        if (SMOKE_TARGET === 'context-harness') {
            await waitFor(client, 'window.__sagaSmokeReady === true', 'Context smoke ready marker', 20000);
            await waitFor(client, 'document.querySelector(".saga-runtime-rail-tab-active")?.getAttribute("data-tab-id") === "context" || document.querySelector("#saga-lore-panel")?.dataset?.mobileActiveTab === "context"', 'Context tab active', 10000);
            screenshots.push(await screenshot(client, 'context-harness-01-proposal-review'));
            const firstState = await evaluate(client, script(() => {
                const text = document.body?.innerText || '';
                const overlay = document.querySelector('#saga-context-proposal-review');
                return {
                    smokeMeta: window.__sagaContextSmoke || null,
                    mobileShell: !!document.querySelector('#saga-lore-panel.saga-runtime-mobile'),
                    activeTab: document.querySelector('.saga-runtime-rail-tab-active')?.getAttribute('data-tab-id') || document.querySelector('#saga-lore-panel')?.dataset?.mobileActiveTab || '',
                    hasOperatorSummary: !!document.querySelector('.saga-context-operator-summary'),
                    hasStoryPosition: text.includes('Story Position'),
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
            if (firstState.mobileShell) {
                if (!firstState.hasOperatorSummary || !firstState.hasStoryPosition) findings.push('Mobile Context harness did not render the operator Story Position summary.');
            } else if (!firstState.hasRuntimeContext) findings.push('Context harness did not render Runtime Context command center copy.');
            if (!firstState.hasBrowseContext) findings.push('Context harness did not render Browse Context action.');
            if (!firstState.hasReviewProposals) findings.push('Context harness did not render Review Proposals action.');
            if (!firstState.mobileShell && !firstState.hasReasonerProposals) findings.push('Context harness did not render Reasoner Proposals panel.');
            if (!firstState.mobileShell && !firstState.hasLastResolver) findings.push('Context harness did not render Last Resolver Check.');
            if (!firstState.mobileShell && !firstState.hasLastAutomation) findings.push('Context harness did not render Last Automation Check.');
            if (!firstState.mobileShell && !firstState.hasAdvancedBrief) findings.push('Context harness did not render Advanced Context Brief.');
            if (!firstState.mobileShell && !firstState.hasLockedContext) findings.push('Context harness did not expose locked Context state.');
            if (!firstState.overlayOpen || firstState.overlayTitle !== 'Context Proposal Review') findings.push('Context proposal review overlay did not open from smoke fixture.');
            if (firstState.proposalRows < 1) findings.push('Context proposal review overlay did not render proposal rows.');
            if (!firstState.mobileShell && firstState.contextRows < 1) findings.push('Context harness did not render loaded Loredeck Context rows.');

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
                const headerActionLabels = [...overlay?.querySelectorAll('.saga-context-workbench-header .saga-context-workbench-header-actions button') || []]
                    .map(button => (button.innerText || button.textContent || '').trim())
                    .filter(Boolean);
                const bottomActionLabels = [...overlay?.querySelectorAll('.saga-context-workbench-bottom-actions button') || []]
                    .map(button => (button.innerText || button.textContent || '').trim())
                    .filter(Boolean);
                return {
                    open: !!overlay,
                    hasTimeline: text.includes('Timeline'),
                    hasAliases: text.includes('Aliases'),
                    hasValidation: text.includes('Validation'),
                    hasManualLock: /Manual lock|Auto allowed/i.test(text),
                    hasPackTitle: text.includes('Smoke Test: Arlong Park') || text.includes('Harry Potter: Core') || text.includes('loaded Loredecks'),
                    headerActionLabels,
                    bottomActionLabels,
                };
            }));
            if (!workbenchState.open) findings.push('Context Workbench did not open.');
            if (!workbenchState.hasTimeline || !workbenchState.hasAliases || !workbenchState.hasValidation) findings.push('Context Workbench tabs did not render.');
            if (!workbenchState.hasManualLock) findings.push('Context Workbench did not expose lock state.');
            if (!workbenchState.hasPackTitle) findings.push('Context Workbench did not render a loaded Loredeck title.');
            if (firstState.mobileShell) {
                if (workbenchState.headerActionLabels.length) findings.push(`Mobile Context Workbench still rendered persistent header actions: ${workbenchState.headerActionLabels.join(', ')}.`);
                for (const label of ['Refresh Index', 'Done']) {
                    if (!workbenchState.bottomActionLabels.includes(label)) findings.push(`Mobile Context Workbench bottom action bar missing: ${label}.`);
                }
                const contextWorkbenchScrollAudit = await getMobileNestedScrollAuditState(client, {
                    label: 'Context Workbench',
                    scopeSelector: '#saga-context-workbench',
                    allowedSelectors: ['.saga-context-workbench-body'],
                });
                addMobileNestedScrollFindings(findings, contextWorkbenchScrollAudit);
                workbenchState.scrollAudit = contextWorkbenchScrollAudit;
            }

            const errors = client.events
                .filter(event => event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error')
                .map(event => formatLogEntry(event.params.entry))
                .filter(error => !isExpectedRepoLocalHarnessStorageError(error));
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

        if (SMOKE_TARGET === LIVE_CREATOR_TARGET) {
            if (!ALLOW_PROVIDER_CALLS) {
                console.log(JSON.stringify({
                    ok: false,
                    target: SMOKE_TARGET,
                    url: smokeUrl,
                    skipped: true,
                    findings: ['Live Loredeck Creator smoke is opt-in. Set SAGA_ALLOW_PROVIDER_CALLS=1 to spend multiple bounded Reasoning Provider calls and create/delete a test Custom deck.'],
                    errors: [],
                    dialogEvents,
                }, null, 2));
                return;
            }
            await runLiveCreatorSmoke(client, screenshots, findings, smokeUrl, dialogEvents);
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
        if (stateSafetyStorage.present && stateSafetyStorage.hasRemovedStorageMigrationAction) findings.push('Live ST State Safety still exposes removed storage migration status/action.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasVerifyStorage) findings.push('Live ST State Safety did not expose Verify Storage.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasSettleStorageWrites) findings.push('Live ST State Safety did not expose Settle Storage Writes.');
        if (stateSafetyStorage.present && !stateSafetyStorage.hasCleanMissingRecords) findings.push('Live ST State Safety did not expose Clean Missing Records.');
        if (stateSafetyStorage.present && stateSafetyStorage.hasRemovedStorageMigrationRow) findings.push('Live ST State Safety still renders removed storage migration diagnostics.');
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
