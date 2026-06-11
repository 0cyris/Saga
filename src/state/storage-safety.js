/**
 * Storage safety helpers for Saga state persistence.
 */

const RETIRED_STORAGE_KEYS = ['memo' + 'History', 'state' + 'History'];

export function safeJsonSize(value) {
    try {
        return JSON.stringify(value || {}).length;
    } catch (_e) {
        return 0;
    }
}

export function stripRetiredStateHistoryFields(state = {}) {
    if (state && typeof state === 'object') {
        for (const key of RETIRED_STORAGE_KEYS) delete state[key];
    }
    return state;
}
