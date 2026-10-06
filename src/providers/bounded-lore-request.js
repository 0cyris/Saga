// A caller deadline does not prove an adapter stopped. Keep its route lease
// until the underlying adapter actually settles, including ignored aborts.
const routes = new Map();
export const LORE_REQUEST_DEFAULTS = Object.freeze({ timeoutMs: 300000, idleTimeoutMs: 30000, maxOutputBytes: 1024 * 1024, maxSseBufferBytes: 64 * 1024 });

export function createProviderResourceError(code, message, details = {}) {
    return Object.assign(new Error(message), { code, details });
}
export function throwIfLoreRequestAborted(signal) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new DOMException('Request aborted', 'AbortError');
}
function positive(value, fallback) { const n = Math.floor(Number(value)); return Number.isFinite(n) && n > 0 ? n : fallback; }
export function getLoreRequestLimits(options = {}) {
    return Object.fromEntries(Object.entries(LORE_REQUEST_DEFAULTS).map(([key, fallback]) => [key, positive(options[key], fallback)]));
}
export function assertLoreOutputSize(text, options = {}) {
    if (new TextEncoder().encode(String(text || '')).byteLength > getLoreRequestLimits(options).maxOutputBytes) {
        throw createProviderResourceError('provider_response_too_large', 'Provider response exceeded its byte limit.');
    }
}

function acquireRoute(key, capacity, signal) {
    throwIfLoreRequestAborted(signal);
    let route = routes.get(key);
    if (!route) { route = { active: 0, queue: [], capacity }; routes.set(key, route); }
    return new Promise((resolve, reject) => {
        const entry = { signal, reject, start: null, abort: null };
        entry.abort = () => {
            route.queue = route.queue.filter(item => item !== entry);
            reject(signal.reason instanceof Error ? signal.reason : new DOMException('Request aborted', 'AbortError'));
        };
        entry.start = () => {
            signal?.removeEventListener('abort', entry.abort);
            route.active += 1;
            let released = false;
            resolve(() => {
                if (released) return;
                released = true; route.active -= 1;
                while (route.active < route.capacity && route.queue.length) {
                    const next = route.queue.shift();
                    if (next.signal?.aborted) next.abort(); else next.start();
                }
                if (!route.active && !route.queue.length) routes.delete(key);
            });
        };
        signal?.addEventListener('abort', entry.abort, { once: true });
        if (route.active < route.capacity) entry.start(); else route.queue.push(entry);
    });
}

export async function runBoundedLoreRequest(routeKey, factory, options = {}) {
    const limits = getLoreRequestLimits(options);
    const controller = new AbortController();
    const abortRequest = error => { if (!controller.signal.aborted) controller.abort(error); };
    const parentAbort = () => abortRequest(new DOMException('Request aborted', 'AbortError'));
    if (options.signal?.aborted) parentAbort(); else options.signal?.addEventListener('abort', parentAbort, { once: true });
    const timer = setTimeout(() => abortRequest(createProviderResourceError('provider_timeout', 'Provider request timed out at its total deadline.', { timeoutMs: limits.timeoutMs })), limits.timeoutMs);
    let onAbort;
    const cancelled = new Promise((_, reject) => {
        onAbort = () => reject(controller.signal.reason);
        if (controller.signal.aborted) onAbort(); else controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const work = (async () => {
        const release = await acquireRoute(routeKey, Math.max(1, Math.min(4, positive(options.maxConcurrency, 1))), controller.signal);
        try {
            throwIfLoreRequestAborted(controller.signal);
            const value = await factory({ ...options, ...limits, signal: controller.signal, abortRequest });
            throwIfLoreRequestAborted(controller.signal);
            return value;
        } finally { release(); }
    })();
    try { return await Promise.race([work, cancelled]); }
    finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', parentAbort);
        controller.signal.removeEventListener('abort', onAbort);
        work.catch(() => {});
    }
}

export async function consumeBoundedLoreResponse(response, options = {}, onChunk) {
    const limits = getLoreRequestLimits(options);
    const declared = Number(response.headers?.get?.('content-length'));
    if (declared > limits.maxOutputBytes) {
        try { Promise.resolve(response.body?.cancel?.()).catch(() => {}); } catch (_) {}
        throw createProviderResourceError('provider_response_too_large', 'Provider response exceeded its byte limit.');
    }
    if (!response.body?.getReader) {
        const text = await response.text();
        throwIfLoreRequestAborted(options.signal); assertLoreOutputSize(text, limits);
        onChunk(new TextEncoder().encode(text)); return;
    }
    const reader = response.body.getReader();
    let bytes = 0; let finished = false; let pendingRead = null;
    try {
        while (true) {
            throwIfLoreRequestAborted(options.signal);
            let timer; let onAbort;
            pendingRead = Promise.resolve(reader.read());
            const guard = new Promise((_, reject) => {
                onAbort = () => reject(options.signal.reason instanceof Error ? options.signal.reason : new DOMException('Request aborted', 'AbortError'));
                options.signal?.addEventListener('abort', onAbort, { once: true });
                timer = setTimeout(() => {
                    const error = createProviderResourceError('provider_stream_idle_timeout', 'Provider response stalled beyond its idle deadline.', { idleTimeoutMs: limits.idleTimeoutMs });
                    options.abortRequest?.(error); reject(error);
                }, limits.idleTimeoutMs);
            });
            let chunk;
            try { chunk = await Promise.race([pendingRead, guard]); }
            finally { clearTimeout(timer); options.signal?.removeEventListener('abort', onAbort); }
            pendingRead = null;
            if (chunk.done) { finished = true; break; }
            bytes += chunk.value?.byteLength || 0;
            if (bytes > limits.maxOutputBytes) throw createProviderResourceError('provider_response_too_large', 'Provider response exceeded its byte limit.');
            onChunk(chunk.value);
        }
    } catch (error) { options.abortRequest?.(error); throw error; }
    finally {
        let cancelled;
        if (!finished) { try { cancelled = Promise.resolve(reader.cancel()); } catch (_) {} }
        try { reader.releaseLock(); } catch (_) {}
        // If read/cancel ignore cancellation, retain the adapter's lease too.
        await Promise.allSettled([...(pendingRead ? [pendingRead] : []), ...(cancelled ? [cancelled] : [])]);
    }
}

export async function readBoundedLoreResponseText(response, options = {}) {
    const decoder = new TextDecoder(); let text = '';
    await consumeBoundedLoreResponse(response, options, chunk => { text += decoder.decode(chunk, { stream: true }); });
    return text + decoder.decode();
}
