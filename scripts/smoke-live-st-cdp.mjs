import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

const ST_URL = process.env.SAGA_ST_URL || 'http://127.0.0.1:8000/';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const OUT_DIR = process.env.SAGA_SMOKE_OUT || path.join(ROOT, 'Images', 'documentation', 'renders', 'saga-smoke');
const VIEWPORT = { width: 1280, height: 720 };

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

        await client.send('Page.navigate', { url: ST_URL });
        await waitFor(client, 'document.readyState === "complete"', 'SillyTavern load', 20000);
        await waitFor(client, '!!document.querySelector("#wandlight-lore-panel")', 'Saga runtime panel', 20000);
        await wait(2500);
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

        await clickButtonText(client, 'Open Health Report', { root: '.wandlight-loredeck-library-overlay' });
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

        const updateProbe = await evaluate(client, script(() => {
            const buttons = [...document.querySelectorAll('button')].filter(button => {
                const clean = (button.innerText || button.textContent || '').trim();
                return clean === 'Check Updates';
            });
            const detailText = document.querySelector('.wandlight-loredeck-detail-card')?.innerText || '';
            return {
                hasButton: buttons.length > 0,
                hasEnabledButton: buttons.some(button => !button.disabled),
                expectsUpdateControl: /update URL registered/i.test(detailText),
                detailText: detailText.slice(0, 500),
            };
        }));
        const updateClicked = updateProbe.hasEnabledButton ? await clickButtonText(client, 'Check Updates') : false;
        if (updateClicked) {
            await waitFor(client, 'document.body.innerText.includes("Loredeck Update Preview")', 'update preview', 15000);
            await wait(1000);
            screenshots.push(await screenshot(client, 'live-st-06-update-preview'));
            await clickButtonText(client, 'Cancel', { enabledOnly: false });
            await wait(500);
        } else if (updateProbe.expectsUpdateControl) {
            findings.push('Selected Loredeck records an update URL, but Check Updates was not enabled in the live Loredecks drawer.');
        }

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
            url: ST_URL,
            screenshots,
            findings,
            errors,
            dialogEvents,
            state,
        }, null, 2));
    } finally {
        client?.close();
        proc.kill();
        await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
        if (stderr && process.env.SAGA_SMOKE_DEBUG) console.error(stderr);
    }
}

main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error.message, stack: error.stack }, null, 2));
    process.exitCode = 1;
});
