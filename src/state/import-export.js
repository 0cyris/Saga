/**
 * Saga state import/export envelope helpers.
 */

import { SCHEMA_VERSION } from './schema.js';
import { createStateBackupSnapshot } from './state-backup.js';
import { stripRetiredStateHistoryFields } from './storage-safety.js';

export const SAGA_STATE_EXPORT_SCHEMA = 'saga-state-export/v1';
export const MIN_SUPPORTED_IMPORT_STATE_SCHEMA_VERSION = 20;

export function unwrapImportedSagaState(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return parsed;
    if (parsed.schemaVersion === SAGA_STATE_EXPORT_SCHEMA && parsed.state && typeof parsed.state === 'object') {
        return parsed.state;
    }
    if (parsed.schema === SAGA_STATE_EXPORT_SCHEMA && parsed.state && typeof parsed.state === 'object') {
        return parsed.state;
    }
    if (parsed.chatState && typeof parsed.chatState === 'object') return parsed.chatState;
    if (parsed.sagaState && typeof parsed.sagaState === 'object') return parsed.sagaState;
    return parsed;
}

export function getImportedStateSchemaError(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
    const rawVersion = parsed._version;
    if (rawVersion === undefined || rawVersion === null || rawVersion === '') {
        return `Imported Saga state is missing _version. Restore from a current Saga export or reset Saga state before importing.`;
    }
    const version = Number(rawVersion);
    if (!Number.isFinite(version) || version <= 0) {
        return `Imported Saga state has unsupported schema version "${rawVersion}". Restore from a current Saga export or reset Saga state before importing.`;
    }
    if (version < MIN_SUPPORTED_IMPORT_STATE_SCHEMA_VERSION) {
        return `Unsupported Saga state schema ${version}. Minimum import schema is ${MIN_SUPPORTED_IMPORT_STATE_SCHEMA_VERSION}; use a current Saga export or reset Saga state instead of partial migration.`;
    }
    if (version > SCHEMA_VERSION) {
        return `Unsupported future Saga state schema ${version}. This build supports schema ${SCHEMA_VERSION}. Update Saga before importing this file.`;
    }
    return '';
}

export function serializeStateExport(state = {}) {
    return JSON.stringify(stripRetiredStateHistoryFields({ ...(state || {}) }), null, 2);
}

export function serializeSagaStateExport(state = {}) {
    const snapshot = createStateBackupSnapshot(state || {});
    return JSON.stringify({
        schemaVersion: SAGA_STATE_EXPORT_SCHEMA,
        exportedAt: Date.now(),
        state: snapshot,
    }, null, 2);
}
