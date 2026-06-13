/**
 * Storage-backed Pack Health issue disposition persistence.
 */

import {
    normalizeLoredeckHealthIssueStates,
} from '../state/lore-state-normalizers.js';
import {
    upsertExternalLoredeckLibraryRecordSync,
} from '../storage/saga-lorepack-library-storage.js';
import {
    hydrateExternalLorepackPayloadRecord,
    upsertExternalLorepackPayloadSync,
} from '../storage/saga-lorepack-payload-storage.js';

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
    if (value === undefined) return undefined;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return isPlainObject(value) ? { ...value } : value;
    }
}

function normalizeIssueKey(value = '') {
    return String(value || '').trim().slice(0, 180);
}

function normalizeStateRecord(value = null) {
    if (!isPlainObject(value)) return null;
    const status = String(value.status || '').trim();
    if (!status) return null;
    return cloneJson(value);
}

function normalizeStorageError(error = {}, fallback = 'Pack Health issue state save failed.') {
    return String(error?.message || error || fallback).trim().replace(/\s+/g, ' ').slice(0, 500) || fallback;
}

function nowValue(options = {}) {
    if (typeof options.now === 'function') return Number(options.now()) || Date.now();
    if (options.now !== undefined) return Number(options.now) || Date.now();
    return Date.now();
}

export async function persistLoredeckHealthIssueState(packOrId = {}, issueKey = '', stateRecord = null, _message = '', options = {}) {
    const key = normalizeIssueKey(issueKey);
    if (!key) {
        return {
            ok: false,
            error: 'Pack Health issue state needs a stable issue key.',
            code: 'health_issue_state_missing_key',
        };
    }
    const input = typeof packOrId === 'string'
        ? { packId: packOrId, payloadFile: options.payloadFile || '' }
        : (isPlainObject(packOrId) ? packOrId : {});
    if (!input.packId && !input.id) {
        return {
            ok: false,
            error: 'Pack Health issue state needs a Loredeck pack id.',
            code: 'health_issue_state_missing_pack_id',
        };
    }
    if (input.type === 'bundled') {
        return {
            ok: false,
            error: 'Bundled Loredecks are read-only. Duplicate as Custom before setting issue state.',
            code: 'health_issue_state_readonly',
        };
    }

    let payload;
    try {
        payload = await hydrateExternalLorepackPayloadRecord(input, options);
    } catch (error) {
        return {
            ok: false,
            error: normalizeStorageError(error, 'Pack Health issue state payload load failed.'),
            code: 'health_issue_state_payload_load_failed',
        };
    }
    if (!payload?.packId) {
        return {
            ok: false,
            error: 'Pack Health issue state payload could not be loaded.',
            code: 'health_issue_state_payload_missing',
        };
    }

    const states = normalizeLoredeckHealthIssueStates(payload.healthIssueStates);
    const nextRecord = normalizeStateRecord(stateRecord);
    if (nextRecord) states[key] = { ...nextRecord, issueKey: key };
    else delete states[key];

    const nextPayload = {
        ...payload,
        healthIssueStates: Object.keys(states).length ? states : {},
        localModified: true,
        updatedAt: nowValue(options),
    };
    const payloadResult = upsertExternalLorepackPayloadSync(nextPayload, options);
    if (!payloadResult.ok) return payloadResult;
    const libraryResult = upsertExternalLoredeckLibraryRecordSync(payloadResult.libraryRecord, options);
    if (!libraryResult.ok) return libraryResult;
    return {
        ok: true,
        pack: payloadResult.pack,
        libraryRecord: payloadResult.libraryRecord,
        library: libraryResult.library,
        healthIssueStates: Object.keys(states).length ? states : {},
    };
}
