/** Retain failed requests until a successful retry of their owner and operation. */
export function createSagaStorageOperationOutcomes() {
    let sequence = 0;
    const failures = new Map();
    const clone = value => JSON.parse(JSON.stringify(value ?? null));
    function begin(ownerId, operation, request) {
        return {
            operationId: `${operation}:${ownerId}:${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}:${++sequence}:${Math.random().toString(36).slice(2)}`}`,
            ownerId,
            operation,
            request: clone(request),
            retryOf: [...failures.values()]
                .filter(item => item.ownerId === ownerId && item.operation === operation)
                .map(item => item.operationId),
        };
    }
    function fail(attempt, error) {
        failures.set(attempt.operationId, {
            ...attempt,
            error: String(error?.message || error || 'Saga storage write failed.'),
            code: error?.code || 'storage_write_failed',
            retryable: true,
        });
    }
    function succeed(attempt) {
        for (const id of attempt.retryOf) failures.delete(id);
    }
    function getFailures() { return clone([...failures.values()]); }
    function restore(items) {
        for (const item of items) if (!failures.has(item.operationId)) failures.set(item.operationId, clone(item));
    }
    function getError() { return [...failures.values()].map(item => item.error).join('; '); }
    function reset() { failures.clear(); sequence = 0; }
    return { begin, fail, succeed, getFailures, getError, reset, restore };
}
