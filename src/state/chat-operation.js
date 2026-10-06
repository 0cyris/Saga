/** Ownership of asynchronous work. A chat switch revokes every prior generation. */
import { getSettings } from './settings-store.js';

let generation = 0;
let operationSequence = 0;
let operationsEnabled = true;
const liveOperations = new Set();
const lanes = new WeakMap();
const queues = new WeakMap();

function currentContext() {
    try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; }
}

export function getChatOperationIdentity(ctx) {
    let currentChatId;
    try { currentChatId = ctx?.getCurrentChatId?.(); } catch (_) { /* Fall back to host context fields. */ }
    return currentChatId ?? ctx?.chatId ?? ctx?.chat_id ?? ctx?.chatMetadata?.chat_id ?? ctx?.groupId ?? null;
}

export function captureChatOperation(options = {}) {
    const context = currentContext();
    const metadata = context?.chatMetadata;
    const identity = getChatOperationIdentity(context);
    const epoch = generation;
    const controller = new AbortController();
    const lane = options.lane || '';
    let laneVersions = metadata && lanes.get(metadata);
    if (metadata && !laneVersions) { laneVersions = new Map(); lanes.set(metadata, laneVersions); }
    const version = lane ? (laneVersions?.get(lane) || 0) + 1 : 0;
    if (lane) laneVersions?.set(lane, version);
    if (lane) {
        for (const previous of liveOperations) {
            if (previous.metadata === metadata && previous.lane === lane) { previous.cancel(); previous.release(); }
        }
    }
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const operation = {
        id: `chat-operation-${++operationSequence}`, context, metadata, identity, lane, generation: epoch,
        signal: controller.signal,
        isCurrent() {
            const now = currentContext();
            return !!metadata && !controller.signal.aborted && generation === epoch
                && now?.chatMetadata === metadata && getChatOperationIdentity(now) === identity
                && (!lane || laneVersions?.get(lane) === version)
                && (options.requireEnabled === false || (operationsEnabled && getSettings().enabled !== false));
        },
        assertCurrent() {
            if (this.isCurrent()) return;
            const error = new Error('The originating chat operation is no longer current.');
            error.code = 'SAGA_CHAT_OPERATION_STALE';
            throw error;
        },
        cancel() { controller.abort(); },
        release() { liveOperations.delete(operation); options.signal?.removeEventListener('abort', abort); },
    };
    liveOperations.add(operation);
    return operation;
}

export function revokeChatOperations() {
    generation++;
    for (const operation of liveOperations) { operation.cancel(); operation.release(); }
}

export function setChatOperationsEnabled(enabled) {
    const next = enabled !== false;
    if (!next || operationsEnabled !== next) revokeChatOperations();
    operationsEnabled = next;
}

export function areChatOperationsEnabled() { return operationsEnabled && getSettings().enabled !== false; }

export function isStaleChatOperation(error) { return error?.code === 'SAGA_CHAT_OPERATION_STALE'; }

/** At most one automatic run per chat, retaining only the latest pending turn. */
export function enqueueChatAutomation(run) {
    const operation = captureChatOperation();
    if (!operation.isCurrent()) { operation.release(); return Promise.resolve({ status: 'cancelled' }); }
    let queue = queues.get(operation.metadata);
    if (!queue) { queue = { running: false, pending: null }; queues.set(operation.metadata, queue); }
    return new Promise(resolve => {
        const waiters = queue.pending?.waiters || [];
        queue.pending?.operation.release();
        queue.pending = { run, operation, waiters: [...waiters, resolve] };
        if (queue.running) return;
        queue.running = true;
        void (async () => {
            try {
                while (queue.pending) {
                    const next = queue.pending;
                    queue.pending = null;
                    let result;
                    try { result = next.operation.isCurrent() ? await next.run(next.operation) : { status: 'cancelled' }; }
                    catch (error) { result = { status: isStaleChatOperation(error) ? 'cancelled' : 'failed_exception', error: error?.message || String(error) }; }
                    finally { next.operation.release(); }
                    for (const waiter of next.waiters) waiter(result);
                }
            } finally { queue.running = false; }
        })();
    });
}
