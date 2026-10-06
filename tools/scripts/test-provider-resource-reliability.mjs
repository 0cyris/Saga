import assert from 'node:assert/strict';
import test from 'node:test';
import { sendLoreRequest } from '../../src/providers/lore-llm-client.js';
import { storeNamedApiKey } from '../../src/state/secure-keyring.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function host(settings = {}, extra = {}) {
    const context = { extensionSettings: { saga: { loreProvider: 'st', ...settings } }, chatMetadata: {}, saveSettingsDebounced() {}, ...extra };
    globalThis.SillyTavern = { getContext: () => context };
    return context;
}
async function endpoint(reader, run, responsePatch = {}) {
    host({ loreProvider: 'openai_compatible', loreOpenAIBaseUrl: 'https://fixture.invalid', loreOpenAIModel: 'fixture', loreOpenAIKeySet: true });
    await storeNamedApiKey('loreOpenAI', 'fixture-key');
    const previous = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => null }, body: { getReader: () => reader }, ...responsePatch });
    try { return await run(); } finally { globalThis.fetch = previous; }
}
function chunkReader(text) {
    let done = false;
    return { cancelled: 0, released: 0,
        async read() { if (done) return { done: true }; done = true; return { value: new TextEncoder().encode(text), done: false }; },
        async cancel() { this.cancelled += 1; }, releaseLock() { this.released += 1; },
    };
}

test('raw host cancellation rejects promptly and quarantines its late result until settled', async () => {
    const old = deferred(); let calls = 0; let progress = 0;
    host({}, { generateRaw: () => (++calls === 1 ? old.promise : Promise.resolve('replacement')) });
    const controller = new AbortController();
    const first = sendLoreRequest('system', 'first', { signal: controller.signal, onProgress: () => { progress += 1; }, timeoutMs: 200 });
    await pause(1); controller.abort();
    const observed = first.then(value => ({ value }), error => ({ error }));
    const second = sendLoreRequest('system', 'second', { timeoutMs: 200 });
    await pause(10);
    const before = calls; const beforeProgress = progress;
    old.resolve('stale output');
    const firstResult = await observed;
    assert.equal(await second, 'replacement');
    assert.equal(before, 1, 'the uncancellable host request must keep the route lease');
    assert.equal(firstResult.error?.name, 'AbortError');
    assert.equal(progress, beforeProgress, 'late content must not publish progress');
});

test('raw and quiet host requests have a total deadline', async () => {
    host({}, { generateQuietPrompt: async () => { await pause(30); return 'late'; } });
    await assert.rejects(sendLoreRequest('system', 'user', { timeoutMs: 5 }), error => error.code === 'provider_timeout');
    await pause(35);
});

test('connection profile forwards the actual request cancellation signal', async () => {
    let received;
    host({ loreProvider: 'profile', loreProfileId: 'fixture' }, { ConnectionManagerRequestService: { sendRequest: async (_id, _messages, _tokens, custom) => { received = custom.signal; return 'profile output'; } } });
    assert.equal(await sendLoreRequest('system', 'user', { signal: new AbortController().signal }), 'profile output');
    assert(received instanceof AbortSignal);
});

test('an ignored profile signal retains the route lease until its old request settles', async () => {
    const old = deferred(); let calls = 0; let received;
    host({ loreProvider: 'profile', loreProfileId: 'ignored-signal' }, { ConnectionManagerRequestService: { sendRequest: (_id, _messages, _tokens, custom) => { received = custom.signal; return ++calls === 1 ? old.promise : Promise.resolve('new profile output'); } } });
    const first = sendLoreRequest('s', 'old', { timeoutMs: 5 });
    await assert.rejects(first, error => error.code === 'provider_timeout');
    assert.equal(received.aborted, true);
    const second = sendLoreRequest('s', 'new', { timeoutMs: 100 });
    await pause(10); const before = calls; old.resolve('late ignored result');
    assert.equal(await second, 'new profile output'); assert.equal(before, 1);
});

test('a replacement waiting behind an uncancellable host request expires without contacting host', async () => {
    const old = deferred(); let calls = 0;
    host({}, { generateRaw: () => { calls += 1; return old.promise; } });
    await assert.rejects(sendLoreRequest('s', 'old', { timeoutMs: 5, maxConcurrency: 99 }), error => error.code === 'provider_timeout');
    await assert.rejects(sendLoreRequest('s', 'queued', { timeoutMs: 5, maxConcurrency: 99 }), error => error.code === 'provider_timeout');
    assert.equal(calls, 1); old.resolve('late'); await pause(1);
});

test('SSE enforces wire byte budget including reasoning and releases reader', async () => {
    const reader = chunkReader(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: 'x'.repeat(100) } }] })}\n\n`);
    await endpoint(reader, async () => {
        await assert.rejects(sendLoreRequest('s', 'u', { stream: true, onProgress() {}, maxOutputBytes: 50 }), error => error.code === 'provider_response_too_large');
        assert.equal(reader.cancelled, 1); assert.equal(reader.released, 1);
    });
});

test('SSE rejects malformed JSON rather than silently accepting partial output', async () => {
    const reader = chunkReader('data: {not-json}\n\ndata: {"choices":[{"delta":{"content":"partial"}}]}\n\n');
    await endpoint(reader, async () => {
        await assert.rejects(sendLoreRequest('s', 'u', { stream: true, onProgress() {} }), error => error.code === 'provider_stream_malformed');
        assert.equal(reader.cancelled, 1); assert.equal(reader.released, 1);
    });
});

test('SSE stalled read expires at idle deadline and cleans reader', async () => {
    const reader = { cancelled: 0, released: 0, read: async () => { await pause(30); return { done: true }; }, async cancel() { this.cancelled += 1; }, releaseLock() { this.released += 1; } };
    await endpoint(reader, async () => {
        await assert.rejects(sendLoreRequest('s', 'u', { stream: true, onProgress() {}, idleTimeoutMs: 5 }), error => error.code === 'provider_stream_idle_timeout');
        assert.equal(reader.cancelled, 1); assert.equal(reader.released, 1);
    });
});

test('SSE bounds an unfinished event buffer and releases a successful reader too', async () => {
    const reader = chunkReader('data: ' + 'x'.repeat(100));
    await endpoint(reader, async () => {
        await assert.rejects(sendLoreRequest('s', 'u', { stream: true, onProgress() {}, maxSseBufferBytes: 20 }), error => error.code === 'provider_response_too_large');
        assert.equal(reader.cancelled, 1); assert.equal(reader.released, 1);
    });
    const successful = chunkReader('data: {"choices":[{"delta":{"content":"usable"}}]}\n\ndata: [DONE]\n\n');
    await endpoint(successful, async () => {
        assert.equal(await sendLoreRequest('s', 'u', { stream: true, onProgress() {} }), 'usable');
        assert.equal(successful.cancelled, 0); assert.equal(successful.released, 1);
    });
});

test('SSE abort cancels a stalled reader and suppresses its late content', async () => {
    const read = deferred(); let deltas = 0;
    const reader = { cancelled: 0, released: 0, read: () => read.promise, async cancel() { this.cancelled += 1; }, releaseLock() { this.released += 1; } };
    await endpoint(reader, async () => {
        const controller = new AbortController();
        const pending = sendLoreRequest('s', 'u', { signal: controller.signal, stream: true, onProgress: event => { if (event.type === 'delta') deltas += 1; } });
        await pause(1); controller.abort();
        await assert.rejects(pending, error => error.name === 'AbortError');
        assert.equal(reader.cancelled, 1); assert.equal(reader.released, 1);
        read.resolve({ value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"late"}}]}\n\n'), done: false });
        await pause(1); assert.equal(deltas, 0);
    });
});

test('nonstream body enforces the same byte budget', async () => {
    const reader = chunkReader(JSON.stringify({ choices: [{ message: { content: 'x'.repeat(150) } }] }));
    await endpoint(reader, async () => {
        await assert.rejects(sendLoreRequest('s', 'u', { maxOutputBytes: 50 }), error => error.code === 'provider_response_too_large');
        assert.equal(reader.cancelled, 1); assert.equal(reader.released, 1);
    }, { text: async () => JSON.stringify({ choices: [{ message: { content: 'x'.repeat(150) } }] }) });
});

test('auth failures preserve status and never trigger compatibility retries', async () => {
    const reader = chunkReader('max_tokens unauthorized'); let calls = 0;
    await endpoint(reader, async () => {
        const fetchFixture = globalThis.fetch;
        globalThis.fetch = async (...args) => { calls += 1; return fetchFixture(...args); };
        await assert.rejects(sendLoreRequest('s', 'u'), error => error.code === 'provider_auth_failed' && error.status === 401);
        assert.equal(calls, 1);
    }, { ok: false, status: 401, text: async () => 'max_tokens unauthorized' });
});

test('rate-limit response retains Retry-After for the caller retry policy', async () => {
    const reader = chunkReader('limited');
    await endpoint(reader, async () => {
        await assert.rejects(sendLoreRequest('s', 'u'), error => error.code === 'provider_rate_limited' && error.status === 429 && error.retryAfter === '3');
    }, { ok: false, status: 429, headers: { get: name => name === 'retry-after' ? '3' : null } });
});
